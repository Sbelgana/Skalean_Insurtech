import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Constraints CRM -- UNIQUE / CHECK / FK / GENERATED', () => {
  let ds: DataSource;
  const tenantA = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const tenantB = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

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
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Tenant-C','broker'),($2,'Tenant-D','garage') ON CONFLICT DO NOTHING;`,
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

  it('UNIQUE (tenant, ice) bloque doublon meme tenant', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await qr.query(
      `INSERT INTO crm_companies (tenant_id, name, ice) VALUES ($1, 'C1', '001234567890123');`,
      [tenantA],
    );
    await expect(
      qr.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ($1, 'C2', '001234567890123');`, [tenantA]),
    ).rejects.toThrow(/duplicate key|unique/i);
    await qr.release();
  });

  it('UNIQUE (tenant, ice) autorise meme ICE chez 2 tenants differents', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(
      `INSERT INTO crm_companies (tenant_id, name, ice) VALUES ($1, 'A', '001234567890123');`,
      [tenantA],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    await expect(
      qrB.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ($1, 'B', '001234567890123');`, [tenantB]),
    ).resolves.not.toThrow();
    await qrB.release();
  });

  it('CHECK ICE format rejette 14 chiffres', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ($1, 'C', '00123456789012');`, [tenantA]),
    ).rejects.toThrow(/check constraint|crm_companies_ice_format/i);
    await qr.release();
  });

  it('CHECK CIN format rejette minuscules', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(
        `INSERT INTO crm_contacts (tenant_id, first_name, last_name, cin) VALUES ($1, 'F', 'L', 'bk123456');`,
        [tenantA],
      ),
    ).rejects.toThrow(/check constraint|crm_contacts_cin_format/i);
    await qr.release();
  });

  it('CHECK CIN format accepte format valide [A-Z]{1,2}[0-9]{6,8}', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(
        `INSERT INTO crm_contacts (tenant_id, first_name, last_name, cin) VALUES ($1, 'Said', 'Tazi', 'BK123456');`,
        [tenantA],
      ),
    ).resolves.not.toThrow();
    await qr.release();
  });

  it('full_name est mis a jour automatiquement apres UPDATE first_name', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    const rows: Array<{ id: string }> = await qr.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'Said', 'Tazi') RETURNING id;`,
      [tenantA],
    );
    const id = rows[0]?.id;
    await qr.query(`UPDATE crm_contacts SET first_name = 'Karim' WHERE id = $1;`, [id]);
    const updated: Array<{ full_name: string }> = await qr.query(
      `SELECT full_name FROM crm_contacts WHERE id = $1;`,
      [id],
    );
    expect(updated[0]?.full_name).toBe('Karim Tazi');
    await qr.release();
  });

  it('FK ON DELETE RESTRICT bloque suppression company avec contacts', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    const company: Array<{ id: string }> = await qr.query(
      `INSERT INTO crm_companies (tenant_id, name) VALUES ($1, 'X') RETURNING id;`,
      [tenantA],
    );
    await qr.query(
      `INSERT INTO crm_contacts (tenant_id, company_id, first_name, last_name) VALUES ($1, $2, 'F', 'L');`,
      [tenantA, company[0]?.id],
    );
    await expect(
      qr.query(`DELETE FROM crm_companies WHERE id = $1;`, [company[0]?.id]),
    ).rejects.toThrow(/foreign key|restrict/i);
    await qr.release();
  });

  it('UNIQUE (tenant, email) bloque doublon email sur crm_contacts dans meme tenant', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await qr.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name, email) VALUES ($1, 'A', 'A', 'test@skalean.ma');`,
      [tenantA],
    );
    await expect(
      qr.query(
        `INSERT INTO crm_contacts (tenant_id, first_name, last_name, email) VALUES ($1, 'B', 'B', 'test@skalean.ma');`,
        [tenantA],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
    await qr.release();
  });
});
