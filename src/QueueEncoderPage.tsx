import React, { useEffect, useState } from 'react';
import MultiDropZone from './components/MultiDropZone';
import { SubStyle } from './types/subtitle';

interface JobPair {
  id: string;
  videoFile?: File;
  srtFile?: File;
  name: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  progress: number;
  job_id?: string;
}

const QueueEncoderPage: React.FC = () => {
    const [jobs, setJobs] = useState<JobPair[]>([]);
    const [activeTab, setActiveTab] = useState<'queue' | 'style'>('queue');

    useEffect(() => {
        const interval = setInterval(async () => {
            const activeJobs = jobs.filter(j => j.job_id && (j.status === 'queued' || j.status === 'started'));
            if (activeJobs.length === 0) return;
            
            try {
                const jobIds = activeJobs.map(j => j.job_id).join(',');
                const res = await fetch(`/api/queue_encoder/status?job_ids=${jobIds}`);
                const data = await res.json();
                
                setJobs(prev => prev.map(job => {
                    if (!job.job_id) return job;
                    const remoteData = data.statuses.find((s: any) => s.job_id === job.job_id);
                    if (!remoteData) return job;
                    
                    return {
                        ...job,
                        status: remoteData.status === 'not_found' ? 'failed' : remoteData.status,
                        progress: remoteData.progress || 0
                    };
                }));
            } catch (err) {
                console.error("Failed to fetch jobs status", err);
            }
        }, 1500);

        return () => clearInterval(interval);
    }, [jobs]);

    const [subStyle, setSubStyle] = useState<SubStyle>({
        fontSize: 25,
        color: '#ffffff',
        bgOpacity: 0,
        strokeEnabled: true,
        strokeColor: '#000000',
        strokeSize: 4,
        alignment: 2,
        marginV: 7,
        marginH: 15,
        paddingH: 15,
        paddingV: 10,
        blurRect: {
            enabled: true,
            xPct: 11,
            yPct: 86,
            widthPct: 79,
            heightPct: 13,
            opacity: 21,
            blurStrength: 13,
            color: '#ffffff',
        },
        watermark: {
            enabled: true,
            text: '@WhiteCatDrama',
            xPct: 10,
            yPct: 49,
            fontSize: 17,
            color: '#ffffff',
            opacity: 21,
        }
    });

    const handleUpload = (files: File[]) => {
        setJobs(prev => {
            const next = [...prev];
            
            const vids = files.filter(f => f.name.toLowerCase().match(/\.(mp4|mov|mkv)$/));
            const subs = files.filter(f => f.name.toLowerCase().match(/\.(srt|txt)$/));

            // Smart pair if exactly 1 video and 1 sub are dropped perfectly together
            if (vids.length === 1 && subs.length === 1) {
                const baseName = vids[0].name.replace(/\.[^/.]+$/, '');
                let job = next.find(j => j.name === baseName);
                if (!job) {
                    job = { id: Date.now().toString() + Math.random(), name: baseName, status: 'queued', progress: 0 };
                    next.push(job);
                }
                job.videoFile = vids[0];
                job.srtFile = subs[0];
                return next;
            }

            // Group by basename
            files.forEach(f => {
                const isSrt = f.name.toLowerCase().endsWith('.srt') || f.name.toLowerCase().endsWith('.txt');
                const isVideo = f.name.toLowerCase().endsWith('.mp4') || f.name.toLowerCase().endsWith('.mov') || f.name.toLowerCase().endsWith('.mkv');
                
                if (!isSrt && !isVideo) return;
                
                const baseName = f.name.replace(/\.[^/.]+$/, '');
                
                let job = next.find(j => j.name === baseName);
                if (!job) {
                    job = { id: Date.now().toString() + Math.random(), name: baseName, status: 'queued', progress: 0 };
                    next.push(job);
                }
                
                if (isVideo) job.videoFile = f;
                if (isSrt) job.srtFile = f;
            });
            
            return next;
        });
    };

    const runAll = async () => {
        for (const job of jobs) {
            if (job.status !== 'finished' && job.videoFile && job.srtFile) {
                const formData = new FormData();
                formData.append("video_file", job.videoFile);
                formData.append("srt_file", job.srtFile);
                
                formData.append("font_size", String(subStyle.fontSize));
                formData.append("color", subStyle.color);
                formData.append("alignment", String(subStyle.alignment));
                formData.append("bg_opacity", String(subStyle.bgOpacity));
                formData.append("font_name", "Padauk");
                
                formData.append("stroke_enabled", String(subStyle.strokeEnabled));
                formData.append("stroke_color", subStyle.strokeColor);
                formData.append("stroke_size", String(subStyle.strokeSize));
                
                formData.append("margin_v", String(subStyle.marginV));
                formData.append("margin_h", String(subStyle.marginH));
                formData.append("padding_h", String(subStyle.paddingH));
                formData.append("padding_v", String(subStyle.paddingV));
                
                if (subStyle.blurRect) {
                    formData.append("blur_rect_enabled", String(subStyle.blurRect.enabled));
                    formData.append("blur_rect_x_pct", String(subStyle.blurRect.xPct));
                    formData.append("blur_rect_y_pct", String(subStyle.blurRect.yPct));
                    formData.append("blur_rect_width_pct", String(subStyle.blurRect.widthPct));
                    formData.append("blur_rect_height_pct", String(subStyle.blurRect.heightPct));
                    formData.append("blur_rect_opacity", String(subStyle.blurRect.opacity));
                    formData.append("blur_rect_blur", String(subStyle.blurRect.blurStrength));
                    formData.append("blur_rect_color", subStyle.blurRect.color || '#ffffff');
                }
                
                if (subStyle.watermark) {
                     formData.append("watermark_enabled", String(subStyle.watermark.enabled));
                     formData.append("watermark_text", subStyle.watermark.text);
                     formData.append("watermark_x_pct", String(subStyle.watermark.xPct));
                     formData.append("watermark_y_pct", String(subStyle.watermark.yPct));
                     formData.append("watermark_font_size", String(subStyle.watermark.fontSize));
                     formData.append("watermark_color", subStyle.watermark.color);
                     formData.append("watermark_opacity", String(subStyle.watermark.opacity));
                }

                try {
                    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'started', progress: 0 } : j));
                    const res = await fetch("/api/queue_encoder/start", {
                        method: "POST",
                        body: formData,
                    });
                    if (!res.ok) {
                        const errText = await res.text();
                        console.error("Upload failed details:", errText);
                        throw new Error("Upload failed");
                    }
                    const data = await res.json();
                    
                    setJobs(prev => prev.map(j => 
                        j.id === job.id ? { ...j, job_id: data.job_id, status: 'queued' } : j
                    ));
                } catch (e) {
                    console.error("Task start failed", e);
                    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed' } : j));
                }
            }
        }
    };

    const clearQueue = () => setJobs([]);

    const handleAttach = (jobId: string, type: 'video' | 'srt', file: File) => {
        setJobs(prev => prev.map(job => {
            if (job.id === jobId) {
                const updated = { ...job, [type === 'video' ? 'videoFile' : 'srtFile']: file };
                if (type === 'video' && !job.videoFile) updated.name = file.name.replace(/\.[^/.]+$/, '');
                return updated;
            }
            return job;
        }));
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            <header className="px-6 py-4 bg-surface-primary border-b border-border-primary flex-shrink-0 flex justify-between items-center z-10">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-text-primary">Queue Encoder + Subs</h1>
                    <p className="text-sm text-text-secondary mt-1">
                        Batch encode videos with subtitles (SRT/TXT) using a queued worker
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={clearQueue}
                        disabled={jobs.length === 0}
                        className="btn btn-secondary px-4 py-2"
                    >
                        Clear Queue
                    </button>
                    <button
                        onClick={runAll}
                        disabled={jobs.length === 0}
                        className="btn btn-primary px-4 py-2 flex items-center gap-2"
                    >
                        ▶ Start Encoding
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6 bg-surface-secondary/30">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Tabs */}
                        <div className="flex gap-4 border-b border-border-primary hidden">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 
                                ${activeTab === 'queue' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                            >
                                Queue Management
                            </button>
                            <button
                                onClick={() => setActiveTab('style')}
                                className={`pb-3 px-2 font-medium text-sm transition-colors border-b-2 
                                ${activeTab === 'style' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                            >
                                Style Customization
                            </button>
                        </div>
                        
                        <div className="bg-surface-primary border border-border-primary rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-border-primary">
                                <MultiDropZone
                                    accept=".mp4,.mov,.mkv,.srt,.txt"
                                    icon="🎞️📝"
                                    label="Drop Videos and SRTs here"
                                    sublabel="Supports .mp4, .mov, .mkv, .srt, .txt"
                                    onFiles={handleUpload}
                                />
                            </div>
                            
                            <div className="p-0 max-h-[500px] overflow-y-auto">
                                {jobs.length === 0 ? (
                                    <div className="p-8 text-center text-text-secondary">
                                        <p>No jobs queued.</p>
                                        <p className="text-sm mt-1">Upload videos and identically named SRT files to pair them.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border-primary">
                                        {jobs.map(job => (
                                            <div key={job.id} className="p-4 flex items-center gap-4 hover:bg-surface-secondary/50 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-text-primary truncate">{job.name}</div>
                                                    <div className="flex gap-2 text-xs mt-1">
                                                        {job.videoFile ? (
                                                            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 truncate max-w-[200px]" title={job.videoFile.name}>
                                                                ✓ {job.videoFile.name}
                                                            </span>
                                                        ) : (
                                                            <label className="cursor-pointer px-2 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                                                                <input type="file" accept=".mp4,.mov,.mkv" className="hidden" onChange={e => {
                                                                    if (e.target.files?.[0]) handleAttach(job.id, 'video', e.target.files[0]);
                                                                    e.target.value = '';
                                                                }} />
                                                                ✗ Attach Video
                                                            </label>
                                                        )}

                                                        {job.srtFile ? (
                                                            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 truncate max-w-[200px]" title={job.srtFile.name}>
                                                                ✓ {job.srtFile.name}
                                                            </span>
                                                        ) : (
                                                            <label className="cursor-pointer px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors">
                                                                <input type="file" accept=".srt,.txt" className="hidden" onChange={e => {
                                                                    if (e.target.files?.[0]) handleAttach(job.id, 'srt', e.target.files[0]);
                                                                    e.target.value = '';
                                                                }} />
                                                                ⚠ Attach Sub
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="w-32 flex flex-col items-end">
                                                    <span className={`text-sm font-medium
                                                        ${job.status === 'finished' ? 'text-green-500' : ''}
                                                        ${job.status === 'failed' ? 'text-red-500' : ''}
                                                        ${job.status === 'started' ? 'text-accent-primary' : ''}
                                                        ${job.status === 'queued' ? 'text-text-secondary' : ''}
                                                    `}>
                                                        {job.status.toUpperCase()}
                                                    </span>
                                                    {job.status === 'started' && (
                                                        <div className="w-full bg-surface-secondary rounded-full h-1.5 mt-2 overflow-hidden">
                                                            <div 
                                                                className="bg-accent-primary h-full transition-all duration-300" 
                                                                style={{ width: `${job.progress}%` }} 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {job.status === 'finished' && job.job_id && (
                                                    <a
                                                        href={`/api/queue_encoder/download/${job.job_id}`}
                                                        download
                                                        className="p-2 text-accent-primary hover:text-accent-secondary transition-colors"
                                                        title="Download Video"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                    </a>
                                                )}

                                                <button
                                                    onClick={() => setJobs(prev => prev.filter(j => j.id !== job.id))}
                                                    className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                                                    title="Remove job"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                <aside className="w-80 lg:w-96 border-l border-border-primary bg-surface-primary flex flex-col items-stretch overflow-y-auto z-10">
                    <div className="p-4 border-b border-border-primary flex-shrink-0 sticky top-0 bg-surface-primary/95 backdrop-blur z-20">
                        <h2 className="text-sm font-bold text-text-primary tracking-wide">Export Style Customization</h2>
                    </div>
                
                    <div className="p-4 space-y-4 animate-fade-in">
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

                            {/* Horizontal padding */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-semibold text-text-primary">Horizontal Padding</label>
                                    <span className="text-sm text-text-secondary font-mono">{subStyle.paddingH}px</span>
                                </div>
                                <input type="range" min={0} max={60} value={subStyle.paddingH}
                                    onChange={e => setSubStyle(s => ({ ...s, paddingH: Number(e.target.value) }))}
                                    className="w-full" />
                            </div>

                            {/* Vertical padding */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-semibold text-text-primary">Vertical Padding</label>
                                    <span className="text-sm text-text-secondary font-mono">{subStyle.paddingV}px</span>
                                </div>
                                <input type="range" min={0} max={40} value={subStyle.paddingV}
                                    onChange={e => setSubStyle(s => ({ ...s, paddingV: Number(e.target.value) }))}
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

                            {/* Vertical Margin */}
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-semibold text-text-primary">Vertical Margin</label>
                                    <span className="text-xs text-text-secondary font-mono">{subStyle.marginV}px</span>
                                </div>
                                <input type="range" min={0} max={250} value={subStyle.marginV}
                                    onChange={e => setSubStyle(s => ({ ...s, marginV: Number(e.target.value) }))}
                                    className="w-full" />
                            </div>

                            {/* Text Stroke Section */}
                            <div className="pt-2 border-t border-border-primary space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-text-primary">Text Stroke</h3>
                                    </div>
                                    <button
                                        onClick={() => setSubStyle(s => ({ ...s, strokeEnabled: !s.strokeEnabled }))}
                                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${subStyle.strokeEnabled ? 'bg-accent-primary' : 'bg-surface-primary border border-border-primary'
                                            }`}
                                        aria-label="Toggle text stroke"
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${subStyle.strokeEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>

                                {subStyle.strokeEnabled && (
                                    <div className="space-y-3 pl-2 border-l-2 border-border-primary">
                                        {/* Stroke Color */}
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-text-primary">Stroke Color</label>
                                            <div className="flex items-center gap-2">
                                                {['#000000', '#ffffff', '#ff0000', '#0000ff'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setSubStyle(s => ({ ...s, strokeColor: c }))}
                                                        className={`w-6 h-6 rounded-full border border-border-primary transition-all ${subStyle.strokeColor === c ? 'scale-110 ring-2 ring-accent-primary ring-offset-1 ring-offset-bg-primary' : 'hover:scale-105'}`}
                                                        style={{ background: c }}
                                                        title={c}
                                                    />
                                                ))}
                                                <input type="color" value={subStyle.strokeColor}
                                                    onChange={e => setSubStyle(s => ({ ...s, strokeColor: e.target.value }))}
                                                    className="w-6 h-6 rounded border-0 p-0 bg-transparent cursor-pointer ml-1"
                                                    title="Custom stroke color" />
                                            </div>
                                        </div>

                                        {/* Stroke Size */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-semibold text-text-primary">Stroke Size</label>
                                                <span className="text-xs text-text-secondary font-mono">{subStyle.strokeSize}px</span>
                                            </div>
                                            <input type="range" min={1} max={10} step={0.5} value={subStyle.strokeSize}
                                                onChange={e => setSubStyle(s => ({ ...s, strokeSize: Number(e.target.value) }))}
                                                className="w-full" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Position Grid */}
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-text-primary">Alignment</label>
                                <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-surface-secondary border border-border-secondary">
                                    {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(align => (
                                        <button
                                            key={align}
                                            onClick={() => setSubStyle(s => ({ ...s, alignment: align }))}
                                            className={`w-9 h-9 rounded flex items-center justify-center transition-all focus:outline-none
                                                ${subStyle.alignment === align ? 'bg-accent-primary text-white shadow-sm scale-105' : 'bg-surface-primary text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-primary'}`}
                                            title={`Alignment ${align}`}
                                        >
                                            <span className="text-sm">
                                                {align === 7 && '↖'}
                                                {align === 8 && '⬆'}
                                                {align === 9 && '↗'}
                                                {align === 4 && '⬅'}
                                                {align === 5 && '●'}
                                                {align === 6 && '➡'}
                                                {align === 1 && '↙'}
                                                {align === 2 && '⬇'}
                                                {align === 3 && '↘'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Blur Rectangle Section ── */}
                        <div className="bg-surface-secondary rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-text-primary">🟫 Blur Rectangle</h3>
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
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <label className="text-xs font-semibold text-text-primary">Y Position</label>
                                            <span className="text-xs text-text-secondary font-mono">{subStyle.blurRect.yPct}%</span>
                                        </div>
                                        <input type="range" min={0} max={100} value={subStyle.blurRect.yPct}
                                            onChange={e => setSubStyle(s => ({ ...s, blurRect: { ...s.blurRect, yPct: Number(e.target.value) } }))}
                                            className="w-full" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <label className="text-xs font-semibold text-text-primary">Height</label>
                                            <span className="text-xs text-text-secondary font-mono">{subStyle.blurRect.heightPct}%</span>
                                        </div>
                                        <input type="range" min={1} max={100} value={subStyle.blurRect.heightPct}
                                            onChange={e => setSubStyle(s => ({ ...s, blurRect: { ...s.blurRect, heightPct: Number(e.target.value) } }))}
                                            className="w-full" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Watermark Section ── */}
                        <div className="bg-surface-secondary rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-text-primary">©️ Watermark Text</h3>
                                </div>
                                <button
                                    onClick={() => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, enabled: !s.watermark?.enabled } }))}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${subStyle.watermark?.enabled ? 'bg-accent-primary' : 'bg-surface-primary border border-border-primary'
                                        }`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${subStyle.watermark?.enabled ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>

                            {subStyle.watermark?.enabled && (
                                <div className="space-y-4 pt-2 border-t border-border-primary animate-fade-in">
                                    
                                    {/* Text input */}
                                    <div>
                                        <label className="text-sm font-semibold text-text-primary mb-2 block">Text</label>
                                        <input 
                                            type="text" 
                                            value={subStyle.watermark.text}
                                            onChange={e => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, text: e.target.value } }))}
                                            className="w-full bg-surface-primary border border-border-primary rounded-lg px-3 py-2 text-text-primary text-sm focus:border-accent-primary outline-none"
                                            placeholder="@ChannelName"
                                        />
                                    </div>

                                    {/* Font Size & Position X/Y */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-sm font-medium text-text-primary">Font Size</label>
                                                <span className="text-xs text-text-secondary font-mono">{subStyle.watermark.fontSize}px</span>
                                            </div>
                                            <input type="range" min={10} max={100} value={subStyle.watermark.fontSize}
                                                onChange={e => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, fontSize: Number(e.target.value) } }))}
                                                className="w-full" />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <label className="text-xs font-medium text-text-secondary">X%</label>
                                                    <span className="text-xs text-text-secondary font-mono">{Math.round(subStyle.watermark.xPct)}</span>
                                                </div>
                                                <input type="range" min={0} max={100} value={subStyle.watermark.xPct}
                                                    onChange={e => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, xPct: Number(e.target.value) } }))}
                                                    className="w-full" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <label className="text-xs font-medium text-text-secondary">Y%</label>
                                                    <span className="text-xs text-text-secondary font-mono">{Math.round(subStyle.watermark.yPct)}</span>
                                                </div>
                                                <input type="range" min={0} max={100} value={subStyle.watermark.yPct}
                                                    onChange={e => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, yPct: Number(e.target.value) } }))}
                                                    className="w-full" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Color and Opacity */}
                                    <div className="flex gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-text-secondary">Color</label>
                                            <input type="color" value={subStyle.watermark.color}
                                                onChange={e => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, color: e.target.value } }))}
                                                className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-medium text-text-secondary">Opacity</label>
                                                <span className="text-xs text-text-secondary font-mono">{subStyle.watermark.opacity}%</span>
                                            </div>
                                            <input type="range" min={0} max={100} value={subStyle.watermark.opacity}
                                                onChange={e => setSubStyle(s => ({ ...s, watermark: { ...s.watermark!, opacity: Number(e.target.value) } }))}
                                                className="w-full" />
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>

                    </div>
                </aside>
            </div>
        </div>
    );
};

export default QueueEncoderPage;
