# services/splitter.py — FFmpeg Smart Split Service
# Detects silence near the video midpoint and splits into two parts.

import subprocess
import re
import os
from pathlib import Path


def get_video_duration(video_path: str) -> float:
    """Return video duration in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def detect_silences(video_path: str, noise_db: float = -35.0, min_duration: float = 0.4) -> list[dict]:
    """
    Run ffmpeg silencedetect and return list of silence intervals.
    Each item: { "start": float, "end": float, "mid": float }
    """
    cmd = [
        "ffmpeg", "-i", video_path,
        "-af", f"silencedetect=n={noise_db}dB:d={min_duration}",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    stderr = result.stderr

    silences = []
    starts = re.findall(r"silence_start:\s*([\d.]+)", stderr)
    ends   = re.findall(r"silence_end:\s*([\d.]+)", stderr)

    for s, e in zip(starts, ends):
        start, end = float(s), float(e)
        silences.append({"start": start, "end": end, "mid": (start + end) / 2})

    return silences


def split_video_by_duration(video_path: str, output_dir: str, duration: int = 135, original_filename: str = None) -> list[str]:
    """
    Split a video into segments of specific duration (e.g. 2 minutes 15 seconds = 135s)
    Name format: original name + ( part- 1,2,3... ).mp4
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if original_filename:
        base_name = Path(original_filename).stem
    else:
        base_name = Path(video_path).stem

    output_pattern = str(output_dir / f"{base_name} ( part- %d).mp4")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-c", "copy",              # Stream copy for immediate, 100% original quality
        "-f", "segment",
        "-segment_time", str(duration),
        "-segment_start_number", "1",
        "-reset_timestamps", "1",
        output_pattern
    ]
    
    subprocess.run(cmd, check=True, capture_output=True)
    
    generated_files = []
    for file in os.listdir(output_dir):
        if file.startswith(f"{base_name} ( part-") and file.endswith(".mp4"):
            generated_files.append(str(output_dir / file))
            
    def extract_number(filename):
        match = re.search(r"\( part- (\d+)\)", filename)
        if match:
            return int(match.group(1))
        return 0

    generated_files.sort(key=lambda x: extract_number(os.path.basename(x)))
    return generated_files


def smart_split(video_path: str, output_dir: str) -> dict:
    """
    Smart-split a video near its midpoint.

    Returns:
        {
            "split_at": float,           # actual cut point in seconds
            "method": "silence"|"midpoint",
            "part1_path": str,
            "part2_path": str,
            "part1_duration": float,
            "part2_duration": float,
            "total_duration": float,
        }
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total_dur = get_video_duration(video_path)
    midpoint  = total_dur / 2.0

    # Try silence detection
    silences = detect_silences(video_path)
    split_at = None
    method   = "midpoint"

    if silences:
        # Pick the silence closest to midpoint
        best = min(silences, key=lambda s: abs(s["mid"] - midpoint))
        # Only use it if it's within 30% of total duration from midpoint
        if abs(best["mid"] - midpoint) < total_dur * 0.30:
            # Use the END of the silence so Part 2 starts cleanly
            split_at = best["end"]
            method   = "silence"

    if split_at is None:
        split_at = midpoint

    # Cap to valid range
    split_at = max(1.0, min(split_at, total_dur - 1.0))

    base_name = Path(video_path).stem
    part1_path = str(output_dir / f"{base_name}_part1.mp4")
    part2_path = str(output_dir / f"{base_name}_part2.mp4")

    # Cut Part 1: from 0 to split_at
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", video_path,
            "-t", str(split_at),
            "-c", "copy",
            part1_path,
        ],
        check=True, capture_output=True,
    )

    # Cut Part 2: from split_at to end
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", video_path,
            "-ss", str(split_at),
            "-c", "copy",
            part2_path,
        ],
        check=True, capture_output=True,
    )

    part1_dur = get_video_duration(part1_path)
    part2_dur = get_video_duration(part2_path)

    return {
        "split_at":       split_at,
        "method":         method,
        "part1_path":     part1_path,
        "part2_path":     part2_path,
        "part1_duration": part1_dur,
        "part2_duration": part2_dur,
        "total_duration": total_dur,
    }
