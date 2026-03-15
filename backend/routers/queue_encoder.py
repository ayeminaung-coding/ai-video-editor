import os
import uuid
import logging
import asyncio
import tempfile
import json
from typing import List, Any, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Form

from config import settings

try:
    import redis  # type: ignore
    from rq import Queue  # type: ignore
    from rq.job import Job  # type: ignore
    _QUEUE_IMPORT_ERROR: Exception | None = None
except Exception as exc:  # pragma: no cover
    redis = None  # type: ignore
    Queue = None  # type: ignore
    Job = None  # type: ignore
    _QUEUE_IMPORT_ERROR = exc


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue_encoder", tags=["queue_encoder"])
_local_jobs: dict[str, dict[str, Any]] = {}


def _ensure_queue_dependencies() -> None:
    if _QUEUE_IMPORT_ERROR is not None:
        raise RuntimeError(
            "Queue Encoder dependencies unavailable. Run pip install -r backend/requirements.txt"
        )


def _get_redis_conn():
    _ensure_queue_dependencies()
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    conn = redis.from_url(redis_url)  # type: ignore
    conn.ping()
    return conn


def _get_encoder_queue():
    conn = _get_redis_conn()
    return Queue("encoder_tasks", connection=conn)  # type: ignore

_local_worker_semaphore = asyncio.Semaphore(2)

async def _run_local_job(local_job_id: str, tmpdir: str, video_path: str, srt_path: str, out_path: str, style_opts: dict, original_filename: str) -> None:
    async with _local_worker_semaphore:
        _local_jobs[local_job_id]["status"] = "started"
        _local_jobs[local_job_id]["progress"] = 5

        def _local_progress(pct: float) -> None:
            if local_job_id in _local_jobs:
                _local_jobs[local_job_id]["progress"] = max(0, min(100, int(pct)))

        try:
            from services.queue_worker_tasks import process_encoder_video
            result = await asyncio.to_thread(
                process_encoder_video,
                local_job_id,
                tmpdir,
                video_path,
                srt_path,
                out_path,
                style_opts,
                _local_progress,
                original_filename
            )
            _local_jobs[local_job_id]["status"] = "finished"
            _local_jobs[local_job_id]["progress"] = 100
            _local_jobs[local_job_id]["result"] = result
        except Exception as exc:
            logger.exception("Local Encoder job failed: %s", local_job_id)
            _local_jobs[local_job_id]["status"] = "failed"
            _local_jobs[local_job_id]["error"] = str(exc)

@router.post("/start")
async def queue_encoder_job(
    video_file: UploadFile = File(...),
    srt_file: UploadFile = File(...),
    # UI styling fields
    font_size: int = Form(20),
    color: str = Form("#ffffff"),
    alignment: int = Form(2),
    bg_opacity: int = Form(70),
    font_name: str = Form("Padauk"),
    font_dir_param: Optional[str] = Form(None),
    blur_rect_enabled: str = Form("false"),
    blur_rect_x_pct: float = Form(19.0),
    blur_rect_y_pct: float = Form(85.0),
    blur_rect_width_pct: float = Form(60.0),
    blur_rect_height_pct: float = Form(11.0),
    blur_rect_opacity: int = Form(21),
    blur_rect_blur: int = Form(13),
    blur_rect_color: str = Form("#ffffff"),
    watermark_enabled: str = Form("false"),
    watermark_text: str = Form("@DramaSubsTV"),
    watermark_x_pct: float = Form(10.0),
    watermark_y_pct: float = Form(10.0),
    watermark_font_size: int = Form(40),
    watermark_color: str = Form("#ffffff"),
    watermark_opacity: int = Form(80),
    stroke_enabled: str = Form("false"),
    stroke_color: str = Form("#000000"),
    stroke_size: float = Form(2.0),
    margin_v: int = Form(15),
    margin_h: int = Form(15),
    padding_h: int = Form(14),
    padding_v: int = Form(6),
):
    queue = None
    use_redis = True
    try:
        queue = _get_encoder_queue()
    except Exception as exc:
        use_redis = False
        logger.warning("Queue Encoder using local fallback: %s", exc)

    tmpdir = tempfile.mkdtemp(prefix="ai_video_encoder_queue_")
    
    video_path = os.path.join(tmpdir, "input.mp4")
    srt_path = os.path.join(tmpdir, "sub.srt")
    out_path = os.path.join(tmpdir, "output.mp4")

    # Save to disk
    with open(video_path, "wb") as out_vid:
        while chunk := await video_file.read(1024 * 1024):
            out_vid.write(chunk)
            
    with open(srt_path, "wb") as out_srt:
        while chunk := await srt_file.read(1024 * 1024):
            out_srt.write(chunk)
            
    style_opts = {
        "font_size": font_size,
        "color": color,
        "alignment": alignment,
        "bg_opacity": bg_opacity,
        "font_name": font_name,
        "font_dir_param": font_dir_param,
        "blur_rect_enabled": blur_rect_enabled.lower() == "true",
        "blur_rect_x_pct": blur_rect_x_pct,
        "blur_rect_y_pct": blur_rect_y_pct,
        "blur_rect_width_pct": blur_rect_width_pct,
        "blur_rect_height_pct": blur_rect_height_pct,
        "blur_rect_opacity": blur_rect_opacity,
        "blur_rect_blur": blur_rect_blur,
        "blur_rect_color": blur_rect_color,
        "watermark_enabled": watermark_enabled.lower() == "true",
        "watermark_text": watermark_text,
        "watermark_x_pct": watermark_x_pct,
        "watermark_y_pct": watermark_y_pct,
        "watermark_font_size": watermark_font_size,
        "watermark_color": watermark_color,
        "watermark_opacity": watermark_opacity,
        "stroke_enabled": stroke_enabled.lower() == "true",
        "stroke_color": stroke_color,
        "stroke_size": stroke_size,
        "margin_v": margin_v,
        "margin_h": margin_h,
        "padding_h": padding_h,
        "padding_v": padding_v,
    }

    if use_redis and queue is not None:
        job = queue.enqueue(
            "services.queue_worker_tasks.process_encoder_video",
            kwargs={
                "job_id": str(uuid.uuid4()), # RQ overrides id, but we pass custom id param just in case
                "tmpdir": tmpdir,
                "video_path": video_path,
                "srt_path": srt_path,
                "out_path": out_path,
                "style_opts": style_opts,
                "original_filename": video_file.filename,
            },
            job_timeout=7200
        )
        return {
            "job_id": job.get_id(),
            "status": "queued"
        }
    else:
        local_job_id = f"local-{uuid.uuid4()}"
        _local_jobs[local_job_id] = {
            "job_id": local_job_id,
            "status": "queued",
            "progress": 0,
            "result": None,
            "error": None,
            "out_path": out_path
        }
        asyncio.create_task(_run_local_job(local_job_id, tmpdir, video_path, srt_path, out_path, style_opts, video_file.filename))

        return {
            "job_id": local_job_id,
            "status": "queued"
        }


@router.get("/status")
def get_jobs_status(job_ids: str):
    ids = job_ids.split(",")
    results = []

    for jid in ids:
        if jid.startswith("local-"):
            local = _local_jobs.get(jid)
            if not local:
                results.append({"job_id": jid, "status": "not_found", "message": "Local job not found"})
            else:
                results.append({
                    "job_id": jid,
                    "status": local["status"],
                    "result": local.get("result"),
                    "error": local.get("error"),
                    "progress": local.get("progress", 0),
                })
            continue

        try:
            conn = _get_redis_conn()
            job = Job.fetch(jid, connection=conn)  # type: ignore
            status = job.get_status()
            
            job_info = {
                "job_id": jid,
                "status": status,
                "result": job.result if status == "finished" else None,
                "error": str(job.exc_info) if status == "failed" else None
            }
            if job.meta:
                job_info["progress"] = job.meta.get("progress", 0)
            results.append(job_info)
        except Exception as e:
            results.append({
                "job_id": jid,
                "status": "not_found",
                "message": str(e)
            })

    return {"statuses": results}

@router.delete("/clear")
def clear_queue():
    _local_jobs.clear()
    try:
        queue = _get_encoder_queue()
        queue.empty()
    except Exception:
        pass
    return {"message": "Queue cleared"}

from fastapi.responses import FileResponse
import shutil

@router.get("/download/{job_id}")
def download_encoder_result(job_id: str):
    if job_id.startswith("local-"):
        local = _local_jobs.get(job_id)
        if not local or local.get("status") != "finished" or not local.get("result"):
            raise HTTPException(status_code=404, detail="Result not ready or job not found")
        out_path = local["result"]["out_path"]
        orig_name = local["result"].get("original_filename", "video.mp4")
        base_name = orig_name.rsplit('.', 1)[0]
        download_name = f"{base_name}_encoded.mp4"
        return FileResponse(out_path, filename=download_name)

    try:
        conn = _get_redis_conn()
        job = Job.fetch(job_id, connection=conn)
        if job.get_status() != "finished" or not job.result:
            raise HTTPException(status_code=400, detail="Job not finished yet")

        out_path = job.result["out_path"]
        orig_name = job.result.get("original_filename", "video.mp4")
        base_name = orig_name.rsplit('.', 1)[0]
        download_name = f"{base_name}_encoded.mp4"
        return FileResponse(out_path, filename=download_name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

