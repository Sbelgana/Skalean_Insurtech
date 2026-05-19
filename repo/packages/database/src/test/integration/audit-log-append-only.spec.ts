import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('audit_log -- append-only enforcement', () => {
  let ds: DataSource;
  const tenantA = '33333333-3333-3333-3333-333333333333';

  const setSession = async (qr: QueryRunner, tenantId: string, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
    const qr = ds.createQueryRunner();
    await qr.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await qr.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Audit-Test','broker') ON CONFLICT DO NOTHING;`,
      [tenantA],
    );
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('INSERT audit entry reussit avec tenant context', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    await qr.query(
      `INSERT INTO audit_log (tenant_id, action, resource_type, changes) VALUES ($1, 'create', 'broker', '{"after":{"name":"X"}}'::jsonb);`,
      [tenantA],
    );
    const [{ count }]: Array<{ count: number }> = await qr.query(
      `SELECT COUNT(*)::int AS count FROM audit_log WHERE tenant_id = $1;`,
      [tenantA],
    );
    expect(count).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  // TODO Sprint 6 : superuser bypass RLS so UPDATE policy not enforced. Rewrite
  // with non-superuser test role. See KNOWN-ISSUES.md.
  it.skip('UPDATE bloque -- absence de UPDATE policy', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const result = await qr.query(`UPDATE audit_log SET action = 'tampered' WHERE tenant_id = $1;`, [tenantA]) as [unknown, number];
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('DELETE bloque -- absence de DELETE policy', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const result = await qr.query(`DELETE FROM audit_log WHERE tenant_id = $1;`, [tenantA]) as [unknown, number];
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('INSERT avec user_id NULL autorise (background job)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, true);
    await qr.query(
      `INSERT INTO audit_log (tenant_id, user_id, action, resource_type) VALUES ($1, NULL, 'system.bootstrap', 'system');`,
      [tenantA],
    );
    const [{ count }]: Array<{ count: number }> = await qr.query(
      `SELECT COUNT(*)::int AS count FROM audit_log WHERE user_id IS NULL AND tenant_id = $1;`,
      [tenantA],
    );
    expect(count).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  it('JSONB changes accepte {before, after, fields_changed}', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const payload = { before: { name: 'A' }, after: { name: 'B' }, fields_changed: ['name'] };
    await qr.query(
      `INSERT INTO audit_log (tenant_id, action, resource_type, changes) VALUES ($1, 'update', 'broker', $2::jsonb);`,
      [tenantA, JSON.stringify(payload)],
    );
    const [row]: Array<{ changes: { fields_changed: string[] } }> = await qr.query(
      `SELECT changes FROM audit_log WHERE tenant_id = $1 AND action = 'update' ORDER BY created_at DESC LIMIT 1;`,
      [tenantA],
    );
    expect(row?.changes.fields_changed).toEqual(['name']);
    await qr.release();
  });
});
