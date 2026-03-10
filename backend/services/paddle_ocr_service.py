# services/paddle_ocr_service.py — PaddleOCR pipeline for hardcoded subtitle extraction
#
# Optimized Pipeline (v2):
#   Video → FFmpeg frame sampling (subtitle band crop) → fast blank-frame skip
#   → lightweight OpenCV preprocessing → PaddleOCR (det+rec in one pass)
#   → Temporal majority voting → Subtitle segmentation → SRT
#
# Key optimizations over v1:
#   - CRAFT removed: FFmpeg already crops the subtitle band, CRAFT is redundant
#   - use_angle_cls disabled: subtitles are always horizontal
#   - Single OCR call per frame (det=True does detection+recognition together)
#   - Fast blank-frame skip using stddev check before invoking PaddleOCR
#   - Preprocessing only runs on non-blank frames

from __future__ import annotations

import os
import re
import tempfile
import logging
from collections import Counter
from pathlib import Path
from threading import RLock
from typing import Callable, Optional, Dict

# Disable OneDNN/MKL-DNN at the C++ environment level BEFORE any paddle import.
# `enable_mkldnn=False` in PaddleOCR() is ignored by paddlepaddle 3.x on Windows,
# causing the "OneDnnContext does not have the input Filter" crash.
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("FLAGS_mkldnn_ops_list", "")
os.environ.setdefault("CPU_NUM_THREADS", "1")

import cv2
import numpy as np

from services.ocr_service import (
    _build_lines_from_events,
    _downsample_keyframes,
    _extract_keyframes_for_subtitles,
)
from config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Thread-safe lazy singleton — PaddleOCR model loaded once and reused
# ---------------------------------------------------------------------------
_paddle_models: Dict[str, object] = {}
_paddle_model_lock = RLock()


def _get_paddle_ocr(lang: str = "ch"):
    """
    Thread-safe lazy-load of PaddleOCR.
    Uses det=True (full pipeline: detection + recognition in one call).
    angle_cls disabled — subtitles are always horizontal, saves ~30% time.
    """
    with _paddle_model_lock:
        model = _paddle_models.get(lang)
        if model is None:
            try:
                from paddleocr import PaddleOCR
                logger.info(f"Loading PaddleOCR (optimized) for language: {lang}")
                model = PaddleOCR(
                    lang=lang,
                    use_angle_cls=False,   # FAST: subtitles are always horizontal
                    use_gpu=False,
                    show_log=False,
                    enable_mkldnn=False,   # Avoid MKLDNN crashes on some Windows setups
                )
                _paddle_models[lang] = model
                logger.info(f"PaddleOCR loaded for: {lang}")
            except Exception as e:
                logger.error(f"Failed to load PaddleOCR for {lang}: {e}")
                raise
        return model


def _cleanup_all_models():
    """Free all loaded models from memory."""
    with _paddle_model_lock:
        _paddle_models.clear()
        logger.info("Cleared all PaddleOCR models from memory")


# ---------------------------------------------------------------------------
# Fast blank-frame detection — skip frames with no text-like content
# ---------------------------------------------------------------------------
# Reads from config so it can be tuned without code changes.
# Lower value = more conservative skip (fewer misses, more PaddleOCR calls)
# Higher value = more aggressive skip (faster, but may skip low-contrast subs)

def _is_blank_frame(img: np.ndarray) -> bool:
    """
    Quick check: if the image has very low pixel variance, it's a blank/solid
    frame with no text. Returns True if we should skip OCR for this frame.
    This runs in microseconds vs. milliseconds for PaddleOCR.
    """
    if img is None or img.size == 0:
        return True
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    _, std = cv2.meanStdDev(gray)
    return float(std[0][0]) < settings.paddle_blank_frame_threshold


# ---------------------------------------------------------------------------
# Lightweight preprocessing for the subtitle band
# ---------------------------------------------------------------------------
def _preprocess_subtitle_band(img: np.ndarray) -> np.ndarray:
    """
    Enhance subtitle band for PaddleOCR.
    Lighter than v1: skips adaptive threshold (PaddleOCR handles it internally).
    Just CLAHE + padding, which is sufficient for most subtitle backgrounds.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()

    # Contrast enhancement for low-contrast subtitles
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(4, 4))
    enhanced = clahe.apply(gray)

    # White padding so edge characters aren't clipped by PaddleOCR's det model
    pad = 8
    padded = cv2.copyMakeBorder(enhanced, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255)

    # Back to BGR — PaddleOCR expects 3-channel
    return cv2.cvtColor(padded, cv2.COLOR_GRAY2BGR)


# ---------------------------------------------------------------------------
# PaddleOCR inference on one subtitle-band image
# ---------------------------------------------------------------------------
def _ocr_frame(img: np.ndarray, lang: str) -> str:
    """
    Run PaddleOCR on a single subtitle-band frame.
    Uses det=True (full pipeline, one call). Falls back to no-kwarg if needed.
    Returns extracted text or empty string.
    """
    paddle = _get_paddle_ocr(lang)
    texts: list[str] = []

    result = None
    try:
        result = paddle.ocr(img, cls=False)
    except Exception as e:
        logger.debug(f"PaddleOCR ocr(cls=False) failed: {e}")
        try:
            result = paddle.ocr(img)
        except Exception as e2:
            logger.warning(f"PaddleOCR all variants failed: {e2}")
            return ""

    if not result:
        return ""

    # Collect text from result (handles both old and new PaddleOCR response shapes)
    _collect_texts(result, texts, min_confidence=settings.ocr_dedup_min_confidence)

    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped = []
    for t in texts:
        key = re.sub(r"\s+", "", t.lower())
        if key and key not in seen:
            deduped.append(t.strip())
            seen.add(key)

    return " ".join(deduped).strip()


def _collect_texts(payload: object, out: list[str], min_confidence: float = 0.5) -> None:
    """Recursively collect text strings from PaddleOCR result payload."""
    if payload is None:
        return
    if isinstance(payload, dict):
        text = payload.get("text") or payload.get("rec_text")
        score = payload.get("confidence", payload.get("score", payload.get("rec_score", 1.0)))
        if isinstance(text, str) and text.strip():
            if isinstance(score, (int, float)) and float(score) >= min_confidence:
                out.append(text.strip())
        for key in ("texts", "rec_texts", "data", "res"):
            _collect_texts(payload.get(key), out, min_confidence)
        return
    if isinstance(payload, (list, tuple)):
        # Common format: [[box, (text, score)], ...]  or  [(text, score)]
        if len(payload) == 2 and isinstance(payload[0], str) and isinstance(payload[1], (int, float)):
            if float(payload[1]) >= min_confidence:
                out.append(payload[0].strip())
            return
        for item in payload:
            _collect_texts(item, out, min_confidence)


# ---------------------------------------------------------------------------
# Temporal majority voting (unchanged from v1)
# ---------------------------------------------------------------------------
def _majority_vote(texts: list[str], window: int = 3) -> list[str]:
    """
    Slide a window over consecutive texts and pick the most frequent value
    to reduce OCR noise / single-frame misreads.
    """
    if len(texts) <= window:
        counter = Counter(t for t in texts if t)
        if counter:
            winner = counter.most_common(1)[0][0]
            return [winner] * len(texts)
        return texts

    voted: list[str] = []
    half = window // 2
    for i in range(len(texts)):
        lo = max(0, i - half)
        hi = min(len(texts), i + half + 1)
        window_texts = [t for t in texts[lo:hi] if t]
        if window_texts:
            counter = Counter(window_texts)
            voted.append(counter.most_common(1)[0][0])
        else:
            voted.append("")
    return voted


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------
def extract_text_paddle_ocr(
    video_path: str,
    lang: str = "ch",
    sample_fps: Optional[float] = None,
    subtitle_band_ratio: Optional[float] = None,
    scene_threshold: Optional[float] = None,
    periodic_sec: Optional[float] = None,
    max_keyframes: Optional[int] = None,
    vote_window: Optional[int] = None,
    progress_cb: Callable[[float], None] | None = None,
) -> list[dict]:
    """
    Optimized PaddleOCR subtitle extraction pipeline.

    Pipeline:
      1. FFmpeg samples frames at N fps, cropping the bottom subtitle band.
      2. Blank frames are skipped immediately (std-dev check, ~microseconds).
      3. Non-blank frames are preprocessed (CLAHE + padding) and sent to PaddleOCR.
      4. Temporal majority voting smooths out single-frame OCR noise.
      5. _build_lines_from_events converts events to subtitle lines with timestamps.

    Args:
        video_path: Path to input video
        lang: PaddleOCR language (e.g. 'ch', 'en', 'japan')
        sample_fps: Frames per second to sample
        subtitle_band_ratio: Bottom portion of frame to analyze (0.1-0.6)
        scene_threshold: Scene-change sensitivity
        periodic_sec: Minimum interval between periodic samples
        max_keyframes: Hard cap on number of frames to process
        vote_window: Window size for temporal majority voting
        progress_cb: Optional callback receiving floats from 0.0 to 1.0

    Returns:
        List of dicts: [{start: float, end: float, text: str}, ...]
    """
    # Use PaddleOCR-specific defaults — these are tuned for local (no API cost) processing:
    #   - Higher FPS and more frames than Gemini to avoid missing short subtitles
    #   - paddle_max_keyframes=9999 effectively removes the frame cap
    sample_fps = sample_fps if sample_fps is not None else settings.paddle_sample_fps
    subtitle_band_ratio = subtitle_band_ratio if subtitle_band_ratio is not None else settings.ocr_subtitle_band_ratio
    scene_threshold = scene_threshold if scene_threshold is not None else settings.ocr_scene_threshold
    periodic_sec = periodic_sec if periodic_sec is not None else settings.paddle_periodic_sec
    max_keyframes = max_keyframes if max_keyframes is not None else settings.paddle_max_keyframes
    vote_window = vote_window if vote_window is not None else settings.paddle_vote_window

    try:
        with tempfile.TemporaryDirectory(prefix="paddle_ocr_") as tmp:

            # Step 1: FFmpeg frame sampling (subtitle band already cropped by FFmpeg)
            if progress_cb:
                progress_cb(settings.progress_init)

            keyframes, duration = _extract_keyframes_for_subtitles(
                video_path=video_path,
                output_dir=tmp,
                sample_fps=sample_fps,
                subtitle_band_ratio=subtitle_band_ratio,
                scene_threshold=scene_threshold,
                periodic_sec=periodic_sec,
            )
            keyframes = _downsample_keyframes(keyframes, max_frames=max_keyframes)

            if progress_cb:
                progress_cb(settings.progress_after_sampling)

            total = max(1, len(keyframes))
            raw_texts: list[str] = []
            timestamps: list[float] = []
            skipped = 0

            for i, (t, image_path) in enumerate(keyframes, start=1):

                # Step 2: Read frame
                img = cv2.imread(str(image_path))
                if img is None:
                    raw_texts.append("")
                    timestamps.append(t)
                    skipped += 1
                    continue

                # Step 3: Fast blank-frame skip (microseconds, no model needed)
                if _is_blank_frame(img):
                    raw_texts.append("")
                    timestamps.append(t)
                    skipped += 1
                    continue

                # Step 4: Preprocess + PaddleOCR
                processed = _preprocess_subtitle_band(img)
                text = _ocr_frame(processed, lang=lang)

                raw_texts.append(text)
                timestamps.append(t)

                if progress_cb:
                    progress_cb(
                        settings.progress_after_sampling
                        + settings.progress_ocr_weight * (i / total)
                    )

            logger.info(
                f"PaddleOCR: processed {total - skipped}/{total} frames "
                f"({skipped} blank frames skipped)"
            )

            # Step 5: Temporal majority voting
            voted_texts = _majority_vote(raw_texts, window=vote_window)

            if progress_cb:
                progress_cb(settings.progress_final)

            # Step 6: Build subtitle lines from events
            events: list[tuple[float, str]] = list(zip(timestamps, voted_texts))
            lines = _build_lines_from_events(events, duration)

            if progress_cb:
                progress_cb(1.0)

            logger.info(f"PaddleOCR: extracted {len(lines)} subtitle lines from {Path(video_path).name}")
            return lines

    except Exception as e:
        logger.error(f"PaddleOCR pipeline failed: {e}", exc_info=True)
        raise
