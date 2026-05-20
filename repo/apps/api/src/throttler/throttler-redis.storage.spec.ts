/**
 * Tests ThrottlerRedisStorage -- sliding window via Redis sorted sets.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.13 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThrottlerRedisStorage } from './throttler-redis.storage';

// ---------------------------------------------------------------------------
// Mock Redis inline (simule ioredis multi pipeline)
// ---------------------------------------------------------------------------

/** Pipeline mock retourne par redis.multi(). */
function makeMockPipeline(zcountValue: number) {
  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcount: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],           // zremrangebyscore
      [null, 1],           // zadd
      [null, zcountValue], // zcount (totalHits)
      [null, 1],           // pexpire
    ]),
  };
  return pipeline;
}

/** Cree un mock Redis minimal avec pttl, multi, set, quit. */
function makeMockRedis(opts: {
  pttlValue?: number;
  zcountValue?: number;
} = {}) {
  const { pttlValue = -1, zcountValue = 1 } = opts;
  const pipeline = makeMockPipeline(zcountValue);
  const redis = {
    pttl: vi.fn().mockResolvedValue(pttlValue),
    multi: vi.fn().mockReturnValue(pipeline),
    set: vi.fn().mockResolvedValue('OK'),
    quit: vi.fn().mockResolvedValue('OK'),
    _pipeline: pipeline,
  };
  return redis;
}

type MockRedis = ReturnType<typeof makeMockRedis>;

describe('ThrottlerRedisStorage', () => {
  let redis: MockRedis;
  let storage: ThrottlerRedisStorage;

  beforeEach(() => {
    redis = makeMockRedis();
    // cast : on ne passe qu'un sous-ensemble de l'interface Redis (suffisant pour les tests)
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
  });

  // -------------------------------------------------------------------------
  // increment() -- cas normal (client non bloque)
  // -------------------------------------------------------------------------

  it('retourne totalHits = 1 pour la premiere requete (zcountValue = 1)', async () => {
    const result = await storage.increment('key1', 60, 100, 0, 'default');
    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
    expect(result.timeToBlockExpire).toBe(0);
  });

  it('retourne timeToExpire egal au ttl fourni', async () => {
    const result = await storage.increment('key1', 60, 100, 0, 'default');
    expect(result.timeToExpire).toBe(60);
  });

  it('appelle ZREMRANGEBYSCORE + ZADD + ZCOUNT + PEXPIRE dans le pipeline', async () => {
    await storage.increment('key1', 60, 100, 0, 'default');
    const pipe = redis._pipeline;
    expect(pipe.zremrangebyscore).toHaveBeenCalledTimes(1);
    expect(pipe.zadd).toHaveBeenCalledTimes(1);
    expect(pipe.zcount).toHaveBeenCalledTimes(1);
    expect(pipe.pexpire).toHaveBeenCalledTimes(1);
    expect(pipe.exec).toHaveBeenCalledTimes(1);
  });

  it('utilise le prefix "throttle:{throttlerName}:{key}" pour storeKey', async () => {
    await storage.increment('mykey', 60, 100, 0, 'api');
    const pipe = redis._pipeline;
    const storeKey = (pipe.zremrangebyscore.mock.calls[0] as string[])[0];
    expect(storeKey).toBe('throttle:api:mykey');
  });

  it('passe windowMs en ms a PEXPIRE (ttl=60 -> 60000ms)', async () => {
    await storage.increment('key1', 60, 100, 0, 'default');
    const pipe = redis._pipeline;
    const pexpireArgs = pipe.pexpire.mock.calls[0] as [string, number];
    expect(pexpireArgs[1]).toBe(60_000);
  });

  // -------------------------------------------------------------------------
  // increment() -- depassement limite SANS blockDuration
  // -------------------------------------------------------------------------

  it('isBlocked = false si totalHits > limit mais blockDuration = 0', async () => {
    redis = makeMockRedis({ zcountValue: 101 }); // 101 > limit=100
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
    const result = await storage.increment('key1', 60, 100, 0, 'default');
    expect(result.totalHits).toBe(101);
    expect(result.isBlocked).toBe(false);
    expect(redis.set).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // increment() -- depassement limite AVEC blockDuration
  // -------------------------------------------------------------------------

  it('bloque le client si totalHits > limit et blockDuration > 0', async () => {
    redis = makeMockRedis({ zcountValue: 101 });
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
    const result = await storage.increment('key1', 60, 100, 300, 'default');
    expect(result.isBlocked).toBe(true);
    expect(result.timeToBlockExpire).toBe(300);
  });

  it('appelle redis.set(blockKey, "1", "EX", blockDuration) lors du blocage', async () => {
    redis = makeMockRedis({ zcountValue: 101 });
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
    await storage.increment('key2', 60, 100, 300, 'default');
    expect(redis.set).toHaveBeenCalledWith(
      'throttle_block:default:key2',
      '1',
      'EX',
      300,
    );
  });

  it('ne bloque pas si totalHits === limit (a la limite exacte)', async () => {
    redis = makeMockRedis({ zcountValue: 100 });
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
    const result = await storage.increment('key1', 60, 100, 300, 'default');
    expect(result.isBlocked).toBe(false);
    expect(redis.set).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // increment() -- client deja bloque (pttl > 0)
  // -------------------------------------------------------------------------

  it('retourne isBlocked = true immediatement si le client est deja bloque', async () => {
    redis = makeMockRedis({ pttlValue: 200_000 }); // 200s restants
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
    const result = await storage.increment('blocked', 60, 100, 300, 'default');
    expect(result.isBlocked).toBe(true);
    expect(result.totalHits).toBe(101); // limit + 1
    // N'appelle pas le pipeline si deja bloque
    expect(redis.multi).not.toHaveBeenCalled();
  });

  it('calcule timeToBlockExpire = ceil(pttlMs / 1000) pour un client bloque', async () => {
    redis = makeMockRedis({ pttlValue: 150_500 }); // 150.5s -> ceil = 151s
    storage = new ThrottlerRedisStorage(redis as unknown as import('ioredis').default);
    const result = await storage.increment('blocked', 60, 100, 300, 'default');
    expect(result.timeToBlockExpire).toBe(151);
  });

  // -------------------------------------------------------------------------
  // onApplicationShutdown()
  // -------------------------------------------------------------------------

  it('appelle redis.quit() lors du shutdown', async () => {
    await storage.onApplicationShutdown();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
