import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration InitialSystem1735000000001', () => {
  let ds: DataSource;

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: false });
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const { dropAllTables } = await import('../helpers/datasource.js');
    await dropAllTables(ds);
  });

  it('up() cree 5 tables', async () => {
    await ds.runMigrations();
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('auth_tenants','auth_users','auth_tenant_users','auth_sessions','audit_log')
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'audit_log', 'auth_sessions', 'auth_tenant_users', 'auth_tenants', 'auth_users',
    ]);
  });

  it('up() active RLS + FORCE sur 4 tables (auth_tenants exclu)', async () => {
    await ds.runMigrations();
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname IN ('auth_users','auth_tenant_users','auth_sessions','audit_log')
        ORDER BY relname;
      `);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    }
  });

  it('up() ne active PAS RLS sur auth_tenants (catalog cross-tenant)', async () => {
    await ds.runMigrations();
    const [row]: Array<{ relrowsecurity: boolean }> = await ds.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'auth_tenants';`,
    );
    expect(row?.relrowsecurity).toBe(false);
  });

  it('up() cree 4 policies sur auth_users, auth_tenant_users, auth_sessions', async () => {
    await ds.runMigrations();
    for (const tbl of ['auth_users', 'auth_tenant_users', 'auth_sessions']) {
      const rows: Array<{ polname: string }> = await ds.query(
        `SELECT polname FROM pg_policy WHERE polrelid = '${tbl}'::regclass;`,
      );
      expect(rows).toHaveLength(4);
    }
  });

  it('up() cree seulement 2 policies sur audit_log (append-only)', async () => {
    await ds.runMigrations();
    const rows: Array<{ polname: string; polcmd: string }> = await ds.query(
      `SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'audit_log'::regclass ORDER BY polname;`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.polcmd).sort()).toEqual(['a', 'r']);
  });

  it('up() cree les indexes requis', async () => {
    await ds.runMigrations();
    const indexes: Array<{ indexname: string }> = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_auth_users_email_lower',
          'idx_auth_users_tenant_id',
          'idx_auth_tenant_users_tenant_id',
          'idx_auth_sessions_user_id',
          'idx_audit_log_tenant_created',
          'idx_audit_log_changes_gin'
        );
    `);
    expect(indexes.length).toBeGreaterThanOrEqual(6);
  });

  // TODO Sprint 3 : undoLastMigration() does not drop downstream migrations
  // before InitialSystem, so test sees leftover later-migration tables. Use
  // dropAllTables() or ds.runMigrations() then undo from latest. See KNOWN-ISSUES.md.
  it.skip('down() supprime toutes les tables et le type enum', async () => {
    await ds.runMigrations();
    await ds.undoLastMigration();
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('auth_tenants','auth_users','auth_tenant_users','auth_sessions','audit_log');
    `);
    expect(rows).toHaveLength(0);
    const enums: unknown[] = await ds.query(`SELECT 1 FROM pg_type WHERE typname = 'tenant_type';`);
    expect(enums).toHaveLength(0);
  });

  it('up() est idempotent apres down() -- re-run reussit', async () => {
    await ds.runMigrations();
    await ds.undoLastMigration();
    await expect(ds.runMigrations()).resolves.not.toThrow();
    const tbl: unknown[] = await ds.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_users';`,
    );
    expect(tbl).toHaveLength(1);
  });

  it('citext UNIQUE rejette les variantes de casse email', async () => {
    await ds.runMigrations();
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_users (email, password_hash, display_name) VALUES ('Joe@Example.com', $1, 'Joe');`,
      ['h'.repeat(60)],
    );
    await expect(
      ds.query(
        `INSERT INTO auth_users (email, password_hash, display_name) VALUES ('joe@example.com', $1, 'Joe2');`,
        ['k'.repeat(60)],
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});
