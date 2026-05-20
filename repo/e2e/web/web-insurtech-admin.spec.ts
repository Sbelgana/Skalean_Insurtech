/**
 * web-insurtech-admin E2E tests -- Sprint 4 bootstrap
 * Reference : task-1.4.4 Sprint 4 Phase 1
 */
import { test, expect } from '@playwright/test';

test.describe('web-insurtech-admin E2E (Sprint 4 bootstrap)', () => {
  test('GET /fr returns 200 with French content', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'admin');
    await expect(page.getByRole('heading', { name: /Skalean Admin/i })).toBeVisible();
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
    await expect(page).toHaveTitle(/Admin/);
  });

  test('GET / redirects to /fr', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.url()).toMatch(/\/fr\/?$/);
  });

  test('Admin sidebar is visible with nav items', async ({ page }) => {
    await page.goto('/fr');
    await expect(page.getByRole('navigation', { name: /Navigation admin/i })).toBeVisible();
    await expect(page.getByText('Tableau de bord')).toBeVisible();
    await expect(page.getByText('Tenants')).toBeVisible();
    await expect(page.getByText('Monitoring')).toBeVisible();
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
