// VideoPreview.tsx - AI Video Editor for TikTok
// React component for video preview with real-time editing effects

import React, { useState, useRef, useEffect } from 'react';

interface EditSettings {
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  brightness: number;
  contrast: number;
  textOverlay: string;
  music: string;
}

interface VideoPreviewProps {
  videoUrl: string;
  settings: EditSettings;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUrl, settings }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleError = () => {
      setError('Failed to load video');
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  // Apply settings to video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Apply speed
    video.playbackRate = settings.speed;

    // Apply volume
    video.volume = settings.volume;

    // Apply brightness and contrast using CSS filters
    const filter = `brightness(${settings.brightness}) contrast(${settings.contrast})`;
    video.style.filter = filter;

    // Apply trim (if video is playing)
    if (isPlaying) {
      const trimEndSeconds = (settings.trimEnd / 100) * duration;
      if (currentTime >= trimEndSeconds) {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [settings, currentTime, duration, isPlaying]);

  // Handle play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // Start from trim start if not at beginning
      const trimStartSeconds = (settings.trimStart / 100) * duration;
      if (currentTime < trimStartSeconds) {
        video.currentTime = trimStartSeconds;
      }
      video.play().catch(() => {
        setError('Failed to play video');
      });
      setIsPlaying(true);
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate trim markers
  const trimStartSeconds = (settings.trimStart / 100) * duration;
  const trimEndSeconds = (settings.trimEnd / 100) * duration;

  if (error) {
    return (
      <div className="aspect-video bg-surface-secondary rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-accent-error">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !videoUrl) {
    return (
      <div className="aspect-video bg-surface-secondary rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <p className="text-text-tertiary">
            {isLoading ? 'Loading video...' : 'No video selected'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          style={{
            filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`
          }}
        />
        
        {/* Text Overlay Preview */}
        {settings.textOverlay && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg">
            <p className="text-white text-lg font-medium text-center">
              {settings.textOverlay}
            </p>
          </div>
        )}

        {/* Play/Pause Button Overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
        >
          <div className="text-6xl text-white">
            {isPlaying ? '⏸️' : '▶️'}
          </div>
        </button>
      </div>

      {/* Progress Bar with Trim Markers */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-text-tertiary">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        <div className="relative">
          {/* Trim Markers */}
          <div className="absolute inset-0 flex">
            <div
              className="bg-surface-tertiary"
              style={{ width: `${settings.trimStart}%` }}
            />
            <div
              className="bg-accent-primary"
              style={{ width: `${settings.trimEnd - settings.trimStart}%` }}
            />
            <div
              className="bg-surface-tertiary"
              style={{ width: `${100 - settings.trimEnd}%` }}
            />
          </div>
          
          {/* Progress Bar */}
          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="relative w-full h-2 bg-transparent appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, 
                var(--accent-primary) 0%, 
                var(--accent-primary) ${(currentTime / duration) * 100}%, 
                var(--surface-tertiary) ${(currentTime / duration) * 100}%, 
                var(--surface-tertiary) 100%)`
            }}
          />
        </div>
      </div>

      {/* Edit Settings Preview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div className="bg-surface-secondary p-2 rounded">
          <span className="text-text-tertiary">Speed:</span>
          <span className="ml-1 text-text-primary">{settings.speed}x</span>
        </div>
        <div className="bg-surface-secondary p-2 rounded">
          <span className="text-text-tertiary">Volume:</span>
          <span className="ml-1 text-text-primary">{Math.round(settings.volume * 100)}%</span>
        </div>
        <div className="bg-surface-secondary p-2 rounded">
          <span className="text-text-tertiary">Brightness:</span>
          <span className="ml-1 text-text-primary">{Math.round(settings.brightness * 100)}%</span>
        </div>
        <div className="bg-surface-secondary p-2 rounded">
          <span className="text-text-tertiary">Contrast:</span>
          <span className="ml-1 text-text-primary">{Math.round(settings.contrast * 100)}%</span>
        </div>
      </div>

      {/* Trim Info */}
      <div className="bg-surface-secondary p-3 rounded-lg">
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-text-tertiary">Trim Start:</span>
            <span className="ml-1 text-text-primary">{formatTime(trimStartSeconds)}</span>
          </div>
          <div>
            <span className="text-text-tertiary">Trim End:</span>
            <span className="ml-1 text-text-primary">{formatTime(trimEndSeconds)}</span>
          </div>
          <div>
            <span className="text-text-tertiary">Duration:</span>
            <span className="ml-1 text-text-primary">
              {formatTime(trimEndSeconds - trimStartSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Music Info */}
      {settings.music && (
        <div className="bg-surface-secondary p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎵</span>
            <div>
              <p className="text-sm text-text-tertiary">Music:</p>
              <p className="text-text-primary font-medium">
                {settings.music === 'custom' ? 'Custom Music' : settings.music}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;