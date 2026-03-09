// SubtitlePreviewPage.tsx - Video + SRT Subtitle Preview & Combination
// Loads a local video + SRT file, converts SRT→VTT, shows subtitles on video
// Supports timing offset, subtitle style controls, blur-rectangle, and export back to SRT

import React, { useState, useRef, useEffect } from 'react';

import { SubLine, SubStyle, BlurRectStyle } from './types/subtitle';
import { parseSrt, linesToVtt, linesToSrt, downloadText, formatTime, secToSrtTime, hmsToSec } from './utils/subtitleUtils';
import DropZone from './components/DropZone';
import VideoPlayer from './components/VideoPlayer';
import SubtitleOverlay from './components/SubtitleOverlay';

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
        blurRect: {
            enabled: false,
            xPct: 16,
            yPct: 82,
            widthPct: 66,
            heightPct: 13,
            opacity: 9,
            blurStrength: 4,
            color: '#ffffff',
        },
    });
    const [exportProgress, setExportProgress] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load video
    useEffect(() => {
        if (!videoFile) return;
        const url = URL.createObjectURL(videoFile);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [videoFile]);

    // Load & parse SRT – robust encoding detection (UTF-16 LE/BE, UTF-8, Latin-1)
    useEffect(() => {
        if (!srtFile) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const buf = e.target?.result as ArrayBuffer;
            const bytes = new Uint8Array(buf);

            let encoding = 'utf-8';
            if (bytes[0] === 0xFF && bytes[1] === 0xFE) encoding = 'utf-16le';
            else if (bytes[0] === 0xFE && bytes[1] === 0xFF) encoding = 'utf-16be';

            let text: string;
            try {
                text = new TextDecoder(encoding).decode(buf);
            } catch {
                text = new TextDecoder('utf-8').decode(buf);
            }

            const rawRows = text.split('\n');
            const parsed = parseSrt(text);

            // ── Temporary diagnostic alert ──────────────────────────────
            alert(
                `📋 SRT Parse Diagnostics\n\n` +
                `File: ${srtFile.name}\n` +
                `File size: ${srtFile.size} bytes\n` +
                `Encoding detected: ${encoding}\n` +
                `Raw lines after decode: ${rawRows.length}\n` +
                `Subtitle entries parsed: ${parsed.length}\n\n` +
                `── First 400 chars of decoded text ──\n` +
                text.substring(0, 400)
            );
            // ──────────────────────────────────────────────────────────

            setLines(parsed);
        };
        reader.readAsArrayBuffer(srtFile);
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

    const updateLineTime = (id: number, type: 'start' | 'end', hmsString: string) => {
        const parsedSec = hmsToSec(hmsString) - offsetSec;
        setLines(prev => prev.map(l => l.id === id ? { ...l, [type]: parsedSec } : l));
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

    const exportVideo = async () => {
        if (!videoFile || !srtFile) return;
        setIsExporting(true);
        setExportProgress(0);
        setExportError(null);

        try {
            const srtContent = linesToSrt(lines, offsetSec);
            const srtBlob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });

            const formData = new FormData();
            formData.append('video_file', videoFile);
            formData.append('srt_file', srtBlob, 'sub.srt');
            formData.append('font_size', subStyle.fontSize.toString());
            formData.append('color', subStyle.color);
            formData.append('position', subStyle.position);
            formData.append('bg_opacity', subStyle.bgOpacity.toString());
            // Blur rectangle params
            const br = subStyle.blurRect;
            formData.append('blur_rect_enabled', br.enabled ? 'true' : 'false');
            formData.append('blur_rect_x_pct', br.xPct.toString());
            formData.append('blur_rect_y_pct', br.yPct.toString());
            formData.append('blur_rect_width_pct', br.widthPct.toString());
            formData.append('blur_rect_height_pct', br.heightPct.toString());
            formData.append('blur_rect_opacity', br.opacity.toString());
            formData.append('blur_rect_blur', br.blurStrength.toString());
            formData.append('blur_rect_color', br.color);

            // 1. Start export job
            const startRes = await fetch('http://localhost:8000/api/video/export/start', {
                method: 'POST',
                body: formData,
            });

            if (!startRes.ok) {
                const text = await startRes.text();
                throw new Error(text || 'Failed to start export');
            }

            const { job_id } = await startRes.json();

            // 2. Poll for status
            while (true) {
                await new Promise(r => setTimeout(r, 1000));

                const statusRes = await fetch(`http://localhost:8000/api/video/export/status/${job_id}`);
                if (!statusRes.ok) throw new Error('Failed to get status');

                const statusData = await statusRes.json();

                if (statusData.status === 'error') {
                    throw new Error(statusData.error || 'Export failed during processing');
                }

                setExportProgress(statusData.progress || 0);

                if (statusData.status === 'done') {
                    break;
                }
            }

            // 3. Download the result
            const downloadRes = await fetch(`http://localhost:8000/api/video/export/download/${job_id}`);
            if (!downloadRes.ok) throw new Error('Failed to download final video');

            const blob = await downloadRes.blob();
            const url = URL.createObjectURL(blob);

            const baseName = videoFile.name.replace(/\.[^.]+$/, '');
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_subbed.mp4`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (err: any) {
            console.error('Export error:', err);
            setExportError(err.message);
        } finally {
            setIsExporting(false);
            setTimeout(() => setExportProgress(0), 3000);
        }
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

                                {/* Current subtitle display - editable inline */}
                                <div className={`p-4 rounded-xl border text-center transition-all duration-200 min-h-[64px] flex items-center justify-center
                  ${activeLine ? 'border-accent-primary/50 bg-accent-primary/10' : 'border-border-primary'}`}>
                                    {activeLine ? (
                                        <div className="w-full flex flex-col items-center">
                                            <textarea
                                                className="w-full text-center text-text-primary font-medium bg-transparent border-0 outline-none resize-none"
                                                rows={2}
                                                value={activeLine.text}
                                                onChange={(e) => updateLineText(activeLine.id, e.target.value)}
                                            />
                                            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-text-tertiary">
                                                <input
                                                    type="text"
                                                    value={secToSrtTime(activeLine.start + offsetSec).split(',')[0]}
                                                    onChange={e => updateLineTime(activeLine.id, 'start', e.target.value)}
                                                    className="w-32 bg-transparent border border-transparent hover:border-border-primary rounded px-1 text-center font-mono outline-none focus:border-accent-primary focus:bg-surface-primary"
                                                />
                                                <span className="opacity-50">→</span>
                                                <input
                                                    type="text"
                                                    value={secToSrtTime(activeLine.end + offsetSec).split(',')[0]}
                                                    onChange={e => updateLineTime(activeLine.id, 'end', e.target.value)}
                                                    className="w-32 bg-transparent border border-transparent hover:border-border-primary rounded px-1 text-center font-mono outline-none focus:border-accent-primary focus:bg-surface-primary"
                                                />
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
                                                {/* Editable Timestamps */}
                                                <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                                                    <input
                                                        type="text"
                                                        value={secToSrtTime(l.start + offsetSec).split(',')[0]}
                                                        onClick={e => { e.stopPropagation(); setEditingId(l.id); }}
                                                        onChange={e => updateLineTime(l.id, 'start', e.target.value)}
                                                        className="w-[4.5rem] bg-transparent border border-transparent hover:border-border-primary rounded px-1 text-center text-xs text-text-tertiary font-mono outline-none focus:border-accent-primary focus:bg-surface-primary"
                                                    />
                                                    <div className="flex bg-transparent text-xs text-text-tertiary font-mono px-1 items-center gap-1">
                                                        <span className="opacity-50">→</span>
                                                        <input
                                                            type="text"
                                                            value={secToSrtTime(l.end + offsetSec).split(',')[0]}
                                                            onClick={e => { e.stopPropagation(); setEditingId(l.id); }}
                                                            onChange={e => updateLineTime(l.id, 'end', e.target.value)}
                                                            className="flex-1 w-full bg-transparent border border-transparent hover:border-border-primary rounded px-1 text-center outline-none focus:border-accent-primary focus:bg-surface-primary"
                                                        />
                                                    </div>
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

                                {/* ── Subtitle Style ── */}
                                <div className="bg-surface-secondary rounded-xl p-4 space-y-5">
                                    <h3 className="text-sm font-semibold text-text-primary">💬 Subtitle Style</h3>

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

                                {/* ── Blur Rectangle Section ── */}
                                <div className="bg-surface-secondary rounded-xl p-4 space-y-4">
                                    {/* Header + toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-text-primary">🟫 Blur Rectangle</h3>
                                            <p className="text-xs text-text-tertiary mt-0.5">Cover original hardcoded subtitles in the video</p>
                                        </div>
                                        <button
                                            onClick={() => setSubStyle(s => ({ ...s, blurRect: { ...s.blurRect, enabled: !s.blurRect.enabled } }))}
                                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${subStyle.blurRect.enabled ? 'bg-accent-primary' : 'bg-surface-primary border border-border-primary'
                                                }`}
                                            aria-label="Toggle blur rectangle"
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${subStyle.blurRect.enabled ? 'translate-x-6' : 'translate-x-0'
                                                }`} />
                                        </button>
                                    </div>

                                    {subStyle.blurRect.enabled && (
                                        <div className="space-y-4">

                                            {/* ── Draggable Position Canvas ── */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Position &amp; Size</p>
                                                    <span className="text-xs text-text-tertiary font-mono">
                                                        x:{Math.round(subStyle.blurRect.xPct)}% y:{Math.round(subStyle.blurRect.yPct)}%
                                                        &nbsp;·&nbsp;
                                                        w:{Math.round(subStyle.blurRect.widthPct)}% h:{Math.round(subStyle.blurRect.heightPct)}%
                                                    </span>
                                                </div>
                                                {/* Canvas: 16:9 aspect ratio box; the user drags the rect inside it */}
                                                <div
                                                    id="blur-rect-canvas"
                                                    className="relative rounded-lg overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 border border-border-primary select-none"
                                                    style={{ aspectRatio: '16/9', cursor: 'crosshair' }}
                                                    onMouseDown={(downEvt) => {
                                                        const canvas = downEvt.currentTarget as HTMLDivElement;
                                                        const rect = canvas.getBoundingClientRect();
                                                        const br = subStyle.blurRect;

                                                        // Find if user clicked inside the rect handle or on canvas
                                                        const clickXPct = ((downEvt.clientX - rect.left) / rect.width) * 100;
                                                        const clickYPct = ((downEvt.clientY - rect.top) / rect.height) * 100;

                                                        const inRect =
                                                            clickXPct >= br.xPct && clickXPct <= br.xPct + br.widthPct &&
                                                            clickYPct >= br.yPct && clickYPct <= br.yPct + br.heightPct;

                                                        // Determine if click is near the resize handle (bottom-right corner ±8%)
                                                        const nearResizeX = Math.abs(clickXPct - (br.xPct + br.widthPct)) < 8;
                                                        const nearResizeY = Math.abs(clickYPct - (br.yPct + br.heightPct)) < 8;
                                                        const isResize = inRect && nearResizeX && nearResizeY;

                                                        let startX = downEvt.clientX;
                                                        let startY = downEvt.clientY;

                                                        const onMove = (moveEvt: MouseEvent) => {
                                                            const dx = ((moveEvt.clientX - startX) / rect.width) * 100;
                                                            const dy = ((moveEvt.clientY - startY) / rect.height) * 100;
                                                            startX = moveEvt.clientX;
                                                            startY = moveEvt.clientY;

                                                            setSubStyle(s => {
                                                                const b = s.blurRect;
                                                                if (isResize) {
                                                                    const newW = Math.min(100 - b.xPct, Math.max(5, b.widthPct + dx));
                                                                    const newH = Math.min(100 - b.yPct, Math.max(2, b.heightPct + dy));
                                                                    return { ...s, blurRect: { ...b, widthPct: Math.round(newW * 10) / 10, heightPct: Math.round(newH * 10) / 10 } };
                                                                } else {
                                                                    const newX = Math.min(100 - b.widthPct, Math.max(0, b.xPct + dx));
                                                                    const newY = Math.min(100 - b.heightPct, Math.max(0, b.yPct + dy));
                                                                    return { ...s, blurRect: { ...b, xPct: Math.round(newX * 10) / 10, yPct: Math.round(newY * 10) / 10 } };
                                                                }
                                                            });
                                                        };

                                                        const onUp = () => {
                                                            window.removeEventListener('mousemove', onMove);
                                                            window.removeEventListener('mouseup', onUp);
                                                        };

                                                        window.addEventListener('mousemove', onMove);
                                                        window.addEventListener('mouseup', onUp);
                                                        downEvt.preventDefault();
                                                    }}
                                                >
                                                    {/* Grid lines hint */}
                                                    <div className="absolute inset-0 opacity-10" style={{
                                                        backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                                                        backgroundSize: '25% 25%'
                                                    }} />

                                                    {/* The draggable blur rect */}
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${subStyle.blurRect.xPct}%`,
                                                            top: `${subStyle.blurRect.yPct}%`,
                                                            width: `${subStyle.blurRect.widthPct}%`,
                                                            height: `${subStyle.blurRect.heightPct}%`,
                                                            background: (() => {
                                                                const hex = subStyle.blurRect.color.replace('#', '');
                                                                const rr = parseInt(hex.substring(0, 2), 16) || 0;
                                                                const gg = parseInt(hex.substring(2, 4), 16) || 0;
                                                                const bb2 = parseInt(hex.substring(4, 6), 16) || 0;
                                                                return `rgba(${rr},${gg},${bb2},${subStyle.blurRect.opacity / 100})`;
                                                            })(),
                                                            backdropFilter: subStyle.blurRect.blurStrength > 0 ? `blur(${subStyle.blurRect.blurStrength}px)` : undefined,
                                                            border: '1.5px dashed rgba(255,255,255,0.7)',
                                                            cursor: 'move',
                                                            boxSizing: 'border-box',
                                                            minWidth: '12px',
                                                            minHeight: '6px',
                                                        }}
                                                    >
                                                        {/* Resize handle (bottom-right) */}
                                                        <div style={{
                                                            position: 'absolute', right: -4, bottom: -4,
                                                            width: 10, height: 10,
                                                            background: 'white',
                                                            border: '1.5px solid rgba(0,0,0,0.5)',
                                                            borderRadius: 2,
                                                            cursor: 'se-resize',
                                                        }} />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-text-tertiary mt-1">Drag to reposition · Drag corner ◽ to resize</p>
                                            </div>

                                            {/* ── Fill color + opacity row ── */}
                                            <div className="flex items-start gap-4">
                                                <div className="flex items-center gap-2 pt-1">
                                                    <label className="text-sm font-semibold text-text-primary whitespace-nowrap">Fill Color</label>
                                                    <input type="color" value={subStyle.blurRect.color}
                                                        onChange={e => setSubStyle(s => ({ ...s, blurRect: { ...s.blurRect, color: e.target.value } }))}
                                                        className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                                                        title="Blur rect fill color" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <label className="text-xs font-medium text-text-secondary">Opacity</label>
                                                        <span className="text-xs text-text-secondary font-mono">{subStyle.blurRect.opacity}%</span>
                                                    </div>
                                                    <input type="range" min={0} max={100} value={subStyle.blurRect.opacity}
                                                        onChange={e => setSubStyle(s => ({ ...s, blurRect: { ...s.blurRect, opacity: Number(e.target.value) } }))}
                                                        className="w-full" />
                                                </div>
                                            </div>

                                            {/* ── Blur strength ── */}
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-sm font-semibold text-text-primary">Blur Strength</label>
                                                    <span className="text-sm text-text-secondary font-mono">
                                                        {subStyle.blurRect.blurStrength === 0 ? 'Off' : `${subStyle.blurRect.blurStrength}px`}
                                                    </span>
                                                </div>
                                                <input type="range" min={0} max={30} value={subStyle.blurRect.blurStrength}
                                                    onChange={e => setSubStyle(s => ({ ...s, blurRect: { ...s.blurRect, blurStrength: Number(e.target.value) } }))}
                                                    className="w-full" />
                                                <p className="text-xs text-text-tertiary mt-1">0 = solid fill · higher = frosted glass blur</p>
                                            </div>

                                        </div>
                                    )}
                                </div>

                                {/* Live preview of subtitle style */}
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
                        <div className="space-y-3 pt-2 border-t border-border-primary">

                            {/* Export Progress Bar */}
                            {isExporting && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold text-text-secondary">
                                        <span>Exporting Video...</span>
                                        <span>{exportProgress.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent-success transition-all duration-300"
                                            style={{ width: `${exportProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 flex-col md:flex-row">
                                <button
                                    onClick={exportVideo}
                                    disabled={isExporting}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent-success text-white rounded-xl font-semibold hover:bg-accent-success/90 transition-colors text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isExporting ? '⏳ Processing...' : '🎬 Export Video + Subs'}
                                </button>
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
                        </div>

                        {exportError && (
                            <div className="text-sm text-accent-error p-3 bg-accent-error/10 rounded-xl mt-2 flex justify-between items-center">
                                <span>❌ Error: {exportError}</span>
                                <button onClick={() => setExportError(null)} className="text-xs hover:underline">Dismiss</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SubtitlePreviewPage;
