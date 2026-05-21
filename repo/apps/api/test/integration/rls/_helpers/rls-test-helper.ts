/**
 * RLS test helpers -- pattern SET ROLE skalean_app + SET LOCAL Postgres.
 *
 * Discipline critique (decouverte Pause Technique #1) :
 *   Les tests RLS DOIVENT tourner sous role applicatif skalean_app (NOT SUPERUSER,
 *   NOT BYPASSRLS). Le user 'test' / 'skalean' par defaut Docker Postgres est
 *   SUPERUSER + BYPASSRLS -- les policies sont INACTIVES sous ces roles.
 *
 * Pattern obligatoire :
 *   BEGIN;
 *   SET ROLE skalean_app;
 *   SET LOCAL app.current_tenant_id = '<uuid>';
 *   SET LOCAL app.current_user_id = '<uuid>';
 *   -- queries ici sont filtrees par RLS policies
 *   RESET ROLE;
 *   ROLLBACK;  (ou COMMIT pour fixture persistante)
 *
 * Pause Technique #4 :
 *   1. pnpm migration:run sur skalean-postgres-test (cree les tables + RLS)
 *   2. Verifier role skalean_app cree par 004-init-roles-grants.sql
 *   3. Enabler describe.skip / it.skip dans les 12 specs RLS
 *   4. Run pnpm vitest test/integration/rls/
 *
 * Reference : Sprint 6 / Tache 2.2.12 + decouverte Pause #1 BYPASSRLS.
 */

import type { DataSource, EntityManager } from '@insurtech/database';

/** Structural type pour QueryRunner (eviter dependance typeorm directe). */
interface QueryRunnerLike {
  connect(): Promise<void>;
  release(): Promise<void>;
  startTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
  manager: EntityManager;
}

export interface RlsTenantContext {
  tenantId?: string;
  userId?: string;
  assureUserId?: string;
  isSuperAdmin?: boolean;
  crossTenantAuthorizationId?: string;
}

/**
 * Execute fn dans un contexte RLS tenant standard.
 * Pattern : BEGIN; SET ROLE skalean_app; SET LOCAL ...; fn(em); ROLLBACK;
 *
 * RESET ROLE applique automatiquement au ROLLBACK (transaction-scoped).
 */
export async function withRlsTenantContext<T>(
  dataSource: DataSource,
  ctx: RlsTenantContext,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner() as unknown as QueryRunnerLike;
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query("SET ROLE insurtech_app");

    if (ctx.tenantId) {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [ctx.tenantId],
      );
    }
    if (ctx.isSuperAdmin) {
      await queryRunner.query(
        `SELECT set_config('app.is_super_admin', 'true', true)`,
      );
    }
    if (ctx.userId) {
      await queryRunner.query(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [ctx.userId],
      );
    }
    if (ctx.assureUserId) {
      await queryRunner.query(
        `SELECT set_config('app.assure_user_id', $1, true)`,
        [ctx.assureUserId],
      );
    }
    if (ctx.crossTenantAuthorizationId) {
      await queryRunner.query(
        `SELECT set_config('app.cross_tenant_authorization_id', $1, true)`,
        [ctx.crossTenantAuthorizationId],
      );
    }

    const result = await fn(queryRunner.manager);
    await queryRunner.rollbackTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction().catch(() => undefined);
    throw err;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Comme withRlsTenantContext mais COMMIT (persiste les changements).
 * Pour fixtures INSERT/UPDATE/DELETE qui doivent etre visibles aux tests suivants.
 */
export async function withRlsTenantContextCommit<T>(
  dataSource: DataSource,
  ctx: RlsTenantContext,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner() as unknown as QueryRunnerLike;
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query("SET ROLE insurtech_app");

    if (ctx.tenantId) {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [ctx.tenantId],
      );
    }
    if (ctx.isSuperAdmin) {
      await queryRunner.query(
        `SELECT set_config('app.is_super_admin', 'true', true)`,
      );
    }
    if (ctx.userId) {
      await queryRunner.query(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [ctx.userId],
      );
    }
    if (ctx.assureUserId) {
      await queryRunner.query(
        `SELECT set_config('app.assure_user_id', $1, true)`,
        [ctx.assureUserId],
      );
    }

    const result = await fn(queryRunner.manager);
    await queryRunner.commitTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction().catch(() => undefined);
    throw err;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Super admin context (bypass via app.is_super_admin = true).
 *
 * Sprint 1 helper Postgres app_can_access_tenant() Cond 1 :
 *   IF app_is_super_admin() THEN RETURN TRUE -- bypass automatique.
 */
export async function withRlsSuperAdminContext<T>(
  dataSource: DataSource,
  fn: (em: EntityManager) => Promise<T>,
  userId = 'super-admin-test',
): Promise<T> {
  return withRlsTenantContext(
    dataSource,
    { isSuperAdmin: true, userId },
    fn,
  );
}

/**
 * Insertion fixture bypass RLS via app.is_super_admin=true.
 *
 * DECOUVERTE Pause #4 :
 *   Tables tenant-scoped (auth_users, auth_tenant_users, crm_*, etc.) ont
 *   FORCE ROW LEVEL SECURITY = true (Sprint 2 migrations). Meme superuser
 *   `skalean` ne bypass PAS. Faut set app.is_super_admin=true pour que
 *   helper Sprint 1 app_can_access_tenant() Cond 1 applique.
 *
 * Commit (pas rollback) -- pour fixture setup persistante.
 */
export async function withRlsBypass<T>(
  dataSource: DataSource,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner() as unknown as QueryRunnerLike;
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    const result = await fn(queryRunner.manager);
    await queryRunner.commitTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction().catch(() => undefined);
    throw err;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Assert que la query SELECT retourne 0 lignes (RLS isolation OK).
 */
export async function assertEmptyResult(
  em: EntityManager,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  const rows = (await em.query(sql, params)) as unknown[];
  if (rows.length !== 0) {
    throw new Error(
      `RLS isolation FAIL : expected 0 rows, got ${rows.length}. Query: ${sql}`,
    );
  }
}

/**
 * Assert que la query SELECT retourne exactement `expected` lignes.
 */
export async function assertCount(
  em: EntityManager,
  sql: string,
  expected: number,
  params: unknown[] = [],
): Promise<void> {
  const rows = (await em.query(sql, params)) as unknown[];
  if (rows.length !== expected) {
    throw new Error(
      `RLS assertCount FAIL : expected ${expected} rows, got ${rows.length}. Query: ${sql}`,
    );
  }
}

/**
 * Generate UUID v4 pour fixtures (pas crypto-secure, juste test fixtures).
 */
export function testUuid(seed: number): string {
  const hex = seed.toString(16).padStart(8, '0');
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-8${hex.slice(0, 3)}-${hex}${hex.slice(0, 4)}`;
}

/** Fixtures statiques pour tests RLS. */
export const RLS_TEST_FIXTURES = {
  TENANT_A: testUuid(0xa1a1a1a1),
  TENANT_B: testUuid(0xb1b1b1b1),
  TENANT_C: testUuid(0xc1c1c1c1),
  USER_A_ADMIN: testUuid(0x0a0a0a0a),
  USER_B_ADMIN: testUuid(0x0b0b0b0b),
  USER_SUPER_ADMIN: testUuid(0x5a5a5a5a),
  ASSURE_A: testUuid(0xa55b5e0a),
} as const;
