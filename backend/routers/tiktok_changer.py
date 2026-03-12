# routers/tiktok_changer.py — TikTok Changer: reformat video to 9:16 with blur/color canvas + text overlays

import json
import logging
import os
import shutil
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tiktok", tags=["tiktok_changer"])

from services.job_store import create_job, get_job, pop_job

# ─── Project font directory ───────────────────────────────────────────────────
# Fonts are stored in src/font relative to the project root so they are portable
# and independent of the host OS/Windows font installation.
_THIS_DIR   = Path(__file__).parent          # backend/routers/
_FONT_DIR   = _THIS_DIR.parent.parent / "src" / "font"   # src/font/

# Preference order: Pyidaungsu first (Myanmar Unicode), then Padauk, Zawgyi-One
_FONT_CANDIDATES = [
    _FONT_DIR / "Pyidaungsu.ttf",        # full Myanmar Unicode support
    _FONT_DIR / "Padauk-Bold.ttf",       # Padauk bold (Myanmar)
    _FONT_DIR / "Padauk-Regular.ttf",    # Padauk regular
    _FONT_DIR / "Zawgyi-One.ttf",        # legacy Zawgyi encoding
]

# ─── Persistent output directory ──────────────────────────────────────────────
# Exported videos are stored here (backend/exports/) so they survive server restarts.
_EXPORTS_DIR = _THIS_DIR.parent / "exports"
_EXPORTS_DIR.mkdir(exist_ok=True)


def _find_font() -> Optional[str]:
    """Return the first available project font as an absolute string path."""
    for p in _FONT_CANDIDATES:
        if p.exists():
            return str(p)
    return None


def _check_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except Exception:
        return False


def _escape_filter_path(path: str) -> str:
    """Escape a Windows path for use inside an FFmpeg filter string."""
    # Forward-slash FFmpeg path, then escape colon (drive letter) and special chars
    return path.replace("\\", "/").replace(":", "\\:")


def _build_drawtext_filters(
    text_layers: list[dict],
    canvas_w: int,
    canvas_h: int,
    tmpdir: str,
    font_file: Optional[str],
) -> list[str]:
    """Build one drawtext fragment per text layer.

    We write each text to a temp file (textfile=) to avoid ANY escaping issues
    with Unicode (especially Myanmar script). Bold/italic are handled by
    appending ' Bold' / ' Italic' to the font= family name.
    """
    fragments = []
    for i, layer in enumerate(text_layers):
        raw_text = layer.get("text", "")
        if not raw_text.strip():
            continue

        x_pct        = float(layer.get("xPct", 50))
        y_pct        = float(layer.get("yPct", 50))
        x            = int(canvas_w * x_pct / 100)
        y            = int(canvas_h * y_pct / 100)
        font_size    = int(layer.get("fontSize", 48))
        color        = layer.get("color", "#ffffff").lstrip("#")
        shadow       = bool(layer.get("shadow", True))
        stroke       = bool(layer.get("stroke", False))
        stroke_color = layer.get("strokeColor", "#000000").lstrip("#")
        stroke_width = int(layer.get("strokeWidth", 3))

        # Write text to file — avoids all FFmpeg drawtext escaping problems
        text_file = os.path.join(tmpdir, f"layer_{i}.txt")
        # Replace newlines with spaces (drawtext textfile doesn't support multi-line easily)
        with open(text_file, "w", encoding="utf-8") as f:
            f.write(raw_text.replace("\n", " "))

        parts = [f"drawtext=textfile='{_escape_filter_path(text_file)}'"]

        if font_file:
            parts.append(f"fontfile='{_escape_filter_path(font_file)}'")

        parts += [
            f"x={x}",
            f"y={y}",
            f"fontsize={font_size}",
            f"fontcolor=0x{color}",
        ]

        if shadow:
            parts += ["shadowcolor=black@0.8", "shadowx=2", "shadowy=2"]

        if stroke and stroke_width > 0:
            parts += [f"borderw={stroke_width}", f"bordercolor=0x{stroke_color}"]

        fragments.append(":".join(parts))

    return fragments


def _run_tiktok_export(
    job_id: str,
    tmpdir: str,
    video_path: str,
    out_path: str,
    bg_mode: str,          # "blur" | "color"
    blur_px: int,
    bg_color: str,         # hex e.g. "#1a1a2e"
    text_layers: list[dict],
    original_filename: str,
):
    """Run FFmpeg to produce a 9:16 (1080×1920) MP4.
    
    Called in a dedicated daemon thread so it never blocks the uvicorn event loop.
    """
    job = get_job(job_id)
    if not job:
        return

    TARGET_W = 1080
    TARGET_H = 1920

    try:
        job["status"]   = "processing"
        job["progress"] = 5.0

        # ── Build drawtext chain ───────────────────────────────────────────────
        font_file      = _find_font()
        drawtext_frags = _build_drawtext_filters(text_layers, TARGET_W, TARGET_H, tmpdir, font_file)
        dt_chain       = ",".join(drawtext_frags)

        job["progress"] = 25.0

        # ── Build filter_complex & FFmpeg command ──────────────────────────────
        # The standard TikTok "blurred borders" look:
        #   bg = video scaled+cropped to fill 9:16 frame, then blurred
        #   fg = video scaled to fit within 9:16 (keeping aspect ratio), NO padding
        #   overlay fg centered on bg  → blur shows above/below the video
        #
        # IMPORTANT: fg must NOT use black padding — that would cover the blur bg.

        if bg_mode == "blur":
            # Background: scale to cover full 9:16, center-crop, then blur
            bg_f = (
                f"[0:v]scale={TARGET_W}:{TARGET_H}"
                f":force_original_aspect_ratio=increase:flags=lanczos,"
                f"crop={TARGET_W}:{TARGET_H},"
                f"boxblur=luma_radius={blur_px}:luma_power=2"
                f":chroma_radius={blur_px}:chroma_power=2[bg]"
            )
            # Foreground: scale to fit width (1080), height auto
            fg_f = f"[0:v]scale={TARGET_W}:-2:flags=lanczos[fg]"
            # Overlay fg centered on bg
            ov_f = "[bg][fg]overlay=(W-w)/2:(H-h)/2[comp]"

            if dt_chain:
                fc   = f"{bg_f};{fg_f};{ov_f};[comp]{dt_chain}[vout]"
                vmap = "[vout]"
            else:
                fc   = f"{bg_f};{fg_f};{ov_f}"
                vmap = "[comp]"

            cmd = [
                "ffmpeg", "-y", "-nostdin",
                "-i", video_path,
                "-filter_complex", fc,
                "-map", vmap,
                "-map", "0:a?",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                out_path,
            ]

        else:
            # Color mode: solid background, video centered
            # Two inputs: [0] = lavfi solid color 9:16, [1] = original video
            bg_color_hex = bg_color.lstrip("#")
            # Foreground: scale to fit width, height auto
            fg_f = f"[1:v]scale={TARGET_W}:-2:flags=lanczos[fg]"
            # Overlay fg centered on color bg
            ov_f = "[0:v][fg]overlay=(W-w)/2:(H-h)/2[comp]"

            if dt_chain:
                fc   = f"{fg_f};{ov_f};[comp]{dt_chain}[vout]"
                vmap = "[vout]"
            else:
                fc   = f"{fg_f};{ov_f}"
                vmap = "[comp]"

            cmd = [
                "ffmpeg", "-y", "-nostdin",
                "-f", "lavfi",
                "-i", f"color=c=0x{bg_color_hex}:size={TARGET_W}x{TARGET_H}:rate=30",
                "-i", video_path,
                "-filter_complex", fc,
                "-map", vmap,
                "-map", "1:a?",
                "-shortest",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                out_path,
            ]

        logger.info(f"[TikTok {job_id}] Starting FFmpeg ({bg_mode} mode), font={font_file}")

        # ── Use FFmpeg -progress to stream live timecode updates ───────────────
        # FFmpeg writes "out_time_us=N" lines to the progress URL (pipe).
        # We read that in a side thread to interpolate progress 25 → 99%.

        progress_path = os.path.join(tmpdir, "ffmpeg_progress.txt")

        # Inject -progress before input so FFmpeg writes progress lines to a file
        # (pipe: is unreliable on Windows; a temp file is simpler)
        cmd_with_prog = [cmd[0]] + ["-progress", progress_path, "-stats_period", "1"] + cmd[1:]

        proc = subprocess.Popen(
            cmd_with_prog,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # ── Side-thread: read FFmpeg progress file and update job progress ─────
        def _watch_progress():
            import time, re
            # First pass: probe total duration via ffprobe for percentage calc
            total_us = None
            try:
                pr = subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "format=duration", "-of", "csv=p=0", video_path],
                    capture_output=True, text=True, timeout=15,
                )
                val = pr.stdout.strip()
                if val:
                    total_us = float(val) * 1_000_000  # seconds → microseconds
            except Exception:
                pass

            while proc.poll() is None:
                time.sleep(0.8)
                try:
                    if not os.path.exists(progress_path):
                        continue
                    with open(progress_path, "r") as pf:
                        lines = pf.read().splitlines()
                    # Find latest out_time_us
                    for line in reversed(lines):
                        m = re.match(r"out_time_us=(\d+)", line)
                        if m:
                            elapsed_us = int(m.group(1))
                            if total_us and total_us > 0:
                                pct = 25 + (elapsed_us / total_us) * 72  # 25 → 97
                            else:
                                pct = min(job.get("progress", 25) + 1, 97)
                            job["progress"] = round(min(pct, 97), 1)
                            break
                except Exception:
                    pass

        watcher = threading.Thread(target=_watch_progress, daemon=True)
        watcher.start()

        stdout_data, stderr_data = proc.communicate()
        watcher.join(timeout=2)

        if proc.returncode != 0:
            err_text = stderr_data.decode("utf-8", errors="replace")
            logger.error(f"[TikTok {job_id}] FFmpeg error:\n{err_text}")
            raise RuntimeError(err_text[-3000:] if len(err_text) > 3000 else err_text)

        job["progress"] = 100.0
        job["status"]   = "done"
        logger.info(f"[TikTok {job_id}] Done → {out_path}")

    except Exception as e:
        logger.exception(f"[TikTok {job_id}] Export failed")
        job["status"] = "error"
        job["error"]  = str(e)


# ─── POST /api/tiktok/export/start ────────────────────────────────────────────

@router.post("/export/start")
async def start_tiktok_export(
    video_file: UploadFile = File(...),
    bg_mode: str = Form("blur"),     # "blur" | "color"
    blur_px: int = Form(20),
    bg_color: str = Form("#000000"),
    text_layers: str = Form("[]"),   # JSON array
):
    """Start a TikTok 9:16 export job (runs in background thread)."""
    if not _check_ffmpeg():
        raise HTTPException(status_code=500, detail="FFmpeg not found on server.")

    try:
        layers = json.loads(text_layers)
    except json.JSONDecodeError:
        layers = []

    job_id      = str(uuid.uuid4())
    # ── Persistent work directory under backend/exports/<job_id>/ ─────────────
    job_dir     = _EXPORTS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    tmpdir      = str(job_dir)   # reuse same dir for input + output
    ext         = Path(video_file.filename or "video.mp4").suffix or ".mp4"
    video_path  = str(job_dir / f"input{ext}")
    out_path    = str(job_dir / "output_tiktok.mp4")

    async with aiofiles.open(video_path, "wb") as f:
        while chunk := await video_file.read(1024 * 1024):
            await f.write(chunk)

    create_job(job_id, {
        "status":    "queued",
        "progress":  0.0,
        "error":     None,
        "tmpdir":    tmpdir,
        "out_path":  out_path,
        "file_name": video_file.filename or "video.mp4",
    })

    # Use a daemon thread so FFmpeg runs truly in parallel without blocking uvicorn
    t = threading.Thread(
        target=_run_tiktok_export,
        args=(job_id, tmpdir, video_path, out_path,
              bg_mode, blur_px, bg_color, layers,
              video_file.filename or "video.mp4"),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id}


# ─── GET /api/tiktok/export/status/{job_id} ───────────────────────────────────

@router.get("/export/status/{job_id}")
async def tiktok_export_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status":   job["status"],
        "progress": round(job["progress"], 1),
        "error":    job["error"],
    }


# ─── GET /api/tiktok/export/download/{job_id} ─────────────────────────────────

@router.get("/export/download/{job_id}")
async def tiktok_export_download(job_id: str):
    job = pop_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or already downloaded")
    if job["status"] != "done":
        create_job(job_id, job)  # put it back
        raise HTTPException(status_code=400, detail="Export not finished yet")

    def cleanup():
        shutil.rmtree(job["tmpdir"], ignore_errors=True)

    stem = Path(job["file_name"]).stem
    return FileResponse(
        job["out_path"],
        background=BackgroundTask(cleanup),
        media_type="video/mp4",
        filename=f"{stem}_tiktok_9x16.mp4",
    )
