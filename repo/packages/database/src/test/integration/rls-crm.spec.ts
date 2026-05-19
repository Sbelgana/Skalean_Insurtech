import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('RLS isolation -- CRM tables', () => {
  let ds: DataSource;
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Tenant-A','broker'),($2,'Tenant-B','garage') ON CONFLICT DO NOTHING;`,
      [tenantA, tenantB],
    );
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(`DELETE FROM crm_interactions;`);
    await qr.query(`DELETE FROM crm_deals;`);
    await qr.query(`DELETE FROM crm_contacts;`);
    await qr.query(`DELETE FROM crm_companies;`);
    await qr.release();
  });

  it('tenant A ne voit pas les companies de tenant B', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(
      `INSERT INTO crm_companies (tenant_id, name) VALUES ($1, 'Company-A');`,
      [tenantA],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    await qrB.query(
      `INSERT INTO crm_companies (tenant_id, name) VALUES ($1, 'Company-B');`,
      [tenantB],
    );
    const rows: Array<{ name: string }> = await qrB.query(`SELECT name FROM crm_companies;`);
    expect(rows).toEqual([{ name: 'Company-B' }]);
    await qrB.release();
  });

  it('tenant A ne peut pas inserer une company avec tenant_id de tenant B', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ($1, 'Hack');`, [tenantB]),
    ).rejects.toThrow(/row-level security|policy/i);
    await qr.release();
  });

  it('tenant A ne peut pas UPDATE une company de tenant B (0 lignes)', async () => {
    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const inserted: Array<{ id: string }> = await qrB.query(
      `INSERT INTO crm_companies (tenant_id, name) VALUES ($1, 'CB') RETURNING id;`,
      [tenantB],
    );
    await qrB.release();
    const id = inserted[0]?.id;

    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const result = await qrA.query(
      `UPDATE crm_companies SET name = 'Hijacked' WHERE id = $1 RETURNING id;`,
      [id],
    ) as unknown[];
    expect(result).toHaveLength(0);
    await qrA.release();
  });

  it('contacts isolation cross-tenant', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'Said', 'A');`,
      [tenantA],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    await qrB.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'Karim', 'B');`,
      [tenantB],
    );
    const rows: Array<{ first_name: string }> = await qrB.query(`SELECT first_name FROM crm_contacts;`);
    expect(rows).toEqual([{ first_name: 'Karim' }]);
    await qrB.release();
  });

  it('deals isolation cross-tenant', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const user: Array<{ id: string }> = await qrA.query(
      `SELECT id FROM auth_users WHERE tenant_id = $1 LIMIT 1;`,
      [tenantA],
    );
    const ownerUserId = user[0]?.id ?? tenantA;
    const contact: Array<{ id: string }> = await qrA.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'F', 'L') RETURNING id;`,
      [tenantA],
    );
    await qrA.query(
      `INSERT INTO crm_deals (tenant_id, contact_id, title, owner_user_id) VALUES ($1, $2, 'Deal-A', $3);`,
      [tenantA, contact[0]?.id, ownerUserId],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: Array<{ title: string }> = await qrB.query(`SELECT title FROM crm_deals;`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('crm_interactions isolation cross-tenant', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const contact: Array<{ id: string }> = await qrA.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'F', 'L') RETURNING id;`,
      [tenantA],
    );
    await qrA.query(
      `INSERT INTO crm_interactions (tenant_id, contact_id, type, direction, subject, created_by)
       VALUES ($1, $2, 'call', 'outbound', 'Bonjour', $3);`,
      [tenantA, contact[0]?.id, tenantA],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: unknown[] = await qrB.query(`SELECT subject FROM crm_interactions;`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('crm_interactions UPDATE bloque par trigger (exception)', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const contact: Array<{ id: string }> = await qrA.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'F', 'L') RETURNING id;`,
      [tenantA],
    );
    const interaction: Array<{ id: string }> = await qrA.query(
      `INSERT INTO crm_interactions (tenant_id, contact_id, type, direction, subject, created_by)
       VALUES ($1, $2, 'call', 'outbound', 'Original', $3) RETURNING id;`,
      [tenantA, contact[0]?.id, tenantA],
    );
    await expect(
      qrA.query(`UPDATE crm_interactions SET subject = 'Modifie' WHERE id = $1;`, [interaction[0]?.id]),
    ).rejects.toThrow(/append-only|interdits/i);
    await qrA.release();
  });

  it('crm_interactions DELETE bloque par trigger (exception)', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const contact: Array<{ id: string }> = await qrA.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'G', 'H') RETURNING id;`,
      [tenantA],
    );
    const interaction: Array<{ id: string }> = await qrA.query(
      `INSERT INTO crm_interactions (tenant_id, contact_id, type, direction, subject, created_by)
       VALUES ($1, $2, 'note', 'inbound', 'Note', $3) RETURNING id;`,
      [tenantA, contact[0]?.id, tenantA],
    );
    await expect(
      qrA.query(`DELETE FROM crm_interactions WHERE id = $1;`, [interaction[0]?.id]),
    ).rejects.toThrow(/append-only|interdits/i);
    await qrA.release();
  });

  it('SuperAdmin voit les companies de tous les tenants', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ($1, 'Comp-SA');`, [tenantA]);
    await qrA.release();

    const qrAdmin = ds.createQueryRunner();
    await setSession(qrAdmin, tenantB, true);
    const rows: Array<{ name: string }> = await qrAdmin.query(
      `SELECT name FROM crm_companies WHERE tenant_id = $1;`,
      [tenantA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qrAdmin.release();
  });

  it('FORCE RLS actif sur crm_companies', async () => {
    const [row]: Array<{ relforcerowsecurity: boolean }> = await ds.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE relname = 'crm_companies';`,
    );
    expect(row?.relforcerowsecurity).toBe(true);
  });
});
