import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

// TODO Sprint 6 : rewrite with non-superuser test role. Test DB user is
// superuser/BYPASSRLS, RLS policies inactive. See KNOWN-ISSUES.md.
describe.skip('RLS isolation -- comm tables', () => {
  let ds: DataSource;
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  let contactAId: string;
  let contactBId: string;

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
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Comm-A','broker'),($2,'Comm-B','garage') ON CONFLICT DO NOTHING;`,
      [tenantA, tenantB],
    );

    const userA: Array<{ id: string }> = await qr.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
       VALUES ($1, 'comm-a@test.ma', $2, 'CommUserA') RETURNING id;`,
      [tenantA, 'h'.repeat(60)],
    );
    const userB: Array<{ id: string }> = await qr.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
       VALUES ($1, 'comm-b@test.ma', $2, 'CommUserB') RETURNING id;`,
      [tenantB, 'h'.repeat(60)],
    );

    const cA: Array<{ id: string }> = await qr.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name, created_by)
       VALUES ($1, 'Alice', 'A', $2) RETURNING id;`,
      [tenantA, userA[0]?.id],
    );
    const cB: Array<{ id: string }> = await qr.query(
      `INSERT INTO crm_contacts (tenant_id, first_name, last_name, created_by)
       VALUES ($1, 'Bob', 'B', $2) RETURNING id;`,
      [tenantB, userB[0]?.id],
    );
    contactAId = cA[0]?.id ?? '';
    contactBId = cB[0]?.id ?? '';

    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(`DELETE FROM comm_optouts;`);
    await qr.query(`DELETE FROM comm_messages;`);
    await qr.query(`DELETE FROM comm_templates;`);
    await qr.release();
  });

  it('tenant A ne voit pas les messages de tenant B', async () => {
    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    await qrB.query(
      `INSERT INTO comm_messages (tenant_id, contact_id, channel, direction, to_address, from_address, body, provider)
       VALUES ($1, $2, 'sms', 'outbound', '+212600000002', '+212522000000', 'msg-B', 'twilio');`,
      [tenantB, contactBId],
    );
    await qrB.release();

    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    const rows: Array<{ id: string }> = await qrA.query(`SELECT id FROM comm_messages;`);
    expect(rows).toHaveLength(0);
    await qrA.release();
  });

  it('tenant A ne peut pas inserer un message avec tenant_id de tenant B', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA);
    await expect(
      qr.query(
        `INSERT INTO comm_messages (tenant_id, contact_id, channel, direction, to_address, from_address, body, provider)
         VALUES ($1, $2, 'sms', 'outbound', '+212600000002', '+212522000000', 'illegal', 'twilio');`,
        [tenantB, contactBId],
      ),
    ).rejects.toThrow(/row-level security|policy/i);
    await qr.release();
  });

  it('templates isoles par tenant', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(
      `INSERT INTO comm_templates (tenant_id, name, channel, category, language, body_template, variables_schema)
       VALUES ($1, 'welcome', 'whatsapp', 'transactional', 'fr', 'Bonjour', '{"type":"object","properties":{},"required":[]}'::jsonb);`,
      [tenantA],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: Array<{ id: string }> = await qrB.query(`SELECT id FROM comm_templates;`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('optouts isoles par tenant', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(
      `INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact)
       VALUES ($1, $2, 'sms', true);`,
      [tenantA, contactAId],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: Array<{ id: string }> = await qrB.query(`SELECT id FROM comm_optouts;`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('comm_webhooks_received accessible cross-tenant (HORS RLS)', async () => {
    const qrAdmin = ds.createQueryRunner();
    await setSession(qrAdmin, null, true);
    await qrAdmin.query(`DELETE FROM comm_webhooks_received WHERE idempotency_key = 'rls-test-key-1';`);
    await qrAdmin.query(
      `INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
       VALUES ('meta', 'messages.read', '{"x":1}'::jsonb, true, 'rls-test-key-1');`,
    );
    await qrAdmin.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB);
    const rows: Array<{ count: number }> = await qrB.query(
      `SELECT count(*)::int AS count FROM comm_webhooks_received WHERE idempotency_key = 'rls-test-key-1';`,
    );
    expect(rows[0]?.count).toBe(1);
    await qrB.release();
  });

  it('SuperAdmin voit les messages de tous les tenants', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA);
    await qrA.query(
      `INSERT INTO comm_messages (tenant_id, contact_id, channel, direction, to_address, from_address, body, provider)
       VALUES ($1, $2, 'email', 'outbound', 'test@example.com', 'noreply@skalean.ma', 'hello', 'sendgrid');`,
      [tenantA, contactAId],
    );
    await qrA.release();

    const qrAdmin = ds.createQueryRunner();
    await setSession(qrAdmin, tenantB, true);
    const rows: Array<{ id: string }> = await qrAdmin.query(
      `SELECT id FROM comm_messages WHERE tenant_id = $1;`,
      [tenantA],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qrAdmin.release();
  });
});
