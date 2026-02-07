// ResourceFinderPage.tsx - Quick links and guidance for finding video assets
// Pure frontend: no backend calls, easy to remove or change.

import React from 'react';

const ResourceFinderPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Resource Finder</h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            Quick access to stock footage, images, and recording ideas so you can
            build videos faster without showing your face.
          </p>
        </header>

        {/* Section: Stock Video & Images */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium text-text-primary">Stock Footage & Images</h2>
          <p className="text-text-secondary text-sm">
            Use these sites for b-roll, cat clips, and background footage.
          </p>
          <ul className="text-sm text-accent-primary space-y-1">
            <li>
              <a href="https://www.pexels.com/videos/" target="_blank" rel="noreferrer" className="hover:underline">
                Pexels Videos
              </a>
              <span className="text-text-secondary text-xs ml-1">— free stock videos</span>
            </li>
            <li>
              <a href="https://pixabay.com/videos/" target="_blank" rel="noreferrer" className="hover:underline">
                Pixabay Videos
              </a>
              <span className="text-text-secondary text-xs ml-1">— free videos & music</span>
            </li>
            <li>
              <a href="https://coverr.co/" target="_blank" rel="noreferrer" className="hover:underline">
                Coverr
              </a>
              <span className="text-text-secondary text-xs ml-1">— cinematic b-roll</span>
            </li>
            <li>
              <a href="https://unsplash.com/" target="_blank" rel="noreferrer" className="hover:underline">
                Unsplash
              </a>
              <span className="text-text-secondary text-xs ml-1">— high quality images</span>
            </li>
          </ul>
        </section>

        {/* Section: Recording Ideas */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium text-text-primary">Recording Ideas</h2>
          <p className="text-text-secondary text-sm">
            Simple ways to capture footage without showing your face.
          </p>
          <ul className="text-sm text-text-secondary list-disc pl-5 space-y-1">
            <li>Record your screen while browsing, playing games, or explaining something.</li>
            <li>Film only hands (keyboard, drawing tablet, phone, etc.).</li>
            <li>Capture ambient scenes: desk setup, city lights, coffee shop, etc.</li>
            <li>Reuse your own cat/pet clips for memes and reactions.</li>
          </ul>
        </section>

        {/* Section: Movie Recap Visual Tips */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium text-text-primary">Movie Recap Visual Tips</h2>
          <ul className="text-sm text-text-secondary list-disc pl-5 space-y-1">
            <li>Use short scenes (2–4 seconds) instead of long continuous clips.</li>
            <li>Crop aggressively and add zoom to make the footage feel original.</li>
            <li>Mix real clips with stock footage for transitions and intros.</li>
            <li>Always layer strong subtitles and text so viewers can follow without sound.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default ResourceFinderPage;
