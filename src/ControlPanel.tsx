// ControlPanel.tsx - AI Video Editor for TikTok
// React + TypeScript component for video editing controls

import React, { useState } from 'react';

interface ControlPanelProps {
  onEdit: (settings: EditSettings) => void;
  onExport: () => void;
}

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

const ControlPanel: React.FC<ControlPanelProps> = ({ onEdit, onExport }) => {
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

  const handleUpdate = (key: keyof EditSettings, value: number | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    onEdit({ ...settings, [key]: value });
  };

  return (
    <div className="control-panel bg-surface-primary text-text-primary p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Control Panel</h2>
      
      {/* Trim Controls */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Trim (seconds)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={settings.trimStart}
            onChange={(e) => handleUpdate('trimStart', Number(e.target.value))}
            className="bg-surface-secondary border border-border-primary p-2 rounded w-20 text-text-primary"
            placeholder="Start"
          />
          <input
            type="number"
            value={settings.trimEnd}
            onChange={(e) => handleUpdate('trimEnd', Number(e.target.value))}
            className="bg-surface-secondary border border-border-primary p-2 rounded w-20 text-text-primary"
            placeholder="End"
          />
        </div>
      </div>

      {/* Speed Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Speed: {settings.speed}x</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={settings.speed}
          onChange={(e) => handleUpdate('speed', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Volume Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Volume: {Math.round(settings.volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.volume}
          onChange={(e) => handleUpdate('volume', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Brightness Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Brightness: {Math.round(settings.brightness * 100)}%</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.brightness}
          onChange={(e) => handleUpdate('brightness', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Contrast Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Contrast: {Math.round(settings.contrast * 100)}%</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.contrast}
          onChange={(e) => handleUpdate('contrast', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Text Overlay */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Text Overlay</label>
        <input
          type="text"
          value={settings.textOverlay}
          onChange={(e) => handleUpdate('textOverlay', e.target.value)}
          className="bg-surface-secondary border border-border-primary p-2 rounded w-full text-text-primary"
          placeholder="Enter text..."
        />
      </div>

      {/* Music Selection */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Music</label>
        <select
          value={settings.music}
          onChange={(e) => handleUpdate('music', e.target.value)}
          className="bg-surface-secondary border border-border-primary p-2 rounded w-full text-text-primary"
        >
          <option value="">Select music...</option>
          <option value="upbeat">Upbeat</option>
          <option value="chill">Chill</option>
          <option value="epic">Epic</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Export Button */}
      <button
        onClick={onExport}
        className="bg-accent-primary hover:bg-accent-primary-dark px-4 py-2 rounded w-full text-white font-medium transition-colors"
      >
        Export Video
      </button>
    </div>
  );
};

export default ControlPanel;