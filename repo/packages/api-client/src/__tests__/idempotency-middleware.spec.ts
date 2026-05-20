import { describe, it, expect, beforeEach } from 'vitest';
import {
  idempotencyMiddleware,
  generateIdempotencyKey,
} from '../middleware/idempotency-middleware.js';

describe('idempotencyMiddleware', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('generates a UUIDv7-shaped key', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('attaches Idempotency-Key on POST', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies', {
      method: 'POST',
      body: JSON.stringify({ name: 'Auto' }),
    });
    const out =
      (await idempotencyMiddleware.onRequest!({
        request,
        schemaPath: '/api/v1/policies',
        params: {},
      } as Parameters<NonNullable<typeof idempotencyMiddleware.onRequest>>[0])) ?? request;
    expect(out.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f]{8}-/);
  });

  it('does not attach key on GET', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies', { method: 'GET' });
    const out =
      (await idempotencyMiddleware.onRequest!({
        request,
        schemaPath: '/api/v1/policies',
        params: {},
      } as Parameters<NonNullable<typeof idempotencyMiddleware.onRequest>>[0])) ?? request;
    expect(out.headers.get('Idempotency-Key')).toBeNull();
  });

  it('reuses same key on identical retry within TTL', async () => {
    const make = () =>
      new Request('http://localhost:4000/api/v1/policies', {
        method: 'POST',
        body: JSON.stringify({ name: 'Auto' }),
      });
    const out1 = (await idempotencyMiddleware.onRequest!({
      request: make(),
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof idempotencyMiddleware.onRequest>>[0]))!;
    const out2 = (await idempotencyMiddleware.onRequest!({
      request: make(),
      schemaPath: '/api/v1/policies',
      params: {},
    } as Parameters<NonNullable<typeof idempotencyMiddleware.onRequest>>[0]))!;
    expect(out1.headers.get('Idempotency-Key')).toBe(out2.headers.get('Idempotency-Key'));
  });

  it('respects caller-provided Idempotency-Key', async () => {
    const request = new Request('http://localhost:4000/api/v1/policies', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'custom-key' },
      body: '{}',
    });
    const out =
      (await idempotencyMiddleware.onRequest!({
        request,
        schemaPath: '/api/v1/policies',
        params: {},
      } as Parameters<NonNullable<typeof idempotencyMiddleware.onRequest>>[0])) ?? request;
    expect(out.headers.get('Idempotency-Key')).toBe('custom-key');
  });
});
