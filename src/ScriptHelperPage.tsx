// ScriptHelperPage.tsx - Simple helper UI for preparing scripts
// This is mostly UI; it does not call any external AI API yet.
// It is safe and easy to remove later.

import React, { useState } from 'react';

const ScriptHelperPage: React.FC = () => {
  const [movieTitle, setMovieTitle] = useState('');
  const [duration, setDuration] = useState<'30' | '60' | '90'>('60');
  const [style, setStyle] = useState<'recap' | 'ending' | 'meme'>('recap');
  const [language, setLanguage] = useState<'en' | 'en-mm'>('en-mm');

  const [notes, setNotes] = useState('');

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Script Helper</h1>
          <p className="text-text-secondary text-sm md:text-base mt-1">
            Prepare structured prompts and script outlines for Gemini TTS or any AI writer.
          </p>
        </header>

        {/* Form */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Movie / Video title</label>
              <input
                className="w-full px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
                value={movieTitle}
                onChange={(e) => setMovieTitle(e.target.value)}
                placeholder="John Wick, Spider-Man, cat meme, etc."
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Target length</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
                value={duration}
                onChange={(e) => setDuration(e.target.value as '30' | '60' | '90')}
              >
                <option value="30">30 seconds</option>
                <option value="60">60 seconds</option>
                <option value="90">90 seconds</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Style</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
                value={style}
                onChange={(e) => setStyle(e.target.value as 'recap' | 'ending' | 'meme')}
              >
                <option value="recap">Movie recap</option>
                <option value="ending">Ending explained</option>
                <option value="meme">Meme / funny narration</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Language mix</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'en-mm')}
              >
                <option value="en">English only (YouTube Shorts)</option>
                <option value="en-mm">English + Burmese mix</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Extra notes (optional)</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-surface-primary border border-border-primary text-text-primary"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any constraints, tone, or jokes you want to include."
            />
          </div>
        </section>

        {/* Output: Prompt template */}
        <section className="bg-surface-secondary rounded-xl p-4 space-y-2">
          <h2 className="text-lg font-medium text-text-primary">Prompt template for AI</h2>
          <p className="text-text-secondary text-xs">
            Copy-paste this into Gemini / ChatGPT to generate English and Burmese scripts.
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-xs md:text-sm bg-surface-primary border border-border-primary rounded-lg p-3 text-text-primary">
{`You are helping me write a short-form video script.

Video type: ${style === 'recap' ? 'movie recap' : style === 'ending' ? 'ending explained' : 'meme / funny narration'}
Title or topic: ${movieTitle || '[fill in movie / topic here]'}
Target length: ~${duration} seconds.

Language:
- Primary: English${language === 'en-mm' ? '\n- Also provide a Burmese version with casual tone for TikTok/Reels.' : ''}

Requirements:
- Strong hook in the first 2 lines.
- Simple, natural language.
- Structure: hook → setup → conflict/twist → payoff.
- No heavy swearing, keep it platform-friendly.

If possible, output:
1) English script for voiceover.
${language === 'en-mm' ? '2) Burmese script with similar meaning, casual Burmese for captions or MM voiceover.' : ''}

Additional notes from me:
${notes || '[none]'}
`}
          </pre>
        </section>
      </div>
    </div>
  );
};

export default ScriptHelperPage;
