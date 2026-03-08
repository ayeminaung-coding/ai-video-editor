// TranslatePage.tsx - AI Chinese → Burmese Video Translation
// 5-step workflow: Upload → Smart Split → Translate → Edit SRT → Export

import React, { useState, useRef, useCallback } from 'react';
import {
    apiUploadVideo, apiSplitVideo, apiStartTranslation, apiPollUntilDone,
    type SplitResult as ApiSplitResult,
} from './translateApi';


// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface SplitResult {
    splitAt: number;   // seconds
    method: 'silence' | 'midpoint';
    part1Duration: number;
    part2Duration: number;
}

interface SrtLine {
    id: number;
    start: string;   // "HH:MM:SS,mmm"
    end: string;
    zh: string;
    my: string;
    part: 1 | 2;
}

type TranslateStatus = 'idle' | 'uploading' | 'splitting' | 'translating' | 'done' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function secondsToSrt(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function srtToSeconds(srt: string): number {
    const [time, ms] = srt.split(',');
    const [h, m, s] = time.split(':').map(Number);
    return h * 3600 + m * 60 + s + (Number(ms) / 1000);
}

function buildSrtContent(lines: SrtLine[], part: 1 | 2): string {
    return lines
        .filter(l => l.part === part)
        .map((l, i) => `${i + 1}\n${l.start} --> ${l.end}\n${l.my}\n`)
        .join('\n');
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




// ─── Sub-components ───────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ current: Step }> = ({ current }) => {
    const steps = [
        { n: 1, label: 'Upload' },
        { n: 2, label: 'Split' },
        { n: 3, label: 'Translate' },
        { n: 4, label: 'Edit SRT' },
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
                        <div className={`h-0.5 w-8 md:w-12 mb-4 rounded transition-all duration-500 ${s.n < current ? 'bg-accent-success' : 'bg-border-primary'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-surface-secondary rounded-2xl p-6 ${className}`}>{children}</div>
);

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

const UploadStep: React.FC<{
    onNext: (file: File, duration: number) => void;
}> = ({ onNext }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

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
                <h2 className="text-xl font-bold text-text-primary mb-1">Upload Your Video</h2>
                <p className="text-text-secondary text-sm">MP4 / MOV / WebM · Max 2 GB · Recommended 3–4 minutes</p>
            </div>

            {/* Drop zone */}
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
                        {duration > 0 && duration < 60 && (
                            <div className="text-accent-warning text-xs">⚠️ Video is shorter than 1 minute — translation may have fewer lines</div>
                        )}
                        {duration > 600 && (
                            <div className="text-accent-error text-xs">⚠️ Video exceeds 10 minutes — consider trimming first</div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-5xl">📤</div>
                        <div className="text-text-primary font-semibold">Drag & drop your video here</div>
                        <div className="text-text-secondary text-sm">or click to browse</div>
                        <div className="inline-block px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium pointer-events-none">
                            Choose File
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-accent-error/10 border border-accent-error/30 rounded-xl text-accent-error text-sm">
                    {error}
                </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { icon: '🇨🇳', label: 'Chinese text on screen', desc: 'Burned-in captions or subtitles' },
                    { icon: '🤖', label: 'Gemini 3.1 Flash Lite', desc: 'AI reads & translates visually' },
                    { icon: '🇲🇲', label: 'Natural Burmese', desc: 'Human-editable SRT output' },
                ].map(c => (
                    <div key={c.label} className="bg-surface-primary rounded-xl p-3 text-center">
                        <div className="text-2xl mb-1">{c.icon}</div>
                        <div className="text-xs font-medium text-text-primary">{c.label}</div>
                        <div className="text-xs text-text-tertiary mt-0.5">{c.desc}</div>
                    </div>
                ))}
            </div>

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

// ─── Step 2: Smart Split ──────────────────────────────────────────────────────

const SplitStep: React.FC<{
    file: File;
    videoId: string | null;
    duration: number;
    onNext: (split: SplitResult) => void;
    onBack: () => void;
    onVideoIdReady: (id: string) => void;
}> = ({ file, videoId, duration, onNext, onBack, onVideoIdReady }) => {
    const [detecting, setDetecting] = useState(false);
    const [split, setSplit] = useState<SplitResult | null>(null);
    const [manualSec, setManualSec] = useState<number>(Math.round(duration / 2));

    const detect = async () => {
        setDetecting(true);
        try {
            // Step 1: upload the file and get a video_id
            const { video_id } = await apiUploadVideo(file);
            onVideoIdReady(video_id);

            // Step 2: auto smart-split on the backend
            const res: ApiSplitResult = await apiSplitVideo(video_id);
            setSplit({
                splitAt: res.split_at,
                method: res.method,
                part1Duration: res.part1_duration,
                part2Duration: res.part2_duration,
            });
            setManualSec(Math.round(res.split_at));
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Split failed');
        } finally {
            setDetecting(false);
        }
    };

    const [error, setError] = useState<string | null>(null);

    const useManual = async () => {
        if (!videoId) {
            // If user hasn't auto-detected yet, upload first then force-split
            setDetecting(true);
            try {
                const { video_id } = await apiUploadVideo(file);
                onVideoIdReady(video_id);
                const res = await apiSplitVideo(video_id, manualSec);
                setSplit({
                    splitAt: res.split_at,
                    method: res.method,
                    part1Duration: res.part1_duration,
                    part2Duration: res.part2_duration,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Split failed');
            } finally {
                setDetecting(false);
            }
        } else {
            // Re-split with forced point
            setDetecting(true);
            try {
                const res = await apiSplitVideo(videoId, manualSec);
                setSplit({
                    splitAt: res.split_at,
                    method: res.method,
                    part1Duration: res.part1_duration,
                    part2Duration: res.part2_duration,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Split failed');
            } finally {
                setDetecting(false);
            }
        }
    };

    const pct = (split?.splitAt ?? manualSec) / duration * 100;

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Smart Split</h2>
                <p className="text-text-secondary text-sm">Find the best split point near the midpoint of your video</p>
            </div>

            {/* Video timeline visualizer */}
            <Card>
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-text-tertiary mb-2">
                        <span>0:00</span>
                        <span>{formatSeconds(duration / 2)} (midpoint)</span>
                        <span>{formatSeconds(duration)}</span>
                    </div>
                    <div className="relative h-10 bg-surface-primary rounded-xl overflow-hidden">
                        {/* Part 1 */}
                        <div
                            className="absolute left-0 top-0 h-full bg-accent-primary/30 flex items-center justify-center transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        >
                            <span className="text-xs font-medium text-accent-primary truncate px-2">
                                Part 1 — {formatSeconds(split?.splitAt ?? manualSec)}
                            </span>
                        </div>
                        {/* Part 2 */}
                        <div
                            className="absolute top-0 h-full bg-accent-secondary/20 flex items-center justify-center transition-all duration-500"
                            style={{ left: `${pct}%`, right: 0 }}
                        >
                            <span className="text-xs font-medium text-accent-secondary truncate px-2">
                                Part 2 — {formatSeconds(duration - (split?.splitAt ?? manualSec))}
                            </span>
                        </div>
                        {/* Split marker */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md transition-all duration-500"
                            style={{ left: `${pct}%` }}
                        />
                    </div>
                </div>

                {/* Detect button */}
                <button
                    onClick={detect}
                    disabled={detecting}
                    className="w-full py-2.5 bg-accent-secondary text-white rounded-xl text-sm font-semibold hover:bg-accent-secondary-dark transition-colors disabled:opacity-50"
                >
                    {detecting ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Detecting silence...
                        </span>
                    ) : '🔍 Auto-detect split point'}
                </button>

                {split && (
                    <div className={`mt-3 p-3 rounded-xl text-sm ${split.method === 'silence' ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-warning/10 text-accent-warning'}`}>
                        {split.method === 'silence'
                            ? `✅ Natural silence found at ${formatSeconds(split.splitAt)} — clean split point`
                            : `⚡ Using manual split at ${formatSeconds(split.splitAt)}`}
                    </div>
                )}
                {error && (
                    <div className="mt-3 p-3 rounded-xl text-sm bg-accent-error/10 text-accent-error">{error}</div>
                )}
            </Card>

            {/* Manual override */}
            <Card>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Manual Override</h3>
                <div className="space-y-3">
                    <input
                        type="range"
                        min={5} max={Math.round(duration) - 5} value={manualSec}
                        onChange={e => setManualSec(Number(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Split at: <span className="font-bold text-text-primary">{formatSeconds(manualSec)}</span></span>
                        <button onClick={useManual} className="px-3 py-1.5 bg-surface-tertiary text-text-primary rounded-lg hover:bg-border-primary transition-colors text-xs font-medium">
                            Use this point
                        </button>
                    </div>
                </div>
            </Card>

            <div className="flex gap-3">
                <button onClick={onBack} className="flex-1 py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors">
                    ← Back
                </button>
                <button
                    disabled={!split}
                    onClick={() => split && onNext(split)}
                    className="flex-[2] py-3 bg-accent-primary text-white rounded-xl font-semibold hover:bg-accent-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Translate with Gemini →
                </button>
            </div>
        </div>
    );
};

// ─── Step 3: Translating ──────────────────────────────────────────────────────
import { useSettings } from './contexts/SettingsContext';

const TranslatingStep: React.FC<{
    videoId: string;
    split: SplitResult;
    onDone: (lines: SrtLine[]) => void;
    onBack: () => void;
}> = ({ videoId, split, onDone, onBack }) => {
    const [phase, setPhase] = useState<'part1' | 'part2' | 'done'>('part1');
    const [p1Progress, setP1Progress] = useState(0);
    const [p2Progress, setP2Progress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const started = useRef(false);
    const pollCountRef = useRef(0);

    const { settings } = useSettings();

    const run = useCallback(async () => {
        if (started.current) return;
        started.current = true;

        try {
            // Start translation job on backend (runs in background) with our settings
            await apiStartTranslation(videoId, settings);

            // Poll every 5s. As polls accumulate, advance progress bars:
            //   Poll  0-20 (~0-100s): Part 1 active,  fill 0→95%
            //   Poll 20-40 (~100-200s): Part 2 active, fill 0→95%
            //   Poll 40+ : both hold at 95% until backend replies
            const result = await apiPollUntilDone(
                videoId,
                () => {
                    const n = ++pollCountRef.current;
                    if (n <= 20) {
                        // Part 1 filling up
                        setPhase('part1');
                        setP1Progress(Math.min(Math.round(n * 4.75), 95));
                    } else if (n <= 40) {
                        // Part 1 done visually, Part 2 filling up
                        setPhase('part2');
                        setP1Progress(100);
                        setP2Progress(Math.min(Math.round((n - 20) * 4.75), 95));
                    } else {
                        // Both holding at 95% — waiting for backend
                        setP1Progress(100);
                        setP2Progress(95);
                    }
                },
                5000,       // poll every 5 seconds
                900_000,    // 15-minute timeout (Gemini File API can be slow)
            );

            setP1Progress(100);
            setP2Progress(100);
            setPhase('done');

            // Map API response to SrtLine[]  
            const mapped: SrtLine[] = [
                ...(result.translation?.part1 ?? []).map((l, i) => ({
                    id: i + 1,
                    part: 1 as const,
                    start: secondsToSrt(l.start),
                    end: secondsToSrt(l.end),
                    zh: l.zh,
                    my: l.my,
                })),
                ...(result.translation?.part2 ?? []).map((l, i) => ({
                    id: 1000 + i + 1,
                    part: 2 as const,
                    start: secondsToSrt(l.start),
                    end: secondsToSrt(l.end),
                    zh: l.zh,
                    my: l.my,
                })),
            ];

            setTimeout(() => onDone(mapped), 600);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Translation failed';
            setErrorMsg(msg);
            console.error('Translation error:', err);
        }
    }, [videoId, onDone]);

    React.useEffect(() => { run(); }, [run]);

    const ProgressBar: React.FC<{ value: number; label: string; active: boolean; done: boolean }> = ({ value, label, active, done }) => (
        <div className={`p-4 rounded-xl border transition-all duration-300 ${active ? 'border-accent-primary bg-accent-primary/5' : done ? 'border-accent-success/30 bg-accent-success/5' : 'border-border-primary'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-text-primary">{label}</span>
                <span className={`text-xs font-bold ${done ? 'text-accent-success' : active ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                    {done ? '✓ Done' : active ? `${value}%` : 'Waiting...'}
                </span>
            </div>
            <div className="h-2 bg-surface-primary rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-accent-success' : 'bg-accent-primary'}`}
                    style={{ width: `${done ? 100 : value}%` }}
                />
            </div>
            {active && (
                <div className="mt-2 text-xs text-text-tertiary animate-pulse">
                    🤖 Reading Chinese text frames and translating to Burmese...
                </div>
            )}
        </div>
    );

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Translating with Gemini 3.1 Flash Lite</h2>
                <p className="text-text-secondary text-sm">AI is reading the Chinese text on each frame and generating Burmese translation</p>
            </div>

            {/* Gemini badge */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 rounded-xl border border-accent-primary/20">
                <div className="text-3xl">🤖</div>
                <div>
                    <div className="text-sm font-bold text-text-primary">Gemini 2.0 Flash</div>
                    <div className="text-xs text-text-secondary">Google AI Studio · Multimodal · OCR + Translation</div>
                </div>
                <div className="ml-auto">
                    <div className={`w-2 h-2 rounded-full ${errorMsg ? 'bg-accent-error' : 'bg-accent-success animate-pulse'}`} />
                </div>
            </div>

            <div className="space-y-3">
                <ProgressBar
                    label={`Part 1 — ${formatSeconds(split.part1Duration)}`}
                    value={p1Progress}
                    active={phase === 'part1'}
                    done={phase === 'part2' || phase === 'done'}
                />
                <ProgressBar
                    label={`Part 2 — ${formatSeconds(split.part2Duration)}`}
                    value={p2Progress}
                    active={phase === 'part2'}
                    done={phase === 'done'}
                />
            </div>

            {phase === 'done' && (
                <div className="p-4 bg-accent-success/10 border border-accent-success/30 rounded-xl text-accent-success text-sm font-semibold text-center animate-fade-in">
                    ✅ Translation complete! Loading editor...
                </div>
            )}

            {errorMsg && (
                <div className="p-4 bg-accent-error/10 border border-accent-error/30 rounded-xl animate-fade-in">
                    <p className="text-accent-error text-sm font-semibold mb-1">❌ Translation failed</p>
                    <p className="text-xs text-text-secondary">{errorMsg}</p>
                    <p className="text-xs text-text-tertiary mt-2">Click ← Back and try again.</p>
                </div>
            )}

            <div className="text-xs text-text-tertiary text-center">
                ℹ️ Translation timestamps may need minor adjustments in the editor
            </div>

            <button
                onClick={onBack}
                disabled={phase !== 'part1' && !errorMsg}
                className="w-full py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                ← Back
            </button>
        </div>
    );
};

// ─── Step 4: SRT Editor ───────────────────────────────────────────────────────

const SrtEditor: React.FC<{
    lines: SrtLine[];
    onChange: (lines: SrtLine[]) => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ lines, onChange, onNext, onBack }) => {
    const [activePart, setActivePart] = useState<1 | 2>(1);
    const [editingId, setEditingId] = useState<number | null>(null);

    const updateLine = (id: number, field: keyof SrtLine, value: string) => {
        onChange(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const deleteLine = (id: number) => onChange(lines.filter(l => l.id !== id));

    const addLine = () => {
        const partLines = lines.filter(l => l.part === activePart);
        const lastLine = partLines[partLines.length - 1];
        const newStart = lastLine ? srtToSeconds(lastLine.end) + 0.5 : 0;
        const newId = Math.max(...lines.map(l => l.id)) + 1;
        onChange([...lines, {
            id: newId,
            part: activePart,
            start: secondsToSrt(newStart),
            end: secondsToSrt(newStart + 3),
            zh: '',
            my: '',
        }]);
    };

    const displayLines = lines.filter(l => l.part === activePart);

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-text-primary mb-1">Edit Translation</h2>
                    <p className="text-text-secondary text-sm">Review and correct the Burmese translation</p>
                </div>
                <div className="text-xs text-text-tertiary bg-surface-secondary px-3 py-1.5 rounded-lg">
                    {lines.length} lines total
                </div>
            </div>

            {/* Part tabs */}
            <div className="flex gap-2 p-1 bg-surface-secondary rounded-xl">
                {([1, 2] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setActivePart(p)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activePart === p ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        Part {p} <span className="opacity-70 text-xs">({lines.filter(l => l.part === p).length} lines)</span>
                    </button>
                ))}
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[80px_1fr_1fr_36px] gap-2 px-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                <span>Timestamp</span>
                <span>🇨🇳 Chinese</span>
                <span>🇲🇲 Burmese (edit)</span>
                <span></span>
            </div>

            {/* Lines */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {displayLines.map(line => (
                    <div
                        key={line.id}
                        className={`grid grid-cols-[80px_1fr_1fr_36px] gap-2 p-3 rounded-xl border transition-all duration-150 ${editingId === line.id ? 'border-accent-primary bg-accent-primary/5' : 'border-border-primary bg-surface-primary hover:border-border-secondary'
                            }`}
                    >
                        {/* Timestamp */}
                        <div className="text-xs text-text-tertiary font-mono leading-tight pt-0.5">
                            <div>{line.start.split(',')[0]}</div>
                            <div className="text-text-tertiary/50">→ {line.end.split(',')[0]}</div>
                        </div>

                        {/* Chinese (read-only source) */}
                        <div className="text-sm text-text-secondary leading-snug pt-0.5 pr-2 border-r border-border-primary">
                            {line.zh || <span className="text-text-tertiary italic">—</span>}
                        </div>

                        {/* Burmese (editable) */}
                        <textarea
                            value={line.my}
                            onFocus={() => setEditingId(line.id)}
                            onBlur={() => setEditingId(null)}
                            onChange={e => updateLine(line.id, 'my', e.target.value)}
                            rows={2}
                            className="text-sm text-text-primary bg-transparent border-none outline-none resize-none w-full leading-snug"
                            placeholder="Type Burmese translation..."
                        />

                        {/* Delete */}
                        <button
                            onClick={() => deleteLine(line.id)}
                            className="self-start mt-0.5 p-1.5 text-text-tertiary hover:text-accent-error hover:bg-accent-error/10 rounded-lg transition-colors"
                            title="Delete line"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <button
                onClick={addLine}
                className="w-full py-2 border border-dashed border-border-secondary text-text-secondary rounded-xl text-sm hover:border-accent-primary hover:text-accent-primary transition-colors"
            >
                + Add line
            </button>

            <div className="flex gap-3">
                <button onClick={onBack} className="flex-1 py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors">
                    ← Back
                </button>
                <button
                    onClick={onNext}
                    className="flex-[2] py-3 bg-accent-primary text-white rounded-xl font-semibold hover:bg-accent-primary-dark transition-colors"
                >
                    Export SRT →
                </button>
            </div>
        </div>
    );
};

// ─── Step 5: Export ───────────────────────────────────────────────────────────

const ExportStep: React.FC<{
    lines: SrtLine[];
    file: File;
    split: SplitResult;
    onReset: () => void;
}> = ({ lines, file, split, onReset }) => {
    const [exported, setExported] = useState<string[]>([]);

    const doExport = (part: 1 | 2) => {
        const content = buildSrtContent(lines, part);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        downloadSrt(content, `${baseName}_part${part}.srt`);
        setExported(prev => [...new Set([...prev, `part${part}`])]);
    };

    const doExportAll = () => {
        // Merge both parts — adjust Part 2 timestamps by split offset
        const allContent = buildSrtContent(lines, 1) + '\n' + buildSrtContent(lines, 2);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        downloadSrt(allContent, `${baseName}_full.srt`);
        setExported(prev => [...new Set([...prev, 'full'])]);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Export SRT Files</h2>
                <p className="text-text-secondary text-sm">Download your translated subtitle files</p>
            </div>

            {/* Summary */}
            <Card>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-text-primary">{lines.length}</div>
                        <div className="text-xs text-text-secondary">Total lines</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-accent-primary">{lines.filter(l => l.part === 1).length}</div>
                        <div className="text-xs text-text-secondary">Part 1 lines</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-accent-secondary">{lines.filter(l => l.part === 2).length}</div>
                        <div className="text-xs text-text-secondary">Part 2 lines</div>
                    </div>
                </div>
            </Card>

            {/* Export buttons */}
            <div className="space-y-3">
                {([1, 2] as const).map(part => (
                    <button
                        key={part}
                        onClick={() => doExport(part)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200
              ${exported.includes(`part${part}`)
                                ? 'border-accent-success/40 bg-accent-success/5'
                                : 'border-border-primary bg-surface-primary hover:border-accent-primary hover:bg-accent-primary/5'}`}
                    >
                        <div className="text-2xl">{exported.includes(`part${part}`) ? '✅' : '📥'}</div>
                        <div className="flex-1">
                            <div className="font-semibold text-text-primary">
                                {file.name.replace(/\.[^.]+$/, '')}_part{part}.srt
                            </div>
                            <div className="text-xs text-text-secondary mt-0.5">
                                {formatSeconds(part === 1 ? split.part1Duration : split.part2Duration)} · {lines.filter(l => l.part === part).length} subtitle lines
                            </div>
                        </div>
                        <div className={`text-sm font-semibold ${exported.includes(`part${part}`) ? 'text-accent-success' : 'text-accent-primary'}`}>
                            {exported.includes(`part${part}`) ? 'Downloaded' : '↓ Download'}
                        </div>
                    </button>
                ))}

                <button
                    onClick={doExportAll}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200
            ${exported.includes('full')
                            ? 'border-accent-success/40 bg-accent-success/5'
                            : 'border-dashed border-accent-primary/40 bg-surface-primary hover:bg-accent-primary/5'}`}
                >
                    <div className="text-2xl">{exported.includes('full') ? '✅' : '📦'}</div>
                    <div className="flex-1">
                        <div className="font-semibold text-text-primary">
                            {file.name.replace(/\.[^.]+$/, '')}_full.srt
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5">Both parts merged · {lines.length} total lines</div>
                    </div>
                    <div className={`text-sm font-semibold ${exported.includes('full') ? 'text-accent-success' : 'text-accent-primary'}`}>
                        {exported.includes('full') ? 'Downloaded' : '↓ Download All'}
                    </div>
                </button>
            </div>

            {/* SRT preview */}
            <Card>
                <h3 className="text-sm font-semibold text-text-primary mb-3">SRT Preview (Part 1)</h3>
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-surface-primary rounded-lg p-3 max-h-40 overflow-y-auto leading-relaxed">
                    {buildSrtContent(lines, 1).slice(0, 400)}{lines.length > 3 ? '\n...' : ''}
                </pre>
            </Card>

            <button
                onClick={onReset}
                className="w-full py-3 bg-surface-secondary text-text-primary rounded-xl font-semibold hover:bg-surface-tertiary transition-colors"
            >
                ↺ Translate Another Video
            </button>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TranslatePage: React.FC = () => {
    const [step, setStep] = useState<Step>(1);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
    const [srtLines, setSrtLines] = useState<SrtLine[]>([]);

    const reset = () => {
        setStep(1);
        setVideoFile(null);
        setVideoDuration(0);
        setVideoId(null);
        setSplitResult(null);
        setSrtLines([]);
    };

    return (
        <div className="min-h-screen bg-bg-primary p-4 md:p-6">
            <div className="max-w-2xl mx-auto">
                {/* Page header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-xl">
                            🌏
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">AI Translate</h1>
                            <p className="text-text-secondary text-sm">Chinese → Burmese · Powered by Gemini 3.1 Flash Lite</p>
                        </div>
                    </div>
                </div>

                {/* Step indicator */}
                <StepIndicator current={step} />

                {/* Step content */}
                <div className="bg-surface-secondary rounded-2xl p-6">
                    {step === 1 && (
                        <UploadStep
                            onNext={(f, d) => { setVideoFile(f); setVideoDuration(d); setStep(2); }}
                        />
                    )}
                    {step === 2 && videoFile && (
                        <SplitStep
                            file={videoFile}
                            videoId={videoId}
                            duration={videoDuration}
                            onNext={s => { setSplitResult(s); setStep(3); }}
                            onBack={() => setStep(1)}
                            onVideoIdReady={setVideoId}
                        />
                    )}
                    {step === 3 && splitResult && videoId && (
                        <TranslatingStep
                            videoId={videoId}
                            split={splitResult}
                            onDone={lines => { setSrtLines(lines); setStep(4); }}
                            onBack={() => setStep(2)}
                        />
                    )}
                    {step === 4 && (
                        <SrtEditor
                            lines={srtLines}
                            onChange={setSrtLines}
                            onNext={() => setStep(5)}
                            onBack={() => setStep(3)}
                        />
                    )}
                    {step === 5 && videoFile && splitResult && (
                        <ExportStep
                            lines={srtLines}
                            file={videoFile}
                            split={splitResult}
                            onReset={reset}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranslatePage;
