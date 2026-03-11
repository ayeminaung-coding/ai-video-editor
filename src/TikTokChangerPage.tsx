// TikTokChangerPage.tsx - TikTok Changer Tool Page

import React from 'react';

const TikTokChangerPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-6">
      {/* Page Header */}
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎵</span>
            <h1 className="text-2xl font-bold text-text-primary">TikTok Changer</h1>
          </div>
          <p className="text-text-secondary text-sm">
            Modify and optimise your videos for TikTok — adjust metadata, reformat ratios, and more.
          </p>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-surface-primary border border-border-primary rounded-xl p-10 flex flex-col items-center justify-center gap-4 text-center shadow-sm">
          <span className="text-6xl">🚧</span>
          <h2 className="text-xl font-semibold text-text-primary">Coming Soon</h2>
          <p className="text-text-secondary text-sm max-w-md">
            The TikTok Changer tool is currently under development. Check back soon for features like
            auto-cropping to 9:16, watermark removal, caption overlays, and TikTok-friendly metadata injection.
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/10 text-accent-primary text-sm font-medium">
            <span>🎵</span> TikTok Optimisation Suite
          </div>
        </div>
      </div>
    </div>
  );
};

export default TikTokChangerPage;
