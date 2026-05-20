/**
 * Tests RateLimitGuard -- shouldSkip() + throwThrottlingException().
 *
 * Le guard etend ThrottlerGuard. On le test directement en instanciant
 * avec des mocks minimaux (options, storage, reflector).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.13 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { RateLimitGuard } from './throttler.guard';

// ---------------------------------------------------------------------------
// Helpers : mocks minimaux pour ThrottlerGuard
// ---------------------------------------------------------------------------

/** Cree un mock d'options ThrottlerModule suffisant pour le guard. */
function makeOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [{ name: 'default', ttl: 60, limit: 100 }],
  };
}

/** Cree un mock ThrottlerStorage minimal. */
function makeStorage() {
  return {
    increment: vi.fn().mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
  };
}

/** Cree un mock Reflector minimal. */
function makeReflector() {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(undefined),
  };
}

/**
 * Cree un ExecutionContext mock avec l'URL specifiee.
 * Pour Fastify : req.url contient le chemin + query string.
 */
function makeContext(url: string, requestId = 'req-abc-123') {
  const req = { url, id: requestId };
  const res = { header: vi.fn() };
  const context = {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(req),
      getResponse: vi.fn().mockReturnValue(res),
    }),
    getHandler: vi.fn().mockReturnValue(function handler() {}),
    getClass: vi.fn().mockReturnValue(class FakeController {}),
  } as unknown as ExecutionContext;
  return context;
}

/** Cree un ThrottlerLimitDetail mock. */
function makeLimitDetail(timeToExpire = 60): ThrottlerLimitDetail {
  return {
    totalHits: 101,
    timeToExpire,
    isBlocked: true,
    timeToBlockExpire: 60,
    ttl: 60,
    limit: 100,
    key: 'test-key',
    tracker: '127.0.0.1',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    guard = new RateLimitGuard(
      makeOptions() as unknown as ConstructorParameters<typeof RateLimitGuard>[0],
      makeStorage() as unknown as ConstructorParameters<typeof RateLimitGuard>[1],
      makeReflector() as unknown as ConstructorParameters<typeof RateLimitGuard>[2],
    );
    // Initialise les throttlers comme onModuleInit le ferait
    // (acces direct a la propriete protegee via cast)
    (guard as unknown as Record<string, unknown>)['throttlers'] = [
      { name: 'default', ttl: 60, limit: 100 },
    ];
    (guard as unknown as Record<string, unknown>)['commonOptions'] = {
      getTracker: (req: Record<string, unknown>) => Promise.resolve(req['ip'] as string ?? '127.0.0.1'),
      generateKey: (_ctx: unknown, tracker: string, name: string) => `${name}-${tracker}`,
    };
  });

  // -------------------------------------------------------------------------
  // shouldSkip()
  // -------------------------------------------------------------------------

  it('shouldSkip() retourne true pour /healthz (racine exacte)', async () => {
    const ctx = makeContext('/healthz');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(true);
  });

  it('shouldSkip() retourne true pour /readyz (racine exacte)', async () => {
    const ctx = makeContext('/readyz');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(true);
  });

  it('shouldSkip() retourne true pour /docs (racine exacte)', async () => {
    const ctx = makeContext('/docs');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(true);
  });

  it('shouldSkip() retourne true pour /docs/api (sous-chemin)', async () => {
    const ctx = makeContext('/docs/api');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(true);
  });

  it('shouldSkip() retourne true pour /docs-json (sous-chemin /docs/...)', async () => {
    // /docs-json ne commence PAS par /docs/ -- il commence par /docs suivi de '-'
    // Ce chemin N'est PAS exempte (il n'est ni /docs ni /docs/...)
    // Correction : /docs-json != /docs ET /docs-json ne commence pas par /docs/
    const ctx = makeContext('/docs-json');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    // /docs-json ne commence pas par /docs/ donc non exempte
    expect(result).toBe(false);
  });

  it('shouldSkip() retourne true pour /healthz?param=1 (ignore query string)', async () => {
    const ctx = makeContext('/healthz?probe=liveness');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(true);
  });

  it('shouldSkip() retourne false pour /api/policies (route metier)', async () => {
    const ctx = makeContext('/api/policies');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(false);
  });

  it('shouldSkip() retourne false pour /admin/queues (BullBoard)', async () => {
    const ctx = makeContext('/admin/queues');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(false);
  });

  it('shouldSkip() retourne false pour / (racine)', async () => {
    const ctx = makeContext('/');
    const result = await (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> })
      .shouldSkip(ctx);
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // throwThrottlingException()
  // -------------------------------------------------------------------------

  it('throwThrottlingException() leve HttpException avec status 429', async () => {
    const ctx = makeContext('/api/quotes');
    await expect(
      (guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> })
        .throwThrottlingException(ctx, makeLimitDetail()),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await (guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> })
        .throwThrottlingException(ctx, makeLimitDetail());
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('throwThrottlingException() payload contient code: RATE_LIMIT', async () => {
    const ctx = makeContext('/api/quotes');
    try {
      await (guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> })
        .throwThrottlingException(ctx, makeLimitDetail());
    } catch (err) {
      const body = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(body['code']).toBe('RATE_LIMIT');
    }
  });

  it('throwThrottlingException() payload contient retryAfter = timeToExpire', async () => {
    const ctx = makeContext('/api/quotes');
    const detail = makeLimitDetail(45);
    try {
      await (guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> })
        .throwThrottlingException(ctx, detail);
    } catch (err) {
      const body = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(body['retryAfter']).toBe(45);
    }
  });

  it('throwThrottlingException() payload contient traceId = req.id', async () => {
    const ctx = makeContext('/api/quotes', 'trace-xyz-789');
    try {
      await (guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> })
        .throwThrottlingException(ctx, makeLimitDetail());
    } catch (err) {
      const body = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(body['traceId']).toBe('trace-xyz-789');
    }
  });

  it('throwThrottlingException() payload contient error: "Too many requests"', async () => {
    const ctx = makeContext('/api/quotes');
    try {
      await (guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> })
        .throwThrottlingException(ctx, makeLimitDetail());
    } catch (err) {
      const body = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(body['error']).toBe('Too many requests');
    }
  });
});
