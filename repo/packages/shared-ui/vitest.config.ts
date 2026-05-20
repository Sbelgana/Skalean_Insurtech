/**
 * Vitest config -- @insurtech/shared-ui
 * Reference : task-1.4.8 Sprint 4 Phase 1
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/lib/**', 'src/hooks/**'],
      exclude: [
        'src/hooks/useTheme.ts',
        'src/hooks/useDirection.ts',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      thresholds: { lines: 70, functions: 60, branches: 60, statements: 70 },
    },
  },
  resolve: {
    alias: {
      '@insurtech/shared-ui': path.resolve(__dirname, './src'),
    },
  },
});
