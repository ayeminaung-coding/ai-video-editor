// PreviewPage.tsx - Video Preview & Export Page
// React component for previewing and exporting videos

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface EditSettings {
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  brightness: number;
  contrast: number;
  textOverlay: string;
  music: string;
}

interface PreviewPageProps {
  videoFile: File | null;
  settings: EditSettings;
  onExport: (settings: EditSettings) => void;
}

const PreviewPage: React.FC<PreviewPageProps> = ({ videoFile, settings, onExport }) => {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportQuality, setExportQuality] = useState('1080p');
  const [exportFormat, setExportFormat] = useState('mp4');
  const [exportFrameRate, setExportFrameRate] = useState('30');

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);

    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          onExport(settings);
          return 100;
        }
        return prev + 5;
      });
    }, 300);
  };

  const handleBack = () => {
    navigate('/editor');
  };

  const handleDownload = () => {
    // In a real app, this would download the exported video
    console.log('Downloading video...');
  };

  // If no video file, redirect to upload
  if (!videoFile) {
    navigate('/upload');
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
              Preview & Export
            </h1>
            <p className="text-text-secondary text-sm md:text-base">
              Review your edits and export your video
            </p>
          </div>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm md:text-base"
          >
            Back to Editor
          </button>
        </div>

        {/* Video Preview */}
        <div className="bg-surface-primary rounded-xl p-4 mb-6">
          <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-4xl mb-2">🎬</div>
              <div className="text-lg font-medium">Video Preview</div>
              <div className="text-sm text-gray-400 mt-1">
                {videoFile.name}
              </div>
            </div>
          </div>
        </div>

        {/* Export Settings */}
        <div className="bg-surface-secondary rounded-xl p-4 mb-6">
          <h3 className="text-text-primary font-medium mb-4">Export Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quality */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">Quality</label>
              <select
                value={exportQuality}
                onChange={(e) => setExportQuality(e.target.value)}
                className="w-full px-3 py-2 bg-surface-primary border border-border-primary rounded-lg text-text-primary"
              >
                <option value="480p">480p (SD)</option>
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="w-full px-3 py-2 bg-surface-primary border border-border-primary rounded-lg text-text-primary"
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
              </select>
            </div>

            {/* Frame Rate */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">Frame Rate</label>
              <select
                value={exportFrameRate}
                onChange={(e) => setExportFrameRate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-primary border border-border-primary rounded-lg text-text-primary"
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="mt-4">
            <label className="block text-sm text-text-secondary mb-2">Aspect Ratio</label>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-accent-primary text-white rounded-lg"
              >
                9:16 (TikTok)
              </button>
              <button
                className="px-4 py-2 bg-surface-primary text-text-primary rounded-lg hover:bg-surface-tertiary"
              >
                1:1
              </button>
              <button
                className="px-4 py-2 bg-surface-primary text-text-primary rounded-lg hover:bg-surface-tertiary"
              >
                16:9
              </button>
            </div>
          </div>
        </div>

        {/* Settings Summary */}
        <div className="bg-surface-secondary rounded-xl p-4 mb-6">
          <h3 className="text-text-primary font-medium mb-2">Edit Settings Summary:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="text-text-secondary">
              Trim: {settings.trimStart}s - {settings.trimEnd}s
            </div>
            <div className="text-text-secondary">
              Speed: {settings.speed}x
            </div>
            <div className="text-text-secondary">
              Volume: {Math.round(settings.volume * 100)}%
            </div>
            <div className="text-text-secondary">
              Brightness: {Math.round(settings.brightness * 100)}%
            </div>
            <div className="text-text-secondary">
              Contrast: {Math.round(settings.contrast * 100)}%
            </div>
            <div className="text-text-secondary">
              Text: {settings.textOverlay || 'None'}
            </div>
            <div className="text-text-secondary">
              Music: {settings.music || 'None'}
            </div>
            <div className="text-text-secondary">
              File: {videoFile.name}
            </div>
          </div>
        </div>

        {/* Export Button */}
        {isExporting ? (
          <div className="bg-surface-secondary rounded-xl p-4">
            <div className="text-text-primary font-medium mb-2">Exporting...</div>
            <div className="w-full bg-surface-primary rounded-full h-2 mb-2">
              <div
                className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="text-text-secondary text-sm">
              {exportProgress}%
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={handleExport}
              className="flex-1 px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-dark transition-colors font-medium"
            >
              Export Video
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 px-6 py-3 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors font-medium"
            >
              Download
            </button>
          </div>
        )}

        {/* Export Tips */}
        <div className="mt-6 p-4 bg-surface-secondary rounded-lg">
          <h3 className="text-text-primary font-medium mb-2">Export Tips:</h3>
          <ul className="text-text-secondary text-sm space-y-1">
            <li>• Use 1080p for best quality</li>
            <li>• MP4 format is most compatible</li>
            <li>• 30 FPS is standard for TikTok</li>
            <li>• 9:16 aspect ratio for TikTok videos</li>
            <li>• Export may take a few minutes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;