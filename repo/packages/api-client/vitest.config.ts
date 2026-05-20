import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const STUBS = resolve(PACKAGE_DIR, 'src/__tests__/stubs');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Redirect optional lazy imports to test stubs so Vite can resolve them.
      // The real implementations (shared-ui stores, Sentry) are not available at test time.
      // vi.mock() in specific test files will override these aliases per test.
      '@insurtech/shared-ui/stores/tenant-store': resolve(STUBS, 'tenant-store.ts'),
      '@insurtech/shared-ui/stores/auth-store': resolve(STUBS, 'auth-store.ts'),
      '@insurtech/shared-ui/components/toaster': resolve(STUBS, 'toaster.ts'),
      '@sentry/nextjs': resolve(STUBS, 'sentry.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // NOTE: only 'text' reporter to avoid Windows null-byte crash with html/lcov
      reporter: ['text'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
