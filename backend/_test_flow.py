import requests
import time
import subprocess
import os

base = "http://localhost:8000"

# Generate test.mp4
print("Generating test video...")
if not os.path.exists("test.mp4"):
    subprocess.run(["ffmpeg", "-f", "lavfi", "-i", "color=c=black:s=128x72:d=2", "-y", "test.mp4"], check=True)

print("1. Uploading...")
with open("test.mp4", "rb") as f:
    r = requests.post(f"{base}/api/video/upload", files={"file": ("test.mp4", f, "video/mp4")})
print(r.status_code, r.text)
video_id = r.json()["video_id"]

print("2. Splitting...")
r = requests.post(f"{base}/api/video/split/{video_id}?split_at=1")
print(r.status_code, r.text)

print("3. Translating...")
r = requests.post(f"{base}/api/video/translate/{video_id}")
print(r.status_code, r.text)

print("4. Polling status...")
for _ in range(5):
    r = requests.get(f"{base}/api/video/status/{video_id}")
    print(r.status_code, r.text)
    time.sleep(1)
