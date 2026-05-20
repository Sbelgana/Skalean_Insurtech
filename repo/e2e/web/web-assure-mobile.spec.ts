/**
 * web-assure-mobile E2E tests -- Sprint 4 bootstrap
 * Reference : task-1.4.7 Sprint 4 Phase 1
 */
import { test, expect } from '@playwright/test';

test.describe('web-assure-mobile E2E (Sprint 4 bootstrap)', () => {
  test('GET /fr returns 200 with French content', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'assure-mobile');
    await expect(page.getByRole('heading', { name: /Skalean Assure/i })).toBeVisible();
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
    await expect(page).toHaveTitle(/Assure/);
  });

  test('GET / redirects to /fr', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.url()).toMatch(/\/fr\/?$/);
  });

  test('Mobile bottom navigation is visible', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.getByRole('navigation', { name: /Navigation mobile assure/i })).toBeVisible();
    await expect(page.getByText('Sinistres')).toBeVisible();
    await expect(page.getByText('Polices')).toBeVisible();
    await expect(page.getByText('Garage')).toBeVisible();
  });

  test('Mobile grid shows assure actions', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.getByText('Declarer un sinistre')).toBeVisible();
    await expect(page.getByText('Mes assurances')).toBeVisible();
    await expect(page.getByText('Localiser un garage')).toBeVisible();
    await expect(page.getByText('Photos accident')).toBeVisible();
  });

  test('manifest.webmanifest is served', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const manifest = await response.json() as Record<string, unknown>;
    expect(manifest['theme_color']).toBe('#2D5773');
    expect(manifest['background_color']).toBe('#1A2730');
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
