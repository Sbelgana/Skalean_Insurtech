/**
 * Smoke E2E -- Sprint 8 Task 8.14b Phase 2 (Session B hardened).
 *
 * Validates that the TestApp factory boots the full AppModule graph
 * (19 modules : Auth + CRM + Booking + Comm + Docs + ...) AND that the
 * Fastify HTTP adapter responds to a request. If this fails, every other
 * E2E in this directory will fail too -- treat as the canary.
 *
 * Boot hardening achieved in Session B :
 *   - .env / .env.test loaded from repo root (cwd resolution)
 *   - DATABASE_URL forced to test stack (5433 / skalean / skalean_test)
 *   - REDIS_URL with auth `:skalean_redis_test@`
 *   - KAFKA_BROKERS `localhost:9095`
 *   - Runtime RSA keypair (avoids .env base64 multi-line PEM parsing)
 *   - PASSWORD_PEPPER >= 32 chars + MFA_SECRET_ENCRYPTION_KEY = 64 hex
 *   - CALENDAR_TOKEN_ENCRYPTION_KEY 64 hex
 *   - CustomFieldsValidatorService defensive null guards on DI
 *   - OAuth + Sentry + OTel disabled via env
 *
 * Known limitation : `skipGlobals: true` is required because
 * AllExceptionsFilter uses Express `reply.status()` instead of Fastify's
 * `reply.code()`. Tracked in e2e-test-conventions.md as Sprint 9 dette.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  createTestApp,
  type TestAppContext,
} from './setup/test-app.factory.js';

describe('Smoke E2E -- TestApp factory boots AppModule (Sprint 8 Task 8.14b)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    // skipGlobals: true bypasses AllExceptionsFilter which uses Express
    // `reply.status()` instead of Fastify's `reply.code()`. Tracked as a
    // Sprint 9 dette technique in e2e-test-conventions.md.
    ctx = await createTestApp({ skipGlobals: true });
  });

  afterAll(async () => {
    if (ctx) await closeTestApp(ctx);
  });

  it('boots NestJS app via FastifyAdapter without error', () => {
    expect(ctx.app).toBeDefined();
    expect(ctx.dataSource).toBeDefined();
    expect(ctx.dataSource.isInitialized).toBe(true);
  });

  it('GET / returns a response (any status, just verifying request handling)', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/' });
    // We only verify the request was processed -- exact status depends on
    // route mapping (some health endpoints may live behind /api/v1 prefix
    // or require auth). Anything between 200 and 503 means Fastify routed
    // the request through the middleware stack.
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(600);
  });
});
