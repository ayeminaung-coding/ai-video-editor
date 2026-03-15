import React, { useEffect, useState } from 'react';
import DropZone from './components/DropZone';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:8000';

interface SplitStatus {
  status: 'queued' | 'processing' | 'done' | 'error';
  error: string | null;
  files: string[];
}

const VideoSplitterPage: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<SplitStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let interval: number;

    const pollStatus = async () => {
      if (!jobId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/video-splitter/status/${jobId}`);
        if (!res.ok) throw new Error('Status fetch failed');
        const data: SplitStatus = await res.json();
        setStatus(data);
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to get status:', err);
      }
    };

    if (jobId && status?.status !== 'done' && status?.status !== 'error') {
      interval = window.setInterval(pollStatus, 2000);
      pollStatus(); // Initial call
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, status?.status]);

  const handleUpload = async (file: File) => {
    setVideoFile(file);
    setIsUploading(true);
    setJobId(null);
    setStatus(null);

    const formData = new FormData();
    formData.append('video_file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/video-splitter/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload request failed');
      const data = await res.json();
      setJobId(data.job_id);
      setStatus({ status: 'queued', error: null, files: [] });
    } catch (err) {
      console.error('Failed to upload video:', err);
      setStatus({ status: 'error', error: 'Upload failed', files: [] });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    if (!jobId) return;
    
    // Attempt download using browser way
    const downloadUrl = `${API_BASE_URL}/api/video-splitter/download/${jobId}/${filename}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = async () => {
    if (jobId) {
      // Optional: Cleanup backend
      try {
        await fetch(`${API_BASE_URL}/api/video-splitter/cleanup/${jobId}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.error('Failed to cleanup');
      }
    }
    setVideoFile(null);
    setJobId(null);
    setStatus(null);
    setIsUploading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-accent-primary/10 rounded-xl">
          <span className="text-2xl block" role="img" aria-label="split">✂️</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Video Splitter</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Split a long video into segments of exactly 2 minutes and 15 seconds.
          </p>
        </div>
      </div>

      {!jobId && !isUploading && (
        <div className="bg-surface-primary rounded-xl p-6 border border-border-primary">
          <DropZone
            onFile={handleUpload}
            accept="video/*"
            icon="📁"
            label="Upload Video to Split"
            sublabel="MP4, MOV, AVI formats supported"
          />
        </div>
      )}

      {isUploading && (
        <div className="bg-surface-primary rounded-xl p-8 text-center border border-border-primary">
          <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-text-primary">Uploading Video...</h3>
          <p className="text-sm text-text-secondary mt-2">Please wait while the video is being uploaded.</p>
        </div>
      )}

      {jobId && status && !isUploading && (
        <div className="bg-surface-primary rounded-xl border border-border-primary p-6 space-y-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium text-text-primary flex justify-between items-center">
              Processing Status: 
              <span className={`px-3 py-1 rounded-full text-xs font-semibold
                ${status.status === 'done' ? 'bg-green-500/10 text-green-500' :
                  status.status === 'error' ? 'bg-red-500/10 text-red-500' :
                  'bg-yellow-500/10 text-yellow-500'}`}>
                {status.status.toUpperCase()}
              </span>
            </h3>
            
            {status.status === 'queued' && (
              <p className="text-text-secondary text-sm">Waiting in queue...</p>
            )}
            {status.status === 'processing' && (
              <div className="space-y-4 text-center mt-4 mb-4">
                <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-text-secondary text-sm animate-pulse">Splitting video into 2:15 segments...</p>
              </div>
            )}
            {status.status === 'error' && (
              <div className="bg-red-500/10 text-red-500 p-4 rounded-lg mt-2 font-mono text-sm break-all overflow-x-auto">
                {status.error || 'Unknown error occurred'}
              </div>
            )}
            
            {status.status === 'done' && (
              <div className="space-y-4 py-4">
                <div className="text-sm text-green-500 bg-green-500/10 p-3 rounded-lg text-center">
                  Successfully split the video into {status.files.length} parts!
                </div>
                
                <h4 className="font-semibold text-text-primary mt-4 border-b border-border-primary pb-2">Generated Parts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {status.files.map((file, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-3 bg-surface-secondary rounded-lg border border-border-primary hover:border-accent-primary/50 transition-colors">
                      <span className="text-sm text-text-primary font-medium break-words w-full" title={file}>
                        {file}
                      </span>
                      <button
                        onClick={() => handleDownload(file)}
                        className="px-4 py-1.5 self-end bg-accent-primary hover:bg-accent-primary-dark text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <span>📥</span> Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border-primary flex justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2 hover:bg-surface-secondary text-text-primary rounded-lg text-sm font-medium transition-colors shadow-sm border border-border-primary"
            >
              Upload Another Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoSplitterPage;
