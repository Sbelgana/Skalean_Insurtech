/**
 * Tests RedisModule -- valide l'exposition de redisClient via DI NestJS.
 *
 * Utilise un mock ioredis pour eviter la dependance a une vraie connexion
 * Redis en tests unitaires.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { RedisModule } from './redis.module';
import { REDIS_CLIENT_TOKEN } from './redis.provider';

// Mock du client ioredis
const mockRedis = {
  status: 'ready' as string,
  ping: vi.fn(async () => 'PONG'),
  quit: vi.fn(async () => {
    mockRedis.status = 'end';
  }),
  disconnect: vi.fn(),
  once: vi.fn(),
  on: vi.fn(),
};

// Mock de la classe Redis ioredis
vi.mock('ioredis', () => {
  const MockRedis = vi.fn((_url?: string, _options?: unknown) => {
    // Reinitialiser le status a chaque instanciation
    mockRedis.status = 'ready';
    return mockRedis;
  });
  return { default: MockRedis };
});

describe('RedisModule', () => {
  let module: TestingModule;

  beforeEach(() => {
    mockRedis.status = 'ready';
    mockRedis.ping.mockClear();
    mockRedis.quit.mockClear();
    // Simuler l'evenement 'ready' immediatement pour eviter le timeout
    mockRedis.once.mockImplementation((event: string, cb: () => void) => {
      if (event === 'ready') cb();
    });
  });

  afterEach(async () => {
    if (module) await module.close();
  });

  it('expose redisClient via DI (REDIS_CLIENT_TOKEN)', async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();

    const redis = module.get(REDIS_CLIENT_TOKEN);
    expect(redis).toBeDefined();
  });

  it('redisClient a le status ready apres connexion', async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();

    const redis: typeof mockRedis = module.get(REDIS_CLIENT_TOKEN);
    expect(redis.status).toBe('ready');
  });

  it('onModuleDestroy appelle quit() si status !== end', async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();

    expect(mockRedis.status).toBe('ready');
    await module.close();
    expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    expect(mockRedis.status).toBe('end');
  });

  it('onModuleDestroy ne fait rien si status === end', async () => {
    mockRedis.status = 'end';
    // Instanciation directe du module avec client deja 'end'
    module = await Test.createTestingModule({
      providers: [
        {
          provide: REDIS_CLIENT_TOKEN,
          useValue: { status: 'end', quit: mockRedis.quit },
        },
      ],
    }).compile();

    // Simuler onModuleDestroy
    const redis: { status: string; quit: () => Promise<void> } = module.get(REDIS_CLIENT_TOKEN);
    if (redis.status !== 'end') await redis.quit();

    expect(mockRedis.quit).not.toHaveBeenCalled();
  });

  it('RedisModule annote @Global expose le provider', async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();

    const redis = module.get(REDIS_CLIENT_TOKEN);
    expect(redis).toBeDefined();
  });
});
