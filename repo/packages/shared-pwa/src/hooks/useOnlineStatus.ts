'use client';
/**
 * useOnlineStatus -- navigator.onLine + debounce
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { useEffect, useRef, useState } from 'react';

export interface OnlineStatusOptions {
  debounceMs?: number | undefined;
}

export interface UseOnlineStatusReturn {
  isOnline: boolean;
  lastChangeAt: number;
}

export function useOnlineStatus(options: OnlineStatusOptions = {}): UseOnlineStatusReturn {
  const { debounceMs = 300 } = options;
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [lastChangeAt, setLastChangeAt] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apply = (next: boolean) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsOnline((prev) => {
          if (prev === next) return prev;
          setLastChangeAt(Date.now());
          return next;
        });
      }, debounceMs);
    };

    const handleOnline = () => apply(true);
    const handleOffline = () => apply(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs]);

  return { isOnline, lastChangeAt };
}
