'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { THEMES, type ThemeMode } from '../lib/theme';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>('light');

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('tb-theme');
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    }
  }, []);

  // Apply CSS custom properties and dark class when theme changes
  useEffect(() => {
    const html = document.documentElement;

    // Set CSS custom properties on <html> so all children inherit
    const vars = THEMES[theme];
    for (const [key, value] of Object.entries(vars)) {
      html.style.setProperty(key, value);
    }

    // Toggle dark class on <html> for Tailwind dark: prefix
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    localStorage.setItem('tb-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
