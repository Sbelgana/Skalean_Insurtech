import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// Set required env vars before data-source module loads (hoisted execution)
vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
  process.env['DATABASE_URL'] ??= 'postgresql://skalean:skalean_dev_only@localhost:5432/skalean_insurtech';
  process.env['REDIS_URL'] ??= 'redis://localhost:6379';
  process.env['KAFKA_BROKERS'] ??= 'localhost:9094';
  process.env['S3_ACCESS_KEY_ID'] ??= 'skalean1';
  process.env['S3_SECRET_ACCESS_KEY'] ??= 'skalean_minio_dev_only';
  process.env['JWT_SECRET'] ??= 'dev-only-jwt-secret-min32-chars!';
  process.env['JWT_REFRESH_SECRET'] ??= 'dev-only-refresh-secret-min-32ch';
  process.env['MFA_SECRET_ENCRYPTION_KEY'] ??= 'dev-mfa-encryption-key-min-32chr';
  process.env['PASSWORD_PEPPER'] ??= 'dev-pepper-16chr';
});

import { AppDataSource, initDataSource, closeDataSource } from './data-source.js';

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

describe.skipIf(SKIP)('AppDataSource integration -- Tache 1.1.9', () => {
  beforeAll(async () => {
    await initDataSource();
  });

  afterAll(async () => {
    await closeDataSource();
  });

  it('should be initialized', () => {
    expect(AppDataSource.isInitialized).toBe(true);
  });

  it('should query SELECT 1', async () => {
    const result = await AppDataSource.query('SELECT 1 AS one') as Array<{ one: number }>;
    expect(result).toEqual([{ one: 1 }]);
  });

  it('app_current_tenant() returns NULL outside session', async () => {
    const result = await AppDataSource.query('SELECT app_current_tenant() AS t') as Array<{ t: string | null }>;
    expect(result[0]?.t).toBeNull();
  });

  it('SET LOCAL works in transaction', async () => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tenantUuid = '11111111-1111-4111-8111-111111111111';
      await queryRunner.query(`SET LOCAL app.current_tenant_id = '${tenantUuid}'`);
      const result = await queryRunner.query('SELECT app_current_tenant() AS t') as Array<{ t: string }>;
      expect(result[0]?.t).toBe(tenantUuid);
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  });

  it('synchronize is false', () => {
    expect(AppDataSource.options.synchronize).toBe(false);
  });

  it('statement_timeout configured', async () => {
    const result = await AppDataSource.query('SHOW statement_timeout') as Array<{ statement_timeout: string }>;
    expect(result[0]?.statement_timeout).toBe('1min');
  });

  it('application_name visible', async () => {
    const result = await AppDataSource.query(
      'SELECT application_name FROM pg_stat_activity WHERE pid = pg_backend_pid()',
    ) as Array<{ application_name: string }>;
    expect(result[0]?.application_name).toMatch(/skalean-insurtech-/);
  });

  it('migrations table customisee', () => {
    const tableName = AppDataSource.options.migrationsTableName;
    expect(tableName).toBe('typeorm_migrations');
  });

  it('idempotent initDataSource', async () => {
    const ds1 = await initDataSource();
    const ds2 = await initDataSource();
    expect(ds1).toBe(ds2);
  });
});
