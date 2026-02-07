// App.tsx - Main Application Component
// React component for the main application layout and routing

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import Header from './Header';
import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import UploadPage from './UploadPage';
import EditorPage from './EditorPage';
import PreviewPage from './PreviewPage';
import CreatorToolsPage from './CreatorToolsPage';
import ScriptHelperPage from './ScriptHelperPage';
import WorkflowsPage from './WorkflowsPage';

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

interface Video {
  id: string;
  name: string;
  duration: string;
  status: 'completed' | 'processing' | 'failed';
  createdAt: string;
}

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleUpload = (file: File) => {
    setVideoFile(file);
    // Add to videos list
    const newVideo: Video = {
      id: Date.now().toString(),
      name: file.name,
      duration: '0:00',
      status: 'processing',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setVideos(prev => [newVideo, ...prev]);
  };

  const handleEdit = (newSettings: EditSettings) => {
    setSettings(newSettings);
  };

  const handleExport = (exportSettings: EditSettings) => {
    console.log('Exporting with settings:', exportSettings);
    // Update video status
    setVideos(prev =>
      prev.map(v =>
        v.id === videos[0]?.id
          ? { ...v, status: 'completed' }
          : v
      )
    );
  };

  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-bg-primary">
          <Header />
          <div className="flex">
            <Sidebar onToggle={setSidebarOpen} />
            <main className={`flex-1 transition-all duration-200 ${sidebarOpen ? 'ml-64' : ''}`}>
              <Routes>
                <Route
                  path="/"
                  element={<DashboardPage videos={videos} />}
                />
                <Route
                  path="/dashboard"
                  element={<DashboardPage videos={videos} />}
                />
                <Route
                  path="/upload"
                  element={<UploadPage onUpload={handleUpload} />}
                />
                <Route
                  path="/editor"
                  element={
                    <EditorPage
                      videoFile={videoFile}
                      onExport={handleEdit}
                    />
                  }
                />
                <Route
                  path="/preview"
                  element={
                    <PreviewPage
                      videoFile={videoFile}
                      settings={settings}
                      onExport={handleExport}
                    />
                  }
                />
                <Route
                  path="/creator"
                  element={<CreatorToolsPage />}
                />
                <Route
                  path="/creator/script-helper"
                  element={<ScriptHelperPage />}
                />
                <Route
                  path="/creator/workflows"
                  element={<WorkflowsPage />}
                />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;