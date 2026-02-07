# AI Video Editor - Dark/Light Mode Support

## Overview

Dark mode support for the AI Video Editor with:
- Light/Dark mode toggle
- System preference detection
- Smooth transitions
- CSS variables for colors
- Persistent user preference

## Color Schemes

### Light Mode Colors
```css
:root {
  /* Background Colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  
  /* Text Colors */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  
  /* Border Colors */
  --border-primary: #e2e8f0;
  --border-secondary: #cbd5e1;
  
  /* Accent Colors */
  --accent-primary: #6366f1;
  --accent-secondary: #8b5cf6;
  --accent-success: #10b981;
  --accent-error: #ef4444;
  --accent-warning: #f59e0b;
  
  /* Surface Colors */
  --surface-primary: #ffffff;
  --surface-secondary: #f8fafc;
  --surface-tertiary: #f1f5f9;
  
  /* Shadow Colors */
  --shadow-primary: rgba(0, 0, 0, 0.1);
  --shadow-secondary: rgba(0, 0, 0, 0.05);
}
```

### Dark Mode Colors
```css
[data-theme="dark"] {
  /* Background Colors */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  
  /* Text Colors */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  
  /* Border Colors */
  --border-primary: #334155;
  --border-secondary: #475569;
  
  /* Accent Colors */
  --accent-primary: #818cf8;
  --accent-secondary: #a78bfa;
  --accent-success: #34d399;
  --accent-error: #f87171;
  --accent-warning: #fbbf24;
  
  /* Surface Colors */
  --surface-primary: #1e293b;
  --surface-secondary: #334155;
  --surface-tertiary: #475569;
  
  /* Shadow Colors */
  --shadow-primary: rgba(0, 0, 0, 0.3);
  --shadow-secondary: rgba(0, 0, 0, 0.2);
}
```

## Implementation

### 1. Theme Context
```typescript
// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      setIsDark(theme === 'dark');
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        setIsDark(e.matches);
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
```

### 2. Global CSS
```css
/* src/styles/globals.css */
:root {
  /* Light mode colors (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  
  --border-primary: #e2e8f0;
  --border-secondary: #cbd5e1;
  
  --accent-primary: #6366f1;
  --accent-secondary: #8b5cf6;
  --accent-success: #10b981;
  --accent-error: #ef4444;
  --accent-warning: #f59e0b;
  
  --surface-primary: #ffffff;
  --surface-secondary: #f8fafc;
  --surface-tertiary: #f1f5f9;
  
  --shadow-primary: rgba(0, 0, 0, 0.1);
  --shadow-secondary: rgba(0, 0, 0, 0.05);
  
  /* Transitions */
  --transition-fast: 150ms;
  --transition-normal: 200ms;
  --transition-slow: 300ms;
}

/* Dark mode colors */
[data-theme="dark"] {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  
  --border-primary: #334155;
  --border-secondary: #475569;
  
  --accent-primary: #818cf8;
  --accent-secondary: #a78bfa;
  --accent-success: #34d399;
  --accent-error: #f87171;
  --accent-warning: #fbbf24;
  
  --surface-primary: #1e293b;
  --surface-secondary: #334155;
  --surface-tertiary: #475569;
  
  --shadow-primary: rgba(0, 0, 0, 0.3);
  --shadow-secondary: rgba(0, 0, 0, 0.2);
}

/* Base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color var(--transition-normal) ease,
              color var(--transition-normal) ease;
  min-height: 100vh;
}

/* Apply theme to all elements */
body,
button,
input,
select,
textarea {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--border-primary);
}

/* Smooth transitions for theme changes */
* {
  transition: background-color var(--transition-normal) ease,
              color var(--transition-normal) ease,
              border-color var(--transition-normal) ease,
              box-shadow var(--transition-normal) ease;
}
```

### 3. Theme Toggle Component
```typescript
// src/components/ThemeToggle.tsx
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors duration-200"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun Icon (for dark mode) */}
      {isDark && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}

      {/* Moon Icon (for light mode) */}
      {!isDark && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}

      <span className="text-sm font-medium">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  );
};

export default ThemeToggle;
```

### 4. Theme Selector Component
```typescript
// src/components/ThemeSelector.tsx
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

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
                ? 'bg-indigo-600 text-white'
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
```

### 5. Updated App Component
```typescript
// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import UploadPage from './pages/UploadPage';
import EditorPage from './pages/EditorPage';
import PreviewPage from './pages/PreviewPage';
import DashboardPage from './pages/DashboardPage';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-bg-primary text-text-primary">
          <Header />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/editor" element={<EditorPage />} />
                <Route path="/preview" element={<PreviewPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;
```

### 6. Updated Header Component
```typescript
// src/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const Header: React.FC = () => {
  return (
    <header className="bg-surface-primary border-b border-border-primary px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-text-primary">
            AI Video Editor
          </Link>
          <nav className="flex gap-4 ml-8">
            <Link
              to="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/upload"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Upload
            </Link>
            <Link
              to="/editor"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Editor
            </Link>
            <Link
              to="/preview"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Preview
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="text-text-secondary">Welcome, User</div>
          <button className="bg-accent-primary hover:bg-accent-primary-dark px-4 py-2 rounded-lg text-white">
            Settings
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
```

### 7. Updated Components with Theme Variables
```typescript
// src/components/ResponsiveButton.tsx
import React from 'react';

interface ResponsiveButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  size = 'md'
}) => {
  const variantClasses = {
    primary: 'bg-accent-primary hover:bg-accent-primary-dark text-white',
    secondary: 'bg-accent-secondary hover:bg-accent-secondary-dark text-white',
    outline: 'border-2 border-accent-primary text-accent-primary hover:bg-accent-primary/10'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[44px]',
    md: 'px-4 py-2 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]'
  };

  return (
    <button
      onClick={onClick}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        rounded-lg font-medium
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2
        active:scale-95
        touch-manipulation
      `}
    >
      {children}
    </button>
  );
};

export default ResponsiveButton;
```

### 8. Updated SurfaceCard Component
```typescript
// src/components/SurfaceCard.tsx
import React from 'react';

interface SurfaceCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  title,
  subtitle,
  padding = 'md',
  className = ''
}) => {
  const paddingClasses = {
    sm: 'p-3 md:p-4',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
    xl: 'p-8 md:p-12'
  };

  return (
    <div className={`
      bg-surface-primary rounded-lg shadow-md
      ${paddingClasses[padding]}
      ${className}
    `}>
      {title && (
        <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-1">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-sm md:text-base text-text-secondary mb-4">
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
};

export default SurfaceCard;
```

### 9. Updated Input Components
```typescript
// src/components/TextInput.tsx
import React from 'react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  placeholder = '',
  label = '',
  error = '',
  disabled = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[44px]',
    md: 'px-4 py-3 text-base min-h-[48px]',
    lg: 'px-5 py-4 text-lg min-h-[52px]'
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm md:text-base font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          w-full bg-surface-primary border border-border-primary rounded-lg
          text-text-primary placeholder-text-tertiary
          focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary
          transition-colors duration-200
          disabled:bg-surface-tertiary disabled:cursor-not-allowed
          ${error ? 'border-accent-error focus:border-accent-error focus:ring-accent-error' : ''}
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-accent-error">{error}</p>
      )}
    </div>
  );
};

export default TextInput;
```

### 10. Updated ControlPanel Component
```typescript
// src/components/ControlPanel.tsx
import React, { useState } from 'react';

interface ControlPanelProps {
  onEdit: (settings: EditSettings) => void;
  onExport: () => void;
}

interface EditSettings {
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  brightness: number;
  contrast: number;
  textOverlay: string;
  music: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onEdit, onExport }) => {
  const [settings, setSettings] = useState<EditSettings>({
    trimStart: 0,
    trimEnd: 100,
    speed: 1,
    volume: 1,
    brightness: 1,
    contrast: 1,
    textOverlay: '',
    music: '',
  });

  const handleUpdate = (key: keyof EditSettings, value: number | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    onEdit({ ...settings, [key]: value });
  };

  return (
    <div className="control-panel bg-surface-primary text-text-primary p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Control Panel</h2>
      
      {/* Trim Controls */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Trim (seconds)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={settings.trimStart}
            onChange={(e) => handleUpdate('trimStart', Number(e.target.value))}
            className="bg-surface-secondary border border-border-primary p-2 rounded w-20 text-text-primary"
            placeholder="Start"
          />
          <input
            type="number"
            value={settings.trimEnd}
            onChange={(e) => handleUpdate('trimEnd', Number(e.target.value))}
            className="bg-surface-secondary border border-border-primary p-2 rounded w-20 text-text-primary"
            placeholder="End"
          />
        </div>
      </div>

      {/* Speed Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Speed: {settings.speed}x</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={settings.speed}
          onChange={(e) => handleUpdate('speed', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Volume Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Volume: {Math.round(settings.volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.volume}
          onChange={(e) => handleUpdate('volume', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Brightness Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Brightness: {Math.round(settings.brightness * 100)}%</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.brightness}
          onChange={(e) => handleUpdate('brightness', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Contrast Control */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Contrast: {Math.round(settings.contrast * 100)}%</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.contrast}
          onChange={(e) => handleUpdate('contrast', Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Text Overlay */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Text Overlay</label>
        <input
          type="text"
          value={settings.textOverlay}
          onChange={(e) => handleUpdate('textOverlay', e.target.value)}
          className="bg-surface-secondary border border-border-primary p-2 rounded w-full text-text-primary"
          placeholder="Enter text..."
        />
      </div>

      {/* Music Selection */}
      <div className="mb-4">
        <label className="block mb-2 text-text-secondary">Music</label>
        <select
          value={settings.music}
          onChange={(e) => handleUpdate('music', e.target.value)}
          className="bg-surface-secondary border border-border-primary p-2 rounded w-full text-text-primary"
        >
          <option value="">Select music...</option>
          <option value="upbeat">Upbeat</option>
          <option value="chill">Chill</option>
          <option value="epic">Epic</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Export Button */}
      <button
        onClick={onExport}
        className="bg-accent-primary hover:bg-accent-primary-dark px-4 py-2 rounded w-full text-white font-medium transition-colors"
      >
        Export Video
      </button>
    </div>
  );
};

export default ControlPanel;
```

## Usage Examples

### 1. Using Theme in Components
```typescript
// src/components/ExampleComponent.tsx
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ExampleComponent: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-surface-primary' : 'bg-white'}`}>
      <p className={isDark ? 'text-white' : 'text-black'}>
        Current theme: {isDark ? 'Dark' : 'Light'}
      </p>
      <button onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
};

export default ExampleComponent;
```

### 2. Theme-Aware Styling
```typescript
// src/components/ThemeAwareComponent.tsx
import React from 'react';

const ThemeAwareComponent: React.FC = () => {
  return (
    <div className="bg-surface-primary text-text-primary p-4 rounded-lg">
      <h3 className="text-xl font-bold text-text-primary mb-2">
        Theme-Aware Component
      </h3>
      <p className="text-text-secondary">
        This component automatically adapts to the current theme.
      </p>
      <button className="bg-accent-primary text-white px-4 py-2 rounded-lg mt-4">
        Primary Button
      </button>
    </div>
  );
};

export default ThemeAwareComponent;
```

## Testing Theme Support

### 1. Manual Testing
```bash
# Test light mode
# Test dark mode
# Test system preference
# Test theme persistence
# Test smooth transitions
```

### 2. Automated Testing
```typescript
// src/__tests__/ThemeContext.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

describe('ThemeContext', () => {
  it('should toggle theme', () => {
    const TestComponent = () => {
      const { isDark, toggleTheme } = useTheme();
      return (
        <div>
          <span data-testid="theme">{isDark ? 'dark' : 'light'}</span>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });
});
```

## Next Steps

1. **Create Theme Context** - Implement the theme context
2. **Update Global CSS** - Apply theme variables
3. **Create Theme Toggle** - Add toggle button to header
4. **Update All Components** - Use theme variables
5. **Test Theme Support** - Test light/dark mode

**Next File:** `README.md` - Project documentation