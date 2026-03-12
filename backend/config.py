# config.py — Centralised settings loaded from .env

import json
import os
from typing import Dict, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from dotenv import load_dotenv

# Absolute path to .env — works regardless of CWD
_base = Path(__file__).resolve().parent
_env_path = _base / ".env"
load_dotenv(_env_path, override=True)

os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

# Resolve GOOGLE_APPLICATION_CREDENTIALS to absolute path
_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
if _creds and not Path(_creds).is_absolute():
    _abs_creds = str(_base / _creds)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _abs_creds


class Settings(BaseSettings):
    # ── Vertex AI ─────────────────────────────────────────────────
    gcp_project_id: str = ""
    gcp_region: str = "us-central1"

    # ── Google AI Studio ──────────────────────────────────────────
    gemini_api_key: str = ""

    gemini_model: str = "gemini-2.0-flash"

    # ── Server ────────────────────────────────────────────────────
    frontend_origin: str = "http://localhost:3000"
    port: int = 8000
    upload_dir: str = __import__('os').path.join(__import__('tempfile').gettempdir(), "ai_video_editor_uploads")

    # ── OCR Configuration ─────────────────────────────────────────
    # Frame sampling configuration (can be overridden per-request)
    ocr_sample_fps: float = 6.0            # For Gemini (API cost per frame)
    ocr_subtitle_band_ratio: float = 0.34
    ocr_subtitle_position: float = 1.0     # 0.0=top, 0.5=middle, 1.0=bottom
    ocr_scene_threshold: float = 0.003
    ocr_periodic_sec: float = 0.6          # For Gemini engine
    ocr_max_keyframes: int = 140           # For Gemini engine (API cost cap)

    # PaddleOCR-specific sampling — local model, no API cost, process all frames
    paddle_sample_fps: float = 8.0         # Higher rate catches short subtitles
    paddle_periodic_sec: float = 0.35      # Sample every 0.35s = subtitle as short as 0.5s captured
    paddle_max_keyframes: int = 9999       # No cap — process ALL frames

    # PaddleOCR configuration
    paddle_default_lang: str = "ch"
    paddle_vote_window: int = 3
    # Legacy CRAFT settings kept for reference but no longer used
    craft_text_threshold: float = 0.7
    craft_link_threshold: float = 0.4
    craft_low_text: float = 0.4
    # Blank-frame skip: frames with pixel std-dev below this value are skipped
    # Lower = more aggressive skip (set higher if low-contrast subs are missed)
    paddle_blank_frame_threshold: float = 6.0
    # Change-detection gate: mean absolute pixel diff threshold (0.0–1.0)
    # Frames with diff < this vs previous frame are skipped (subtitle unchanged → reuse prev OCR)
    # Lower = more sensitive (more OCR calls), higher = fewer calls (may miss very similar subtitles)
    # 0.008 is conservative enough to catch subtitle text changes while still skipping static frames
    paddle_change_threshold: float = 0.008

    # Preprocessing configuration
    ocr_clahe_clip_limit: float = 2.0
    ocr_clahe_tile_grid_size: int = 8
    ocr_adaptive_block_size: int = 31
    ocr_adaptive_c_value: int = 10
    ocr_morph_kernel_size: tuple = (2, 2)
    ocr_padding_size: int = 8

    # Deduplication configuration
    ocr_dedup_min_confidence: float = 0.3
    ocr_min_line_duration: float = 0.15

    # Progress tracking configuration
    progress_init: float = 0.02
    progress_after_sampling: float = 0.10
    progress_ocr_weight: float = 0.75
    progress_final: float = 0.98

    # Translation configuration
    translation_temperature: float = 0.2
    translation_max_tokens: int = 8192
    translation_max_retries: int = 3

    # Export configuration
    export_default_font_size: int = 20
    export_default_bg_opacity: int = 70
    export_default_position: str = "bottom"

    # Valid languages for PaddleOCR
    valid_paddle_languages: list = ["ch", "en", "fr", "german", "korean", "japan"]

    model_config = SettingsConfigDict(
        env_file=str(_env_path),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Startup validation
creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
creds_ok = bool(creds_path and Path(creds_path).exists())
sa_email = ""
sa_project = ""

if creds_ok:
    try:
        with open(creds_path, "r", encoding="utf-8") as f:
            creds_json = json.load(f)
        sa_email = str(creds_json.get("client_email", ""))
        sa_project = str(creds_json.get("project_id", ""))
    except Exception as exc:
        print(f"[WARNING] Failed to parse credentials JSON: {exc}")

if settings.gemini_api_key:
    print(f"[config] Using Google AI Studio (API Key)")
    print(f"[config] Model: {settings.gemini_model}")
else:
    if not settings.gcp_project_id:
        print("[WARNING] Neither GEMINI_API_KEY nor GCP_PROJECT_ID is set!")
    elif not creds_ok:
        print(f"[WARNING] GOOGLE_APPLICATION_CREDENTIALS not found: '{creds_path}'")
        print("[WARNING] Make sure the service account JSON file exists.")
    else:
        print(f"[config] Using Vertex AI")
        print(f"[config] Project: {settings.gcp_project_id} | Region: {settings.gcp_region}")
        print(f"[config] Credentials: {Path(creds_path).name} [OK]")
        if sa_email:
            print(f"[config] Service Account: {sa_email}")
        if sa_project and sa_project != settings.gcp_project_id:
            print(
                "[WARNING] GCP_PROJECT_ID does not match credentials project_id: "
                f"{settings.gcp_project_id} != {sa_project}"
            )
        print(f"[config] Model: {settings.gemini_model}")


# Make sure the upload directory exists
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
