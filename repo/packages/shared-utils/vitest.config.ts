/**
 * Vitest configuration for shared-utils unit tests.
 * Sets SKIP_INTEGRATION=true so Redis/S3 describe.skipIf blocks are
 * skipped during the regular "pnpm test" run.
 * Aucune emoji (decision-006).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      SKIP_INTEGRATION: 'true',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
    },
  },
});
