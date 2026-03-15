# services/subtitle_utils.py — Subtitle formats and algorithms
import re
import json
import subprocess

def ass_time_from_srt_timestamp(ts: str) -> str:
    """SRT: HH:MM:SS,mmm (or .mmm) -> ASS: H:MM:SS.cc"""
    hms, ms = ts.replace(".", ",").split(",")
    h, m, s = hms.split(":")
    centiseconds = int(round(int(ms) / 10.0))
    if centiseconds >= 100:
        sec = int(s) + 1
        s = str(sec % 60).zfill(2)
        if sec >= 60:
            minute = int(m) + 1
            m = str(minute % 60).zfill(2)
            if minute >= 60:
                h = str(int(h) + 1)
        centiseconds = 0
    return f"{int(h)}:{m}:{s}.{centiseconds:02d}"

def escape_ass_text(text: str) -> str:
    """Escape ASS control chars and map line breaks to ASS newline escape."""
    return (
        text.replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\r\n", r"\N")
        .replace("\n", r"\N")
        .replace("\r", r"\N")
    )

def srt_to_ass_dialogues(srt_text: str) -> list[tuple[str, str, str]]:
    """Returns list of (start_ass, end_ass, escaped_text)"""
    dialogues: list[tuple[str, str, str]] = []
    blocks = re.split(r"\r?\n\r?\n+", srt_text.strip())
    timing_re = re.compile(
        r"^\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*$"
    )
    for block in blocks:
        rows = [r for r in re.split(r"\r?\n", block) if r is not None]
        if len(rows) < 2:
            continue
        time_row = rows[1] if timing_re.match(rows[1]) else (rows[0] if timing_re.match(rows[0]) else None)
        if not time_row:
            continue
        match = timing_re.match(time_row)
        if not match:
            continue
        start_srt, end_srt = match.groups()
        text_start_idx = 2 if rows[1] == time_row else 1
        text = "\n".join(rows[text_start_idx:]).strip()
        if not text:
            continue
        dialogues.append((
            ass_time_from_srt_timestamp(start_srt),
            ass_time_from_srt_timestamp(end_srt),
            escape_ass_text(text),
        ))
    return dialogues

def probe_video_resolution(video_path: str) -> tuple[int, int]:
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        video_path,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        payload = json.loads(res.stdout or "{}")
        stream = (payload.get("streams") or [{}])[0]
        width = int(stream.get("width") or 1280)
        height = int(stream.get("height") or 720)
        return width, height
    except Exception:
        return 1280, 720

def write_ass_from_srt(
    srt_path: str,
    ass_path: str,
    width: int,
    height: int,
    font_name: str,
    font_size: int,
    primary_colour: str,
    border_style: int,
    outline: float,
    shadow: float,
    back_colour: str,
    alignment: int,
    margin_v: int,
    margin_h: int = 24,
    outline_colour: str = "&H00000000&",
    dual_layer: bool = False,
    stroke_size: float = 1.5,
    watermark_enabled: bool = False,
    watermark_text: str = "",
    watermark_x_pct: float = 10.0,
    watermark_y_pct: float = 10.0,
    watermark_font_size: int = 24,
    watermark_color: str = "#ffffff",
    watermark_opacity: int = 80,
):
    with open(srt_path, "r", encoding="utf-8-sig", errors="replace") as f:
        srt_text = f.read()

    dialogues = srt_to_ass_dialogues(srt_text)
    if not dialogues:
        raise ValueError("No subtitle lines parsed from SRT")

    if dual_layer:
        # Dual-Layer ASS Hack
        # Style LayerText: Text has Outline (stroke_size), but no BorderStyle=3
        # Style LayerBox: BorderStyle=3 box with fully transparent text 
        header = (
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            f"PlayResX: 384\n"
            f"PlayResY: 288\n\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: LayerBox,{font_name},{font_size},&HFF000000,&H000000FF,{outline_colour},{back_colour},"
            f"0,0,0,0,100,100,0,0,3,{outline:.1f},{shadow:.1f},{alignment},{margin_h},{margin_h},{margin_v},0\n"
            f"Style: LayerText,{font_name},{font_size},{primary_colour},&H000000FF,{outline_colour},&H00000000,"
            f"0,0,0,0,100,100,0,0,1,{stroke_size:.1f},{shadow:.1f},{alignment},{margin_h},{margin_h},{margin_v},0\n\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )
        lines = []
        for start, end, text in dialogues:
            # Layer 0: The fully transparent text that forces ASS to render the opaque padding box
            transparent_text = "{\\1a&HFF&}" + text
            lines.append(f"Dialogue: 0,{start},{end},LayerBox,,0,0,0,,{transparent_text}")
            # Layer 1: The actual subtitle text with an outline (renders natively exactly over the box)
            lines.append(f"Dialogue: 1,{start},{end},LayerText,,0,0,0,,{text}")
    else:
        # Standard behaviour
        header = (
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            f"PlayResX: 384\n"
            f"PlayResY: 288\n\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: Default,{font_name},{font_size},{primary_colour},&H000000FF,{outline_colour},{back_colour},"
            f"0,0,0,0,100,100,0,0,{border_style},{outline:.1f},{shadow:.1f},{alignment},{margin_h},{margin_h},{margin_v},0\n\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )
        lines = [
            f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}"
            for start, end, text in dialogues
        ]
        
    if watermark_enabled and watermark_text.strip():
        wm_hex = watermark_color.lstrip("#")
        if len(wm_hex) != 6:
            wm_hex = "FFFFFF"

        # ASS color is BBGGRR, alpha is inverse opacity (00 opaque, FF transparent).
        rr, gg, bb = wm_hex[0:2], wm_hex[2:4], wm_hex[4:6]
        wm_ass_color = f"&H{bb}{gg}{rr}&"
        wm_alpha = int((100 - max(0, min(100, watermark_opacity))) * 255 / 100)
        wm_ass_alpha = f"&H{wm_alpha:02X}&"
        wm_x = max(0, min(100, watermark_x_pct)) * 3.84
        wm_y = max(0, min(100, watermark_y_pct)) * 2.88
        wm_text = escape_ass_text(watermark_text)

        # Add a dedicated watermark style and a full-duration dialogue line.
        lines.insert(0, (
            f"Dialogue: 5,0:00:00.00,9:59:59.99,Watermark,,0,0,0,,"
            f"{{\\an7\\pos({wm_x:.1f},{wm_y:.1f})\\fs{int(max(8, watermark_font_size))}"
            f"\\c{wm_ass_color}\\alpha{wm_ass_alpha}\\bord2\\3c&H000000&\\shad1}}{wm_text}"
        ))

        style_line = (
            f"Style: Watermark,{font_name},{int(max(8, watermark_font_size))},&H00FFFFFF&,"
            f"&H000000FF&,&H00000000&,&H00000000&,0,0,0,0,100,100,0,0,1,2,1,7,10,10,10,0"
        )
        if "[Events]" in header:
            style_insert_at = header.find("[Events]")
            header = header[:style_insert_at] + style_line + "\n" + header[style_insert_at:]

    ass_content = header + "\n".join(lines) + "\n"

    # Write with UTF-8 BOM for better ffmpeg/libass behavior on Windows.
    with open(ass_path, "w", encoding="utf-8-sig", newline="\n") as f:
        f.write(ass_content)
