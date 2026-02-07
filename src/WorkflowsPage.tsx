// WorkflowsPage.tsx - Simple viewer for creator workflows
// This page just explains your repeatable processes. Easy to remove.

import React from 'react';

const WorkflowsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Workflows</h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            High-level guides for movie recap and cat meme production. Use this as a checklist
            while you work.
          </p>
        </header>

        <section className="bg-surface-secondary rounded-xl p-4 space-y-2">
          <h2 className="text-lg font-medium text-text-primary">Movie Recap</h2>
          <ul className="text-text-secondary text-sm list-disc pl-5 space-y-1">
            <li>Pick movie and angle (full story / ending explained / what you missed).</li>
            <li>Generate EN + MM scripts using Script Helper + AI writer.</li>
            <li>Create voiceover with Gemini TTS (EN and optional MM).</li>
            <li>Collect clips or b-roll, edit in AI Video Editor, add subtitles.</li>
            <li>Export one 9:16 video and post to Shorts, TikTok, and Reels.</li>
          </ul>
        </section>

        <section className="bg-surface-secondary rounded-xl p-4 space-y-2">
          <h2 className="text-lg font-medium text-text-primary">Cat Memes</h2>
          <ul className="text-text-secondary text-sm list-disc pl-5 space-y-1">
            <li>Collect cat clips (your own, friends, or stock footage).</li>
            <li>Decide the joke/emotion and generate meme lines (EN + MM).</li>
            <li>Optionally create a short voiceover, or rely on strong text overlays.</li>
            <li>Edit fast in AI Video Editor, add music/SFX, keep it 10–30 seconds.</li>
            <li>Export once and reuse the clip across all platforms.</li>
          </ul>
        </section>

        <section className="bg-surface-secondary rounded-xl p-4">
          <h2 className="text-lg font-medium text-text-primary">Note</h2>
          <p className="text-text-secondary text-sm mt-1">
            This page is intentionally minimal. If any of these sections become real tools
            (checklists, timers, generators), we can move them into their own components
            without touching the rest of the app.
          </p>
        </section>
      </div>
    </div>
  );
};

export default WorkflowsPage;
