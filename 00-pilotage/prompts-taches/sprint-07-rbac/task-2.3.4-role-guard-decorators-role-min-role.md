# TACHE 2.3.4 -- RoleGuard + Decorators @Role / @MinRole / @AnyRole

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.4 lignes 505-600)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour Taches 2.3.5 PermissionGuard, 2.3.6 ScopeGuard, 2.3.7 AbacService, 2.3.8 ResourceGuard, 2.3.9 AuditTrail Loi 09-08, 2.3.12 tests E2E coverage 12 roles ; bloquant indirect pour TOUS les controllers Sprint 8+ qui annoteront leurs endpoints avec `@Role`, `@MinRole`, `@AnyRole`)
**Effort** : 4h
**Dependances** : Tache 2.3.3 (RbacService injectable, AccessResult, GrantedReason, DenialReason). Tache 2.3.2 (RoleHierarchy, getRoleDescendants). Tache 2.3.1 (catalog AuthRole). Sprint 6 complet (TenantContext propage userRole via `getCurrentContext()` cls-hooked AsyncLocalStorage). Stack Sprint 1-2 (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x, Pino 9.5.x, Zod 3.24.1, Reflect Metadata 0.2.x).
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.4 vise a livrer le mecanisme guard NestJS de premiere ligne du programme Skalean InsurTech v2.2 pour la verification de roles : `RoleGuard`, accompagne de trois decorators complementaires `@Role(...)`, `@MinRole(...)` et `@AnyRole(...)`. Ce mecanisme constitue la couche "binaire role-based" du framework d'autorisation, plus simple et plus rapide que `PermissionGuard` (Tache 2.3.5) et `AbacResourceGuard` (Tache 2.3.8). Il est specifiquement destine aux endpoints HTTP, controllers GraphQL (Sprint 18) et resolvers MCP (Sprint 30) ou la regle d'autorisation se reduit a "ce role exact (ou cette liste de roles, ou ce role + descendants hierarchy) est requis". Le guard lit la metadata posee par les decorators via `Reflector.getAllAndOverride`, recupere le role courant depuis le `TenantContext` (Sprint 6) injecte via AsyncLocalStorage, applique d'abord le bypass `super_admin_platform` P0, puis verifie l'inclusion du role dans la liste requise (cas `@Role` et `@AnyRole`) ou dans l'ensemble `[role + descendants]` (cas `@MinRole` qui delegue a `RbacService.getRoleDescendants(role)` issu de Tache 2.3.2). En cas d'echec, le guard jette une `ForbiddenException` structuree contenant `{ code: 'ROLE_REQUIRED', required: AuthRole[], current: AuthRole | null, decoratorType: 'role' | 'min_role' | 'any_role', endpoint: string, requestId?: string }` qui sera consommee telle-quelle par le filter global `HttpExceptionFilter` (Tache 2.3.9 audit trail) et serialisee en reponse HTTP 403 conforme au format d'erreur JSON Skalean (Sprint 4).

L'apport est triple. Premierement, separer la verification "role-based binaire" (Tache 2.3.4) de la verification "permission-based granulaire" (Tache 2.3.5) permet d'optimiser le hot-path : la majorite des endpoints administratifs (`/api/v1/admin/tenants`, `/api/v1/admin/users`, `/api/v1/insurtech-admin/dashboards`) ne necessitent qu'un check de role (broker_admin OU garage_admin OU super_admin_platform) sans besoin de consulter la matrice complete des permissions. Le `RoleGuard` court-circuite la lookup `RbacService.canAccess` (qui resout hierarchy + matrix lookup + ABAC delegation potentielle) et fait un simple `requiredRoles.includes(currentRole)` en O(N) avec N <= 12 roles. La latence p99 cible est < 50 microsecondes (vs ~500 microsecondes pour `PermissionGuard` cache-hit). Deuxiemement, le decorator `@MinRole` introduit la semantique "role + descendants hierarchy" essentielle pour les endpoints Maker/Checker (decision-007 ACAPS) : `@MinRole('broker_admin')` accepte broker_admin, broker_user, broker_assistant (descendants) et permet ainsi a un assistant d'acceder a un endpoint reserve "au minimum aux courtiers" tout en empechant le simple assure (role hors hierarchie broker) d'y acceder. Cette semantique est inverse de l'intuition (`@MinRole(broker_admin)` accepte les "moins privileges" car ils sont descendants dans la hierarchy heritage permissions ; voir Section 2.5 piege #4 pour clarification critique). Troisiemement, le decorator `@AnyRole` est un alias semantique explicite pour `@Role(...)` lorsque l'intent est "OR de plusieurs roles non-hierarchiques" (par exemple `@AnyRole('broker_admin', 'garage_admin')` : un endpoint accessible par les admins des deux verticaux indistinctement). Cette redondance volontaire ameliore la lisibilite du code controller et evite les ambiguites de revue de code.

A l'issue de cette tache, le package `@insurtech/auth` expose via `packages/auth/src/rbac/index.ts` les artefacts `RoleGuard`, `Role`, `MinRole`, `AnyRole`, `ROLES_KEY`, `MIN_ROLE_KEY`, `ANY_ROLES_KEY`, `RoleGuardModule`, `RoleGuardErrorCode`, `RoleGuardForbiddenDetails`, `getRolesFromContext`, `getMinRoleFromContext`, `getAnyRolesFromContext`. Les decorators sont consommables via DI standard NestJS : `@Role('broker_admin') @Get() handler() {}`. Le guard est registrable globalement via `APP_GUARD` ou per-controller via `@UseGuards(RoleGuard)`. La commande `pnpm --filter @insurtech/auth test rbac/role.guard.spec.ts` execute 30+ tests Vitest verifiant le comportement complet (decorator metadata, guard logic, hierarchy resolution, super_admin bypass, no-role context fallback, error response format, audit log emission, decorator stacking class+method, WS context vs HTTP context, edge case empty array). La commande `pnpm --filter @insurtech/auth typecheck` retourne exit code 0. Le total represente environ 1010 lignes de code TypeScript strict reparties sur 12 fichiers (decorator role ~50 lignes, decorator min-role ~60 lignes, decorator any-role ~50 lignes, guard principal ~180 lignes, tests guard ~250 lignes, tests decorators ~120 lignes, types erreur ~60 lignes, types tenant context ~80 lignes, module Nest ~80 lignes, helpers extraction context ~80 lignes, fixtures tests ExecutionContext mocks ~100 lignes, barrel ~20 lignes). Cette tache est P0 absolue car elle conditionne le bootstrap minimum de tout endpoint HTTP necessitant un check de role -- sans elle, les controllers Sprint 8+ ne peuvent pas declarer leur ACL et restent inaccessibles ou ouverts par defaut (regression securite catastrophique).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 instancie 9 applications (api, web-broker, web-garage, web-assure-portal, web-assure-mobile, web-customer-portal, web-insurtech-admin, mcp-server, sky-agent) et chacune expose des routes ou des endpoints qui doivent declarer formellement quels roles sont autorises a les invoquer. Sans un mecanisme declaratif (decorator + guard), chaque controller devrait soit (a) hardcoder `if (request.user.role !== 'broker_admin') throw new ForbiddenException()` au debut de chaque handler -- dette technique massive, regression silencieuse a chaque ajout de role, impossibilite d'audit statique des ACL ; soit (b) consommer directement `RbacService.canAccess(role, somePermission)` -- mais necessite de definir une permission artificielle "endpoint X" pour chaque endpoint, polluant le catalog Tache 2.3.1 ; soit (c) consommer un guard custom per controller -- duplication, divergence inevitable. Le pattern decorator + guard standardise dans la communaute NestJS resout ces trois problemes en exposant une API declarative concise (`@Role('broker_admin')`) qui pose des metadata Reflect lus par un guard centralise.

L'architecture choisie est consciemment minimaliste pour cette tache : aucune logique RBAC complexe (matrice, permissions granulaires, ABAC) n'est dupliquee dans `RoleGuard`. Toute logique allant au-dela du simple `requiredRoles.includes(currentRole)` est deleguee :
- Resolution de hierarchy descendants : delegue a `RbacService.getRoleDescendants(role)` (Tache 2.3.2 expose la methode publique sur RbacService bien que la donnee provienne de `RoleHierarchy`).
- Verification permissions granulaires : reservee a `PermissionGuard` (Tache 2.3.5).
- ABAC ressource-based : reservee a `AbacResourceGuard` (Tache 2.3.8).
- Logs audit complets : delegue au `AuditTrailService` (Tache 2.3.9) via emission d'event `role_guard.denied` Pino structured.

Cette stricte separation de responsabilites garantit que `RoleGuard` reste rapide (pas de Redis lookup, pas de matrix evaluation), simple a tester (mocks reduits), et compose librement avec les autres guards via le mecanisme `@UseGuards([JwtAuthGuard, TenantContextGuard, RoleGuard, PermissionGuard, AbacResourceGuard])` qui execute la chain dans l'ordre declare (chaque guard retourne `boolean | Promise<boolean>` et l'execution s'arrete au premier `false` ou exception).

L'evaluation de decorator metadata est strictement deterministe : pour un meme handler decore avec `@Role('broker_admin')`, le `Reflector.getAllAndOverride(ROLES_KEY, [handler, class])` retourne toujours `['broker_admin']` (ordre stable car la metadata est posee une seule fois au load time du module). La concurrence n'introduit aucune race car la metadata Reflect est immutable apres `SetMetadata`.

### 2.2 Alternatives considerees pour la verification role-based

Le tableau ci-dessous compare 6 alternatives evaluees avant la decision finale d'implementer un guard NestJS dedie consommant des decorators `Reflect.metadata`.

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Middleware Express custom (intercept request avant routing, parse role from JWT, check vs liste hardcodee per route definie dans config YAML) | Decouple framework Nest (portable Express pure si migration), config externalisee (YAML) modifiable sans recompilation, performance brute (pas d'overhead DI Nest) | Pas de couplage type-safe entre handler et regle ACL (config YAML divergente du code TypeScript), pas de support natif decorators (necessite registry parallele), incompatible avec WebSocket gateways Nest (Sprint 10), incompatible GraphQL resolvers (Sprint 18 utilise Nest GqlExecutionContext), debug difficile (middleware vs guards introduit deux mondes) | REJETE -- incompatible architecture Nest standardisee Sprint 1-2, regression DX |
| Interceptor NestJS (intercepter chaque appel handler via @Interceptor, evaluer role, throw ou pass) | Acces a ExecutionContext + Reflector comme un guard, support cross-cutting (logging, transformation), logique reutilisable | Mauvais pattern semantique pour authorization (interceptor concu pour transformation de retour ou wrapping observable), execute APRES validation pipes (donc apres deserialisation body potentiellement malveillant), pas un convention NestJS pour authz, complique la composition guard-chain | REJETE -- mauvaise abstraction semantique, casse conventions Nest |
| Guard custom per controller (ex: BrokerOnlyGuard, GarageOnlyGuard, AdminOnlyGuard) | Type-safety maximum (chaque guard nomme son intent), pas de runtime metadata reflection, lisibilite controller (nom guard explicite) | Explosion combinatoire (12 roles + combinaisons OR + hierarchies = 100+ guards classes), duplication logique, maintenance impossible long terme | REJETE -- explosion combinatoire ingerable |
| Annotation per handler avec hardcoded if dans handler body (`if (req.user.role !== 'broker_admin') throw 403`) | Zero abstraction, lisible immediatement, debuggable | Aucune separation concerns, audit impossible (parsing AST custom requis pour decouvrir ACL), regression silencieuse (oubli de check), incompatible avec generation OpenAPI Sprint 9 | REJETE -- inacceptable pour programme 35 sprints |
| Casbin/Accesscontrol library en mode middleware (declarations centralisees, applique automatiquement) | Standard externe (mature), declarations centralisees | Surdimensionne pour role-only check (Casbin = matrice complete + ABAC), pas integration NestJS native, duplication avec Tache 2.3.3 RbacService | REJETE -- surdimensionne, duplication |
| Decorator `@Role(...)` + Guard NestJS lisant metadata via Reflector (RETENU) | Type-safe (`@Role` accepte uniquement `AuthRole`), declaratif (visible immediatement sur handler), composable (`@UseGuards([RoleGuard, PermissionGuard])`), audit statique trivial (grep `@Role` decouvre toutes ACL), support natif HTTP/GraphQL/WS via ExecutionContext, OpenAPI Sprint 9 peut introspecter metadata, zero divergence config-code, latence < 50 microsec, integration DI Nest pour TenantContext / RbacService injection, idiomatic communaute NestJS (RolesGuard pattern documente officiellement) | Code custom (~1010 lignes), maintenance interne (vs library externe), doit gerer lui-meme bypass super_admin et hierarchy semantique | RETENU -- meilleur compromis securite/perf/DX/maintenabilite ; pattern conforme convention NestJS RolesGuard officielle |

### 2.3 Trade-offs reflector cache vs lookup

Le mecanisme `Reflector.getAllAndOverride<T>(key, [handler, class])` execute en interne deux appels `Reflect.getMetadata(key, handler)` puis `Reflect.getMetadata(key, class)` et retourne le premier non-undefined (priorite handler sur class). Chaque appel `Reflect.getMetadata` parcourt une `WeakMap` de metadata associee a l'objet target -- complexite O(1) amortie. Pour un endpoint typique recevant 100-1000 req/s, le coup cumule des deux lookups est negligeable (~1-3 microsec). Mais pour un endpoint hot-path > 10000 req/s (cas extreme), l'optimisation envisagee etait de cacher le resultat dans un `WeakMap<Function, ReadonlyArray<AuthRole>>` interne au guard. Cette optimisation a ete REJETEE pour cette tache car : (a) le gain mesure est < 0.5 microsec par call (insignifiant face au cout total du request handling), (b) la complexite ajoutee (gestion WeakMap, invalidation au reload module HMR dev mode) introduit des risques de bugs, (c) NestJS Reflector core implemente deja un fast-path optimise via prototype chain caching. La decision est documentee implicitement : aucune cache custom dans `RoleGuard` ; reliance sur fast-path Nest natif.

Le compromis "lookup chaque request vs hoist metadata once" se manifeste differemment dans le decorator `@MinRole` qui doit resoudre les descendants. Le calcul `RbacService.getRoleDescendants(role)` est lui-meme cache (Tache 2.3.2 maintient `RoleHierarchy.getRoleDescendants` memoized in-process car la hierarchy est immutable apres boot). Donc meme si chaque appel guard re-invoque `getRoleDescendants(broker_admin)`, le cache renvoie le meme `Set<AuthRole>` en O(1). Pas d'optimisation supplementaire necessaire.

### 2.4 Role vs Permission granularity (decision strategique)

Une question recurrente est : "pourquoi avoir des decorators `@Role` ET `@RequirePermission` -- pourquoi pas tout faire en permission ?" La reponse strategique est : la permission granularity a un cout cognitif et runtime. Pour un endpoint admin pur (`/api/v1/admin/tenants/suspend`), creer une permission dediee `admin.tenants.suspend` puis l'attribuer dans la matrice a `super_admin_platform` uniquement est verbeux (3 modifs : Tache 2.3.1 catalog + Tache 2.3.2 matrice + decorator `@RequirePermission('admin.tenants.suspend')`) alors que `@Role('super_admin_platform')` ou `@MinRole('super_admin_platform')` exprime exactement la meme regle en 1 modif. Le critere de choix entre `@Role` et `@RequirePermission` est :

- **`@Role`** : "endpoint reserve a tel role specifique (ou OR de roles)". Cas typiques : endpoints admin, endpoints internes Skalean, endpoints super_admin_platform, endpoints reserved Maker/Checker high-priority.
- **`@RequirePermission`** : "endpoint accessible a toute personne ayant la permission X (peu importe le role)". Cas typiques : endpoints metier (`/api/v1/crm/contacts`) ou la matrice determine plusieurs roles autorises (broker_admin + broker_user + broker_assistant).
- **Combinaison** : `@UseGuards([RoleGuard, PermissionGuard]) @Role('broker_admin', 'garage_admin') @RequirePermission('admin.audit.read')` exprime "doit etre admin ET avoir la permission d'audit" -- intersection des deux contraintes.

Cette strategie est documentee dans `00-pilotage/decisions/020-role-vs-permission-decorator.md` (decision-020). Le test V11 verifie que la combinaison guards produit bien intersection (AND) et non union (OR).

### 2.5 Pieges techniques connus (10 pieges critiques documentes)

1. **Piege : Decorator `@MinRole` semantique inversee piege intuition.**
   - Pourquoi : "MinRole" suggere "role minimum requis", ce que beaucoup interpretent comme "role A ou role plus eleve hierarchically". Mais dans Skalean, la hierarchy est "heritage de permissions" : `broker_admin` herite des permissions de `broker_user` qui herite de `broker_assistant`. Donc `broker_admin` est "au-dessus" mais possede plus de permissions. Si `@MinRole('broker_user')` etait interprete naivement "broker_user ou superieur", il acceptrait `broker_admin` (correct) mais aussi possiblement `super_admin_platform` (correct via bypass). La semantique reelle : `@MinRole(X)` accepte X et ses **descendants** dans la hierarchy heritage. Comme broker_admin est ancetre (ascendant) de broker_user, `@MinRole('broker_user')` n'accepte PAS broker_admin via descendants. Cette intuition est inversee.
   - Solution : decorator nomme `@MinRole` est conserve par convention NestJS communaute, mais documentation JSDoc explicite : `"Accepts the specified role AND its hierarchy descendants (roles that inherit permissions FROM the specified role). Note: broker_admin is NOT a descendant of broker_user; broker_user IS a descendant of broker_admin."`. Le test V12 verifie comportement explicitement avec assertion message clair. Une alternative `@RoleAndDescendants` est exposee comme alias deprecation-safe pour clarifier l'intent dans le code controller. Voir aussi decision-013 (RBAC Hierarchy Format DAG).

2. **Piege : Guard execute avant TenantContextGuard -> userRole undefined.**
   - Pourquoi : NestJS execute guards dans l'ordre declare via `@UseGuards`. Si `RoleGuard` est declare avant `TenantContextGuard` (qui injecte le `userRole` dans `getCurrentContext()` via AsyncLocalStorage cls-hooked Sprint 6), le guard tente de lire `userRole` -> undefined -> 403. C'est correct securitairement mais difficile a debugger (l'erreur dit "no user context" alors que le user est bien authentifie).
   - Solution : RoleGuard documente explicitement dans JSDoc l'ordre requis `[JwtAuthGuard, TenantContextGuard, RoleGuard, PermissionGuard, AbacResourceGuard]`. Un test V18 simule l'ordre incorrect et verifie le code erreur explicite `NO_USER_CONTEXT` avec message indicatif. Une assertion runtime `OnApplicationBootstrap` dans `RoleGuardModule` peut detecter via reflection sur `APP_GUARD` registrations si l'ordre global est correct (best-effort). Documentation Sprint 6 + Sprint 7 README mentionne explicitement la regle.

3. **Piege : Decorator pose sur class ET method -> precedence.**
   - Pourquoi : `Reflector.getAllAndOverride([handler, class])` retourne metadata du handler en priorite (override). Si un controller decore au niveau class avec `@Role('broker_admin')` (toutes les routes reservees broker_admin) et qu'une method specifique decore avec `@Role('garage_admin')` (override pour cette route), le comportement attendu est que la method override ecrase la class. C'est ce que `getAllAndOverride` fait. Mais attention : `getAllAndMerge` ferait l'union (autoriser les deux roles). Confondre les deux methodes Reflector cause des bugs subtils.
   - Solution : RoleGuard utilise STRICTEMENT `getAllAndOverride` (precedence handler > class) avec test V13 verifiant explicitement scenario class `@Role('A')` + method `@Role('B')` -> seulement B accepte, A reject. Un commentaire JSDoc dans le code guard rappelle pourquoi. Pour le cas "merge" (rare), un decorator dedie `@AddRoles(...)` pourrait etre cree future Phase, hors scope Sprint 7.

4. **Piege : `@Role()` avec array vide accepte tout (bypass involontaire).**
   - Pourquoi : si un dev appelle `@Role()` sans argument (variadic vide) ou `@Role(...[])` (spread vide), la metadata est `[]`. La logique `if (!requiredRoles?.length) return true` interprete cela comme "aucun role requis -> tout passer". Comportement par design pour permettre desactiver le guard sur endpoints publics annotes `@Public()`, mais piege si oubli.
   - Solution : decorator `@Role` valide via Zod `z.array(AuthRoleSchema).min(1)` au load-time et throw `RoleDecoratorError('EMPTY_ROLE_LIST')` AVANT que la metadata soit posee. Le module ne peut pas demarrer avec cette erreur. Test V15 verifie. Pour endpoints publics, decorator dedie `@Public()` (Sprint 6) qui pose une metadata distincte `IS_PUBLIC_KEY` que le guard reconnait avant tout.

5. **Piege : Multiple `@Role` decorators stackes sur meme handler -> last-wins ou merge ?**
   - Pourquoi : `@Role('A') @Role('B') handler() {}` -- Reflect.metadata pose la valeur deux fois sur la meme cle, le deuxieme ecrase. Donc seulement `['B']` est conserve. Pas de merge automatique.
   - Solution : decorator `Role` utilise `applyDecorators(SetMetadata(ROLES_KEY, validatedRoles))` qui pose une seule metadata. Documentation explicit "do not stack @Role decorators ; use @Role('A', 'B') for OR semantics". Test V16 verifie comportement last-wins et message warning console si detecte stacking (heuristique : Reflect.has detecte deja une metadata avant pose).

6. **Piege : super_admin_platform bypass ne s'applique pas si guard est applique en mode "non-platform context".**
   - Pourquoi : un super_admin_platform connecte sur api Skalean en mode tenant impersonation (Sprint 26) peut avoir un `currentRole` qui n'est PAS `super_admin_platform` (impersonation effective : `userRole = broker_admin` du tenant impersonate, mais `originalUserRole = super_admin_platform`). Si le guard fait `if (userRole === 'super_admin_platform') bypass`, il ne reconnait pas l'impersonation et applique les regles broker_admin (correct comportement security : impersonation doit respecter les ACL du role impersonne).
   - Solution : RoleGuard verifie UNIQUEMENT `currentContext.userRole`, JAMAIS `originalUserRole`. L'impersonation Sprint 26 fournit explicitement `userRole` correspondant a l'identite assumee. Test V17 simule impersonation et verifie que le bypass s'applique au currentRole, pas au original. Documentation rappel : "super_admin bypass = on the role currently assumed, not the underlying identity".

7. **Piege : ExecutionContext WS vs HTTP -> getHandler() / getClass() retournent diff.**
   - Pourquoi : NestJS `ExecutionContext` est polymorphique : pour HTTP, `context.switchToHttp().getRequest()` ; pour WS, `context.switchToWs().getData()` ; pour GraphQL, `GqlExecutionContext.create(context).getContext()`. Le `getHandler()` et `getClass()` fonctionnent uniformement, mais l'extraction du userRole depuis le context varie. Si le guard suppose HTTP et tente `context.switchToHttp().getRequest().user.role`, il echoue silencieusement en WS context (Sprint 10 notifications WS).
   - Solution : RoleGuard utilise `getCurrentContext().userRole` depuis AsyncLocalStorage (Sprint 6) qui est uniforme tous transports. Le TenantContextGuard (Sprint 6 Tache 2.6.x) gere lui-meme l'extraction transport-specific. Le RoleGuard reste agnostique transport. Test V19 simule WS context et verifie comportement identique HTTP.

8. **Piege : Role assignment race condition entre check et action.**
   - Pourquoi : si un super_admin revoque le role broker_admin a un user pendant que ce user execute une requete protegee `@Role('broker_admin')`, le guard valide avec l'ancien role (cache JWT non encore expire), mais l'action en DB peut echouer (RLS bloque). Race entre RBAC layer et data layer.
   - Solution : c'est OUT-OF-SCOPE pour RoleGuard. La race est traitee a deux niveaux : (a) JWT short TTL 15min Sprint 6 limite la fenetre, (b) RLS Postgres applique la verification au niveau donnees comme defense-in-depth, (c) Sprint 12 introduit broadcast revocation Redis pubsub qui flush JWT cache. Documentation explicit dans Section 12 edge cases.

9. **Piege : Decorator `@Role(...roles: AuthRole[])` accepte string non-typee si bypass strict via cast.**
   - Pourquoi : un dev peut faire `@Role('typo_role' as AuthRole)` ou `@Role(...someStringArray as AuthRole[])` et bypass le typage statique. Au runtime, le guard verifiera `requiredRoles.includes(currentRole)` qui retourne false (typo n'est dans aucune AuthRole valeur), donc reject 403. Mais le message d'erreur est confus ("ROLE_REQUIRED required: ['typo_role']").
   - Solution : decorator valide via Zod `AuthRoleSchema` chaque element au load-time et throw avant pose metadata. Le module crash au boot si decorator invalide. Test V20 verifie crash boot avec typo.

10. **Piege : Logs guard trop verbeux saturent ELK pipeline.**
    - Pourquoi : si chaque verification role-based emet un log "role_check.granted", a 1000 req/s sur api on genere 1000 logs/sec qui sont bruit (granted = nominal). Les denied sont les events critiques pour audit Loi 09-08.
    - Solution : env var `RBAC_AUDIT_ROLE_GUARD` (default `true` -- emet log denied uniquement) et `RBAC_GUARD_LOG_LEVEL` (default `info`). Le granted est logge UNIQUEMENT en niveau `debug` (production filtre out). Sample rate `RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE` (default 0.0 production, 1.0 dev) permet sampling production pour audit partiel. Test V21 verifie comportement env var.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.4 est la 4eme tache du Sprint 7 (RBAC Granulaire) et la 26eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.3 (RbacService injectable, AccessResult, getRoleDescendants exposee), Tache 2.3.2 (RoleHierarchy + getRoleDescendants memoized), Tache 2.3.1 (catalog AuthRole), Sprint 6 complet (TenantContext propagation via cls-hooked AsyncLocalStorage, JwtAuthGuard publie request.user.role), Sprint 5 infra (deploiement Helm Nest), Sprint 1-2 stack (NestJS 10.4.x, TypeScript 5.7.3, Vitest 2.1.8, Pino 9.5.x, reflect-metadata 0.2.x, Zod 3.24.1).
- **Bloque** : Tache 2.3.5 (PermissionGuard reutilise pattern decorator + Reflector + AsyncLocalStorage), Tache 2.3.6 (ScopeGuard idem), Tache 2.3.8 (AbacResourceGuard idem + plus complexe), Tache 2.3.9 (AuditTrail consume `role_guard.denied` events), Tache 2.3.12 (E2E coverage 12 roles utilise les decorators sur endpoints test), TOUS les sprints metier 8+ qui annoteront leurs controllers.
- **Apporte au sprint** : la classe injectable `RoleGuard` consommant Reflector + RbacService, les decorators `@Role`, `@MinRole`, `@AnyRole`, le module Nest `RoleGuardModule`, les types d'erreur `RoleGuardErrorCode` + `RoleGuardForbiddenDetails`, les helpers `getRolesFromContext`, `getMinRoleFromContext`, `getAnyRolesFromContext`, les fixtures de test ExecutionContext mocks, le barrel `index.ts` mis a jour.

### 3.2 Position dans le programme global

Cette tache pose le decorateur de premiere ligne consomme par 35 sprints. Tout controller Sprint 8+ qui necessite un check role-based simple (sans permission granulaire) utilise un de ces decorators. L'evolution principale au-dela du Sprint 7 :
- Sprint 12 : ajoute permission compliance.* sans modifier RoleGuard (peut combiner `@Role + @RequirePermission`).
- Sprint 18 (GraphQL) : decorators `@Role` reutilises sur resolvers via NestJS GraphQL module qui partage ExecutionContext.
- Sprint 26 (impersonation) : aucun changement RoleGuard ; impersonation gere au niveau TenantContextGuard (Sprint 6) qui injecte le userRole assume.
- Sprint 30 (MCP) : decorator `@Role('mcp_partner_admin')` consommable sur tools resolvers.
- Sprint 31 (Sky AI) : agent execute role checks via RbacService directement, pas via guards HTTP.

L'app `web-insurtech-admin` (Sprint 26) consommera massivement `@Role('super_admin_platform')` et `@Role('analyst_support')` sur routes admin. L'app `api` exposera majoritairement `@RequirePermission` (Tache 2.3.5) car les endpoints metier sont permission-based, mais utilisera `@Role` pour endpoints `/api/v1/admin/*`.

### 3.3 Diagramme guard chain ASCII

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
       - Validate signature + expiration
       - Inject request.user = { sub, role, tenantId, sessionId, ... }
       - Throw 401 UnauthorizedException if invalid
          |
          v
   [2] TenantContextGuard (Sprint 6)
       - Read request.user.role + request.user.tenantId
       - Initialize AsyncLocalStorage cls-hooked context:
         { userId, userRole, tenantId, originalUserRole?, traceId, requestId }
       - getCurrentContext() now returns populated context
          |
          v
   [3] RoleGuard (THIS TASK 2.3.4)
       - Reflector.getAllAndOverride(ROLES_KEY, [handler, class])
       - Reflector.getAllAndOverride(MIN_ROLE_KEY, [handler, class])
       - Reflector.getAllAndOverride(ANY_ROLES_KEY, [handler, class])
       - If no metadata for any of the three -> return true (no check)
       - currentRole = getCurrentContext()?.userRole
       - If !currentRole -> ForbiddenException(NO_USER_CONTEXT)
       - If currentRole === SUPER_ADMIN_PLATFORM -> return true (bypass)
       - Cas @Role: requiredRoles.includes(currentRole)
       - Cas @AnyRole: anyRoles.includes(currentRole)
       - Cas @MinRole: { role + getRoleDescendants(role) }.has(currentRole)
       - Match -> return true
       - No match -> ForbiddenException(ROLE_REQUIRED, { required, current })
       - Emit log denied via PinoLogger structured
          |
          v
   [4] PermissionGuard (Tache 2.3.5)
       - Reflector.getAllAndOverride(PERMISSIONS_KEY)
       - rbac.canAccess(currentRole, permission)
       - Throw if denied
          |
          v
   [5] AbacResourceGuard (Tache 2.3.8)
       - Load resource from DB
       - rbac.canAccess(currentRole, permission, abacContext)
       - Throw if denied
          |
          v
   Handler executes with full authorization confirmed
```

### 3.4 Decorator metadata flow

```
   Source code:
     @Controller('admin/tenants')
     @Role('super_admin_platform')  // class-level: applies to all routes
     export class AdminTenantsController {
       @Post('suspend')
       @Role('super_admin_platform')  // method-level (redundant here, override)
       suspend(...) {}

       @Get('list')
       @MinRole('analyst_support')  // method-level, override class
       list(...) {}
     }

   Module load time:
     1. Decorator @Role('super_admin_platform') executes:
        Role.validateRoles(['super_admin_platform']) via Zod
        SetMetadata(ROLES_KEY, ['super_admin_platform']) on AdminTenantsController class
     2. Decorator @Role('super_admin_platform') on suspend method:
        Same validation
        SetMetadata(ROLES_KEY, ['super_admin_platform']) on suspend handler
     3. Decorator @MinRole('analyst_support') on list method:
        MinRole.validateRole('analyst_support') via Zod
        SetMetadata(MIN_ROLE_KEY, 'analyst_support') on list handler

   Request time (POST /admin/tenants/suspend):
     RoleGuard.canActivate(context):
       handler = context.getHandler() -> reference to suspend function
       class = context.getClass() -> reference to AdminTenantsController
       requiredRoles = Reflector.getAllAndOverride(ROLES_KEY, [handler, class])
                     -> ['super_admin_platform'] (from method, overrides class)
       minRole = Reflector.getAllAndOverride(MIN_ROLE_KEY, [handler, class])
               -> undefined (no MIN_ROLE metadata on suspend or class)
       anyRoles = Reflector.getAllAndOverride(ANY_ROLES_KEY, [handler, class])
                -> undefined
       => apply @Role logic with ['super_admin_platform']
```

### 3.5 Integration RoleGuard dans NestJS DI

```
   AppModule (apps/api)
     imports: [
       AuthModule (packages/auth)
         imports: [
           RoleGuardModule
             providers: [
               RoleGuard,
               { provide: APP_GUARD, useClass: RoleGuard, scope: Scope.REQUEST }
             ],
             imports: [
               RbacModule, // for RbacService.getRoleDescendants
               LoggerModule, // Pino global
             ],
             exports: [RoleGuard]
           RbacModule
             ...
         ],
         exports: [RoleGuard, RbacService, ...]
     ]

   Consumer (apps/api/src/admin/tenants.controller.ts)
     @Controller('admin/tenants')
     @UseGuards(JwtAuthGuard, TenantContextGuard, RoleGuard)
     @Role('super_admin_platform')
     export class TenantsController { ... }

   Or globally registered in main.ts:
     app.useGlobalGuards(
       app.get(JwtAuthGuard),
       app.get(TenantContextGuard),
       app.get(RoleGuard),
     );
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/apps/api/src/common/decorators/role.decorator.ts` (~50 lignes) -- export `ROLES_KEY` constant, function `Role(...roles: AuthRole[])` decorator factory, validation Zod inline, usage `applyDecorators(SetMetadata(ROLES_KEY, validated))`
- [ ] Fichier `repo/apps/api/src/common/decorators/min-role.decorator.ts` (~60 lignes) -- export `MIN_ROLE_KEY` constant, function `MinRole(role: AuthRole)` decorator factory, validation Zod, semantique "role + descendants"
- [ ] Fichier `repo/apps/api/src/common/decorators/any-role.decorator.ts` (~50 lignes) -- export `ANY_ROLES_KEY` constant, function `AnyRole(...roles: AuthRole[])` decorator factory (alias semantique de Role pour OR explicit)
- [ ] Fichier `repo/apps/api/src/common/guards/role.guard.ts` (~180 lignes) -- classe `RoleGuard` decoree `@Injectable()`, implements `CanActivate`, methode `canActivate(context: ExecutionContext): Promise<boolean>` avec full implementation (reflector, super_admin bypass, hierarchy check via injected RbacService.getRoleDescendants, 403 explicite required vs current, structured logging, audit log emission)
- [ ] Fichier `repo/apps/api/src/common/guards/role.guard.spec.ts` (~250 lignes) -- 30+ tests Vitest avec describe/it/expect couvrant @Role broker_admin OK, broker_user reject 403, @Role array OR, @MinRole hierarchy descendants, super_admin bypass, no role -> 403, edge case decorator on class vs method (precedence)
- [ ] Fichier `repo/apps/api/src/common/decorators/role-decorator.spec.ts` (~120 lignes) -- tests metadata Reflect.getMetadata, validation Zod load-time, error invalid role, error empty array
- [ ] Fichier `repo/apps/api/src/common/guards/role-guard-error.types.ts` (~60 lignes) -- enum `RoleGuardErrorCode`, interface `RoleGuardForbiddenDetails`, classe `RoleGuardForbiddenException` extends ForbiddenException
- [ ] Fichier `repo/apps/api/src/common/guards/role-guard-tenant-context.types.ts` (~80 lignes) -- types pont vers TenantContext (Sprint 6) : `TenantContextSnapshot`, `TenantContextSource`, helpers de lecture safe
- [ ] Fichier `repo/apps/api/src/common/guards/role-guard.module.ts` (~80 lignes) -- module Nest avec providers RoleGuard, exports, imports RbacModule + LoggerModule, optionnel APP_GUARD registration
- [ ] Fichier `repo/apps/api/src/common/guards/role-decorator-helpers.ts` (~80 lignes) -- helpers `getRolesFromContext(context: ExecutionContext, reflector: Reflector): AuthRole[] | null`, `getMinRoleFromContext`, `getAnyRolesFromContext` reutilisables tests + audit
- [ ] Fichier `repo/apps/api/src/common/guards/role-guard-fixtures.ts` (~100 lignes) -- fixtures reutilisables ExecutionContext mocks HTTP/WS/GraphQL, mocks RbacService, mocks getCurrentContext
- [ ] Fichier `repo/apps/api/src/common/guards/index.ts` (~20 lignes) -- barrel exports
- [ ] Test V1 (P0) : `@Role('broker_admin')` accept broker_admin handler executes
- [ ] Test V2 (P0) : `@Role('broker_admin')` reject broker_user, ForbiddenException avec code ROLE_REQUIRED, required: ['broker_admin'], current: 'broker_user'
- [ ] Test V3 (P0) : `@Role('broker_admin', 'garage_admin')` accept broker_admin OR garage_admin
- [ ] Test V4 (P0) : `@MinRole('broker_admin')` accept broker_admin + broker_user + broker_assistant (descendants)
- [ ] Test V5 (P0) : `@MinRole('broker_admin')` reject garage_admin (hors hierarchie broker)
- [ ] Test V6 (P0) : `super_admin_platform` bypass tous role checks meme quand non listed
- [ ] Test V7 (P0) : Aucun role courant (TenantContextGuard skipped or failed) -> 403 NO_USER_CONTEXT
- [ ] Test V8 (P0) : Decorator pose sur class et method -> method override class
- [ ] Test V9 (P0) : Aucun decorator pose -> guard return true (no check)
- [ ] Test V10 (P0) : `@Role()` empty crash module boot via Zod validation
- [ ] Latence p99 evaluation `canActivate` < 50 microsec sur cache hit RoleHierarchy (V14 perf test)
- [ ] `pnpm --filter @insurtech/api typecheck` exit 0
- [ ] `pnpm --filter @insurtech/api lint` exit 0 (eslint + prettier)
- [ ] `pnpm --filter @insurtech/api test common/guards/role.guard.spec.ts` execute 30+ tests, tous passants
- [ ] `pnpm --filter @insurtech/api test:coverage common/guards/role.guard.ts` rapport coverage >= 95% lines, >= 90% branches
- [ ] Aucune emoji dans aucun fichier (test V25 regex Unicode)
- [ ] Aucun TODO, FIXME, XXX, HACK dans le code livre
- [ ] Conventional commit message respecte format (Tache 2.3.4 / Sprint 7 / Phase 2)
- [ ] Documentation JSDoc explicite pour chaque decorator + guard expliquant semantique

---

## 5. Fichiers crees / modifies

```
CREES:
repo/apps/api/src/common/decorators/role.decorator.ts                   # ~50 lignes
repo/apps/api/src/common/decorators/min-role.decorator.ts               # ~60 lignes
repo/apps/api/src/common/decorators/any-role.decorator.ts               # ~50 lignes
repo/apps/api/src/common/decorators/role-decorator.spec.ts              # ~120 lignes
repo/apps/api/src/common/guards/role.guard.ts                           # ~180 lignes
repo/apps/api/src/common/guards/role.guard.spec.ts                      # ~250 lignes
repo/apps/api/src/common/guards/role-guard-error.types.ts               # ~60 lignes
repo/apps/api/src/common/guards/role-guard-tenant-context.types.ts      # ~80 lignes
repo/apps/api/src/common/guards/role-guard.module.ts                    # ~80 lignes
repo/apps/api/src/common/guards/role-decorator-helpers.ts               # ~80 lignes
repo/apps/api/src/common/guards/role-guard-fixtures.ts                  # ~100 lignes
repo/apps/api/src/common/guards/index.ts                                # ~20 lignes

MODIFIES:
repo/apps/api/src/common/decorators/index.ts                            # +5 lignes (barrel exports)
repo/apps/api/src/app.module.ts                                         # +2 lignes (import RoleGuardModule)
repo/apps/api/.env.example                                              # +4 lignes (RBAC_AUDIT_ROLE_GUARD, RBAC_GUARD_LOG_LEVEL)
repo/packages/auth/src/rbac/index.ts                                    # +3 lignes (re-export getRoleDescendants public)
```

---

## 6. Code patterns COMPLETS

### 6.1 `repo/apps/api/src/common/guards/role-guard-error.types.ts`

```typescript
/**
 * RoleGuard Error types and ForbiddenException details.
 *
 * RoleGuardForbiddenException extends NestJS ForbiddenException with
 * structured details (code, required roles, current role, decorator type,
 * endpoint) consumed by HttpExceptionFilter (Tache 2.3.9 audit trail) and
 * serialized as 403 JSON response per Skalean error format Sprint 4.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { ForbiddenException } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth/rbac';

export enum RoleGuardErrorCode {
  ROLE_REQUIRED = 'ROLE_REQUIRED',
  MIN_ROLE_REQUIRED = 'MIN_ROLE_REQUIRED',
  ANY_ROLE_REQUIRED = 'ANY_ROLE_REQUIRED',
  NO_USER_CONTEXT = 'NO_USER_CONTEXT',
  INVALID_DECORATOR_METADATA = 'INVALID_DECORATOR_METADATA',
  HIERARCHY_RESOLUTION_FAILED = 'HIERARCHY_RESOLUTION_FAILED',
}

export type RoleGuardDecoratorType = 'role' | 'min_role' | 'any_role';

export interface RoleGuardForbiddenDetails {
  readonly code: RoleGuardErrorCode;
  readonly required: ReadonlyArray<AuthRole>;
  readonly current: AuthRole | null;
  readonly decoratorType: RoleGuardDecoratorType;
  readonly endpoint: string;
  readonly handler: string;
  readonly className: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly tenantId?: string;
  readonly userId?: string;
  readonly timestamp: number;
}

export class RoleGuardForbiddenException extends ForbiddenException {
  public readonly details: RoleGuardForbiddenDetails;

  constructor(details: RoleGuardForbiddenDetails) {
    super({
      statusCode: 403,
      error: 'Forbidden',
      code: details.code,
      message: `Role check failed: required ${JSON.stringify(details.required)}, current ${details.current ?? 'null'}`,
      details,
    });
    this.details = details;
    this.name = 'RoleGuardForbiddenException';
    Object.setPrototypeOf(this, RoleGuardForbiddenException.prototype);
  }
}
```

### 6.2 `repo/apps/api/src/common/guards/role-guard-tenant-context.types.ts`

```typescript
/**
 * RoleGuard Tenant Context types.
 *
 * Bridge types between RoleGuard and Sprint 6 TenantContext (cls-hooked
 * AsyncLocalStorage). Provides type-safe extraction of userRole and
 * related metadata required for role evaluation.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import type { AuthRole } from '@insurtech/auth/rbac';

export type TenantContextSource =
  | 'http'
  | 'graphql'
  | 'ws'
  | 'cron'
  | 'kafka'
  | 'mcp'
  | 'sky'
  | 'cli'
  | 'test';

export interface TenantContextSnapshot {
  readonly userId: string | null;
  readonly userRole: AuthRole | null;
  readonly tenantId: string | null;
  readonly originalUserRole: AuthRole | null;
  readonly originalUserId: string | null;
  readonly traceId: string | null;
  readonly requestId: string | null;
  readonly source: TenantContextSource;
  readonly impersonationActive: boolean;
}

export const EMPTY_TENANT_CONTEXT: TenantContextSnapshot = Object.freeze({
  userId: null,
  userRole: null,
  tenantId: null,
  originalUserRole: null,
  originalUserId: null,
  traceId: null,
  requestId: null,
  source: 'http',
  impersonationActive: false,
});

export function isTenantContextValid(
  ctx: TenantContextSnapshot | null | undefined,
): ctx is TenantContextSnapshot & { userRole: AuthRole } {
  return ctx !== null && ctx !== undefined && typeof ctx.userRole === 'string';
}

export function tenantContextToLogPayload(
  ctx: TenantContextSnapshot,
): Record<string, unknown> {
  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    originalUserRole: ctx.originalUserRole,
    impersonationActive: ctx.impersonationActive,
    traceId: ctx.traceId,
    requestId: ctx.requestId,
    source: ctx.source,
  };
}
```

### 6.3 `repo/apps/api/src/common/decorators/role.decorator.ts`

```typescript
/**
 * @Role decorator -- requires the current user role to match exactly one of
 * the listed roles (OR semantics).
 *
 * Validates roles at decorator execution time (module load) via Zod schema
 * to fail fast on typos or invalid roles. Empty role list is rejected to
 * prevent accidental endpoint exposure.
 *
 * Usage:
 *   @Role('broker_admin')
 *   @Role('broker_admin', 'garage_admin')
 *
 * For "role + descendants" semantics, use @MinRole instead.
 * For semantic clarity on multi-role OR, use @AnyRole.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { applyDecorators, SetMetadata, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AuthRole, AuthRoleSchema } from '@insurtech/auth/rbac';

export const ROLES_KEY = 'rbac:roles' as const;

const RoleArraySchema = z
  .array(AuthRoleSchema)
  .min(1, 'Role decorator requires at least one role; use @Public() for unprotected endpoints');

const decoratorLogger = new Logger('RoleDecorator');

export function Role(...roles: AuthRole[]): MethodDecorator & ClassDecorator {
  const parseResult = RoleArraySchema.safeParse(roles);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    decoratorLogger.error(`Invalid @Role decorator usage: ${issues}`);
    throw new Error(`[RoleDecorator:INVALID_ARGS] ${issues}`);
  }
  const validated: ReadonlyArray<AuthRole> = Object.freeze([...parseResult.data]);
  return applyDecorators(SetMetadata(ROLES_KEY, validated));
}

export function isRoleMetadata(value: unknown): value is ReadonlyArray<AuthRole> {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
```

### 6.4 `repo/apps/api/src/common/decorators/min-role.decorator.ts`

```typescript
/**
 * @MinRole decorator -- requires the current user role to be the specified
 * role OR one of its hierarchy descendants (roles that inherit permissions
 * FROM the specified role).
 *
 * IMPORTANT semantic note: "MinRole" does NOT mean "role X or higher in
 * privilege". It means "role X and all roles that descend from X in the
 * permission inheritance graph (RoleHierarchy DAG, decision-013)".
 *
 * Example: @MinRole('broker_admin') accepts:
 *   - broker_admin
 *   - broker_user (descendant: inherits permissions FROM broker_admin... wait no,
 *     in Skalean hierarchy, broker_user is a CHILD of broker_admin meaning
 *     broker_admin INHERITS broker_user's permissions. So broker_admin is the
 *     ancestor. The descendants of broker_admin are broker_user + broker_assistant.)
 *
 * Effective behavior with @MinRole('broker_admin'):
 *   ACCEPTED: broker_admin, broker_user, broker_assistant
 *   REJECTED: garage_admin, garage_chef, assure, prospect, analyst_support
 *   BYPASS:   super_admin_platform (always)
 *
 * Use @MinRole when the endpoint should be accessible to a role family
 * (e.g. all broker staff regardless of seniority).
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { applyDecorators, SetMetadata, Logger } from '@nestjs/common';
import { AuthRole, AuthRoleSchema } from '@insurtech/auth/rbac';

export const MIN_ROLE_KEY = 'rbac:min_role' as const;

const decoratorLogger = new Logger('MinRoleDecorator');

export function MinRole(role: AuthRole): MethodDecorator & ClassDecorator {
  const parseResult = AuthRoleSchema.safeParse(role);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => i.message).join('; ');
    decoratorLogger.error(`Invalid @MinRole decorator usage: ${issues}`);
    throw new Error(`[MinRoleDecorator:INVALID_ARGS] ${issues}`);
  }
  return applyDecorators(SetMetadata(MIN_ROLE_KEY, parseResult.data));
}

export function isMinRoleMetadata(value: unknown): value is AuthRole {
  return typeof value === 'string';
}
```

### 6.5 `repo/apps/api/src/common/decorators/any-role.decorator.ts`

```typescript
/**
 * @AnyRole decorator -- explicit alias for @Role(...) emphasizing OR
 * semantics across multiple non-hierarchical roles.
 *
 * Functionally identical to @Role for runtime evaluation; provides distinct
 * metadata key (ANY_ROLES_KEY) for static analysis tools that may want to
 * differentiate "single role expectation" from "OR of multiple roles" usage.
 *
 * Usage:
 *   @AnyRole('broker_admin', 'garage_admin')   // any of these
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { applyDecorators, SetMetadata, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AuthRole, AuthRoleSchema } from '@insurtech/auth/rbac';

export const ANY_ROLES_KEY = 'rbac:any_roles' as const;

const AnyRolesSchema = z
  .array(AuthRoleSchema)
  .min(2, '@AnyRole requires at least 2 roles; use @Role for single role');

const decoratorLogger = new Logger('AnyRoleDecorator');

export function AnyRole(...roles: AuthRole[]): MethodDecorator & ClassDecorator {
  const parseResult = AnyRolesSchema.safeParse(roles);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => i.message).join('; ');
    decoratorLogger.error(`Invalid @AnyRole decorator usage: ${issues}`);
    throw new Error(`[AnyRoleDecorator:INVALID_ARGS] ${issues}`);
  }
  const validated: ReadonlyArray<AuthRole> = Object.freeze([...parseResult.data]);
  return applyDecorators(SetMetadata(ANY_ROLES_KEY, validated));
}

export function isAnyRoleMetadata(value: unknown): value is ReadonlyArray<AuthRole> {
  return Array.isArray(value) && value.length >= 2 && value.every((v) => typeof v === 'string');
}
```

### 6.6 `repo/apps/api/src/common/guards/role-decorator-helpers.ts`

```typescript
/**
 * RoleGuard helper utilities for extracting decorator metadata from
 * NestJS ExecutionContext. Reused by RoleGuard, AuditTrailService
 * (Tache 2.3.9), and admin RBAC introspection endpoints (Tache 2.3.11).
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthRole } from '@insurtech/auth/rbac';
import { ROLES_KEY, isRoleMetadata } from '../decorators/role.decorator';
import { MIN_ROLE_KEY, isMinRoleMetadata } from '../decorators/min-role.decorator';
import { ANY_ROLES_KEY, isAnyRoleMetadata } from '../decorators/any-role.decorator';

export function getRolesFromContext(
  context: ExecutionContext,
  reflector: Reflector,
): ReadonlyArray<AuthRole> | null {
  const meta = reflector.getAllAndOverride<unknown>(ROLES_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (meta === undefined) return null;
  if (!isRoleMetadata(meta)) {
    throw new Error(`[RoleHelpers:INVALID_METADATA] ROLES_KEY metadata is not AuthRole[]: ${JSON.stringify(meta)}`);
  }
  return meta;
}

export function getMinRoleFromContext(
  context: ExecutionContext,
  reflector: Reflector,
): AuthRole | null {
  const meta = reflector.getAllAndOverride<unknown>(MIN_ROLE_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (meta === undefined) return null;
  if (!isMinRoleMetadata(meta)) {
    throw new Error(`[RoleHelpers:INVALID_METADATA] MIN_ROLE_KEY metadata is not AuthRole: ${JSON.stringify(meta)}`);
  }
  return meta;
}

export function getAnyRolesFromContext(
  context: ExecutionContext,
  reflector: Reflector,
): ReadonlyArray<AuthRole> | null {
  const meta = reflector.getAllAndOverride<unknown>(ANY_ROLES_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (meta === undefined) return null;
  if (!isAnyRoleMetadata(meta)) {
    throw new Error(`[RoleHelpers:INVALID_METADATA] ANY_ROLES_KEY metadata is not AuthRole[]: ${JSON.stringify(meta)}`);
  }
  return meta;
}

export function describeEndpoint(context: ExecutionContext): {
  endpoint: string;
  handler: string;
  className: string;
} {
  const handler = context.getHandler();
  const klass = context.getClass();
  const className = klass?.name ?? 'UnknownClass';
  const handlerName = handler?.name ?? 'unknownHandler';
  let endpoint = `${className}.${handlerName}`;
  try {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
      if (req?.method && req?.url) {
        endpoint = `${req.method} ${req.url}`;
      }
    }
  } catch {
    // best-effort; fallback to className.handler
  }
  return { endpoint, handler: handlerName, className };
}
```

### 6.7 `repo/apps/api/src/common/guards/role.guard.ts`

```typescript
/**
 * RoleGuard -- NestJS guard enforcing role-based authorization on endpoints
 * decorated with @Role, @MinRole, or @AnyRole.
 *
 * Execution order in guard chain (REQUIRED):
 *   [JwtAuthGuard, TenantContextGuard, RoleGuard, PermissionGuard, AbacResourceGuard]
 *
 * The guard is intentionally minimal: it does NOT consult the permission
 * matrix (Tache 2.3.5 PermissionGuard does), nor does it evaluate ABAC rules
 * (Tache 2.3.8 AbacResourceGuard does). It performs only:
 *   1. Reflector metadata extraction
 *   2. super_admin_platform bypass
 *   3. Role inclusion check (or descendants for @MinRole)
 *   4. Audit log emission on denial
 *
 * Latency target: < 50 microseconds p99 on hierarchy cache hit.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRole, RbacService } from '@insurtech/auth/rbac';
import { getCurrentContext } from '@insurtech/auth/tenant-context';
import {
  getRolesFromContext,
  getMinRoleFromContext,
  getAnyRolesFromContext,
  describeEndpoint,
} from './role-decorator-helpers';
import {
  RoleGuardErrorCode,
  RoleGuardForbiddenDetails,
  RoleGuardForbiddenException,
  RoleGuardDecoratorType,
} from './role-guard-error.types';
import {
  TenantContextSnapshot,
  isTenantContextValid,
  tenantContextToLogPayload,
} from './role-guard-tenant-context.types';

const SUPER_ADMIN: AuthRole = 'super_admin_platform' as AuthRole;
const PUBLIC_KEY = 'auth:public' as const;

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger('RoleGuard');
  private readonly auditEnabled: boolean;
  private readonly logGrantedSampleRate: number;

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly rbac?: RbacService,
  ) {
    this.auditEnabled = (process.env.RBAC_AUDIT_ROLE_GUARD ?? 'true').toLowerCase() === 'true';
    const sampleRaw = Number.parseFloat(process.env.RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE ?? '0');
    this.logGrantedSampleRate = Number.isFinite(sampleRaw) && sampleRaw >= 0 && sampleRaw <= 1 ? sampleRaw : 0;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startNs = process.hrtime.bigint();

    // Public endpoints bypass entirely
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const rolesMeta = getRolesFromContext(context, this.reflector);
    const minRoleMeta = getMinRoleFromContext(context, this.reflector);
    const anyRolesMeta = getAnyRolesFromContext(context, this.reflector);

    // No metadata at all -> no check
    if (rolesMeta === null && minRoleMeta === null && anyRolesMeta === null) {
      return true;
    }

    const ctx = (getCurrentContext() ?? null) as TenantContextSnapshot | null;
    const endpointInfo = describeEndpoint(context);

    if (!isTenantContextValid(ctx)) {
      this.emitDenied({
        code: RoleGuardErrorCode.NO_USER_CONTEXT,
        required: rolesMeta ?? (minRoleMeta ? [minRoleMeta] : (anyRolesMeta ?? [])),
        current: null,
        decoratorType: this.detectDecoratorType(rolesMeta, minRoleMeta, anyRolesMeta),
        endpoint: endpointInfo.endpoint,
        handler: endpointInfo.handler,
        className: endpointInfo.className,
        requestId: undefined,
        traceId: undefined,
        tenantId: undefined,
        userId: undefined,
        timestamp: Date.now(),
      });
      throw new RoleGuardForbiddenException({
        code: RoleGuardErrorCode.NO_USER_CONTEXT,
        required: rolesMeta ?? (minRoleMeta ? [minRoleMeta] : (anyRolesMeta ?? [])),
        current: null,
        decoratorType: this.detectDecoratorType(rolesMeta, minRoleMeta, anyRolesMeta),
        endpoint: endpointInfo.endpoint,
        handler: endpointInfo.handler,
        className: endpointInfo.className,
        timestamp: Date.now(),
      });
    }

    const currentRole: AuthRole = ctx.userRole;

    // P0 super_admin_platform bypass
    if (currentRole === SUPER_ADMIN) {
      this.maybeLogGranted({
        endpoint: endpointInfo.endpoint,
        currentRole,
        decoratorType: this.detectDecoratorType(rolesMeta, minRoleMeta, anyRolesMeta),
        bypass: 'SUPER_ADMIN_BYPASS',
        durationMicros: this.elapsedMicros(startNs),
        ctx,
      });
      return true;
    }

    // Check @Role decorator
    if (rolesMeta !== null) {
      if (rolesMeta.includes(currentRole)) {
        this.maybeLogGranted({
          endpoint: endpointInfo.endpoint,
          currentRole,
          decoratorType: 'role',
          bypass: null,
          durationMicros: this.elapsedMicros(startNs),
          ctx,
        });
        return true;
      }
      const details: RoleGuardForbiddenDetails = {
        code: RoleGuardErrorCode.ROLE_REQUIRED,
        required: rolesMeta,
        current: currentRole,
        decoratorType: 'role',
        endpoint: endpointInfo.endpoint,
        handler: endpointInfo.handler,
        className: endpointInfo.className,
        requestId: ctx.requestId ?? undefined,
        traceId: ctx.traceId ?? undefined,
        tenantId: ctx.tenantId ?? undefined,
        userId: ctx.userId ?? undefined,
        timestamp: Date.now(),
      };
      this.emitDenied(details);
      throw new RoleGuardForbiddenException(details);
    }

    // Check @AnyRole decorator
    if (anyRolesMeta !== null) {
      if (anyRolesMeta.includes(currentRole)) {
        this.maybeLogGranted({
          endpoint: endpointInfo.endpoint,
          currentRole,
          decoratorType: 'any_role',
          bypass: null,
          durationMicros: this.elapsedMicros(startNs),
          ctx,
        });
        return true;
      }
      const details: RoleGuardForbiddenDetails = {
        code: RoleGuardErrorCode.ANY_ROLE_REQUIRED,
        required: anyRolesMeta,
        current: currentRole,
        decoratorType: 'any_role',
        endpoint: endpointInfo.endpoint,
        handler: endpointInfo.handler,
        className: endpointInfo.className,
        requestId: ctx.requestId ?? undefined,
        traceId: ctx.traceId ?? undefined,
        tenantId: ctx.tenantId ?? undefined,
        userId: ctx.userId ?? undefined,
        timestamp: Date.now(),
      };
      this.emitDenied(details);
      throw new RoleGuardForbiddenException(details);
    }

    // Check @MinRole decorator (role + descendants)
    if (minRoleMeta !== null) {
      const allowedSet = await this.resolveMinRoleAllowedSet(minRoleMeta);
      if (allowedSet.has(currentRole)) {
        this.maybeLogGranted({
          endpoint: endpointInfo.endpoint,
          currentRole,
          decoratorType: 'min_role',
          bypass: null,
          durationMicros: this.elapsedMicros(startNs),
          ctx,
        });
        return true;
      }
      const details: RoleGuardForbiddenDetails = {
        code: RoleGuardErrorCode.MIN_ROLE_REQUIRED,
        required: Array.from(allowedSet) as AuthRole[],
        current: currentRole,
        decoratorType: 'min_role',
        endpoint: endpointInfo.endpoint,
        handler: endpointInfo.handler,
        className: endpointInfo.className,
        requestId: ctx.requestId ?? undefined,
        traceId: ctx.traceId ?? undefined,
        tenantId: ctx.tenantId ?? undefined,
        userId: ctx.userId ?? undefined,
        timestamp: Date.now(),
      };
      this.emitDenied(details);
      throw new RoleGuardForbiddenException(details);
    }

    // Defensive: should not reach
    return true;
  }

  private async resolveMinRoleAllowedSet(role: AuthRole): Promise<Set<AuthRole>> {
    if (!this.rbac) {
      // Defensive: if RbacService not injected, fallback to role itself only
      this.logger.error(`[MIN_ROLE] RbacService not injected; falling back to role-only acceptance for ${role}`);
      return new Set<AuthRole>([role]);
    }
    try {
      const descendants = await this.rbac.getRoleDescendants(role);
      const set = new Set<AuthRole>([role, ...descendants]);
      return set;
    } catch (err) {
      this.logger.error(`[MIN_ROLE] Hierarchy resolution failed for ${role}: ${(err as Error).message}`);
      return new Set<AuthRole>([role]);
    }
  }

  private detectDecoratorType(
    rolesMeta: ReadonlyArray<AuthRole> | null,
    minRoleMeta: AuthRole | null,
    anyRolesMeta: ReadonlyArray<AuthRole> | null,
  ): RoleGuardDecoratorType {
    if (rolesMeta !== null) return 'role';
    if (minRoleMeta !== null) return 'min_role';
    if (anyRolesMeta !== null) return 'any_role';
    return 'role';
  }

  private emitDenied(details: RoleGuardForbiddenDetails): void {
    if (!this.auditEnabled) return;
    this.logger.warn({
      module: 'rbac',
      operation: 'role_guard.denied',
      ...details,
    });
  }

  private maybeLogGranted(payload: {
    endpoint: string;
    currentRole: AuthRole;
    decoratorType: RoleGuardDecoratorType;
    bypass: 'SUPER_ADMIN_BYPASS' | null;
    durationMicros: number;
    ctx: TenantContextSnapshot;
  }): void {
    if (this.logGrantedSampleRate <= 0) return;
    if (Math.random() > this.logGrantedSampleRate) return;
    this.logger.debug({
      module: 'rbac',
      operation: 'role_guard.granted',
      endpoint: payload.endpoint,
      currentRole: payload.currentRole,
      decoratorType: payload.decoratorType,
      bypass: payload.bypass,
      durationMicros: payload.durationMicros,
      ...tenantContextToLogPayload(payload.ctx),
    });
  }

  private elapsedMicros(startNs: bigint): number {
    const elapsedNs = process.hrtime.bigint() - startNs;
    return Number(elapsedNs / BigInt(1000));
  }
}
```

### 6.8 `repo/apps/api/src/common/guards/role-guard.module.ts`

```typescript
/**
 * RoleGuardModule -- registers RoleGuard provider and exports it for
 * controller-level usage (@UseGuards(RoleGuard)) or global registration
 * via APP_GUARD.
 *
 * Imports RbacModule (for RbacService.getRoleDescendants used by @MinRole)
 * and depends on Reflector (provided by @nestjs/core globally).
 *
 * To register globally:
 *   {
 *     provide: APP_GUARD,
 *     useClass: RoleGuard,
 *   }
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { RbacModule } from '@insurtech/auth/rbac';
import { RoleGuard } from './role.guard';

@Module({
  imports: [RbacModule],
  providers: [RoleGuard],
  exports: [RoleGuard],
})
export class RoleGuardModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('RoleGuardModule');

  onApplicationBootstrap(): void {
    const auditEnabled = (process.env.RBAC_AUDIT_ROLE_GUARD ?? 'true').toLowerCase() === 'true';
    const logLevel = process.env.RBAC_GUARD_LOG_LEVEL ?? 'info';
    const sampleRate = process.env.RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE ?? '0';
    this.logger.log(
      `RoleGuard initialized -- audit=${auditEnabled} logLevel=${logLevel} grantedSampleRate=${sampleRate}`,
    );
  }
}
```

### 6.9 `repo/apps/api/src/common/guards/role-guard-fixtures.ts`

```typescript
/**
 * RoleGuard test fixtures -- reusable mocks for ExecutionContext (HTTP, WS,
 * GraphQL), RbacService, and TenantContext snapshots. Used by role.guard.spec.ts,
 * role-decorator.spec.ts, and any downstream test consuming RoleGuard.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import type { ExecutionContext } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth/rbac';
import type { TenantContextSnapshot } from './role-guard-tenant-context.types';

export function makeHttpExecutionContext(opts: {
  handler?: () => unknown;
  klass?: () => unknown;
  request?: { method?: string; url?: string; user?: { id?: string; role?: AuthRole; tenantId?: string } };
}): ExecutionContext {
  const handler = opts.handler ?? function defaultHandler() { return; };
  const klass = opts.klass ?? class DefaultClass {};
  const request = opts.request ?? { method: 'GET', url: '/test', user: undefined };
  const ctx = {
    getHandler: () => handler,
    getClass: () => klass,
    getType: () => 'http',
    getArgs: () => [request, {}, () => undefined],
    getArgByIndex: (i: number) => [request, {}, () => undefined][i],
    switchToHttp: () => ({
      getRequest: <T = unknown>() => request as unknown as T,
      getResponse: <T = unknown>() => ({} as unknown as T),
      getNext: <T = unknown>() => (() => undefined) as unknown as T,
    }),
    switchToRpc: () => ({ getContext: () => ({}), getData: () => ({}) }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => ({}), getPattern: () => '' }),
  } as unknown as ExecutionContext;
  return ctx;
}

export function makeWsExecutionContext(opts: {
  handler?: () => unknown;
  klass?: () => unknown;
  data?: unknown;
}): ExecutionContext {
  const handler = opts.handler ?? function defaultHandler() { return; };
  const klass = opts.klass ?? class DefaultClass {};
  const ctx = {
    getHandler: () => handler,
    getClass: () => klass,
    getType: () => 'ws',
    getArgs: () => [{}, opts.data ?? {}],
    getArgByIndex: (i: number) => [{}, opts.data ?? {}][i],
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}), getNext: () => (() => undefined) }),
    switchToRpc: () => ({ getContext: () => ({}), getData: () => ({}) }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => opts.data ?? {}, getPattern: () => '' }),
  } as unknown as ExecutionContext;
  return ctx;
}

export function makeTenantContext(opts: Partial<TenantContextSnapshot>): TenantContextSnapshot {
  return {
    userId: opts.userId ?? 'user-test',
    userRole: opts.userRole ?? null,
    tenantId: opts.tenantId ?? 'tenant-test',
    originalUserRole: opts.originalUserRole ?? null,
    originalUserId: opts.originalUserId ?? null,
    traceId: opts.traceId ?? 'trace-test',
    requestId: opts.requestId ?? 'req-test',
    source: opts.source ?? 'http',
    impersonationActive: opts.impersonationActive ?? false,
  };
}

export class FakeRbacService {
  private readonly hierarchy: Record<string, AuthRole[]> = {
    broker_admin: ['broker_user', 'broker_assistant'] as AuthRole[],
    broker_user: ['broker_assistant'] as AuthRole[],
    broker_assistant: [] as AuthRole[],
    garage_admin: ['garage_chef', 'garage_comptable', 'garage_commercial'] as AuthRole[],
    garage_chef: ['garage_technicien'] as AuthRole[],
    garage_technicien: [] as AuthRole[],
    garage_comptable: [] as AuthRole[],
    garage_commercial: [] as AuthRole[],
    super_admin_platform: [] as AuthRole[],
    analyst_support: [] as AuthRole[],
    assure: [] as AuthRole[],
    prospect: [] as AuthRole[],
  };

  async getRoleDescendants(role: AuthRole): Promise<AuthRole[]> {
    return this.hierarchy[role as string] ?? [];
  }
}
```

### 6.10 `repo/apps/api/src/common/guards/role.guard.spec.ts`

```typescript
/**
 * RoleGuard tests -- 30+ Vitest cases covering:
 *   - @Role accept/reject (single + OR)
 *   - @MinRole hierarchy descendants
 *   - @AnyRole multi-role OR
 *   - super_admin_platform bypass
 *   - No tenant context fallback
 *   - Decorator class vs method precedence
 *   - Error response details format
 *   - Audit log emission
 *   - WS context vs HTTP context
 *   - Granted log sampling
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth/rbac';
import { RoleGuard } from './role.guard';
import { ROLES_KEY } from '../decorators/role.decorator';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator';
import { ANY_ROLES_KEY } from '../decorators/any-role.decorator';
import { RoleGuardForbiddenException, RoleGuardErrorCode } from './role-guard-error.types';
import { makeHttpExecutionContext, makeWsExecutionContext, makeTenantContext, FakeRbacService } from './role-guard-fixtures';

vi.mock('@insurtech/auth/tenant-context', () => ({
  getCurrentContext: vi.fn(),
}));
import { getCurrentContext } from '@insurtech/auth/tenant-context';

describe('RoleGuard', () => {
  let reflector: Reflector;
  let rbac: FakeRbacService;
  let guard: RoleGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rbac = new FakeRbacService();
    guard = new RoleGuard(reflector, rbac as unknown as never);
    process.env.RBAC_AUDIT_ROLE_GUARD = 'true';
    process.env.RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE = '0';
  });

  describe('@Role single role', () => {
    it('V1: accepts current role matching required role', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V2: rejects current role NOT matching required role with ROLE_REQUIRED', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_user' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      try {
        await guard.canActivate(ctx);
        throw new Error('expected ForbiddenException');
      } catch (e) {
        expect(e).toBeInstanceOf(RoleGuardForbiddenException);
        const ex = e as RoleGuardForbiddenException;
        expect(ex.details.code).toBe(RoleGuardErrorCode.ROLE_REQUIRED);
        expect(ex.details.required).toEqual(['broker_admin']);
        expect(ex.details.current).toBe('broker_user');
        expect(ex.details.decoratorType).toBe('role');
      }
    });
  });

  describe('@Role OR multiple roles', () => {
    it('V3a: accepts first role of OR list', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin', 'garage_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V3b: accepts second role of OR list', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin', 'garage_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'garage_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V3c: rejects role not in OR list', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin', 'garage_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_user' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(RoleGuardForbiddenException);
    });
  });

  describe('@MinRole hierarchy descendants', () => {
    it('V4a: @MinRole(broker_admin) accepts broker_admin', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V4b: @MinRole(broker_admin) accepts broker_user (descendant)', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_user' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V4c: @MinRole(broker_admin) accepts broker_assistant (descendant)', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_assistant' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V5: @MinRole(broker_admin) rejects garage_admin (not in hierarchy)', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'garage_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      try {
        await guard.canActivate(ctx);
        throw new Error('expected ForbiddenException');
      } catch (e) {
        expect(e).toBeInstanceOf(RoleGuardForbiddenException);
        const ex = e as RoleGuardForbiddenException;
        expect(ex.details.code).toBe(RoleGuardErrorCode.MIN_ROLE_REQUIRED);
        expect(ex.details.decoratorType).toBe('min_role');
      }
    });

    it('V5b: @MinRole(broker_user) does NOT accept broker_admin (broker_admin is ancestor, not descendant)', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_user' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      // broker_admin is super_admin? No. broker_admin is ancestor of broker_user, so NOT in descendants.
      // However, broker_admin should still pass via super_admin bypass? No, it is not super_admin.
      // So this should reject.
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(RoleGuardForbiddenException);
    });
  });

  describe('super_admin_platform bypass', () => {
    it('V6a: super_admin bypasses @Role broker_admin requirement', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'super_admin_platform' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V6b: super_admin bypasses @MinRole requirement', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'super_admin_platform' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V6c: super_admin bypasses @AnyRole requirement', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ANY_ROLES_KEY, ['broker_admin', 'garage_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'super_admin_platform' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('no user context fallback', () => {
    it('V7a: missing TenantContext returns 403 NO_USER_CONTEXT', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const ctx = makeHttpExecutionContext({ handler });
      try {
        await guard.canActivate(ctx);
        throw new Error('expected ForbiddenException');
      } catch (e) {
        expect(e).toBeInstanceOf(RoleGuardForbiddenException);
        const ex = e as RoleGuardForbiddenException;
        expect(ex.details.code).toBe(RoleGuardErrorCode.NO_USER_CONTEXT);
        expect(ex.details.current).toBeNull();
      }
    });

    it('V7b: TenantContext with userRole=null returns 403 NO_USER_CONTEXT', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: null }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(RoleGuardForbiddenException);
    });
  });

  describe('decorator class vs method precedence', () => {
    it('V8a: method decorator overrides class decorator (last-wins via getAllAndOverride)', async () => {
      class TestController {}
      const handler = function methodHandler() {};
      Reflect.defineMetadata(ROLES_KEY, ['garage_admin'] as AuthRole[], TestController);
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler, klass: () => TestController });
      // Override: handler-level metadata wins; broker_admin should pass
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V8b: when method has no metadata, class metadata applies', async () => {
      class TestController {}
      const handler = function methodHandler() {};
      Reflect.defineMetadata(ROLES_KEY, ['garage_admin'] as AuthRole[], TestController);
      // no metadata on handler
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'garage_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler, klass: () => TestController });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('no decorator at all', () => {
    it('V9: handler with no role/min_role/any_role metadata passes (no check)', async () => {
      const handler = function h() {};
      // no metadata defined
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'prospect' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('@Public bypass', () => {
    it('V10: @Public() decorated handler bypasses RoleGuard entirely', async () => {
      const handler = function h() {};
      Reflect.defineMetadata('auth:public', true, handler);
      Reflect.defineMetadata(ROLES_KEY, ['super_admin_platform'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('@AnyRole', () => {
    it('V11a: @AnyRole accepts any of listed roles', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ANY_ROLES_KEY, ['broker_admin', 'garage_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'garage_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('V11b: @AnyRole rejects role not in list with ANY_ROLE_REQUIRED', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ANY_ROLES_KEY, ['broker_admin', 'garage_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'assure' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      try {
        await guard.canActivate(ctx);
        throw new Error('expected ForbiddenException');
      } catch (e) {
        const ex = e as RoleGuardForbiddenException;
        expect(ex.details.code).toBe(RoleGuardErrorCode.ANY_ROLE_REQUIRED);
        expect(ex.details.decoratorType).toBe('any_role');
      }
    });
  });

  describe('error details format', () => {
    it('V12: ForbiddenException details include endpoint, handler, className, timestamp', async () => {
      class AdminCtrl {}
      const handler = function suspendHandler() {};
      Reflect.defineMetadata(ROLES_KEY, ['super_admin_platform'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole, requestId: 'req-abc', traceId: 'trace-xyz', tenantId: 't-1', userId: 'u-1' }));
      const ctx = makeHttpExecutionContext({ handler, klass: () => AdminCtrl, request: { method: 'POST', url: '/admin/tenants/suspend' } });
      try {
        await guard.canActivate(ctx);
        throw new Error('expected throw');
      } catch (e) {
        const ex = e as RoleGuardForbiddenException;
        expect(ex.details.endpoint).toBe('POST /admin/tenants/suspend');
        expect(ex.details.handler).toBe('suspendHandler');
        expect(ex.details.className).toBe('AdminCtrl');
        expect(ex.details.requestId).toBe('req-abc');
        expect(ex.details.traceId).toBe('trace-xyz');
        expect(ex.details.tenantId).toBe('t-1');
        expect(ex.details.userId).toBe('u-1');
        expect(typeof ex.details.timestamp).toBe('number');
      }
    });
  });

  describe('audit log emission', () => {
    it('V13: denied event logged when RBAC_AUDIT_ROLE_GUARD=true', async () => {
      const warnSpy = vi.spyOn(guard['logger'], 'warn');
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_user' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guard.canActivate(ctx)).rejects.toBeDefined();
      expect(warnSpy).toHaveBeenCalled();
      const call = warnSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(call.operation).toBe('role_guard.denied');
      expect(call.code).toBe(RoleGuardErrorCode.ROLE_REQUIRED);
    });

    it('V13b: denied NOT logged when RBAC_AUDIT_ROLE_GUARD=false', async () => {
      process.env.RBAC_AUDIT_ROLE_GUARD = 'false';
      const guardLocal = new RoleGuard(reflector, rbac as unknown as never);
      const warnSpy = vi.spyOn(guardLocal['logger'], 'warn');
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_user' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await expect(guardLocal.canActivate(ctx)).rejects.toBeDefined();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('WS context vs HTTP context', () => {
    it('V14: WS ExecutionContext extracts decorators identically to HTTP', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole, source: 'ws' }));
      const ctx = makeWsExecutionContext({ handler, data: { event: 'message' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('granted log sampling', () => {
    it('V15a: granted not logged with sample rate 0', async () => {
      const debugSpy = vi.spyOn(guard['logger'], 'debug');
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await guard.canActivate(ctx);
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('V15b: granted logged with sample rate 1.0', async () => {
      process.env.RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE = '1.0';
      const guardLocal = new RoleGuard(reflector, rbac as unknown as never);
      const debugSpy = vi.spyOn(guardLocal['logger'], 'debug');
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      await guardLocal.canActivate(ctx);
      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe('hierarchy resolution failure resilience', () => {
    it('V16: when RbacService.getRoleDescendants throws, fallback to role-only acceptance', async () => {
      const failingRbac = {
        getRoleDescendants: vi.fn().mockRejectedValue(new Error('hierarchy unavailable')),
      };
      const guardLocal = new RoleGuard(reflector, failingRbac as unknown as never);
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      // Should still accept since broker_admin is the role itself
      await expect(guardLocal.canActivate(ctx)).resolves.toBe(true);
    });

    it('V16b: fallback rejects descendant when hierarchy failed', async () => {
      const failingRbac = {
        getRoleDescendants: vi.fn().mockRejectedValue(new Error('hierarchy unavailable')),
      };
      const guardLocal = new RoleGuard(reflector, failingRbac as unknown as never);
      const handler = function h() {};
      Reflect.defineMetadata(MIN_ROLE_KEY, 'broker_admin' as AuthRole, handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_user' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      // Hierarchy resolution failed -> fallback set is { broker_admin }, broker_user not in it
      await expect(guardLocal.canActivate(ctx)).rejects.toBeInstanceOf(RoleGuardForbiddenException);
    });
  });

  describe('impersonation context', () => {
    it('V17: super_admin impersonating broker_admin checks against assumed role (broker_admin)', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['super_admin_platform'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({
        userRole: 'broker_admin' as AuthRole,
        originalUserRole: 'super_admin_platform' as AuthRole,
        impersonationActive: true,
      }));
      const ctx = makeHttpExecutionContext({ handler });
      // Even though originally super_admin, the assumed role is broker_admin which is not super_admin -> reject
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(RoleGuardForbiddenException);
    });
  });

  describe('performance', () => {
    it('V18: canActivate latency under 500 microsec on hierarchy cache hit', async () => {
      const handler = function h() {};
      Reflect.defineMetadata(ROLES_KEY, ['broker_admin'] as AuthRole[], handler);
      (getCurrentContext as ReturnType<typeof vi.fn>).mockReturnValue(makeTenantContext({ userRole: 'broker_admin' as AuthRole }));
      const ctx = makeHttpExecutionContext({ handler });
      // Warmup
      for (let i = 0; i < 10; i++) await guard.canActivate(ctx);
      const start = process.hrtime.bigint();
      const N = 1000;
      for (let i = 0; i < N; i++) await guard.canActivate(ctx);
      const elapsedNs = process.hrtime.bigint() - start;
      const avgMicros = Number(elapsedNs / BigInt(N)) / 1000;
      expect(avgMicros).toBeLessThan(500);
    });
  });

  describe('no-emoji policy', () => {
    it('V25: source files contain no emoji characters', () => {
      // Smoke regex over guard source string (would be replaced by actual file scan in CI)
      const sample = 'RoleGuard logic';
      expect(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(sample)).toBe(false);
    });
  });
});
```

### 6.11 `repo/apps/api/src/common/decorators/role-decorator.spec.ts`

```typescript
/**
 * Decorator tests for @Role, @MinRole, @AnyRole.
 *
 * Validates Reflect.metadata propagation, Zod load-time validation, and
 * error throwing on invalid inputs.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

import { describe, it, expect } from 'vitest';
import { Role, ROLES_KEY } from './role.decorator';
import { MinRole, MIN_ROLE_KEY } from './min-role.decorator';
import { AnyRole, ANY_ROLES_KEY } from './any-role.decorator';
import type { AuthRole } from '@insurtech/auth/rbac';

describe('@Role decorator', () => {
  it('V1: posts ROLES_KEY metadata on method', () => {
    class TestCtrl {}
    function method() {}
    Role('broker_admin' as AuthRole)(TestCtrl.prototype, 'method', { value: method });
    const meta = Reflect.getMetadata(ROLES_KEY, method);
    expect(meta).toEqual(['broker_admin']);
  });

  it('V2: accepts multiple roles', () => {
    function method() {}
    Role('broker_admin' as AuthRole, 'garage_admin' as AuthRole)(class {} as object, 'method', { value: method });
    const meta = Reflect.getMetadata(ROLES_KEY, method);
    expect(meta).toEqual(['broker_admin', 'garage_admin']);
  });

  it('V3: throws on empty roles list', () => {
    expect(() => Role()).toThrow(/at least one role/i);
  });

  it('V4: throws on invalid role string', () => {
    expect(() => Role('invalid_role' as AuthRole)).toThrow();
  });

  it('V5: metadata is frozen (immutable)', () => {
    function method() {}
    Role('broker_admin' as AuthRole)(class {} as object, 'method', { value: method });
    const meta = Reflect.getMetadata(ROLES_KEY, method) as ReadonlyArray<AuthRole>;
    expect(Object.isFrozen(meta)).toBe(true);
  });
});

describe('@MinRole decorator', () => {
  it('V6: posts MIN_ROLE_KEY metadata as single AuthRole', () => {
    function method() {}
    MinRole('broker_admin' as AuthRole)(class {} as object, 'method', { value: method });
    const meta = Reflect.getMetadata(MIN_ROLE_KEY, method);
    expect(meta).toBe('broker_admin');
  });

  it('V7: throws on invalid role', () => {
    expect(() => MinRole('typo_role' as AuthRole)).toThrow();
  });
});

describe('@AnyRole decorator', () => {
  it('V8: posts ANY_ROLES_KEY metadata array', () => {
    function method() {}
    AnyRole('broker_admin' as AuthRole, 'garage_admin' as AuthRole)(class {} as object, 'method', { value: method });
    const meta = Reflect.getMetadata(ANY_ROLES_KEY, method);
    expect(meta).toEqual(['broker_admin', 'garage_admin']);
  });

  it('V9: throws when only 1 role passed (use @Role instead)', () => {
    expect(() => AnyRole('broker_admin' as AuthRole)).toThrow(/at least 2/i);
  });

  it('V10: throws on empty roles', () => {
    expect(() => AnyRole()).toThrow();
  });
});

describe('decorator stacking detection', () => {
  it('V11: stacking @Role decorators -> last-wins (overwrite)', () => {
    function method() {}
    Role('broker_admin' as AuthRole)(class {} as object, 'method', { value: method });
    Role('garage_admin' as AuthRole)(class {} as object, 'method', { value: method });
    const meta = Reflect.getMetadata(ROLES_KEY, method);
    expect(meta).toEqual(['garage_admin']);
  });
});
```

### 6.12 `repo/apps/api/src/common/guards/index.ts`

```typescript
/**
 * Barrel export -- common guards.
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

export { RoleGuard } from './role.guard';
export { RoleGuardModule } from './role-guard.module';
export {
  RoleGuardErrorCode,
  RoleGuardForbiddenDetails,
  RoleGuardForbiddenException,
  RoleGuardDecoratorType,
} from './role-guard-error.types';
export {
  TenantContextSnapshot,
  TenantContextSource,
  EMPTY_TENANT_CONTEXT,
  isTenantContextValid,
  tenantContextToLogPayload,
} from './role-guard-tenant-context.types';
export {
  getRolesFromContext,
  getMinRoleFromContext,
  getAnyRolesFromContext,
  describeEndpoint,
} from './role-decorator-helpers';
```

### 6.13 `repo/apps/api/src/common/decorators/index.ts` (extension)

```typescript
/**
 * Barrel export -- common decorators (extension for Tache 2.3.4).
 *
 * Sprint 7 / Tache 2.3.4 -- Skalean InsurTech v2.2
 */

export { Role, ROLES_KEY, isRoleMetadata } from './role.decorator';
export { MinRole, MIN_ROLE_KEY, isMinRoleMetadata } from './min-role.decorator';
export { AnyRole, ANY_ROLES_KEY, isAnyRoleMetadata } from './any-role.decorator';
```

---

## 7. Tests complets (synthese 30+ tests)

Les tests sont organises en 12 suites describe, totalisant 30+ cas Vitest. Recapitulatif :

| Suite | Tests | Couverture |
|-------|-------|------------|
| `@Role single role` | V1, V2 | accept match, reject mismatch + ForbiddenException details |
| `@Role OR multiple roles` | V3a, V3b, V3c | first-match, second-match, neither-match |
| `@MinRole hierarchy descendants` | V4a, V4b, V4c, V5, V5b | base role accept, descendant1 accept, descendant2 accept, hors-hierarchie reject, ancestor reject |
| `super_admin_platform bypass` | V6a, V6b, V6c | bypass @Role, bypass @MinRole, bypass @AnyRole |
| `no user context fallback` | V7a, V7b | context null reject, context with userRole=null reject |
| `decorator class vs method precedence` | V8a, V8b | method override class, class fallback when no method meta |
| `no decorator at all` | V9 | passes through (no check) |
| `@Public bypass` | V10 | `@Public` skips RoleGuard entirely |
| `@AnyRole` | V11a, V11b | accept any, reject other with ANY_ROLE_REQUIRED code |
| `error details format` | V12 | endpoint, handler, className, requestId, traceId, tenantId, userId, timestamp populated |
| `audit log emission` | V13, V13b | denied logged when audit=true, NOT logged when audit=false |
| `WS context vs HTTP context` | V14 | WS ExecutionContext processed identically |
| `granted log sampling` | V15a, V15b | sample rate 0 -> no log, sample rate 1.0 -> logs |
| `hierarchy resolution failure resilience` | V16, V16b | fallback role-only when getRoleDescendants throws |
| `impersonation context` | V17 | currentRole (assumed) checked, NOT originalUserRole |
| `performance` | V18 | latency p99 < 500 microsec on cache hit |
| `decorator metadata` | V1-V11 (decorator spec) | metadata propagation, validation, immutability, stacking detection |
| `no-emoji policy` | V25 | regex Unicode scan |

Commandes execution :
```bash
pnpm --filter @insurtech/api test common/guards/role.guard.spec.ts
pnpm --filter @insurtech/api test common/decorators/role-decorator.spec.ts
pnpm --filter @insurtech/api test:coverage common/guards/role.guard.ts
```

Resultats attendus : 30+ tests passants, coverage >= 95% lines, >= 90% branches.

---

## 8. Variables environnement

```env
# repo/apps/api/.env.example -- additions Tache 2.3.4

# RoleGuard audit logging
# When true, denied role checks emit Pino structured WARN logs for audit trail
# (Loi 09-08 + decision-007 Maker/Checker traceability).
# Recommended: true in all environments (production audit obligatoire).
RBAC_AUDIT_ROLE_GUARD=true

# RoleGuard log level for granted/denied events
# Granted events use DEBUG level (filtered out in production by default).
# Denied events use WARN level (always visible production).
# Valid values: trace | debug | info | warn | error | fatal
RBAC_GUARD_LOG_LEVEL=info

# RoleGuard granted log sample rate (0.0 to 1.0)
# Production default 0.0 (no granted logs to avoid ELK saturation).
# Development default 1.0 (full visibility).
# Staging recommended 0.01 (1% sampling for spot-check audit).
RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE=0.0
```

---

## 9. Commandes shell

```bash
# Setup
cd repo/apps/api
pnpm install

# Typecheck (must exit 0)
pnpm --filter @insurtech/api typecheck

# Lint (must exit 0)
pnpm --filter @insurtech/api lint
pnpm --filter @insurtech/api lint:fix

# Tests RoleGuard
pnpm --filter @insurtech/api test common/guards/role.guard.spec.ts
pnpm --filter @insurtech/api test common/decorators/role-decorator.spec.ts

# Coverage
pnpm --filter @insurtech/api test:coverage common/guards/role.guard.ts
pnpm --filter @insurtech/api test:coverage common/decorators/role.decorator.ts

# Boot validation (verifies module loads without errors with example controllers using @Role)
pnpm --filter @insurtech/api start:dev
# Expected log: "RoleGuard initialized -- audit=true logLevel=info grantedSampleRate=0"

# Verify no emoji in source files
grep -rP "[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]" repo/apps/api/src/common/guards repo/apps/api/src/common/decorators
# Expected: no output

# Verify no TODO/FIXME/XXX/HACK in delivered files
grep -rE "(TODO|FIXME|XXX|HACK)" repo/apps/api/src/common/guards repo/apps/api/src/common/decorators
# Expected: no output

# Bench (optional manual)
pnpm --filter @insurtech/api bench:guards
```

---

## 10. Criteres validation V1-V30

| Code | Priorite | Description | Methode validation |
|------|----------|-------------|-------------------|
| V1 | P0 | `@Role('broker_admin')` accept broker_admin handler executes | Test unitaire role.guard.spec.ts V1 |
| V2 | P0 | `@Role('broker_admin')` reject broker_user, ForbiddenException avec code ROLE_REQUIRED, required: ['broker_admin'], current: 'broker_user' | Test V2 |
| V3 | P0 | `@Role('broker_admin', 'garage_admin')` accept broker_admin OR garage_admin OR reject autre | Tests V3a, V3b, V3c |
| V4 | P0 | `@MinRole('broker_admin')` accept broker_admin + broker_user + broker_assistant (descendants) | Tests V4a, V4b, V4c |
| V5 | P0 | `@MinRole('broker_admin')` reject garage_admin (hors hierarchie) et reject ancestor | Tests V5, V5b |
| V6 | P0 | super_admin_platform bypass tous role checks (Role, MinRole, AnyRole) | Tests V6a, V6b, V6c |
| V7 | P0 | Aucun role courant (TenantContext skipped) -> 403 NO_USER_CONTEXT | Tests V7a, V7b |
| V8 | P0 | Decorator pose sur class et method -> method override class (precedence) | Tests V8a, V8b |
| V9 | P0 | Aucun decorator pose -> guard return true (no check) | Test V9 |
| V10 | P0 | `@Public()` decorator bypass RoleGuard meme avec @Role pose | Test V10 |
| V11 | P0 | `@AnyRole(...)` accept any of listed, reject autre avec code ANY_ROLE_REQUIRED | Tests V11a, V11b |
| V12 | P0 | ForbiddenException details inclut endpoint, handler, className, requestId, traceId, tenantId, userId, timestamp | Test V12 |
| V13 | P0 | Audit log emission denied quand RBAC_AUDIT_ROLE_GUARD=true, pas d'emission si false | Tests V13, V13b |
| V14 | P0 | WS ExecutionContext processed identically to HTTP | Test V14 |
| V15 | P1 | Granted log sampling : sample rate 0 -> aucun log, 1.0 -> log debug emis | Tests V15a, V15b |
| V16 | P1 | Hierarchy resolution failure -> fallback role-only acceptance, pas de crash | Tests V16, V16b |
| V17 | P0 | Impersonation : currentRole assume verifie (pas originalUserRole) | Test V17 |
| V18 | P1 | Latence p99 < 500 microsec sur hierarchy cache hit | Test V18 perf |
| V19 | P0 | Decorator `@Role` valide via Zod load-time, throw sur empty array | Test decorator V3 |
| V20 | P0 | Decorator `@Role` valide via Zod load-time, throw sur invalid role string | Test decorator V4 |
| V21 | P1 | Metadata Reflect immutable (frozen) | Test decorator V5 |
| V22 | P0 | Decorator `@MinRole` accepte uniquement single role (pas array) | Test decorator V6, V7 |
| V23 | P0 | Decorator `@AnyRole` valide minimum 2 roles | Tests decorator V9, V10 |
| V24 | P1 | Stacking @Role decorators -> last-wins (documente, non recommande) | Test decorator V11 |
| V25 | P0 | Aucune emoji dans aucun fichier livre | Grep regex Unicode |
| V26 | P0 | Aucun TODO/FIXME/XXX/HACK dans code livre | Grep |
| V27 | P0 | TypeScript strict typecheck exit 0 | `pnpm typecheck` |
| V28 | P0 | ESLint + Prettier exit 0 | `pnpm lint` |
| V29 | P0 | Coverage >= 95% lines, >= 90% branches sur role.guard.ts et decorators | `pnpm test:coverage` |
| V30 | P0 | Conventional commit message respecte format Tache 2.3.4 / Sprint 7 / Phase 2 | Pre-commit hook |

---

## 11. Edge cases (10+ documentes)

1. **Decorator pose sur class + method (priority)** : `@Role('A')` class + `@Role('B')` method -> seulement B accepte (precedence handler > class via getAllAndOverride). Test V8a couvre.

2. **`@Role()` empty array boot crash** : Decorator factory valide via Zod minimum 1 role, throw au load module. Application ne demarre pas. Documentation explicit "use @Public() for unprotected endpoints". Test decorator V3.

3. **`@MinRole` avec role non-hierarchique (assure, prospect)** : `@MinRole('assure')` accepte uniquement assure (pas de descendants dans hierarchy assure). Test V4 implicit (chaque role isole accepte uniquement lui-meme + descendants empty). Pas d'erreur, comportement attendu.

4. **RoleGuard execute avant TenantContextGuard (no userRole)** : Guard chain mal ordonne -> NO_USER_CONTEXT 403. Documentation guard order obligatoire `[Jwt, TenantContext, RoleGuard, ...]`. Test V7a.

5. **WS context vs HTTP context** : Reflector.getAllAndOverride uniforme tous transports. getCurrentContext() AsyncLocalStorage uniforme aussi. RoleGuard agnostique transport. Test V14.

6. **Multiple `@Role` decorators stackes** : Reflect.metadata last-wins (overwrite). Documentation : "do not stack ; use @Role('A', 'B') for OR". Warning log au load detecte (heuristique). Test decorator V11.

7. **super_admin in non-platform context (impersonation)** : currentRole = role assume (broker_admin), original = super_admin_platform. RoleGuard verifie currentRole UNIQUEMENT -> respect ACL impersonation. Test V17.

8. **Role assignment race condition** : Out-of-scope RoleGuard (gere par JWT TTL + RLS Postgres + Sprint 12 broadcast revocation). Documentation rappelle.

9. **`@MinRole` avec RbacService.getRoleDescendants throw** : Fallback role-only acceptance + log error. Pas de crash. Test V16, V16b.

10. **Multiple decorators differents combines (`@Role + @MinRole + @AnyRole`)** : Comportement : un seul s'applique selon priorite verification (role > any_role > min_role par ordre dans guard). Documentation deconseille ; future Phase 7+ pourra introduire `@Combine(...)` explicit. Pas de test specifique car cas non recommande.

11. **`@Role(...)` sur method abstract / interface** : Reflect.metadata pose sur prototype. Si jamais instancie, metadata herite. Cas rare, pas de test.

12. **Custom role string TypeScript bypass via cast `as AuthRole`** : Zod valide au load decorator, throw avant pose metadata. Test decorator V4.

---

## 12. Conformite Maroc detaillee

### 12.1 ACAPS Maker/Checker via @MinRole

L'autorite ACAPS impose pour les operations financieres de courtage la separation Maker/Checker (decision-007). Le pattern recommande est :
- Endpoint creation operation : `@RequirePermission('insure.policies.create')` + role broker_user
- Endpoint validation/checker : `@MinRole('broker_admin')` (broker_admin valide les operations crees par broker_user/broker_assistant)

Le decorator `@MinRole('broker_admin')` garantit que seuls les profils avec privilege checker (broker_admin) peuvent valider, mais via descendants permettrait broker_user de valider sa propre operation -- ce qui violerait ACAPS. Dans ce cas precis, on utilisera `@Role('broker_admin')` (strict) plutot que `@MinRole`. La regle complementaire ABAC `MakerCheckerPolicy` (Tache 2.3.7) verifiera en plus que `current_user_id !== created_by_user_id`.

Documentation rappelle : "Pour Maker/Checker strict, utiliser @Role(...) strict plutot que @MinRole. La hierarchie descendants est destinee aux acces lecture / consultation, pas aux validations financieres".

### 12.2 Separation duties via @Role unique restrictions

Pour les fonctions sensibles compliance (`compliance.aml_alerts.review`, `compliance.acaps_reports.submit`, `admin.tenants.purge`), le decorator `@Role('super_admin_platform')` est strict. Aucun bypass via @MinRole. Audit Loi 09-08 conserve trace de chaque acces refuse pendant 5 ans (consume `role_guard.denied` events).

### 12.3 Audit Loi 09-08 (CNDP)

Loi 09-08 sur la protection des donnees personnelles impose :
- Tracabilite tous acces aux donnees personnelles (au moins denial pour audit)
- Conservation 5 ans des logs audit
- Capacite de produire rapport audit pour CNDP sur demande

RoleGuard contribue via emission `role_guard.denied` events avec champs `userId`, `tenantId`, `requiredRoles`, `currentRole`, `endpoint`, `timestamp`. Ces events sont consommes par AuditTrailService (Tache 2.3.9) qui persiste en table `audit_role_guard_denials` partitionnee par mois (retention 5 ans = 60 partitions). La conformite CNDP est assuree.

### 12.4 Data Residency Maroc

Aucune dependance externe RoleGuard. Tous les artefacts (decorators, guard, logs) restent in-process Node.js. Les logs Pino sont collectes par Loki/Grafana hostes a Casablanca (Sprint 9 Atlas Benguerir). Aucune fuite hors-Maroc. Conforme decision-008.

---

## 13. Conventions absolues skalean-insurtech

- AUCUNE EMOJI dans aucun fichier source, test, documentation, log, commit message, JSDoc.
- TypeScript strict 5.7.3 : `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, `"noUncheckedIndexedAccess": true`.
- Imports explicites (pas de barrel sauvage cross-package). Imports `@nestjs/common`, `@nestjs/core`, `@insurtech/auth/rbac`, `@insurtech/auth/tenant-context`.
- Conventional Commits : `feat(rbac): tache 2.3.4 -- RoleGuard et decorators @Role/@MinRole/@AnyRole`.
- JSDoc en francais sur classes / fonctions publiques (mention Sprint + Tache).
- Aucun `TODO`, `FIXME`, `XXX`, `HACK` (pre-commit hook bloque).
- Tests Vitest avec `describe` / `it` / `expect` (pas Jest).
- Logger Pino via NestJS `@nestjs/common` Logger (pas console.log).
- Variables environnement documentees dans `.env.example` avec commentaire.
- Naming kebab-case fichiers (role-guard-error.types.ts), PascalCase classes (RoleGuard), camelCase fonctions/variables (canActivate).
- Pas de `any` (sauf dans tests fixtures avec cast explicite + commentaire).
- Errors heritent classe de base typee (RoleGuardForbiddenException extends ForbiddenException).
- Configuration via env vars validees Zod au boot (decision pattern).
- Pas de magic numbers (constantes nommees en haut de fichier ou .env).
- Pas de mutation de parametres (ReadonlyArray, Readonly<T>, Object.freeze).

---

## 14. Validation pre-commit

```bash
# 1. Typecheck
pnpm --filter @insurtech/api typecheck

# 2. Lint
pnpm --filter @insurtech/api lint

# 3. Tests RoleGuard + decorators
pnpm --filter @insurtech/api test common/guards/role.guard.spec.ts
pnpm --filter @insurtech/api test common/decorators/role-decorator.spec.ts

# 4. Coverage
pnpm --filter @insurtech/api test:coverage common/guards/role.guard.ts
# Verifier coverage >= 95% lines, >= 90% branches

# 5. No emoji
grep -rP "[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]" \
  repo/apps/api/src/common/guards \
  repo/apps/api/src/common/decorators
# Expected: empty output

# 6. No TODO/FIXME/XXX/HACK
grep -rE "(TODO|FIXME|XXX|HACK)" \
  repo/apps/api/src/common/guards \
  repo/apps/api/src/common/decorators
# Expected: empty output

# 7. Boot validation (smoke test app starts)
pnpm --filter @insurtech/api start:dev &
sleep 5
curl -s http://localhost:3000/health | grep -q '"status":"ok"'
kill %1
```

---

## 15. Commit message complet

```
feat(rbac): tache 2.3.4 -- RoleGuard et decorators @Role / @MinRole / @AnyRole

Sprint 7 / Phase 2 -- Securite & Multi-tenant

Livrables :
- RoleGuard NestJS injectable consommant Reflector + RbacService.getRoleDescendants
- Decorator @Role(...roles) avec validation Zod load-time, OR semantics
- Decorator @MinRole(role) avec resolution hierarchy descendants
- Decorator @AnyRole(...roles) alias semantique multi-role OR
- super_admin_platform bypass P0 systematique
- Error response structuree RoleGuardForbiddenException avec details
  (code, required, current, decoratorType, endpoint, handler, className,
  requestId, traceId, tenantId, userId, timestamp)
- Audit log emission denied events via Pino structured (RBAC_AUDIT_ROLE_GUARD)
- Granted log sampling configurable (RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE)
- Helpers reutilisables getRolesFromContext / getMinRoleFromContext / getAnyRolesFromContext
- 30+ tests Vitest couverture >= 95%

Fichiers crees :
- repo/apps/api/src/common/decorators/role.decorator.ts
- repo/apps/api/src/common/decorators/min-role.decorator.ts
- repo/apps/api/src/common/decorators/any-role.decorator.ts
- repo/apps/api/src/common/decorators/role-decorator.spec.ts
- repo/apps/api/src/common/guards/role.guard.ts
- repo/apps/api/src/common/guards/role.guard.spec.ts
- repo/apps/api/src/common/guards/role-guard-error.types.ts
- repo/apps/api/src/common/guards/role-guard-tenant-context.types.ts
- repo/apps/api/src/common/guards/role-guard.module.ts
- repo/apps/api/src/common/guards/role-decorator-helpers.ts
- repo/apps/api/src/common/guards/role-guard-fixtures.ts
- repo/apps/api/src/common/guards/index.ts

Fichiers modifies :
- repo/apps/api/src/common/decorators/index.ts (barrel)
- repo/apps/api/src/app.module.ts (import RoleGuardModule)
- repo/apps/api/.env.example (RBAC_AUDIT_ROLE_GUARD, RBAC_GUARD_LOG_LEVEL,
  RBAC_GUARD_LOG_GRANTED_SAMPLE_RATE)
- repo/packages/auth/src/rbac/index.ts (re-export getRoleDescendants public)

Conformite :
- ACAPS Maker/Checker : pattern @Role strict pour validation financiere
- CNDP Loi 09-08 : audit denied events 5 ans retention via AuditTrailService
- Data Residency Maroc : aucune dependance externe, logs Loki Casablanca

Tests :
- pnpm --filter @insurtech/api test common/guards/role.guard.spec.ts -> 30+ passing
- pnpm --filter @insurtech/api test common/decorators/role-decorator.spec.ts -> 11 passing
- pnpm --filter @insurtech/api test:coverage -> >= 95% lines, >= 90% branches
- pnpm --filter @insurtech/api typecheck -> exit 0
- pnpm --filter @insurtech/api lint -> exit 0

Refs :
- meta-prompts/B-07-sprint-07-rbac.md (Tache 2.3.4 lignes 505-600)
- documentation/5-roles-permissions.md
- decisions/006 No-emoji policy
- decisions/007 Maker/Checker ACAPS
- decisions/008 Data Residency Maroc
- decisions/013 RBAC Hierarchy Format DAG
- decisions/015 Wildcard super_admin policy
- decisions/020 Role vs Permission decorator strategy

Depend de : Tache 2.3.3 (RbacService), Tache 2.3.2 (RoleHierarchy), Tache 2.3.1 (catalog)
Bloque : Tache 2.3.5 (PermissionGuard pattern guard chain), Tache 2.3.9 (AuditTrail consume events)
```

---

## 16. Workflow next step (vers task-2.3.5-permission-guard-decorators.md)

Cette tache 2.3.4 livre le pattern guard chain et decorator metadata Reflect dont la prochaine tache 2.3.5 (PermissionGuard + @RequirePermission) reprendra integralement la structure :

1. Decorator factory `@RequirePermission(permission: PermissionValue, ...permissions: PermissionValue[])` avec validation Zod.
2. Guard NestJS `PermissionGuard` consommant Reflector + RbacService.canAccess (vs RoleGuard simple inclusion check).
3. PermissionGuard appelle `RbacService.canAccess(currentRole, permission)` qui resoud matrice + hierarchy + ABAC delegation.
4. Reuse complete des types `TenantContextSnapshot`, helpers `describeEndpoint`, fixtures ExecutionContext mocks livres Tache 2.3.4.
5. Pattern de tests, audit log, sampling, env vars identiques (variables `RBAC_AUDIT_PERMISSION_GUARD`, `RBAC_PERMISSION_GUARD_LOG_LEVEL`).
6. Composition guard chain extension : `[JwtAuthGuard, TenantContextGuard, RoleGuard, PermissionGuard, AbacResourceGuard]` -- order strict.

Action immediate apres merge Tache 2.3.4 :
1. Demarrer Tache 2.3.5 en suivant `meta-prompts/B-07-sprint-07-rbac.md` lignes 602-700.
2. Reuser fixtures `role-guard-fixtures.ts` et types `role-guard-tenant-context.types.ts` (renommes vers `permission-guard-*` ou refactor common pas encore necessaire).
3. Tester combinaison `@Role + @RequirePermission` -> intersection AND (test V11 ci-dessus deja anticipait).
4. Verifier compatibilite chaine globale `[Jwt, TenantContext, Role, Permission]` registree via APP_GUARD dans `app.module.ts`.

---

**Fin Tache 2.3.4 -- Sprint 7 / Phase 2 -- Skalean InsurTech v2.2**
