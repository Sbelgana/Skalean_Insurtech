# META-PROMPT B-01 -- SPRINT 1 BOOTSTRAP INFRASTRUCTURE

**Version** : v2.2 (Option B)
**Phase** : 1 -- Bootstrap (Sprints 1-4)
**Sprint** : 1 / 35 (cumul)
**Position** : Premier sprint du programme -- fondateur
**Numerotation taches** : 1.1.1 a 1.1.15
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous les sprints suivants)

---

## Objectif Global du Sprint

Etablir l'infrastructure complete sur laquelle se construiront les 34 sprints suivants : monorepo pnpm + Turborepo, services dev orchestres (Postgres + Redis + Kafka + S3-compat + n8n + mailhog), TypeScript strict, configuration linter unifiee, CI/CD bootstrap, frameworks tests, logging structured, et documentation architecture.

A la sortie de ce sprint :
- `pnpm install` reussit a froid en moins de 90 secondes
- `pnpm docker:up` demarre 7 services en moins de 60 secondes
- `pnpm typecheck` retourne 0 erreur sur l'ensemble du monorepo
- CI GitHub Actions verte sur PR et main
- Multi-tenant 3 niveaux avec helpers Postgres operationnels
- 30+ topics Kafka existants avec convention naming
- 3 buckets MinIO crees automatiquement
- Aucune emoji dans le repo (verifie automatiquement par hook)

---

## Frontiere du Sprint

**INCLUS** :
- Structure monorepo + tooling (TypeScript, Biome, Turborepo)
- Services dev Docker (Postgres, Redis, Kafka, MinIO, n8n, mailhog, Kafka UI)
- Helpers SQL multi-tenant 3 niveaux
- Topics Kafka catalog initial (30 topics, schemas Zod ajoutes Sprint 2)
- Configuration runtime (env loader Zod)
- Logging structured (Pino + OpenTelemetry SDK)
- Tests frameworks (Vitest + Playwright)
- CI/CD bootstrap GitHub Actions
- Hooks Git (Husky + commitlint + lint-staged)
- 16+ packages stubs et 8 apps stubs
- Documentation architecture (6 ADR + README + CLAUDE.md + CONTRIBUTING.md)

**EXCLU** (sera ajoute aux sprints suivants) :
- Entities TypeORM et migrations DB (Sprint 2)
- Services NestJS metier (Sprint 3+)
- UI components shadcn/ui complets (Sprint 4)
- Auth JWT + MFA (Sprint 5)
- Multi-tenant runtime (Sprint 6)
- RBAC permissions (Sprint 7)
- Toute logique Skalean AI (Sprints 30-32)

---

## Lectures Prealables Obligatoires

Avant d'executer les taches de ce sprint, lire :

1. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles transverses (multi-tenant 3 niveaux, no-emoji, conformite)
2. `00-pilotage/documentation/1-stack-technique.yaml` -- versions exactes
3. `00-pilotage/documentation/2-variables-environnement.env` -- catalog ENV
4. `00-pilotage/documentation/9-roadmap-execution.md` -- ordre execution + AI-3 strategy
5. `00-pilotage/documentation/10-arborescence-projet.md` -- structure dossiers cible

---

## Stack Imposee (Sprint 1)

| Composant | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.11.0 LTS | engine-strict actif |
| pnpm | 9.15.0 | gestionnaire packages monorepo |
| Turborepo | 2.3.3 | task runner + cache |
| TypeScript | 5.7.3 | strict mode + 8 flags |
| Biome | 1.9.4 | lint + format unifie (vs ESLint+Prettier) |
| PostgreSQL | 16.6-alpine | + 5 extensions |
| Redis | 7.4.1-alpine | 6 DBs separes |
| Kafka | 3.7.1 (Bitnami) | mode KRaft (sans Zookeeper) |
| MinIO | RELEASE.2024-11-07 | S3-compatible local |
| n8n | 1.74.0 | workflow engine (utilise Sprint 30) |
| Mailhog | v1.0.1 | SMTP catcher dev |
| TypeORM | 0.3.20 | DataSource + migrations + RLS |
| Vitest | 2.1.8 | tests unitaires |
| Playwright | 1.49.1 | tests E2E |
| Pino | 9.5.0 | logger structured |
| OpenTelemetry SDK | 1.30.0 | tracing |
| Husky | 9.1.7 | Git hooks |
| commitlint | 19.6.1 | conventional commits |
| lint-staged | 15.2.11 | pre-commit linting |

---

## Vue d'Ensemble des 15 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 1.1.1 | Initialisation monorepo pnpm + Turborepo + structure | 6h | P0 | -- |
| 1.1.2 | TypeScript strict + Biome unifie | 4h | P0 | 1.1.1 |
| 1.1.3 | Docker Compose dev -- 7 services orchestres | 6h | P0 | 1.1.2 |
| 1.1.4 | PostgreSQL 16 + extensions + helpers RLS multi-tenant 3 niveaux | 7h | P0 | 1.1.3 |
| 1.1.5 | Redis 7.4 + strategy 6 DBs separes | 4h | P0 | 1.1.4 |
| 1.1.6 | Kafka 3.7 KRaft + topic catalog 30 topics | 6h | P0 | 1.1.5 |
| 1.1.7 | MinIO S3-compatible dev + Atlas Cloud Services Object Storage prod ready | 4h | P0 | 1.1.6 |
| 1.1.8 | shared-config -- env loader Zod runtime validation | 5h | P0 | 1.1.7 |
| 1.1.9 | database -- TypeORM 0.3 DataSource | 6h | P0 | 1.1.8 |
| 1.1.10 | GitHub Actions CI -- lint + typecheck + build + test | 5h | P0 | 1.1.9 |
| 1.1.11 | Vitest + Playwright frameworks | 4h | P0 | 1.1.10 |
| 1.1.12 | Pino logger + OpenTelemetry + Sentry ready | 5h | P0 | 1.1.11 |
| 1.1.13 | Init 16+ shared packages stubs + 8 apps stubs | 6h | P0 | 1.1.12 |
| 1.1.14 | Husky + commitlint + lint-staged + check-no-emoji | 4h | P0 | 1.1.13 |
| 1.1.15 | Documentation architecture -- 6 ADR + README + CLAUDE.md + CONTRIBUTING | 6h | P0 | 1.1.14 |

**Total** : 78 heures.

---

# DETAIL DES 15 TACHES

---

## Tache 1.1.1 -- Initialisation Monorepo pnpm + Turborepo + Structure

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 6h / Aucune dependance

**But** : Etablir la structure monorepo complete (8 apps + 16+ packages) avec pnpm 9 workspaces et Turborepo 2.3 task runner.

**Contexte** : Le choix monorepo (vs polyrepo) permet refactoring atomique cross-app, versions deps unifiees, et tests CI deterministes. pnpm vs npm/yarn pour vitesse (3-5x) et hoisting strict. Turborepo pour cache build inter-machines.

**Livrables checkables** :
- [ ] `repo/package.json` racine avec scripts orchestres (dev, build, lint, typecheck, test, docker:up/down/reset, bootstrap)
- [ ] `repo/pnpm-workspace.yaml` declarant `apps/*` et `packages/*`
- [ ] `repo/turbo.json` avec pipeline (build dependsOn `^build`, dev `cache: false`, test avec `env` declare)
- [ ] `repo/.npmrc` avec `auto-install-peers=true`, `save-exact=true`, `engine-strict=true`, `link-workspace-packages=deep`
- [ ] `repo/.nvmrc` contenant `22.11.0`
- [ ] `repo/.gitignore` complet (node_modules, .env, .turbo, dist, .next, coverage, test-results, playwright-report, docker-data, *.tsbuildinfo)
- [ ] `repo/.editorconfig` avec UTF-8, LF, 2 spaces indent
- [ ] Structure dossiers : `repo/apps/{api,web-broker,web-garage,web-garage-mobile,web-insurtech-admin,web-customer-portal,web-assure-portal,web-assure-mobile}` (8 dossiers vides)
- [ ] Structure dossiers : `repo/packages/{auth,database,crm,booking,comm,docs,signature,pay,books,compliance,analytics,insure,repair,skalean-ai-client,shared-config,shared-types,shared-events,shared-utils,shared-ui,shared-pwa,shared-maps}` (21 dossiers, 16 packages metier + 5 shared)
- [ ] Structure dossiers : `repo/infrastructure/{docker/{postgres,redis,kafka},scripts,terraform}`
- [ ] Structure dossiers : `repo/.github/workflows`, `repo/.husky`, `repo/.vscode`, `repo/docs/architecture`
- [ ] `pnpm install` reussit a froid sans erreur
- [ ] `pnpm dlx turbo --version` retourne 2.3.x

**Fichiers crees / modifies** :
```
repo/package.json                    # ~50 lignes (scripts + devDeps : turbo, biome, husky, commitlint, lint-staged, tsx, typescript, types/node)
repo/pnpm-workspace.yaml             # 3 lignes
repo/turbo.json                      # ~35 lignes (pipeline build/dev/lint/typecheck/test/test:e2e/clean)
repo/.npmrc                          # ~10 lignes
repo/.nvmrc                          # 1 ligne
repo/.gitignore                      # ~40 lignes
repo/.editorconfig                   # ~15 lignes
repo/{apps,packages,infrastructure,.github,.husky,.vscode,docs}/   # dossiers vides
```

**Notes implementation** (pieges, choix non-evidents) :
- `save-exact=true` impose locks deterministes (pas de drift de versions entre devs)
- `engine-strict=true` rejette `pnpm install` si Node < 22.11.0 (anti-bug subtil)
- Turborepo cache local en Phase 1 (Remote Cache Vercel = optionnel Sprint 35)
- `globalDependencies` dans turbo.json inclut `tsconfig.base.json` et `biome.json` -> invalidation cache si modifies
- Pipeline test avec `env: ["NODE_ENV", "DATABASE_URL", "REDIS_URL"]` car turbo cache ne doit pas reutiliser test results entre envs differents
- `link-workspace-packages=deep` permet workspace packages d'etre lies meme dans deps transitives

**Criteres validation** :
- V1 (P0) : `pnpm install --frozen-lockfile` reussit en < 90s sur machine 8 GB RAM
- V2 (P0) : `turbo --version` >= 2.3.0
- V3 (P0) : `ls apps/ | wc -l` retourne 8
- V4 (P0) : `ls packages/ | wc -l` retourne 21 (16 metier + 5 shared)
- V5 (P0) : `engine-strict` rejette install si Node < 22.11.0 (test : downgrade local Node temporairement)
- V6 (P0) : `pnpm typecheck` reussit (vide mais valide)
- V7 (P1) : Cache turbo invalide correctement quand `tsconfig.base.json` modifie

---

## Tache 1.1.2 -- TypeScript Strict + Biome Unifie

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 4h / Depend de 1.1.1

**But** : Configurer TypeScript 5.7 en strict mode avec 8 flags, et Biome 1.9 pour lint + format unifie remplacant ESLint + Prettier.

**Contexte** : Biome est ~10x plus rapide qu'ESLint (Rust-based), une seule config pour lint + format. Strict mode TypeScript force la rigueur typage avec flags critiques (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

**Livrables checkables** :
- [ ] `repo/tsconfig.base.json` avec compilerOptions strict + path mapping `@insurtech/*` -> `packages/*/src`
- [ ] `repo/tsconfig.json` racine avec `noEmit: true` (pour scripts infrastructure)
- [ ] `repo/biome.json` avec rules linter strictes (recommended + custom rules)
- [ ] `repo/.vscode/settings.json` avec Biome formatter par defaut + organize imports on save
- [ ] `repo/.vscode/extensions.json` recommandant Biome + Docker + YAML + Tailwind
- [ ] Formatter config : single quotes, trailing commas all, semicolons always, line width 100, 2 spaces
- [ ] Linter rules custom : `noConsoleLog: error`, `noExplicitAny: warn`, `noUnusedVariables: error`, `useImportType: error`
- [ ] Override pour fichiers tests : `noConsoleLog: off`
- [ ] `pnpm typecheck` reussit
- [ ] `pnpm lint` (Biome) reussit avec 0 erreur

**Compiler options strict obligatoires** :
- `strict: true` (active 8 flags)
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUncheckedIndexedAccess: true` (force null check sur `arr[i]`)
- `exactOptionalPropertyTypes: true` (distingue `undefined` vs absent)
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true`
- `experimentalDecorators: true` + `emitDecoratorMetadata: true` (pour TypeORM)

**Fichiers crees / modifies** :
```
repo/tsconfig.base.json              # ~50 lignes (compilerOptions + paths + exclude)
repo/tsconfig.json                   # ~10 lignes (extends + scripts infrastructure)
repo/biome.json                      # ~80 lignes (linter + formatter + overrides)
repo/.vscode/settings.json           # ~20 lignes
repo/.vscode/extensions.json         # ~15 lignes
```

**Notes implementation** :
- `verbatimModuleSyntax: true` force `import type` pour types-only imports (clarte + perf compile)
- `useDefineForClassFields: true` aligne sur ECMAScript standard (mais override `false` pour packages TypeORM cf. Tache 1.1.9)
- Override Biome pour tests : `noConsoleLog: off` car `console.log` souvent utile pour debug tests
- Tailwind CSS classes ne sont pas validees par Biome (cf. `bradlc.vscode-tailwindcss` extension)

**Criteres validation** :
- V1 (P0) : `pnpm typecheck` reussit
- V2 (P0) : `pnpm lint` reussit (0 erreur Biome)
- V3 (P0) : `pnpm format --check .` propre
- V4 (P0) : `noUncheckedIndexedAccess: true` actif (test : essayer `arr[0].foo` -> error TS)
- V5 (P0) : `exactOptionalPropertyTypes: true` actif
- V6 (P0) : `noConsoleLog: error` rejette `console.log` en code (sauf tests)
- V7 (P1) : VS Code formate automatiquement on save
- V8 (P1) : Path mapping `@insurtech/*` resoud correctement

---

## Tache 1.1.3 -- Docker Compose Dev (7 Services)

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 6h / Depend de 1.1.2

**But** : Demarrer la stack dev complete (Postgres, Redis, Kafka KRaft, Kafka UI, MinIO, n8n, Mailhog) via une seule commande `pnpm docker:up`.

**Contexte** : Une stack dev coherente entre developpeurs evite les "works on my machine". Volumes persistents pour data survivre aux restarts. Healthchecks garantissent ordre demarrage correct.

**Livrables checkables** :
- [ ] `repo/infrastructure/docker/docker-compose.dev.yaml` orchestrant 7 services + 2 init containers
- [ ] `repo/infrastructure/docker/docker-compose.test.yaml` pour CI (Postgres + Redis + Kafka uniquement, pas de volumes persistents)
- [ ] Service `postgres:16.6-alpine` avec extensions montees via init scripts
- [ ] Service `redis:7.4.1-alpine` avec password actif et redis.conf custom
- [ ] Service `kafka:3.7.1` (Bitnami) en mode KRaft (PROCESS_ROLES=controller,broker, pas de Zookeeper)
- [ ] Service `kafka-ui:v0.7.2` (Provectus) accessible :8080
- [ ] Service `mailhog:v1.0.1` SMTP :1025 + UI :8025
- [ ] Service `minio:RELEASE.2024-11-07` S3 :9000 + console :9001
- [ ] Service `n8n:1.74.0` avec auth basique, schema Postgres dedie
- [ ] Init container `kafka-init-topics` execute apres Kafka healthy
- [ ] Init container `minio-init` cree 3 buckets apres MinIO healthy
- [ ] Healthchecks definis sur tous services principaux (postgres pg_isready, redis ping, kafka topics list, mailhog wget, minio mc ready)
- [ ] Volumes persistents : `postgres-data`, `redis-data`, `kafka-data`, `minio-data`, `n8n-data`
- [ ] Network bridge `skalean-net`
- [ ] Variables env via `${VAR:-default}` pattern (pour overrides depuis `.env`)
- [ ] Tous services up et healthy en moins de 60 secondes sur machine dev moyenne

**Configuration Postgres specifique** :
- `max_connections=200`, `shared_buffers=256MB`, `work_mem=8MB`
- `log_statement=mod` (logs DML, pas SELECT)
- `log_min_duration_statement=500` (logs queries > 500ms)
- `effective_io_concurrency=200`

**Configuration Redis specifique** :
- AOF persistance + RDB snapshots
- `maxmemory 512mb` + `maxmemory-policy allkeys-lru`
- `notify-keyspace-events Ex` (pour eviction events monitoring)
- 16 DBs disponibles
- Slow log > 10ms

**Configuration Kafka specifique** :
- KRaft mode (sans Zookeeper) : `KAFKA_CFG_PROCESS_ROLES=controller,broker`
- 3 listeners : INTERNAL (kafka:9092), CONTROLLER (kafka:9093), EXTERNAL (localhost:9094)
- `AUTO_CREATE_TOPICS_ENABLE=false` (topics crees explicitement par script)
- Retention 7 jours / 1 GB par defaut

**Fichiers crees / modifies** :
```
repo/infrastructure/docker/docker-compose.dev.yaml      # ~200 lignes
repo/infrastructure/docker/docker-compose.test.yaml     # ~80 lignes (subset CI)
repo/infrastructure/docker/redis/redis.conf             # ~40 lignes
```

**Notes implementation** :
- KRaft mode est plus simple operationnellement que Zookeeper (moins de processus a gerer)
- MinIO accepte n'importe quelle region nommee (utiliser `ma-bgr-1` pour simuler prod Atlas Cloud Services Benguerir)
- n8n utilise Postgres en backend (schema `n8n` separe pour eviter pollution skalean_insurtech)
- Mailhog API REST sur `:8025/api/v2/messages` permet tests E2E sans vrai SMTP
- Init containers (kafka-init, minio-init) ont `restart: "no"` car ils s'executent une fois au boot
- Variables env avec defaults pour permettre demarrage sans `.env` (utile dev), mais ces defaults sont DEV ONLY

**Criteres validation** :
- V1 (P0) : `pnpm docker:up` reussit
- V2 (P0) : `docker ps | grep skalean | wc -l` >= 7 (au moins 7 containers)
- V3 (P0) : Tous services healthy en < 60s : `docker compose ps --format json | jq '.Health'`
- V4 (P0) : `docker exec skalean-postgres pg_isready -U skalean` reussit
- V5 (P0) : `docker exec skalean-redis redis-cli -a skalean_redis_dev ping` retourne PONG
- V6 (P0) : `docker exec skalean-kafka kafka-topics.sh --list` reussit (vide initialement avant Tache 1.1.6)
- V7 (P0) : `curl -s http://localhost:8025/api/v2/messages` (Mailhog) retourne JSON
- V8 (P0) : MinIO console accessible :9001 + 3 buckets crees automatiquement
- V9 (P0) : n8n accessible :5678 avec auth basique
- V10 (P1) : Volumes persistents (data survit `docker compose restart`)
- V11 (P1) : `pnpm docker:reset` clean tout (volumes inclus) et redemarre

---

## Tache 1.1.4 -- PostgreSQL 16 + Extensions + Helpers RLS Multi-Tenant 3 Niveaux

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 7h / Depend de 1.1.3

**But** : Configurer Postgres 16 avec 5 extensions critiques et installer 6 helpers SQL pour multi-tenant 3 niveaux applique automatiquement par RLS dans les sprints suivants.

**Contexte** : Le multi-tenant 3 niveaux (Platform / Customer Tenant / Assure) est un choix architectural fondateur. Les helpers SQL (`app_current_tenant()`, `app_is_super_admin()`, `app_can_access_tenant()`) sont la **derniere ligne de defense** -- meme si un bug applicatif laisse passer une query, RLS Postgres bloque le cross-tenant leak.

**Livrables checkables** :
- [ ] Init script `repo/infrastructure/docker/postgres/init.sh` (entry point)
- [ ] SQL `repo/infrastructure/docker/postgres/001-init-extensions.sql` installant 5 extensions
- [ ] SQL `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql` definissant 6 helpers
- [ ] SQL `repo/infrastructure/docker/postgres/003-init-databases.sql` creant schema n8n + database test
- [ ] Extension `pgcrypto` installee (pour `gen_random_uuid()` UUID v4 cryptographique)
- [ ] Extension `pg_trgm` installee (full-text search trigram CRM contacts -- Sprint 8)
- [ ] Extension `btree_gist` installee (EXCLUDE constraint Booking anti-overlap -- Sprint 8)
- [ ] Extension `unaccent` installee (recherche insensible aux accents fr/ar)
- [ ] Extension `citext` installee (case-insensitive emails)
- [ ] Helper `app_current_tenant()` retourne UUID tenant courant ou NULL
- [ ] Helper `app_is_super_admin()` retourne true/false (bypass RLS si true)
- [ ] Helper `app_assure_user_id()` retourne UUID assure courant L3 ou NULL
- [ ] Helper `app_current_user_id()` retourne UUID user courant
- [ ] Helper `app_cross_tenant_authorization_id()` retourne UUID auth cross-tenant active si applicable
- [ ] Helper agrege `app_can_access_tenant(target_tenant_id uuid)` evalue : super admin OU same tenant OU cross-tenant auth active

**Pattern critique : helpers SQL Postgres**

Les helpers utilisent `current_setting('app.X', true)` qui lit une variable de session Postgres. Le 2eme argument `true` retourne NULL au lieu de raise si la variable n'est pas set.

Exemple snippet (a generer dans 002-init-tenant-rls-helpers.sql) :
```sql
CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;
```

Au runtime (Sprint 6 implementera cette logique), avant chaque transaction authentifiee :
```sql
SET LOCAL app.current_tenant_id = '<uuid>';
SET LOCAL app.is_super_admin = 'true';   -- optionnel, super admin uniquement
```

**Fichiers crees / modifies** :
```
repo/infrastructure/docker/postgres/init.sh                          # ~10 lignes shell
repo/infrastructure/docker/postgres/001-init-extensions.sql          # ~15 lignes
repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql  # ~80 lignes
repo/infrastructure/docker/postgres/003-init-databases.sql           # ~10 lignes
```

**Notes implementation** :
- Les fichiers SQL `00X-*.sql` sont executes dans l'ordre alphabetique par Postgres docker entrypoint
- `STABLE PARALLEL SAFE` sur les helpers permet a Postgres de les utiliser dans queries paralleles
- `NULLIF(..., '')` important : si variable set a chaine vide, on retourne NULL (sinon cast UUID echoue)
- Le helper `app_can_access_tenant()` est utilise dans les RLS policies des Sprint 2+ pour decider si une row est visible
- Pas de helper "assure can access police P" -- ca relevera du RBAC ABAC (Sprint 7), pas du RLS DB

**Criteres validation** :
- V1 (P0) : `docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "SELECT extname FROM pg_extension"` liste : btree_gist, citext, pg_trgm, pgcrypto, plpgsql, unaccent
- V2 (P0) : Les 6 helpers sont definis : `\df app_*` dans psql
- V3 (P0) : `SELECT app_current_tenant()` retourne NULL hors session SET LOCAL
- V4 (P0) : `BEGIN; SET LOCAL app.current_tenant_id = '<uuid>'; SELECT app_current_tenant(); COMMIT;` retourne UUID
- V5 (P0) : `SELECT app_is_super_admin()` retourne `false` par defaut
- V6 (P0) : `SELECT gen_random_uuid()` retourne UUID v4 valide
- V7 (P0) : Schema `n8n` existe : `\dn`
- V8 (P0) : Database `skalean_insurtech_test` existe : `\l`
- V9 (P1) : `shared_buffers=256MB` configure : `SHOW shared_buffers`
- V10 (P1) : Logging queries lentes actif : `SHOW log_min_duration_statement` retourne 500

---

## Tache 1.1.5 -- Redis 7.4 + Strategy 6 DBs

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 4h / Depend de 1.1.4

**But** : Configurer Redis 7.4 avec strategy de 6 DBs separes (un par usage) et fournir un factory client TypeScript reutilisable.

**Contexte** : Redis supporte 16 DBs natifs. Separer par usage (cache, sessions, queues, locks, AI cache, rate limit) permet : flush selective, monitoring par usage, eviction policies differenciees, et scaling separable plus tard (Redis Cluster).

**Livrables checkables** :
- [ ] `repo/infrastructure/docker/redis/redis.conf` enrichi (AOF + RDB + LRU + slowlog)
- [ ] `repo/packages/shared-utils/src/redis/redis-clients.ts` exposant factory `createRedisClient()` + singleton `getRedisClient()` + helper `closeAllRedisClients()`
- [ ] Constante `REDIS_DB` exportant 6 DBs : `CACHE: 0`, `SESSIONS: 1`, `QUEUES: 2`, `LOCKS: 3`, `AI_CACHE: 4`, `RATE_LIMIT: 5`
- [ ] Retry strategy exponential 10 fois max avec delay 100-2000ms
- [ ] Reconnect on errors : `READONLY`, `ETIMEDOUT`, `ECONNRESET`
- [ ] Logs Pino structured sur `connect`, `error`, `close` events
- [ ] `repo/packages/shared-utils/src/redis/redis-clients.spec.ts` tests integration (connect DB 0, isolation DB 0 vs DB 1, key prefix respect)
- [ ] Documentation strategy : `repo/docs/architecture/cache-strategy.md` documentant DB allocation + naming convention keys

**Convention naming keys** : `{module}:{entity}:{tenant_id}:{entity_id}[:{sub}]`

Exemples :
- `cache:police:abc-123:def-456` -- JSON police data
- `session:user-id:abc-789` -- session metadata
- `queue:wa-send:waiting` -- BullMQ internal
- `lock:police-validation:abc-123` -- Redlock token
- `ratelimit:login:ip:192.168.1.1` -- sliding window count

**Fichiers crees / modifies** :
```
repo/infrastructure/docker/redis/redis.conf                # ~50 lignes
repo/packages/shared-utils/src/redis/redis-clients.ts      # ~120 lignes (factory + singleton + helpers)
repo/packages/shared-utils/src/redis/redis-clients.spec.ts # ~80 lignes (3 tests integration)
repo/docs/architecture/cache-strategy.md                   # ~50 lignes
```

**Notes implementation** :
- `lazyConnect: true` -- ne pas se connecter automatiquement, attend appel explicite (utile pour healthchecks)
- `keyPrefix` (optionnel) preserve l'isolation tenant : `getTenantCacheKey(prefix, ...parts)` helper
- `notify-keyspace-events Ex` actif permet pub/sub sur eviction (debugging)
- Eviction policy `allkeys-lru` (vs `volatile-lru`) car cache n'a pas toujours TTL explicite
- Slow log > 10ms aide a detecter queries Redis lentes (hash huge, etc.)

**Criteres validation** :
- V1 (P0) : `docker exec skalean-redis redis-cli -a $REDIS_PASSWORD ping` retourne PONG
- V2 (P0) : `createRedisClient({ url, db: 0 })` connecte sans erreur
- V3 (P0) : Test isolation : key set en DB 0 PAS visible en DB 1
- V4 (P0) : `REDIS_DB` constante exporte 6 DBs avec valeurs 0-5
- V5 (P0) : Retry strategy max 10 fois, delay max 2000ms
- V6 (P0) : Logs Pino emis sur connect/error/close
- V7 (P0) : `closeAllRedisClients()` ferme tous les clients singleton
- V8 (P1) : Documentation cache-strategy.md couvre les 6 DBs + naming convention

---

## Tache 1.1.6 -- Kafka 3.7 KRaft + Topic Catalog (30 Topics)

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 6h / Depend de 1.1.5

**But** : Creer les 30 topics Kafka initiaux du programme avec convention naming `insurtech.events.{vertical}.{entity}.{action}` et configuration retention/partitions appropriees.

**Contexte** : Kafka est utilise pour event sourcing, async processing et audit trail. Les schemas Zod des events sont definis Sprint 2 (paquet shared-events). Sprint 1 cree juste les topics avec leur configuration. Mode KRaft (sans Zookeeper) plus simple operationnellement.

**Livrables checkables** :
- [ ] Script `repo/infrastructure/docker/kafka/init-topics.sh` execute par init container `kafka-init-topics`
- [ ] Helper function `create_topic(name, partitions=3, replication=1)` reutilisable
- [ ] Configuration topics : `compression.type=lz4`, `retention.ms=604800000` (7 jours), `retention.bytes=1073741824` (1 GB), `cleanup.policy=delete`
- [ ] Topics Auth (7) : `user_signed_up`, `user_signed_in` (6 partitions), `user_signed_out`, `password_changed`, `mfa_setup`, `account_locked`, `role_changed`
- [ ] Topics CRM (5) : `contact_created`, `contact_updated`, `contact_deleted`, `deal_stage_changed`, `interaction_logged` (6 partitions)
- [ ] Topics Booking (3) : `appointment_scheduled`, `appointment_cancelled`, `appointment_completed`
- [ ] Topics Comm (3) : `message_sent` (6 partitions), `message_delivered` (6 partitions), `message_failed`
- [ ] Topics Pay (4) : `transaction_initiated`, `transaction_completed`, `transaction_failed`, `refund_processed`
- [ ] Topics Insure (4) : `quote_generated`, `police_created`, `police_signed`, `avenant_created`
- [ ] Topics Repair (3) : `sinistre_declared` (6 partitions), `devis_approved`, `reparation_completed`
- [ ] Topic Audit (1) : `access_denied`
- [ ] Topics DLQ (2) : `dlq.comm`, `dlq.pay` (1 partition chacun, retention 30 jours)
- [ ] Total >= 30 topics
- [ ] Convention naming respectee partout : `insurtech.events.{vertical}.{entity}.{action}`

**Configuration partitions** :
- 3 partitions par defaut (parallelism modere)
- 6 partitions pour topics high-throughput : `auth.user_signed_in`, `crm.interaction_logged`, `comm.message_sent`, `comm.message_delivered`, `repair.sinistre_declared`
- 1 partition pour DLQ (ordering preservation pour replay)

**Fichiers crees / modifies** :
```
repo/infrastructure/docker/kafka/init-topics.sh    # ~100 lignes shell
```

**Notes implementation** :
- Replication factor = 1 en dev (1 broker), = 3 en prod (Sprint 35)
- `min.insync.replicas=1` en dev, =2 en prod
- Idempotent : `--if-not-exists` permet re-execution sans casser
- Le script attend que Kafka soit ready avant de creer les topics (boucle `kafka-topics.sh --list`)
- DLQ avec retention 30 jours (vs 7 standard) pour permettre replay tardif
- Pas d'auto-creation topics (`AUTO_CREATE_TOPICS_ENABLE=false`) pour eviter pollution accidentelle

**Criteres validation** :
- V1 (P0) : `docker logs skalean-kafka-init` montre "Created : ..." pour chaque topic
- V2 (P0) : `docker exec skalean-kafka kafka-topics.sh --bootstrap-server kafka:9092 --list | wc -l` >= 30
- V3 (P0) : Convention `insurtech.events.{vertical}.{entity}.{action}` respectee : `kafka-topics.sh --list | grep -v "^insurtech\."` retourne vide
- V4 (P0) : `kafka-topics.sh --describe --topic insurtech.events.repair.sinistre_declared` retourne 6 partitions
- V5 (P0) : Test producer/consumer : send + receive 1 message reussit en < 5s
- V6 (P0) : Compression lz4 active : `--describe --topic ... --include-config-properties` montre `compression.type=lz4`
- V7 (P1) : Re-execution `init-topics.sh` ne fail pas (idempotent via `--if-not-exists`)

---

## Tache 1.1.7 -- MinIO S3-Compatible Dev + Atlas Cloud Services Prod Ready

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 4h / Depend de 1.1.6

**But** : Fournir un wrapper TypeScript S3 utilisable a la fois sur MinIO local (dev) et Atlas Cloud Services Object Storage Benguerir (prod), avec abstraction provider via configuration.

**Contexte** : Data residency MA stricte (loi 09-08 CNDP) impose stockage des donnees clients au Maroc. AWS region me-south-1 (Bahrain) NON acceptee. Choix retenu : Atlas Cloud Services Object Storage Benguerir (cloud souverain MA -- DC1 Tier III + DC2 Tier IV -- ACAPS et Barid deja clients -- decision-008). MinIO local pour dev offre interface S3-compatible identique.

**Livrables checkables** :
- [ ] Init container MinIO cree 3 buckets dev : `skalean-insurtech-dev-docs`, `skalean-insurtech-dev-photos`, `skalean-insurtech-dev-archive`
- [ ] `repo/packages/shared-utils/src/s3/s3-client.ts` exposant `createS3Client()`, `initS3Client()`, `getS3Client()` singleton
- [ ] Interface `S3Config` typee : `{ endpoint?, region, accessKeyId, secretAccessKey, forcePathStyle? }`
- [ ] Configuration dev avec `forcePathStyle: true` (MinIO requirement)
- [ ] Configuration prod ready (Atlas Cloud Services = `forcePathStyle: false` -- compatibility S3 standard)
- [ ] Variables env documentees : `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_KMS_KEY_BASE`
- [ ] Documentation provider switching : `repo/docs/architecture/storage-provider.md`
- [ ] Bucket `skalean-insurtech-dev-photos` configure avec anonymous download (pour permettre URLs partagees publics aux assures sans auth)

**3 buckets et leurs usages** :

| Bucket | Usage | Lifecycle | Access |
|--------|-------|-----------|--------|
| `*-docs` | Documents (polices PDF, devis, factures, KYC) | Glacier apres 1 an, delete apres 10 ans + 1 jour | Auth required |
| `*-photos` | Photos sinistres + selfies KYC | Glacier apres 6 mois | Anonymous download (presigned URLs) |
| `*-archive` | Archive scellee documents signes (loi 43-20) | IMMUTABLE 10 ans, jamais delete | Auth required + audit log |

**Fichiers crees / modifies** :
```
repo/packages/shared-utils/src/s3/s3-client.ts         # ~80 lignes
repo/packages/shared-utils/src/s3/s3-client.spec.ts    # ~60 lignes (tests integration MinIO)
repo/docs/architecture/storage-provider.md             # ~40 lignes
```

**Notes implementation** :
- @aws-sdk/client-s3 v3.700+ supporte MinIO et Atlas Cloud Services avec meme API S3 standard
- `forcePathStyle: true` necessaire pour MinIO (URLs `http://endpoint/bucket/key` au lieu de `http://bucket.endpoint/key`)
- Region peut etre fictive en dev (`ma-bgr-1` simule Benguerir Atlas) -- MinIO ne valide pas
- Tenant isolation : 1 bucket PAR tenant en prod (Sprint 12 implementera) -- en Sprint 1, on cree juste 3 buckets dev partages
- KMS encryption configure prod uniquement (pas en dev MinIO)
- Anonymous download `*-photos` permet aux assures de voir leurs photos sinistres via URL signee sans authentification (UX mobile critique)

**Criteres validation** :
- V1 (P0) : `docker exec skalean-minio mc ls local/` liste 3 buckets
- V2 (P0) : `createS3Client()` factory retourne client S3Client valide
- V3 (P0) : `getS3Client()` singleton retourne meme instance entre appels
- V4 (P0) : Upload + download fichier test reussit
- V5 (P0) : Region `ma-bgr-1` (Benguerir Atlas) configuree
- V6 (P0) : `forcePathStyle: true` actif sur MinIO
- V7 (P1) : Documentation storage-provider.md couvre dev/prod + conformite CNDP
- V8 (P1) : Bucket `*-photos` accepte anonymous download (test : `curl http://localhost:9000/skalean-insurtech-dev-photos/test.jpg` apres upload)

---

## Tache 1.1.8 -- shared-config Env Loader Zod Runtime Validation

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 5h / Depend de 1.1.7

**But** : Empecher tout demarrage d'app/package si une variable d'environnement requise est manquante ou mal formatee, via validation Zod runtime au boot.

**Contexte** : Sans validation runtime, une variable manquante cause erreurs obscures runtime 3h apres demarrage. Avec Zod : crash immediat au boot avec message clair listant exactement les champs invalides. C'est la "early failure" critique en prod.

**Livrables checkables** :
- [ ] Package `repo/packages/shared-config/` avec `package.json`, `tsconfig.json`, `src/`
- [ ] `repo/packages/shared-config/src/env.schema.ts` definissant `EnvSchema` Zod exhaustif (~50 variables)
- [ ] `repo/packages/shared-config/src/loader.ts` exportant `loadEnv()` + `resetEnvCache()`
- [ ] `repo/packages/shared-config/src/index.ts` reexportant tout
- [ ] Validation Zod transforms : `Bool` (string/boolean -> boolean), coerce numbers, parse `KAFKA_BROKERS` comme array CSV
- [ ] Cache singleton apres premier `loadEnv()` (pour eviter re-parse a chaque appel)
- [ ] Sortie process.exit(1) avec stderr lisible si validation echoue (montrant exactement les champs invalides)
- [ ] Variables groupees par categorie : Runtime, Database, Redis, Kafka, S3, Auth, Email, WhatsApp, Skalean AI, Sentry, OTEL, CORS, Frontend
- [ ] `repo/.env.example` exhaustif avec toutes les variables documentees + valeurs dev par defaut (sans secrets reels)
- [ ] Tests Vitest : happy path, JWT_SECRET trop court echoue, KAFKA_BROKERS parse en array, cache singleton

**Categories variables couvertes** :
- **Runtime** : `NODE_ENV` (enum), `APP_VERSION`, `API_PORT`, `LOG_LEVEL`, `TZ` (default `Africa/Casablanca`)
- **Database** : `DATABASE_URL` (url required), `DATABASE_POOL_MIN/MAX`, `DATABASE_LOG`
- **Redis** : `REDIS_URL` (url required)
- **Kafka** : `KAFKA_BROKERS` (CSV -> array), `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`
- **S3** : `S3_ENDPOINT` (url optional), `S3_REGION`, `S3_ACCESS_KEY_ID` (min 8), `S3_SECRET_ACCESS_KEY` (min 20), `S3_FORCE_PATH_STYLE`
- **Auth** : `JWT_SECRET` (min 32), `JWT_REFRESH_SECRET` (min 32), `MFA_SECRET_ENCRYPTION_KEY` (min 32), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, params Argon2
- **Email** : `EMAIL_SMTP_*`, `EMAIL_FROM_*`
- **WhatsApp** : `WHATSAPP_*` (optional, sera config Sprint 9)
- **Skalean AI** : `SKALEAN_AI_BASE_URL` (default mock), `SKALEAN_AI_API_KEY`, `SKALEAN_AI_USE_MOCK` (default true)
- **Sentry, OTEL, CORS, Frontend** : optional

**Fichiers crees / modifies** :
```
repo/packages/shared-config/package.json           # ~20 lignes
repo/packages/shared-config/tsconfig.json          # standard heritage
repo/packages/shared-config/src/env.schema.ts      # ~120 lignes (Zod schema exhaustif)
repo/packages/shared-config/src/loader.ts          # ~50 lignes
repo/packages/shared-config/src/index.ts           # 5 lignes (reexports)
repo/packages/shared-config/src/loader.spec.ts     # ~80 lignes (4 tests)
repo/.env.example                                  # ~80 lignes documentees
```

**Notes implementation** :
- `dotenv` charge `.env` si existe, sinon utilise `process.env` directement
- `force: true` parametre `loadEnv` permet bypass cache (utile tests)
- Erreur formatee via `result.error.format()` -> JSON tree lisible
- `process.exit(1)` plutot que throw : empeche tout code aval de s'executer avec env invalide
- Bool transformer accepte `'true'`, `'false'`, et booleans (utile docker-compose qui passe des strings)
- KAFKA_BROKERS CSV parse permet config multi-brokers : `kafka1:9092,kafka2:9092,kafka3:9092`

**Criteres validation** :
- V1 (P0) : `loadEnv()` retourne objet typed `Env` sans erreur si .env valide
- V2 (P0) : `process.exit(1)` appele si JWT_SECRET < 32 chars
- V3 (P0) : Cache singleton : 2 appels `loadEnv()` retournent meme reference
- V4 (P0) : `KAFKA_BROKERS=k1:9092,k2:9092` parse en `['k1:9092', 'k2:9092']`
- V5 (P0) : `Bool` transformer : `'true'`, `'false'`, `true`, `false` tous fonctionnent
- V6 (P0) : Coerce number : `API_PORT='4000'` -> `4000`
- V7 (P0) : `.env.example` complete et a jour
- V8 (P1) : Erreur Zod retourne path precis : `JWT_SECRET: Required` (pas juste "validation failed")
- V9 (P1) : Tests Vitest 4+ scenarios passent

---

## Tache 1.1.9 -- database TypeORM 0.3 DataSource

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 6h / Depend de 1.1.8

**But** : Fournir un DataSource TypeORM 0.3 singleton avec configuration optimale (pool, timeouts, migrations) pret a etre utilise par les Sprint 2+ pour entities et migrations.

**Contexte** : TypeORM 0.3 retenu (vs Prisma 6) pour support natif RLS Postgres et pattern Subscriber (utilise Sprint 2 pour TenantIdInjector + AuditLogWriter automatiques). Sprint 1 livre juste DataSource + scripts CLI -- entities et migrations sont Sprint 2.

**Livrables checkables** :
- [ ] Package `repo/packages/database/` avec structure complete
- [ ] `repo/packages/database/src/data-source.ts` exposant `AppDataSource` singleton + `initDataSource()` + `closeDataSource()`
- [ ] Configuration DataSource : `synchronize: false` (jamais true, utiliser migrations), `logging` configurable via env
- [ ] Pool config : min/max via env, idleTimeoutMillis 30s, connectionTimeoutMillis 10s
- [ ] `statement_timeout: 60000` -- aucune query ne depasse 60s
- [ ] `application_name: skalean-insurtech-{NODE_ENV}` -- visible dans `pg_stat_activity` pour debug
- [ ] SSL active prod, desactive dev/test
- [ ] Paths entities/migrations/subscribers configures (vides en Sprint 1, peuples Sprint 2)
- [ ] Migration table customisee : `typeorm_migrations`
- [ ] Scripts CLI dans package.json : `migration:create`, `migration:generate`, `migration:run`, `migration:revert`, `migration:show`
- [ ] Tests integration : connexion reussit, query simple, helpers RLS accessibles, SET LOCAL fonctionne en transaction

**Fichiers crees / modifies** :
```
repo/packages/database/package.json              # ~25 lignes (scripts CLI typeorm + deps)
repo/packages/database/tsconfig.json             # avec experimentalDecorators true
repo/packages/database/src/data-source.ts        # ~70 lignes
repo/packages/database/src/index.ts              # exports
repo/packages/database/src/data-source.spec.ts   # ~80 lignes (4 tests integration)
```

**Notes implementation** :
- `synchronize: false` STRICT : meme en dev. Cela force discipline migrations (production-grade)
- `useDefineForClassFields: false` (override global) -- TypeORM decorators incompatibles avec ES2022 standard fields
- `experimentalDecorators: true` + `emitDecoratorMetadata: true` requis pour TypeORM 0.3
- Pool size : default min=2 max=20 -- ajuster prod selon charge (Sprint 35)
- `statement_timeout` ABSOLU : meme une query background ne peut pas saturer la DB
- Logger TypeORM `simple-console` -- en prod redirected vers Pino (Sprint 12)
- Tests integration utilisent `DATABASE_URL` test : `postgresql://skalean:skalean_test@localhost:5432/skalean_insurtech_test`

**Criteres validation** :
- V1 (P0) : `AppDataSource.isInitialized` true apres `initDataSource()`
- V2 (P0) : `AppDataSource.query('SELECT 1 AS one')` retourne `[{ one: 1 }]`
- V3 (P0) : Helpers RLS accessibles : `SELECT app_current_tenant()` retourne NULL
- V4 (P0) : SET LOCAL fonctionne en transaction : `BEGIN; SET LOCAL app.current_tenant_id = '...'; SELECT app_current_tenant(); COMMIT;` retourne UUID
- V5 (P0) : `synchronize: false` (verifier qu'aucune table auto-creee)
- V6 (P0) : `statement_timeout=60000` actif : query SLEEP > 60s rejetee
- V7 (P0) : `application_name=skalean-insurtech-development` visible dans `pg_stat_activity`
- V8 (P0) : `closeDataSource()` ferme proprement
- V9 (P0) : Scripts CLI fonctionnent : `pnpm migration:show -d ./src/data-source.ts` (vide initialement)
- V10 (P1) : SSL actif si `NODE_ENV=production`

---

## Tache 1.1.10 -- GitHub Actions CI

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 5h / Depend de 1.1.9

**But** : Pipeline CI declenche sur PR + push main executant lint, typecheck, build, tests, security audit, et verification no-emoji, avec services Postgres + Redis dans CI.

**Contexte** : CI verte = condition merge. Bloque les regressions tot. Cache pnpm + Turborepo accelere a chaque run successif.

**Livrables checkables** :
- [ ] `repo/.github/workflows/ci.yaml` avec 5 jobs : `lint-and-typecheck`, `build`, `test`, `audit`, `ci-summary`
- [ ] Trigger : push main + develop, PR vers main + develop
- [ ] Concurrency `cancel-in-progress: true` (evite jobs redondants)
- [ ] Cache pnpm store via `actions/setup-node` avec `cache: pnpm`
- [ ] Job `test` avec services Postgres 16.6 + Redis 7.4.1 healthchecks
- [ ] Init scripts Postgres executes en prelude (extensions + helpers RLS)
- [ ] Variables env tests injectees (DATABASE_URL pointing vers service postgres)
- [ ] Coverage upload Codecov optionnel (token secret, fail_ci_if_error: false)
- [ ] Job `audit` execute `pnpm audit --audit-level=high` continue-on-error
- [ ] Job `ci-summary` agrege resultats et fail si lint/build/test fail
- [ ] Verification no-emoji executee dans `lint-and-typecheck`
- [ ] `repo/.github/PULL_REQUEST_TEMPLATE.md` avec checklist (sprint/task ID, pas d'emoji, multi-tenant respecte, audit log si sensible, PR < 500 lignes)
- [ ] `repo/.github/CODEOWNERS` defini (pour future review automatique)

**Configuration jobs critique** :
- `lint-and-typecheck` : ubuntu-latest, timeout 10min, requires lint + typecheck pass + check-no-emoji
- `build` : depend de lint-and-typecheck, timeout 15min, NODE_ENV=production
- `test` : depend de lint-and-typecheck, timeout 20min, services Postgres+Redis, NODE_ENV=test
- `audit` : independant, timeout 5min, `--audit-level=high`, continue-on-error
- `ci-summary` : depend de tous, evalue results et fail si critique

**Fichiers crees / modifies** :
```
repo/.github/workflows/ci.yaml                     # ~140 lignes
repo/.github/PULL_REQUEST_TEMPLATE.md              # ~25 lignes
repo/.github/CODEOWNERS                            # ~15 lignes
```

**Notes implementation** :
- pnpm version pinned via `pnpm/action-setup@v4` avec `version: 9.15.0`
- Node version 22.11.0 doit matcher `.nvmrc` (verifie automatiquement par pnpm action setup)
- Postgres init scripts executes via `psql -f` apres healthcheck
- Variables tests : JWT_SECRET, JWT_REFRESH_SECRET, MFA_SECRET_ENCRYPTION_KEY tous min 32 chars (sinon Zod refuse boot)
- `frozen-lockfile` STRICT : tout PR sans `pnpm-lock.yaml` a jour echoue (force discipline)
- Audit non-bloquant : security alerts visible mais ne bloque pas merge (decision pragmatique)
- CODEOWNERS pointe vers teams (`@skalean/security-team`, etc.) -- a adapter selon orga reelle

**Criteres validation** :
- V1 (P0) : Workflow CI declenche sur PR ouverte
- V2 (P0) : 5 jobs s'executent (visible dans Actions tab)
- V3 (P0) : Lint + typecheck reussissent (vide initialement)
- V4 (P0) : Build reussit
- V5 (P0) : Tests reussissent (avec services Postgres + Redis)
- V6 (P0) : Audit non-bloquant (continue-on-error)
- V7 (P0) : ci-summary fail si un job critique fail
- V8 (P0) : check-no-emoji bloque PR si emoji detectee
- V9 (P0) : Cache pnpm store actif (run #2 plus rapide que run #1)
- V10 (P1) : PULL_REQUEST_TEMPLATE.md affiche dans PRs nouvelles
- V11 (P1) : CODEOWNERS auto-assigne reviewers

---

## Tache 1.1.11 -- Vitest 2.1 + Playwright 1.49

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 4h / Depend de 1.1.10

**But** : Configurer Vitest pour tests unitaires/integration et Playwright pour tests E2E avec configurations racine standardisees.

**Contexte** : Vitest 2.1 vs Jest : ESM-natif, ~5x plus rapide, API quasi-identique (drop-in replacement). Playwright 1.49 multi-browser + API testing + mobile emulation. Configurations racine pour standardisation entre packages/apps.

**Livrables checkables** :
- [ ] `repo/vitest.config.ts` (racine) avec environment node, globals true, setupFiles, coverage v8
- [ ] `repo/test/setup.ts` charge `.env.test` (fallback `.env`), `NODE_ENV=test`
- [ ] Coverage thresholds : lines 70%, functions 70%, branches 65%, statements 70%
- [ ] Path aliases configures : `@insurtech/*` -> `packages/*/src`
- [ ] Test pool `forks` (isolation entre tests)
- [ ] `repo/playwright.config.ts` (racine) avec 3 projects : `api`, `chromium`, `mobile-safari`
- [ ] Locale `fr-MA` + timezoneId `Africa/Casablanca` par defaut
- [ ] Reporter github + html en CI, html + list en local
- [ ] webServer config dev only (start API automatiquement avant tests)
- [ ] Trace on-first-retry, screenshot only-on-failure, video retain-on-failure
- [ ] forbidOnly true en CI (interdit `test.only` commit)
- [ ] retries 2 en CI, 0 en local
- [ ] Workers 1 en CI (deterministe), undefined en local (parallele)

**Fichiers crees / modifies** :
```
repo/vitest.config.ts                  # ~50 lignes
repo/test/setup.ts                     # ~10 lignes
repo/playwright.config.ts              # ~60 lignes
```

**Notes implementation** :
- Vitest setupFiles importe `reflect-metadata` (requis TypeORM 0.3)
- Coverage `provider: 'v8'` (natif Node) plutot que istanbul (plus rapide)
- Playwright `webServer.reuseExistingServer: true` evite restart si dev deja lance
- Locale fr-MA force formats date/heure francais marocains (separateur, etc.)
- `timezoneId: 'Africa/Casablanca'` important pour tests qui manipulent dates (offset GMT+1 hiver, GMT+0 ramadan -- subtilites MA)
- `pool: 'forks'` evite probleme de modules globaux entre tests (ex: TypeORM DataSource)
- Tests E2E API testent endpoints HTTP, tests E2E web testent UI

**Criteres validation** :
- V1 (P0) : `pnpm test` execute Vitest (vide en Sprint 1)
- V2 (P0) : `pnpm test:e2e` execute Playwright (vide en Sprint 1)
- V3 (P0) : Coverage threshold 70% applique (test : ajouter code non-couvert -> CI fail)
- V4 (P0) : Path aliases `@insurtech/*` resolus dans tests
- V5 (P0) : Locale fr-MA + TZ Casablanca par defaut
- V6 (P0) : 3 projects Playwright accessibles : api, chromium, mobile-safari
- V7 (P0) : forbidOnly true en CI rejette `.only`
- V8 (P1) : reuseExistingServer permet dev fluide

---

## Tache 1.1.12 -- Pino Logger + OpenTelemetry SDK + Sentry Ready

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 5h / Depend de 1.1.11

**But** : Mettre en place observability fondations : logger structured Pino avec PII redaction, OpenTelemetry SDK pour traces, et integration Sentry (configurable).

**Contexte** : Logging non-structured (`console.log`) est ingerable a l'echelle. Pino emet JSON structured indexable (Loki, Elasticsearch). PII redaction critique : aucun password/CIN/email/token jamais loggue meme accidentellement. OTEL SDK auto-instrumente HTTP/DB/Redis pour traces distribuees.

**Livrables checkables** :
- [ ] `repo/packages/shared-utils/src/logger/logger.ts` exposant `logger` (pino instance) + `createChildLogger()`
- [ ] PII redaction paths : `*.password`, `*.passwordHash`, `*.cin`, `*.phone`, `*.phoneNumber`, `*.email`, `*.refreshToken`, `*.accessToken`, `*.apiKey`, `*.body.password`, `*.headers.authorization`
- [ ] Censor `[REDACTED]` (pas suppression, traceabilite preservee)
- [ ] Base fields auto-injectes : service, env, version
- [ ] Pretty printing dev only (`pino-pretty`) -- prod = JSON brut
- [ ] Level configurable via `LOG_LEVEL` env (fatal, error, warn, info, debug, trace)
- [ ] Timestamp ISO 8601 (`pino.stdTimeFunctions.isoTime`)
- [ ] `repo/packages/shared-utils/src/telemetry/otel.ts` exposant `startTelemetry()` + `shutdownTelemetry()`
- [ ] Resource attributes : service.name, service.version, deployment.environment
- [ ] Auto-instrumentations Node : HTTP, fetch, Postgres, Redis (via `@opentelemetry/auto-instrumentations-node`)
- [ ] Filesystem instrumentation desactivee (`fs: false`) -- trop verbeux
- [ ] OTLP exporter optionnel via `OTEL_EXPORTER_OTLP_ENDPOINT` env
- [ ] Sentry SDK installe + configurable via `SENTRY_DSN` (initialise Sprint 3 dans API)

**Fichiers crees / modifies** :
```
repo/packages/shared-utils/src/logger/logger.ts        # ~60 lignes
repo/packages/shared-utils/src/telemetry/otel.ts       # ~50 lignes
repo/packages/shared-utils/src/index.ts                # reexports
```

**Notes implementation** :
- Pino base fields ajoute service+env+version dans CHAQUE log (correlation facile)
- `formatters.level: (label) => ({ level: label })` -- emet `"level": "info"` plutot que numerique
- Pretty printing via transport (worker thread) pour ne pas bloquer event loop
- OTEL SDK doit demarrer AVANT toute autre instrumentation (premier import dans main.ts API)
- Sentry SDK initialisable mais pas initialise (decision Sprint 3 selon `SENTRY_DSN` env)
- Auto-instrumentations couvrent ~95% des cas : HTTP requests, DB queries, Redis commands, Kafka producer/consumer (Sprint 2)

**Criteres validation** :
- V1 (P0) : `logger.info({ password: 'secret', cin: 'A123' }, 'login')` emet log avec password/cin = `[REDACTED]`
- V2 (P0) : Format JSON valide (parsable par jq)
- V3 (P0) : Pretty printing si NODE_ENV=development
- V4 (P0) : `LOG_LEVEL=error` filtre logs info/debug
- V5 (P0) : Base fields service+env+version presents dans chaque log
- V6 (P0) : `startTelemetry()` initialise SDK sans erreur (meme sans OTLP endpoint)
- V7 (P0) : Auto-instrumentations enregistrees : verifier `OTEL_DEBUG=true` montre instrumentations chargees
- V8 (P0) : `shutdownTelemetry()` flush traces avant exit
- V9 (P1) : `pino.stdTimeFunctions.isoTime` -- timestamps ISO 8601

---

## Tache 1.1.13 -- Init des 16+ Shared Packages Stubs + 8 Apps Stubs

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 6h / Depend de 1.1.12

**But** : Creer les 24+ packages.json minimaux (`package.json` + `tsconfig.json` + `src/index.ts`) pour permettre `pnpm install` complet et workspace links resolvables.

**Contexte** : Le code metier viendra Sprint 2+. Sprint 1 livre juste les stubs pour eviter erreurs `pnpm install` et permettre aux apps stubs de declarer dependencies cross-package via `workspace:*`.

**Livrables checkables** :
- [ ] 21 packages stubs : `auth`, `database`, `crm`, `booking`, `comm`, `docs`, `signature`, `pay`, `books`, `compliance`, `analytics`, `insure`, `repair`, `skalean-ai-client`, `shared-config` (deja Tache 1.1.8), `shared-types`, `shared-events`, `shared-utils` (deja partiel Taches 1.1.5/1.1.7/1.1.12), `shared-ui`, `shared-pwa`, `shared-maps`
- [ ] 8 apps stubs : `api`, `web-broker`, `web-garage`, `web-garage-mobile`, `web-insurtech-admin`, `web-customer-portal`, `web-assure-portal`, `web-assure-mobile`
- [ ] Chaque package : `package.json` (name `@insurtech/{name}`, scripts build/typecheck/test/lint/clean, deps depuis workspace), `tsconfig.json` (extends base), `src/index.ts` (export VERSION minimal)
- [ ] Chaque app : `package.json` (name `@insurtech/{name}`, scripts dev/build/start/test placeholders), deps `@insurtech/*` workspace
- [ ] Ports apps documentes : api 4000, broker 3001, garage 3002, garage-mobile 3003, admin 3000, customer-portal 3004, assure-portal 3005, assure-mobile 3006
- [ ] Script automatique `repo/infrastructure/scripts/init-package-stubs.sh` capable de regenerer les stubs si besoin
- [ ] `pnpm install` reussit, workspace links symbolic crees
- [ ] `pnpm typecheck` reussit (tous packages)
- [ ] `pnpm lint` reussit (tous packages)

**Structure d'un package stub** (pattern repete) :

`packages/{name}/package.json` minimal (~15 lignes) declarant :
- name, version 0.1.0, private true
- main `dist/index.js`, types `dist/index.d.ts`, exports `.`
- scripts : `build` (tsc), `typecheck` (tsc --noEmit), `test` (vitest run), `lint` (biome check src), `clean` (rm dist .turbo)
- dependencies : `@insurtech/database`, `@insurtech/shared-config`, `@insurtech/shared-utils` (selon package)
- devDependencies : `@types/node`, `typescript`, `vitest`

`packages/{name}/tsconfig.json` (~12 lignes) :
- extends `../../tsconfig.base.json`
- compilerOptions : outDir `./dist`, rootDir `./src`
- include : `src/**/*`
- exclude : node_modules, dist, **/*.spec.ts

`packages/{name}/src/index.ts` minimal :
```typescript
export const VERSION = '0.1.0';
// Sprint X will add real exports
```

**Fichiers crees / modifies** :
```
repo/packages/auth/package.json + tsconfig.json + src/index.ts
repo/packages/{database,crm,booking,...}/package.json + tsconfig.json + src/index.ts (~21 packages)
repo/apps/api/package.json + tsconfig.json + src/main.ts placeholder
repo/apps/web-broker/package.json + tsconfig.json + minimal next config (8 apps)
repo/infrastructure/scripts/init-package-stubs.sh         # ~80 lignes
```

**Notes implementation** :
- Workspace deps `workspace:*` resolu par pnpm vers symlink local (pas de version pinning entre workspaces)
- Apps Next.js : `package.json` minimal + `next.config.mjs` placeholder. Setup complet Next.js sera Sprint 4
- App API : `package.json` minimal + `src/main.ts` placeholder. Setup NestJS complet sera Sprint 3
- Script `init-package-stubs.sh` utile pour regenerer si pollution accidentelle (idempotent)
- VERSION constant par package permet introspection runtime : `@insurtech/auth.VERSION` -> `0.1.0`

**Criteres validation** :
- V1 (P0) : `ls packages/ | wc -l` retourne 21 (16 metier + 5 shared)
- V2 (P0) : `ls apps/ | wc -l` retourne 8
- V3 (P0) : Chaque package a package.json + tsconfig.json + src/index.ts
- V4 (P0) : `pnpm install` reussit, links workspace crees : `ls -la node_modules/@insurtech/`
- V5 (P0) : `pnpm typecheck` reussit sur tous packages
- V6 (P0) : `pnpm lint` reussit sur tous packages
- V7 (P0) : `pnpm -r build` reussit (peut etre vide pour stubs)
- V8 (P1) : Script init-package-stubs.sh idempotent (re-execution ne casse rien)

---

## Tache 1.1.14 -- Husky + commitlint + lint-staged + check-no-emoji

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 4h / Depend de 1.1.13

**But** : Bloquer les commits non-conformes via 3 hooks Git : pre-commit (lint-staged + check-no-emoji), commit-msg (commitlint conventional), pre-push (typecheck).

**Contexte** : Discipline imposee au plus tot = qualite preservee. commitlint + conventional commits permettent generation auto changelogs (Sprint 35). check-no-emoji policy specifique skalean-insurtech (decision 006).

**Livrables checkables** :
- [ ] `repo/.husky/pre-commit` execute `check-no-emoji.sh` puis `pnpm lint-staged`
- [ ] `repo/.husky/commit-msg` execute `pnpm commitlint --edit $1`
- [ ] `repo/.husky/pre-push` execute `pnpm typecheck`
- [ ] `repo/commitlint.config.cjs` avec config conventional + custom rules : `type-enum` (feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert), `subject-max-length: 100`, `body-max-line-length: 200`, `header-max-length: 120`
- [ ] `repo/.lintstagedrc.cjs` avec `*.{ts,tsx,js,jsx,json,md,yaml,yml}` -> Biome check --write
- [ ] `repo/infrastructure/scripts/check-no-emoji.sh` script bash detectant emojis Unicode (ranges 1F300-1F9FF, 2600-26FF, etc.) avec exclude dirs (node_modules, dist, .git, etc.)
- [ ] Script `prepare` dans package.json racine installe Husky automatiquement apres `pnpm install`
- [ ] Hook bypass possible avec `--no-verify` (documente dans CONTRIBUTING.md mais a eviter)
- [ ] CI execute aussi check-no-emoji (defense en profondeur)

**Pattern critique : check-no-emoji.sh**

Le script utilise `grep -rPI` avec regex Unicode couvrant les ranges emoji :
- `1F300-1F5FF` : Misc Symbols & Pictographs
- `1F600-1F64F` : Emoticons
- `1F680-1F6FF` : Transport & Map
- `1F900-1F9FF` : Supplemental Symbols
- `2600-26FF` : Misc Symbols
- `2700-27BF` : Dingbats
- `1F1E6-1F1FF` : Regional Indicator (drapeaux)

Si trouve : output liste des fichiers + exit 1.

**Fichiers crees / modifies** :
```
repo/.husky/pre-commit                                  # ~5 lignes
repo/.husky/commit-msg                                  # ~5 lignes
repo/.husky/pre-push                                    # ~5 lignes
repo/commitlint.config.cjs                              # ~20 lignes
repo/.lintstagedrc.cjs                                  # ~5 lignes
repo/infrastructure/scripts/check-no-emoji.sh           # ~40 lignes
repo/package.json                                       # add `prepare: husky` script
```

**Notes implementation** :
- Husky 9 simplifie syntax (pas de `_/husky.sh` import necessaire en v9)
- `prepare` script auto-installe les hooks apres `pnpm install`
- check-no-emoji.sh utilise `grep -P` (Perl regex) pour ranges Unicode -- requires GNU grep
- Lint-staged ne run que sur fichiers staged (rapide meme sur gros repo)
- Pre-push typecheck redondant avec CI mais permet feedback local rapide (pas attendre 5min CI)
- commitlint type-enum interdit types custom (pas `wip:`, `tmp:`) -- discipline

**Criteres validation** :
- V1 (P0) : `git commit -m "test"` echoue (commitlint : pas de type)
- V2 (P0) : `git commit -m "feat: test"` reussit
- V3 (P0) : `git commit -m "test test"` echoue
- V4 (P0) : Commit avec emoji dans fichier modifie echoue (check-no-emoji)
- V5 (P0) : Commit sans erreur lint reussit, commit avec erreur lint echoue
- V6 (P0) : `git push` echoue si typecheck echoue
- V7 (P0) : `pnpm install` cree `.husky/_/` automatiquement (via prepare)
- V8 (P0) : Subject > 100 chars rejete par commitlint
- V9 (P1) : Bypass `--no-verify` fonctionne (mais decourage)
- V10 (P1) : check-no-emoji.sh exclude correctement node_modules + .git

---

## Tache 1.1.15 -- Documentation Architecture (6 ADR + README + CLAUDE.md + CONTRIBUTING.md)

**Metadonnees** : Phase 1 / Sprint 1 / P0 / 6h / Depend de 1.1.14

**But** : Etablir la documentation architecture fondatrice : 6 Architecture Decision Records, README projet, CLAUDE.md guide pour AI assistants, CONTRIBUTING.md workflow.

**Contexte** : Documentation contextuelle au moment des decisions evite re-debat 6 mois plus tard. ADR format reconnu industrie. CLAUDE.md crucial pour Cowork (et toute IA assistante future) : impose conventions critiques (no-emoji, multi-tenant, conventional commits).

**Livrables checkables** :
- [ ] `repo/README.md` avec : description courte, stack overview, quick start (5 commandes), liens vers docs
- [ ] `repo/CLAUDE.md` avec : conventions critiques (no-emoji, TypeScript strict, multi-tenant, secrets, conventional commits), structure projet, checklist avant PR, lien ADRs
- [ ] `repo/CONTRIBUTING.md` avec : workflow branches, commit conventions, PR process, standards code, tasks workflow
- [ ] `repo/LICENSE` (proprietary tag, format custom Skalean SARL)
- [ ] `repo/docs/architecture/README.md` index ADR
- [ ] `repo/docs/architecture/ADR-001-monorepo-structure.md` (Statut, Contexte, Decision, Consequences) -- choix monorepo pnpm + Turborepo
- [ ] `repo/docs/architecture/ADR-002-multi-tenant-3-levels.md` -- Platform / Customer Tenant / Assure
- [ ] `repo/docs/architecture/ADR-003-typeorm-vs-prisma.md` -- TypeORM 0.3 retenu pour RLS support
- [ ] `repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md` -- Kafka KRaft retenu pour event sourcing
- [ ] `repo/docs/architecture/ADR-005-skalean-ai-frontier.md` -- skalean-insurtech consomme Skalean AI (frontiere stricte)
- [ ] `repo/docs/architecture/ADR-006-no-emoji-policy.md` -- pas d'emoji dans code (decision style + accessibilite)
- [ ] `repo/docs/architecture/system-overview.md` schema haut niveau architecture (9 apps v2.2 + 21 packages + services externes incl. Atlas Cloud Services)

**Note ADR additionnels v2.2** : Les ADR-007 (AI defere), ADR-008 (data residency Atlas Cloud Services), ADR-009 (signature 43-20), ADR-010 (insure connecteurs defere) sont **livres aux sprints respectifs ou la decision est implementee** (vs all-at-once Sprint 1) :
- ADR-007 : Sprint 20 (B-20 -- IA Estimation Mock factory pattern)
- ADR-008 : Sprint 6 (B-06 -- Multi-tenant + procedure purge CNDP)
- ADR-009 : Sprint 10 (B-10 -- Signature Barid eSign)
- ADR-010 : Sprint 32 (B-32 -- Insure Connecteurs reactivation)

Cependant les **decisions strategiques** correspondantes (`00-pilotage/decisions/007-010`) sont **deja formalisees** -- voir Phase A documentation.

**Format ADR standard** :
```
# ADR-NNN : Titre

## Statut
Accepte / Propose / Rejete / Deprecie / Superseded by ADR-XXX

## Contexte
Probleme a resoudre, contraintes, alternatives considerees.

## Decision
Choix retenu et justification.

## Consequences
Impact positif (+) et negatif (-) du choix.
```

**Contenu CLAUDE.md (sections cles)** :
1. **Conventions critiques** : no-emoji absolute, TypeScript strict (pas `any`, pas `// @ts-ignore`), multi-tenant 3 niveaux (toute table avec donnees client requiert tenant_id + RLS), conventional commits
2. **Structure projet** : 8 apps + 16+ packages + infrastructure + docs, mapping kebab-case-titre -> Cowork-friendly
3. **Avant chaque PR** : pnpm typecheck (0 erreur), pnpm lint (0 erreur), pnpm test (passants), pnpm check-no-emoji, PR description avec sprint/task ID
4. **Architecture decisions** : lien vers `docs/architecture/ADR-*.md`
5. **Workflow Cowork** : Cowork lit meta-prompts dans `00-pilotage/meta-prompts/`, genere prompts taches dans `00-pilotage/prompts-taches/`, modifie code dans `repo/`. JAMAIS modifier `00-pilotage/` (sauf prompts-taches/)

**Fichiers crees / modifies** :
```
repo/README.md                                          # ~80 lignes
repo/CLAUDE.md                                          # ~150 lignes
repo/CONTRIBUTING.md                                    # ~100 lignes
repo/LICENSE                                            # ~25 lignes
repo/docs/architecture/README.md                        # ~30 lignes (index)
repo/docs/architecture/ADR-001-monorepo-structure.md    # ~40 lignes
repo/docs/architecture/ADR-002-multi-tenant-3-levels.md # ~50 lignes
repo/docs/architecture/ADR-003-typeorm-vs-prisma.md     # ~45 lignes
repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md     # ~40 lignes
repo/docs/architecture/ADR-005-skalean-ai-frontier.md   # ~50 lignes
repo/docs/architecture/ADR-006-no-emoji-policy.md       # ~30 lignes
repo/docs/architecture/system-overview.md               # ~80 lignes (avec ASCII diagram)
```

**Notes implementation** :
- Quick start README testable : 5 commandes dans cet ordre exact (clone, install, docker:up, verify-env, dev) doivent reussir sur machine vierge
- ADR datees + statut : permet historique decisions
- ADR-003 (TypeORM vs Prisma) doit expliquer pourquoi TypeORM malgre que Prisma soit plus moderne -- raison cle = RLS Postgres native
- ADR-005 (Skalean AI frontier) cle pour comprendre AI-3 strategy : skalean-insurtech NE contient AUCUN modele AI
- ADR-006 (no-emoji) decision controversee, doit etre bien justifiee : accessibilite screen readers + lisibilite code reviews + uniformite cross-locales
- system-overview avec ASCII art (pas de mermaid -- depend de viewer rendering)
- LICENSE proprietary : custom mais minimal

**Criteres validation** :
- V1 (P0) : `repo/README.md` quick start fonctionne sur machine vierge
- V2 (P0) : `repo/CLAUDE.md` lisible, couvre les 5 sections (conventions, structure, pre-PR, ADR, Cowork workflow)
- V3 (P0) : `repo/CONTRIBUTING.md` couvre branches, commits, PR, standards
- V4 (P0) : 6 ADR ecrites (001 a 006) avec format standard
- V5 (P0) : `system-overview.md` avec diagram ASCII visible
- V6 (P0) : ADR index `docs/architecture/README.md` liste les 6 ADR
- V7 (P0) : Quick start testable : `pnpm install && pnpm docker:up && pnpm verify-env && pnpm dev` reussit
- V8 (P1) : LICENSE proprietary tag valide (rejette open source par defaut)
- V9 (P1) : ADR-006 (no-emoji) justifie clairement la decision

---

## Sortie du Sprint 1

A la fin de l'execution des 15 taches, le repo `repo/` est dans cet etat :

```
repo/
├── package.json + scripts orchestres
├── pnpm-workspace.yaml + turbo.json + tsconfig.base.json + biome.json
├── apps/{8 apps stubs}
├── packages/{21 packages stubs avec shared-config et shared-utils partiellement implementes}
├── infrastructure/docker/{compose.dev.yaml + 7 services + init scripts Postgres/Kafka}
├── infrastructure/scripts/{bootstrap.sh + verify-env.ts + check-no-emoji.sh + init-package-stubs.sh}
├── .github/workflows/ci.yaml + PR template + CODEOWNERS
├── .husky/{pre-commit + commit-msg + pre-push}
├── docs/architecture/{README + 6 ADR + system-overview}
├── README.md + CLAUDE.md + CONTRIBUTING.md + LICENSE
└── .env.example + .gitignore + .nvmrc + .npmrc + .editorconfig
```

**Validations cle Sprint 1** :
- `pnpm install` reussit en < 90s
- `pnpm docker:up` demarre 7 services en < 60s
- `pnpm typecheck` 0 erreur
- `pnpm lint` 0 erreur (Biome)
- `pnpm test` passe (vide mais valide)
- CI verte sur PR + main
- Helpers RLS multi-tenant 3 niveaux operationnels (helpers SQL Postgres)
- 30 topics Kafka existants
- 3 buckets MinIO crees
- Aucune emoji dans le repo

**Sprint 2 demarre avec** :
- Infrastructure stable
- DataSource TypeORM pret (entities et migrations a ajouter)
- shared-events pret a recevoir Topics enum + schemas Zod events
- Tests frameworks operationnels

---

## Specifications Format Tache (pour Generation par Cowork)

Quand Cowork genere les fichiers `task-1.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-01-bootstrap/`, chaque tache doit suivre la **structure de ce meta-prompt** :
- Metadonnees (Phase / Sprint / Priorite / Effort / Dependances)
- But (1 phrase concise)
- Contexte (50-80 mots si necessaire, sinon omis)
- Livrables checkables (10-25 cases a cocher)
- Fichiers crees / modifies (liste avec lignes approximatives)
- Notes implementation (pieges, choix non-evidents) -- optionnel
- Criteres validation (V1-V10 avec priorites P0/P1/P2)

**Pattern code inline** : uniquement pour patterns non-evidents specifiques skalean-insurtech (helpers SQL RLS, schemas Zod env critical fields, etc.). Le reste du code = description des livrables.

**Reference** : Cowork peut s'appuyer sur `00-pilotage/documentation/1-stack-technique.yaml` pour versions exactes et `00-pilotage/documentation/2-variables-environnement.env` pour catalog ENV.

---

**Fin du meta-prompt B-01 v2.2 format Option B.**
