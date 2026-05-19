import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration Communications1735000000004', () => {
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

  it('cree les 4 tables comm_*', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('comm_messages', 'comm_templates', 'comm_optouts', 'comm_webhooks_received')
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'comm_messages',
      'comm_optouts',
      'comm_templates',
      'comm_webhooks_received',
    ]);
  });

  it('cree les 8 ENUMs comm_*_enum', async () => {
    const rows: Array<{ typname: string }> = await ds.query(`
      SELECT typname FROM pg_type
      WHERE typname IN (
        'comm_channel_enum', 'comm_direction_enum', 'comm_status_enum',
        'comm_provider_enum', 'comm_template_category_enum', 'comm_language_enum',
        'comm_meta_template_status_enum', 'comm_webhook_processed_status_enum'
      )
      ORDER BY typname;
    `);
    expect(rows).toHaveLength(8);
  });

  it('RLS FORCE actif sur comm_messages, comm_templates, comm_optouts — pas sur comm_webhooks_received', async () => {
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN ('comm_messages', 'comm_templates', 'comm_optouts', 'comm_webhooks_received')
        ORDER BY relname;
      `);
    const map = new Map(rows.map((r) => [r.relname, r]));

    for (const table of ['comm_messages', 'comm_templates', 'comm_optouts']) {
      expect(map.get(table)?.relrowsecurity, `${table} RLS`).toBe(true);
      expect(map.get(table)?.relforcerowsecurity, `${table} FORCE RLS`).toBe(true);
    }
    expect(map.get('comm_webhooks_received')?.relrowsecurity).toBe(false);
  });

  it('12 policies RLS creees (3 tables x 4 actions)', async () => {
    const rows: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_policies
      WHERE tablename IN ('comm_messages', 'comm_templates', 'comm_optouts');
    `);
    expect(rows[0]?.count).toBe(12);
  });

  it('indexes critiques presents', async () => {
    const rows: Array<{ indexname: string }> = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename LIKE 'comm_%'
      ORDER BY indexname;
    `);
    const names = rows.map((r) => r.indexname);
    expect(names).toContain('idx_comm_messages_tenant_channel_status_sent');
    expect(names).toContain('idx_comm_messages_tenant_contact_created');
    expect(names).toContain('idx_comm_optouts_tenant_contact_channel_active');
    expect(names).toContain('idx_comm_webhooks_idempotency_key');
  });

  it('idempotency_key UNIQUE rejette doublon', async () => {
    const key = 'meta:test:wamid.HBgL123';
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('meta', 'messages.delivered', '{}'::jsonb, true, $1);
    `, [key]);
    await expect(
      ds.query(`
        INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('meta', 'messages.delivered', '{}'::jsonb, true, $1);
      `, [key]),
    ).rejects.toThrow(/idx_comm_webhooks_idempotency_key|duplicate key/i);
  });

  it('down() supprime les 4 tables et les 8 ENUMs', async () => {
    const { Communications1735000000004 } = await import('../../migrations/1735000000004-Communications.js');
    const migration = new Communications1735000000004();
    await migration.down(ds.createQueryRunner());

    const tables: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('comm_messages', 'comm_templates', 'comm_optouts', 'comm_webhooks_received');
    `);
    expect(tables[0]?.count).toBe(0);

    const enums: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_type
      WHERE typname IN (
        'comm_channel_enum', 'comm_direction_enum', 'comm_status_enum',
        'comm_provider_enum', 'comm_template_category_enum', 'comm_language_enum',
        'comm_meta_template_status_enum', 'comm_webhook_processed_status_enum'
      ) AND typtype = 'e';
    `);
    expect(enums[0]?.count).toBe(0);
  });
});
