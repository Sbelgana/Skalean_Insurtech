'use client';
/**
 * PwaInstallBanner -- install prompt banner for PWA
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export interface PwaInstallBannerMessages {
  title: string;
  description: string;
  installButton: string;
  dismissButton: string;
}

export interface PwaInstallBannerProps {
  messages?: PwaInstallBannerMessages | undefined;
  className?: string | undefined;
  storagePrefix?: string | undefined;
  onInstalled?: (() => void) | undefined;
  onDismissed?: (() => void) | undefined;
  forceVisible?: boolean | undefined;
}

const defaultMessages: PwaInstallBannerMessages = {
  title: 'Installer l\'application',
  description: 'Ajoutez cette application a votre ecran d\'accueil pour un acces rapide.',
  installButton: 'Installer',
  dismissButton: 'Plus tard',
};

export function PwaInstallBanner({
  messages = defaultMessages,
  className,
  storagePrefix,
  onInstalled,
  onDismissed,
  forceVisible = false,
}: PwaInstallBannerProps) {
  const { canInstall, prompt, dismiss, isIOS } = useInstallPrompt(
    storagePrefix !== undefined ? { storagePrefix } : {},
  );

  const visible = forceVisible || canInstall;

  if (!visible) return null;

  const handleInstall = () => {
    if (isIOS) {
      dismiss();
      onInstalled?.();
      return;
    }
    void prompt().then((outcome) => {
      if (outcome === 'accepted') {
        onInstalled?.();
      }
    });
  };

  const handleDismiss = () => {
    dismiss();
    onDismissed?.();
  };

  return (
    <div
      role="banner"
      aria-label={messages.title}
      className={className}
      data-testid="pwa-install-banner"
    >
      <div>
        <strong>{messages.title}</strong>
        <p>{messages.description}</p>
      </div>
      <div>
        <button type="button" onClick={handleInstall} data-testid="install-button">
          {messages.installButton}
        </button>
        <button type="button" onClick={handleDismiss} data-testid="dismiss-button">
          {messages.dismissButton}
        </button>
      </div>
    </div>
  );
}
