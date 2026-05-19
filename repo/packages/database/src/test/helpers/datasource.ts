import 'reflect-metadata';
import { DataSource, type DataSourceOptions, type QueryRunner } from 'typeorm';
import { systemEntities } from '../../entities/system/index.js';
import { InitialSystem1735000000001 } from '../../migrations/1735000000001-InitialSystem.js';

export interface TestDataSourceOptions {
  migrationsRun?: boolean;
}

const baseOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env['TEST_DATABASE_HOST'] ?? process.env['DATABASE_HOST'] ?? 'localhost',
  port: Number(process.env['TEST_DATABASE_PORT'] ?? process.env['DATABASE_PORT'] ?? 5432),
  username: process.env['TEST_DATABASE_USER'] ?? process.env['DATABASE_USER'] ?? 'skalean',
  password: process.env['TEST_DATABASE_PASSWORD'] ?? process.env['DATABASE_PASSWORD'] ?? 'skalean_dev_only',
  database: process.env['TEST_DATABASE_NAME'] ?? process.env['DATABASE_NAME'] ?? 'skalean_insurtech',
  entities: [...systemEntities],
  migrations: [InitialSystem1735000000001],
  migrationsRun: false,
  synchronize: false,
  logging: process.env['TEST_DATABASE_LOG'] === 'true',
  extra: {
    statement_timeout: 30000,
    application_name: 'skalean-database-test',
  },
});

export async function createTestDataSource(opts: TestDataSourceOptions = {}): Promise<DataSource> {
  const ds = new DataSource(baseOptions());
  await ds.initialize();

  if (opts.migrationsRun) {
    await ds.runMigrations();
  }

  return ds;
}

export async function dropAllTables(ds: DataSource): Promise<void> {
  await ds.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
          AND tablename NOT IN ('typeorm_migrations')
      ) LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', r.tablename);
      END LOOP;
      FOR r IN (
        SELECT typname FROM pg_type
        WHERE typcategory = 'E'
          AND typnamespace = 'public'::regnamespace
      ) LOOP
        EXECUTE format('DROP TYPE IF EXISTS %I CASCADE;', r.typname);
      END LOOP;
    END$$;
  `);
  await ds.query(`DELETE FROM typeorm_migrations WHERE 1 = 1;`).catch(() => undefined);
}

export async function withRlsContext<T>(
  ds: DataSource,
  tenantId: string | null,
  isSuperAdmin: boolean,
  fn: (qr: QueryRunner) => Promise<T>,
): Promise<T> {
  const qr = ds.createQueryRunner();
  try {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
    return await fn(qr);
  } finally {
    await qr.release();
  }
}
