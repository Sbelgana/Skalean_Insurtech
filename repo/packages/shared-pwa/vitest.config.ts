/**
 * Vitest configuration -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.config.ts',
        '**/*.config.mjs',
        'src/sw-template.js',
        'test-setup.ts',
      ],
      thresholds: {
        lines: 70,
        branches: 65,
        functions: 70,
        statements: 70,
      },
    },
  },
});
