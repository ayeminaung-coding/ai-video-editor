# services/job_store.py — Centralized in-memory job store
# 
# Replaces the scattered `_jobs` dictionaries previously found in `video.py`,
# `tiktok_changer.py`, and `export_service.py`.

from typing import Any, Dict, Optional
import uuid

# ─── Generic Job Store ────────────────────────────────────────────────────────
# In a production environment, this should be backed by Redis or a Database.
_store: Dict[str, Dict[str, Any]] = {}


def create_job(job_id: Optional[str] = None, initial_data: Optional[Dict[str, Any]] = None) -> str:
    """Create a new job and return its ID."""
    if not job_id:
        job_id = str(uuid.uuid4())
    
    _store[job_id] = initial_data or {}
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a job by ID. Returns None if not found."""
    return _store.get(job_id)


def update_job(job_id: str, updates: Dict[str, Any]) -> None:
    """Update specific fields in a job."""
    if job_id in _store:
        _store[job_id].update(updates)


def pop_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Remove and return a job by ID."""
    return _store.pop(job_id, None)


def get_all_jobs() -> Dict[str, Dict[str, Any]]:
    """Return the entire job store. Useful for debugging."""
    return _store

