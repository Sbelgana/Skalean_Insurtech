/**
 * Playwright config -- Skalean InsurTech v2.2
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * 3 projects :
 *   - chromium  : desktop 1280x720, specs e2e/web/
 *   - mobile-safari : iPhone 14 Pro, specs e2e/mobile/
 *   - mobile-chrome : Pixel 7, specs e2e/mobile/
 *
 * Usage :
 *   pnpm test:e2e                           # headless full suite
 *   pnpm test:e2e:ui                        # mode UI interactif
 *   pnpm exec playwright test e2e/web/web-broker.spec.ts
 */
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : '50%',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ...(isCI ? ([['github']] as [string, object?][]) : []),
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,ar;q=0.8',
    },
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      testMatch: /e2e\/web\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        baseURL: process.env.BROKER_URL ?? 'http://localhost:3001',
        launchOptions: {
          args: [
            '--enable-features=ServiceWorker',
            '--no-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
    {
      name: 'mobile-safari',
      testMatch: /e2e\/mobile\/.*\.spec\.ts/,
      use: {
        ...devices['iPhone 14 Pro'],
        baseURL: process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003',
      },
    },
    {
      name: 'mobile-chrome',
      testMatch: /e2e\/mobile\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env.GARAGE_MOBILE_URL ?? 'http://localhost:3003',
        launchOptions: {
          args: ['--enable-features=ServiceWorker', '--no-sandbox'],
        },
      },
    },
  ],

  webServer: isCI
    ? undefined
    : [
        {
          command: 'pnpm dev:portals',
          url: 'http://localhost:3001/fr',
          timeout: 120_000,
          reuseExistingServer: true,
          stdout: 'ignore',
          stderr: 'pipe',
        },
        {
          command: 'pnpm dev:dashboards',
          url: 'http://localhost:3000/fr',
          timeout: 120_000,
          reuseExistingServer: true,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      ],

  outputDir: 'test-results',
});
