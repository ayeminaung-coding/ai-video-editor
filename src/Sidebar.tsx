// Sidebar.tsx - Sidebar Component
// React component for the sidebar with quick actions

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  onToggle?: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onToggle }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };

  const quickActions = [
    { path: '/upload', label: 'Upload', icon: '📤' },
    { path: '/editor', label: 'Edit', icon: '✏️' },
    { path: '/preview', label: 'Preview', icon: '👁️' },
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  ];

  // Tools in the sidebar are now "creator tools" only, so it's easy to see
  // everything you use as a content creator in one place.
  const tools = [
    { path: '/creator', label: 'Creator Tools', icon: '🧰' },
    { path: '/creator/script-helper', label: 'Script Helper', icon: '📜' },
    { path: '/creator/workflows', label: 'Workflows', icon: '🧭' },
    { path: '/creator/workflow-board', label: 'Workflow Board', icon: '🗂' },
    { path: '/creator/resources', label: 'Resources', icon: '📂' },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed bottom-4 right-4 z-50 p-3 bg-accent-primary text-white rounded-full shadow-lg hover:bg-accent-primary-dark transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Sidebar Overlay (Mobile) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen w-64 bg-surface-primary border-r border-border-primary
          transform transition-transform duration-200 z-50
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Quick Actions</h2>
            <button
              onClick={toggleSidebar}
              className="md:hidden p-1 text-text-secondary hover:text-text-primary"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b border-border-primary">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Navigation</h3>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                  ${
                    location.pathname === action.path
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                  }
                `}
              >
                <span className="text-lg">{action.icon}</span>
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Tools (Creator-focused) */}
        <div className="p-4 border-b border-border-primary">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Creator Tools</h3>
          <div className="space-y-1">
            {tools.map((tool) => (
              <Link
                key={tool.path}
                to={tool.path}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                  ${
                    location.pathname === tool.path
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                  }
                `}
              >
                <span className="text-lg">{tool.icon}</span>
                <span>{tool.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Info</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <span>📱</span>
              <span>Mobile-friendly</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🎨</span>
              <span>Dark mode support</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🚀</span>
              <span>Free to use</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border-primary">
          <div className="text-xs text-text-tertiary text-center">
            AI Video Editor v1.0.0
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;