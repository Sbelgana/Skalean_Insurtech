/**
 * Shared test setup helpers for integration tests.
 * Aucune emoji (decision-006).
 */
import 'reflect-metadata';
import { DataSource, type EntityManager } from 'typeorm';
import { Kafka, type Admin } from 'kafkajs';
import Redis from 'ioredis';
import { createTestDataSource } from '../src/test/helpers/datasource.js';

export { createTestDataSource };

const logLevel = process.env['TEST_LOG_LEVEL'] ?? 'error';
const logger = {
  info: (...args: unknown[]) => logLevel === 'info' && console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => logLevel === 'debug' && console.debug(...args),
};

export const TENANT_A_ID = '00000000-0000-0000-0000-00000000000a';
export const TENANT_B_ID = '00000000-0000-0000-0000-00000000000b';
export const TENANT_C_ID = '00000000-0000-0000-0000-00000000000c';

/**
 * All tenanted tables in topological order (leaves first).
 * Used for TRUNCATE CASCADE in beforeEach.
 */
export const TENANTED_TABLES_ORDERED: ReadonlyArray<string> = [
  'doc_access_logs',
  'doc_document_versions',
  'doc_documents',
  'pay_reconciliations',
  'pay_transactions',
  'pay_methods',
  'comm_webhooks_received',
  'comm_optouts',
  'comm_messages',
  'comm_templates',
  'booking_appointments',
  'booking_calendar_syncs',
  'booking_rooms',
  'crm_interactions',
  'crm_deals',
  'crm_contacts',
  'crm_companies',
  'compliance_consent_logs',
  'compliance_data_retention_policies',
  'compliance_acaps_reports',
  'books_invoice_lines',
  'books_invoices',
  'books_accounts',
  'analytics_events',
  'stock_movements',
  'stock_items',
  'hr_attendances',
  'hr_employees',
  'audit_log',
  'auth_sessions',
  'auth_tenant_users',
  'auth_users',
  'auth_tenants',
];

export async function buildTestDataSource(): Promise<DataSource> {
  const url = process.env['DATABASE_TEST_URL'];
  if (url) {
    process.env['DATABASE_URL'] = url;
  }
  return createTestDataSource({ migrationsRun: false });
}

export async function runAllMigrations(ds: DataSource): Promise<void> {
  await ds.runMigrations({ transaction: 'each' });
}

export async function revertAllMigrations(ds: DataSource): Promise<void> {
  const { dropAllTables } = await import('../src/test/helpers/datasource.js');
  await dropAllTables(ds);
}

export async function truncateAllTables(ds: DataSource): Promise<void> {
  const tables = [...TENANTED_TABLES_ORDERED];
  const quoted = tables.map((t) => `"${t}"`).join(', ');
  try {
    await ds.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  } catch {
    // Some tables may not exist yet -- ignore
  }
}

export async function withTenant<T>(
  ds: DataSource,
  tenantId: string,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return ds.transaction(async (em) => {
    await em.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await em.query(`SELECT set_config('app.is_super_admin', 'false', true)`);
    return fn(em);
  });
}

export async function withSuperAdmin<T>(
  ds: DataSource,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return ds.transaction(async (em) => {
    await em.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    await em.query(`SELECT set_config('app.current_tenant_id', NULL, true)`);
    return fn(em);
  });
}

export async function withoutTenant<T>(
  ds: DataSource,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return ds.transaction(async (em) => {
    await em.query(`SELECT set_config('app.current_tenant_id', '', true)`);
    await em.query(`SELECT set_config('app.is_super_admin', 'false', true)`);
    return fn(em);
  });
}

export async function ensureKafkaTopics(brokers: string[], topics: string[]): Promise<void> {
  const kafka = new Kafka({ clientId: 'test-admin', brokers });
  const admin: Admin = kafka.admin();
  await admin.connect();
  const existing = await admin.listTopics();
  const toCreate = topics.filter((t) => !existing.includes(t));
  if (toCreate.length > 0) {
    await admin.createTopics({
      waitForLeaders: true,
      topics: toCreate.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
    });
  }
  await admin.disconnect();
}

export async function deleteKafkaTopics(brokers: string[], topics: string[]): Promise<void> {
  const kafka = new Kafka({ clientId: 'test-admin', brokers });
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.deleteTopics({ topics });
  } catch {
    // topic may not exist
  }
  await admin.disconnect();
}

export async function flushRedis(url: string): Promise<void> {
  const r = new Redis(url);
  await r.flushdb();
  await r.quit();
}

export async function waitFor<T>(
  predicate: () => Promise<T | undefined | null | false>,
  timeoutMs = 30_000,
  intervalMs = 250,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await predicate();
    if (result) return result as T;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs} ms`);
}

export { logger };
