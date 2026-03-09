# services/export_service.py — Background export pipeline implementation
import os
import subprocess
import re
from services.subtitle_utils import write_ass_from_srt

# In-memory store for export jobs
export_jobs = {}

def create_export_job(job_id: str, tmpdir: str, out_path: str, file_name: str):
    export_jobs[job_id] = {
        "status": "processing",
        "progress": 0.0,
        "tmpdir": tmpdir,
        "out_path": out_path,
        "file_name": file_name,
        "error": None
    }

def get_export_job(job_id: str):
    return export_jobs.get(job_id)

def pop_export_job(job_id: str):
    return export_jobs.pop(job_id, None)

def run_export_task(job_id: str, tmpdir: str, video_path: str, srt_path: str, out_path: str, font_size: int, color: str, position: str, bg_opacity: int, font_name: str, font_dir_param: str | None):
    job = get_export_job(job_id)
    if not job: 
        return
    
    try:
        # ASS colors are AABBGGRR. Here we set alpha=00 (opaque) for primary text.
        color_hex = color.replace("#", "")
        if len(color_hex) == 6:
            r, g, b = color_hex[0:2], color_hex[2:4], color_hex[4:6]
            primary_colour = f"&H00{b}{g}{r}&"
        else:
            primary_colour = "&H00FFFFFF&"
            
        alignment = 2 if position == "bottom" else 8
        margin_v = 15 if position == "bottom" else 30
        
        # Build subtitle box/outline styles.
        if bg_opacity == 0:
            border_style = 1
            outline = 1.5
            shadow = 1.0
            back_colour = "&H00000000&"
        else:
            # Alpha is 00 (opaque) to FF (transparent)
            alpha_val = int((100 - bg_opacity) * 255 / 100)
            alpha_hex = f"{alpha_val:02X}"
            back_colour = f"&H{alpha_hex}000000&"
            border_style = 3
            outline = 1.0
            shadow = 0.0

        ass_path = os.path.join(tmpdir, "sub.ass")
        write_ass_from_srt(
            srt_path=srt_path,
            ass_path=ass_path,
            width=384,
            height=288,
            font_name=font_name,
            font_size=font_size,
            primary_colour=primary_colour,
            border_style=border_style,
            outline=outline,
            shadow=shadow,
            back_colour=back_colour,
            alignment=alignment,
            margin_v=margin_v,
        )

        # Use ASS renderer path instead of raw SRT for better complex-script rendering.
        sub_filter = "ass=sub.ass"
        if font_dir_param:
            sub_filter += f":fontsdir='{font_dir_param}'"
        
        # First, find total duration using ffprobe
        duration_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_path]
        dur_res = subprocess.run(duration_cmd, capture_output=True, text=True)
        total_duration = float(dur_res.stdout.strip()) if dur_res.stdout.strip() else 0.0
        
        cmd = [
            "ffmpeg", "-y",
            "-i", "input.mp4",
            "-vf", sub_filter,
            "-c:a", "copy",
            "output.mp4"
        ]
        
        process = subprocess.Popen(
            cmd, cwd=tmpdir,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            universal_newlines=True,
            encoding='utf-8', errors='replace'
        )
        
        time_regex = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}\.\d{2})")
        
        # Read stderr line by line
        for line in process.stderr:
            match = time_regex.search(line)
            if match and total_duration > 0:
                h, m, s = match.groups()
                current_time = int(h) * 3600 + int(m) * 60 + float(s)
                progress = (current_time / total_duration) * 100.0
                job["progress"] = min(99.0, max(0.0, progress))
                
        process.wait()
        
        if process.returncode == 0:
            job["status"] = "done"
            job["progress"] = 100.0
        else:
            raise Exception(f"FFmpeg returned non-zero exit code {process.returncode}")
            
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
