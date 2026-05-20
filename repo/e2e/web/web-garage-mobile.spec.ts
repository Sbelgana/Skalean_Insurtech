/**
 * web-garage-mobile E2E tests -- Sprint 4 bootstrap
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Tests Playwright verifieront le fonctionnement du bootstrap Next.js 15 + PWA complet.
 * Ces tests necessitent que le serveur dev soit demarre : pnpm --filter @insurtech/web-garage-mobile dev
 */
import { test, expect } from '@playwright/test';

test.describe('web-garage-mobile E2E (Sprint 4 bootstrap)', () => {
  test('GET /fr returns 200 with French content', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'garage-mobile');
    await expect(page.getByRole('heading', { name: /Skalean Garage Mobile/i })).toBeVisible();
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

  test('manifest.webmanifest is served', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);
    const json = (await response?.json()) as Record<string, unknown>;
    expect(json.name).toBe('Skalean Garage Mobile');
    expect(json.display).toBe('standalone');
  });

  test('mobile dashboard shows task tiles', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.getByText('Tache du jour')).toBeVisible();
    await expect(page.getByText('Scanner VIN')).toBeVisible();
    await expect(page.getByText('Photo reparation')).toBeVisible();
  });

  test('Hydration runs without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/fr', { waitUntil: 'networkidle' });
    expect(errors).toEqual([]);
  });

  test('GET /fr/inexistant renders 404', async ({ page }) => {
    const response = await page.goto('/fr/inexistant', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
  });
});
