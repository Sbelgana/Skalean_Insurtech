# META-PROMPT B-06 -- SPRINT 6 MULTI-TENANT 3 NIVEAUX

**Version** : v2.2 (Option B)
**Phase** : 2 -- Securite & Multi-tenant
**Sprint** : 6 / 35 (cumul) -- Phase 2 Sprint 2
**Position** : Apres Auth Foundations
**Numerotation taches** : 2.2.1 a 2.2.12
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous sprints metier necessitant isolation tenants)

---

## Objectif Global du Sprint

Implementer **isolation multi-tenant stricte 3 niveaux** au runtime : Platform (super_admin) / Customer Tenant (cabinet courtier ou garage) / Assure (L3 dans tenant). Sprint 1 a livre les helpers SQL, Sprint 2 les RLS policies. Sprint 6 ajoute la couche applicative qui les active : middleware lit `x-tenant-id`, guard valide, interceptor execute `SET LOCAL` Postgres avant chaque transaction.

A la sortie de ce sprint :
- Header `x-tenant-id` mandatory partout sauf `/api/v1/public/*` et `/api/v1/admin/*` (super admin)
- TenantContext propagate via AsyncLocalStorage a TOUS les services downstream
- Postgres `SET LOCAL app.current_tenant_id` execute automatique avant chaque transaction
- Super admin bypass : `/api/v1/admin/*` set `app.is_super_admin = true`
- L3 Assure : routes `/api/v1/assure/*` set `app.assure_user_id` filter additionnel
- Cross-tenant authorizations (3 types v2.0) preparees pour Sprint 26
- Endpoints CRUD tenants : `/api/v1/admin/tenants/*` (super admin uniquement)
- Tenant onboarding workflow : creation cabinet/garage + super_admin tenant assignment
- Quotas par tenant (utilisateurs max, polices max, storage max)
- Tests RLS isolation EXHAUSTIFS : 0 leak cross-tenant possible
- Procedure purge tenant data CNDP loi 09-08

---

## Frontiere du Sprint

**INCLUS** :
- TenantContextService (AsyncLocalStorage + types)
- TenantContextMiddleware (lit header, valide)
- TenantContextGuard + decorators
- TenantTransactionInterceptor (SET LOCAL automatique)
- TenantValidationService (tenant existence + actif + suspension)
- CrossTenantAuthorizationService (3 types Sprint 26)
- TenantManagementService + endpoints CRUD
- TenantOnboardingService (create + bootstrap super_admin tenant)
- TenantSuspensionService
- SuperAdminGuard + endpoints `/api/v1/admin/*`
- ResourceQuotaService (quotas + audit)
- Tests RLS isolation + procedure purge CNDP

**EXCLU** (sera ajoute aux sprints suivants) :
- Cross-tenant runtime active (Sprint 26 framework + flux client garage)
- Tenants management UI (Sprint 28 admin app)
- Reports compliance multi-tenants (Sprint 29)
- Tenant tier pricing logic (Phase 7+)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- 3 niveaux multi-tenant + 12 roles + cas d'acces
2. `00-pilotage/documentation/4-templates-generation.md` -- pattern multi-tenant transverse R1
3. `00-pilotage/documentation/5-roles-permissions.md` -- matrice 12 roles
4. Sortie Sprint 1 : helpers SQL `app_current_tenant()`, `app_is_super_admin()`, `app_can_access_tenant()`
5. Sortie Sprint 2 : RLS policies sur 32 tables, table `auth_tenants`, table `cross_tenant_authorizations` (preparation)
6. Sortie Sprint 3 : `RequestContext` AsyncLocalStorage (skeleton, enrichi Sprint 6)
7. Sortie Sprint 5 : JWT contient `tenant_id` claim

---

## Stack Imposee (Sprint 6)

| Composant | Version | Notes |
|-----------|---------|-------|
| @nestjs/common | 10.4.15 | guards/interceptors NestJS |
| async_hooks | Node native | AsyncLocalStorage |
| zod | 3.24.1 | validation tenant_id UUID |

Pas de nouvelle dep Sprint 6 (utilise stack Sprint 1-5).

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 2.2.1 | TenantContextService -- AsyncLocalStorage + types enrichis Sprint 3 | 4h | P0 | Sprint 5 |
| 2.2.2 | TenantContextMiddleware -- lit x-tenant-id + valide UUID + coherence JWT | 5h | P0 | 2.2.1 |
| 2.2.3 | TenantContextGuard + decorators @TenantId() @Tenant() @CurrentTenant() | 4h | P0 | 2.2.2 |
| 2.2.4 | TenantTransactionInterceptor -- SET LOCAL Postgres automatique | 6h | P0 | 2.2.3 |
| 2.2.5 | TenantValidationService -- existence + actif + suspension check | 4h | P0 | 2.2.4 |
| 2.2.6 | CrossTenantAuthorizationService -- 3 types v2.0 (preparation Sprint 26) | 6h | P0 | 2.2.5 |
| 2.2.7 | TenantManagementService + endpoints CRUD `/api/v1/admin/tenants/*` | 6h | P0 | 2.2.6 |
| 2.2.8 | TenantOnboardingService -- workflow creation cabinet/garage + super_admin assignment | 5h | P0 | 2.2.7 |
| 2.2.9 | TenantSuspensionService -- suspend/reactivate + revoke sessions | 4h | P0 | 2.2.8 |
| 2.2.10 | SuperAdminGuard + endpoints `/api/v1/admin/*` (bypass RLS) | 4h | P0 | 2.2.9 |
| 2.2.11 | ResourceQuotaService -- quotas par tenant + enforcement + audit | 5h | P1 | 2.2.10 |
| 2.2.12 | Tests RLS isolation EXHAUSTIFS + procedure purge CNDP loi 09-08 | 9h | P0 | 2.2.11 |

**Total** : 62 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 2.2.1 -- TenantContextService : AsyncLocalStorage + Types

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 4h / Depend de Sprint 5

**But** : Service centralise expose AsyncLocalStorage avec types riches (TenantContext) pour propagation request-scoped sans devoir passer parametres a chaque service downstream.

**Contexte** : Sprint 3 a livre `RequestContext` skeleton. Sprint 6 enrichit avec contexte tenant complet : tenant_id, role utilisateur dans tenant, permissions effectives, isSuperAdmin flag, assureUserId pour L3. Service centralise = source unique de verite pour tout le runtime.

**Livrables checkables** :
- [ ] Service `repo/packages/auth/src/services/tenant-context.service.ts`
- [ ] Type `TenantContext` enrichi Sprint 3 RequestContext :
  - `tenantId?: string` (null si super admin platform-level)
  - `userId?: string` (null si endpoint public)
  - `userRole?: AuthRole` (depuis JWT)
  - `isSuperAdmin: boolean`
  - `assureUserId?: string` (pour L3 assure routes)
  - `crossTenantAuthorizationId?: string` (Sprint 26)
  - `tenantSettings?: TenantSettings` (cache settings courant tenant -- evite re-fetch)
  - `traceId: string`
  - `correlationId?: string`
  - `ipAddress: string`
  - `userAgent: string`
- [ ] Method `runWithContext<T>(ctx: TenantContext, fn: () => T): T` -- wraps async operation
- [ ] Method `getCurrentContext(): TenantContext | undefined`
- [ ] Helpers : `getCurrentTenantId()`, `getCurrentUserId()`, `getCurrentUserRole()`, `isSuperAdmin()`, `getAssureUserId()`, `getCrossTenantAuthId()`
- [ ] Method `requireTenantId(): string` -- throws si pas de tenant context (use cases : services qui doivent avoir tenant)
- [ ] Method `requireSuperAdmin(): void` -- throws si pas super admin
- [ ] Service exporte aussi un `tenantContextStorage` (instance AsyncLocalStorage) pour interop Sprint 2 subscribers
- [ ] Tests unitaires : context propagation through async/await, isolation entre 2 contexts paralleles, helpers retournent bonnes valeurs

**Pattern critique : AsyncLocalStorage TenantContext**

```typescript
// repo/packages/auth/src/services/tenant-context.service.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId?: string;
  userId?: string;
  userRole?: AuthRole;
  isSuperAdmin: boolean;
  assureUserId?: string;
  crossTenantAuthorizationId?: string;
  tenantSettings?: TenantSettings;
  traceId: string;
  correlationId?: string;
  ipAddress: string;
  userAgent: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

@Injectable()
export class TenantContextService {
  runWithContext<T>(ctx: TenantContext, fn: () => T): T {
    return tenantContextStorage.run(ctx, fn);
  }

  getCurrentContext(): TenantContext | undefined {
    return tenantContextStorage.getStore();
  }

  requireTenantId(): string {
    const tenantId = this.getCurrentContext()?.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException({
        code: 'TENANT_CONTEXT_MISSING',
        message: 'Operation requires tenant context',
      });
    }
    return tenantId;
  }
  // ... other helpers
}
```

**Fichiers crees / modifies** :
```
repo/packages/auth/src/services/tenant-context.service.ts            # ~150 lignes
repo/packages/auth/src/services/tenant-context.service.spec.ts       # ~120 lignes
repo/packages/auth/src/types/tenant-context.ts                        # ~40 lignes (interfaces)
```

**Notes implementation** :
- `tenantContextStorage` exporte tel quel pour permettre subscribers TypeORM Sprint 2 d'acceder au context (pattern : import + getStore)
- `requireTenantId()` vs `getCurrentTenantId()` : require throws si manquant (force discipline), get retourne undefined (laisse au caller decider)
- Cache `tenantSettings` dans context : evite re-fetch DB a chaque service appele dans la request
- AsyncLocalStorage isolation : 2 requests paralleles ont contexts distincts (no leak)
- Service Global module (annotation `@Global()`) -- accessible partout sans import explicite

**Criteres validation** :
- V1 (P0) : `runWithContext(ctx, fn)` execute fn avec context accessible
- V2 (P0) : `getCurrentContext()` retourne context actif
- V3 (P0) : 2 requests paralleles ont contexts isoles (test integration)
- V4 (P0) : `requireTenantId()` throws si pas de context
- V5 (P0) : `requireSuperAdmin()` throws si !isSuperAdmin
- V6 (P0) : Helpers retournent bonnes valeurs (5+ tests)
- V7 (P0) : Async/await + setTimeout propagent context correctement
- V8 (P1) : Tests integration confirment isolation

---

## Tache 2.2.2 -- TenantContextMiddleware : Lit x-tenant-id + Valide

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 5h / Depend de 2.2.1

**But** : Middleware NestJS lisant header `x-tenant-id`, validant coherence avec JWT, et initialisant le TenantContext pour la suite de la request.

**Contexte** : Frontend envoie `x-tenant-id` correspondant au tenant utilise par l'utilisateur (un user peut avoir acces a plusieurs tenants via `auth_tenant_users` Sprint 2). Le middleware valide que :
1. Header est present (sauf endpoints publics/admin)
2. Header est UUID v4 valide
3. Header correspond a un tenant que l'utilisateur authentifie peut acceder (via `auth_tenant_users`)
4. Tenant n'est pas suspendu (Tache 2.2.5)

**Livrables checkables** :
- [ ] Middleware `repo/apps/api/src/common/middleware/tenant-context.middleware.ts`
- [ ] Lecture header `x-tenant-id` depuis request
- [ ] Validation UUID v4 via Zod
- [ ] Si endpoint dans `/api/v1/public/*` -> set `tenantId: undefined, isSuperAdmin: false`
- [ ] Si endpoint dans `/api/v1/admin/*` -> set `isSuperAdmin: true, tenantId: undefined` (Tache 2.2.10 SuperAdminGuard valide role)
- [ ] Si endpoint dans `/api/v1/assure/*` (Sprint 19) -> set `assureUserId = userId, tenantId = userTenantId`
- [ ] Sinon endpoint normal :
  - Verifier user a acces au tenant via `auth_tenant_users` (cache Redis 5min)
  - Si pas d'acces -> 403 `TENANT_ACCESS_DENIED`
  - Set `tenantId, userRole` depuis `auth_tenant_users.role`
- [ ] Si JWT.tenant_id !== header x-tenant-id ET user n'est pas multi-tenant capable -> 403 `TENANT_MISMATCH`
- [ ] Charger `tenantSettings` (cache Redis) et inclure dans context
- [ ] Wrapper la suite de la request dans `runWithContext()`
- [ ] Logs structures : tenant_id, user_id, role, route
- [ ] Apply via `MiddlewareConsumer.apply(...).forRoutes('*')`
- [ ] Tests : header valide OK, header invalide UUID 400, user pas acces tenant 403

**Pattern critique : middleware logic complete**

```typescript
// repo/apps/api/src/common/middleware/tenant-context.middleware.ts
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private tenantContext: TenantContextService,
    private tenantValidation: TenantValidationService,
  ) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void): Promise<void> {
    const path = req.url;
    const baseContext = {
      traceId: getTraceId() ?? ulid(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? '',
      isSuperAdmin: false,
    };

    // Public routes : no tenant required
    if (path.startsWith('/api/v1/public/') || path === '/healthz' || path === '/readyz' || path.startsWith('/docs')) {
      this.tenantContext.runWithContext({ ...baseContext }, () => next());
      return;
    }

    // Admin routes : super admin context (validation done by SuperAdminGuard)
    if (path.startsWith('/api/v1/admin/')) {
      const userId = req.user?.id;
      this.tenantContext.runWithContext({ ...baseContext, userId, isSuperAdmin: true }, () => next());
      return;
    }

    // Tenant routes : require x-tenant-id header
    const tenantIdHeader = req.headers['x-tenant-id'];
    const validation = z.string().uuid().safeParse(tenantIdHeader);
    if (!validation.success) {
      throw new BadRequestException({ code: 'TENANT_ID_INVALID', message: 'x-tenant-id must be UUID' });
    }
    const tenantId = validation.data;

    // Validate user has access to this tenant
    const userId = req.user!.id;
    const access = await this.tenantValidation.userCanAccessTenant(userId, tenantId);
    if (!access.allowed) {
      throw new ForbiddenException({ code: 'TENANT_ACCESS_DENIED', reason: access.reason });
    }

    // Build context
    const context: TenantContext = {
      ...baseContext,
      tenantId,
      userId,
      userRole: access.role,
      isSuperAdmin: false,
      tenantSettings: await this.tenantValidation.getTenantSettings(tenantId),
    };

    // L3 Assure routes
    if (path.startsWith('/api/v1/assure/')) {
      context.assureUserId = userId;
    }

    this.tenantContext.runWithContext(context, () => next());
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/middleware/tenant-context.middleware.ts          # ~150 lignes
repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts     # ~150 lignes
repo/apps/api/src/app.module.ts                                            # update : configure middleware
```

**Notes implementation** :
- Cache `auth_tenant_users` Redis (DB 0 CACHE) TTL 5min : evite query DB a chaque request
- Cache `tenant_settings` Redis TTL 5min
- Invalidation cache : Sprint 7 RBAC + Sprint 27 admin update -> publish event Kafka cache invalidation
- Multi-tenant capable role : `super_admin_platform`, `analyst_support` (peuvent switcher tenant)
- L3 Assure : assure tenant_id = leur propre tenant (l'agence broker), `assureUserId` filter additionnel
- Cross-tenant header `x-cross-tenant-auth-id` (Sprint 26) traite par CrossTenantAuthorizationService

**Criteres validation** :
- V1 (P0) : Header valide -> context cree avec tenantId
- V2 (P0) : Header invalide UUID -> 400
- V3 (P0) : Header absent sur route protected -> 400 (PublicEndpointGuard Sprint 3)
- V4 (P0) : Header present mais user pas acces -> 403 TENANT_ACCESS_DENIED
- V5 (P0) : Routes /admin/* -> isSuperAdmin true, tenantId undefined
- V6 (P0) : Routes /assure/* -> assureUserId set
- V7 (P0) : Cache Redis hit 2eme request meme user/tenant
- V8 (P0) : Tenant suspendu -> 403 TENANT_SUSPENDED
- V9 (P0) : Logs emit avec tenant_id + user_id
- V10 (P1) : Tests middleware + integration passent

---

## Tache 2.2.3 -- TenantContextGuard + Decorators

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 4h / Depend de 2.2.2

**But** : Guard NestJS qui force la presence du TenantContext + decorators ergonomiques pour controllers (`@TenantId()`, `@Tenant()`, `@CurrentTenant()`).

**Livrables checkables** :
- [ ] Guard `repo/apps/api/src/common/guards/tenant-context.guard.ts`
- [ ] `canActivate()` : verifie TenantContext present, si pas Public + pas Admin -> doit avoir tenantId, sinon 400
- [ ] Decorator `@TenantId()` parameter : extract `tenantId` depuis context
- [ ] Decorator `@CurrentTenant()` parameter : extract full TenantContext.tenantSettings
- [ ] Decorator `@CurrentUser()` (deja Sprint 5) : enrichi avec userRole + tenantId
- [ ] Decorator `@AssureUserId()` parameter : extract `assureUserId` (utilise routes L3 Sprint 19)
- [ ] Decorator class-level `@RequireTenant()` : marque controller comme requiring tenant context
- [ ] Decorator class-level `@AdminOnly()` : marque controller comme `/api/v1/admin/*` (super admin)
- [ ] Tests : decorators retournent bonnes valeurs depuis context

**Pattern critique : decorator factory NestJS**

```typescript
// repo/apps/api/src/common/decorators/tenant-id.decorator.ts
export const TenantId = createParamDecorator((_, ctx: ExecutionContext): string | undefined => {
  return getCurrentTenantId();
});

// Usage controller :
@Controller('contacts')
export class ContactsController {
  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.list(tenantId, user.id);
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/guards/tenant-context.guard.ts                  # ~60 lignes
repo/apps/api/src/common/decorators/tenant-id.decorator.ts               # ~10 lignes
repo/apps/api/src/common/decorators/current-tenant.decorator.ts           # ~10 lignes
repo/apps/api/src/common/decorators/assure-user-id.decorator.ts           # ~10 lignes
repo/apps/api/src/common/decorators/require-tenant.decorator.ts           # ~5 lignes
repo/apps/api/src/common/decorators/admin-only.decorator.ts                # ~5 lignes
repo/apps/api/src/main.ts                                                  # update : useGlobalGuards
```

**Notes implementation** :
- `createParamDecorator` NestJS pattern : decorator parameter retourne value directement
- `@TenantId()` injecte `tenantId: string | undefined` -- caller decide quoi faire si undefined
- Pour controllers metier (CRM, Insure, Repair), utiliser `@TenantId() tenantId: string` + assertion non-null car middleware deja valide
- `@AdminOnly()` couple avec SuperAdminGuard (Tache 2.2.10)

**Criteres validation** :
- V1 (P0) : `@TenantId()` retourne tenantId du context
- V2 (P0) : `@CurrentTenant()` retourne TenantSettings
- V3 (P0) : `@AssureUserId()` retourne assureUserId si L3
- V4 (P0) : Guard rejette si tenantId manquant sur endpoint normal
- V5 (P0) : `@AdminOnly()` decorator pour route admin
- V6 (P1) : Tests decorators 4+ scenarios

---

## Tache 2.2.4 -- TenantTransactionInterceptor : SET LOCAL Postgres Automatique

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 6h / Depend de 2.2.3

**But** : Interceptor NestJS qui execute automatique `SET LOCAL app.current_tenant_id = '...'` Postgres avant chaque endpoint qui utilise la DB, garantissant que RLS policies (Sprint 2) sont actives.

**Contexte** : Sans cet interceptor, developpeur Sprint 8+ pourrait oublier de set le tenant context Postgres -> RLS policies retournent 0 rows (puisque `app_current_tenant()` retourne NULL). Interceptor automatise -> impossible d'oublier.

**Livrables checkables** :
- [ ] Interceptor `repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts`
- [ ] Wrap chaque endpoint dans une transaction TypeORM avec SET LOCAL
- [ ] Lit context : tenantId, isSuperAdmin, userId, assureUserId, crossTenantAuthorizationId
- [ ] Execute SET LOCAL pour chaque variable presente :
  - `SET LOCAL app.current_tenant_id = '<uuid>'`
  - `SET LOCAL app.is_super_admin = 'true'` (si isSuperAdmin)
  - `SET LOCAL app.current_user_id = '<uuid>'`
  - `SET LOCAL app.assure_user_id = '<uuid>'` (si L3)
  - `SET LOCAL app.cross_tenant_authorization_id = '<uuid>'` (Sprint 26)
- [ ] Skip pour endpoints qui ne font pas de DB (rare, decorator `@SkipTenantTransaction()`)
- [ ] Performance : transaction overhead < 5ms par endpoint
- [ ] Logs Pino : tenant_id + duree transaction
- [ ] Pattern integre avec `@insurtech/database` `withTenantContext()` helper Sprint 2 (interceptor utilise ce helper)
- [ ] Tests : RLS active automatique, SET LOCAL execute, transaction rollback si exception

**Pattern critique : interceptor avec EntityManager transaction**

```typescript
// repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const reflector = new Reflector();
    const skip = reflector.get<boolean>('skipTenantTransaction', context.getHandler());
    if (skip) return next.handle();

    const ctx = getCurrentContext();
    if (!ctx) {
      // Public endpoints : no transaction wrap
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.dataSource
        .transaction(async (em) => {
          // SET LOCAL all relevant variables
          if (ctx.tenantId) {
            await em.query(`SET LOCAL app.current_tenant_id = $1`, [ctx.tenantId]);
          }
          if (ctx.isSuperAdmin) {
            await em.query(`SET LOCAL app.is_super_admin = 'true'`);
          }
          if (ctx.userId) {
            await em.query(`SET LOCAL app.current_user_id = $1`, [ctx.userId]);
          }
          if (ctx.assureUserId) {
            await em.query(`SET LOCAL app.assure_user_id = $1`, [ctx.assureUserId]);
          }
          if (ctx.crossTenantAuthorizationId) {
            await em.query(`SET LOCAL app.cross_tenant_authorization_id = $1`, [ctx.crossTenantAuthorizationId]);
          }

          // Make EntityManager available in context for handlers (alternative : DI)
          ctx.transactionEntityManager = em;

          // Execute handler within this transaction
          return await firstValueFrom(next.handle());
        })
        .then((value) => {
          subscriber.next(value);
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));
    });
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.ts          # ~150 lignes
repo/apps/api/src/common/interceptors/tenant-transaction.interceptor.spec.ts     # ~150 lignes (tests integration RLS)
repo/apps/api/src/common/decorators/skip-tenant-transaction.decorator.ts          # ~5 lignes
repo/apps/api/src/main.ts                                                          # update : useGlobalInterceptors
```

**Notes implementation** :
- SET LOCAL active uniquement dans la transaction courante (auto-revert au commit/rollback)
- `$1` parameter binding evite SQL injection (pas string concat)
- Performance : SET LOCAL est tres rapide (< 1ms), overhead total ~5ms par endpoint
- Pattern alternatif : middleware avant interceptor route (mais interceptor permet rollback automatique sur exception)
- Endpoints sans DB : `@SkipTenantTransaction()` -- e.g. healthcheck, /me en lecture cache uniquement
- Coherence avec subscribers Sprint 2 : TenantIdInjector lit `app_current_tenant()` qui pointe vers cette variable

**Criteres validation** :
- V1 (P0) : Endpoint normal : SET LOCAL execute avant handler
- V2 (P0) : Test RLS : INSERT auto-injecte tenant_id (subscriber Sprint 2 utilise)
- V3 (P0) : Test SELECT : retourne uniquement rows tenant courant
- V4 (P0) : Endpoint admin : SET LOCAL is_super_admin -> SELECT cross-tenant OK
- V5 (P0) : Endpoint assure (L3) : SET LOCAL assure_user_id
- V6 (P0) : Exception dans handler -> transaction rollback
- V7 (P0) : `@SkipTenantTransaction()` : pas de transaction wrap
- V8 (P0) : Performance overhead < 10ms par endpoint
- V9 (P0) : Tests integration RLS exhaustifs (Tache 2.2.12 amplifie)

---

## Tache 2.2.5 -- TenantValidationService : Existence + Actif + Suspension

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 4h / Depend de 2.2.4

**But** : Service centralise validations tenant : verifier existence, statut (actif/suspendu/archive), acces user au tenant.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/tenant/services/tenant-validation.service.ts`
- [ ] Method `tenantExists(tenantId: string): Promise<boolean>` -- cache 5min
- [ ] Method `getTenantById(tenantId: string): Promise<AuthTenant | null>` -- cache 5min
- [ ] Method `isTenantActive(tenantId: string): Promise<boolean>` -- depend de status (active/suspended/archived)
- [ ] Method `userCanAccessTenant(userId: string, tenantId: string): Promise<{ allowed: boolean, role?: AuthRole, reason?: string }>` -- cache 5min
- [ ] Method `getTenantSettings(tenantId: string): Promise<TenantSettings>` -- cache 5min
- [ ] Method `requireActiveTenant(tenantId: string): Promise<AuthTenant>` -- throws si suspendu/archive
- [ ] Cache Redis DB 0 (CACHE), TTL 5min, namespace `tenant:*`
- [ ] Cache invalidation : event Kafka `tenant.settings_changed` -> delete cache key
- [ ] Logs structures : cache hit/miss, validation results
- [ ] Tests : tenant suspendu rejete, multi-tenant user OK, cache invalidation works

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/tenant/services/tenant-validation.service.ts            # ~180 lignes
repo/apps/api/src/modules/tenant/services/tenant-validation.service.spec.ts        # ~150 lignes
```

**Notes implementation** :
- Status tenant : enum `'active' | 'suspended' | 'archived'`
- Suspended tenant : no API access, mais data preservee (utilise pour facturation, defaut paiement)
- Archived tenant : pas API + data anonymized apres delai (loi 09-08 droit oubli)
- Cache invalidation crucial : sinon admin update settings, runtime continue avec ancien cache 5min
- `userCanAccessTenant` : check `auth_tenant_users` table jonction (Sprint 2)
- Multi-tenant user : super_admin_platform peut acceder TOUS tenants

**Criteres validation** :
- V1 (P0) : `tenantExists` retourne true/false correct
- V2 (P0) : `getTenantById` retourne tenant ou null
- V3 (P0) : `isTenantActive` rejette suspended/archived
- V4 (P0) : `userCanAccessTenant` retourne role si autorise
- V5 (P0) : `userCanAccessTenant` retourne reason si rejected
- V6 (P0) : `requireActiveTenant` throws ForbiddenException si suspendu
- V7 (P0) : Cache Redis hit 2e call meme params
- V8 (P0) : Cache invalide via event Kafka
- V9 (P1) : Tests 10+ scenarios

---

## Tache 2.2.6 -- CrossTenantAuthorizationService : 3 Types v2.0

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 6h / Depend de 2.2.5

**But** : Preparer infrastructure cross-tenant authorizations (3 types v2.0) -- utilisees Sprint 26 pour orchestration tenants (broker -> garage flux client).

**Contexte v2.0** : 3 types cross-tenant authorizations :
1. **broker_to_garage_assignment** : broker A assigne sinistre a garage B (broker peut suivre status, garage peut acceder dossier sinistre limite)
2. **assure_to_garage_visit** : assure visite garage B (sa propre selection M8) sans transfert tenant -- garage voit polices de l'assure pertinentes
3. **multi_tenant_user_access** : user role super_admin_platform ou analyst_support a acces transverse via /api/v1/admin/*

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.ts`
- [ ] Type `CrossTenantAuthorizationType` enum (3 types ci-dessus)
- [ ] Method `create(authzData): Promise<CrossTenantAuthorization>` -- INSERT row + audit log
- [ ] Method `validate(authzId, fromTenantId, toTenantId): Promise<{ allowed: boolean, scope?: string[] }>` -- check expiration + revocation + scope
- [ ] Method `revoke(authzId, reason): Promise<void>` -- soft delete (`revoked_at`)
- [ ] Method `listForTenant(tenantId): Promise<CrossTenantAuthorization[]>` -- pour admin UI
- [ ] Validation utilise helper Postgres `app_can_access_tenant()` (Sprint 1) lu via SET LOCAL `app.cross_tenant_authorization_id`
- [ ] Scope (jsonb) : array d'actions autorisees (ex: `['read.sinistre', 'write.devis', 'read.police']`)
- [ ] Audit log : create + revoke
- [ ] Sprint 6 livre infrastructure -- usage runtime Sprint 26 framework
- [ ] Tests : create authorization, validate granted, validate revoked rejected, scope check

**Pattern critique : table cross_tenant_authorizations migration**

Migration Sprint 6 etend table cross_tenant_authorizations (preparation Sprint 2 a deja cree skeleton) :

```sql
CREATE TABLE cross_tenant_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('broker_to_garage_assignment', 'assure_to_garage_visit', 'multi_tenant_user_access')),
  from_tenant_id uuid NOT NULL REFERENCES auth_tenants(id),
  to_tenant_id uuid NOT NULL REFERENCES auth_tenants(id),
  scope jsonb NOT NULL,                              -- ['read.sinistre', ...]
  resource_type text,                                 -- 'sinistre', 'police', etc.
  resource_id uuid,                                   -- ID specifique
  granted_by_user_id uuid REFERENCES auth_users(id),
  granted_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL,                    -- max 90 jours par defaut
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb,                                     -- contexte type-specific
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_cross_tenant_auth_active ON cross_tenant_authorizations
  (from_tenant_id, to_tenant_id)
  WHERE revoked_at IS NULL AND expires_at > NOW();
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.ts          # ~200 lignes
repo/apps/api/src/modules/tenant/services/cross-tenant-authorization.service.spec.ts     # ~180 lignes
repo/packages/database/src/entities/system/cross-tenant-authorization.entity.ts            # ~50 lignes
repo/packages/database/src/migrations/{date}-CrossTenantAuthorizations.ts                  # ~80 lignes (si pas deja Sprint 2)
```

**Notes implementation** :
- 3 types couvrent cas usage v2.0 metier (broker dispatch sinistre, assure choix garage, super admin transverse)
- Scope jsonb permet granularite : un broker_to_garage assignment peut autoriser 'read.sinistre' mais pas 'write'
- Expiration mandatory : max 90 jours par defaut (anti-stale)
- Revocation : soft delete (preserve audit trail)
- Sprint 26 implementera runtime usage : middleware lit header `x-cross-tenant-auth-id`, valide, set context
- Index partial (WHERE not revoked AND not expired) : queries actives rapides

**Criteres validation** :
- V1 (P0) : 3 types declares en enum
- V2 (P0) : `create()` INSERT row + audit log
- V3 (P0) : `validate()` retourne allowed=true si actif
- V4 (P0) : `validate()` rejette si revoked_at set
- V5 (P0) : `validate()` rejette si expires_at passe
- V6 (P0) : `revoke()` set revoked_at + reason
- V7 (P0) : `listForTenant` retourne authz from + to ce tenant
- V8 (P0) : Scope check : action hors scope rejetee
- V9 (P0) : Audit log create + revoke
- V10 (P1) : Tests 10+ scenarios

---

## Tache 2.2.7 -- TenantManagementService + Endpoints CRUD

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 6h / Depend de 2.2.6

**But** : Service + endpoints `/api/v1/admin/tenants/*` (super admin uniquement) pour CRUD tenants.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/tenant/services/tenant-management.service.ts`
- [ ] Methods : `create(dto)`, `findById(id)`, `findAll(filters, pagination)`, `update(id, dto)`, `softDelete(id, reason)`
- [ ] Controller `repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts`
- [ ] Endpoints (tous super admin only) :
  - `POST /api/v1/admin/tenants` -- create tenant
  - `GET /api/v1/admin/tenants` -- list with filters (type, status, created_after, search)
  - `GET /api/v1/admin/tenants/:id` -- get tenant details
  - `PATCH /api/v1/admin/tenants/:id` -- update (name, settings, status)
  - `DELETE /api/v1/admin/tenants/:id` -- soft delete (Tache 2.2.9 suspension utilise different)
  - `GET /api/v1/admin/tenants/:id/users` -- list users du tenant
  - `GET /api/v1/admin/tenants/:id/stats` -- stats (users count, polices count, transactions volume)
- [ ] Schemas Zod : `CreateTenantSchema`, `UpdateTenantSchema`, `TenantFiltersSchema`
- [ ] Pagination : page + pageSize (default 25, max 100)
- [ ] Tri : created_at DESC default, configurable
- [ ] Cache invalidation : update tenant -> publish event Kafka -> TenantValidationService cache evict
- [ ] Audit log : tous CUD operations
- [ ] Events Kafka : `tenant_created`, `tenant_updated`, `tenant_settings_changed`, `tenant_deleted`
- [ ] Tests E2E : super admin CRUD full, non-super admin reject 403

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/tenant/services/tenant-management.service.ts                  # ~220 lignes
repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts                  # ~150 lignes
repo/apps/api/src/modules/admin/dto/tenant.dto.ts                                         # using createZodDto
repo/apps/api/test/admin-tenants.e2e-spec.ts                                              # tests E2E
```

**Notes implementation** :
- Toutes routes admin require SuperAdminGuard (Tache 2.2.10) -- sinon 403
- Soft delete vs hard delete : soft (deleted_at set) preserve audit, hard delete via procedure CNDP (Tache 2.2.12)
- Pagination cursor-based pour > 1000 tenants prod (Phase 7+)
- Search : ILIKE `%name%` + ICE + email contact principal (full-text trigram Sprint 2 helps)
- Stats : query agregatte (count from users, polices, transactions WHERE tenant_id = :id)
- CreateTenantSchema validations : name unique, type valid (broker/garage/mixed), ICE format, etc.

**Criteres validation** :
- V1 (P0) : POST /admin/tenants cree tenant avec super admin token
- V2 (P0) : POST /admin/tenants sans super admin -> 403
- V3 (P0) : GET liste retourne pagination
- V4 (P0) : PATCH update + cache invalide
- V5 (P0) : DELETE soft delete (deleted_at set)
- V6 (P0) : GET /:id/users retourne users du tenant
- V7 (P0) : GET /:id/stats retourne stats correctes
- V8 (P0) : Filtres marchent (type, status, search)
- V9 (P0) : Audit log + Kafka events
- V10 (P1) : Tests E2E 10+ scenarios

---

## Tache 2.2.8 -- TenantOnboardingService : Workflow Creation Cabinet/Garage

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 5h / Depend de 2.2.7

**But** : Workflow complete creation tenant + super_admin tenant : creer auth_tenants row + creer auth_users super admin + assigner role + envoyer email invitation + setup tenant settings defaults.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts`
- [ ] Method `onboard(dto: OnboardTenantDto): Promise<OnboardResult>` :
  1. Creer tenant (status='pending_setup')
  2. Creer super_admin user (broker_admin OU garage_admin selon type) avec password temporaire random
  3. INSERT auth_tenant_users assignement role
  4. Setup tenant settings defaults (locale fr, timezone Africa/Casablanca, currency MAD, branding default)
  5. Generate invitation token (24h)
  6. Envoyer email invitation au super admin avec lien `/auth/setup-account?token=xxx`
  7. Audit log + Kafka event `tenant.onboarded`
- [ ] Endpoint `POST /api/v1/admin/tenants/onboard` (super admin) -- alternative a POST /tenants direct
- [ ] Endpoint `POST /api/v1/auth/setup-account` (public, token required) -- super admin tenant fixe son password + active compte + tenant status='active'
- [ ] Schema Zod `OnboardTenantSchema` : tenant_name, tenant_type, ice (optionnel mais recommande), super_admin_email, super_admin_display_name
- [ ] Tenant settings defaults stockes en `auth_tenants.settings jsonb`
- [ ] Email template invitation avec branding Skalean + lien activation
- [ ] Tests E2E full flow : onboard -> email recu -> setup account -> tenant active

**Tenant settings defaults schema** :

```typescript
{
  locale: 'fr',
  timezone: 'Africa/Casablanca',
  currency: 'MAD',
  branding: {
    primary_color: '#E95D2C',  // Sofidemy orange
    logo_url: null,
  },
  features: {
    mfa_required_for_admin: true,
    sinistre_auto_assign: false,  // Sprint 22+
  },
  quotas: {
    max_users: 10,
    max_polices: 1000,
    max_storage_gb: 50,
  },
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts                # ~200 lignes
repo/apps/api/src/modules/auth/auth.controller.ts                                       # update : /setup-account endpoint
repo/apps/api/src/modules/auth/auth.service.ts                                          # update : setupAccount method
repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-invitation.hbs                    # 3 templates
```

**Notes implementation** :
- Onboarding atomique : transaction unique (tenant + user + assignement + token)
- Password temporaire : random 32 bytes -- jamais stocke en plain, juste hash + envoye par email
- Setup-account endpoint : valide token + set new password (policy enforced) + active user.email_verified_at
- Tenant status 'pending_setup' bloque API access tant que super admin pas active
- Settings defaults : structure stable, customizable via TenantManagement (Tache 2.2.7)
- Quotas defaults : depend du tier (Phase 7+ pricing). MVP : tier unique 10 users / 1000 polices

**Criteres validation** :
- V1 (P0) : POST /onboard cree tenant + super admin user
- V2 (P0) : Email invitation envoye
- V3 (P0) : Tenant status 'pending_setup' initialement
- V4 (P0) : POST /setup-account avec token valide active tenant
- V5 (P0) : Apres setup-account : tenant status 'active'
- V6 (P0) : Tenant settings defaults appliques
- V7 (P0) : Audit log + Kafka events
- V8 (P0) : Token expire (>24h) rejete
- V9 (P1) : Tests E2E full flow passent

---

## Tache 2.2.9 -- TenantSuspensionService : Suspend/Reactivate

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 4h / Depend de 2.2.8

**But** : Service pour suspendre/reactiver un tenant (e.g. defaut paiement) -- bloque API access mais preserve data.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/tenant/services/tenant-suspension.service.ts`
- [ ] Method `suspend(tenantId, reason, suspendedBy): Promise<void>` :
  1. Update tenant.status = 'suspended'
  2. Revoke ALL sessions des users du tenant (force logout)
  3. Audit log + Kafka event
  4. Email notification au super admin tenant
- [ ] Method `reactivate(tenantId, reactivatedBy): Promise<void>` :
  1. Update tenant.status = 'active'
  2. Audit log + Kafka event
  3. Email notification au super admin tenant
- [ ] Method `archive(tenantId, archivedBy): Promise<void>` -- terminal status, prepare purge
- [ ] Endpoints (super admin) :
  - `POST /api/v1/admin/tenants/:id/suspend` (body: reason)
  - `POST /api/v1/admin/tenants/:id/reactivate`
  - `POST /api/v1/admin/tenants/:id/archive`
- [ ] Cache invalidation : event Kafka -> TenantValidationService cache evict
- [ ] Tenant suspendu : middleware bloque toute requete API (sauf super admin) -- cf. Tache 2.2.5 `isTenantActive`
- [ ] Tests : suspend bloque login, reactivate restore acces, archive terminal

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/tenant/services/tenant-suspension.service.ts                 # ~150 lignes
repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts                # update : 3 endpoints
repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-suspended.hbs                     # 3 templates
```

**Notes implementation** :
- Suspend : data preservee (read-only par super admin), audit log + email notification user
- Archive : prepare purge data (loi 09-08 droit oubli) -- procedure separee Tache 2.2.12
- Revoke sessions : force re-login avec error tenant suspendu
- Reason mandatory : tracability (defaut paiement, fraude, fin contrat, etc.)
- Suspension reactivate : preserve users + data, just unlock access

**Criteres validation** :
- V1 (P0) : suspend() set status + revoke sessions
- V2 (P0) : User suspended tenant : login retourne 403 TENANT_SUSPENDED
- V3 (P0) : Super admin peut acceder tenant suspendu (admin routes)
- V4 (P0) : reactivate() set active + login OK
- V5 (P0) : archive() set terminal status
- V6 (P0) : Email notification envoye
- V7 (P0) : Audit log + Kafka events
- V8 (P1) : Tests E2E 5+ scenarios

---

## Tache 2.2.10 -- SuperAdminGuard + Endpoints /api/v1/admin/*

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 4h / Depend de 2.2.9

**But** : Guard NestJS qui verifie role super_admin_platform OR analyst_support sur toutes routes `/api/v1/admin/*`.

**Livrables checkables** :
- [ ] Guard `repo/apps/api/src/common/guards/super-admin.guard.ts`
- [ ] `canActivate()` :
  - Skip si `@Public()` decorator
  - Verifie user authentifie (depend JwtAuthGuard Sprint 5)
  - Verifie user.role IN ('super_admin_platform', 'analyst_support')
  - Si pas super admin -> 403 SUPER_ADMIN_REQUIRED
  - Set context.isSuperAdmin = true (deja Tache 2.2.2 path-based)
- [ ] Decorator `@AdminRole(roles: AuthRole[])` -- override quels roles admin acceptes (default super_admin)
- [ ] Decorator `@AnalystAllowed()` -- analyst_support peut acceder cette route (read-only)
- [ ] Decorator `@SuperAdminOnly()` -- uniquement super_admin_platform (write operations)
- [ ] Apply guard sur AdminController + tous descendants `/api/v1/admin/*`
- [ ] Audit log : tous acces admin loggues (audit_log avec resource_type='admin_access')
- [ ] Tests : super_admin OK, analyst_support OK lecture, broker_admin reject 403

**Fichiers crees / modifies** :
```
repo/apps/api/src/common/guards/super-admin.guard.ts                       # ~80 lignes
repo/apps/api/src/common/decorators/admin-role.decorator.ts                 # ~10 lignes
repo/apps/api/src/common/decorators/analyst-allowed.decorator.ts            # ~5 lignes
repo/apps/api/src/common/decorators/super-admin-only.decorator.ts           # ~5 lignes
repo/apps/api/src/modules/admin/admin.module.ts                              # apply guard
```

**Notes implementation** :
- analyst_support role : read-only sur /admin/* (pour support client) -- write rejete
- super_admin_platform : full access /admin/* (humains Skalean operations + DevOps)
- Guard execute APRES JwtAuthGuard -- so user is already authenticated
- Decorator `@SuperAdminOnly()` differe `@AnalystAllowed()` : write vs read
- Audit log critical : tous accesses admin tracees (compliance requirement)

**Criteres validation** :
- V1 (P0) : super_admin_platform peut acceder /admin/*
- V2 (P0) : analyst_support peut acceder /admin/* (read-only)
- V3 (P0) : analyst_support tente write -> 403
- V4 (P0) : broker_admin (non-super admin) rejete 403
- V5 (P0) : Sans auth -> 401 (JwtAuthGuard avant)
- V6 (P0) : Audit log emit pour chaque admin access
- V7 (P0) : `@SuperAdminOnly()` decorator force super_admin (rejette analyst)
- V8 (P1) : Tests 8+ scenarios

---

## Tache 2.2.11 -- ResourceQuotaService : Quotas Par Tenant + Enforcement

**Metadonnees** : Phase 2 / Sprint 6 / P1 / 5h / Depend de 2.2.10

**But** : Enforcement quotas tenant : max users, max polices, max storage GB. Empeche depassement avec audit + email notification.

**Livrables checkables** :
- [ ] Service `repo/apps/api/src/modules/tenant/services/resource-quota.service.ts`
- [ ] Methods :
  - `getQuotas(tenantId): Promise<TenantQuotas>` -- depuis settings
  - `getCurrentUsage(tenantId): Promise<TenantUsage>` -- count users, polices, storage GB
  - `canAddUser(tenantId): Promise<{ allowed: boolean, current, limit }>`
  - `canAddPolice(tenantId): Promise<...>`
  - `canUploadDocument(tenantId, sizeBytes): Promise<...>`
  - `enforceUserAdd(tenantId): Promise<void>` -- throws QuotaExceededException si depasse
  - `enforcePoliceAdd(tenantId): Promise<void>`
- [ ] Quotas defaults Sprint 6 (1 tier MVP) : 10 users, 1000 polices, 50 GB storage
- [ ] Cache usage Redis 1min (eviter recompute a chaque request)
- [ ] Soft warning : 80% quota -> email notification super admin
- [ ] Hard limit : 100% quota -> rejette avec QuotaExceededException
- [ ] Quotas configurable via TenantManagement (Tache 2.2.7) per tenant
- [ ] Audit log + Kafka events sur quota hit (warning + hard limit)
- [ ] Tests : enforce works, soft warning email envoye 80%, hard limit reject 100%

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/tenant/services/resource-quota.service.ts                  # ~180 lignes
repo/apps/api/src/modules/tenant/services/resource-quota.service.spec.ts             # ~150 lignes
repo/apps/api/src/common/errors/quota-exceeded.error.ts                                # ~20 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/quota-warning.hbs                       # 3 templates
```

**Notes implementation** :
- Cache usage Redis 1min : balance temps reel vs perf (eviter COUNT queries DB chaque request)
- Soft warning 80% : email notification (un fois, pas spam) -- flag dans tenant.settings.warnings_sent
- Hard limit 100% : rejette avec QuotaExceededException + suggest upgrade
- Phase 7+ : multi-tier pricing (10 / 100 / 1000 users selon plan)
- Storage GB : sum size_bytes from doc_documents pour ce tenant
- Polices count : count auth_polices Sprint 14 (anticipation)

**Criteres validation** :
- V1 (P1) : `getCurrentUsage` retourne counts corrects
- V2 (P1) : `canAddUser` retourne allowed=true si <limit, false sinon
- V3 (P1) : `enforceUserAdd` throws QuotaExceededException si limit
- V4 (P1) : Soft warning email envoye 80% quota (one-time)
- V5 (P1) : Hard limit retourne erreur claire (avec quota courant + max)
- V6 (P1) : Cache Redis 1min actif
- V7 (P1) : Tests 8+ scenarios

---

## Tache 2.2.12 -- Tests RLS Isolation EXHAUSTIFS + Procedure Purge CNDP Loi 09-08

**Metadonnees** : Phase 2 / Sprint 6 / P0 / 9h / Depend de 2.2.11

**But** : Suite tests integration EXHAUSTIVE validant 0 leak cross-tenant possible + procedure purge tenant data conforme loi 09-08 droit oubli.

**Livrables checkables** :

**Tests RLS isolation (12 tests)** :
- [ ] Test 1 : `rls-isolation-basic.spec.ts` -- INSERT contact tenant A, SELECT tenant B retourne 0
- [ ] Test 2 : `rls-isolation-update.spec.ts` -- UPDATE contact tenant A depuis tenant B retourne 0 affected rows
- [ ] Test 3 : `rls-isolation-delete.spec.ts` -- DELETE retourne 0 affected
- [ ] Test 4 : `rls-super-admin-bypass.spec.ts` -- super admin SELECT cross-tenant OK
- [ ] Test 5 : `rls-super-admin-write.spec.ts` -- super admin INSERT/UPDATE/DELETE cross-tenant OK
- [ ] Test 6 : `rls-l3-assure.spec.ts` -- assure SELECT autres assures meme tenant retourne 0 (filter L3)
- [ ] Test 7 : `rls-cross-tenant-auth.spec.ts` -- avec authorization active : SELECT cross-tenant scope-limited OK
- [ ] Test 8 : `rls-cross-tenant-revoked.spec.ts` -- authorization revoked : SELECT rejected
- [ ] Test 9 : `rls-cross-tenant-expired.spec.ts` -- authorization expired : SELECT rejected
- [ ] Test 10 : `rls-32-tables-coverage.spec.ts` -- iterate sur 32 tables PARTIE1, verifier RLS active sur chacune
- [ ] Test 11 : `rls-suspended-tenant.spec.ts` -- tenant suspended : login rejected
- [ ] Test 12 : `rls-no-context-rejected.spec.ts` -- pas de tenant context : INSERT echoue (TenantIdInjector subscriber)

**Procedure purge CNDP (3 livrables)** :
- [ ] Script `repo/infrastructure/scripts/data-purge-tenant.ts` :
  - Input : tenant_id + dry-run flag
  - Phase 1 (anonymize PII) : update auth_users (email -> anonymized@purged.local, display_name -> 'Anonymized User N'), update crm_contacts (anonymize cin, phone, email, full_name)
  - Phase 2 (delete data) : DELETE comm_messages, comm_optouts (TTL 7 ans depasse)
  - Phase 3 (preserve audit) : audit_log preserve INDEFINIMENT (legal requirement) -- jamais delete
  - Phase 4 (mark tenant) : set tenant.archived_at + tenant.purged_at
- [ ] Endpoint `POST /api/v1/admin/tenants/:id/purge` (super admin only) :
  - Confirmation token required (envoye par email + saisi)
  - Background job (BullMQ) : execute purge async (peut prendre 1h+ sur gros tenants)
  - Audit log + Kafka event `compliance.data_purged`
- [ ] Documentation `repo/docs/runbooks/cndp-purge-procedure.md` :
  - Trigger : demande user "right to be forgotten" loi 09-08 OU tenant archive 5 ans
  - Process : checklist humaine + script automatise
  - Verification post-purge : queries verify pas de PII

**Fichiers crees / modifies** :
```
repo/apps/api/test/integration/rls-isolation/{12 specs}.ts                            # ~100 lignes chacun
repo/apps/api/test/integration/rls-isolation/setup.ts                                  # helpers
repo/infrastructure/scripts/data-purge-tenant.ts                                       # ~250 lignes
repo/apps/api/src/modules/admin/controllers/admin-tenants.controller.ts                # update : /purge endpoint
repo/docs/runbooks/cndp-purge-procedure.md                                              # ~100 lignes
```

**Notes implementation** :
- Tests RLS exhaustifs : iterate 32 tables, verifier chacune a `relrowsecurity = true` + 4 policies (SELECT/INSERT/UPDATE/DELETE)
- Setup test : creer 2 tenants A et B, 1 user dans chacun, set context A, tenter access B
- Purge phase 1 (anonymize) plutot que DELETE : preserve referential integrity (FK)
- Audit log preserve INDEFINIMENT : compliance ACAPS + loi 09-08 (audit log fait partie traces, pas data perso a effacer)
- Endpoint /purge background job : evite timeout HTTP sur gros tenants
- Confirmation token : prevent erreur humaine (super admin rate limited + double-confirm)
- Verification post-purge : SQL queries `SELECT email FROM auth_users WHERE tenant_id = X AND email NOT LIKE '%@purged.local'` -> 0 rows

**Criteres validation** :
- V1 (P0) : 12 tests RLS isolation passent
- V2 (P0) : Test couvre les 32 tables PARTIE1
- V3 (P0) : Tests reproduisent zero leak cross-tenant
- V4 (P0) : Tests super admin bypass OK
- V5 (P0) : Tests L3 assure filter actif
- V6 (P0) : Tests cross-tenant auth (granted, revoked, expired)
- V7 (P0) : Tests tenant suspended bloque
- V8 (P0) : Script purge anonymize PII (test sur tenant test)
- V9 (P0) : Script purge preserve audit_log
- V10 (P0) : Endpoint /purge fonctionne (dry-run + execute)
- V11 (P0) : Documentation procedure purge claire
- V12 (P0) : Tous tests passent CI

---

## Sortie du Sprint 6

A la fin de l'execution des 12 taches :

```
Multi-tenant runtime fully operational :
  - TenantContextService AsyncLocalStorage propagation
  - TenantContextMiddleware lit x-tenant-id + valide
  - TenantTransactionInterceptor SET LOCAL Postgres automatique
  - 3 niveaux operationnels :
    * Platform : super_admin_platform via /admin/* (bypass RLS)
    * Customer Tenant : x-tenant-id header mandatory
    * L3 Assure : routes /assure/* avec assureUserId filter

Cross-tenant authorizations (3 types v2.0) infrastructure ready (Sprint 26 implemente runtime)

Tenant lifecycle :
  - CRUD via /api/v1/admin/tenants/*
  - Onboarding workflow complete
  - Suspension/reactivation
  - Archive + procedure purge CNDP

Quotas par tenant :
  - 10 users / 1000 polices / 50 GB defaut
  - Soft warning 80% + hard limit 100%

Tests RLS exhaustifs : 12 tests integration confirment 0 leak cross-tenant
```

**Sprint 7 demarre avec** :
- Multi-tenant runtime operational
- Roles enum disponible (Sprint 5) + role per tenant (auth_tenant_users) connu
- RBAC Sprint 7 enrichira avec 85+ permissions granulaires

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-2.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-06-multi-tenant/`.

**Patterns code inline conserves** : TenantContext interface complete, tenantContextStorage AsyncLocalStorage, middleware logic complete avec validation, interceptor SET LOCAL transaction, table cross_tenant_authorizations, tenant settings defaults schema.

**Reference** : `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` couvre les 3 niveaux + 12 roles + cas d'acces. `00-pilotage/documentation/4-templates-generation.md` Pattern R1 (multi-tenant transverse).

---

**Fin du meta-prompt B-06 v2.2 format Option B.**
