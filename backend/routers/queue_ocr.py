import os
import uuid
import logging
import asyncio
from typing import List, Any
from fastapi import APIRouter, File, UploadFile, HTTPException

from config import settings

try:
    import redis  # type: ignore
    from rq import Queue  # type: ignore
    from rq.job import Job  # type: ignore
    _QUEUE_IMPORT_ERROR: Exception | None = None
except Exception as exc:  # pragma: no cover - runtime guard for missing deps
    redis = None  # type: ignore[assignment]
    Queue = None  # type: ignore[assignment]
    Job = None  # type: ignore[assignment]
    _QUEUE_IMPORT_ERROR = exc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue_ocr", tags=["queue_ocr"])
_local_jobs: dict[str, dict[str, Any]] = {}


def _ensure_queue_dependencies() -> None:
    if _QUEUE_IMPORT_ERROR is not None:
        raise RuntimeError(
            "Queue OCR dependencies are unavailable or incompatible in this environment. "
            "Run: python -m pip install -r backend/requirements.txt"
        )


def _get_redis_conn():
    _ensure_queue_dependencies()
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    conn = redis.from_url(redis_url)  # type: ignore[union-attr]
    conn.ping()
    return conn


def _get_ocr_queue():
    conn = _get_redis_conn()
    return Queue("ocr_tasks", connection=conn)  # type: ignore[misc]

_local_worker_semaphore = asyncio.Semaphore(2)

async def _run_local_job(local_job_id: str, video_path: str, video_id: str) -> None:
    async with _local_worker_semaphore:
        _local_jobs[local_job_id]["status"] = "started"
        _local_jobs[local_job_id]["progress"] = 5

        def _local_progress(pct: int) -> None:
            if local_job_id in _local_jobs:
                _local_jobs[local_job_id]["progress"] = max(0, min(100, int(pct)))  

        try:
            from services.queue_worker_tasks import process_ocr_video
            result = await asyncio.to_thread(
                process_ocr_video,
                video_path,
                video_id,
                "ch",
                1.0,
                0.20,
                _local_progress,
            )
            _local_jobs[local_job_id]["status"] = "finished"
            _local_jobs[local_job_id]["progress"] = 100
            _local_jobs[local_job_id]["result"] = result
        except Exception as exc:  # pragma: no cover - background execution
            logger.exception("Local OCR job failed: %s", local_job_id)
            _local_jobs[local_job_id]["status"] = "failed"
            _local_jobs[local_job_id]["error"] = str(exc)
@router.post("/upload")
async def queue_ocr_videos(files: List[UploadFile] = File(...)):
    queue = None
    use_redis = True
    try:
        queue = _get_ocr_queue()
    except Exception as exc:
        use_redis = False
        logger.warning("Queue OCR using local fallback (Redis unavailable): %s", exc)

    jobs_info = []
    
    # Needs a unified uploads directory 
    upload_dir = os.path.join(settings.upload_dir, "queue_ocr")
    os.makedirs(upload_dir, exist_ok=True)
    
    for file in files:
        file_id = str(uuid.uuid4())
        safe_name = f"{file_id}_{file.filename}"
        file_path = os.path.join(upload_dir, safe_name)
        
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
            
        # We need to queue the worker function. 
        # Instead of `run_ocr_task` which takes FastAPI backgrounds, we map a simpler function.
        # For now, let's assume we enqueue a custom wrapper.
        if use_redis and queue is not None:
            job = queue.enqueue(
                "services.queue_worker_tasks.process_ocr_video",
                kwargs={
                    "video_path": file_path,
                    "video_id": file_id,
                },
                job_timeout=3600
            )
            jobs_info.append({
                "id": file_id,
                "filename": file.filename,
                "job_id": job.get_id(),
                "status": "queued"
            })
        else:
            local_job_id = f"local-{uuid.uuid4()}"
            _local_jobs[local_job_id] = {
                "job_id": local_job_id,
                "status": "queued",
                "progress": 0,
                "result": None,
                "error": None,
                "video_id": file_id,
            }
            asyncio.create_task(_run_local_job(local_job_id, file_path, file_id))
            jobs_info.append({
                "id": file_id,
                "filename": file.filename,
                "job_id": local_job_id,
                "status": "queued"
            })
        
    return {"jobs": jobs_info}


@router.get("/status")
def get_jobs_status(job_ids: str):
    """Retrieve status of multiple jobs (comma separated job_ids)"""
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
            job = Job.fetch(jid, connection=conn)  # type: ignore[union-attr]
            status = job.get_status() # queued, started, deferred, finished, stopped, scheduled, canceled, failed
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
    """Clear all pending jobs."""
    _local_jobs.clear()
    try:
        queue = _get_ocr_queue()
        queue.empty()
    except Exception:
        # Local-only mode: no redis queue to clear.
        pass
    return {"message": "Queue cleared"}
