/**
 * Vitest config -- web-garage unit/integration
 * Reference : task-1.4.1 Sprint 4 Phase 1
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
    include: ['src/**/__tests__/**/*.spec.ts', 'src/**/__tests__/**/*.spec.tsx', 'src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'playwright-report', 'test-results', '../../e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        // Config files
        '**/*.config.ts',
        '**/*.config.mjs',
        '**/*.d.ts',
        // Source files non testables en jsdom (Next.js RSC, middleware, config)
        'src/app/**/*.tsx',        // RSC layout, page, icon -- necessitent next/server
        'src/middleware.ts',       // Next.js middleware
        'src/components/**/*.tsx', // React client components (tested via E2E)
        // Stubs bootstrap sans tests unitaires (tests Sprint 5+)
        'src/store/**',            // Zustand stores (Sprint 5 ajoutera tests)
        'src/lib/sentry.ts',       // Sentry browser init (Sprint 5 ajoutera tests)
        'src/lib/logger.ts',       // Pino browser facade (difficult a unit-tester)
        // Messages + types + fixtures
        'src/messages/**',
        'src/types/**',
        'test/**',
        // Vite virtual modules (null-byte paths Windows)
        '\x00*',
      ],
      thresholds: {
        lines: 70,
        functions: 60,   // Sprint 4 bootstrap : callbacks QueryCache/MutationCache non testables en jsdom
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
