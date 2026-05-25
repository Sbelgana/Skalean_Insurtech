/**
 * Vitest E2E configuration -- Sprint 8 Task 8.14b Sessions A-E.
 *
 * Separate from vitest.config.ts so :
 *   - `pnpm test` (unit + integration) skips slow E2E tests.
 *   - `pnpm test:e2e:unit` boots the NestJS app via test-app.factory and runs
 *     HTTP-level workflows against a live test stack (postgres 5433,
 *     redis 6380, kafka 9095 per Sprint 7.5b convention).
 *
 * Setup file ordering :
 *   1. e2e-env-setup.ts -- imports reflect-metadata + dotenv + sets env BEFORE
 *      any ESM module evaluation.
 *
 * SWC plugin (Session D root cause fix) :
 *   - Vitest default uses esbuild for TS transform which does NOT emit
 *     `design:paramtypes` decorator metadata. NestJS DI then receives all
 *     constructor params as undefined.
 *   - `unplugin-swc` with `legacyDecorator` + `decoratorMetadata` emits the
 *     metadata properly, mirroring `tsc` production behavior.
 *   - Reference : https://docs.nestjs.com/recipes/swc#vitest
 *
 * resolve.alias dist/ (Session E root cause fix) :
 *   - With SWC enabled, vitest still tries to transform @insurtech/* source
 *     TS files via the workspace symlink (pnpm node_modules). TypeORM then
 *     loads each Entity class TWICE -- once from dist/ via package.json main,
 *     once from src/ via the transformed pipeline. `getRepository(Class)`
 *     fails with EntityMetadataNotFound because class identity differs.
 *   - Hard-aliasing each @insurtech/<name> -> packages/<name>/dist/index.js
 *     forces ONE load path. Pre-requisite : `pnpm -r build` must have
 *     produced dist/index.js for each package.
 */
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const PACKAGES_ROOT = resolve(__dirname, '../../packages');
const aliasInsurtech = (name: string) =>
  resolve(PACKAGES_ROOT, name, 'dist', 'index.js');

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
  resolve: {
    alias: [
      { find: '@insurtech/database', replacement: aliasInsurtech('database') },
      { find: '@insurtech/auth', replacement: aliasInsurtech('auth') },
      { find: '@insurtech/booking', replacement: aliasInsurtech('booking') },
      { find: '@insurtech/crm', replacement: aliasInsurtech('crm') },
      { find: '@insurtech/comm', replacement: aliasInsurtech('comm') },
      { find: '@insurtech/expertise', replacement: aliasInsurtech('expertise') },
      { find: '@insurtech/tow', replacement: aliasInsurtech('tow') },
      { find: '@insurtech/shared-config', replacement: aliasInsurtech('shared-config') },
    ],
  },
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
  },
});
