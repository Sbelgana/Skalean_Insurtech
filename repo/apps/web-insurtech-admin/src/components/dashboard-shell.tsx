'use client';

/**
 * DashboardShell -- client-side wrapper around shared-ui DashboardLayout.
 *
 * Required because adminSidebarItems contains icon functions (lucide-react)
 * that cannot cross the RSC server/client boundary.
 *
 * Reference : task-1.4.1 + task-1.4.15 Sprint 4 Phase 1
 */
import { DashboardLayout, LocaleSwitcher } from '@insurtech/shared-ui';
import { adminSidebarItems } from '@/config/sidebar-items';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <DashboardLayout sidebarItems={adminSidebarItems} localeSwitcher={<LocaleSwitcher />}>
      {children}
    </DashboardLayout>
  );
}
