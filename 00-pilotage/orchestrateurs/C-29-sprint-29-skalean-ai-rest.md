# ORCHESTRATEUR SPRINT 29 -- Phase 7 / Sprint 1 : Skalean AI REST Integration (swap Mock -> Real)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 29 / 35 (cumul) -- Sprint 1 dans Phase 7
**Reference meta-prompt** : `B-29-sprint-29-skalean-ai-rest.md`
**Reference verification** : `V-29-sprint-29-verification.md`
**Numerotation taches** : 7.1.1 a 7.1.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : Skalean AI integration reelle (swap Mock -> Real)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 29 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-29** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-29 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 29

Sprint 29 (7.1) -- Skalean AI REST Integration (swap Mock -> Real). Voir B-29-sprint-29-skalean-ai-rest.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/
  task-7.1.1-prompt.md       # SkaleanAiVisionClient HTTP Implementation
  task-7.1.2-prompt.md       # Auth + Headers + Versioning + Retry
  task-7.1.3-prompt.md       # Cache Redis 24h Reuse
  task-7.1.4-prompt.md       # Circuit Breaker + Health Check + Fallback Mock
  task-7.1.5-prompt.md       # Cost Monitoring + Budget Alerts
  task-7.1.6-prompt.md       # Activation Gradual Feature Flag
  task-7.1.7-prompt.md       # Migration Validation : 100 Mock vs Real
  task-7.1.8-prompt.md       # Performance Comparison Benchmarks
  task-7.1.9-prompt.md       # Rollback Procedure
  task-7.1.10-prompt.md       # Admin Dashboard Skalean AI
  task-7.1.11-prompt.md       # Documentation Finale
  task-7.1.12-prompt.md       # Tests Integration End-to-End
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-29-sprint-29-verification.md
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
4. La verification finale V-29 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-29-sprint-29-verification.md
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

## CONTEXTE PHASE 7 -- Hardening + Integrations + Pilote

### Position du Sprint 1 dans la Phase 7

Sprint 29 (7.1) -- **Skalean AI REST Integration (swap Mock -> Real)**.

Voir `B-29-sprint-29-skalean-ai-rest.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

### Apport metier de ce sprint

Skalean AI integration reelle (swap Mock -> Real)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-29 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-29, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-29.

---

### Tache 1 / 12 : SkaleanAiVisionClient HTTP Implementation

**Metadonnees** : P0 | 7h | Depend de : Depend de Sprint 20

**But** : Implementation complete `SkaleanAiVisionClient` -- replace stub Sprint 20 Tache 5.2.3 par integration HTTP REST reelle.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.1-prompt.md
```

**Actions principales attendues** :
- Class `SkaleanAiVisionClient implements IaEstimationPhotosClient`
- Method `estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput>` :
- Method `getCacheKey(input)` : memorise meme strategy Mock (hash photos + vehicle)
- Provider = `'skalean_ai'`
- Tests unit : mock HTTP responses + validation outputs + edge cases

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`
  - `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts`
  - `repo/packages/repair/src/ia-estimation/skalean-ai-config.ts`
  - `repo/packages/repair/src/ia-estimation/skalean-ai-mapping.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Implementation complete (replace stub)
  - V2 (P0) : HTTP request + headers correct
  - V3 (P0) : Mapping Skalean AI -> Sprint 20 format

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
git commit -m "feat(sprint-29): skaleanaivisionclient http implementation

Task: 7.1.1
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.1"
```

---

### Tache 2 / 12 : Auth + Headers + Versioning + Retry

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.1.1

**But** : Auth strategy enrichie + retry policy + headers complete pour interactions stables.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.2-prompt.md
```

**Actions principales attendues** :
- Auth : Bearer token rotation strategy :
- Retry strategy avec exponential backoff :
- Headers complete :
- Tests retry + auth + headers

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/skalean-ai-retry-policy.ts`
  - `repo/packages/repair/src/ia-estimation/skalean-ai-auth.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Bearer auth + KMS
  - V2 (P0) : Retry exponential backoff
  - V3 (P0) : 429 retry-after respect

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
git commit -m "feat(sprint-29): auth + headers + versioning + retry

Task: 7.1.2
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.2"
```

---

### Tache 3 / 12 : Cache Redis 24h Reuse

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.1.2

**But** : Reuse cache wrapper Sprint 20 Tache 5.2.8 avec optimization cost reduction.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.3-prompt.md
```

**Actions principales attendues** :
- Cache wrapper deja livre Sprint 20 -- verify fonctionne avec Skalean AI provider
- Cache key inclut provider : `ia_estimation:skalean_ai:{hash}` (vs Mock `ia_estimation:mock:{hash}`)
- TTL configurable per provider :
- Metrics cache hit ratio : per provider + per tenant
- Cost reduction tracking : `cache_hits_saved_calls * avg_cost_per_call = savings_mad`
- Endpoint admin : `GET /api/v1/admin/ai/cache-stats`

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts`
  - `repo/packages/admin/src/services/ai-cache-stats.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/ai-monitoring.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cache hit ratio per provider
  - V2 (P0) : Savings MAD computed
  - V3 (P0) : Endpoint admin stats

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
git commit -m "feat(sprint-29): cache redis 24h reuse

Task: 7.1.3
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.3"
```

---

### Tache 4 / 12 : Circuit Breaker + Health Check + Fallback Mock

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.1.3

**But** : Circuit breaker opossum + health check + fallback Mock si Skalean AI down (graceful degradation).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.4-prompt.md
```

**Actions principales attendues** :
- Circuit breaker config :
- States : closed (healthy) / open (failing) / half-open (testing recovery)
- Fallback : si circuit open OR errors -> degrade vers MockIaEstimationClient
- Logging breaker state transitions + alerts super_admin
- Health check endpoint `/health/skalean-ai` :
- Auto-recovery : breaker reopen apres healthy successive calls

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/skalean-ai-circuit-breaker.ts`
  - `repo/apps/api/src/modules/admin/controllers/ai-health.controller.ts`
  - `repo/packages/comm/src/templates/{fr}/admin-skalean-ai-{breaker-alert,recovered}.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Circuit breaker config
  - V2 (P0) : Fallback Mock automatic
  - V3 (P0) : Health check endpoint

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
git commit -m "feat(sprint-29): circuit breaker + health check + fallback mock

Task: 7.1.4
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.4"
```

---

### Tache 5 / 12 : Cost Monitoring + Budget Alerts

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.1.4

**But** : Tracking cout per call + per tenant + budget alerts + dashboard cost.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.5-prompt.md
```

**Actions principales attendues** :
- Migration : table `ia_estimation_calls_log` :
- Service `cost-tracking.service.ts` :
- Tariff Skalean AI (configuration env) :
- Budget alerts :
- Cron daily : compute current spend + alert si depassement
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-IaEstimationCallsLog.ts`
  - `repo/packages/repair/src/entities/ia-estimation-call-log.entity.ts`
  - `repo/packages/admin/src/services/cost-tracking.service.ts`
  - `repo/packages/admin/src/jobs/budget-alerts.cron.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Calls log
  - V2 (P0) : Cost computation per call
  - V3 (P0) : Budget thresholds

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
git commit -m "feat(sprint-29): cost monitoring + budget alerts

Task: 7.1.5
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.5"
```

---

### Tache 6 / 12 : Activation Gradual Feature Flag

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.1.5

**But** : Feature flag percentage-based rollout : 0% -> 10% -> 50% -> 100% trafic Skalean AI vs Mock.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.6-prompt.md
```

**Actions principales attendues** :
- Variable env `IA_ESTIMATION_ROLLOUT_PERCENT` (0-100, default 0)
- Service `IaEstimationRouter` :
- Update Sprint 20 DI Module : utilise router au lieu single client
- Endpoint admin : `POST /api/v1/admin/ai/rollout/set` body { percent } -- super_admin only
- Audit complet rollout changes
- Plan rollout typique :

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/ia-estimation/ia-estimation-router.ts`
  - `repo/packages/admin/src/services/rollout.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/rollout.controller.ts`
  - `repo/packages/repair/src/ia-estimation/ia-estimation.module.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Router percentage-based
  - V2 (P0) : Deterministic per input
  - V3 (P0) : Endpoint admin set rollout

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
git commit -m "feat(sprint-29): activation gradual feature flag

Task: 7.1.6
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.6"
```

---

### Tache 7 / 12 : Migration Validation : 100 Mock vs Real

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.1.6

**But** : Script validation : compare 100 estimations Mock vs Real Skalean AI -- verifier coherence outputs.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.7-prompt.md
```

**Actions principales attendues** :
- Script `repo/infrastructure/scripts/validate-skalean-ai-migration.ts` :
- Run sandbox Skalean AI (env staging dedicated)
- Document acceptance criteria : delta total_cost_estimate < 30% avg + > 80% damages_count_match
- Tests script + idempotency

**Fichiers cibles principaux** :
  - `repo/infrastructure/scripts/validate-skalean-ai-migration.ts`
  - `repo/infrastructure/scripts/migration-validation-report.template.html`
  - `repo/infrastructure/fixtures/ia-estimation-100-validation.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Script execute 100 inputs
  - V2 (P0) : Report HTML genere
  - V3 (P0) : Acceptance criteria documente

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
git commit -m "feat(sprint-29): migration validation : 100 mock vs real

Task: 7.1.7
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.7"
```

---

### Tache 8 / 12 : Performance Comparison Benchmarks

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.1.7

**But** : Benchmarks performance : latency p95 Mock vs Real + accuracy benchmarks.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.8-prompt.md
```

**Actions principales attendues** :
- Script `benchmark-skalean-ai-performance.ts` :
- Benchmarks accuracy :
- Reports : 2 reports HTML
- Tests

**Fichiers cibles principaux** :
  - `repo/infrastructure/scripts/benchmark-skalean-ai-performance.ts`
  - `repo/infrastructure/scripts/benchmark-skalean-ai-accuracy.ts`
  - `repo/infrastructure/fixtures/100-annotated-scenarios.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Benchmarks executes
  - V2 (P0) : Reports generes
  - V3 (P0) : Insights documentes (latency vs accuracy trade-off)

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
git commit -m "feat(sprint-29): performance comparison benchmarks

Task: 7.1.8
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.8"
```

---

### Tache 9 / 12 : Rollback Procedure

**Metadonnees** : P0 | 4h | Depend de : Depend de 7.1.8

**But** : Procedure rollback : si issues detectees post-rollout, revert vers Mock rapidement.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.9-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/skalean-ai-rollback-procedure.md`
- Sections :
- Tests rollback : simulate via env change + verify all traffic Mock < 60s
- Runbook ops : page Notion liens incident response

**Fichiers cibles principaux** :
  - `repo/docs/skalean-ai-rollback-procedure.md`
  - `repo/docs/skalean-ai-incident-response-runbook.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Procedure complete
  - V2 (P0) : Decision tree clair
  - V3 (P0) : Tests rollback < 60s

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
git commit -m "feat(sprint-29): rollback procedure

Task: 7.1.9
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.9"
```

---

### Tache 10 / 12 : Admin Dashboard Skalean AI

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.1.9

**But** : Page admin dashboard Skalean AI : metrics + costs + accuracy + alerts visibility.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.10-prompt.md
```

**Actions principales attendues** :
- Page `/ai-monitoring/skalean-ai` :
- Action buttons :
- Real-time refresh 30s
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/skalean-ai/page.tsx`
  - `repo/apps/web-insurtech-admin/components/ai-monitoring/{several charts}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Dashboard complet
  - V2 (P0) : Real-time refresh
  - V3 (P0) : Actions admin

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
git commit -m "feat(sprint-29): admin dashboard skalean ai

Task: 7.1.10
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.10"
```

---

### Tache 11 / 12 : Documentation Finale

**Metadonnees** : P0 | 4h | Depend de : Depend de 7.1.10

**But** : Documentation complete integration + runbook ops + onboarding equipe.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.11-prompt.md
```

**Actions principales attendues** :
- Documents :
- Diagrammes Mermaid

**Fichiers cibles principaux** :
  - `repo/docs/skalean-ai-integration-architecture.md`
  - `repo/docs/skalean-ai-onboarding-guide.md`
  - `repo/docs/skalean-ai-cost-optimization.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 documents complets
  - V2 (P0) : Diagrams clairs

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
git commit -m "feat(sprint-29): documentation finale

Task: 7.1.11
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.11"
```

---

### Tache 12 / 12 : Tests Integration End-to-End

**Metadonnees** : P0 | 9h | Depend de : Depend de 7.1.11

**But** : Suite tests integration end-to-end avec sandbox Skalean AI + tests resilience.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/task-7.1.12-prompt.md
```

**Actions principales attendues** :
- HTTP integration sandbox : success + 200 OK (3)
- Errors handling : 401 / 402 / 429 / 500 (4)
- Retry exponential backoff (2)
- Circuit breaker open + fallback Mock (2)
- Cost tracking accuracy (2)
- Rollout router percentage (2)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/integration/skalean-ai/{15+ specs}.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : Sandbox integration green
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
git commit -m "feat(sprint-29): tests integration end-to-end

Task: 7.1.12
Sprint: 29 (Phase 7 / Sprint 1)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-29 Tache 7.1.12"
```

---


## VERIFICATION DU SPRINT 29

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-29-sprint-29-verification.md
```

Le fichier de verification V-29 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint29-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint29-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint29-verify-report.md
git commit -m "chore(sprint-29): close sprint 29 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 7 (Hardening + Integrations + Pilote)
- Sprint : 29 (Phase 7 / Sprint 1)
- Apport : Skalean AI integration reelle (swap Mock -> Real)
- Tests E2E cumules : {N}+

Sprint 29 completed -- handoff to Sprint 30."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 29]
   |
   v
[Tache 7.1.1: SkaleanAiVisionClient HTTP Implementation]
   | -> compile -> tests -> commit
   v
[Tache 7.1.2: Auth + Headers + Versioning + Retry]
   | -> compile -> tests -> commit
   v
[Tache 7.1.3: Cache Redis 24h Reuse]
   | -> compile -> tests -> commit
   v
[Tache 7.1.4: Circuit Breaker + Health Check + Fallback Mock]
   | -> compile -> tests -> commit
   v
[Tache 7.1.5: Cost Monitoring + Budget Alerts]
   | -> compile -> tests -> commit
   v
[Tache 7.1.6: Activation Gradual Feature Flag]
   | -> compile -> tests -> commit
   v
[Tache 7.1.7: Migration Validation : 100 Mock vs Real]
   | -> compile -> tests -> commit
   v
[Tache 7.1.8: Performance Comparison Benchmarks]
   | -> compile -> tests -> commit
   v
[Tache 7.1.9: Rollback Procedure]
   | -> compile -> tests -> commit
   v
[Tache 7.1.10: Admin Dashboard Skalean AI]
   | -> compile -> tests -> commit
   v
[Tache 7.1.11: Documentation Finale]
   | -> compile -> tests -> commit
   v
[Tache 7.1.12: Tests Integration End-to-End]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 29 -- V-29]
   |
   v
[Rapport sprint29-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

**Apport metier principal** : Skalean AI integration reelle (swap Mock -> Real).

**Prerequis Sprint 30** : Sprint 29 GO complet (score >= 95% verification automatique V-29).

**Sprint suivant** : Sprint 30.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 28 (verification GO)

```bash
# Verifier Sprint 28 GO
ls skalean-insurtech/sprint28-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint28-verify-report.md
```

### Lancement Sprint 29 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-29-sprint-29-skalean-ai-rest.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-29-sprint-29-skalean-ai-rest.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-29-sprint-29-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-29.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 29"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint29-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-29** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-29-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-29 v2.2 detaille -- Sprint 29 (7.1) Skalean AI REST Integration (swap Mock -> Real).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : Skalean AI integration reelle (swap Mock -> Real)
