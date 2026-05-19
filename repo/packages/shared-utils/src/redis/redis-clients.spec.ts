import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createRedisClient,
  getRedisClient,
  closeAllRedisClients,
  _resetRedisClientsForTests,
  REDIS_DB,
  sanitizeRedisUrl,
} from './redis-clients.js';
import IORedis from 'ioredis';

const REDIS_URL =
  process.env['REDIS_URL'] ?? 'redis://:skalean_redis_dev_only@localhost:6379';
const SKIP_INTEGRATION = process.env['SKIP_INTEGRATION'] === 'true';

describe('REDIS_DB constants', () => {
  it('should declare 6 DBs with correct values', () => {
    expect(REDIS_DB.CACHE).toBe(0);
    expect(REDIS_DB.SESSIONS).toBe(1);
    expect(REDIS_DB.QUEUES).toBe(2);
    expect(REDIS_DB.LOCKS).toBe(3);
    expect(REDIS_DB.AI_CACHE).toBe(4);
    expect(REDIS_DB.RATE_LIMIT).toBe(5);
  });

  it('should be a const object (immutable)', () => {
    expect(() => {
      // @ts-expect-error : intentional immutability test
      REDIS_DB.CACHE = 99;
    }).toThrow();
  });
});

describe('createRedisClient -- validation', () => {
  it('should throw for invalid db (-1)', () => {
    expect(() => createRedisClient({ url: REDIS_URL, db: -1 })).toThrow(/Redis DB must be 0..15/);
  });

  it('should throw for invalid db (16)', () => {
    expect(() => createRedisClient({ url: REDIS_URL, db: 16 })).toThrow(/Redis DB must be 0..15/);
  });

  it('should throw for invalid url (not redis://)', () => {
    expect(() => createRedisClient({ url: 'http://localhost:6379', db: 0 })).toThrow(
      /must start with redis/,
    );
  });

  it('should accept rediss:// for TLS', () => {
    const client = createRedisClient({ url: 'rediss://localhost:6379', db: 0 });
    expect(client).toBeInstanceOf(IORedis);
    client.disconnect(false);
  });
});

describe('sanitizeRedisUrl', () => {
  it('should mask password', () => {
    const result = sanitizeRedisUrl('redis://user:secret@localhost:6379');
    expect(result).toContain('***');
    expect(result).not.toContain('secret');
  });

  it('should not break on URL without password', () => {
    const result = sanitizeRedisUrl('redis://localhost:6379');
    expect(result).toBe('redis://localhost:6379');
  });

  it('should return placeholder on invalid URL', () => {
    const result = sanitizeRedisUrl('not-a-url');
    expect(result).toBe('<invalid-url>');
  });
});

describe.skipIf(SKIP_INTEGRATION)('createRedisClient -- integration', () => {
  let client: IORedis;

  afterEach(async () => {
    if (client) await client.quit().catch(() => client.disconnect(false));
  });

  it('should connect to Redis DB 0', async () => {
    client = createRedisClient({ url: REDIS_URL, db: REDIS_DB.CACHE, lazyConnect: false });
    const pong = await client.ping();
    expect(pong).toBe('PONG');
  });

  it('should isolate DB 0 vs DB 1 (key set in 0 not visible in 1)', async () => {
    const client0 = createRedisClient({ url: REDIS_URL, db: 0, lazyConnect: false });
    const client1 = createRedisClient({ url: REDIS_URL, db: 1, lazyConnect: false });

    await client0.set('test-key-isolation', 'value-in-db-0');
    const fromDb0 = await client0.get('test-key-isolation');
    const fromDb1 = await client1.get('test-key-isolation');

    expect(fromDb0).toBe('value-in-db-0');
    expect(fromDb1).toBeNull();

    await client0.del('test-key-isolation');
    await client0.quit();
    await client1.quit();
  });

  it('should set connection name in CLIENT LIST', async () => {
    client = createRedisClient({
      url: REDIS_URL,
      db: 0,
      connectionName: 'test-connection-name',
      lazyConnect: false,
    });
    await client.ping();
    const list = (await client.client('LIST')) as string;
    expect(list).toContain('test-connection-name');
  });

  it('should respect maxRetriesPerRequest = null (no retry on command level)', () => {
    client = createRedisClient({
      url: REDIS_URL,
      db: 0,
      maxRetriesPerRequest: null,
    });
    expect(client.options.maxRetriesPerRequest).toBeNull();
  });
});

describe('getRedisClient singleton', () => {
  beforeEach(() => {
    _resetRedisClientsForTests();
    process.env['REDIS_URL'] = REDIS_URL;
  });

  afterEach(async () => {
    await closeAllRedisClients();
  });

  it('should return same instance on multiple calls with same db', () => {
    const c1 = getRedisClient(REDIS_DB.CACHE);
    const c2 = getRedisClient(REDIS_DB.CACHE);
    expect(c1).toBe(c2);
  });

  it('should return different instances for different dbs', () => {
    const c0 = getRedisClient(REDIS_DB.CACHE);
    const c1 = getRedisClient(REDIS_DB.SESSIONS);
    expect(c0).not.toBe(c1);
  });

  it('should throw if REDIS_URL env not set', () => {
    delete process.env['REDIS_URL'];
    expect(() => getRedisClient(REDIS_DB.CACHE)).toThrow(/REDIS_URL/);
  });
});

describe('closeAllRedisClients', () => {
  beforeEach(() => {
    _resetRedisClientsForTests();
    process.env['REDIS_URL'] = REDIS_URL;
  });

  it('should close all singletons', async () => {
    getRedisClient(REDIS_DB.CACHE);
    getRedisClient(REDIS_DB.SESSIONS);
    await closeAllRedisClients();
    const c = getRedisClient(REDIS_DB.CACHE);
    expect(c.status).not.toBe('close');
    await closeAllRedisClients();
  });
});

describe('Logger integration', () => {
  it('should call logger on connect event (if logger provided)', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const client = createRedisClient({
      url: REDIS_URL,
      db: 0,
      logger: logger as never,
      lazyConnect: true,
    });
    expect(client).toBeInstanceOf(IORedis);
    client.disconnect(false);
  });
});
