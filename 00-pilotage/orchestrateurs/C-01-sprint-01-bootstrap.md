# ORCHESTRATEUR SPRINT 1 -- Phase 1 / Sprint 1 : Bootstrap Infrastructure
# 15 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 1 / 35 (cumul) -- Sprint 1 dans Phase 1
**Reference meta-prompt** : `B-01-sprint-01-bootstrap.md`
**Reference verification** : `V-01-sprint-01-verification.md`
**Numerotation taches** : 1.1.1 a 1.1.15
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : Infrastructure complete demarre + structure 9 apps

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 15 taches** du Sprint 1 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-01** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-01 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 1

Sprint 1 (1.1) -- Bootstrap Infrastructure. Voir B-01-sprint-01-bootstrap.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/
  task-1.1.1-prompt.md       # Initialisation Monorepo pnpm + Turborepo + Structure
  task-1.1.2-prompt.md       # TypeScript Strict + Biome Unifie
  task-1.1.3-prompt.md       # Docker Compose Dev (7 Services)
  task-1.1.4-prompt.md       # PostgreSQL 16 + Extensions + Helpers RLS Multi-Tenant 3 Niveaux
  task-1.1.5-prompt.md       # Redis 7.4 + Strategy 6 DBs
  task-1.1.6-prompt.md       # Kafka 3.7 KRaft + Topic Catalog (30 Topics)
  task-1.1.7-prompt.md       # MinIO S3-Compatible Dev + Atlas Cloud Services Prod Ready
  task-1.1.8-prompt.md       # shared-config Env Loader Zod Runtime Validation
  task-1.1.9-prompt.md       # database TypeORM 0.3 DataSource
  task-1.1.10-prompt.md       # GitHub Actions CI
  task-1.1.11-prompt.md       # Vitest 2.1 + Playwright 1.49
  task-1.1.12-prompt.md       # Pino Logger + OpenTelemetry SDK + Sentry Ready
  task-1.1.13-prompt.md       # Init des 16+ Shared Packages Stubs + 8 Apps Stubs
  task-1.1.14-prompt.md       # Husky + commitlint + lint-staged + check-no-emoji
  task-1.1.15-prompt.md       # Documentation Architecture (6 ADR + README + CLAUDE.md + CONTRIBUTING.md)
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-01-sprint-01-verification.md
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
4. La verification finale V-01 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 15 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-01-sprint-01-verification.md
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

### Position du Sprint 1 dans la Phase 1

Sprint 1 (1.1) -- **Bootstrap Infrastructure**.

Voir `B-01-sprint-01-bootstrap.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

### Apport metier de ce sprint

Infrastructure complete demarre + structure 9 apps

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-01 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 15 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-01, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-01.

---

### Tache 1 / 15 : Initialisation Monorepo pnpm + Turborepo + Structure

**Metadonnees** : P0 | 6h | Depend de : Aucune dependance

**But** : Etablir la structure monorepo complete (8 apps + 16+ packages) avec pnpm 9 workspaces et Turborepo 2.3 task runner.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.1-prompt.md
```

**Actions principales attendues** :
- `repo/package.json` racine avec scripts orchestres (dev, build, lint, typecheck, test, docker:up/down/reset, bootstrap)
- `repo/pnpm-workspace.yaml` declarant `apps/*` et `packages/*`
- `repo/turbo.json` avec pipeline (build dependsOn `^build`, dev `cache: false`, test avec `env` declare)
- `repo/.npmrc` avec `auto-install-peers=true`, `save-exact=true`, `engine-strict=true`, `link-workspace-packages=deep`
- `repo/.nvmrc` contenant `22.11.0`
- `repo/.gitignore` complet (node_modules, .env, .turbo, dist, .next, coverage, test-results, playwright-report, docker-data, *.tsbuildinfo)

**Fichiers cibles principaux** :
  - `repo/package.json`
  - `repo/pnpm-workspace.yaml`
  - `repo/turbo.json`
  - `repo/.npmrc`
  - `repo/.nvmrc`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm install --frozen-lockfile` reussit en < 90s sur machine 8 GB RAM
  - V2 (P0) : `turbo --version` >= 2.3.0
  - V3 (P0) : `ls apps/ | wc -l` retourne 8

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
git commit -m "feat(sprint-01): initialisation monorepo pnpm + turborepo + structure

Task: 1.1.1
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.1"
```

---

### Tache 2 / 15 : TypeScript Strict + Biome Unifie

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.1.1

**But** : Configurer TypeScript 5.7 en strict mode avec 8 flags, et Biome 1.9 pour lint + format unifie remplacant ESLint + Prettier.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.2-prompt.md
```

**Actions principales attendues** :
- `repo/tsconfig.base.json` avec compilerOptions strict + path mapping `@insurtech/*` -> `packages/*/src`
- `repo/tsconfig.json` racine avec `noEmit: true` (pour scripts infrastructure)
- `repo/biome.json` avec rules linter strictes (recommended + custom rules)
- `repo/.vscode/settings.json` avec Biome formatter par defaut + organize imports on save
- `repo/.vscode/extensions.json` recommandant Biome + Docker + YAML + Tailwind
- Formatter config : single quotes, trailing commas all, semicolons always, line width 100, 2 spaces

**Fichiers cibles principaux** :
  - `repo/tsconfig.base.json`
  - `repo/tsconfig.json`
  - `repo/biome.json`
  - `repo/.vscode/settings.json`
  - `repo/.vscode/extensions.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm typecheck` reussit
  - V2 (P0) : `pnpm lint` reussit (0 erreur Biome)
  - V3 (P0) : `pnpm format --check .` propre

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
git commit -m "feat(sprint-01): typescript strict + biome unifie

Task: 1.1.2
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.2"
```

---

### Tache 3 / 15 : Docker Compose Dev (7 Services)

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.1.2

**But** : Demarrer la stack dev complete (Postgres, Redis, Kafka KRaft, Kafka UI, MinIO, n8n, Mailhog) via une seule commande `pnpm docker:up`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.3-prompt.md
```

**Actions principales attendues** :
- `repo/infrastructure/docker/docker-compose.dev.yaml` orchestrant 7 services + 2 init containers
- `repo/infrastructure/docker/docker-compose.test.yaml` pour CI (Postgres + Redis + Kafka uniquement, pas de volumes persistents)
- Service `postgres:16.6-alpine` avec extensions montees via init scripts
- Service `redis:7.4.1-alpine` avec password actif et redis.conf custom
- Service `kafka:3.7.1` (Bitnami) en mode KRaft (PROCESS_ROLES=controller,broker, pas de Zookeeper)
- Service `kafka-ui:v0.7.2` (Provectus) accessible :8080

**Fichiers cibles principaux** :
  - `repo/infrastructure/docker/docker-compose.dev.yaml`
  - `repo/infrastructure/docker/docker-compose.test.yaml`
  - `repo/infrastructure/docker/redis/redis.conf`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm docker:up` reussit
  - V2 (P0) : `docker ps | grep skalean | wc -l` >= 7 (au moins 7 containers)
  - V3 (P0) : Tous services healthy en < 60s : `docker compose ps --format json | jq '.Health'`

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
git commit -m "feat(sprint-01): docker compose dev (7 services)

Task: 1.1.3
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.3"
```

---

### Tache 4 / 15 : PostgreSQL 16 + Extensions + Helpers RLS Multi-Tenant 3 Niveaux

**Metadonnees** : P0 | 7h | Depend de : Depend de 1.1.3

**But** : Configurer Postgres 16 avec 5 extensions critiques et installer 6 helpers SQL pour multi-tenant 3 niveaux applique automatiquement par RLS dans les sprints suivants.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.4-prompt.md
```

**Actions principales attendues** :
- Init script `repo/infrastructure/docker/postgres/init.sh` (entry point)
- SQL `repo/infrastructure/docker/postgres/001-init-extensions.sql` installant 5 extensions
- SQL `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql` definissant 6 helpers
- SQL `repo/infrastructure/docker/postgres/003-init-databases.sql` creant schema n8n + database test
- Extension `pgcrypto` installee (pour `gen_random_uuid()` UUID v4 cryptographique)
- Extension `pg_trgm` installee (full-text search trigram CRM contacts -- Sprint 8)

**Fichiers cibles principaux** :
  - `repo/infrastructure/docker/postgres/init.sh`
  - `repo/infrastructure/docker/postgres/001-init-extensions.sql`
  - `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql`
  - `repo/infrastructure/docker/postgres/003-init-databases.sql`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "SELECT extname FROM pg_extension"` liste : btree_gist, citext, pg_trgm, pgcrypto, plpgsql, unaccent
  - V2 (P0) : Les 6 helpers sont definis : `\df app_*` dans psql
  - V3 (P0) : `SELECT app_current_tenant()` retourne NULL hors session SET LOCAL

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
git commit -m "feat(sprint-01): postgresql 16 + extensions + helpers rls multi-tenant 3 niveaux

Task: 1.1.4
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.4"
```

---

### Tache 5 / 15 : Redis 7.4 + Strategy 6 DBs

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.1.4

**But** : Configurer Redis 7.4 avec strategy de 6 DBs separes (un par usage) et fournir un factory client TypeScript reutilisable.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.5-prompt.md
```

**Actions principales attendues** :
- `repo/infrastructure/docker/redis/redis.conf` enrichi (AOF + RDB + LRU + slowlog)
- `repo/packages/shared-utils/src/redis/redis-clients.ts` exposant factory `createRedisClient()` + singleton `getRedisClient()` + helper `closeAllRedisClients()`
- Constante `REDIS_DB` exportant 6 DBs : `CACHE: 0`, `SESSIONS: 1`, `QUEUES: 2`, `LOCKS: 3`, `AI_CACHE: 4`, `RATE_LIMIT: 5`
- Retry strategy exponential 10 fois max avec delay 100-2000ms
- Reconnect on errors : `READONLY`, `ETIMEDOUT`, `ECONNRESET`
- Logs Pino structured sur `connect`, `error`, `close` events

**Fichiers cibles principaux** :
  - `repo/infrastructure/docker/redis/redis.conf`
  - `repo/packages/shared-utils/src/redis/redis-clients.ts`
  - `repo/packages/shared-utils/src/redis/redis-clients.spec.ts`
  - `repo/docs/architecture/cache-strategy.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `docker exec skalean-redis redis-cli -a $REDIS_PASSWORD ping` retourne PONG
  - V2 (P0) : `createRedisClient({ url, db: 0 })` connecte sans erreur
  - V3 (P0) : Test isolation : key set en DB 0 PAS visible en DB 1

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
git commit -m "feat(sprint-01): redis 7.4 + strategy 6 dbs

Task: 1.1.5
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.5"
```

---

### Tache 6 / 15 : Kafka 3.7 KRaft + Topic Catalog (30 Topics)

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.1.5

**But** : Creer les 30 topics Kafka initiaux du programme avec convention naming `insurtech.events.{vertical}.{entity}.{action}` et configuration retention/partitions appropriees.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.6-prompt.md
```

**Actions principales attendues** :
- Script `repo/infrastructure/docker/kafka/init-topics.sh` execute par init container `kafka-init-topics`
- Helper function `create_topic(name, partitions=3, replication=1)` reutilisable
- Configuration topics : `compression.type=lz4`, `retention.ms=604800000` (7 jours), `retention.bytes=1073741824` (1 GB), `cleanup.policy=delete`
- Topics Auth (7) : `user_signed_up`, `user_signed_in` (6 partitions), `user_signed_out`, `password_changed`, `mfa_setup`, `account_locked`, `role_changed`
- Topics CRM (5) : `contact_created`, `contact_updated`, `contact_deleted`, `deal_stage_changed`, `interaction_logged` (6 partitions)
- Topics Booking (3) : `appointment_scheduled`, `appointment_cancelled`, `appointment_completed`

**Fichiers cibles principaux** :
  - `repo/infrastructure/docker/kafka/init-topics.sh`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `docker logs skalean-kafka-init` montre "Created : ..." pour chaque topic
  - V2 (P0) : `docker exec skalean-kafka kafka-topics.sh --bootstrap-server kafka:9092 --list | wc -l` >= 30
  - V3 (P0) : Convention `insurtech.events.{vertical}.{entity}.{action}` respectee : `kafka-topics.sh --list | grep -v "^insurtech\."` retourne vide

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
git commit -m "feat(sprint-01): kafka 3.7 kraft + topic catalog (30 topics)

Task: 1.1.6
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.6"
```

---

### Tache 7 / 15 : MinIO S3-Compatible Dev + Atlas Cloud Services Prod Ready

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.1.6

**But** : Fournir un wrapper TypeScript S3 utilisable a la fois sur MinIO local (dev) et Atlas Cloud Services Object Storage Benguerir (prod), avec abstraction provider via configuration.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.7-prompt.md
```

**Actions principales attendues** :
- Init container MinIO cree 3 buckets dev : `skalean-insurtech-dev-docs`, `skalean-insurtech-dev-photos`, `skalean-insurtech-dev-archive`
- `repo/packages/shared-utils/src/s3/s3-client.ts` exposant `createS3Client()`, `initS3Client()`, `getS3Client()` singleton
- Interface `S3Config` typee : `{ endpoint?, region, accessKeyId, secretAccessKey, forcePathStyle? }`
- Configuration dev avec `forcePathStyle: true` (MinIO requirement)
- Configuration prod ready (Atlas Cloud Services = `forcePathStyle: false` -- compatibility S3 standard)
- Variables env documentees : `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_KMS_KEY_BASE`

**Fichiers cibles principaux** :
  - `repo/packages/shared-utils/src/s3/s3-client.ts`
  - `repo/packages/shared-utils/src/s3/s3-client.spec.ts`
  - `repo/docs/architecture/storage-provider.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `docker exec skalean-minio mc ls local/` liste 3 buckets
  - V2 (P0) : `createS3Client()` factory retourne client S3Client valide
  - V3 (P0) : `getS3Client()` singleton retourne meme instance entre appels

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
git commit -m "feat(sprint-01): minio s3-compatible dev + atlas cloud services prod ready

Task: 1.1.7
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.7"
```

---

### Tache 8 / 15 : shared-config Env Loader Zod Runtime Validation

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.1.7

**But** : Empecher tout demarrage d'app/package si une variable d'environnement requise est manquante ou mal formatee, via validation Zod runtime au boot.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.8-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/shared-config/` avec `package.json`, `tsconfig.json`, `src/`
- `repo/packages/shared-config/src/env.schema.ts` definissant `EnvSchema` Zod exhaustif (~50 variables)
- `repo/packages/shared-config/src/loader.ts` exportant `loadEnv()` + `resetEnvCache()`
- `repo/packages/shared-config/src/index.ts` reexportant tout
- Validation Zod transforms : `Bool` (string/boolean -> boolean), coerce numbers, parse `KAFKA_BROKERS` comme array CSV
- Cache singleton apres premier `loadEnv()` (pour eviter re-parse a chaque appel)

**Fichiers cibles principaux** :
  - `repo/packages/shared-config/package.json`
  - `repo/packages/shared-config/tsconfig.json`
  - `repo/packages/shared-config/src/env.schema.ts`
  - `repo/packages/shared-config/src/loader.ts`
  - `repo/packages/shared-config/src/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `loadEnv()` retourne objet typed `Env` sans erreur si .env valide
  - V2 (P0) : `process.exit(1)` appele si JWT_SECRET < 32 chars
  - V3 (P0) : Cache singleton : 2 appels `loadEnv()` retournent meme reference

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
git commit -m "feat(sprint-01): shared-config env loader zod runtime validation

Task: 1.1.8
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.8"
```

---

### Tache 9 / 15 : database TypeORM 0.3 DataSource

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.1.8

**But** : Fournir un DataSource TypeORM 0.3 singleton avec configuration optimale (pool, timeouts, migrations) pret a etre utilise par les Sprint 2+ pour entities et migrations.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.9-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/database/` avec structure complete
- `repo/packages/database/src/data-source.ts` exposant `AppDataSource` singleton + `initDataSource()` + `closeDataSource()`
- Configuration DataSource : `synchronize: false` (jamais true, utiliser migrations), `logging` configurable via env
- Pool config : min/max via env, idleTimeoutMillis 30s, connectionTimeoutMillis 10s
- `statement_timeout: 60000` -- aucune query ne depasse 60s
- `application_name: skalean-insurtech-{NODE_ENV}` -- visible dans `pg_stat_activity` pour debug

**Fichiers cibles principaux** :
  - `repo/packages/database/package.json`
  - `repo/packages/database/tsconfig.json`
  - `repo/packages/database/src/data-source.ts`
  - `repo/packages/database/src/index.ts`
  - `repo/packages/database/src/data-source.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `AppDataSource.isInitialized` true apres `initDataSource()`
  - V2 (P0) : `AppDataSource.query('SELECT 1 AS one')` retourne `[{ one: 1 }]`
  - V3 (P0) : Helpers RLS accessibles : `SELECT app_current_tenant()` retourne NULL

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
git commit -m "feat(sprint-01): database typeorm 0.3 datasource

Task: 1.1.9
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.9"
```

---

### Tache 10 / 15 : GitHub Actions CI

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.1.9

**But** : Pipeline CI declenche sur PR + push main executant lint, typecheck, build, tests, security audit, et verification no-emoji, avec services Postgres + Redis dans CI.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.10-prompt.md
```

**Actions principales attendues** :
- `repo/.github/workflows/ci.yaml` avec 5 jobs : `lint-and-typecheck`, `build`, `test`, `audit`, `ci-summary`
- Trigger : push main + develop, PR vers main + develop
- Concurrency `cancel-in-progress: true` (evite jobs redondants)
- Cache pnpm store via `actions/setup-node` avec `cache: pnpm`
- Job `test` avec services Postgres 16.6 + Redis 7.4.1 healthchecks
- Init scripts Postgres executes en prelude (extensions + helpers RLS)

**Fichiers cibles principaux** :
  - `repo/.github/workflows/ci.yaml`
  - `repo/.github/PULL_REQUEST_TEMPLATE.md`
  - `repo/.github/CODEOWNERS`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Workflow CI declenche sur PR ouverte
  - V2 (P0) : 5 jobs s'executent (visible dans Actions tab)
  - V3 (P0) : Lint + typecheck reussissent (vide initialement)

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
git commit -m "feat(sprint-01): github actions ci

Task: 1.1.10
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.10"
```

---

### Tache 11 / 15 : Vitest 2.1 + Playwright 1.49

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.1.10

**But** : Configurer Vitest pour tests unitaires/integration et Playwright pour tests E2E avec configurations racine standardisees.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.11-prompt.md
```

**Actions principales attendues** :
- `repo/vitest.config.ts` (racine) avec environment node, globals true, setupFiles, coverage v8
- `repo/test/setup.ts` charge `.env.test` (fallback `.env`), `NODE_ENV=test`
- Coverage thresholds : lines 70%, functions 70%, branches 65%, statements 70%
- Path aliases configures : `@insurtech/*` -> `packages/*/src`
- Test pool `forks` (isolation entre tests)
- `repo/playwright.config.ts` (racine) avec 3 projects : `api`, `chromium`, `mobile-safari`

**Fichiers cibles principaux** :
  - `repo/vitest.config.ts`
  - `repo/test/setup.ts`
  - `repo/playwright.config.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm test` execute Vitest (vide en Sprint 1)
  - V2 (P0) : `pnpm test:e2e` execute Playwright (vide en Sprint 1)
  - V3 (P0) : Coverage threshold 70% applique (test : ajouter code non-couvert -> CI fail)

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
git commit -m "feat(sprint-01): vitest 2.1 + playwright 1.49

Task: 1.1.11
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.11"
```

---

### Tache 12 / 15 : Pino Logger + OpenTelemetry SDK + Sentry Ready

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.1.11

**But** : Mettre en place observability fondations : logger structured Pino avec PII redaction, OpenTelemetry SDK pour traces, et integration Sentry (configurable).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.12-prompt.md
```

**Actions principales attendues** :
- `repo/packages/shared-utils/src/logger/logger.ts` exposant `logger` (pino instance) + `createChildLogger()`
- PII redaction paths : `*.password`, `*.passwordHash`, `*.cin`, `*.phone`, `*.phoneNumber`, `*.email`, `*.refreshToken`, `*.accessToken`, `*.apiKey`, `*.body.password`, `*.headers.authorization`
- Censor `[REDACTED]` (pas suppression, traceabilite preservee)
- Base fields auto-injectes : service, env, version
- Pretty printing dev only (`pino-pretty`) -- prod = JSON brut
- Level configurable via `LOG_LEVEL` env (fatal, error, warn, info, debug, trace)

**Fichiers cibles principaux** :
  - `repo/packages/shared-utils/src/logger/logger.ts`
  - `repo/packages/shared-utils/src/telemetry/otel.ts`
  - `repo/packages/shared-utils/src/index.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `logger.info({ password: 'secret', cin: 'A123' }, 'login')` emet log avec password/cin = `[REDACTED]`
  - V2 (P0) : Format JSON valide (parsable par jq)
  - V3 (P0) : Pretty printing si NODE_ENV=development

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
git commit -m "feat(sprint-01): pino logger + opentelemetry sdk + sentry ready

Task: 1.1.12
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.12"
```

---

### Tache 13 / 15 : Init des 16+ Shared Packages Stubs + 8 Apps Stubs

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.1.12

**But** : Creer les 24+ packages.json minimaux (`package.json` + `tsconfig.json` + `src/index.ts`) pour permettre `pnpm install` complet et workspace links resolvables.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.13-prompt.md
```

**Actions principales attendues** :
- 21 packages stubs : `auth`, `database`, `crm`, `booking`, `comm`, `docs`, `signature`, `pay`, `books`, `compliance`, `analytics`, `insure`, `repair`, `skalean-ai-client`, `shared-config` (deja Tach...
- 8 apps stubs : `api`, `web-broker`, `web-garage`, `web-garage-mobile`, `web-insurtech-admin`, `web-customer-portal`, `web-assure-portal`, `web-assure-mobile`
- Chaque package : `package.json` (name `@insurtech/{name}`, scripts build/typecheck/test/lint/clean, deps depuis workspace), `tsconfig.json` (extends base), `src/index.ts` (export VERSION minimal)
- Chaque app : `package.json` (name `@insurtech/{name}`, scripts dev/build/start/test placeholders), deps `@insurtech/*` workspace
- Ports apps documentes : api 4000, broker 3001, garage 3002, garage-mobile 3003, admin 3000, customer-portal 3004, assure-portal 3005, assure-mobile 3006
- Script automatique `repo/infrastructure/scripts/init-package-stubs.sh` capable de regenerer les stubs si besoin

**Fichiers cibles principaux** :
  - `repo/packages/auth/package.json + tsconfig.json + src/index.ts`
  - `repo/packages/{database,crm,booking,...}/package.json + tsconfig.json + src/index.ts (~21 packages)`
  - `repo/apps/api/package.json + tsconfig.json + src/main.ts placeholder`
  - `repo/apps/web-broker/package.json + tsconfig.json + minimal next config (8 apps)`
  - `repo/infrastructure/scripts/init-package-stubs.sh`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `ls packages/ | wc -l` retourne 21 (16 metier + 5 shared)
  - V2 (P0) : `ls apps/ | wc -l` retourne 8
  - V3 (P0) : Chaque package a package.json + tsconfig.json + src/index.ts

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
git commit -m "feat(sprint-01): init des 16+ shared packages stubs + 8 apps stubs

Task: 1.1.13
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.13"
```

---

### Tache 14 / 15 : Husky + commitlint + lint-staged + check-no-emoji

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.1.13

**But** : Bloquer les commits non-conformes via 3 hooks Git : pre-commit (lint-staged + check-no-emoji), commit-msg (commitlint conventional), pre-push (typecheck).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.14-prompt.md
```

**Actions principales attendues** :
- `repo/.husky/pre-commit` execute `check-no-emoji.sh` puis `pnpm lint-staged`
- `repo/.husky/commit-msg` execute `pnpm commitlint --edit $1`
- `repo/.husky/pre-push` execute `pnpm typecheck`
- `repo/commitlint.config.cjs` avec config conventional + custom rules : `type-enum` (feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert), `subject-max-length: 100`, `body-max-line-length: ...
- `repo/.lintstagedrc.cjs` avec `*.{ts,tsx,js,jsx,json,md,yaml,yml}` -> Biome check --write
- `repo/infrastructure/scripts/check-no-emoji.sh` script bash detectant emojis Unicode (ranges 1F300-1F9FF, 2600-26FF, etc.) avec exclude dirs (node_modules, dist, .git, etc.)

**Fichiers cibles principaux** :
  - `repo/.husky/pre-commit`
  - `repo/.husky/commit-msg`
  - `repo/.husky/pre-push`
  - `repo/commitlint.config.cjs`
  - `repo/.lintstagedrc.cjs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `git commit -m "test"` echoue (commitlint : pas de type)
  - V2 (P0) : `git commit -m "feat: test"` reussit
  - V3 (P0) : `git commit -m "test test"` echoue

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
git commit -m "feat(sprint-01): husky + commitlint + lint-staged + check-no-emoji

Task: 1.1.14
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.14"
```

---

### Tache 15 / 15 : Documentation Architecture (6 ADR + README + CLAUDE.md + CONTRIBUTING.md)

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.1.14

**But** : Etablir la documentation architecture fondatrice : 6 Architecture Decision Records, README projet, CLAUDE.md guide pour AI assistants, CONTRIBUTING.md workflow.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-01-bootstrap/task-1.1.15-prompt.md
```

**Actions principales attendues** :
- `repo/README.md` avec : description courte, stack overview, quick start (5 commandes), liens vers docs
- `repo/CLAUDE.md` avec : conventions critiques (no-emoji, TypeScript strict, multi-tenant, secrets, conventional commits), structure projet, checklist avant PR, lien ADRs
- `repo/CONTRIBUTING.md` avec : workflow branches, commit conventions, PR process, standards code, tasks workflow
- `repo/LICENSE` (proprietary tag, format custom Skalean SARL)
- `repo/docs/architecture/README.md` index ADR
- `repo/docs/architecture/ADR-001-monorepo-structure.md` (Statut, Contexte, Decision, Consequences) -- choix monorepo pnpm + Turborepo

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
git commit -m "feat(sprint-01): documentation architecture (6 adr + readme + claude.md + contribu

Task: 1.1.15
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-01 Tache 1.1.15"
```

---


## VERIFICATION DU SPRINT 1

Une fois les 15 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-01-sprint-01-verification.md
```

Le fichier de verification V-01 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint01-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint01-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint01-verify-report.md
git commit -m "chore(sprint-01): close sprint 1 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 1 (Bootstrap Infrastructure)
- Sprint : 1 (Phase 1 / Sprint 1)
- Apport : Infrastructure complete demarre + structure 9 apps
- Tests E2E cumules : {N}+

Sprint 1 completed -- handoff to Sprint 2."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 1]
   |
   v
[Tache 1.1.1: Initialisation Monorepo pnpm + Turborepo + Structure]
   | -> compile -> tests -> commit
   v
[Tache 1.1.2: TypeScript Strict + Biome Unifie]
   | -> compile -> tests -> commit
   v
[Tache 1.1.3: Docker Compose Dev (7 Services)]
   | -> compile -> tests -> commit
   v
[Tache 1.1.4: PostgreSQL 16 + Extensions + Helpers RLS Multi-Tenant 3]
   | -> compile -> tests -> commit
   v
[Tache 1.1.5: Redis 7.4 + Strategy 6 DBs]
   | -> compile -> tests -> commit
   v
[Tache 1.1.6: Kafka 3.7 KRaft + Topic Catalog (30 Topics)]
   | -> compile -> tests -> commit
   v
[Tache 1.1.7: MinIO S3-Compatible Dev + Atlas Cloud Services Prod Rea]
   | -> compile -> tests -> commit
   v
[Tache 1.1.8: shared-config Env Loader Zod Runtime Validation]
   | -> compile -> tests -> commit
   v
[Tache 1.1.9: database TypeORM 0.3 DataSource]
   | -> compile -> tests -> commit
   v
[Tache 1.1.10: GitHub Actions CI]
   | -> compile -> tests -> commit
   v
[Tache 1.1.11: Vitest 2.1 + Playwright 1.49]
   | -> compile -> tests -> commit
   v
[Tache 1.1.12: Pino Logger + OpenTelemetry SDK + Sentry Ready]
   | -> compile -> tests -> commit
   v
[Tache 1.1.13: Init des 16+ Shared Packages Stubs + 8 Apps Stubs]
   | -> compile -> tests -> commit
   v
[Tache 1.1.14: Husky + commitlint + lint-staged + check-no-emoji]
   | -> compile -> tests -> commit
   v
[Tache 1.1.15: Documentation Architecture (6 ADR + README + CLAUDE.md ]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 1 -- V-01]
   |
   v
[Rapport sprint01-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

**Apport metier principal** : Infrastructure complete demarre + structure 9 apps.

**Prerequis Sprint 2** : Sprint 1 GO complet (score >= 95% verification automatique V-01).

**Sprint suivant** : Sprint 2.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint precedent (verification GO)

```bash
# Sprint 1 = premier sprint, pas de prerequis


```

### Lancement Sprint 1 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-01-sprint-01-bootstrap.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-01-sprint-01-bootstrap.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-01-sprint-01-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-01.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 1"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint01-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-01** complet avant generation prompts taches (contexte critique)
2. **Generer les 15 prompts taches** dans `00-pilotage/prompts-taches/sprint-01-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-01 v2.2 detaille -- Sprint 1 (1.1) Bootstrap Infrastructure.**

**Total taches detaillees** : 15 | **Effort cumul** : ~80h | **Apport** : Infrastructure complete demarre + structure 9 apps
