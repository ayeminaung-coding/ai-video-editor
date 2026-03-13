import os
import tempfile
import pytest
from fastapi.testclient import TestClient
import subprocess

# We need to set testing env vars before loading main
os.environ["GEMINI_API_KEY"] = "fake-api-key"

from main import app

@pytest.fixture(scope="session")
def client():
    """Returns a FastAPI TestClient."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def dummy_video_file():
    """Creates a 1-second dummy video file for testing uploads using FFmpeg."""
    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    
    # Create a 1-second blank video using FFmpeg
    # -f lavfi -i color=c=black:s=640x360:d=1
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=640x360:d=1",
        "-c:v", "libx264", path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    yield path
    os.remove(path)

@pytest.fixture(scope="session")
def dummy_srt_file():
    """Creates a simple dummy SRT file for testing."""
    fd, path = tempfile.mkstemp(suffix=".srt")
    os.close(fd)
    
    content = (
        "1\n"
        "00:00:00,000 --> 00:00:00,500\n"
        "Hello World\n"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    yield path
    os.remove(path)
