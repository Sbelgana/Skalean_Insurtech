# META-PROMPT B-07 -- SPRINT 7 RBAC GRANULAIRE (12 ROLES + 85 PERMISSIONS)

**Version** : v2.2 (Option B)
**Phase** : 2 -- Securite & Multi-tenant
**Sprint** : 7 / 35 (cumul) -- DERNIER de la Phase 2
**Position** : Apres Multi-tenant 3 niveaux, fin Phase 2
**Numerotation taches** : 2.3.1 a 2.3.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous sprints metier necessitant authorization granulaire)

---

## Objectif Global du Sprint

Implementer **systeme de permissions granulaires complet** combinant RBAC (Role-Based Access Control) et ABAC (Attribute-Based Access Control) pour les 12 roles du programme avec ~85 permissions catalogues. Sprint 5 a livre l'authentication, Sprint 6 le multi-tenant. Sprint 7 ajoute la couche AUTHORIZATION : qui peut faire quoi sur quelle resource.

A la sortie de ce sprint :
- 12 roles documentes et enforces : super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, assure, prospect
- 85+ permissions catalogues format `{module}.{action}` (e.g. `crm.contacts.create`, `insure.policies.read_all`)
- Matrice roles x permissions documentee + chargee runtime
- PermissionGuard global + decorator `@RequirePermission('module.action')`
- ABAC policies pour cas attribute-based (e.g. `assure.read_own_police_only`)
- PermissionCacheService Redis (eviter recompute a chaque request)
- Audit log : tous acces autorises/refuses tracees
- Endpoints admin pour gestion permissions custom (preparation Phase 7+ tiers)
- Tests exhaustifs : pour chaque role x action, verifier authorization correct
- Seeds dev : 12 users (un par role) pour faciliter tests

---

## Frontiere du Sprint

**INCLUS** :
- 12 roles definis + enums
- 85+ permissions catalogues
- Matrice roles x permissions
- RbacService (evaluation role -> permissions)
- AbacService (evaluation policies attribute-based)
- RoleGuard + PermissionGuard + AbacGuard
- Decorators `@Role()`, `@RequirePermission()`, `@AbacPolicy()`
- PermissionCacheService Redis
- Audit RBAC (logs accès accordés + refusés)
- Endpoints admin gestion permissions
- Tests exhaustifs 80+ scenarios

**EXCLU** (sera ajoute aux sprints suivants) :
- Permissions custom par tenant (Phase 7+ feature pricing)
- Delegations temporaires (Phase 7+)
- Workflow approval permission requests (Phase 7+)
- UI admin permissions management (Sprint 28)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/5-roles-permissions.md` -- matrice complete 12 roles x 85 permissions
2. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles authorization
3. `00-pilotage/documentation/4-templates-generation.md` -- pattern RBAC transverse R3
4. Sortie Sprint 5 : `auth_users.role`, JWT contains role
5. Sortie Sprint 6 : `auth_tenant_users.role` (role per tenant), TenantContext.userRole

---

## Stack Imposee (Sprint 7)

| Composant | Version | Notes |
|-----------|---------|-------|
| @nestjs/common | 10.4.15 | guards/decorators NestJS |
| reflect-metadata | 0.2.2 | metadata decorators |
| zod | 3.24.1 | validation policies |

Pas de nouvelle dep externe (utilise stack Sprint 1-6).

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 2.3.1 | Definition 12 roles + 85+ permissions catalog | 6h | P0 | Sprint 6 |
| 2.3.2 | PermissionsMatrix + RoleHierarchy structures + Zod validation | 5h | P0 | 2.3.1 |
| 2.3.3 | RbacService -- evaluation principale | 6h | P0 | 2.3.2 |
| 2.3.4 | RoleGuard + decorators @Role() @MinRole() | 4h | P0 | 2.3.3 |
| 2.3.5 | PermissionGuard + decorator @RequirePermission() (multi-permissions OR/AND) | 5h | P0 | 2.3.4 |
| 2.3.6 | Types ABAC + interfaces (AbacPolicy, AbacContext) | 3h | P0 | 2.3.5 |
| 2.3.7 | AbacService + 4 policies (own_resources, time_based, status_based, workflow_state) | 7h | P0 | 2.3.6 |
| 2.3.8 | AbacGuard + decorator @AbacPolicy() | 5h | P0 | 2.3.7 |
| 2.3.9 | RbacAuditService -- log access granted + denied | 4h | P0 | 2.3.8 |
| 2.3.10 | PermissionCacheService Redis (cache role permissions + ABAC results) | 4h | P1 | 2.3.9 |
| 2.3.11 | PermissionsController -- endpoints admin gestion roles | 4h | P0 | 2.3.10 |
| 2.3.12 | Tests exhaustifs (80+ scenarios) + seeds dev 12 users (un par role) | 9h | P0 | 2.3.11 |

**Total** : 62 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 2.3.1 -- Definition 12 Roles + 85+ Permissions Catalog

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 6h / Depend de Sprint 6

**But** : Documenter exhaustivement les 12 roles et le catalog de 85+ permissions au format `{module}.{action}` reutilisable runtime + tests.

**Contexte** : Le document `5-roles-permissions.md` est la source de verite humaine. Sprint 7 transforme ce document en code TypeScript (enums + maps) charge au boot et utilise par les guards.

**Livrables checkables** :
- [ ] Fichier `repo/packages/auth/src/rbac/roles.enum.ts` -- enum `AuthRole` strict avec 12 valeurs
- [ ] Fichier `repo/packages/auth/src/rbac/permissions.enum.ts` -- enum `Permission` avec 85+ valeurs
- [ ] Convention naming permission : `{module}.{resource}.{action}` (e.g. `crm.contacts.read`, `insure.policies.create`, `repair.sinistres.assign`)
- [ ] Modules couverts : `auth`, `tenant`, `crm`, `booking`, `comm`, `docs`, `signature`, `pay`, `books`, `compliance`, `analytics`, `insure`, `repair`, `assure`, `admin`
- [ ] Actions standards : `read`, `read_own`, `read_all`, `create`, `update`, `delete`, `assign`, `approve`, `reject`, `export`
- [ ] Actions specifiques : `insure.policies.cancel`, `repair.sinistres.close`, `pay.transactions.refund`
- [ ] Documentation inline : chaque permission a un commentaire decrivant son usage
- [ ] Fichier `repo/packages/auth/src/rbac/permissions-by-module.ts` -- groupage par module pour navigation
- [ ] Tests unitaires : verifier coherence (pas de duplications, format respecte)

**Pattern critique : convention naming permissions**

```typescript
// repo/packages/auth/src/rbac/permissions.enum.ts
export const Permission = {
  // === CRM ===
  CRM_CONTACTS_READ: 'crm.contacts.read',
  CRM_CONTACTS_READ_OWN: 'crm.contacts.read_own',     // own = assigned to user only
  CRM_CONTACTS_CREATE: 'crm.contacts.create',
  CRM_CONTACTS_UPDATE: 'crm.contacts.update',
  CRM_CONTACTS_DELETE: 'crm.contacts.delete',
  CRM_CONTACTS_EXPORT: 'crm.contacts.export',

  CRM_DEALS_READ: 'crm.deals.read',
  CRM_DEALS_CREATE: 'crm.deals.create',
  // ... etc.

  // === Insure (Vertical Broker) ===
  INSURE_POLICIES_READ_ALL: 'insure.policies.read_all',
  INSURE_POLICIES_READ_OWN: 'insure.policies.read_own',
  INSURE_POLICIES_CREATE: 'insure.policies.create',
  INSURE_POLICIES_UPDATE: 'insure.policies.update',
  INSURE_POLICIES_CANCEL: 'insure.policies.cancel',
  INSURE_POLICIES_RESILIATE: 'insure.policies.resiliate',
  INSURE_AVENANTS_CREATE: 'insure.avenants.create',
  INSURE_QUOTES_GENERATE: 'insure.quotes.generate',

  // === Repair (Vertical Garage) ===
  REPAIR_SINISTRES_READ: 'repair.sinistres.read',
  REPAIR_SINISTRES_CREATE: 'repair.sinistres.create',
  REPAIR_SINISTRES_ASSIGN: 'repair.sinistres.assign',
  REPAIR_SINISTRES_CLOSE: 'repair.sinistres.close',
  REPAIR_DEVIS_APPROVE: 'repair.devis.approve',
  REPAIR_REPARATIONS_START: 'repair.reparations.start',
  REPAIR_REPARATIONS_COMPLETE: 'repair.reparations.complete',

  // === Pay ===
  PAY_TRANSACTIONS_READ: 'pay.transactions.read',
  PAY_TRANSACTIONS_REFUND: 'pay.transactions.refund',
  PAY_TRANSACTIONS_RECONCILE: 'pay.transactions.reconcile',

  // === Admin (super admin only) ===
  ADMIN_TENANTS_CREATE: 'admin.tenants.create',
  ADMIN_TENANTS_SUSPEND: 'admin.tenants.suspend',
  ADMIN_TENANTS_PURGE: 'admin.tenants.purge',
  ADMIN_USERS_LIST_ALL: 'admin.users.list_all',
  ADMIN_REPORTS_ACAPS_GENERATE: 'admin.reports.acaps_generate',

  // ... 85+ total
} as const;

export type PermissionValue = typeof Permission[keyof typeof Permission];
```

**Categorisation roles** :

| Role | Type | Niveau acces |
|------|------|--------------|
| super_admin_platform | Skalean staff | Bypass RLS + admin/* |
| analyst_support | Skalean staff | admin/* read-only |
| broker_admin | Tenant cabinet | Tenant CRUD complete |
| broker_user | Tenant cabinet | Polices CRUD limit |
| broker_assistant | Tenant cabinet | Read + create limited |
| garage_admin | Tenant garage | Garage CRUD complete |
| garage_chef | Tenant garage | Sinistres assign + close |
| garage_technicien | Tenant garage | Reparations execute |
| garage_comptable | Tenant garage | Books + Pay |
| garage_commercial | Tenant garage | Devis + clients |
| assure | L3 user | Read own polices/sinistres |
| prospect | Public | Browse public products |

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/roles.enum.ts                              # ~40 lignes (enum + types)
repo/packages/auth/src/rbac/permissions.enum.ts                        # ~150 lignes (~85 permissions)
repo/packages/auth/src/rbac/permissions-by-module.ts                   # ~50 lignes (grouping)
repo/packages/auth/src/rbac/permissions.spec.ts                        # ~80 lignes (coherence tests)
```

**Notes implementation** :
- Format const object (vs enum) : permet TypeScript narrowing + tree-shaking
- 85+ permissions : balance entre granularity (necessaire compliance) et complexite (maintenance)
- Naming standard `module.resource.action` evite ambiguite (vs `read_contact` vs `contact_read`)
- `read_own` vs `read_all` : ABAC distinction (own = filtres user_id, all = bypass filter)
- Permissions admin separees (preset `admin.*`) pour clarte super_admin

**Criteres validation** :
- V1 (P0) : 12 roles enum (test count)
- V2 (P0) : 85+ permissions enum (test count)
- V3 (P0) : Convention naming respectee partout (regex check)
- V4 (P0) : Pas de duplications (test set deduplication)
- V5 (P0) : 15 modules couverts (test grouping)
- V6 (P0) : Documentation inline (chaque permission a un commentaire)
- V7 (P1) : `permissions-by-module` reflete enum

---

## Tache 2.3.2 -- PermissionsMatrix + RoleHierarchy

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 5h / Depend de 2.3.1

**But** : Construire la matrice associant chaque role aux permissions correspondantes + hierarchie roles (qui herite de qui).

**Livrables checkables** :
- [ ] Fichier `repo/packages/auth/src/rbac/permissions-matrix.ts` -- map `Role -> Permission[]`
- [ ] Matrix exhaustive : pour les 12 roles, lister precisement les permissions accordees
- [ ] Validation matrix au boot : verifier qu'aucune permission inconnue (typo enum)
- [ ] Fichier `repo/packages/auth/src/rbac/role-hierarchy.ts` -- map `Role -> Role[]` (parent roles)
- [ ] Hierarchy : super_admin_platform > broker_admin > broker_user > broker_assistant (broker_admin herite permissions broker_user)
- [ ] Hierarchy : garage_admin > garage_chef > garage_technicien
- [ ] Method `getEffectivePermissions(role: AuthRole): Set<Permission>` -- retourne permissions directes + heritees
- [ ] Hierarchy distinct entre broker et garage (pas de cross-inheritance)
- [ ] super_admin_platform : permissions specials marquees `'*'` (wildcard) -- bypass complete
- [ ] Tests : matrix coherente, hierarchy correct, wildcard super admin works

**Pattern critique : matrice roles -> permissions**

```typescript
// repo/packages/auth/src/rbac/permissions-matrix.ts
export const PermissionsMatrix: Record<AuthRole, PermissionValue[]> = {
  super_admin_platform: ['*'],  // Wildcard : tout

  analyst_support: [
    // Read-only sur admin/*
    Permission.ADMIN_TENANTS_LIST,
    Permission.ADMIN_USERS_LIST_ALL,
    Permission.ADMIN_AUDIT_LOG_READ,
    // Pas de write permissions
  ],

  broker_admin: [
    // CRM complet
    Permission.CRM_CONTACTS_READ, Permission.CRM_CONTACTS_CREATE,
    Permission.CRM_CONTACTS_UPDATE, Permission.CRM_CONTACTS_DELETE,
    Permission.CRM_DEALS_READ, Permission.CRM_DEALS_CREATE,
    Permission.CRM_DEALS_UPDATE, Permission.CRM_DEALS_DELETE,
    // Insure complet
    Permission.INSURE_POLICIES_READ_ALL,
    Permission.INSURE_POLICIES_CREATE,
    Permission.INSURE_POLICIES_UPDATE,
    Permission.INSURE_POLICIES_CANCEL,
    Permission.INSURE_AVENANTS_CREATE,
    // Books
    Permission.BOOKS_INVOICES_READ, Permission.BOOKS_INVOICES_CREATE,
    // Tenant management own tenant
    Permission.TENANT_USERS_INVITE, Permission.TENANT_SETTINGS_UPDATE,
    // ... 35 permissions total
  ],

  broker_user: [
    // CRM read + create assigned
    Permission.CRM_CONTACTS_READ_OWN, Permission.CRM_CONTACTS_CREATE,
    Permission.CRM_CONTACTS_UPDATE,  // ABAC : only own
    // Insure : create + read own
    Permission.INSURE_POLICIES_READ_OWN,
    Permission.INSURE_POLICIES_CREATE,
    // Pas de delete, pas d'admin tenant
    // ... 18 permissions total
  ],

  broker_assistant: [
    // Read uniquement + create contacts
    Permission.CRM_CONTACTS_READ_OWN,
    Permission.CRM_CONTACTS_CREATE,
    Permission.INSURE_QUOTES_GENERATE,
    // Pas de write polices
    // ... 8 permissions total
  ],

  garage_admin: [
    // CRM
    Permission.CRM_CONTACTS_READ, Permission.CRM_CONTACTS_CREATE,
    // Repair complet
    Permission.REPAIR_SINISTRES_READ, Permission.REPAIR_SINISTRES_CREATE,
    Permission.REPAIR_SINISTRES_ASSIGN, Permission.REPAIR_SINISTRES_CLOSE,
    Permission.REPAIR_DEVIS_CREATE, Permission.REPAIR_DEVIS_APPROVE,
    Permission.REPAIR_REPARATIONS_START, Permission.REPAIR_REPARATIONS_COMPLETE,
    // Stock + HR
    Permission.STOCK_ITEMS_MANAGE, Permission.HR_EMPLOYEES_MANAGE,
    // Books + Pay
    Permission.BOOKS_INVOICES_CREATE, Permission.PAY_TRANSACTIONS_READ,
    // ... 30 permissions
  ],

  garage_chef: [
    // Sinistres assign + close
    Permission.REPAIR_SINISTRES_READ, Permission.REPAIR_SINISTRES_ASSIGN,
    Permission.REPAIR_SINISTRES_CLOSE,
    Permission.REPAIR_DEVIS_APPROVE,
    // Pas de stock/HR/Books
    // ... 12 permissions
  ],

  garage_technicien: [
    // Reparations execute
    Permission.REPAIR_SINISTRES_READ_ASSIGNED,  // ABAC : assigned to me
    Permission.REPAIR_REPARATIONS_START,
    Permission.REPAIR_REPARATIONS_COMPLETE,
    Permission.STOCK_ITEMS_USE,
    // ... 6 permissions
  ],

  garage_comptable: [
    Permission.BOOKS_INVOICES_READ, Permission.BOOKS_INVOICES_CREATE,
    Permission.BOOKS_ACCOUNTS_MANAGE,
    Permission.PAY_TRANSACTIONS_READ, Permission.PAY_TRANSACTIONS_RECONCILE,
    // ... 10 permissions
  ],

  garage_commercial: [
    Permission.CRM_CONTACTS_READ, Permission.CRM_CONTACTS_CREATE,
    Permission.REPAIR_DEVIS_CREATE, Permission.REPAIR_DEVIS_READ,
    // ... 8 permissions
  ],

  assure: [
    Permission.INSURE_POLICIES_READ_OWN,
    Permission.REPAIR_SINISTRES_READ_OWN,
    Permission.REPAIR_SINISTRES_CREATE_OWN,
    Permission.PAY_TRANSACTIONS_READ_OWN,
    Permission.DOC_DOCUMENTS_READ_OWN,
    // ... 8 permissions
  ],

  prospect: [
    Permission.PUBLIC_PRODUCTS_READ,
    Permission.PUBLIC_QUOTES_GENERATE,
    // ... 4 permissions
  ],
};
```

**Hierarchy** :

```typescript
// repo/packages/auth/src/rbac/role-hierarchy.ts
export const RoleHierarchy: Record<AuthRole, AuthRole[]> = {
  super_admin_platform: [],  // top
  analyst_support: [],

  broker_admin: ['broker_user'],
  broker_user: ['broker_assistant'],
  broker_assistant: [],

  garage_admin: ['garage_chef', 'garage_comptable', 'garage_commercial'],
  garage_chef: ['garage_technicien'],
  garage_technicien: [],
  garage_comptable: [],
  garage_commercial: [],

  assure: [],
  prospect: [],
};
```

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions-matrix.ts                      # ~250 lignes (matrice complete)
repo/packages/auth/src/rbac/role-hierarchy.ts                          # ~30 lignes
repo/packages/auth/src/rbac/permissions-matrix.spec.ts                 # ~150 lignes (tests)
```

**Notes implementation** :
- Wildcard `'*'` super admin : verifie en debut de RbacService.canAccess avant lookup matrix
- Hierarchy : `getEffectivePermissions` resout recursivement (broker_admin permissions = directes + heritees broker_user + broker_assistant)
- Matrix as code (vs JSON) : type-safe + IDE autocomplete + grep facile
- Boot validation : iterate tous values, verifier aucune permission inconnue (typo)
- Total permissions distinctes : ~85 (apres deduplication via Set)

**Criteres validation** :
- V1 (P0) : Matrix 12 roles avec permissions
- V2 (P0) : super_admin wildcard `'*'`
- V3 (P0) : `getEffectivePermissions(broker_admin)` inclut permissions broker_user + broker_assistant
- V4 (P0) : Pas de cross-inheritance broker <-> garage
- V5 (P0) : Boot validation : aucune permission inconnue
- V6 (P0) : 85+ permissions distinctes total
- V7 (P1) : Tests 8+ scenarios

---

## Tache 2.3.3 -- RbacService : Evaluation Principale

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 6h / Depend de 2.3.2

**But** : Service NestJS centralisant l'evaluation des permissions : `canAccess(user, permission, context?): boolean`.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/rbac/rbac.service.ts`
- [ ] Method `canAccess(role: AuthRole, permission: Permission, abacContext?): Promise<{ allowed: boolean, reason?: string }>` :
  - Si role est super_admin_platform et matrix contient `'*'` -> allowed
  - Sinon lookup matrix `getEffectivePermissions(role)`, check si permission presente
  - Si presente et abacContext provided -> delegate AbacService (Tache 2.3.7)
  - Si absente -> denied
- [ ] Method `canAccessAny(role, permissions[]): boolean` -- OR logic
- [ ] Method `canAccessAll(role, permissions[]): boolean` -- AND logic
- [ ] Method `getRolePermissions(role): Permission[]` -- liste effective
- [ ] Caching Redis (delegate Tache 2.3.10) sur `getEffectivePermissions(role)` (5min TTL)
- [ ] Logs structures : access granted/denied + reason
- [ ] Tests unitaires : super_admin wildcard, hierarchy resolution, ABAC delegation, OR/AND multi-permissions

**Pattern critique : RbacService.canAccess flow**

```typescript
// repo/packages/auth/src/rbac/rbac.service.ts
@Injectable()
export class RbacService {
  constructor(
    private cache: PermissionCacheService,
    @Inject(forwardRef(() => AbacService)) private abac: AbacService,
  ) {}

  async canAccess(
    role: AuthRole,
    permission: PermissionValue,
    abacContext?: AbacContext,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Super admin wildcard check
    const matrix = PermissionsMatrix[role];
    if (matrix.includes('*')) {
      return { allowed: true };
    }

    // 2. Resolve effective permissions (with hierarchy + cache)
    const effective = await this.cache.getEffectivePermissions(role);

    // 3. Check direct permission match
    if (!effective.has(permission)) {
      return { allowed: false, reason: 'PERMISSION_NOT_GRANTED' };
    }

    // 4. ABAC check si context provided
    if (abacContext) {
      const abacResult = await this.abac.evaluate(role, permission, abacContext);
      if (!abacResult.allowed) {
        return { allowed: false, reason: abacResult.reason ?? 'ABAC_DENIED' };
      }
    }

    return { allowed: true };
  }

  async canAccessAny(role: AuthRole, perms: PermissionValue[]): Promise<boolean> {
    for (const p of perms) {
      const result = await this.canAccess(role, p);
      if (result.allowed) return true;
    }
    return false;
  }

  async canAccessAll(role: AuthRole, perms: PermissionValue[]): Promise<boolean> {
    for (const p of perms) {
      const result = await this.canAccess(role, p);
      if (!result.allowed) return false;
    }
    return true;
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/rbac.service.ts                              # ~150 lignes
repo/packages/auth/src/rbac/rbac.service.spec.ts                          # ~180 lignes (tests exhaustifs)
```

**Notes implementation** :
- `forwardRef` AbacService : eviter circular import (AbacService aussi inject RbacService eventuellement)
- Cache `getEffectivePermissions` : Set<Permission> retourne (O(1) lookup)
- ABAC evaluation lazy : seulement si context provided ET RBAC permission OK
- Logs structured : indispensable audit trail (Tache 2.3.9 enrichira)
- canAccessAny / All : utile guards multi-permissions decorators

**Criteres validation** :
- V1 (P0) : super_admin_platform : `canAccess` retourne allowed=true pour TOUTE permission
- V2 (P0) : broker_admin : `canAccess('crm.contacts.create')` allowed=true
- V3 (P0) : broker_user : `canAccess('crm.contacts.delete')` allowed=false (pas dans matrix)
- V4 (P0) : `canAccess` avec ABAC context delegate AbacService
- V5 (P0) : Cache hit 2eme call meme role
- V6 (P0) : `canAccessAny` retourne true si AU MOINS UNE permission OK
- V7 (P0) : `canAccessAll` retourne false si AU MOINS UNE manque
- V8 (P0) : Reason explicite si denied (PERMISSION_NOT_GRANTED, ABAC_DENIED)
- V9 (P0) : Tests 15+ scenarios passent

---

## Tache 2.3.4 -- RoleGuard + Decorators @Role()

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 4h / Depend de 2.3.3

**But** : Guard NestJS qui force role specifique sur endpoint via decorator `@Role('broker_admin')`. Plus simple que PermissionGuard pour cas binaires (ce role uniquement).

**Livrables checkables** :
- [ ] Guard `repo/apps/api/src/common/guards/role.guard.ts`
- [ ] Decorator `@Role(role: AuthRole | AuthRole[])` -- accept un ou plusieurs roles
- [ ] Decorator `@MinRole(role: AuthRole)` -- accept role + ses descendants hierarchy
- [ ] Guard logic :
  - Lit metadata `@Role()` ou `@MinRole()`
  - Get user role depuis TenantContext (Sprint 6)
  - Check si role match (direct ou via hierarchy)
  - 403 si non
- [ ] Logs : role required vs role courant + endpoint
- [ ] Tests : @Role broker_admin OK, broker_user reject, super_admin OK partout

**Pattern critique : @Role decorator + RoleGuard**

```typescript
// repo/apps/api/src/common/decorators/role.decorator.ts
export const ROLES_KEY = 'roles';
export const Role = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);

// repo/apps/api/src/common/guards/role.guard.ts
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector, private rbac: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const userRole = getCurrentContext()?.userRole;
    if (!userRole) {
      throw new ForbiddenException({ code: 'NO_USER_CONTEXT' });
    }

    // super_admin bypass
    if (userRole === 'super_admin_platform') return true;

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        code: 'ROLE_REQUIRED',
        required: requiredRoles,
        current: userRole,
      });
    }
    return true;
  }
}
```

Usage controllers :

```typescript
@Controller('tenant')
export class TenantController {
  @Get()
  @Role('broker_admin', 'garage_admin')
  manage() { ... }

  @Get('admin')
  @MinRole('broker_admin')  // accept broker_admin + descendants
  superView() { ... }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/decorators/role.decorator.ts               # ~10 lignes
repo/apps/api/src/common/decorators/min-role.decorator.ts            # ~10 lignes
repo/apps/api/src/common/guards/role.guard.ts                        # ~60 lignes
repo/apps/api/src/common/guards/role.guard.spec.ts                   # ~80 lignes
```

**Notes implementation** :
- `@Role()` simple cas : "ce role exact uniquement"
- `@MinRole()` cas : "ce role ou descendant" (utilise hierarchy)
- super_admin_platform bypass : meme sans @Role() match, accept (consistency RbacService)
- Pattern guards combinables : RoleGuard + PermissionGuard sur meme endpoint
- 403 explicite avec required/current : aide debug

**Criteres validation** :
- V1 (P0) : @Role('broker_admin') accept broker_admin
- V2 (P0) : @Role('broker_admin') reject broker_user (403)
- V3 (P0) : @Role('a', 'b') accept a OR b
- V4 (P0) : @MinRole('broker_admin') accept broker_admin + broker_user + broker_assistant
- V5 (P0) : super_admin_platform bypass tous role checks
- V6 (P0) : Pas de role -> 403
- V7 (P0) : Tests 8+ scenarios

---

## Tache 2.3.5 -- PermissionGuard + Decorator @RequirePermission()

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 5h / Depend de 2.3.4

**But** : Guard granulaire utilise sur endpoints metier : `@RequirePermission('crm.contacts.create')` rejette si user pas autorise.

**Livrables checkables** :
- [ ] Decorator `@RequirePermission(permission: Permission)` -- single permission
- [ ] Decorator `@RequireAnyPermission(...permissions)` -- OR logic
- [ ] Decorator `@RequireAllPermissions(...permissions)` -- AND logic
- [ ] Guard `repo/apps/api/src/common/guards/permission.guard.ts`
- [ ] Logic :
  - Lit metadata `@RequirePermission/Any/All`
  - Get role + tenantId depuis TenantContext
  - Call `rbacService.canAccess(role, permission)` -- ou canAccessAny/All
  - 403 si denied avec code `PERMISSION_DENIED` + permission demandee
- [ ] Compatibility : guard execute APRES JwtAuthGuard + TenantContextGuard (chained)
- [ ] Audit log automatique sur denied (Tache 2.3.9)
- [ ] Tests : permissions OK / denied avec various roles

**Pattern critique : @RequirePermission + Guard**

```typescript
// repo/apps/api/src/common/decorators/require-permission.decorator.ts
export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_LOGIC_KEY = 'permissionsLogic';

export const RequirePermission = (permission: PermissionValue) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, [permission]),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'AND'),
  );

export const RequireAnyPermission = (...permissions: PermissionValue[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'OR'),
  );

export const RequireAllPermissions = (...permissions: PermissionValue[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'AND'),
  );

// repo/apps/api/src/common/guards/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbac: RbacService,
    private rbacAudit: RbacAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<PermissionValue[]>(PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!permissions?.length) return true;

    const logic = this.reflector.getAllAndOverride<'AND' | 'OR'>(PERMISSIONS_LOGIC_KEY, [
      context.getHandler(), context.getClass(),
    ]) ?? 'AND';

    const userRole = getCurrentContext()?.userRole;
    if (!userRole) throw new ForbiddenException({ code: 'NO_USER_CONTEXT' });

    const allowed = logic === 'OR'
      ? await this.rbac.canAccessAny(userRole, permissions)
      : await this.rbac.canAccessAll(userRole, permissions);

    if (!allowed) {
      await this.rbacAudit.logAccessDenied({
        permissions, role: userRole,
        userId: getCurrentUserId(),
        tenantId: getCurrentTenantId(),
        endpoint: context.switchToHttp().getRequest().url,
      });
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        permissions: permissions,
      });
    }
    return true;
  }
}
```

Usage controllers :

```typescript
@Controller('contacts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ContactsController {
  @Get()
  @RequirePermission('crm.contacts.read')
  list() { ... }

  @Post()
  @RequirePermission('crm.contacts.create')
  create() { ... }

  @Delete(':id')
  @RequireAllPermissions('crm.contacts.delete', 'crm.contacts.update')
  delete() { ... }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/decorators/require-permission.decorator.ts          # ~30 lignes (3 decorators)
repo/apps/api/src/common/guards/permission.guard.ts                          # ~80 lignes
repo/apps/api/src/common/guards/permission.guard.spec.ts                     # ~120 lignes
```

**Notes implementation** :
- `applyDecorators` : compose multiple decorators en un (cleaner usage)
- Default logic AND si pas specifie
- super_admin bypass : RbacService.canAccess gere deja
- Audit denied : critical pour detection abus / debug
- Pattern global : `useGlobalGuards(PermissionGuard)` mais avec `@Optional()` decorator pour endpoints sans permission requirements

**Criteres validation** :
- V1 (P0) : @RequirePermission accept si role a permission
- V2 (P0) : @RequirePermission reject si role n'a pas permission (403)
- V3 (P0) : @RequireAnyPermission accept si AU MOINS une OK
- V4 (P0) : @RequireAllPermissions reject si AU MOINS une manque
- V5 (P0) : super_admin bypass
- V6 (P0) : Audit log sur denied
- V7 (P0) : 403 retourne code + permissions demandees
- V8 (P0) : Tests 12+ scenarios

---

## Tache 2.3.6 -- Types ABAC + Interfaces

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 3h / Depend de 2.3.5

**But** : Definir interfaces TypeScript pour ABAC : `AbacContext`, `AbacPolicy`, `AbacResult`, types resources.

**Contexte** : RBAC seul insuffisant pour cas comme "broker_user peut update contact UNIQUEMENT s'il en est l'owner". ABAC ajoute couche policy attribute-based.

**Livrables checkables** :
- [ ] Fichier `repo/packages/auth/src/abac/types.ts`
- [ ] Interface `AbacContext` :
  - `userId: string`
  - `role: AuthRole`
  - `tenantId: string`
  - `resource: { type: string, id: string, attributes: Record<string, unknown> }`
  - `action: string`
  - `requestContext: { ipAddress, userAgent, timestamp }`
- [ ] Interface `AbacPolicy` :
  - `name: string`
  - `appliesTo: { permissions: PermissionValue[], resourceTypes?: string[] }`
  - `evaluate(context: AbacContext): Promise<AbacResult>`
- [ ] Interface `AbacResult` :
  - `allowed: boolean`
  - `reason?: string`
  - `appliedPolicy: string`
- [ ] Types resources : `'crm_contact' | 'insure_police' | 'repair_sinistre' | 'pay_transaction' | 'doc_document'`
- [ ] Tests : interfaces compilent + Zod schemas pour validation runtime

**Fichiers crees / modifies** :
```
repo/packages/auth/src/abac/types.ts                                  # ~80 lignes
repo/packages/auth/src/abac/types.spec.ts                              # ~40 lignes
```

**Notes implementation** :
- Resource type enum : permet routing vers policy specific (ex: `crm_contact` -> CrmContactOwnerPolicy)
- Attributes flexible (Record) : chaque resource type a ses attributes specifiques
- Action string vs enum : flexibility pour custom actions futurs
- AbacResult.appliedPolicy : trace quelle policy a evalue (audit)

**Criteres validation** :
- V1 (P0) : Interfaces compilent
- V2 (P0) : `AbacContext` couvre cas usage 4 policies (Tache 2.3.7)
- V3 (P0) : `AbacResult.allowed` boolean + reason optional
- V4 (P0) : Resource types enum correct
- V5 (P1) : Zod schemas runtime validation

---

## Tache 2.3.7 -- AbacService + 4 Policies

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 7h / Depend de 2.3.6

**But** : Service evaluant ABAC policies + 4 policies fondamentales : OwnResources, TimeBased, StatusBased, WorkflowState.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/abac/abac.service.ts`
- [ ] Method `evaluate(role, permission, context): Promise<AbacResult>` :
  - Find policy applicable (via `appliesTo.permissions` match)
  - Si pas de policy applicable -> allowed (RBAC suffit)
  - Evaluer policy.evaluate(context)
  - Retourner result avec applied policy name
- [ ] Method `registerPolicy(policy: AbacPolicy)` -- registration dynamique
- [ ] **Policy 1 : OwnResourcesPolicy** -- "user peut acceder seulement resources qu'il a cree ou est assigne"
  - Applicable a permissions `*.read_own`, `*.update_own`, `*.delete_own`
  - Verifie `resource.attributes.owner_user_id === userId` OR `resource.attributes.assigned_user_id === userId`
- [ ] **Policy 2 : TimeBasedPolicy** -- "operation autorisee seulement dans creneau temporel"
  - E.g. `pay.transactions.refund` autorise seulement < 30 jours apres transaction
  - Lit `resource.attributes.created_at` + check NOW - created_at < threshold
- [ ] **Policy 3 : StatusBasedPolicy** -- "operation autorisee seulement si resource dans status specifique"
  - E.g. `insure.policies.cancel` autorise si police status='active'
  - Lit `resource.attributes.status` + check IN allowed statuses
- [ ] **Policy 4 : WorkflowStatePolicy** -- "transition workflow autorisee seulement depuis status specifique"
  - E.g. `repair.sinistres.close` autorise depuis status='reparation_completed' ONLY
  - Lit `resource.attributes.status` + check valid transition
- [ ] Logs structures : policy applied + result + reason
- [ ] Tests unitaires : 4 policies x 5+ scenarios chacune

**Pattern critique : OwnResourcesPolicy**

```typescript
// repo/packages/auth/src/abac/policies/own-resources.policy.ts
@Injectable()
export class OwnResourcesPolicy implements AbacPolicy {
  name = 'OwnResources';
  appliesTo = {
    permissions: [
      Permission.CRM_CONTACTS_READ_OWN,
      Permission.CRM_CONTACTS_UPDATE_OWN,
      Permission.INSURE_POLICIES_READ_OWN,
      Permission.REPAIR_SINISTRES_READ_OWN,
      // ... toutes les permissions *_own
    ],
  };

  async evaluate(context: AbacContext): Promise<AbacResult> {
    const { userId, resource } = context;
    const ownerId = resource.attributes.owner_user_id as string | undefined;
    const assignedId = resource.attributes.assigned_user_id as string | undefined;

    if (ownerId === userId || assignedId === userId) {
      return { allowed: true, appliedPolicy: this.name };
    }

    return {
      allowed: false,
      reason: 'NOT_OWNER',
      appliedPolicy: this.name,
    };
  }
}
```

**WorkflowStatePolicy exemple sinistre transitions** :

```typescript
const SINISTRE_TRANSITIONS: Record<string, string[]> = {
  'declared': ['acknowledged', 'rejected'],
  'acknowledged': ['expert_assigned', 'rejected'],
  'expert_assigned': ['expertise_completed'],
  'expertise_completed': ['devis_received'],
  'devis_received': ['devis_approved', 'devis_rejected'],
  'devis_approved': ['reparation_started'],
  'reparation_started': ['reparation_completed'],
  'reparation_completed': ['closed'],  // garage_chef close
  'closed': [],                          // terminal
  'rejected': [],
};
```

**Fichiers crees / modifies** :
```
repo/packages/auth/src/abac/abac.service.ts                            # ~150 lignes
repo/packages/auth/src/abac/policies/own-resources.policy.ts            # ~60 lignes
repo/packages/auth/src/abac/policies/time-based.policy.ts                # ~80 lignes
repo/packages/auth/src/abac/policies/status-based.policy.ts              # ~80 lignes
repo/packages/auth/src/abac/policies/workflow-state.policy.ts            # ~120 lignes
repo/packages/auth/src/abac/policies/{4 policies}.spec.ts                # ~100 lignes chacun
```

**Notes implementation** :
- Policies registree au boot via `AbacService.registerPolicy(policy)` (DI NestJS)
- One permission peut matcher plusieurs policies -- evaluees toutes (logic AND par defaut)
- TimeBasedPolicy threshold configurable per permission (jsonb config par permission)
- WorkflowStatePolicy : SINISTRE_TRANSITIONS map plat (preparation Sprint 22)
- Performance : policies stateless + rapide (no DB query si attributes deja loaded)
- Caching : Tache 2.3.10 cache result ABAC pour 1min sur (role, permission, resource_id)

**Criteres validation** :
- V1 (P0) : `evaluate` route vers policy correct
- V2 (P0) : OwnResourcesPolicy : owner OK, non-owner reject
- V3 (P0) : TimeBasedPolicy : < threshold OK, > threshold reject
- V4 (P0) : StatusBasedPolicy : status allowed OK, autre reject
- V5 (P0) : WorkflowStatePolicy : transition valide OK, invalide reject
- V6 (P0) : Si pas de policy applicable -> allowed (RBAC enough)
- V7 (P0) : Logs structured emit
- V8 (P1) : Tests 20+ scenarios passent

---

## Tache 2.3.8 -- AbacGuard + Decorator @AbacPolicy()

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 5h / Depend de 2.3.7

**But** : Guard NestJS evaluant ABAC policies sur endpoint, avec decorator pour declarer resource type + identifier extraction.

**Livrables checkables** :
- [ ] Decorator `@AbacResource(type, idExtractor)` -- declare resource type + comment extraire id depuis request
- [ ] idExtractor function : `(req) => string` (e.g. `req => req.params.id`)
- [ ] Guard `repo/apps/api/src/common/guards/abac.guard.ts`
- [ ] Logic :
  - Lit metadata `@AbacResource()` + `@RequirePermission()`
  - Extract resource ID depuis request via extractor
  - Charger resource attributes depuis DB (cache 1min)
  - Build AbacContext
  - Call `abacService.evaluate(role, permission, context)`
  - 403 si denied
- [ ] Loader function injectable per resource type : `loadCrmContact(id)`, `loadInsurePolice(id)`, etc.
- [ ] Cache resource Redis 1min (eviter re-fetch a chaque request)
- [ ] Audit log : ABAC denied + reason
- [ ] Tests : owner can read, non-owner reject, status workflow

**Pattern critique : @AbacResource + Guard**

```typescript
// repo/apps/api/src/common/decorators/abac-resource.decorator.ts
export const ABAC_RESOURCE_KEY = 'abacResource';
export const AbacResource = (
  type: string,
  idExtractor: (req: FastifyRequest) => string = (req) => req.params['id'],
) => SetMetadata(ABAC_RESOURCE_KEY, { type, idExtractor });

// Usage controller :
@Get(':id')
@RequirePermission('crm.contacts.read_own')
@AbacResource('crm_contact')
async getContact(@Param('id') id: string) { ... }

// repo/apps/api/src/common/guards/abac.guard.ts
@Injectable()
export class AbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abac: AbacService,
    private resourceLoader: ResourceLoaderService,  // factory loaders
    private rbacAudit: RbacAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const abacResource = this.reflector.get<{ type: string; idExtractor: any }>(
      ABAC_RESOURCE_KEY,
      context.getHandler(),
    );
    const permissions = this.reflector.get<PermissionValue[]>(PERMISSIONS_KEY, context.getHandler());

    if (!abacResource || !permissions?.length) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const resourceId = abacResource.idExtractor(req);
    const resource = await this.resourceLoader.load(abacResource.type, resourceId);

    if (!resource) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND' });
    }

    const userCtx = getCurrentContext();
    const abacContext: AbacContext = {
      userId: userCtx!.userId!,
      role: userCtx!.userRole!,
      tenantId: userCtx!.tenantId!,
      resource: {
        type: abacResource.type,
        id: resourceId,
        attributes: resource,
      },
      action: req.method.toLowerCase(),
      requestContext: { ipAddress: req.ip, userAgent: req.headers['user-agent'] ?? '', timestamp: new Date() },
    };

    for (const permission of permissions) {
      const result = await this.abac.evaluate(userCtx!.userRole!, permission, abacContext);
      if (!result.allowed) {
        await this.rbacAudit.logAbacDenied({
          permission, policy: result.appliedPolicy, reason: result.reason,
          userId: userCtx!.userId!, resource: { type: abacResource.type, id: resourceId },
        });
        throw new ForbiddenException({
          code: 'ABAC_DENIED',
          policy: result.appliedPolicy,
          reason: result.reason,
        });
      }
    }
    return true;
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/decorators/abac-resource.decorator.ts                # ~20 lignes
repo/apps/api/src/common/guards/abac.guard.ts                                  # ~120 lignes
repo/apps/api/src/common/services/resource-loader.service.ts                   # ~80 lignes (factory loaders)
repo/apps/api/src/common/guards/abac.guard.spec.ts                             # ~150 lignes
```

**Notes implementation** :
- ResourceLoaderService : Map<resource_type, Loader> registree au boot par chaque module
- Cache resource Redis 1min : balance fresh data vs perf
- ABAC apres RBAC dans chain guards : RBAC eliminate cas evidents (permission absente)
- AbacGuard execute APRES PermissionGuard : seulement si RBAC OK, alors check ABAC
- Pattern alternatif : ABAC evaluation dans service metier (vs guard) -- plus flexible mais plus boilerplate

**Criteres validation** :
- V1 (P0) : @AbacResource + permission *_own : owner OK
- V2 (P0) : @AbacResource + permission *_own : non-owner reject 403 ABAC_DENIED
- V3 (P0) : Resource not found -> 404
- V4 (P0) : Cache resource hit 2eme call
- V5 (P0) : Audit log ABAC denied
- V6 (P0) : Workflow transition test (close sinistre depuis state valide)
- V7 (P0) : Tests 10+ scenarios

---

## Tache 2.3.9 -- RbacAuditService : Log Access Granted + Denied

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 4h / Depend de 2.3.8

**But** : Service centralise log toutes evaluations RBAC/ABAC (granted + denied) pour audit + detection abus + reporting.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/auth/services/rbac-audit.service.ts`
- [ ] Methods :
  - `logAccessGranted({ userId, tenantId, role, permission, resource, endpoint })` -- INSERT audit_log
  - `logAccessDenied({ userId, tenantId, role, permissions, endpoint, reason })` -- INSERT audit_log + Kafka event
  - `logAbacDenied({ permission, policy, reason, userId, resource })` -- INSERT audit_log + Kafka
- [ ] Audit log : action='auth.access_granted' / 'auth.access_denied', resource_type=permission, changes=context
- [ ] Kafka event `insurtech.events.audit.access_denied` (alerting Sprint 33+)
- [ ] Logging granted optionnel (pour reduire volume) : seulement si LOG_RBAC_GRANTED env true
- [ ] Logging denied TOUJOURS (critical security event)
- [ ] Tests : grant + deny logged correctement

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/auth/services/rbac-audit.service.ts            # ~150 lignes
repo/apps/api/src/modules/auth/services/rbac-audit.service.spec.ts        # ~100 lignes
```

**Notes implementation** :
- Audit log row volumineux possible : sample 10% granted en prod (env config)
- Denied TOUJOURS logged : critical pour audit + detection brute force RBAC
- Kafka event denied : Sprint 33 setup alerting (Slack notification si > 100 denied / hour same user)
- Resource_type : permission name (e.g. 'crm.contacts.create')

**Criteres validation** :
- V1 (P0) : `logAccessGranted` INSERT audit_log row
- V2 (P0) : `logAccessDenied` INSERT + Kafka event
- V3 (P0) : Granted logging configurable env
- V4 (P0) : Denied toujours logged
- V5 (P0) : Tests 6+ scenarios

---

## Tache 2.3.10 -- PermissionCacheService Redis

**Metadonnees** : Phase 2 / Sprint 7 / P1 / 4h / Depend de 2.3.9

**But** : Cache Redis pour permissions effectives par role + ABAC results (eviter recompute).

**Livrables checkables** :
- [ ] Service `repo/apps/auth/src/rbac/permission-cache.service.ts`
- [ ] Method `getEffectivePermissions(role: AuthRole): Promise<Set<Permission>>` -- cache 5min
- [ ] Method `invalidateRole(role: AuthRole): Promise<void>` -- delete cache entry
- [ ] Method `invalidateAll(): Promise<void>` -- nuclear option (matrix updated)
- [ ] Cache key : `rbac:effective:{role}` -> JSON array permissions
- [ ] Cache ABAC results (optional) : key `abac:{userId}:{permission}:{resourceType}:{resourceId}` -> result, TTL 1min
- [ ] Cache invalidation events : listen `rbac.matrix_updated`, `auth.role_changed` -> invalidate
- [ ] Logs : cache hit/miss
- [ ] Tests : cache works + invalidation propagates

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permission-cache.service.ts            # ~100 lignes
repo/packages/auth/src/rbac/permission-cache.service.spec.ts       # ~100 lignes
```

**Notes implementation** :
- Redis DB 0 (CACHE) avec namespace `rbac:`
- TTL 5min role permissions : balance staleness vs perf
- TTL 1min ABAC : plus court car resource attributes peuvent changer
- Invalidation via Kafka events : sync entre instances API multiples (Phase 7+)
- Logs cache hit/miss : metric Prometheus utile (Sprint 34 perf)

**Criteres validation** :
- V1 (P1) : Cache hit 2eme call meme role
- V2 (P1) : Invalidation : cache evict apres event
- V3 (P1) : TTL 5min respecte
- V4 (P1) : Logs hit/miss emit
- V5 (P1) : Tests 6+ scenarios

---

## Tache 2.3.11 -- PermissionsController : Endpoints Admin Gestion Roles

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 4h / Depend de 2.3.10

**But** : Endpoints super admin pour introspection : lister roles, voir permissions par role, voir audit denied recent.

**Livrables checkables** :
- [ ] Controller `repo/apps/api/src/modules/admin/controllers/admin-permissions.controller.ts`
- [ ] Endpoints (super admin only) :
  - `GET /api/v1/admin/rbac/roles` -- liste 12 roles + count permissions
  - `GET /api/v1/admin/rbac/roles/:role/permissions` -- liste permissions effectives (avec hierarchy resolution)
  - `GET /api/v1/admin/rbac/permissions` -- liste 85+ permissions catalog
  - `GET /api/v1/admin/rbac/audit/denied` -- liste recent denied access (filtres : userId, role, since)
  - `GET /api/v1/admin/rbac/audit/stats` -- stats agregatte (denied par role, par permission)
- [ ] Pas d'endpoint write Sprint 7 (matrix code-as-config) -- Phase 7+ ajoutera tier custom
- [ ] Pagination + filtres
- [ ] Cache 1h sur GET roles/permissions (matrix change rarement)
- [ ] Tests E2E : super admin OK, autre role 403

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/admin/controllers/admin-permissions.controller.ts   # ~120 lignes
repo/apps/api/src/modules/admin/services/admin-permissions.service.ts          # ~100 lignes
repo/apps/api/test/admin-permissions.e2e-spec.ts                                # ~80 lignes
```

**Notes implementation** :
- Endpoints lecture seule Sprint 7 (config-as-code)
- Phase 7+ ajout endpoints write : custom permissions per tenant (feature pricing tier)
- audit/denied utile pour debug "pourquoi user n'a pas pu faire X"
- audit/stats : detection patterns (e.g. user fait 100 denied en 1h -> compromission?)

**Criteres validation** :
- V1 (P0) : GET /admin/rbac/roles retourne 12
- V2 (P0) : GET /admin/rbac/roles/:role/permissions retourne effectives + hierarchy
- V3 (P0) : GET /admin/rbac/permissions retourne 85+
- V4 (P0) : GET /admin/rbac/audit/denied retourne recents
- V5 (P0) : Non-super admin reject 403
- V6 (P1) : Tests E2E 6+ scenarios

---

## Tache 2.3.12 -- Tests Exhaustifs (80+) + Seeds Dev 12 Users

**Metadonnees** : Phase 2 / Sprint 7 / P0 / 9h / Depend de 2.3.11

**But** : Validation EXHAUSTIVE : pour chaque role x action representative, verifier authorization correct. Plus seeds dev creant 12 users (un par role) pour faciliter dev/tests.

**Livrables checkables** :

**Tests RBAC exhaustifs (80+ scenarios)** :
- [ ] Suite `repo/apps/api/test/rbac/role-matrix-coverage.spec.ts` :
  - For each of 12 roles : iterate sample 10 permissions (representative) -> assert allowed/denied selon matrix
  - Total ~120 assertions
- [ ] Tests par role specifiques :
  - `super_admin_platform.spec.ts` : verify wildcard (5 permissions random -> all allowed)
  - `analyst_support.spec.ts` : read OK, write denied
  - `broker_admin.spec.ts` : full CRM + Insure + tenant management
  - `broker_user.spec.ts` : limited (no delete, no admin)
  - `assure.spec.ts` : *_own only, denied *_all
  - `prospect.spec.ts` : public only
- [ ] Tests ABAC :
  - OwnResourcesPolicy : owner OK, non-owner deny
  - TimeBasedPolicy : refund < 30j OK, > 30j deny
  - StatusBasedPolicy : police active cancel OK, expired deny
  - WorkflowStatePolicy : sinistre transitions valides + invalides
- [ ] Tests integration full stack :
  - Endpoint `/api/v1/contacts` POST avec broker_user OK
  - Endpoint `/api/v1/contacts/:id` DELETE avec broker_user reject 403
  - Endpoint `/api/v1/admin/tenants` GET avec broker_admin reject 403

**Seeds dev 12 users** :
- [ ] Script `repo/infrastructure/scripts/seed-rbac-users.ts` :
  - Cree 12 users (1 par role) avec password `Test1234!@#$` (NEVER prod)
  - Tenants : 1 cabinet courtier "Cabinet Demo Bennani" + 1 garage "Garage Demo Atlas"
  - Distribution : super_admin (platform), analyst (platform), 3 broker users (Bennani), 5 garage users (Atlas), 1 assure (Atlas), 1 prospect (no tenant)
  - Email pattern : `{role}@demo.skalean-insurtech.ma`
  - MFA disabled (faciliter tests)
- [ ] Documentation `repo/docs/runbooks/rbac-test-users.md` -- listing users + leur role + leurs permissions
- [ ] `pnpm seeds:rbac` script

**Fichiers crees / modifies** :
```
repo/apps/api/test/rbac/role-matrix-coverage.spec.ts                       # ~200 lignes (exhaustif)
repo/apps/api/test/rbac/super-admin-platform.spec.ts                       # ~80 lignes
repo/apps/api/test/rbac/analyst-support.spec.ts                             # ~80 lignes
repo/apps/api/test/rbac/broker-admin.spec.ts                                # ~100 lignes
repo/apps/api/test/rbac/broker-user.spec.ts                                 # ~100 lignes
repo/apps/api/test/rbac/garage-admin.spec.ts                                # ~100 lignes
repo/apps/api/test/rbac/garage-technicien.spec.ts                           # ~80 lignes
repo/apps/api/test/rbac/assure.spec.ts                                       # ~80 lignes
repo/apps/api/test/rbac/prospect.spec.ts                                     # ~60 lignes
repo/apps/api/test/abac/own-resources.spec.ts                                # ~120 lignes
repo/apps/api/test/abac/time-based.spec.ts                                   # ~80 lignes
repo/apps/api/test/abac/workflow-state.spec.ts                               # ~120 lignes
repo/infrastructure/scripts/seed-rbac-users.ts                                # ~250 lignes
repo/docs/runbooks/rbac-test-users.md                                         # ~80 lignes
```

**Notes implementation** :
- Test "matrix coverage" : meta-test iterant matrix programmatically (force a jour)
- Per-role tests : focus cas usage realiste
- ABAC tests : setup data fixtures complete (resources avec attributes)
- Seeds : password commun facilite tests, mais NEVER prod
- E2E : Playwright project api ou Vitest integration (depend complexite setup)

**Criteres validation** :
- V1 (P0) : 80+ scenarios tests passent
- V2 (P0) : Coverage : tous 12 roles testes
- V3 (P0) : Coverage : tous 4 ABAC policies testees
- V4 (P0) : Tests passent CI
- V5 (P0) : Seeds creent 12 users avec roles distincts
- V6 (P0) : Documentation runbook claire
- V7 (P0) : Reproducibility : run 5x consecutif passe
- V8 (P1) : Performance : suite tests < 60s

---

## Sortie du Sprint 7

A la fin de l'execution des 12 taches :

```
RBAC + ABAC system fully operational :
  - 12 roles enforcees + 85+ permissions catalogues
  - PermissionsMatrix code-as-config + RoleHierarchy
  - RbacService canAccess/canAccessAny/canAccessAll
  - 3 guards : RoleGuard / PermissionGuard / AbacGuard
  - 5 decorators : @Role / @MinRole / @RequirePermission / @RequireAnyPermission / @AbacResource
  - 4 ABAC policies : OwnResources / TimeBased / StatusBased / WorkflowState
  - PermissionCacheService Redis (5min role perms, 1min ABAC results)
  - RbacAuditService : audit all granted/denied + Kafka events
  - 4 endpoints admin : roles list / role permissions / catalog / audit denied

Tests :
  - 80+ scenarios RBAC + ABAC
  - 12 seeds users (un par role) pour dev/demo
```

**Phase 2 (Securite & Multi-tenant) COMPLETE** : Auth + Multi-tenant + RBAC operationnels.

**Sprint 8 (Phase 3 -- Modules Horizontaux) demarre avec** :
- Authentication securisee (Sprint 5)
- Multi-tenant isolation strict (Sprint 6)
- Authorization granulaire 12 roles x 85+ permissions (Sprint 7)
- Tests exhaustifs assurant integrite securite

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-2.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-07-rbac/`.

**Patterns code inline conserves** : Permission enum naming convention, PermissionsMatrix structure exhaustive, RbacService.canAccess flow, @RequirePermission decorator + guard, OwnResourcesPolicy implementation, AbacGuard chain logic, sinistre workflow transitions map.

**Reference complete** : `00-pilotage/documentation/5-roles-permissions.md` est source de verite humaine. Sprint 7 transforme en code TypeScript.

---

**Fin du meta-prompt B-07 v2.2 format Option B.**
