# services/gemini_translator.py — Vertex AI Gemini integration
# Uses service account credentials via GOOGLE_APPLICATION_CREDENTIALS env var

import time
import logging
import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
from google.api_core.exceptions import ResourceExhausted, DeadlineExceeded, ServiceUnavailable

from config import settings
from services.srt_builder import parse_gemini_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prompt configuration
# ---------------------------------------------------------------------------
TRANSLATION_PROMPT = """
You are a professional Chinese-to-Burmese video translator specializing in movie recaps.

TASK:
1.  **Transcription & Translation**: Transcribe all Chinese subtitles/hardsubs from the video and translate them into natural, cinematic Burmese.
2.  **Precise Alignment**: Identify the EXACT start and end timestamps (in seconds) for each line. The "start" must be when the text first becomes legible, and the "end" must be when it disappears.
3.  **Contextual Accuracy**: Ensure the Burmese translation reflects the tone of the scene (e.g., royal court language for historical dramas).

OUTPUT FORMAT:
Return ONLY a raw JSON array of objects. Do not include markdown blocks (like ```json), commentary, or explanations.

Field Requirements:
- "start": float (e.g., 1.25)
- "end": float (e.g., 4.50)
- "zh": string (Original Chinese text)
- "my": string (Professional Burmese translation)

Example:
[
  {
    "start": 0.5,
    "end": 3.2,
    "zh": "我死后才知道",
    "my": "ကျွန်မ သေဆုံးပြီးမှပဲ သိလိုက်ရတယ်"
  }
]
"""


# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------
MAX_RETRIES = settings.translation_max_retries
BASE_RETRY_DELAY = 2.0  # seconds
MAX_RETRY_DELAY = 30.0  # seconds
TRANSLATION_TEMPERATURE = settings.translation_temperature
TRANSLATION_MAX_TOKENS = settings.translation_max_tokens


def _should_retry(exc: Exception) -> bool:
    """Determine if an exception is retryable."""
    if isinstance(exc, (ResourceExhausted, DeadlineExceeded, ServiceUnavailable)):
        return True
    # Check for rate limit indicators in error message
    error_msg = str(exc).lower()
    return any(keyword in error_msg for keyword in [
        "rate limit", "quota", "too many requests", "temporary error"
    ])


def _calculate_backoff(attempt: int) -> float:
    """Calculate exponential backoff with jitter."""
    import random
    base_delay = min(BASE_RETRY_DELAY * (2 ** (attempt - 1)), MAX_RETRY_DELAY)
    jitter = random.uniform(0, base_delay * 0.1)  # 10% jitter
    return base_delay + jitter


# ---------------------------------------------------------------------------
# Main translator function
# ---------------------------------------------------------------------------

def translate_video_part(
    video_path: str,
    part_number: int,
    project_id: str,
    region: str,
    api_key: str,
    model_name: str,
    max_retries: int = None,
    part1_duration: float = 0.0,
) -> list[dict]:
    """
    Send a video part to Vertex AI or Google AI Studio for OCR + translation.
    
    Features:
    - Exponential backoff retry logic
    - Detailed logging for debugging
    - Automatic timeout handling
    """
    max_retries = max_retries if max_retries is not None else MAX_RETRIES
    
    prompt = TRANSLATION_PROMPT
    if part_number == 2 and part1_duration > 0:
        from services.srt_builder import _sec_to_srt_time
        start_time_str = _sec_to_srt_time(part1_duration)
        prompt += (
            f'\n\nImportant: This is Part 2 of the video. '
            f'The first part ended at {start_time_str}. '
            f'Please ensure all timestamps in this segment start from '
            f'{start_time_str} onwards and continue the sequence numbering '
            f'from where the last part left off.'
        )

    model = None
    video_file = None
    request_content = None
    generation_config = None
    
    try:
        # Initialize model and prepare request
        if api_key:
            import google.generativeai as genai
            logger.info(f"[Gemini] Using Google AI Studio (API Key) - Model: {model_name}")
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)

            logger.info(f"[Gemini] Uploading Part {part_number}: {video_path}")
            video_file = genai.upload_file(video_path)

            while video_file.state.name == "PROCESSING":
                logger.info(f"[Gemini] Waiting for Part {part_number} to process...")
                time.sleep(2)
                video_file = genai.get_file(video_file.name)

            if video_file.state.name == "FAILED":
                raise ValueError(f"Video processing failed for Part {part_number}")

            generation_config = genai.types.GenerationConfig(
                temperature=TRANSLATION_TEMPERATURE,
                max_output_tokens=TRANSLATION_MAX_TOKENS,
            )
            request_content = [video_file, prompt]

        else:
            logger.info(f"[Gemini] Using Vertex AI — project={project_id!r}, region={region!r}")
            vertexai.init(project=project_id, location=region)
            model = GenerativeModel(model_name)

            logger.info(f"[Gemini] Reading Part {part_number}: {video_path}")
            with open(video_path, "rb") as f:
                video_bytes = f.read()

            video_part = Part.from_data(data=video_bytes, mime_type="video/mp4")
            generation_config = GenerationConfig(
                temperature=TRANSLATION_TEMPERATURE,
                max_output_tokens=TRANSLATION_MAX_TOKENS,
            )
            request_content = [video_part, prompt]

        # Execute with retry logic
        raw_text = ""
        last_error = None
        
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"[Gemini] Generating (Part {part_number}, attempt {attempt}/{max_retries})...")
                response = model.generate_content(
                    request_content,
                    generation_config=generation_config,
                )
                raw_text = response.text
                logger.info(f"[Gemini] Part {part_number} response received ({len(raw_text)} chars)")
                break

            except (ResourceExhausted, DeadlineExceeded, ServiceUnavailable) as exc:
                last_error = exc
                if attempt == max_retries:
                    logger.error(f"[Gemini] Rate limit exceeded after {max_retries} attempts")
                    break
                
                wait_time = _calculate_backoff(attempt)
                logger.warning(
                    f"[Gemini] Rate limited (attempt {attempt}), waiting {wait_time:.1f}s... "
                    f"{type(exc).__name__}"
                )
                time.sleep(wait_time)

            except Exception as exc:
                last_error = exc
                logger.error(f"[Gemini] Error (attempt {attempt}): {type(exc).__name__} - {exc}")
                if attempt == max_retries:
                    break
                wait_time = _calculate_backoff(attempt)
                time.sleep(wait_time)

        if not raw_text and last_error:
            raise last_error

        lines = parse_gemini_response(raw_text)
        logger.info(f"[Gemini] Part {part_number}: {len(lines)} subtitle lines parsed")
        return lines
    
    finally:
        # Cleanup resources
        if video_file is not None and api_key:
            try:
                video_file.delete()
                logger.debug(f"[Gemini] Cleaned up uploaded file for Part {part_number}")
            except Exception as e:
                logger.warning(f"[Gemini] Failed to cleanup file: {e}")


def translate_both_parts(
    part1_path: str,
    part2_path: str,
    part1_duration: float,
    project_id: str,
    region: str,
    api_key: str,
    model_name: str
) -> dict:
    """
    Translate both video parts and return combined subtitle data.
    
    Optimizations:
    - Sequential processing to avoid rate limits
    - Resource cleanup between parts
    """
    logger.info(f"Starting translation for both parts")
    logger.info(f"Part 1: {part1_path} ({part1_duration:.2f}s)")
    logger.info(f"Part 2: {part2_path}")
    
    part1_lines = translate_video_part(
        part1_path, part_number=1,
        project_id=project_id, region=region,
        api_key=api_key, model_name=model_name
    )
    
    # Small delay between parts to avoid rate limits
    time.sleep(1.0)
    
    part2_lines = translate_video_part(
        part2_path, part_number=2,
        project_id=project_id, region=region,
        api_key=api_key, model_name=model_name,
        part1_duration=part1_duration
    )

    result = {
        "part1": part1_lines,
        "part2": part2_lines,
        "part1_duration": part1_duration,
    }
    
    logger.info(f"Translation completed: {len(part1_lines)} + {len(part2_lines)} lines")
    return result
