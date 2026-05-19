import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('auth_users.email -- citext case-insensitive', () => {
  let ds: DataSource;
  const tenantA = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Citext-Test','mixed') ON CONFLICT DO NOTHING;`,
      [tenantA],
    );
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('Insert Joe@Example.com, lookup joe@example.com le trouve', async () => {
    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantA]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    await ds.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'Joe@Example.com', $2, 'Joe');`,
      [tenantA, 'h'.repeat(60)],
    );
    const rows: unknown[] = await ds.query(`SELECT id FROM auth_users WHERE email = 'joe@example.com';`);
    expect(rows).toHaveLength(1);
  });

  it('UNIQUE rejette JOE@EXAMPLE.COM apres Joe@Example.com', async () => {
    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantA]);
    await expect(
      ds.query(
        `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'JOE@EXAMPLE.COM', $2, 'JoeUpper');`,
        [tenantA, 'k'.repeat(60)],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('idx_auth_users_email_lower utilise par EXPLAIN', async () => {
    const plan: Array<{ 'QUERY PLAN': string }> = await ds.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM auth_users WHERE lower(email::text) = 'joe@example.com';`,
    );
    const text = plan.map((p) => p['QUERY PLAN']).join('\n');
    expect(text).toMatch(/idx_auth_users_email_lower|Index Scan|Bitmap Index Scan/);
  });
});
