# services/ocr_service.py - Background OCR orchestration for subtitle extraction

from __future__ import annotations

import json
import re
import subprocess
import tempfile
import time
import logging
from statistics import median
from pathlib import Path
from typing import Callable, Optional, Dict, Any

import vertexai
from google.api_core.exceptions import Forbidden, PermissionDenied, Unauthenticated
from vertexai.generative_models import GenerationConfig, GenerativeModel, Part

from services.srt_builder import _parse_time
from config import settings

logger = logging.getLogger(__name__)

OCR_PROMPT = """
You are a professional video OCR engine.

TASK:
1.  Transcribe all subtitles/hardsubs from the video. Do not translate them.
2.  Identify the best possible start/end timestamps (seconds) for each line.

OUTPUT FORMAT:
Return ONLY a raw JSON array with:
- "start": float
- "end": float
- "text": string
"""

IMAGE_OCR_PROMPT = """
Read only the subtitle text visible in this frame.
Rules:
- Return only subtitle text.
- Keep original language exactly.
- If there is no readable subtitle, return [NO_TEXT].
- No markdown, no explanation.
"""


# ---------------------------------------------------------------------------
# Configuration constants (moved from hardcoded values)
# ---------------------------------------------------------------------------
# Frame sampling bounds
MIN_SAMPLE_FPS = 1.0
MAX_SAMPLE_FPS = 24.0
MIN_SUBTITLE_BAND = 0.1
MAX_SUBTITLE_BAND = 0.6
MIN_SCENE_THRESHOLD = 0.0005
MAX_SCENE_THRESHOLD = 0.2
MIN_PERIODIC_SEC = 0.1
MIN_KEYFRAMES = 1
MAX_KEYFRAMES = 1

# Progress tracking constants (replacing magic numbers)
PROGRESS_KEYFRAME_START = 0.1
PROGRESS_KEYFRAME_WEIGHT = 0.85
PROGRESS_FINAL = 0.98

# Retry configuration
MAX_OCR_RETRIES = 3
OCR_RETRY_BASE_DELAY = 0.5

# Line filtering
MIN_LINE_DURATION = 0.15
MIN_LINE_GAP = 0.08


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    """Run subprocess with better error handling."""
    try:
        return subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {' '.join(cmd[:5])}... - {e.stderr[:200] if e.stderr else 'no output'}")
        raise
    except FileNotFoundError as e:
        logger.error(f"Command not found: {cmd[0]}")
        raise


def _probe_duration(video_path: str) -> float:
    """Get video duration using ffprobe."""
    out = _run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ]
    ).stdout.strip()
    return float(out)


def _normalize_ocr_text(text: str) -> str:
    """Clean and normalize OCR output text."""
    t = text.strip()
    t = re.sub(r"^```(?:\w+)?\s*", "", t).strip().rstrip("`").strip()
    if not t or t.upper() == "[NO_TEXT]":
        return ""
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if not lines:
        return ""
    if len(lines) == 1:
        return lines[0]
    return "\n".join(lines)


def _clean_for_compare(text: str) -> str:
    """Normalize text for comparison (remove whitespace)."""
    return re.sub(r"\s+", "", text)


def _extract_keyframes_for_subtitles(
    video_path: str,
    output_dir: str,
    sample_fps: float = None,
    subtitle_band_ratio: float = None,
    scene_threshold: float = None,
    periodic_sec: float = None,
) -> tuple[list[tuple[float, str]], float]:
    """
    Extract keyframes from video focusing on subtitle region.
    
    Uses adaptive frame sampling based on scene changes and periodic intervals.
    """
    # Apply config defaults
    sample_fps = sample_fps if sample_fps is not None else settings.ocr_sample_fps
    subtitle_band_ratio = subtitle_band_ratio if subtitle_band_ratio is not None else settings.ocr_subtitle_band_ratio
    scene_threshold = scene_threshold if scene_threshold is not None else settings.ocr_scene_threshold
    periodic_sec = periodic_sec if periodic_sec is not None else settings.ocr_periodic_sec
    
    # Clamp values to safe ranges
    duration = _probe_duration(video_path)
    out_pattern = str(Path(output_dir) / "frame_%06d.jpg")
    band = min(max(subtitle_band_ratio, MIN_SUBTITLE_BAND), MAX_SUBTITLE_BAND)
    fps = min(max(sample_fps, MIN_SAMPLE_FPS), MAX_SAMPLE_FPS)
    threshold = min(max(scene_threshold, MIN_SCENE_THRESHOLD), MAX_SCENE_THRESHOLD)
    period_frames = max(MIN_KEYFRAMES, round(fps * max(MIN_PERIODIC_SEC, periodic_sec)))

    vf = (
        f"fps={fps},"
        f"crop=iw:ih*{band}:0:ih-ih*{band},"
        f"select=eq(n\\,0)+gt(scene\\,{threshold})+not(mod(n\\,{period_frames})),"
        "showinfo"
    )

    try:
        proc = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vf", vf,
                "-vsync", "vfr",
                "-q:v", "4",
                out_pattern,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg keyframe extraction failed: {e.stderr[:500] if e.stderr else 'unknown error'}")
        raise

    pts_times: list[float] = []
    for line in proc.stderr.splitlines():
        m = re.search(r"pts_time:([0-9]+(?:\.[0-9]+)?)", line)
        if m:
            pts_times.append(float(m.group(1)))

    frame_files = sorted(Path(output_dir).glob("frame_*.jpg"))
    n = min(len(frame_files), len(pts_times))
    pairs = [(pts_times[i], str(frame_files[i])) for i in range(n)]
    return pairs, duration


def _downsample_keyframes(
    keyframes: list[tuple[float, str]],
    max_frames: int = None,
) -> list[tuple[float, str]]:
    """Reduce keyframes to manageable count while preserving temporal distribution."""
    max_frames = max_frames if max_frames is not None else settings.ocr_max_keyframes
    
    if len(keyframes) <= max_frames:
        return keyframes
    if max_frames <= MIN_KEYFRAMES:
        return keyframes[:MIN_KEYFRAMES]
    
    step = (len(keyframes) - 1) / (max_frames - 1)
    picked = []
    for i in range(max_frames):
        idx = round(i * step)
        picked.append(keyframes[idx])
    return picked


def _ocr_frame_text_google_studio(model: object, image_path: str) -> str:
    """OCR a single frame using Google AI Studio."""
    import google.generativeai as genai

    image_file = genai.upload_file(image_path)
    try:
        response = model.generate_content(
            [image_file, IMAGE_OCR_PROMPT],
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                max_output_tokens=512,
            ),
        )
        return _normalize_ocr_text(response.text or "")
    finally:
        # Clean up uploaded file reference
        try:
            image_file.delete()
        except Exception:
            pass


def _ocr_frame_text_vertex(model: GenerativeModel, image_path: str) -> str:
    """OCR a single frame using Vertex AI."""
    with open(image_path, "rb") as f:
        img_bytes = f.read()
    img_part = Part.from_data(data=img_bytes, mime_type="image/jpeg")
    response = model.generate_content(
        [img_part, IMAGE_OCR_PROMPT],
        generation_config=GenerationConfig(temperature=0.0, max_output_tokens=512),
    )
    return _normalize_ocr_text(response.text or "")


def _build_lines_from_events(events: list[tuple[float, str]], duration: float) -> list[dict]:
    """
    Convert timestamped text events into subtitle lines.

    Uses adaptive gap detection and hysteresis to avoid flickering lines.
    The blank_hold threshold determines how long a gap must be before we
    consider the subtitle to have ended.
    """
    if not events:
        return []

    events = sorted(events, key=lambda x: x[0])

    # Calculate adaptive gap threshold based on median sample interval
    gaps = [
        events[i][0] - events[i - 1][0]
        for i in range(1, len(events))
        if events[i][0] > events[i - 1][0]
    ]
    sample_gap = median(gaps) if gaps else 0.25
    # blank_hold: how long blank frames must persist before closing a subtitle
    # Clamped to [0.18s, 1.0s]. Longer = fewer spurious line breaks.
    blank_hold = min(1.0, max(0.18, sample_gap * 2.0))

    logger.debug(f"_build_lines_from_events: {len(events)} events, sample_gap={sample_gap:.3f}s, blank_hold={blank_hold:.3f}s")

    lines: list[dict] = []
    active_text = ""
    active_clean = ""
    active_start = 0.0
    blank_since: float | None = None

    for t, text in events:
        clean = _clean_for_compare(text)
        if not clean:
            if active_clean and blank_since is None:
                blank_since = t
            continue

        # Close line if blank gap persisted long enough
        if active_clean and blank_since is not None and (t - blank_since) >= blank_hold:
            # End at the midpoint of the blank gap — more accurate than blank_since
            end = max(active_start + MIN_LINE_GAP, (blank_since + t) / 2.0)
            lines.append({"start": active_start, "end": end, "text": active_text})
            active_text = ""
            active_clean = ""
            blank_since = None

        if clean == active_clean:
            blank_since = None
            continue

        # Close previous line before starting new one
        if active_clean:
            end = max(active_start + MIN_LINE_GAP, blank_since or t)
            lines.append({"start": active_start, "end": end, "text": active_text})

        active_text = text
        active_clean = clean
        active_start = t
        blank_since = None

    # Close final line
    if active_clean:
        if blank_since is not None and (duration - blank_since) >= blank_hold:
            end = max(active_start + MIN_LINE_GAP, (blank_since + duration) / 2.0)
        else:
            end = max(active_start + MIN_LINE_GAP, duration)
        lines.append({"start": active_start, "end": end, "text": active_text})

    # Filter out too-short lines (flicker removal)
    result = [l for l in lines if (l["end"] - l["start"]) >= MIN_LINE_DURATION and l["text"].strip()]
    logger.debug(f"_build_lines_from_events: {len(lines)} raw lines -> {len(result)} after filtering")
    return result


def _extract_text_from_video_gemini(
    video_path: str,
    project_id: str,
    region: str,
    api_key: str,
    model_name: str,
    max_retries: int = None,
) -> list[dict]:
    """
    Extract subtitles directly from video using Gemini's video understanding.
    
    Best for videos with clear, persistent subtitles.
    """
    max_retries = max_retries if max_retries is not None else settings.translation_max_retries
    
    if api_key:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        logger.info(f"Uploading video to Gemini: {video_path}")
        video_file = genai.upload_file(video_path)
        
        while video_file.state.name == "PROCESSING":
            logger.info("Waiting for video processing...")
            time.sleep(2)
            video_file = genai.get_file(video_file.name)
        
        if video_file.state.name == "FAILED":
            raise ValueError("Video processing failed for OCR")
        
        generation_config = genai.types.GenerationConfig(
            temperature=0.0,
            max_output_tokens=settings.translation_max_tokens,
        )
        request_content = [video_file, OCR_PROMPT]
    else:
        vertexai.init(project=project_id, location=region)
        model = GenerativeModel(model_name)
        
        logger.info(f"Loading video for Vertex AI: {video_path}")
        with open(video_path, "rb") as f:
            video_bytes = f.read()
        video_part = Part.from_data(data=video_bytes, mime_type="video/mp4")
        generation_config = GenerationConfig(
            temperature=0.0,
            max_output_tokens=settings.translation_max_tokens,
        )
        request_content = [video_part, OCR_PROMPT]

    raw_text = ""
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            response = model.generate_content(request_content, generation_config=generation_config)
            raw_text = response.text or ""
            break
        except (PermissionDenied, Forbidden, Unauthenticated):
            # Don't retry auth errors
            raise
        except Exception as e:
            last_error = e
            logger.warning(f"OCR attempt {attempt} failed: {e}")
            if attempt == max_retries:
                break
            delay = 2 ** attempt
            logger.info(f"Retrying in {delay}s...")
            time.sleep(delay)
    
    if not raw_text and last_error:
        raise last_error

    # Parse JSON response
    cleaned = re.sub(r"```(?:json)?\s*", "", raw_text).strip().rstrip("`").strip()
    data = json.loads(cleaned)
    result = []
    for item in data:
        result.append(
            {
                "start": _parse_time(item.get("start", 0)),
                "end": _parse_time(item.get("end", 0)),
                "text": item.get("text", ""),
            }
        )
    result.sort(key=lambda x: x["start"])
    return result


def extract_text_from_video_frame_sync(
    video_path: str,
    project_id: str,
    region: str,
    api_key: str,
    model_name: str,
    sample_fps: float = None,
    subtitle_band_ratio: float = None,
    scene_threshold: float = None,
    periodic_sec: float = None,
    max_keyframes: int = None,
    progress_cb: Callable[[float], None] | None = None,
) -> list[dict]:
    """
    Extract subtitles via frame-by-frame OCR.
    
    More accurate for videos with transient subtitles or complex backgrounds.
    """
    # Apply defaults
    sample_fps = sample_fps if sample_fps is not None else settings.ocr_sample_fps
    subtitle_band_ratio = subtitle_band_ratio if subtitle_band_ratio is not None else settings.ocr_subtitle_band_ratio
    scene_threshold = scene_threshold if scene_threshold is not None else settings.ocr_scene_threshold
    periodic_sec = periodic_sec if periodic_sec is not None else settings.ocr_periodic_sec
    max_keyframes = max_keyframes if max_keyframes is not None else settings.ocr_max_keyframes

    with tempfile.TemporaryDirectory(prefix="ocr_keys_") as tmp:
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
            progress_cb(PROGRESS_KEYFRAME_START)

        # Initialize models
        studio_model = None
        vertex_model = None
        if api_key:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            studio_model = genai.GenerativeModel(model_name)
        else:
            vertexai.init(project=project_id, location=region)
            vertex_model = GenerativeModel(model_name)

        events: list[tuple[float, str]] = []
        total = max(1, len(keyframes))
        
        for i, (t, image_path) in enumerate(keyframes, start=1):
            text = ""
            last_error = None
            
            for attempt in range(1, MAX_OCR_RETRIES + 1):
                try:
                    if studio_model is not None:
                        text = _ocr_frame_text_google_studio(studio_model, image_path)
                    else:
                        text = _ocr_frame_text_vertex(vertex_model, image_path)
                    break
                except (PermissionDenied, Forbidden, Unauthenticated):
                    raise
                except Exception as e:
                    last_error = e
                    logger.warning(f"Frame OCR attempt {attempt} failed: {e}")
                    if attempt < MAX_OCR_RETRIES:
                        time.sleep(OCR_RETRY_BASE_DELAY * attempt)
            
            if not text and last_error:
                logger.warning(f"Frame {i}/{total} failed after all retries: {last_error}")
            
            events.append((t, text))
            
            if progress_cb:
                progress_cb(PROGRESS_KEYFRAME_START + PROGRESS_KEYFRAME_WEIGHT * (i / total))

        lines = _build_lines_from_events(events, duration)
        
        if progress_cb:
            progress_cb(PROGRESS_FINAL)
        
        return lines


class OCRError(Exception):
    """Base exception for OCR operations."""
    pass


class OCRAuthError(OCRError):
    """Authentication/permission error for OCR services."""
    pass


class OCRProcessingError(OCRError):
    """Error during OCR processing."""
    pass


def run_ocr_task(
    jobs_store: dict,
    video_id: str,
    project_id: str,
    region: str,
    api_key: str,
    model_name: str,
    engine: str = "google",
    frame_sync_profile: str = "balanced",
    paddle_lang: str = "ch",
):
    """
    Background OCR task orchestrator.
    
    Supports multiple OCR engines:
    - google: Direct video OCR with Gemini
    - frame_sync: Frame-by-frame OCR with Gemini
    - paddle: PaddleOCR with CRAFT detection
    """
    job = jobs_store.get(video_id)
    if not job:
        logger.warning(f"OCR task: Job {video_id} not found")
        return

    try:
        if engine == "paddle":
            from services.paddle_ocr_service import extract_text_paddle_ocr
            
            # Validate language
            if paddle_lang not in settings.valid_paddle_languages:
                raise ValueError(f"Invalid PaddleOCR language: {paddle_lang}. Valid: {settings.valid_paddle_languages}")
            
            logger.info(f"Starting PaddleOCR for {video_id} (lang={paddle_lang})")
            result = extract_text_paddle_ocr(
                video_path=job["original"],
                lang=paddle_lang,
                progress_cb=lambda p: job.__setitem__("ocr_progress", round(p, 4)),
            )
            
        elif engine == "frame_sync":
            profile = (frame_sync_profile or "balanced").lower()
            
            # Profile-based configuration
            profiles = {
                "fast": {"sample_fps": 4.0, "periodic_sec": 1.0, "scene_threshold": 0.004, "max_keyframes": 80},
                "thorough": {"sample_fps": 10.0, "periodic_sec": 0.25, "scene_threshold": 0.0018, "max_keyframes": 320},
                "balanced": {"sample_fps": 6.0, "periodic_sec": 0.6, "scene_threshold": 0.003, "max_keyframes": 140},
            }
            fs_cfg = profiles.get(profile, profiles["balanced"])

            logger.info(f"Starting frame-sync OCR for {video_id} (profile={profile})")
            result = extract_text_from_video_frame_sync(
                video_path=job["original"],
                project_id=project_id,
                region=region,
                api_key=api_key,
                model_name=model_name,
                sample_fps=fs_cfg["sample_fps"],
                periodic_sec=fs_cfg["periodic_sec"],
                scene_threshold=fs_cfg["scene_threshold"],
                max_keyframes=fs_cfg["max_keyframes"],
                progress_cb=lambda p: job.__setitem__("ocr_progress", round(p, 4)),
            )
        else:
            logger.info(f"Starting Gemini direct OCR for {video_id}")
            result = _extract_text_from_video_gemini(
                video_path=job["original"],
                project_id=project_id,
                region=region,
                api_key=api_key,
                model_name=model_name,
            )

        job["ocr_data"] = result
        job["ocr_progress"] = 1.0
        job["status"] = "done"
        logger.info(f"OCR completed for {video_id}: {len(result)} lines extracted")

    except (PermissionDenied, Forbidden) as exc:
        job["error"] = f"Permission denied: {exc}"
        job["ocr_progress"] = 0.0
        job["status"] = "error"
        logger.error(f"[ocr] Permission error for {video_id}: {exc}")

    except Unauthenticated as exc:
        job["error"] = f"Vertex AI authentication failed: {exc}"
        job["ocr_progress"] = 0.0
        job["status"] = "error"
        logger.error(f"[ocr] Auth error for {video_id}: {exc}")

    except OCRAuthError as exc:
        job["error"] = str(exc)
        job["ocr_progress"] = 0.0
        job["status"] = "error"
        logger.error(f"[ocr] Auth error for {video_id}: {exc}")

    except OCRProcessingError as exc:
        job["error"] = f"OCR processing failed: {exc}"
        job["ocr_progress"] = 0.0
        job["status"] = "error"
        logger.error(f"[ocr] Processing error for {video_id}: {exc}")

    except Exception as exc:
        job["error"] = f"Unexpected OCR error: {exc}"
        job["ocr_progress"] = 0.0
        job["status"] = "error"
        logger.error(f"[ocr] Error for {video_id}: {exc}", exc_info=True)
