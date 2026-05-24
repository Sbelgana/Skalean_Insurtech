# ORCHESTRATEUR SPRINT 14 v3.0 -- Phase 4 / Sprint 1 : Insure Foundation + 3 Entites Experts
# 17 taches sequentielles (14 v2.2 preserves + 3 v3.0 nouvelles) + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (Option B detaillee -- refonte minimale preservative)
**Phase** : 4 -- Vertical Insure
**Sprint** : 14 / 40 (cumul v3.0) -- PREMIER de la Phase 4
**Reference meta-prompt** : `B-14-sprint-14-insure-foundation.md` v3.0
**Reference verification** : `V-14-sprint-14-verification.md`
**Numerotation taches** : 4.1.1 a 4.1.17 (vs 4.1.1 a 4.1.14 v2.2)
**Effort total** : ~95 heures developpement / 2.5 semaines (vs 80h v2.2)
**Apport metier** : 7 entites Insure + 3 nouvelles entites experts pool ACAPS (foundation Sprints 22.7 + 26.5)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 17 taches** du Sprint 14 v3.0 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-14 v3.0** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-14 v3.0 reference dans chaque tache.

**STRATEGIE PRESERVATIVE v3.0** : Les taches **4.1.1 a 4.1.14 sont INCHANGEES v2.2**. Les taches **4.1.15 a 4.1.17 sont NOUVELLES v3.0**.

---

## OBJECTIF DU SPRINT 14 v3.0

Sprint 14 (4.1) -- Insure Foundation + 3 entites experts. Voir B-14-sprint-14-insure-foundation.md v3.0 pour contexte detaille.

Implementer 7 entites lifecycle police (products + quotes + policies + avenants + premiums + renewals + commissions) **PLUS** 3 nouvelles entites experts (insure_experts + insure_expert_assignments + insure_expert_reports) pour preparer Sprints 22.7 (Expert App) + 26.5 (Carrier Portal).

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/
  task-4.1.1-prompt.md         # insure_products entity + catalog 5 branches (PRESERVE v2.2)
  task-4.1.2-prompt.md         # Tarification engine basique (PRESERVE v2.2)
  task-4.1.3-prompt.md         # insure_quotes + devis PDF (PRESERVE v2.2)
  task-4.1.4-prompt.md         # insure_policies + status workflow (PRESERVE v2.2)
  task-4.1.5-prompt.md         # Souscription via Barid eSign (PRESERVE v2.2)
  task-4.1.6-prompt.md         # insure_avenants (PRESERVE v2.2)
  task-4.1.7-prompt.md         # insure_premiums + echeancier (PRESERVE v2.2)
  task-4.1.8-prompt.md         # insure_renewals + cron 60j (PRESERVE v2.2)
  task-4.1.9-prompt.md         # insure_commissions auto-calcul (PRESERVE v2.2)
  task-4.1.10-prompt.md        # Cron reminders primes (PRESERVE v2.2)
  task-4.1.11-prompt.md        # Auto-log CRM + ACAPS data feed (PRESERVE v2.2)
  task-4.1.12-prompt.md        # Endpoints REST /api/v1/insure/* (PRESERVE v2.2)
  task-4.1.13-prompt.md        # Dashboards Insure (PRESERVE v2.2)
  task-4.1.14-prompt.md        # Tests E2E 50+ (PRESERVE v2.2)
  task-4.1.15-prompt.md        # NOUVEAU v3.0 : insure_experts + KYB workflow
  task-4.1.16-prompt.md        # NOUVEAU v3.0 : insure_expert_assignments + service designation
  task-4.1.17-prompt.md        # NOUVEAU v3.0 : insure_expert_reports preview Sprint 22.7
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/001-015-*.md`. Decisions cles Sprint 14 v3.0 :
- decision-013-expert-acteur-central (workflow expert v3.0 critique)
- decision-012-6-acteurs-ecosystem (acteur 6 Expert)
- decision-011-assurflow-rebrand (naming)

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
4. La verification finale V-14 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 17 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
```
Puis tu **executes CHAQUE section** du fichier de verification (commandes bash + checks automatiques).

---

## REGLES ABSOLUES skalean-insurtech v3.0 (a appliquer dans CHAQUE tache)

### Conventions techniques

- **Multi-tenant** : CHAQUE query DB filtre par `tenant_id` automatique (Subscriber + RLS) + header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*`
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka sur `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a un fichier `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, **AUCUN `any` implicite**, `noUncheckedIndexedAccess: true`
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages (Phase 1 v3.0 conserve)
- **AUCUNE EMOJI** dans le code, commentaires ou logs (decision-006 ABSOLUE)
- **Idempotency-Key** : header obligatoire pour mutations
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite v3.0 Assurflow (decisions 011-015)

- **Naming v3.0** : Skalean (company) / Assurflow (vertical InsurTech) -- decision-011
- **6 acteurs ecosystem** : Carrier + Broker + Garage + Customer/Assure + Tow + Expert -- decision-012
- **Workflow expert** : carrier designe expert + expert valide devis line-by-line + signature Barid -- decision-013
- **Cross-tenant types** : 7 types incluant `garage_to_expert_request` -- Sprint 7.5a
- **Permissions expertise** : 10 perms (expertise.*) + 6 carrier_experts (carrier.experts.*) -- Sprint 7.5a

### Conformite InsurTech Maroc (9 lois MA)

- **Audit ACAPS** : chaque ecriture sur `insure_*` declenche entree dans `compliance_acaps_audits` (10 ans retention)
- **Donnees Maroc** (loi 09-08 CNDP) : Atlas Cloud Services Benguerir (decision-008)
- **Multilinguisme** : fr/ar-MA (darija)/ar (classique)/en
- **Loi 43-20** : signatures electroniques via `@insurtech/signature` (preview Sprint 14 + full Sprint 22.7)
- **Loi 43-05** : AML monitoring experts (KYB workflow Tache 4.1.15)

---

## CONTEXTE PHASE 4 -- Vertical Insure

### Position du Sprint 1 dans la Phase 4

Sprint 14 (4.1) -- **Insure Foundation + 3 entites experts** -- PREMIER de la Phase 4.

Voir `B-14-sprint-14-insure-foundation.md` v3.0 (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/insure, @insurtech/expertise (nouveau Sprint 7.5b), @insurtech/database, @insurtech/auth (Sprint 7.5a 26 roles), apps/api

### Apport metier de ce sprint

Foundation Vertical Insure complete (lifecycle police) + foundation experts pool ACAPS pour preparer Sprints 22.7 Expert App + 26.5 Carrier Portal + 21 v3.0 Sinistre Workflow.

---

## EXECUTION SEQUENTIELLE DES 17 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-14 v3.0, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-14 v3.0.

---

# PHASE A : Heritage v2.2 (Taches 4.1.1 a 4.1.14)

Ces 14 taches sont **PRESERVES INCHANGES v2.2**. Execute strictement selon orchestrateur C-14 v2.2 original (archive). Aucune modification.

---

### Tache 1 / 17 : insure_products entity + catalog 5 branches initiales (PRESERVE v2.2)

**Metadonnees** : P0 | 6h | Depend de : Phase 3

**But** : Implementer entity `insure_products` + catalog 5 branches initiales (auto / sante / multirisque habitation / RC pro / voyage).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.1-prompt.md
```

**Actions principales attendues** : voir B-14 v2.2 (archive) section Tache 4.1.1.

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-14): insure_products entity + catalog 5 branches initiales

Task: 4.1.1
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure
Decisions: see B-14 Tache 4.1.1"
```

---

### Tache 2 / 17 : Tarification engine basique (PRESERVE v2.2)

**Metadonnees** : P0 | 6h | Depend de : 4.1.1

**But** : Tarification engine basique (lookup tables tarifs par branche + age + zone).

**Commit** :
```bash
git commit -m "feat(sprint-14): tarification engine basique

Task: 4.1.2
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 3 / 17 : insure_quotes entity + service + devis PDF (PRESERVE v2.2)

**Metadonnees** : P0 | 7h | Depend de : 4.1.2

**But** : Entity quotes + service generation + devis PDF avec PdfGenerator Sprint 10.

**Commit** :
```bash
git commit -m "feat(sprint-14): insure_quotes entity + devis PDF generation

Task: 4.1.3
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 4 / 17 : insure_policies entity + service + status workflow (PRESERVE v2.2)

**Metadonnees** : P0 | 6h | Depend de : 4.1.3

**But** : Entity policies + service + workflow status (prospect -> quote -> policy -> active).

**Commit** :
```bash
git commit -m "feat(sprint-14): insure_policies entity + status workflow

Task: 4.1.4
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 5 / 17 : Souscription workflow via Barid eSign (PRESERVE v2.2)

**Metadonnees** : P0 | 6h | Depend de : 4.1.4

**But** : Workflow souscription : quote -> policy via signature Barid eSign (Sprint 10).

**Commit** :
```bash
git commit -m "feat(sprint-14): souscription workflow via barid eSign

Task: 4.1.5
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 6 / 17 : insure_avenants entity + service (PRESERVE v2.2)

**Metadonnees** : P0 | 5h | Depend de : 4.1.5

**But** : Entity avenants + service modifs police active.

**Commit** :
```bash
git commit -m "feat(sprint-14): insure_avenants entity + service

Task: 4.1.6
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 7 / 17 : insure_premiums entity + echeancier (PRESERVE v2.2)

**Metadonnees** : P0 | 5h | Depend de : 4.1.6

**But** : Entity premiums + echeancier paiements + tracking.

**Commit** :
```bash
git commit -m "feat(sprint-14): insure_premiums entity + echeancier paiements

Task: 4.1.7
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 8 / 17 : insure_renewals entity + cron renewal (PRESERVE v2.2)

**Metadonnees** : P0 | 5h | Depend de : 4.1.7

**But** : Entity renewals + cron renewal 60 jours avant expiration.

**Commit** :
```bash
git commit -m "feat(sprint-14): insure_renewals entity + cron 60j

Task: 4.1.8
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 9 / 17 : insure_commissions entity + auto-calcul (PRESERVE v2.2)

**Metadonnees** : P0 | 5h | Depend de : 4.1.8

**But** : Entity commissions + auto-calcul + integration Books Sprint 12.

**Commit** :
```bash
git commit -m "feat(sprint-14): insure_commissions auto-calcul + integration books

Task: 4.1.9
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 10 / 17 : Cron reminders primes (PRESERVE v2.2)

**Metadonnees** : P0 | 4h | Depend de : 4.1.9

**But** : Cron reminders primes echues (J-15, J-7, J-3, post-echeance).

**Commit** :
```bash
git commit -m "feat(sprint-14): cron reminders primes j-15/j-7/j-3

Task: 4.1.10
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 11 / 17 : Auto-log CRM + ACAPS data feed (PRESERVE v2.2)

**Metadonnees** : P0 | 4h | Depend de : 4.1.10

**But** : Auto-log interactions CRM (Sprint 8) sur events Insure + ACAPS data feed reporting.

**Commit** :
```bash
git commit -m "feat(sprint-14): auto-log crm + acaps data feed

Task: 4.1.11
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 12 / 17 : Endpoints REST /api/v1/insure/* (PRESERVE v2.2)

**Metadonnees** : P0 | 6h | Depend de : 4.1.11

**But** : Endpoints REST consolides + permissions Insure (Sprint 7).

**Commit** :
```bash
git commit -m "feat(sprint-14): endpoints rest /api/v1/insure/* + permissions

Task: 4.1.12
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 13 / 17 : Dashboards Insure (PRESERVE v2.2)

**Metadonnees** : P1 | 4h | Depend de : 4.1.12

**But** : Dashboards Insure (extends Sprint 13 analytics) -- broker_admin vue portefeuille.

**Commit** :
```bash
git commit -m "feat(sprint-14): dashboards insure broker

Task: 4.1.13
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

### Tache 14 / 17 : Tests E2E 50+ + fixtures realistes (PRESERVE v2.2)

**Metadonnees** : P0 | 11h | Depend de : 4.1.13

**But** : Tests E2E (50+) + fixtures realistes 5 branches + seeds dev.

**Commit** :
```bash
git commit -m "test(sprint-14): tests e2e 50+ + fixtures 5 branches

Task: 4.1.14
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure"
```

---

# PHASE B : Extensions v3.0 (Taches 4.1.15 a 4.1.17)

Ces 3 taches sont **NOUVELLES v3.0**. Foundation experts pool ACAPS pour Sprints 22.7 + 26.5.

---

### Tache 15 / 17 : insure_experts entity + catalog pool ACAPS + KYB workflow

**Metadonnees** : P0 | 5h | Depend de : 4.1.14

**But** : Implementer catalog experts agrees ACAPS + workflow KYB onboarding + verification ACAPS agrement renewal. Pool experts consume par Sprints 22.7 (Expert App) + 26.5 (Carrier Portal).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.15-prompt.md
```

**Actions principales attendues** :
- Migration `repo/packages/database/src/migrations/{date}-Sprint14-InsureExperts.ts` -- table `insure_experts` complete (id + tenant_id + user_id + full_name + cin_number + cin_document_url + phone + email + acaps_agrement_number UNIQUE + acaps_agrement_document_url + acaps_agrement_expiry_date + acaps_specialty[] + firm_name + firm_ice + expert_type CHECK (independent/firm_admin/associate/carrier_internal) + carrier_tenant_id + active_zones[] + total_missions + avg_rating + avg_response_time_hours + baseline_honoraire_mad + status CHECK (active/pending_kyb/suspended/expired_agrement/inactive) + kyb_reviewed_at + kyb_reviewed_by_user_id + kyb_rejection_reason + notes + timestamps)
- Indexes : GIN sur acaps_specialty + active_zones + standard sur tenant_id + status + carrier_tenant_id WHERE expert_type = 'carrier_internal'
- RLS active + FORCE : `CREATE POLICY insure_experts_tenant_isolation ON insure_experts USING (app_can_access_tenant(tenant_id));`
- Entity TypeORM `repo/packages/insure/src/entities/insure-expert.entity.ts` (~80 lignes)
- Service `repo/packages/insure/src/services/experts-catalog.service.ts` (~350 lignes) :
  - `onboardExpert(input)` -- validation Zod + check unicite ACAPS + check expiry future
  - `approveKyb(expertId, reviewerId)` -- transition pending_kyb -> active
  - `rejectKyb(expertId, reviewerId, reason)` -- transition pending_kyb -> inactive
  - `suspendExpert(expertId, reason)` -- transition active -> suspended
  - `checkAgrementExpiry()` -- cron daily auto-suspend
  - `searchExperts(filters)` -- specialty + zone + status + carrier_tenant_id avec order rating DESC
- Cron `repo/packages/insure/src/jobs/insure-experts-agrement-expiry.cron.ts` -- daily 6h00 + reminder 30j avant expiration
- Endpoints REST `repo/apps/api/src/modules/insure/controllers/experts.controller.ts` (5 endpoints) :
  - `POST /api/v1/insure/experts/onboard`
  - `GET /api/v1/insure/experts/search`
  - `POST /api/v1/insure/experts/:id/approve-kyb`
  - `POST /api/v1/insure/experts/:id/reject-kyb`
  - `POST /api/v1/insure/experts/:id/suspend`
- Permissions enforces Sprint 7.5a : `insure.experts.read_pool` + `insure.experts.onboard` + `insure.experts.approve_kyb` + `insure.experts.suspend`
- Tests unit + integration : >= 15 scenarios PASS

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-Sprint14-InsureExperts.ts`
  - `repo/packages/insure/src/entities/insure-expert.entity.ts`
  - `repo/packages/insure/src/services/experts-catalog.service.ts`
  - `repo/packages/insure/src/services/experts-catalog.service.spec.ts`
  - `repo/packages/insure/src/jobs/insure-experts-agrement-expiry.cron.ts`
  - `repo/apps/api/src/modules/insure/controllers/experts.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration insure_experts appliquee + RLS + FORCE
  - V2 (P0) : Indexes GIN specialty + zones presents
  - V3 (P0) : Service 6 methodes (onboard/approveKyb/rejectKyb/suspend/checkExpiry/search)
  - V4 (P0) : Validation Zod CIN + ACAPS + email + expiry > today
  - V5 (P0) : Cron daily ACAPS expiry registered
  - V6 (P0) : 5 endpoints REST + 4 permissions Sprint 7.5a
  - V7 (P0) : Tests 15+ scenarios PASS
  - V8 (P0) : Events Kafka `insurtech.events.insure.expert.*` emis (onboarded, kyb_approved, agrement_expired)
  - V9 (P0) : Constraint applicative carrier_tenant_id NOT NULL si expert_type='carrier_internal'

**Validation** :
```bash
cd repo
pnpm typeorm migration:run
pnpm tsc --noEmit
pnpm vitest run --coverage packages/insure/src/services/experts-catalog.service.spec.ts
pnpm vitest run --coverage apps/api/test/insure/experts-catalog.e2e-spec.ts
pnpm lint
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-14): insure_experts catalog pool acaps + kyb workflow

Task: 4.1.15
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure
Decisions: see B-14 v3.0 Tache 4.1.15 + decision-013"
```

---

### Tache 16 / 17 : insure_expert_assignments entity + service designation

**Metadonnees** : P0 | 5h | Depend de : 4.1.15

**But** : Implementer designations experts par carriers + workflow accept/reject/schedule/complete + auto-create cross-tenant `garage_to_expert_request` (Sprint 7.5a).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.16-prompt.md
```

**Actions principales attendues** :
- Migration `repo/packages/database/src/migrations/{date}-Sprint14-InsureExpertAssignments.ts` -- table `insure_expert_assignments` (id + tenant_id + carrier_tenant_id + carrier_user_id + expert_tenant_id + expert_id FK insure_experts + expert_user_id + sinistre_id + garage_tenant_id + garage_address + garage_lat + garage_lng + status CHECK (designated/accepted/rejected/in_progress/completed/cancelled) + designated_at + accepted_at + rejected_at + rejection_reason + visit_scheduled_at + visit_completed_at + report_submitted_at + completed_at + cancelled_at + cancelled_reason + honoraire_mad + honoraire_invoice_id + honoraire_payment_status CHECK (pending/invoiced/paid/overdue) + notes + timestamps)
- Indexes : tenant_id + carrier_tenant_id + expert_id + sinistre_id + status + garage_tenant_id
- RLS active + FORCE
- Entity TypeORM `repo/packages/insure/src/entities/insure-expert-assignment.entity.ts` (~90 lignes)
- Service `repo/packages/insure/src/services/expert-assignments.service.ts` (~400 lignes) :
  - `designateExpert(input)` -- create assignment + cross-tenant garage_to_expert_request + notify
  - `acceptAssignment(assignmentId, expertUserId)`
  - `rejectAssignment(assignmentId, expertUserId, reason)`
  - `scheduleVisit(assignmentId, scheduledAt)`
  - `markVisitCompleted(assignmentId)`
  - `markReportSubmitted(assignmentId, reportId)`
  - `cancelAssignment(assignmentId, reason)` -- carrier annule + auto re-designation
  - `listMyAssignments(expertUserId, filters)`
  - `listCarrierAssignments(carrierTenantId, filters)`
- Pattern code `designateExpert` voir B-14 v3.0 (auto-create CrossTenantAuthorization type 'garage_to_expert_request')
- Cross-tenant integration : verifie expert active + agrement valid + permission carrier `carrier.experts.designate`
- Endpoints REST `repo/apps/api/src/modules/insure/controllers/expert-assignments.controller.ts` (7 endpoints)
- Permissions Sprint 7.5a : `carrier.experts.designate` (carrier_expert_manager) + `expertise.missions.read/accept/reject` (expert_*)
- Tests : >= 20 scenarios

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-Sprint14-InsureExpertAssignments.ts`
  - `repo/packages/insure/src/entities/insure-expert-assignment.entity.ts`
  - `repo/packages/insure/src/services/expert-assignments.service.ts`
  - `repo/packages/insure/src/services/expert-assignments.service.spec.ts`
  - `repo/apps/api/src/modules/insure/controllers/expert-assignments.controller.ts`

**Criteres P0 cles** :
  - V1 (P0) : Migration table + RLS + indexes
  - V2 (P0) : Workflow 6 etats CHECK constraint
  - V3 (P0) : Cross-tenant garage_to_expert_request auto-create fonctionnel
  - V4 (P0) : Service 9 methodes
  - V5 (P0) : 7 endpoints REST
  - V6 (P0) : Permissions Sprint 7.5a enforces
  - V7 (P0) : Events Kafka emis (designated/accepted/rejected/completed)
  - V8 (P0) : Tests 20+ scenarios PASS

**Validation** :
```bash
cd repo
pnpm typeorm migration:run
pnpm tsc --noEmit
pnpm vitest run --coverage packages/insure/src/services/expert-assignments.service.spec.ts
pnpm vitest run --coverage apps/api/test/insure/expert-assignments-cross-tenant.e2e-spec.ts
pnpm lint
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-14): insure_expert_assignments + service designation par carriers

Task: 4.1.16
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure
Decisions: see B-14 v3.0 Tache 4.1.16 + decision-013"
```

---

### Tache 17 / 17 : insure_expert_reports entity + service preview Sprint 22.7

**Metadonnees** : P0 | 5h | Depend de : 4.1.16

**But** : Implementer rapports expertise digitaux (table + service basique). **Full version validation devis line-by-line + signature Barid eSign = Sprint 22.7 Expert App**. Sprint 14 livre juste foundation table + CRUD basic.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.17-prompt.md
```

**Actions principales attendues** :
- Migration `repo/packages/database/src/migrations/{date}-Sprint14-InsureExpertReports.ts` -- table `insure_expert_reports` (id + tenant_id + assignment_id FK + expert_id + expert_user_id + devis_id + report_content jsonb DEFAULT '{}' + photos_urls[] + decision CHECK (validated/modified/rejected) NULLABLE + decision_justification + modifications jsonb + pdf_url + pdf_generated_at + signature_id + signed_at + signature_legal_status CHECK (pending/signed/expired) + status CHECK (draft/completed/signed/submitted_to_carrier) + submitted_to_carrier_at + carrier_received_at + notes + timestamps)
- Indexes : tenant_id + assignment_id + expert_id + devis_id + status
- RLS active + FORCE
- Entity TypeORM `repo/packages/insure/src/entities/insure-expert-report.entity.ts` (~100 lignes)
- Service `repo/packages/insure/src/services/expert-reports-basic.service.ts` (~250 lignes preview Sprint 22.7) :
  - `createDraftReport(input)` -- create row status='draft'
  - `updateDraft(reportId, updates)` -- update report_content + photos
  - `markCompleted(reportId)` -- draft -> completed (avant signature)
  - `getReport(reportId)` -- avec permission check
  - `listAssignmentReports(assignmentId)`
- **IMPORTANT** : Pas de signature Barid + pas de validation devis line-by-line + pas de submission carrier dans Sprint 14. Tout cela = Sprint 22.7.
- Endpoints REST (4 basics) : POST + GET + PUT + POST mark-completed
- Permissions Sprint 7.5a : `expertise.report.create` (expert_*) + `expertise.report.read` (expert_* + carrier_*)
- Documentation `repo/docs/expert-reports-sprint-22.7-extension-path.md` (~100 lignes) decrivant Sprint 22.7 extension
- Tests : >= 15 scenarios basics

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-Sprint14-InsureExpertReports.ts`
  - `repo/packages/insure/src/entities/insure-expert-report.entity.ts`
  - `repo/packages/insure/src/services/expert-reports-basic.service.ts`
  - `repo/packages/insure/src/services/expert-reports-basic.service.spec.ts`
  - `repo/apps/api/src/modules/insure/controllers/expert-reports.controller.ts`
  - `repo/docs/expert-reports-sprint-22.7-extension-path.md`

**Criteres P0 cles** :
  - V1 (P0) : Migration table + RLS + indexes
  - V2 (P0) : JSONB report_content + modifications fields
  - V3 (P0) : Service ExpertReportsBasicService 5 methodes preview
  - V4 (P0) : 4 endpoints REST basics
  - V5 (P0) : Documentation extension Sprint 22.7 path documente
  - V6 (P0) : Tests 15+ scenarios basics PASS
  - V7 (P0) : Permissions Sprint 7.5a enforces

**Validation** :
```bash
cd repo
pnpm typeorm migration:run
pnpm tsc --noEmit
pnpm vitest run --coverage packages/insure/src/services/expert-reports-basic.service.spec.ts
pnpm lint
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-14): insure_expert_reports preview + service basic

Task: 4.1.17
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure
Decisions: see B-14 v3.0 Tache 4.1.17 + Sprint 22.7 extension path"
```

---

## SYNTHESE -- Cloture Sprint 14 v3.0

Apres execution des 17 taches et leurs commits :

```bash
# 1. Verifier toutes les taches commitees (17 commits Sprint 14 minimum)
git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep "Task: 4.1" | wc -l
# Attendu : 17

# 2. Verifier 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/ --include="*.ts" --include="*.tsx" --include="*.md" | wc -l
# Attendu : 0

# 3. Lancer verification automatique V-14
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
# Suivre instructions du fichier de verification

# 4. Si rapport V-14 >= 95% : GO -> commit cloture
git tag -a "sprint-14-complete-v3-insure-foundation" -m "Sprint 14 v3.0 Insure Foundation + 3 experts complete

- 7 entites Insure v2.2 livrees (preserves)
- 3 nouvelles entites v3.0 (insure_experts + assignments + reports)
- KYB workflow experts ACAPS fonctionnel
- Service designation par carriers + cross-tenant garage_to_expert_request
- 65+ tests E2E PASS
- Score V-14 >= 95% -- GO

Reference: B-14 v3.0 + decision-013"

git push origin sprint-14-complete-v3-insure-foundation

# 5. Notification Slack/Teams
echo "Sprint 14 v3.0 complete (17/17 taches) -- cf sprint14-verify-report.md

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 4 (Vertical Insure)
- Sprint : 14 (Phase 4 / Sprint 1)
- Apport : Foundation Insure + 3 entites experts pool ACAPS
- Tests E2E cumules : {N}+

Sprint 14 completed -- handoff to Sprint 15."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 14 v3.0]
   |
   v
[Tache 4.1.1: insure_products + catalog 5 branches] (v2.2)
   | -> compile -> tests -> commit
   v
... [Taches 4.1.2 a 4.1.13 preserves v2.2] ...
   |
   v
[Tache 4.1.14: Tests E2E 50+ v2.2] 
   | -> compile -> tests -> commit
   | (Phase A complete -- 80h)
   v
[Tache 4.1.15: insure_experts + KYB workflow] (v3.0 NOUVEAU)
   | -> compile -> tests -> commit
   v
[Tache 4.1.16: expert_assignments + designation carriers] (v3.0 NOUVEAU)
   | -> compile -> tests -> commit
   v
[Tache 4.1.17: expert_reports preview Sprint 22.7] (v3.0 NOUVEAU)
   | -> compile -> tests -> commit
   | (Phase B complete -- 15h)
   v
[Verification automatique sprint 14 -- V-14]
   |
   v
[Rapport sprint14-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint 15
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 95 heures (80h Phase A v2.2 + 15h Phase B v3.0 -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/insure, @insurtech/expertise (squelette Sprint 7.5b), @insurtech/database, @insurtech/auth, apps/api

**Apport metier principal** : Foundation lifecycle police complete + foundation experts pool ACAPS (preparation Sprints 22.7 + 26.5).

**Prerequis Sprint 15** : Sprint 14 v3.0 GO complet (score >= 95% verification V-14).

**Sprint suivant** : Sprint 15 Insure Lifecycle Police.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 13 (verification GO)

```bash
# Verifier Sprint 13 GO
ls skalean-insurtech/sprint13-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint13-verify-report.md
```

### Lancement Sprint 14 v3.0 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-14-sprint-14-insure-foundation.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-14-sprint-14-insure-foundation.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-14.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 14"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint14-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-14 v3.0** complet avant generation prompts taches (contexte critique strategie preservative)
2. **Generer les 17 prompts taches** dans `00-pilotage/prompts-taches/sprint-14-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (Phase A v2.2 d'abord puis Phase B v3.0)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **STRATEGIE PRESERVATIVE** : ne PAS modifier code Phase A v2.2 lors execution Phase B v3.0
7. **En cas de doute** decision technique expert/carrier/cross-tenant, escalader Saad/Abla via Slack `#insurtech-dev`
8. **Documentation continue** : si decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-14 v3.0 detaille -- Sprint 14 (4.1) Insure Foundation + 3 entites experts.**

**Total taches detaillees** : 17 (14 v2.2 preserves + 3 v3.0 nouveaux) | **Effort cumul** : ~95h | **Apport** : Foundation Insure + experts pool ACAPS
