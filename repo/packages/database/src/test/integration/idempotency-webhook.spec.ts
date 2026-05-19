import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('Webhook idempotency_key UNIQUE -- comm_webhooks_received', () => {
  let ds: DataSource;

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query(`DELETE FROM comm_webhooks_received;`);
  });

  it('INSERT premier passe', async () => {
    const rows: Array<{ id: string }> = await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('meta', 'messages.delivered', '{}'::jsonb, true, 'meta:tenantA:wamid.001')
      RETURNING id;
    `);
    expect(rows[0]?.id).toBeDefined();
  });

  it('INSERT duplicate rejete par UNIQUE', async () => {
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('twilio', 'sms.delivered', '{}'::jsonb, true, 'twilio:SM_dup_key');
    `);
    await expect(
      ds.query(`
        INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('twilio', 'sms.delivered', '{}'::jsonb, true, 'twilio:SM_dup_key');
      `),
    ).rejects.toThrow(/duplicate key|idx_comm_webhooks_idempotency_key/i);
  });

  it('ON CONFLICT DO NOTHING retourne 0 lignes', async () => {
    const key = 'sendgrid:evt-conflict-1';
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('sendgrid', 'delivered', '{}'::jsonb, true, $1);
    `, [key]);
    const rows: Array<{ id: string }> = await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('sendgrid', 'delivered', '{}'::jsonb, true, $1)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id;
    `, [key]);
    expect(rows).toHaveLength(0);
  });

  it('idempotency_key globale cross-tenant : un seul enregistrement autorise', async () => {
    const key = 'meta:globalwamid.HBgxxx';
    await ds.query(`
      INSERT INTO comm_webhooks_received (tenant_id, provider, event_type, payload, signature_valid, idempotency_key)
      VALUES (NULL, 'meta', 'messages.read', '{}'::jsonb, true, $1);
    `, [key]);
    await expect(
      ds.query(`
        INSERT INTO comm_webhooks_received (tenant_id, provider, event_type, payload, signature_valid, idempotency_key)
        VALUES (NULL, 'meta', 'messages.read', '{}'::jsonb, true, $1);
      `, [key]),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('MAJ processed_status apres traitement', async () => {
    const key = 'mailgun:msg-process-1';
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('mailgun', 'delivered', '{}'::jsonb, true, $1);
    `, [key]);
    await ds.query(`
      UPDATE comm_webhooks_received
      SET processed_status = 'success', processed_at = NOW()
      WHERE idempotency_key = $1;
    `, [key]);
    const rows: Array<{ processed_status: string; processed_at: Date | null }> = await ds.query(
      `SELECT processed_status, processed_at FROM comm_webhooks_received WHERE idempotency_key = $1;`,
      [key],
    );
    expect(rows[0]?.processed_status).toBe('success');
    expect(rows[0]?.processed_at).not.toBeNull();
  });

  it('retry pattern atomic : INSERT ON CONFLICT detect duplicate', async () => {
    const key = 'meta:retry-pattern';
    const insert = async (): Promise<Array<{ id: string }>> =>
      ds.query(`
        INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('meta', 'messages.delivered', '{"v":1}'::jsonb, true, $1)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id;
      `, [key]);
    const r1 = await insert();
    const r2 = await insert();
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(0);
  });
});
