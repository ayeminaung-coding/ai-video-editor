// EditorPage.tsx - Video Editor Page
// React component for video editing interface

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ControlPanel from './ControlPanel';
import VideoPreview from './VideoPreview';

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

interface EditorPageProps {
  videoFile: File | null;
  onExport: (settings: EditSettings) => void;
}

const EditorPage: React.FC<EditorPageProps> = ({ videoFile, onExport }) => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<EditSettings>({
    trimStart: 0,
    trimEnd: 100,
    speed: 1,
    volume: 1,
    brightness: 1,
    contrast: 1,
    textOverlay: '',
    music: '',
  });

  const handleEdit = (newSettings: EditSettings) => {
    setSettings(newSettings);
  };

  const handleExport = () => {
    onExport(settings);
    navigate('/preview');
  };

  const handleBack = () => {
    navigate('/upload');
  };

  const handleSave = () => {
    // Save current settings
    console.log('Settings saved:', settings);
  };

  // If no video file, redirect to upload
  if (!videoFile) {
    navigate('/upload');
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
              Video Editor
            </h1>
            <p className="text-text-secondary text-sm md:text-base">
              Edit your video with AI-powered tools
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm md:text-base"
            >
              Save
            </button>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm md:text-base"
            >
              Back
            </button>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Video Preview Area */}
          <div className="lg:col-span-2 space-y-4">
            <VideoPreview
              videoUrl={videoFile ? URL.createObjectURL(videoFile) : ''}
              settings={settings}
            />

            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              {/* Basic speed tweaks */}
              <button
                onClick={() => setSettings(prev => ({ ...prev, speed: 0.5 }))}
                className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
              >
                0.5x Speed
              </button>
              <button
                onClick={() => setSettings(prev => ({ ...prev, speed: 1 }))}
                className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
              >
                1x Speed
              </button>
              <button
                onClick={() => setSettings(prev => ({ ...prev, speed: 2 }))}
                className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
              >
                2x Speed
              </button>

              {/* Presets for creator workflows */}
              <button
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    speed: 1,
                    brightness: 1.1,
                    contrast: 1.1,
                  }))
                }
                className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
              >
                TikTok Recap
              </button>
              <button
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    speed: 1,
                    brightness: 1.15,
                    contrast: 1.2,
                  }))
                }
                className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
              >
                Cat Meme Pop
              </button>
              <button
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    speed: 0.75,
                    brightness: 0.95,
                    contrast: 1.1,
                  }))
                }
                className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
              >
                Dark Cinema
              </button>
            </div>
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-1">
            <ControlPanel
              onEdit={handleEdit}
              onExport={handleExport}
            />
          </div>
        </div>

        {/* Settings Summary */}
        <div className="mt-6 p-4 bg-surface-secondary rounded-lg">
          <h3 className="text-text-primary font-medium mb-2">Current Settings:</h3>
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
      </div>
    </div>
  );
};

export default EditorPage;