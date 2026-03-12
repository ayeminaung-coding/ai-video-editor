import pytest
import os
from routers.tiktok_changer import _build_drawtext_filters


def test_tiktok_scaling_logic(tmpdir):
    """
    Test that the frontend UI canvas dimensions (e.g. 405x720) correctly scale up 
    the font sizes and Y coordinates to map precisely onto the 1080x1920 video canvas.
    """
    canvas_w = 1080
    canvas_h = 1920
    ui_canvas_w = 405
    ui_canvas_h = 720
    
    # 1. Provide a mock layer spanning exact UI center
    text_layers = [
        {
            "text": "Hello TikTok",
            "xPct": 50,
            "yPct": 50,
            "fontSize": 20, 
            "strokeWidth": 2,
            "color": "ffffff"
        }
    ]
    
    # Run the filter builder
    fragments = _build_drawtext_filters(
        text_layers=text_layers,
        canvas_w=canvas_w,
        canvas_h=canvas_h,
        tmpdir=str(tmpdir),
        font_file="mockfont.ttf",
        ui_canvas_w=ui_canvas_w,
        ui_canvas_h=ui_canvas_h
    )
    
    assert len(fragments) == 1
    filter_string = fragments[0]
    
    # 2. Check X/Y Scale
    # scaled_y = (1920 * 0.5) = 960
    assert "x=540" in filter_string # 1080 * 0.5
    
    # 3. Check Font Scaling
    # scale_y = 1920 / 720 = 2.666
    # font_size = 20 * 2.666 = 53
    assert "fontsize=53" in filter_string
    
    # 4. Check that Y is offset correctly to compensate for FFmpeg top-left rendering vs Canvas bottom-left
    # Native expected y = 960
    # Expected compensated y = 960 - 53 = 907
    assert "y=907" in filter_string

def test_tiktok_empty_layer_graceful(tmpdir):
    """
    Test that providing 0 layers correctly returns no text fragments 
    without causing index/math errors.
    """
    fragments = _build_drawtext_filters(
        text_layers=[],
        canvas_w=1080,
        canvas_h=1920,
        tmpdir=str(tmpdir),
        font_file="mockfont.ttf"
    )
    
    assert len(fragments) == 0
