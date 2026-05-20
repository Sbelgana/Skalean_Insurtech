'use client';

/**
 * ThemeToggle -- stub minimal (Tache 1.4.8 implementera composant complet)
 * Reference : Tache 1.4.1 web-broker bootstrap
 */
import { useTheme } from 'next-themes';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, theme } = useTheme();
  const themes = ['light', 'dark', 'system'] as const;
  const themeLabels: Record<string, string> = { light: 'Clair', dark: 'Sombre', system: 'Systeme' };

  return (
    <div className={className}>
      <button
        type="button"
        aria-label="theme"
        className="flex items-center gap-1 rounded border px-2 py-1 text-sm"
      >
        {themeLabels[theme ?? 'system'] ?? theme}
      </button>
      <ul role="menu">
        {themes.map((t) => (
          <li key={t} role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => setTheme(t)}
              className="block w-full px-3 py-1 text-sm text-left"
            >
              {themeLabels[t]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
