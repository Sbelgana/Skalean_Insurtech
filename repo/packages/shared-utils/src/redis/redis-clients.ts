/**
 * Skalean InsurTech v2.2 -- Redis client factory + singleton
 *
 * Wraps ioredis with :
 *   - 6 separate DBs strategy (cache, sessions, queues, locks, AI, rate limit)
 *   - Retry strategy : max 10 retries, exponential 100-2000ms
 *   - Reconnect on transient errors (READONLY, ETIMEDOUT, ECONNRESET)
 *   - Structured Pino logging (connect, error, close, reconnecting)
 *   - Lazy connect (no eager connection until first command)
 *   - Singleton per DB
 *
 * Reference :
 *   - 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.5)
 *   - decision-001 (monorepo) + decision-006 (no-emoji)
 *   - cache-strategy.md
 */

import { Redis, type RedisOptions } from 'ioredis';
import type { Logger } from 'pino';

// ============================================================================
// REDIS_DB constants -- 6 DBs separes par usage
// ============================================================================

export const REDIS_DB = Object.freeze({
  /** DB 0 -- JSON cache (police, contact, devis, facture). TTL 5-60 min. Sprint 8+. */
  CACHE: 0,
  /** DB 1 -- Sessions utilisateurs (refresh tokens, MFA, OTP). TTL 7-30 jours. Sprint 5. */
  SESSIONS: 1,
  /** DB 2 -- Backend BullMQ (jobs async : WhatsApp, PDF, ETL, MCP). Sprint 9. */
  QUEUES: 2,
  /** DB 3 -- Redlock distributed locks (operations critiques). TTL 30s-5min. Sprint 11. */
  LOCKS: 3,
  /** DB 4 -- Cache reponses Skalean AI (estimation IA). TTL 1h-24h. Sprint 29. */
  AI_CACHE: 4,
  /** DB 5 -- Rate limit sliding window (login, API, MCP). TTL 1min-1h. Sprint 33. */
  RATE_LIMIT: 5,
} as const);

export type RedisDbNumber = (typeof REDIS_DB)[keyof typeof REDIS_DB];

// ============================================================================
// Types
// ============================================================================

export interface CreateRedisClientOpts {
  /** Redis URL : redis://[user:password@]host:port */
  url: string;
  /** DB number (0-15). Use REDIS_DB constants. */
  db: number;
  /** Optional logger Pino instance (pour structured logs events). */
  logger?: Logger;
  /** Optional key prefix (auto-prefix toutes les keys). Useful for sub-namespacing. */
  keyPrefix?: string;
  /** Optional connection name (visible dans Redis CLIENT LIST). Default 'skalean-{db}'. */
  connectionName?: string;
  /** Lazy connect (default true). False = connect immediately. */
  lazyConnect?: boolean;
  /** Override retry strategy (defaults : max 10, exponential 100-2000ms). */
  maxRetriesPerRequest?: number | null;
}

// ============================================================================
// Singleton storage
// ============================================================================

const clients = new Map<number, Redis>();

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new Redis client (NOT cached). Use for tests or specific use cases.
 * For singleton usage, prefer getRedisClient(db).
 */
export function createRedisClient(opts: CreateRedisClientOpts): Redis {
  const {
    url,
    db,
    logger,
    keyPrefix,
    connectionName,
    lazyConnect = true,
    maxRetriesPerRequest = 10,
  } = opts;

  // Defensive validation
  if (typeof db !== 'number' || db < 0 || db >= 16) {
    throw new Error(`Redis DB must be 0..15, got ${db}`);
  }

  if (!url || (!url.startsWith('redis://') && !url.startsWith('rediss://'))) {
    throw new Error(`Redis URL must start with redis:// or rediss://, got ${url}`);
  }

  const ioRedisOpts: RedisOptions = {
    db,
    connectionName: connectionName ?? `skalean-${db}`,
    lazyConnect,
    ...(keyPrefix !== undefined ? { keyPrefix } : {}),
    maxRetriesPerRequest,
    enableReadyCheck: true,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    enableOfflineQueue: true,

    // Retry strategy : exponential 100-2000ms, max 10 retries
    retryStrategy: (times) => {
      if (times > 10) {
        logger?.error(
          { db, times, action: 'redis_retry_exhausted' },
          'Redis retry exhausted after 10 attempts',
        );
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 2000);
      logger?.warn(
        { db, times, delay_ms: delay, action: 'redis_retry' },
        `Redis retry attempt ${times} in ${delay}ms`,
      );
      return delay;
    },

    // Reconnect on transient errors (READONLY, ETIMEDOUT, ECONNRESET)
    reconnectOnError: (err) => {
      const message = err.message ?? '';
      const shouldReconnect = /READONLY|ETIMEDOUT|ECONNRESET|EPIPE|MOVED|ASK/i.test(message);
      if (shouldReconnect) {
        logger?.warn(
          { db, error: message, action: 'redis_reconnect_on_error' },
          'Redis reconnecting due to transient error',
        );
      }
      return shouldReconnect;
    },
  };

  const client = new Redis(url, ioRedisOpts);

  // Structured logging on events
  if (logger) {
    client.on('connect', () => {
      logger.info(
        { db, connection_name: ioRedisOpts.connectionName, action: 'redis_connect' },
        `Redis connected (db=${db})`,
      );
    });

    client.on('ready', () => {
      logger.info({ db, action: 'redis_ready' }, `Redis ready (db=${db})`);
    });

    client.on('error', (err: Error) => {
      const sanitizedUrl = sanitizeRedisUrl(url);
      logger.error(
        {
          db,
          error: err.message,
          code: (err as { code?: string }).code,
          url: sanitizedUrl,
          action: 'redis_error',
        },
        `Redis error (db=${db}): ${err.message}`,
      );
    });

    client.on('close', () => {
      logger.warn({ db, action: 'redis_close' }, `Redis connection closed (db=${db})`);
    });

    client.on('reconnecting', (delayMs: number) => {
      logger.warn(
        { db, delay_ms: delayMs, action: 'redis_reconnecting' },
        `Redis reconnecting in ${delayMs}ms (db=${db})`,
      );
    });

    client.on('end', () => {
      logger.info({ db, action: 'redis_end' }, `Redis connection ended (db=${db})`);
    });
  }

  return client;
}

/**
 * Get singleton Redis client for a given DB. Creates lazily on first call.
 * Subsequent calls with the same DB return the same instance.
 */
export function getRedisClient(
  db: number,
  opts?: Omit<CreateRedisClientOpts, 'db' | 'url'>,
): Redis {
  const existing = clients.get(db);
  if (existing) return existing;

  const url = process.env['REDIS_URL'];
  if (!url) {
    throw new Error(
      'REDIS_URL environment variable is required. Did you load env via shared-config?',
    );
  }

  const client = createRedisClient({
    url,
    db,
    ...opts,
  });

  clients.set(db, client);
  return client;
}

/**
 * Close all singleton Redis clients gracefully.
 * Drains pending commands then closes connections.
 * Should be called during application shutdown.
 */
export async function closeAllRedisClients(): Promise<void> {
  const entries = [...clients.entries()];
  const closingPromises = entries.map(([db, client]) =>
    client
      .quit()
      .then(() => undefined as void)
      .catch(() => {
        client.disconnect(false);
      })
      .finally(() => {
        clients.delete(db);
      }),
  );
  await Promise.allSettled(closingPromises);
}

/**
 * Reset singleton state (for tests). NOT for production use.
 */
export function _resetRedisClientsForTests(): void {
  for (const [, client] of clients.entries()) {
    client.disconnect(false);
  }
  clients.clear();
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sanitize Redis URL by removing password.
 * redis://user:secret@host:port -> redis://user:***@host:port
 */
export function sanitizeRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '<invalid-url>';
  }
}
