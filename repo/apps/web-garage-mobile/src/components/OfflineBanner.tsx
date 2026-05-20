'use client';
/**
 * OfflineBanner -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Banniere affichee lorsque le navigateur est hors ligne.
 * decision-006 : aucune emoji.
 */
import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@/lib/pwa/use-online-status';

export function OfflineBanner() {
  const t = useTranslations('mobile');
  const { online } = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
    >
      <span className="h-2 w-2 rounded-full bg-destructive-foreground" />
      {t('offlineModeActive')}
    </div>
  );
}
