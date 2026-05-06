# ORCHESTRATEUR SPRINT 20 -- Phase 5 / Sprint 2 : IA Estimation Photos (mock realistic)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 20 / 35 (cumul) -- Sprint 2 dans Phase 5
**Reference meta-prompt** : `B-20-sprint-20-ia-estimation-photos.md`
**Reference verification** : `V-20-sprint-20-verification.md`
**Numerotation taches** : 5.2.1 a 5.2.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : IA Estimation Mock realistic (swap-ready Sprint 29)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 20 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-20** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-20 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 20

Sprint 20 (5.2) -- IA Estimation Photos (mock realistic). Voir B-20-sprint-20-ia-estimation-photos.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/
  task-5.2.1-prompt.md       # IaEstimationPhotosClient Interface + Types
  task-5.2.2-prompt.md       # MockIaEstimationClient Implementation
  task-5.2.3-prompt.md       # SkaleanAiVisionClient Placeholder
  task-5.2.4-prompt.md       # DI Module Configuration (Swap Factory)
  task-5.2.5-prompt.md       # Auto-Trigger Lors Diagnostic.Start()
  task-5.2.6-prompt.md       # repair_ia_estimations Entity + Service
  task-5.2.7-prompt.md       # Workflow Validation Technicien
  task-5.2.8-prompt.md       # Cache Redis 24h + Invalidation
  task-5.2.9-prompt.md       # Endpoints REST
  task-5.2.10-prompt.md       # Audit + Kafka + Analytics
  task-5.2.11-prompt.md       # Documentation Swap Sprint 30+
  task-5.2.12-prompt.md       # Tests E2E + Photos Fixtures
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-20-sprint-20-verification.md
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
4. La verification finale V-20 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-20-sprint-20-verification.md
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

## CONTEXTE PHASE 5 -- Vertical Repair (Skalean Garage ERP)

### Position du Sprint 2 dans la Phase 5

Sprint 20 (5.2) -- **IA Estimation Photos (mock realistic)**.

Voir `B-20-sprint-20-ia-estimation-photos.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

IA Estimation Mock realistic (swap-ready Sprint 29)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-20 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-20, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-20.

---

### Tache 1 / 12 : IaEstimationPhotosClient Interface + Types

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 19

**But** : Definir interface commune pour 2 implementations (Mock + Real) + types output structurees + contracts versions stable.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.1-prompt.md
```

**Actions principales attendues** :
- Interface `repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts` :
- Types input :
- Types output (return realistic structure) :
- Validation Zod schemas pour input + output (anti-injection + integrity)
- Errors typed : `IaEstimationFailedError`, `IaEstimationTimeoutError`, `IaEstimationLowConfidenceError`
- Tests : interface contracts + Zod validation

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts`
  - `repo/packages/repair/src/ia-estimation/types.ts`
  - `repo/packages/repair/src/ia-estimation/errors.ts`
  - `repo/packages/repair/src/ia-estimation/schemas.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Interface declare 3 methods
  - V2 (P0) : Types Zod-validated
  - V3 (P0) : Errors typed 3 classes

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
git commit -m "feat(sprint-20): iaestimationphotosclient interface + types

Task: 5.2.1
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.1"
```

---

### Tache 2 / 12 : MockIaEstimationClient Implementation

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.2.1

**But** : Mock client retournant data realistic (basee patterns reels reparations auto MA) permettant flows downstream fonctionnent.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.2-prompt.md
```

**Actions principales attendues** :
- Class `MockIaEstimationClient implements IaEstimationPhotosClient`
- Method `estimateDamages` :
- Edge cases :
- Pseudo-deterministic : meme input -> meme output (utilise hash photos + vehicle_data)
- Tests : 15+ scenarios damage types + edge cases

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts`
  - `repo/packages/repair/src/ia-estimation/damage-patterns.data.ts`
  - `repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Mock retourne data structuree
  - V2 (P0) : 5 damage types supportes
  - V3 (P0) : Pseudo-deterministic (seed)

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
git commit -m "feat(sprint-20): mockiaestimationclient implementation

Task: 5.2.2
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.2"
```

---

### Tache 3 / 12 : SkaleanAiVisionClient Placeholder

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.2.2

**But** : Stub `SkaleanAiVisionClient` avec interface implementation -- Sprint 30+ remplira logique reelle (HTTP call Skalean AI vision API).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.3-prompt.md
```

**Actions principales attendues** :
- Class `SkaleanAiVisionClient implements IaEstimationPhotosClient`
- Methods :
- Constructor : require `apiBaseUrl`, `apiKey` env -- valide presence sinon throws config error
- Comments documentation : indique Sprint 30+ implementation
- Tests : verifier instance creation + throws Sprint 20

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`
  - `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Class exists implementing interface
  - V2 (P0) : estimateDamages throws NotImplementedException
  - V3 (P0) : Constructor validates config

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
git commit -m "feat(sprint-20): skaleanaivisionclient placeholder

Task: 5.2.3
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.3"
```

---

### Tache 4 / 12 : DI Module Configuration (Swap Factory)

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.2.3

**But** : NestJS Module providing `IaEstimationPhotosClient` via factory based on env `IA_ESTIMATION_PROVIDER`. Permet swap Sprint 30+ une seule ligne config.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.4-prompt.md
```

**Actions principales attendues** :
- Module `repo/packages/repair/src/ia-estimation/ia-estimation.module.ts`
- Provider factory :
- Sprint 20 default : `mock` (Sprint 30+ swap to `skalean_ai`)
- Logger : log provider used at boot
- Health check : test estimation 1 photo dummy au boot
- Tests : verify mock by default + swap config

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/ia-estimation.module.ts`
  - `repo/packages/repair/src/ia-estimation/ia-estimation.module.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Module provides client
  - V2 (P0) : Mock default
  - V3 (P0) : Swap config swap implementation

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
git commit -m "feat(sprint-20): di module configuration (swap factory)

Task: 5.2.4
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.4"
```

---

### Tache 5 / 12 : Auto-Trigger Lors Diagnostic.Start()

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.2.4

**But** : Auto-call IaEstimationPhotosClient lors diagnostic start si photos disponibles + store result.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.5-prompt.md
```

**Actions principales attendues** :
- Update Sprint 19 `diagnostics.service.ts.start()` :
- Job BullMQ : `RunIaEstimationJob` (queue `ia-estimations`) handle async (peut prendre 30s+)
- Retry policy : 3 attempts exponential backoff
- DLQ apres echecs : alert technicien manuel diagnostic
- Tests : trigger + async + retry + DLQ

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/diagnostics.service.ts`
  - `repo/packages/repair/src/jobs/run-ia-estimation.job.ts`
  - `repo/packages/repair/src/jobs/ia-estimation-worker.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Auto-trigger lors diagnostic start
  - V2 (P0) : Async via BullMQ
  - V3 (P0) : Retry 3x backoff

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
git commit -m "feat(sprint-20): auto-trigger lors diagnostic.start()

Task: 5.2.5
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.5"
```

---

### Tache 6 / 12 : repair_ia_estimations Entity + Service

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.2.5

**But** : Storage results IA estimation : preservation history + audit + analytics.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.6-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_ia_estimations` :
- Service `ia-estimations.service.ts` :
- Endpoints :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairIaEstimations.ts`
  - `repo/packages/repair/src/entities/repair-ia-estimation.entity.ts`
  - `repo/packages/repair/src/services/ia-estimations.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/ia-estimations.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration creee
  - V2 (P0) : Service CRUD operationnel
  - V3 (P0) : technician_edits diff stocke

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
git commit -m "feat(sprint-20): repair_ia_estimations entity + service

Task: 5.2.6
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.6"
```

---

### Tache 7 / 12 : Workflow Validation Technicien

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.2.6

**But** : Technicien diagnostic page (Sprint 22 web-garage) : voir suggestions IA + edit/accept/reject + apply au diagnostic.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.7-prompt.md
```

**Actions principales attendues** :
- Workflow process :
- Endpoint `POST /api/v1/repair/diagnostics/:id/apply-ia-estimation` body { ia_estimation_id, action: 'accept' | 'edit' | 'reject', edits? }
- Audit + Kafka events
- Tests : 3 actions

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/diagnostics.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/diagnostics.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Accept copies suggestions
  - V2 (P0) : Edit applies + logs diff
  - V3 (P0) : Reject preserves diagnostic vide

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
git commit -m "feat(sprint-20): workflow validation technicien

Task: 5.2.7
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.7"
```

---

### Tache 8 / 12 : Cache Redis 24h + Invalidation

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.2.7

**But** : Cache responses IA 24h Redis (eviter re-call meme input + reduire cout Skalean AI Sprint 30+).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.8-prompt.md
```

**Actions principales attendues** :
- Wrapper cache autour client :
- Invalidation manuelle endpoint super admin (en cas mauvais output)
- Metrics : cache hit ratio (Sprint 27 admin dashboard)
- Tests cache hit/miss + invalidation

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts`
  - `repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cache hit returns same result
  - V2 (P0) : Cache miss calls client
  - V3 (P0) : TTL 24h

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
git commit -m "feat(sprint-20): cache redis 24h + invalidation

Task: 5.2.8
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.8"
```

---

### Tache 9 / 12 : Endpoints REST

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.2.8

**But** : Endpoints REST exposes IA estimations + admin monitoring + permissions.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.9-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes
- Endpoint admin : `GET /api/v1/admin/ia-estimations/health` :
- Endpoint manual trigger (re-run estimation) : `POST /api/v1/repair/diagnostics/:id/re-estimate`
- Permissions : `repair.ia_estimations.read/validate`, `admin.ia_estimations.monitor`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/admin/controllers/admin-ia-estimations.controller.ts`
  - `repo/packages/auth/src/rbac/permissions.enum.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Endpoints REST operationnels
  - V2 (P0) : Health endpoint
  - V3 (P0) : Manual re-estimate

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
git commit -m "feat(sprint-20): endpoints rest

Task: 5.2.9
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.9"
```

---

### Tache 10 / 12 : Audit + Kafka + Analytics

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.2.9

**But** : Audit complet + Kafka events + integration ETL Sprint 13 ClickHouse pour analytics IA.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.10-prompt.md
```

**Actions principales attendues** :
- Kafka events :
- ETL Sprint 13 etend : sync `repair_ia_estimations` -> `fct_ia_estimations`
- Dashboard IA : cache hit / latency / accuracy (technician acceptance rate)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
  - `repo/infrastructure/clickhouse/schemas/fct_ia_estimations.sql`
  - `repo/apps/api/src/modules/analytics/services/ia-estimations-dashboard.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Kafka events emits
  - V2 (P0) : ETL sync clickhouse
  - V3 (P0) : Dashboard accuracy + perf

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
git commit -m "feat(sprint-20): audit + kafka + analytics

Task: 5.2.10
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.10"
```

---

### Tache 11 / 12 : Documentation Swap Sprint 30+

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.2.10

**But** : Documentation complete migration Mock -> Real Skalean AI Sprint 30+ : checklist + swap procedure + validation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.11-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/ia-estimation-migration-sprint-30.md`
- Sections :
- Tests integration Sprint 30+ template (a remplir par equipe Sprint 30)

**Fichiers cibles principaux** :
  - `repo/docs/ia-estimation-migration-sprint-30.md`
  - `repo/docs/ia-estimation-architecture.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Documentation complete
  - V2 (P0) : Procedure detaillee
  - V3 (P0) : Tests integration template

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
git commit -m "feat(sprint-20): documentation swap sprint 30+

Task: 5.2.11
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.11"
```

---

### Tache 12 / 12 : Tests E2E + Photos Fixtures

**Metadonnees** : P0 | 8h | Depend de : Depend de 5.2.11

**But** : Suite tests E2E + fixtures photos realistic (10+ photos per damage type) pour reproducibility.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/task-5.2.12-prompt.md
```

**Actions principales attendues** :
- Mock client : 5 damage types + edge cases (10)
- DI swap : provider config (3)
- Auto-trigger : diagnostic start -> ia estimation (3)
- Workflow validation technicien : accept / edit / reject (3)
- Cache : hit/miss/invalidate (3)
- Audit + Kafka events (3)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/repair/ia-estimation/{25+ specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-photos-fixtures.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 25+ tests passent
  - V2 (P0) : Fixtures photos reproducibles
  - V3 (P0) : CI green

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
git commit -m "feat(sprint-20): tests e2e + photos fixtures

Task: 5.2.12
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-20 Tache 5.2.12"
```

---


## VERIFICATION DU SPRINT 20

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-20-sprint-20-verification.md
```

Le fichier de verification V-20 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint20-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint20-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint20-verify-report.md
git commit -m "chore(sprint-20): close sprint 20 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 20 (Phase 5 / Sprint 2)
- Apport : IA Estimation Mock realistic (swap-ready Sprint 29)
- Tests E2E cumules : {N}+

Sprint 20 completed -- handoff to Sprint 21."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 20]
   |
   v
[Tache 5.2.1: IaEstimationPhotosClient Interface + Types]
   | -> compile -> tests -> commit
   v
[Tache 5.2.2: MockIaEstimationClient Implementation]
   | -> compile -> tests -> commit
   v
[Tache 5.2.3: SkaleanAiVisionClient Placeholder]
   | -> compile -> tests -> commit
   v
[Tache 5.2.4: DI Module Configuration (Swap Factory)]
   | -> compile -> tests -> commit
   v
[Tache 5.2.5: Auto-Trigger Lors Diagnostic.Start()]
   | -> compile -> tests -> commit
   v
[Tache 5.2.6: repair_ia_estimations Entity + Service]
   | -> compile -> tests -> commit
   v
[Tache 5.2.7: Workflow Validation Technicien]
   | -> compile -> tests -> commit
   v
[Tache 5.2.8: Cache Redis 24h + Invalidation]
   | -> compile -> tests -> commit
   v
[Tache 5.2.9: Endpoints REST]
   | -> compile -> tests -> commit
   v
[Tache 5.2.10: Audit + Kafka + Analytics]
   | -> compile -> tests -> commit
   v
[Tache 5.2.11: Documentation Swap Sprint 30+]
   | -> compile -> tests -> commit
   v
[Tache 5.2.12: Tests E2E + Photos Fixtures]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 20 -- V-20]
   |
   v
[Rapport sprint20-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : IA Estimation Mock realistic (swap-ready Sprint 29).

**Prerequis Sprint 21** : Sprint 20 GO complet (score >= 95% verification automatique V-20).

**Sprint suivant** : Sprint 21.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 19 (verification GO)

```bash
# Verifier Sprint 19 GO
ls skalean-insurtech/sprint19-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint19-verify-report.md
```

### Lancement Sprint 20 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-20-sprint-20-ia-estimation-photos.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-20-sprint-20-ia-estimation-photos.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-20-sprint-20-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-20.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 20"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint20-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-20** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-20-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-20 v2.2 detaille -- Sprint 20 (5.2) IA Estimation Photos (mock realistic).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : IA Estimation Mock realistic (swap-ready Sprint 29)
