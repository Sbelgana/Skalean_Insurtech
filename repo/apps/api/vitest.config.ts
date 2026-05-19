/**
 * Vitest configuration pour apps/api.
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'node',
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
    },
  },
});
