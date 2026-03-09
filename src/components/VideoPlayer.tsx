import React, { useState } from 'react';
import { SubLine, SubStyle } from '../types/subtitle';
import SubtitleOverlay from './SubtitleOverlay';
import { formatTime } from '../utils/subtitleUtils';

const VideoPlayer: React.FC<{
    videoUrl: string;
    lines: SubLine[];
    offsetSec: number;
    subStyle: SubStyle;
    onTimeUpdate: (t: number) => void;
    onDuration: (d: number) => void;
    currentTime: number;
    videoRef: React.RefObject<HTMLVideoElement>;
}> = ({ videoUrl, lines, offsetSec, subStyle, onTimeUpdate, onDuration, currentTime, videoRef }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play(); setIsPlaying(true); }
        else { v.pause(); setIsPlaying(false); }
    };

    const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Number(e.target.value);
    };

    return (
        <div className="relative rounded-xl overflow-hidden bg-black group">
            <video
                ref={videoRef}
                src={videoUrl}
                className="w-full max-h-[400px] block"
                onTimeUpdate={() => onTimeUpdate(videoRef.current?.currentTime ?? 0)}
                onLoadedMetadata={() => {
                    const d = videoRef.current?.duration ?? 0;
                    setDuration(d);
                    onDuration(d);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
            />
            {/* Custom subtitle overlay */}
            <SubtitleOverlay
                lines={lines}
                currentTime={currentTime}
                offsetSec={offsetSec}
                style={subStyle}
            />

            {/* Controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <input
                    type="range" min={0} max={duration} step={0.1} value={currentTime}
                    onChange={seek}
                    className="w-full mb-2"
                />
                <div className="flex items-center justify-between">
                    <button onClick={togglePlay} className="text-white text-2xl w-10 h-10 flex items-center justify-center hover:text-accent-primary transition-colors">
                        {isPlaying ? '⏸' : '▶️'}
                    </button>
                    <span className="text-white text-xs font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
