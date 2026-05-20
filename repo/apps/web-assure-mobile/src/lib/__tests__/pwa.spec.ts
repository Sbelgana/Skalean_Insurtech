/**
 * pwa.spec.ts -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Tests pour useOnlineStatus et useInstallPrompt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '@/lib/pwa/use-online-status';
import { useInstallPrompt } from '@/lib/pwa/use-install-prompt';

describe('useOnlineStatus', () => {
  beforeEach(() => {
    // Reset to online state before each test
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(true);
  });

  it('updates to false when offline event fires', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.online).toBe(false);
  });

  it('updates to true when online event fires after offline', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current.online).toBe(true);
  });

  it('handles multiple online/offline toggles', () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.online).toBe(false);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current.online).toBe(true);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.online).toBe(false);
  });

  it('reflects navigator.onLine initial state (false)', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    // After mount effect, should reflect navigator.onLine
    act(() => {});
    expect(result.current.online).toBe(false);
  });

  it('removes event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});

describe('useInstallPrompt', () => {
  beforeEach(() => {
    // Reset navigator.userAgent to non-iOS
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
      configurable: true,
    });
  });

  it('returns canPrompt false initially', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(false);
  });

  it('sets canPrompt true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const mockPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    } as unknown as Event;

    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockPromptEvent));
    });

    expect(result.current.canPrompt).toBe(true);
  });

  it('sets canPrompt false after dismiss', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const mockPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    } as unknown as Event;

    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockPromptEvent));
    });
    act(() => { result.current.dismiss(); });
    expect(result.current.canPrompt).toBe(false);
  });

  it('detects iOS from userAgent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {});
    expect(result.current.isIos).toBe(true);
  });

  it('detects non-iOS from Android userAgent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      configurable: true,
    });
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {});
    expect(result.current.isIos).toBe(false);
  });
});
