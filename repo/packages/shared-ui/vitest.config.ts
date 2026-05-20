/**
 * Vitest config -- @insurtech/shared-ui
 * Reference : task-1.4.8 + task-1.4.11 Sprint 4 Phase 1
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['src/components/__tests__/**', 'jsdom'],
      ['src/layouts/__tests__/**', 'jsdom'],
      ['src/hooks/__tests__/**', 'jsdom'],
    ],
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/lib/**',
        'src/hooks/**',
        'src/i18n/**',
        'src/components/**',
        'src/layouts/**',
      ],
      exclude: [
        'src/hooks/useTheme.ts',
        'src/hooks/useDirection.ts',
        '**/*.config.*',
        '**/*.d.ts',
        'src/components/ui/**',
      ],
      thresholds: { lines: 60, functions: 55, branches: 55, statements: 60 },
    },
  },
  resolve: {
    alias: {
      '@insurtech/shared-ui': path.resolve(__dirname, './src'),
    },
  },
});
