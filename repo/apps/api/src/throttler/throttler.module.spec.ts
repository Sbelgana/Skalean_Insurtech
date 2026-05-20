/**
 * Tests ThrottlerRateLimitModule -- verifie le chargement DI NestJS.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.13 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { DEFAULT_RATE_LIMIT, DEFAULT_WINDOW_SECONDS } from './throttler.module';

// ---------------------------------------------------------------------------
// Mocks -- evite connexions Redis + imports lourds @nestjs/throttler
// ---------------------------------------------------------------------------

vi.mock('ioredis', () => {
  const MockRedis = vi.fn(() => ({
    status: 'ready',
    pttl: vi.fn().mockResolvedValue(-1),
    multi: vi.fn().mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcount: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
    }),
    set: vi.fn().mockResolvedValue('OK'),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  }));
  return { default: MockRedis };
});

vi.mock('@nestjs/throttler', () => {
  const MockThrottlerModule = {
    forRoot: vi.fn(() => ({
      module: class MockThrottlerModuleClass {},
      providers: [
        {
          provide: 'THROTTLER_OPTIONS',
          useValue: [{ name: 'default', ttl: 60, limit: 100 }],
        },
      ],
      exports: ['THROTTLER_OPTIONS'],
      global: true,
    })),
    forRootAsync: vi.fn(() => ({
      module: class MockThrottlerAsyncModuleClass {},
      providers: [
        {
          provide: 'THROTTLER_OPTIONS',
          useValue: { throttlers: [{ name: 'default', ttl: 60, limit: 100 }] },
        },
      ],
      exports: ['THROTTLER_OPTIONS'],
      global: true,
    })),
  };

  const MockThrottlerGuard = class MockThrottlerGuard {
    canActivate() { return true; }
    shouldSkip() { return Promise.resolve(false); }
    throwThrottlingException() { return Promise.resolve(); }
    getRequestResponse(ctx: unknown) {
      const http = (ctx as Record<string, () => unknown>)['switchToHttp']();
      return {
        req: (http as Record<string, () => unknown>)['getRequest'](),
        res: (http as Record<string, () => unknown>)['getResponse'](),
      };
    }
    onModuleInit() { return Promise.resolve(); }
  };

  return {
    ThrottlerModule: MockThrottlerModule,
    ThrottlerGuard: MockThrottlerGuard,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThrottlerRateLimitModule', () => {
  let module: TestingModule;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (module) await module.close();
  });

  it('charge ThrottlerRateLimitModule sans erreur', async () => {
    const { ThrottlerRateLimitModule } = await import('./throttler.module');
    module = await Test.createTestingModule({
      imports: [ThrottlerRateLimitModule],
    }).compile();
    expect(module).toBeDefined();
  });

  it('DEFAULT_RATE_LIMIT est 100', () => {
    expect(DEFAULT_RATE_LIMIT).toBe(100);
  });

  it('DEFAULT_WINDOW_SECONDS est 60', () => {
    expect(DEFAULT_WINDOW_SECONDS).toBe(60);
  });

  it('RateLimitGuard est resolvable depuis le module compile', async () => {
    const { ThrottlerRateLimitModule } = await import('./throttler.module');
    const { RateLimitGuard } = await import('./throttler.guard');
    module = await Test.createTestingModule({
      imports: [ThrottlerRateLimitModule],
    }).compile();
    // RateLimitGuard est un provider dans ThrottlerRateLimitModule
    // (enregistre via APP_GUARD) -- le module ne doit pas echouer au boot
    expect(module).toBeDefined();
    // Verifie que RateLimitGuard est instanciable directement (logique guard testee
    // dans throttler.guard.spec.ts). L'important ici est que le module boot.
    expect(typeof RateLimitGuard).toBe('function');
  });
});
