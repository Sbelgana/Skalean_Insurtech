/**
 * usePushSubscription spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePushSubscription } from './usePushSubscription';

function setupPushManager(initialSub: PushSubscription | null = null) {
  const mockSub = {
    endpoint: 'https://push.example/abc',
    unsubscribe: vi.fn(async () => true),
  } as unknown as PushSubscription;
  const subscribe = vi.fn(async () => initialSub ?? mockSub);
  const getSubscription = vi.fn(async () => initialSub);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }),
    },
  });
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() {
      // mock constructor
    },
    configurable: true,
  });
  Object.defineProperty(window, 'Notification', {
    value: Object.assign(
      function Notification() {
        // mock constructor
      },
      {
        permission: 'default' as NotificationPermission,
        requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
      },
    ),
    configurable: true,
  });
}

beforeEach(() => {
  setupPushManager(null);
});

describe('usePushSubscription', () => {
  it('isReady true after mount', async () => {
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it('returns null subscribe if vapidPublicKey missing', async () => {
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let sub: PushSubscription | null = null;
    await act(async () => {
      sub = await result.current.subscribe();
    });
    expect(sub).toBeNull();
  });

  it('subscribes when vapidPublicKey provided and permission granted', async () => {
    // Valid base64url-encoded 65-byte VAPID public key (P-256 uncompressed point)
    const validVapidKey =
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    const { result } = renderHook(() =>
      usePushSubscription({ vapidPublicKey: validVapidKey }),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let sub: PushSubscription | null = null;
    await act(async () => {
      sub = await result.current.subscribe();
    });
    expect(sub).not.toBeNull();
    expect(result.current.subscription).not.toBeNull();
  });

  it('permission unsupported when PushManager absent', () => {
    Object.defineProperty(window, 'PushManager', { value: undefined, configurable: true });
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.permission).toBe('unsupported');
  });
});
