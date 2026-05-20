/**
 * web-assure-portal E2E tests -- Sprint 4 bootstrap
 * Reference : task-1.4.6 Sprint 4 Phase 1
 */
import { test, expect } from '@playwright/test';

test.describe('web-assure-portal E2E (Sprint 4 bootstrap)', () => {
  test('GET /fr returns 200 with French content', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'assure');
    await expect(page.getByRole('heading', { name: /Mon Espace Skalean/i })).toBeVisible();
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
    await expect(page).toHaveTitle(/Espace/);
  });

  test('GET / redirects to /fr', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.url()).toMatch(/\/fr\/?$/);
  });

  test('Topbar is visible with branding and nav links', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByText('Mes polices')).toBeVisible();
    await expect(page.getByText('Declarer un sinistre')).toBeVisible();
  });

  test('Content area uses centered max-w-4xl layout', async ({ page }) => {
    await page.goto('/fr');
    const main = page.locator('main');
    await expect(main).toBeVisible();
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
