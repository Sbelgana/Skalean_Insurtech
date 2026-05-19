import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('RLS isolation -- docs and pay tables', () => {
  let ds: DataSource;
  const tenantA = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const tenantB = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  let userAId: string;
  let userBId: string;

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
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'DocPay-A','broker'),($2,'DocPay-B','garage') ON CONFLICT DO NOTHING;`,
      [tenantA, tenantB],
    );

    const uA: Array<{ id: string }> = await qr.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
       VALUES ($1, 'docpay-a@test.ma', $2, 'UserA') RETURNING id;`,
      [tenantA, 'h'.repeat(60)],
    );
    const uB: Array<{ id: string }> = await qr.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
       VALUES ($1, 'docpay-b@test.ma', $2, 'UserB') RETURNING id;`,
      [tenantB, 'h'.repeat(60)],
    );
    userAId = uA[0]?.id ?? '';
    userBId = uB[0]?.id ?? '';
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(`DELETE FROM pay_reconciliation;`);
    await qr.query(`DELETE FROM pay_transactions;`);
    await qr.query(`DELETE FROM pay_methods;`);
    await qr.query(`DELETE FROM doc_access_logs;`);
    await qr.query(`DELETE FROM doc_versions;`);
    await qr.query(`DELETE FROM doc_documents;`);
    await qr.release();
  });

  async function insertDocument(tenantId: string, userId: string, suffix: string): Promise<string> {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantId);
    const rows: Array<{ id: string }> = await qr.query(`
      INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
      VALUES ($1, 'police', $2, 'bucket', $3, 'application/pdf', 1024, $4, $5)
      RETURNING id;
    `, [tenantId, `Doc-${suffix}`, `key/${suffix}.pdf`, 'a'.repeat(64), userId]);
    await qr.release();
    return rows[0]?.id ?? '';
  }

  it('tenant A ne voit pas les documents de tenant B', async () => {
    await insertDocument(tenantB, userBId, 'B-1');

    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const rows: Array<{ id: string }> = await qrA.query(`SELECT id FROM doc_documents;`);
    expect(rows).toHaveLength(0);
    await qrA.release();
  });

  it('tenant A ne peut pas inserer un document avec tenant_id de tenant B', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(`
        INSERT INTO doc_documents
          (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
        VALUES ($1, 'kyc', 'Hack', 'bucket', 'key/hack.pdf', 'application/pdf', 512, $2, $3);
      `, [tenantB, 'b'.repeat(64), userAId]),
    ).rejects.toThrow(/row-level security|policy/i);
    await qr.release();
  });

  it('doc_versions visibles uniquement via document du meme tenant', async () => {
    const docId = await insertDocument(tenantA, userAId, 'A-ver');

    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(`
      INSERT INTO doc_versions (document_id, version_number, s3_key, size_bytes, sha256, created_by)
      VALUES ($1, 1, 'key/v1.pdf', 1024, $2, $3);
    `, [docId, 'c'.repeat(64), userAId]);

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: Array<{ id: string }> = await qrB.query(`SELECT id FROM doc_versions;`);
    expect(rows).toHaveLength(0);
    await qrA.release();
    await qrB.release();
  });

  it('pay_methods isoles par tenant', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(`
      INSERT INTO pay_methods (tenant_id, name, provider, config_encrypted)
      VALUES ($1, 'CMI-A', 'cmi', '{"test":1}'::jsonb);
    `, [tenantA]);
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: Array<{ id: string }> = await qrB.query(`SELECT id FROM pay_methods;`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('SuperAdmin voit les documents de tous les tenants', async () => {
    await insertDocument(tenantA, userAId, 'A-super');

    const qrAdmin = ds.createQueryRunner();
    await setSession(qrAdmin, tenantB, true);
    const rows: Array<{ id: string }> = await qrAdmin.query(
      `SELECT id FROM doc_documents WHERE tenant_id = $1;`,
      [tenantA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qrAdmin.release();
  });

  it('doc_documents sha256 CHECK rejette hash non-hex ou mauvaise longueur', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(`
        INSERT INTO doc_documents
          (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
        VALUES ($1, 'kyc', 'Bad Hash', 'bucket', 'key/bad.pdf', 'application/pdf', 512, 'INVALID_HASH_STRING_NOT_HEX_64', $2);
      `, [tenantA, userAId]),
    ).rejects.toThrow(/chk_sha256_lower|check/i);
    await qr.release();
  });
});
