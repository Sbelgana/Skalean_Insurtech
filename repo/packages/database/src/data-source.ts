/**
 * Skalean InsurTech v2.2 -- TypeORM 0.3 DataSource singleton
 *
 * Reference :
 *   - Tache 1.1.9
 *   - decision-003 (TypeORM vs Prisma)
 *   - decision-002 (multi-tenant -- helpers RLS testees)
 *   - decision-006 (no-emoji)
 */

import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { loadEnv } from '@insurtech/shared-config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = loadEnv();
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.DATABASE_URL,
  // synchronize STRICT : never auto-create schema
  synchronize: false,
  // logging configurable via env
  logging: env.DATABASE_LOG ? ['query', 'error', 'schema'] : ['error', 'schema'],
  logger: 'simple-console',
  // Pool config
  poolSize: env.DATABASE_POOL_MAX,
  extra: {
    max: env.DATABASE_POOL_MAX,
    min: env.DATABASE_POOL_MIN,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // statement_timeout 60s ABSOLU
    statement_timeout: 60000,
    // application_name visible dans pg_stat_activity
    application_name: `skalean-insurtech-${env.NODE_ENV}`,
  },
  // SSL prod only
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  // Paths entities/migrations/subscribers
  entities: [resolve(__dirname, 'entities/**/*.{ts,js}')],
  migrations: [resolve(__dirname, 'migrations/**/*.{ts,js}')],
  subscribers: [resolve(__dirname, 'subscribers/**/*.{ts,js}')],
  // Migration table customisee
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
  cache: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);

let initPromise: Promise<DataSource> | null = null;

export async function initDataSource(): Promise<DataSource> {
  if (AppDataSource.isInitialized) return AppDataSource;
  if (initPromise) return initPromise;

  initPromise = AppDataSource.initialize().catch((err: unknown) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  initPromise = null;
}

export async function _resetDataSourceForTests(): Promise<void> {
  await closeDataSource();
}
