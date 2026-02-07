// CreatorToolsPage.tsx - Hub for creator-focused tools
// This page is intentionally simple and modular so it is easy to remove or extend.

import React from 'react';
import { useNavigate } from 'react-router-dom';

const CreatorToolsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
            Creator Tools
          </h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            A central place for tools that help you write scripts, plan videos, and reuse content.
          </p>
        </header>

        {/* Section: Quick Links */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-2">
          <h2 className="text-lg font-medium text-text-primary">Quick Actions</h2>
          <p className="text-text-secondary text-sm">
            These are entry points for future tools. Each block can be removed independently.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/creator/script-helper')}
              className="text-left bg-surface-primary rounded-lg p-3 hover:bg-surface-tertiary transition-colors"
            >
              <div className="text-base font-medium text-text-primary">Script Helper</div>
              <div className="text-xs text-text-secondary mt-1">
                Prepare English + Burmese scripts for TTS and captions.
              </div>
            </button>
            <button
              onClick={() => navigate('/creator/workflows')}
              className="text-left bg-surface-primary rounded-lg p-3 hover:bg-surface-tertiary transition-colors"
            >
              <div className="text-base font-medium text-text-primary">Workflows</div>
              <div className="text-xs text-text-secondary mt-1">
                Quick reference for movie recaps and cat meme production.
              </div>
            </button>
          </div>
        </section>

        {/* Section: Notes */}
        <section className="bg-surface-secondary rounded-xl p-4">
          <h2 className="text-lg font-medium text-text-primary">Why this page?</h2>
          <p className="text-text-secondary text-sm mt-1">
            This page is designed as a hub. Each tool (Script Helper, Workflows, Checklists, etc.)
            can live in its own route and component, so you can easily remove or change them
            without touching the rest of the app.
          </p>
        </section>
      </div>
    </div>
  );
};

export default CreatorToolsPage;
