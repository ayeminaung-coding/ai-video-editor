import requests
import time

base = "http://localhost:8000"

print("1. Uploading...")
with open("backend/requirements.txt", "rb") as f:
    r = requests.post(f"{base}/api/video/upload", files={"file": ("test.mp4", f, "video/mp4")})
print(r.status_code, r.text)
video_id = r.json()["video_id"]

print("2. Splitting...")
r = requests.post(f"{base}/api/video/split/{video_id}")
print(r.status_code, r.text)

print("3. Translating...")
r = requests.post(f"{base}/api/video/translate/{video_id}")
print(r.status_code, r.text)

print("4. Polling status...")
for _ in range(5):
    r = requests.get(f"{base}/api/video/status/{video_id}")
    print(r.status_code, r.text)
    time.sleep(1)
