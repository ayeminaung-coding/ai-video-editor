# routers/gemini_models.py — General-purpose Gemini model listing endpoint
# Used by any feature that needs to show available Gemini models.

import logging
from fastapi import APIRouter, HTTPException

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gemini", tags=["Gemini"])


@router.get("/models")
async def list_gemini_models(api_source: str = None):
    """
    List all Gemini models that support generateContent.

    - If api_source == "gemini_api" (or default and GEMINI_API_KEY is set) → fetches the live model list from Google AI Studio.
    - If api_source == "vertex_ai" → returns a known static list
      (Vertex does not expose a public model listing API).

    Response:
        {
            "source": "gemini_api" | "vertex_ai",
            "models": [{"name": str, "display_name": str, "description": str}, ...]
        }
    """
    # Determine which api source to use based on the query param or .env fallback
    use_api_key = False
    
    if api_source == "vertex_ai":
        use_api_key = False
    elif api_source == "gemini_api":
        use_api_key = bool(settings.gemini_api_key)
    else:
        # Default behavior relies on env setup
        use_api_key = bool(settings.gemini_api_key)

    api_key_value = settings.gemini_api_key if use_api_key else None

    if api_key_value:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key_value)

            models = []
            for m in genai.list_models():
                if "generateContent" in m.supported_generation_methods:
                    name = m.name.replace("models/", "")  # strip "models/" prefix
                    models.append({
                        "name": name,
                        "display_name": getattr(m, "display_name", name),
                        "description": getattr(m, "description", ""),
                    })

            logger.info(f"[GeminiModels] {len(models)} models fetched from Google AI Studio")
            return {"source": "gemini_api", "models": models}

        except Exception as e:
            logger.warning(f"[GeminiModels] Failed to list models: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Could not fetch model list from Google AI Studio: {str(e)}",
            )

    else:
        # Vertex AI — return known stable GA models
        logger.info("[GeminiModels] No API key — returning static Vertex AI model list")
        return {
            "source": "vertex_ai",
            "models": [
                # Stable GA models (no special access required)
                {"name": "gemini-2.0-flash",       "display_name": "Gemini 2.0 Flash",       "description": "Best overall — fast & high quality"},
                {"name": "gemini-2.0-flash-lite",  "display_name": "Gemini 2.0 Flash Lite",  "description": "Fastest & cheapest"},
                {"name": "gemini-1.5-pro",         "display_name": "Gemini 1.5 Pro",         "description": "High quality, proven stable"},
                {"name": "gemini-1.5-flash",       "display_name": "Gemini 1.5 Flash",       "description": "Good quality, fast"},
                {"name": "gemini-1.5-flash-8b",    "display_name": "Gemini 1.5 Flash 8B",    "description": "Compact & very fast"},
            ],
        }
