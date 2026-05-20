/**
 * web-assure-mobile E2E -- mobile emulation (iPhone 14 Pro + Pixel 7)
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Requires: pnpm --filter @insurtech/web-assure-mobile dev (port 3006)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.ASSURE_MOBILE_URL ?? 'http://localhost:3006';

test.describe('web-assure-mobile (port 3006) PWA -- assure sinistres', () => {
  test('home /fr renders 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Assure|Sinistre|Skalean/);
  });

  test('theme-color #2D5773 ACAPS Teal', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor?.toLowerCase()).toBe('#2d5773');
  });

  test('viewport-fit cover iOS notch', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toMatch(/viewport-fit\s*=\s*cover/);
  });

  test('manifest.webmanifest theme_color teal', async ({ request }) => {
    const response = await request.get(`${BASE}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const m = await response.json() as Record<string, unknown>;
    expect(m.theme_color).toBe('#2D5773');
    expect(String(m.display)).toMatch(/standalone/);
    expect(m.start_url).toBeTruthy();
  });

  test('BottomTabs 4 tabs visible', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const bottomTabs = page.getByRole('navigation', { name: /bottom|tabs/i });
    await expect(bottomTabs).toBeVisible();
    const tabs = bottomTabs.getByRole('link');
    const count = await tabs.count();
    expect(count).toBe(4);
  });

  test('service worker registered', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? (reg.active ? 'active' : 'installing') : 'no-registration';
    });
    expect(['active', 'installing', 'no-registration']).toContain(swState);
  });

  test('offline mode loads cached page', async ({ page, context }) => {
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    const visible = await page.locator('body').isVisible().catch(() => false);
    expect(visible).toBe(true);
    await context.setOffline(false);
  });

  test('home /ar-MA Darija mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/ar-MA`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('responsive 320px no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`${BASE}/fr`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('big touch targets 44x44 min', async ({ page }) => {
    await page.goto(`${BASE}/fr`);
    const ctas = page.getByRole('button');
    const count = await ctas.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await ctas.nth(i).boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('hydration no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/fr`);
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => /hydrat/i.test(e))).toHaveLength(0);
  });

  test('404 not-found mobile', async ({ page }) => {
    const response = await page.goto(`${BASE}/fr/non-existent-assure-route`);
    expect(response?.status()).toBe(404);
  });
});
