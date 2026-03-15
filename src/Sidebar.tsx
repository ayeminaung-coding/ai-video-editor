// Sidebar.tsx - Sidebar Component with desktop collapse toggle

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  onToggle?: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onToggle }) => {
  const location = useLocation();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleDesktop = () => {
    const next = !desktopOpen;
    setDesktopOpen(next);
    onToggle?.(next);
  };

  const toggleMobile = () => setMobileOpen(prev => !prev);
  const closeMobile = () => setMobileOpen(false);

  const tools = [
    { path: '/translate', label: 'Translate', icon: '🌏' },
    { path: '/srt-translator', label: 'SRT Translator', icon: '🔤' },
    { path: '/srt-exporter', label: 'SRT Exporter', icon: '📝' },
    { path: '/subtitle-preview', label: 'Sub Preview', icon: '🎞️' },
    { path: '/metadata-remover', label: 'Metadata Remover', icon: '🧹' },
    { path: '/tiktok-changer', label: 'TikTok Changer', icon: '🎵' },
    { path: '/video-splitter', label: 'Video Splitter', icon: '✂️' },
    { path: '/queue-encoder', label: 'Queue Encoder + Subs', icon: '📦' },
    { path: '/queue-ocr', label: 'Queue OCR', icon: '📋' },
    { path: '/video-automation', label: 'Video Automation', icon: '🤖' },
    { path: '/thumbnail-cover', label: 'Thumbnail Cover', icon: '🖼️' },
    { path: '/upload', label: 'Upload', icon: '📤' },
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  ];

  const NavItem = ({
    path, label, icon, onClick,
  }: { path: string; label: string; icon: string; onClick?: () => void }) => {
    const active = location.pathname === path;
    return (
      <Link
        to={path}
        onClick={onClick}
        title={!desktopOpen ? label : undefined}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
          ${active
            ? 'bg-accent-primary/10 text-accent-primary'
            : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
          }
          ${!desktopOpen ? 'justify-center' : ''}
        `}
      >
        <span className="text-lg shrink-0">{icon}</span>
        {desktopOpen && (
          <span className="text-sm font-medium truncate">{label}</span>
        )}
        {active && desktopOpen && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile FAB */}
      <button
        onClick={toggleMobile}
        className="md:hidden fixed bottom-4 right-4 z-50 w-12 h-12 bg-accent-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-accent-primary-dark transition-colors"
        aria-label="Toggle sidebar"
      >
        <span className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen bg-surface-primary border-r border-border-primary
          flex flex-col z-50 overflow-hidden
          transition-[width,transform] duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${desktopOpen ? 'md:w-64' : 'md:w-[60px]'}
        `}
      >
        {/* Header with toggle button */}
        <div className="h-12 px-3 border-b border-border-primary flex-shrink-0 flex items-center justify-between gap-2">
          {desktopOpen && (
            <h2 className="text-sm font-bold text-text-primary tracking-wide truncate">Navigation</h2>
          )}

          {/* Desktop collapse/expand chevron */}
          <button
            onClick={toggleDesktop}
            title={desktopOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className={`
              hidden md:flex items-center justify-center w-7 h-7 rounded-lg
              text-text-secondary hover:text-text-primary hover:bg-surface-secondary
              transition-colors
              ${!desktopOpen ? 'mx-auto' : 'ml-auto'}
            `}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16" height="16"
              viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: desktopOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Mobile close */}
          <button onClick={closeMobile} className="md:hidden p-1 text-text-secondary hover:text-text-primary ml-auto">
            ✕
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {/* Quick Actions section */}
          <div className="px-2 pt-2 pb-1">
            {desktopOpen && (
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider px-2 mb-1.5">
                Quick Actions
              </p>
            )}
            <div className="space-y-0.5">
              {tools.map(a => (
                <NavItem key={a.path} {...a} onClick={closeMobile} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-3 border-t border-border-primary text-center">
          <span className="text-xs text-text-tertiary">
            {desktopOpen ? 'AI Video Editor v1.0.0' : 'v1'}
          </span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;