# routers/srt_translator.py — FastAPI router for SRT/TXT subtitle translation

import io
import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from config import settings
from services.srt_translator_service import translate_subtitle_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/srt-translator", tags=["SRT Translator"])


ALLOWED_EXTENSIONS = {".srt", ".txt"}
MAX_FILE_SIZE_MB = 5


@router.post("/translate")
async def translate_srt(
    file: UploadFile = File(...),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
    model: str = Form(default=""),
    api_source: str = Form(default=""),
    custom_prompt: str = Form(default=""),
):
    """
    Translate a subtitle file (.srt or .txt) to the target language.

    - **file**: `.srt` or `.txt` subtitle file
    - **source_lang**: e.g. "Chinese", "English", "Thai"
    - **target_lang**: e.g. "Burmese", "English", "Chinese"
    - **model**: optional Gemini model name override
    """
    # ── Validate file extension ──────────────────────────────────────────────
    filename = file.filename or "subtitle.srt"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload a .srt or .txt file.",
        )

    # ── Read and validate size ───────────────────────────────────────────────
    raw_bytes = await file.read()
    size_mb = len(raw_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum allowed size is {MAX_FILE_SIZE_MB} MB.",
        )

    # ── Decode content ───────────────────────────────────────────────────────
    try:
        content = raw_bytes.decode("utf-8-sig")  # handles BOM
    except UnicodeDecodeError:
        try:
            content = raw_bytes.decode("utf-16")
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Could not decode file. Please ensure it is UTF-8 encoded.",
            )

    if not source_lang.strip():
        raise HTTPException(status_code=400, detail="source_lang is required.")
    if not target_lang.strip():
        raise HTTPException(status_code=400, detail="target_lang is required.")

    logger.info(
        f"[SrtTranslator] Received '{filename}' | "
        f"{source_lang} -> {target_lang} | model={model or 'default'}"
    )

    # ── Handle API Source Override ───────────────────────────────────────────
    api_key_override = None
    project_id_override = None

    if api_source == "vertex_ai":
        # Force the service not to use api_key, forcing Vertex
        api_key_override = ""
        project_id_override = settings.gcp_project_id
    elif api_source == "gemini_api":
        # Force the service to use an API key
        api_key_override = settings.gemini_api_key

    # ── Translate ────────────────────────────────────────────────────────────
    try:
        translated_content, block_count, api_source_used, use_model = translate_subtitle_file(
            content=content,
            filename=filename,
            source_lang=source_lang.strip(),
            target_lang=target_lang.strip(),
            model_name=model.strip() if model else None,
            api_key=api_key_override,
            project_id=project_id_override,
            custom_prompt=custom_prompt.strip(),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception(f"[SrtTranslator] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

    # ── Build download filename ──────────────────────────────────────────────
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    out_filename = f"{stem}_{target_lang.lower().replace(' ', '_')}.srt"

    logger.info(f"[SrtTranslator] Success - {block_count} blocks -> '{out_filename}'")

    return StreamingResponse(
        io.BytesIO(translated_content.encode("utf-8")),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{out_filename}"',
            "X-Block-Count": str(block_count),
            "X-Model-Used": str(use_model) if use_model else "Unknown",
            "X-API-Used": str(api_source_used) if api_source_used else "Unknown",
            "Access-Control-Expose-Headers": "Content-Disposition, X-Block-Count, X-Model-Used, X-API-Used",
        },
    )
