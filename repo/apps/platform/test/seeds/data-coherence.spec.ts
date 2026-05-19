/**
 * Tests coherence donnees seeds -- requiert DATABASE_HOST dans l'environnement.
 * Skip gracieusement si pas de DB disponible.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
const { Pool } = pg;

const DB_AVAILABLE = Boolean(process.env['DATABASE_HOST']);

describe.skipIf(!DB_AVAILABLE)('Seeds data coherence (integration)', () => {
  let pool: InstanceType<typeof Pool>;

  beforeAll(() => {
    pool = new Pool({
      host: process.env['DATABASE_HOST'],
      port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
      database: process.env['DATABASE_NAME'],
      user: process.env['DATABASE_USER'],
      password: process.env['DATABASE_PASSWORD'],
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('FK valid : every deal has a contact in same tenant', async () => {
    const r = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM deals d
      LEFT JOIN contacts c ON c.id = d.contact_id AND c.tenant_id = d.tenant_id
      WHERE c.id IS NULL
    `);
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(0);
  });

  it('ICE unique per tenant', async () => {
    const r = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT tenant_id, ice FROM contacts
        WHERE ice IS NOT NULL
        GROUP BY tenant_id, ice
        HAVING COUNT(*) > 1
      ) dup
    `);
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(0);
  });

  it('CIN unique per tenant', async () => {
    const r = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT tenant_id, cin FROM contacts
        WHERE cin IS NOT NULL
        GROUP BY tenant_id, cin
        HAVING COUNT(*) > 1
      ) dup
    `);
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(0);
  });

  it('Polices linked to existing contacts', async () => {
    const r = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM insure_polices p
      LEFT JOIN contacts c ON c.id = p.contact_id
      WHERE c.id IS NULL
    `);
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(0);
  });

  it('Deals stage values are valid', async () => {
    const r = await pool.query<{ stage: string }>('SELECT DISTINCT stage FROM deals');
    const validStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    for (const row of r.rows) {
      expect(validStages).toContain(row.stage);
    }
  });

  it('Police dates coherent : end_at > start_at', async () => {
    const r = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM insure_polices WHERE end_at <= start_at
    `);
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(0);
  });
});
