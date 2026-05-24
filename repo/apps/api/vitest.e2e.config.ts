/**
 * Vitest E2E configuration -- Sprint 8 Task 8.14b Phase 2.
 *
 * Separate from vitest.config.ts so :
 *   - `pnpm test` (unit + integration) skips slow E2E tests.
 *   - `pnpm test:e2e` boots the NestJS app via test-app.factory and runs
 *     HTTP-level workflows against a live test stack (postgres 5433,
 *     redis 6380, kafka 9095 per Sprint 7.5b convention).
 *
 * Setup file ordering :
 *   1. e2e-env-setup.ts -- imports dotenv + sets test stack overrides BEFORE
 *      any ESM module evaluation (critical for ConfigModule.forRoot which
 *      validates env at module import).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'node',
    globals: false,
    // E2E suites need longer hooks (app bootstrap + DB connection).
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['e2e/**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['e2e/setup/e2e-env-setup.ts'],
    // Single fork ensures the AppModule (which uses singletons like
    // AppDataSource) is shared. Multiple forks would each try to re-init
    // the singleton against the same DB connection pool.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
