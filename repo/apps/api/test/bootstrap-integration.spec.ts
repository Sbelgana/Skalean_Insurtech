/**
 * Tests integration bootstrap NestJS+Fastify -- Sprint 3 Tache 1.3.15.
 *
 * Ces tests verifient la pile middleware complete a travers une vraie instance
 * NestFastifyApplication (sans serveur TCP reel, sans infra externe) :
 *   - AllExceptionsFilter  : 404, 500, format erreur JSON
 *   - ResponseInterceptor  : wrapping { success, data, meta }
 *   - ZodValidationPipe    : pass-through (aucun schema global)
 *   - RateLimitGuard       : headers X-RateLimit-* (ThrottlerModule in-memory)
 *   - PublicEndpointGuard  : teste dans guards/public-endpoint.guard.spec.ts
 *   - Swagger /docs        : teste dans e2e/swagger-docs.spec.ts (Playwright)
 *
 * ThrottlerModule est configure avec ThrottlerStorageService (in-memory, pas Redis).
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.15 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  Module,
} from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  APP_PIPE,
} from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../src/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/interceptors/response.interceptor';
import { ZodValidationPipe } from '../src/pipes/zod-validation.pipe';
import { Public } from '../src/decorators/public.decorator';
import { RateLimitGuard } from '../src/throttler/throttler.guard';

// ---------------------------------------------------------------------------
// Mocks Sentry -- evite init SDK Sentry dans les tests integration
// ---------------------------------------------------------------------------
vi.mock('../src/sentry/sentry.config', () => ({
  sentryCaptureException: vi.fn(),
  isSentryInitialized: vi.fn(() => false),
  initSentry: vi.fn(),
  resetSentryStateForTesting: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Controleur de test minimal
// ---------------------------------------------------------------------------

/**
 * Controleur de test minimal.
 * Expose des endpoints couvrant les cas : succes, erreur 4xx, erreur 5xx, POST.
 */
@Controller()
class TestController {
  /** Retourne { hello: 'world' } -- wrapping par ResponseInterceptor. */
  @Public()
  @Get('/')
  getRoot(): { hello: string } {
    return { hello: 'world' };
  }

  /** Leve une HttpException 422 -- gestion AllExceptionsFilter. */
  @Public()
  @Get('/error422')
  getError422(): never {
    throw new HttpException({ message: 'Unprocessable entity', code: 'TEST_422' }, 422);
  }

  /** Leve une Error native (500) -- AllExceptionsFilter doit catcher. */
  @Public()
  @Get('/error500')
  getError500(): never {
    throw new Error('Internal error simulee');
  }

  /** Endpoint protege : pas de @Public(), mais guard pass-through Sprint 3. */
  @Get('/protected')
  getProtected(): { message: string } {
    return { message: 'protected pass-through Sprint 3' };
  }

  /** Accepte un body JSON et le retourne (POST echo). */
  @Public()
  @Post('/echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

/**
 * Module de test minimal :
 *   - ThrottlerModule in-memory (pas Redis)
 *   - Tous les providers middleware Sprint 3
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60, limit: 100 }],
    }),
  ],
  controllers: [TestController],
  providers: [
    // AllExceptionsFilter global -- intercepte toutes les exceptions
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // ResponseInterceptor global -- wrapping des reponses succes
    { provide: APP_INTERCEPTOR, useFactory: () => new ResponseInterceptor() },
    // ZodValidationPipe global -- pass-through sans schema (validation par route)
    { provide: APP_PIPE, useValue: new ZodValidationPipe() },
    // RateLimitGuard global -- headers X-RateLimit-* (ThrottlerModule in-memory)
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
class TestAppModule {}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [TestAppModule],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  await app.init();
  // Fastify doit etre pret pour traiter les requetes inject()
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Bootstrap integration (Tache 1.3.15)', () => {
  // -------------------------------------------------------------------------
  // Smoke + ResponseInterceptor
  // -------------------------------------------------------------------------

  it('GET / retourne 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
  });

  it('GET / : ResponseInterceptor enveloppe dans { success: true, data }', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body['success']).toBe(true);
    expect(body['data']).toMatchObject({ hello: 'world' });
  });

  it('GET / : meta contient timestamp ISO 8601', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const meta = body['meta'] as Record<string, unknown>;
    expect(typeof meta?.['timestamp']).toBe('string');
    expect(meta?.['timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GET / : Content-Type application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  // -------------------------------------------------------------------------
  // AllExceptionsFilter -- 404
  // -------------------------------------------------------------------------

  it('GET /route-inconnue retourne 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/route-inconnue' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /route-inconnue : body JSON { success: false }', async () => {
    const res = await app.inject({ method: 'GET', url: '/route-inconnue' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body['success']).toBe(false);
  });

  it('GET /route-inconnue : body contient error.code', async () => {
    const res = await app.inject({ method: 'GET', url: '/route-inconnue' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const error = body['error'] as Record<string, unknown>;
    expect(error?.['code']).toBeDefined();
  });

  it('GET /route-inconnue : body contient meta.timestamp', async () => {
    const res = await app.inject({ method: 'GET', url: '/route-inconnue' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const meta = body['meta'] as Record<string, unknown>;
    expect(typeof meta?.['timestamp']).toBe('string');
    expect(meta?.['timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // -------------------------------------------------------------------------
  // AllExceptionsFilter -- 4xx et 5xx
  // -------------------------------------------------------------------------

  it('GET /error422 retourne 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/error422' });
    expect(res.statusCode).toBe(422);
  });

  it('GET /error422 : body success: false', async () => {
    const res = await app.inject({ method: 'GET', url: '/error422' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body['success']).toBe(false);
  });

  it('GET /error500 retourne 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/error500' });
    expect(res.statusCode).toBe(500);
  });

  it('GET /error500 : body success: false', async () => {
    const res = await app.inject({ method: 'GET', url: '/error500' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body['success']).toBe(false);
  });

  it('GET /error500 : error.message est une chaine', async () => {
    const res = await app.inject({ method: 'GET', url: '/error500' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const error = body['error'] as Record<string, unknown>;
    expect(typeof error?.['message']).toBe('string');
  });

  // -------------------------------------------------------------------------
  // Route protegee (pas @Public()) -- pass-through Sprint 3
  // -------------------------------------------------------------------------

  it('GET /protected retourne 200 (RateLimitGuard pass-through, guard auth Sprint 5)', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /protected : ResponseInterceptor enveloppe le resultat', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body['success']).toBe(true);
    expect(body['data']).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // RateLimitGuard -- headers X-RateLimit-*
  // -------------------------------------------------------------------------

  it('GET / retourne header X-RateLimit-Limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('GET / retourne header X-RateLimit-Remaining', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('GET / retourne header X-RateLimit-Reset', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('GET / : X-RateLimit-Limit est 100 (limite par defaut)', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(Number(res.headers['x-ratelimit-limit'])).toBe(100);
  });

  // -------------------------------------------------------------------------
  // POST /echo -- ZodValidationPipe (pass-through global sans schema)
  // -------------------------------------------------------------------------

  it('POST /echo avec body JSON retourne 201 + body encapsule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { key: 'value', count: 42 },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body['success']).toBe(true);
    const data = body['data'] as Record<string, unknown>;
    expect(data?.['key']).toBe('value');
    expect(data?.['count']).toBe(42);
  });

  it('POST /echo sans body retourne 201 (ZodValidationPipe pass-through)', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo' });
    expect(res.statusCode).toBe(201);
  });

  // -------------------------------------------------------------------------
  // Erreur 404 : Content-Type JSON
  // -------------------------------------------------------------------------

  it('GET /route-inconnue : Content-Type application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/route-inconnue' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
