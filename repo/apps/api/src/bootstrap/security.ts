/**
 * Enregistrement des plugins de securite Fastify pour Skalean InsurTech v2.2 API.
 *
 * Plugins enregistres dans l'ordre (l'ordre importe pour Fastify) :
 *   1. @fastify/helmet   -- en-tetes HTTP de securite (CSP, HSTS, etc.).
 *   2. @fastify/cors     -- politique CORS multi-origines depuis env.CORS_ORIGINS.
 *   3. @fastify/compress -- compression gzip/deflate reponses (seuil 1 KB).
 *
 * Le body limit est configure dans FastifyAdapter (bodyLimit option) -- Tache 1.3.1.
 *
 * Reference : decision-003 (NestJS Fastify) + decision-006 (no-emoji).
 * Tache : 1.3.5 (Sprint 3 / Phase 1).
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import type { Env } from '@insurtech/shared-config';

/**
 * Methodes HTTP autorisees pour toutes les routes API.
 * OPTIONS est inclus pour les pre-flight CORS.
 */
export const ALLOWED_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;

/**
 * En-tetes HTTP autorises dans les requetes entrantes.
 * X-Request-ID : idempotency + tracing.
 * X-Tenant-ID  : multi-tenant 3 niveaux (decision-002).
 */
export const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Request-ID',
  'X-Tenant-ID',
  'Accept',
  'Accept-Language',
] as const;

/**
 * Seuil (bytes) en dessous duquel la reponse n'est pas compressee.
 * 1024 bytes = 1 KB : evite surcharge CPU pour petites reponses JSON.
 */
export const COMPRESSION_THRESHOLD_BYTES = 1024;

/**
 * Enregistre les plugins de securite Fastify sur l'application NestJS.
 *
 * Doit etre appele APRES `NestFactory.create()` et AVANT `app.listen()`.
 * Voir `main.ts` pour l'ordre strict de boot.
 *
 * @param app - Instance NestFastifyApplication (post-NestFactory.create).
 * @param env - Variables d'environnement validees par Zod (loadEnv()).
 */
export async function registerSecurity(
  app: NestFastifyApplication,
  env: Env,
): Promise<void> {
  // ===== 1. Helmet -- en-tetes de securite HTTP =====
  // Protege contre XSS, clickjacking, sniffing MIME, etc.
  // CSP restreint : uniquement 'self' par defaut (Sprint 27 admin assouplit si besoin).
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // HSTS : 1 an + includeSubDomains (HTTPS only prod).
    // Desactive en dev (non-HTTPS).
    hsts:
      env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    // Referrer policy strict : ne pas leaker URLs dans Referer header.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Cross-Origin-Embedder-Policy : requis pour SharedArrayBuffer.
    crossOriginEmbedderPolicy: false,
  });

  // ===== 2. CORS -- politique multi-origines =====
  // Origins autorises : env.CORS_ORIGINS (liste CSV depuis .env).
  // Defaults dev : localhost:3000-3006 (8 frontends Sprint 3).
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ALLOWED_HTTP_METHODS as unknown as string[],
    allowedHeaders: ALLOWED_HEADERS as unknown as string[],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    // 24h cache du pre-flight OPTIONS.
    maxAge: 86400,
    // Strict : OPTIONS seul ne suffit pas, doit matcher method + header.
    strictPreflight: true,
    preflight: true,
  });

  // ===== 3. Compression -- gzip reponses =====
  // Threshold : ne compresse pas si reponse < 1 KB (overhead > gain).
  // Encodings : gzip prioritaire, deflate fallback. Brotli desactive (CPU).
  await app.register(compress, {
    global: true,
    threshold: COMPRESSION_THRESHOLD_BYTES,
    encodings: ['gzip', 'deflate'],
    // Desactive pour les flux (SSE, websocket) -- gere par Sprint 31.
    removeContentLengthHeader: true,
  });
}
