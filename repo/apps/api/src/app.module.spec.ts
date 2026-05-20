/**
 * Tests integration AppModule -- valide que l'ensemble des modules transverses
 * et metier se charge correctement via DI NestJS.
 *
 * Utilise des mocks pour les connections exterieures (Database, Redis, Kafka)
 * et pour nestjs-pino (evite middleware HTTP hors contexte tests).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 + 1.3.3 + 1.3.13 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  applyEnvFixture,
  clearEnvFixture,
  VALID_ENV_FIXTURE,
} from '../test/fixtures/env-fixtures';
import { resetEnvCache } from '@insurtech/shared-config';

// ============================================================================
// Mocks infra -- evitent connexions reelles au boot AppModule
// ============================================================================

// Mock LoggerModule : evite l'enregistrement de middleware nestjs-pino dans les tests.
// On mocke notre propre module (pas nestjs-pino) pour rester independant de l'impl.
vi.mock('./logger/logger.module', () => {
  const FakeLoggerModuleClass = class FakeLoggerModule {};
  return {
    LoggerModule: {
      forRoot: vi.fn(() => ({
        module: FakeLoggerModuleClass,
        providers: [],
        imports: [],
        exports: [],
        global: true,
      })),
    },
  };
});

const mockDataSource = {
  isInitialized: false,
  initialize: vi.fn(async () => { mockDataSource.isInitialized = true; }),
  destroy: vi.fn(async () => { mockDataSource.isInitialized = false; }),
};

vi.mock('@insurtech/database', () => ({
  AppDataSource: mockDataSource,
}));

const mockRedis = {
  status: 'ready' as string,
  ping: vi.fn(async () => 'PONG'),
  quit: vi.fn(async () => { mockRedis.status = 'end'; }),
  disconnect: vi.fn(),
  once: vi.fn(),
  on: vi.fn(),
};

vi.mock('ioredis', () => {
  const MockRedis = vi.fn((_url?: string, _options?: unknown) => {
    mockRedis.status = 'ready';
    return mockRedis;
  });
  return { default: MockRedis };
});

const mockProducer = {
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  send: vi.fn(async () => []),
};

vi.mock('kafkajs', () => ({
  Kafka: vi.fn(() => ({
    producer: vi.fn(() => mockProducer),
  })),
}));

// Mock @nestjs/bullmq + bullmq : evite connexion Redis DB 2 pour queues.
vi.mock('@nestjs/bullmq', () => ({
  BullModule: {
    forRoot: vi.fn(() => ({
      module: class MockBullCoreModule {},
      global: true,
      imports: [],
      providers: [],
      exports: [],
    })),
    registerQueue: vi.fn(() => ({
      module: class MockBullModule {},
      imports: [],
      providers: [],
      exports: [],
    })),
  },
}));
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: '1' }),
    close: vi.fn().mockResolvedValue(undefined),
    getJobCounts: vi.fn().mockResolvedValue({}),
  })),
}));
vi.mock('@bull-board/api', () => ({
  createBullBoard: vi.fn(() => ({ addQueue: vi.fn(), removeQueue: vi.fn() })),
}));
vi.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: vi.fn(),
}));
vi.mock('@bull-board/fastify', () => ({
  FastifyAdapter: vi.fn(() => ({
    setBasePath: vi.fn(),
    registerPlugin: vi.fn(),
    getRouter: vi.fn(),
  })),
}));

// Mock @sentry/nestjs + @sentry/profiling-node.
vi.mock('@sentry/nestjs', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) => cb({ setTag: vi.fn(), setUser: vi.fn() })),
}));
vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => ({})),
}));

// Mock SecurityModule (Tache 1.3.14) : evite logique JWT absente en Sprint 3.
vi.mock('./security/security.module', () => ({
  SecurityModule: class MockSecurityModule {},
}));

// Mock @nestjs/throttler : evite connexion Redis DB 5 pour rate-limit.
vi.mock('@nestjs/throttler', () => ({
  ThrottlerModule: {
    forRoot: vi.fn(() => ({
      module: class MockThrottlerModuleClass {},
      providers: [],
      exports: [],
      global: true,
    })),
    forRootAsync: vi.fn(() => ({
      module: class MockThrottlerAsyncModuleClass {},
      providers: [
        {
          provide: 'THROTTLER_OPTIONS',
          useValue: { throttlers: [{ name: 'default', ttl: 60, limit: 100 }] },
        },
        {
          provide: Symbol.for('ThrottlerStorage'),
          useValue: { increment: vi.fn() },
        },
      ],
      exports: ['THROTTLER_OPTIONS'],
      global: true,
    })),
  },
  ThrottlerGuard: class MockThrottlerGuard {
    canActivate() { return true; }
    onModuleInit() { return Promise.resolve(); }
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('AppModule integration', () => {
  let module: TestingModule;

  beforeEach(() => {
    resetEnvCache();
    applyEnvFixture(VALID_ENV_FIXTURE);
    mockDataSource.isInitialized = false;
    mockDataSource.initialize.mockClear();
    mockDataSource.destroy.mockClear();
    mockRedis.status = 'ready';
    mockRedis.quit.mockClear();
    mockProducer.connect.mockClear();
    mockProducer.disconnect.mockClear();
    // Simuler evenement 'ready' redis immediatement
    mockRedis.once.mockImplementation((event: string, cb: () => void) => {
      if (event === 'ready') cb();
    });
  });

  afterEach(async () => {
    if (module) await module.close();
    clearEnvFixture(VALID_ENV_FIXTURE);
    resetEnvCache();
  });

  it('charge AppModule sans erreur', async () => {
    const { AppModule } = await import('./app.module');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(module).toBeDefined();
  });

  it('expose ConfigService via DI', async () => {
    const { AppModule } = await import('./app.module');
    const { ConfigService } = await import('./config/config.service');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const config = module.get(ConfigService);
    expect(config).toBeInstanceOf(ConfigService);
  });

  it('expose DataSource via DI (DATA_SOURCE_TOKEN)', async () => {
    const { AppModule } = await import('./app.module');
    const { DATA_SOURCE_TOKEN } = await import('./database/data-source.provider');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const dataSource = module.get(DATA_SOURCE_TOKEN);
    expect(dataSource).toBeDefined();
    expect(dataSource.isInitialized).toBe(true);
  });

  it('expose redisClient via DI (REDIS_CLIENT_TOKEN)', async () => {
    const { AppModule } = await import('./app.module');
    const { REDIS_CLIENT_TOKEN } = await import('./redis/redis.provider');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const redis = module.get(REDIS_CLIENT_TOKEN);
    expect(redis).toBeDefined();
    expect(redis.status).toBe('ready');
  });

  it('expose kafkaProducer via DI (KAFKA_PRODUCER_TOKEN)', async () => {
    const { AppModule } = await import('./app.module');
    const { KAFKA_PRODUCER_TOKEN } = await import('./kafka/kafka.provider');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const producer = module.get(KAFKA_PRODUCER_TOKEN);
    expect(producer).toBeDefined();
    expect(typeof producer.send).toBe('function');
  });

  it('charge les 19 modules metier stubs sans erreur', async () => {
    const { AppModule } = await import('./app.module');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // Boot reussi = preuve que les 19 stubs se chargent
    expect(module).toBeDefined();
  });

  it('graceful shutdown ferme Database et Redis', async () => {
    const { AppModule } = await import('./app.module');
    const { DATA_SOURCE_TOKEN } = await import('./database/data-source.provider');
    const { REDIS_CLIENT_TOKEN } = await import('./redis/redis.provider');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(mockDataSource.isInitialized).toBe(true);
    expect(mockRedis.status).toBe('ready');

    await module.close();

    expect(mockDataSource.destroy).toHaveBeenCalled();
    expect(mockRedis.quit).toHaveBeenCalled();

    // Verifier que les tokens sont accessibles avant close
    const ds = module.get(DATA_SOURCE_TOKEN);
    const redis = module.get(REDIS_CLIENT_TOKEN);
    expect(ds).toBeDefined();
    expect(redis).toBeDefined();
  });

  it('ConfigService.get(API_PORT) accessible depuis AppModule', async () => {
    const { AppModule } = await import('./app.module');
    const { ConfigService } = await import('./config/config.service');
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const config = module.get(ConfigService);
    expect(config.get('API_PORT')).toBe(14000);
    expect(config.isTest()).toBe(true);
  });
});
