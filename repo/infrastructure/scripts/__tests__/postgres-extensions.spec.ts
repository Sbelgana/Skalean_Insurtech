import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const POSTGRES_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech';
const POSTGRES_TEST_URL =
  process.env['DATABASE_TEST_URL'] ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech_test';

const SKIP_INTEGRATION = process.env['SKIP_INTEGRATION'] === 'true';

const REQUIRED_EXTENSIONS = ['pgcrypto', 'pg_trgm', 'btree_gist', 'unaccent', 'citext'];

describe.skipIf(SKIP_INTEGRATION)('Postgres extensions -- Tache 1.1.4', () => {
  describe('Database skalean_insurtech', () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: POSTGRES_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    it.each(REQUIRED_EXTENSIONS)('should have extension %s installed', async (ext) => {
      const result = await client.query(
        'SELECT extname FROM pg_extension WHERE extname = $1',
        [ext],
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].extname).toBe(ext);
    });

    it('should generate UUID v4 via pgcrypto', async () => {
      const result = await client.query('SELECT gen_random_uuid() AS uuid');
      const uuid = result.rows[0].uuid as string;
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('should support trigram similarity via pg_trgm', async () => {
      const result = await client.query(`SELECT similarity('Mohammed', 'Mohamed') AS sim`);
      const sim = result.rows[0].sim as number;
      expect(sim).toBeGreaterThan(0.5);
      expect(sim).toBeLessThan(1.0);
    });

    it('should support EXCLUDE constraint with btree_gist', async () => {
      await client.query(`
        CREATE TEMP TABLE test_btree_gist_temp (
          id uuid,
          range tsrange,
          EXCLUDE USING gist (id WITH =, range WITH &&)
        )
      `);
      await client.query(`DROP TABLE test_btree_gist_temp`);
    });

    it('should remove accents via unaccent', async () => {
      const result = await client.query(`SELECT unaccent('etre forcement') AS clean`);
      expect(result.rows[0].clean).toBe('etre forcement');
    });

    it('should be case-insensitive via citext', async () => {
      await client.query(`
        CREATE TEMP TABLE test_citext_temp (email citext);
        INSERT INTO test_citext_temp VALUES ('test@example.com');
      `);
      const result = await client.query(`
        SELECT * FROM test_citext_temp WHERE email = 'TEST@EXAMPLE.COM'
      `);
      expect(result.rowCount).toBe(1);
      await client.query(`DROP TABLE test_citext_temp`);
    });
  });

  describe('Database skalean_insurtech_test (parallel testing)', () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: POSTGRES_TEST_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    it.each(REQUIRED_EXTENSIONS)('test DB should have extension %s', async (ext) => {
      const result = await client.query(
        'SELECT extname FROM pg_extension WHERE extname = $1',
        [ext],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  describe('Database list', () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: POSTGRES_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    it('should have skalean_insurtech database', async () => {
      const result = await client.query(
        `SELECT datname FROM pg_database WHERE datname = 'skalean_insurtech'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have skalean_insurtech_test database', async () => {
      const result = await client.query(
        `SELECT datname FROM pg_database WHERE datname = 'skalean_insurtech_test'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have schema n8n', async () => {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'n8n'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have schema audit (Sprint 12 ready)', async () => {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'audit'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have schema reporting (Sprint 13 ready)', async () => {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'reporting'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
