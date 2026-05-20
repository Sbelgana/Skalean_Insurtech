/**
 * web-garage E2E -- desktop chromium 1280x720
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-garage dev (port 3002)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.GARAGE_URL ?? 'http://localhost:3002';

test.describe('web-garage (port 3002)', () => {
  test('home /fr renders 200 with title', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Garage|Reparation|Skalean/i);
  });

  test('home /ar renders RTL', async ({ page }) => {
    await page.goto(`${BASE}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('home /ar-MA Darija renders', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('404 not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-99999`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|introuvable/i)).toBeVisible();
  });

  test('hydration no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('breadcrumb navigation visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb|ariane/i });
    await expect(breadcrumb).toBeVisible();
  });

  test('responsive 768px tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('responsive 1280x720 desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });
});
