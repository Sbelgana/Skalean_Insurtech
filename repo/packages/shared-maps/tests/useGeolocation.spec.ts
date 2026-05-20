/**
 * useGeolocation spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeolocation } from '../src/hooks/useGeolocation';

const mockPosition: GeolocationPosition = {
  coords: {
    longitude: -7.5898,
    latitude: 33.5731,
    accuracy: 15,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
};

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: (pos: GeolocationPosition) => void) => {
        setTimeout(() => success(mockPosition), 0);
      }),
      watchPosition: vi.fn(
        (success: (pos: GeolocationPosition) => void) => {
          setTimeout(() => success(mockPosition), 0);
          return 1;
        },
      ),
      clearWatch: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGeolocation', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useGeolocation({ watch: false }));
    expect(result.current.loading).toBe(true);
    expect(result.current.position).toBeNull();
  });

  it('resolves position via getCurrentPosition', async () => {
    const { result } = renderHook(() => useGeolocation({ watch: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.position).toEqual([-7.5898, 33.5731]);
    expect(result.current.accuracy).toBe(15);
    expect(result.current.error).toBeNull();
  });

  it('resolves position via watchPosition', async () => {
    const { result } = renderHook(() => useGeolocation({ watch: true }));
    await waitFor(() => expect(result.current.position).not.toBeNull());
    expect(result.current.position).toEqual([-7.5898, 33.5731]);
  });

  it('sets error on permission denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(
          (_success: unknown, error: (err: GeolocationPositionError) => void) => {
            const e = {
              code: 1,
              message: 'Permission denied',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError;
            setTimeout(() => error(e), 0);
          },
        ),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
    });
    const { result } = renderHook(() => useGeolocation({ watch: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.position).toBeNull();
  });

  it('sets error when geolocation API unavailable', () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useGeolocation({ watch: false }));
    expect(result.current.error).not.toBeNull();
  });
});
