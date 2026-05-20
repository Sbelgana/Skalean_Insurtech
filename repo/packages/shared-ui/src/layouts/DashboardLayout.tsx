/**
 * DashboardLayout -- sidebar + topbar layout for power-user apps.
 * Used by: web-broker (3001), web-garage (3002), web-insurtech-admin (3000).
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { Sidebar, type SidebarSection } from '../components/Sidebar.js';
import { Topbar } from '../components/Topbar.js';
import { Breadcrumb, type BreadcrumbItem } from '../components/Breadcrumb.js';
import { UserMenu, type UserMenuUser } from '../components/UserMenu.js';
import { NotificationBell } from '../components/NotificationBell.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { DashboardFooter } from '../components/DashboardFooter.js';
import { LogoSkalean } from '../components/LogoSkalean.js';

export interface DashboardLayoutProps {
  sidebarItems: SidebarSection[];
  user?: UserMenuUser;
  userRoles?: string[];
  breadcrumbItems?: BreadcrumbItem[];
  topbarActions?: React.ReactNode;
  localeSwitcher?: React.ReactNode;
  unreadNotifications?: number;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function DashboardLayout({
  sidebarItems,
  user,
  userRoles,
  breadcrumbItems,
  topbarActions,
  localeSwitcher,
  unreadNotifications = 0,
  onLogout,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={sidebarItems}
        userRoles={userRoles}
        logo={<LogoSkalean className="h-8 w-auto" />}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          breadcrumb={<Breadcrumb {...(breadcrumbItems ? { items: breadcrumbItems } : {})} />}
          actions={topbarActions}
          userMenu={user ? <UserMenu user={user} {...(onLogout ? { onLogout } : {})} /> : undefined}
          notificationBell={<NotificationBell unreadCount={unreadNotifications} />}
          themeToggle={<ThemeToggle />}
          localeSwitcher={localeSwitcher}
          variant="blur"
          showHamburger={true}
        />
        <main role="main" className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}
