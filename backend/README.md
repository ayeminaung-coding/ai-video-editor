# AI Video Editor — Backend

Python **FastAPI** backend for the AI Chinese → Burmese video translation pipeline.

## What It Does

1. **Upload** a 3–4 minute MP4 video with Chinese text burned into the frames
2. **Smart Split** — FFmpeg detects a natural silence near the midpoint and splits into Part 1 & Part 2
3. **AI Translate** — Sends each part to **Vertex AI Gemini 3.1 Flash Lite**, which reads the on-screen Chinese text frame-by-frame and translates it to natural Burmese
4. **Returns SRT** — Structured subtitle data (timestamps + Chinese source + Burmese translation) that the frontend editor can review, edit, and download
5. **Standalone SRT Translator** — Direct translation of `.srt` or `.txt` subtitle files via Google AI Studio or Vertex AI directly using the newest Gemini models (e.g. Gemini 2.5 Pro).

---

## Requirements

| Tool             | Version    | Notes                  |
| ---------------- | ---------- | ---------------------- |
| Python           | 3.11+      |                        |
| FFmpeg           | Any recent | Must be in system PATH |
| Google Cloud SDK | Latest     | For `gcloud auth`    |

---

## Quick Start

### 1. Clone / enter the backend folder

```bash
cd ai-video-editor/backend
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Set up environment variables

```bash
copy .env.example .env
```

Open `.env` and fill in your GCP Project ID:

```env
GCP_PROJECT_ID=your-gcp-project-id
```

### 4. Authenticate with Google Cloud

**Option A — Recommended (Application Default Credentials):**

```bash
gcloud auth application-default login
```

Follow the browser prompt. Done — no key file needed.

**Option B — Service Account Key:**

```env
# In your .env file:
GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/your/service-account-key.json
```

### 5. Verify FFmpeg is installed

```bash
ffmpeg -version
```

If not installed → download from https://ffmpeg.org/download.html and add to PATH.

### 6. Run the server

> ⚠️ **Windows users:** always use `python -m uvicorn`, not just `uvicorn` (PATH issue)

```bash
python -m uvicorn main:app --reload --port 8000
```

Server starts at → **http://localhost:8000**

### 7. Run Queue OCR worker (if using `/api/queue_ocr/*`)

From `backend/`:

```bash
python -m services.queue_worker
```

You can also use the service module path (`python -m services.queue_worker`) directly.

---

## Verify It's Working

Open in your browser:

```
http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "gemini_model": "gemini-3.1-flash-lite-preview",
  "gcp_project": "your-project-id",
  "gcp_region": "us-central1"
}
```

---

## API Endpoints

| Method   | Endpoint                            | Description                                                    |
| -------- | ----------------------------------- | -------------------------------------------------------------- |
| `GET`  | `/health`                         | Health check                                                   |
| `POST` | `/api/video/upload`               | Upload MP4 video → returns `video_id`                       |
| `POST` | `/api/video/split/{video_id}`     | Smart-split near midpoint (optional `?split_at=90` to force) |
| `POST` | `/api/video/translate/{video_id}` | Start Gemini translation (runs in background)                  |
| `GET`  | `/api/video/status/{video_id}`    | Poll translation status → returns SRT data when done          |
| `POST` | `/srt-translator/translate`       | Translate uploaded `.srt`/`.txt` file with Gemini              |
| `GET`  | `/gemini/models`                  | List available Gemini and Vertex AI models                     |


---

## Project Structure

```
backend/
├── main.py                  ← FastAPI app, CORS, health check
├── config.py                ← Settings loaded from .env
├── requirements.txt
├── .env.example             ← Template — copy to .env
├── routers/
│   └── video.py             ← All /api/video/* endpoints
└── services/
    ├── splitter.py          ← FFmpeg silence detection + smart split logic
    ├── gemini_translator.py ← Vertex AI Gemini 3.1 Flash Lite integration
    └── srt_builder.py       ← JSON response parser + SRT formatter
```

---

## Environment Variables

| Variable                           | Required | Default                           | Description                                            |
| ---------------------------------- | -------- | --------------------------------- | ------------------------------------------------------ |
| `GCP_PROJECT_ID`                 | ✅ Yes   | —                                | Your Google Cloud project ID                           |
| `GCP_REGION`                     | No       | `us-central1`                   | Vertex AI region                                       |
| `GEMINI_MODEL`                   | No       | `gemini-3.1-flash-lite-preview` | Model name                                             |
| `FRONTEND_ORIGIN`                | No       | `http://localhost:5173`         | Frontend URL for CORS                                  |
| `PORT`                           | No       | `8000`                          | Server port                                            |
| `UPLOAD_DIR`                     | No       | `uploads`                       | Directory for video temp files                         |
| `GOOGLE_APPLICATION_CREDENTIALS` | No       | —                                | Path to service account JSON (if not using gcloud ADC) |

---

## How the Translation Works

```
Video Upload (MP4)
      ↓
FFmpeg silencedetect → find quiet moment near 50% mark
      ↓
Split → part1.mp4  +  part2.mp4
      ↓
Vertex AI Gemini 3.1 Flash Lite (multimodal)
 • Reads Chinese text visible on each video frame (OCR)
 • Records timestamp when each text appears/disappears
 • Translates to natural, conversational Burmese
 • Returns structured JSON
      ↓
SRT Builder → { start, end, zh, my } array
      ↓
Frontend SRT Editor → human review + export
```

---

## Notes

- Uploaded videos are saved to `backend/uploads/` — safe to delete after use
- The translation runs as a background task — poll `/status/{video_id}` every 3 seconds
- Gemini timestamps are approximate (±1s) — minor adjustments can be made in the SRT editor
- For videos > 500 MB, consider pre-compressing before uploading
