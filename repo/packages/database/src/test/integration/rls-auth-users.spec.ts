import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

// TODO Sprint 6 : rewrite with non-superuser test role. Test DB user is
// superuser/BYPASSRLS, RLS policies inactive. See KNOWN-ISSUES.md.
describe.skip('RLS isolation -- auth_users', () => {
  let ds: DataSource;
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const setSession = async (qr: QueryRunner, tenantId: string | null, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Tenant A','broker'),($2,'Tenant B','garage');`,
      [tenantA, tenantB],
    );
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('INSERT tenant A puis SELECT tenant B retourne 0 lignes', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA, false);
    await qrA.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'a@a.com', $2, 'A');`,
      [tenantA, 'h'.repeat(60)],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB, false);
    const rows: unknown[] = await qrB.query(`SELECT id FROM auth_users WHERE email = 'a@a.com';`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('SuperAdmin voit les lignes tenant A en etant connecte tenant B', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, true);
    const rows: Array<{ id: string; tenant_id: string }> = await qr.query(
      `SELECT id, tenant_id FROM auth_users WHERE tenant_id = $1;`,
      [tenantA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  it('INSERT bloque sans tenant context (null + not super_admin)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, false);
    await expect(
      qr.query(
        `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'x@x.com', $2, 'X');`,
        [tenantA, 'h'.repeat(60)],
      ),
    ).rejects.toThrow(/row-level security/);
    await qr.release();
  });

  it('UPDATE bloque cross-tenant (0 lignes mises a jour)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, false);
    const result = await qr.query(`UPDATE auth_users SET display_name = 'hacked' WHERE email = 'a@a.com';`) as [unknown, number];
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('DELETE bloque cross-tenant (0 lignes supprimees)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, false);
    const result = await qr.query(`DELETE FROM auth_users WHERE email = 'a@a.com';`) as [unknown, number];
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('FORCE RLS empeche le bypass meme proprietaire', async () => {
    const [row]: Array<{ relforcerowsecurity: boolean }> = await ds.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE relname = 'auth_users';`,
    );
    expect(row?.relforcerowsecurity).toBe(true);
  });

  it('soft-delete : deleted_at IS NULL filtre correctement', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    await qr.query(`UPDATE auth_users SET deleted_at = now() WHERE email = 'a@a.com';`);
    const rows: unknown[] = await qr.query(
      `SELECT id FROM auth_users WHERE email = 'a@a.com' AND deleted_at IS NULL;`,
    );
    expect(rows).toHaveLength(0);
    await qr.release();
  });

  it('app_can_access_tenant() retourne true pour super_admin meme si tenant_id different', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, true);
    const [row]: Array<{ allowed: boolean }> = await qr.query(
      `SELECT app_can_access_tenant($1) AS allowed;`,
      [tenantB],
    );
    expect(row?.allowed).toBe(true);
    await qr.release();
  });
});
