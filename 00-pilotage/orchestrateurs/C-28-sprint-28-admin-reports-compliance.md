# ORCHESTRATEUR SPRINT 28 -- Phase 6 / Sprint 3 : Admin Reports + Compliance (4 regulators MA)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 6 -- Admin Platform
**Sprint** : 28 / 35 (cumul) -- Sprint 3 dans Phase 6
**Reference meta-prompt** : `B-28-sprint-28-admin-reports-compliance.md`
**Reference verification** : `V-28-sprint-28-verification.md`
**Numerotation taches** : 6.3.1 a 6.3.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : Reports compliance 4 regulators MA (ACAPS/DGI/AMC/CNDP)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 28 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-28** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-28 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 28

Sprint 28 (6.3) -- Admin Reports + Compliance (4 regulators MA). Voir B-28-sprint-28-admin-reports-compliance.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/
  task-6.3.1-prompt.md       # ACAPS Reports UI
  task-6.3.2-prompt.md       # SAFT-MA Exports UI
  task-6.3.3-prompt.md       # AML Monitoring Dashboard
  task-6.3.4-prompt.md       # Audit Reports Avances
  task-6.3.5-prompt.md       # Compliance Dashboard Global
  task-6.3.6-prompt.md       # Reports Schedules + Auto-Send
  task-6.3.7-prompt.md       # Compliance Documents Browser
  task-6.3.8-prompt.md       # Tenant Compliance Scorecard
  task-6.3.9-prompt.md       # Notifications Regulators
  task-6.3.10-prompt.md       # Endpoints REST + Permissions + KMS
  task-6.3.11-prompt.md       # Documentation Compliance MA Officielle
  task-6.3.12-prompt.md       # Tests E2E + Phase 6 Closure
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-28-sprint-28-verification.md
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
4. La verification finale V-28 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-28-sprint-28-verification.md
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

## CONTEXTE PHASE 6 -- Admin Platform

### Position du Sprint 3 dans la Phase 6

Sprint 28 (6.3) -- **Admin Reports + Compliance (4 regulators MA)**.

Voir `B-28-sprint-28-admin-reports-compliance.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/web-insurtech-admin, packages/admin (impersonation, tenants management, compliance reports)

### Apport metier de ce sprint

Reports compliance 4 regulators MA (ACAPS/DGI/AMC/CNDP)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-28 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-28, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-28.

---

### Tache 1 / 12 : ACAPS Reports UI

**Metadonnees** : P0 | 7h | Depend de : Depend de Sprint 27

**But** : Pages UI ACAPS reports : trimestriel portefeuille polices + sinistres + annuel solvabilite (consume Sprint 12 backend).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.1-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/acaps` :
- Trimestriel portefeuille polices :
- Trimestriel sinistres :
- Annuel solvabilite :
- Format ACAPS specific : Excel xlsm avec formules conformes circulaires ACAPS
- Workflow :

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/acaps/page.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/acaps-{quarterly-policies,quarterly-sinistres,annual-solvency}.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/report-preview.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/report-history.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 types reports
  - V2 (P0) : Generate + preview
  - V3 (P0) : Send workflow + tracking

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
git commit -m "feat(sprint-28): acaps reports ui

Task: 6.3.1
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.1"
```

---

### Tache 2 / 12 : SAFT-MA Exports UI

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.3.1

**But** : Page SAFT-MA exports XML controles fiscaux DGI (Direction Generale Impots MA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.2-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/saft-ma` :
- Workflow validation :
- History : SAFT-MA exports + send dates + acknowledgments
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/saft-ma/page.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/saft-ma-preview.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/saft-ma-validator.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Generate XML
  - V2 (P0) : Validation XSD
  - V3 (P0) : Preview readable

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
git commit -m "feat(sprint-28): saft-ma exports ui

Task: 6.3.2
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.2"
```

---

### Tache 3 / 12 : AML Monitoring Dashboard

**Metadonnees** : P0 | 7h | Depend de : Depend de 6.3.2

**But** : Dashboard AML (Anti-Money Laundering) monitoring : alerts auto + review workflow + clearance pour AMC (Autorite Marocaine Anti-Money Laundering).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.3-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/aml` :
- Migration : table `aml_alerts` (consume Sprint 12 backend) :
- Cron daily : check unaddressed alerts > 5 jours -> escalate super_admin
- Permissions : `admin.compliance.aml.review/clear/sar_generate`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/aml/page.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/aml-alerts-panel.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/aml-review-workflow.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/sar-generator.tsx`
  - `repo/packages/admin/src/services/aml-alerts-classifier.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Alerts panel
  - V2 (P0) : Severity classification
  - V3 (P0) : Review workflow + audit

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
git commit -m "feat(sprint-28): aml monitoring dashboard

Task: 6.3.3
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.3"
```

---

### Tache 4 / 12 : Audit Reports Avances

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.3.3

**But** : Reports audit avances : cross-tenant + period + role-based + multiple export formats.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.4-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/audit-reports` :
- Templates rapport :
- Schedules : auto-generate audit executif mensuel pour super_admin + Skalean board review
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/audit-reports/page.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/audit-aggregations.tsx`
  - `repo/packages/docs/src/templates/{fr,en}/audit-{executive,forensic}.hbs`
  - `repo/packages/admin/src/services/audit-reports-generator.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 templates rapport
  - V2 (P0) : Aggregations correctes
  - V3 (P0) : Multi-format exports

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
git commit -m "feat(sprint-28): audit reports avances

Task: 6.3.4
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.4"
```

---

### Tache 5 / 12 : Compliance Dashboard Global

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.3.4

**But** : Dashboard compliance global : statuses 4 regulators + alerts proactives.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.5-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/dashboard` :
- Real-time refresh
- Color coding : green (compliant) / yellow (warning) / red (action required)
- Permissions : `admin.compliance.dashboard.read`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/dashboard/page.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/{4 regulator cards}.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/regulators-calendar.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 4 cards regulators
  - V2 (P0) : Color coding
  - V3 (P0) : Maturity scoring

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
git commit -m "feat(sprint-28): compliance dashboard global

Task: 6.3.5
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.5"
```

---

### Tache 6 / 12 : Reports Schedules + Auto-Send

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.3.5

**But** : Workflow reports schedules : auto-generation + send aux regulators (email officiel) + acknowledgments tracking.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.6-prompt.md
```

**Actions principales attendues** :
- Migration : table `compliance_report_schedules` :
- Service `compliance-scheduler.service.ts` :
- UI configuration : page `/compliance/schedules` :
- Default schedules :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-ComplianceReportSchedules.ts`
  - `repo/packages/admin/src/services/compliance-scheduler.service.ts`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/schedules/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Schedules configurables
  - V2 (P0) : Cron orchestrator
  - V3 (P0) : Auto-send + manual review fallback

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
git commit -m "feat(sprint-28): reports schedules + auto-send

Task: 6.3.6
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.6"
```

---

### Tache 7 / 12 : Compliance Documents Browser

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.3.6

**But** : Browser archive 5 ans documents compliance + search avance.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.7-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/archive` :
- Storage S3 documents archive : 5 ans retention legale (loi 43-20)
- Soft delete apres 5 ans (cron)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/archive/page.tsx`
  - `repo/apps/web-insurtech-admin/components/compliance/documents-archive-table.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Browser + filters
  - V2 (P0) : Search free
  - V3 (P0) : Preview + download

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
git commit -m "feat(sprint-28): compliance documents browser

Task: 6.3.7
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.7"
```

---

### Tache 8 / 12 : Tenant Compliance Scorecard

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.3.7

**But** : Scorecard compliance maturity per tenant : track progression + gaps.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.8-prompt.md
```

**Actions principales attendues** :
- Page `/compliance/tenants-scorecard` :
- Computation scoring :
- Service `tenant-compliance-scoring.service.ts`
- Cron weekly : recompute scores + alerts si drop > 10 points
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/tenants-scorecard/page.tsx`
  - `repo/packages/admin/src/services/tenant-compliance-scoring.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Scoring algorithm
  - V2 (P0) : DataTable + filters
  - V3 (P0) : Detail per tenant

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
git commit -m "feat(sprint-28): tenant compliance scorecard

Task: 6.3.8
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.8"
```

---

### Tache 9 / 12 : Notifications Regulators

**Metadonnees** : P0 | 4h | Depend de : Depend de 6.3.8

**But** : Workflow signaling regulators + acknowledgments tracking.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.9-prompt.md
```

**Actions principales attendues** :
- Templates email regulators officials :
- Migration : table `regulator_communications` :
- Service `regulator-communications.service.ts`
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RegulatorCommunications.ts`
  - `repo/packages/admin/src/services/regulator-communications.service.ts`
  - `repo/packages/comm/src/templates/{fr}/regulator-{acaps,dgi,amc,cndp}-{4 templates}.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 4 regulators communications
  - V2 (P0) : Tracking acknowledgments
  - V3 (P0) : Tests 4+ scenarios

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
git commit -m "feat(sprint-28): notifications regulators

Task: 6.3.9
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.9"
```

---

### Tache 10 / 12 : Endpoints REST + Permissions + KMS

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.3.9

**But** : Consolidation endpoints + permissions enrichies + KMS encryption pour exports sensibles.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.10-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- KMS encryption : SAFT-MA + SAR documents encrypted-at-rest S3
- Permissions ajoutees catalog Sprint 7 :
- Tests RBAC

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/admin/src/services/kms-compliance-encryption.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ permissions
  - V2 (P0) : KMS encryption documents sensibles
  - V3 (P0) : Tests 6+ scenarios

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
git commit -m "feat(sprint-28): endpoints rest + permissions + kms

Task: 6.3.10
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.10"
```

---

### Tache 11 / 12 : Documentation Compliance MA Officielle

**Metadonnees** : P0 | 4h | Depend de : Depend de 6.3.10

**But** : Documentation officielle compliance MA + onboarding regulators (preparation Phase 7 pilote).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.11-prompt.md
```

**Actions principales attendues** :
- Documents :
- Diagrams Mermaid workflows
- Liens references legales officielles MA

**Fichiers cibles principaux** :
  - `repo/docs/compliance-acaps-guide.md`
  - `repo/docs/compliance-dgi-guide.md`
  - `repo/docs/compliance-amc-guide.md`
  - `repo/docs/compliance-cndp-guide.md`
  - `repo/docs/compliance-pilot-readiness.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 documents complets
  - V2 (P0) : Diagrams clairs
  - V3 (P0) : Phase 7 pilote ready

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
git commit -m "feat(sprint-28): documentation compliance ma officielle

Task: 6.3.11
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.11"
```

---

### Tache 12 / 12 : Tests E2E + Phase 6 Closure

**Metadonnees** : P0 | 9h | Depend de : Depend de 6.3.11

**But** : Suite tests E2E + WCAG + Lighthouse + Phase 6 closure officielle.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/task-6.3.12-prompt.md
```

**Actions principales attendues** :
- ACAPS reports 3 types (3)
- SAFT-MA generate + validate + send (2)
- AML alerts review + SAR generation (3)
- Audit reports generation (2)
- Compliance dashboard (1)
- Reports schedules (1)

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/e2e/sprint-28/{15+ specs}.spec.ts`
  - `repo/docs/phase-6-completion.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : Lighthouse green
  - V3 (P0) : WCAG AA

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
git commit -m "feat(sprint-28): tests e2e + phase 6 closure

Task: 6.3.12
Sprint: 28 (Phase 6 / Sprint 3)
Phase: 6 -- Admin Platform
Decisions: see B-28 Tache 6.3.12"
```

---


## VERIFICATION DU SPRINT 28

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-28-sprint-28-verification.md
```

Le fichier de verification V-28 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint28-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint28-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint28-verify-report.md
git commit -m "chore(sprint-28): close sprint 28 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 6 (Admin Platform)
- Sprint : 28 (Phase 6 / Sprint 3)
- Apport : Reports compliance 4 regulators MA (ACAPS/DGI/AMC/CNDP)
- Tests E2E cumules : {N}+

Sprint 28 completed -- handoff to Sprint 29."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 28]
   |
   v
[Tache 6.3.1: ACAPS Reports UI]
   | -> compile -> tests -> commit
   v
[Tache 6.3.2: SAFT-MA Exports UI]
   | -> compile -> tests -> commit
   v
[Tache 6.3.3: AML Monitoring Dashboard]
   | -> compile -> tests -> commit
   v
[Tache 6.3.4: Audit Reports Avances]
   | -> compile -> tests -> commit
   v
[Tache 6.3.5: Compliance Dashboard Global]
   | -> compile -> tests -> commit
   v
[Tache 6.3.6: Reports Schedules + Auto-Send]
   | -> compile -> tests -> commit
   v
[Tache 6.3.7: Compliance Documents Browser]
   | -> compile -> tests -> commit
   v
[Tache 6.3.8: Tenant Compliance Scorecard]
   | -> compile -> tests -> commit
   v
[Tache 6.3.9: Notifications Regulators]
   | -> compile -> tests -> commit
   v
[Tache 6.3.10: Endpoints REST + Permissions + KMS]
   | -> compile -> tests -> commit
   v
[Tache 6.3.11: Documentation Compliance MA Officielle]
   | -> compile -> tests -> commit
   v
[Tache 6.3.12: Tests E2E + Phase 6 Closure]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 28 -- V-28]
   |
   v
[Rapport sprint28-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/web-insurtech-admin, packages/admin (impersonation, tenants management, compliance reports)

**Apport metier principal** : Reports compliance 4 regulators MA (ACAPS/DGI/AMC/CNDP).

**Prerequis Sprint 29** : Sprint 28 GO complet (score >= 95% verification automatique V-28).

**Sprint suivant** : Sprint 29.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 27 (verification GO)

```bash
# Verifier Sprint 27 GO
ls skalean-insurtech/sprint27-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint27-verify-report.md
```

### Lancement Sprint 28 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-28-sprint-28-admin-reports-compliance.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-28-sprint-28-admin-reports-compliance.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-28-sprint-28-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-28.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 28"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint28-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-28** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-28-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-28 v2.2 detaille -- Sprint 28 (6.3) Admin Reports + Compliance (4 regulators MA).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : Reports compliance 4 regulators MA (ACAPS/DGI/AMC/CNDP)
