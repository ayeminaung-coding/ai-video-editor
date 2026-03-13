# routers/metadata.py
# Endpoints: POST /metadata/read  →  returns grouped metadata
#            POST /metadata/remove →  returns stripped file for download

import logging
import os
import tempfile
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from services.metadata_service import read_metadata, strip_metadata

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/metadata", tags=["metadata"])


async def _save_upload(upload: UploadFile) -> str:
    """Save uploaded file to a temp path and return that path."""
    suffix = Path(upload.filename or "file").suffix or ".tmp"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="meta_up_")
    os.close(fd)
    async with aiofiles.open(tmp_path, "wb") as f:
        while chunk := await upload.read(1024 * 1024):  # 1 MB chunks
            await f.write(chunk)
    return tmp_path


# ─────────────────────────────────────────────────────────────────────────────

@router.post("/read")
async def read_file_metadata(
    file: UploadFile = File(...),
    mime_type: str = Form(""),
):
    """Upload a file and receive its full metadata grouped by category."""
    tmp_path = await _save_upload(file)
    try:
        effective_mime = mime_type or file.content_type or ""
        groups = read_metadata(tmp_path, effective_mime)
        return {"filename": file.filename, "groups": groups}
    except Exception as exc:
        logger.error(f"read_metadata failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@router.post("/remove")
async def remove_file_metadata(
    file: UploadFile = File(...),
    mime_type: str = Form(""),
):
    """Upload a file and receive a metadata-stripped download."""
    tmp_path = await _save_upload(file)
    out_path: str | None = None
    out_dir: str | None = None
    try:
        effective_mime = mime_type or file.content_type or ""
        out_path, out_name = strip_metadata(tmp_path, effective_mime, file.filename or "file")
        out_dir = str(Path(out_path).parent)

        return FileResponse(
            path=out_path,
            filename=out_name,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
            background=None,
        )
    except Exception as exc:
        logger.error(f"strip_metadata failed: {exc}", exc_info=True)
        # clean up on error
        if out_path and os.path.exists(out_path):
            try:
                os.unlink(out_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        # Clean up the uploaded temp. The out_path is cleaned up after FastAPI
        # finishes sending the response (or immediately on error above).
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
