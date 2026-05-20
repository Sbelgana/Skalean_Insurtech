'use client';
/**
 * useServiceWorker -- SW registration + state machine
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type ServiceWorkerStatus =
  | 'idle'
  | 'unsupported'
  | 'installing'
  | 'installed'
  | 'activating'
  | 'active'
  | 'redundant'
  | 'error';

export interface UseServiceWorkerOptions {
  swPath?: string | undefined;
  scope?: string | undefined;
  onUpdateAvailable?: ((registration: ServiceWorkerRegistration) => void) | undefined;
  onActivated?: ((registration: ServiceWorkerRegistration) => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
  enabled?: boolean | undefined;
}

export interface UseServiceWorkerReturn {
  registration: ServiceWorkerRegistration | null;
  status: ServiceWorkerStatus;
  update: () => Promise<void>;
  unregister: () => Promise<boolean>;
  hasUpdate: boolean;
}

export function useServiceWorker(options: UseServiceWorkerOptions = {}): UseServiceWorkerReturn {
  const {
    swPath = '/sw.js',
    scope = '/',
    onUpdateAvailable,
    onActivated,
    onError,
    enabled = true,
  } = options;

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [status, setStatus] = useState<ServiceWorkerStatus>('idle');
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  const trackWorker = useCallback(
    (reg: ServiceWorkerRegistration, worker: ServiceWorker) => {
      const handleStateChange = () => {
        if (!mountedRef.current) return;
        switch (worker.state) {
          case 'installing':
            setStatus('installing');
            break;
          case 'installed':
            setStatus('installed');
            if (navigator.serviceWorker.controller) {
              setHasUpdate(true);
              onUpdateAvailable?.(reg);
            }
            break;
          case 'activating':
            setStatus('activating');
            break;
          case 'activated':
            setStatus('active');
            onActivated?.(reg);
            break;
          case 'redundant':
            setStatus('redundant');
            break;
          default:
            break;
        }
      };
      worker.addEventListener('statechange', handleStateChange);
      handleStateChange();
    },
    [onActivated, onUpdateAvailable],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator) ||
      navigator.serviceWorker == null
    ) {
      setStatus('unsupported');
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register(swPath, { scope });
        if (cancelled || !mountedRef.current) return;
        setRegistration(reg);

        if (reg.installing) trackWorker(reg, reg.installing);
        if (reg.waiting) {
          setHasUpdate(true);
          onUpdateAvailable?.(reg);
        }
        if (reg.active) setStatus('active');

        reg.addEventListener('updatefound', () => {
          if (reg.installing) trackWorker(reg, reg.installing);
        });

        const onControllerChange = () => {
          if (!mountedRef.current) return;
          setStatus('active');
          setHasUpdate(false);
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        cleanupRef.current = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        };
      } catch (err) {
        if (!mountedRef.current) return;
        setStatus('error');
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      cleanupRef.current?.();
    };
  }, [enabled, swPath, scope, onError, onUpdateAvailable, trackWorker]);

  const update = useCallback(async (): Promise<void> => {
    if (!registration) return;
    await registration.update();
  }, [registration]);

  const unregister = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;
    const ok = await registration.unregister();
    if (ok) {
      setRegistration(null);
      setStatus('idle');
      setHasUpdate(false);
    }
    return ok;
  }, [registration]);

  return { registration, status, update, unregister, hasUpdate };
}
