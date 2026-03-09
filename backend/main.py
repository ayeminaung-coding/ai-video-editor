# main.py — FastAPI application entry point

import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.video import router as video_router
from routers.ocr import router as ocr_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

# Set third-party loggers to WARNING to reduce noise
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Video Editor — Backend",
    description="FFmpeg smart-split + Vertex AI Gemini translation pipeline",
    version="1.1.0",  # Updated version after optimizations
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(video_router)
app.include_router(ocr_router)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gemini_model": settings.gemini_model,
        "gcp_project":  settings.gcp_project_id or "(not set — update .env)",
        "gcp_region":   settings.gcp_region,
        "version": "1.1.0-optimized",
    }


# ─── Startup/Shutdown events ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting AI Video Editor Backend v1.1.0")
    logger.info(f"Upload directory: {settings.upload_dir}")
    logger.info(f"Thread pool workers: {__import__('os').cpu_count() or 4} CPUs detected")
    
    # Log active configuration
    if settings.gemini_api_key:
        logger.info("Using Google AI Studio (API Key)")
    else:
        logger.info(f"Using Vertex AI: project={settings.gcp_project_id}, region={settings.gcp_region}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AI Video Editor Backend")
    # Cleanup thread pools
    from routers.video import _executor
    _executor.shutdown(wait=True)
    logger.info("All workers shut down cleanly")
