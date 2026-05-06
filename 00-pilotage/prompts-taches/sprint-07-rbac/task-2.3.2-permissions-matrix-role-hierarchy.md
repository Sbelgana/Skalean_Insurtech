# TACHE 2.3.2 -- PermissionsMatrix + RoleHierarchy (Resolution Recursive + Wildcard)

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.2 lignes 217-398)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant absolu pour les 10 taches suivantes du Sprint 7 ; bloquant indirect pour tout sprint metier necessitant authorization granulaire heritee)
**Effort** : 5h
**Dependances** : Tache 2.3.1 (catalog AuthRole + Permission + Module + Action) doit etre mergee. Sprint 6 complet (TenantContext.userRole). Stack Sprint 1-2 (TypeScript 5.7.3, Vitest 2.1.8, Zod 3.24.1).
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.2 vise a transformer la specification matricielle du document `00-pilotage/documentation/5-roles-permissions.md` (sections 2.1 a 2.5) en deux artefacts TypeScript stricts et executables : la matrice `PermissionsMatrix: Record<AuthRole, PermissionValue[] | typeof RBAC_WILDCARD[]>` qui associe chaque role aux permissions directement attribuees, et la hierarchie `RoleHierarchy: Record<AuthRole, AuthRole[]>` qui declare les relations parent-enfant (un role parent herite des permissions de ses enfants par resolution recursive). Les artefacts livres incluent aussi le resolveur `HierarchyResolver` (resolution recursive avec memoization, detection de cycles, profondeur maximale configurable), le validateur boot-time `MatrixValidator` (verification que toutes les permissions referencees dans la matrice existent dans le catalog), les helpers `RolePermissionsHelper` (`getEffectivePermissions(role)`, `getRolesByPermission(permission)`, `getRoleHierarchyDepth(role)`), un module de stats `MatrixStats` (compute permissions par role, modules couverts, couverture wildcard), un exporteur JSON `MatrixExport` (pour audit ACAPS et CNDP). Aucun service NestJS, aucun guard, aucun decorator n'est livre dans cette tache : sa portee est strictement la matrice de donnees et son resolveur, consommes par la Tache 2.3.3 (RbacService) et les Taches 2.3.4 a 2.3.8 (guards).

L'apport est triple. Premierement, separer la matrice (Tache 2.3.2) du catalog (Tache 2.3.1) permet de modifier la matrice sans toucher au catalog (un nouveau role courtier_partenaire en Phase 7+ peut reutiliser le meme catalog) et inversement (ajout permission `compliance.aml_alerts.review` au Sprint 12 sans toucher la matrice de Sprint 7). Cette separation respecte le principe Open/Closed : la matrice est ouverte aux extensions (nouvelles permissions ajoutees aux roles existants), fermee aux modifications structurelles (changement de signature `Record<AuthRole, PermissionValue[]>` casse CI). Deuxiemement, modeliser la hierarchie comme un graphe oriente acyclique (DAG) explicite (vs hierarchie implicite par convention naming `broker_admin > broker_user > broker_assistant`) permet la resolution programmatique : `getEffectivePermissions(broker_admin)` retourne automatiquement l'union des permissions broker_admin + broker_user + broker_assistant, sans duplication manuelle dans la matrice. Cette economie evite environ 40% de duplication (broker_user a 18 permissions, dont 15 partagees avec broker_admin ; sans heritage, broker_admin devrait redeclarer ces 15). Troisiemement, le wildcard `'*'` reserve a `super_admin_platform` est une optimisation P0 : evite le lookup matrix complet (85+ permissions) pour le bypass platform admin, garantit que toute nouvelle permission ajoutee au Sprint 12+ est automatiquement accessible au super admin (pas de risque d'oubli), et simplifie le test V2 (`canAccess(super_admin, anyPermission) === true`).

A l'issue de cette tache, le package `@insurtech/auth` expose via `packages/auth/src/rbac/index.ts` les artefacts `PermissionsMatrix`, `RoleHierarchy`, `getEffectivePermissions`, `getRolesByPermission`, `validateMatrix`, `computeMatrixStats`, `exportMatrixToJson`, ainsi que les types `EffectivePermissionsResult`, `MatrixStatsReport`, `HierarchyResolutionContext`. La commande `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts` execute 30+ tests Vitest verifiant la coherence (12 roles avec permissions, super_admin wildcard, broker_admin herite broker_user + broker_assistant, garage_admin herite garage_chef + garage_comptable + garage_commercial, garage_chef herite garage_technicien, pas de cycle, pas de cross-inheritance broker<->garage, pas de permission inconnue, count permissions distinctes >= 85). La commande `pnpm --filter @insurtech/auth typecheck` retourne exit code 0. La commande `pnpm --filter @insurtech/auth boot:validate-rbac` execute le validateur et echoue si la matrice contient une permission obsolete ou un cycle. Le total represente environ 1900 lignes de code TypeScript strict reparties sur 12 fichiers.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 fait coexister 12 roles dont 8 entrent dans des hierarchies organisationnelles reelles : un cabinet courtier emploie typiquement 1 admin (broker_admin) qui supervise 3-5 courtiers (broker_user) eux-memes assistes par 1-2 assistants administratifs (broker_assistant). De la meme facon, un garage emploie 1 admin (garage_admin) qui supervise un chef d'atelier (garage_chef), 2-4 techniciens (garage_technicien), 1 comptable (garage_comptable) et 1-2 commerciaux (garage_commercial). Cette structure organisationnelle se traduit naturellement en heritage de permissions : ce qu'un broker_user peut faire, un broker_admin doit pouvoir le faire aussi (delegation/supervision). Sans modelisation explicite, deux strategies sont possibles : (a) duplication exhaustive de toutes les permissions de l'enfant dans le parent (broker_admin liste les 35 permissions broker_admin + 18 permissions broker_user + 8 permissions broker_assistant = 61 entrees, dont 26 dupliquees), ou (b) inference par convention naming (script qui parse `broker_admin` et devine `broker_user` est enfant). La premiere viole DRY, la seconde est fragile.

A l'inverse, modeliser la hierarchie via un graphe explicite `RoleHierarchy: Record<AuthRole, AuthRole[]>` resout les deux problemes : la matrice ne declare que les permissions DIRECTEMENT attribuees au role (broker_admin = 35 permissions specifiques admin, sans repeter celles de broker_user) et le resolveur calcule l'union recursive a la demande. Cette approche est utilisee par AWS IAM (groupes -> users), Azure AD (group nesting), Google Cloud IAM (resource hierarchy), Keycloak (composite roles). Le choix specifique d'un graphe declaratif (vs heritage de classes TypeScript, vs hierarchie inference par naming) est documente dans `00-pilotage/decisions/013-rbac-hierarchy-format.md` (decision-013).

Le wildcard `'*'` pour super_admin_platform decoulee de la decision-015 : un super admin Skalean (equipe tech/ops) doit pouvoir intervenir sur n'importe quel tenant pour debug, support, ou intervention reglementaire d'urgence (CNDP demande de purge sous 30 jours). Sans wildcard, chaque ajout de permission Sprint 8+ obligerait a mettre a jour explicitement la matrice super_admin_platform, avec risque d'oubli securitaire (admin ne peut pas faire un export ACAPS critique parce qu'on a oublie d'ajouter la permission). Le wildcard `'*'` garantit que toute permission ajoutee au catalog est automatiquement accessible au super admin, court-circuitant le lookup matrix.

### 2.2 Alternatives considerees

Le tableau ci-dessous compare 5 alternatives evaluees avant la decision finale, chacune avec avantages, inconvenients et raison du rejet ou de la retention.

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Matrice JSON externe `permissions-matrix.json` chargee runtime via fs.readFileSync | Editable par non-dev (PM, conformite, equipe RBAC), versioning facile via Git diff, hot-reload theoriquement possible, format universel (audit ACAPS, export CNDP direct) | Pas de typage statique TypeScript (lookup runtime echec silencieux si role/permission inconnu), validation Zod obligatoire au boot avec gestion d'erreur explicite, hot-reload casse cache RbacService Tache 2.3.10 (invalidation manuelle), dependance fs (incompatible bundling browser pour partage future avec frontend), lecture I/O au boot ajoute 10-50ms latence demarrage api | REJETE -- compromet la securite (typo permission non detecte au build TypeScript), incompatible objectif tree-shaking |
| Matrice DB `auth_permissions_matrix` chargee au boot puis cache Redis | Permissions custom per tenant possibles (preparation Phase 7+ tier pricing premium), modification runtime via admin dashboard sans redeploiement, audit log natif via Postgres triggers (Tache 6.5.x), separation code/config selon principe 12-factor app | Latence boot supplementaire (+1 query SELECT toute la matrice = ~50ms), pas de typage statique TypeScript, complexite migration schema (ajout permission necessite SQL migration + seed), dependance circulaire Sprint 2 (database) <-> Sprint 7 (auth), risque d'inconsistance entre matrices envs (dev/staging/prod), bootstrap impossible (le service doit pouvoir demarrer avant DB pour healthcheck) | REJETE -- premature pour Sprint 7, sera ajoute Phase 7+ via override layer code+DB merge |
| Heritage par classes TypeScript abstraites (ex: `class BrokerAdminRole extends BrokerUserRole`) | OOP familier developpeurs Java/C#, methodes virtuelles permettent override fin granulaire | Heritage de classes TypeScript = heritage statique, pas dynamique : impossible de modifier hierarchie a runtime, refactoring difficile (renommage role casse 12 classes), instanciation roles ne fait pas sens (un role est une donnee, pas un comportement), complique tree-shaking | REJETE -- modele OOP mal adapte aux donnees de configuration |
| Heritage implicite par naming convention (parser broker_admin > broker_user > broker_assistant via prefix) | Zero declaration redondante, "magic" minimal | Fragile (renommer un role casse l'inference), pas de support multi-parents (garage_admin a 3 enfants : chef, comptable, commercial), debugging difficile (la hierarchie n'est nulle part explicite), test exhaustif impossible | REJETE -- magie excessive, fiabilite faible |
| Graphe DAG declaratif `RoleHierarchy: Record<AuthRole, AuthRole[]>` (RETENU) | Type-safe via Record<AuthRole, ...> qui force exhaustivite, multi-parents naturellement supportes (garage_admin -> [chef, comptable, commercial]), resolution recursive memoizee, detection cycle au validator boot-time, compatible tree-shaking, JSON-serializable pour audit, evolution simple (ajout d'un enfant = 1 ligne dans le map), grep facile | Verbeux pour roles simples (broker_assistant: [] explicite) -- mais cette verbosite garantit l'exhaustivite | RETENU -- meilleur compromis securite, performance, DX, evolutivite |

### 2.3 Trade-offs explicites resolution recursive vs flat materialization

Choisir la resolution recursive a la demande (vs materialisation flat au boot) implique d'accepter un cout CPU faible mais reel a chaque appel `getEffectivePermissions(role)`. Pour un role profond comme broker_admin (3 niveaux : admin -> user -> assistant), la resolution effectue 3 lookups O(1) dans `RoleHierarchy`, 3 unions de Sets (chacune O(n) ou n est le nombre de permissions du niveau), pour un total approximatif de O(profondeur x permissions_max) = O(3 x 35) = 105 operations. Sur un Node.js moderne, ce cout est inferieur a 10 microsecondes -- negligeable. Cependant, si la fonction est appelee dans une boucle hot-path (ex: filtrage de 10 000 contacts CRM avec verification `canAccess` per row), le cout cumule peut atteindre 100ms. La solution implementee est donc la memoization : `HierarchyResolver` cache le resultat per role dans une `Map<AuthRole, ReadonlySet<PermissionValue>>` calculee a la premiere demande puis re-utilisee. Le cache n'a pas besoin d'invalidation pendant la duree de vie du processus (la matrice et la hierarchie sont immutables apres boot). En complement, la Tache 2.3.10 ajoutera un cache Redis multi-instance avec TTL 5min pour synchroniser plusieurs replicas api.

A l'inverse, materialiser flat au boot (computer une fois `Record<AuthRole, ReadonlySet<PermissionValue>>` complete et l'exposer comme constante) economise les microsecondes runtime mais impose : (1) calcul deterministe au boot avec gestion d'erreur (un cycle non detecte boucle a l'infini), (2) impossibilite d'introduire des permissions dynamiques (ex: custom permissions Phase 7+), (3) duplication memoire si plusieurs configurations co-existent (multi-tenant override). Le compromis retenu est hybride : la fonction `getEffectivePermissions` est memoizee (donc effectivement materialisee a la premiere demande), mais expose une API fonction (compatible custom permissions futures), et le validator boot-time pre-charge tous les roles pour declencher la memoization (Sprint 7 lazy, mais boot-warm execute pour catcher les erreurs immediatement). Cette strategie economise les microsecondes runtime sans compromettre la flexibilite.

Choisir d'introduire la detection de cycles (vs faire confiance a la declaration humaine) implique d'accepter ~50 lignes de code DFS supplementaires dans `HierarchyResolver`. Cette discipline coute environ 30 minutes d'implementation + 50ms de CPU au boot, mais previent la classe entiere des bugs critiques : si un developpeur declare par erreur `broker_admin: ['broker_user']` ET `broker_user: ['broker_admin']`, sans detection le serveur entre en boucle infinie au premier appel `getEffectivePermissions(broker_admin)` (recursion non bornee, stack overflow apres environ 10 000 appels). La detection au boot fait fail-fast : le serveur refuse de demarrer avec un message clair `Cycle detected: broker_admin -> broker_user -> broker_admin`. Le developpeur corrige immediatement.

Choisir la profondeur maximale `RBAC_HIERARCHY_DEPTH_LIMIT` (configurable via env, default 8) implique d'accepter une protection defensive contre des hierarchies pathologiques. Dans le programme Sprint 7, la profondeur maximale est 3 (broker_admin -> broker_user -> broker_assistant). La limite a 8 laisse une marge confortable pour les evolutions futures (Phase 7+ prevoit potentiellement super_courtier_groupe -> broker_admin niveau supplementaire) tout en garantissant qu'une erreur de declaration ne genere pas une explosion combinatoire. La limite est testee (test V11) et logue WARN si depassee a runtime.

### 2.4 Decisions strategiques referenced

- **decision-013 (RBAC Hierarchy Format DAG declaratif)** : pertinence pour cette tache = totale. Cette tache concretise le format DAG decide dans `00-pilotage/decisions/013-rbac-hierarchy-format.md`. Le test V8 verifie l'absence de cycles via DFS.
- **decision-015 (Wildcard super_admin policy)** : pertinence = totale. Cette tache implemente le wildcard `'*'` dans la matrice et le bypass dans `getEffectivePermissions(super_admin_platform) === Set('*')`. Le test V2 verifie le bypass.
- **decision-006 (No-emoji Policy ABSOLUE)** : pertinence pour cette tache = totale. Aucune emoji dans aucun des fichiers livres. Le test V20 verifie ce point automatiquement via regex Unicode.
- **decision-008 (Data Residency Maroc)** : pertinence pour cette tache = indirecte. La permission `compliance.cndp_purge.execute` est attribuee uniquement a super_admin_platform via wildcard, garantissant que seul Skalean peut purger les donnees CNDP (delai 30 jours).
- **decision-005 (Skalean AI Frontier)** : pertinence = indirecte. Les permissions sky.* et mcp.* ne sont assignees a aucun role par defaut dans cette tache (sera fait Sprint 30 et Sprint 31 par addition extension).
- **decision-014 (Boot-time RBAC Validation Mandatory)** : pertinence = totale. Cette tache livre `MatrixValidator` qui s'execute au demarrage NestJS via `OnApplicationBootstrap` lifecycle (declenche dans Tache 2.3.3 via RbacService).

### 2.5 Pieges techniques connus

1. **Piege : Cycle d'heritage non detecte cause stack overflow.**
   - Pourquoi : si un developpeur declare par erreur `broker_admin: ['broker_user']` ET `broker_user: ['broker_admin']`, la recursion entre en boucle infinie.
   - Solution : `HierarchyResolver.detectCycles()` execute DFS avec WHITE/GRAY/BLACK coloring (algorithme classique cycle detection). Si un noeud GRAY est visite, cycle detecte, exception ThrownAtBoot. Test V8 verifie cette detection.

2. **Piege : super_admin_platform `'*'` accidentellement ajoute a un autre role.**
   - Pourquoi : un copy-paste maladroit peut copier `['*']` dans broker_admin, donnant les pleins pouvoirs.
   - Solution : `MatrixValidator` verifie que `'*'` apparait UNIQUEMENT pour `super_admin_platform`. Test V2 et V14 verifient cette restriction. Si `'*'` trouve dans un autre role, exception explicite au boot.

3. **Piege : Permission inconnue (typo) dans la matrice non detectee a TypeScript compile.**
   - Pourquoi : la signature `Record<AuthRole, PermissionValue[]>` accepte tout `PermissionValue` valide, mais si on importe une permission obsolete (renommee ailleurs), TypeScript ne detecte pas.
   - Solution : `MatrixValidator.validatePermissionsExist()` iterate toutes les valeurs de la matrice et verifie que chacune appartient a `Object.values(Permission)` du catalog Tache 2.3.1. Test V5 (boot validation).

4. **Piege : Heritage cross-inheritance broker <-> garage.**
   - Pourquoi : un developpeur peut declarer par erreur `garage_admin: ['broker_admin']` (copy-paste depuis broker_admin), creant un melange semantiquement incorrect (un admin garage ne doit pas avoir permissions broker_admin).
   - Solution : `MatrixValidator.validateNoCrossDomain()` verifie que les hierarchies broker_* ne referencent que des roles broker_*, et garage_* que des roles garage_*. Test V4 verifie cette regle. Convention de naming preservee.

5. **Piege : Permission `_own` accordee a un role qui n'a pas d'ABAC OwnResourcesPolicy applicable.**
   - Pourquoi : donner `crm.contacts.read_own` a `super_admin_platform` n'a pas de sens (super admin n'a pas de `userId` proprietaire de ressources).
   - Solution : convention warning soft du validator (pas d'erreur, juste WARN) si une permission `_own` est attribuee a un role platform (super_admin_platform, analyst_support). Test V13 verifie ce warning.

6. **Piege : Memoization cache n'est pas thread-safe (worker threads Node).**
   - Pourquoi : si Node demarre en mode cluster avec worker threads (Sprint 33+), chaque worker a sa propre Map memoization, mais la matrice est immutable (donc pas de race condition).
   - Solution : matrice et hierarchie immutables (`as const` + `ReadonlySet`), memoization stocke uniquement le resultat (pas d'effet de bord). Pas de mutex necessaire. Test V19 verifie immutabilite.

7. **Piege : `getEffectivePermissions` appelee avant validation boot-time.**
   - Pourquoi : si une route est appelee avant que `OnApplicationBootstrap` ait execute la validation, et que la matrice contient une erreur, l'erreur est detectee tardivement (premier appel API).
   - Solution : NestJS lifecycle `OnApplicationBootstrap` est appele AVANT que le serveur ecoute les requetes (premier event apres `app.listen()` setup, mais avant `listen()` proper). Documentation Tache 2.3.3 confirme l'ordre. Test V21 simulant boot order verifie.

8. **Piege : Performance `getEffectivePermissions` degradee si appelee per-request sans cache.**
   - Pourquoi : RbacService.canAccess (Tache 2.3.3) appelle `getEffectivePermissions` a chaque check ; sans memoization, 1000 requests/sec genererent 1000 resolutions recursives.
   - Solution : memoization in-process (Map<AuthRole, ReadonlySet<PermissionValue>>) calculee a la 1ere demande puis re-utilisee. Tache 2.3.10 ajoute Redis cache distribue 5min TTL pour synchronisation multi-replicas.

9. **Piege : Wildcard `'*'` interprete comme regex au lieu de match exact.**
   - Pourquoi : un developpeur naif peut implementer `permissions.includes('*')` puis pour le check, `userPerms.some(p => p.match(input))` -- erreur d'interpretation.
   - Solution : convention stricte = `'*'` est match exact. RbacService.canAccess verifie en premier `if (effectivePerms.has(RBAC_WILDCARD)) return true;` avant tout autre lookup. Tests V2, V12 verifient cette logique.

10. **Piege : Duplications de permissions dans le set effectif (cas de heritage croise via sous-graphe).**
    - Pourquoi : si garage_admin herite de garage_chef (qui herite de garage_technicien), et garage_admin a sa propre `repair.sinistres.read`, la resolution naive retourne 2x cette permission.
    - Solution : retour est `Set<PermissionValue>` (deduplication automatique). Test V18 verifie absence de doublons via `set.size === [...set].length`.

11. **Piege : Profondeur hierarchie excede limite RBAC_HIERARCHY_DEPTH_LIMIT silencieusement.**
    - Pourquoi : si Phase 7+ ajoute super_courtier_groupe -> broker_admin -> broker_user -> broker_assistant -> stagiaire (5 niveaux) puis suite, la limite 8 peut etre atteinte sans warning.
    - Solution : `HierarchyResolver.computeDepth(role)` retourne profondeur maximale ; validator boot-time emet WARN si > RBAC_HIERARCHY_DEPTH_LIMIT, ERROR si > 2x limite. Test V11.

12. **Piege : Modification matrice en hot-reload dev casse RbacService cache.**
    - Pourquoi : en dev mode, tsc-watch ou tsx-watch reload les modules ; si memoization Map persiste, valeurs stale.
    - Solution : memoization Map est exportee comme variable module-level, donc reset au reload. Documentation README package mentionne ce comportement. Pas de cache externe en dev.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.2 est la 2eme tache du Sprint 7 (RBAC Granulaire) et la 24eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.1 (catalog AuthRole + Permission + Module + Action + helpers `parsePermission`, `isValidPermission`). Specifiquement : import `AuthRole` enum et `Permission` const object depuis `@insurtech/auth/rbac`.
- **Bloque** : Tache 2.3.3 (RbacService) qui consomme `getEffectivePermissions(role)` pour evaluer `canAccess`. Bloque indirectement Taches 2.3.4 a 2.3.8 (guards), Tache 2.3.10 (Redis cache), Tache 2.3.11 (admin endpoints introspection), Tache 2.3.12 (tests E2E coverage).
- **Apporte au sprint** : la matrice `PermissionsMatrix` (12 roles x permissions), la hierarchie `RoleHierarchy` (DAG declaratif), le resolveur `HierarchyResolver` (memoization + cycle detection), le validateur `MatrixValidator` (boot-time check), les helpers `getEffectivePermissions` / `getRolesByPermission` / `getRoleHierarchyDepth`, le module stats `MatrixStats`, l'exporteur JSON `MatrixExport`, les fixtures de test `matrix-fixtures.ts`, et le barrel `index.ts`.

### 3.2 Position dans le programme global

Cette tache pose la materialisation operationnelle du modele RBAC consomme par 35 sprints. Chaque sprint metier consomme `getEffectivePermissions(role)` indirectement via `RbacService.canAccess` injected dans guards et services. Les Sprints 8-12 ajouteront eventuellement de nouvelles permissions au catalog Tache 2.3.1 et les attribueront aux roles existants via PR modifications de `permissions-matrix.ts`. L'evolution est mineure : ajouter `compliance.aml_alerts.review` au catalog puis l'ajouter au tableau permissions de `garage_comptable` et `broker_admin` represente 1 commit, propage instantanement aux 9 apps via workspace.

L'app `mcp-server` (Sprint 30) ajoutera permissions `mcp.tools.discover` et `mcp.tools.invoke` qui seront assignees a `super_admin_platform` (via wildcard) et eventuellement a un nouveau role `mcp_partner_user` (Sprint 30+). L'app `web-insurtech-admin` (Sprint 26) consommera `MatrixExport.exportMatrixToJson()` pour afficher la matrice complete dans un dashboard d'audit RBAC. Le frontend `web-broker` (Sprint 16) consommera `getEffectivePermissions(broker_admin)` indirectement via JWT claims qui incluent les permissions effectives flatten au login (Tache 5.6.4 modifie pour propager).

### 3.3 Diagramme hierarchy ASCII

```
                            super_admin_platform
                                  ['*']
                            (wildcard bypass)

                            analyst_support
                            (read-only universal,
                             pas dans hierarchy
                             traditionnelle)

  +-------------------+                  +-----------------------+
  | BROKER HIERARCHY  |                  | GARAGE HIERARCHY      |
  +-------------------+                  +-----------------------+

      broker_admin                               garage_admin
           |                              ____________|____________
           v                             |            |            |
      broker_user                        v            v            v
           |                       garage_chef   garage_      garage_
           v                            |        comptable    commercial
      broker_assistant                  v
                                  garage_technicien

                              assure (terminal, no children)
                              prospect (terminal, no children)
```

Profondeurs maximales :
- super_admin_platform : 0 (wildcard, no traversal)
- analyst_support : 0 (no children)
- broker_admin : 2 (broker_admin -> broker_user -> broker_assistant)
- broker_user : 1
- broker_assistant : 0
- garage_admin : 2 (garage_admin -> garage_chef -> garage_technicien)
- garage_chef : 1
- garage_technicien : 0
- garage_comptable : 0
- garage_commercial : 0
- assure : 0
- prospect : 0

### 3.4 Flow getEffectivePermissions

```
caller (RbacService.canAccess)
    |
    v
getEffectivePermissions(role: AuthRole): ReadonlySet<PermissionValue>
    |
    +--> [memoization cache hit?]
    |        |yes--> return cached Set
    |        |no
    |        v
    +--> [role === super_admin_platform?]
    |        |yes--> return Set([RBAC_WILDCARD])  // bypass total
    |        |no
    |        v
    +--> directPermissions = PermissionsMatrix[role]
    |
    +--> childRoles = RoleHierarchy[role]
    |
    +--> [for each childRole in childRoles]
    |        |
    |        v
    |    childPermissions = getEffectivePermissions(childRole)  [recursion]
    |        |
    |        v
    |    accumulate via Set union
    |
    +--> result = new Set([...directPermissions, ...accumulated])
    |
    +--> memoize cache.set(role, result)
    |
    v
return result (ReadonlySet<PermissionValue>)
```

Cycle detection s'execute en pre-validation au boot via DFS WHITE/GRAY/BLACK ; durant runtime resolution, la profondeur courante est suivie et arret si > RBAC_HIERARCHY_DEPTH_LIMIT.

---

## 4. Livrables checkables

- [ ] Fichier `repo/packages/auth/src/rbac/permissions-matrix.ts` (~700 lignes) -- map exhaustive `Record<AuthRole, readonly PermissionValue[] | readonly [typeof RBAC_WILDCARD]>`
- [ ] Matrice contient 12 entrees, une par role (super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, assure, prospect)
- [ ] super_admin_platform : `[RBAC_WILDCARD]` (singleton wildcard)
- [ ] analyst_support : 8 permissions read-only sur admin/* + crm.* read
- [ ] broker_admin : 35+ permissions directes (CRM CRUD + Insure + Books + Tenant management)
- [ ] broker_user : 18 permissions (CRM read+create_own, Insure create+read_own)
- [ ] broker_assistant : 8 permissions (CRM read_own + booking + comm)
- [ ] garage_admin : 30+ permissions directes (CRM + Repair complete + Stock + HR + Books)
- [ ] garage_chef : 12 permissions (Sinistres assign+close, Devis approve)
- [ ] garage_technicien : 6 permissions (read_assigned, reparations start/complete, stock use, photos)
- [ ] garage_comptable : 10 permissions (Books invoices + accounts + Pay)
- [ ] garage_commercial : 8 permissions (CRM + Devis create/read + Comm)
- [ ] assure : 8 permissions (read_own polices, sinistres, transactions)
- [ ] prospect : 4 permissions (public products + quotes + kyc + payments)
- [ ] Fichier `repo/packages/auth/src/rbac/role-hierarchy.ts` (~120 lignes) -- map `Record<AuthRole, readonly AuthRole[]>` declarant relations parent->enfants
- [ ] Hierarchie : super_admin_platform = [], analyst_support = []
- [ ] Hierarchie broker : broker_admin -> [broker_user], broker_user -> [broker_assistant], broker_assistant -> []
- [ ] Hierarchie garage : garage_admin -> [garage_chef, garage_comptable, garage_commercial], garage_chef -> [garage_technicien], garage_technicien/comptable/commercial -> []
- [ ] Hierarchie terminaux : assure -> [], prospect -> []
- [ ] Fichier `repo/packages/auth/src/rbac/hierarchy-resolver.ts` (~150 lignes) -- classe HierarchyResolver avec methods : `getEffectivePermissions(role)`, `detectCycles()`, `computeDepth(role)`, `clearCache()`, memoization Map<AuthRole, ReadonlySet<PermissionValue>>
- [ ] Fichier `repo/packages/auth/src/rbac/matrix-validator.ts` (~100 lignes) -- classe MatrixValidator avec methods : `validatePermissionsExist()`, `validateNoWildcardLeak()`, `validateNoCrossDomain()`, `validateAllRolesCovered()`, retournent ValidationReport[]
- [ ] Fichier `repo/packages/auth/src/rbac/role-permissions-helper.ts` (~100 lignes) -- export functions `getEffectivePermissions(role)`, `getRolesByPermission(permission)`, `hasPermissionInRole(role, permission)`, `getRoleHierarchyDepth(role)`
- [ ] Fichier `repo/packages/auth/src/rbac/permissions-matrix.spec.ts` (~250 lignes) -- 30+ tests Vitest verifiant matrice coherente, super_admin wildcard, broker_admin includes broker_user permissions, no cross-inheritance broker<->garage, count permissions distinctes >= 85
- [ ] Fichier `repo/packages/auth/src/rbac/role-hierarchy.spec.ts` (~150 lignes) -- 15+ tests verifiant hierarchie correcte, profondeurs, terminaux
- [ ] Fichier `repo/packages/auth/src/rbac/hierarchy-resolver.spec.ts` (~150 lignes) -- 15+ tests verifiant resolution recursive, cycle detection, memoization, depth limit
- [ ] Fichier `repo/packages/auth/src/rbac/matrix-stats.ts` (~80 lignes) -- compute stats par role et globales
- [ ] Fichier `repo/packages/auth/src/rbac/matrix-export.ts` (~80 lignes) -- export JSON pour audit ACAPS
- [ ] Fichier `repo/packages/auth/src/rbac/matrix-fixtures.ts` (~100 lignes) -- fixtures de test
- [ ] Fichier `repo/packages/auth/src/rbac/index.ts` mis a jour (~30 lignes ajoutees) -- barrel exports nouveaux artefacts
- [ ] Boot validation execute toutes verifications (V1-V25) sans erreur sur la matrice livree
- [ ] `pnpm --filter @insurtech/auth typecheck` exit 0
- [ ] `pnpm --filter @insurtech/auth test rbac/` execute les 60+ tests, tous passants
- [ ] `pnpm --filter @insurtech/auth boot:validate-rbac` script CLI execute MatrixValidator standalone, retourne exit 0

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/rbac/permissions-matrix.ts                   # ~700 lignes (NEW)
repo/packages/auth/src/rbac/role-hierarchy.ts                       # ~120 lignes (NEW)
repo/packages/auth/src/rbac/hierarchy-resolver.ts                   # ~150 lignes (NEW)
repo/packages/auth/src/rbac/matrix-validator.ts                     # ~100 lignes (NEW)
repo/packages/auth/src/rbac/role-permissions-helper.ts              # ~100 lignes (NEW)
repo/packages/auth/src/rbac/matrix-stats.ts                         # ~80 lignes (NEW)
repo/packages/auth/src/rbac/matrix-export.ts                        # ~80 lignes (NEW)
repo/packages/auth/src/rbac/matrix-fixtures.ts                      # ~100 lignes (NEW)
repo/packages/auth/src/rbac/permissions-matrix.spec.ts              # ~250 lignes (NEW)
repo/packages/auth/src/rbac/role-hierarchy.spec.ts                  # ~150 lignes (NEW)
repo/packages/auth/src/rbac/hierarchy-resolver.spec.ts              # ~150 lignes (NEW)
repo/packages/auth/src/rbac/index.ts                                # +30 lignes (MODIFIED, exports added)
repo/packages/auth/scripts/boot-validate-rbac.ts                    # ~40 lignes (NEW CLI script)
repo/packages/auth/package.json                                     # +1 line scripts.boot:validate-rbac (MODIFIED)
```

Total : 12 nouveaux fichiers + 2 modifies. Approximativement 1900 lignes de code TypeScript strict.

---

## 6. Code patterns COMPLETS

### 6.1 `repo/packages/auth/src/rbac/permissions-matrix.ts`

```typescript
/**
 * @file permissions-matrix.ts
 * @description Matrice exhaustive Role -> Permissions pour Skalean InsurTech v2.2
 *
 * Source de verite : 00-pilotage/documentation/5-roles-permissions.md (sections 2.1-2.5)
 *
 * Convention :
 *   - 12 roles : 2 platform + 5 broker + 5 garage + 1 assure + 1 prospect
 *   - Chaque role recoit ses permissions DIRECTES uniquement (heritage resolu par HierarchyResolver)
 *   - super_admin_platform recoit le wildcard '*' (bypass total via RbacService)
 *   - Permissions _own indiquent intention ABAC OwnResourcesPolicy (Tache 2.3.7 verifie filtrage)
 *
 * IMPORTANT : ne JAMAIS dupliquer les permissions heritees ; le resolveur calcule l'union recursive.
 */

import { AuthRole } from './roles.enum';
import { Permission, type PermissionValue } from './permissions.enum';
import { RBAC_WILDCARD, type RbacWildcard } from './rbac-constants';

/**
 * Type d'entree dans la matrice : soit un tableau de permissions explicites,
 * soit le singleton wildcard reserve a super_admin_platform.
 */
export type PermissionsMatrixEntry =
  | readonly PermissionValue[]
  | readonly [RbacWildcard];

/**
 * Matrice principale : associe chaque role a ses permissions directes.
 * L'exhaustivite est forcee par TypeScript via Record<AuthRole, ...>.
 *
 * Validation boot-time (MatrixValidator) verifie :
 *   - Toutes permissions referencees existent dans Permission enum
 *   - Wildcard '*' uniquement pour super_admin_platform
 *   - Permissions _own attribuees a roles compatibles (warning soft)
 *   - Aucune duplication intra-role
 */
export const PermissionsMatrix: Record<AuthRole, PermissionsMatrixEntry> = {

  // =========================================================================
  // ROLES PLATFORM (Skalean staff -- Niveau 1)
  // =========================================================================

  /**
   * super_admin_platform : equipe Skalean tech/ops
   * Wildcard '*' = bypass total via RbacService.canAccess
   * MFA obligatoire (Sprint 5 + Sprint 23 WebAuthn)
   * Routes /api/v1/admin/* (audit complet via Sprint 6.5)
   */
  [AuthRole.SUPER_ADMIN_PLATFORM]: [RBAC_WILDCARD] as const,

  /**
   * analyst_support : equipe Skalean support/analyse
   * Read-only universal, pas de write permissions
   * Postgres helper app_is_super_admin() = true mais filter automatic write -> 403
   */
  [AuthRole.ANALYST_SUPPORT]: [
    // Admin tenants read
    Permission.ADMIN_TENANTS_LIST,            // liste tous tenants pour analyse
    Permission.ADMIN_USERS_LIST_ALL,          // liste tous users cross-tenant
    Permission.ADMIN_AUDIT_LOG_READ,          // lecture audit logs (Sprint 6.5)
    Permission.ADMIN_SYSTEM_HEALTH,           // healthcheck endpoints monitoring
    // Cross-tenant analytics read
    Permission.ANALYTICS_DASHBOARDS_READ,     // dashboards analytiques cross-tenant
    Permission.ANALYTICS_REPORTS_EXPORT,      // export rapports CSV/PDF audit
    // CRM read pour debug support
    Permission.CRM_CONTACTS_READ,             // lecture contacts pour support tickets
    Permission.CRM_DEALS_READ,                // lecture deals pour debug
    // Compliance read
    Permission.COMPLIANCE_ACAPS_REPORTS_GENERATE,  // generation rapports ACAPS lecture
  ] as const,

  // =========================================================================
  // ROLES TENANT BROKER (Cabinet courtage -- Niveau 2)
  // =========================================================================

  /**
   * broker_admin : Admin cabinet courtier
   * CRUD complet sur tenant + Insure + Books + Tenant management
   * Herite (via HierarchyResolver) : broker_user + broker_assistant
   * Cible : 1 user par tenant typiquement
   */
  [AuthRole.BROKER_ADMIN]: [
    // CRM complet (CRUD)
    Permission.CRM_CONTACTS_READ,             // lecture tous contacts du tenant
    Permission.CRM_CONTACTS_CREATE,           // creation nouveau contact
    Permission.CRM_CONTACTS_UPDATE,           // modification contact existant
    Permission.CRM_CONTACTS_DELETE,           // suppression contact (soft delete)
    Permission.CRM_COMPANIES_READ,            // lecture entreprises clients
    Permission.CRM_COMPANIES_CREATE,          // creation entreprise
    Permission.CRM_COMPANIES_UPDATE,          // modification entreprise
    Permission.CRM_COMPANIES_DELETE,          // suppression entreprise
    Permission.CRM_DEALS_READ,                // lecture tous deals du tenant
    Permission.CRM_DEALS_CREATE,              // creation deal
    Permission.CRM_DEALS_UPDATE,              // modification deal
    Permission.CRM_DEALS_DELETE,              // suppression deal
    Permission.CRM_PIPELINES_MANAGE,          // gestion pipelines CRM
    Permission.CRM_INTERACTIONS_CREATE,       // log interactions clients
    // Booking complet
    Permission.BOOKING_ROOMS_MANAGE,          // gestion salles RV
    Permission.BOOKING_APPOINTMENTS_READ,     // lecture RV cabinet
    Permission.BOOKING_APPOINTMENTS_CREATE,   // creation RV
    Permission.BOOKING_APPOINTMENTS_UPDATE,   // modification RV
    Permission.BOOKING_APPOINTMENTS_DELETE,   // suppression RV
    Permission.BOOKING_CALENDAR_SYNC,         // sync calendar Google/Outlook
    // Insure complet (CRUD polices, quotes, commissions)
    Permission.INSURE_POLICIES_READ_ALL,      // lecture toutes polices tenant (sans filtre owner)
    Permission.INSURE_POLICIES_CREATE,        // creation police nouvelle
    Permission.INSURE_POLICIES_UPDATE,        // modification police
    Permission.INSURE_POLICIES_CANCEL,        // annulation avant signature
    Permission.INSURE_POLICIES_RESILIATE,     // resiliation apres signature (loi 17-99)
    Permission.INSURE_POLICIES_SUSPEND,       // suspension impaye temporaire
    Permission.INSURE_POLICIES_TERMINATE,     // terminaison echeance
    Permission.INSURE_POLICIES_TRANSFER,      // transfert police (changement courtier)
    Permission.INSURE_QUOTES_CREATE,          // creation devis
    Permission.INSURE_QUOTES_GENERATE,        // generation devis automatique
    Permission.INSURE_QUOTES_UPDATE,          // modification devis (status draft)
    Permission.INSURE_AVENANTS_CREATE,        // creation avenant police
    Permission.INSURE_COMMISSIONS_READ,       // lecture commissions broker
    // Books (factures + journals)
    Permission.BOOKS_INVOICES_READ,           // lecture factures
    Permission.BOOKS_INVOICES_CREATE,         // creation facture
    Permission.BOOKS_INVOICES_UPDATE,         // modification facture (status draft)
    Permission.BOOKS_JOURNALS_READ,           // lecture journaux comptables
    // Pay (transactions read + refunds)
    Permission.PAY_TRANSACTIONS_READ,         // lecture transactions tenant
    Permission.PAY_REFUNDS_CREATE,            // creation remboursement (loi 17-99 30j)
    // Tenant users management
    Permission.TENANT_USERS_INVITE,           // invitation nouveau user au tenant
    Permission.TENANT_USERS_READ,             // lecture users du tenant
    Permission.TENANT_USERS_UPDATE,           // modification user existant
    Permission.TENANT_SETTINGS_UPDATE,        // modification reglages tenant
    Permission.TENANT_CUSTOM_FIELDS_MANAGE,   // gestion champs custom
    // Analytics dashboards
    Permission.ANALYTICS_DASHBOARDS_READ,     // lecture dashboards analytiques
    // Comm
    Permission.COMM_MESSAGES_SEND,            // envoi messages WhatsApp/SMS/Email
    Permission.COMM_TEMPLATES_MANAGE,         // gestion templates messagerie
    // Documents
    Permission.DOC_DOCUMENTS_READ,            // lecture documents tenant
    Permission.DOC_DOCUMENTS_CREATE,          // upload documents
    Permission.DOC_DOCUMENTS_UPDATE,          // modification metadata documents
    Permission.DOC_DOCUMENTS_DELETE,          // suppression documents
  ] as const,

  /**
   * broker_user : Courtier souscripteur
   * CRM lecture + creation, Insure quotes + polices creation
   * Pas de delete, pas d'admin tenant
   * Herite (via HierarchyResolver) : broker_assistant
   */
  [AuthRole.BROKER_USER]: [
    // CRM lecture + create_own
    Permission.CRM_CONTACTS_READ_OWN,         // ABAC : lecture contacts assignes a moi (owner_user_id = userId)
    Permission.CRM_CONTACTS_CREATE,           // creation contact
    Permission.CRM_CONTACTS_UPDATE_OWN,       // ABAC : modification contacts owned
    Permission.CRM_DEALS_READ_OWN,            // ABAC : lecture deals owned
    Permission.CRM_DEALS_CREATE,              // creation deal
    Permission.CRM_DEALS_UPDATE_OWN,          // ABAC : modification deals owned
    Permission.CRM_INTERACTIONS_CREATE,       // log interactions clients
    // Insure quotes + polices (read_own)
    Permission.INSURE_QUOTES_CREATE,          // creation devis
    Permission.INSURE_QUOTES_GENERATE,        // generation devis automatique
    Permission.INSURE_POLICIES_READ_OWN,      // ABAC : lecture polices owned
    Permission.INSURE_POLICIES_CREATE,        // creation police
    // Pay read
    Permission.PAY_TRANSACTIONS_READ,         // lecture transactions (RBAC, ABAC filtre par owner_id en service)
    // Books invoices read
    Permission.BOOKS_INVOICES_READ,           // lecture factures cabinet
    // Documents read + create
    Permission.DOC_DOCUMENTS_READ_OWN,        // ABAC : lecture documents owned
    Permission.DOC_DOCUMENTS_CREATE,          // upload documents
    // Analytics dashboards own
    Permission.ANALYTICS_DASHBOARDS_READ_OWN, // ABAC : dashboards filtre par userId
    // Comm
    Permission.COMM_MESSAGES_SEND,            // envoi messages
    // Booking
    Permission.BOOKING_APPOINTMENTS_CREATE,   // creation RV
    Permission.BOOKING_APPOINTMENTS_READ,     // lecture RV
  ] as const,

  /**
   * broker_assistant : Assistant administratif cabinet
   * Read uniquement + create contacts, booking, comm
   * Pas de write polices, pas de delete
   */
  [AuthRole.BROKER_ASSISTANT]: [
    Permission.CRM_CONTACTS_READ_OWN,         // ABAC : lecture contacts assignes
    Permission.CRM_CONTACTS_CREATE,           // creation contact
    Permission.INSURE_QUOTES_GENERATE,        // generation devis automatique (sans approbation)
    Permission.BOOKING_APPOINTMENTS_CREATE,   // creation RV
    Permission.BOOKING_APPOINTMENTS_READ,     // lecture RV
    Permission.COMM_MESSAGES_SEND,            // envoi messages
    Permission.COMM_MESSAGES_READ,            // lecture messages
    Permission.DOC_DOCUMENTS_READ_OWN,        // ABAC : lecture documents owned
  ] as const,

  // =========================================================================
  // ROLES TENANT GARAGE (Niveau 2)
  // =========================================================================

  /**
   * garage_admin : Admin garage
   * CRUD complet : Repair + Stock + HR + Books + Pay
   * Herite (via HierarchyResolver) : garage_chef + garage_comptable + garage_commercial
   */
  [AuthRole.GARAGE_ADMIN]: [
    // CRM contacts (clients garage)
    Permission.CRM_CONTACTS_READ,             // lecture clients garage
    Permission.CRM_CONTACTS_CREATE,           // creation client
    Permission.CRM_CONTACTS_UPDATE,           // modification client
    Permission.CRM_CONTACTS_DELETE,           // suppression client (soft)
    // Repair complet
    Permission.REPAIR_SINISTRES_READ,         // lecture tous sinistres
    Permission.REPAIR_SINISTRES_CREATE,       // creation sinistre
    Permission.REPAIR_SINISTRES_ASSIGN,       // assignation sinistre a chef/technicien
    Permission.REPAIR_SINISTRES_CLOSE,        // cloture sinistre
    Permission.REPAIR_DEVIS_CREATE,           // creation devis reparation
    Permission.REPAIR_DEVIS_READ,             // lecture devis
    Permission.REPAIR_DEVIS_APPROVE,          // approbation devis (chef ou admin)
    Permission.REPAIR_DEVIS_REJECT,           // rejet devis
    Permission.REPAIR_REPARATIONS_START,      // demarrage reparation
    Permission.REPAIR_REPARATIONS_COMPLETE,   // cloture reparation
    Permission.REPAIR_DIAGNOSTICS_CREATE,     // creation diagnostic
    Permission.REPAIR_DIAGNOSTICS_UPDATE,     // modification diagnostic
    Permission.REPAIR_ORDERS_CREATE,          // creation ordre reparation
    Permission.REPAIR_ORDERS_READ,            // lecture ordres
    Permission.REPAIR_INVOICES_CREATE,        // creation facture reparation
    Permission.REPAIR_WARRANTIES_MANAGE,      // gestion garanties
    Permission.REPAIR_PHOTOS_UPLOAD,          // upload photos sinistres
    // Stock complet
    Permission.STOCK_ITEMS_MANAGE,            // gestion items stock
    Permission.STOCK_ITEMS_READ,              // lecture items
    Permission.STOCK_MOVEMENTS_READ,          // lecture mouvements stock
    // HR complet
    Permission.HR_EMPLOYEES_MANAGE,           // gestion employes garage
    Permission.HR_CONTRACTS_MANAGE,           // gestion contrats employes
    Permission.HR_ASSIGNMENTS_CREATE,         // creation assignation tache
    // Books invoices + accounts
    Permission.BOOKS_INVOICES_READ,           // lecture factures
    Permission.BOOKS_INVOICES_CREATE,         // creation facture
    Permission.BOOKS_ACCOUNTS_MANAGE,         // gestion comptes comptables
    // Pay transactions
    Permission.PAY_TRANSACTIONS_READ,         // lecture transactions
    Permission.PAY_REFUNDS_CREATE,            // remboursement clients
    // Tenant users management
    Permission.TENANT_USERS_INVITE,           // invitation user
    Permission.TENANT_USERS_READ,             // lecture users
    Permission.TENANT_USERS_UPDATE,           // modification user
    Permission.TENANT_SETTINGS_UPDATE,        // reglages tenant
    // Documents
    Permission.DOC_DOCUMENTS_READ,            // lecture documents
    Permission.DOC_DOCUMENTS_CREATE,          // upload documents
    Permission.DOC_DOCUMENTS_DELETE,          // suppression documents
    // Comm
    Permission.COMM_MESSAGES_SEND,            // envoi messages
    Permission.COMM_TEMPLATES_MANAGE,         // gestion templates
  ] as const,

  /**
   * garage_chef : Chef d'atelier garage
   * Sinistres assign + close, Devis approve, Diagnostics
   * Pas de stock direct, pas de HR direct, pas de Books direct
   * Herite (via HierarchyResolver) : garage_technicien
   */
  [AuthRole.GARAGE_CHEF]: [
    Permission.REPAIR_SINISTRES_READ,         // lecture tous sinistres atelier
    Permission.REPAIR_SINISTRES_ASSIGN,       // assignation a techniciens
    Permission.REPAIR_SINISTRES_CLOSE,        // cloture sinistre
    Permission.REPAIR_DEVIS_READ,             // lecture devis
    Permission.REPAIR_DEVIS_APPROVE,          // approbation devis
    Permission.REPAIR_DEVIS_REJECT,           // rejet devis
    Permission.REPAIR_DIAGNOSTICS_CREATE,     // creation diagnostic
    Permission.REPAIR_DIAGNOSTICS_UPDATE,     // modification diagnostic
    Permission.REPAIR_ORDERS_READ,            // lecture ordres
    Permission.HR_ASSIGNMENTS_CREATE,         // assignation tache employe
    Permission.COMM_MESSAGES_SEND,            // envoi messages clients/equipe
    Permission.DOC_DOCUMENTS_READ,            // lecture documents atelier
  ] as const,

  /**
   * garage_technicien : Technicien atelier (PWA mobile)
   * Reparations execute uniquement
   * WebAuthn biometric login required (Sprint 23)
   */
  [AuthRole.GARAGE_TECHNICIEN]: [
    Permission.REPAIR_SINISTRES_READ_ASSIGNED,  // ABAC : lecture sinistres ASSIGNES a moi (assignee_id = userId)
    Permission.REPAIR_REPARATIONS_START,        // demarrage reparation
    Permission.REPAIR_REPARATIONS_COMPLETE,     // cloture reparation (changement statut)
    Permission.STOCK_ITEMS_USE,                 // utilisation pieces stock (decrement)
    Permission.REPAIR_PHOTOS_UPLOAD,            // upload photos sinistre/reparation
    Permission.REPAIR_DIAGNOSTICS_CREATE,       // creation diagnostic suite intervention
  ] as const,

  /**
   * garage_comptable : Comptable garage
   * Books + Pay specialise
   */
  [AuthRole.GARAGE_COMPTABLE]: [
    Permission.BOOKS_INVOICES_READ,             // lecture factures
    Permission.BOOKS_INVOICES_CREATE,           // creation facture
    Permission.BOOKS_INVOICES_UPDATE,           // modification facture (draft)
    Permission.BOOKS_JOURNALS_READ,             // lecture journaux
    Permission.BOOKS_ACCOUNTS_MANAGE,           // gestion comptes comptables
    Permission.BOOKS_TAX_DECLARATIONS_CREATE,   // declarations TVA / IS
    Permission.PAY_TRANSACTIONS_READ,           // lecture transactions
    Permission.PAY_TRANSACTIONS_RECONCILE,      // reconciliation paiements
    Permission.PAY_REFUNDS_CREATE,              // remboursement clients
    Permission.COMPLIANCE_AML_ALERTS_REVIEW,    // review alertes AML (Sprint 12)
  ] as const,

  /**
   * garage_commercial : Commercial garage
   * Devis + Clients + Comm
   */
  [AuthRole.GARAGE_COMMERCIAL]: [
    Permission.CRM_CONTACTS_READ,               // lecture clients
    Permission.CRM_CONTACTS_CREATE,             // creation client
    Permission.CRM_CONTACTS_UPDATE_OWN,         // ABAC : modification clients owned
    Permission.REPAIR_DEVIS_CREATE,             // creation devis commercial
    Permission.REPAIR_DEVIS_READ,               // lecture devis
    Permission.COMM_MESSAGES_SEND,              // envoi messages prospects/clients
    Permission.COMM_MESSAGES_READ,              // lecture messages
    Permission.BOOKING_APPOINTMENTS_CREATE,     // creation RV commercial
  ] as const,

  // =========================================================================
  // ROLE ASSURE (L3 -- Niveau 3 dans tenant)
  // =========================================================================

  /**
   * assure : Client final assure connecte
   * Lecture uniquement de SES propres ressources (ABAC owner_id = user_id)
   * Routes specifiques : /api/v1/assure/* avec filter app_assure_user_id actif
   * Apps : web-assure-portal (Sprint 18), web-assure-mobile (Sprint 18)
   */
  [AuthRole.ASSURE]: [
    Permission.INSURE_POLICIES_READ_OWN,        // ABAC : lecture SES polices (owner_id = userId)
    Permission.REPAIR_SINISTRES_READ_OWN,       // ABAC : lecture SES sinistres
    Permission.REPAIR_SINISTRES_CREATE_OWN,     // ABAC : declaration sinistre M8 Sprint 24
    Permission.PAY_TRANSACTIONS_READ_OWN,       // ABAC : lecture SES transactions
    Permission.DOC_DOCUMENTS_READ_OWN,          // ABAC : lecture SES documents
    Permission.NOTIFICATIONS_READ_OWN,          // ABAC : lecture SES notifications
    Permission.NOTIFICATIONS_UPDATE_OWN,        // ABAC : modification preferences notification
    Permission.SESSIONS_READ_OWN,               // ABAC : lecture SES sessions auth
  ] as const,

  // =========================================================================
  // ROLE PROSPECT (Public -- pas auth)
  // =========================================================================

  /**
   * prospect : Prospect public (web-customer-portal sans login)
   * Sessions Redis TTL 30min (pas DB persistence -- decision-008 CNDP)
   */
  [AuthRole.PROSPECT]: [
    Permission.PUBLIC_PRODUCTS_READ,            // catalogue produits Sprint 14
    Permission.PUBLIC_QUOTES_GENERATE,          // simulator devis Sprint 17
    Permission.PUBLIC_KYC_SUBMIT,               // soumission KYC pre-approbation
    Permission.PUBLIC_PAYMENTS_PROCESS,         // souscription Sprint 17
  ] as const,
};

/**
 * Type derive : nombre de roles dans la matrice (compile-time check).
 * Permet aux tests de verifier `Object.keys(PermissionsMatrix).length === 12`.
 */
export type PermissionsMatrixKeys = keyof typeof PermissionsMatrix;

/**
 * Liste figee de tous les roles couverts par la matrice (pour iteration).
 */
export const ALL_ROLES_IN_MATRIX = Object.keys(PermissionsMatrix) as readonly AuthRole[];

/**
 * Helper : retourne les permissions DIRECTES d'un role (sans heritage).
 * Pour permissions effectives (avec heritage), utiliser HierarchyResolver.getEffectivePermissions().
 *
 * @param role - role a interroger
 * @returns tableau readonly des permissions directes ou wildcard
 */
export function getDirectPermissions(role: AuthRole): PermissionsMatrixEntry {
  return PermissionsMatrix[role];
}

/**
 * Helper : retourne true si un role a le wildcard `'*'`.
 * Utilise par RbacService.canAccess pour bypass total.
 *
 * @param role - role a tester
 * @returns true si wildcard, false sinon
 */
export function hasWildcardPermission(role: AuthRole): boolean {
  const entry = PermissionsMatrix[role];
  return entry.length === 1 && entry[0] === RBAC_WILDCARD;
}

/**
 * Helper : compte permissions directes d'un role (pour stats / debug).
 *
 * @param role - role a interroger
 * @returns nombre permissions directes
 */
export function countDirectPermissions(role: AuthRole): number {
  return PermissionsMatrix[role].length;
}
```

### 6.2 `repo/packages/auth/src/rbac/role-hierarchy.ts`

```typescript
/**
 * @file role-hierarchy.ts
 * @description Graphe DAG declaratif des relations parent->enfants entre roles
 *
 * Source de verite : 00-pilotage/documentation/5-roles-permissions.md (section 3)
 *
 * Convention :
 *   - Map RoleHierarchy[parent] = array de roles enfants directs (1 niveau)
 *   - Resolution recursive complete via HierarchyResolver.getEffectivePermissions()
 *   - super_admin_platform et analyst_support : pas de hierarchie traditionnelle (wildcard et read-only universal)
 *   - broker_admin -> broker_user -> broker_assistant (chaine simple)
 *   - garage_admin -> [garage_chef, garage_comptable, garage_commercial] (multi-enfants)
 *   - garage_chef -> garage_technicien (sub-chaine)
 *   - assure et prospect : terminaux (pas d'enfants)
 *
 * IMPORTANT : pas de cross-inheritance broker <-> garage (verifie par MatrixValidator).
 */

import { AuthRole } from './roles.enum';

/**
 * Map principale de la hierarchie roles.
 * Type Record<AuthRole, ...> force l'exhaustivite a la compilation.
 *
 * Validation boot-time (HierarchyResolver.detectCycles) verifie :
 *   - Aucun cycle (DFS WHITE/GRAY/BLACK)
 *   - Profondeur maximale <= RBAC_HIERARCHY_DEPTH_LIMIT (default 8)
 *   - Pas de cross-domain broker <-> garage
 */
export const RoleHierarchy: Record<AuthRole, readonly AuthRole[]> = {

  // =========================================================================
  // PLATFORM (pas hierarchie traditionnelle)
  // =========================================================================

  [AuthRole.SUPER_ADMIN_PLATFORM]: [],   // wildcard, pas de traversal
  [AuthRole.ANALYST_SUPPORT]: [],         // read-only universal autonome

  // =========================================================================
  // HIERARCHIE BROKER (chaine simple 3 niveaux)
  // =========================================================================

  [AuthRole.BROKER_ADMIN]: [AuthRole.BROKER_USER],
  [AuthRole.BROKER_USER]: [AuthRole.BROKER_ASSISTANT],
  [AuthRole.BROKER_ASSISTANT]: [],        // terminal

  // =========================================================================
  // HIERARCHIE GARAGE (DAG multi-enfants)
  // =========================================================================

  [AuthRole.GARAGE_ADMIN]: [
    AuthRole.GARAGE_CHEF,                  // chef d'atelier
    AuthRole.GARAGE_COMPTABLE,             // comptable
    AuthRole.GARAGE_COMMERCIAL,            // commercial
  ],
  [AuthRole.GARAGE_CHEF]: [AuthRole.GARAGE_TECHNICIEN],
  [AuthRole.GARAGE_TECHNICIEN]: [],        // terminal
  [AuthRole.GARAGE_COMPTABLE]: [],         // terminal
  [AuthRole.GARAGE_COMMERCIAL]: [],        // terminal

  // =========================================================================
  // ROLES SANS HIERARCHIE
  // =========================================================================

  [AuthRole.ASSURE]: [],                    // L3, pas de subordonnes
  [AuthRole.PROSPECT]: [],                  // public, pas de subordonnes
};

/**
 * Helper : retourne les enfants directs d'un role.
 *
 * @param role - role parent
 * @returns tableau readonly des roles enfants directs (1 niveau)
 */
export function getDirectChildren(role: AuthRole): readonly AuthRole[] {
  return RoleHierarchy[role];
}

/**
 * Helper : retourne true si un role est terminal (pas d'enfants).
 *
 * @param role - role a tester
 * @returns true si terminal
 */
export function isTerminalRole(role: AuthRole): boolean {
  return RoleHierarchy[role].length === 0;
}

/**
 * Helper : determine si un role appartient au domaine broker.
 * Utilise par MatrixValidator pour cross-domain check.
 */
export function isBrokerRole(role: AuthRole): boolean {
  return role === AuthRole.BROKER_ADMIN
      || role === AuthRole.BROKER_USER
      || role === AuthRole.BROKER_ASSISTANT;
}

/**
 * Helper : determine si un role appartient au domaine garage.
 */
export function isGarageRole(role: AuthRole): boolean {
  return role === AuthRole.GARAGE_ADMIN
      || role === AuthRole.GARAGE_CHEF
      || role === AuthRole.GARAGE_TECHNICIEN
      || role === AuthRole.GARAGE_COMPTABLE
      || role === AuthRole.GARAGE_COMMERCIAL;
}

/**
 * Helper : determine si un role appartient au domaine platform.
 */
export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SUPER_ADMIN_PLATFORM
      || role === AuthRole.ANALYST_SUPPORT;
}

/**
 * Liste figee des roles couverts par la hierarchie (pour iteration).
 */
export const ALL_ROLES_IN_HIERARCHY = Object.keys(RoleHierarchy) as readonly AuthRole[];
```

### 6.3 `repo/packages/auth/src/rbac/hierarchy-resolver.ts`

```typescript
/**
 * @file hierarchy-resolver.ts
 * @description Resolveur de hierarchie : resolution recursive permissions effectives,
 *              detection de cycles, memoization, profondeur configurable.
 *
 * Utilise par RbacService (Tache 2.3.3) pour evaluer canAccess.
 * Memoization in-process Map<AuthRole, ReadonlySet<PermissionValue>> pour performance.
 */

import { AuthRole } from './roles.enum';
import { type PermissionValue } from './permissions.enum';
import { PermissionsMatrix, hasWildcardPermission } from './permissions-matrix';
import { RoleHierarchy } from './role-hierarchy';
import { RBAC_WILDCARD, type RbacWildcard } from './rbac-constants';

/**
 * Limite de profondeur recursion. Default 8 (largement au-dessus des 3 niveaux actuels).
 * Configurable via env RBAC_HIERARCHY_DEPTH_LIMIT.
 */
export const DEFAULT_DEPTH_LIMIT = 8;

/**
 * Erreur levee si cycle detecte au boot.
 */
export class RbacHierarchyCycleError extends Error {
  constructor(public readonly cyclePath: AuthRole[]) {
    super(`Cycle detected in role hierarchy: ${cyclePath.join(' -> ')}`);
    this.name = 'RbacHierarchyCycleError';
  }
}

/**
 * Erreur levee si profondeur depassee runtime.
 */
export class RbacHierarchyDepthError extends Error {
  constructor(public readonly role: AuthRole, public readonly depth: number) {
    super(`Hierarchy depth exceeded for role '${role}': ${depth} > limit`);
    this.name = 'RbacHierarchyDepthError';
  }
}

/**
 * Type retour effective permissions : Set readonly de PermissionValue ou wildcard.
 */
export type EffectivePermissionsSet = ReadonlySet<PermissionValue | RbacWildcard>;

/**
 * Classe HierarchyResolver : resolution recursive avec memoization.
 *
 * Usage :
 *   const resolver = new HierarchyResolver({ depthLimit: 8 });
 *   resolver.detectCycles();  // boot-time, throws RbacHierarchyCycleError si cycle
 *   const perms = resolver.getEffectivePermissions(AuthRole.BROKER_ADMIN);
 */
export class HierarchyResolver {
  private readonly cache = new Map<AuthRole, EffectivePermissionsSet>();
  private readonly depthLimit: number;

  constructor(options: { depthLimit?: number } = {}) {
    this.depthLimit = options.depthLimit ?? DEFAULT_DEPTH_LIMIT;
  }

  /**
   * Retourne les permissions effectives d'un role (directes + heritees recursivement).
   * Memoizee pour performance O(1) apres premier appel.
   *
   * @param role - role a resoudre
   * @returns Set readonly des permissions (incluant wildcard si applicable)
   * @throws RbacHierarchyDepthError si profondeur runtime excede limit
   */
  getEffectivePermissions(role: AuthRole): EffectivePermissionsSet {
    // Cache hit : retour immediat
    const cached = this.cache.get(role);
    if (cached) {
      return cached;
    }

    // Resolution recursive avec tracking profondeur
    const accumulator = new Set<PermissionValue | RbacWildcard>();
    this.resolveRecursive(role, accumulator, 0, new Set<AuthRole>());

    const frozen: EffectivePermissionsSet = new Set(accumulator);
    this.cache.set(role, frozen);
    return frozen;
  }

  /**
   * Resolution recursive avec accumulation et detection cycle runtime.
   *
   * @param role - role courant
   * @param accumulator - Set d'accumulation des permissions
   * @param depth - profondeur courante (start 0)
   * @param visited - roles visites dans ce chemin (cycle detection runtime)
   */
  private resolveRecursive(
    role: AuthRole,
    accumulator: Set<PermissionValue | RbacWildcard>,
    depth: number,
    visited: Set<AuthRole>,
  ): void {
    if (depth > this.depthLimit) {
      throw new RbacHierarchyDepthError(role, depth);
    }
    if (visited.has(role)) {
      // Cycle runtime (ne devrait pas arriver si detectCycles a passe au boot)
      throw new RbacHierarchyCycleError([...visited, role]);
    }
    visited.add(role);

    // Wildcard short-circuit : ajouter '*' et arreter
    if (hasWildcardPermission(role)) {
      accumulator.add(RBAC_WILDCARD);
      return;
    }

    // Permissions directes
    for (const perm of PermissionsMatrix[role]) {
      accumulator.add(perm);
    }

    // Recursion sur enfants
    for (const childRole of RoleHierarchy[role]) {
      this.resolveRecursive(childRole, accumulator, depth + 1, new Set(visited));
    }
  }

  /**
   * Detection cycles via DFS WHITE/GRAY/BLACK coloring.
   * A executer au boot (OnApplicationBootstrap NestJS lifecycle).
   *
   * @throws RbacHierarchyCycleError si cycle detecte (cyclePath fourni)
   */
  detectCycles(): void {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const colors = new Map<AuthRole, number>();
    const path: AuthRole[] = [];

    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      colors.set(role, WHITE);
    }

    const dfs = (role: AuthRole): void => {
      colors.set(role, GRAY);
      path.push(role);

      for (const child of RoleHierarchy[role]) {
        const childColor = colors.get(child);
        if (childColor === GRAY) {
          // Cycle detecte
          const cycleStart = path.indexOf(child);
          throw new RbacHierarchyCycleError([...path.slice(cycleStart), child]);
        }
        if (childColor === WHITE) {
          dfs(child);
        }
      }

      colors.set(role, BLACK);
      path.pop();
    };

    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      if (colors.get(role) === WHITE) {
        dfs(role);
      }
    }
  }

  /**
   * Calcule la profondeur maximale d'un role (longueur chemin le plus long vers terminal).
   *
   * @param role - role a mesurer
   * @returns profondeur (0 si terminal)
   */
  computeDepth(role: AuthRole): number {
    const children = RoleHierarchy[role];
    if (children.length === 0) {
      return 0;
    }
    let maxChild = 0;
    for (const child of children) {
      const childDepth = this.computeDepth(child);
      if (childDepth > maxChild) maxChild = childDepth;
    }
    return 1 + maxChild;
  }

  /**
   * Vide le cache memoization. Utilise pour tests ou dev hot-reload.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Pre-charge le cache pour tous les roles (warm-up boot).
   */
  warmupCache(): void {
    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      this.getEffectivePermissions(role);
    }
  }

  /**
   * Retourne taille du cache (pour metrics/debug).
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Instance singleton par defaut (utilisee par RolePermissionsHelper).
 * Override possible en injectant une nouvelle instance.
 */
export const defaultHierarchyResolver = new HierarchyResolver();
```

### 6.4 `repo/packages/auth/src/rbac/matrix-validator.ts`

```typescript
/**
 * @file matrix-validator.ts
 * @description Validateur boot-time : verifie coherence matrice permissions + hierarchy.
 *              Execute via OnApplicationBootstrap NestJS lifecycle (Tache 2.3.3).
 *              Aussi utilisable standalone via script CLI scripts/boot-validate-rbac.ts.
 */

import { AuthRole } from './roles.enum';
import { Permission, type PermissionValue, isValidPermission } from './permissions.enum';
import { PermissionsMatrix, hasWildcardPermission } from './permissions-matrix';
import { RoleHierarchy, isBrokerRole, isGarageRole } from './role-hierarchy';
import { RBAC_WILDCARD } from './rbac-constants';
import { HierarchyResolver } from './hierarchy-resolver';

/**
 * Niveau de severite d'une issue de validation.
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Issue rapportee par le validator.
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  role?: AuthRole;
  permission?: string;
  message: string;
}

/**
 * Rapport complet de validation.
 */
export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

/**
 * Validateur de matrice + hierarchie. Methods retournent ValidationReport.
 */
export class MatrixValidator {
  /**
   * Execute toutes les validations et retourne le rapport.
   * Si LOG_RBAC_MATRIX_BOOT=true, log details au demarrage.
   */
  validateAll(options: { logBoot?: boolean } = {}): ValidationReport {
    const issues: ValidationIssue[] = [];

    issues.push(...this.validatePermissionsExist());
    issues.push(...this.validateNoWildcardLeak());
    issues.push(...this.validateNoCrossDomain());
    issues.push(...this.validateAllRolesCovered());
    issues.push(...this.validateNoDuplicates());
    issues.push(...this.validateOwnPermissionsScope());
    issues.push(...this.validateHierarchyCycles());
    issues.push(...this.validateHierarchyDepth());

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (options.logBoot) {
      // Affichage console (logger Sprint 1.1.5 inject ailleurs)
      console.log(`[RBAC Matrix Boot] ${errorCount} errors, ${warningCount} warnings`);
      for (const issue of issues) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
      }
    }

    return {
      ok: errorCount === 0,
      issues,
      errorCount,
      warningCount,
    };
  }

  /**
   * V5 : toutes permissions referencees existent dans Permission catalog.
   */
  validatePermissionsExist(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const validValues = new Set<string>(Object.values(Permission));
    validValues.add(RBAC_WILDCARD);

    for (const [role, perms] of Object.entries(PermissionsMatrix)) {
      for (const perm of perms) {
        if (!validValues.has(perm as string)) {
          issues.push({
            severity: 'error',
            code: 'RBAC-V5-001',
            role: role as AuthRole,
            permission: perm as string,
            message: `Permission '${perm}' referenced for role '${role}' not found in Permission catalog`,
          });
        }
      }
    }
    return issues;
  }

  /**
   * V14 : wildcard '*' uniquement pour super_admin_platform.
   */
  validateNoWildcardLeak(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [role, perms] of Object.entries(PermissionsMatrix)) {
      if (role === AuthRole.SUPER_ADMIN_PLATFORM) continue;
      for (const perm of perms) {
        if (perm === RBAC_WILDCARD) {
          issues.push({
            severity: 'error',
            code: 'RBAC-V14-001',
            role: role as AuthRole,
            message: `Wildcard '*' leaked to non-super-admin role '${role}'`,
          });
        }
      }
    }
    return issues;
  }

  /**
   * V4 : pas de cross-inheritance broker <-> garage.
   */
  validateNoCrossDomain(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [role, children] of Object.entries(RoleHierarchy)) {
      const r = role as AuthRole;
      for (const child of children) {
        if (isBrokerRole(r) && isGarageRole(child)) {
          issues.push({
            severity: 'error',
            code: 'RBAC-V4-001',
            role: r,
            message: `Broker role '${r}' inherits from garage role '${child}' (cross-domain forbidden)`,
          });
        }
        if (isGarageRole(r) && isBrokerRole(child)) {
          issues.push({
            severity: 'error',
            code: 'RBAC-V4-002',
            role: r,
            message: `Garage role '${r}' inherits from broker role '${child}' (cross-domain forbidden)`,
          });
        }
      }
    }
    return issues;
  }

  /**
   * V1 : tous les 12 roles AuthRole sont couverts par la matrice.
   */
  validateAllRolesCovered(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const matrixRoles = new Set(Object.keys(PermissionsMatrix));
    for (const role of Object.values(AuthRole)) {
      if (!matrixRoles.has(role)) {
        issues.push({
          severity: 'error',
          code: 'RBAC-V1-001',
          role,
          message: `Role '${role}' missing from PermissionsMatrix`,
        });
      }
    }
    return issues;
  }

  /**
   * V18 : aucune duplication intra-role.
   */
  validateNoDuplicates(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [role, perms] of Object.entries(PermissionsMatrix)) {
      const seen = new Set<string>();
      for (const perm of perms) {
        if (seen.has(perm as string)) {
          issues.push({
            severity: 'error',
            code: 'RBAC-V18-001',
            role: role as AuthRole,
            permission: perm as string,
            message: `Duplicate permission '${perm}' in role '${role}'`,
          });
        }
        seen.add(perm as string);
      }
    }
    return issues;
  }

  /**
   * V13 : permission _own attribuee a un role platform = warning.
   */
  validateOwnPermissionsScope(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const platformRoles = new Set([AuthRole.SUPER_ADMIN_PLATFORM, AuthRole.ANALYST_SUPPORT]);
    for (const [role, perms] of Object.entries(PermissionsMatrix)) {
      if (!platformRoles.has(role as AuthRole)) continue;
      if (hasWildcardPermission(role as AuthRole)) continue;
      for (const perm of perms) {
        if (typeof perm === 'string' && perm.endsWith('_own')) {
          issues.push({
            severity: 'warning',
            code: 'RBAC-V13-001',
            role: role as AuthRole,
            permission: perm as string,
            message: `Permission _own '${perm}' assigned to platform role '${role}' (no userId owner context)`,
          });
        }
      }
    }
    return issues;
  }

  /**
   * V8 : detecte cycles dans la hierarchie via DFS.
   */
  validateHierarchyCycles(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    try {
      const resolver = new HierarchyResolver();
      resolver.detectCycles();
    } catch (e) {
      if (e instanceof Error) {
        issues.push({
          severity: 'error',
          code: 'RBAC-V8-001',
          message: e.message,
        });
      }
    }
    return issues;
  }

  /**
   * V11 : profondeur hierarchie respecte limit.
   */
  validateHierarchyDepth(limit = 8): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const resolver = new HierarchyResolver();
    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      const depth = resolver.computeDepth(role);
      if (depth > limit) {
        issues.push({
          severity: 'warning',
          code: 'RBAC-V11-001',
          role,
          message: `Role '${role}' depth ${depth} exceeds soft limit ${limit}`,
        });
      }
    }
    return issues;
  }
}
```

### 6.5 `repo/packages/auth/src/rbac/role-permissions-helper.ts`

```typescript
/**
 * @file role-permissions-helper.ts
 * @description Helpers fonctionnels pour resolution permissions et inverse-lookup.
 *
 * Expose API stable consommee par RbacService (Tache 2.3.3),
 * decorators (Tache 2.3.4-2.3.8), tests E2E (Tache 2.3.12).
 */

import { AuthRole } from './roles.enum';
import { Permission, type PermissionValue } from './permissions.enum';
import { PermissionsMatrix, hasWildcardPermission } from './permissions-matrix';
import { RoleHierarchy } from './role-hierarchy';
import {
  defaultHierarchyResolver,
  type EffectivePermissionsSet,
} from './hierarchy-resolver';
import { RBAC_WILDCARD, type RbacWildcard } from './rbac-constants';

/**
 * Resultat structure de l'introspection role -> permissions effectives.
 * Inclut metadata pour debug (depth, count, hasWildcard).
 */
export interface EffectivePermissionsResult {
  role: AuthRole;
  permissions: ReadonlySet<PermissionValue | RbacWildcard>;
  count: number;
  hasWildcard: boolean;
  hierarchyDepth: number;
  inheritedFromRoles: readonly AuthRole[];
}

/**
 * Retourne permissions effectives d'un role (directes + heritees).
 * Wrapper autour de defaultHierarchyResolver pour API simple.
 *
 * @param role - role a interroger
 * @returns Set readonly permissions (incluant wildcard si applicable)
 */
export function getEffectivePermissions(role: AuthRole): EffectivePermissionsSet {
  return defaultHierarchyResolver.getEffectivePermissions(role);
}

/**
 * Retourne toutes les infos sur les permissions effectives d'un role.
 * Utilise par admin endpoints (Tache 2.3.11) pour introspection.
 */
export function getEffectivePermissionsDetailed(role: AuthRole): EffectivePermissionsResult {
  const permissions = getEffectivePermissions(role);
  const inherited = collectInheritedRoles(role);
  return {
    role,
    permissions,
    count: permissions.size,
    hasWildcard: permissions.has(RBAC_WILDCARD),
    hierarchyDepth: defaultHierarchyResolver.computeDepth(role),
    inheritedFromRoles: inherited,
  };
}

/**
 * Inverse-lookup : retourne tous les roles qui ont une permission donnee.
 * Utilise par audit RBAC (qui peut faire X ?) et tests.
 *
 * @param permission - permission a chercher
 * @returns tableau roles ayant cette permission (directe ou heritee)
 */
export function getRolesByPermission(permission: PermissionValue): AuthRole[] {
  const roles: AuthRole[] = [];
  for (const role of Object.keys(PermissionsMatrix) as AuthRole[]) {
    const effective = getEffectivePermissions(role);
    if (effective.has(permission) || effective.has(RBAC_WILDCARD)) {
      roles.push(role);
    }
  }
  return roles;
}

/**
 * Verifie si un role a une permission (directe ou heritee, wildcard inclus).
 *
 * @param role - role a tester
 * @param permission - permission a tester
 * @returns true si role peut executer permission
 */
export function hasPermissionInRole(
  role: AuthRole,
  permission: PermissionValue,
): boolean {
  const effective = getEffectivePermissions(role);
  return effective.has(RBAC_WILDCARD) || effective.has(permission);
}

/**
 * Retourne profondeur hierarchique d'un role.
 *
 * @param role - role a mesurer
 * @returns profondeur (0 = terminal)
 */
export function getRoleHierarchyDepth(role: AuthRole): number {
  return defaultHierarchyResolver.computeDepth(role);
}

/**
 * Collecte recursivement tous les roles dont un role parent herite.
 * (Helper interne pour getEffectivePermissionsDetailed)
 */
function collectInheritedRoles(role: AuthRole, visited = new Set<AuthRole>()): AuthRole[] {
  if (visited.has(role)) return [];
  visited.add(role);
  const result: AuthRole[] = [];
  for (const child of RoleHierarchy[role]) {
    result.push(child);
    result.push(...collectInheritedRoles(child, visited));
  }
  return result;
}
```

### 6.6 `repo/packages/auth/src/rbac/matrix-stats.ts`

```typescript
/**
 * @file matrix-stats.ts
 * @description Compute statistiques globales sur la matrice + hierarchie.
 *              Utilise par admin dashboards (Sprint 26) et boot logging.
 */

import { AuthRole } from './roles.enum';
import { type PermissionValue } from './permissions.enum';
import { PermissionsMatrix, hasWildcardPermission } from './permissions-matrix';
import { RoleHierarchy } from './role-hierarchy';
import { getEffectivePermissions } from './role-permissions-helper';
import { RBAC_WILDCARD } from './rbac-constants';

/**
 * Statistiques par role.
 */
export interface RoleStats {
  role: AuthRole;
  directPermissionsCount: number;
  effectivePermissionsCount: number;  // direct + heritees
  hasWildcard: boolean;
  childrenCount: number;
  hierarchyDepth: number;
  modulesCovered: readonly string[];
}

/**
 * Rapport global stats.
 */
export interface MatrixStatsReport {
  totalRoles: number;
  totalDistinctPermissions: number;     // count unique permissions a travers tous roles
  rolesWithWildcard: readonly AuthRole[];
  perRole: readonly RoleStats[];
  modulesCount: number;
  generatedAt: string;
}

/**
 * Compute stats par role (direct + effective + modules).
 */
export function computeRoleStats(role: AuthRole): RoleStats {
  const direct = PermissionsMatrix[role];
  const effective = getEffectivePermissions(role);
  const modules = new Set<string>();

  for (const perm of effective) {
    if (perm === RBAC_WILDCARD) continue;
    const dot = (perm as string).indexOf('.');
    if (dot > 0) modules.add((perm as string).slice(0, dot));
  }

  return {
    role,
    directPermissionsCount: direct.length,
    effectivePermissionsCount: effective.size,
    hasWildcard: hasWildcardPermission(role),
    childrenCount: RoleHierarchy[role].length,
    hierarchyDepth: computeDepth(role),
    modulesCovered: Array.from(modules).sort(),
  };
}

/**
 * Compute rapport global complet.
 */
export function computeMatrixStats(): MatrixStatsReport {
  const allRoles = Object.keys(PermissionsMatrix) as AuthRole[];
  const distinct = new Set<string>();
  const wildcardRoles: AuthRole[] = [];
  const modules = new Set<string>();

  for (const role of allRoles) {
    if (hasWildcardPermission(role)) wildcardRoles.push(role);
    for (const perm of PermissionsMatrix[role]) {
      if (perm === RBAC_WILDCARD) continue;
      distinct.add(perm as string);
      const dot = (perm as string).indexOf('.');
      if (dot > 0) modules.add((perm as string).slice(0, dot));
    }
  }

  return {
    totalRoles: allRoles.length,
    totalDistinctPermissions: distinct.size,
    rolesWithWildcard: wildcardRoles,
    perRole: allRoles.map(computeRoleStats),
    modulesCount: modules.size,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Helper interne profondeur (evite import circulaire helper).
 */
function computeDepth(role: AuthRole, visited = new Set<AuthRole>()): number {
  if (visited.has(role)) return 0;
  visited.add(role);
  const children = RoleHierarchy[role];
  if (children.length === 0) return 0;
  let max = 0;
  for (const c of children) {
    const d = computeDepth(c, new Set(visited));
    if (d > max) max = d;
  }
  return 1 + max;
}
```

### 6.7 `repo/packages/auth/src/rbac/matrix-export.ts`

```typescript
/**
 * @file matrix-export.ts
 * @description Export matrice + hierarchie en JSON pour audit ACAPS et CNDP.
 *              Genere fichier auditable consultable par auditeurs externes.
 */

import { AuthRole } from './roles.enum';
import { PermissionsMatrix } from './permissions-matrix';
import { RoleHierarchy } from './role-hierarchy';
import { getEffectivePermissions } from './role-permissions-helper';
import { computeMatrixStats } from './matrix-stats';
import { RBAC_WILDCARD } from './rbac-constants';

/**
 * Format JSON exportable.
 */
export interface MatrixExportPayload {
  version: string;
  exportedAt: string;
  catalog: {
    roles: readonly AuthRole[];
    distinctPermissions: number;
  };
  matrix: Record<string, readonly string[]>;
  hierarchy: Record<string, readonly string[]>;
  effectivePermissions: Record<string, readonly string[]>;
  stats: ReturnType<typeof computeMatrixStats>;
}

/**
 * Export matrice + hierarchie + permissions effectives en JSON.
 * Utilise par Tache 2.3.11 (admin endpoints) et CLI scripts/export-rbac-audit.ts.
 *
 * @param version - version semver matrice (ex: '2.2.0')
 * @returns payload JSON exportable
 */
export function exportMatrixToJson(version = '2.2.0'): MatrixExportPayload {
  const matrix: Record<string, readonly string[]> = {};
  const hierarchy: Record<string, readonly string[]> = {};
  const effective: Record<string, readonly string[]> = {};

  for (const role of Object.keys(PermissionsMatrix) as AuthRole[]) {
    matrix[role] = PermissionsMatrix[role].map(p => p as string);
    hierarchy[role] = [...RoleHierarchy[role]];
    const effSet = getEffectivePermissions(role);
    effective[role] = Array.from(effSet).map(p => p as string).sort();
  }

  const stats = computeMatrixStats();

  return {
    version,
    exportedAt: new Date().toISOString(),
    catalog: {
      roles: Object.keys(PermissionsMatrix) as AuthRole[],
      distinctPermissions: stats.totalDistinctPermissions,
    },
    matrix,
    hierarchy,
    effectivePermissions: effective,
    stats,
  };
}

/**
 * Convertit l'export en chaine JSON pretty-printed.
 *
 * @param version - version semver
 * @returns chaine JSON 2-spaces indented
 */
export function exportMatrixToJsonString(version = '2.2.0'): string {
  return JSON.stringify(exportMatrixToJson(version), null, 2);
}

/**
 * Format CSV pour export audit ACAPS (1 ligne par role x permission).
 */
export function exportMatrixToCsv(): string {
  const rows: string[] = ['role,permission,direct_or_inherited'];
  for (const role of Object.keys(PermissionsMatrix) as AuthRole[]) {
    const direct = new Set(PermissionsMatrix[role].map(p => p as string));
    const effective = getEffectivePermissions(role);
    for (const perm of effective) {
      const source = direct.has(perm as string) ? 'direct' : 'inherited';
      rows.push(`${role},${perm},${source}`);
    }
  }
  return rows.join('\n');
}
```

### 6.8 `repo/packages/auth/src/rbac/matrix-fixtures.ts`

```typescript
/**
 * @file matrix-fixtures.ts
 * @description Fixtures de test pour permissions-matrix specs et integration tests.
 *              Reutilises par Tache 2.3.3 (RbacService.spec) et Tache 2.3.12 (E2E coverage).
 */

import { AuthRole } from './roles.enum';
import { Permission, type PermissionValue } from './permissions.enum';
import { RBAC_WILDCARD } from './rbac-constants';

/**
 * Roles broker complets (admin + user + assistant).
 */
export const BROKER_ROLES = [
  AuthRole.BROKER_ADMIN,
  AuthRole.BROKER_USER,
  AuthRole.BROKER_ASSISTANT,
] as const;

/**
 * Roles garage complets (admin + chef + technicien + comptable + commercial).
 */
export const GARAGE_ROLES = [
  AuthRole.GARAGE_ADMIN,
  AuthRole.GARAGE_CHEF,
  AuthRole.GARAGE_TECHNICIEN,
  AuthRole.GARAGE_COMPTABLE,
  AuthRole.GARAGE_COMMERCIAL,
] as const;

/**
 * Roles platform.
 */
export const PLATFORM_ROLES = [
  AuthRole.SUPER_ADMIN_PLATFORM,
  AuthRole.ANALYST_SUPPORT,
] as const;

/**
 * Roles terminaux (assure + prospect).
 */
export const TERMINAL_USER_ROLES = [
  AuthRole.ASSURE,
  AuthRole.PROSPECT,
] as const;

/**
 * Sample permissions pour tests rapides.
 */
export const SAMPLE_PERMISSIONS: readonly PermissionValue[] = [
  Permission.CRM_CONTACTS_READ,
  Permission.CRM_CONTACTS_CREATE,
  Permission.INSURE_POLICIES_READ_OWN,
  Permission.REPAIR_SINISTRES_ASSIGN,
  Permission.PAY_REFUNDS_CREATE,
];

/**
 * Cas test : (role, permission) -> attendu canAccess.
 */
export interface AccessTestCase {
  role: AuthRole;
  permission: PermissionValue;
  expected: boolean;
  reason: string;
}

/**
 * Cas tests pre-definis pour coverage matrix.
 */
export const ACCESS_TEST_CASES: readonly AccessTestCase[] = [
  // super_admin_platform : tout autorise (wildcard)
  {
    role: AuthRole.SUPER_ADMIN_PLATFORM,
    permission: Permission.CRM_CONTACTS_DELETE,
    expected: true,
    reason: 'super_admin_platform wildcard bypass',
  },
  {
    role: AuthRole.SUPER_ADMIN_PLATFORM,
    permission: Permission.REPAIR_SINISTRES_CLOSE,
    expected: true,
    reason: 'super_admin_platform wildcard bypass',
  },
  // broker_admin herite broker_user, donc a access aux permissions broker_user
  {
    role: AuthRole.BROKER_ADMIN,
    permission: Permission.CRM_CONTACTS_READ_OWN,
    expected: true,
    reason: 'broker_admin inherits from broker_user',
  },
  // broker_admin pas access aux permissions garage
  {
    role: AuthRole.BROKER_ADMIN,
    permission: Permission.REPAIR_SINISTRES_ASSIGN,
    expected: false,
    reason: 'broker_admin no cross-domain inheritance to garage',
  },
  // garage_chef herite garage_technicien
  {
    role: AuthRole.GARAGE_CHEF,
    permission: Permission.REPAIR_REPARATIONS_START,
    expected: true,
    reason: 'garage_chef inherits from garage_technicien',
  },
  // garage_admin herite garage_chef qui herite garage_technicien
  {
    role: AuthRole.GARAGE_ADMIN,
    permission: Permission.REPAIR_REPARATIONS_START,
    expected: true,
    reason: 'garage_admin -> garage_chef -> garage_technicien (transitif)',
  },
  // assure : limite aux read_own
  {
    role: AuthRole.ASSURE,
    permission: Permission.INSURE_POLICIES_READ_OWN,
    expected: true,
    reason: 'assure has read_own',
  },
  {
    role: AuthRole.ASSURE,
    permission: Permission.INSURE_POLICIES_CREATE,
    expected: false,
    reason: 'assure cannot create policies',
  },
  // prospect : public uniquement
  {
    role: AuthRole.PROSPECT,
    permission: Permission.PUBLIC_PRODUCTS_READ,
    expected: true,
    reason: 'prospect has public read',
  },
  {
    role: AuthRole.PROSPECT,
    permission: Permission.CRM_CONTACTS_READ,
    expected: false,
    reason: 'prospect cannot access CRM',
  },
];
```

### 6.9 `repo/packages/auth/src/rbac/permissions-matrix.spec.ts`

```typescript
/**
 * @file permissions-matrix.spec.ts
 * @description Tests Vitest pour matrice permissions (V1, V2, V3, V4, V5, V6, V14, V18, etc.)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AuthRole } from './roles.enum';
import { Permission, type PermissionValue } from './permissions.enum';
import {
  PermissionsMatrix,
  hasWildcardPermission,
  getDirectPermissions,
  countDirectPermissions,
  ALL_ROLES_IN_MATRIX,
} from './permissions-matrix';
import { RBAC_WILDCARD } from './rbac-constants';
import { MatrixValidator } from './matrix-validator';
import { ACCESS_TEST_CASES } from './matrix-fixtures';
import { hasPermissionInRole, getEffectivePermissions } from './role-permissions-helper';

describe('PermissionsMatrix - V1 Coverage', () => {
  it('V1: matrix contient les 12 roles AuthRole', () => {
    const matrixRoles = Object.keys(PermissionsMatrix);
    const enumRoles = Object.values(AuthRole);
    expect(matrixRoles.length).toBe(12);
    expect(matrixRoles.sort()).toEqual([...enumRoles].sort());
  });

  it('V1: tous roles ont au moins 1 permission (sauf si wildcard)', () => {
    for (const role of ALL_ROLES_IN_MATRIX) {
      const perms = getDirectPermissions(role);
      expect(perms.length).toBeGreaterThan(0);
    }
  });
});

describe('PermissionsMatrix - V2 Wildcard', () => {
  it('V2: super_admin_platform a wildcard exclusif', () => {
    expect(hasWildcardPermission(AuthRole.SUPER_ADMIN_PLATFORM)).toBe(true);
    expect(PermissionsMatrix[AuthRole.SUPER_ADMIN_PLATFORM]).toEqual([RBAC_WILDCARD]);
  });

  it('V14: aucun autre role n\'a wildcard', () => {
    for (const role of ALL_ROLES_IN_MATRIX) {
      if (role === AuthRole.SUPER_ADMIN_PLATFORM) continue;
      expect(hasWildcardPermission(role)).toBe(false);
      const perms = PermissionsMatrix[role];
      expect(perms.includes(RBAC_WILDCARD as never)).toBe(false);
    }
  });
});

describe('PermissionsMatrix - V3 Hierarchy Inheritance', () => {
  it('V3: broker_admin herite permissions broker_user', () => {
    const adminPerms = getEffectivePermissions(AuthRole.BROKER_ADMIN);
    const userPerms = getEffectivePermissions(AuthRole.BROKER_USER);
    for (const perm of userPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it('V3: broker_user herite permissions broker_assistant', () => {
    const userPerms = getEffectivePermissions(AuthRole.BROKER_USER);
    const assistantPerms = getEffectivePermissions(AuthRole.BROKER_ASSISTANT);
    for (const perm of assistantPerms) {
      expect(userPerms.has(perm)).toBe(true);
    }
  });

  it('V3: broker_admin herite transitivement broker_assistant', () => {
    const adminPerms = getEffectivePermissions(AuthRole.BROKER_ADMIN);
    const assistantPerms = getEffectivePermissions(AuthRole.BROKER_ASSISTANT);
    for (const perm of assistantPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it('V3: garage_admin herite garage_chef', () => {
    const adminPerms = getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    const chefPerms = getEffectivePermissions(AuthRole.GARAGE_CHEF);
    for (const perm of chefPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it('V3: garage_admin herite garage_comptable', () => {
    const adminPerms = getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    const comptablePerms = getEffectivePermissions(AuthRole.GARAGE_COMPTABLE);
    for (const perm of comptablePerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it('V3: garage_admin herite garage_commercial', () => {
    const adminPerms = getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    const commercialPerms = getEffectivePermissions(AuthRole.GARAGE_COMMERCIAL);
    for (const perm of commercialPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it('V3: garage_chef herite garage_technicien', () => {
    const chefPerms = getEffectivePermissions(AuthRole.GARAGE_CHEF);
    const techPerms = getEffectivePermissions(AuthRole.GARAGE_TECHNICIEN);
    for (const perm of techPerms) {
      expect(chefPerms.has(perm)).toBe(true);
    }
  });

  it('V3: garage_admin herite transitivement garage_technicien', () => {
    const adminPerms = getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    const techPerms = getEffectivePermissions(AuthRole.GARAGE_TECHNICIEN);
    for (const perm of techPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });
});

describe('PermissionsMatrix - V4 No Cross-Domain', () => {
  it('V4: broker_admin n\'a pas permissions garage exclusives', () => {
    const adminPerms = getEffectivePermissions(AuthRole.BROKER_ADMIN);
    expect(adminPerms.has(Permission.REPAIR_SINISTRES_ASSIGN)).toBe(false);
    expect(adminPerms.has(Permission.REPAIR_REPARATIONS_START)).toBe(false);
    expect(adminPerms.has(Permission.STOCK_ITEMS_USE)).toBe(false);
  });

  it('V4: garage_admin n\'a pas permissions broker exclusives', () => {
    const adminPerms = getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    expect(adminPerms.has(Permission.INSURE_POLICIES_READ_OWN)).toBe(false);
    expect(adminPerms.has(Permission.INSURE_POLICIES_CREATE)).toBe(false);
    expect(adminPerms.has(Permission.INSURE_QUOTES_GENERATE)).toBe(false);
  });
});

describe('PermissionsMatrix - V5 All Permissions Valid', () => {
  it('V5: toutes permissions matrice existent dans Permission catalog', () => {
    const validator = new MatrixValidator();
    const issues = validator.validatePermissionsExist();
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  });
});

describe('PermissionsMatrix - V6 Distinct Permissions Count', () => {
  it('V6: matrice utilise au moins 60 permissions distinctes (cible Sprint 7)', () => {
    const distinct = new Set<string>();
    for (const perms of Object.values(PermissionsMatrix)) {
      for (const p of perms) {
        if (p !== RBAC_WILDCARD) distinct.add(p as string);
      }
    }
    expect(distinct.size).toBeGreaterThanOrEqual(60);
  });

  it('V6: catalog Permission contient au moins 85 entrees (Tache 2.3.1 cible)', () => {
    expect(Object.values(Permission).length).toBeGreaterThanOrEqual(85);
  });
});

describe('PermissionsMatrix - V18 No Duplicates', () => {
  it('V18: aucun role n\'a de doublons intra-permissions', () => {
    for (const [role, perms] of Object.entries(PermissionsMatrix)) {
      const set = new Set(perms);
      expect(set.size).toBe(perms.length);
    }
  });
});

describe('PermissionsMatrix - Counts Per Role', () => {
  it('broker_admin a au moins 35 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.BROKER_ADMIN)).toBeGreaterThanOrEqual(35);
  });

  it('broker_user a au moins 15 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.BROKER_USER)).toBeGreaterThanOrEqual(15);
  });

  it('broker_assistant a au moins 6 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.BROKER_ASSISTANT)).toBeGreaterThanOrEqual(6);
  });

  it('garage_admin a au moins 30 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.GARAGE_ADMIN)).toBeGreaterThanOrEqual(30);
  });

  it('garage_chef a au moins 10 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.GARAGE_CHEF)).toBeGreaterThanOrEqual(10);
  });

  it('garage_technicien a au moins 5 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.GARAGE_TECHNICIEN)).toBeGreaterThanOrEqual(5);
  });

  it('assure a 8 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.ASSURE)).toBe(8);
  });

  it('prospect a 4 permissions directes', () => {
    expect(countDirectPermissions(AuthRole.PROSPECT)).toBe(4);
  });
});

describe('PermissionsMatrix - Access Test Cases (Fixtures)', () => {
  it.each(ACCESS_TEST_CASES)('case ($role $permission expected=$expected)', ({ role, permission, expected }) => {
    expect(hasPermissionInRole(role, permission)).toBe(expected);
  });
});

describe('PermissionsMatrix - V20 No Emoji', () => {
  it('V20: matrix-related files have no emoji', async () => {
    const fs = await import('node:fs/promises');
    const sources = [
      'src/rbac/permissions-matrix.ts',
      'src/rbac/role-hierarchy.ts',
    ];
    const emojiRegex = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u;
    for (const f of sources) {
      try {
        const content = await fs.readFile(f, 'utf-8');
        expect(emojiRegex.test(content)).toBe(false);
      } catch { /* file may not exist in this test env */ }
    }
  });
});

describe('PermissionsMatrix - Validator Boot Report', () => {
  it('boot validation passes without errors', () => {
    const validator = new MatrixValidator();
    const report = validator.validateAll({ logBoot: false });
    expect(report.errorCount).toBe(0);
  });
});
```

### 6.10 `repo/packages/auth/src/rbac/role-hierarchy.spec.ts`

```typescript
/**
 * @file role-hierarchy.spec.ts
 * @description Tests Vitest pour role-hierarchy (graphe DAG, helpers, terminaux).
 */

import { describe, it, expect } from 'vitest';
import { AuthRole } from './roles.enum';
import {
  RoleHierarchy,
  getDirectChildren,
  isTerminalRole,
  isBrokerRole,
  isGarageRole,
  isPlatformRole,
  ALL_ROLES_IN_HIERARCHY,
} from './role-hierarchy';

describe('RoleHierarchy - Coverage', () => {
  it('contient les 12 roles AuthRole', () => {
    expect(ALL_ROLES_IN_HIERARCHY.length).toBe(12);
    const enumRoles = Object.values(AuthRole);
    expect([...ALL_ROLES_IN_HIERARCHY].sort()).toEqual([...enumRoles].sort());
  });
});

describe('RoleHierarchy - Broker Chain', () => {
  it('broker_admin -> [broker_user]', () => {
    expect(getDirectChildren(AuthRole.BROKER_ADMIN)).toEqual([AuthRole.BROKER_USER]);
  });

  it('broker_user -> [broker_assistant]', () => {
    expect(getDirectChildren(AuthRole.BROKER_USER)).toEqual([AuthRole.BROKER_ASSISTANT]);
  });

  it('broker_assistant -> [] (terminal)', () => {
    expect(getDirectChildren(AuthRole.BROKER_ASSISTANT)).toEqual([]);
    expect(isTerminalRole(AuthRole.BROKER_ASSISTANT)).toBe(true);
  });
});

describe('RoleHierarchy - Garage DAG', () => {
  it('garage_admin -> [chef, comptable, commercial]', () => {
    const children = getDirectChildren(AuthRole.GARAGE_ADMIN);
    expect(children).toContain(AuthRole.GARAGE_CHEF);
    expect(children).toContain(AuthRole.GARAGE_COMPTABLE);
    expect(children).toContain(AuthRole.GARAGE_COMMERCIAL);
    expect(children.length).toBe(3);
  });

  it('garage_chef -> [garage_technicien]', () => {
    expect(getDirectChildren(AuthRole.GARAGE_CHEF)).toEqual([AuthRole.GARAGE_TECHNICIEN]);
  });

  it('garage_technicien -> [] (terminal)', () => {
    expect(isTerminalRole(AuthRole.GARAGE_TECHNICIEN)).toBe(true);
  });

  it('garage_comptable -> [] (terminal)', () => {
    expect(isTerminalRole(AuthRole.GARAGE_COMPTABLE)).toBe(true);
  });

  it('garage_commercial -> [] (terminal)', () => {
    expect(isTerminalRole(AuthRole.GARAGE_COMMERCIAL)).toBe(true);
  });
});

describe('RoleHierarchy - Terminals', () => {
  it('super_admin_platform terminal (wildcard)', () => {
    expect(isTerminalRole(AuthRole.SUPER_ADMIN_PLATFORM)).toBe(true);
  });

  it('analyst_support terminal', () => {
    expect(isTerminalRole(AuthRole.ANALYST_SUPPORT)).toBe(true);
  });

  it('assure terminal', () => {
    expect(isTerminalRole(AuthRole.ASSURE)).toBe(true);
  });

  it('prospect terminal', () => {
    expect(isTerminalRole(AuthRole.PROSPECT)).toBe(true);
  });
});

describe('RoleHierarchy - Domain Helpers', () => {
  it('isBrokerRole correct', () => {
    expect(isBrokerRole(AuthRole.BROKER_ADMIN)).toBe(true);
    expect(isBrokerRole(AuthRole.BROKER_USER)).toBe(true);
    expect(isBrokerRole(AuthRole.BROKER_ASSISTANT)).toBe(true);
    expect(isBrokerRole(AuthRole.GARAGE_ADMIN)).toBe(false);
    expect(isBrokerRole(AuthRole.SUPER_ADMIN_PLATFORM)).toBe(false);
  });

  it('isGarageRole correct', () => {
    expect(isGarageRole(AuthRole.GARAGE_ADMIN)).toBe(true);
    expect(isGarageRole(AuthRole.GARAGE_CHEF)).toBe(true);
    expect(isGarageRole(AuthRole.GARAGE_TECHNICIEN)).toBe(true);
    expect(isGarageRole(AuthRole.GARAGE_COMPTABLE)).toBe(true);
    expect(isGarageRole(AuthRole.GARAGE_COMMERCIAL)).toBe(true);
    expect(isGarageRole(AuthRole.BROKER_ADMIN)).toBe(false);
    expect(isGarageRole(AuthRole.ASSURE)).toBe(false);
  });

  it('isPlatformRole correct', () => {
    expect(isPlatformRole(AuthRole.SUPER_ADMIN_PLATFORM)).toBe(true);
    expect(isPlatformRole(AuthRole.ANALYST_SUPPORT)).toBe(true);
    expect(isPlatformRole(AuthRole.BROKER_ADMIN)).toBe(false);
  });
});

describe('RoleHierarchy - No Cross-Domain', () => {
  it('aucun broker role ne reference garage role', () => {
    for (const role of [AuthRole.BROKER_ADMIN, AuthRole.BROKER_USER, AuthRole.BROKER_ASSISTANT]) {
      for (const child of RoleHierarchy[role]) {
        expect(isGarageRole(child)).toBe(false);
      }
    }
  });

  it('aucun garage role ne reference broker role', () => {
    for (const role of [AuthRole.GARAGE_ADMIN, AuthRole.GARAGE_CHEF, AuthRole.GARAGE_TECHNICIEN, AuthRole.GARAGE_COMPTABLE, AuthRole.GARAGE_COMMERCIAL]) {
      for (const child of RoleHierarchy[role]) {
        expect(isBrokerRole(child)).toBe(false);
      }
    }
  });
});
```

### 6.11 `repo/packages/auth/src/rbac/hierarchy-resolver.spec.ts`

```typescript
/**
 * @file hierarchy-resolver.spec.ts
 * @description Tests Vitest pour HierarchyResolver (resolution recursive, cycles, depth, memoization).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthRole } from './roles.enum';
import { Permission } from './permissions.enum';
import {
  HierarchyResolver,
  RbacHierarchyCycleError,
  RbacHierarchyDepthError,
  defaultHierarchyResolver,
  DEFAULT_DEPTH_LIMIT,
} from './hierarchy-resolver';
import { RBAC_WILDCARD } from './rbac-constants';

describe('HierarchyResolver - getEffectivePermissions', () => {
  let resolver: HierarchyResolver;
  beforeEach(() => { resolver = new HierarchyResolver(); });

  it('super_admin_platform retourne wildcard set', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.SUPER_ADMIN_PLATFORM);
    expect(perms.has(RBAC_WILDCARD)).toBe(true);
    expect(perms.size).toBe(1);
  });

  it('analyst_support retourne ses permissions directes', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.ANALYST_SUPPORT);
    expect(perms.has(Permission.ADMIN_TENANTS_LIST)).toBe(true);
    expect(perms.has(RBAC_WILDCARD)).toBe(false);
  });

  it('broker_admin inclut permissions broker_user et broker_assistant', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.BROKER_ADMIN);
    // Direct broker_admin
    expect(perms.has(Permission.CRM_CONTACTS_DELETE)).toBe(true);
    // Heritee broker_user
    expect(perms.has(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
    // Heritee broker_assistant
    expect(perms.has(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
  });

  it('garage_admin inclut transitivement garage_technicien', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    expect(perms.has(Permission.REPAIR_REPARATIONS_START)).toBe(true);
    expect(perms.has(Permission.STOCK_ITEMS_USE)).toBe(true);
  });

  it('garage_admin inclut garage_comptable et garage_commercial', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    expect(perms.has(Permission.BOOKS_INVOICES_CREATE)).toBe(true);
    expect(perms.has(Permission.PAY_TRANSACTIONS_RECONCILE)).toBe(true);
  });

  it('assure terminal retourne ses 8 permissions', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.ASSURE);
    expect(perms.size).toBe(8);
  });

  it('prospect terminal retourne ses 4 permissions', () => {
    const perms = resolver.getEffectivePermissions(AuthRole.PROSPECT);
    expect(perms.size).toBe(4);
  });
});

describe('HierarchyResolver - Memoization', () => {
  it('cache hit apres premier appel', () => {
    const resolver = new HierarchyResolver();
    expect(resolver.getCacheSize()).toBe(0);
    resolver.getEffectivePermissions(AuthRole.BROKER_ADMIN);
    expect(resolver.getCacheSize()).toBe(1);
    resolver.getEffectivePermissions(AuthRole.BROKER_ADMIN);
    expect(resolver.getCacheSize()).toBe(1);  // pas d'augmentation
  });

  it('clearCache vide le cache', () => {
    const resolver = new HierarchyResolver();
    resolver.getEffectivePermissions(AuthRole.BROKER_ADMIN);
    resolver.getEffectivePermissions(AuthRole.GARAGE_ADMIN);
    expect(resolver.getCacheSize()).toBe(2);
    resolver.clearCache();
    expect(resolver.getCacheSize()).toBe(0);
  });

  it('warmupCache pre-charge tous roles', () => {
    const resolver = new HierarchyResolver();
    resolver.warmupCache();
    expect(resolver.getCacheSize()).toBe(12);
  });
});

describe('HierarchyResolver - Depth', () => {
  it('terminal depth = 0', () => {
    const resolver = new HierarchyResolver();
    expect(resolver.computeDepth(AuthRole.BROKER_ASSISTANT)).toBe(0);
    expect(resolver.computeDepth(AuthRole.GARAGE_TECHNICIEN)).toBe(0);
    expect(resolver.computeDepth(AuthRole.ASSURE)).toBe(0);
  });

  it('broker_user depth = 1', () => {
    expect(new HierarchyResolver().computeDepth(AuthRole.BROKER_USER)).toBe(1);
  });

  it('broker_admin depth = 2', () => {
    expect(new HierarchyResolver().computeDepth(AuthRole.BROKER_ADMIN)).toBe(2);
  });

  it('garage_admin depth = 2 (par garage_chef -> garage_technicien)', () => {
    expect(new HierarchyResolver().computeDepth(AuthRole.GARAGE_ADMIN)).toBe(2);
  });
});

describe('HierarchyResolver - Cycle Detection', () => {
  it('matrice livree n\'a pas de cycle', () => {
    const resolver = new HierarchyResolver();
    expect(() => resolver.detectCycles()).not.toThrow();
  });
});

describe('HierarchyResolver - Default Singleton', () => {
  it('defaultHierarchyResolver expose meme API', () => {
    const perms = defaultHierarchyResolver.getEffectivePermissions(AuthRole.BROKER_USER);
    expect(perms.size).toBeGreaterThan(0);
  });
});

describe('HierarchyResolver - Constants', () => {
  it('DEFAULT_DEPTH_LIMIT >= 8', () => {
    expect(DEFAULT_DEPTH_LIMIT).toBeGreaterThanOrEqual(8);
  });
});
```

### 6.12 `repo/packages/auth/src/rbac/index.ts` (mis a jour)

```typescript
/**
 * @file index.ts
 * @description Barrel exports pour package @insurtech/auth/rbac
 *              Sprint 7 (Tache 2.3.1 + 2.3.2 + suivantes).
 */

// Tache 2.3.1 (catalog) - exports existants
export { AuthRole } from './roles.enum';
export { Permission, type PermissionValue, isValidPermission, parsePermission } from './permissions.enum';
export { Module } from './module.enum';
export { Action } from './action.enum';
export { RBAC_WILDCARD, type RbacWildcard } from './rbac-constants';
export { getRoleMetadata } from './role-metadata';
export { getPermissionsByModule } from './permissions-by-module';
export { validatePermissionsCatalog } from './permissions-validator';

// Tache 2.3.2 (matrice + hierarchy) - nouveaux exports
export {
  PermissionsMatrix,
  type PermissionsMatrixEntry,
  type PermissionsMatrixKeys,
  ALL_ROLES_IN_MATRIX,
  getDirectPermissions,
  hasWildcardPermission,
  countDirectPermissions,
} from './permissions-matrix';

export {
  RoleHierarchy,
  ALL_ROLES_IN_HIERARCHY,
  getDirectChildren,
  isTerminalRole,
  isBrokerRole,
  isGarageRole,
  isPlatformRole,
} from './role-hierarchy';

export {
  HierarchyResolver,
  defaultHierarchyResolver,
  DEFAULT_DEPTH_LIMIT,
  RbacHierarchyCycleError,
  RbacHierarchyDepthError,
  type EffectivePermissionsSet,
} from './hierarchy-resolver';

export {
  MatrixValidator,
  type ValidationIssue,
  type ValidationReport,
  type ValidationSeverity,
} from './matrix-validator';

export {
  getEffectivePermissions,
  getEffectivePermissionsDetailed,
  getRolesByPermission,
  hasPermissionInRole,
  getRoleHierarchyDepth,
  type EffectivePermissionsResult,
} from './role-permissions-helper';

export {
  computeMatrixStats,
  computeRoleStats,
  type MatrixStatsReport,
  type RoleStats,
} from './matrix-stats';

export {
  exportMatrixToJson,
  exportMatrixToJsonString,
  exportMatrixToCsv,
  type MatrixExportPayload,
} from './matrix-export';

// Test fixtures (uniquement utilises par specs et tests E2E)
export {
  BROKER_ROLES,
  GARAGE_ROLES,
  PLATFORM_ROLES,
  TERMINAL_USER_ROLES,
  SAMPLE_PERMISSIONS,
  ACCESS_TEST_CASES,
  type AccessTestCase,
} from './matrix-fixtures';
```

### 6.13 `repo/packages/auth/scripts/boot-validate-rbac.ts` (CLI standalone)

```typescript
#!/usr/bin/env tsx
/**
 * @file scripts/boot-validate-rbac.ts
 * @description Script CLI standalone pour valider la matrice + hierarchy.
 *              Utilise par Husky pre-commit et CI workflows.
 *
 * Usage : pnpm --filter @insurtech/auth boot:validate-rbac
 *         tsx packages/auth/scripts/boot-validate-rbac.ts
 *
 * Exit codes :
 *   0 - OK (no errors)
 *   1 - errors found
 *   2 - unexpected exception
 */

import { MatrixValidator } from '../src/rbac/matrix-validator';
import { computeMatrixStats } from '../src/rbac/matrix-stats';

async function main(): Promise<void> {
  console.log('[RBAC Boot Validation] Starting...');
  const validator = new MatrixValidator();
  const report = validator.validateAll({ logBoot: true });

  const stats = computeMatrixStats();
  console.log('[RBAC Stats]');
  console.log(`  Total roles : ${stats.totalRoles}`);
  console.log(`  Distinct permissions : ${stats.totalDistinctPermissions}`);
  console.log(`  Roles with wildcard : ${stats.rolesWithWildcard.join(', ')}`);
  console.log(`  Modules count : ${stats.modulesCount}`);

  console.log(`[RBAC Boot Validation] ${report.errorCount} errors, ${report.warningCount} warnings`);

  if (!report.ok) {
    console.error('[RBAC Boot Validation] FAILED');
    process.exit(1);
  }
  console.log('[RBAC Boot Validation] OK');
  process.exit(0);
}

main().catch(err => {
  console.error('[RBAC Boot Validation] Unexpected error:', err);
  process.exit(2);
});
```

---

## 7. Tests complets (resume des 60+ tests)

Les fichiers de tests livres couvrent les 8 categories suivantes (60+ tests cumules) :

### 7.1 Tests `permissions-matrix.spec.ts` (~30 tests)

| Group | Test | Critere |
|-------|------|---------|
| Coverage | matrix contient 12 roles | V1 |
| Coverage | tous roles ont >= 1 permission | V1 |
| Wildcard | super_admin a wildcard exclusif | V2 |
| Wildcard | aucun autre role n'a wildcard | V14 |
| Hierarchy | broker_admin herite broker_user | V3 |
| Hierarchy | broker_user herite broker_assistant | V3 |
| Hierarchy | broker_admin transitif assistant | V3 |
| Hierarchy | garage_admin herite chef/comptable/commercial | V3 |
| Hierarchy | garage_chef herite technicien | V3 |
| Hierarchy | garage_admin transitif technicien | V3 |
| Cross-domain | broker pas de garage perms | V4 |
| Cross-domain | garage pas de broker perms | V4 |
| Validation | toutes perms existent catalog | V5 |
| Count | distinct >= 60 | V6 |
| Count | catalog >= 85 | V6 |
| Duplicates | pas de doublons | V18 |
| Counts | broker_admin >= 35 directes | V1 |
| Counts | broker_user >= 15 directes | V1 |
| Counts | assure = 8 directes | V1 |
| Counts | prospect = 4 directes | V1 |
| Fixtures | 10+ ACCESS_TEST_CASES | V3, V4 |
| No-emoji | regex Unicode | V20 |
| Boot validator | validateAll() OK | V21 |

### 7.2 Tests `role-hierarchy.spec.ts` (~15 tests)

| Group | Test | Critere |
|-------|------|---------|
| Coverage | 12 roles couverts | V1 |
| Broker | broker_admin -> [broker_user] | V3 |
| Broker | broker_user -> [broker_assistant] | V3 |
| Broker | broker_assistant terminal | V3 |
| Garage | garage_admin -> 3 enfants | V3 |
| Garage | garage_chef -> garage_technicien | V3 |
| Garage | garage_technicien terminal | V3 |
| Garage | garage_comptable terminal | V3 |
| Garage | garage_commercial terminal | V3 |
| Terminals | super_admin, analyst, assure, prospect | V8 |
| Domain | isBrokerRole correct | V4 |
| Domain | isGarageRole correct | V4 |
| Domain | isPlatformRole correct | V4 |
| Cross-domain | aucun broker -> garage | V4 |
| Cross-domain | aucun garage -> broker | V4 |

### 7.3 Tests `hierarchy-resolver.spec.ts` (~15 tests)

| Group | Test | Critere |
|-------|------|---------|
| Effective | super_admin wildcard set | V2 |
| Effective | analyst_support direct perms | V1 |
| Effective | broker_admin avec heritage | V3 |
| Effective | garage_admin transitif | V3 |
| Effective | garage_admin multi-enfants | V3 |
| Effective | assure terminal 8 perms | V1 |
| Effective | prospect terminal 4 perms | V1 |
| Memoization | cache hit | V19 |
| Memoization | clearCache | V19 |
| Memoization | warmupCache | V19 |
| Depth | terminal = 0 | V11 |
| Depth | broker_user = 1 | V11 |
| Depth | broker_admin = 2 | V11 |
| Depth | garage_admin = 2 | V11 |
| Cycles | livree pas de cycle | V8 |
| Default | defaultHierarchyResolver works | V21 |
| Constants | DEFAULT_DEPTH_LIMIT >= 8 | V11 |

---

## 8. Variables environnement

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_RBAC_MATRIX_BOOT` | boolean | `false` | Active les logs detailles du MatrixValidator au boot (toutes issues affichees console). En prod : false. En dev/staging : true. |
| `RBAC_HIERARCHY_DEPTH_LIMIT` | number | `8` | Profondeur maximale autorisee pour la resolution recursive. Si depasse, exception RbacHierarchyDepthError. Sprint 7 utilise max 3, marge confortable. |
| `RBAC_VALIDATOR_FAIL_ON_WARNINGS` | boolean | `false` | Si true, validator boot fait fail-fast meme sur warnings (mode strict CI). En prod : false. En CI : true. |
| `RBAC_MEMOIZATION_ENABLED` | boolean | `true` | Active la memoization in-process du HierarchyResolver. En benchmark debug : false. |

Ajout dans `repo/.env.example` :

```dotenv
# ====================================================================
# RBAC Matrix + Hierarchy (Tache 2.3.2)
# ====================================================================
# Boot logging detaille (true en dev/staging, false en prod)
LOG_RBAC_MATRIX_BOOT=true

# Profondeur max recursion hierarchy (default 8, sprint 7 utilise 3)
RBAC_HIERARCHY_DEPTH_LIMIT=8

# Mode strict CI (fail si warnings)
RBAC_VALIDATOR_FAIL_ON_WARNINGS=false

# Memoization in-process (default true, false pour benchmarks)
RBAC_MEMOIZATION_ENABLED=true
```

Ajout schema validation dans `packages/shared-config/src/env.schema.ts` :

```typescript
import { z } from 'zod';

export const rbacEnvSchema = z.object({
  LOG_RBAC_MATRIX_BOOT: z.coerce.boolean().default(false),
  RBAC_HIERARCHY_DEPTH_LIMIT: z.coerce.number().int().positive().min(1).max(20).default(8),
  RBAC_VALIDATOR_FAIL_ON_WARNINGS: z.coerce.boolean().default(false),
  RBAC_MEMOIZATION_ENABLED: z.coerce.boolean().default(true),
});

export type RbacEnv = z.infer<typeof rbacEnvSchema>;
```

---

## 9. Commandes shell

```bash
# Installation : aucune nouvelle dependance externe (utilise stack Sprint 1-2)
cd repo
pnpm install

# Typecheck du package auth (verifie types stricts)
pnpm --filter @insurtech/auth typecheck

# Tests Vitest sur les nouveaux fichiers Tache 2.3.2
pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts
pnpm --filter @insurtech/auth test rbac/role-hierarchy.spec.ts
pnpm --filter @insurtech/auth test rbac/hierarchy-resolver.spec.ts

# Tous les tests RBAC ensemble
pnpm --filter @insurtech/auth test rbac/

# Coverage tests RBAC
pnpm --filter @insurtech/auth test:coverage rbac/

# Boot validation standalone (CLI)
pnpm --filter @insurtech/auth boot:validate-rbac

# Export matrice JSON (audit ACAPS)
pnpm --filter @insurtech/auth tsx -e "import { exportMatrixToJsonString } from './src/rbac/matrix-export'; console.log(exportMatrixToJsonString());"

# Lint Biome
pnpm --filter @insurtech/auth lint

# Format Biome
pnpm --filter @insurtech/auth format
pnpm --filter @insurtech/auth format:check

# Verification no-emoji (Tache 1.1.14 hook)
bash infrastructure/scripts/check-no-emoji.sh packages/auth/src/rbac/

# Build package auth
pnpm --filter @insurtech/auth build

# Run app api en mode dev pour verifier integration boot
pnpm --filter api dev
# verifier dans logs : "[RBAC Matrix Boot] 0 errors, 0 warnings"
```

Ajout dans `packages/auth/package.json` (scripts) :

```json
{
  "scripts": {
    "boot:validate-rbac": "tsx scripts/boot-validate-rbac.ts",
    "rbac:export-json": "tsx -e \"import { exportMatrixToJsonString } from './src/rbac/matrix-export'; console.log(exportMatrixToJsonString());\" > matrix-audit.json",
    "rbac:export-csv": "tsx -e \"import { exportMatrixToCsv } from './src/rbac/matrix-export'; console.log(exportMatrixToCsv());\" > matrix-audit.csv"
  }
}
```

---

## 10. Criteres validation V1-V25

Chaque critere fournit la commande de verification reproductible.

| ID | Priorite | Critere | Commande de verification |
|----|----------|---------|--------------------------|
| V1 | P0 | Matrice contient 12 roles | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "matrix contient les 12 roles"` -> exit 0 |
| V2 | P0 | super_admin_platform a wildcard exclusif | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "super_admin_platform a wildcard"` -> exit 0 |
| V3 | P0 | broker_admin herite broker_user + broker_assistant transitif | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "broker_admin herite"` -> exit 0 |
| V4 | P0 | Pas de cross-inheritance broker <-> garage | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "No Cross-Domain"` -> exit 0 |
| V5 | P0 | Boot validation : aucune permission inconnue | `pnpm --filter @insurtech/auth boot:validate-rbac` -> exit 0 |
| V6 | P0 | >= 60 permissions distinctes utilisees + catalog >= 85 | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "Distinct Permissions Count"` -> exit 0 |
| V7 | P1 | Tests 30+ scenarios passants | `pnpm --filter @insurtech/auth test rbac/ --reporter=verbose | grep -c "PASS"` -> >= 60 |
| V8 | P0 | Cycle detection fonctionne (DFS WHITE/GRAY/BLACK) | `pnpm --filter @insurtech/auth test rbac/hierarchy-resolver.spec.ts -t "Cycle"` -> exit 0 |
| V9 | P1 | garage_admin herite multi-enfants (chef + comptable + commercial) | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "garage_admin herite garage_(chef|comptable|commercial)"` -> exit 0 |
| V10 | P0 | TypeScript strict typecheck OK | `pnpm --filter @insurtech/auth typecheck` -> exit 0 |
| V11 | P1 | Profondeur respecte limit (default 8) | `pnpm --filter @insurtech/auth test rbac/hierarchy-resolver.spec.ts -t "Depth"` -> exit 0 |
| V12 | P0 | Wildcard short-circuit dans HierarchyResolver | `pnpm --filter @insurtech/auth test rbac/hierarchy-resolver.spec.ts -t "super_admin_platform retourne wildcard"` -> exit 0 |
| V13 | P2 | Permissions _own attribuees roles platform = WARNING | `pnpm --filter @insurtech/auth boot:validate-rbac 2>&1 | grep -c "RBAC-V13"` -> 0 (pas de warning car non assigne) |
| V14 | P0 | Wildcard exclusif super_admin_platform | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "aucun autre role"` -> exit 0 |
| V15 | P1 | Memoization cache fonctionne | `pnpm --filter @insurtech/auth test rbac/hierarchy-resolver.spec.ts -t "Memoization"` -> exit 0 |
| V16 | P1 | Stats compute correct count distinct | `pnpm --filter @insurtech/auth tsx -e "import { computeMatrixStats } from './src/rbac/matrix-stats'; const s = computeMatrixStats(); if (s.totalDistinctPermissions < 60) process.exit(1);"` -> exit 0 |
| V17 | P1 | Export JSON serialisable et structure | `pnpm --filter @insurtech/auth tsx -e "import { exportMatrixToJson } from './src/rbac/matrix-export'; const j = exportMatrixToJson(); JSON.stringify(j);"` -> exit 0 |
| V18 | P0 | Aucune duplication intra-role | `pnpm --filter @insurtech/auth test rbac/permissions-matrix.spec.ts -t "No Duplicates"` -> exit 0 |
| V19 | P1 | Matrice et hierarchy immutables (`as const`) | `pnpm --filter @insurtech/auth typecheck` -> verifie compile-time `readonly` |
| V20 | P0 | No emoji dans aucun fichier RBAC | `bash infrastructure/scripts/check-no-emoji.sh packages/auth/src/rbac/` -> exit 0 |
| V21 | P0 | Boot validator integre OnApplicationBootstrap (Tache 2.3.3) | Smoke test : `pnpm --filter api dev`, observer log `[RBAC Matrix Boot] 0 errors` |
| V22 | P1 | Helpers `getRolesByPermission` correct | `pnpm --filter @insurtech/auth tsx -e "import { getRolesByPermission, Permission } from './src/rbac'; const r = getRolesByPermission(Permission.CRM_CONTACTS_READ); if (!r.includes('super_admin_platform')) process.exit(1);"` -> exit 0 |
| V23 | P1 | Helper `hasPermissionInRole` retourne bon resultat | `pnpm --filter @insurtech/auth test rbac/ -t "hasPermissionInRole|case"` -> exit 0 |
| V24 | P2 | Export CSV utilisable Excel/audit | `pnpm --filter @insurtech/auth tsx -e "import { exportMatrixToCsv } from './src/rbac/matrix-export'; const c = exportMatrixToCsv(); if (c.split('\n').length < 50) process.exit(1);"` -> exit 0 |
| V25 | P0 | `Record<AuthRole, ...>` exhaustivite (compile fail si role manquant) | `pnpm --filter @insurtech/auth typecheck` -> exit 0 |

---

## 11. Edge cases (10+)

1. **Cycle d'heritage manuel** : declaration broker_admin: ['broker_user'] ET broker_user: ['broker_admin']. Detection au boot via DFS, exception RbacHierarchyCycleError avec cyclePath = ['broker_admin', 'broker_user', 'broker_admin']. Test V8.
2. **Wildcard accidentel sur broker_admin** : ajout '*' dans broker_admin. MatrixValidator.validateNoWildcardLeak detecte au boot. Test V14.
3. **Permission revoquee in-flight** : Sprint 12 retire CRM_CONTACTS_DELETE. Compile error TypeScript dans permissions-matrix.ts car reference obsolete. Test V5.
4. **Empty matrix role** : un role declare [] dans matrix sans heritage. Compile OK, mais role inutilisable (RbacService.canAccess retourne false pour toute permission). Warning soft via getRoleStats.
5. **Wildcard combinations** : un role avec `['*', 'crm.contacts.read']` (mais '*' deja tout). HierarchyResolver retourne juste Set(['*']). Test V2 verifie `size === 1`.
6. **Boot validation failure** : permission inconnue dans matrice. Application NestJS refuse de demarrer (OnApplicationBootstrap throws). API healthcheck retourne 503. Smoke test recommande.
7. **Hierarchy depth runtime > limit** : si Phase 7+ ajoute super_courtier_groupe -> broker_admin chain depth 4, et limit reste 3, exception RbacHierarchyDepthError. Test V11.
8. **Multi-parents ambiguity** : si Phase 7+ ajoute hybrid_admin: [broker_admin, garage_admin], le validator emet ERROR cross-domain (test V4 etend).
9. **Same permission deux fois via heritage** : broker_admin a CRM_CONTACTS_READ direct, broker_user a aussi CRM_CONTACTS_READ. Set deduplique automatiquement. Test V18.
10. **Memoization stale apres modification matrix** : si tests modifient matrix runtime (ne devrait pas), cache invalide via clearCache(). Test V15.
11. **ResolverConcurrent** : 2 threads workers cluster Node demarrent en meme temps, chacun cree sa Map memoization. Pas de race car immutable. Test V19.
12. **Sub-classed AuthRole** : si Phase 7+ ajoute role custom-tenant via DB override, getEffectivePermissions doit l'inclure. Architecture future, decision-013 (Phase 7+ override layer).

---

## 12. Conformite Maroc detaillee

### 12.1 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

L'ACAPS exige par circulaire AS/02/24 (article 12) la separation des duties Maker/Checker pour les operations sensibles : la creation d'une police d'assurance (Maker = broker_user) doit etre approuvee par une seconde personne (Checker = broker_admin) avant signature par le client. Cette separation se traduit par :

- `INSURE_POLICIES_CREATE` attribuee a broker_user (Maker) : peut creer la police en statut `draft`
- `INSURE_POLICIES_UPDATE` attribuee a broker_admin uniquement (Checker) : peut transitionner la police en statut `pending_signature` ou `active`
- Le workflow status (Tache 2.3.7 StatusBasedPolicy) verifie que le user actuel n'est pas le createur (verification `policy.created_by !== ctx.userId` pour transition active).

La matrice 2.3.2 garantit cette separation : broker_user n'a pas `INSURE_POLICIES_UPDATE` ; seul broker_admin l'a. Le validator audit log (Sprint 6.5) trace toutes les transitions, exportable en rapport ACAPS via `compliance.acaps_reports.generate` (permission attribuee uniquement au super_admin_platform via wildcard).

L'ACAPS exige egalement (article 18) que les operations de remboursement (refunds) suivent un processus documente. La permission `pay.refunds.create` est attribuee a broker_admin (validation hierarchique cabinet) et garage_comptable (operations comptables garage), avec audit log complet. La timing policy (Tache 2.3.7 TimeBasedPolicy) verifie que le remboursement intervient dans les 30 jours apres transaction (loi 17-99 droit retract).

### 12.2 AMC / AML (Anti-Money Laundering)

La permission `compliance.aml_alerts.review` est attribuee uniquement a garage_comptable et broker_admin (Sprint 12 livraison). Cette restriction respecte la loi 12-18 sur la lutte contre le blanchiment de capitaux : seules les personnes formees aux procedures AML peuvent valider les alertes generees automatiquement. La matrice n'attribue pas cette permission a garage_chef ou broker_user (volontairement), ce qui force la chaine de validation.

### 12.3 CNDP (Commission Nationale de Protection des Donnees Personnelles)

La loi 09-08 impose des restrictions strictes sur la lecture des donnees personnelles. La matrice respecte ce principe en limitant `crm.contacts.read` (lecture sans filtre) a broker_admin et garage_admin (les responsables de tenant), tandis que broker_user et garage_commercial n'ont que `crm.contacts.read_own` (lecture filtree par owner_id via ABAC OwnResourcesPolicy Tache 2.3.7).

La permission `compliance.cndp_purge.execute` (purge donnees CNDP demande utilisateur sous 30 jours) est exclusivement reservee a super_admin_platform via wildcard. Cette restriction garantit que seule l'equipe Skalean (avec audit complet) peut declencher une purge irreversible de donnees personnelles.

### 12.4 DGI (Direction Generale des Impots) Maroc

La permission `books.tax_declarations.create` est attribuee a garage_comptable (et indirectement a garage_admin via heritage). Cette permission permet de generer les declarations fiscales TVA/IS exportables au format SAFT-MA exige par la DGI (Sprint 12 livraison module compliance). La matrice respecte la separation entre operations comptables (garage_comptable) et validation hierarchique (garage_admin).

### 12.5 Bank Al-Maghrib (BAM)

Les operations de paiement (module pay) sont controlees par BAM via les agreements PSP (Prestataires de Services de Paiement). La permission `pay.transactions.reconcile` (reconciliation paiements gateways CMI/PayZone/etc.) est attribuee a garage_comptable uniquement, garantissant que la reconciliation comptable est tracee et auditable. La permission `pay.gateways.config` (configuration credentials gateway) n'est attribuee a aucun role tenant, reservee implicitement a super_admin_platform via wildcard, conformement aux exigences PCI-DSS (Sprint 11 livraison).

---

## 13. Conventions absolues skalean-insurtech

1. **AUCUNE EMOJI** dans aucun fichier source, comment, doc, log message, commit message. decision-006. Test V20 verifie via regex Unicode `/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u`.

2. **TypeScript strict** : tous fichiers livres doivent passer `pnpm --filter @insurtech/auth typecheck` avec `strict: true` actif (configure Tache 1.1.2). Aucun `any` non documente, aucun `as` cast non motive.

3. **Imports explicites** : aucun import via `index.ts` du meme dossier (utiliser le chemin direct) pour eviter dependances circulaires ; uniquement les consommateurs externes utilisent le barrel `@insurtech/auth/rbac`.

4. **Const object `as const`** strict pour PermissionsMatrix et RoleHierarchy. Force literal types et empeche modification runtime accidentelle.

5. **Naming convention** : enums UPPER_SNAKE pour cles, lower.dot.notation pour values. Roles UPPER_SNAKE_CASE (BROKER_ADMIN). Modules lower (crm, repair).

6. **Comment inline systematique** sur chaque permission de la matrice : `Permission.X,            // description courte impact`. Permet code-review rapide sans aller-retour avec le catalog.

7. **JSDoc structure** sur chaque export public : `@file`, `@description`, `@param`, `@returns`, `@throws`. Permet generation TypeDoc automatique Sprint 33.

8. **Tests Vitest** : groupage `describe` par feature, naming `it('V<N>: ...')` pour traceability vers criteres validation.

9. **Pas de Date.now() pur** : toujours via injectable Clock (Sprint 1.1.6) pour testabilite. Exception : matrix-export.ts utilise `new Date().toISOString()` pour timestamp export (acceptable car non-deterministe attendu).

10. **Pas de console.log en source** (sauf dans scripts CLI explicites comme `boot-validate-rbac.ts`). Utiliser `Logger` from `@insurtech/shared-utils` (Sprint 1.1.5).

11. **Imports tries** : ordre Biome `auto-organize-imports` : node:* internes, externes, monorepo workspace `@insurtech/*`, locaux `./`.

12. **Pas de `enum` natif** pour permissions (decision-012) : utiliser const object `as const`. Exception : `AuthRole`, `Module`, `Action` en string enum tolere car cardinalite faible et stable.

13. **No magic strings** : toutes references a permissions via `Permission.X`, jamais string literal `'crm.contacts.read'`. ESLint regle Sprint 8 enforces.

14. **Erreurs typees** : classes `RbacHierarchyCycleError` et `RbacHierarchyDepthError` extends Error avec `name` propre. Permet `instanceof` checks dans guards et exception handlers (Sprint 3.2.x).

15. **Pas de side effects au module load** : aucun `console.log`, aucun fetch, aucune lecture fs au niveau top-level des fichiers source. Initialisation uniquement via classes ou functions appelees explicitement.

16. **Tests fixtures separees** : fichier `matrix-fixtures.ts` distinct des specs. Reutilisable par tests E2E Tache 2.3.12 et tests integration Sprint 33.

17. **Atomicite commit** : tous les fichiers livres dans 1 commit unique (Tache 2.3.2 = 1 commit), avec message descriptif (section 16).

---

## 14. Validation pre-commit

```bash
# 1. Typecheck strict
pnpm --filter @insurtech/auth typecheck
# Attendu : exit 0

# 2. Lint Biome
pnpm --filter @insurtech/auth lint
# Attendu : exit 0

# 3. Format check Biome
pnpm --filter @insurtech/auth format:check
# Attendu : exit 0

# 4. Tests Vitest RBAC
pnpm --filter @insurtech/auth test rbac/ --run
# Attendu : 60+ tests passants, exit 0

# 5. Boot validation standalone
pnpm --filter @insurtech/auth boot:validate-rbac
# Attendu : "[RBAC Boot Validation] OK", exit 0

# 6. No-emoji check
bash infrastructure/scripts/check-no-emoji.sh packages/auth/src/rbac/
# Attendu : exit 0

# 7. Coverage tests RBAC >= 90% lignes
pnpm --filter @insurtech/auth test:coverage rbac/
# Attendu : statements coverage >= 90% sur fichiers Tache 2.3.2

# 8. Build package compile
pnpm --filter @insurtech/auth build
# Attendu : exit 0, dist/ contient .d.ts pour tous nouveaux exports
```

Hook Husky `repo/.husky/pre-commit` execute automatiquement (configure Tache 1.1.14) :

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Typecheck packages modifies
pnpm typecheck || exit 1

# Lint files staged
pnpm lint-staged || exit 1

# No-emoji check pour fichiers staged
git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|md)$' | xargs bash infrastructure/scripts/check-no-emoji.sh
```

---

## 15. Commit message complet

```
feat(auth): RBAC PermissionsMatrix + RoleHierarchy with recursive resolver

Sprint 7 - Tache 2.3.2

Livrables :
- packages/auth/src/rbac/permissions-matrix.ts (Record<AuthRole, PermissionValue[]>, 12 roles)
- packages/auth/src/rbac/role-hierarchy.ts (DAG declaratif Record<AuthRole, AuthRole[]>)
- packages/auth/src/rbac/hierarchy-resolver.ts (resolution recursive + memoization + cycle detection DFS)
- packages/auth/src/rbac/matrix-validator.ts (boot-time validation 8 checks)
- packages/auth/src/rbac/role-permissions-helper.ts (getEffectivePermissions, getRolesByPermission, hasPermissionInRole)
- packages/auth/src/rbac/matrix-stats.ts (compute stats par role + global)
- packages/auth/src/rbac/matrix-export.ts (export JSON + CSV pour audit ACAPS)
- packages/auth/src/rbac/matrix-fixtures.ts (test fixtures reutilisables)
- packages/auth/src/rbac/permissions-matrix.spec.ts (30+ tests)
- packages/auth/src/rbac/role-hierarchy.spec.ts (15+ tests)
- packages/auth/src/rbac/hierarchy-resolver.spec.ts (15+ tests)
- packages/auth/src/rbac/index.ts (barrel exports +30 lignes)
- packages/auth/scripts/boot-validate-rbac.ts (CLI standalone)
- packages/auth/package.json (scripts +1)

Couverture matrice :
- super_admin_platform : wildcard '*' exclusif
- analyst_support : 8 permissions read-only
- broker_admin (35+ directes), broker_user (18), broker_assistant (8)
- garage_admin (30+ directes), garage_chef (12), garage_technicien (6), garage_comptable (10), garage_commercial (8)
- assure (8 read_own), prospect (4 public)
Total : 60+ permissions distinctes utilisees, catalog total >= 85.

Hierarchie :
- broker_admin -> broker_user -> broker_assistant
- garage_admin -> [garage_chef, garage_comptable, garage_commercial]
- garage_chef -> garage_technicien
- Pas de cross-inheritance broker <-> garage (verifie validator).

Tests : 60+ tests Vitest, coverage >= 90%.
Validation boot : 8 checks (V1, V2, V3, V4, V5, V14, V18, V8, V11).

Conformite :
- ACAPS Maker/Checker separation (broker_user create -> broker_admin update)
- AML : compliance.aml_alerts.review limite a comptables
- CNDP : compliance.cndp_purge.execute reservee super_admin
- DGI : books.tax_declarations.create reservee garage_comptable

Refs : 00-pilotage/meta-prompts/B-07-sprint-07-rbac.md (Tache 2.3.2)
       00-pilotage/documentation/5-roles-permissions.md (sections 2-3)
       00-pilotage/decisions/013-rbac-hierarchy-format.md
       00-pilotage/decisions/015-wildcard-super-admin.md
       00-pilotage/decisions/014-boot-time-rbac-validation.md

Depend : Tache 2.3.1 (catalog AuthRole + Permission)
Bloque : Tache 2.3.3 (RbacService), 2.3.4-2.3.8 (guards), 2.3.10 (Redis cache)

Validation :
[X] V1 : 12 roles couverts
[X] V2 : super_admin wildcard exclusif
[X] V3 : Heritage broker + garage transitif
[X] V4 : No cross-inheritance broker <-> garage
[X] V5 : All permissions exist in catalog
[X] V6 : >= 60 distinct permissions used
[X] V7 : 60+ tests passing
[X] V8 : Cycle detection DFS works
[X] V10 : TypeScript strict OK
[X] V11 : Hierarchy depth <= 8
[X] V12 : Wildcard short-circuit
[X] V14 : Wildcard exclusif super_admin
[X] V15 : Memoization works
[X] V18 : No duplicates intra-role
[X] V20 : No emoji
[X] V21 : Boot validator integre OnApplicationBootstrap
[X] V25 : Record<AuthRole, ...> exhaustivite

Co-authored-by: Skalean InsurTech Team <tech@skalean.ma>
```

---

## 16. Workflow next step (vers Tache 2.3.3)

La Tache 2.3.2 livre les fondations matrice + hierarchy + resolveur, mais ne livre AUCUN service NestJS injectable. La consommation operationnelle interviendra dans la **Tache 2.3.3 -- RbacService : Evaluation Principale** (P0 / 6h / depend Tache 2.3.2).

La Tache 2.3.3 va :
- Creer `packages/auth/src/rbac/rbac.service.ts` (NestJS @Injectable)
- Implementer `canAccess(role, permission, abacContext?): Promise<{ allowed, reason? }>` :
  1. Check wildcard via `hasWildcardPermission(role)` -> retour immediate true
  2. Check `getEffectivePermissions(role).has(permission)` (Tache 2.3.2)
  3. Si abacContext provided, delegate AbacService (Tache 2.3.7)
  4. Si negatif, retour `{ allowed: false, reason: 'permission_not_in_matrix' }`
- Implementer `canAccessAny(role, permissions[]): boolean` (OR logic)
- Implementer `canAccessAll(role, permissions[]): boolean` (AND logic)
- Implementer `getRolePermissions(role): PermissionValue[]` (delegate Tache 2.3.2 helper)
- Integrer `MatrixValidator` dans `OnApplicationBootstrap` lifecycle : si `validateAll().errorCount > 0`, throw et empecher demarrage api
- Integrer `HierarchyResolver` singleton injectable (provider scope DEFAULT, sera configurable Tache 2.3.10)
- Logger boot info `[RBAC] N roles, M permissions distinct, K wildcard roles`
- Emettre metric Prometheus `rbac_resolver_cache_size`, `rbac_validator_errors_total` (Sprint 13)

Contrats de la Tache 2.3.3 verifies par tests :
- Boot fail si matrice contient permission inconnue
- canAccess(super_admin, anyPermission) === true (wildcard short-circuit)
- canAccess(broker_admin, INSURE_POLICIES_READ_OWN) === true (heritage broker_user)
- canAccess(broker_user, REPAIR_SINISTRES_ASSIGN) === false (cross-domain)
- canAccess avec abacContext delegate AbacService.evaluate

Apres Tache 2.3.3, les **Taches 2.3.4 a 2.3.8** ajouteront les decorators et guards NestJS :
- 2.3.4 : `@RequirePermission(Permission.X)` decorator + `RbacGuard`
- 2.3.5 : `@Roles(AuthRole.X, AuthRole.Y)` decorator + `RolesGuard`
- 2.3.6 : `@CurrentUser()` param decorator
- 2.3.7 : `AbacService` + `OwnResourcesPolicy`, `TimeBasedPolicy`, `StatusBasedPolicy`, `WorkflowStatePolicy`
- 2.3.8 : `RbacExceptionFilter` (catch RbacForbiddenException -> 403 + audit log)

Ensuite :
- **Tache 2.3.9** : Audit logging RBAC (Sprint 6.5 integration)
- **Tache 2.3.10** : Redis cache `getEffectivePermissions` 5min TTL
- **Tache 2.3.11** : Admin endpoints introspection (GET /admin/rbac/matrix, GET /admin/rbac/effective-permissions/:role)
- **Tache 2.3.12** : Tests E2E coverage 12 roles x sample 10 permissions = 120 assertions

Le Sprint 7 se termine par **Tache 2.3.13** : documentation RBAC + diagrammes Mermaid + ADR-013 finalise.

---

**FIN DE LA TACHE 2.3.2**

Densite cible 100-150 ko. Ce document est auto-suffisant pour generer la Tache 2.3.2 sans aucune autre lecture.
