// ThumbnailCoverPage.tsx - Thumbnail Cover Editor

import React, { useRef, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  shadow: boolean;
  align: CanvasTextAlign;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  'Inter', 'Arial', 'Georgia', 'Verdana', 'Courier New',
  'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Tahoma', 'Palatino',
];

const PRESET_COLORS = [
  '#ffffff', '#000000', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

function buildFont(layer: TextLayer) {
  const style = [
    layer.italic ? 'italic' : '',
    layer.bold ? 'bold' : '',
    `${layer.fontSize}px`,
    `"${layer.fontFamily}", sans-serif`,
  ].filter(Boolean).join(' ');
  return style;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ThumbnailCoverPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 720 });

  // Editing state mirrors selected layer
  const [editText, setEditText] = useState('');
  const [editFontSize, setEditFontSize] = useState(48);
  const [editFontFamily, setEditFontFamily] = useState('Inter');
  const [editColor, setEditColor] = useState('#ffffff');
  const [editBold, setEditBold] = useState(true);
  const [editItalic, setEditItalic] = useState(false);
  const [editUnderline, setEditUnderline] = useState(false);
  const [editShadow, setEditShadow] = useState(true);
  const [editAlign, setEditAlign] = useState<CanvasTextAlign>('left');

  const selected = layers.find(l => l.id === selectedId) ?? null;

  // ── Sync editing state when selection changes
  useEffect(() => {
    if (selected) {
      setEditText(selected.text);
      setEditFontSize(selected.fontSize);
      setEditFontFamily(selected.fontFamily);
      setEditColor(selected.color);
      setEditBold(selected.bold);
      setEditItalic(selected.italic);
      setEditUnderline(selected.underline);
      setEditShadow(selected.shadow);
      setEditAlign(selected.align);
    }
  }, [selectedId]);

  // ── Sync edits back to layer
  useEffect(() => {
    if (!selectedId) return;
    setLayers(prev => prev.map(l => l.id !== selectedId ? l : {
      ...l,
      text: editText,
      fontSize: editFontSize,
      fontFamily: editFontFamily,
      color: editColor,
      bold: editBold,
      italic: editItalic,
      underline: editUnderline,
      shadow: editShadow,
      align: editAlign,
    }));
  }, [editText, editFontSize, editFontFamily, editColor, editBold, editItalic, editUnderline, editShadow, editAlign]);

  // ── Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (image) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#334155';
      ctx.font = '24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload an image to get started', canvas.width / 2, canvas.height / 2);
    }

    layers.forEach(layer => {
      ctx.save();
      ctx.font = buildFont(layer);
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.align;

      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Multiline support
      const lines = layer.text.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, layer.x, layer.y + i * (layer.fontSize * 1.3));
        if (layer.underline) {
          const metrics = ctx.measureText(line);
          const lineY = layer.y + i * (layer.fontSize * 1.3) + 4;
          ctx.beginPath();
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.fontSize / 16;
          ctx.moveTo(layer.x, lineY);
          ctx.lineTo(layer.x + metrics.width, lineY);
          ctx.stroke();
        }
      });

      // Selection indicator
      if (layer.id === selectedId) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        const metrics = ctx.measureText(layer.text.split('\n')[0]);
        const totalH = lines.length * layer.fontSize * 1.3;
        ctx.strokeRect(layer.x - 8, layer.y - layer.fontSize - 4, metrics.width + 16, totalH + 12);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }, [image, layers, selectedId]);

  useEffect(() => { draw(); }, [draw]);

  // ── Load image
  const loadImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setCanvasSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  };

  // ── Add text layer
  const addLayer = () => {
    const id = uid();
    const newLayer: TextLayer = {
      id,
      text: 'Your Text Here',
      x: (canvasRef.current?.width ?? 640) / 2 - 100,
      y: (canvasRef.current?.height ?? 360) / 2,
      fontSize: 48,
      fontFamily: 'Inter',
      color: '#ffffff',
      bold: true,
      italic: false,
      underline: false,
      shadow: true,
      align: 'left',
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(id);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Canvas mouse interaction
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);
    // pick topmost layer
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let hit: TextLayer | null = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      ctx.font = buildFont(l);
      const w = ctx.measureText(l.text.split('\n')[0]).width + 16;
      const h = l.text.split('\n').length * l.fontSize * 1.3 + 12;
      if (x >= l.x - 8 && x <= l.x - 8 + w && y >= l.y - l.fontSize - 4 && y <= l.y - l.fontSize - 4 + h) {
        hit = l;
        break;
      }
    }
    if (hit) {
      setSelectedId(hit.id);
      setDragging({ id: hit.id, ox: x - hit.x, oy: y - hit.y });
    } else {
      setSelectedId(null);
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const { x, y } = getCanvasPos(e);
    setLayers(prev => prev.map(l => l.id !== dragging.id ? l : {
      ...l,
      x: x - dragging.ox,
      y: y - dragging.oy,
    }));
  };

  const onCanvasMouseUp = () => setDragging(null);

  // ── Export
  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Temporarily deselect to remove dashed outline
    const prevSelected = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => {
      const link = document.createElement('a');
      link.download = 'thumbnail-cover.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setSelectedId(prevSelected);
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border-primary flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🖼️</span>
          <div>
            <h1 className="text-xl font-bold text-text-primary leading-tight">Thumbnail Cover</h1>
            <p className="text-xs text-text-secondary">Upload · Edit · Overlay Text · Export</p>
          </div>
        </div>
        <button
          onClick={exportImage}
          disabled={!image}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-semibold
                     hover:bg-accent-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow"
        >
          <span>💾</span> Export PNG
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel: Controls ── */}
        <aside className="w-72 flex-shrink-0 border-r border-border-primary bg-surface-primary flex flex-col overflow-y-auto">

          {/* Upload Section */}
          <div className="p-4 border-b border-border-primary">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Image</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              className={`
                flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
                cursor-pointer transition-colors py-6 px-4 text-center
                ${isDragOver
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-primary hover:border-accent-primary/50 text-text-secondary hover:text-text-primary'
                }
              `}
            >
              <span className="text-3xl">{imageSrc ? '🔄' : '📁'}</span>
              <p className="text-sm font-medium">{imageSrc ? 'Replace image' : 'Drop or click to upload'}</p>
              <p className="text-xs text-text-tertiary">PNG, JPG, WEBP supported</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
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
                <p className="text-xs text-text-tertiary text-center py-3">No text layers yet</p>
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
                  <span className="text-sm">T</span>
                  <span className="flex-1 text-sm truncate">{l.text.split('\n')[0] || 'Empty'}</span>
                  <button
                    onClick={e => { e.stopPropagation(); removeLayer(l.id); }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-500 transition-opacity"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Text Edit Controls — only shown when a layer is selected */}
          {selected && (
            <>
              {/* Text Content */}
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

              {/* Font Family */}
              <div className="p-4 border-b border-border-primary">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Font</p>
                <select
                  value={editFontFamily}
                  onChange={e => setEditFontFamily(e.target.value)}
                  className="w-full bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                             focus:outline-none focus:border-accent-primary transition-colors"
                >
                  {FONT_FAMILIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                {/* Font Size */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">Size</span>
                    <span className="text-xs font-semibold text-text-primary">{editFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={12} max={300} step={2}
                    value={editFontSize}
                    onChange={e => setEditFontSize(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Style toggles */}
                <div className="flex gap-2 mt-3">
                  {[
                    { label: 'B', active: editBold, toggle: () => setEditBold(p => !p), title: 'Bold', style: 'font-bold' },
                    { label: 'I', active: editItalic, toggle: () => setEditItalic(p => !p), title: 'Italic', style: 'italic' },
                    { label: 'U', active: editUnderline, toggle: () => setEditUnderline(p => !p), title: 'Underline', style: 'underline' },
                    { label: '✦', active: editShadow, toggle: () => setEditShadow(p => !p), title: 'Shadow', style: '' },
                  ].map(btn => (
                    <button
                      key={btn.title}
                      onClick={btn.toggle}
                      title={btn.title}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors
                        ${btn.active
                          ? 'bg-accent-primary/15 border-accent-primary text-accent-primary'
                          : 'bg-surface-secondary border-border-primary text-text-secondary hover:border-accent-primary/50'
                        } ${btn.style}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Text Align */}
                <div className="flex gap-2 mt-2">
                  {(['left', 'center', 'right'] as CanvasTextAlign[]).map(a => (
                    <button
                      key={a}
                      onClick={() => setEditAlign(a)}
                      title={`Align ${a}`}
                      className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors
                        ${editAlign === a
                          ? 'bg-accent-primary/15 border-accent-primary text-accent-primary'
                          : 'bg-surface-secondary border-border-primary text-text-secondary hover:border-accent-primary/50'
                        }`}
                    >
                      {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="p-4 border-b border-border-primary">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Color</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      title={c}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                        ${editColor === c ? 'border-accent-primary scale-110' : 'border-border-primary'}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border-primary cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={editColor}
                    onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setEditColor(e.target.value); }}
                    className="flex-1 bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary
                               font-mono focus:outline-none focus:border-accent-primary transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {!selected && layers.length > 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-text-tertiary">Click a text layer above or click text on the canvas to edit it.</p>
            </div>
          )}
        </aside>

        {/* ── Canvas ── */}
        <main className="flex-1 bg-bg-secondary flex items-start justify-center overflow-auto p-6">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseUp}
              className="max-w-full rounded-xl shadow-2xl border border-border-primary cursor-crosshair"
              style={{ maxHeight: 'calc(100vh - 140px)', objectFit: 'contain' }}
            />
            {/* Hint when no image */}
            {!image && (
              <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                <span className="text-xs text-text-tertiary bg-surface-primary/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border-primary">
                  Upload an image from the left panel to begin
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ThumbnailCoverPage;
