# Tache 7.5a.2 -- Extension de l'enum AuthRole de 12 a 26 roles (Carrier / Expert / Tow / Parts)

## 1. En-tete metadonnees

| Champ | Valeur |
| --- | --- |
| Sprint | 7.5a -- Assurflow Foundation |
| Reference meta-prompt | B-7.5a, tache 7.5a.2 |
| Phase programme | Phase 2.5 -- Migration Assurflow v3.0 |
| Priorite | P0 (bloquant pour Sprint 7 tache 2.3.2 PermissionsMatrix et pour 7.5a.3 CrossTenant) |
| Effort estime | 3 heures (1 dev senior TypeScript familier du package @insurtech/auth) |
| Dependances amont | tache 7.5a.1 (decisions 012/013/014 figees, modele 6 acteurs valide) |
| Dependances aval | tache 7.5a.3 (CrossTenantAuthorizationType), Sprint 7 tache 2.3.2 (PermissionsMatrix 26 roles) |
| Package cible | `@insurtech/auth` (workspace `repo/packages/auth`) |
| Vertical | Assurflow (assurance automobile Maroc) |
| Densite cible du present prompt | 80-150 ko (auto-suffisant, AUCUNE relecture d'autre document requise) |
| Convention emoji | AUCUNE EMOJI nulle part (decision-006, absolue, CI bloquante) |
| Langue prose | Francais ; identifiants et code en forme naturelle (anglais) |
| Mode TypeScript | strict total (noUncheckedIndexedAccess, noImplicitAny, exactOptionalPropertyTypes) |

Cette tache modifie un enum TypeScript REEL existant (`export enum AuthRole`) et ses helpers reels. Elle ne cree PAS de nouveau package, ne touche AUCUNE base de donnees, n'introduit AUCUNE migration SQL : c'est une extension de types pure, en amont de toute logique RBAC runtime. Le perimetre est strictement le sous-arbre `repo/packages/auth/src/types/` et `repo/packages/auth/src/rbac/`.

---

## 2. But

Le programme Skalean InsurTech v2.2 reposait sur un ecosysteme a 3 acteurs effectifs cote tenant : la plateforme Skalean (niveau 1), les tenants courtage (broker) et garage (niveau 2), l'assure final (niveau 3) et le prospect public. Le modele de roles `AuthRole` comptait 12 valeurs. La version 3.0 (vertical Assurflow, assurance automobile Maroc) etend l'ecosysteme a 6 acteurs metier en ajoutant trois familles de tenants : les compagnies d'assurance (Carrier), les cabinets et experts independants (Expert), et les societes d'assistance/remorquage (Tow), plus un role transverse cote garage pour la gestion des pieces detachees (PartsHub). Le but de la presente tache est d'etendre l'enum `AuthRole` de 12 a 26 valeurs, de maniere additive et non destructive, en conservant integralement les 12 cles et valeurs string existantes, et en ajoutant 14 nouveaux roles parfaitement typees, documentes (JSDoc avec marqueur NOUVEAU v3.0), et integres a TOUTE la machinerie d'aide (guards, hierarchie DAG, MFA, WebAuthn, metadonnees FR/EN/AR, tableaux geles).

Concretement, cette tache produit : (1) un fichier `auth-roles.ts` reecrit a 26 entrees d'enum avec trois nouveaux type-guards `isCarrierRole`, `isExpertRole`, `isTowRole`, l'extension de `isGarageRole` (passage de 5 a 6 roles avec `garage_parts_manager`) et de `isTenantRole` (union des cinq familles tenant), le switch exhaustif `getRoleHierarchy` couvrant les 26 cas avec verification `never`, l'extension de `isMfaMandatory` et `prefersWebAuthn`, et le tableau gele `ALL_AUTH_ROLES` a 26 entrees ; (2) le fichier de specification Vitest `auth-roles.spec.ts` (inexistant aujourd'hui, donc CREE) avec au moins 25 cas de test ; (3) l'extension du DAG `RoleHierarchy` dans `role-hierarchy.ts` (le `Record<AuthRole, readonly AuthRole[]>` DOIT couvrir exhaustivement les 26 cles sous peine d'erreur de compilation) et de ses guards dupliques ; (4) l'extension des metadonnees `role-metadata.ts` avec descriptions FR/EN/AR, niveau et type tenant pour les 14 nouveaux roles ; (5) la mise a jour du barrel `types/index.ts` pour exporter les trois nouveaux guards.

L'enjeu strategique est sequentiel et chiffre : effectuer cette extension MAINTENANT, avant la construction de la matrice de permissions du Sprint 7 (tache 2.3.2, PermissionsMatrix), evite un refactoring en cascade. Si la PermissionsMatrix etait d'abord batie sur 12 roles puis re-etendue a 26, le cout estime du retravail serait de 15 a 20 heures (re-generation de la matrice, re-ecriture des tests de permissions par role, re-validation des seeds RBAC, re-revue securite). En posant les 26 roles en amont, la matrice nait directement complete. Cette tache est donc volontairement petite (extension de types) mais a fort effet de levier : elle est P0 car elle conditionne la justesse de tout le RBAC v3.0.

---

## 3. Contexte etendu

### 3.1 Pourquoi passer de 12 a 26 roles

Le passage de 12 a 26 roles est dicte par l'elargissement de l'ecosysteme Assurflow v3.0 de 3 a 6 acteurs cote tenant. En v2.2, la chaine de valeur s'arretait au triptyque plateforme / courtier-garage / assure. En assurance automobile reelle au Maroc, la chaine de gestion d'un sinistre fait intervenir : la compagnie d'assurance (le porteur de risque, qui indemnise), l'expert automobile (qui chiffre le dommage et statue sur la prise en charge), et l'assisteur/remorqueur (qui depanne et transporte le vehicule). Sans ces trois familles, le moteur de sinistres Assurflow ne peut modeliser ni l'affectation d'un expert, ni la validation d'un rapport d'expertise, ni le declenchement d'un remorquage. Le role `garage_parts_manager` complete le tenant garage : la gestion d'approvisionnement et de stock de pieces detachees (PartsHub) est une fonction distincte du chef d'atelier et du comptable, avec ses propres permissions (commande fournisseur, reception, valorisation stock).

Decompte cible des 26 roles :

| Famille | Niveau | Roles | Nombre |
| --- | --- | --- | --- |
| Platform | 1-2 | super_admin_platform, analyst_support | 2 |
| Broker (tenant) | 3-4 | broker_admin, broker_user, broker_assistant | 3 |
| Garage (tenant) | 3-4 | garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, garage_parts_manager | 6 |
| Carrier (tenant, NOUVEAU) | 3-4 | carrier_admin, carrier_claims_manager, carrier_finance, carrier_compliance, carrier_expert_manager, carrier_partner_manager | 6 |
| Expert (tenant, NOUVEAU) | 3-4 | expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal | 4 |
| Tow (tenant, NOUVEAU) | 3-4 | tow_admin, tow_driver, tow_dispatcher | 3 |
| Assure (L3) | 5 | assure | 1 |
| Public | 5 | prospect | 1 |
| **TOTAL** | | | **26** |

Soit 12 existants conserves + 14 nouveaux (1 parts + 6 carrier + 4 expert + 3 tow).

### 3.2 Les 6 acteurs de l'ecosysteme Assurflow v3.0

1. **Plateforme Skalean** : exploite le SaaS, supervise tous les tenants, bypass RLS. Roles : super_admin_platform (full), analyst_support (read-only transverse).
2. **Broker (courtier)** : cabinet de courtage qui souscrit les polices et gere le portefeuille client. Roles : broker_admin, broker_user, broker_assistant.
3. **Garage (reparateur)** : atelier agree qui repare les vehicules sinistres et fournit des pieces. Roles : garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, garage_parts_manager (NOUVEAU).
4. **Carrier (compagnie d'assurance)** : porteur de risque, accepte/refuse, indemnise, controle la conformite. Roles (NOUVEAU) : carrier_admin, carrier_claims_manager, carrier_finance, carrier_compliance, carrier_expert_manager, carrier_partner_manager.
5. **Expert (expert automobile)** : agree ACAPS, chiffre les dommages, redige les rapports d'expertise. Roles (NOUVEAU) : expert_independent (expert solo), expert_firm_admin (admin de cabinet d'expertise), expert_associate (expert salarie d'un cabinet), expert_carrier_internal (expert salarie d'une compagnie).
6. **Tow (assisteur / remorqueur)** : depanne sur route, remorque vers le garage. Roles (NOUVEAU) : tow_admin (gestion societe), tow_dispatcher (repartiteur d'interventions), tow_driver (chauffeur sur le terrain, PWA mobile).

### 3.3 Pourquoi MAINTENANT, avant Sprint 7 tache 2.3.2

La tache 2.3.2 du Sprint 7 construit la `PermissionsMatrix` : un objet qui associe a chaque role un ensemble de permissions effectives, alimente par la resolution recursive du DAG `RoleHierarchy`. Cette matrice est le coeur du RBAC runtime (RolesGuard). Trois scenarios ont ete compares :

| Scenario | Description | Cout | Risque |
| --- | --- | --- | --- |
| A -- Extension prealable (RETENU) | Etendre AuthRole a 26 maintenant (tache 7.5a.2), puis batir PermissionsMatrix directement sur 26 | 3h maintenant | Faible : la matrice nait complete |
| B -- Matrice puis extension | Batir PermissionsMatrix sur 12, livrer Sprint 7, puis re-etendre a 26 | 3h + 15-20h retravail | Eleve : re-generation matrice, re-tests permissions par role, re-seeds RBAC, re-revue securite, risque de derive de permissions oubliees |
| C -- Roles dynamiques en base | Ne pas figer l'enum, stocker les roles en table | ~40h | Tres eleve : perte de la securite de type a la compilation, switch exhaustif impossible, regressions silencieuses |

Le scenario A est retenu : 3 heures investies maintenant economisent 15 a 20 heures de cascade. La cascade vient du fait que la PermissionsMatrix, ses tests, les seeds RBAC, les fixtures E2E et la revue securite sont tous indexes par role : ajouter 14 roles apres coup oblige a re-traverser chacun de ces artefacts.

### 3.4 Alternatives de modelisation -- enum vs const object vs union string

| Option | Forme | Avantages | Inconvenients | Verdict |
| --- | --- | --- | --- | --- |
| `enum AuthRole` (ACTUEL) | `export enum AuthRole { SuperAdminPlatform = 'super_admin_platform', ... }` | Nominal typing, autocompletion, switch exhaustif avec check `never`, reverse mapping desactive sur string enum, deja en place et exporte partout | Genere du JS au runtime (objet), legerement plus lourd qu'un const | RETENU. On conserve l'enum existant. NE PAS convertir en const object ni en union string : cela casserait tous les imports `AuthRole.X` du monorepo |
| `const object as const` | `export const AuthRole = { ... } as const; type AuthRole = typeof AuthRole[keyof typeof AuthRole]` | Zero runtime overhead, tree-shakable | Migration massive de tous les call-sites `AuthRole.BrokerAdmin` (l'acces reste valide mais la semantique de type change), risque de regression | REJETE pour cette tache |
| Union string litterale | `type AuthRole = 'super_admin_platform' \| ...` | Le plus leger | Pas de namespace `AuthRole.X`, perte d'autocompletion par membre, refactoring de tous les call-sites | REJETE |

Le code reel utilise un VRAI enum TypeScript (mot-cle `enum`), PAS un const object. Cette tache conserve imperativement ce style. Toute conversion serait hors-scope et destructrice.

### 3.5 Trade-offs de conception

- **Exclusivite mutuelle des guards** : chaque role appartient a EXACTLY une famille. Les guards `isPlatformRole`, `isBrokerRole`, `isGarageRole`, `isCarrierRole`, `isExpertRole`, `isTowRole`, `isAssureRole`, `isProspectRole` partitionnent l'ensemble des 26 roles. Un test de la spec verifie que chaque role passe exactement un de ces huit guards (somme = 1). `isTenantRole` n'est pas exclusif : c'est l'union de broker+garage+carrier+expert+tow (5 familles, 22 roles).
- **Enum vs const** : on garde l'enum pour le switch exhaustif `getRoleHierarchy` avec `const exhaustive: never = role`. C'est ce mecanisme qui garantit, a la compilation, qu'aucun des 26 roles n'est oublie. Si un role n'est pas traite, la compilation echoue (le `default` recoit un type non-`never`).
- **Record exhaustif** : `RoleHierarchy: Record<AuthRole, readonly AuthRole[]>` oblige le compilateur a exiger une cle par role. Ajouter un role a l'enum sans l'ajouter au Record produit une erreur TS2741 (propriete manquante). C'est une protection precieuse, mais aussi un piege : il faut penser a etendre le Record.
- **Duplication des guards** : `isBrokerRole`, `isGarageRole`, `isPlatformRole` existent en DOUBLE (dans `auth-roles.ts` ET dans `role-hierarchy.ts`). Les deux copies DOIVENT rester strictement coherentes. Cette duplication est un piege majeur (voir piege P03). On ne supprime pas la duplication dans cette tache (hors-scope), mais on synchronise.

### 3.6 Decisions referencees

- **decision-012** (Ecosysteme 6 acteurs Assurflow v3.0) : fige la liste des 6 acteurs et leurs sous-roles. C'est la source de verite des 14 nouveaux roles.
- **decision-013** (RBAC roles) : regit la nomenclature des roles (`{famille}_{fonction}`, snake_case, valeurs string immuables). Interdit de renommer une valeur string existante.
- **decision-014** (Hierarchie tenant et isolation) : fige le DAG des familles tenant (admin > sous-roles), interdit le cross-domain (un role d'une famille ne peut etre enfant d'une autre famille).

### 3.7 Pieges techniques (chacun avec Pourquoi / Solution)

**P01 -- Oubli de la mise a jour de `ALL_AUTH_ROLES`.**
Pourquoi : `ALL_AUTH_ROLES` est un tableau gele construit a la main (pas derive de l'enum). Ajouter un role a l'enum sans l'ajouter au tableau laisse le tableau a 12 ou a un compte incoherent. Les validateurs Zod et les boucles de test qui iterent sur ce tableau passeraient a cote des nouveaux roles silencieusement.
Solution : ajouter explicitement les 14 nouveaux roles au tableau, et ecrire un test `expect(ALL_AUTH_ROLES).toHaveLength(26)` ainsi qu'un test verifiant que chaque membre de l'enum est present dans le tableau (`Object.values(AuthRole)` compare a `ALL_AUTH_ROLES`).

**P02 -- Record `RoleHierarchy` non exhaustif (erreur de compilation).**
Pourquoi : `Record<AuthRole, readonly AuthRole[]>` exige une cle par role. Etendre l'enum sans etendre le Record produit l'erreur TS2741 "Property '[AuthRole.CarrierAdmin]' is missing". La compilation echoue.
Solution : ajouter les 14 cles au Record `RoleHierarchy` avec leurs enfants directs, dans `role-hierarchy.ts`. Verifier par `pnpm --filter @insurtech/auth typecheck`.

**P03 -- Derive entre `isBrokerRole`/`isGarageRole`/`isPlatformRole` dupliques.**
Pourquoi : ces guards existent dans `auth-roles.ts` ET `role-hierarchy.ts`. Si on etend `isGarageRole` (+garage_parts_manager) dans un seul fichier, les deux copies divergent : un meme role serait garage dans un fichier et pas dans l'autre.
Solution : etendre `isGarageRole` dans LES DEUX fichiers de maniere identique (ajout de `garage_parts_manager`). Ecrire un test qui importe les deux copies et verifie qu'elles renvoient le meme resultat pour les 26 roles.

**P04 -- Switch `getRoleHierarchy` non exhaustif (check `never` casse).**
Pourquoi : le `default` du switch fait `const exhaustive: never = role`. Si un nouveau role n'est traite par aucun `case`, `role` n'est pas reductible a `never` et la compilation echoue (TS2322).
Solution : ajouter un `case` pour chacun des 14 nouveaux roles. Les roles terminaux (sans enfant) tombent dans la branche groupee `return [role]`. Les admins de famille retournent leur sous-arbre.

**P05 -- Omission MFA pour les admins des nouveaux tenants.**
Pourquoi : `isMfaMandatory` doit imposer la MFA aux admins de tenant (porte d'entree privilegiee). Oublier carrier_admin / expert_firm_admin / tow_admin / expert_independent laisse des comptes a fort privilege sans second facteur, faille de securite directe.
Solution : ajouter carrier_admin, expert_firm_admin, tow_admin, expert_independent a `isMfaMandatory`. expert_independent est un expert solo donc admin de fait de son propre tenant.

**P06 -- Renommage accidentel d'une valeur string existante.**
Pourquoi : les valeurs string (`'broker_admin'`, etc.) sont gravees dans les JWT emis, les seeds, les RLS policies. Renommer `'garage_chef'` en `'garage_manager'` invaliderait tous les tokens existants et casserait l'authn en production.
Solution : NE JAMAIS modifier une valeur string existante. Ecrire un test snapshot des valeurs string des 26 roles pour detecter toute mutation accidentelle.

**P07 -- Cross-domain dans le DAG.**
Pourquoi : decision-014 interdit qu'un role d'une famille soit enfant d'une autre. Mettre par erreur `expert_associate` comme enfant de `carrier_admin` melangerait les permissions inter-tenant.
Solution : chaque chaine du DAG reste intra-famille. `carrier_admin` n'a comme enfants que des roles carrier_*. Un test verifie que les enfants d'un role partagent sa famille (sauf platform qui est vide).

**P08 -- Cycle introduit dans le DAG.**
Pourquoi : `RoleHierarchy` doit etre un DAG acyclique (resolution recursive). Une erreur de copier-coller (`tow_driver` enfant de lui-meme, ou `A -> B -> A`) creerait une boucle infinie a la resolution.
Solution : tous les nouveaux roles ont des chaines lineaires ou en etoile sans retour. Test DFS de detection de cycle sur les 26 roles.

**P09 -- Niveau (`level`) incoherent dans les metadonnees.**
Pourquoi : `RoleMeta.level` est un `RoleLevel = 1|2|3|4|5`. Les admins de tenant sont niveau 3, leurs sous-roles niveau 4. Mettre un carrier_admin a niveau 4 fausserait `ROLES_BY_LEVEL` et les dashboards.
Solution : aligner les nouveaux roles : admins de tenant = 3, sous-roles = 4, comme broker/garage existants.

**P10 -- `tenantType` non etendu dans `RoleMeta`.**
Pourquoi : le champ `tenantType` est une union litterale `'platform'|'broker'|'garage'|'l3'|'public'`. Les nouveaux roles carrier/expert/tow n'ont pas de valeur valide : assigner `'carrier'` produit une erreur de type.
Solution : etendre l'union `tenantType` a `'platform'|'broker'|'garage'|'carrier'|'expert'|'tow'|'l3'|'public'` dans `role-metadata.ts`, puis renseigner les nouveaux roles.

**P11 -- Oubli des exports dans `types/index.ts`.**
Pourquoi : les trois nouveaux guards `isCarrierRole`/`isExpertRole`/`isTowRole` ne seraient pas accessibles depuis `@insurtech/auth` si non exportes par le barrel selectif.
Solution : ajouter les trois noms au bloc `export { ... } from './auth-roles.js'`.

**P12 -- Caractere arabe casse (encodage) dans les descriptions AR.**
Pourquoi : les descriptions arabes (RTL) doivent rester en UTF-8 valide. Un mauvais encodage produirait des caracteres de remplacement et casserait l'i18n.
Solution : ecrire les descriptions AR en UTF-8, ne pas mixer avec des caracteres de controle, verifier visuellement le rendu. Aucun emoji.

---

## 4. Architecture context

### 4.1 Position dans le sprint

Cette tache est la **tache 2 sur 10** du Sprint 7.5a (Assurflow Foundation). Elle depend de la tache 7.5a.1 (decisions 012/013/014 figees) et bloque :
- la tache 7.5a.3 (CrossTenantAuthorizationType : types d'autorisation inter-tenant -- un expert d'un cabinet intervient pour un carrier, un garage recoit un vehicule d'un assisteur -- qui referencent les nouveaux roles) ;
- la tache Sprint 7 2.3.2 (PermissionsMatrix : matrice de permissions par role, qui DOIT couvrir les 26 roles).

```
Sprint 7.5a -- chaine de dependances (extrait)
  7.5a.1 (decisions 012/013/014)
        |
        v
  7.5a.2 (CETTE TACHE : AuthRole 12 -> 26)   <-- vous etes ici
        |
        +--> 7.5a.3 (CrossTenantAuthorizationType)
        |
        +--> Sprint 7 / 2.3.2 (PermissionsMatrix 26 roles)
```

### 4.2 Taxonomie des roles (diagramme ASCII)

```
                          AuthRole (26)
                               |
        +----------------------+-----------------------+--------------+----------+
        |                      |                       |              |          |
   PLATFORM (N1-2)        TENANT (N3-4)              ASSURE (N3)   PUBLIC      (transverse)
        |                      |                       |          (N5)
  +-----+-----+    +-----------+-----------+        assure      prospect
  |           |    |     |     |     |     |
 super_     analyst broker garage carrier expert  tow
 admin_     _support  |     |     |     |    |
 platform           (3)   (6)   (6)   (4)  (3)
                     |     |     |     |    |
   broker_admin -----+     |     |     |    +-- tow_admin
     > broker_user         |     |     |          > tow_dispatcher
        > broker_assistant |     |     |              > tow_driver (PWA)
                           |     |     |
   garage_admin -----------+     |     |
     > garage_chef               |     |
        > garage_technicien (PWA)|     |
     > garage_comptable          |     |
     > garage_commercial         |     |
     > garage_parts_manager (NEW)|     |
                                 |     |
   carrier_admin ----------------+     |
     > carrier_claims_manager          |
     > carrier_finance                 |
     > carrier_compliance              |
     > carrier_expert_manager          |
     > carrier_partner_manager         |
                                       |
   expert_firm_admin ------------------+
     > expert_associate
   expert_independent (solo, admin de fait)
   expert_carrier_internal (salarie carrier)
```

Niveaux : Platform N1 (super_admin) / N2 (analyst_support). Tenant N3 (admins) / N4 (sous-roles). Assure N5 (l3). Prospect N5 (public).

---

## 5. Livrables checkables

- [ ] `repo/packages/auth/src/types/auth-roles.ts` : enum `AuthRole` etendu de 12 a 26 valeurs (14 nouvelles cles + valeurs string), chaque nouveau membre avec JSDoc + marqueur NOUVEAU v3.0.
- [ ] `auth-roles.ts` : nouveau guard `isCarrierRole(role)` couvrant les 6 roles carrier.
- [ ] `auth-roles.ts` : nouveau guard `isExpertRole(role)` couvrant les 4 roles expert.
- [ ] `auth-roles.ts` : nouveau guard `isTowRole(role)` couvrant les 3 roles tow.
- [ ] `auth-roles.ts` : `isGarageRole` etendu a 6 roles (ajout `garage_parts_manager`).
- [ ] `auth-roles.ts` : `isTenantRole` = broker || garage || carrier || expert || tow (22 roles).
- [ ] `auth-roles.ts` : `getRoleHierarchy` switch exhaustif couvrant les 26 roles avec check `never` intact.
- [ ] `auth-roles.ts` : `isMfaMandatory` etendu (+carrier_admin, expert_firm_admin, tow_admin, expert_independent).
- [ ] `auth-roles.ts` : `prefersWebAuthn` etendu (+tow_driver, +garage_parts_manager).
- [ ] `auth-roles.ts` : `ALL_AUTH_ROLES` etendu a 26 entrees (frozen).
- [ ] `repo/packages/auth/src/types/auth-roles.spec.ts` : CREE, >= 25 cas Vitest.
- [ ] `repo/packages/auth/src/rbac/role-hierarchy.ts` : `RoleHierarchy` Record etendu aux 26 cles (DAG carrier/expert/tow), guards dupliques `isGarageRole` synchronise.
- [ ] `repo/packages/auth/src/rbac/role-hierarchy.spec.ts` : tests DAG (pas de cycle, exhaustivite, resolution).
- [ ] `repo/packages/auth/src/rbac/role-metadata.ts` : 14 entrees `RoleMeta` ajoutees (FR/EN/AR, level, tenantType etendu).
- [ ] `repo/packages/auth/src/types/index.ts` : exports `isCarrierRole`, `isExpertRole`, `isTowRole` ajoutes.
- [ ] `pnpm --filter @insurtech/auth typecheck` : 0 erreur.
- [ ] `pnpm --filter @insurtech/auth lint` : 0 erreur, 0 warning.
- [ ] `pnpm --filter @insurtech/auth test` : 100% des cas verts, couverture auth >= 90%.
- [ ] `bash scripts/check-no-emoji.sh repo/packages/auth/src` : aucune emoji detectee.
- [ ] Aucune valeur string de role existante modifiee (test snapshot vert).

---

## 6. Fichiers crees / modifies

| Fichier | Action | Delta lignes estime | Commentaire |
| --- | --- | --- | --- |
| `repo/packages/auth/src/types/auth-roles.ts` | Modifie | +~150 (de 181 a ~330) | 14 entrees enum, 3 guards, extension 5 helpers, ALL_AUTH_ROLES |
| `repo/packages/auth/src/types/auth-roles.spec.ts` | CREE | +~260 | >= 25 cas Vitest |
| `repo/packages/auth/src/types/index.ts` | Modifie | +3 | exports des 3 nouveaux guards |
| `repo/packages/auth/src/rbac/role-hierarchy.ts` | Modifie | +~60 | 14 cles Record + extension isGarageRole |
| `repo/packages/auth/src/rbac/role-hierarchy.spec.ts` | CREE ou etendu | +~120 | tests DAG, cycle, exhaustivite |
| `repo/packages/auth/src/rbac/role-metadata.ts` | Modifie | +~130 | 14 entrees RoleMeta + extension union tenantType |

Aucun autre fichier ne doit etre touche. Pas de migration SQL, pas de changement d'API, pas de modification des controllers.

---

## 7. Code patterns COMPLETS

Cette section fournit l'integralite des fichiers a produire, executable tel quel. Chaque bloc est precede de son chemin absolu et suivi de "Notes importantes".

### 7.1 Fichier complet : `repo/packages/auth/src/types/auth-roles.ts`

```typescript
/**
 * @insurtech/auth/types/auth-roles
 *
 * Defines the 26 strict roles of the Skalean InsurTech v3.0 program (vertical Assurflow).
 * NEVER add a role without updating documentation/5-roles-permissions.md AND the RBAC service of Sprint 7.
 * NEVER rename an existing string value : it is engraved in JWTs, seeds and RLS policies.
 *
 * Hierarchy (from highest privilege to lowest):
 *   Platform Niveau 1     : super_admin_platform > analyst_support
 *   Tenant Broker N2      : broker_admin > broker_user > broker_assistant
 *   Tenant Garage N2      : garage_admin > garage_chef > garage_technicien (+ comptable + commercial + parts_manager siblings)
 *   Tenant Carrier N2     : carrier_admin > {claims_manager, finance, compliance, expert_manager, partner_manager}
 *   Tenant Expert N2      : expert_firm_admin > expert_associate ; expert_independent (solo) ; expert_carrier_internal
 *   Tenant Tow N2         : tow_admin > tow_dispatcher > tow_driver
 *   Assure N3             : assure
 *   Public                : prospect
 *
 * Reference :
 *   - 00-pilotage/documentation/5-roles-permissions.md
 *   - 00-pilotage/decisions/decision-012-ecosysteme-6-acteurs.md
 *   - 00-pilotage/decisions/decision-013-rbac-roles.md
 *   - 00-pilotage/decisions/decision-014-hierarchie-tenant-isolation.md
 *   - Sprint 7 RBAC implementation, Sprint 7.5a Assurflow Foundation
 */

export enum AuthRole {
  /** Skalean platform staff -- full bypass RLS, manages all tenants */
  SuperAdminPlatform = 'super_admin_platform',
  /** Skalean platform staff -- read-only across all tenants for support N2 */
  AnalystSupport = 'analyst_support',

  /** Tenant broker -- admin of a courtage cabinet, full CRUD within tenant */
  BrokerAdmin = 'broker_admin',
  /** Tenant broker -- subscribing courtier, owns deals and policies */
  BrokerUser = 'broker_user',
  /** Tenant broker -- administrative assistant */
  BrokerAssistant = 'broker_assistant',

  /** Tenant garage -- admin of a repair garage, full CRUD within tenant */
  GarageAdmin = 'garage_admin',
  /** Tenant garage -- workshop manager, assigns sinistres */
  GarageChef = 'garage_chef',
  /** Tenant garage -- workshop technician, executes repairs (PWA mobile) */
  GarageTechnicien = 'garage_technicien',
  /** Tenant garage -- accounting staff, manages books + payments */
  GarageComptable = 'garage_comptable',
  /** Tenant garage -- commercial staff, manages devis */
  GarageCommercial = 'garage_commercial',
  /** Tenant garage -- parts and stock manager (PartsHub : supplier orders, reception, stock valuation). NOUVEAU v3.0 ; child of garage_admin */
  GaragePartsManager = 'garage_parts_manager',

  /** Tenant carrier -- admin of an insurance company, full CRUD within tenant. NOUVEAU v3.0 ; parent of all carrier_* roles */
  CarrierAdmin = 'carrier_admin',
  /** Tenant carrier -- claims manager, accepts/refuses and pilots sinistre lifecycle. NOUVEAU v3.0 ; child of carrier_admin */
  CarrierClaimsManager = 'carrier_claims_manager',
  /** Tenant carrier -- finance staff, manages indemnisations and reserves. NOUVEAU v3.0 ; child of carrier_admin */
  CarrierFinance = 'carrier_finance',
  /** Tenant carrier -- compliance officer, ACAPS/loi 17-99 controls. NOUVEAU v3.0 ; child of carrier_admin */
  CarrierCompliance = 'carrier_compliance',
  /** Tenant carrier -- expert network manager, assigns expert missions. NOUVEAU v3.0 ; child of carrier_admin */
  CarrierExpertManager = 'carrier_expert_manager',
  /** Tenant carrier -- partner network manager (garages, tow companies). NOUVEAU v3.0 ; child of carrier_admin */
  CarrierPartnerManager = 'carrier_partner_manager',

  /** Tenant expert -- independent solo expert (ACAPS agrement), de facto admin of own single-seat tenant. NOUVEAU v3.0 */
  ExpertIndependent = 'expert_independent',
  /** Tenant expert -- admin of an expertise firm, full CRUD within tenant. NOUVEAU v3.0 ; parent of expert_associate */
  ExpertFirmAdmin = 'expert_firm_admin',
  /** Tenant expert -- salaried associate expert of a firm. NOUVEAU v3.0 ; child of expert_firm_admin */
  ExpertAssociate = 'expert_associate',
  /** Tenant expert -- in-house expert salaried by a carrier. NOUVEAU v3.0 ; standalone within expert family */
  ExpertCarrierInternal = 'expert_carrier_internal',

  /** Tenant tow -- admin of an assistance/towing company, full CRUD within tenant. NOUVEAU v3.0 ; parent of tow_dispatcher */
  TowAdmin = 'tow_admin',
  /** Tenant tow -- dispatcher, assigns interventions to drivers. NOUVEAU v3.0 ; child of tow_admin, parent of tow_driver */
  TowDispatcher = 'tow_dispatcher',
  /** Tenant tow -- field driver, executes towing missions (PWA mobile, WebAuthn). NOUVEAU v3.0 ; child of tow_dispatcher */
  TowDriver = 'tow_driver',

  /** End user -- assured client connected to assure-portal apps */
  Assure = 'assure',

  /** Public visitor -- non-authenticated or signing up */
  Prospect = 'prospect',
}

/**
 * Type guard: is this role a Platform-level role (Niveau 1)?
 * Platform roles bypass tenant isolation (no tenant_id required in JWT).
 * MUST be checked before any tenant_id comparison logic.
 */
export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SuperAdminPlatform || role === AuthRole.AnalystSupport;
}

/**
 * Type guard: is this role a Tenant-level role (Niveau 2)?
 * Tenant roles require tenant_id in JWT. Operations are scoped to that tenant.
 * Union of the five tenant families: broker, garage, carrier, expert, tow (22 roles in v3.0).
 */
export function isTenantRole(role: AuthRole): boolean {
  return (
    isBrokerRole(role) ||
    isGarageRole(role) ||
    isCarrierRole(role) ||
    isExpertRole(role) ||
    isTowRole(role)
  );
}

/** Type guard: is this role specific to broker tenants (cabinet courtage)? */
export function isBrokerRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant
  );
}

/**
 * Type guard: is this role specific to garage tenants?
 * v3.0: extended with garage_parts_manager (PartsHub) -- now 6 roles.
 */
export function isGarageRole(role: AuthRole): boolean {
  return (
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial ||
    role === AuthRole.GaragePartsManager
  );
}

/**
 * Type guard: is this role specific to carrier tenants (insurance company)?
 * NOUVEAU v3.0. Covers the 6 carrier_* roles.
 */
export function isCarrierRole(role: AuthRole): boolean {
  return (
    role === AuthRole.CarrierAdmin ||
    role === AuthRole.CarrierClaimsManager ||
    role === AuthRole.CarrierFinance ||
    role === AuthRole.CarrierCompliance ||
    role === AuthRole.CarrierExpertManager ||
    role === AuthRole.CarrierPartnerManager
  );
}

/**
 * Type guard: is this role specific to expert tenants (expertise automobile)?
 * NOUVEAU v3.0. Covers the 4 expert_* roles (independent, firm_admin, associate, carrier_internal).
 */
export function isExpertRole(role: AuthRole): boolean {
  return (
    role === AuthRole.ExpertIndependent ||
    role === AuthRole.ExpertFirmAdmin ||
    role === AuthRole.ExpertAssociate ||
    role === AuthRole.ExpertCarrierInternal
  );
}

/**
 * Type guard: is this role specific to tow tenants (assistance / remorquage)?
 * NOUVEAU v3.0. Covers the 3 tow_* roles (admin, dispatcher, driver).
 */
export function isTowRole(role: AuthRole): boolean {
  return (
    role === AuthRole.TowAdmin ||
    role === AuthRole.TowDispatcher ||
    role === AuthRole.TowDriver
  );
}

/** Type guard: is this the assure (final client) role? */
export function isAssureRole(role: AuthRole): boolean {
  return role === AuthRole.Assure;
}

/** Type guard: is this the prospect (public, anonymous) role? */
export function isProspectRole(role: AuthRole): boolean {
  return role === AuthRole.Prospect;
}

/**
 * Returns the role itself plus all roles it inherits in the hierarchy.
 * broker_admin "is a" broker_user "is a" broker_assistant.
 * Used by Sprint 7 RBAC to inherit permissions from sub-roles.
 *
 * v3.0: extended to the 26 roles. Carrier/Expert/Tow families added.
 * Exhaustiveness is enforced at compile time by the `never` check in the default branch:
 * forgetting any of the 26 roles makes the build fail (TS2322).
 */
export function getRoleHierarchy(role: AuthRole): AuthRole[] {
  switch (role) {
    case AuthRole.BrokerAdmin:
      return [AuthRole.BrokerAdmin, AuthRole.BrokerUser, AuthRole.BrokerAssistant];
    case AuthRole.BrokerUser:
      return [AuthRole.BrokerUser, AuthRole.BrokerAssistant];
    case AuthRole.BrokerAssistant:
      return [AuthRole.BrokerAssistant];

    case AuthRole.GarageAdmin:
      return [
        AuthRole.GarageAdmin,
        AuthRole.GarageChef,
        AuthRole.GarageTechnicien,
        AuthRole.GarageComptable,
        AuthRole.GarageCommercial,
        AuthRole.GaragePartsManager,
      ];
    case AuthRole.GarageChef:
      return [AuthRole.GarageChef, AuthRole.GarageTechnicien];

    case AuthRole.CarrierAdmin:
      return [
        AuthRole.CarrierAdmin,
        AuthRole.CarrierClaimsManager,
        AuthRole.CarrierFinance,
        AuthRole.CarrierCompliance,
        AuthRole.CarrierExpertManager,
        AuthRole.CarrierPartnerManager,
      ];

    case AuthRole.ExpertFirmAdmin:
      return [AuthRole.ExpertFirmAdmin, AuthRole.ExpertAssociate];

    case AuthRole.TowAdmin:
      return [AuthRole.TowAdmin, AuthRole.TowDispatcher, AuthRole.TowDriver];
    case AuthRole.TowDispatcher:
      return [AuthRole.TowDispatcher, AuthRole.TowDriver];

    case AuthRole.GarageTechnicien:
    case AuthRole.GarageComptable:
    case AuthRole.GarageCommercial:
    case AuthRole.GaragePartsManager:
    case AuthRole.CarrierClaimsManager:
    case AuthRole.CarrierFinance:
    case AuthRole.CarrierCompliance:
    case AuthRole.CarrierExpertManager:
    case AuthRole.CarrierPartnerManager:
    case AuthRole.ExpertIndependent:
    case AuthRole.ExpertAssociate:
    case AuthRole.ExpertCarrierInternal:
    case AuthRole.TowDriver:
    case AuthRole.SuperAdminPlatform:
    case AuthRole.AnalystSupport:
    case AuthRole.Assure:
    case AuthRole.Prospect:
      return [role];
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled AuthRole in getRoleHierarchy: ${String(exhaustive)}`);
    }
  }
}

/**
 * Whether MFA is mandatory for this role.
 * Platform staff MUST have MFA at signup. Tenant admins MUST have MFA when they create their tenant.
 * v3.0: added carrier_admin, expert_firm_admin, tow_admin and expert_independent
 * (expert_independent is the de facto admin of its single-seat tenant).
 */
export function isMfaMandatory(role: AuthRole): boolean {
  return (
    role === AuthRole.SuperAdminPlatform ||
    role === AuthRole.AnalystSupport ||
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.GarageAdmin ||
    role === AuthRole.CarrierAdmin ||
    role === AuthRole.ExpertFirmAdmin ||
    role === AuthRole.ExpertIndependent ||
    role === AuthRole.TowAdmin
  );
}

/**
 * Whether WebAuthn / Passkey biometric login is preferred for this role (Sprint 23).
 * Field roles working on PWA mobile without keyboard benefit from passkey login.
 * v3.0: added tow_driver (field PWA) and garage_parts_manager (warehouse PWA).
 */
export function prefersWebAuthn(role: AuthRole): boolean {
  return (
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.TowDriver ||
    role === AuthRole.GaragePartsManager
  );
}

/** All AuthRole values as a frozen array (for iteration in tests, validators, etc.) -- 26 in v3.0. */
export const ALL_AUTH_ROLES: readonly AuthRole[] = Object.freeze([
  AuthRole.SuperAdminPlatform,
  AuthRole.AnalystSupport,
  AuthRole.BrokerAdmin,
  AuthRole.BrokerUser,
  AuthRole.BrokerAssistant,
  AuthRole.GarageAdmin,
  AuthRole.GarageChef,
  AuthRole.GarageTechnicien,
  AuthRole.GarageComptable,
  AuthRole.GarageCommercial,
  AuthRole.GaragePartsManager,
  AuthRole.CarrierAdmin,
  AuthRole.CarrierClaimsManager,
  AuthRole.CarrierFinance,
  AuthRole.CarrierCompliance,
  AuthRole.CarrierExpertManager,
  AuthRole.CarrierPartnerManager,
  AuthRole.ExpertIndependent,
  AuthRole.ExpertFirmAdmin,
  AuthRole.ExpertAssociate,
  AuthRole.ExpertCarrierInternal,
  AuthRole.TowAdmin,
  AuthRole.TowDispatcher,
  AuthRole.TowDriver,
  AuthRole.Assure,
  AuthRole.Prospect,
]);
```

**Notes importantes (7.1)**
- L'ordre des entrees enum suit l'ordre logique : platform, broker, garage (parts a la fin du bloc garage), carrier, expert, tow, assure, prospect. Cet ordre est repris a l'identique dans `ALL_AUTH_ROLES`.
- `isTenantRole` est reecrit pour DELEGUER aux guards de famille (`isBrokerRole || isGarageRole || ...`) plutot que de lister 22 roles a la main. Cela elimine le risque de derive : etendre une famille met automatiquement a jour `isTenantRole`. C'est une amelioration de maintenabilite, mais verifier qu'aucun import circulaire n'en resulte (toutes ces fonctions sont dans le meme fichier, donc aucun probleme).
- Le switch `getRoleHierarchy` regroupe TOUS les roles terminaux (sans enfant) dans une seule cascade de `case` qui retourne `[role]`. Les 14 nouveaux roles terminaux y sont ajoutes. Les admins/intermediaires ont leur propre `case`.
- Le check `const exhaustive: never = role` reste la garde-fou de compilation. Si vous oubliez un `case`, la build casse.
- AUCUNE valeur string existante n'est modifiee. Les 14 nouvelles valeurs respectent le pattern `{famille}_{fonction}` en snake_case (decision-013).

### 7.2 Fichier CREE : `repo/packages/auth/src/types/auth-roles.spec.ts`

```typescript
/**
 * Specification Vitest pour @insurtech/auth/types/auth-roles.
 * Cree en Sprint 7.5a tache 7.5a.2 (extension 12 -> 26 roles).
 *
 * Couverture : decompte, guards par famille, exclusivite mutuelle,
 * hierarchie, MFA, WebAuthn, ALL_AUTH_ROLES, snapshot des valeurs string.
 */

import { describe, it, expect } from 'vitest';
import {
  AuthRole,
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
  ALL_AUTH_ROLES,
} from './auth-roles.js';

describe('AuthRole enum -- decompte', () => {
  it('contient exactement 26 valeurs', () => {
    expect(Object.values(AuthRole)).toHaveLength(26);
  });

  it('ALL_AUTH_ROLES contient exactement 26 entrees', () => {
    expect(ALL_AUTH_ROLES).toHaveLength(26);
  });

  it('ALL_AUTH_ROLES couvre tous les membres de l enum (aucun oubli)', () => {
    const enumValues = new Set(Object.values(AuthRole));
    const arrayValues = new Set(ALL_AUTH_ROLES);
    expect(arrayValues).toEqual(enumValues);
  });

  it('ALL_AUTH_ROLES est gele (frozen)', () => {
    expect(Object.isFrozen(ALL_AUTH_ROLES)).toBe(true);
  });

  it('ALL_AUTH_ROLES ne contient aucun doublon', () => {
    expect(new Set(ALL_AUTH_ROLES).size).toBe(ALL_AUTH_ROLES.length);
  });
});

describe('AuthRole -- snapshot des valeurs string (anti-renommage)', () => {
  it('les 26 valeurs string sont stables', () => {
    expect(ALL_AUTH_ROLES.map((r) => String(r))).toEqual([
      'super_admin_platform',
      'analyst_support',
      'broker_admin',
      'broker_user',
      'broker_assistant',
      'garage_admin',
      'garage_chef',
      'garage_technicien',
      'garage_comptable',
      'garage_commercial',
      'garage_parts_manager',
      'carrier_admin',
      'carrier_claims_manager',
      'carrier_finance',
      'carrier_compliance',
      'carrier_expert_manager',
      'carrier_partner_manager',
      'expert_independent',
      'expert_firm_admin',
      'expert_associate',
      'expert_carrier_internal',
      'tow_admin',
      'tow_dispatcher',
      'tow_driver',
      'assure',
      'prospect',
    ]);
  });
});

describe('Guards par famille -- decompte', () => {
  it('isPlatformRole couvre 2 roles', () => {
    expect(ALL_AUTH_ROLES.filter(isPlatformRole)).toHaveLength(2);
  });
  it('isBrokerRole couvre 3 roles', () => {
    expect(ALL_AUTH_ROLES.filter(isBrokerRole)).toHaveLength(3);
  });
  it('isGarageRole couvre 6 roles (incl. garage_parts_manager)', () => {
    const garage = ALL_AUTH_ROLES.filter(isGarageRole);
    expect(garage).toHaveLength(6);
    expect(garage).toContain(AuthRole.GaragePartsManager);
  });
  it('isCarrierRole couvre 6 roles', () => {
    expect(ALL_AUTH_ROLES.filter(isCarrierRole)).toHaveLength(6);
  });
  it('isExpertRole couvre 4 roles', () => {
    expect(ALL_AUTH_ROLES.filter(isExpertRole)).toHaveLength(4);
  });
  it('isTowRole couvre 3 roles', () => {
    expect(ALL_AUTH_ROLES.filter(isTowRole)).toHaveLength(3);
  });
  it('isAssureRole couvre 1 role', () => {
    expect(ALL_AUTH_ROLES.filter(isAssureRole)).toHaveLength(1);
  });
  it('isProspectRole couvre 1 role', () => {
    expect(ALL_AUTH_ROLES.filter(isProspectRole)).toHaveLength(1);
  });
  it('isTenantRole couvre 22 roles (broker+garage+carrier+expert+tow)', () => {
    expect(ALL_AUTH_ROLES.filter(isTenantRole)).toHaveLength(22);
  });
});

describe('Exclusivite mutuelle des 8 guards de famille', () => {
  const familyGuards: ReadonlyArray<(r: AuthRole) => boolean> = [
    isPlatformRole,
    isBrokerRole,
    isGarageRole,
    isCarrierRole,
    isExpertRole,
    isTowRole,
    isAssureRole,
    isProspectRole,
  ];

  it('chaque role passe EXACTEMENT un guard de famille', () => {
    for (const role of ALL_AUTH_ROLES) {
      const matches = familyGuards.filter((g) => g(role)).length;
      expect(matches, `role ${String(role)} should match exactly one family guard`).toBe(1);
    }
  });

  it('isTenantRole equivaut a non-platform & non-assure & non-prospect', () => {
    for (const role of ALL_AUTH_ROLES) {
      const expected = !isPlatformRole(role) && !isAssureRole(role) && !isProspectRole(role);
      expect(isTenantRole(role), `tenant check for ${String(role)}`).toBe(expected);
    }
  });
});

describe('getRoleHierarchy -- resolution', () => {
  it('broker_admin herite de broker_user et broker_assistant', () => {
    expect(getRoleHierarchy(AuthRole.BrokerAdmin)).toEqual([
      AuthRole.BrokerAdmin,
      AuthRole.BrokerUser,
      AuthRole.BrokerAssistant,
    ]);
  });

  it('garage_admin herite des 5 sous-roles incl. parts_manager', () => {
    const hier = getRoleHierarchy(AuthRole.GarageAdmin);
    expect(hier).toContain(AuthRole.GaragePartsManager);
    expect(hier).toHaveLength(6);
  });

  it('carrier_admin herite des 5 autres roles carrier', () => {
    const hier = getRoleHierarchy(AuthRole.CarrierAdmin);
    expect(hier).toHaveLength(6);
    expect(hier).toContain(AuthRole.CarrierClaimsManager);
    expect(hier).toContain(AuthRole.CarrierPartnerManager);
  });

  it('expert_firm_admin herite de expert_associate', () => {
    expect(getRoleHierarchy(AuthRole.ExpertFirmAdmin)).toEqual([
      AuthRole.ExpertFirmAdmin,
      AuthRole.ExpertAssociate,
    ]);
  });

  it('tow_admin > tow_dispatcher > tow_driver', () => {
    expect(getRoleHierarchy(AuthRole.TowAdmin)).toEqual([
      AuthRole.TowAdmin,
      AuthRole.TowDispatcher,
      AuthRole.TowDriver,
    ]);
    expect(getRoleHierarchy(AuthRole.TowDispatcher)).toEqual([
      AuthRole.TowDispatcher,
      AuthRole.TowDriver,
    ]);
  });

  it('expert_independent et expert_carrier_internal sont terminaux', () => {
    expect(getRoleHierarchy(AuthRole.ExpertIndependent)).toEqual([AuthRole.ExpertIndependent]);
    expect(getRoleHierarchy(AuthRole.ExpertCarrierInternal)).toEqual([
      AuthRole.ExpertCarrierInternal,
    ]);
  });

  it('tout role est present dans sa propre resolution (reflexivite)', () => {
    for (const role of ALL_AUTH_ROLES) {
      expect(getRoleHierarchy(role)).toContain(role);
    }
  });

  it('aucune resolution ne renvoie un tableau vide', () => {
    for (const role of ALL_AUTH_ROLES) {
      expect(getRoleHierarchy(role).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('la resolution ne sort jamais de la famille du role (intra-famille)', () => {
    const familyOf = (r: AuthRole): string => {
      if (isPlatformRole(r)) return 'platform';
      if (isBrokerRole(r)) return 'broker';
      if (isGarageRole(r)) return 'garage';
      if (isCarrierRole(r)) return 'carrier';
      if (isExpertRole(r)) return 'expert';
      if (isTowRole(r)) return 'tow';
      if (isAssureRole(r)) return 'assure';
      return 'public';
    };
    for (const role of ALL_AUTH_ROLES) {
      const fam = familyOf(role);
      for (const inherited of getRoleHierarchy(role)) {
        expect(familyOf(inherited), `${String(role)} inherits ${String(inherited)}`).toBe(fam);
      }
    }
  });
});

describe('isMfaMandatory', () => {
  it('impose la MFA aux platform staff', () => {
    expect(isMfaMandatory(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isMfaMandatory(AuthRole.AnalystSupport)).toBe(true);
  });

  it('impose la MFA aux admins de tenant incl. carrier/expert/tow', () => {
    expect(isMfaMandatory(AuthRole.BrokerAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.GarageAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.CarrierAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.ExpertFirmAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.ExpertIndependent)).toBe(true);
    expect(isMfaMandatory(AuthRole.TowAdmin)).toBe(true);
  });

  it('n impose pas la MFA aux sous-roles operationnels', () => {
    expect(isMfaMandatory(AuthRole.TowDriver)).toBe(false);
    expect(isMfaMandatory(AuthRole.GarageTechnicien)).toBe(false);
    expect(isMfaMandatory(AuthRole.CarrierClaimsManager)).toBe(false);
    expect(isMfaMandatory(AuthRole.ExpertAssociate)).toBe(false);
    expect(isMfaMandatory(AuthRole.Assure)).toBe(false);
    expect(isMfaMandatory(AuthRole.Prospect)).toBe(false);
  });

  it('impose la MFA a exactement 8 roles', () => {
    expect(ALL_AUTH_ROLES.filter(isMfaMandatory)).toHaveLength(8);
  });
});

describe('prefersWebAuthn', () => {
  it('prefere WebAuthn pour les roles terrain PWA', () => {
    expect(prefersWebAuthn(AuthRole.GarageTechnicien)).toBe(true);
    expect(prefersWebAuthn(AuthRole.TowDriver)).toBe(true);
    expect(prefersWebAuthn(AuthRole.GaragePartsManager)).toBe(true);
  });

  it('ne prefere pas WebAuthn pour les roles bureau', () => {
    expect(prefersWebAuthn(AuthRole.CarrierFinance)).toBe(false);
    expect(prefersWebAuthn(AuthRole.BrokerAdmin)).toBe(false);
  });

  it('prefere WebAuthn pour exactement 3 roles', () => {
    expect(ALL_AUTH_ROLES.filter(prefersWebAuthn)).toHaveLength(3);
  });
});
```

**Notes importantes (7.2)**
- Le test d'exclusivite mutuelle est la garde-fou principal : il itere sur les 26 roles et verifie que chacun passe exactement un des huit guards de famille. Toute future erreur d'affectation (un role dans deux familles, ou aucune) est detectee.
- Le test snapshot des valeurs string detecte tout renommage accidentel (piege P06). L'ordre du tableau attendu doit correspondre exactement a `ALL_AUTH_ROLES`.
- Le test intra-famille de `getRoleHierarchy` verifie la regle anti-cross-domain (decision-014).
- `vitest` import depuis `vitest` ; chemins en `.js` (NodeNext / ESM, conforme au reste du package).

### 7.3 Fichier modifie : `repo/packages/auth/src/rbac/role-hierarchy.ts`

```typescript
/**
 * RoleHierarchy DAG -- Sprint 7 Tache 2.3.2, etendu Sprint 7.5a Tache 7.5a.2.
 *
 * Convention :
 *   - Map[parent] = enfants directs (1 niveau)
 *   - Resolution recursive via HierarchyResolver.getEffectivePermissions()
 *   - Pas de cycle (DFS valide au boot)
 *   - Pas de cross-domain : un enfant partage la famille de son parent
 *   - v3.0 : 26 roles (familles carrier / expert / tow ajoutees)
 */

import { AuthRole } from '../types/auth-roles.js';

export const RoleHierarchy: Record<AuthRole, readonly AuthRole[]> = {
  // Platform : pas de hierarchie traditionnelle.
  [AuthRole.SuperAdminPlatform]: [],
  [AuthRole.AnalystSupport]: [],

  // Broker : chaine simple 3 niveaux.
  [AuthRole.BrokerAdmin]: [AuthRole.BrokerUser],
  [AuthRole.BrokerUser]: [AuthRole.BrokerAssistant],
  [AuthRole.BrokerAssistant]: [],

  // Garage : DAG multi-enfants (v3.0 : + garage_parts_manager).
  [AuthRole.GarageAdmin]: [
    AuthRole.GarageChef,
    AuthRole.GarageComptable,
    AuthRole.GarageCommercial,
    AuthRole.GaragePartsManager,
  ],
  [AuthRole.GarageChef]: [AuthRole.GarageTechnicien],
  [AuthRole.GarageTechnicien]: [],
  [AuthRole.GarageComptable]: [],
  [AuthRole.GarageCommercial]: [],
  [AuthRole.GaragePartsManager]: [],

  // Carrier (NOUVEAU v3.0) : admin en etoile sur 5 fonctions.
  [AuthRole.CarrierAdmin]: [
    AuthRole.CarrierClaimsManager,
    AuthRole.CarrierFinance,
    AuthRole.CarrierCompliance,
    AuthRole.CarrierExpertManager,
    AuthRole.CarrierPartnerManager,
  ],
  [AuthRole.CarrierClaimsManager]: [],
  [AuthRole.CarrierFinance]: [],
  [AuthRole.CarrierCompliance]: [],
  [AuthRole.CarrierExpertManager]: [],
  [AuthRole.CarrierPartnerManager]: [],

  // Expert (NOUVEAU v3.0) : firm_admin > associate ; independent et carrier_internal autonomes.
  [AuthRole.ExpertFirmAdmin]: [AuthRole.ExpertAssociate],
  [AuthRole.ExpertAssociate]: [],
  [AuthRole.ExpertIndependent]: [],
  [AuthRole.ExpertCarrierInternal]: [],

  // Tow (NOUVEAU v3.0) : chaine admin > dispatcher > driver.
  [AuthRole.TowAdmin]: [AuthRole.TowDispatcher],
  [AuthRole.TowDispatcher]: [AuthRole.TowDriver],
  [AuthRole.TowDriver]: [],

  // L3 + public terminaux.
  [AuthRole.Assure]: [],
  [AuthRole.Prospect]: [],
};

export function getDirectChildren(role: AuthRole): readonly AuthRole[] {
  return RoleHierarchy[role];
}

export function isTerminalRole(role: AuthRole): boolean {
  return RoleHierarchy[role].length === 0;
}

export function isBrokerRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant
  );
}

/** v3.0 : synchronise avec auth-roles.ts -- 6 roles (incl. garage_parts_manager). */
export function isGarageRole(role: AuthRole): boolean {
  return (
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial ||
    role === AuthRole.GaragePartsManager
  );
}

export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SuperAdminPlatform || role === AuthRole.AnalystSupport;
}

/** v3.0 : guard carrier duplique pour usage RBAC interne (synchronise avec auth-roles.ts). */
export function isCarrierRole(role: AuthRole): boolean {
  return (
    role === AuthRole.CarrierAdmin ||
    role === AuthRole.CarrierClaimsManager ||
    role === AuthRole.CarrierFinance ||
    role === AuthRole.CarrierCompliance ||
    role === AuthRole.CarrierExpertManager ||
    role === AuthRole.CarrierPartnerManager
  );
}

/** v3.0 : guard expert duplique pour usage RBAC interne (synchronise avec auth-roles.ts). */
export function isExpertRole(role: AuthRole): boolean {
  return (
    role === AuthRole.ExpertIndependent ||
    role === AuthRole.ExpertFirmAdmin ||
    role === AuthRole.ExpertAssociate ||
    role === AuthRole.ExpertCarrierInternal
  );
}

/** v3.0 : guard tow duplique pour usage RBAC interne (synchronise avec auth-roles.ts). */
export function isTowRole(role: AuthRole): boolean {
  return (
    role === AuthRole.TowAdmin ||
    role === AuthRole.TowDispatcher ||
    role === AuthRole.TowDriver
  );
}

export const ALL_ROLES_IN_HIERARCHY = Object.keys(RoleHierarchy) as readonly AuthRole[];
```

**Notes importantes (7.3)**
- Le `Record<AuthRole, readonly AuthRole[]>` est EXHAUSTIF par contrainte de type. Les 14 nouvelles cles sont obligatoires sinon TS2741.
- Les guards `isCarrierRole`/`isExpertRole`/`isTowRole` sont AJOUTES ici aussi (en plus de `auth-roles.ts`) pour rester coherent avec le pattern existant (les guards broker/garage/platform y sont deja dupliques). Ils permettent au moteur RBAC d'eviter un import croise.
- Les enfants de chaque parent respectent l'intra-famille (decision-014). `carrier_admin` n'a que des enfants carrier_*, etc.
- La resolution recursive externe (HierarchyResolver) descend les enfants directs ; ce DAG ne stocke QUE les enfants directs (1 niveau), contrairement a `getRoleHierarchy` de auth-roles.ts qui retourne l'ascendance/transitivite pre-calculee. Les deux representations doivent rester coherentes : tow_admin a pour descendance transitive {dispatcher, driver} dans les deux.

### 7.4 Fichier CREE/etendu : `repo/packages/auth/src/rbac/role-hierarchy.spec.ts`

```typescript
/**
 * Specification Vitest pour le DAG RoleHierarchy.
 * Etendu Sprint 7.5a tache 7.5a.2 (26 roles, familles carrier/expert/tow).
 */

import { describe, it, expect } from 'vitest';
import { AuthRole, ALL_AUTH_ROLES } from '../types/auth-roles.js';
import {
  RoleHierarchy,
  getDirectChildren,
  isTerminalRole,
  isGarageRole,
  isCarrierRole,
  isExpertRole,
  isTowRole,
  ALL_ROLES_IN_HIERARCHY,
} from './role-hierarchy.js';

describe('RoleHierarchy -- exhaustivite', () => {
  it('contient une cle pour chacun des 26 roles', () => {
    expect(Object.keys(RoleHierarchy)).toHaveLength(26);
  });

  it('ALL_ROLES_IN_HIERARCHY couvre exactement ALL_AUTH_ROLES', () => {
    expect(new Set(ALL_ROLES_IN_HIERARCHY)).toEqual(new Set(ALL_AUTH_ROLES));
  });

  it('tous les enfants references sont des roles valides', () => {
    const valid = new Set(ALL_AUTH_ROLES);
    for (const children of Object.values(RoleHierarchy)) {
      for (const child of children) {
        expect(valid.has(child)).toBe(true);
      }
    }
  });
});

describe('RoleHierarchy -- absence de cycle (DFS)', () => {
  it('le DAG est acyclique', () => {
    const visiting = new Set<AuthRole>();
    const visited = new Set<AuthRole>();
    const hasCycle = (node: AuthRole): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const child of getDirectChildren(node)) {
        if (hasCycle(child)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    for (const role of ALL_AUTH_ROLES) {
      expect(hasCycle(role), `cycle detected from ${String(role)}`).toBe(false);
    }
  });

  it('aucun role n est son propre enfant direct', () => {
    for (const role of ALL_AUTH_ROLES) {
      expect(getDirectChildren(role)).not.toContain(role);
    }
  });
});

describe('RoleHierarchy -- DAG des nouvelles familles', () => {
  it('carrier_admin a 5 enfants directs', () => {
    expect(getDirectChildren(AuthRole.CarrierAdmin)).toHaveLength(5);
  });
  it('expert_firm_admin a pour enfant expert_associate', () => {
    expect(getDirectChildren(AuthRole.ExpertFirmAdmin)).toEqual([AuthRole.ExpertAssociate]);
  });
  it('tow_admin > tow_dispatcher > tow_driver (chaine)', () => {
    expect(getDirectChildren(AuthRole.TowAdmin)).toEqual([AuthRole.TowDispatcher]);
    expect(getDirectChildren(AuthRole.TowDispatcher)).toEqual([AuthRole.TowDriver]);
    expect(getDirectChildren(AuthRole.TowDriver)).toEqual([]);
  });
  it('garage_admin a 4 enfants directs incl. parts_manager', () => {
    const children = getDirectChildren(AuthRole.GarageAdmin);
    expect(children).toHaveLength(4);
    expect(children).toContain(AuthRole.GaragePartsManager);
  });
  it('expert_independent et expert_carrier_internal sont terminaux', () => {
    expect(isTerminalRole(AuthRole.ExpertIndependent)).toBe(true);
    expect(isTerminalRole(AuthRole.ExpertCarrierInternal)).toBe(true);
  });
});

describe('RoleHierarchy -- intra-famille (anti cross-domain)', () => {
  const familyOf = (r: AuthRole): string => {
    if (r === AuthRole.SuperAdminPlatform || r === AuthRole.AnalystSupport) return 'platform';
    if (isGarageRole(r)) return 'garage';
    if (isCarrierRole(r)) return 'carrier';
    if (isExpertRole(r)) return 'expert';
    if (isTowRole(r)) return 'tow';
    if (
      r === AuthRole.BrokerAdmin ||
      r === AuthRole.BrokerUser ||
      r === AuthRole.BrokerAssistant
    )
      return 'broker';
    if (r === AuthRole.Assure) return 'assure';
    return 'public';
  };

  it('chaque enfant direct partage la famille de son parent', () => {
    for (const role of ALL_AUTH_ROLES) {
      for (const child of getDirectChildren(role)) {
        expect(familyOf(child), `${String(role)} -> ${String(child)}`).toBe(familyOf(role));
      }
    }
  });
});

describe('Coherence des guards dupliques entre auth-roles.ts et role-hierarchy.ts', () => {
  it('isGarageRole identique dans les deux modules', async () => {
    const fromTypes = await import('../types/auth-roles.js');
    for (const role of ALL_AUTH_ROLES) {
      expect(isGarageRole(role)).toBe(fromTypes.isGarageRole(role));
    }
  });
  it('isCarrierRole identique dans les deux modules', async () => {
    const fromTypes = await import('../types/auth-roles.js');
    for (const role of ALL_AUTH_ROLES) {
      expect(isCarrierRole(role)).toBe(fromTypes.isCarrierRole(role));
    }
  });
  it('isExpertRole identique dans les deux modules', async () => {
    const fromTypes = await import('../types/auth-roles.js');
    for (const role of ALL_AUTH_ROLES) {
      expect(isExpertRole(role)).toBe(fromTypes.isExpertRole(role));
    }
  });
  it('isTowRole identique dans les deux modules', async () => {
    const fromTypes = await import('../types/auth-roles.js');
    for (const role of ALL_AUTH_ROLES) {
      expect(isTowRole(role)).toBe(fromTypes.isTowRole(role));
    }
  });
});
```

**Notes importantes (7.4)**
- Le test de coherence des guards dupliques (P03) importe les deux copies et compare role par role. C'est la protection anti-derive.
- Le test DFS detecte tout cycle introduit par erreur (P08).
- Le test intra-famille confirme l'absence de cross-domain (P07).

### 7.5 Fichier modifie : `repo/packages/auth/src/rbac/role-metadata.ts` (extrait des ajouts)

L'union `tenantType` est etendue, puis les 14 entrees sont ajoutees AVANT l'entree `[AuthRole.Assure]`. Voici l'interface modifiee et les nouvelles entrees a inserer.

```typescript
// 1) Etendre l'union tenantType de l'interface RoleMeta :
export interface RoleMeta {
  readonly value: string;
  readonly descriptionFr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  readonly level: RoleLevel;
  readonly tenantType:
    | 'platform'
    | 'broker'
    | 'garage'
    | 'carrier'
    | 'expert'
    | 'tow'
    | 'l3'
    | 'public';
  /** Estimation count permissions par defaut (pour dashboards admin). */
  readonly defaultPermissionsCount: number;
}

// 2) Inserer ces 14 entrees dans RoleMetadata (apres GarageCommercial, avant Assure) :

  [AuthRole.GaragePartsManager]: {
    value: AuthRole.GaragePartsManager,
    descriptionFr: 'Gestionnaire pieces garage (commandes fournisseurs, stock, valorisation)',
    descriptionEn: 'Garage parts manager (supplier orders, stock, valuation)',
    descriptionAr: 'مدير قطع غيار المرآب (طلبات الموردين، المخزون، التقييم)',
    level: 4,
    tenantType: 'garage',
    defaultPermissionsCount: 22,
  },

  [AuthRole.CarrierAdmin]: {
    value: AuthRole.CarrierAdmin,
    descriptionFr: 'Admin compagnie assurance (CRUD complet tenant carrier)',
    descriptionEn: 'Insurance carrier admin (full CRUD tenant carrier)',
    descriptionAr: 'مسؤول شركة التأمين (CRUD كامل لمستأجر شركة التأمين)',
    level: 3,
    tenantType: 'carrier',
    defaultPermissionsCount: 70,
  },
  [AuthRole.CarrierClaimsManager]: {
    value: AuthRole.CarrierClaimsManager,
    descriptionFr: 'Gestionnaire sinistres compagnie (accepte/refuse, pilote cycle sinistre)',
    descriptionEn: 'Carrier claims manager (accepts/refuses, pilots claim lifecycle)',
    descriptionAr: 'مدير مطالبات الشركة (قبول/رفض، إدارة دورة المطالبة)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 40,
  },
  [AuthRole.CarrierFinance]: {
    value: AuthRole.CarrierFinance,
    descriptionFr: 'Finance compagnie (indemnisations, reserves, comptabilite technique)',
    descriptionEn: 'Carrier finance (indemnities, reserves, technical accounting)',
    descriptionAr: 'مالية الشركة (التعويضات، الاحتياطيات، المحاسبة الفنية)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 30,
  },
  [AuthRole.CarrierCompliance]: {
    value: AuthRole.CarrierCompliance,
    descriptionFr: 'Conformite compagnie (controles ACAPS, loi 17-99)',
    descriptionEn: 'Carrier compliance officer (ACAPS controls, law 17-99)',
    descriptionAr: 'مسؤول الامتثال للشركة (ضوابط ACAPS، القانون 17-99)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 25,
  },
  [AuthRole.CarrierExpertManager]: {
    value: AuthRole.CarrierExpertManager,
    descriptionFr: 'Manager reseau experts compagnie (affecte missions expertise)',
    descriptionEn: 'Carrier expert network manager (assigns expertise missions)',
    descriptionAr: 'مدير شبكة خبراء الشركة (تعيين مهام الخبرة)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 28,
  },
  [AuthRole.CarrierPartnerManager]: {
    value: AuthRole.CarrierPartnerManager,
    descriptionFr: 'Manager reseau partenaires compagnie (garages, assisteurs)',
    descriptionEn: 'Carrier partner network manager (garages, tow companies)',
    descriptionAr: 'مدير شبكة شركاء الشركة (المرائب، شركات المساعدة)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 28,
  },

  [AuthRole.ExpertIndependent]: {
    value: AuthRole.ExpertIndependent,
    descriptionFr: 'Expert independant agree ACAPS (cabinet mono-poste, admin de fait)',
    descriptionEn: 'Independent expert (ACAPS agreed, single-seat firm, de facto admin)',
    descriptionAr: 'خبير مستقل معتمد من ACAPS (مكتب فردي، مسؤول بحكم الواقع)',
    level: 3,
    tenantType: 'expert',
    defaultPermissionsCount: 35,
  },
  [AuthRole.ExpertFirmAdmin]: {
    value: AuthRole.ExpertFirmAdmin,
    descriptionFr: 'Admin cabinet expertise (CRUD complet tenant expert)',
    descriptionEn: 'Expertise firm admin (full CRUD tenant expert)',
    descriptionAr: 'مسؤول مكتب الخبرة (CRUD كامل لمستأجر الخبير)',
    level: 3,
    tenantType: 'expert',
    defaultPermissionsCount: 50,
  },
  [AuthRole.ExpertAssociate]: {
    value: AuthRole.ExpertAssociate,
    descriptionFr: 'Expert associe salarie de cabinet (redige rapports expertise)',
    descriptionEn: 'Salaried associate expert (writes expertise reports)',
    descriptionAr: 'خبير مساعد بأجر في المكتب (يحرر تقارير الخبرة)',
    level: 4,
    tenantType: 'expert',
    defaultPermissionsCount: 30,
  },
  [AuthRole.ExpertCarrierInternal]: {
    value: AuthRole.ExpertCarrierInternal,
    descriptionFr: 'Expert interne salarie compagnie (expertise pour son carrier)',
    descriptionEn: 'In-house expert salaried by a carrier (expertise for own carrier)',
    descriptionAr: 'خبير داخلي بأجر لدى شركة التأمين (خبرة لشركته)',
    level: 4,
    tenantType: 'expert',
    defaultPermissionsCount: 30,
  },

  [AuthRole.TowAdmin]: {
    value: AuthRole.TowAdmin,
    descriptionFr: 'Admin societe assistance/remorquage (CRUD complet tenant tow)',
    descriptionEn: 'Tow/assistance company admin (full CRUD tenant tow)',
    descriptionAr: 'مسؤول شركة المساعدة/القطر (CRUD كامل لمستأجر القطر)',
    level: 3,
    tenantType: 'tow',
    defaultPermissionsCount: 45,
  },
  [AuthRole.TowDispatcher]: {
    value: AuthRole.TowDispatcher,
    descriptionFr: 'Repartiteur assistance (affecte interventions aux chauffeurs)',
    descriptionEn: 'Tow dispatcher (assigns interventions to drivers)',
    descriptionAr: 'موزع المساعدة (يعين التدخلات للسائقين)',
    level: 4,
    tenantType: 'tow',
    defaultPermissionsCount: 25,
  },
  [AuthRole.TowDriver]: {
    value: AuthRole.TowDriver,
    descriptionFr: 'Chauffeur depanneur terrain (PWA mobile, WebAuthn)',
    descriptionEn: 'Field tow driver (PWA mobile, WebAuthn)',
    descriptionAr: 'سائق القطر الميداني (PWA المحمول، WebAuthn)',
    level: 4,
    tenantType: 'tow',
    defaultPermissionsCount: 15,
  },
```

**Notes importantes (7.5)**
- L'union `tenantType` DOIT etre etendue AVANT d'inserer les entrees, sinon les valeurs `'carrier'`/`'expert'`/`'tow'` produisent une erreur de type (P10).
- Les admins de tenant (carrier_admin, expert_firm_admin, expert_independent, tow_admin) sont `level: 3`. Les sous-roles sont `level: 4`. Coherent avec broker/garage (P09).
- `RoleMetadata` est typee `Record<string, RoleMeta>` (cle string), donc les 14 nouvelles entrees sont acceptees sans contrainte d'exhaustivite. Ne pas oublier d'ajouter les 14 sinon `ROLES_BY_LEVEL` les ignore.
- Descriptions AR en UTF-8 valide, RTL, sans emoji (P12).

### 7.6 Fichier modifie : `repo/packages/auth/src/types/index.ts` (additions d'exports)

```typescript
export {
  AuthRole,
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
  ALL_AUTH_ROLES,
} from './auth-roles.js';
```

**Notes importantes (7.6)**
- Seules trois lignes sont ajoutees au bloc existant : `isCarrierRole`, `isExpertRole`, `isTowRole`. Le reste du barrel est inchange.
- C'est un barrel SELECTIF (decision conventions : aucun `export *`). Respecter cela.

### 7.7 Note de migration / constantes de role (optionnel mais recommande)

Pour faciliter le seeding RBAC du Sprint 7 et la documentation, exposer des groupes de roles par famille peut etre utile. Cette constante est OPTIONNELLE et peut etre ajoutee en fin de `auth-roles.ts` :

```typescript
/**
 * Roles regroupes par famille tenant (v3.0). Utilitaire pour seeds RBAC et dashboards.
 * NE remplace PAS les guards : c'est une vue indexee pour iteration.
 */
export const ROLES_BY_FAMILY: Readonly<Record<string, readonly AuthRole[]>> = Object.freeze({
  platform: Object.freeze([AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport]),
  broker: Object.freeze([AuthRole.BrokerAdmin, AuthRole.BrokerUser, AuthRole.BrokerAssistant]),
  garage: Object.freeze([
    AuthRole.GarageAdmin,
    AuthRole.GarageChef,
    AuthRole.GarageTechnicien,
    AuthRole.GarageComptable,
    AuthRole.GarageCommercial,
    AuthRole.GaragePartsManager,
  ]),
  carrier: Object.freeze([
    AuthRole.CarrierAdmin,
    AuthRole.CarrierClaimsManager,
    AuthRole.CarrierFinance,
    AuthRole.CarrierCompliance,
    AuthRole.CarrierExpertManager,
    AuthRole.CarrierPartnerManager,
  ]),
  expert: Object.freeze([
    AuthRole.ExpertIndependent,
    AuthRole.ExpertFirmAdmin,
    AuthRole.ExpertAssociate,
    AuthRole.ExpertCarrierInternal,
  ]),
  tow: Object.freeze([AuthRole.TowAdmin, AuthRole.TowDispatcher, AuthRole.TowDriver]),
  assure: Object.freeze([AuthRole.Assure]),
  public: Object.freeze([AuthRole.Prospect]),
});
```

**Notes importantes (7.7)**
- Si vous ajoutez `ROLES_BY_FAMILY`, exportez-le aussi dans `types/index.ts` et ajoutez un test verifiant que la concatenation des familles egale `ALL_AUTH_ROLES` (somme = 26).
- Cette constante est optionnelle : ne pas la considerer comme bloquante pour la validation P0. Si non ajoutee, ignorer les criteres associes.

---

## 8. Tests complets

### 8.1 Strategie

Trois niveaux : (1) tests unitaires `auth-roles.spec.ts` (>=25 cas, voir 7.2) ; (2) tests DAG `role-hierarchy.spec.ts` (voir 7.4) ; (3) note d'integration JWT.

### 8.2 Inventaire des cas (auth-roles.spec.ts)

| # | describe | it | Verifie |
| --- | --- | --- | --- |
| 1 | decompte | enum a 26 valeurs | `Object.values(AuthRole).length === 26` |
| 2 | decompte | ALL_AUTH_ROLES a 26 | longueur |
| 3 | decompte | ALL couvre l'enum | egalite de sets |
| 4 | decompte | ALL gele | `Object.isFrozen` |
| 5 | decompte | ALL sans doublon | set.size === length |
| 6 | snapshot | 26 valeurs string stables | tableau attendu exact |
| 7 | guards | platform = 2 | filter length |
| 8 | guards | broker = 3 | filter length |
| 9 | guards | garage = 6 incl parts | filter + contain |
| 10 | guards | carrier = 6 | filter length |
| 11 | guards | expert = 4 | filter length |
| 12 | guards | tow = 3 | filter length |
| 13 | guards | assure = 1 | filter length |
| 14 | guards | prospect = 1 | filter length |
| 15 | guards | tenant = 22 | filter length |
| 16 | exclusivite | chaque role = 1 guard | boucle somme=1 |
| 17 | exclusivite | tenant = complement | boucle |
| 18 | hierarchy | broker_admin > 3 | egalite |
| 19 | hierarchy | garage_admin > 6 incl parts | contain + length |
| 20 | hierarchy | carrier_admin > 6 | length + contain |
| 21 | hierarchy | expert_firm_admin > associate | egalite |
| 22 | hierarchy | tow chaine | egalite x2 |
| 23 | hierarchy | expert solo terminaux | egalite |
| 24 | hierarchy | reflexivite | boucle contain |
| 25 | hierarchy | jamais vide | boucle >=1 |
| 26 | hierarchy | intra-famille | boucle famille |
| 27 | mfa | platform | true x2 |
| 28 | mfa | admins tenant | true x6 |
| 29 | mfa | sous-roles non | false x6 |
| 30 | mfa | exactement 8 | filter length |
| 31 | webauthn | terrain PWA | true x3 |
| 32 | webauthn | bureau non | false x2 |
| 33 | webauthn | exactement 3 | filter length |

33 cas (>= 25 requis).

### 8.3 Inventaire des cas (role-hierarchy.spec.ts)

| # | describe | Verifie |
| --- | --- | --- |
| 1 | exhaustivite | 26 cles |
| 2 | exhaustivite | ALL_ROLES_IN_HIERARCHY = ALL_AUTH_ROLES |
| 3 | exhaustivite | enfants valides |
| 4 | cycle | DAG acyclique (DFS) |
| 5 | cycle | aucun self-child |
| 6 | familles | carrier_admin 5 enfants |
| 7 | familles | expert_firm > associate |
| 8 | familles | tow chaine |
| 9 | familles | garage 4 enfants incl parts |
| 10 | familles | expert solo terminaux |
| 11 | intra-famille | enfant = famille parent |
| 12-15 | coherence guards | isGarage/isCarrier/isExpert/isTow identiques entre modules |

15 cas.

### 8.4 Note d'integration JWT

Un JWT v3.0 portant un nouveau role (ex. `"role": "carrier_claims_manager"`) doit etre parse sans erreur par `JwtPayload`. Comme `JwtPayload.role` est typee `AuthRole`, et que la valeur string `'carrier_claims_manager'` est maintenant un membre valide de l'enum, le parsing reussit. Test d'integration a ajouter (si une suite JWT existe) :

```typescript
import { describe, it, expect } from 'vitest';
import { AuthRole } from '../types/auth-roles.js';

describe('JWT integration -- nouveaux roles v3.0', () => {
  it('un payload portant carrier_claims_manager est un AuthRole valide', () => {
    const raw = 'carrier_claims_manager';
    const valid = Object.values(AuthRole).includes(raw as AuthRole);
    expect(valid).toBe(true);
  });
  it('un role legacy inconnu est rejete', () => {
    const raw = 'garage_manager_legacy';
    expect(Object.values(AuthRole).includes(raw as AuthRole)).toBe(false);
  });
});
```

---

## 9. Variables d'environnement

| Variable | Role | Exemple |
| --- | --- | --- |
| `NODE_ENV` | mode execution (tests en `test`) | `test` |
| `JWT_PRIVATE_KEY` | cle privee RS256 signant les JWT (role embarque dans le claim `role`) | (PEM RSA 2048, hors repo, via vault) |
| `JWT_PUBLIC_KEY` | cle publique verifiant les JWT | (PEM RSA 2048) |
| `JWT_ISSUER` | emetteur attendu | `https://auth.assurflow.ma` |
| `JWT_AUDIENCE` | audience attendue | `assurflow-api` |
| `PASSWORD_PEPPER` | pepper argon2id (non lie a cette tache mais requis par le package auth au boot) | (secret 32 octets) |

Aucune de ces variables n'est consommee directement par les fichiers modifies (types purs). Elles sont listees car le package `@insurtech/auth` les exige a l'execution et le claim `role` du JWT transporte desormais l'une des 26 valeurs.

---

## 10. Commandes shell

```bash
# Depuis la racine du monorepo
cd repo

# Verification de type stricte (DOIT etre 0 erreur)
pnpm --filter @insurtech/auth typecheck

# Lint (DOIT etre 0 erreur 0 warning)
pnpm --filter @insurtech/auth lint

# Tests unitaires + couverture
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test -- --coverage

# Cibler un seul fichier de spec
pnpm --filter @insurtech/auth test -- auth-roles.spec.ts
pnpm --filter @insurtech/auth test -- role-hierarchy.spec.ts

# Verification absence d'emoji
bash scripts/check-no-emoji.sh packages/auth/src

# Build du package (verifie que l'export public compile)
pnpm --filter @insurtech/auth build
```

---

## 11. Criteres de validation

### P0 (bloquants, >= 15)

| # | Critere | Commande | Attendu | Echec si |
| --- | --- | --- | --- | --- |
| V1 | enum a 26 valeurs | `pnpm --filter @insurtech/auth test -- auth-roles.spec.ts` | test "26 valeurs" vert | length != 26 |
| V2 | typecheck 0 erreur | `pnpm --filter @insurtech/auth typecheck` | exit 0 | toute erreur TS |
| V3 | switch getRoleHierarchy exhaustif | `pnpm --filter @insurtech/auth typecheck` | exit 0 (never check passe) | TS2322 sur `exhaustive` |
| V4 | Record RoleHierarchy exhaustif | `pnpm --filter @insurtech/auth typecheck` | exit 0 | TS2741 cle manquante |
| V5 | isCarrierRole couvre 6 | test | vert | length != 6 |
| V6 | isExpertRole couvre 4 | test | vert | length != 4 |
| V7 | isTowRole couvre 3 | test | vert | length != 3 |
| V8 | isGarageRole couvre 6 incl parts | test | vert | parts absent |
| V9 | isTenantRole couvre 22 | test | vert | length != 22 |
| V10 | exclusivite mutuelle (chaque role = 1 guard) | test | vert | un role 0 ou 2 guards |
| V11 | ALL_AUTH_ROLES = 26, frozen, sans doublon | test | vert | length/freeze KO |
| V12 | snapshot valeurs string stable | test | vert | renommage detecte |
| V13 | isMfaMandatory = 8 roles | test | vert | omission admin tenant |
| V14 | DAG acyclique | role-hierarchy.spec.ts | vert | cycle detecte |
| V15 | guards dupliques coherents (auth-roles vs role-hierarchy) | test | vert | divergence |
| V16 | exports index.ts (3 nouveaux guards) | `pnpm --filter @insurtech/auth build` | exit 0, guards importables | export manquant |

### P1 (>= 8)

| # | Critere | Commande | Attendu | Echec si |
| --- | --- | --- | --- | --- |
| V17 | lint 0 erreur 0 warning | `pnpm --filter @insurtech/auth lint` | exit 0 | warning |
| V18 | couverture auth >= 90% | `pnpm --filter @insurtech/auth test -- --coverage` | >= 90% | < 90% |
| V19 | hierarchie carrier_admin = 6 | test | vert | != 6 |
| V20 | hierarchie tow chaine | test | vert | mauvaise chaine |
| V21 | hierarchie intra-famille | test | vert | cross-domain |
| V22 | prefersWebAuthn = 3 (tech, driver, parts) | test | vert | != 3 |
| V23 | metadata 14 entrees ajoutees, level coherent | inspection + ROLES_BY_LEVEL | 26 entrees | level errone |
| V24 | tenantType etendu (carrier/expert/tow) | typecheck | exit 0 | union non etendue |

### P2 (>= 5)

| # | Critere | Commande | Attendu | Echec si |
| --- | --- | --- | --- | --- |
| V25 | aucune emoji | `bash scripts/check-no-emoji.sh packages/auth/src` | exit 0 | emoji detectee |
| V26 | aucun console.log | `grep -rn "console\." packages/auth/src/types packages/auth/src/rbac` | aucun match | match trouve |
| V27 | JSDoc NOUVEAU v3.0 sur chaque nouveau role | inspection visuelle / grep | 14 marqueurs | marqueur manquant |
| V28 | descriptions AR presentes pour 14 roles | inspection | 14 AR | AR manquante |
| V29 | reflexivite getRoleHierarchy | test | vert | role absent de sa resolution |
| V30 | build ESM (.js paths) | `pnpm --filter @insurtech/auth build` | exit 0 | erreur module |

---

## 12. Edge cases + troubleshooting

1. **Collision de valeur d'enum.** Symptome : deux membres d'enum partagent la meme valeur string. TypeScript ne l'interdit pas toujours. Detection : test snapshot + test "sans doublon" sur `ALL_AUTH_ROLES`. Solution : valeurs uniques `{famille}_{fonction}`.
2. **JWT portant un role legacy inconnu.** Symptome : un vieux token avec une valeur non listee. La validation Zod/`Object.values(AuthRole).includes(...)` rejette. Solution : le test d'integration 8.4 verifie le rejet. Aucun mapping legacy n'est requis (aucune valeur supprimee).
3. **Switch exhaustif casse.** Symptome : compilation echoue sur `const exhaustive: never = role` (TS2322). Cause : un role non traite. Solution : ajouter le `case` manquant (probablement dans la cascade terminale).
4. **Record manquant une cle.** Symptome : TS2741 "Property '[AuthRole.X]' is missing". Solution : ajouter la cle au `RoleHierarchy`.
5. **Derive des guards dupliques.** Symptome : test de coherence rouge. Cause : `isGarageRole` etendu dans un seul fichier. Solution : synchroniser les deux copies.
6. **Union tenantType non etendue.** Symptome : TS2322 sur `tenantType: 'carrier'`. Solution : etendre l'union dans `RoleMeta` (7.5 etape 1).
7. **`ALL_AUTH_ROLES` desynchronise de l'enum.** Symptome : test "ALL couvre l'enum" rouge. Solution : ajouter les 14 entrees au tableau.
8. **Caractere arabe casse.** Symptome : caracteres de remplacement dans les descriptions AR. Cause : encodage non-UTF-8. Solution : sauvegarder en UTF-8.
9. **Cycle dans le DAG.** Symptome : test DFS rouge ou stack overflow a la resolution. Solution : verifier qu'aucun enfant ne remonte vers un ancetre.
10. **Import circulaire.** Symptome : `undefined` au runtime sur un guard. Cause peu probable (tout dans un fichier). Solution : garder les guards dans `auth-roles.ts` ; ceux de `role-hierarchy.ts` n'importent que `AuthRole`.

---

## 13. Conformite Maroc detaillee

### 13.1 ACAPS -- agrement des experts (familles expert_*)

L'Autorite de Controle des Assurances et de la Prevoyance Sociale (ACAPS) regit l'agrement des experts en automobile. Les roles `expert_independent`, `expert_firm_admin`, `expert_associate` et `expert_carrier_internal` modelisent des intervenants qui, dans le monde reel, doivent etre agrees par l'ACAPS pour produire un rapport d'expertise opposable. Cette tache n'implemente PAS la verification d'agrement (Sprint ulterieur) mais POSE les roles qui porteront cette exigence : un futur attribut `acapsAgrementNumber` sera attache aux comptes expert. La metadonnee `descriptionFr` de `expert_independent` mentionne explicitement "agree ACAPS" pour documenter l'exigence reglementaire. Reference : circulaires ACAPS relatives a l'expertise automobile.

### 13.2 Loi 17-99 -- Code des assurances (familles carrier_*)

Le Code des assurances marocain (loi n. 17-99) encadre l'activite des compagnies d'assurance : agrement, solvabilite, gestion des sinistres, indemnisation. Les roles `carrier_*` modelisent les fonctions internes d'une compagnie agreee : `carrier_compliance` porte explicitement le controle de conformite (ACAPS / loi 17-99), `carrier_claims_manager` la gestion des sinistres (titre III du Code), `carrier_finance` les reserves techniques et indemnisations. La legitimite de ces roles decoule du fait que seule une entite agreee 17-99 peut etre carrier dans Assurflow. La `descriptionFr` de `carrier_compliance` cite la loi 17-99.

### 13.3 CNDP -- loi 09-08 (isolation des nouveaux tenants)

La loi 09-08 sur la protection des donnees a caractere personnel, supervisee par la CNDP, impose l'isolation stricte des donnees entre responsables de traitement. Chaque nouvelle famille tenant (carrier, expert, tow) est un tenant isole : ses donnees ne doivent jamais fuiter vers un autre tenant. Bien que cette tache ne touche pas la RLS, elle pose les roles sur lesquels reposera l'isolation : `isTenantRole` identifie les 22 roles qui EXIGENT un `tenant_id` dans le JWT, condition prealable au filtrage RLS `app_can_access_tenant()`. Aucune donnee d'assure ne quitte le territoire marocain (cloud souverain Atlas Cloud Benguerir, decision-008), conformement a la loi 09-08. Le decompte exact de `isTenantRole` (22) est donc un invariant de conformite teste (V9).

---

## 14. Conventions absolues skalean-insurtech

Les conventions suivantes sont reproduites IN EXTENSO et s'appliquent integralement a cette tache.

- **Multi-tenant strict.** Header `x-tenant-id` obligatoire sauf sur `/api/v1/public/*` et `/api/v1/admin/*`. Filtre `tenant_id` automatique via `TenantGuard`. Contexte propage par `AsyncLocalStorage` (`TenantContext`). RLS PostgreSQL via fonction `app_can_access_tenant()`. Audit trail par operation. (Cette tache ne touche pas la RLS mais ses roles pilotent l'exigence de `tenant_id`.)
- **Validation strict.** Zod uniquement (jamais class-validator, yup ou joi). Schemas dans `@insurtech/shared-types`. Pattern : `const Schema = z.object({...})` puis `type T = z.infer<typeof Schema>`.
- **Logger strict.** Pino injecte via `this.logger` ; jamais `console.log`. JSON structure. Champs : `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict.** argon2id (`memoryCost 65536`, `timeCost 3`, `parallelism 4`) ; jamais bcrypt. Pepper via `PASSWORD_PEPPER`.
- **Package manager strict.** pnpm uniquement. `engine-strict=true`, Node >= 22.11.0. `save-exact=true`. `link-workspace-packages=deep`.
- **TypeScript strict.** `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes`. Imports explicites (jamais `import *`).
- **Tests strict.** Vitest (unit + integration) ; Playwright (E2E). Chaque `.ts` (sauf fichiers types-only et `index.ts` barrel) a son `.spec.ts`. Couverture >= 85% global, >= 90% pour auth/database/signature.
- **RBAC strict.** Decorateur `@Roles()` par endpoint. `RolesGuard` + `TenantGuard` globaux. 26 roles en v3.0.
- **Events strict.** Topics Kafka `insurtech.events.{vertical}.{entity}.{action}`. Schema Zod par event. `Idempotency-Key` pour les events critiques.
- **Imports strict.** `@insurtech/{name}`. Paths via `tsconfig.base.json`. Ordre : Node / externe / `@insurtech` / relatif.
- **Skalean AI strict (decision-005).** Uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct OpenAI/Anthropic. Mock Sprint 1-28, reel Sprint 29.
- **No-emoji strict (decision-006, ABSOLUE).** Aucune emoji nulle part. Pre-commit `check-no-emoji.sh`. CI echoue sur emoji.
- **Idempotency-Key strict.** Obligatoire sur `POST /payments`, `/signatures`, `/claims`, ecritures MCP. TTL 24h Redis. Cle `idempotency:{tenant_id}:{user_id}:{key}`.
- **Conventional Commits strict.** `<type>(scope): description`. commitlint via husky.
- **Cloud souverain MA strict (decision-008).** Atlas Cloud Benguerir uniquement. DC1 Tier III + DC2 Tier IV. Aucune donnee assure ne quitte le Maroc (loi 09-08). Chiffrement AES-256-GCM. TLS 1.3.

---

## 15. Validation pre-commit

```bash
cd repo

# 1. Aucune emoji dans le perimetre
bash scripts/check-no-emoji.sh packages/auth/src

# 2. Aucun console.log dans les fichiers modifies
grep -rn "console\." packages/auth/src/types packages/auth/src/rbac && echo "ECHEC console" || echo "OK pas de console"

# 3. Typecheck strict
pnpm --filter @insurtech/auth typecheck

# 4. Lint
pnpm --filter @insurtech/auth lint

# 5. Tests + couverture
pnpm --filter @insurtech/auth test -- --coverage

# 6. Build (export public)
pnpm --filter @insurtech/auth build

# 7. Verifier le decompte enum a la volee
node -e "const m=require('./packages/auth/dist/types/auth-roles.js'); console.log('roles:', Object.keys(m.AuthRole).length)"
```

Tous les blocs doivent reussir (exit 0) avant commit.

---

## 16. Message de commit

```
feat(sprint-7.5a): extend AuthRole enum 12 to 26 roles (carrier/expert/tow/parts)

Etend l'enum AuthRole de 12 a 26 valeurs pour couvrir l'ecosysteme
6 acteurs Assurflow v3.0. Ajoute 14 roles : garage_parts_manager (PartsHub),
6 roles carrier (admin, claims_manager, finance, compliance, expert_manager,
partner_manager), 4 roles expert (independent, firm_admin, associate,
carrier_internal), 3 roles tow (admin, dispatcher, driver).

- 3 nouveaux guards : isCarrierRole (6), isExpertRole (4), isTowRole (3)
- isGarageRole etendu a 6 (garage_parts_manager)
- isTenantRole = broker || garage || carrier || expert || tow (22 roles)
- getRoleHierarchy switch exhaustif 26 cas (check never intact)
- RoleHierarchy DAG etendu (carrier etoile, expert firm>associate, tow chaine)
- isMfaMandatory etendu (carrier_admin, expert_firm_admin, expert_independent, tow_admin)
- prefersWebAuthn etendu (tow_driver, garage_parts_manager)
- ALL_AUTH_ROLES a 26 entrees
- role-metadata.ts : 14 entrees FR/EN/AR, union tenantType etendue
- auth-roles.spec.ts CREE (33 cas), role-hierarchy.spec.ts (15 cas)
- aucune valeur string existante modifiee (snapshot teste)

Conformite : ACAPS (experts), loi 17-99 (carrier), CNDP loi 09-08 (isolation tenant).

Task: 7.5a.2
Sprint: 7.5a Assurflow Foundation
Phase: 2.5 Migration Assurflow v3.0
Reference: meta-prompt B-7.5a, decisions 012/013/014
```

---

## 17. Workflow next step

Une fois cette tache validee (tous criteres P0 verts, lint et typecheck propres, tests verts, commit pousse), passer a la **tache 7.5a.3 -- CrossTenantAuthorizationType extension**. Cette tache suivante definit les types d'autorisation inter-tenant qui s'appuient directement sur les 26 roles ici poses : par exemple un `expert_associate` d'un tenant expert intervenant sur un sinistre d'un tenant carrier, ou un `tow_driver` livrant un vehicule a un tenant garage. Elle consommera `isCarrierRole`, `isExpertRole`, `isTowRole` et `isTenantRole` pour valider les ponts cross-tenant autorises. Ne pas demarrer 7.5a.3 tant que 7.5a.2 n'est pas mergee, car la matrice de permissions du Sprint 7 (tache 2.3.2) et les types cross-tenant dependent tous deux du jeu fige des 26 roles.

---

## Footer -- bilan de densite

- Densite : prompt auto-suffisant, aucune relecture externe requise.
- Fichiers de code complets fournis : 7 blocs (auth-roles.ts complet, auth-roles.spec.ts complet, role-hierarchy.ts complet, role-hierarchy.spec.ts complet, role-metadata.ts extrait des ajouts, types/index.ts, ROLES_BY_FAMILY optionnel).
- Cas de test : 33 (auth-roles.spec.ts) + 15 (role-hierarchy.spec.ts) + 2 (integration JWT) = 50 cas.
- Criteres de validation : V1-V30 (16 P0, 8 P1, 6 P2).
- Edge cases : 10 documentes.
- Pieges techniques : 12 (P01-P12) avec Pourquoi/Solution.
- Emoji : zero (decision-006 absolue).
- Roles : 12 conserves + 14 nouveaux = 26. Aucune valeur string existante modifiee.
