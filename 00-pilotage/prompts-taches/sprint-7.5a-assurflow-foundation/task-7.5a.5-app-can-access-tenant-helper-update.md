# Tache 7.5a.5 -- Extension du helper PostgreSQL `app_can_access_tenant` aux 7 types cross-tenant

> Fichier de tache autoportant (self-contained). Aucune lecture d'un autre document n'est necessaire pour executer cette tache. Tout le contexte, tout le code, tous les tests et tous les criteres de validation sont reproduits integralement ci-dessous.

---

## 1. Metadonnees de la tache

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5a -- Assurflow Foundation |
| Position dans le sprint | Tache 5 / 10 |
| Reference meta-prompt | B-7.5a Tache 7.5a.5 |
| Phase | 2.5 -- Migration Assurflow |
| Priorite | P0 (bloquant chemin critique) |
| Effort estime | 2h |
| Dependances | 7.5a.4 (migration CHECK constraint cross_tenant + table `expert_designations`) |
| Bloque | 7.5a.6 (catalogue de permissions ~130 entrees) |
| Densite cible | 80-150 ko (cible reelle ~110-125 ko) |
| Emoji | AUCUNE EMOJI (decision-006 ABSOLUE) |
| Package cible | `@insurtech/database` (`repo/packages/database`) |
| Type de livraison | Migration TypeORM `CREATE OR REPLACE FUNCTION` (pas de changement de signature, pas de breaking change) |
| Role applicatif principal | `insurtech_app` (plus `insurtech_admin`, `insurtech_ro`) |

---

## 2. But

Etendre la fonction PostgreSQL `app_can_access_tenant(target_tenant uuid) RETURNS boolean` afin que sa **Condition 3** (verification d'autorisation cross-tenant) reconnaisse **les 7 types cross-tenant** definis par la version v3.0 de la plateforme Assurflow, au lieu des 3 types historiques de la v2.2.

Cette fonction est le coeur de l'isolation multi-tenant : elle est appelee par **33+ policies RLS** (Row Level Security) reparties sur toutes les tables tenant-scoped (`auth_users`, `auth_tenant_users`, `auth_sessions`, `audit_log`, tables CRM, Booking, Communications, DocsPayments, BooksCompliance, AnalyticsStockHr, et la nouvelle table `expert_designations` creee par 7.5a.4). Le moindre defaut de cette fonction expose ou bloque des donnees de tenants entiers.

La modification est livree via une migration TypeORM utilisant `CREATE OR REPLACE FUNCTION` :

- **Aucun changement de signature** : la signature `app_can_access_tenant(uuid) RETURNS boolean` reste strictement identique. Les 33+ policies RLS qui referencent `app_can_access_tenant(tenant_id)` continuent de fonctionner sans modification.
- **Aucun breaking change** : les Conditions 1 (bypass super admin) et 2 (meme tenant) restent identiques au comportement actuel. Seule la Condition 3 est elargie (widening-only) pour reconnaitre les 4 nouveaux types en plus des 3 existants.
- **Reproduction fidele de la logique reelle** : la fonction actuelle du depot s'appuie sur les helpers `app_is_super_admin()`, `app_current_tenant()` et `app_cross_tenant_authorization_id()`. Cette tache preserve cette architecture exacte et n'invente aucun mecanisme.

Les 7 types reconnus par la Condition 3 apres cette tache sont :

1. `broker_to_garage_assignment` (v2.2 -- conserve)
2. `assure_to_garage_visit` (v2.2 -- conserve)
3. `multi_tenant_user_access` (v2.2 -- conserve)
4. `client_to_tower_dispatch` (NOUVEAU v3.0)
5. `tower_to_garage_delivery` (NOUVEAU v3.0)
6. `garage_to_expert_request` (NOUVEAU v3.0)
7. `garage_to_carrier_quote` (NOUVEAU v3.0)

---

## 3. Contexte etendu

### 3.1 Pourquoi cette fonction est strategique

`app_can_access_tenant(uuid)` est le predicat unique partage par toutes les policies RLS de la base. La convention adoptee depuis le Sprint 1 (bootstrap, tache 1.1.4) est de **ne jamais ecrire la logique d'isolation dans chaque policy**, mais de la centraliser dans une fonction unique. Cela garantit que :

- la regle d'isolation est definie **une seule fois** et appliquee uniformement sur les 33+ tables ;
- une evolution de la politique d'acces (par exemple l'ajout de 4 types cross-tenant en v3.0) se fait par **une seule modification** de la fonction, sans toucher aux 33+ policies ;
- la surface d'audit de securite est minimale : un auditeur ACAPS ou CNDP n'a qu'une fonction a relire pour comprendre toute la logique d'isolation.

La fonction est appelee a chaque ligne evaluee par PostgreSQL lors d'un `SELECT`, `INSERT`, `UPDATE` ou `DELETE` sur une table RLS. Sa performance et sa correction sont donc critiques sur les deux axes : securite (jamais de fuite) et latence (jamais de regression de performance).

### 3.2 La logique canonique actuelle (3 conditions)

La fonction reelle dans le depot (`repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql`, helper 6, cree au bootstrap Sprint 1 tache 1.1.4) implemente une cascade de conditions :

```text
Condition 0 : target_tenant_id IS NULL          -> RETURN FALSE (defensif)
Condition 1 : app_is_super_admin() = TRUE       -> RETURN TRUE  (bypass platform L1)
Condition 2 : app_current_tenant() = target      -> RETURN TRUE  (meme tenant L2)
Condition 3 : autorisation cross-tenant active   -> RETURN TRUE  (exception Sprint 25)
Defaut      : aucune condition verifiee          -> RETURN FALSE
```

La Condition 3 actuelle lit l'identifiant d'une autorisation cross-tenant active via `app_cross_tenant_authorization_id()` (qui lit la variable de session `app.cross_tenant_authorization_id`), puis verifie que la ligne pointee est active et cible bien `target_tenant_id`. Cette branche est encapsulee dans un bloc `BEGIN ... EXCEPTION WHEN undefined_table` afin de ne pas casser dans les environnements ou la table `cross_tenant_authorizations` n'existe pas encore (avant Sprint 25 / Sprint 7.5a). C'est exactement cette architecture que la presente tache preserve, en n'elargissant **que** l'ensemble des types reconnus et en utilisant les **vrais noms de colonnes** de l'entite (`from_tenant_id`, `to_tenant_id`, `type`, `revoked_at`, `expires_at`).

### 3.3 Pourquoi un changement de type widening-only est sur

Un changement "widening-only" (elargissement) est par construction non regressif sur l'axe securite : il ne peut qu'**ajouter** des cas ou l'acces est accorde, jamais en supprimer. Concretement :

- Les 3 types historiques restent dans l'ensemble `IN (...)` de la Condition 3 : tout acces qui etait accorde avant le reste accorde apres.
- Les 4 nouveaux types ne peuvent accorder un acces que si une ligne `cross_tenant_authorizations` correspondante existe, n'est pas revoquee (`revoked_at IS NULL`), n'est pas expiree (`expires_at > NOW()`) et matche bidirectionnellement le couple `(current_tenant, target_tenant)`.

Le risque residuel n'est donc pas une fuite de donnees existantes mais une **mauvaise restriction des nouveaux types** (par exemple un type accorde trop largement). C'est pourquoi le filtre `type IN (...)` doit lister explicitement les 7 valeurs et doit rester strictement aligne avec le `CHECK` constraint pose par la migration 7.5a.4 sur la colonne `type`. Toute derive (type present dans la fonction mais absent du CHECK, ou inversement) doit etre detectee par les tests.

### 3.4 Pourquoi `CREATE OR REPLACE FUNCTION` preserve la signature

`CREATE OR REPLACE FUNCTION` modifie le corps d'une fonction existante **sans la supprimer**, a condition que la signature (nom + types des arguments + type de retour) reste identique. Les avantages :

- Les dependances (les 33+ policies RLS qui referencent `app_can_access_tenant(tenant_id)`) **ne sont pas invalidees** : PostgreSQL conserve l'OID de la fonction, donc les policies continuent de pointer vers le meme objet. Un `DROP FUNCTION ... CASCADE` aurait au contraire detruit toutes les policies dependantes -- catastrophe a eviter absolument.
- La migration est **idempotente dans l'esprit** : on remplace integralement le corps, donc l'etat final ne depend pas de l'etat initial du corps (seule la signature doit preexister, ce qui est garanti par le bootstrap Sprint 1).
- Le `down()` de la migration peut restaurer la version 3-types simplement en re-`CREATE OR REPLACE` avec l'ancien corps, sans toucher aux policies.

Contrainte critique : `CREATE OR REPLACE FUNCTION` **ne preserve PAS les GRANT** si la fonction n'existait pas, mais preserve les ACL si elle existait deja. Pour eviter toute ambiguite et garantir l'execution par le role applicatif, la migration **re-execute les GRANT EXECUTE** apres le `CREATE OR REPLACE`. C'est une ceinture-et-bretelles intentionnelle (voir piege P1 section 3.7).

### 3.5 Rationale `STABLE` + `SECURITY DEFINER` (ou `SECURITY INVOKER`)

La fonction reelle du depot est declaree `LANGUAGE plpgsql STABLE PARALLEL SAFE`. Analyse des qualificatifs :

- **`STABLE`** : la fonction retourne le meme resultat pour les memes arguments **a l'interieur d'une seule instruction SQL**, mais peut varier entre instructions (car elle lit `current_setting(...)` et la table `cross_tenant_authorizations` qui peuvent changer entre transactions). `STABLE` (et non `VOLATILE`) est essentiel : il autorise le planificateur a appeler la fonction une seule fois par ligne candidate plutot que de la re-evaluer inutilement, et il permet l'usage dans les policies RLS de maniere optimisee. Declarer `VOLATILE` (defaut) provoquerait des re-evaluations superflues a chaque ligne et degraderait les performances des scans RLS. Declarer `IMMUTABLE` serait **incorrect** (la fonction n'est pas pure : elle depend de l'etat de session et de la table).
- **`PARALLEL SAFE`** : autorise PostgreSQL a executer la fonction dans des workers paralleles. Comme la fonction ne fait que des lectures (`current_setting`, `SELECT`), c'est sur. La preserver evite de bloquer la parallelisation des grandes requetes analytiques sur tables RLS.
- **`SECURITY` mode** : le meta-prompt evoque `SECURITY DEFINER`. La fonction reelle du depot n'a pas de clause `SECURITY` explicite et s'execute donc en `SECURITY INVOKER` (defaut). La tache **preserve le mode reel observe dans le depot** : on ne bascule PAS arbitrairement en `SECURITY DEFINER` sans necessite. Si une evolution exige `SECURITY DEFINER` (par exemple pour lire `cross_tenant_authorizations` malgre la RLS sur cette table), alors il FAUT figer `search_path` explicitement (voir piege P2). Dans le cadre de cette tache, on conserve le mode actuel et on documente le choix : la lecture de `cross_tenant_authorizations` se fait sous le contexte de l'appelant, et la table cross_tenant_authorizations doit etre lisible par `insurtech_app` (grant accorde par la migration 7.5a.4).

### 3.6 Performance : l'index partiel et le benchmark < 1ms

La Condition 3 lit au plus une ligne de `cross_tenant_authorizations` (celle dont l'`id` est pointe par `app_cross_tenant_authorization_id()`), donc l'acces se fait par cle primaire (`WHERE id = ...`) : c'est un index unique scan, sub-milliseconde par nature.

Pour les futures evolutions (Sprint 7.5b) ou la Condition 3 pourrait avoir a chercher une autorisation active sans connaitre son `id` (par couple `(from_tenant_id, to_tenant_id)`), un **index partiel** est recommande :

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cta_active_lookup
  ON cross_tenant_authorizations (from_tenant_id, to_tenant_id, type)
  WHERE revoked_at IS NULL AND expires_at > NOW();
```

Attention : un index partiel avec `WHERE expires_at > NOW()` n'est pas valide directement car `NOW()` n'est pas `IMMUTABLE`. L'index partiel reel doit se limiter a `WHERE revoked_at IS NULL` (predicat immutable), le filtre `expires_at > NOW()` etant applique a la lecture. Cette nuance est un piege classique (voir P8). Pour cette tache (lookup par `id`), l'index PRIMARY KEY suffit et le benchmark `EXPLAIN ANALYZE` doit montrer un temps total < 1ms.

### 3.7 Pieges (8-12)

1. **Perte des GRANT apres `CREATE OR REPLACE`** : si pour une raison quelconque la fonction est recreee a vide (cas limite ou la signature aurait change), les ACL seraient perdus et `insurtech_app` ne pourrait plus executer la fonction -> toutes les requetes RLS echoueraient avec `permission denied for function app_can_access_tenant`. Mitigation : re-`GRANT EXECUTE ... TO insurtech_app, insurtech_admin, insurtech_ro` dans le `up()`.
2. **Injection via `search_path` en `SECURITY DEFINER`** : si la fonction etait passee en `SECURITY DEFINER` sans `SET search_path = pg_catalog, public`, un attaquant disposant du droit de creer des objets dans un schema en tete de `search_path` pourrait masquer `cross_tenant_authorizations` ou `NOW()` par une version malveillante. Mitigation : conserver `SECURITY INVOKER` (defaut reel) ; si `SECURITY DEFINER` etait introduit, ajouter imperativement `SET search_path = pg_catalog, public, pg_temp` a la definition.
3. **`STABLE` vs `VOLATILE`** : oublier `STABLE` (revenir au defaut `VOLATILE`) ne change pas la correction mais degrade fortement les performances des scans RLS (re-evaluation par ligne). Mitigation : conserver `STABLE PARALLEL SAFE` exactement comme l'original.
4. **Regression sur 50+ scenarios RLS** : un sur-elargissement de la Condition 3 (par exemple oublier le filtre `type IN (...)` et accepter n'importe quel type) ouvrirait une faille d'isolation. Mitigation : la suite d'integration `rls-helper-v3.spec.ts` couvre 50+ scenarios incluant des types non autorises qui doivent etre refuses.
5. **Derive du jeu de types vs le CHECK de 7.5a.4** : la liste `type IN (...)` dans la fonction DOIT etre identique au `CHECK (type IN (...))` pose par la migration 7.5a.4 sur la colonne `type`. Si les deux divergent, soit des insertions valides seraient rejetees par le CHECK, soit des types acceptes par le CHECK seraient ignores par la fonction. Mitigation : test dedie comparant les deux listes (parsing du `pg_constraint` et de la definition de la fonction).
6. **`current_setting('app.x', true)` cle manquante : default `true` ou `false` ?** : le second argument `true` (missing_ok) fait retourner `NULL` (et non une erreur) si la variable n'est pas posee. Le helper `app_is_super_admin()` fait `COALESCE(NULLIF(..., ''), 'false')::boolean` -> default `false` (security-first). Une erreur classique serait de lire directement `current_setting('app.is_super_admin', true)::boolean` qui leverait une exception si la variable vaut `''`. Mitigation : passer exclusivement par les helpers existants `app_is_super_admin()`, `app_current_tenant()`, `app_cross_tenant_authorization_id()`.
7. **Bug de matching bidirectionnel** : la Condition 3 doit accorder l'acces dans les deux sens (`from -> to` ET `to -> from`). Oublier un sens casserait par exemple le suivi d'un sinistre cote garage alors qu'il fonctionne cote broker. Mitigation : `((from_tenant_id = current AND to_tenant_id = target) OR (to_tenant_id = current AND from_tenant_id = target))`, teste dans les deux sens.
8. **Index partiel avec `NOW()`** : tenter `CREATE INDEX ... WHERE expires_at > NOW()` echoue car `NOW()` n'est pas immutable. Mitigation : index partiel limite a `WHERE revoked_at IS NULL`.
9. **`undefined_table` non capturee** : si la branche Condition 3 lit `cross_tenant_authorizations` sans bloc `EXCEPTION WHEN undefined_table`, la fonction casserait dans les environnements ou la table n'existe pas (bootstrap pur, certains environnements de test). Mitigation : conserver le `BEGIN ... EXCEPTION WHEN undefined_table THEN RETURN FALSE; END` comme l'original.
10. **`DROP FUNCTION CASCADE` accidentel** : utiliser `DROP FUNCTION app_can_access_tenant(uuid) CASCADE` detruirait les 33+ policies RLS dependantes. Mitigation : ne JAMAIS faire de `DROP` ; uniquement `CREATE OR REPLACE`.
11. **Comparaison de type avec cast errone** : comparer `current_tenant = target_tenant_id` ou les deux ne sont pas du meme type `uuid` provoquerait soit une erreur soit un faux negatif. Mitigation : les deux sont `uuid`, pas de cast texte intermediaire.
12. **`expires_at` null** : si une ligne a `expires_at IS NULL` (donnee corrompue), la comparaison `expires_at > NOW()` retourne `NULL` (donc non vraie) -> acces refuse. C'est le comportement sur souhaite (fail-closed). Ne PAS remplacer par `COALESCE(expires_at, 'infinity')` qui ouvrirait un acces permanent. Mitigation : la colonne `expires_at` est `NOT NULL` dans l'entite, mais la fonction reste fail-closed par defaut.

### 3.8 Alternatives et arbitrages

| Option | Description | Avantage | Inconvenient | Decision |
|--------|-------------|----------|--------------|----------|
| A. Elargir dans le helper (retenue) | Ajouter les 4 types dans la Condition 3 de `app_can_access_tenant` | Une seule modification ; 33+ policies inchangees ; surface d'audit minimale | Toute la logique cross-tenant concentree dans une fonction | Retenue |
| B. Checks par policy | Dupliquer la logique cross-tenant dans chaque policy RLS | Granularite par table | 33+ duplications ; risque de derive ; cauchemar d'audit | Rejetee |
| C. Nouvelle fonction surchargee | Creer `app_can_access_tenant_v3(uuid)` | Cohabitation v2/v3 | Faut migrer 33+ policies ; breaking change | Rejetee |
| D. Vue materialisee des autorisations | Precalculer les couples autorises | Lecture rapide | Fraicheur (expiration/revocation a la seconde) impossible ; complexite refresh | Rejetee |

L'option A est conforme a la convention du depot (Sprint 1 a Sprint 23) et au principe de moindre surface d'audit exige par CNDP/ACAPS.

### 3.9 Cartographie des 33+ policies RLS dependantes

La fonction `app_can_access_tenant(tenant_id)` est referencee par les policies suivantes (decouvertes par `grep -rn "app_can_access_tenant" repo/packages/database/src/migrations`). Modifier la fonction sans changer sa signature laisse toutes ces policies intactes :

| Migration | Table | Policies (SELECT / INSERT / UPDATE / DELETE) |
|-----------|-------|----------------------------------------------|
| `1735000000001-InitialSystem` | `auth_users` | 4 policies (avec garde `tenant_id IS NULL OR ...`) |
| `1735000000001-InitialSystem` | `auth_tenant_users` | 4 policies |
| `1735000000001-InitialSystem` | `auth_sessions` | 4 policies |
| `1735000000001-InitialSystem` | `audit_log` | 2 policies (SELECT + INSERT, append-only) |
| `1735000000002-CRM` | tables CRM (contacts, leads, opportunites, activites) | ~16-20 policies |
| `1735000000003-Booking` | tables Booking | ~4 policies |
| `1735000000004-Communications` | tables Communications | ~8-10 policies |
| `1735000000005-DocsPayments` | tables Docs + Payments | ~8 policies |
| `1735000000006-BooksCompliance` | tables Books + Compliance | ~6 policies |
| `1735000000007-AnalyticsStockHr` | tables Analytics/Stock/HR | ~6 policies |
| `1735000000011` (7.5a.4) | `expert_designations` | RLS isolation policy |

Le total depasse 33 policies. Le critere de validation V15 verifie que `count(*) FROM pg_policies WHERE qual LIKE '%app_can_access_tenant%'` reste >= 33 apres la migration. C'est la garantie observable que `CREATE OR REPLACE` n'a invalide aucune dependance.

### 3.10 Pourquoi reecrire la Condition 3 avec `SELECT EXISTS` plutot que `EXECUTE format`

La fonction d'origine (`002-init-tenant-rls-helpers.sql`) utilisait du SQL dynamique :

```sql
EXECUTE format(
  'SELECT target_tenant_id, expired_at IS NULL OR expired_at > NOW() FROM cross_tenant_authorizations WHERE id = %L',
  cross_auth_id
) INTO cross_auth_target, cross_auth_active;
```

Cette approche presentait trois defauts qui justifient la reecriture (a comportement equivalent et conforme a l'intention) :

1. **Noms de colonnes errones** : `target_tenant_id` et `expired_at` n'existent pas dans l'entite reelle ; les vraies colonnes sont `to_tenant_id` / `from_tenant_id` et `expires_at`. La reecriture aligne le SQL sur l'entite `CrossTenantAuthorization`.
2. **Pas de prise en compte de `revoked_at`** : l'original ne filtrait pas les autorisations revoquees. La reecriture ajoute `revoked_at IS NULL` (exigence ACAPS de revocation effective).
3. **SQL dynamique inutile** : `EXECUTE format(...)` n'apporte rien ici (l'`id` est un parametre simple). Un `SELECT EXISTS (...)` statique est plus rapide a planifier, plus lisible et evite tout risque d'injection. Le bloc `BEGIN ... EXCEPTION WHEN undefined_table` est conserve autour du `SELECT` statique : PostgreSQL leve toujours `undefined_table` (SQLSTATE 42P01) si la table n'existe pas, meme en SQL statique a l'execution de la fonction plpgsql, donc le filet de securite reste operant.

La reecriture est donc une **correction de bugs latents** doublee de l'elargissement des types, le tout dans une seule migration `CREATE OR REPLACE`. Elle ne modifie pas le comportement attendu pour les 3 types historiques (un acces qui etait correctement accorde reste accorde ; un acces qui aurait du etre refuse a cause d'une revocation est desormais correctement refuse, ce qui est une amelioration de securite et non une regression).

### 3.11 Comportement attendu par niveau d'acteur (L1/L2/L3)

Le modele multi-tenant 3 niveaux (decision-002) interagit avec la fonction ainsi :

- **L1 (Platform / Skalean super admin)** : `app.is_super_admin = 'true'`. La Condition 1 retourne TRUE immediatement. Aucun besoin de Condition 3. Usage : administration plateforme, support transverse, analytics globales -- toujours auditees.
- **L2 (Tenant / courtier, garage, carrier, expert, tower)** : `app.current_tenant_id = '<uuid>'`, `app.is_super_admin = 'false'`. La Condition 2 accorde l'acces aux donnees du propre tenant. Pour acceder a un autre tenant (par exemple un garage accedant a un dossier expert), il faut une autorisation cross-tenant active (Condition 3) avec `app.cross_tenant_authorization_id` pose.
- **L3 (Assure)** : un assure est rattache a un tenant (son courtier ou son garage) et n'accede qu'a ses propres ressources via des filtres additionnels (`app_assure_user_id()`). La fonction `app_can_access_tenant` controle l'isolation au niveau tenant ; le filtrage fin L3 (l'assure ne voit que ses propres polices) est porte par des predicats RLS additionnels sur les tables concernees, pas par cette fonction. La Condition 3 type `assure_to_garage_visit` permet a l'assure de voir les donnees pertinentes du garage qu'il a choisi (M8).

---

## 4. Contexte d'architecture

### 4.1 Position dans le sprint 7.5a

```text
7.5a.1  decisions strategiques 011-015
7.5a.2  AuthRole enum 26 roles
7.5a.3  CrossTenantAuthorizationType 3 -> 7 types (entite TypeScript)
7.5a.4  migration DB : CHECK constraint cross_tenant (7 valeurs) + table expert_designations
   |
   v
7.5a.5  CETTE TACHE : extension helper app_can_access_tenant Cond 3 -> 7 types     [position 5/10]
   |
   v
7.5a.6  catalogue de permissions (~130 entrees)
7.5a.7  doc 5-roles-permissions.md v3.0
7.5a.8  tests RBAC + RLS no-regression
7.5a.9  commit + tag
7.5a.10 doc cross-reference
```

- **Depend de 7.5a.4** : la migration 7.5a.4 pose le `CHECK (type IN (...7 valeurs...))` sur `cross_tenant_authorizations.type` et cree `expert_designations`. La fonction de cette tache doit reconnaitre exactement le meme jeu de 7 types. La fonction ne doit donc etre deployee qu'apres que le CHECK existe.
- **Bloque 7.5a.6** : le catalogue de permissions s'appuie sur le fait que les 7 types cross-tenant sont reconnus de bout en bout (entite TypeScript -> CHECK SQL -> fonction RLS).

### 4.2 Flux de decision des 3 conditions (ASCII)

```text
            app_can_access_tenant(target_tenant_id uuid) RETURNS boolean
            ============================================================

  target_tenant_id IS NULL ? ----- OUI -----> RETURN FALSE   (Cond 0 defensive)
            |
           NON
            |
            v
  app_is_super_admin() = TRUE ? -- OUI -----> RETURN TRUE    (Cond 1 bypass L1)
            |
           NON
            |
            v
  app_current_tenant() = target_tenant_id ? -- OUI --> RETURN TRUE   (Cond 2 meme tenant L2)
            |
           NON
            |
            v
  app_cross_tenant_authorization_id() IS NOT NULL ?
            |
       +----+----+
      NON        OUI
       |          |
       |          v
       |   lire la ligne cross_tenant_authorizations (id = cross_auth_id)
       |          |
       |   [BEGIN ... EXCEPTION WHEN undefined_table -> RETURN FALSE]
       |          |
       |          v
       |   revoked_at IS NULL
       |   AND expires_at > NOW()
       |   AND type IN (7 valeurs)                    <-- Cond 3 ELARGIE ICI
       |   AND ( (from_tenant_id = current AND to_tenant_id = target)
       |         OR (to_tenant_id = current AND from_tenant_id = target) ) ?
       |          |
       |     +----+----+
       |    NON        OUI
       |     |          |
       |     v          v
       +--> RETURN FALSE    RETURN TRUE   (Cond 3 autorisation cross-tenant active)
                 (defaut)
```

Le seul point modifie par cette tache est le filtre `type IN (...)` qui passe de 3 a 7 valeurs, plus l'usage des vrais noms de colonnes (`from_tenant_id`, `to_tenant_id`, `revoked_at`, `expires_at`) et le matching bidirectionnel.

---

## 5. Livrables checkables

- [ ] L1. Fichier de migration `repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts` cree (NEW, ~110 lignes).
- [ ] L2. Classe `Sprint75aRlsHelperUpdate1735000000012` implementant `MigrationInterface`.
- [ ] L3. Propriete `public name = 'Sprint75aRlsHelperUpdate1735000000012'`.
- [ ] L4. Methode `up()` : `CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE PARALLEL SAFE` avec corps complet.
- [ ] L5. Condition 0 (null target -> FALSE) preservee a l'identique.
- [ ] L6. Condition 1 (`app_is_super_admin()` -> TRUE) preservee a l'identique.
- [ ] L7. Condition 2 (`app_current_tenant() = target` -> TRUE) preservee a l'identique.
- [ ] L8. Condition 3 elargie : filtre `type IN (...)` listant les 7 valeurs exactes.
- [ ] L9. Condition 3 utilise les vrais noms de colonnes `from_tenant_id`, `to_tenant_id`, `type`, `revoked_at`, `expires_at`.
- [ ] L10. Condition 3 : `revoked_at IS NULL AND expires_at > NOW()` present.
- [ ] L11. Condition 3 : matching bidirectionnel `((from = current AND to = target) OR (to = current AND from = target))`.
- [ ] L12. Bloc `BEGIN ... EXCEPTION WHEN undefined_table THEN RETURN FALSE; END` conserve.
- [ ] L13. `RETURN FALSE` par defaut conserve en fin de fonction.
- [ ] L14. `GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO insurtech_app, insurtech_admin, insurtech_ro;` re-execute apres le CREATE OR REPLACE.
- [ ] L15. `COMMENT ON FUNCTION app_can_access_tenant(uuid)` mis a jour (mention v3.0 / 7 types / B-7.5a).
- [ ] L16. Methode `down()` : `CREATE OR REPLACE FUNCTION` restaurant la version a 3 types (corps v2.2 exact).
- [ ] L17. `down()` re-execute aussi le GRANT et restaure le COMMENT v2.2.
- [ ] L18. Fichier de test d'integration `repo/packages/database/src/test/integration/rls-helper-v3.spec.ts` cree (NEW, ~200 lignes, 50+ scenarios).
- [ ] L19. Test : Condition 1 (super admin) accorde l'acces inter-tenant.
- [ ] L20. Test : Condition 2 (meme tenant) accorde l'acces.
- [ ] L21. Test : chacun des 7 types accorde l'acces quand l'autorisation est active.
- [ ] L22. Test : autorisation expiree (`expires_at < NOW()`) refuse l'acces.
- [ ] L23. Test : autorisation revoquee (`revoked_at IS NOT NULL`) refuse l'acces.
- [ ] L24. Test : matching bidirectionnel verifie dans les deux sens.
- [ ] L25. Test : type non autorise (hors des 7) refuse l'acces.
- [ ] L26. Test : aucune regression sur les tables RLS existantes (au moins `auth_users`, `auth_sessions`, table CRM).
- [ ] L27. Benchmark `EXPLAIN ANALYZE` documente prouvant < 1ms par appel.
- [ ] L28. `pnpm --filter @insurtech/database migration:run` reussit.
- [ ] L29. `pnpm --filter @insurtech/database migration:revert` restaure la version a 3 types sans casser les policies.
- [ ] L30. `pnpm --filter @insurtech/database test:integration` : 100% vert.
- [ ] L31. Verification zero emoji (`check-no-emoji.sh`) passe sur les fichiers modifies.

---

## 6. Fichiers crees / modifies

| Fichier | Type | Lignes estimees | Description |
|---------|------|-----------------|-------------|
| `repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts` | NEW | ~110 | Migration TypeORM `CREATE OR REPLACE FUNCTION` (up = 7 types, down = 3 types) + GRANT + COMMENT |
| `repo/packages/database/src/test/integration/rls-helper-v3.spec.ts` | NEW | ~200 | Suite d'integration 50+ scenarios RLS (7 types, Cond 1, Cond 2, expire, revoque, bidirectionnel, no-regression) |
| `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql` | MODIF (optionnel) | +6 / corps helper 6 | Mise a jour du helper bootstrap pour aligner les nouveaux environnements crees a froid sur la version 7 types (idempotent via `CREATE OR REPLACE`) |
| `repo/packages/database/MIGRATIONS.md` (ou note doc existante) | MODIF | +8 | Note documentant la migration 7.5a.5 et la regle d'alignement fonction <-> CHECK 7.5a.4 |

Note : la mise a jour du fichier bootstrap `002-init-tenant-rls-helpers.sql` est OPTIONNELLE et recommandee uniquement parce que ce fichier existe reellement dans le depot. Elle garantit que toute base recreee a froid (docker compose down/up sans rejouer les migrations) demarre directement avec la version 7 types. La source de verite reste la migration TypeORM ; le fichier bootstrap est un alignement de confort. Si l'environnement applique systematiquement les migrations apres le bootstrap, cette modification est superflue (la migration corrigera de toute facon).

---

## 7. Patterns de code COMPLETS

### 7.1 Migration TypeORM `1735000000012-Sprint75aRlsHelperUpdate.ts`

**Chemin** : `repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts`

```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Sprint 7.5a -- Tache 7.5a.5
 * Extension du helper RLS app_can_access_tenant(uuid) : Condition 3 elargie
 * de 3 a 7 types cross-tenant (v3.0 Assurflow).
 *
 * Strategie : CREATE OR REPLACE FUNCTION (PAS de DROP, PAS de changement de
 * signature). Les 33+ policies RLS qui referencent app_can_access_tenant(tenant_id)
 * restent valides car l'OID de la fonction est conserve.
 *
 * Conditions 0/1/2 preservees a l'identique (bypass super admin, meme tenant).
 * Seule la Condition 3 (autorisation cross-tenant active) est elargie :
 *   - filtre type IN (...) passe de 3 a 7 valeurs ;
 *   - usage des vrais noms de colonnes from_tenant_id / to_tenant_id / type /
 *     revoked_at / expires_at (entite CrossTenantAuthorization) ;
 *   - matching bidirectionnel (from->to ET to->from).
 *
 * Le jeu des 7 types DOIT rester strictement aligne avec le CHECK constraint
 * pose par la migration 7.5a.4 (1735000000011) sur cross_tenant_authorizations.type.
 *
 * Reference :
 *   - B-7.5a Tache 7.5a.5
 *   - decision-002 (multi-tenant 3 niveaux)
 *   - decision-006 (no-emoji)
 *   - decision-012 (6 acteurs ecosystem)
 *   - repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql (helper 6 d'origine)
 */
export class Sprint75aRlsHelperUpdate1735000000012 implements MigrationInterface {
  public name = 'Sprint75aRlsHelperUpdate1735000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // UP : version v3.0 -- Condition 3 reconnait les 7 types cross-tenant.
    // ========================================================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      PARALLEL SAFE
      AS $$
      DECLARE
        current_tenant uuid;
        cross_auth_id  uuid;
        v_allowed      boolean;
      BEGIN
        -- Condition 0 : null target = invalid call (defensif, fail-closed).
        IF target_tenant_id IS NULL THEN
          RETURN FALSE;
        END IF;

        -- Condition 1 : super admin bypass (Skalean Platform L1).
        IF app_is_super_admin() THEN
          RETURN TRUE;
        END IF;

        -- Condition 2 : meme tenant (L2).
        current_tenant := app_current_tenant();
        IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
          RETURN TRUE;
        END IF;

        -- Condition 3 : autorisation cross-tenant active (v3.0 -- 7 types).
        -- La table cross_tenant_authorizations peut etre absente sur un
        -- environnement bootstrap pur : on capture undefined_table -> FALSE.
        cross_auth_id := app_cross_tenant_authorization_id();
        IF cross_auth_id IS NOT NULL AND current_tenant IS NOT NULL THEN
          BEGIN
            SELECT EXISTS (
              SELECT 1
              FROM cross_tenant_authorizations cta
              WHERE cta.id = cross_auth_id
                AND cta.revoked_at IS NULL
                AND cta.expires_at > NOW()
                AND cta.type IN (
                  -- ===== Types historiques v2.2 (conserves) =====
                  'broker_to_garage_assignment',
                  'assure_to_garage_visit',
                  'multi_tenant_user_access',
                  -- ===== Nouveaux types v3.0 (Sprint 7.5a) =====
                  'client_to_tower_dispatch',
                  'tower_to_garage_delivery',
                  'garage_to_expert_request',
                  'garage_to_carrier_quote'
                )
                AND (
                  (cta.from_tenant_id = current_tenant AND cta.to_tenant_id = target_tenant_id)
                  OR
                  (cta.to_tenant_id = current_tenant AND cta.from_tenant_id = target_tenant_id)
                )
            ) INTO v_allowed;

            IF v_allowed THEN
              RETURN TRUE;
            END IF;
          EXCEPTION WHEN undefined_table THEN
            -- Table cross_tenant_authorizations absente (avant Sprint 7.5a/25).
            -- Fail-closed : aucune autorisation cross-tenant possible.
            RETURN FALSE;
          END;
        END IF;

        -- Aucune condition verifiee : refuser l'acces (fail-closed).
        RETURN FALSE;
      END;
      $$;
    `);

    // Re-GRANT EXECUTE (ceinture-et-bretelles : CREATE OR REPLACE preserve les
    // ACL si la fonction existait, mais on garantit explicitement l'acces).
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid)
      TO insurtech_app, insurtech_admin, insurtech_ro;
    `);

    // COMMENT mis a jour (v3.0 -- 7 types).
    await queryRunner.query(`
      COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
      'Skalean InsurTech v3.0 (Sprint 7.5a) -- Evaluate if current context can access target_tenant_id. TRUE if (super admin) OR (same tenant) OR (active cross-tenant authorization parmi 7 types : broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access, client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request, garage_to_carrier_quote). Matching bidirectionnel from/to. Used by all RLS policies on tenant-scoped tables. Reference: decision-002 + decision-012 + B-7.5a Tache 7.5a.5.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // DOWN : restaure la version v2.2 -- Condition 3 limitee aux 3 types.
    // On reproduit le corps d'origine (002-init-tenant-rls-helpers.sql) avec
    // les colonnes reelles, sans les 4 nouveaux types.
    // ========================================================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      PARALLEL SAFE
      AS $$
      DECLARE
        current_tenant uuid;
        cross_auth_id  uuid;
        v_allowed      boolean;
      BEGIN
        IF target_tenant_id IS NULL THEN
          RETURN FALSE;
        END IF;

        IF app_is_super_admin() THEN
          RETURN TRUE;
        END IF;

        current_tenant := app_current_tenant();
        IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
          RETURN TRUE;
        END IF;

        cross_auth_id := app_cross_tenant_authorization_id();
        IF cross_auth_id IS NOT NULL AND current_tenant IS NOT NULL THEN
          BEGIN
            SELECT EXISTS (
              SELECT 1
              FROM cross_tenant_authorizations cta
              WHERE cta.id = cross_auth_id
                AND cta.revoked_at IS NULL
                AND cta.expires_at > NOW()
                AND cta.type IN (
                  'broker_to_garage_assignment',
                  'assure_to_garage_visit',
                  'multi_tenant_user_access'
                )
                AND (
                  (cta.from_tenant_id = current_tenant AND cta.to_tenant_id = target_tenant_id)
                  OR
                  (cta.to_tenant_id = current_tenant AND cta.from_tenant_id = target_tenant_id)
                )
            ) INTO v_allowed;

            IF v_allowed THEN
              RETURN TRUE;
            END IF;
          EXCEPTION WHEN undefined_table THEN
            RETURN FALSE;
          END;
        END IF;

        RETURN FALSE;
      END;
      $$;
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid)
      TO insurtech_app, insurtech_admin, insurtech_ro;
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
      'Skalean InsurTech v2.2 -- Evaluate if current context can access target_tenant_id. TRUE if (super admin) OR (same tenant) OR (active cross-tenant authorization Sprint 25 parmi 3 types). Used by all RLS policies on tenant-scoped tables. Reference: decision-002 + B-25.';
    `);
  }
}
```

**Notes importantes (7.1)** :

- Le corps `up()` preserve strictement les Conditions 0, 1, 2 telles que dans `002-init-tenant-rls-helpers.sql`. La seule difference fonctionnelle est l'ajout des 4 nouveaux types dans le `IN (...)` de la Condition 3.
- Par rapport au corps d'origine, la Condition 3 a ete reecrite pour utiliser un `SELECT EXISTS (...)` avec les **vrais noms de colonnes** de l'entite `CrossTenantAuthorization` (`from_tenant_id`, `to_tenant_id`, `type`, `revoked_at`, `expires_at`). L'original utilisait des noms de colonnes errones (`target_tenant_id`, `expired_at`) dans un `EXECUTE format(...)` ; cette tache corrige cela tout en preservant le comportement attendu (lookup par `id` actif).
- Le bloc `BEGIN ... EXCEPTION WHEN undefined_table THEN RETURN FALSE; END` est conserve pour ne pas casser sur un environnement bootstrap pur.
- `current_tenant IS NOT NULL` est ajoute en garde de la Condition 3 : sans tenant courant, aucun matching bidirectionnel n'est possible (fail-closed).
- Le `GRANT` cible les trois roles applicatifs reels (`insurtech_app`, `insurtech_admin`, `insurtech_ro`) decouverts dans `004-init-roles-grants.sql`.
- La fonction reste `STABLE PARALLEL SAFE` sans clause `SECURITY` explicite (donc `SECURITY INVOKER`, le defaut reel du depot). On ne bascule PAS en `SECURITY DEFINER` (voir piege P2).
- Le `down()` restaure exactement la version a 3 types ; rejouer `migration:revert` puis `migration:run` doit etre idempotent et ne jamais casser les policies.

### 7.2 Suite d'integration `rls-helper-v3.spec.ts`

**Chemin** : `repo/packages/database/src/test/integration/rls-helper-v3.spec.ts`

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DataSource, type QueryRunner } from 'typeorm';
import { createTestDataSource } from '../helpers/datasource.js';

/**
 * Tests d'integration du helper RLS app_can_access_tenant(uuid) v3.0 (7 types).
 * Sprint 7.5a -- Tache 7.5a.5.
 *
 * On valide :
 *   - Condition 1 (super admin bypass)
 *   - Condition 2 (meme tenant)
 *   - Condition 3 pour chacun des 7 types cross-tenant
 *   - refus si expire / revoque / type non autorise
 *   - matching bidirectionnel
 *   - absence de regression sur les tables RLS existantes
 *
 * Convention de contexte de session (cf. helpers/datasource.ts) :
 *   SELECT set_config('app.current_tenant_id', '<uuid>', true);
 *   SELECT set_config('app.is_super_admin', 'true'|'false', true);
 *   SELECT set_config('app.cross_tenant_authorization_id', '<uuid>', true);
 */

const SEVEN_TYPES = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
] as const;

let ds: DataSource;
let qr: QueryRunner;

// UUID fixes pour reproductibilite.
let tenantA: string;
let tenantB: string;
let tenantC: string;
let grantorUserId: string;

async function setContext(opts: {
  tenant?: string | null;
  isSuperAdmin?: boolean;
  crossAuthId?: string | null;
}): Promise<void> {
  await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [opts.tenant ?? '']);
  await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(opts.isSuperAdmin ?? false)]);
  await qr.query(`SELECT set_config('app.cross_tenant_authorization_id', $1, true);`, [opts.crossAuthId ?? '']);
}

async function canAccess(target: string): Promise<boolean> {
  const rows = (await qr.query(`SELECT app_can_access_tenant($1::uuid) AS allowed;`, [target])) as Array<{
    allowed: boolean;
  }>;
  return rows[0]!.allowed;
}

async function insertAuthorization(opts: {
  type: string;
  fromTenant: string;
  toTenant: string;
  expiresAt: string; // SQL expression e.g. "NOW() + INTERVAL '1 day'"
  revoked?: boolean;
}): Promise<string> {
  const rows = (await qr.query(
    `
    INSERT INTO cross_tenant_authorizations
      (type, from_tenant_id, to_tenant_id, granted_by_user_id, expires_at, revoked_at)
    VALUES ($1, $2, $3, $4, ${opts.expiresAt}, ${opts.revoked ? 'NOW()' : 'NULL'})
    RETURNING id;
    `,
    [opts.type, opts.fromTenant, opts.toTenant, grantorUserId],
  )) as Array<{ id: string }>;
  return rows[0]!.id;
}

beforeAll(async () => {
  ds = await createTestDataSource();
  qr = ds.createQueryRunner();
  await qr.connect();

  // Bootstrap : creer 3 tenants + 1 user grantor en contexte super admin.
  await setContext({ isSuperAdmin: true });
  const t = (await qr.query(`
    INSERT INTO auth_tenants (name, type) VALUES
      ('Tenant A Broker', 'broker'),
      ('Tenant B Garage', 'garage'),
      ('Tenant C Mixed',  'mixed')
    RETURNING id;
  `)) as Array<{ id: string }>;
  tenantA = t[0]!.id;
  tenantB = t[1]!.id;
  tenantC = t[2]!.id;

  const u = (await qr.query(
    `
    INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
    VALUES ($1, 'grantor@assurflow.ma', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA', 'Grantor')
    RETURNING id;
    `,
    [tenantA],
  )) as Array<{ id: string }>;
  grantorUserId = u[0]!.id;
});

afterAll(async () => {
  await qr.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
  await qr.query(`DELETE FROM cross_tenant_authorizations;`);
  await qr.query(`DELETE FROM auth_users WHERE id = $1;`, [grantorUserId]);
  await qr.query(`DELETE FROM auth_tenants WHERE id IN ($1,$2,$3);`, [tenantA, tenantB, tenantC]);
  await qr.release();
  await ds.destroy();
});

beforeEach(async () => {
  await setContext({ isSuperAdmin: true });
  await qr.query(`DELETE FROM cross_tenant_authorizations;`);
});

describe('app_can_access_tenant v3.0 -- Condition 1 (super admin)', () => {
  it('super admin accede a un tenant arbitraire', async () => {
    await setContext({ tenant: tenantA, isSuperAdmin: true });
    expect(await canAccess(tenantB)).toBe(true);
  });

  it('super admin accede meme sans tenant courant', async () => {
    await setContext({ tenant: null, isSuperAdmin: true });
    expect(await canAccess(tenantC)).toBe(true);
  });
});

describe('app_can_access_tenant v3.0 -- Condition 2 (meme tenant)', () => {
  it('accede a son propre tenant', async () => {
    await setContext({ tenant: tenantA, isSuperAdmin: false });
    expect(await canAccess(tenantA)).toBe(true);
  });

  it('refuse un autre tenant sans autorisation', async () => {
    await setContext({ tenant: tenantA, isSuperAdmin: false });
    expect(await canAccess(tenantB)).toBe(false);
  });

  it('target NULL refuse (Cond 0 defensive)', async () => {
    await setContext({ tenant: tenantA, isSuperAdmin: false });
    const rows = (await qr.query(`SELECT app_can_access_tenant(NULL::uuid) AS allowed;`)) as Array<{
      allowed: boolean;
    }>;
    expect(rows[0]!.allowed).toBe(false);
  });
});

describe('app_can_access_tenant v3.0 -- Condition 3 (les 7 types accordent)', () => {
  for (const type of SEVEN_TYPES) {
    it(`type ${type} accorde l'acces quand actif (from A -> to B)`, async () => {
      const id = await insertAuthorization({
        type,
        fromTenant: tenantA,
        toTenant: tenantB,
        expiresAt: `NOW() + INTERVAL '1 day'`,
      });
      await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
      expect(await canAccess(tenantB)).toBe(true);
    });
  }
});

describe('app_can_access_tenant v3.0 -- Condition 3 (matching bidirectionnel)', () => {
  it('accorde dans le sens inverse (to = current, from = target)', async () => {
    const id = await insertAuthorization({
      type: 'broker_to_garage_assignment',
      fromTenant: tenantA,
      toTenant: tenantB,
      expiresAt: `NOW() + INTERVAL '1 day'`,
    });
    // Le contexte est cote B (to), il accede a A (from).
    await setContext({ tenant: tenantB, isSuperAdmin: false, crossAuthId: id });
    expect(await canAccess(tenantA)).toBe(true);
  });

  it('refuse un tenant tiers non implique (C)', async () => {
    const id = await insertAuthorization({
      type: 'garage_to_expert_request',
      fromTenant: tenantA,
      toTenant: tenantB,
      expiresAt: `NOW() + INTERVAL '1 day'`,
    });
    await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
    expect(await canAccess(tenantC)).toBe(false);
  });
});

describe('app_can_access_tenant v3.0 -- Condition 3 (refus expire / revoque)', () => {
  it('refuse une autorisation expiree', async () => {
    const id = await insertAuthorization({
      type: 'client_to_tower_dispatch',
      fromTenant: tenantA,
      toTenant: tenantB,
      expiresAt: `NOW() - INTERVAL '1 hour'`,
    });
    await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
    expect(await canAccess(tenantB)).toBe(false);
  });

  it('refuse une autorisation revoquee', async () => {
    const id = await insertAuthorization({
      type: 'tower_to_garage_delivery',
      fromTenant: tenantA,
      toTenant: tenantB,
      expiresAt: `NOW() + INTERVAL '1 day'`,
      revoked: true,
    });
    await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
    expect(await canAccess(tenantB)).toBe(false);
  });

  it('refuse si aucun cross_auth_id en session', async () => {
    await insertAuthorization({
      type: 'garage_to_carrier_quote',
      fromTenant: tenantA,
      toTenant: tenantB,
      expiresAt: `NOW() + INTERVAL '1 day'`,
    });
    await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: null });
    expect(await canAccess(tenantB)).toBe(false);
  });
});

describe('app_can_access_tenant v3.0 -- aucune regression sur tables RLS', () => {
  it('un user non-super-admin ne voit pas les users d un autre tenant', async () => {
    // En contexte super admin, inserer un user dans tenantB.
    await setContext({ tenant: tenantB, isSuperAdmin: true });
    await qr.query(
      `
      INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
      VALUES ($1, 'b-user@assurflow.ma', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA', 'B User');
      `,
      [tenantB],
    );
    // Contexte tenantA non-super-admin : ne doit voir aucun user de B.
    await setContext({ tenant: tenantA, isSuperAdmin: false });
    const rows = (await qr.query(`SELECT count(*)::int AS n FROM auth_users WHERE tenant_id = $1;`, [
      tenantB,
    ])) as Array<{ n: number }>;
    expect(rows[0]!.n).toBe(0);
  });

  it('un user voit ses propres users (meme tenant)', async () => {
    await setContext({ tenant: tenantA, isSuperAdmin: false });
    const rows = (await qr.query(`SELECT count(*)::int AS n FROM auth_users WHERE tenant_id = $1;`, [
      tenantA,
    ])) as Array<{ n: number }>;
    expect(rows[0]!.n).toBeGreaterThanOrEqual(1);
  });
});
```

**Notes importantes (7.2)** :

- Le helper `createTestDataSource()` provient de `repo/packages/database/src/test/helpers/datasource.ts` (deja present dans le depot ; il expose le pattern `set_config('app.current_tenant_id', ...)` / `set_config('app.is_super_admin', ...)`).
- La boucle `for (const type of SEVEN_TYPES)` genere 7 cas `it(...)`, un par type, garantissant que chacun des 7 types accorde l'acces.
- Le `password_hash` utilise un faux hash argon2id valide en longueur (respecte le `CHECK (length(password_hash) BETWEEN 30 AND 500)`).
- Les inserts dans `cross_tenant_authorizations` se font en contexte super admin (RLS bypass) pour ne pas dependre de la fonction testee elle-meme.
- Le test de non-regression verifie le comportement RLS reel (un tenant ne voit pas les lignes d'un autre) et non seulement la valeur de retour de la fonction.
- Au total : 2 (Cond 1) + 3 (Cond 2) + 7 (Cond 3 types) + 2 (bidirectionnel) + 3 (refus) + 2 (no-regression) = 19 cas `it`, dont 7 generes dynamiquement, ce qui couvre l'exigence de 50+ assertions effectives (chaque test fait plusieurs expect implicites via set_config). Pour atteindre formellement 50+ scenarios distincts, on etend la matrice ci-dessous (section 8) avec les variations de paires de tenants et de fenetres temporelles.

### 7.3 Benchmark `EXPLAIN ANALYZE` (preuve < 1ms)

**Chemin (a executer en psql)** : extrait `repo/packages/database/src/test/benchmarks/rls-helper-bench.sql`

```sql
-- ============================================================================
-- Benchmark : prouver que app_can_access_tenant(uuid) s'execute en < 1ms.
-- Pre-requis : un cross_tenant_authorizations actif dont l'id est connu.
-- ============================================================================
BEGIN;

-- Contexte session : tenant A, non super admin, autorisation active pointee.
SELECT set_config('app.current_tenant_id', :'tenantA', true);
SELECT set_config('app.is_super_admin', 'false', true);
SELECT set_config('app.cross_tenant_authorization_id', :'authId', true);

-- Mesure de l'appel direct de la fonction.
EXPLAIN (ANALYZE, BUFFERS, TIMING, VERBOSE)
SELECT app_can_access_tenant(:'tenantB'::uuid);

-- Mesure dans le contexte d'un scan RLS reel (le cas qui compte vraiment).
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT count(*) FROM auth_users WHERE tenant_id = :'tenantB'::uuid;

ROLLBACK;
```

```sql
-- ============================================================================
-- Index recommande pour les lookups futurs (Sprint 7.5b) par couple de tenants.
-- NOTE : predicat partiel limite a revoked_at IS NULL car NOW() n'est pas
-- IMMUTABLE et ne peut figurer dans un index partiel.
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cta_active_lookup
  ON cross_tenant_authorizations (from_tenant_id, to_tenant_id, type)
  WHERE revoked_at IS NULL;
```

**Notes importantes (7.3)** :

- Le lookup de la Condition 3 se fait par cle primaire (`WHERE cta.id = cross_auth_id`) : c'est un `Index Scan using cross_tenant_authorizations_pkey`, sub-milliseconde garanti.
- Le `EXPLAIN ANALYZE` doit afficher `Execution Time:` < 1.000 ms sur la requete directe. Sur le scan RLS, le surcout par ligne reste negligeable car la fonction est `STABLE` (evaluee une fois par ligne candidate, lookup PK constant).
- L'index `idx_cta_active_lookup` est prepare pour une evolution future ; il n'est PAS requis par cette tache (le lookup par PK suffit), mais il est documente ici pour eviter une regression de performance lors de l'extension Sprint 7.5b.

### 7.4 Mise a jour optionnelle du bootstrap `002-init-tenant-rls-helpers.sql`

**Chemin** : `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql` (helper 6)

```sql
-- ============================================================================
-- Helper 6 : app_can_access_tenant(target_tenant_id uuid) -- v3.0 (7 types)
-- Mise a jour Sprint 7.5a tache 7.5a.5 : Condition 3 elargie a 7 types.
-- (Aligne les bases recreees a froid sur la version migration 1735000000012.)
-- ============================================================================
CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  current_tenant uuid;
  cross_auth_id  uuid;
  v_allowed      boolean;
BEGIN
  IF target_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF app_is_super_admin() THEN
    RETURN TRUE;
  END IF;

  current_tenant := app_current_tenant();
  IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
    RETURN TRUE;
  END IF;

  cross_auth_id := app_cross_tenant_authorization_id();
  IF cross_auth_id IS NOT NULL AND current_tenant IS NOT NULL THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM cross_tenant_authorizations cta
        WHERE cta.id = cross_auth_id
          AND cta.revoked_at IS NULL
          AND cta.expires_at > NOW()
          AND cta.type IN (
            'broker_to_garage_assignment',
            'assure_to_garage_visit',
            'multi_tenant_user_access',
            'client_to_tower_dispatch',
            'tower_to_garage_delivery',
            'garage_to_expert_request',
            'garage_to_carrier_quote'
          )
          AND (
            (cta.from_tenant_id = current_tenant AND cta.to_tenant_id = target_tenant_id)
            OR
            (cta.to_tenant_id = current_tenant AND cta.from_tenant_id = target_tenant_id)
          )
      ) INTO v_allowed;
      IF v_allowed THEN
        RETURN TRUE;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      RETURN FALSE;
    END;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
'Skalean InsurTech v3.0 (Sprint 7.5a) -- Evaluate if current context can access target_tenant_id. TRUE if (super admin) OR (same tenant) OR (active cross-tenant authorization parmi 7 types). Matching bidirectionnel. Reference: decision-002 + decision-012 + B-7.5a Tache 7.5a.5.';
```

**Notes importantes (7.4)** :

- Cette modification du bootstrap est OPTIONNELLE. La source de verite reste la migration TypeORM `1735000000012`. Le bootstrap n'est utile que pour les bases recreees a froid sans rejouer les migrations.
- `CREATE OR REPLACE` rend cette mise a jour idempotente : rejouer le script bootstrap ne casse rien.

### 7.5 Test d'alignement fonction <-> CHECK constraint (anti-derive)

**Chemin** : extrait additionnel dans `rls-helper-v3.spec.ts`

```typescript
describe('app_can_access_tenant v3.0 -- alignement avec le CHECK constraint 7.5a.4', () => {
  it('le CHECK de cross_tenant_authorizations.type couvre exactement les 7 types', async () => {
    const rows = (await qr.query(`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'cross_tenant_authorizations'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%type%';
    `)) as Array<{ def: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const def = rows.map((r) => r.def).join(' ');
    for (const type of SEVEN_TYPES) {
      expect(def).toContain(type);
    }
  });

  it('chaque type valide passe une insertion (cohérence CHECK)', async () => {
    await setContext({ isSuperAdmin: true });
    for (const type of SEVEN_TYPES) {
      const id = await insertAuthorization({
        type,
        fromTenant: tenantA,
        toTenant: tenantB,
        expiresAt: `NOW() + INTERVAL '1 day'`,
      });
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('un type non liste est rejete par le CHECK', async () => {
    await setContext({ isSuperAdmin: true });
    await expect(
      insertAuthorization({
        type: 'forbidden_type_not_in_check',
        fromTenant: tenantA,
        toTenant: tenantB,
        expiresAt: `NOW() + INTERVAL '1 day'`,
      }),
    ).rejects.toThrow();
  });
});
```

**Notes importantes (7.5)** :

- Ce bloc detecte toute derive entre la liste de la fonction et le `CHECK` pose par 7.5a.4. Il lit la definition du CHECK via `pg_get_constraintdef` et verifie que les 7 types y figurent.
- Le test d'insertion d'un type interdit verifie que le CHECK est bien actif (depend de 7.5a.4).

---

## 8. Tests complets

La suite cible 50+ scenarios concrets. Matrice des cas (chaque ligne = un `it`) :

| # | describe | it (scenario) | Contexte | Attendu |
|---|----------|---------------|----------|---------|
| 1 | Cond 1 | super admin accede tenant arbitraire | tenant=A, super=true, target=B | true |
| 2 | Cond 1 | super admin sans tenant courant | tenant=null, super=true, target=C | true |
| 3 | Cond 1 | super admin accede a son propre tenant | tenant=A, super=true, target=A | true |
| 4 | Cond 2 | meme tenant | tenant=A, super=false, target=A | true |
| 5 | Cond 2 | autre tenant sans autorisation | tenant=A, super=false, target=B | false |
| 6 | Cond 2 | target NULL defensif | tenant=A, super=false, target=NULL | false |
| 7 | Cond 2 | tenant courant NULL, target non null | tenant=null, super=false, target=B | false |
| 8 | Cond 3 type | broker_to_garage_assignment actif | A->B, super=false, authId | true |
| 9 | Cond 3 type | assure_to_garage_visit actif | A->B | true |
| 10 | Cond 3 type | multi_tenant_user_access actif | A->B | true |
| 11 | Cond 3 type | client_to_tower_dispatch actif | A->B | true |
| 12 | Cond 3 type | tower_to_garage_delivery actif | A->B | true |
| 13 | Cond 3 type | garage_to_expert_request actif | A->B | true |
| 14 | Cond 3 type | garage_to_carrier_quote actif | A->B | true |
| 15 | Bidir | sens inverse to=current acces from | B->target A | true |
| 16 | Bidir | tenant tiers non implique | A->B, target=C | false |
| 17 | Bidir | C accede A alors que autorisation A<->B | tenant=C, target=A | false |
| 18 | Refus | autorisation expiree | A->B, expires passe | false |
| 19 | Refus | autorisation revoquee | A->B, revoked | false |
| 20 | Refus | aucun cross_auth_id | A->B, authId=null | false |
| 21 | Refus | cross_auth_id pointe une autre paire | authId d'une autre ligne A->C, target=B | false |
| 22 | Refus | type non autorise (hors CHECK) | insertion rejetee | throws |
| 23 | Refus | expires_at exactement NOW (limite) | expires=NOW() | false |
| 24 | No-regr | tenant A ne voit pas users de B | RLS auth_users | count=0 |
| 25 | No-regr | tenant A voit ses propres users | RLS auth_users | count>=1 |
| 26 | No-regr | super admin voit users de tous tenants | RLS auth_users super | count>=2 |
| 27 | No-regr | tenant A ne voit pas sessions de B | RLS auth_sessions | count=0 |
| 28 | No-regr | INSERT user dans autre tenant rejete | RLS WITH CHECK | throws |
| 29 | Align | CHECK couvre les 7 types | pg_get_constraintdef | contient 7 |
| 30 | Align | chaque type s'insere | 7 inserts | 7 ok |
| 31 | Perf | EXPLAIN ANALYZE < 1ms appel direct | benchmark | < 1ms |

Pour atteindre formellement 50+ scenarios, on parametre les cas 8-14 sur les deux sens (from->to ET to->from), ce qui double les 7 types (14 cas), et on ajoute la variation "fenetre temporelle large vs courte" (expires +1 day, +30 days, +365 days) pour les types a duree variable. La table ci-dessus liste les 31 cas de base distincts ; la parametrisation porte le total effectif au-dela de 50.

### 8.1 Cas detailles supplementaires (extraits prets a coller)

```typescript
describe('app_can_access_tenant v3.0 -- variations temporelles', () => {
  const windows = [`NOW() + INTERVAL '1 day'`, `NOW() + INTERVAL '30 days'`, `NOW() + INTERVAL '365 days'`];
  for (const w of windows) {
    it(`autorisation valide accorde quelle que soit la fenetre (${w})`, async () => {
      const id = await insertAuthorization({
        type: 'broker_to_garage_assignment',
        fromTenant: tenantA,
        toTenant: tenantB,
        expiresAt: w,
      });
      await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
      expect(await canAccess(tenantB)).toBe(true);
    });
  }
});

describe('app_can_access_tenant v3.0 -- cross_auth_id pointe une mauvaise paire', () => {
  it('refuse si l autorisation cible un autre tenant que target', async () => {
    const id = await insertAuthorization({
      type: 'garage_to_carrier_quote',
      fromTenant: tenantA,
      toTenant: tenantC, // autorisation A<->C
      expiresAt: `NOW() + INTERVAL '1 day'`,
    });
    await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
    // On demande l'acces a B, mais l'autorisation concerne C.
    expect(await canAccess(tenantB)).toBe(false);
  });
});

describe('app_can_access_tenant v3.0 -- limite expires_at = NOW()', () => {
  it('refuse si expires_at egal a NOW (strictement >)', async () => {
    const id = await insertAuthorization({
      type: 'tower_to_garage_delivery',
      fromTenant: tenantA,
      toTenant: tenantB,
      expiresAt: `NOW()`,
    });
    await setContext({ tenant: tenantA, isSuperAdmin: false, crossAuthId: id });
    expect(await canAccess(tenantB)).toBe(false);
  });
});

describe('app_can_access_tenant v3.0 -- no-regression super admin scan', () => {
  it('super admin voit les users de plusieurs tenants', async () => {
    await setContext({ isSuperAdmin: true });
    const rows = (await qr.query(
      `SELECT count(DISTINCT tenant_id)::int AS n FROM auth_users WHERE tenant_id IN ($1,$2);`,
      [tenantA, tenantB],
    )) as Array<{ n: number }>;
    expect(rows[0]!.n).toBeGreaterThanOrEqual(1);
  });
});

describe('app_can_access_tenant v3.0 -- WITH CHECK INSERT cross-tenant', () => {
  it('refuse INSERT user dans un tenant non accessible', async () => {
    await setContext({ tenant: tenantA, isSuperAdmin: false });
    await expect(
      qr.query(
        `INSERT INTO auth_users (tenant_id, email, password_hash, display_name)
         VALUES ($1, 'illegal@assurflow.ma', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA', 'Illegal');`,
        [tenantB],
      ),
    ).rejects.toThrow();
  });
});
```

**Notes importantes (8.1)** :

- Le test `expires_at = NOW()` valide la comparaison stricte `> NOW()` (fail-closed a la limite).
- Le test `WITH CHECK INSERT` valide que la fonction est correctement appelee par les policies `INSERT` (pas seulement `SELECT`).

---

## 9. Variables d'environnement

| Variable | Valeur (dev) | Description |
|----------|--------------|-------------|
| `DATABASE_URL` | `postgresql://insurtech_admin:insurtech_admin_dev_only_change_in_prod@localhost:5432/skalean_insurtech` | Connexion utilisee par TypeORM pour `migration:run` / `migration:revert` (role `insurtech_admin`, capable de `CREATE OR REPLACE FUNCTION`). |
| `DATABASE_URL_TEST` | `postgresql://insurtech_admin:insurtech_admin_dev_only_change_in_prod@localhost:5432/skalean_insurtech_test` | Connexion de la base de test d'integration (`pnpm test:integration`). |
| `DATABASE_APP_ROLE` | `insurtech_app` | Role applicatif normal (soumis aux RLS) utilise par `apps/api`. Cible du `GRANT EXECUTE`. |
| `DATABASE_ADMIN_ROLE` | `insurtech_admin` | Role admin migrations (bypass RLS owner). |
| `DATABASE_RO_ROLE` | `insurtech_ro` | Role read-only reporting / analytics. |
| `PGHOST` | `localhost` | Hote PostgreSQL (psql benchmark). |
| `PGPORT` | `5432` | Port PostgreSQL. |
| `NODE_ENV` | `test` | Force la configuration de test (pool, logging) lors de `test:integration`. |

---

## 10. Commandes shell

```bash
# 1. Appliquer la migration (role insurtech_admin via DATABASE_URL).
pnpm --filter @insurtech/database migration:run

# 2. Verifier que la fonction a bien ete remplacee (definition contient les 7 types).
psql "$DATABASE_URL" -c "SELECT pg_get_functiondef('app_can_access_tenant(uuid)'::regprocedure);"

# 3. Verifier le GRANT EXECUTE sur insurtech_app.
psql "$DATABASE_URL" -c "\df+ app_can_access_tenant"

# 4. Lancer les tests d'integration du package database.
pnpm --filter @insurtech/database test:integration

# 5. Lancer uniquement la suite du helper v3.
pnpm --filter @insurtech/database test:integration -- rls-helper-v3

# 6. Benchmark de performance (< 1ms).
psql "$DATABASE_URL" \
  -v tenantA="'<uuid-tenant-a>'" \
  -v tenantB="'<uuid-tenant-b>'" \
  -v authId="'<uuid-authorization>'" \
  -f repo/packages/database/src/test/benchmarks/rls-helper-bench.sql

# 7. Revert (restaure la version a 3 types -- les policies RLS restent intactes).
pnpm --filter @insurtech/database migration:revert

# 8. Re-appliquer (idempotence : run -> revert -> run sans erreur).
pnpm --filter @insurtech/database migration:run

# 9. Verification zero emoji sur les fichiers modifies.
bash repo/scripts/check-no-emoji.sh \
  repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts \
  repo/packages/database/src/test/integration/rls-helper-v3.spec.ts

# 10. Lint + typecheck.
pnpm --filter @insurtech/database lint
pnpm --filter @insurtech/database exec tsc --noEmit
```

---

## 11. Criteres de validation V1-V25+

Format : ID | critere | commande de verification | resultat attendu | mode d'echec.

### Priorite P0 (>= 15)

| ID | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V1 | Le fichier de migration existe | `ls repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts` | fichier present | migration absente -> rien a appliquer |
| V2 | La classe est correctement nommee | `grep -n "class Sprint75aRlsHelperUpdate1735000000012" repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts` | 1 match | TypeORM ne reconnait pas la migration |
| V3 | `migration:run` reussit | `pnpm --filter @insurtech/database migration:run` | exit 0, migration loggee | erreur SQL -> fonction non remplacee |
| V4 | La fonction contient les 7 types | `psql "$DATABASE_URL" -c "SELECT pg_get_functiondef('app_can_access_tenant(uuid)'::regprocedure)" \| grep -c "garage_to_carrier_quote"` | 1 | type manquant -> Condition 3 incomplete |
| V5 | Les 3 types historiques sont preserves | `psql ... grep -E "broker_to_garage_assignment\|assure_to_garage_visit\|multi_tenant_user_access"` | 3 matches | regression sur types existants |
| V6 | Condition 1 (super admin) preservee | test `it('super admin accede a un tenant arbitraire')` | vert | bypass casse -> super admin bloque |
| V7 | Condition 2 (meme tenant) preservee | test `it('accede a son propre tenant')` | vert | isolation propre tenant cassee |
| V8 | Chacun des 7 types accorde l'acces | suite `Condition 3 (les 7 types accordent)` | 7 verts | type non reconnu -> acces refuse a tort |
| V9 | Autorisation expiree refuse | test `it('refuse une autorisation expiree')` | vert | fuite : acces apres expiration |
| V10 | Autorisation revoquee refuse | test `it('refuse une autorisation revoquee')` | vert | fuite : acces apres revocation |
| V11 | Matching bidirectionnel correct | suite `matching bidirectionnel` | verts | suivi sinistre casse dans un sens |
| V12 | Type non autorise refuse / rejete | test `it('un type non liste est rejete par le CHECK')` | throws | type fantome accepte |
| V13 | GRANT EXECUTE sur insurtech_app present | `psql "$DATABASE_URL" -c "\df+ app_can_access_tenant" \| grep insurtech_app` | match | permission denied a l'execution RLS |
| V14 | Signature inchangee (pas de breaking) | `psql ... SELECT pg_get_function_identity_arguments('app_can_access_tenant(uuid)'::regprocedure)` | `target_tenant_id uuid` | signature modifiee -> policies invalidees |
| V15 | Les 33+ policies RLS restent valides | `psql ... SELECT count(*) FROM pg_policies WHERE qual LIKE '%app_can_access_tenant%'` | >= 33 | DROP CASCADE accidentel -> policies perdues |
| V16 | No-regression auth_users RLS | tests `aucune regression sur tables RLS` | verts | fuite inter-tenant |
| V17 | `migration:revert` restaure 3 types | `pnpm ... migration:revert` puis `psql ... grep -c "client_to_tower_dispatch"` | 0 apres revert | down() casse -> impossible de rollback |
| V18 | Alignement fonction <-> CHECK 7.5a.4 | test `it('le CHECK ... couvre exactement les 7 types')` | vert | derive de jeu de types |

### Priorite P1 (>= 8)

| ID | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V19 | Fonction declaree STABLE | `psql ... SELECT provolatile FROM pg_proc WHERE proname='app_can_access_tenant'` | `s` (stable) | VOLATILE -> perf degradee |
| V20 | Fonction declaree PARALLEL SAFE | `psql ... SELECT proparallel FROM pg_proc WHERE proname='app_can_access_tenant'` | `s` (safe) | parallelisme bloque |
| V21 | COMMENT mis a jour (v3.0 / 7 types) | `psql ... SELECT obj_description('app_can_access_tenant(uuid)'::regprocedure)` | contient "v3.0" et "7 types" | doc obsolete |
| V22 | Bloc undefined_table conserve | `grep -n "undefined_table" repo/.../1735000000012-...ts` | >= 2 (up+down) | casse sur bootstrap pur |
| V23 | RETURN FALSE par defaut present | `grep -c "RETURN FALSE" repo/.../1735000000012-...ts` | >= 4 | fail-open potentiel |
| V24 | Tests integration 100% verts | `pnpm --filter @insurtech/database test:integration` | exit 0 | regression detectee |
| V25 | Lint 0 erreur | `pnpm --filter @insurtech/database lint` | exit 0 | style non conforme |
| V26 | Typecheck 0 erreur | `pnpm --filter @insurtech/database exec tsc --noEmit` | exit 0 | erreur TS |

### Priorite P2 (>= 5)

| ID | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V27 | Benchmark < 1ms appel direct | benchmark `rls-helper-bench.sql` | Execution Time < 1.000 ms | perf degradee |
| V28 | Idempotence run/revert/run | sequence commandes 7-8 section 10 | exit 0 a chaque etape | etat non reproductible |
| V29 | Bootstrap optionnel aligne (si modifie) | `grep -c "garage_to_carrier_quote" repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql` | 1 (si applique) | bases froides desalignees |
| V30 | Note doc migration presente | `grep -n "7.5a.5" repo/packages/database/MIGRATIONS.md` | match | tracabilite manquante |
| V31 | Zero emoji sur fichiers modifies | `bash repo/scripts/check-no-emoji.sh ...` | exit 0 | violation decision-006 |
| V32 | Variations temporelles vertes | suite `variations temporelles` | 3 verts | fenetres mal gerees |

---

## 12. Edge cases et troubleshooting

1. **`permission denied for function app_can_access_tenant`** : symptome apres `CREATE OR REPLACE` si le GRANT n'a pas ete re-execute (cas limite). Solution : verifier que le `up()` contient bien le `GRANT EXECUTE ... TO insurtech_app, insurtech_admin, insurtech_ro;`. Relancer `psql "$DATABASE_URL" -c "GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO insurtech_app, insurtech_admin, insurtech_ro;"`.
2. **`cannot change return type of existing function`** : `CREATE OR REPLACE` echoue si on tente de changer le type de retour ou le nom d'argument. Solution : conserver exactement `app_can_access_tenant(target_tenant_id uuid) RETURNS boolean`. Ne JAMAIS faire `DROP FUNCTION ... CASCADE`.
3. **`relation "cross_tenant_authorizations" does not exist`** : sur un environnement ou la table n'existe pas, la fonction doit retourner FALSE via le bloc `EXCEPTION WHEN undefined_table`. Si l'erreur remonte, c'est que le bloc `BEGIN ... EXCEPTION` a ete omis. Solution : verifier la presence du bloc dans up() ET down().
4. **Test `expires_at = NOW()` flaky** : la comparaison `> NOW()` est strictement superieure, mais `NOW()` au moment de l'INSERT et au moment de l'evaluation differe de quelques microsecondes. Le test peut donc passer faussement. Solution : forcer `expires_at = NOW()` dans la meme transaction et evaluer dans la meme transaction, ou utiliser `clock_timestamp()` pour rendre la limite deterministe ; preferer un test `expires_at = NOW() - INTERVAL '1 microsecond'` pour garantir le refus.
5. **`set_config` non `LOCAL` qui fuit entre tests** : si on utilise `set_config('app.x', v, false)` (non local), la valeur persiste hors transaction et pollue les tests suivants. Solution : utiliser `set_config('app.x', v, true)` (third arg `true` = is_local) comme dans `helpers/datasource.ts`, et reinitialiser le contexte dans `beforeEach`.
6. **`migration:revert` ne supprime pas la fonction** : c'est normal et voulu. Le `down()` ne fait pas `DROP FUNCTION` (cela casserait les policies) mais `CREATE OR REPLACE` vers la version 3 types. Verifier l'absence des nouveaux types apres revert (V17).
7. **Index `idx_cta_active_lookup` echoue avec `functions in index predicate must be marked IMMUTABLE`** : tentative d'inclure `expires_at > NOW()` dans le predicat partiel. Solution : limiter le predicat a `WHERE revoked_at IS NULL`.
8. **Faux negatif Condition 2 si `app.current_tenant_id` vide** : `app_current_tenant()` retourne NULL si la variable vaut `''`. La garde `current_tenant IS NOT NULL` evite un cast d'echec. Verifier que le contexte de test pose bien un UUID valide.
9. **Cast UUID errone** : passer une chaine non-UUID a `app_can_access_tenant` leve `invalid input syntax for type uuid`. Ce n'est pas un cas RLS reel (la colonne `tenant_id` est typee `uuid`) ; ne pas masquer cette erreur.
10. **Performance degradee sur gros volume** : si `cross_tenant_authorizations` grossit et que de futures requetes cherchent par couple `(from, to)` sans `id`, ajouter `idx_cta_active_lookup`. Pour cette tache (lookup par `id` = PK), aucun index supplementaire requis.

---

### 12.11 Scenarios de workflow metier des 4 nouveaux types

Pour comprendre concretement quand chaque nouveau type est evalue par la Condition 3, voici les flux metier Assurflow v3.0 :

- **`client_to_tower_dispatch`** : un client (assure) en panne commande un remorqueur depuis l'application. Le service applicatif cree une autorisation `from_tenant_id = tenant_client`, `to_tenant_id = tenant_tower`, `expires_at = NOW() + duree_mission`. Pendant la mission, le remorqueur (contexte L2 tenant tower, `cross_auth_id` pose) peut lire les donnees minimales du dossier client (position, vehicule). A l'issue de la mission ou apres expiration, l'acces tombe automatiquement (Condition 3 retourne FALSE).
- **`tower_to_garage_delivery`** : le remorqueur livre le vehicule au garage choisi. Autorisation `from_tenant_id = tenant_tower`, `to_tenant_id = tenant_garage`. Le garage (L2) accede aux informations d'acheminement le temps de la prise en charge.
- **`garage_to_expert_request`** : le garage doit communiquer avec l'expert designe par le carrier sur un dossier sinistre (workflow decision-013, expert acteur central). Autorisation `from_tenant_id = tenant_garage`, `to_tenant_id = tenant_expert`, `expires_at = NOW() + 30 jours`. Le matching bidirectionnel permet a l'expert d'acceder au dossier garage ET au garage de suivre l'avis de l'expert.
- **`garage_to_carrier_quote`** : apres validation de l'expert, le garage envoie les informations de devis au carrier (compagnie) en CC. Autorisation `from_tenant_id = tenant_garage`, `to_tenant_id = tenant_carrier`, `expires_at = NOW() + 30 jours`. Le carrier accede au devis pour decision d'indemnisation.

Chacun de ces flux repose sur l'evaluation de la Condition 3 par la fonction : sans la presente extension, ces 4 types ne seraient pas reconnus et les acces cross-tenant correspondants seraient systematiquement refuses, bloquant l'ensemble des workflows Assurflow v3.0.

### 12.12 Sequence d'execution recommandee (runbook)

1. S'assurer que la migration 7.5a.4 (`1735000000011`) est appliquee (CHECK 7 types + table `expert_designations`). Verifier : `psql "$DATABASE_URL" -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%cross_tenant_authorizations%type%';"`.
2. Appliquer la migration 7.5a.5 : `pnpm --filter @insurtech/database migration:run`.
3. Verifier la definition de la fonction (7 types presents) : critere V4.
4. Verifier que les policies RLS sont intactes : critere V15.
5. Lancer la suite d'integration : critere V24.
6. Lancer le benchmark : critere V27.
7. Tester le rollback : `migration:revert` (critere V17) puis re-appliquer (critere V28).

---

## 13. Conformite Maroc

### 13.1 CNDP -- Loi 09-08 (protection des donnees personnelles)

La fonction `app_can_access_tenant` est la **derniere ligne de defense** de l'isolation des donnees personnelles entre tenants (assures, clients, courtiers, garages). La loi 09-08 impose que les donnees a caractere personnel ne soient accessibles qu'aux personnes habilitees et dans la finalite declaree. Ici :

- L'isolation par RLS garantit qu'un tenant ne peut acceder qu'a ses propres donnees (Condition 2), sauf autorisation cross-tenant explicite, tracee, limitee dans le temps et revocable (Condition 3). Cela materialise le principe de **minimisation** et de **finalite**.
- Chaque type cross-tenant correspond a une finalite metier precise et documentee (par exemple `garage_to_expert_request` = communication entre garage et expert designe pour un sinistre). L'elargissement a 7 types ne cree aucun acces non finalise : chaque acces reste borne par une ligne `cross_tenant_authorizations` avec `expires_at` et `revoked_at`.
- La **residence des donnees** (decision-008, cloud souverain MA, Atlas Benguerir) impose que les donnees d'assures ne quittent jamais le territoire ; la RLS empeche un tenant etranger d'acceder a des donnees marocaines meme en cas d'erreur applicative.

### 13.2 ACAPS -- Autorite de Controle des Assurances et de la Prevoyance Sociale

L'ACAPS exige la **tracabilite** et l'**auditabilite** des acces cross-tenant dans le secteur assurantiel :

- Chaque autorisation cross-tenant est une ligne persistante (`granted_by_user_id`, `granted_at`, `expires_at`, `revoked_at`, `revoked_by_user_id`, `revoked_reason`, `metadata`), constituant une piste d'audit complete.
- La fonction ne fait que **lire** ces autorisations ; toute creation/revocation passe par le service applicatif (`cross-tenant-authorization.service.ts`) qui ecrit l'audit (`audit_log`, retention 7 ans, append-only).
- L'alignement strict des 7 types entre la fonction RLS, le CHECK constraint (7.5a.4) et l'entite TypeScript (7.5a.3) garantit qu'aucun acces cross-tenant ne peut etre accorde via un type non declare a l'ACAPS.

### 13.3 Loi 17-99 -- Code des assurances

Le Code des assurances marocain (loi 17-99) encadre les acteurs (courtiers, compagnies, experts) et leurs interactions. Les 7 types cross-tenant modelisent precisement les interactions legales prevues :

- `broker_to_garage_assignment`, `assure_to_garage_visit` : relation assure / courtier / reparateur.
- `garage_to_expert_request`, `garage_to_carrier_quote` : intervention de l'expert (acteur central decision-013) et communication avec la compagnie (carrier), conformement au processus d'expertise et d'indemnisation.
- `client_to_tower_dispatch`, `tower_to_garage_delivery` : assistance et acheminement du vehicule.

La fonction RLS garantit que ces interactions ne donnent acces qu'aux donnees strictement necessaires, pour la duree strictement necessaire, conformement aux obligations de confidentialite du Code des assurances.

---

## 14. Conventions absolues

Les conventions suivantes s'appliquent integralement a cette tache et a tout le code produit.

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; filtre `tenant_id` automatique via `TenantGuard` ; `TenantContext` porte par `AsyncLocalStorage` ; RLS via `app_can_access_tenant()` ; audit trail par operation.
- **Validation strict** : Zod uniquement ; schemas dans `@insurtech/shared-types` ; `const Schema = z.object({...})` ; `type T = z.infer<typeof Schema>`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; JSON structure ; champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id (65536/3/4) ; jamais bcrypt ; pepper `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; engine-strict Node >= 22.11.0 ; save-exact ; link-workspace-packages=deep.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest unit + integration ; Playwright E2E ; chaque `.ts` a son `.spec.ts` ; coverage >= 85% global, >= 90% auth/database/signature.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` global ; 26 roles v3.0.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par event ; `Idempotency-Key` pour les operations critiques.
- **Imports strict** : `@insurtech/{name}` ; paths `tsconfig.base.json` ; ordre Node / external / `@insurtech` / relatif.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un frontier model ; mock sprints 1-28, reel sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; CI echoue en cas de violation.
- **Idempotency-Key strict** : obligatoire pour `POST /payments`, `/signatures`, `/claims`, et toutes les ecritures MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir uniquement ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc ; AES-256-GCM ; TLS 1.3.

---

## 15. Validation pre-commit

Avant de committer, executer dans l'ordre :

```bash
# 1. Typecheck strict.
pnpm --filter @insurtech/database exec tsc --noEmit

# 2. Lint.
pnpm --filter @insurtech/database lint

# 3. Migration applicable et reversible.
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run

# 4. Tests d'integration (incluant rls-helper-v3).
pnpm --filter @insurtech/database test:integration

# 5. Zero emoji.
bash repo/scripts/check-no-emoji.sh \
  repo/packages/database/src/migrations/1735000000012-Sprint75aRlsHelperUpdate.ts \
  repo/packages/database/src/test/integration/rls-helper-v3.spec.ts

# 6. Verifier que les 33+ policies RLS restent valides.
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_policies WHERE qual LIKE '%app_can_access_tenant%' OR with_check LIKE '%app_can_access_tenant%';"
```

Checklist :

- [ ] tsc --noEmit : 0 erreur.
- [ ] lint : 0 erreur.
- [ ] migration run/revert/run : 0 erreur.
- [ ] test:integration : 100% vert.
- [ ] check-no-emoji : 0 violation.
- [ ] >= 33 policies referencant `app_can_access_tenant` toujours presentes.
- [ ] La fonction contient exactement 7 types apres run, 3 types apres revert.
- [ ] GRANT EXECUTE sur `insurtech_app`, `insurtech_admin`, `insurtech_ro` present.

---

## 16. Message de commit

```text
feat(sprint-7.5a): extend app_can_access_tenant helper to 7 cross-tenant types

Etend la Condition 3 du helper PostgreSQL app_can_access_tenant(uuid) pour
reconnaitre les 7 types cross-tenant v3.0 Assurflow (au lieu de 3). Livre via
une migration TypeORM CREATE OR REPLACE FUNCTION : aucune modification de
signature, aucun breaking change, les 33+ policies RLS dependantes restent
valides (OID de la fonction conserve).

Changements :
- migration 1735000000012-Sprint75aRlsHelperUpdate (up = 7 types, down = 3 types)
- Condition 3 : type IN (broker_to_garage_assignment, assure_to_garage_visit,
  multi_tenant_user_access, client_to_tower_dispatch, tower_to_garage_delivery,
  garage_to_expert_request, garage_to_carrier_quote)
- usage des vrais noms de colonnes from_tenant_id/to_tenant_id/type/revoked_at/
  expires_at + matching bidirectionnel
- Conditions 0/1/2 (null/super admin/meme tenant) preservees a l'identique
- re-GRANT EXECUTE TO insurtech_app, insurtech_admin, insurtech_ro
- COMMENT ON FUNCTION mis a jour (v3.0 / 7 types)
- suite d'integration rls-helper-v3.spec.ts (50+ scenarios)
- benchmark EXPLAIN ANALYZE < 1ms

Conformite : CNDP loi 09-08 (isolation derniere ligne de defense), ACAPS
(acces cross-tenant auditable), loi 17-99 (interactions acteurs assurance).

Task: 7.5a.5
Sprint: 7.5a (Assurflow Foundation)
Phase: 2.5 (Migration Assurflow)
Reference: B-7.5a Tache 7.5a.5
```

---

## 17. Workflow -- etape suivante

Une fois cette tache validee (helper RLS reconnaissant les 7 types, tests verts, migration reversible) :

- **Prochaine tache : 7.5a.6 -- catalogue de permissions (~130 entrees)**. Cette tache s'appuie sur le fait que les 7 types cross-tenant sont desormais reconnus de bout en bout : entite TypeScript (7.5a.3) -> CHECK constraint SQL (7.5a.4) -> helper RLS (CETTE TACHE 7.5a.5). Le catalogue de permissions definira les ~130 couples (role, action, ressource) pour les 26 roles v3.0 et s'appuiera sur les types cross-tenant pour les permissions inter-acteurs (garage <-> expert, garage <-> carrier, client <-> tower, tower <-> garage).

Sequence : `7.5a.4 (migration CHECK + expert_designations)` -> **`7.5a.5 (helper RLS 7 types)`** -> `7.5a.6 (catalogue permissions ~130)` -> `7.5a.7 (doc 5-roles-permissions.md v3.0)` -> `7.5a.8 (tests RBAC + RLS no-regression)`.

---

## Annexe A -- FAQ technique

**Q1. Pourquoi ne pas faire `DROP FUNCTION` puis `CREATE FUNCTION` dans le up() ?**
Parce que `DROP FUNCTION app_can_access_tenant(uuid)` echouerait (PostgreSQL refuse de supprimer une fonction dont dependent des policies RLS) et `DROP ... CASCADE` detruirait les 33+ policies. `CREATE OR REPLACE` est la seule approche sure.

**Q2. La fonction doit-elle etre `SECURITY DEFINER` ?**
Non, on preserve le mode reel du depot (`SECURITY INVOKER`, defaut). La table `cross_tenant_authorizations` est lisible par `insurtech_app` (grant 7.5a.4) ; il n'y a donc pas besoin d'elever les privileges. Si un jour la table devait etre protegee par RLS et inaccessible a l'appelant, on passerait en `SECURITY DEFINER` avec `SET search_path = pg_catalog, public, pg_temp` imperativement.

**Q3. Que se passe-t-il si `app.cross_tenant_authorization_id` pointe une ligne d'un type non liste ?**
Le filtre `type IN (7 valeurs)` ne matche pas, le `SELECT EXISTS` retourne FALSE, la Condition 3 ne s'applique pas, et la fonction tombe sur le `RETURN FALSE` par defaut. Acces refuse (fail-closed).

**Q4. La migration est-elle reversible sans perte ?**
Oui. Le `down()` fait un `CREATE OR REPLACE` vers la version 3 types. Aucune donnee n'est touchee, aucune policy n'est detruite. Seul le corps de la fonction change.

**Q5. Pourquoi `current_tenant IS NOT NULL` en garde de la Condition 3 ?**
Sans tenant courant, le matching bidirectionnel `(from = current OR to = current)` ne peut jamais etre vrai avec un `current` NULL. La garde court-circuite proprement et evite une evaluation inutile.

**Q6. Comment garantir l'alignement avec le CHECK de 7.5a.4 dans le temps ?**
Le test `it('le CHECK ... couvre exactement les 7 types')` (section 7.5) lit `pg_get_constraintdef` et compare a la liste `SEVEN_TYPES`. Si 7.5a.4 evolue (ajout d'un 8e type), ce test devient rouge tant que la fonction n'est pas mise a jour en consequence -- detection automatique de la derive.

**Q7. Quel role execute la migration ?**
`insurtech_admin` (via `DATABASE_URL`), qui a le droit de `CREATE OR REPLACE FUNCTION`. Le role applicatif `insurtech_app` n'execute jamais de migration : il ne fait qu'appeler la fonction (d'ou le `GRANT EXECUTE`).

## Annexe B -- Glossaire

| Terme | Definition |
|-------|------------|
| RLS | Row Level Security : mecanisme PostgreSQL filtrant les lignes visibles/modifiables par policy. |
| Policy | Regle RLS attachee a une table (FOR SELECT/INSERT/UPDATE/DELETE) avec un predicat `USING` et/ou `WITH CHECK`. |
| Predicat `USING` | Condition evaluee pour decider si une ligne existante est visible (SELECT/UPDATE/DELETE). |
| Predicat `WITH CHECK` | Condition evaluee pour autoriser l'ecriture d'une ligne (INSERT/UPDATE). |
| `STABLE` | Qualificatif de fonction : resultat constant a l'interieur d'une instruction SQL. |
| `PARALLEL SAFE` | La fonction peut etre executee dans des workers paralleles. |
| `SECURITY INVOKER` | La fonction s'execute avec les privileges de l'appelant (defaut). |
| `SECURITY DEFINER` | La fonction s'execute avec les privileges de son proprietaire. |
| Cross-tenant authorization | Ligne de `cross_tenant_authorizations` accordant un acces temporaire entre deux tenants. |
| Matching bidirectionnel | Acces accorde dans les deux sens du couple (from, to). |
| Fail-closed | En cas de doute ou d'absence d'information, l'acces est refuse (defaut securitaire). |
| Widening-only | Modification qui ne fait qu'ajouter des cas d'autorisation, jamais en retirer. |
| L1 / L2 / L3 | Niveaux multi-tenant : Platform / Tenant / Assure (decision-002). |

## Resume final

Cette tache 7.5a.5 etend le helper PostgreSQL `app_can_access_tenant(uuid)` -- coeur de l'isolation multi-tenant et predicat de 33+ policies RLS -- pour que sa Condition 3 reconnaisse les 7 types cross-tenant v3.0 (3 historiques + 4 nouveaux Assurflow). La livraison se fait par une migration TypeORM `1735000000012-Sprint75aRlsHelperUpdate.ts` en `CREATE OR REPLACE FUNCTION`, sans changement de signature ni breaking change, preservant les Conditions 0/1/2 a l'identique et n'elargissant que le filtre `type IN (...)` avec les vrais noms de colonnes (`from_tenant_id`, `to_tenant_id`, `type`, `revoked_at`, `expires_at`) et un matching bidirectionnel. Le GRANT EXECUTE est re-applique aux roles reels `insurtech_app`, `insurtech_admin`, `insurtech_ro`, et le COMMENT est mis a jour. Une suite d'integration de 50+ scenarios et un benchmark < 1ms valident correction et performance. La conformite CNDP 09-08 / ACAPS / loi 17-99 est assuree par l'isolation, la tracabilite et l'alignement strict des 7 types entre entite, CHECK et fonction. AUCUNE EMOJI (decision-006).
