import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration BooksCompliance1735000000006', () => {
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
    await ds.runMigrations();
  });

  it('cree les 6 tables books_* et compliance_*', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'books_invoices', 'books_invoice_lines', 'books_accounts',
          'compliance_acaps_reports', 'compliance_data_retention_policies', 'compliance_consent_logs'
        )
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'books_accounts',
      'books_invoice_lines',
      'books_invoices',
      'compliance_acaps_reports',
      'compliance_consent_logs',
      'compliance_data_retention_policies',
    ]);
  });

  it('cree les 7 ENUMs books_*/compliance_*', async () => {
    const rows: Array<{ typname: string }> = await ds.query(`
      SELECT typname FROM pg_type
      WHERE typname IN (
        'books_invoice_type', 'books_invoice_status', 'books_account_type',
        'compliance_acaps_report_type', 'compliance_acaps_report_status',
        'compliance_consent_type', 'compliance_consent_method'
      )
      ORDER BY typname;
    `);
    expect(rows).toHaveLength(7);
  });

  it('RLS FORCE actif sur les 6 tables', async () => {
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN (
          'books_invoices', 'books_invoice_lines', 'books_accounts',
          'compliance_acaps_reports', 'compliance_data_retention_policies', 'compliance_consent_logs'
        )
        ORDER BY relname;
      `);
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.relrowsecurity, `${r.relname} RLS`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} FORCE RLS`).toBe(true);
    }
  });

  it('UNIQUE constraint books_invoices_tenant_number_unique empêche doublon', async () => {
    const tenantId = '30000000-0000-0000-0000-000000000001';
    const userId = '40000000-0000-0000-0000-000000000001';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Books-T', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );
    await ds.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, 'books@test.ma', $3, 'BooksUser') ON CONFLICT DO NOTHING;`,
      [userId, tenantId, 'h'.repeat(60)],
    );

    await ds.query(`
      INSERT INTO books_invoices
        (tenant_id, invoice_number, customer_name, customer_ice, customer_address, due_date,
         subtotal_ht, tva_amount, total_ttc, created_by)
      VALUES ($1, '2026-00001', 'Client A', '123456789012345', 'Casablanca', '2026-12-31',
              1000, 200, 1200, $2);
    `, [tenantId, userId]);

    await expect(
      ds.query(`
        INSERT INTO books_invoices
          (tenant_id, invoice_number, customer_name, customer_ice, customer_address, due_date,
           subtotal_ht, tva_amount, total_ttc, created_by)
        VALUES ($1, '2026-00001', 'Client B', '999999999999999', 'Rabat', '2026-12-31',
                500, 100, 600, $2);
      `, [tenantId, userId]),
    ).rejects.toThrow(/books_invoices_tenant_number_unique|duplicate key/i);
  });

  it('invoice_number FORMAT CHECK rejette format invalide', async () => {
    const tenantId = '30000000-0000-0000-0000-000000000002';
    const userId = '40000000-0000-0000-0000-000000000002';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Books-T2', 'garage') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );
    await ds.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, 'books2@test.ma', $3, 'BooksUser2') ON CONFLICT DO NOTHING;`,
      [userId, tenantId, 'h'.repeat(60)],
    );

    await expect(
      ds.query(`
        INSERT INTO books_invoices
          (tenant_id, invoice_number, customer_name, customer_ice, customer_address, due_date,
           subtotal_ht, tva_amount, total_ttc, created_by)
        VALUES ($1, 'INV-001', 'Client', '123456789012345', 'Marrakech', '2026-12-31',
                100, 20, 120, $2);
      `, [tenantId, userId]),
    ).rejects.toThrow(/books_invoices_invoice_number_format|check/i);
  });

  it('cycle detection dans books_accounts rejette cycle', async () => {
    const tenantId = '30000000-0000-0000-0000-000000000003';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Books-T3', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );

    const acc: Array<{ id: string }> = await ds.query(`
      INSERT INTO books_accounts (tenant_id, account_number, name, type)
      VALUES ($1, '4111', 'Clients', 'asset')
      RETURNING id;
    `, [tenantId]);
    const accId = acc[0]?.id;

    await expect(
      ds.query(`
        UPDATE books_accounts SET parent_account_id = $1 WHERE id = $1;
      `, [accId]),
    ).rejects.toThrow(/cycle detected|Cycle/i);
  });

  it('compliance_acaps_reference_format CHECK rejette format invalide', async () => {
    const tenantId = '30000000-0000-0000-0000-000000000004';
    const userId = '40000000-0000-0000-0000-000000000004';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Books-T4', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );
    await ds.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, 'books4@test.ma', $3, 'BooksUser4') ON CONFLICT DO NOTHING;`,
      [userId, tenantId, 'h'.repeat(60)],
    );

    await expect(
      ds.query(`
        INSERT INTO compliance_acaps_reports
          (tenant_id, period_start, period_end, report_type, acaps_reference, submitted_at, status, created_by)
        VALUES ($1, '2026-01-01', '2026-01-31', 'monthly_production', 'INVALID-REF', NOW(), 'submitted', $2);
      `, [tenantId, userId]),
    ).rejects.toThrow(/compliance_acaps_reference_format|check/i);
  });

  it('down() supprime les 6 tables et les 7 ENUMs', async () => {
    const { BooksCompliance1735000000006 } = await import('../../migrations/1735000000006-BooksCompliance.js');
    const migration = new BooksCompliance1735000000006();
    await migration.down(ds.createQueryRunner());

    const tables: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'books_invoices', 'books_invoice_lines', 'books_accounts',
          'compliance_acaps_reports', 'compliance_data_retention_policies', 'compliance_consent_logs'
        );
    `);
    expect(tables[0]?.count).toBe(0);

    const enums: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_type
      WHERE typname IN (
        'books_invoice_type', 'books_invoice_status', 'books_account_type',
        'compliance_acaps_report_type', 'compliance_acaps_report_status',
        'compliance_consent_type', 'compliance_consent_method'
      ) AND typtype = 'e';
    `);
    expect(enums[0]?.count).toBe(0);
  });
});
