# Task 2.5.5 - Renommer expert_designations vers insure_expert_assignments (+ ALTER ADD colonnes v3.0)

## Section 1 - Header

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5b (Assurflow Foundation) |
| Reference | B-7.5b tache 2.5.5 |
| Phase | 2 (Phase 2 / Sprint 5) |
| Priorite | P0 (bloquant chaine expertise) |
| Effort estime | 1h |
| Dependances | 2.5.4 (table `insure_experts` doit exister ; la nouvelle colonne `expert_id` y FK) |
| Bloque | 2.5.6 (`insure_expert_reports` consomme `insure_expert_assignments`) |
| Densite cible | 80-150 ko (cible ~95-110 ko) |
| Type | Migration TypeORM (RENAME + ALTER ADD, preservation donnees) |
| Migration | `1735000000014-Sprint75bExpertAssignmentsRename.ts` |
| Classe | `Sprint75bExpertAssignmentsRename1735000000014` |
| Decisions applicables | decision-012, decision-013, "7.5a authoritative" |
| Contrainte editoriale | AUCUNE EMOJI (decision-006 ABSOLUE) ; prose francaise ; SQL + TypeScript executables complets |

Cette tache fait evoluer la table `expert_designations` livree par le Sprint 7.5a (migration `1735000000011`) plutot que de creer une table parallele. Conformement a la resolution de conflit decidee par l'utilisateur, le Sprint 7.5a fait autorite (authoritative) : on RENOMME sa table en `insure_expert_assignments` et on ALTER ADD les colonnes manquantes du modele v3.0, en PRESERVANT les donnees existantes, le RLS, le FORCE ROW LEVEL SECURITY, les policies, les index et le trigger `updated_at`.

---

## Section 2 - But

Le but de cette tache est de transformer la table `expert_designations` (heritee de 7.5a) en la table cible v3.0 `insure_expert_assignments` SANS perte de donnees ni regression de securite. Concretement, la migration doit :

1. RENOMMER la table `expert_designations` en `insure_expert_assignments` (la commande `ALTER TABLE ... RENAME TO ...` preserve nativement les donnees, le RLS ENABLE, le FORCE, les policies, les contraintes, les FK et le trigger ; PostgreSQL renomme l'objet en place).
2. RENOMMER les cinq index `idx_expert_designations_*` en `idx_insure_expert_assignments_*` pour maintenir la coherence de nommage (un index renomme n'est pas reconstruit, donc zero downtime de reindexation).
3. RENOMMER la policy RLS `expert_designations_tenant_isolation` en `insure_expert_assignments_tenant_isolation`. Le RLS et le FORCE survivent automatiquement au RENAME de table ; seul le nom de la policy doit etre aligne.
4. Recreer le trigger `updated_at` sous le nouveau nom `trg_insure_expert_assignments_updated_at` (on DROP l'ancien et on CREATE le nouveau ; la fonction `set_updated_at_column()` est partagee globalement et ne doit JAMAIS etre droppee).
5. ELARGIR la contrainte CHECK de `status` pour ajouter la valeur `in_progress` (le cycle de vie v3.0 d'une affectation expert comporte un etat intermediaire entre `accepted` et `completed`).
6. AJOUTER les colonnes v3.0 manquantes (expert_id, garage_*, jalons temporels, honoraires) en mode `ADD COLUMN IF NOT EXISTS`, toutes nullables ou avec DEFAULT pour ne pas casser les lignes existantes.
7. CREER deux nouveaux index pour `expert_id` et `garage_tenant_id`.
8. METTRE A JOUR le `COMMENT ON TABLE`.

La migration `down()` doit etre rigoureusement reversible et symetrique : supprimer les colonnes ajoutees et leurs index/CHECK, restaurer la contrainte CHECK a ses 5 valeurs d'origine (en gerant le piege `in_progress`), renommer trigger/policy/index a l'inverse, puis `ALTER TABLE insure_expert_assignments RENAME TO expert_designations`. La fonction `set_updated_at_column()` n'est JAMAIS supprimee.

---

## Section 3 - Contexte etendu

### 3.1 Pourquoi faire evoluer la table du 7.5a plutot qu'en creer une nouvelle

Le Sprint 7.5a a livre, via sa migration `1735000000011`, une table `expert_designations` modelisant l'affectation d'un expert (sinistre) a un dossier. Lors de la planification du Sprint 7.5b (Assurflow Foundation), le modele de donnees v3.0 cible une table nommee `insure_expert_assignments` avec un schema enrichi (visite garage, geolocalisation, jalons temporels, honoraires MAD, lien vers le referentiel `insure_experts`). Il y avait donc un conflit de nommage et de portee entre la table existante et la cible.

La resolution de conflit retenue par l'utilisateur est explicite : **le Sprint 7.5a fait autorite**. Cela signifie que nous ne creons PAS une table parallele `insure_expert_assignments` vide qui dupliquerait la responsabilite metier de `expert_designations` ; nous **faisons evoluer la table existante**. Cette approche garantit :

- **Zero duplication de modele** : une seule table porte la responsabilite "affectation d'un expert a un sinistre".
- **Preservation totale des donnees** : toute affectation deja enregistree par le 7.5a est conservee, ce qui est imperatif pour la tracabilite ACAPS/CNDP (voir section 13).
- **Continuite referentielle** : les FK existantes (`auth_tenants`, `auth_users`) restent valides ; on ajoute seulement la FK vers `insure_experts`.
- **Continuite de securite** : RLS, FORCE, policy d'isolation tenant, trigger `updated_at` survivent a l'operation.

L'alternative "creer + copier + dropper" (CREATE TABLE insure_expert_assignments, INSERT INTO ... SELECT depuis expert_designations, DROP TABLE expert_designations) a ete ecartee car elle multiplie les surfaces d'erreur : il faudrait recopier toutes les FK, recreer toutes les policies, recopier les donnees ligne a ligne (verrou lourd), gerer les sequences/defaults, et risquer une fenetre ou les deux tables coexistent avec des donnees divergentes. Le `RENAME` est atomique, instantane (operation de catalogue, pas de reecriture de heap), et preserve tout en place.

Il faut bien comprendre la notion de "7.5a authoritative" pour saisir pourquoi cette tache est une migration de transformation et non une migration de creation. Lors du decoupage initial des sprints, deux equipes ont travaille en parallele : l'equipe 7.5a a livre le socle "sinistre + designation d'expert" avec une table `expert_designations` reduite (le minimum pour faire fonctionner la boucle designation/acceptation/rejet), tandis que l'equipe de modelisation v3.0 (Assurflow Foundation, 7.5b) a concu un schema cible plus riche nomme `insure_expert_assignments`. Au moment de fusionner les deux branches, l'utilisateur a tranche : la table physique livree par 7.5a est la source de verite (elle peut deja contenir des donnees de demo, des seeds, voire des donnees pilote), donc on ne la jette pas. On la fait converger vers le schema v3.0 par evolution. Cette decision evite tout "big bang" de migration de donnees et garantit que la chaine d'expertise (designation -> visite garage -> rapport -> honoraires) se construit incrementalement sur une fondation deja eprouvee.

Un point de vocabulaire pour lever l'ambiguite : "designation" (7.5a) et "assignment" (v3.0) designent la meme realite metier (l'acte d'affecter un expert sinistre a un dossier), mais "assignment" couvre un cycle de vie plus long incluant l'execution effective (visite, rapport, facturation). Le renommage n'est donc pas cosmetique : il reflete l'elargissement de la responsabilite de l'entite. La colonne `status` passe de 5 a 6 valeurs precisement pour modeliser cette execution intermediaire (`in_progress`).

### 3.2 Comment la donnee est preservee

`ALTER TABLE ... RENAME TO ...` en PostgreSQL est une operation purement de catalogue : le `pg_class.relname` est modifie, mais l'OID de la relation reste identique. Aucun bloc de donnees n'est reecrit. Toutes les lignes existantes restent physiquement intactes. Les colonnes ajoutees ensuite via `ADD COLUMN IF NOT EXISTS` avec une valeur par defaut NULL (ou un DEFAULT scalaire constant comme `'pending'`) sont ajoutees en mode "fast default" depuis PostgreSQL 11 : aucune reecriture de table n'est declenchee, la valeur par defaut est stockee dans le catalogue (`pg_attribute.atthasmissing` + `attmissingval`) et appliquee a la lecture pour les lignes anterieures. Cela rend la migration rapide meme sur une table volumineuse.

Le fait que l'OID reste identique est la cle de toute la robustesse de cette migration. En PostgreSQL, presque tous les objets dependants d'une table ne reference pas son nom textuel mais son OID interne : `pg_index.indrelid`, `pg_trigger.tgrelid`, `pg_policy.polrelid`, `pg_constraint.conrelid`, `pg_attribute.attrelid` pointent tous vers l'OID. Renommer la relation ne change que `pg_class.relname` ; toutes ces references restent valides sans intervention. C'est pourquoi un `RENAME` ne "casse" jamais les index, triggers, policies ou contraintes : ils suivent l'OID, pas le nom. Le seul effet de bord est cosmetique : les noms textuels des objets enfants (index, policy) continuent de contenir le radical `expert_designations`, ce qui prete a confusion a la maintenance. C'est purement pour cette lisibilite que la migration les renomme aussi.

Concernant le "fast default" : il est essentiel de ne pas le casser. Si une seule des colonnes ajoutees portait un DEFAULT non immuable (par exemple `now()`, `gen_random_uuid()`, ou une expression appelant une fonction `VOLATILE`), PostgreSQL serait contraint de materialiser la valeur sur chaque ligne existante, donc de reecrire integralement la table heap et de poser un `ACCESS EXCLUSIVE LOCK` long. Toutes les colonnes v3.0 sont donc soit nullables sans DEFAULT (jalons temporels, geolocalisation, montants), soit avec un DEFAULT scalaire constant (`honoraire_payment_status DEFAULT 'pending'`). Ce choix garantit une migration en quasi-temps-constant quelle que soit la volumetrie de `expert_designations`.

### 3.3 Comment RLS / FORCE / policies / index / triggers survivent au RENAME

Point crucial : un `ALTER TABLE ... RENAME TO ...` **conserve automatiquement** :

- le flag `relrowsecurity` (RLS ENABLE) ;
- le flag `relforcerowsecurity` (FORCE ROW LEVEL SECURITY, qui force l'application du RLS meme au proprietaire de la table) ;
- toutes les policies (elles sont attachees a l'OID de la relation, pas a son nom) ;
- toutes les contraintes (PK, FK, CHECK) ;
- tous les index (attaches a l'OID) ;
- tous les triggers (attaches a l'OID).

Donc apres le RENAME, la policy `expert_designations_tenant_isolation` existe TOUJOURS et protege TOUJOURS la table (desormais nommee `insure_expert_assignments`). Cependant, son **nom** continue de reference l'ancienne table, ce qui est trompeur a la maintenance. On la renomme donc via `ALTER POLICY ... ON ... RENAME TO ...`. De meme pour les index (`ALTER INDEX ... RENAME TO ...`).

Pour le trigger, PostgreSQL ne propose pas (historiquement, et pour rester compatible avec les versions ciblees) une commande `ALTER TRIGGER ... RENAME` aussi universellement disponible que pour les index ; pour garantir un comportement deterministe et portable, on choisit explicitement de **DROP l'ancien trigger puis CREATE le nouveau** sous le nom aligne. La fonction sous-jacente `set_updated_at_column()` est globale (partagee par des dizaines de tables) : on ne la touche jamais.

#### Mecanique exacte de `ALTER POLICY ... RENAME`

La syntaxe complete est `ALTER POLICY <nom_policy> ON <table> RENAME TO <nouveau_nom>`. Trois subtilites :

- La clause `ON <table>` est obligatoire : une policy n'a pas de nom global, elle est unique seulement dans le couple (table, nom). Apres le RENAME de table, la policy est toujours attachee a l'OID, donc on reference la table par son NOUVEAU nom (`insure_expert_assignments`), pas par l'ancien. C'est un point d'attention : au moment ou la migration renomme la policy, la table porte deja son nouveau nom (etape 1 deja executee).
- Le RENAME de policy ne touche NI la clause `USING`, NI la clause `WITH CHECK`, NI les roles cibles : seul le nom textuel change. La logique d'isolation (`app_can_access_tenant(tenant_id)`) est integralement preservee.
- L'operation est purement catalogue (`pg_policy.polname`), instantanee, sans verrou lourd au-dela d'un `ACCESS EXCLUSIVE` tres bref sur la table.

#### Mecanique exacte de `ALTER INDEX ... RENAME`

`ALTER INDEX <ancien> RENAME TO <nouveau>` modifie uniquement `pg_class.relname` de l'index (un index est lui-meme une relation dans `pg_class`). Aucune reconstruction, aucun rescan : l'arbre B-tree physique reste identique sur disque. Le cout est donc nul en I/O. C'est pour cela qu'on peut renommer les 5 index sans craindre de downtime de reindexation, meme sur une table volumineuse. Attention a l'ordre : on renomme la table EN PREMIER, puis les index. Apres le RENAME de table, les index existent toujours sous leur ancien nom (`idx_expert_designations_*`) car ils suivent l'OID de la table ; on les renomme ensuite un a un. L'ordre inverse (index d'abord, table ensuite) fonctionnerait aussi, mais le scenario documente fixe "table puis index" pour la lisibilite.

#### Semantique de l'etat `in_progress`

Le cycle de vie complet v3.0 d'une affectation est : `designated` (l'assureur affecte l'expert) -> `accepted` (l'expert accepte la mission) ou `rejected` (refus, avec `rejection_reason`) -> `in_progress` (l'expert a planifie/effectue la visite garage, le dossier est en cours d'instruction) -> `completed` (rapport remis, honoraires liquides) ou `cancelled` (annulation tardive, avec `cancelled_at`/`cancelled_reason`). L'etat `in_progress` est le seul ajout v3.0 ; il s'intercale entre `accepted` et `completed`. Sans lui, l'execution effective (visite + instruction) etait invisible dans le statut, ce qui empechait les tableaux de bord operationnels de distinguer une mission acceptee mais non commencee d'une mission reellement en cours. Le CHECK passe donc de 5 a 6 valeurs.

#### Backfill `expert_id` des lignes legacy (planifie Sprint 14)

Les lignes heritees de 7.5a portent l'expert via `expert_tenant_id` + `expert_user_id` (l'identite utilisateur de l'expert), mais PAS via `expert_id` (le referentiel `insure_experts` n'existait pas en 7.5a). La colonne `expert_id` est donc ajoutee NULLABLE et reste NULL pour toute ligne anterieure. Un backfill controle est planifie au Sprint 14 : il associera chaque `(expert_tenant_id, expert_user_id)` a la ligne `insure_experts` correspondante et renseignera `expert_id`. Tant que ce backfill n'a pas tourne, toute requete metier doit considerer `expert_id` comme potentiellement NULL pour les anciennes affectations. Poser `NOT NULL` ici casserait immediatement la migration sur toute base contenant des donnees 7.5a ; c'est interdit (voir piege 2).

#### Verrou en ecriture concurrente pendant le RENAME

`ALTER TABLE ... RENAME` acquiert un `ACCESS EXCLUSIVE LOCK` sur la table. Ce verrou est incompatible avec tout autre acces (meme un simple `SELECT`), mais il est extremement bref puisqu'il ne s'agit que d'une mise a jour du catalogue (pas de reecriture de heap). En pratique, sur une base de production active, deux precautions s'imposent : (1) executer la migration dans une fenetre de faible trafic ; (2) s'assurer qu'aucune transaction longue ne detient deja un verrou sur la table, sinon le `ALTER` attendra (et fera attendre toutes les ecritures derriere lui dans la file de verrous). Le `lock_timeout` de session peut etre positionne pour eviter un blocage indefini. Les `ADD COLUMN` en fast default prennent egalement un `ACCESS EXCLUSIVE` bref chacun, sans reecriture.

#### Garde CHECK-violation du `down()`

Le `down()` doit restaurer le CHECK a ses 5 valeurs d'origine. Or, si des lignes ont ete creees avec `status = 'in_progress'` pendant que la migration etait appliquee, restaurer un CHECK qui n'autorise pas `in_progress` echouerait avec `check constraint violated`. La parade est un bloc `DO` qui, AVANT de poser la contrainte restreinte, remappe toute ligne `in_progress` vers `accepted` (l'etat anterieur le plus proche dans le cycle de vie). Ce remap est une perte d'information assumee et documentee : un `down()` est une operation de secours, pas un aller-retour sans perte. Le test d'integration T14 verifie explicitement ce comportement. Le remap est lui-meme garde par un `IF EXISTS` sur la table pour rester idempotent.

### 3.4 Pourquoi ajouter `in_progress` au CHECK status

Le cycle de vie d'une affectation d'expert en v3.0 distingue l'acceptation de la mission (`accepted`) de l'execution effective (`in_progress`, c.-a-d. l'expert s'est deplace au garage, la visite est planifiee/en cours) puis de la cloture (`completed`). Le 7.5a ne modelisait que 5 etats : `designated`, `accepted`, `rejected`, `completed`, `cancelled`. La v3.0 en ajoute un sixieme, `in_progress`, intercalle entre `accepted` et `completed`. La migration elargit donc la contrainte CHECK a 6 valeurs.

### 3.5 Alternatives et trade-offs

| Approche | Avantages | Inconvenients | Retenue |
|----------|-----------|---------------|---------|
| RENAME + ALTER ADD (retenue) | Atomique, preserve donnees/RLS/index/triggers, instantanee | Necessite renommer policy/index/trigger pour coherence | OUI |
| CREATE nouvelle table + COPY + DROP | Schema "propre" from scratch | Verrou lourd, recopie FK/policies/data, fenetre d'incoherence, risque perte | NON |
| Garder `expert_designations` tel quel, creer une vue `insure_expert_assignments` | Pas de migration de donnees | Une vue n'accepte pas trivialement RLS/triggers/INSERT identiques, double maintenance, confusion | NON |
| Dropper + recreer | Simple a ecrire | Perte de donnees TOTALE, viole ACAPS/CNDP | NON |
| Renommer + ALTER ADD avec colonnes NOT NULL backfillees en une passe | Schema final immediatement strict | Reecriture heap si DEFAULT volatile, echec sur lignes legacy sans expert_id, verrou long | NON |
| `CREATE TABLE ... (LIKE expert_designations INCLUDING ALL)` puis bascule | Copie la structure | Ne copie ni les donnees, ni les policies RLS, ni la FORCE ; toujours besoin de migrer les lignes | NON |

Detail sur l'alternative "vue" (rejetee) : une vue `insure_expert_assignments` posee au-dessus de `expert_designations` ne pourrait pas porter nativement le RLS + FORCE de la meme maniere (le RLS s'applique aux tables de base, pas aux vues simples ; il faudrait une `security_barrier` view ou rejouer la policy via `WITH CHECK OPTION`), ne supporterait pas trivialement les `INSERT`/`UPDATE`/`DELETE` avec le meme comportement de trigger, et obligerait a maintenir DEUX objets (la table et la vue) avec un risque permanent de divergence de schema. De plus, les 13 colonnes v3.0 (visite, geolocalisation, honoraires) n'existent pas dans `expert_designations` : une vue ne peut pas inventer des colonnes persistantes. L'evolution par RENAME + ALTER ADD est donc strictement superieure.

Detail sur l'alternative "create + copy + drop" (rejetee) : au-dela du verrou et de la recopie ligne a ligne, elle imposerait de reconstruire manuellement chaque element de securite (ENABLE RLS, FORCE RLS, la policy d'isolation, les 5 index, le trigger), donc de dupliquer du code deja livre et teste par 7.5a, avec un risque non nul d'oublier la `FORCE ROW LEVEL SECURITY` (effet de bord silencieux : le proprietaire de la table contournerait alors le RLS). Le `RENAME` herite tout cela gratuitement par construction.

### 3.6 Pieges nommes (a connaitre avant d'ecrire le code)

1. **Piege down() / violation CHECK sur in_progress**
   - Pourquoi : si des lignes ont `status='in_progress'` au moment du `down()`, restaurer le CHECK a 5 valeurs (sans `in_progress`) echoue (`check constraint violated`) car PostgreSQL valide la contrainte sur l'ensemble des lignes existantes au moment du `ADD CONSTRAINT`.
   - Solution : le `down()` DOIT, dans un bloc `DO`, remapper `in_progress -> accepted` AVANT de poser la contrainte restreinte. Documente comme piege critique ; teste par T14.

2. **Piege expert_id nullable / legacy**
   - Pourquoi : les lignes heritees du 7.5a n'ont pas d'`expert_id` (le referentiel `insure_experts` n'existait pas). Poser `NOT NULL` echouerait immediatement sur toute base contenant des donnees 7.5a.
   - Solution : la colonne `expert_id` est nullable ; un backfill controle est planifie au Sprint 14. Ne JAMAIS poser `NOT NULL` ici.

3. **Piege renommage policy**
   - Pourquoi : oublier de renommer la policy laisse un nom trompeur `expert_designations_tenant_isolation` sur une table `insure_expert_assignments`. Le RLS fonctionne quand meme (la policy suit l'OID), mais la maintenance est piegee.
   - Solution : `ALTER POLICY ... ON insure_expert_assignments RENAME TO insure_expert_assignments_tenant_isolation`, garde par `IF EXISTS` sur `pg_policies`.

4. **Piege renommage trigger / fonction globale**
   - Pourquoi : la fonction `set_updated_at_column()` est partagee par des dizaines de tables ; la dropper casserait tous les triggers `updated_at` du systeme.
   - Solution : on DROP puis CREATE le TRIGGER (jamais la FONCTION). Aucun `DROP FUNCTION set_updated_at_column` ne doit apparaitre (verifie par T21/T29/V17).

5. **Piege renommage index**
   - Pourquoi : `ALTER INDEX ... RENAME` ne reconstruit pas l'index (operation catalogue, zero I/O), mais l'oublier laisse 5 index mal nommes.
   - Solution : renommer les 5 index apres le RENAME de table, chacun garde par `IF EXISTS` sur `pg_class`.

6. **Piege FK insure_experts (dependance dure 2.5.4)**
   - Pourquoi : la colonne `expert_id` reference `insure_experts(id)`. Si la tache 2.5.4 n'a pas ete appliquee, le `ADD COLUMN ... REFERENCES insure_experts(id)` echoue (`relation insure_experts does not exist`).
   - Solution : appliquer d'abord la migration `1735000000013` (tache 2.5.4). La dependance est declaree dans le header.

7. **Piege ALTER POLICY RENAME (syntaxe)**
   - Pourquoi : la syntaxe exige `ALTER POLICY <nom> ON <table> RENAME TO <nouveau_nom>`. Oublier le `ON <table>` echoue (une policy n'a pas de nom global).
   - Solution : toujours inclure `ON insure_expert_assignments` (le NOUVEAU nom, car la table est deja renommee a cette etape).

8. **Piege verrou en ecriture concurrente**
   - Pourquoi : `ALTER TABLE ... RENAME` prend un `ACCESS EXCLUSIVE LOCK` ; une transaction longue concurrente peut faire attendre le `ALTER`, qui bloque alors toutes les ecritures derriere lui.
   - Solution : executer en fenetre de faible trafic, positionner un `lock_timeout` de session, verifier l'absence de transaction longue prealable.

9. **Piege fast default vs reecriture**
   - Pourquoi : ajouter une colonne avec un DEFAULT volatile (ex. `now()`, `gen_random_uuid()`) reecrit toute la table heap et pose un verrou long.
   - Solution : utiliser uniquement NULL (sans DEFAULT) ou un DEFAULT scalaire constant (`'pending'`).

10. **Piege idempotence**
    - Pourquoi : un replay partiel (migration interrompue, rejouee) ne doit pas casser.
    - Solution : `IF NOT EXISTS` / `IF EXISTS` partout ou possible, et gardes `DO` verifiant l'existence (`pg_class`, `pg_policies`) avant chaque RENAME.

11. **Piege ordre RENAME index vs RENAME table**
    - Pourquoi : apres le RENAME de table, les index existent toujours sous l'ancien nom (ils suivent l'OID).
    - Solution : renommer la table en premier, PUIS les index. L'ordre inverse marche aussi mais le scenario documente fixe "table puis index".

12. **Piege CHECK nomme non renomme par le RENAME de table**
    - Pourquoi : le RENAME de table ne renomme PAS automatiquement les contraintes CHECK heritees ; la contrainte garde son nom `expert_designations_status_chk`.
    - Solution : DROP par son nom (`DROP CONSTRAINT IF EXISTS expert_designations_status_chk`) puis ADD la nouvelle `insure_expert_assignments_status_chk`.

13. **Piege FK garage_tenant_id sans index couvrant**
    - Pourquoi : une FK sans index sur la colonne enfant ralentit les verifications referentielles (notamment lors d'un DELETE sur `auth_tenants`) et les jointures.
    - Solution : creer `idx_insure_expert_assignments_garage` sur `garage_tenant_id` (livrable L13).

14. **Piege precision geolocalisation**
    - Pourquoi : stocker latitude/longitude en `float`/`double` introduit des erreurs d'arrondi et complique la deduplication geographique.
    - Solution : `numeric(10,7)` (7 decimales ~ 1,1 cm de precision), suffisant et exact pour une adresse garage au Maroc.

15. **Piege transaction de migration (atomicite up/down)**
    - Pourquoi : TypeORM enveloppe chaque migration dans une transaction par defaut ; si une etape echoue, tout est annule. Un `DO` mal forme ou une exception non geree laisse la migration en echec mais la base coherente.
    - Solution : maintenir toutes les operations dans une seule transaction implicite, ne jamais utiliser `COMMIT` explicite a l'interieur, s'appuyer sur le rollback automatique en cas d'erreur.

16. **Piege double application via le tracking TypeORM**
    - Pourquoi : TypeORM enregistre les migrations executees dans la table `migrations` ; si la classe ou le timestamp est mal nomme, le loader peut rejouer ou ignorer la migration.
    - Solution : respecter strictement le nom de fichier `1735000000014-Sprint75bExpertAssignmentsRename.ts` et la classe `Sprint75bExpertAssignmentsRename1735000000014`, et l'enregistrer dans `migrations[]` (verifie par V26/V27/V28).

### 3.7 Decisions 012 / 013

- **decision-012** : nommage des tables verticales prefixe par domaine (`insure_*` pour le domaine assurance/sinistre). D'ou `insure_expert_assignments`.
- **decision-013** : sequencement des migrations 7.5b apres 7.5a ; la tache 2.5.4 (migration `1735000000013`) cree `insure_experts` ; celle-ci (`1735000000014`) la suit immediatement.

### 3.8 Checklist mentale avant d'ecrire le code

Avant de rediger la migration, l'auteur doit pouvoir repondre OUI a chacune des questions suivantes. Chaque NON renvoie au piege ou a la sous-section correspondante :

1. Ai-je une garde `IF EXISTS` sur l'ancienne table et `NOT EXISTS` sur la nouvelle avant le RENAME ? (piege 10, 3.3)
2. Tous mes `ADD COLUMN` portent-ils `IF NOT EXISTS` ? (piege 10, edge case 9)
3. Tous mes `ADD CONSTRAINT` sont-ils precedes d'un `DROP CONSTRAINT IF EXISTS` ? (piege 12, edge case 10)
4. La colonne `expert_id` est-elle bien NULLABLE, sans `NOT NULL` ? (piege 2, 3.3 backfill)
5. Aucune colonne ajoutee n'a-t-elle un DEFAULT volatile ? (piege 9, 3.2 fast default)
6. Le `down()` remappe-t-il `in_progress -> accepted` AVANT de poser le CHECK 5 valeurs ? (piege 1, 3.3 garde)
7. Le `CREATE TRIGGER` reference-t-il `set_updated_at_column()` sans jamais la DROP ? (piege 4, 3.3)
8. La policy est-elle renommee avec la clause `ON insure_expert_assignments` (nouveau nom) ? (piege 7, 3.3 ALTER POLICY)
9. Les 5 index sont-ils renommes APRES le RENAME de table ? (piege 11, 3.3 ALTER INDEX)
10. La FK `expert_id` reference-t-elle `insure_experts(id)` (dependance 2.5.4 appliquee) ? (piege 6)
11. Le nom de fichier et la classe respectent-ils le timestamp `1735000000014` ? (piege 16)
12. La migration est-elle enregistree dans `migrations[]` dans le bon ordre ? (piege 16, 7.2)

Cette checklist constitue le filtre minimal ; les tests de structure (7.3) et d'integration (7.4) la verifient ensuite de maniere automatisee.

---

## Section 4 - Architecture context

### 4.1 Position dans le sprint

Cette tache est la **5eme sur 9** du Sprint 7.5b (Assurflow Foundation), dans la sous-chaine "referentiel et affectation des experts".

```
2.5.1  insure_carriers            (referentiel assureurs)
2.5.2  insure_garages             (referentiel garages)
2.5.3  insure_claims_core         (sinistres)
2.5.4  insure_experts             (referentiel experts)            <-- DEPENDANCE
2.5.5  RENAME expert_designations -> insure_expert_assignments     <-- CETTE TACHE (5/9)
2.5.6  insure_expert_reports      (rapports d'expertise)           <-- BLOQUEE PAR 2.5.5
2.5.7  insure_expert_invoices     (honoraires/factures)
2.5.8  insure_claim_timeline      (journal evenementiel)
2.5.9  vues + agregats reporting
```

### 4.2 Schema relationnel (ASCII)

```
                          Sprint 7.5a (migration 011)
                          +---------------------------+
                          |   expert_designations     |
                          |   (donnees existantes)    |
                          +-------------+-------------+
                                        |
                                        |  ALTER TABLE ... RENAME TO ...
                                        |  + ALTER ADD colonnes v3.0
                                        v
        +-------------------------------------------------------------+
        |              insure_expert_assignments  (v3.0)              |
        |-------------------------------------------------------------|
        |  id                       uuid  PK                          |
        |  tenant_id                uuid  FK auth_tenants    (CASCADE) |
        |  carrier_tenant_id        uuid  FK auth_tenants   (RESTRICT) |
        |  carrier_user_id          uuid  FK auth_users     (RESTRICT) |
        |  expert_tenant_id         uuid  FK auth_tenants   (RESTRICT) |
        |  expert_user_id           uuid  FK auth_users     (RESTRICT) |
        |  sinistre_id              uuid  (pas de FK)                  |
        |  status                   text  CHECK (6 valeurs v3.0)      |
        |  designated_at            timestamptz                       |
        |  accepted_at / rejected_at / completed_at  timestamptz      |
        |  rejection_reason / notes text                              |
        |  -- COLONNES v3.0 AJOUTEES --                               |
        |  expert_id                uuid  FK insure_experts (RESTRICT)|----+
        |  garage_tenant_id         uuid  FK auth_tenants             |    |
        |  garage_address           text                             |    |
        |  garage_lat / garage_lng  numeric(10,7)                     |    |
        |  visit_scheduled_at       timestamptz                       |    |
        |  visit_completed_at       timestamptz                       |    |
        |  report_submitted_at      timestamptz                       |    |
        |  cancelled_at             timestamptz                       |    |
        |  cancelled_reason         text                              |    |
        |  honoraire_mad            numeric(12,2)                     |    |
        |  honoraire_invoice_id     uuid                              |    |
        |  honoraire_payment_status varchar(20) CHECK (4 valeurs)     |    |
        |  created_at / updated_at  timestamptz                       |    |
        +-------------------------------------------------------------+    |
                                        |                                  |
            consommee par 2.5.6         |                                  | FK expert_id
                                        v                                  v
                          +---------------------------+      +---------------------------+
                          |  insure_expert_reports    |      |  insure_experts (2.5.4)   |
                          |  (rapports d'expertise)   |      |  (referentiel experts)    |
                          +---------------------------+      +---------------------------+
```

La table renommee reste protegee par RLS + FORCE et la policy d'isolation tenant (renommee). La nouvelle FK `expert_id -> insure_experts(id) ON DELETE RESTRICT` materialise le lien vers le referentiel cree en 2.5.4. La tache 2.5.6 (`insure_expert_reports`) referencera `insure_expert_assignments(id)`.

### 4.3 Invariants de securite a preserver

La migration doit garantir, avant ET apres execution, les invariants de securite suivants. Ils sont verifies par les tests T02 a T05 et les criteres V4 a V7 :

- **RLS ENABLE** (`pg_class.relrowsecurity = true`) : le Row Level Security est actif sur la table. Sans lui, toute requete verrait toutes les lignes, tous tenants confondus.
- **FORCE ROW LEVEL SECURITY** (`pg_class.relforcerowsecurity = true`) : meme le proprietaire de la table (le role qui a cree la relation) est soumis au RLS. C'est l'invariant le plus subtil et le plus critique : sans `FORCE`, un service applicatif connecte avec le role proprietaire contournerait silencieusement l'isolation. Le `RENAME` le preserve nativement ; aucun re-`FORCE` n'est necessaire (et il ne faut surtout pas l'oublier dans une approche create+copy, d'ou le rejet de cette alternative).
- **Policy d'isolation tenant** : exactement une policy `USING (app_can_access_tenant(tenant_id))` doit etre attachee a la table. Son nom est aligne (`insure_expert_assignments_tenant_isolation`) mais sa logique est inchangee.
- **Confidentialite des donnees ajoutees** : les colonnes v3.0 (geolocalisation garage, honoraires) sont des donnees sensibles ; elles heritent automatiquement de la protection RLS de la table, sans policy supplementaire (le RLS s'applique au niveau ligne, donc a toutes les colonnes de la ligne).

### 4.4 Chaine de dependance des migrations

```
1735000000011  Sprint75aExpertDesignations         (cree expert_designations)
1735000000012  Sprint75aExpertDesignationsSeed      (seed eventuel)
1735000000013  Sprint75bInsureExperts               (cree insure_experts)   <-- requis pour FK expert_id
1735000000014  Sprint75bExpertAssignmentsRename     (CETTE TACHE)
1735000000015  (futur) insure_expert_reports        (consomme assignments)
```

Toute execution de `1735000000014` presuppose que `1735000000011` (table source) et `1735000000013` (cible FK) sont deja appliquees. Le loader TypeORM applique les migrations dans l'ordre des timestamps ; l'enregistrement dans `migrations[]` doit respecter cet ordre (voir 7.2).

---

## Section 5 - Livrables checkables

- [ ] L1 - Fichier `1735000000014-Sprint75bExpertAssignmentsRename.ts` cree dans le dossier des migrations.
- [ ] L2 - Classe `Sprint75bExpertAssignmentsRename1735000000014` implementant `MigrationInterface`.
- [ ] L3 - `up()` complet : RENAME table + 5 index + policy + trigger + CHECK elargi + 13 colonnes ADD + 2 index + COMMENT.
- [ ] L4 - `down()` complet symetrique, avec garde `DO` remappant `in_progress -> accepted` avant restauration du CHECK 5 valeurs.
- [ ] L5 - `ALTER TABLE expert_designations RENAME TO insure_expert_assignments` present dans `up()`.
- [ ] L6 - Les 5 index `idx_expert_designations_*` renommes en `idx_insure_expert_assignments_*`.
- [ ] L7 - Policy `expert_designations_tenant_isolation` renommee en `insure_expert_assignments_tenant_isolation`.
- [ ] L8 - Trigger `trg_expert_designations_updated_at` droppe, `trg_insure_expert_assignments_updated_at` cree.
- [ ] L9 - CHECK `status` elargi a 6 valeurs (`insure_expert_assignments_status_chk`).
- [ ] L10 - 13 colonnes v3.0 ajoutees (`expert_id`, `garage_tenant_id`, `garage_address`, `garage_lat`, `garage_lng`, `visit_scheduled_at`, `visit_completed_at`, `report_submitted_at`, `cancelled_at`, `cancelled_reason`, `honoraire_mad`, `honoraire_invoice_id`, `honoraire_payment_status`).
- [ ] L11 - `expert_id` nullable + FK `insure_experts(id) ON DELETE RESTRICT`.
- [ ] L12 - `honoraire_payment_status` DEFAULT `'pending'` + CHECK 4 valeurs.
- [ ] L13 - Index `idx_insure_expert_assignments_expert_id` et `idx_insure_expert_assignments_garage` crees.
- [ ] L14 - `COMMENT ON TABLE insure_expert_assignments` mis a jour.
- [ ] L15 - `set_updated_at_column()` JAMAIS droppee (ni dans up ni dans down).
- [ ] L16 - Spec migration `1735000000014-Sprint75bExpertAssignmentsRename.spec.ts` (structure up/down).
- [ ] L17 - Spec d'integration sur harness PostgreSQL reel (donnees preservees, RLS isole, colonnes nullables, in_progress accepte, down reverse, idempotence).
- [ ] L18 - Extrait d'entity TypeORM aligne sur le nouveau schema.
- [ ] L19 - RLS ENABLE + FORCE verifies actifs apres RENAME (test).
- [ ] L20 - Idempotence : `up()` puis `down()` puis `up()` reexecutables.
- [ ] L21 - `pnpm typecheck` passe sans erreur.
- [ ] L22 - `pnpm lint` passe sans erreur.
- [ ] L23 - `pnpm test` (suite migration + integration) verte.
- [ ] L24 - `./scripts/check-no-emoji.sh` passe (zero emoji).
- [ ] L25 - Migration appliquee puis revertee avec succes contre la base de dev.

---

## Section 6 - Fichiers crees / modifies

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/database/src/migrations/1735000000014-Sprint75bExpertAssignmentsRename.ts` | CREE | Migration RENAME + ALTER ADD (up + down). |
| `packages/database/src/migrations/__tests__/1735000000014-Sprint75bExpertAssignmentsRename.spec.ts` | CREE | Tests unitaires de structure (presence des instructions SQL up/down). |
| `packages/database/test/integration/expert-assignments-rename.integration.spec.ts` | CREE | Tests d'integration sur harness PostgreSQL reel (preservation, RLS, nullable, in_progress, down, idempotence). |
| `packages/database/src/entities/insure-expert-assignment.entity.ts` | CREE/MODIFIE | Entity TypeORM alignee sur `insure_expert_assignments` v3.0. |
| `packages/database/src/migrations/index.ts` | MODIFIE | Enregistrement de la migration `1735000000014` dans la liste ordonnee. |

---

## Section 7 - Code patterns complets

### 7.1 Migration up() + down() complet

Fichier `packages/database/src/migrations/1735000000014-Sprint75bExpertAssignmentsRename.ts` :

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 7.5b - Tache 2.5.5
 *
 * Renomme la table `expert_designations` (livree par 7.5a, migration 011)
 * en `insure_expert_assignments` et ajoute les colonnes du modele v3.0,
 * en preservant les donnees existantes, le RLS, le FORCE ROW LEVEL SECURITY,
 * la policy d'isolation tenant, les index et le trigger updated_at.
 *
 * 7.5a fait autorite : on fait evoluer sa table plutot que d'en creer une parallele.
 *
 * Decisions : 012 (nommage insure_*), 013 (sequencement), "7.5a authoritative".
 *
 * PIEGE down() : si des lignes ont status='in_progress' au moment du revert,
 * la restauration du CHECK a 5 valeurs echoue. Le down() remappe
 * 'in_progress' -> 'accepted' AVANT de poser la contrainte restreinte.
 *
 * La fonction set_updated_at_column() est globale : JAMAIS supprimee ici.
 */
export class Sprint75bExpertAssignmentsRename1735000000014
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------------
    // 1. RENAME de la table (operation de catalogue, donnees preservees,
    //    RLS + FORCE + policies + FK + index + triggers conserves en place).
    //    Garde idempotente : on ne renomme que si l'ancienne table existe
    //    et que la nouvelle n'existe pas encore.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'expert_designations'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'insure_expert_assignments'
        ) THEN
          ALTER TABLE expert_designations RENAME TO insure_expert_assignments;
        END IF;
      END
      $$;
    `);

    // ----------------------------------------------------------------
    // 2. RENAME des 5 index (operation de catalogue, pas de reindexation).
    //    Chaque rename est garde par IF EXISTS via un bloc DO.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_expert_designations_tenant') THEN
          ALTER INDEX idx_expert_designations_tenant RENAME TO idx_insure_expert_assignments_tenant;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_expert_designations_carrier') THEN
          ALTER INDEX idx_expert_designations_carrier RENAME TO idx_insure_expert_assignments_carrier;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_expert_designations_expert') THEN
          ALTER INDEX idx_expert_designations_expert RENAME TO idx_insure_expert_assignments_expert;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_expert_designations_sinistre') THEN
          ALTER INDEX idx_expert_designations_sinistre RENAME TO idx_insure_expert_assignments_sinistre;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_expert_designations_status') THEN
          ALTER INDEX idx_expert_designations_status RENAME TO idx_insure_expert_assignments_status;
        END IF;
      END
      $$;
    `);

    // ----------------------------------------------------------------
    // 3. RENAME de la policy RLS. Le RLS et le FORCE survivent au RENAME
    //    de table ; seul le nom de la policy doit etre aligne.
    //    Syntaxe : ALTER POLICY <nom> ON <table> RENAME TO <nouveau>.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'insure_expert_assignments'
            AND policyname = 'expert_designations_tenant_isolation'
        ) THEN
          ALTER POLICY expert_designations_tenant_isolation
            ON insure_expert_assignments
            RENAME TO insure_expert_assignments_tenant_isolation;
        END IF;
      END
      $$;
    `);

    // ----------------------------------------------------------------
    // 4. Trigger updated_at : DROP ancien + CREATE nouveau.
    //    On ne touche JAMAIS la fonction set_updated_at_column() (globale).
    // ----------------------------------------------------------------
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_expert_designations_updated_at
        ON insure_expert_assignments;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_insure_expert_assignments_updated_at
        ON insure_expert_assignments;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_insure_expert_assignments_updated_at
        BEFORE UPDATE ON insure_expert_assignments
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_column();
    `);

    // ----------------------------------------------------------------
    // 5. Elargissement du CHECK status : ajout de 'in_progress'.
    //    On DROP la contrainte nommee heritee (le RENAME de table ne
    //    renomme PAS les contraintes CHECK) puis on ADD la nouvelle.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP CONSTRAINT IF EXISTS expert_designations_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP CONSTRAINT IF EXISTS insure_expert_assignments_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD CONSTRAINT insure_expert_assignments_status_chk
        CHECK (status IN (
          'designated','accepted','rejected','in_progress','completed','cancelled'
        ));
    `);

    // ----------------------------------------------------------------
    // 6. Ajout des colonnes v3.0 (toutes nullables ou DEFAULT scalaire
    //    constant => fast default, pas de reecriture de table).
    //    expert_id reference insure_experts(id) cree par la tache 2.5.4.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS expert_id uuid
          REFERENCES insure_experts(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS garage_tenant_id uuid
          REFERENCES auth_tenants(id);
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS garage_address text;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS garage_lat numeric(10,7);
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS garage_lng numeric(10,7);
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS visit_scheduled_at timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS visit_completed_at timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS report_submitted_at timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS cancelled_reason text;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS honoraire_mad numeric(12,2);
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS honoraire_invoice_id uuid;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD COLUMN IF NOT EXISTS honoraire_payment_status varchar(20)
          DEFAULT 'pending';
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP CONSTRAINT IF EXISTS insure_expert_assignments_honoraire_payment_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD CONSTRAINT insure_expert_assignments_honoraire_payment_status_chk
        CHECK (honoraire_payment_status IN (
          'pending','invoiced','paid','overdue'
        ));
    `);

    // ----------------------------------------------------------------
    // 7. Nouveaux index pour expert_id et garage_tenant_id.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_insure_expert_assignments_expert_id
        ON insure_expert_assignments (expert_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_insure_expert_assignments_garage
        ON insure_expert_assignments (garage_tenant_id);
    `);

    // ----------------------------------------------------------------
    // 8. COMMENT ON TABLE mis a jour.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      COMMENT ON TABLE insure_expert_assignments IS
        'Affectation d''un expert a un sinistre (Assurflow v3.0). '
        'Issue du renommage de expert_designations (Sprint 7.5a, 7.5a authoritative). '
        'Inclut visite garage, geolocalisation, jalons temporels et honoraires MAD. '
        'RLS + FORCE actifs ; isolation tenant via app_can_access_tenant(tenant_id).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------------
    // Reverse symetrique. Ordre : on defait d'abord les ajouts v3.0,
    // puis on renomme tout a l'envers, puis on RENAME la table.
    // ----------------------------------------------------------------

    // 8'. (COMMENT : on remet un commentaire neutre, non bloquant.)

    // 7'. Drop des nouveaux index.
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_insure_expert_assignments_expert_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_insure_expert_assignments_garage;
    `);

    // 6'. Drop des colonnes v3.0 + leur CHECK honoraire_payment_status.
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP CONSTRAINT IF EXISTS insure_expert_assignments_honoraire_payment_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS honoraire_payment_status;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS honoraire_invoice_id;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS honoraire_mad;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS cancelled_reason;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS cancelled_at;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS report_submitted_at;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS visit_completed_at;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS visit_scheduled_at;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS garage_lng;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS garage_lat;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS garage_address;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS garage_tenant_id;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP COLUMN IF EXISTS expert_id;
    `);

    // 5'. PIEGE CRITIQUE : remapper 'in_progress' -> 'accepted' AVANT de
    //     restaurer le CHECK a 5 valeurs, sinon violation de contrainte.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'insure_expert_assignments'
        ) THEN
          UPDATE insure_expert_assignments
            SET status = 'accepted'
            WHERE status = 'in_progress';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP CONSTRAINT IF EXISTS insure_expert_assignments_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        DROP CONSTRAINT IF EXISTS expert_designations_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_expert_assignments
        ADD CONSTRAINT expert_designations_status_chk
        CHECK (status IN (
          'designated','accepted','rejected','completed','cancelled'
        ));
    `);

    // 4'. Trigger : DROP nouveau, CREATE ancien. Fonction jamais droppee.
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_insure_expert_assignments_updated_at
        ON insure_expert_assignments;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_expert_designations_updated_at
        ON insure_expert_assignments;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_expert_designations_updated_at
        BEFORE UPDATE ON insure_expert_assignments
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_column();
    `);

    // 3'. Renommer la policy a l'envers.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'insure_expert_assignments'
            AND policyname = 'insure_expert_assignments_tenant_isolation'
        ) THEN
          ALTER POLICY insure_expert_assignments_tenant_isolation
            ON insure_expert_assignments
            RENAME TO expert_designations_tenant_isolation;
        END IF;
      END
      $$;
    `);

    // 2'. Renommer les 5 index a l'envers.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_insure_expert_assignments_tenant') THEN
          ALTER INDEX idx_insure_expert_assignments_tenant RENAME TO idx_expert_designations_tenant;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_insure_expert_assignments_carrier') THEN
          ALTER INDEX idx_insure_expert_assignments_carrier RENAME TO idx_expert_designations_carrier;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_insure_expert_assignments_expert') THEN
          ALTER INDEX idx_insure_expert_assignments_expert RENAME TO idx_expert_designations_expert;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_insure_expert_assignments_sinistre') THEN
          ALTER INDEX idx_insure_expert_assignments_sinistre RENAME TO idx_expert_designations_sinistre;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_insure_expert_assignments_status') THEN
          ALTER INDEX idx_insure_expert_assignments_status RENAME TO idx_expert_designations_status;
        END IF;
      END
      $$;
    `);

    // 1'. Renommer la table a l'envers (garde idempotente).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'insure_expert_assignments'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'expert_designations'
        ) THEN
          ALTER TABLE insure_expert_assignments RENAME TO expert_designations;
        END IF;
      END
      $$;
    `);

    // Restauration du commentaire d'origine (best-effort).
    await queryRunner.query(`
      COMMENT ON TABLE expert_designations IS
        'Designation d''un expert sinistre (Sprint 7.5a). RLS + FORCE actifs.';
    `);
  }
}
```

### 7.2 Enregistrement dans l'index des migrations

Fichier `packages/database/src/migrations/index.ts` (extrait modifie) :

```typescript
import { Sprint75aExpertDesignations1735000000011 } from './1735000000011-Sprint75aExpertDesignations';
import { Sprint75aExpertDesignationsSeed1735000000012 } from './1735000000012-Sprint75aExpertDesignationsSeed';
import { Sprint75bInsureExperts1735000000013 } from './1735000000013-Sprint75bInsureExperts';
import { Sprint75bExpertAssignmentsRename1735000000014 } from './1735000000014-Sprint75bExpertAssignmentsRename';

export const migrations = [
  // ... migrations anterieures ...
  Sprint75aExpertDesignations1735000000011,
  Sprint75aExpertDesignationsSeed1735000000012,
  Sprint75bInsureExperts1735000000013,
  Sprint75bExpertAssignmentsRename1735000000014,
] as const;
```

### 7.3 Spec de structure de la migration

Fichier `packages/database/src/migrations/__tests__/1735000000014-Sprint75bExpertAssignmentsRename.spec.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryRunner } from 'typeorm';
import { Sprint75bExpertAssignmentsRename1735000000014 } from '../1735000000014-Sprint75bExpertAssignmentsRename';

/**
 * Tests de structure : on capture toutes les requetes SQL emises par up()
 * et down() avec un QueryRunner mocke, et on verifie que les instructions
 * cles sont presentes et dans le bon ordre. On ne teste PAS l'execution
 * reelle ici (voir le spec d'integration).
 */
describe('Sprint75bExpertAssignmentsRename1735000000014 (structure)', () => {
  let migration: Sprint75bExpertAssignmentsRename1735000000014;
  let queries: string[];
  let queryRunner: QueryRunner;

  beforeEach(() => {
    migration = new Sprint75bExpertAssignmentsRename1735000000014();
    queries = [];
    queryRunner = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;
  });

  const joined = (): string => queries.join('\n');

  describe('up()', () => {
    beforeEach(async () => {
      await migration.up(queryRunner);
    });

    it('renomme la table expert_designations -> insure_expert_assignments', () => {
      expect(joined()).toContain(
        'ALTER TABLE expert_designations RENAME TO insure_expert_assignments',
      );
    });

    it('renomme les 5 index', () => {
      const sql = joined();
      expect(sql).toContain('idx_expert_designations_tenant RENAME TO idx_insure_expert_assignments_tenant');
      expect(sql).toContain('idx_expert_designations_carrier RENAME TO idx_insure_expert_assignments_carrier');
      expect(sql).toContain('idx_expert_designations_expert RENAME TO idx_insure_expert_assignments_expert');
      expect(sql).toContain('idx_expert_designations_sinistre RENAME TO idx_insure_expert_assignments_sinistre');
      expect(sql).toContain('idx_expert_designations_status RENAME TO idx_insure_expert_assignments_status');
    });

    it('renomme la policy d isolation tenant', () => {
      expect(joined()).toContain(
        'ALTER POLICY expert_designations_tenant_isolation',
      );
      expect(joined()).toContain(
        'RENAME TO insure_expert_assignments_tenant_isolation',
      );
    });

    it('recree le trigger updated_at sous le nouveau nom', () => {
      const sql = joined();
      expect(sql).toContain('DROP TRIGGER IF EXISTS trg_expert_designations_updated_at');
      expect(sql).toContain('CREATE TRIGGER trg_insure_expert_assignments_updated_at');
      expect(sql).toContain('EXECUTE FUNCTION set_updated_at_column()');
    });

    it('ne supprime jamais la fonction set_updated_at_column', () => {
      expect(joined()).not.toContain('DROP FUNCTION set_updated_at_column');
    });

    it('elargit le CHECK status a 6 valeurs dont in_progress', () => {
      const sql = joined();
      expect(sql).toContain('insure_expert_assignments_status_chk');
      expect(sql).toContain("'in_progress'");
    });

    it('ajoute les 13 colonnes v3.0', () => {
      const sql = joined();
      for (const col of [
        'expert_id',
        'garage_tenant_id',
        'garage_address',
        'garage_lat',
        'garage_lng',
        'visit_scheduled_at',
        'visit_completed_at',
        'report_submitted_at',
        'cancelled_at',
        'cancelled_reason',
        'honoraire_mad',
        'honoraire_invoice_id',
        'honoraire_payment_status',
      ]) {
        expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col}`);
      }
    });

    it('FK expert_id vers insure_experts ON DELETE RESTRICT', () => {
      expect(joined()).toContain(
        'REFERENCES insure_experts(id) ON DELETE RESTRICT',
      );
    });

    it('cree les 2 nouveaux index', () => {
      const sql = joined();
      expect(sql).toContain('idx_insure_expert_assignments_expert_id');
      expect(sql).toContain('idx_insure_expert_assignments_garage');
    });

    it('met a jour le COMMENT ON TABLE', () => {
      expect(joined()).toContain('COMMENT ON TABLE insure_expert_assignments');
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      await migration.down(queryRunner);
    });

    it('remappe in_progress -> accepted avant de restaurer le CHECK', () => {
      const sql = joined();
      const idxRemap = sql.indexOf("SET status = 'accepted'");
      const idxConstraint = sql.indexOf('ADD CONSTRAINT expert_designations_status_chk');
      expect(idxRemap).toBeGreaterThanOrEqual(0);
      expect(idxConstraint).toBeGreaterThan(idxRemap);
    });

    it('restaure le CHECK a 5 valeurs (sans in_progress)', () => {
      const sql = joined();
      expect(sql).toContain('expert_designations_status_chk');
      const constraintBlock = sql.slice(sql.indexOf('ADD CONSTRAINT expert_designations_status_chk'));
      expect(constraintBlock).not.toContain("'in_progress'");
    });

    it('renomme la table a l envers', () => {
      expect(joined()).toContain(
        'ALTER TABLE insure_expert_assignments RENAME TO expert_designations',
      );
    });

    it('ne supprime jamais la fonction set_updated_at_column', () => {
      expect(joined()).not.toContain('DROP FUNCTION set_updated_at_column');
    });

    it('drop les 13 colonnes v3.0', () => {
      const sql = joined();
      for (const col of [
        'expert_id',
        'garage_tenant_id',
        'honoraire_payment_status',
      ]) {
        expect(sql).toContain(`DROP COLUMN IF EXISTS ${col}`);
      }
    });
  });
});
```

### 7.4 Spec d'integration sur harness PostgreSQL reel

Fichier `packages/database/test/integration/expert-assignments-rename.integration.spec.ts` :

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Sprint75bExpertAssignmentsRename1735000000014 } from '../../src/migrations/1735000000014-Sprint75bExpertAssignmentsRename';

/**
 * Tests d'integration sur une base PostgreSQL reelle.
 *
 * Pre-requis (orchestres par la fixture globale du package database) :
 *  - extensions et fonction set_updated_at_column() presentes ;
 *  - app_can_access_tenant(uuid) presente ;
 *  - tables auth_tenants, auth_users, insure_experts presentes (2.5.4) ;
 *  - la table expert_designations (7.5a) presente AVANT chaque test up().
 *
 * On simule l'etat 7.5a en (re)creant expert_designations dans beforeEach,
 * puis on applique la migration 014.
 */
describe('insure_expert_assignments - rename integration', () => {
  let ds: DataSource;
  const migration = new Sprint75bExpertAssignmentsRename1735000000014();

  const TENANT = randomUUID();
  const CARRIER_TENANT = randomUUID();
  const EXPERT_TENANT = randomUUID();
  const CARRIER_USER = randomUUID();
  const EXPERT_USER = randomUUID();
  const SINISTRE = randomUUID();
  const EXPERT_REF = randomUUID();

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL_TEST,
      synchronize: false,
      logging: false,
    });
    await ds.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  async function seedPrereqs(): Promise<void> {
    // Tenants
    await ds.query(
      `INSERT INTO auth_tenants (id, name) VALUES ($1,'T'),($2,'C'),($3,'E')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT, CARRIER_TENANT, EXPERT_TENANT],
    );
    // Users
    await ds.query(
      `INSERT INTO auth_users (id, tenant_id, email) VALUES
       ($1,$3,'carrier@x.ma'),($2,$4,'expert@x.ma')
       ON CONFLICT (id) DO NOTHING`,
      [CARRIER_USER, EXPERT_USER, CARRIER_TENANT, EXPERT_TENANT],
    );
    // Reference expert (2.5.4)
    await ds.query(
      `INSERT INTO insure_experts (id, tenant_id) VALUES ($1,$2)
       ON CONFLICT (id) DO NOTHING`,
      [EXPERT_REF, EXPERT_TENANT],
    );
  }

  async function recreateExpertDesignations(): Promise<void> {
    // Etat 7.5a : on recree la table d'origine telle que livree par 011.
    await ds.query(`DROP TABLE IF EXISTS insure_expert_assignments CASCADE`);
    await ds.query(`DROP TABLE IF EXISTS expert_designations CASCADE`);
    await ds.query(`
      CREATE TABLE expert_designations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        carrier_tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        carrier_user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        expert_tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        expert_user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        sinistre_id uuid NOT NULL,
        status text NOT NULL,
        designated_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz,
        rejected_at timestamptz,
        rejection_reason text,
        completed_at timestamptz,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT expert_designations_status_chk
          CHECK (status IN ('designated','accepted','rejected','completed','cancelled'))
      )
    `);
    await ds.query(`CREATE INDEX idx_expert_designations_tenant ON expert_designations (tenant_id)`);
    await ds.query(`CREATE INDEX idx_expert_designations_carrier ON expert_designations (carrier_tenant_id)`);
    await ds.query(`CREATE INDEX idx_expert_designations_expert ON expert_designations (expert_tenant_id)`);
    await ds.query(`CREATE INDEX idx_expert_designations_sinistre ON expert_designations (sinistre_id)`);
    await ds.query(`CREATE INDEX idx_expert_designations_status ON expert_designations (status)`);
    await ds.query(`ALTER TABLE expert_designations ENABLE ROW LEVEL SECURITY`);
    await ds.query(`ALTER TABLE expert_designations FORCE ROW LEVEL SECURITY`);
    await ds.query(`
      CREATE POLICY expert_designations_tenant_isolation ON expert_designations
        USING (app_can_access_tenant(tenant_id))
    `);
    await ds.query(`
      CREATE TRIGGER trg_expert_designations_updated_at
        BEFORE UPDATE ON expert_designations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column()
    `);
  }

  async function insertLegacyRow(status = 'designated'): Promise<string> {
    const id = randomUUID();
    await ds.query(
      `INSERT INTO expert_designations
        (id, tenant_id, carrier_tenant_id, carrier_user_id,
         expert_tenant_id, expert_user_id, sinistre_id, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'legacy note')`,
      [id, TENANT, CARRIER_TENANT, CARRIER_USER, EXPERT_TENANT, EXPERT_USER, SINISTRE, status],
    );
    return id;
  }

  beforeEach(async () => {
    await seedPrereqs();
    await recreateExpertDesignations();
  });

  it('preserve les donnees existantes a travers le rename', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    const rows = await ds.query(
      `SELECT id, notes, status FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].notes).toBe('legacy note');
    expect(rows[0].status).toBe('designated');
  });

  it('conserve RLS ENABLE et FORCE apres rename', async () => {
    await migration.up(ds.createQueryRunner());
    const flags = await ds.query(`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE relname = 'insure_expert_assignments'
    `);
    expect(flags[0].relrowsecurity).toBe(true);
    expect(flags[0].relforcerowsecurity).toBe(true);
  });

  it('isole toujours par tenant via la policy renommee', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    const qr = ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      // tenant courant = un AUTRE tenant => aucune ligne visible
      await qr.query(`SET LOCAL app.current_tenant_id = '${randomUUID()}'`);
      const hidden = await qr.query(
        `SELECT id FROM insure_expert_assignments WHERE id = $1`,
        [id],
      );
      expect(hidden).toHaveLength(0);
      // tenant courant = bon tenant => ligne visible
      await qr.query(`SET LOCAL app.current_tenant_id = '${TENANT}'`);
      const visible = await qr.query(
        `SELECT id FROM insure_expert_assignments WHERE id = $1`,
        [id],
      );
      expect(visible).toHaveLength(1);
      await qr.rollbackTransaction();
    } finally {
      await qr.release();
    }
  });

  it('la policy est renommee', async () => {
    await migration.up(ds.createQueryRunner());
    const pol = await ds.query(`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'insure_expert_assignments'
    `);
    expect(pol.map((p: { policyname: string }) => p.policyname)).toContain(
      'insure_expert_assignments_tenant_isolation',
    );
  });

  it('les nouvelles colonnes sont nullables et acceptent NULL pour les lignes legacy', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    const rows = await ds.query(
      `SELECT expert_id, garage_address, honoraire_payment_status
       FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    expect(rows[0].expert_id).toBeNull();
    expect(rows[0].garage_address).toBeNull();
    // DEFAULT applique en fast default
    expect(rows[0].honoraire_payment_status).toBe('pending');
  });

  it('accepte le statut in_progress apres elargissement du CHECK', async () => {
    await migration.up(ds.createQueryRunner());
    const id = randomUUID();
    await ds.query(
      `INSERT INTO insure_expert_assignments
        (id, tenant_id, carrier_tenant_id, carrier_user_id,
         expert_tenant_id, expert_user_id, sinistre_id, status, expert_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'in_progress',$8)`,
      [id, TENANT, CARRIER_TENANT, CARRIER_USER, EXPERT_TENANT, EXPERT_USER, SINISTRE, EXPERT_REF],
    );
    const rows = await ds.query(
      `SELECT status FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    expect(rows[0].status).toBe('in_progress');
  });

  it('FK expert_id refuse une valeur orpheline (RESTRICT)', async () => {
    await migration.up(ds.createQueryRunner());
    const id = randomUUID();
    await expect(
      ds.query(
        `INSERT INTO insure_expert_assignments
          (id, tenant_id, carrier_tenant_id, carrier_user_id,
           expert_tenant_id, expert_user_id, sinistre_id, status, expert_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'designated',$8)`,
        [id, TENANT, CARRIER_TENANT, CARRIER_USER, EXPERT_TENANT, EXPERT_USER, SINISTRE, randomUUID()],
      ),
    ).rejects.toThrow();
  });

  it('refuse honoraire_payment_status hors enum', async () => {
    await migration.up(ds.createQueryRunner());
    const id = randomUUID();
    await expect(
      ds.query(
        `INSERT INTO insure_expert_assignments
          (id, tenant_id, carrier_tenant_id, carrier_user_id,
           expert_tenant_id, expert_user_id, sinistre_id, status, honoraire_payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'designated','bogus')`,
        [id, TENANT, CARRIER_TENANT, CARRIER_USER, EXPERT_TENANT, EXPERT_USER, SINISTRE],
      ),
    ).rejects.toThrow();
  });

  it('cree les 2 nouveaux index', async () => {
    await migration.up(ds.createQueryRunner());
    const idx = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'insure_expert_assignments'
    `);
    const names = idx.map((r: { indexname: string }) => r.indexname);
    expect(names).toContain('idx_insure_expert_assignments_expert_id');
    expect(names).toContain('idx_insure_expert_assignments_garage');
  });

  it('le trigger updated_at fonctionne sous le nouveau nom', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    const before = await ds.query(
      `SELECT updated_at FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    await new Promise((r) => setTimeout(r, 5));
    await ds.query(
      `UPDATE insure_expert_assignments SET notes = 'touched' WHERE id = $1`,
      [id],
    );
    const after = await ds.query(
      `SELECT updated_at FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    expect(new Date(after[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before[0].updated_at).getTime(),
    );
  });

  it('down() revert proprement et restaure expert_designations avec les donnees', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    await migration.down(ds.createQueryRunner());
    const tbl = await ds.query(
      `SELECT 1 FROM pg_class WHERE relname = 'expert_designations'`,
    );
    expect(tbl).toHaveLength(1);
    const rows = await ds.query(
      `SELECT id, notes FROM expert_designations WHERE id = $1`,
      [id],
    );
    expect(rows[0].notes).toBe('legacy note');
  });

  it('down() gere le piege in_progress (remap -> accepted) sans violer le CHECK', async () => {
    await migration.up(ds.createQueryRunner());
    const id = randomUUID();
    await ds.query(
      `INSERT INTO insure_expert_assignments
        (id, tenant_id, carrier_tenant_id, carrier_user_id,
         expert_tenant_id, expert_user_id, sinistre_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'in_progress')`,
      [id, TENANT, CARRIER_TENANT, CARRIER_USER, EXPERT_TENANT, EXPERT_USER, SINISTRE],
    );
    await expect(migration.down(ds.createQueryRunner())).resolves.not.toThrow();
    const rows = await ds.query(
      `SELECT status FROM expert_designations WHERE id = $1`,
      [id],
    );
    expect(rows[0].status).toBe('accepted');
  });

  it('est idempotent : up -> down -> up sans erreur', async () => {
    await migration.up(ds.createQueryRunner());
    await migration.down(ds.createQueryRunner());
    await expect(migration.up(ds.createQueryRunner())).resolves.not.toThrow();
    const tbl = await ds.query(
      `SELECT 1 FROM pg_class WHERE relname = 'insure_expert_assignments'`,
    );
    expect(tbl).toHaveLength(1);
  });

  it('les 5 anciens index n existent plus sous leur ancien nom', async () => {
    await migration.up(ds.createQueryRunner());
    const idx = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname LIKE 'idx_expert_designations_%'
    `);
    expect(idx).toHaveLength(0);
  });

  it('la table expert_designations n existe plus apres up()', async () => {
    await migration.up(ds.createQueryRunner());
    const tbl = await ds.query(
      `SELECT 1 FROM pg_class WHERE relname = 'expert_designations'`,
    );
    expect(tbl).toHaveLength(0);
  });

  it('conserve l OID de la relation a travers le rename (operation catalogue)', async () => {
    const before = await ds.query(
      `SELECT oid FROM pg_class WHERE relname = 'expert_designations'`,
    );
    await migration.up(ds.createQueryRunner());
    const after = await ds.query(
      `SELECT oid FROM pg_class WHERE relname = 'insure_expert_assignments'`,
    );
    expect(String(after[0].oid)).toBe(String(before[0].oid));
  });

  it('preserve la precision numeric(10,7) de garage_lat/garage_lng', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    await ds.query(
      `UPDATE insure_expert_assignments
         SET garage_lat = 33.5731104, garage_lng = -7.5898434
       WHERE id = $1`,
      [id],
    );
    const rows = await ds.query(
      `SELECT garage_lat, garage_lng FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    expect(Number(rows[0].garage_lat)).toBeCloseTo(33.5731104, 7);
    expect(Number(rows[0].garage_lng)).toBeCloseTo(-7.5898434, 7);
  });

  it('preserve la precision numeric(12,2) de honoraire_mad', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    await ds.query(
      `UPDATE insure_expert_assignments SET honoraire_mad = 12345.67 WHERE id = $1`,
      [id],
    );
    const rows = await ds.query(
      `SELECT honoraire_mad FROM insure_expert_assignments WHERE id = $1`,
      [id],
    );
    expect(Number(rows[0].honoraire_mad)).toBeCloseTo(12345.67, 2);
  });

  it('up() est idempotent (rejoue sans erreur)', async () => {
    await migration.up(ds.createQueryRunner());
    await expect(migration.up(ds.createQueryRunner())).resolves.not.toThrow();
    const tbl = await ds.query(
      `SELECT 1 FROM pg_class WHERE relname = 'insure_expert_assignments'`,
    );
    expect(tbl).toHaveLength(1);
  });

  it('down() est idempotent (rejoue sans erreur)', async () => {
    await migration.up(ds.createQueryRunner());
    await migration.down(ds.createQueryRunner());
    await expect(migration.down(ds.createQueryRunner())).resolves.not.toThrow();
    const tbl = await ds.query(
      `SELECT 1 FROM pg_class WHERE relname = 'expert_designations'`,
    );
    expect(tbl).toHaveLength(1);
  });

  it('accepte une FK garage_tenant_id valide', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    await expect(
      ds.query(
        `UPDATE insure_expert_assignments SET garage_tenant_id = $2 WHERE id = $1`,
        [id, CARRIER_TENANT],
      ),
    ).resolves.not.toThrow();
  });

  it('refuse une FK garage_tenant_id orpheline', async () => {
    const id = await insertLegacyRow('designated');
    await migration.up(ds.createQueryRunner());
    await expect(
      ds.query(
        `UPDATE insure_expert_assignments SET garage_tenant_id = $2 WHERE id = $1`,
        [id, randomUUID()],
      ),
    ).rejects.toThrow();
  });
});
```

### 7.5 Extrait d'entity TypeORM aligne

Fichier `packages/database/src/entities/insure-expert-assignment.entity.ts` :

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type InsureExpertAssignmentStatus =
  | 'designated'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type InsureHonorairePaymentStatus =
  | 'pending'
  | 'invoiced'
  | 'paid'
  | 'overdue';

@Entity({ name: 'insure_expert_assignments' })
@Index('idx_insure_expert_assignments_tenant', ['tenantId'])
@Index('idx_insure_expert_assignments_expert_id', ['expertId'])
@Index('idx_insure_expert_assignments_garage', ['garageTenantId'])
export class InsureExpertAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'carrier_tenant_id', type: 'uuid' })
  carrierTenantId!: string;

  @Column({ name: 'carrier_user_id', type: 'uuid' })
  carrierUserId!: string;

  @Column({ name: 'expert_tenant_id', type: 'uuid' })
  expertTenantId!: string;

  @Column({ name: 'expert_user_id', type: 'uuid' })
  expertUserId!: string;

  @Column({ name: 'sinistre_id', type: 'uuid' })
  sinistreId!: string;

  @Column({ name: 'status', type: 'text' })
  status!: InsureExpertAssignmentStatus;

  @Column({ name: 'designated_at', type: 'timestamptz', default: () => 'now()' })
  designatedAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  // ---- colonnes v3.0 ----

  @Column({ name: 'expert_id', type: 'uuid', nullable: true })
  expertId!: string | null;

  @Column({ name: 'garage_tenant_id', type: 'uuid', nullable: true })
  garageTenantId!: string | null;

  @Column({ name: 'garage_address', type: 'text', nullable: true })
  garageAddress!: string | null;

  @Column({ name: 'garage_lat', type: 'numeric', precision: 10, scale: 7, nullable: true })
  garageLat!: string | null;

  @Column({ name: 'garage_lng', type: 'numeric', precision: 10, scale: 7, nullable: true })
  garageLng!: string | null;

  @Column({ name: 'visit_scheduled_at', type: 'timestamptz', nullable: true })
  visitScheduledAt!: Date | null;

  @Column({ name: 'visit_completed_at', type: 'timestamptz', nullable: true })
  visitCompletedAt!: Date | null;

  @Column({ name: 'report_submitted_at', type: 'timestamptz', nullable: true })
  reportSubmittedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason!: string | null;

  @Column({ name: 'honoraire_mad', type: 'numeric', precision: 12, scale: 2, nullable: true })
  honoraireMad!: string | null;

  @Column({ name: 'honoraire_invoice_id', type: 'uuid', nullable: true })
  honoraireInvoiceId!: string | null;

  @Column({ name: 'honoraire_payment_status', type: 'varchar', length: 20, default: 'pending' })
  honorairePaymentStatus!: InsureHonorairePaymentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.6 Schema Zod aligne (validation stricte)

Fichier `packages/database/src/schemas/insure-expert-assignment.schema.ts` :

```typescript
import { z } from 'zod';

export const InsureExpertAssignmentStatusSchema = z.enum([
  'designated',
  'accepted',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
]);

export const InsureHonorairePaymentStatusSchema = z.enum([
  'pending',
  'invoiced',
  'paid',
  'overdue',
]);

export const InsureExpertAssignmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  carrierTenantId: z.string().uuid(),
  carrierUserId: z.string().uuid(),
  expertTenantId: z.string().uuid(),
  expertUserId: z.string().uuid(),
  sinistreId: z.string().uuid(),
  status: InsureExpertAssignmentStatusSchema,
  expertId: z.string().uuid().nullable(),
  garageTenantId: z.string().uuid().nullable(),
  garageAddress: z.string().nullable(),
  garageLat: z.string().nullable(),
  garageLng: z.string().nullable(),
  visitScheduledAt: z.coerce.date().nullable(),
  visitCompletedAt: z.coerce.date().nullable(),
  reportSubmittedAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  cancelledReason: z.string().nullable(),
  honoraireMad: z.string().nullable(),
  honoraireInvoiceId: z.string().uuid().nullable(),
  honorairePaymentStatus: InsureHonorairePaymentStatusSchema,
});

export type InsureExpertAssignment = z.infer<typeof InsureExpertAssignmentSchema>;
```

### 7.7 Reference colonne par colonne (schema final v3.0)

Le tableau ci-dessous documente chaque colonne de `insure_expert_assignments` apres migration, son origine (heritee de 7.5a ou ajoutee v3.0), sa nullabilite, sa contrainte et sa raison d'etre metier.

| Colonne | Type | Origine | Null | Contrainte / FK | Role metier |
|---------|------|---------|------|-----------------|-------------|
| `id` | uuid | 7.5a | non | PK, DEFAULT gen_random_uuid() | identifiant unique de l'affectation |
| `tenant_id` | uuid | 7.5a | non | FK auth_tenants ON DELETE CASCADE | tenant proprietaire (cle du RLS) |
| `carrier_tenant_id` | uuid | 7.5a | non | FK auth_tenants ON DELETE RESTRICT | tenant de l'assureur |
| `carrier_user_id` | uuid | 7.5a | non | FK auth_users ON DELETE RESTRICT | utilisateur assureur ayant designe |
| `expert_tenant_id` | uuid | 7.5a | non | FK auth_tenants ON DELETE RESTRICT | tenant du cabinet d'expertise |
| `expert_user_id` | uuid | 7.5a | non | FK auth_users ON DELETE RESTRICT | utilisateur expert affecte |
| `sinistre_id` | uuid | 7.5a | non | (pas de FK, reference logique) | dossier sinistre concerne |
| `status` | text | 7.5a (elargi) | non | CHECK 6 valeurs v3.0 | etat du cycle de vie |
| `designated_at` | timestamptz | 7.5a | non | DEFAULT now() | horodatage de la designation |
| `accepted_at` | timestamptz | 7.5a | oui | - | horodatage de l'acceptation |
| `rejected_at` | timestamptz | 7.5a | oui | - | horodatage du refus |
| `rejection_reason` | text | 7.5a | oui | - | motif de refus |
| `completed_at` | timestamptz | 7.5a | oui | - | horodatage de cloture |
| `notes` | text | 7.5a | oui | - | annotations libres |
| `expert_id` | uuid | v3.0 | oui | FK insure_experts ON DELETE RESTRICT | lien referentiel expert (backfill S14) |
| `garage_tenant_id` | uuid | v3.0 | oui | FK auth_tenants | garage de la visite |
| `garage_address` | text | v3.0 | oui | - | adresse postale du garage |
| `garage_lat` | numeric(10,7) | v3.0 | oui | - | latitude geolocalisation |
| `garage_lng` | numeric(10,7) | v3.0 | oui | - | longitude geolocalisation |
| `visit_scheduled_at` | timestamptz | v3.0 | oui | - | visite garage planifiee |
| `visit_completed_at` | timestamptz | v3.0 | oui | - | visite garage effectuee |
| `report_submitted_at` | timestamptz | v3.0 | oui | - | rapport d'expertise soumis (consomme par 2.5.6) |
| `cancelled_at` | timestamptz | v3.0 | oui | - | horodatage d'annulation |
| `cancelled_reason` | text | v3.0 | oui | - | motif d'annulation |
| `honoraire_mad` | numeric(12,2) | v3.0 | oui | - | montant des honoraires en MAD |
| `honoraire_invoice_id` | uuid | v3.0 | oui | (reference logique vers 2.5.7) | facture liee |
| `honoraire_payment_status` | varchar(20) | v3.0 | non | CHECK 4 valeurs, DEFAULT 'pending' | etat de paiement |
| `created_at` | timestamptz | 7.5a | non | DEFAULT now() | creation de la ligne |
| `updated_at` | timestamptz | 7.5a | non | DEFAULT now(), trigger | derniere mise a jour |

### 7.8 Sequence d'execution detaillee du up()

L'ordre des operations dans `up()` n'est pas arbitraire ; il garantit l'idempotence et la coherence referentielle :

1. RENAME table (`expert_designations` -> `insure_expert_assignments`), garde par `IF EXISTS` / `NOT EXISTS` sur `pg_class`.
2. RENAME des 5 index (la table porte deja le nouveau nom ; les index suivent l'OID).
3. RENAME de la policy (reference la table par son nouveau nom dans la clause `ON`).
4. DROP + CREATE du trigger sous le nouveau nom (fonction globale intacte).
5. Elargissement du CHECK status : DROP de l'ancienne contrainte nommee, DROP defensif de la nouvelle, puis ADD de la contrainte 6 valeurs.
6. ADD des 13 colonnes v3.0 (chacune en `IF NOT EXISTS`, fast default), puis CHECK sur `honoraire_payment_status`.
7. CREATE des 2 nouveaux index (`expert_id`, `garage_tenant_id`).
8. COMMENT ON TABLE.

L'etape 6 (ADD `expert_id`) depend de l'existence de `insure_experts` (tache 2.5.4). Si l'ordre etait inverse (colonnes avant rename), le RENAME echouerait sur les gardes ; l'ordre retenu est le seul qui soit a la fois idempotent et atomiquement reversible par le `down()` symetrique.

---

## Section 8 - Tests complets

La couverture cible est >= 90% (table relevant du domaine database). Les cas ci-dessous combinent les tests de structure (7.3) et d'integration (7.4) ; le harness d'integration utilise un PostgreSQL reel avec `SET LOCAL app.current_tenant_id` pour eprouver le RLS.

| # | Cas | Type | Attendu |
|---|-----|------|---------|
| T01 | RENAME table preserve les donnees | integration | ligne legacy lisible sous le nouveau nom |
| T02 | RLS ENABLE conserve | integration | relrowsecurity = true |
| T03 | FORCE conserve | integration | relforcerowsecurity = true |
| T04 | Isolation tenant via policy renommee | integration | autre tenant => 0 ligne ; bon tenant => 1 ligne |
| T05 | Policy renommee presente | integration | insure_expert_assignments_tenant_isolation existe |
| T06 | expert_id nullable | integration | NULL accepte sur lignes legacy |
| T07 | honoraire_payment_status DEFAULT pending | integration | valeur = 'pending' |
| T08 | Statut in_progress accepte | integration | INSERT in_progress OK |
| T09 | FK expert_id RESTRICT orpheline | integration | INSERT rejete |
| T10 | CHECK honoraire_payment_status | integration | valeur hors enum rejetee |
| T11 | 2 nouveaux index crees | integration | idx expert_id + garage presents |
| T12 | Trigger updated_at sous nouveau nom | integration | updated_at avance apres UPDATE |
| T13 | down() restaure expert_designations + data | integration | table + ligne legacy presentes |
| T14 | down() remap in_progress -> accepted | integration | statut = 'accepted', pas d'erreur |
| T15 | Idempotence up/down/up | integration | aucune erreur, table finale presente |
| T16 | Anciens index supprimes | integration | 0 index idx_expert_designations_* |
| T17 | Table expert_designations absente apres up | integration | 0 ligne pg_class |
| T18 | up() emet le RENAME table | structure | SQL contient le RENAME |
| T19 | up() renomme 5 index | structure | 5 RENAME presents |
| T20 | up() renomme la policy | structure | ALTER POLICY ... RENAME present |
| T21 | up() recree trigger + jamais DROP FUNCTION | structure | CREATE TRIGGER, pas de DROP FUNCTION |
| T22 | up() elargit CHECK avec in_progress | structure | 'in_progress' present |
| T23 | up() ADD 13 colonnes | structure | 13 ADD COLUMN IF NOT EXISTS |
| T24 | up() FK expert_id RESTRICT | structure | REFERENCES insure_experts(id) ON DELETE RESTRICT |
| T25 | up() COMMENT ON TABLE | structure | COMMENT present |
| T26 | down() remap avant CHECK | structure | ordre remap < ADD CONSTRAINT |
| T27 | down() restaure CHECK 5 valeurs | structure | pas de in_progress dans le bloc |
| T28 | down() RENAME inverse | structure | RENAME TO expert_designations |
| T29 | down() jamais DROP FUNCTION | structure | absent |
| T30 | down() DROP 13 colonnes | structure | DROP COLUMN IF EXISTS presents |
| T31 | garage_lat/garage_lng precision conservee | integration | numeric(10,7) round-trip exact |
| T32 | FK garage_tenant_id valide | integration | garage_tenant_id pointant un tenant existant accepte |
| T33 | up() idempotent (rejoue sans erreur) | integration | second up() ne leve pas |
| T34 | down() idempotent (rejoue sans erreur) | integration | second down() ne leve pas |
| T35 | OID de la table inchange apres rename | integration | meme oid avant/apres up() |
| T36 | honoraire_mad accepte 12,2 | integration | montant a 2 decimales round-trip exact |

Note d'execution : la fixture globale du package `database` cree au prealable les fonctions `set_updated_at_column()` et `app_can_access_tenant(uuid)` ainsi que les tables `auth_tenants`, `auth_users` et `insure_experts`. Chaque test recree l'etat 7.5a (`expert_designations`) dans `beforeEach`, garantissant l'isolation.

---

## Section 9 - Variables environnement

| Variable | Role | Exemple |
|----------|------|---------|
| `DATABASE_URL_TEST` | URL PostgreSQL de la base de test (harness integration). | `postgres://insurtech:secret@localhost:5433/insurtech_test` |
| `DATABASE_URL` | URL PostgreSQL de la base de dev (application de la migration). | `postgres://insurtech:secret@localhost:5432/insurtech_dev` |
| `PGAPPNAME` | Nom d'application pour tracer les sessions migration dans les logs PostgreSQL. | `assurflow-migration-2.5.5` |
| `NODE_ENV` | Doit valoir `test` pour les specs, `development` pour l'application locale. | `test` |
| `TYPEORM_MIGRATIONS_RUN` | Active l'execution automatique des migrations au boot (false en CI de test unitaire). | `false` |
| `APP_CURRENT_TENANT_PARAM` | Nom du parametre de session RLS (doit correspondre a `app.current_tenant_id`). | `app.current_tenant_id` |

---

## Section 10 - Commandes shell

```bash
# Se placer dans le package database
cd packages/database

# 1. Verifier la compilation TypeScript stricte
pnpm typecheck

# 2. Lint
pnpm lint

# 3. Tests de structure (rapides, sans base)
pnpm vitest run src/migrations/__tests__/1735000000014-Sprint75bExpertAssignmentsRename.spec.ts

# 4. Demarrer la base de test (docker compose dedie)
pnpm db:test:up

# 5. Tests d'integration (harness PostgreSQL reel)
pnpm vitest run test/integration/expert-assignments-rename.integration.spec.ts

# 6. Couverture
pnpm test --coverage

# 7. Appliquer la migration contre la base de dev
pnpm typeorm migration:run -d ./src/data-source.ts

# 8. Verifier l'etat (table, policy, index)
psql "$DATABASE_URL" -c "\d+ insure_expert_assignments"
psql "$DATABASE_URL" -c "SELECT policyname FROM pg_policies WHERE tablename='insure_expert_assignments';"

# 9. Reverter la migration (test du down)
pnpm typeorm migration:revert -d ./src/data-source.ts

# 10. Re-appliquer (verifie idempotence operationnelle)
pnpm typeorm migration:run -d ./src/data-source.ts

# 11. Verification zero emoji (decision-006)
./scripts/check-no-emoji.sh

# 12. Verification finale globale
pnpm verify
```

---

## Section 11 - Criteres de validation

### Criteres P0 (>= 15, bloquants)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V1 | La migration compile | `pnpm typecheck` | exit 0 | erreur TS => corriger types |
| V2 | RENAME table present | grep RENAME | `ALTER TABLE expert_designations RENAME TO insure_expert_assignments` | absent => up incomplet |
| V3 | Donnees preservees | T01 | ligne legacy lisible | 0 ligne => RENAME rate ou DROP accidentel |
| V4 | RLS ENABLE conserve | T02 | relrowsecurity=true | false => RLS perdu |
| V5 | FORCE conserve | T03 | relforcerowsecurity=true | false => FORCE perdu |
| V6 | Isolation tenant active | T04 | autre tenant=0, bon tenant=1 | fuite cross-tenant |
| V7 | Policy renommee | T05 | nom aligne present | ancien nom => piege 3 |
| V8 | expert_id nullable | T06 | NULL accepte | NOT NULL => casse legacy |
| V9 | FK expert_id RESTRICT | T09 | INSERT orphelin rejete | accepte => FK manquante |
| V10 | in_progress accepte | T08 | INSERT OK | rejete => CHECK pas elargi |
| V11 | CHECK honoraire | T10 | valeur hors enum rejetee | accepte => CHECK manquant |
| V12 | Trigger updated_at actif | T12 | updated_at avance | inchange => trigger casse |
| V13 | down() restaure data | T13 | table+ligne presentes | perte => down incorrect |
| V14 | down() gere in_progress | T14 | accepted sans erreur | violation CHECK => piege 1 |
| V15 | Idempotence | T15 | up/down/up OK | erreur => gardes manquantes |
| V16 | Zero emoji | `./scripts/check-no-emoji.sh` | exit 0 | emoji detecte => CI fail |
| V17 | Fonction jamais droppee | grep | pas de `DROP FUNCTION set_updated_at_column` | present => casse autres tables |

### Criteres P1 (>= 8, importants)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V18 | Lint propre | `pnpm lint` | exit 0 | warning/erreur |
| V19 | 5 index renommes | T19 | 5 RENAME | index mal nommes |
| V20 | Anciens index absents | T16 | 0 idx_expert_designations_* | ancien nom subsiste |
| V21 | 2 nouveaux index | T11 | expert_id + garage presents | absent => requete lente |
| V22 | 13 colonnes ajoutees | T23 | 13 ADD COLUMN | colonne manquante |
| V23 | DEFAULT pending | T07 | 'pending' | DEFAULT absent |
| V24 | COMMENT mis a jour | T25 | COMMENT present | absent |
| V25 | Couverture >= 90% | `pnpm test --coverage` | >= 90% | en dessous => ajouter cas |
| V26 | Migration enregistree | grep index.ts | classe dans `migrations[]` | absente => non executee |

### Criteres P2 (>= 5, qualite)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V27 | Naming migration correct | ls | `1735000000014-Sprint75bExpertAssignmentsRename.ts` | nom non conforme |
| V28 | Classe nommee correctement | grep | `Sprint75bExpertAssignmentsRename1735000000014` | mismatch loader |
| V29 | Entity alignee | T (compile) | entity reflete schema | divergence |
| V30 | Schema Zod aligne | compile | enum 6 + 4 valeurs | divergence |
| V31 | Application+revert dev OK | cmd 7/9/10 | succes | echec operationnel |
| V32 | Application puis re-run | cmd 7/10 | pas de double-application | erreur replay |
| V33 | OID inchange apres rename | T35 | meme oid avant/apres | OID different => recreate accidentel |
| V34 | Precision geo conservee | T31 | round-trip 7 decimales exact | perte de precision => type errone |
| V35 | Precision honoraire conservee | T36 | round-trip 2 decimales exact | arrondi => type errone |
| V36 | up() idempotent integration | T33 | second up() sans erreur | gardes IF NOT EXISTS manquantes |
| V37 | down() idempotent integration | T34 | second down() sans erreur | gardes IF EXISTS manquantes |
| V38 | FK garage_tenant_id orpheline rejetee | T (refuse FK garage) | INSERT/UPDATE rejete | FK garage manquante |

### Synthese de la pyramide de validation

La validation se lit en trois etages cumulatifs. Les criteres P0 (V1 a V17) sont bloquants : un seul echec interdit le merge, car il signale soit une perte de donnees, soit une regression de securite (RLS/FORCE/isolation), soit une migration non reversible. Les criteres P1 (V18 a V26) garantissent la qualite operationnelle (lint, index, colonnes, couverture, enregistrement). Les criteres P2 (V27 a V38) verifient la conformite fine (nommage, alignement entity/Zod, precision numerique, idempotence integration, OID stable). Le total de 38 criteres couvre les 25+ exiges, repartis pour qu'aucune dimension (donnees, securite, schema, performance, reversibilite) ne soit laissee sans garde-fou automatise.

---

## Section 12 - Edge cases et troubleshooting

1. **`relation "insure_experts" does not exist`** lors du `ADD COLUMN expert_id ... REFERENCES insure_experts(id)` : la tache 2.5.4 n'a pas ete appliquee. Appliquer d'abord la migration `1735000000013`. C'est la dependance dure.
2. **`check constraint "expert_designations_status_chk" is violated by some row`** lors du `down()` : il reste des lignes `in_progress`. Verifier que le bloc `DO` de remap (`SET status='accepted' WHERE status='in_progress'`) s'execute bien AVANT le `ADD CONSTRAINT`. C'est le piege 1.
3. **`policy "expert_designations_tenant_isolation" for table "insure_expert_assignments" does not exist`** : la policy a deja ete renommee (replay partiel). Le bloc `DO` avec `IF EXISTS` sur `pg_policies` rend l'operation idempotente ; ignorer si la policy cible existe deja.
4. **`relation "expert_designations" does not exist`** au demarrage du `up()` : soit 7.5a n'est pas applique, soit la migration a deja tourne (table deja renommee). La garde `DO` sur `pg_class` evite l'erreur ; verifier l'etat avec `\d insure_expert_assignments`.
5. **Lock long en production** : `ALTER TABLE ... RENAME` prend un `ACCESS EXCLUSIVE LOCK`. Sur table tres active, planifier en fenetre de faible trafic. Le lock est bref (catalogue), mais bloque les ecritures concurrentes durant la transaction.
6. **Reecriture de table inattendue** : si quelqu'un ajoute une colonne avec un DEFAULT volatile (`now()`), PostgreSQL reecrit toute la table. N'utiliser que NULL ou DEFAULT scalaire constant (`'pending'`).
7. **Trigger absent apres up()** : si `set_updated_at_column()` n'existe pas dans la base, le `CREATE TRIGGER` echoue. Cette fonction est livree par une migration de fondation anterieure ; verifier sa presence (`\df set_updated_at_column`).
8. **Couverture < 90%** : ajouter des cas sur les branches de garde `DO` (replay partiel), et sur les colonnes geo (`garage_lat`/`garage_lng`).
9. **`column "expert_id" of relation "insure_expert_assignments" already exists`** lors d'un replay du `up()` : la colonne a deja ete ajoutee. Le `ADD COLUMN IF NOT EXISTS` rend l'operation idempotente ; cette erreur ne doit jamais apparaitre si le `IF NOT EXISTS` est present sur chaque `ADD COLUMN`. Verifier qu'aucun `ADD COLUMN` n'a ete ecrit sans la clause de garde.
10. **`constraint "insure_expert_assignments_status_chk" for relation ... already exists`** lors d'un replay : le CHECK a deja ete pose. La sequence DROP CONSTRAINT IF EXISTS puis ADD CONSTRAINT garantit l'idempotence ; ne jamais faire un ADD CONSTRAINT sans le DROP IF EXISTS prealable.
11. **`could not obtain lock on relation "expert_designations"`** : une transaction concurrente detient un verrou. Identifier la session bloquante (`SELECT * FROM pg_locks JOIN pg_stat_activity USING (pid) WHERE relation = 'expert_designations'::regclass`), la terminer ou attendre, puis relancer. Positionner `SET lock_timeout = '5s'` pour echouer proprement plutot que d'attendre indefiniment.
12. **`function set_updated_at_column() does not exist`** au `CREATE TRIGGER` : la fonction de fondation n'a pas ete installee dans la base cible (migration de fondation manquante ou base de test mal amorcee). Verifier avec `\df set_updated_at_column` et, en test, s'assurer que la fixture globale du package `database` la cree avant cette migration.
13. **`policy "insure_expert_assignments_tenant_isolation" already exists for table`** lors d'un replay du `up()` apres un `down()` partiel : la policy a survecu sous le nouveau nom. Le bloc `DO` qui renomme verifie `IF EXISTS` sur l'ANCIEN nom, donc ne tente le RENAME que si l'ancien nom existe encore ; il est idempotent par construction.
14. **Donnees visibles cross-tenant en test malgre le RLS** : symptome d'un `SET LOCAL app.current_tenant_id` absent ou d'une connexion superutilisateur qui contourne le RLS. Le FORCE ROW LEVEL SECURITY empeche le contournement par le proprietaire, mais un role `BYPASSRLS` ou `SUPERUSER` ignore toujours le RLS. En test, utiliser un role applicatif non-superuser et toujours poser `SET LOCAL app.current_tenant_id` dans la transaction.
15. **`numeric field overflow` sur `honoraire_mad`** : un montant superieur a 9 999 999 999.99 depasse `numeric(12,2)`. Pour des honoraires d'expertise au Maroc, ce plafond (10 milliards de centimes) est largement suffisant ; si un montant aberrant declenche l'erreur, il s'agit d'une donnee invalide a corriger en amont, pas du schema.
16. **`down()` laisse des colonnes orphelines si interrompu** : si le `down()` echoue au milieu, certaines colonnes peuvent etre droppees et d'autres non. Chaque `DROP COLUMN IF EXISTS` etant idempotent, relancer le `down()` complete proprement le revert. La transaction TypeORM annule normalement tout en cas d'echec, mais en cas de `COMMIT` partiel manuel (a proscrire), le re-run reste sur.

---

## Section 13 - Conformite Maroc

- **ACAPS (traceabilite)** : la preservation integrale des donnees existantes via le `RENAME` (et non un drop/recreate) garantit que l'historique des affectations d'experts reste auditable. Aucune affectation enregistree par le 7.5a n'est perdue, ce qui est essentiel pour la tracabilite reglementaire des dossiers sinistres exigee par l'ACAPS.
- **CNDP (loi 09-08 sur la protection des donnees personnelles)** : les donnees personnelles (identifiants utilisateurs carrier/expert, geolocalisation garage) restent confinees au tenant via le RLS + FORCE maintenus. La policy `insure_expert_assignments_tenant_isolation` continue d'imposer `app_can_access_tenant(tenant_id)`, empechant tout acces inter-tenant non autorise.
- **Loi 17-99 (Code des assurances)** : la modelisation des honoraires d'expert en MAD (`honoraire_mad numeric(12,2)`) et du cycle de paiement (`honoraire_payment_status`) supporte les obligations de tarification et de reglement propres au marche assurantiel marocain.
- **Cloud souverain (decision-008)** : aucune donnee assure ne quitte le territoire ; la migration s'execute exclusivement sur l'infrastructure Atlas Benguerir (DC1 Tier III + DC2 Tier IV). Le `RENAME` ne deplace aucune donnee hors base.

---

## Section 14 - Conventions absolues skalean-insurtech

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; contexte propage via `AsyncLocalStorage` ; RLS PostgreSQL via `app_can_access_tenant()` ; audit trail systematique.
- **Validation strict** : Zod uniquement ; schemas exportes ; pattern `const Schema = z.object(...)` ; `type X = z.infer<typeof Schema>`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; JSON structure avec champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id parametres 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; `engine-strict` Node >= 22.11.0 ; `save-exact` ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; couverture >= 85% global, >= 90% pour auth/database/signature.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles v3.0.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par event ; `Idempotency-Key` sur les flux critiques.
- **Imports strict** : `@insurtech/{name}` ; paths dans `tsconfig.base.json` ; ordre Node / external / @insurtech / relative.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un fournisseur frontier ; mock pour environnements 1-28, reel en 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; la CI echoue si une emoji est detectee.
- **Idempotency-Key strict** : `POST /payments`, `/signatures`, `/claims`, et ecritures MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc ; AES-256-GCM ; TLS 1.3.
- **Naming v3.0 (decision-011)** : Skalean (societe), Assurflow (vertical), Sofidemy (marque).

---

## Section 15 - Validation pre-commit

```bash
# Sequence obligatoire avant tout commit
cd packages/database

pnpm typecheck                 # V1
pnpm lint                      # V18
pnpm vitest run src/migrations/__tests__/1735000000014-Sprint75bExpertAssignmentsRename.spec.ts
pnpm db:test:up
pnpm vitest run test/integration/expert-assignments-rename.integration.spec.ts
pnpm test --coverage           # V25 >= 90%
./scripts/check-no-emoji.sh    # V16

# Verifier que la migration est enregistree
grep "Sprint75bExpertAssignmentsRename1735000000014" src/migrations/index.ts

# Application + revert + re-application sur la base de dev
pnpm typeorm migration:run -d ./src/data-source.ts
pnpm typeorm migration:revert -d ./src/data-source.ts
pnpm typeorm migration:run -d ./src/data-source.ts
```

Le hook husky `pre-commit` execute commitlint, lint-staged et `check-no-emoji.sh`. Aucun commit n'est accepte si l'un de ces controles echoue.

---

## Section 16 - Commit message

```
feat(sprint-7.5b): rename expert_designations to insure_expert_assignments + alter add v3.0

Renomme la table expert_designations (livree par le Sprint 7.5a, migration 011)
en insure_expert_assignments et ajoute les colonnes du modele v3.0, en preservant
les donnees existantes, le RLS, le FORCE ROW LEVEL SECURITY, la policy d'isolation
tenant, les index et le trigger updated_at. Conformement a la resolution de conflit,
le Sprint 7.5a fait autorite : on fait evoluer sa table plutot que d'en creer une
parallele.

- ALTER TABLE expert_designations RENAME TO insure_expert_assignments
- renommage des 5 index et de la policy d'isolation tenant
- recreation du trigger updated_at sous le nouveau nom (fonction globale preservee)
- elargissement du CHECK status avec la valeur in_progress (6 valeurs)
- ajout de 13 colonnes v3.0 (expert_id FK insure_experts, garage_*, jalons, honoraires MAD)
- 2 nouveaux index (expert_id, garage_tenant_id)
- down() symetrique avec remap in_progress -> accepted avant restauration du CHECK 5 valeurs

Task: 2.5.5
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: 013 + 7.5a authoritative
```

---

## Section 17 - Workflow next step

Une fois cette tache validee (tous criteres P0 verts, couverture >= 90%, zero emoji, migration appliquee/revertee/reappliquee avec succes), passer a la tache **2.5.6 - `insure_expert_reports`** (rapports d'expertise). Cette tache suivante :

- cree la table `insure_expert_reports` qui reference `insure_expert_assignments(id)` (d'ou le blocage 2.5.5 -> 2.5.6) ;
- modelise le contenu du rapport d'expertise (constats, montants chiffres, photos, conclusion) ;
- reutilise le pattern RLS + FORCE + policy d'isolation tenant + trigger updated_at ;
- portera la migration `1735000000015`.

Verifier avant de demarrer 2.5.6 que la colonne `report_submitted_at` de `insure_expert_assignments` est bien en place (ajoutee par la presente tache), car elle sera mise a jour lors de la soumission d'un rapport.

---

<!-- FIN task-2.5.5-rename-expert-designations-to-assignments.md | Sprint 7.5b | Phase 2 | P0 | Task 2.5.5 | Decisions 013 + 7.5a authoritative | AUCUNE EMOJI (decision-006) -->
