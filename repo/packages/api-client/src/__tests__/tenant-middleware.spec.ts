import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantMiddleware } from '../middleware/tenant-middleware.js';

vi.mock('@insurtech/shared-ui/stores/tenant-store', () => ({
  useTenantStore: {
    getState: () => ({
      tenantId: 'tenant-uuid-123',
      traceId: 'trace-uuid-456',
      userId: 'user-uuid-789',
    }),
  },
}));

describe('tenantMiddleware', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
    Object.defineProperty(document, 'documentElement', {
      value: { lang: 'ar-MA' },
      configurable: true,
    });
  });

  it('injects x-tenant-id from store', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies');
    const out = await tenantMiddleware.onRequest!({
      request,
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof tenantMiddleware.onRequest>>[0]);
    expect((out ?? request).headers.get('x-tenant-id')).toBe('tenant-uuid-123');
  });

  it('injects x-trace-id and x-user-id', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies');
    const out = await tenantMiddleware.onRequest!({
      request,
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof tenantMiddleware.onRequest>>[0]);
    expect((out ?? request).headers.get('x-trace-id')).toBe('trace-uuid-456');
    expect((out ?? request).headers.get('x-user-id')).toBe('user-uuid-789');
  });

  it('propagates Accept-Language from documentElement.lang', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies');
    const out = await tenantMiddleware.onRequest!({
      request,
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof tenantMiddleware.onRequest>>[0]);
    expect((out ?? request).headers.get('Accept-Language')).toBe('ar-MA');
  });
});
