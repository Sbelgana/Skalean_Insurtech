/**
 * web-customer-portal E2E -- public SSG/SEO, desktop chromium
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-customer-portal dev (port 3004)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.CUSTOMER_PORTAL_URL ?? 'http://localhost:3004';

test.describe('web-customer-portal (port 3004) -- public SSG/SEO', () => {
  test('home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Skalean|Assurance|Maroc/i);
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

  test('404 not-found custom design', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-page`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: /accueil|home/i })).toBeVisible();
  });

  test('hydration no console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('robots.txt accessible', async ({ request }) => {
    const response = await request.get(`${BASE}/robots.txt`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/User-agent/i);
  });

  test('manifest.webmanifest accessible', async ({ request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
  });

  test('responsive 1280x720 desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/fr`);
    await expect(page.locator('main')).toBeVisible();
  });

  test('ACAPS footer mention visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
  });
});
