/**
 * Skalean InsurTech v2.2 -- Vitest config racine
 * Reference: B-01 Tache 1.1.11
 */
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(import.meta.dirname, 'test/setup.ts')],

    // Test matching
    include: ['**/*.{spec,test}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/e2e/**',
      '**/test/integration/**',
      '**/src/test/integration/**',
    ],

    // Pool : forks isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // Coverage v8
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '.turbo/**',
        '.next/**',
        '**/*.config.{ts,mjs}',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        'e2e/**',
        '**/index.ts',
        '**/types.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },

    // CI specific
    forbidOnly: process.env['CI'] === 'true',
    retry: process.env['CI'] === 'true' ? 2 : 0,
    bail: 0,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporters
    reporters: process.env['CI'] === 'true' ? ['default', 'github-actions'] : ['default'],

    // Logging
    silent: false,
    logHeapUsage: false,
  },
});
