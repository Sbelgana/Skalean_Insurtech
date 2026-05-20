/**
 * useOnlineStatus spec -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from './useOnlineStatus';

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('useOnlineStatus', () => {
  it('initial state online', () => {
    const { result } = renderHook(() => useOnlineStatus({ debounceMs: 10 }));
    expect(result.current.isOnline).toBe(true);
  });

  it('flips to offline on offline event after debounce', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnlineStatus({ debounceMs: 100 }));
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.isOnline).toBe(false);
    vi.useRealTimers();
  });

  it('flips back to online', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnlineStatus({ debounceMs: 50 }));
    act(() => window.dispatchEvent(new Event('offline')));
    await act(async () => vi.advanceTimersByTime(50));
    act(() => window.dispatchEvent(new Event('online')));
    await act(async () => vi.advanceTimersByTime(50));
    expect(result.current.isOnline).toBe(true);
    vi.useRealTimers();
  });

  it('debounces rapid transitions', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnlineStatus({ debounceMs: 200 }));
    act(() => window.dispatchEvent(new Event('offline')));
    act(() => window.dispatchEvent(new Event('online')));
    act(() => window.dispatchEvent(new Event('offline')));
    await act(async () => vi.advanceTimersByTime(200));
    expect(result.current.isOnline).toBe(false);
    vi.useRealTimers();
  });
});
