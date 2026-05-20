/**
 * useServiceWorker spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useServiceWorker } from './useServiceWorker';

function createMockRegistration(
  overrides: Partial<ServiceWorkerRegistration> = {},
): ServiceWorkerRegistration {
  return {
    installing: null,
    waiting: null,
    active: { state: 'activated' } as unknown as ServiceWorker,
    scope: '/',
    update: vi.fn(async () => undefined),
    unregister: vi.fn(async () => true),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
}

beforeEach(() => {
  const reg = createMockRegistration();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(async () => reg),
      getRegistration: vi.fn(async () => reg),
      controller: null,
      ready: Promise.resolve(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});

describe('useServiceWorker', () => {
  it('status idle if disabled', () => {
    const { result } = renderHook(() => useServiceWorker({ enabled: false }));
    expect(result.current.status).toBe('idle');
  });

  it('registers SW at mount and reaches active', async () => {
    const { result } = renderHook(() => useServiceWorker({ swPath: '/sw.js' }));
    await waitFor(() => {
      expect(result.current.registration).not.toBeNull();
      expect(result.current.status).toBe('active');
    });
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('unsupported when serviceWorker not in navigator', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.status).toBe('unsupported');
  });

  it('update calls registration.update()', async () => {
    const { result } = renderHook(() => useServiceWorker());
    await waitFor(() => expect(result.current.registration).not.toBeNull());
    await act(async () => {
      await result.current.update();
    });
    expect(result.current.registration?.update).toHaveBeenCalled();
  });

  it('error -> status error + onError callback', async () => {
    const onError = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(async () => {
          throw new Error('boom');
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    });
    const { result } = renderHook(() => useServiceWorker({ onError }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(onError).toHaveBeenCalled();
  });
});
