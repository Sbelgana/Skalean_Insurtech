'use client';
/**
 * useServiceWorker -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Enveloppe la registration du service worker et expose l'etat.
 * SSR-safe : s'execute uniquement apres mount.
 */
import { useEffect, useState } from 'react';

export type SwStatus = 'idle' | 'registering' | 'registered' | 'update-available' | 'error';

export function useServiceWorker() {
  const [status, setStatus] = useState<SwStatus>('idle');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    setStatus('registering');

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        setRegistration(reg);
        setStatus('registered');

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setStatus('update-available');
            }
          });
        });
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  const applyUpdate = (): void => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  return { status, registration, applyUpdate };
}
