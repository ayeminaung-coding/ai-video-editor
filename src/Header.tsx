import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useSettings } from './contexts/SettingsContext';

const Header: React.FC = () => {
  const { setIsModalOpen } = useSettings();

  return (
    <header className="bg-surface-primary border-b border-border-primary px-4 md:px-6 py-3 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        {/* Logo and Navigation */}
        <div className="flex items-center gap-4 md:gap-8">
          <Link
            to="/"
            className="text-xl md:text-2xl font-bold text-text-primary flex items-center gap-2"
          >
            <span>🎬</span>
            <span>AI Video Editor</span>
          </Link>


        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-2">
            <div className="text-text-secondary text-sm">
              Welcome, User
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface-tertiary transition-colors text-sm"
            >
              Settings
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-text-secondary hover:text-text-primary">
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
        </div>
      </div>


    </header>
  );
};

export default Header;