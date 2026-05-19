import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Migration DocsPayments1735000000005', () => {
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

  it('cree les 6 tables doc_* et pay_*', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'doc_documents', 'doc_versions', 'doc_access_logs',
          'pay_methods', 'pay_transactions', 'pay_reconciliation'
        )
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual([
      'doc_access_logs',
      'doc_documents',
      'doc_versions',
      'pay_methods',
      'pay_reconciliation',
      'pay_transactions',
    ]);
  });

  it('cree les 7 ENUMs docs/pay', async () => {
    const rows: Array<{ typname: string }> = await ds.query(`
      SELECT typname FROM pg_type
      WHERE typname IN (
        'doc_type_enum', 'doc_status_enum', 'doc_access_action_enum',
        'pay_provider_enum', 'pay_status_enum', 'reconciliation_status_enum', 'pay_currency_enum'
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
          'doc_documents', 'doc_versions', 'doc_access_logs',
          'pay_methods', 'pay_transactions', 'pay_reconciliation'
        )
        ORDER BY relname;
      `);
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.relrowsecurity, `${r.relname} RLS`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} FORCE RLS`).toBe(true);
    }
  });

  it('trigger retention_calc positionne retention_until=signed+10ans1j', async () => {
    const tenantId = '10000000-0000-0000-0000-000000000001';
    const userId = '20000000-0000-0000-0000-000000000001';

    const qr = ds.createQueryRunner();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await qr.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await qr.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'DocTest', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );
    await qr.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, 'doc@test.ma', $3, 'DocUser') ON CONFLICT DO NOTHING;`,
      [userId, tenantId, 'h'.repeat(60)],
    );

    const inserted: Array<{ id: string; retention_until: string | null }> = await qr.query(`
      INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, status, created_by)
      VALUES ($1, 'police', 'Test Doc', 'test-bucket', 'test/key.pdf', 'application/pdf',
              1024, $2, 'signed', $3)
      RETURNING id, retention_until;
    `, [
      tenantId,
      'a'.repeat(64),
      userId,
    ]);
    await qr.release();

    expect(inserted[0]?.retention_until).not.toBeNull();
    const retDate = new Date(inserted[0]?.retention_until ?? '');
    const now = new Date();
    const diffYears = retDate.getFullYear() - now.getFullYear();
    expect(diffYears).toBeGreaterThanOrEqual(9);
    expect(diffYears).toBeLessThanOrEqual(11);
  });

  it('indexes critiques presents', async () => {
    const rows: Array<{ indexname: string }> = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('doc_documents', 'doc_versions', 'doc_access_logs', 'pay_methods', 'pay_transactions', 'pay_reconciliation')
      ORDER BY indexname;
    `);
    const names = rows.map((r) => r.indexname);
    expect(names).toContain('idx_doc_documents_tenant_type_created');
    expect(names).toContain('idx_doc_documents_polymorphic');
    expect(names).toContain('idx_doc_documents_sha256');
    expect(names).toContain('idx_pay_transactions_tenant_status_initiated');
    expect(names).toContain('idx_pay_reconciliation_tenant_status');
  });

  it('UNIQUE constraint uq_doc_versions_doc_ver rejette doublon', async () => {
    const tenantId = '10000000-0000-0000-0000-000000000002';
    const userId = '20000000-0000-0000-0000-000000000002';

    await ds.query(
      `SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId],
    );
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'DocTest2', 'broker') ON CONFLICT DO NOTHING;`,
      [tenantId],
    );
    await ds.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1, $2, 'doc2@test.ma', $3, 'DocUser2') ON CONFLICT DO NOTHING;`,
      [userId, tenantId, 'h'.repeat(60)],
    );

    const doc: Array<{ id: string }> = await ds.query(`
      INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
      VALUES ($1, 'contrat', 'Contract', 'bucket', 'key/v1.pdf', 'application/pdf', 512, $2, $3)
      RETURNING id;
    `, [tenantId, 'b'.repeat(64), userId]);
    const docId = doc[0]?.id;

    await ds.query(`
      INSERT INTO doc_versions (document_id, version_number, s3_key, size_bytes, sha256, created_by)
      VALUES ($1, 1, 'key/v1.pdf', 512, $2, $3);
    `, [docId, 'b'.repeat(64), userId]);

    await expect(
      ds.query(`
        INSERT INTO doc_versions (document_id, version_number, s3_key, size_bytes, sha256, created_by)
        VALUES ($1, 1, 'key/v1b.pdf', 512, $2, $3);
      `, [docId, 'c'.repeat(64), userId]),
    ).rejects.toThrow(/uq_doc_versions_doc_ver|duplicate key/i);
  });

  it('down() supprime les 6 tables et les 7 ENUMs', async () => {
    const { DocsPayments1735000000005 } = await import('../../migrations/1735000000005-DocsPayments.js');
    const migration = new DocsPayments1735000000005();
    await migration.down(ds.createQueryRunner());

    const tables: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'doc_documents', 'doc_versions', 'doc_access_logs',
          'pay_methods', 'pay_transactions', 'pay_reconciliation'
        );
    `);
    expect(tables[0]?.count).toBe(0);

    const enums: Array<{ count: number }> = await ds.query(`
      SELECT count(*)::int AS count FROM pg_type
      WHERE typname IN (
        'doc_type_enum', 'doc_status_enum', 'doc_access_action_enum',
        'pay_provider_enum', 'pay_status_enum', 'reconciliation_status_enum', 'pay_currency_enum'
      ) AND typtype = 'e';
    `);
    expect(enums[0]?.count).toBe(0);
  });
});
