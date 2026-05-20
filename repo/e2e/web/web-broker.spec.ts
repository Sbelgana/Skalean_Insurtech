/**
 * web-broker E2E -- desktop chromium 1280x720
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-broker dev (port 3001)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BROKER_URL ?? 'http://localhost:3001';

test.describe('web-broker (port 3001)', () => {
  test('home /fr renders 200 with title', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Broker|Courtage|Skalean/i);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('home /ar renders RTL', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA renders Darija content', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-MA');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('404 not-found triggered on unknown route', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-page-12345`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|introuvable|not found/i)).toBeVisible();
  });

  test('hydration no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('breadcrumb navigation visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb|ariane/i });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText(/accueil|home/i)).toBeVisible();
  });

  test('responsive 1280x720 desktop main visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('responsive 768px tablet main visible', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });
});
