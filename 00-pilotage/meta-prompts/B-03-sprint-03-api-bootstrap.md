# META-PROMPT B-03 -- SPRINT 3 API BOOTSTRAP NESTJS

**Version** : v2.2 (Option B)
**Phase** : 1 -- Bootstrap
**Sprint** : 3 / 35 (cumul)
**Position** : Phase 1 Sprint 3 -- juste apres Database+Kafka
**Numerotation taches** : 1.3.1 a 1.3.15
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous les sprints metier consommant l'API)

---

## Objectif Global du Sprint

Etablir le **squelette complet du backend NestJS** qui sera l'unique API consommee par les 8 apps frontend. A la sortie de ce sprint, l'API expose des endpoints `/healthz`, `/readyz`, `/api/v1/public/*`, est documentee via Swagger, et tous les transverses (logger, traces, validation, rate limiting, exception handling, multi-tenant header) sont operationnels. Les sprints suivants (Auth, Multi-tenant, CRM, etc.) ajouteront des modules metier a cette API.

A la sortie de ce sprint :
- API NestJS 10.4 + Fastify adapter demarre sur port 4000 en < 5s
- Endpoint `/healthz` retourne 200 OK
- Endpoint `/readyz` verifie DB + Redis + Kafka connectivity
- Swagger UI accessible sur `/docs` documentant les endpoints (vide initialement, peuple Sprint 5+)
- Logs Pino structures avec PII redaction active
- Traces OpenTelemetry capturees sur chaque request
- Exception filter unifie : reponses erreur format `{ error, code, traceId, details }`
- Response interceptor : reponses success format `{ data, meta, traceId }`
- ZodValidationPipe global (refuse body invalide)
- Header `x-tenant-id` mandatory partout sauf `/api/v1/public/*`
- Rate limiting actif (per IP + per user + per tenant)
- BullMQ ready a recevoir des jobs (Redis-backed)
- Sentry integre (configurable via SENTRY_DSN)
- Tests E2E smoke tests + healthcheck passent

---

## Frontiere du Sprint

**INCLUS** :
- NestJS 10.4 + Fastify adapter setup
- Structure modulaire (AppModule + sous-modules empty stubs)
- Logger Pino via `nestjs-pino` integration
- OpenTelemetry traces auto-instrumentes
- Global middlewares : Helmet, CORS, compression, body limit
- ZodValidationPipe + ResponseInterceptor + ExceptionFilter
- Swagger OpenAPI 3.0 setup
- Health endpoints (liveness + readiness)
- BullMQ JobsModule (pas de jobs metier, juste integration)
- Sentry SDK integration
- Rate limiting via @nestjs/throttler + Redis storage
- PublicEndpointGuard + @Public() decorator
- AsyncLocalStorage RequestContext (utilise Sprint 6 pour tenant)
- Tests E2E smoke

**EXCLU** (sera ajoute aux sprints suivants) :
- Logique metier (Auth Sprint 5, Multi-tenant Sprint 6, RBAC Sprint 7, CRM Sprint 8, etc.)
- Connexion frontend (Sprint 4 Frontend Bootstrap)
- Authentication JWT + MFA (Sprint 5)
- Endpoints publics SEO (Sprint 18 Customer Portal)
- Service Skalean AI (Sprints 30-32 deferes AI-3)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles transverses + format API
2. `00-pilotage/documentation/4-templates-generation.md` -- pattern 1 service NestJS (utilise Sprint 5+)
3. `00-pilotage/documentation/2-variables-environnement.env` -- ENV API (CORS_ORIGINS, SENTRY_DSN, etc.)
4. Sortie Sprint 1 : `repo/packages/shared-config/`, `shared-utils/logger`, `shared-utils/telemetry`
5. Sortie Sprint 2 : `repo/packages/database/` (DataSource), `shared-events/` (KafkaPublisher + Consumer)

---

## Stack Imposee (Sprint 3)

| Composant | Version | Notes |
|-----------|---------|-------|
| NestJS | 10.4.15 | framework principal |
| @nestjs/platform-fastify | 10.4.15 | Fastify adapter (perf > Express) |
| Fastify | 4.28.1 | http server |
| @fastify/helmet | 12.0.1 | security headers |
| @fastify/compress | 8.0.1 | gzip/brotli |
| nestjs-pino | 4.2.0 | Pino integration NestJS |
| @nestjs/swagger | 8.0.7 | OpenAPI 3.0 |
| @nestjs/terminus | 11.0.0 | health checks |
| @nestjs/throttler | 6.2.1 | rate limiting |
| @nestjs/bullmq | 11.0.1 | jobs queue |
| bullmq | 5.30.1 | queue |
| @sentry/nestjs | 8.43.0 | error monitoring |
| zod | 3.24.1 | validation (deja Sprint 1) |
| ioredis | 5.4.1 | rate limiting + cache |
| nestjs-zod | 4.0.0 | bridge Zod -> NestJS pipes/swagger |

---

## Vue d'Ensemble des 15 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 1.3.1 | NestJS 10.4 + Fastify adapter setup + main.ts complet | 5h | P0 | Sprint 2 |
| 1.3.2 | AppModule + ConfigModule racine + structure modulaire | 4h | P0 | 1.3.1 |
| 1.3.3 | Pino logger integration via nestjs-pino | 3h | P0 | 1.3.2 |
| 1.3.4 | OpenTelemetry traces + RequestContextMiddleware (AsyncLocalStorage) | 5h | P0 | 1.3.3 |
| 1.3.5 | Helmet + CORS strict per-app + compression + body limit | 4h | P0 | 1.3.4 |
| 1.3.6 | ZodValidationPipe global (au lieu de class-validator) | 4h | P0 | 1.3.5 |
| 1.3.7 | ResponseInterceptor -- format API standardise | 4h | P0 | 1.3.6 |
| 1.3.8 | ExceptionFilter global -- erreurs structurees + redaction PII | 5h | P0 | 1.3.7 |
| 1.3.9 | Swagger OpenAPI 3.0 setup | 4h | P0 | 1.3.8 |
| 1.3.10 | HealthModule -- /healthz et /readyz | 4h | P0 | 1.3.9 |
| 1.3.11 | BullMQ integration -- JobsModule | 5h | P0 | 1.3.10 |
| 1.3.12 | Sentry integration | 4h | P0 | 1.3.11 |
| 1.3.13 | Rate limiting global -- @nestjs/throttler + Redis | 5h | P0 | 1.3.12 |
| 1.3.14 | PublicEndpointGuard + @Public() decorator | 4h | P0 | 1.3.13 |
| 1.3.15 | Tests E2E bootstrap -- smoke tests + healthcheck + 404/500 | 5h | P0 | 1.3.14 |

**Total** : 65 heures.

---

# DETAIL DES 15 TACHES

---

## Tache 1.3.1 -- NestJS 10.4 + Fastify Adapter Setup

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 5h / Depend de Sprint 2

**But** : Initialiser l'application NestJS avec Fastify adapter (perf 30% > Express), configuration boot complete, et `main.ts` orchestrant tous les transverses.

**Contexte** : Fastify est plus rapide qu'Express (~30% throughput) et plus strict sur la validation HTTP. NestJS 10 supporte officiellement Fastify via `@nestjs/platform-fastify`. main.ts doit orchestrer dans le bon ordre : telemetry FIRST (avant tout import metier), puis app, puis middlewares globaux.

**Livrables checkables** :
- [ ] `repo/apps/api/package.json` enrichi avec deps NestJS 10.4 + Fastify
- [ ] `repo/apps/api/tsconfig.json` avec `experimentalDecorators: true` + `emitDecoratorMetadata: true`
- [ ] `repo/apps/api/nest-cli.json` configurant build NestJS
- [ ] `repo/apps/api/src/main.ts` complet : initialise telemetry FIRST, cree app NestJS Fastify, applique middlewares globaux dans ordre correct, demarre serveur sur port 4000
- [ ] `repo/apps/api/src/app.module.ts` skeleton (peuple Tache 1.3.2)
- [ ] `repo/apps/api/src/app.controller.ts` minimal (root endpoint `GET /` retourne `{ name, version, env }`)
- [ ] `repo/apps/api/src/main.ts` lit `loadEnv()` AVANT toute creation app
- [ ] Graceful shutdown : SIGTERM/SIGINT -> close DB + Redis + Kafka + telemetry + app
- [ ] Trust proxy active (pour `X-Forwarded-For` derriere reverse proxy prod)
- [ ] Body limit 10MB par defaut
- [ ] App demarre en < 5s sur machine dev
- [ ] `curl http://localhost:4000/` retourne JSON `{ name: 'skalean-insurtech-api', version: '0.1.0', env: 'development' }`
- [ ] Process exit 0 sur SIGTERM (pas exit 137 timeout)

**Pattern critique : ordre boot main.ts**

```typescript
// repo/apps/api/src/main.ts
import 'reflect-metadata';
import { startTelemetry } from '@insurtech/shared-utils/telemetry';
startTelemetry(); // FIRST -- avant tout autre import

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadEnv } from '@insurtech/shared-config';
import { AppModule } from './app.module';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 10 * 1024 * 1024 }),
    { bufferLogs: true }
  );
  // ... middlewares globaux (Taches 1.3.3-1.3.13)
  await app.listen(env.API_PORT, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('Fatal boot error', err);
  process.exit(1);
});
```

**Fichiers crees / modifies** :
```
repo/apps/api/package.json                  # ~50 lignes (deps NestJS + Fastify + workspace)
repo/apps/api/tsconfig.json                  # avec decorators support
repo/apps/api/nest-cli.json                  # ~10 lignes
repo/apps/api/src/main.ts                    # ~80 lignes (avec graceful shutdown)
repo/apps/api/src/app.module.ts              # skeleton (peuple 1.3.2)
repo/apps/api/src/app.controller.ts          # ~25 lignes
repo/apps/api/src/app.service.ts             # ~15 lignes
repo/apps/api/.env.example                   # variables specifiques API
```

**Notes implementation** :
- `bufferLogs: true` evite logs avant que nestjs-pino soit ready (Tache 1.3.3 takeover)
- `trustProxy: true` requis derriere LB/reverse proxy prod (sinon `req.ip` retourne IP du proxy)
- Body limit 10MB : adapte aux uploads photos (Sprint 21 IA Estimation jusqu'a 10MB par photo)
- Graceful shutdown : timeout 30s (sinon kill -9 forcement par Kubernetes)
- `process.exit(0)` apres app.close() reussi
- `0.0.0.0` listen (pas `localhost`) sinon Docker container externe pas accessible

**Criteres validation** :
- V1 (P0) : `pnpm --filter @insurtech/api dev` reussit
- V2 (P0) : App demarre en < 5s
- V3 (P0) : `curl http://localhost:4000/` retourne JSON valide
- V4 (P0) : `kill -SIGTERM <pid>` -> exit code 0 en < 30s
- V5 (P0) : Telemetry initialise AVANT app NestJS
- V6 (P0) : Body > 10MB rejete (HTTP 413)
- V7 (P0) : `trustProxy` actif (header X-Forwarded-For respecte)
- V8 (P1) : Tests E2E basique (Tache 1.3.15) : GET / retourne 200

---

## Tache 1.3.2 -- AppModule + ConfigModule + Structure Modulaire

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.1

**But** : Definir la structure modulaire de l'API : AppModule racine + ConfigModule global + DatabaseModule + 14 modules metier stubs (peuples Sprints suivants).

**Livrables checkables** :
- [ ] `repo/apps/api/src/app.module.ts` import des modules transverses globaux + modules metier
- [ ] `repo/apps/api/src/config/config.module.ts` -- wraps `@insurtech/shared-config` en NestJS Module
- [ ] `repo/apps/api/src/config/config.module.ts` Global module (annotation `@Global()`)
- [ ] `repo/apps/api/src/database/database.module.ts` -- import TypeORM AppDataSource
- [ ] Modules metier stubs (empty `@Module({})` placeholder) :
  - `auth.module.ts` (Sprint 5)
  - `tenant.module.ts` (Sprint 6)
  - `rbac.module.ts` (Sprint 7)
  - `crm.module.ts` (Sprint 8)
  - `booking.module.ts` (Sprint 8)
  - `comm.module.ts` (Sprint 9)
  - `docs.module.ts` (Sprint 10)
  - `signature.module.ts` (Sprint 10)
  - `pay.module.ts` (Sprint 11)
  - `books.module.ts` (Sprint 12)
  - `compliance.module.ts` (Sprint 12)
  - `analytics.module.ts` (Sprint 13)
  - `insure.module.ts` (Sprint 14)
  - `repair.module.ts` (Sprint 20)
  - `assure.module.ts` (Sprint 19)
  - `prospect.module.ts` (Sprint 18)
  - `admin.module.ts` (Sprint 27)
  - `skalean-ai.module.ts` (Sprint 30 defere)
  - `mcp.module.ts` (Sprint 31 defere)
- [ ] AppModule importe : ConfigModule (global), DatabaseModule (global), HealthModule (Tache 1.3.10), JobsModule (Tache 1.3.11), tous modules metier stubs
- [ ] Structure dossiers : `repo/apps/api/src/modules/{auth,tenant,...}/` (19 dossiers)

**Fichiers crees / modifies** :
```
repo/apps/api/src/app.module.ts                            # ~60 lignes (imports orchestres)
repo/apps/api/src/config/config.module.ts                  # ~25 lignes (Global)
repo/apps/api/src/config/config.service.ts                 # ~20 lignes (re-expose env)
repo/apps/api/src/database/database.module.ts              # ~30 lignes (import DataSource)
repo/apps/api/src/modules/{19 dossiers}/X.module.ts        # stubs ~5 lignes chacun
repo/apps/api/src/common/                                  # dossier pour filters/interceptors/pipes (peuple Taches 1.3.6-1.3.8)
```

**Notes implementation** :
- ConfigModule `@Global()` : evite imports redondants dans chaque module
- DatabaseModule expose `AppDataSource` via `@Global()` provider
- Modules metier stubs vides au Sprint 3 : juste `@Module({})` -- code metier ajoute au sprint correspondant
- Convention naming : `auth.module.ts` (singulier) -- pas `auth-module.ts`
- AppModule import order : transverses (Config, Database, Health, Jobs) PUIS metier
- Eviter circular imports : modules metier ne se referencent pas directement entre eux (passent par events Kafka)

**Criteres validation** :
- V1 (P0) : `pnpm --filter @insurtech/api build` compile sans erreur
- V2 (P0) : `pnpm --filter @insurtech/api dev` demarre, AppModule charge tous les sub-modules
- V3 (P0) : ConfigService injectable depuis n'importe quel service NestJS
- V4 (P0) : DataSource accessible depuis n'importe quel service
- V5 (P0) : 19 modules metier stubs presents (verifier `ls modules/`)
- V6 (P0) : Pas de circular import detecte au build
- V7 (P1) : Modules metier annotes `@Global()` quand pertinent

---

## Tache 1.3.3 -- Pino Logger Integration via nestjs-pino

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 3h / Depend de 1.3.2

**But** : Remplacer le logger NestJS par defaut par Pino (de Sprint 1) pour avoir logs structures + PII redaction unifie sur toute l'API.

**Livrables checkables** :
- [ ] Import `nestjs-pino` dans AppModule via `LoggerModule.forRoot({...})`
- [ ] Configuration Pino reutilise instance `logger` de `@insurtech/shared-utils/logger`
- [ ] Logger NestJS replace : `app.useLogger(app.get(Logger))`
- [ ] Auto-log requests : methode, url, status, duration, traceId, userAgent
- [ ] PII redaction active (deja Sprint 1) : password, cin, phone, email, tokens
- [ ] Custom log level mapping : debug = `log()`, error = `error()`, warn = `warn()`
- [ ] Pretty printing dev only (heritage logger Sprint 1)
- [ ] Logs JSON en prod (parsable Loki/Elasticsearch)
- [ ] Log au demarrage : `API listening on port 4000`
- [ ] Log au shutdown : `Graceful shutdown initiated` + `Shutdown complete`
- [ ] Tests : verifier qu'un endpoint loggue request + response

**Fichiers crees / modifies** :
```
repo/apps/api/src/app.module.ts                  # update : LoggerModule.forRoot
repo/apps/api/src/main.ts                         # update : app.useLogger
repo/apps/api/package.json                        # add : nestjs-pino, pino, pino-pretty, pino-http
```

**Notes implementation** :
- `nestjs-pino` integre Pino + Pino-http pour auto-log requests
- Reuse instance logger (Sprint 1) pour eviter 2 instances concurrentes
- `useLogger(app.get(Logger))` apres app.create() mais AVANT toute autre operation
- Custom serializers : `req` (extract method/url/headers selectifs), `res` (extract statusCode), `err` (extract message/stack)
- Anti-pattern : NE PAS utiliser `console.log` en code (Biome rule deja active Sprint 1)
- Trace ID injecte dans log : exploite OpenTelemetry context (Tache 1.3.4)

**Criteres validation** :
- V1 (P0) : Logs au format JSON structured (parse-able par jq)
- V2 (P0) : Chaque request HTTP logge avec method/url/status/duration
- V3 (P0) : PII redaction active (test : header `Authorization: Bearer XYZ` pas log en plain text)
- V4 (P0) : Pretty printing actif si NODE_ENV=development
- V5 (P0) : Boot log emit
- V6 (P0) : Shutdown log emit
- V7 (P1) : Trace ID present dans logs (necessite Tache 1.3.4)

---

## Tache 1.3.4 -- OpenTelemetry Traces + RequestContextMiddleware

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 5h / Depend de 1.3.3

**But** : Capturer toutes les requests HTTP en spans OpenTelemetry et propager un contexte request via AsyncLocalStorage (utilise Sprint 6 pour tenant_id).

**Contexte** : OTEL SDK initialise Sprint 1 par `startTelemetry()`. Sprint 3 ajoute la couche application : middleware capturant chaque request en span, et AsyncLocalStorage permettant aux services downstream de lire trace_id, tenant_id, user_id sans les passer en parametre.

**Livrables checkables** :
- [ ] `repo/apps/api/src/common/context/request-context.ts` -- AsyncLocalStorage avec interface RequestContext
- [ ] `repo/apps/api/src/common/middleware/request-context.middleware.ts` -- middleware NestJS qui :
  - genere trace_id (depuis OTEL active span ou ULID fallback)
  - lit header `x-tenant-id` (validation UUID si present)
  - lit header `x-user-id` (set apres auth Sprint 5)
  - encapsule la suite de la request dans `als.run(context, () => next())`
- [ ] Helpers `getRequestContext()`, `getCurrentTenantId()`, `getCurrentUserId()`, `getTraceId()`
- [ ] Header response `x-trace-id` injecte sur toutes responses
- [ ] Span attribute `tenant.id` + `user.id` ajoutes a la span courante
- [ ] Middleware applique sur ALL routes via `consumer.apply(...).forRoutes('*')`
- [ ] Tests : middleware injecte contexte, helpers le lisent correctement

**Pattern critique : AsyncLocalStorage RequestContext**

```typescript
// repo/apps/api/src/common/context/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  traceId: string;
  tenantId?: string;
  userId?: string;
  isSuperAdmin?: boolean;
  assureUserId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getCurrentTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}
```

Au Sprint 6, le TenantInterceptor utilisera `getCurrentTenantId()` pour SET LOCAL Postgres avant chaque query.

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/context/request-context.ts                  # ~50 lignes (AsyncLocalStorage)
repo/apps/api/src/common/middleware/request-context.middleware.ts    # ~60 lignes
repo/apps/api/src/app.module.ts                                       # update : configure middleware
repo/apps/api/src/common/context/request-context.spec.ts             # ~50 lignes (tests)
```

**Notes implementation** :
- AsyncLocalStorage Node native (depuis Node 14) -- aucune lib externe
- `als.run()` propage le contexte a travers async/await + callbacks (pas de leak entre requests)
- Trace ID lu depuis OTEL active span : `trace.getActiveSpan()?.spanContext().traceId`
- Fallback ULID si pas de span active (test scenarios)
- Header `x-tenant-id` validation : UUID v4 regex strict
- Header `x-user-id` injecte apres auth (Sprint 5 JwtStrategy)
- Span `tenant.id` attribute permet filtering Jaeger/Tempo par tenant

**Criteres validation** :
- V1 (P0) : Middleware installe, applique sur ALL routes
- V2 (P0) : `getRequestContext()` retourne contexte dans services downstream
- V3 (P0) : Header `x-trace-id` injecte sur response
- V4 (P0) : Header `x-tenant-id` invalide (pas UUID) rejete HTTP 400
- V5 (P0) : Async context propage : un setTimeout dans service voit le meme contexte
- V6 (P0) : Span OTEL contient attributes tenant.id + user.id
- V7 (P0) : 2 requests concurrents ont contextes isoles (pas de leak)
- V8 (P1) : Tests unitaires + E2E passent

---

## Tache 1.3.5 -- Helmet + CORS Strict + Compression + Body Limit

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.4

**But** : Appliquer les middlewares securite et performance globaux : Helmet (security headers), CORS strict (8 origins par environnement), compression Brotli/gzip, body limit 10MB.

**Livrables checkables** :
- [ ] Helmet via `@fastify/helmet` configure avec CSP strict
- [ ] CSP : `default-src 'self'`, scripts limites, frame-ancestors none
- [ ] CORS strict configure depuis env `CORS_ORIGINS` (CSV liste origins autorises)
- [ ] CORS methods : GET, POST, PUT, PATCH, DELETE, OPTIONS
- [ ] CORS headers : `Authorization`, `Content-Type`, `x-tenant-id`, `x-trace-id`, `x-correlation-id`
- [ ] CORS credentials : true (pour cookies session si applicable Sprint 5)
- [ ] Compression Brotli + gzip via `@fastify/compress`
- [ ] Compression threshold : 1024 bytes (pas compression sur small responses)
- [ ] Body limit JSON : 10MB
- [ ] Body limit multipart : 10MB total + 5MB par file (uploads photos Sprint 21)
- [ ] X-Powered-By header desactive (anti-fingerprinting)
- [ ] Strict-Transport-Security en prod (max-age 31536000; includeSubDomains; preload)
- [ ] Tests : OPTIONS request retourne CORS headers, request from non-allowed origin rejected

**Configuration CORS allowlist par environnement** :

| Environnement | Origins autorises |
|---------------|-------------------|
| development | `http://localhost:3000`, `:3001`, `:3002`, `:3003`, `:3004`, `:3005`, `:3006` |
| staging | `https://staging-{8 apps}.skalean-insurtech.ma` |
| production | `https://{8 apps}.skalean-insurtech.ma` (broker, garage, garage-app, admin, assurance, mon-espace, garage-mobile, mon-espace-mobile) |

**Fichiers crees / modifies** :
```
repo/apps/api/src/main.ts                                       # update : enregistre helmet + cors + compress
repo/apps/api/src/common/security/cors.config.ts                 # ~30 lignes (config par env)
repo/apps/api/src/common/security/helmet.config.ts               # ~40 lignes (CSP strict)
repo/apps/api/package.json                                       # add : @fastify/helmet, @fastify/compress
```

**Notes implementation** :
- `@fastify/helmet` (vs Express helmet) : adapter dedie Fastify, mieux integre
- CSP `default-src 'self'` strict : bloque scripts inline (sauf nonce/hash explicite)
- Pour Swagger UI (`/docs` Tache 1.3.9) : CSP relaxe sur cette route specifiquement (`scriptSrc: ["'self'", "'unsafe-inline'"]`)
- CORS `origin` callback function (vs string array) permet validation dynamique : verifier origin contre liste env
- CORS `credentials: true` requiert `origin` exact match (pas de wildcard)
- Compression : Brotli prioritaire (meilleur ratio que gzip), gzip fallback
- Body limit multipart : applique par Fastify multipart parser (Sprint 11 Pay aura webhooks reduits, Sprint 21 photos plus volumineuses)

**Criteres validation** :
- V1 (P0) : Helmet headers presents : `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` (prod)
- V2 (P0) : CORS allowlist actif : origin non-autorise rejete (HTTP 403 ou pas de Access-Control-* headers)
- V3 (P0) : OPTIONS preflight retourne 204 avec CORS headers
- V4 (P0) : Compression active : `Content-Encoding: br` ou `gzip` sur responses > 1KB
- V5 (P0) : Body 11MB rejete HTTP 413
- V6 (P0) : `X-Powered-By` absent
- V7 (P0) : CSP strict en place (test : eval bloque par CSP)
- V8 (P1) : HSTS `max-age=31536000` en prod

---

## Tache 1.3.6 -- ZodValidationPipe Global

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.5

**But** : Remplacer `class-validator` (defaut NestJS) par `Zod` pour coherence avec `shared-events` schemas et `shared-config` env loader.

**Contexte** : Avoir un seul outil de validation (Zod) sur tout le stack evite les drifts. `nestjs-zod` integre proprement Zod dans NestJS pipes + Swagger generation.

**Livrables checkables** :
- [ ] Installation `nestjs-zod` package
- [ ] `repo/apps/api/src/common/pipes/zod-validation.pipe.ts` -- pipe NestJS qui parse body/query/params via Zod
- [ ] Decorator `@UseZodGuard()` ou pattern controllers utilisent `createZodDto()`
- [ ] ZodValidationPipe applique globalement via `app.useGlobalPipes()`
- [ ] Erreurs validation : retourne HTTP 400 + body `{ error: 'validation', fields: [{ path, message }], traceId }`
- [ ] Helper `createZodDto(schema)` permet usage `class CreateContactDto extends createZodDto(CreateContactSchema) {}`
- [ ] Integration Swagger : Zod schemas auto-convertis en OpenAPI JSON Schema (Tache 1.3.9)
- [ ] Documentation pattern : controllers utilisent `@Body() body: CreateContactDto`
- [ ] Tests : POST avec body invalide retourne 400 + erreurs detaillees

**Pattern critique : ZodValidationPipe**

```typescript
// repo/apps/api/src/common/pipes/zod-validation.pipe.ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: 'validation',
        fields: result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    return result.data;
  }
}
```

Usage dans controllers :

```typescript
// Sprint 8+ exemple
@Controller('contacts')
export class ContactsController {
  @Post()
  create(@Body(new ZodValidationPipe(CreateContactSchema)) body: CreateContactDto) {
    return this.contactsService.create(body);
  }
}
```

Ou globalement avec `app.useGlobalPipes(new ZodValidationPipe(...))` mais pattern per-controller plus flexible (schema different par endpoint).

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/pipes/zod-validation.pipe.ts          # ~50 lignes
repo/apps/api/src/common/pipes/zod-validation.pipe.spec.ts     # ~80 lignes (tests)
repo/apps/api/src/common/dto/create-zod-dto.helper.ts          # ~25 lignes
repo/apps/api/package.json                                      # add : nestjs-zod
```

**Notes implementation** :
- `nestjs-zod` (vs writing pipe from scratch) : bridge officiel mature, supporte Swagger generation
- Pattern `@Body(new ZodValidationPipe(SchemaName)) body: TypeName` : verbeux mais explicite (un schema par endpoint)
- Alternative : decorator custom `@ValidatedBody(SchemaName)` qui combine `@Body()` + pipe
- Erreurs Zod transformees en format API standardise : `{ error: 'validation', fields: [...] }`
- BadRequestException intercepte par ExceptionFilter (Tache 1.3.8) qui ajoute traceId
- Swagger generation : `nestjs-zod` fournit `zodToOpenAPI()` pour conversion auto

**Criteres validation** :
- V1 (P0) : POST body valide passe
- V2 (P0) : POST body invalide retourne HTTP 400
- V3 (P0) : Erreur 400 contient liste fields invalides avec path + message
- V4 (P0) : Pipe applicable per-endpoint (different schema par route)
- V5 (P0) : `createZodDto()` helper genere DTO class compatible Swagger
- V6 (P0) : Tests pipe couvrent happy + error path
- V7 (P1) : Zod transform value transmise au controller (apres parse)

---

## Tache 1.3.7 -- ResponseInterceptor : Format API Standardise

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.6

**But** : Wrapper toutes les responses success dans un format standardise `{ data, meta, traceId }` pour coherence cross-endpoint.

**Contexte** : Sans format unifie, chaque controller retourne format different (parfois `{ data }`, parfois plain object). Frontend doit gerer N formats. Interceptor enforce format unique.

**Livrables checkables** :
- [ ] `repo/apps/api/src/common/interceptors/response.interceptor.ts` -- intercepte response success
- [ ] Format response success : `{ data: <controller return>, meta: { traceId, timestamp, version } }`
- [ ] Si controller retourne deja un objet avec `data` key, ne pas wrap (eviter double wrap)
- [ ] Si controller retourne array, wrap en `{ data: array, meta: { ..., total: array.length } }` (sauf paginated)
- [ ] Pour pagination : controller retourne `{ items, total, page, pageSize }` -> intercepteur transforme en `{ data: items, meta: { ..., pagination: { total, page, pageSize } } }`
- [ ] Trace ID lu depuis RequestContext (Tache 1.3.4)
- [ ] Timestamp ISO 8601 added
- [ ] Version : depuis `process.env.APP_VERSION`
- [ ] Interceptor applique globalement via `app.useGlobalInterceptors()`
- [ ] Exclusion : routes specifiques (e.g. `/healthz` retourne raw, pas de wrap)
- [ ] Tests : wrap simple object, array, paginated, exclude healthz

**Pattern critique : ResponseInterceptor**

```typescript
// repo/apps/api/src/common/interceptors/response.interceptor.ts
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const reflector = new Reflector();
    const skipWrap = reflector.get<boolean>('skipResponseWrap', context.getHandler());
    if (skipWrap) return next.handle();

    return next.handle().pipe(
      map((data: unknown) => ({
        data: this.extractData(data),
        meta: {
          traceId: getTraceId(),
          timestamp: new Date().toISOString(),
          version: process.env.APP_VERSION ?? '0.1.0',
          ...this.extractMeta(data),
        },
      }))
    );
  }
  // ... helpers
}
```

Decorator `@SkipResponseWrap()` pour exclure `/healthz`, `/docs/*`.

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/interceptors/response.interceptor.ts          # ~80 lignes
repo/apps/api/src/common/decorators/skip-response-wrap.decorator.ts    # ~10 lignes
repo/apps/api/src/common/interceptors/response.interceptor.spec.ts     # ~80 lignes (tests)
repo/apps/api/src/main.ts                                               # update : useGlobalInterceptors
```

**Notes implementation** :
- Reflector pattern NestJS pour metadata (skipWrap)
- Format documente dans CLAUDE.md + Swagger description (Tache 1.3.9)
- Pagination format detection : si return objet a `items` + `total` -> traite comme paginated
- Eviter double wrap : si return contient deja `data` key au top, return tel quel
- Healthcheck exclude : `@SkipResponseWrap()` sur HealthController

**Criteres validation** :
- V1 (P0) : GET endpoint retourne `{ data, meta }` avec traceId
- V2 (P0) : Array retourne `{ data: [...], meta: { total } }`
- V3 (P0) : Paginated `{ items, total, page }` retourne `{ data: items, meta: { pagination } }`
- V4 (P0) : `/healthz` non-wrap (return raw `{ status: 'ok' }`)
- V5 (P0) : `meta.timestamp` ISO 8601
- V6 (P0) : `meta.traceId` correspond au header `x-trace-id`
- V7 (P0) : Tests unitaires couvrent 4+ scenarios

---

## Tache 1.3.8 -- ExceptionFilter Global : Erreurs Structurees + Redaction PII

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 5h / Depend de 1.3.7

**But** : Intercepter TOUTES les exceptions (HttpException + non-HttpException) et transformer en format unifie `{ error, code, traceId, details }` avec PII redaction.

**Contexte** : Sans filter unifie, erreurs leakent : stack trace expose code interne, messages contiennent PII (`User joe@example.com not found`). Filter unifie : message generique en prod, details dev only, log complet cote serveur.

**Livrables checkables** :
- [ ] `repo/apps/api/src/common/filters/all-exceptions.filter.ts` -- catch toutes exceptions
- [ ] Format response erreur : `{ error: <human readable>, code: <error code stable>, traceId, details: <dev only> }`
- [ ] HttpException : status code respecte, message extrait
- [ ] Validation errors (Zod) : status 400 + `details: { fields }`
- [ ] Erreurs metier custom (extending `BusinessError`) : status approprie (400/403/404/409)
- [ ] Erreurs systeme (DB connection lost, Redis down) : status 503 + message generique `"Service temporarily unavailable"`
- [ ] Erreurs inconnues : status 500 + message generique `"Internal server error"` (jamais expose stack en prod)
- [ ] Logs Pino : level error, full exception details (stack, request context, user_id, tenant_id)
- [ ] Sentry capture : automatique pour status >= 500 (Tache 1.3.12)
- [ ] PII redaction sur message + details : password, cin, phone, email pas dans response
- [ ] Codes erreur standardises (catalog) : `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`

**Pattern critique : structure ExceptionFilter**

```typescript
// repo/apps/api/src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, code, message, details } = this.normalizeException(exception);

    // Log full details server-side
    logger.error({
      msg: 'request_failed',
      status, code, exception, request: extractRequestContext(request),
    });

    // Sentry capture if 5xx
    if (status >= 500) Sentry.captureException(exception);

    // Response (PII-redacted)
    response.status(status).send({
      error: message,
      code,
      traceId: getTraceId(),
      ...(process.env.NODE_ENV !== 'production' && details ? { details } : {}),
    });
  }
}
```

Catalog erreurs (file partage) :

```typescript
// repo/apps/api/src/common/errors/error-codes.ts
export const ERROR_CODES = {
  VALIDATION_FAILED: { status: 400, message: 'Validation failed' },
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'Insufficient permissions' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CONFLICT: { status: 409, message: 'Resource conflict' },
  RATE_LIMIT: { status: 429, message: 'Too many requests' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' },
} as const;
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/filters/all-exceptions.filter.ts            # ~120 lignes
repo/apps/api/src/common/filters/all-exceptions.filter.spec.ts       # ~100 lignes (tests)
repo/apps/api/src/common/errors/error-codes.ts                        # ~50 lignes
repo/apps/api/src/common/errors/business.error.ts                     # ~30 lignes (BusinessError class)
repo/apps/api/src/main.ts                                              # update : useGlobalFilters
```

**Notes implementation** :
- Filter applique en DERNIER (apres tous interceptors) -- ordre : interceptors -> handler -> filters
- BusinessError class : services metier throw avec code + message + status approprie
- Sentry capture conditionnel (5xx only) -- evite noise sur 4xx (validation errors fix par client)
- Redaction PII : whitelist fields safe (id, status, code) vs blacklist sensible (password, etc.)
- Stack trace : NEVER expose en prod (security)
- Code erreur stable : frontend peut switch sur `code` (vs message qui peut changer i18n)
- Status 503 differe 500 : 503 = transient (peut retry), 500 = bug

**Criteres validation** :
- V1 (P0) : HttpException retourne format `{ error, code, traceId }`
- V2 (P0) : Erreur inconnue catch, status 500, stack non-expose en prod
- V3 (P0) : Stack expose en dev (NODE_ENV=development)
- V4 (P0) : Validation Zod retourne 400 + `details.fields`
- V5 (P0) : Logs Pino emit error level avec context complet
- V6 (P0) : Sentry capture pour status >= 500 (mock test)
- V7 (P0) : PII redaction : `password` jamais dans response error
- V8 (P0) : Code erreur stable present (test : switch sur code marche)
- V9 (P0) : 503 differencie 500 (DB down vs bug)
- V10 (P1) : BusinessError throwable depuis service avec status approprie

---

## Tache 1.3.9 -- Swagger OpenAPI 3.0 Setup

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.8

**But** : Configurer Swagger UI accessible sur `/docs` documentant les endpoints, avec generation automatique depuis Zod schemas.

**Livrables checkables** :
- [ ] Setup `@nestjs/swagger` + integration `nestjs-zod` pour generation depuis Zod schemas
- [ ] Swagger UI sur `/docs`
- [ ] OpenAPI JSON sur `/docs-json`
- [ ] Configuration : title, description, version (depuis env), contact, license
- [ ] Tags par module : `Auth`, `Tenant`, `RBAC`, `CRM`, `Booking`, `Comm`, `Docs`, `Pay`, `Insure`, `Repair`, etc.
- [ ] Auth schemes documentes : Bearer JWT (Sprint 5), API Key admin
- [ ] Header `x-tenant-id` documente partout (description : "Tenant UUID, mandatory except /api/v1/public/*")
- [ ] Header `x-trace-id` documente (response only)
- [ ] Format response standardise documente : `{ data, meta }` enveloppe
- [ ] Exemples request/response basiques
- [ ] Swagger UI styling : theme bleu Skalean (Sky Blue #B0CEE2)
- [ ] CSP relaxe specifiquement sur `/docs/*` (Tache 1.3.5)
- [ ] Disable Swagger UI en prod uniquement si env `SWAGGER_DISABLE_PROD=true` (sinon accessible meme prod, decision pragmatique)

**Fichiers crees / modifies** :
```
repo/apps/api/src/main.ts                                          # update : SwaggerModule.setup
repo/apps/api/src/common/swagger/swagger.config.ts                  # ~80 lignes (config builder)
repo/apps/api/src/common/swagger/swagger-tags.ts                    # ~30 lignes (tags catalog)
repo/apps/api/package.json                                          # add : @nestjs/swagger
```

**Notes implementation** :
- `nestjs-zod` `zodToOpenAPI()` convertit Zod schema -> JSON Schema OpenAPI
- Tags par module pour navigation Swagger UI ergonomique
- `setup('docs', app, document, { swaggerOptions: { persistAuthorization: true } })` permet retain JWT entre refresh
- CSP relaxe sur /docs/*` : middleware CSP custom check path et applique CSP plus permissif
- Swagger UI accessible meme en prod (decision : transparency API > security obscurity)
- Integration future : Auth Sprint 5 ajoutera `@ApiBearerAuth()` decorators sur controllers proteges

**Criteres validation** :
- V1 (P0) : `curl http://localhost:4000/docs` retourne HTML Swagger UI
- V2 (P0) : `curl http://localhost:4000/docs-json` retourne OpenAPI JSON valide
- V3 (P0) : OpenAPI version 3.0
- V4 (P0) : Tags catalog present (vide initialement, peuple Sprint 5+)
- V5 (P0) : Header `x-tenant-id` documente comme parameter security global
- V6 (P0) : Format response `{ data, meta }` documente
- V7 (P0) : CSP relaxe sur /docs n'echoue pas (UI fonctionne)
- V8 (P1) : Theme Skalean applique

---

## Tache 1.3.10 -- HealthModule : /healthz et /readyz

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.9

**But** : Exposer 2 endpoints standards Kubernetes : `/healthz` (liveness, simple OK) et `/readyz` (readiness, verifie dependances : DB + Redis + Kafka).

**Contexte** : Convention Kubernetes : liveness probe = "process alive", readiness probe = "ready to receive traffic". `/healthz` simple, `/readyz` verifie dependances.

**Livrables checkables** :
- [ ] Module `repo/apps/api/src/modules/health/health.module.ts` import @nestjs/terminus
- [ ] Endpoint `GET /healthz` retourne `{ status: 'ok' }` HTTP 200 toujours (liveness)
- [ ] Endpoint `GET /readyz` execute checks : DB ping, Redis ping, Kafka producer connectable
- [ ] `/readyz` retourne 200 si tous OK, 503 si au moins 1 fail
- [ ] Format response readyz : `{ status, info: { db: 'up', redis: 'up', kafka: 'up' }, error: { ... si fail } }`
- [ ] Cache 5s sur readyz (eviter spam checks DB en prod K8s probe interval 1s)
- [ ] `/healthz` et `/readyz` exemptes auth (publics) + `@SkipResponseWrap()`
- [ ] Swagger documente les 2 endpoints
- [ ] Tests : healthz toujours 200, readyz 200 si all up, 503 si DB down

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/health/health.module.ts                   # ~25 lignes
repo/apps/api/src/modules/health/health.controller.ts               # ~70 lignes (2 endpoints)
repo/apps/api/src/modules/health/indicators/db-health.indicator.ts  # ~40 lignes
repo/apps/api/src/modules/health/indicators/redis-health.indicator.ts # ~40 lignes
repo/apps/api/src/modules/health/indicators/kafka-health.indicator.ts # ~50 lignes
repo/apps/api/src/modules/health/health.controller.spec.ts          # tests E2E
```

**Notes implementation** :
- `@nestjs/terminus` fournit health check framework
- DB indicator : `dataSource.query('SELECT 1')` timeout 2s
- Redis indicator : `redisClient.ping()` timeout 1s
- Kafka indicator : `producer.connect()` (singleton, deja connecte)
- Cache readyz : middleware ou pattern : si dernier check < 5s, retourner cached result
- 503 vs 500 : 503 indique transient (K8s peut decider de pas restart le pod)
- Pattern liveness : si `/healthz` repond meme avec DB down, K8s ne tue pas le pod -- correct car app peut recovery
- Pattern readiness : si DB down, K8s removes pod from service load balancer (mais pod survit)

**Criteres validation** :
- V1 (P0) : `curl /healthz` retourne 200 + `{ status: 'ok' }`
- V2 (P0) : `curl /readyz` retourne 200 + tous services up
- V3 (P0) : Si DB stop : `/readyz` retourne 503
- V4 (P0) : `/healthz` reste 200 meme si DB down (liveness)
- V5 (P0) : Cache 5s actif (verifier 2 calls successifs : second cache hit)
- V6 (P0) : Endpoints publics (pas d'auth required)
- V7 (P0) : Format response readyz documente Swagger
- V8 (P1) : Tests E2E couvrent les 4 scenarios

---

## Tache 1.3.11 -- BullMQ Integration : JobsModule

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 5h / Depend de 1.3.10

**But** : Setup BullMQ (Redis-backed jobs queue) pour traitement async deferred (envois WA, jobs cron, etc.). Pas de jobs metier au Sprint 3 -- juste integration.

**Contexte** : BullMQ utilise Redis (DB 2 SessSp1). Cas d'usage Sprint 9+ : envoi WhatsApp non-bloquant (queue + retry), Sprint 12 : generation PDF documents, Sprint 33 : cron jobs cleanup.

**Livrables checkables** :
- [ ] Module `repo/apps/api/src/modules/jobs/jobs.module.ts` global `@Global()`
- [ ] Setup `@nestjs/bullmq` BullModule.forRoot avec Redis DB 2 (QUEUES)
- [ ] Default job options : 3 retries, exponential backoff (1s/5s/30s), removeOnComplete (30 jours), removeOnFail (90 jours)
- [ ] Connection options : reconnectOnError, maxRetriesPerRequest 3
- [ ] Helper `JobProducer` service qui wrap BullMQ avec validation Zod (par analogie KafkaPublisher Sprint 2)
- [ ] BullDashboard accessible sur `/admin/queues` (auth : super admin only -- sera Sprint 5+)
- [ ] Pas de queue concrete au Sprint 3 (Sprint 9 ajoutera `whatsapp-send`, etc.)
- [ ] Graceful shutdown : drain queues + close connections
- [ ] Logs Pino : job processed, job failed, job retry
- [ ] Tests : queue createable + job ajoutable + dummy worker process job

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/jobs/jobs.module.ts                       # ~50 lignes (forRoot config)
repo/apps/api/src/modules/jobs/job-producer.service.ts              # ~80 lignes (wrapper)
repo/apps/api/src/modules/jobs/job-producer.service.spec.ts         # ~60 lignes
repo/apps/api/package.json                                          # add : @nestjs/bullmq, bullmq, @bull-board/api, @bull-board/fastify
```

**Notes implementation** :
- BullMQ est "next gen" Bull (BullMQ != Bull legacy)
- Redis connection separee (DB 2) du cache (DB 0) pour isolation
- `removeOnComplete` 30 jours : permet replay debug, mais pas illimite (memory)
- `removeOnFail` 90 jours : preserver pour analyse incidents
- Bull-board UI utile dev/staging mais auth required en prod
- Graceful shutdown : ATTEND fin jobs en cours (timeout 30s) puis kill
- Pattern JobProducer (Sprint 9+) : `this.jobs.add('whatsapp-send', payload, { priority: 'high' })`

**Criteres validation** :
- V1 (P0) : Module charge sans erreur
- V2 (P0) : Connection Redis DB 2 etablie
- V3 (P0) : Test : creer queue, ajouter job, dummy worker process succes
- V4 (P0) : Default job options (3 retries) actifs
- V5 (P0) : Graceful shutdown drain queues
- V6 (P0) : Logs Pino sur job lifecycle
- V7 (P1) : BullDashboard accessible (auth pas encore Sprint 5)
- V8 (P1) : `JobProducer.add()` valide payload via Zod si schema declare

---

## Tache 1.3.12 -- Sentry Integration

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.11

**But** : Capture automatique des erreurs HTTP 5xx + erreurs uncaught dans Sentry pour observability + alerting.

**Livrables checkables** :
- [ ] Setup `@sentry/nestjs` SDK
- [ ] Initialisation conditionnelle : si `SENTRY_DSN` defini -> activer, sinon skip
- [ ] Config Sentry : DSN, environment (depuis NODE_ENV), release (depuis APP_VERSION), tracesSampleRate 0.1 prod / 1.0 dev
- [ ] Auto-capture exceptions 5xx via integration ExceptionFilter (Tache 1.3.8)
- [ ] User context auto-injecte : user_id depuis RequestContext (Sprint 5+ aura le user)
- [ ] Tenant context auto-injecte : tenant_id depuis RequestContext
- [ ] Trace ID injecte dans Sentry breadcrumbs
- [ ] Source maps upload script (post-build) pour stack traces lisibles
- [ ] PII scrubbing actif Sentry side : `beforeSend` hook redact password/cin/email
- [ ] Tests : exception 500 capture (mock Sentry), exception 4xx PAS capture
- [ ] Documentation : setup Sentry org dans `repo/docs/runbooks/sentry-setup.md`

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/sentry/sentry.module.ts                    # ~50 lignes
repo/apps/api/src/common/sentry/sentry.config.ts                    # ~60 lignes (config Sentry)
repo/apps/api/src/common/sentry/sentry-before-send.ts                # ~40 lignes (PII scrubber)
repo/apps/api/src/main.ts                                            # update : Sentry.init avant NestFactory
repo/apps/api/package.json                                          # add : @sentry/nestjs, @sentry/profiling-node
repo/docs/runbooks/sentry-setup.md                                   # ~30 lignes
```

**Notes implementation** :
- `Sentry.init()` AVANT `NestFactory.create()` pour capture early errors
- Default integrations Sentry : http, native, console, modulesIntegration
- `tracesSampleRate` 0.1 prod = 10% des transactions tracees (cost control)
- User context : `Sentry.setUser({ id: userId, tenant_id })` dans middleware request context
- `beforeSend` hook : derniere ligne defense PII (meme si filter Tache 1.3.8 redact, defense profondeur)
- Sentry NestJS integration auto-instrument controllers, providers, exception filter
- Source maps : utile prod pour debugger errors sans build minifie

**Criteres validation** :
- V1 (P0) : Si `SENTRY_DSN` set : Sentry initialise
- V2 (P0) : Si `SENTRY_DSN` absent : pas de crash, juste log warn
- V3 (P0) : Exception 5xx capture (mock + verify Sentry SDK called)
- V4 (P0) : Exception 4xx NE capture pas
- V5 (P0) : User context inclus dans Sentry event (apres Sprint 5)
- V6 (P0) : Tenant context inclus
- V7 (P0) : `beforeSend` redact password/cin
- V8 (P1) : Source maps upload script disponible

---

## Tache 1.3.13 -- Rate Limiting Global : @nestjs/throttler + Redis

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 5h / Depend de 1.3.12

**But** : Limiter requests per IP/user/tenant pour proteger API contre abus, scraping, brute force.

**Livrables checkables** :
- [ ] Setup `@nestjs/throttler` v6 avec Redis storage (DB 5 RATE_LIMIT)
- [ ] Default limit : 100 req / minute per IP (sliding window)
- [ ] Limits per route override possible via decorator `@Throttle({ default: { limit, ttl } })`
- [ ] Limit specifique auth : 5 attempts / minute per IP (anti brute force) -- decorator usage Sprint 5
- [ ] Tracking key composite : si user authentifie -> per user, sinon per IP
- [ ] Skip pour `/healthz`, `/readyz`, `/docs` (whitelist)
- [ ] Skip pour `super_admin_platform` role (apres Sprint 5)
- [ ] Header response : `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Erreur 429 : `{ error: 'Too many requests', code: 'RATE_LIMIT', retryAfter, traceId }`
- [ ] Header `Retry-After` envoye sur 429
- [ ] Logs Pino : rate limit hit (level warn)
- [ ] Tests : 101e request retourne 429, rate-limit reset apres ttl

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/throttler/throttler.module.ts                # ~50 lignes (config)
repo/apps/api/src/common/throttler/throttler-redis.storage.ts         # ~80 lignes (custom storage)
repo/apps/api/src/common/throttler/throttler.guard.ts                  # custom guard (skip whitelist)
repo/apps/api/package.json                                             # add : @nestjs/throttler
```

**Notes implementation** :
- @nestjs/throttler v6 supporte storage custom (Redis vs memory default)
- Sliding window vs fixed window : sliding plus juste mais plus complexe Redis
- Whitelist routes via guard custom (skip /healthz, /docs)
- Tracking composite : `tracker(req)` retourne `user:${userId}` ou `ip:${req.ip}`
- Headers `X-RateLimit-*` : informent client de leur quota
- 429 + Retry-After : standard HTTP, frontend peut adapter
- Rate limit specifique routes auth (Sprint 5) plus strict (5/min) -- protege brute force

**Criteres validation** :
- V1 (P0) : 100e request OK, 101e retourne 429
- V2 (P0) : Apres 60s, quota reset
- V3 (P0) : Headers X-RateLimit-* presents
- V4 (P0) : Header Retry-After sur 429
- V5 (P0) : Skip /healthz, /readyz, /docs
- V6 (P0) : User authentifie : tracking per user (vs IP)
- V7 (P0) : Erreur 429 format coherent ExceptionFilter
- V8 (P1) : Logs warn sur rate limit hit
- V9 (P1) : Tests E2E rate limit

---

## Tache 1.3.14 -- PublicEndpointGuard + @Public() Decorator

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 4h / Depend de 1.3.13

**But** : Mecanisme explicite pour marquer les endpoints accessibles SANS authentication (`/api/v1/public/*`, `/healthz`, etc.) en gardant l'auth obligatoire par defaut.

**Contexte** : Pattern "secure by default" : tous endpoints requirent auth, sauf marques `@Public()`. Eviter oubli auth sur endpoint protected (vs pattern inverse "secure where annotated" qui leak facile).

**Livrables checkables** :
- [ ] Decorator `@Public()` -- marque endpoint comme public
- [ ] Guard global `PublicEndpointGuard` qui :
  - lit metadata `@Public()` via Reflector
  - si endpoint public, accepte la request (pas de check auth)
  - si endpoint non-public, verifie header `Authorization: Bearer ...` (Sprint 5 : valide JWT, Sprint 3 : juste check presence header pour validation guard)
- [ ] Skip auth aussi pour : `/healthz`, `/readyz`, `/docs/*`, `/docs-json`, `/api/v1/public/*` (par convention path)
- [ ] Header `x-tenant-id` mandatory si endpoint NON-public (sauf admin/SuperAdmin Sprint 6)
- [ ] Header `x-tenant-id` interdit si endpoint public (rejete 400 si present sur /public/*)
- [ ] Logs Pino : tentative acces endpoint protected sans auth (warn)
- [ ] Erreur 401 si auth manquante : `{ error: 'Unauthorized', code: 'UNAUTHORIZED', traceId }`
- [ ] Erreur 400 si tenant_id manquant sur endpoint protected : `{ error: 'Tenant context required', code: 'TENANT_REQUIRED' }`
- [ ] Tests : endpoint @Public() OK sans auth, endpoint non-public rejete sans auth

**Pattern critique : @Public() decorator + PublicEndpointGuard**

```typescript
// repo/apps/api/src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// repo/apps/api/src/common/guards/public-endpoint.guard.ts
@Injectable()
export class PublicEndpointGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    // Path-based public routes
    if (path.startsWith('/api/v1/public/') || path === '/healthz' || path === '/readyz' || path.startsWith('/docs')) {
      return true;
    }

    // Decorator-based public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    // Otherwise, require auth (Sprint 5 will enrich with JWT validation)
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    // Tenant header required (Sprint 6 will use it)
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId) {
      throw new BadRequestException({ code: 'TENANT_REQUIRED', message: 'x-tenant-id header required' });
    }

    return true;
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/decorators/public.decorator.ts             # ~10 lignes
repo/apps/api/src/common/guards/public-endpoint.guard.ts             # ~80 lignes
repo/apps/api/src/common/guards/public-endpoint.guard.spec.ts       # ~80 lignes
repo/apps/api/src/main.ts                                            # update : useGlobalGuards
```

**Notes implementation** :
- Reflector pattern NestJS pour decorator metadata
- Guard execute APRES interceptors et middlewares globaux
- Path-based check FIRST (perf : avoid Reflector si /healthz)
- @Public() override path-based : un endpoint dans /api/v1/admin/* peut etre marque @Public() exceptionnellement
- Sprint 5 enrichira avec validation JWT actual + injection user dans context
- Sprint 6 enrichira avec validation tenant_id existence + permission check
- Header x-tenant-id required force discipline architecturale

**Criteres validation** :
- V1 (P0) : `/healthz` accepte sans auth
- V2 (P0) : `/api/v1/public/*` accepte sans auth
- V3 (P0) : `/docs` accepte sans auth
- V4 (P0) : Endpoint @Public() accepte sans auth
- V5 (P0) : Endpoint non-public rejete 401 sans header Authorization
- V6 (P0) : Endpoint non-public rejete 400 sans header x-tenant-id
- V7 (P0) : @Public() override path-based (peut marquer endpoint hors /public/* comme public)
- V8 (P0) : Logs warn sur tentative acces sans auth
- V9 (P1) : Tests unitaires + E2E couvrent 6+ scenarios

---

## Tache 1.3.15 -- Tests E2E Bootstrap : Smoke Tests + Healthcheck + 404/500

**Metadonnees** : Phase 1 / Sprint 3 / P0 / 5h / Depend de 1.3.14

**But** : Suite tests E2E Playwright (project `api`) validant tous les transverses Sprint 3 fonctionnent ensemble : healthcheck, format response, exception filter, validation, rate limiting, public endpoints.

**Livrables checkables** :
- [ ] Tests dans `repo/e2e/api/` (deja config Playwright Sprint 1)
- [ ] Test 1 : `smoke.spec.ts` -- GET / retourne 200 + format `{ data: { name, version, env }, meta: { traceId } }`
- [ ] Test 2 : `healthcheck.spec.ts` -- GET /healthz retourne 200 simple, GET /readyz retourne 200 si all up
- [ ] Test 3 : `cors.spec.ts` -- OPTIONS preflight retourne CORS headers, request from origin non-allowed retourne 403
- [ ] Test 4 : `404-not-found.spec.ts` -- GET /api/v1/non-existent retourne 404 + format erreur
- [ ] Test 5 : `validation.spec.ts` -- POST avec body invalide retourne 400 + `details.fields`
- [ ] Test 6 : `auth-required.spec.ts` -- GET /api/v1/auth/me retourne 401 sans header Authorization
- [ ] Test 7 : `tenant-required.spec.ts` -- GET endpoint protected retourne 400 sans header x-tenant-id
- [ ] Test 8 : `public-endpoint.spec.ts` -- GET /api/v1/public/products retourne 200 sans auth
- [ ] Test 9 : `rate-limiting.spec.ts` -- 101 GET / consecutifs : 100 OK + 1 retourne 429
- [ ] Test 10 : `swagger-docs.spec.ts` -- GET /docs retourne HTML, /docs-json retourne JSON OpenAPI valide
- [ ] Test 11 : `headers.spec.ts` -- response inclut x-trace-id, X-RateLimit-*, security headers Helmet
- [ ] Test 12 : `graceful-shutdown.spec.ts` -- SIGTERM -> exit code 0 (test integration via spawn)
- [ ] Tests passent en CI (services PG + Redis + Kafka)
- [ ] Coverage tests E2E : tous les transverses sprint 3 testes
- [ ] Setup test : avant chaque test, healthcheck pour s'assurer API ready

**Fichiers crees / modifies** :
```
repo/e2e/api/smoke.spec.ts                                          # ~40 lignes
repo/e2e/api/healthcheck.spec.ts                                    # ~40 lignes
repo/e2e/api/cors.spec.ts                                            # ~50 lignes
repo/e2e/api/404-not-found.spec.ts                                   # ~30 lignes
repo/e2e/api/validation.spec.ts                                      # ~50 lignes
repo/e2e/api/auth-required.spec.ts                                   # ~30 lignes
repo/e2e/api/tenant-required.spec.ts                                 # ~30 lignes
repo/e2e/api/public-endpoint.spec.ts                                 # ~30 lignes
repo/e2e/api/rate-limiting.spec.ts                                   # ~60 lignes
repo/e2e/api/swagger-docs.spec.ts                                    # ~40 lignes
repo/e2e/api/headers.spec.ts                                         # ~50 lignes
repo/e2e/api/graceful-shutdown.spec.ts                               # ~80 lignes (process spawn)
repo/e2e/api/fixtures/api-test-helper.ts                             # ~60 lignes (setup base URL, common headers)
```

**Notes implementation** :
- Playwright project `api` configure avec `baseURL: 'http://localhost:4000'`
- Tests utilisent `request` context (vs browser context) pour API testing
- Setup test : `beforeAll` healthcheck pour s'assurer API ready
- Test rate limiting : utiliser sleep/retry pour eviter flakiness
- Test graceful shutdown : spawn process API, SIGTERM, verifier exit code (necessite isolation, run separement de autres tests)
- CI : Playwright project api `pnpm test:e2e --project=api`
- Coverage : objectif 100% lignes du code Sprint 3 testees au moins par 1 test E2E

**Criteres validation** :
- V1 (P0) : 12+ tests E2E ecrits
- V2 (P0) : Tous tests passent localement
- V3 (P0) : Tous tests passent CI (avec services Postgres+Redis+Kafka)
- V4 (P0) : Smoke test : GET / format `{ data, meta }`
- V5 (P0) : Healthcheck test : /healthz + /readyz reussissent
- V6 (P0) : Validation test : 400 sur body invalide
- V7 (P0) : Auth test : 401 sans Authorization
- V8 (P0) : Public endpoint test : 200 sans auth
- V9 (P0) : Rate limit test : 429 apres quota
- V10 (P0) : Swagger test : /docs accessible
- V11 (P1) : Graceful shutdown test : exit code 0
- V12 (P1) : Coverage Sprint 3 transverses 100%

---

## Sortie du Sprint 3

A la fin de l'execution des 15 taches :

```
API NestJS skalean-insurtech-api running on port 4000 :
  - Fastify adapter (perf 30% > Express)
  - Logger Pino structured + PII redaction
  - OpenTelemetry traces + RequestContext (AsyncLocalStorage)
  - Helmet + CORS strict + Compression
  - ZodValidationPipe global + ResponseInterceptor + ExceptionFilter
  - Swagger OpenAPI 3.0 sur /docs
  - HealthModule /healthz + /readyz
  - BullMQ JobsModule (Redis-backed)
  - Sentry integration (configurable)
  - Rate limiting per IP/user/tenant
  - PublicEndpointGuard + @Public() decorator
  - 12+ tests E2E passants

Modules metier stubs prets pour implementation :
  - auth (Sprint 5), tenant (Sprint 6), rbac (Sprint 7)
  - crm, booking (Sprint 8), comm (Sprint 9), docs/signature (Sprint 10)
  - pay (Sprint 11), books/compliance (Sprint 12), analytics (Sprint 13)
  - insure (Sprint 14), repair (Sprint 20)
  - assure (Sprint 19), prospect (Sprint 18), admin (Sprint 27)
  - skalean-ai (Sprint 30 defere), mcp (Sprint 31 defere)

Modules technique pour Sprint 4+ Frontend :
  - API stable et documentee
  - Endpoints publics testables
  - Healthcheck + Swagger UI
```

**Sprint 4 demarre avec** :
- API NestJS operationnelle
- 8 apps frontend a setup en parallele
- Documentation OpenAPI auto-generee = client TypeScript generable

---

## Specifications Format Tache (pour Generation par Cowork)

Quand Cowork genere les fichiers `task-1.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-03-api-bootstrap/`, suivre format Option B : Metadonnees / But / Contexte / Livrables checkables / Fichiers crees / Notes implementation / Criteres validation.

**Patterns code inline conserves** : main.ts boot order, AsyncLocalStorage RequestContext, ZodValidationPipe, ResponseInterceptor map, ExceptionFilter normalizeException, @Public() decorator + Guard.

**Reference complete** : `00-pilotage/documentation/4-templates-generation.md` Pattern 1 (NestJS service) sera utilise Sprint 5+ pour controllers/services metier.

---

**Fin du meta-prompt B-03 v2.2 format Option B.**
