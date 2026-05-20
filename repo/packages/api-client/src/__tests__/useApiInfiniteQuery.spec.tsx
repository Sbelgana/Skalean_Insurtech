import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useApiInfiniteQuery } from '../hooks/useApiInfiniteQuery.js';

const getMock = vi.hoisted(() => vi.fn());
vi.mock('../client.js', () => ({
  apiClient: { GET: getMock },
}));

describe('useApiInfiniteQuery', () => {
  // Stable QueryClient per test -- prevents state loss when wrapper re-renders
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getMock.mockReset();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  it('fetches first page with cursor=null', async () => {
    getMock.mockResolvedValue({
      data: { items: [{ id: 1 }, { id: 2 }], nextCursor: 'c1' },
      response: { ok: true, status: 200 },
    });
    const { result } = renderHook(
      () =>
        useApiInfiniteQuery(
          '/api/v1/contacts' as unknown as '/health',
          {},
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]).toMatchObject({
      items: [{ id: 1 }, { id: 2 }],
      nextCursor: 'c1',
    });
  });

  it('fetchNextPage uses returned cursor', async () => {
    // Use mockImplementation with a counter to avoid Once-queue issues
    const responses = [
      { data: { items: [{ id: 1 }], nextCursor: 'c1' }, response: { ok: true, status: 200 } },
      { data: { items: [{ id: 2 }], nextCursor: null }, response: { ok: true, status: 200 } },
    ];
    let callIdx = 0;
    getMock.mockImplementation(() => Promise.resolve(responses[callIdx++]));

    const { result } = renderHook(
      () => useApiInfiniteQuery('/api/v1/contacts' as unknown as '/health', {}),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });
});
