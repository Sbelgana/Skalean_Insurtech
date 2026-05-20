/**
 * useDirections spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useDirections } from '../src/hooks/useDirections';

const MOCK_ROUTE = {
  geometry: {
    type: 'LineString' as const,
    coordinates: [[-7.62, 33.58], [-7.57, 33.58]],
  },
  distance: 5000,
  duration: 600,
};

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] = 'pk.test.token';
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ routes: [MOCK_ROUTE] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

describe('useDirections', () => {
  it('fetches route between two points', async () => {
    const from: [number, number] = [-7.62, 33.58];
    const to: [number, number] = [-7.57, 33.58];
    const { result } = renderHook(
      () => useDirections(from, to, { profile: 'driving' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.distanceMeters).toBe(5000);
    expect(result.current.data?.durationSeconds).toBe(600);
    expect(result.current.data?.geometry.type).toBe('LineString');
  });

  it('disabled when from is null', () => {
    const { result } = renderHook(
      () => useDirections(null, [-7.57, 33.58]),
      { wrapper: createWrapper() },
    );
    expect(result.current.status).toBe('pending');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
