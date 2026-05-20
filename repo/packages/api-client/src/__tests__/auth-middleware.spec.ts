import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware, refreshAccessToken } from '../middleware/auth-middleware.js';

const mockSetTokens = vi.fn();

vi.mock('@insurtech/shared-ui/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: 'access-token-old',
      refreshToken: 'refresh-token-valid',
      setTokens: mockSetTokens,
    }),
  },
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    mockSetTokens.mockClear();
  });

  it('injects Authorization Bearer header', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies');
    const out = await authMiddleware.onRequest!({
      request,
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof authMiddleware.onRequest>>[0]);
    expect((out ?? request).headers.get('Authorization')).toBe('Bearer access-token-old');
  });

  it('does not overwrite existing Authorization header', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies', {
      headers: { Authorization: 'Bearer custom' },
    });
    const out = await authMiddleware.onRequest!({
      request,
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof authMiddleware.onRequest>>[0]);
    expect((out ?? request).headers.get('Authorization')).toBe('Bearer custom');
  });

  it('refresh on 401 triggers POST /auth/refresh and retries', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const original = new Request('http://localhost:4000/api/v1/policies');
    const initial401 = new Response('{}', { status: 401 });

    const out = await authMiddleware.onResponse!({
      request: original,
      response: initial401,
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof authMiddleware.onResponse>>[0]);

    expect(fetchMock).toHaveBeenCalled();
    expect((out as Response).status).toBe(200);
    expect(mockSetTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
  });

  it('refresh mutex prevents concurrent refresh calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'new', refreshToken: 'new' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const [a, b, c] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);
    expect(a).toBe('new');
    expect(b).toBe('new');
    expect(c).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(1); // single refresh call despite 3 concurrent triggers
  });

  it('does not retry on /auth/refresh itself (avoid loop)', async () => {
    const original = new Request('http://localhost:4000/api/v1/auth/refresh', {
      method: 'POST',
    });
    const r401 = new Response('{}', { status: 401 });
    const out = await authMiddleware.onResponse!({
      request: original,
      response: r401,
      schemaPath: '/api/v1/auth/refresh',
      params: {},
    } as Parameters<NonNullable<typeof authMiddleware.onResponse>>[0]);
    expect((out as Response).status).toBe(401);
  });
});
