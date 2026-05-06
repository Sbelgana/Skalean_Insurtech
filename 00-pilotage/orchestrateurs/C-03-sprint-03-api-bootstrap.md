# ORCHESTRATEUR SPRINT 3 -- Phase 1 / Sprint 3 : API Bootstrap NestJS
# 15 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 3 / 35 (cumul) -- Sprint 3 dans Phase 1
**Reference meta-prompt** : `B-03-sprint-03-api-bootstrap.md`
**Reference verification** : `V-03-sprint-03-verification.md`
**Numerotation taches** : 1.3.1 a 1.3.15
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : API NestJS production-ready + Swagger auto-generated

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 15 taches** du Sprint 3 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-03** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-03 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 3

Sprint 3 (1.3) -- API Bootstrap NestJS. Voir B-03-sprint-03-api-bootstrap.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/
  task-1.3.1-prompt.md       # NestJS 10.4 + Fastify Adapter Setup
  task-1.3.2-prompt.md       # AppModule + ConfigModule + Structure Modulaire
  task-1.3.3-prompt.md       # Pino Logger Integration via nestjs-pino
  task-1.3.4-prompt.md       # OpenTelemetry Traces + RequestContextMiddleware
  task-1.3.5-prompt.md       # Helmet + CORS Strict + Compression + Body Limit
  task-1.3.6-prompt.md       # ZodValidationPipe Global
  task-1.3.7-prompt.md       # ResponseInterceptor : Format API Standardise
  task-1.3.8-prompt.md       # ExceptionFilter Global : Erreurs Structurees + Redaction PII
  task-1.3.9-prompt.md       # Swagger OpenAPI 3.0 Setup
  task-1.3.10-prompt.md       # HealthModule : /healthz et /readyz
  task-1.3.11-prompt.md       # BullMQ Integration : JobsModule
  task-1.3.12-prompt.md       # Sentry Integration
  task-1.3.13-prompt.md       # Rate Limiting Global : @nestjs/throttler + Redis
  task-1.3.14-prompt.md       # PublicEndpointGuard + @Public() Decorator
  task-1.3.15-prompt.md       # Tests E2E Bootstrap : Smoke Tests + Healthcheck + 404/500
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-03-sprint-03-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/001-010-*.md`

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run` -- tous tests PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Commit** Conventional Commits (`git add -A && git commit`)
7. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : les taches ont des **dependances** entre elles. La tache N peut importer du code cree par la tache N-1. Executer en parallele creerait des conflits irreconciliables.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier -- continue les taches restantes
4. La verification finale V-03 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 15 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-03-sprint-03-verification.md
```
Puis tu **executes CHAQUE section** du fichier de verification (commandes bash + checks automatiques).

---

## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)

### Conventions techniques

- **Multi-tenant** : CHAQUE query DB filtre par `tenant_id` automatique (Subscriber + RLS) + header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*`
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka sur `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a un fichier `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, **AUCUN `any` implicite**, `noUncheckedIndexedAccess: true`
- **Hash password** : argon2id (JAMAIS bcrypt, JAMAIS scrypt)
- **JWT** : RS256 + key rotation 90 jours
- **Encryption at rest** : AES-256-GCM (Atlas Cloud Services KMS)
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages
- **Skalean AI** : utilise UNIQUEMENT via `@insurtech/sky` ou MCP client (JAMAIS de duplication LLM/RAG/vector store)
- **AUCUNE EMOJI** dans le code, commentaires ou logs (decision-006 ABSOLUE)
- **Idempotency-Key** : header obligatoire pour mutations + tools MCP write
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite InsurTech Maroc (9 lois MA)

- **Audit ACAPS** : chaque ecriture sur `insure_*`, `repair_*`, `pay_*` declenche entree dans `compliance_acaps_audits` (10 ans retention)
- **Donnees Maroc** (loi 09-08 CNDP) : aucune donnee assure/police/sinistre/paiement ne transite hors **Atlas Cloud Services Benguerir** (decision-008 -- DC1 Tier III + DC2 Tier IV)
- **Multilinguisme** : toute communication assure (notifications/emails/WhatsApp/Sky) supporte fr/ar-MA (darija)/ar (classique)/en
- **Conformite loi 43-20** : signatures electroniques utilisent uniquement `@insurtech/signature` (Barid eSign + ANRT TSA RFC 3161 + archivage 10 ans)
- **Conformite loi 17-99 article 9** : droit retract 30j B2C tracable (Sprint 15 cancellation_legal_basis)
- **Conformite loi 9-88** : ecritures comptables CGNC plan + SAFT-MA export DGI
- **Conformite loi 43-05** : AML monitoring + SAR generation AMC
- **TVA MA** : 5 taux (0/7/10/14/20%) -- Sprint 12
- **CNSS** : 4.48% + **AMO** : 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- **Notification breach** : sous 72h CNDP + Atlas Cloud Services SOC

---

## CONTEXTE PHASE 1 -- Bootstrap Infrastructure

### Position du Sprint 3 dans la Phase 1

Sprint 3 (1.3) -- **API Bootstrap NestJS**.

Voir `B-03-sprint-03-api-bootstrap.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

### Apport metier de ce sprint

API NestJS production-ready + Swagger auto-generated

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-03 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 15 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-03, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-03.

---

### Tache 1 / 15 : NestJS 10.4 + Fastify Adapter Setup

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 2

**But** : Initialiser l'application NestJS avec Fastify adapter (perf 30% > Express), configuration boot complete, et `main.ts` orchestrant tous les transverses.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.1-prompt.md
```

**Actions principales attendues** :
- `repo/apps/api/package.json` enrichi avec deps NestJS 10.4 + Fastify
- `repo/apps/api/tsconfig.json` avec `experimentalDecorators: true` + `emitDecoratorMetadata: true`
- `repo/apps/api/nest-cli.json` configurant build NestJS
- `repo/apps/api/src/main.ts` complet : initialise telemetry FIRST, cree app NestJS Fastify, applique middlewares globaux dans ordre correct, demarre serveur sur port 4000
- `repo/apps/api/src/app.module.ts` skeleton (peuple Tache 1.3.2)
- `repo/apps/api/src/app.controller.ts` minimal (root endpoint `GET /` retourne `{ name, version, env }`)

**Fichiers cibles principaux** :
  - `repo/apps/api/package.json`
  - `repo/apps/api/tsconfig.json`
  - `repo/apps/api/nest-cli.json`
  - `repo/apps/api/src/main.ts`
  - `repo/apps/api/src/app.module.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm --filter @insurtech/api dev` reussit
  - V2 (P0) : App demarre en < 5s
  - V3 (P0) : `curl http://localhost:4000/` retourne JSON valide

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): nestjs 10.4 + fastify adapter setup

Task: 1.3.1
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.1"
```

---

### Tache 2 / 15 : AppModule + ConfigModule + Structure Modulaire

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.1

**But** : Definir la structure modulaire de l'API : AppModule racine + ConfigModule global + DatabaseModule + 14 modules metier stubs (peuples Sprints suivants).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.2-prompt.md
```

**Actions principales attendues** :
- `repo/apps/api/src/app.module.ts` import des modules transverses globaux + modules metier
- `repo/apps/api/src/config/config.module.ts` -- wraps `@insurtech/shared-config` en NestJS Module
- `repo/apps/api/src/config/config.module.ts` Global module (annotation `@Global()`)
- `repo/apps/api/src/database/database.module.ts` -- import TypeORM AppDataSource
- Modules metier stubs (empty `@Module({})` placeholder) :
- AppModule importe : ConfigModule (global), DatabaseModule (global), HealthModule (Tache 1.3.10), JobsModule (Tache 1.3.11), tous modules metier stubs

**Fichiers cibles principaux** :
  - `repo/apps/api/src/app.module.ts`
  - `repo/apps/api/src/config/config.module.ts`
  - `repo/apps/api/src/config/config.service.ts`
  - `repo/apps/api/src/database/database.module.ts`
  - `repo/apps/api/src/modules/{19 dossiers}/X.module.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm --filter @insurtech/api build` compile sans erreur
  - V2 (P0) : `pnpm --filter @insurtech/api dev` demarre, AppModule charge tous les sub-modules
  - V3 (P0) : ConfigService injectable depuis n'importe quel service NestJS

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): appmodule + configmodule + structure modulaire

Task: 1.3.2
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.2"
```

---

### Tache 3 / 15 : Pino Logger Integration via nestjs-pino

**Metadonnees** : P0 | 3h | Depend de : Depend de 1.3.2

**But** : Remplacer le logger NestJS par defaut par Pino (de Sprint 1) pour avoir logs structures + PII redaction unifie sur toute l'API.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.3-prompt.md
```

**Actions principales attendues** :
- Import `nestjs-pino` dans AppModule via `LoggerModule.forRoot({...})`
- Configuration Pino reutilise instance `logger` de `@insurtech/shared-utils/logger`
- Logger NestJS replace : `app.useLogger(app.get(Logger))`
- Auto-log requests : methode, url, status, duration, traceId, userAgent
- PII redaction active (deja Sprint 1) : password, cin, phone, email, tokens
- Custom log level mapping : debug = `log()`, error = `error()`, warn = `warn()`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/app.module.ts`
  - `repo/apps/api/src/main.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Logs au format JSON structured (parse-able par jq)
  - V2 (P0) : Chaque request HTTP logge avec method/url/status/duration
  - V3 (P0) : PII redaction active (test : header `Authorization: Bearer XYZ` pas log en plain text)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): pino logger integration via nestjs-pino

Task: 1.3.3
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.3"
```

---

### Tache 4 / 15 : OpenTelemetry Traces + RequestContextMiddleware

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.3.3

**But** : Capturer toutes les requests HTTP en spans OpenTelemetry et propager un contexte request via AsyncLocalStorage (utilise Sprint 6 pour tenant_id).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.4-prompt.md
```

**Actions principales attendues** :
- `repo/apps/api/src/common/context/request-context.ts` -- AsyncLocalStorage avec interface RequestContext
- `repo/apps/api/src/common/middleware/request-context.middleware.ts` -- middleware NestJS qui :
- Helpers `getRequestContext()`, `getCurrentTenantId()`, `getCurrentUserId()`, `getTraceId()`
- Header response `x-trace-id` injecte sur toutes responses
- Span attribute `tenant.id` + `user.id` ajoutes a la span courante
- Middleware applique sur ALL routes via `consumer.apply(...).forRoutes('*')`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/context/request-context.ts`
  - `repo/apps/api/src/common/middleware/request-context.middleware.ts`
  - `repo/apps/api/src/app.module.ts`
  - `repo/apps/api/src/common/context/request-context.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Middleware installe, applique sur ALL routes
  - V2 (P0) : `getRequestContext()` retourne contexte dans services downstream
  - V3 (P0) : Header `x-trace-id` injecte sur response

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): opentelemetry traces + requestcontextmiddleware

Task: 1.3.4
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.4"
```

---

### Tache 5 / 15 : Helmet + CORS Strict + Compression + Body Limit

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.4

**But** : Appliquer les middlewares securite et performance globaux : Helmet (security headers), CORS strict (8 origins par environnement), compression Brotli/gzip, body limit 10MB.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.5-prompt.md
```

**Actions principales attendues** :
- Helmet via `@fastify/helmet` configure avec CSP strict
- CSP : `default-src 'self'`, scripts limites, frame-ancestors none
- CORS strict configure depuis env `CORS_ORIGINS` (CSV liste origins autorises)
- CORS methods : GET, POST, PUT, PATCH, DELETE, OPTIONS
- CORS headers : `Authorization`, `Content-Type`, `x-tenant-id`, `x-trace-id`, `x-correlation-id`
- CORS credentials : true (pour cookies session si applicable Sprint 5)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/main.ts`
  - `repo/apps/api/src/common/security/cors.config.ts`
  - `repo/apps/api/src/common/security/helmet.config.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Helmet headers presents : `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` (prod)
  - V2 (P0) : CORS allowlist actif : origin non-autorise rejete (HTTP 403 ou pas de Access-Control-* headers)
  - V3 (P0) : OPTIONS preflight retourne 204 avec CORS headers

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): helmet + cors strict + compression + body limit

Task: 1.3.5
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.5"
```

---

### Tache 6 / 15 : ZodValidationPipe Global

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.5

**But** : Remplacer `class-validator` (defaut NestJS) par `Zod` pour coherence avec `shared-events` schemas et `shared-config` env loader.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.6-prompt.md
```

**Actions principales attendues** :
- Installation `nestjs-zod` package
- `repo/apps/api/src/common/pipes/zod-validation.pipe.ts` -- pipe NestJS qui parse body/query/params via Zod
- Decorator `@UseZodGuard()` ou pattern controllers utilisent `createZodDto()`
- ZodValidationPipe applique globalement via `app.useGlobalPipes()`
- Erreurs validation : retourne HTTP 400 + body `{ error: 'validation', fields: [{ path, message }], traceId }`
- Helper `createZodDto(schema)` permet usage `class CreateContactDto extends createZodDto(CreateContactSchema) {}`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/pipes/zod-validation.pipe.ts`
  - `repo/apps/api/src/common/pipes/zod-validation.pipe.spec.ts`
  - `repo/apps/api/src/common/dto/create-zod-dto.helper.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST body valide passe
  - V2 (P0) : POST body invalide retourne HTTP 400
  - V3 (P0) : Erreur 400 contient liste fields invalides avec path + message

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): zodvalidationpipe global

Task: 1.3.6
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.6"
```

---

### Tache 7 / 15 : ResponseInterceptor : Format API Standardise

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.6

**But** : Wrapper toutes les responses success dans un format standardise `{ data, meta, traceId }` pour coherence cross-endpoint.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.7-prompt.md
```

**Actions principales attendues** :
- `repo/apps/api/src/common/interceptors/response.interceptor.ts` -- intercepte response success
- Format response success : `{ data: <controller return>, meta: { traceId, timestamp, version } }`
- Si controller retourne deja un objet avec `data` key, ne pas wrap (eviter double wrap)
- Si controller retourne array, wrap en `{ data: array, meta: { ..., total: array.length } }` (sauf paginated)
- Pour pagination : controller retourne `{ items, total, page, pageSize }` -> intercepteur transforme en `{ data: items, meta: { ..., pagination: { total, page, pageSize } } }`
- Trace ID lu depuis RequestContext (Tache 1.3.4)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/interceptors/response.interceptor.ts`
  - `repo/apps/api/src/common/decorators/skip-response-wrap.decorator.ts`
  - `repo/apps/api/src/common/interceptors/response.interceptor.spec.ts`
  - `repo/apps/api/src/main.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : GET endpoint retourne `{ data, meta }` avec traceId
  - V2 (P0) : Array retourne `{ data: [...], meta: { total } }`
  - V3 (P0) : Paginated `{ items, total, page }` retourne `{ data: items, meta: { pagination } }`

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): responseinterceptor : format api standardise

Task: 1.3.7
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.7"
```

---

### Tache 8 / 15 : ExceptionFilter Global : Erreurs Structurees + Redaction PII

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.3.7

**But** : Intercepter TOUTES les exceptions (HttpException + non-HttpException) et transformer en format unifie `{ error, code, traceId, details }` avec PII redaction.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.8-prompt.md
```

**Actions principales attendues** :
- `repo/apps/api/src/common/filters/all-exceptions.filter.ts` -- catch toutes exceptions
- Format response erreur : `{ error: <human readable>, code: <error code stable>, traceId, details: <dev only> }`
- HttpException : status code respecte, message extrait
- Validation errors (Zod) : status 400 + `details: { fields }`
- Erreurs metier custom (extending `BusinessError`) : status approprie (400/403/404/409)
- Erreurs systeme (DB connection lost, Redis down) : status 503 + message generique `"Service temporarily unavailable"`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/filters/all-exceptions.filter.ts`
  - `repo/apps/api/src/common/filters/all-exceptions.filter.spec.ts`
  - `repo/apps/api/src/common/errors/error-codes.ts`
  - `repo/apps/api/src/common/errors/business.error.ts`
  - `repo/apps/api/src/main.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : HttpException retourne format `{ error, code, traceId }`
  - V2 (P0) : Erreur inconnue catch, status 500, stack non-expose en prod
  - V3 (P0) : Stack expose en dev (NODE_ENV=development)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): exceptionfilter global : erreurs structurees + redaction pii

Task: 1.3.8
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.8"
```

---

### Tache 9 / 15 : Swagger OpenAPI 3.0 Setup

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.8

**But** : Configurer Swagger UI accessible sur `/docs` documentant les endpoints, avec generation automatique depuis Zod schemas.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.9-prompt.md
```

**Actions principales attendues** :
- Setup `@nestjs/swagger` + integration `nestjs-zod` pour generation depuis Zod schemas
- Swagger UI sur `/docs`
- OpenAPI JSON sur `/docs-json`
- Configuration : title, description, version (depuis env), contact, license
- Tags par module : `Auth`, `Tenant`, `RBAC`, `CRM`, `Booking`, `Comm`, `Docs`, `Pay`, `Insure`, `Repair`, etc.
- Auth schemes documentes : Bearer JWT (Sprint 5), API Key admin

**Fichiers cibles principaux** :
  - `repo/apps/api/src/main.ts`
  - `repo/apps/api/src/common/swagger/swagger.config.ts`
  - `repo/apps/api/src/common/swagger/swagger-tags.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `curl http://localhost:4000/docs` retourne HTML Swagger UI
  - V2 (P0) : `curl http://localhost:4000/docs-json` retourne OpenAPI JSON valide
  - V3 (P0) : OpenAPI version 3.0

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): swagger openapi 3.0 setup

Task: 1.3.9
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.9"
```

---

### Tache 10 / 15 : HealthModule : /healthz et /readyz

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.9

**But** : Exposer 2 endpoints standards Kubernetes : `/healthz` (liveness, simple OK) et `/readyz` (readiness, verifie dependances : DB + Redis + Kafka).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.10-prompt.md
```

**Actions principales attendues** :
- Module `repo/apps/api/src/modules/health/health.module.ts` import @nestjs/terminus
- Endpoint `GET /healthz` retourne `{ status: 'ok' }` HTTP 200 toujours (liveness)
- Endpoint `GET /readyz` execute checks : DB ping, Redis ping, Kafka producer connectable
- `/readyz` retourne 200 si tous OK, 503 si au moins 1 fail
- Format response readyz : `{ status, info: { db: 'up', redis: 'up', kafka: 'up' }, error: { ... si fail } }`
- Cache 5s sur readyz (eviter spam checks DB en prod K8s probe interval 1s)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/health/health.module.ts`
  - `repo/apps/api/src/modules/health/health.controller.ts`
  - `repo/apps/api/src/modules/health/indicators/db-health.indicator.ts`
  - `repo/apps/api/src/modules/health/indicators/redis-health.indicator.ts`
  - `repo/apps/api/src/modules/health/indicators/kafka-health.indicator.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `curl /healthz` retourne 200 + `{ status: 'ok' }`
  - V2 (P0) : `curl /readyz` retourne 200 + tous services up
  - V3 (P0) : Si DB stop : `/readyz` retourne 503

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): healthmodule : /healthz et /readyz

Task: 1.3.10
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.10"
```

---

### Tache 11 / 15 : BullMQ Integration : JobsModule

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.3.10

**But** : Setup BullMQ (Redis-backed jobs queue) pour traitement async deferred (envois WA, jobs cron, etc.). Pas de jobs metier au Sprint 3 -- juste integration.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.11-prompt.md
```

**Actions principales attendues** :
- Module `repo/apps/api/src/modules/jobs/jobs.module.ts` global `@Global()`
- Setup `@nestjs/bullmq` BullModule.forRoot avec Redis DB 2 (QUEUES)
- Default job options : 3 retries, exponential backoff (1s/5s/30s), removeOnComplete (30 jours), removeOnFail (90 jours)
- Connection options : reconnectOnError, maxRetriesPerRequest 3
- Helper `JobProducer` service qui wrap BullMQ avec validation Zod (par analogie KafkaPublisher Sprint 2)
- BullDashboard accessible sur `/admin/queues` (auth : super admin only -- sera Sprint 5+)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/jobs/jobs.module.ts`
  - `repo/apps/api/src/modules/jobs/job-producer.service.ts`
  - `repo/apps/api/src/modules/jobs/job-producer.service.spec.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Module charge sans erreur
  - V2 (P0) : Connection Redis DB 2 etablie
  - V3 (P0) : Test : creer queue, ajouter job, dummy worker process succes

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): bullmq integration : jobsmodule

Task: 1.3.11
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.11"
```

---

### Tache 12 / 15 : Sentry Integration

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.11

**But** : Capture automatique des erreurs HTTP 5xx + erreurs uncaught dans Sentry pour observability + alerting.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.12-prompt.md
```

**Actions principales attendues** :
- Setup `@sentry/nestjs` SDK
- Initialisation conditionnelle : si `SENTRY_DSN` defini -> activer, sinon skip
- Config Sentry : DSN, environment (depuis NODE_ENV), release (depuis APP_VERSION), tracesSampleRate 0.1 prod / 1.0 dev
- Auto-capture exceptions 5xx via integration ExceptionFilter (Tache 1.3.8)
- User context auto-injecte : user_id depuis RequestContext (Sprint 5+ aura le user)
- Tenant context auto-injecte : tenant_id depuis RequestContext

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/sentry/sentry.module.ts`
  - `repo/apps/api/src/common/sentry/sentry.config.ts`
  - `repo/apps/api/src/common/sentry/sentry-before-send.ts`
  - `repo/apps/api/src/main.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Si `SENTRY_DSN` set : Sentry initialise
  - V2 (P0) : Si `SENTRY_DSN` absent : pas de crash, juste log warn
  - V3 (P0) : Exception 5xx capture (mock + verify Sentry SDK called)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): sentry integration

Task: 1.3.12
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.12"
```

---

### Tache 13 / 15 : Rate Limiting Global : @nestjs/throttler + Redis

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.3.12

**But** : Limiter requests per IP/user/tenant pour proteger API contre abus, scraping, brute force.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.13-prompt.md
```

**Actions principales attendues** :
- Setup `@nestjs/throttler` v6 avec Redis storage (DB 5 RATE_LIMIT)
- Default limit : 100 req / minute per IP (sliding window)
- Limits per route override possible via decorator `@Throttle({ default: { limit, ttl } })`
- Limit specifique auth : 5 attempts / minute per IP (anti brute force) -- decorator usage Sprint 5
- Tracking key composite : si user authentifie -> per user, sinon per IP
- Skip pour `/healthz`, `/readyz`, `/docs` (whitelist)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/throttler/throttler.module.ts`
  - `repo/apps/api/src/common/throttler/throttler-redis.storage.ts`
  - `repo/apps/api/src/common/throttler/throttler.guard.ts`
  - `repo/apps/api/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 100e request OK, 101e retourne 429
  - V2 (P0) : Apres 60s, quota reset
  - V3 (P0) : Headers X-RateLimit-* presents

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): rate limiting global : @nestjs/throttler + redis

Task: 1.3.13
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.13"
```

---

### Tache 14 / 15 : PublicEndpointGuard + @Public() Decorator

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.3.13

**But** : Mecanisme explicite pour marquer les endpoints accessibles SANS authentication (`/api/v1/public/*`, `/healthz`, etc.) en gardant l'auth obligatoire par defaut.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.14-prompt.md
```

**Actions principales attendues** :
- Decorator `@Public()` -- marque endpoint comme public
- Guard global `PublicEndpointGuard` qui :
- Skip auth aussi pour : `/healthz`, `/readyz`, `/docs/*`, `/docs-json`, `/api/v1/public/*` (par convention path)
- Header `x-tenant-id` mandatory si endpoint NON-public (sauf admin/SuperAdmin Sprint 6)
- Header `x-tenant-id` interdit si endpoint public (rejete 400 si present sur /public/*)
- Logs Pino : tentative acces endpoint protected sans auth (warn)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/decorators/public.decorator.ts`
  - `repo/apps/api/src/common/guards/public-endpoint.guard.ts`
  - `repo/apps/api/src/common/guards/public-endpoint.guard.spec.ts`
  - `repo/apps/api/src/main.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `/healthz` accepte sans auth
  - V2 (P0) : `/api/v1/public/*` accepte sans auth
  - V3 (P0) : `/docs` accepte sans auth

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): publicendpointguard + @public() decorator

Task: 1.3.14
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.14"
```

---

### Tache 15 / 15 : Tests E2E Bootstrap : Smoke Tests + Healthcheck + 404/500

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.3.14

**But** : Suite tests E2E Playwright (project `api`) validant tous les transverses Sprint 3 fonctionnent ensemble : healthcheck, format response, exception filter, validation, rate limiting, public endpoints.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-03-api-bootstrap/task-1.3.15-prompt.md
```

**Actions principales attendues** :
- Tests dans `repo/e2e/api/` (deja config Playwright Sprint 1)
- Test 1 : `smoke.spec.ts` -- GET / retourne 200 + format `{ data: { name, version, env }, meta: { traceId } }`
- Test 2 : `healthcheck.spec.ts` -- GET /healthz retourne 200 simple, GET /readyz retourne 200 si all up
- Test 3 : `cors.spec.ts` -- OPTIONS preflight retourne CORS headers, request from origin non-allowed retourne 403
- Test 4 : `404-not-found.spec.ts` -- GET /api/v1/non-existent retourne 404 + format erreur
- Test 5 : `validation.spec.ts` -- POST avec body invalide retourne 400 + `details.fields`

**Fichiers cibles principaux** :
  - `repo/e2e/api/smoke.spec.ts`
  - `repo/e2e/api/healthcheck.spec.ts`
  - `repo/e2e/api/cors.spec.ts`
  - `repo/e2e/api/404-not-found.spec.ts`
  - `repo/e2e/api/validation.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 12+ tests E2E ecrits
  - V2 (P0) : Tous tests passent localement
  - V3 (P0) : Tous tests passent CI (avec services Postgres+Redis+Kafka)

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-03): tests e2e bootstrap : smoke tests + healthcheck + 404/500

Task: 1.3.15
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-03 Tache 1.3.15"
```

---


## VERIFICATION DU SPRINT 3

Une fois les 15 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-03-sprint-03-verification.md
```

Le fichier de verification V-03 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint03-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint03-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint03-verify-report.md
git commit -m "chore(sprint-03): close sprint 3 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 1 (Bootstrap Infrastructure)
- Sprint : 3 (Phase 1 / Sprint 3)
- Apport : API NestJS production-ready + Swagger auto-generated
- Tests E2E cumules : {N}+

Sprint 3 completed -- handoff to Sprint 4."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 3]
   |
   v
[Tache 1.3.1: NestJS 10.4 + Fastify Adapter Setup]
   | -> compile -> tests -> commit
   v
[Tache 1.3.2: AppModule + ConfigModule + Structure Modulaire]
   | -> compile -> tests -> commit
   v
[Tache 1.3.3: Pino Logger Integration via nestjs-pino]
   | -> compile -> tests -> commit
   v
[Tache 1.3.4: OpenTelemetry Traces + RequestContextMiddleware]
   | -> compile -> tests -> commit
   v
[Tache 1.3.5: Helmet + CORS Strict + Compression + Body Limit]
   | -> compile -> tests -> commit
   v
[Tache 1.3.6: ZodValidationPipe Global]
   | -> compile -> tests -> commit
   v
[Tache 1.3.7: ResponseInterceptor : Format API Standardise]
   | -> compile -> tests -> commit
   v
[Tache 1.3.8: ExceptionFilter Global : Erreurs Structurees + Redactio]
   | -> compile -> tests -> commit
   v
[Tache 1.3.9: Swagger OpenAPI 3.0 Setup]
   | -> compile -> tests -> commit
   v
[Tache 1.3.10: HealthModule : /healthz et /readyz]
   | -> compile -> tests -> commit
   v
[Tache 1.3.11: BullMQ Integration : JobsModule]
   | -> compile -> tests -> commit
   v
[Tache 1.3.12: Sentry Integration]
   | -> compile -> tests -> commit
   v
[Tache 1.3.13: Rate Limiting Global : @nestjs/throttler + Redis]
   | -> compile -> tests -> commit
   v
[Tache 1.3.14: PublicEndpointGuard + @Public() Decorator]
   | -> compile -> tests -> commit
   v
[Tache 1.3.15: Tests E2E Bootstrap : Smoke Tests + Healthcheck + 404/5]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 3 -- V-03]
   |
   v
[Rapport sprint03-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

**Apport metier principal** : API NestJS production-ready + Swagger auto-generated.

**Prerequis Sprint 4** : Sprint 3 GO complet (score >= 95% verification automatique V-03).

**Sprint suivant** : Sprint 4.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 2 (verification GO)

```bash
# Verifier Sprint 2 GO
ls skalean-insurtech/sprint02-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint02-verify-report.md
```

### Lancement Sprint 3 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-03-sprint-03-api-bootstrap.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-03-sprint-03-api-bootstrap.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-03-sprint-03-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-03.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 3"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint03-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-03** complet avant generation prompts taches (contexte critique)
2. **Generer les 15 prompts taches** dans `00-pilotage/prompts-taches/sprint-03-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-03 v2.2 detaille -- Sprint 3 (1.3) API Bootstrap NestJS.**

**Total taches detaillees** : 15 | **Effort cumul** : ~75h | **Apport** : API NestJS production-ready + Swagger auto-generated
