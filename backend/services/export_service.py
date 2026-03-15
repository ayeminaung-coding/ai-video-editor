# services/export_service.py — Background export pipeline implementation
import os
import subprocess
import re
from services.subtitle_utils import write_ass_from_srt

from services.job_store import create_job as _create_job, get_job as _get_job, pop_job as _pop_job

def create_export_job(job_id: str, tmpdir: str, out_path: str, file_name: str):
    _create_job(job_id, {
        "status": "processing",
        "progress": 0.0,
        "tmpdir": tmpdir,
        "out_path": out_path,
        "file_name": file_name,
        "error": None
    })

def get_export_job(job_id: str):
    return _get_job(job_id)

def pop_export_job(job_id: str):
    return _pop_job(job_id)


def _hex_to_ffmpeg_drawbox_color(hex_color: str, opacity: int) -> str:
    """Convert #RRGGBB + opacity(0-100) → FFmpeg drawbox color string '0xRRGGBBAA'."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
    else:
        r, g, b = "00", "00", "00"
    # FFmpeg drawbox color: 0xRRGGBB@alpha  (alpha 0.0=transparent, 1.0=opaque)
    alpha = opacity / 100.0
    return f"0x{r}{g}{b}@{alpha:.2f}"


def _build_blur_rect_filter(
    blur_rect_x_pct: float,
    blur_rect_y_pct: float,
    blur_rect_width_pct: float,
    blur_rect_height_pct: float,
    blur_rect_opacity: int,
    blur_rect_blur: int,
    blur_rect_color: str,
) -> str:
    """
    Build an FFmpeg complex-filtergraph expression for the blur rectangle.
    Uses absolute x/y/w/h expressed as fractions of iw/ih.
    Returns a filtergraph fragment that expects [v_in] and outputs [v_out].
    """
    xf = blur_rect_x_pct / 100.0
    yf = blur_rect_y_pct / 100.0
    wf = blur_rect_width_pct / 100.0
    hf = blur_rect_height_pct / 100.0

    x_expr = f"iw*{xf:.4f}"
    y_expr = f"ih*{yf:.4f}"
    w_expr = f"iw*{wf:.4f}"
    h_expr = f"ih*{hf:.4f}"

    draw_color = _hex_to_ffmpeg_drawbox_color(blur_rect_color, blur_rect_opacity)

    if blur_rect_blur == 0:
        return (
            f"[v_in]drawbox=x={x_expr}:y={y_expr}:w={w_expr}:h={h_expr}"
            f":color={draw_color}:t=fill[v_out]"
        )
    else:
        # overlay variables: W/H = main input W/H, not iw/ih
        overlay_x_expr = f"W*{xf:.4f}"
        overlay_y_expr = f"H*{yf:.4f}"

        radius = blur_rect_blur
        frag = (
            f"[v_in]split[orig][for_blur];"
            f"[for_blur]crop={w_expr}:{h_expr}:{x_expr}:{y_expr},boxblur=luma_radius={radius}:luma_power=1:chroma_radius={radius}:chroma_power=1[blurred];"
            f"[orig][blurred]overlay=x={overlay_x_expr}:y={overlay_y_expr}[blur_applied];"
            f"[blur_applied]drawbox=x={x_expr}:y={y_expr}:w={w_expr}:h={h_expr}"
            f":color={draw_color}:t=fill[v_out]"
        )
        return frag


def run_export_task(
    job_id: str,
    tmpdir: str,
    video_path: str,
    srt_path: str,
    out_path: str,
    font_size: int,
    color: str,
    alignment: int,
    bg_opacity: int,
    font_name: str,
    font_dir_param: str | None,
    # Blur rectangle
    blur_rect_enabled: bool = False,
    blur_rect_x_pct: float = 19.0,
    blur_rect_y_pct: float = 85.0,
    blur_rect_width_pct: float = 60.0,
    blur_rect_height_pct: float = 11.0,
    blur_rect_opacity: int = 21,
    blur_rect_blur: int = 13,
    blur_rect_color: str = "#ffffff",
    # Watermark
    watermark_enabled: bool = False,
    watermark_text: str = "@DramaSubsTV",
    watermark_x_pct: float = 10.0,
    watermark_y_pct: float = 10.0,
    watermark_font_size: int = 40,
    watermark_color: str = "#ffffff",
    watermark_opacity: int = 80,
    # Text stroke
    stroke_enabled: bool = False,
    stroke_color: str = "#000000",
    stroke_size: float = 1.0,
    margin_v: int = 15,
    margin_h: int = 15,
    # Subtitle padding (pixels)
    padding_h: int = 14,
    padding_v: int = 6,
):
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
            
        # Build subtitle box/outline styles.
        dual_layer = False
        stroke_ass_color = "&H00000000&"
        
        if stroke_enabled and stroke_color:
            sc_hex = stroke_color.replace("#", "")
            if len(sc_hex) == 6:
                sr, sg, sb = sc_hex[0:2], sc_hex[2:4], sc_hex[4:6]
                stroke_ass_color = f"&H00{sb}{sg}{sr}&"

        if bg_opacity == 0:
            border_style = 1
            if stroke_enabled:
                outline = float(stroke_size)
            else:
                outline = 1.5
            shadow = 1.0
            back_colour = stroke_ass_color if stroke_enabled else "&H00000000&"
        else:
            # Alpha is 00 (opaque) to FF (transparent)
            alpha_val = int((100 - bg_opacity) * 255 / 100)
            alpha_hex = f"{alpha_val:02X}"
            back_colour = f"&H{alpha_hex}000000&"
            
            if stroke_enabled:
                # Need dual layer ASS hack because BorderStyle=3 (Box) ignores outline strokes natively
                dual_layer = True
                
            border_style = 3
            # In ASS BorderStyle=3, the Outline value is the box border/padding thickness.
            # Use the larger of h/v padding so the box looks spacious on all sides.
            outline = float(max(padding_h, padding_v, 1))
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
            margin_h=margin_h,
            # Make the box border match the box fill (no visible ring around the subtitle box)
            outline_colour=back_colour if border_style == 3 else stroke_ass_color,
            # Dual Layer hack configurations
            dual_layer=dual_layer,
            stroke_size=float(stroke_size) if dual_layer else outline,
            # Watermark burned via ASS for stability on Windows (avoids drawtext crashes)
            watermark_enabled=watermark_enabled,
            watermark_text=watermark_text,
            watermark_x_pct=watermark_x_pct,
            watermark_y_pct=watermark_y_pct,
            watermark_font_size=watermark_font_size,
            watermark_color=watermark_color,
            watermark_opacity=watermark_opacity,
        )

        # Build the ASS subtitle filter
        ass_filter = "ass=sub.ass"
        if font_dir_param:
            ass_filter += f":fontsdir='{font_dir_param}'"

        # ── Build video filter chain ──────────────────────────────────────────
        filter_chain = []
        current_in = "[0:v]"
        next_id = 1

        if blur_rect_enabled:
            blur_frag = _build_blur_rect_filter(
                blur_rect_x_pct,
                blur_rect_y_pct,
                blur_rect_width_pct,
                blur_rect_height_pct,
                blur_rect_opacity,
                blur_rect_blur,
                blur_rect_color,
            )
            blur_frag = blur_frag.replace("[v_in]", current_in)
            current_out = f"[v{next_id}]"
            blur_frag = blur_frag.replace("[v_out]", current_out)
            filter_chain.append(blur_frag)
            current_in = current_out
            next_id += 1

        # Finally add subtitles
        final_ass_filter = f"{current_in}{ass_filter}"
        # We don't necessarily need to name the final output or we can just leave it unnamed for the final mapped
        # Actually it's cleaner to name it and map to it
        current_out = f"[v{next_id}]"
        final_ass_filter += f"{current_out}"
        filter_chain.append(final_ass_filter)

        vf_chain_str = ";".join(filter_chain)
        
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-filter_complex", vf_chain_str,
            "-map", current_out,
            "-map", "0:a?",
            "-c:v", "libx264", "-crf", "15", "-preset", "fast", "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            out_path
        ]
        
        # First, find total duration using ffprobe
        duration_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_path]
        dur_res = subprocess.run(duration_cmd, capture_output=True, text=True)
        total_duration = float(dur_res.stdout.strip()) if dur_res.stdout.strip() else 0.0
        
        process = subprocess.Popen(
            cmd, cwd=tmpdir,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            universal_newlines=True,
            encoding='utf-8', errors='replace'
        )
        
        time_regex = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}\.\d{2})")
        
        ffmpeg_tail: list[str] = []
        # Read stderr line by line for progress tracking
        for line in process.stderr:
            ffmpeg_tail.append(line.rstrip())
            if len(ffmpeg_tail) > 40:
                ffmpeg_tail.pop(0)
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
            tail = "\n".join(ffmpeg_tail[-8:])
            raise Exception(f"FFmpeg returned non-zero exit code {process.returncode}. Last log lines:\n{tail}")
            
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
