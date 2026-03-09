# services/pipeline_optimizer.py — Performance optimization utilities
"""
Pipeline Optimization Module

Provides configuration presets and optimization strategies for faster OCR/translation.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


@dataclass
class PipelinePreset:
    """Pre-configured pipeline settings for different use cases."""
    name: str
    description: str
    
    # Frame sampling
    sample_fps: float = 6.0
    scene_threshold: float = 0.003
    periodic_sec: float = 0.6
    max_keyframes: int = 140
    
    # OCR settings
    ocr_batch_size: int = 1
    ocr_timeout: float = 60.0
    
    # Memory optimization
    unload_models_after: bool = True
    max_memory_mb: int = 4096
    
    # Parallelization
    parallel_frames: int = 1  # Set >1 for multi-threaded OCR
    
    @classmethod
    def fast(cls) -> 'PipelinePreset':
        """Fast processing - lower quality, quicker results."""
        return cls(
            name="fast",
            description="Quick processing with reduced accuracy (4 FPS, 80 frames max)",
            sample_fps=4.0,
            scene_threshold=0.004,
            periodic_sec=1.0,
            max_keyframes=80,
            parallel_frames=2,
        )
    
    @classmethod
    def balanced(cls) -> 'PipelinePreset':
        """Balanced processing - good quality/speed tradeoff."""
        return cls(
            name="balanced",
            description="Balanced quality and speed (6 FPS, 140 frames max)",
            sample_fps=6.0,
            scene_threshold=0.003,
            periodic_sec=0.6,
            max_keyframes=140,
            parallel_frames=1,
        )
    
    @classmethod
    def thorough(cls) -> 'PipelinePreset':
        """Thorough processing - maximum accuracy, slower."""
        return cls(
            name="thorough",
            description="Maximum accuracy for difficult videos (10 FPS, 320 frames max)",
            sample_fps=10.0,
            scene_threshold=0.0018,
            periodic_sec=0.25,
            max_keyframes=320,
            parallel_frames=1,
        )
    
    @classmethod
    def high_performance(cls) -> 'PipelinePreset':
        """High performance - parallel processing for powerful hardware."""
        return cls(
            name="high_performance",
            description="Parallel processing for fast hardware (8 FPS, 4 parallel)",
            sample_fps=8.0,
            scene_threshold=0.0025,
            periodic_sec=0.5,
            max_keyframes=200,
            parallel_frames=4,
            max_memory_mb=8192,
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert preset to dictionary for API usage."""
        return {
            "sample_fps": self.sample_fps,
            "scene_threshold": self.scene_threshold,
            "periodic_sec": self.periodic_sec,
            "max_keyframes": self.max_keyframes,
            "parallel_frames": self.parallel_frames,
        }


# Performance optimization tips
OPTIMIZATION_TIPS = """
Pipeline Optimization Guide:
============================

1. Frame Sampling:
   - Lower FPS = faster processing but may miss brief subtitles
   - Higher scene_threshold = fewer frames, faster but less accurate
   - Recommended starting point: 6 FPS, 0.003 threshold

2. Memory Management:
   - CRAFT detector is shared across frames (reference counted)
   - Models are automatically unloaded after batch processing
   - For low-memory systems: use 'fast' preset

3. Parallelization:
   - parallel_frames > 1 enables concurrent OCR on multiple frames
   - Requires more RAM but significantly faster on multi-core CPUs
   - Recommended: 2-4 parallel workers for 8+ core CPUs

4. Engine Selection:
   - 'google' (Gemini direct): Best for clear, persistent subtitles
   - 'frame_sync': Best for transient subtitles or complex backgrounds
   - 'paddle': Best for CJK characters, works offline

5. Video Pre-processing:
   - Ensure video is H.264 encoded for fastest decoding
   - Lower resolution videos process faster
   - Consider pre-cropping to subtitle region if position is known
"""


def get_preset(name: str) -> PipelinePreset:
    """Get a preset by name."""
    presets = {
        "fast": PipelinePreset.fast,
        "balanced": PipelinePreset.balanced,
        "thorough": PipelinePreset.thorough,
        "high_performance": PipelinePreset.high_performance,
    }
    
    if name not in presets:
        logger.warning(f"Unknown preset '{name}', using 'balanced'")
        return PipelinePreset.balanced()
    
    return presets[name]()


def estimate_processing_time(video_duration: float, preset: PipelinePreset) -> float:
    """
    Estimate total processing time in seconds.
    
    Based on:
    - Frame extraction speed (~0.3x real-time)
    - OCR per-frame time (~0.5-2s depending on engine)
    - Post-processing overhead
    """
    num_frames = min(
        int(video_duration * preset.sample_fps),
        preset.max_keyframes
    )
    
    # Base extraction time (FFmpeg is fast)
    extraction_time = video_duration * 0.3
    
    # OCR time varies by engine
    ocr_time_per_frame = 1.0  # Average case
    ocr_time = num_frames * ocr_time_per_frame / preset.parallel_frames
    
    # Post-processing (voting, segmentation)
    post_processing_time = num_frames * 0.01
    
    total = extraction_time + ocr_time + post_processing_time
    return round(total, 1)


def recommend_preset(video_duration: float, available_memory_mb: int = 4096) -> PipelinePreset:
    """
    Recommend optimal preset based on video length and available memory.
    """
    if available_memory_mb < 2048:
        return PipelinePreset.fast()
    
    if video_duration > 600:  # > 10 minutes
        if available_memory_mb >= 8192:
            return PipelinePreset.high_performance()
        return PipelinePreset.balanced()
    
    if video_duration < 60:  # < 1 minute
        return PipelinePreset.fast()
    
    if available_memory_mb >= 8192:
        return PipelinePreset.thorough()
    
    return PipelinePreset.balanced()
