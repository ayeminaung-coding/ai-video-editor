// DashboardPage.tsx - User Dashboard Page
// React component for user dashboard and video history

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Video {
  id: string;
  name: string;
  duration: string;
  status: 'completed' | 'processing' | 'failed';
  createdAt: string;
}

interface DashboardPageProps {
  videos: Video[];
}

const DashboardPage: React.FC<DashboardPageProps> = ({ videos }) => {
  const navigate = useNavigate();

  const handleUpload = () => {
    navigate('/upload');
  };

  const handleEdit = (videoId: string) => {
    navigate('/editor');
  };

  const handlePreview = (videoId: string) => {
    navigate('/preview');
  };

  const handleDelete = (videoId: string) => {
    console.log('Delete video:', videoId);
  };

  // Sample videos for demo
  const sampleVideos: Video[] = [
    {
      id: '1',
      name: 'My TikTok Video',
      duration: '0:30',
      status: 'completed',
      createdAt: '2026-02-07',
    },
    {
      id: '2',
      name: 'Product Demo',
      duration: '1:15',
      status: 'processing',
      createdAt: '2026-02-06',
    },
    {
      id: '3',
      name: 'Tutorial Video',
      duration: '2:45',
      status: 'failed',
      createdAt: '2026-02-05',
    },
  ];

  const displayVideos = videos.length > 0 ? videos : sampleVideos;

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
              Dashboard
            </h1>
            <p className="text-text-secondary text-sm md:text-base">
              Manage your videos and editing history
            </p>
          </div>
          <button
            onClick={handleUpload}
            className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-dark transition-colors text-sm md:text-base"
          >
            + New Video
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-secondary rounded-xl p-4">
            <div className="text-2xl font-bold text-text-primary">12</div>
            <div className="text-sm text-text-secondary">Total Videos</div>
          </div>
          <div className="bg-surface-secondary rounded-xl p-4">
            <div className="text-2xl font-bold text-accent-success">8</div>
            <div className="text-sm text-text-secondary">Completed</div>
          </div>
          <div className="bg-surface-secondary rounded-xl p-4">
            <div className="text-2xl font-bold text-accent-warning">3</div>
            <div className="text-sm text-text-secondary">Processing</div>
          </div>
          <div className="bg-surface-secondary rounded-xl p-4">
            <div className="text-2xl font-bold text-accent-error">1</div>
            <div className="text-sm text-text-secondary">Failed</div>
          </div>
        </div>

        {/* Video List */}
        <div className="bg-surface-secondary rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">Recent Videos</h2>
            <button className="text-sm text-accent-primary hover:underline">
              View All
            </button>
          </div>

          {displayVideos.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎬</div>
              <div className="text-text-secondary mb-2">No videos yet</div>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary-dark transition-colors"
              >
                Upload Your First Video
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {displayVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-3 bg-surface-primary rounded-lg hover:bg-surface-tertiary transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary font-medium truncate">
                      {video.name}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {video.duration} • {video.createdAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span
                      className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${
                          video.status === 'completed'
                            ? 'bg-accent-success/20 text-accent-success'
                            : video.status === 'processing'
                            ? 'bg-accent-warning/20 text-accent-warning'
                            : 'bg-accent-error/20 text-accent-error'
                        }
                      `}
                    >
                      {video.status}
                    </span>
                    <button
                      onClick={() => handlePreview(video.id)}
                      className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                      title="Preview"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => handleEdit(video.id)}
                      className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="p-2 text-text-secondary hover:text-accent-error transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={handleUpload}
            className="bg-surface-secondary rounded-xl p-4 cursor-pointer hover:bg-surface-tertiary transition-colors"
          >
            <div className="text-2xl mb-2">📤</div>
            <div className="text-text-primary font-medium">Upload Video</div>
            <div className="text-sm text-text-secondary">
              Start a new editing project
            </div>
          </div>
          <div
            onClick={() => navigate('/editor')}
            className="bg-surface-secondary rounded-xl p-4 cursor-pointer hover:bg-surface-tertiary transition-colors"
          >
            <div className="text-2xl mb-2">🎬</div>
            <div className="text-text-primary font-medium">Open Editor</div>
            <div className="text-sm text-text-secondary">
              Continue editing a video
            </div>
          </div>
          <div
            onClick={() => navigate('/preview')}
            className="bg-surface-secondary rounded-xl p-4 cursor-pointer hover:bg-surface-tertiary transition-colors"
          >
            <div className="text-2xl mb-2">👁️</div>
            <div className="text-text-primary font-medium">Preview</div>
            <div className="text-sm text-text-secondary">
              View and export videos
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-6 p-4 bg-surface-secondary rounded-xl">
          <h3 className="text-text-primary font-medium mb-2">💡 Tips:</h3>
          <ul className="text-text-secondary text-sm space-y-1">
            <li>• Use 9:16 aspect ratio for TikTok videos</li>
            <li>• Keep videos under 60 seconds for best engagement</li>
            <li>• Add text overlays for better accessibility</li>
            <li>• Use upbeat music for better viewer retention</li>
            <li>• Export in 1080p for best quality</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;