/**
 * useReverseGeocoding spec -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useReverseGeocoding } from '../src/hooks/useReverseGeocoding';

const MOCK_FEATURE = {
  place_name: 'Casablanca, Maroc',
  context: [{ id: 'country.1', text: 'Maroc' }],
  center: [-7.5898, 33.5731],
};

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] = 'pk.test.token';
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ features: [MOCK_FEATURE] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

describe('useReverseGeocoding', () => {
  it('fetches address for coordinates', async () => {
    const { result } = renderHook(
      () => useReverseGeocoding(-7.5898, 33.5731),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.placeName).toBe('Casablanca, Maroc');
  });

  it('disabled when coordinates are null', () => {
    const { result } = renderHook(
      () => useReverseGeocoding(null, null),
      { wrapper: createWrapper() },
    );
    expect(result.current.status).toBe('pending');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('disabled when token missing', () => {
    delete process.env['NEXT_PUBLIC_MAPBOX_TOKEN'];
    const { result } = renderHook(
      () => useReverseGeocoding(-7.5898, 33.5731),
      { wrapper: createWrapper() },
    );
    expect(result.current.status).toBe('pending');
  });
});
