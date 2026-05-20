/**
 * useInstallPrompt spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

class MockBeforeInstallPromptEvent extends Event {
  readonly platforms = ['web'] as const;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt = vi.fn(async () => undefined);
  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt');
    this.userChoice = Promise.resolve({ outcome, platform: 'web' });
  }
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useInstallPrompt', () => {
  it('canInstall=false initially', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it('canInstall=true after beforeinstallprompt event', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const evt = new MockBeforeInstallPromptEvent();
    await act(async () => {
      window.dispatchEvent(evt);
    });
    expect(result.current.canInstall).toBe(true);
  });

  it('prompt returns accepted', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const evt = new MockBeforeInstallPromptEvent('accepted');
    await act(async () => {
      window.dispatchEvent(evt);
    });
    let outcome: string = '';
    await act(async () => {
      outcome = await result.current.prompt();
    });
    expect(outcome).toBe('accepted');
    expect(evt.prompt).toHaveBeenCalled();
  });

  it('dismiss persists timestamp', () => {
    const { result } = renderHook(() => useInstallPrompt({ storagePrefix: 'test' }));
    act(() => {
      result.current.dismiss();
    });
    expect(window.localStorage.getItem('test.installPrompt.dismissedAt')).not.toBeNull();
  });

  it('canInstall=false within dismissTtl', () => {
    window.localStorage.setItem('test.installPrompt.dismissedAt', String(Date.now()));
    const { result } = renderHook(() => useInstallPrompt({ storagePrefix: 'test' }));
    expect(result.current.canInstall).toBe(false);
  });

  it('detects iOS user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(true);
  });

  it('returns unavailable if no deferredPrompt', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const outcome = await result.current.prompt();
    expect(outcome).toBe('unavailable');
  });
});
