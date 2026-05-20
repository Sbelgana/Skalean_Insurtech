/**
 * SelfServiceLayout -- centred content layout for non-technical end-users.
 * No sidebar. Large base font (18px / text-lg). Max-w-3xl content width.
 * Used by: web-assure-portal (3005).
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { Topbar } from '../components/Topbar.js';
import { UserMenu, type UserMenuUser } from '../components/UserMenu.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { DashboardFooter } from '../components/DashboardFooter.js';
import { LogoSkalean } from '../components/LogoSkalean.js';

export interface SelfServiceLayoutProps {
  user?: UserMenuUser;
  localeSwitcher?: React.ReactNode;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function SelfServiceLayout({
  user,
  localeSwitcher,
  onLogout,
  children,
}: SelfServiceLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-lg">
      <Topbar
        breadcrumb={
          <div className="flex items-center gap-3">
            <LogoSkalean className="h-9 w-auto" />
            <span className="hidden sm:inline font-semibold text-lg">Mon espace assure</span>
          </div>
        }
        userMenu={user ? <UserMenu user={user} {...(onLogout ? { onLogout } : {})} /> : undefined}
        themeToggle={<ThemeToggle />}
        localeSwitcher={localeSwitcher}
        variant="solid"
        showHamburger={false}
      />
      <main role="main" className="flex-1 w-full mx-auto max-w-3xl px-4 py-8 md:py-12">
        {children}
      </main>
      <DashboardFooter />
    </div>
  );
}
