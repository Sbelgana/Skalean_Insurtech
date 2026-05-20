/**
 * @insurtech/shared-pwa -- public API
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */

// Hooks
export { useInstallPrompt } from './hooks/useInstallPrompt';
export type { UseInstallPromptReturn, InstallPromptOptions } from './hooks/useInstallPrompt';

export { useOnlineStatus } from './hooks/useOnlineStatus';
export type { UseOnlineStatusReturn, OnlineStatusOptions } from './hooks/useOnlineStatus';

export { useServiceWorker } from './hooks/useServiceWorker';
export type {
  UseServiceWorkerReturn,
  ServiceWorkerStatus,
  UseServiceWorkerOptions,
} from './hooks/useServiceWorker';

export { usePushSubscription } from './hooks/usePushSubscription';
export type {
  UsePushSubscriptionReturn,
  UsePushSubscriptionOptions,
} from './hooks/usePushSubscription';

// Components
export { PwaInstallBanner } from './components/PwaInstallBanner';
export type { PwaInstallBannerProps, PwaInstallBannerMessages } from './components/PwaInstallBanner';

export { OfflineBanner } from './components/OfflineBanner';
export type { OfflineBannerProps, OfflineBannerMessages } from './components/OfflineBanner';

export { UpdateAvailableBanner } from './components/UpdateAvailableBanner';
export type {
  UpdateAvailableBannerProps,
  UpdateAvailableBannerMessages,
} from './components/UpdateAvailableBanner';

// Helpers
export { registerServiceWorker } from './lib/register-sw';
export type { RegisterServiceWorkerOptions } from './lib/register-sw';

export {
  openAppDb,
  enqueueOperation,
  dequeueOperation,
  listPendingOperations,
  saveDraft,
  loadDraft,
  deleteDraft,
  savePhoto,
  loadPhoto,
  deletePhoto,
  clearOldDrafts,
} from './lib/idb-helpers';
export type {
  AppDbSchema,
  QueuedOperation,
  DraftRecord,
  PhotoRecord,
} from './lib/idb-helpers';

export const VERSION = '0.1.0';
