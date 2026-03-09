# services/srt_builder.py — SRT / VTT formatting utilities

from typing import Any


def _sec_to_srt_time(seconds: float) -> str:
    """Convert float seconds → SRT timestamp HH:MM:SS,mmm"""
    total_ms = max(0, int(round(max(0.0, seconds) * 1000)))
    h, rem = divmod(total_ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1_000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(lines: list[dict[str, Any]], start_index: int = 1) -> str:
    """
    Build an SRT string from a list of subtitle lines.

    Each line must have:
        { "start": float (seconds), "end": float (seconds), "text": str }

    Returns a valid .srt string.
    """
    parts = []
    for i, line in enumerate(lines, start=start_index):
        start = _sec_to_srt_time(float(line["start"]))
        end   = _sec_to_srt_time(float(line["end"]))
        text  = line["text"].strip()
        parts.append(f"{i}\n{start} --> {end}\n{text}")
    return "\n\n".join(parts)


def parse_gemini_response(raw: str) -> list[dict[str, Any]]:
    """
    Parse Gemini's JSON response into a normalised list of subtitle dicts.

    Gemini is prompted to return JSON like:
    [
        {
            "start": "00:00:01.200",  // or float seconds
            "end":   "00:00:04.800",
            "zh":    "Chinese text",
            "my":    "Burmese translation"
        },
        ...
    ]

    Returns list of { "start": float, "end": float, "zh": str, "my": str }
    """
    import json, re

    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        # Try to repair truncated JSON arrays
        try:
            # Find the last closing brace of a complete object
            last_brace_idx = cleaned.rfind("}")
            if last_brace_idx != -1:
                repaired = cleaned[:last_brace_idx + 1] + "]"
                data = json.loads(repaired)
                print(f"[Warning] Repaired truncated JSON array from Gemini. Original length: {len(cleaned)}")
            else:
                raise exc
        except Exception:
            raise ValueError(f"Gemini did not return valid JSON: {exc}\nRaw output:\n{raw[:500]}")

    result = []
    for item in data:
        result.append({
            "start": _parse_time(item.get("start", 0)),
            "end":   _parse_time(item.get("end",   0)),
            "zh":    item.get("zh", ""),
            "my":    item.get("my", ""),
        })

    # Sort by start time
    result.sort(key=lambda x: x["start"])
    return result


def _parse_time(value: Any) -> float:
    """Accept seconds (float/int) or HH:MM:SS.mmm / HH:MM:SS,mmm strings."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        value = value.replace(",", ".")
        parts = value.split(":")
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        if len(parts) == 2:
            m, s = parts
            return int(m) * 60 + float(s)
        return float(value)
    return 0.0
