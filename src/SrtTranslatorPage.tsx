// SrtTranslatorPage.tsx — SRT/TXT Subtitle Translator
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Language options ──────────────────────────────────────────────────────────
const LANGUAGES = [
    'Burmese',
    'Chinese (Simplified)',
    'Chinese (Traditional)',
    'English',
    'Thai',
    'Japanese',
    'Korean',
    'Vietnamese',
    'Indonesian',
    'Malay',
    'Hindi',
    'Arabic',
    'French',
    'Spanish',
    'Portuguese',
    'German',
    'Russian',
];


// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function previewLines(text: string, maxLines = 8): string[] {
    return text.split('\n').filter(l => l.trim()).slice(0, maxLines);
}

// ── Component ─────────────────────────────────────────────────────────────────
const SrtTranslatorPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [sourceLang, setSourceLang] = useState('Chinese (Simplified)');
    const [targetLang, setTargetLang] = useState('Burmese');
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptExpanded, setPromptExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progressPct, setProgressPct] = useState(0);
    const [progressStage, setProgressStage] = useState('');
    const [error, setError] = useState('');
    const [resultSrt, setResultSrt] = useState('');
    const [resultFilename, setResultFilename] = useState('');
    const [resultModelInfo, setResultModelInfo] = useState({ model: '', api: '' });
    const [blockCount, setBlockCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const crawlTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [apiSource, setApiSource] = useState<'gemini_api' | 'vertex_ai' | ''>('');
    const [availableModels, setAvailableModels] = useState<{ name: string; display_name: string; description: string }[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [customModel, setCustomModel] = useState('');

    // ── Fetch models ──────────────────────────────────────────────────────────
    useEffect(() => {
        const url = apiSource
            ? `http://localhost:8000/gemini/models?api_source=${apiSource}`
            : 'http://localhost:8000/gemini/models';

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (!apiSource) {
                    setApiSource(data.source ?? 'gemini_api');
                }
                if (data.models && Array.isArray(data.models)) {
                    setAvailableModels(data.models);
                    // Update selected model when the list changes
                    if (data.models.length > 0) {
                        setSelectedModel(data.models[0].name);
                    } else {
                        setSelectedModel('');
                    }
                }
            })
            .catch(() => { });
    }, [apiSource]);

    // ── Slow-crawl timer while AI is working (50→88%) ──────────────────────
    useEffect(() => {
        if (loading) {
            crawlTimerRef.current = setInterval(() => {
                setProgressPct(prev => {
                    if (prev >= 50 && prev < 88) return prev + 0.4;  // slow crawl
                    return prev;
                });
            }, 400);
        } else {
            if (crawlTimerRef.current) clearInterval(crawlTimerRef.current);
        }
        return () => { if (crawlTimerRef.current) clearInterval(crawlTimerRef.current); };
    }, [loading]);

    // ── File handling ────────────────────────────────────────────────────────────
    const acceptFile = useCallback((f: File) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!['srt', 'txt'].includes(ext ?? '')) {
            setError('Only .srt and .txt files are supported.');
            return;
        }
        setFile(f);
        setResultSrt('');
        setError('');
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) acceptFile(f);
        },
        [acceptFile],
    );

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) acceptFile(f);
        e.target.value = '';
    };

    // ── Translation ───────────────────────────────────────────────────────────
    const handleTranslate = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        setResultSrt('');
        setResultModelInfo({ model: '', api: '' });
        setProgressPct(10);
        setProgressStage('Uploading file…');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('source_lang', sourceLang);
            formData.append('target_lang', targetLang);
            formData.append('api_source', apiSource);
            formData.append('model', customModel.trim() || selectedModel);
            formData.append('custom_prompt', customPrompt);

            setProgressPct(25);
            setProgressStage('File received — parsing subtitles…');

            const res = await fetch('http://localhost:8000/srt-translator/translate', {
                method: 'POST',
                body: formData,
            });

            // Server responded — crawl timer handles 50→88%
            setProgressPct(50);
            setProgressStage('AI model is translating…');

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail ?? 'Translation failed.');
            }

            setProgressPct(92);
            setProgressStage('Processing response…');

            const count = res.headers.get('X-Block-Count');
            setBlockCount(count ? parseInt(count, 10) : 0);

            const blob = await res.blob();
            const text = await blob.text();
            setResultSrt(text);

            const cd = res.headers.get('Content-Disposition') ?? '';
            const match = cd.match(/filename="(.+?)"/);
            setResultFilename(match?.[1] ?? 'translated.srt');

            setResultModelInfo({
                model: res.headers.get('X-Model-Used') ?? 'Unknown Model',
                api: res.headers.get('X-API-Used') ?? 'Unknown API',
            });

            setProgressPct(100);
            setProgressStage('Translation complete ✔');
            await new Promise(r => setTimeout(r, 600));
        } catch (err: any) {
            setError(err.message ?? 'Unknown error occurred.');
            setProgressPct(0);
            setProgressStage('');
        } finally {
            setLoading(false);
        }
    };


    const handleDownload = () => {
        if (!resultSrt) return;
        const blob = new Blob([resultSrt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resultFilename || 'translated.srt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleReset = () => {
        setFile(null);
        setResultSrt('');
        setError('');
        setProgressPct(0);
        setProgressStage('');
        setCustomPrompt('');
        setPromptExpanded(false);
    };

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-bg-primary text-text-primary px-4 py-8 md:px-8">
            {/* ── Page header ── */}
            <div className="max-w-3xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-primary/15 text-xl">
                        🔤
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary tracking-tight">SRT Translator</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-text-secondary">
                                Translate subtitle files (.srt / .txt) using Gemini AI
                            </p>
                            {apiSource && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${apiSource === 'gemini_api'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                                    : 'bg-purple-500/10 text-purple-400 border-purple-500/25'
                                    }`}>
                                    {apiSource === 'gemini_api' ? '🔑 Google AI Studio' : '☁️ Vertex AI'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {/* Gradient divider */}
                <div className="h-px bg-gradient-to-r from-accent-primary/40 via-accent-primary/10 to-transparent mt-4" />
            </div>

            <div className="max-w-3xl mx-auto space-y-5">
                {/* ── Drop Zone ── */}
                <div
                    className={`
            relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
            p-10 cursor-pointer transition-all duration-200 group
            ${dragOver
                            ? 'border-accent-primary bg-accent-primary/10 scale-[1.01]'
                            : file
                                ? 'border-accent-primary/50 bg-accent-primary/5'
                                : 'border-border-primary hover:border-accent-primary/50 hover:bg-surface-secondary/50 bg-surface-primary'
                        }
          `}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    id="srt-drop-zone"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".srt,.txt"
                        className="hidden"
                        onChange={onFileInput}
                        id="srt-file-input"
                    />

                    {file ? (
                        <>
                            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent-primary/15 text-3xl">
                                {file.name.endsWith('.srt') ? '📝' : '📄'}
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-text-primary">{file.name}</p>
                                <p className="text-sm text-text-secondary mt-1">{formatBytes(file.size)}</p>
                            </div>
                            <button
                                className="text-xs text-accent-primary underline underline-offset-2 hover:text-accent-primary-dark transition-colors"
                                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                id="srt-remove-file"
                            >
                                Remove file
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-secondary text-3xl group-hover:scale-110 transition-transform duration-200">
                                📂
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-text-primary">
                                    Drop your subtitle file here
                                </p>
                                <p className="text-sm text-text-secondary mt-1">
                                    or <span className="text-accent-primary font-medium">click to browse</span>
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {['.srt', '.txt'].map(ext => (
                                    <span
                                        key={ext}
                                        className="text-xs font-mono px-2 py-0.5 rounded bg-surface-secondary text-text-tertiary border border-border-primary"
                                    >
                                        {ext}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Translation Settings ── */}
                <div className="rounded-2xl bg-surface-primary border border-border-primary p-5 space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-text-primary">Translation Settings</h2>
                            <p className="text-xs text-text-tertiary mt-0.5">Set the source and target languages, then choose an AI model.</p>
                        </div>
                        {apiSource && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${apiSource === 'gemini_api'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/25'
                                }`}>
                                {apiSource === 'gemini_api' ? '🔑 Google AI Studio' : '☁️ Vertex AI'}
                            </span>
                        )}
                    </div>
                    {/* Language selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Source language */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-text-secondary" htmlFor="source-lang">
                                📥 Source Language
                                <span className="ml-1 text-text-tertiary font-normal">(original file language)</span>
                            </label>
                            <select
                                id="source-lang"
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-shadow"
                                value={sourceLang}
                                onChange={e => setSourceLang(e.target.value)}
                            >
                                {LANGUAGES.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>

                        {/* Target language */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-text-secondary" htmlFor="target-lang">
                                📤 Target Language
                                <span className="ml-1 text-text-tertiary font-normal">(translate into)</span>
                            </label>
                            <select
                                id="target-lang"
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-shadow"
                                value={targetLang}
                                onChange={e => setTargetLang(e.target.value)}
                            >
                                {LANGUAGES.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* API Source & Model selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 top-border pt-4 border-t border-border-primary/50">
                        {/* API Source */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-text-secondary">
                                🔌 API Engine
                            </label>
                            <select
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-shadow"
                                value={apiSource}
                                onChange={e => setApiSource(e.target.value as 'gemini_api' | 'vertex_ai')}
                            >
                                <option value="gemini_api">🔑 Google AI Studio (API Key)</option>
                                <option value="vertex_ai">☁️ Vertex AI (GCP)</option>
                            </select>
                        </div>

                        {/* Model */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-text-secondary">
                                🧠 Gemini Model
                            </label>
                            <select
                                className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-shadow"
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                            >
                                {availableModels.map(m => (
                                    <option key={m.name} value={m.name}>
                                        {m.display_name}
                                    </option>
                                ))}
                            </select>
                            {/* Custom model override */}
                            <input
                                type="text"
                                placeholder="Or type custom model name (e.g. gemini-2.5-pro-preview-03-25)"
                                className="w-full px-3 py-2 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-xs placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-shadow"
                                value={customModel}
                                onChange={e => setCustomModel(e.target.value)}
                            />
                            {customModel.trim() && (
                                <p className="text-[10px] text-amber-400">
                                    ⚠️ Using custom model: <span className="font-mono">{customModel.trim()}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Swap languages */}
                    <div className="flex justify-center">
                        <button
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-text-secondary bg-surface-secondary border border-border-primary hover:text-accent-primary hover:border-accent-primary/50 transition-all duration-150"
                            onClick={() => { const tmp = sourceLang; setSourceLang(targetLang); setTargetLang(tmp); }}
                            id="srt-swap-langs"
                        >
                            ⇄ Swap languages
                        </button>
                    </div>

                    {/* Additional Instructions (custom prompt) */}
                    <div className="border border-border-primary rounded-xl overflow-hidden">
                        <button
                            id="srt-toggle-prompt"
                            type="button"
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors"
                            onClick={() => setPromptExpanded(p => !p)}
                        >
                            <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                ✏️ Additional Instructions
                                {customPrompt.trim() && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary text-[10px] font-bold">
                                        Active
                                    </span>
                                )}
                            </span>
                            <span className="text-text-tertiary text-xs transition-transform duration-200"
                                style={{ display: 'inline-block', transform: promptExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                                ▾
                            </span>
                        </button>

                        {promptExpanded && (
                            <div className="p-3 bg-surface-primary space-y-2">
                                <p className="text-xs text-text-tertiary">
                                    <span className="font-medium text-text-secondary">Optional.</span>{' '}
                                    Extra instructions appended <em>after</em> the main prompt — e.g. tone, register, or genre context. Core rules (no missing lines, JSON output) always apply.
                                </p>
                                <textarea
                                    id="srt-custom-prompt"
                                    rows={5}
                                    placeholder={`e.g. Use formal Burmese register for historical dramas. Preserve honorifics and royal-court language.`}
                                    className="w-full px-3 py-2.5 rounded-lg bg-surface-secondary border border-border-primary text-text-primary text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-shadow placeholder:text-text-tertiary"
                                    value={customPrompt}
                                    onChange={e => setCustomPrompt(e.target.value)}
                                />
                                {customPrompt.trim() && (
                                    <button
                                        type="button"
                                        className="text-xs text-text-tertiary hover:text-red-400 transition-colors"
                                        onClick={() => setCustomPrompt('')}
                                        id="srt-clear-prompt"
                                    >
                                        ✕ Clear
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
                        <span className="text-lg shrink-0">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* ── Translate button ── */}
                <button
                    id="srt-translate-btn"
                    disabled={!file || loading}
                    onClick={handleTranslate}
                    className={`
            w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
            flex items-center justify-center gap-2
            ${!file || loading
                            ? 'bg-surface-secondary text-text-tertiary border border-border-primary cursor-not-allowed'
                            : 'bg-accent-primary text-white shadow-lg shadow-accent-primary/25 hover:bg-accent-primary-dark hover:shadow-accent-primary/40 active:scale-[0.99]'
                        }
          `}
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Translating…
                        </>
                    ) : (
                        <>🔤 Translate Subtitle</>
                    )}
                </button>

                {/* ── Progress bar ── */}
                {(loading || progressPct === 100) && (
                    <div className="rounded-2xl bg-surface-primary border border-border-primary p-5 space-y-3">
                        {/* Stage label + percentage */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-secondary flex items-center gap-2">
                                {progressPct === 100 ? (
                                    <span className="text-green-400">✔</span>
                                ) : (
                                    <svg className="animate-spin w-3.5 h-3.5 text-accent-primary" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                )}
                                {progressStage || 'Starting…'}
                            </span>
                            <span className={`text-xs font-bold tabular-nums ${progressPct === 100 ? 'text-green-400' : 'text-accent-primary'
                                }`}>
                                {Math.round(progressPct)}%
                            </span>
                        </div>

                        {/* Bar track */}
                        <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${progressPct === 100
                                    ? 'bg-green-500'
                                    : 'bg-gradient-to-r from-accent-primary to-blue-500'
                                    }`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>

                        {/* Stage dots */}
                        <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                            {[
                                { label: 'Upload', at: 25 },
                                { label: 'Parse', at: 35 },
                                { label: 'AI', at: 50 },
                                { label: 'Done', at: 100 },
                            ].map(s => (
                                <span key={s.label} className={`flex items-center gap-1 ${progressPct >= s.at ? 'text-accent-primary' : ''
                                    }`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${progressPct >= s.at ? 'bg-accent-primary' : 'bg-surface-secondary'
                                        }`} />
                                    {s.label}
                                    {s.label !== 'Done' && <span className="mx-1 text-border-primary">—</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Result ── */}
                {resultSrt && (
                    <div className="rounded-2xl bg-surface-primary border border-border-primary overflow-hidden">
                        {/* Result header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary bg-surface-secondary/30">
                            <div className="flex items-center gap-2">
                                <span className="text-green-400 text-lg">✓</span>
                                <span className="text-sm font-semibold text-text-primary">Translation Complete</span>
                                {blockCount > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                                        {blockCount} blocks
                                    </span>
                                )}
                            </div>
                            <button
                                id="srt-download-btn"
                                onClick={handleDownload}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-primary-dark transition-colors shadow-sm"
                            >
                                ⬇ Download .srt
                            </button>
                        </div>

                        {/* Preview */}
                        <div className="p-5">
                            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
                                Preview (first lines)
                            </p>
                            <div className="rounded-xl bg-surface-secondary border border-border-primary p-4 space-y-1 max-h-60 overflow-y-auto font-mono text-xs leading-relaxed">
                                {previewLines(resultSrt, 20).map((line, i) => (
                                    <div
                                        key={i}
                                        className={
                                            /^\d+$/.test(line.trim())
                                                ? 'text-accent-primary/70 font-bold'
                                                : /-->/.test(line)
                                                    ? 'text-text-tertiary'
                                                    : 'text-text-primary'
                                        }
                                    >
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Translate again */}
                        <div className="px-5 pb-5">
                            <button
                                onClick={handleReset}
                                className="w-full py-2.5 rounded-xl text-sm font-medium text-text-secondary border border-border-primary hover:bg-surface-secondary hover:text-text-primary transition-all duration-150"
                                id="srt-translate-another"
                            >
                                Translate Another File
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Info card ── */}
                {!resultSrt && !loading && (
                    <div className="rounded-xl bg-surface-secondary/40 border border-border-primary/60 p-4">
                        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">How it works</p>
                        <ol className="text-xs text-text-secondary space-y-1.5 list-decimal list-inside">
                            <li>Upload an <span className="font-mono text-text-primary">.srt</span> or <span className="font-mono text-text-primary">.txt</span> subtitle file</li>
                            <li>Choose the source and target languages</li>
                            <li>Click <span className="font-medium text-text-primary">Translate Subtitle</span></li>
                            <li>Preview the result and download the translated <span className="font-mono text-text-primary">.srt</span> file</li>
                        </ol>
                        <p className="text-xs text-text-tertiary mt-3">
                            Translation uses your configured <span className="text-accent-primary font-medium">Gemini API key</span> or <span className="text-accent-primary font-medium">Vertex AI</span> credentials.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SrtTranslatorPage;
