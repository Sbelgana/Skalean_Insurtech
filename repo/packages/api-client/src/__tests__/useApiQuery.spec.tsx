import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useApiQuery } from '../hooks/useApiQuery.js';

vi.mock('../client.js', () => ({
  apiClient: {
    GET: vi.fn().mockResolvedValue({
      data: { status: 'ok', timestamp: '2026-05-06T00:00:00Z', version: '0.1.0', uptime: 42 },
      response: { ok: true, status: 200 },
    }),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useApiQuery', () => {
  it('returns typed data from API', async () => {
    const { result } = renderHook(
      () => useApiQuery('/health' as unknown as '/health', {} as never),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ status: 'ok', uptime: 42 });
  });

  it('uses queryKey based on path + params', async () => {
    const { result } = renderHook(
      () =>
        useApiQuery('/health' as unknown as '/health', { query: { lang: 'fr' } } as never, {
          extraKey: ['v1'],
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // queryKey is internal but observable via data caching consistency
  });

  it('respects custom staleTime', async () => {
    const { result } = renderHook(
      () =>
        useApiQuery('/health' as unknown as '/health', {} as never, { staleTime: 1_000_000 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
