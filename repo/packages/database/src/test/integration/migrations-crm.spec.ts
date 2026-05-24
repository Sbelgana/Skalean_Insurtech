import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration CRM1735000000002', () => {
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

  it('cree les 4 tables CRM', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('crm_companies', 'crm_contacts', 'crm_deals', 'crm_interactions')
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'crm_companies', 'crm_contacts', 'crm_deals', 'crm_interactions',
    ]);
  });

  it('cree les 4 ENUMs CRM (apres reshape Sprint 8.4 -- crm_deal_stage supprime)', async () => {
    // Sprint 8.4 migration 017 a supprime crm_deal_stage au profit de stage_id FK
    // -> crm_stages. Les 4 ENUMs restants sont definis par migration 002.
    const rows: Array<{ typname: string }> = await ds.query(`
      SELECT typname FROM pg_type
      WHERE typname LIKE 'crm_%' AND typtype = 'e'
      ORDER BY typname;
    `);
    expect(rows.map((r) => r.typname)).toEqual([
      'crm_interaction_direction',
      'crm_interaction_type',
      'crm_preferred_channel',
      'crm_preferred_language',
    ]);
  });

  it('full_name est colonne GENERATED STORED', async () => {
    const rows: Array<{ attname: string; attgenerated: string }> = await ds.query(`
      SELECT attname, attgenerated FROM pg_attribute
      WHERE attrelid = 'crm_contacts'::regclass AND attname = 'full_name';
    `);
    expect(rows[0]?.attgenerated).toBe('s');
  });

  it('full_name se calcule correctement', async () => {
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    const tenantId = '00000000-0000-0000-0000-000000000001';
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'T1', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );
    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    await ds.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ($1, 'Mohammed', 'Errachidi');`,
      [tenantId],
    );
    const rows: Array<{ full_name: string }> = await ds.query(
      `SELECT full_name FROM crm_contacts WHERE first_name = 'Mohammed';`,
    );
    expect(rows[0]?.full_name).toBe('Mohammed Errachidi');
  });

  it('RLS FORCE active sur les 4 tables CRM', async () => {
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname IN ('crm_companies', 'crm_contacts', 'crm_deals', 'crm_interactions')
        ORDER BY relname;
      `);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    }
  });

  it('16 policies RLS creees (4 tables x 4 actions)', async () => {
    // Scope strictly to Sprint 2 tables. Later migrations (e.g. 016 Sprint 8.3 pipelines/stages)
    // add more crm_* policies that must not affect this assertion.
    const rows: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_policies
      WHERE tablename IN ('crm_companies', 'crm_contacts', 'crm_deals', 'crm_interactions');
    `);
    expect(rows[0]?.count).toBe(16);
  });

  it('indexes GIN trigram presents', async () => {
    const rows: Array<{ indexname: string }> = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE '%_trgm'
      ORDER BY indexname;
    `);
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'idx_crm_companies_email_trgm',
        'idx_crm_companies_name_trgm',
        'idx_crm_contacts_email_trgm',
        'idx_crm_contacts_full_name_trgm',
        'idx_crm_contacts_phone_trgm',
        'idx_crm_deals_name_trgm',
        'idx_crm_interactions_body_trgm',
        'idx_crm_interactions_subject_trgm',
      ]),
    );
  });

  it('triggers append-only crm_interactions actifs', async () => {
    const rows: Array<{ tgname: string }> = await ds.query(`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'crm_interactions'::regclass AND NOT tgisinternal
      ORDER BY tgname;
    `);
    const names = rows.map((r) => r.tgname);
    expect(names).toEqual(
      expect.arrayContaining(['crm_interactions_no_delete', 'crm_interactions_no_update']),
    );
  });

  it('down() supprime les 4 tables et les 4 ENUMs CRM', async () => {
    // Revert later CRM migrations first :
    //   - 018 Sprint 8.5 reshape interactions polymorphic + SECURITY DEFINER
    //   - 017 Sprint 8.4 reshape deals (re-creates crm_deal_stage ENUM transitoirement)
    //   - 016 Sprint 8.3 pipelines/stages
    // ... then 002's down() can prove it removes ALL of its Sprint 2 contribution.
    const { ReshapeCrmInteractionsPolymorphic1735000000018 } = await import(
      '../../migrations/1735000000018-ReshapeCrmInteractionsPolymorphic.js'
    );
    await new ReshapeCrmInteractionsPolymorphic1735000000018().down(
      ds.createQueryRunner(),
    );

    const { ReshapeCrmDealsWorkflow1735000000017 } = await import(
      '../../migrations/1735000000017-ReshapeCrmDealsWorkflow.js'
    );
    await new ReshapeCrmDealsWorkflow1735000000017().down(ds.createQueryRunner());

    const { CreateCrmPipelinesStages1735000000016 } = await import(
      '../../migrations/1735000000016-CreateCrmPipelinesStages.js'
    );
    await new CreateCrmPipelinesStages1735000000016().down(ds.createQueryRunner());

    const { CRM1735000000002 } = await import('../../migrations/1735000000002-CRM.js');
    const migration = new CRM1735000000002();
    await migration.down(ds.createQueryRunner());

    const tables: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'crm_%';
    `);
    expect(tables[0]?.count).toBe(0);

    const enums: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_type
      WHERE typname LIKE 'crm_%' AND typtype = 'e';
    `);
    expect(enums[0]?.count).toBe(0);
  });
});
