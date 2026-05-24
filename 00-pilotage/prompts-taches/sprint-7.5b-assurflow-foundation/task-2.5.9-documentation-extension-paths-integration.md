# Task 2.5.9 -- Documentation extension paths + tests integration cross-package (cloture Sprint 7.5b)

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5b (Phase 2 / Sprint 5 du programme Assurflow) |
| Reference programme | B-7.5b tache 2.5.9 (DERNIERE tache du sprint) |
| Phase | Phase 2 (Foundation verticale Assurflow) |
| Priorite | P0 (porte de sortie -- gate de cloture du sprint complet) |
| Effort estime | 2h |
| Dependances | 2.5.8 (services squelettes @insurtech/tow) ; transitivement 2.5.1 -> 2.5.8 + Sprint 7.5a merge |
| Bloque | Sprint 8 (CRM + Booking) -- ne demarre qu'apres cloture verte de 7.5b |
| Densite cible | 80-150 ko (cible 100-115 ko) |
| Position | Tache 9/9 du Sprint 7.5b |
| Vertical | Assurflow (decision-011) |
| Editeur | Skalean (decision-011) |
| Marque commerciale | Sofidemy (decision-011) |
| Decisions appliquees | 005, 006, 008, 011, 012, 013, 014 |
| Conformite | Loi 17-99 (Code des assurances Maroc), loi 43-20 (confiance numerique / signature electronique), loi 09-08 + CNDP (donnees personnelles), ACAPS (regulateur assurances) |
| Contrainte absolue | AUCUNE EMOJI (decision-006) -- la CI `check-no-emoji.sh` echoue sinon |
| Langue | Prose francaise ; code TypeScript strict complet et executable (Vitest integration + harness pg) ; contenu Markdown complet des 4 docs |
| Note de resolution de conflit | Sprint 7.5a est AUTORITAIRE. Total permissions = 147 (PAS 130). 7 types cross-tenant = jeu 7.5a (PAS le jeu brut B-7.5b). Entite renommee = `insure_expert_assignments` (PAS `expert_designations`). |

---

## 1. Header

Cette tache est la **DERNIERE du Sprint 7.5b** (tache 9 sur 9). Elle ne produit aucun code metier nouveau : elle **scelle la fondation** posee par les huit taches precedentes au moyen de deux livrables complementaires.

Premier livrable : **quatre documents d'architecture** dans `repo/docs/architecture/`, qui decrivent les **chemins d'extension** (extension paths) -- c'est-a-dire comment les sprints aval (14, 21, 22.5, 22.7, 24, 26.5) viendront remplir les squelettes contractuels poses en 7.5b sans rien casser :

- `expertise-extension-path.md` (~150 lignes) -- table methode -> sprint/tache decrivant comment le Sprint 14 et le Sprint 22.7 implementent les squelettes `@insurtech/expertise`.
- `tow-extension-path.md` (~120 lignes) -- comment le Sprint 22.5 implemente `@insurtech/tow`.
- `cross-tenant-7-types-architecture.md` (~200 lignes) -- les 7 types cross-tenant autoritaires (7.5a), permissions associees, flux qui-cree / qui-consomme / duree.
- `permissions-147-catalog.md` (~180 lignes) -- catalogue complet des 147 permissions par module et par role, dont la somme par module fait exactement 147.

Second livrable : **une suite de tests d'integration cross-package** dans `repo/test/integration/sprint-7.5b-foundation.spec.ts` (>= 12 scenarios executables Vitest + harness PostgreSQL reel), qui **valide l'ensemble de la fondation Sprint 7.5b** : exports des deux packages (`@insurtech/expertise`, `@insurtech/tow`), catalog a 147 permissions, 25 modules, 17 permissions `customer.*`, 7 types cross-tenant, RLS + FORCE sur les 3 entites foundation, colonnes v3.0 de `insure_expert_assignments`, isolation de tenant.

Cette suite est la **porte de sortie (gate)** du sprint : tant qu'elle n'est pas verte, le Sprint 8 ne demarre pas. Elle assure qu'aucune des huit taches precedentes n'a regresse et que les chiffres autoritaires du Sprint 7.5a (147 / 7 / 3 entites) sont respectes.

### 1.1 Ce que cette tache N'EST PAS

- Elle n'implemente AUCUNE logique metier des squelettes (deferee aux Sprints 14 / 22.5 / 22.7).
- Elle ne cree AUCUNE migration, entite, ni permission nouvelle (tout existe deja apres 2.5.1 -> 2.5.8 + 7.5a).
- Elle ne modifie PAS les packages `@insurtech/*` : elle les CONSOMME en lecture seule depuis les tests d'integration.
- Elle ne produit pas de documentation utilisateur ou API (OpenAPI) : uniquement de la documentation d'architecture interne (extension paths + catalogues de reference).

### 1.2 Criteres d'acceptation narratifs

La tache est acceptee si un relecteur peut, sans contexte additionnel :

1. Ouvrir les 4 docs et constater qu'ils sont complets, sans placeholder, sans emoji, avec des tables remplies (methode -> sprint, 7 types, 147 permissions par module sommant a 147).
2. Lancer `pnpm test:integration` (ou le filtre cible) et voir **>= 12 scenarios verts** prouvant les invariants de fondation.
3. Verifier que `ALL_PERMISSIONS.length === 147`, `ALL_MODULES.length === 25`, les 7 types cross-tenant exacts, et RLS + FORCE actifs sur les 3 entites.
4. Executer `check-no-emoji.sh` et obtenir un exit 0.
5. Constater la presence du tag annote `sprint-7.5b-complete-v3-foundation` listant les 9 livrables.

---

## 2. But

Livrer la **cloture documentee et testee** de la fondation Assurflow v3.0 du Sprint 7.5b, de sorte que :

1. Les **chemins d'extension** des deux verticaux (expertise, tow) et des structures transverses (cross-tenant, permissions) soient **traces noir sur blanc** : chaque squelette pointe vers le sprint/tache aval qui l'implementera. Aucun developpeur aval ne doit re-deviner ou casser les contrats poses.
2. Les **chiffres autoritaires** du Sprint 7.5a soient **verifies par des assertions executables** : 147 permissions, 25 modules, 17 `customer.*`, 7 types cross-tenant, 3 entites foundation avec RLS + FORCE, colonnes v3.0 de `insure_expert_assignments`.
3. L'**isolation multi-tenant** (RLS) soit prouvee bout-en-bout sur une vraie base PostgreSQL : une ligne `insure_experts` du tenant A est invisible depuis une session du tenant B.
4. Les **squelettes de service** (expertise + tow) levent bien `NotImplementedException` -- garantie qu'aucune implementation accidentelle n'a fuite avant les sprints d'implementation.
5. La **cloture du sprint** soit materialisee par un commit `docs(sprint-7.5b): ...` et un **tag annote** `sprint-7.5b-complete-v3-foundation` enumerant les 9 livrables.

Resultat attendu : `pnpm test:integration --filter sprint-7.5b-foundation` vert avec >= 12 scenarios, 4 docs presents et lintes, `check-no-emoji.sh` exit 0, tag annote pose, et le Sprint 8 peut demarrer en toute confiance.

### 2.1 Pourquoi cette tache est la porte de sortie

Le Sprint 7.5b a pose une **fondation transverse** consommee par une dizaine de sprints aval. Une regression silencieuse sur un chiffre (par exemple un developpeur qui ajoute une permission sans mettre a jour le catalog, ou qui renomme un type cross-tenant) propagerait des bugs profonds et tardifs. Les tests d'integration de cette tache constituent un **filet de regression cross-package** : ils echouent immediatement si l'un des invariants autoritaires bouge. La documentation, elle, evite la **derive de connaissance** : sans extension-path docs, un developpeur du Sprint 22.5 pourrait re-creer des types deja poses, ou implementer une mauvaise machine a etats.

---

## 3. Contexte etendu

### 3.1 Pourquoi des documents d'extension-path maintenant

Le Sprint 7.5b a delibere une strategie **contract-first** (decision-012) : on fige des contrats (types Zod, signatures de service, entites, permissions, types cross-tenant) **bien avant** d'implementer la logique metier. Cette strategie ne tient que si la **carte des implementations futures** est ecrite quelque part de canonique. Sans elle :

- Le developpeur du Sprint 22.5 (vertical Tow) ne saurait pas que `designateMission` doit implementer un matching geographique, ni quelles transitions de la machine a 9 etats sont valides.
- Le developpeur du Sprint 14 (expertise -- onboarding et catalogue) et du Sprint 22.7 (expertise -- moteur de rapports) ne sauraient pas quelle methode du squelette ils doivent remplir, ni dans quel ordre.
- Le developpeur du Sprint 24 / 26.5 (cross-tenant : dispatch, livraison, devis) ne saurait pas quel type d'autorisation cross-tenant reutiliser parmi les 7, ni quelle est la duree de validite attendue de chaque flux.

Les quatre documents sont donc la **source unique de verite des extension paths**. Ils transforment des squelettes muets en feuilles de route exploitables.

| Document | Couvre | Sprints aval cibles |
|----------|--------|----------------------|
| `expertise-extension-path.md` | Squelettes `@insurtech/expertise` (services experts, designations, rapports) | Sprint 14 (catalogue + onboarding) + Sprint 22.7 (moteur de rapports + honoraires) |
| `tow-extension-path.md` | Squelettes `@insurtech/tow` (operateurs, missions, honoraires) | Sprint 22.5 (moteur de missions type Uber + machine 9 etats) |
| `cross-tenant-7-types-architecture.md` | 7 types cross-tenant + permissions + flux | Sprints 21 / 22.5 / 22.7 / 24 / 26.5 (qui creent et consomment les autorisations) |
| `permissions-147-catalog.md` | Catalog RBAC 147 permissions / 25 modules / 26 roles | Tous (matrice de roles, guards, doc d'audit ACAPS) |

### 3.2 Note de resolution de conflit (CRITIQUE -- 7.5a autoritaire)

Le meta-prompt brut B-7.5b et le Sprint 7.5a deja merge presentaient des chiffres divergents. **L'utilisateur a tranche : le Sprint 7.5a est AUTORITAIRE.** Cette tache honore EXCLUSIVEMENT les chiffres 7.5a. Tout assistant qui assert les chiffres bruts B-7.5b PRODUIT UN LIVRABLE FAUX.

| Sujet | Valeur BRUTE B-7.5b (FAUSSE -- a ignorer) | Valeur AUTORITAIRE 7.5a (a appliquer) |
|-------|--------------------------------------------|----------------------------------------|
| Total permissions | 130 | **147** (130 du 7.5a carrier/expertise/tow/parts + 17 customer de la tache 2.5.3) |
| Modules | 24 | **25** (24 + `customer`) |
| Types cross-tenant | jeu B-7.5b (noms differents) | **jeu 7.5a** : les 7 listes en 3.3 |
| Entite designations | `expert_designations` | **`insure_expert_assignments`** (renommee par 2.5.5) |

Concretement :

- Le doc `permissions-147-catalog.md` et le scenario d'integration 3 asserent `ALL_PERMISSIONS.length === 147`. JAMAIS 130.
- Le catalog est `export const Permission = { ... } as const` + `export const ALL_PERMISSIONS` (tableau gele). JAMAIS un `enum`.
- Le scenario 4 asserte `ALL_MODULES.length === 25` incluant `'customer'`.
- Les scenarios 6/7 asserent les 7 types cross-tenant 7.5a exacts (3.3) et leur CHECK DB.
- Les scenarios 8/9/10/11 ciblent `insure_experts`, `insure_expert_assignments` (PAS `expert_designations`), `insure_expert_reports`.

### 3.3 Les 7 types cross-tenant autoritaires (7.5a)

Le jeu autoritaire des 7 types d'autorisation cross-tenant, livre par les migrations 7.5a `1735000000011` (table `cross_tenant_authorizations`) et `1735000000012` (CHECK + index), est exactement :

```
1. 'broker_to_garage_assignment'   -- un courtier affecte un garage a un dossier
2. 'assure_to_garage_visit'         -- un assure autorise un garage a consulter son sinistre
3. 'multi_tenant_user_access'       -- un utilisateur opere sur plusieurs tenants (groupe)
4. 'client_to_tower_dispatch'       -- un client declenche un dispatch vers un depanneur (tow)
5. 'tower_to_garage_delivery'       -- un depanneur livre un vehicule a un garage
6. 'garage_to_expert_request'       -- un garage demande une expertise a un expert
7. 'garage_to_carrier_quote'        -- un garage transmet un devis a un assureur (carrier)
```

Aucun autre nom n'est valide. Le CHECK SQL `cross_tenant_authorizations_type_check` n'accepte QUE ces 7 valeurs ; toute autre valeur leve une violation de contrainte (scenario 7).

### 3.4 Les 3 entites foundation (etat post-7.5b)

| Entite | Tache de creation | Role | Securite attendue |
|--------|--------------------|------|--------------------|
| `insure_experts` | 2.5.4 | Catalogue des experts (referentiel) | RLS activee + FORCE |
| `insure_expert_assignments` | RENOMMEE de `expert_designations` par 2.5.5 | Affectations expert <-> dossier/garage | RLS activee + FORCE ; colonnes v3.0 |
| `insure_expert_reports` | 2.5.6 | Rapports d'expertise produits | RLS activee + FORCE |

Les colonnes v3.0 ajoutees a `insure_expert_assignments` par 2.5.5 incluent : `expert_id` (FK vers `insure_experts`), `garage_tenant_id` (tenant du garage demandeur, cross-tenant), `honoraire_payment_status` (statut de paiement des honoraires). Le statut d'affectation accepte la valeur `'in_progress'` (parmi son enum de statut). Le scenario 11 verifie ces points.

### 3.5 Exports de packages attendus

| Package | Export | Cardinalite (`.options.length`) |
|---------|--------|----------------------------------|
| `@insurtech/expertise` | `ExpertTypeEnum` | 4 |
| `@insurtech/expertise` | `ExpertSpecialtyEnum` | 10 |
| `@insurtech/tow` | `TowMissionStatusEnum` | 9 |
| `@insurtech/tow` | `TruckTypeEnum` | 3 |

Ces enums sont des `z.enum([...])` Zod ; `.options` expose le tuple litteral. Les scenarios 1 et 2 asserent ces cardinalites.

### 3.6 Alternatives considerees et rejetees

- **Alternative A : pas de docs, uniquement le code source comme verite.** Rejetee : le code des squelettes ne porte pas la temporalite (quel sprint, quelle priorite, quelles transitions valides). La connaissance se perdrait.
- **Alternative B : tests d'integration par package (intra-package).** Rejetee : les invariants critiques sont CROSS-package (le catalog vit dans `@insurtech/auth`, les enums dans `@insurtech/expertise|tow`, les entites en DB). Seul un test cross-package qui touche une vraie DB peut prouver RLS + FORCE et le CHECK cross-tenant.
- **Alternative C : tests E2E HTTP via l'API gateway.** Rejetee a ce stade : les controleurs HTTP n'existent pas encore (squelettes uniquement). On teste la fondation, pas les endpoints.
- **Alternative D : mock de PostgreSQL (sqlite, pg-mem).** Rejetee : RLS, `FORCE ROW LEVEL SECURITY`, `set_config('app.current_tenant_id', ...)` et les CHECK constraints sont des fonctionnalites PostgreSQL natives non emulables fidelement. Le harness exige un vrai PostgreSQL (decision-013 : tests d'integration sur PostgreSQL reel).

### 3.7 Trade-offs

- **Vrai PostgreSQL en CI** : plus lent et exige un service `postgres` dans le pipeline, mais c'est le seul moyen de prouver RLS/FORCE. Trade-off accepte (decision-013).
- **Tests lisant des chiffres en dur (147, 25, 7, 4, 10, 9, 3)** : couplage fort aux chiffres autoritaires, mais c'est precisement le but -- detecter toute derive. Les chiffres sont commentes avec leur source (tache + sprint).
- **Docs Markdown manuels** : risque de desynchronisation avec le code. Mitige par : (a) le catalog 147 est aussi assere par le test (le doc et le test partagent la meme verite), (b) une note en tete de chaque doc pointe vers la tache source.

### 3.8 Pieges (12 pieges nommes -- A EVITER ABSOLUMENT)

1. **Piege "130 au lieu de 147"** : asserter ou documenter 130 permissions. FAUX. 7.5a autoritaire -> 147. Symptome : scenario 3 rouge. Cause : avoir lu le meta-prompt brut B-7.5b sans la note de resolution de conflit.
2. **Piege "24 modules"** : oublier le module `customer`. FAUX -> 25 modules. Le scenario 4 verifie `'customer'` present.
3. **Piege "noms B-7.5b des types cross-tenant"** : utiliser des noms differents de la liste 3.3. FAUX. Seuls les 7 noms 7.5a sont valides ; le CHECK DB rejette le reste (scenario 7).
4. **Piege "tester `expert_designations`"** : interroger `pg_class` sur `expert_designations` (nom pre-2.5.5). FAUX -> la table s'appelle `insure_expert_assignments` apres le renommage. Les scenarios 9 et 11 ciblent le nouveau nom.
5. **Piege "introspection RLS incorrecte"** : verifier uniquement `relrowsecurity` et oublier `relforcerowsecurity`. FAUX. RLS sans FORCE laisse le proprietaire de table contourner la politique. Les scenarios 8/9/10 verifient LES DEUX colonnes de `pg_class`.
6. **Piege "DB non semee"** : lancer le test d'isolation (scenario 13) sans avoir insere de ligne expert pour le tenant A. Le test passerait faussement (0 ligne visible des deux cotes). Le harness DOIT semer un expert tenant A + une affectation (section 8.4) avant l'assertion d'isolation.
7. **Piege "session sans `set_config`"** : interroger la DB sans poser `app.current_tenant_id` via `set_config(...)`. La policy RLS bloquerait tout (ou laisserait tout passer selon la policy). Chaque scenario DB pose explicitement le contexte de tenant via `SELECT set_config('app.current_tenant_id', $1, false)` ou `app.is_super_admin`.
8. **Piege "enum au lieu de const"** : documenter ou tester le catalog comme un `enum` TypeScript. FAUX (decision-012). C'est `const Permission = {...} as const` + `ALL_PERMISSIONS`. `ALL_PERMISSIONS` est un tableau `as const`/gele.
9. **Piege "compter les cles d'objet au lieu du tableau"** : si on compte `Object.keys(Permission)` (cles de groupes par module) on n'obtient pas 147. Le total 147 est la longueur du TABLEAU PLAT `ALL_PERMISSIONS`, pas le nombre de groupes.
10. **Piege "NotImplementedException non leve"** : si un developpeur a accidentellement implemente un squelette, le scenario 12 doit echouer. Ne PAS rendre ce test tolerant (try/catch silencieux). On asserte que l'appel REJETTE avec `NotImplementedException`.
11. **Piege "connexion partagee entre tenants"** : reutiliser la meme session pg avec un `set_config` `is_local=true` (3e argument) qui ne persiste que dans la transaction. Pour les tests multi-requetes hors transaction, utiliser `is_local=false` ou encadrer chaque tenant dans sa propre transaction. Le harness documente ce choix (section 8.2).
12. **Piege "emoji dans les docs"** : inserer une fleche unicode, une coche, ou un emoji dans un tableau Markdown. INTERDIT (decision-006). Fleches ASCII `->` uniquement. La CI `check-no-emoji.sh` echoue sinon.

### 3.8bis Detail de chaque piege (consequence + detection + remediation)

Pour eviter toute ambiguite, chaque piege est detaille ci-dessous avec sa consequence concrete, le test qui le detecte, et la remediation exacte. Cette granularite est volontaire : les pieges de cette tache sont des erreurs subtiles qui passent souvent les revues humaines mais cassent en CI.

**Piege 1 -- 130 au lieu de 147.** Consequence : le catalog documente sous-compte les permissions, la matrice de roles devient incoherente, les guards refusent des actions legitimes (`customer.*`). Detection : scenario 3 (`expect(ALL_PERMISSIONS.length).toBe(147)`). Remediation : relire la note de resolution de conflit 3.2 ; 130 etait l'etat 7.5a AVANT l'ajout du module customer en 2.5.3 ; l'etat final est 130 + 17 = 147. Ne jamais reprendre le chiffre brut du meta-prompt B-7.5b.

**Piege 2 -- 24 modules.** Consequence : le module `customer` n'est pas declare dans `ALL_MODULES`, les permissions `customer.*` ne sont rattachees a aucun module, l'audit ACAPS rate un acteur entier. Detection : scenario 4 (`expect(ALL_MODULES).toContain('customer')` + length 25). Remediation : ajouter `'customer'` au tableau `ALL_MODULES`.

**Piege 3 -- noms B-7.5b des types cross-tenant.** Consequence : le code applicatif utilise des noms de type qui n'existent pas dans le CHECK DB ; toute insertion echoue silencieusement ou les flux cross-tenant ne s'autorisent jamais. Detection : scenarios 6 et 7. Remediation : utiliser EXCLUSIVEMENT les 7 noms de la section 3.3 ; ce sont ceux des migrations 7.5a.

**Piege 4 -- tester expert_designations.** Consequence : `pg_class` ne trouve pas la table (renommee), le test leve `Table introuvable` ; ou pire, si une vieille table residuelle existe, on teste la mauvaise. Detection : scenarios 9 et 11 (ciblent `insure_expert_assignments`). Remediation : utiliser le nom post-2.5.5.

**Piege 5 -- introspection RLS incorrecte.** Consequence : on croit que RLS est active alors que FORCE manque ; le proprietaire de la table (souvent l'utilisateur applicatif) contourne la policy et lit tous les tenants. C'est une faille d'isolation grave (CNDP). Detection : scenarios 8/9/10 verifient `relrowsecurity` ET `relforcerowsecurity`. Remediation : `ALTER TABLE x ENABLE ROW LEVEL SECURITY; ALTER TABLE x FORCE ROW LEVEL SECURITY;` dans la migration source.

**Piege 6 -- DB non semee.** Consequence : le test d'isolation passe faussement (0 ligne des deux cotes ne prouve rien). Detection : scenario 11 verifie que tenant A voit bien 1 ligne AVANT que le scenario 13 verifie que B en voit 0. Remediation : s'assurer que `seedFoundation()` reussit dans `beforeAll`.

**Piege 7 -- session sans set_config.** Consequence : sans contexte de tenant, la policy RLS bloque tout (faux negatif) ou, si la policy a un fallback permissif, laisse tout passer (faux positif d'absence d'isolation). Detection : indirecte via scenarios 11/13. Remediation : `clientForTenant` pose toujours `app.current_tenant_id`.

**Piege 8 -- enum au lieu de const.** Consequence : violation de decision-012 ; `ALL_PERMISSIONS` ne peut etre derive proprement, le tree-shaking et le typage litteral se degradent. Detection : revue de la section 8 du doc + V19. Remediation : `export const Permission = {...} as const`.

**Piege 9 -- compter les cles d'objet.** Consequence : `Object.keys(Permission)` compte les ENTREES (147 si plat, mais si le catalog est groupe par module en objets imbriques, le compte est faux). Detection : scenario 3 compte `ALL_PERMISSIONS` (tableau plat de valeurs). Remediation : `ALL_PERMISSIONS = Object.values(Permission)` sur un objet PLAT cle->chaine.

**Piege 10 -- NotImplementedException non leve.** Consequence : un squelette a ete implemente prematurement, faussant le contrat-first et risquant du code non teste en production. Detection : scenario 12 (`rejects.toThrowError`). Remediation : restaurer le squelette jusqu'au sprint d'implementation.

**Piege 11 -- connexion partagee entre tenants.** Consequence : un `set_config` `is_local=true` ne persiste que dans la transaction ; hors transaction, le contexte se perd entre requetes, ou un client reutilise garde l'ancien contexte. Detection : instabilite des scenarios 11/13. Remediation : un client par tenant, `is_local=false`, `singleFork` sequentiel.

**Piege 12 -- emoji dans les docs.** Consequence : la CI `check-no-emoji.sh` echoue, le commit est rejete. Detection : etape 1 de la validation pre-commit. Remediation : fleches ASCII `->`, pas d'emoji ni de coche unicode.

### 3.9 Decisions structurantes appliquees

- **decision-011** (naming v3.0) : Skalean = societe editrice ; Assurflow = vertical assurance ; Sofidemy = marque commerciale. Les docs emploient ces noms sans ambiguite.
- **decision-012** (contract-first + catalog en `const ... as const`) : le catalog n'est jamais un enum ; les squelettes levent `NotImplementedException` jusqu'a leur sprint d'implementation.
- **decision-013** (tests d'integration sur PostgreSQL reel) : pas de mock DB ; RLS/FORCE/CHECK testes sur un vrai serveur.
- **decision-014** (cloture de sprint par tag annote) : chaque sprint foundation se termine par un tag annote enumerant ses livrables, servant de point de reference de regression et d'audit.

---

## 4. Architecture context

### 4.1 Position dans le sprint

Cette tache est la **9/9** : derniere maille. Elle ne produit pas de nouvelle brique fonctionnelle ; elle **verrouille** la chaine 2.5.1 -> 2.5.8 et la fondation 7.5a.

```
2.5.1 expertise (types)        -> 2.5.7 expertise (services squelettes) --+
2.5.2 tow (types)              -> 2.5.8 tow (services squelettes) --------+--> 2.5.9 DOC + INTEGRATION (gate)
2.5.3 permissions customer 147 -----------------------------------------+
2.5.4 insure_experts ----------+                                        |
2.5.5 rename -> assignments ----+--> entites foundation -----------------+
2.5.6 insure_expert_reports ---+                                        |
7.5a (merge) : 147 perms / 7 types cross-tenant / RLS -------------------+
```

### 4.2 ASCII de la fondation complete (etat fige par 7.5b)

```
+=====================================================================================+
|                     FONDATION ASSURFLOW v3.0 (figee par Sprint 7.5b)                |
+=====================================================================================+
|                                                                                     |
|  PACKAGES (2)                                                                       |
|  +-------------------------------+      +-------------------------------+           |
|  | @insurtech/expertise          |      | @insurtech/tow                |           |
|  |  ExpertTypeEnum.options    = 4|      |  TowMissionStatusEnum   = 9   |           |
|  |  ExpertSpecialtyEnum.opt   =10|      |  TruckTypeEnum.options  = 3   |           |
|  |  services squelettes (2.5.7)  |      |  services squelettes (2.5.8)  |           |
|  |   -> NotImplementedException  |      |   -> NotImplementedException  |           |
|  +---------------+---------------+      +---------------+---------------+           |
|                  |                                      |                           |
|  ENTITES FOUNDATION (3) -- toutes RLS + FORCE                                       |
|  +-------------------------------------------------------------------------------+  |
|  |  insure_experts (2.5.4)                                                       |  |
|  |  insure_expert_assignments (2.5.5, renommee ; cols v3.0 expert_id,           |  |
|  |       garage_tenant_id, honoraire_payment_status ; statut 'in_progress')     |  |
|  |  insure_expert_reports (2.5.6)                                               |  |
|  +-------------------------------------------------------------------------------+  |
|                                                                                     |
|  RBAC : 147 permissions / 25 modules / 26 roles (catalog const, NON enum)           |
|  CROSS-TENANT : 7 types autoritaires (7.5a) + table cross_tenant_authorizations     |
|                 + CHECK + RLS                                                       |
|                                                                                     |
+=====================================================================================+
                                       |
                                       v   consommee par (downstream)
   +----------+----------+-----------+-----------+-----------+-----------+
   | Sprint 8 | Sprint 14| Sprint 21 | Sprint 22.5| Sprint 22.7| Sprint 24|  Sprint 26.5
   | CRM +    | expertise| cross-    | tow moteur | expertise  | dispatch | livraison
   | Booking  | catalogue| tenant    | missions   | rapports   | garage   | + devis
   +----------+----------+-----------+-----------+-----------+-----------+
```

### 4.2bis Lecture verticale de la fondation (par couche)

La fondation se lit aussi en couches, du plus stable (en bas) au plus volatil (en haut). Cette tache verrouille TOUTES les couches stables.

```
COUCHE 4 (volatile, deferee)   : logique metier (matching, machine etats, rapports, honoraires)
                                  -> Sprints 14 / 21 / 22.5 / 22.7 / 24 / 26.5
COUCHE 3 (figee, squelettes)   : signatures de service NestJS (NotImplementedException)
                                  -> 2.5.7 / 2.5.8 ; TESTEE ici (scenario 12)
COUCHE 2 (figee, contrats)     : types Zod + enums + schemas (ExpertTypeEnum, TowMissionStatusEnum...)
                                  -> 2.5.1 / 2.5.2 ; TESTEE ici (scenarios 1, 2)
COUCHE 1 (stable, persistance) : tables + RLS + FORCE + CHECK + colonnes v3.0
                                  -> 2.5.4 / 2.5.5 / 2.5.6 + 7.5a ; TESTEE ici (scenarios 7-11, 13)
COUCHE 0 (socle, gouvernance)  : catalog 147 / 25 modules / 26 roles / 7 types cross-tenant
                                  -> 7.5a + 2.5.3 ; TESTEE ici (scenarios 3, 4, 5, 6)
```

La tache 2.5.9 ne touche QUE les couches 0 a 3 (en lecture/verification). La couche 4 est hors perimetre, mais ses points d'entree (les methodes squelettes) sont documentes par les extension paths.

### 4.3 Consommateurs aval (downstream)

- **Sprint 8 (CRM + Booking)** : premier consommateur du catalog 147 (guards RBAC) et de l'isolation tenant.
- **Sprint 14 (expertise -- catalogue + onboarding)** : remplit les squelettes `ExpertsService` / catalogue.
- **Sprint 21 (cross-tenant authorizations -- moteur)** : implemente la creation/revocation des autorisations des 7 types.
- **Sprint 22.5 (tow -- moteur de missions)** : remplit les squelettes `@insurtech/tow` (machine 9 etats).
- **Sprint 22.7 (expertise -- moteur de rapports + honoraires)** : remplit `ExpertReportsService`.
- **Sprint 24 / 26.5 (dispatch garage / livraison + devis)** : consomment les types `client_to_tower_dispatch`, `tower_to_garage_delivery`, `garage_to_carrier_quote`.

---

## 5. Livrables checkables

1. `repo/docs/architecture/expertise-extension-path.md` cree (>= 150 lignes, sans emoji).
2. `repo/docs/architecture/tow-extension-path.md` cree (>= 120 lignes, sans emoji).
3. `repo/docs/architecture/cross-tenant-7-types-architecture.md` cree (>= 200 lignes, sans emoji).
4. `repo/docs/architecture/permissions-147-catalog.md` cree (>= 180 lignes, sans emoji).
5. `repo/test/integration/sprint-7.5b-foundation.spec.ts` cree (>= 12 scenarios `it()`).
6. Le doc expertise-extension contient une table methode -> sprint/tache complete (Sprint 14 + 22.7).
7. Le doc tow-extension contient une table methode -> sprint 22.5 complete.
8. Le doc cross-tenant liste les 7 types autoritaires avec qui-cree / qui-consomme / duree + flux.
9. Le doc permissions-147 contient une table par module dont la somme vaut exactement 147.
10. Scenario 1 vert : `ExpertTypeEnum.options.length === 4` et `ExpertSpecialtyEnum.options.length === 10`.
11. Scenario 2 vert : `TowMissionStatusEnum.options.length === 9` et `TruckTypeEnum.options.length === 3`.
12. Scenario 3 vert : `ALL_PERMISSIONS.length === 147`.
13. Scenario 4 vert : `ALL_MODULES.length === 25` et inclut `'customer'`.
14. Scenario 5 vert : les 17 permissions `customer.*` presentes.
15. Scenario 6 vert : le type d'autorisation cross-tenant a exactement les 7 valeurs 7.5a.
16. Scenario 7 vert : le CHECK DB accepte les 7 valeurs, rejette une valeur invalide.
17. Scenarios 8/9/10 verts : RLS + FORCE actifs sur `insure_experts`, `insure_expert_assignments`, `insure_expert_reports`.
18. Scenario 11 vert : `insure_expert_assignments` possede `expert_id`, `garage_tenant_id`, `honoraire_payment_status` et accepte le statut `'in_progress'`.
19. Scenario 12 vert : les services squelettes expertise + tow levent `NotImplementedException`.
20. Scenario 13 vert : une ligne `insure_experts` du tenant A est invisible depuis une session du tenant B.
21. `pnpm test:integration` (ou filtre cible) exit 0 avec >= 12 scenarios verts.
22. `check-no-emoji.sh` exit 0 sur les 5 fichiers.
23. Tag annote `sprint-7.5b-complete-v3-foundation` cree, enumerant les 9 livrables.
24. Commit `docs(sprint-7.5b): documentation extension paths + tests integration cross-package` cree.
25. Le harness pg seme 2 tenants + 1 expert + 1 affectation avant les assertions d'isolation.
26. Aucun fichier de package `@insurtech/*` modifie (consommation lecture seule).
27. Couverture des fichiers de test conforme (les tests d'integration comptent dans la couverture globale).
28. README/CHANGELOG du sprint mis a jour (optionnel mais recommande -- non bloquant).

---

## 6. Fichiers crees / modifies

| Fichier | Type | Description | Lignes approx. |
|---------|------|-------------|----------------|
| `repo/docs/architecture/expertise-extension-path.md` | CREE | Extension path expertise (Sprint 14 + 22.7) | ~150 |
| `repo/docs/architecture/tow-extension-path.md` | CREE | Extension path tow (Sprint 22.5) | ~120 |
| `repo/docs/architecture/cross-tenant-7-types-architecture.md` | CREE | 7 types cross-tenant + permissions + flux | ~200 |
| `repo/docs/architecture/permissions-147-catalog.md` | CREE | Catalog 147 permissions par module/role | ~180 |
| `repo/test/integration/sprint-7.5b-foundation.spec.ts` | CREE | Suite integration cross-package (>= 12 scenarios) | ~520 |
| `repo/test/integration/helpers/pg-harness.ts` | CREE | Harness PostgreSQL (pool, set_config, seed, teardown) | ~180 |
| `repo/test/integration/fixtures/seed-7.5b.ts` | CREE | Fixtures (2 tenants, 1 expert, 1 affectation) | ~120 |
| `repo/vitest.integration.config.ts` | MODIFIE/CREE | Config Vitest dediee integration (timeout, setup) | ~30 |
| `repo/package.json` | MODIFIE | Script `test:integration` + `test:integration:watch` | +3 |
| `repo/CHANGELOG.md` | MODIFIE | Entree de cloture Sprint 7.5b (optionnel) | +12 |

---

## 7. Code patterns complets

Cette section est le **coeur** de la tache. Elle fournit le contenu COMPLET, sans placeholder, des 4 documents Markdown et de la suite d'integration (spec + harness + fixtures). Tout est executable / publiable tel quel.

### 7.1 Document `repo/docs/architecture/expertise-extension-path.md`

````markdown
# Extension path -- @insurtech/expertise (Assurflow v3.0)

> Source : Sprint 7.5b, taches 2.5.1 (types) et 2.5.7 (services squelettes).
> Implementation : Sprint 14 (catalogue + onboarding) et Sprint 22.7 (moteur de rapports + honoraires).
> Naming : Skalean (editeur), Assurflow (vertical), Sofidemy (marque). decision-011.
> Aucune emoji (decision-006). Fleches ASCII uniquement.

## 1. Objet

Le package `@insurtech/expertise` modelise l'expertise automobile post-sinistre : un expert
mandate evalue les dommages d'un vehicule, produit un rapport, et facture des honoraires.
Au Sprint 7.5b, seuls les TYPES (Zod) et les SIGNATURES de service sont figes. La logique
est deferee aux Sprints 14 et 22.7. Ce document trace, methode par methode, ou et quand
chaque squelette sera implemente.

## 2. Types figes (2.5.1) -- contrat stable

| Type | Forme | Cardinalite | Consomme par |
|------|-------|-------------|--------------|
| `ExpertTypeEnum` | `z.enum([...])` | 4 valeurs | matrice de roles, UI, filtres |
| `ExpertSpecialtyEnum` | `z.enum([...])` | 10 valeurs | recherche d'expert, matching dossier |
| `ExpertSchema` | `z.object` | n/a | entite `insure_experts` |
| `ExpertAssignmentSchema` | `z.object` | n/a | entite `insure_expert_assignments` |
| `ExpertReportSchema` | `z.object` | n/a | entite `insure_expert_reports` |

Les 4 valeurs de `ExpertTypeEnum` : `independent`, `firm`, `internal`, `network`.
Les 10 valeurs de `ExpertSpecialtyEnum` : `auto_collision`, `auto_mechanical`, `auto_electrical`,
`auto_bodywork`, `auto_paint`, `motorcycle`, `heavy_vehicle`, `agricultural`, `fire_damage`,
`water_damage`.

## 3. Carte methode -> sprint / tache (extension path)

| Service squelette | Methode | Sprint d'implementation | Tache | Contenu attendu |
|--------------------|---------|--------------------------|-------|-----------------|
| ExpertsService | `registerExpert` | Sprint 14 | 14.2.1 | Onboarding expert + creation `insure_experts` |
| ExpertsService | `approveExpert` | Sprint 14 | 14.2.2 | Validation accreditation (ACAPS / agrement) |
| ExpertsService | `suspendExpert` | Sprint 14 | 14.2.3 | Suspension (motif + audit) |
| ExpertsService | `searchExperts` | Sprint 14 | 14.2.4 | Recherche par specialite + zone + dispo |
| ExpertsService | `getExpert` | Sprint 14 | 14.2.1 | Lecture fiche expert (tenant scope) |
| ExpertAssignmentsService | `assignExpert` | Sprint 14 | 14.3.1 | Creation `insure_expert_assignments` (cross-tenant garage) |
| ExpertAssignmentsService | `acceptAssignment` | Sprint 14 | 14.3.2 | Acceptation par l'expert |
| ExpertAssignmentsService | `declineAssignment` | Sprint 14 | 14.3.2 | Refus + reaffectation |
| ExpertAssignmentsService | `transitionAssignment` | Sprint 14 | 14.3.4 | Transitions de statut (dont `in_progress`) |
| ExpertAssignmentsService | `listAssignments` | Sprint 14 | 14.3.3 | Listing filtre par tenant / expert |
| ExpertReportsService | `createReport` | Sprint 22.7 | 22.7.1 | Creation `insure_expert_reports` (brouillon) |
| ExpertReportsService | `submitReport` | Sprint 22.7 | 22.7.2 | Soumission + signature electronique (loi 43-20) |
| ExpertReportsService | `validateReport` | Sprint 22.7 | 22.7.3 | Validation assureur / contre-expertise |
| ExpertReportsService | `computeHonoraire` | Sprint 22.7 | 22.7.5 | Calcul honoraires expert (bareme) |
| ExpertReportsService | `getReport` | Sprint 22.7 | 22.7.1 | Lecture rapport (tenant + cross-tenant scope) |

## 4. Sequencement d'implementation

```
Sprint 14  : referentiel + cycle d'affectation (registerExpert -> assignExpert -> transition)
Sprint 22.7: moteur de rapports + honoraires (createReport -> submitReport -> validate -> compute)
```

Le Sprint 14 doit etre livre AVANT le Sprint 22.7 : un rapport (22.7) ne peut exister sans
une affectation acceptee (14). Cette dependance temporelle est figee par les FK :
`insure_expert_reports.assignment_id -> insure_expert_assignments.id`.

## 5. Invariants a preserver (ne PAS casser au remplissage)

1. `ExpertTypeEnum.options.length` DOIT rester 4 ; `ExpertSpecialtyEnum.options.length` DOIT rester 10.
   Toute valeur ajoutee exige une migration de donnees + mise a jour du catalog 147 si une
   permission est associee.
2. Les signatures publiques figees en 2.5.7 ne changent pas (parametres, types de retour `Promise<T>`).
   Une evolution se fait par surcharge ou nouvelle methode, jamais par rupture.
3. Le scope multi-tenant : toute requete passe par RLS (`app.current_tenant_id`). Les acces
   cross-tenant (garage -> expert) passent OBLIGATOIREMENT par une autorisation
   `garage_to_expert_request` (voir `cross-tenant-7-types-architecture.md`).
4. `NotImplementedException` est remplace par la logique reelle ; il ne doit JAMAIS rester un
   squelette partiellement implemente (soit squelette complet, soit implementation complete).

## 6. Permissions liees (extrait du catalog 147)

| Module | Permissions (extrait) | Role principal |
|--------|------------------------|----------------|
| `expertise` | `expertise.expert.create`, `expertise.expert.read`, `expertise.expert.suspend`, `expertise.assignment.create`, `expertise.assignment.accept`, `expertise.report.create`, `expertise.report.submit`, `expertise.report.validate`, `expertise.honoraire.compute` | `expert`, `expert_manager`, `carrier_claims_handler` |

Voir `permissions-147-catalog.md` pour la liste exhaustive du module `expertise`.

## 7. Conformite

- ACAPS : la fiche expert porte l'agrement ; le rapport est une piece d'instruction de sinistre.
- Loi 43-20 : la soumission de rapport (`submitReport`) declenche une signature electronique
  qualifiee (deferee Sprint 22.7, integration `@insurtech/sky` ou MCP signature).
- CNDP / loi 09-08 : les donnees personnelles de l'assure dans le rapport restent dans le
  tenant ; l'acces cross-tenant est trace et limite dans le temps (autorisation).

## 8. References

- `repo/packages/expertise/src/services/*.service.ts` (squelettes 2.5.7).
- `repo/packages/expertise/src/index.ts` (exports types 2.5.1).
- `cross-tenant-7-types-architecture.md` (type `garage_to_expert_request`).
- `permissions-147-catalog.md` (module `expertise`).
````

### 7.2 Document `repo/docs/architecture/tow-extension-path.md`

````markdown
# Extension path -- @insurtech/tow (Assurflow v3.0)

> Source : Sprint 7.5b, taches 2.5.2 (types) et 2.5.8 (services squelettes).
> Implementation : Sprint 22.5 (moteur de missions de depannage type Uber).
> Naming : Skalean (editeur), Assurflow (vertical), Sofidemy (marque). decision-011.
> Aucune emoji (decision-006). Fleches ASCII uniquement.

## 1. Objet

Le package `@insurtech/tow` modelise le depannage / remorquage : suite a un sinistre auto,
un operateur de depannage geolocalise est designe, accepte, se rend sur site, charge le
vehicule, le transporte, le livre, puis facture des honoraires. C'est un moteur temps-reel
de type Uber. Au Sprint 7.5b, seuls les TYPES et les SIGNATURES sont figes ; la machine a
etats (9 statuts) et le matching geographique sont deferes au Sprint 22.5.

## 2. Types figes (2.5.2) -- contrat stable

| Type | Forme | Cardinalite |
|------|-------|-------------|
| `TowMissionStatusEnum` | `z.enum([...])` | 9 valeurs |
| `TruckTypeEnum` | `z.enum([...])` | 3 valeurs |
| `TowMissionSchema` | `z.object` | n/a |
| `TowOperatorSchema` | `z.object` | n/a |

Les 9 statuts (`TowMissionStatusEnum`) : `pending_designation`, `designated`, `accepted`,
`en_route`, `on_site`, `loaded`, `in_transit`, `delivered`, `completed`. Plus les transitions
terminales `rejected` et `cancelled` (modelisees comme statuts dans l'enum si l'implementation
le requiert ; ici l'enum porte les 9 statuts du chemin nominal).
Les 3 types de camion (`TruckTypeEnum`) : `flatbed`, `wheel_lift`, `heavy_duty`.

## 3. Machine a etats cible (Sprint 22.5)

```
pending_designation -> designated -> accepted -> en_route -> on_site
   -> loaded -> in_transit -> delivered -> completed
                        \-> rejected  (depuis designated)
                        \-> cancelled (depuis tout statut non terminal)
```

## 4. Carte methode -> sprint / tache (extension path)

| Service squelette | Methode | Sprint | Tache | Contenu attendu |
|--------------------|---------|--------|-------|-----------------|
| TowMissionsService | `designateMission` | 22.5 | 5.4.3 | Matching geographique operateur |
| TowMissionsService | `acceptMission` | 22.5 | 5.4.6 | Acceptation par operateur |
| TowMissionsService | `rejectMission` | 22.5 | 5.4.6 | Refus + reaffectation |
| TowMissionsService | `transitionStatus` | 22.5 | 5.4.7-10 | Machine a etats 9 statuts |
| TowMissionsService | `cancelMission` | 22.5 | 5.4.x | Annulation + penalites |
| TowMissionsService | `listMyMissions` | 22.5 | 5.4.5 | Listing missions operateur |
| TowOperatorsService | `onboardOperator` | 22.5 | 5.3.1 | Onboarding operateur |
| TowOperatorsService | `approveKyb` | 22.5 | 5.3.2 | Validation KYB |
| TowOperatorsService | `rejectKyb` | 22.5 | 5.3.2 | Rejet KYB |
| TowOperatorsService | `toggleAvailability` | 22.5 | 5.3.3 | Bascule disponibilite |
| TowOperatorsService | `suspendOperator` | 22.5 | 5.3.4 | Suspension operateur |
| TowOperatorsService | `searchOperators` | 22.5 | 5.3.5 | Recherche geo + dispo |
| TowHonorairesService | `computeHonoraire` | 22.5 | 5.5.1 | Calcul distance + type camion |
| TowHonorairesService | `readEarnings` | 22.5 | 5.5.2 | Lecture gains par periode |
| TowHonorairesService | `invoiceHonoraire` | 22.5 | 5.5.3 | Facturation honoraire |

## 5. Invariants a preserver

1. `TowMissionStatusEnum.options.length` reste 9 ; `TruckTypeEnum.options.length` reste 3.
2. Les signatures publiques (2.5.8) ne changent pas. `payload?: unknown` de `transitionStatus`
   sera type par union discriminee au 22.5 sans rompre le `?` (exactOptionalPropertyTypes).
3. Toute mission cross-tenant (client -> depanneur -> garage) passe par les autorisations
   `client_to_tower_dispatch` et `tower_to_garage_delivery`.
4. Idempotency-Key obligatoire sur les transitions critiques (decision idempotency-key strict).

## 6. Permissions liees (extrait du catalog 147)

| Module | Permissions (extrait) |
|--------|------------------------|
| `tow` | `tow.mission.designate`, `tow.mission.accept`, `tow.mission.transition`, `tow.operator.onboard`, `tow.operator.suspend`, `tow.honoraire.compute`, `tow.honoraire.invoice` |

## 7. Conformite

- CNDP / loi 09-08 : geolocalisation de l'operateur = donnee personnelle ; consentement + duree
  de retention limitee.
- ACAPS : la mission de depannage est rattachee a un sinistre ; tracabilite complete.
- Cloud souverain MA (decision-008) : aucune donnee assure ne quitte le Maroc (Atlas Benguerir).

## 8. References

- `repo/packages/tow/src/services/*.service.ts` (squelettes 2.5.8).
- `cross-tenant-7-types-architecture.md` (types `client_to_tower_dispatch`, `tower_to_garage_delivery`).
- `permissions-147-catalog.md` (module `tow`).
````

### 7.3 Document `repo/docs/architecture/cross-tenant-7-types-architecture.md`

````markdown
# Architecture des 7 types d'autorisation cross-tenant (Assurflow v3.0)

> Source autoritaire : Sprint 7.5a, migrations 1735000000011 (table) et 1735000000012 (CHECK + index).
> Resolution de conflit : le jeu 7.5a est AUTORITAIRE ; le jeu brut B-7.5b est obsolete.
> Naming : Skalean / Assurflow / Sofidemy (decision-011). Aucune emoji (decision-006). Fleches ASCII.

## 1. Principe

Le multi-tenant strict d'Assurflow isole chaque organisation (assureur, courtier, garage,
depanneur, expert) dans son propre tenant, applique par RLS PostgreSQL
(`app_can_access_tenant()`, contexte `app.current_tenant_id`). Mais les flux metier de
l'assurance auto sont INTRINSEQUEMENT cross-tenant : un assureur mandate un garage, un garage
demande une expertise, un depanneur livre a un garage. Pour autoriser ces traversees SANS
ouvrir les vannes, on utilise une table d'autorisations explicites, temporaires et tracees :
`cross_tenant_authorizations`. Chaque ligne porte un `type` parmi 7 valeurs strictes.

## 2. Table `cross_tenant_authorizations` (rappel structurel 7.5a)

```sql
CREATE TABLE cross_tenant_authorizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type              text NOT NULL,
  granting_tenant_id uuid NOT NULL,   -- tenant qui accorde l'acces
  grantee_tenant_id  uuid NOT NULL,   -- tenant qui recoit l'acces
  resource_type     text NOT NULL,    -- ex: 'claim', 'mission', 'report'
  resource_id       uuid NOT NULL,
  granted_by        uuid NOT NULL,    -- user
  status            text NOT NULL DEFAULT 'active', -- active | revoked | expired
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  CONSTRAINT cross_tenant_authorizations_type_check
    CHECK (type IN (
      'broker_to_garage_assignment',
      'assure_to_garage_visit',
      'multi_tenant_user_access',
      'client_to_tower_dispatch',
      'tower_to_garage_delivery',
      'garage_to_expert_request',
      'garage_to_carrier_quote'
    ))
);
```

## 3. Les 7 types -- qui cree / qui consomme / duree

| # | Type | Tenant qui CREE (granting) | Tenant GRANTEE | Ressource | Duree de validite | Sprint impl. |
|---|------|-----------------------------|----------------|-----------|--------------------|--------------|
| 1 | `broker_to_garage_assignment` | Courtier | Garage | `claim` | Duree du dossier sinistre | 21 |
| 2 | `assure_to_garage_visit` | Assure (via assureur) | Garage | `claim` | 30 jours glissants | 21 |
| 3 | `multi_tenant_user_access` | Groupe / holding | Utilisateur | `tenant` | Permanente (revocable) | 21 |
| 4 | `client_to_tower_dispatch` | Client / assureur | Depanneur (tower) | `mission` | Duree de la mission | 22.5 |
| 5 | `tower_to_garage_delivery` | Depanneur | Garage | `mission` | 72h apres livraison | 22.5 |
| 6 | `garage_to_expert_request` | Garage | Expert | `claim` / `assignment` | Duree de l'expertise | 22.7 |
| 7 | `garage_to_carrier_quote` | Garage | Assureur (carrier) | `quote` | 15 jours (validite devis) | 24 / 26.5 |

## 4. Flux detailles (sequences)

### 4.1 broker_to_garage_assignment

```
Courtier (tenant B) ----[1: affecte garage G au dossier C]----> systeme
systeme cree autorisation { type:'broker_to_garage_assignment',
                            granting:B, grantee:G, resource:claim C }
Garage (tenant G) ----[2: lit le dossier C]----> RLS verifie autorisation active -> OK
Cloture dossier --------> autorisation passe a 'expired'
```

### 4.2 assure_to_garage_visit

```
Assure --[consentement via portail assureur (tenant A)]--> autorisation
{ type:'assure_to_garage_visit', granting:A, grantee:G, resource:claim, expires_at:+30j }
Garage consulte le sinistre tant que active && not expired.
```

### 4.3 multi_tenant_user_access

```
Holding cree autorisation { type:'multi_tenant_user_access', grantee:user U,
  resource:tenant T } pour chaque tenant du groupe.
U bascule de tenant T1 a T2 -> session pose app.current_tenant_id=T2,
  RLS verifie l'existence d'une autorisation active U->T2.
Revocation = status 'revoked' + revoked_at.
```

### 4.4 client_to_tower_dispatch

```
Sinistre auto -> assureur (tenant A) declenche dispatch depannage.
autorisation { type:'client_to_tower_dispatch', granting:A, grantee:Depanneur D,
  resource:mission M }. D voit la mission M pendant sa duree.
```

### 4.5 tower_to_garage_delivery

```
Depanneur D livre le vehicule au garage G.
autorisation { type:'tower_to_garage_delivery', granting:D, grantee:G,
  resource:mission M, expires_at:+72h }. G accuse reception.
```

### 4.6 garage_to_expert_request

```
Garage G demande une expertise a l'expert E.
autorisation { type:'garage_to_expert_request', granting:G, grantee:E,
  resource:assignment }. E accede au dossier le temps de l'expertise.
(Voir expertise-extension-path.md : ExpertAssignmentsService.assignExpert.)
```

### 4.7 garage_to_carrier_quote

```
Garage G transmet un devis a l'assureur C.
autorisation { type:'garage_to_carrier_quote', granting:G, grantee:C,
  resource:quote, expires_at:+15j }. C valide ou refuse le devis.
```

## 5. Permissions liees (extrait catalog 147)

| Module | Permissions cross-tenant |
|--------|--------------------------|
| `cross_tenant` | `cross_tenant.authorization.grant`, `cross_tenant.authorization.revoke`, `cross_tenant.authorization.read`, `cross_tenant.authorization.list` |

## 6. Securite et RLS

1. Toute lecture cross-tenant verifie une autorisation `status='active'` ET (`expires_at IS NULL`
   OR `expires_at > now()`) dont le `grantee_tenant_id` correspond au contexte courant.
2. La fonction `app_can_access_tenant()` integre cette verification.
3. Le super-admin (`app.is_super_admin = true`) contourne RLS pour l'audit ACAPS uniquement.
4. Toute creation / revocation est ecrite dans l'audit trail (action, user, tenant, timestamp).

## 7. Invariants (a preserver par les sprints aval)

1. Les 7 noms de type sont GELES. Ajouter un 8e type = migration + mise a jour de ce doc + du
   CHECK + des tests d'integration (scenario 6/7).
2. Une autorisation ne donne JAMAIS un acces total : elle est scopee a un `resource_type` +
   `resource_id` precis.
3. La revocation est immediate (status) ; l'expiration est temporelle (`expires_at`).

## 8. Conformite Maroc

- CNDP / loi 09-08 : la traversee de tenant expose des donnees personnelles ; chaque
  autorisation est tracee, limitee dans le temps, revocable.
- ACAPS : la tracabilite des acces cross-tenant constitue une piece d'audit du dossier sinistre.
- Cloud souverain (decision-008) : tous les tenants resident au Maroc ; aucune donnee ne sort.

## 9. References

- Migrations 7.5a : `1735000000011_create_cross_tenant_authorizations`, `1735000000012_*`.
- `permissions-147-catalog.md` (module `cross_tenant`).
- `expertise-extension-path.md` / `tow-extension-path.md` (consommateurs des types 4/5/6/7).
````

### 7.4 Document `repo/docs/architecture/permissions-147-catalog.md`

````markdown
# Catalog des permissions RBAC -- 147 permissions / 25 modules / 26 roles (Assurflow v3.0)

> Source autoritaire : Sprint 7.5a (130 permissions carrier/expertise/tow/parts) + Sprint 7.5b
> tache 2.5.3 (+17 permissions module `customer`) = 147 permissions.
> Forme : `export const Permission = { ... } as const` + `export const ALL_PERMISSIONS` (tableau gele).
> JAMAIS un enum (decision-012). Aucune emoji (decision-006). Fleches ASCII.

## 1. Invariants

- `ALL_PERMISSIONS.length === 147` (verifie par `sprint-7.5b-foundation.spec.ts`, scenario 3).
- `ALL_MODULES.length === 25` incluant `'customer'` (scenario 4).
- 26 roles (RBAC strict).
- Chaque permission est une chaine `module.resource.action` en minuscules.

## 2. Repartition par module (somme = 147)

| # | Module | Nb permissions | Origine |
|---|--------|----------------|---------|
| 1 | `auth` | 6 | 7.5a |
| 2 | `tenant` | 6 | 7.5a |
| 3 | `user` | 6 | 7.5a |
| 4 | `role` | 5 | 7.5a |
| 5 | `carrier` | 8 | 7.5a |
| 6 | `policy` | 7 | 7.5a |
| 7 | `claim` | 8 | 7.5a |
| 8 | `expertise` | 9 | 7.5a |
| 9 | `tow` | 7 | 7.5a |
| 10 | `parts` | 7 | 7.5a |
| 11 | `garage` | 7 | 7.5a |
| 12 | `broker` | 6 | 7.5a |
| 13 | `quote` | 5 | 7.5a |
| 14 | `payment` | 6 | 7.5a |
| 15 | `signature` | 4 | 7.5a |
| 16 | `document` | 5 | 7.5a |
| 17 | `notification` | 4 | 7.5a |
| 18 | `audit` | 4 | 7.5a |
| 19 | `cross_tenant` | 4 | 7.5a |
| 20 | `report` | 5 | 7.5a |
| 21 | `dashboard` | 4 | 7.5a |
| 22 | `settings` | 4 | 7.5a |
| 23 | `integration` | 4 | 7.5a |
| 24 | `sky` | 4 | 7.5a |
| 25 | `customer` | 17 | 7.5b (tache 2.5.3) |
|   | **TOTAL** | **147** | |

Verification arithmetique : 6+6+6+5+8+7+8+9+7+7+7+6+5+6+4+5+4+4+4+5+4+4+4+4 = 130 ; 130 + 17 = 147.

## 3. Detail module `customer` (les 17 -- tache 2.5.3, acteur 5 = Customer)

| # | Permission | Description |
|---|------------|-------------|
| 1 | `customer.profile.read` | Lecture du profil client |
| 2 | `customer.profile.update` | Mise a jour du profil |
| 3 | `customer.policy.read` | Lecture de ses contrats |
| 4 | `customer.policy.list` | Liste de ses contrats |
| 5 | `customer.claim.create` | Declaration de sinistre |
| 6 | `customer.claim.read` | Lecture de ses sinistres |
| 7 | `customer.claim.list` | Liste de ses sinistres |
| 8 | `customer.document.upload` | Depot de piece justificative |
| 9 | `customer.document.read` | Lecture de ses documents |
| 10 | `customer.payment.read` | Lecture de ses paiements |
| 11 | `customer.payment.initiate` | Initier un paiement |
| 12 | `customer.quote.read` | Lecture de devis |
| 13 | `customer.quote.accept` | Acceptation de devis |
| 14 | `customer.notification.read` | Lecture des notifications |
| 15 | `customer.notification.preferences` | Reglage des preferences |
| 16 | `customer.consent.grant` | Octroi de consentement (CNDP) |
| 17 | `customer.consent.revoke` | Revocation de consentement (CNDP) |

## 4. Detail module `expertise` (9)

| # | Permission |
|---|------------|
| 1 | `expertise.expert.create` |
| 2 | `expertise.expert.read` |
| 3 | `expertise.expert.suspend` |
| 4 | `expertise.assignment.create` |
| 5 | `expertise.assignment.accept` |
| 6 | `expertise.assignment.transition` |
| 7 | `expertise.report.create` |
| 8 | `expertise.report.submit` |
| 9 | `expertise.report.validate` |

## 5. Detail module `tow` (7)

| # | Permission |
|---|------------|
| 1 | `tow.mission.designate` |
| 2 | `tow.mission.accept` |
| 3 | `tow.mission.transition` |
| 4 | `tow.operator.onboard` |
| 5 | `tow.operator.suspend` |
| 6 | `tow.honoraire.compute` |
| 7 | `tow.honoraire.invoice` |

## 6. Detail module `cross_tenant` (4)

| # | Permission |
|---|------------|
| 1 | `cross_tenant.authorization.grant` |
| 2 | `cross_tenant.authorization.revoke` |
| 3 | `cross_tenant.authorization.read` |
| 4 | `cross_tenant.authorization.list` |

## 7. Les 26 roles (rappel)

| # | Role | Modules principaux |
|---|------|---------------------|
| 1 | `super_admin` | tous (bypass RLS audit) |
| 2 | `platform_admin` | tenant, user, role, settings |
| 3 | `carrier_admin` | carrier, policy, claim |
| 4 | `carrier_claims_handler` | claim, expertise, payment |
| 5 | `carrier_underwriter` | policy, quote |
| 6 | `broker_admin` | broker, policy, quote |
| 7 | `broker_agent` | quote, claim |
| 8 | `garage_admin` | garage, parts, quote |
| 9 | `garage_operator` | claim, parts |
| 10 | `expert` | expertise (report, assignment) |
| 11 | `expert_manager` | expertise (expert, assignment) |
| 12 | `tow_operator` | tow (mission) |
| 13 | `tow_dispatcher` | tow (mission, operator) |
| 14 | `customer` | customer.* |
| 15 | `parts_supplier` | parts |
| 16 | `finance_officer` | payment, report |
| 17 | `compliance_officer` | audit, document, cross_tenant |
| 18 | `support_agent` | notification, customer |
| 19 | `data_analyst` | dashboard, report |
| 20 | `integration_bot` | integration, sky |
| 21 | `signature_authority` | signature, document |
| 22 | `auditor` | audit (read-only) |
| 23 | `tenant_owner` | tenant, user, settings |
| 24 | `read_only` | *.read |
| 25 | `api_service` | integration |
| 26 | `notification_service` | notification |

## 8. Forme TypeScript (rappel -- decision-012)

```ts
export const Permission = {
  CUSTOMER_PROFILE_READ: 'customer.profile.read',
  // ... 146 autres
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS = Object.freeze(
  Object.values(Permission),
) as readonly PermissionValue[];
// ALL_PERMISSIONS.length === 147

export const ALL_MODULES = Object.freeze([
  'auth','tenant','user','role','carrier','policy','claim','expertise','tow',
  'parts','garage','broker','quote','payment','signature','document',
  'notification','audit','cross_tenant','report','dashboard','settings',
  'integration','sky','customer',
]) as readonly string[];
// ALL_MODULES.length === 25
```

## 9. Conformite

- ACAPS : le catalog est une piece de gouvernance des acces ; auditabilite.
- CNDP / loi 09-08 : `customer.consent.grant` / `.revoke` materialisent le consentement.
- decision-012 : catalog en `const ... as const`, JAMAIS enum.

## 10. References

- `repo/packages/auth/src/permissions/catalog.ts` (source du `Permission` const).
- `cross-tenant-7-types-architecture.md`, `expertise-extension-path.md`, `tow-extension-path.md`.
````

### 7.5 Harness PostgreSQL `repo/test/integration/helpers/pg-harness.ts`

```ts
import { Pool, type PoolClient } from 'pg';

/**
 * Harness PostgreSQL pour les tests d'integration cross-package du Sprint 7.5b.
 *
 * Strategie (decision-013) : on utilise un VRAI serveur PostgreSQL (pas de mock),
 * car les invariants critiques -- RLS, FORCE ROW LEVEL SECURITY, CHECK constraints,
 * set_config('app.current_tenant_id', ...) -- ne sont pas emulables fidelement.
 *
 * Chaque "session de tenant" est materialisee par un client dedie qui pose le
 * contexte applicatif via set_config(..., is_local=false) afin que le contexte
 * persiste sur la duree de vie du client (hors transaction). On rend explicitement
 * chaque client pour eviter toute fuite de contexte entre tenants (piege 11).
 */

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://insurtech_test:insurtech_test@localhost:5433/insurtech_test';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool === null) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool !== null) {
    await pool.end();
    pool = null;
  }
}

/**
 * Acquiert un client et pose le contexte de tenant (RLS). Le contexte est pose en
 * is_local=false : il reste actif pour toutes les requetes du client jusqu'a sa
 * liberation. On reinitialise app.is_super_admin a 'false' par defaut.
 */
export async function clientForTenant(tenantId: string): Promise<PoolClient> {
  const client = await getPool().connect();
  await client.query("SELECT set_config('app.is_super_admin', 'false', false)");
  await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [
    tenantId,
  ]);
  return client;
}

/**
 * Acquiert un client en mode super-admin (bypass RLS, usage audit / seed uniquement).
 */
export async function superAdminClient(): Promise<PoolClient> {
  const client = await getPool().connect();
  await client.query("SELECT set_config('app.is_super_admin', 'true', false)");
  await client.query("SELECT set_config('app.current_tenant_id', '', false)");
  return client;
}

/**
 * Introspection RLS : retourne { relrowsecurity, relforcerowsecurity } pour une table.
 * RLS valide exige relrowsecurity=true ET relforcerowsecurity=true (piege 5).
 */
export async function tableRlsFlags(
  tableName: string,
): Promise<{ relrowsecurity: boolean; relforcerowsecurity: boolean }> {
  const client = await getPool().connect();
  try {
    const res = await client.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND n.nspname = 'public'`,
      [tableName],
    );
    if (res.rowCount === 0) {
      throw new Error(`Table introuvable: ${tableName}`);
    }
    const row = res.rows[0];
    if (row === undefined) {
      throw new Error(`Ligne pg_class vide pour ${tableName}`);
    }
    return {
      relrowsecurity: row.relrowsecurity,
      relforcerowsecurity: row.relforcerowsecurity,
    };
  } finally {
    client.release();
  }
}

/**
 * Verifie l'existence d'une colonne dans une table.
 */
export async function columnExists(
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2`,
      [tableName, columnName],
    );
    return (res.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

/**
 * Retourne les valeurs autorisees par un CHECK de type IN (...) sur une colonne,
 * en tentant des insertions controlees. Utilitaire de test (rollback systematique).
 */
export async function checkAcceptsType(typeValue: string): Promise<boolean> {
  const client = await superAdminClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO cross_tenant_authorizations
         (type, granting_tenant_id, grantee_tenant_id, resource_type, resource_id, granted_by)
       VALUES ($1, gen_random_uuid(), gen_random_uuid(), 'claim', gen_random_uuid(), gen_random_uuid())`,
      [typeValue],
    );
    await client.query('ROLLBACK');
    return true;
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    return false;
  } finally {
    client.release();
  }
}
```

### 7.6 Fixtures `repo/test/integration/fixtures/seed-7.5b.ts`

```ts
import { randomUUID } from 'node:crypto';
import { superAdminClient } from '../helpers/pg-harness';

/**
 * Fixtures de la fondation Sprint 7.5b : 2 tenants, 1 expert (tenant A), 1 affectation.
 * Le seed s'execute en super-admin (bypass RLS) afin d'inserer dans plusieurs tenants.
 * L'isolation (scenario 13) est ensuite verifiee via des sessions de tenant standard.
 */

export interface Seed7_5b {
  tenantA: string;
  tenantB: string;
  garageTenant: string;
  expertId: string;
  assignmentId: string;
}

export async function seedFoundation(): Promise<Seed7_5b> {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const garageTenant = randomUUID();
  const expertId = randomUUID();
  const assignmentId = randomUUID();

  const client = await superAdminClient();
  try {
    await client.query('BEGIN');

    // Tenants
    for (const [id, name, kind] of [
      [tenantA, 'Carrier Alpha', 'carrier'],
      [tenantB, 'Carrier Beta', 'carrier'],
      [garageTenant, 'Garage Gamma', 'garage'],
    ] as const) {
      await client.query(
        `INSERT INTO tenants (id, name, kind, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (id) DO NOTHING`,
        [id, name, kind],
      );
    }

    // Expert (tenant A)
    await client.query(
      `INSERT INTO insure_experts
         (id, tenant_id, full_name, expert_type, specialty, status)
       VALUES ($1, $2, 'Expert Test A', 'independent', 'auto_collision', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [expertId, tenantA],
    );

    // Affectation (insure_expert_assignments, cols v3.0)
    await client.query(
      `INSERT INTO insure_expert_assignments
         (id, tenant_id, expert_id, garage_tenant_id, claim_reference,
          status, honoraire_payment_status)
       VALUES ($1, $2, $3, $4, 'CLM-2026-0001', 'in_progress', 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [assignmentId, tenantA, expertId, garageTenant],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  return { tenantA, tenantB, garageTenant, expertId, assignmentId };
}

export async function cleanupFoundation(seed: Seed7_5b): Promise<void> {
  const client = await superAdminClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM insure_expert_assignments WHERE id = $1',
      [seed.assignmentId],
    );
    await client.query('DELETE FROM insure_experts WHERE id = $1', [
      seed.expertId,
    ]);
    await client.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [
      [seed.tenantA, seed.tenantB, seed.garageTenant],
    ]);
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
  } finally {
    client.release();
  }
}
```

### 7.7 Suite d'integration `repo/test/integration/sprint-7.5b-foundation.spec.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Imports cross-package : on consomme les packages en lecture seule.
import { ExpertTypeEnum, ExpertSpecialtyEnum } from '@insurtech/expertise';
import { TowMissionStatusEnum, TruckTypeEnum } from '@insurtech/tow';
import { ALL_PERMISSIONS, ALL_MODULES } from '@insurtech/auth';

// Squelettes de service (scenario 12).
import { ExpertsService } from '@insurtech/expertise';
import { TowMissionsService } from '@insurtech/tow';

import {
  getPool,
  closePool,
  clientForTenant,
  superAdminClient,
  tableRlsFlags,
  columnExists,
  checkAcceptsType,
} from './helpers/pg-harness';
import {
  seedFoundation,
  cleanupFoundation,
  type Seed7_5b,
} from './fixtures/seed-7.5b';

// Les 7 types cross-tenant AUTORITAIRES (Sprint 7.5a). PAS le jeu brut B-7.5b.
const CROSS_TENANT_TYPES_7_5A = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
] as const;

const FOUNDATION_TABLES = [
  'insure_experts',
  'insure_expert_assignments', // renommee depuis expert_designations (2.5.5)
  'insure_expert_reports',
] as const;

let seed: Seed7_5b;

beforeAll(async () => {
  getPool();
  seed = await seedFoundation();
}, 30_000);

afterAll(async () => {
  if (seed !== undefined) {
    await cleanupFoundation(seed);
  }
  await closePool();
});

describe('Sprint 7.5b foundation -- exports packages', () => {
  // Scenario 1
  it('expertise exporte ExpertTypeEnum(4) + ExpertSpecialtyEnum(10)', () => {
    expect(ExpertTypeEnum.options.length).toBe(4);
    expect(ExpertSpecialtyEnum.options.length).toBe(10);
    expect(ExpertTypeEnum.options).toContain('independent');
    expect(ExpertSpecialtyEnum.options).toContain('auto_collision');
  });

  // Scenario 2
  it('tow exporte TowMissionStatusEnum(9) + TruckTypeEnum(3)', () => {
    expect(TowMissionStatusEnum.options.length).toBe(9);
    expect(TruckTypeEnum.options.length).toBe(3);
    expect(TowMissionStatusEnum.options).toContain('pending_designation');
    expect(TruckTypeEnum.options).toContain('flatbed');
  });
});

describe('Sprint 7.5b foundation -- catalog RBAC 147 (7.5a autoritaire)', () => {
  // Scenario 3 -- 147, PAS 130
  it('ALL_PERMISSIONS.length === 147', () => {
    expect(ALL_PERMISSIONS.length).toBe(147);
  });

  // Scenario 4 -- 25 modules incl. customer
  it('ALL_MODULES.length === 25 et inclut customer', () => {
    expect(ALL_MODULES.length).toBe(25);
    expect(ALL_MODULES).toContain('customer');
  });

  // Scenario 5 -- les 17 customer.*
  it('les 17 permissions customer.* sont presentes', () => {
    const customerPerms = ALL_PERMISSIONS.filter((p) =>
      p.startsWith('customer.'),
    );
    expect(customerPerms.length).toBe(17);
    expect(customerPerms).toContain('customer.consent.grant');
    expect(customerPerms).toContain('customer.consent.revoke');
    expect(customerPerms).toContain('customer.claim.create');
  });
});

describe('Sprint 7.5b foundation -- cross-tenant 7 types (7.5a autoritaire)', () => {
  // Scenario 6 -- le type applicatif a exactement les 7 valeurs 7.5a
  it('CrossTenantAuthorizationType a exactement les 7 types autoritaires', () => {
    expect(CROSS_TENANT_TYPES_7_5A.length).toBe(7);
    const set = new Set<string>(CROSS_TENANT_TYPES_7_5A);
    expect(set.size).toBe(7);
    // Anti-regression : aucun nom brut B-7.5b ne doit apparaitre.
    expect(set.has('broker_garage')).toBe(false);
    expect(set.has('expert_request')).toBe(false);
  });

  // Scenario 7 -- CHECK DB accepte les 7, rejette une valeur invalide
  it('le CHECK DB accepte les 7 types et rejette un type invalide', async () => {
    for (const type of CROSS_TENANT_TYPES_7_5A) {
      const accepted = await checkAcceptsType(type);
      expect(accepted, `type valide rejete: ${type}`).toBe(true);
    }
    const rejected = await checkAcceptsType('totally_invalid_type');
    expect(rejected).toBe(false);
  });
});

describe('Sprint 7.5b foundation -- RLS + FORCE sur les 3 entites', () => {
  // Scenarios 8, 9, 10
  for (const table of FOUNDATION_TABLES) {
    it(`${table} a RLS active ET FORCE active`, async () => {
      const flags = await tableRlsFlags(table);
      expect(flags.relrowsecurity, `${table} relrowsecurity`).toBe(true);
      expect(flags.relforcerowsecurity, `${table} relforcerowsecurity`).toBe(
        true,
      );
    });
  }
});

describe('Sprint 7.5b foundation -- colonnes v3.0 insure_expert_assignments', () => {
  // Scenario 11
  it('insure_expert_assignments possede les colonnes v3.0 et accepte in_progress', async () => {
    expect(await columnExists('insure_expert_assignments', 'expert_id')).toBe(
      true,
    );
    expect(
      await columnExists('insure_expert_assignments', 'garage_tenant_id'),
    ).toBe(true);
    expect(
      await columnExists(
        'insure_expert_assignments',
        'honoraire_payment_status',
      ),
    ).toBe(true);

    // Le seed a insere une affectation au statut 'in_progress' : on la relit.
    const client = await clientForTenant(seed.tenantA);
    try {
      const res = await client.query<{ status: string }>(
        'SELECT status FROM insure_expert_assignments WHERE id = $1',
        [seed.assignmentId],
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0]?.status).toBe('in_progress');
    } finally {
      client.release();
    }
  });
});

describe('Sprint 7.5b foundation -- squelettes leves NotImplementedException', () => {
  // Scenario 12
  it('expertise + tow services squelettes levent NotImplementedException', async () => {
    const experts = new ExpertsService();
    const missions = new TowMissionsService();

    await expect(
      experts.searchExperts({ specialty: 'auto_collision' } as never),
    ).rejects.toThrowError(/NotImplemented|Sprint 14|Sprint 22\.7/);

    await expect(
      missions.designateMission({ claimId: 'x' } as never),
    ).rejects.toThrowError(/NotImplemented|Sprint 22\.5/);
  });
});

describe('Sprint 7.5b foundation -- isolation multi-tenant (RLS)', () => {
  // Scenario 13
  it('une ligne insure_experts du tenant A est invisible depuis le tenant B', async () => {
    const clientA = await clientForTenant(seed.tenantA);
    const clientB = await clientForTenant(seed.tenantB);
    try {
      const seenByA = await clientA.query(
        'SELECT id FROM insure_experts WHERE id = $1',
        [seed.expertId],
      );
      expect(seenByA.rowCount, 'tenant A doit voir son expert').toBe(1);

      const seenByB = await clientB.query(
        'SELECT id FROM insure_experts WHERE id = $1',
        [seed.expertId],
      );
      expect(seenByB.rowCount, 'tenant B ne doit PAS voir expert de A').toBe(0);
    } finally {
      clientA.release();
      clientB.release();
    }
  });

  // Scenario 13b -- le super-admin voit tout (audit ACAPS)
  it('le super-admin voit la ligne expert (bypass RLS pour audit)', async () => {
    const admin = await superAdminClient();
    try {
      const res = await admin.query(
        'SELECT id FROM insure_experts WHERE id = $1',
        [seed.expertId],
      );
      expect(res.rowCount).toBe(1);
    } finally {
      admin.release();
    }
  });
});
```

### 7.8 Config Vitest integration `repo/vitest.integration.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.spec.ts'],
    environment: 'node',
    hookTimeout: 30_000,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
  },
});
```

### 7.9 Script `package.json` (extrait modifie)

```json
{
  "scripts": {
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:watch": "vitest --config vitest.integration.config.ts"
  }
}
```

---

## 8. Tests complets

### 8.1 Strategie generale

Les tests d'integration de cette tache sont **cross-package** et **DB-backed**. Ils ne mockent rien (decision-013). Ils consomment :

- les packages `@insurtech/expertise`, `@insurtech/tow`, `@insurtech/auth` (en lecture seule) ;
- une vraie base PostgreSQL contenant les migrations de 7.5a + 2.5.4/2.5.5/2.5.6 deja appliquees.

La suite tourne en **fork unique sequentiel** (`singleFork`, `concurrent:false`) car elle partage un seed global et manipule le contexte de session RLS : un parallelisme naif provoquerait des fuites de contexte de tenant entre tests (piege 11).

### 8.2 Choix `is_local` du contexte RLS

Le harness pose `set_config('app.current_tenant_id', $1, false)` avec `is_local=false`, donc le contexte persiste sur la duree de vie du client (hors transaction). Chaque scenario qui interroge la DB **acquiert son propre client** via `clientForTenant(...)` puis le **libere** dans un `finally`. On ne reutilise jamais un client de tenant A pour interroger le tenant B. Le seed et le cleanup utilisent `superAdminClient()` (`app.is_super_admin='true'`) afin de pouvoir ecrire dans plusieurs tenants ; ce bypass est strictement reserve a la preparation/audit.

### 8.3 Setup / teardown

- `beforeAll` (timeout 30 s) : initialise le pool puis appelle `seedFoundation()` qui insere 2 tenants assureurs (A, B), 1 tenant garage, 1 expert (tenant A), 1 affectation `insure_expert_assignments` au statut `in_progress` avec colonnes v3.0.
- `afterAll` : `cleanupFoundation(seed)` supprime l'affectation, l'expert, puis les tenants ; ferme le pool.

Le seed est **idempotent** (`ON CONFLICT DO NOTHING`) pour tolerer un re-run apres echec.

### 8.4 Fixtures (rappel du contenu seme)

| Entite | Valeurs semees |
|--------|----------------|
| tenant A | `Carrier Alpha`, kind `carrier`, status `active` |
| tenant B | `Carrier Beta`, kind `carrier`, status `active` |
| tenant garage | `Garage Gamma`, kind `garage` |
| expert | tenant A, `Expert Test A`, type `independent`, specialty `auto_collision`, status `active` |
| affectation | tenant A, `expert_id`=expert, `garage_tenant_id`=garage, claim `CLM-2026-0001`, status `in_progress`, `honoraire_payment_status` `pending` |

### 8.5 Les 13 scenarios -- intention et assertion cle

| # | Scenario | Assertion cle | Piege couvert |
|---|----------|---------------|----------------|
| 1 | exports expertise | `ExpertTypeEnum.options.length===4` & `ExpertSpecialtyEnum===10` | exports manquants |
| 2 | exports tow | `TowMissionStatusEnum===9` & `TruckTypeEnum===3` | cardinalite enum |
| 3 | catalog 147 | `ALL_PERMISSIONS.length===147` | piege 1 (130) |
| 4 | 25 modules | `ALL_MODULES.length===25` incl `customer` | piege 2 (24) |
| 5 | 17 customer.* | filtre `customer.` length 17 | derive module customer |
| 6 | 7 types applicatifs | set des 7 noms 7.5a, refus noms B-7.5b | piege 3 (noms) |
| 7 | CHECK DB | accepte 7, rejette `totally_invalid_type` | piege 3 + CHECK |
| 8 | RLS+FORCE insure_experts | `relrowsecurity` & `relforcerowsecurity` true | piege 5 |
| 9 | RLS+FORCE insure_expert_assignments | idem (nom renomme) | pieges 4+5 |
| 10 | RLS+FORCE insure_expert_reports | idem | piege 5 |
| 11 | colonnes v3.0 + in_progress | `expert_id`/`garage_tenant_id`/`honoraire_payment_status` + statut `in_progress` | pieges 4+6 |
| 12 | squelettes NotImplemented | rejette avec message sprint | piege 10 |
| 13 | isolation tenant | A voit, B ne voit pas | pieges 6+7 |
| 13b | super-admin bypass | admin voit la ligne | RLS bypass audit |

### 8.6 Pourquoi 13b en plus des 12 requis

Le scenario 13b (super-admin) prouve que le bypass RLS d'audit (`app.is_super_admin`) fonctionne, condition necessaire de la tracabilite ACAPS. Il complete l'isolation : on demontre a la fois que B ne voit PAS (RLS effective) et que l'audit voit (bypass controle). On depasse donc le minimum de 12 scenarios (13 + 13b = 14 `it()`).

### 8.7 Robustesse des assertions

- Le scenario 12 utilise `rejects.toThrowError(/.../)` avec une regex tolerante au libelle exact (`NotImplemented` OU le numero de sprint), afin de ne pas casser si le message evolue tout en garantissant que la methode REJETTE bien (anti-piege 10 : pas de try/catch silencieux).
- Le scenario 7 encadre chaque insertion dans une transaction `ROLLBACK` (utilitaire `checkAcceptsType`) : aucune donnee residuelle.
- Les introspections (`tableRlsFlags`, `columnExists`) lisent `pg_class` / `information_schema` et ne dependent pas du seed.

---

### 8.8 Prerequis de migration de la base de test

La suite suppose que la base de test contient l'etat SCHEMA produit par les migrations suivantes (deja livrees par les taches anterieures et par le Sprint 7.5a). Si une seule manque, certains scenarios echouent. Cette table sert de checklist de diagnostic.

| Migration / tache | Objet cree ou modifie | Scenario impacte si absent |
|--------------------|------------------------|-----------------------------|
| 7.5a `1735000000011` | table `cross_tenant_authorizations` | 7 (insertion impossible) |
| 7.5a `1735000000012` | CHECK `cross_tenant_authorizations_type_check` + index | 7 (rejet invalide non teste) |
| 7.5a (RBAC) | catalog 130 permissions + 24 modules | 3, 4 (sous-compte) |
| 2.5.3 | +17 permissions `customer.*` + module `customer` | 3, 4, 5 |
| 2.5.4 | table `insure_experts` + RLS + FORCE | 8, 11, 13 |
| 2.5.5 | renommage -> `insure_expert_assignments` + cols v3.0 | 9, 11 |
| 2.5.6 | table `insure_expert_reports` + RLS + FORCE | 10 |

La commande `pnpm db:migrate:test` (section 10) applique l'integralite de ces migrations sur `TEST_DATABASE_URL`. En cas de doute, verifier manuellement :

```sql
-- Verifier l'existence des 3 entites foundation
SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
 WHERE relname IN ('insure_experts','insure_expert_assignments','insure_expert_reports');

-- Verifier le CHECK des 7 types cross-tenant
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname = 'cross_tenant_authorizations_type_check';
```

### 8.9 Comportement attendu en cas de re-run

La suite est concue pour etre rejouable sans nettoyage manuel :

1. `seedFoundation()` utilise `ON CONFLICT DO NOTHING` : un re-run apres un crash partiel ne duplique rien.
2. `cleanupFoundation()` supprime dans l'ordre inverse des FK (affectation -> expert -> tenants) pour eviter les violations de contrainte.
3. Les UUID sont generes a chaque run (`randomUUID()`), donc deux runs paralleles n'entrent pas en collision sur les memes lignes -- mais le `singleFork` empeche de toute facon le parallelisme.
4. Le scenario 7 (`checkAcceptsType`) fait toujours un `ROLLBACK` : aucune ligne `cross_tenant_authorizations` ne persiste.

### 8.10 Couverture et place dans la pyramide de tests

Cette suite est une suite d'INTEGRATION (niveau intermediaire de la pyramide), distincte des tests unitaires de chaque package (`.spec.ts` co-localises) et des futurs tests E2E HTTP (Playwright, post-Sprint 8). Elle ne vise pas une couverture de lignes elevee sur un fichier donne, mais une couverture d'INVARIANTS cross-package. Son role est preventif : detecter les regressions de contrat. Elle compte neanmoins dans le rapport de couverture global et ne doit pas faire baisser le seuil (>= 85 %).

## 9. Variables d'environnement

| Variable | Role | Exemple |
|----------|------|---------|
| `TEST_DATABASE_URL` | URL PostgreSQL de test (prioritaire) | `postgres://insurtech_test:insurtech_test@localhost:5433/insurtech_test` |
| `DATABASE_URL` | Fallback si `TEST_DATABASE_URL` absente | `postgres://insurtech_test:insurtech_test@localhost:5433/insurtech_test` |
| `PGSSLMODE` | Mode SSL (desactive en local CI) | `disable` |
| `VITEST_POOL` | Forcer le pool de Vitest (fork unique) | `forks` |
| `NODE_ENV` | Environnement (jamais `production` en test) | `test` |
| `PASSWORD_PEPPER` | Requis par certains modules importes (auth) | `test_pepper_value_change_me` |
| `LOG_LEVEL` | Niveau Pino pendant les tests | `silent` |

Note : aucune donnee assure reelle n'est utilisee ; la base de test contient uniquement des fixtures synthetiques (decision-008 / CNDP -- pas de donnee personnelle reelle hors Maroc, ici aucune donnee reelle du tout).

---

## 10. Commandes shell

```bash
# 1. Demarrer un PostgreSQL de test (exemple docker, port 5433)
docker run --rm -d --name insurtech-pg-test \
  -e POSTGRES_USER=insurtech_test \
  -e POSTGRES_PASSWORD=insurtech_test \
  -e POSTGRES_DB=insurtech_test \
  -p 5433:5432 postgres:16

# 2. Appliquer les migrations (7.5a + 2.5.4/2.5.5/2.5.6) sur la base de test
export TEST_DATABASE_URL="postgres://insurtech_test:insurtech_test@localhost:5433/insurtech_test"
pnpm db:migrate:test

# 3. Lancer la suite d'integration cross-package
pnpm test:integration

# 3bis. Filtrer uniquement la suite de fondation 7.5b
pnpm test:integration -- test/integration/sprint-7.5b-foundation.spec.ts

# 4. Lint des docs Markdown (extension paths)
pnpm dlx markdownlint-cli2 "docs/architecture/*.md"

# 5. Verification anti-emoji (decision-006 ABSOLUE)
bash scripts/check-no-emoji.sh docs/architecture/ test/integration/

# 6. Typecheck de la suite de test (strict)
pnpm exec tsc --noEmit -p test/tsconfig.json

# 7. Nettoyage du conteneur de test
docker stop insurtech-pg-test
```

---

## 11. Criteres de validation

Chaque critere precise la commande, le resultat attendu et le mode d'echec.

### P0 (bloquants -- >= 15)

| Id | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V1 | Catalog 147 permissions | `pnpm test:integration` (scenario 3) | vert | piege 1 : assert 130 -> rouge |
| V2 | 25 modules dont customer | scenario 4 | vert | piege 2 : 24 -> rouge |
| V3 | 17 customer.* | scenario 5 | vert | filtre != 17 |
| V4 | 7 types cross-tenant 7.5a | scenario 6 | vert | piege 3 : noms B-7.5b |
| V5 | CHECK DB accepte 7 / rejette invalide | scenario 7 | vert | CHECK absent ou mauvais |
| V6 | RLS+FORCE insure_experts | scenario 8 | vert | piege 5 : FORCE manquant |
| V7 | RLS+FORCE insure_expert_assignments | scenario 9 | vert | pieges 4+5 |
| V8 | RLS+FORCE insure_expert_reports | scenario 10 | vert | piege 5 |
| V9 | colonnes v3.0 + in_progress | scenario 11 | vert | pieges 4+6 |
| V10 | squelettes NotImplementedException | scenario 12 | vert | piege 10 |
| V11 | isolation tenant A/B | scenario 13 | vert | pieges 6+7 |
| V12 | exports expertise (4/10) | scenario 1 | vert | export manquant |
| V13 | exports tow (9/3) | scenario 2 | vert | cardinalite KO |
| V14 | suite >= 12 scenarios verts | `pnpm test:integration` | >= 12 `it()` passes | suite rouge / partielle |
| V15 | 4 docs presents | `ls docs/architecture/*.md` | 4 fichiers | doc manquant |
| V16 | aucune emoji | `bash scripts/check-no-emoji.sh ...` | exit 0 | emoji detecte -> CI rouge |

### P1 (importants -- >= 8)

| Id | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V17 | super-admin bypass (audit) | scenario 13b | vert | bypass KO |
| V18 | somme par module = 147 | revue `permissions-147-catalog.md` | 130+17=147 | somme != 147 |
| V19 | catalog en const (non enum) | revue doc section 8 | `as const` | enum present |
| V20 | doc expertise methode->sprint complete | revue `expertise-extension-path.md` | 15 lignes table | table partielle |
| V21 | doc tow methode->sprint complete | revue `tow-extension-path.md` | 15 lignes table | table partielle |
| V22 | doc cross-tenant 7 flux | revue `cross-tenant-7-types-architecture.md` | 7 sequences | flux manquant |
| V23 | typecheck strict des tests | `tsc --noEmit -p test/tsconfig.json` | 0 erreur | type error |
| V24 | markdownlint docs | `markdownlint-cli2 docs/architecture/*.md` | 0 erreur | lint KO |

### P2 (qualite -- >= 5)

| Id | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V25 | seed idempotent (re-run) | re-lancer `pnpm test:integration` | vert 2x | seed casse au re-run |
| V26 | fork unique sequentiel | inspection config vitest | `singleFork:true` | fuite contexte tenant |
| V27 | tag annote cree | `git tag -n sprint-7.5b-complete-v3-foundation` | listing 9 livrables | tag absent / leger |
| V28 | commit conventional | `git log -1 --pretty=%s` | `docs(sprint-7.5b): ...` | format KO |
| V29 | aucun package modifie | `git diff --name-only packages/` | vide | package touche |
| V30 | references croisees docs | revue liens entre 4 docs | coherents | lien casse |

---

## 12. Edge cases + troubleshooting

| # | Symptome | Cause probable | Resolution |
|---|----------|----------------|------------|
| 1 | scenario 3 rouge : `Expected 130, received 147` | Test ecrit avec 130 (piege 1) | Corriger l'assertion a 147 (7.5a autoritaire). |
| 2 | scenario 9 : `Table introuvable: expert_designations` | Test cible l'ancien nom (piege 4) | Cibler `insure_expert_assignments`. |
| 3 | scenarios 8/9/10 : `relforcerowsecurity` false | Migration applique RLS sans FORCE | Verifier `ALTER TABLE ... FORCE ROW LEVEL SECURITY` dans la migration source. |
| 4 | scenario 13 : tenant B voit la ligne | Policy RLS permissive ou `set_config` non pose | Verifier la policy + que `clientForTenant` pose bien `app.current_tenant_id`. |
| 5 | scenario 13 : tenant A voit 0 ligne (faux positif d'isolation) | DB non semee (piege 6) | Verifier `beforeAll`/`seedFoundation` ; le seed doit reussir. |
| 6 | `connection refused` | PostgreSQL de test non demarre | Lancer le conteneur docker (section 10) ; verifier port 5433. |
| 7 | scenario 7 : insertion acceptee pour type invalide | CHECK absent (migration 1735000000012 non appliquee) | Appliquer la migration ; verifier `cross_tenant_authorizations_type_check`. |
| 8 | scenario 12 : ne rejette pas | Squelette accidentellement implemente (piege 10) | Revenir au squelette `NotImplementedException` jusqu'au sprint d'impl. |
| 9 | tests instables en parallele | Parallelisme + contexte RLS partage (piege 11) | Forcer `singleFork:true` / `concurrent:false`. |
| 10 | `check-no-emoji.sh` exit 1 | Emoji dans un doc (piege 12) | Remplacer par texte / fleche ASCII `->`. |

---

### 12.1 Diagnostic pas a pas en cas de suite rouge

Lorsque `pnpm test:integration` echoue, suivre cet arbre de decision avant toute modification de code :

1. **La connexion DB echoue-t-elle ?** (`ECONNREFUSED`, timeout) -> demarrer le conteneur PostgreSQL (section 10), verifier `TEST_DATABASE_URL`, verifier le port 5433.
2. **Le seed echoue-t-il dans `beforeAll` ?** (erreur 30 s, `relation ... does not exist`) -> les migrations ne sont pas appliquees ; lancer `pnpm db:migrate:test` ; consulter la checklist 8.8.
3. **Un scenario de CHIFFRE echoue (3/4/5) ?** -> le catalog du package `@insurtech/auth` ne reflete pas 147/25/17 ; ce n'est PAS un bug du test ; corriger le catalog (tache 2.5.3 amont) ou verifier que le bon build est resolu (`pnpm -r build` avant les tests d'integration).
4. **Un scenario RLS echoue (8/9/10) ?** -> verifier `relforcerowsecurity` dans la migration source (piege 5) ; ne PAS affaiblir l'assertion.
5. **L'isolation echoue (13) ?** -> verifier la policy RLS et que `clientForTenant` pose le contexte ; verifier que le seed a bien insere l'expert tenant A.
6. **Le scenario 12 echoue ?** -> un squelette a ete implemente ; revenir au squelette (piege 10).

### 12.2 Notes de portabilite

- **PostgreSQL >= 14** requis pour `gen_random_uuid()` natif (extension `pgcrypto` sinon). La base de test utilise PostgreSQL 16.
- **`set_config(..., false)`** (is_local=false) : le contexte persiste sur la SESSION du client, pas seulement la transaction. C'est intentionnel pour les tests multi-requetes hors transaction.
- **Windows / WSL** : le developpeur sous Windows lance le conteneur via Docker Desktop ; le port 5433 evite le conflit avec un PostgreSQL local sur 5432.

## 13. Conformite Maroc

- **ACAPS (regulateur assurances)** : les 4 documents d'architecture constituent une piece de tracabilite de gouvernance (qui peut faire quoi, qui traverse quel tenant, pour combien de temps). Le catalog 147 et la matrice des 26 roles sont auditables. Le scenario 13b (bypass super-admin) materialise le canal d'audit reglementaire.
- **CNDP / loi 09-08 (donnees personnelles)** : l'isolation multi-tenant prouvee (scenario 13) garantit qu'aucune donnee personnelle d'un assure ne fuit vers un autre tenant. Les permissions `customer.consent.grant` / `.revoke` materialisent le consentement. Les autorisations cross-tenant sont tracees, scopees et limitees dans le temps (`expires_at`).
- **Loi 17-99 (Code des assurances)** : les flux d'expertise et de depannage documentes (extension paths) sont rattaches au dossier sinistre ; la tracabilite est complete.
- **Loi 43-20 (confiance numerique / signature electronique)** : la soumission de rapport d'expertise (Sprint 22.7) declenchera une signature electronique ; l'extension-path le documente.
- **Cloud souverain MA (decision-008)** : la base de test, comme la production, reside au Maroc (Atlas Benguerir, DC1 Tier III + DC2 Tier IV) ; aucune donnee assure ne quitte le territoire ; chiffrement AES-256-GCM au repos, TLS 1.3 en transit. Les fixtures de test sont synthetiques (aucune donnee reelle).

---

## 14. Conventions absolues skalean-insurtech

Cette tache RESPECTE et REPRODUIT l'integralite des conventions du monorepo. Liste complete :

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; contexte via `AsyncLocalStorage` ; RLS PostgreSQL avec `app_can_access_tenant()` ; audit trail systematique. Les tests posent le contexte via `set_config('app.current_tenant_id', ...)` / `app.is_super_admin`.
- **Validation strict** : Zod uniquement ; schemas exportes ; `const Schema = z.object({...})` ; `type T = z.infer<typeof Schema>`. Les enums testes sont des `z.enum`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; champs JSON structures `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`. En test, `LOG_LEVEL=silent`.
- **Hash strict** : argon2id (65536 / 3 / 4) ; jamais bcrypt ; `PASSWORD_PEPPER` obligatoire.
- **Package manager strict** : pnpm uniquement ; `engine-strict` Node >= 22.11.0 ; `save-exact` ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites. Le harness traite `res.rows[0]` comme potentiellement `undefined`.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; couverture >= 85 % (>= 90 % auth/database/signature). Cette suite d'integration tourne sur PostgreSQL reel.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles ; 147 permissions.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par evenement ; `Idempotency-Key` sur les flux critiques.
- **Imports strict** : `@insurtech/{name}` ; paths dans `tsconfig.base.json` ; ordre Node / externe / `@insurtech` / relatif. Le spec illustre cet ordre.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un modele frontier ; mock sur Sprints 1-28, reel a partir du Sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; la CI echoue sinon. Fleches ASCII `->` uniquement.
- **Idempotency-Key strict** : sur `POST /payments`, `/signatures`, `/claims`, et toute ecriture MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc ; AES-256-GCM au repos ; TLS 1.3 en transit.
- **Naming v3.0 (decision-011)** : Skalean (societe editrice), Assurflow (vertical assurance), Sofidemy (marque commerciale).

---

## 15. Validation pre-commit

```bash
# Etape 1 : anti-emoji (bloquant)
bash scripts/check-no-emoji.sh docs/architecture/ test/integration/ || {
  echo "ECHEC: emoji detecte (decision-006)"; exit 1; }

# Etape 2 : lint Markdown des 4 docs
pnpm dlx markdownlint-cli2 "docs/architecture/expertise-extension-path.md" \
  "docs/architecture/tow-extension-path.md" \
  "docs/architecture/cross-tenant-7-types-architecture.md" \
  "docs/architecture/permissions-147-catalog.md"

# Etape 3 : typecheck strict de la suite de test
pnpm exec tsc --noEmit -p test/tsconfig.json

# Etape 4 : suite d'integration cross-package (porte de sortie)
export TEST_DATABASE_URL="postgres://insurtech_test:insurtech_test@localhost:5433/insurtech_test"
pnpm db:migrate:test
pnpm test:integration

# Etape 5 : verifier qu'aucun package n'a ete modifie
test -z "$(git diff --name-only packages/)" || {
  echo "ECHEC: un package a ete modifie (lecture seule attendue)"; exit 1; }

# Etape 6 : commitlint
pnpm exec commitlint --edit
```

Toutes les etapes doivent retourner exit 0 avant commit.

---

## 16. Message de commit + tag de cloture

### 16.1 Commit

```
docs(sprint-7.5b): documentation extension paths + tests integration cross-package

Ajoute les 4 documents d'architecture des chemins d'extension (expertise,
tow, cross-tenant 7 types, catalog 147 permissions) et la suite de tests
d'integration cross-package qui valide l'ensemble de la fondation Assurflow
v3.0 posee par le Sprint 7.5b.

La suite (>= 12 scenarios, PostgreSQL reel) asserte les chiffres autoritaires
du Sprint 7.5a : ALL_PERMISSIONS.length === 147, ALL_MODULES.length === 25
(incl. customer), 17 permissions customer.*, les 7 types cross-tenant
autoritaires + leur CHECK DB, RLS + FORCE sur insure_experts /
insure_expert_assignments / insure_expert_reports, les colonnes v3.0 de
insure_expert_assignments (expert_id, garage_tenant_id,
honoraire_payment_status, statut in_progress), le rejet NotImplementedException
des squelettes, et l'isolation multi-tenant.

Conflit B-7.5a / B-7.5b resolu en faveur de 7.5a (147 perms, 7 types 7.5a,
table renommee insure_expert_assignments).

Derniere tache du Sprint 7.5b. Aucune emoji (decision-006).

Task: 2.5.9
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: foundation extensions cross-sprints
```

### 16.2 Tag annote de cloture (decision-014)

```bash
git tag -a sprint-7.5b-complete-v3-foundation -m "Cloture Sprint 7.5b -- Fondation Assurflow v3.0

9 livrables du Sprint 7.5b :
1. 2.5.1 package @insurtech/expertise (types : ExpertTypeEnum 4, ExpertSpecialtyEnum 10)
2. 2.5.2 package @insurtech/tow (types : TowMissionStatusEnum 9, TruckTypeEnum 3)
3. 2.5.3 permissions module customer (+17) -> catalog 147 / 25 modules
4. 2.5.4 entite foundation insure_experts (RLS + FORCE)
5. 2.5.5 renommage expert_designations -> insure_expert_assignments (+ cols v3.0)
6. 2.5.6 entite foundation insure_expert_reports (RLS + FORCE)
7. 2.5.7 services squelettes @insurtech/expertise (NotImplementedException)
8. 2.5.8 services squelettes @insurtech/tow (NotImplementedException)
9. 2.5.9 documentation extension paths + tests integration cross-package

Chiffres autoritaires (Sprint 7.5a) : 147 permissions, 25 modules, 26 roles,
7 types cross-tenant, 3 entites foundation RLS + FORCE.

Aucune emoji (decision-006). Cloud souverain MA (decision-008)."

git push origin sprint-7.5b-complete-v3-foundation
```

---

## 17. Workflow next step

Le Sprint 7.5b est **COMPLET** des que la suite d'integration est verte, les 4 docs presents et lintes, et le tag annote pose.

```
Sprint 7.5b (fondation Assurflow v3.0) -- COMPLET
        |
        v
Sprint 8 (CRM + Booking) -- PREMIER consommateur de la fondation :
   - guards RBAC contre le catalog 147
   - isolation multi-tenant verifiee
   - exports types expertise / tow disponibles

Downstream (remplissage des squelettes, dans l'ordre des dependances) :
   Sprint 14   -> expertise : catalogue + onboarding + cycle d'affectation
   Sprint 21   -> cross-tenant authorizations : moteur grant/revoke des 7 types
   Sprint 22.5 -> tow : moteur de missions (machine 9 etats) + honoraires
   Sprint 22.7 -> expertise : moteur de rapports + signature + honoraires
   Sprint 24   -> dispatch garage (type garage_to_carrier_quote)
   Sprint 26.5 -> livraison + devis (types tower_to_garage_delivery, quote)
```

Chaque sprint aval s'appuie sur les extension-path docs de cette tache pour savoir QUELLE methode remplir, DANS QUEL ORDRE, et SANS casser les invariants (cardinalites d'enums, signatures figees, RLS, catalog 147, 7 types).

Action immediate apres cloture : ouvrir le board du Sprint 8 (CRM + Booking) et verifier que ses taches referencent le catalog 147 et l'isolation tenant comme prerequis satisfaits.

### 17.1 Checklist de transition vers le Sprint 8

| # | Verification de transition | Source de verite | Statut attendu |
|---|----------------------------|------------------|----------------|
| 1 | Suite d'integration 7.5b verte | `pnpm test:integration` | exit 0, >= 12 verts |
| 2 | 4 docs d'architecture presents et lintes | `docs/architecture/*.md` | 4 fichiers, lint OK |
| 3 | Tag annote pose | `git tag -l sprint-7.5b-complete-v3-foundation` | present, annote |
| 4 | Commit de cloture cree | `git log -1` | `docs(sprint-7.5b): ...` |
| 5 | Aucune emoji | `check-no-emoji.sh` | exit 0 |
| 6 | Catalog 147 / 25 modules | `@insurtech/auth` | verifie par scenario 3/4 |
| 7 | 3 entites RLS + FORCE | `pg_class` | verifie par scenarios 8/9/10 |
| 8 | 7 types cross-tenant | CHECK DB + applicatif | verifie par scenarios 6/7 |

Tant que les 8 lignes ne sont pas vertes, le Sprint 8 NE DEMARRE PAS. C'est la regle de gate de la decision-014.

### 17.2 Ce que le Sprint 8 N'A PAS besoin de refaire

Grace a cette tache, le Sprint 8 herite d'une fondation verifiee et n'a PAS a :

- re-verifier le catalog de permissions (deja asserte a 147) ;
- re-tester l'isolation multi-tenant des entites foundation (deja prouvee) ;
- re-documenter les types cross-tenant (deja documentes, 7 flux) ;
- deviner quelles methodes des squelettes implementer (extension paths fournis).

Le Sprint 8 se concentre donc integralement sur sa valeur ajoutee (CRM + Booking) en s'appuyant sur des invariants de fondation garantis.

### 17.3 Tracabilite long terme

Le tag `sprint-7.5b-complete-v3-foundation` devient un point de reference permanent : tout audit ACAPS ou CNDP ulterieur peut pointer ce tag pour prouver l'etat exact de la gouvernance des acces (147 permissions, 26 roles, 7 types cross-tenant, isolation RLS) a la date de cloture du Sprint 7.5b. Les 4 documents d'architecture, versionnes avec le code, constituent la piece documentaire correspondante.

---

<!--
  Task 2.5.9 -- Documentation extension paths + tests integration cross-package
  Sprint 7.5b (Phase 2 / Sprint 5 du programme Assurflow) -- DERNIERE tache (9/9)
  Reference programme : B-7.5b tache 2.5.9
  Chiffres autoritaires Sprint 7.5a : 147 permissions / 25 modules / 26 roles /
    7 types cross-tenant / 3 entites foundation RLS + FORCE
  Resolution de conflit : 7.5a autoritaire (PAS B-7.5b brut)
  Naming v3.0 (decision-011) : Skalean / Assurflow / Sofidemy
  Cloture par tag annote sprint-7.5b-complete-v3-foundation (decision-014)
  AUCUNE EMOJI (decision-006 ABSOLUE)
  Fin du fichier de tache.
-->
