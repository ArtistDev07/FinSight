import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'finsight_theme_mode';

function applyThemeToDocument(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences, isAuthenticated, updatePreferences } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore storage access restriction
    }
    return 'light';
  });

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage restrictions
    }
  }, [theme]);

  // Sync from authenticated user preferences if present
  useEffect(() => {
    if (preferences?.theme === 'dark' || preferences?.theme === 'light') {
      setThemeState(preferences.theme);
    }
  }, [preferences?.theme]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      if (isAuthenticated) {
        updatePreferences({ theme: mode }).catch(() => undefined);
      }
    },
    [isAuthenticated, updatePreferences]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
