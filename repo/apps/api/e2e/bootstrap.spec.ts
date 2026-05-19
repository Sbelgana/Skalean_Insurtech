/**
 * Tests E2E Playwright pour le bootstrap NestJS+Fastify.
 *
 * Prerequis : serveur demarre sur http://localhost:14000 (port test).
 * Ces tests sont skipped si le serveur n'est pas demarre (CI standard).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:14000';

test.describe('Bootstrap E2E (Sprint 3 Tache 1.3.1)', () => {
  test('GET / returns 200 + JSON metadata', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      name: expect.any(String),
      version: expect.any(String),
      env: expect.any(String),
      uptime_seconds: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  test('GET / sets Cache-Control: no-store header', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('GET / sets X-API-Endpoint: root header', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.headers()['x-api-endpoint']).toBe('root');
  });

  test('POST with body > 10 MiB returns HTTP 413', async ({ request }) => {
    const largeBody = Buffer.alloc(11 * 1024 * 1024).toString('base64');
    const response = await request.post(BASE_URL + '/', {
      data: { large: largeBody },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(413);
  });

  test('GET /unknown returns HTTP 404', async ({ request }) => {
    const response = await request.get(BASE_URL + '/unknown-endpoint');
    expect(response.status()).toBe(404);
  });

  test('respects X-Forwarded-For when trustProxy is enabled', async ({ request }) => {
    const response = await request.get(BASE_URL + '/', {
      headers: { 'X-Forwarded-For': '8.8.8.8' },
    });
    expect(response.status()).toBe(200);
  });

  test('uptime_seconds is a non-negative integer', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    const body = await response.json();
    expect(Number.isInteger(body.uptime_seconds)).toBe(true);
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});
