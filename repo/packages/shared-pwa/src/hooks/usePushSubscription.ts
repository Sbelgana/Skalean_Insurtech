'use client';
/**
 * usePushSubscription -- VAPID push subscription hook
 * Reference: task-1.4.9 Sprint 4 Phase 1
 * Push notifications backend: Sprint 9 placeholder
 */
import { useCallback, useEffect, useState } from 'react';

export interface UsePushSubscriptionOptions {
  vapidPublicKey?: string | undefined;
  enabled?: boolean | undefined;
  onSubscribed?: ((subscription: PushSubscription) => void | Promise<void>) | undefined;
  onUnsubscribed?: (() => void | Promise<void>) | undefined;
}

export interface UsePushSubscriptionReturn {
  subscription: PushSubscription | null;
  permission: NotificationPermission | 'unsupported';
  subscribe: () => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<boolean>;
  isReady: boolean;
}

function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker != null &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    (window as Window & { PushManager?: unknown }).PushManager != null
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function getInitialPermission(enabled: boolean): NotificationPermission | 'unsupported' {
  if (!enabled) return 'default';
  if (!isPushSupported()) return 'unsupported';
  if (typeof Notification !== 'undefined') return Notification.permission;
  return 'default';
}

export function usePushSubscription(
  options: UsePushSubscriptionOptions = {},
): UsePushSubscriptionReturn {
  const { vapidPublicKey, enabled = true, onSubscribed, onUnsubscribed } = options;
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    () => getInitialPermission(enabled),
  );
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (!isPushSupported()) {
      setPermission('unsupported');
      setIsReady(true);
      return;
    }
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }

    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setSubscription(existing);
          setIsReady(true);
        }
      } catch {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    if (!vapidPublicKey) {
      console.warn('[shared-pwa] VAPID public key manquante. Sprint 9 fournira la cle backend.');
      return null;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return null;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    setSubscription(sub);
    await onSubscribed?.(sub);
    return sub;
  }, [onSubscribed, vapidPublicKey]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;
    const ok = await subscription.unsubscribe();
    if (ok) {
      setSubscription(null);
      await onUnsubscribed?.();
    }
    return ok;
  }, [onUnsubscribed, subscription]);

  return { subscription, permission, subscribe, unsubscribe, isReady };
}
