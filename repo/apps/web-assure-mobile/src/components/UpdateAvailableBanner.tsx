'use client';
/**
 * UpdateAvailableBanner -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Banniere affichee lorsqu'une mise a jour du service worker est disponible.
 * decision-006 : aucune emoji.
 */
import { useTranslations } from 'next-intl';
import { useServiceWorker } from '@/lib/pwa/use-service-worker';

export function UpdateAvailableBanner() {
  const t = useTranslations('mobile');
  const { status, applyUpdate } = useServiceWorker();

  if (status !== 'update-available') return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-primary/20 bg-card px-4 py-3 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{t('updateAvailable')}</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          {t('updateNow')}
        </button>
      </div>
    </div>
  );
}
