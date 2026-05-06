# ORCHESTRATEUR SPRINT 6 -- Phase 2 / Sprint 2 : Multi-Tenant 3 Niveaux + RLS
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 2 -- Securite
**Sprint** : 6 / 35 (cumul) -- Sprint 2 dans Phase 2
**Reference meta-prompt** : `B-06-sprint-06-multi-tenant.md`
**Reference verification** : `V-06-sprint-06-verification.md`
**Numerotation taches** : 2.2.1 a 2.2.12
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Multi-tenant 3 niveaux + RLS isolation 0 leak cross-tenant

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 6 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-06** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-06 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 6

Sprint 6 (2.2) -- Multi-Tenant 3 Niveaux + RLS. Voir B-06-sprint-06-multi-tenant.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/
  task-2.2.1-prompt.md       # TenantContextService : AsyncLocalStorage + Types
  task-2.2.2-prompt.md       # TenantContextMiddleware : Lit x-tenant-id + Valide
  task-2.2.3-prompt.md       # TenantContextGuard + Decorators
  task-2.2.4-prompt.md       # TenantTransactionInterceptor : SET LOCAL Postgres Automatique
  task-2.2.5-prompt.md       # TenantValidationService : Existence + Actif + Suspension
  task-2.2.6-prompt.md       # CrossTenantAuthorizationService : 3 Types v2.0
  task-2.2.7-prompt.md       # TenantManagementService + Endpoints CRUD
  task-2.2.8-prompt.md       # TenantOnboardingService : Workflow Creation Cabinet/Garage
  task-2.2.9-prompt.md       # TenantSuspensionService : Suspend/Reactivate
  task-2.2.10-prompt.md       # SuperAdminGuard + Endpoints /api/v1/admin/*
  task-2.2.11-prompt.md       # ResourceQuotaService : Quotas Par Tenant + Enforcement
  task-2.2.12-prompt.md       # Tests RLS Isolation EXHAUSTIFS + Procedure Purge CNDP Loi 09-08
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-06-sprint-06-verification.md
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
4. La verification finale V-06 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-06-sprint-06-verification.md
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

## CONTEXTE PHASE 2 -- Securite

### Position du Sprint 2 dans la Phase 2

Sprint 6 (2.2) -- **Multi-Tenant 3 Niveaux + RLS**.

Voir `B-06-sprint-06-multi-tenant.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/auth, @insurtech/database (RLS), apps/api (Sprint 5+6+7)

### Apport metier de ce sprint

Multi-tenant 3 niveaux + RLS isolation 0 leak cross-tenant

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-06 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-06, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-06.

---

### Tache 1 / 12 : TenantContextService : AsyncLocalStorage + Types

**Metadonnees** : P0 | 4h | Depend de : Depend de Sprint 5

**But** : Service centralise expose AsyncLocalStorage avec types riches (TenantContext) pour propagation request-scoped sans devoir passer parametres a chaque service downstream.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.1-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/services/tenant-context.service.ts`
- Type `TenantContext` enrichi Sprint 3 RequestContext :
- Method `runWithContext<T>(ctx: TenantContext, fn: () => T): T` -- wraps async operation
- Method `getCurrentContext(): TenantContext | undefined`
- Helpers : `getCurrentTenantId()`, `getCurrentUserId()`, `getCurrentUserRole()`, `isSuperAdmin()`, `getAssureUserId()`, `getCrossTenantAuthId()`
- Method `requireTenantId(): string` -- throws si pas de tenant context (use cases : services qui doivent avoir tenant)

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/services/tenant-context.service.ts`
  - `repo/packages/auth/src/services/tenant-context.service.spec.ts`
  - `repo/packages/auth/src/types/tenant-context.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `runWithContext(ctx, fn)` execute fn avec context accessible
  - V2 (P0) : `getCurrentContext()` retourne context actif
  - V3 (P0) : 2 requests paralleles ont contexts isoles (test integration)

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
git commit -m "feat(sprint-06): tenantcontextservice : asynclocalstorage + types

Task: 2.2.1
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.1"
```

---

### Tache 2 / 12 : TenantContextMiddleware : Lit x-tenant-id + Valide

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.2.1

**But** : Middleware NestJS lisant header `x-tenant-id`, validant coherence avec JWT, et initialisant le TenantContext pour la suite de la request.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.2-prompt.md
```

**Actions principales attendues** :
- Middleware `repo/apps/api/src/common/middleware/tenant-context.middleware.ts`
- Lecture header `x-tenant-id` depuis request
- Validation UUID v4 via Zod
- Si endpoint dans `/api/v1/public/*` -> set `tenantId: undefined, isSuperAdmin: false`
- Si endpoint dans `/api/v1/admin/*` -> set `isSuperAdmin: true, tenantId: undefined` (Tache 2.2.10 SuperAdminGuard valide role)
- Si endpoint dans `/api/v1/assure/*` (Sprint 19) -> set `assureUserId = userId, tenantId = userTenantId`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/middleware/tenant-context.middleware.ts`
  - `repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts`
  - `repo/apps/api/src/app.module.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Header valide -> context cree avec tenantId
  - V2 (P0) : Header invalide UUID -> 400
  - V3 (P0) : Header absent sur route protected -> 400 (PublicEndpointGuard Sprint 3)

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
git commit -m "feat(sprint-06): tenantcontextmiddleware : lit x-tenant-id + valide

Task: 2.2.2
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.2"
```

---

### Tache 3 / 12 : TenantContextGuard + Decorators

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.2.2

**But** : Guard NestJS qui force la presence du TenantContext + decorators ergonomiques pour controllers (`@TenantId()`, `@Tenant()`, `@CurrentTenant()`).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.3-prompt.md
```

**Actions principales attendues** :
- Guard `repo/apps/api/src/common/guards/tenant-context.guard.ts`
- `canActivate()` : verifie TenantContext present, si pas Public + pas Admin -> doit avoir tenantId, sinon 400
- Decorator `@TenantId()` parameter : extract `tenantId` depuis context
- Decorator `@CurrentTenant()` parameter : extract full TenantContext.tenantSettings
- Decorator `@CurrentUser()` (deja Sprint 5) : enrichi avec userRole + tenantId
- Decorator `@AssureUserId()` parameter : extract `assureUserId` (utilise routes L3 Sprint 19)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/guards/tenant-context.guard.ts`
  - `repo/apps/api/src/common/decorators/tenant-id.decorator.ts`
  - `repo/apps/api/src/common/decorators/current-tenant.decorator.ts`
  - `repo/apps/api/src/common/decorators/assure-user-id.decorator.ts`
  - `repo/apps/api/src/common/decorators/require-tenant.decorator.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `@TenantId()` retourne tenantId du context
  - V2 (P0) : `@CurrentTenant()` retourne TenantSettings
  - V3 (P0) : `@AssureUserId()` retourne assureUserId si L3

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
git commit -m "feat(sprint-06): tenantcontextguard + decorators

Task: 2.2.3
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.3"
```

---

### Tache 4 / 12 : TenantTransactionInterceptor : SET LOCAL Postgres Automatique

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.2.3

**But** : Interceptor NestJS qui execute automatique `SET LOCAL app.current_tenant_id = '...'` Postgres avant chaque endpoint qui utilise la DB, garantissant que RLS policies (Sprint 2) sont actives.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.4-prompt.md
```

**Actions principales attendues** :
- Interceptor `repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts`
- Wrap chaque endpoint dans une transaction TypeORM avec SET LOCAL
- Lit context : tenantId, isSuperAdmin, userId, assureUserId, crossTenantAuthorizationId
- Execute SET LOCAL pour chaque variable presente :
- Skip pour endpoints qui ne font pas de DB (rare, decorator `@SkipTenantTransaction()`)
- Performance : transaction overhead < 5ms par endpoint

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts`
  - `repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.spec.ts`
  - `repo/apps/api/src/common/decorators/skip-tenant-transaction.decorator.ts`
  - `repo/apps/api/src/main.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Endpoint normal : SET LOCAL execute avant handler
  - V2 (P0) : Test RLS : INSERT auto-injecte tenant_id (subscriber Sprint 2 utilise)
  - V3 (P0) : Test SELECT : retourne uniquement rows tenant courant

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
git commit -m "feat(sprint-06): tenanttransactioninterceptor : set local postgres automatique

Task: 2.2.4
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.4"
```

---

### Tache 5 / 12 : TenantValidationService : Existence + Actif + Suspension

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.2.4

**But** : Service centralise validations tenant : verifier existence, statut (actif/suspendu/archive), acces user au tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.5-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/tenant/services/tenant-validation.service.ts`
- Method `tenantExists(tenantId: string): Promise<boolean>` -- cache 5min
- Method `getTenantById(tenantId: string): Promise<AuthTenant | null>` -- cache 5min
- Method `isTenantActive(tenantId: string): Promise<boolean>` -- depend de status (active/suspended/archived)
- Method `userCanAccessTenant(userId: string, tenantId: string): Promise<{ allowed: boolean, role?: AuthRole, reason?: string }>` -- cache 5min
- Method `getTenantSettings(tenantId: string): Promise<TenantSettings>` -- cache 5min

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/tenant/services/tenant-validation.service.ts`
  - `repo/apps/api/src/modules/tenant/services/tenant-validation.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `tenantExists` retourne true/false correct
  - V2 (P0) : `getTenantById` retourne tenant ou null
  - V3 (P0) : `isTenantActive` rejette suspended/archived

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
git commit -m "feat(sprint-06): tenantvalidationservice : existence + actif + suspension

Task: 2.2.5
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.5"
```

---

### Tache 6 / 12 : CrossTenantAuthorizationService : 3 Types v2.0

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.2.5

**But** : Preparer infrastructure cross-tenant authorizations (3 types v2.0) -- utilisees Sprint 26 pour orchestration tenants (broker -> garage flux client).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.6-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.ts`
- Type `CrossTenantAuthorizationType` enum (3 types ci-dessus)
- Method `create(authzData): Promise<CrossTenantAuthorization>` -- INSERT row + audit log
- Method `validate(authzId, fromTenantId, toTenantId): Promise<{ allowed: boolean, scope?: string[] }>` -- check expiration + revocation + scope
- Method `revoke(authzId, reason): Promise<void>` -- soft delete (`revoked_at`)
- Method `listForTenant(tenantId): Promise<CrossTenantAuthorization[]>` -- pour admin UI

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.ts`
  - `repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.spec.ts`
  - `repo/packages/database/src/entities/system/cross-tenant-authorization.entity.ts`
  - `repo/packages/database/src/migrations/{date}-CrossTenantAuthorizations.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 types declares en enum
  - V2 (P0) : `create()` INSERT row + audit log
  - V3 (P0) : `validate()` retourne allowed=true si actif

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
git commit -m "feat(sprint-06): crosstenantauthorizationservice : 3 types v2.0

Task: 2.2.6
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.6"
```

---

### Tache 7 / 12 : TenantManagementService + Endpoints CRUD

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.2.6

**But** : Service + endpoints `/api/v1/admin/tenants/*` (super admin uniquement) pour CRUD tenants.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/tenant/services/tenant-management.service.ts`
- Methods : `create(dto)`, `findById(id)`, `findAll(filters, pagination)`, `update(id, dto)`, `softDelete(id, reason)`
- Controller `repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts`
- Endpoints (tous super admin only) :
- Schemas Zod : `CreateTenantSchema`, `UpdateTenantSchema`, `TenantFiltersSchema`
- Pagination : page + pageSize (default 25, max 100)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/tenant/services/tenant-management.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts`
  - `repo/apps/api/src/modules/admin/dto/tenant.dto.ts`
  - `repo/apps/api/test/admin-tenants.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /admin/tenants cree tenant avec super admin token
  - V2 (P0) : POST /admin/tenants sans super admin -> 403
  - V3 (P0) : GET liste retourne pagination

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
git commit -m "feat(sprint-06): tenantmanagementservice + endpoints crud

Task: 2.2.7
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.7"
```

---

### Tache 8 / 12 : TenantOnboardingService : Workflow Creation Cabinet/Garage

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.2.7

**But** : Workflow complete creation tenant + super_admin tenant : creer auth_tenants row + creer auth_users super admin + assigner role + envoyer email invitation + setup tenant settings defaults.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.8-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts`
- Method `onboard(dto: OnboardTenantDto): Promise<OnboardResult>` :
- Endpoint `POST /api/v1/admin/tenants/onboard` (super admin) -- alternative a POST /tenants direct
- Endpoint `POST /api/v1/auth/setup-account` (public, token required) -- super admin tenant fixe son password + active compte + tenant status='active'
- Schema Zod `OnboardTenantSchema` : tenant_name, tenant_type, ice (optionnel mais recommande), super_admin_email, super_admin_display_name
- Tenant settings defaults stockes en `auth_tenants.settings jsonb`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts`
  - `repo/apps/api/src/modules/auth/auth.controller.ts`
  - `repo/apps/api/src/modules/auth/auth.service.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-invitation.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : POST /onboard cree tenant + super admin user
  - V2 (P0) : Email invitation envoye
  - V3 (P0) : Tenant status 'pending_setup' initialement

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
git commit -m "feat(sprint-06): tenantonboardingservice : workflow creation cabinet/garage

Task: 2.2.8
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.8"
```

---

### Tache 9 / 12 : TenantSuspensionService : Suspend/Reactivate

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.2.8

**But** : Service pour suspendre/reactiver un tenant (e.g. defaut paiement) -- bloque API access mais preserve data.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.9-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/tenant/services/tenant-suspension.service.ts`
- Method `suspend(tenantId, reason, suspendedBy): Promise<void>` :
- Method `reactivate(tenantId, reactivatedBy): Promise<void>` :
- Method `archive(tenantId, archivedBy): Promise<void>` -- terminal status, prepare purge
- Endpoints (super admin) :
- Cache invalidation : event Kafka -> TenantValidationService cache evict

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/tenant/services/tenant-suspension.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-suspended.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : suspend() set status + revoke sessions
  - V2 (P0) : User suspended tenant : login retourne 403 TENANT_SUSPENDED
  - V3 (P0) : Super admin peut acceder tenant suspendu (admin routes)

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
git commit -m "feat(sprint-06): tenantsuspensionservice : suspend/reactivate

Task: 2.2.9
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.9"
```

---

### Tache 10 / 12 : SuperAdminGuard + Endpoints /api/v1/admin/*

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.2.9

**But** : Guard NestJS qui verifie role super_admin_platform OR analyst_support sur toutes routes `/api/v1/admin/*`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.10-prompt.md
```

**Actions principales attendues** :
- Guard `repo/apps/api/src/common/guards/super-admin.guard.ts`
- `canActivate()` :
- Decorator `@AdminRole(roles: AuthRole[])` -- override quels roles admin acceptes (default super_admin)
- Decorator `@AnalystAllowed()` -- analyst_support peut acceder cette route (read-only)
- Decorator `@SuperAdminOnly()` -- uniquement super_admin_platform (write operations)
- Apply guard sur AdminController + tous descendants `/api/v1/admin/*`

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/guards/super-admin.guard.ts`
  - `repo/apps/api/src/common/decorators/admin-role.decorator.ts`
  - `repo/apps/api/src/common/decorators/analyst-allowed.decorator.ts`
  - `repo/apps/api/src/common/decorators/super-admin-only.decorator.ts`
  - `repo/apps/api/src/modules/admin/admin.module.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : super_admin_platform peut acceder /admin/*
  - V2 (P0) : analyst_support peut acceder /admin/* (read-only)
  - V3 (P0) : analyst_support tente write -> 403

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
git commit -m "feat(sprint-06): superadminguard + endpoints /api/v1/admin/*

Task: 2.2.10
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.10"
```

---

### Tache 11 / 12 : ResourceQuotaService : Quotas Par Tenant + Enforcement

**Metadonnees** : P1 | 5h | Depend de : Depend de 2.2.10

**But** : Enforcement quotas tenant : max users, max polices, max storage GB. Empeche depassement avec audit + email notification.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.11-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/tenant/services/resource-quota.service.ts`
- Methods :
- Quotas defaults Sprint 6 (1 tier MVP) : 10 users, 1000 polices, 50 GB storage
- Cache usage Redis 1min (eviter recompute a chaque request)
- Soft warning : 80% quota -> email notification super admin
- Hard limit : 100% quota -> rejette avec QuotaExceededException

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/tenant/services/resource-quota.service.ts`
  - `repo/apps/api/src/modules/tenant/services/resource-quota.service.spec.ts`
  - `repo/apps/api/src/common/errors/quota-exceeded.error.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/quota-warning.hbs`

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
git commit -m "feat(sprint-06): resourcequotaservice : quotas par tenant + enforcement

Task: 2.2.11
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.11"
```

---

### Tache 12 / 12 : Tests RLS Isolation EXHAUSTIFS + Procedure Purge CNDP Loi 09-08

**Metadonnees** : P0 | 9h | Depend de : Depend de 2.2.11

**But** : Suite tests integration EXHAUSTIVE validant 0 leak cross-tenant possible + procedure purge tenant data conforme loi 09-08 droit oubli.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-06-multi-tenant/task-2.2.12-prompt.md
```

**Actions principales attendues** :
- Test 1 : `rls-isolation-basic.spec.ts` -- INSERT contact tenant A, SELECT tenant B retourne 0
- Test 2 : `rls-isolation-update.spec.ts` -- UPDATE contact tenant A depuis tenant B retourne 0 affected rows
- Test 3 : `rls-isolation-delete.spec.ts` -- DELETE retourne 0 affected
- Test 4 : `rls-super-admin-bypass.spec.ts` -- super admin SELECT cross-tenant OK
- Test 5 : `rls-super-admin-write.spec.ts` -- super admin INSERT/UPDATE/DELETE cross-tenant OK
- Test 6 : `rls-l3-assure.spec.ts` -- assure SELECT autres assures meme tenant retourne 0 (filter L3)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/integration/rls-isolation/{12 specs}.ts`
  - `repo/apps/api/test/integration/rls-isolation/setup.ts`
  - `repo/infrastructure/scripts/data-purge-tenant.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts`
  - `repo/docs/runbooks/cndp-purge-procedure.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 12 tests RLS isolation passent
  - V2 (P0) : Test couvre les 32 tables PARTIE1
  - V3 (P0) : Tests reproduisent zero leak cross-tenant

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
git commit -m "feat(sprint-06): tests rls isolation exhaustifs + procedure purge cndp loi 09-08

Task: 2.2.12
Sprint: 6 (Phase 2 / Sprint 2)
Phase: 2 -- Securite
Decisions: see B-06 Tache 2.2.12"
```

---


## VERIFICATION DU SPRINT 6

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-06-sprint-06-verification.md
```

Le fichier de verification V-06 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint06-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint06-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint06-verify-report.md
git commit -m "chore(sprint-06): close sprint 6 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 2 (Securite)
- Sprint : 6 (Phase 2 / Sprint 2)
- Apport : Multi-tenant 3 niveaux + RLS isolation 0 leak cross-tenant
- Tests E2E cumules : {N}+

Sprint 6 completed -- handoff to Sprint 7."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 6]
   |
   v
[Tache 2.2.1: TenantContextService : AsyncLocalStorage + Types]
   | -> compile -> tests -> commit
   v
[Tache 2.2.2: TenantContextMiddleware : Lit x-tenant-id + Valide]
   | -> compile -> tests -> commit
   v
[Tache 2.2.3: TenantContextGuard + Decorators]
   | -> compile -> tests -> commit
   v
[Tache 2.2.4: TenantTransactionInterceptor : SET LOCAL Postgres Autom]
   | -> compile -> tests -> commit
   v
[Tache 2.2.5: TenantValidationService : Existence + Actif + Suspensio]
   | -> compile -> tests -> commit
   v
[Tache 2.2.6: CrossTenantAuthorizationService : 3 Types v2.0]
   | -> compile -> tests -> commit
   v
[Tache 2.2.7: TenantManagementService + Endpoints CRUD]
   | -> compile -> tests -> commit
   v
[Tache 2.2.8: TenantOnboardingService : Workflow Creation Cabinet/Gar]
   | -> compile -> tests -> commit
   v
[Tache 2.2.9: TenantSuspensionService : Suspend/Reactivate]
   | -> compile -> tests -> commit
   v
[Tache 2.2.10: SuperAdminGuard + Endpoints /api/v1/admin/*]
   | -> compile -> tests -> commit
   v
[Tache 2.2.11: ResourceQuotaService : Quotas Par Tenant + Enforcement]
   | -> compile -> tests -> commit
   v
[Tache 2.2.12: Tests RLS Isolation EXHAUSTIFS + Procedure Purge CNDP L]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 6 -- V-06]
   |
   v
[Rapport sprint06-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (6h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/auth, @insurtech/database (RLS), apps/api (Sprint 5+6+7)

**Apport metier principal** : Multi-tenant 3 niveaux + RLS isolation 0 leak cross-tenant.

**Prerequis Sprint 7** : Sprint 6 GO complet (score >= 95% verification automatique V-06).

**Sprint suivant** : Sprint 7.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 5 (verification GO)

```bash
# Verifier Sprint 5 GO
ls skalean-insurtech/sprint05-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint05-verify-report.md
```

### Lancement Sprint 6 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-06-sprint-06-multi-tenant.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-06-sprint-06-multi-tenant.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-06-sprint-06-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-06.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 6"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint06-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-06** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-06-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-06 v2.2 detaille -- Sprint 6 (2.2) Multi-Tenant 3 Niveaux + RLS.**

**Total taches detaillees** : 12 | **Effort cumul** : ~75h | **Apport** : Multi-tenant 3 niveaux + RLS isolation 0 leak cross-tenant
