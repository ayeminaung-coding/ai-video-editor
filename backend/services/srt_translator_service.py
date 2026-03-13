# services/srt_translator_service.py — SRT/TXT file subtitle translator
# Parses .srt or .txt subtitle content and translates via Gemini or Vertex AI

import re
import json
import time
import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
BATCH_SIZE = 40          # Reduced from 80 — smaller batches = more reliable responses
MAX_RETRIES = 3
BASE_RETRY_DELAY = 2.0
MAX_RETRY_DELAY = 30.0


# ── SRT / TXT Parsing ─────────────────────────────────────────────────────────

def _parse_srt(content: str) -> list[dict]:
    """Parse standard SRT content into a list of subtitle blocks."""
    blocks = []
    # Normalize line endings
    content = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    # Split on blank lines between blocks
    raw_blocks = re.split(r"\n{2,}", content)

    for raw in raw_blocks:
        lines = raw.strip().splitlines()
        if len(lines) < 2:
            continue
        # First line = index number
        try:
            index = int(lines[0].strip())
        except ValueError:
            continue
        # Second line = timestamp
        if "-->" not in lines[1]:
            continue
        timestamp = lines[1].strip()
        text = "\n".join(lines[2:]).strip()
        if text:
            blocks.append({"index": index, "timestamp": timestamp, "text": text})

    return blocks


def _parse_txt(content: str) -> list[dict]:
    """
    Parse a plain-text subtitle file.
    Supports two common formats:
      1. Numbered lines:  123\nSubtitle text
      2. Raw lines:       one subtitle per line (assigned auto-index)
    Returns blocks with a dummy timestamp since TXT has no timing.
    """
    blocks = []
    content = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    lines = [l for l in content.splitlines() if l.strip()]

    i = 0
    auto_index = 1
    while i < len(lines):
        line = lines[i].strip()
        # Check if line is a standalone number (index)
        if re.match(r"^\d+$", line) and i + 1 < len(lines):
            text = lines[i + 1].strip()
            if text:
                blocks.append({
                    "index": int(line),
                    "timestamp": "",
                    "text": text,
                })
            i += 2
        else:
            blocks.append({
                "index": auto_index,
                "timestamp": "",
                "text": line,
            })
            auto_index += 1
            i += 1

    return blocks


def parse_subtitle_file(content: str, filename: str) -> list[dict]:
    """Detect format from filename extension and parse accordingly."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "srt":
        return _parse_srt(content)
    else:
        # txt or unknown — try SRT first, fall back to plain text
        blocks = _parse_srt(content)
        if not blocks:
            blocks = _parse_txt(content)
        return blocks


# ── SRT Assembly ──────────────────────────────────────────────────────────────

def build_srt(blocks: list[dict], translated_texts: list[str]) -> str:
    """Reassemble translated text back into .srt format."""
    lines = []
    for i, (block, text) in enumerate(zip(blocks, translated_texts)):
        entry_index = block.get("index", i + 1)
        timestamp = block.get("timestamp", "")
        if timestamp:
            lines.append(str(entry_index))
            lines.append(timestamp)
            lines.append(text.strip())
            lines.append("")
        else:
            # TXT source — output as plain numbered lines
            lines.append(f"{entry_index}. {text.strip()}")
    return "\n".join(lines).strip()


# ── Gemini Translation ────────────────────────────────────────────────────────

def _build_translation_prompt(
    blocks: list[dict],
    source_lang: str,
    target_lang: str,
    custom_prompt: str = "",
) -> str:
    texts = [
        {"id": b["index"], "text": b["text"]}
        for b in blocks
    ]
    payload = json.dumps(texts, ensure_ascii=False, indent=None)

    # Detect specific language codes for extra emphasis
    # ── Main prompt ───────────────────────────────────────────────────────────
    main = f"""You are a professional subtitle translator. Translate the following {source_lang} subtitles into {target_lang}.

STRICT RULES — YOU MUST FOLLOW ALL OF THESE WITHOUT EXCEPTION:
1. OUTPUT LANGUAGE: Every single "text" value in your output MUST be written in {target_lang} ONLY.
   - DO NOT write even a single word in {source_lang} in the output.
   - DO NOT copy, quote, include, or mix any {source_lang} characters in the output.
2. OUTPUT FORMAT: Return ONLY a valid JSON array. No explanations, no markdown code fences, no extra text.
   Format: [{{"id": <integer>, "text": "<{target_lang} translation here>"}}]
3. COMPLETENESS: You MUST return exactly {len(blocks)} items — one for every input item.
   - Input contains {len(blocks)} items. Output MUST contain exactly {len(blocks)} items.
   - Do NOT skip, merge, or omit any item.
4. TRANSLATION QUALITY: Translate naturally and fluently. Context-aware, not word-for-word.
5. ID PRESERVATION: Keep each "id" value exactly as given in the input.

INPUT ({len(blocks)} items):
{payload}

OUTPUT (must be {len(blocks)} JSON items, all in {target_lang}):"""

    if custom_prompt.strip():
        main += f"\n\nADDITIONAL INSTRUCTIONS:\n{custom_prompt.strip()}"

    return main


def _exponential_backoff(attempt: int) -> float:
    import random
    base = min(BASE_RETRY_DELAY * (2 ** (attempt - 1)), MAX_RETRY_DELAY)
    return base + random.uniform(0, base * 0.1)


def _parse_translation_response(raw: str, blocks: list[dict]) -> list[str]:
    """
    Extract translated texts from Gemini JSON response, aligned to blocks.

    IMPORTANT: If the AI fails to translate a block, we return an EMPTY string
    (not the original source text) to make the failure visible instead of silently
    inserting the source language text back into the output.
    """
    # Strip markdown fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw, flags=re.IGNORECASE).strip().rstrip("`").strip()

    # Try to find the JSON array if there's surrounding text
    array_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if array_match:
        cleaned = array_match.group(0)

    try:
        data = json.loads(cleaned)
        if not isinstance(data, list):
            raise ValueError("Response is not a JSON array")

        # Build id->text map for safe alignment
        id_map: dict[int, str] = {}
        for item in data:
            if isinstance(item, dict) and "id" in item and "text" in item:
                id_map[item["id"]] = str(item["text"]).strip()

        result = []
        missing = []
        for b in blocks:
            translated = id_map.get(b["index"])
            if translated:
                result.append(translated)
            else:
                # KEY FIX: Use a placeholder, NOT the original source text
                # The original fallback `b["text"]` was the cause of Chinese text
                # leaking into the Burmese output
                result.append(f"[Translation missing for block {b['index']}]")
                missing.append(b["index"])

        if missing:
            logger.warning(f"[SrtTranslator] {len(missing)} blocks missing from response: {missing[:10]}")

        return result

    except Exception as e:
        logger.error(f"[SrtTranslator] Failed to parse response JSON: {e}\nRaw: {raw[:500]}")
        # Return placeholders (NOT original source text!) for all blocks
        return [f"[Translation error: block {b['index']}]" for b in blocks]


def _translate_batch_with_gemini(
    blocks: list[dict],
    source_lang: str,
    target_lang: str,
    api_key: str,
    model_name: str,
    custom_prompt: str = "",
) -> list[str]:
    """Translate a batch via Google AI Studio (API Key)."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    gen_config = genai.types.GenerationConfig(
        temperature=0.1,  # Lowered: less creative = more obedient
        max_output_tokens=8192,
    )
    prompt = _build_translation_prompt(blocks, source_lang, target_lang, custom_prompt)

    raw_text = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = model.generate_content(prompt, generation_config=gen_config)
            raw_text = response.text
            break
        except Exception as exc:
            logger.warning(f"[SrtTranslator] Attempt {attempt} failed: {exc}")
            if attempt == MAX_RETRIES:
                raise
            time.sleep(_exponential_backoff(attempt))

    return _parse_translation_response(raw_text, blocks)


def _translate_batch_with_vertex(
    blocks: list[dict],
    source_lang: str,
    target_lang: str,
    project_id: str,
    region: str,
    model_name: str,
    custom_prompt: str = "",
) -> list[str]:
    """Translate a batch via Vertex AI (service account)."""
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig

    vertexai.init(project=project_id, location=region)
    model = GenerativeModel(model_name)
    gen_config = GenerationConfig(
        temperature=0.1,  # Lowered: less creative = more obedient
        max_output_tokens=8192,
    )
    prompt = _build_translation_prompt(blocks, source_lang, target_lang, custom_prompt)

    raw_text = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = model.generate_content(prompt, generation_config=gen_config)
            raw_text = response.text
            break
        except Exception as exc:
            logger.warning(f"[SrtTranslator][Vertex] Attempt {attempt} failed: {exc}")
            if attempt == MAX_RETRIES:
                raise
            time.sleep(_exponential_backoff(attempt))

    return _parse_translation_response(raw_text, blocks)


# ── Public API ────────────────────────────────────────────────────────────────

def translate_subtitle_file(
    content: str,
    filename: str,
    source_lang: str,
    target_lang: str,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    project_id: Optional[str] = None,
    region: Optional[str] = None,
    custom_prompt: str = "",
) -> tuple[str, int, str, str]:
    """
    Parse and translate a subtitle file (.srt or .txt).

    Returns:
        (translated_srt_content: str, block_count: int, api_used: str, model_used: str)
    """
    use_api_key = api_key if api_key is not None else settings.gemini_api_key
    use_project  = project_id if project_id is not None else settings.gcp_project_id
    use_region   = region if region is not None else settings.gcp_region
    use_model    = model_name if model_name is not None else settings.gemini_model

    api_source = "Google AI Studio" if use_api_key else "Vertex AI"

    logger.info(f"[SrtTranslator] Parsing '{filename}' ({source_lang} -> {target_lang})")
    logger.info(f"[SrtTranslator] API={api_source}, Model={use_model}")

    blocks = parse_subtitle_file(content, filename)
    if not blocks:
        raise ValueError("Could not find any subtitle blocks in the uploaded file.")

    logger.info(f"[SrtTranslator] {len(blocks)} subtitle blocks found, batch_size={BATCH_SIZE}")

    # Split into batches
    all_translated: list[str] = []
    total_batches = (len(blocks) + BATCH_SIZE - 1) // BATCH_SIZE
    for batch_start in range(0, len(blocks), BATCH_SIZE):
        batch = blocks[batch_start: batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        logger.info(f"[SrtTranslator] Translating batch {batch_num}/{total_batches} ({len(batch)} blocks)")

        if use_api_key:
            translated_batch = _translate_batch_with_gemini(
                batch, source_lang, target_lang, use_api_key, use_model, custom_prompt
            )
        elif use_project:
            translated_batch = _translate_batch_with_vertex(
                batch, source_lang, target_lang, use_project, use_region, use_model, custom_prompt
            )
        else:
            raise RuntimeError(
                "No Gemini API key or GCP project configured. "
                "Set GEMINI_API_KEY or GCP_PROJECT_ID in your .env file."
            )

        all_translated.extend(translated_batch)

        # Polite delay between batches
        if batch_start + BATCH_SIZE < len(blocks):
            time.sleep(1.5)

    output_srt = build_srt(blocks, all_translated)
    logger.info(f"[SrtTranslator] Done - {len(blocks)} blocks translated successfully")
    return output_srt, len(blocks), api_source, use_model
