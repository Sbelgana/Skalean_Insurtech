# ORCHESTRATEUR SPRINT 27 -- Phase 6 / Sprint 2 : Tenants Management (onboarding wizard + billing)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 6 -- Admin Platform
**Sprint** : 27 / 35 (cumul) -- Sprint 2 dans Phase 6
**Reference meta-prompt** : `B-27-sprint-27-tenants-management.md`
**Reference verification** : `V-27-sprint-27-verification.md`
**Numerotation taches** : 6.2.1 a 6.2.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : Onboarding tenant workflow end-to-end + billing

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 27 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-27** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-27 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 27

Sprint 27 (6.2) -- Tenants Management (onboarding wizard + billing). Voir B-27-sprint-27-tenants-management.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/
  task-6.2.1-prompt.md       # Billing Tenants Automation
  task-6.2.2-prompt.md       # Page Billing UI
  task-6.2.3-prompt.md       # Tenant Lifecycle : Pause / Archive
  task-6.2.4-prompt.md       # Bulk Operations : Mass Updates
  task-6.2.5-prompt.md       # Comparaison Benchmark Tenants
  task-6.2.6-prompt.md       # Reports Tenant : Monthly + Quarterly
  task-6.2.7-prompt.md       # Configuration Platform-Wide
  task-6.2.8-prompt.md       # Impersonation History + Analytics
  task-6.2.9-prompt.md       # Notifications Platform-Wide
  task-6.2.10-prompt.md       # Endpoints REST + Permissions
  task-6.2.11-prompt.md       # Audit + Kafka + ETL
  task-6.2.12-prompt.md       # Tests E2E + WCAG + Lighthouse
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-27-sprint-27-verification.md
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
4. La verification finale V-27 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-27-sprint-27-verification.md
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

### Position du Sprint 2 dans la Phase 6

Sprint 27 (6.2) -- **Tenants Management (onboarding wizard + billing)**.

Voir `B-27-sprint-27-tenants-management.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/web-insurtech-admin, packages/admin (impersonation, tenants management, compliance reports)

### Apport metier de ce sprint

Onboarding tenant workflow end-to-end + billing

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-27 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-27, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-27.

---

### Tache 1 / 12 : Billing Tenants Automation

**Metadonnees** : P0 | 7h | Depend de : Depend de Sprint 26

**But** : Service automation billing : invoices Skalean -> partenaires (commission Skalean + frais SaaS subscription) + cron generation mensuelle.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.1-prompt.md
```

**Actions principales attendues** :
- Migration : table `platform_billing_invoices` (cross-tenant) :
- Migration : table `tenant_billing_settings` :
- Service `platform-billing.service.ts` :
- Cron mensuel : 5 du mois -> generate drafts + notify super_admin Skalean review
- Apres review super_admin : auto-send aux tenants
- Computation commission :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-PlatformBillingInvoices.ts`
  - `repo/packages/database/src/migrations/{date}-TenantBillingSettings.ts`
  - `repo/packages/admin/src/entities/platform-billing-invoice.entity.ts`
  - `repo/packages/admin/src/entities/tenant-billing-setting.entity.ts`
  - `repo/packages/admin/src/services/platform-billing.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration + entities
  - V2 (P0) : generateInvoice computation correct (decimal.js)
  - V3 (P0) : Cron mensuel

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
git commit -m "feat(sprint-27): billing tenants automation

Task: 6.2.1
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.1"
```

---

### Tache 2 / 12 : Page Billing UI

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.2.1

**But** : Pages UI billing : invoices list + detail + paiements + history per tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.2-prompt.md
```

**Actions principales attendues** :
- Page `/billing` :
- Page detail invoice : items + send button + mark paid + PDF download
- Page tenant settings billing : edit commission_rate + saas_tier + payment_terms
- Permissions : `admin.billing.read/manage`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/page.tsx`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/[id]/page.tsx`
  - `repo/apps/web-insurtech-admin/components/billing/{several components}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 tabs functional
  - V2 (P0) : Invoices CRUD
  - V3 (P0) : Settings edit

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
git commit -m "feat(sprint-27): page billing ui

Task: 6.2.2
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.2"
```

---

### Tache 3 / 12 : Tenant Lifecycle : Pause / Archive

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.2.2

**But** : Workflow lifecycle tenant : pause (suspend temp) / reactivate (resume) / archive (long term + data retention 5 ans).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.3-prompt.md
```

**Actions principales attendues** :
- Service `tenant-lifecycle.service.ts` :
- Migration : ajouter `tenants.lifecycle_status` (enum 'active' | 'suspended' | 'archived'), `tenants.suspended_until`, `tenants.archived_at`, `tenants.archive_retention_until`
- Notifications tenant admin : email + WhatsApp explication + duration
- Audit complete : qui a pause/archive + reason + duration
- Cron daily : check `suspended_until` expired -> auto-reactivate
- Cron daily : check `archive_retention_until` expired -> hard delete data (apres 5 ans)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddTenantLifecycleColumns.ts`
  - `repo/packages/admin/src/services/tenant-lifecycle.service.ts`
  - `repo/packages/admin/src/jobs/tenant-lifecycle-cron.ts`
  - `repo/apps/api/src/modules/admin/controllers/tenant-lifecycle.controller.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-{paused,reactivated,archived}.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 lifecycle states
  - V2 (P0) : Notifications tenant
  - V3 (P0) : Auto-reactivate cron

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
git commit -m "feat(sprint-27): tenant lifecycle : pause / archive

Task: 6.2.3
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.3"
```

---

### Tache 4 / 12 : Bulk Operations : Mass Updates

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.2.3

**But** : Bulk operations sur multiple tenants : mass capabilities update + notifications + status changes via queue async.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.4-prompt.md
```

**Actions principales attendues** :
- Service `bulk-operations.service.ts`
- Operations :
- Async via BullMQ queue `bulk-ops` (eviter timeouts)
- Progress tracking : table `bulk_operations` (id, type, total, processed, failed, status, started_at, completed_at)
- Endpoint poll status : `GET /api/v1/admin/bulk-operations/:id/status`
- UI : modal selection multiple tenants + action choice + confirmation + progress bar

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-BulkOperations.ts`
  - `repo/packages/admin/src/services/bulk-operations.service.ts`
  - `repo/packages/admin/src/workers/bulk-ops.worker.ts`
  - `repo/apps/web-insurtech-admin/components/admin/bulk-actions-modal.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 4 bulk operations
  - V2 (P0) : Async via queue
  - V3 (P0) : Progress tracking

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
git commit -m "feat(sprint-27): bulk operations : mass updates

Task: 6.2.4
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.4"
```

---

### Tache 5 / 12 : Comparaison Benchmark Tenants

**Metadonnees** : P0 | 7h | Depend de : Depend de 6.2.4

**But** : Page comparaison benchmark tenants : KPIs comparison + outliers detection + insights.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.5-prompt.md
```

**Actions principales attendues** :
- Page `/tenants/benchmark` :
- KPIs disponibles :
- Stats avancees : moyenne + median + p25 + p75 + p99 + outliers
- Export PDF benchmark report
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/benchmark/page.tsx`
  - `repo/apps/web-insurtech-admin/components/benchmark/{several charts}.tsx`
  - `repo/packages/admin/src/services/benchmark.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Tenants ranked
  - V2 (P0) : Outliers detection statistical
  - V3 (P0) : Charts comparison

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
git commit -m "feat(sprint-27): comparaison benchmark tenants

Task: 6.2.5
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.5"
```

---

### Tache 6 / 12 : Reports Tenant : Monthly + Quarterly

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.2.5

**But** : Templates reports tenant : monthly performance summary + quarterly business review (QBR) PDF.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.6-prompt.md
```

**Actions principales attendues** :
- Templates :
- Service `tenant-reports.service.ts` :
- Cron monthly : 5 du mois -> generate drafts pour tous tenants actifs
- Cron quarterly : 1er du trimestre +1 -> generate QBR drafts
- Auto-send tenants apres super_admin review (configurable per tenant)
- Page UI : list reports + download PDF + send manual + history

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/tenant-{monthly,qbr}-report.hbs`
  - `repo/packages/admin/src/services/tenant-reports.service.ts`
  - `repo/packages/admin/src/jobs/tenant-reports-cron.ts`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenant-reports/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Monthly + QBR templates
  - V2 (P0) : PDF generation
  - V3 (P0) : Cron scheduled

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
git commit -m "feat(sprint-27): reports tenant : monthly + quarterly

Task: 6.2.6
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.6"
```

---

### Tache 7 / 12 : Configuration Platform-Wide

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.2.6

**But** : Page configuration platform-wide : defaults capabilities + billing rules + fees commission + system settings.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.7-prompt.md
```

**Actions principales attendues** :
- Page `/settings/platform` :
- Migration : table `platform_settings` (key-value store + jsonb config)
- Service `platform-settings.service.ts` :
- Endpoints CRUD
- Permissions : `admin.platform_settings.read/manage`
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-PlatformSettings.ts`
  - `repo/packages/admin/src/services/platform-settings.service.ts`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/settings/platform/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Settings stored + cached
  - V2 (P0) : super_admin only + audit
  - V3 (P0) : UI sections complete

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
git commit -m "feat(sprint-27): configuration platform-wide

Task: 6.2.7
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.7"
```

---

### Tache 8 / 12 : Impersonation History + Analytics

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.2.7

**But** : Page history impersonations + analytics (qui impersone qui combien fois + abuse detection).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.8-prompt.md
```

**Actions principales attendues** :
- Page `/impersonation-history` :
- Analytics widgets :
- Drill-down : click row -> detail audit log impersonation session
- Permissions : `admin.impersonation.audit`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/impersonation-history/page.tsx`
  - `repo/apps/web-insurtech-admin/components/impersonation/{several}.tsx`
  - `repo/packages/admin/src/services/impersonation-analytics.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : History table + filters
  - V2 (P0) : Analytics widgets
  - V3 (P0) : Abuse alerts

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
git commit -m "feat(sprint-27): impersonation history + analytics

Task: 6.2.8
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.8"
```

---

### Tache 9 / 12 : Notifications Platform-Wide

**Metadonnees** : P1 | 4h | Depend de : Depend de 6.2.8

**But** : Send announcements platform-wide aux tenants/users (e.g. maintenance scheduled, new feature, etc.).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.9-prompt.md
```

**Actions principales attendues** :
- Page `/notifications-platform` :
- History table : notifications envoyees + count delivered + count read
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/notifications-platform/page.tsx`
  - `repo/packages/admin/src/services/platform-notifications.service.ts`

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
git commit -m "feat(sprint-27): notifications platform-wide

Task: 6.2.9
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.9"
```

---

### Tache 10 / 12 : Endpoints REST + Permissions

**Metadonnees** : P0 | 4h | Depend de : Depend de 6.2.9

**But** : Consolidation endpoints + permissions enrichies Sprint 27.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.10-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog Sprint 7 :
- Tests RBAC

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ permissions
  - V2 (P0) : Tests RBAC 6+ scenarios

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
git commit -m "feat(sprint-27): endpoints rest + permissions

Task: 6.2.10
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.10"
```

---

### Tache 11 / 12 : Audit + Kafka + ETL

**Metadonnees** : P0 | 4h | Depend de : Depend de 6.2.10

**But** : Audit complet + Kafka events + integration ETL Sprint 13 ClickHouse.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.11-prompt.md
```

**Actions principales attendues** :
- Kafka events :
- ETL Sprint 13 etend : sync `platform_billing_invoices` + `bulk_operations` + `impersonation_sessions` -> ClickHouse
- Dashboards admin enriched
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 7+ Kafka events
  - V2 (P0) : ETL clickhouse
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
git commit -m "feat(sprint-27): audit + kafka + etl

Task: 6.2.11
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.11"
```

---

### Tache 12 / 12 : Tests E2E + WCAG + Lighthouse

**Metadonnees** : P0 | 8h | Depend de : Depend de 6.2.11

**But** : Suite tests Playwright + WCAG + Lighthouse.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-27-tenants-management/task-6.2.12-prompt.md
```

**Actions principales attendues** :
- Billing invoices generation + send + mark paid (3)
- Tenant lifecycle pause + reactivate + archive (3)
- Bulk operations capabilities + notifications (2)
- Benchmark comparison + outliers (2)
- Tenant reports monthly + QBR (2)
- Platform settings (1)

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/e2e/sprint-27/{15+ specs}.spec.ts`

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
git commit -m "feat(sprint-27): tests e2e + wcag + lighthouse

Task: 6.2.12
Sprint: 27 (Phase 6 / Sprint 2)
Phase: 6 -- Admin Platform
Decisions: see B-27 Tache 6.2.12"
```

---


## VERIFICATION DU SPRINT 27

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-27-sprint-27-verification.md
```

Le fichier de verification V-27 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint27-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint27-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint27-verify-report.md
git commit -m "chore(sprint-27): close sprint 27 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 6 (Admin Platform)
- Sprint : 27 (Phase 6 / Sprint 2)
- Apport : Onboarding tenant workflow end-to-end + billing
- Tests E2E cumules : {N}+

Sprint 27 completed -- handoff to Sprint 28."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 27]
   |
   v
[Tache 6.2.1: Billing Tenants Automation]
   | -> compile -> tests -> commit
   v
[Tache 6.2.2: Page Billing UI]
   | -> compile -> tests -> commit
   v
[Tache 6.2.3: Tenant Lifecycle : Pause / Archive]
   | -> compile -> tests -> commit
   v
[Tache 6.2.4: Bulk Operations : Mass Updates]
   | -> compile -> tests -> commit
   v
[Tache 6.2.5: Comparaison Benchmark Tenants]
   | -> compile -> tests -> commit
   v
[Tache 6.2.6: Reports Tenant : Monthly + Quarterly]
   | -> compile -> tests -> commit
   v
[Tache 6.2.7: Configuration Platform-Wide]
   | -> compile -> tests -> commit
   v
[Tache 6.2.8: Impersonation History + Analytics]
   | -> compile -> tests -> commit
   v
[Tache 6.2.9: Notifications Platform-Wide]
   | -> compile -> tests -> commit
   v
[Tache 6.2.10: Endpoints REST + Permissions]
   | -> compile -> tests -> commit
   v
[Tache 6.2.11: Audit + Kafka + ETL]
   | -> compile -> tests -> commit
   v
[Tache 6.2.12: Tests E2E + WCAG + Lighthouse]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 27 -- V-27]
   |
   v
[Rapport sprint27-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/web-insurtech-admin, packages/admin (impersonation, tenants management, compliance reports)

**Apport metier principal** : Onboarding tenant workflow end-to-end + billing.

**Prerequis Sprint 28** : Sprint 27 GO complet (score >= 95% verification automatique V-27).

**Sprint suivant** : Sprint 28.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 26 (verification GO)

```bash
# Verifier Sprint 26 GO
ls skalean-insurtech/sprint26-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint26-verify-report.md
```

### Lancement Sprint 27 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-27-sprint-27-tenants-management.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-27-sprint-27-tenants-management.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-27-sprint-27-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-27.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 27"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint27-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-27** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-27-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-27 v2.2 detaille -- Sprint 27 (6.2) Tenants Management (onboarding wizard + billing).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : Onboarding tenant workflow end-to-end + billing
