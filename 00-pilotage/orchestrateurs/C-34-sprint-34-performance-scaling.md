# ORCHESTRATEUR SPRINT 34 -- Phase 7 / Sprint 6 : Performance Scaling (load + chaos + SLOs)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 34 / 35 (cumul) -- Sprint 6 dans Phase 7
**Reference meta-prompt** : `B-34-sprint-34-performance-scaling.md`
**Reference verification** : `V-34-sprint-34-verification.md`
**Numerotation taches** : 7.6.1 a 7.6.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : Load 1000+ tenants + chaos + SLOs validated + autoscaling

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 34 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-34** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-34 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 34

Sprint 34 (7.6) -- Performance Scaling (load + chaos + SLOs). Voir B-34-sprint-34-performance-scaling.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/
  task-7.6.1-prompt.md       # SLOs Definition + APM Setup
  task-7.6.2-prompt.md       # Load Testing K6 Scenarios
  task-7.6.3-prompt.md       # Database Optimization
  task-7.6.4-prompt.md       # Read Replicas Postgres + Connection Pooling
  task-7.6.5-prompt.md       # Cache Strategy Redis Cluster
  task-7.6.6-prompt.md       # CDN Cloudflare
  task-7.6.7-prompt.md       # Horizontal Scaling
  task-7.6.8-prompt.md       # Kafka Throughput Optimization
  task-7.6.9-prompt.md       # Cost Optimization
  task-7.6.10-prompt.md       # Stress Testing + Chaos Engineering
  task-7.6.11-prompt.md       # SLI/SLO Dashboards + Alerts + Runbook
  task-7.6.12-prompt.md       # Documentation + Acceptance Criteria Sprint 35
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-34-sprint-34-verification.md
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
4. La verification finale V-34 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-34-sprint-34-verification.md
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

### Position du Sprint 6 dans la Phase 7

Sprint 34 (7.6) -- **Performance Scaling (load + chaos + SLOs)**.

Voir `B-34-sprint-34-performance-scaling.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

### Apport metier de ce sprint

Load 1000+ tenants + chaos + SLOs validated + autoscaling

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-34 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-34, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-34.

---

### Tache 1 / 12 : SLOs Definition + APM Setup

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 33

**But** : Definir SLIs (Service Level Indicators) + SLOs (Objectives) + setup APM monitoring (Datadog OU Grafana Cloud).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.1-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/performance/slos-defined.md`
- SLIs critiques :
- SLOs cibles per app :
- APM integration :
- Test : APM operationnel + traces visible

**Fichiers cibles principaux** :
  - `repo/docs/performance/slos-defined.md`
  - `repo/infrastructure/observability/datadog-config.yaml`
  - `repo/packages/common/src/observability/{tracing,metrics}.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : SLOs documente
  - V2 (P0) : APM operationnel
  - V3 (P0) : Distributed traces visible

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
git commit -m "feat(sprint-34): slos definition + apm setup

Task: 7.6.1
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.1"
```

---

### Tache 2 / 12 : Load Testing K6 Scenarios

**Metadonnees** : P0 | 8h | Depend de : Depend de 7.6.1

**But** : Suite K6 load testing avec scenarios realistic per app.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.2-prompt.md
```

**Actions principales attendues** :
- Scenarios K6 :
- Scenarios per workflow critique :
- Distributed K6 : multi-runners pour 1000+ RPS
- Output : pass/fail per SLO threshold + reports HTML
- CI/CD integration : run K6 nightly + alerts si regression

**Fichiers cibles principaux** :
  - `repo/load-tests/`
  - `repo/load-tests/scenarios/{api-load,api-stress,api-soak,api-spike}.js`
  - `repo/load-tests/scenarios/workflows/{login,quote,sinistre-dispatch,sky-chat}.js`
  - `repo/load-tests/lib/setup.js`
  - `repo/.github/workflows/load-tests.yml`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 4 scenarios api
  - V2 (P0) : 4 workflows critiques
  - V3 (P0) : SLO thresholds enforced

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
git commit -m "feat(sprint-34): load testing k6 scenarios

Task: 7.6.2
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.2"
```

---

### Tache 3 / 12 : Database Optimization

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.6.2

**But** : Optimization Postgres : indexes review + slow queries + N+1 patterns.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.3-prompt.md
```

**Actions principales attendues** :
- Slow queries identification :
- Indexes review :
- N+1 patterns elimination :
- Database statistics : `ANALYZE` regular
- Vacuum strategy : autovacuum tuning
- Tests : queries critiques < 100ms apres optimization

**Fichiers cibles principaux** :
  - `repo/docs/performance/database-optimization-report.md`
  - `repo/packages/database/src/migrations/{date}-AddPerformanceIndexes.ts`
  - `repo/packages/database/src/migrations/{date}-DropUnusedIndexes.ts`
  - `repo/infrastructure/scripts/db-performance-audit.sql`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Slow queries identifies + fixed
  - V2 (P0) : Indexes optimises
  - V3 (P0) : N+1 patterns elimines

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
git commit -m "feat(sprint-34): database optimization

Task: 7.6.3
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.3"
```

---

### Tache 4 / 12 : Read Replicas Postgres + Connection Pooling

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.6.3

**But** : Setup read replicas Postgres + tuning connection pooling pour scaling reads.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.4-prompt.md
```

**Actions principales attendues** :
- Read replicas setup AWS RDS / Azure / GCP :
- TypeORM data sources :
- Service `read-replica-router.ts` :
- Connection pooling pgBouncer :
- Tests : reads/writes routing + replica lag handling

**Fichiers cibles principaux** :
  - `repo/packages/database/src/data-sources/master-data-source.ts`
  - `repo/packages/database/src/data-sources/replica-data-source.ts`
  - `repo/packages/database/src/services/read-replica-router.service.ts`
  - `repo/infrastructure/pgbouncer/pgbouncer.ini`
  - `repo/docs/performance/read-replicas-architecture.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Read replicas operationnels
  - V2 (P0) : Routing queries correct
  - V3 (P0) : Replica lag monitored

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
git commit -m "feat(sprint-34): read replicas postgres + connection pooling

Task: 7.6.4
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.4"
```

---

### Tache 5 / 12 : Cache Strategy Redis Cluster

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.6.4

**But** : Review cache strategy Redis : TTLs + hit ratios + cluster setup pour HA.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.5-prompt.md
```

**Actions principales attendues** :
- Redis Cluster setup : 3 nodes (HA + sharding)
- Audit TTLs current Redis usage :
- Hit ratios target : > 70% per cache type
- Eviction policy : `allkeys-lru` (vs noeviction default)
- Persistence : AOF every second + RDB hourly
- Monitoring : Redis INFO + alerts memory > 80%

**Fichiers cibles principaux** :
  - `repo/infrastructure/redis/cluster-config.yaml`
  - `repo/docs/performance/cache-strategy-review.md`
  - `repo/packages/cache/src/services/cache-monitoring.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Redis cluster 3 nodes
  - V2 (P0) : Hit ratios > 70%
  - V3 (P0) : Failover tested

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
git commit -m "feat(sprint-34): cache strategy redis cluster

Task: 7.6.5
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.5"
```

---

### Tache 6 / 12 : CDN Cloudflare

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.6.5

**But** : CDN Cloudflare pour static assets (8 apps) + edge caching + smart routing geographique.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.6-prompt.md
```

**Actions principales attendues** :
- Cloudflare setup :
- Static assets routing : `/static/*`, `/_next/static/*` -> CDN cache 1 year
- HTML pages : SSR cache 5 min (selon app)
- API endpoints : NO cache (dynamic)
- Smart routing : Cloudflare Argo Smart Routing (latence reduit Maroc <-> Europe origins)
- WAF rules : OWASP Core Rule Set + custom rules abuse patterns

**Fichiers cibles principaux** :
  - `repo/infrastructure/cloudflare/{8 zones}.yaml`
  - `repo/infrastructure/cloudflare/waf-rules.yaml`
  - `repo/docs/performance/cdn-strategy.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 8 domains CDN configures
  - V2 (P0) : Static cache 1 year
  - V3 (P0) : WAF rules active

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
git commit -m "feat(sprint-34): cdn cloudflare

Task: 7.6.6
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.6"
```

---

### Tache 7 / 12 : Horizontal Scaling

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.6.6

**But** : Horizontal scaling : autoscaling rules + load balancers + health checks per service.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.7-prompt.md
```

**Actions principales attendues** :
- AWS Auto Scaling Groups (or equivalent) per service :
- Load balancer (ALB / equivalent) :
- Kubernetes alternative : HPA (Horizontal Pod Autoscaler) sur CPU + custom metrics
- Scale-up triggers : CPU > 70% sustained 3min OR latency p95 > 500ms
- Scale-down triggers : CPU < 30% sustained 10min (avoid flapping)
- Tests scaling : load test triggers scale-up + verify

**Fichiers cibles principaux** :
  - `repo/infrastructure/aws/autoscaling-groups.yaml`
  - `repo/infrastructure/k8s/hpa-{service}.yaml`
  - `repo/docs/performance/horizontal-scaling-strategy.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Autoscaling rules configures
  - V2 (P0) : Load balancers + health checks
  - V3 (P0) : Scale-up tested

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
git commit -m "feat(sprint-34): horizontal scaling

Task: 7.6.7
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.7"
```

---

### Tache 8 / 12 : Kafka Throughput Optimization

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.6.7

**But** : Optimization Kafka throughput + consumer lag monitoring.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.8-prompt.md
```

**Actions principales attendues** :
- Topics partitioning review :
- Producers config :
- Consumers config :
- Consumer lag monitoring : alerts si lag > 10000 messages
- Dead Letter Queues : every consumer + replay capability
- Tests : throughput benchmarks before/after

**Fichiers cibles principaux** :
  - `repo/infrastructure/kafka/topics-partitioning.yaml`
  - `repo/packages/kafka/src/config/{producer,consumer}-config.ts`
  - `repo/docs/performance/kafka-optimization.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Partitions optimises
  - V2 (P0) : Throughput +50% mesure
  - V3 (P0) : Consumer lag monitored

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
git commit -m "feat(sprint-34): kafka throughput optimization

Task: 7.6.8
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.8"
```

---

### Tache 9 / 12 : Cost Optimization

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.6.8

**But** : Right-sizing instances + reserved capacity + storage tiers + cost monitoring.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.9-prompt.md
```

**Actions principales attendues** :
- Right-sizing :
- Reserved instances strategy :
- Storage tiers :
- Cost monitoring :
- FinOps culture : monthly review costs + optimization opportunities
- Documentation cost playbook

**Fichiers cibles principaux** :
  - `repo/docs/performance/cost-optimization-strategy.md`
  - `repo/infrastructure/aws/reserved-instances-plan.yaml`
  - `repo/infrastructure/scripts/cost-anomaly-detector.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Right-sizing complete
  - V2 (P0) : Reserved instances plan
  - V3 (P0) : Cost monitoring + alerts

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
git commit -m "feat(sprint-34): cost optimization

Task: 7.6.9
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.9"
```

---

### Tache 10 / 12 : Stress Testing + Chaos Engineering

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.6.9

**But** : Stress testing breaking points + chaos engineering tests resilience.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.10-prompt.md
```

**Actions principales attendues** :
- Stress tests :
- Chaos engineering :
- Recovery times mesures (RTO actual vs target)
- Documentation findings + improvements

**Fichiers cibles principaux** :
  - `repo/load-tests/stress/{stress,spike,soak}.js`
  - `repo/load-tests/chaos/{several scenarios}.yaml`
  - `repo/docs/performance/chaos-engineering-results.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Breaking point identifie
  - V2 (P0) : Spike recovery
  - V3 (P0) : Chaos experiments executes

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
git commit -m "feat(sprint-34): stress testing + chaos engineering

Task: 7.6.10
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.10"
```

---

### Tache 11 / 12 : SLI/SLO Dashboards + Alerts + Runbook

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.6.10

**But** : Dashboards SLI/SLO + alerts proactives + runbook ops capacity planning.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.11-prompt.md
```

**Actions principales attendues** :
- Dashboards Datadog/Grafana :
- Alerts :
- Runbook ops capacity planning :
- Tests dashboards + alerts

**Fichiers cibles principaux** :
  - `repo/infrastructure/observability/dashboards/{several}.json`
  - `repo/infrastructure/observability/alerts/{several}.yaml`
  - `repo/docs/performance/runbook-ops-capacity-planning.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5+ dashboards
  - V2 (P0) : Alerts critical/warning
  - V3 (P0) : Runbook ops

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
git commit -m "feat(sprint-34): sli/slo dashboards + alerts + runbook

Task: 7.6.11
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.11"
```

---

### Tache 12 / 12 : Documentation + Acceptance Criteria Sprint 35

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.6.11

**But** : Documentation performance + acceptance criteria pour Sprint 35 pilote ready.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-34-performance-scaling/task-7.6.12-prompt.md
```

**Actions principales attendues** :
- Documents :
- Acceptance criteria Sprint 35 (must-have avant pilote) :

**Fichiers cibles principaux** :
  - `repo/docs/performance/performance-guide.md`
  - `repo/docs/performance/scaling-architecture.md`
  - `repo/docs/performance/sprint-35-pilot-acceptance-criteria.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 documents complets
  - V2 (P0) : Acceptance criteria Sprint 35

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
git commit -m "feat(sprint-34): documentation + acceptance criteria sprint 35

Task: 7.6.12
Sprint: 34 (Phase 7 / Sprint 6)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-34 Tache 7.6.12"
```

---


## VERIFICATION DU SPRINT 34

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-34-sprint-34-verification.md
```

Le fichier de verification V-34 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint34-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint34-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint34-verify-report.md
git commit -m "chore(sprint-34): close sprint 34 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 7 (Hardening + Integrations + Pilote)
- Sprint : 34 (Phase 7 / Sprint 6)
- Apport : Load 1000+ tenants + chaos + SLOs validated + autoscaling
- Tests E2E cumules : {N}+

Sprint 34 completed -- handoff to Sprint 35."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 34]
   |
   v
[Tache 7.6.1: SLOs Definition + APM Setup]
   | -> compile -> tests -> commit
   v
[Tache 7.6.2: Load Testing K6 Scenarios]
   | -> compile -> tests -> commit
   v
[Tache 7.6.3: Database Optimization]
   | -> compile -> tests -> commit
   v
[Tache 7.6.4: Read Replicas Postgres + Connection Pooling]
   | -> compile -> tests -> commit
   v
[Tache 7.6.5: Cache Strategy Redis Cluster]
   | -> compile -> tests -> commit
   v
[Tache 7.6.6: CDN Cloudflare]
   | -> compile -> tests -> commit
   v
[Tache 7.6.7: Horizontal Scaling]
   | -> compile -> tests -> commit
   v
[Tache 7.6.8: Kafka Throughput Optimization]
   | -> compile -> tests -> commit
   v
[Tache 7.6.9: Cost Optimization]
   | -> compile -> tests -> commit
   v
[Tache 7.6.10: Stress Testing + Chaos Engineering]
   | -> compile -> tests -> commit
   v
[Tache 7.6.11: SLI/SLO Dashboards + Alerts + Runbook]
   | -> compile -> tests -> commit
   v
[Tache 7.6.12: Documentation + Acceptance Criteria Sprint 35]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 34 -- V-34]
   |
   v
[Rapport sprint34-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

**Apport metier principal** : Load 1000+ tenants + chaos + SLOs validated + autoscaling.

**Prerequis Sprint 35** : Sprint 34 GO complet (score >= 95% verification automatique V-34).

**Sprint suivant** : Sprint 35.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 33 (verification GO)

```bash
# Verifier Sprint 33 GO
ls skalean-insurtech/sprint33-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint33-verify-report.md
```

### Lancement Sprint 34 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-34-sprint-34-performance-scaling.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-34-sprint-34-performance-scaling.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-34-sprint-34-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-34.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 34"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint34-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-34** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-34-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-34 v2.2 detaille -- Sprint 34 (7.6) Performance Scaling (load + chaos + SLOs).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : Load 1000+ tenants + chaos + SLOs validated + autoscaling
