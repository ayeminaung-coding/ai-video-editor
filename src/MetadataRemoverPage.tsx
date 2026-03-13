// MetadataRemoverPage.tsx — Upload → Preview Rich Metadata → Remove & Download

import React, { useCallback, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _envUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
// In dev: use '' so Vite proxy forwards /api → localhost:8000 (no CORS issues)
// In prod: set VITE_API_URL to your deployed backend URL
const API_BASE: string = (_envUrl && _envUrl.trim() !== '') ? _envUrl.trim().replace(/\/$/, '') : '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaField {
  key: string;
  value: string;
}

interface MetaGroup {
  group: string;
  fields: MetaField[];
}

type Status = 'idle' | 'reading' | 'preview' | 'removing' | 'done' | 'error';

// ─── Accordion group component ────────────────────────────────────────────────

const MetaGroupCard: React.FC<{ group: MetaGroup; defaultOpen?: boolean }> = ({
  group,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const hasRealData =
    group.fields.length > 0 &&
    !(group.fields.length === 1 && group.fields[0].key === 'Status');

  const groupColor = hasRealData
    ? 'text-accent-primary border-accent-primary/30 bg-accent-primary/5'
    : 'text-text-tertiary border-border-primary bg-surface-secondary';

  return (
    <div className="rounded-xl border border-border-primary overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary hover:bg-surface-primary transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${groupColor}`}
          >
            {hasRealData ? group.fields.length : '—'}
          </span>
          <span className="text-sm font-semibold text-text-primary">{group.group}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          className="text-text-tertiary shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-border-primary">
          {group.fields.map((f, i) => (
            <div
              key={i}
              className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-2.5 text-sm ${
                i % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary'
              }`}
            >
              <span className="shrink-0 font-medium text-text-secondary w-44 truncate" title={f.key}>
                {f.key}
              </span>
              <span className="text-text-primary break-all">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ACCEPTED =
  'video/*,audio/*,image/*,.mp4,.mov,.mkv,.avi,.mp3,.wav,.flac,.jpg,.jpeg,.png,.webp';

const MetadataRemoverPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<MetaGroup[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File ingestion ──────────────────────────────────────────────────────

  const ingestFile = useCallback(async (f: File) => {
    setFile(f);
    setGroups([]);
    setErrorMsg('');
    setStatus('reading');

    try {
      const form = new FormData();
      form.append('file', f);
      form.append('mime_type', f.type ?? '');

      const res = await fetch(`${API_BASE}/api/metadata/read`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Server error ${res.status}`);
      }

      const data: { filename: string; groups: MetaGroup[] } = await res.json();
      setGroups(data.groups);
      setStatus('preview');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  // ── Drop / change handlers ──────────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) ingestFile(dropped);
    },
    [ingestFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) ingestFile(selected);
  };

  // ── Remove & download ───────────────────────────────────────────────────

  const handleRemove = async () => {
    if (!file) return;
    setStatus('removing');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('mime_type', file.type ?? '');

      const res = await fetch(`${API_BASE}/api/metadata/remove`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Server error ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      // Get filename from Content-Disposition or build one
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] ?? file.name.replace(/(\.[^.]+)$/, '_clean$1');
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setGroups([]);
    setStatus('idle');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Format helpers ──────────────────────────────────────────────────────

  const fileIcon = file
    ? file.type.startsWith('video')
      ? '🎬'
      : file.type.startsWith('audio')
      ? '🎵'
      : '🖼️'
    : '📂';

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            🧹 Metadata Remover
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Upload any video, audio, or image file to inspect its embedded metadata, then
            download a clean copy with all metadata stripped.
          </p>
        </div>

        {/* ── Drop zone (idle only) ── */}
        {status === 'idle' && (
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={`
              cursor-pointer rounded-xl border-2 border-dashed p-10
              flex flex-col items-center justify-center gap-3 text-center
              transition-colors duration-150
              ${dragging
                ? 'border-accent-primary bg-accent-primary/5 text-accent-primary'
                : 'border-border-primary bg-surface-primary text-text-secondary hover:border-accent-primary hover:bg-surface-secondary'
              }
            `}
          >
            <span className="text-4xl">📂</span>
            <div>
              <p className="font-semibold text-text-primary">Drop a file here</p>
              <p className="text-sm text-text-secondary mt-0.5">
                or <span className="text-accent-primary underline">browse</span> to select
              </p>
            </div>
            <p className="text-xs text-text-tertiary">Video · Audio · Image</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        )}

        {/* ── Reading spinner ── */}
        {status === 'reading' && (
          <div className="text-center py-12 space-y-3">
            <div className="w-10 h-10 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mx-auto" />
            <p className="text-sm text-text-secondary">Reading metadata from server…</p>
          </div>
        )}

        {/* ── Preview & actions ── */}
        {(status === 'preview' || status === 'removing' || status === 'done') && file && (
          <div className="space-y-4">

            {/* File card */}
            <div className="bg-surface-primary border border-border-primary rounded-xl p-4 flex items-center gap-3">
              <span className="text-3xl shrink-0">{fileIcon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-text-primary truncate">{file.name}</p>
                <p className="text-xs text-text-secondary">{formatBytes(file.size)} · {file.type || 'unknown type'}</p>
              </div>
              <button
                onClick={handleReset}
                className="ml-auto text-text-tertiary hover:text-text-primary transition-colors text-sm shrink-0"
              >
                ✕ Clear
              </button>
            </div>

            {/* Metadata groups accordion */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider px-1">
                Detected Metadata
              </p>
              {groups.map((g, i) => (
                <MetaGroupCard key={g.group + i} group={g} defaultOpen={i === 0} />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              {status !== 'done' && (
                <button
                  onClick={handleRemove}
                  disabled={status === 'removing'}
                  className="flex-1 py-3 px-4 bg-accent-primary text-white rounded-xl font-semibold
                    hover:bg-accent-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {status === 'removing' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Removing metadata…
                    </>
                  ) : (
                    '🧹 Remove Metadata & Download'
                  )}
                </button>
              )}

              {status === 'done' && (
                <div className="flex-1 py-3 px-4 bg-green-500/10 text-green-500 border border-green-500/30
                  rounded-xl font-semibold text-center flex items-center justify-center gap-2">
                  ✅ Clean file downloaded successfully!
                </div>
              )}

              <button
                onClick={handleReset}
                className="py-3 px-4 border border-border-primary text-text-secondary rounded-xl
                  hover:bg-surface-secondary transition-colors text-sm font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-2">
            <p className="font-semibold text-red-500">Something went wrong</p>
            <p className="text-sm text-red-400 break-words">{errorMsg}</p>
            <button
              onClick={handleReset}
              className="text-xs underline text-red-400 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Info note */}
        <div className="bg-surface-secondary border border-border-primary rounded-xl p-4 text-xs text-text-tertiary space-y-1">
          <p className="font-semibold text-text-secondary">ℹ️ How it works</p>
          <p>
            Your file is sent to the local backend for metadata extraction (ffprobe / Pillow)
            and then stripped using ffmpeg / Pillow. Nothing leaves your machine.
            The cleaned file is sent back and downloaded directly to your device.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MetadataRemoverPage;
