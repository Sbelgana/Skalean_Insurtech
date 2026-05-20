/**
 * Tests security bootstrap -- valide l'enregistrement des plugins Fastify
 * de securite (Helmet, CORS, Compress).
 *
 * Strategy :
 *   - Mock NestFastifyApplication.register() pour capturer les appels.
 *   - Valide l'ordre d'enregistrement des plugins.
 *   - Valide les options CORS (origins, methodes, headers).
 *   - Valide les constantes exportees.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.5 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '@insurtech/shared-config';
import {
  registerSecurity,
  ALLOWED_HTTP_METHODS,
  ALLOWED_HEADERS,
  COMPRESSION_THRESHOLD_BYTES,
} from './security';

// ============================================================================
// Helpers
// ============================================================================

/** Cree un mock Env Zod-valide minimal pour les tests de security. */
function makeMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    API_PORT: 4000,
    LOG_LEVEL: 'info',
    APP_VERSION: '0.0.0',
    TZ: 'Africa/Casablanca',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_POOL_MIN: 2,
    DATABASE_POOL_MAX: 20,
    DATABASE_LOG: false,
    REDIS_URL: 'redis://localhost:6379',
    KAFKA_BROKERS: ['localhost:9092'],
    KAFKA_CLIENT_ID: 'test-client',
    KAFKA_GROUP_ID: 'test-group',
    S3_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
    S3_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    S3_REGION: 'ma-bgr-1',
    S3_FORCE_PATH_STYLE: false,
    JWT_SECRET: 'super-secret-jwt-key-at-least-32-chars-long-!',
    JWT_REFRESH_SECRET: 'super-secret-refresh-key-at-least-32-chars-long',
    MFA_SECRET_ENCRYPTION_KEY: 'mfa-encryption-key-at-least-32-chars-long-!!!',
    PASSWORD_PEPPER: 'password-pepper-16chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
    ARGON2_MEMORY_COST: 65536,
    ARGON2_TIME_COST: 3,
    ARGON2_PARALLELISM: 4,
    EMAIL_SMTP_HOST: 'localhost',
    EMAIL_SMTP_PORT: 1025,
    EMAIL_FROM_ADDRESS: 'test@example.com',
    EMAIL_FROM_NAME: 'Test',
    SKALEAN_AI_BASE_URL: 'http://localhost:9999/mock',
    SKALEAN_AI_API_KEY: 'mock-key',
    SKALEAN_AI_USE_MOCK: true,
    OTEL_DEBUG: false,
    OTEL_SERVICE_NAME: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    NEXT_PUBLIC_API_URL: 'http://localhost:4000',
    MCP_SERVER_URL: 'http://localhost:4001',
    ...overrides,
  } as Env;
}

/** Cree un mock NestFastifyApplication avec register() capturant les plugins. */
function makeMockApp(): {
  app: NestFastifyApplication;
  registeredPlugins: Array<{ plugin: unknown; options: unknown }>;
} {
  const registeredPlugins: Array<{ plugin: unknown; options: unknown }> = [];
  const app = {
    register: vi.fn(async (plugin: unknown, options: unknown) => {
      registeredPlugins.push({ plugin, options });
    }),
  } as unknown as NestFastifyApplication;
  return { app, registeredPlugins };
}

// ============================================================================
// Tests constantes exportees
// ============================================================================

describe('ALLOWED_HTTP_METHODS', () => {
  it('inclut GET, POST, PUT, PATCH, DELETE, OPTIONS', () => {
    expect(ALLOWED_HTTP_METHODS).toContain('GET');
    expect(ALLOWED_HTTP_METHODS).toContain('POST');
    expect(ALLOWED_HTTP_METHODS).toContain('PUT');
    expect(ALLOWED_HTTP_METHODS).toContain('PATCH');
    expect(ALLOWED_HTTP_METHODS).toContain('DELETE');
    expect(ALLOWED_HTTP_METHODS).toContain('OPTIONS');
  });
});

describe('ALLOWED_HEADERS', () => {
  it('inclut Content-Type et Authorization', () => {
    expect(ALLOWED_HEADERS).toContain('Content-Type');
    expect(ALLOWED_HEADERS).toContain('Authorization');
  });

  it('inclut X-Request-ID et X-Tenant-ID (multi-tenant)', () => {
    expect(ALLOWED_HEADERS).toContain('X-Request-ID');
    expect(ALLOWED_HEADERS).toContain('X-Tenant-ID');
  });
});

describe('COMPRESSION_THRESHOLD_BYTES', () => {
  it('est egal a 1024 (1 KB)', () => {
    expect(COMPRESSION_THRESHOLD_BYTES).toBe(1024);
  });
});

// ============================================================================
// Tests registerSecurity()
// ============================================================================

describe('registerSecurity()', () => {
  let registeredPlugins: Array<{ plugin: unknown; options: unknown }>;
  let app: NestFastifyApplication;

  beforeEach(() => {
    const mock = makeMockApp();
    app = mock.app;
    registeredPlugins = mock.registeredPlugins;
  });

  it('enregistre exactement 3 plugins (helmet, cors, compress)', async () => {
    await registerSecurity(app, makeMockEnv());
    expect(registeredPlugins).toHaveLength(3);
  });

  it('enregistre les plugins dans l ordre : helmet -> cors -> compress', async () => {
    // Importe les vrais plugins pour identifier via reference.
    const helmetMod = await import('@fastify/helmet');
    const corsMod = await import('@fastify/cors');
    const compressMod = await import('@fastify/compress');
    const helmetPlugin = helmetMod.default;
    const corsPlugin = corsMod.default;
    const compressPlugin = compressMod.default;

    await registerSecurity(app, makeMockEnv());

    expect(registeredPlugins[0]?.plugin).toBe(helmetPlugin);
    expect(registeredPlugins[1]?.plugin).toBe(corsPlugin);
    expect(registeredPlugins[2]?.plugin).toBe(compressPlugin);
  });

  it('configure CORS avec les origins de env.CORS_ORIGINS', async () => {
    const origins = ['https://app1.example.com', 'https://app2.example.com'];
    await registerSecurity(app, makeMockEnv({ CORS_ORIGINS: origins }));

    const corsOptions = registeredPlugins[1]?.options as Record<string, unknown>;
    expect(corsOptions?.origin).toEqual(origins);
  });

  it('configure CORS avec credentials: true', async () => {
    await registerSecurity(app, makeMockEnv());
    const corsOptions = registeredPlugins[1]?.options as Record<string, unknown>;
    expect(corsOptions?.credentials).toBe(true);
  });

  it('configure CORS avec maxAge: 86400 (24h pre-flight)', async () => {
    await registerSecurity(app, makeMockEnv());
    const corsOptions = registeredPlugins[1]?.options as Record<string, unknown>;
    expect(corsOptions?.maxAge).toBe(86400);
  });

  it('configure compression avec threshold COMPRESSION_THRESHOLD_BYTES', async () => {
    await registerSecurity(app, makeMockEnv());
    const compressOptions = registeredPlugins[2]?.options as Record<string, unknown>;
    expect(compressOptions?.threshold).toBe(COMPRESSION_THRESHOLD_BYTES);
  });

  it('configure compression avec encodings gzip et deflate', async () => {
    await registerSecurity(app, makeMockEnv());
    const compressOptions = registeredPlugins[2]?.options as Record<string, unknown>;
    expect(compressOptions?.encodings).toContain('gzip');
    expect(compressOptions?.encodings).toContain('deflate');
  });

  it('desactive HSTS helmet en env test (non production)', async () => {
    await registerSecurity(app, makeMockEnv({ NODE_ENV: 'test' }));
    const helmetOptions = registeredPlugins[0]?.options as Record<string, unknown>;
    expect(helmetOptions?.hsts).toBe(false);
  });

  it('active HSTS helmet en env production avec maxAge 1 an', async () => {
    await registerSecurity(app, makeMockEnv({ NODE_ENV: 'production' }));
    const helmetOptions = registeredPlugins[0]?.options as Record<string, unknown>;
    expect(helmetOptions?.hsts).toMatchObject({
      maxAge: 31536000,
      includeSubDomains: true,
    });
  });

  it('appelle app.register() exactement 3 fois', async () => {
    await registerSecurity(app, makeMockEnv());
    expect(app.register).toHaveBeenCalledTimes(3);
  });
});
