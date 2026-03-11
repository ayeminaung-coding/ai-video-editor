# services/metadata_service.py
# Read rich metadata via ffprobe / Pillow, strip it via ffmpeg / Pillow

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _ffprobe_available() -> bool:
    return shutil.which("ffprobe") is not None


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _format_bytes(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.2f} {unit}"
        size //= 1024
    return f"{size:.2f} TB"


# --------------------------------------------------------------------------- #
# Read metadata
# --------------------------------------------------------------------------- #

def read_metadata(file_path: str, mime_type: str) -> list[dict[str, Any]]:
    """
    Return a list of metadata groups, each with:
        { "group": str, "fields": [{"key": str, "value": str}, ...] }
    """
    ext = Path(file_path).suffix.lower()
    is_image = mime_type.startswith("image/") or ext in {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"
    }
    is_video = mime_type.startswith("video/") or ext in {
        ".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".m4v", ".wmv"
    }
    is_audio = mime_type.startswith("audio/") or ext in {
        ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"
    }

    groups: list[dict[str, Any]] = []

    # ── File system info ──────────────────────────────────────────────────
    stat = os.stat(file_path)
    groups.append({
        "group": "File Info",
        "fields": [
            {"key": "File name", "value": Path(file_path).name},
            {"key": "File size", "value": _format_bytes(stat.st_size)},
            {"key": "MIME type", "value": mime_type or "unknown"},
            {"key": "Extension", "value": ext or "(none)"},
        ],
    })

    # ── Image metadata via Pillow ─────────────────────────────────────────
    if is_image:
        try:
            with Image.open(file_path) as img:
                basic_fields = [
                    {"key": "Width", "value": f"{img.width} px"},
                    {"key": "Height", "value": f"{img.height} px"},
                    {"key": "Mode", "value": img.mode},
                    {"key": "Format", "value": img.format or "unknown"},
                ]
                groups.append({"group": "Image Properties", "fields": basic_fields})

                # EXIF data
                exif_fields: list[dict] = []
                try:
                    from PIL.ExifTags import TAGS
                    raw_exif = img._getexif()  # type: ignore[attr-defined]
                    if raw_exif:
                        for tag_id, value in raw_exif.items():
                            tag = TAGS.get(tag_id, str(tag_id))
                            # Skip thumbnail blobs
                            if isinstance(value, bytes) and len(value) > 64:
                                value = f"<binary data {len(value)} bytes>"
                            exif_fields.append({"key": str(tag), "value": str(value)})
                except Exception:
                    pass

                if exif_fields:
                    groups.append({"group": "EXIF / Camera Metadata", "fields": exif_fields})
                else:
                    groups.append({
                        "group": "EXIF / Camera Metadata",
                        "fields": [{"key": "Status", "value": "No EXIF data found"}],
                    })

                # PNG / other text metadata
                info_fields = [
                    {"key": k, "value": str(v)}
                    for k, v in (img.info or {}).items()
                    if k.lower() not in ("exif", "icc_profile", "xmp")
                    and isinstance(v, (str, int, float))
                ]
                if info_fields:
                    groups.append({"group": "Embedded Text / Tags", "fields": info_fields})

        except Exception as exc:
            logger.warning(f"Pillow read error: {exc}")
            groups.append({
                "group": "Image Properties",
                "fields": [{"key": "Error", "value": str(exc)}],
            })

    # ── Video / Audio metadata via ffprobe ────────────────────────────────
    if (is_video or is_audio) and _ffprobe_available():
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "quiet",
                    "-print_format", "json",
                    "-show_format", "-show_streams",
                    file_path,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            probe = json.loads(result.stdout or "{}")

            # Format / container info
            fmt = probe.get("format", {})
            fmt_tags = fmt.pop("tags", {})
            fmt_fields = [
                {"key": "Format name", "value": fmt.get("format_name", "")},
                {"key": "Format long name", "value": fmt.get("format_long_name", "")},
                {"key": "Duration", "value": f"{float(fmt.get('duration', 0)):.2f}s"},
                {"key": "Bit rate", "value": f"{int(fmt.get('bit_rate', 0)) // 1000} kbps"},
                {"key": "Nb streams", "value": str(fmt.get("nb_streams", ""))},
            ]
            groups.append({"group": "Container / Format", "fields": fmt_fields})

            # Embedded tags (title, artist, comment, creation_time, etc.)
            if fmt_tags:
                tag_fields = [{"key": k, "value": str(v)} for k, v in fmt_tags.items()]
                groups.append({"group": "Embedded Tags (Metadata)", "fields": tag_fields})
            else:
                groups.append({
                    "group": "Embedded Tags (Metadata)",
                    "fields": [{"key": "Status", "value": "No embedded tags found"}],
                })

            # Streams
            for stream in probe.get("streams", []):
                codec_type = stream.get("codec_type", "unknown").capitalize()
                stream_fields = []
                for k in (
                    "codec_name", "codec_long_name", "profile",
                    "width", "height", "r_frame_rate",
                    "sample_rate", "channels", "channel_layout",
                    "bit_rate", "duration",
                ):
                    v = stream.get(k)
                    if v is not None:
                        stream_fields.append({"key": k.replace("_", " ").title(), "value": str(v)})
                stream_tags = stream.get("tags", {})
                for k, v in stream_tags.items():
                    stream_fields.append({"key": f"[tag] {k}", "value": str(v)})

                groups.append({
                    "group": f"{codec_type} Stream",
                    "fields": stream_fields,
                })

        except Exception as exc:
            logger.warning(f"ffprobe error: {exc}")
            groups.append({
                "group": "Media Streams",
                "fields": [{"key": "Error", "value": str(exc)}],
            })

    elif (is_video or is_audio) and not _ffprobe_available():
        groups.append({
            "group": "Media Streams",
            "fields": [{"key": "Note", "value": "ffprobe not found — install ffmpeg to see media metadata"}],
        })

    return groups


# --------------------------------------------------------------------------- #
# Remove (strip) metadata
# --------------------------------------------------------------------------- #

def strip_metadata(src_path: str, mime_type: str, original_filename: str) -> tuple[str, str]:
    """
    Strip all metadata from the file and write a clean copy to a temp file.
    Returns (temp_file_path, suggested_download_filename).
    """
    ext = Path(original_filename).suffix.lower() or Path(src_path).suffix.lower()
    stem = Path(original_filename).stem

    is_image = mime_type.startswith("image/") or ext in {
        ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"
    }
    is_video = mime_type.startswith("video/") or ext in {
        ".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".m4v", ".wmv"
    }
    is_audio = mime_type.startswith("audio/") or ext in {
        ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"
    }

    out_dir = tempfile.mkdtemp(prefix="meta_clean_")
    out_name = f"{stem}_clean{ext}"
    out_path = os.path.join(out_dir, out_name)

    # ── Image: re-save without EXIF via Pillow ────────────────────────────
    if is_image:
        with Image.open(src_path) as img:
            # Convert RGBA → RGB for JPEG
            if ext in (".jpg", ".jpeg") and img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            # Save without exif / info
            kwargs: dict[str, Any] = {}
            if ext in (".jpg", ".jpeg"):
                kwargs["quality"] = 95
                kwargs["optimize"] = True
            img.save(out_path, **kwargs)
        return out_path, out_name

    # ── Video / Audio: remux with ffmpeg, map_metadata -1 ─────────────────
    if (is_video or is_audio) and _ffmpeg_available():
        # -map_metadata -1  → strip all global metadata
        # -fflags +bitexact → don't embed encoder string
        # -c copy           → stream-copy (no re-encode, fast)
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", src_path,
                "-map_metadata", "-1",
                "-map_chapters", "-1",
                "-fflags", "+bitexact",
                "-c", "copy",
                out_path,
            ],
            capture_output=True,
            timeout=120,
            check=True,
        )
        return out_path, out_name

    # ── Fallback: raw binary copy ─────────────────────────────────────────
    shutil.copy2(src_path, out_path)
    return out_path, out_name
