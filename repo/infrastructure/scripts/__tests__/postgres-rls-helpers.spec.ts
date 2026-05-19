import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const POSTGRES_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech';
const SKIP_INTEGRATION = process.env['SKIP_INTEGRATION'] === 'true';

const SAMPLE_TENANT_UUID = '11111111-1111-4111-8111-111111111111';
const SAMPLE_USER_UUID = '22222222-2222-4222-8222-222222222222';
const SAMPLE_ASSURE_UUID = '33333333-3333-4333-8333-333333333333';
const OTHER_TENANT_UUID = '44444444-4444-4444-8444-444444444444';

describe.skipIf(SKIP_INTEGRATION)('RLS helpers SQL -- Tache 1.1.4', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: POSTGRES_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('Helpers exist (information_schema)', () => {
    const HELPERS = [
      'app_current_tenant',
      'app_current_user_id',
      'app_is_super_admin',
      'app_assure_user_id',
      'app_cross_tenant_authorization_id',
      'app_can_access_tenant',
    ];

    it.each(HELPERS)('helper %s should be defined', async (helperName) => {
      const result = await client.query(
        'SELECT routine_name FROM information_schema.routines WHERE routine_name = $1',
        [helperName],
      );
      expect(result.rowCount).toBeGreaterThanOrEqual(1);
    });

    it('all helpers should be STABLE PARALLEL SAFE', async () => {
      const result = await client.query(`
        SELECT proname, provolatile, proparallel
        FROM pg_proc
        WHERE proname LIKE 'app\\_%'
      `);
      for (const row of result.rows) {
        // 's' = STABLE, 'i' = IMMUTABLE
        expect(['s', 'i']).toContain(row.provolatile);
        // 's' = parallel safe
        expect(row.proparallel).toBe('s');
      }
    });
  });

  describe('app_current_tenant() outside session', () => {
    it('should return NULL outside SET LOCAL', async () => {
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBeNull();
    });
  });

  describe('app_current_tenant() inside transaction', () => {
    it('should return UUID set via SET LOCAL', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBe(SAMPLE_TENANT_UUID);
      await client.query('COMMIT');
    });

    it('should return NULL if SET LOCAL is empty string', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = ''`);
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBeNull();
      await client.query('COMMIT');
    });

    it('should isolate transactions (SET LOCAL scope)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      await client.query('COMMIT');

      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBeNull();
    });
  });

  describe('app_is_super_admin()', () => {
    it('should return false by default', async () => {
      const result = await client.query('SELECT app_is_super_admin() AS sa');
      expect(result.rows[0].sa).toBe(false);
    });

    it('should return true when SET LOCAL = true', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'true'`);
      const result = await client.query('SELECT app_is_super_admin() AS sa');
      expect(result.rows[0].sa).toBe(true);
      await client.query('COMMIT');
    });

    it('should return false when SET LOCAL = false', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'false'`);
      const result = await client.query('SELECT app_is_super_admin() AS sa');
      expect(result.rows[0].sa).toBe(false);
      await client.query('COMMIT');
    });
  });

  describe('app_current_user_id()', () => {
    it('should return UUID set in session', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_user_id = '${SAMPLE_USER_UUID}'`);
      const result = await client.query('SELECT app_current_user_id() AS u');
      expect(result.rows[0].u).toBe(SAMPLE_USER_UUID);
      await client.query('COMMIT');
    });

    it('should return NULL outside session', async () => {
      const result = await client.query('SELECT app_current_user_id() AS u');
      expect(result.rows[0].u).toBeNull();
    });
  });

  describe('app_assure_user_id()', () => {
    it('should return NULL by default (user not L3)', async () => {
      const result = await client.query('SELECT app_assure_user_id() AS a');
      expect(result.rows[0].a).toBeNull();
    });

    it('should return UUID when assure context set', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.assure_user_id = '${SAMPLE_ASSURE_UUID}'`);
      const result = await client.query('SELECT app_assure_user_id() AS a');
      expect(result.rows[0].a).toBe(SAMPLE_ASSURE_UUID);
      await client.query('COMMIT');
    });
  });

  describe('app_cross_tenant_authorization_id()', () => {
    it('should return NULL by default (no exception)', async () => {
      const result = await client.query('SELECT app_cross_tenant_authorization_id() AS x');
      expect(result.rows[0].x).toBeNull();
    });
  });

  describe('app_can_access_tenant() aggregation', () => {
    it('should return TRUE for super admin (any target)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'true'`);
      const result = await client.query(
        `SELECT app_can_access_tenant('${OTHER_TENANT_UUID}'::uuid) AS can`,
      );
      expect(result.rows[0].can).toBe(true);
      await client.query('COMMIT');
    });

    it('should return TRUE for same tenant', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      await client.query(`SET LOCAL app.is_super_admin = 'false'`);
      const result = await client.query(
        `SELECT app_can_access_tenant('${SAMPLE_TENANT_UUID}'::uuid) AS can`,
      );
      expect(result.rows[0].can).toBe(true);
      await client.query('COMMIT');
    });

    it('should return FALSE for different tenant (no auth)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      await client.query(`SET LOCAL app.is_super_admin = 'false'`);
      const result = await client.query(
        `SELECT app_can_access_tenant('${OTHER_TENANT_UUID}'::uuid) AS can`,
      );
      expect(result.rows[0].can).toBe(false);
      await client.query('COMMIT');
    });

    it('should return FALSE for NULL target (defensive)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'true'`);
      const result = await client.query('SELECT app_can_access_tenant(NULL) AS can');
      expect(result.rows[0].can).toBe(false);
      await client.query('COMMIT');
    });

    it('should return FALSE if no context set at all', async () => {
      const result = await client.query(
        `SELECT app_can_access_tenant('${SAMPLE_TENANT_UUID}'::uuid) AS can`,
      );
      expect(result.rows[0].can).toBe(false);
    });
  });

  describe('Helper documentation (COMMENT ON)', () => {
    const HELPERS = [
      'app_current_tenant',
      'app_current_user_id',
      'app_is_super_admin',
      'app_assure_user_id',
      'app_cross_tenant_authorization_id',
      'app_can_access_tenant',
    ];

    it.each(HELPERS)('helper %s should have COMMENT documentation', async (helperName) => {
      const result = await client.query(
        `
        SELECT obj_description(p.oid, 'pg_proc') AS description
        FROM pg_proc p
        WHERE p.proname = $1
      `,
        [helperName],
      );
      expect(result.rowCount).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].description).toBeTruthy();
      expect(result.rows[0].description).toContain('Skalean InsurTech');
    });
  });
});
