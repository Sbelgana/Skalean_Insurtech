# ORCHESTRATEUR SPRINT 25 -- Phase 5 / Sprint 7 : Cross-Tenant Framework (3 types tenants Repair)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 25 / 35 (cumul) -- Sprint 7 dans Phase 5
**Reference meta-prompt** : `B-25-sprint-25-cross-tenant-framework.md`
**Reference verification** : `V-25-sprint-25-verification.md`
**Numerotation taches** : 5.7.1 a 5.7.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : Cross-tenant 3 types (Atlas / managed_partner / api_partner)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 25 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-25** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-25 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 25

Sprint 25 (5.7) -- Cross-Tenant Framework (3 types tenants Repair). Voir B-25-sprint-25-cross-tenant-framework.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/
  task-5.7.1-prompt.md       # TenantType + CapabilitiesMatrix
  task-5.7.2-prompt.md       # Type 1 Atlas Implementation Formalize
  task-5.7.3-prompt.md       # Type 2 Partenaires Geres : Multi-Tenant Strict
  task-5.7.4-prompt.md       # Type 3 Partenaires API Only : Passerelle
  task-5.7.5-prompt.md       # CrossTenantSharingService
  task-5.7.6-prompt.md       # Runtime Activation Type per Tenant
  task-5.7.7-prompt.md       # Onboarding Wizard Backend
  task-5.7.8-prompt.md       # Capabilities Checks Middleware
  task-5.7.9-prompt.md       # Pattern Reutilisable Insure (Sprint 32 Prep)
  task-5.7.10-prompt.md       # Endpoints REST + Permissions
  task-5.7.11-prompt.md       # Documentation Architecture
  task-5.7.12-prompt.md       # Tests Isolation Exhaustifs + Phase 5 Closure
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-25-sprint-25-verification.md
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
4. La verification finale V-25 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-25-sprint-25-verification.md
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

### Position du Sprint 7 dans la Phase 5

Sprint 25 (5.7) -- **Cross-Tenant Framework (3 types tenants Repair)**.

Voir `B-25-sprint-25-cross-tenant-framework.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

Cross-tenant 3 types (Atlas / managed_partner / api_partner)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-25 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-25, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-25.

---

### Tache 1 / 12 : TenantType + CapabilitiesMatrix

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 24

**But** : Definir 3 types tenants Repair + matrice capabilities + entity tenant_capabilities.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.1-prompt.md
```

**Actions principales attendues** :
- Enum `TenantTypeRepair` :
- Migration : ajouter `tenants.tenant_subtype` (text, nullable) + `tenants.tenant_capabilities` (jsonb)
- Migration : table `tenant_capabilities` (granular) :
- CapabilitiesMatrix definition :
- Service `capabilities-matrix.service.ts` :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddTenantSubtypeAndCapabilities.ts`
  - `repo/packages/auth/src/cross-tenant/capabilities-matrix.ts`
  - `repo/packages/auth/src/cross-tenant/types.ts`
  - `repo/packages/auth/src/services/capabilities.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/capabilities.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 types enum
  - V2 (P0) : Capabilities matrix definition
  - V3 (P0) : Service hasCapability fonctionne

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
git commit -m "feat(sprint-25): tenanttype + capabilitiesmatrix

Task: 5.7.1
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.1"
```

---

### Tache 2 / 12 : Type 1 Atlas Implementation Formalize

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.7.1

**But** : Formaliser implementation Atlas existante (Sprint 19) avec capabilities + tagging tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.2-prompt.md
```

**Actions principales attendues** :
- Update Skalean Atlas seed (Sprint 19) : add `tenant_subtype = 'atlas'`
- Capabilities Atlas appliquees runtime
- Tests : Atlas access toutes capabilities

**Fichiers cibles principaux** :
  - `repo/infrastructure/scripts/seed-skalean-atlas.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Atlas tenant correctement tagged
  - V2 (P0) : Capabilities applique
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
git commit -m "feat(sprint-25): type 1 atlas implementation formalize

Task: 5.7.2
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.2"
```

---

### Tache 3 / 12 : Type 2 Partenaires Geres : Multi-Tenant Strict

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.7.2

**But** : Implementer Type 2 -- garages partenaires utilisent Skalean Garage ERP avec data isolated multi-tenant strict (Sprint 6 RLS) + read-only views shared cross-tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.3-prompt.md
```

**Actions principales attendues** :
- Validation multi-tenant strict (RLS Sprint 6 deja livre) -- check capabilities Type 2 :
- Service `managed-partner-onboarding.service.ts` :
- Configuration : tenant settings (commission_rate Skalean, billing_frequency, support_level)
- Cross-tenant share read-only views :
- Endpoints :
- Tests : isolation + cross-tenant share

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/managed-partner-onboarding.service.ts`
  - `repo/packages/database/src/migrations/{date}-CrossTenantViews.ts`
  - `repo/apps/api/src/modules/admin/controllers/managed-partner.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Type 2 tenant cree avec capabilities
  - V2 (P0) : Multi-tenant isolation respect
  - V3 (P0) : Cross-tenant view sinistre status fonctionne

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
git commit -m "feat(sprint-25): type 2 partenaires geres : multi-tenant strict

Task: 5.7.3
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.3"
```

---

### Tache 4 / 12 : Type 3 Partenaires API Only : Passerelle

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.7.3

**But** : Implementer Type 3 -- garages externes (avec leur propre ERP) qui integrent Skalean via API only (passerelle minimale).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.4-prompt.md
```

**Actions principales attendues** :
- Pattern Adapter (similar Sprint 11 Pay) : `ApiPartnerConnectorInterface`
- Methods :
- Migration : table `api_partner_configurations` :
- Service `api-partner-connector.service.ts` (avec circuit breaker opossum)
- **Webhook receiver pattern detaille** :
- Limited capabilities Type 3 :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-ApiPartnerConfigurations.ts`
  - `repo/packages/repair/src/connectors/api-partner-connector.interface.ts`
  - `repo/packages/repair/src/connectors/api-partner-connector.service.ts`
  - `repo/apps/api/src/modules/repair/webhooks/api-partner-webhook.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Type 3 connector fonctionne
  - V2 (P0) : Circuit breaker active
  - V3 (P0) : Webhook signature verifiee

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
git commit -m "feat(sprint-25): type 3 partenaires api only : passerelle

Task: 5.7.4
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.4"
```

---

### Tache 5 / 12 : CrossTenantSharingService

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.7.4

**But** : Service centralise data sharing cross-tenant : read-only views sinistres status + photos + documents (selon capabilities).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.5-prompt.md
```

**Actions principales attendues** :
- Service `cross-tenant-sharing.service.ts` :
- Sharing rules per type :
- Privilege escalation : super-admin OR tenant_admin source
- Audit complete chaque acces cross-tenant
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/cross-tenant-sharing.service.ts`
  - `repo/apps/api/src/modules/cross-tenant/cross-tenant-views.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Sharing rules par type tenant
  - V2 (P0) : Read-only respect
  - V3 (P0) : Audit complete

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
git commit -m "feat(sprint-25): crosstenantsharingservice

Task: 5.7.5
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.5"
```

---

### Tache 6 / 12 : Runtime Activation Type per Tenant

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.7.5

**But** : Permettre runtime enable/disable type tenant + audit + transitions controles.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.6-prompt.md
```

**Actions principales attendues** :
- Service `tenant-type-management.service.ts` :
- Validations transitions :
- Audit : table `tenant_type_changes` (id, tenant_id, from_type, to_type, changed_by, changed_at, reason)
- Endpoints :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-TenantTypeChanges.ts`
  - `repo/packages/auth/src/services/tenant-type-management.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/tenant-type.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : SetType valide capabilities
  - V2 (P0) : Transitions controles
  - V3 (P0) : Disable preserves data

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
git commit -m "feat(sprint-25): runtime activation type per tenant

Task: 5.7.6
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.6"
```

---

### Tache 7 / 12 : Onboarding Wizard Backend

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.7.6

**But** : Workflow backend onboarding nouveau tenant partner (Type 2 ou 3) -- Sprint 27 admin UI consume.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.7-prompt.md
```

**Actions principales attendues** :
- Service `partner-onboarding-workflow.service.ts`
- Steps :
- Migration : table `tenant_onboarding_workflows` :
- Endpoints :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-TenantOnboardingWorkflows.ts`
  - `repo/packages/auth/src/services/partner-onboarding-workflow.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/onboarding.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Workflow 7 steps
  - V2 (P0) : Type 2 vs Type 3 differents
  - V3 (P0) : API keys generation Type 3

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
git commit -m "feat(sprint-25): onboarding wizard backend

Task: 5.7.7
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.7"
```

---

### Tache 8 / 12 : Capabilities Checks Middleware

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.7.7

**But** : Middleware NestJS verifie runtime tenant capabilities avant chaque request + reject si missing.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.8-prompt.md
```

**Actions principales attendues** :
- Decorator `@RequireCapability('repair.garages.create')` similar `@Roles()` Sprint 7
- Guard `CapabilitiesGuard` :
- Cache capabilities Redis 5min (eviter DB lookup chaque request)
- Application : decorate critical endpoints (write operations)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/decorators/require-capability.decorator.ts`
  - `repo/packages/auth/src/guards/capabilities.guard.ts`
  - `repo/packages/auth/src/services/capabilities-cache.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Decorator + Guard
  - V2 (P0) : Cache Redis 5min
  - V3 (P0) : 403 si missing

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
git commit -m "feat(sprint-25): capabilities checks middleware

Task: 5.7.8
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.8"
```

---

### Tache 9 / 12 : Pattern Reutilisable Insure (Sprint 32 Prep)

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.7.8

**But** : Documentation + interfaces pour reutiliser pattern cross-tenant Insure (Sprint 32 connecteurs assureurs).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.9-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/cross-tenant-pattern-reuse.md`
- Pattern reutilisation Insure :
- Capabilities matrix Insure (preparation Sprint 32) :
- Interfaces communes : `BaseConnector`, `WebhookHandler`, `IsolationService` reutilisables
- Tests : compile-only verifications interfaces

**Fichiers cibles principaux** :
  - `repo/docs/cross-tenant-pattern-reuse.md`
  - `repo/packages/insure/src/cross-tenant/capabilities-matrix-insure.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Documentation pattern complete
  - V2 (P0) : Capabilities Insure preparation
  - V3 (P0) : Interfaces compiles

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
git commit -m "feat(sprint-25): pattern reutilisable insure (sprint 32 prep)

Task: 5.7.9
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.9"
```

---

### Tache 10 / 12 : Endpoints REST + Permissions

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.7.9

**But** : Consolidation endpoints + permissions cross-tenant management.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.10-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog Sprint 7 :
- Defaults : super admin Skalean only
- Tests RBAC

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Permissions cross-tenant management
  - V2 (P0) : Tests 6+ scenarios

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
git commit -m "feat(sprint-25): endpoints rest + permissions

Task: 5.7.10
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.10"
```

---

### Tache 11 / 12 : Documentation Architecture

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.7.10

**But** : Documentation finale architecture cross-tenant + onboarding guide + scenarios.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.11-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/cross-tenant-architecture.md`
- Document `repo/docs/onboarding-partner-guide.md` (pour customer success Skalean Sprint 35 pilote)
- Document `repo/docs/cross-tenant-isolation-tests-guide.md`
- Diagrams Mermaid

**Fichiers cibles principaux** :
  - `repo/docs/cross-tenant-architecture.md`
  - `repo/docs/onboarding-partner-guide.md`
  - `repo/docs/cross-tenant-isolation-tests-guide.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 documents complets
  - V2 (P0) : Diagrams clairs
  - V3 (P0) : Sprint 35 pilote ready

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
git commit -m "feat(sprint-25): documentation architecture

Task: 5.7.11
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.11"
```

---

### Tache 12 / 12 : Tests Isolation Exhaustifs + Phase 5 Closure

**Metadonnees** : P0 | 12h | Depend de : Depend de 5.7.11

**But** : Suite tests exhaustive cross-tenant isolation + Phase 5 closure officielle.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-25-cross-tenant-framework/task-5.7.12-prompt.md
```

**Actions principales attendues** :
- Capabilities matrix : 3 types x ~15 capabilities = test access deny/allow (40 tests)
- Type 1 Atlas : full access (3)
- Type 2 Managed : isolation + cross-tenant share (8)
- Type 3 API Partner : passerelle + webhook signature + circuit breaker (8)
- Cross-tenant data sharing : sinistre status + photos + docs (5)
- Runtime activation : transitions + audit + isolation preserve (4)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/cross-tenant/{40+ specs}.e2e-spec.ts`
  - `repo/docs/phase-5-completion.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Documentation Phase 5 closure

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
git commit -m "feat(sprint-25): tests isolation exhaustifs + phase 5 closure

Task: 5.7.12
Sprint: 25 (Phase 5 / Sprint 7)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-25 Tache 5.7.12"
```

---


## VERIFICATION DU SPRINT 25

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-25-sprint-25-verification.md
```

Le fichier de verification V-25 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint25-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint25-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint25-verify-report.md
git commit -m "chore(sprint-25): close sprint 25 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 25 (Phase 5 / Sprint 7)
- Apport : Cross-tenant 3 types (Atlas / managed_partner / api_partner)
- Tests E2E cumules : {N}+

Sprint 25 completed -- handoff to Sprint 26."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 25]
   |
   v
[Tache 5.7.1: TenantType + CapabilitiesMatrix]
   | -> compile -> tests -> commit
   v
[Tache 5.7.2: Type 1 Atlas Implementation Formalize]
   | -> compile -> tests -> commit
   v
[Tache 5.7.3: Type 2 Partenaires Geres : Multi-Tenant Strict]
   | -> compile -> tests -> commit
   v
[Tache 5.7.4: Type 3 Partenaires API Only : Passerelle]
   | -> compile -> tests -> commit
   v
[Tache 5.7.5: CrossTenantSharingService]
   | -> compile -> tests -> commit
   v
[Tache 5.7.6: Runtime Activation Type per Tenant]
   | -> compile -> tests -> commit
   v
[Tache 5.7.7: Onboarding Wizard Backend]
   | -> compile -> tests -> commit
   v
[Tache 5.7.8: Capabilities Checks Middleware]
   | -> compile -> tests -> commit
   v
[Tache 5.7.9: Pattern Reutilisable Insure (Sprint 32 Prep)]
   | -> compile -> tests -> commit
   v
[Tache 5.7.10: Endpoints REST + Permissions]
   | -> compile -> tests -> commit
   v
[Tache 5.7.11: Documentation Architecture]
   | -> compile -> tests -> commit
   v
[Tache 5.7.12: Tests Isolation Exhaustifs + Phase 5 Closure]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 25 -- V-25]
   |
   v
[Rapport sprint25-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : Cross-tenant 3 types (Atlas / managed_partner / api_partner).

**Prerequis Sprint 26** : Sprint 25 GO complet (score >= 95% verification automatique V-25).

**Sprint suivant** : Sprint 26.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 24 (verification GO)

```bash
# Verifier Sprint 24 GO
ls skalean-insurtech/sprint24-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint24-verify-report.md
```

### Lancement Sprint 25 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-25-sprint-25-cross-tenant-framework.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-25-sprint-25-cross-tenant-framework.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-25-sprint-25-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-25.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 25"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint25-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-25** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-25-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-25 v2.2 detaille -- Sprint 25 (5.7) Cross-Tenant Framework (3 types tenants Repair).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : Cross-tenant 3 types (Atlas / managed_partner / api_partner)
