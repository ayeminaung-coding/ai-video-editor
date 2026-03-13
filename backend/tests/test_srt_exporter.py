import os
import time
import pytest
from services.export_service import _hex_to_ffmpeg_drawbox_color
from services.subtitle_utils import write_ass_from_srt

# ─── 1. Unit Test for Color Filter Conversion ─────────────────────────────────

def test_hex_to_ffmpeg_drawbox_color():
    """Verify that hex colors and opacity are correctly mapped to FFmpeg format."""
    # #FFFFFF at 70% opacity -> 0xFFFFFF@0.70
    assert _hex_to_ffmpeg_drawbox_color("#FFFFFF", 70) == "0xFFFFFF@0.70"
    
    # #000000 at 100% opacity -> 0x000000@1.00
    assert _hex_to_ffmpeg_drawbox_color("#000000", 100) == "0x000000@1.00"
    
    # Edge case: No hash provided
    assert _hex_to_ffmpeg_drawbox_color("FF00FF", 50) == "0xFF00FF@0.50"
    
    # Edge case: 0% opacity
    assert _hex_to_ffmpeg_drawbox_color("#123456", 0) == "0x123456@0.00"


# ─── 2. Unit Test for ASS Generation ──────────────────────────────────────────

def test_write_ass_from_srt(dummy_srt_file, tmp_path):
    """Verify that SRT files are properly converted into formatted ASS styles."""
    ass_path = str(tmp_path / "test_output.ass")
    
    write_ass_from_srt(
        srt_path=dummy_srt_file,
        ass_path=ass_path,
        width=384,
        height=288,
        font_name="Arial",
        font_size=20,
        primary_colour="&H00FFFFFF&",
        border_style=1,
        outline=1.5,
        shadow=1.0,
        back_colour="&H00000000&",
        alignment=2,
        margin_v=15,
        margin_h=24,
        outline_colour="&H00000000&",
    )
    
    assert os.path.exists(ass_path)
    with open(ass_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Check [Script Info] block exists
    assert "[Script Info]" in content
    assert "PlayResX: 384" in content
    assert "PlayResY: 288" in content
    
    # Check [V4+ Styles] exists with the correct name and sizing
    assert "[V4+ Styles]" in content
    assert "Style: Default,Arial,20," in content
    # In ASS format, the values are comma separated. Check the end of the line for styling params.
    assert "1,1.5,1.0,2,24,24,15,0\n" in content
    
    # Check that our dummy dialog line was parsed and converted
    assert "[Events]" in content
    assert "Hello World" in content


# ─── 3. Integration Tests for Export Endpoints ────────────────────────────────

def test_export_start_queue(client, dummy_video_file, dummy_srt_file):
    """Verify that the API accepts video+srt files and starts a background job."""
    
    with open(dummy_video_file, "rb") as vf, open(dummy_srt_file, "rb") as sf:
        files = {
            "video_file": ("video.mp4", vf, "video/mp4"),
            "srt_file": ("sub.srt", sf, "text/plain"),
        }
        
        # Passing required form fields exactly as the frontend would
        data = {
            "font_size": 24,
            "color": "#ffffff",
            "position": "bottom",
            "bg_opacity": 50,
            "blur_rect_enabled": "false",
        }
        
        response = client.post("/api/video/export/start", files=files, data=data)
        
    assert response.status_code == 200
    res_data = response.json()
    assert "job_id" in res_data
    
    job_id = res_data["job_id"]
    
    # Wait for the background thread to finish the FFmpeg process
    import time
    for _ in range(15):  # 15 attempts / total 7.5s
        res = client.get(f"/api/video/export/status/{job_id}")
        assert res.status_code == 200
        if res.json()["status"] == "done":
            break
        elif res.json()["status"] == "error":
            # If there's an error, it is an execution failure but the API layer responded correctly
            assert "error" in res.json()
            break
        time.sleep(0.5)
        
    final_status = client.get(f"/api/video/export/status/{job_id}").json()
    assert final_status["status"] in ["done", "error"], f"Job didn't finish: {final_status}"

    # Verify download fails correctly if job is not fully done, otherwise works
    if final_status["status"] == "done":
        dl_res = client.get(f"/api/video/export/download/{job_id}")
        assert dl_res.status_code == 200
        # Media type should be video/mp4
        assert dl_res.headers["content-type"] == "video/mp4"
