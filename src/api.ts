// api.ts - Backend API client

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'https://ai-video-editor-backend-production.up.railway.app';

export interface ApiVideo {
  id: string;
  title?: string;
  filename?: string;
  name?: string;
  status: 'completed' | 'processing' | 'failed';
  createdAt: string;
}

export const getHealth = async () => {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
};

export const getVideos = async (): Promise<ApiVideo[]> => {
  const res = await fetch(`${API_BASE_URL}/api/videos`);
  if (!res.ok) throw new Error('Failed to fetch videos');
  return res.json();
};

export const uploadVideoMetadata = async (file: File) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
      }),
    });

    if (!res.ok) {
      console.error('Upload metadata failed', await res.text());
      return null;
    }

    return res.json();
  } catch (err) {
    console.error('Upload metadata error', err);
    return null;
  }
};
