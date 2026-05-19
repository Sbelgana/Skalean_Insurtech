/**
 * Seed reset -- TRUNCATE CASCADE toutes les tables seeds.
 * INTERDIT en production (NODE_ENV === 'production' => exit 1).
 * Ordre de truncate inverse des FK.
 * Aucune emoji (decision-006).
 */
import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';
import { pino } from 'pino';

const log = pino({ level: 'info' });

const TABLES = [
  'analytics_events',
  'audit_log',
  'comm_messages',
  'booking_rdv',
  'insure_polices',
  'insure_produits',
  'insure_assureurs',
  'deals',
  'contacts',
  'users',
  'tenants',
];

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    log.error('seed-reset is FORBIDDEN in production -- aborting');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env['DATABASE_HOST'] ?? 'localhost',
    port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
    database: process.env['DATABASE_NAME'] ?? 'skalean_dev',
    user: process.env['DATABASE_USER'] ?? 'seed_admin',
    password: process.env['DATABASE_PASSWORD'] ?? 'change-me',
  });

  const client: PoolClient = await pool.connect();
  try {
    log.info({ tables: TABLES }, 'Starting reset -- TRUNCATE CASCADE');
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security = off');
    const tablesList = TABLES.join(', ');
    await client.query(`TRUNCATE TABLE ${tablesList} RESTART IDENTITY CASCADE`);
    await client.query('COMMIT');
    log.info('Reset completed successfully');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    log.error({ err }, 'Reset failed -- transaction rolled back');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  log.error({ err }, 'Reset fatal error');
  process.exit(1);
});
