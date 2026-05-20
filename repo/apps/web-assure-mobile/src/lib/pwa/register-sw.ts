/**
 * register-sw -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Registration manuelle du service worker avec verification de quota de stockage.
 * A appeler depuis un useEffect cote client uniquement.
 */
import { logger } from '@/lib/logger';

const SW_PATH = '/sw.js';
const STORAGE_QUOTA_WARN_MB = 50;

async function checkStorageQuota(): Promise<void> {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) return;
  try {
    const estimate = await navigator.storage.estimate();
    const usedMb = ((estimate.usage ?? 0) / 1024 / 1024).toFixed(1);
    const quotaMb = ((estimate.quota ?? 0) / 1024 / 1024).toFixed(0);
    logger.info({ usedMb, quotaMb }, 'Storage quota');

    const usedNum = parseFloat(usedMb);
    if (usedNum > STORAGE_QUOTA_WARN_MB) {
      logger.warn({ usedMb, quotaMb }, 'Storage usage high -- offline cache may be limited');
    }
  } catch (err) {
    logger.warn({ err }, 'Storage estimate unavailable');
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    logger.info({ scope: reg.scope }, 'Service worker registered');
    await checkStorageQuota();
    return reg;
  } catch (err) {
    logger.error({ err }, 'Service worker registration failed');
    return null;
  }
}
