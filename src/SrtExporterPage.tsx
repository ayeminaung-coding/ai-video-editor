import React, { useEffect, useState, useRef, useMemo } from 'react';
import { apiUploadVideo, type SrtLineRaw } from './translateApi';
import { apiPollOcrStatus } from './ocrApi';
import { useSettings } from './contexts/SettingsContext';

type Step = 1 | 2 | 3 | 4 | 5;

interface SrtLine {
    id: number;
    start: string;   // "HH:MM:SS,mmm"
    end: string;
    text: string;    // Extracted text
    part: 1 | 2;
}

// Reuse helpers from Srt formatting
function formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function secondsToSrt(sec: number): string {
    const totalMs = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function buildSrtContent(lines: SrtLine[]): string {
    return lines
        .map((l, i) => `${i + 1}\n${l.start} --> ${l.end}\n${l.text}\n`)
        .join('\n');
}

function srtToSeconds(srt: string): number {
    const [hms, ms] = srt.split(',');
    if (!hms || !ms) return 0;
    const [h, m, s] = hms.split(':').map(Number);
    return (h * 3600) + (m * 60) + s + (Number(ms) / 1000);
}

function downloadSrt(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const StepIndicator: React.FC<{ current: Step }> = ({ current }) => {
    const steps = [
        { n: 1, label: 'Mode' },
        { n: 2, label: 'Upload' },
        { n: 3, label: 'OCR API' },
        { n: 4, label: 'Editor' },
        { n: 5, label: 'Export' },
    ];
    return (
        <div className="flex items-center justify-center mb-8 flex-wrap gap-2">
            {steps.map((s, i) => (
                <React.Fragment key={s.n}>
                    <div className="flex flex-col items-center gap-1">
                        <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${s.n < current
                                ? 'bg-accent-success text-white'
                                : s.n === current
                                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/30'
                                    : 'bg-surface-secondary text-text-tertiary'
                                }`}
                        >
                            {s.n < current ? '✓' : s.n}
                        </div>
                        <span className={`text-xs font-medium ${s.n === current ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                            {s.label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`h-0.5 w-6 md:w-10 mb-4 rounded transition-all duration-500 ${s.n < current ? 'bg-accent-success' : 'bg-border-primary'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-surface-secondary rounded-2xl p-6 ${className}`}>{children}</div>
);

// ─── Step 1: Subtitle Type ────────────────────────────────────────────────────
const SubtitleTypeStep: React.FC<{ onNext: (mode: 'hardcode' | 'softcode') => void }> = ({ onNext }) => {
    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Choose Extraction Mode</h2>
                <p className="text-text-secondary text-sm">How are the original subtitles stored on your video?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => onNext('hardcode')}
                    className="p-6 border-2 border-border-primary rounded-2xl bg-surface-primary hover:border-accent-primary hover:bg-accent-primary/5 transition-all duration-200 text-left group"
                >
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">🔥</div>
                    <div className="text-lg font-bold text-text-primary mb-2">Hardcoded Subtitles</div>
                    <div className="text-sm text-text-secondary leading-relaxed">
                        Text is burned directly into the video pixels. We will use AI Vision (OCR) to read the frames, extract the text, and map out the exact timestamps.
                    </div>
                </button>

                <button
                    onClick={() => alert("Softcode extraction is currently under development.")}
                    className="p-6 border-2 border-border-primary rounded-2xl bg-surface-primary opacity-60 hover:opacity-100 transition-all duration-200 text-left"
                >
                    <div className="text-4xl mb-4">🗂️</div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="text-lg font-bold text-text-primary">Softcoded Subtitles</div>
                        <span className="px-2 py-0.5 bg-surface-secondary rounded text-[10px] font-bold text-text-tertiary">COMING SOON</span>
                    </div>
                    <div className="text-sm text-text-secondary leading-relaxed">
                        Subtitles are stored as embedded metadata tracks (like an MKV file). We will simply demux the track into an SRT format instantly.
                    </div>
                </button>
            </div>
        </div>
    );
};

// ─── Step 2: Upload ───────────────────────────────────────────────────────────
const UploadStep: React.FC<{ onNext: (file: File, duration: number) => void }> = ({ onNext }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const handleFile = (f: File) => {
        if (!f.type.startsWith('video/')) { setError('Please select a video file (MP4, MOV, WebM)'); return; }
        if (f.size > 2 * 1024 * 1024 * 1024) { setError('File must be under 2 GB'); return; }
        setError(null);
        setFile(f);
        const url = URL.createObjectURL(f);
        const vid = document.createElement('video');
        vid.src = url;
        vid.onloadedmetadata = () => { setDuration(vid.duration); URL.revokeObjectURL(url); };
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Upload Your Video (Hardcode OCR)</h2>
                <p className="text-text-secondary text-sm">MP4 / MOV / WebM · Max 2 GB</p>
            </div>

            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer
          ${isDragging ? 'border-accent-primary bg-accent-primary/5 scale-[1.01]' : file ? 'border-accent-success bg-accent-success/5' : 'border-border-primary hover:border-accent-primary/50 hover:bg-surface-tertiary/30'}`}
            >
                <input
                    type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {file ? (
                    <div className="space-y-3">
                        <div className="text-5xl">🎬</div>
                        <div className="text-text-primary font-semibold text-lg">{file.name}</div>
                        <div className="flex items-center justify-center gap-4 text-sm text-text-secondary">
                            <span>⏱ {formatSeconds(duration)}</span>
                            <span>·</span>
                            <span>📦 {(file.size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-5xl">📤</div>
                        <div className="text-text-primary font-semibold">Drag & drop your video here</div>
                        <div className="text-text-secondary text-sm">or click to browse</div>
                    </div>
                )}
            </div>

            {error && <div className="p-3 bg-accent-error/10 border border-accent-error/30 rounded-xl text-accent-error text-sm">{error}</div>}

            <button
                disabled={!file || duration === 0}
                onClick={() => file && onNext(file, duration)}
                className="w-full py-3 bg-accent-primary text-white rounded-xl font-semibold hover:bg-accent-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Continue →
            </button>
        </div>
    );
};

// ─── Step 3: OCR Settings & Processing ────────────────────────────────────────
const OcrSettingsStep: React.FC<{
    file: File;
    duration: number;
    onDone: (lines: SrtLine[]) => void;
    onBack: () => void;
}> = ({ file, duration, onDone, onBack }) => {
    const { settings } = useSettings();
    const [engine, setEngine] = useState<'google' | 'frame_sync' | 'paddle'>('frame_sync');
    const [frameSyncProfile, setFrameSyncProfile] = useState<'fast' | 'balanced' | 'thorough'>('balanced');
    const [paddleLang, setPaddleLang] = useState<string>('ch');
    const [subtitlePosition, setSubtitlePosition] = useState<number>(1.0);
    const [subtitleBandRatio, setSubtitleBandRatio] = useState<number>(0.20);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
    const [progressPct, setProgressPct] = useState<number>(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [previewFrame, setPreviewFrame] = useState<string | null>(null);

    // Capture first frame of the video for the preview
    const videoUrl = useMemo(() => URL.createObjectURL(file), [file]);
    useEffect(() => {
        const vid = document.createElement('video');
        vid.src = videoUrl;
        vid.crossOrigin = 'anonymous';
        vid.currentTime = 1;
        vid.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(vid, 0, 0);
                setPreviewFrame(canvas.toDataURL('image/jpeg', 0.8));
            }
        };
        return () => { URL.revokeObjectURL(videoUrl); };
    }, [videoUrl]);

    const startOcr = async () => {
        try {
            setStatus('uploading');
            setProgressPct(0);
            const { video_id } = await apiUploadVideo(file);

            setStatus('processing');
            const res = await fetch(`/api/ocr/start/${video_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ engine, frameSyncProfile, paddleLang, subtitlePosition, subtitleBandRatio, ...settings })
            });
            if (!res.ok) throw new Error("Failed to start OCR pipeline");

            const finalStatus = await apiPollOcrStatus(video_id, (tick) => {
                const p = tick.ocr_progress ?? 0;
                setProgressPct(Math.max(0, Math.min(100, Math.round(p * 100))));
            });
            if (finalStatus.status === 'error') {
                throw new Error(finalStatus.error || 'OCR failed');
            }

            // Map backend shape to frontend SrtLine
            const rawLines = finalStatus.ocr_data || [];
            const mappedLines: SrtLine[] = rawLines.map((l: any, i: number) => {
                let startStr = String(l.start);
                let endStr = String(l.end);

                // If it doesn't contain a colon, it's likely a raw seconds float from the backend.
                if (!startStr.includes(':')) startStr = secondsToSrt(Number(l.start));
                if (!endStr.includes(':')) endStr = secondsToSrt(Number(l.end));

                return {
                    id: i + 1,
                    part: 1,
                    start: startStr,
                    end: endStr,
                    text: l.text
                };
            });

            setStatus('done');
            setProgressPct(100);
            setTimeout(() => onDone(mappedLines), 500);
        } catch (err: any) {
            setErrorMsg(err.message || 'Error occurred during OCR');
            setProgressPct(0);
            setStatus('idle');
        }
    };

    const PADDLE_LANGS = [
        { code: 'ch', label: '中文 Chinese' },
        { code: 'chinese_cht', label: '繁體中文 Traditional Chinese' },
        { code: 'japan', label: '日本語 Japanese' },
        { code: 'korean', label: '한국어 Korean' },
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français French' },
        { code: 'german', label: 'Deutsch German' },
        { code: 'it', label: 'Italiano Italian' },
        { code: 'es', label: 'Español Spanish' },
        { code: 'pt', label: 'Português Portuguese' },
        { code: 'ru', label: 'Русский Russian' },
        { code: 'ar', label: 'العربية Arabic' },
        { code: 'hi', label: 'हिन्दी Hindi' },
        { code: 'ta', label: 'தமிழ் Tamil' },
        { code: 'te', label: 'తెలుగు Telugu' },
    ];

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">OCR Engine Settings</h2>
                <p className="text-text-secondary text-sm">Choose the AI model to read text from your video frames</p>
            </div>

            <Card>
                <div className="space-y-4">
                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer ${engine === 'frame_sync' ? 'border-accent-primary bg-accent-primary/5' : 'border-border-primary bg-surface-primary'}`}>
                        <input type="radio" checked={engine === 'frame_sync'} onChange={() => setEngine('frame_sync')} className="w-5 h-5 accent-accent-primary" />
                        <div>
                            <div className="font-bold text-text-primary text-base">Frame Sync OCR (Recommended)</div>
                            <div className="text-sm text-text-secondary mt-0.5">Detect subtitle timing from frame changes, then OCR keyframes for text.</div>
                            {engine === 'frame_sync' && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFrameSyncProfile('fast')}
                                        className={`px-2 py-1 text-xs rounded border ${frameSyncProfile === 'fast' ? 'border-accent-primary text-accent-primary' : 'border-border-primary text-text-secondary'}`}
                                    >
                                        Fast
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFrameSyncProfile('balanced')}
                                        className={`px-2 py-1 text-xs rounded border ${frameSyncProfile === 'balanced' ? 'border-accent-primary text-accent-primary' : 'border-border-primary text-text-secondary'}`}
                                    >
                                        Balanced
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFrameSyncProfile('thorough')}
                                        className={`px-2 py-1 text-xs rounded border ${frameSyncProfile === 'thorough' ? 'border-accent-primary text-accent-primary' : 'border-border-primary text-text-secondary'}`}
                                    >
                                        Thorough (slow)
                                    </button>
                                </div>
                            )}
                        </div>
                    </label>

                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer ${engine === 'google' ? 'border-accent-primary bg-accent-primary/5' : 'border-border-primary bg-surface-primary'}`}>
                        <input type="radio" checked={engine === 'google'} onChange={() => setEngine('google')} className="w-5 h-5 accent-accent-primary" />
                        <div>
                            <div className="font-bold text-text-primary text-base">Google OCR (Single Pass)</div>
                            <div className="text-sm text-text-secondary mt-0.5">Faster, but timing is estimated by Gemini and less exact.</div>
                        </div>
                    </label>

                    <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer ${engine === 'paddle' ? 'border-accent-primary bg-accent-primary/5' : 'border-border-primary bg-surface-primary'}`}>
                        <input type="radio" checked={engine === 'paddle'} onChange={() => setEngine('paddle')} className="w-5 h-5 accent-accent-primary" />
                        <div className="flex-1">
                            <div className="font-bold text-text-primary text-base">Paddle OCR (Local)</div>
                            <div className="text-sm text-text-secondary mt-0.5">Runs completely offline on your device. Best for CJK (Chinese/Japanese/Korean) text. No API keys necessary.</div>
                            {engine === 'paddle' && (
                                <div className="mt-3">
                                    <div className="text-xs text-text-tertiary font-semibold mb-1.5 uppercase">Recognition Language</div>
                                    <select
                                        value={paddleLang}
                                        onChange={(e) => setPaddleLang(e.target.value)}
                                        className="w-full max-w-xs px-3 py-2 rounded-lg border border-border-primary bg-surface-primary text-sm text-text-primary outline-none focus:border-accent-primary transition-colors"
                                    >
                                        {PADDLE_LANGS.map(l => (
                                            <option key={l.code} value={l.code}>{l.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </label>
                </div>
            </Card>

            <Card>
                <div className="mb-4">
                    <h3 className="font-bold text-text-primary text-base">Subtitle Region</h3>
                    <p className="text-sm text-text-secondary mt-0.5">Fine-tune exactly which part of the frame is scanned for subtitles.</p>
                </div>

                {/* Real video frame preview with interactive scan-band overlay */}
                <div className="relative w-full rounded-lg overflow-hidden mb-5 border border-border-primary bg-black" style={{ aspectRatio: '16/9' }}>
                    {previewFrame ? (
                        <img src={previewFrame} alt="Video frame preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs">
                            Loading preview…
                        </div>
                    )}
                    {/* Scan-region overlay */}
                    <div
                        className="absolute left-0 right-0 transition-all duration-150 pointer-events-none"
                        style={{
                            top: `${Math.max(0, subtitlePosition - subtitleBandRatio) * 100}%`,
                            height: `${subtitleBandRatio * 100}%`,
                        }}
                    >
                        {/* Dimming above */}
                        <div className="absolute inset-0 bg-accent-primary/20 border-y-2 border-accent-primary" />
                        {/* Label */}
                        <div className="absolute right-1 top-0.5 text-[10px] font-bold text-accent-primary bg-black/60 px-1 rounded">OCR Region</div>
                    </div>
                    {/* Dim areas outside scan region */}
                    <div className="absolute top-0 left-0 right-0 bg-black/50 pointer-events-none transition-all duration-150"
                        style={{ height: `${Math.max(0, subtitlePosition - subtitleBandRatio) * 100}%` }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 pointer-events-none transition-all duration-150"
                        style={{ height: `${Math.max(0, 1 - subtitlePosition) * 100}%` }}
                    />
                </div>

                <div className="space-y-5">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-semibold text-text-secondary">Vertical Position</label>
                            <span className="text-xs font-mono text-accent-primary">
                                {subtitlePosition === 0.0 ? 'Top' : subtitlePosition === 1.0 ? 'Bottom' : `${Math.round(subtitlePosition * 100)}% from top`}
                            </span>
                        </div>
                        <input
                            type="range" min={0} max={100} step={1}
                            value={Math.round(subtitlePosition * 100)}
                            onChange={(e) => setSubtitlePosition(Number(e.target.value) / 100)}
                            className="w-full h-2 rounded-full appearance-none bg-surface-tertiary accent-accent-primary cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                            <span>Top</span><span>Middle</span><span>Bottom</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-semibold text-text-secondary">Band Height (scan area)</label>
                            <span className="text-xs font-mono text-accent-primary">{Math.round(subtitleBandRatio * 100)}% of frame</span>
                        </div>
                        <input
                            type="range" min={5} max={60} step={1}
                            value={Math.round(subtitleBandRatio * 100)}
                            onChange={(e) => setSubtitleBandRatio(Number(e.target.value) / 100)}
                            className="w-full h-2 rounded-full appearance-none bg-surface-tertiary accent-accent-primary cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                            <span>5% (thin)</span><span>30%</span><span>60% (tall)</span>
                        </div>
                    </div>

                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-xs text-text-tertiary self-center">Presets:</span>
                        {[
                            { label: '🔝 Top 20%', pos: 0.20, band: 0.20 },
                            { label: '📺 Middle', pos: 0.5, band: 0.20 },
                            { label: '⬇️ Bottom 20%', pos: 1.0, band: 0.20 },
                            { label: '⬇️ Bottom 30%', pos: 1.0, band: 0.30 },
                        ].map(p => (
                            <button
                                key={p.label} type="button"
                                onClick={() => { setSubtitlePosition(p.pos); setSubtitleBandRatio(p.band); }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-border-primary text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
                            >{p.label}</button>
                        ))}
                    </div>
                </div>
            </Card>

            {status !== 'idle' && (
                <div className="p-4 rounded-xl border border-accent-primary bg-accent-primary/5">
                    <div className="text-sm font-semibold text-accent-primary animate-pulse">
                        {status === 'uploading' ? 'Uploading video to server...' : status === 'processing' ? 'AI is analyzing frames...' : 'Finished!'}
                    </div>
                    {status === 'processing' && (
                        <div className="mt-2 text-xs text-text-secondary">Progress: {progressPct}%</div>
                    )}
                </div>
            )}

            {errorMsg && <div className="p-3 bg-accent-error/10 text-accent-error rounded-xl text-sm">{errorMsg}</div>}

            <div className="flex gap-3">
                <button disabled={status !== 'idle'} onClick={onBack} className="flex-1 py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors disabled:opacity-40">
                    ← Back
                </button>
                <button
                    disabled={status !== 'idle'}
                    onClick={startOcr}
                    className="flex-[2] py-3 bg-accent-primary text-white rounded-xl font-semibold hover:bg-accent-primary-dark transition-colors disabled:opacity-40"
                >
                    {status === 'idle' ? 'Start OCR Extraction' : 'Processing...'}
                </button>
            </div>
        </div>
    );
};

// ─── Step 4: SRT Editor ───────────────────────────────────────────────────────
const SrtEditor: React.FC<{
    lines: SrtLine[];
    file: File;
    onChange: (lines: SrtLine[]) => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ lines, file, onChange, onNext, onBack }) => {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [currentSec, setCurrentSec] = useState<number>(0);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const updateLine = (id: number, field: keyof SrtLine, value: string) => {
        onChange(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
    };
    const deleteLine = (id: number) => onChange(lines.filter(l => l.id !== id));
    const setTimeFromPreview = (id: number, field: 'start' | 'end') => {
        updateLine(id, field, secondsToSrt(currentSec));
    };

    // Add single line helper
    const addLine = () => {
        const lastLine = lines[lines.length - 1];
        const newStartSec = lastLine ? srtToSeconds(lastLine.end) + 0.5 : 0;
        const newId = lines.length ? Math.max(...lines.map(l => l.id)) + 1 : 1;

        onChange([...lines, {
            id: newId,
            part: 1,
            start: secondsToSrt(newStartSec),
            end: secondsToSrt(newStartSec + 3),
            text: ''
        }]);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <h2 className="text-xl font-bold text-text-primary mb-1">Edit Subtitles</h2>
            <p className="text-text-secondary text-sm">Play the video and use Now to set frame-accurate times from current playback.</p>

            <div className="p-3 rounded-xl border border-border-primary bg-surface-primary space-y-2">
                <video
                    src={videoUrl}
                    controls
                    className="w-full rounded-lg"
                    onTimeUpdate={(e) => setCurrentSec((e.target as HTMLVideoElement).currentTime)}
                />
                <div className="text-xs text-text-secondary font-mono">
                    Current video time: {secondsToSrt(currentSec)}
                </div>
            </div>

            <div className="grid grid-cols-[140px_140px_1fr_40px] gap-2 px-3 text-xs font-semibold text-text-tertiary uppercase">
                <span>Start</span>
                <span>End</span>
                <span>Text</span>
                <span></span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 pb-1">
                {lines.map(line => (
                    <div key={line.id} className="grid grid-cols-[140px_140px_1fr_40px] gap-2 p-2 rounded-xl border border-border-primary bg-surface-primary hover:border-accent-primary transition-colors hover:shadow-sm group items-start">
                        <div className="space-y-1">
                            <input
                                type="text"
                                value={line.start}
                                onChange={(e) => updateLine(line.id, 'start', e.target.value)}
                                className="w-full bg-transparent font-mono text-xs text-text-secondary border-b border-dashed border-border-secondary focus:border-accent-primary focus:text-text-primary outline-none py-1"
                            />
                            <button
                                onClick={() => setTimeFromPreview(line.id, 'start')}
                                className="text-[11px] px-2 py-1 rounded border border-border-primary hover:border-accent-primary hover:text-accent-primary transition-colors"
                            >
                                Now
                            </button>
                        </div>
                        <div className="space-y-1">
                            <input
                                type="text"
                                value={line.end}
                                onChange={(e) => updateLine(line.id, 'end', e.target.value)}
                                className="w-full bg-transparent font-mono text-xs text-text-secondary border-b border-dashed border-border-secondary focus:border-accent-primary focus:text-text-primary outline-none py-1"
                            />
                            <button
                                onClick={() => setTimeFromPreview(line.id, 'end')}
                                className="text-[11px] px-2 py-1 rounded border border-border-primary hover:border-accent-primary hover:text-accent-primary transition-colors"
                            >
                                Now
                            </button>
                        </div>
                        <textarea
                            value={line.text}
                            onChange={(e) => updateLine(line.id, 'text', e.target.value)}
                            rows={2}
                            className="bg-transparent text-sm text-text-primary border-none outline-none resize-none pt-0.5"
                        />
                        <button onClick={() => deleteLine(line.id)} className="p-2 text-text-tertiary hover:text-accent-error hover:bg-accent-error/10 rounded-lg">✕</button>
                    </div>
                ))}
            </div>

            <button onClick={addLine} className="w-full py-2 border border-dashed border-border-secondary text-text-secondary rounded-xl text-sm hover:border-accent-primary hover:text-accent-primary transition-colors">
                + Add Subtitle Row
            </button>

            <div className="flex gap-3 mt-4">
                <button onClick={onBack} className="flex-1 py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors">
                    ← Back
                </button>
                <button onClick={onNext} className="flex-[2] py-3 bg-accent-primary text-white rounded-xl font-semibold hover:bg-accent-primary-dark transition-colors">
                    Review Export →
                </button>
            </div>
        </div>
    );
};

// ─── Step 5: Export ───────────────────────────────────────────────────────────
const ExportStep: React.FC<{ lines: SrtLine[]; file: File; onReset: () => void; }> = ({ lines, file, onReset }) => {
    const doExport = () => {
        const content = buildSrtContent(lines);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        downloadSrt(content, `${baseName}-ocr.srt`);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-xl font-bold text-text-primary mb-1">Export SRT Files</h2>
            <Card>
                <button onClick={doExport} className="w-full flex items-center justify-between p-4 rounded-xl border border-border-primary bg-surface-primary hover:border-accent-primary transition-all">
                    <div>
                        <div className="font-semibold text-text-primary text-left">{file.name.replace(/\.[^.]+$/, '')}-ocr.srt</div>
                        <div className="text-xs text-text-secondary mt-1">{lines.length} lines total</div>
                    </div>
                    <div className="text-2xl">📥</div>
                </button>
            </Card>

            <button onClick={onReset} className="w-full py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors">
                ↺ Process Another Video
            </button>
        </div>
    );
};


export default function SrtExporterPage() {
    const [step, setStep] = useState<Step>(1);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [srtLines, setSrtLines] = useState<SrtLine[]>([]);

    const reset = () => {
        setStep(1);
        setVideoFile(null);
        setVideoDuration(0);
        setSrtLines([]);
    };

    return (
        <div className="min-h-screen bg-bg-primary p-4 md:p-6">
            <div className="max-w-2xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-xl">
                            📝
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">SRT Exporter</h1>
                            <p className="text-text-secondary text-sm">Extract hardcoded or softcoded text into SRT format.</p>
                        </div>
                    </div>
                </div>

                <StepIndicator current={step} />

                <div className="bg-surface-secondary rounded-2xl p-6">
                    {step === 1 && <SubtitleTypeStep onNext={(mode) => { setStep(2); }} />}
                    {step === 2 && <UploadStep onNext={(f, d) => { setVideoFile(f); setVideoDuration(d); setStep(3); }} />}
                    {step === 3 && videoFile && (
                        <OcrSettingsStep
                            file={videoFile} duration={videoDuration}
                            onDone={(lines) => { setSrtLines(lines); setStep(4); }}
                            onBack={() => setStep(2)}
                        />
                    )}
                    {step === 4 && videoFile && <SrtEditor lines={srtLines} file={videoFile} onChange={setSrtLines} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
                    {step === 5 && videoFile && <ExportStep lines={srtLines} file={videoFile} onReset={reset} />}
                </div>
            </div>
        </div>
    );
}

