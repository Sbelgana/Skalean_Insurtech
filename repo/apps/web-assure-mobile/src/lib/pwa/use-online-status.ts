'use client';
/**
 * useOnlineStatus -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Ecoute les evenements online/offline du navigateur.
 * SSR-safe : initialise a true cote serveur, lit navigator.onLine apres mount.
 */
import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { online };
}
