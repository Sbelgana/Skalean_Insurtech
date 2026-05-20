'use client';
/**
 * UpdateAvailableBanner -- notifies user that a new SW version is available
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { useState } from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';

export interface UpdateAvailableBannerMessages {
  title: string;
  description: string;
  updateButton: string;
  dismissButton: string;
}

export interface UpdateAvailableBannerProps {
  messages?: UpdateAvailableBannerMessages | undefined;
  className?: string | undefined;
  swPath?: string | undefined;
  forceVisible?: boolean | undefined;
  onUpdated?: (() => void) | undefined;
}

const defaultMessages: UpdateAvailableBannerMessages = {
  title: 'Mise a jour disponible',
  description: 'Une nouvelle version de l\'application est disponible.',
  updateButton: 'Mettre a jour',
  dismissButton: 'Plus tard',
};

export function UpdateAvailableBanner({
  messages = defaultMessages,
  className,
  swPath,
  forceVisible = false,
  onUpdated,
}: UpdateAvailableBannerProps) {
  const { hasUpdate, update, status } = useServiceWorker(
    swPath !== undefined ? { swPath } : {},
  );

  const [dismissed, setDismissed] = useState(false);

  const visible = !dismissed && (forceVisible || (hasUpdate && status !== 'unsupported'));

  if (!visible) return null;

  const handleUpdate = () => {
    void update().then(() => {
      onUpdated?.();
    });
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={className}
      data-testid="update-available-banner"
    >
      <div>
        <strong>{messages.title}</strong>
        <p>{messages.description}</p>
      </div>
      <div>
        <button type="button" onClick={handleUpdate} data-testid="update-button">
          {messages.updateButton}
        </button>
        <button type="button" onClick={handleDismiss} data-testid="dismiss-update-button">
          {messages.dismissButton}
        </button>
      </div>
    </div>
  );
}
