# AI Video Editor - Page Layouts

## Page Structure

### Main App Layout
```typescript
// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import UploadPage from './pages/UploadPage';
import EditorPage from './pages/EditorPage';
import PreviewPage from './pages/PreviewPage';
import DashboardPage from './pages/DashboardPage';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-background text-white">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/preview" element={<PreviewPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;
```

## Page Components

### 1. Upload Page
```typescript
// src/pages/UploadPage.tsx
import React, { useState } from 'react';
import { PrimaryButton, OutlineButton } from '../components/Button';
import { SurfaceCard } from '../components/Card';
import { LinearProgress } from '../components/Progress';

interface UploadPageProps {
  onUpload: (file: File) => void;
  onContinue: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onUpload, onContinue }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onUpload(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Upload Video</h1>
      
      <SurfaceCard title="Select Video File" padding="lg">
        <div className="space-y-4">
          {/* File Input */}
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="cursor-pointer block"
            >
              <div className="text-4xl mb-2">📹</div>
              <p className="text-slate-300 mb-2">
                {selectedFile ? selectedFile.name : 'Click to select video file'}
              </p>
              <p className="text-sm text-slate-500">
                Supports MP4, MOV, AVI, WebM
              </p>
            </label>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <LinearProgress
                value={uploadProgress}
                label="Uploading"
                color="primary"
              />
              <p className="text-sm text-slate-400">
                {uploadProgress}% complete
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <PrimaryButton
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </PrimaryButton>
            <OutlineButton
              onClick={onContinue}
              disabled={!selectedFile}
            >
              Continue to Editor
            </OutlineButton>
          </div>
        </div>
      </SurfaceCard>

      {/* File Info */}
      {selectedFile && (
        <SurfaceCard title="File Information" className="mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Name:</span>
              <span className="ml-2 text-white">{selectedFile.name}</span>
            </div>
            <div>
              <span className="text-slate-400">Size:</span>
              <span className="ml-2 text-white">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <div>
              <span className="text-slate-400">Type:</span>
              <span className="ml-2 text-white">{selectedFile.type}</span>
            </div>
            <div>
              <span className="text-slate-400">Last Modified:</span>
              <span className="ml-2 text-white">
                {selectedFile.lastModified.toLocaleDateString()}
              </span>
            </div>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
};

export default UploadPage;
```

### 2. Editor Page
```typescript
// src/pages/EditorPage.tsx
import React, { useState } from 'react';
import { SurfaceCard } from '../components/Card';
import ControlPanel from '../components/ControlPanel';
import VideoPreview from '../components/VideoPreview';
import { EditSettings } from '../components/ControlPanel';

interface EditorPageProps {
  videoUrl: string;
  onExport: () => void;
  onBack: () => void;
}

const EditorPage: React.FC<EditorPageProps> = ({ videoUrl, onExport, onBack }) => {
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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Video Editor</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Preview */}
        <div className="lg:col-span-2">
          <SurfaceCard title="Preview" padding="lg">
            <VideoPreview
              videoUrl={videoUrl}
              settings={settings}
            />
          </SurfaceCard>
        </div>

        {/* Control Panel */}
        <div className="lg:col-span-1">
          <ControlPanel
            onEdit={handleEdit}
            onExport={onExport}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          Back to Upload
        </button>
      </div>
    </div>
  );
};

export default EditorPage;
```

### 3. Preview Page
```typescript
// src/pages/PreviewPage.tsx
import React, { useState } from 'react';
import { SurfaceCard } from '../components/Card';
import { PrimaryButton, OutlineButton } from '../components/Button';
import { LinearProgress } from '../components/Progress';

interface PreviewPageProps {
  videoUrl: string;
  onExport: () => void;
  onBack: () => void;
  onDownload: () => void;
}

const PreviewPage: React.FC<PreviewPageProps> = ({ 
  videoUrl, 
  onExport, 
  onBack,
  onDownload 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          onExport();
          return 100;
        }
        return prev + 5;
      });
    }, 300);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Preview & Export</h1>
      
      <SurfaceCard title="Final Video Preview" padding="lg">
        <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center mb-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-slate-400">Video Preview</p>
            <p className="text-sm text-slate-500 mt-2">
              {videoUrl ? 'Video loaded' : 'No video selected'}
            </p>
          </div>
        </div>

        {/* Export Progress */}
        {isExporting && (
          <div className="space-y-2 mb-4">
            <LinearProgress
              value={exportProgress}
              label="Exporting"
              color="primary"
            />
            <p className="text-sm text-slate-400">
              {exportProgress}% complete
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <PrimaryButton
            onClick={handleExport}
            disabled={isExporting || !videoUrl}
          >
            {isExporting ? 'Exporting...' : 'Export Video'}
          </PrimaryButton>
          <OutlineButton
            onClick={onDownload}
            disabled={!videoUrl}
          >
            Download
          </OutlineButton>
          <OutlineButton
            onClick={onBack}
          >
            Back to Editor
          </OutlineButton>
        </div>
      </SurfaceCard>

      {/* Export Settings */}
      <SurfaceCard title="Export Settings" className="mt-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-400">Format:</span>
            <span className="text-white">MP4</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Quality:</span>
            <span className="text-white">High (1080p)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Estimated Size:</span>
            <span className="text-white">~50 MB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Estimated Time:</span>
            <span className="text-white">~2 minutes</span>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default PreviewPage;
```

### 4. Dashboard Page
```typescript
// src/pages/DashboardPage.tsx
import React from 'react';
import { SurfaceCard } from '../components/Card';
import { PrimaryButton, OutlineButton } from '../components/Button';

interface DashboardPageProps {
  onNewProject: () => void;
  onViewHistory: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNewProject, onViewHistory }) => {
  const stats = [
    { label: 'Total Videos', value: '12', color: 'indigo' },
    { label: 'This Month', value: '5', color: 'purple' },
    { label: 'Storage Used', value: '2.4 GB', color: 'amber' },
    { label: 'Exported', value: '8', color: 'green' },
  ];

  const recentProjects = [
    { name: 'Summer Vacation', date: '2026-02-05', status: 'Exported' },
    { name: 'Product Demo', date: '2026-02-03', status: 'In Progress' },
    { name: 'Tutorial Video', date: '2026-02-01', status: 'Exported' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <SurfaceCard key={index} padding="md">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-slate-400">{stat.label}</p>
            </div>
          </SurfaceCard>
        ))}
      </div>

      {/* Quick Actions */}
      <SurfaceCard title="Quick Actions" className="mb-6">
        <div className="flex gap-4">
          <PrimaryButton onClick={onNewProject}>
            New Project
          </PrimaryButton>
          <OutlineButton onClick={onViewHistory}>
            View History
          </OutlineButton>
        </div>
      </SurfaceCard>

      {/* Recent Projects */}
      <SurfaceCard title="Recent Projects">
        <div className="space-y-3">
          {recentProjects.map((project, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-3 bg-surface-light rounded-lg"
            >
              <div>
                <p className="font-medium text-white">{project.name}</p>
                <p className="text-sm text-slate-400">{project.date}</p>
              </div>
              <span className={`text-sm px-2 py-1 rounded ${
                project.status === 'Exported' 
                  ? 'bg-green-900 text-green-300' 
                  : 'bg-amber-900 text-amber-300'
              }`}>
                {project.status}
              </span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
};

export default DashboardPage;
```

## Navigation Components

### Header Component
```typescript
// src/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  return (
    <header className="bg-surface border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-white">
            AI Video Editor
          </Link>
          <nav className="flex gap-4 ml-8">
            <Link
              to="/"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/upload"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Upload
            </Link>
            <Link
              to="/editor"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Editor
            </Link>
            <Link
              to="/preview"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Preview
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-slate-300">Welcome, User</div>
          <button className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg">
            Settings
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
```

### Sidebar Component
```typescript
// src/components/Sidebar.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/upload', label: 'Upload', icon: '📹' },
    { path: '/editor', label: 'Editor', icon: '✂️' },
    { path: '/preview', label: 'Preview', icon: '🎬' },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-slate-700 min-h-screen p-4">
      <div className="space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg
              transition-colors duration-200
              ${
                location.pathname === item.path
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }
            `}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 pt-8 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button className="w-full text-left px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            📁 Open Project
          </button>
          <button className="w-full text-left px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            💾 Save Project
          </button>
          <button className="w-full text-left px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            ⚙️ Settings
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
```

## Page Flow

### User Journey
1. **Dashboard** → User lands here first
2. **Upload** → User uploads video
3. **Editor** → User edits video with controls
4. **Preview** → User previews and exports
5. **Dashboard** → User sees updated stats

### State Management
```typescript
// src/types.ts
interface AppState {
  currentVideo: File | null;
  videoUrl: string;
  editSettings: EditSettings;
  exportStatus: 'idle' | 'exporting' | 'completed' | 'error';
  projectHistory: Project[];
}

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'exported' | 'failed';
  videoUrl?: string;
  settings?: EditSettings;
}
```

## Next Steps

1. Create VideoPreview component
2. Create assets (icons, images)
3. Create responsive design
4. Create dark/light mode support
5. Create animation system

**Next File:** `assets.md` - Assets documentation