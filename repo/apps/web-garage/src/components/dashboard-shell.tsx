'use client';

/**
 * DashboardShell -- client-side wrapper around shared-ui DashboardLayout.
 *
 * Required because garageSidebarItems contains icon functions (lucide-react)
 * that cannot cross the RSC server/client boundary.
 *
 * Reference : task-1.4.1 + task-1.4.15 Sprint 4 Phase 1
 */
import { DashboardLayout, LocaleSwitcher } from '@insurtech/shared-ui';
import { garageSidebarItems } from '@/config/sidebar-items';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <DashboardLayout sidebarItems={garageSidebarItems} localeSwitcher={<LocaleSwitcher />}>
      {children}
    </DashboardLayout>
  );
}
