// ThemeContext.tsx - Dark/Light Mode Theme Management
// React context for managing theme state and preferences

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