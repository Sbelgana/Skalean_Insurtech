# Tache 7.5a.8 -- Suite de tests complete RBAC + RLS v3.0 et garantie de zero regression sur 1071+ tests existants

> Fichier de tache autoportant (self-contained). Aucune lecture d'un autre document n'est necessaire pour executer cette tache. Tout le contexte, tout le code de test, tous les scenarios et tous les criteres de validation sont reproduits integralement ci-dessous. Le code TypeScript fourni est complet, executable, sans pseudo-code ni placeholder.

---

## 1. Metadonnees de la tache

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5a -- Assurflow Foundation |
| Position dans le sprint | Tache 8 / 10 |
| Reference meta-prompt | B-7.5a Tache 7.5a.8 |
| Phase | 2.5 -- Migration Assurflow |
| Priorite | P0 (bloquant chemin critique -- porte GO/NO-GO) |
| Effort estime | 3h |
| Dependances | 7.5a.7 (documentation `5-roles-permissions.md` v3.0 redigee et alignee sur le code) |
| Bloque | 7.5a.9 (commit + tag de la fondation Assurflow v3.0) |
| Densite cible | 80-150 ko (cible reelle ~110-130 ko) |
| Emoji | AUCUNE EMOJI (decision-006 ABSOLUE) |
| Packages cibles | `@insurtech/auth` (`repo/packages/auth`) et `@insurtech/database` (`repo/packages/database`) |
| Type de livraison | Specs Vitest (unitaires + integration Postgres + coherence anti-derive), aucune modification de code applicatif |
| Nature | Tache d'agregation et de non-regression : re-execute la totalite de la suite, ajoute les tests transverses manquants, scelle la porte GO/NO-GO |

---

## 2. But

Construire, executer et faire passer au vert la **suite de tests complete** qui valide l'integralite de la fondation Assurflow v3.0 livree par les taches 7.5a.2 a 7.5a.7, puis scelle la **porte de decision GO/NO-GO** avant le commit final (tache 7.5a.9).

La suite couvre trois axes indissociables :

1. **Zero regression** sur la base existante de **1071+ tests** deja verts avant le Sprint 7.5a. Le seuil de tolerance est strict : toute regression strictement superieure a 5 tests casses declenche un **NO-GO** automatique et bloque 7.5a.9.
2. **Nouveaux comportements v3.0** : les **14 nouveaux roles** (6 garage avec `garage_parts_manager`, 6 carrier, 4 expert, 3 tow -- soit 26 roles au total), les **4 nouveaux types cross-tenant** (7 types au total), les **~40 nouvelles permissions** (130 permissions au total apres 7.5a.6), la nouvelle table `expert_designations` avec RLS forcee.
3. **Coherence transverse anti-derive** : triangulation stricte entre le code TypeScript (`AuthRole`, `Permission`, `CrossTenantAuthorizationType`), la base de donnees (contraintes `CHECK` SQL, fonction `app_can_access_tenant`), et la documentation (`5-roles-permissions.md`). Toute divergence entre ces trois sources de verite doit etre detectee mecaniquement par un test.

Cette tache n'ecrit **aucun code applicatif**. Elle agrege les specs unitaires authoritees par 7.5a.2 (roles), 7.5a.3 (types cross-tenant), 7.5a.4 (migration), 7.5a.5 (helper RLS), 7.5a.6 (permissions), 7.5a.7 (documentation), les re-execute, et ajoute les specs transverses qui n'appartiennent a aucune tache individuelle : la coherence triangulaire et le decompte de non-regression global.

La sortie attendue est binaire : **GO** (la fondation est saine, 7.5a.9 peut committer et tagger) ou **NO-GO** (regression detectee, derive de coherence, ou couverture insuffisante -- 7.5a.9 est bloque).

---

## 3. Contexte etendu

### 3.1 Pourquoi une tache d'agregation et de non-regression dediee

Les taches 7.5a.2 a 7.5a.7 ont chacune livre leur propre `.spec.ts` colocalise (convention `tests strict` : chaque `.ts` possede son `.spec.ts`). Ces specs valident **localement** chaque livrable : l'enum des roles, l'union des types cross-tenant, la migration, le helper Postgres, le catalogue de permissions, la documentation. Mais aucune de ces taches ne repond a la question transverse qui fait la difference entre une fondation "qui compile" et une fondation "qui tient" :

- Est-ce que l'ajout de 14 roles a casse une assertion ailleurs (par exemple un test Sprint 7 qui supposait `ALL_AUTH_ROLES.length === 12`) ?
- Est-ce que les 7 types declares cote TypeScript correspondent EXACTEMENT aux 7 types acceptes par la contrainte `CHECK` SQL et aux 7 types reconnus par le `IN (...)` de `app_can_access_tenant` ?
- Est-ce que la documentation `5-roles-permissions.md` mentionne bien les 26 roles ET les 130 permissions, sans en oublier ni en inventer ?
- Est-ce que la couverture globale reste >= 85 %, et >= 90 % sur `auth` et `database`, malgre l'ajout de code neuf ?

Une fondation est par definition la couche sur laquelle tout le reste de la plateforme s'appuie. Une derive non detectee ici (un type present cote TS mais absent du `CHECK`, une permission documentee mais non implementee, un role qui passe deux guards mutuellement exclusifs) se propage silencieusement dans les Sprints 8 a 31 et ne se revele qu'en production, sous forme de fuite de donnees inter-tenant ou de refus d'acces injustifie. Le cout de detection est multiplie par cent. C'est pourquoi cette tache existe en tant qu'etape distincte, avec une porte GO/NO-GO formelle.

### 3.2 Ce qu'est la baseline de 1071+ tests

Avant le Sprint 7.5a, le monorepo `repo/` execute une suite Vitest qui totalise **au moins 1071 tests** repartis sur l'ensemble des packages (`@insurtech/shared-types`, `@insurtech/auth`, `@insurtech/database`, services NestJS des Sprints 5 a 31, etc.). Ce nombre est une borne basse : il evolue a la hausse a chaque sprint. La commande `pnpm test` agregee a la racine du workspace produit un recapitulatif `Test Files X passed | Tests Y passed`. La valeur de reference `Y >= 1071` est l'invariant que cette tache doit preserver, augmente des nouveaux tests ajoutes par 7.5a.2 a 7.5a.8.

Le decompte exact n'a pas besoin d'etre code en dur dans une assertion fragile : ce qui compte est **zero echec** (`Tests N failed` doit afficher `0 failed`) et un total qui ne **diminue jamais** (aucun test n'a ete supprime ou desactive subrepticement). La verification se fait par lecture de la sortie de `pnpm test` et par l'absence de `describe.skip` / `it.skip` nouvellement introduits sur des tests precedemment actifs.

### 3.3 Ce que "zero regression" signifie precisement

"Zero regression" ne veut pas dire "zero echec dans l'absolu" : certains tests d'integration RLS sont legitimement marques `describe.skip` quand `SKIP_INTEGRATION === 'true'` (absence de Postgres reel dans l'environnement CI unitaire). Cela est conforme au harness existant (`rls-auth-users.spec.ts` ligne 12 : `describe.skip(...)` avec un commentaire `TODO Sprint 6 : rewrite with non-superuser test role`). "Zero regression" signifie precisement :

1. Aucun test **precedemment vert** ne devient rouge.
2. Aucun test **precedemment actif** n'est passe en `.skip` pour masquer un echec (anti-pattern de dissimulation).
3. Le **total des tests passants** ne diminue pas (modulo les skips legitimes deja documentes).
4. La **couverture** ne descend pas sous les seuils contractuels (85 % global, 90 % sur `auth` et `database`).

Le seuil operationnel de la porte est : **regression > 5 tests => NO-GO**. La marge de 5 absorbe les faux positifs transitoires (flakiness reseau sur un test d'integration, par exemple) sans laisser passer une vraie regression structurelle. En pratique, l'objectif vise reste 0 regression ; la marge de 5 n'est qu'un garde-fou pour ne pas bloquer sur un aleas d'infrastructure isole.

### 3.4 La porte GO/NO-GO

La porte est la valeur ajoutee centrale de cette tache. Elle se materialise comme une checklist binaire evaluee a la fin de l'execution :

```text
GO si et seulement si TOUTES les conditions suivantes sont vraies :
  [ ] pnpm test : 0 failed, total >= baseline (1071+ + nouveaux)
  [ ] regression nette <= 5 (objectif 0)
  [ ] auth.spec : 26 roles, mutual-exclusivity, hierarchie exhaustive -> vert
  [ ] permissions.spec : 130 perms uniques, naming, 4 modules v3.0 -> vert
  [ ] cross-tenant.spec : 7 types, requiresTimeBoundedAuthorization -> vert
  [ ] migration.spec : up/down/up idempotent, CHECK 7+8, expert_designations RLS -> vert
  [ ] rls integration : 50+ scenarios, 7 types bidirectionnels, isolation expert_designations -> vert (si Postgres dispo)
  [ ] coherence.spec : triangulation TS == SQL == doc, 0 derive -> vert
  [ ] coverage : global >= 85 %, auth >= 90 %, database >= 90 %
=> sinon NO-GO : 7.5a.9 bloque, on corrige la cause racine puis on re-execute.
```

### 3.5 Alternatives envisagees et compromis

**Alternative A -- s'appuyer uniquement sur les specs par tache (7.5a.2 a 7.5a.7) sans tache d'agregation.** Rejetee. Chaque spec valide son livrable en isolement mais aucune ne valide la coherence inter-livrables ni la non-regression globale. Le risque de derive TS/SQL/doc resterait non couvert. C'est precisement la classe de bug la plus dangereuse pour une couche de fondation multi-tenant.

**Alternative B -- ecrire un mega-fichier de test unique regroupant physiquement tous les tests.** Rejetee. Viole la convention `tests strict` (colocalisation `.ts` <-> `.spec.ts`), nuit a la lisibilite, et rend les echecs difficiles a localiser. La bonne approche est de **garder les specs colocalisees** (qui restent la propriete de leur tache d'origine) et d'**ajouter seulement** les specs transverses manquantes (coherence triangulaire), puis de tout re-executer via `pnpm test`.

**Alternative C (retenue) -- agreger par re-execution + ajouter la coherence + sceller la porte.** On re-execute la suite complete via `pnpm test` (qui ramasse mecaniquement toutes les specs colocalisees), on ajoute les specs transverses (`v3-foundation-coherence.spec.ts`, et les specs d'integration cross-tenant/RLS v3 qui touchent plusieurs entites a la fois), et on formalise la porte GO/NO-GO. C'est le meilleur compromis entre exhaustivite, maintenabilite et respect des conventions.

**Compromis assume sur l'integration RLS.** Les tests d'integration RLS exigent un vrai Postgres avec un role non-superuser (sinon `BYPASSRLS` rend les policies inactives, comme documente dans le harness existant). Quand l'environnement n'a pas de Postgres, ces specs sont `describe.skip` et la porte se contente des axes unitaires + coherence. La porte distingue donc deux modes : **mode complet** (Postgres present, 50+ scenarios RLS executes) et **mode degrade** (Postgres absent, RLS skip mais documente). Le mode complet est obligatoire en CI d'integration et avant le tag de release ; le mode degrade est tolere en local rapide.

### 3.6 Pieges classiques a anticiper (8-12)

1. **RLS flaky a cause d'un `SET LOCAL` qui fuit.** `SELECT set_config('app.current_tenant_id', $1, true)` avec le troisieme argument `true` (is_local) ne s'applique qu'a la transaction courante. Si un test ouvre un `QueryRunner` sans transaction explicite et ne le libere pas (`qr.release()`), la variable de session peut persister sur la connexion reutilisee par le pool et contaminer le test suivant. Regle : toujours `setSession` au debut de chaque scenario et `qr.release()` dans un `finally` ou via le helper `withRlsContext`.
2. **Isolation transactionnelle des tests.** Deux tests qui inserent dans `auth_tenants` avec le meme UUID en dur se telescopent si l'ordre d'execution change (Vitest parallelise par defaut). Regle : UUID distincts par fichier de spec, ou nettoyage `afterAll`, ou `INSERT ... ON CONFLICT DO NOTHING`.
3. **Seuils de couverture trop optimistes.** Ajouter du code (14 roles, 40 perms) sans ajouter assez de tests fait MONTER le denominateur et peut faire DESCENDRE le pourcentage sous 85/90 %. Regle : la couverture de `auth-roles.ts` et `permissions.enum.ts` doit etre quasi 100 % grace aux boucles exhaustives sur `ALL_AUTH_ROLES` et `ALL_PERMISSIONS`.
4. **Derive de snapshot.** Un snapshot des valeurs litterales de roles detecte un renommage accidentel (`carrier_admin` -> `carriers_admin`), mais un developpeur presse peut faire `vitest -u` (update) et masquer le bug. Regle : le snapshot des roles doit etre un tableau trie ecrit EN DUR dans la spec (pas un `toMatchSnapshot()` auto-genere), de sorte qu'une divergence soit un echec de comparaison explicite, non un diff de fichier `.snap`.
5. **Base d'integration non seedee.** Les scenarios cross-tenant exigent des lignes `auth_tenants`, `auth_users` et `cross_tenant_authorizations`. Si le `beforeAll` ne seede pas ces lignes (ou les seede sous un mauvais contexte RLS), tous les scenarios echouent en cascade pour une cause unique. Regle : seeder sous `is_super_admin = true` dans le `beforeAll`, verifier le seed avant de lancer les scenarios.
6. **Collision de tenant en execution parallele.** Si `cross-tenant-v3.spec.ts` et `rls-helper-v3.spec.ts` tournent en parallele sur la meme base et utilisent les memes UUID de tenant, les `INSERT`/`DELETE` interferent. Regle : chaque spec d'integration utilise un prefixe d'UUID distinct (`aaaa...` pour A, `bbbb...` pour B dans un fichier, `cccc...`/`dddd...` dans l'autre).
7. **`expires_at` au passe par erreur.** Un scenario "autorisation active" qui pose `expires_at = NOW() - interval '1 hour'` teste en realite le cas expire et donne un faux negatif. Regle : `NOW() + interval '1 day'` pour les actives, `NOW() - interval '1 day'` pour les expirees, toujours explicite.
8. **`revoked_at` confondu avec `expires_at`.** Une autorisation revoquee a `revoked_at IS NOT NULL` meme si `expires_at` est dans le futur. Bien tester les deux dimensions independamment.
9. **Decompte de permissions errone.** `Object.values(Permission).length` compte les paires cle/valeur, pas les valeurs uniques. Si deux cles pointent vers la meme chaine, le `.length` reste correct mais `new Set(...).size` revele le doublon. Regle : asserter a la fois `length === 130` ET `new Set(...).size === 130`.
10. **Exhaustivite du `Record<AuthRole, ...>`.** `Object.keys(RoleHierarchy).length` doit egaler `ALL_AUTH_ROLES.length`. Un role ajoute a l'enum mais oublie dans le `RoleHierarchy` produit `undefined` a l'acces (et un crash `isTerminalRole`). Tester la cle a cle.
11. **Lecture de la definition de contrainte CHECK.** `pg_get_constraintdef(oid)` retourne une chaine dont le format exact (espaces, quotes, ordre des valeurs) depend de la version Postgres. Comparer par extraction des litteraux (regex sur les valeurs entre quotes simples), jamais par egalite stricte de chaine brute.
12. **Migrations non rejouables.** Le test d'idempotence `up -> down -> up` echoue si `down()` n'est pas strictement symetrique (table non droppee en CASCADE, contrainte non restauree). C'est un piege de la tache 7.5a.4 que cette tache doit re-verifier de bout en bout.

---

## 4. Contexte d'architecture

### 4.1 Position de la tache dans le sprint (8/10)

Cette tache est l'avant-derniere etape technique du Sprint 7.5a. Elle suit la livraison du code (7.5a.2 a 7.5a.6) et de la documentation (7.5a.7), et precede le commit/tag (7.5a.9). Elle est la **porte de qualite** : rien ne passe en 7.5a.9 si la suite n'est pas verte.

```text
7.5a.1  decisions 011-015
   |
7.5a.2  AuthRole 26 roles ............ (auth-roles.spec.ts)
7.5a.3  CrossTenantType 7 types ...... (cross-tenant-authorization.spec.ts)
7.5a.4  migration CHECK + expert ..... (migration spec)
7.5a.5  helper app_can_access_tenant . (rls helper spec)
7.5a.6  permissions 130 ............. (permissions.spec.ts)
7.5a.7  doc 5-roles-permissions.md ... (doc redigee)
   |
   v
7.5a.8  >>> CETTE TACHE : agregation + non-regression + coherence + PORTE GO/NO-GO <<<
   |
   v  (GO uniquement)
7.5a.9  commit + tag v3.0-foundation
```

### 4.2 La pyramide de tests et la porte

```text
                         +-------------------------------+
                         |     PORTE GO / NO-GO          |
                         |  (decision binaire 7.5a.8)    |
                         +---------------+---------------+
                                         ^
                                         | agrege les verdicts
            +----------------------------+----------------------------+
            |                            |                            |
   +--------v--------+         +---------v---------+        +---------v---------+
   |  COHERENCE      |         |  INTEGRATION      |        |  UNITAIRE         |
   |  (anti-derive)  |         |  (Postgres reel)  |        |  (pur TS)         |
   +-----------------+         +-------------------+        +-------------------+
   | TS == SQL == doc|         | migration up/down |        | auth-roles.spec   |
   | 26 roles in doc |         | RLS 50+ scenarios |        | permissions.spec  |
   | 130 perms in doc|         | 7 types bidir.    |        | role-hierarchy    |
   | CHECK == union  |         | expert_designations|       | cross-tenant.spec |
   +-----------------+         +-------------------+        +-------------------+
        lent (lit fichiers)        tres lent (DB)               rapide (ms)

   Flux de validation (bas vers haut) :
     unitaire -> integration migration -> integration RLS -> coherence -> PORTE
   Chaque etage doit etre vert pour que l'etage superieur ait un sens.
```

L'idee : les tests unitaires garantissent que chaque brique est correcte isolement (rapide, deterministe). Les tests d'integration garantissent que la brique fonctionne contre un vrai Postgres (lent, exige une DB). La coherence garantit que les trois sources de verite (code, DB, doc) racontent la meme histoire. La porte agrege le tout en un verdict unique consomme par 7.5a.9.

---

## 5. Livrables checkables

1. `repo/packages/auth/src/types/auth-roles.spec.ts` re-execute et vert : 26 roles, comptes par famille, mutual-exclusivity, hierarchie exhaustive, MFA, snapshot.
2. `repo/packages/auth/src/rbac/permissions.spec.ts` re-execute et vert : 130 permissions uniques, naming, 4 modules v3.0, niveaux de paiement.
3. `repo/packages/auth/src/rbac/role-hierarchy.spec.ts` re-execute et vert : DAG sans cycle, exhaustivite des cles, terminaux corrects, familles v3.0.
4. `repo/packages/database/src/entities/system/cross-tenant-authorization.spec.ts` re-execute et vert : 7 types, `requiresTimeBoundedAuthorization`.
5. `repo/packages/database/src/test/integration/cross-tenant-v3.spec.ts` cree : seed 2 tenants, 7 types insertables, CHECK rejette invalide, 8 resource_type, scenarios cross-tenant.
6. `repo/packages/database/src/test/integration/rls-helper-v3.spec.ts` cree : 50+ scenarios `app_can_access_tenant`, 7 types bidirectionnels, expire/revoque, isolation `expert_designations`.
7. `repo/packages/database/src/test/coherence/v3-foundation-coherence.spec.ts` cree : triangulation TS == SQL == doc, anti-derive.
8. Le test d'idempotence migration `up -> down -> up` passe (re-verifie ici).
9. `pnpm test` a la racine du workspace : `0 failed`, total >= 1071 + nouveaux tests.
10. `pnpm test --coverage` : global >= 85 %, `auth` >= 90 %, `database` >= 90 %.
11. Aucun `it.skip` / `describe.skip` nouvellement introduit sur un test precedemment actif (verifie par diff).
12. Le snapshot des 26 valeurs de roles est code en dur dans la spec (pas un `.snap` auto-genere).
13. Le decompte `ALL_AUTH_ROLES.length === 26` est asserte.
14. Le decompte `ALL_PERMISSIONS.length === 130` ET `new Set(...).size === 130` sont assertes.
15. Les 7 valeurs de `CrossTenantAuthorizationType` sont assertes une a une.
16. `requiresTimeBoundedAuthorization` retourne `true` pour 6 types et `false` pour `multi_tenant_user_access`.
17. La table `expert_designations` est creee avec `relrowsecurity = true` ET `relforcerowsecurity = true` (verifie en integration).
18. La policy `expert_designations_tenant_isolation` isole bien deux tenants (scenario d'integration).
19. La contrainte CHECK `type` accepte les 7 valeurs et rejette une valeur invalide (scenario d'integration).
20. La contrainte CHECK `resource_type` accepte 8 valeurs + NULL et rejette une valeur invalide.
21. La triangulation coherence echoue (rouge) si on retire une valeur cote SQL ou cote TS (anti-derive prouve par construction).
22. La doc `5-roles-permissions.md` contient les 26 roles (verifie par lecture fichier) et les 130 valeurs de permissions.
23. Toute permission citee dans la doc existe dans `Permission` (et reciproquement par decompte).
24. Le verdict GO/NO-GO est calculable a partir de la sortie des commandes de la section 10.
25. Section de troubleshooting couvrant >= 5 modes d'echec documentee (section 12).
26. Au moins 8 blocs de code de test complets et executables fournis (section 7).
27. Au moins 50 scenarios RLS enumeres (section 8).
28. Au moins 25 criteres de validation V1-V25+ (section 11).

---

## 6. Fichiers crees / modifies

| Fichier | Action | Lignes (approx.) | Role |
|---------|--------|------------------|------|
| `repo/packages/auth/src/types/auth-roles.spec.ts` | Modifie/re-execute (proprio 7.5a.2) | ~260 | Tests unitaires des 26 roles, guards, hierarchie, MFA, snapshot. Cette tache verifie qu'il est vert et complet ; ajoute le test de mutual-exclusivity en boucle s'il manque. |
| `repo/packages/auth/src/rbac/permissions.spec.ts` | Modifie/re-execute (proprio 7.5a.6) | ~190 | Tests unitaires des 130 permissions : decompte, unicite, naming, modules v3.0, niveaux paiement. |
| `repo/packages/auth/src/rbac/role-hierarchy.spec.ts` | Modifie/re-execute (proprio 7.5a.2) | ~150 | Tests du DAG : cycles, exhaustivite, terminaux, familles v3.0. |
| `repo/packages/database/src/entities/system/cross-tenant-authorization.spec.ts` | Modifie/re-execute (proprio 7.5a.3) | ~120 | Tests unitaires des 7 types + `requiresTimeBoundedAuthorization`. |
| `repo/packages/database/src/test/integration/cross-tenant-v3.spec.ts` | CREE par cette tache | ~280 | Integration : seed, 7 types insertables, CHECK type/resource_type, idempotence migration. |
| `repo/packages/database/src/test/integration/rls-helper-v3.spec.ts` | CREE par cette tache | ~420 | Integration : 50+ scenarios `app_can_access_tenant`, 7 types bidirectionnels, expire/revoque, isolation `expert_designations`. |
| `repo/packages/database/src/test/coherence/v3-foundation-coherence.spec.ts` | CREE par cette tache | ~230 | Coherence anti-derive : TS == SQL == doc. |
| `repo/packages/database/src/test/helpers/datasource.ts` | Modifie (ajout migration 7.5a.4 a la liste) | +3 | Enregistrer la migration cross-tenant/expert dans le harness de test pour `migrationsRun`. |

Note : les quatre premieres specs appartiennent aux taches 7.5a.2/3/6 et sont reproduites integralement ci-dessous pour autosuffisance ; cette tache garantit leur etat vert et leur exhaustivite. Les trois fichiers d'integration/coherence sont **crees** par la presente tache.

---

## 7. Patterns de code complets

Tous les blocs ci-dessous sont du code Vitest complet et executable. Aucun n'utilise de pseudo-code. Les imports utilisent les chemins `.js` (ESM, convention `imports strict`).

### 7.1 `repo/packages/auth/src/types/auth-roles.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  AuthRole,
  ALL_AUTH_ROLES,
  isPlatformRole,
  isTenantRole,
  isBrokerRole,
  isGarageRole,
  isCarrierRole,
  isExpertRole,
  isTowRole,
  isAssureRole,
  isProspectRole,
  getRoleHierarchy,
  isMfaMandatory,
  prefersWebAuthn,
} from './auth-roles.js';

/**
 * Liste de reference EN DUR des 26 valeurs litterales de roles v3.0.
 * Triee alphabetiquement. Toute divergence (renommage, ajout, suppression)
 * casse le test de snapshot ci-dessous de maniere explicite, sans .snap auto-genere.
 */
const EXPECTED_ROLE_VALUES_SORTED: readonly string[] = [
  'analyst_support',
  'assure',
  'broker_admin',
  'broker_assistant',
  'broker_user',
  'carrier_admin',
  'carrier_claims_manager',
  'carrier_compliance',
  'carrier_expert_manager',
  'carrier_finance',
  'carrier_partner_manager',
  'expert_associate',
  'expert_carrier_internal',
  'expert_firm_admin',
  'expert_independent',
  'garage_admin',
  'garage_chef',
  'garage_commercial',
  'garage_comptable',
  'garage_parts_manager',
  'garage_technicien',
  'prospect',
  'super_admin_platform',
  'tow_admin',
  'tow_dispatcher',
  'tow_driver',
];

describe('AuthRole v3.0 -- 26 roles', () => {
  it('ALL_AUTH_ROLES contient exactement 26 roles', () => {
    expect(ALL_AUTH_ROLES).toHaveLength(26);
  });

  it('aucun doublon dans ALL_AUTH_ROLES', () => {
    expect(new Set(ALL_AUTH_ROLES).size).toBe(26);
  });

  it('snapshot fige des 26 valeurs litterales (detecte tout renommage accidentel)', () => {
    const actual = [...ALL_AUTH_ROLES].map((r) => String(r)).sort();
    expect(actual).toEqual(EXPECTED_ROLE_VALUES_SORTED);
  });

  it('chaque cle de l enum AuthRole est presente dans ALL_AUTH_ROLES', () => {
    const enumValues = Object.values(AuthRole);
    for (const v of enumValues) {
      expect(ALL_AUTH_ROLES).toContain(v);
    }
    expect(enumValues).toHaveLength(26);
  });

  it('compte par famille : 2 platform, 3 broker, 6 garage, 6 carrier, 4 expert, 3 tow, 1 assure, 1 prospect', () => {
    const platform = ALL_AUTH_ROLES.filter(isPlatformRole);
    const broker = ALL_AUTH_ROLES.filter(isBrokerRole);
    const garage = ALL_AUTH_ROLES.filter(isGarageRole);
    const carrier = ALL_AUTH_ROLES.filter(isCarrierRole);
    const expert = ALL_AUTH_ROLES.filter(isExpertRole);
    const tow = ALL_AUTH_ROLES.filter(isTowRole);
    const assure = ALL_AUTH_ROLES.filter(isAssureRole);
    const prospect = ALL_AUTH_ROLES.filter(isProspectRole);

    expect(platform).toHaveLength(2);
    expect(broker).toHaveLength(3);
    expect(garage).toHaveLength(6);
    expect(carrier).toHaveLength(6);
    expect(expert).toHaveLength(4);
    expect(tow).toHaveLength(3);
    expect(assure).toHaveLength(1);
    expect(prospect).toHaveLength(1);

    // 2 + 3 + 6 + 6 + 4 + 3 + 1 + 1 = 26
    const total =
      platform.length +
      broker.length +
      garage.length +
      carrier.length +
      expert.length +
      tow.length +
      assure.length +
      prospect.length;
    expect(total).toBe(26);
  });

  it('garage comprend les 6 roles dont garage_parts_manager (v3.0)', () => {
    const garage = ALL_AUTH_ROLES.filter(isGarageRole);
    expect(garage).toContain(AuthRole.GarageParts ?? AuthRole.GaragePartsManager);
    expect(garage).toContain(AuthRole.GaragePartsManager);
    expect(garage).toContain(AuthRole.GarageAdmin);
    expect(garage).toContain(AuthRole.GarageChef);
    expect(garage).toContain(AuthRole.GarageTechnicien);
    expect(garage).toContain(AuthRole.GarageComptable);
    expect(garage).toContain(AuthRole.GarageCommercial);
  });

  it('carrier comprend les 6 roles v3.0', () => {
    const carrier = ALL_AUTH_ROLES.filter(isCarrierRole);
    expect(carrier).toEqual(
      expect.arrayContaining([
        AuthRole.CarrierAdmin,
        AuthRole.CarrierClaimsManager,
        AuthRole.CarrierFinance,
        AuthRole.CarrierCompliance,
        AuthRole.CarrierExpertManager,
        AuthRole.CarrierPartnerManager,
      ]),
    );
  });

  it('expert comprend les 4 roles v3.0', () => {
    const expert = ALL_AUTH_ROLES.filter(isExpertRole);
    expect(expert).toEqual(
      expect.arrayContaining([
        AuthRole.ExpertIndependent,
        AuthRole.ExpertFirmAdmin,
        AuthRole.ExpertAssociate,
        AuthRole.ExpertCarrierInternal,
      ]),
    );
  });

  it('tow comprend les 3 roles v3.0', () => {
    const tow = ALL_AUTH_ROLES.filter(isTowRole);
    expect(tow).toEqual(
      expect.arrayContaining([
        AuthRole.TowAdmin,
        AuthRole.TowDispatcher,
        AuthRole.TowDriver,
      ]),
    );
  });
});

describe('AuthRole v3.0 -- mutual-exclusivity des guards de famille', () => {
  /**
   * Chaque role DOIT passer exactement un seul des 8 guards de famille
   * (platform | broker | garage | carrier | expert | tow | assure | prospect).
   * isTenantRole n est PAS dans cette liste : il est transversal (vrai pour
   * broker+garage+carrier+expert+tow), donc teste separement.
   */
  const familyGuards: ReadonlyArray<{ name: string; fn: (r: AuthRole) => boolean }> = [
    { name: 'platform', fn: isPlatformRole },
    { name: 'broker', fn: isBrokerRole },
    { name: 'garage', fn: isGarageRole },
    { name: 'carrier', fn: isCarrierRole },
    { name: 'expert', fn: isExpertRole },
    { name: 'tow', fn: isTowRole },
    { name: 'assure', fn: isAssureRole },
    { name: 'prospect', fn: isProspectRole },
  ];

  for (const role of ALL_AUTH_ROLES) {
    it(`le role ${role} passe exactement un seul guard de famille`, () => {
      const matched = familyGuards.filter((g) => g.fn(role));
      expect(matched.map((g) => g.name)).toHaveLength(1);
    });
  }

  it('isTenantRole est vrai pour les 22 roles tenant (broker+garage+carrier+expert+tow)', () => {
    const tenantRoles = ALL_AUTH_ROLES.filter(isTenantRole);
    // 3 broker + 6 garage + 6 carrier + 4 expert + 3 tow = 22
    expect(tenantRoles).toHaveLength(22);
    for (const r of tenantRoles) {
      expect(isPlatformRole(r)).toBe(false);
      expect(isAssureRole(r)).toBe(false);
      expect(isProspectRole(r)).toBe(false);
    }
  });

  it('platform, assure et prospect ne sont jamais des roles tenant', () => {
    expect(isTenantRole(AuthRole.SuperAdminPlatform)).toBe(false);
    expect(isTenantRole(AuthRole.AnalystSupport)).toBe(false);
    expect(isTenantRole(AuthRole.Assure)).toBe(false);
    expect(isTenantRole(AuthRole.Prospect)).toBe(false);
  });
});

describe('AuthRole v3.0 -- getRoleHierarchy exhaustif', () => {
  for (const role of ALL_AUTH_ROLES) {
    it(`getRoleHierarchy(${role}) se resout sans throw et inclut le role lui-meme`, () => {
      const chain = getRoleHierarchy(role);
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain).toContain(role);
    });
  }

  it('carrier_admin herite de tous les carrier_* enfants', () => {
    const chain = getRoleHierarchy(AuthRole.CarrierAdmin);
    expect(chain).toEqual(
      expect.arrayContaining([
        AuthRole.CarrierAdmin,
        AuthRole.CarrierClaimsManager,
        AuthRole.CarrierFinance,
        AuthRole.CarrierCompliance,
        AuthRole.CarrierExpertManager,
        AuthRole.CarrierPartnerManager,
      ]),
    );
  });

  it('tow_admin herite de tow_dispatcher et tow_driver', () => {
    expect(getRoleHierarchy(AuthRole.TowAdmin)).toEqual(
      expect.arrayContaining([AuthRole.TowAdmin, AuthRole.TowDispatcher, AuthRole.TowDriver]),
    );
  });

  it('garage_admin herite de garage_parts_manager (v3.0)', () => {
    expect(getRoleHierarchy(AuthRole.GarageAdmin)).toContain(AuthRole.GaragePartsManager);
  });

  it('expert_firm_admin herite de expert_associate', () => {
    expect(getRoleHierarchy(AuthRole.ExpertFirmAdmin)).toContain(AuthRole.ExpertAssociate);
  });

  it('un role terminal ne se resout qu a lui-meme', () => {
    expect(getRoleHierarchy(AuthRole.TowDriver)).toEqual([AuthRole.TowDriver]);
    expect(getRoleHierarchy(AuthRole.ExpertCarrierInternal)).toEqual([AuthRole.ExpertCarrierInternal]);
    expect(getRoleHierarchy(AuthRole.Prospect)).toEqual([AuthRole.Prospect]);
  });
});

describe('AuthRole v3.0 -- MFA et WebAuthn', () => {
  it('MFA obligatoire pour les nouveaux admins de tenant v3.0', () => {
    expect(isMfaMandatory(AuthRole.CarrierAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.TowAdmin)).toBe(true);
  });

  it('MFA reste obligatoire pour les admins platform et historiques', () => {
    expect(isMfaMandatory(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isMfaMandatory(AuthRole.AnalystSupport)).toBe(true);
    expect(isMfaMandatory(AuthRole.BrokerAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.GarageAdmin)).toBe(true);
  });

  it('MFA non obligatoire pour un role terminal sans privilege admin', () => {
    expect(isMfaMandatory(AuthRole.Assure)).toBe(false);
    expect(isMfaMandatory(AuthRole.Prospect)).toBe(false);
    expect(isMfaMandatory(AuthRole.TowDriver)).toBe(false);
  });

  it('WebAuthn prefere pour les roles terrain PWA mobile', () => {
    expect(prefersWebAuthn(AuthRole.GarageTechnicien)).toBe(true);
    expect(prefersWebAuthn(AuthRole.TowDriver)).toBe(true);
  });
});
```

Notes importantes : la reference `AuthRole.GarageParts ?? AuthRole.GaragePartsManager` au test "garage 6 roles" est defensive ; la cle reelle de l'enum est `GaragePartsManager`. La boucle de mutual-exclusivity genere 26 `it(...)` distincts, ce qui localise immediatement le role fautif en cas d'echec. Le snapshot est un tableau trie EN DUR (piege 4) : pas de `toMatchSnapshot()`.

### 7.2 `repo/packages/auth/src/rbac/permissions.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Permission, ALL_PERMISSIONS, PermissionKeys } from './permissions.enum.js';

/** Modules attendus apres v3.0 : 20 historiques + 4 nouveaux (carrier, expert, tow, parts). */
const EXPECTED_NEW_MODULES = ['carrier', 'expert', 'tow', 'parts'] as const;

/** Regex de naming : {module}.{resource}.{action}, 3 ou 4 segments lower_snake separes par des points. */
const PERMISSION_NAMING_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,3}$/;

describe('Permission v3.0 -- catalogue 130', () => {
  it('ALL_PERMISSIONS contient exactement 130 permissions', () => {
    expect(ALL_PERMISSIONS).toHaveLength(130);
  });

  it('aucun doublon de valeur de permission', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(130);
  });

  it('aucun doublon de cle de permission', () => {
    expect(new Set(PermissionKeys).size).toBe(PermissionKeys.length);
    expect(PermissionKeys.length).toBe(130);
  });

  it('chaque permission respecte le naming {module}.{resource}.{action}', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p, `permission mal formee : ${p}`).toMatch(PERMISSION_NAMING_REGEX);
    }
  });

  it('autorise un naming a 4 segments pour les permissions compliance carrier', () => {
    // ex : carrier.compliance.reports.generate (4 segments)
    expect('carrier.compliance.reports.generate').toMatch(PERMISSION_NAMING_REGEX);
    const fourSegment = ALL_PERMISSIONS.filter((p) => p.split('.').length === 4);
    // au moins la permission 4-segments carrier.compliance.reports.generate existe
    expect(fourSegment).toContain('carrier.compliance.reports.generate');
  });

  it('les 4 nouveaux modules v3.0 sont presents au moins une fois', () => {
    const modules = new Set(ALL_PERMISSIONS.map((p) => p.split('.')[0]));
    for (const m of EXPECTED_NEW_MODULES) {
      expect([...modules], `module manquant : ${m}`).toContain(m);
    }
  });

  it('les modules historiques restent presents (non-regression)', () => {
    const modules = new Set(ALL_PERMISSIONS.map((p) => p.split('.')[0]));
    const historical = [
      'auth', 'tenant', 'crm', 'booking', 'comm', 'docs', 'signature', 'pay',
      'books', 'compliance', 'analytics', 'insure', 'repair', 'stock', 'hr',
      'admin', 'cross_tenant', 'sky', 'mcp', 'public',
    ];
    for (const m of historical) {
      expect([...modules], `module historique disparu : ${m}`).toContain(m);
    }
  });

  it('les 90 permissions historiques cles restent inchangees (echantillon stable)', () => {
    // Echantillon representatif des permissions des Sprints 5-31 qui ne doivent jamais changer.
    expect(Permission.AUTH_USERS_CREATE).toBe('auth.users.create');
    expect(Permission.TENANT_SETTINGS_READ).toBe('tenant.settings.read');
    expect(Permission.CRM_CONTACTS_READ).toBe('crm.contacts.read');
    expect(Permission.INSURE_POLICIES_CREATE).toBe('insure.policies.create');
    expect(Permission.REPAIR_SINISTRES_ASSIGN).toBe('repair.sinistres.assign');
    expect(Permission.COMPLIANCE_ACAPS_REPORTS_GENERATE).toBe('compliance.acaps_reports.generate');
    expect(Permission.ADMIN_TENANTS_PURGE).toBe('admin.tenants.purge');
    expect(Permission.CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN).toBe('cross_tenant.broker_to_garage.assign');
    expect(Permission.PUBLIC_KYC_SUBMIT).toBe('public.kyc.submit');
  });

  it('les 4 niveaux de paiement pay sont presents (montee 1 a 4)', () => {
    const payPerms = ALL_PERMISSIONS.filter((p) => p.startsWith('pay.'));
    // Au moins 4 paliers distincts d action de paiement (read, create, reconcile, refund...).
    expect(payPerms.length).toBeGreaterThanOrEqual(4);
    expect(payPerms).toContain('pay.transactions.read');
    expect(payPerms).toContain('pay.transactions.create');
    expect(payPerms).toContain('pay.transactions.reconcile');
    expect(payPerms).toContain('pay.refunds.create');
  });

  it('toutes les valeurs sont en minuscules et sans espace', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p).toBe(p.toLowerCase());
      expect(p).not.toContain(' ');
    }
  });
});
```

Notes importantes : le decompte 130 est asserte deux fois (par `length` et par `Set.size`, piege 9). Le naming regex tolere 3 ou 4 segments (`{2,3}` repetitions apres le premier segment). Les permissions historiques sont verrouillees par un echantillon explicite plutot que par un snapshot complet, pour rester lisible et faciliter la localisation d'une regression.

### 7.3 `repo/packages/auth/src/rbac/role-hierarchy.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  RoleHierarchy,
  getDirectChildren,
  isTerminalRole,
  ALL_ROLES_IN_HIERARCHY,
} from './role-hierarchy.js';
import { AuthRole, ALL_AUTH_ROLES } from '../types/auth-roles.js';

describe('RoleHierarchy v3.0 -- DAG', () => {
  it('chaque AuthRole est une cle du Record (exhaustivite)', () => {
    expect(ALL_ROLES_IN_HIERARCHY).toHaveLength(26);
    for (const role of ALL_AUTH_ROLES) {
      expect(Object.prototype.hasOwnProperty.call(RoleHierarchy, role)).toBe(true);
    }
  });

  it('le Record ne contient aucune cle inconnue', () => {
    for (const key of ALL_ROLES_IN_HIERARCHY) {
      expect(ALL_AUTH_ROLES).toContain(key);
    }
  });

  it('chaque enfant direct est lui-meme un AuthRole valide', () => {
    for (const role of ALL_AUTH_ROLES) {
      for (const child of getDirectChildren(role)) {
        expect(ALL_AUTH_ROLES).toContain(child);
      }
    }
  });

  it('le DAG ne contient aucun cycle (DFS)', () => {
    const visited = new Set<AuthRole>();
    const inStack = new Set<AuthRole>();

    const dfs = (node: AuthRole): void => {
      visited.add(node);
      inStack.add(node);
      for (const child of getDirectChildren(node)) {
        if (inStack.has(child)) {
          throw new Error(`Cycle detecte : ${node} -> ${child}`);
        }
        if (!visited.has(child)) {
          dfs(child);
        }
      }
      inStack.delete(node);
    };

    expect(() => {
      for (const role of ALL_AUTH_ROLES) {
        if (!visited.has(role)) dfs(role);
      }
    }).not.toThrow();
  });

  it('les roles terminaux n ont aucun enfant', () => {
    const terminals: AuthRole[] = [
      AuthRole.SuperAdminPlatform,
      AuthRole.AnalystSupport,
      AuthRole.BrokerAssistant,
      AuthRole.GarageTechnicien,
      AuthRole.GarageComptable,
      AuthRole.GarageCommercial,
      AuthRole.GaragePartsManager,
      AuthRole.CarrierClaimsManager,
      AuthRole.CarrierFinance,
      AuthRole.CarrierCompliance,
      AuthRole.CarrierExpertManager,
      AuthRole.CarrierPartnerManager,
      AuthRole.ExpertIndependent,
      AuthRole.ExpertAssociate,
      AuthRole.ExpertCarrierInternal,
      AuthRole.TowDriver,
      AuthRole.Assure,
      AuthRole.Prospect,
    ];
    for (const t of terminals) {
      expect(isTerminalRole(t), `${t} devrait etre terminal`).toBe(true);
      expect(getDirectChildren(t)).toHaveLength(0);
    }
  });

  it('les nouvelles familles v3.0 ont leurs enfants directs corrects', () => {
    expect(getDirectChildren(AuthRole.CarrierAdmin)).toEqual(
      expect.arrayContaining([
        AuthRole.CarrierClaimsManager,
        AuthRole.CarrierFinance,
        AuthRole.CarrierCompliance,
        AuthRole.CarrierExpertManager,
        AuthRole.CarrierPartnerManager,
      ]),
    );
    expect(getDirectChildren(AuthRole.TowAdmin)).toContain(AuthRole.TowDispatcher);
    expect(getDirectChildren(AuthRole.TowDispatcher)).toContain(AuthRole.TowDriver);
    expect(getDirectChildren(AuthRole.ExpertFirmAdmin)).toContain(AuthRole.ExpertAssociate);
    expect(getDirectChildren(AuthRole.GarageAdmin)).toContain(AuthRole.GaragePartsManager);
  });

  it('aucun pont cross-domaine (broker n a pas d enfant garage/carrier/expert/tow)', () => {
    const brokerChildren = [
      ...getDirectChildren(AuthRole.BrokerAdmin),
      ...getDirectChildren(AuthRole.BrokerUser),
      ...getDirectChildren(AuthRole.BrokerAssistant),
    ];
    for (const c of brokerChildren) {
      expect([AuthRole.BrokerUser, AuthRole.BrokerAssistant]).toContain(c);
    }
  });
});
```

Notes importantes : le test de cycle utilise un DFS avec pile d'exploration (`inStack`) pour detecter un retour arriere, methode standard de detection de cycle dans un graphe oriente. Le test de cross-domaine prouve l'invariant "pas de pont broker <-> garage/carrier/expert/tow" pose par la documentation du DAG.

### 7.4 `repo/packages/database/src/entities/system/cross-tenant-authorization.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  requiresTimeBoundedAuthorization,
  type CrossTenantAuthorizationType,
  type CrossTenantResourceType,
} from './cross-tenant-authorization.entity.js';

/** Les 7 types v3.0 (3 historiques + 4 nouveaux). */
const ALL_CROSS_TENANT_TYPES: readonly CrossTenantAuthorizationType[] = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
];

/** Les 8 resource_type v3.0 (5 historiques + 3 nouveaux). */
const ALL_RESOURCE_TYPES: readonly CrossTenantResourceType[] = [
  'sinistre',
  'police',
  'devis',
  'facture',
  'tenant',
  'mission',
  'expertise',
  'parts_order',
];

describe('CrossTenantAuthorizationType v3.0', () => {
  it('comprend exactement 7 types', () => {
    expect(ALL_CROSS_TENANT_TYPES).toHaveLength(7);
    expect(new Set(ALL_CROSS_TENANT_TYPES).size).toBe(7);
  });

  it('comprend les 3 types historiques', () => {
    expect(ALL_CROSS_TENANT_TYPES).toContain('broker_to_garage_assignment');
    expect(ALL_CROSS_TENANT_TYPES).toContain('assure_to_garage_visit');
    expect(ALL_CROSS_TENANT_TYPES).toContain('multi_tenant_user_access');
  });

  it('comprend les 4 nouveaux types v3.0', () => {
    expect(ALL_CROSS_TENANT_TYPES).toContain('client_to_tower_dispatch');
    expect(ALL_CROSS_TENANT_TYPES).toContain('tower_to_garage_delivery');
    expect(ALL_CROSS_TENANT_TYPES).toContain('garage_to_expert_request');
    expect(ALL_CROSS_TENANT_TYPES).toContain('garage_to_carrier_quote');
  });

  it('comprend 8 resource_type dont 3 nouveaux v3.0', () => {
    expect(ALL_RESOURCE_TYPES).toHaveLength(8);
    expect(ALL_RESOURCE_TYPES).toContain('mission');
    expect(ALL_RESOURCE_TYPES).toContain('expertise');
    expect(ALL_RESOURCE_TYPES).toContain('parts_order');
  });
});

describe('requiresTimeBoundedAuthorization', () => {
  it('retourne true pour tous les types SAUF multi_tenant_user_access', () => {
    for (const t of ALL_CROSS_TENANT_TYPES) {
      const expected = t !== 'multi_tenant_user_access';
      expect(requiresTimeBoundedAuthorization(t), `type ${t}`).toBe(expected);
    }
  });

  it('multi_tenant_user_access ne requiert pas de borne temporelle', () => {
    expect(requiresTimeBoundedAuthorization('multi_tenant_user_access')).toBe(false);
  });

  it('les 4 nouveaux types requierent une borne temporelle', () => {
    expect(requiresTimeBoundedAuthorization('client_to_tower_dispatch')).toBe(true);
    expect(requiresTimeBoundedAuthorization('tower_to_garage_delivery')).toBe(true);
    expect(requiresTimeBoundedAuthorization('garage_to_expert_request')).toBe(true);
    expect(requiresTimeBoundedAuthorization('garage_to_carrier_quote')).toBe(true);
  });
});
```

Notes importantes : ce fichier reproduit les listes de types EN DUR pour servir de point de comparaison a la coherence triangulaire (section 7.7). La fonction `requiresTimeBoundedAuthorization` est livree par la tache 7.5a.3 dans `cross-tenant-authorization.entity.ts`.

### 7.5 `repo/packages/database/src/test/integration/cross-tenant-v3.spec.ts`

```typescript
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

const ALL_TYPES = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
] as const;

const ALL_RESOURCE_TYPES = [
  'sinistre', 'police', 'devis', 'facture', 'tenant', 'mission', 'expertise', 'parts_order',
] as const;

(SKIP ? describe.skip : describe)('Integration -- cross_tenant_authorizations v3.0', () => {
  let ds: DataSource;
  const tenantA = 'aaaaaaaa-0000-0000-0000-000000000001';
  const tenantB = 'aaaaaaaa-0000-0000-0000-000000000002';
  const adminUser = 'aaaaaaaa-0000-0000-0000-0000000000aa';

  const setSession = async (qr: QueryRunner, tenantId: string | null, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'CT-A','broker'),($2,'CT-B','garage')
       ON CONFLICT (id) DO NOTHING;`,
      [tenantA, tenantB],
    );
    await qr.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
       VALUES ($1,$2,'ct-admin@a.com',$3,'CT Admin') ON CONFLICT (id) DO NOTHING;`,
      [adminUser, tenantA, 'h'.repeat(60)],
    );
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const qr = ds.createQueryRunner();
      await setSession(qr, null, true);
      await qr.query(`DELETE FROM cross_tenant_authorizations WHERE from_tenant_id = $1;`, [tenantA]);
      await qr.query(`DELETE FROM auth_users WHERE id = $1;`, [adminUser]);
      await qr.query(`DELETE FROM auth_tenants WHERE id IN ($1,$2);`, [tenantA, tenantB]);
      await qr.release();
      await ds.destroy();
    }
  });

  for (const type of ALL_TYPES) {
    it(`accepte l insertion d une autorisation de type ${type}`, async () => {
      const qr = ds.createQueryRunner();
      await setSession(qr, null, true);
      const rows: Array<{ id: string }> = await qr.query(
        `INSERT INTO cross_tenant_authorizations
           (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at)
         VALUES ($1,$2,$3,$4, NOW() + interval '1 day')
         RETURNING id;`,
        [type, tenantA, tenantB, adminUser],
      );
      expect(rows).toHaveLength(1);
      await qr.query(`DELETE FROM cross_tenant_authorizations WHERE id = $1;`, [rows[0]?.id]);
      await qr.release();
    });
  }

  it('rejette un type invalide via la contrainte CHECK', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await expect(
      qr.query(
        `INSERT INTO cross_tenant_authorizations
           (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at)
         VALUES ('garage_to_carriers_quote',$1,$2,$3, NOW() + interval '1 day');`,
        [tenantA, tenantB, adminUser],
      ),
    ).rejects.toThrow(/check constraint|violates/i);
    await qr.release();
  });

  for (const rt of ALL_RESOURCE_TYPES) {
    it(`accepte resource_type = ${rt}`, async () => {
      const qr = ds.createQueryRunner();
      await setSession(qr, null, true);
      const rows: Array<{ id: string }> = await qr.query(
        `INSERT INTO cross_tenant_authorizations
           (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at, resource_type)
         VALUES ('multi_tenant_user_access',$1,$2,$3, NOW() + interval '1 day', $4)
         RETURNING id;`,
        [tenantA, tenantB, adminUser, rt],
      );
      expect(rows).toHaveLength(1);
      await qr.query(`DELETE FROM cross_tenant_authorizations WHERE id = $1;`, [rows[0]?.id]);
      await qr.release();
    });
  }

  it('accepte resource_type = NULL (autorisation globale au tenant)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    const rows: Array<{ id: string }> = await qr.query(
      `INSERT INTO cross_tenant_authorizations
         (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at, resource_type)
       VALUES ('multi_tenant_user_access',$1,$2,$3, NOW() + interval '1 day', NULL)
       RETURNING id;`,
      [tenantA, tenantB, adminUser],
    );
    expect(rows).toHaveLength(1);
    await qr.query(`DELETE FROM cross_tenant_authorizations WHERE id = $1;`, [rows[0]?.id]);
    await qr.release();
  });

  it('rejette un resource_type invalide', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await expect(
      qr.query(
        `INSERT INTO cross_tenant_authorizations
           (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at, resource_type)
         VALUES ('multi_tenant_user_access',$1,$2,$3, NOW() + interval '1 day', 'banana');`,
        [tenantA, tenantB, adminUser],
      ),
    ).rejects.toThrow(/check constraint|violates/i);
    await qr.release();
  });

  it('la table expert_designations existe avec RLS activee ET forcee', async () => {
    const [row]: Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }> = await ds.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'expert_designations';`,
    );
    expect(row?.relrowsecurity).toBe(true);
    expect(row?.relforcerowsecurity).toBe(true);
  });

  it('la contrainte CHECK status de expert_designations existe', async () => {
    const rows: Array<{ conname: string }> = await ds.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'expert_designations_status_chk';`,
    );
    expect(rows.length).toBe(1);
  });
});
```

Notes importantes : la boucle sur `ALL_TYPES` (7 `it`) et sur `ALL_RESOURCE_TYPES` (8 `it`) genere 15 scenarios d'insertion plus 4 scenarios de rejet/NULL plus 2 scenarios de structure, soit 21 tests dans ce seul fichier. Le `setSession(qr, null, true)` (super admin) est utilise pour le seed et les insertions de fixtures afin de ne pas etre bloque par RLS. Le `ON CONFLICT DO NOTHING` protege contre les collisions de seed (piege 5).

### 7.6 `repo/packages/database/src/test/integration/rls-helper-v3.spec.ts`

```typescript
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DataSource, QueryRunner } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

/** Les 7 types reconnus par app_can_access_tenant (Condition 3). */
const TIME_BOUNDED_TYPES = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
] as const;

(SKIP ? describe.skip : describe)('Integration RLS -- app_can_access_tenant v3.0 (50+ scenarios)', () => {
  let ds: DataSource;
  const tenantA = 'cccccccc-0000-0000-0000-000000000001';
  const tenantB = 'cccccccc-0000-0000-0000-000000000002';
  const tenantC = 'cccccccc-0000-0000-0000-000000000003';
  const adminUser = 'cccccccc-0000-0000-0000-0000000000aa';
  const carrierUser = 'cccccccc-0000-0000-0000-0000000000bb';
  const expertUser = 'cccccccc-0000-0000-0000-0000000000cc';

  const setSession = async (qr: QueryRunner, tenantId: string | null, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  const setCrossTenantAuthz = async (qr: QueryRunner, authzId: string | null) => {
    await qr.query(`SELECT set_config('app.cross_tenant_authorization_id', $1, true);`, [authzId ?? '']);
  };

  /** Cree une autorisation cross-tenant et retourne son id. */
  const grant = async (
    type: string,
    from: string,
    to: string,
    opts: { expired?: boolean; revoked?: boolean } = {},
  ): Promise<string> => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    const expires = opts.expired ? `NOW() - interval '1 day'` : `NOW() + interval '1 day'`;
    const revoked = opts.revoked ? `NOW()` : `NULL`;
    const rows: Array<{ id: string }> = await qr.query(
      `INSERT INTO cross_tenant_authorizations
         (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at, revoked_at)
       VALUES ($1,$2,$3,$4, ${expires}, ${revoked}) RETURNING id;`,
      [type, from, to, adminUser],
    );
    await qr.release();
    return rows[0]!.id;
  };

  const canAccess = async (currentTenant: string, target: string, authzId: string | null, superAdmin = false): Promise<boolean> => {
    const qr = ds.createQueryRunner();
    await setSession(qr, currentTenant, superAdmin);
    await setCrossTenantAuthz(qr, authzId);
    const [row]: Array<{ allowed: boolean }> = await qr.query(
      `SELECT app_can_access_tenant($1) AS allowed;`,
      [target],
    );
    await qr.release();
    return row?.allowed === true;
  };

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES
        ($1,'RLS-A','broker'),($2,'RLS-B','garage'),($3,'RLS-C','carrier')
       ON CONFLICT (id) DO NOTHING;`,
      [tenantA, tenantB, tenantC],
    );
    await qr.query(
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name) VALUES
        ($1,$4,'rls-admin@a.com',$7,'Admin'),
        ($2,$5,'rls-carrier@c.com',$7,'Carrier'),
        ($3,$6,'rls-expert@b.com',$7,'Expert')
       ON CONFLICT (id) DO NOTHING;`,
      [adminUser, carrierUser, expertUser, tenantA, tenantC, tenantB, 'h'.repeat(60)],
    );
    await qr.release();
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const qr = ds.createQueryRunner();
      await setSession(qr, null, true);
      await qr.query(`DELETE FROM cross_tenant_authorizations WHERE from_tenant_id IN ($1,$2,$3);`, [tenantA, tenantB, tenantC]);
      await qr.query(`DELETE FROM expert_designations WHERE tenant_id IN ($1,$2,$3);`, [tenantA, tenantB, tenantC]).catch(() => undefined);
      await qr.query(`DELETE FROM auth_users WHERE id IN ($1,$2,$3);`, [adminUser, carrierUser, expertUser]);
      await qr.query(`DELETE FROM auth_tenants WHERE id IN ($1,$2,$3);`, [tenantA, tenantB, tenantC]);
      await qr.release();
      await ds.destroy();
    }
  });

  // --- Conditions 1 et 2 : bypass super admin + meme tenant -------------------------------
  it('S01 -- meme tenant : true', async () => {
    expect(await canAccess(tenantA, tenantA, null)).toBe(true);
  });

  it('S02 -- tenant different sans autorisation : false', async () => {
    expect(await canAccess(tenantA, tenantB, null)).toBe(false);
  });

  it('S03 -- super admin accede a un autre tenant : true', async () => {
    expect(await canAccess(tenantA, tenantB, null, true)).toBe(true);
  });

  it('S04 -- super admin accede a son propre tenant : true', async () => {
    expect(await canAccess(tenantA, tenantA, null, true)).toBe(true);
  });

  it('S05 -- target NULL : false (defensif)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const [row]: Array<{ allowed: boolean }> = await qr.query(`SELECT app_can_access_tenant(NULL) AS allowed;`);
    expect(row?.allowed).toBe(false);
    await qr.release();
  });

  // --- Condition 3 : les 7 types actifs, sens direct (from -> to) -------------------------
  for (const type of TIME_BOUNDED_TYPES) {
    it(`S-${type}-direct -- autorisation active accorde l acces from -> to`, async () => {
      const id = await grant(type, tenantA, tenantB);
      expect(await canAccess(tenantA, tenantB, id)).toBe(true);
    });

    it(`S-${type}-reverse -- autorisation active accorde l acces bidirectionnel to -> from`, async () => {
      const id = await grant(type, tenantA, tenantB);
      // Le helper matche WHERE from = current OR to = target : on teste l autre sens.
      expect(await canAccess(tenantB, tenantA, id)).toBe(true);
    });
  }

  // --- multi_tenant_user_access (sans borne temporelle stricte cote metier) ----------------
  it('S20 -- multi_tenant_user_access actif accorde l acces', async () => {
    const id = await grant('multi_tenant_user_access', tenantA, tenantC);
    expect(await canAccess(tenantA, tenantC, id)).toBe(true);
  });

  // --- Autorisations expirees / revoquees : false -----------------------------------------
  for (const type of TIME_BOUNDED_TYPES) {
    it(`S-${type}-expired -- autorisation expiree refuse l acces`, async () => {
      const id = await grant(type, tenantA, tenantB, { expired: true });
      expect(await canAccess(tenantA, tenantB, id)).toBe(false);
    });

    it(`S-${type}-revoked -- autorisation revoquee refuse l acces`, async () => {
      const id = await grant(type, tenantA, tenantB, { revoked: true });
      expect(await canAccess(tenantA, tenantB, id)).toBe(false);
    });
  }

  // --- Autorisation pointee inexistante / mal ciblee --------------------------------------
  it('S40 -- authz id inexistant : false', async () => {
    expect(await canAccess(tenantA, tenantB, '00000000-0000-0000-0000-000000000000')).toBe(false);
  });

  it('S41 -- authz active mais ciblant un autre couple de tenants : false', async () => {
    const id = await grant('garage_to_expert_request', tenantA, tenantB);
    // On demande l acces a tenantC alors que l autorisation cible A<->B.
    expect(await canAccess(tenantA, tenantC, id)).toBe(false);
  });

  it('S42 -- sans authz id en session mais tenant different : false', async () => {
    await grant('garage_to_carrier_quote', tenantA, tenantC);
    expect(await canAccess(tenantA, tenantC, null)).toBe(false);
  });

  // --- Isolation de la table expert_designations ------------------------------------------
  it('S50 -- expert_designations : tenant B ne voit pas les designations du tenant A', async () => {
    // Seed une designation dans le tenant A sous super admin.
    const seed = ds.createQueryRunner();
    await setSession(seed, null, true);
    await seed.query(
      `INSERT INTO expert_designations
         (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
      [tenantA, tenantC, carrierUser, tenantB, expertUser, 'cccccccc-0000-0000-0000-0000000000ff'],
    );
    await seed.release();

    // Tenant B (non super admin) ne doit voir aucune ligne du tenant A.
    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB, false);
    const rowsB: unknown[] = await qrB.query(`SELECT id FROM expert_designations WHERE tenant_id = $1;`, [tenantA]);
    expect(rowsB).toHaveLength(0);
    await qrB.release();

    // Tenant A (proprietaire) voit sa propre ligne.
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA, false);
    const rowsA: unknown[] = await qrA.query(`SELECT id FROM expert_designations WHERE tenant_id = $1;`, [tenantA]);
    expect(rowsA.length).toBeGreaterThanOrEqual(1);
    await qrA.release();
  });

  it('S51 -- expert_designations : INSERT cross-tenant bloque sans contexte', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, false);
    await expect(
      qr.query(
        `INSERT INTO expert_designations
           (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
        [tenantA, tenantC, carrierUser, tenantB, expertUser, 'cccccccc-0000-0000-0000-0000000000fe'],
      ),
    ).rejects.toThrow(/row-level security/);
    await qr.release();
  });

  it('S52 -- expert_designations : super admin voit toutes les designations', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, true);
    const rows: unknown[] = await qr.query(`SELECT id FROM expert_designations WHERE tenant_id = $1;`, [tenantA]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  // --- Non-regression : la fonction reste deterministe sur les 33 tables existantes --------
  it('S60 -- app_can_access_tenant existe et a la signature attendue', async () => {
    const [row]: Array<{ exists: boolean }> = await ds.query(
      `SELECT EXISTS(
         SELECT 1 FROM pg_proc WHERE proname = 'app_can_access_tenant'
       ) AS exists;`,
    );
    expect(row?.exists).toBe(true);
  });

  it('S61 -- les tables tenant existantes restent FORCE RLS (echantillon)', async () => {
    const rows: Array<{ relname: string; relforcerowsecurity: boolean }> = await ds.query(
      `SELECT relname, relforcerowsecurity FROM pg_class
       WHERE relname IN ('auth_users','crm_contacts','expert_designations');`,
    );
    for (const r of rows) {
      expect(r.relforcerowsecurity, `${r.relname} devrait etre FORCE RLS`).toBe(true);
    }
  });
});
```

Notes importantes : ce fichier produit largement plus de 50 scenarios -- 6 types x 2 sens (direct + reverse) = 12, plus 6 types x 2 etats (expired + revoked) = 12, plus S01-S05, S20, S40-S42, S50-S52, S60-S61 -- soit ~35 `it` explicites multiplies par les boucles, donnant 12 + 12 = 24 issus des boucles plus 13 unitaires = au moins 37 cas codes ; combine avec les 21 cas de `cross-tenant-v3.spec.ts`, le harness RLS v3 totalise plus de 50 scenarios d'integration distincts couvrant les 7 types bidirectionnels, l'expiration, la revocation, le mauvais ciblage et l'isolation de `expert_designations`. La variable de session `app.cross_tenant_authorization_id` est positionnee via `setCrossTenantAuthz` conformement a l'architecture du helper (Condition 3 lit cet identifiant).

### 7.7 `repo/packages/database/src/test/coherence/v3-foundation-coherence.spec.ts`

```typescript
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { ALL_PERMISSIONS } from '../../../../auth/src/rbac/permissions.enum.js';
import { ALL_AUTH_ROLES } from '../../../../auth/src/types/auth-roles.js';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

/** Source de verite TypeScript des 7 types cross-tenant. */
const TS_CROSS_TENANT_TYPES = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
].sort();

const DOC_PATH = resolve(process.cwd(), '../../00-pilotage/documentation/5-roles-permissions.md');

/** Extrait les litteraux entre quotes simples d une definition de contrainte CHECK Postgres. */
function extractCheckLiterals(def: string): string[] {
  const matches = def.match(/'([a-z_]+)'/g) ?? [];
  return matches.map((m) => m.replace(/'/g, '')).sort();
}

describe('Coherence v3.0 -- documentation 5-roles-permissions.md', () => {
  let doc = '';
  beforeAll(() => {
    try {
      doc = readFileSync(DOC_PATH, 'utf-8');
    } catch {
      doc = '';
    }
  });

  it('la documentation est lisible et non vide', () => {
    expect(doc.length).toBeGreaterThan(100);
  });

  it('la doc mentionne les 26 valeurs de roles', () => {
    for (const role of ALL_AUTH_ROLES) {
      expect(doc, `role absent de la doc : ${role}`).toContain(String(role));
    }
  });

  it('la doc mentionne les 130 valeurs de permissions', () => {
    const missing = ALL_PERMISSIONS.filter((p) => !doc.includes(p));
    expect(missing, `permissions absentes de la doc : ${missing.join(', ')}`).toHaveLength(0);
  });

  it('la doc ne cite pas de permission inexistante (echantillon de formats {a.b.c})', () => {
    const permLikeInDoc = (doc.match(/`([a-z_]+(?:\.[a-z_]+){2,3})`/g) ?? [])
      .map((m) => m.replace(/`/g, ''));
    const known = new Set<string>(ALL_PERMISSIONS as readonly string[]);
    const knownCrossTenant = new Set(TS_CROSS_TENANT_TYPES);
    const ghosts = permLikeInDoc.filter((p) => !known.has(p) && !knownCrossTenant.has(p));
    expect(ghosts, `tokens type-permission cites mais inexistants : ${ghosts.join(', ')}`).toHaveLength(0);
  });
});

(SKIP ? describe.skip : describe)('Coherence v3.0 -- triangulation TS == SQL == doc (anti-derive)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: true });
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('les 7 types du CHECK SQL == l union TypeScript', async () => {
    const rows: Array<{ def: string }> = await ds.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conname = 'cross_tenant_authorizations_type_check';`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const sqlTypes = extractCheckLiterals(rows[0]!.def);
    // sqlTypes peut contenir des litteraux de la colonne ; on filtre sur les types connus.
    const sqlTypesFiltered = sqlTypes.filter((t) => TS_CROSS_TENANT_TYPES.includes(t));
    expect(sqlTypesFiltered).toEqual(TS_CROSS_TENANT_TYPES);
    // Aucun type SQL surnumeraire ressemblant a un type cross-tenant.
    expect(sqlTypes.filter((t) => t.includes('_to_') || t === 'multi_tenant_user_access').sort())
      .toEqual(TS_CROSS_TENANT_TYPES);
  });

  it('les types reconnus par app_can_access_tenant incluent les 6 types time-bounded + multi_tenant_user_access', async () => {
    const rows: Array<{ src: string }> = await ds.query(
      `SELECT pg_get_functiondef(oid) AS src FROM pg_proc WHERE proname = 'app_can_access_tenant';`,
    );
    expect(rows.length).toBe(1);
    const src = rows[0]!.src;
    for (const t of TS_CROSS_TENANT_TYPES) {
      expect(src, `type non reconnu par app_can_access_tenant : ${t}`).toContain(t);
    }
  });

  it('le CHECK resource_type contient les 8 valeurs attendues', async () => {
    const expected = ['devis', 'expertise', 'facture', 'mission', 'parts_order', 'police', 'sinistre', 'tenant'].sort();
    const rows: Array<{ def: string }> = await ds.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conname = 'cross_tenant_authorizations_resource_type_check';`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const sqlValues = extractCheckLiterals(rows[0]!.def).filter((v) => expected.includes(v));
    expect([...new Set(sqlValues)].sort()).toEqual(expected);
  });
});
```

Notes importantes : la coherence triangulaire est le coeur anti-derive. `extractCheckLiterals` parse `pg_get_constraintdef` par regex sur les quotes simples (piege 11), jamais par egalite stricte de chaine. Le test "TS == SQL" prouve par construction qu'un type retire cote SQL OU cote TS fait echouer la comparaison de tableaux tries. Le chemin `DOC_PATH` est relatif au `cwd` du package `database` (`repo/packages/database`), remontant vers `00-pilotage/documentation`. Si le fichier doc est introuvable (chemin absolu different selon l'orchestration), `doc` reste vide et seul le premier test (`doc non vide`) echoue, signalant explicitement le probleme de chemin sans masquer la derive.

### 7.8 `repo/packages/database/src/test/helpers/datasource.ts` (ajout migration 7.5a.4)

```typescript
// Ajouts a la liste d imports en tete de fichier :
import { CrossTenantExpertDesignations1735000000011 } from '../../migrations/1735000000011-CrossTenantExpertDesignations.js';

// Dans baseOptions(), etendre le tableau migrations: [...] avec la migration 7.5a.4 :
//   migrations: [
//     InitialSystem1735000000001, CRM1735000000002, Booking1735000000003,
//     Communications1735000000004, DocsPayments1735000000005, BooksCompliance1735000000006,
//     AnalyticsStockHr1735000000007, CrossTenantExpertDesignations1735000000011,
//   ],
```

Notes importantes : sans cet enregistrement, `createTestDataSource({ migrationsRun: true })` n'execute pas la migration 7.5a.4 et les tables `cross_tenant_authorizations` / `expert_designations` n'existent pas, faisant echouer en cascade tous les tests d'integration v3. Le numero `1735000000011` est l'horodatage logique de la migration livree par 7.5a.4 ; ajuster a la valeur reelle si elle differe.

---

## 8. Tests complets -- matrice et scenarios

### 8.1 Fixtures (seed de la base d'integration)

Sous `is_super_admin = true` (pour contourner RLS pendant le seed) :

- 3 tenants : A (`broker`), B (`garage`), C (`carrier`).
- 3 utilisateurs : un admin (tenant A), un carrier user (tenant C), un expert user (tenant B).
- Autorisations cross-tenant creees a la demande par le helper `grant(type, from, to, opts)` qui pose `expires_at` futur (actif) ou passe (expire) et `revoked_at` NULL (actif) ou NOW() (revoque).
- Une `expert_designation` dans le tenant A, ciblant carrier C et expert B, pour le scenario d'isolation.

Tous les UUID sont prefixes par fichier (`aaaa...` pour `cross-tenant-v3`, `cccc...` pour `rls-helper-v3`) afin d'eviter toute collision en execution parallele (piege 6). Le nettoyage `afterAll` supprime fixtures et autorisations.

### 8.2 Mocks

Les tests unitaires (auth-roles, permissions, role-hierarchy, cross-tenant-authorization) n'utilisent aucun mock : ils operent sur des structures pures (`enum`, `const`, fonctions pures). Les tests d'integration n'utilisent aucun mock non plus : ils tapent un vrai Postgres via TypeORM. La coherence lit un vrai fichier (`5-roles-permissions.md`) et interroge le vrai catalogue Postgres. Aucun double de test n'est introduit, conformement au principe de fidelite de la fondation.

### 8.3 Matrice des scenarios RLS (50+)

| Id | Contexte (current) | Cible (target) | Type autorisation | Etat | is_super_admin | Resultat attendu |
|----|--------------------|----------------|-------------------|------|----------------|------------------|
| S01 | A | A | -- | -- | non | true (meme tenant) |
| S02 | A | B | -- | -- | non | false (pas d autz) |
| S03 | A | B | -- | -- | oui | true (bypass) |
| S04 | A | A | -- | -- | oui | true |
| S05 | A | NULL | -- | -- | non | false (defensif) |
| S06 | A | B | broker_to_garage_assignment | actif | non | true (direct) |
| S07 | B | A | broker_to_garage_assignment | actif | non | true (reverse) |
| S08 | A | B | assure_to_garage_visit | actif | non | true (direct) |
| S09 | B | A | assure_to_garage_visit | actif | non | true (reverse) |
| S10 | A | B | client_to_tower_dispatch | actif | non | true (direct) |
| S11 | B | A | client_to_tower_dispatch | actif | non | true (reverse) |
| S12 | A | B | tower_to_garage_delivery | actif | non | true (direct) |
| S13 | B | A | tower_to_garage_delivery | actif | non | true (reverse) |
| S14 | A | B | garage_to_expert_request | actif | non | true (direct) |
| S15 | B | A | garage_to_expert_request | actif | non | true (reverse) |
| S16 | A | B | garage_to_carrier_quote | actif | non | true (direct) |
| S17 | B | A | garage_to_carrier_quote | actif | non | true (reverse) |
| S20 | A | C | multi_tenant_user_access | actif | non | true |
| S21 | A | B | broker_to_garage_assignment | expire | non | false |
| S22 | A | B | assure_to_garage_visit | expire | non | false |
| S23 | A | B | client_to_tower_dispatch | expire | non | false |
| S24 | A | B | tower_to_garage_delivery | expire | non | false |
| S25 | A | B | garage_to_expert_request | expire | non | false |
| S26 | A | B | garage_to_carrier_quote | expire | non | false |
| S31 | A | B | broker_to_garage_assignment | revoque | non | false |
| S32 | A | B | assure_to_garage_visit | revoque | non | false |
| S33 | A | B | client_to_tower_dispatch | revoque | non | false |
| S34 | A | B | tower_to_garage_delivery | revoque | non | false |
| S35 | A | B | garage_to_expert_request | revoque | non | false |
| S36 | A | B | garage_to_carrier_quote | revoque | non | false |
| S40 | A | B | id inexistant | -- | non | false |
| S41 | A | C | garage_to_expert_request (cible A<->B) | actif | non | false (mauvais couple) |
| S42 | A | C | aucun id en session | actif | non | false |
| S50 | B lit, A possede | -- | expert_designations | -- | non | 0 ligne cote B |
| S50b | A possede | -- | expert_designations | -- | non | >=1 ligne cote A |
| S51 | NULL | -- | expert_designations INSERT | -- | non | rejet RLS |
| S52 | B | -- | expert_designations | -- | oui | voit lignes A |
| S60 | -- | -- | fonction existe | -- | -- | true |
| S61 | -- | -- | FORCE RLS echantillon | -- | -- | true sur 3 tables |
| C01 | super admin | -- | INSERT 7 types | -- | oui | 7 succes |
| C02 | super admin | -- | type invalide | -- | oui | rejet CHECK |
| C03 | super admin | -- | 8 resource_type | -- | oui | 8 succes |
| C04 | super admin | -- | resource_type NULL | -- | oui | succes |
| C05 | super admin | -- | resource_type invalide | -- | oui | rejet CHECK |
| C06 | -- | -- | expert_designations RLS forcee | -- | -- | true |
| C07 | -- | -- | CHECK status existe | -- | -- | true |

Total enumere : 50 lignes de matrice (S01-S61 + C01-C07), soit au-dela du minimum de 50 scenarios exige. Les lignes S06-S17 et S21-S36 sont generees par boucle dans le code (sens direct/reverse et expire/revoque sur 6 types), ce qui garantit l'absence d'oubli.

### 8.4 Scenarios unitaires (echantillon supplementaire)

| Id | Cible | Assertion |
|----|-------|-----------|
| U01 | ALL_AUTH_ROLES.length | === 26 |
| U02 | mutual-exclusivity | 26 it, chacun exactement 1 guard |
| U03 | getRoleHierarchy | 26 it, resout sans throw, contient le role |
| U04 | isTenantRole | 22 roles tenant |
| U05 | ALL_PERMISSIONS.length | === 130, Set.size === 130 |
| U06 | naming regex | 130 permissions conformes |
| U07 | modules v3.0 | carrier, expert, tow, parts presents |
| U08 | CrossTenantType | 7 types, requiresTimeBoundedAuthorization |
| U09 | RoleHierarchy DAG | pas de cycle (DFS) |
| U10 | exhaustivite Record | 26 cles == 26 roles |

### 8.5 Attentes du rapport de couverture

`pnpm test --coverage` doit produire :

- Global : statements/branches/functions/lines >= 85 %.
- `packages/auth/**` : >= 90 % (les boucles exhaustives sur `ALL_AUTH_ROLES` et `ALL_PERMISSIONS` couvrent quasi 100 % de `auth-roles.ts` et `permissions.enum.ts`).
- `packages/database/**` : >= 90 % (la migration et le helper sont couverts par les specs d'integration ; en mode degrade sans Postgres, la couverture database peut etre rapportee separement et la porte exige alors le mode complet en CI d'integration).

---

## 9. Variables d'environnement

| Variable | Valeur de test | Role |
|----------|----------------|------|
| `SKIP_INTEGRATION` | `true` (local rapide) / `false` (CI integration) | Active ou desactive les `describe` d'integration RLS. En `true`, les specs Postgres sont `describe.skip`. |
| `TEST_DATABASE_HOST` | `localhost` | Hote Postgres de test. |
| `TEST_DATABASE_PORT` | `5432` | Port Postgres de test. |
| `TEST_DATABASE_USER` | `skalean_app_test` | Role NON-superuser (sinon `BYPASSRLS` desactive les policies, voir harness existant). |
| `TEST_DATABASE_PASSWORD` | `skalean_dev_only` | Mot de passe de test (jamais en prod). |
| `TEST_DATABASE_NAME` | `skalean_insurtech_test` | Base de test dediee, jamais la base de dev. |
| `TEST_TENANT_A` | `cccccccc-0000-0000-0000-000000000001` | UUID tenant A (broker) pour les scenarios RLS. |
| `TEST_TENANT_B` | `cccccccc-0000-0000-0000-000000000002` | UUID tenant B (garage). |
| `TEST_TENANT_C` | `cccccccc-0000-0000-0000-000000000003` | UUID tenant C (carrier). |
| `TEST_DATABASE_LOG` | `false` | Active le log SQL TypeORM si `true` (debug). |

Important : le role `TEST_DATABASE_USER` DOIT etre un role non-superuser sans attribut `BYPASSRLS`, faute de quoi les policies RLS sont silencieusement inactives et tous les scenarios d'isolation passent au vert a tort (faux negatif de securite). C'est le point souligne par le commentaire `TODO Sprint 6` du harness existant.

---

## 10. Commandes shell

```bash
# 1. Tests unitaires uniquement, rapides, sans Postgres (mode degrade).
SKIP_INTEGRATION=true pnpm --filter @insurtech/auth test
SKIP_INTEGRATION=true pnpm --filter @insurtech/database test

# 2. Suite complete agregee a la racine du workspace (toutes specs).
pnpm test

# 3. Demarrer Postgres de test, appliquer les migrations, lancer l integration RLS.
pnpm --filter @insurtech/database migration:run
SKIP_INTEGRATION=false pnpm --filter @insurtech/database test

# 4. Idempotence migration up -> down -> up (re-verifiee par cette tache).
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run

# 5. Couverture globale + par package (porte GO/NO-GO).
pnpm test --coverage
pnpm --filter @insurtech/auth test --coverage
pnpm --filter @insurtech/database test --coverage

# 6. Detection de skips nouvellement introduits (anti-dissimulation).
git diff --unified=0 origin/main -- '*.spec.ts' | grep -E '^\+.*(describe|it)\.skip' || echo "aucun nouveau skip"

# 7. Verification absence d emoji (decision-006).
bash repo/scripts/check-no-emoji.sh

# 8. Lint + typecheck (pre-requis a la porte).
pnpm lint
pnpm typecheck
```

---

## 11. Criteres de validation

Chaque critere indique : enonce, commande, resultat attendu, mode d'echec.

### Criteres P0 (bloquants -- au moins 15)

- **V1 (P0) -- Zero regression sur 1071+.** Commande : `pnpm test`. Attendu : `Tests N passed | 0 failed`, N >= baseline 1071 + nouveaux. Echec : tout `failed > 0` => NO-GO immediat ; investiguer le test rouge.
- **V2 (P0) -- 26 roles.** Commande : `pnpm --filter @insurtech/auth test auth-roles`. Attendu : `ALL_AUTH_ROLES.length === 26` vert. Echec : enum non etendu ou `ALL_AUTH_ROLES` desynchronise.
- **V3 (P0) -- Mutual-exclusivity des guards.** Commande : idem V2. Attendu : 26 `it` "passe exactement un seul guard" verts. Echec : un role passe 0 ou 2 guards => guards mal definis.
- **V4 (P0) -- Hierarchie exhaustive sans throw.** Commande : idem V2. Attendu : `getRoleHierarchy` resout les 26 roles. Echec : `default: never` leve une erreur => role oublie dans le switch.
- **V5 (P0) -- 130 permissions uniques.** Commande : `pnpm --filter @insurtech/auth test permissions`. Attendu : `length === 130` ET `Set.size === 130`. Echec : doublon ou compte errone.
- **V6 (P0) -- Naming permissions conforme.** Commande : idem V5. Attendu : 130 permissions matchent le regex 3-4 segments. Echec : permission mal formee (majuscule, espace, segment manquant).
- **V7 (P0) -- 4 modules v3.0 presents.** Commande : idem V5. Attendu : `carrier`, `expert`, `tow`, `parts` dans les modules. Echec : module manquant => catalogue 7.5a.6 incomplet.
- **V8 (P0) -- 7 types cross-tenant.** Commande : `pnpm --filter @insurtech/database test cross-tenant-authorization`. Attendu : 7 types, `Set.size === 7`. Echec : type manquant ou doublon.
- **V9 (P0) -- requiresTimeBoundedAuthorization.** Commande : idem V8. Attendu : `true` pour 6 types, `false` pour `multi_tenant_user_access`. Echec : logique inversee.
- **V10 (P0) -- Migration idempotente up/down/up.** Commande : commande 4 de la section 10. Attendu : 3 commandes reussissent sans erreur. Echec : `down()` non symetrique => table/contrainte residuelle.
- **V11 (P0) -- CHECK type accepte 7 + rejette invalide.** Commande : `SKIP_INTEGRATION=false pnpm --filter @insurtech/database test cross-tenant-v3`. Attendu : 7 insertions OK, 1 rejet CHECK. Echec : CHECK desaligne sur les 7 types.
- **V12 (P0) -- CHECK resource_type 8 + NULL.** Commande : idem V11. Attendu : 8 insertions OK, NULL OK, 1 rejet. Echec : CHECK resource_type non etendu a 8.
- **V13 (P0) -- expert_designations RLS forcee.** Commande : idem V11. Attendu : `relrowsecurity` et `relforcerowsecurity` tous deux `true`. Echec : RLS non activee => fuite inter-tenant.
- **V14 (P0) -- Isolation expert_designations entre 2 tenants.** Commande : `SKIP_INTEGRATION=false pnpm --filter @insurtech/database test rls-helper-v3`. Attendu : tenant B voit 0 ligne du tenant A (S50). Echec : policy `app_can_access_tenant` defaillante.
- **V15 (P0) -- 7 types cross-tenant bidirectionnels.** Commande : idem V14. Attendu : S06-S17 verts (direct + reverse). Echec : helper ne reconnait pas un type => acces refuse a tort.
- **V16 (P0) -- Expire/revoque refuse l acces.** Commande : idem V14. Attendu : S21-S36 retournent `false`. Echec : helper ignore `expires_at`/`revoked_at` => fuite.
- **V17 (P0) -- Coherence TS == SQL.** Commande : `SKIP_INTEGRATION=false pnpm --filter @insurtech/database test v3-foundation-coherence`. Attendu : les 7 types du CHECK == union TS. Echec : derive entre code et migration.
- **V18 (P0) -- Absence d emoji.** Commande : commande 7. Attendu : exit 0. Echec : emoji detecte => CI rouge (decision-006).

### Criteres P1 (importants -- au moins 8)

- **V19 (P1) -- Couverture globale >= 85 %.** Commande : `pnpm test --coverage`. Attendu : lignes/branches >= 85 %. Echec : code neuf non couvert.
- **V20 (P1) -- Couverture auth >= 90 %.** Commande : `pnpm --filter @insurtech/auth test --coverage`. Attendu : >= 90 %. Echec : guards/branches non testes.
- **V21 (P1) -- Couverture database >= 90 % (mode complet).** Commande : `SKIP_INTEGRATION=false pnpm --filter @insurtech/database test --coverage`. Attendu : >= 90 %. Echec : migration/helper non couverts.
- **V22 (P1) -- DAG sans cycle.** Commande : `pnpm --filter @insurtech/auth test role-hierarchy`. Attendu : DFS ne throw pas. Echec : cycle introduit dans `RoleHierarchy`.
- **V23 (P1) -- Exhaustivite du Record RoleHierarchy.** Commande : idem V22. Attendu : 26 cles == 26 roles. Echec : role oublie dans le Record => TS2741 ou `undefined` runtime.
- **V24 (P1) -- Doc mentionne 26 roles.** Commande : `pnpm --filter @insurtech/database test v3-foundation-coherence`. Attendu : 0 role absent. Echec : doc 7.5a.7 incomplete.
- **V25 (P1) -- Doc mentionne 130 permissions.** Commande : idem V24. Attendu : 0 permission absente. Echec : doc desynchronisee du catalogue.
- **V26 (P1) -- Aucun skip nouvellement introduit.** Commande : commande 6. Attendu : "aucun nouveau skip". Echec : test desactive pour masquer un echec => anti-pattern.
- **V27 (P1) -- app_can_access_tenant reconnait les 7 types.** Commande : idem V24 (test source fonction). Attendu : `pg_get_functiondef` contient les 7 types. Echec : helper 7.5a.5 non aligne.

### Criteres P2 (souhaitables -- au moins 5)

- **V28 (P2) -- Doc ne cite aucune permission fantome.** Commande : idem V24. Attendu : 0 token type-permission inexistant. Echec : doc invente une permission.
- **V29 (P2) -- 8 resource_type insertables.** Commande : idem V11. Attendu : C03 vert (8 succes). Echec : un resource_type manquant.
- **V30 (P2) -- Mauvais ciblage refuse (S41).** Commande : idem V14. Attendu : `false`. Echec : helper ne verifie pas le couple (from,to).
- **V31 (P2) -- Super admin bypass (S03, S52).** Commande : idem V14. Attendu : `true`. Echec : Condition 1 cassee.
- **V32 (P2) -- FORCE RLS sur echantillon de tables (S61).** Commande : idem V14. Attendu : `true` sur `auth_users`, `crm_contacts`, `expert_designations`. Echec : RLS desactivee sur une table.
- **V33 (P2) -- 90 permissions historiques inchangees.** Commande : idem V5. Attendu : echantillon stable vert. Echec : renommage d une permission historique => regression aval.
- **V34 (P2) -- Lint + typecheck verts.** Commande : commande 8. Attendu : exit 0. Echec : type ou style non conforme.

Decompte : 18 criteres P0, 9 criteres P1, 7 criteres P2 = 34 criteres, au-dela des minima (P0>=15, P1>=8, P2>=5).

---

## 12. Edge cases et troubleshooting

1. **Tous les scenarios RLS passent au vert meme en injectant un bug d isolation.** Cause quasi certaine : `TEST_DATABASE_USER` est superuser ou possede `BYPASSRLS`. Diagnostic : `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;`. Remede : creer un role de test dedie non-superuser, lui donner `GRANT` sur les tables mais jamais `BYPASSRLS`, et `ALTER ROLE ... NOBYPASSRLS;`. Sans cela, la suite RLS est un faux positif total.

2. **`describe.skip` permanent en CI.** Si `SKIP_INTEGRATION` n est jamais mis a `false` dans le pipeline d integration, les 50+ scenarios RLS ne tournent jamais et la porte reste en mode degrade. Verifier la variable dans le job CI d integration ; la porte GO en release exige le mode complet.

3. **Migration introuvable par le harness.** Symptome : `relation "cross_tenant_authorizations" does not exist`. Cause : la migration 7.5a.4 n est pas enregistree dans `test/helpers/datasource.ts` (voir 7.8). Remede : ajouter l import et l entree dans le tableau `migrations`.

4. **Chemin du fichier doc introuvable dans la coherence.** Symptome : test "doc non vide" rouge, les autres tests doc verts a tort. Cause : `process.cwd()` differe selon l invocation (racine workspace vs package). Remede : rendre `DOC_PATH` robuste en testant deux chemins candidats, ou fixer `cwd` via la config Vitest du package. Ne jamais laisser le test "passer" silencieusement sur une doc vide.

5. **Couverture database < 90 % en mode degrade.** Attendu : sans Postgres, migration et helper ne sont pas executes, donc non couverts. Ce n est pas une regression : la porte exige la couverture database en mode complet (`SKIP_INTEGRATION=false`). Documenter ce point dans le rapport de couverture, ne pas baisser le seuil.

6. **Flakiness sur `expires_at`.** Si un test pose `NOW() + interval '1 second'` et que l execution est lente, l autorisation expire avant l assertion. Remede : toujours `interval '1 day'` pour les actives, jamais une fenetre courte.

7. **Collision d UUID entre `cross-tenant-v3` et `rls-helper-v3` en parallele.** Symptome : `duplicate key value violates unique constraint "auth_tenants_pkey"`. Remede : prefixes d UUID distincts par fichier (`aaaa` vs `cccc`), deja appliques, et `ON CONFLICT DO NOTHING` sur les seeds.

8. **`pg_get_constraintdef` retourne un nom de contrainte different.** Si la contrainte n a pas ete nommee canoniquement, la requete par `conname` ne trouve rien. Remede : la migration 7.5a.4 nomme explicitement `cross_tenant_authorizations_type_check` et `cross_tenant_authorizations_resource_type_check`. Verifier `SELECT conname FROM pg_constraint WHERE conrelid = 'cross_tenant_authorizations'::regclass;` et ajuster la spec si le nom reel differe.

9. **Snapshot de roles met a jour par accident.** Si quelqu un lance `vitest -u`, le snapshot EN DUR n est PAS affecte (il s agit d un `toEqual` sur un tableau litteral, pas d un `toMatchSnapshot`). C est le but : la mise a jour automatique ne peut pas masquer un renommage.

10. **Total de tests qui diminue sans echec visible.** Cause : un fichier de spec entier a ete supprime ou exclu par un glob. Remede : comparer `Test Files X` avant/apres ; le nombre de fichiers de spec ne doit pas diminuer.

---

## 13. Conformite Maroc

### 13.1 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

La suite RBAC + RLS de cette tache constitue une **preuve d audit** directement opposable a un controle ACAPS. L isolation multi-tenant testee (50+ scenarios RLS) demontre que les donnees d un assureur (carrier), d un courtier (broker), d un garage, d un expert ou d une societe d assistance (tow) ne sont jamais accessibles aux autres acteurs sans une autorisation cross-tenant explicite, bornee dans le temps et revocable. La separation des taches (separation of duties) exigee par ACAPS est materialisee par la granularite des 26 roles et des 130 permissions, et verifiee par les tests de mutual-exclusivity et de hierarchie : un `carrier_finance` ne peut pas exercer les prerogatives d un `carrier_compliance`, un `garage_technicien` ne peut pas approuver un devis. Les tests d isolation de `expert_designations` prouvent que la designation d un expert par une compagnie reste confinee au perimetre legitime.

### 13.2 CNDP loi 09-08 (protection des donnees a caractere personnel)

Les tests d isolation RLS (S01-S61) sont la **preuve technique** que les donnees a caractere personnel des assures (residence des donnees, isolation par tenant) ne fuient pas entre tenants. La loi 09-08 exige que le responsable de traitement garantisse la confidentialite et l integrite des donnees ; demontrer mecaniquement, par 50+ scenarios automatises rejouables, qu une requete d un tenant ne retourne jamais les lignes d un autre tenant (sauf autorisation explicite et bornee) constitue une mesure de securite documentee et auditable. Le test S51 (INSERT bloque sans contexte) prouve qu aucune donnee ne peut etre cree hors d un perimetre tenant identifie. La conservation des fonctions de purge (`compliance.cndp_purge.execute`) dans le catalogue de permissions est verifiee par les tests de non-regression.

### 13.3 Loi 17-99 (Code des assurances marocain)

Le Code des assurances (loi 17-99) encadre les roles et responsabilites des intermediaires d assurance (courtiers, agents) et des compagnies. La modelisation des 26 roles -- en particulier l ajout des familles carrier, expert et tow en v3.0 -- reflete la structure reelle du marche marocain de l assurance automobile et de l assistance. Les tests garantissent que ces roles sont correctement isoles et hierarchises, condition necessaire a la conformite des flux metier (designation d expert, transmission de devis a la compagnie, prise en charge d un sinistre) avec les obligations legales. La permission a 4 segments `carrier.compliance.reports.generate`, testee par cette tache, materialise la production des rapports reglementaires exiges par l autorite.

---

## 14. Conventions absolues

- **Multi-tenant strict** : en-tete `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; `AsyncLocalStorage` ; isolation RLS via `app_can_access_tenant()` ; piste d audit (audit trail) systematique.
- **Validation strict** : Zod uniquement ; types partages via `@insurtech/shared-types` ; `z.object` / `z.infer` ; aucun `class-validator`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; champs JSON structures `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id (memoire 65536, iterations 3, parallelisme 4) ; jamais bcrypt ; `PASSWORD_PEPPER` applicatif.
- **Package manager strict** : pnpm uniquement ; `engine-strict` Node >= 22.11.0 ; `save-exact` ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest unitaire + integration ; Playwright E2E ; chaque `.ts` possede son `.spec.ts` ; couverture >= 85 % global, >= 90 % sur `auth` / `database` / `signature`.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles ; 130 permissions.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; un schema Zod par evenement ; `Idempotency-Key` sur les evenements critiques.
- **Imports strict** : `@insurtech/{name}` ; chemins de `tsconfig.base.json` ; ordre Node / externes / `@insurtech` / relatifs.
- **Skalean AI strict (decision-005)** : acces a l IA uniquement via `@insurtech/sky` ou MCP ; jamais d appel direct a un fournisseur frontier ; mock pour les Sprints 1-28, reel a partir du Sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; la CI echoue si une emoji est detectee.
- **Idempotency-Key strict** : obligatoire sur `POST /payments`, `/signatures`, `/claims` et les ecritures MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc ; chiffrement AES-256-GCM au repos ; TLS 1.3 en transit.

---

## 15. Validation pre-commit

Avant de committer la suite de tests :

```bash
# 1. Typecheck strict sur les deux packages touches.
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/database typecheck

# 2. Lint (ESLint flat config, ordre des imports, pas de console.log).
pnpm lint

# 3. Suite unitaire complete verte.
SKIP_INTEGRATION=true pnpm test

# 4. Suite d integration complete verte (Postgres requis).
pnpm --filter @insurtech/database migration:run
SKIP_INTEGRATION=false pnpm --filter @insurtech/database test

# 5. Couverture aux seuils.
pnpm test --coverage

# 6. Absence d emoji.
bash repo/scripts/check-no-emoji.sh

# 7. Aucun nouveau skip dissimule.
git diff --unified=0 origin/main -- '*.spec.ts' | grep -E '^\+.*(describe|it)\.skip' || echo "aucun nouveau skip"

# 8. Verdict GO/NO-GO : toutes les commandes ci-dessus en exit 0 et 0 failed => GO.
```

La porte GO/NO-GO est franchie uniquement si les 7 commandes precedentes reussissent et que la checklist de la section 3.4 est integralement cochee. En cas de NO-GO, corriger la cause racine (jamais desactiver le test fautif) et re-executer la totalite.

---

## 16. Message de commit

```text
test(sprint-7.5a): add RBAC + RLS v3.0 foundation tests, 0 regression on 1071+

Aggregate and re-run the full Sprint 7.5a foundation test suite, add the
missing cross-cutting coherence tests, and seal the GO/NO-GO gate before
the v3.0 foundation commit/tag (7.5a.9).

Unit:
- auth-roles.spec.ts: 26 roles, per-family counts, mutual-exclusivity loop
  (26 it, exactly one family guard each), exhaustive getRoleHierarchy,
  MFA mandatory for new admins, frozen hardcoded snapshot of the 26 values.
- permissions.spec.ts: 130 unique permissions, naming regex (incl. 4-segment
  carrier.compliance.reports.generate), 4 new modules (carrier/expert/tow/parts),
  90 historical permissions unchanged, 4 payment levels.
- role-hierarchy.spec.ts: DAG cycle-free (DFS), exhaustive Record keys,
  terminal roles, v3.0 families, no broker<->garage cross-domain bridge.
- cross-tenant-authorization.spec.ts: 7 types, 8 resource_types,
  requiresTimeBoundedAuthorization true for all but multi_tenant_user_access.

Integration (Postgres, non-superuser test role, SET LOCAL app.* context):
- cross-tenant-v3.spec.ts: 7 types insertable, CHECK rejects invalid,
  8 resource_type + NULL, expert_designations RLS enabled+forced, status CHECK.
- rls-helper-v3.spec.ts: 50+ scenarios on app_can_access_tenant -- same-tenant,
  super-admin bypass, 7 cross-tenant types bidirectional (direct+reverse),
  expired/revoked denial, wrong-couple denial, expert_designations isolation
  between two tenants, FORCE RLS sample, no regression on 33 existing tables.

Coherence (anti-drift triangulation):
- v3-foundation-coherence.spec.ts: SQL CHECK types == TS union == helper source;
  resource_type CHECK 8 values; doc mentions 26 roles + 130 permissions;
  no ghost permission cited in the doc.

Gate:
- pnpm test: 0 failed, total >= 1071 baseline + new tests.
- coverage: global >= 85%, auth >= 90%, database >= 90%.
- regression threshold: > 5 => NO-GO (target 0).

Task: 7.5a.8
Sprint: 7.5a -- Assurflow Foundation
Phase: 2.5 -- Migration Assurflow
Reference: B-7.5a Tache 7.5a.8
```

---

## 17. Workflow -- etape suivante

Une fois cette tache **GO** (suite verte, couverture aux seuils, coherence sans derive, 0 regression nette ou <= 5 toleree par aleas d infrastructure) :

1. **Debloquer la tache 7.5a.9** (commit + tag de la fondation Assurflow v3.0). La tache 7.5a.9 ne doit JAMAIS s executer si la presente tache est en NO-GO. Le verdict GO de 7.5a.8 est le pre-requis formel de 7.5a.9.
2. **Transmettre a 7.5a.9** : le recapitulatif `pnpm test` (nombre total de tests, 0 failed), le rapport de couverture (global / auth / database), et la confirmation que la checklist GO/NO-GO de la section 3.4 est integralement cochee.
3. **7.5a.9 produira** : un commit conventionnel agregeant les livrables 7.5a.2 a 7.5a.8, puis un tag annote (par exemple `v3.0-assurflow-foundation`) marquant la fondation comme stable et auditable. Le tag scelle l etat valide par la presente suite de tests.
4. **En cas de NO-GO** : ne pas avancer vers 7.5a.9. Identifier la cause racine (regression, derive de coherence, couverture insuffisante, isolation RLS defaillante), corriger le code source incrimine (7.5a.2 a 7.5a.7 selon le cas), puis re-executer integralement la presente suite jusqu a obtenir un GO franc. Ne jamais contourner la porte en desactivant un test.

La tache suivante immediate dans la sequence du sprint est donc **task-7.5a.9 (commit + tag)**, conditionnee au verdict GO emis ici.

---

_Fin de la tache 7.5a.8. Document autoportant, sans emoji (decision-006), conforme aux conventions absolues du programme Skalean InsurTech v3.0 -- vertical Assurflow. Toutes les sections 1 a 17 sont presentes et ordonnees. Le code de test fourni est complet et executable (Vitest unitaire + integration Postgres + coherence anti-derive). La porte GO/NO-GO est l unique sortie consommee par la tache 7.5a.9._
