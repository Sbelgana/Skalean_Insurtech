/**
 * web-insurtech-admin E2E -- desktop chromium 1280x720
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-insurtech-admin dev (port 3000)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.ADMIN_URL ?? 'http://localhost:3000';

test.describe('web-insurtech-admin (port 3000)', () => {
  test('home /fr renders 200 with title', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Admin|SuperAdmin|Skalean/i);
  });

  test('home /ar renders RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA Darija', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-admin-route`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|introuvable/i)).toBeVisible();
  });

  test('hydration no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('breadcrumb navigation visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await expect(page.getByRole('navigation', { name: /breadcrumb|ariane/i })).toBeVisible();
  });

  test('responsive 1280x720 desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });
});
