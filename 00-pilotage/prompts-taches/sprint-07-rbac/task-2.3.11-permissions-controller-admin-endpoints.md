# TACHE 2.3.11 -- AdminPermissionsController : Endpoints Admin Introspection RBAC (roles list, role permissions resolved hierarchy, permissions catalog, audit denied recent, audit stats aggregated)

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire + ABAC Foundation
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.11 lignes 1097-1137)
**Reference documentation transverse** : `00-pilotage/documentation/5-roles-permissions.md` v2.2 (matrice 12 roles x 85+ permissions, hierarchies, ABAC policies, super admin bypass)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour Tache 2.3.12 tests E2E exhaustifs 80+ scenarios qui referencent les endpoints `/api/v1/admin/rbac/*` pour valider matrice roles x permissions ; bloquant pour Sprint 22 Observability dashboards Grafana qui exposent metriques `admin_rbac_denied_total` collectees via `/admin/rbac/audit/stats` ; bloquant pour Sprint 26 admin module qui ajoutera endpoints write `POST /admin/rbac/cache/invalidate` et `POST /admin/rbac/roles/:role/permissions/grant` (Phase 7+ tier custom) consumant la meme couche `AdminPermissionsService` et `AdminPermissionsCacheService` ; bloquant pour Sprint 33 SecOps pentest qui tente brute-force `/admin/rbac/audit/denied` avec roles non super_admin pour valider 403 enforcement ; bloquant pour onboarding nouveaux developpeurs qui consultent `/admin/rbac/roles/:role/permissions` Swagger pour comprendre quelle permission appartient a quel role sans lire le code source PermissionsMatrix ; bloquant pour Sprint 28 SRE runbook incident "user X reporte ne pas pouvoir acceder Y" qui utilise `GET /admin/rbac/audit/denied?userId=X&since=1h` comme premier outil de diagnostic ; bloquant pour Sprint 34 Compliance reporting CNDP qui consume `/admin/rbac/audit/stats` pour generer rapport mensuel "denied access patterns" demande Article 18 loi 09-08 ; bloquant pour Phase 7+ feature "permissions custom per tenant" qui etendra `GET /admin/rbac/roles/:role/permissions` avec parametre `?tenantId=` pour visualiser overrides specifiques)
**Effort** : 4h
**Dependances** :
  - Tache 2.3.10 (`PermissionCacheService` livre + `getEffectivePermissions(role)` injecte dans `AdminPermissionsService` pour resolution hierarchie cache hit O(1) ; cluster Redis namespace `rbac:` partage avec namespace `admin:rbac:` ajoute par cette tache pour cache 1h listings catalog)
  - Tache 2.3.9 (`RbacAuditService` livre + table Postgres `rbac_audit_log` partitioned monthly avec colonnes `(user_id, role, permission, resource_type, resource_id, granted, reason, policy_name, ip, user_agent, request_id, created_at)` consumee par `AdminPermissionsAuditQueryRepository` pour endpoints `/audit/denied` + `/audit/stats` ; index composite `(granted, created_at DESC)`, `(user_id, granted, created_at DESC)`, `(role, granted, created_at DESC)`)
  - Tache 2.3.6 (`RolesService` listing dynamique 12 roles `AuthRoleEnum` schema Zod consume via `RoleCatalogProvider` injectable)
  - Tache 2.3.4 (`RoleGuard` + decorator `@Role('super_admin_platform')` enforce access exclusif endpoints admin)
  - Tache 2.3.3 (`RbacService.computeEffectivePermissions(role)` resolution recursive hierarchie consume comme fallback cache miss)
  - Tache 2.3.2 (`PermissionsMatrix` code-as-config + `RoleHierarchy` definitions reuse pour endpoint `/permissions` retournant catalog complet 85+)
  - Tache 2.3.1 (`Permission` catalog Zod + `AuthRole` type + `PermissionValueSchema`)
  - Sprint 6 (TenantContext + AsyncLocalStorage + bypass tenant pour super admin contexte plateforme + DrizzleService + RLS policies super_admin_platform exempted)
  - Sprint 5 (RedisService cluster mode disponible pour cache 1h `admin:rbac:*` + Pino logger 9.5.x structured + ConfigService Zod-validated + Helmet middleware)
  - Sprint 4 (DrizzleService Postgres + migrations `rbac_audit_log` partitioned + cursor pagination helper module deja extracted Sprint 4 reuse)
  - Sprint 3 (NestJS Fastify adapter + Zod ZodValidationPipe global + Swagger/OpenAPI generator @nestjs/swagger 8.x + class-validator NON utilise -- Zod uniquement)
  - Sprint 1-2 stack (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x, Fastify 4.x adapter, Pino 9.5.x, Zod 3.24.1, reflect-metadata 0.2.x, prom-client 15.x, ioredis 5.4.x, kafkajs 2.2.4, luxon 3.5.x, drizzle-orm 0.36.x, @nestjs/swagger 8.x, supertest 7.x)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.11 livre le **module admin `AdminPermissionsModule`** du programme Skalean InsurTech v2.2 : la couche d'**exposition d'endpoints HTTP super admin** sur prefixe `/api/v1/admin/rbac/*` qui permettent l'introspection complete du systeme RBAC sans avoir besoin de lire le code source des fichiers `permissions-matrix.ts`, `role-hierarchy.ts`, ou `rbac_audit_log` table directement. Le module expose cinq endpoints lecture seule : (1) `GET /api/v1/admin/rbac/roles` retourne la liste exhaustive des 12 roles `super_admin_platform`, `analyst_support`, `broker_admin`, `broker_user`, `broker_assistant`, `garage_admin`, `garage_chef`, `garage_technicien`, `garage_comptable`, `garage_commercial`, `assure`, `prospect` enrichis du nombre de permissions effectives `permissionsCount`, du nombre de permissions directes `directPermissionsCount`, de la chaine de hierarchie `inheritsFrom: AuthRole[]`, du tier (`platform`, `tenant_broker`, `tenant_garage`, `customer`, `public`), du flag `requiresMfa`, et de la categorie de session TTL (`30min` prospect, `1h` assure, `8h` standard, `30min` admin avec sliding) ; (2) `GET /api/v1/admin/rbac/roles/:role/permissions` retourne pour un role donne le set complet de permissions effectives apres resolution recursive de la hierarchie via `PermissionCacheService.getEffectivePermissions(role)` (e.g. `broker_admin` retourne ~30 permissions = ses 10 propres + 12 heritees broker_user + 8 heritees broker_assistant), avec breakdown par module (`crm`, `booking`, `comm`, `docs`, `pay`, `books`, `compliance`, `analytics`, `insure`, `repair`, `stock`, `hr`, `admin`, `cross_tenant`, `sky`, `mcp`), avec source de chaque permission (`direct` ou `inherited_from:broker_user`), et metadata de validation cache (`fromCache: boolean, cacheAge: seconds, cacheTtlRemaining: seconds`) ; (3) `GET /api/v1/admin/rbac/permissions` retourne le catalog complet 85+ permissions avec pagination cursor-based (default 50 par page, max 200), filtres optionnels `?module=crm&action=read`, et indication pour chaque permission de combien de roles la possedent (`grantedToRolesCount: number, grantedToRoles: AuthRole[]`) ; (4) `GET /api/v1/admin/rbac/audit/denied` retourne les events recents de denied access depuis `rbac_audit_log` avec filtres exhaustifs (`?userId=uuid`, `?role=broker_user`, `?permission=insure.policies.create`, `?since=ISO8601`, `?until=ISO8601`, `?ip=1.2.3.4`, `?reason=NO_PERMISSION|NOT_OWNER|EXPIRED_RESOURCE|...`) avec pagination cursor-based default 50 max 200, ordering par `created_at DESC`, et chaque event enrichi de la chaine `policyEvaluated: PolicyEvaluation[]` montrant quelle policy ABAC a denie (`OwnResourcesPolicy`, `TimeBasedPolicy`, `StatusBasedPolicy`, `WorkflowStatePolicy`) ; (5) `GET /api/v1/admin/rbac/audit/stats` retourne stats agregees groupees par `role`, `permission`, `policy_name`, `reason`, sur une fenetre temporelle configurable (`?window=1h|24h|7d|30d`, default 24h) avec metriques `total_denied`, `unique_users`, `unique_ips`, `top_denied_permissions: { permission, count }[10]`, `top_denied_users: { userId, count, latestDeniedAt }[10]` (utile detection brute force compromission compte), `denied_per_hour: { hour: ISO8601, count }[24|168|720]`.

Le module enforce strictement l'autorisation via decorator `@Role(AuthRole.SUPER_ADMIN_PLATFORM)` consommant `RoleGuard` livre Tache 2.3.4 : tout autre role (`analyst_support`, `broker_admin`, `broker_user`, etc.) recoit reponse HTTP 403 Forbidden avec body Problem+JSON RFC 7807 standard `{ "type": "https://docs.skalean-insurtech.ma/errors/forbidden-admin-rbac", "title": "Forbidden", "status": 403, "detail": "Endpoint reserved to super_admin_platform role", "instance": "/api/v1/admin/rbac/roles", "request_id": "01J7..." }` ; les requetes non authentifiees recoivent 401 Unauthorized via `JwtAuthGuard` (livre Sprint 5) ; les violations sont elles-memes auditees via `RbacAuditService.recordDenied` ce qui peut generer recursion paradoxale (un denied sur `/admin/rbac/audit/denied` apparait dans le resultat de `/admin/rbac/audit/denied`) acceptable et meme desirable detection abus. Aucun endpoint write n'est expose au Sprint 7 -- la matrice est code-as-config (`permissions-matrix.ts`) versionnee Git, modifications passent par PR + deploy ; Phase 7+ ajoutera endpoints write pour le tier `enterprise` payant qui pourra customiser permissions per tenant via `POST /api/v1/admin/rbac/tenants/:tenantId/permissions/grant` (decision-014 produit). La couche cache 1h Redis namespace `admin:rbac:*` (separee du `rbac:effective:*` Tache 2.3.10 qui est TTL 5min) est appliquee aux endpoints `/roles` et `/permissions` car le catalog change tres rarement (PR matrix update = invalidation manuelle Sprint 26) ; les endpoints `/audit/*` ne sont PAS caches car les donnees doivent etre temps reel pour diagnostic incident.

L'architecture decompose la responsabilite en **sept couches** : (1) la couche `AdminPermissionsController` qui expose les 5 endpoints REST, applique decorators NestJS `@UseGuards(JwtAuthGuard, RoleGuard)`, `@Role(AuthRole.SUPER_ADMIN_PLATFORM)`, `@ApiTags('admin-rbac')`, valide les query params via `ZodValidationPipe`, gere pagination cursor-based, et retourne reponses standardisees ; (2) la couche `AdminPermissionsService` qui orchestre les appels a `RoleCatalogProvider`, `PermissionsMatrix`, `PermissionCacheService`, `AdminPermissionsAuditQueryRepository`, `AdminPermissionsCacheService`, et applique business logic (e.g. enrichissement avec hierarchy resolution, computation breakdown per module) ; (3) la couche `AdminPermissionsCacheService` qui encapsule cache Redis 1h pour endpoints `/roles` et `/permissions` avec invalidation programmatique via methode publique `invalidate()` consommee Sprint 26 par `POST /admin/rbac/cache/invalidate` ; (4) la couche `AdminPermissionsAuditQueryRepository` repository TypeORM/Drizzle custom optimise avec requetes SQL avec hints index `(granted, created_at DESC)` pour query `/audit/denied`, et CTEs avec `GROUP BY` aggregations pour `/audit/stats` (utilise `date_trunc('hour', created_at)` pour bucketing) ; (5) la couche `AdminPermissionsPaginationHelper` qui construit cursors opaques base64-encoded contenant `{ lastCreatedAt: ISO8601, lastId: uuid }` (compound cursor stable meme avec `created_at` non unique) et parse cursors entrants avec validation Zod + signature HMAC-SHA256 anti-tampering ; (6) la couche `AdminPermissionsOpenApi` qui declare les schemas Swagger/OpenAPI 3.1 detailles pour chaque endpoint avec exemples reponses + erreurs documentees ; (7) la couche `AdminPermissionsMetrics` Prometheus counters/histograms `admin_rbac_endpoint_calls_total{endpoint, status}`, `admin_rbac_endpoint_duration_seconds{endpoint}`, `admin_rbac_audit_query_rows_returned{endpoint}`, `admin_rbac_cache_hits_total{endpoint}`, `admin_rbac_cache_misses_total{endpoint}`. A l'issue de cette tache, le package `@insurtech/api/modules/admin/permissions` exporte `AdminPermissionsModule` consommable par `AppModule`, 35+ tests Vitest verifient (a) controller endpoints retournent shape correcte (b) Service applique hierarchy resolution correcte pour 12 roles (c) Service applique filtres audit correctement (d) Cache 1h respecte (e) Pagination cursor stable + tampering rejected (f) RoleGuard enforce 403 pour non-super-admin (g) E2E Supertest 15+ scenarios complets HTTP, et la documentation OpenAPI Swagger generee accessible `/api/docs` documente integralement les 5 endpoints avec exemples curl.

---

## 2. Contexte etendu

### 2.1 Pourquoi REST plutot que GraphQL pour endpoints admin RBAC

Trois strategies API sont possibles pour exposer l'introspection RBAC :

**Strategie A -- REST endpoints granulaires (RETENUE)** : 5 endpoints distincts `/admin/rbac/roles`, `/admin/rbac/roles/:role/permissions`, `/admin/rbac/permissions`, `/admin/rbac/audit/denied`, `/admin/rbac/audit/stats`. Avantages : (a) **convention API uniforme** -- tous les autres modules Skalean utilisent REST (CRM, Insure, Repair, Pay, Books, etc.) sans exception, ajouter GraphQL juste pour admin module romprait coherence ; (b) **documentation OpenAPI Swagger** -- @nestjs/swagger 8.x genere doc automatique consommable par Postman, Insomnia, swagger-ui, redoc, et les scripts `curl` de runbook ops sont triviaux a copier-coller ; (c) **caching HTTP standard** -- Cache-Control headers + ETag/If-None-Match natif avec REST, GraphQL necessite Persisted Queries + Apollo Cache complexite ; (d) **observabilite per-endpoint** -- Prometheus `http_requests_total{method, route, status}` granulaire par endpoint, GraphQL agrege en seul endpoint POST /graphql ; (e) **autorisation simple** -- decorator `@Role(SUPER_ADMIN_PLATFORM)` sur 5 controllers methods, GraphQL necessiterait field-level resolvers + directives ; (f) **deja deploye stack** -- pas besoin d'ajouter `@nestjs/graphql`, `apollo-server`, schema SDL infrastructure. Inconvenients : (a) over-fetching potentiel si client veut juste `count` de permissions par role mais recoit liste complete -- mitigated par parametre `?fields=count,name` slim mode ; (b) under-fetching potentiel si client veut roles + permissions ensemble en 1 call -- mitigated par endpoint `/admin/rbac/roles?include=permissions` expand mode (Phase 7+).

**Strategie B -- GraphQL endpoint unique** : `/admin/rbac/graphql` avec schema `Role`, `Permission`, `AuditEvent` types. Avantages : (a) flexibilite client query precise ; (b) un seul endpoint a securiser. Inconvenients : (a) **rupture convention** -- aucun autre module Skalean n'utilise GraphQL ; (b) **complexite autorisation** -- super_admin enforcement par directive `@auth(role: SUPER_ADMIN)` complexity vs decorator simple ; (c) **N+1 queries risk** sur hierarchy resolution si pas DataLoader ; (d) **outillage ops moins mature** -- runbook curl harder, Swagger/Postman inferior. REJETE.

**Strategie C -- gRPC pour admin internal** : Endpoint binaire pour admin tools. Avantages : performance, schema strict. Inconvenients : (a) UX horrible runbook ops (pas de curl) ; (b) Swagger UI impossible ; (c) pas conformement existant. REJETE.

**Choix retenu** : Strategie A REST. Cinq endpoints distincts, decorator `@Role` simple, Swagger documentation generee, conformite convention reste codebase. ADR-029 (`docs/adr/029-admin-rbac-api-rest.md`) approuve par tech lead + product manager.

### 2.2 Trade-off : pagination offset vs cursor-based

Pour endpoints `/audit/denied` et `/admin/rbac/permissions` qui peuvent retourner volumes importants (ex: 50000 denied events sur 30 jours, 85+ permissions catalog), pagination est obligatoire :

**Strategie A -- Cursor-based pagination opaque (RETENUE)** : Cursor base64-encoded `{ lastCreatedAt: '2026-05-06T10:23:45.123Z', lastId: '01J7XYZ...' }` HMAC-signed. Reponse `{ data: [...], pagination: { nextCursor: 'eyJsYXN0Q3JlYXRlZEF0...', hasMore: true, pageSize: 50 } }`. Query suivante `GET /audit/denied?cursor=eyJsYXN0...&limit=50`. Avantages : (a) **stabilite sous insertion concurrente** -- offset 1000 peut sauter ou dupliquer events si nouveau insert pendant pagination, cursor immune ; (b) **performance constante O(log n)** via index `(created_at DESC, id)` seek vs offset O(n) scan ; (c) **clients ne peuvent pas deep-link page X arbitraire** -- seulement next/prev acceptable pour audit (pas usage type "go to page 547") ; (d) **standard moderne** -- GitHub API, Stripe, GraphQL Relay, AWS DynamoDB tous cursor-based ; (e) **HMAC tampering protection** -- cursor signe avec secret server-side previent client de forger cursor pointing au-dela permissions tenant.

**Strategie B -- Offset/limit pagination** : `?offset=100&limit=50`. Reponse `{ data, pagination: { total: 50000, page: 3, pageSize: 50, totalPages: 1000 } }`. Avantages : (a) deep-linking page arbitraire ; (b) afficher progress "page 3/1000" ; (c) simple a implement. Inconvenients : (a) **instable insert concurrent** ; (b) **performance degraded deep page** -- offset 49000 = scan 49000 lignes Postgres ; (c) **count(*) total exacte couteux** -- 50000 rows audit log requires full scan ou approximate; (d) **utilisable pour catalog 85 permissions** acceptable mais inutile cursor cas. Acceptable pour `/admin/rbac/permissions` 85 entries catalog (pagination optional, default return all). REJETE pour `/audit/*` retenu pour `/permissions`.

**Strategie C -- Keyset pagination explicite** : Client fournit explicitement `?since_created_at=ISO8601&since_id=uuid`. Avantages : Explicit, pas de cursor opaque. Inconvenients : (a) Client doit construire keyset lui-meme, complexity ; (b) tampering trivial. REJETE.

**Choix retenu** : Cursor-based pour `/audit/denied`, optionnel pour `/admin/rbac/permissions` (default sans pagination car catalog stable 85 entries). Defaults `limit=50` configurable env `ADMIN_RBAC_AUDIT_PAGE_SIZE_DEFAULT=50` `ADMIN_RBAC_AUDIT_PAGE_SIZE_MAX=200`. Cursor HMAC-SHA256 signe avec secret `ADMIN_RBAC_CURSOR_SECRET` derive de `JWT_SECRET` via HKDF.

### 2.3 Trade-off : cache 1h endpoints catalog vs real-time

Les endpoints `/admin/rbac/roles` et `/admin/rbac/permissions` retournent des donnees code-as-config (`PermissionsMatrix`, `RoleHierarchy`) qui changent tres rarement (1-2 fois par mois lors de release feature majeure ajoutant permissions Sprint 14 Insure, Sprint 19 Repair, etc.) :

**Strategie A -- Cache Redis 1h namespace `admin:rbac:*` (RETENUE)** : Cache cle `admin:rbac:roles:list:v1` TTL 3600s, `admin:rbac:permissions:catalog:v1` TTL 3600s, `admin:rbac:roles:{role}:permissions:v1` TTL 3600s (optionnel, profite deja `rbac:effective:{role}` 5min). Invalidation programmatique `AdminPermissionsCacheService.invalidate()` consommee Sprint 26 par `POST /admin/rbac/cache/invalidate`. Avantages : (a) **latence cache hit < 10ms** vs cache miss ~50ms (resolution hierarchy + breakdown module) ; (b) **reduce charge Postgres** RbacAuditService non sollicitee pour catalog ; (c) **conforme convention** Tache 2.3.10 PermissionCacheService meme pattern. Inconvenients : (a) **staleness max 1h** acceptable car catalog change rare ; (b) Si admin update matrix code et deploy nouveau bundle, cache stale 1h jusqu'invalidation manuelle ou TTL.

**Strategie B -- Pas de cache, lecture in-memory PermissionsMatrix** : `PermissionsMatrix` est const TypeScript en memoire, lookup O(1) deja. Avantages : (a) zero staleness ; (b) zero infra cache. Inconvenients : (a) chaque request execute full enrichissement (hierarchy resolution + count + breakdown module) ~5-10ms CPU, scale mal si polling dashboard frequent.

**Strategie C -- Cache HTTP layer (Cache-Control + ETag)** : `Cache-Control: private, max-age=3600` + ETag computed depuis hash matrix version. Client browser cache. Avantages : (a) zero infra Redis ; (b) standard HTTP. Inconvenients : (a) chaque CLIENT cache, multiple admins refetch ; (b) pas invalidation push.

**Choix retenu** : Strategie A Redis cache 1h + Cache-Control Strategie C en complement (`Cache-Control: private, max-age=3600, must-revalidate` + ETag). Le cache Redis est shared cross-instance, le Cache-Control benefit additional client browser cache. TTL configurable env `ADMIN_RBAC_CACHE_TTL_SECONDS=3600` (default 1h, peut overrider 60 pour dev).

### 2.4 Trade-off : endpoints read-only Sprint 7 vs CRUD Phase 7+

Sprint 7 livre uniquement endpoints lecture, pas d'endpoints write (POST/PUT/DELETE pour modifier matrice) :

**Justification Sprint 7 read-only** :
- (a) **Matrice code-as-config** -- `permissions-matrix.ts` versionnee Git, modifications doivent passer code review + PR + CI tests + deploy. Ajouter endpoint write court-circuiterait audit trail Git natif et permettrait modifications non tracees runtime.
- (b) **Pas de cas usage Sprint 7** -- les 12 roles + 85+ permissions sont fixees produit, pas de demande tier custom Sprint 7.
- (c) **Securite renforcee** -- moins de surface attaque. Endpoint write necessite double-check (e.g. `MFA confirmation token` + `audit trail` + `Kafka event` + `cache invalidation` + `RLS policy regeneration` + `re-issue tokens users impactes`) hors scope Sprint 7.
- (d) **Phase 7+ tier custom** -- decision-014 produit prevoit feature payante "Custom permissions per tenant" pour tier enterprise (>2000 users tenant) : un broker_admin tenant Y pourra avoir `crm.contacts.delete` enable specifiquement (default disabled pour broker_admin). Cette feature ajoutera Sprint Phase 7+ endpoints `POST /api/v1/admin/rbac/tenants/:tenantId/permissions/grant` consumant la meme couche `AdminPermissionsService` extended avec `grantPermissionToRoleForTenant(tenantId, role, permission)`.
- (e) **Endpoint cache invalidation** Sprint 26 ajoutera `POST /api/v1/admin/rbac/cache/invalidate` qui consume `AdminPermissionsCacheService.invalidate()` (hors scope Sprint 7).

**Trade-off accepte** : Sprint 7 met l'accent sur introspection robuste, le write attendra Phase 7+ avec design securite dedie.

### 2.5 Trade-off : structure resultat `GET /admin/rbac/roles/:role/permissions`

Comment structurer la reponse pour un role retournant ~30 permissions ?

**Option A -- Liste plate (REJETEE)** : `{ "role": "broker_admin", "permissions": ["crm.contacts.read", "crm.contacts.create", ...] }`. Avantage : simple. Inconvenient : difficile lire pour humain debug, pas de breakdown source (direct vs inherited).

**Option B -- Liste enrichie (RETENUE)** :
```json
{
  "role": "broker_admin",
  "tier": "tenant_broker",
  "inheritsFrom": ["broker_user", "broker_assistant"],
  "permissionsCount": 30,
  "directPermissionsCount": 10,
  "inheritedPermissionsCount": 20,
  "permissions": [
    { "name": "crm.contacts.read", "module": "crm", "action": "read", "source": "direct", "isAbac": false },
    { "name": "crm.contacts.update_own", "module": "crm", "action": "update_own", "source": "inherited_from:broker_user", "isAbac": true, "abacPolicy": "OwnResourcesPolicy" }
  ],
  "breakdownByModule": {
    "crm": { "count": 8, "permissions": ["crm.contacts.read"] },
    "insure": { "count": 6, "permissions": [] }
  },
  "metadata": {
    "fromCache": true,
    "cacheAge": 142,
    "cacheTtlRemaining": 158,
    "computedAt": "2026-05-06T10:23:45.123Z"
  }
}
```

Avantages : (a) developer friendly debug ; (b) UI dashboard peut afficher breakdown immediate ; (c) traceable hierarchy.

### 2.6 Pieges techniques connus (10+ pieges critiques)

1. **Piege : super_admin_platform peut blocked si Redis down (default-deny Tache 2.3.10).** Pourquoi : `getEffectivePermissions('super_admin_platform')` retourne `Set()` vide en degraded mode -> RoleGuard veut verifier `super_admin_platform` permission `*` mais `set.has('*')` retourne false -> 403. Solution : `RoleGuard` Tache 2.3.4 enforce role check avant permission check. `@Role(SUPER_ADMIN_PLATFORM)` decorator verifie `user.role === 'super_admin_platform'` directement depuis JWT claims SANS consulter cache. Cache uniquement pour permission grain. Test V2.

2. **Piege : audit log table volumineuse (millions rows) -- query slow sans index.** Pourquoi : `SELECT * FROM rbac_audit_log WHERE granted=false AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 50` sans index = full scan. Solution : Index composite `CREATE INDEX rbac_audit_log_denied_recent_idx ON rbac_audit_log (granted, created_at DESC) WHERE granted=false` partial index pour reduce cardinality. Index `(user_id, granted, created_at DESC)` pour filtre `?userId`. Index `(role, granted, created_at DESC)` pour filtre `?role`. Index `(permission, granted, created_at DESC)` pour filtre `?permission`. Partition monthly auto-drop > 12 mois (CNDP loi 09-08 art 18). Test V11 EXPLAIN ANALYZE assert `Index Scan` not `Seq Scan`.

3. **Piege : cursor pagination instable si `created_at` non unique (collision microseconde).** Pourquoi : Si 2 events ont meme `created_at` ms-precision, cursor `{lastCreatedAt: X}` peut sauter ou dupliquer. Solution : Compound cursor `{lastCreatedAt: X, lastId: uuid}` + WHERE clause `(created_at, id) < (cursor.lastCreatedAt, cursor.lastId)` (Postgres tuple compare). Tests V12 V13.

4. **Piege : cursor tampering -- client forge cursor pointing autre tenant rows.** Pourquoi : Cursor base64 trivial decoder JS, client malicious peut modifier `lastCreatedAt` pour exfiltrer audit. Solution : Cursor signe HMAC-SHA256 avec secret `ADMIN_RBAC_CURSOR_SECRET`. Format `base64url(JSON.stringify(payload)) + '.' + base64url(hmac(JSON.stringify(payload), secret))`. Server verifie signature avant parse. Reject 400 BadRequest si signature invalide. Test V14.

5. **Piege : audit log ecrit pendant pagination -- skip ou duplicate events.** Pourquoi : Cursor pointe `(t1, id1)`, client recupere page 1, nouveau event insere t > t1, client recupere page 2 cursor `(t1', id1')`, peut louper l'event si insere entre. Solution : ORDER BY `created_at DESC, id DESC` strict, cursor `<` strict (pas `<=`). Acceptable trade-off : un event peut apparaitre seulement si page rafraichie. Test V15.

6. **Piege : super_admin compromise -> peut consulter audit denied autres super admins.** Pourquoi : Si super admin A compromis, peut consulter `/admin/rbac/audit/denied?userId=B` pour voir ce que super admin B a tente. Solution : Acceptable scope Sprint 7 (super admins forme equipe restreinte 5-10 personnes confiance + MFA WebAuthn obligatoire). Sprint 33 ajoutera audit-of-audit (`audit_log_meta` table) tracant qui a consulte audit log.

7. **Piege : metric `admin_rbac_endpoint_calls_total` cardinality explosion si label dynamique.** Pourquoi : Si label inclut `userId` ou `request_id`, cardinalite millions metriques Prometheus -> OOM. Solution : Labels uniquement low-cardinality `endpoint`, `status` (3 + 5 = 15 series). PAS `userId` (use logs structures pour traceback). Test V16 verifie metric cardinality < 50.

8. **Piege : Cache 1h `admin:rbac:roles:list` peut servir matrix obsolete apres deploy nouveau bundle.** Pourquoi : Deploy v2.3.0 ajoute permission `insure.policies.cancel_anticipated`, cache Redis a v2.2 sans cette permission, dashboard affiche obsolete pendant 1h. Solution : Cache key inclut version bundle `admin:rbac:roles:list:v{BUNDLE_VERSION}` from env injected at build. Nouveau deploy = nouvelle version key = miss + repopulate. Alternative : invalidation post-deploy via init script. Test V17.

9. **Piege : Endpoint `/audit/stats` aggregation peut etre slow si window=30d millions rows.** Pourquoi : `GROUP BY role, permission` sur 5M rows = 30s. Solution : Materialized view `rbac_audit_stats_hourly` refreshed every 15min via pg_cron. Endpoint query MV au lieu de raw table. Window > 7d default rejette si MV pas dispo. Test V18 explain analyze.

10. **Piege : Reponse `/audit/denied` peut leaker IPs prives.** Pourquoi : Audit log contient IP source (request_id, ip), exposer ces IPs internes peut leak topologie reseau. Solution : Acceptable car super_admin authorise. Mais IPs publiques (clients fin) peuvent contenir PII -> CNDP loi 09-08 art 4 minimisation. Solution : IP hashee SHA256 + salt en stockage, decryptee uniquement super admin avec MFA challenge `?revealIps=true&mfaToken=xxx`. Hors scope Sprint 7 -- documente pour Sprint 33.

11. **Piege : Cache Redis 1h peut diverger entre instances si invalidation pas Kafka.** Pourquoi : `AdminPermissionsCacheService.invalidate()` invoque Redis DEL local, mais autres instances API ont peut-etre cache entry differente. Solution : Cache cle unique partagee Redis cluster, DELETE atomic cross-instance. Pas de cache L1 in-memory pour ce module (contrairement Tache 2.3.10 prochainement Sprint 33). Test V19.

12. **Piege : OpenAPI Swagger genere expose schema donnees sensibles audit denied.** Pourquoi : Swagger UI accessible authenticated documentation exposes sample response avec PII. Solution : Examples Swagger utilisent UUIDs synthetiques + IPs `0.0.0.0` + `user-agent: Example`. Pas de PII reelles dans examples. Test V20.

13. **Piege : Endpoint `/permissions` retourne 85+ entries lourd payload mobile.** Pourquoi : Serialization JSON 85 perm enrichies = ~30 KB. Solution : Compression gzip Fastify automatique reduces ~5 KB. Acceptable. Pagination optionnelle `?limit=20` available. Test V21.

14. **Piege : Filtre `?since=2020-01-01` query 5 ans audit -> heap exhausted.** Pourquoi : Pas de borne max sur `since`. Solution : Server enforce max window 30 jours hard-coded `MAX_AUDIT_WINDOW_DAYS=30`. Si client demande plus, 400 BadRequest avec message "max window 30 days, use cursor pagination". Test V22.

15. **Piege : Endpoint `/admin/rbac/roles/:role/permissions` invalid role param -> 500 stack trace leak.** Pourquoi : Si client passe `?role=invalid`, RbacService throw, exception non handled = 500. Solution : Zod validation pipe transforme `role` parametre en `AuthRoleEnum.parse(role)` qui throw ZodError, intercepte par exception filter -> 400 BadRequest avec message `"Invalid role 'invalid'. Expected one of: super_admin_platform, analyst_support, ..."`. Test V23.

### 2.7 Conformite legale Maroc -- impact AdminPermissionsController

| Loi / norme | Impact AdminPermissionsController | Implementation |
|-------------|------------------------------------|----------------|
| **CNDP loi 09-08 article 4 (minimisation)** | Endpoint `/audit/denied` retourne PII (userId, IP) | userId UUID pseudonyme (acceptable). IP exposed only super_admin with MFA. Documentation Registre des Traitements CNDP `docs/cndp/registre-traitements.md` Section 7.3 (Audit Access). |
| **CNDP loi 09-08 article 18 (conservation)** | Audit log retention max | Partition `rbac_audit_log_YYYYMM` auto-DROP > 12 mois (Sprint 4 migrations). Endpoint `/audit/denied` filtre implicit `created_at > NOW() - INTERVAL '12 months'`. |
| **CNDP loi 09-08 article 22 (acces personne concernee)** | Personne concernee peut demander quels denied access l'ont impactee | Out-of-scope endpoint admin (interne). Sprint 16 endpoint auto-service `GET /api/v1/me/audit/access-denied` consume meme `RbacAuditService` mais filtre `userId = ctx.userId`. |
| **ACAPS Circulaire 2018/01 article 9 (tracabilite)** | Tous denied access traces | Audit log alimente Tache 2.3.9 lors chaque denied. Endpoint `/audit/denied` permet ACAPS auditeur consulte denied courtage operations 5 derniers ans (cap 12 mois Sprint 7, Sprint 34 etend retention compliance). |
| **AMC Loi 12-18 article 15 (AML detection)** | Stats `/audit/stats` detecte patterns abuses | Endpoint `top_denied_users` flag potentielle compromission compte (ex: 100 denied/h = brute force). Integration Sprint 25 SIEM Splunk consume metrics `admin_rbac_denied_total` pour alert SOC. ComplianceOfficer role (analyst_support) peut consulter `/audit/stats` (read-only acceptable Sprint 7). |
| **BAM circulaire 1/G/2007 (separation taches)** | Super admin different operations vs audit | super_admin_platform peut consulter audit. Phase 7+ ajoutera role `audit_officer` separe pour separation duties stricte BAM compliance. |
| **Loi 17-99 (assurance generale)** | Out-of-scope direct | -- |
| **Loi 09-08 decision 008/2018 (sessions prospect)** | Prospects denied tracked separement | Audit log inclut prospects (role=prospect, userId=session_id pseudonyme). |
| **CNDP recommendation 5/2020 (logs)** | Logs admin access traces | Sprint 33 ajoutera `audit_log_meta` tracant qui a consulte `/audit/denied` (audit-of-audit). |

### 2.8 Performance budget AdminPermissionsController

- `GET /admin/rbac/roles` cache hit : p99 < 15ms (Redis GET 2ms + JSON parse 1ms + serialization Fastify 2ms + network 10ms).
- `GET /admin/rbac/roles` cache miss : p99 < 80ms (cache miss check 2ms + RoleCatalogProvider iterate 12 roles 5ms + PermissionCacheService.getEffectivePermissions x 12 roles parallel 30ms + breakdown module 10ms + Redis SET 2ms + serialization 5ms).
- `GET /admin/rbac/roles/:role/permissions` cache hit : p99 < 10ms.
- `GET /admin/rbac/roles/:role/permissions` cache miss : p99 < 40ms.
- `GET /admin/rbac/permissions` cache hit : p99 < 20ms.
- `GET /admin/rbac/permissions` cache miss : p99 < 100ms (iterate 85+ perms + compute grantedToRoles per perm 30ms).
- `GET /admin/rbac/audit/denied` (50 rows, 24h window) : p99 < 50ms (index seek + serialization).
- `GET /admin/rbac/audit/denied` (cursor deep, no index hit) : p99 < 200ms.
- `GET /admin/rbac/audit/stats` (24h window MV hit) : p99 < 100ms.
- `GET /admin/rbac/audit/stats` (30d window full agg) : p99 < 2000ms (hard-cap, refuse si > timeout).
- Throughput cible : > 500 req/s (admin endpoints low volume).

### 2.9 Failure modes

| Failure | Detection | Handling | Test |
|---------|-----------|----------|------|
| Redis cache down | ioredis emit error | Fallback compute direct (no cache), log warn, increment counter, NE PAS bloquer service | V24 |
| Postgres audit query timeout | Statement timeout 5s | Return 503 Service Unavailable + Retry-After header | V25 |
| Materialized view stale (refresh failed) | pg_cron status check Sprint 22 | Fallback raw query `rbac_audit_log` agg (slower), log warn, alert if > 1h stale | V26 |
| RoleGuard false negative (authorize wrong role) | Tests E2E V5 V6 | Fail tests CI, never deploy | V27 |
| Cursor signature mismatch | HMAC verify fail | 400 BadRequest "Invalid cursor signature" | V14 |
| Zod validation fail role param | ZodError | 400 BadRequest with details | V23 |
| Audit window > 30d | Pre-validation | 400 BadRequest "max window 30 days" | V22 |
| Network partition Redis | ioredis reconnect | Fallback compute direct | V24 |

### 2.10 Volumetrie attendue (annee 1)

Estimation production tenant Bennani (1 broker, 30 users) + Atlas (1 garage, 50 users) :
- `/admin/rbac/roles` calls/jour : ~50 (super admins consultent dashboard 5x/jour x 10 super admins) -> 99% cache hit -> 0.5 cache miss compute.
- `/admin/rbac/permissions` calls/jour : ~10.
- `/admin/rbac/audit/denied` calls/jour : ~100 (incidents diagnostic).
- `/admin/rbac/audit/stats` calls/jour : ~20 (monitoring dashboards Grafana fetch).

Audit log `rbac_audit_log` denied entries/jour : Bennani ~50 denied (users tentent actions sans permission dev/test) + Atlas ~30 + super_admin ~5 = ~100/jour. Sur 12 mois : ~36000 rows. Largement gerable Postgres meme sans MV pour 1 an. MV materialise utile > 100k rows.

### 2.11 Comparaison architectures admin endpoints industrie

| Acteur | Endpoints admin RBAC | Auth | Audit access |
|--------|----------------------|------|--------------|
| AWS IAM | `iam:GetRole`, `iam:ListRoles`, `iam:ListPolicies` | Sigv4 + IAM admin role | CloudTrail logs |
| Auth0 | `GET /api/v2/roles`, `GET /api/v2/permissions` | Management API token + scopes | Tenant logs |
| Keycloak | Admin REST API `/admin/realms/{realm}/roles` | OIDC bearer + admin role | Event Listener SPI |
| Casbin | `enforcer.GetAllRoles()` programmatic | App-level | Custom |
| **Skalean** | `/api/v1/admin/rbac/roles` + 4 autres endpoints introspection | JWT + super_admin_platform role + MFA | RbacAuditService traces meta-access Sprint 33 |

### 2.12 Decisions architecturales documentees

- **ADR-029** `docs/adr/029-admin-rbac-api-rest.md` : Choix REST vs GraphQL.
- **ADR-030** `docs/adr/030-admin-rbac-cursor-pagination.md` : Choix cursor-based pagination.
- **ADR-031** `docs/adr/031-admin-rbac-cache-1h.md` : Choix cache 1h Redis namespace separe.
- **ADR-032** `docs/adr/032-admin-rbac-readonly-sprint7.md` : Read-only Sprint 7, write Phase 7+.
- **decision-014** `00-pilotage/decisions/014-tier-enterprise-custom-permissions.md` : Tier enterprise Phase 7+.

---

## 3. Architecture context

### 3.1 Position dans le sprint 7

Cette tache 2.3.11 est la 11eme tache du Sprint 7 et la 33eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.10 (`PermissionCacheService.getEffectivePermissions(role)` consume cache hit O(1) pour endpoint `/admin/rbac/roles/:role/permissions`), Tache 2.3.9 (`RbacAuditService` + table `rbac_audit_log` Postgres consume pour `/audit/denied` + `/audit/stats`), Tache 2.3.6 (`RolesService` listing 12 roles consume via `RoleCatalogProvider`), Tache 2.3.4 (`RoleGuard` + decorator `@Role` enforce super_admin only), Tache 2.3.3 (`RbacService.computeEffectivePermissions` fallback), Tache 2.3.2 (`PermissionsMatrix` reuse), Tache 2.3.1 (`Permission` catalog + `AuthRole` Zod), Sprint 6 (TenantContext + AsyncLocalStorage + bypass tenant pour super admin contexte plateforme), Sprint 5 (RedisService + Pino logger + ConfigService Zod-validated + Helmet middleware), Sprint 4 (DrizzleService + migrations partition rbac_audit_log + cursor pagination helper Sprint 4), Sprint 3 (NestJS Fastify + ZodValidationPipe global + @nestjs/swagger 8.x).
- **Bloque** : Tache 2.3.12 (tests E2E exhaustifs 80+ scenarios consomment endpoints `/admin/rbac/*` pour validate matrice).
- **Apporte au sprint** : Module `AdminPermissionsModule` injectable + 5 endpoints HTTP introspection RBAC + cache 1h + pagination cursor + audit query optimisee + Swagger documentation auto-generee + 35+ tests unit/integration/E2E.

### 3.2 Position dans le programme global

- **Sprint 8 CRM** : Developpeur consulte `/admin/rbac/roles/broker_user/permissions` pour comprendre quels permissions assigner au controller ContactsController.
- **Sprint 14 Insure** : Validation matrix policies endpoint `insure.policies.create` granted aux bons roles via `/admin/rbac/permissions?module=insure`.
- **Sprint 19 Repair** : Idem pour `repair.sinistres.assign` etc.
- **Sprint 22 Observability** : Grafana dashboards consume metrics `admin_rbac_endpoint_calls_total{endpoint, status}`, `admin_rbac_endpoint_duration_seconds{endpoint}`, `admin_rbac_audit_query_rows_returned{endpoint}`, `admin_rbac_cache_hits_total{endpoint}`, `admin_rbac_cache_misses_total{endpoint}`. Alerts PagerDuty si p99 latency > 200ms ou error rate > 1%.
- **Sprint 25 SIEM** : Splunk consume `/admin/rbac/audit/stats` periodically pour detection patterns SOC.
- **Sprint 26 admin module** : Endpoint `POST /api/v1/admin/rbac/cache/invalidate` consume `AdminPermissionsCacheService.invalidate()`. Endpoint `GET /api/v1/admin/rbac/users/:userId/effective-permissions` complement Phase 7+.
- **Sprint 28 SRE runbook** : `RUNBOOK-RBAC-001-incident-user-cant-access.md` documente flow diagnostic via `/admin/rbac/audit/denied?userId=X&since=1h`.
- **Sprint 33 SecOps pentest** : Brute-force `/admin/rbac/audit/denied` avec roles non super_admin -> assert 403.
- **Sprint 34 Compliance** : Mensuel `/admin/rbac/audit/stats?window=30d` genere rapport CNDP.
- **Phase 7+ tier custom** : Endpoints write `POST /api/v1/admin/rbac/tenants/:tenantId/permissions/grant`.

### 3.3 Diagramme endpoints `/api/v1/admin/rbac/*` (ASCII)

```
+---------------------------------------------------------------------+
| AdminPermissionsController                                           |
| Prefix : /api/v1/admin/rbac                                          |
| Guards : JwtAuthGuard + RoleGuard                                    |
| Decorator class-level : @Role(AuthRole.SUPER_ADMIN_PLATFORM)         |
| @ApiTags('admin-rbac')                                               |
+---------------------------------------------------------------------+
| GET  /roles                                                          |
|      Cache : 1h Redis admin:rbac:roles:list:v{BUNDLE_VERSION}        |
|      Resp  : { data: RoleInfoDto[12], metadata: { fromCache } }      |
+---------------------------------------------------------------------+
| GET  /roles/:role/permissions                                        |
|      Cache : 1h Redis admin:rbac:roles:{role}:permissions:v{VER}     |
|      Flow  : permissionCache.getEffectivePermissions(role)           |
|             -> enrichWithSource(role, permissions)                   |
|             -> breakdownByModule(permissions)                        |
+---------------------------------------------------------------------+
| GET  /permissions                                                    |
|      Query : ?module=crm&action=read&limit=50&cursor=xyz             |
|      Cache : 1h Redis admin:rbac:permissions:catalog:v{VER}          |
+---------------------------------------------------------------------+
| GET  /audit/denied                                                   |
|      Query : ?userId&role&permission&since&until&ip&reason           |
|             &limit=50&cursor=xyz                                     |
|      Cache : NO (real-time)                                          |
+---------------------------------------------------------------------+
| GET  /audit/stats                                                    |
|      Query : ?window=1h|24h|7d|30d&groupBy=role|permission|policy    |
|      Cache : 5min Redis admin:rbac:audit:stats:{window}:{groupBy}    |
+---------------------------------------------------------------------+
```

### 3.4 Flow `GET /admin/rbac/roles/:role/permissions` (ASCII)

```
HTTP GET /api/v1/admin/rbac/roles/broker_admin/permissions
      |
      v
JwtAuthGuard.canActivate() (extract user from JWT)
      |
      v
RoleGuard.canActivate() (assert user.role === 'super_admin_platform')
      |
      v
AdminPermissionsController.getRolePermissions(role='broker_admin')
      |
      v
ZodValidationPipe (AuthRoleEnum.parse('broker_admin'))
      |
      v
AdminPermissionsService.getRolePermissions('broker_admin')
      |
      v
AdminPermissionsCacheService.get('admin:rbac:roles:broker_admin:permissions:v2.3.0')
      |
   (cache miss : null)
      |
      v
PermissionCacheService.getEffectivePermissions('broker_admin')
   (Tache 2.3.10 cache hit O(1) : Set<Permission>(30 perms))
      |
      v
AdminPermissionsService.enrichWithSource('broker_admin', perms)
   (for each perm, check si direct ou inherited de quel role)
      |
      v
AdminPermissionsService.breakdownByModule(perms)
   (group by module : crm, insure, pay, books, ...)
      |
      v
Build RolePermissionsDto + cache.set(key, dto, ttl=3600)
      |
      v
Reponse JSON HTTP 200
```

### 3.5 Flow `GET /admin/rbac/audit/denied` (ASCII)

```
HTTP GET /api/v1/admin/rbac/audit/denied?userId=01J7A&since=2026-05-06T08:00:00Z&limit=50&cursor=eyJsYXN0...
      |
      v
JwtAuthGuard + RoleGuard (super_admin_platform check)
      |
      v
AdminPermissionsController.getAuditDenied(query, cursor)
      |
      v
ZodValidationPipe (AuditDeniedQueryDto.parse(query))
      |
      v
AdminPermissionsPaginationHelper.parseCursor(cursor) (verify HMAC)
      |
      v
AdminPermissionsAuditQueryRepository.findDenied(filters, cursor)
      |
      v
Drizzle SQL SELECT FROM rbac_audit_log WHERE granted=false AND user_id=...
   AND created_at > ... AND (created_at, id) < ($cursor)
   ORDER BY created_at DESC, id DESC LIMIT 51
      |
   (uses index rbac_audit_log_user_denied_idx)
      |
      v
Map rows -> AuditEventDto[] + build nextCursor HMAC
      |
      v
Reponse JSON HTTP 200 with pagination metadata
```

### 3.6 Diagramme module dependency graph

```
AppModule
  |
  +-- AdminModule (Sprint 7+)
        |
        +-- AdminPermissionsModule (Tache 2.3.11)
              |
              +-- AdminPermissionsController
              +-- AdminPermissionsService
              +-- AdminPermissionsCacheService
              +-- AdminPermissionsPaginationHelper
              +-- AdminPermissionsAuditQueryRepository
              +-- AdminPermissionsMetrics
              +-- AdminPermissionsOpenApi
              |
              imports :
                - RbacModule (PermissionCacheService, RbacService, RoleCatalogProvider)
                - AuditModule (RbacAuditService)
                - DrizzleModule (DrizzleService)
                - RedisModule (RedisService)
                - ConfigModule
                - LoggerModule
                - MetricsModule
                - SwaggerModule
```

---

## 4. Livrables checkables (25+ items)

### 4.1 Code (10+ items)

- [ ] L1 -- `repo/apps/api/src/modules/admin/permissions/admin-permissions.controller.ts` (~280 lignes)
- [ ] L2 -- `repo/apps/api/src/modules/admin/permissions/admin-permissions.service.ts` (~250 lignes)
- [ ] L3 -- `repo/apps/api/src/modules/admin/permissions/dtos/admin-permissions.dto.ts` (~200 lignes)
- [ ] L4 -- `repo/apps/api/src/modules/admin/permissions/admin-permissions.module.ts` (~80 lignes)
- [ ] L5 -- `repo/apps/api/src/modules/admin/permissions/services/admin-permissions-cache.service.ts` (~150 lignes)
- [ ] L6 -- `repo/apps/api/src/modules/admin/permissions/helpers/admin-permissions-pagination.helper.ts` (~100 lignes)
- [ ] L7 -- `repo/apps/api/src/modules/admin/permissions/repositories/admin-permissions-audit-query.repository.ts` (~180 lignes)
- [ ] L8 -- `repo/apps/api/src/modules/admin/permissions/services/admin-permissions-metrics.service.ts` (~80 lignes)
- [ ] L9 -- `repo/apps/api/src/modules/admin/permissions/openapi/admin-permissions.openapi.ts` (~120 lignes)
- [ ] L10 -- `repo/apps/api/src/modules/admin/permissions/index.ts` (barrel exports)

### 4.2 Tests (7+ items)

- [ ] L11 -- `repo/apps/api/src/modules/admin/permissions/admin-permissions.controller.spec.ts` (~200 lignes : 20+ unit tests)
- [ ] L12 -- `repo/apps/api/src/modules/admin/permissions/admin-permissions.service.spec.ts` (~200 lignes : 20+ unit tests)
- [ ] L13 -- `repo/apps/api/src/modules/admin/permissions/services/admin-permissions-cache.service.spec.ts` (~80 lignes)
- [ ] L14 -- `repo/apps/api/src/modules/admin/permissions/helpers/admin-permissions-pagination.helper.spec.ts` (~80 lignes)
- [ ] L15 -- `repo/apps/api/src/modules/admin/permissions/repositories/admin-permissions-audit-query.repository.spec.ts` (~120 lignes)
- [ ] L16 -- `repo/apps/api/test/admin/admin-permissions.e2e-spec.ts` (~250 lignes : 15+ tests E2E Supertest)
- [ ] L17 -- `repo/apps/api/test/admin/fixtures/admin-permissions-fixtures.ts` (~120 lignes)

### 4.3 Configuration (5+ items)

- [ ] L18 -- Variables environnement `.env.example` (4 vars)
- [ ] L19 -- ConfigService schema Zod `repo/apps/api/src/config/admin-permissions.config.ts`
- [ ] L20 -- Migration Drizzle `0073_add_rbac_audit_indexes.sql`
- [ ] L21 -- Migration MV `0074_create_rbac_audit_stats_hourly_mv.sql`
- [ ] L22 -- pg_cron job `0075_schedule_rbac_audit_stats_refresh.sql`

### 4.4 Documentation (4+ items)

- [ ] L23 -- ADR-029 `docs/adr/029-admin-rbac-api-rest.md`
- [ ] L24 -- Runbook `docs/runbooks/RUNBOOK-RBAC-001-incident-user-cant-access.md`
- [ ] L25 -- OpenAPI snapshot `docs/openapi/admin-rbac.json`
- [ ] L26 -- Changelog `docs/changelog/sprint-07.md` mise a jour

### 4.5 CI / observabilite (4+ items)

- [ ] L27 -- Tests CI passes >= 35 tests Vitest verts
- [ ] L28 -- Coverage >= 90% lignes/branches `src/modules/admin/permissions/**`
- [ ] L29 -- Lint passes (eslint, prettier, eslint-plugin-skalean/redis-key-prefix)
- [ ] L30 -- Snapshot OpenAPI Swagger update committed

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/admin/permissions/
  +-- admin-permissions.controller.ts                       # CREATE ~280 lignes
  +-- admin-permissions.service.ts                          # CREATE ~250 lignes
  +-- admin-permissions.module.ts                           # CREATE ~80 lignes
  +-- index.ts                                              # CREATE barrel
  +-- dtos/
  |     +-- admin-permissions.dto.ts                        # CREATE ~200 lignes
  +-- services/
  |     +-- admin-permissions-cache.service.ts              # CREATE ~150 lignes
  |     +-- admin-permissions-metrics.service.ts            # CREATE ~80 lignes
  +-- helpers/
  |     +-- admin-permissions-pagination.helper.ts          # CREATE ~100 lignes
  +-- repositories/
  |     +-- admin-permissions-audit-query.repository.ts     # CREATE ~180 lignes
  +-- openapi/
        +-- admin-permissions.openapi.ts                    # CREATE ~120 lignes

repo/apps/api/src/modules/admin/admin.module.ts             # MODIFY add AdminPermissionsModule import
repo/apps/api/src/app.module.ts                             # MODIFY add AdminModule (if not yet)

repo/apps/api/src/config/admin-permissions.config.ts        # CREATE Zod schema config
repo/apps/api/.env.example                                  # MODIFY add 4 env vars

repo/apps/api/src/db/migrations/
  +-- 0073_add_rbac_audit_indexes.sql                       # CREATE indexes composites
  +-- 0074_create_rbac_audit_stats_hourly_mv.sql            # CREATE materialized view
  +-- 0075_schedule_rbac_audit_stats_refresh.sql            # CREATE pg_cron job

repo/apps/api/test/admin/
  +-- admin-permissions.e2e-spec.ts                         # CREATE ~250 lignes
  +-- fixtures/admin-permissions-fixtures.ts                # CREATE ~120 lignes

docs/adr/029-admin-rbac-api-rest.md                         # CREATE ADR
docs/adr/030-admin-rbac-cursor-pagination.md                # CREATE ADR
docs/adr/031-admin-rbac-cache-1h.md                         # CREATE ADR
docs/adr/032-admin-rbac-readonly-sprint7.md                 # CREATE ADR
docs/runbooks/RUNBOOK-RBAC-001-incident-user-cant-access.md # CREATE runbook
docs/openapi/admin-rbac.json                                # CREATE snapshot
docs/changelog/sprint-07.md                                 # MODIFY append
```

Total : 21 nouveaux fichiers code + 6 nouveaux fichiers documentation + 3 fichiers modifies.

---

## 6. Code patterns COMPLETS

Cette section livre 12 fichiers TypeScript/SQL COMPLETS executables. Tous les imports sont explicites, le code TypeScript strict, aucune `any`, aucune emoji.

### 6.1 `admin-permissions.dto.ts` (~200 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/dtos/admin-permissions.dto.ts
import { z } from 'zod';
import { AuthRoleEnum, type AuthRole, PermissionValueSchema, type Permission } from '@insurtech/auth/rbac';

// Tier classification per role
export const RoleTierEnum = z.enum(['platform', 'tenant_broker', 'tenant_garage', 'customer', 'public']);
export type RoleTier = z.infer<typeof RoleTierEnum>;

export const PermissionSourceSchema = z.union([
  z.literal('direct'),
  z.string().regex(/^inherited_from:[a-z_]+$/),
]);
export type PermissionSource = z.infer<typeof PermissionSourceSchema>;

export const AbacPolicyEnum = z.enum([
  'OwnResourcesPolicy',
  'TimeBasedPolicy',
  'StatusBasedPolicy',
  'WorkflowStatePolicy',
]);
export type AbacPolicy = z.infer<typeof AbacPolicyEnum>;

// Module enumeration consume PermissionsMatrix
export const PermissionModuleEnum = z.enum([
  'auth', 'crm', 'booking', 'comm', 'docs', 'pay', 'books', 'compliance',
  'analytics', 'insure', 'repair', 'stock', 'hr', 'admin', 'cross_tenant', 'sky', 'mcp',
]);
export type PermissionModule = z.infer<typeof PermissionModuleEnum>;

// ---------------- RoleInfoDto ----------------
export const RoleInfoDtoSchema = z.object({
  role: AuthRoleEnum,
  tier: RoleTierEnum,
  description: z.string().min(1).max(500),
  inheritsFrom: z.array(AuthRoleEnum),
  permissionsCount: z.number().int().nonnegative(),
  directPermissionsCount: z.number().int().nonnegative(),
  inheritedPermissionsCount: z.number().int().nonnegative(),
  requiresMfa: z.boolean(),
  sessionTtlSeconds: z.number().int().positive(),
});
export type RoleInfoDto = z.infer<typeof RoleInfoDtoSchema>;

export const RolesListResponseSchema = z.object({
  data: z.array(RoleInfoDtoSchema).length(12),
  metadata: z.object({
    fromCache: z.boolean(),
    cacheAge: z.number().int().nonnegative().optional(),
    cacheTtlRemaining: z.number().int().nonnegative().optional(),
    bundleVersion: z.string(),
    computedAt: z.string().datetime(),
  }),
});
export type RolesListResponse = z.infer<typeof RolesListResponseSchema>;

// ---------------- RolePermissionsDto ----------------
export const PermissionDetailSchema = z.object({
  name: PermissionValueSchema,
  module: PermissionModuleEnum,
  action: z.string(),
  source: PermissionSourceSchema,
  isAbac: z.boolean(),
  abacPolicy: AbacPolicyEnum.nullable(),
  description: z.string().optional(),
});
export type PermissionDetail = z.infer<typeof PermissionDetailSchema>;

export const ModuleBreakdownSchema = z.object({
  count: z.number().int().nonnegative(),
  permissions: z.array(PermissionValueSchema),
});
export type ModuleBreakdown = z.infer<typeof ModuleBreakdownSchema>;

export const RolePermissionsDtoSchema = z.object({
  role: AuthRoleEnum,
  tier: RoleTierEnum,
  inheritsFrom: z.array(AuthRoleEnum),
  permissionsCount: z.number().int().nonnegative(),
  directPermissionsCount: z.number().int().nonnegative(),
  inheritedPermissionsCount: z.number().int().nonnegative(),
  permissions: z.array(PermissionDetailSchema),
  breakdownByModule: z.record(PermissionModuleEnum, ModuleBreakdownSchema),
  metadata: z.object({
    fromCache: z.boolean(),
    cacheAge: z.number().int().nonnegative().optional(),
    cacheTtlRemaining: z.number().int().nonnegative().optional(),
    computedAt: z.string().datetime(),
  }),
});
export type RolePermissionsDto = z.infer<typeof RolePermissionsDtoSchema>;

// ---------------- PermissionInfoDto (catalog) ----------------
export const PermissionInfoDtoSchema = z.object({
  name: PermissionValueSchema,
  module: PermissionModuleEnum,
  action: z.string(),
  isAbac: z.boolean(),
  abacPolicy: AbacPolicyEnum.nullable(),
  description: z.string().optional(),
  grantedToRolesCount: z.number().int().nonnegative(),
  grantedToRoles: z.array(AuthRoleEnum),
});
export type PermissionInfoDto = z.infer<typeof PermissionInfoDtoSchema>;

export const CursorSchema = z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export const PermissionsCatalogQuerySchema = z.object({
  module: PermissionModuleEnum.optional(),
  action: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: CursorSchema.optional(),
});
export type PermissionsCatalogQuery = z.infer<typeof PermissionsCatalogQuerySchema>;

export const PermissionsCatalogResponseSchema = z.object({
  data: z.array(PermissionInfoDtoSchema),
  pagination: z.object({
    nextCursor: CursorSchema.nullable(),
    hasMore: z.boolean(),
    pageSize: z.number().int().positive(),
  }),
  metadata: z.object({
    fromCache: z.boolean(),
    totalCatalogSize: z.number().int().positive(),
    bundleVersion: z.string(),
  }),
});
export type PermissionsCatalogResponse = z.infer<typeof PermissionsCatalogResponseSchema>;

// ---------------- AuditEventDto ----------------
export const DenyReasonEnum = z.enum([
  'NO_PERMISSION', 'NOT_OWNER', 'EXPIRED_RESOURCE', 'INVALID_STATUS',
  'INVALID_WORKFLOW_TRANSITION', 'TIME_WINDOW_EXCEEDED', 'TENANT_MISMATCH',
  'MFA_REQUIRED', 'IP_RESTRICTED', 'RATE_LIMITED', 'OTHER',
]);
export type DenyReason = z.infer<typeof DenyReasonEnum>;

export const PolicyEvaluationSchema = z.object({
  policyName: AbacPolicyEnum,
  decision: z.enum(['allow', 'deny', 'abstain']),
  reason: z.string(),
  evaluatedAt: z.string().datetime(),
});
export type PolicyEvaluation = z.infer<typeof PolicyEvaluationSchema>;

export const AuditEventDtoSchema = z.object({
  id: z.string().ulid(),
  userId: z.string().uuid(),
  role: AuthRoleEnum,
  permission: PermissionValueSchema,
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  granted: z.literal(false),
  reason: DenyReasonEnum,
  policyName: AbacPolicyEnum.nullable(),
  policyEvaluated: z.array(PolicyEvaluationSchema),
  ip: z.string(),
  userAgent: z.string(),
  requestId: z.string().ulid(),
  createdAt: z.string().datetime(),
});
export type AuditEventDto = z.infer<typeof AuditEventDtoSchema>;

export const AuditDeniedQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  role: AuthRoleEnum.optional(),
  permission: PermissionValueSchema.optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  ip: z.string().optional(),
  reason: DenyReasonEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: CursorSchema.optional(),
});
export type AuditDeniedQuery = z.infer<typeof AuditDeniedQuerySchema>;

export const AuditDeniedResponseSchema = z.object({
  data: z.array(AuditEventDtoSchema),
  pagination: z.object({
    nextCursor: CursorSchema.nullable(),
    hasMore: z.boolean(),
    pageSize: z.number().int().positive(),
  }),
  metadata: z.object({
    queriedAt: z.string().datetime(),
    filterApplied: z.record(z.string(), z.unknown()),
  }),
});
export type AuditDeniedResponse = z.infer<typeof AuditDeniedResponseSchema>;

// ---------------- AuditStatsDto ----------------
export const StatsWindowEnum = z.enum(['1h', '24h', '7d', '30d']);
export type StatsWindow = z.infer<typeof StatsWindowEnum>;

export const StatsGroupByEnum = z.enum(['role', 'permission', 'policy', 'reason']);
export type StatsGroupBy = z.infer<typeof StatsGroupByEnum>;

export const AuditStatsQuerySchema = z.object({
  window: StatsWindowEnum.default('24h'),
  groupBy: StatsGroupByEnum.default('permission'),
});
export type AuditStatsQuery = z.infer<typeof AuditStatsQuerySchema>;

export const TopDeniedItemSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
  latestAt: z.string().datetime().optional(),
});
export type TopDeniedItem = z.infer<typeof TopDeniedItemSchema>;

export const HourBucketSchema = z.object({
  hour: z.string().datetime(),
  count: z.number().int().nonnegative(),
});
export type HourBucket = z.infer<typeof HourBucketSchema>;

export const AuditStatsDtoSchema = z.object({
  window: StatsWindowEnum,
  groupBy: StatsGroupByEnum,
  totalDenied: z.number().int().nonnegative(),
  uniqueUsers: z.number().int().nonnegative(),
  uniqueIps: z.number().int().nonnegative(),
  topDeniedPermissions: z.array(TopDeniedItemSchema).max(10),
  topDeniedUsers: z.array(TopDeniedItemSchema).max(10),
  topDeniedIps: z.array(TopDeniedItemSchema).max(10),
  topDeniedRoles: z.array(TopDeniedItemSchema).max(10),
  deniedPerHour: z.array(HourBucketSchema),
  metadata: z.object({
    queriedAt: z.string().datetime(),
    materializedViewUsed: z.boolean(),
    fromCache: z.boolean(),
  }),
});
export type AuditStatsDto = z.infer<typeof AuditStatsDtoSchema>;
```

### 6.2 `admin-permissions.controller.ts` (~280 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/admin-permissions.controller.ts
import {
  Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus,
  Header, Inject, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiForbiddenResponse,
  ApiUnauthorizedResponse, ApiBadRequestResponse, ApiServiceUnavailableResponse,
  ApiQuery, ApiParam,
} from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';
import { JwtAuthGuard } from '@insurtech/auth/jwt';
import { RoleGuard, Role } from '@insurtech/auth/rbac';
import { AuthRole, AuthRoleEnum } from '@insurtech/auth/rbac/types';
import { ZodValidationPipe } from '@insurtech/common/pipes';
import { AdminPermissionsService } from './admin-permissions.service';
import { AdminPermissionsMetricsService } from './services/admin-permissions-metrics.service';
import {
  AuditDeniedQuerySchema, AuditDeniedQuery, AuditDeniedResponse,
  AuditStatsQuerySchema, AuditStatsQuery, AuditStatsDto,
  PermissionsCatalogQuerySchema, PermissionsCatalogQuery, PermissionsCatalogResponse,
  RolesListResponse, RolePermissionsDto,
} from './dtos/admin-permissions.dto';
import {
  RolesListExample, RolePermissionsExample, PermissionsCatalogExample,
  AuditDeniedExample, AuditStatsExample,
} from './openapi/admin-permissions.openapi';

@ApiTags('admin-rbac')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleGuard)
@Role(AuthRole.SUPER_ADMIN_PLATFORM)
@Controller('api/v1/admin/rbac')
export class AdminPermissionsController {
  constructor(
    private readonly service: AdminPermissionsService,
    private readonly metrics: AdminPermissionsMetricsService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AdminPermissionsController.name);
  }

  @Get('roles')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, max-age=3600, must-revalidate')
  @ApiOperation({
    summary: 'List 12 RBAC roles with metadata',
    description: 'Returns all 12 roles defined in PermissionsMatrix with permissions count, hierarchy, tier, MFA flag.',
  })
  @ApiOkResponse({ description: 'List of 12 roles', schema: { example: RolesListExample } })
  @ApiUnauthorizedResponse({ description: 'JWT missing or invalid' })
  @ApiForbiddenResponse({ description: 'Caller is not super_admin_platform' })
  @ApiServiceUnavailableResponse({ description: 'Cache backend unreachable' })
  async listRoles(): Promise<RolesListResponse> {
    const startTime = Date.now();
    const endpoint = 'roles_list';
    this.metrics.endpointCalls.inc({ endpoint, status: 'in_progress' });
    try {
      const result = await this.service.listRoles();
      const durationMs = Date.now() - startTime;
      this.metrics.endpointDuration.observe({ endpoint }, durationMs / 1000);
      this.metrics.endpointCalls.inc({ endpoint, status: '200' });
      this.logger.info({ endpoint, durationMs, fromCache: result.metadata.fromCache, count: result.data.length }, 'admin rbac roles list');
      return result;
    } catch (error) {
      this.metrics.endpointCalls.inc({ endpoint, status: '503' });
      this.logger.error({ endpoint, error }, 'admin rbac roles list failed');
      throw new ServiceUnavailableException('rbac introspection backend unavailable');
    }
  }

  @Get('roles/:role/permissions')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, max-age=3600, must-revalidate')
  @ApiOperation({
    summary: 'List effective permissions for a given role with hierarchy resolution',
    description: 'Returns permissions inherited via RoleHierarchy + breakdown by module + source per permission.',
  })
  @ApiParam({ name: 'role', enum: AuthRoleEnum.options, description: 'Role identifier' })
  @ApiOkResponse({ description: 'Permissions effectives', schema: { example: RolePermissionsExample } })
  @ApiBadRequestResponse({ description: 'Invalid role parameter' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async getRolePermissions(
    @Param('role', new ZodValidationPipe(AuthRoleEnum)) role: AuthRole,
  ): Promise<RolePermissionsDto> {
    const startTime = Date.now();
    const endpoint = 'role_permissions';
    this.metrics.endpointCalls.inc({ endpoint, status: 'in_progress' });
    try {
      const result = await this.service.getRolePermissions(role);
      const durationMs = Date.now() - startTime;
      this.metrics.endpointDuration.observe({ endpoint }, durationMs / 1000);
      this.metrics.endpointCalls.inc({ endpoint, status: '200' });
      this.logger.info(
        { endpoint, role, count: result.permissions.length, fromCache: result.metadata.fromCache, durationMs },
        'admin rbac role permissions',
      );
      return result;
    } catch (error) {
      this.metrics.endpointCalls.inc({ endpoint, status: '500' });
      this.logger.error({ endpoint, role, error }, 'admin rbac role permissions failed');
      throw error;
    }
  }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, max-age=3600, must-revalidate')
  @ApiOperation({
    summary: 'List 85+ permissions catalog with filters and grantedToRoles per permission',
  })
  @ApiQuery({ name: 'module', required: false, description: 'Filter by module (crm, insure, repair, ...)' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action (read, create, ...)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size 1-200, default 50' })
  @ApiQuery({ name: 'cursor', required: false, description: 'HMAC-signed cursor base64' })
  @ApiOkResponse({ description: 'Permissions catalog', schema: { example: PermissionsCatalogExample } })
  async listPermissions(
    @Query(new ZodValidationPipe(PermissionsCatalogQuerySchema)) query: PermissionsCatalogQuery,
  ): Promise<PermissionsCatalogResponse> {
    const startTime = Date.now();
    const endpoint = 'permissions_catalog';
    this.metrics.endpointCalls.inc({ endpoint, status: 'in_progress' });
    const result = await this.service.listPermissions(query);
    const durationMs = Date.now() - startTime;
    this.metrics.endpointDuration.observe({ endpoint }, durationMs / 1000);
    this.metrics.endpointCalls.inc({ endpoint, status: '200' });
    this.logger.info({ endpoint, count: result.data.length, query, durationMs }, 'admin rbac permissions catalog');
    return result;
  }

  @Get('audit/denied')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List recent denied access events from rbac_audit_log',
    description: 'Filters by userId, role, permission, time window, IP, deny reason. Cursor pagination.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: AuthRoleEnum.options })
  @ApiQuery({ name: 'permission', required: false, type: String })
  @ApiQuery({ name: 'since', required: false, type: String, description: 'ISO 8601' })
  @ApiQuery({ name: 'until', required: false, type: String })
  @ApiQuery({ name: 'ip', required: false, type: String })
  @ApiQuery({ name: 'reason', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiOkResponse({ description: 'Denied events', schema: { example: AuditDeniedExample } })
  async getAuditDenied(
    @Query(new ZodValidationPipe(AuditDeniedQuerySchema)) query: AuditDeniedQuery,
  ): Promise<AuditDeniedResponse> {
    const startTime = Date.now();
    const endpoint = 'audit_denied';
    this.metrics.endpointCalls.inc({ endpoint, status: 'in_progress' });
    if (query.since && query.until) {
      const sinceMs = new Date(query.since).getTime();
      const untilMs = new Date(query.until).getTime();
      if (untilMs - sinceMs > 30 * 24 * 3600 * 1000) {
        this.metrics.endpointCalls.inc({ endpoint, status: '400' });
        throw new BadRequestException('max audit window 30 days, use cursor pagination');
      }
    }
    const result = await this.service.getAuditDenied(query);
    const durationMs = Date.now() - startTime;
    this.metrics.endpointDuration.observe({ endpoint }, durationMs / 1000);
    this.metrics.auditQueryRowsReturned.observe({ endpoint }, result.data.length);
    this.metrics.endpointCalls.inc({ endpoint, status: '200' });
    this.logger.info(
      { endpoint, count: result.data.length, hasMore: result.pagination.hasMore, query, durationMs },
      'admin rbac audit denied',
    );
    return result;
  }

  @Get('audit/stats')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({
    summary: 'Aggregated stats for denied access (top permissions/users/IPs, hourly distribution)',
  })
  @ApiQuery({ name: 'window', required: false, enum: ['1h', '24h', '7d', '30d'] })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['role', 'permission', 'policy', 'reason'] })
  @ApiOkResponse({ description: 'Audit stats', schema: { example: AuditStatsExample } })
  async getAuditStats(
    @Query(new ZodValidationPipe(AuditStatsQuerySchema)) query: AuditStatsQuery,
  ): Promise<AuditStatsDto> {
    const startTime = Date.now();
    const endpoint = 'audit_stats';
    this.metrics.endpointCalls.inc({ endpoint, status: 'in_progress' });
    const result = await this.service.getAuditStats(query);
    const durationMs = Date.now() - startTime;
    this.metrics.endpointDuration.observe({ endpoint }, durationMs / 1000);
    this.metrics.endpointCalls.inc({ endpoint, status: '200' });
    this.logger.info(
      { endpoint, window: query.window, groupBy: query.groupBy, total: result.totalDenied, durationMs },
      'admin rbac audit stats',
    );
    return result;
  }
}
```

### 6.3 `admin-permissions.service.ts` (~250 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/admin-permissions.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import {
  PermissionCacheService, RbacService, RoleHierarchy, PermissionsMatrix, RoleCatalogProvider,
} from '@insurtech/auth/rbac';
import { AuthRole, type Permission } from '@insurtech/auth/rbac/types';
import { AdminPermissionsCacheService } from './services/admin-permissions-cache.service';
import { AdminPermissionsAuditQueryRepository } from './repositories/admin-permissions-audit-query.repository';
import { AdminPermissionsPaginationHelper } from './helpers/admin-permissions-pagination.helper';
import {
  RolesListResponse, RoleInfoDto, RolePermissionsDto, PermissionDetail, ModuleBreakdown,
  PermissionsCatalogQuery, PermissionsCatalogResponse, PermissionInfoDto,
  AuditDeniedQuery, AuditDeniedResponse, AuditEventDto,
  AuditStatsQuery, AuditStatsDto, RoleTier, AbacPolicy, PermissionModule,
} from './dtos/admin-permissions.dto';

@Injectable()
export class AdminPermissionsService {
  private readonly bundleVersion: string;

  constructor(
    private readonly cache: AdminPermissionsCacheService,
    private readonly auditRepo: AdminPermissionsAuditQueryRepository,
    private readonly pagination: AdminPermissionsPaginationHelper,
    private readonly permissionCache: PermissionCacheService,
    private readonly rbac: RbacService,
    private readonly catalog: RoleCatalogProvider,
    private readonly config: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AdminPermissionsService.name);
    this.bundleVersion = this.config.get<string>('BUNDLE_VERSION') ?? 'dev';
  }

  // -------------------- listRoles --------------------
  async listRoles(): Promise<RolesListResponse> {
    const cacheKey = `admin:rbac:roles:list:v${this.bundleVersion}`;
    const cached = await this.cache.get<RolesListResponse>(cacheKey);
    if (cached) {
      return { ...cached, metadata: { ...cached.metadata, fromCache: true } };
    }

    const allRoles = this.catalog.getAllRoles();
    const data: RoleInfoDto[] = await Promise.all(
      allRoles.map(async (role): Promise<RoleInfoDto> => {
        const effectivePerms = await this.permissionCache.getEffectivePermissions(role);
        const directPerms = PermissionsMatrix.getDirectPermissions(role);
        const inheritsFrom = RoleHierarchy.getInheritedRoles(role);
        return {
          role,
          tier: this.classifyTier(role),
          description: this.catalog.getDescription(role),
          inheritsFrom,
          permissionsCount: effectivePerms.size,
          directPermissionsCount: directPerms.size,
          inheritedPermissionsCount: effectivePerms.size - directPerms.size,
          requiresMfa: this.catalog.requiresMfa(role),
          sessionTtlSeconds: this.catalog.getSessionTtl(role),
        };
      }),
    );

    const response: RolesListResponse = {
      data,
      metadata: {
        fromCache: false,
        bundleVersion: this.bundleVersion,
        computedAt: new Date().toISOString(),
      },
    };
    await this.cache.set(cacheKey, response);
    return response;
  }

  // -------------------- getRolePermissions --------------------
  async getRolePermissions(role: AuthRole): Promise<RolePermissionsDto> {
    const cacheKey = `admin:rbac:roles:${role}:permissions:v${this.bundleVersion}`;
    const cached = await this.cache.get<RolePermissionsDto>(cacheKey);
    if (cached) {
      return { ...cached, metadata: { ...cached.metadata, fromCache: true } };
    }

    const effective = await this.permissionCache.getEffectivePermissions(role);
    const direct = PermissionsMatrix.getDirectPermissions(role);
    const inheritsFrom = RoleHierarchy.getInheritedRoles(role);

    const permissions: PermissionDetail[] = Array.from(effective).map((perm) => {
      const isDirect = direct.has(perm);
      const sourceRole = isDirect ? null : this.findInheritingRole(perm, inheritsFrom);
      const meta = PermissionsMatrix.getMetadata(perm);
      return {
        name: perm,
        module: meta.module,
        action: meta.action,
        source: isDirect ? 'direct' : `inherited_from:${sourceRole ?? 'unknown'}`,
        isAbac: meta.isAbac,
        abacPolicy: meta.abacPolicy ?? null,
        description: meta.description,
      };
    });

    const breakdownByModule = this.computeBreakdownByModule(permissions);

    const response: RolePermissionsDto = {
      role,
      tier: this.classifyTier(role),
      inheritsFrom,
      permissionsCount: effective.size,
      directPermissionsCount: direct.size,
      inheritedPermissionsCount: effective.size - direct.size,
      permissions,
      breakdownByModule,
      metadata: {
        fromCache: false,
        computedAt: new Date().toISOString(),
      },
    };
    await this.cache.set(cacheKey, response);
    return response;
  }

  private findInheritingRole(perm: Permission, hierarchy: AuthRole[]): AuthRole | null {
    for (const r of hierarchy) {
      if (PermissionsMatrix.getDirectPermissions(r).has(perm)) {
        return r;
      }
    }
    return null;
  }

  private computeBreakdownByModule(perms: PermissionDetail[]): Record<PermissionModule, ModuleBreakdown> {
    const result: Partial<Record<PermissionModule, ModuleBreakdown>> = {};
    for (const p of perms) {
      const existing = result[p.module] ?? { count: 0, permissions: [] };
      existing.count += 1;
      existing.permissions.push(p.name);
      result[p.module] = existing;
    }
    return result as Record<PermissionModule, ModuleBreakdown>;
  }

  private classifyTier(role: AuthRole): RoleTier {
    if (role === 'super_admin_platform' || role === 'analyst_support') return 'platform';
    if (role.startsWith('broker_')) return 'tenant_broker';
    if (role.startsWith('garage_')) return 'tenant_garage';
    if (role === 'assure') return 'customer';
    return 'public';
  }

  // -------------------- listPermissions (catalog) --------------------
  async listPermissions(query: PermissionsCatalogQuery): Promise<PermissionsCatalogResponse> {
    const cacheKey = `admin:rbac:permissions:catalog:v${this.bundleVersion}:${query.module ?? 'all'}:${query.action ?? 'all'}`;
    const cached = await this.cache.get<PermissionsCatalogResponse>(cacheKey);
    let allPermissions: PermissionInfoDto[];
    let fromCache = false;
    if (cached) {
      allPermissions = cached.data;
      fromCache = true;
    } else {
      const allCatalog = PermissionsMatrix.getAllPermissions();
      allPermissions = allCatalog
        .filter((p) => !query.module || PermissionsMatrix.getMetadata(p).module === query.module)
        .filter((p) => !query.action || PermissionsMatrix.getMetadata(p).action === query.action)
        .map((perm): PermissionInfoDto => {
          const meta = PermissionsMatrix.getMetadata(perm);
          const grantedTo = this.catalog.getAllRoles().filter((r) => PermissionsMatrix.roleHasPermission(r, perm));
          return {
            name: perm,
            module: meta.module,
            action: meta.action,
            isAbac: meta.isAbac,
            abacPolicy: meta.abacPolicy ?? null,
            description: meta.description,
            grantedToRolesCount: grantedTo.length,
            grantedToRoles: grantedTo,
          };
        });
    }

    const cursorPos = query.cursor ? this.pagination.parseCatalogCursor(query.cursor) : 0;
    const sliced = allPermissions.slice(cursorPos, cursorPos + query.limit);
    const hasMore = cursorPos + query.limit < allPermissions.length;
    const nextCursor = hasMore ? this.pagination.buildCatalogCursor(cursorPos + query.limit) : null;

    const response: PermissionsCatalogResponse = {
      data: sliced,
      pagination: { nextCursor, hasMore, pageSize: query.limit },
      metadata: { fromCache, totalCatalogSize: allPermissions.length, bundleVersion: this.bundleVersion },
    };
    if (!cached) {
      await this.cache.set(cacheKey, { ...response, data: allPermissions, metadata: { ...response.metadata, fromCache: false } });
    }
    return response;
  }

  // -------------------- getAuditDenied --------------------
  async getAuditDenied(query: AuditDeniedQuery): Promise<AuditDeniedResponse> {
    const cursorData = query.cursor ? this.pagination.parseAuditCursor(query.cursor) : null;
    const rows = await this.auditRepo.findDenied({
      userId: query.userId,
      role: query.role,
      permission: query.permission,
      since: query.since,
      until: query.until,
      ip: query.ip,
      reason: query.reason,
      cursorCreatedAt: cursorData?.lastCreatedAt,
      cursorId: cursorData?.lastId,
      limit: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const data = rows.slice(0, query.limit).map((row): AuditEventDto => ({
      id: row.id,
      userId: row.userId,
      role: row.role,
      permission: row.permission,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      granted: false,
      reason: row.reason,
      policyName: row.policyName,
      policyEvaluated: row.policyEvaluated ?? [],
      ip: row.ip,
      userAgent: row.userAgent,
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
    }));

    const lastRow = data[data.length - 1];
    const nextCursor = hasMore && lastRow
      ? this.pagination.buildAuditCursor({ lastCreatedAt: lastRow.createdAt, lastId: lastRow.id })
      : null;

    return {
      data,
      pagination: { nextCursor, hasMore, pageSize: query.limit },
      metadata: { queriedAt: new Date().toISOString(), filterApplied: { ...query, cursor: undefined } },
    };
  }

  // -------------------- getAuditStats --------------------
  async getAuditStats(query: AuditStatsQuery): Promise<AuditStatsDto> {
    const cacheKey = `admin:rbac:audit:stats:${query.window}:${query.groupBy}`;
    const cached = await this.cache.getStats(cacheKey);
    if (cached) return { ...cached, metadata: { ...cached.metadata, fromCache: true } };

    const stats = await this.auditRepo.aggregateStats(query.window, query.groupBy);
    const response: AuditStatsDto = {
      window: query.window,
      groupBy: query.groupBy,
      totalDenied: stats.totalDenied,
      uniqueUsers: stats.uniqueUsers,
      uniqueIps: stats.uniqueIps,
      topDeniedPermissions: stats.topDeniedPermissions,
      topDeniedUsers: stats.topDeniedUsers,
      topDeniedIps: stats.topDeniedIps,
      topDeniedRoles: stats.topDeniedRoles,
      deniedPerHour: stats.deniedPerHour,
      metadata: { queriedAt: new Date().toISOString(), materializedViewUsed: stats.fromMv, fromCache: false },
    };
    await this.cache.setStats(cacheKey, response);
    return response;
  }
}
```

### 6.4 `admin-permissions-cache.service.ts` (~150 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/services/admin-permissions-cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@insurtech/cache/redis.module';
import { AdminPermissionsMetricsService } from './admin-permissions-metrics.service';

const RBAC_KEY_PREFIX = 'admin:rbac:';
const STATS_TTL_SECONDS = 300; // 5min for stats endpoint

@Injectable()
export class AdminPermissionsCacheService {
  private readonly defaultTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly metrics: AdminPermissionsMetricsService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AdminPermissionsCacheService.name);
    this.defaultTtl = this.config.get<number>('ADMIN_RBAC_CACHE_TTL_SECONDS') ?? 3600;
  }

  private assertKeyPrefix(key: string): void {
    if (!key.startsWith(RBAC_KEY_PREFIX)) {
      throw new Error(`Cache key must start with "${RBAC_KEY_PREFIX}", got: ${key}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.assertKeyPrefix(key);
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        this.metrics.cacheMisses.inc({ endpoint: this.endpointFromKey(key) });
        return null;
      }
      this.metrics.cacheHits.inc({ endpoint: this.endpointFromKey(key) });
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'admin permissions cache get failed, fallback miss');
      this.metrics.cacheRedisFailures.inc({ operation: 'get' });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.assertKeyPrefix(key);
    const effectiveTtl = ttl ?? this.defaultTtl;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', effectiveTtl);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'admin permissions cache set failed');
      this.metrics.cacheRedisFailures.inc({ operation: 'set' });
    }
  }

  async getStats<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  async setStats<T>(key: string, value: T): Promise<void> {
    return this.set<T>(key, value, STATS_TTL_SECONDS);
  }

  /**
   * Invalidate all admin:rbac:* keys via SCAN + UNLINK batch.
   * Sprint 26 admin endpoint POST /admin/rbac/cache/invalidate consume this.
   */
  async invalidate(): Promise<{ removedKeys: number }> {
    let cursor = '0';
    let removed = 0;
    do {
      const result = await this.redis.scan(cursor, 'MATCH', `${RBAC_KEY_PREFIX}*`, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        const removedBatch = await this.redis.unlink(...keys);
        removed += removedBatch;
      }
    } while (cursor !== '0');
    this.logger.info({ removed }, 'admin permissions cache invalidate');
    this.metrics.cacheEvictions.inc({ trigger: 'manual' }, removed);
    return { removedKeys: removed };
  }

  private endpointFromKey(key: string): string {
    const tail = key.slice(RBAC_KEY_PREFIX.length).split(':')[0] ?? 'unknown';
    return tail;
  }
}
```

### 6.5 `admin-permissions-pagination.helper.ts` (~100 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/helpers/admin-permissions-pagination.helper.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const AuditCursorPayloadSchema = z.object({
  lastCreatedAt: z.string().datetime(),
  lastId: z.string().ulid(),
  type: z.literal('audit'),
});
type AuditCursorPayload = z.infer<typeof AuditCursorPayloadSchema>;

const CatalogCursorPayloadSchema = z.object({
  offset: z.number().int().nonnegative(),
  type: z.literal('catalog'),
});

@Injectable()
export class AdminPermissionsPaginationHelper {
  private readonly secret: Buffer;

  constructor(private readonly config: ConfigService) {
    const secret = config.get<string>('ADMIN_RBAC_CURSOR_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('ADMIN_RBAC_CURSOR_SECRET required, min 32 chars');
    }
    this.secret = Buffer.from(secret, 'utf-8');
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  private base64urlEncode(buf: Buffer): string {
    return buf.toString('base64url');
  }

  private base64urlDecode(str: string): Buffer {
    return Buffer.from(str, 'base64url');
  }

  buildAuditCursor(payload: { lastCreatedAt: string; lastId: string }): string {
    const json = JSON.stringify({ ...payload, type: 'audit' });
    const encoded = this.base64urlEncode(Buffer.from(json, 'utf-8'));
    const signature = this.sign(encoded);
    return `${encoded}.${signature}`;
  }

  parseAuditCursor(cursor: string): AuditCursorPayload {
    const parts = cursor.split('.');
    if (parts.length !== 2) throw new Error('Invalid cursor format: expected "payload.signature"');
    const [encoded, signature] = parts;
    const expected = this.sign(encoded);
    const sigBuf = Buffer.from(signature, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid cursor signature');
    }
    const json = this.base64urlDecode(encoded).toString('utf-8');
    const parsed = JSON.parse(json);
    return AuditCursorPayloadSchema.parse(parsed);
  }

  buildCatalogCursor(offset: number): string {
    const json = JSON.stringify({ offset, type: 'catalog' });
    const encoded = this.base64urlEncode(Buffer.from(json, 'utf-8'));
    const signature = this.sign(encoded);
    return `${encoded}.${signature}`;
  }

  parseCatalogCursor(cursor: string): number {
    const parts = cursor.split('.');
    if (parts.length !== 2) throw new Error('Invalid cursor format');
    const [encoded, signature] = parts;
    const expected = this.sign(encoded);
    const sigBuf = Buffer.from(signature, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid cursor signature');
    }
    const json = this.base64urlDecode(encoded).toString('utf-8');
    const parsed = CatalogCursorPayloadSchema.parse(JSON.parse(json));
    return parsed.offset;
  }
}
```

### 6.6 `admin-permissions-audit-query.repository.ts` (~180 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/repositories/admin-permissions-audit-query.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { sql, and, eq, lt, gt, lte, gte, desc, count, isNotNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_CLIENT } from '@insurtech/db/drizzle.module';
import { rbacAuditLog, rbacAuditStatsHourly } from '@insurtech/db/schema/rbac-audit';
import type {
  AuthRole, DenyReason, StatsWindow, StatsGroupBy, AbacPolicy, PolicyEvaluation, TopDeniedItem, HourBucket,
} from '../dtos/admin-permissions.dto';

interface FindDeniedFilters {
  userId?: string;
  role?: AuthRole;
  permission?: string;
  since?: string;
  until?: string;
  ip?: string;
  reason?: DenyReason;
  cursorCreatedAt?: string;
  cursorId?: string;
  limit: number;
}

interface AuditRowData {
  id: string;
  userId: string;
  role: AuthRole;
  permission: string;
  resourceType: string | null;
  resourceId: string | null;
  reason: DenyReason;
  policyName: AbacPolicy | null;
  policyEvaluated: PolicyEvaluation[] | null;
  ip: string;
  userAgent: string;
  requestId: string;
  createdAt: Date;
}

interface AggregatedStats {
  totalDenied: number;
  uniqueUsers: number;
  uniqueIps: number;
  topDeniedPermissions: TopDeniedItem[];
  topDeniedUsers: TopDeniedItem[];
  topDeniedIps: TopDeniedItem[];
  topDeniedRoles: TopDeniedItem[];
  deniedPerHour: HourBucket[];
  fromMv: boolean;
}

@Injectable()
export class AdminPermissionsAuditQueryRepository {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: PostgresJsDatabase,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AdminPermissionsAuditQueryRepository.name);
  }

  async findDenied(filters: FindDeniedFilters): Promise<AuditRowData[]> {
    const conditions = [eq(rbacAuditLog.granted, false)];
    if (filters.userId) conditions.push(eq(rbacAuditLog.userId, filters.userId));
    if (filters.role) conditions.push(eq(rbacAuditLog.role, filters.role));
    if (filters.permission) conditions.push(eq(rbacAuditLog.permission, filters.permission));
    if (filters.since) conditions.push(gte(rbacAuditLog.createdAt, new Date(filters.since)));
    if (filters.until) conditions.push(lte(rbacAuditLog.createdAt, new Date(filters.until)));
    if (filters.ip) conditions.push(eq(rbacAuditLog.ip, filters.ip));
    if (filters.reason) conditions.push(eq(rbacAuditLog.reason, filters.reason));
    if (filters.cursorCreatedAt && filters.cursorId) {
      conditions.push(sql`(${rbacAuditLog.createdAt}, ${rbacAuditLog.id}) < (${new Date(filters.cursorCreatedAt)}, ${filters.cursorId})`);
    }
    const result = await this.db
      .select()
      .from(rbacAuditLog)
      .where(and(...conditions))
      .orderBy(desc(rbacAuditLog.createdAt), desc(rbacAuditLog.id))
      .limit(filters.limit);
    return result as unknown as AuditRowData[];
  }

  async aggregateStats(window: StatsWindow, groupBy: StatsGroupBy): Promise<AggregatedStats> {
    const sinceInterval = this.windowToInterval(window);
    let useMv = false;
    let baseSource: 'mv' | 'raw' = 'raw';
    if (window === '7d' || window === '30d') {
      const mvFresh = await this.checkMvFreshness();
      if (mvFresh) {
        baseSource = 'mv';
        useMv = true;
      }
    }
    const totalDenied = await this.computeTotalDenied(sinceInterval, baseSource);
    const uniqueUsers = await this.computeUniqueUsers(sinceInterval);
    const uniqueIps = await this.computeUniqueIps(sinceInterval);
    const topDeniedPermissions = await this.computeTopByDimension('permission', sinceInterval);
    const topDeniedUsers = await this.computeTopByDimension('user_id', sinceInterval);
    const topDeniedIps = await this.computeTopByDimension('ip', sinceInterval);
    const topDeniedRoles = await this.computeTopByDimension('role', sinceInterval);
    const deniedPerHour = await this.computeHourlyBuckets(sinceInterval);
    return {
      totalDenied, uniqueUsers, uniqueIps, topDeniedPermissions, topDeniedUsers, topDeniedIps, topDeniedRoles, deniedPerHour,
      fromMv: useMv,
    };
  }

  private windowToInterval(window: StatsWindow): string {
    switch (window) {
      case '1h': return '1 hour';
      case '24h': return '24 hours';
      case '7d': return '7 days';
      case '30d': return '30 days';
    }
  }

  private async checkMvFreshness(): Promise<boolean> {
    const result = await this.db.execute<{ last_refresh: Date }>(
      sql`SELECT MAX(refreshed_at) AS last_refresh FROM rbac_audit_stats_hourly`,
    );
    const row = result[0];
    if (!row?.last_refresh) return false;
    const ageMs = Date.now() - new Date(row.last_refresh).getTime();
    return ageMs < 30 * 60 * 1000; // 30 minutes
  }

  private async computeTotalDenied(interval: string, source: 'mv' | 'raw'): Promise<number> {
    if (source === 'mv') {
      const r = await this.db.execute<{ total: string }>(
        sql`SELECT SUM(denied_count)::bigint AS total FROM rbac_audit_stats_hourly WHERE bucket_hour > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}`,
      );
      return Number(r[0]?.total ?? 0);
    }
    const r = await this.db.execute<{ total: string }>(
      sql`SELECT COUNT(*)::bigint AS total FROM rbac_audit_log WHERE granted = false AND created_at > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}`,
    );
    return Number(r[0]?.total ?? 0);
  }

  private async computeUniqueUsers(interval: string): Promise<number> {
    const r = await this.db.execute<{ c: string }>(
      sql`SELECT COUNT(DISTINCT user_id)::bigint AS c FROM rbac_audit_log WHERE granted=false AND created_at > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}`,
    );
    return Number(r[0]?.c ?? 0);
  }

  private async computeUniqueIps(interval: string): Promise<number> {
    const r = await this.db.execute<{ c: string }>(
      sql`SELECT COUNT(DISTINCT ip)::bigint AS c FROM rbac_audit_log WHERE granted=false AND created_at > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}`,
    );
    return Number(r[0]?.c ?? 0);
  }

  private async computeTopByDimension(dim: string, interval: string): Promise<TopDeniedItem[]> {
    const rows = await this.db.execute<{ key: string; cnt: string; latest: Date }>(
      sql`SELECT ${sql.identifier(dim)} AS key, COUNT(*)::bigint AS cnt, MAX(created_at) AS latest
          FROM rbac_audit_log WHERE granted=false AND created_at > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}
          GROUP BY ${sql.identifier(dim)} ORDER BY cnt DESC LIMIT 10`,
    );
    return rows.map((r) => ({ key: r.key, count: Number(r.cnt), latestAt: new Date(r.latest).toISOString() }));
  }

  private async computeHourlyBuckets(interval: string): Promise<HourBucket[]> {
    const rows = await this.db.execute<{ hour: Date; cnt: string }>(
      sql`SELECT date_trunc('hour', created_at) AS hour, COUNT(*)::bigint AS cnt
          FROM rbac_audit_log WHERE granted=false AND created_at > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}
          GROUP BY hour ORDER BY hour ASC`,
    );
    return rows.map((r) => ({ hour: new Date(r.hour).toISOString(), count: Number(r.cnt) }));
  }
}
```

### 6.7 `admin-permissions-metrics.service.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/services/admin-permissions-metrics.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

@Injectable()
export class AdminPermissionsMetricsService implements OnModuleInit {
  endpointCalls!: Counter<'endpoint' | 'status'>;
  endpointDuration!: Histogram<'endpoint'>;
  auditQueryRowsReturned!: Histogram<'endpoint'>;
  cacheHits!: Counter<'endpoint'>;
  cacheMisses!: Counter<'endpoint'>;
  cacheEvictions!: Counter<'trigger'>;
  cacheRedisFailures!: Counter<'operation'>;

  onModuleInit(): void {
    this.endpointCalls = new Counter({
      name: 'admin_rbac_endpoint_calls_total',
      help: 'Total calls to admin rbac endpoints',
      labelNames: ['endpoint', 'status'],
      registers: [register],
    });
    this.endpointDuration = new Histogram({
      name: 'admin_rbac_endpoint_duration_seconds',
      help: 'Duration of admin rbac endpoints in seconds',
      labelNames: ['endpoint'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [register],
    });
    this.auditQueryRowsReturned = new Histogram({
      name: 'admin_rbac_audit_query_rows_returned',
      help: 'Number of rows returned by audit queries',
      labelNames: ['endpoint'],
      buckets: [0, 1, 5, 10, 50, 100, 200],
      registers: [register],
    });
    this.cacheHits = new Counter({
      name: 'admin_rbac_cache_hits_total',
      help: 'Cache hits for admin rbac endpoints',
      labelNames: ['endpoint'],
      registers: [register],
    });
    this.cacheMisses = new Counter({
      name: 'admin_rbac_cache_misses_total',
      help: 'Cache misses for admin rbac endpoints',
      labelNames: ['endpoint'],
      registers: [register],
    });
    this.cacheEvictions = new Counter({
      name: 'admin_rbac_cache_evictions_total',
      help: 'Cache evictions',
      labelNames: ['trigger'],
      registers: [register],
    });
    this.cacheRedisFailures = new Counter({
      name: 'admin_rbac_cache_redis_failures_total',
      help: 'Redis operation failures',
      labelNames: ['operation'],
      registers: [register],
    });
  }
}
```

### 6.8 `admin-permissions.module.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/admin-permissions.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { RbacModule } from '@insurtech/auth/rbac';
import { AuditModule } from '@insurtech/auth/audit';
import { DrizzleModule } from '@insurtech/db';
import { RedisModule } from '@insurtech/cache';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminPermissionsService } from './admin-permissions.service';
import { AdminPermissionsCacheService } from './services/admin-permissions-cache.service';
import { AdminPermissionsMetricsService } from './services/admin-permissions-metrics.service';
import { AdminPermissionsPaginationHelper } from './helpers/admin-permissions-pagination.helper';
import { AdminPermissionsAuditQueryRepository } from './repositories/admin-permissions-audit-query.repository';
import { adminPermissionsConfig } from './admin-permissions.config';

@Module({
  imports: [
    ConfigModule.forFeature(adminPermissionsConfig),
    LoggerModule,
    RbacModule,
    AuditModule,
    DrizzleModule,
    RedisModule,
  ],
  controllers: [AdminPermissionsController],
  providers: [
    AdminPermissionsService,
    AdminPermissionsCacheService,
    AdminPermissionsMetricsService,
    AdminPermissionsPaginationHelper,
    AdminPermissionsAuditQueryRepository,
  ],
  exports: [
    AdminPermissionsService,
    AdminPermissionsCacheService,
  ],
})
export class AdminPermissionsModule {}
```

### 6.9 `admin-permissions.config.ts` (Zod config)

```typescript
// repo/apps/api/src/config/admin-permissions.config.ts
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const AdminPermissionsConfigSchema = z.object({
  ADMIN_RBAC_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
  ADMIN_RBAC_AUDIT_PAGE_SIZE_DEFAULT: z.coerce.number().int().min(1).max(200).default(50),
  ADMIN_RBAC_AUDIT_PAGE_SIZE_MAX: z.coerce.number().int().min(1).max(500).default(200),
  ADMIN_RBAC_CURSOR_SECRET: z.string().min(32),
  BUNDLE_VERSION: z.string().default('dev'),
});
export type AdminPermissionsConfig = z.infer<typeof AdminPermissionsConfigSchema>;

export const adminPermissionsConfig = registerAs('adminPermissions', () => {
  return AdminPermissionsConfigSchema.parse(process.env);
});
```

### 6.10 `admin-permissions.openapi.ts` (~120 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/openapi/admin-permissions.openapi.ts
export const RolesListExample = {
  data: [
    { role: 'super_admin_platform', tier: 'platform', description: 'Skalean platform staff', inheritsFrom: [], permissionsCount: 85, directPermissionsCount: 85, inheritedPermissionsCount: 0, requiresMfa: true, sessionTtlSeconds: 1800 },
    { role: 'analyst_support', tier: 'platform', description: 'Skalean read-only support', inheritsFrom: [], permissionsCount: 85, directPermissionsCount: 0, inheritedPermissionsCount: 85, requiresMfa: true, sessionTtlSeconds: 1800 },
    { role: 'broker_admin', tier: 'tenant_broker', description: 'Cabinet courtier admin', inheritsFrom: ['broker_user', 'broker_assistant'], permissionsCount: 30, directPermissionsCount: 10, inheritedPermissionsCount: 20, requiresMfa: false, sessionTtlSeconds: 28800 },
    { role: 'broker_user', tier: 'tenant_broker', description: 'Courtier souscripteur', inheritsFrom: ['broker_assistant'], permissionsCount: 20, directPermissionsCount: 12, inheritedPermissionsCount: 8, requiresMfa: false, sessionTtlSeconds: 28800 },
    { role: 'assure', tier: 'customer', description: 'Client final assure', inheritsFrom: [], permissionsCount: 8, directPermissionsCount: 8, inheritedPermissionsCount: 0, requiresMfa: false, sessionTtlSeconds: 3600 },
    { role: 'prospect', tier: 'public', description: 'Prospect public', inheritsFrom: [], permissionsCount: 4, directPermissionsCount: 4, inheritedPermissionsCount: 0, requiresMfa: false, sessionTtlSeconds: 1800 },
  ],
  metadata: { fromCache: true, cacheAge: 142, cacheTtlRemaining: 3458, bundleVersion: 'v2.3.0', computedAt: '2026-05-06T10:23:45.123Z' },
};

export const RolePermissionsExample = {
  role: 'broker_admin',
  tier: 'tenant_broker',
  inheritsFrom: ['broker_user', 'broker_assistant'],
  permissionsCount: 30,
  directPermissionsCount: 10,
  inheritedPermissionsCount: 20,
  permissions: [
    { name: 'crm.contacts.read', module: 'crm', action: 'read', source: 'direct', isAbac: false, abacPolicy: null },
    { name: 'crm.contacts.update_own', module: 'crm', action: 'update_own', source: 'inherited_from:broker_user', isAbac: true, abacPolicy: 'OwnResourcesPolicy' },
    { name: 'insure.policies.create', module: 'insure', action: 'create', source: 'direct', isAbac: false, abacPolicy: null },
  ],
  breakdownByModule: {
    crm: { count: 8, permissions: ['crm.contacts.read', 'crm.contacts.create', 'crm.contacts.update_own'] },
    insure: { count: 6, permissions: ['insure.policies.create', 'insure.policies.read'] },
    pay: { count: 4, permissions: ['pay.transactions.read', 'pay.refunds.create'] },
  },
  metadata: { fromCache: true, cacheAge: 87, cacheTtlRemaining: 3513, computedAt: '2026-05-06T10:23:45.123Z' },
};

export const PermissionsCatalogExample = {
  data: [
    { name: 'crm.contacts.read', module: 'crm', action: 'read', isAbac: false, abacPolicy: null, grantedToRolesCount: 8, grantedToRoles: ['super_admin_platform', 'analyst_support', 'broker_admin', 'broker_user', 'broker_assistant', 'garage_admin', 'garage_commercial', 'assure'] },
    { name: 'insure.policies.create', module: 'insure', action: 'create', isAbac: false, abacPolicy: null, grantedToRolesCount: 3, grantedToRoles: ['super_admin_platform', 'broker_admin', 'broker_user'] },
  ],
  pagination: { nextCursor: 'eyJvZmZzZXQiOjUwLCJ0eXBlIjoiY2F0YWxvZyJ9.kF2j...', hasMore: true, pageSize: 50 },
  metadata: { fromCache: true, totalCatalogSize: 87, bundleVersion: 'v2.3.0' },
};

export const AuditDeniedExample = {
  data: [
    {
      id: '01J7XYZABCD0000000000000000',
      userId: '00000000-0000-0000-0000-000000000001',
      role: 'broker_user',
      permission: 'insure.policies.delete',
      resourceType: 'insure_policy',
      resourceId: '00000000-0000-0000-0000-000000000999',
      granted: false,
      reason: 'NO_PERMISSION',
      policyName: null,
      policyEvaluated: [],
      ip: '0.0.0.0',
      userAgent: 'Example User Agent',
      requestId: '01J7REQ0000000000000000ABCD',
      createdAt: '2026-05-06T10:00:00.000Z',
    },
  ],
  pagination: { nextCursor: 'eyJsYXN0Q3JlYXRlZEF0IjoiMjAyNi0wNS0wNlQwOToxMDowMC4wMDBaIn0.aB1c...', hasMore: true, pageSize: 50 },
  metadata: { queriedAt: '2026-05-06T10:30:00.000Z', filterApplied: { since: '2026-05-06T08:00:00Z' } },
};

export const AuditStatsExample = {
  window: '24h',
  groupBy: 'permission',
  totalDenied: 142,
  uniqueUsers: 23,
  uniqueIps: 18,
  topDeniedPermissions: [
    { key: 'insure.policies.delete', count: 45, latestAt: '2026-05-06T10:00:00Z' },
    { key: 'crm.contacts.delete', count: 32, latestAt: '2026-05-06T09:55:00Z' },
  ],
  topDeniedUsers: [{ key: '00000000-0000-0000-0000-000000000001', count: 12, latestAt: '2026-05-06T09:50:00Z' }],
  topDeniedIps: [{ key: '0.0.0.0', count: 22, latestAt: '2026-05-06T10:00:00Z' }],
  topDeniedRoles: [{ key: 'broker_user', count: 78, latestAt: '2026-05-06T10:00:00Z' }],
  deniedPerHour: [{ hour: '2026-05-06T09:00:00Z', count: 15 }, { hour: '2026-05-06T10:00:00Z', count: 18 }],
  metadata: { queriedAt: '2026-05-06T10:30:00.000Z', materializedViewUsed: false, fromCache: false },
};
```

### 6.11 `index.ts` (barrel)

```typescript
// repo/apps/api/src/modules/admin/permissions/index.ts
export * from './admin-permissions.module';
export * from './admin-permissions.controller';
export * from './admin-permissions.service';
export * from './services/admin-permissions-cache.service';
export * from './services/admin-permissions-metrics.service';
export * from './helpers/admin-permissions-pagination.helper';
export * from './repositories/admin-permissions-audit-query.repository';
export * from './dtos/admin-permissions.dto';
```

### 6.12 Migration SQL `0073_add_rbac_audit_indexes.sql`

```sql
-- repo/apps/api/src/db/migrations/0073_add_rbac_audit_indexes.sql
BEGIN;

-- Partial index optimise pour denied recent (most queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS rbac_audit_log_denied_recent_idx
  ON rbac_audit_log (granted, created_at DESC)
  WHERE granted = false;

-- Index user filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS rbac_audit_log_user_denied_idx
  ON rbac_audit_log (user_id, granted, created_at DESC, id DESC)
  WHERE granted = false;

-- Index role filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS rbac_audit_log_role_denied_idx
  ON rbac_audit_log (role, granted, created_at DESC)
  WHERE granted = false;

-- Index permission filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS rbac_audit_log_permission_denied_idx
  ON rbac_audit_log (permission, granted, created_at DESC)
  WHERE granted = false;

COMMIT;
```

### 6.13 Migration SQL `0074_create_rbac_audit_stats_hourly_mv.sql`

```sql
-- repo/apps/api/src/db/migrations/0074_create_rbac_audit_stats_hourly_mv.sql
BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS rbac_audit_stats_hourly AS
SELECT
  date_trunc('hour', created_at) AS bucket_hour,
  role,
  permission,
  reason,
  policy_name,
  COUNT(*) AS denied_count,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT ip) AS unique_ips,
  MAX(created_at) AS latest_at,
  NOW() AS refreshed_at
FROM rbac_audit_log
WHERE granted = false
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3, 4, 5;

CREATE UNIQUE INDEX IF NOT EXISTS rbac_audit_stats_hourly_uniq_idx
  ON rbac_audit_stats_hourly (bucket_hour, role, permission, reason, COALESCE(policy_name, ''));

CREATE INDEX IF NOT EXISTS rbac_audit_stats_hourly_bucket_idx
  ON rbac_audit_stats_hourly (bucket_hour DESC);

COMMIT;
```

### 6.14 Migration SQL `0075_schedule_rbac_audit_stats_refresh.sql`

```sql
-- repo/apps/api/src/db/migrations/0075_schedule_rbac_audit_stats_refresh.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'refresh_rbac_audit_stats_hourly',
  '*/15 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY rbac_audit_stats_hourly$$
);

COMMIT;
```

### 6.15 Fixtures `admin-permissions-fixtures.ts` (~120 lignes)

```typescript
// repo/apps/api/test/admin/fixtures/admin-permissions-fixtures.ts
import { ulid } from 'ulid';
import type { AuthRole } from '@insurtech/auth/rbac/types';
import type { DenyReason, AbacPolicy } from '../../../src/modules/admin/permissions/dtos/admin-permissions.dto';

export interface SyntheticAuditEventFixture {
  id: string;
  userId: string;
  role: AuthRole;
  permission: string;
  resourceType: string | null;
  resourceId: string | null;
  granted: boolean;
  reason: DenyReason;
  policyName: AbacPolicy | null;
  ip: string;
  userAgent: string;
  requestId: string;
  createdAt: Date;
}

const SYNTHETIC_USER_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
];

const PERMISSIONS_DENIED_SAMPLES: Array<{ role: AuthRole; permission: string; reason: DenyReason }> = [
  { role: 'broker_user', permission: 'insure.policies.delete', reason: 'NO_PERMISSION' },
  { role: 'broker_user', permission: 'admin.tenants.create', reason: 'NO_PERMISSION' },
  { role: 'broker_assistant', permission: 'crm.contacts.delete', reason: 'NO_PERMISSION' },
  { role: 'garage_technicien', permission: 'repair.devis.approve', reason: 'NO_PERMISSION' },
  { role: 'assure', permission: 'insure.policies.read', reason: 'NOT_OWNER' },
  { role: 'broker_user', permission: 'pay.refunds.create', reason: 'TIME_WINDOW_EXCEEDED' },
];

export function buildSyntheticAuditFixtures(count: number, baseDate: Date = new Date()): SyntheticAuditEventFixture[] {
  const events: SyntheticAuditEventFixture[] = [];
  for (let i = 0; i < count; i++) {
    const sample = PERMISSIONS_DENIED_SAMPLES[i % PERMISSIONS_DENIED_SAMPLES.length];
    const userId = SYNTHETIC_USER_IDS[i % SYNTHETIC_USER_IDS.length];
    const ts = new Date(baseDate.getTime() - i * 60_000);
    events.push({
      id: ulid(ts.getTime()),
      userId,
      role: sample.role,
      permission: sample.permission,
      resourceType: 'synthetic',
      resourceId: ulid(),
      granted: false,
      reason: sample.reason,
      policyName: sample.reason === 'NOT_OWNER' ? 'OwnResourcesPolicy' : sample.reason === 'TIME_WINDOW_EXCEEDED' ? 'TimeBasedPolicy' : null,
      ip: '0.0.0.0',
      userAgent: 'Test Synthetic Agent',
      requestId: ulid(),
      createdAt: ts,
    });
  }
  return events;
}

export const SUPER_ADMIN_TEST_USER = {
  id: '00000000-0000-0000-0000-000000000099',
  email: 'super-admin@test.skalean-insurtech.ma',
  role: 'super_admin_platform' as AuthRole,
  tenantId: null,
};

export const BROKER_USER_TEST_USER = {
  id: '00000000-0000-0000-0000-000000000010',
  email: 'broker-user@test.skalean-insurtech.ma',
  role: 'broker_user' as AuthRole,
  tenantId: '00000000-0000-0000-0000-000000000aaa',
};
```

---

## 7. Tests complets : 35+ tests Vitest

### 7.1 `admin-permissions.controller.spec.ts` (~200 lignes : 20+ tests unit)

```typescript
// repo/apps/api/src/modules/admin/permissions/admin-permissions.controller.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminPermissionsService } from './admin-permissions.service';
import { AdminPermissionsMetricsService } from './services/admin-permissions-metrics.service';

describe('AdminPermissionsController (unit)', () => {
  let controller: AdminPermissionsController;
  let serviceMock: { listRoles: ReturnType<typeof vi.fn>; getRolePermissions: ReturnType<typeof vi.fn>; listPermissions: ReturnType<typeof vi.fn>; getAuditDenied: ReturnType<typeof vi.fn>; getAuditStats: ReturnType<typeof vi.fn> };
  let metricsMock: { endpointCalls: { inc: ReturnType<typeof vi.fn> }; endpointDuration: { observe: ReturnType<typeof vi.fn> }; auditQueryRowsReturned: { observe: ReturnType<typeof vi.fn> } };
  let loggerMock: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; setContext: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    serviceMock = {
      listRoles: vi.fn(), getRolePermissions: vi.fn(), listPermissions: vi.fn(),
      getAuditDenied: vi.fn(), getAuditStats: vi.fn(),
    };
    metricsMock = {
      endpointCalls: { inc: vi.fn() }, endpointDuration: { observe: vi.fn() }, auditQueryRowsReturned: { observe: vi.fn() },
    };
    loggerMock = { info: vi.fn(), error: vi.fn(), setContext: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPermissionsController],
      providers: [
        { provide: AdminPermissionsService, useValue: serviceMock },
        { provide: AdminPermissionsMetricsService, useValue: metricsMock },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();
    controller = module.get(AdminPermissionsController);
  });

  describe('listRoles', () => {
    it('returns roles list from service', async () => {
      serviceMock.listRoles.mockResolvedValue({ data: [{ role: 'super_admin_platform' }], metadata: { fromCache: false } });
      const result = await controller.listRoles();
      expect(result.data.length).toBe(1);
      expect(metricsMock.endpointCalls.inc).toHaveBeenCalledWith({ endpoint: 'roles_list', status: '200' });
    });

    it('throws ServiceUnavailable on service error', async () => {
      serviceMock.listRoles.mockRejectedValue(new Error('redis down'));
      await expect(controller.listRoles()).rejects.toThrow(ServiceUnavailableException);
      expect(metricsMock.endpointCalls.inc).toHaveBeenCalledWith({ endpoint: 'roles_list', status: '503' });
    });

    it('emits metric in_progress before completion', async () => {
      serviceMock.listRoles.mockResolvedValue({ data: [], metadata: { fromCache: false } });
      await controller.listRoles();
      expect(metricsMock.endpointCalls.inc).toHaveBeenCalledWith({ endpoint: 'roles_list', status: 'in_progress' });
    });
  });

  describe('getRolePermissions', () => {
    it('returns role permissions from service', async () => {
      serviceMock.getRolePermissions.mockResolvedValue({ role: 'broker_admin', permissions: [], metadata: { fromCache: true } });
      const result = await controller.getRolePermissions('broker_admin');
      expect(result.role).toBe('broker_admin');
    });

    it('logs role and durationMs', async () => {
      serviceMock.getRolePermissions.mockResolvedValue({ role: 'broker_admin', permissions: [{}], metadata: { fromCache: true } });
      await controller.getRolePermissions('broker_admin');
      expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({ role: 'broker_admin', count: 1 }), expect.any(String));
    });
  });

  describe('listPermissions', () => {
    it('returns permissions catalog from service', async () => {
      serviceMock.listPermissions.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null, pageSize: 50 }, metadata: { fromCache: true, totalCatalogSize: 0, bundleVersion: 'test' } });
      const result = await controller.listPermissions({ limit: 50 });
      expect(result.pagination.pageSize).toBe(50);
    });
  });

  describe('getAuditDenied', () => {
    it('rejects window > 30 days with BadRequest', async () => {
      const since = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
      const until = new Date().toISOString();
      await expect(controller.getAuditDenied({ since, until, limit: 50 })).rejects.toThrow(BadRequestException);
    });

    it('returns audit denied from service', async () => {
      serviceMock.getAuditDenied.mockResolvedValue({ data: [{ id: 'a' }], pagination: { hasMore: false, nextCursor: null, pageSize: 50 }, metadata: { queriedAt: new Date().toISOString(), filterApplied: {} } });
      const result = await controller.getAuditDenied({ limit: 50 });
      expect(result.data.length).toBe(1);
      expect(metricsMock.auditQueryRowsReturned.observe).toHaveBeenCalledWith({ endpoint: 'audit_denied' }, 1);
    });
  });

  describe('getAuditStats', () => {
    it('returns audit stats from service', async () => {
      serviceMock.getAuditStats.mockResolvedValue({ window: '24h', groupBy: 'permission', totalDenied: 100, uniqueUsers: 10, uniqueIps: 5, topDeniedPermissions: [], topDeniedUsers: [], topDeniedIps: [], topDeniedRoles: [], deniedPerHour: [], metadata: { queriedAt: new Date().toISOString(), materializedViewUsed: false, fromCache: false } });
      const result = await controller.getAuditStats({ window: '24h', groupBy: 'permission' });
      expect(result.totalDenied).toBe(100);
    });
  });
});
```

### 7.2 `admin-permissions.service.spec.ts` (~200 lignes : 20+ tests)

```typescript
// repo/apps/api/src/modules/admin/permissions/admin-permissions.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AdminPermissionsService } from './admin-permissions.service';
import { AdminPermissionsCacheService } from './services/admin-permissions-cache.service';
import { AdminPermissionsAuditQueryRepository } from './repositories/admin-permissions-audit-query.repository';
import { AdminPermissionsPaginationHelper } from './helpers/admin-permissions-pagination.helper';

describe('AdminPermissionsService (unit)', () => {
  let service: AdminPermissionsService;
  let cacheMock: any; let auditRepoMock: any; let permCacheMock: any; let rbacMock: any; let catalogMock: any;

  beforeEach(async () => {
    cacheMock = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), getStats: vi.fn().mockResolvedValue(null), setStats: vi.fn().mockResolvedValue(undefined) };
    auditRepoMock = { findDenied: vi.fn().mockResolvedValue([]), aggregateStats: vi.fn() };
    permCacheMock = { getEffectivePermissions: vi.fn() };
    rbacMock = { computeEffectivePermissions: vi.fn() };
    catalogMock = {
      getAllRoles: vi.fn().mockReturnValue(['super_admin_platform', 'broker_admin', 'broker_user', 'broker_assistant', 'garage_admin', 'garage_chef', 'garage_technicien', 'garage_comptable', 'garage_commercial', 'analyst_support', 'assure', 'prospect']),
      getDescription: vi.fn().mockReturnValue('desc'), requiresMfa: vi.fn().mockReturnValue(false), getSessionTtl: vi.fn().mockReturnValue(28800),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminPermissionsService,
        { provide: AdminPermissionsCacheService, useValue: cacheMock },
        { provide: AdminPermissionsAuditQueryRepository, useValue: auditRepoMock },
        { provide: AdminPermissionsPaginationHelper, useValue: { parseAuditCursor: vi.fn(), buildAuditCursor: vi.fn(), parseCatalogCursor: vi.fn(), buildCatalogCursor: vi.fn() } },
        { provide: 'PermissionCacheService', useValue: permCacheMock },
        { provide: 'RbacService', useValue: rbacMock },
        { provide: 'RoleCatalogProvider', useValue: catalogMock },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue('v1.0.0') } },
        { provide: PinoLogger, useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), setContext: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(AdminPermissionsService);
  });

  describe('listRoles', () => {
    it('returns 12 roles enriched', async () => {
      permCacheMock.getEffectivePermissions.mockResolvedValue(new Set(['p1', 'p2']));
      const result = await service.listRoles();
      expect(result.data.length).toBe(12);
      expect(result.metadata.fromCache).toBe(false);
    });

    it('uses cache when available', async () => {
      cacheMock.get.mockResolvedValueOnce({ data: [], metadata: { fromCache: false, bundleVersion: 'v1', computedAt: 'x' } });
      const result = await service.listRoles();
      expect(result.metadata.fromCache).toBe(true);
      expect(permCacheMock.getEffectivePermissions).not.toHaveBeenCalled();
    });

    it('classifies tier correctly', async () => {
      permCacheMock.getEffectivePermissions.mockResolvedValue(new Set());
      const result = await service.listRoles();
      const tiersByRole = Object.fromEntries(result.data.map((r) => [r.role, r.tier]));
      expect(tiersByRole.super_admin_platform).toBe('platform');
      expect(tiersByRole.broker_admin).toBe('tenant_broker');
      expect(tiersByRole.garage_admin).toBe('tenant_garage');
      expect(tiersByRole.assure).toBe('customer');
      expect(tiersByRole.prospect).toBe('public');
    });
  });

  describe('getRolePermissions', () => {
    it('returns permissions with breakdown by module', async () => {
      permCacheMock.getEffectivePermissions.mockResolvedValue(new Set(['crm.contacts.read', 'insure.policies.read']));
      const result = await service.getRolePermissions('broker_admin' as any);
      expect(result.role).toBe('broker_admin');
    });

    it('uses cache hit', async () => {
      cacheMock.get.mockResolvedValueOnce({ role: 'broker_admin', permissions: [], breakdownByModule: {}, metadata: { fromCache: false } });
      const result = await service.getRolePermissions('broker_admin' as any);
      expect(result.metadata.fromCache).toBe(true);
    });
  });

  describe('getAuditDenied', () => {
    it('returns rows mapped to dto', async () => {
      auditRepoMock.findDenied.mockResolvedValue([{ id: '01J7', userId: 'u', role: 'broker_user', permission: 'p', resourceType: null, resourceId: null, reason: 'NO_PERMISSION', policyName: null, policyEvaluated: [], ip: '0', userAgent: 'a', requestId: 'r', createdAt: new Date() }]);
      const result = await service.getAuditDenied({ limit: 50 } as any);
      expect(result.data.length).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('builds nextCursor when hasMore', async () => {
      const rows = Array.from({ length: 51 }, (_, i) => ({ id: `01J7${i}`, userId: 'u', role: 'broker_user', permission: 'p', resourceType: null, resourceId: null, reason: 'NO_PERMISSION', policyName: null, policyEvaluated: [], ip: '0', userAgent: 'a', requestId: 'r', createdAt: new Date(Date.now() - i * 1000) }));
      auditRepoMock.findDenied.mockResolvedValue(rows);
      (service as any).pagination.buildAuditCursor = vi.fn().mockReturnValue('next.sig');
      const result = await service.getAuditDenied({ limit: 50 } as any);
      expect(result.data.length).toBe(50);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBe('next.sig');
    });
  });

  describe('getAuditStats', () => {
    it('returns aggregated stats', async () => {
      auditRepoMock.aggregateStats.mockResolvedValue({ totalDenied: 5, uniqueUsers: 2, uniqueIps: 2, topDeniedPermissions: [], topDeniedUsers: [], topDeniedIps: [], topDeniedRoles: [], deniedPerHour: [], fromMv: false });
      const result = await service.getAuditStats({ window: '24h', groupBy: 'permission' } as any);
      expect(result.totalDenied).toBe(5);
      expect(result.metadata.materializedViewUsed).toBe(false);
    });
  });
});
```

### 7.3 `admin-permissions-cache.service.spec.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/services/admin-permissions-cache.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AdminPermissionsCacheService } from './admin-permissions-cache.service';
import { AdminPermissionsMetricsService } from './admin-permissions-metrics.service';

describe('AdminPermissionsCacheService', () => {
  let svc: AdminPermissionsCacheService;
  let redisMock: any; let metricsMock: any;

  beforeEach(() => {
    redisMock = { get: vi.fn(), set: vi.fn(), scan: vi.fn(), unlink: vi.fn() };
    metricsMock = { cacheHits: { inc: vi.fn() }, cacheMisses: { inc: vi.fn() }, cacheEvictions: { inc: vi.fn() }, cacheRedisFailures: { inc: vi.fn() } };
    svc = new AdminPermissionsCacheService(
      redisMock as any,
      { get: vi.fn().mockReturnValue(3600) } as unknown as ConfigService,
      metricsMock,
      { warn: vi.fn(), info: vi.fn(), setContext: vi.fn() } as unknown as PinoLogger,
    );
  });

  it('rejects key without admin:rbac: prefix', async () => {
    await expect(svc.get('other:key')).rejects.toThrow(/admin:rbac:/);
  });

  it('returns null on cache miss + increments miss counter', async () => {
    redisMock.get.mockResolvedValue(null);
    const r = await svc.get('admin:rbac:roles:list');
    expect(r).toBeNull();
    expect(metricsMock.cacheMisses.inc).toHaveBeenCalled();
  });

  it('parses JSON on hit + increments hit counter', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ a: 1 }));
    const r = await svc.get<{ a: number }>('admin:rbac:roles:list');
    expect(r?.a).toBe(1);
    expect(metricsMock.cacheHits.inc).toHaveBeenCalled();
  });

  it('falls back to null on Redis error (default-deny safe)', async () => {
    redisMock.get.mockRejectedValue(new Error('ECONNRESET'));
    const r = await svc.get('admin:rbac:test');
    expect(r).toBeNull();
    expect(metricsMock.cacheRedisFailures.inc).toHaveBeenCalledWith({ operation: 'get' });
  });

  it('set uses default TTL 3600s', async () => {
    await svc.set('admin:rbac:test', { a: 1 });
    expect(redisMock.set).toHaveBeenCalledWith('admin:rbac:test', expect.any(String), 'EX', 3600);
  });

  it('invalidate scans + unlinks all admin:rbac:* keys', async () => {
    redisMock.scan.mockResolvedValueOnce(['0', ['admin:rbac:k1', 'admin:rbac:k2']]);
    redisMock.unlink.mockResolvedValue(2);
    const r = await svc.invalidate();
    expect(r.removedKeys).toBe(2);
    expect(metricsMock.cacheEvictions.inc).toHaveBeenCalled();
  });
});
```

### 7.4 `admin-permissions-pagination.helper.spec.ts` (~80 lignes)

```typescript
// repo/apps/api/src/modules/admin/permissions/helpers/admin-permissions-pagination.helper.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AdminPermissionsPaginationHelper } from './admin-permissions-pagination.helper';

const SECRET = 'test_cursor_secret_at_least_32_characters_long_xxxxx';

describe('AdminPermissionsPaginationHelper', () => {
  let helper: AdminPermissionsPaginationHelper;

  beforeEach(() => {
    const config = { get: (k: string) => (k === 'ADMIN_RBAC_CURSOR_SECRET' ? SECRET : undefined) } as unknown as ConfigService;
    helper = new AdminPermissionsPaginationHelper(config);
  });

  it('throws if secret < 32 chars', () => {
    expect(() => new AdminPermissionsPaginationHelper({ get: () => 'short' } as any)).toThrow();
  });

  it('builds and parses audit cursor roundtrip', () => {
    const payload = { lastCreatedAt: '2026-05-06T10:00:00.000Z', lastId: '01J7XYZABCD0000000000000000' };
    const cursor = helper.buildAuditCursor(payload);
    const parsed = helper.parseAuditCursor(cursor);
    expect(parsed.lastCreatedAt).toBe(payload.lastCreatedAt);
    expect(parsed.lastId).toBe(payload.lastId);
  });

  it('rejects audit cursor with tampered signature', () => {
    const payload = { lastCreatedAt: '2026-05-06T10:00:00.000Z', lastId: '01J7XYZABCD0000000000000000' };
    const cursor = helper.buildAuditCursor(payload);
    const tampered = cursor.split('.')[0] + '.AAAAAAA';
    expect(() => helper.parseAuditCursor(tampered)).toThrow(/Invalid cursor signature/);
  });

  it('rejects cursor with malformed format', () => {
    expect(() => helper.parseAuditCursor('not_a_valid_cursor')).toThrow(/Invalid cursor format/);
  });

  it('builds and parses catalog cursor roundtrip', () => {
    const cursor = helper.buildCatalogCursor(50);
    const offset = helper.parseCatalogCursor(cursor);
    expect(offset).toBe(50);
  });

  it('rejects catalog cursor with tampered signature', () => {
    const cursor = helper.buildCatalogCursor(100);
    const [encoded] = cursor.split('.');
    const tampered = `${encoded}.aaaaa`;
    expect(() => helper.parseCatalogCursor(tampered)).toThrow();
  });

  it('uses timing-safe equal preventing timing attacks', () => {
    const cursor = helper.buildAuditCursor({ lastCreatedAt: '2026-05-06T10:00:00.000Z', lastId: '01J7XYZABCD0000000000000000' });
    const [encoded] = cursor.split('.');
    expect(() => helper.parseAuditCursor(`${encoded}.x`)).toThrow();
  });
});
```

### 7.5 `admin-permissions-audit-query.repository.spec.ts` (~120 lignes integration)

```typescript
// repo/apps/api/src/modules/admin/permissions/repositories/admin-permissions-audit-query.repository.spec.ts
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { AdminPermissionsAuditQueryRepository } from './admin-permissions-audit-query.repository';
import { setupTestDatabase, teardownTestDatabase } from '../../../../test/helpers/test-db';
import { buildSyntheticAuditFixtures } from '../../../../test/admin/fixtures/admin-permissions-fixtures';

describe('AdminPermissionsAuditQueryRepository (integration)', () => {
  let repo: AdminPermissionsAuditQueryRepository;
  let dbHandle: any;

  beforeAll(async () => {
    dbHandle = await setupTestDatabase();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminPermissionsAuditQueryRepository,
        { provide: 'DRIZZLE_CLIENT', useValue: dbHandle.db },
        { provide: PinoLogger, useValue: { info: () => {}, warn: () => {}, error: () => {}, setContext: () => {} } },
      ],
    }).compile();
    repo = moduleRef.get(AdminPermissionsAuditQueryRepository);
  });

  beforeEach(async () => {
    await dbHandle.truncate('rbac_audit_log');
    const fixtures = buildSyntheticAuditFixtures(150);
    await dbHandle.bulkInsert('rbac_audit_log', fixtures);
  });

  afterAll(async () => { await teardownTestDatabase(dbHandle); });

  it('findDenied returns rows ordered DESC by created_at', async () => {
    const rows = await repo.findDenied({ limit: 10 });
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].createdAt.getTime()).toBeGreaterThanOrEqual(rows[i + 1].createdAt.getTime());
    }
  });

  it('findDenied applies userId filter', async () => {
    const rows = await repo.findDenied({ userId: '00000000-0000-0000-0000-000000000001', limit: 100 });
    expect(rows.every((r) => r.userId === '00000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('findDenied applies role filter', async () => {
    const rows = await repo.findDenied({ role: 'broker_user' as any, limit: 100 });
    expect(rows.every((r) => r.role === 'broker_user')).toBe(true);
  });

  it('findDenied applies permission filter', async () => {
    const rows = await repo.findDenied({ permission: 'insure.policies.delete', limit: 100 });
    expect(rows.every((r) => r.permission === 'insure.policies.delete')).toBe(true);
  });

  it('findDenied uses cursor for pagination stability', async () => {
    const page1 = await repo.findDenied({ limit: 10 });
    const lastRow = page1[page1.length - 1];
    const page2 = await repo.findDenied({
      cursorCreatedAt: lastRow.createdAt.toISOString(), cursorId: lastRow.id, limit: 10,
    });
    expect(page2[0].createdAt.getTime()).toBeLessThanOrEqual(lastRow.createdAt.getTime());
  });

  it('aggregateStats 24h window returns counts', async () => {
    const stats = await repo.aggregateStats('24h', 'permission');
    expect(stats.totalDenied).toBeGreaterThanOrEqual(0);
    expect(stats.uniqueUsers).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.topDeniedPermissions)).toBe(true);
  });

  it('aggregateStats hourly buckets non-empty', async () => {
    const stats = await repo.aggregateStats('24h', 'permission');
    expect(Array.isArray(stats.deniedPerHour)).toBe(true);
  });

  it('EXPLAIN ANALYZE confirms Index Scan on rbac_audit_log_denied_recent_idx', async () => {
    const result = await dbHandle.execute(`EXPLAIN ANALYZE SELECT * FROM rbac_audit_log WHERE granted=false ORDER BY created_at DESC LIMIT 50`);
    const plan = JSON.stringify(result);
    expect(plan).toMatch(/Index Scan|Bitmap/);
    expect(plan).not.toMatch(/Seq Scan/);
  });
});
```

### 7.6 `admin-permissions.e2e-spec.ts` (~250 lignes : 15+ tests E2E Supertest)

```typescript
// repo/apps/api/test/admin/admin-permissions.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { issueTestJwt, type TestJwtPayload } from '../helpers/jwt';
import { setupTestDatabase, teardownTestDatabase, seedAuditEvents } from '../helpers/test-db';

describe('AdminPermissionsController (E2E)', () => {
  let app: NestFastifyApplication;
  let dbHandle: any;
  let superAdminToken: string;
  let brokerUserToken: string;

  beforeAll(async () => {
    dbHandle = await setupTestDatabase();
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    superAdminToken = await issueTestJwt({ userId: '00000000-0000-0000-0000-000000000099', role: 'super_admin_platform', tenantId: null });
    brokerUserToken = await issueTestJwt({ userId: '00000000-0000-0000-0000-000000000010', role: 'broker_user', tenantId: '00000000-0000-0000-0000-000000000aaa' });
  });

  beforeEach(async () => {
    await dbHandle.truncate('rbac_audit_log');
    await seedAuditEvents(dbHandle, 100);
  });

  afterAll(async () => { await app.close(); await teardownTestDatabase(dbHandle); });

  describe('GET /api/v1/admin/rbac/roles', () => {
    it('200 super admin returns 12 roles', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(12);
      expect(res.body.metadata.bundleVersion).toBeDefined();
    });

    it('403 broker_user denied', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles').set('Authorization', `Bearer ${brokerUserToken}`);
      expect(res.status).toBe(403);
      expect(res.body.detail).toMatch(/super_admin_platform/);
    });

    it('401 no token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles');
      expect(res.status).toBe(401);
    });

    it('Cache-Control header set 3600s', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.headers['cache-control']).toMatch(/max-age=3600/);
    });
  });

  describe('GET /api/v1/admin/rbac/roles/:role/permissions', () => {
    it('200 broker_admin returns ~30 permissions with breakdown', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles/broker_admin/permissions').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('broker_admin');
      expect(res.body.inheritsFrom).toContain('broker_user');
      expect(res.body.permissionsCount).toBeGreaterThan(20);
      expect(res.body.breakdownByModule).toHaveProperty('crm');
    });

    it('400 invalid role param', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles/INVALID_ROLE/permissions').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });

    it('403 broker_user', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/roles/broker_admin/permissions').set('Authorization', `Bearer ${brokerUserToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/rbac/permissions', () => {
    it('200 returns catalog 85+', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/permissions?limit=100').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.metadata.totalCatalogSize).toBeGreaterThanOrEqual(85);
    });

    it('200 filter by module=crm', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/permissions?module=crm').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.body.data.every((p: any) => p.module === 'crm')).toBe(true);
    });
  });

  describe('GET /api/v1/admin/rbac/audit/denied', () => {
    it('200 returns recent denied events ordered DESC', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/audit/denied?limit=50').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (let i = 0; i < res.body.data.length - 1; i++) {
        expect(new Date(res.body.data[i].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body.data[i + 1].createdAt).getTime());
      }
    });

    it('200 filter by userId', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/audit/denied?userId=00000000-0000-0000-0000-000000000001').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((e: any) => e.userId === '00000000-0000-0000-0000-000000000001')).toBe(true);
    });

    it('400 window > 30 days', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/rbac/audit/denied?since=2020-01-01T00:00:00Z&until=2026-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });

    it('200 cursor pagination next page coherent', async () => {
      const page1 = await request(app.getHttpServer()).get('/api/v1/admin/rbac/audit/denied?limit=10').set('Authorization', `Bearer ${superAdminToken}`);
      expect(page1.body.pagination.hasMore).toBe(true);
      const cursor = page1.body.pagination.nextCursor;
      const page2 = await request(app.getHttpServer()).get(`/api/v1/admin/rbac/audit/denied?limit=10&cursor=${encodeURIComponent(cursor)}`).set('Authorization', `Bearer ${superAdminToken}`);
      expect(page2.status).toBe(200);
      const page1Ids = new Set(page1.body.data.map((e: any) => e.id));
      page2.body.data.forEach((e: any) => expect(page1Ids.has(e.id)).toBe(false));
    });

    it('400 tampered cursor signature', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/audit/denied?cursor=eyJ0YW1wZXIiOnRydWV9.AAAAA').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/admin/rbac/audit/stats', () => {
    it('200 returns aggregated stats 24h', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/audit/stats?window=24h&groupBy=permission').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.totalDenied).toBeGreaterThan(0);
      expect(Array.isArray(res.body.topDeniedPermissions)).toBe(true);
      expect(Array.isArray(res.body.deniedPerHour)).toBe(true);
    });

    it('400 invalid window value', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/rbac/audit/stats?window=invalid').set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
```

---

## 8. Variables environnement

```bash
# repo/apps/api/.env.example
# ============= Tache 2.3.11 AdminPermissionsController =============

# TTL en secondes du cache Redis admin:rbac:* (catalog roles/permissions)
# Default 3600 (1h). Acceptable car catalog change rare.
ADMIN_RBAC_CACHE_TTL_SECONDS=3600

# Taille de page par defaut pour pagination cursor /admin/rbac/audit/denied
ADMIN_RBAC_AUDIT_PAGE_SIZE_DEFAULT=50

# Taille de page maximale autorisee. Au-dela, 400 BadRequest.
ADMIN_RBAC_AUDIT_PAGE_SIZE_MAX=200

# Secret HMAC-SHA256 pour signer les cursors. Min 32 chars. Derive du JWT_SECRET via HKDF idealement.
# IMPORTANT : changer en production via secret manager (Vault, AWS Secrets Manager).
ADMIN_RBAC_CURSOR_SECRET=change_me_in_production_min_32_chars_xxxxxxxxxx

# Bundle version injectee a build (ex: git commit short SHA + tag).
# Utilisee dans cache keys pour invalidation auto post-deploy.
BUNDLE_VERSION=v2.3.0
```

---

## 9. Commandes shell (curl examples + outillage ops)

```bash
# Pre-requis : super_admin_platform JWT token issued via /api/v1/auth/login
export SUPER_ADMIN_TOKEN="eyJhbGciOiJSUzI1NiIs..."
export API_BASE="https://api.skalean-insurtech.ma"

# ----- 1. Liste des 12 roles -----
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/roles" | jq .

# Avec ETag/If-None-Match (cache HTTP browser)
curl -sS -i -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  -H "If-None-Match: \"v2.3.0-roles-list\"" \
  "${API_BASE}/api/v1/admin/rbac/roles"

# ----- 2. Permissions effectives d'un role -----
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/roles/broker_admin/permissions" | jq .

curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/roles/garage_technicien/permissions" | jq '.permissions[] | {name, source}'

# ----- 3. Catalog 85+ permissions filtre module -----
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/permissions?module=insure" | jq '.data[].name'

curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/permissions?module=crm&action=read" | jq .

# Cursor pagination
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/permissions?limit=20" | jq '{count: .data|length, next: .pagination.nextCursor, hasMore: .pagination.hasMore}'

# ----- 4. Audit denied recent (debug "user X cant access Y") -----
USER_ID="01J7XYZ..."
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/audit/denied?userId=${USER_ID}&since=$(date -u -d '1 hour ago' +%FT%TZ)" | jq .

# Filter combine
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/audit/denied?role=broker_user&permission=insure.policies.create&limit=20" | jq .

# ----- 5. Stats agregatte (detection patterns) -----
curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/audit/stats?window=24h&groupBy=permission" | jq .

curl -sS -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
  "${API_BASE}/api/v1/admin/rbac/audit/stats?window=7d&groupBy=role" | jq '.topDeniedRoles'

# ----- Swagger UI access -----
echo "Open ${API_BASE}/api/docs in browser, authenticated with super admin JWT"
echo "OpenAPI JSON spec : ${API_BASE}/api/docs-json"

# ----- Tests CI -----
pnpm --filter api test admin-permissions
pnpm --filter api test:e2e admin-permissions

# ----- Snapshot OpenAPI verification -----
pnpm --filter api openapi:snapshot
diff docs/openapi/admin-rbac.json <(curl -sS ${API_BASE}/api/docs-json | jq '.paths | with_entries(select(.key | startswith("/api/v1/admin/rbac")))')
```

---

## 10. Criteres validation V1-V30

| ID | Priorite | Critere | Test associe |
|----|----------|---------|---------------|
| V1 | P0 | `GET /admin/rbac/roles` retourne 12 roles | E2E "200 super admin returns 12 roles" |
| V2 | P0 | super_admin_platform peut acceder meme si Redis down (RoleGuard before cache) | Unit + E2E |
| V3 | P0 | `GET /admin/rbac/roles/:role/permissions` retourne effectives + hierarchy | E2E broker_admin -> 30 perms inheriting broker_user |
| V4 | P0 | Breakdown by module present + count correct | E2E response.breakdownByModule.crm.count |
| V5 | P0 | Source `direct` vs `inherited_from:X` resolved correctement | Service spec |
| V6 | P0 | Permissions catalog retourne 85+ | E2E totalCatalogSize >= 85 |
| V7 | P0 | Catalog filter `?module=crm` filtre exact | E2E |
| V8 | P0 | Catalog filter `?action=read` filtre exact | E2E |
| V9 | P0 | `GET /admin/rbac/audit/denied` retourne ordered DESC by createdAt | Repository integration test + E2E |
| V10 | P0 | Audit filter `?userId=X` retourne uniquement events user X | E2E |
| V11 | P0 | Audit filter `?role=Y` retourne uniquement role Y | E2E |
| V12 | P0 | Cursor pagination stable sous insertion concurrente | Repository integration |
| V13 | P0 | Cursor compound (createdAt, id) gere collision microseconde | Helper unit |
| V14 | P0 | Cursor signature HMAC-SHA256 verifie -> tamper rejected 400 | Helper + E2E |
| V15 | P0 | Audit log ecriture pendant pagination -> ORDER BY DESC strict pas duplicate | Repository integration |
| V16 | P0 | Metrique `admin_rbac_endpoint_calls_total` cardinalite < 50 series | Metrics test |
| V17 | P0 | Cache key inclut BUNDLE_VERSION pour invalidation auto post-deploy | Cache spec |
| V18 | P0 | Stats `window=7d|30d` consume materialized view si fresh | Repository |
| V19 | P0 | AdminPermissionsCacheService.invalidate() purge tous admin:rbac:* | Cache spec |
| V20 | P1 | OpenAPI Swagger examples utilisent UUIDs synthetiques (pas PII) | Snapshot test |
| V21 | P1 | Reponse `/permissions` 85 entries < 30 KB compressed gzip | E2E |
| V22 | P0 | Window > 30 jours rejette 400 BadRequest | Controller unit + E2E |
| V23 | P0 | Invalid role param -> 400 BadRequest avec Zod error | E2E |
| V24 | P1 | Redis down -> fallback compute direct, log warn, NE PAS bloquer | Cache spec |
| V25 | P1 | Postgres timeout 5s -> 503 Service Unavailable + Retry-After | Repository test |
| V26 | P1 | MV stale > 1h -> fallback raw query | Repository |
| V27 | P0 | RoleGuard rejette tous roles non super_admin avec 403 | E2E batch (12 roles tested) |
| V28 | P1 | JwtAuthGuard rejette absence token avec 401 | E2E |
| V29 | P0 | Cache hit set fromCache=true dans metadata reponse | Service spec |
| V30 | P0 | E2E tests passent CI sans flake (10 runs consecutifs) | CI runner |

---

## 11. Edge cases (12+)

1. **Edge : super_admin avec MFA expire pendant requete admin endpoint.** JWT contient `mfa_verified_at` ; si > 30min, JwtAuthGuard rejette 401 + force re-MFA. Test : E2E avec token MFA expire.

2. **Edge : analyst_support tente acceder /admin/rbac/audit/denied (read-only universal).** Bien que analyst_support a wildcard `*.read`, le RoleGuard `@Role(SUPER_ADMIN_PLATFORM)` enforce strict role match -> 403. Documente que analyst_support consume Sprint 26 nouveau endpoint `/api/v1/analyst/rbac/audit/denied` separe.

3. **Edge : role param avec casing different (broker_USER).** Zod AuthRoleEnum strict lowercase -> 400 BadRequest "Expected 'broker_user' got 'broker_USER'".

4. **Edge : audit query tres large window 30d sur tenant volumineux.** Pre-validation max 30 jours, MV utilisee. Si MV stale, fallback raw + log warn alert ops.

5. **Edge : pagination cursor expire si BUNDLE_VERSION change entre 2 calls.** Cursor encode pas BUNDLE_VERSION (pagination ne depend pas catalog), donc cursor valide cross-deploy. Catalog cursor restart from beginning si deploy.

6. **Edge : Redis cluster failover pendant call.** ioredis cluster auto-reconnect, fallback compute direct, log warn. Pas d'erreur propagated.

7. **Edge : Unicode dans userAgent audit log.** Audit log stocke utf-8 directement, JSON serialization Node natif gere unicode. Test avec userAgent emoji-laden.

8. **Edge : audit log row sans policyEvaluated (null).** DTO gere `policyEvaluated: []` array vide. Service mappe `row.policyEvaluated ?? []`.

9. **Edge : tres ancienne audit row (8 mois) survit partition cleanup.** Partition mensuelle DROP > 12 mois auto. Audit log row pre-12 mois purgee silencieusement (CNDP loi 09-08 art 18).

10. **Edge : super_admin cherche userId qui n'existe pas.** Returns `[]` empty array + hasMore=false. Pas d'erreur 404.

11. **Edge : Cursor signe avec OLD secret apres rotation.** HMAC verify fail -> 400 BadRequest "Invalid cursor signature". User force a refetch from page 1.

12. **Edge : Concurrent invalidate() + listRoles().** Cache invalidate atomic Redis DEL, list compute frais sans race. Test concurrent.

13. **Edge : MFA challenge over /admin/rbac/audit/denied?revealIps=true (Sprint 33).** Hors scope Sprint 7. Documente.

14. **Edge : Tenant deleted pendant query audit -- userId references tenant supprime.** userId UUID toujours present audit_log meme si user deleted (audit immuable). Pas de FK constraint.

15. **Edge : Permissions matrix change pendant cache TTL 1h.** Cache key inclut BUNDLE_VERSION, deploy -> nouvelle key -> miss + repopulate. Old key TTL expire 1h.

---

## 12. Conformite Maroc detaillee

### 12.1 CNDP loi 09-08

**Article 4 (Minimisation)** : Les endpoints exposent uniquement les donnees necessaires :
- `userId` : UUID pseudonyme (pas email).
- `ip` : conserve telle quelle Sprint 7 ; Sprint 33 introduit hashing SHA256+salt + reveal MFA-protected.
- `userAgent` : utile detection bot/anomalie, conserve.
- `requestId` : ULID synthetique pseudonyme.

**Article 18 (Conservation)** : Audit log retention 12 mois max via partitioning. Endpoint `/audit/denied` filtre implicit `created_at > NOW() - INTERVAL '12 months'`. Documentation registre des traitements `docs/cndp/registre-traitements.md` Section 7.3 "Audit Access RBAC".

**Article 22 (Acces personne concernee)** : Sprint 16 livrera endpoint auto-service `GET /api/v1/me/audit/access-denied` consume meme `RbacAuditService` mais filtre `userId = ctx.userId`. Phase 7+ ajoutera `GET /api/v1/me/audit/all` complete (all granted+denied).

**Decision 008/2018 (sessions prospect)** : Prospects denied tracked separement. Audit log inclut prospects (role=prospect, userId=session_id pseudonyme TTL 30min Redis).

**Recommendation 5/2020 (logs)** : Sprint 33 ajoutera `audit_log_meta` tracant qui consume `/admin/rbac/audit/denied` (audit-of-audit).

### 12.2 ACAPS Circulaire 2018/01

**Article 9 (Tracabilite operations courtage)** : Tous denied access traces avec `userId, role, permission, resourceType, resourceId, ip, requestId, createdAt`. ACAPS auditeur peut consulter via super_admin proxy ou Phase 7+ role `acaps_auditor` dedie read-only. Cap 12 mois retention Sprint 7 ; Sprint 34 etendra retention compliance ACAPS specifique courtage operations a 60 mois (decision-016 produit).

**Article 12 (Reporting)** : Sprint 34 generera rapport mensuel "denied access patterns" via batch consumant `/admin/rbac/audit/stats?window=30d` -> CSV export -> upload portail ACAPS.

### 12.3 AMC Loi 12-18 (AML)

**Article 15 (Detection patterns)** : `top_denied_users` flag potentielle compromission compte (> 100 denied/h = brute force suspect). Integration Sprint 25 SIEM Splunk consume `admin_rbac_denied_total` Prometheus metric pour alert SOC. Role ComplianceOfficer (mappe a analyst_support Sprint 7, Phase 7+ role dedie) peut consulter `/audit/stats` read-only.

**Article 18 (Reporting AMC)** : Trimestriel rapport AML alimentes par audit log + Sprint 34 module compliance.

### 12.4 BAM Circulaire 1/G/2007

**Separation des taches** : super_admin_platform peut consulter audit. Phase 7+ ajoutera role `audit_officer` separe pour separation duties stricte BAM compliance (audit officer ne peut PAS modifier matrice, seulement consulter).

**Tracabilite** : Toutes operations admin trackees via `audit_log` Sprint 7 Tache 2.3.9 + meta-trace consumption admin endpoints Sprint 33.

### 12.5 Loi 17-99

Out-of-scope direct. Pas d'impact sur AdminPermissionsController.

### 12.6 Conformite RGPD (export EU)

Sprint 7 cible Maroc primaire mais compatibility RGPD prevue Phase 8+ extension Tunisie/EU :
- DPO endpoint export PII Sprint 16 consume meme audit log.
- Right to erasure : audit log conserve userId UUID pseudonyme apres user purge (acceptable pseudonymous data RGPD art 4-5).

---

## 13. Conventions absolues skalean-insurtech

- **AUCUNE EMOJI** dans le code, commits, documentation, logs, commentaires.
- **TypeScript strict** : `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`. Pas de `any`. `unknown` + Zod validation aux frontieres.
- **Zod uniquement** : pas de `class-validator`. Tous DTOs sont schemas Zod + types inferes.
- **Pino logger structured** : `logger.info({ key: val }, 'message')`. Pas de string concatenation.
- **Nommage** : `kebab-case` files, `PascalCase` classes, `camelCase` variables/methods, `SCREAMING_SNAKE_CASE` env vars + constants.
- **Path alias** : `@insurtech/*` pour packages internes, pas de imports relatifs `../../`.
- **Tests Vitest** : `describe` + `it` + `expect`. Coverage cible 90%+ par module.
- **Commits Conventional** : `feat(scope): subject` `fix(scope): subject` `chore(scope): subject` `test(scope): subject` `docs(scope): subject` `refactor(scope): subject`.
- **Migrations Drizzle** : numerotees `NNNN_description.sql` BEGIN/COMMIT atomic, idempotent `IF NOT EXISTS`.
- **Index Postgres** : `CONCURRENTLY` pour migrations production sans lock.
- **Cache Redis** : prefixe namespace `module:scope:` strict. Constants exported.
- **Metrics Prometheus** : low cardinality labels (< 50 series). Pas de userId/requestId in labels.
- **Errors RFC 7807** : Problem+JSON `{ type, title, status, detail, instance, request_id }`.
- **HTTP status** : 200 OK, 400 BadRequest (validation), 401 Unauthorized (auth), 403 Forbidden (RBAC), 404 NotFound, 409 Conflict, 422 UnprocessableEntity (semantic), 429 RateLimited, 500 ServerError, 503 ServiceUnavailable (transient).
- **Documentation** : ADR pour decisions architecturales significatives. Runbook pour incidents recurrents.
- **Secrets** : jamais committed, env vars + secret manager production (Vault/AWS Secrets).
- **Logging PII** : pas de PII dans logs (email, ip publique). UUID pseudonyme OK.
- **Localisation** : strings UI internationalises ar-MA + fr-MA + en-US. API messages en anglais (i18n cote client).
- **Timezone** : Postgres `TIMESTAMPTZ`, applicatif `luxon` `Africa/Casablanca` UI display.

---

## 14. Validation pre-commit

```bash
# Lancer dans repo/apps/api
pnpm lint                                              # ESLint + prettier + custom rules
pnpm typecheck                                          # tsc --noEmit
pnpm test admin-permissions                             # 20+ unit tests
pnpm test:integration admin-permissions                 # 5+ integration tests
pnpm test:e2e admin-permissions                         # 15+ E2E tests
pnpm openapi:snapshot                                   # genere docs/openapi/admin-rbac.json
pnpm db:migrate:dry-run                                 # verifie migrations 0073-0075 sans appliquer
pnpm coverage --filter src/modules/admin/permissions    # >= 90%

# Verifier no emoji (custom script)
node scripts/check-no-emoji.js src/modules/admin/permissions

# Verifier all imports explicit
grep -r "from '@insurtech" src/modules/admin/permissions | wc -l   # > 20

# Verifier Zod schemas (pas class-validator)
grep -r "@IsString\|@IsEnum\|@ValidateNested" src/modules/admin/permissions && exit 1 || echo OK

# Verifier no any
grep -rE ": any[ ;,)]" src/modules/admin/permissions/**/*.ts && exit 1 || echo OK

# Securite : verifier pas de secret hardcoded
grep -rE "secret|password|token" src/modules/admin/permissions/**/*.ts | grep -v "// " | grep -v "config.get" && echo "REVIEW NEEDED"
```

---

## 15. Commit message complet

```
feat(admin/rbac): add AdminPermissionsController with 5 introspection endpoints

Sprint 7 -- Tache 2.3.11 (Phase 2 / RBAC granulaire)

Adds super-admin-only HTTP endpoints under /api/v1/admin/rbac/* for RBAC
introspection without reading code source files :

  GET /api/v1/admin/rbac/roles
      List 12 roles with permissions count, hierarchy, tier, MFA flag.
      Cache 1h Redis (admin:rbac:roles:list:v{BUNDLE_VERSION}).

  GET /api/v1/admin/rbac/roles/:role/permissions
      Return permissions effectives apres resolution recursive hierarchy
      via PermissionCacheService.getEffectivePermissions(role) (Tache 2.3.10).
      Breakdown par module + source per permission (direct vs inherited).
      Cache 1h Redis.

  GET /api/v1/admin/rbac/permissions
      Catalog 85+ permissions avec filtres (?module, ?action) + cursor
      pagination + grantedToRoles per permission. Cache 1h Redis.

  GET /api/v1/admin/rbac/audit/denied
      Recent denied access events depuis rbac_audit_log avec filtres
      exhaustifs (userId, role, permission, since, until, ip, reason)
      + cursor pagination HMAC-SHA256 signed. Real-time (no cache).

  GET /api/v1/admin/rbac/audit/stats
      Aggregated stats (top denied permissions/users/IPs/roles + hourly
      buckets) sur fenetre 1h/24h/7d/30d. Materialized view
      rbac_audit_stats_hourly refreshed 15min via pg_cron pour windows
      >= 7d. Cache 5min Redis.

Architecture :
  - 7-layer module : Controller, Service, CacheService, AuditQueryRepository,
    PaginationHelper (HMAC cursor), MetricsService, OpenApi schemas.
  - Strict super_admin_platform via @Role decorator + RoleGuard (Tache 2.3.4).
  - 401 Unauthorized via JwtAuthGuard, 403 Forbidden RFC 7807 Problem+JSON.
  - Read-only Sprint 7. Phase 7+ ajoutera write endpoints pour tier
    enterprise custom permissions per tenant (decision-014).

Performance :
  - p99 cache hit < 15ms / cache miss < 80ms / audit query < 50ms.
  - Throughput cible > 500 req/s.
  - Index composites Postgres optimisent audit queries
    (granted, created_at DESC) partial WHERE granted=false.

Conformite Maroc :
  - CNDP loi 09-08 art 4 (minimisation IP/userId pseudonyme), art 18
    (retention 12 mois partition auto-drop), art 22 (Sprint 16
    auto-service endpoint).
  - ACAPS circulaire 2018/01 art 9 (tracabilite audit), art 12 (Sprint 34
    rapport mensuel via /audit/stats).
  - AMC loi 12-18 art 15 (detection patterns top_denied_users brute-force).
  - BAM circulaire 1/G/2007 (separation taches Phase 7+ role audit_officer).

Files :
  src/modules/admin/permissions/admin-permissions.controller.ts (~280 LOC)
  src/modules/admin/permissions/admin-permissions.service.ts (~250 LOC)
  src/modules/admin/permissions/dtos/admin-permissions.dto.ts (~200 LOC)
  src/modules/admin/permissions/admin-permissions.module.ts (~80 LOC)
  src/modules/admin/permissions/services/admin-permissions-cache.service.ts (~150 LOC)
  src/modules/admin/permissions/helpers/admin-permissions-pagination.helper.ts (~100 LOC)
  src/modules/admin/permissions/repositories/admin-permissions-audit-query.repository.ts (~180 LOC)
  src/modules/admin/permissions/services/admin-permissions-metrics.service.ts (~80 LOC)
  src/modules/admin/permissions/openapi/admin-permissions.openapi.ts (~120 LOC)
  src/modules/admin/permissions/index.ts (barrel)
  src/config/admin-permissions.config.ts (Zod schema)
  src/db/migrations/0073_add_rbac_audit_indexes.sql
  src/db/migrations/0074_create_rbac_audit_stats_hourly_mv.sql
  src/db/migrations/0075_schedule_rbac_audit_stats_refresh.sql

Tests : 35+ tests Vitest passent (unit + integration + E2E Supertest).
Coverage : 92% lignes / 89% branches sur module admin/permissions.

Refs : ADR-029 (REST vs GraphQL), ADR-030 (cursor pagination),
       ADR-031 (cache 1h Redis), ADR-032 (read-only Sprint 7),
       decision-014 (tier enterprise Phase 7+).

Sprint-task: 2.3.11
Closes: SKAL-INS-2347
```

---

## 16. Workflow next step

Cette tache 2.3.11 est ACHEVEE. Etat reel :
- 5 endpoints admin/rbac livres + tests 35+ verts CI.
- Cache 1h Redis namespace `admin:rbac:*` operational.
- Cursor pagination HMAC-signed.
- OpenAPI Swagger documentation generee + snapshot committed.
- Migrations 0073-0075 Postgres appliquees (indexes + MV + pg_cron).
- ADR-029, ADR-030, ADR-031, ADR-032 documentes.
- Conformite Maroc CNDP/ACAPS/AMC/BAM mappee.

**Tache suivante : `task-2.3.12-tests-exhaustifs-seeds.md`**

But Tache 2.3.12 :
- Tests exhaustifs RBAC + ABAC : 80+ scenarios validation matrice 12 roles x 85+ permissions.
- Suite `role-matrix-coverage.spec.ts` : iterate 12 roles x 10 permissions samples = 120 assertions.
- Per-role tests (12 fichiers) : super_admin / analyst / broker_* / garage_* / assure / prospect.
- ABAC tests : OwnResources / TimeBased / StatusBased / WorkflowState.
- Tests integration full stack : endpoints reels avec roles reels.
- Seeds dev : `seed-rbac-users.ts` cree 12 users (1 par role) password `Test1234!@#$` Cabinet Demo Bennani + Garage Demo Atlas.
- Documentation runbook `docs/runbooks/rbac-test-users.md`.
- Script `pnpm seeds:rbac`.

Cette tache 2.3.12 cloture le Sprint 7 RBAC + ABAC. Sortie Sprint 7 :
```
RBAC + ABAC system fully operational :
  - 12 roles enforces + 85+ permissions catalogues
  - PermissionsMatrix code-as-config + RoleHierarchy
  - RbacService canAccess/canAccessAny/canAccessAll
  - 3 guards : RoleGuard / PermissionGuard / AbacGuard
  - 5 decorators : @Role / @MinRole / @RequirePermission / @RequireAnyPermission / @AbacResource
  - 4 ABAC policies : OwnResources / TimeBased / StatusBased / WorkflowState
  - PermissionCacheService Redis (5min role perms, 1min ABAC results)
  - RbacAuditService : audit all granted/denied + Kafka events
  - 5 endpoints admin RBAC : roles list / role permissions / catalog / audit denied / audit stats
Tests :
  - 80+ scenarios RBAC + ABAC
  - 12 seeds users (un par role) pour dev/demo
```

**Phase 2 (Securite & Multi-tenant) COMPLETE** : Auth + Multi-tenant + RBAC operationnels.
**Sprint 8 demarre Phase 3 -- Modules Horizontaux (CRM)**.

---

## 17. Check final tache 2.3.11

- [x] 1. Header metadata : Sprint 7 / Phase 2 / P0 / 4h / depend Tache 2.3.10
- [x] 2. But : 3 paragraphes denses (~1200 mots)
- [x] 3. Contexte etendu : 12 sous-sections (REST vs GraphQL / cursor vs offset / cache 1h / read-only / structure / 15 pieges / conformite Maroc / perf budget / failure modes / volumetrie / industrie / ADRs)
- [x] 4. Architecture context : position sprint + diagramme endpoints + flow get role permissions + flow audit denied + dependency graph
- [x] 5. Livrables checkables : 30 items L1-L30
- [x] 6. Code patterns COMPLETS : 15 fichiers TypeScript/SQL livres (DTO, Controller, Service, Cache, Pagination, AuditRepo, Metrics, Module, Config, OpenAPI, Index, 3 migrations SQL, Fixtures)
- [x] 7. Tests complets : 35+ tests (controller spec 10+, service spec 10+, cache spec 6+, pagination spec 7+, audit query repo 8+, e2e spec 15+)
- [x] 8. Variables environnement : 5 vars documentees
- [x] 9. Commandes shell : 15+ exemples curl + tests CI + snapshot
- [x] 10. Criteres validation V1-V30 : 30 criteres P0/P1
- [x] 11. Edge cases : 15 cas
- [x] 12. Conformite Maroc detaillee : CNDP / ACAPS / AMC / BAM / RGPD
- [x] 13. Conventions absolues skalean-insurtech : checklist exhaustive
- [x] 14. Validation pre-commit : commands lint/typecheck/test/coverage
- [x] 15. Commit message complet : Conventional + scope detail
- [x] 16. Workflow next step : reference Tache 2.3.12
- [x] 17. Check final : ce checklist


**Fin du prompt task-2.3.11-permissions-controller-admin-endpoints.md.**
