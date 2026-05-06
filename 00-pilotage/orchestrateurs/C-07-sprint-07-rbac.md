# ORCHESTRATEUR SPRINT 7 -- Phase 2 / Sprint 3 : RBAC Granulaire (12 roles x 85+ permissions)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 2 -- Securite
**Sprint** : 7 / 35 (cumul) -- Sprint 3 dans Phase 2
**Reference meta-prompt** : `B-07-sprint-07-rbac.md`
**Reference verification** : `V-07-sprint-07-verification.md`
**Numerotation taches** : 2.3.1 a 2.3.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : RBAC granulaire + 80+ tests RBAC scenarios

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 7 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-07** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-07 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 7

Sprint 7 (2.3) -- RBAC Granulaire (12 roles x 85+ permissions). Voir B-07-sprint-07-rbac.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/
  task-2.3.1-prompt.md       # Definition 12 Roles + 85+ Permissions Catalog
  task-2.3.2-prompt.md       # PermissionsMatrix + RoleHierarchy
  task-2.3.3-prompt.md       # RbacService : Evaluation Principale
  task-2.3.4-prompt.md       # RoleGuard + Decorators @Role()
  task-2.3.5-prompt.md       # PermissionGuard + Decorator @RequirePermission()
  task-2.3.6-prompt.md       # Types ABAC + Interfaces
  task-2.3.7-prompt.md       # AbacService + 4 Policies
  task-2.3.8-prompt.md       # AbacGuard + Decorator @AbacPolicy()
  task-2.3.9-prompt.md       # RbacAuditService : Log Access Granted + Denied
  task-2.3.10-prompt.md       # PermissionCacheService Redis
  task-2.3.11-prompt.md       # PermissionsController : Endpoints Admin Gestion Roles
  task-2.3.12-prompt.md       # Tests Exhaustifs (80+) + Seeds Dev 12 Users
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-07-sprint-07-verification.md
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
4. La verification finale V-07 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-07-sprint-07-verification.md
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

### Position du Sprint 3 dans la Phase 2

Sprint 7 (2.3) -- **RBAC Granulaire (12 roles x 85+ permissions)**.

Voir `B-07-sprint-07-rbac.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/auth, @insurtech/database (RLS), apps/api (Sprint 5+6+7)

### Apport metier de ce sprint

RBAC granulaire + 80+ tests RBAC scenarios

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-07 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-07, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-07.

---

### Tache 1 / 12 : Definition 12 Roles + 85+ Permissions Catalog

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 6

**But** : Documenter exhaustivement les 12 roles et le catalog de 85+ permissions au format `{module}.{action}` reutilisable runtime + tests.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.1-prompt.md
```

**Actions principales attendues** :
- Fichier `repo/packages/auth/src/rbac/roles.enum.ts` -- enum `AuthRole` strict avec 12 valeurs
- Fichier `repo/packages/auth/src/rbac/permissions.enum.ts` -- enum `Permission` avec 85+ valeurs
- Convention naming permission : `{module}.{resource}.{action}` (e.g. `crm.contacts.read`, `insure.policies.create`, `repair.sinistres.assign`)
- Modules couverts : `auth`, `tenant`, `crm`, `booking`, `comm`, `docs`, `signature`, `pay`, `books`, `compliance`, `analytics`, `insure`, `repair`, `assure`, `admin`
- Actions standards : `read`, `read_own`, `read_all`, `create`, `update`, `delete`, `assign`, `approve`, `reject`, `export`
- Actions specifiques : `insure.policies.cancel`, `repair.sinistres.close`, `pay.transactions.refund`

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/roles.enum.ts`
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/auth/src/rbac/permissions-by-module.ts`
  - `repo/packages/auth/src/rbac/permissions.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 12 roles enum (test count)
  - V2 (P0) : 85+ permissions enum (test count)
  - V3 (P0) : Convention naming respectee partout (regex check)

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
git commit -m "feat(sprint-07): definition 12 roles + 85+ permissions catalog

Task: 2.3.1
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.1"
```

---

### Tache 2 / 12 : PermissionsMatrix + RoleHierarchy

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.3.1

**But** : Construire la matrice associant chaque role aux permissions correspondantes + hierarchie roles (qui herite de qui).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.2-prompt.md
```

**Actions principales attendues** :
- Fichier `repo/packages/auth/src/rbac/permissions-matrix.ts` -- map `Role -> Permission[]`
- Matrix exhaustive : pour les 12 roles, lister precisement les permissions accordees
- Validation matrix au boot : verifier qu'aucune permission inconnue (typo enum)
- Fichier `repo/packages/auth/src/rbac/role-hierarchy.ts` -- map `Role -> Role[]` (parent roles)
- Hierarchy : super_admin_platform > broker_admin > broker_user > broker_assistant (broker_admin herite permissions broker_user)
- Hierarchy : garage_admin > garage_chef > garage_technicien

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions-matrix.ts`
  - `repo/packages/auth/src/rbac/role-hierarchy.ts`
  - `repo/packages/auth/src/rbac/permissions-matrix.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Matrix 12 roles avec permissions
  - V2 (P0) : super_admin wildcard `'*'`
  - V3 (P0) : `getEffectivePermissions(broker_admin)` inclut permissions broker_user + broker_assistant

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
git commit -m "feat(sprint-07): permissionsmatrix + rolehierarchy

Task: 2.3.2
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.2"
```

---

### Tache 3 / 12 : RbacService : Evaluation Principale

**Metadonnees** : P0 | 6h | Depend de : Depend de 2.3.2

**But** : Service NestJS centralisant l'evaluation des permissions : `canAccess(user, permission, context?): boolean`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.3-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/rbac/rbac.service.ts`
- Method `canAccess(role: AuthRole, permission: Permission, abacContext?): Promise<{ allowed: boolean, reason?: string }>` :
- Method `canAccessAny(role, permissions[]): boolean` -- OR logic
- Method `canAccessAll(role, permissions[]): boolean` -- AND logic
- Method `getRolePermissions(role): Permission[]` -- liste effective
- Caching Redis (delegate Tache 2.3.10) sur `getEffectivePermissions(role)` (5min TTL)

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/rbac.service.ts`
  - `repo/packages/auth/src/rbac/rbac.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : super_admin_platform : `canAccess` retourne allowed=true pour TOUTE permission
  - V2 (P0) : broker_admin : `canAccess('crm.contacts.create')` allowed=true
  - V3 (P0) : broker_user : `canAccess('crm.contacts.delete')` allowed=false (pas dans matrix)

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
git commit -m "feat(sprint-07): rbacservice : evaluation principale

Task: 2.3.3
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.3"
```

---

### Tache 4 / 12 : RoleGuard + Decorators @Role()

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.3.3

**But** : Guard NestJS qui force role specifique sur endpoint via decorator `@Role('broker_admin')`. Plus simple que PermissionGuard pour cas binaires (ce role uniquement).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.4-prompt.md
```

**Actions principales attendues** :
- Guard `repo/apps/api/src/common/guards/role.guard.ts`
- Decorator `@Role(role: AuthRole | AuthRole[])` -- accept un ou plusieurs roles
- Decorator `@MinRole(role: AuthRole)` -- accept role + ses descendants hierarchy
- Guard logic :
- Logs : role required vs role courant + endpoint
- Tests : @Role broker_admin OK, broker_user reject, super_admin OK partout

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/decorators/role.decorator.ts`
  - `repo/apps/api/src/common/decorators/min-role.decorator.ts`
  - `repo/apps/api/src/common/guards/role.guard.ts`
  - `repo/apps/api/src/common/guards/role.guard.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : @Role('broker_admin') accept broker_admin
  - V2 (P0) : @Role('broker_admin') reject broker_user (403)
  - V3 (P0) : @Role('a', 'b') accept a OR b

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
git commit -m "feat(sprint-07): roleguard + decorators @role()

Task: 2.3.4
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.4"
```

---

### Tache 5 / 12 : PermissionGuard + Decorator @RequirePermission()

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.3.4

**But** : Guard granulaire utilise sur endpoints metier : `@RequirePermission('crm.contacts.create')` rejette si user pas autorise.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.5-prompt.md
```

**Actions principales attendues** :
- Decorator `@RequirePermission(permission: Permission)` -- single permission
- Decorator `@RequireAnyPermission(...permissions)` -- OR logic
- Decorator `@RequireAllPermissions(...permissions)` -- AND logic
- Guard `repo/apps/api/src/common/guards/permission.guard.ts`
- Logic :
- Compatibility : guard execute APRES JwtAuthGuard + TenantContextGuard (chained)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/decorators/require-permission.decorator.ts`
  - `repo/apps/api/src/common/guards/permission.guard.ts`
  - `repo/apps/api/src/common/guards/permission.guard.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : @RequirePermission accept si role a permission
  - V2 (P0) : @RequirePermission reject si role n'a pas permission (403)
  - V3 (P0) : @RequireAnyPermission accept si AU MOINS une OK

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
git commit -m "feat(sprint-07): permissionguard + decorator @requirepermission()

Task: 2.3.5
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.5"
```

---

### Tache 6 / 12 : Types ABAC + Interfaces

**Metadonnees** : P0 | 3h | Depend de : Depend de 2.3.5

**But** : Definir interfaces TypeScript pour ABAC : `AbacContext`, `AbacPolicy`, `AbacResult`, types resources.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.6-prompt.md
```

**Actions principales attendues** :
- Fichier `repo/packages/auth/src/abac/types.ts`
- Interface `AbacContext` :
- Interface `AbacPolicy` :
- Interface `AbacResult` :
- Types resources : `'crm_contact' | 'insure_police' | 'repair_sinistre' | 'pay_transaction' | 'doc_document'`
- Tests : interfaces compilent + Zod schemas pour validation runtime

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/abac/types.ts`
  - `repo/packages/auth/src/abac/types.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Interfaces compilent
  - V2 (P0) : `AbacContext` couvre cas usage 4 policies (Tache 2.3.7)
  - V3 (P0) : `AbacResult.allowed` boolean + reason optional

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
git commit -m "feat(sprint-07): types abac + interfaces

Task: 2.3.6
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.6"
```

---

### Tache 7 / 12 : AbacService + 4 Policies

**Metadonnees** : P0 | 7h | Depend de : Depend de 2.3.6

**But** : Service evaluant ABAC policies + 4 policies fondamentales : OwnResources, TimeBased, StatusBased, WorkflowState.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/auth/src/abac/abac.service.ts`
- Method `evaluate(role, permission, context): Promise<AbacResult>` :
- Method `registerPolicy(policy: AbacPolicy)` -- registration dynamique
- **Policy 1 : OwnResourcesPolicy** -- "user peut acceder seulement resources qu'il a cree ou est assigne"
- **Policy 2 : TimeBasedPolicy** -- "operation autorisee seulement dans creneau temporel"
- **Policy 3 : StatusBasedPolicy** -- "operation autorisee seulement si resource dans status specifique"

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/abac/abac.service.ts`
  - `repo/packages/auth/src/abac/policies/own-resources.policy.ts`
  - `repo/packages/auth/src/abac/policies/time-based.policy.ts`
  - `repo/packages/auth/src/abac/policies/status-based.policy.ts`
  - `repo/packages/auth/src/abac/policies/workflow-state.policy.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `evaluate` route vers policy correct
  - V2 (P0) : OwnResourcesPolicy : owner OK, non-owner reject
  - V3 (P0) : TimeBasedPolicy : < threshold OK, > threshold reject

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
git commit -m "feat(sprint-07): abacservice + 4 policies

Task: 2.3.7
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.7"
```

---

### Tache 8 / 12 : AbacGuard + Decorator @AbacPolicy()

**Metadonnees** : P0 | 5h | Depend de : Depend de 2.3.7

**But** : Guard NestJS evaluant ABAC policies sur endpoint, avec decorator pour declarer resource type + identifier extraction.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.8-prompt.md
```

**Actions principales attendues** :
- Decorator `@AbacResource(type, idExtractor)` -- declare resource type + comment extraire id depuis request
- idExtractor function : `(req) => string` (e.g. `req => req.params.id`)
- Guard `repo/apps/api/src/common/guards/abac.guard.ts`
- Logic :
- Loader function injectable per resource type : `loadCrmContact(id)`, `loadInsurePolice(id)`, etc.
- Cache resource Redis 1min (eviter re-fetch a chaque request)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/common/decorators/abac-resource.decorator.ts`
  - `repo/apps/api/src/common/guards/abac.guard.ts`
  - `repo/apps/api/src/common/services/resource-loader.service.ts`
  - `repo/apps/api/src/common/guards/abac.guard.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : @AbacResource + permission *_own : owner OK
  - V2 (P0) : @AbacResource + permission *_own : non-owner reject 403 ABAC_DENIED
  - V3 (P0) : Resource not found -> 404

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
git commit -m "feat(sprint-07): abacguard + decorator @abacpolicy()

Task: 2.3.8
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.8"
```

---

### Tache 9 / 12 : RbacAuditService : Log Access Granted + Denied

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.3.8

**But** : Service centralise log toutes evaluations RBAC/ABAC (granted + denied) pour audit + detection abus + reporting.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.9-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/api/src/modules/auth/services/rbac-audit.service.ts`
- Methods :
- Audit log : action='auth.access_granted' / 'auth.access_denied', resource_type=permission, changes=context
- Kafka event `insurtech.events.audit.access_denied` (alerting Sprint 33+)
- Logging granted optionnel (pour reduire volume) : seulement si LOG_RBAC_GRANTED env true
- Logging denied TOUJOURS (critical security event)

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/auth/services/rbac-audit.service.ts`
  - `repo/apps/api/src/modules/auth/services/rbac-audit.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `logAccessGranted` INSERT audit_log row
  - V2 (P0) : `logAccessDenied` INSERT + Kafka event
  - V3 (P0) : Granted logging configurable env

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
git commit -m "feat(sprint-07): rbacauditservice : log access granted + denied

Task: 2.3.9
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.9"
```

---

### Tache 10 / 12 : PermissionCacheService Redis

**Metadonnees** : P1 | 4h | Depend de : Depend de 2.3.9

**But** : Cache Redis pour permissions effectives par role + ABAC results (eviter recompute).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.10-prompt.md
```

**Actions principales attendues** :
- Service `repo/apps/auth/src/rbac/permission-cache.service.ts`
- Method `getEffectivePermissions(role: AuthRole): Promise<Set<Permission>>` -- cache 5min
- Method `invalidateRole(role: AuthRole): Promise<void>` -- delete cache entry
- Method `invalidateAll(): Promise<void>` -- nuclear option (matrix updated)
- Cache key : `rbac:effective:{role}` -> JSON array permissions
- Cache ABAC results (optional) : key `abac:{userId}:{permission}:{resourceType}:{resourceId}` -> result, TTL 1min

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permission-cache.service.ts`
  - `repo/packages/auth/src/rbac/permission-cache.service.spec.ts`

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
git commit -m "feat(sprint-07): permissioncacheservice redis

Task: 2.3.10
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.10"
```

---

### Tache 11 / 12 : PermissionsController : Endpoints Admin Gestion Roles

**Metadonnees** : P0 | 4h | Depend de : Depend de 2.3.10

**But** : Endpoints super admin pour introspection : lister roles, voir permissions par role, voir audit denied recent.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.11-prompt.md
```

**Actions principales attendues** :
- Controller `repo/apps/api/src/modules/admin/controllers/admin-permissions.controller.ts`
- Endpoints (super admin only) :
- Pas d'endpoint write Sprint 7 (matrix code-as-config) -- Phase 7+ ajoutera tier custom
- Pagination + filtres
- Cache 1h sur GET roles/permissions (matrix change rarement)
- Tests E2E : super admin OK, autre role 403

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/admin/controllers/admin-permissions.controller.ts`
  - `repo/apps/api/src/modules/admin/services/admin-permissions.service.ts`
  - `repo/apps/api/test/admin-permissions.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : GET /admin/rbac/roles retourne 12
  - V2 (P0) : GET /admin/rbac/roles/:role/permissions retourne effectives + hierarchy
  - V3 (P0) : GET /admin/rbac/permissions retourne 85+

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
git commit -m "feat(sprint-07): permissionscontroller : endpoints admin gestion roles

Task: 2.3.11
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.11"
```

---

### Tache 12 / 12 : Tests Exhaustifs (80+) + Seeds Dev 12 Users

**Metadonnees** : P0 | 9h | Depend de : Depend de 2.3.11

**But** : Validation EXHAUSTIVE : pour chaque role x action representative, verifier authorization correct. Plus seeds dev creant 12 users (un par role) pour faciliter dev/tests.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.12-prompt.md
```

**Actions principales attendues** :
- Suite `repo/apps/api/test/rbac/role-matrix-coverage.spec.ts` :
- Tests par role specifiques :
- Tests ABAC :
- Tests integration full stack :
- Script `repo/infrastructure/scripts/seed-rbac-users.ts` :
- Documentation `repo/docs/runbooks/rbac-test-users.md` -- listing users + leur role + leurs permissions

**Fichiers cibles principaux** :
  - `repo/apps/api/test/rbac/role-matrix-coverage.spec.ts`
  - `repo/apps/api/test/rbac/super-admin-platform.spec.ts`
  - `repo/apps/api/test/rbac/analyst-support.spec.ts`
  - `repo/apps/api/test/rbac/broker-admin.spec.ts`
  - `repo/apps/api/test/rbac/broker-user.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 80+ scenarios tests passent
  - V2 (P0) : Coverage : tous 12 roles testes
  - V3 (P0) : Coverage : tous 4 ABAC policies testees

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
git commit -m "feat(sprint-07): tests exhaustifs (80+) + seeds dev 12 users

Task: 2.3.12
Sprint: 7 (Phase 2 / Sprint 3)
Phase: 2 -- Securite
Decisions: see B-07 Tache 2.3.12"
```

---


## VERIFICATION DU SPRINT 7

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-07-sprint-07-verification.md
```

Le fichier de verification V-07 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint07-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint07-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint07-verify-report.md
git commit -m "chore(sprint-07): close sprint 7 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 2 (Securite)
- Sprint : 7 (Phase 2 / Sprint 3)
- Apport : RBAC granulaire + 80+ tests RBAC scenarios
- Tests E2E cumules : {N}+

Sprint 7 completed -- handoff to Sprint 8."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 7]
   |
   v
[Tache 2.3.1: Definition 12 Roles + 85+ Permissions Catalog]
   | -> compile -> tests -> commit
   v
[Tache 2.3.2: PermissionsMatrix + RoleHierarchy]
   | -> compile -> tests -> commit
   v
[Tache 2.3.3: RbacService : Evaluation Principale]
   | -> compile -> tests -> commit
   v
[Tache 2.3.4: RoleGuard + Decorators @Role()]
   | -> compile -> tests -> commit
   v
[Tache 2.3.5: PermissionGuard + Decorator @RequirePermission()]
   | -> compile -> tests -> commit
   v
[Tache 2.3.6: Types ABAC + Interfaces]
   | -> compile -> tests -> commit
   v
[Tache 2.3.7: AbacService + 4 Policies]
   | -> compile -> tests -> commit
   v
[Tache 2.3.8: AbacGuard + Decorator @AbacPolicy()]
   | -> compile -> tests -> commit
   v
[Tache 2.3.9: RbacAuditService : Log Access Granted + Denied]
   | -> compile -> tests -> commit
   v
[Tache 2.3.10: PermissionCacheService Redis]
   | -> compile -> tests -> commit
   v
[Tache 2.3.11: PermissionsController : Endpoints Admin Gestion Roles]
   | -> compile -> tests -> commit
   v
[Tache 2.3.12: Tests Exhaustifs (80+) + Seeds Dev 12 Users]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 7 -- V-07]
   |
   v
[Rapport sprint07-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/auth, @insurtech/database (RLS), apps/api (Sprint 5+6+7)

**Apport metier principal** : RBAC granulaire + 80+ tests RBAC scenarios.

**Prerequis Sprint 8** : Sprint 7 GO complet (score >= 95% verification automatique V-07).

**Sprint suivant** : Sprint 8.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 6 (verification GO)

```bash
# Verifier Sprint 6 GO
ls skalean-insurtech/sprint06-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint06-verify-report.md
```

### Lancement Sprint 7 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-07-sprint-07-rbac.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-07-sprint-07-rbac.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-07-sprint-07-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-07.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 7"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint07-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-07** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-07-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-07 v2.2 detaille -- Sprint 7 (2.3) RBAC Granulaire (12 roles x 85+ permissions).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : RBAC granulaire + 80+ tests RBAC scenarios
