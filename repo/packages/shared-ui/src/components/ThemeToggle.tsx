'use client';

/**
 * ThemeToggle -- tri-state theme selector (light / dark / system).
 * Uses mounted flag to avoid SSR hydration mismatch.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const t = useTranslations('theme');

  React.useEffect(() => setMounted(true), []);

  // Placeholder to avoid layout shift during hydration
  if (!mounted) {
    return <div className="h-10 w-10" aria-hidden="true" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('label' as Parameters<typeof t>[0], { fallback: 'Changer de theme' } as Parameters<typeof t>[1])}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sun className="h-5 w-5 dark:hidden" aria-hidden="true" />
          <Moon className="h-5 w-5 hidden dark:inline" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={theme === 'light' ? 'bg-accent' : undefined}
        >
          <Sun className="me-2 h-4 w-4" aria-hidden="true" />
          {t('light' as Parameters<typeof t>[0], { fallback: 'Clair' } as Parameters<typeof t>[1])}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={theme === 'dark' ? 'bg-accent' : undefined}
        >
          <Moon className="me-2 h-4 w-4" aria-hidden="true" />
          {t('dark' as Parameters<typeof t>[0], { fallback: 'Sombre' } as Parameters<typeof t>[1])}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={theme === 'system' ? 'bg-accent' : undefined}
        >
          <Monitor className="me-2 h-4 w-4" aria-hidden="true" />
          {t('system' as Parameters<typeof t>[0], { fallback: 'Systeme' } as Parameters<typeof t>[1])}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
