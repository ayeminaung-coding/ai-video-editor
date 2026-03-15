import React, { useEffect, useState } from 'react';
import MultiDropZone from './components/MultiDropZone';

interface OcrSubtitleLine {
  start: number;
  end: number;
  text: string;
}

interface QueueJob {
  id: string;
  filename: string;
  job_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed' | 'not_found';
  progress: number;
  result?: any;
  error?: string;
  sourceFile?: File;
}

const secondsToSrt = (sec: number): string => {
  const totalMs = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

const extractSubtitleLines = (result: any): OcrSubtitleLine[] => {
  const raw = Array.isArray(result?.subtitles)
    ? result.subtitles
    : Array.isArray(result)
      ? result
      : [];

  return raw
    .map((line: any) => ({
      start: Number(line?.start ?? 0),
      end: Number(line?.end ?? 0),
      text: String(line?.text ?? '').trim(),
    }))
    .filter((line: OcrSubtitleLine) => line.text.length > 0 && Number.isFinite(line.start) && Number.isFinite(line.end));
};

const buildSrtFromLines = (lines: OcrSubtitleLine[]): string => {
  return lines
    .map((line, idx) => `${idx + 1}\n${secondsToSrt(line.start)} --> ${secondsToSrt(line.end)}\n${line.text}\n`)
    .join('\n');
};

const downloadTextFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const QueueOcrPage: React.FC = () => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);

  // Poll for status every 2 seconds
  useEffect(() => {
    const pendingJobs = jobs.filter(
      (j) => j.status === 'queued' || j.status === 'started'
    );
    
    if (pendingJobs.length === 0) return;

    const interval = setInterval(async () => {
      const jobIds = pendingJobs.map(j => j.job_id).join(',');
      try {
        const res = await fetch(`/api/queue_ocr/status?job_ids=${jobIds}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Status request failed (${res.status})`);
        }
        const data = await res.json();
        const statuses = Array.isArray(data?.statuses) ? data.statuses : [];
        
        setJobs(prevJobs => {
          const newJobs = [...prevJobs];
          statuses.forEach((update: any) => {
            const index = newJobs.findIndex(j => j.job_id === update.job_id);
            if (index !== -1) {
              newJobs[index] = {
                ...newJobs[index],
                status: update.status,
                progress: update.progress || newJobs[index].progress,
                result: update.result
              };
            }
          });
          return newJobs;
        });
        setBackendUnavailable(false);
      } catch (err) {
        console.error('Error fetching status', err);
        setBackendUnavailable(true);
        setErrorMessage('Cannot reach backend API. Start backend: python -m uvicorn main:app --reload --port 8000');
        // Stop repeated proxy errors by terminating all in-flight jobs on connectivity loss.
        setJobs(prevJobs => prevJobs.map(job => (
          job.status === 'queued' || job.status === 'started'
            ? { ...job, status: 'failed', error: 'Backend unavailable' }
            : job
        )));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobs]);

  const handleUpload = async (files: FileList | File[]) => {
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      setErrorMessage(null);
      setBackendUnavailable(false);
      const res = await fetch('/api/queue_ocr/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        let detail = `Upload failed (${res.status})`;
        try {
          const errData = await res.json();
          detail = errData?.detail || detail;
        } catch {
          // Ignore JSON parsing failure and keep generic message.
        }
        throw new Error(detail);
      }
      const data = await res.json();
      const apiJobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const uploadedFiles = Array.from(files);
      
      const newJobs: QueueJob[] = apiJobs.map((j: any, idx: number) => ({
        ...j,
        progress: 0,
        sourceFile: uploadedFiles[idx]
      }));
      setJobs(prev => [...newJobs, ...prev]);
    } catch (err) {
      console.error('Upload failed', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(message);
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        setBackendUnavailable(true);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const clearQueue = async () => {
    try {
      await fetch('/api/queue_ocr/clear', { method: 'DELETE' });
      setJobs([]);
    } catch (err) {
      console.error('Clear failed', err);
    }
  };

  const downloadJobSrt = (job: QueueJob) => {
    if (typeof job.result?.srt === 'string' && job.result.srt.trim().length > 0) {
      const base = (job.filename || 'queue_ocr').replace(/\.[^.]+$/, '');
      downloadTextFile(job.result.srt, `${base}.srt`);
      return;
    }

    const lines = extractSubtitleLines(job.result);
    if (lines.length === 0) {
      setErrorMessage('No subtitle lines found in OCR result.');
      return;
    }
    const srt = buildSrtFromLines(lines);
    const base = (job.filename || 'queue_ocr').replace(/\.[^.]+$/, '');
    downloadTextFile(srt, `${base}.srt`);
  };

  const exportVideoWithSrt = async (job: QueueJob) => {
    if (!job.sourceFile) {
      setErrorMessage(`Cannot export ${job.filename}: original video file is no longer in memory. Re-upload this file and try again.`);
      return;
    }

    const lines = extractSubtitleLines(job.result);
    if (lines.length === 0) {
      setErrorMessage('No subtitle lines found in OCR result.');
      return;
    }

    setErrorMessage(null);
    setExportingJobId(job.job_id);

    try {
      const srtContent = buildSrtFromLines(lines);
      const srtBlob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const formData = new FormData();
      formData.append('video_file', job.sourceFile);
      formData.append('srt_file', srtBlob, 'sub.srt');
      formData.append('font_size', '20');
      formData.append('color', '#ffffff');
      formData.append('alignment', '2');
      formData.append('bg_opacity', '70');
      formData.append('stroke_enabled', 'false');
      formData.append('stroke_color', '#000000');
      formData.append('stroke_size', '2');
      formData.append('margin_v', '15');
      formData.append('margin_h', '15');
      formData.append('padding_h', '14');
      formData.append('padding_v', '6');
      formData.append('blur_rect_enabled', 'false');
      formData.append('blur_rect_x_pct', '19');
      formData.append('blur_rect_y_pct', '85');
      formData.append('blur_rect_width_pct', '60');
      formData.append('blur_rect_height_pct', '11');
      formData.append('blur_rect_opacity', '9');
      formData.append('blur_rect_blur', '4');
      formData.append('blur_rect_color', '#ffffff');

      const startRes = await fetch('/api/video/export/start', {
        method: 'POST',
        body: formData,
      });
      if (!startRes.ok) {
        const text = await startRes.text();
        throw new Error(text || 'Failed to start export');
      }

      const { job_id } = await startRes.json();

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusRes = await fetch(`/api/video/export/status/${job_id}`);
        if (!statusRes.ok) throw new Error('Failed to get export status');
        const statusData = await statusRes.json();
        if (statusData.status === 'error') {
          throw new Error(statusData.error || 'Export failed during processing');
        }
        if (statusData.status === 'done') break;
      }

      const downloadRes = await fetch(`/api/video/export/download/${job_id}`);
      if (!downloadRes.ok) throw new Error('Failed to download exported video');

      const blob = await downloadRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = (job.filename || 'queue_ocr').replace(/\.[^.]+$/, '');
      a.href = url;
      a.download = `${base}_subbed.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Queue OCR export failed', err);
      setErrorMessage(err instanceof Error ? err.message : 'Queue OCR export failed');
    } finally {
      setExportingJobId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Worker Queue OCR</h1>
        <button 
          onClick={clearQueue}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          Clear Queue
        </button>
      </div>

      <div className="mb-8">
        <MultiDropZone 
          accept="video/*"
          icon="📋"
          label="Drop video files here"
          sublabel="Upload multiple segments to queue OCR"
          onFiles={(files) => { void handleUpload(files); }}
        />
        {isUploading && <p className="mt-2 text-text-secondary">Uploading files to queue...</p>}
        {backendUnavailable && (
          <p className="mt-2 text-amber-600 text-sm">Backend is offline. Start it from backend folder: python -m uvicorn main:app --reload --port 8000</p>
        )}
        {errorMessage && <p className="mt-2 text-red-500 text-sm">{errorMessage}</p>}
      </div>

      <div className="space-y-4">
        {jobs.map(job => (
          <div key={job.job_id} className="bg-bg-secondary p-4 rounded-lg shadow border border-border-primary">
            <div className="flex justify-between mb-2">
              <span className="font-semibold text-text-primary truncate" title={job.filename}>
                {job.filename}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                job.status === 'finished' ? 'bg-green-100 text-green-800' :
                job.status === 'failed' ? 'bg-red-100 text-red-800' :
                job.status === 'started' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {job.status.toUpperCase()}
              </span>
            </div>
            
            <div className="w-full bg-bg-primary rounded-full h-2.5 mt-2">
              <div 
                className={`h-2.5 rounded-full transition-all duration-300 ${job.status === 'finished' ? 'bg-green-500' : 'bg-primary'}`} 
                style={{ width: `${job.status === 'finished' ? 100 : Math.max(0, Math.min(100, job.progress || 0))}%` }}
              ></div>
            </div>
            {job.status === 'finished' && job.result && (
              <>
                <div className="mt-4 p-3 bg-bg-primary text-xs rounded border border-border-primary max-h-48 overflow-y-auto space-y-2">
                  {extractSubtitleLines(job.result).length > 0 ? (
                    extractSubtitleLines(job.result).slice(0, 6).map((line, idx) => (
                      <div key={`${job.job_id}-${idx}`} className="text-text-secondary">
                        <span className="text-text-tertiary">{secondsToSrt(line.start)} - {secondsToSrt(line.end)}</span>
                        <p className="text-text-primary break-words">{line.text}</p>
                      </div>
                    ))
                  ) : (
                    <pre>{JSON.stringify(job.result, null, 2)}</pre>
                  )}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                    onClick={() => downloadJobSrt(job)}
                  >
                    Download SRT
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-accent-primary text-white text-xs rounded-md hover:opacity-90 disabled:opacity-50"
                    onClick={() => { void exportVideoWithSrt(job); }}
                    disabled={exportingJobId === job.job_id}
                  >
                    {exportingJobId === job.job_id ? 'Exporting...' : 'Export Video (SRT Exporter)'}
                  </button>
                </div>
              </>
            )}
            {job.status === 'started' && (
              <div className="mt-2 flex justify-between items-center text-xs text-text-secondary">
                <p>Worker is actively processing this job...</p>
                <span className="font-semibold">{Math.round(job.progress || 0)}%</span>
              </div>
            )}
            {job.status === 'failed' && job.error && (
              <p className="mt-2 text-xs text-red-500">{job.error}</p>
            )}
          </div>
        ))}
        {jobs.length === 0 && !isUploading && (
          <div className="text-center text-text-secondary py-8 bg-bg-secondary rounded-lg border border-dashed border-border-primary">
            No jobs in queue. Upload videos to begin processing.
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueOcrPage;
