# routers/ocr.py — OCR API endpoints for AI subtitle extraction

import asyncio
import logging
from typing import Any, Optional, List
from pydantic import BaseModel, Field, field_validator

from fastapi import APIRouter, HTTPException, BackgroundTasks
from config import settings
from services.job_store import get_job as _get_job, get_all_jobs
from services.ocr_service import run_ocr_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

# Valid OCR engines
VALID_ENGINES = ["google", "frame_sync", "paddle"]
VALID_FRAME_SYNC_PROFILES = ["fast", "balanced", "thorough"]


class OcrSettings(BaseModel):
    engine: str = Field(default="google", description="OCR engine: google, frame_sync, or paddle")
    frameSyncProfile: Optional[str] = Field(default="balanced", description="Frame sync profile: fast, balanced, thorough")
    paddleLang: Optional[str] = Field(default="ch", description="PaddleOCR language code")
    subtitlePosition: Optional[float] = Field(default=1.0, description="OCR scanning position (0.0=top, 0.5=middle, 1.0=bottom)")
    subtitleBandRatio: Optional[float] = Field(default=0.20, description="Height of scanned band as fraction of frame height (0.05-0.60)")
    provider: Optional[str] = Field(default=None, description="Provider: studio or vertex")
    vertexProjectId: Optional[str] = Field(default=None, description="Vertex AI project ID")
    vertexRegion: Optional[str] = Field(default=None, description="Vertex AI region")
    studioApiKey: Optional[str] = Field(default=None, description="Google AI Studio API key")
    modelName: Optional[str] = Field(default=None, description="Model name override")

    @field_validator('engine')
    @classmethod
    def validate_engine(cls, v: str) -> str:
        if v not in VALID_ENGINES:
            raise ValueError(f"Invalid engine: {v}. Must be one of: {VALID_ENGINES}")
        return v

    @field_validator('frameSyncProfile')
    @classmethod
    def validate_frame_sync_profile(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_FRAME_SYNC_PROFILES:
            raise ValueError(f"Invalid profile: {v}. Must be one of: {VALID_FRAME_SYNC_PROFILES}")
        return v

    @field_validator('paddleLang')
    @classmethod
    def validate_paddle_lang(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in settings.valid_paddle_languages:
            raise ValueError(f"Invalid PaddleOCR language: {v}. Must be one of: {settings.valid_paddle_languages}")
        return v


@router.post("/start/{video_id}")
async def start_ocr(
    video_id: str,
    background_tasks: BackgroundTasks,
    overrides: Optional[OcrSettings] = None
):
    job = _get_job(video_id)

    if job["status"] == "translating" or job["status"] == "processing":
        return {"video_id": video_id, "status": job["status"]}

    # Validate settings if provided
    if overrides:
        try:
            # Validation happens automatically via Pydantic
            logger.info(f"OCR settings validated for {video_id}: engine={overrides.engine}, lang={overrides.paddleLang}")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    job["status"] = "processing"
    job["ocr_data"] = None
    job["error"] = None
    job["ocr_progress"] = 0.0

    # Determine Active Settings
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
        run_ocr_task,
        get_all_jobs(),
        video_id,
        active_project,
        active_region,
        active_api_key,
        active_model,
        (overrides.engine if overrides and overrides.engine else "google"),
        (overrides.frameSyncProfile if overrides and overrides.frameSyncProfile else "balanced"),
        (overrides.paddleLang if overrides and overrides.paddleLang else "ch"),
        (overrides.subtitlePosition if overrides and overrides.subtitlePosition is not None else 1.0),
        (overrides.subtitleBandRatio if overrides and overrides.subtitleBandRatio is not None else 0.20),
    )
    return {"video_id": video_id, "status": "processing"}

@router.get("/status/{video_id}")
async def get_ocr_status(video_id: str):
    job = _get_job(video_id)

    response: dict[str, Any] = {
        "video_id":    video_id,
        "status":      job["status"],
        "ocr_data":    job.get("ocr_data"),
        "error":       job.get("error"),
        "ocr_progress": job.get("ocr_progress", 0.0),
    }
    return response
