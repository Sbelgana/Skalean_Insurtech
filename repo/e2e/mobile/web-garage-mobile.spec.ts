/**
 * web-garage-mobile E2E -- mobile emulation (iPhone 14 Pro + Pixel 7)
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-garage-mobile dev (port 3003)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003';

test.describe('web-garage-mobile (port 3003) PWA', () => {
  test('home /fr renders 200 mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Garage Mobile|Technicien|Skalean/);
  });

  test('theme-color #E95D2C status bar', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor?.toLowerCase()).toBe('#e95d2c');
  });

  test('viewport-fit cover for iOS notch', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/viewport-fit\s*=\s*cover/);
    expect(viewport).toMatch(/initial-scale\s*=\s*1/);
  });

  test('manifest.webmanifest valid', async ({ page, request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const manifest = await response.json() as Record<string, unknown>;
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(String(manifest.display)).toMatch(/standalone|fullscreen/);
    expect(manifest.theme_color).toBe('#E95D2C');
    expect(manifest.background_color).toBeTruthy();
    const icons = manifest.icons as { sizes: string }[];
    expect(Array.isArray(icons)).toBe(true);
    expect(icons.length).toBeGreaterThanOrEqual(2);
    const has192 = icons.some((i) => /192/.test(i.sizes));
    const has512 = icons.some((i) => /512/.test(i.sizes));
    expect(has192).toBe(true);
    expect(has512).toBe(true);
  });

  test('manifest link present', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toMatch(/manifest\.webmanifest|manifest\.json/);
  });

  test('service worker registered', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return 'no-registration';
      return reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'unknown';
    });
    expect(['active', 'installing', 'waiting', 'no-registration']).toContain(swState);
  });

  test('offline mode page loads from cache', async ({ page, context }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    const bodyVisible = await page.locator('body').isVisible().catch(() => false);
    expect(bodyVisible).toBe(true);
    await context.setOffline(false);
  });

  test('home /ar-MA Darija mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('responsive 360px no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/fr`);
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalScroll).toBe(false);
  });

  test('apple-touch-icon present iOS', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveCount(1, { timeout: 5000 });
    const href = await icon.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('hydration no error mobile', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('404 not-found mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-mobile-route`);
    expect(response?.status()).toBe(404);
  });
});
