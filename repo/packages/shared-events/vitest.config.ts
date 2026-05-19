/**
 * Vitest configuration for shared-events unit tests.
 * Excludes test/integration/** -- those run only via vitest.config.integration.ts.
 * Aucune emoji (decision-006).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: [
      'test/integration/**',
      '**/node_modules/**',
      '**/dist/**',
    ],
    passWithNoTests: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
    },
  },
});
