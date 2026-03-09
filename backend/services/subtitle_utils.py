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
):
    with open(srt_path, "r", encoding="utf-8-sig", errors="replace") as f:
        srt_text = f.read()

    dialogues = srt_to_ass_dialogues(srt_text)
    if not dialogues:
        raise ValueError("No subtitle lines parsed from SRT")

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: 384\n"
        f"PlayResY: 288\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},{primary_colour},&H000000FF,&H00000000,{back_colour},"
        f"0,0,0,0,100,100,0,0,{border_style},{outline},{shadow},{alignment},24,24,{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [
        f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}"
        for start, end, text in dialogues
    ]
    ass_content = header + "\n".join(lines) + "\n"

    # Write with UTF-8 BOM for better ffmpeg/libass behavior on Windows.
    with open(ass_path, "w", encoding="utf-8-sig", newline="\n") as f:
        f.write(ass_content)
