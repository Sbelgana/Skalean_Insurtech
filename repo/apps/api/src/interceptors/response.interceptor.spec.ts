/**
 * Tests ResponseInterceptor -- valide le format standardise des reponses API.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.7 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { ResponseInterceptor, type ApiSuccessResponse } from './response.interceptor';
import { requestContextStorage } from '../request-context/request-context';

// ============================================================================
// Helpers
// ============================================================================

/** Cree un mock ExecutionContext minimal. */
function makeMockContext(): ExecutionContext {
  return {} as ExecutionContext;
}

/** Cree un mock CallHandler qui emet la valeur donnee. */
function makeMockHandler<T>(value: T): CallHandler<T> {
  return {
    handle: () => of(value),
  };
}

/** Execute l'intercepteur et retourne le resultat via Promise. */
async function runInterceptor<T>(
  interceptor: ResponseInterceptor<T>,
  value: T,
  requestId?: string,
): Promise<unknown> {
  return new Promise((resolve) => {
    const runFn = () => {
      interceptor
        .intercept(makeMockContext(), makeMockHandler(value))
        .subscribe({ next: resolve });
    };

    if (requestId !== undefined) {
      requestContextStorage.run({ request_id: requestId }, runFn);
    } else {
      runFn();
    }
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('isAlreadyWrapped() -- via double-wrapping prevention', () => {
  it('ne re-enveloppe pas une reponse avec success: true', async () => {
    const interceptor = new ResponseInterceptor();
    const alreadyWrapped: ApiSuccessResponse<string> = {
      success: true,
      data: 'payload',
      meta: {
        timestamp: '2024-01-01T00:00:00.000Z',
        version: '2.2.0',
        duration_ms: 5,
      },
    };

    const result = await runInterceptor(interceptor, alreadyWrapped);
    expect(result).toBe(alreadyWrapped);
  });

  it('ne re-enveloppe pas une reponse avec success: false', async () => {
    const interceptor = new ResponseInterceptor();
    const alreadyWrapped = { success: false, error: { code: 'ERR', message: 'fail' } };

    const result = await runInterceptor(interceptor, alreadyWrapped);
    expect(result).toBe(alreadyWrapped);
  });
});

describe('ResponseInterceptor -- enveloppement standard', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enveloppe la reponse avec success: true', async () => {
    const result = await runInterceptor(interceptor, { id: 1, name: 'Alice' }) as ApiSuccessResponse<unknown>;
    expect(result.success).toBe(true);
  });

  it('place le payload dans data', async () => {
    const payload = { id: 1, name: 'Bob' };
    const result = await runInterceptor(interceptor, payload) as ApiSuccessResponse<unknown>;
    expect(result.data).toEqual(payload);
  });

  it('inclut meta.timestamp en ISO 8601', async () => {
    const result = await runInterceptor(interceptor, {}) as ApiSuccessResponse<unknown>;
    expect(result.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('inclut meta.version depuis APP_VERSION ou defaut 2.2.0', async () => {
    const originalVersion = process.env['APP_VERSION'];
    process.env['APP_VERSION'] = '1.5.0';

    const result = await runInterceptor(interceptor, {}) as ApiSuccessResponse<unknown>;
    expect(result.meta.version).toBe('1.5.0');

    // Restaurer
    if (originalVersion !== undefined) {
      process.env['APP_VERSION'] = originalVersion;
    } else {
      delete process.env['APP_VERSION'];
    }
  });

  it('inclut meta.request_id depuis RequestContext si present', async () => {
    const result = await runInterceptor(interceptor, {}, 'req-id-abc') as ApiSuccessResponse<unknown>;
    expect(result.meta.request_id).toBe('req-id-abc');
  });

  it('meta.request_id est undefined si pas de RequestContext', async () => {
    const result = await runInterceptor(interceptor, {}) as ApiSuccessResponse<unknown>;
    expect(result.meta.request_id).toBeUndefined();
  });

  it('inclut meta.duration_ms >= 0', async () => {
    const result = await runInterceptor(interceptor, {}) as ApiSuccessResponse<unknown>;
    expect(typeof result.meta.duration_ms).toBe('number');
    expect(result.meta.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('enveloppe les reponses null', async () => {
    const result = await runInterceptor(interceptor, null) as ApiSuccessResponse<unknown>;
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('enveloppe les reponses tableau', async () => {
    const payload = [1, 2, 3];
    const result = await runInterceptor(interceptor, payload) as ApiSuccessResponse<unknown>;
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('enveloppe les reponses string', async () => {
    const result = await runInterceptor(interceptor, 'OK') as ApiSuccessResponse<unknown>;
    expect(result.success).toBe(true);
    expect(result.data).toBe('OK');
  });
});
