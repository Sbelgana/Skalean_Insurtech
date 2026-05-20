/**
 * MobileLayout -- mobile-first PWA layout with bottom tabs.
 * safe-area-inset-top / safe-area-inset-bottom for iOS notch.
 * Used by: web-garage-mobile (3003), web-assure-mobile (3006).
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { BottomTabs, type TabItem } from '../components/BottomTabs.js';
import { UserMenu, type UserMenuUser } from '../components/UserMenu.js';
import { LogoSkalean } from '../components/LogoSkalean.js';

export interface MobileLayoutProps {
  tabs: TabItem[];
  user?: UserMenuUser;
  localeSwitcher?: React.ReactNode;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function MobileLayout({ tabs, user, localeSwitcher, onLogout, children }: MobileLayoutProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header
        role="banner"
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-3"
      >
        <LogoSkalean className="h-7 w-auto" />
        <div className="flex items-center gap-1">
          {localeSwitcher}
          {user && <UserMenu user={user} {...(onLogout ? { onLogout } : {})} />}
        </div>
      </header>
      <main
        role="main"
        className="flex-1 overflow-auto px-3 py-4"
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
      <BottomTabs tabs={tabs} />
    </div>
  );
}
