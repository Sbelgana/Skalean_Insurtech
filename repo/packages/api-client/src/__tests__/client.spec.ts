import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from '../client.js';

describe('apiClient factory', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
  });

  it('builds with default baseUrl from env', () => {
    const client = createApiClient();
    expect(client).toBeDefined();
    expect(typeof client.GET).toBe('function');
  });

  it('respects custom baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });
    await (client as unknown as Record<string, Function>)['GET']('/health', {});
    expect(fetchMock).toHaveBeenCalled();
    // openapi-fetch calls fetch with a Request object -- check the url property
    const call = fetchMock.mock.calls[0]?.[0] as Request;
    expect(call.url).toContain('http://api.test');
  });

  it('injects Content-Type and Accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = createApiClient({ fetch: fetchMock });
    await (client as unknown as Record<string, Function>)['GET']('/health', {});
    const call = fetchMock.mock.calls[0][0] as Request;
    expect(call.headers.get('Content-Type')).toBe('application/json');
    expect(call.headers.get('Accept')).toBe('application/json');
  });

  it('throws if baseUrl resolves empty', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(() => createApiClient({ baseUrl: '' })).toThrow(/baseUrl/);
  });
});
