/**
 * Test-specific DataSource for E2E tests -- Sprint 8 Task 8.14b Session E.
 *
 * ROOT CAUSE RESOLVED :
 *   The production AppDataSource uses glob-based entity loading :
 *     entities: [resolve(__dirname, 'entities/**\/*.{ts,js}')]
 *   In vitest E2E, glob loading uses Node.js native require() while
 *   service imports go through vitest's module resolver. This creates
 *   TWO different class objects for the same entity, causing TypeORM's
 *   class-identity check to fail with EntityMetadataNotFoundError.
 *
 * FIX : explicit entity class imports.
 *   This file imports entity arrays from '@insurtech/database' through
 *   vitest's module resolver (same path as services). TypeORM sees
 *   consistent class identities -> no EntityMetadataNotFoundError.
 *
 * Used by test-app.factory.ts to override DATA_SOURCE_TOKEN.
 */

// TypeOrmDataSource is DataSource re-exported from typeorm via @insurtech/database.
// Importing directly from typeorm would fail vite's bundler (CJS module).
import {
  TypeOrmDataSource as DataSource,
  systemEntities,
  crmEntities,
  bookingEntities,
  commEntities,
  docsEntities,
  payEntities,
  booksEntities,
  complianceEntities,
  analyticsEntities,
  stockEntities,
  hrEntities,
  insureEntities,
} from '@insurtech/database';

const allEntities = [
  ...systemEntities,
  ...crmEntities,
  ...bookingEntities,
  ...commEntities,
  ...docsEntities,
  ...payEntities,
  ...booksEntities,
  ...complianceEntities,
  ...analyticsEntities,
  ...stockEntities,
  ...hrEntities,
  ...insureEntities,
];

/**
 * Test DataSource with explicit entity class imports.
 * Uses same DB URL as test stack (overridden in e2e-env-setup.ts).
 * Schema already migrated via `pnpm db:reset` -- synchronize: false.
 */
export const testDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: allEntities as unknown as Function[],
  // No migrations -- the test DB is already migrated via pnpm db:reset.
});

let initPromise: Promise<DataSource> | null = null;

export async function initTestDataSource(): Promise<DataSource> {
  if (testDataSource.isInitialized) return testDataSource;
  if (initPromise) return initPromise;

  initPromise = testDataSource.initialize().catch((err: unknown) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

export async function closeTestDataSource(): Promise<void> {
  if (testDataSource.isInitialized) {
    await testDataSource.destroy();
  }
  initPromise = null;
}
