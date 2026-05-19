import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@insurtech/shared-config': resolve(__dirname, 'packages/shared-config/src'),
      '@insurtech/shared-utils': resolve(__dirname, 'packages/shared-utils/src'),
      '@insurtech/shared-types': resolve(__dirname, 'packages/shared-types/src'),
      '@insurtech/database': resolve(__dirname, 'packages/database/src'),
    },
  },
});
