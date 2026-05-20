/**
 * Tests AllExceptionsFilter -- filtre global PII-safe exception handler.
 *
 * Verifient :
 * - HttpException : extraction statut + code + message.
 * - ZodValidationErrorResponse : code VALIDATION_ERROR + details.
 * - Erreur inconnue : 500 INTERNAL_SERVER_ERROR.
 * - Production : messages generiques uniquement (pas de PII).
 * - Dev : messages reels exposes.
 * - Logging : 5xx -> logger.error, 4xx -> logger.warn.
 * - Meta : timestamp ISO 8601, request_id depuis RequestContext.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

// Mock sentry.config pour eviter l'import @sentry/nestjs en tests unitaires.
// Hoiste automatiquement par Vitest avant les imports du module.
vi.mock('../sentry/sentry.config', () => ({
  sentryCaptureException: vi.fn(),
  initSentry: vi.fn(),
  isSentryInitialized: vi.fn(() => false),
  resetSentryStateForTesting: vi.fn(),
}));

import { AllExceptionsFilter, type ApiErrorResponse } from './all-exceptions.filter';
import { requestContextStorage } from '../request-context/request-context';
import { sentryCaptureException } from '../sentry/sentry.config';

// ============================================================================
// Helpers
// ============================================================================

/** Cree un faux ArgumentsHost Fastify. */
function makeMockHost(overrides: {
  method?: string;
  url?: string;
}): ArgumentsHost {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const reply = { status, send };
  const request = {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/test',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
}

/** Extrait le corps envoye depuis le mock host. */
function getSentBody(host: ArgumentsHost): ApiErrorResponse {
  const reply = host.switchToHttp().getResponse<{ status: ReturnType<typeof vi.fn> }>();
  const statusMock = reply.status as ReturnType<typeof vi.fn>;
  const sendMock = statusMock.mock.results[0]?.value?.send as ReturnType<typeof vi.fn>;
  return sendMock?.mock.calls[0]?.[0] as ApiErrorResponse;
}

/** Extrait le code HTTP utilise. */
function getSentStatusCode(host: ArgumentsHost): number {
  const reply = host.switchToHttp().getResponse<{ status: ReturnType<typeof vi.fn> }>();
  const statusMock = reply.status as ReturnType<typeof vi.fn>;
  return statusMock.mock.calls[0]?.[0] as number;
}

// ============================================================================
// Tests
// ============================================================================

describe('AllExceptionsFilter -- HttpException', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // Forcer mode dev pour voir les messages reels.
    Object.defineProperty(filter, 'isProduction', { value: false, writable: true });
    // Silencer les logs NestJS pendant les tests.
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne le statut HTTP correct pour HttpException 404', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    expect(getSentStatusCode(host)).toBe(404);
  });

  it('retourne code NOT_FOUND pour 404', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    const body = getSentBody(host);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('retourne success: false', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

    const body = getSentBody(host);
    expect(body.success).toBe(false);
  });

  it('retourne le message string de HttpException en dev', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Custom message', HttpStatus.FORBIDDEN), host);

    const body = getSentBody(host);
    expect(body.error.message).toBe('Custom message');
  });

  it('retourne le message depuis objet response.message en dev', () => {
    const host = makeMockHost({});
    filter.catch(
      new HttpException({ statusCode: 400, message: 'Object message' }, HttpStatus.BAD_REQUEST),
      host,
    );

    const body = getSentBody(host);
    expect(body.error.message).toBe('Object message');
  });

  it('joint les messages tableau en dev', () => {
    const host = makeMockHost({});
    filter.catch(
      new HttpException({ statusCode: 400, message: ['err1', 'err2'] }, HttpStatus.BAD_REQUEST),
      host,
    );

    const body = getSentBody(host);
    expect(body.error.message).toBe('err1, err2');
  });

  it('inclut meta.timestamp ISO 8601', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Test', HttpStatus.NOT_FOUND), host);

    const body = getSentBody(host);
    expect(body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('inclut meta.request_id depuis RequestContext', () => {
    const host = makeMockHost({});

    requestContextStorage.run({ request_id: 'test-req-id-123' }, () => {
      filter.catch(new HttpException('Test', HttpStatus.NOT_FOUND), host);
    });

    const body = getSentBody(host);
    expect(body.meta.request_id).toBe('test-req-id-123');
  });

  it('meta.request_id est undefined sans RequestContext', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Test', HttpStatus.NOT_FOUND), host);

    const body = getSentBody(host);
    expect(body.meta.request_id).toBeUndefined();
  });

  it('mappe 401 -> UNAUTHORIZED', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);

    expect(getSentBody(host).error.code).toBe('UNAUTHORIZED');
  });

  it('mappe 409 -> CONFLICT', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Conflict', HttpStatus.CONFLICT), host);

    expect(getSentBody(host).error.code).toBe('CONFLICT');
  });

  it('mappe 429 -> TOO_MANY_REQUESTS', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Rate limit', HttpStatus.TOO_MANY_REQUESTS), host);

    expect(getSentBody(host).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('code HTTP inconnu -> HTTP_<N>', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Teapot', 418), host);

    expect(getSentBody(host).error.code).toBe('HTTP_418');
  });
});

describe('AllExceptionsFilter -- ZodValidationErrorResponse', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    Object.defineProperty(filter, 'isProduction', { value: false, writable: true });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detecte ZodValidationErrorResponse et retourne code VALIDATION_ERROR', () => {
    const host = makeMockHost({});
    const zodResponse = {
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ path: 'email', message: 'Invalid email', code: 'invalid_string' }],
    };
    filter.catch(new HttpException(zodResponse, HttpStatus.BAD_REQUEST), host);

    const body = getSentBody(host);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('retourne les details Zod dans error.details', () => {
    const host = makeMockHost({});
    const errors = [
      { path: 'email', message: 'Invalid email', code: 'invalid_string' },
      { path: 'age', message: 'Expected number', code: 'invalid_type' },
    ];
    filter.catch(
      new HttpException({ statusCode: 400, message: 'Validation failed', errors }, HttpStatus.BAD_REQUEST),
      host,
    );

    const body = getSentBody(host);
    expect(body.error.details).toEqual(errors);
  });

  it('retourne message Validation failed pour ZodError', () => {
    const host = makeMockHost({});
    filter.catch(
      new HttpException(
        { statusCode: 400, message: 'Validation failed', errors: [] },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(getSentBody(host).error.message).toBe('Validation failed');
  });
});

describe('AllExceptionsFilter -- Erreur inconnue (non-HTTP)', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    Object.defineProperty(filter, 'isProduction', { value: false, writable: true });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne 500 pour erreur inconnue', () => {
    const host = makeMockHost({});
    filter.catch(new Error('Something broke'), host);

    expect(getSentStatusCode(host)).toBe(500);
  });

  it('retourne code INTERNAL_SERVER_ERROR', () => {
    const host = makeMockHost({});
    filter.catch(new Error('Something broke'), host);

    expect(getSentBody(host).error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('expose le message Error en dev', () => {
    const host = makeMockHost({});
    filter.catch(new Error('Raw error message'), host);

    expect(getSentBody(host).error.message).toBe('Raw error message');
  });

  it('expose String(exception) si pas Error en dev', () => {
    const host = makeMockHost({});
    filter.catch('string exception', host);

    expect(getSentBody(host).error.message).toBe('string exception');
  });
});

describe('AllExceptionsFilter -- Mode production (PII masquage)', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // Forcer mode production.
    Object.defineProperty(filter, 'isProduction', { value: true, writable: true });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne message generique 4xx en production', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Sensitive client message', HttpStatus.NOT_FOUND), host);

    const body = getSentBody(host);
    expect(body.error.message).toBe('La requete est invalide ou non autorisee.');
  });

  it('retourne message generique 5xx en production', () => {
    const host = makeMockHost({});
    filter.catch(new Error('Database password leaked'), host);

    const body = getSentBody(host);
    expect(body.error.message).toBe('Une erreur interne est survenue. Veuillez reessayer.');
  });

  it('ne pas exposer le message Error brut en production', () => {
    const host = makeMockHost({});
    filter.catch(new Error('Secret internal error with PII'), host);

    const body = getSentBody(host);
    expect(body.error.message).not.toContain('Secret');
    expect(body.error.message).not.toContain('PII');
  });
});

describe('AllExceptionsFilter -- Logging', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    Object.defineProperty(filter, 'isProduction', { value: false, writable: true });
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logue ERROR pour erreur 500', () => {
    const host = makeMockHost({});
    filter.catch(new Error('Internal'), host);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logue WARN pour erreur 4xx', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logue le message du code erreur dans le contexte', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);

    const callArg = warnSpy.mock.calls[0]?.[1] as string;
    expect(callArg).toContain('NOT_FOUND');
  });

  it('logue method et url de la requete', () => {
    const host = makeMockHost({ method: 'POST', url: '/api/test' });
    filter.catch(new HttpException('Bad', HttpStatus.BAD_REQUEST), host);

    const logPayload = warnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(logPayload['method']).toBe('POST');
    expect(logPayload['url']).toBe('/api/test');
  });
});

describe('AllExceptionsFilter -- Sentry capture (Tache 1.3.12)', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    Object.defineProperty(filter, 'isProduction', { value: false, writable: true });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appelle sentryCaptureException pour erreur 5xx', () => {
    const host = makeMockHost({});
    const err = new Error('Internal boom');
    filter.catch(err, host);
    expect(sentryCaptureException).toHaveBeenCalledWith(err, expect.any(Object));
  });

  it('NE appelle PAS sentryCaptureException pour erreur 4xx', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('NE appelle PAS sentryCaptureException pour erreur 400', () => {
    const host = makeMockHost({});
    filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('appelle sentryCaptureException pour HttpException 503', () => {
    const host = makeMockHost({});
    const err = new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    filter.catch(err, host);
    expect(sentryCaptureException).toHaveBeenCalledWith(err, expect.any(Object));
  });
});
