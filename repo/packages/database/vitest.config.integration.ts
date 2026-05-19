/**
 * Vitest configuration for integration tests.
 * Uses real Postgres, Kafka, Redis containers.
 * Aucune emoji (decision-006).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.spec.ts', 'src/test/integration/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-each.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    sequence: { concurrent: false, shuffle: false },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    retry: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/migrations/**', 'src/test/**'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
    env: {
      NODE_ENV: 'test',
      OTEL_TRACES_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
      OTEL_METRICS_EXPORTER: 'none',
      SKIP_INTEGRATION: 'false',
    },
  },
});
