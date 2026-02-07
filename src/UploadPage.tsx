// UploadPage.tsx - Video Upload Page
// React component for uploading videos

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideoMetadata } from './api';

interface UploadPageProps {
  onUpload: (file: File) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onUpload }) => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setError('File size must be less than 500MB');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    // Call backend to register the upload (metadata only for now)
    void uploadVideoMetadata(file);

    // Simulate upload progress locally for UX
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          onUpload(file);
          navigate('/editor');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
          Upload Video
        </h1>
        <p className="text-text-secondary mb-6">
          Upload a video to start editing. Supports MP4, WebM, and MOV formats.
        </p>

        {/* Upload Area */}
        <div
          className={`
            border-2 border-dashed rounded-xl p-8 text-center
            transition-all duration-200
            ${isDragging ? 'border-accent-primary bg-accent-primary/10' : 'border-border-primary'}
            ${isUploading ? 'opacity-50' : 'hover:border-accent-primary'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="space-y-4">
              <div className="text-text-primary text-lg font-medium">
                Uploading...
              </div>
              <div className="w-full bg-surface-secondary rounded-full h-2">
                <div
                  className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-text-secondary text-sm">
                {uploadProgress}%
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-4">🎬</div>
              <div className="text-text-primary text-lg font-medium mb-2">
                Drag & drop your video here
              </div>
              <div className="text-text-secondary text-sm mb-4">
                or click to browse
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileInput}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary text-white rounded-lg cursor-pointer hover:bg-accent-primary-dark transition-colors"
              >
                <span>Choose File</span>
              </label>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-accent-error/10 border border-accent-error rounded-lg text-accent-error">
            {error}
          </div>
        )}

        {/* File Requirements */}
        <div className="mt-6 p-4 bg-surface-secondary rounded-lg">
          <h3 className="text-text-primary font-medium mb-2">Requirements:</h3>
          <ul className="text-text-secondary text-sm space-y-1">
            <li>• Video format: MP4, WebM, MOV</li>
            <li>• Max file size: 500MB</li>
            <li>• Max duration: 10 minutes</li>
            <li>• Recommended: 1080p or 720p</li>
          </ul>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-4 py-3 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/preview')}
            className="flex-1 px-4 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-dark transition-colors"
          >
            Preview Existing
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;