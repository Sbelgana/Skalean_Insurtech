'use client';
/**
 * useTheme -- wraps next-themes with Skalean types
 * Reference : task-1.4.8 Sprint 4 Phase 1
 */
import { useTheme as useNextTheme } from 'next-themes';

export type Theme = 'light' | 'dark' | 'system';

export interface UseThemeResult {
  theme: Theme | undefined;
  resolvedTheme: 'light' | 'dark' | undefined;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const { theme, resolvedTheme, setTheme } = useNextTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return {
    theme: theme as Theme | undefined,
    resolvedTheme: resolvedTheme as 'light' | 'dark' | undefined,
    setTheme: setTheme as (t: Theme) => void,
    toggleTheme,
  };
}
