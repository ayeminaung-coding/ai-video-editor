// SubtitlePreviewPage.tsx - Video + SRT Subtitle Preview & Combination
// Loads a local video + SRT file, converts SRT→VTT, shows subtitles on video
// Supports timing offset, subtitle style controls, and export back to SRT

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubLine {
    id: number;
    start: number;  // seconds
    end: number;    // seconds
    text: string;
}

interface SubStyle {
    fontSize: number;
    color: string;
    bgOpacity: number;
    position: 'bottom' | 'top';
}

// ─── SRT ↔ VTT Helpers ───────────────────────────────────────────────────────

function parseSrt(raw: string): SubLine[] {
    const blocks = raw.trim().split(/\r?\n\r?\n/);
    const lines: SubLine[] = [];
    for (const block of blocks) {
        const rows = block.trim().split(/\r?\n/);
        if (rows.length < 3) continue;
        const id = parseInt(rows[0], 10);
        const timeParts = rows[1].match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
        if (!timeParts) continue;
        const text = rows.slice(2).join('\n');
        lines.push({ id, start: srtTimeToSec(timeParts[1]), end: srtTimeToSec(timeParts[2]), text });
    }
    return lines;
}

function srtTimeToSec(t: string): number {
    const [hms, ms] = t.replace(',', '.').split('.');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number('0.' + ms);
}

function secToVttTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function secToSrtTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function linesToVtt(lines: SubLine[], offsetSec: number): string {
    let vtt = 'WEBVTT\n\n';
    for (const l of lines) {
        const s = Math.max(0, l.start + offsetSec);
        const e = Math.max(s + 0.1, l.end + offsetSec);
        vtt += `${l.id}\n${secToVttTime(s)} --> ${secToVttTime(e)}\n${l.text}\n\n`;
    }
    return vtt;
}

function linesToSrt(lines: SubLine[], offsetSec: number): string {
    return lines.map((l, i) => {
        const s = Math.max(0, l.start + offsetSec);
        const e = Math.max(s + 0.1, l.end + offsetSec);
        return `${i + 1}\n${secToSrtTime(s)} --> ${secToSrtTime(e)}\n${l.text}`;
    }).join('\n\n');
}

function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Custom subtitle overlay (more control than native <track>) ───────────────

const SubtitleOverlay: React.FC<{
    lines: SubLine[];
    currentTime: number;
    offsetSec: number;
    style: SubStyle;
}> = ({ lines, currentTime, offsetSec, style }) => {
    const activeLine = lines.find(l => {
        const s = l.start + offsetSec;
        const e = l.end + offsetSec;
        return currentTime >= s && currentTime <= e;
    });

    if (!activeLine) return null;

    const bgAlpha = style.bgOpacity / 100;

    return (
        <div
            className={`absolute left-0 right-0 flex justify-center pointer-events-none px-4 ${style.position === 'bottom' ? 'bottom-8' : 'top-4'}`}
        >
            <div
                style={{
                    background: `rgba(0,0,0,${bgAlpha})`,
                    color: style.color,
                    fontSize: `${style.fontSize}px`,
                    lineHeight: 1.4,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    maxWidth: '90%',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-line',
                }}
            >
                {activeLine.text}
            </div>
        </div>
    );
};

// ─── Video Player ─────────────────────────────────────────────────────────────

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
                    <button onClick={togglePlay} className="text-white text-lg w-8 h-8 flex items-center justify-center hover:text-accent-primary transition-colors">
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

// ─── Drop Zone ────────────────────────────────────────────────────────────────

const DropZone: React.FC<{
    accept: string;
    icon: string;
    label: string;
    sublabel: string;
    onFile: (f: File) => void;
    fileName?: string;
    color?: string;
}> = ({ accept, icon, label, sublabel, onFile, fileName, color = 'accent-primary' }) => {
    const [drag, setDrag] = useState(false);
    return (
        <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
        ${drag ? `border-${color} bg-${color}/5 scale-[1.01]` : fileName ? 'border-accent-success/50 bg-accent-success/5' : 'border-border-primary hover:border-border-secondary'}`}
        >
            <input type="file" accept={accept} className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <div className="text-2xl mb-1">{fileName ? '✅' : icon}</div>
            <div className="text-sm font-semibold text-text-primary truncate">
                {fileName ? fileName : label}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">{fileName ? 'Click to replace' : sublabel}</div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const SubtitlePreviewPage: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [srtFile, setSrtFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [lines, setLines] = useState<SubLine[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [offsetSec, setOffsetSec] = useState(0);
    const [activeTab, setActiveTab] = useState<'preview' | 'lines' | 'style'>('preview');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [subStyle, setSubStyle] = useState<SubStyle>({
        fontSize: 20,
        color: '#ffffff',
        bgOpacity: 70,
        position: 'bottom',
    });
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load video
    useEffect(() => {
        if (!videoFile) return;
        const url = URL.createObjectURL(videoFile);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [videoFile]);

    // Load & parse SRT
    useEffect(() => {
        if (!srtFile) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const parsed = parseSrt(text);
            setLines(parsed);
        };
        reader.readAsText(srtFile, 'utf-8');
    }, [srtFile]);

    const isReady = videoUrl && lines.length > 0;

    // Find active line for highlight in list
    const activeLine = lines.find(l => {
        const s = l.start + offsetSec;
        const e = l.end + offsetSec;
        return currentTime >= s && currentTime <= e;
    });

    // Jump to line
    const jumpTo = (line: SubLine) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = Math.max(0, line.start + offsetSec);
    };

    const updateLineText = (id: number, text: string) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, text } : l));
    };

    const exportSrt = () => {
        if (!srtFile) return;
        const content = linesToSrt(lines, offsetSec);
        const baseName = srtFile.name.replace(/\.[^.]+$/, '');
        downloadText(content, `${baseName}_adjusted.srt`);
    };

    const exportVtt = () => {
        if (!srtFile) return;
        const content = linesToVtt(lines, offsetSec);
        const baseName = srtFile.name.replace(/\.[^.]+$/, '');
        downloadText(content, `${baseName}.vtt`);
    };

    return (
        <div className="min-h-screen bg-bg-primary p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-secondary to-accent-primary flex items-center justify-center text-xl">
                        🎞️
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Subtitle Preview</h1>
                        <p className="text-text-secondary text-sm">Combine video + SRT · Preview · Adjust timing · Export</p>
                    </div>
                </div>

                {/* File loaders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DropZone
                        accept="video/*"
                        icon="🎬"
                        label="Drop video file"
                        sublabel="MP4 · MOV · WebM"
                        onFile={setVideoFile}
                        fileName={videoFile?.name}
                    />
                    <DropZone
                        accept=".srt,.vtt,.txt"
                        icon="📄"
                        label="Drop SRT / VTT file"
                        sublabel=".srt or .vtt subtitle file"
                        onFile={setSrtFile}
                        fileName={srtFile?.name}
                        color="accent-secondary"
                    />
                </div>

                {/* Status */}
                {!isReady && (
                    <div className="flex items-center gap-3 p-4 bg-surface-secondary rounded-xl text-sm text-text-secondary">
                        <span className="text-xl">💡</span>
                        <span>
                            {!videoFile && !srtFile ? 'Load a video and an SRT file to start previewing subtitles.' :
                                !videoFile ? 'Now load the video file.' :
                                    !srtFile ? 'Now load the SRT file.' :
                                        'Parsing SRT...'}
                        </span>
                    </div>
                )}

                {isReady && (
                    <>
                        {/* Tab bar */}
                        <div className="flex gap-2 p-1 bg-surface-secondary rounded-xl">
                            {(['preview', 'lines', 'style'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-200
                    ${activeTab === tab ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    {tab === 'preview' ? '▶ Preview' : tab === 'lines' ? '📝 Edit Lines' : '🎨 Style'}
                                </button>
                            ))}
                        </div>

                        {/* ── PREVIEW TAB ── */}
                        {activeTab === 'preview' && (
                            <div className="space-y-4 animate-fade-in">
                                <VideoPlayer
                                    videoUrl={videoUrl!}
                                    lines={lines}
                                    offsetSec={offsetSec}
                                    subStyle={subStyle}
                                    onTimeUpdate={setCurrentTime}
                                    onDuration={setDuration}
                                    currentTime={currentTime}
                                    videoRef={videoRef}
                                />

                                {/* Timing offset */}
                                <div className="bg-surface-secondary rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-text-primary">⏱ Subtitle Timing Offset</h3>
                                        <span className={`text-sm font-bold font-mono px-3 py-1 rounded-lg ${offsetSec > 0 ? 'bg-accent-success/10 text-accent-success' :
                                                offsetSec < 0 ? 'bg-accent-error/10 text-accent-error' :
                                                    'bg-surface-primary text-text-secondary'
                                            }`}>
                                            {offsetSec > 0 ? '+' : ''}{offsetSec.toFixed(1)}s
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={-10} max={10} step={0.1}
                                        value={offsetSec}
                                        onChange={e => setOffsetSec(Number(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-text-tertiary">
                                        <span>−10s (earlier)</span>
                                        <button onClick={() => setOffsetSec(0)} className="text-accent-primary hover:underline">Reset</button>
                                        <span>+10s (later)</span>
                                    </div>
                                </div>

                                {/* Current subtitle display */}
                                <div className={`p-4 rounded-xl border text-center transition-all duration-200 min-h-[64px] flex items-center justify-center
                  ${activeLine ? 'border-accent-primary/30 bg-accent-primary/5' : 'border-border-primary'}`}>
                                    {activeLine ? (
                                        <div>
                                            <div className="text-text-primary font-medium">{activeLine.text}</div>
                                            <div className="text-xs text-text-tertiary mt-1">
                                                {secToSrtTime(activeLine.start + offsetSec).split(',')[0]} → {secToSrtTime(activeLine.end + offsetSec).split(',')[0]}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-text-tertiary text-sm">▶ Play the video to see subtitles</div>
                                    )}
                                </div>

                                {/* Progress bar with subtitle markers */}
                                <div className="bg-surface-secondary rounded-xl p-4">
                                    <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Subtitle Track</h3>
                                    <div className="relative h-4 bg-surface-primary rounded-full overflow-hidden">
                                        {lines.map(l => {
                                            const s = Math.max(0, (l.start + offsetSec) / duration);
                                            const e = Math.min(1, (l.end + offsetSec) / duration);
                                            const isActive = activeLine?.id === l.id;
                                            return (
                                                <div
                                                    key={l.id}
                                                    className={`absolute top-0 h-full rounded-sm cursor-pointer transition-all duration-150
                            ${isActive ? 'bg-accent-primary' : 'bg-accent-primary/25 hover:bg-accent-primary/50'}`}
                                                    style={{ left: `${s * 100}%`, width: `${Math.max(0.5, (e - s) * 100)}%` }}
                                                    onClick={() => jumpTo(l)}
                                                    title={l.text}
                                                />
                                            );
                                        })}
                                        {/* Playhead */}
                                        {duration > 0 && (
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
                                                style={{ left: `${(currentTime / duration) * 100}%` }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex justify-between text-xs text-text-tertiary mt-1">
                                        <span>0:00</span>
                                        <span className="text-accent-primary">{lines.length} subtitle lines</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── EDIT LINES TAB ── */}
                        {activeTab === 'lines' && (
                            <div className="space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-text-secondary">{lines.length} lines · Click a line to jump to it in the video</p>
                                    <button
                                        onClick={() => {
                                            if (!videoRef.current) return;
                                            const t = videoRef.current.currentTime - offsetSec;
                                            const near = [...lines].sort((a, b) => Math.abs(a.start - t) - Math.abs(b.start - t))[0];
                                            if (near) setEditingId(near.id);
                                        }}
                                        className="text-xs text-accent-primary hover:underline"
                                    >
                                        Jump to current
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                    {lines.map(l => {
                                        const isActive = activeLine?.id === l.id;
                                        const isEditing = editingId === l.id;
                                        return (
                                            <div
                                                key={l.id}
                                                className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150
                          ${isActive ? 'border-accent-primary bg-accent-primary/5' : isEditing ? 'border-accent-secondary/50' : 'border-border-primary hover:border-border-secondary'}`}
                                                onClick={() => jumpTo(l)}
                                            >
                                                {/* Timestamp */}
                                                <div className="text-xs text-text-tertiary font-mono shrink-0 pt-0.5 leading-tight">
                                                    <div>{secToSrtTime(l.start + offsetSec).split(',')[0]}</div>
                                                    <div className="opacity-50">→ {secToSrtTime(l.end + offsetSec).split(',')[0]}</div>
                                                </div>

                                                {/* Editable text */}
                                                <textarea
                                                    value={l.text}
                                                    rows={2}
                                                    onClick={e => { e.stopPropagation(); setEditingId(l.id); }}
                                                    onChange={e => updateLineText(l.id, e.target.value)}
                                                    onBlur={() => setEditingId(null)}
                                                    className="flex-1 text-sm text-text-primary bg-transparent border-none outline-none resize-none leading-snug"
                                                    placeholder="Subtitle text..."
                                                />

                                                {isActive && (
                                                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-primary mt-2 self-start" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── STYLE TAB ── */}
                        {activeTab === 'style' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="bg-surface-secondary rounded-xl p-4 space-y-5">

                                    {/* Font size */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-semibold text-text-primary">Font Size</label>
                                            <span className="text-sm text-text-secondary font-mono">{subStyle.fontSize}px</span>
                                        </div>
                                        <input type="range" min={12} max={40} value={subStyle.fontSize}
                                            onChange={e => setSubStyle(s => ({ ...s, fontSize: Number(e.target.value) }))}
                                            className="w-full" />
                                    </div>

                                    {/* Background opacity */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-semibold text-text-primary">Background Opacity</label>
                                            <span className="text-sm text-text-secondary font-mono">{subStyle.bgOpacity}%</span>
                                        </div>
                                        <input type="range" min={0} max={100} value={subStyle.bgOpacity}
                                            onChange={e => setSubStyle(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                                            className="w-full" />
                                    </div>

                                    {/* Text color */}
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-text-primary">Text Color</label>
                                        <div className="flex items-center gap-3">
                                            {['#ffffff', '#ffff00', '#00ff88', '#ff6b6b', '#60a5fa'].map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setSubStyle(s => ({ ...s, color: c }))}
                                                    className={`w-7 h-7 rounded-full border-2 transition-all ${subStyle.color === c ? 'border-accent-primary scale-110' : 'border-transparent'}`}
                                                    style={{ background: c }}
                                                />
                                            ))}
                                            <input type="color" value={subStyle.color}
                                                onChange={e => setSubStyle(s => ({ ...s, color: e.target.value }))}
                                                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                                                title="Custom color" />
                                        </div>
                                    </div>

                                    {/* Position */}
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-text-primary">Position</label>
                                        <div className="flex gap-2">
                                            {(['bottom', 'top'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setSubStyle(s => ({ ...s, position: p }))}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all
                            ${subStyle.position === p ? 'bg-accent-primary text-white' : 'bg-surface-primary text-text-secondary hover:text-text-primary'}`}
                                                >
                                                    {p === 'bottom' ? '⬇ Bottom' : '⬆ Top'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Live preview of style */}
                                <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '120px' }}>
                                    <div className="absolute inset-0 flex items-center justify-center text-surface-tertiary text-sm">
                                        Video preview area
                                    </div>
                                    <SubtitleOverlay
                                        lines={[{ id: 0, start: 0, end: 999, text: 'ကျွန်တော်တို့ချန်နယ်မှ ကြိုဆိုပါတယ်' }]}
                                        currentTime={0}
                                        offsetSec={0}
                                        style={subStyle}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Export bar */}
                        <div className="flex gap-3 pt-2 border-t border-border-primary">
                            <button
                                onClick={exportSrt}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent-primary text-white rounded-xl font-semibold hover:bg-accent-primary-dark transition-colors text-sm"
                            >
                                📥 Export Adjusted SRT
                            </button>
                            <button
                                onClick={exportVtt}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors text-sm"
                            >
                                📄 Export as VTT
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SubtitlePreviewPage;
