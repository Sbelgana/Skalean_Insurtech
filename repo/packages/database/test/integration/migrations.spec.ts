/**
 * TC-MIG-01 to TC-MIG-12 -- migrations integration tests.
 * Validates that all 7 TypeORM migrations apply and revert correctly.
 * Requires DATABASE_TEST_URL or DATABASE_HOST.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { buildTestDataSource, runAllMigrations, revertAllMigrations, TENANTED_TABLES_ORDERED } from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

describe.skipIf(!DB_AVAILABLE)('migrations integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await revertAllMigrations(ds);
  });

  it('TC-MIG-01 -- runs all migrations sequentially up', async () => {
    await runAllMigrations(ds);
    const pending = await ds.showMigrations();
    expect(pending).toBe(false);
  });

  it('TC-MIG-02 -- revert removes all public tables', async () => {
    await runAllMigrations(ds);
    await revertAllMigrations(ds);
    const tables: Array<{ table_name: string }> = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'typeorm_%'`,
    );
    expect(tables.length).toBe(0);
  });

  it('TC-MIG-03 -- up then revert then up is idempotent', async () => {
    await runAllMigrations(ds);
    await revertAllMigrations(ds);
    await runAllMigrations(ds);
    const tables: Array<{ table_name: string }> = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'typeorm_%'`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(30);
  });

  it('TC-MIG-04 -- creates auth_tenants table with required columns', async () => {
    await runAllMigrations(ds);
    const cols: Array<{ column_name: string }> = await ds.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_tenants' ORDER BY ordinal_position`,
    );
    const names = cols.map((c) => c.column_name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'name', 'type', 'created_at', 'updated_at', 'deleted_at']),
    );
  });

  it('TC-MIG-05 -- enables RLS on tenanted tables', async () => {
    await runAllMigrations(ds);
    const tablesToCheck = ['auth_users', 'crm_contacts', 'crm_deals', 'booking_rooms', 'audit_log'];
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'r'`,
        [tablesToCheck],
      );
    const rlsTables = rows.filter((r) => r.relrowsecurity);
    expect(rlsTables.length).toBeGreaterThanOrEqual(4);
    for (const row of rlsTables) {
      expect(row.relforcerowsecurity, `${row.relname} force rls`).toBe(true);
    }
  });

  it('TC-MIG-06 -- creates expected indexes on crm_contacts', async () => {
    await runAllMigrations(ds);
    const indexes: Array<{ indexname: string }> = await ds.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'crm_contacts'`,
    );
    const names = indexes.map((i) => i.indexname);
    expect(names).toEqual(
      expect.arrayContaining(['idx_crm_contacts_tenant']),
    );
  });

  it('TC-MIG-07 -- foreign key constraints exist on crm_deals', async () => {
    await runAllMigrations(ds);
    const fks: Array<{ constraint_name: string }> = await ds.query(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'crm_deals' AND constraint_type = 'FOREIGN KEY'`,
    );
    expect(fks.length).toBeGreaterThanOrEqual(2);
  });

  it('TC-MIG-08 -- unique constraint on auth_users.email (citext)', async () => {
    await runAllMigrations(ds);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    await ds.query(
      `INSERT INTO auth_users (email, password_hash, display_name) VALUES ('unique@test.skalean.ma', $1, 'TestUser')`,
      ['h'.repeat(60)],
    );
    await expect(
      ds.query(
        `INSERT INTO auth_users (email, password_hash, display_name) VALUES ('UNIQUE@test.skalean.ma', $1, 'TestUser2')`,
        ['h'.repeat(60)],
      ),
    ).rejects.toThrow(/duplicate key/i);
  });

  // TODO Sprint 8 : align with actual booking_appointments schema -- columns are
  // time_range (tstzrange) and not starts_at/ends_at. See KNOWN-ISSUES.md.
  it.skip('TC-MIG-09 -- EXCLUDE constraint on booking_appointments overlap', async () => {
    await runAllMigrations(ds);
    const tenantId = '00000000-0000-0000-0000-00000000000a';
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Tenant A', 'broker') ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    const roomId = '11111111-1111-1111-1111-111111111111';
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    await ds.query(
      `INSERT INTO booking_rooms (id, tenant_id, name, capacity) VALUES ($1, $2, 'R1', 4) ON CONFLICT DO NOTHING`,
      [roomId, tenantId],
    );
    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'false', true)`);
    await ds.query(
      `INSERT INTO booking_appointments (id, tenant_id, room_id, starts_at, ends_at, status) VALUES (gen_random_uuid(), $1, $2, '2026-08-01 09:00+00', '2026-08-01 10:00+00', 'confirmed')`,
      [tenantId, roomId],
    );
    await expect(
      ds.query(
        `INSERT INTO booking_appointments (id, tenant_id, room_id, starts_at, ends_at, status) VALUES (gen_random_uuid(), $1, $2, '2026-08-01 09:30+00', '2026-08-01 10:30+00', 'confirmed')`,
        [tenantId, roomId],
      ),
    ).rejects.toThrow(/exclusion constraint|conflicting key/i);
  });

  // TODO Sprint 5 : verify if auth_users.email has explicit CHECK format
  // constraint or only relies on citext UNIQUE -- spec assumes a check that
  // does not exist in current migration. See KNOWN-ISSUES.md.
  it.skip('TC-MIG-10 -- check constraint on auth_users.email format (citext)', async () => {
    await runAllMigrations(ds);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    const result = ds.query(
      `INSERT INTO auth_users (email, password_hash, display_name) VALUES ('not-an-email-format', $1, 'Bad')`,
      ['h'.repeat(60)],
    );
    await expect(result).rejects.toThrow();
  });

  it('TC-MIG-11 -- pg_trgm extension installed', async () => {
    await runAllMigrations(ds);
    const rows: Array<{ extname: string }> = await ds.query(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    );
    expect(rows.length).toBe(1);
  });

  it('TC-MIG-12 -- btree_gist extension installed', async () => {
    await runAllMigrations(ds);
    const rows: Array<{ extname: string }> = await ds.query(
      `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`,
    );
    expect(rows.length).toBe(1);
  });
});
