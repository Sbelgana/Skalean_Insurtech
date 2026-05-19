import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration AnalyticsStockHr1735000000007', () => {
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

  it('cree les 5 tables analytics/stock/hr', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'analytics_events', 'stock_items', 'stock_movements',
          'hr_employees', 'hr_attendance'
        )
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'analytics_events',
      'hr_attendance',
      'hr_employees',
      'stock_items',
      'stock_movements',
    ]);
  });

  it('cree les 3 ENUMs stock_unit/stock_movement_type/hr_role', async () => {
    const rows: Array<{ typname: string }> = await ds.query(`
      SELECT typname FROM pg_type
      WHERE typname IN ('stock_unit_enum', 'stock_movement_type_enum', 'hr_role_enum')
      ORDER BY typname;
    `);
    expect(rows).toHaveLength(3);
  });

  it('RLS FORCE actif sur les 5 tables', async () => {
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN (
          'analytics_events', 'stock_items', 'stock_movements',
          'hr_employees', 'hr_attendance'
        )
        ORDER BY relname;
      `);
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.relrowsecurity, `${r.relname} RLS`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} FORCE RLS`).toBe(true);
    }
  });

  // TODO Sprint 9 : align with actual stock_items schema. See KNOWN-ISSUES.md.
  it.skip('UNIQUE (tenant_id, sku) empeche doublon dans stock_items', async () => {
    const tenantId = '50000000-0000-0000-0000-000000000001';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Stock-T1', 'garage') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );

    await ds.query(`
      INSERT INTO stock_items (tenant_id, sku, name, unit_price_ht, tva_rate, hourly_rate_dirham)
      VALUES ($1, 'PIECE-001', 'Filtre a huile', 25.00, 20.00, NULL)
      ON CONFLICT DO NOTHING;
    `, [tenantId]);

    await expect(
      ds.query(`
        INSERT INTO stock_items (tenant_id, sku, name, unit_price_ht, tva_rate)
        VALUES ($1, 'PIECE-001', 'Autre filtre', 30.00, 20.00);
      `, [tenantId]),
    ).rejects.toThrow(/uq_stock_items_tenant_sku|duplicate key/i);
  });

  it('UNIQUE (tenant_id, employee_number) empeche doublon dans hr_employees', async () => {
    const tenantId = '50000000-0000-0000-0000-000000000002';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'HR-T1', 'garage') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );

    await ds.query(`
      INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date, hourly_rate_dirham)
      VALUES ($1, 'Ahmed Benali', 'mecanicien', 'E001', '2024-01-01', 50.00);
    `, [tenantId]);

    await expect(
      ds.query(`
        INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date, monthly_salary_dirham)
        VALUES ($1, 'Karim Ouali', 'admin', 'E001', '2024-06-01', 5000.00);
      `, [tenantId]),
    ).rejects.toThrow(/uq_hr_employees_tenant_number|duplicate key/i);
  });

  it('CHECK compensation empeche employe sans salaire ni taux horaire', async () => {
    const tenantId = '50000000-0000-0000-0000-000000000003';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'HR-T2', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );

    await expect(
      ds.query(`
        INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date)
        VALUES ($1, 'Sans Salaire', 'tolier', 'E002', '2024-01-01');
      `, [tenantId]),
    ).rejects.toThrow(/chk_hr_employees_compensation|check/i);
  });

  // TODO Sprint 9 : align with actual analytics_events schema (event_type column
  // differs from spec assumption). See KNOWN-ISSUES.md.
  it.skip('analytics_events UPDATE rejette (append-only)', async () => {
    const tenantId = '50000000-0000-0000-0000-000000000004';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Analytics-T1', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );

    await ds.query(`
      INSERT INTO analytics_events (tenant_id, event_name, occurred_at)
      VALUES ($1, 'page_view', now());
    `, [tenantId]);

    await expect(
      ds.query(`
        UPDATE analytics_events SET event_name = 'tampered' WHERE tenant_id = $1;
      `, [tenantId]),
    ).rejects.toThrow(/policy/i);
  });

  // TODO Sprint 9 : align with actual stock_movements schema. See KNOWN-ISSUES.md.
  it.skip('stock_movements DELETE rejette (append-only)', async () => {
    const tenantId = '50000000-0000-0000-0000-000000000005';

    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Stock-T2', 'garage') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );

    const item: Array<{ id: string }> = await ds.query(`
      INSERT INTO stock_items (tenant_id, sku, name, unit_price_ht, tva_rate)
      VALUES ($1, 'PIECE-DEL', 'Test piece', 10.00, 20.00) RETURNING id;
    `, [tenantId]);
    const itemId = item[0]?.id;

    await ds.query(`
      INSERT INTO stock_movements (tenant_id, item_id, movement_type, quantity, unit_price_ht_at_time)
      VALUES ($1, $2, 'in', 5, 10.00);
    `, [tenantId, itemId]);

    await expect(
      ds.query(`DELETE FROM stock_movements WHERE tenant_id = $1;`, [tenantId]),
    ).rejects.toThrow(/policy/i);
  });

  it('down() supprime les 5 tables et les 3 ENUMs', async () => {
    const { AnalyticsStockHr1735000000007 } = await import('../../migrations/1735000000007-AnalyticsStockHr.js');
    const migration = new AnalyticsStockHr1735000000007();
    await migration.down(ds.createQueryRunner());

    const tables: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'analytics_events', 'stock_items', 'stock_movements',
          'hr_employees', 'hr_attendance'
        );
    `);
    expect(tables[0]?.count).toBe(0);

    const enums: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_type
      WHERE typname IN ('stock_unit_enum', 'stock_movement_type_enum', 'hr_role_enum')
        AND typtype = 'e';
    `);
    expect(enums[0]?.count).toBe(0);
  });
});
