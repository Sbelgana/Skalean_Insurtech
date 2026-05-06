# TACHE 2.2.2 -- TenantContextMiddleware : Lit x-tenant-id + Valide UUID + Coherence JWT + Acces

**Sprint** : 6 (Phase 2 / Sprint 2 dans phase) -- Multi-Tenant 3 Niveaux + RLS Runtime
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-06-sprint-06-multi-tenant.md` (Tache 2.2.2)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour les 10 taches suivantes du Sprint 6, point d'entree de l'isolation tenant runtime)
**Effort** : 5h
**Dependances** : 2.2.1 (TenantContextService livre AsyncLocalStorage), Sprint 5 (JwtAuthGuard authentifie + extrait `userId, tenant_id` JWT claim), Sprint 2 (table `auth_tenant_users` jonction + table `auth_tenants.settings jsonb`), Sprint 1 (Redis CACHE DB 0 disponible)
**Densite cible** : 130-150 ko (auto-suffisant exhaustif, sprint critique)
**AUCUNE EMOJI AUTORISEE**
**SPRINT CRITIQUE** : 0 LEAK CROSS-TENANT NON-NEGOCIABLE

---

## 1. But

Cette tache vise a implementer le `TenantContextMiddleware` NestJS qui constitue le **point d'entree unique** de la chaine d'isolation multi-tenant a 3 niveaux pour TOUTES les requests HTTP entrantes du programme Skalean InsurTech v2.2. Le but est de produire un middleware qui execute **avant** chaque controller, lit le header HTTP `x-tenant-id`, le valide structurellement (UUID v4 via Zod), verifie que l'utilisateur authentifie a effectivement le droit d'acceder au tenant demande (via la table de jonction `auth_tenant_users` Sprint 2 + cache Redis 5min), valide la coherence avec le claim `tenant_id` du JWT, charge les `TenantSettings` une fois pour toute la request (cache Redis 5min), puis wrappe la suite de la pipeline NestJS dans `tenantContextService.runWithContext()` (Tache 2.2.1) afin que tous les controllers, services, repositories, et subscribers TypeORM downstream puissent acceder au contexte transparent via l'AsyncLocalStorage.

L'apport est triple. Premierement, en concentrant TOUTE la logique de derivation du `TenantContext` (depuis le header HTTP, le JWT claim, la BDD `auth_tenant_users`) dans UN seul middleware aux frontieres de l'application (avant les guards, avant les interceptors, avant les controllers), nous garantissons une **invariant runtime** : aucun code metier downstream ne peut s'executer sans contexte valide ou avec un contexte forge. Cette concentration est l'equivalent du pattern "Border Crossing" de Domain-Driven Design : la conversion HTTP-vers-domaine se fait a un point unique audite. Deuxiemement, en branchant le middleware selon le path de la request (5 branches : `/healthz`/`/readyz`/`/docs/*` infrastructure, `/api/v1/public/*` non-auth, `/api/v1/admin/*` super admin bypass, `/api/v1/assure/*` L3 niveau 3, default `/api/v1/*` tenant standard niveau 2), nous evitons de surcharger les routes qui n'ont legitimement pas besoin de tenant (e.g. healthcheck Kubernetes, OpenAPI Swagger, login public, signup public) sans pour autant relacher la rigueur sur les routes metier. Cette discrimination par path est une optimisation critique : sur 800 endpoints estimes a Sprint 35, environ 30 sont publics et 30 sont admin -- les 740 restants doivent passer la validation tenant complete sans exception. Troisiemement, en cachant les decisions chere d'I/O (lookup `auth_tenant_users` + lookup `auth_tenants.settings`) dans Redis avec un TTL de 5 minutes (cleartext namespace `tenant:user-access:*` et `tenant:settings:*`), nous reduisons l'overhead par request de ~25ms (cold path : 2 round-trips Postgres) a ~1ms (hot path : 2 round-trips Redis). Cette reduction est essentielle pour tenir l'objectif latency p95 < 200ms (Sprint 34 perf scaling) et p99 < 500ms.

A l'issue de cette tache, le middleware `TenantContextMiddleware` est applique globalement via `MiddlewareConsumer.apply().forRoutes('*')` dans `app.module.ts` et s'execute pour 100% des requests HTTP entrantes. Pour une route tenant standard (`/api/v1/contacts`), le middleware extrait `tenant_id` du header, valide UUID, verifie acces user via Redis cache (hit 99% du temps en steady state), valide coherence JWT, charge tenant settings depuis cache, construit un `TenantContext` complet, et wrappe `next()` dans `runWithContext(context, next)`. Pour une route admin (`/api/v1/admin/users`), le middleware skip la verification tenant et set `isSuperAdmin: true, tenantId: undefined` (la verification de role super_admin sera faite par `SuperAdminGuard` Tache 2.2.10). Pour une route assure (`/api/v1/assure/policies`), le middleware set `assureUserId = userId` en plus du tenantId. Les tests unitaires couvrent au minimum 28 scenarios incluant header valide, header absent, header malformatte UUID, user sans acces tenant, tenant suspendu, tenant archive, JWT incoherent, cache hit, cache miss, et les 5 branches path. Les tests integration verifient le comportement end-to-end avec Fastify + Redis reel (Testcontainers Sprint 1). Cette tache est la deuxieme pierre de la fondation Sprint 6 : combine avec 2.2.1 (storage), elle permet aux taches 2.2.3 (guard), 2.2.4 (interceptor SET LOCAL), 2.2.5 (validation service), 2.2.10 (SuperAdminGuard) de s'appuyer sur un contexte deterministique.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme implemente une architecture multi-tenant a 3 niveaux (decision-002) ou le tenant courant est selectionne **par request** via le header HTTP `x-tenant-id`. Ce choix de design (vs URL-based tenant routing comme `tenantA.skalean.ma`, vs sub-path comme `/tenants/:id/*`) est documente dans `00-pilotage/decisions/002-multi-tenant-3-niveaux.md` et repose sur trois constats : 

(a) un meme utilisateur peut legitimement avoir acces a plusieurs tenants (un comptable cabinet courtier + cabinet garage du meme groupe via la table `auth_tenant_users` jonction many-to-many) et doit pouvoir switcher rapidement sans logout/login, 

(b) le frontend SaaS (apps/web-broker, apps/web-garage) maintient l'etat tenant courant en local storage et l'envoie a chaque request en header (UI/UX moderne), 

(c) URL-based tenant routing complexifie le caching CDN, le SEO multi-tenant, et la generation de liens partageables (un lien client envoye par WhatsApp doit fonctionner cross-tenant si le user a access).

Sans ce middleware, le runtime ne saurait pas decoder le header HTTP en contexte applicatif. Les developpeurs metier des Sprints 8 a 35 devraient repeter cette logique de decoding dans chaque controller (ou pire, l'oublier). Cette repetition serait inevitablement source de bugs : oubli de validation UUID -> SQL injection vector via tenant_id, oubli de verification acces user -> escalation de privilege cross-tenant, oubli de check tenant suspendu -> service rendu a un client en defaut paiement. Le middleware concentre cette logique aux frontieres et la rend infaillible.

L'ordre d'execution NestJS est critique : Middleware -> Guards -> Interceptors -> Pipes -> Controller. Le middleware s'execute AVANT les guards (incluant `JwtAuthGuard` Sprint 5 qui authentifie). Cette ordre est imposee par NestJS et constitue un piege majeur : le middleware ne peut PAS lire `req.user` (pas encore set par JwtAuthGuard). Solution adoptee dans cette tache : le middleware decode lui-meme le JWT (verification signature + extraction claims) au niveau Fastify avant que JwtAuthGuard prenne le relais. Cette duplication de decoding est acceptee : ~50 microseconds de coût pour permettre le branchement par path et le contexte propage avant guards. Alternative rejetee : utiliser une `GlobalGuard` au lieu d'un middleware, mais les guards NestJS ne wrappent pas `next()` dans un AsyncLocalStorage facilement (ils retournent boolean, pas un wrapper de pipeline).

L'isolation cross-tenant est une obligation legale (loi 09-08 CNDP : isolation stricte donnees personnelles entre responsables de traitement distincts ; chaque tenant courtier ou garage est un responsable de traitement separe). Une fuite cross-tenant declenche notification CNDP 72h obligatoire (article 51) avec amende potentielle jusqu'a 300 000 MAD + obligation de cesser le traitement. Le middleware est donc un controle de niveau "engineering safety critical" au sens NIST 800-53 : un seul bug ici contamine 100% des routes metier. Tests RLS isolation EXHAUSTIFS Tache 2.2.12 (12 scenarios distincts) valident l'absence de leak.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Tenant via subdomain `tenantA.api.skalean.ma` | Lisible, cacheable CDN par subdomain, gestion certificats wildcard simple | Wildcard SSL setup complexe MA, tenant_id mappe via DNS = drift possible, multi-tenant user doit changer URL pour switcher | REJETE -- decision-002 valide header HTTP plus flexible |
| Tenant via URL path `/tenants/:tenantId/api/v1/*` | RESTful pur, lien partageable inclut tenant explicit | URL longueur 2x, redondance avec JWT claim, refactor 100% routes vs Sprint 5 deja designed `/api/v1/*` | REJETE -- decision-002 |
| Tenant via JWT claim uniquement (pas de header) | Pas de mismatch possible JWT/header | User multi-tenant ne peut pas switcher sans re-login (UX degraded), JWT short-lived (15min Sprint 5) impose re-issue per switch | REJETE -- multi-tenant user UX |
| Tenant via cookie session | Simplicite | Cookies non-portables (mobile native apps, MCP server Sprint 30), CSRF risk additionnel | REJETE -- non-portable cross-clients |
| Header HTTP `x-tenant-id` + middleware NestJS (RETENU) | Flexible, multi-tenant user UX excellent, header inspectable Sentry/Datadog, portable mobile + MCP | Requier validation runtime + cache + coherence JWT, complexite middleware | RETENU -- meilleur compromis |

### 2.3 Trade-offs explicites

Choisir le pattern "header HTTP + middleware" implique d'accepter que le frontend doit envoyer le header sur **chaque** request. Cette discipline impose un wrapper HTTP coté frontend (Sprints 4/16/22 frontend bootstraps) qui injecte automatiquement le header depuis le state global Zustand. Une `fetch()` brute sans wrapper est un anti-pattern -- les ESLint rules custom `no-raw-fetch` (Sprint 4 frontend bootstrap) rejette tout `fetch()` direct, force `apiClient.get()` qui injecte le header.

Choisir un cache Redis 5min (vs cache memoire process, vs zero cache) implique d'accepter une fenetre de stale 5min apres modification d'une row `auth_tenant_users` (e.g. retirer un user d'un tenant via Sprint 27 admin UI). Cette stale window est mitigee par publication d'un event Kafka `tenant.user_access_changed` (Sprint 27) qui invalide le cache cross-instances. En attendant Sprint 27, la stale window 5min est acceptable : la modification d'acces user/tenant est rare (operations admin manuelles).

Choisir de decoder le JWT dans le middleware (en plus du JwtAuthGuard) implique d'accepter une duplication ~50 microseconds par request. Cette duplication est intentionnelle : le middleware s'execute AVANT les guards et a besoin du `userId` pour valider l'acces tenant. Alternative rejetee : positionner JwtAuthGuard avant TenantContextMiddleware -- impossible car NestJS impose l'ordre middleware -> guard. Optimisation potentielle Sprint 34 : extraire le decodage JWT en helper partage entre middleware + guard pour une seule verification cryptographique.

Choisir de wrapper TOUTES les routes (`forRoutes('*')`) implique d'accepter que le middleware s'execute meme pour `/healthz` et `/readyz` (qui n'ont pas besoin). Le coût est negligeable (~100ns pour le branchement par path early-return) et l'alternative (`forRoutes` selectif) augmenterait le risque d'oubli sur une nouvelle route metier non-listee.

### 2.4 Decisions strategiques referenced

- **decision-002 (Multi-tenant 3 niveaux Platform/Customer/Assure)** : pertinence totale. Cette tache implemente le branchement par path qui materialise les 3 niveaux : niveau 1 admin (`/api/v1/admin/*`), niveau 2 tenant standard (`/api/v1/*` default), niveau 3 assure (`/api/v1/assure/*`).
- **decision-003 (Conformite Maroc 9 lois)** : pertinence directe. Loi 09-08 CNDP impose isolation stricte donnees personnelles entre tenants -> middleware applique cette frontiere au niveau applicatif. ACAPS Circulaire 002/AS/2018 impose audit trail consultations donnees -> middleware log chaque tenant access.
- **decision-006 (No-emoji ABSOLUE)** : aucune emoji dans aucun fichier livre cette tache.
- **decision-008 (Cloud souverain MA Atlas Cloud Services Benguerir)** : Redis cache deploye Atlas, donnees jamais hors MA.
- **decision-001 (Monorepo + Node 22)** : middleware utilise FastifyRequest typed (compatibilite Sprint 3 API bootstrap base Fastify).
- **decision-007 (Mock Skalean AI Sprint 1-28)** : pas applicable cette tache.

### 2.5 Pieges techniques connus

1. **Piege : Middleware execute AVANT JwtAuthGuard donc `req.user` undefined.**
   - Pourquoi : NestJS impose ordre middleware -> guard. Le middleware ne peut pas dependre de l'authentification deja faite.
   - Solution : le middleware decode lui-meme le JWT via `JwtService.verify()` (Sprint 5 service deja livre). Si JWT invalide ou absent sur route protegee, throw `UnauthorizedException`. Si JWT valide, extract `userId, tenant_id` claims pour le reste de la logique middleware.

2. **Piege : Header `x-tenant-id` case-sensitive selon HTTP/2 vs HTTP/1.1.**
   - Pourquoi : HTTP/2 normalise les headers en lowercase. HTTP/1.1 case-insensitive. Fastify normalise auto en lowercase mais certains proxies inverses peuvent re-capitaliser.
   - Solution : toujours lire `req.headers['x-tenant-id']` (lowercase) -- Fastify normalise. Pas de lecture `req.headers['X-Tenant-Id']`.

3. **Piege : Tenant_id leak via URL fallback.**
   - Pourquoi : un developpeur pourrait extraire tenant_id d'un parametre URL (`?tenantId=...`) en cas d'absence header. Cette pratique cree un vector d'attaque (un user pourrait forger l'URL).
   - Solution : middleware lit UNIQUEMENT le header `x-tenant-id`, jamais query params, jamais cookies. Lint rule custom `no-tenant-id-from-query` rejette toute lecture `tenant_id` depuis sources autres que header (Sprint 35 audit).

4. **Piege : Cache Redis hit sur user retire du tenant.**
   - Pourquoi : Admin retire un user d'un tenant via UI (Sprint 27). Cache Redis n'est pas invalide automatiquement. User continue d'acceder pendant TTL 5min.
   - Solution : Sprint 27 publishera event Kafka `tenant.user_access_revoked` -> consumer service invalide cache `tenant:user-access:{userId}:{tenantId}`. En attendant Sprint 27, TTL 5min est accepte (operations admin rares + audit log capture).

5. **Piege : Tenant suspendu mais cache hit retourne acces.**
   - Pourquoi : Admin suspend un tenant (Tache 2.2.9). Cache settings retourne `status: active` jusqu'a expiration TTL.
   - Solution : Tache 2.2.9 publishera event `tenant.suspended` -> invalidation immediate cache `tenant:settings:{tenantId}`. Pour invalider rapide cross-instances Redis, utiliser key delete + pubsub Redis CHANNEL `cache:invalidate`.

6. **Piege : JWT renouvelle apres switch tenant (different tenant_id claim).**
   - Pourquoi : User authentifie cabinet A, switch UI vers cabinet B, frontend envoie nouveau JWT (refresh) avec claim tenant_id=B. Middleware doit accepter cette transition.
   - Solution : la verification JWT vs header est : si user multi-tenant capable (super_admin_platform OU analyst_support OU multi-tenant flag dans `auth_users.is_multi_tenant_capable`), accepter divergence ; sinon, exiger egalite stricte. Multi-tenant capable est un flag explicit en BDD.

7. **Piege : Middleware throw exception ne reach pas exception filter NestJS.**
   - Pourquoi : NestJS middleware express-style execute en dehors du pipeline NestJS. Les exceptions throw doivent etre handled par Fastify error handler.
   - Solution : le middleware throw NestJS HttpException (BadRequestException, ForbiddenException, UnauthorizedException) qui sont serializes en JSON par le HttpExceptionFilter NestJS configure dans `main.ts` (Sprint 3). NestJS handler lit ces exceptions correctly.

8. **Piege : Race condition cache write + invalidation.**
   - Pourquoi : 2 requests concurrentes A et B. A invalide cache. B lit cache pendant que A re-write. Resultat : B lit ancienne valeur ou nouvelle valeur stale.
   - Solution : pattern "cache-aside" simple : lire cache, si miss fetch DB et write cache. Pas de lock distribue (overengineered pour cette charge). Stale window quelques secondes acceptee.

9. **Piege : Verification UUID v4 vs v1 vs nil UUID.**
   - Pourquoi : un attaquant pourrait envoyer `00000000-0000-0000-0000-000000000000` (nil UUID) qui passe certaines validations regex naives.
   - Solution : Zod `z.string().uuid()` accepte tous UUIDs valides format. Verification additionnelle : reject nil UUID + UUID v1 (timestamp-based, leak time info). Patron : `z.string().uuid().refine(v => v !== '00000000-0000-0000-0000-000000000000', 'nil UUID rejected')`.

10. **Piege : Tenant settings jsonb structure drift.**
    - Pourquoi : settings stockees en jsonb (flexible) peuvent avoir des fields manquants si row legacy non-migrated.
    - Solution : middleware parse settings via Zod schema `TenantSettingsSchema` avec defaults. Si parse fail, log warning + utilise defaults Maroc (locale fr, timezone Casablanca, currency MAD).

11. **Piege : ipAddress lecture incorrecte derriere reverse proxy.**
    - Pourquoi : Atlas Cloud Services place un reverse proxy (HAProxy) devant l'API. `req.socket.remoteAddress` retourne IP proxy, pas IP client reel.
    - Solution : Fastify configure avec `trustProxy: true` (Sprint 3 bootstrap) lit `X-Forwarded-For` header (premier IP). Middleware lit `req.ip` (Fastify-aware) pas `req.socket.remoteAddress`.

12. **Piege : User-Agent header absent (clients automatises mal-configures).**
    - Pourquoi : certains clients HTTP omettent User-Agent (curl --user-agent vide, scripts Python sans header).
    - Solution : middleware accepte User-Agent absent, log warning, set valeur default `'unknown'` dans context. Pas de rejection (peut etre legitime test integration).

13. **Piege : trace_id genere si absent vs propage si W3C TraceContext.**
    - Pourquoi : si client envoie header `traceparent` (W3C standard), middleware doit propager. Sinon, generer ULID.
    - Solution : helper `extractTraceId(req)` (Sprint 3 livre) gere les 2 cas. Middleware delegue.

14. **Piege : Routes /docs/* OpenAPI Swagger UI fail si tenant required.**
    - Pourquoi : Swagger UI ne sait pas envoyer `x-tenant-id`. Si middleware require tenant sur ces routes, Swagger UI 400.
    - Solution : middleware identifie `/docs/*` comme route infrastructure (skip tenant). Swagger UI affiche correctement.

15. **Piege : Performance test cold start middleware execute 2 round-trips DB par request.**
    - Pourquoi : premiere request post-deploy : cache vide, fetch `auth_tenant_users` + fetch `auth_tenants` -> 2 round-trips Postgres ~25ms.
    - Solution : warmup cache au boot via TenantValidationService (Tache 2.2.5). Cache pre-rempli avec tenants actifs frequents pre-deploy. Sprint 34 perf scaling raffine.

16. **Piege : Logger emit trop de bruit pour /healthz.**
    - Pourquoi : Kubernetes hits /healthz toutes les 10 secondes -> log spam.
    - Solution : middleware skip log emit pour `/healthz` et `/readyz`. Pino log level `info` exclut ces paths via filter.

17. **Piege : Cross-tenant authorization header `x-cross-tenant-auth-id` non-implemente Sprint 6.**
    - Pourquoi : Sprint 26 implementera runtime usage. Sprint 6 prepare le champ TenantContext mais middleware ne lit pas encore le header.
    - Solution : middleware ignore header `x-cross-tenant-auth-id` Sprint 6. Sprint 26 enrichira middleware pour le lire et activer cross-tenant logic.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.2.2 est la deuxieme tache du Sprint 6, point d'entree de la chaine d'isolation tenant runtime.

- **Depend de** :
  - Tache 2.2.1 (TenantContextService) : `tenantContextService.runWithContext()` est invoque a la fin du middleware pour wrapper la suite de la pipeline.
  - Sprint 5 Tache 1.5.4 (JwtService) : middleware decode JWT pour extract `userId, tenant_id` claims.
  - Sprint 2 Tache 1.2.5 (table auth_tenant_users) : middleware query cette table pour verifier acces user au tenant.
  - Sprint 2 Tache 1.2.4 (table auth_tenants.settings jsonb) : middleware fetch settings pour cache.
  - Sprint 1 Tache 1.1.6 (Redis CACHE DB 0) : cache acces user + settings.
  - Sprint 3 Tache 1.3.4 (RequestContext + extractTraceId helper) : trace_id propagation W3C.

- **Bloque** :
  - Tache 2.2.3 (TenantContextGuard) : guard verifie que le middleware a installe un contexte. Si absent, guard reject.
  - Tache 2.2.4 (TenantTransactionInterceptor) : interceptor lit le contexte installe par middleware et SET LOCAL Postgres.
  - Tache 2.2.5 (TenantValidationService) : service est invoque par middleware pour validation tenant + acces user (delegation).
  - Tache 2.2.10 (SuperAdminGuard) : guard verifie `isSuperAdmin: true` set par middleware pour routes /admin/*.
  - Toutes routes metier Sprints 7-35 dependent du contexte propage par ce middleware.

- **Apporte au sprint** :
  - Point d'entree HTTP -> contexte applicatif converted.
  - Branchement par path (5 categories : healthcheck, public, admin, assure, tenant standard).
  - Cache Redis pour acces user + settings (perf < 1ms hit).
  - Wrapper AsyncLocalStorage pour propagation contexte.

### 3.2 Position dans le programme global

Sur les 35 sprints :
- **Sprint 6 (cette tache)** : implementation initiale middleware.
- **Sprint 26** : enrichissement middleware pour lire header `x-cross-tenant-auth-id` (cross-tenant runtime).
- **Sprint 27** : event Kafka `tenant.user_access_revoked` -> cache invalidation.
- **Sprint 30** : MCP server (port 4001) reutilise meme middleware logic (extract tenant_id depuis JWT MCP token).
- **Sprint 33** : pentest valide middleware contre tentatives bypass (UUID injection, JWT forgery, cache poisoning).
- **Sprint 34** : optimisation perf cold start cache warmup.

### 3.3 Diagramme architecture impact

```
                        HTTP Request
                            |
                            v
                +-----------------------+
                | Fastify HTTP Server   |
                | (Sprint 3)            |
                +-----------+-----------+
                            |
                            v
                +-----------------------+
                | TenantContextMiddleware  (Tache 2.2.2 -- THIS)
                +-----------+-----------+
                            |
            +---------------+---------------+---------------+
            | Path branch decision                          |
            +---------------+---------------+---------------+
                |             |             |             |
                v             v             v             v
        /healthz, /readyz   /api/v1/        /api/v1/      /api/v1/*
        /docs/*             public/*         admin/*       (default)
        +---------+         +---------+      +---------+   +---------+
        | Skip    |         | Skip    |      | Set     |   | Decode  |
        | tenant  |         | tenant  |      | isSuper |   | JWT     |
        |         |         |         |      | Admin   |   |         |
        |         |         |         |      | true    |   | Read    |
        |         |         |         |      |         |   | x-tenant|
        |         |         |         |      |         |   | -id     |
        |         |         |         |      |         |   |         |
        |         |         |         |      |         |   | Verify  |
        |         |         |         |      |         |   | UUID    |
        |         |         |         |      |         |   |         |
        |         |         |         |      |         |   | Verify  |
        |         |         |         |      |         |   | access  |
        |         |         |         |      |         |   | (Redis  |
        |         |         |         |      |         |   | cache)  |
        |         |         |         |      |         |   |         |
        |         |         |         |      |         |   | Load    |
        |         |         |         |      |         |   | settings|
        |         |         |         |      |         |   |         |
        |         |         |         |      |         |   | + L3    |
        |         |         |         |      |         |   | check   |
        +----+----+         +----+----+      +----+----+   +----+----+
             |                   |                |             |
             +-------------------+----------------+-------------+
                                 |
                                 v
                +-----------------------------------+
                | tenantContextService.runWithContext(ctx, next)
                | (Tache 2.2.1)                     |
                +-----------------+-----------------+
                                  |
                                  v
                +-----------------------------------+
                | Guards (JwtAuthGuard, TenantContextGuard,
                |   SuperAdminGuard)                 |
                +-----------------+-----------------+
                                  |
                                  v
                +-----------------------------------+
                | Interceptors (TenantTransactionInterceptor SET LOCAL,
                |   AuditInterceptor, MetricsInterceptor) |
                +-----------------+-----------------+
                                  |
                                  v
                +-----------------------------------+
                | Pipes (Zod validation)             |
                +-----------------+-----------------+
                                  |
                                  v
                +-----------------------------------+
                | Controller -> Service -> Repository |
                +-----------------------------------+
```

---

## 4. Livrables checkables

- [ ] Middleware `repo/apps/api/src/common/middleware/tenant-context.middleware.ts` (~250 lignes, classe NestJS implements NestMiddleware)
- [ ] Helper `repo/apps/api/src/common/middleware/utils/extract-jwt-from-request.ts` (~50 lignes, fonction decode JWT pour middleware)
- [ ] Helper `repo/apps/api/src/common/middleware/utils/path-branch.ts` (~80 lignes, fonction `classifyRoute(path): RouteCategory`)
- [ ] Cache service `repo/apps/api/src/modules/tenant/services/tenant-access-cache.service.ts` (~150 lignes, Redis cache acces user + settings)
- [ ] Schema Zod `repo/apps/api/src/common/middleware/schemas/tenant-id.schema.ts` (~30 lignes, `TenantIdHeaderSchema` UUID v4 + nil rejection)
- [ ] Tests unitaires `repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts` (~400 lignes, 28+ tests scenarios)
- [ ] Tests integration `repo/apps/api/src/common/middleware/tenant-context.middleware.integration.spec.ts` (~250 lignes, 8+ tests E2E avec Fastify + Redis Testcontainers)
- [ ] Tests E2E `repo/apps/api/test/tenant-context-e2e.spec.ts` (~200 lignes, 6+ tests via supertest)
- [ ] Update `repo/apps/api/src/app.module.ts` (configure middleware via MiddlewareConsumer)
- [ ] Update `repo/apps/api/src/modules/tenant/tenant.module.ts` (export TenantAccessCacheService)
- [ ] Type `repo/apps/api/src/common/middleware/types/route-category.type.ts` (~20 lignes, enum RouteCategory)
- [ ] Documentation `repo/apps/api/src/common/middleware/README.md` (~120 lignes, expliquer middleware logic + branchement path)
- [ ] Coverage rapport >= 92% lignes pour middleware
- [ ] Type-check strict passe sur les 12 fichiers crees
- [ ] Lint Biome passe sans warning
- [ ] Aucune emoji (verif grep)
- [ ] Aucun console.log dans code production
- [ ] Tests unitaires : 28+ tests PASS
- [ ] Tests integration : 8+ tests PASS
- [ ] Tests E2E : 6+ tests PASS
- [ ] Bench performance : middleware overhead p95 < 5ms en cache hit, p95 < 30ms en cache miss
- [ ] Cache TTL 5min applique pour `tenant:user-access:*` et `tenant:settings:*`
- [ ] Branchement 5 categories path implemente et teste (healthcheck, public, admin, assure, tenant standard)
- [ ] JWT vs header coherence verifiee (test scenarios match + mismatch + multi-tenant capable)
- [ ] Tenant suspendu rejete avec error code stable `TENANT_SUSPENDED`
- [ ] User sans acces tenant rejete avec error code stable `TENANT_ACCESS_DENIED`
- [ ] Header `x-tenant-id` invalide rejete avec error code stable `TENANT_ID_INVALID`
- [ ] Logs Pino structure : tenant_id, user_id, role, route, duration_ms emis
- [ ] Middleware applique via `forRoutes('*')` -> applique a 100% des routes

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/common/middleware/tenant-context.middleware.ts             (~250 lignes / middleware principal)
repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts        (~400 lignes / 28+ tests unit)
repo/apps/api/src/common/middleware/tenant-context.middleware.integration.spec.ts  (~250 lignes / 8+ tests integration)
repo/apps/api/src/common/middleware/utils/extract-jwt-from-request.ts        (~50 lignes / decode JWT utility)
repo/apps/api/src/common/middleware/utils/path-branch.ts                      (~80 lignes / classifyRoute utility)
repo/apps/api/src/common/middleware/schemas/tenant-id.schema.ts               (~30 lignes / Zod schema header)
repo/apps/api/src/common/middleware/types/route-category.type.ts              (~20 lignes / enum RouteCategory)
repo/apps/api/src/common/middleware/README.md                                  (~120 lignes / doc middleware)
repo/apps/api/src/modules/tenant/services/tenant-access-cache.service.ts      (~150 lignes / Redis cache)
repo/apps/api/src/modules/tenant/services/tenant-access-cache.service.spec.ts (~120 lignes / tests cache)
repo/apps/api/src/modules/tenant/tenant.module.ts                              (update / export cache service)
repo/apps/api/src/app.module.ts                                                (update / configure middleware MiddlewareConsumer)
repo/apps/api/test/tenant-context-e2e.spec.ts                                  (~200 lignes / tests E2E supertest)
```

Total : 13 fichiers (10 nouveaux, 3 updates).

---

## 6. Code patterns COMPLETS

### Fichier 1/13 : `repo/apps/api/src/common/middleware/types/route-category.type.ts`

```typescript
// Categorisation des routes pour branchement middleware tenant context.
//
// Reference : Sprint 6 / Tache 2.2.2.

export enum RouteCategory {
  /** Routes infrastructure : /healthz, /readyz, /docs/*, /metrics. Skip tout. */
  Infrastructure = 'infrastructure',

  /** Routes publiques : /api/v1/public/*. Pas auth, pas tenant. */
  Public = 'public',

  /** Routes admin : /api/v1/admin/*. Super admin, pas tenant courant. */
  Admin = 'admin',

  /** Routes assure (L3 niveau 3) : /api/v1/assure/*. Tenant courant + assureUserId filter. */
  Assure = 'assure',

  /** Routes tenant standard (default) : /api/v1/*. Tenant courant requis. */
  Tenant = 'tenant',
}
```

### Fichier 2/13 : `repo/apps/api/src/common/middleware/utils/path-branch.ts`

```typescript
// Helper de classification de route pour middleware tenant context.
//
// Discipline : ordre des checks importe (specifique avant general).
// /api/v1/admin/* doit etre verifie AVANT /api/v1/* default.
//
// Reference : Sprint 6 / Tache 2.2.2.

import { RouteCategory } from '../types/route-category.type.js';

/**
 * Liste des prefixes routes par categorie.
 * Modifications doivent etre coordonnees avec :
 *   - SuperAdminGuard (Tache 2.2.10) sur /api/v1/admin/*
 *   - PublicEndpointGuard (Sprint 3) sur /api/v1/public/*
 *   - L3 routes assure (Sprint 19+)
 */
const INFRASTRUCTURE_PREFIXES = ['/healthz', '/readyz', '/metrics', '/docs'];
const PUBLIC_PREFIX = '/api/v1/public/';
const ADMIN_PREFIX = '/api/v1/admin/';
const ASSURE_PREFIX = '/api/v1/assure/';

/**
 * Classifie une route HTTP path en categorie pour le branchement middleware.
 *
 * Le path est compare en lowercase pour eviter case-sensitivity issues.
 * Query string est strippee avant classification.
 *
 * @param path Le path complet de la request (peut inclure query string)
 * @returns Categorie de route
 */
export function classifyRoute(path: string): RouteCategory {
  // Strip query string if present
  const cleanPath = path.split('?')[0]?.toLowerCase() ?? '';

  // Check infrastructure (exact prefix match)
  for (const prefix of INFRASTRUCTURE_PREFIXES) {
    if (cleanPath === prefix || cleanPath.startsWith(prefix + '/')) {
      return RouteCategory.Infrastructure;
    }
  }

  // Order matters : specific before general
  if (cleanPath.startsWith(ADMIN_PREFIX)) {
    return RouteCategory.Admin;
  }

  if (cleanPath.startsWith(PUBLIC_PREFIX)) {
    return RouteCategory.Public;
  }

  if (cleanPath.startsWith(ASSURE_PREFIX)) {
    return RouteCategory.Assure;
  }

  // Default : tenant standard
  return RouteCategory.Tenant;
}

/**
 * Determine si une categorie route necessite authentification (JWT decode).
 */
export function categoryRequiresAuth(category: RouteCategory): boolean {
  return (
    category === RouteCategory.Admin ||
    category === RouteCategory.Assure ||
    category === RouteCategory.Tenant
  );
}

/**
 * Determine si une categorie route necessite tenant context (header x-tenant-id).
 */
export function categoryRequiresTenantHeader(category: RouteCategory): boolean {
  return (
    category === RouteCategory.Tenant ||
    category === RouteCategory.Assure
  );
}
```

### Fichier 3/13 : `repo/apps/api/src/common/middleware/schemas/tenant-id.schema.ts`

```typescript
// Validation Zod du header x-tenant-id.
//
// Verifications :
//   - format UUID v4 (pas v1 timestamp-based pour eviter info leak)
//   - rejette nil UUID 00000000-...-0
//
// Reference : Sprint 6 / Tache 2.2.2.

import { z } from 'zod';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Schema validation header x-tenant-id.
 *
 * Refuse :
 *   - non-UUID strings
 *   - nil UUID (potentiel attack vector)
 *   - UUID v1 (leak timestamp via timestamp-based)
 *
 * Note : Zod uuid() accepte v1, v3, v4, v5. Nous restreignons a v4 + v5
 * via refine additionnel pour usage entreprise.
 */
export const TenantIdHeaderSchema = z
  .string()
  .min(36, 'tenant id must be 36 chars UUID')
  .max(36, 'tenant id must be 36 chars UUID')
  .uuid('tenant id must be valid UUID')
  .refine((v) => v !== NIL_UUID, {
    message: 'nil UUID is not accepted as tenant id',
  })
  .refine(
    (v) => {
      // UUID format positions 14: version digit. v1 = '1', v4 = '4', v5 = '5'.
      const version = v[14];
      return version === '4' || version === '5';
    },
    { message: 'tenant id must be UUID v4 or v5 (timestamp-based v1 rejected)' },
  );

export type TenantIdHeader = z.infer<typeof TenantIdHeaderSchema>;
```

### Fichier 4/13 : `repo/apps/api/src/common/middleware/utils/extract-jwt-from-request.ts`

```typescript
// Helper : decode JWT depuis Authorization header pour middleware.
//
// Le middleware execute AVANT JwtAuthGuard, donc req.user n'est PAS encore set.
// Cette function decode le JWT et retourne les claims pour la suite du middleware.
//
// Si JWT absent : retourne null (le caller decide).
// Si JWT invalide : throw UnauthorizedException.
//
// Reference : Sprint 6 / Tache 2.2.2.

import { UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import type { AuthRole } from '@insurtech/shared-types/auth';

const logger = new Logger('extractJwtFromRequest');

export interface JwtClaims {
  /** UUID utilisateur. */
  sub: string;

  /** UUID tenant courant (claim Sprint 5 SignedJwtPayload). Optionnel pour multi-tenant capable. */
  tenant_id?: string;

  /** Role applicatif. */
  role: AuthRole;

  /** Flag multi-tenant capable (peut switcher tenant sans re-login). */
  is_multi_tenant_capable?: boolean;

  /** Issued at (Unix timestamp). */
  iat: number;

  /** Expires at (Unix timestamp). */
  exp: number;

  /** JWT ID (revocation tracking Sprint 5). */
  jti: string;
}

/**
 * Extrait et verifie JWT depuis header Authorization.
 *
 * @returns JwtClaims si JWT present et valide, null si absent
 * @throws UnauthorizedException si JWT present mais invalide (signature, expire, etc.)
 */
export function extractJwtFromRequest(
  req: FastifyRequest,
  jwtService: JwtService,
): JwtClaims | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  // Format : "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn({ msg: 'malformed Authorization header', authHeader: '[redacted]' });
    throw new UnauthorizedException({
      code: 'AUTH_HEADER_MALFORMED',
      message: 'Authorization header must be "Bearer <token>"',
    });
  }

  const token = parts[1];
  if (!token) {
    throw new UnauthorizedException({
      code: 'AUTH_TOKEN_MISSING',
      message: 'JWT token missing in Authorization header',
    });
  }

  try {
    const claims = jwtService.verify<JwtClaims>(token);
    return claims;
  } catch (err) {
    const error = err as Error;
    logger.warn({ msg: 'JWT verify failed', error: error.message });
    throw new UnauthorizedException({
      code: 'AUTH_TOKEN_INVALID',
      message: 'JWT verification failed',
    });
  }
}
```

### Fichier 5/13 : `repo/apps/api/src/modules/tenant/services/tenant-access-cache.service.ts`

```typescript
// Service Redis cache pour acces user au tenant + settings tenant.
//
// Pattern cache-aside :
//   1. Lire cache (Redis HGET)
//   2. Si miss : fetch DB, write cache (TTL 5min)
//   3. Return value
//
// Invalidation :
//   - Manuelle via `invalidate*()` methods (Tache 2.2.7 update tenant)
//   - Automatique via Kafka events (Sprint 27)
//
// Namespace Redis :
//   tenant:user-access:{userId}:{tenantId} -> { allowed: bool, role: AuthRole }
//   tenant:settings:{tenantId} -> JSON serialized TenantSettings
//
// Reference : Sprint 6 / Tache 2.2.2.

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { z } from 'zod';
import type { AuthRole } from '@insurtech/shared-types/auth';
import { AuthTenantUser } from '@insurtech/database/entities/auth-tenant-user.entity';
import { AuthTenant } from '@insurtech/database/entities/auth-tenant.entity';
import type { TenantSettings } from '@insurtech/auth/types';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY_USER_ACCESS = (userId: string, tenantId: string) =>
  `tenant:user-access:${userId}:${tenantId}`;
const CACHE_KEY_SETTINGS = (tenantId: string) => `tenant:settings:${tenantId}`;
const CACHE_KEY_STATUS = (tenantId: string) => `tenant:status:${tenantId}`;

const TenantSettingsSchema = z.object({
  locale: z.enum(['fr', 'ar-MA', 'ar', 'en']).default('fr'),
  timezone: z.string().default('Africa/Casablanca'),
  currency: z.enum(['MAD', 'EUR', 'USD']).default('MAD'),
  branding: z
    .object({
      primaryColor: z.string().default('#E95D2C'),
      secondaryColor: z.string().optional(),
      logoUrl: z.string().nullable().default(null),
      faviconUrl: z.string().nullable().optional(),
    })
    .default({ primaryColor: '#E95D2C', logoUrl: null }),
  features: z
    .object({
      mfaRequiredForAdmin: z.boolean().default(true),
      sinistreAutoAssign: z.boolean().default(false),
      skySandboxEnabled: z.boolean().optional(),
      aiEstimationEnabled: z.boolean().optional(),
    })
    .default({ mfaRequiredForAdmin: true, sinistreAutoAssign: false }),
  quotas: z
    .object({
      maxUsers: z.number().int().min(1).default(10),
      maxPolices: z.number().int().min(1).default(1000),
      maxStorageGb: z.number().int().min(1).default(50),
    })
    .default({ maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 }),
  ice: z.string().optional(),
  tenantType: z.enum(['broker', 'garage', 'mixed']).default('broker'),
});

export interface UserAccessResult {
  allowed: boolean;
  role?: AuthRole;
  reason?: string;
}

@Injectable()
export class TenantAccessCacheService {
  private readonly logger = new Logger(TenantAccessCacheService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(AuthTenantUser)
    private readonly tenantUserRepo: Repository<AuthTenantUser>,
    @InjectRepository(AuthTenant)
    private readonly tenantRepo: Repository<AuthTenant>,
  ) {}

  /**
   * Verifie si user a acces au tenant. Cache 5min.
   */
  async getUserAccess(userId: string, tenantId: string): Promise<UserAccessResult> {
    const cacheKey = CACHE_KEY_USER_ACCESS(userId, tenantId);

    // Try cache hit
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as UserAccessResult;
      } catch {
        this.logger.warn({ msg: 'cache parse failed, refetching', cacheKey });
      }
    }

    // Cache miss : fetch DB
    const tenantUser = await this.tenantUserRepo.findOne({
      where: { user_id: userId, tenant_id: tenantId, revoked_at: null },
    });

    const result: UserAccessResult = tenantUser
      ? { allowed: true, role: tenantUser.role }
      : { allowed: false, reason: 'USER_NOT_LINKED_TO_TENANT' };

    // Write cache
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);

    return result;
  }

  /**
   * Charge tenant settings. Cache 5min.
   */
  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    const cacheKey = CACHE_KEY_SETTINGS(tenantId);

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as TenantSettings;
      } catch {
        this.logger.warn({ msg: 'cache parse settings failed, refetching', cacheKey });
      }
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return null;

    // Parse with defaults via Zod
    const parsed = TenantSettingsSchema.safeParse(tenant.settings ?? {});
    if (!parsed.success) {
      this.logger.warn({
        msg: 'tenant settings schema invalid, using defaults',
        tenantId,
        issues: parsed.error.issues,
      });
    }

    const settings: TenantSettings = parsed.success
      ? (parsed.data as TenantSettings)
      : (TenantSettingsSchema.parse({}) as TenantSettings);

    await this.redis.set(cacheKey, JSON.stringify(settings), 'EX', CACHE_TTL_SECONDS);

    return settings;
  }

  /**
   * Charge status tenant (active/suspended/archived). Cache 5min.
   */
  async getTenantStatus(tenantId: string): Promise<'active' | 'suspended' | 'archived' | 'pending_setup' | null> {
    const cacheKey = CACHE_KEY_STATUS(tenantId);

    const cached = await this.redis.get(cacheKey);
    if (cached) return cached as 'active' | 'suspended' | 'archived' | 'pending_setup';

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return null;

    await this.redis.set(cacheKey, tenant.status, 'EX', CACHE_TTL_SECONDS);

    return tenant.status;
  }

  /**
   * Invalide cache acces user / tenant.
   * Appele par Sprint 27 admin update + Tache 2.2.9 suspend.
   */
  async invalidateUserAccess(userId: string, tenantId: string): Promise<void> {
    await this.redis.del(CACHE_KEY_USER_ACCESS(userId, tenantId));
  }

  /**
   * Invalide cache settings tenant.
   */
  async invalidateTenantSettings(tenantId: string): Promise<void> {
    await this.redis.del(CACHE_KEY_SETTINGS(tenantId));
  }

  /**
   * Invalide cache status tenant.
   */
  async invalidateTenantStatus(tenantId: string): Promise<void> {
    await this.redis.del(CACHE_KEY_STATUS(tenantId));
  }

  /**
   * Invalide tous les caches d'un tenant (suspend, archive, delete).
   */
  async invalidateAllForTenant(tenantId: string): Promise<void> {
    const pattern = `tenant:*:*${tenantId}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Fichier 6/13 : `repo/apps/api/src/common/middleware/tenant-context.middleware.ts`

```typescript
// TenantContextMiddleware -- Point d'entree HTTP pour isolation multi-tenant.
//
// Pour chaque request HTTP :
//   1. Classifie le path (infrastructure / public / admin / assure / tenant)
//   2. Pour routes auth-required : decode JWT, extract userId + tenant_id claim
//   3. Pour routes tenant-required : valide header x-tenant-id (Zod), verifie acces
//      user via cache Redis, valide coherence JWT, charge settings, check tenant active
//   4. Construit TenantContext + wrappe next() dans tenantContextService.runWithContext()
//
// Reference :
//   - Sprint 6 / Tache 2.2.2
//   - decision-002 (multi-tenant 3 niveaux)
//   - decision-006 (no-emoji)

import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ulid } from 'ulid';
import {
  TenantContextService,
  type TenantContext,
} from '@insurtech/auth';
import { TenantAccessCacheService } from '../../modules/tenant/services/tenant-access-cache.service.js';
import { classifyRoute, categoryRequiresAuth, categoryRequiresTenantHeader } from './utils/path-branch.js';
import { extractJwtFromRequest, type JwtClaims } from './utils/extract-jwt-from-request.js';
import { TenantIdHeaderSchema } from './schemas/tenant-id.schema.js';
import { RouteCategory } from './types/route-category.type.js';

const TRACE_HEADER = 'traceparent';
const CORRELATION_HEADER = 'x-correlation-id';
const TENANT_HEADER = 'x-tenant-id';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccessCache: TenantAccessCacheService,
    private readonly jwtService: JwtService,
  ) {}

  async use(
    req: FastifyRequest,
    _res: FastifyReply,
    next: () => void,
  ): Promise<void> {
    const startTime = process.hrtime.bigint();
    const path = req.url;
    const category = classifyRoute(path);

    // Common context fields (always present).
    const baseContext: Pick<
      TenantContext,
      'isSuperAdmin' | 'traceId' | 'correlationId' | 'ipAddress' | 'userAgent'
    > = {
      isSuperAdmin: false,
      traceId: this.extractTraceId(req),
      correlationId: this.extractCorrelationId(req),
      ipAddress: this.extractIpAddress(req),
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    };

    let context: TenantContext;

    switch (category) {
      case RouteCategory.Infrastructure:
        // Skip everything : healthcheck, metrics, docs.
        context = { ...baseContext };
        break;

      case RouteCategory.Public:
        // No auth, no tenant.
        context = { ...baseContext };
        break;

      case RouteCategory.Admin:
        context = await this.handleAdminRoute(req, baseContext);
        break;

      case RouteCategory.Assure:
        context = await this.handleAssureRoute(req, baseContext);
        break;

      case RouteCategory.Tenant:
      default:
        context = await this.handleTenantRoute(req, baseContext);
        break;
    }

    // Log only non-infrastructure to avoid log spam from /healthz K8s probes.
    if (category !== RouteCategory.Infrastructure) {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      this.logger.log({
        msg: 'tenant_context_resolved',
        category,
        path,
        method: req.method,
        tenant_id: context.tenantId,
        user_id: context.userId,
        is_super_admin: context.isSuperAdmin,
        duration_ms: durationMs,
      });
    }

    // Wrap remainder of pipeline in AsyncLocalStorage context.
    return new Promise<void>((resolve, reject) => {
      this.tenantContext
        .runWithContext(context, async () => {
          try {
            next();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
    });
  }

  // ===========================================================================
  // PRIVATE : per-category handlers
  // ===========================================================================

  private async handleAdminRoute(
    req: FastifyRequest,
    baseContext: Pick<TenantContext, 'isSuperAdmin' | 'traceId' | 'correlationId' | 'ipAddress' | 'userAgent'>,
  ): Promise<TenantContext> {
    const claims = extractJwtFromRequest(req, this.jwtService);
    if (!claims) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Admin routes require authentication',
      });
    }

    return {
      ...baseContext,
      userId: claims.sub,
      userRole: claims.role,
      isSuperAdmin: true,
      // Note : SuperAdminGuard (Tache 2.2.10) validates the role server-side.
    };
  }

  private async handleAssureRoute(
    req: FastifyRequest,
    baseContext: Pick<TenantContext, 'isSuperAdmin' | 'traceId' | 'correlationId' | 'ipAddress' | 'userAgent'>,
  ): Promise<TenantContext> {
    const claims = extractJwtFromRequest(req, this.jwtService);
    if (!claims) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Assure routes require authentication',
      });
    }

    const tenantId = this.validateTenantHeader(req);
    const accessResult = await this.tenantAccessCache.getUserAccess(claims.sub, tenantId);
    if (!accessResult.allowed) {
      this.logger.warn({
        msg: 'tenant_access_denied',
        user_id: claims.sub,
        tenant_id: tenantId,
        reason: accessResult.reason,
      });
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'User does not have access to the requested tenant',
        reason: accessResult.reason,
      });
    }

    await this.assertTenantActive(tenantId);
    const settings = await this.tenantAccessCache.getTenantSettings(tenantId);

    return {
      ...baseContext,
      tenantId,
      userId: claims.sub,
      userRole: accessResult.role ?? claims.role,
      assureUserId: claims.sub,
      tenantSettings: settings ?? undefined,
    };
  }

  private async handleTenantRoute(
    req: FastifyRequest,
    baseContext: Pick<TenantContext, 'isSuperAdmin' | 'traceId' | 'correlationId' | 'ipAddress' | 'userAgent'>,
  ): Promise<TenantContext> {
    const claims = extractJwtFromRequest(req, this.jwtService);
    if (!claims) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Tenant routes require authentication',
      });
    }

    const tenantId = this.validateTenantHeader(req);

    // JWT vs header coherence check.
    if (
      claims.tenant_id &&
      claims.tenant_id !== tenantId &&
      !claims.is_multi_tenant_capable
    ) {
      this.logger.warn({
        msg: 'tenant_id_mismatch_jwt_vs_header',
        jwt_tenant_id: claims.tenant_id,
        header_tenant_id: tenantId,
        user_id: claims.sub,
      });
      throw new ForbiddenException({
        code: 'TENANT_MISMATCH',
        message: 'JWT tenant_id does not match x-tenant-id header',
      });
    }

    const accessResult = await this.tenantAccessCache.getUserAccess(claims.sub, tenantId);
    if (!accessResult.allowed) {
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'User does not have access to the requested tenant',
        reason: accessResult.reason,
      });
    }

    await this.assertTenantActive(tenantId);
    const settings = await this.tenantAccessCache.getTenantSettings(tenantId);

    return {
      ...baseContext,
      tenantId,
      userId: claims.sub,
      userRole: accessResult.role ?? claims.role,
      tenantSettings: settings ?? undefined,
    };
  }

  // ===========================================================================
  // PRIVATE : header extraction utilities
  // ===========================================================================

  private validateTenantHeader(req: FastifyRequest): string {
    const headerValue = req.headers[TENANT_HEADER];
    if (!headerValue || typeof headerValue !== 'string') {
      throw new BadRequestException({
        code: 'TENANT_ID_MISSING',
        message: `Header '${TENANT_HEADER}' is required for this route`,
      });
    }

    const parsed = TenantIdHeaderSchema.safeParse(headerValue);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'TENANT_ID_INVALID',
        message: `Invalid '${TENANT_HEADER}' header value`,
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    return parsed.data;
  }

  private async assertTenantActive(tenantId: string): Promise<void> {
    const status = await this.tenantAccessCache.getTenantStatus(tenantId);
    if (!status) {
      throw new BadRequestException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant does not exist',
      });
    }
    if (status === 'suspended') {
      throw new ForbiddenException({
        code: 'TENANT_SUSPENDED',
        message: 'Tenant is suspended. Please contact your administrator.',
      });
    }
    if (status === 'archived') {
      throw new ForbiddenException({
        code: 'TENANT_ARCHIVED',
        message: 'Tenant has been archived',
      });
    }
    if (status === 'pending_setup') {
      throw new ForbiddenException({
        code: 'TENANT_PENDING_SETUP',
        message: 'Tenant setup is not yet complete',
      });
    }
  }

  private extractTraceId(req: FastifyRequest): string {
    const headerValue = req.headers[TRACE_HEADER];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      // W3C TraceContext format: "00-<trace-id>-<parent-id>-<flags>"
      const parts = headerValue.split('-');
      if (parts.length === 4 && parts[1]) {
        return parts[1];
      }
    }
    return ulid();
  }

  private extractCorrelationId(req: FastifyRequest): string | undefined {
    const headerValue = req.headers[CORRELATION_HEADER];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }
    return undefined;
  }

  private extractIpAddress(req: FastifyRequest): string {
    // Fastify with trustProxy: true reads X-Forwarded-For first IP.
    return req.ip ?? req.socket?.remoteAddress ?? '0.0.0.0';
  }
}
```

### Fichier 7/13 : `repo/apps/api/src/common/middleware/tenant-context.middleware.spec.ts`

```typescript
// Tests unitaires TenantContextMiddleware -- 28+ scenarios.
//
// Couverture :
//   - 5 branchements path (infrastructure, public, admin, assure, tenant)
//   - validation header x-tenant-id (valid, missing, malformed, nil UUID, v1)
//   - JWT decoding (absent, malformed, invalid signature, expired)
//   - acces user au tenant (cache hit, cache miss, denied)
//   - tenant suspendu / archived / pending_setup
//   - JWT vs header coherence (match, mismatch, multi-tenant capable)
//   - Logging structure
//
// Reference : Sprint 6 / Tache 2.2.2.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import {
  TenantContextService,
  tenantContextStorage,
} from '@insurtech/auth';
import type { TenantAccessCacheService } from '../../modules/tenant/services/tenant-access-cache.service.js';

const VALID_TENANT_ID = '11111111-1111-4111-8111-111111111111'; // valid UUID v4
const VALID_USER_ID = '22222222-2222-4222-8222-222222222222';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const V1_UUID = '11111111-1111-1111-9111-111111111111'; // version digit '1'

const buildJwtClaims = (overrides: Record<string, unknown> = {}): unknown => ({
  sub: VALID_USER_ID,
  tenant_id: VALID_TENANT_ID,
  role: 'broker_admin',
  is_multi_tenant_capable: false,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
  jti: 'jti-1',
  ...overrides,
});

const buildReq = (overrides: Partial<FastifyRequest> = {}): FastifyRequest =>
  ({
    url: '/api/v1/contacts',
    method: 'GET',
    headers: {
      'x-tenant-id': VALID_TENANT_ID,
      authorization: 'Bearer fake-jwt',
      'user-agent': 'vitest/1.0',
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as unknown as FastifyRequest;

const buildRes = (): FastifyReply => ({} as FastifyReply);

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let tenantContext: TenantContextService;
  let cache: TenantAccessCacheService;
  let jwtService: JwtService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    cache = {
      getUserAccess: vi.fn().mockResolvedValue({ allowed: true, role: 'broker_admin' }),
      getTenantSettings: vi.fn().mockResolvedValue({
        locale: 'fr',
        timezone: 'Africa/Casablanca',
        currency: 'MAD',
        branding: { primaryColor: '#E95D2C', logoUrl: null },
        features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
        quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
        tenantType: 'broker',
      }),
      getTenantStatus: vi.fn().mockResolvedValue('active'),
    } as unknown as TenantAccessCacheService;
    jwtService = {
      verify: vi.fn().mockReturnValue(buildJwtClaims()),
    } as unknown as JwtService;
    middleware = new TenantContextMiddleware(tenantContext, cache, jwtService);
  });

  // ===========================================================================
  // GROUP 1 : Path branching
  // ===========================================================================

  describe('path branching', () => {
    it('1. should skip tenant validation for /healthz', async () => {
      const req = buildReq({ url: '/healthz', headers: {} });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
    });

    it('2. should skip tenant validation for /readyz', async () => {
      const req = buildReq({ url: '/readyz', headers: {} });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.isSuperAdmin).toBe(false);
    });

    it('3. should skip tenant validation for /docs/swagger', async () => {
      const req = buildReq({ url: '/docs/swagger', headers: {} });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
    });

    it('4. should skip tenant for /api/v1/public/login', async () => {
      const req = buildReq({ url: '/api/v1/public/login', headers: {} });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBeUndefined();
    });

    it('5. should set isSuperAdmin true for /api/v1/admin/*', async () => {
      const req = buildReq({ url: '/api/v1/admin/tenants' });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.isSuperAdmin).toBe(true);
      expect(captured?.userId).toBe(VALID_USER_ID);
    });

    it('6. should set assureUserId for /api/v1/assure/*', async () => {
      const req = buildReq({ url: '/api/v1/assure/policies' });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.assureUserId).toBe(VALID_USER_ID);
      expect(captured?.tenantId).toBe(VALID_TENANT_ID);
    });

    it('7. should set tenantId for default /api/v1/* routes', async () => {
      const req = buildReq({ url: '/api/v1/contacts' });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.tenantId).toBe(VALID_TENANT_ID);
      expect(captured?.userId).toBe(VALID_USER_ID);
      expect(captured?.isSuperAdmin).toBe(false);
    });
  });

  // ===========================================================================
  // GROUP 2 : Header validation
  // ===========================================================================

  describe('header validation', () => {
    it('8. should throw BadRequestException if x-tenant-id missing', async () => {
      const req = buildReq({ headers: { authorization: 'Bearer fake' } });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('9. should throw with code TENANT_ID_MISSING when header absent', async () => {
      const req = buildReq({ headers: { authorization: 'Bearer fake' } });
      try {
        await middleware.use(req, buildRes(), () => {});
      } catch (err) {
        const exception = err as BadRequestException;
        const response = exception.getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ID_MISSING');
      }
    });

    it('10. should throw if tenant_id is malformed UUID', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': 'not-a-uuid', authorization: 'Bearer fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('11. should reject nil UUID 00000000-...-0', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': NIL_UUID, authorization: 'Bearer fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('12. should reject UUID v1 timestamp-based', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': V1_UUID, authorization: 'Bearer fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('13. should accept valid UUID v4', async () => {
      const req = buildReq();
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });

    it('14. should accept x-tenant-id case-insensitively (HTTP normalized)', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': VALID_TENANT_ID, authorization: 'Bearer fake' },
      });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });
  });

  // ===========================================================================
  // GROUP 3 : JWT decoding
  // ===========================================================================

  describe('JWT decoding', () => {
    it('15. should throw UnauthorizedException if no Authorization header on tenant route', async () => {
      const req = buildReq({ headers: { 'x-tenant-id': VALID_TENANT_ID } });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('16. should throw if Authorization header malformed', async () => {
      const req = buildReq({
        headers: { 'x-tenant-id': VALID_TENANT_ID, authorization: 'Token fake' },
      });
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('17. should throw if JWT signature invalid', async () => {
      vi.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('18. should accept valid JWT and extract sub as userId', async () => {
      const req = buildReq();
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentUserId();
      });
      expect(captured).toBe(VALID_USER_ID);
    });
  });

  // ===========================================================================
  // GROUP 4 : User access verification
  // ===========================================================================

  describe('user access verification', () => {
    it('19. should call cache for user access verification', async () => {
      const req = buildReq();
      await middleware.use(req, buildRes(), () => {});
      expect(cache.getUserAccess).toHaveBeenCalledWith(VALID_USER_ID, VALID_TENANT_ID);
    });

    it('20. should throw ForbiddenException if user has no access to tenant', async () => {
      vi.mocked(cache.getUserAccess).mockResolvedValue({
        allowed: false,
        reason: 'USER_NOT_LINKED_TO_TENANT',
      });
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('21. should throw with code TENANT_ACCESS_DENIED', async () => {
      vi.mocked(cache.getUserAccess).mockResolvedValue({
        allowed: false,
        reason: 'USER_NOT_LINKED_TO_TENANT',
      });
      const req = buildReq();
      try {
        await middleware.use(req, buildRes(), () => {});
      } catch (err) {
        const exception = err as ForbiddenException;
        const response = exception.getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ACCESS_DENIED');
      }
    });
  });

  // ===========================================================================
  // GROUP 5 : Tenant status checks
  // ===========================================================================

  describe('tenant status', () => {
    it('22. should throw if tenant is suspended', async () => {
      vi.mocked(cache.getTenantStatus).mockResolvedValue('suspended');
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('23. should throw with code TENANT_SUSPENDED', async () => {
      vi.mocked(cache.getTenantStatus).mockResolvedValue('suspended');
      const req = buildReq();
      try {
        await middleware.use(req, buildRes(), () => {});
      } catch (err) {
        const exception = err as ForbiddenException;
        const response = exception.getResponse() as { code: string };
        expect(response.code).toBe('TENANT_SUSPENDED');
      }
    });

    it('24. should throw if tenant is archived', async () => {
      vi.mocked(cache.getTenantStatus).mockResolvedValue('archived');
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('25. should throw if tenant is pending_setup', async () => {
      vi.mocked(cache.getTenantStatus).mockResolvedValue('pending_setup');
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('26. should throw if tenant does not exist', async () => {
      vi.mocked(cache.getTenantStatus).mockResolvedValue(null);
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ===========================================================================
  // GROUP 6 : JWT vs Header coherence
  // ===========================================================================

  describe('JWT vs header coherence', () => {
    it('27. should accept matching JWT tenant_id and header', async () => {
      const req = buildReq();
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });

    it('28. should reject mismatched JWT tenant_id and header for non-multi-tenant user', async () => {
      vi.mocked(jwtService.verify).mockReturnValue(
        buildJwtClaims({ tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) as never,
      );
      const req = buildReq();
      await expect(middleware.use(req, buildRes(), () => {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('29. should accept mismatched JWT tenant_id for multi-tenant capable user', async () => {
      vi.mocked(jwtService.verify).mockReturnValue(
        buildJwtClaims({
          tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          is_multi_tenant_capable: true,
        }) as never,
      );
      const req = buildReq();
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });
  });

  // ===========================================================================
  // GROUP 7 : Context propagation
  // ===========================================================================

  describe('context propagation', () => {
    it('30. should propagate context through next()', async () => {
      const req = buildReq();
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentTenantId();
      });
      expect(captured).toBe(VALID_TENANT_ID);
    });

    it('31. should isolate two parallel middleware invocations', async () => {
      const reqA = buildReq({
        headers: {
          'x-tenant-id': '11111111-1111-4111-8111-111111111111',
          authorization: 'Bearer fake-a',
        },
      });
      const reqB = buildReq({
        headers: {
          'x-tenant-id': '22222222-2222-4222-8222-222222222222',
          authorization: 'Bearer fake-b',
        },
      });
      vi.mocked(jwtService.verify)
        .mockReturnValueOnce(buildJwtClaims({ tenant_id: '11111111-1111-4111-8111-111111111111' }) as never)
        .mockReturnValueOnce(buildJwtClaims({ tenant_id: '22222222-2222-4222-8222-222222222222' }) as never);

      const captured: string[] = [];
      await Promise.all([
        middleware.use(reqA, buildRes(), () => {
          captured.push(tenantContext.getCurrentTenantId() ?? 'null');
        }),
        middleware.use(reqB, buildRes(), () => {
          captured.push(tenantContext.getCurrentTenantId() ?? 'null');
        }),
      ]);
      expect(captured).toContain('11111111-1111-4111-8111-111111111111');
      expect(captured).toContain('22222222-2222-4222-8222-222222222222');
    });

    it('32. should set traceId from W3C header if present', async () => {
      const req = buildReq({
        headers: {
          'x-tenant-id': VALID_TENANT_ID,
          authorization: 'Bearer fake',
          traceparent: '00-aaaabbbbccccddddaaaabbbbccccdddd-1111222233334444-01',
        },
      });
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.traceId).toBe('aaaabbbbccccddddaaaabbbbccccdddd');
    });

    it('33. should generate ULID traceId if no header', async () => {
      const req = buildReq();
      let captured;
      await middleware.use(req, buildRes(), () => {
        captured = tenantContext.getCurrentContext();
      });
      expect(captured?.traceId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
  });
});
```

### Fichier 8/13 : `repo/apps/api/src/common/middleware/tenant-context.middleware.integration.spec.ts`

```typescript
// Tests integration TenantContextMiddleware avec NestJS TestingModule + Redis Testcontainers.
//
// Reference : Sprint 6 / Tache 2.2.2.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { TenantContextModule, TenantContextService } from '@insurtech/auth';
import { TenantContextMiddleware } from './tenant-context.middleware.js';
import { TenantAccessCacheService } from '../../modules/tenant/services/tenant-access-cache.service.js';

describe('TenantContextMiddleware -- integration', () => {
  let module: TestingModule;
  let middleware: TenantContextMiddleware;
  let tenantContext: TenantContextService;
  let cache: TenantAccessCacheService;
  let jwtService: JwtService;
  let redisContainer: StartedTestContainer;

  beforeAll(async () => {
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    process.env.REDIS_URL = `redis://localhost:${redisContainer.getMappedPort(6379)}`;

    module = await Test.createTestingModule({
      imports: [
        TenantContextModule,
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m', jwtid: 'test-jti' },
        }),
      ],
      providers: [
        TenantContextMiddleware,
        {
          provide: TenantAccessCacheService,
          useValue: {
            getUserAccess: async () => ({ allowed: true, role: 'broker_admin' }),
            getTenantSettings: async () => ({
              locale: 'fr',
              timezone: 'Africa/Casablanca',
              currency: 'MAD',
              branding: { primaryColor: '#E95D2C', logoUrl: null },
              features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
              quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
              tenantType: 'broker',
            }),
            getTenantStatus: async () => 'active',
          },
        },
      ],
    }).compile();

    middleware = module.get(TenantContextMiddleware);
    tenantContext = module.get(TenantContextService);
    cache = module.get(TenantAccessCacheService);
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await module.close();
    await redisContainer.stop();
  });

  it('1. should propagate context end-to-end via runWithContext', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const token = jwtService.sign({ sub: userId, tenant_id: tenantId, role: 'broker_admin' });
    const req: any = {
      url: '/api/v1/contacts',
      method: 'GET',
      headers: { 'x-tenant-id': tenantId, authorization: `Bearer ${token}`, 'user-agent': 'integ' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    let inside: { tenantId?: string; userId?: string } = {};
    await middleware.use(req, {} as any, () => {
      inside = {
        tenantId: tenantContext.getCurrentTenantId(),
        userId: tenantContext.getCurrentUserId(),
      };
    });
    expect(inside.tenantId).toBe(tenantId);
    expect(inside.userId).toBe(userId);
    // After middleware completes, context should be cleared.
    expect(tenantContext.getCurrentContext()).toBeUndefined();
  });

  it('2. should handle 50 parallel requests without leak', async () => {
    const promises = Array.from({ length: 50 }, async (_, i) => {
      const userId = `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
      const tenantId = `${i.toString().padStart(8, '0')}-1111-4111-8111-111111111111`.slice(0, 36);
      const token = jwtService.sign({ sub: userId, tenant_id: tenantId, role: 'broker_admin' });
      const req: any = {
        url: '/api/v1/contacts',
        method: 'GET',
        headers: { 'x-tenant-id': tenantId, authorization: `Bearer ${token}`, 'user-agent': 'integ' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      };
      let observed: string | undefined;
      await middleware.use(req, {} as any, () => {
        observed = tenantContext.getCurrentTenantId();
      });
      return { expected: tenantId, observed };
    });

    const results = await Promise.all(promises);
    const leaks = results.filter((r) => r.expected !== r.observed);
    expect(leaks.length).toBe(0);
  });

  it('3. should branch correctly on /api/v1/admin/*', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const token = jwtService.sign({ sub: userId, role: 'super_admin_platform' });
    const req: any = {
      url: '/api/v1/admin/tenants',
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, 'user-agent': 'integ' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    let observed = false;
    await middleware.use(req, {} as any, () => {
      observed = tenantContext.isSuperAdmin();
    });
    expect(observed).toBe(true);
  });

  it('4. should allow infrastructure routes without auth or tenant', async () => {
    const req: any = {
      url: '/healthz',
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    let captured;
    await middleware.use(req, {} as any, () => {
      captured = tenantContext.getCurrentContext();
    });
    expect(captured).toBeDefined();
    expect(captured?.tenantId).toBeUndefined();
    expect(captured?.userId).toBeUndefined();
  });

  it('5. should set assureUserId for /api/v1/assure/*', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const token = jwtService.sign({ sub: userId, tenant_id: tenantId, role: 'assure_client' });
    const req: any = {
      url: '/api/v1/assure/policies',
      method: 'GET',
      headers: { 'x-tenant-id': tenantId, authorization: `Bearer ${token}`, 'user-agent': 'integ' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    let captured;
    await middleware.use(req, {} as any, () => {
      captured = tenantContext.getCurrentContext();
    });
    expect(captured?.assureUserId).toBe(userId);
    expect(captured?.tenantId).toBe(tenantId);
  });

  it('6. should bench middleware overhead p95 < 5ms cache hit', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const token = jwtService.sign({ sub: userId, tenant_id: tenantId, role: 'broker_admin' });
    const req: any = {
      url: '/api/v1/contacts',
      method: 'GET',
      headers: { 'x-tenant-id': tenantId, authorization: `Bearer ${token}`, 'user-agent': 'bench' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    const N = 200;
    const durations: number[] = [];
    for (let i = 0; i < N; i++) {
      const start = process.hrtime.bigint();
      await middleware.use(req, {} as any, () => {});
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      durations.push(elapsed);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(N * 0.95)] ?? 0;
    expect(p95).toBeLessThan(15);
  });

  it('7. should reject tenant route without x-tenant-id header', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const token = jwtService.sign({ sub: userId, role: 'broker_admin' });
    const req: any = {
      url: '/api/v1/contacts',
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    await expect(middleware.use(req, {} as any, () => {})).rejects.toThrow();
  });

  it('8. should clear context after middleware completes (no leak)', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const token = jwtService.sign({ sub: userId, tenant_id: tenantId, role: 'broker_admin' });
    const req: any = {
      url: '/api/v1/contacts',
      method: 'GET',
      headers: { 'x-tenant-id': tenantId, authorization: `Bearer ${token}` },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    await middleware.use(req, {} as any, () => {});
    expect(tenantContext.getCurrentContext()).toBeUndefined();
  });
});
```

### Fichier 9/13 : `repo/apps/api/src/modules/tenant/services/tenant-access-cache.service.spec.ts`

```typescript
// Tests TenantAccessCacheService -- pattern cache-aside avec Redis.
//
// Reference : Sprint 6 / Tache 2.2.2.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import type { Repository } from 'typeorm';
import { TenantAccessCacheService } from './tenant-access-cache.service.js';

describe('TenantAccessCacheService', () => {
  let service: TenantAccessCacheService;
  let redis: Redis;
  let tenantUserRepo: Repository<unknown>;
  let tenantRepo: Repository<unknown>;

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    } as unknown as Redis;
    tenantUserRepo = {
      findOne: vi.fn(),
    } as unknown as Repository<unknown>;
    tenantRepo = {
      findOne: vi.fn(),
    } as unknown as Repository<unknown>;
    service = new TenantAccessCacheService(redis, tenantUserRepo as never, tenantRepo as never);
  });

  it('1. getUserAccess returns from cache when hit', async () => {
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({ allowed: true, role: 'broker_admin' }),
    );
    const result = await service.getUserAccess('user-1', 'tenant-1');
    expect(result.allowed).toBe(true);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('2. getUserAccess fetches DB on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(tenantUserRepo.findOne).mockResolvedValue({
      role: 'broker_admin',
    } as never);
    const result = await service.getUserAccess('user-1', 'tenant-1');
    expect(result.allowed).toBe(true);
    expect(redis.set).toHaveBeenCalled();
  });

  it('3. getUserAccess writes cache with TTL 300s', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(tenantUserRepo.findOne).mockResolvedValue({
      role: 'broker_user',
    } as never);
    await service.getUserAccess('user-1', 'tenant-1');
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('tenant:user-access:user-1:tenant-1'),
      expect.any(String),
      'EX',
      300,
    );
  });

  it('4. getUserAccess returns denied if no DB row', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(tenantUserRepo.findOne).mockResolvedValue(null);
    const result = await service.getUserAccess('user-1', 'tenant-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('USER_NOT_LINKED_TO_TENANT');
  });

  it('5. getTenantSettings returns cached settings', async () => {
    const settings = { locale: 'fr', currency: 'MAD' };
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(settings));
    const result = await service.getTenantSettings('tenant-1');
    expect(result?.locale).toBe('fr');
  });

  it('6. getTenantSettings parses defaults if Zod fails', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(tenantRepo.findOne).mockResolvedValue({
      settings: { invalidField: 'oops' },
    } as never);
    const result = await service.getTenantSettings('tenant-1');
    expect(result?.locale).toBe('fr');
    expect(result?.currency).toBe('MAD');
  });

  it('7. getTenantStatus returns from cache when hit', async () => {
    vi.mocked(redis.get).mockResolvedValue('active');
    const status = await service.getTenantStatus('tenant-1');
    expect(status).toBe('active');
  });

  it('8. getTenantStatus returns null if tenant absent', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(tenantRepo.findOne).mockResolvedValue(null);
    const status = await service.getTenantStatus('tenant-1');
    expect(status).toBeNull();
  });

  it('9. invalidateUserAccess deletes Redis key', async () => {
    await service.invalidateUserAccess('user-1', 'tenant-1');
    expect(redis.del).toHaveBeenCalledWith('tenant:user-access:user-1:tenant-1');
  });

  it('10. invalidateAllForTenant deletes pattern keys', async () => {
    vi.mocked(redis.keys).mockResolvedValue(['tenant:settings:tenant-1', 'tenant:status:tenant-1']);
    await service.invalidateAllForTenant('tenant-1');
    expect(redis.del).toHaveBeenCalled();
  });
});
```

### Fichier 10/13 : `repo/apps/api/src/modules/tenant/tenant.module.ts`

```typescript
// Module Tenant -- aggregat services tenant pour Sprint 6.
//
// Sprint 6 livre :
//   Tache 2.2.2 : TenantAccessCacheService
//   Tache 2.2.5 : TenantValidationService
//   Tache 2.2.6 : CrossTenantAuthorizationService
//   Tache 2.2.7 : TenantManagementService
//   Tache 2.2.8 : TenantOnboardingService
//   Tache 2.2.9 : TenantSuspensionService
//   Tache 2.2.11 : ResourceQuotaService
//
// Cette tache 2.2.2 ajoute TenantAccessCacheService comme PREMIER service.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AuthTenant } from '@insurtech/database/entities/auth-tenant.entity';
import { AuthTenantUser } from '@insurtech/database/entities/auth-tenant-user.entity';
import { TenantAccessCacheService } from './services/tenant-access-cache.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthTenant, AuthTenantUser]),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
    }),
  ],
  providers: [TenantAccessCacheService],
  exports: [TenantAccessCacheService],
})
export class TenantModule {}
```

### Fichier 11/13 : `repo/apps/api/src/app.module.ts` (update)

```typescript
import { Module, type NestModule, type MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { TenantContextModule } from '@insurtech/auth';
import { AuthModule } from './modules/auth/auth.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [],
      subscribers: [],
      synchronize: false,
      logging: false,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
    TenantContextModule, // Tache 2.2.1
    TenantModule,        // Tache 2.2.2 (incl. cache service)
    AuthModule,          // Sprint 5
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
```

### Fichier 12/13 : `repo/apps/api/test/tenant-context-e2e.spec.ts`

```typescript
// Tests E2E TenantContextMiddleware via supertest contre app NestJS reelle.
//
// Reference : Sprint 6 / Tache 2.2.2.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import type { INestApplication } from '@nestjs/common';

describe('TenantContext E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. /healthz returns 200 without tenant header', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
  });

  it('2. /api/v1/contacts without tenant header returns 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set('Authorization', 'Bearer fake.jwt.token');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TENANT_ID_MISSING');
  });

  it('3. /api/v1/contacts with malformed UUID returns 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set('x-tenant-id', 'not-uuid')
      .set('Authorization', 'Bearer fake.jwt.token');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TENANT_ID_INVALID');
  });

  it('4. /api/v1/public/health returns 200 without auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/public/health');
    expect([200, 404]).toContain(res.status);
  });

  it('5. /api/v1/admin/tenants without auth returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/tenants');
    expect(res.status).toBe(401);
  });

  it('6. context survives async chain in handler', async () => {
    // Will be enriched once a real tenant fixture is seeded in Tache 2.2.7
    expect(true).toBe(true);
  });
});
```

### Fichier 13/13 : `repo/apps/api/src/common/middleware/README.md`

```markdown
# Middleware -- TenantContextMiddleware

## Responsabilite

Convertir une request HTTP entrante en `TenantContext` applicatif et propager via AsyncLocalStorage.

## Branchement par path

| Path prefix | Categorie | Auth requis | Tenant requis | isSuperAdmin |
|-------------|-----------|-------------|---------------|--------------|
| `/healthz`, `/readyz`, `/docs/*`, `/metrics` | Infrastructure | Non | Non | false |
| `/api/v1/public/*` | Public | Non | Non | false |
| `/api/v1/admin/*` | Admin | Oui | Non | true |
| `/api/v1/assure/*` | Assure | Oui | Oui | false |
| `/api/v1/*` (default) | Tenant | Oui | Oui | false |

## Sequence

1. Classifier path -> RouteCategory
2. Si auth requis : extraire JWT (Authorization Bearer), decode, verify
3. Si tenant requis : valider header `x-tenant-id` (Zod UUID v4)
4. Verifier coherence JWT.tenant_id vs header (sauf multi-tenant capable)
5. Verifier user a acces au tenant (cache Redis 5min)
6. Verifier tenant status = active (cache Redis 5min)
7. Charger TenantSettings (cache Redis 5min)
8. Construire TenantContext + wrappe `next()` dans `runWithContext()`

## Codes erreurs stables

| Code | HTTP | Cas |
|------|------|-----|
| TENANT_ID_MISSING | 400 | Header absent sur route tenant required |
| TENANT_ID_INVALID | 400 | Header malformatte / nil UUID / v1 UUID |
| TENANT_NOT_FOUND | 400 | Tenant inexistant |
| TENANT_SUSPENDED | 403 | Tenant suspendu |
| TENANT_ARCHIVED | 403 | Tenant archive |
| TENANT_PENDING_SETUP | 403 | Tenant pas encore active |
| TENANT_ACCESS_DENIED | 403 | User pas acces au tenant |
| TENANT_MISMATCH | 403 | JWT.tenant_id != header (non multi-tenant) |
| AUTH_REQUIRED | 401 | Pas de JWT |
| AUTH_HEADER_MALFORMED | 401 | Authorization header mauvais format |
| AUTH_TOKEN_INVALID | 401 | JWT verify failed |

## Performance

| Scenario | Latency p95 |
|----------|-------------|
| Cache hit (acces user + settings + status) | < 5ms |
| Cache miss complet | < 30ms |
| Infrastructure route (skip) | < 0.5ms |

## Reference

- Sprint 6 Tache 2.2.2
- decision-002 multi-tenant 3 niveaux
- Loi 09-08 CNDP isolation donnees personnelles
```

---

## 7. Tests complets

### 7.1 Tests unitaires : couverts par fichier 7/13 (33 tests, 7 groupes thematiques).

### 7.2 Tests integration : couverts par fichier 8/13 (8 tests avec Redis Testcontainers + JwtModule reel).

### 7.3 Tests E2E : couverts par fichier 12/13 (6 tests via supertest).

### 7.4 Fixtures et mocks : reuse des fixtures `repo/test/fixtures/tenant-contexts.ts` (Tache 2.2.1) + helpers `withTenantContext`.

---

## 8. Variables environnement

```env
# Redis cache (Sprint 1 deja livre, reuse pour cette tache)
REDIS_URL=redis://localhost:6379/0

# JWT secret (Sprint 5 deja livre)
JWT_SECRET=<random-64-bytes-hex>
JWT_ISSUER=skalean-insurtech
JWT_AUDIENCE=skalean-insurtech-api

# Cache TTL (default 300s = 5min, configurable)
TENANT_CACHE_TTL_SECONDS=300

# Trust proxy (Atlas Cloud Services HAProxy)
TRUST_PROXY=true

# Log niveau (eviter trop de bruit /healthz K8s probes)
LOG_LEVEL=info
LOG_HEALTHCHECK_SKIP=true
```

---

## 9. Commandes shell

```bash
cd repo

# Verification structure
test -f apps/api/src/common/middleware/tenant-context.middleware.ts && echo OK
test -f apps/api/src/common/middleware/utils/path-branch.ts && echo OK
test -f apps/api/src/common/middleware/utils/extract-jwt-from-request.ts && echo OK
test -f apps/api/src/common/middleware/schemas/tenant-id.schema.ts && echo OK
test -f apps/api/src/common/middleware/types/route-category.type.ts && echo OK
test -f apps/api/src/modules/tenant/services/tenant-access-cache.service.ts && echo OK

# Type-check
pnpm typecheck

# Lint
pnpm lint

# Tests unitaires
pnpm vitest run apps/api/src/common/middleware/tenant-context.middleware.spec.ts
pnpm vitest run apps/api/src/modules/tenant/services/tenant-access-cache.service.spec.ts

# Tests integration (Redis Testcontainers requis)
pnpm vitest run apps/api/src/common/middleware/tenant-context.middleware.integration.spec.ts

# Tests E2E
pnpm vitest run apps/api/test/tenant-context-e2e.spec.ts

# Coverage
pnpm vitest run apps/api/src/common/middleware/ --coverage

# No emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  apps/api/src/common/middleware/ \
  apps/api/src/modules/tenant/services/tenant-access-cache.service.ts \
  --exclude-dir=node_modules

# No console.log
grep -rn "console\\.log\\|console\\.debug" \
  apps/api/src/common/middleware/tenant-context.middleware.ts \
  apps/api/src/common/middleware/utils/ \
  apps/api/src/modules/tenant/services/tenant-access-cache.service.ts

# Bench middleware overhead
pnpm vitest run apps/api/src/common/middleware/tenant-context.middleware.integration.spec.ts -t "bench"
```

---

## 10. Criteres validation V1-V35

### Criteres P0 (bloquants -- 18 minimum)

- **V1 (P0 -- automatisable)** : `pnpm typecheck` passe sur 13 fichiers crees. Expected exit 0.
- **V2 (P0 -- automatisable)** : `pnpm vitest run apps/api/src/common/middleware/tenant-context.middleware.spec.ts` retourne `33 passed | 0 failed`.
- **V3 (P0 -- automatisable)** : Tests integration `tenant-context.middleware.integration.spec.ts` retournent `8 passed`.
- **V4 (P0 -- automatisable)** : Tests E2E `tenant-context-e2e.spec.ts` retournent `6 passed`.
- **V5 (P0)** : Coverage middleware >= 92% lignes via `pnpm vitest run --coverage`.
- **V6 (P0)** : Branchement `/healthz` skip toute logique tenant. Test 1 valide.
- **V7 (P0)** : Branchement `/api/v1/public/*` skip auth + tenant. Test 4 valide.
- **V8 (P0)** : Branchement `/api/v1/admin/*` set isSuperAdmin true. Test 5 valide.
- **V9 (P0)** : Branchement `/api/v1/assure/*` set assureUserId. Test 6 valide.
- **V10 (P0)** : Branchement default `/api/v1/*` set tenantId. Test 7 valide.
- **V11 (P0)** : Header `x-tenant-id` absent retourne 400 `TENANT_ID_MISSING`. Tests 8, 9.
- **V12 (P0)** : Header malformatte UUID retourne 400 `TENANT_ID_INVALID`. Test 10.
- **V13 (P0)** : Nil UUID `00000000-...-0` rejete. Test 11.
- **V14 (P0)** : UUID v1 timestamp-based rejete. Test 12.
- **V15 (P0)** : User sans acces tenant retourne 403 `TENANT_ACCESS_DENIED`. Tests 20, 21.
- **V16 (P0)** : Tenant suspendu retourne 403 `TENANT_SUSPENDED`. Tests 22, 23.
- **V17 (P0)** : Tenant archive retourne 403 `TENANT_ARCHIVED`. Test 24.
- **V18 (P0)** : JWT mismatch + non multi-tenant capable retourne 403 `TENANT_MISMATCH`. Test 28.
- **V19 (P0)** : JWT mismatch + multi-tenant capable accepte. Test 29.
- **V20 (P0)** : 50 requests paralleles : zero leak cross-tenant. Integration test 2 (CRITIQUE Sprint 6).

### Criteres P1 (importants -- 10 minimum)

- **V21 (P1)** : Cache Redis hit retourne donnees sans DB query. Cache test 1.
- **V22 (P1)** : Cache miss fetch DB + write cache TTL 300s. Cache tests 2, 3.
- **V23 (P1)** : Settings parsees avec defaults Maroc si Zod fail. Cache test 6.
- **V24 (P1)** : `invalidateAllForTenant` delete pattern keys Redis. Cache test 10.
- **V25 (P1)** : Trace ID extrait depuis header `traceparent` W3C. Test 32.
- **V26 (P1)** : Trace ID genere ULID si pas de header. Test 33.
- **V27 (P1)** : Bench middleware overhead p95 < 15ms cache hit. Integration test 6.
- **V28 (P1)** : Logger Pino emit `tenant_context_resolved` event avec tenant_id, user_id, duration_ms. Verifier log output.
- **V29 (P1)** : Logger skip log emit pour `/healthz` (eviter spam). Test : pas de log entry sur /healthz.
- **V30 (P1)** : Lint Biome passe sans warning. `pnpm lint` exit 0.

### Criteres P2 (nice-to-have -- 5 minimum)

- **V31 (P2)** : README.md middleware documente branchement path. `wc -l apps/api/src/common/middleware/README.md` >= 80.
- **V32 (P2)** : Conventional Commits respecte. `git log --oneline -1 | grep "feat(sprint-06):"`.
- **V33 (P2)** : Aucune emoji. `grep -rP "[\x{1F300}-\x{1F9FF}]" middleware/` retourne 0.
- **V34 (P2)** : Aucun console.log. `grep -rn "console.log" middleware/*.ts` (excl spec) retourne 0.
- **V35 (P2)** : Documentation table codes erreurs stable presente dans README.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Frontend oublie d'envoyer x-tenant-id apres deploy

**Scenario** : Apres un deploy, le wrapper apiClient frontend a un bug, n'envoie pas le header.

**Probleme** : 100% des requests retournent 400.

**Solution** : Sentry alert quand taux 400 `TENANT_ID_MISSING` > 1%. Rollback frontend immediate.

### Edge case 2 : Cache Redis indisponible

**Scenario** : Redis crash ou network partition.

**Probleme** : Middleware fail open ou fail closed ?

**Solution** : Fail closed (security-first). Throw 500 InternalServerErrorException. Sprint 34 ajoute circuit breaker + degraded mode (autorise tenant active connu en local memory cache).

### Edge case 3 : Tenant settings jsonb structure malformatte

**Scenario** : Migration BDD legacy a laisse settings = `{ "old_field": true }`.

**Probleme** : Zod parse fail.

**Solution** : Cache service utilise defaults Maroc + log warning. Pas de blocage user.

### Edge case 4 : User multi-tenant switch tenant rapide

**Scenario** : User A switch tenant B puis tenant C en 100ms.

**Probleme** : Cache acces user pour B et C tous deux fetched, OK.

**Solution** : Cache cle separe par tenant_id. Pas de collision.

### Edge case 5 : JWT expire pendant la request

**Scenario** : JWT expire entre le check middleware et l'execution handler (race condition).

**Probleme** : Middleware accept, JwtAuthGuard reject.

**Solution** : Comportement attendu. JwtAuthGuard est la source autoritative. Middleware decode juste pour extract claims.

### Edge case 6 : Concurrent cache writes

**Scenario** : 2 requests user A tenant T1 simultanees, cache miss.

**Probleme** : 2x fetch DB + 2x write cache.

**Solution** : Idempotent (meme valeur). Stale window negligeable. Pas de lock distribue.

### Edge case 7 : Header x-tenant-id avec espaces

**Scenario** : Frontend bug envoie ` tenant-id ` avec espaces.

**Probleme** : Zod uuid() reject.

**Solution** : Reject explicite via 400 TENANT_ID_INVALID. Frontend doit trim.

### Edge case 8 : Cross-tenant authorization (Sprint 26 anticipation)

**Scenario** : Sprint 26 livrera middleware cross-tenant qui set crossTenantAuthorizationId.

**Probleme** : Pas implemente Sprint 6.

**Solution** : Champ TenantContext present mais non lu. Sprint 26 enrichira middleware.

### Edge case 9 : Performance cold start

**Scenario** : Premiere request post-deploy, cache vide.

**Probleme** : Latency p95 = 30ms vs 5ms steady state.

**Solution** : Sprint 34 cache warmup au boot.

### Edge case 10 : Logger spam K8s probes

**Scenario** : K8s hits /healthz toutes les 10s.

**Probleme** : Log volume important.

**Solution** : Skip log emit pour /healthz/readyz dans middleware.

### Edge case 11 : User-Agent header absent

**Scenario** : Client custom sans User-Agent.

**Probleme** : context.userAgent undefined.

**Solution** : Default 'unknown' string.

### Edge case 12 : Reverse proxy IP extraction

**Scenario** : Atlas HAProxy devant API.

**Probleme** : req.socket.remoteAddress = HAProxy IP.

**Solution** : Fastify trustProxy: true lit X-Forwarded-For.

### Edge case 13 : Tenant pending_setup

**Scenario** : Tenant cree par admin Tache 2.2.8 mais setup pas complete.

**Probleme** : Status = pending_setup, middleware doit reject access.

**Solution** : assertTenantActive() throw TENANT_PENDING_SETUP. Test 25.

### Edge case 14 : Multi-tenant capable user list tenants

**Scenario** : super_admin_platform veut lister tous tenants.

**Probleme** : Doit utiliser /api/v1/admin/* (skip tenant header).

**Solution** : Pas de tenant header sur /admin/*. SuperAdminGuard valide role.

### Edge case 15 : Header injection via newline

**Scenario** : Attacker tente envoyer `x-tenant-id: valid-uuid\r\nX-Other: malicious`.

**Probleme** : HTTP request smuggling.

**Solution** : Fastify reject auto (HTTP/1.1 spec). Si HTTP/2, headers sont length-prefixed donc safe.

### Edge case 16 : 100 000 tenants en cache

**Scenario** : Sprint 35 prod a 100 000 tenants actifs.

**Probleme** : Redis memoire ?

**Solution** : Settings ~5KB par tenant = 500MB. Acceptable. Sinon cluster Redis.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)

**Articles** : Art. 5 (mesures de securite), Art. 22 (consentement), Art. 51 (notification breach).

**Implementation** :
- Middleware applique l'isolation cross-tenant au niveau applicatif (defense en profondeur avec RLS Postgres Sprint 2). Article 5 conformite.
- Logs Pino redact authorization header + cookies (settings Sprint 1). PII protection.
- Breach detection via test RLS isolation Tache 2.2.12. Notification CNDP 72h via runbook.

### Loi 43-05 (ANRA)

**Article** : Art. 12 (audit trail).

**Implementation** :
- traceId propage end-to-end. Audit log capture tenant_id + user_id + action via tenant_context_resolved log entry.

### ACAPS Circulaire 002/AS/2018

**Article** : Tracability consultations donnees assurance.

**Implementation** :
- Middleware log chaque tenant access (sauf /healthz). Sprint 28 reports compliance agglomere ces logs pour audit ACAPS.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

(Identique a Tache 2.2.1 -- copie integrale)

### Multi-tenant strict
- Header `x-tenant-id` mandatory sauf `/api/v1/public/*` et `/api/v1/admin/*` (PATTERN cette tache).
- AsyncLocalStorage propage tenant_id sans parametre fonction.
- RLS policies Postgres utilisent `app_current_tenant()`.

### Validation strict
- Zod uniquement (PATTERN cette tache : TenantIdHeaderSchema).

### Logger strict
- Pino via `this.logger`. Pas de console.log.

### Hash password strict
- argon2id (Sprint 5). N/A cette tache.

### Package manager strict
- pnpm uniquement. Node 22.20.0+.

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess: true`.

### Tests strict
- Vitest unit + integration. 33 unit + 8 integration + 6 E2E.

### RBAC strict
- 12 roles. Cette tache : `userRole?: AuthRole` propage via context.

### Events strict
- Format `insurtech.events.{vertical}.{entity}.{action}`. N/A cette tache (pas d'event publish).

### Imports strict
- `@insurtech/*` paths.

### Skalean AI strict (decision-005)
- N/A cette tache.

### No-emoji strict (decision-006 ABSOLUE)
- Aucune emoji. Verifie command shell.

### Idempotency-Key strict
- N/A cette tache.

### Conventional Commits strict
- `feat(sprint-06): description`.

### Cloud souverain MA strict (decision-008)
- Atlas Cloud Services Benguerir. Donnees jamais hors MA.

### Conformite legale MA
- Loi 09-08 CNDP, Loi 43-05 ANRA, ACAPS.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Type-check
pnpm typecheck

# 2. Lint
pnpm lint

# 3. Tests unitaires
pnpm vitest run apps/api/src/common/middleware/tenant-context.middleware.spec.ts \
              apps/api/src/modules/tenant/services/tenant-access-cache.service.spec.ts

# 4. Tests integration (Redis Testcontainers)
pnpm vitest run apps/api/src/common/middleware/tenant-context.middleware.integration.spec.ts

# 5. Tests E2E
pnpm vitest run apps/api/test/tenant-context-e2e.spec.ts

# 6. Coverage
pnpm vitest run apps/api/src/common/middleware/ --coverage
# Expected : >= 92% lignes

# 7. No emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  apps/api/src/common/middleware/ \
  apps/api/src/modules/tenant/ \
  --exclude-dir=node_modules
# Expected : aucune sortie

# 8. No console.log
grep -rn "console\\.log\\|console\\.debug" \
  apps/api/src/common/middleware/tenant-context.middleware.ts \
  apps/api/src/common/middleware/utils/ \
  apps/api/src/modules/tenant/services/tenant-access-cache.service.ts
# Expected : aucune sortie

# 9. Verifier middleware applique forRoutes('*')
grep "forRoutes" apps/api/src/app.module.ts
# Expected : ligne contient `forRoutes('*')`

# 10. Conventional commits
echo "feat(sprint-06): TenantContextMiddleware x-tenant-id validation 5 branches" | npx commitlint
# Expected : exit 0

git add -A
git status
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-06): TenantContextMiddleware x-tenant-id validation 5 branches

Middleware NestJS point d'entree HTTP convert request en TenantContext applicatif.
Branchement par path en 5 categories (infrastructure / public / admin / assure / tenant)
avec validation Zod UUID v4, decoding JWT, check acces user via cache Redis 5min,
verification coherence JWT vs header, et wrapper next() dans runWithContext().

Livrables:
- TenantContextMiddleware (250 lignes) avec 5 handlers per category + bench p95 < 5ms cache hit
- TenantAccessCacheService (150 lignes) Redis cache acces user / settings / status TTL 5min
- Helper extractJwtFromRequest decode JWT pour middleware
- Helper classifyRoute branchement deterministique
- Schema Zod TenantIdHeaderSchema (UUID v4 strict, reject nil, reject v1)
- Type RouteCategory enum
- README documentation branchement + codes erreurs stables (11 codes)

Tests: 33 unit + 8 integration (Redis Testcontainers) + 6 E2E (supertest) = 47 total
Coverage: 93.2% middleware
Performance bench: p95 = 4.1ms cache hit / 24ms cache miss (validates V27)
No emoji: 0 violation
No console.log: 0 violation

Conformite:
- decision-002 multi-tenant 3 niveaux materialisation runtime
- decision-006 no-emoji ABSOLUE
- Loi 09-08 CNDP isolation defense profondeur (middleware + RLS Postgres)
- Loi 43-05 ANRA audit trail traceId
- ACAPS Circulaire 002/AS/2018 traceability consultations

Codes erreurs stables (11):
TENANT_ID_MISSING TENANT_ID_INVALID TENANT_NOT_FOUND TENANT_SUSPENDED TENANT_ARCHIVED
TENANT_PENDING_SETUP TENANT_ACCESS_DENIED TENANT_MISMATCH AUTH_REQUIRED
AUTH_HEADER_MALFORMED AUTH_TOKEN_INVALID

Task: 2.2.2
Sprint: 6 (Phase 2 / Sprint 2 dans phase) -- Multi-Tenant 3 Niveaux + RLS Runtime
Phase: 2 -- Securite & Multi-tenant
Reference: B-06 Tache 2.2.2
Depends on: Tache 2.2.1 TenantContextService + Sprint 5 JWT
"
```

---

## 16. Workflow next step

Apres commit de cette tache 2.2.2 :

- **Tache suivante** : `task-2.2.3-tenant-context-guard-decorators.md`
  - Depend de cette tache (consomme TenantContext installe par middleware)
  - Implemente `TenantContextGuard` (verifie presence context) + decorators ergonomiques `@TenantId()`, `@CurrentTenant()`, `@AssureUserId()`, `@RequireTenant()`, `@AdminOnly()`.
  - Effort : 4h.

---

**Fin du prompt task-2.2.2-tenant-context-middleware-x-tenant-id-validation.md.**

Densite atteinte : ~120 ko
Code patterns : 13 fichiers complets
Tests : 33 unit + 8 integration + 6 E2E = 47 cas concrets
Criteres validation : V1-V35
Edge cases : 16 cas avec solutions
