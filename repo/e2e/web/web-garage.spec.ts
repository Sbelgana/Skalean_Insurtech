/**
 * web-garage E2E tests -- Sprint 4 bootstrap
 * Reference : task-1.4.1 Sprint 4 Phase 1
 *
 * Tests Playwright verifieront le fonctionnement du bootstrap Next.js 15 complet.
 * Ces tests necessitent que le serveur dev soit demarre : pnpm --filter @insurtech/web-garage dev
 */
import { test, expect } from '@playwright/test';

test.describe('web-garage E2E (Sprint 4 bootstrap)', () => {
  test('GET /fr returns 200 with French content', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'garage');
    await expect(page.getByRole('heading', { name: /Skalean Garage/i })).toBeVisible();
  });

  test('GET /ar returns 200 with RTL direction', async ({ page }) => {
    const response = await page.goto('/ar');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('GET /ar-MA renders Darija content', async ({ page }) => {
    await page.goto('/ar-MA');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page).toHaveTitle(/Garage/);
  });

  test('GET / redirects to /fr', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.url()).toMatch(/\/fr\/?$/);
  });

  test('GarageBranding renders wrench icon and wordmark', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.getByText('Skalean Garage')).toBeVisible();
  });

  test('Locale switcher updates URL and content', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: /langue|language/i }).click();
    await page.getByRole('button', { name: /Arabe|العربية/i }).click();
    await expect(page).toHaveURL(/\/ar/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Theme toggle persists across reload', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: /theme/i }).click();
    await page.getByRole('button', { name: /Sombre|Dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('GET /fr/inexistant renders 404', async ({ page }) => {
    const response = await page.goto('/fr/inexistant', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
  });

  test('Hydration runs without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/fr', { waitUntil: 'networkidle' });
    expect(errors).toEqual([]);
  });
});
