/**
 * Test DataSource for RLS integration tests.
 *
 * Connects to skalean-postgres-test (port 5433) with skalean user.
 * Pause Technique #4 -- post-Sprint 6 live validation.
 *
 * Pre-requis :
 *   - docker compose -p skalean-insurtech-test up -d (postgres on 5433)
 *   - pnpm --filter @insurtech/database migration:run
 *
 * Reference : Sprint 6 / Pause #4.
 */

import 'reflect-metadata';
import {
  AuthSession,
  AuthTenant,
  AuthTenantUser,
  AuthUser,
  CrossTenantAuthorization,
  type DataSource,
  TypeOrmDataSource,
} from '@insurtech/database';

const url = `postgresql://${process.env['TEST_DB_USER'] ?? 'skalean'}:${process.env['TEST_DB_PASSWORD'] ?? 'skalean_test'}@${process.env['TEST_DB_HOST'] ?? 'localhost'}:${process.env['TEST_DB_PORT'] ?? '5433'}/${process.env['TEST_DB_NAME'] ?? 'skalean_insurtech_test'}`;

export function createTestDataSource(): DataSource {
  return new TypeOrmDataSource({
    type: 'postgres',
    url,
    synchronize: false,
    logging: process.env['DATABASE_LOG_QUERIES'] === 'true',
    entities: [AuthTenant, AuthUser, AuthTenantUser, AuthSession, CrossTenantAuthorization],
    migrationsRun: false,
  });
}
