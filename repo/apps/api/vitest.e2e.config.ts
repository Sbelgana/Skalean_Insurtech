/**
 * Vitest E2E configuration -- Sprint 8 Task 8.14b Sessions A-D.
 *
 * Separate from vitest.config.ts so :
 *   - `pnpm test` (unit + integration) skips slow E2E tests.
 *   - `pnpm test:e2e:unit` boots the NestJS app via test-app.factory and runs
 *     HTTP-level workflows against a live test stack (postgres 5433,
 *     redis 6380, kafka 9095 per Sprint 7.5b convention).
 *
 * Setup file ordering :
 *   1. e2e-env-setup.ts -- imports reflect-metadata + dotenv + sets env BEFORE
 *      any ESM module evaluation (critical for ConfigModule.forRoot which
 *      validates env at module import).
 *
 * SWC plugin (Sprint 8 Session D root cause fix) :
 *   - Vitest default uses esbuild for TS transform.
 *   - esbuild does NOT emit `design:paramtypes` decorator metadata even with
 *     `experimentalDecorators` + `emitDecoratorMetadata` enabled in tsconfig.
 *   - NestJS DI relies on that metadata to detect constructor parameter
 *     types and inject the right providers. Without it, dependencies arrive
 *     `undefined`.
 *   - `unplugin-swc` + SWC's `legacyDecorator` + `decoratorMetadata` options
 *     emit the metadata properly, mirroring what `tsc` produces for
 *     production runtime.
 *   - Reference : https://docs.nestjs.com/recipes/swc#vitest
 */
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    passWithNoTests: true,
    environment: 'node',
    globals: false,
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['e2e/**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['e2e/setup/e2e-env-setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Force @insurtech/* workspace packages to be loaded as their compiled
    // dist/ JS (per package.json main/exports) rather than transformed source
    // TS via SWC. Otherwise TypeORM sees two copies of each Entity class
    // (one from dist/, one from transformed src/), causing
    // EntityMetadataNotFoundError on getRepository(EntityClass).
    server: {
      deps: {
        external: [/@insurtech\//],
      },
    },
  },
});
