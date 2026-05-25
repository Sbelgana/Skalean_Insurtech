/**
 * TestApp factory -- Sprint 8 Task 8.14b Phase 2.
 *
 * Boots a real NestJS app via FastifyAdapter for in-process E2E tests.
 * Reusable across Sprints 9-35 for all booking/CRM/insure/etc. workflows.
 *
 * Strategy :
 *   - Test.createTestingModule({ imports: [AppModule] }) mounts the full
 *     production module graph (19 modules : Auth + CRM + Booking + ...).
 *   - FastifyAdapter is used (matches main.ts) so plugin-specific behavior
 *     (header parsing, RouteGuards, ResponseInterceptor wrapping) is exercised.
 *   - DATA_SOURCE_TOKEN is overridden with testDataSource (explicit entity
 *     class imports via vitest's module resolver -- fixes TypeORM
 *     EntityMetadataNotFoundError caused by glob vs vitest dual module
 *     loading). Sprint 8 Task 8.14b Session E.
 *   - Test DB connection comes from DATABASE_URL pointing to the 5433
 *     test stack ; migrations run separately via `pnpm db:reset` (Sprint 7.5b).
 *
 * Usage :
 *
 *   import { createTestApp, closeTestApp } from './setup/test-app.factory.js';
 *
 *   describe('My E2E', () => {
 *     let ctx: TestAppContext;
 *     beforeAll(async () => { ctx = await createTestApp(); });
 *     afterAll(async () => { await closeTestApp(ctx); });
 *
 *     it('GET /health/live', async () => {
 *       const res = await ctx.app.inject({ method: 'GET', url: '/health/live' });
 *       expect(res.statusCode).toBe(200);
 *     });
 *   });
 */

import { type INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import type { DataSource } from '@insurtech/database';
import { AllExceptionsFilter } from '../../src/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '../../src/interceptors/response.interceptor.js';
import { ZodValidationPipe } from '../../src/pipes/zod-validation.pipe.js';
import { AppModule } from '../../src/app.module.js';
import { DATA_SOURCE_TOKEN } from '../../src/database/data-source.provider.js';
import {
  initTestDataSource,
  closeTestDataSource,
  testDataSource,
} from './test-data-source.js';

export interface TestAppContext {
  readonly app: NestFastifyApplication;
  readonly dataSource: DataSource;
  readonly moduleRef: TestingModule;
}

export interface CreateTestAppOptions {
  /** Skip global filters/interceptors/pipes setup (default false). */
  readonly skipGlobals?: boolean;
}

/**
 * Creates a booted NestJS app with the AppModule graph. The returned context
 * exposes `app` (FastifyAdapter) for HTTP requests (via inject() or supertest)
 * and `dataSource` for direct DB access (seeding, assertions).
 */
export async function createTestApp(
  opts: CreateTestAppOptions = {},
): Promise<TestAppContext> {
  // Initialize the test DataSource (explicit entity class imports via vitest
  // module resolver) BEFORE compiling AppModule. This ensures the singleton
  // DataSource is ready when the DATA_SOURCE_TOKEN provider factory runs.
  await initTestDataSource();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Override DATA_SOURCE_TOKEN to use testDataSource (explicit entities,
    // single module-load path). Fixes EntityMetadataNotFoundError in vitest E2E.
    // Sprint 8 Task 8.14b Session E.
    .overrideProvider(DATA_SOURCE_TOKEN)
    .useValue(testDataSource)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
    { bufferLogs: false },
  );

  if (!opts.skipGlobals) {
    // Mirror main.ts global registrations so route guards, validation pipes,
    // response wrapping, and exception filtering behave the same way during
    // E2E as in production.
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
  }

  await app.init();
  // Fastify must be ready before app.inject() processes requests.
  await app.getHttpAdapter().getInstance().ready();

  const dataSource = moduleRef.get<DataSource>(DATA_SOURCE_TOKEN);

  return { app, dataSource, moduleRef };
}

/**
 * Closes the test app gracefully. Closes Nest application (which also closes
 * the DataSource through its provider's lifecycle).
 */
export async function closeTestApp(ctx: TestAppContext): Promise<void> {
  await ctx.app.close();
  // Close the test DataSource separately (it outlives the NestJS app lifecycle
  // since it's injected as a value, not managed by the NestJS DI lifecycle).
  await closeTestDataSource();
}

/** Re-export for convenience. */
export type { INestApplication, NestFastifyApplication };
