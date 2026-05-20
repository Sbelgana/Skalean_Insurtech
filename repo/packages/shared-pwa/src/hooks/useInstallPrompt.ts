'use client';
/**
 * useInstallPrompt -- captures beforeinstallprompt + detects iOS Safari
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { useCallback, useEffect, useState } from 'react';

const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface InstallPromptOptions {
  /** localStorage key prefix (default "insurtech.pwa"). */
  storagePrefix?: string | undefined;
  /** Dismissal TTL in milliseconds (default 7 days). */
  dismissTtlMs?: number | undefined;
}

export interface UseInstallPromptReturn {
  canInstall: boolean;
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: () => void;
  isIOS: boolean;
  isStandalone: boolean;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    'standalone' in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

function isDismissed(storageKey: string, ttlMs: number): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return false;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed < ttlMs;
}

export function useInstallPrompt(options: InstallPromptOptions = {}): UseInstallPromptReturn {
  const { storagePrefix = 'insurtech.pwa', dismissTtlMs = DISMISS_TTL_MS } = options;
  const storageKey = `${storagePrefix}.installPrompt.dismissedAt`;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState<boolean>(() => detectIOS());
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed(storageKey, dismissTtlMs));

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const prompt = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(Date.now()));
    setDismissed(true);
  }, [storageKey]);

  const canInstall =
    !isStandalone && !dismissed && (deferredPrompt !== null || (isIOS && !isStandalone));

  return { canInstall, prompt, dismiss, isIOS, isStandalone };
}
