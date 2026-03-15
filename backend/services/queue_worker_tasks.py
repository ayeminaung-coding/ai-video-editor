import logging
from typing import Callable, Optional

from services.paddle_ocr_service import extract_text_paddle_ocr
from services.srt_builder import build_srt

try:
    from rq import get_current_job  # type: ignore
except Exception:  # pragma: no cover - local fallback mode without rq
    def get_current_job():  # type: ignore
        return None


logger = logging.getLogger(__name__)


def process_ocr_video(
    video_path: str,
    video_id: str,
    paddle_lang: str = "ch",
    subtitle_position: float = 1.0,
    subtitle_band_ratio: float = 0.20,
    progress_cb: Optional[Callable[[int], None]] = None,
):
    """
    Background worker function to process video with real PaddleOCR pipeline.
    """
    job = get_current_job()

    def _set_progress(pct: int) -> None:
        clamped = max(0, min(100, int(pct)))
        if job:
            job.meta["progress"] = clamped
            job.save_meta()
        if progress_cb:
            progress_cb(clamped)

    _set_progress(2)

    logger.info(f"Starting OCR task for {video_id} at {video_path}")

    try:
        lines = extract_text_paddle_ocr(
            video_path=video_path,
            lang=paddle_lang,
            subtitle_position=subtitle_position,
            subtitle_band_ratio=subtitle_band_ratio,
            progress_cb=lambda p: _set_progress(int(p * 100)),
        )

        # Normalize and clean output for frontend/export usage.
        normalized_lines = []
        for line in lines:
            text = str(line.get("text", "")).strip()
            if not text:
                continue
            normalized_lines.append(
                {
                    "start": float(line.get("start", 0.0)),
                    "end": float(line.get("end", 0.0)),
                    "text": text,
                }
            )

        srt_content = build_srt(normalized_lines) if normalized_lines else ""

        result_data = {
            "video_id": video_id,
            "subtitles": normalized_lines,
            "srt": srt_content,
            "count": len(normalized_lines),
        }

        _set_progress(100)

        logger.info(f"Finished OCR task for {video_id}")
        return result_data

    except Exception as e:
        _set_progress(0)
        logger.error(f"Error processing video {video_id}: {e}")
        raise
