/**
 * web-assure-mobile E2E -- desktop chromium (smoke)
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Mobile-emulated tests are in e2e/mobile/web-assure-mobile.spec.ts.
 * These smoke tests validate the app loads in a desktop browser context.
 *
 * Requires: pnpm --filter @insurtech/web-assure-mobile dev (port 3006)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.ASSURE_MOBILE_URL ?? 'http://localhost:3006';

test.describe('web-assure-mobile (port 3006) -- desktop smoke', () => {
  test('home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Assure|Sinistre|Skalean/i);
  });

  test('home /ar renders RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA Darija renders RTL', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('manifest.webmanifest accessible', async ({ request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const m = await response.json() as Record<string, unknown>;
    expect(m.theme_color).toBe('#2D5773');
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-assure`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|introuvable/i)).toBeVisible();
  });

  test('hydration no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });
});
