/**
 * Tests E2E health probes -- necessite serveur en cours d'execution.
 *
 * Lancer : pnpm --filter @insurtech/api dev
 * Lancer : pnpm --filter @insurtech/api test:e2e -g healthz
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env['TEST_API_URL'] ?? 'http://localhost:14000';

test.describe('Health probes E2E (Sprint 3 Tache 1.3.10)', () => {
  test('GET /healthz retourne 200 + { status: "ok" }', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/healthz`);
    expect(r.status()).toBe(200);
    const body = (await r.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  test('GET /healthz retourne instantanement (< 100ms)', async ({ request }) => {
    const start = Date.now();
    await request.get(`${BASE_URL}/healthz`);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

  test('GET /readyz retourne 200 ou 503 selon etat deps', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/readyz`);
    expect([200, 503]).toContain(r.status());
  });

  test('GET /readyz body contient status', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/readyz`);
    const body = (await r.json()) as { status: string };
    expect(['ok', 'error']).toContain(body.status);
  });

  test('GET /readyz inclut details des indicators', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/readyz`);
    const body = (await r.json()) as { details?: Record<string, unknown> };
    expect(body.details).toBeDefined();
    expect(body.details?.['db']).toBeDefined();
    expect(body.details?.['redis']).toBeDefined();
  });

  test('GET /healthz pas auth required', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/healthz`);
    expect(r.status()).toBe(200);
  });

  test('GET /readyz pas auth required', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/readyz`);
    expect([200, 503]).toContain(r.status());
  });

  test('GET /healthz pas de wrap { data, meta }', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/healthz`);
    const body = (await r.json()) as Record<string, unknown>;
    expect(body['data']).toBeUndefined();
    expect(body['meta']).toBeUndefined();
    expect(body['status']).toBe('ok');
  });

  test('Header Cache-Control no-store sur /healthz', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/healthz`);
    const cc = r.headers()['cache-control'];
    expect(cc).toMatch(/no-store/);
  });

  test('Header X-Health-Type liveness sur /healthz', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/healthz`);
    expect(r.headers()['x-health-type']).toBe('liveness');
  });

  test('Header X-Health-Type readiness sur /readyz', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/readyz`);
    expect(r.headers()['x-health-type']).toBe('readiness');
  });

  test('Cache 5s actif sur /readyz (second call plus rapide)', async ({ request }) => {
    await request.get(`${BASE_URL}/readyz`); // chauffe le cache
    const start = Date.now();
    const r = await request.get(`${BASE_URL}/readyz`);
    const duration = Date.now() - start;
    if (r.status() === 200) {
      // Le second appel doit etre servi depuis le cache (< 50ms)
      expect(duration).toBeLessThan(50);
    }
  });
});
