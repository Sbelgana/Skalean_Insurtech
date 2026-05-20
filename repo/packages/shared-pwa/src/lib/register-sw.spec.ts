/**
 * registerServiceWorker spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerServiceWorker } from './register-sw';

describe('registerServiceWorker', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn(async () => ({
          waiting: null,
          installing: null,
          active: { state: 'activated' },
          addEventListener: vi.fn(),
        })),
        getRegistration: vi.fn(async () => null),
        controller: null,
      },
    });
  });

  it('returns null when serviceWorker unsupported', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const reg = await registerServiceWorker('/sw.js');
    expect(reg).toBeNull();
  });

  it('reuses existing registration (idempotent)', async () => {
    const fakeReg = {
      waiting: null,
      installing: null,
      active: { state: 'activated' },
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn(),
        getRegistration: vi.fn(async () => fakeReg),
        controller: null,
      },
    });
    const reg = await registerServiceWorker('/sw.js');
    expect(reg).toBe(fakeReg);
    expect(
      (navigator.serviceWorker as unknown as { register: () => unknown }).register,
    ).not.toHaveBeenCalled();
  });

  it('calls onSuccess on first registration', async () => {
    const onSuccess = vi.fn();
    await registerServiceWorker('/sw.js', { onSuccess });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onError on register throw', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn(async () => {
          throw new Error('register-failed');
        }),
        getRegistration: vi.fn(async () => null),
      },
    });
    const onError = vi.fn();
    const reg = await registerServiceWorker('/sw.js', { onError });
    expect(reg).toBeNull();
    expect(onError).toHaveBeenCalled();
  });
});
