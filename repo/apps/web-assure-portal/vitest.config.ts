/**
 * Vitest config -- web-assure-portal unit/integration
 * Reference : task-1.4.6 Sprint 4 Phase 1
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/__tests__/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'playwright-report', 'test-results', '../../e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        '**/*.config.ts',
        '**/*.config.mjs',
        '**/*.d.ts',
        'src/app/**/*.tsx',
        'src/middleware.ts',
        'src/components/**/*.tsx',
        'src/store/**',
        'src/lib/sentry.ts',
        'src/lib/logger.ts',
        'src/messages/**',
        'src/types/**',
        'test/**',
        '\x00*',
      ],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@insurtech/shared-ui': path.resolve(__dirname, '../../packages/shared-ui/src'),
    },
  },
});
