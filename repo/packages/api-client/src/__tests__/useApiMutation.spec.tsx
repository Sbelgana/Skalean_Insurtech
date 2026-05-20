import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useApiMutation } from '../hooks/useApiMutation.js';

const postMock = vi.hoisted(() => vi.fn());
vi.mock('../client.js', () => ({
  apiClient: { POST: postMock },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useApiMutation', () => {
  it('calls POST with body and returns data', async () => {
    postMock.mockResolvedValue({ data: { id: 'p-1' }, response: { ok: true, status: 201 } });
    const { result } = renderHook(
      () =>
        useApiMutation(
          '/api/v1/policies' as unknown as '/health',
          'post' as unknown as 'post',
        ),
      { wrapper },
    );
    await act(async () => {
      result.current.mutate({ name: 'Auto' } as never);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postMock).toHaveBeenCalledWith('/api/v1/policies', { body: { name: 'Auto' } });
  });

  it('invalidates queries after success', async () => {
    postMock.mockResolvedValue({ data: {}, response: { ok: true, status: 200 } });
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useApiMutation(
          '/api/v1/policies' as unknown as '/health',
          'post' as unknown as 'post',
          { invalidateQueries: [['api', '/api/v1/policies']] },
        ),
      { wrapper: customWrapper },
    );
    await act(async () => {
      result.current.mutate({} as never);
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['api', '/api/v1/policies'],
      }),
    );
  });

  it('throws on error and triggers onError', async () => {
    postMock.mockResolvedValue({
      error: { message: 'bad' },
      response: { ok: false, status: 400, statusText: 'Bad Request' },
    });
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useApiMutation(
          '/api/v1/policies' as unknown as '/health',
          'post' as unknown as 'post',
          { onError, showErrorToast: false },
        ),
      { wrapper },
    );
    await act(async () => {
      result.current.mutate({} as never);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onError).toHaveBeenCalled();
  });
});
