// ThemeSelector.tsx - Theme Selection Component
// React component for selecting between light, dark, and system themes

import React from 'react';
import { useTheme } from './ThemeContext';

const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value as any)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            transition-colors duration-200
            ${
              theme === option.value
                ? 'bg-accent-primary text-white'
                : 'bg-surface-secondary hover:bg-surface-tertiary text-text-primary'
            }
          `}
        >
          <span>{option.icon}</span>
          <span className="text-sm font-medium">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSelector;