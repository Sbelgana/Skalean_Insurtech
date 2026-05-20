'use client';
/**
 * PwaInstallBanner -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Banniere dismissible pour l'installation PWA.
 * Detecte iOS (partage Safari) vs Android (beforeinstallprompt).
 * decision-006 : aucune emoji.
 */
import { useTranslations } from 'next-intl';
import { useInstallPrompt } from '@/lib/pwa/use-install-prompt';

export function PwaInstallBanner() {
  const t = useTranslations('mobile');
  const { canPrompt, isIos, isStandalone, prompt, dismiss } = useInstallPrompt();

  if (isStandalone) return null;
  if (!canPrompt && !isIos) return null;

  return (
    <div
      role="banner"
      aria-label={t('installApp')}
      className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-primary/20 bg-card px-4 py-3 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{t('installApp')}</p>
          {isIos ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Safari : bouton Partager puis &quot;Sur l&apos;ecran d&apos;accueil&quot;
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {t('installLater')}
          </button>
          {!isIos ? (
            <button
              type="button"
              onClick={() => void prompt()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              {t('installNow')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
