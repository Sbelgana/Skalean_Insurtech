/**
 * Tests RequestContextModule -- valide la propagation AsyncLocalStorage
 * et l'initialisation du contexte de requete par le middleware.
 *
 * Strategy :
 *   - Tests unitaires directs sur requestContextStorage et getRequestContext.
 *   - Tests unitaires sur RequestContextMiddleware.use() avec req/res mocks.
 *   - Mock @opentelemetry/api pour controler le span actif.
 *   - PAS de TestingModule NestJS (pas de middleware HTTP dans les tests unitaires).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.4 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

// Mock @opentelemetry/api avant les imports de production.
const mockGetActiveSpan = vi.hoisted(() => vi.fn());

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: mockGetActiveSpan,
  },
}));

// Imports apres les mocks.
import {
  requestContextStorage,
  getRequestContext,
  type RequestContext,
} from './request-context';
import { RequestContextMiddleware } from './request-context.middleware';

// ============================================================================
// Helpers
// ============================================================================

/** Cree un mock IncomingMessage minimal avec headers optionnels. */
function makeMockReq(
  headers: Record<string, string | string[]> = {},
): IncomingMessage {
  return {
    headers,
  } as unknown as IncomingMessage;
}

/** Cree un mock ServerResponse minimal. */
function makeMockRes(): ServerResponse {
  return {} as ServerResponse;
}

/** Extrait le contexte depuis le .run() du middleware. */
async function runMiddlewareAndGetContext(
  middleware: RequestContextMiddleware,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<RequestContext | undefined> {
  return new Promise<RequestContext | undefined>((resolve) => {
    middleware.use(req, res, () => {
      resolve(getRequestContext());
    });
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('requestContextStorage / getRequestContext()', () => {
  it('retourne undefined hors contexte AsyncLocalStorage', () => {
    const ctx = getRequestContext();
    expect(ctx).toBeUndefined();
  });

  it('retourne le contexte a l interieur d un .run()', () => {
    const store: RequestContext = {
      request_id: 'test-uuid-1234',
      tenant_id: 'tenant-abc',
    };

    let captured: RequestContext | undefined;
    requestContextStorage.run(store, () => {
      captured = getRequestContext();
    });

    expect(captured).toEqual(store);
    // Hors du .run(), plus rien.
    expect(getRequestContext()).toBeUndefined();
  });

  it('propage le contexte dans les callbacks async imbriques', async () => {
    const store: RequestContext = { request_id: 'async-uuid' };
    let captured: RequestContext | undefined;

    await requestContextStorage.run(store, async () => {
      await Promise.resolve(); // simule await async
      captured = getRequestContext();
    });

    expect(captured?.request_id).toBe('async-uuid');
  });
});

describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    middleware = new RequestContextMiddleware();
    mockGetActiveSpan.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genere un UUID request_id si X-Request-ID absent', async () => {
    const req = makeMockReq({});
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.request_id).toBeDefined();
    // UUID v4 format: 8-4-4-4-12
    expect(ctx?.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('utilise le X-Request-ID du header si present', async () => {
    const req = makeMockReq({ 'x-request-id': 'my-request-id-123' });
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.request_id).toBe('my-request-id-123');
  });

  it('extrait tenant_id depuis X-Tenant-ID header', async () => {
    const req = makeMockReq({ 'x-tenant-id': 'tenant-xyz-456' });
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.tenant_id).toBe('tenant-xyz-456');
  });

  it('laisse tenant_id undefined si X-Tenant-ID absent', async () => {
    const req = makeMockReq({});
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.tenant_id).toBeUndefined();
  });

  it('injecte trace_id et span_id depuis le span OTel actif', async () => {
    const mockSpan = {
      spanContext: vi.fn(() => ({
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        traceFlags: 1,
      })),
    };
    mockGetActiveSpan.mockReturnValue(mockSpan);

    const req = makeMockReq({});
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.trace_id).toBe('abcdef1234567890abcdef1234567890');
    expect(ctx?.span_id).toBe('1234567890abcdef');
  });

  it('laisse trace_id et span_id undefined si aucun span OTel actif', async () => {
    mockGetActiveSpan.mockReturnValue(undefined);

    const req = makeMockReq({});
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.trace_id).toBeUndefined();
    expect(ctx?.span_id).toBeUndefined();
  });

  it('appelle next() pour continuer la chaine middleware', async () => {
    const nextFn = vi.fn();
    const req = makeMockReq({});
    middleware.use(req, makeMockRes(), nextFn);
    // run() est synchrone pour les callbacks sync.
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it('propage request_id et tenant_id dans le meme contexte', async () => {
    const req = makeMockReq({
      'x-request-id': 'req-123',
      'x-tenant-id': 'tenant-456',
    });
    const ctx = await runMiddlewareAndGetContext(middleware, req, makeMockRes());

    expect(ctx?.request_id).toBe('req-123');
    expect(ctx?.tenant_id).toBe('tenant-456');
  });
});

describe('RequestContextModule', () => {
  it('est importable sans erreur', async () => {
    const { RequestContextModule } = await import('./request-context.module');
    expect(RequestContextModule).toBeDefined();
  });
});
