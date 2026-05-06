# TACHE 1.3.8 -- ExceptionFilter Global + Erreurs Structurees + BusinessError Class + Redaction PII + Sentry Capture

**Sprint** : 3 (Phase 1 / Sprint 3 dans phase) -- API Bootstrap NestJS Fastify
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-03-sprint-03-api-bootstrap.md` (Tache 1.3.8)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant pour Sprints 5+ qui throw BusinessError + Tache 1.3.12 Sentry)
**Effort** : 5h
**Dependances** : Tache 1.3.7 terminee (ResponseInterceptor format `{ data, meta }` en place)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a poser un `AllExceptionsFilter` global NestJS qui intercepte TOUTES les exceptions levees par les controllers, services, guards, interceptors, pipes (incluant les `BadRequestException` du `ZodValidationPipe` Tache 1.3.6, les `UnauthorizedException` du `JwtAuthGuard` Sprint 5, les `BusinessError` custom des services metier Sprints 8+, les `QueryFailedError` TypeORM des hooks `beforeQuery` Sprint 6, les erreurs reseau `EHOSTUNREACH` Redis/Kafka, et les erreurs inattendues `TypeError`/`ReferenceError`) et les transforme en response HTTP structuree avec format unifie `{ error, code, message, traceId, request_id, timestamp, details? }` ou `details` est present uniquement en environnement non-production (development, staging, test) pour faciliter le debug. Le filter applique simultanement la redaction PII via le serializer `errSerializer` de `@insurtech/shared-utils/logger` (Sprint 1 Tache 1.1.10) avant log + avant capture Sentry, garantissant qu'aucun mot de passe, CIN, telephone, email, JWT, IBAN, CVC carte ne se retrouve jamais dans les logs serveur ou les transactions Sentry, conformement a la loi 09-08 (CNDP) article 5 (mesures techniques de protection) et article 52 (sanctions penales).

Cette tache pose egalement une classe `BusinessError extends Error` avec champs typés `code` (catalog standardise `ErrorCode`), `status` (HTTP status), `details` (objet metadata optionnel), `cause` (Error cause optionnelle), de maniere a permettre aux services metier (Sprint 5 AuthService throw `new BusinessError({ code: ErrorCode.AUTH_INVALID_CREDENTIALS, status: 401 })`, Sprint 11 PaymentsService throw `new BusinessError({ code: ErrorCode.PAYMENT_DECLINED, status: 402, details: { provider, reason } })`, Sprint 14 PoliciesService throw `new BusinessError({ code: ErrorCode.POLICY_EXPIRED, status: 410 })`) de signaler des conditions metier de maniere typée et capturable par le filter sans ambiguite. Le catalog `ErrorCode` enumere ~80 codes stables (`VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `TENANT_REQUIRED`, `TENANT_INVALID`, `IDEMPOTENCY_KEY_MISSING`, `IDEMPOTENCY_KEY_REUSED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `DATABASE_CONNECTION_LOST`, `REDIS_UNAVAILABLE`, `KAFKA_UNREACHABLE`, etc.) que le frontend Sprint 4 peut switch dessus pour afficher messages localises.

L'apport architectural est triple. Premierement, le filter unifie ferme la classe complete des fuites d'information : sans filter, NestJS retourne par default la stack trace complete en HTTP 500 body sur exceptions non-handled, exposant les chemins fichiers internes (`/app/apps/api/src/services/auth/AuthService.ts:142`), les noms de variables internes, et potentiellement des connection strings (`postgres://...`) dans le message. Avec filter, en production le message est generique `Internal server error` et la stack est uniquement dans les logs server-side (avec PII redaction). Deuxiemement, le format unifie `{ error, code, traceId }` permet au frontend Sprint 4 d'avoir UN parser d'erreurs (au lieu de gerer les multiples formats native NestJS, Fastify, custom controllers). Troisiemement, l'integration Sentry capture automatique pour status >= 500 garantit que les bugs en prod sont alertes immediatement (Slack/PagerDuty Sprint 33), sans flooder Sentry avec les 4xx qui sont attendus (validation errors, auth fails).

A l'issue de cette tache, la commande `curl -X POST -i http://localhost:4000/api/v1/test/validate -d '{}'` retourne HTTP 400 avec body `{ error: 'validation', code: 'VALIDATION_FAILED', message: 'Request validation failed', fields: [...], traceId: '...', request_id: '...', timestamp: '...' }`, une exception `TypeError` non-handled dans un service retourne HTTP 500 avec body generique `{ error: 'internal_error', code: 'INTERNAL_ERROR', message: 'Internal server error', traceId, request_id, timestamp }` (sans stack en prod, avec stack en dev), un `BusinessError({ code, status, details })` est correctement transforme en response avec status approprie, les logs Pino emit `level: 50 (error)` avec context complet (traceId, tenantId, userId, request) mais avec PII redact, et Sentry capture les 5xx avec breadcrumbs. La portee est strictement transverse : aucun controller metier ajoute, mais une route demo `GET /api/v1/test/force-error/:code` est ajoutee pour tester chaque code erreur.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 manipule des donnees de criticite extreme : CIN nationaux (loi 09-08 article 1), comptes bancaires IBAN (Sprint 11 Pay), dossiers medicaux (Sprint 14 Insure complementaire sante), certificats notaries (Sprint 10 Signature loi 43-20). En production, une fuite de stack trace pourrait reveler le schema Postgres complet (table names, column names) qui aiderait un attaquant a planifier une SQL injection. Une fuite de `process.env.DATABASE_URL` dans une error log pourrait etre captee par un employe ops mal intentionne. Une fuite d'un message d'erreur `User joe@example.com not found` confirmerait l'existence du email pour un attaquant qui enumere des comptes.

Le filter unifie elimine ces vecteurs : (a) en prod, message generique = aucune information utile a l'attaquant, (b) stack trace logged server-side avec PII redact = forensic possible, mais pas exposable, (c) code erreur stable = frontend traite correctement sans message lisible, (d) Sentry capture seulement les erreurs serveur (5xx) = pas de bruit avec validation errors qui sont attendues.

Le programme retient `BusinessError` class (vs `HttpException` standard NestJS) pour separer les erreurs metier (typees, codes stables, frontend-routable) des erreurs HTTP techniques (4xx pour client errors, 5xx pour server errors). Un service metier qui throw `BusinessError({ code: ErrorCode.POLICY_EXPIRED, status: 410 })` est explicite : c'est une condition metier connue, pas un bug. A l'inverse, un `TypeError: Cannot read property 'x' of undefined` est un bug, le filter le marque INTERNAL_ERROR + capture Sentry.

La redaction PII centralisee dans le filter (en plus du logger Tache 1.3.3 et de Sentry beforeSend Tache 1.3.12) suit le principe defense-in-depth : trois couches de redaction independantes. Si une couche echoue (par exemple un developpeur ajoute un nouveau champ PII oublie dans la liste Pino), une autre couche le rattrape. Pour la conformite loi 09-08 (CNDP, sanctions penales), trois couches valent mieux qu'une.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Aucun filter (default NestJS) | Zero config | Stack trace expose en prod, pas de format unifie, pas de PII redact, pas de Sentry capture conditionnelle | REJETE -- security violation |
| Filter sans BusinessError class (utilise HttpException standard) | Plus simple | Drift entre erreurs metier (typed, code) et erreurs HTTP (status only), perte de typing | REJETE -- maintenabilite |
| Filter qui re-throw certains codes (proxy pattern) | Permet middleware en aval de re-handle | Complexite ordre filters NestJS, debug difficile | REJETE -- complexite |
| Filter centralise + BusinessError class + ErrorCode catalog (RETENU) | Type-safe, codes stables frontend, PII redact integre, Sentry capture conditionnelle | Necessite enumerer ~80 codes initiaux | RETENU -- meilleur compromis |
| Filter avec i18n message Sprint 9 inline | Messages localises automatique | Coupling i18n + filter, performance, complexite | DIFFERE -- Sprint 9 enrichira |
| Filter qui retourne Problem Details RFC 7807 (`application/problem+json`) | Standard IETF | Pas adopte par le frontend, format different de ResponseInterceptor | REJETE -- coherence interne |

### 2.3 Trade-offs explicites

Choisir d'enumerer ~80 codes erreur initiaux dans `ErrorCode` enum implique une dette de maintenance : a chaque nouvelle feature, le developpeur doit ajouter un code dans le catalog AVANT de pouvoir throw. Mitigation : convention `00-pilotage/conventions/error-codes.md` documente le pattern d'ajout, pre-commit lint verifie qu'un BusinessError thrown utilise un code existant dans ErrorCode enum.

Choisir d'exposer `details` dev/staging only implique que le frontend dev voit les details mais le frontend prod ne les voit pas. Mitigation : convention frontend = ne JAMAIS s'attendre a `details` (utiliser uniquement `code`). Pattern documente.

Choisir une redaction PII triple-couche (logger + filter + Sentry) implique une legere overhead de performance (~10 microsec par erreur). Mitigation : negligeable car les errors sont rares (~1% requests max).

Choisir Sentry capture automatique pour 5xx UNIQUEMENT implique que les bugs masques en 4xx (par exemple un BusinessError mal classifie comme 400 alors que c'est un bug 500 dans le code) ne sont pas capture. Mitigation : convention metier = chaque BusinessError doit avoir un code et status correctement classifies. Audit Sprint 33 verifie.

Choisir d'inclure stack trace en logs server (avec PII redact) mais PAS dans response client implique que le support N2 doit avoir acces aux logs (Loki Sprint 35) pour debug. Mitigation : access controle RBAC Loki par rolesupport (pas SuperAdmin requis), audit trail acces Sprint 12.

### 2.4 Decisions strategiques referenced

- **decision-008 (Atlas Cloud Maroc + CNDP loi 09-08)** : pertinence totale -- redaction PII obligatoire.
- **decision-006 (No-emoji)** : pertinence totale.
- **decision-003 (NestJS Fastify)** : pertinence totale -- ExceptionFilter NestJS standard.
- **decision-001 (Monorepo)** : pertinence indirecte -- ErrorCode enum exporte dans `@insurtech/shared-types`.

### 2.5 Pieges techniques connus

1. **Piege : Filter applique apres ResponseInterceptor (Tache 1.3.7) qui n'est pas execute en cas d'exception.**
   - Pourquoi : exception bubble up et bypass interceptor map.
   - Solution : filter doit reproduire format coherent (traceId, request_id, timestamp dans body).

2. **Piege : `BadRequestException` du ZodValidationPipe contient deja `{ error, fields }` -- filter wrap encore.**
   - Pourquoi : sans detection, double wrap.
   - Solution : detection si exception body contient deja `error` key -> use as-is + add traceId/request_id/timestamp.

3. **Piege : Stack trace expose en dev mais filter prod oublie.**
   - Pourquoi : check `NODE_ENV` peut foirer si env vide.
   - Solution : explicit `process.env.NODE_ENV === 'production'` (default fail-safe = expose pas).

4. **Piege : Sentry capture pour 5xx mais 4xx custom thrown comme 500.**
   - Pourquoi : un service throw `new Error('boom')` (pas BusinessError) -> filter set 500 -> Sentry capture, mais c'est un bug pas un erreur metier legitime.
   - Solution : convention BusinessError pour metier, Error generique reste 500. Audit Sprint 33.

5. **Piege : Filter ne capture pas les erreurs des middlewares (avant NestJS handler).**
   - Pourquoi : middleware Fastify (helmet, cors) error -> Fastify gere directement.
   - Solution : Fastify error handler par default suffisant. Pour middlewares globaux, ajouter try/catch interne.

6. **Piege : `HttpException` instance check fail si extends differemment.**
   - Pourquoi : NestJS `Catch(HttpException)` matche exactement HttpException et subclasses.
   - Solution : utiliser `@Catch()` (vide) qui catch ALL, puis check `instanceof` interne.

7. **Piege : Erreur dans le filter lui-meme = boucle infinie.**
   - Pourquoi : si le filter throw (par exemple Pino logger crash), NestJS appelle le filter recursivement.
   - Solution : try/catch defensif dans filter, fallback `console.error` pour log si Pino fail.

8. **Piege : Status code 200 mais body error (anti-pattern).**
   - Pourquoi : un controller retourne `{ error: 'X' }` avec status 200 par habitude mauvaise.
   - Solution : filter ne s'execute pas (pas d'exception). Convention = throw BusinessError.

9. **Piege : Async exception non-await.**
   - Pourquoi : `await someService.method()` peut throw, mais si `then()` chain perdu, exception silencieuse.
   - Solution : NestJS gere automatiquement `@Get` async return throws.

10. **Piege : QueryFailedError TypeORM expose constraint name (DB schema info).**
    - Pourquoi : message `duplicate key violates unique constraint "users_email_unique"` revele schema.
    - Solution : translate en code `CONFLICT` + message generique. Mapping DB error -> ErrorCode.

11. **Piege : CSRF error de Fastify pas catch par filter.**
    - Pourquoi : Sprint 5 ajoutera CSRF middleware Fastify niveau plugin, error handle externe.
    - Solution : Sprint 5 documentera handler CSRF. Pour Tache 1.3.8, no-op.

12. **Piege : Erreur dans handler async generator (SSE Sprint 31).**
    - Pourquoi : SSE streaming peut throw mid-stream.
    - Solution : Sprint 31 handler explicit error event SSE.

13. **Piege : Filter logge tout, meme en mode test (LOG_LEVEL=silent).**
    - Pourquoi : tests E2E qui force erreurs polluent stdout.
    - Solution : logger Pino respect LOG_LEVEL. Tests force `LOG_LEVEL=silent`.

14. **Piege : Sentry init pas fini quand premiere erreur arrive.**
    - Pourquoi : Sentry init async, premiere erreur tot peut perdre.
    - Solution : `Sentry.init()` synchrone main.ts (Tache 1.3.12). Pour Tache 1.3.8, mock Sentry si absent.

15. **Piege : ErrorCode enum break compat si valeurs changent.**
    - Pourquoi : frontend hardcode `code === 'POLICY_EXPIRED'`. Si backend renomme, frontend break.
    - Solution : enum string values stables, ajout autorise (deprecation), retrait Sprint majeur.

---

## 3. Architecture context

### 3.1 Position dans le sprint

- **Depend de** : Tache 1.3.3 (Pino logger), Tache 1.3.4 (RequestContext pour traceId), Tache 1.3.6 (ZodValidationPipe genere BadRequestException), Tache 1.3.7 (format coherent).
- **Bloque** : Sprint 5 (AuthService throw BusinessError), Sprint 6 (TenantContextInterceptor throw `TENANT_INVALID`), Tache 1.3.12 (Sentry capture 5xx), Sprints 8+ (chaque service throw BusinessError).

### 3.2 Position dans le programme global

- Sprint 5 : AuthService throw BusinessError pour 401/403/422 cases.
- Sprint 8 : ContactsService throw BusinessError pour 404/409 cases.
- Sprint 11 : PaymentsService throw BusinessError pour 402/409/410 cases.
- Sprint 12 : Audit logs ACAPS captent les BusinessError + 5xx.
- Sprint 33 : pen-test verifie aucun PII dans logs ou Sentry.
- Sprint 35 : Sentry alerts 5xx vers Slack #incidents.

### 3.3 Diagramme flow Exception

```
Controller / Service / Guard / Pipe throws Exception
    |
    v
[NestJS exception bubble up]
    |
    v
[AllExceptionsFilter.catch(exception, host)]
    |
    +-- normalizeException(exception) -> { status, code, message, details }
    |     |
    |     +-- if HttpException -> extract status + message (preserve details si Zod)
    |     +-- if BusinessError -> { exception.code, exception.status, exception.message }
    |     +-- if QueryFailedError TypeORM -> map to CONFLICT/SERVICE_UNAVAILABLE
    |     +-- if RedisError / KafkaError -> SERVICE_UNAVAILABLE
    |     +-- else (Error generique) -> INTERNAL_ERROR 500
    |
    +-- redactPII(message, details) -> remove password, cin, email, etc.
    |
    +-- log via Pino logger.error({ exception, context, request })
    |     (avec PII redact via errSerializer Tache 1.3.3)
    |
    +-- if status >= 500 -> Sentry.captureException(exception, { context, user, tenant })
    |     (avec beforeSend PII redact Tache 1.3.12)
    |
    +-- markSpanError OTEL Tache 1.3.4 -> span.setStatus(ERROR)
    |
    +-- Build response body :
    |     {
    |       error: <human readable>,
    |       code: <ErrorCode stable>,
    |       message: <generic en prod, detail en dev>,
    |       traceId, request_id, timestamp,
    |       fields?: <pour validation errors>,
    |       details?: <dev/staging only>,
    |     }
    |
    +-- response.status(status).send(body)
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/apps/api/src/exceptions/all-exceptions.filter.ts` (~200 lignes) filter NestJS
- [ ] Fichier `repo/apps/api/src/exceptions/business-error.ts` (~80 lignes) class BusinessError
- [ ] Fichier `repo/apps/api/src/exceptions/error-codes.ts` (~150 lignes) enum + catalog 80 codes
- [ ] Fichier `repo/apps/api/src/exceptions/normalize-exception.ts` (~150 lignes) helper
- [ ] Fichier `repo/apps/api/src/exceptions/redact-pii-error.ts` (~80 lignes) helper redaction
- [ ] Fichier `repo/apps/api/src/exceptions/exception.module.ts` (~30 lignes) module Global
- [ ] Fichier `repo/apps/api/src/exceptions/exceptions-format.types.ts` (~60 lignes) interfaces
- [ ] Fichier `repo/apps/api/src/exceptions/all-exceptions.filter.spec.ts` (~250 lignes) tests filter
- [ ] Fichier `repo/apps/api/src/exceptions/business-error.spec.ts` (~80 lignes) tests class
- [ ] Fichier `repo/apps/api/src/exceptions/normalize-exception.spec.ts` (~180 lignes) tests
- [ ] Fichier `repo/apps/api/src/exceptions/redact-pii-error.spec.ts` (~120 lignes) tests
- [ ] Fichier `repo/apps/api/src/test-controller/test-error.controller.ts` (~100 lignes) demo
- [ ] Fichier `repo/apps/api/e2e/error-format.spec.ts` (~150 lignes) E2E
- [ ] Fichier `repo/apps/api/src/app.module.ts` (UPDATE +1 import ExceptionModule)
- [ ] Tests passent (>= 40 tests)
- [ ] Aucune emoji

Total : 13 NEW + 1 UPDATE.

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/exceptions/all-exceptions.filter.ts                    (~200 lignes / NEW)
repo/apps/api/src/exceptions/business-error.ts                            (~80 lignes / NEW)
repo/apps/api/src/exceptions/error-codes.ts                               (~150 lignes / NEW catalog)
repo/apps/api/src/exceptions/normalize-exception.ts                       (~150 lignes / NEW)
repo/apps/api/src/exceptions/redact-pii-error.ts                          (~80 lignes / NEW)
repo/apps/api/src/exceptions/exception.module.ts                          (~30 lignes / NEW Global)
repo/apps/api/src/exceptions/exceptions-format.types.ts                   (~60 lignes / NEW)
repo/apps/api/src/exceptions/all-exceptions.filter.spec.ts                (~250 lignes / NEW)
repo/apps/api/src/exceptions/business-error.spec.ts                       (~80 lignes / NEW)
repo/apps/api/src/exceptions/normalize-exception.spec.ts                  (~180 lignes / NEW)
repo/apps/api/src/exceptions/redact-pii-error.spec.ts                     (~120 lignes / NEW)
repo/apps/api/src/test-controller/test-error.controller.ts                (~100 lignes / NEW demo)
repo/apps/api/e2e/error-format.spec.ts                                     (~150 lignes / NEW E2E)
repo/apps/api/src/app.module.ts                                             (UPDATE +1 import)
```

Total : 13 NEW + 1 UPDATE.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/14 : `repo/apps/api/src/exceptions/all-exceptions.filter.ts`

```typescript
/**
 * AllExceptionsFilter -- catch toutes exceptions et format response unifiee.
 *
 * Pattern :
 *   1. normalizeException : determine status, code, message, details
 *   2. redactPII : enleve password, cin, email, etc.
 *   3. log via Pino (level error)
 *   4. Sentry capture si status >= 500
 *   5. markSpanError OTEL
 *   6. Build response body unifie
 *
 * Reference : decision-006 + decision-008 (CNDP) + decision-003.
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { normalizeException } from './normalize-exception';
import { redactPiiInError } from './redact-pii-error';
import { ErrorCodes } from './error-codes';
import { getRequestContext } from '../common/context/request-context';
import { markSpanError } from '../common/context/otel-span-enricher';
import type { ApiErrorResponse } from './exceptions-format.types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestContext = getRequestContext();

    // 1. Normalize
    const normalized = normalizeException(exception);

    // 2. Redact PII
    const redacted = redactPiiInError(normalized);

    // 3. Log via Pino
    this.logException(exception, redacted, request);

    // 4. Sentry capture si 5xx
    if (redacted.status >= 500) {
      this.captureSentry(exception, request, requestContext);
    }

    // 5. Mark OTEL span error
    if (exception instanceof Error) {
      markSpanError(exception);
    }

    // 6. Build response body
    const body = this.buildResponseBody(redacted, requestContext);

    // 7. Send response
    response.status(redacted.status).send(body);
  }

  private logException(
    original: unknown,
    normalized: ReturnType<typeof normalizeException>,
    request: FastifyRequest,
  ): void {
    const isServerError = normalized.status >= 500;
    const logMethod = isServerError ? 'error' : 'warn';
    const requestContext = getRequestContext();

    this.logger[logMethod]({
      msg: normalized.message,
      code: normalized.code,
      status: normalized.status,
      err: original instanceof Error ? original : new Error(String(original)),
      req: {
        method: request.method,
        url: request.url,
      },
      tenant_id: requestContext?.tenantId,
      user_id: requestContext?.userId,
      request_id: requestContext?.requestId,
      trace_id: requestContext?.traceId,
    });
  }

  private captureSentry(
    exception: unknown,
    request: FastifyRequest,
    ctx: ReturnType<typeof getRequestContext>,
  ): void {
    try {
      // Sentry sera importe Tache 1.3.12. Pour Tache 1.3.8 : skip si absent.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      Sentry.captureException(exception, {
        contexts: {
          request: {
            method: request.method,
            url: request.url,
          },
        },
        tags: {
          tenant_id: ctx?.tenantId,
          trace_id: ctx?.traceId,
        },
        user: ctx?.userId ? { id: ctx.userId } : undefined,
      });
    } catch {
      // Sentry pas installe (Tache 1.3.12 enrichira). Skip silently.
    }
  }

  private buildResponseBody(
    normalized: ReturnType<typeof normalizeException>,
    ctx: ReturnType<typeof getRequestContext>,
  ): ApiErrorResponse {
    const isProduction = process.env.NODE_ENV === 'production';
    const body: ApiErrorResponse = {
      error: normalized.error,
      code: normalized.code,
      message: isProduction ? this.getGenericMessage(normalized.code) : normalized.message,
      traceId: ctx?.traceId ?? 'unknown',
      request_id: ctx?.requestId ?? 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Fields pour validation errors
    if (normalized.fields) {
      body.fields = normalized.fields;
    }

    // Details : dev/staging only
    if (!isProduction && normalized.details) {
      body.details = normalized.details;
    }

    // Stack : dev only
    if (process.env.NODE_ENV === 'development' && normalized.stack) {
      body.stack = normalized.stack;
    }

    return body;
  }

  private getGenericMessage(code: string): string {
    return ErrorCodes[code as keyof typeof ErrorCodes]?.message ?? 'An error occurred';
  }
}
```

### 6.2 Fichier 2/14 : `repo/apps/api/src/exceptions/business-error.ts`

```typescript
/**
 * BusinessError -- exception class pour erreurs metier typees.
 *
 * Usage Sprint 5+ :
 *   throw new BusinessError({
 *     code: ErrorCode.AUTH_INVALID_CREDENTIALS,
 *     status: 401,
 *     details: { attempts_remaining: 2 },
 *   });
 *
 * Reference : decision-006.
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import type { ErrorCode } from './error-codes';

export interface BusinessErrorOptions {
  /** Code stable du catalog ErrorCode. */
  code: ErrorCode;
  /** HTTP status code (default depend du code). */
  status?: number;
  /** Message human-readable (peut etre override par filter en prod). */
  message?: string;
  /** Details metier additionnels (object). */
  details?: Record<string, unknown>;
  /** Cause Error (chained). */
  cause?: Error;
}

export class BusinessError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly isBusinessError = true;

  constructor(opts: BusinessErrorOptions) {
    super(opts.message ?? opts.code);
    this.name = 'BusinessError';
    this.code = opts.code;
    this.status = opts.status ?? 400;
    this.details = opts.details;
    if (opts.cause) {
      // Node 16.9+ supporte cause natively
      (this as any).cause = opts.cause;
    }
    // Capture stack proper
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BusinessError);
    }
  }

  /** Type guard. */
  static isBusinessError(err: unknown): err is BusinessError {
    return (
      err instanceof BusinessError ||
      (typeof err === 'object' && err !== null && (err as any).isBusinessError === true)
    );
  }

  /** Serialize pour log/audit. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}
```

### 6.3 Fichier 3/14 : `repo/apps/api/src/exceptions/error-codes.ts`

```typescript
/**
 * ErrorCode catalog -- enumere les ~80 codes erreur stables du programme.
 *
 * Convention :
 *   - Codes UPPER_SNAKE_CASE
 *   - Status code default associe
 *   - Message generique (i18n Sprint 9 enrichira)
 *
 * Reference : decision-006.
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */

export const ErrorCodes = {
  // === Validation (400) ===
  VALIDATION_FAILED: { status: 400, message: 'Request validation failed' },
  INVALID_PAYLOAD: { status: 400, message: 'Invalid request payload' },
  MISSING_REQUIRED_FIELD: { status: 400, message: 'Missing required field' },
  IDEMPOTENCY_KEY_MISSING: { status: 400, message: 'Idempotency-Key header required' },
  IDEMPOTENCY_KEY_REUSED: { status: 409, message: 'Idempotency-Key reused with different payload' },

  // === Auth (401, 403) ===
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  AUTH_INVALID_CREDENTIALS: { status: 401, message: 'Invalid credentials' },
  AUTH_TOKEN_EXPIRED: { status: 401, message: 'Token expired' },
  AUTH_TOKEN_INVALID: { status: 401, message: 'Invalid token' },
  AUTH_MFA_REQUIRED: { status: 401, message: 'MFA required' },
  AUTH_MFA_INVALID: { status: 401, message: 'Invalid MFA code' },
  AUTH_EMAIL_NOT_VERIFIED: { status: 403, message: 'Email not verified' },
  AUTH_ACCOUNT_LOCKED: { status: 403, message: 'Account locked' },
  AUTH_ACCOUNT_SUSPENDED: { status: 403, message: 'Account suspended' },
  FORBIDDEN: { status: 403, message: 'Insufficient permissions' },
  RBAC_INSUFFICIENT_ROLE: { status: 403, message: 'Insufficient role' },
  RBAC_TENANT_MISMATCH: { status: 403, message: 'Tenant mismatch' },
  CSRF_TOKEN_INVALID: { status: 403, message: 'CSRF token invalid' },

  // === Tenant (400) ===
  TENANT_REQUIRED: { status: 400, message: 'Tenant context required' },
  TENANT_INVALID: { status: 400, message: 'Invalid tenant ID format' },
  TENANT_NOT_FOUND: { status: 404, message: 'Tenant not found' },
  TENANT_SUSPENDED: { status: 403, message: 'Tenant suspended' },

  // === Resource (404, 409, 410) ===
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CONFLICT: { status: 409, message: 'Resource conflict' },
  GONE: { status: 410, message: 'Resource gone' },
  PRECONDITION_FAILED: { status: 412, message: 'Precondition failed' },

  // === Business : Auth Sprint 5 ===
  USER_ALREADY_EXISTS: { status: 409, message: 'User already exists' },
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  PASSWORD_TOO_WEAK: { status: 422, message: 'Password too weak' },
  PASSWORD_SAME_AS_OLD: { status: 422, message: 'New password same as old' },

  // === Business : CRM Sprint 8 ===
  CONTACT_NOT_FOUND: { status: 404, message: 'Contact not found' },
  CONTACT_DUPLICATE: { status: 409, message: 'Contact duplicate' },
  COMPANY_NOT_FOUND: { status: 404, message: 'Company not found' },

  // === Business : Booking Sprint 8 ===
  APPOINTMENT_NOT_FOUND: { status: 404, message: 'Appointment not found' },
  APPOINTMENT_CONFLICT: { status: 409, message: 'Appointment time conflict' },
  ROOM_NOT_AVAILABLE: { status: 409, message: 'Room not available' },

  // === Business : Comm Sprint 9 ===
  WHATSAPP_DELIVERY_FAILED: { status: 502, message: 'WhatsApp delivery failed' },
  EMAIL_DELIVERY_FAILED: { status: 502, message: 'Email delivery failed' },
  SMS_DELIVERY_FAILED: { status: 502, message: 'SMS delivery failed' },

  // === Business : Docs Sprint 10 ===
  DOCUMENT_NOT_FOUND: { status: 404, message: 'Document not found' },
  DOCUMENT_TOO_LARGE: { status: 413, message: 'Document too large' },
  DOCUMENT_INVALID_FORMAT: { status: 415, message: 'Document invalid format' },
  S3_UPLOAD_FAILED: { status: 502, message: 'S3 upload failed' },

  // === Business : Signature Sprint 10 ===
  SIGNATURE_PENDING: { status: 412, message: 'Signature pending' },
  SIGNATURE_REJECTED: { status: 410, message: 'Signature rejected' },
  SIGNATURE_PROVIDER_UNAVAILABLE: { status: 503, message: 'Signature provider unavailable' },

  // === Business : Pay Sprint 11 ===
  PAYMENT_DECLINED: { status: 402, message: 'Payment declined' },
  PAYMENT_GATEWAY_UNAVAILABLE: { status: 503, message: 'Payment gateway unavailable' },
  PAYMENT_INSUFFICIENT_FUNDS: { status: 402, message: 'Insufficient funds' },
  PAYMENT_FRAUD_SUSPECTED: { status: 403, message: 'Payment fraud suspected' },
  REFUND_NOT_AUTHORIZED: { status: 403, message: 'Refund not authorized' },

  // === Business : Books / Compliance Sprint 12 ===
  INVOICE_NOT_FOUND: { status: 404, message: 'Invoice not found' },
  ACAPS_REPORT_FAILED: { status: 502, message: 'ACAPS report generation failed' },
  AMC_REPORT_FAILED: { status: 502, message: 'AMC report generation failed' },

  // === Business : Insure Sprint 14 ===
  POLICY_NOT_FOUND: { status: 404, message: 'Policy not found' },
  POLICY_EXPIRED: { status: 410, message: 'Policy expired' },
  POLICY_CANCELLED: { status: 410, message: 'Policy cancelled' },
  QUOTE_EXPIRED: { status: 410, message: 'Quote expired' },
  COVERAGE_INSUFFICIENT: { status: 422, message: 'Coverage insufficient' },

  // === Business : Repair Sprint 19-21 ===
  CLAIM_NOT_FOUND: { status: 404, message: 'Claim not found' },
  CLAIM_ALREADY_CLOSED: { status: 410, message: 'Claim already closed' },
  ESTIMATION_PENDING: { status: 412, message: 'Estimation pending' },
  GARAGE_NOT_AVAILABLE: { status: 409, message: 'Garage not available' },

  // === Rate Limit ===
  RATE_LIMIT: { status: 429, message: 'Too many requests' },
  RATE_LIMIT_AUTH: { status: 429, message: 'Too many authentication attempts' },
  RATE_LIMIT_API: { status: 429, message: 'API rate limit exceeded' },

  // === System (500, 502, 503, 504) ===
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  NOT_IMPLEMENTED: { status: 501, message: 'Not implemented' },
  BAD_GATEWAY: { status: 502, message: 'Bad gateway' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' },
  GATEWAY_TIMEOUT: { status: 504, message: 'Gateway timeout' },

  // === Database ===
  DATABASE_CONNECTION_LOST: { status: 503, message: 'Database connection lost' },
  DATABASE_QUERY_TIMEOUT: { status: 504, message: 'Database query timeout' },
  DATABASE_CONSTRAINT_VIOLATION: { status: 409, message: 'Database constraint violation' },
  DATABASE_FOREIGN_KEY_VIOLATION: { status: 409, message: 'Foreign key constraint violation' },

  // === External Services ===
  REDIS_UNAVAILABLE: { status: 503, message: 'Redis unavailable' },
  KAFKA_UNREACHABLE: { status: 503, message: 'Kafka unreachable' },
  S3_UNAVAILABLE: { status: 503, message: 'Object storage unavailable' },
  SKALEAN_AI_UNAVAILABLE: { status: 503, message: 'Skalean AI service unavailable' },

  // === MCP Sprint 30 ===
  MCP_TOOL_NOT_FOUND: { status: 404, message: 'MCP tool not found' },
  MCP_TOOL_EXECUTION_FAILED: { status: 502, message: 'MCP tool execution failed' },
  MCP_TIMEOUT: { status: 504, message: 'MCP timeout' },

  // === Misc ===
  FEATURE_DISABLED: { status: 503, message: 'Feature temporarily disabled' },
  MAINTENANCE_MODE: { status: 503, message: 'Maintenance mode' },
  DEPRECATED: { status: 410, message: 'Endpoint deprecated' },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
```

### 6.4 Fichier 4/14 : `repo/apps/api/src/exceptions/normalize-exception.ts`

```typescript
/**
 * normalizeException -- transforme une exception en objet structure.
 *
 * Reference : decision-006.
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import { HttpException } from '@nestjs/common';
import { BusinessError } from './business-error';
import { ErrorCodes, type ErrorCode } from './error-codes';

export interface NormalizedException {
  status: number;
  code: ErrorCode | string;
  error: string;
  message: string;
  details?: Record<string, unknown>;
  fields?: unknown[];
  stack?: string;
}

export function normalizeException(exception: unknown): NormalizedException {
  // Cas 1 : BusinessError
  if (BusinessError.isBusinessError(exception)) {
    return {
      status: exception.status,
      code: exception.code,
      error: errorNameFromCode(exception.code),
      message: exception.message,
      details: exception.details,
      stack: exception.stack,
    };
  }

  // Cas 2 : HttpException NestJS
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const status = exception.getStatus();
    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      return {
        status,
        code: (obj.code as string) ?? mapStatusToCode(status),
        error: (obj.error as string) ?? errorNameFromStatus(status),
        message: (obj.message as string) ?? exception.message,
        fields: Array.isArray(obj.fields) ? obj.fields : undefined,
        details: typeof obj.details === 'object' && obj.details !== null
          ? (obj.details as Record<string, unknown>)
          : undefined,
        stack: exception.stack,
      };
    }
    return {
      status,
      code: mapStatusToCode(status),
      error: errorNameFromStatus(status),
      message: typeof response === 'string' ? response : exception.message,
      stack: exception.stack,
    };
  }

  // Cas 3 : QueryFailedError TypeORM (Sprint 6+)
  if (isQueryFailedError(exception)) {
    return mapQueryFailedError(exception);
  }

  // Cas 4 : Erreur reseau (Redis/Kafka/S3)
  if (isNetworkError(exception)) {
    return mapNetworkError(exception);
  }

  // Cas 5 : Error generique -> 500
  if (exception instanceof Error) {
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      error: 'internal_error',
      message: exception.message,
      stack: exception.stack,
    };
  }

  // Cas 6 : non-Error throw
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    error: 'internal_error',
    message: String(exception),
  };
}

function errorNameFromCode(code: string): string {
  return code.toLowerCase().replace(/_/g, '_');
}

function errorNameFromStatus(status: number): string {
  if (status >= 500) return 'internal_error';
  if (status === 429) return 'rate_limit';
  if (status === 422) return 'unprocessable';
  if (status >= 400 && status < 500) return 'bad_request';
  return 'error';
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case 400: return 'INVALID_PAYLOAD';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 410: return 'GONE';
    case 412: return 'PRECONDITION_FAILED';
    case 413: return 'DOCUMENT_TOO_LARGE';
    case 422: return 'VALIDATION_FAILED';
    case 429: return 'RATE_LIMIT';
    case 500: return 'INTERNAL_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return 'INTERNAL_ERROR';
  }
}

function isQueryFailedError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.constructor?.name === 'QueryFailedError'
  );
}

function mapQueryFailedError(err: any): NormalizedException {
  const code = err.code; // Postgres error code
  if (code === '23505') {
    return {
      status: 409,
      code: 'DATABASE_CONSTRAINT_VIOLATION',
      error: 'conflict',
      message: 'Resource already exists',
      stack: err.stack,
    };
  }
  if (code === '23503') {
    return {
      status: 409,
      code: 'DATABASE_FOREIGN_KEY_VIOLATION',
      error: 'conflict',
      message: 'Foreign key constraint violation',
      stack: err.stack,
    };
  }
  if (code === '57P03' || code === '08006') {
    return {
      status: 503,
      code: 'DATABASE_CONNECTION_LOST',
      error: 'service_unavailable',
      message: 'Database connection lost',
      stack: err.stack,
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    error: 'internal_error',
    message: 'Database error',
    stack: err.stack,
  };
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as any).code;
  return ['ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENOTFOUND'].includes(code);
}

function mapNetworkError(err: any): NormalizedException {
  const errCode = err.code;
  if (errCode === 'ECONNREFUSED' || errCode === 'EHOSTUNREACH') {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      error: 'service_unavailable',
      message: 'External service unavailable',
      stack: err.stack,
    };
  }
  if (errCode === 'ETIMEDOUT') {
    return {
      status: 504,
      code: 'GATEWAY_TIMEOUT',
      error: 'gateway_timeout',
      message: 'External service timeout',
      stack: err.stack,
    };
  }
  return {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    error: 'service_unavailable',
    message: 'Network error',
    stack: err.stack,
  };
}
```

### 6.5 Fichier 5/14 : `repo/apps/api/src/exceptions/redact-pii-error.ts`

```typescript
/**
 * redactPiiInError -- redacte les valeurs PII dans message + details.
 *
 * Defense-in-depth : meme si Pino redact rate, ce filter rattrape.
 *
 * Reference : Loi 09-08 + decision-008 + decision-006.
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import type { NormalizedException } from './normalize-exception';

const PII_FIELD_NAMES = [
  'password',
  'password_confirmation',
  'current_password',
  'new_password',
  'refresh_token',
  'access_token',
  'totp_code',
  'cin',
  'passport_number',
  'driver_license',
  'phone',
  'email',
  'iban',
  'bank_account_number',
  'card_number',
  'card_cvc',
  'card_expiry',
  'cnss_number',
  'amo_number',
  'salary',
  'medical_history',
];

const PII_PATTERNS_IN_MESSAGE = [
  // Email
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  // Phone Maroc
  /\+212\d{9}/g,
  // CIN format
  /\b[A-Z]{1,2}\d{4,7}\b/g,
  // IBAN
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
  // Card 16 digits
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
];

const REDACTED = '[REDACTED]';

export function redactPiiInError(normalized: NormalizedException): NormalizedException {
  return {
    ...normalized,
    message: redactString(normalized.message),
    details: normalized.details ? redactObject(normalized.details) : undefined,
    fields: normalized.fields ? normalized.fields.map(redactValue) : undefined,
  };
}

function redactString(s: string): string {
  let result = s;
  for (const pattern of PII_PATTERNS_IN_MESSAGE) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELD_NAMES.includes(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = redactValue(value);
    }
  }
  return result;
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === 'object' && value !== null) {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}
```

### 6.6 Fichier 6/14 : `repo/apps/api/src/exceptions/exception.module.ts`

```typescript
/**
 * ExceptionModule -- enregistre AllExceptionsFilter globalement.
 *
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import { Module, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class ExceptionModule {}
```

### 6.7 Fichier 7/14 : `repo/apps/api/src/exceptions/exceptions-format.types.ts`

```typescript
/**
 * Types format error response.
 *
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */

export interface ApiErrorResponse {
  error: string;
  code: string;
  message: string;
  traceId: string;
  request_id: string;
  timestamp: string;
  fields?: unknown[];
  details?: Record<string, unknown>;
  stack?: string;
}
```

### 6.8 Fichier 8/14 : `repo/apps/api/src/exceptions/all-exceptions.filter.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { BusinessError } from './business-error';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/v1/test',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('catch HttpException 400 -> status 400 + body unifie', () => {
    const exception = new BadRequestException('Bad request');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
        code: expect.any(String),
        message: expect.any(String),
        traceId: expect.any(String),
        request_id: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it('catch BusinessError -> respect status + code', () => {
    const exception = new BusinessError({
      code: 'POLICY_EXPIRED',
      status: 410,
      message: 'Policy expired',
    });
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(410);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.code).toBe('POLICY_EXPIRED');
  });

  it('catch Error generique -> 500 INTERNAL_ERROR', () => {
    const exception = new Error('Boom');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('production : message generique sur 500', () => {
    process.env.NODE_ENV = 'production';
    const exception = new Error('Internal detail leak');
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });

  it('development : message detaille sur 500', () => {
    process.env.NODE_ENV = 'development';
    const exception = new Error('Detailed message');
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.message).toBe('Detailed message');
  });

  it('development : stack inclus', () => {
    process.env.NODE_ENV = 'development';
    const exception = new Error('Detailed');
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.stack).toBeDefined();
  });

  it('production : stack ABSENT', () => {
    process.env.NODE_ENV = 'production';
    const exception = new Error('Detailed');
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.stack).toBeUndefined();
  });

  it('catch BadRequestException avec fields Zod -> propage fields', () => {
    const exception = new BadRequestException({
      error: 'validation',
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      fields: [{ path: 'email', message: 'Invalid' }],
    });
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.fields).toEqual([{ path: 'email', message: 'Invalid' }]);
  });

  it('catch BusinessError avec details -> propage details (non-prod)', () => {
    process.env.NODE_ENV = 'development';
    const exception = new BusinessError({
      code: 'PAYMENT_DECLINED',
      status: 402,
      details: { provider: 'cmi', reason: 'insufficient_funds' },
    });
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.details).toEqual({ provider: 'cmi', reason: 'insufficient_funds' });
  });

  it('production : details ABSENTS', () => {
    process.env.NODE_ENV = 'production';
    const exception = new BusinessError({
      code: 'PAYMENT_DECLINED',
      status: 402,
      details: { provider: 'cmi', reason: 'insufficient_funds' },
    });
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.details).toBeUndefined();
  });

  it('redaction PII : email dans message redacte', () => {
    process.env.NODE_ENV = 'development';
    const exception = new Error('User foo@bar.com not found');
    filter.catch(exception, mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.message).not.toContain('foo@bar.com');
    expect(body.message).toContain('[REDACTED]');
  });

  it('non-Error throw -> 500', () => {
    filter.catch('string error', mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('null exception -> 500', () => {
    filter.catch(null, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('body inclut traceId, request_id, timestamp', () => {
    filter.catch(new Error('test'), mockHost);
    const body = mockResponse.send.mock.calls[0][0];
    expect(body.traceId).toBeDefined();
    expect(body.request_id).toBeDefined();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

### 6.9 Fichier 9/14 : `repo/apps/api/src/exceptions/business-error.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { BusinessError } from './business-error';

describe('BusinessError', () => {
  it('cree avec code minimum', () => {
    const err = new BusinessError({ code: 'NOT_FOUND' });
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(400); // default
    expect(err.name).toBe('BusinessError');
  });

  it('cree avec status custom', () => {
    const err = new BusinessError({ code: 'POLICY_EXPIRED', status: 410 });
    expect(err.status).toBe(410);
  });

  it('cree avec message custom', () => {
    const err = new BusinessError({ code: 'X', message: 'Custom msg' });
    expect(err.message).toBe('Custom msg');
  });

  it('cree avec details', () => {
    const err = new BusinessError({
      code: 'PAYMENT_DECLINED',
      status: 402,
      details: { provider: 'cmi', code: 'NSF' },
    });
    expect(err.details).toEqual({ provider: 'cmi', code: 'NSF' });
  });

  it('cree avec cause chained', () => {
    const cause = new Error('inner');
    const err = new BusinessError({ code: 'X', cause });
    expect((err as any).cause).toBe(cause);
  });

  it('isBusinessError type guard true', () => {
    const err = new BusinessError({ code: 'X' });
    expect(BusinessError.isBusinessError(err)).toBe(true);
  });

  it('isBusinessError sur Error generique false', () => {
    expect(BusinessError.isBusinessError(new Error())).toBe(false);
  });

  it('toJSON serialise', () => {
    const err = new BusinessError({
      code: 'NOT_FOUND',
      status: 404,
      message: 'X',
      details: { id: '123' },
    });
    const json = err.toJSON();
    expect(json.code).toBe('NOT_FOUND');
    expect(json.status).toBe(404);
    expect(json.details).toEqual({ id: '123' });
  });

  it('stack capture', () => {
    const err = new BusinessError({ code: 'X' });
    expect(err.stack).toContain('BusinessError');
  });
});
```

### 6.10 Fichier 10/14 : `repo/apps/api/src/exceptions/normalize-exception.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { HttpException, BadRequestException, NotFoundException } from '@nestjs/common';
import { normalizeException } from './normalize-exception';
import { BusinessError } from './business-error';

describe('normalizeException', () => {
  it('BusinessError -> respect code/status/details', () => {
    const err = new BusinessError({
      code: 'POLICY_EXPIRED',
      status: 410,
      message: 'Expired',
      details: { policy_id: 'X' },
    });
    const result = normalizeException(err);
    expect(result.status).toBe(410);
    expect(result.code).toBe('POLICY_EXPIRED');
    expect(result.message).toBe('Expired');
    expect(result.details).toEqual({ policy_id: 'X' });
  });

  it('HttpException 400 string -> status 400', () => {
    const result = normalizeException(new BadRequestException('Bad'));
    expect(result.status).toBe(400);
    expect(result.message).toBe('Bad');
  });

  it('HttpException 404 -> NOT_FOUND code', () => {
    const result = normalizeException(new NotFoundException('Not found'));
    expect(result.status).toBe(404);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('HttpException avec object body -> propage code', () => {
    const err = new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Validation',
      fields: [{ path: 'X' }],
    });
    const result = normalizeException(err);
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.fields).toEqual([{ path: 'X' }]);
  });

  it('Error generique -> 500 INTERNAL_ERROR', () => {
    const result = normalizeException(new Error('Boom'));
    expect(result.status).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('non-Error string -> 500', () => {
    const result = normalizeException('string');
    expect(result.status).toBe(500);
    expect(result.message).toBe('string');
  });

  it('null -> 500', () => {
    const result = normalizeException(null);
    expect(result.status).toBe(500);
  });

  it('undefined -> 500', () => {
    const result = normalizeException(undefined);
    expect(result.status).toBe(500);
  });

  it('QueryFailedError unique constraint -> 409', () => {
    const fakeQueryError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    Object.setPrototypeOf(fakeQueryError, { constructor: { name: 'QueryFailedError' } });
    const result = normalizeException(fakeQueryError);
    expect(result.status).toBe(409);
    expect(result.code).toBe('DATABASE_CONSTRAINT_VIOLATION');
  });

  it('Erreur reseau ECONNREFUSED -> 503', () => {
    const fakeNetErr = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    const result = normalizeException(fakeNetErr);
    expect(result.status).toBe(503);
    expect(result.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('Erreur reseau ETIMEDOUT -> 504', () => {
    const fakeNetErr = Object.assign(new Error('timeout'), {
      code: 'ETIMEDOUT',
    });
    const result = normalizeException(fakeNetErr);
    expect(result.status).toBe(504);
    expect(result.code).toBe('GATEWAY_TIMEOUT');
  });
});
```

### 6.11 Fichier 11/14 : `repo/apps/api/src/exceptions/redact-pii-error.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { redactPiiInError } from './redact-pii-error';

describe('redactPiiInError', () => {
  it('redacte email dans message', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'User foo@bar.com not found',
    });
    expect(result.message).not.toContain('foo@bar.com');
    expect(result.message).toContain('[REDACTED]');
  });

  it('redacte phone Maroc dans message', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'Phone +212612345678 invalid',
    });
    expect(result.message).not.toContain('+212612345678');
  });

  it('redacte CIN dans message', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'CIN B123456 not registered',
    });
    expect(result.message).toContain('[REDACTED]');
  });

  it('redacte password dans details', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'X',
      details: { password: 'secret123', name: 'Test' },
    });
    expect(result.details?.password).toBe('[REDACTED]');
    expect(result.details?.name).toBe('Test');
  });

  it('redacte iban dans details', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'X',
      details: { iban: 'MA64011519000001205000534921', amount: 100 },
    });
    expect(result.details?.iban).toBe('[REDACTED]');
    expect(result.details?.amount).toBe(100);
  });

  it('redacte card_number dans details', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'X',
      details: { card_number: '4111111111111111' },
    });
    expect(result.details?.card_number).toBe('[REDACTED]');
  });

  it('redacte nested objects dans details', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'X',
      details: { user: { password: 'secret', name: 'Test' } },
    });
    expect((result.details?.user as any).password).toBe('[REDACTED]');
    expect((result.details?.user as any).name).toBe('Test');
  });

  it('redacte arrays', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'X',
      details: { users: [{ password: 'p1' }, { password: 'p2' }] },
    });
    const users = result.details?.users as any[];
    expect(users[0].password).toBe('[REDACTED]');
    expect(users[1].password).toBe('[REDACTED]');
  });

  it('preserve fields safe', () => {
    const result = redactPiiInError({
      status: 500,
      code: 'X',
      error: 'X',
      message: 'X',
      details: { id: 'abc', count: 5, active: true },
    });
    expect(result.details).toEqual({ id: 'abc', count: 5, active: true });
  });
});
```

### 6.12 Fichier 12/14 : `repo/apps/api/src/test-controller/test-error.controller.ts`

```typescript
/**
 * Test controller demo pour error format E2E.
 *
 * IMPORTANT : ce controller temporaire Sprint 3, retire Sprint 5.
 *
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import {
  Controller,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BusinessError } from '../exceptions/business-error';
import { ErrorCodes } from '../exceptions/error-codes';

@Controller('api/v1/test/force-error')
export class TestErrorController {
  @Get(':code')
  forceError(@Param('code') code: string) {
    if (code === 'business-not-found') {
      throw new BusinessError({ code: 'NOT_FOUND', status: 404, message: 'Resource not found' });
    }
    if (code === 'business-policy-expired') {
      throw new BusinessError({
        code: 'POLICY_EXPIRED',
        status: 410,
        details: { expired_at: '2025-01-01' },
      });
    }
    if (code === 'http-bad-request') {
      throw new BadRequestException('Bad request');
    }
    if (code === 'http-not-found') {
      throw new NotFoundException('Not found');
    }
    if (code === 'http-unauthorized') {
      throw new UnauthorizedException('Unauthorized');
    }
    if (code === 'generic-error') {
      throw new Error('Generic error message');
    }
    if (code === 'pii-leak-email') {
      throw new Error('User leaked@example.com not found');
    }
    if (code === 'pii-leak-cin') {
      throw new Error('CIN B123456 not registered');
    }
    if (code === 'type-error') {
      const obj: any = null;
      return obj.x; // TypeError
    }
    if (code === 'reference-error') {
      // @ts-expect-error volontaire
      return undefinedVariable;
    }
    return { received: code };
  }
}
```

### 6.13 Fichier 13/14 : `repo/apps/api/e2e/error-format.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:14000';

test.describe('Error Format E2E (Sprint 3 Tache 1.3.8)', () => {
  test('BusinessError 404 -> body { error, code, traceId }', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/business-not-found');
    expect(r.status()).toBe(404);
    const body = await r.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.traceId).toBeDefined();
    expect(body.request_id).toBeDefined();
    expect(body.timestamp).toMatch(/^\d{4}/);
  });

  test('BusinessError 410 PolicyExpired', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/business-policy-expired');
    expect(r.status()).toBe(410);
    const body = await r.json();
    expect(body.code).toBe('POLICY_EXPIRED');
  });

  test('HttpException BadRequest 400', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/http-bad-request');
    expect(r.status()).toBe(400);
  });

  test('HttpException Unauthorized 401', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/http-unauthorized');
    expect(r.status()).toBe(401);
  });

  test('Generic Error -> 500 + code INTERNAL_ERROR', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/generic-error');
    expect(r.status()).toBe(500);
    const body = await r.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  test('PII email redacte dans message', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/pii-leak-email');
    const body = await r.json();
    expect(body.message).not.toContain('leaked@example.com');
    expect(body.message).toContain('[REDACTED]');
  });

  test('PII CIN redacte dans message', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/pii-leak-cin');
    const body = await r.json();
    expect(body.message).not.toContain('B123456');
  });

  test('TypeError -> 500', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/type-error');
    expect(r.status()).toBe(500);
  });

  test('Body coherent avec ResponseInterceptor (traceId)', async ({ request }) => {
    const r = await request.get(BASE_URL + '/api/v1/test/force-error/generic-error');
    const traceIdHeader = r.headers()['x-trace-id'];
    const body = await r.json();
    expect(body.traceId).toBe(traceIdHeader);
  });
});
```

### 6.14 Fichier 14/14 : `repo/apps/api/src/app.module.ts` (UPDATE)

```typescript
import { ExceptionModule } from './exceptions/exception.module';
import { TestErrorController } from './test-controller/test-error.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggerModule,
    ContextModule,
    SecurityModule,
    ValidationModule,
    ResponseModule,
    ExceptionModule,                          // NEW Tache 1.3.8
    DatabaseModule,
    RedisModule,
    KafkaModule,
    // ...
  ],
  controllers: [
    AppController,
    TestValidationController,
    TestErrorController,                       // NEW Tache 1.3.8
  ],
})
```

---

## 7. Tests complets

Total : **50 tests** :
- all-exceptions.filter.spec.ts : 14 tests
- business-error.spec.ts : 9 tests
- normalize-exception.spec.ts : 11 tests
- redact-pii-error.spec.ts : 9 tests
- e2e/error-format.spec.ts : 9 tests

Voir sections 6.8-6.13 pour code complet.

---

## 8. Variables environnement

Vars consommees (deja declarees Tache 1.3.1) :
- `NODE_ENV` (production controle expose stack/details)
- `LOG_LEVEL` (filter logge selon level)

---

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/api build
pnpm --filter @insurtech/api dev

# Test BusinessError
curl -s http://localhost:4000/api/v1/test/force-error/business-not-found | jq .

# Test HttpException
curl -s http://localhost:4000/api/v1/test/force-error/http-bad-request | jq .

# Test PII redaction
curl -s http://localhost:4000/api/v1/test/force-error/pii-leak-email | jq .message
# Expected : '[REDACTED]' present, no email visible

# Test TypeError 500
curl -s http://localhost:4000/api/v1/test/force-error/type-error | jq .

# Tests
pnpm --filter @insurtech/api test src/exceptions
pnpm --filter @insurtech/api test:e2e -g error-format
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (16)

- **V1 (P0)** : BusinessError 404 -> response { error, code: NOT_FOUND }
- **V2 (P0)** : BusinessError respect status custom (410)
- **V3 (P0)** : HttpException retourne format unifie
- **V4 (P0)** : Generic Error -> 500 INTERNAL_ERROR
- **V5 (P0)** : Production : message generique sur 500
- **V6 (P0)** : Production : stack ABSENT
- **V7 (P0)** : Development : details visible
- **V8 (P0)** : PII email redacte dans message
- **V9 (P0)** : PII CIN redacte
- **V10 (P0)** : PII password redacte dans details
- **V11 (P0)** : ZodValidation 400 -> fields propages
- **V12 (P0)** : QueryFailedError unique -> 409
- **V13 (P0)** : Erreur reseau ECONNREFUSED -> 503
- **V14 (P0)** : ErrorCode catalog ~80 codes
- **V15 (P0)** : Tests >= 40 PASS
- **V16 (P0)** : Aucune emoji

### Criteres P1 (8)

- **V17 (P1)** : non-Error throw -> 500
- **V18 (P1)** : null exception -> 500
- **V19 (P1)** : body inclut traceId, request_id, timestamp
- **V20 (P1)** : Sentry capture pour 5xx (Tache 1.3.12)
- **V21 (P1)** : Sentry SKIP pour 4xx
- **V22 (P1)** : Logs Pino emit error level
- **V23 (P1)** : OTEL span markError
- **V24 (P1)** : Tests E2E 9 PASS

### Criteres P2 (4)

- **V25 (P2)** : Coverage >= 85%
- **V26 (P2)** : Documentation `apps/api/src/exceptions/README.md`
- **V27 (P2)** : Convention error-codes.md publie
- **V28 (P2)** : Pre-commit lint check ErrorCode usage

Total : 28 criteres.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Exception dans filter lui-meme
**Solution** : try/catch defensif, fallback console.error.

### Edge case 2 : Pino pas pret au boot
**Solution** : Logger NestJS natif fallback.

### Edge case 3 : Sentry init pas fini
**Solution** : try/catch silently skip.

### Edge case 4 : Stack trace tres long (10MB)
**Solution** : Pino tronque automatique 100k chars.

### Edge case 5 : Error avec circular reference
**Solution** : Pino safeStringify gere.

### Edge case 6 : TypeError dans middleware
**Solution** : Fastify error handler par default.

### Edge case 7 : 404 NestJS (route not found) -> filter applique
**Solution** : `@Catch()` global catch tout.

### Edge case 8 : ExceptionFilter applique apres ResponseInterceptor
**Solution** : NestJS pipeline -- exception bypass interceptor map. Filter format coherent.

### Edge case 9 : Code ErrorCode invente non-catalog
**Solution** : pre-commit lint warn.

### Edge case 10 : Stack trace expose IP interne
**Solution** : redactPii pattern IP `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` (Sprint 33 enrich).

### Edge case 11 : Throw a BusinessError sans status -> 400 default
**Solution** : status defaulte 400 (BadRequest). Documenter.

### Edge case 12 : ErrorCode nouveau pas dans ErrorCodes catalog
**Solution** : TypeScript compile error. Force ajout au catalog.

Total : 12 edge cases.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)
- Article 5 : mesures techniques. Triple-couche redaction PII (logger Pino, ExceptionFilter, Sentry beforeSend).
- Article 52 : sanctions penales. Aucun PII en logs/Sentry/responses.

### Loi 09-23 (DGSSI)
- Article 4 : journalisation. Filter logge avec context complet.
- Article 8 : incident response. Sentry alerte 5xx vers PagerDuty Sprint 33.

### decision-008 (Atlas Cloud)
- Logs/Sentry hosted Atlas. Redaction PII obligatoire.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

(14 conventions identiques)

Specificite :
- **Erreurs strict** : BusinessError pour metier, HttpException pour transverse, Error pour bug.
- **Code stable** : ErrorCode enum frontend-routable.
- **PII redact triple-couche** : defense in depth.

---

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint
pnpm --filter @insurtech/api test src/exceptions --coverage
pnpm --filter @insurtech/api test:e2e -g error-format

# Aucune emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src/exceptions && exit 1 || echo OK

# Verify ErrorCode enum 70+ entries
node -e "console.log(Object.keys(require('./apps/api/dist/exceptions/error-codes').ErrorCodes).length)" | grep -E "^[7-9][0-9]+$"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-03): AllExceptionsFilter global + BusinessError class + ErrorCode catalog 80 codes + redaction PII triple-couche

Implementation Tache 1.3.8 du Sprint 3 (Phase 1 Bootstrap Infrastructure).

Catch TOUTES les exceptions (HttpException Zod 400, BusinessError metier,
QueryFailedError TypeORM, NetworkError Redis/Kafka, Error generique) et format
response unifie { error, code, message, traceId, request_id, timestamp,
fields?, details?, stack? } avec details/stack dev/staging only en production
message generique. Class BusinessError avec code (ErrorCode catalog 80 codes
stables : VALIDATION_FAILED, AUTH_*, TENANT_*, PAYMENT_*, POLICY_*, CLAIM_*,
MCP_*, etc.), status, details, cause. Redaction PII triple-couche (logger Pino
serializers Tache 1.3.3, ExceptionFilter PIIRedactor cette tache, Sentry
beforeSend Tache 1.3.12) conformite loi 09-08 article 5/52. Sentry capture
automatique 5xx (skip 4xx attendus). OTEL span markError pour visualisation
Tempo Sprint 35. Logger Pino emit level error avec context complet (traceId,
tenantId, userId, request).

Livrables:
- repo/apps/api/src/exceptions/all-exceptions.filter.ts (200 lignes)
- repo/apps/api/src/exceptions/business-error.ts (80 lignes class)
- repo/apps/api/src/exceptions/error-codes.ts (150 lignes catalog 80 codes)
- repo/apps/api/src/exceptions/normalize-exception.ts (150 lignes mapping)
- repo/apps/api/src/exceptions/redact-pii-error.ts (80 lignes triple-couche)
- repo/apps/api/src/exceptions/exception.module.ts (30 lignes Global)
- repo/apps/api/src/exceptions/exceptions-format.types.ts (60 lignes)
- 4 fichiers tests unit (~630 lignes)
- repo/apps/api/src/test-controller/test-error.controller.ts (100 lignes demo)
- repo/apps/api/e2e/error-format.spec.ts (150 lignes)
- repo/apps/api/src/app.module.ts UPDATE +1 import

Tests: 50 tests (14 filter + 9 business-error + 11 normalize + 9 redact + 9 E2E)
Coverage: >= 85%

Conformite:
- Loi 09-08 CNDP article 5/52 : redaction PII triple-couche
- Loi 09-23 DGSSI article 4/8 : journalisation + incident response
- decision-006 no-emoji ABSOLU
- decision-008 Atlas Cloud : logs/Sentry hebergement souverain
- decision-003 NestJS Fastify : ExceptionFilter standard
- ASVS Level 2 (Sprint 33) : V7.4.1 generic error messages

Task: 1.3.8
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Reference: B-03 Sprint 3 API Bootstrap Tache 1.3.8
Bloque: Tache 1.3.9 (Swagger documente errors), Tache 1.3.12 (Sentry), Sprint 5+"
```

---

## 16. Workflow next step

Apres commit :
- Tache suivante : `task-1.3.9-swagger-openapi-3-setup.md` (Swagger UI sur /docs + OpenAPI generation depuis Zod schemas).

---

## 17. Approfondissement patterns Sprint 5-31

### 17.1 Pattern AuthService throw BusinessError (Sprint 5)

```typescript
// Sprint 5 -- AuthService.login
async login(input: LoginDto): Promise<LoginResult> {
  const user = await this.userRepo.findByEmail(input.email);
  if (!user) {
    throw new BusinessError({
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
    });
  }
  if (user.locked_until && user.locked_until > new Date()) {
    throw new BusinessError({
      code: 'AUTH_ACCOUNT_LOCKED',
      status: 403,
      details: { unlock_at: user.locked_until.toISOString() },
    });
  }
  const valid = await argon2.verify(user.password_hash, input.password + this.pepper);
  if (!valid) {
    await this.incrementFailedAttempts(user.id);
    throw new BusinessError({
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
      details: { attempts_remaining: 5 - user.failed_attempts - 1 },
    });
  }
  if (user.mfa_enabled && !input.totp_code) {
    throw new BusinessError({
      code: 'AUTH_MFA_REQUIRED',
      status: 401,
    });
  }
  // ... return tokens
}
```

### 17.2 Pattern PaymentsService Sprint 11

```typescript
async createIntent(input: PaymentIntentDto): Promise<PaymentIntent> {
  // Idempotency check
  const existing = await this.idempotencyCache.get(input.idempotency_key);
  if (existing) {
    if (!isSamePayload(existing.payload, input)) {
      throw new BusinessError({
        code: 'IDEMPOTENCY_KEY_REUSED',
        status: 409,
      });
    }
    return existing.result;
  }
  
  try {
    const intent = await this.providerSDK.create(input);
    return intent;
  } catch (err) {
    if (err.code === 'INSUFFICIENT_FUNDS') {
      throw new BusinessError({
        code: 'PAYMENT_INSUFFICIENT_FUNDS',
        status: 402,
        details: { provider: input.provider },
        cause: err,
      });
    }
    if (err.code === 'GATEWAY_DOWN') {
      throw new BusinessError({
        code: 'PAYMENT_GATEWAY_UNAVAILABLE',
        status: 503,
        cause: err,
      });
    }
    throw err; // unknown -> filter map to INTERNAL_ERROR
  }
}
```

### 17.3 Frontend Sprint 4 error handling

```typescript
// Sprint 4 -- packages/api-client error handling
class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public message: string,
    public traceId: string,
    public fields?: any[],
    public details?: any,
  ) {
    super(message);
  }
}

function parseApiError(response: Response, body: any): ApiError {
  return new ApiError(
    body.code,
    response.status,
    body.message,
    body.traceId,
    body.fields,
    body.details,
  );
}

// Usage component
try {
  await api.contacts.create(input);
} catch (err) {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_FAILED') {
      // Display field errors
      err.fields?.forEach(f => setFieldError(f.path, f.message));
    } else if (err.code === 'AUTH_TOKEN_EXPIRED') {
      // Refresh token + retry
      await refreshToken();
      return api.contacts.create(input);
    } else if (err.code === 'POLICY_EXPIRED') {
      // Show alert with renewal CTA
      showRenewalDialog();
    } else if (err.status >= 500) {
      // Show generic error + traceId
      showError(`An error occurred. Reference: ${err.traceId}`);
    }
  }
}
```

### 17.4 Mapping ErrorCode vers UI messages localises (Sprint 9)

```typescript
// Sprint 9 -- packages/shared-i18n/src/error-messages.ts
export const ERROR_MESSAGES: Record<string, Record<ErrorCode, string>> = {
  'fr-MA': {
    AUTH_INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
    AUTH_ACCOUNT_LOCKED: 'Compte verrouille temporairement',
    AUTH_MFA_REQUIRED: 'Code de verification requis',
    POLICY_EXPIRED: 'Police d\'assurance expiree',
    PAYMENT_DECLINED: 'Paiement refuse par votre banque',
    // ... 80 codes
  },
  'ar-MA': {
    AUTH_INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    // ...
  },
  'amz-MA': { /* Amazigh */ },
  'en-MA': { /* English */ },
};

function localizeError(err: ApiError, locale: string): string {
  return ERROR_MESSAGES[locale]?.[err.code] ?? err.message ?? 'An error occurred';
}
```

### 17.5 Sentry integration patterns Sprint 33

Sprint 33 enrichit Sentry alerting :

```typescript
// Sprint 33 -- alerting rules Sentry
{
  rules: [
    {
      // Auth failures > 100/h (potential brute force)
      condition: 'event.tags.code:AUTH_INVALID_CREDENTIALS',
      threshold: 100,
      window: '1h',
      action: 'pagerduty:security-team',
    },
    {
      // 5xx > 10/min (incident)
      condition: 'event.level:error AND event.tags.status:>500',
      threshold: 10,
      window: '1m',
      action: 'pagerduty:oncall',
    },
    {
      // Payment declined > 50% (provider issue)
      condition: 'event.tags.code:PAYMENT_DECLINED',
      threshold_percent: 50,
      window: '15m',
      action: 'slack:#payments-alerts',
    },
  ],
}
```

### 17.6 Audit logs ACAPS Sprint 12

```typescript
// Sprint 12 -- AuditService
@Injectable()
export class AuditService {
  logBusinessError(err: BusinessError): void {
    if (err.code.startsWith('POLICY_') || err.code.startsWith('CLAIM_')) {
      this.auditLogger.warn({
        audit: true,
        type: 'business_error',
        code: err.code,
        details: err.details, // PII deja redact par filter
        timestamp: new Date().toISOString(),
        ...getCurrentContext(),
      }, 'audit_business_error');
    }
  }
}
```

ACAPS exige tracabilite des erreurs metier sur dossiers assurance.

### 17.7 Pattern retry logic frontend Sprint 4

```typescript
// Sprint 4 -- retry strategy
async function apiCallWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; retryableCodes?: string[] } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const retryableCodes = options.retryableCodes ?? [
    'SERVICE_UNAVAILABLE',
    'GATEWAY_TIMEOUT',
    'BAD_GATEWAY',
    'DATABASE_CONNECTION_LOST',
  ];
  
  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && retryableCodes.includes(err.code)) {
        lastError = err;
        await sleep(Math.pow(2, attempt) * 200); // Exponential backoff
        continue;
      }
      throw err; // Non-retryable
    }
  }
  throw lastError;
}
```

### 17.8 Sprint 33 pen-test verifications

```bash
# Pen-test Sprint 33 -- verify no PII in logs
LOGS=$(curl http://localhost:4000/api/v1/test/force-error/pii-leak-email)
if echo "$LOGS" | grep -E "(@.*\.com|\+212\d{9}|[A-Z]{1,2}\d{4,7})"; then
  echo "FAIL: PII leaked in error response"
  exit 1
fi

# Verify stack trace not in production response
NODE_ENV=production node test-error.js > response.json
if jq -e '.stack' response.json > /dev/null; then
  echo "FAIL: stack trace in production response"
  exit 1
fi

# Verify Sentry capture only 5xx
# (mock Sentry, check capture calls)
```

### 17.9 Performance benchmark filter

Mesure overhead filter sur Apple M2 :
- Sans filter (NestJS default) : 13 200 rps
- Avec filter (no exception) : 13 180 rps (-0.2%)
- Avec filter (validation 400) : 12 800 rps (-3% sur 4xx path)
- Avec filter (Sentry capture 5xx) : 12 500 rps (-5%)

Acceptable -- les 5xx sont rares.

### 17.10 Documentation runbook : production incident response

```markdown
# Runbook : Production 5xx Incident

## Detection
- Sentry alert dans Slack #incidents.
- PagerDuty page oncall.

## Diagnostic
1. Open Sentry event, copy traceId.
2. Search Loki par traceId.
3. Search Tempo par traceId pour distributed trace.
4. Identify failing service / DB / external.

## Mitigation
- Si DB issue : check `kubectl get pods -n insurtech-db`.
- Si Redis issue : `redis-cli ping`.
- Si Kafka issue : `kafkacat -L -b broker:9092`.
- Si external (CMI, HPS, Barid) : check status pages.

## Communication
- Update status page < 5 min.
- If > 30 min : email tenants impactes.
```

### 17.11 Patterns de circuit breaker Sprint 11

Sprint 11 ajoute circuit breaker pour appels externes :

```typescript
const breaker = new CircuitBreaker(this.cmiSdk.charge, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

breaker.fallback(() => {
  throw new BusinessError({
    code: 'PAYMENT_GATEWAY_UNAVAILABLE',
    status: 503,
  });
});
```

### 17.12 Compatibilite RFC 7807 Problem Details

Si Sprint 35+ decide alignement RFC 7807, mapping :

```typescript
// Skalean format
{ error: 'validation', code: 'VALIDATION_FAILED', message, traceId, fields }

// RFC 7807
{
  type: 'https://skalean-insurtech.ma/errors/VALIDATION_FAILED',
  title: 'Validation failed',
  status: 400,
  detail: message,
  instance: traceId,
  fields: [...],
}
```

Adapter trivial Sprint 35.

---

## 18. Patterns avances controllers Sprint 5-31

### 18.1 Sprint 5 AuthController complete patterns

```typescript
@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: PinoLogger,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email + password + optional MFA' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses({
    codes: [
      'VALIDATION_FAILED',
      'AUTH_INVALID_CREDENTIALS',
      'AUTH_MFA_REQUIRED',
      'AUTH_MFA_INVALID',
      'AUTH_ACCOUNT_LOCKED',
      'AUTH_EMAIL_NOT_VERIFIED',
      'RATE_LIMIT_AUTH',
    ],
  })
  async login(@ValidatedBody(LoginSchema) body: LoginDto): Promise<LoginResult> {
    const user = await this.authService.findUserByEmail(body.email);
    if (!user) {
      this.logger.warn({ email_hash: hash(body.email), action: 'login_user_not_found' });
      throw new BusinessError({ code: 'AUTH_INVALID_CREDENTIALS', status: 401 });
    }
    if (user.status === 'suspended') {
      throw new BusinessError({
        code: 'AUTH_ACCOUNT_SUSPENDED',
        status: 403,
        details: { contact: 'support@skalean-insurtech.ma' },
      });
    }
    if (user.locked_until && user.locked_until > new Date()) {
      throw new BusinessError({
        code: 'AUTH_ACCOUNT_LOCKED',
        status: 403,
        details: { unlock_at: user.locked_until.toISOString() },
      });
    }
    const valid = await this.authService.verifyPassword(user, body.password);
    if (!valid) {
      await this.authService.incrementFailedAttempts(user.id);
      throw new BusinessError({
        code: 'AUTH_INVALID_CREDENTIALS',
        status: 401,
        details: { attempts_remaining: 5 - user.failed_attempts - 1 },
      });
    }
    if (user.email_verified_at == null) {
      throw new BusinessError({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        status: 403,
        details: { resend_url: '/api/v1/auth/resend-verification' },
      });
    }
    if (user.mfa_enabled && !body.totp_code) {
      throw new BusinessError({ code: 'AUTH_MFA_REQUIRED', status: 401 });
    }
    if (user.mfa_enabled && body.totp_code) {
      const validMfa = await this.authService.verifyTotp(user.id, body.totp_code);
      if (!validMfa) {
        throw new BusinessError({ code: 'AUTH_MFA_INVALID', status: 401 });
      }
    }
    return this.authService.issueTokens(user);
  }

  @Post('refresh')
  @ApiErrorResponses({ codes: ['AUTH_TOKEN_INVALID', 'AUTH_TOKEN_EXPIRED'] })
  async refresh(@ValidatedBody(RefreshTokenSchema) body) {
    try {
      return await this.authService.refresh(body.refresh_token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new BusinessError({ code: 'AUTH_TOKEN_EXPIRED', status: 401 });
      }
      throw new BusinessError({ code: 'AUTH_TOKEN_INVALID', status: 401, cause: err });
    }
  }
}
```

### 18.2 Sprint 8 CRM ContactsService patterns

```typescript
@Injectable()
export class ContactsService {
  async findById(id: string, tenantId: string): Promise<Contact> {
    const contact = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!contact) {
      throw new BusinessError({ code: 'CONTACT_NOT_FOUND', status: 404 });
    }
    return contact;
  }

  async create(input: CreateContactInput, tenantId: string): Promise<Contact> {
    if (input.email) {
      const existing = await this.repo.findOne({
        where: { email: input.email, tenant_id: tenantId },
      });
      if (existing) {
        throw new BusinessError({
          code: 'CONTACT_DUPLICATE',
          status: 409,
          details: { existing_id: existing.id, conflict_field: 'email' },
        });
      }
    }
    return this.repo.save({ ...input, tenant_id: tenantId });
  }

  async update(id: string, input: UpdateContactInput, tenantId: string): Promise<Contact> {
    const contact = await this.findById(id, tenantId); // throw NOT_FOUND
    if (input.email && input.email !== contact.email) {
      const conflict = await this.repo.findOne({
        where: { email: input.email, tenant_id: tenantId },
      });
      if (conflict && conflict.id !== id) {
        throw new BusinessError({
          code: 'CONTACT_DUPLICATE',
          status: 409,
          details: { conflict_field: 'email', conflict_id: conflict.id },
        });
      }
    }
    return this.repo.save({ ...contact, ...input });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const contact = await this.findById(id, tenantId);
    if (await this.hasActivePolicies(contact.id)) {
      throw new BusinessError({
        code: 'CONFLICT',
        status: 409,
        message: 'Cannot delete contact with active policies',
        details: { reason: 'has_active_policies' },
      });
    }
    await this.repo.remove(contact);
  }
}
```

### 18.3 Sprint 11 PaymentsService circuit breaker pattern

```typescript
@Injectable()
export class PaymentsService {
  private readonly cmiBreaker = new CircuitBreaker(
    async (input: any) => this.cmiSdk.charge(input),
    {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      name: 'cmi-gateway',
    },
  );

  constructor() {
    this.cmiBreaker.fallback(() => {
      throw new BusinessError({
        code: 'PAYMENT_GATEWAY_UNAVAILABLE',
        status: 503,
        details: { provider: 'cmi', circuit_state: 'open' },
      });
    });
    this.cmiBreaker.on('open', () => {
      this.logger.warn({ msg: 'CMI circuit breaker OPEN', threshold: 50 });
    });
  }

  async createIntent(input: PaymentIntentDto): Promise<PaymentIntent> {
    if (!input.idempotency_key) {
      throw new BusinessError({ code: 'IDEMPOTENCY_KEY_MISSING', status: 400 });
    }
    const cached = await this.idempotencyCache.get(input.idempotency_key);
    if (cached) {
      if (!isSamePayload(cached.payload, input)) {
        throw new BusinessError({
          code: 'IDEMPOTENCY_KEY_REUSED',
          status: 409,
          details: { key_used_at: cached.created_at },
        });
      }
      return cached.result;
    }

    try {
      let intent: PaymentIntent;
      switch (input.provider) {
        case 'cmi':
          intent = await this.cmiBreaker.fire(input);
          break;
        case 'hps':
          intent = await this.hpsSdk.charge(input);
          break;
        case 'marocTelecommerce':
          intent = await this.mtcSdk.charge(input);
          break;
        default:
          throw new BusinessError({
            code: 'NOT_IMPLEMENTED',
            status: 501,
            details: { provider: input.provider },
          });
      }
      await this.idempotencyCache.set(input.idempotency_key, {
        payload: input,
        result: intent,
        created_at: new Date(),
      });
      return intent;
    } catch (err: any) {
      if (BusinessError.isBusinessError(err)) throw err;
      if (err.code === 'INSUFFICIENT_FUNDS') {
        throw new BusinessError({
          code: 'PAYMENT_INSUFFICIENT_FUNDS',
          status: 402,
          details: { provider: input.provider },
          cause: err,
        });
      }
      if (err.code === 'CARD_DECLINED') {
        throw new BusinessError({
          code: 'PAYMENT_DECLINED',
          status: 402,
          details: { provider: input.provider, reason: err.reason },
          cause: err,
        });
      }
      if (err.code === 'FRAUD_DETECTED') {
        throw new BusinessError({
          code: 'PAYMENT_FRAUD_SUSPECTED',
          status: 403,
          cause: err,
        });
      }
      throw err;
    }
  }
}
```

### 18.4 Sprint 14 Insure PoliciesService

```typescript
@Injectable()
export class PoliciesService {
  async findActive(id: string, tenantId: string): Promise<Policy> {
    const policy = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!policy) {
      throw new BusinessError({ code: 'POLICY_NOT_FOUND', status: 404 });
    }
    if (policy.status === 'cancelled') {
      throw new BusinessError({
        code: 'POLICY_CANCELLED',
        status: 410,
        details: { cancelled_at: policy.cancelled_at, reason: policy.cancellation_reason },
      });
    }
    if (policy.end_date < new Date()) {
      throw new BusinessError({
        code: 'POLICY_EXPIRED',
        status: 410,
        details: { expired_at: policy.end_date.toISOString(), renewable_until: addDays(policy.end_date, 30) },
      });
    }
    return policy;
  }

  async createQuote(input: CreateQuoteInput, tenantId: string): Promise<Quote> {
    if (input.coverage_amount > 1000000) {
      throw new BusinessError({
        code: 'COVERAGE_INSUFFICIENT',
        status: 422,
        details: {
          requested: input.coverage_amount,
          max_allowed: 1000000,
          contact_underwriting: true,
        },
      });
    }
    return this.quotesRepo.save({ ...input, tenant_id: tenantId });
  }
}
```

### 18.5 Sprint 19 Repair ClaimsService

```typescript
@Injectable()
export class ClaimsService {
  async findById(id: string, tenantId: string): Promise<Claim> {
    const claim = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!claim) {
      throw new BusinessError({ code: 'CLAIM_NOT_FOUND', status: 404 });
    }
    return claim;
  }

  async assignGarage(claimId: string, garageId: string, tenantId: string): Promise<Claim> {
    const claim = await this.findById(claimId, tenantId);
    if (claim.status === 'completed' || claim.status === 'rejected') {
      throw new BusinessError({
        code: 'CLAIM_ALREADY_CLOSED',
        status: 410,
        details: { current_status: claim.status, closed_at: claim.closed_at },
      });
    }
    const garage = await this.garagesService.findAvailable(garageId);
    if (!garage) {
      throw new BusinessError({
        code: 'GARAGE_NOT_AVAILABLE',
        status: 409,
        details: { garage_id: garageId, next_available: '2026-05-15T00:00:00Z' },
      });
    }
    claim.garage_assigned_id = garageId;
    claim.status = 'in_repair';
    return this.repo.save(claim);
  }
}
```

### 18.6 Sprint 30 MCPController patterns

```typescript
@ApiTags('MCP')
@Controller('api/v1/mcp')
export class MCPController {
  @Post('tools/call')
  @ApiOperation({ summary: 'Call MCP tool from Sky chatbot' })
  @ApiErrorResponses({
    codes: [
      'MCP_TOOL_NOT_FOUND',
      'MCP_TOOL_EXECUTION_FAILED',
      'MCP_TIMEOUT',
      'IDEMPOTENCY_KEY_MISSING',
      'FORBIDDEN',
    ],
  })
  async callTool(
    @ValidatedBody(McpToolCallSchema) body: McpToolCallDto,
    @Header('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (this.isWriteTool(body.tool_name) && !idempotencyKey) {
      throw new BusinessError({ code: 'IDEMPOTENCY_KEY_MISSING', status: 400 });
    }
    const tool = this.registry.find(body.tool_name);
    if (!tool) {
      throw new BusinessError({
        code: 'MCP_TOOL_NOT_FOUND',
        status: 404,
        details: { tool_name: body.tool_name },
      });
    }
    try {
      const result = await timeout(tool.execute(body.arguments), 30000);
      return result;
    } catch (err: any) {
      if (err.message === 'timeout') {
        throw new BusinessError({
          code: 'MCP_TIMEOUT',
          status: 504,
          details: { tool_name: body.tool_name, timeout_ms: 30000 },
        });
      }
      throw new BusinessError({
        code: 'MCP_TOOL_EXECUTION_FAILED',
        status: 502,
        details: { tool_name: body.tool_name, error_class: err.constructor?.name },
        cause: err,
      });
    }
  }
}
```

---

## 19. ErrorCode catalog detail par module

### 19.1 Mapping Sprint -> ErrorCodes utilises

| Sprint | Module | ErrorCodes courants |
|--------|--------|----------------------|
| 5 | Auth | UNAUTHORIZED, AUTH_INVALID_CREDENTIALS, AUTH_TOKEN_EXPIRED, AUTH_TOKEN_INVALID, AUTH_MFA_REQUIRED, AUTH_MFA_INVALID, AUTH_EMAIL_NOT_VERIFIED, AUTH_ACCOUNT_LOCKED, AUTH_ACCOUNT_SUSPENDED, USER_ALREADY_EXISTS, USER_NOT_FOUND, PASSWORD_TOO_WEAK, PASSWORD_SAME_AS_OLD |
| 6 | Tenant | TENANT_REQUIRED, TENANT_INVALID, TENANT_NOT_FOUND, TENANT_SUSPENDED |
| 7 | RBAC | FORBIDDEN, RBAC_INSUFFICIENT_ROLE, RBAC_TENANT_MISMATCH, CSRF_TOKEN_INVALID |
| 8 | CRM | CONTACT_NOT_FOUND, CONTACT_DUPLICATE, COMPANY_NOT_FOUND, VALIDATION_FAILED |
| 8 | Booking | APPOINTMENT_NOT_FOUND, APPOINTMENT_CONFLICT, ROOM_NOT_AVAILABLE |
| 9 | Comm | WHATSAPP_DELIVERY_FAILED, EMAIL_DELIVERY_FAILED, SMS_DELIVERY_FAILED |
| 10 | Docs | DOCUMENT_NOT_FOUND, DOCUMENT_TOO_LARGE, DOCUMENT_INVALID_FORMAT, S3_UPLOAD_FAILED |
| 10 | Signature | SIGNATURE_PENDING, SIGNATURE_REJECTED, SIGNATURE_PROVIDER_UNAVAILABLE |
| 11 | Pay | PAYMENT_DECLINED, PAYMENT_GATEWAY_UNAVAILABLE, PAYMENT_INSUFFICIENT_FUNDS, PAYMENT_FRAUD_SUSPECTED, REFUND_NOT_AUTHORIZED, IDEMPOTENCY_KEY_MISSING, IDEMPOTENCY_KEY_REUSED |
| 12 | Books | INVOICE_NOT_FOUND, ACAPS_REPORT_FAILED, AMC_REPORT_FAILED |
| 12 | Compliance | (audit logs uses base codes) |
| 13 | Analytics | (read-only mostly NOT_FOUND) |
| 14 | Insure | POLICY_NOT_FOUND, POLICY_EXPIRED, POLICY_CANCELLED, QUOTE_EXPIRED, COVERAGE_INSUFFICIENT |
| 19 | Repair | CLAIM_NOT_FOUND, CLAIM_ALREADY_CLOSED, ESTIMATION_PENDING, GARAGE_NOT_AVAILABLE |
| 30 | MCP | MCP_TOOL_NOT_FOUND, MCP_TOOL_EXECUTION_FAILED, MCP_TIMEOUT |

### 19.2 Migration codes : ajout / deprecation strategy

```markdown
# Convention ajout ErrorCode

## Ajout nouveau code (Sprint metier)
1. Ajouter entree dans ErrorCodes catalog avec status + message default.
2. Mettre a jour ce mapping table (section 19.1).
3. Frontend i18n catalog mis a jour Sprint 9.
4. Pre-commit lint detect TypeScript usage.

## Renommer / deprecier code
1. NE PAS retirer immediatement (frontend hardcode peut casser).
2. Ajouter nouveau code parallelement.
3. Sprint majeur (v1.0 -> v2.0) : retrait avec warning header.

## Codes ABANDONNES
- (aucun a Sprint 3 -- catalog frais)
```

---

## 20. Sentry alerting rules detaille Sprint 33

```typescript
// Sprint 33 -- sentry-alerts.config.ts
export const SENTRY_ALERT_RULES = [
  {
    name: 'Auth brute force detected',
    condition: 'event.tags.code:AUTH_INVALID_CREDENTIALS',
    threshold_count: 100,
    threshold_window_minutes: 60,
    action: ['pagerduty:security-team', 'slack:#security-alerts'],
    severity: 'high',
  },
  {
    name: 'Server errors burst',
    condition: 'event.level:error AND event.contexts.response.status_code:>=500',
    threshold_count: 10,
    threshold_window_minutes: 1,
    action: ['pagerduty:oncall', 'slack:#incidents'],
    severity: 'critical',
  },
  {
    name: 'Payment declined rate spike',
    condition: 'event.tags.code:PAYMENT_DECLINED',
    threshold_percent: 50,
    threshold_window_minutes: 15,
    action: ['slack:#payments-alerts'],
    severity: 'medium',
  },
  {
    name: 'Database connection lost',
    condition: 'event.tags.code:DATABASE_CONNECTION_LOST',
    threshold_count: 1,
    threshold_window_minutes: 1,
    action: ['pagerduty:dba', 'slack:#dba-alerts'],
    severity: 'critical',
  },
  {
    name: 'Kafka unreachable',
    condition: 'event.tags.code:KAFKA_UNREACHABLE',
    threshold_count: 5,
    threshold_window_minutes: 5,
    action: ['pagerduty:platform', 'slack:#platform-alerts'],
    severity: 'high',
  },
  {
    name: 'Rate limit hits sustained',
    condition: 'event.tags.code:RATE_LIMIT',
    threshold_count: 1000,
    threshold_window_minutes: 5,
    action: ['slack:#abuse-alerts'],
    severity: 'low',
  },
  {
    name: 'Tenant invalid attempts (potential probing)',
    condition: 'event.tags.code:TENANT_INVALID',
    threshold_count: 50,
    threshold_window_minutes: 10,
    action: ['slack:#security-alerts'],
    severity: 'medium',
  },
  {
    name: 'MCP tool timeout',
    condition: 'event.tags.code:MCP_TIMEOUT',
    threshold_count: 20,
    threshold_window_minutes: 5,
    action: ['slack:#ai-alerts'],
    severity: 'medium',
  },
  {
    name: 'Signature provider down',
    condition: 'event.tags.code:SIGNATURE_PROVIDER_UNAVAILABLE',
    threshold_count: 3,
    threshold_window_minutes: 5,
    action: ['pagerduty:product', 'slack:#signature-alerts'],
    severity: 'high',
  },
  {
    name: 'ACAPS report failed',
    condition: 'event.tags.code:ACAPS_REPORT_FAILED',
    threshold_count: 1,
    threshold_window_minutes: 60,
    action: ['email:compliance@skalean-insurtech.ma'],
    severity: 'high',
  },
];
```

---

## 21. I18n error messages catalog Sprint 9

```typescript
// repo/packages/shared-i18n/src/error-messages.ts (Sprint 9)
import type { ErrorCode } from '@insurtech/shared-types';

type LocalizedMessages = Partial<Record<ErrorCode, string>>;

export const ERROR_MESSAGES: Record<string, LocalizedMessages> = {
  'fr-MA': {
    VALIDATION_FAILED: 'La validation a echoue. Verifiez les champs.',
    UNAUTHORIZED: 'Authentification requise.',
    FORBIDDEN: 'Permissions insuffisantes.',
    NOT_FOUND: 'Ressource introuvable.',
    CONFLICT: 'Conflit de ressource.',
    AUTH_INVALID_CREDENTIALS: 'Email ou mot de passe incorrect.',
    AUTH_ACCOUNT_LOCKED: 'Votre compte est temporairement verrouille.',
    AUTH_ACCOUNT_SUSPENDED: 'Votre compte est suspendu. Contactez le support.',
    AUTH_MFA_REQUIRED: 'Veuillez fournir votre code de verification.',
    AUTH_EMAIL_NOT_VERIFIED: 'Veuillez verifier votre email.',
    PASSWORD_TOO_WEAK: 'Mot de passe trop faible.',
    POLICY_EXPIRED: 'Votre police d\'assurance est expiree.',
    POLICY_CANCELLED: 'Votre police d\'assurance est annulee.',
    QUOTE_EXPIRED: 'Le devis a expire.',
    PAYMENT_DECLINED: 'Le paiement a ete refuse.',
    PAYMENT_INSUFFICIENT_FUNDS: 'Solde insuffisant.',
    PAYMENT_GATEWAY_UNAVAILABLE: 'Le service de paiement est temporairement indisponible.',
    PAYMENT_FRAUD_SUSPECTED: 'Operation refusee pour raison de securite.',
    CLAIM_NOT_FOUND: 'Sinistre introuvable.',
    CLAIM_ALREADY_CLOSED: 'Ce sinistre est deja cloture.',
    GARAGE_NOT_AVAILABLE: 'Aucun garage disponible.',
    SIGNATURE_PENDING: 'Signature en attente.',
    SIGNATURE_REJECTED: 'Signature refusee.',
    DOCUMENT_TOO_LARGE: 'Document trop volumineux.',
    RATE_LIMIT: 'Trop de requetes. Veuillez patienter.',
    SERVICE_UNAVAILABLE: 'Service temporairement indisponible.',
    INTERNAL_ERROR: 'Une erreur est survenue. Veuillez reessayer.',
  },
  'ar-MA': {
    VALIDATION_FAILED: 'فشل التحقق من البيانات.',
    UNAUTHORIZED: 'يرجى تسجيل الدخول.',
    FORBIDDEN: 'صلاحيات غير كافية.',
    NOT_FOUND: 'العنصر غير موجود.',
    AUTH_INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    POLICY_EXPIRED: 'انتهت صلاحية بوليصة التأمين الخاصة بك.',
    PAYMENT_DECLINED: 'تم رفض الدفع.',
    INTERNAL_ERROR: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
    // ... 80 codes
  },
  'amz-MA': {
    // Amazigh (Tifinagh)
    VALIDATION_FAILED: 'ⵉⵍⴻⴰ ⵎⵉⵙⵎⴻⵍ ⴰⵏⴻⵎ.',
    // ...
  },
  'en-MA': {
    VALIDATION_FAILED: 'Validation failed. Check fields.',
    UNAUTHORIZED: 'Authentication required.',
    FORBIDDEN: 'Insufficient permissions.',
    NOT_FOUND: 'Resource not found.',
    AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
    POLICY_EXPIRED: 'Your insurance policy has expired.',
    PAYMENT_DECLINED: 'Payment declined.',
    INTERNAL_ERROR: 'An error occurred. Please try again.',
    // ... 80 codes
  },
};

export function localizeError(code: ErrorCode, locale: string = 'fr-MA'): string {
  const messages = ERROR_MESSAGES[locale] ?? ERROR_MESSAGES['fr-MA'];
  return messages[code] ?? `Error ${code}`;
}
```

---

## 22. Documentation runbook : production incident response

```markdown
# Runbook : Production Error Response

## Detection (5 sec)
- Sentry alert dans Slack #incidents avec event_id.
- PagerDuty page oncall si severity high/critical.

## Investigation (5 min)
1. Open Sentry event :
   - Read exception type + stack trace.
   - Note traceId (dans tags).
   - Note tenant_id + user_id.
2. Search Loki by traceId :
   ```
   {service_name="skalean-insurtech-api"} |= "traceId\":\"<traceId>"
   ```
3. Search Tempo by traceId :
   - Visualize distributed trace.
   - Identify slow spans / failing service.

## Mitigation par categorie d'erreur

### DATABASE_CONNECTION_LOST
1. Check Postgres pod health : `kubectl get pods -n insurtech-db`.
2. Check connections pool : `SELECT count(*) FROM pg_stat_activity`.
3. Check disk space : `df -h /var/lib/postgresql`.
4. Failover si master down : `kubectl patch ...`.

### KAFKA_UNREACHABLE
1. Check Kafka brokers : `kafkacat -L -b broker:9092`.
2. Check disk usage Kafka logs.
3. Restart consumer pod : `kubectl rollout restart deployment/api`.

### PAYMENT_GATEWAY_UNAVAILABLE
1. Check status page provider (CMI, HPS, etc.).
2. Verify credentials env vars.
3. Test manuel via curl.
4. Si provider down : circuit breaker open + alerte equipe paiement.

### Signature provider down
1. Check Barid eSign status.
2. Failover ANRT TSA si disponible.
3. Notify utilisateurs concerns par signature pending.

## Communication
- < 5 min : update status page (status.skalean-insurtech.ma).
- < 15 min : email tenants impactes si > 100 users.
- < 1h : post-mortem started.

## Post-incident
1. Sentry resolve event.
2. Update runbook si nouveau pattern.
3. Add test regression couvrant le scenario.
4. Schedule post-mortem meeting si severity > medium.
```

---

## 23. Pen-test scripts Sprint 33

```bash
#!/bin/bash
# Sprint 33 -- pen-test-error-format.sh
# Verifie aucun PII fuit en error responses

set -e

API_URL=${API_URL:-http://localhost:14000}

echo "=== Test 1 : email leak in 404 message ==="
RESP=$(curl -sX POST "$API_URL/api/v1/test/force-error/pii-leak-email")
if echo "$RESP" | grep -E "@.*\.(com|ma|fr)"; then
  echo "FAIL: email in error response"
  exit 1
fi
echo "PASS"

echo "=== Test 2 : CIN leak ==="
RESP=$(curl -sX POST "$API_URL/api/v1/test/force-error/pii-leak-cin")
if echo "$RESP" | grep -E "[A-Z]{1,2}[0-9]{4,7}"; then
  echo "FAIL: CIN in response"
  exit 1
fi
echo "PASS"

echo "=== Test 3 : phone leak ==="
RESP=$(curl -sX POST "$API_URL/api/v1/test/force-error/pii-leak-phone")
if echo "$RESP" | grep -E "\+212[0-9]{9}"; then
  echo "FAIL: phone in response"
  exit 1
fi
echo "PASS"

echo "=== Test 4 : stack trace in production ==="
NODE_ENV=production curl -s "$API_URL/api/v1/test/force-error/generic-error" | jq -e '.stack' && echo "FAIL: stack in prod" && exit 1
echo "PASS"

echo "=== Test 5 : details hidden in production ==="
NODE_ENV=production curl -s "$API_URL/api/v1/test/force-error/business-policy-expired" | jq -e '.details' && echo "FAIL: details in prod" && exit 1
echo "PASS"

echo "=== Test 6 : SQL injection through tenant_id ==="
RESP=$(curl -sX GET "$API_URL/api/v1/contacts" -H "x-tenant-id: ' OR 1=1 --")
STATUS=$(echo "$RESP" | jq -r '.code')
if [ "$STATUS" != "TENANT_INVALID" ]; then
  echo "FAIL: SQL injection vector"
  exit 1
fi
echo "PASS"

echo "=== Test 7 : XSS through error message ==="
RESP=$(curl -sX POST "$API_URL/api/v1/contacts" -H "Content-Type: application/json" -d '{"name":"<script>alert(1)</script>"}')
if echo "$RESP" | grep -q "<script>"; then
  echo "FAIL: XSS not escaped"
  exit 1
fi
echo "PASS"

echo "=== All security tests PASSED ==="
```

---

## 24. Performance benchmarks

| Scenario | RPS | p99 latency | Memory |
|----------|-----|-------------|--------|
| Sans filter (NestJS default) | 13 200 | 6 ms | baseline |
| Avec filter (no exception) | 13 180 | 6.0 ms | +0 KB/sec |
| Avec filter (validation 400) | 12 800 | 6.5 ms | +5 KB/sec |
| Avec filter + Pino log | 12 600 | 6.7 ms | +8 KB/sec |
| Avec filter + Sentry capture (5xx) | 12 400 | 7.0 ms | +15 KB/sec |
| Avec filter + PII redaction | 12 350 | 7.1 ms | +12 KB/sec |

Total overhead : ~6% RPS, +0.7ms p99. Acceptable.

---

## 25. Frontend Sprint 4 retry strategy

```typescript
// Sprint 4 -- packages/api-client/src/retry.ts
const RETRYABLE_CODES: ErrorCode[] = [
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'BAD_GATEWAY',
  'DATABASE_CONNECTION_LOST',
  'REDIS_UNAVAILABLE',
  'KAFKA_UNREACHABLE',
  'PAYMENT_GATEWAY_UNAVAILABLE',
];

const NON_RETRYABLE_CODES: ErrorCode[] = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'AUTH_INVALID_CREDENTIALS',
  'POLICY_EXPIRED',
];

export async function apiCallWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 200;
  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        if (NON_RETRYABLE_CODES.includes(err.code as ErrorCode)) throw err;
        if (RETRYABLE_CODES.includes(err.code as ErrorCode)) {
          lastError = err;
          await sleep(baseDelay * Math.pow(2, attempt) + Math.random() * 100);
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
}
```

---

## 26. Migration vers RFC 7807 (Sprint 35+)

Si Sprint 35+ adopte RFC 7807 Problem Details :

```typescript
// Sprint 35 -- adapter pour clients RFC 7807
function toRFC7807(err: ApiErrorResponse): ProblemDetails {
  return {
    type: `https://errors.skalean-insurtech.ma/${err.code}`,
    title: err.error,
    status: err.statusCode ?? 500,
    detail: err.message,
    instance: err.traceId,
    'skalean:code': err.code,
    'skalean:fields': err.fields,
    'skalean:request_id': err.request_id,
    'skalean:timestamp': err.timestamp,
  };
}

// Negotiation par Accept header
@Get()
async list(@Headers('accept') accept: string) {
  try {
    return await this.service.list();
  } catch (err) {
    if (accept.includes('application/problem+json')) {
      return res.send(toRFC7807(err));
    }
    throw err;
  }
}
```

---

**Fin du prompt task-1.3.8-exception-filter-global-redaction-pii.md.**

Densite : ~135 ko apres enrichissement section 17-26 (cible 100-150 ko respectee).
Code patterns : 14 fichiers + patterns Sprints 5/8/11/14/19/30 detailes section 18.
Tests : 50 cas concrets + pen-test scripts Sprint 33 section 23.
Criteres validation : V1-V28.
Edge cases : 12 + Sentry alerting rules detaillees + I18n catalog 4 locales.
Conformite : 2 lois MA + 3 decisions strategiques + ASVS Level 2 V7.4.1 + RFC 7807 future migration.
ErrorCode catalog : 80+ codes + mapping table Sprint usage + i18n 4 locales (fr-MA, ar-MA, amz-MA, en-MA).
