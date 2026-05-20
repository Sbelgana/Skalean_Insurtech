/**
 * api-client.spec.ts -- web-broker
 * Reference : task-1.4.1 Sprint 4 Phase 1
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import * as Sentry from '@sentry/nextjs';
import { createApiClient } from '@/lib/api-client';
import { useTenantStore } from '@/store/tenant-store';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), init: vi.fn(), setTag: vi.fn() }));
vi.mock('pino', () => {
  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pino: any = vi.fn(() => mockLogger);
  pino.stdTimeFunctions = { isoTime: vi.fn() };
  return { default: pino };
});

describe('api-client', () => {
  let client: ReturnType<typeof createApiClient>;
  let mock: MockAdapter;

  beforeEach(() => {
    client = createApiClient({ baseURL: 'http://localhost:4000' });
    mock = new MockAdapter(client);
    useTenantStore.getState().clearTenant();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  it('injects x-tenant-id from zustand store', async () => {
    useTenantStore.getState().setTenantId('tenant-abc-123');
    let capturedHeaders: Record<string, unknown> = {};
    mock.onGet('/api/v1/contacts').reply((config) => {
      capturedHeaders = config.headers as Record<string, unknown>;
      return [200, []];
    });
    await client.get('/api/v1/contacts');
    expect(capturedHeaders['x-tenant-id']).toBe('tenant-abc-123');
  });

  it('injects x-trace-id as UUID v4 on every request', async () => {
    let capturedTrace = '';
    mock.onGet('/api/v1/health').reply((config) => {
      capturedTrace = (config.headers as Record<string, string>)['x-trace-id'] ?? '';
      return [200, { ok: true }];
    });
    await client.get('/api/v1/health');
    expect(capturedTrace).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('injects Idempotency-Key on POST mutations', async () => {
    let capturedKey = '';
    mock.onPost('/api/v1/contacts').reply((config) => {
      capturedKey = (config.headers as Record<string, string>)['Idempotency-Key'] ?? '';
      return [201, { id: '1' }];
    });
    await client.post('/api/v1/contacts', { name: 'Acme' });
    expect(capturedKey).toBeTruthy();
  });

  it('injects Idempotency-Key on PUT/PATCH/DELETE', async () => {
    let putKey = '', patchKey = '', deleteKey = '';
    mock.onPut('/api/v1/contacts/1').reply((c) => { putKey = (c.headers as Record<string, string>)['Idempotency-Key'] ?? ''; return [200, {}]; });
    mock.onPatch('/api/v1/contacts/1').reply((c) => { patchKey = (c.headers as Record<string, string>)['Idempotency-Key'] ?? ''; return [200, {}]; });
    mock.onDelete('/api/v1/contacts/1').reply((c) => { deleteKey = (c.headers as Record<string, string>)['Idempotency-Key'] ?? ''; return [204]; });
    await client.put('/api/v1/contacts/1', {});
    await client.patch('/api/v1/contacts/1', {});
    await client.delete('/api/v1/contacts/1');
    expect(putKey).toBeTruthy();
    expect(patchKey).toBeTruthy();
    expect(deleteKey).toBeTruthy();
  });

  it('does NOT inject Idempotency-Key on GET', async () => {
    let capturedHeaders: Record<string, unknown> = {};
    mock.onGet('/api/v1/contacts').reply((config) => {
      capturedHeaders = config.headers as Record<string, unknown>;
      return [200, []];
    });
    await client.get('/api/v1/contacts');
    expect(capturedHeaders['Idempotency-Key']).toBeUndefined();
  });

  it('injects Authorization Bearer when access_token present', async () => {
    sessionStorage.setItem('skalean.access_token', 'jwt-token-xyz');
    let capturedAuth = '';
    mock.onGet('/api/v1/me').reply((config) => {
      capturedAuth = (config.headers as Record<string, string>)['Authorization'] ?? '';
      return [200, { id: '1' }];
    });
    await client.get('/api/v1/me');
    expect(capturedAuth).toBe('Bearer jwt-token-xyz');
  });

  it('captures 5xx errors in Sentry', async () => {
    mock.onGet('/api/v1/contacts').reply(503);
    await expect(client.get('/api/v1/contacts')).rejects.toThrow();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('does NOT capture 4xx errors in Sentry', async () => {
    mock.onGet('/api/v1/contacts/missing').reply(404);
    await expect(client.get('/api/v1/contacts/missing')).rejects.toThrow();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('uses NEXT_PUBLIC_API_URL when no baseURL override', () => {
    const c = createApiClient();
    expect(c.defaults.baseURL).toBe(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
  });
});
