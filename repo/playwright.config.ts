/**
 * Skalean InsurTech v2.2 -- Playwright config racine
 * Reference: B-01 Tache 1.1.11
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',

  fullyParallel: true,
  forbidOnly: process.env['CI'] === 'true',
  retries: process.env['CI'] === 'true' ? 2 : 0,
  workers: process.env['CI'] === 'true' ? 1 : undefined,

  reporter: process.env['CI'] === 'true'
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['html', { open: 'on-failure' }], ['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'api',
      testDir: './e2e/api',
      use: { baseURL },
    },
    {
      name: 'chromium',
      testDir: './e2e/web',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-safari',
      testDir: './e2e/mobile',
      use: { ...devices['iPhone 14 Pro'], hasTouch: true },
    },
  ],

  webServer: process.env['CI'] === 'true' ? undefined : {
    command: 'pnpm dev:api',
    url: 'http://localhost:4000/health',
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },

  expect: {
    timeout: 5000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
});
