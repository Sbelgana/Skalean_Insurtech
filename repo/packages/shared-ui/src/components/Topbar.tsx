'use client';

/**
 * Topbar -- sticky application top bar with configurable slots.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { Menu } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { useSidebarOpen } from '../hooks/useSidebarOpen.js';

export interface TopbarProps {
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  userMenu?: React.ReactNode;
  notificationBell?: React.ReactNode;
  themeToggle?: React.ReactNode;
  localeSwitcher?: React.ReactNode;
  commandPalette?: React.ReactNode;
  variant?: 'solid' | 'transparent' | 'blur';
  showHamburger?: boolean;
  className?: string;
}

export function Topbar({
  breadcrumb,
  actions,
  userMenu,
  notificationBell,
  themeToggle,
  localeSwitcher,
  commandPalette,
  variant = 'blur',
  showHamburger = true,
  className,
}: TopbarProps) {
  const { setDrawerOpen } = useSidebarOpen();

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-40 flex h-16 items-center gap-4 border-b px-4 md:px-6',
        variant === 'solid' && 'bg-background',
        variant === 'transparent' && 'bg-transparent',
        variant === 'blur' &&
          'bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      {showHamburger && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <div className="flex-1 min-w-0">
        {breadcrumb && (
          <div className="hidden md:block truncate" aria-label="Fil d'ariane">
            {breadcrumb}
          </div>
        )}
      </div>

      {commandPalette && <div className="hidden lg:block">{commandPalette}</div>}

      {actions && <div className="hidden md:flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-1 md:gap-2">
        {localeSwitcher}
        {themeToggle}
        {notificationBell}
        {userMenu}
      </div>
    </header>
  );
}
