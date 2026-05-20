/**
 * Tests unitaires pour main.ts (bootstrap orchestrator).
 *
 * Verifient le comportement de la fonction bootstrap :
 * - Ordre d'initialisation (telemetry FIRST, puis NestFactory)
 * - Configuration FastifyAdapter (trustProxy, bodyLimit)
 * - Options NestFactory (bufferLogs: true)
 * - Bind 0.0.0.0 pour Docker
 * - Gestion erreur (process.exit(1) si bootstrap fail)
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyEnvFixture,
  clearEnvFixture,
  VALID_ENV_FIXTURE,
} from '../test/fixtures/env-fixtures';

/** Env minimal retourne par le mock loadEnv. */
const MOCK_ENV = {
  API_PORT: 14000,
  NODE_ENV: 'test' as const,
  APP_VERSION: '0.0.0',
};

/** Cree un mock app NestJS minimal. */
/** Mock Logger Pino retourne par app.get(Logger) (Tache 1.3.3). */
function makeMockPinoLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    fatal: vi.fn(),
  };
}

function makeMockApp(listenFn?: (port: number, host: string) => Promise<void>) {
  const pinoLogger = makeMockPinoLogger();
  return {
    useLogger: vi.fn(),
    useGlobalPipes: vi.fn(),
    useGlobalInterceptors: vi.fn(),
    useGlobalFilters: vi.fn(),
    enableShutdownHooks: vi.fn(),
    listen: vi.fn(listenFn ?? ((_p: number, _h: string) => Promise.resolve())),
    close: vi.fn(() => Promise.resolve()),
    // app.get(Logger) retourne le mock Pino logger (Tache 1.3.3).
    get: vi.fn(() => pinoLogger),
    // app.register() pour les plugins Fastify (security -- Tache 1.3.5).
    register: vi.fn(async () => {}),
  };
}

/** Registre les mocks communs pour les tests bootstrap. */
function setupCommonMocks(options: { listenFn?: (port: number, host: string) => Promise<void> } = {}) {
  vi.doMock('@insurtech/shared-utils/telemetry', () => ({
    startTelemetry: vi.fn(),
    shutdownTelemetry: vi.fn(),
  }));
  vi.doMock('@insurtech/shared-config', () => ({
    loadEnv: vi.fn(() => MOCK_ENV),
    resetEnvCache: vi.fn(),
  }));
  const createSpy = vi.fn(() => Promise.resolve(makeMockApp(options.listenFn)));
  vi.doMock('@nestjs/core', () => ({
    NestFactory: { create: createSpy },
  }));
  vi.doMock('@nestjs/common', () => ({
    Module: () => () => {},
    Controller: () => () => {},
    Get: () => () => {},
    Header: () => () => {},
    Injectable: () => () => {},
  }));
  // Mock nestjs-pino : main.ts importe Logger depuis nestjs-pino (Tache 1.3.3).
  vi.doMock('nestjs-pino', () => ({
    Logger: class MockNestjsPinoLogger {
      log = vi.fn();
      warn = vi.fn();
      error = vi.fn();
    },
  }));
  vi.doMock('@nestjs/platform-fastify', () => ({
    FastifyAdapter: vi.fn(() => ({})),
  }));
  vi.doMock('./app.module', () => ({ AppModule: class AppModule {} }));
  vi.doMock('./bootstrap/graceful-shutdown', () => ({
    registerGracefulShutdown: vi.fn(),
    resetShutdownStateForTesting: vi.fn(),
  }));
  vi.doMock('./bootstrap/start-time-logger', () => ({
    measureBootTime: vi.fn(() => 100),
    BOOT_TIME_WARNING_THRESHOLD_MS: 5000,
  }));
  // Mock security bootstrap (Tache 1.3.5) : evite les plugins Fastify reels.
  vi.doMock('./bootstrap/security', () => ({
    registerSecurity: vi.fn(async () => {}),
  }));
  // Mock ZodValidationPipe (Tache 1.3.6) : evite import zod dans bootstrap tests.
  vi.doMock('./pipes/zod-validation.pipe', () => ({
    ZodValidationPipe: class MockZodValidationPipe {
      transform = vi.fn((v: unknown) => v);
    },
  }));
  // Mock ResponseInterceptor (Tache 1.3.7) : evite import rxjs dans bootstrap tests.
  vi.doMock('./interceptors/response.interceptor', () => ({
    ResponseInterceptor: class MockResponseInterceptor {
      intercept = vi.fn((_ctx: unknown, next: { handle: () => unknown }) => next.handle());
    },
  }));
  // Mock AllExceptionsFilter (Tache 1.3.8) : evite import nestjs dans bootstrap tests.
  vi.doMock('./filters/all-exceptions.filter', () => ({
    AllExceptionsFilter: class MockAllExceptionsFilter {
      catch = vi.fn();
    },
  }));
  // Mock SwaggerModule (Tache 1.3.9) : evite @nestjs/swagger dans bootstrap tests.
  vi.doMock('./swagger/swagger.module', () => ({
    SwaggerModule: { setup: vi.fn() },
  }));
  return { createSpy };
}

describe('main.ts bootstrap', () => {
  beforeEach(() => {
    applyEnvFixture(VALID_ENV_FIXTURE);
    vi.resetModules();
  });

  afterEach(() => {
    clearEnvFixture(VALID_ENV_FIXTURE);
    vi.restoreAllMocks();
  });

  it('calls startTelemetry before NestFactory.create', async () => {
    const callOrder: string[] = [];

    vi.doMock('@insurtech/shared-utils/telemetry', () => ({
      startTelemetry: vi.fn(() => callOrder.push('telemetry')),
      shutdownTelemetry: vi.fn(),
    }));
    vi.doMock('@insurtech/shared-config', () => ({
      loadEnv: vi.fn(() => MOCK_ENV),
      resetEnvCache: vi.fn(),
    }));
    vi.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: vi.fn(() => {
          callOrder.push('nestfactory');
          return Promise.resolve(makeMockApp());
        }),
      },
    }));
    vi.doMock('@nestjs/common', () => ({
      Module: () => () => {},
      Controller: () => () => {},
      Get: () => () => {},
      Header: () => () => {},
      Injectable: () => () => {},
    }));
    // Logger importe depuis nestjs-pino (Tache 1.3.3).
    vi.doMock('nestjs-pino', () => ({
      Logger: class MockNestjsPinoLogger {
        log = vi.fn();
        warn = vi.fn();
        error = vi.fn();
      },
    }));
    vi.doMock('@nestjs/platform-fastify', () => ({
      FastifyAdapter: vi.fn(() => ({})),
    }));
    vi.doMock('./app.module', () => ({ AppModule: class AppModule {} }));
    vi.doMock('./bootstrap/graceful-shutdown', () => ({
      registerGracefulShutdown: vi.fn(),
      resetShutdownStateForTesting: vi.fn(),
    }));
    vi.doMock('./bootstrap/start-time-logger', () => ({
      measureBootTime: vi.fn(() => 100),
      BOOT_TIME_WARNING_THRESHOLD_MS: 5000,
    }));
    vi.doMock('./bootstrap/security', () => ({
      registerSecurity: vi.fn(async () => {}),
    }));
    vi.doMock('./pipes/zod-validation.pipe', () => ({
      ZodValidationPipe: class MockZodValidationPipe {
        transform = vi.fn((v: unknown) => v);
      },
    }));
    vi.doMock('./interceptors/response.interceptor', () => ({
      ResponseInterceptor: class MockResponseInterceptor {
        intercept = vi.fn((_ctx: unknown, next: { handle: () => unknown }) => next.handle());
      },
    }));
    vi.doMock('./filters/all-exceptions.filter', () => ({
      AllExceptionsFilter: class MockAllExceptionsFilter {
        catch = vi.fn();
      },
    }));
    vi.doMock('./swagger/swagger.module', () => ({
      SwaggerModule: { setup: vi.fn() },
    }));

    const { ready } = await import('./main');
    await ready;

    expect(callOrder.indexOf('telemetry')).toBeLessThan(callOrder.indexOf('nestfactory'));
  });

  it('passes bufferLogs: true to NestFactory.create', async () => {
    const { createSpy } = setupCommonMocks();

    const { ready } = await import('./main');
    await ready;

    // Type assertion through unknown to access the third argument safely.
    const calls = createSpy.mock.calls as unknown as Array<[unknown, unknown, Record<string, unknown>]>;
    const thirdArg = calls[0]?.[2];
    expect(thirdArg).toMatchObject({ bufferLogs: true });
  });

  it('configures FastifyAdapter with trustProxy: true and bodyLimit: 10485760', async () => {
    const adapterSpy = vi.fn(() => ({}));
    vi.doMock('@insurtech/shared-utils/telemetry', () => ({
      startTelemetry: vi.fn(),
      shutdownTelemetry: vi.fn(),
    }));
    vi.doMock('@insurtech/shared-config', () => ({
      loadEnv: vi.fn(() => MOCK_ENV),
      resetEnvCache: vi.fn(),
    }));
    vi.doMock('@nestjs/core', () => ({
      NestFactory: { create: vi.fn(() => Promise.resolve(makeMockApp())) },
    }));
    vi.doMock('@nestjs/common', () => ({
      Module: () => () => {},
      Controller: () => () => {},
      Get: () => () => {},
      Header: () => () => {},
      Injectable: () => () => {},
    }));
    // Logger importe depuis nestjs-pino (Tache 1.3.3).
    vi.doMock('nestjs-pino', () => ({
      Logger: class MockNestjsPinoLogger {
        log = vi.fn();
        warn = vi.fn();
        error = vi.fn();
      },
    }));
    vi.doMock('@nestjs/platform-fastify', () => ({
      FastifyAdapter: adapterSpy,
    }));
    vi.doMock('./app.module', () => ({ AppModule: class AppModule {} }));
    vi.doMock('./bootstrap/graceful-shutdown', () => ({
      registerGracefulShutdown: vi.fn(),
      resetShutdownStateForTesting: vi.fn(),
    }));
    vi.doMock('./bootstrap/start-time-logger', () => ({
      measureBootTime: vi.fn(() => 100),
      BOOT_TIME_WARNING_THRESHOLD_MS: 5000,
    }));
    vi.doMock('./bootstrap/security', () => ({
      registerSecurity: vi.fn(async () => {}),
    }));
    vi.doMock('./pipes/zod-validation.pipe', () => ({
      ZodValidationPipe: class MockZodValidationPipe {
        transform = vi.fn((v: unknown) => v);
      },
    }));
    vi.doMock('./interceptors/response.interceptor', () => ({
      ResponseInterceptor: class MockResponseInterceptor {
        intercept = vi.fn((_ctx: unknown, next: { handle: () => unknown }) => next.handle());
      },
    }));
    vi.doMock('./filters/all-exceptions.filter', () => ({
      AllExceptionsFilter: class MockAllExceptionsFilter {
        catch = vi.fn();
      },
    }));
    vi.doMock('./swagger/swagger.module', () => ({
      SwaggerModule: { setup: vi.fn() },
    }));

    const { ready } = await import('./main');
    await ready;

    expect(adapterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ trustProxy: true, bodyLimit: 10485760 }),
    );
  });

  it('calls app.listen with API_PORT from env and API_HOST from process.env', async () => {
    const listenSpy = vi.fn(() => Promise.resolve());
    setupCommonMocks({ listenFn: listenSpy });

    const { ready } = await import('./main');
    await ready;

    // API_PORT=14000 from MOCK_ENV, API_HOST=127.0.0.1 from VALID_ENV_FIXTURE
    expect(listenSpy).toHaveBeenCalledWith(14000, '127.0.0.1');
  });

  it('calls process.exit(1) on bootstrap failure', async () => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    vi.doMock('@insurtech/shared-utils/telemetry', () => ({
      startTelemetry: vi.fn(() => {
        throw new Error('Telemetry init failed');
      }),
      shutdownTelemetry: vi.fn(),
    }));
    vi.doMock('@insurtech/shared-config', () => ({
      loadEnv: vi.fn(() => MOCK_ENV),
      resetEnvCache: vi.fn(),
    }));
    vi.doMock('@nestjs/core', () => ({
      NestFactory: { create: vi.fn() },
    }));
    vi.doMock('@nestjs/common', () => ({
      Module: () => () => {},
    }));
    // Logger importe depuis nestjs-pino (Tache 1.3.3).
    vi.doMock('nestjs-pino', () => ({
      Logger: class MockNestjsPinoLogger {
        log = vi.fn();
        warn = vi.fn();
        error = vi.fn();
      },
    }));
    vi.doMock('@nestjs/platform-fastify', () => ({
      FastifyAdapter: vi.fn(() => ({})),
    }));
    vi.doMock('./app.module', () => ({ AppModule: class AppModule {} }));
    vi.doMock('./bootstrap/graceful-shutdown', () => ({
      registerGracefulShutdown: vi.fn(),
    }));
    vi.doMock('./bootstrap/start-time-logger', () => ({
      measureBootTime: vi.fn(() => 100),
      BOOT_TIME_WARNING_THRESHOLD_MS: 5000,
    }));
    vi.doMock('./bootstrap/security', () => ({
      registerSecurity: vi.fn(async () => {}),
    }));
    vi.doMock('./pipes/zod-validation.pipe', () => ({
      ZodValidationPipe: class MockZodValidationPipe {
        transform = vi.fn((v: unknown) => v);
      },
    }));
    vi.doMock('./interceptors/response.interceptor', () => ({
      ResponseInterceptor: class MockResponseInterceptor {
        intercept = vi.fn((_ctx: unknown, next: { handle: () => unknown }) => next.handle());
      },
    }));
    vi.doMock('./filters/all-exceptions.filter', () => ({
      AllExceptionsFilter: class MockAllExceptionsFilter {
        catch = vi.fn();
      },
    }));
    vi.doMock('./swagger/swagger.module', () => ({
      SwaggerModule: { setup: vi.fn() },
    }));

    const { ready } = await import('./main');
    await ready;

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
