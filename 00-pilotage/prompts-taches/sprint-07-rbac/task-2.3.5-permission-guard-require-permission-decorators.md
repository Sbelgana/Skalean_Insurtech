# TACHE 2.3.5 -- PermissionGuard + Decorators @RequirePermission / @RequireAnyPermission / @RequireAllPermissions

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.5 lignes 602-734)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour Tache 2.3.6 ScopeGuard, Tache 2.3.7 AbacService, Tache 2.3.8 AbacResourceGuard, Tache 2.3.9 AuditTrailService Loi 09-08, Tache 2.3.10 RbacAuditService persistence, Tache 2.3.12 tests E2E coverage 12 roles ; bloquant indirect pour TOUS les controllers metier Sprint 8+ qui annoteront leurs endpoints avec `@RequirePermission`, `@RequireAnyPermission`, `@RequireAllPermissions`)
**Effort** : 5h
**Dependances** : Tache 2.3.4 (RoleGuard livre + decorator metadata pattern + ExecutionContext extraction helpers + RoleGuardModule reference). Tache 2.3.3 (RbacService injectable expose `canAccess`, `canAccessAny`, `canAccessAll`, AccessResult). Tache 2.3.2 (RoleHierarchy + getEffectivePermissions memoized). Tache 2.3.1 (catalog Permission TypeScript const + Zod schema). Sprint 6 complet (TenantContext propage `userRole`, `userId`, `tenantId` via cls-hooked AsyncLocalStorage Sprint 6 Tache 2.6.x ; JwtAuthGuard pose `request.user`). Sprint 1-2 stack (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x, Pino 9.5.x, Zod 3.24.1, Reflect Metadata 0.2.x, NestJS Reflector core).
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.5 vise a livrer le mecanisme guard NestJS de deuxieme ligne du programme Skalean InsurTech v2.2 pour la verification de permissions granulaires : `PermissionGuard`, accompagne de trois decorators complementaires `@RequirePermission(perm)`, `@RequireAnyPermission(...perms)` (semantique OR) et `@RequireAllPermissions(...perms)` (semantique AND). Ce mecanisme constitue la couche "permission-based granulaire" du framework d'autorisation, plus expressive et plus precise que `RoleGuard` (Tache 2.3.4) qui ne verifie qu'une appartenance a une liste de roles. Il est specifiquement destine aux endpoints HTTP metier (controllers REST Sprint 8+ couvrant CRM, Booking, Comm, Docs, Pay, Books, Insure, Repair, Stock, HR), aux resolvers GraphQL (Sprint 18), aux gateways WebSocket (Sprint 10) et aux tools resolvers MCP (Sprint 30) ou la regle d'autorisation se reduit a "le role courant doit posseder la permission X dans la matrice (ou un sous-ensemble OR/AND de plusieurs permissions)". Le guard lit la metadata posee par les decorators via `Reflector.getAllAndOverride<PermissionValue[]>(PERMISSIONS_KEY)` et `Reflector.getAllAndOverride<'AND' | 'OR'>(PERMISSIONS_LOGIC_KEY)`, recupere le role courant + tenantId + userId depuis le `TenantContext` (Sprint 6) injecte via AsyncLocalStorage cls-hooked, applique d'abord le bypass implicite `super_admin_platform` (delegue a `RbacService.canAccess` qui possede deja la logique wildcard `*`), puis delegue la decision finale a `RbacService.canAccessAny(role, permissions)` (logique OR) ou `RbacService.canAccessAll(role, permissions)` (logique AND -- defaut pour `@RequirePermission` mono-permission ou pour `@RequireAllPermissions`). En cas d'echec, le guard jette une `ForbiddenException` structuree contenant `{ code: 'PERMISSION_DENIED', permissions: PermissionValue[], logic: 'AND' | 'OR', role: AuthRole | null, userId?: string, tenantId?: string, endpoint: string, method: string, requestId?: string, timestamp: string }` qui sera consommee telle-quelle par le filter global `HttpExceptionFilter` (Tache 2.3.9 audit trail) et serialisee en reponse HTTP 403 conforme au format d'erreur JSON Skalean (Sprint 4 envelope errors). En complement, le guard emet AUTOMATIQUEMENT un audit log structure via `RbacAuditService.logAccessDenied(...)` (Tache 2.3.10) sur tout denial -- cet audit est CRITIQUE pour la conformite ACAPS (separation duties Maker/Checker), AMC (separation ComplianceOfficer-only AML), CNDP Loi 09-08 article 18 (tracabilite acces donnees personnelles), et BAM (separation autorisations operations financieres).

L'apport est triple. Premierement, separer la verification "role-based binaire" (Tache 2.3.4) de la verification "permission-based granulaire" (Tache 2.3.5) permet d'optimiser le hot-path : la majorite des endpoints metier (`/api/v1/crm/contacts`, `/api/v1/insure/policies`, `/api/v1/repair/sinistres`) necessitent un check de permission precise (ex `crm.contacts.create`) car plusieurs roles peuvent y acceder (broker_admin + broker_user + broker_assistant pour `crm.contacts.read`). Le `PermissionGuard` delegue a `RbacService.canAccess(role, permission)` qui resout hierarchy descendants + matrix lookup (~500 microsec cache-hit, <2ms cache-miss avec Redis Sprint 12). Cette latence est acceptable car les endpoints metier sont rate-limited a 10-100 req/s par tenant (vs 10000 req/s sur endpoints admin role-only). Deuxiemement, les decorators `@RequireAnyPermission(...)` (OR) et `@RequireAllPermissions(...)` (AND) permettent d'exprimer des regles complexes en une ligne lisible : `@RequireAnyPermission('crm.contacts.read', 'crm.contacts.read_own')` (lecture si ownership OU permission globale -- typique scenario broker_user qui voit ses contacts mais pas tous), ou `@RequireAllPermissions('repair.sinistres.delete', 'repair.sinistres.update')` (suppression necessite a la fois delete ET update -- protection extra pour actions destructives). Cette expressivite evite de creer des permissions composites artificielles dans le catalog (Tache 2.3.1) et conserve le catalog atomique. Troisiemement, l'audit log automatique sur denial (via `RbacAuditService` injecte dans le guard) garantit que TOUT refus d'acces est trace en DB `rbac_audit_log` (Tache 2.3.10) avec tous les champs necessaires a la conformite Loi 09-08 article 18 : `userId`, `tenantId`, `role`, `permissionsRequested`, `logic`, `endpoint`, `method`, `ipAddress`, `userAgent`, `timestamp`, `denialReason`. Sans ce trace automatique, le respect ACAPS exigerait du code custom dans chaque controller metier -- dette technique massive. La centralisation dans le guard garantit zero-oversight (aucun denial ne peut "echapper" a l'audit).

A l'issue de cette tache, le package `@insurtech/auth` expose via `packages/auth/src/rbac/index.ts` les artefacts `PermissionGuard`, `RequirePermission`, `RequireAnyPermission`, `RequireAllPermissions`, `PERMISSIONS_KEY`, `PERMISSIONS_LOGIC_KEY`, `PermissionGuardModule`, `PermissionGuardErrorCode`, `PermissionGuardForbiddenDetails`, `getPermissionsFromContext`, `getPermissionsLogicFromContext`, `extractPermissionGuardContext`, `buildPermissionCacheKey`. Les decorators sont consommables via DI standard NestJS : `@RequirePermission('crm.contacts.create') @Post() handler() {}`. Le guard est registrable globalement via `APP_GUARD` ou per-controller via `@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)`. La commande `pnpm --filter @insurtech/auth test rbac/permission.guard.spec.ts` execute 30+ tests Vitest verifiant le comportement complet (decorator metadata triple-pose, guard logic AND/OR, hierarchy resolution permissions, super_admin bypass via RbacService delegation, no-context fallback NO_USER_CONTEXT, error response format PERMISSION_DENIED, audit log emission obligatoire, decorator stacking class+method override, WS context vs HTTP context, edge cases empty array AND/OR, race condition revocation in-flight, default deny whitelist, async audit failure resilience). La commande `pnpm --filter @insurtech/auth typecheck` retourne exit code 0. Le total represente environ 1410 lignes de code TypeScript strict reparties sur 11 fichiers (decorator require-permission ~80 lignes, guard principal ~220 lignes, tests guard ~350 lignes, tests decorators ~150 lignes, types erreur ~80 lignes, helpers extraction context ~80 lignes, helpers metadata ~80 lignes, fixtures ExecutionContext mocks ~100 lignes, module Nest ~60 lignes, cache key builder ~60 lignes, barrel ~20 lignes). Cette tache est P0 absolue car elle conditionne la decoration de TOUT endpoint metier Sprint 8+ : sans elle, les controllers metier ne peuvent pas declarer leur ACL granulaire, restent inaccessibles ou ouverts par defaut (regression securite catastrophique), et l'audit Loi 09-08 ne peut pas etre garanti.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 expose plus de 800 endpoints HTTP repartis sur 9 applications a horizon Sprint 35. Chaque endpoint metier (CRUD contacts, polices, sinistres, paiements, etc.) doit declarer formellement quelles permissions sont requises pour l'invoquer. La granularite est ESSENTIELLE : un endpoint `/api/v1/crm/contacts` (POST) requiert `crm.contacts.create`, qui est attribue dans la matrice (Tache 2.3.2) a broker_admin + broker_user + broker_assistant + garage_commercial + super_admin_platform (5 roles distincts). Utiliser `@Role` (Tache 2.3.4) necessiterait de lister manuellement les 5 roles a chaque endpoint (`@Role('broker_admin', 'broker_user', 'broker_assistant', 'garage_commercial', 'super_admin_platform')`) -- duplication massive, regression silencieuse a chaque ajout de role, divergence inevitable entre matrice canonique et code controllers. La granularite permission-based resout ce probleme en exprimant l'intent semantiquement (`@RequirePermission('crm.contacts.create')`) et en deleguant la resolution role -> permissions a la matrice centralisee (Tache 2.3.2). Si demain le role `broker_partner` est ajoute avec `crm.contacts.create`, AUCUNE modification controller n'est necessaire -- la matrice seule change.

L'architecture choisie maintient strictement la separation de responsabilites avec `RoleGuard` (Tache 2.3.4) :
- `RoleGuard` reste le guard rapide pour endpoints role-only (admin, internes Skalean) avec latence p99 < 50 microsec.
- `PermissionGuard` est le guard precis pour endpoints metier (CRM, Insure, Repair, Pay) avec latence p99 < 2ms (cache-hit Redis 500 microsec, cache-miss matrice inline 1500 microsec).
- Les deux guards coexistent et composent : `@UseGuards(JwtAuthGuard, TenantContextGuard, RoleGuard, PermissionGuard, AbacResourceGuard)` execute la chain dans l'ordre. Si `@Role + @RequirePermission` decorators sont tous deux poses, AND implicite : doit satisfaire ROLE ET PERMISSION (intersection).
- Le `PermissionGuard` delegue TOUTE logique d'evaluation au `RbacService` (Tache 2.3.3) -- aucune resolution hierarchy, aucune lookup matrix, aucune verification wildcard inline dans le guard. Le guard est un thin wrapper Reflector-driven qui orchestre extraction context + delegation service + emission audit.
- L'audit log automatique sur denial est emis via `RbacAuditService` (Tache 2.3.10) injecte dans le guard. L'emission est `await`-ed mais avec gestion d'erreur isolee (un echec d'audit ne doit PAS empecher la reponse 403). Voir piege #6 Section 2.5.

L'evaluation de decorator metadata est strictement deterministe : pour un meme handler decore avec `@RequirePermission('crm.contacts.create')`, le `Reflector.getAllAndOverride(PERMISSIONS_KEY, [handler, class])` retourne toujours `['crm.contacts.create']` et `getAllAndOverride(PERMISSIONS_LOGIC_KEY, ...)` retourne `'AND'` (defaut pose par le decorator via `applyDecorators`). La concurrence n'introduit aucune race car la metadata Reflect est immutable apres `SetMetadata` au load time du module.

### 2.2 Alternatives considerees pour la verification permission-based

Le tableau ci-dessous compare 7 alternatives evaluees avant la decision finale d'implementer un guard NestJS dedie consommant des decorators `Reflect.metadata` orchestrant `RbacService.canAccess*`.

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Middleware Express custom (intercept request avant routing, parse user.role, lookup matrice externe YAML, check permissions) | Decouple framework Nest (portable Express pure si migration), config externalisee modifiable sans recompile, brut performance | Pas de couplage type-safe handler-ACL (config YAML divergente du code TS), pas de support natif decorators, incompatible WebSocket/GraphQL/MCP, debug double-monde middleware vs guards, audit decentralise impossible | REJETE -- incompatible architecture Sprint 1-2 |
| Interceptor NestJS (intercepter chaque appel handler, evaluer permission, throw ou pass) | Acces ExecutionContext + Reflector, support cross-cutting | Mauvaise abstraction semantique (interceptor pour transformation observable, pas authz), execute APRES validation pipes (body deserialise potentiellement malveillant deja parse), pas convention Nest authz, complique guard chain | REJETE -- mauvaise abstraction |
| Permission service appele MANUELLEMENT dans chaque handler (`if (!await this.rbac.canAccess(req.user.role, 'crm.contacts.create')) throw 403`) | Zero abstraction, debuggable inline | Aucune separation concerns, audit impossible (parsing AST custom requis), regression silencieuse (oubli de check), code duplique 800+ fois, incompatible OpenAPI generation Sprint 9 | REJETE -- inacceptable scale 800 endpoints |
| Guard custom per permission (ex: `CrmContactsCreateGuard`, `InsurePoliciesReadGuard`) | Type-safety maximum (chaque guard nomme son intent), pas de runtime metadata reflection | Explosion combinatoire (85 permissions x combinaisons OR/AND = 500+ guards), duplication logique RbacService, maintenance impossible long terme | REJETE -- explosion combinatoire ingerable |
| Casbin/Accesscontrol library en mode middleware (declarations centralisees CSV/policy file) | Standard externe (mature), declarations centralisees | Surdimensionne (Casbin = matrice complete + ABAC), pas integration NestJS native, duplication avec Tache 2.3.3 RbacService, learning curve equipe, conflit licensing Apache vs MIT skalean | REJETE -- surdimensionne, duplication |
| Decorator + Guard simple SANS audit automatique (audit emis dans HttpExceptionFilter Sprint 4) | Plus rapide (pas await audit dans guard), separation concerns audit | Audit decouple du contexte de denial (filter recoit ForbiddenException sans details RBAC complets), risque oversight si filter mal configure, ACAPS exige tracabilite "au point de decision" | REJETE -- ACAPS exige audit au point de decision, pas en aval |
| Decorator `@RequirePermission(...)` + Guard NestJS lisant metadata via Reflector + audit automatique injection RbacAuditService (RETENU) | Type-safe (`@RequirePermission` accepte uniquement `PermissionValue` typee Zod), declaratif (visible immediatement sur handler), composable (`@UseGuards([RoleGuard, PermissionGuard])`), audit statique trivial (grep `@RequirePermission` decouvre toutes ACL), support natif HTTP/GraphQL/WS/MCP via ExecutionContext, OpenAPI Sprint 9 introspecte metadata, zero divergence config-code, latence < 2ms p99, integration DI Nest pour TenantContext + RbacService + RbacAuditService injection, audit GARANTI au point de decision (conformite ACAPS), idiomatic NestJS (pattern documente officiellement RolesGuard etendu) | Code custom (~1410 lignes), maintenance interne (vs library externe), doit gerer audit async avec failure resilience | RETENU -- meilleur compromis securite/perf/DX/maintenabilite/conformite |

### 2.3 Trade-offs : granularite vs simplicite

Une question recurrente est : "pourquoi avoir 3 decorators distincts -- pourquoi pas un seul `@Permissions(...)` avec parametre `{ logic: 'AND' | 'OR' }` ?". La reponse strategique est que la lisibilite du code controller prime sur la concision de l'API. Un decorator avec 50 controllers utilisant `@Permissions(['p1', 'p2'], { logic: 'OR' })` est moins lisible que `@RequireAnyPermission('p1', 'p2')`. Le mot-cle `Any` exprime immediatement la semantique OR. Le mot-cle `All` exprime AND. Le mot-cle generique `Permission` (singulier) exprime "une seule permission requise" (cas le plus frequent ~80% des endpoints) sans avoir besoin de specifier la logic (defaut AND avec singleton est equivalent OR). Cette redondance volontaire ameliore la revue de code et reduit les bugs lies a confusion AND/OR. Le test V8 verifie que `@RequirePermission(p)` et `@RequireAllPermissions(p)` produisent le meme comportement (single-element AND).

L'alternative envisagee `@Permissions({ all: ['p1', 'p2'] })` ou `@Permissions({ any: ['p1', 'p2'] })` (object literal au lieu de variadic) a ete REJETEE car (a) variadic est plus naturel TypeScript, (b) object literal force allocation a chaque call (micro-overhead), (c) IDE autocomplete moins fluide.

Le trade-off "OR vs AND default semantics" est resolu en faveur de AND par defaut (decorator `@RequirePermission` mono-perm equivaut AND-singleton, decorator `@RequireAllPermissions` est explicit AND, decorator `@RequireAnyPermission` est explicit OR). La raison securite : AND est le defaut conservateur (si l'intent est ambigu, exiger TOUTES les permissions est plus strict que une suffit). Un dev qui veut OR doit l'expliciter via `@RequireAnyPermission` -- friction intentionnelle pour reduire bugs autorisation par oubli.

### 2.4 Pattern `applyDecorators` composition

Le decorator `@RequirePermission(perm)` doit poser DEUX metadata distinctes : `PERMISSIONS_KEY` (array de permissions) et `PERMISSIONS_LOGIC_KEY` (string AND ou OR). NestJS expose `applyDecorators(...DecoratorFn[])` qui compose plusieurs decorators en un seul. Implementation :

```typescript
export const RequirePermission = (permission: PermissionValue) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, [permission]),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'AND'),
  );
```

Cette composition garantit atomicite : les deux metadata sont posees ensemble ou pas du tout (si une throw pendant load, le module crash et aucune metadata n'est posee). Le pattern est utilise systematiquement pour les 3 decorators. Alternative envisagee : custom `MakeRequirePermissionDecorator` factory function avec `Reflect.defineMetadata` direct -- REJETEE car perd l'integration `applyDecorators` (utilise par `@nestjs/swagger` Sprint 9 pour introspecter combinaisons de decorators).

### 2.5 Pieges techniques connus (10 pieges critiques documentes)

1. **Piege : Metadata key collision entre RoleGuard et PermissionGuard.**
   - Pourquoi : si RoleGuard utilise key `'roles'` et PermissionGuard utilise key `'permissions'`, pas de collision. Mais si quelqu'un definit dans un autre package `@SomeOtherDecorator()` qui pose `Reflect.defineMetadata('permissions', ...)`, il ecrase la metadata du PermissionGuard. Probabilite faible mais reelle (libraries tierces RBAC custom).
   - Solution : keys utilisent prefixe namespace `'@insurtech/auth:permissions'` et `'@insurtech/auth:permissions_logic'` au lieu de strings simples. Test V22 verifie que key custom ne collide pas avec metadata fixtures. Documentation README package mentionne convention namespace pour libraries tierces.

2. **Piege : Decorator pose sur class heritee non propage.**
   - Pourquoi : `class ChildController extends ParentController` -- les metadata Reflect sont attachees a la classe Parent, pas a Child. Si Parent decore `@RequirePermission('p1')` au niveau class, et Child override certaines methodes, `Reflector.getAllAndOverride` lit la metadata depuis Child d'abord (undefined sur Child class), puis Parent class (trouve `['p1']`). Comportement correct dans NestJS Reflector core qui supporte prototype chain. MAIS : si decorator est pose au niveau method dans Parent et Child override la method, Child method n'herite PAS du decorator (Reflect ne propage pas decorators sur method override). Comportement subtle bug-prone.
   - Solution : documentation JSDoc explicit `"Method-level decorators are NOT inherited on method override. Re-decorate the override method explicitly. Class-level decorators ARE inherited via prototype chain."`. Test V23 verifie comportement explicite avec class hierarchy. Pattern recommande : poser au niveau class si applicable a TOUTES methodes ; au niveau method sinon.

3. **Piege : super_admin bypass interaction inattendu avec OR/AND logic.**
   - Pourquoi : super_admin_platform a wildcard `*` dans la matrice. Le `RbacService.canAccessAll(super_admin, ['p1', 'p2'])` doit retourner true (wildcard couvre tout). Le `RbacService.canAccessAny(super_admin, ['p1', 'p2'])` doit aussi retourner true. Mais si l'implementation `canAccessAll` itere et fait `every(p => canAccess(role, p))` et que `canAccess` ne gere pas wildcard pour super_admin, ca echoue. Ou si la matrice n'est pas chargee au moment du check (race init), super_admin peut etre denied -- regression catastrophique.
   - Solution : `RbacService.canAccess` (Tache 2.3.3) gere super_admin bypass au TOUT debut avant matrix lookup (early return). `canAccessAll` et `canAccessAny` delegent chacune permission a `canAccess` -> bypass propage. Test V24 verifie super_admin AND + OR avec liste mixed permissions inexistantes (super_admin doit passer meme avec permissions garbage).

4. **Piege : Audit log async without await bloquant le flow ou perdu.**
   - Pourquoi : si dans le guard on fait `this.rbacAudit.logAccessDenied(...)` sans `await`, le log peut etre emis APRES la reponse HTTP 403 -- race entre Promise resolution et response flush. Si l'app process termine entre 403 sent et audit insert, le log est perdu (regression Loi 09-08). Si on `await`, on bloque la reponse (~5-10ms latence ajoutee, acceptable car denial est cas exceptionnel).
   - Solution : `await this.rbacAudit.logAccessDenied(...)` AVEC try/catch interne qui isole les erreurs audit (log error console + Sentry, mais ne throw PAS pour ne pas masquer la 403 originale au client). Env var `RBAC_AUDIT_ASYNC=true` (defaut) enable mode `await`. Si `RBAC_AUDIT_ASYNC=false`, mode fire-and-forget avec process.nextTick (perte possible -- non recommande prod). Test V25 verifie audit emission dans les deux modes.

5. **Piege : ForbiddenException serialization perd les details.**
   - Pourquoi : `throw new ForbiddenException({ code: 'PERMISSION_DENIED', permissions: [...] })` -- NestJS serialize via HttpExceptionFilter en `{ statusCode: 403, message: { code, permissions }, error: 'Forbidden' }`. Mais si dev custom HttpExceptionFilter qui fait `exception.getResponse()` puis transforme en string, les details `permissions` sont perdus. Frontend Sprint 8+ ne peut alors pas afficher message contextualise.
   - Solution : Sprint 4 HttpExceptionFilter preserve `getResponse()` object integral. Documentation JSDoc rappel format envelope Skalean attendu : `{ error: { code: 'PERMISSION_DENIED', message: '...', details: { permissions, logic, role, endpoint } } }`. Test V26 verifie shape complet.

6. **Piege : Decorator on inheritance vs Override Reflector.getAllAndMerge bug.**
   - Pourquoi : Reflector expose deux methodes : `getAllAndOverride([handler, class])` (priorite handler over class) et `getAllAndMerge([handler, class])` (concat des deux, union). Pour PERMISSIONS_KEY, si on utilise `getAllAndMerge`, la liste devient l'union [class permissions + method permissions], ce qui modifie la semantique : un endpoint method `@RequirePermission('p1')` dans class `@RequirePermission('p2')` exigerait p1 ET p2 (avec AND default) -- comportement potentiellement non-voulu.
   - Solution : utiliser STRICTEMENT `getAllAndOverride` (semantique override class par method, conforme RoleGuard Tache 2.3.4). Si dev veut union, il doit l'expliciter via `@RequireAllPermissions('p1', 'p2', 'p_class')`. Test V27 verifie override.

7. **Piege : Permissions metadata vide -> pass-through silent.**
   - Pourquoi : si dev oublie le decorator (`@Get() handler() {}` sans `@RequirePermission`), le guard fait `if (!permissions?.length) return true` -- endpoint accessible a tous. Ce comportement est par design (PermissionGuard global avec opt-in via decorator), mais piege si dev OUBLIE de decorer un endpoint sensible.
   - Solution : env var `PERMISSION_GUARD_DEFAULT_DENY=false` (defaut, mode opt-in). Si `=true`, le guard throw `MissingPermissionDecoratorException` si pas de decorator (force decoration explicite). Recommandation Sprint 8+ : enable `=true` en prod, ajouter `@Public()` decorator pour endpoints volontairement publics. Test V28 verifie les deux modes.

8. **Piege : OR avec empty array equivalent vide -> pass-through ou block ?**
   - Pourquoi : `@RequireAnyPermission()` (pas d'argument) -> permissions array vide -> `canAccessAny(role, [])` -> conventionnellement retourne false (rien a satisfaire = aucune satisfaction possible) ou true (vacuous truth). Choix design impacte semantique.
   - Solution : decorator throw `EMPTY_PERMISSION_LIST` au load time si appele sans argument (validation Zod `z.array(PermissionValueSchema).min(1)`). Module crash au boot. Test V29 verifie crash explicite. Cas d'usage "endpoint accessible a tous" : utiliser `@Public()` decorator distinct (Sprint 6).

9. **Piege : AND avec empty array equivalent vide -> pass-through ou block ?**
   - Pourquoi : meme question que OR mais semantique differente : AND vide = vacuously true conventionnel mathematique (tous les zero elements sont satisfaits). Mais pour authorization, c'est dangereux (ouverture par defaut).
   - Solution : meme solution que piege #8 -- decorator throw au load time si vide. Pas de cas d'usage legitime "AND vide" dans Skalean.

10. **Piege : Permission revocation in-flight (cache stale).**
    - Pourquoi : si admin revoque la permission `crm.contacts.create` au role broker_user (modif matrice runtime via `/admin/rbac/grant` Sprint 7 Tache 2.3.11), les requetes en cours utilisant l'ancienne matrice cached Redis vont continuer a etre acceptees jusqu'a expiration cache (TTL 5min defaut). Race window critique pour security.
    - Solution : Sprint 12 introduit broadcast invalidation via Redis pubsub (`rbac:matrix:invalidate` channel). Le `RbacService` cache invalidate sur receipt. PermissionGuard ne fait rien specialement -- c'est responsabilite RbacService de gerer cache. Mais documentation explicit dans Section 12 edge cases.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.5 est la 5eme tache du Sprint 7 (RBAC Granulaire) et la 27eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.4 (RoleGuard livre, decorator metadata pattern, ExecutionContext extraction helpers, RoleGuardModule reference de structure module Nest), Tache 2.3.3 (RbacService injectable expose `canAccess`, `canAccessAny`, `canAccessAll`, AccessResult), Tache 2.3.2 (RoleHierarchy + getEffectivePermissions memoized), Tache 2.3.1 (catalog Permission TS const + Zod schema + PermissionValue type), Sprint 6 complet (TenantContext propagation cls-hooked AsyncLocalStorage Sprint 6 Tache 2.6.x, JwtAuthGuard publie request.user.role + tenantId + userId), Sprint 5 infra (Helm Nest deploy), Sprint 1-2 stack (NestJS 10.4.x, TypeScript 5.7.3, Vitest 2.1.8, Pino 9.5.x, reflect-metadata 0.2.x, Zod 3.24.1, NestJS Reflector core).
- **Bloque** : Tache 2.3.6 (ScopeGuard reutilise pattern decorator + Reflector + AsyncLocalStorage + audit), Tache 2.3.7 (AbacService consume permissions context), Tache 2.3.8 (AbacResourceGuard utilise PermissionGuard pre-check + ABAC overlay), Tache 2.3.9 (AuditTrail filter consume `permission_guard.denied` events), Tache 2.3.10 (RbacAuditService persistence injecte dans guard), Tache 2.3.11 (admin endpoints utilisent `@RequirePermission('admin.rbac.grant')`), Tache 2.3.12 (E2E coverage 12 roles utilise les decorators sur endpoints test exhaustifs), TOUS les sprints metier 8+ controllers.
- **Apporte au sprint** : la classe injectable `PermissionGuard` consommant Reflector + RbacService + RbacAuditService + LoggerService, les decorators `@RequirePermission`, `@RequireAnyPermission`, `@RequireAllPermissions`, le module Nest `PermissionGuardModule`, les types d'erreur `PermissionGuardErrorCode` + `PermissionGuardForbiddenDetails`, les helpers `getPermissionsFromContext`, `getPermissionsLogicFromContext`, `extractPermissionGuardContext`, `buildPermissionCacheKey`, les fixtures de test ExecutionContext mocks pour permissions, le barrel `index.ts` mis a jour.

### 3.2 Position dans le programme global

Cette tache pose le decorateur de deuxieme ligne consomme par 35 sprints. Tout controller Sprint 8+ qui necessite un check permission-based granulaire (la majorite des endpoints metier CRM/Insure/Repair/Pay/Books) utilise un de ces decorators. L'evolution principale au-dela du Sprint 7 :
- Sprint 8-11 (CRM, Booking, Comm, Docs) : decorators massivement utilises (~200 endpoints).
- Sprint 12 (compliance) : ajoute permissions `compliance.acaps_reports.generate`, `compliance.aml_alerts.review` + invalidation cache pubsub.
- Sprint 13-17 (Pay, Books, Insure) : ~150 endpoints additionnels.
- Sprint 18 (GraphQL) : decorators reutilises sur resolvers via NestJS GraphQL module.
- Sprint 25 (cross-tenant) : nouveau decorator `@RequireCrossTenantPermission` etend pattern.
- Sprint 26 (impersonation) : aucun changement guard ; impersonation gere TenantContextGuard Sprint 6.
- Sprint 30 (MCP) : decorator `@RequirePermission('mcp.tools.invoke')` consommable sur tools resolvers.
- Sprint 31 (Sky AI) : agent execute permission checks via RbacService directement, pas via guards HTTP.
- Sprint 33 (pentest) : 50+ scenarios verifient absence de bypass via mauvais ordre guards ou metadata corruption.

### 3.3 Diagramme guard chain ASCII detaille

```
   HTTP Request -> NestJS Router -> Handler decorated with multiple guards
          |
          v
   +----------------------------------------------------------------------+
   | Guard chain (executed in declared order, short-circuit on false/throw)|
   +----------------------------------------------------------------------+
          |
          v
   [1] JwtAuthGuard (Sprint 6)
       - Extract Authorization: Bearer <jwt>
       - Validate signature + expiration via JWKS rotation
       - Inject request.user = { sub, role, tenantId, sessionId, ... }
       - Throw 401 UnauthorizedException if invalid
          |
          v
   [2] TenantContextGuard (Sprint 6)
       - Read request.user.role + request.user.tenantId + request.user.sub
       - Initialize AsyncLocalStorage cls-hooked context:
         { userId, userRole, tenantId, originalUserRole?, traceId, requestId }
       - getCurrentContext() now returns populated context
          |
          v
   [3] RoleGuard (Tache 2.3.4) -- OPTIONAL if @Role/@MinRole/@AnyRole present
       - Check role-based metadata
       - Pass-through if no role decorator
          |
          v
   [4] PermissionGuard (THIS TASK 2.3.5)
       - Reflector.getAllAndOverride(PERMISSIONS_KEY, [handler, class])
       - Reflector.getAllAndOverride(PERMISSIONS_LOGIC_KEY, [handler, class])
       - If no PERMISSIONS_KEY metadata -> return true (no check)
       - currentRole = getCurrentContext()?.userRole
       - currentUserId = getCurrentContext()?.userId
       - currentTenantId = getCurrentContext()?.tenantId
       - If !currentRole -> ForbiddenException(NO_USER_CONTEXT)
       - logic = LOGIC_KEY ?? 'AND'
       - allowed = logic === 'OR'
           ? await rbac.canAccessAny(currentRole, permissions)
           : await rbac.canAccessAll(currentRole, permissions)
       - (note: super_admin bypass handled inside rbac.canAccess)
       - If allowed -> return true (optional debug log if RBAC_LOG_GRANTED=true)
       - If denied:
         - await rbacAudit.logAccessDenied({ permissions, logic, role, userId,
                                              tenantId, endpoint, method, ... })
         - throw ForbiddenException({ code: 'PERMISSION_DENIED',
                                       permissions, logic, role, ... })
          |
          v
   [5] AbacResourceGuard (Tache 2.3.8) -- OPTIONAL if @AbacResource present
       - Load resource from DB
       - rbac.canAccess(currentRole, permission, abacContext) with attributes
       - Throw if denied
          |
          v
   Handler executes with full authorization confirmed
   Response 2xx returned
   (Optional: granted audit log via interceptor Tache 2.3.10 if RBAC_AUDIT_GRANTED=true)
```

### 3.4 Decorator metadata flow detaille

```
   Source code:
     @Controller('crm/contacts')
     @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
     export class ContactsController {
       @Get()
       @RequirePermission('crm.contacts.read')
       list() {}

       @Post()
       @RequirePermission('crm.contacts.create')
       create() {}

       @Delete(':id')
       @RequireAllPermissions('crm.contacts.delete', 'crm.contacts.update')
       delete() {}

       @Get('owned-or-all')
       @RequireAnyPermission('crm.contacts.read', 'crm.contacts.read_own')
       readOwnedOrAll() {}
     }

   Module load time:
     1. Decorator @RequirePermission('crm.contacts.read') executes:
        - validatePermissions(['crm.contacts.read']) via Zod (PermissionValueSchema)
        - applyDecorators returns composed decorator
        - SetMetadata('@insurtech/auth:permissions', ['crm.contacts.read']) on list handler
        - SetMetadata('@insurtech/auth:permissions_logic', 'AND') on list handler

     2. Decorator @RequireAllPermissions('crm.contacts.delete', 'crm.contacts.update'):
        - validatePermissions(['crm.contacts.delete', 'crm.contacts.update']) via Zod
        - SetMetadata('@insurtech/auth:permissions', [delete, update]) on delete handler
        - SetMetadata('@insurtech/auth:permissions_logic', 'AND') on delete handler

     3. Decorator @RequireAnyPermission('crm.contacts.read', 'crm.contacts.read_own'):
        - validatePermissions(...) via Zod
        - SetMetadata('@insurtech/auth:permissions', [read, read_own]) on readOwnedOrAll handler
        - SetMetadata('@insurtech/auth:permissions_logic', 'OR') on readOwnedOrAll handler

   Request time (POST /crm/contacts, currentRole = broker_user):
     PermissionGuard.canActivate(context):
       handler = context.getHandler() -> reference to create function
       class = context.getClass() -> reference to ContactsController
       permissions = Reflector.getAllAndOverride(PERMISSIONS_KEY, [handler, class])
                   -> ['crm.contacts.create'] (from method, no class metadata)
       logic = Reflector.getAllAndOverride(PERMISSIONS_LOGIC_KEY, [handler, class])
             -> 'AND' (from method)
       currentRole = getCurrentContext().userRole -> 'broker_user'
       currentUserId = getCurrentContext().userId -> 'usr_abc123'
       currentTenantId = getCurrentContext().tenantId -> 'tnt_xyz789'
       allowed = await rbac.canAccessAll('broker_user', ['crm.contacts.create'])
               -> true (broker_user has crm.contacts.create in matrix)
       return true

   Request time (DELETE /crm/contacts/123, currentRole = broker_assistant):
     PermissionGuard.canActivate(context):
       permissions = ['crm.contacts.delete', 'crm.contacts.update']
       logic = 'AND'
       currentRole = 'broker_assistant'
       allowed = await rbac.canAccessAll('broker_assistant', [delete, update])
               -> false (broker_assistant has neither)
       await rbacAudit.logAccessDenied({
         permissions: ['crm.contacts.delete', 'crm.contacts.update'],
         logic: 'AND',
         role: 'broker_assistant',
         userId: 'usr_def456',
         tenantId: 'tnt_xyz789',
         endpoint: '/crm/contacts/123',
         method: 'DELETE',
         ipAddress: '197.230.x.x',
         userAgent: '...',
         timestamp: '2026-05-05T12:34:56.789Z',
         denialReason: 'PERMISSION_NOT_GRANTED',
       })
       throw ForbiddenException({
         code: 'PERMISSION_DENIED',
         permissions: ['crm.contacts.delete', 'crm.contacts.update'],
         logic: 'AND',
         role: 'broker_assistant',
         endpoint: '/crm/contacts/123',
         method: 'DELETE',
         requestId: 'req_uuid',
         timestamp: '2026-05-05T12:34:56.789Z',
       })
```

### 3.5 Integration PermissionGuard dans NestJS DI

```
   AppModule (apps/api)
     imports: [
       AuthModule (packages/auth)
         imports: [
           PermissionGuardModule
             providers: [
               PermissionGuard,
               { provide: APP_GUARD, useClass: PermissionGuard, scope: Scope.REQUEST }
             ],
             imports: [
               RbacModule,        // for RbacService.canAccess*
               RbacAuditModule,   // for RbacAuditService.logAccessDenied (Tache 2.3.10)
               LoggerModule,      // Pino global
             ],
             exports: [PermissionGuard]
           RbacModule
             ...
           RbacAuditModule
             providers: [RbacAuditService]
             exports: [RbacAuditService]
         ],
         exports: [PermissionGuard, RbacService, RbacAuditService, ...]
     ]
```

---

## 4. Livrables checkables

- [ ] L1 : Fichier `repo/apps/api/src/common/decorators/require-permission.decorator.ts` cree (~80 lignes).
- [ ] L2 : Fichier `repo/apps/api/src/common/guards/permission.guard.ts` cree (~220 lignes).
- [ ] L3 : Fichier `repo/apps/api/src/common/guards/permission.guard.spec.ts` cree (~350 lignes, 30+ tests).
- [ ] L4 : Fichier `repo/apps/api/src/common/decorators/require-permission.decorator.spec.ts` cree (~150 lignes, 10+ tests metadata).
- [ ] L5 : Fichier `repo/apps/api/src/common/guards/permission-guard.module.ts` cree (~60 lignes).
- [ ] L6 : Fichier `repo/apps/api/src/common/guards/permission-decorator-helpers.ts` cree (~80 lignes).
- [ ] L7 : Fichier `repo/apps/api/src/common/guards/permission-guard-error.types.ts` cree (~80 lignes).
- [ ] L8 : Fichier `repo/apps/api/src/common/guards/permission-guard-fixtures.ts` cree (~100 lignes).
- [ ] L9 : Fichier `repo/apps/api/src/common/guards/permission-guard-context-resolver.ts` cree (~80 lignes).
- [ ] L10 : Fichier `repo/apps/api/src/common/guards/permission-cache-key.ts` cree (~60 lignes).
- [ ] L11 : Barrel `repo/apps/api/src/common/guards/index.ts` mis a jour pour exporter tous les artefacts PermissionGuard.
- [ ] L12 : Decorator `@RequirePermission(perm: PermissionValue)` -- valide via Zod au load-time, throw si invalide.
- [ ] L13 : Decorator `@RequireAnyPermission(...perms: PermissionValue[])` -- semantique OR, throw si vide.
- [ ] L14 : Decorator `@RequireAllPermissions(...perms: PermissionValue[])` -- semantique AND, throw si vide.
- [ ] L15 : Guard `PermissionGuard` injecte Reflector + RbacService + RbacAuditService + Logger.
- [ ] L16 : Guard lit metadata via `Reflector.getAllAndOverride` (PAS Merge).
- [ ] L17 : Guard recupere context via `getCurrentContext()` AsyncLocalStorage Sprint 6.
- [ ] L18 : Guard delegue a `rbac.canAccessAll` ou `rbac.canAccessAny` selon logic.
- [ ] L19 : Guard emet audit log automatique sur denial via `RbacAuditService.logAccessDenied`.
- [ ] L20 : Guard throw `ForbiddenException` avec details structures `{ code, permissions, logic, role, endpoint, method, timestamp, requestId }`.
- [ ] L21 : Guard supporte env var `RBAC_LOG_GRANTED=false` (defaut) -- pas de log sur granted.
- [ ] L22 : Guard supporte env var `RBAC_AUDIT_ASYNC=true` (defaut) -- await audit.
- [ ] L23 : Guard supporte env var `PERMISSION_GUARD_DEFAULT_DENY=false` (defaut opt-in mode).
- [ ] L24 : Module `PermissionGuardModule` exporte `PermissionGuard` et registre via `APP_GUARD` optionnel.
- [ ] L25 : Tests Vitest 30+ scenarios couvrant granted, denied, OR, AND, super_admin bypass, audit emission, decorator stacking, no-context, env vars, edge cases.

---

## 5. Fichiers crees / modifies

```
Crees :
  repo/apps/api/src/common/decorators/require-permission.decorator.ts          ~80 lignes
  repo/apps/api/src/common/decorators/require-permission.decorator.spec.ts     ~150 lignes
  repo/apps/api/src/common/guards/permission.guard.ts                          ~220 lignes
  repo/apps/api/src/common/guards/permission.guard.spec.ts                     ~350 lignes
  repo/apps/api/src/common/guards/permission-guard.module.ts                   ~60 lignes
  repo/apps/api/src/common/guards/permission-decorator-helpers.ts              ~80 lignes
  repo/apps/api/src/common/guards/permission-guard-error.types.ts              ~80 lignes
  repo/apps/api/src/common/guards/permission-guard-fixtures.ts                 ~100 lignes
  repo/apps/api/src/common/guards/permission-guard-context-resolver.ts         ~80 lignes
  repo/apps/api/src/common/guards/permission-cache-key.ts                      ~60 lignes

Modifies :
  repo/apps/api/src/common/guards/index.ts                                     +10 lignes (barrel)
  repo/apps/api/src/common/decorators/index.ts                                 +3 lignes (barrel)
  repo/apps/api/src/app.module.ts                                              +1 ligne (import PermissionGuardModule)
  repo/.env.example                                                            +3 lignes (env vars)
  repo/docs/rbac/permission-guard-usage.md                                     +200 lignes (documentation usage)
```

---

## 6. Code patterns COMPLETS

### 6.1 `require-permission.decorator.ts` (~80 lignes)

```typescript
// repo/apps/api/src/common/decorators/require-permission.decorator.ts
/**
 * @file RequirePermission decorator family for PermissionGuard.
 * @module @insurtech/auth/decorators
 *
 * Three decorators compose the permission-based authorization layer:
 *   - @RequirePermission(perm)              : single permission required
 *   - @RequireAnyPermission(...perms)       : OR semantics (at least one)
 *   - @RequireAllPermissions(...perms)      : AND semantics (every one required)
 *
 * Posts two distinct metadata keys via applyDecorators composition:
 *   - PERMISSIONS_KEY: PermissionValue[]
 *   - PERMISSIONS_LOGIC_KEY: 'AND' | 'OR'
 *
 * Validates inputs via Zod at load-time. Throws RequirePermissionDecoratorError
 * if invalid (typo, empty list, non-PermissionValue). Module crash at boot.
 *
 * Usage:
 *   @Controller('contacts')
 *   @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
 *   export class ContactsController {
 *     @Post() @RequirePermission('crm.contacts.create') create() {}
 *     @Get() @RequireAnyPermission('crm.contacts.read', 'crm.contacts.read_own') list() {}
 *     @Delete(':id') @RequireAllPermissions('crm.contacts.delete', 'crm.contacts.update') delete() {}
 *   }
 */

import { applyDecorators, SetMetadata } from '@nestjs/common';
import { z } from 'zod';
import { PermissionValueSchema, type PermissionValue } from '@insurtech/auth/rbac/permissions';

/** Namespace-prefixed metadata keys to avoid collision with third-party libraries. */
export const PERMISSIONS_KEY = '@insurtech/auth:permissions' as const;
export const PERMISSIONS_LOGIC_KEY = '@insurtech/auth:permissions_logic' as const;

export type PermissionsLogic = 'AND' | 'OR';

/** Zod schema for runtime validation of permission lists. */
const PermissionListSchema = z.array(PermissionValueSchema).min(1, {
  message: 'EMPTY_PERMISSION_LIST: at least one permission is required. Use @Public() for unrestricted endpoints.',
});

/** Custom error thrown at load-time if decorator inputs invalid. */
export class RequirePermissionDecoratorError extends Error {
  public readonly code: string;
  public readonly invalidInputs: unknown;
  constructor(code: string, message: string, invalidInputs: unknown) {
    super(`[RequirePermissionDecoratorError:${code}] ${message}`);
    this.name = 'RequirePermissionDecoratorError';
    this.code = code;
    this.invalidInputs = invalidInputs;
  }
}

/** Internal helper: validate + return validated permissions or throw. */
function validatePermissions(perms: PermissionValue[]): PermissionValue[] {
  const parsed = PermissionListSchema.safeParse(perms);
  if (!parsed.success) {
    throw new RequirePermissionDecoratorError(
      'INVALID_PERMISSIONS',
      `Permission list validation failed: ${JSON.stringify(parsed.error.flatten())}`,
      perms,
    );
  }
  return parsed.data;
}

/**
 * Require a single permission. Equivalent to @RequireAllPermissions(perm) singleton.
 * Defaults to AND logic (irrelevant for singleton).
 */
export const RequirePermission = (permission: PermissionValue) => {
  const validated = validatePermissions([permission]);
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, validated),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'AND' as PermissionsLogic),
  );
};

/**
 * Require ANY of the listed permissions (OR semantics).
 * Throws at load-time if list is empty.
 */
export const RequireAnyPermission = (...permissions: PermissionValue[]) => {
  const validated = validatePermissions(permissions);
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, validated),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'OR' as PermissionsLogic),
  );
};

/**
 * Require ALL of the listed permissions (AND semantics).
 * Throws at load-time if list is empty.
 */
export const RequireAllPermissions = (...permissions: PermissionValue[]) => {
  const validated = validatePermissions(permissions);
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, validated),
    SetMetadata(PERMISSIONS_LOGIC_KEY, 'AND' as PermissionsLogic),
  );
};
```

### 6.2 `permission.guard.ts` (~220 lignes)

```typescript
// repo/apps/api/src/common/guards/permission.guard.ts
/**
 * @file PermissionGuard - granular permission-based authorization guard.
 * @module @insurtech/auth/guards
 *
 * Reads metadata from @RequirePermission/Any/All decorators, resolves current role
 * from TenantContext (Sprint 6 AsyncLocalStorage), delegates decision to RbacService
 * (canAccessAll / canAccessAny), emits audit log on denial via RbacAuditService.
 *
 * Compatibility chain (REQUIRED order):
 *   @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard, [optional AbacResourceGuard])
 *
 * Env vars:
 *   - RBAC_LOG_GRANTED=false (default) -- skip granted log emission (debug only)
 *   - RBAC_AUDIT_ASYNC=true (default)  -- await audit log; false = fire-and-forget
 *   - PERMISSION_GUARD_DEFAULT_DENY=false (default) -- if true, missing decorator -> deny
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_LOGIC_KEY,
  type PermissionsLogic,
} from '../decorators/require-permission.decorator';
import type { PermissionValue } from '@insurtech/auth/rbac/permissions';
import { RbacService } from '@insurtech/auth/rbac/rbac.service';
import { RbacAuditService } from '@insurtech/auth/rbac/rbac-audit.service';
import { getCurrentContext } from '@insurtech/auth/context/tenant-context';
import {
  PermissionGuardErrorCode,
  type PermissionGuardForbiddenDetails,
} from './permission-guard-error.types';
import { extractPermissionGuardContext } from './permission-guard-context-resolver';
import { buildPermissionCacheKey } from './permission-cache-key';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);
  private readonly logGranted: boolean;
  private readonly auditAsync: boolean;
  private readonly defaultDeny: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
    @Optional() private readonly rbacAudit?: RbacAuditService,
  ) {
    this.logGranted = process.env.RBAC_LOG_GRANTED === 'true';
    this.auditAsync = process.env.RBAC_AUDIT_ASYNC !== 'false';
    this.defaultDeny = process.env.PERMISSION_GUARD_DEFAULT_DENY === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Extract metadata via Reflector (handler over class precedence)
    const permissions = this.reflector.getAllAndOverride<PermissionValue[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. No metadata -> pass-through (opt-in mode) or deny (default-deny mode)
    if (!permissions?.length) {
      if (this.defaultDeny) {
        this.logger.warn(
          `Endpoint missing @RequirePermission decorator (handler=${context.getHandler().name}, class=${context.getClass().name}). DEFAULT_DENY=true -> rejected.`,
        );
        throw new ForbiddenException(this.buildForbidden({
          code: PermissionGuardErrorCode.MISSING_DECORATOR,
          permissions: [],
          logic: 'AND',
          role: null,
          endpoint: this.getEndpoint(context),
          method: this.getMethod(context),
          timestamp: new Date().toISOString(),
        }));
      }
      return true;
    }

    const logic: PermissionsLogic =
      this.reflector.getAllAndOverride<PermissionsLogic>(PERMISSIONS_LOGIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'AND';

    // 3. Extract context (userRole, userId, tenantId) from AsyncLocalStorage
    const ctx = extractPermissionGuardContext(context);

    if (!ctx.userRole) {
      this.logger.error(
        `PermissionGuard invoked without TenantContext userRole. Endpoint=${ctx.endpoint}. Check guard chain order (TenantContextGuard must precede).`,
      );
      throw new ForbiddenException(this.buildForbidden({
        code: PermissionGuardErrorCode.NO_USER_CONTEXT,
        permissions,
        logic,
        role: null,
        endpoint: ctx.endpoint,
        method: ctx.method,
        timestamp: new Date().toISOString(),
        requestId: ctx.requestId,
      }));
    }

    // 4. Delegate decision to RbacService (handles super_admin bypass internally)
    const cacheKey = buildPermissionCacheKey(ctx.userRole, permissions, logic);
    let allowed: boolean;
    try {
      allowed = logic === 'OR'
        ? await this.rbac.canAccessAny(ctx.userRole, permissions)
        : await this.rbac.canAccessAll(ctx.userRole, permissions);
    } catch (err) {
      this.logger.error(
        `RbacService delegation failed during canAccess${logic === 'OR' ? 'Any' : 'All'}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Fail-closed on infrastructure errors (RbacService unavailable)
      throw new ForbiddenException(this.buildForbidden({
        code: PermissionGuardErrorCode.RBAC_SERVICE_ERROR,
        permissions,
        logic,
        role: ctx.userRole,
        endpoint: ctx.endpoint,
        method: ctx.method,
        timestamp: new Date().toISOString(),
        requestId: ctx.requestId,
      }));
    }

    // 5. Granted path
    if (allowed) {
      if (this.logGranted) {
        this.logger.debug(
          `permission_guard.granted role=${ctx.userRole} permissions=${permissions.join(',')} logic=${logic} endpoint=${ctx.endpoint} cacheKey=${cacheKey}`,
        );
      }
      return true;
    }

    // 6. Denied path: emit audit log + throw structured 403
    const denialDetails: PermissionGuardForbiddenDetails = {
      code: PermissionGuardErrorCode.PERMISSION_DENIED,
      permissions,
      logic,
      role: ctx.userRole,
      endpoint: ctx.endpoint,
      method: ctx.method,
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
    };

    await this.emitAuditDenied({
      permissions,
      logic,
      role: ctx.userRole,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      timestamp: denialDetails.timestamp,
      denialReason: 'PERMISSION_NOT_GRANTED',
    });

    this.logger.warn(
      `permission_guard.denied role=${ctx.userRole} userId=${ctx.userId} tenantId=${ctx.tenantId} permissions=${permissions.join(',')} logic=${logic} endpoint=${ctx.endpoint}`,
    );

    throw new ForbiddenException(this.buildForbidden(denialDetails));
  }

  private async emitAuditDenied(payload: Parameters<RbacAuditService['logAccessDenied']>[0]): Promise<void> {
    if (!this.rbacAudit) {
      this.logger.warn('RbacAuditService not injected; audit denial event NOT persisted (regression Loi 09-08 risk).');
      return;
    }
    const promise = this.rbacAudit
      .logAccessDenied(payload)
      .catch((err) => {
        // Isolate audit failures: do NOT mask original 403 to client
        this.logger.error(
          `RbacAudit.logAccessDenied failed (isolated): ${(err as Error).message}`,
          (err as Error).stack,
        );
      });
    if (this.auditAsync) {
      await promise;
    } else {
      // Fire-and-forget mode (not recommended prod)
      void promise;
    }
  }

  private buildForbidden(details: PermissionGuardForbiddenDetails): { error: PermissionGuardForbiddenDetails } {
    return { error: details };
  }

  private getEndpoint(context: ExecutionContext): string {
    try {
      const req = context.switchToHttp().getRequest();
      return req?.url ?? 'unknown';
    } catch {
      return 'non-http-context';
    }
  }

  private getMethod(context: ExecutionContext): string {
    try {
      const req = context.switchToHttp().getRequest();
      return req?.method ?? 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
```

### 6.3 `permission.guard.spec.ts` (~350 lignes, 30+ tests)

```typescript
// repo/apps/api/src/common/guards/permission.guard.spec.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_LOGIC_KEY,
} from '../decorators/require-permission.decorator';
import { PermissionGuardErrorCode } from './permission-guard-error.types';
import {
  buildExecutionContextMock,
  buildRbacServiceMock,
  buildRbacAuditServiceMock,
  installTenantContextMock,
  resetTenantContextMock,
} from './permission-guard-fixtures';

describe('PermissionGuard', () => {
  let reflector: Reflector;
  let rbac: ReturnType<typeof buildRbacServiceMock>;
  let rbacAudit: ReturnType<typeof buildRbacAuditServiceMock>;
  let guard: PermissionGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rbac = buildRbacServiceMock();
    rbacAudit = buildRbacAuditServiceMock();
    guard = new PermissionGuard(reflector, rbac as any, rbacAudit as any);
    installTenantContextMock({
      userId: 'usr_test',
      userRole: 'broker_user',
      tenantId: 'tnt_test',
      requestId: 'req_test',
    });
  });

  afterEach(() => {
    resetTenantContextMock();
    vi.restoreAllMocks();
  });

  describe('@RequirePermission single', () => {
    it('V1: accepts when role has permission', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['crm.contacts.create'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        request: { url: '/crm/contacts', method: 'POST' },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(rbac.canAccessAll).toHaveBeenCalledWith('broker_user', ['crm.contacts.create']);
      expect(rbacAudit.logAccessDenied).not.toHaveBeenCalled();
    });

    it('V2: rejects with 403 when role lacks permission', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['admin.tenants.suspend'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        request: { url: '/admin/tenants', method: 'POST' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(rbacAudit.logAccessDenied).toHaveBeenCalledTimes(1);
    });

    it('V3: response includes PERMISSION_DENIED code + permissions + role', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['admin.tenants.suspend'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        request: { url: '/admin/tenants', method: 'POST' },
      });
      try {
        await guard.canActivate(ctx);
      } catch (err) {
        const response = (err as ForbiddenException).getResponse() as any;
        expect(response.error.code).toBe(PermissionGuardErrorCode.PERMISSION_DENIED);
        expect(response.error.permissions).toEqual(['admin.tenants.suspend']);
        expect(response.error.role).toBe('broker_user');
        expect(response.error.endpoint).toBe('/admin/tenants');
        expect(response.error.method).toBe('POST');
        expect(response.error.logic).toBe('AND');
        expect(response.error.timestamp).toBeDefined();
      }
    });
  });

  describe('@RequireAnyPermission OR logic', () => {
    it('V4: OR truthy when at least one permission granted', async () => {
      rbac.canAccessAny.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['crm.contacts.read', 'crm.contacts.read_own'], [PERMISSIONS_LOGIC_KEY]: 'OR' },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(rbac.canAccessAny).toHaveBeenCalledWith('broker_user', ['crm.contacts.read', 'crm.contacts.read_own']);
      expect(rbac.canAccessAll).not.toHaveBeenCalled();
    });

    it('V5: OR rejects when all permissions denied', async () => {
      rbac.canAccessAny.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['admin.x', 'admin.y'], [PERMISSIONS_LOGIC_KEY]: 'OR' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('@RequireAllPermissions AND logic', () => {
    it('V6: AND truthy when all permissions granted', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['crm.contacts.delete', 'crm.contacts.update'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(rbac.canAccessAll).toHaveBeenCalledWith('broker_user', ['crm.contacts.delete', 'crm.contacts.update']);
    });

    it('V7: AND rejects when at least one permission denied', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['crm.contacts.delete', 'crm.contacts.update'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('default logic AND', () => {
    it('V8: missing PERMISSIONS_LOGIC_KEY defaults to AND', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['crm.contacts.create'] },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(rbac.canAccessAll).toHaveBeenCalled();
      expect(rbac.canAccessAny).not.toHaveBeenCalled();
    });
  });

  describe('super_admin bypass via RbacService', () => {
    it('V9: super_admin bypass propagates through canAccessAll', async () => {
      installTenantContextMock({ userId: 'usr_admin', userRole: 'super_admin_platform', tenantId: 'tnt_skalean', requestId: 'req' });
      rbac.canAccessAll.mockResolvedValue(true); // RbacService handles wildcard internally
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['arbitrary.permission.x'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V10: super_admin bypass propagates through canAccessAny', async () => {
      installTenantContextMock({ userId: 'usr_admin', userRole: 'super_admin_platform', tenantId: 'tnt_skalean', requestId: 'req' });
      rbac.canAccessAny.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['p1', 'p2'], [PERMISSIONS_LOGIC_KEY]: 'OR' },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('audit log emission', () => {
    it('V11: audit log called on denied with all required fields', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['admin.x'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        request: { url: '/admin/x', method: 'GET', headers: { 'user-agent': 'curl/8' } },
      });
      try { await guard.canActivate(ctx); } catch {}
      expect(rbacAudit.logAccessDenied).toHaveBeenCalledWith(expect.objectContaining({
        permissions: ['admin.x'],
        logic: 'AND',
        role: 'broker_user',
        userId: 'usr_test',
        tenantId: 'tnt_test',
        endpoint: '/admin/x',
        method: 'GET',
        denialReason: 'PERMISSION_NOT_GRANTED',
      }));
    });

    it('V12: no audit on granted (default config)', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['p'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      await guard.canActivate(ctx);
      expect(rbacAudit.logAccessDenied).not.toHaveBeenCalled();
    });

    it('V13: audit failure does NOT mask original 403', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      rbacAudit.logAccessDenied.mockRejectedValue(new Error('DB unavailable'));
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('V14: missing RbacAuditService logs warning but does not crash', async () => {
      const guardNoAudit = new PermissionGuard(reflector, rbac as any, undefined);
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      await expect(guardNoAudit.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('decorator on class vs method precedence', () => {
    it('V15: method-level @RequirePermission overrides class-level', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['method.specific'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        classMetadata: { [PERMISSIONS_KEY]: ['class.fallback'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
      });
      await guard.canActivate(ctx);
      expect(rbac.canAccessAll).toHaveBeenCalledWith('broker_user', ['method.specific']);
    });

    it('V16: class-level applies when no method decorator', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: {},
        classMetadata: { [PERMISSIONS_KEY]: ['class.only'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
      });
      await guard.canActivate(ctx);
      expect(rbac.canAccessAll).toHaveBeenCalledWith('broker_user', ['class.only']);
    });
  });

  describe('missing context handling', () => {
    it('V17: rejects with NO_USER_CONTEXT when userRole undefined', async () => {
      installTenantContextMock({ userId: undefined, userRole: undefined, tenantId: undefined, requestId: 'req' });
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      try {
        await guard.canActivate(ctx);
      } catch (err) {
        const r = (err as ForbiddenException).getResponse() as any;
        expect(r.error.code).toBe(PermissionGuardErrorCode.NO_USER_CONTEXT);
      }
    });
  });

  describe('no permissions metadata = pass-through', () => {
    it('V18: no decorator -> guard returns true (opt-in mode default)', async () => {
      const ctx = buildExecutionContextMock({ metadata: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(rbac.canAccessAll).not.toHaveBeenCalled();
    });

    it('V19: empty array metadata -> pass-through (treated as no decorator)', async () => {
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: [], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('RBAC service error handling', () => {
    it('V20: RbacService throw -> fail-closed 403 RBAC_SERVICE_ERROR', async () => {
      rbac.canAccessAll.mockRejectedValue(new Error('Redis down'));
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      try {
        await guard.canActivate(ctx);
      } catch (err) {
        const r = (err as ForbiddenException).getResponse() as any;
        expect(r.error.code).toBe(PermissionGuardErrorCode.RBAC_SERVICE_ERROR);
      }
    });
  });

  describe('env vars behavior', () => {
    it('V21: RBAC_LOG_GRANTED=true emits debug log', async () => {
      process.env.RBAC_LOG_GRANTED = 'true';
      const debugSpy = vi.fn();
      const g = new PermissionGuard(reflector, rbac as any, rbacAudit as any);
      (g as any).logger = { debug: debugSpy, warn: vi.fn(), error: vi.fn() };
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      await g.canActivate(ctx);
      expect(debugSpy).toHaveBeenCalled();
      delete process.env.RBAC_LOG_GRANTED;
    });

    it('V22: PERMISSION_GUARD_DEFAULT_DENY=true rejects missing decorator', async () => {
      process.env.PERMISSION_GUARD_DEFAULT_DENY = 'true';
      const g = new PermissionGuard(reflector, rbac as any, rbacAudit as any);
      const ctx = buildExecutionContextMock({ metadata: {} });
      await expect(g.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      delete process.env.PERMISSION_GUARD_DEFAULT_DENY;
    });
  });

  describe('logic OR with single perm', () => {
    it('V23: OR with one permission still uses canAccessAny', async () => {
      rbac.canAccessAny.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['p1'], [PERMISSIONS_LOGIC_KEY]: 'OR' } });
      await guard.canActivate(ctx);
      expect(rbac.canAccessAny).toHaveBeenCalled();
      expect(rbac.canAccessAll).not.toHaveBeenCalled();
    });
  });

  describe('AND with all granted', () => {
    it('V24: AND with 5 permissions all granted -> accept', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const perms = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: perms, [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('OR with all denied', () => {
    it('V25: OR with 5 permissions all denied -> reject', async () => {
      rbac.canAccessAny.mockResolvedValue(false);
      const perms = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: perms, [PERMISSIONS_LOGIC_KEY]: 'OR' } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('audit payload completeness', () => {
    it('V26: audit payload includes ipAddress + userAgent + requestId', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        request: {
          url: '/x', method: 'POST',
          headers: { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '197.230.1.2' },
          ip: '197.230.1.2',
        },
      });
      try { await guard.canActivate(ctx); } catch {}
      expect(rbacAudit.logAccessDenied).toHaveBeenCalledWith(expect.objectContaining({
        ipAddress: expect.any(String),
        userAgent: expect.stringContaining('Mozilla'),
        requestId: 'req_test',
      }));
    });
  });

  describe('decorator on inheritance', () => {
    it('V27: parent class metadata inherited if no override', async () => {
      rbac.canAccessAll.mockResolvedValue(true);
      const ctx = buildExecutionContextMock({
        metadata: {},
        classMetadata: { [PERMISSIONS_KEY]: ['parent.perm'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
      });
      await guard.canActivate(ctx);
      expect(rbac.canAccessAll).toHaveBeenCalledWith('broker_user', ['parent.perm']);
    });
  });

  describe('audit async modes', () => {
    it('V28: audit awaited by default (RBAC_AUDIT_ASYNC unset)', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      let resolved = false;
      rbacAudit.logAccessDenied.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        resolved = true;
      });
      const ctx = buildExecutionContextMock({ metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' } });
      try { await guard.canActivate(ctx); } catch {}
      expect(resolved).toBe(true);
    });
  });

  describe('cache key construction', () => {
    it('V29: cache key deterministic for same role+perms+logic', async () => {
      const { buildPermissionCacheKey } = await import('./permission-cache-key');
      const k1 = buildPermissionCacheKey('broker_user', ['p1', 'p2'], 'AND');
      const k2 = buildPermissionCacheKey('broker_user', ['p1', 'p2'], 'AND');
      expect(k1).toBe(k2);
    });

    it('V30: cache key differs for OR vs AND', async () => {
      const { buildPermissionCacheKey } = await import('./permission-cache-key');
      const kAnd = buildPermissionCacheKey('broker_user', ['p1', 'p2'], 'AND');
      const kOr = buildPermissionCacheKey('broker_user', ['p1', 'p2'], 'OR');
      expect(kAnd).not.toBe(kOr);
    });
  });

  describe('non-HTTP context', () => {
    it('V31: WS context fallback for endpoint extraction', async () => {
      rbac.canAccessAll.mockResolvedValue(false);
      const ctx = buildExecutionContextMock({
        metadata: { [PERMISSIONS_KEY]: ['x'], [PERMISSIONS_LOGIC_KEY]: 'AND' },
        request: null, // simulate non-HTTP
      });
      try {
        await guard.canActivate(ctx);
      } catch (err) {
        const r = (err as ForbiddenException).getResponse() as any;
        expect(r.error.endpoint).toBeDefined();
      }
    });
  });
});
```

### 6.4 `permission-guard.module.ts` (~60 lignes)

```typescript
// repo/apps/api/src/common/guards/permission-guard.module.ts
/**
 * @file PermissionGuardModule - NestJS module wrapping PermissionGuard.
 * @module @insurtech/auth/guards
 *
 * Imports RbacModule (for RbacService) and RbacAuditModule (for RbacAuditService).
 * Exports PermissionGuard for use via @UseGuards(PermissionGuard).
 *
 * Optional global registration via APP_GUARD when imported into AppModule:
 *   imports: [PermissionGuardModule.forGlobal()]
 */

import { Module, DynamicModule, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { RbacModule } from '@insurtech/auth/rbac/rbac.module';
import { RbacAuditModule } from '@insurtech/auth/rbac/rbac-audit.module';

@Module({
  imports: [RbacModule, RbacAuditModule],
  providers: [PermissionGuard],
  exports: [PermissionGuard],
})
export class PermissionGuardModule {
  /**
   * Register PermissionGuard as a GLOBAL guard via APP_GUARD provider.
   * Use when ALL routes should be subject to permission-checking by default.
   * Routes without @RequirePermission decorator behave per
   * PERMISSION_GUARD_DEFAULT_DENY env var (false=pass-through, true=deny).
   */
  static forGlobal(): DynamicModule {
    return {
      module: PermissionGuardModule,
      imports: [RbacModule, RbacAuditModule],
      providers: [
        PermissionGuard,
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
      exports: [PermissionGuard],
      global: true,
    };
  }
}
```

### 6.5 `permission-decorator-helpers.ts` (~80 lignes)

```typescript
// repo/apps/api/src/common/guards/permission-decorator-helpers.ts
/**
 * @file Helpers for extracting and inspecting permission metadata.
 * @module @insurtech/auth/guards
 *
 * Used by PermissionGuard internally and by tests / OpenAPI introspection.
 */

import { Reflector } from '@nestjs/core';
import { ExecutionContext, Type } from '@nestjs/common';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_LOGIC_KEY,
  type PermissionsLogic,
} from '../decorators/require-permission.decorator';
import type { PermissionValue } from '@insurtech/auth/rbac/permissions';

export interface PermissionMetadata {
  permissions: PermissionValue[];
  logic: PermissionsLogic;
  source: 'method' | 'class' | 'none';
}

/**
 * Extract permission metadata from ExecutionContext using getAllAndOverride
 * (handler over class precedence).
 */
export function getPermissionsFromContext(
  reflector: Reflector,
  context: ExecutionContext,
): PermissionMetadata {
  const handlerPerms = reflector.get<PermissionValue[] | undefined>(PERMISSIONS_KEY, context.getHandler());
  const classPerms = reflector.get<PermissionValue[] | undefined>(PERMISSIONS_KEY, context.getClass());

  let permissions: PermissionValue[] = [];
  let source: PermissionMetadata['source'] = 'none';
  if (handlerPerms?.length) {
    permissions = handlerPerms;
    source = 'method';
  } else if (classPerms?.length) {
    permissions = classPerms;
    source = 'class';
  }

  const logic = reflector.getAllAndOverride<PermissionsLogic>(
    PERMISSIONS_LOGIC_KEY,
    [context.getHandler(), context.getClass()],
  ) ?? 'AND';

  return { permissions, logic, source };
}

/**
 * Extract logic from a class or handler reference (for OpenAPI / static introspection).
 */
export function getPermissionsLogicFromContext(
  reflector: Reflector,
  target: Type<unknown> | Function,
): PermissionsLogic | undefined {
  return reflector.get<PermissionsLogic>(PERMISSIONS_LOGIC_KEY, target as any);
}

/**
 * Inspect a controller class for all permission decorators (used by audit tooling).
 */
export function inspectControllerPermissions(
  reflector: Reflector,
  controller: Type<unknown>,
): Array<{ method: string; permissions: PermissionValue[]; logic: PermissionsLogic }> {
  const proto = controller.prototype;
  const methods = Object.getOwnPropertyNames(proto).filter((m) => m !== 'constructor');
  return methods
    .map((method) => {
      const fn = proto[method];
      const perms = reflector.get<PermissionValue[]>(PERMISSIONS_KEY, fn) ?? [];
      const logic = reflector.get<PermissionsLogic>(PERMISSIONS_LOGIC_KEY, fn) ?? 'AND';
      return { method, permissions: perms, logic };
    })
    .filter((entry) => entry.permissions.length > 0);
}
```

### 6.6 `require-permission.decorator.spec.ts` (~150 lignes)

```typescript
// repo/apps/api/src/common/decorators/require-permission.decorator.spec.ts
import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import {
  RequirePermission,
  RequireAnyPermission,
  RequireAllPermissions,
  RequirePermissionDecoratorError,
  PERMISSIONS_KEY,
  PERMISSIONS_LOGIC_KEY,
} from './require-permission.decorator';

describe('RequirePermission decorator family', () => {
  describe('@RequirePermission', () => {
    it('M1: posts PERMISSIONS_KEY with single-element array', () => {
      class C {
        @RequirePermission('crm.contacts.create')
        m() {}
      }
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, C.prototype.m);
      expect(perms).toEqual(['crm.contacts.create']);
    });

    it('M2: posts PERMISSIONS_LOGIC_KEY with AND', () => {
      class C {
        @RequirePermission('crm.contacts.create')
        m() {}
      }
      const logic = Reflect.getMetadata(PERMISSIONS_LOGIC_KEY, C.prototype.m);
      expect(logic).toBe('AND');
    });

    it('M3: throws on invalid permission value (typo)', () => {
      expect(() => {
        class C {
          @RequirePermission('not.a.real.permission' as any)
          m() {}
        }
      }).toThrow(RequirePermissionDecoratorError);
    });
  });

  describe('@RequireAnyPermission', () => {
    it('M4: posts PERMISSIONS_KEY with full array', () => {
      class C {
        @RequireAnyPermission('crm.contacts.read', 'crm.contacts.read_own')
        m() {}
      }
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, C.prototype.m);
      expect(perms).toEqual(['crm.contacts.read', 'crm.contacts.read_own']);
    });

    it('M5: posts PERMISSIONS_LOGIC_KEY with OR', () => {
      class C {
        @RequireAnyPermission('crm.contacts.read', 'crm.contacts.read_own')
        m() {}
      }
      const logic = Reflect.getMetadata(PERMISSIONS_LOGIC_KEY, C.prototype.m);
      expect(logic).toBe('OR');
    });

    it('M6: throws on empty array', () => {
      expect(() => {
        class C {
          @RequireAnyPermission()
          m() {}
        }
      }).toThrow(RequirePermissionDecoratorError);
    });
  });

  describe('@RequireAllPermissions', () => {
    it('M7: posts PERMISSIONS_KEY with full array', () => {
      class C {
        @RequireAllPermissions('crm.contacts.delete', 'crm.contacts.update')
        m() {}
      }
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, C.prototype.m);
      expect(perms).toEqual(['crm.contacts.delete', 'crm.contacts.update']);
    });

    it('M8: posts PERMISSIONS_LOGIC_KEY with AND', () => {
      class C {
        @RequireAllPermissions('crm.contacts.delete', 'crm.contacts.update')
        m() {}
      }
      const logic = Reflect.getMetadata(PERMISSIONS_LOGIC_KEY, C.prototype.m);
      expect(logic).toBe('AND');
    });

    it('M9: throws on empty array', () => {
      expect(() => {
        class C {
          @RequireAllPermissions()
          m() {}
        }
      }).toThrow(RequirePermissionDecoratorError);
    });
  });

  describe('class-level decoration', () => {
    it('M10: class-level @RequirePermission posts metadata on class itself', () => {
      @RequirePermission('admin.tenants.read')
      class C {}
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, C);
      expect(perms).toEqual(['admin.tenants.read']);
    });
  });

  describe('namespace-prefixed keys', () => {
    it('M11: PERMISSIONS_KEY is namespace-prefixed to avoid collision', () => {
      expect(PERMISSIONS_KEY).toBe('@insurtech/auth:permissions');
      expect(PERMISSIONS_LOGIC_KEY).toBe('@insurtech/auth:permissions_logic');
    });
  });

  describe('error structure', () => {
    it('M12: RequirePermissionDecoratorError exposes code + invalidInputs', () => {
      try {
        class C {
          @RequirePermission('bad' as any)
          m() {}
        }
      } catch (err) {
        expect(err).toBeInstanceOf(RequirePermissionDecoratorError);
        expect((err as RequirePermissionDecoratorError).code).toBe('INVALID_PERMISSIONS');
        expect((err as RequirePermissionDecoratorError).invalidInputs).toEqual(['bad']);
      }
    });
  });
});
```

### 6.7 `permission-guard-error.types.ts` (~80 lignes)

```typescript
// repo/apps/api/src/common/guards/permission-guard-error.types.ts
/**
 * @file Error types for PermissionGuard ForbiddenException responses.
 * @module @insurtech/auth/guards
 *
 * Used by PermissionGuard to construct structured 403 responses consumed by
 * Sprint 4 HttpExceptionFilter, Sprint 8+ frontends (web-broker, web-garage, etc),
 * and Sprint 33 pentest assertions.
 */

import type { PermissionValue } from '@insurtech/auth/rbac/permissions';
import type { AuthRole } from '@insurtech/auth/rbac/roles';
import type { PermissionsLogic } from '../decorators/require-permission.decorator';

/** Discriminated codes returned in ForbiddenException response. */
export const PermissionGuardErrorCode = {
  /** Standard denial: role does not have required permission(s) per matrix. */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** TenantContextGuard did not run before PermissionGuard, no userRole available. */
  NO_USER_CONTEXT: 'NO_USER_CONTEXT',
  /** PERMISSION_GUARD_DEFAULT_DENY=true and endpoint missing @RequirePermission. */
  MISSING_DECORATOR: 'MISSING_DECORATOR',
  /** RbacService threw infrastructure error (Redis down, matrix not loaded). */
  RBAC_SERVICE_ERROR: 'RBAC_SERVICE_ERROR',
} as const;

export type PermissionGuardErrorCode =
  (typeof PermissionGuardErrorCode)[keyof typeof PermissionGuardErrorCode];

/** Shape of details object inside ForbiddenException response.error. */
export interface PermissionGuardForbiddenDetails {
  code: PermissionGuardErrorCode;
  permissions: PermissionValue[];
  logic: PermissionsLogic;
  role: AuthRole | null;
  endpoint: string;
  method: string;
  timestamp: string;
  requestId?: string;
  /** Optional human-readable diagnostic; never includes PII. */
  diagnostic?: string;
}

/** Full ForbiddenException response envelope per Sprint 4 convention. */
export interface PermissionGuardForbiddenResponse {
  error: PermissionGuardForbiddenDetails;
}

/** Type guard for response narrowing in tests / HTTP filters. */
export function isPermissionGuardForbiddenResponse(
  payload: unknown,
): payload is PermissionGuardForbiddenResponse {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  if (!obj.error || typeof obj.error !== 'object') return false;
  const error = obj.error as Record<string, unknown>;
  return (
    typeof error.code === 'string' &&
    Array.isArray(error.permissions) &&
    typeof error.logic === 'string' &&
    typeof error.endpoint === 'string' &&
    typeof error.method === 'string' &&
    typeof error.timestamp === 'string'
  );
}
```

### 6.8 `permission-guard-fixtures.ts` (~100 lignes)

```typescript
// repo/apps/api/src/common/guards/permission-guard-fixtures.ts
/**
 * @file Test fixtures for PermissionGuard specs.
 * @module @insurtech/auth/guards
 */

import { vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth/rbac/roles';
import type { RbacService } from '@insurtech/auth/rbac/rbac.service';
import type { RbacAuditService } from '@insurtech/auth/rbac/rbac-audit.service';

interface ContextMockOptions {
  metadata?: Record<string, unknown>;
  classMetadata?: Record<string, unknown>;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    ip?: string;
  } | null;
}

export function buildExecutionContextMock(opts: ContextMockOptions = {}): ExecutionContext {
  const handler = function mockHandler() {};
  const klass = class MockController {};

  // Apply metadata to handler / class
  Object.entries(opts.metadata ?? {}).forEach(([key, value]) => {
    Reflect.defineMetadata(key, value, handler);
  });
  Object.entries(opts.classMetadata ?? {}).forEach(([key, value]) => {
    Reflect.defineMetadata(key, value, klass);
  });

  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => opts.request === null ? undefined : (opts.request ?? { url: '/test', method: 'GET', headers: {}, ip: '127.0.0.1' }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => ({}) }),
    switchToRpc: () => ({ getContext: () => ({}), getData: () => ({}) }),
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
  } as unknown as ExecutionContext;
}

export function buildRbacServiceMock(): {
  canAccess: ReturnType<typeof vi.fn>;
  canAccessAll: ReturnType<typeof vi.fn>;
  canAccessAny: ReturnType<typeof vi.fn>;
} {
  return {
    canAccess: vi.fn(),
    canAccessAll: vi.fn(),
    canAccessAny: vi.fn(),
  };
}

export function buildRbacAuditServiceMock(): {
  logAccessDenied: ReturnType<typeof vi.fn>;
  logAccessGranted: ReturnType<typeof vi.fn>;
} {
  return {
    logAccessDenied: vi.fn().mockResolvedValue(undefined),
    logAccessGranted: vi.fn().mockResolvedValue(undefined),
  };
}

interface TenantContextMock {
  userId?: string;
  userRole?: AuthRole;
  tenantId?: string;
  requestId?: string;
}

let currentMockContext: TenantContextMock | undefined;

export function installTenantContextMock(ctx: TenantContextMock): void {
  currentMockContext = ctx;
  vi.mock('@insurtech/auth/context/tenant-context', () => ({
    getCurrentContext: () => currentMockContext,
  }));
}

export function resetTenantContextMock(): void {
  currentMockContext = undefined;
}

export function getTenantContextMock(): TenantContextMock | undefined {
  return currentMockContext;
}
```

### 6.9 `permission-guard-context-resolver.ts` (~80 lignes)

```typescript
// repo/apps/api/src/common/guards/permission-guard-context-resolver.ts
/**
 * @file Helpers to extract authorization context from ExecutionContext.
 * @module @insurtech/auth/guards
 *
 * Centralizes extraction logic so PermissionGuard remains thin and reusable
 * across HTTP, GraphQL, WebSocket, MCP transports.
 */

import { ExecutionContext } from '@nestjs/common';
import { getCurrentContext } from '@insurtech/auth/context/tenant-context';
import type { AuthRole } from '@insurtech/auth/rbac/roles';

export interface PermissionGuardExtractedContext {
  userId: string | undefined;
  userRole: AuthRole | undefined;
  tenantId: string | undefined;
  requestId: string | undefined;
  endpoint: string;
  method: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

export function extractPermissionGuardContext(
  context: ExecutionContext,
): PermissionGuardExtractedContext {
  const tenantCtx = getCurrentContext();

  let endpoint = 'unknown';
  let method = 'UNKNOWN';
  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  try {
    const req = context.switchToHttp().getRequest();
    if (req) {
      endpoint = req.url ?? req.originalUrl ?? endpoint;
      method = (req.method ?? method).toUpperCase();
      ipAddress = extractIpAddress(req);
      userAgent = req.headers?.['user-agent'];
    }
  } catch {
    // Non-HTTP context (WS/GraphQL/MCP); endpoint/method remain unknown
    try {
      const wsData = context.switchToWs?.()?.getData?.();
      if (wsData?.event) endpoint = `ws:${wsData.event}`;
      method = 'WS';
    } catch {
      // ignore
    }
  }

  return {
    userId: tenantCtx?.userId,
    userRole: tenantCtx?.userRole as AuthRole | undefined,
    tenantId: tenantCtx?.tenantId,
    requestId: tenantCtx?.requestId,
    endpoint,
    method,
    ipAddress,
    userAgent,
  };
}

function extractIpAddress(req: any): string | undefined {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0];
  }
  return req.ip ?? req.connection?.remoteAddress ?? req.socket?.remoteAddress;
}
```

### 6.10 `permission-cache-key.ts` (~60 lignes)

```typescript
// repo/apps/api/src/common/guards/permission-cache-key.ts
/**
 * @file Deterministic cache key construction for permission lookups.
 * @module @insurtech/auth/guards
 *
 * Used by RbacService cache layer (Sprint 12) AND for audit log correlation.
 * Keys are stable: same role+perms+logic always produce the same key.
 */

import type { AuthRole } from '@insurtech/auth/rbac/roles';
import type { PermissionValue } from '@insurtech/auth/rbac/permissions';
import type { PermissionsLogic } from '../decorators/require-permission.decorator';

const KEY_VERSION = 'v1';

/**
 * Build a deterministic cache key for a permission check.
 * Permissions are sorted to ensure stability across decorator argument ordering.
 */
export function buildPermissionCacheKey(
  role: AuthRole,
  permissions: ReadonlyArray<PermissionValue>,
  logic: PermissionsLogic,
): string {
  const sorted = [...permissions].sort();
  return `permguard:${KEY_VERSION}:${role}:${logic}:${sorted.join('|')}`;
}

/** Parse a cache key back into its components (for diagnostics / audit). */
export function parsePermissionCacheKey(key: string): {
  role: AuthRole;
  logic: PermissionsLogic;
  permissions: PermissionValue[];
} | null {
  const match = key.match(/^permguard:v1:([^:]+):(AND|OR):(.+)$/);
  if (!match) return null;
  return {
    role: match[1] as AuthRole,
    logic: match[2] as PermissionsLogic,
    permissions: match[3].split('|') as PermissionValue[],
  };
}
```

### 6.11 `index.ts` barrel update

```typescript
// repo/apps/api/src/common/guards/index.ts
export * from './role.guard';
export * from './role-guard.module';
export * from './role-guard-error.types';
export * from './role-guard-context-resolver';
export * from './role-guard-fixtures';

// Tache 2.3.5 additions:
export * from './permission.guard';
export * from './permission-guard.module';
export * from './permission-guard-error.types';
export * from './permission-guard-context-resolver';
export * from './permission-guard-fixtures';
export * from './permission-decorator-helpers';
export * from './permission-cache-key';

// repo/apps/api/src/common/decorators/index.ts
export * from './role.decorator';
export * from './min-role.decorator';
export * from './any-role.decorator';
export * from './require-permission.decorator'; // Tache 2.3.5
```

---

## 7. Tests complets (recapitulatif)

Total : 30+ tests Vitest dans `permission.guard.spec.ts` + 12+ tests dans `require-permission.decorator.spec.ts` = 42+ tests.

Categories couvertes :
- **Granted scenarios** : V1 (single perm), V4 (OR truthy), V6 (AND truthy), V8 (default AND), V9-V10 (super_admin bypass AND/OR), V18 (no metadata), V21 (RBAC_LOG_GRANTED debug), V23 (OR single), V24 (AND 5 perms), V27 (class inheritance).
- **Denied scenarios** : V2 (single perm denied), V3 (response shape PERMISSION_DENIED), V5 (OR all denied), V7 (AND one denied), V11 (audit log called), V13 (audit failure isolated), V20 (RBAC_SERVICE_ERROR fail-closed), V25 (OR 5 denied), V31 (non-HTTP fallback).
- **Edge cases** : V12 (no audit on granted), V14 (missing RbacAuditService), V15-V16 (decorator precedence class vs method), V17 (NO_USER_CONTEXT), V19 (empty array pass-through), V22 (DEFAULT_DENY mode), V26 (audit payload completeness IP/UA), V28 (audit async modes).
- **Cache key** : V29 (deterministic), V30 (OR vs AND distinct).
- **Decorator metadata** : M1-M12 (single posting, namespace keys, validation throw, class-level, error structure).

Commande execution :
```bash
pnpm --filter @insurtech/api test src/common/guards/permission.guard.spec.ts
pnpm --filter @insurtech/api test src/common/decorators/require-permission.decorator.spec.ts
```

Coverage cible :
- Statements : >= 95%
- Branches : >= 90%
- Functions : 100%
- Lines : >= 95%

---

## 8. Variables environnement

```bash
# .env.example additions for Tache 2.3.5

# PermissionGuard configuration
# ------------------------------

# Emit debug log for granted permission checks (verbose, dev-only).
# Production should keep this false to avoid log saturation (~10000 req/s scenarios).
RBAC_LOG_GRANTED=false

# Audit denial events: await audit log emission before throwing 403.
# true (default) = guarantee audit persistence (Loi 09-08 compliance, slight latency +5-10ms).
# false = fire-and-forget mode (NOT recommended prod, possible audit loss on app crash).
RBAC_AUDIT_ASYNC=true

# Default-deny mode: reject endpoints missing @RequirePermission decorator.
# false (default) = opt-in mode (endpoints without decorator pass through).
# true = enforce explicit decoration (recommended prod after Sprint 8 controllers stabilized).
PERMISSION_GUARD_DEFAULT_DENY=false

# Granted log sampling rate (0.0 to 1.0). Used when RBAC_LOG_GRANTED=true.
# 0.0 = no sampling (default), 1.0 = log every granted, 0.01 = 1% sample.
RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE=0.0
```

---

## 9. Commandes shell

```bash
# Type-check
pnpm --filter @insurtech/api typecheck

# Lint
pnpm --filter @insurtech/api lint src/common/guards/permission.guard.ts
pnpm --filter @insurtech/api lint src/common/decorators/require-permission.decorator.ts

# Unit tests
pnpm --filter @insurtech/api test src/common/guards/permission.guard.spec.ts
pnpm --filter @insurtech/api test src/common/decorators/require-permission.decorator.spec.ts

# Coverage
pnpm --filter @insurtech/api test:coverage src/common/guards/permission.guard.spec.ts \
  --coverage.thresholds.statements=95 \
  --coverage.thresholds.branches=90 \
  --coverage.thresholds.functions=100 \
  --coverage.thresholds.lines=95

# Build verification
pnpm --filter @insurtech/api build

# Integration test (chain JwtAuth + TenantContext + PermissionGuard)
pnpm --filter @insurtech/api test:e2e test/permission-guard-chain.e2e-spec.ts

# Decorator inspection (CLI tool for audit)
pnpm --filter @insurtech/api inspect:permissions --controller ContactsController
```

---

## 10. Criteres validation V1-V31

| ID | Priorite | Description | Commande verification |
|----|----------|-------------|------------------------|
| V1 | P0 | @RequirePermission accept si role a permission | `pnpm test -- -t "V1: accepts when role has permission"` |
| V2 | P0 | @RequirePermission reject 403 si role n'a pas | `pnpm test -- -t "V2: rejects with 403"` |
| V3 | P0 | Response 403 includes code PERMISSION_DENIED + permissions + role | `pnpm test -- -t "V3: response includes"` |
| V4 | P0 | @RequireAnyPermission OR truthy si au moins une | `pnpm test -- -t "V4: OR truthy"` |
| V5 | P0 | @RequireAnyPermission OR reject si toutes deny | `pnpm test -- -t "V5: OR rejects"` |
| V6 | P0 | @RequireAllPermissions AND truthy si toutes | `pnpm test -- -t "V6: AND truthy"` |
| V7 | P0 | @RequireAllPermissions AND reject si une manque | `pnpm test -- -t "V7: AND rejects"` |
| V8 | P0 | Default logic AND si pas de PERMISSIONS_LOGIC_KEY | `pnpm test -- -t "V8: missing PERMISSIONS_LOGIC_KEY"` |
| V9 | P0 | super_admin bypass via canAccessAll | `pnpm test -- -t "V9: super_admin bypass propagates through canAccessAll"` |
| V10 | P0 | super_admin bypass via canAccessAny | `pnpm test -- -t "V10: super_admin bypass propagates through canAccessAny"` |
| V11 | P0 | Audit log called on denied avec champs complets | `pnpm test -- -t "V11: audit log called on denied"` |
| V12 | P1 | No audit on granted (default config) | `pnpm test -- -t "V12: no audit on granted"` |
| V13 | P0 | Audit failure does NOT mask 403 | `pnpm test -- -t "V13: audit failure does NOT mask"` |
| V14 | P1 | Missing RbacAuditService warns no-crash | `pnpm test -- -t "V14: missing RbacAuditService"` |
| V15 | P0 | Method-level @RequirePermission overrides class-level | `pnpm test -- -t "V15: method-level"` |
| V16 | P0 | Class-level applies when no method decorator | `pnpm test -- -t "V16: class-level applies"` |
| V17 | P0 | Reject NO_USER_CONTEXT si userRole undefined | `pnpm test -- -t "V17: rejects with NO_USER_CONTEXT"` |
| V18 | P0 | No decorator -> guard return true (opt-in mode) | `pnpm test -- -t "V18: no decorator"` |
| V19 | P1 | Empty array metadata -> pass-through | `pnpm test -- -t "V19: empty array"` |
| V20 | P0 | RbacService throw -> fail-closed RBAC_SERVICE_ERROR | `pnpm test -- -t "V20: RbacService throw"` |
| V21 | P2 | RBAC_LOG_GRANTED=true emits debug log | `pnpm test -- -t "V21: RBAC_LOG_GRANTED"` |
| V22 | P1 | PERMISSION_GUARD_DEFAULT_DENY=true rejects missing | `pnpm test -- -t "V22: PERMISSION_GUARD_DEFAULT_DENY"` |
| V23 | P1 | OR single permission utilise canAccessAny | `pnpm test -- -t "V23: OR with one permission"` |
| V24 | P1 | AND 5 permissions all granted -> accept | `pnpm test -- -t "V24: AND with 5 permissions"` |
| V25 | P1 | OR 5 permissions all denied -> reject | `pnpm test -- -t "V25: OR with 5 permissions all denied"` |
| V26 | P0 | Audit payload includes ipAddress + userAgent + requestId | `pnpm test -- -t "V26: audit payload includes"` |
| V27 | P1 | Parent class metadata inherited if no override | `pnpm test -- -t "V27: parent class metadata"` |
| V28 | P0 | Audit awaited by default (RBAC_AUDIT_ASYNC unset) | `pnpm test -- -t "V28: audit awaited by default"` |
| V29 | P1 | Cache key deterministic | `pnpm test -- -t "V29: cache key deterministic"` |
| V30 | P1 | Cache key OR vs AND distinct | `pnpm test -- -t "V30: cache key differs"` |
| V31 | P2 | WS context fallback for endpoint | `pnpm test -- -t "V31: WS context"` |

Critere global P0 : `pnpm --filter @insurtech/api test src/common/guards/permission.guard.spec.ts` retourne exit 0 avec coverage >= 95%.

---

## 11. Edge cases (12+ documentes)

### EC1 : Permission revocation in flight (cache stale)

**Scenario** : super_admin revoque la permission `crm.contacts.create` au role broker_user via endpoint admin `/admin/rbac/grant` (Sprint 7 Tache 2.3.11). Une requete broker_user POST `/crm/contacts` arrive 1 seconde plus tard avec JWT non-expire. Le `RbacService.canAccessAll('broker_user', ['crm.contacts.create'])` consulte cache Redis (TTL 5min) qui contient encore l'ancienne permission -> retourne true. Le PermissionGuard accept. La requete arrive en DB ou RLS Postgres bloque (matrice DB modifiee).

**Mitigation** : Sprint 12 introduit `rbac:matrix:invalidate` Redis pubsub channel. Le `RbacService` souscrit et flush cache sur receipt. Latence invalidation typique < 100ms. Defense-in-depth : RLS Postgres applique la verification au niveau donnees. Test E2E Sprint 12 verifie scenario invalidation.

**Comportement Tache 2.3.5** : aucun changement requis dans PermissionGuard. La race est out-of-scope (responsabilite RbacService cache layer + RLS Postgres).

### EC2 : Default deny (whitelist explicite)

**Scenario** : nouvelle equipe dev contribue Sprint 18 et oublie de poser `@RequirePermission` sur un endpoint sensible `/api/v1/insure/policies/transfer`. Sans default-deny, l'endpoint est accessible a tous (tout role passe -- regression catastrophique).

**Mitigation** : env var `PERMISSION_GUARD_DEFAULT_DENY=true` en prod (post-Sprint 8). Tout endpoint sans decorator throw `MISSING_DECORATOR`. Endpoints publics doivent utiliser `@Public()` decorator (Sprint 6).

**Comportement Tache 2.3.5** : implemente flag env var, defaut false en dev (productivity), recommendation prod true documentee.

### EC3 : Race condition role assignment + concurrent requests

**Scenario** : un user a 3 requetes concurrentes (reqA, reqB, reqC). Pendant reqB, admin revoque le role broker_user au user et lui assigne broker_assistant. reqA, reqB, reqC ont chacune un JWT cache different (snapshot au moment de l'authentification). reqA passe avec broker_user, reqB passe encore avec broker_user (cache JWT), reqC pourrait passer avec broker_user si JWT renew avant. Race window jusqu'a TTL JWT 15min.

**Mitigation** : Sprint 12 broadcast revocation force JWT rotation. Sprint 6 JwtAuthGuard supporte `revoked_at` claim pour invalidation immediate via Redis. Le PermissionGuard ne fait rien specialement -- delegue a RbacService qui consulte cache invalide.

**Comportement Tache 2.3.5** : aucun changement.

### EC4 : super_admin emergency lockout

**Scenario** : super_admin se fait revoquer accidentellement son propre role super_admin_platform (bug admin endpoint). Plus aucun super_admin disponible sur tenant Skalean -- lockout.

**Mitigation** : endpoint `/admin/rbac/revoke` (Sprint 7 Tache 2.3.11) implements safeguard "ne peut pas revoquer le dernier super_admin" + lock mecanisme break-glass via fichier cle racine serveur (Sprint 33 ops).

**Comportement Tache 2.3.5** : aucun changement (PermissionGuard est passif).

### EC5 : Missing TenantContext

**Scenario** : RoleGuard ou PermissionGuard est invoque sans TenantContextGuard upstream. `getCurrentContext()` retourne undefined. PermissionGuard throw NO_USER_CONTEXT 403.

**Mitigation** : V17 verifie comportement explicite. JSDoc PermissionGuard documente ordre requis. `OnApplicationBootstrap` peut detecter ordre incorrect via reflection sur APP_GUARD registrations (best-effort).

**Comportement Tache 2.3.5** : implemente check + erreur explicite NO_USER_CONTEXT avec diagnostic message.

### EC6 : Decorator stacking class+method override

**Scenario** : `@Controller @RequireAnyPermission('p1', 'p2') class C { @Get @RequirePermission('p3') method() {} }`. method execute. Le guard utilise `getAllAndOverride` -> permissions = ['p3'], logic = AND (override class). p1, p2 ignorees.

**Mitigation** : V15 verifie. JSDoc explicit comportement. Pattern recommande : si dev veut union, utiliser `@RequireAllPermissions('p1', 'p2', 'p3')` explicite.

**Comportement Tache 2.3.5** : utilise STRICTEMENT getAllAndOverride. Pas de merge.

### EC7 : Async audit log failure

**Scenario** : `RbacAuditService.logAccessDenied` throw (DB Postgres unavailable, Sentry rate-limit). Guard ne doit pas masquer 403 originale au client.

**Mitigation** : try/catch interne isolation. Log error console + Sentry reporting. 403 propage normalement. V13 verifie.

**Comportement Tache 2.3.5** : implemente isolation try/catch.

### EC8 : ForbiddenException serialization

**Scenario** : Sprint 4 HttpExceptionFilter custom transforme exception. Si filter mal code, perd les details `permissions`, `logic`, `role`.

**Mitigation** : Sprint 4 filter preserve `getResponse()` integral. V3 + V11 verifient shape complet. JSDoc PermissionGuard documente envelope format.

**Comportement Tache 2.3.5** : implemente envelope `{ error: { code, permissions, logic, role, endpoint, method, timestamp, requestId } }`.

### EC9 : OR with empty array

**Scenario** : `@RequireAnyPermission()` (variadic vide). Decorator validation Zod `.min(1)` -> throw `RequirePermissionDecoratorError('INVALID_PERMISSIONS')` au load. Module crash boot.

**Mitigation** : implemente validation Zod stricte. M6 verifie throw.

**Comportement Tache 2.3.5** : implemente.

### EC10 : AND with empty array

**Scenario** : meme que EC9 pour `@RequireAllPermissions()`. Throw au load.

**Mitigation** : meme. M9 verifie.

**Comportement Tache 2.3.5** : implemente.

### EC11 : Permission name typo

**Scenario** : dev fait `@RequirePermission('crm.contats.create')` (typo `contats` au lieu de `contacts`). Zod valide vs PermissionValueSchema (catalog Tache 2.3.1). Throw au load.

**Mitigation** : Zod schema enum strict. Throw RequirePermissionDecoratorError('INVALID_PERMISSIONS'). M3 verifie.

**Comportement Tache 2.3.5** : implemente validation Zod systematique.

### EC12 : Concurrent guards modifying request

**Scenario** : RoleGuard + PermissionGuard executent sur meme request. RoleGuard throw 403 ROLE_REQUIRED -> chain stoppe -> PermissionGuard jamais execute -> pas d'audit permission denial. Comportement correct (pas besoin d'audit double si role rejette deja).

**Mitigation** : aucune. Comportement par design. RoleGuard a son propre audit.

**Comportement Tache 2.3.5** : aucun changement.

---

## 12. Conformite Maroc detaillee

### 12.1 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

**Reglementation** : Circulaire ACAPS 2018/01 sur la gouvernance et le controle interne des entreprises d'assurance et de reassurance. Article 7 exige separation des duties Maker/Checker pour operations critiques (souscription, validation polices, declaration sinistres > 50000 MAD).

**Application Tache 2.3.5** : permissions sensibles ACAPS doivent etre annotees `@RequireAllPermissions('insure.policies.create', 'insure.policies.validate')` pour exiger DEUX permissions distinctes -- le createur (broker_user) et le validateur (broker_admin) ne peuvent pas etre la meme personne. Le PermissionGuard valide presence des deux permissions. Sprint 14 (Insure) ajoute logique additionnelle ABAC verifiant que `policy.created_by !== current_user_id` pour validations.

**Audit log** : toutes les denials d'autorisation ACAPS-sensitive sont loggees avec `denialReason: 'PERMISSION_NOT_GRANTED'` et `permissions` complet. Sprint 12 audit pipeline export CSV mensuel pour ACAPS si requete.

### 12.2 AMC / AMLA (Autorite Marocaine de la Concurrence / Anti-Money Laundering Act)

**Reglementation** : Loi 12-18 anti-blanchiment (AML/CFT). Article 18 exige separation stricte entre operateurs et compliance officers. Actions AML (`compliance.aml_alerts.review`, `compliance.aml_alerts.escalate`) reservees ComplianceOfficer-only.

**Application Tache 2.3.5** : decorators sur endpoints AML : `@RequirePermission('compliance.aml_alerts.review')`. Matrice (Tache 2.3.2) attribue cette permission UNIQUEMENT au role `compliance_officer` (ajoute Sprint 12). broker_admin ne peut PAS reviewer AML -- separation duties enforce. Le PermissionGuard rejette toute autre tentative.

**Audit log** : denials AML sont marques avec tag specifique dans `denialReason` consommable par dashboard AMC Sprint 12. Tracabilite complete pour audit AMC annuel.

### 12.3 CNDP (Commission Nationale de Controle de la Protection des Donnees a caractere Personnel) -- Loi 09-08

**Reglementation** : Loi 09-08 article 18 exige tracabilite complete des acces aux donnees personnelles. Tout acces (lecture, modification, suppression) doit etre logge avec `who, what, when, where, why`.

**Application Tache 2.3.5** : le PermissionGuard emet AUTOMATIQUEMENT audit log sur denial. Sprint 12 ajoute audit log sur granted aussi (interceptor separe Tache 2.3.10) pour acces a permissions PII (`crm.contacts.read`, `insure.policies.read`, `repair.sinistres.read`). Le payload audit inclut : `userId`, `tenantId`, `role`, `permissions`, `endpoint`, `method`, `ipAddress`, `userAgent`, `timestamp`, `requestId`. Conforme exigences article 18.

**Retention** : 5 ans (decision-009 conformite Loi 09-08 + Code Commerce art. 19). Sprint 24 archive vieux logs vers cold storage.

**Right to be forgotten** : Sprint 24 `compliance.cndp_purge.execute` permet purge user demande. Audit log conserve `userId_hash` (sha256) au lieu de userId clair pour residual tracabilite.

### 12.4 BAM (Bank Al-Maghrib) -- separation autorisations operations financieres

**Reglementation** : Circulaire BAM 6/W/2017 sur le controle interne des etablissements de credit. Article 12 exige separation stricte entre initiateur et autoriseur des operations financieres > seuil reglementaire (typique 100000 MAD).

**Application Tache 2.3.5** : pour operations financieres `pay.refunds.create` (refund > seuil), endpoint annote `@RequireAllPermissions('pay.refunds.create', 'pay.refunds.approve')` -- exige initiateur ET approbateur distincts. ABAC overlay Sprint 8 verifie initiator !== approver. Sprint 13 (Pay) implemente workflow Maker/Checker complet. Le PermissionGuard fait premiere couche permission-based ; ABAC complete couche identity-based.

**Audit log** : denials sur endpoints pay.* sont loggees + flagged BAM-sensitive pour reporting trimestriel BAM (Sprint 12 dashboard).

---

## 13. Conventions absolues skalean-insurtech

1. **AUCUNE EMOJI** dans le code, commentaires, logs, documentation, commit messages.
2. **TypeScript strict** : `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`.
3. **Zod validation** : tout input runtime (decorator arguments, config env, request body) valide via Zod. Pas de `as any` cast pour bypass.
4. **Pas de `console.log`** : utiliser Pino logger via NestJS Logger DI.
5. **Tests Vitest** : pas de Jest. Convention `describe / it / expect`. Coverage cible >= 95%.
6. **NestJS conventions** : decorators PascalCase fonction-style (`@RequirePermission`), guards classes en suffix `Guard`, modules en suffix `Module`, services en suffix `Service`.
7. **File naming** : kebab-case (`require-permission.decorator.ts`, `permission.guard.ts`, `permission-guard.module.ts`).
8. **Imports** : utiliser path aliases `@insurtech/auth/...` configures dans `tsconfig.json` paths.
9. **Async/await** : preferer await sur Promise chains. Pas de `.then().catch()` chains. Try/catch explicit.
10. **Error handling** : custom error classes etendant Error native avec proprietes structurees (`code`, `details`). ForbiddenException pour 403 NestJS.
11. **Logging structured** : Pino avec champs cles uniformes `{ event, role, userId, tenantId, requestId, endpoint, method, ... }`.
12. **No magic strings** : metadata keys, error codes, env var names dans constantes typees `as const`.
13. **JSDoc** : public APIs (decorators, guards, services exports) doivent avoir JSDoc avec usage examples.
14. **Reflect-metadata** : import explicit `import 'reflect-metadata';` au top de fichiers utilisant decorators (faux positif TS sinon).
15. **Tests fixtures** : helpers reutilisables dans `*-fixtures.ts` files. Pas de duplication setup entre tests.
16. **Sprint isolation** : tache 2.3.5 ne modifie PAS code Sprint 6 (TenantContext). Si bug detecte, ouvrir issue separee.
17. **Conformite Maroc** : tout audit log persiste avec champs Loi 09-08 article 18. Pas d'omission.

---

## 14. Validation pre-commit

Hook git pre-commit (Husky + lint-staged Sprint 1) execute :

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 1. Type-check (fast)
pnpm --filter @insurtech/api typecheck || {
  echo "[pre-commit] typecheck FAILED. Fix TS errors before commit."
  exit 1
}

# 2. Lint changed files
pnpm exec lint-staged || {
  echo "[pre-commit] lint FAILED."
  exit 1
}

# 3. Run permission guard tests if related files changed
CHANGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '(permission\.guard|require-permission)' || true)
if [ -n "$CHANGED" ]; then
  pnpm --filter @insurtech/api test src/common/guards/permission.guard.spec.ts || {
    echo "[pre-commit] permission.guard tests FAILED."
    exit 1
  }
  pnpm --filter @insurtech/api test src/common/decorators/require-permission.decorator.spec.ts || {
    echo "[pre-commit] require-permission.decorator tests FAILED."
    exit 1
  }
fi

# 4. Verify no emoji in changed files
EMOJI_FOUND=$(git diff --cached --diff-filter=ACM | grep -P '[\x{1F300}-\x{1F9FF}\x{2600}-\x{27BF}]' || true)
if [ -n "$EMOJI_FOUND" ]; then
  echo "[pre-commit] EMOJI detected in staged changes. Forbidden by skalean convention."
  exit 1
fi

# 5. Verify decorator metadata keys are namespace-prefixed
PROBLEM_KEYS=$(git diff --cached -- 'src/common/decorators/*.ts' 'src/common/guards/*.ts' | grep -E "^\+.*SetMetadata\('[^@]" || true)
if [ -n "$PROBLEM_KEYS" ]; then
  echo "[pre-commit] WARNING: Non-namespaced metadata keys detected. Use '@insurtech/auth:...' prefix."
fi

echo "[pre-commit] ALL CHECKS PASSED."
```

---

## 15. Commit message complet

```
feat(rbac): add PermissionGuard + @RequirePermission decorator family (Tache 2.3.5)

Sprint 7 Phase 2 / P0 / 5h
Depends on Tache 2.3.4 (RoleGuard pattern), 2.3.3 (RbacService), 2.3.2 (Hierarchy), 2.3.1 (Catalog), Sprint 6 (TenantContext).
Blocks Tache 2.3.6 (ScopeGuard), 2.3.7 (AbacService), 2.3.8 (AbacResourceGuard), 2.3.9 (AuditTrail), 2.3.10 (RbacAudit), 2.3.11 (admin endpoints), 2.3.12 (E2E coverage), all metier controllers Sprint 8+.

What:
- Decorators: @RequirePermission(perm), @RequireAnyPermission(...perms) OR, @RequireAllPermissions(...perms) AND.
- Guard PermissionGuard reads metadata via Reflector.getAllAndOverride (handler over class precedence).
- Delegates decision to RbacService.canAccessAll / canAccessAny (super_admin bypass handled internally by service).
- Emits automatic audit log on denial via RbacAuditService.logAccessDenied (ACAPS / AMC / CNDP / BAM compliance).
- Throws ForbiddenException with structured details: code (PERMISSION_DENIED | NO_USER_CONTEXT | MISSING_DECORATOR | RBAC_SERVICE_ERROR), permissions, logic, role, endpoint, method, timestamp, requestId.
- Compatibility: requires guard chain order JwtAuthGuard -> TenantContextGuard -> PermissionGuard.
- Env vars: RBAC_LOG_GRANTED (default false), RBAC_AUDIT_ASYNC (default true), PERMISSION_GUARD_DEFAULT_DENY (default false).

Files added:
- repo/apps/api/src/common/decorators/require-permission.decorator.ts (~80 lines, 3 decorators with Zod validation + applyDecorators composition)
- repo/apps/api/src/common/decorators/require-permission.decorator.spec.ts (~150 lines, 12+ metadata tests)
- repo/apps/api/src/common/guards/permission.guard.ts (~220 lines, full implementation with audit isolation)
- repo/apps/api/src/common/guards/permission.guard.spec.ts (~350 lines, 30+ tests covering granted/denied/OR/AND/super_admin/audit/edge cases)
- repo/apps/api/src/common/guards/permission-guard.module.ts (~60 lines, NestJS module + forGlobal helper)
- repo/apps/api/src/common/guards/permission-decorator-helpers.ts (~80 lines, metadata extraction helpers + inspectControllerPermissions for OpenAPI)
- repo/apps/api/src/common/guards/permission-guard-error.types.ts (~80 lines, ForbiddenException response shape + PermissionGuardErrorCode enum)
- repo/apps/api/src/common/guards/permission-guard-fixtures.ts (~100 lines, ExecutionContext + RbacService + RbacAuditService mocks)
- repo/apps/api/src/common/guards/permission-guard-context-resolver.ts (~80 lines, transport-agnostic context extraction HTTP/WS/GraphQL)
- repo/apps/api/src/common/guards/permission-cache-key.ts (~60 lines, deterministic cache key + parser)

Files modified:
- repo/apps/api/src/common/guards/index.ts (barrel exports)
- repo/apps/api/src/common/decorators/index.ts (barrel exports)
- repo/apps/api/src/app.module.ts (import PermissionGuardModule)
- repo/.env.example (3 new env vars documented)

Tests:
- 30+ tests in permission.guard.spec.ts (V1-V31 coverage matrix)
- 12+ tests in require-permission.decorator.spec.ts (M1-M12)
- Coverage: statements >=95%, branches >=90%, functions 100%, lines >=95%
- Command: pnpm --filter @insurtech/api test src/common/guards/permission.guard.spec.ts

Compliance:
- ACAPS Circulaire 2018/01 art. 7: Maker/Checker separation enforced via @RequireAllPermissions composite
- AMC / Loi 12-18 art. 18: ComplianceOfficer-only AML actions enforced via permission attribution matrix
- CNDP Loi 09-08 art. 18: automatic audit log on denial with full trail (userId, tenantId, role, permissions, endpoint, ipAddress, userAgent, timestamp, requestId)
- BAM Circulaire 6/W/2017 art. 12: separation operations financieres via @RequireAllPermissions + ABAC overlay (initiator !== approver)

Refs: 00-pilotage/meta-prompts/B-07-sprint-07-rbac.md (Tache 2.3.5 lignes 602-734)
Refs: 00-pilotage/decisions/020-role-vs-permission-decorator.md
Refs: 00-pilotage/documentation/5-roles-permissions.md
```

---

## 16. Workflow next step

Apres validation Tache 2.3.5 :

1. **Run full test suite** : `pnpm --filter @insurtech/api test` doit passer (regression check).
2. **Coverage report** : `pnpm --filter @insurtech/api test:coverage` >= 95% statements pour fichiers tache 2.3.5.
3. **Lint + typecheck** : zero erreur.
4. **Pre-commit hook** : execute automatique, doit passer.
5. **Commit** : utiliser message Section 15.
6. **Push branche** : `git push origin feat/sprint-7-tache-2.3.5-permission-guard`.
7. **PR review** : assignee tech lead RBAC + security officer (Loi 09-08 reviewer obligatoire).
8. **CI pipeline** : GitHub Actions execute typecheck + lint + tests + coverage + audit-deps + license-check.
9. **Merge** : squash-merge sur `main` apres 2 approvals dont 1 security.
10. **Tag** : pas de tag pour tache intermediate (tag uniquement sur sprint completion).

Tache suivante : **Tache 2.3.6 -- Types ABAC + Interfaces** (`task-2.3.6-types-abac-interfaces.md`)
- But : definir interfaces TypeScript ABAC (`AbacContext`, `AbacPolicy`, `AbacResult`, types resources).
- Depend de Tache 2.3.5 (PermissionGuard livre, pattern decorator + guard etabli).
- Bloque Tache 2.3.7 (AbacService implementation), 2.3.8 (AbacResourceGuard).
- Effort 3h.
- Livrables : `repo/packages/auth/src/abac/types.ts`, interfaces AbacContext / AbacPolicy / AbacResult, resource type registry.

Apres Tache 2.3.6, sequence Sprint 7 continue : 2.3.7 AbacService -> 2.3.8 AbacResourceGuard -> 2.3.9 AuditTrailService Loi 09-08 -> 2.3.10 RbacAuditService persistence -> 2.3.11 admin RBAC endpoints -> 2.3.12 E2E coverage 12 roles -> Sprint 7 done.

---

## 17. Annexes

### 17.1 Glossaire

- **PermissionValue** : type union TypeScript des 85+ permissions atomiques du catalog (Tache 2.3.1). Format `<module>.<resource>.<action>` (ex `crm.contacts.create`).
- **AuthRole** : type union TypeScript des 12 roles utilisateurs (Tache 2.3.1). Format snake_case (ex `broker_admin`, `garage_technicien`).
- **PermissionsLogic** : `'AND' | 'OR'`. Determine si toutes les permissions ou au moins une doivent etre satisfaites.
- **TenantContext** : objet propage via cls-hooked AsyncLocalStorage Sprint 6 contenant `{ userId, userRole, tenantId, originalUserRole?, traceId, requestId, ... }`.
- **RbacService** : service injectable Tache 2.3.3 expose `canAccess(role, perm)`, `canAccessAll(role, perms)`, `canAccessAny(role, perms)`.
- **RbacAuditService** : service injectable Tache 2.3.10 expose `logAccessDenied(payload)`, `logAccessGranted(payload)`. Persiste DB `rbac_audit_log` + emit Pino structured.
- **Reflector** : NestJS core class pour lecture de metadata Reflect. Methodes `get`, `getAll`, `getAllAndOverride`, `getAllAndMerge`.
- **applyDecorators** : NestJS helper pour composer plusieurs decorators en un seul. Garantit atomicite.
- **APP_GUARD** : symbol NestJS pour enregistrer un guard globalement via providers.

### 17.2 References externes

- NestJS Guards documentation : https://docs.nestjs.com/guards
- NestJS Custom Decorators : https://docs.nestjs.com/custom-decorators
- Reflect Metadata API : https://github.com/rbuckton/reflect-metadata
- Zod schema validation : https://zod.dev/
- Pino structured logging : https://getpino.io/
- Loi 09-08 CNDP : https://www.cndp.ma/fr/textes-juridiques/loi-09-08
- ACAPS Circulaire 2018/01 : https://www.acaps.ma/sites/default/files/circulaires/circulaire_acaps_2018_01.pdf

### 17.3 Diagramme ASCII synthese

```
+-------------------------------------------------------------+
| @RequirePermission('crm.contacts.create')                   |
|   |                                                          |
|   v                                                          |
| applyDecorators(                                             |
|   SetMetadata('@insurtech/auth:permissions', [perm]),        |
|   SetMetadata('@insurtech/auth:permissions_logic', 'AND'),   |
| )                                                            |
+-------------------------------------------------------------+
                      |
                      v
+-------------------------------------------------------------+
| Request -> [JwtAuthGuard] -> [TenantContextGuard]            |
|   -> [RoleGuard?] -> [PermissionGuard] -> [AbacResourceGuard?]|
+-------------------------------------------------------------+
                      |
                      v
+-------------------------------------------------------------+
| PermissionGuard.canActivate(context):                        |
|   1. Reflector.getAllAndOverride(PERMISSIONS_KEY, ...)       |
|   2. Reflector.getAllAndOverride(PERMISSIONS_LOGIC_KEY, ...) |
|   3. extractPermissionGuardContext(context) -> ctx           |
|   4. if !ctx.userRole -> throw NO_USER_CONTEXT 403           |
|   5. allowed = logic OR ? rbac.canAccessAny : canAccessAll   |
|   6. if allowed -> return true                                |
|   7. await rbacAudit.logAccessDenied(...)                    |
|   8. throw ForbiddenException(PERMISSION_DENIED + details)   |
+-------------------------------------------------------------+
                      |
                      v
+-------------------------------------------------------------+
| Audit DB: rbac_audit_log row inserted with full Loi 09-08    |
| trail (userId, tenantId, role, permissions, endpoint,        |
| method, ipAddress, userAgent, timestamp, requestId,          |
| denialReason).                                                |
+-------------------------------------------------------------+
                      |
                      v
+-------------------------------------------------------------+
| Response 403 JSON envelope:                                   |
| {                                                             |
|   "error": {                                                  |
|     "code": "PERMISSION_DENIED",                              |
|     "permissions": ["crm.contacts.create"],                   |
|     "logic": "AND",                                           |
|     "role": "broker_assistant",                               |
|     "endpoint": "/api/v1/crm/contacts",                       |
|     "method": "POST",                                         |
|     "timestamp": "2026-05-05T12:34:56.789Z",                  |
|     "requestId": "req_uuid"                                   |
|   }                                                           |
| }                                                             |
+-------------------------------------------------------------+
```

---

**Fin du document task-2.3.5-permission-guard-require-permission-decorators.md**

Sprint 7 Tache 2.3.5 -- Phase 2 -- P0 -- 5h -- Depend Tache 2.3.4 -- Bloque Tache 2.3.6+
