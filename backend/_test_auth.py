import os
from google.cloud import aiplatform

# Explicitly use the service account
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "d:/workspace-job/ai-video-editor/backend/personal-ai-486613-691c04f9ae17.json"

try:
    aiplatform.init(project="personal-ai-486613", location="us-central1")
    # Quick test to see if auth works
    from vertexai.generative_models import GenerativeModel
    model = GenerativeModel("gemini-2.0-flash")
    resp = model.generate_content("hello")
    print("SUCCESS! Generated:", resp.text)
except Exception as e:
    print("AUTH ERROR:", repr(e))
