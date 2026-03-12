# services/translation_service.py — Background translation orchestration

from google.api_core.exceptions import PermissionDenied, Unauthenticated, Forbidden
from services.gemini_translator import translate_both_parts
import logging

logger = logging.getLogger(__name__)

def run_translation_task(
    job_store: dict,
    video_id: str,
    project_id: str,
    region: str,
    api_key: str,
    model_name: str
):
    """Background task: calls Gemini for both parts, saves results to the job store."""
    job = job_store.get(video_id)
    if not job:
        return

    split_info = job["split"]
    try:
        result = translate_both_parts(
            part1_path     = split_info["part1_path"],
            part2_path     = split_info["part2_path"],
            part1_duration = split_info["part1_duration"],
            project_id     = project_id,
            region         = region,
            api_key        = api_key,
            model_name     = model_name
        )
        job["translation"] = result
        job["status"]      = "done"

    except (PermissionDenied, Forbidden) as exc:
        job["error"] = (
            "Vertex AI permission denied. "
            f"project={project_id!r}, region={region!r}. "
            "Check GCP_PROJECT_ID, enable aiplatform.googleapis.com, verify billing, "
            "and grant Vertex AI roles to the configured service account. "
            f"Details: {exc}"
        )
        job["status"] = "error"
        logger.error(f"[translate] Permission error for {video_id}: {exc}")

    except Unauthenticated as exc:
        job["error"] = (
            "Vertex AI authentication failed. "
            "Check GOOGLE_APPLICATION_CREDENTIALS points to a valid service account JSON "
            "and that the key is active. "
            f"Details: {exc}"
        )
        job["status"] = "error"
        logger.error(f"[translate] Auth error for {video_id}: {exc}")

    except Exception as exc:
        job["error"]  = f"Unexpected translation error: {exc}"
        job["status"] = "error"
        logger.error(f"[translate] Error for {video_id}: {exc}")
