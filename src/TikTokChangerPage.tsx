// TikTokChangerPage.tsx — Full TikTok 9:16 Formatter with canvas preview + video export

import React, {
  useRef, useState, useEffect, useCallback, useLayoutEffect,
} from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TextLayer {
  id: string;
  text: string;
  /** position as % of canvas (0–100) */
  xPct: number;
  yPct: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  stroke: boolean;
  strokeColor: string;
  strokeWidth: number;
}

type BgMode = 'blur' | 'color';
type ExportStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

// ─── Canvas dimensions (9:16 display) ────────────────────────────────────────
const CANVAS_W = 405;   // display px (fits in panel)
const CANVAS_H = 720;   // display px  → 405/720 ≈ 9/16

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  'Inter', 'Arial', 'Georgia', 'Verdana',
  'Courier New', 'Impact', 'Trebuchet MS', 'Comic Sans MS',
];

const PRESET_COLORS = [
  '#ffffff', '#000000', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#a855f7', '#ec4899',
];

const uid = () => Math.random().toString(36).slice(2, 9);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _envUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
const API_BASE: string =
  _envUrl && _envUrl.trim() !== '' ? _envUrl.trim().replace(/\/$/, '') : '';

// ─── Component ────────────────────────────────────────────────────────────────

const TikTokChangerPage: React.FC = () => {
  // ── Video ──────────────────────────────────────────────────────────────────
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef    = useRef<number>(0);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl]   = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // ── Canvas settings ────────────────────────────────────────────────────────
  const [bgMode, setBgMode]   = useState<BgMode>('blur');
  const [blurPx, setBlurPx]   = useState(34);
  const [bgColor, setBgColor] = useState('#1a1a2e');

  // ── Text layers ────────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origXPct: number; origYPct: number } | null>(null);

  // ── Editing mirror ─────────────────────────────────────────────────────────
  const [editText,   setEditText]   = useState('');
  const [editFont,   setEditFont]   = useState('Inter');
  const [editSize,   setEditSize]   = useState(48);
  const [editColor,  setEditColor]  = useState('#ffffff');
  const [editBold,        setEditBold]        = useState(true);
  const [editItalic,      setEditItalic]      = useState(false);
  const [editShadow,      setEditShadow]      = useState(true);
  const [editStroke,      setEditStroke]      = useState(false);
  const [editStrokeColor, setEditStrokeColor] = useState('#000000');
  const [editStrokeWidth, setEditStrokeWidth] = useState(3);

  const selected = layers.find(l => l.id === selectedId) ?? null;

  // ── Export state ───────────────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Sync edit state when selection changes ────────────────────────────────
  useEffect(() => {
    if (selected) {
      setEditText(selected.text);
      setEditFont(selected.fontFamily);
      setEditSize(selected.fontSize);
      setEditColor(selected.color);
      setEditBold(selected.bold);
      setEditItalic(selected.italic);
      setEditShadow(selected.shadow);
      setEditStroke(selected.stroke);
      setEditStrokeColor(selected.strokeColor);
      setEditStrokeWidth(selected.strokeWidth);
    }
  }, [selectedId]); // eslint-disable-line

  // ─── Sync edits back to layer ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setLayers(prev => prev.map(l => l.id !== selectedId ? l : {
      ...l,
      text: editText,
      fontFamily: editFont,
      fontSize: editSize,
      color: editColor,
      bold: editBold,
      italic: editItalic,
      shadow: editShadow,
      stroke: editStroke,
      strokeColor: editStrokeColor,
      strokeWidth: editStrokeWidth,
    }));
  }, [editText, editFont, editSize, editColor, editBold, editItalic, editShadow, editStroke, editStrokeColor, editStrokeWidth]); // eslint-disable-line

  // ─── Build off-screen canvas for blur effect ───────────────────────────────
  useLayoutEffect(() => {
    const oc = document.createElement('canvas');
    oc.width  = CANVAS_W;
    oc.height = CANVAS_H;
    offscreenRef.current = oc;
  }, []);

  // ─── Canvas draw loop ──────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    const oc     = offscreenRef.current;
    if (!canvas || !oc) return;
    const ctx = canvas.getContext('2d');
    const octx = oc.getContext('2d');
    if (!ctx || !octx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (!video || !videoReady) {
      // Placeholder
      ctx.fillStyle = '#0f0f23';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#334155';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a video to preview', CANVAS_W / 2, CANVAS_H / 2);
      return;
    }

    // ── Background ─────────────────────────────────────────────────────────
    if (bgMode === 'blur') {
      // Draw blurred scaled fill to offscreen, then copy
      octx.filter = `blur(${blurPx}px)`;
      octx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);
      octx.filter = 'none';
      ctx.drawImage(oc, 0, 0);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // ── Foreground: letterboxed video ──────────────────────────────────────
    const vw = video.videoWidth  || 1;
    const vh = video.videoHeight || 1;
    const scale = Math.min(CANVAS_W / vw, CANVAS_H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (CANVAS_W - dw) / 2;
    const dy = (CANVAS_H - dh) / 2;
    ctx.drawImage(video, dx, dy, dw, dh);

    // ── Text layers ────────────────────────────────────────────────────────
    layers.forEach(layer => {
      const px = (layer.xPct / 100) * CANVAS_W;
      const py = (layer.yPct / 100) * CANVAS_H;

      ctx.save();
      const style = [
        layer.italic ? 'italic' : '',
        layer.bold   ? 'bold'   : '',
        `${layer.fontSize}px`,
        `"${layer.fontFamily}", sans-serif`,
      ].filter(Boolean).join(' ');
      ctx.font = style;
      ctx.fillStyle = layer.color;
      ctx.textAlign = 'left';

      if (layer.shadow) {
        ctx.shadowColor   = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur    = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      layer.text.split('\n').forEach((line, i) => {
        const lineY = py + i * layer.fontSize * 1.35;
        // Draw stroke first (behind fill)
        if (layer.stroke && layer.strokeWidth > 0) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = layer.strokeColor;
          ctx.lineWidth   = layer.strokeWidth * 2; // lineWidth is total, stroke is half outside
          ctx.lineJoin    = 'round';
          ctx.strokeText(line, px, lineY);
          ctx.restore();
        }
        ctx.fillText(line, px, lineY);
      });

      // Selection ring
      if (layer.id === selectedId) {
        ctx.shadowBlur = 0;
        const metrics = ctx.measureText(layer.text.split('\n')[0]);
        const lh = layer.fontSize * 1.35;
        const totalH = layer.text.split('\n').length * lh;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth   = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(px - 6, py - layer.fontSize - 2, metrics.width + 12, totalH + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }, [bgMode, blurPx, bgColor, layers, selectedId, videoReady]);

  // ── RAF loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      drawFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  // ─── File load ─────────────────────────────────────────────────────────────
  const loadVideo = (file: File) => {
    if (!file.type.startsWith('video/')) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setVideoReady(false);
    setExportStatus('idle');
    setExportError('');
    setExportProgress(0);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadVideo(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadVideo(f);
  };

  // ─── Text layers ───────────────────────────────────────────────────────────
  const addLayer = () => {
    const id = uid();
    setLayers(prev => [...prev, {
      id, text: 'Your Text',
      xPct: 10, yPct: 80,
      fontSize: 48, fontFamily: 'Inter',
      color: '#ffffff', bold: true, italic: false, shadow: true,
      stroke: false, strokeColor: '#000000', strokeWidth: 3,
    }]);
    setSelectedId(id);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ─── Canvas mouse interaction ──────────────────────────────────────────────
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    let hit: TextLayer | null = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const px = (l.xPct / 100) * CANVAS_W;
      const py = (l.yPct / 100) * CANVAS_H;
      ctx.font = `${l.bold ? 'bold ' : ''}${l.fontSize}px "${l.fontFamily}", sans-serif`;
      const w = ctx.measureText(l.text.split('\n')[0]).width + 12;
      const h = l.text.split('\n').length * l.fontSize * 1.35 + 8;
      if (x >= px - 6 && x <= px - 6 + w && y >= py - l.fontSize - 2 && y <= py - l.fontSize - 2 + h) {
        hit = l;
        break;
      }
    }
    if (hit) {
      setSelectedId(hit.id);
      setDragging({ id: hit.id, startX: x, startY: y, origXPct: hit.xPct, origYPct: hit.yPct });
    } else {
      setSelectedId(null);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const { x, y } = getCanvasPos(e);
    const dx = x - dragging.startX;
    const dy = y - dragging.startY;
    const newXPct = Math.max(0, Math.min(100, dragging.origXPct + (dx / CANVAS_W) * 100));
    const newYPct = Math.max(0, Math.min(100, dragging.origYPct + (dy / CANVAS_H) * 100));
    setLayers(prev => prev.map(l => l.id !== dragging.id ? l : { ...l, xPct: newXPct, yPct: newYPct }));
  };

  const onCanvasMouseUp = () => setDragging(null);

  // ─── Export ─────────────────────────────────────────────────────────────────
  const startExport = async () => {
    if (!videoFile) return;
    setExportStatus('uploading');
    setExportProgress(2);
    setExportError('');

    try {
      const form = new FormData();
      form.append('video_file', videoFile);
      form.append('bg_mode', bgMode);
      form.append('blur_px', String(blurPx));
      form.append('bg_color', bgColor);

      // ─── Generate Text Overlay Image ───
      const targetW = 1080;
      const targetH = 1920;
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = targetW;
      overlayCanvas.height = targetH;
      const octx = overlayCanvas.getContext('2d');
      if (octx && layers.length > 0) {
        layers.forEach(layer => {
          const px = (layer.xPct / 100) * targetW;
          const py = (layer.yPct / 100) * targetH;

          octx.save();
          const scale = targetH / CANVAS_H;
          const fontSize = Math.round(layer.fontSize * scale);
          const strokeWidth = layer.strokeWidth * scale;

          const style = [
            layer.italic ? 'italic' : '',
            layer.bold   ? 'bold'   : '',
            `${fontSize}px`,
            `"${layer.fontFamily}", sans-serif`,
          ].filter(Boolean).join(' ');
          octx.font = style;
          octx.fillStyle = layer.color;
          octx.textAlign = 'left';

          if (layer.shadow) {
            octx.shadowColor   = 'rgba(0,0,0,0.85)';
            octx.shadowBlur    = 8 * scale;
            octx.shadowOffsetX = 2 * scale;
            octx.shadowOffsetY = 2 * scale;
          }

          layer.text.split('\n').forEach((line, i) => {
            const lineY = py + i * fontSize * 1.35;
            // Draw stroke first (behind fill)
            if (layer.stroke && strokeWidth > 0) {
              octx.save();
              octx.shadowBlur = 0;
              octx.shadowOffsetX = 0;
              octx.shadowOffsetY = 0;
              octx.strokeStyle = layer.strokeColor;
              octx.lineWidth   = strokeWidth * 2; // lineWidth is total, stroke is half outside
              octx.lineJoin    = 'round';
              octx.strokeText(line, px, lineY);
              octx.restore();
            }
            octx.fillText(line, px, lineY);
          });
          octx.restore();
        });

        const overlayBlob = await new Promise<Blob | null>(res => overlayCanvas.toBlob(res, 'image/png'));
        if (overlayBlob) {
          form.append('text_overlay', overlayBlob, 'overlay.png');
        }
      }

      // Convert layers to backend format (xPct/yPct already in %)

      const res = await fetch(`${API_BASE}/api/tiktok/export/start`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Server error ${res.status}`);
      }

      const { job_id } = await res.json();
      setExportStatus('processing');
      setExportProgress(10);

      // Poll
      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`${API_BASE}/api/tiktok/export/status/${job_id}`);
          if (!sr.ok) return;
          const s = await sr.json();
          setExportProgress(Math.max(10, s.progress));

          if (s.status === 'done') {
            clearInterval(pollRef.current!);
            setExportStatus('done');
            setExportProgress(100);
            // Trigger download
            const a = document.createElement('a');
            a.href = `${API_BASE}/api/tiktok/export/download/${job_id}`;
            a.download = '';
            a.click();
          } else if (s.status === 'error') {
            clearInterval(pollRef.current!);
            setExportStatus('error');
            setExportError(s.error || 'Unknown error');
          }
        } catch {
          // keep polling
        }
      }, 1500);

    } catch (err: unknown) {
      setExportStatus('error');
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  // cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const isBusy = exportStatus === 'uploading' || exportStatus === 'processing';

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎵</span>
          <div>
            <h1 className="text-xl font-bold text-text-primary leading-tight">TikTok Changer</h1>
            <p className="text-xs text-text-secondary">9:16 Format · Blur Canvas · Text Overlay · Export Video</p>
          </div>
        </div>

        {/* Export button */}
        <button
          onClick={startExport}
          disabled={!videoFile || isBusy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-semibold
                     hover:bg-accent-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow"
        >
          {isBusy ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {exportStatus === 'uploading' ? 'Uploading…' : `Exporting ${exportProgress.toFixed(0)}%`}
            </>
          ) : (
            <>🎬 Export TikTok Video</>
          )}
        </button>
      </div>

      {/* Export status bar */}
      {(isBusy || exportStatus === 'done' || exportStatus === 'error') && (
        <div className={`flex-shrink-0 px-6 py-2 text-sm flex items-center gap-3 border-b border-border-primary
          ${exportStatus === 'done'  ? 'bg-green-500/10 text-green-400' :
            exportStatus === 'error' ? 'bg-red-500/10 text-red-400' :
            'bg-accent-primary/10 text-accent-primary'}`}>
          {isBusy && (
            <>
              <div className="w-full max-w-xs h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-primary transition-all duration-500 rounded-full"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <span>{exportProgress.toFixed(0)}%</span>
            </>
          )}
          {exportStatus === 'done'  && '✅ Video exported & downloaded!'}
          {exportStatus === 'error' && `❌ ${exportError}`}
          <button
            className="ml-auto text-xs underline opacity-70 hover:opacity-100"
            onClick={() => setExportStatus('idle')}
          >dismiss</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: Controls ── */}
        <aside className="w-72 flex-shrink-0 border-r border-border-primary bg-surface-primary flex flex-col overflow-y-auto">

          {/* Upload */}
          <div className="p-4 border-b border-border-primary">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Video</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
                cursor-pointer transition-colors py-5 px-4 text-center
                ${isDragOver
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-primary hover:border-accent-primary/50 text-text-secondary hover:text-text-primary'
                }`}
            >
              <span className="text-3xl">{videoFile ? '🔄' : '🎬'}</span>
              <p className="text-sm font-medium">{videoFile ? videoFile.name.slice(0, 22) + (videoFile.name.length > 22 ? '…' : '') : 'Drop or click to upload'}</p>
              <p className="text-xs text-text-tertiary">MP4, MOV, WebM</p>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={onFileChange} />
          </div>

          {/* Background */}
          <div className="p-4 border-b border-border-primary">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Background</p>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border-primary mb-3">
              {(['blur', 'color'] as BgMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setBgMode(mode)}
                  className={`flex-1 py-1.5 text-sm font-semibold transition-colors
                    ${bgMode === mode
                      ? 'bg-accent-primary text-white'
                      : 'text-text-secondary hover:bg-surface-secondary'}`}
                >
                  {mode === 'blur' ? '🌫 Blur' : '🎨 Color'}
                </button>
              ))}
            </div>

            {bgMode === 'blur' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">Blur intensity</span>
                  <span className="text-xs font-semibold text-text-primary">{blurPx}px</span>
                </div>
                <input
                  type="range" min={0} max={40} step={1}
                  value={blurPx}
                  onChange={e => setBlurPx(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            )}

            {bgMode === 'color' && (
              <div className="flex items-center gap-3">
                <input
                  type="color" value={bgColor}
                  onChange={e => setBgColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border-primary cursor-pointer bg-transparent"
                />
                <input
                  type="text" value={bgColor}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }}
                  className="flex-1 bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                             font-mono focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>
            )}
          </div>

          {/* Text Layers */}
          <div className="p-4 border-b border-border-primary">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Text Layers</p>
              <button
                onClick={addLayer}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-primary/10 text-accent-primary text-xs font-semibold hover:bg-accent-primary/20 transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1">
              {layers.length === 0 && (
                <p className="text-xs text-text-tertiary text-center py-3">No text overlays yet</p>
              )}
              {layers.map(l => (
                <div
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group
                    ${l.id === selectedId
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'hover:bg-surface-secondary text-text-secondary hover:text-text-primary'
                    }`}
                >
                  <span className="text-sm shrink-0">T</span>
                  <span className="flex-1 text-sm truncate">{l.text.split('\n')[0] || 'Empty'}</span>
                  <button
                    onClick={ev => { ev.stopPropagation(); removeLayer(l.id); }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-500 transition-opacity shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Text Edit Controls */}
          {selected && (
            <>
              {/* Content */}
              <div className="p-4 border-b border-border-primary">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Text Content</p>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={3}
                  placeholder="Enter your text…"
                  className="w-full bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                             resize-none focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* Font */}
              <div className="p-4 border-b border-border-primary">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Font</p>
                <select
                  value={editFont}
                  onChange={e => setEditFont(e.target.value)}
                  className="w-full bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                             focus:outline-none focus:border-accent-primary transition-colors"
                >
                  {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">Size</span>
                    <span className="text-xs font-semibold text-text-primary">{editSize}px</span>
                  </div>
                  <input
                    type="range" min={12} max={200} step={2}
                    value={editSize}
                    onChange={e => setEditSize(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Style toggles */}
                <div className="flex gap-2 mt-3">
                  {[
                    { label: 'B', active: editBold,   toggle: () => setEditBold(p => !p),   title: 'Bold',   cls: 'font-bold' },
                    { label: 'I', active: editItalic, toggle: () => setEditItalic(p => !p), title: 'Italic', cls: 'italic' },
                    { label: '✦', active: editShadow, toggle: () => setEditShadow(p => !p), title: 'Shadow', cls: '' },
                    { label: 'O', active: editStroke, toggle: () => setEditStroke(p => !p), title: 'Stroke', cls: '' },
                  ].map(btn => (
                    <button
                      key={btn.title}
                      onClick={btn.toggle}
                      title={btn.title}
                      className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors
                        ${btn.active
                          ? 'bg-accent-primary/15 border-accent-primary text-accent-primary'
                          : 'bg-surface-secondary border-border-primary text-text-secondary hover:border-accent-primary/50'
                        } ${btn.cls}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fill Color */}
              <div className="p-4 border-b border-border-primary">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Text Color</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      title={c}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                        ${editColor === c ? 'border-accent-primary scale-110' : 'border-border-primary'}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color" value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border-primary cursor-pointer bg-transparent"
                  />
                  <input
                    type="text" value={editColor}
                    onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setEditColor(e.target.value); }}
                    className="flex-1 bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                               font-mono focus:outline-none focus:border-accent-primary transition-colors"
                  />
                </div>
              </div>

              {/* Stroke */}
              {editStroke && (
                <div className="p-4 border-b border-border-primary">
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Stroke (Outline)</p>

                  {/* Stroke width slider */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary">Width</span>
                      <span className="text-xs font-semibold text-text-primary">{editStrokeWidth}px</span>
                    </div>
                    <input
                      type="range" min={1} max={20} step={1}
                      value={editStrokeWidth}
                      onChange={e => setEditStrokeWidth(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>

                  {/* Stroke color presets */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditStrokeColor(c)}
                        title={c}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                          ${editStrokeColor === c ? 'border-accent-primary scale-110' : 'border-border-primary'}`}
                      />
                    ))}
                  </div>

                  {/* Stroke color picker */}
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={editStrokeColor}
                      onChange={e => setEditStrokeColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border-primary cursor-pointer bg-transparent"
                    />
                    <input
                      type="text" value={editStrokeColor}
                      onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setEditStrokeColor(e.target.value); }}
                      className="flex-1 bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                                 font-mono focus:outline-none focus:border-accent-primary transition-colors"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {!selected && layers.length > 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-text-tertiary">Click a layer above or click text on the canvas to edit</p>
            </div>
          )}

          {/* Tip */}
          <div className="p-4 mt-auto">
            <div className="bg-surface-secondary border border-border-primary rounded-xl p-3 text-xs text-text-tertiary space-y-1">
              <p className="font-semibold text-text-secondary">💡 Tips</p>
              <p>• Drag text directly on the canvas to reposition</p>
              <p>• Blur background fills the 9:16 frame behind your video</p>
              <p>• Export creates a real 1080×1920 MP4 via FFmpeg</p>
            </div>
          </div>
        </aside>

        {/* ── Preview Canvas ── */}
        <main className="flex-1 bg-bg-secondary flex flex-col items-center justify-center overflow-auto p-6 gap-4">

          {/* 9:16 Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30">
              🎵 TikTok 9:16 Preview
            </span>
            {videoFile && (
              <span className="text-xs text-text-tertiary">
                {videoFile.name}
              </span>
            )}
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseUp}
              className="rounded-xl shadow-2xl border border-border-primary cursor-crosshair"
              style={{ display: 'block' }}
            />

            {/* Overlay hint when no video */}
            {!videoFile && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl
                           bg-black/60 cursor-pointer hover:bg-black/50 transition-colors"
              >
                <span className="text-4xl">🎬</span>
                <p className="text-sm font-semibold text-white">Upload a video to begin</p>
                <p className="text-xs text-white/60">MP4, MOV, WebM</p>
              </div>
            )}
          </div>

          {/* Video controls (hidden video element) */}
          {videoUrl && (
            <div className="flex items-center gap-3">
              <video
                ref={videoRef}
                src={videoUrl}
                loop
                muted
                playsInline
                autoPlay
                onLoadedMetadata={() => setVideoReady(true)}
                className="hidden"
              />
              <div className="flex items-center gap-2 bg-surface-primary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-secondary">
                <span className="text-text-tertiary text-xs">Video loaded — preview is live ↑</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TikTokChangerPage;
