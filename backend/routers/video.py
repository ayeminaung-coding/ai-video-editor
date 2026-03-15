# routers/video.py — Video API endpoints (upload, split, translate, status)

import uuid
import asyncio
import logging
from pathlib import Path
from typing import Any, Optional
import os
import tempfile
import shutil
import subprocess
import threading
import re
import json
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from starlette.background import BackgroundTask
import aiofiles
from google.api_core.exceptions import PermissionDenied, Unauthenticated, Forbidden

class TranslateSettingsOverride(BaseModel):
    provider: Optional[str] = None
    vertexProjectId: Optional[str] = None
    vertexRegion: Optional[str] = None
    studioApiKey: Optional[str] = None
    modelName: Optional[str] = None

from config import settings
from services.splitter import smart_split, get_video_duration
from services.gemini_translator import translate_both_parts
from services.translation_service import run_translation_task
from services.srt_builder import build_srt
from services.job_store import create_job, get_job, pop_job, get_all_jobs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video", tags=["video"])

# In-memory job store (use Redis/DB in production) -> Now centralized in job_store.py

# Optimized thread pool - sized for CPU-bound OCR/translation tasks
# Using min(32, cpu_count + 4) as per Python's concurrent.futures recommendation
_max_workers = min(32, (os.cpu_count() or 4) + 4)
_executor = ThreadPoolExecutor(max_workers=_max_workers, thread_name_prefix="video_worker")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _job_dir(video_id: str) -> Path:
    return Path(settings.upload_dir) / video_id


def _get_job(video_id: str) -> dict:
    job = get_job(video_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{video_id}' not found")
    return job


# ─── POST /api/video/upload ───────────────────────────────────────────────────

@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Accept a video file upload, save it to disk.
    Returns: { video_id, filename, size_bytes }
    """
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are accepted")

    video_id = str(uuid.uuid4())
    job_dir  = _job_dir(video_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    ext       = Path(file.filename or "video.mp4").suffix or ".mp4"
    save_path = job_dir / f"original{ext}"

    async with aiofiles.open(save_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):  # 1 MB chunks
            await out.write(chunk)

    size = save_path.stat().st_size
    create_job(video_id, {
        "video_id":    video_id,
        "status":      "uploaded",
        "original":    str(save_path),
        "split":       None,
        "translation": None,
        "error":       None,
    })

    return {
        "video_id":   video_id,
        "filename":   file.filename,
        "size_bytes": size,
    }


# ─── POST /api/video/split/{video_id} ─────────────────────────────────────────

@router.post("/split/{video_id}")
async def split_video(video_id: str, split_at: float | None = None):
    """
    Smart-split the uploaded video near its midpoint using silence detection.

    Optional query param `split_at` (seconds) forces a hard cut at that exact time,
    skipping silence detection (used when user manually adjusts the split point).

    Returns: { split_at, method, part1_duration, part2_duration, total_duration }
    """
    job = _get_job(video_id)
    original = job["original"]

    if not Path(original).exists():
        raise HTTPException(status_code=404, detail="Original video file not found")

    job_dir = _job_dir(video_id)

    loop = asyncio.get_event_loop()

    if split_at is not None:
        # Forced manual split 
        result = await loop.run_in_executor(
            _executor,
            lambda: _force_split(original, str(job_dir), split_at)
        )
    else:
        result = await loop.run_in_executor(
            _executor,
            lambda: smart_split(original, str(job_dir))
        )

    job["split"] = result
    job["status"] = "split"

    return {
        "split_at":       result["split_at"],
        "method":         result["method"],
        "part1_duration": result["part1_duration"],
        "part2_duration": result["part2_duration"],
        "total_duration": result["total_duration"],
    }


def _force_split(video_path: str, output_dir: str, split_at: float) -> dict:
    """Hard cut at exact split_at seconds, no silence detection."""
    output_dir = Path(output_dir)
    total_dur  = get_video_duration(video_path)
    split_at   = max(1.0, min(split_at, total_dur - 1.0))
    base_name  = Path(video_path).stem

    part1_path = str(output_dir / f"{base_name}_part1.mp4")
    part2_path = str(output_dir / f"{base_name}_part2.mp4")

    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-t", str(split_at), "-c", "copy", part1_path],
        check=True, capture_output=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-ss", str(split_at), "-c", "copy", part2_path],
        check=True, capture_output=True,
    )

    return {
        "split_at":       split_at,
        "method":         "midpoint",
        "part1_path":     part1_path,
        "part2_path":     part2_path,
        "part1_duration": get_video_duration(part1_path),
        "part2_duration": get_video_duration(part2_path),
        "total_duration": total_dur,
    }


# ─── POST /api/video/translate/{video_id} ─────────────────────────────────────

@router.post("/translate/{video_id}")
async def translate_video(
    video_id: str, 
    background_tasks: BackgroundTasks,
    overrides: Optional[TranslateSettingsOverride] = None
):
    """
    Start the Gemini translation pipeline in the background.
    Poll GET /api/video/status/{video_id} for progress.

    Returns: { video_id, status: "processing" }
    """
    job = _get_job(video_id)

    if not job.get("split"):
        raise HTTPException(status_code=400, detail="Run /split first before translating.")

    if job["status"] == "translating":
        # Already translating, just return early so frontend can poll
        return {"video_id": video_id, "status": "translating"}

    job["status"] = "translating"
    job["translation"] = None
    job["error"] = None

    # Determine Active Settings (Override vs Default)
    active_project = settings.gcp_project_id
    active_region = settings.gcp_region
    active_api_key = settings.gemini_api_key
    active_model = settings.gemini_model
    
    if overrides:
        if overrides.provider == "studio":
            active_api_key = overrides.studioApiKey or active_api_key
            if overrides.modelName:
                active_model = overrides.modelName
        elif overrides.provider == "vertex":
            active_api_key = "" 
            active_project = overrides.vertexProjectId or active_project
            active_region = overrides.vertexRegion or active_region
            if overrides.modelName:
                active_model = overrides.modelName

    background_tasks.add_task(
        run_translation_task,
        get_all_jobs(), 
        video_id, 
        active_project, 
        active_region,
        active_api_key,
        active_model
    )
    return {"video_id": video_id, "status": "translating"}




# ─── GET /api/video/status/{video_id} ─────────────────────────────────────────

@router.get("/status/{video_id}")
async def get_status(video_id: str):
    """
    Poll this endpoint after calling /translate.

    Returns:
        {
            video_id, status,
            translation: { part1: [...], part2: [...] } | null,
            error: str | null
        }
    """
    job = _get_job(video_id)

    response: dict[str, Any] = {
        "video_id":    video_id,
        "status":      job["status"],   # uploaded | split | translating | done | error
        "translation": None,
        "error":       job.get("error"),
    }

    if job["status"] == "done" and job.get("translation"):
        t = job["translation"]
        response["translation"] = {
            "part1": t["part1"],
            "part2": t["part2"],
        }

        # Also include pre-built SRT strings for convenience
        response["srt"] = {
            "part1": build_srt([{"start": l["start"], "end": l["end"], "text": l["my"]} for l in t["part1"]]),
            "part2": build_srt([{"start": l["start"], "end": l["end"], "text": l["my"]} for l in t["part2"]], start_index=len(t["part1"]) + 1),
        }

    return response


# ─── POST /api/video/export/start ──────────────────────────────────────

# ─── POST /api/video/export/start ──────────────────────────────────────

from services.export_service import create_export_job, get_export_job, pop_export_job, run_export_task

@router.post("/export/start")
async def start_export_video(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    srt_file: UploadFile = File(...),
    font_size: int = Form(20),
    color: str = Form("#ffffff"),
    alignment: int = Form(2),
    bg_opacity: int = Form(70),
    # ── Blur rectangle params ──────────────────────────────────────────────────
    blur_rect_enabled: str = Form("false"),       # "true" | "false"
    blur_rect_x_pct: float = Form(19.0),
    blur_rect_y_pct: float = Form(85.0),
    blur_rect_width_pct: float = Form(60.0),
    blur_rect_height_pct: float = Form(11.0),     # height % of video height
    blur_rect_opacity: int = Form(21),            # 0–100
    blur_rect_blur: int = Form(13),               # blur radius px 0–30
    blur_rect_color: str = Form("#ffffff"),       # hex fill color
    # ── Watermark params ──────────────────────────────────────────────────────
    watermark_enabled: str = Form("false"),
    watermark_text: str = Form("@DramaSubsTV"),
    watermark_x_pct: float = Form(10.0),
    watermark_y_pct: float = Form(10.0),
    watermark_font_size: int = Form(40),
    watermark_color: str = Form("#ffffff"),
    watermark_opacity: int = Form(80),
    # ── Text Stroke ───────────────────────────────────────────────────────────
    stroke_enabled: str = Form("false"),
    stroke_color: str = Form("#000000"),
    stroke_size: float = Form(2.0),
    margin_v: int = Form(15),                     # vertical offset from edge
    margin_h: int = Form(15),                     # horizontal offset from edge
    # ── Subtitle padding ──────────────────────────────────────────────────────
    padding_h: int = Form(14),                    # horizontal padding (left+right) in ASS margin
    padding_v: int = Form(6),                     # vertical padding (top+bottom) in ASS margin
):
    """
    Accepts video + sub, starts async export with FFmpeg using Padauk font.
    """
    job_id = str(uuid.uuid4())
    tmpdir = tempfile.mkdtemp(prefix="ai_video_export_")
    
    video_path = os.path.join(tmpdir, "input.mp4")
    srt_path = os.path.join(tmpdir, "sub.srt")
    out_path = os.path.join(tmpdir, "output.mp4")
    
    try:
        # Save files
        async with aiofiles.open(video_path, "wb") as out_vid:
            while chunk := await video_file.read(1024 * 1024):
                await out_vid.write(chunk)
                
        async with aiofiles.open(srt_path, "wb") as out_srt:
            while chunk := await srt_file.read(1024 * 128):
                await out_srt.write(chunk)
                
        file_name = video_file.filename or "export.mp4"
        
        # Copy Burmese-capable fonts into temp directory so ffmpeg/libass can find them.
        font_dir = os.path.join(tmpdir, "fonts")
        os.makedirs(font_dir, exist_ok=True)
        repo_root = Path(__file__).resolve().parent.parent.parent
        font_candidates = [
            ("Padauk-Regular.ttf", "Padauk"),
            ("Padauk-Bold.ttf", "Padauk"),
            ("Pyidaungsu.ttf", "Pyidaungsu"),
            ("Zawgyi-One.ttf", "Zawgyi-One"),
        ]
        copied_fonts = 0
        selected_font_name = None
        for filename, family in font_candidates:
            src = repo_root / "src" / "font" / filename
            if src.exists():
                shutil.copy2(src, os.path.join(font_dir, filename))
                copied_fonts += 1
                if selected_font_name is None:
                    selected_font_name = family

        if copied_fonts > 0:
            font_dir_param = "fonts"
            font_name = selected_font_name or "Padauk"
        else:
            font_dir_param = None
            font_name = "Arial"
            
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to prep export: {e}")
        
    create_export_job(job_id, tmpdir, out_path, file_name)
    
    background_tasks.add_task(
        run_export_task,
        job_id, tmpdir, video_path, srt_path, out_path, font_size, color, alignment, bg_opacity, font_name, font_dir_param,
        # blur rect
        blur_rect_enabled.lower() == "true",
        blur_rect_x_pct,
        blur_rect_y_pct,
        blur_rect_width_pct,
        blur_rect_height_pct,
        blur_rect_opacity,
        blur_rect_blur,
        blur_rect_color,
        # watermark
        watermark_enabled.lower() == "true",
        watermark_text,
        watermark_x_pct,
        watermark_y_pct,
        watermark_font_size,
        watermark_color,
        watermark_opacity,
        # stroke
        stroke_enabled.lower() == "true",
        stroke_color,
        stroke_size,
        margin_v,
        margin_h,
        # padding
        padding_h,
        padding_v,
    )
    
    return {"job_id": job_id}





@router.get("/export/status/{job_id}")
async def get_export_status(job_id: str):
    job = get_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": job["status"],
        "progress": round(job["progress"], 1),
        "error": job["error"]
    }


@router.get("/export/download/{job_id}")
async def download_export(job_id: str):
    job = pop_export_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or already downloaded")
        
    if job["status"] != "done":
        # Usually frontend checks status first before downloading, but we guard here
        shutil.rmtree(job["tmpdir"], ignore_errors=True)
        raise HTTPException(status_code=400, detail="Job not completed")
        
    def cleanup():
        shutil.rmtree(job["tmpdir"], ignore_errors=True)
        
    name, _ = os.path.splitext(job["file_name"])
    return FileResponse(
        job["out_path"],
        background=BackgroundTask(cleanup),
        media_type="video/mp4",
        filename=f"{name}_subbed.mp4"
    )
