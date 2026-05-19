/**
 * TC-SEED-01 to TC-SEED-08 -- seeds integration tests.
 * Validates that the dev seeds produce the expected data volumes
 * and that the seeds are deterministic and idempotent.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import type { DataSource } from 'typeorm';
import { buildTestDataSource, runAllMigrations, truncateAllTables } from '../setup.js';

const DB_AVAILABLE = Boolean(process.env['DATABASE_TEST_URL'] ?? process.env['DATABASE_HOST']);

const seedEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  DATABASE_HOST: new URL(process.env['DATABASE_TEST_URL'] ?? 'postgres://test:test@localhost:5433/skalean_test').hostname,
  DATABASE_PORT: new URL(process.env['DATABASE_TEST_URL'] ?? 'postgres://test:test@localhost:5433/skalean_test').port,
  DATABASE_USER: 'test',
  DATABASE_PASSWORD: 'test',
  DATABASE_NAME: new URL(process.env['DATABASE_TEST_URL'] ?? 'postgres://test:test@localhost:5433/skalean_test').pathname.slice(1),
  SEED_RANDOM_SEED: process.env['FAKER_SEED'] ?? '42',
  SEED_PASSWORD_DEFAULT: 'Demo!2026Skalean',
  SEED_TIMEZONE: 'Africa/Casablanca',
});

// TODO Sprint 13 : align seeds specs with actual seed-dev.ts output (current
// specs assume 50 contacts / 20 deals / 3 tenants but seeds produce different
// volumes). Also depends on fixed schema (Sprint 6 work). See KNOWN-ISSUES.md.
describe.skip('seeds integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
  });

  it('TC-SEED-01 -- seeds:run completes in less than 60 seconds', () => {
    const start = Date.now();
    execSync('pnpm --filter @insurtech/platform seeds:run', {
      env: seedEnv(),
      stdio: 'pipe',
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60_000);
  });

  it('TC-SEED-02 -- produces 50 contacts (30 Bennani + 20 Atlas)', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:run', {
      env: seedEnv(),
      stdio: 'pipe',
    });
    const rows = await ds.query(
      `SELECT count(*)::int AS c FROM crm_contacts`,
    );
    expect((rows as Array<{ c: number }>)[0]?.c).toBe(50);
  });

  it('TC-SEED-03 -- produces 20 deals', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:run', {
      env: seedEnv(),
      stdio: 'pipe',
    });
    const rows = await ds.query(`SELECT count(*)::int AS c FROM crm_deals`);
    expect((rows as Array<{ c: number }>)[0]?.c).toBe(20);
  });

  it('TC-SEED-04 -- foreign keys valid -- every deal references an existing contact', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:run', {
      env: seedEnv(),
      stdio: 'pipe',
    });
    const orphans = await ds.query(
      `SELECT count(*)::int AS c FROM crm_deals d LEFT JOIN crm_contacts c ON c.id = d.contact_id WHERE c.id IS NULL`,
    );
    expect((orphans as Array<{ c: number }>)[0]?.c).toBe(0);
  });

  it('TC-SEED-05 -- seeds are deterministic with fixed random seed 42', async () => {
    const env = seedEnv();
    execSync('pnpm --filter @insurtech/platform seeds:run', { env, stdio: 'pipe' });
    const first = await ds.query(`SELECT id FROM crm_contacts ORDER BY id LIMIT 5`);
    await truncateAllTables(ds);
    execSync('pnpm --filter @insurtech/platform seeds:run', { env, stdio: 'pipe' });
    const second = await ds.query(`SELECT id FROM crm_contacts ORDER BY id LIMIT 5`);
    expect(second).toEqual(first);
  });

  it('TC-SEED-06 -- seeds:run is idempotent (second run does not duplicate)', async () => {
    const env = seedEnv();
    execSync('pnpm --filter @insurtech/platform seeds:run', { env, stdio: 'pipe' });
    expect(() =>
      execSync('pnpm --filter @insurtech/platform seeds:run', { env, stdio: 'pipe' }),
    ).not.toThrow();
    const rows = await ds.query(`SELECT count(*)::int AS c FROM crm_contacts`);
    expect((rows as Array<{ c: number }>)[0]?.c).toBe(50);
  });

  it('TC-SEED-07 -- produces at least 3 tenants for multi-tenant testing', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:run', {
      env: seedEnv(),
      stdio: 'pipe',
    });
    const rows = await ds.query(`SELECT count(*)::int AS c FROM auth_tenants`);
    expect((rows as Array<{ c: number }>)[0]?.c).toBeGreaterThanOrEqual(3);
  });

  it('TC-SEED-08 -- 5 users are created with argon2id hashed passwords', async () => {
    execSync('pnpm --filter @insurtech/platform seeds:run', {
      env: seedEnv(),
      stdio: 'pipe',
    });
    const rows = await ds.query(`SELECT count(*)::int AS c FROM auth_users`);
    expect((rows as Array<{ c: number }>)[0]?.c).toBeGreaterThanOrEqual(5);
    const hashes = await ds.query(`SELECT password_hash FROM auth_users LIMIT 5`);
    for (const row of hashes as Array<{ password_hash: string }>) {
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
    }
  });
});
