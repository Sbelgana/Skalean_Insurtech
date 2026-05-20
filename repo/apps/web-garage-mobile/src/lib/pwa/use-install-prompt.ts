'use client';
/**
 * useInstallPrompt -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Capture l'evenement beforeinstallprompt (Chrome/Android).
 * Detecte iOS pour afficher une banniere d'installation manuelle.
 * SSR-safe : guards typeof window avant tout acces.
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIos(ios);

    // Detect standalone mode (already installed)
    // Guard matchMedia for jsdom/test environments where it may be absent.
    const mediaMatch =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false;
    const standalone =
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
      mediaMatch;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const prompt = async (): Promise<void> => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      setCanPrompt(false);
    }
  };

  const dismiss = (): void => {
    setCanPrompt(false);
  };

  return { canPrompt, isIos, isStandalone, prompt, dismiss };
}
