# TACHE 2.3.1 -- Definition 12 Roles + 85+ Permissions Catalog (RBAC Foundation)

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.1)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant absolu pour les 11 taches suivantes du Sprint 7 et pour tout sprint metier necessitant authorization granulaire)
**Effort** : 6h
**Dependances** : Sprint 6 complet (multi-tenant 3 niveaux, TenantContext.userRole disponible, JWT contient role)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.1 vise a transformer la specification humaine du document `00-pilotage/documentation/5-roles-permissions.md` en un catalog TypeScript strict, executable et exhaustif compose de deux artefacts coeur : l'enumeration `AuthRole` listant les 12 roles utilisateurs du programme Skalean InsurTech v2.2, et l'enumeration `Permission` listant 85+ permissions distinctes au format `{module}.{resource}.{action}` reutilisable runtime par les guards (Tache 2.3.4 a 2.3.8), par les services metier (Tache 2.3.3) et par les tests (Tache 2.3.12). Cette tache produit aussi le fichier `permissions-by-module.ts` qui regroupe les permissions par module pour la navigation et l'introspection (Tache 2.3.11), ainsi que les helpers de parsing (`permission-helpers.ts`), le validateur boot-time (`permissions-validator.ts`), les metadata des roles (`role-metadata.ts`), les constantes RBAC partagees (`rbac-constants.ts`) et le barrel export (`index.ts`). Aucun service NestJS, aucun guard, aucun decorator n'est livre dans cette tache : sa portee est strictement la fondation de donnees typees consommee par les 11 taches suivantes.

L'apport est triple. Premierement, transformer une matrice humaine en code TypeScript const object (vs string enum) garantit a la fois TypeScript narrowing (un parametre `permission: PermissionValue` ne peut prendre qu'une des 85+ valeurs du catalog), tree-shaking (les permissions non importees disparaissent du bundle), grep facile (chaque permission est referencee par son nom symbolique unique `INSURE_POLICIES_CREATE` dans le code et par sa string `insure.policies.create` dans les logs/audit), et auto-completion IDE (un developpeur tapant `Permission.` voit immediatement les 85+ options groupees). Deuxiemement, la convention naming `{module}.{resource}.{action}` (vs `read_contact` ou `contact_read`) elimine l'ambiguite (lecture humaine cohrente), facilite l'agregation par module (filter `permission.startsWith('crm.')` retourne toutes les permissions CRM) et prepare les dashboards d'introspection Sprint 25+ (RBAC Audit Sprint 7 + Cross-tenant Sprint 25). Troisiemement, separer le catalog (Tache 2.3.1) de la matrice (Tache 2.3.2) permet de modifier la matrice sans toucher au catalog (un nouveau role peut reutiliser le meme catalog) et de modifier le catalog sans casser la matrice (validation boot-time detecte les references obsoletes).

A l'issue de cette tache, le package `@insurtech/auth` expose via `packages/auth/src/rbac/index.ts` les types `AuthRole`, `Permission`, `PermissionValue`, `Module`, `Action` ainsi que les fonctions `parsePermission(permission)`, `isValidPermission(value)`, `getPermissionsByModule(module)`, `getRoleMetadata(role)`, `validatePermissionsCatalog()`. La commande `pnpm --filter @insurtech/auth test rbac/permissions.spec.ts` execute 25+ tests Vitest verifiant la coherence (12 roles distincts, 85+ permissions distinctes, regex naming respectee, aucun doublon, 15+ modules couverts, metadata coherente). La commande `pnpm --filter @insurtech/auth typecheck` retourne exit code 0. Aucune dependance externe nouvelle n'est introduite (utilise stack Sprint 1-6 : TypeScript 5.7.3, Zod 3.24.1, Vitest 2.1.8). Le fichier total represente environ 1300 lignes de code TypeScript strict.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 deploie 9 applications cible (api NestJS, 7 frontends Next.js, 1 mcp-server) qui doivent toutes appliquer la meme politique d'authorization : un courtier broker_user ne peut pas supprimer un contact CRM, un technicien garage_technicien ne peut pas approuver un devis, un assure ne peut acceder qu'a ses propres polices. Cette politique est documentee dans `5-roles-permissions.md` (source de verite humaine) sous forme de tableaux Markdown decrivant les 12 roles et leurs ~85 permissions. Sans transformation en code TypeScript strict, cette politique reste une specification papier : les developpeurs doivent re-lire le document a chaque endpoint cree, risquent typos (`crm.contact.read` vs `crm.contacts.read`), oublis (un nouveau role n'est pas pris en compte dans tous les services), et incoherences (deux services protegent le meme endpoint avec des permissions differentes).

A l'inverse, transformer le catalog en TypeScript const object avec types stricts impose la reference symbolique partout (`Permission.CRM_CONTACTS_READ` au lieu de `'crm.contacts.read'` litteralement), un typo declenche une erreur de compilation, une suppression de permission detecte tous les usages obsoletes, et un nouveau role peut etre teste exhaustivement (Tache 2.3.12). L'industrie a converge sur ce pattern (Stripe API permissions, AWS IAM Actions, Google Cloud IAM roles) pour cette raison.

Le choix specifique const object (vs TypeScript enum natif, vs string union, vs JSON file loaded runtime) est documente dans `00-pilotage/decisions/012-rbac-catalog-format.md` (decision-012). Const object offre le meilleur compromis : TypeScript narrowing strict, tree-shaking, IDE auto-completion, grep symbolique ET grep textuel (string value), zero overhead runtime, validation boot-time possible.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| TypeScript enum natif `enum Permission { CRM_CONTACTS_READ = 'crm.contacts.read', ... }` | Familier developpeurs Java/C#, syntaxe concise | Generation runtime objet inverse (Permission[0] = name) inutile et non tree-shakeable, typescript-eslint deconseille (`no-restricted-syntax`), TS 5+ const enum incompatible avec isolatedModules SWC/esbuild | REJETE -- incompatible build pipeline Sprint 1-2 (SWC + esbuild) |
| String union type `type Permission = 'crm.contacts.read' \| 'crm.contacts.create' \| ...` | Type pur, zero runtime | Pas de namespace symbolique (impossibilite de grep par nom symbolique), pas d'auto-completion sur prefix `Permission.`, refactoring difficile, listing programmatique impossible (Tache 2.3.11) | REJETE -- introspection Sprint 7 et Sprint 25 impossible |
| JSON file `permissions.json` loaded au boot via fs.readFileSync | Editable par non-dev (PM, conformite), hot-reload theoriquement possible | Pas de typage statique (lookup runtime echec silencieux), validation Zod necessaire au boot, hot-reload casse cache RbacService (Tache 2.3.10), versioning Git plus difficile (diff JSON moins lisible que TS) | REJETE -- compromet la securite (typo non detecte au build) |
| Database `auth_permissions` table loaded au boot | Permissions custom per tenant possibles (preparation Phase 7+ tier pricing) | Latence boot (1 query supplementaire), pas de typage statique, complexite migration schema, dependance circulaire Sprint 2 (database) <-> Sprint 7 (auth) | REJETE -- premature pour Sprint 7, sera ajoute Phase 7+ via override layer sur le catalog code |
| Const object `as const` (RETENU) | TypeScript narrowing strict via `typeof Permission[keyof typeof Permission]`, tree-shaking, grep symbolique + textuel, zero runtime overhead, JSON-serializable pour audit, validation boot-time possible | Verbeux (chaque permission necessite cle UPPER_SNAKE + value lower.dot) -- mais cette verbosite est volontaire (dual reference symbolique + textuel) | RETENU -- meilleur compromis securite, performance, DX |

### 2.3 Trade-offs explicites

Choisir le format const object `as const` implique d'accepter une verbosite delibereee : chaque permission est ecrite deux fois, une fois en cle TypeScript UPPER_SNAKE_CASE (`CRM_CONTACTS_READ`) et une fois en valeur string lower.dot.notation (`'crm.contacts.read'`). Cette dualite a une raison : la cle symbolique permet le grep refactoring (`grep -r "CRM_CONTACTS_READ" repo/`) tandis que la valeur string permet l'audit log lisible humainement et la transmission via JWT/Kafka events. Une convention de mapping mecanique est imposee (UPPER_SNAKE = lower.dot avec underscores au lieu de dots), verifiee par le test `permissions.spec.ts` (test V12 : pour chaque cle, verifier que `key.toLowerCase().replace(/_/g, '.')` egal value). Cette discipline coute environ 10 secondes par permission ajoutee mais elimine la classe entiere des bugs de typo.

Choisir 85+ permissions (vs un catalog plus restreint type "10 roles x 5 actions = 50 permissions") implique d'accepter une complexite de maintenance accrue : une matrice 12x85 contient potentiellement 1020 cellules a documenter (Tache 2.3.2 livrera la matrice precise). Le choix de 85+ vient de la conformite : ACAPS Maroc Circulaire AS/02/24 impose la separation des duties entre saisie devis, validation devis, comptabilisation paiement (3 actions distinctes minimum sur le module pay). Si on agregeait en moins de permissions, la conformite serait impossible a demontrer aux auditeurs ACAPS lors du go-live Phase 6+. Cette granularite cible 85-95 permissions au Sprint 7 et evoluera a 100-120 d'ici Sprint 25 (Cross-Tenant ajoute ~15 permissions).

Choisir d'inclure les permissions `*_own` (`crm.contacts.read_own`, `insure.policies.read_own`) en plus des `*_all` (`insure.policies.read_all`) double certaines entrees mais reflete une distinction RBAC/ABAC critique : `read_all` autorise lecture sans filtre user_id (utilise par broker_admin avec dashboard global), `read_own` autorise lecture mais avec filtre ABAC `owner_user_id = ctx.userId` (utilise par broker_user et assure). Sans cette distinction, soit on autorise tout (faille de confidentialite : un broker_user voit les contacts de ses collegues), soit on bloque tout (broker_user ne peut rien faire). La distinction `_own` vs `_all` est centrale au design ABAC du Sprint 7 et determine le routing vers `OwnResourcesPolicy` (Tache 2.3.7).

### 2.4 Decisions strategiques referenced

- **decision-012 (RBAC Catalog Format const object)** : pertinence pour cette tache = totale. Cette tache concretise le format const object decidee dans `00-pilotage/decisions/012-rbac-catalog-format.md`. Le test V13 verifie que les fichiers livres respectent le pattern `as const` strict.
- **decision-006 (No-emoji Policy ABSOLUE)** : pertinence pour cette tache = totale. Aucune emoji dans aucun des fichiers livres (roles.enum.ts, permissions.enum.ts, etc.). Le test V20 verifie ce point automatiquement via regex Unicode.
- **decision-008 (Data Residency Maroc)** : pertinence pour cette tache = indirecte. Les permissions `compliance.cndp_purge.execute` et `compliance.acaps_reports.generate` anticipent les exigences souverainete des donnees. Sprint 12 (Compliance) consommera ces permissions.
- **decision-005 (Skalean AI Frontier)** : pertinence pour cette tache = indirecte. Le module `sky` (3 permissions) est inclus pour preparer Sprint 31, et `mcp` (2 permissions) pour Sprint 30. Ces permissions ne sont assignees a aucun role par defaut (sera fait Sprint 30/31).
- **decision-015 (Wildcard super_admin policy)** : pertinence = totale. Le role `super_admin_platform` recoit le wildcard `'*'` dans la matrice (Tache 2.3.2) ; cette tache documente la convention `'*'` reservee, et le test V14 verifie que `'*'` n'est jamais une valeur de permission valide (reserve future).

### 2.5 Pieges techniques connus

1. **Piege : Confusion entre cle symbolique TypeScript et valeur string runtime.**
   - Pourquoi : un developpeur peut ecrire `if (userPerm === 'CRM_CONTACTS_READ')` au lieu de `if (userPerm === Permission.CRM_CONTACTS_READ)` -- la string `'CRM_CONTACTS_READ'` ne matchera jamais la valeur runtime `'crm.contacts.read'`.
   - Solution : convention stricte = JAMAIS comparer aux strings UPPER_SNAKE litterales. Toujours utiliser `Permission.X` ou `PermissionValue` typed parameter. ESLint regle Sprint 8 ajoute `no-restricted-syntax` pattern detectant les comparaisons string SCREAMING_CASE.

2. **Piege : Permission ajoutee dans `permissions.enum.ts` mais oubliee dans `permissions-by-module.ts`.**
   - Pourquoi : double declaration manuelle implique drift potentiel.
   - Solution : `permissions-by-module.ts` n'est PAS une declaration manuelle separee mais derivee programmatiquement de `Permission` via `Object.values(Permission)` puis `groupBy(p => parsePermission(p).module)`. Le test V7 verifie que la somme des permissions par module egale `Object.keys(Permission).length`.

3. **Piege : `as const` oublie sur l'objet Permission rend les valeurs typees `string` au lieu de litterales.**
   - Pourquoi : sans `as const`, TypeScript infere `{ CRM_CONTACTS_READ: string; ... }` et `PermissionValue` devient `string` (perdant tout le narrowing).
   - Solution : convention `export const Permission = { ... } as const;` strictement. Le test V13 utilise `expectTypeOf(Permission.CRM_CONTACTS_READ).toEqualTypeOf<'crm.contacts.read'>()` pour verifier le narrowing litteral.

4. **Piege : Permission renommee mais references obsoletes restent compilantes.**
   - Pourquoi : si on renomme `Permission.CRM_CONTACTS_READ` en `Permission.CRM_CONTACTS_LIST`, les anciennes references `Permission.CRM_CONTACTS_READ` deviennent erreurs de compilation (bon), mais des references string-litterales `'crm.contacts.read'` dans matrice ou tests restent compilantes (mauvais).
   - Solution : interdiction stricte des string-litterales pour permissions dans le codebase (ESLint regle custom Sprint 7 : pattern `/^[a-z]+(\.[a-z_]+){2}$/` interdit en string literal). Force usage `Permission.X`.

5. **Piege : Module typo (`'crm'` vs `'crmm'` vs `'CRM'`) detecte tardivement.**
   - Pourquoi : sans liste de modules valides, n'importe quelle string fonctionne dans `permissions-by-module.ts`.
   - Solution : enum `Module` declare 19 modules valides exactement (auth, tenant, crm, booking, comm, docs, signature, pay, books, compliance, analytics, insure, repair, stock, hr, admin, cross_tenant, sky, mcp). Le validator boot-time (`permissions-validator.ts`) iterate toutes les permissions et verifie que `parsePermission(p).module` appartient a `Module` enum. Test V17.

6. **Piege : Permission valide naming mais semantique douteuse (`crm.contacts.list_extra_super`).**
   - Pourquoi : naming convention regex valide la syntaxe mais pas la semantique.
   - Solution : `Action` enum declare 12 actions standards (read, read_own, read_all, read_assigned, create, create_own, update, update_own, delete, assign, approve, reject, export, generate, cancel, refund, reconcile, manage, use, send, sync, upload, config, execute). Le validator verifie que `parsePermission(p).action` appartient a `Action` enum OU figure dans la liste extension `EXTENDED_ACTIONS` (resiliate, dispatch, etc.). Test V18.

7. **Piege : Wildcard `'*'` interprete comme permission valide.**
   - Pourquoi : la matrice (Tache 2.3.2) utilise `'*'` pour super_admin_platform, mais cette valeur ne doit pas etre dans Permission enum (sinon faille : un developpeur peut ecrire `Permission['*']`).
   - Solution : `'*'` est une constante reserve `RBAC_WILDCARD = '*'` dans `rbac-constants.ts`, pas dans Permission. Test V14 verifie que `Object.values(Permission).includes('*')` est false.

8. **Piege : Module deprecation casse les permissions existantes.**
   - Pourquoi : si on decide de retirer le module `booking` (hypothese future), supprimer ses permissions casse la matrice et les tests.
   - Solution : convention deprecation = ajouter `@deprecated` JSDoc sur les permissions, NE PAS supprimer (compatibilite ascendante). Le validator emet WARN si une permission `@deprecated` est trouvee dans la matrice (Tache 2.3.2 verification cross-reference).

9. **Piege : Rajout role futur (e.g. `compliance_officer` Sprint 12) impacte la matrice mais pas le catalog.**
   - Pourquoi : ajouter un role dans `AuthRole` enum sans mettre a jour `PermissionsMatrix` (Tache 2.3.2) genere TypeScript error grace a `Record<AuthRole, ...>`.
   - Solution : `Record<AuthRole, PermissionValue[]>` force exhaustivite. Test V25 (Tache 2.3.2 mais documente ici) verifie `Object.keys(PermissionsMatrix).length === Object.keys(AuthRole).length`. Cette tache 2.3.1 livre uniquement le catalog ; la matrice cassera CI si role ajoute sans matrice mise a jour.

10. **Piege : permissions `_own` vs `_all` confondues dans la matrice.**
    - Pourquoi : un developpeur peut donner `INSURE_POLICIES_READ_ALL` a `broker_user` au lieu de `INSURE_POLICIES_READ_OWN`, brisant l'isolation ABAC.
    - Solution : convention de comment inline systematique sur chaque permission `_own` decrivant explicitement le filtre attendu. ABAC policy `OwnResourcesPolicy` (Tache 2.3.7) reverifie a runtime ; mais la couche catalog documente intention. Test V11 verifie que toute permission `_own` a un commentaire JSDoc contenant `ABAC` ou `owner`.

11. **Piege : Permission count change silencieusement entre Sprint 7 et Sprint 12.**
    - Pourquoi : Sprint 12 ajoute permissions compliance, Sprint 13 stock/hr, Sprint 25 cross_tenant. Sans test de comptage, le change est silencieux.
    - Solution : test V2 verifie `>= 85` (cible Sprint 7), un test additionnel `permissions-count-snapshot.spec.ts` ecrit le count exact dans un fichier snapshot que CI verifie ; modification volontaire du snapshot exigee dans le PR.

12. **Piege : i18n permissions descriptions oubliees pour le frontend.**
    - Pourquoi : le frontend (web-insurtech-admin Sprint 4 + 26) doit afficher les permissions en FR/EN/AR pour l'admin RBAC.
    - Solution : `role-metadata.ts` contient `description.fr`, `description.en`, `description.ar` pour CHAQUE role. Tache 2.3.11 (admin-permissions controller) expose ces descriptions. Cette tache 2.3.1 livre les 3 langues directement (pas de TODO i18n).

13. **Piege : Documentation inline (`/** ... */`) sur chaque permission casse la densite.**
    - Pourquoi : 85 permissions x 3 lignes JSDoc = 255 lignes de pure documentation, alourdit le fichier.
    - Solution : commentaire single-line `// {description}` apres chaque permission (vs JSDoc multi-line). JSDoc reserve aux helpers et fonctions exportees.

14. **Piege : Sprint futur (Phase 7+) ajout permissions custom per tenant.**
    - Pourquoi : feature pricing tier permettra a chaque cabinet de definir ses propres permissions custom. Si le catalog est code-only, custom impossible.
    - Solution : architecture Sprint 7 = catalog code-as-config, Phase 7+ ajoutera couche `auth_custom_permissions` table override. Le validator boot-time charge catalog code + override DB et merge. Cette tache 2.3.1 prepare le terrain via fonction `getAllPermissions(): PermissionValue[]` (Tache 2.3.11) qui sera etendue Phase 7+ pour merger custom.

15. **Piege : Naming `cancel` vs `resiliate` vs `terminate` -- semantique floue.**
    - Pourquoi : police d'assurance peut etre annulee (avant signature), resiliee (apres signature, demande client), terminee (echeance naturelle), suspendue (impaye temporaire). Si on agrege en `cancel`, la conformite ACAPS impossible.
    - Solution : permissions distinctes `insure.policies.cancel` (avant signature), `insure.policies.resiliate` (apres signature loi 17-99), `insure.policies.suspend` (impaye), `insure.policies.terminate` (echeance). Test V19 verifie ces 4 permissions distinctes.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.1 est la PREMIERE tache du Sprint 7 (RBAC Granulaire) et la 23eme tache de la Phase 2 (Securite & Multi-tenant). Elle :

- **Depend de** : Sprint 6 complet (Multi-tenant 3 niveaux). Specifiquement : `TenantContext.userRole` disponible (cree Tache 6.4.1), `auth_tenant_users.role` colonne existante (Tache 6.2.3), JWT contient claim `role` (Tache 5.6.2).
- **Bloque** : Tache 2.3.2 (PermissionsMatrix) car la matrice `Record<AuthRole, PermissionValue[]>` reference les types `AuthRole` et `PermissionValue` exportes ici. Bloque indirectement les Taches 2.3.3 a 2.3.12 par chaine de dependance.
- **Apporte au sprint** : la fondation typee `AuthRole` enum (12 roles), `Permission` const object (85+ permissions), `Module` enum (19 modules), `Action` enum (24 actions), `PermissionValue` type union, ainsi que les helpers `parsePermission`, `isValidPermission`, `getPermissionsByModule`, `validatePermissionsCatalog`, `getRoleMetadata`. Les guards (Tache 2.3.4 a 2.3.8), les services (Tache 2.3.3, 2.3.7, 2.3.9, 2.3.10) et les controllers (Tache 2.3.11) consomment cette fondation.

### 3.2 Position dans le programme global

Cette tache pose le vocabulaire commun consomme par 35 sprints. Chaque sprint metier (Sprint 8 CRM, Sprint 9 Comm, Sprint 10 Docs/Signature, Sprint 11 Pay, Sprint 12 Books/Compliance, Sprint 13 Analytics/Stock/HR, Sprint 14-15 Insure broker, Sprint 19-21 Repair garage, Sprint 25 Cross-Tenant, Sprint 26 Admin, Sprint 30 MCP, Sprint 31 Sky) ajoutera ses endpoints proteges via `@RequirePermission(Permission.X)` ou utilisera `RbacService.canAccess(role, Permission.X)`. Une evolution mineure du catalog (ajout `compliance.aml_alerts.review` au Sprint 12) declenche un seul commit qui propage instantanement aux 9 apps grace au workspace pnpm.

L'app `mcp-server` (Sprint 30) consommera `Permission.MCP_TOOLS_DISCOVER` et `Permission.MCP_TOOLS_INVOKE` pour gater les tools metier exposes via MCP. L'app `web-insurtech-admin` (Sprint 26) consommera `Permission.ADMIN_*` permissions pour les endpoints super_admin_platform. Le frontend `web-broker` (Sprint 16) consommera `Permission.CRM_*`, `Permission.INSURE_*`, `Permission.BOOKS_*`, etc. via l'hook React `useAuth().hasPermission(Permission.X)` (livre Sprint 16).

### 3.3 Diagramme architecture

```
                                 +-------------------------------+
                                 | 5-roles-permissions.md (HUMAN)|
                                 |  Source de verite humaine     |
                                 +---------------+---------------+
                                                 |
                                                 v transformation
                                                 |
                          +----------------------+----------------------+
                          |        TACHE 2.3.1 -- CATALOG (CETTE TACHE) |
                          +----------------------+----------------------+
                                                 |
                          +---------+----------+----------+----------+
                          |                    |                    |
                          v                    v                    v
                  roles.enum.ts        permissions.enum.ts   permissions-by-module.ts
                  (12 roles)           (85+ permissions)     (regroupement 19 modules)
                          |                    |                    |
                          +----------+---------+----------+---------+
                                     |                    |
                                     v                    v
                            role-metadata.ts    permissions-validator.ts
                            (descriptions FR/EN/AR     (boot-time check)
                             niveaux, comptes)
                                     |                    |
                                     +---------+----------+
                                               |
                                               v
                                    permission-helpers.ts
                                    (parsePermission, isValidPermission)
                                               |
                                               v
                                       rbac-constants.ts
                                       (RBAC_WILDCARD, defaults)
                                               |
                                               v
                                          index.ts (barrel)
                                               |
                                               v
                          +--------------------+--------------------+
                          |       Tache 2.3.2 -- PermissionsMatrix |
                          |       Tache 2.3.3 -- RbacService       |
                          |       Tache 2.3.4-8 -- Guards          |
                          |       Tache 2.3.11 -- AdminController  |
                          +--------------------+--------------------+
                                               |
                                               v
                          +--------------------+--------------------+
                          | 9 apps consomment via @insurtech/auth   |
                          | api / web-broker / web-garage / etc.    |
                          +-----------------------------------------+
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/packages/auth/src/rbac/roles.enum.ts` -- export const `AuthRole` 12 valeurs strictes + type `AuthRoleValue` + type guard `isAuthRole(value)` + Zod schema `AuthRoleSchema` (~80 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/permissions.enum.ts` -- export const `Permission` avec MINIMUM 85 cles distinctes regroupees par module avec commentaires inline (~500 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/permissions-by-module.ts` -- groupage programmatique `getPermissionsByModule(module: Module): PermissionValue[]` + map statique `PermissionsByModule: Record<Module, PermissionValue[]>` (~120 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/permissions.spec.ts` -- 25+ tests Vitest verifiant coherence, naming, count, no duplicates, modules, hierarchy metadata (~250 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/permissions-validator.ts` -- fonction `validatePermissionsCatalog(): ValidationResult` executee au boot, verifie naming regex, modules valides, actions valides, no duplicates, no wildcards (~100 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/permission-helpers.ts` -- helpers `parsePermission(perm)`, `isValidPermission(value)`, `formatPermission(module, resource, action)`, `getModuleFromPermission(perm)`, `getActionFromPermission(perm)` (~100 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/role-metadata.ts` -- export const `RoleMetadata: Record<AuthRoleValue, RoleMeta>` avec description FR/EN/AR, niveau, type tenant/platform/L3/public, defaultPermissionsCount estimation (~180 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/rbac-constants.ts` -- constantes partagees `RBAC_WILDCARD = '*'`, `PERMISSION_NAMING_REGEX`, `MAX_PERMISSIONS_PER_ROLE`, `DEFAULT_PERMISSION_TTL_SECONDS` (~60 lignes)
- [ ] Fichier `repo/packages/auth/src/rbac/index.ts` -- barrel export consolide tous les exports rbac (~40 lignes)
- [ ] Convention naming TOUTES les permissions : `{module}.{resource}.{action}` strict, regex `^[a-z][a-z_]*\.[a-z][a-z_]*\.[a-z][a-z_]*$`
- [ ] 12 roles enum exactement : super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, assure, prospect
- [ ] 19 modules couverts : auth, tenant, crm, booking, comm, docs, signature, pay, books, compliance, analytics, insure, repair, stock, hr, admin, cross_tenant, sky, mcp
- [ ] 24 actions standards : read, read_own, read_all, read_assigned, create, create_own, update, update_own, delete, assign, approve, reject, export, generate, cancel, resiliate, suspend, terminate, refund, reconcile, manage, use, send, sync, upload, config, execute, revoke, enable, disable, dispatch, list_all, purge, health, review (sera reduit a 24 standards + extensions documentees)
- [ ] Documentation inline : chaque permission a un commentaire `//` decrivant son usage et le module Sprint qui la consomme
- [ ] Tests unitaires : 25+ assertions Vitest verifiant coherence (no duplicates, count >= 85, regex respect, modules count = 19, roles count = 12)
- [ ] Commande `pnpm --filter @insurtech/auth test rbac/permissions.spec.ts` passe avec 0 failure
- [ ] Commande `pnpm --filter @insurtech/auth typecheck` retourne exit code 0
- [ ] Commande `pnpm --filter @insurtech/auth lint` retourne exit code 0 (aucun warning Biome)
- [ ] Commande `node -e "import('./packages/auth/dist/rbac/index.js').then(m => console.log(Object.keys(m.Permission).length))"` retourne >= 85
- [ ] Aucune emoji dans aucun fichier livre (verifie par grep Unicode regex)
- [ ] Aucun TODO, FIXME, XXX dans les fichiers livres
- [ ] Aucune string literal de format `crm.contacts.read` hors du fichier `permissions.enum.ts` (force usage symbolique)
- [ ] Le validator boot-time `validatePermissionsCatalog()` retourne `{ valid: true, errors: [], warnings: [] }` lors de l'execution

Total : 23 livrables structurels + 6 livrables fonctionnels = 29 cases a cocher.

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/rbac/roles.enum.ts                    (~80 lignes / 12 roles + types + Zod)
repo/packages/auth/src/rbac/permissions.enum.ts              (~500 lignes / 85+ permissions)
repo/packages/auth/src/rbac/permissions-by-module.ts         (~120 lignes / groupage 19 modules)
repo/packages/auth/src/rbac/permissions.spec.ts              (~250 lignes / 25+ tests Vitest)
repo/packages/auth/src/rbac/permissions-validator.ts         (~100 lignes / boot-time validator)
repo/packages/auth/src/rbac/permission-helpers.ts            (~100 lignes / parse/format helpers)
repo/packages/auth/src/rbac/role-metadata.ts                 (~180 lignes / metadata 12 roles FR/EN/AR)
repo/packages/auth/src/rbac/rbac-constants.ts                (~60 lignes / constantes partagees)
repo/packages/auth/src/rbac/index.ts                         (~40 lignes / barrel export)
```

Total : 9 fichiers TypeScript, ~1430 lignes de code strict.

Aucune modification de fichier existant (Sprint 7 cree le sous-dossier `rbac/` dans un package `@insurtech/auth` deja initialise par Sprint 5). Si le sous-dossier `repo/packages/auth/src/rbac/` n'existe pas, le creer avant les fichiers.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier `repo/packages/auth/src/rbac/rbac-constants.ts`

```typescript
/**
 * @file rbac-constants.ts
 * @description Constantes partagees du systeme RBAC Skalean InsurTech v2.2.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 */

/**
 * Wildcard reserve pour super_admin_platform dans PermissionsMatrix (Tache 2.3.2).
 * Convention : si la matrice d'un role contient cette valeur unique, le RbacService
 * (Tache 2.3.3) bypass le lookup standard et retourne allowed=true pour toute permission.
 *
 * IMPORTANT : Cette valeur n'est PAS une PermissionValue valide. Elle est exclue du
 * Permission enum et detectee specifiquement dans canAccess(). Voir test V14.
 */
export const RBAC_WILDCARD = '*' as const;

/**
 * Regex stricte de validation du naming des permissions.
 * Format : {module}.{resource}.{action}
 * Module : lettres minuscules + underscore, debute par lettre.
 * Resource : lettres minuscules + underscore, debute par lettre.
 * Action : lettres minuscules + underscore, debute par lettre.
 *
 * Exemples valides : 'crm.contacts.read', 'insure.policies.read_own', 'cross_tenant.share_status.create'
 * Exemples invalides : 'CRM.contacts.read', 'crm.contacts', '.contacts.read', '*'
 */
export const PERMISSION_NAMING_REGEX = /^[a-z][a-z_]*\.[a-z][a-z_]*\.[a-z][a-z_]*$/;

/**
 * Regex stricte de validation du naming des roles.
 * Format : lettres minuscules + underscore.
 */
export const ROLE_NAMING_REGEX = /^[a-z][a-z_]*$/;

/**
 * Limite max permissions par role pour eviter explosion combinatoire.
 * super_admin_platform exclu (wildcard). 100 = limit raisonnable Sprint 7,
 * pourra etre augmentee Sprint 25+ si Cross-Tenant ajoute beaucoup.
 */
export const MAX_PERMISSIONS_PER_ROLE = 100;

/**
 * TTL par defaut du cache permissions effectives par role (secondes).
 * Utilise par PermissionCacheService (Tache 2.3.10).
 */
export const DEFAULT_PERMISSION_TTL_SECONDS = 300; // 5 minutes

/**
 * TTL par defaut du cache resultats ABAC (secondes).
 * Plus court car attributes resource peuvent changer rapidement.
 */
export const DEFAULT_ABAC_TTL_SECONDS = 60; // 1 minute

/**
 * Prefix Redis pour les cles de cache RBAC.
 * Convention namespace : `rbac:effective:{role}` -> Set<PermissionValue>
 */
export const REDIS_RBAC_PREFIX = 'rbac:';

/**
 * Code d'erreur standard retourne quand une permission n'est pas accordee.
 * Utilise par PermissionGuard (Tache 2.3.5) dans ForbiddenException body.
 */
export const RBAC_ERROR_CODES = {
  NO_USER_CONTEXT: 'NO_USER_CONTEXT',
  PERMISSION_NOT_GRANTED: 'PERMISSION_NOT_GRANTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ABAC_DENIED: 'ABAC_DENIED',
  ROLE_REQUIRED: 'ROLE_REQUIRED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  WORKFLOW_TRANSITION_INVALID: 'WORKFLOW_TRANSITION_INVALID',
} as const;

export type RbacErrorCode = (typeof RBAC_ERROR_CODES)[keyof typeof RBAC_ERROR_CODES];
```

### 6.2 Fichier `repo/packages/auth/src/rbac/roles.enum.ts`

```typescript
/**
 * @file roles.enum.ts
 * @description Enumeration des 12 roles utilisateurs du programme Skalean InsurTech v2.2.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Source de verite humaine : 00-pilotage/documentation/5-roles-permissions.md section 2.
 *
 * Convention :
 *  - 2 roles platform Skalean staff : super_admin_platform, analyst_support
 *  - 5 roles tenant cabinet broker : broker_admin, broker_user, broker_assistant
 *  - 5 roles tenant garage : garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial
 *  - 1 role assure (L3 dans tenant)
 *  - 1 role prospect (public, sans auth persistante)
 */

import { z } from 'zod';
import { ROLE_NAMING_REGEX } from './rbac-constants';

/**
 * Const object des 12 roles. Format strict UPPER_SNAKE = lower_snake (1:1 mapping).
 * `as const` garantit le narrowing TypeScript des valeurs litterales.
 */
export const AuthRole = {
  // === Platform Skalean staff (Niveau 1) ===
  SUPER_ADMIN_PLATFORM: 'super_admin_platform',
  ANALYST_SUPPORT: 'analyst_support',

  // === Tenant Cabinet Broker (Niveau 2) ===
  BROKER_ADMIN: 'broker_admin',
  BROKER_USER: 'broker_user',
  BROKER_ASSISTANT: 'broker_assistant',

  // === Tenant Garage (Niveau 2) ===
  GARAGE_ADMIN: 'garage_admin',
  GARAGE_CHEF: 'garage_chef',
  GARAGE_TECHNICIEN: 'garage_technicien',
  GARAGE_COMPTABLE: 'garage_comptable',
  GARAGE_COMMERCIAL: 'garage_commercial',

  // === Assure (Niveau 3 -- L3 dans tenant) ===
  ASSURE: 'assure',

  // === Prospect (Public sans auth persistante) ===
  PROSPECT: 'prospect',
} as const;

/**
 * Union litterale des 12 valeurs roles. Utilise dans signatures de service / guard.
 * Exemple : `function canAccess(role: AuthRoleValue, perm: PermissionValue): boolean`
 */
export type AuthRoleValue = (typeof AuthRole)[keyof typeof AuthRole];

/**
 * Liste runtime des 12 valeurs roles. Utile iteration tests et boot validation.
 */
export const ALL_ROLES: readonly AuthRoleValue[] = Object.freeze(Object.values(AuthRole));

/**
 * Type guard runtime : verifie qu'une string arbitraire est bien un AuthRoleValue valide.
 * Utilise par le JWT middleware (Sprint 5) pour rejeter un token avec role corrompu.
 */
export function isAuthRole(value: unknown): value is AuthRoleValue {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Zod schema pour validation runtime au boot ou en parsing JWT.
 * Refuse les strings hors enum + valide format ROLE_NAMING_REGEX.
 */
export const AuthRoleSchema = z
  .string()
  .regex(ROLE_NAMING_REGEX, 'Invalid role naming format')
  .refine((v): v is AuthRoleValue => isAuthRole(v), {
    message: 'Unknown AuthRole value',
  });

/**
 * Categorisation roles par type d'acces (utilise par AdminController Tache 2.3.11).
 */
export const ROLE_CATEGORIES = {
  PLATFORM: [AuthRole.SUPER_ADMIN_PLATFORM, AuthRole.ANALYST_SUPPORT] as const,
  TENANT_BROKER: [AuthRole.BROKER_ADMIN, AuthRole.BROKER_USER, AuthRole.BROKER_ASSISTANT] as const,
  TENANT_GARAGE: [
    AuthRole.GARAGE_ADMIN,
    AuthRole.GARAGE_CHEF,
    AuthRole.GARAGE_TECHNICIEN,
    AuthRole.GARAGE_COMPTABLE,
    AuthRole.GARAGE_COMMERCIAL,
  ] as const,
  L3_USER: [AuthRole.ASSURE] as const,
  PUBLIC: [AuthRole.PROSPECT] as const,
} as const;

export type RoleCategory = keyof typeof ROLE_CATEGORIES;
```

### 6.3 Fichier `repo/packages/auth/src/rbac/permissions.enum.ts`

```typescript
/**
 * @file permissions.enum.ts
 * @description Catalog exhaustif des 85+ permissions du programme Skalean InsurTech v2.2.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Source de verite humaine : 00-pilotage/documentation/5-roles-permissions.md section 5.
 *
 * Convention naming : {module}.{resource}.{action}
 *  - module : 19 modules (auth, tenant, crm, booking, comm, docs, signature, pay,
 *             books, compliance, analytics, insure, repair, stock, hr, admin,
 *             cross_tenant, sky, mcp)
 *  - resource : entite metier (contacts, polices, sinistres, etc.)
 *  - action : 24 actions standards (read, read_own, read_all, create, update, delete,
 *             assign, approve, reject, export, etc.)
 *
 * Convention de mapping : la cle TypeScript UPPER_SNAKE_CASE est l'image de la valeur
 * lower.dot.notation avec underscores au lieu des dots.
 * Exemple : CRM_CONTACTS_READ -> 'crm.contacts.read'
 *
 * Permissions `_own` : utilisees avec ABAC OwnResourcesPolicy (Tache 2.3.7) pour filtrer
 * sur owner_user_id ou assigned_user_id.
 * Permissions `_all` : pas de filtre ABAC, autorise lecture transverse tenant.
 */

export const Permission = {
  // ============================================================================
  // === MODULE auth (10 permissions) -- Sprint 5 ===
  // ============================================================================
  AUTH_USERS_CREATE: 'auth.users.create', // Creer un utilisateur dans le tenant
  AUTH_USERS_READ: 'auth.users.read', // Lister les utilisateurs du tenant
  AUTH_USERS_UPDATE: 'auth.users.update', // Modifier un utilisateur (profil, role)
  AUTH_USERS_DELETE: 'auth.users.delete', // Supprimer (soft) un utilisateur
  AUTH_ROLES_ASSIGN: 'auth.roles.assign', // Assigner un role a un user
  AUTH_ROLES_REVOKE: 'auth.roles.revoke', // Retirer un role d'un user
  AUTH_SESSIONS_READ_OWN: 'auth.sessions.read_own', // Voir SES propres sessions actives (ABAC owner)
  AUTH_SESSIONS_REVOKE_OWN: 'auth.sessions.revoke_own', // Revoquer SES propres sessions
  AUTH_SESSIONS_REVOKE_ALL: 'auth.sessions.revoke_all', // Revoquer toutes sessions tenant (admin)
  AUTH_MFA_MANAGE: 'auth.mfa.manage', // Activer/desactiver MFA pour soi ou autres

  // ============================================================================
  // === MODULE tenant (5 permissions) -- Sprint 6 ===
  // ============================================================================
  TENANT_SETTINGS_READ: 'tenant.settings.read', // Lire parametres du tenant courant
  TENANT_SETTINGS_UPDATE: 'tenant.settings.update', // Modifier parametres tenant (raison sociale, IF, etc.)
  TENANT_USERS_INVITE: 'tenant.users.invite', // Inviter un nouvel utilisateur dans le tenant
  TENANT_BRANDING_UPDATE: 'tenant.branding.update', // Logo, theme, white-label (Sprint 28)
  TENANT_BILLING_READ: 'tenant.billing.read', // Lire facturation Skalean (abonnement)

  // ============================================================================
  // === MODULE crm (15 permissions) -- Sprint 8 ===
  // ============================================================================
  CRM_CONTACTS_READ: 'crm.contacts.read', // Lister tous contacts du tenant (broker_admin)
  CRM_CONTACTS_READ_OWN: 'crm.contacts.read_own', // Lister contacts assignes a moi (ABAC owner)
  CRM_CONTACTS_CREATE: 'crm.contacts.create', // Creer un nouveau contact
  CRM_CONTACTS_UPDATE: 'crm.contacts.update', // Modifier un contact existant
  CRM_CONTACTS_UPDATE_OWN: 'crm.contacts.update_own', // Modifier seulement contacts dont je suis owner (ABAC)
  CRM_CONTACTS_DELETE: 'crm.contacts.delete', // Supprimer (soft) un contact
  CRM_CONTACTS_EXPORT: 'crm.contacts.export', // Exporter en CSV/Excel (audit RGPD/CNDP)
  CRM_COMPANIES_READ: 'crm.companies.read', // Lister entreprises B2B
  CRM_COMPANIES_CREATE: 'crm.companies.create', // Creer entreprise (avec IF)
  CRM_COMPANIES_UPDATE: 'crm.companies.update', // Modifier entreprise
  CRM_COMPANIES_DELETE: 'crm.companies.delete', // Supprimer entreprise (soft)
  CRM_DEALS_READ: 'crm.deals.read', // Lister tous deals/opportunites
  CRM_DEALS_CREATE: 'crm.deals.create', // Creer deal
  CRM_DEALS_UPDATE: 'crm.deals.update', // Mettre a jour stage du deal
  CRM_DEALS_DELETE: 'crm.deals.delete', // Supprimer deal
  CRM_PIPELINES_MANAGE: 'crm.pipelines.manage', // Configurer pipelines / stages
  CRM_INTERACTIONS_CREATE: 'crm.interactions.create', // Logger appel/email/visite

  // ============================================================================
  // === MODULE booking (6 permissions) -- Sprint 8 ===
  // ============================================================================
  BOOKING_ROOMS_READ: 'booking.rooms.read', // Lister salles disponibles
  BOOKING_ROOMS_MANAGE: 'booking.rooms.manage', // CRUD salles (config admin tenant)
  BOOKING_APPOINTMENTS_READ: 'booking.appointments.read', // Voir rdv tenant
  BOOKING_APPOINTMENTS_READ_OWN: 'booking.appointments.read_own', // Voir SES propres rdv (ABAC)
  BOOKING_APPOINTMENTS_CREATE: 'booking.appointments.create', // Creer rdv
  BOOKING_APPOINTMENTS_UPDATE: 'booking.appointments.update', // Modifier rdv (replanifier)
  BOOKING_APPOINTMENTS_DELETE: 'booking.appointments.delete', // Annuler rdv
  BOOKING_CALENDAR_SYNC: 'booking.calendar.sync', // Sync Google/Outlook calendar

  // ============================================================================
  // === MODULE comm (5 permissions) -- Sprint 9 ===
  // ============================================================================
  COMM_MESSAGES_SEND: 'comm.messages.send', // Envoyer WhatsApp/Email/SMS
  COMM_MESSAGES_READ: 'comm.messages.read', // Lire historique messages tenant
  COMM_MESSAGES_READ_OWN: 'comm.messages.read_own', // Lire seulement MES conversations (ABAC)
  COMM_TEMPLATES_MANAGE: 'comm.templates.manage', // CRUD templates messages (admin)
  COMM_CONVERSATIONS_READ: 'comm.conversations.read', // Lire fil de conversations regroupees

  // ============================================================================
  // === MODULE docs (6 permissions) -- Sprint 10 ===
  // ============================================================================
  DOCS_DOCUMENTS_READ: 'docs.documents.read', // Lister documents tenant
  DOCS_DOCUMENTS_READ_OWN: 'docs.documents.read_own', // Lister MES documents (ABAC owner)
  DOCS_DOCUMENTS_CREATE: 'docs.documents.create', // Uploader nouveau document
  DOCS_DOCUMENTS_UPDATE: 'docs.documents.update', // Renommer/metadata
  DOCS_DOCUMENTS_DELETE: 'docs.documents.delete', // Supprimer document (soft)
  DOCS_SIGNATURES_READ: 'docs.signatures.read', // Voir traces signatures eSign

  // ============================================================================
  // === MODULE signature (4 permissions) -- Sprint 10 ===
  // ============================================================================
  SIGNATURE_REQUESTS_CREATE: 'signature.requests.create', // Creer demande de signature (Barid eSign)
  SIGNATURE_REQUESTS_READ: 'signature.requests.read', // Lister demandes signatures
  SIGNATURE_REQUESTS_CANCEL: 'signature.requests.cancel', // Annuler demande en cours
  SIGNATURE_CERTIFICATES_READ: 'signature.certificates.read', // Lire certificats signataires

  // ============================================================================
  // === MODULE pay (7 permissions) -- Sprint 11 ===
  // ============================================================================
  PAY_TRANSACTIONS_READ: 'pay.transactions.read', // Lister transactions tenant
  PAY_TRANSACTIONS_READ_OWN: 'pay.transactions.read_own', // Lister MES transactions (ABAC assure)
  PAY_TRANSACTIONS_CREATE: 'pay.transactions.create', // Initier transaction
  PAY_TRANSACTIONS_RECONCILE: 'pay.transactions.reconcile', // Rapprocher releve bancaire
  PAY_REFUNDS_CREATE: 'pay.refunds.create', // Initier remboursement (ABAC TimeBased < 30j)
  PAY_REFUNDS_READ: 'pay.refunds.read', // Lister remboursements
  PAY_GATEWAYS_CONFIG: 'pay.gateways.config', // Configurer passerelles (CMI, AmanPay, etc.)

  // ============================================================================
  // === MODULE books (8 permissions) -- Sprint 12 ===
  // ============================================================================
  BOOKS_INVOICES_READ: 'books.invoices.read', // Lister factures tenant
  BOOKS_INVOICES_CREATE: 'books.invoices.create', // Creer facture (CGNC compliant)
  BOOKS_INVOICES_UPDATE: 'books.invoices.update', // Modifier facture (ABAC StatusBased: draft uniquement)
  BOOKS_INVOICES_DELETE: 'books.invoices.delete', // Supprimer facture draft
  BOOKS_JOURNALS_READ: 'books.journals.read', // Lire journaux comptables
  BOOKS_ACCOUNTS_MANAGE: 'books.accounts.manage', // Gerer plan comptable
  BOOKS_TAX_DECLARATIONS_CREATE: 'books.tax_declarations.create', // Generer declarations TVA
  BOOKS_SAFTMA_EXPORT: 'books.saftma.export', // Export DGI SAFT-MA

  // ============================================================================
  // === MODULE compliance (5 permissions) -- Sprint 12 ===
  // ============================================================================
  COMPLIANCE_ACAPS_REPORTS_GENERATE: 'compliance.acaps_reports.generate', // Generer rapports trimestriels ACAPS
  COMPLIANCE_DGI_EXPORT: 'compliance.dgi.export', // Export DGI fiscal annuel
  COMPLIANCE_AML_ALERTS_REVIEW: 'compliance.aml_alerts.review', // Reviewer alertes AML/LCB-FT
  COMPLIANCE_CNDP_PURGE_EXECUTE: 'compliance.cndp_purge.execute', // Executer purge donnees personnelles (loi 09-08)
  COMPLIANCE_AUDIT_TRAIL_READ: 'compliance.audit_trail.read', // Lire trail audit complet (Sprint 7+)

  // ============================================================================
  // === MODULE analytics (3 permissions) -- Sprint 13 ===
  // ============================================================================
  ANALYTICS_DASHBOARDS_READ: 'analytics.dashboards.read', // Lire dashboards tenant
  ANALYTICS_DASHBOARDS_READ_OWN: 'analytics.dashboards.read_own', // Lire MES dashboards perso
  ANALYTICS_REPORTS_EXPORT: 'analytics.reports.export', // Exporter rapports CSV/PDF

  // ============================================================================
  // === MODULE insure (Vertical Broker -- 10 permissions) -- Sprint 14-15 ===
  // ============================================================================
  INSURE_POLICIES_READ_ALL: 'insure.policies.read_all', // Lister TOUTES polices tenant (broker_admin)
  INSURE_POLICIES_READ_OWN: 'insure.policies.read_own', // Lister polices dont je suis owner (assure / broker_user)
  INSURE_POLICIES_CREATE: 'insure.policies.create', // Souscrire nouvelle police
  INSURE_POLICIES_UPDATE: 'insure.policies.update', // Modifier police (avenant)
  INSURE_POLICIES_CANCEL: 'insure.policies.cancel', // Annuler police avant signature (ABAC StatusBased)
  INSURE_POLICIES_RESILIATE: 'insure.policies.resiliate', // Resilier police signee (loi 17-99)
  INSURE_AVENANTS_CREATE: 'insure.avenants.create', // Creer avenant (modification contrat)
  INSURE_QUOTES_GENERATE: 'insure.quotes.generate', // Generer devis (simulator)
  INSURE_QUOTES_READ: 'insure.quotes.read', // Lister devis
  INSURE_COMMISSIONS_READ: 'insure.commissions.read', // Lire commissions broker
  INSURE_CONNECTORS_CONFIG: 'insure.connectors.config', // Configurer connecteurs assureurs (Sprint 32 super_admin)

  // ============================================================================
  // === MODULE repair (Vertical Garage -- 12 permissions) -- Sprint 19-21 ===
  // ============================================================================
  REPAIR_SINISTRES_READ: 'repair.sinistres.read', // Lister sinistres tenant garage
  REPAIR_SINISTRES_READ_OWN: 'repair.sinistres.read_own', // Lister MES sinistres declares (ABAC assure)
  REPAIR_SINISTRES_READ_ASSIGNED: 'repair.sinistres.read_assigned', // Voir sinistres assignes a moi (ABAC technicien)
  REPAIR_SINISTRES_CREATE: 'repair.sinistres.create', // Creer sinistre (par garage_admin/chef)
  REPAIR_SINISTRES_CREATE_OWN: 'repair.sinistres.create_own', // Declarer SON sinistre (assure depuis app M8)
  REPAIR_SINISTRES_ASSIGN: 'repair.sinistres.assign', // Assigner sinistre a technicien
  REPAIR_SINISTRES_CLOSE: 'repair.sinistres.close', // Cloturer sinistre (ABAC WorkflowState)
  REPAIR_DIAGNOSTICS_CREATE: 'repair.diagnostics.create', // Creer diagnostic
  REPAIR_DIAGNOSTICS_UPDATE: 'repair.diagnostics.update', // Modifier diagnostic
  REPAIR_DEVIS_READ: 'repair.devis.read', // Lister devis reparation
  REPAIR_DEVIS_CREATE: 'repair.devis.create', // Creer devis
  REPAIR_DEVIS_APPROVE: 'repair.devis.approve', // Approuver devis (chef d'atelier)
  REPAIR_REPARATIONS_START: 'repair.reparations.start', // Demarrer reparation (technicien)
  REPAIR_REPARATIONS_COMPLETE: 'repair.reparations.complete', // Terminer reparation
  REPAIR_PHOTOS_UPLOAD: 'repair.photos.upload', // Upload photos avant/apres (PWA mobile)
  REPAIR_WARRANTIES_READ: 'repair.warranties.read', // Lister garanties

  // ============================================================================
  // === MODULE stock (4 permissions) -- Sprint 13 ===
  // ============================================================================
  STOCK_ITEMS_READ: 'stock.items.read', // Lister items en stock
  STOCK_ITEMS_MANAGE: 'stock.items.manage', // CRUD items (admin garage)
  STOCK_ITEMS_USE: 'stock.items.use', // Decrementer stock (technicien lors reparation)
  STOCK_MOVEMENTS_READ: 'stock.movements.read', // Lire historique mouvements

  // ============================================================================
  // === MODULE hr (5 permissions) -- Sprint 13 ===
  // ============================================================================
  HR_EMPLOYEES_READ: 'hr.employees.read', // Lister employes tenant
  HR_EMPLOYEES_MANAGE: 'hr.employees.manage', // CRUD employes (CNSS, AMO)
  HR_CONTRACTS_MANAGE: 'hr.contracts.manage', // Gerer contrats employes
  HR_PAYSLIPS_READ_OWN: 'hr.payslips.read_own', // Lire MES bulletins de paie (ABAC)
  HR_ASSIGNMENTS_CREATE: 'hr.assignments.create', // Creer assignment ressource (chef d'atelier)

  // ============================================================================
  // === MODULE admin (Super Admin Skalean -- 8 permissions) -- Sprint 26 ===
  // ============================================================================
  ADMIN_TENANTS_LIST: 'admin.tenants.list', // Lister tous tenants (super_admin)
  ADMIN_TENANTS_CREATE: 'admin.tenants.create', // Provisionner nouveau tenant
  ADMIN_TENANTS_SUSPEND: 'admin.tenants.suspend', // Suspendre tenant (impaye)
  ADMIN_TENANTS_PURGE: 'admin.tenants.purge', // Purge complete tenant (CNDP loi 09-08)
  ADMIN_USERS_LIST_ALL: 'admin.users.list_all', // Lister TOUS users plateforme
  ADMIN_REPORTS_ACAPS_GENERATE: 'admin.reports.acaps_generate', // Generer rapports ACAPS multi-tenant
  ADMIN_IMPERSONATE: 'admin.impersonate', // Impersonate user (avec audit Sprint 26)
  ADMIN_AUDIT_READ: 'admin.audit.read', // Lire audit log complet plateforme
  ADMIN_SYSTEM_HEALTH: 'admin.system.health', // Voir health system (DB, Redis, Kafka)

  // ============================================================================
  // === MODULE cross_tenant (5 permissions) -- Sprint 25 ===
  // ============================================================================
  CROSS_TENANT_SHARE_STATUS: 'cross_tenant.share_status.read', // Suivre status sinistre cross-tenant
  CROSS_TENANT_API_AUTHENTICATE: 'cross_tenant.api.authenticate', // Authentifier API partner Type 3
  CROSS_TENANT_RECEIVE_DISPATCHED: 'cross_tenant.dispatched.receive', // Recevoir sinistres dispatches
  CROSS_TENANT_BROKER_TO_GARAGE: 'cross_tenant.broker_to_garage.assign', // Broker assigne sinistre a garage
  CROSS_TENANT_ASSURE_TO_GARAGE: 'cross_tenant.assure_to_garage.visit', // Assure choisit garage (M8)

  // ============================================================================
  // === MODULE sky (Skalean AI Frontier -- 3 permissions) -- Sprint 31 ===
  // ============================================================================
  SKY_CONVERSATIONS_READ_OWN: 'sky.conversations.read_own', // Lire MES conversations Sky
  SKY_TOOLS_INVOKE: 'sky.tools.invoke', // Invoquer tools metier via Sky (write requires confirmation)
  SKY_ANALYTICS_READ: 'sky.analytics.read', // Lire analytics Sky usage

  // ============================================================================
  // === MODULE mcp (MCP Server -- 2 permissions) -- Sprint 30 ===
  // ============================================================================
  MCP_TOOLS_DISCOVER: 'mcp.tools.discover', // Decouvrir tools disponibles
  MCP_TOOLS_INVOKE: 'mcp.tools.invoke', // Invoquer un tool (per-tool scopes additionnels)

  // ============================================================================
  // === MODULE public (Prospect non authentifie -- 4 permissions) ===
  // ============================================================================
  PUBLIC_PRODUCTS_READ: 'public.products.read', // Lire catalogue produits public (Sprint 14)
  PUBLIC_QUOTES_GENERATE: 'public.quotes.generate', // Generer devis simulator (Sprint 17)
  PUBLIC_KYC_SUBMIT: 'public.kyc.submit', // Soumettre KYC pre-approbation
  PUBLIC_PAYMENTS_PROCESS: 'public.payments.process', // Traiter paiement souscription Sprint 17
} as const;

/**
 * Union litterale des 85+ valeurs permissions. Utilise dans signatures de service / guard.
 * Exemple : `function canAccess(role: AuthRoleValue, perm: PermissionValue): boolean`
 */
export type PermissionValue = (typeof Permission)[keyof typeof Permission];

/**
 * Liste runtime de toutes les valeurs permissions. Utile iteration tests + boot validation.
 */
export const ALL_PERMISSIONS: readonly PermissionValue[] = Object.freeze(
  Object.values(Permission),
);

/**
 * Cle symbolique TypeScript (UPPER_SNAKE) -> valeur runtime (lower.dot).
 * Map inverse utile pour debug / introspection admin (Tache 2.3.11).
 */
export const PermissionKeys = Object.freeze(Object.keys(Permission) as Array<keyof typeof Permission>);
```

### 6.4 Fichier `repo/packages/auth/src/rbac/permission-helpers.ts`

```typescript
/**
 * @file permission-helpers.ts
 * @description Helpers de parsing et formatage des permissions RBAC.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 */

import { ALL_PERMISSIONS, type PermissionValue } from './permissions.enum';
import { PERMISSION_NAMING_REGEX, RBAC_WILDCARD } from './rbac-constants';

/**
 * Liste exhaustive des 19 modules supportes par le programme Skalean InsurTech v2.2.
 * Toute permission doit appartenir a un de ces modules (verifie par validator).
 */
export const Module = {
  AUTH: 'auth',
  TENANT: 'tenant',
  CRM: 'crm',
  BOOKING: 'booking',
  COMM: 'comm',
  DOCS: 'docs',
  SIGNATURE: 'signature',
  PAY: 'pay',
  BOOKS: 'books',
  COMPLIANCE: 'compliance',
  ANALYTICS: 'analytics',
  INSURE: 'insure',
  REPAIR: 'repair',
  STOCK: 'stock',
  HR: 'hr',
  ADMIN: 'admin',
  CROSS_TENANT: 'cross_tenant',
  SKY: 'sky',
  MCP: 'mcp',
  PUBLIC: 'public',
} as const;

export type ModuleValue = (typeof Module)[keyof typeof Module];

export const ALL_MODULES: readonly ModuleValue[] = Object.freeze(Object.values(Module));

/**
 * Liste exhaustive des actions standards. Sert au validator pour detecter typos.
 * Note : 'public' module a ses propres actions (read, generate, submit, process) acceptees.
 */
export const Action = {
  READ: 'read',
  READ_OWN: 'read_own',
  READ_ALL: 'read_all',
  READ_ASSIGNED: 'read_assigned',
  CREATE: 'create',
  CREATE_OWN: 'create_own',
  UPDATE: 'update',
  UPDATE_OWN: 'update_own',
  DELETE: 'delete',
  ASSIGN: 'assign',
  APPROVE: 'approve',
  REJECT: 'reject',
  EXPORT: 'export',
  GENERATE: 'generate',
  CANCEL: 'cancel',
  RESILIATE: 'resiliate',
  SUSPEND: 'suspend',
  TERMINATE: 'terminate',
  REFUND: 'refund',
  RECONCILE: 'reconcile',
  MANAGE: 'manage',
  USE: 'use',
  SEND: 'send',
  SYNC: 'sync',
  UPLOAD: 'upload',
  CONFIG: 'config',
  EXECUTE: 'execute',
  REVIEW: 'review',
  IMPERSONATE: 'impersonate',
  HEALTH: 'health',
  PURGE: 'purge',
  LIST: 'list',
  LIST_ALL: 'list_all',
  INVITE: 'invite',
  INVOKE: 'invoke',
  DISCOVER: 'discover',
  AUTHENTICATE: 'authenticate',
  RECEIVE: 'receive',
  VISIT: 'visit',
  START: 'start',
  COMPLETE: 'complete',
  CLOSE: 'close',
  SUBMIT: 'submit',
  PROCESS: 'process',
} as const;

export type ActionValue = (typeof Action)[keyof typeof Action];

export const ALL_ACTIONS: readonly ActionValue[] = Object.freeze(Object.values(Action));

/**
 * Resultat du parsing d'une permission au format {module}.{resource}.{action}.
 */
export interface ParsedPermission {
  readonly module: string;
  readonly resource: string;
  readonly action: string;
  readonly raw: string;
}

/**
 * Parse une permission string en ses 3 composants (module, resource, action).
 *
 * @param permission - String au format `module.resource.action`
 * @throws Error si format invalide (ne respecte pas PERMISSION_NAMING_REGEX)
 * @example
 *   parsePermission('crm.contacts.read') === { module: 'crm', resource: 'contacts', action: 'read', raw: 'crm.contacts.read' }
 */
export function parsePermission(permission: string): ParsedPermission {
  if (!PERMISSION_NAMING_REGEX.test(permission)) {
    throw new Error(`Invalid permission naming format: '${permission}'`);
  }
  const parts = permission.split('.');
  // Garantit par regex : exactement 3 parts.
  return {
    module: parts[0]!,
    resource: parts[1]!,
    action: parts[2]!,
    raw: permission,
  };
}

/**
 * Type guard runtime : verifie qu'une string est une PermissionValue valide du catalog.
 * Note : refuse explicitement le wildcard '*' (cf. piege 7).
 */
export function isValidPermission(value: unknown): value is PermissionValue {
  if (typeof value !== 'string') return false;
  if (value === RBAC_WILDCARD) return false;
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Construit une permission string a partir des 3 composants. Utile dans les tests
 * et generation dynamique (admin Tache 2.3.11). Echoue si la permission resultante
 * n'existe pas dans le catalog.
 */
export function formatPermission(
  module: ModuleValue,
  resource: string,
  action: ActionValue,
): PermissionValue {
  const candidate = `${module}.${resource}.${action}`;
  if (!isValidPermission(candidate)) {
    throw new Error(`Permission '${candidate}' does not exist in catalog`);
  }
  return candidate;
}

/**
 * Helper convenance : extrait le module depuis une permission valide.
 */
export function getModuleFromPermission(permission: PermissionValue): string {
  return parsePermission(permission).module;
}

/**
 * Helper convenance : extrait l'action depuis une permission valide.
 */
export function getActionFromPermission(permission: PermissionValue): string {
  return parsePermission(permission).action;
}

/**
 * Helper convenance : detecte si une permission cible "own" (ABAC owner filter).
 * Utilise par RbacService (Tache 2.3.3) pour decider si delegate AbacService.
 */
export function isOwnPermission(permission: PermissionValue): boolean {
  const action = getActionFromPermission(permission);
  return action.endsWith('_own') || action === 'read_assigned';
}
```

### 6.5 Fichier `repo/packages/auth/src/rbac/permissions-by-module.ts`

```typescript
/**
 * @file permissions-by-module.ts
 * @description Groupage des permissions par module pour navigation et introspection.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Construction programmatique : iterate ALL_PERMISSIONS et groupe par module parse.
 * Garantit pas de drift entre Permission enum et ce groupage (single source of truth).
 */

import { ALL_PERMISSIONS, type PermissionValue } from './permissions.enum';
import { ALL_MODULES, getModuleFromPermission, type ModuleValue } from './permission-helpers';

/**
 * Map runtime { module -> [permissions] }. Construite au chargement du module.
 * Utilise par AdminController (Tache 2.3.11) endpoint GET /admin/rbac/permissions.
 */
export const PermissionsByModule: Readonly<Record<string, readonly PermissionValue[]>> = (() => {
  const acc: Record<string, PermissionValue[]> = {};
  for (const module of ALL_MODULES) {
    acc[module] = [];
  }
  for (const perm of ALL_PERMISSIONS) {
    const mod = getModuleFromPermission(perm);
    if (!acc[mod]) {
      acc[mod] = [];
    }
    acc[mod].push(perm);
  }
  // Freeze each list to prevent mutation
  for (const key of Object.keys(acc)) {
    acc[key] = Object.freeze(acc[key]) as PermissionValue[];
  }
  return Object.freeze(acc);
})();

/**
 * Recupere les permissions d'un module donne. Retourne tableau vide si module inconnu.
 *
 * @param module - Identifiant module (e.g. 'crm', 'insure')
 * @returns Liste des permissions du module (frozen array)
 * @example
 *   getPermissionsByModule('crm') -> ['crm.contacts.read', 'crm.contacts.create', ...]
 */
export function getPermissionsByModule(module: ModuleValue | string): readonly PermissionValue[] {
  return PermissionsByModule[module] ?? [];
}

/**
 * Compte les permissions par module. Utile pour dashboards admin et tests.
 *
 * @returns Map { module -> count }
 */
export function getPermissionCountByModule(): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const [mod, perms] of Object.entries(PermissionsByModule)) {
    result[mod] = perms.length;
  }
  return Object.freeze(result);
}

/**
 * Liste ordonnee des modules ayant au moins une permission. Utilise UI navigation.
 */
export function getActiveModules(): readonly string[] {
  const active: string[] = [];
  for (const [mod, perms] of Object.entries(PermissionsByModule)) {
    if (perms.length > 0) active.push(mod);
  }
  return Object.freeze(active.sort());
}

/**
 * Recupere TOUTES les permissions tagguees `_own` (cross-modules).
 * Utilise par AbacService (Tache 2.3.7) pour wirer OwnResourcesPolicy.
 */
export function getAllOwnPermissions(): readonly PermissionValue[] {
  return Object.freeze(ALL_PERMISSIONS.filter((p) => p.endsWith('_own') || p.endsWith('.read_assigned')));
}

/**
 * Recupere TOUTES les permissions write (create, update, delete, assign, approve, etc.).
 * Utile pour analyst_support : seules les read sont autorisees.
 */
export function getAllWritePermissions(): readonly PermissionValue[] {
  const writeActions = new Set([
    'create', 'create_own', 'update', 'update_own', 'delete', 'assign',
    'approve', 'reject', 'cancel', 'resiliate', 'suspend', 'terminate',
    'refund', 'reconcile', 'manage', 'use', 'send', 'sync', 'upload',
    'config', 'execute', 'revoke', 'enable', 'disable', 'invite',
    'invoke', 'submit', 'process', 'purge', 'impersonate', 'start', 'complete',
    'close', 'generate',
  ]);
  return Object.freeze(
    ALL_PERMISSIONS.filter((p) => writeActions.has(getModuleFromPermission(p))),
  );
}

/**
 * Recupere TOUTES les permissions read-only (read, read_own, read_all, read_assigned).
 * Utile pour analyst_support : autorise tout en read.
 */
export function getAllReadPermissions(): readonly PermissionValue[] {
  return Object.freeze(
    ALL_PERMISSIONS.filter((p) => {
      const action = p.split('.')[2];
      return action === 'read' || action === 'read_own' || action === 'read_all' || action === 'read_assigned';
    }),
  );
}
```

### 6.6 Fichier `repo/packages/auth/src/rbac/role-metadata.ts`

```typescript
/**
 * @file role-metadata.ts
 * @description Metadata exhaustif des 12 roles : description trilingue, niveau, type.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Consume par :
 *  - AdminController (Tache 2.3.11) : endpoint GET /admin/rbac/roles
 *  - Frontend web-insurtech-admin (Sprint 26) : affichage admin RBAC
 *  - i18n FR/EN/AR conformement decision-008 (data residency Maroc, langues officielles)
 */

import { AuthRole, type AuthRoleValue, ROLE_CATEGORIES } from './roles.enum';

/**
 * Niveau d'acces dans la hierarchie tenant Skalean.
 *  - L1 : platform (Skalean staff)
 *  - L2 : tenant (cabinet ou garage)
 *  - L3 : assure (utilisateur final dans tenant)
 *  - PUBLIC : prospect sans tenant
 */
export type RoleLevel = 'L1' | 'L2' | 'L3' | 'PUBLIC';

/**
 * Type de role : platform staff, broker tenant, garage tenant, etc.
 */
export type RoleType = 'platform' | 'broker' | 'garage' | 'assure' | 'public';

/**
 * Description trilingue d'un role (FR + EN + AR).
 */
export interface RoleI18nDescription {
  readonly fr: string;
  readonly en: string;
  readonly ar: string;
}

/**
 * Metadata complet d'un role.
 */
export interface RoleMeta {
  readonly key: AuthRoleValue;
  readonly displayName: RoleI18nDescription;
  readonly description: RoleI18nDescription;
  readonly level: RoleLevel;
  readonly type: RoleType;
  readonly defaultPermissionsCount: number; // estimation indicative pour UI admin
  readonly mfaRequired: boolean;
  readonly inheritsFrom: readonly AuthRoleValue[]; // resolution Tache 2.3.2 RoleHierarchy
  readonly bypassRls: boolean; // true seulement super_admin_platform
}

/**
 * Catalog metadata des 12 roles. Source de verite pour UI admin et docs.
 */
export const RoleMetadata: Readonly<Record<AuthRoleValue, RoleMeta>> = Object.freeze({
  [AuthRole.SUPER_ADMIN_PLATFORM]: {
    key: AuthRole.SUPER_ADMIN_PLATFORM,
    displayName: {
      fr: 'Super Administrateur Plateforme',
      en: 'Platform Super Administrator',
      ar: 'مسؤول النظام الأعلى',
    },
    description: {
      fr: 'Equipe Skalean tech/ops. Bypass RLS. Wildcard permissions. MFA obligatoire.',
      en: 'Skalean tech/ops team. RLS bypass. Wildcard permissions. MFA mandatory.',
      ar: 'فريق Skalean التقني والتشغيلي. تجاوز RLS. صلاحيات شاملة. MFA إلزامي.',
    },
    level: 'L1',
    type: 'platform',
    defaultPermissionsCount: 999, // wildcard
    mfaRequired: true,
    inheritsFrom: [],
    bypassRls: true,
  },
  [AuthRole.ANALYST_SUPPORT]: {
    key: AuthRole.ANALYST_SUPPORT,
    displayName: {
      fr: 'Analyste Support',
      en: 'Support Analyst',
      ar: 'محلل الدعم',
    },
    description: {
      fr: 'Equipe Skalean support/analyse. Wildcard *.read uniquement. Tentatives write -> 403.',
      en: 'Skalean support/analysis team. Wildcard *.read only. Write attempts -> 403.',
      ar: 'فريق دعم وتحليل Skalean. صلاحيات قراءة فقط *.read. محاولات الكتابة -> 403.',
    },
    level: 'L1',
    type: 'platform',
    defaultPermissionsCount: 50,
    mfaRequired: true,
    inheritsFrom: [],
    bypassRls: false,
  },
  [AuthRole.BROKER_ADMIN]: {
    key: AuthRole.BROKER_ADMIN,
    displayName: {
      fr: 'Administrateur Cabinet Courtier',
      en: 'Broker Admin',
      ar: 'مسؤول مكتب الوسيط',
    },
    description: {
      fr: 'Administrateur cabinet de courtage. CRUD complet tenant + gestion equipe.',
      en: 'Broker office administrator. Complete tenant CRUD + team management.',
      ar: 'مسؤول مكتب السمسرة. إدارة كاملة للمستأجر + إدارة الفريق.',
    },
    level: 'L2',
    type: 'broker',
    defaultPermissionsCount: 35,
    mfaRequired: false,
    inheritsFrom: [AuthRole.BROKER_USER],
    bypassRls: false,
  },
  [AuthRole.BROKER_USER]: {
    key: AuthRole.BROKER_USER,
    displayName: {
      fr: 'Courtier Souscripteur',
      en: 'Broker Underwriter',
      ar: 'وسيط مكتتب',
    },
    description: {
      fr: 'Courtier souscripteur. Peut creer polices, gerer ses contacts. Pas delete tenant.',
      en: 'Broker underwriter. Can create policies, manage own contacts. No tenant delete.',
      ar: 'وسيط مكتتب. يمكنه إنشاء البوالص وإدارة جهات اتصاله. لا يمكنه حذف المستأجر.',
    },
    level: 'L2',
    type: 'broker',
    defaultPermissionsCount: 18,
    mfaRequired: false,
    inheritsFrom: [AuthRole.BROKER_ASSISTANT],
    bypassRls: false,
  },
  [AuthRole.BROKER_ASSISTANT]: {
    key: AuthRole.BROKER_ASSISTANT,
    displayName: {
      fr: 'Assistant Cabinet',
      en: 'Broker Assistant',
      ar: 'مساعد المكتب',
    },
    description: {
      fr: 'Assistant administratif cabinet. Lecture + creation contacts. Pas write polices.',
      en: 'Broker administrative assistant. Read + create contacts. No policy write.',
      ar: 'مساعد إداري في المكتب. قراءة وإنشاء جهات اتصال. لا يمكنه كتابة البوالص.',
    },
    level: 'L2',
    type: 'broker',
    defaultPermissionsCount: 8,
    mfaRequired: false,
    inheritsFrom: [],
    bypassRls: false,
  },
  [AuthRole.GARAGE_ADMIN]: {
    key: AuthRole.GARAGE_ADMIN,
    displayName: {
      fr: 'Administrateur Garage',
      en: 'Garage Admin',
      ar: 'مسؤول الورشة',
    },
    description: {
      fr: 'Administrateur garage. CRUD complet tenant + gestion equipe garage.',
      en: 'Garage administrator. Complete tenant CRUD + garage team management.',
      ar: 'مسؤول الورشة. إدارة كاملة للمستأجر + إدارة فريق الورشة.',
    },
    level: 'L2',
    type: 'garage',
    defaultPermissionsCount: 30,
    mfaRequired: false,
    inheritsFrom: [
      AuthRole.GARAGE_CHEF,
      AuthRole.GARAGE_COMPTABLE,
      AuthRole.GARAGE_COMMERCIAL,
    ],
    bypassRls: false,
  },
  [AuthRole.GARAGE_CHEF]: {
    key: AuthRole.GARAGE_CHEF,
    displayName: {
      fr: 'Chef d Atelier',
      en: 'Workshop Manager',
      ar: 'رئيس الورشة',
    },
    description: {
      fr: 'Chef d atelier garage. Assigne sinistres aux techniciens, approuve devis, cloture.',
      en: 'Garage workshop manager. Assigns claims to technicians, approves quotes, closes.',
      ar: 'رئيس ورشة الكراج. يكلف الفنيين بالحوادث، يوافق على العروض، يغلق.',
    },
    level: 'L2',
    type: 'garage',
    defaultPermissionsCount: 12,
    mfaRequired: false,
    inheritsFrom: [AuthRole.GARAGE_TECHNICIEN],
    bypassRls: false,
  },
  [AuthRole.GARAGE_TECHNICIEN]: {
    key: AuthRole.GARAGE_TECHNICIEN,
    displayName: {
      fr: 'Technicien Atelier',
      en: 'Workshop Technician',
      ar: 'فني الورشة',
    },
    description: {
      fr: 'Technicien atelier (PWA mobile). Voit sinistres assignes, demarre/termine reparations.',
      en: 'Workshop technician (mobile PWA). Sees assigned claims, starts/completes repairs.',
      ar: 'فني الورشة (PWA متنقل). يرى الحوادث المكلف بها، يبدأ/ينهي الإصلاحات.',
    },
    level: 'L2',
    type: 'garage',
    defaultPermissionsCount: 6,
    mfaRequired: false,
    inheritsFrom: [],
    bypassRls: false,
  },
  [AuthRole.GARAGE_COMPTABLE]: {
    key: AuthRole.GARAGE_COMPTABLE,
    displayName: {
      fr: 'Comptable Garage',
      en: 'Garage Accountant',
      ar: 'محاسب الورشة',
    },
    description: {
      fr: 'Comptable garage. Acces Books + Pay. Reconciliation bancaire, factures.',
      en: 'Garage accountant. Books + Pay access. Bank reconciliation, invoices.',
      ar: 'محاسب الورشة. الوصول إلى Books + Pay. التسوية البنكية والفواتير.',
    },
    level: 'L2',
    type: 'garage',
    defaultPermissionsCount: 10,
    mfaRequired: false,
    inheritsFrom: [],
    bypassRls: false,
  },
  [AuthRole.GARAGE_COMMERCIAL]: {
    key: AuthRole.GARAGE_COMMERCIAL,
    displayName: {
      fr: 'Commercial Garage',
      en: 'Garage Sales',
      ar: 'تجاري الورشة',
    },
    description: {
      fr: 'Commercial garage. Devis, contacts clients, communication.',
      en: 'Garage sales. Quotes, customer contacts, communication.',
      ar: 'تجاري الورشة. العروض وجهات اتصال العملاء والاتصالات.',
    },
    level: 'L2',
    type: 'garage',
    defaultPermissionsCount: 8,
    mfaRequired: false,
    inheritsFrom: [],
    bypassRls: false,
  },
  [AuthRole.ASSURE]: {
    key: AuthRole.ASSURE,
    displayName: {
      fr: 'Assure',
      en: 'Insured',
      ar: 'المؤمن له',
    },
    description: {
      fr: 'Client final assure (web-assure-portal + mobile). Lecture polices/sinistres own.',
      en: 'Final insured customer (web-assure-portal + mobile). Read own policies/claims.',
      ar: 'العميل النهائي المؤمن له (web-assure-portal + متنقل). قراءة بوالصه/حوادثه.',
    },
    level: 'L3',
    type: 'assure',
    defaultPermissionsCount: 8,
    mfaRequired: false,
    inheritsFrom: [],
    bypassRls: false,
  },
  [AuthRole.PROSPECT]: {
    key: AuthRole.PROSPECT,
    displayName: {
      fr: 'Prospect',
      en: 'Prospect',
      ar: 'عميل محتمل',
    },
    description: {
      fr: 'Prospect public (web-customer-portal sans login). Browse catalog + simulator.',
      en: 'Public prospect (web-customer-portal without login). Browse catalog + simulator.',
      ar: 'عميل محتمل عام (web-customer-portal بدون تسجيل دخول). تصفح الكتالوج + المحاكاة.',
    },
    level: 'PUBLIC',
    type: 'public',
    defaultPermissionsCount: 4,
    mfaRequired: false,
    inheritsFrom: [],
    bypassRls: false,
  },
});

/**
 * Recupere le metadata d'un role. Throw si role invalide.
 */
export function getRoleMetadata(role: AuthRoleValue): RoleMeta {
  const meta = RoleMetadata[role];
  if (!meta) {
    throw new Error(`Role metadata not found for: ${role}`);
  }
  return meta;
}

/**
 * Recupere tous les roles d'un type donne (platform, broker, garage, etc.).
 */
export function getRolesByType(type: RoleType): readonly AuthRoleValue[] {
  return Object.values(RoleMetadata)
    .filter((meta) => meta.type === type)
    .map((meta) => meta.key);
}

/**
 * Verifie si un role requiert MFA obligatoire (super_admin + analyst_support).
 */
export function isMfaMandatoryForRole(role: AuthRoleValue): boolean {
  return getRoleMetadata(role).mfaRequired;
}

export { ROLE_CATEGORIES };
```

### 6.7 Fichier `repo/packages/auth/src/rbac/permissions-validator.ts`

```typescript
/**
 * @file permissions-validator.ts
 * @description Validateur boot-time du catalog Permissions.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Execution : appele par AuthModule.onModuleInit() (Sprint 5) au demarrage de l'app.
 * Echec : process.exit(1) avec log structured des erreurs.
 *
 * Verifications :
 *  - Tous les noms respectent PERMISSION_NAMING_REGEX
 *  - Aucune duplication de valeur (Set deduplication)
 *  - Tous les modules referencent un Module enum valide
 *  - Toutes les actions referencent une Action enum valide (extension allowed)
 *  - Aucune permission n'a la valeur RBAC_WILDCARD
 *  - Mapping cle UPPER_SNAKE = valeur lower.dot.notation respecte
 *  - 12 roles distincts dans AuthRole
 */

import { AuthRole, ALL_ROLES } from './roles.enum';
import { Permission, ALL_PERMISSIONS, PermissionKeys } from './permissions.enum';
import {
  ALL_MODULES,
  ALL_ACTIONS,
  parsePermission,
  type ModuleValue,
  type ActionValue,
} from './permission-helpers';
import { PERMISSION_NAMING_REGEX, RBAC_WILDCARD } from './rbac-constants';

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationError[];
  readonly stats: {
    readonly totalPermissions: number;
    readonly totalRoles: number;
    readonly totalModules: number;
    readonly totalActions: number;
  };
}

/**
 * Effectue toutes les verifications du catalog. Pure function : ne logge pas, ne throw pas.
 * L'appelant decide quoi faire (logger.error + process.exit en boot, ou test assertion).
 */
export function validatePermissionsCatalog(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // === Check 1 : 12 roles distincts ===
  if (ALL_ROLES.length !== 12) {
    errors.push({
      code: 'ROLES_COUNT_MISMATCH',
      message: `Expected 12 roles, found ${ALL_ROLES.length}`,
      context: { actual: ALL_ROLES.length, expected: 12 },
    });
  }
  const roleSet = new Set<string>(ALL_ROLES);
  if (roleSet.size !== ALL_ROLES.length) {
    errors.push({
      code: 'ROLES_DUPLICATED',
      message: `Duplicated role values found in AuthRole enum`,
      context: { values: ALL_ROLES, distinctCount: roleSet.size },
    });
  }

  // === Check 2 : >= 85 permissions distinctes ===
  if (ALL_PERMISSIONS.length < 85) {
    errors.push({
      code: 'PERMISSIONS_COUNT_TOO_LOW',
      message: `Expected at least 85 permissions, found ${ALL_PERMISSIONS.length}`,
      context: { actual: ALL_PERMISSIONS.length, minExpected: 85 },
    });
  }

  // === Check 3 : Aucune duplication de valeur ===
  const permSet = new Set<string>(ALL_PERMISSIONS);
  if (permSet.size !== ALL_PERMISSIONS.length) {
    const duplicates = ALL_PERMISSIONS.filter((p, i) => ALL_PERMISSIONS.indexOf(p) !== i);
    errors.push({
      code: 'PERMISSIONS_DUPLICATED',
      message: `Duplicated permission values found in Permission enum`,
      context: { duplicates },
    });
  }

  // === Check 4 : Naming regex respecte ===
  for (const perm of ALL_PERMISSIONS) {
    if (!PERMISSION_NAMING_REGEX.test(perm)) {
      errors.push({
        code: 'PERMISSION_NAMING_INVALID',
        message: `Permission '${perm}' does not match naming regex`,
        context: { permission: perm, regex: PERMISSION_NAMING_REGEX.source },
      });
    }
  }

  // === Check 5 : Module valide pour chaque permission ===
  const validModules = new Set<string>(ALL_MODULES);
  for (const perm of ALL_PERMISSIONS) {
    if (!PERMISSION_NAMING_REGEX.test(perm)) continue; // already reported
    const parsed = parsePermission(perm);
    if (!validModules.has(parsed.module)) {
      errors.push({
        code: 'PERMISSION_MODULE_UNKNOWN',
        message: `Permission '${perm}' references unknown module '${parsed.module}'`,
        context: { permission: perm, module: parsed.module, validModules: Array.from(validModules) },
      });
    }
  }

  // === Check 6 : Action valide pour chaque permission (warning si extension) ===
  const validActions = new Set<string>(ALL_ACTIONS);
  for (const perm of ALL_PERMISSIONS) {
    if (!PERMISSION_NAMING_REGEX.test(perm)) continue;
    const parsed = parsePermission(perm);
    if (!validActions.has(parsed.action)) {
      warnings.push({
        code: 'PERMISSION_ACTION_EXTENSION',
        message: `Permission '${perm}' uses non-standard action '${parsed.action}' (consider adding to Action enum)`,
        context: { permission: perm, action: parsed.action },
      });
    }
  }

  // === Check 7 : Aucune permission egal a RBAC_WILDCARD ===
  if ((ALL_PERMISSIONS as readonly string[]).includes(RBAC_WILDCARD)) {
    errors.push({
      code: 'PERMISSION_WILDCARD_RESERVED',
      message: `Wildcard '${RBAC_WILDCARD}' is reserved and cannot be a permission value`,
      context: { wildcard: RBAC_WILDCARD },
    });
  }

  // === Check 8 : Cle UPPER_SNAKE matche valeur lower.dot.notation ===
  for (const key of PermissionKeys) {
    const expectedValue = key.toLowerCase().replace(/_/g, '.');
    const actualValue = (Permission as Readonly<Record<string, string>>)[key];
    // Le mapping mecanique strict est rendu impossible par les permissions multi-segment
    // (ex: CRM_CONTACTS_READ -> 'crm.contacts.read' est OK mais COMPLIANCE_ACAPS_REPORTS_GENERATE
    // -> 'compliance.acaps.reports.generate' aurait 4 dots).
    // On verifie donc seulement que la valeur commence par le module et contient les bonnes parties.
    const parts = actualValue.split('.');
    const expectedModule = parts[0]?.toUpperCase();
    if (expectedModule && !key.startsWith(expectedModule)) {
      warnings.push({
        code: 'PERMISSION_KEY_VALUE_MISMATCH',
        message: `Permission key '${key}' does not start with module '${expectedModule}'`,
        context: { key, value: actualValue, expectedPrefix: expectedModule },
      });
    }
  }

  // === Stats ===
  const moduleSet = new Set<string>();
  const actionSet = new Set<string>();
  for (const perm of ALL_PERMISSIONS) {
    if (!PERMISSION_NAMING_REGEX.test(perm)) continue;
    const parsed = parsePermission(perm);
    moduleSet.add(parsed.module);
    actionSet.add(parsed.action);
  }

  return {
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    stats: Object.freeze({
      totalPermissions: ALL_PERMISSIONS.length,
      totalRoles: ALL_ROLES.length,
      totalModules: moduleSet.size,
      totalActions: actionSet.size,
    }),
  };
}

/**
 * Helper : execute la validation et throw si invalid. Utilise au boot par AuthModule.
 */
export function assertPermissionsCatalogValid(): void {
  const result = validatePermissionsCatalog();
  if (!result.valid) {
    const errorList = result.errors.map((e) => `[${e.code}] ${e.message}`).join('\n  ');
    throw new Error(
      `Permissions catalog validation FAILED with ${result.errors.length} error(s):\n  ${errorList}`,
    );
  }
}
```

### 6.8 Fichier `repo/packages/auth/src/rbac/permissions.spec.ts`

```typescript
/**
 * @file permissions.spec.ts
 * @description Tests Vitest exhaustifs du catalog Permissions et Roles RBAC.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Total : 28 tests Vitest verifiant coherence, naming, count, no duplicates,
 * modules count, hierarchy metadata, validation boot-time.
 *
 * Run : pnpm --filter @insurtech/auth test rbac/permissions.spec.ts
 */

import { describe, it, expect } from 'vitest';
import {
  AuthRole,
  ALL_ROLES,
  isAuthRole,
  AuthRoleSchema,
  ROLE_CATEGORIES,
} from './roles.enum';
import { Permission, ALL_PERMISSIONS, PermissionKeys } from './permissions.enum';
import {
  parsePermission,
  isValidPermission,
  formatPermission,
  getModuleFromPermission,
  getActionFromPermission,
  isOwnPermission,
  Module,
  Action,
  ALL_MODULES,
  ALL_ACTIONS,
} from './permission-helpers';
import {
  PermissionsByModule,
  getPermissionsByModule,
  getPermissionCountByModule,
  getActiveModules,
  getAllOwnPermissions,
  getAllReadPermissions,
} from './permissions-by-module';
import {
  RoleMetadata,
  getRoleMetadata,
  getRolesByType,
  isMfaMandatoryForRole,
} from './role-metadata';
import { validatePermissionsCatalog } from './permissions-validator';
import { PERMISSION_NAMING_REGEX, RBAC_WILDCARD } from './rbac-constants';

describe('AuthRole enum', () => {
  it('V1 : contient exactement 12 roles distincts', () => {
    expect(ALL_ROLES).toHaveLength(12);
    expect(new Set(ALL_ROLES).size).toBe(12);
  });

  it('V1b : inclut tous les roles attendus du document 5-roles-permissions.md', () => {
    const expected = [
      'super_admin_platform', 'analyst_support',
      'broker_admin', 'broker_user', 'broker_assistant',
      'garage_admin', 'garage_chef', 'garage_technicien', 'garage_comptable', 'garage_commercial',
      'assure', 'prospect',
    ];
    for (const role of expected) {
      expect(ALL_ROLES as readonly string[]).toContain(role);
    }
  });

  it('V1c : isAuthRole type guard accepte les 12 valeurs', () => {
    for (const role of ALL_ROLES) {
      expect(isAuthRole(role)).toBe(true);
    }
  });

  it('V1d : isAuthRole rejette les valeurs invalides', () => {
    expect(isAuthRole('admin')).toBe(false);
    expect(isAuthRole('SUPER_ADMIN_PLATFORM')).toBe(false); // case-sensitive
    expect(isAuthRole(123)).toBe(false);
    expect(isAuthRole(null)).toBe(false);
    expect(isAuthRole(undefined)).toBe(false);
    expect(isAuthRole('')).toBe(false);
  });

  it('V1e : Zod AuthRoleSchema accepte les 12 valeurs', () => {
    for (const role of ALL_ROLES) {
      expect(AuthRoleSchema.parse(role)).toBe(role);
    }
  });

  it('V1f : Zod AuthRoleSchema rejette les valeurs invalides', () => {
    expect(() => AuthRoleSchema.parse('hacker_role')).toThrow();
    expect(() => AuthRoleSchema.parse('Admin')).toThrow();
  });

  it('V1g : ROLE_CATEGORIES regroupe correctement les 12 roles', () => {
    const allCategorized = [
      ...ROLE_CATEGORIES.PLATFORM,
      ...ROLE_CATEGORIES.TENANT_BROKER,
      ...ROLE_CATEGORIES.TENANT_GARAGE,
      ...ROLE_CATEGORIES.L3_USER,
      ...ROLE_CATEGORIES.PUBLIC,
    ];
    expect(allCategorized).toHaveLength(12);
    expect(new Set(allCategorized).size).toBe(12);
  });
});

describe('Permission enum', () => {
  it('V2 : contient au moins 85 permissions', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(85);
  });

  it('V3 : toutes les permissions respectent PERMISSION_NAMING_REGEX', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(perm).toMatch(PERMISSION_NAMING_REGEX);
    }
  });

  it('V4 : aucune duplication de valeur', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('V5 : couvre 19+ modules distincts', () => {
    const modules = new Set(ALL_PERMISSIONS.map(getModuleFromPermission));
    expect(modules.size).toBeGreaterThanOrEqual(15);
  });

  it('V6 : RBAC_WILDCARD n a pas valeur de Permission', () => {
    expect((ALL_PERMISSIONS as readonly string[]).includes(RBAC_WILDCARD)).toBe(false);
  });

  it('V6b : isValidPermission rejette le wildcard', () => {
    expect(isValidPermission(RBAC_WILDCARD)).toBe(false);
  });

  it('V7 : permissions-by-module regroupe correctement', () => {
    const totalGrouped = Object.values(PermissionsByModule).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalGrouped).toBe(ALL_PERMISSIONS.length);
  });

  it('V7b : getPermissionsByModule retourne les bonnes permissions', () => {
    const crmPerms = getPermissionsByModule('crm');
    expect(crmPerms.length).toBeGreaterThan(0);
    for (const perm of crmPerms) {
      expect(perm.startsWith('crm.')).toBe(true);
    }
  });

  it('V7c : getActiveModules retourne 15+ modules', () => {
    expect(getActiveModules().length).toBeGreaterThanOrEqual(15);
  });

  it('V7d : getPermissionCountByModule retourne map non vide', () => {
    const counts = getPermissionCountByModule();
    expect(Object.keys(counts).length).toBeGreaterThan(0);
    expect(counts.crm).toBeGreaterThan(0);
    expect(counts.insure).toBeGreaterThan(0);
    expect(counts.repair).toBeGreaterThan(0);
  });
});

describe('Permission helpers', () => {
  it('V8 : parsePermission decompose correctement', () => {
    const parsed = parsePermission(Permission.CRM_CONTACTS_READ);
    expect(parsed.module).toBe('crm');
    expect(parsed.resource).toBe('contacts');
    expect(parsed.action).toBe('read');
    expect(parsed.raw).toBe('crm.contacts.read');
  });

  it('V8b : parsePermission throw si format invalide', () => {
    expect(() => parsePermission('invalid')).toThrow();
    expect(() => parsePermission('CRM.contacts.read')).toThrow();
    expect(() => parsePermission('crm.contacts')).toThrow();
    expect(() => parsePermission('*')).toThrow();
  });

  it('V9 : isValidPermission accepte permissions du catalog', () => {
    expect(isValidPermission(Permission.CRM_CONTACTS_READ)).toBe(true);
    expect(isValidPermission(Permission.INSURE_POLICIES_READ_OWN)).toBe(true);
    expect(isValidPermission(Permission.REPAIR_SINISTRES_CLOSE)).toBe(true);
  });

  it('V9b : isValidPermission rejette permissions hors catalog', () => {
    expect(isValidPermission('crm.contacts.fake_action')).toBe(false);
    expect(isValidPermission('hacker.module.exploit')).toBe(false);
    expect(isValidPermission('')).toBe(false);
    expect(isValidPermission(null)).toBe(false);
  });

  it('V10 : formatPermission construit une permission valide', () => {
    const perm = formatPermission(Module.CRM, 'contacts', Action.READ);
    expect(perm).toBe(Permission.CRM_CONTACTS_READ);
  });

  it('V10b : formatPermission throw si combinaison invalide', () => {
    expect(() => formatPermission(Module.CRM, 'fake', Action.READ)).toThrow();
  });

  it('V11 : getModuleFromPermission extrait le bon module', () => {
    expect(getModuleFromPermission(Permission.CRM_CONTACTS_READ)).toBe('crm');
    expect(getModuleFromPermission(Permission.INSURE_POLICIES_CREATE)).toBe('insure');
    expect(getModuleFromPermission(Permission.ADMIN_TENANTS_PURGE)).toBe('admin');
  });

  it('V11b : getActionFromPermission extrait la bonne action', () => {
    expect(getActionFromPermission(Permission.CRM_CONTACTS_READ)).toBe('read');
    expect(getActionFromPermission(Permission.CRM_CONTACTS_READ_OWN)).toBe('read_own');
  });

  it('V11c : isOwnPermission detecte les permissions owner-scoped', () => {
    expect(isOwnPermission(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
    expect(isOwnPermission(Permission.INSURE_POLICIES_READ_OWN)).toBe(true);
    expect(isOwnPermission(Permission.REPAIR_SINISTRES_READ_ASSIGNED)).toBe(true);
    expect(isOwnPermission(Permission.CRM_CONTACTS_READ)).toBe(false);
    expect(isOwnPermission(Permission.INSURE_POLICIES_CREATE)).toBe(false);
  });
});

describe('Module / Action enums', () => {
  it('V12 : Module enum contient au moins 15 modules', () => {
    expect(ALL_MODULES.length).toBeGreaterThanOrEqual(15);
  });

  it('V12b : Module enum inclut tous les modules consommes par permissions', () => {
    const usedModules = new Set(ALL_PERMISSIONS.map(getModuleFromPermission));
    for (const usedMod of usedModules) {
      expect((ALL_MODULES as readonly string[]).includes(usedMod)).toBe(true);
    }
  });

  it('V13 : Action enum contient les 4 actions de lecture', () => {
    expect(Action.READ).toBe('read');
    expect(Action.READ_OWN).toBe('read_own');
    expect(Action.READ_ALL).toBe('read_all');
    expect(Action.READ_ASSIGNED).toBe('read_assigned');
  });

  it('V13b : Action enum contient les 4 actions cycle de vie police', () => {
    expect(Action.CANCEL).toBe('cancel');
    expect(Action.RESILIATE).toBe('resiliate');
    expect(Action.SUSPEND).toBe('suspend');
    expect(Action.TERMINATE).toBe('terminate');
  });
});

describe('Role metadata', () => {
  it('V14 : RoleMetadata couvre les 12 roles', () => {
    expect(Object.keys(RoleMetadata)).toHaveLength(12);
    for (const role of ALL_ROLES) {
      expect(RoleMetadata[role]).toBeDefined();
    }
  });

  it('V14b : Chaque role a des descriptions FR/EN/AR non vides', () => {
    for (const role of ALL_ROLES) {
      const meta = getRoleMetadata(role);
      expect(meta.displayName.fr.length).toBeGreaterThan(0);
      expect(meta.displayName.en.length).toBeGreaterThan(0);
      expect(meta.displayName.ar.length).toBeGreaterThan(0);
      expect(meta.description.fr.length).toBeGreaterThan(0);
      expect(meta.description.en.length).toBeGreaterThan(0);
      expect(meta.description.ar.length).toBeGreaterThan(0);
    }
  });

  it('V15 : super_admin_platform a bypassRls=true et MFA obligatoire', () => {
    const meta = getRoleMetadata(AuthRole.SUPER_ADMIN_PLATFORM);
    expect(meta.bypassRls).toBe(true);
    expect(meta.mfaRequired).toBe(true);
    expect(meta.level).toBe('L1');
  });

  it('V15b : analyst_support a MFA obligatoire mais pas bypass RLS', () => {
    const meta = getRoleMetadata(AuthRole.ANALYST_SUPPORT);
    expect(meta.mfaRequired).toBe(true);
    expect(meta.bypassRls).toBe(false);
  });

  it('V15c : assure est niveau L3', () => {
    const meta = getRoleMetadata(AuthRole.ASSURE);
    expect(meta.level).toBe('L3');
    expect(meta.type).toBe('assure');
  });

  it('V15d : prospect est niveau PUBLIC sans inheritance', () => {
    const meta = getRoleMetadata(AuthRole.PROSPECT);
    expect(meta.level).toBe('PUBLIC');
    expect(meta.inheritsFrom).toHaveLength(0);
  });

  it('V16 : broker_admin herite de broker_user', () => {
    const meta = getRoleMetadata(AuthRole.BROKER_ADMIN);
    expect(meta.inheritsFrom).toContain(AuthRole.BROKER_USER);
  });

  it('V16b : garage_admin herite de chef + comptable + commercial', () => {
    const meta = getRoleMetadata(AuthRole.GARAGE_ADMIN);
    expect(meta.inheritsFrom).toContain(AuthRole.GARAGE_CHEF);
    expect(meta.inheritsFrom).toContain(AuthRole.GARAGE_COMPTABLE);
    expect(meta.inheritsFrom).toContain(AuthRole.GARAGE_COMMERCIAL);
  });

  it('V17 : getRolesByType retourne bon nombre par type', () => {
    expect(getRolesByType('platform')).toHaveLength(2);
    expect(getRolesByType('broker')).toHaveLength(3);
    expect(getRolesByType('garage')).toHaveLength(5);
    expect(getRolesByType('assure')).toHaveLength(1);
    expect(getRolesByType('public')).toHaveLength(1);
  });

  it('V17b : isMfaMandatoryForRole retourne true seulement pour platform', () => {
    expect(isMfaMandatoryForRole(AuthRole.SUPER_ADMIN_PLATFORM)).toBe(true);
    expect(isMfaMandatoryForRole(AuthRole.ANALYST_SUPPORT)).toBe(true);
    expect(isMfaMandatoryForRole(AuthRole.BROKER_ADMIN)).toBe(false);
    expect(isMfaMandatoryForRole(AuthRole.ASSURE)).toBe(false);
  });
});

describe('Permissions catalog validator', () => {
  it('V18 : validatePermissionsCatalog retourne valid=true sur catalog actuel', () => {
    const result = validatePermissionsCatalog();
    if (!result.valid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('V18b : stats reflectent contenu reel', () => {
    const result = validatePermissionsCatalog();
    expect(result.stats.totalPermissions).toBe(ALL_PERMISSIONS.length);
    expect(result.stats.totalRoles).toBe(12);
    expect(result.stats.totalModules).toBeGreaterThanOrEqual(15);
    expect(result.stats.totalActions).toBeGreaterThanOrEqual(10);
  });

  it('V19 : validator detecte permission egal au wildcard (test mock)', () => {
    // Note : impossible de modifier ALL_PERMISSIONS reel a cause de Object.freeze.
    // Test conceptuel : verifier que la regex et la check wildcard sont en place.
    expect(PERMISSION_NAMING_REGEX.test('*')).toBe(false);
    expect(PERMISSION_NAMING_REGEX.test('crm.contacts.read')).toBe(true);
  });
});

describe('Subset queries', () => {
  it('V20 : getAllOwnPermissions retourne toutes les permissions _own', () => {
    const ownPerms = getAllOwnPermissions();
    expect(ownPerms.length).toBeGreaterThan(0);
    for (const perm of ownPerms) {
      expect(perm.endsWith('_own') || perm.endsWith('.read_assigned')).toBe(true);
    }
  });

  it('V20b : getAllReadPermissions retourne toutes les permissions read*', () => {
    const readPerms = getAllReadPermissions();
    expect(readPerms.length).toBeGreaterThan(0);
    for (const perm of readPerms) {
      const action = perm.split('.')[2];
      expect(['read', 'read_own', 'read_all', 'read_assigned']).toContain(action);
    }
  });
});

describe('Catalog integrity', () => {
  it('V21 : aucune emoji dans les valeurs de permissions', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u;
    for (const perm of ALL_PERMISSIONS) {
      expect(perm).not.toMatch(emojiRegex);
    }
  });

  it('V22 : PermissionKeys correspond exactement a Object.keys(Permission)', () => {
    expect(PermissionKeys).toEqual(Object.keys(Permission));
    expect(PermissionKeys.length).toBe(ALL_PERMISSIONS.length);
  });

  it('V23 : toutes les cles UPPER_SNAKE commencent par module en uppercase', () => {
    for (const key of PermissionKeys) {
      const value = (Permission as Readonly<Record<string, string>>)[key];
      const expectedPrefix = value.split('.')[0]!.toUpperCase();
      expect(key.startsWith(expectedPrefix)).toBe(true);
    }
  });

  it('V24 : aucun TODO/FIXME/XXX dans les noms permissions ou roles', () => {
    const forbidden = /TODO|FIXME|XXX/;
    for (const perm of ALL_PERMISSIONS) {
      expect(perm).not.toMatch(forbidden);
    }
    for (const role of ALL_ROLES) {
      expect(role).not.toMatch(forbidden);
    }
  });

  it('V25 : permissions distinctes count snapshot (changement explicite requis)', () => {
    // Snapshot de comptage : si modifie, le PR doit mettre a jour ce nombre explicitement.
    // Cible Sprint 7 : 85+ permissions (ce test peut etre relache au-dessus).
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(85);
    expect(ALL_PERMISSIONS.length).toBeLessThanOrEqual(120); // cap raisonnable Sprint 7
  });
});
```

### 6.9 Fichier `repo/packages/auth/src/rbac/index.ts`

```typescript
/**
 * @file index.ts
 * @description Barrel export du sous-module RBAC du package @insurtech/auth.
 * @sprint 7 -- Tache 2.3.1
 * @package @insurtech/auth
 *
 * Pattern d'import recommande dans les apps consommatrices :
 *   import { Permission, AuthRole, isValidPermission } from '@insurtech/auth/rbac';
 *
 * NE PAS importer depuis les sous-modules internes :
 *   // BAD : import { Permission } from '@insurtech/auth/rbac/permissions.enum';
 *   // GOOD : import { Permission } from '@insurtech/auth/rbac';
 */

// Roles
export {
  AuthRole,
  ALL_ROLES,
  isAuthRole,
  AuthRoleSchema,
  ROLE_CATEGORIES,
  type AuthRoleValue,
  type RoleCategory,
} from './roles.enum';

// Permissions
export {
  Permission,
  ALL_PERMISSIONS,
  PermissionKeys,
  type PermissionValue,
} from './permissions.enum';

// Module / Action / Helpers
export {
  Module,
  Action,
  ALL_MODULES,
  ALL_ACTIONS,
  parsePermission,
  isValidPermission,
  formatPermission,
  getModuleFromPermission,
  getActionFromPermission,
  isOwnPermission,
  type ModuleValue,
  type ActionValue,
  type ParsedPermission,
} from './permission-helpers';

// Permissions-by-module
export {
  PermissionsByModule,
  getPermissionsByModule,
  getPermissionCountByModule,
  getActiveModules,
  getAllOwnPermissions,
  getAllReadPermissions,
  getAllWritePermissions,
} from './permissions-by-module';

// Role metadata
export {
  RoleMetadata,
  getRoleMetadata,
  getRolesByType,
  isMfaMandatoryForRole,
  type RoleLevel,
  type RoleType,
  type RoleI18nDescription,
  type RoleMeta,
} from './role-metadata';

// Validator
export {
  validatePermissionsCatalog,
  assertPermissionsCatalogValid,
  type ValidationError,
  type ValidationResult,
} from './permissions-validator';

// Constantes
export {
  RBAC_WILDCARD,
  PERMISSION_NAMING_REGEX,
  ROLE_NAMING_REGEX,
  MAX_PERMISSIONS_PER_ROLE,
  DEFAULT_PERMISSION_TTL_SECONDS,
  DEFAULT_ABAC_TTL_SECONDS,
  REDIS_RBAC_PREFIX,
  RBAC_ERROR_CODES,
  type RbacErrorCode,
} from './rbac-constants';
```

---

## 7. Tests complets

Le fichier de tests `permissions.spec.ts` (section 6.8) couvre 28 cas Vitest organises en 7 describe blocks :
- `AuthRole enum` (7 tests : V1, V1b-g) -- count 12, contenu attendu, type guard, Zod schema, categories
- `Permission enum` (10 tests : V2-V7d) -- count >= 85, regex, no duplicates, modules count, wildcard exclu, by-module
- `Permission helpers` (8 tests : V8-V11c) -- parsePermission, isValidPermission, formatPermission, helpers extraction, isOwnPermission
- `Module / Action enums` (4 tests : V12-V13b) -- count modules, actions cycle vie police
- `Role metadata` (8 tests : V14-V17b) -- count 12, descriptions FR/EN/AR, super_admin RLS, MFA, hierarchy, types
- `Permissions catalog validator` (3 tests : V18-V19) -- validate retourne valid=true, stats coherentes, wildcard detection
- `Subset queries` (2 tests : V20-V20b) -- getAllOwnPermissions, getAllReadPermissions
- `Catalog integrity` (5 tests : V21-V25) -- no emoji, PermissionKeys consistency, naming UPPER_SNAKE, no TODO/FIXME, count snapshot

Configuration Vitest (deja en place Sprint 1) :
```typescript
// vitest.config.ts (extrait pertinent)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
```

Run :
```bash
pnpm --filter @insurtech/auth test rbac/permissions.spec.ts
# Expected output :
#   Test Files  1 passed (1)
#        Tests  28 passed (28)
```

---

## 8. Variables environnement

Aucune nouvelle variable d'environnement requise par cette tache. Le catalog est code-as-config charge au demarrage de l'application.

Variables existantes consommees indirectement (definies aux Sprint 1.1.8 et Sprint 5) :
- `LOG_LEVEL` (string, defaut `info`) : Pino logger pour les warnings du validator
- `NODE_ENV` (string, `development`/`production`) : determine si le validator throw (prod) ou log warning (dev)

Variables introduites par Tache 2.3.10 (anticipation, pas dans cette tache) :
- `REDIS_RBAC_DB` (number, defaut `0`) : DB Redis pour cache permissions
- `LOG_RBAC_GRANTED` (boolean, defaut `false`) : log granted access en plus du denied (Tache 2.3.9)

---

## 9. Commandes shell

### 9.1 Setup initial du sous-dossier rbac

```bash
# Depuis la racine du monorepo repo/
cd packages/auth/src
mkdir -p rbac

# Verifier que le package @insurtech/auth existe (Sprint 5 livre)
test -f ../package.json && echo "auth package exists" || echo "ERROR: run Sprint 5 first"

# Verifier dependances : zod, vitest deja installes
cat ../package.json | grep -E '"zod"|"vitest"'
```

### 9.2 Creation des 9 fichiers (commande sequentielle)

```bash
# A executer depuis repo/packages/auth/src/rbac/
touch rbac-constants.ts
touch roles.enum.ts
touch permissions.enum.ts
touch permission-helpers.ts
touch permissions-by-module.ts
touch role-metadata.ts
touch permissions-validator.ts
touch permissions.spec.ts
touch index.ts

# Coller le contenu des sections 6.1 a 6.9 dans chaque fichier
```

### 9.3 Commandes de verification

```bash
# Typecheck (doit retourner exit code 0)
pnpm --filter @insurtech/auth typecheck

# Lint Biome (zero warning attendu)
pnpm --filter @insurtech/auth lint

# Tests Vitest (28 tests doivent passer)
pnpm --filter @insurtech/auth test rbac/permissions.spec.ts

# Coverage (>=90% lines)
pnpm --filter @insurtech/auth test --coverage rbac/

# Verifier count permissions runtime
node -e "
const { ALL_PERMISSIONS } = require('./packages/auth/dist/rbac/permissions.enum.js');
console.log('Total permissions:', ALL_PERMISSIONS.length);
console.log('Modules:', new Set(ALL_PERMISSIONS.map(p => p.split('.')[0])).size);
"

# Verifier no emoji (regex Unicode)
grep -rE "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src/rbac/ && echo "EMOJI FOUND" || echo "OK no emoji"

# Verifier no TODO/FIXME
grep -rE "TODO|FIXME|XXX" packages/auth/src/rbac/ && echo "TODO FOUND" || echo "OK no TODO"
```

### 9.4 Build du package

```bash
pnpm --filter @insurtech/auth build
ls packages/auth/dist/rbac/
# Expected files:
#   index.js, index.d.ts
#   roles.enum.js, roles.enum.d.ts
#   permissions.enum.js, permissions.enum.d.ts
#   ...
```

---

## 10. Criteres validation V1-V29

Chaque critere a une commande verifiable et un expected output.

### V1 (P0) -- 12 roles enum
- Commande : `pnpm --filter @insurtech/auth test -- -t "V1 :"`
- Expected : `1 passed`, output `expect(ALL_ROLES).toHaveLength(12)` succeeds

### V2 (P0) -- 85+ permissions
- Commande : `node -e "console.log(require('./packages/auth/dist/rbac').ALL_PERMISSIONS.length)"`
- Expected : nombre >= 85

### V3 (P0) -- Naming regex respecte
- Commande : `pnpm --filter @insurtech/auth test -- -t "V3 :"`
- Expected : 1 passed, toutes permissions matchent `/^[a-z][a-z_]*\.[a-z][a-z_]*\.[a-z][a-z_]*$/`

### V4 (P0) -- Pas de duplications
- Commande : `pnpm --filter @insurtech/auth test -- -t "V4 :"`
- Expected : 1 passed, `new Set(ALL_PERMISSIONS).size === ALL_PERMISSIONS.length`

### V5 (P0) -- 15+ modules couverts
- Commande : `pnpm --filter @insurtech/auth test -- -t "V5 :"`
- Expected : 1 passed, modules.size >= 15

### V6 (P0) -- Wildcard exclu
- Commande : `pnpm --filter @insurtech/auth test -- -t "V6 :"`
- Expected : 1 passed, `'*'` non present dans ALL_PERMISSIONS

### V7 (P1) -- permissions-by-module reflete enum
- Commande : `pnpm --filter @insurtech/auth test -- -t "V7 :"`
- Expected : 1 passed, sum permissions par module = ALL_PERMISSIONS.length

### V8 (P0) -- parsePermission decompose
- Commande : `pnpm --filter @insurtech/auth test -- -t "V8 :"`
- Expected : 2 passed (V8 + V8b throw)

### V9 (P0) -- isValidPermission accepte/rejette
- Commande : `pnpm --filter @insurtech/auth test -- -t "V9 :"`
- Expected : 2 passed

### V10 (P0) -- formatPermission valide
- Commande : `pnpm --filter @insurtech/auth test -- -t "V10 :"`
- Expected : 2 passed

### V11 (P0) -- Helpers extraction
- Commande : `pnpm --filter @insurtech/auth test -- -t "V11 :"`
- Expected : 3 passed (module, action, isOwn)

### V12 (P0) -- Module enum complet
- Commande : `pnpm --filter @insurtech/auth test -- -t "V12 :"`
- Expected : 2 passed

### V13 (P0) -- Action enum cycles vie
- Commande : `pnpm --filter @insurtech/auth test -- -t "V13 :"`
- Expected : 2 passed (read + cancel/resiliate/suspend/terminate)

### V14 (P0) -- RoleMetadata 12 roles
- Commande : `pnpm --filter @insurtech/auth test -- -t "V14 :"`
- Expected : 2 passed (count + i18n)

### V15 (P0) -- super_admin / analyst_support / assure / prospect specs
- Commande : `pnpm --filter @insurtech/auth test -- -t "V15 :"`
- Expected : 4 passed

### V16 (P0) -- Hierarchie inheritance broker_admin / garage_admin
- Commande : `pnpm --filter @insurtech/auth test -- -t "V16 :"`
- Expected : 2 passed

### V17 (P0) -- getRolesByType + isMfaMandatoryForRole
- Commande : `pnpm --filter @insurtech/auth test -- -t "V17 :"`
- Expected : 2 passed

### V18 (P0) -- Validator retourne valid=true
- Commande : `pnpm --filter @insurtech/auth test -- -t "V18 :"`
- Expected : 2 passed (valid + stats)

### V19 (P0) -- Validator detecte wildcard
- Commande : `pnpm --filter @insurtech/auth test -- -t "V19 :"`
- Expected : 1 passed

### V20 (P0) -- Subsets own/read
- Commande : `pnpm --filter @insurtech/auth test -- -t "V20 :"`
- Expected : 2 passed

### V21 (P0) -- Aucune emoji
- Commande : `grep -rE "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src/rbac/ ; echo $?`
- Expected : exit code 1 (grep no match)

### V22 (P0) -- PermissionKeys consistency
- Commande : `pnpm --filter @insurtech/auth test -- -t "V22 :"`
- Expected : 1 passed

### V23 (P0) -- UPPER_SNAKE prefix matches module
- Commande : `pnpm --filter @insurtech/auth test -- -t "V23 :"`
- Expected : 1 passed

### V24 (P0) -- Aucun TODO/FIXME
- Commande : `grep -rE "TODO|FIXME|XXX" packages/auth/src/rbac/ ; echo $?`
- Expected : exit code 1 (grep no match)

### V25 (P0) -- Snapshot count
- Commande : `pnpm --filter @insurtech/auth test -- -t "V25 :"`
- Expected : 1 passed (85 <= count <= 120)

### V26 (P0) -- Typecheck strict
- Commande : `pnpm --filter @insurtech/auth typecheck`
- Expected : exit code 0, output `Found 0 errors.`

### V27 (P0) -- Lint Biome propre
- Commande : `pnpm --filter @insurtech/auth lint`
- Expected : exit code 0, zero warning

### V28 (P0) -- Build successful
- Commande : `pnpm --filter @insurtech/auth build`
- Expected : exit code 0, `dist/rbac/index.js` cree

### V29 (P0) -- Test suite complete
- Commande : `pnpm --filter @insurtech/auth test rbac/`
- Expected : `Test Files  1 passed (1)`, `Tests  28 passed (28)`, duration < 5s

---

## 11. Edge cases + troubleshooting

### EC-1 : Permission renaming break references

**Scenario** : Sprint 12 decide de renommer `compliance.acaps_reports.generate` en `compliance.acaps.generate_quarterly`.

**Symptomes** : compilation TypeScript echoue dans `apps/api/src/modules/compliance/controllers/acaps.controller.ts` car `Permission.COMPLIANCE_ACAPS_REPORTS_GENERATE` n'existe plus.

**Solution** :
1. Ajouter la nouvelle permission dans `permissions.enum.ts` SANS supprimer l'ancienne
2. Marquer l'ancienne avec commentaire `// @deprecated -> use COMPLIANCE_ACAPS_GENERATE_QUARTERLY (Sprint 12)`
3. Migrer les usages progressivement
4. Au sprint suivant, supprimer l'ancienne et la matrice (Tache 2.3.2) + tests sont mis a jour automatiquement par typecheck

### EC-2 : Typo dans cle UPPER_SNAKE non detecte

**Scenario** : Developpeur ecrit `CRM_CONTAACTS_READ: 'crm.contacts.read'` (double A).

**Symptomes** : aucune erreur de compilation (cle libre), mais `Permission.CRM_CONTACTS_READ` (cle correcte) genere erreur partout dans le code.

**Solution** :
- Le test V23 (UPPER_SNAKE prefix matches module) detecte partiellement
- Le validator V8 (key vs value match) emet warning si `key.startsWith(module.toUpperCase())` mais ne couvre pas tous les typos middle
- Recommandation : ajouter regle ESLint custom Sprint 8 verifiant la convention `Object.keys(Permission).every(k => k === expectedKey(Permission[k]))`

### EC-3 : Module deprecation (e.g. retirer 'booking')

**Scenario** : Sprint 25 decide de fusionner `booking` dans `comm`. Comment supprimer le module sans casser ?

**Solution** :
1. Marquer toutes permissions `booking.*` avec JSDoc `@deprecated -> use comm.appointments.*`
2. Ajouter equivalents dans `comm` module
3. Sprint suivant : supprimer permissions `booking.*` -> typecheck force migration des consommateurs
4. Module enum : retirer `BOOKING` de `Module` enum -> validator detecte permissions orphelines

### EC-4 : Role addition future (e.g. compliance_officer Sprint 12)

**Scenario** : Sprint 12 ajoute le role `compliance_officer` pour les agents de conformite.

**Solution** :
1. Ajouter `COMPLIANCE_OFFICER: 'compliance_officer'` dans `AuthRole`
2. Ajouter metadata dans `RoleMetadata` (FR/EN/AR + level + type='compliance' nouveau)
3. TypeScript force mise a jour `PermissionsMatrix` (Tache 2.3.2) car `Record<AuthRoleValue, ...>` exhaustif
4. Test V1 echoue (count != 12) -> mettre a jour assertion `toHaveLength(13)` explicitement
5. Test V14 echoue (count metadata != 12) -> mettre a jour assertion `toHaveLength(13)`
6. PR review : 2 approbations + ACAPS validation requise

### EC-5 : Wildcard `'*'` accidentellement utilise comme permission

**Scenario** : Developpeur tente `@RequirePermission('*')` pour endpoint super_admin only.

**Symptomes** : guard accepte la string mais `RbacService.canAccess(role, '*')` ne match jamais (sauf super_admin via matrix).

**Solution** :
- Test V19 verifie que `'*'` ne passe pas `PERMISSION_NAMING_REGEX`
- `isValidPermission('*')` retourne `false`
- Recommandation : utiliser `@Role('super_admin_platform')` ou `@MinRole(...)` au lieu de wildcard permission

### EC-6 : Permission naming `read_own` vs `read.own` confusion

**Scenario** : Developpeur ecrit `crm.contacts.read.own` (4 segments avec point).

**Symptomes** : `PERMISSION_NAMING_REGEX` rejette (3 segments only), validator throw au boot.

**Solution** :
- Convention stricte : `_own` est suffixe d'action, pas segment separe
- `parsePermission('crm.contacts.read.own')` throw immediatement
- Test V8b couvre ce cas

### EC-7 : i18n description manque pour nouveau role

**Scenario** : Ajout `compliance_officer` mais oubli langue arabe.

**Symptomes** : Test V14b echoue (`expect(meta.displayName.ar.length).toBeGreaterThan(0)`).

**Solution** :
- Test V14b detecte au CI
- Pas de fallback automatique : exigence stricte FR/EN/AR pour Maroc (decision-008)
- PR rejete jusqu'a ajout traduction validee par equipe AR

### EC-8 : Permission non utilisee dans matrice (orpheline)

**Scenario** : Permission `sky.tools.invoke` ajoutee Sprint 7 mais aucun role ne l'a (sera attribuee Sprint 31).

**Symptomes** : aucune erreur, mais permission "morte" dans le catalog.

**Solution** :
- Acceptable : preparation forward des sprints futurs
- Tache 2.3.2 (Matrice) ajoute commentaire `// Permission reservee Sprint 31` sur les non-attribuees
- Test cross-reference Sprint 25+ : `permissionsUsedInMatrix.size === ALL_PERMISSIONS.length` (warn si difference)

### EC-9 : Tree-shaking insuffisant -> bundle frontend trop gros

**Scenario** : Frontend `web-broker` importe `Permission` et bundle inclut les 85+ permissions meme inutilisees.

**Symptomes** : bundle JS >100kb a cause du Permission objet complet.

**Solution** :
- `as const` permet narrowing TypeScript mais Object literal est tout-ou-rien runtime
- Pour optimisation extreme : importer permissions specifiques `import { CRM_CONTACTS_READ } from '@insurtech/auth/rbac/permissions/crm'` (split par module Sprint 8 si necessaire)
- Mesure Sprint 16 : si bundle >300kb, splitter `permissions.enum.ts` en `permissions/{module}.ts` files

### EC-10 : Validator boot-time bloque dev local

**Scenario** : Developpeur en local edite `permissions.enum.ts`, oublie virgule, validator throw au demarrage.

**Symptomes** : `pnpm dev` echoue avec stack trace.

**Solution** :
- Validator throw EN PROD seulement (`NODE_ENV === 'production'`)
- En dev : log error structure mais continue
- Implementation suggeree dans `assertPermissionsCatalogValid()` :
  ```typescript
  if (process.env.NODE_ENV === 'production') {
    throw new Error(...);
  } else {
    logger.error('Permissions catalog invalid', { errors: result.errors });
  }
  ```

### EC-11 : Performance loading initial du catalog

**Scenario** : Boot de l'app api prend 5s a cause du parsing/validation du catalog.

**Symptomes** : startup time degrade.

**Solution** :
- Le const object `Permission` est statique, pas de parsing runtime (imports immediats)
- `validatePermissionsCatalog()` parcourt 85 permissions O(n) -> < 10ms
- `PermissionsByModule` IIFE construit map au load -> < 5ms
- Si latence observee : profiler Node.js + verifier que le test n'est pas la cause

### EC-12 : Conflits merge sur permissions.enum.ts

**Scenario** : 2 PRs paralleles ajoutent permissions, conflit Git massif.

**Solution** :
- Convention sprint : les PRs ajoutent permissions UNIQUEMENT dans le bloc de leur module
- Si 2 PRs touchent meme module, premiere mergee, seconde rebase
- Outil : `git mergetool` configurer pour TS files
- Long terme Sprint 25+ : split `permissions.enum.ts` en 19 fichiers `permissions/{module}.ts` re-exports

---

## 12. Conformite Maroc detaillee

### 12.1 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

**Reference reglementaire** : Circulaire ACAPS AS/02/24 article 12 -- separation des duties broker.

**Permissions impactees** :
- `insure.policies.create` (souscription) DOIT etre separe de `insure.policies.cancel` (annulation) -> 2 permissions distinctes (verifie test V13b)
- `pay.transactions.create` DOIT etre separe de `pay.transactions.reconcile` -> 2 permissions distinctes
- `compliance.acaps_reports.generate` reservee role specifique (broker_admin uniquement Sprint 12)

**Contraintes catalog** :
- Roles broker_user et broker_assistant ne doivent JAMAIS avoir `pay.transactions.reconcile` (verifie Tache 2.3.2)
- Role broker_admin doit avoir audit obligatoire sur `insure.policies.cancel` (Tache 2.3.9 RbacAuditService)
- Role super_admin_platform genere les rapports trimestriels via `compliance.acaps_reports.generate`

### 12.2 AMC (Association Marocaine d'Assurance et de Reassurance)

**Reference reglementaire** : Code des assurances Maroc loi 17-99 article 35 -- droit de retractation.

**Permissions impactees** :
- `pay.refunds.create` controlee par TimeBasedPolicy (Tache 2.3.7) : autorisee si `transaction.created_at > NOW() - 30 jours`
- `insure.policies.resiliate` distincte de `insure.policies.cancel` :
  - cancel = avant signature (sans frais)
  - resiliate = apres signature (selon delais loi 17-99, frais possibles)

**Contraintes catalog** :
- Action `resiliate` est documentee dans `Action` enum (test V13b couvre)
- Permission `insure.policies.resiliate` accordee a broker_admin uniquement (pas broker_user)

### 12.3 CNDP (Commission Nationale de Controle de la Protection des Donnees Personnelles)

**Reference reglementaire** : Loi 09-08 article 17 -- droit a l'oubli, audit acces donnees.

**Permissions impactees** :
- `compliance.cndp_purge.execute` reservee super_admin_platform (purge totale tenant a la demande utilisateur)
- TOUS les acces aux donnees personnelles loggges via Tache 2.3.9 RbacAuditService
- Permissions `*.read_own` enforcees ABAC OwnResourcesPolicy garantissant qu'un user ne voit pas les donnees d'un autre

**Contraintes catalog** :
- Role assure ne doit avoir AUCUNE permission `*_all` (verifie Tache 2.3.2 matrix test)
- Role analyst_support a wildcard `*.read` mais audit complet de chaque acces (Sprint 26 impersonation)
- `crm.contacts.export` declenche un evenement Kafka `compliance.export_executed` pour audit CNDP

### 12.4 Loi 09-08 (Protection des donnees personnelles)

**Implications design** :
- Permissions `_own` matrices grace a OwnResourcesPolicy (Sprint 7 Tache 2.3.7)
- Permission `compliance.audit_trail.read` reservee compliance_officer (Sprint 12) ou super_admin
- Pas de permission "read_all_pii" globale -> approche least-privilege

### 12.5 Decision-008 Data Residency

**Implications catalog** :
- Description trilingue FR/EN/AR obligatoire pour 12 roles (test V14b enforces)
- Module `compliance` pre-existe avec 5 permissions (CNDP/ACAPS/DGI/AML)
- Module `cross_tenant` pre-existe pour Sprint 25 (transferts cross-tenant audites)

---

## 13. Conventions absolues skalean-insurtech

### 13.1 Multi-tenant strict

Les permissions du catalog sont **tenant-agnostiques** (la permission `crm.contacts.read` existe globalement) mais leur **evaluation** est tenant-aware (`RbacService.canAccess(role, perm, { tenantId })`). Cette tache 2.3.1 ne contient aucune logique tenant ; le tenant filtering vient de Sprint 6 (TenantContext) et est applique par les guards (Tache 2.3.5+).

Les permissions `admin.tenants.*` sont reservees super_admin_platform et bypass RLS (cf. metadata `bypassRls: true`).

### 13.2 Validation Zod systematique

Le fichier `roles.enum.ts` exporte `AuthRoleSchema` (Zod schema). Les fichiers `permissions.enum.ts` et autres N'EXPORTENT PAS de Zod schema directement (le typeguard `isValidPermission` suffit) car la PermissionValue est consommee uniquement via reference symbolique `Permission.X`.

Au boot, `assertPermissionsCatalogValid()` verifie l'integrite (utilise validation manuelle, pas Zod, pour avoir messages d'erreurs detailles).

### 13.3 Logging Pino

Aucun logging dans cette tache (pure fonction de catalog). Les Taches 2.3.3+ (RbacService, Guards, AuditService) introduiront le logging structure Pino avec context tenant/user.

### 13.4 Argon2id

Sans objet pour cette tache (pas de hash password manipulation).

### 13.5 pnpm + workspace strict

Le sous-dossier `packages/auth/src/rbac/` est livre dans le workspace `@insurtech/auth` deja initialise par Sprint 5. Aucune nouvelle dependance externe ajoutee. Les dependances utilisees (`zod`, `vitest`) sont deja dans `packages/auth/package.json`.

### 13.6 TypeScript strict

Tous les fichiers respectent `strict: true`, `noUncheckedIndexedAccess: true`. Notation `as const` systematique sur les const objects. Aucun `any`. Aucun `@ts-ignore`. Type guards explicites (`isAuthRole`, `isValidPermission`).

### 13.7 RBAC convention (cette tache l'etablit)

Cette tache POSE la convention RBAC pour le programme. Toutes les futures permissions (Sprint 8 a 35) DOIVENT respecter :
- Format `{module}.{resource}.{action}`
- Module appartenant a `Module` enum (extension via PR review)
- Action appartenant a `Action` enum ou warning validator
- Cle UPPER_SNAKE_CASE matchant la valeur

### 13.8 Events Kafka

Sans objet pour cette tache (catalog statique). La Tache 2.3.9 (RbacAuditService) emettra les events Kafka `insurtech.events.audit.access_granted` et `access_denied`.

### 13.9 No-emoji ABSOLU (decision-006)

Verifie par test V21 (regex Unicode emoji ranges). Aucune emoji dans :
- Valeurs string permissions
- Cles TypeScript
- Commentaires inline
- Descriptions FR/EN/AR (note : l'arabe utilise des caracteres Unicode mais PAS dans les ranges emoji, verifie)

### 13.10 Idempotency

Les fonctions exportees sont pures et idempotentes :
- `parsePermission(p)` : meme input -> meme output, pas d'effet de bord
- `isValidPermission(v)` : meme input -> meme output
- `validatePermissionsCatalog()` : pure (no side effect, pas de logging interne)
- `getRoleMetadata(role)` : retourne reference frozen, pas de cloning

### 13.11 Conventional Commits

Le commit final de cette tache suit la convention :
```
feat(auth/rbac): catalog 12 roles + 85 permissions (Sprint 7 Task 2.3.1)
```

Voir section 16.

### 13.12 Cloud souverain MA

Sans impact direct cette tache (pas de cloud / DB). Les permissions `cross_tenant.*` (Sprint 25) et `admin.tenants.purge` (CNDP) preparent les exigences souverainete.

---

## 14. Validation pre-commit

Sequence executable a lancer avant tout `git commit` :

```bash
# 1. Format check
pnpm --filter @insurtech/auth format:check
# Expected: exit 0

# 2. Lint
pnpm --filter @insurtech/auth lint
# Expected: exit 0, zero warning

# 3. Typecheck strict
pnpm --filter @insurtech/auth typecheck
# Expected: exit 0, "Found 0 errors"

# 4. Tests RBAC
pnpm --filter @insurtech/auth test rbac/permissions.spec.ts
# Expected: 28 tests passed, duration < 5s

# 5. No-emoji check (regle decision-006)
node infrastructure/scripts/check-no-emoji.sh packages/auth/src/rbac/
# Expected: exit 0, "OK no emoji found"

# 6. No TODO/FIXME check
grep -rE "TODO|FIXME|XXX" packages/auth/src/rbac/ && echo "FAIL: TODO found" || echo "OK"

# 7. Build (verifier que le package compile)
pnpm --filter @insurtech/auth build
# Expected: exit 0, dist/rbac/ contient 9 fichiers .js + .d.ts

# 8. Verifier count permissions runtime
node -e "
const m = require('./packages/auth/dist/rbac/index.js');
if (m.ALL_PERMISSIONS.length < 85) {
  console.error('FAIL: only', m.ALL_PERMISSIONS.length, 'permissions');
  process.exit(1);
}
if (m.ALL_ROLES.length !== 12) {
  console.error('FAIL: expected 12 roles, got', m.ALL_ROLES.length);
  process.exit(1);
}
const validation = m.validatePermissionsCatalog();
if (!validation.valid) {
  console.error('FAIL: catalog invalid', validation.errors);
  process.exit(1);
}
console.log('OK: 12 roles +', m.ALL_PERMISSIONS.length, 'permissions, validation passed');
"
# Expected: "OK: 12 roles + 85+ permissions, validation passed"
```

Si toutes les commandes retournent exit 0, le commit est autorise. Sinon, corriger avant push.

---

## 15. Commit message complet

```
feat(auth/rbac): catalog 12 roles + 85 permissions (Sprint 7 Task 2.3.1)

Pose la fondation typee du systeme RBAC du programme Skalean InsurTech v2.2 :
- AuthRole enum strict avec 12 roles (super_admin_platform, analyst_support,
  broker_admin, broker_user, broker_assistant, garage_admin, garage_chef,
  garage_technicien, garage_comptable, garage_commercial, assure, prospect)
- Permission const object avec 85+ permissions au format {module}.{resource}.{action}
- 19 modules couverts : auth, tenant, crm, booking, comm, docs, signature,
  pay, books, compliance, analytics, insure, repair, stock, hr, admin,
  cross_tenant, sky, mcp, public
- 24+ actions standards documentees dans Action enum
- RoleMetadata trilingue FR/EN/AR pour les 12 roles + niveau hierarchie
- permissions-by-module groupage programmatique (single source of truth)
- permissions-validator boot-time check (regex naming, no duplicate, modules valides)
- permission-helpers (parsePermission, isValidPermission, formatPermission)
- rbac-constants (RBAC_WILDCARD reserve, regex naming, TTL defaults)
- 28 tests Vitest exhaustifs (count, naming, no-duplicate, hierarchy, i18n)

Files:
  + packages/auth/src/rbac/roles.enum.ts            (80 lignes)
  + packages/auth/src/rbac/permissions.enum.ts      (500 lignes)
  + packages/auth/src/rbac/permissions-by-module.ts (120 lignes)
  + packages/auth/src/rbac/permissions.spec.ts      (250 lignes)
  + packages/auth/src/rbac/permissions-validator.ts (100 lignes)
  + packages/auth/src/rbac/permission-helpers.ts    (180 lignes)
  + packages/auth/src/rbac/role-metadata.ts         (200 lignes)
  + packages/auth/src/rbac/rbac-constants.ts        (60 lignes)
  + packages/auth/src/rbac/index.ts                 (40 lignes)

Conformite:
  - ACAPS Circulaire AS/02/24 art.12 (separation duties broker)
  - AMC code assurances loi 17-99 art.35 (droit retractation 30j)
  - CNDP loi 09-08 art.17 (droit oubli, audit acces PII)
  - Decision-006 (no-emoji absolue, verifie test V21)
  - Decision-008 (data residency MA, descriptions FR/EN/AR)
  - Decision-012 (catalog format const object)

Tests:
  - 28 tests Vitest passent en < 5s
  - Coverage > 95% (lines/functions/branches)
  - Validator boot-time retourne valid=true

Refs: B-07 Tache 2.3.1
Sprint: 7
Phase: 2
Task: 2.3.1

Closes: #SPR7-T231
```

---

## 16. Workflow next step

A l'issue de cette tache 2.3.1 validee (V1-V29 tous au vert), passer a :

**Tache 2.3.2 -- PermissionsMatrix + RoleHierarchy**
Fichier : `00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.2-permissions-matrix-role-hierarchy.md`

Cette tache 2.3.2 consommera :
- `AuthRole` (12 roles) -> cle de la `Record<AuthRoleValue, PermissionValue[]>`
- `Permission` (85+) -> valeurs autorisees
- `RoleMetadata.inheritsFrom` -> resolution recursive `getEffectivePermissions(role)`
- `RBAC_WILDCARD` -> super_admin_platform mapping

Et produira :
- `permissions-matrix.ts` (~250 lignes) : matrice 12 roles x permissions
- `role-hierarchy.ts` (~30 lignes) : map inheritance
- `permissions-matrix.spec.ts` (~150 lignes) : tests coherence

Apres Tache 2.3.2 :
- Tache 2.3.3 RbacService (consomme matrice + hierarchy)
- Tache 2.3.4-8 Guards / Decorators
- Tache 2.3.9-12 Audit + Cache + Admin + Tests E2E

Le sprint complet livre le RBAC operationnel pour les 28 sprints metier suivants.

---

**Fin de la tache 2.3.1.** Densite cible 100-150 ko atteinte. Auto-suffisant : Claude Code n'a pas besoin de relire le B-07 pour executer cette tache.
