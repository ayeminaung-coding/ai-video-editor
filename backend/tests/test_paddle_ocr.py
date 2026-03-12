import pytest
import numpy as np

# Import the functions we want to test
from services.paddle_ocr_service import (
    _is_blank_frame,
    _has_subtitle_changed,
    _majority_vote
)
from services.ocr_service import (
    _texts_are_similar,
    _build_lines_from_events
)


# ─── 1. Test Blank Frame Detection ────────────────────────────────────────────

def test_is_blank_frame():
    """Verify that images with no text/variance are correctly detected as blank."""
    # Create a completely black 100x100 RGB image (zero variance)
    black_img = np.zeros((100, 100, 3), dtype=np.uint8)
    assert _is_blank_frame(black_img) is True
    
    # Create a solid white image (zero variance)
    white_img = np.full((100, 100, 3), 255, dtype=np.uint8)
    assert _is_blank_frame(white_img) is True
    
    # Create an image with random noise (high variance)
    # Set seed for reproducible tests
    np.random.seed(42)
    noise_img = np.random.randint(0, 256, (100, 100, 3), dtype=np.uint8)
    assert _is_blank_frame(noise_img) is False

    # Edge cases
    assert _is_blank_frame(None) is True
    assert _is_blank_frame(np.array([])) is True


# ─── 2. Test Frame Change Detection ───────────────────────────────────────────

def test_has_subtitle_changed():
    """Verify that OCR is skipped if successive frames look exactly the same."""
    prev_img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Draw a mock "subtitle" block in prev
    prev_img[50:80, 20:80] = 255
    
    # 1. Identical frames should return False (no change)
    curr_img = prev_img.copy()
    assert _has_subtitle_changed(prev_img, curr_img, threshold=0.008) is False
    
    # 2. Minor noise should return False (no semantic change)
    curr_img_noisy = prev_img.copy()
    # add just a tiny bit of noise
    curr_img_noisy[0:10, 0:10] = 50 
    assert _has_subtitle_changed(prev_img, curr_img_noisy, threshold=0.008) is False
    
    # 3. New subtitle block should return True (significant change)
    new_sub_img = np.zeros((100, 100, 3), dtype=np.uint8)
    new_sub_img[50:80, 10:90] = 200 # Different block
    assert _has_subtitle_changed(prev_img, new_sub_img, threshold=0.008) is True
    
    # 4. First frame always returns True
    assert _has_subtitle_changed(None, curr_img) is True


# ─── 3. Test Temporal Majority Voting ─────────────────────────────────────────

def test_majority_vote():
    """Verify that temporal sliding window smooths out OCR read glitches."""
    
    # Scenario 1: A single-frame misread amidst stable reads
    texts = ["Hello", "Hello", "He1lo", "Hello", "Hello"]
    # With window=3, "He1lo" is surrounded by 2 "Hello"s, it should become "Hello"
    voted = _majority_vote(texts, window=3)
    assert voted == ["Hello", "Hello", "Hello", "Hello", "Hello"]
    
    # Scenario 2: Rapid text changes (should preserve genuine rapid changes if they hold)
    texts_rapid = ["Start", "Start", "Start", "Next", "Next", "Next"]
    voted_rapid = _majority_vote(texts_rapid, window=3)
    assert voted_rapid == ["Start", "Start", "Start", "Next", "Next", "Next"]

    # Scenario 3: Blank frame glitch
    texts_glitched = ["Dialogue here", "", "Dialogue here"]
    voted_glitch = _majority_vote(texts_glitched, window=3)
    assert voted_glitch == ["Dialogue here", "Dialogue here", "Dialogue here"]


# ─── 4. Test Text Fuzzy Matching ──────────────────────────────────────────────

def test_texts_are_similar():
    """Verify that text deduplication allows for slight OCR variances."""
    
    # 1. Exact match
    assert _texts_are_similar("The quick brown fox", "The quick brown fox") is True
    
    # 2. Minor 1-character OCR errors (common with 'l', '1', 'I')
    assert _texts_are_similar("The quick brown fox", "The qu1ck brown fox") is True
    
    # 3. Completely different subtitles
    assert _texts_are_similar("The quick brown fox", "Jumps over the lazy dog") is False
    
    # 4. Missing one character out of a longer sentence
    assert _texts_are_similar("A completely normal sentence", "A competely normal sentence") is True
    
    # 5. Missing one word (still passes 85% similarity threshold)
    assert _texts_are_similar("I am going to the store", "I going to the store") is True 
    
    # 6. Entirely different meaning and words (fails 85% threshold)
    assert _texts_are_similar("I am going to the store", "You are going home") is False


# ─── 5. Test Subtitle Line Building (Timestamp Alignment) ─────────────────────

def test_build_lines_from_events():
    """Verify that raw frame extraction events group properly into continuous lines."""
    
    duration = 5.0
    # List of (timestamp, raw_ocr_text)
    events = [
        (0.5, "Line 1"),
        (0.8, "Line 1"),
        (1.1, "Line 1"),
        # Gap -> indicates subtitle blinked out
        (2.0, "Line 2"),
        (2.3, "Line 2"),
        (3.0, "Line 3"),
        (3.3, "Line 3") # ends at duration
    ]
    
    lines = _build_lines_from_events(events, duration)
    
    assert len(lines) == 3
    
    # Verify Line 1
    assert lines[0]["text"] == "Line 1"
    assert lines[0]["start"] == 0.5
    # Since gap between 1.1 and 2.0 is 0.9s (long), it should terminate cleanly after 1.1
    assert 1.1 < lines[0]["end"] <= 2.0
    
    # Verify Line 2
    assert lines[1]["text"] == "Line 2"
    assert lines[1]["start"] == 2.0
    # Swaps immediately to Line 3
    assert 2.3 < lines[1]["end"] <= 3.0
    
    # Verify Line 3
    assert lines[2]["text"] == "Line 3"
    assert lines[2]["start"] == 3.0
    assert lines[2]["end"] <= duration
