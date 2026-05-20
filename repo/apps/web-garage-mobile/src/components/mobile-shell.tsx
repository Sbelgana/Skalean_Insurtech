'use client';

/**
 * MobileShell -- client-side wrapper around shared-ui MobileLayout.
 *
 * Required because garageMobileTabs contains icon functions (lucide-react)
 * that cannot cross the RSC server/client boundary.
 *
 * Reference : task-1.4.1 + task-1.4.15 Sprint 4 Phase 1
 */
import { MobileLayout, LocaleSwitcher } from '@insurtech/shared-ui';
import { garageMobileTabs } from '@/config/tabs';
import { OfflineBanner } from './OfflineBanner';
import { UpdateAvailableBanner } from './UpdateAvailableBanner';

interface MobileShellProps {
  children: React.ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <MobileLayout tabs={garageMobileTabs} localeSwitcher={<LocaleSwitcher />}>
      <OfflineBanner />
      {children}
      <UpdateAvailableBanner />
    </MobileLayout>
  );
}
