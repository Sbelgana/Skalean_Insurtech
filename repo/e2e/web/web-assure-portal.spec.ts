/**
 * web-assure-portal E2E -- self-service assure, desktop chromium
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-assure-portal dev (port 3005)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.ASSURE_PORTAL_URL ?? 'http://localhost:3005';

test.describe('web-assure-portal (port 3005) -- self-service assure', () => {
  test('home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Espace|Assure|Skalean/i);
  });

  test('home /ar-MA Darija renders RTL', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar renders RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('mobile responsive 320px no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalScroll).toBe(false);
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|introuvable/i)).toBeVisible();
  });

  test('hydration no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('responsive 1280x720 desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });
});
