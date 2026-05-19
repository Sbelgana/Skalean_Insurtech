/**
 * Tests d'integration seeds -- requiert DATABASE_HOST dans l'environnement.
 * Skip gracieusement si pas de DB disponible.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import pg from 'pg';
const { Pool } = pg;

const DB_AVAILABLE = Boolean(process.env['DATABASE_HOST']);

describe.skipIf(!DB_AVAILABLE)('Seeds dev exhaustifs (integration)', () => {
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

  it('V1 : seeds:run completes in less than 30 seconds', () => {
    execSync('pnpm --filter @insurtech/platform seeds:reset', { stdio: 'inherit' });
    const start = Date.now();
    execSync('pnpm --filter @insurtech/platform seeds:run', { stdio: 'inherit' });
    const elapsed = (Date.now() - start) / 1000;
    expect(elapsed).toBeLessThan(30);
  }, 60000);

  it('V2 : 50 contacts created (30 Bennani + 20 Atlas)', async () => {
    const r = await pool.query<{ tenant_slug: string; cnt: string }>(`
      SELECT t.slug AS tenant_slug, COUNT(*) AS cnt
      FROM contacts c JOIN tenants t ON t.id = c.tenant_id
      WHERE t.slug IN ('bennani', 'atlas')
      GROUP BY t.slug
      ORDER BY t.slug
    `);
    const map = new Map(r.rows.map((row) => [row.tenant_slug, parseInt(row.cnt, 10)]));
    expect(map.get('atlas')).toBe(20);
    expect(map.get('bennani')).toBe(30);
  });

  it('V3 : 20 deals with mix of stages 5/5/5/5', async () => {
    const r = await pool.query<{ stage: string; cnt: string }>(`
      SELECT stage, COUNT(*) AS cnt FROM deals GROUP BY stage ORDER BY stage
    `);
    const map = new Map(r.rows.map((row) => [row.stage, parseInt(row.cnt, 10)]));
    expect(map.get('lead')).toBe(5);
    expect(map.get('qualified')).toBe(5);
    expect(map.get('proposal')).toBe(5);
    expect(map.get('won')).toBe(5);
  });

  it('V4 : 20 polices linked to Bennani tenant', async () => {
    const r = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*) AS cnt FROM insure_polices p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE t.slug = 'bennani'
    `);
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(20);
  });

  it('V5 : idempotent re-run does not duplicate contacts', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:run', { stdio: 'inherit' });
    const r = await pool.query<{ cnt: string }>('SELECT COUNT(*) AS cnt FROM contacts');
    expect(parseInt(r.rows[0]?.cnt ?? '0', 10)).toBe(50);
  }, 60000);

  it('V6 : reset cleans all tables then re-seeds', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:reset', { stdio: 'inherit' });
    const r1 = await pool.query<{ cnt: string }>('SELECT COUNT(*) AS cnt FROM contacts');
    expect(parseInt(r1.rows[0]?.cnt ?? '0', 10)).toBe(0);
    execSync('pnpm --filter @insurtech/platform seeds:run', { stdio: 'inherit' });
  }, 60000);

  it('V7 : ICE format 15 digits and unique across all contacts', async () => {
    const r = await pool.query<{ ice: string }>(
      'SELECT ice FROM contacts WHERE ice IS NOT NULL',
    );
    for (const row of r.rows) {
      expect(row.ice).toMatch(/^\d{15}$/);
    }
    const distinct = new Set(r.rows.map((row) => row.ice)).size;
    expect(distinct).toBe(r.rows.length);
  });

  it('V8 : performance benchmark seeds:dev < 35s', () => {
    const start = Date.now();
    execSync('pnpm --filter @insurtech/platform seeds:dev', { stdio: 'inherit' });
    const elapsed = (Date.now() - start) / 1000;
    expect(elapsed).toBeLessThan(35);
  }, 90000);
});
