# backend/routers/video_splitter.py
import uuid
import os
import shutil
import threading
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

from services.job_store import create_job, get_job, pop_job
from services.splitter import split_video_by_duration

router = APIRouter(prefix="/api/video-splitter", tags=["video_splitter"])

_EXPORTS_DIR = Path(__file__).parent.parent / "exports"
_EXPORTS_DIR.mkdir(exist_ok=True)

def _run_split(job_id: str, video_path: str, out_dir: str, original_filename: str):
    job = get_job(job_id)
    if not job: return
    try:
        job["status"] = "processing"

        # This will create files in out_dir
        # Duration fixed to 135 seconds (2:15 minutes) as requested
        split_files = split_video_by_duration(
            video_path, 
            out_dir, 
            duration=135,
            original_filename=original_filename
        )

        job["status"] = "done"
        job["files"] = split_files
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)

@router.post("/upload")
async def upload_for_split(video_file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    job_dir = _EXPORTS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    
    ext = Path(video_file.filename or "video.mp4").suffix or ".mp4"
    video_path = str(job_dir / f"input{ext}")
    
    async with aiofiles.open(video_path, "wb") as f:
        while chunk := await video_file.read(1024 * 1024):
            await f.write(chunk)
            
    create_job(job_id, {
        "status": "queued",
        "error": None,
        "job_dir": str(job_dir),
        "files": [],
        "filename": video_file.filename
    })
    
    t = threading.Thread(
        target=_run_split,
        args=(job_id, video_path, str(job_dir), video_file.filename),
        daemon=True,
    )
    t.start()
    
    return {"job_id": job_id}

@router.get("/status/{job_id}")
async def get_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # We only return basenames so client knows what files to request
    files_basenames = [os.path.basename(f) for f in job.get("files", [])]
    return {
        "status": job["status"],
        "error": job["error"],
        "files": files_basenames,
    }

@router.get("/download/{job_id}/{filename}")
async def download_part(job_id: str, filename: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    file_path = os.path.join(job["job_dir"], filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=filename
    )
        
@router.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    job = pop_job(job_id)
    if not job:
        return {"status": "ok"}
    shutil.rmtree(job["job_dir"], ignore_errors=True)
    return {"status": "ok"}
