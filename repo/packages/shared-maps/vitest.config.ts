/**
 * Vitest configuration -- shared-maps
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/styles/**', 'src/index.ts', '**/*.spec.ts', '**/*.spec.tsx'],
    },
  },
});
