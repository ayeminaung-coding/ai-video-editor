// CreatorWorkflowPage.tsx - Simple local workflow board for content ideas
// Stores data in localStorage only (per browser). Easy to remove or change later.

import React, { useEffect, useState } from 'react';

interface WorkflowItem {
  id: string;
  title: string;
  type: 'movie-recap' | 'cat-meme';
  createdAt: string;
  steps: {
    scriptEn: boolean;
    scriptMm: boolean;
    tts: boolean;
    edited: boolean;
    subtitles: boolean;
    shorts: boolean;
    tiktok: boolean;
    reels: boolean;
  };
}

const STORAGE_KEY = 'creator-workflow-items-v1';

const createEmptySteps = () => ({
  scriptEn: false,
  scriptMm: false,
  tts: false,
  edited: false,
  subtitles: false,
  shorts: false,
  tiktok: false,
  reels: false,
});

const CreatorWorkflowPage: React.FC = () => {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie-recap' | 'cat-meme'>('movie-recap');

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkflowItem[];
        setItems(parsed);
      }
    } catch (err) {
      console.error('Failed to load workflow items', err);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save workflow items', err);
    }
  }, [items]);

  const handleAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const newItem: WorkflowItem = {
      id: now + Math.random().toString(36).slice(2),
      title: trimmed,
      type,
      createdAt: now,
      steps: createEmptySteps(),
    };

    setItems(prev => [newItem, ...prev]);
    setTitle('');
  };

  const toggleStep = (id: string, key: keyof WorkflowItem['steps']) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              steps: {
                ...item.steps,
                [key]: !item.steps[key],
              },
            }
          : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    if (!window.confirm('Remove this workflow item?')) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    if (!window.confirm('Clear all workflow items?')) return;
    setItems([]);
  };

  const stepLabels: { key: keyof WorkflowItem['steps']; label: string }[] = [
    { key: 'scriptEn', label: 'Script EN' },
    { key: 'scriptMm', label: 'Script MM' },
    { key: 'tts', label: 'TTS audio' },
    { key: 'edited', label: 'Edited' },
    { key: 'subtitles', label: 'Subtitles' },
    { key: 'shorts', label: 'Shorts' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'reels', label: 'Reels' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Workflow Board</h1>
            <p className="text-text-secondary text-sm md:text-base mt-1">
              Track the status of each movie recap or cat meme idea across script, TTS, edit, and uploads.
              Data is stored only in this browser.
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-2 text-sm rounded-lg bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
            >
              Clear all
            </button>
          )}
        </header>

        {/* Add form */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium text-text-primary">Add new idea</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Title</label>
              <input
                className="w-full px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="John Wick recap part 1, Funny cat with box, etc."
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Type</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
                value={type}
                onChange={(e) => setType(e.target.value as 'movie-recap' | 'cat-meme')}
              >
                <option value="movie-recap">Movie recap</option>
                <option value="cat-meme">Cat meme</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-primary-dark"
            >
              Add to board
            </button>
          </div>
        </section>

        {/* Items */}
        <section className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-surface-secondary rounded-xl p-4 text-text-secondary text-sm">
              No workflow items yet. Add your first movie recap or cat meme idea above.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const createdDate = new Date(item.createdAt).toLocaleDateString();
                return (
                  <div
                    key={item.id}
                    className="bg-surface-secondary rounded-xl p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-medium text-text-primary truncate">
                          {item.title}
                        </h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-surface-primary text-text-secondary">
                          {item.type === 'movie-recap' ? 'Movie recap' : 'Cat meme'}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary">
                        Created: {createdDate}
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
                        {stepLabels.map((step) => (
                          <label
                            key={step.key}
                            className="inline-flex items-center gap-1 cursor-pointer select-none text-text-secondary"
                          >
                            <input
                              type="checkbox"
                              checked={item.steps[step.key]}
                              onChange={() => toggleStep(item.id, step.key)}
                              className="h-3 w-3 accent-accent-primary"
                            />
                            <span>{step.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start justify-end">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-3 py-2 text-xs rounded-lg bg-surface-primary text-accent-error hover:bg-surface-tertiary"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CreatorWorkflowPage;
