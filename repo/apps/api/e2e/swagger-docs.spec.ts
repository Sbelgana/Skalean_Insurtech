/**
 * Tests E2E Swagger UI -- necessitent un serveur en cours d'execution.
 *
 * Lancer le serveur : pnpm --filter @insurtech/api dev
 * Lancer les tests : pnpm --filter @insurtech/api test:e2e -g swagger
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env['TEST_API_URL'] ?? 'http://localhost:14000';

test.describe('Swagger UI E2E (Sprint 3 Tache 1.3.9)', () => {
  test('GET /docs retourne HTML Swagger UI', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs/`);
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toContain('swagger-ui');
  });

  test('GET /docs-json retourne JSON OpenAPI valide', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs-json`);
    expect(r.status()).toBe(200);
    const body = (await r.json()) as { openapi?: string };
    expect(body.openapi).toMatch(/^3\./);
  });

  test('OpenAPI doc info.title contient Skalean', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs-json`);
    const body = (await r.json()) as { info?: { title?: string } };
    expect(body.info?.title).toContain('Skalean');
  });

  test('OpenAPI doc 20+ tags', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs-json`);
    const body = (await r.json()) as { tags?: unknown[] };
    expect(body.tags?.length).toBeGreaterThanOrEqual(20);
  });

  test('OpenAPI doc 3 servers (dev / staging / prod)', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs-json`);
    const body = (await r.json()) as { servers?: unknown[] };
    expect(body.servers?.length).toBe(3);
  });

  test('OpenAPI doc securitySchemes JWT + apiKey', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs-json`);
    const body = (await r.json()) as {
      components?: { securitySchemes?: Record<string, unknown> };
    };
    expect(body.components?.securitySchemes?.['JWT']).toBeDefined();
    expect(body.components?.securitySchemes?.['apiKey']).toBeDefined();
  });

  test('CSP relaxe sur /docs (ui fonctionnel)', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs/`);
    const csp = r.headers()['content-security-policy'];
    if (csp) {
      expect(csp).toContain('unsafe-inline');
    }
  });

  test('Cache-Control no-cache sur /docs-json', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs-json`);
    const cc = r.headers()['cache-control'];
    expect(cc).toMatch(/no-cache|no-store/);
  });

  test('Theme Skalean applique (customCss skalean-primary)', async ({ request }) => {
    const r = await request.get(`${BASE_URL}/docs/`);
    const body = await r.text();
    expect(body).toContain('skalean-primary');
  });
});
