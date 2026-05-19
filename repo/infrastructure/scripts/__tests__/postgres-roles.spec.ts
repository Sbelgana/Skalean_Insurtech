import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
const { Client } = pg;

const POSTGRES_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech';
const SKIP_INTEGRATION = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP_INTEGRATION)('Postgres roles applicatifs -- Tache 1.1.4', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: POSTGRES_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  const REQUIRED_ROLES = ['insurtech_app', 'insurtech_admin', 'insurtech_ro'];

  it.each(REQUIRED_ROLES)('role %s should exist', async (rolename) => {
    const result = await client.query(
      'SELECT rolname FROM pg_roles WHERE rolname = $1',
      [rolename],
    );
    expect(result.rowCount).toBe(1);
  });

  it('insurtech_app should be NOSUPERUSER', async () => {
    const result = await client.query(
      `SELECT rolsuper FROM pg_roles WHERE rolname = 'insurtech_app'`,
    );
    expect(result.rows[0].rolsuper).toBe(false);
  });

  it('insurtech_app should be NOREPLICATION', async () => {
    const result = await client.query(
      `SELECT rolreplication FROM pg_roles WHERE rolname = 'insurtech_app'`,
    );
    expect(result.rows[0].rolreplication).toBe(false);
  });

  it('insurtech_admin should have CREATEDB privilege', async () => {
    const result = await client.query(
      `SELECT rolcreatedb FROM pg_roles WHERE rolname = 'insurtech_admin'`,
    );
    expect(result.rows[0].rolcreatedb).toBe(true);
  });

  it('insurtech_app should have EXECUTE on app_current_tenant', async () => {
    const result = await client.query(`
      SELECT has_function_privilege('insurtech_app', 'app_current_tenant()', 'EXECUTE') AS has_priv
    `);
    expect(result.rows[0].has_priv).toBe(true);
  });

  it('insurtech_app should have EXECUTE on app_can_access_tenant', async () => {
    const result = await client.query(`
      SELECT has_function_privilege('insurtech_app', 'app_can_access_tenant(uuid)', 'EXECUTE') AS has_priv
    `);
    expect(result.rows[0].has_priv).toBe(true);
  });

  it('insurtech_ro should have EXECUTE on all helpers', async () => {
    const helpers = [
      'app_current_tenant()',
      'app_current_user_id()',
      'app_is_super_admin()',
      'app_assure_user_id()',
      'app_cross_tenant_authorization_id()',
      'app_can_access_tenant(uuid)',
    ];
    for (const helper of helpers) {
      const result = await client.query(
        `SELECT has_function_privilege('insurtech_ro', '${helper}', 'EXECUTE') AS has_priv`,
      );
      expect(result.rows[0].has_priv).toBe(true);
    }
  });
});
