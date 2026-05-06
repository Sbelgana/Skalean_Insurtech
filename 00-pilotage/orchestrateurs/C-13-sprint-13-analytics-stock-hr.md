# ORCHESTRATEUR SPRINT 13 -- Phase 3 / Sprint 6 : Analytics ClickHouse + Stock + HR
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 13 / 35 (cumul) -- Sprint 6 dans Phase 3
**Reference meta-prompt** : `B-13-sprint-13-analytics-stock-hr.md`
**Reference verification** : `V-13-sprint-13-verification.md`
**Numerotation taches** : 3.6.1 a 3.6.14
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : ClickHouse OLAP + dashboards + Stock + HR paie CNSS/AMO/IR

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 13 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-13** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-13 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 13

Sprint 13 (3.6) -- Analytics ClickHouse + Stock + HR. Voir B-13-sprint-13-analytics-stock-hr.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/
  task-3.6.1-prompt.md       # ClickHouse Setup + Schemas Analytics
  task-3.6.2-prompt.md       # ETL Pipeline Postgres -> ClickHouse (Polling MVP)
  task-3.6.3-prompt.md       # AnalyticsService + Queries Dashboards
  task-3.6.4-prompt.md       # 6 Dashboards Endpoints
  task-3.6.5-prompt.md       # Stock Items Entity + Categories + Valorisation FIFO
  task-3.6.6-prompt.md       # Stock Mouvements + Impacts FIFO
  task-3.6.7-prompt.md       # Stock Alertes Seuil + Notifications
  task-3.6.8-prompt.md       # Stock Endpoints REST `/api/v1/stock/*`
  task-3.6.9-prompt.md       # HR Employees + Contrats
  task-3.6.10-prompt.md       # HR Conges + Workflow Approval
  task-3.6.11-prompt.md       # HR Paie Basique : Bulletin + CNSS + AMO + IR
  task-3.6.12-prompt.md       # HR Endpoints + Integration Books
  task-3.6.13-prompt.md       # Cross-Module Stock+HR (Preparation Sprint 23)
  task-3.6.14-prompt.md       # Tests E2E (35+) + Phase 3 Closure
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-13-sprint-13-verification.md
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
4. La verification finale V-13 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-13-sprint-13-verification.md
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

## CONTEXTE PHASE 3 -- Modules Horizontaux

### Position du Sprint 6 dans la Phase 3

Sprint 13 (3.6) -- **Analytics ClickHouse + Stock + HR**.

Voir `B-13-sprint-13-analytics-stock-hr.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

### Apport metier de ce sprint

ClickHouse OLAP + dashboards + Stock + HR paie CNSS/AMO/IR

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-13 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-13, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-13.

---

### Tache 1 / 14 : ClickHouse Setup + Schemas Analytics

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 12

**But** : Ajouter ClickHouse au docker-compose + schemas analytics (tables denormalisees pour queries OLAP rapides).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.1-prompt.md
```

**Actions principales attendues** :
- Update `docker-compose.yml` : ajouter service `clickhouse` (image `clickhouse/clickhouse-server:24.10-alpine`)
- Variables env : `CLICKHOUSE_URL=http://localhost:8123`, `CLICKHOUSE_USERNAME=default`, `CLICKHOUSE_PASSWORD=`, `CLICKHOUSE_DATABASE=skalean_analytics`
- Schemas tables analytics dans `repo/infrastructure/clickhouse/schemas/` :
- Engine ClickHouse : `MergeTree()` order by `(tenant_id, event_date)` -- partitions par mois
- TTL : 5 ans default (configurable per type)
- Indexes : skip indexes sur `tenant_id`, `customer_id` (facilitent partition pruning)

**Fichiers cibles principaux** :
  - `repo/docker-compose.yml`
  - `repo/infrastructure/clickhouse/schemas/{8 sql files}`
  - `repo/packages/analytics/src/services/clickhouse.service.ts`
  - `repo/packages/analytics/src/clickhouse.module.ts`
  - `repo/infrastructure/scripts/init-clickhouse.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : ClickHouse demarre via docker-compose
  - V2 (P0) : Tables analytics crees
  - V3 (P0) : dim_dates rempli (5 ans)

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
git commit -m "feat(sprint-13): clickhouse setup + schemas analytics

Task: 3.6.1
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.1"
```

---

### Tache 2 / 14 : ETL Pipeline Postgres -> ClickHouse (Polling MVP)

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.6.1

**But** : Pipeline ETL alimentant ClickHouse depuis Postgres : polling-based pour MVP (simple), Debezium CDC en Phase 7+ (real-time).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.2-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
- Methods :
- Cron job BullMQ : every 5 minutes
- State tracking : last sync timestamp per table dans Redis ou table `analytics_etl_state`
- Idempotency : ClickHouse `ReplacingMergeTree` engine OR delete-then-insert pattern
- Batch size 1000 rows per insert (perf optimal CH)

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
  - `repo/packages/analytics/src/etl/etl-state.service.ts`
  - `repo/packages/analytics/src/jobs/etl-cron.job.ts`
  - `repo/packages/database/src/migrations/{date}-AnalyticsEtlState.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-analytics.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Sync delta fonctionne
  - V2 (P0) : Idempotency : 2 syncs same data -> 1 row CH
  - V3 (P0) : State tracking : last_sync_timestamp persiste

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
git commit -m "feat(sprint-13): etl pipeline postgres -> clickhouse (polling mvp)

Task: 3.6.2
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.2"
```

---

### Tache 3 / 14 : AnalyticsService + Queries Dashboards

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.6.2

**But** : Service NestJS abstraction queries ClickHouse + cache + interface uniforme pour controllers dashboards.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.3-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/analytics/src/services/analytics.service.ts`
- Methods (queries reusable) :
- Cache Redis 5min sur queries (queries CH peuvent prendre 100-500ms)
- Filters tenant_id obligatoire (multi-tenant isolation)
- Logging structures : query duration + cache hit/miss
- Pattern queries optimisees : pre-aggregation (sum / count par jour) + materialized views CH (Phase 7+)

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/services/analytics.service.ts`
  - `repo/packages/analytics/src/services/analytics.service.spec.ts`
  - `repo/packages/analytics/src/types/dashboards.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : getRevenue retourne points avec aggregates corrects
  - V2 (P0) : groupBy day/week/month fonctionne
  - V3 (P0) : Multi-tenant isolation (tenant_id filter)

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
git commit -m "feat(sprint-13): analyticsservice + queries dashboards

Task: 3.6.3
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.3"
```

---

### Tache 4 / 14 : 6 Dashboards Endpoints

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.6.3

**But** : 6 endpoints REST exposant dashboards initiaux + format response coherent (data + meta + filters).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.4-prompt.md
```

**Actions principales attendues** :
- Controller `repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts`
- Dashboards :
- Query params : `date_start`, `date_end`, `group_by` (day/week/month), `tenant_id` (super admin override sinon current)
- Response format standardise :
- Permissions : `analytics.dashboards.read`
- Tests : 6 endpoints + formats + multi-tenant + perf

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts`
  - `repo/apps/api/src/modules/analytics/services/{several}.service.ts`
  - `repo/apps/api/test/analytics/dashboards.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 6 endpoints fonctionnent
  - V2 (P0) : Format response coherent
  - V3 (P0) : RBAC + multi-tenant

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
git commit -m "feat(sprint-13): 6 dashboards endpoints

Task: 3.6.4
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.4"
```

---

### Tache 5 / 14 : Stock Items Entity + Categories + Valorisation FIFO

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.6.4

**But** : Module stock items (pieces detachees garage) avec categories + valorisation FIFO + integration future avec sinistres reparation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.5-prompt.md
```

**Actions principales attendues** :
- Migration : tables `stock_categories`, `stock_items`, `stock_lots` :
- Service `stock-items.service.ts` (CRUD)
- Service `stock-valorisation.service.ts` :
- Endpoint `GET /api/v1/stock/items` (filtres : category, low_stock, search)
- Endpoint CRUD items + categories
- Photos upload (S3 Sprint 10 multi-tenant) -- `stock_items.photo_url`

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-StockTables.ts`
  - `repo/packages/stock/src/entities/{3 entities}.ts`
  - `repo/packages/stock/src/services/stock-items.service.ts`
  - `repo/packages/stock/src/services/stock-valorisation.service.ts`
  - `repo/apps/api/src/modules/stock/controllers/stock-items.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : CRUD items
  - V2 (P0) : SKU UNIQUE per tenant
  - V3 (P0) : getCurrentStock retourne quantity + valorisation FIFO correct

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
git commit -m "feat(sprint-13): stock items entity + categories + valorisation fifo

Task: 3.6.5
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.5"
```

---

### Tache 6 / 14 : Stock Mouvements + Impacts FIFO

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.6.5

**But** : Migration table `stock_movements` + service tracking mouvements (in/out/adjustment) avec impacts auto sur lots FIFO.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.6-prompt.md
```

**Actions principales attendues** :
- Migration : table `stock_movements` :
- Service `stock-movements.service.ts` :
- FIFO logic exit :
- Validation : exit quantity > current stock = rejected (insufficient stock)
- Adjustment requires reason + permission `stock.adjust`
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-StockMovements.ts`
  - `repo/packages/stock/src/entities/stock-movement.entity.ts`
  - `repo/packages/stock/src/services/stock-movements.service.ts`
  - `repo/apps/api/src/modules/stock/controllers/stock-movements.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : recordEntry cree lot + movement
  - V2 (P0) : recordExit FIFO consume oldest lots
  - V3 (P0) : Insufficient stock reject 400

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
git commit -m "feat(sprint-13): stock mouvements + impacts fifo

Task: 3.6.6
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.6"
```

---

### Tache 7 / 14 : Stock Alertes Seuil + Notifications

**Metadonnees** : P1 | 4h | Depend de : Depend de 3.6.6

**But** : Service detection items sous reorder_threshold + alertes notifications + suggestions reorder.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.7-prompt.md
```

**Actions principales attendues** :
- Service `stock-alerts.service.ts` :
- Cron job daily : check low stock + envoie email super_admin tenant + chef garage
- Endpoint `GET /api/v1/stock/alerts/low-stock` (returns items + suggestions)
- Trigger after exit : si current < threshold -> Kafka event `stock.low_stock` -> notification real-time
- Phase 7+ : enrichi avec velocity/saisonalite (predictive)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/stock/src/services/stock-alerts.service.ts`
  - `repo/packages/stock/src/jobs/low-stock-cron.job.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/low-stock-alert.hbs`

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
git commit -m "feat(sprint-13): stock alertes seuil + notifications

Task: 3.6.7
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.7"
```

---

### Tache 8 / 14 : Stock Endpoints REST `/api/v1/stock/*`

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.6.7

**But** : Consolidation endpoints stock + integration avec autres modules.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.8-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Endpoint additionnels :
- Integration cross-module via Kafka :
- Tests integration

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/stock/controllers/{several}.ts`
  - `repo/packages/stock/src/consumers/repair-parts-consumed.consumer.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Endpoints CRUD operationnels
  - V2 (P0) : Inventaire report OK
  - V3 (P0) : Cross-module Kafka events fonctionnent

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
git commit -m "feat(sprint-13): stock endpoints rest /api/v1/stock/*

Task: 3.6.8
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.8"
```

---

### Tache 9 / 14 : HR Employees + Contrats

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.6.8

**But** : Module HR : entity employees + contrats (CDI/CDD/anapec) + dossier employe basique.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.9-prompt.md
```

**Actions principales attendues** :
- Migration : tables `hr_employees`, `hr_contracts` :
- Service `employees.service.ts` (CRUD)
- Service `contracts.service.ts` (CRUD + transitions)
- Endpoints :
- Validation : CIN MA format, CNSS number format
- Permissions : `hr.employees.create/read/update/delete`

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-HrEmployeesContracts.ts`
  - `repo/packages/hr/src/entities/{2 entities}.ts`
  - `repo/packages/hr/src/services/employees.service.ts`
  - `repo/packages/hr/src/services/contracts.service.ts`
  - `repo/apps/api/src/modules/hr/controllers/employees.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : CRUD employees
  - V2 (P0) : Contrats lies a employees
  - V3 (P0) : CIN + CNSS format MA validate

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
git commit -m "feat(sprint-13): hr employees + contrats

Task: 3.6.9
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.9"
```

---

### Tache 10 / 14 : HR Conges + Workflow Approval

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.6.9

**But** : Module conges : demandes employees + approval manager + balance reglements (conges payes 18j/an MA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.10-prompt.md
```

**Actions principales attendues** :
- Migration : table `hr_leaves` :
- Migration : table `hr_leave_balances` (computed) :
- Service `leaves.service.ts` :
- Conges payes MA : 18 jours/an minimum + 1.5j/mois travaille (loi)
- Workflow approval : super_admin OR manager (chef garage)
- Endpoints standards + workflow

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-HrLeaves.ts`
  - `repo/packages/hr/src/entities/{2 entities}.ts`
  - `repo/packages/hr/src/services/leaves.service.ts`
  - `repo/apps/api/src/modules/hr/controllers/leaves.controller.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/leave-{request,approved,rejected}.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demande conges + balance check
  - V2 (P0) : Approval transition + decrement balance
  - V3 (P0) : Reject avec reason

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
git commit -m "feat(sprint-13): hr conges + workflow approval

Task: 3.6.10
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.10"
```

---

### Tache 11 / 14 : HR Paie Basique : Bulletin + CNSS + AMO + IR

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.6.10

**But** : Generation bulletins paie mensuel : salaire brut + cotisations CNSS + AMO + IR + cotisations diverses + net a payer.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.11-prompt.md
```

**Actions principales attendues** :
- Migration : table `hr_payslips` :
- Service `payroll.service.ts` :
- Computations :
- Generation PDF bulletin (template `bulletin-paie.hbs` Sprint 10) avec layout standard MA
- Cron job : 25 du mois -> generate drafts payslips employees actifs
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-HrPayslips.ts`
  - `repo/packages/hr/src/entities/hr-payslip.entity.ts`
  - `repo/packages/hr/src/services/payroll.service.ts`
  - `repo/packages/hr/src/services/payroll-calculator.service.ts`
  - `repo/packages/hr/src/services/payroll-calculator.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : computeCnss correct (cap 6000 MAD)
  - V2 (P0) : computeAmo correct (no cap)
  - V3 (P0) : computeIr correct sur 6 brackets

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
git commit -m "feat(sprint-13): hr paie basique : bulletin + cnss + amo + ir

Task: 3.6.11
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.11"
```

---

### Tache 12 / 14 : HR Endpoints + Integration Books

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.6.11

**But** : Consolidation endpoints HR + integration avec Books (charges salaire = ecritures comptables).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.12-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Integration via Kafka events :
- Endpoints reports :
- Tests integration

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/hr/controllers/{several}.ts`
  - `repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.ts`
  - `repo/packages/hr/src/services/declarations.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Payslip validated -> ecriture cree
  - V2 (P0) : Declaration CNSS retourne agregats
  - V3 (P0) : Declaration IR annual

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
git commit -m "feat(sprint-13): hr endpoints + integration books

Task: 3.6.12
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.12"
```

---

### Tache 13 / 14 : Cross-Module Stock+HR (Preparation Sprint 23)

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.6.12

**But** : Verifications integration cross-module + preparation pour Sprint 23 web-garage qui consume Stock+HR endpoints.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.13-prompt.md
```

**Actions principales attendues** :
- Documentation integration `repo/docs/integration/stock-hr-garage-flows.md` :
- Verifications endpoints needed Sprint 23 disponibles
- Test integration end-to-end : create tenant Garage Atlas -> add 5 technicians (HR) -> add 50 stock items -> simulate consumption sinistre -> verify journal entries + stock decrement + employee assi...
- Performance : test queries dashboards avec 1000+ items + 50+ employees

**Fichiers cibles principaux** :
  - `repo/docs/integration/stock-hr-garage-flows.md`
  - `repo/apps/api/test/integration/garage-end-to-end.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Documentation flows complete
  - V2 (P0) : Test E2E garage flow passe
  - V3 (P0) : Performance dashboards OK volumes realistes

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
git commit -m "feat(sprint-13): cross-module stock+hr (preparation sprint 23)

Task: 3.6.13
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.13"
```

---

### Tache 14 / 14 : Tests E2E (35+) + Phase 3 Closure

**Metadonnees** : P0 | 8h | Depend de : Depend de 3.6.13

**But** : Suite tests E2E + fixtures realistes + closure officielle Phase 3.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/task-3.6.14-prompt.md
```

**Actions principales attendues** :
- ClickHouse : connexion + ETL sync + queries (5)
- 6 dashboards endpoints (6)
- Stock : CRUD items + movements + FIFO + alertes (10)
- HR employees + contrats + termination (4)
- HR conges : workflow + balance + types (5)
- HR paie : computations + workflow + bulletin (5)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/{various}/{35+ specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-stock-hr.ts`
  - `repo/docs/phase-3-completion.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 35+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Fixtures realistes

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
git commit -m "feat(sprint-13): tests e2e (35+) + phase 3 closure

Task: 3.6.14
Sprint: 13 (Phase 3 / Sprint 6)
Phase: 3 -- Modules Horizontaux
Decisions: see B-13 Tache 3.6.14"
```

---


## VERIFICATION DU SPRINT 13

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-13-sprint-13-verification.md
```

Le fichier de verification V-13 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint13-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint13-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint13-verify-report.md
git commit -m "chore(sprint-13): close sprint 13 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 3 (Modules Horizontaux)
- Sprint : 13 (Phase 3 / Sprint 6)
- Apport : ClickHouse OLAP + dashboards + Stock + HR paie CNSS/AMO/IR
- Tests E2E cumules : {N}+

Sprint 13 completed -- handoff to Sprint 14."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 13]
   |
   v
[Tache 3.6.1: ClickHouse Setup + Schemas Analytics]
   | -> compile -> tests -> commit
   v
[Tache 3.6.2: ETL Pipeline Postgres -> ClickHouse (Polling MVP)]
   | -> compile -> tests -> commit
   v
[Tache 3.6.3: AnalyticsService + Queries Dashboards]
   | -> compile -> tests -> commit
   v
[Tache 3.6.4: 6 Dashboards Endpoints]
   | -> compile -> tests -> commit
   v
[Tache 3.6.5: Stock Items Entity + Categories + Valorisation FIFO]
   | -> compile -> tests -> commit
   v
[Tache 3.6.6: Stock Mouvements + Impacts FIFO]
   | -> compile -> tests -> commit
   v
[Tache 3.6.7: Stock Alertes Seuil + Notifications]
   | -> compile -> tests -> commit
   v
[Tache 3.6.8: Stock Endpoints REST `/api/v1/stock/*`]
   | -> compile -> tests -> commit
   v
[Tache 3.6.9: HR Employees + Contrats]
   | -> compile -> tests -> commit
   v
[Tache 3.6.10: HR Conges + Workflow Approval]
   | -> compile -> tests -> commit
   v
[Tache 3.6.11: HR Paie Basique : Bulletin + CNSS + AMO + IR]
   | -> compile -> tests -> commit
   v
[Tache 3.6.12: HR Endpoints + Integration Books]
   | -> compile -> tests -> commit
   v
[Tache 3.6.13: Cross-Module Stock+HR (Preparation Sprint 23)]
   | -> compile -> tests -> commit
   v
[Tache 3.6.14: Tests E2E (35+) + Phase 3 Closure]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 13 -- V-13]
   |
   v
[Rapport sprint13-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

**Apport metier principal** : ClickHouse OLAP + dashboards + Stock + HR paie CNSS/AMO/IR.

**Prerequis Sprint 14** : Sprint 13 GO complet (score >= 95% verification automatique V-13).

**Sprint suivant** : Sprint 14.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 12 (verification GO)

```bash
# Verifier Sprint 12 GO
ls skalean-insurtech/sprint12-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint12-verify-report.md
```

### Lancement Sprint 13 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-13-sprint-13-analytics-stock-hr.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-13-sprint-13-analytics-stock-hr.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-13-sprint-13-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-13.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 13"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint13-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-13** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-13-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-13 v2.2 detaille -- Sprint 13 (3.6) Analytics ClickHouse + Stock + HR.**

**Total taches detaillees** : 14 | **Effort cumul** : ~75h | **Apport** : ClickHouse OLAP + dashboards + Stock + HR paie CNSS/AMO/IR
