'use client';
/**
 * OfflineBanner -- shows a banner when the user is offline
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface OfflineBannerMessages {
  offlineMessage: string;
  reconnectingMessage?: string | undefined;
}

export interface OfflineBannerProps {
  messages?: OfflineBannerMessages | undefined;
  className?: string | undefined;
  debounceMs?: number | undefined;
  forceVisible?: boolean | undefined;
}

const defaultMessages: OfflineBannerMessages = {
  offlineMessage: 'Vous etes hors ligne. Certaines fonctionnalites sont limitees.',
  reconnectingMessage: 'Reconnexion en cours...',
};

export function OfflineBanner({
  messages = defaultMessages,
  className,
  debounceMs,
  forceVisible = false,
}: OfflineBannerProps) {
  const { isOnline } = useOnlineStatus(debounceMs !== undefined ? { debounceMs } : {});

  const visible = forceVisible || !isOnline;

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      data-testid="offline-banner"
    >
      <span>{messages.offlineMessage}</span>
      {messages.reconnectingMessage !== undefined && (
        <span>{messages.reconnectingMessage}</span>
      )}
    </div>
  );
}
