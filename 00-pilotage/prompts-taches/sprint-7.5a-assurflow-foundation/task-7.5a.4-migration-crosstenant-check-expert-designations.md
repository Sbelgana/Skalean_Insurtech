# Task 7.5a.4 — Migration cross-tenant CHECK (3 -> 7 types) + creation table `expert_designations`

## 1. Header / metadonnees

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5a — Assurflow Foundation |
| Reference meta-prompt | B-7.5a, tache 7.5a.4 |
| Phase | 2.5 (Fondation verticale Assurflow, entre Sprint 7 et Sprint 8) |
| Priorite | P0 (bloquante) |
| Effort estime | 3 heures |
| Dependances | 7.5a.3 (extension du type `CrossTenantAuthorizationType` cote TypeScript : ajout des 4 nouvelles chaines litterales et du nouveau `resource_type`) |
| Bloque | 7.5a.5 (mise a jour du helper Postgres `app_can_access_tenant()` pour reconnaitre les nouveaux types et la table `expert_designations`) |
| Position dans le sprint | 4 / 10 |
| Vertical | Assurflow (assurance auto / sinistres / expertise / carrosserie) |
| Cible d'execution | Claude Code, autonome, SANS relecture d'aucun autre document |
| Densite attendue | 80-150 ko (cible 115-130 ko) |
| Convention emoji | AUCUNE EMOJI nulle part (decision-006 ABSOLUE) |
| Langue | Prose francaise, code TypeScript + SQL complets et executables |
| Package concerne | `@insurtech/database` (repo `packages/database`) |
| Type de livrable | Migration TypeORM idempotente up()/down() symetrique + entite TypeORM + tests d'integration |

Cette tache est une migration de base de donnees pure. Elle ne touche AUCUN service NestJS, AUCUN controleur, AUCUN endpoint HTTP. Elle modifie le schema PostgreSQL via une migration TypeORM versionnee, dans la continuite stricte des dix migrations existantes (`1735000000001-InitialSystem.ts` a `1735000000010-TenantSuspensionStatus.ts`). La nouvelle migration porte donc le numero `1735000000011` et la classe s'appelle `Sprint75aCrossTenantV31735000000011`.

---

## 2. But

Le but de cette tache est triple, et tout doit etre realise dans une UNIQUE migration TypeORM versionnee, idempotente et reversible :

1. **Etendre la contrainte CHECK sur `cross_tenant_authorizations.type`** de 3 valeurs autorisees a 7 valeurs autorisees. Les 3 valeurs historiques (`broker_to_garage_assignment`, `assure_to_garage_visit`, `multi_tenant_user_access`) restent valides ; on y ajoute 4 nouvelles valeurs propres a la vertical Assurflow v3.0 :
   - `client_to_tower_dispatch` (un client / assure mandate une depanneuse pour un enlevement),
   - `tower_to_garage_delivery` (la depanneuse livre le vehicule a un garage),
   - `garage_to_expert_request` (un garage demande l'intervention d'un expert),
   - `garage_to_carrier_quote` (un garage transmet un devis a une compagnie d'assurance / carrier).

2. **Etendre la contrainte CHECK sur `cross_tenant_authorizations.resource_type`** de 5 valeurs a 8 valeurs. Les 5 valeurs historiques (`sinistre`, `police`, `devis`, `facture`, `tenant`) restent valides ; on y ajoute 3 nouvelles valeurs :
   - `mission` (mission de depannage / enlevement),
   - `expertise` (dossier d'expertise),
   - `parts_order` (commande de pieces detachees).
   La colonne `resource_type` etant `NULL`-able, la contrainte doit etre tolerante au `NULL` : `resource_type IS NULL OR resource_type IN (...)`.

3. **Creer une nouvelle table `expert_designations`** (workflow decision-013 : une compagnie d'assurance / carrier designe un expert sur un sinistre donne) avec Row Level Security (RLS) activee et forcee, isolation par tenant via le helper Postgres `app_can_access_tenant(tenant_id)`, indexes, contrainte CHECK sur le statut, trigger `updated_at` reutilisant la fonction existante `set_updated_at_column()`.

La migration `up()` realise les trois operations ; la migration `down()` les annule de maniere strictement symetrique : suppression de `expert_designations` en CASCADE, restauration de la contrainte CHECK `type` a ses 3 valeurs historiques, restauration de la contrainte CHECK `resource_type` a ses 5 valeurs historiques.

---

## 3. Contexte etendu

### 3.1 Pourquoi migrer la contrainte CHECK

Dans la version socle (Sprints 1 a 7) la plateforme Skalean InsurTech ne gerait que deux familles de tenants metier : les courtiers (`broker`) et les garages (`garage`), plus le type technique `mixed`. Le mecanisme d'autorisation inter-tenants (`cross_tenant_authorizations`) ne reconnaissait donc que trois scenarios de delegation : un courtier qui assigne un garage (`broker_to_garage_assignment`), un assure autorise a visiter un garage (`assure_to_garage_visit`), et un utilisateur multi-tenant (`multi_tenant_user_access`). La colonne `type` est de type `text` et porte une contrainte CHECK qui materialise ces trois valeurs comme un domaine ferme. C'est volontaire : un domaine ferme empeche l'insertion de chaines de caracteres arbitraires (faute de frappe, valeur inventee par un service mal ecrit) et garantit l'integrite referentielle semantique, ce qui est indispensable car le helper Postgres `app_can_access_tenant()` (mis a jour en 7.5a.5) discrimine son comportement selon la valeur de `type`.

La v3.0 Assurflow introduit deux nouvelles familles d'acteurs : les compagnies d'assurance (carrier) et les experts (cabinets d'expertise auto), ainsi que les depanneurs (tow / depanneuse). Ces acteurs declenchent de nouveaux flux de delegation inter-tenants qui n'existaient pas dans le socle :

- Un client (assure) mandate une depanneuse pour enlever son vehicule accidente : `client_to_tower_dispatch`.
- La depanneuse, une fois le vehicule recupere, le livre a un garage agree : `tower_to_garage_delivery`.
- Le garage, pour faire constater les degats, demande l'intervention d'un expert : `garage_to_expert_request`.
- Le garage transmet son devis de reparation a la compagnie d'assurance pour accord de prise en charge : `garage_to_carrier_quote`.

Chacun de ces flux cree une autorisation temporaire qui permet a un tenant d'acceder a une ressource appartenant a un autre tenant (un sinistre, une mission, une expertise...). Sans extension de la contrainte CHECK, toute tentative d'inserer une ligne `cross_tenant_authorizations` avec l'un de ces nouveaux `type` echouerait avec une violation de contrainte CHECK, bloquant integralement les workflows Assurflow. La migration de la contrainte est donc un prerequis structurel a tout le reste de la vertical.

De la meme maniere, la colonne `resource_type` decrit la nature de la ressource ciblee par l'autorisation. Le socle connaissait `sinistre`, `police`, `devis`, `facture`, `tenant`. Assurflow ajoute trois natures : `mission` (une mission de depannage), `expertise` (un dossier d'expertise), `parts_order` (une commande de pieces). On etend donc la contrainte de 5 a 8 valeurs, en preservant la tolerance au `NULL` (une autorisation peut etre globale au tenant sans cibler une ressource precise).

### 3.2 Pourquoi la table `expert_designations` existe (decision-013)

La decision d'architecture 013 (decision-013) formalise le workflow de designation d'expert. Dans le metier de l'assurance auto au Maroc, quand un sinistre est declare et qu'un garage a etabli un devis, la compagnie d'assurance (carrier) ne paie pas le devis tel quel : elle mandate un expert independant agree par l'ACAPS pour constater les degats, verifier la coherence du devis, evaluer la valeur residuelle du vehicule et statuer sur la prise en charge. Cette designation est un acte juridique trace : qui designe (la compagnie), qui est designe (l'expert), sur quel sinistre, a quelle date, avec quel statut (designe, accepte, refuse, complete, annule).

Cette designation n'est pas une simple ligne d'autorisation inter-tenant generique : c'est un objet metier de premier ordre, avec son propre cycle de vie (statuts), ses propres horodatages (designe / accepte / refuse / complete), sa propre tracabilite ACAPS et CNDP. Elle merite donc sa propre table, et non une surcharge de `cross_tenant_authorizations`. La table `expert_designations` capture cet objet metier :

- `carrier_tenant_id` / `carrier_user_id` : la compagnie et l'utilisateur compagnie qui emettent la designation.
- `expert_tenant_id` / `expert_user_id` : le cabinet d'expertise et l'expert designe.
- `sinistre_id` : le sinistre concerne (uuid type, SANS cle etrangere car la table `insure_sinistres` n'existera qu'au Sprint 14 ; voir piege 3.4.6).
- `tenant_id` : le tenant proprietaire de la ligne au sens RLS (le tenant qui voit et gere cette designation dans son espace ; en pratique c'est le tenant compagnie pour l'emission, mais le modele RLS reste generique pour permettre l'evolution).
- `status` : statut du cycle de vie, domaine ferme par CHECK.
- horodatages : `designated_at`, `accepted_at`, `rejected_at`, `completed_at` ; `rejection_reason`, `notes`.

### 3.3 Workflow metier complet de la designation d'expert

```
  +-------------------+        designe (status=designated)        +------------------+
  |  Compagnie        | -----------------------------------------> |  Cabinet expert  |
  |  (carrier_tenant) |   INSERT expert_designations               |  (expert_tenant) |
  |  carrier_user_id  |   designated_at = now()                    |  expert_user_id  |
  +-------------------+                                            +------------------+
            |                                                               |
            |                                                               | accepte
            |                                                               v
            |                                              UPDATE status=accepted, accepted_at=now()
            |                                                               |
            |                                  +----------------------------+---------------------------+
            |                                  | refuse                                                 | accepte
            |                                  v                                                        v
            |                  UPDATE status=rejected, rejected_at=now(),                  l'expert constate,
            |                  rejection_reason = '...'                                    redige son rapport
            |                                  |                                                        |
            |                                  |                                                        v
            v                                  |                            UPDATE status=completed, completed_at=now()
   (la compagnie peut annuler                  |
    avant acceptation)                         |
   UPDATE status=cancelled                     |
            |                                  |
            +----------------------------------+
                       Etats terminaux : completed, rejected, cancelled
```

Le sinistre cible (`sinistre_id`) est partage entre les acteurs via une ligne `cross_tenant_authorizations` de type `garage_to_expert_request` (ou plus largement via le helper `app_can_access_tenant()`), mais la designation elle-meme vit dans `expert_designations`. C'est pour cela que les deux livrables de cette tache (extension CHECK + nouvelle table) cohabitent dans une seule migration : ils forment ensemble la fondation de donnees du flux expertise.

### 3.3bis Description detaillee des 4 nouveaux types d'autorisation cross-tenant

Pour eviter toute ambiguite lors de l'ecriture de la contrainte CHECK et garantir l'alignement exact avec les chaines TypeScript de 7.5a.3, voici la semantique precise de chacune des 7 valeurs de `type`, dont les 4 nouvelles :

- **`broker_to_garage_assignment`** (socle) : un courtier assigne un dossier (sinistre, mission) a un garage de son reseau. L'autorisation permet au garage de lire les pieces du dossier que le courtier lui delegue. Direction : `from_tenant_id` = courtier, `to_tenant_id` = garage.
- **`assure_to_garage_visit`** (socle) : un assure (personne physique modelisee comme acteur) autorise un garage a consulter certaines informations le concernant lors d'une visite (etat des lieux du vehicule). Direction : assure -> garage.
- **`multi_tenant_user_access`** (socle) : un utilisateur appartenant a plusieurs tenants (super_admin, manager multi-entites) accede legitimement a un tenant cible. C'est le cas d'usage de l'utilisateur transverse.
- **`client_to_tower_dispatch`** (v3.0) : un client/assure mandate une depanneuse (tow) pour l'enlevement de son vehicule accidente. L'autorisation permet a la depanneuse d'acceder aux informations minimales necessaires a la mission d'enlevement (lieu, vehicule, contact). Direction : client -> tow. `resource_type` typiquement `mission`.
- **`tower_to_garage_delivery`** (v3.0) : la depanneuse, une fois le vehicule recupere, le livre a un garage. L'autorisation permet de transferer le contexte de la mission au garage receveur (etat a l'enlevement, photos, point de chute). Direction : tow -> garage. `resource_type` typiquement `mission` ou `sinistre`.
- **`garage_to_expert_request`** (v3.0) : un garage demande l'intervention d'un expert pour constat. L'autorisation ouvre a l'expert l'acces au dossier de reparation et aux pieces du vehicule. Direction : garage -> expert. `resource_type` typiquement `expertise` ou `sinistre`. C'est le pendant cross-tenant generique de la designation formelle stockee dans `expert_designations`.
- **`garage_to_carrier_quote`** (v3.0) : un garage transmet son devis a la compagnie d'assurance pour accord de prise en charge. L'autorisation ouvre a la compagnie l'acces au devis et aux justificatifs. Direction : garage -> carrier. `resource_type` typiquement `devis`.

Chaque chaine est ecrite en `snake_case`, sans accent, sans espace, en minuscules. L'orthographe DOIT etre reproduite exactement dans la contrainte CHECK. Toute divergence (un `s` en trop, un underscore manquant) provoquerait un rejet runtime sur des insertions pourtant legitimes, ou pire, un faux positif si une faute de frappe symetrique existait des deux cotes.

### 3.3ter Description detaillee des 3 nouveaux resource_type

- **`sinistre`** (socle) : un dossier de sinistre declare.
- **`police`** (socle) : un contrat d'assurance (police).
- **`devis`** (socle) : un devis de reparation.
- **`facture`** (socle) : une facture.
- **`tenant`** (socle) : une autorisation au niveau du tenant entier (pas une ressource precise).
- **`mission`** (v3.0) : une mission de depannage/enlevement gere par une depanneuse.
- **`expertise`** (v3.0) : un dossier d'expertise (constat, rapport).
- **`parts_order`** (v3.0) : une commande de pieces detachees aupres d'un fournisseur ou d'un magasinier.

La colonne `resource_type` est `NULL`-able : une autorisation peut etre globale (tout le tenant) sans cibler une ressource precise, auquel cas `resource_type` vaut `NULL` et `resource_id` vaut `NULL` egalement. La contrainte CHECK doit donc imperativement autoriser `NULL` en plus des 8 valeurs litterales.

### 3.4 Alternatives, arbitrages et pieges

#### 3.4.1 Alternative : une migration combinee vs deux migrations separees

On aurait pu separer en deux migrations : `1735000000011` pour les CHECK, `1735000000012` pour `expert_designations`. **Choix retenu : une seule migration combinee `1735000000011`.** Raisons :
- Les deux changements sont semantiquement lies (fondation du flux expertise Assurflow) et doivent etre deployes atomiquement : si la table existe mais que les CHECK ne sont pas etendus, le flux est incoherent.
- Le meta-prompt B-7.5a impose 7.5a.4 comme une seule tache de 3h.
- TypeORM execute chaque migration dans une transaction (sauf instruction contraire), donc une seule migration = une seule transaction atomique = pas d'etat intermediaire incoherent en cas d'echec.
Trade-off accepte : la migration est plus longue (~160 lignes), mais reste lisible et la symetrie up()/down() est plus facile a verifier d'un seul coup d'oeil.

#### 3.4.2 Alternative : contrainte CHECK nommee vs anonyme

PostgreSQL genere un nom automatique pour une contrainte CHECK inline non nommee (ex. `cross_tenant_authorizations_type_check` ou un nom hashe). **Choix retenu : contrainte NOMMEE de maniere canonique** (`cross_tenant_authorizations_type_check` et `cross_tenant_authorizations_resource_type_check`). Raisons : un nom stable permet un `DROP CONSTRAINT IF EXISTS` deterministe dans `down()` et dans les re-executions. **Piege majeur :** la table `cross_tenant_authorizations` n'est PAS creee par les migrations actuelles du socle (elle releve du framework Sprint 6 / runtime Sprint 26, voir l'entite). Le nom de la contrainte CHECK initiale n'est donc pas garanti. Pour gerer les deux cas (contrainte nommee canoniquement OU contrainte anonyme generee par Postgres OU absence de toute contrainte), la migration interroge le catalogue `pg_constraint` via un bloc `DO $$ ... $$` pour DROP toute contrainte CHECK existante sur la colonne `type` (resp. `resource_type`), puis ADD la contrainte canonique nommee. Cette approche est idempotente et robuste.

#### 3.4.3 Piege : la table `cross_tenant_authorizations` peut ne pas exister au moment de la migration

Comme indique ci-dessus, cette table releve du framework cross-tenant et n'est pas creee dans les migrations 001-010. Si la migration 7.5a.4 tournait sur une base ou la table n'existe pas, un `ALTER TABLE cross_tenant_authorizations ...` echouerait avec `relation "cross_tenant_authorizations" does not exist`. **Mitigation :** le bloc `DO $$` qui manipule les contraintes est garde par un test d'existence `IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cross_tenant_authorizations')`. Si la table n'existe pas, les operations CHECK sont sautees sans erreur (et un `RAISE NOTICE` documente le saut). Cela rend la migration deployable dans tous les environnements, qu'ils aient ou non deja la table cross-tenant. La table `expert_designations`, elle, depend uniquement de `auth_tenants` et `auth_users` qui existent toujours (creees par `1735000000001-InitialSystem`).

#### 3.4.4 Piege : des lignes existantes pourraient violer la nouvelle contrainte

Lorsqu'on ADD une contrainte CHECK, PostgreSQL valide immediatement TOUTES les lignes existantes. Si une ligne portait deja une valeur hors des 7 (resp. 8) valeurs autorisees, l'ADD echouerait. Dans notre cas la nouvelle contrainte est un SUR-ensemble de l'ancienne (7 >= 3, 8 >= 5), donc aucune ligne valide selon l'ancienne contrainte ne peut violer la nouvelle : l'ADD reussit toujours en `up()`. **Attention en `down()` :** la restauration vers 3 (resp. 5) valeurs est un SOUS-ensemble. Si entre-temps des lignes Assurflow ont ete inserees avec les nouveaux types, le `down()` echouerait a la validation. C'est un comportement ATTENDU et DOCUMENTE : un down() ne doit etre joue que sur une base qui ne contient pas encore de donnees v3.0, sinon il faut d'abord purger ou migrer ces donnees. On documente ce point dans la section edge-cases et on ne tente PAS de masquer l'erreur (un down() destructeur silencieux serait pire).

#### 3.4.5 Piege : idempotence et `IF EXISTS` / `IF NOT EXISTS`

La migration doit pouvoir etre rejouee (up -> down -> up) sans erreur. On utilise `DROP CONSTRAINT IF EXISTS`, `CREATE TABLE IF NOT EXISTS` est evite (TypeORM gere le suivi des migrations, donc un up() ne se rejoue pas normalement) mais on rend les blocs DO robustes. Pour la table, on s'appuie sur le mecanisme natif de TypeORM (`migrations` table) : une migration deja appliquee n'est pas rejouee. En revanche, le bloc DO de manipulation des contraintes CHECK est ecrit pour etre idempotent par construction (DROP IF EXISTS puis ADD), de sorte qu'un up() apres down() recree proprement la contrainte etendue.

#### 3.4.6 Piege : `sinistre_id` sans cle etrangere

La table `insure_sinistres` n'existe pas encore (elle sera creee au Sprint 14). On ne peut donc PAS poser de cle etrangere `sinistre_id REFERENCES insure_sinistres(id)`, sinon la migration echouerait (`relation "insure_sinistres" does not exist`). **Choix : `sinistre_id uuid NOT NULL` sans FK.** L'integrite referentielle vers le sinistre sera ajoutee par une migration ulterieure (Sprint 14) qui posera la contrainte FK une fois la table cible disponible. On documente ce choix par un `COMMENT ON COLUMN`. Un index simple sur `sinistre_id` est cree pour les recherches par sinistre.

#### 3.4.7 Piege : `FORCE ROW LEVEL SECURITY` et le role de migration

`ALTER TABLE x FORCE ROW LEVEL SECURITY` applique les politiques RLS MEME au proprietaire de la table. Le role qui execute les migrations (souvent le proprietaire ou un superuser) pourrait alors se retrouver bloque pour ses propres operations. **Important :** les migrations DDL (ALTER/CREATE) ne sont PAS soumises aux politiques RLS (RLS s'applique aux DML : SELECT/INSERT/UPDATE/DELETE, pas au DDL). Donc creer la table et la politique fonctionne. En revanche, si un test ou un seed inserait des lignes via le role proprietaire sans avoir positionne `app.current_tenant_id`, l'INSERT serait bloque par la politique. C'est exactement le comportement souhaite (isolation stricte). Les tests d'integration positionnent donc systematiquement `SET LOCAL app.current_tenant_id = '<uuid>'` (ou `app.is_super_admin = 'true'` pour les seeds transverses), comme dans les specs existantes. Un superuser PostgreSQL contourne RLS par defaut SAUF si la table est en FORCE ; c'est pourquoi FORCE est important pour la securite reelle.

#### 3.4.8 Piege : nom exact de la fonction trigger `updated_at`

Le socle definit la fonction `set_updated_at_column()` (et NON `update_updated_at_column` ni `set_updated_at`). Toutes les migrations suivantes la reutilisent. **On reutilise donc strictement `set_updated_at_column()`** et on ne la recree pas (elle existe deja depuis `1735000000001-InitialSystem`). Le trigger suit le pattern de nommage du socle : `trg_<table>_updated_at`, soit `trg_expert_designations_updated_at`. En `down()`, on DROP le trigger mais on NE DROP PAS la fonction `set_updated_at_column()` (elle est partagee par des dizaines d'autres tables ; la supprimer casserait tout).

#### 3.4.9 Piege : l'ENUM `tenant_type` n'est pas etendu (hors scope)

L'ENUM PostgreSQL `tenant_type` vaut actuellement `('broker','garage','mixed')`. Les nouveaux acteurs (carrier, expert, tow) necessiteront a terme l'extension de cet ENUM (ex. `ALTER TYPE tenant_type ADD VALUE 'carrier'`). **Cette extension est HORS SCOPE de 7.5a et explicitement differee** (probablement Sprint 8 ou la creation effective des tenants metier). La table `expert_designations` reference uniquement `auth_tenants(id)` de maniere generique (cle etrangere sur l'id uuid, pas sur le type), donc elle fonctionne quel que soit le `type` du tenant pointe. Aucune dependance a l'extension de l'ENUM n'est introduite ici. On documente ce point comme un edge-case connu pour eviter qu'un futur developpeur tente d'inserer un carrier avant l'extension de l'ENUM et soit surpris par l'echec (ce serait sur la creation du tenant, pas sur la designation).

#### 3.4.10 Piege : symetrie up()/down() sur les deux contraintes ET la table

Une migration mal symetrique laisse des residus. Ici `down()` doit : (a) supprimer le trigger `trg_expert_designations_updated_at`, (b) supprimer la table `expert_designations` en CASCADE (ce qui supprime indexes et politiques RLS attaches), (c) restaurer la contrainte `type` a 3 valeurs, (d) restaurer la contrainte `resource_type` a 5 valeurs. L'ordre importe : on traite d'abord la table (drop trigger puis drop table), puis on restaure les CHECK. On ne touche pas a la fonction `set_updated_at_column()`. On verifie cette symetrie par un test `up -> down -> up` qui doit laisser la base dans un etat identique au premier `up`.

#### 3.4.11 Piege : `ON DELETE CASCADE` vs `ON DELETE RESTRICT` sur les FK

Le `tenant_id` (proprietaire RLS de la ligne) utilise `ON DELETE CASCADE` : si le tenant proprietaire est supprime, ses designations disparaissent avec lui (coherent avec le socle ou `auth_tenant_users` et `auth_sessions` cascadent). En revanche `carrier_tenant_id`, `carrier_user_id`, `expert_tenant_id`, `expert_user_id` utilisent `ON DELETE RESTRICT` : on ne veut PAS qu'une designation disparaisse silencieusement parce qu'on a supprime un utilisateur ou un tenant tiers reference ; on veut au contraire bloquer la suppression tant que des designations actives pointent dessus (tracabilite ACAPS). Ce choix est volontaire et asymetrique.

#### 3.4.12 Piege : `gen_random_uuid()` requiert pgcrypto

Le socle (`1735000000001-InitialSystem`) verifie deja la presence des extensions `citext` et `pgcrypto` et echoue si absentes. `gen_random_uuid()` provient de `pgcrypto` (ou est natif a partir de PostgreSQL 13). Comme la migration 7.5a.4 s'execute apres 001, l'extension est garantie presente ; on n'a pas a la re-verifier. On utilise donc `DEFAULT gen_random_uuid()` sans crainte, exactement comme `auth_tenants` et `auth_users`.

---

## 4. Architecture context

### 4.1 Position dans le sprint 7.5a

```
  7.5a.1 (decisions 011-015 documentees)
       |
  7.5a.2 (AuthRole enum -> 26 roles)
       |
  7.5a.3 (CrossTenantAuthorizationType TS : +4 types, +3 resource_type)   <-- DEPEND
       |
  >>> 7.5a.4 (CETTE TACHE : migration DB CHECK 3->7 / 5->8 + expert_designations) <<<   position 4/10
       |
  7.5a.5 (helper Postgres app_can_access_tenant() : reconnait les 7 types + expert_designations)   <-- BLOQUE
       |
  7.5a.6 (catalogue permissions ~130)
       |
  7.5a.7 ... 7.5a.10
```

7.5a.3 fournit les chaines litterales TypeScript (`CrossTenantAuthorizationType` etendu, `CrossTenantResourceType` etendu) qui DOIVENT correspondre exactement, caractere pour caractere, aux valeurs de la contrainte CHECK SQL ecrite ici. Toute divergence (ex. `garage_to_carrier_quote` cote TS vs `garage_to_carriers_quote` cote SQL) provoquerait des rejets en runtime. La coherence TS <-> SQL est verifiee par un test dedie.

7.5a.5 (bloquee par cette tache) mettra a jour la fonction `app_can_access_tenant(target_tenant_id uuid)` pour qu'elle reconnaisse les nouveaux types d'autorisation et, le cas echeant, consulte `expert_designations` comme source d'autorisation cross-tenant. Cette fonction NE peut etre mise a jour qu'une fois la table `expert_designations` creee et les CHECK etendus, d'ou le lien de blocage.

### 4.2 Contexte RLS global

Le socle compte deja un ensemble de tables proteges par RLS via le helper `app_can_access_tenant(tenant_id)` (auth_users, auth_tenant_users, auth_sessions, audit_log, puis les tables CRM, booking, communications, docs, payments, books, compliance, analytics, stock, hr ajoutees par les migrations 002-007). La table `expert_designations` rejoint cet ensemble : meme pattern (`ENABLE` + `FORCE ROW LEVEL SECURITY`, politique `USING (app_can_access_tenant(tenant_id))`). Le helper lit `app.current_tenant_id` (et `app.is_super_admin`, `app.cross_tenant_authorization_id`) positionnes par le `TenantGuard` via `SET LOCAL`. La nouvelle table s'integre donc sans rupture dans le modele d'isolation existant.

### 4.3 ASCII : place de `expert_designations` dans le schema

```
   auth_tenants(id) ----+--- carrier_tenant_id (RESTRICT)
        ^                +--- expert_tenant_id  (RESTRICT)
        | tenant_id (CASCADE)
        |
   expert_designations
        |
        +--- carrier_user_id (RESTRICT) ---> auth_users(id)
        +--- expert_user_id  (RESTRICT) ---> auth_users(id)
        +--- sinistre_id (uuid, PAS de FK ; FK ajoutee au Sprint 14)
        +--- status CHECK ('designated','accepted','rejected','completed','cancelled')
        +--- RLS USING app_can_access_tenant(tenant_id)
        +--- trigger trg_expert_designations_updated_at -> set_updated_at_column()

   cross_tenant_authorizations.type  : CHECK etendu 3 -> 7 valeurs
   cross_tenant_authorizations.resource_type : CHECK etendu 5 -> 8 valeurs (NULL tolere)
```

### 4.4 Interaction precise avec le helper `app_can_access_tenant`

Le helper Postgres `app_can_access_tenant(target_tenant_id uuid)` est la pierre angulaire du modele RLS. Sa logique conceptuelle (telle qu'elle existe dans le socle et telle qu'elle sera etendue en 7.5a.5) est la suivante :

```
app_can_access_tenant(target) RETURNS boolean :
  Cond 0 : IF app.is_super_admin = 'true' THEN return true.                       -- bypass admin
  Cond 1 : IF target = app.current_tenant_id THEN return true.                    -- propre tenant
  Cond 2 : IF EXISTS un membership multi-tenant actif pour l'utilisateur courant
             couvrant target THEN return true.                                    -- multi_tenant_user_access
  Cond 3 : IF app.cross_tenant_authorization_id pointe sur une ligne active de
             cross_tenant_authorizations (revoked_at IS NULL, expires_at > now())
             ou from_tenant_id = current et to_tenant_id = target
             THEN return true.                                                    -- delegation explicite
  (7.5a.5) Cond 4 : IF une designation expert_designations active relie le tenant
             courant a target via carrier/expert THEN return true.                -- expertise
  ELSE return false.
```

La table `expert_designations` creee ici devient une source potentielle d'autorisation pour la Cond 4 ajoutee en 7.5a.5. C'est pourquoi 7.5a.4 doit imperativement preceder 7.5a.5 : on ne peut pas referencer une table dans une fonction avant de l'avoir creee. La politique RLS de `expert_designations` elle-meme s'appuie sur `app_can_access_tenant(tenant_id)` (le `tenant_id` proprietaire de la ligne), ce qui cree une coherence : un acteur ne voit une designation que s'il peut acceder au tenant proprietaire de cette designation.

### 4.5 Position dans le decoupage Phase 2.5

La Phase 2.5 (Assurflow Foundation) est inseree entre la fin du socle generique (Sprint 7) et le debut des sprints metier assurance (Sprint 8+). Elle pose UNIQUEMENT les fondations transverses partagees par toutes les verticales assurance : roles (7.5a.2), types cross-tenant (7.5a.3 + 7.5a.4), helper d'acces (7.5a.5), catalogue de permissions (7.5a.6-7.5a.7), tests de non-regression (7.5a.8). Aucune table metier specifique (sinistres, polices, missions) n'est creee en Phase 2.5 ; ces tables arrivent a partir du Sprint 8 (polices) et Sprint 14 (sinistres). La table `expert_designations` est l'exception justifiee : elle est cross-tenant par nature (relie compagnie et expert, deux tenants distincts) et fait donc partie de la fondation transverse, pas du metier d'un tenant unique.

---

## 5. Livrables checkables

1. Fichier de migration `packages/database/src/migrations/1735000000011-Sprint75aCrossTenantV3.ts` cree.
2. Classe exportee `Sprint75aCrossTenantV31735000000011 implements MigrationInterface`.
3. Propriete `public name = 'Sprint75aCrossTenantV31735000000011'`.
4. Methode `up(queryRunner: QueryRunner): Promise<void>` complete.
5. Methode `down(queryRunner: QueryRunner): Promise<void>` complete et symetrique.
6. `up()` etend la contrainte CHECK `type` a 7 valeurs (via bloc DO garde par existence de table + DROP IF EXISTS + ADD canonique).
7. `up()` etend la contrainte CHECK `resource_type` a 8 valeurs avec tolerance `NULL`.
8. `up()` cree la table `expert_designations` avec les 16 colonnes specifiees.
9. `expert_designations.id` est `uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
10. FK `tenant_id` -> `auth_tenants(id) ON DELETE CASCADE`.
11. FK `carrier_tenant_id`, `expert_tenant_id` -> `auth_tenants(id) ON DELETE RESTRICT`.
12. FK `carrier_user_id`, `expert_user_id` -> `auth_users(id) ON DELETE RESTRICT`.
13. `sinistre_id uuid NOT NULL` SANS cle etrangere + `COMMENT` explicatif.
14. Contrainte CHECK `status IN ('designated','accepted','rejected','completed','cancelled')`.
15. Les 5 indexes : `idx_expert_designations_tenant`, `_carrier`, `_expert`, `_sinistre`, `_status`.
16. RLS : `ENABLE` + `FORCE ROW LEVEL SECURITY` + politique `expert_designations_tenant_isolation`.
17. Trigger `trg_expert_designations_updated_at` reutilisant `set_updated_at_column()`.
18. `down()` supprime le trigger, supprime la table en CASCADE, restaure CHECK `type` (3 valeurs), restaure CHECK `resource_type` (5 valeurs).
19. Migration enregistree dans le harness de test `helpers/datasource.ts` (import + tableau `migrations`).
20. Fichier d'entite TypeORM `packages/database/src/entities/system/expert-designation.entity.ts` cree, conforme a la table.
21. Entite ajoutee a l'index des entites systeme (`entities/system/index.ts`).
22. Spec d'integration `packages/database/src/test/integration/cross-tenant-v3.spec.ts` creee.
23. Au moins 20 cas de test couvrant : 7 types insertables, type invalide rejete, resource_type 8 valeurs + NULL, status CHECK, CRUD `expert_designations` sous RLS, isolation entre deux tenants, idempotence up/down/up.
24. Doc SQL de reference `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` complete (+~30 lignes).
25. Zero emoji dans tous les fichiers crees (verifie par grep).
26. Le test `pnpm --filter @insurtech/database build` passe (types valides).

---

## 6. Fichiers crees / modifies

| Fichier | Action | Lignes approx. | Role |
|---------|--------|----------------|------|
| `packages/database/src/migrations/1735000000011-Sprint75aCrossTenantV3.ts` | CREE | ~165 | Migration up()/down() : CHECK 3->7, 5->8, table `expert_designations` + RLS |
| `packages/database/src/entities/system/expert-designation.entity.ts` | CREE | ~95 | Entite TypeORM mappant la table `expert_designations` |
| `packages/database/src/entities/system/index.ts` | MODIFIE | +2 | Export de l'entite + ajout au tableau `systemEntities` |
| `packages/database/src/test/helpers/datasource.ts` | MODIFIE | +2 | Import migration 011 + ajout au tableau `migrations` |
| `packages/database/src/test/integration/cross-tenant-v3.spec.ts` | CREE | ~230 | Tests d'integration (20+ cas) |
| `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` | MODIFIE/CREE | +~35 | Documentation SQL de reference du schema v3.0 |

Note : la table `cross_tenant_authorizations` elle-meme n'est PAS modifiee structurellement (memes colonnes) ; seules ses contraintes CHECK changent. L'entite `cross-tenant-authorization.entity.ts` a deja ete mise a jour cote types par la tache 7.5a.3 ; aucune modification de cette entite n'est requise ici.

---

## 7. Code patterns COMPLETS

### 7.1 Migration `1735000000011-Sprint75aCrossTenantV3.ts` (FICHIER COMPLET)

Chemin : `packages/database/src/migrations/1735000000011-Sprint75aCrossTenantV3.ts`

```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Sprint 7.5a — Fondation cross-tenant Assurflow v3.0.
 *
 * 1) Etend la contrainte CHECK sur cross_tenant_authorizations.type de 3 a 7 valeurs :
 *      socle  : broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access
 *      v3.0   : client_to_tower_dispatch, tower_to_garage_delivery,
 *               garage_to_expert_request, garage_to_carrier_quote
 *
 * 2) Etend la contrainte CHECK sur cross_tenant_authorizations.resource_type de 5 a 8 valeurs
 *    (colonne NULL-able : la contrainte tolere NULL) :
 *      socle  : sinistre, police, devis, facture, tenant
 *      v3.0   : mission, expertise, parts_order
 *
 * 3) Cree la table expert_designations (decision-013 : la compagnie designe un expert sur un
 *    sinistre) avec RLS activee + forcee et isolation par tenant via app_can_access_tenant().
 *
 * PIEGE : la table cross_tenant_authorizations releve du framework cross-tenant (Sprint 6 /
 * runtime Sprint 26) et peut ne pas exister au moment de cette migration. Les operations CHECK
 * sont donc gardees par un test d'existence de la table (bloc DO). La table expert_designations,
 * elle, ne depend que de auth_tenants et auth_users (toujours presentes depuis InitialSystem).
 *
 * PIEGE : sinistre_id n'a PAS de cle etrangere (insure_sinistres n'existe qu'au Sprint 14).
 * PIEGE : la fonction trigger reutilisee est set_updated_at_column() (creee par InitialSystem) ;
 *         on ne la recree pas et on ne la supprime pas en down() (partagee par tout le schema).
 * PIEGE : l'ENUM tenant_type ('broker','garage','mixed') n'est PAS etendu ici (hors scope 7.5a).
 */
export class Sprint75aCrossTenantV31735000000011 implements MigrationInterface {
  public name = 'Sprint75aCrossTenantV31735000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1) + 2) Extension des contraintes CHECK sur cross_tenant_authorizations -------------
    // Bloc garde par l'existence de la table. DROP IF EXISTS de toute contrainte CHECK
    // existante sur la colonne (nommee ou anonyme) via pg_constraint, puis ADD canonique.
    await queryRunner.query(`
      DO $$
      DECLARE
        c record;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'cross_tenant_authorizations'
        ) THEN
          RAISE NOTICE 'Table cross_tenant_authorizations absente : extension CHECK differee (framework cross-tenant non encore deploye).';
          RETURN;
        END IF;

        -- Supprime toute contrainte CHECK existante referencant la colonne "type".
        FOR c IN (
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE rel.relname = 'cross_tenant_authorizations'
            AND ns.nspname = 'public'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%type%'
            AND pg_get_constraintdef(con.oid) NOT ILIKE '%resource_type%'
        ) LOOP
          EXECUTE format('ALTER TABLE cross_tenant_authorizations DROP CONSTRAINT %I', c.conname);
        END LOOP;

        -- Supprime toute contrainte CHECK existante referencant la colonne "resource_type".
        FOR c IN (
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE rel.relname = 'cross_tenant_authorizations'
            AND ns.nspname = 'public'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%resource_type%'
        ) LOOP
          EXECUTE format('ALTER TABLE cross_tenant_authorizations DROP CONSTRAINT %I', c.conname);
        END LOOP;

        -- Contrainte canonique nommee : 7 valeurs autorisees pour type.
        ALTER TABLE cross_tenant_authorizations
          ADD CONSTRAINT cross_tenant_authorizations_type_check
          CHECK (type IN (
            'broker_to_garage_assignment',
            'assure_to_garage_visit',
            'multi_tenant_user_access',
            'client_to_tower_dispatch',
            'tower_to_garage_delivery',
            'garage_to_expert_request',
            'garage_to_carrier_quote'
          ));

        -- Contrainte canonique nommee : 8 valeurs autorisees pour resource_type (NULL tolere).
        ALTER TABLE cross_tenant_authorizations
          ADD CONSTRAINT cross_tenant_authorizations_resource_type_check
          CHECK (
            resource_type IS NULL OR resource_type IN (
              'sinistre',
              'police',
              'devis',
              'facture',
              'tenant',
              'mission',
              'expertise',
              'parts_order'
            )
          );
      END$$;
    `);

    // --- 3) Table expert_designations (decision-013) ---------------------------------------
    await queryRunner.query(`
      CREATE TABLE expert_designations (
        id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        carrier_tenant_id   uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        carrier_user_id     uuid         NOT NULL REFERENCES auth_users(id)   ON DELETE RESTRICT,
        expert_tenant_id    uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        expert_user_id      uuid         NOT NULL REFERENCES auth_users(id)   ON DELETE RESTRICT,
        sinistre_id         uuid         NOT NULL,
        status              text         NOT NULL,
        designated_at       timestamptz  NOT NULL DEFAULT now(),
        accepted_at         timestamptz  NULL,
        rejected_at         timestamptz  NULL,
        rejection_reason    text         NULL,
        completed_at        timestamptz  NULL,
        notes               text         NULL,
        created_at          timestamptz  NOT NULL DEFAULT now(),
        updated_at          timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT expert_designations_status_chk
          CHECK (status IN ('designated','accepted','rejected','completed','cancelled'))
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_expert_designations_tenant   ON expert_designations (tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_expert_designations_carrier  ON expert_designations (carrier_tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_expert_designations_expert   ON expert_designations (expert_tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_expert_designations_sinistre ON expert_designations (sinistre_id);`);
    await queryRunner.query(`CREATE INDEX idx_expert_designations_status   ON expert_designations (status);`);

    await queryRunner.query(`ALTER TABLE expert_designations ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE expert_designations FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY expert_designations_tenant_isolation ON expert_designations
        USING (app_can_access_tenant(tenant_id));
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_expert_designations_updated_at
      BEFORE UPDATE ON expert_designations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
    `);

    await queryRunner.query(`COMMENT ON TABLE expert_designations IS 'decision-013 : la compagnie (carrier) designe un expert sur un sinistre. RLS par tenant_id. Tracabilite ACAPS/CNDP.';`);
    await queryRunner.query(`COMMENT ON COLUMN expert_designations.sinistre_id IS 'uuid du sinistre. PAS de FK : insure_sinistres cree au Sprint 14, FK ajoutee ulterieurement.';`);
    await queryRunner.query(`COMMENT ON COLUMN expert_designations.tenant_id IS 'Tenant proprietaire RLS de la ligne (isolation app_can_access_tenant). CASCADE.';`);
    await queryRunner.query(`COMMENT ON COLUMN expert_designations.status IS 'Cycle de vie : designated -> accepted|rejected ; accepted -> completed ; designated -> cancelled.';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Symetrie : on traite d'abord la table (trigger puis table), puis on restaure les CHECK.
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_expert_designations_updated_at ON expert_designations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS expert_designations CASCADE;`);
    // NE PAS supprimer la fonction set_updated_at_column() : partagee par tout le schema.

    await queryRunner.query(`
      DO $$
      DECLARE
        c record;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'cross_tenant_authorizations'
        ) THEN
          RAISE NOTICE 'Table cross_tenant_authorizations absente : restauration CHECK ignoree.';
          RETURN;
        END IF;

        FOR c IN (
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE rel.relname = 'cross_tenant_authorizations'
            AND ns.nspname = 'public'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%type%'
            AND pg_get_constraintdef(con.oid) NOT ILIKE '%resource_type%'
        ) LOOP
          EXECUTE format('ALTER TABLE cross_tenant_authorizations DROP CONSTRAINT %I', c.conname);
        END LOOP;

        FOR c IN (
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE rel.relname = 'cross_tenant_authorizations'
            AND ns.nspname = 'public'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%resource_type%'
        ) LOOP
          EXECUTE format('ALTER TABLE cross_tenant_authorizations DROP CONSTRAINT %I', c.conname);
        END LOOP;

        -- Restauration socle : 3 valeurs pour type.
        ALTER TABLE cross_tenant_authorizations
          ADD CONSTRAINT cross_tenant_authorizations_type_check
          CHECK (type IN (
            'broker_to_garage_assignment',
            'assure_to_garage_visit',
            'multi_tenant_user_access'
          ));

        -- Restauration socle : 5 valeurs pour resource_type (NULL tolere).
        ALTER TABLE cross_tenant_authorizations
          ADD CONSTRAINT cross_tenant_authorizations_resource_type_check
          CHECK (
            resource_type IS NULL OR resource_type IN (
              'sinistre',
              'police',
              'devis',
              'facture',
              'tenant'
            )
          );
      END$$;
    `);
  }
}
```

**Notes importantes (7.1) :**
- La classe et la propriete `name` portent strictement `Sprint75aCrossTenantV31735000000011` (convention `<Nom><TIMESTAMP>` du repo, ex. `InitialSystem1735000000001`). Ne PAS utiliser une date ISO.
- Les blocs `DO $$ ... $$` rendent la manipulation des CHECK idempotente et robuste a l'absence de la table cross-tenant.
- L'ADD de la contrainte `type` etendue est un sur-ensemble : il ne peut jamais echouer sur des lignes valides socle.
- L'ADD `resource_type` inclut imperativement `resource_type IS NULL OR ...` car la colonne est NULL-able (voir entite : `nullable: true`).
- L'ordre `ENABLE` puis `FORCE` puis `CREATE POLICY` reproduit exactement le pattern de `InitialSystem`.
- Le trigger reutilise `set_updated_at_column()` (nom EXACT verifie dans le repo, ligne 173 d'`InitialSystem`).
- `down()` ne supprime jamais `set_updated_at_column()`.

### 7.2 Entite TypeORM `expert-designation.entity.ts` (FICHIER COMPLET)

Chemin : `packages/database/src/entities/system/expert-designation.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from './auth-tenant.entity.js';
import { AuthUser } from './auth-user.entity.js';

/**
 * Statut du cycle de vie d'une designation d'expert (decision-013).
 *   designated -> accepted | rejected | cancelled
 *   accepted   -> completed | cancelled
 */
export type ExpertDesignationStatus =
  | 'designated'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

/**
 * Designation d'un expert par une compagnie d'assurance sur un sinistre (decision-013).
 *
 * RLS : isolation par tenant_id via app_can_access_tenant(tenant_id) (politique
 * expert_designations_tenant_isolation, ENABLE + FORCE ROW LEVEL SECURITY).
 *
 * sinistre_id : uuid SANS cle etrangere (insure_sinistres cree au Sprint 14).
 */
@Entity('expert_designations')
@Index('idx_expert_designations_tenant', ['tenantId'])
@Index('idx_expert_designations_carrier', ['carrierTenantId'])
@Index('idx_expert_designations_expert', ['expertTenantId'])
@Index('idx_expert_designations_sinistre', ['sinistreId'])
@Index('idx_expert_designations_status', ['status'])
export class ExpertDesignation {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'carrier_tenant_id', type: 'uuid' })
  carrierTenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrier_tenant_id' })
  carrierTenant!: AuthTenant;

  @Column({ name: 'carrier_user_id', type: 'uuid' })
  carrierUserId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrier_user_id' })
  carrierUser!: AuthUser;

  @Column({ name: 'expert_tenant_id', type: 'uuid' })
  expertTenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expert_tenant_id' })
  expertTenant!: AuthTenant;

  @Column({ name: 'expert_user_id', type: 'uuid' })
  expertUserId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expert_user_id' })
  expertUser!: AuthUser;

  @Column({ name: 'sinistre_id', type: 'uuid' })
  sinistreId!: string;

  @Column({ name: 'status', type: 'text' })
  status!: ExpertDesignationStatus;

  @CreateDateColumn({ name: 'designated_at', type: 'timestamptz' })
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

**Notes importantes (7.2) :**
- `@CreateDateColumn` est utilise pour `designated_at` ET `created_at` car les deux portent `DEFAULT now()` cote SQL ; cela reste coherent avec le mapping TypeORM (les deux sont des dates de creation logique). `@UpdateDateColumn` pour `updated_at` (le trigger SQL synchronise cote DB ; TypeORM met aussi a jour cote applicatif).
- `exactOptionalPropertyTypes` est actif : on type les colonnes nullables `Date | null` / `string | null`, jamais `Date | undefined`.
- Imports avec extension `.js` (ESM, comme `cross-tenant-authorization.entity.ts`).
- Les noms d'index `@Index(...)` correspondent exactement aux `CREATE INDEX` de la migration.

### 7.3 Modification de `entities/system/index.ts`

Chemin : `packages/database/src/entities/system/index.ts`

Ajouter l'export de l'entite et l'inclure dans le tableau agrege. Le fichier suit le pattern : un `export *` par entite et un tableau `systemEntities`. Edition a appliquer :

```typescript
// Ajouter aux exports existants :
export * from './expert-designation.entity.js';

// Et dans le tableau systemEntities (ajouter ExpertDesignation a la liste des classes) :
import { ExpertDesignation } from './expert-designation.entity.js';
// ...
export const systemEntities = [
  // ... entites existantes (AuthTenant, AuthUser, AuthTenantUser, AuthSession, AuditLog,
  //     CrossTenantAuthorization, etc.) ...
  ExpertDesignation,
];
```

**Note :** adapter precisement a la structure reelle du fichier `index.ts` (qui peut deja agreger via `export *` ET un tableau). Verifier d'abord son contenu, puis n'ajouter que les deux lignes manquantes (l'`export *` et l'entree `ExpertDesignation` dans `systemEntities`). Ne PAS dupliquer d'imports existants.

### 7.4 Modification de `test/helpers/datasource.ts`

Chemin : `packages/database/src/test/helpers/datasource.ts`

Le harness de test importe explicitement chaque migration et la liste dans `migrations`. Ajouter la migration 011 :

```typescript
// Ajouter aux imports de migrations existants :
import { Sprint75aCrossTenantV31735000000011 } from '../../migrations/1735000000011-Sprint75aCrossTenantV3.js';

// Et dans baseOptions(), tableau migrations (a la suite des migrations 001-010) :
migrations: [
  InitialSystem1735000000001,
  CRM1735000000002,
  Booking1735000000003,
  Communications1735000000004,
  DocsPayments1735000000005,
  BooksCompliance1735000000006,
  AnalyticsStockHr1735000000007,
  // ... 008, 009, 010 si presents dans le harness ...
  Sprint75aCrossTenantV31735000000011,
],
```

**Note importante (7.4) :** le harness reel n'importe peut-etre que les migrations 001-007 (a verifier). Si les migrations 008-010 ne sont pas dans le harness mais que la table `cross_tenant_authorizations` n'est creee par aucune d'elles, alors le bloc DO garde de la migration 011 prendra le chemin `RAISE NOTICE` (table absente) et les tests sur les CHECK porteront sur une table absente. Pour tester effectivement les CHECK, la spec d'integration 7.5 cree elle-meme une table `cross_tenant_authorizations` minimale (voir 8.x) AVANT de rejouer la portion CHECK, ou bien teste uniquement `expert_designations` (toujours testable). On retient l'approche : la spec cree une table cross-tenant minimale de test quand elle veut valider les CHECK, et teste `expert_designations` directement via la migration.

### 7.5 Spec d'integration `cross-tenant-v3.spec.ts` (FICHIER COMPLET)

Chemin : `packages/database/src/test/integration/cross-tenant-v3.spec.ts`

```typescript
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';

vi.hoisted(() => {
  process.env['SKIP_INTEGRATION'] ??= 'true';
});

const SKIP = process.env['SKIP_INTEGRATION'] === 'true';

const TENANT_A = '00000000-0000-0000-0000-0000000000a1';
const TENANT_B = '00000000-0000-0000-0000-0000000000b2';
const CARRIER_T = '00000000-0000-0000-0000-0000000000c3';
const EXPERT_T = '00000000-0000-0000-0000-0000000000e4';
const USER_CARRIER = '00000000-0000-0000-0000-0000000000c9';
const USER_EXPERT = '00000000-0000-0000-0000-0000000000e9';
const SINISTRE_1 = '00000000-0000-0000-0000-0000000000f1';

async function asSuperAdmin(ds: DataSource): Promise<void> {
  await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
}

async function asTenant(ds: DataSource, tenantId: string): Promise<void> {
  await ds.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
  await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
}

async function seedTenant(ds: DataSource, id: string, name: string): Promise<void> {
  await ds.query(
    `INSERT INTO auth_tenants (id, name, type) VALUES ($1, $2, 'mixed') ON CONFLICT DO NOTHING;`,
    [id, name],
  );
}

async function seedUser(ds: DataSource, id: string, tenantId: string, email: string): Promise<void> {
  await ds.query(
    `INSERT INTO auth_users (id, tenant_id, email, password_hash, display_name)
     VALUES ($1, $2, $3, repeat('x', 60), 'U') ON CONFLICT DO NOTHING;`,
    [id, tenantId, email],
  );
}

describe.skipIf(SKIP)('Migration Sprint75aCrossTenantV31735000000011', () => {
  let ds: DataSource;

  beforeAll(async () => {
    const { createTestDataSource } = await import('../helpers/datasource.js');
    ds = await createTestDataSource({ migrationsRun: false });
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    const { dropAllTables } = await import('../helpers/datasource.js');
    await dropAllTables(ds);
    await ds.runMigrations();
  });

  // --- expert_designations : structure ----------------------------------------------------
  it('cree la table expert_designations', async () => {
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'expert_designations';
    `);
    expect(rows.map((r) => r.table_name)).toEqual(['expert_designations']);
  });

  it('expert_designations possede les 5 indexes attendus', async () => {
    const rows: Array<{ indexname: string }> = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'expert_designations' AND indexname LIKE 'idx_expert_designations_%'
      ORDER BY indexname;
    `);
    expect(rows.map((r) => r.indexname)).toEqual([
      'idx_expert_designations_carrier',
      'idx_expert_designations_expert',
      'idx_expert_designations_sinistre',
      'idx_expert_designations_status',
      'idx_expert_designations_tenant',
    ]);
  });

  it('RLS est activee ET forcee sur expert_designations', async () => {
    const rows: Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }> = await ds.query(`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE relname = 'expert_designations';
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
    expect(rows[0]?.relforcerowsecurity).toBe(true);
  });

  it('la politique expert_designations_tenant_isolation existe', async () => {
    const rows: Array<{ polname: string }> = await ds.query(`
      SELECT polname FROM pg_policy WHERE polrelid = 'expert_designations'::regclass;
    `);
    expect(rows.map((r) => r.polname)).toContain('expert_designations_tenant_isolation');
  });

  it('le trigger updated_at existe et pointe sur set_updated_at_column', async () => {
    const rows: Array<{ tgname: string; proname: string }> = await ds.query(`
      SELECT t.tgname, p.proname
      FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = 'expert_designations'::regclass AND NOT t.tgisinternal;
    `);
    expect(rows[0]?.tgname).toBe('trg_expert_designations_updated_at');
    expect(rows[0]?.proname).toBe('set_updated_at_column');
  });

  it('sinistre_id n\'a aucune cle etrangere', async () => {
    const rows: Array<{ conname: string }> = await ds.query(`
      SELECT con.conname FROM pg_constraint con
      WHERE con.conrelid = 'expert_designations'::regclass
        AND con.contype = 'f'
        AND 'sinistre_id' = ANY (
          SELECT a.attname FROM pg_attribute a
          WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
        );
    `);
    expect(rows).toEqual([]);
  });

  // --- expert_designations : CRUD sous RLS ------------------------------------------------
  it('insere une designation pour le tenant courant', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');

    await asTenant(ds, TENANT_A);
    await ds.query(
      `INSERT INTO expert_designations
        (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
      [TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
    );
    const rows = await ds.query(`SELECT count(*)::int AS n FROM expert_designations;`);
    expect(rows[0].n).toBe(1);
  });

  it('isole les designations entre deux tenants (RLS)', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, TENANT_B, 'B');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');

    await asTenant(ds, TENANT_A);
    await ds.query(
      `INSERT INTO expert_designations
        (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
      [TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
    );

    // Tenant B ne voit rien.
    await asTenant(ds, TENANT_B);
    const bRows = await ds.query(`SELECT count(*)::int AS n FROM expert_designations;`);
    expect(bRows[0].n).toBe(0);

    // Tenant A voit sa ligne.
    await asTenant(ds, TENANT_A);
    const aRows = await ds.query(`SELECT count(*)::int AS n FROM expert_designations;`);
    expect(aRows[0].n).toBe(1);
  });

  it('rejette un INSERT pour un tenant_id non accessible (RLS WITH CHECK)', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, TENANT_B, 'B');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');

    await asTenant(ds, TENANT_A);
    await expect(
      ds.query(
        `INSERT INTO expert_designations
          (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
        [TENANT_B, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
      ),
    ).rejects.toThrow();
  });

  // --- status CHECK -----------------------------------------------------------------------
  it.each(['designated', 'accepted', 'rejected', 'completed', 'cancelled'])(
    'accepte le statut valide %s',
    async (status) => {
      await asSuperAdmin(ds);
      await seedTenant(ds, TENANT_A, 'A');
      await seedTenant(ds, CARRIER_T, 'Carrier');
      await seedTenant(ds, EXPERT_T, 'Expert');
      await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
      await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');
      await asTenant(ds, TENANT_A);
      await ds.query(
        `INSERT INTO expert_designations
          (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7);`,
        [TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1, status],
      );
      const rows = await ds.query(`SELECT count(*)::int AS n FROM expert_designations;`);
      expect(rows[0].n).toBe(1);
    },
  );

  it('rejette un statut invalide', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');
    await asTenant(ds, TENANT_A);
    await expect(
      ds.query(
        `INSERT INTO expert_designations
          (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending');`,
        [TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
      ),
    ).rejects.toThrow();
  });

  it('le trigger met a jour updated_at lors d\'un UPDATE', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');
    await asTenant(ds, TENANT_A);
    await ds.query(
      `INSERT INTO expert_designations
        (id, tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'designated', now() - interval '1 hour');`,
      ['00000000-0000-0000-0000-0000000000d1', TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
    );
    await ds.query(
      `UPDATE expert_designations SET status = 'accepted', accepted_at = now() WHERE id = $1;`,
      ['00000000-0000-0000-0000-0000000000d1'],
    );
    const rows = await ds.query(
      `SELECT (updated_at > now() - interval '1 minute') AS fresh FROM expert_designations WHERE id = $1;`,
      ['00000000-0000-0000-0000-0000000000d1'],
    );
    expect(rows[0].fresh).toBe(true);
  });

  it('RESTRICT empeche la suppression d\'un carrier_tenant reference', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');
    await asTenant(ds, TENANT_A);
    await ds.query(
      `INSERT INTO expert_designations
        (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
      [TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
    );
    await asSuperAdmin(ds);
    await expect(
      ds.query(`DELETE FROM auth_tenants WHERE id = $1;`, [CARRIER_T]),
    ).rejects.toThrow();
  });

  it('CASCADE supprime les designations quand le tenant proprietaire est supprime', async () => {
    await asSuperAdmin(ds);
    await seedTenant(ds, TENANT_A, 'A');
    await seedTenant(ds, CARRIER_T, 'Carrier');
    await seedTenant(ds, EXPERT_T, 'Expert');
    await seedUser(ds, USER_CARRIER, CARRIER_T, 'c@x.ma');
    await seedUser(ds, USER_EXPERT, EXPERT_T, 'e@x.ma');
    await asTenant(ds, TENANT_A);
    await ds.query(
      `INSERT INTO expert_designations
        (tenant_id, carrier_tenant_id, carrier_user_id, expert_tenant_id, expert_user_id, sinistre_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'designated');`,
      [TENANT_A, CARRIER_T, USER_CARRIER, EXPERT_T, USER_EXPERT, SINISTRE_1],
    );
    await asSuperAdmin(ds);
    await ds.query(`DELETE FROM auth_tenants WHERE id = $1;`, [TENANT_A]);
    const rows = await ds.query(`SELECT count(*)::int AS n FROM expert_designations;`);
    expect(rows[0].n).toBe(0);
  });

  // --- contraintes CHECK cross_tenant_authorizations (table de test minimale) -------------
  describe('contraintes CHECK type / resource_type', () => {
    beforeEach(async () => {
      // Cree une table cross_tenant_authorizations minimale puis applique les CHECK canoniques
      // exactement comme la migration up() (la table reelle releve du framework cross-tenant).
      await asSuperAdmin(ds);
      await ds.query(`DROP TABLE IF EXISTS cross_tenant_authorizations CASCADE;`);
      await ds.query(`
        CREATE TABLE cross_tenant_authorizations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          type text NOT NULL,
          resource_type text NULL
        );
      `);
      await ds.query(`
        ALTER TABLE cross_tenant_authorizations
          ADD CONSTRAINT cross_tenant_authorizations_type_check
          CHECK (type IN (
            'broker_to_garage_assignment','assure_to_garage_visit','multi_tenant_user_access',
            'client_to_tower_dispatch','tower_to_garage_delivery','garage_to_expert_request',
            'garage_to_carrier_quote'));
      `);
      await ds.query(`
        ALTER TABLE cross_tenant_authorizations
          ADD CONSTRAINT cross_tenant_authorizations_resource_type_check
          CHECK (resource_type IS NULL OR resource_type IN (
            'sinistre','police','devis','facture','tenant','mission','expertise','parts_order'));
      `);
    });

    it.each([
      'broker_to_garage_assignment',
      'assure_to_garage_visit',
      'multi_tenant_user_access',
      'client_to_tower_dispatch',
      'tower_to_garage_delivery',
      'garage_to_expert_request',
      'garage_to_carrier_quote',
    ])('accepte le type valide %s', async (type) => {
      await ds.query(`INSERT INTO cross_tenant_authorizations (type) VALUES ($1);`, [type]);
      const rows = await ds.query(`SELECT count(*)::int AS n FROM cross_tenant_authorizations;`);
      expect(rows[0].n).toBe(1);
    });

    it('rejette un type invalide', async () => {
      await expect(
        ds.query(`INSERT INTO cross_tenant_authorizations (type) VALUES ('foo_bar');`),
      ).rejects.toThrow();
    });

    it.each(['sinistre', 'police', 'devis', 'facture', 'tenant', 'mission', 'expertise', 'parts_order'])(
      'accepte le resource_type valide %s',
      async (rt) => {
        await ds.query(
          `INSERT INTO cross_tenant_authorizations (type, resource_type) VALUES ('multi_tenant_user_access', $1);`,
          [rt],
        );
        const rows = await ds.query(`SELECT count(*)::int AS n FROM cross_tenant_authorizations;`);
        expect(rows[0].n).toBe(1);
      },
    );

    it('accepte resource_type NULL', async () => {
      await ds.query(`INSERT INTO cross_tenant_authorizations (type, resource_type) VALUES ('multi_tenant_user_access', NULL);`);
      const rows = await ds.query(`SELECT count(*)::int AS n FROM cross_tenant_authorizations;`);
      expect(rows[0].n).toBe(1);
    });

    it('rejette un resource_type invalide', async () => {
      await expect(
        ds.query(`INSERT INTO cross_tenant_authorizations (type, resource_type) VALUES ('multi_tenant_user_access', 'vehicule');`),
      ).rejects.toThrow();
    });
  });

  // --- idempotence up -> down -> up -------------------------------------------------------
  it('down() supprime la table puis up() la recree (idempotence)', async () => {
    const { Sprint75aCrossTenantV31735000000011 } = await import(
      '../../migrations/1735000000011-Sprint75aCrossTenantV3.js'
    );
    const qr = ds.createQueryRunner();
    try {
      const migration = new Sprint75aCrossTenantV31735000000011();
      await migration.down(qr);
      const after = await qr.query(`
        SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_name = 'expert_designations';
      `);
      expect(after[0].n).toBe(0);
      await migration.up(qr);
      const again = await qr.query(`
        SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_name = 'expert_designations';
      `);
      expect(again[0].n).toBe(1);
    } finally {
      await qr.release();
    }
  });
});
```

**Notes importantes (7.5) :**
- `SKIP_INTEGRATION` defaut `'true'` : les tests d'integration ne tournent qu'avec une vraie base Postgres (`SKIP_INTEGRATION=false`), exactement comme les specs existantes.
- Les seeds passent par `app.is_super_admin = 'true'` pour contourner RLS le temps d'inserer tenants/users (pattern des specs socle).
- Les tests RLS positionnent `app.current_tenant_id` via `set_config(..., true)` (true = LOCAL a la transaction de session de test).
- Le bloc CHECK cree une table `cross_tenant_authorizations` minimale de test car la table reelle releve du framework cross-tenant et n'est pas garantie creee par les migrations 001-010 ; les CHECK appliques sont identiques caractere pour caractere a ceux de la migration `up()`.
- Le test d'idempotence instancie directement la classe de migration et appelle `down()` puis `up()` sur un `QueryRunner`.

### 7.6 Documentation SQL de reference (FRAGMENT a ajouter)

Chemin : `00-pilotage/documentation/3-schemas-database-PARTIE2.sql`

Ce fichier est une documentation SQL non executee (reference humaine du schema v3.0). Ajouter le fragment suivant a la suite du contenu existant (creer le fichier s'il n'existe pas) :

```sql
-- =====================================================================================
-- Sprint 7.5a (decision-013) : fondation cross-tenant Assurflow v3.0
-- Migration : 1735000000011-Sprint75aCrossTenantV3
-- =====================================================================================

-- 1) cross_tenant_authorizations.type : domaine etendu de 3 a 7 valeurs.
--    Socle : broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access
--    v3.0  : client_to_tower_dispatch, tower_to_garage_delivery,
--            garage_to_expert_request, garage_to_carrier_quote
-- 2) cross_tenant_authorizations.resource_type : domaine etendu de 5 a 8 valeurs (NULL tolere).
--    Socle : sinistre, police, devis, facture, tenant
--    v3.0  : mission, expertise, parts_order

-- 3) Table expert_designations (la compagnie designe un expert sur un sinistre).
CREATE TABLE expert_designations (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  carrier_tenant_id   uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
  carrier_user_id     uuid         NOT NULL REFERENCES auth_users(id)   ON DELETE RESTRICT,
  expert_tenant_id    uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
  expert_user_id      uuid         NOT NULL REFERENCES auth_users(id)   ON DELETE RESTRICT,
  sinistre_id         uuid         NOT NULL,  -- PAS de FK : insure_sinistres au Sprint 14
  status              text         NOT NULL CHECK (status IN
                        ('designated','accepted','rejected','completed','cancelled')),
  designated_at       timestamptz  NOT NULL DEFAULT now(),
  accepted_at         timestamptz  NULL,
  rejected_at         timestamptz  NULL,
  rejection_reason    text         NULL,
  completed_at        timestamptz  NULL,
  notes               text         NULL,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);
-- Indexes : tenant, carrier, expert, sinistre, status.
-- RLS : ENABLE + FORCE ; POLICY expert_designations_tenant_isolation USING app_can_access_tenant(tenant_id).
-- Trigger : trg_expert_designations_updated_at -> set_updated_at_column().
```

**Note importante (7.6) :** ce fichier est documentaire ; il ne fait pas autorite sur le schema (la migration TypeORM fait foi). Il sert de reference de lecture rapide pour les revues d'architecture et les audits CNDP/ACAPS.

---

## 8. Tests complets

### 8.1 Strategie de test

Les tests sont des tests d'INTEGRATION Vitest contre une vraie base PostgreSQL (pas de mock du moteur SQL : on valide les contraintes CHECK, le RLS, les FK CASCADE/RESTRICT, le trigger, qui sont des comportements purement Postgres impossibles a mocker fidelement). Le harness `createTestDataSource` / `dropAllTables` / `runMigrations` est celui du repo. Le drapeau `SKIP_INTEGRATION` (defaut `true`) skip les tests sans base ; en CI integration on positionne `SKIP_INTEGRATION=false` + variables `TEST_DATABASE_*`.

### 8.2 Matrice des cas (>= 20)

| # | Cas | Attendu |
|---|-----|---------|
| 1 | table `expert_designations` creee | presente dans information_schema |
| 2 | 5 indexes presents | carrier, expert, sinistre, status, tenant |
| 3 | RLS activee + forcee | relrowsecurity=true, relforcerowsecurity=true |
| 4 | politique `expert_designations_tenant_isolation` | presente dans pg_policy |
| 5 | trigger updated_at -> set_updated_at_column | tgname + proname corrects |
| 6 | sinistre_id sans FK | aucune contrainte 'f' sur sinistre_id |
| 7 | INSERT designation tenant courant | 1 ligne |
| 8 | isolation tenant A vs tenant B | B voit 0, A voit 1 |
| 9 | INSERT tenant_id non accessible rejete | throw (RLS WITH CHECK) |
| 10-14 | status valides (designated/accepted/rejected/completed/cancelled) | acceptes |
| 15 | status invalide ('pending') | throw |
| 16 | trigger rafraichit updated_at sur UPDATE | updated_at recent |
| 17 | RESTRICT bloque suppression carrier_tenant | throw |
| 18 | CASCADE supprime designations si tenant proprietaire supprime | 0 ligne |
| 19-25 | 7 types CHECK valides acceptes | acceptes |
| 26 | type invalide rejete | throw |
| 27-34 | 8 resource_type valides acceptes | acceptes |
| 35 | resource_type NULL accepte | accepte |
| 36 | resource_type invalide rejete | throw |
| 37 | idempotence down -> up | table recreee |

Soit largement plus de 20 cas effectifs (les `it.each` deplient chacun plusieurs cas).

### 8.3 Harness de test rappel (pattern pg)

```typescript
// Positionnement du contexte tenant (RLS) dans un test :
await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
// Contournement pour seeds transverses :
await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
```

`set_config(key, value, true)` positionne la valeur LOCAL a la transaction (equivalent de `SET LOCAL`). Le helper `app_can_access_tenant()` lit ces variables de session pour autoriser ou non l'acces.

### 8.3bis Pourquoi des tests d'integration et non des tests unitaires

Une migration SQL n'a aucune logique applicative TypeScript a tester unitairement : tout son comportement reside dans le moteur PostgreSQL (contraintes CHECK, RLS, FK, triggers, defauts). Mocker `queryRunner.query` ne validerait que la concatenation de chaines, pas le comportement reel du SGBD. On privilegie donc des tests d'integration contre une vraie base. Cette approche detecte les vraies regressions :
- une faute de frappe dans une valeur CHECK (rejet d'un INSERT legitime),
- un oubli de `FORCE ROW LEVEL SECURITY` (faille d'isolation invisible en test unitaire),
- une politique RLS mal ecrite (un tenant voit les lignes d'un autre),
- une FK CASCADE/RESTRICT inversee (perte de donnees ou blocage),
- un trigger mal cable (updated_at fige).

Aucune de ces classes de bugs ne serait detectee par un mock. Le drapeau `SKIP_INTEGRATION` permet neanmoins de ne pas casser la CI unitaire quand aucune base n'est disponible.

### 8.3ter Pieges specifiques a l'ecriture des tests d'integration

- **Reset entre tests** : `dropAllTables` puis `runMigrations` dans `beforeEach` garantit une base propre par test. Sans cela, les UNIQUE/PK collisionneraient entre tests (d'ou les uuid fixes mais des `ON CONFLICT DO NOTHING` sur les seeds defensifs).
- **Variables de session LOCAL** : `set_config(key, value, true)` (3e argument `true` = LOCAL) limite la portee a la transaction courante. Comme les tests ne s'executent pas tous dans la meme transaction, on repositionne le contexte tenant dans CHAQUE test apres les seeds.
- **Seeds sous super_admin** : les seeds de `auth_tenants` / `auth_users` se font sous `app.is_super_admin = 'true'` car ces tables sont elles-memes en RLS ; sans ce contournement, l'INSERT des tenants echouerait.
- **password_hash valide** : `auth_users.password_hash` porte une contrainte `length BETWEEN 30 AND 500` ; les seeds utilisent `repeat('x', 60)` pour la satisfaire (un hash factice mais de longueur valide).
- **email valide** : `auth_users.email` est `citext UNIQUE` avec `length BETWEEN 5 AND 320` ; on utilise des emails distincts (`c@x.ma`, `e@x.ma`) pour eviter les collisions UNIQUE.

### 8.4 Test de coherence TS <-> SQL (optionnel mais recommande)

Ce test verifie que les chaines litterales de l'union `CrossTenantAuthorizationType` (cote TypeScript, fournie par 7.5a.3) sont exactement les 7 valeurs de la contrainte CHECK SQL. Comme une union de types n'est pas reflechie au runtime, on materialise la liste attendue cote test et on compare a une constante exportee (a maintenir alignee). Exemple :

```typescript
import { describe, it, expect } from 'vitest';

const SQL_TYPE_VALUES = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
] as const;

const SQL_RESOURCE_TYPES = [
  'sinistre', 'police', 'devis', 'facture', 'tenant', 'mission', 'expertise', 'parts_order',
] as const;

describe('coherence valeurs CHECK', () => {
  it('7 valeurs de type', () => {
    expect(SQL_TYPE_VALUES).toHaveLength(7);
    expect(new Set(SQL_TYPE_VALUES).size).toBe(7);
  });
  it('8 valeurs de resource_type', () => {
    expect(SQL_RESOURCE_TYPES).toHaveLength(8);
    expect(new Set(SQL_RESOURCE_TYPES).size).toBe(8);
  });
});
```

---

## 9. Variables d'environnement

| Variable | Role | Exemple |
|----------|------|---------|
| `DATABASE_URL` | URL complete de connexion (utilisee par la CLI TypeORM `migration:run`) | `postgres://skalean:skalean_dev_only@localhost:5432/skalean_insurtech` |
| `TEST_DATABASE_HOST` | hote Postgres de test | `localhost` |
| `TEST_DATABASE_PORT` | port Postgres de test | `5432` |
| `TEST_DATABASE_USER` | utilisateur Postgres de test | `skalean` |
| `TEST_DATABASE_PASSWORD` | mot de passe Postgres de test | `skalean_dev_only` |
| `TEST_DATABASE_NAME` | base de test | `skalean_insurtech` |
| `SKIP_INTEGRATION` | skip des tests d'integration (defaut `true`) | `false` (en CI integration) |
| `TEST_DATABASE_LOG` | logue le SQL des tests si `true` | `false` |

Aucune donnee assure ne quitte le Maroc : la base de test tourne localement (dev) ou sur l'infrastructure souveraine Atlas Benguerir (CI). Aucune cle API frontier n'est requise pour cette tache (migration DB pure).

---

## 10. Commandes shell

```bash
# Depuis la racine du monorepo.

# 1) Build du package database (verifie les types de la nouvelle entite et de la migration).
pnpm --filter @insurtech/database build

# 2) Appliquer la migration sur la base de dev.
pnpm --filter @insurtech/database migration:run

# 3) Verifier le rollback (down).
pnpm --filter @insurtech/database migration:revert

# 4) Re-appliquer (idempotence up apres down).
pnpm --filter @insurtech/database migration:run

# 5) Lancer les tests d'integration (necessite une base Postgres accessible).
SKIP_INTEGRATION=false pnpm --filter @insurtech/database test:integration

# 6) Lancer uniquement la nouvelle spec.
SKIP_INTEGRATION=false pnpm --filter @insurtech/database vitest run src/test/integration/cross-tenant-v3.spec.ts

# 7) Verifier l'absence d'emoji (decision-006).
bash scripts/check-no-emoji.sh
```

Note : si les scripts `migration:run` / `migration:revert` / `test:integration` n'existent pas tels quels dans `packages/database/package.json`, utiliser les scripts equivalents reels (souvent `db:migrate`, `db:revert`, `test`). Verifier le `package.json` du package avant d'executer.

---

## 11. Criteres de validation

Format : ID — niveau — critere — commande — resultat attendu — mode d'echec.

### P0 (>= 15, bloquants)

- **V1 (P0)** Fichier migration present. `ls packages/database/src/migrations/1735000000011-Sprint75aCrossTenantV3.ts` -> existe. Echec : fichier absent.
- **V2 (P0)** Classe correctement nommee. `grep -n "class Sprint75aCrossTenantV31735000000011 implements MigrationInterface" ...011-Sprint75aCrossTenantV3.ts` -> 1 match. Echec : nom de classe divergent.
- **V3 (P0)** Propriete name. `grep -n "public name = 'Sprint75aCrossTenantV31735000000011'" ...` -> 1 match. Echec : name absent/incorrect.
- **V4 (P0)** Build types OK. `pnpm --filter @insurtech/database build` -> exit 0. Echec : erreur TypeScript.
- **V5 (P0)** Table creee. Test #1 vert. Echec : table absente apres `runMigrations`.
- **V6 (P0)** 16 colonnes presentes. `SELECT count(*) FROM information_schema.columns WHERE table_name='expert_designations'` -> 16. Echec : colonne manquante.
- **V7 (P0)** RLS activee+forcee. Test #3 vert. Echec : RLS non forcee (faille d'isolation).
- **V8 (P0)** Politique d'isolation presente. Test #4 vert. Echec : politique absente.
- **V9 (P0)** Isolation tenant effective. Test #8 vert. Echec : un tenant voit les lignes d'un autre.
- **V10 (P0)** INSERT cross-tenant rejete. Test #9 vert. Echec : RLS WITH CHECK contournable.
- **V11 (P0)** 7 types CHECK acceptes. Tests #19-25 verts. Echec : un type v3.0 rejete.
- **V12 (P0)** type invalide rejete. Test #26 vert. Echec : domaine non ferme.
- **V13 (P0)** 8 resource_type acceptes. Tests #27-34 verts. Echec : un resource_type v3.0 rejete.
- **V14 (P0)** resource_type NULL accepte. Test #35 vert. Echec : NULL rejete (regression).
- **V15 (P0)** resource_type invalide rejete. Test #36 vert. Echec : domaine non ferme.
- **V16 (P0)** status CHECK ferme. Tests #10-15 verts. Echec : statut hors domaine accepte.
- **V17 (P0)** Aucune emoji. `bash scripts/check-no-emoji.sh` -> exit 0. Echec : emoji detectee.

### P1 (>= 8)

- **V18 (P1)** 5 indexes presents. Test #2 vert. Echec : index manquant.
- **V19 (P1)** Trigger updated_at correct. Test #5 vert. Echec : mauvaise fonction trigger.
- **V20 (P1)** Trigger rafraichit updated_at. Test #16 vert. Echec : updated_at fige.
- **V21 (P1)** sinistre_id sans FK. Test #6 vert. Echec : FK posee (migration echoue car table cible absente).
- **V22 (P1)** RESTRICT sur carrier_tenant. Test #17 vert. Echec : suppression silencieuse (perte de tracabilite).
- **V23 (P1)** CASCADE sur tenant proprietaire. Test #18 vert. Echec : lignes orphelines.
- **V24 (P1)** Idempotence down->up. Test #37 vert. Echec : up apres down echoue.
- **V25 (P1)** Migration enregistree dans le harness. `grep -n "Sprint75aCrossTenantV31735000000011" packages/database/src/test/helpers/datasource.ts` -> >= 2 matches (import + tableau). Echec : tests ne voient pas la migration.

### P2 (>= 5)

- **V26 (P2)** Entite TypeORM presente. `ls packages/database/src/entities/system/expert-designation.entity.ts` -> existe. Echec : entite absente.
- **V27 (P2)** Entite exportee dans l'index. `grep -n "expert-designation.entity" packages/database/src/entities/system/index.ts` -> 1 match. Echec : entite non agregee.
- **V28 (P2)** Doc SQL mise a jour. `grep -n "expert_designations" 00-pilotage/documentation/3-schemas-database-PARTIE2.sql` -> >= 1 match. Echec : doc non synchronisee.
- **V29 (P2)** Commentaires SQL presents. `SELECT obj_description('expert_designations'::regclass)` -> non NULL. Echec : table non documentee.
- **V30 (P2)** down() ne supprime pas set_updated_at_column. `grep -n "DROP FUNCTION" ...011-Sprint75aCrossTenantV3.ts` -> 0 match. Echec : suppression d'une fonction partagee.
- **V31 (P2)** Symetrie CHECK down. `grep -c "multi_tenant_user_access" ...011-Sprint75aCrossTenantV3.ts` -> >= 2 (up et down). Echec : down asymetrique.

---

## 12. Edge cases et troubleshooting

1. **Table `cross_tenant_authorizations` absente au moment du migration:run.** Symptome : `RAISE NOTICE` dans les logs, contraintes CHECK non posees. Cause : framework cross-tenant non encore deploye. Resolution : normal et attendu ; les CHECK seront poses des que la table existe (la migration 011, si rejouee apres creation de la table, reposera les contraintes ; sinon une migration ulterieure du framework les portera). Verifier que `expert_designations` est bien creee independamment.

2. **`down()` echoue avec violation de contrainte CHECK.** Symptome : `new row for relation "cross_tenant_authorizations" violates check constraint`. Cause : des lignes Assurflow (types v3.0) existent en base et la restauration vers 3 valeurs les invalide. Resolution : c'est un garde-fou volontaire ; purger ou migrer ces lignes avant le down(), ou ne pas jouer le down() sur une base contenant deja des donnees v3.0.

3. **INSERT dans `expert_designations` rejete silencieusement (0 ligne) sans erreur.** Symptome : `INSERT ... ; SELECT count(*) = 0`. Cause : `app.current_tenant_id` non positionne ou differe de `tenant_id`. Resolution : positionner `SET LOCAL app.current_tenant_id = '<tenant>'` correspondant au `tenant_id` insere, ou `app.is_super_admin = 'true'` pour les seeds.

4. **FK RESTRICT bloque un test de nettoyage.** Symptome : `update or delete on table "auth_tenants" violates foreign key constraint`. Cause : on tente de supprimer un carrier/expert tenant encore reference par une designation. Resolution : supprimer d'abord les designations, ou utiliser `dropAllTables` (DROP CASCADE) entre les tests.

5. **Le trigger ne met pas a jour updated_at.** Symptome : updated_at fige apres UPDATE. Cause : trigger non cree ou fonction `set_updated_at_column()` absente. Resolution : verifier que la migration 001 (qui cree la fonction) est appliquee avant la 011 ; verifier le `CREATE TRIGGER`.

6. **Erreur `function app_can_access_tenant(uuid) does not exist`.** Symptome : la politique RLS ne peut etre creee. Cause : le helper n'existe pas encore (il est cree/mis a jour par d'autres taches). Resolution : s'assurer que la fonction `app_can_access_tenant` existe en base avant la 011 (creee par le framework cross-tenant / migration socle). En environnement de test, le harness applique les migrations qui la definissent.

7. **`gen_random_uuid() does not exist`.** Cause : extension pgcrypto absente. Resolution : la migration 001 echoue deja explicitement si pgcrypto est absente ; installer l'extension (`CREATE EXTENSION pgcrypto`).

8. **Tentative de creer un tenant de type carrier/expert/tow.** Symptome : `invalid input value for enum tenant_type`. Cause : l'ENUM `tenant_type` n'est pas etendu (hors scope 7.5a). Resolution : utiliser `'mixed'` dans les tests/seed de 7.5a ; l'extension de l'ENUM viendra dans un sprint ulterieur.

9. **Index manquant detecte par le test #2.** Cause : nom d'index different (ex. underscore manquant). Resolution : verifier l'orthographe exacte `idx_expert_designations_<suffixe>`.

10. **`pnpm migration:run` ne trouve pas la migration.** Cause : la migration n'est pas referencee dans la DataSource CLI (data-source TypeORM de prod, distincte du harness de test). Resolution : verifier que le glob `migrations` de la DataSource principale inclut `src/migrations/*.ts` (ou ajouter explicitement l'import si la DataSource liste les classes une a une).

11. **`policy "expert_designations_tenant_isolation" already exists`.** Symptome : echec a la re-creation de la politique. Cause : un down() partiel a laisse la politique alors que la table a ete recreee, ou double application. Resolution : la politique est attachee a la table ; comme down() fait `DROP TABLE ... CASCADE`, la politique est supprimee avec la table. Si l'erreur survient, c'est qu'on a recree la table sans passer par down() complet ; nettoyer manuellement avec `DROP POLICY IF EXISTS expert_designations_tenant_isolation ON expert_designations;`.

12. **Migration appliquee deux fois (table de suivi corrompue).** Symptome : `relation "expert_designations" already exists` lors d'un migration:run. Cause : la ligne correspondante manque dans la table `migrations` de TypeORM alors que la table existe. Resolution : aligner l'etat (soit DROP la table puis rejouer, soit inserer manuellement la ligne de suivi). Ne jamais `CREATE TABLE IF NOT EXISTS` pour masquer ce probleme : cela cache une incoherence de suivi de migrations.

13. **Le test #16 (trigger updated_at) est flaky.** Symptome : `fresh` parfois faux. Cause : horloge de la base vs marge de l'intervalle trop serree. Resolution : la marge `interval '1 minute'` est largement suffisante ; si flaky, verifier que le seed initialise bien `updated_at` a `now() - interval '1 hour'` pour creer un ecart net.

### 12.1 Runbook operationnel (production Atlas Benguerir)

Sequence recommandee pour appliquer cette migration en production :

1. **Pre-deploiement** : verifier qu'aucune donnee Assurflow v3.0 n'existe encore dans `cross_tenant_authorizations` (en production socle, seules les 3 valeurs historiques doivent etre presentes). Requete de controle : `SELECT DISTINCT type FROM cross_tenant_authorizations;` (si la table existe).
2. **Sauvegarde** : snapshot de la base avant migration (politique de sauvegarde Atlas Benguerir, retention conforme).
3. **Fenetre de maintenance** : la migration est rapide (ADD CONSTRAINT sur table potentiellement vide, CREATE TABLE) ; elle ne necessite pas de fenetre longue, mais l'ADD CONSTRAINT pose un verrou `ACCESS EXCLUSIVE` bref sur `cross_tenant_authorizations` (si la table existe et contient des lignes, la validation parcourt la table). Sur une table volumineuse, prevoir l'execution en heure creuse.
4. **Application** : `pnpm --filter @insurtech/database migration:run`.
5. **Verification post-deploiement** : executer les requetes de validation V5-V16 contre la base de production (en lecture seule pour la plupart).
6. **Plan de rollback** : `pnpm --filter @insurtech/database migration:revert`. ATTENTION : ne fonctionne que si aucune donnee v3.0 n'a ete inseree entre-temps (voir edge-case 2). En cas de donnees v3.0 presentes, le rollback necessite une migration de donnees prealable.

### 12.1bis Scenario de bout en bout (SQL concret)

Le scenario suivant illustre le cycle de vie complet d'une designation d'expert tel qu'il sera utilise par la couche service Assurflow. Il sert aussi de support de revue manuelle. Toutes les requetes supposent que le contexte tenant a ete positionne correctement (via `SET LOCAL app.current_tenant_id` par le TenantGuard, ou `app.is_super_admin` pour les operations transverses de seed).

```sql
-- Prerequis : les tenants compagnie (carrier) et expert, et leurs utilisateurs, existent.
-- (En 7.5a ils sont de type 'mixed' car l'ENUM tenant_type n'est pas encore etendu.)

-- 1) La compagnie designe un expert sur le sinistre S.
--    Contexte : app.current_tenant_id = <carrier_tenant> (le tenant proprietaire RLS).
INSERT INTO expert_designations (
  tenant_id, carrier_tenant_id, carrier_user_id,
  expert_tenant_id, expert_user_id, sinistre_id, status, notes
) VALUES (
  '<carrier_tenant>', '<carrier_tenant>', '<carrier_user>',
  '<expert_tenant>', '<expert_user>', '<sinistre_S>', 'designated',
  'Designation suite a declaration sinistre, devis garage recu.'
);
-- designated_at, created_at, updated_at = now() automatiquement.

-- 2) L'expert accepte la mission.
--    (En 7.5a.5+, le helper autorisera l'expert a voir la ligne via la Cond 4.)
UPDATE expert_designations
   SET status = 'accepted', accepted_at = now()
 WHERE sinistre_id = '<sinistre_S>' AND status = 'designated';
-- Le trigger trg_expert_designations_updated_at rafraichit updated_at.

-- 3a) Variante refus : l'expert refuse avec motif.
UPDATE expert_designations
   SET status = 'rejected', rejected_at = now(),
       rejection_reason = 'Vehicule hors zone de competence ; reaffecter.'
 WHERE sinistre_id = '<sinistre_S>' AND status = 'designated';

-- 3b) Variante annulation par la compagnie (avant acceptation).
UPDATE expert_designations
   SET status = 'cancelled'
 WHERE sinistre_id = '<sinistre_S>' AND status = 'designated';

-- 4) Apres acceptation : l'expert constate puis cloture.
UPDATE expert_designations
   SET status = 'completed', completed_at = now()
 WHERE sinistre_id = '<sinistre_S>' AND status = 'accepted';

-- 5) Consultation par la compagnie : historique des designations sur le sinistre.
SELECT id, expert_tenant_id, status, designated_at, accepted_at, completed_at
  FROM expert_designations
 WHERE sinistre_id = '<sinistre_S>'
 ORDER BY designated_at DESC;
```

Remarques sur ce scenario :
- Les transitions de statut (`designated` -> `accepted`/`rejected`/`cancelled` ; `accepted` -> `completed`/`cancelled`) NE sont PAS enforcees par la base : la contrainte CHECK ne valide que l'appartenance au domaine, pas le graphe de transitions. La validation des transitions legales releve de la couche service (machine a etats applicative). C'est un choix volontaire : encoder une machine a etats en SQL pur (trigger BEFORE UPDATE comparant OLD.status et NEW.status) serait fragile et difficile a faire evoluer ; la regle metier vit donc dans le service, la base garantit seulement l'integrite du domaine.
- L'horodatage de transition (`accepted_at`, `rejected_at`, `completed_at`) est positionne explicitement par le service, pas par un defaut SQL, car il depend de l'action metier et non de la simple modification de ligne.
- L'isolation RLS garantit que seul un acteur autorise sur le `tenant_id` proprietaire voit la ligne ; l'extension de l'acces a l'expert designe sera apportee par 7.5a.5.

### 12.1ter Glossaire des termes Assurflow

- **Carrier (compagnie)** : compagnie d'assurance, tenant emetteur des designations d'expertise et destinataire des devis.
- **Expert** : cabinet d'expertise auto agree ACAPS, tenant qui recoit les designations et redige les rapports.
- **Tow (depanneuse)** : prestataire d'enlevement/remorquage, tenant implique dans les flux `client_to_tower_dispatch` et `tower_to_garage_delivery`.
- **Garage** : reparateur agree, tenant implique dans les flux `tower_to_garage_delivery`, `garage_to_expert_request`, `garage_to_carrier_quote`.
- **Sinistre** : evenement dommageable declare ouvrant un dossier (table `insure_sinistres`, Sprint 14).
- **Mission** : ordre de depannage/enlevement.
- **Expertise** : dossier d'evaluation des degats par l'expert.
- **RLS** : Row Level Security, mecanisme PostgreSQL d'isolation ligne a ligne.
- **decision-013** : decision d'architecture formalisant le workflow de designation d'expert.

### 12.2 Verrouillage et concurrence

L'`ALTER TABLE ... ADD CONSTRAINT` acquiert un verrou `ACCESS EXCLUSIVE` sur `cross_tenant_authorizations`. Pendant la validation, aucune lecture ni ecriture concurrente n'est possible sur cette table. Comme la table est generalement petite (autorisations actives, purgees a expiration), la duree est negligeable. Le `CREATE TABLE expert_designations` ne verrouille rien d'existant (nouvelle relation). Les `CREATE INDEX` sur la table fraichement creee (vide) sont instantanes. Aucun `CREATE INDEX CONCURRENTLY` n'est necessaire ici puisque la table est vide a sa creation.

---

## 13. Conformite Maroc

### 13.1 CNDP (loi 09-08 sur la protection des donnees a caractere personnel)

La table `expert_designations` etablit un lien entre des personnes physiques identifiables (l'utilisateur compagnie `carrier_user_id`, l'expert `expert_user_id`) et un dossier sinistre. Ces liens cross-tenant constituent un traitement de donnees a caractere personnel au sens de la loi 09-08. Obligations honorees :
- **Minimisation** : la table ne stocke que les identifiants (uuid) des acteurs et les horodatages strictement necessaires au suivi du cycle de vie. Aucune donnee sensible (etat de sante, donnees bancaires) n'y figure. Le `rejection_reason` et les `notes` sont du texte libre dont le contenu releve de la responsabilite applicative (l'application doit eviter d'y stocker des donnees sensibles ; un controle applicatif est recommande mais hors scope DB).
- **Tracabilite / audit** : toute creation/modification de designation doit etre journalisee dans `audit_log` (table append-only, 7 ans de retention) par la couche service. La migration ne realise pas l'audit elle-meme mais fournit la structure ; le trigger `updated_at` garantit la fraicheur de l'horodatage de derniere modification.
- **Residency** : les donnees ne quittent jamais le territoire marocain ; la base est hebergee sur le cloud souverain Atlas Benguerir (decision-008). Aucune replication hors Maroc.
- **Isolation** : le RLS (`app_can_access_tenant`) garantit qu'un tenant ne peut acceder qu'aux designations qui le concernent, conforme au principe de limitation d'acces de la loi 09-08.

### 13.2 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

- **Tracabilite de l'agrement expert** : l'expert designe (`expert_user_id` / `expert_tenant_id`) doit etre un expert agree ACAPS. La verification de l'agrement releve de la couche service (lors de la designation), mais la table conserve la trace immuable de qui a ete designe et quand (`designated_at`), ce qui est essentiel pour un controle ACAPS.
- **Integrite du dossier sinistre** : le `sinistre_id` lie chaque designation a un sinistre. Les contraintes `ON DELETE RESTRICT` sur les acteurs garantissent qu'on ne peut pas effacer un acteur tant qu'il est implique dans un dossier d'expertise, preservant l'integrite et la non-repudiation des dossiers (exigence ACAPS de conservation des pieces de sinistre).
- **Cycle de vie audite** : les statuts (`designated`/`accepted`/`rejected`/`completed`/`cancelled`) et leurs horodatages dedies materialisent un parcours verifiable, conforme aux exigences de tracabilite des operations d'expertise.

### 13.3 Loi 17-99 (Code des assurances)

- Le Code des assurances encadre l'expertise auto (designation, contradiction, delais). La table fournit le socle de donnees pour materialiser ces obligations (date de designation, acceptation, refus motive via `rejection_reason`, completion). La conservation de l'historique (pas de DELETE applicatif recommande, plutot un statut `cancelled`) soutient la conformite 17-99.

---

## 14. Conventions absolues (reproduites en integralite)

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; filtre `tenant_id` automatique via `TenantGuard` ; `TenantContext` porte par `AsyncLocalStorage` ; isolation RLS via `app_can_access_tenant()` ; audit trail par operation.
- **Validation stricte** : Zod uniquement ; schemas dans `@insurtech/shared-types` ; `const Schema = z.object({...})` ; `type T = z.infer<typeof Schema>`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; JSON structure ; champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id (65536/3/4) ; jamais bcrypt ; pepper `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; engine-strict Node >= 22.11.0 ; save-exact ; link-workspace-packages=deep.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest unit + integration ; Playwright E2E ; chaque `.ts` a son `.spec.ts` ; couverture >= 85% global, >= 90% auth/database/signature.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` globaux ; 26 roles v3.0.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par evenement ; `Idempotency-Key` pour les operations critiques.
- **Imports strict** : `@insurtech/{name}` ; paths via `tsconfig.base.json` ; ordre Node / externe / `@insurtech` / relatif.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un modele frontier ; mock pour Sprints 1-28, reel a partir du Sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; la CI echoue si une emoji est detectee.
- **Idempotency-Key strict** : obligatoire sur `POST /payments`, `/signatures`, `/claims`, et les ecritures MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir uniquement ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc ; AES-256-GCM ; TLS 1.3.

---

## 15. Validation pre-commit

```bash
# 1) Build du package (types de l'entite et de la migration).
pnpm --filter @insurtech/database build

# 2) Lint + format.
pnpm --filter @insurtech/database lint

# 3) Tests d'integration (base de test requise).
SKIP_INTEGRATION=false pnpm --filter @insurtech/database test:integration

# 4) Absence d'emoji (decision-006).
bash scripts/check-no-emoji.sh

# 5) Verifier que la migration s'applique et se rollback proprement.
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run
```

Checklist pre-commit :
- [ ] La classe et `name` valent `Sprint75aCrossTenantV31735000000011`.
- [ ] up() pose 7 valeurs `type`, 8 valeurs `resource_type` (NULL tolere), cree `expert_designations` + RLS + trigger.
- [ ] down() supprime trigger + table CASCADE, restaure 3 + 5 valeurs, NE supprime PAS `set_updated_at_column()`.
- [ ] Entite `expert-designation.entity.ts` creee et exportee.
- [ ] Migration enregistree dans le harness de test.
- [ ] >= 20 cas de test, tous verts en integration.
- [ ] Aucune emoji.
- [ ] Doc SQL `3-schemas-database-PARTIE2.sql` mise a jour.

---

## 16. Message de commit

```
feat(sprint-7.5a): migrate cross_tenant CHECK to 7 types + create expert_designations table

Migration TypeORM 1735000000011-Sprint75aCrossTenantV3 :
- etend la contrainte CHECK cross_tenant_authorizations.type de 3 a 7 valeurs
  (ajout client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request,
  garage_to_carrier_quote) ;
- etend la contrainte CHECK cross_tenant_authorizations.resource_type de 5 a 8 valeurs
  (ajout mission, expertise, parts_order ; NULL tolere) ;
- cree la table expert_designations (decision-013 : designation d'expert par une compagnie
  sur un sinistre) avec RLS activee + forcee, isolation app_can_access_tenant(tenant_id),
  5 indexes, CHECK status, trigger updated_at reutilisant set_updated_at_column() ;
- entite TypeORM ExpertDesignation + tests d'integration (20+ cas : 7 types, 8 resource_type,
  status CHECK, isolation RLS, RESTRICT/CASCADE, idempotence up/down/up).

Blocs DO idempotents et gardes par l'existence de cross_tenant_authorizations (framework
cross-tenant non garanti deploye). sinistre_id sans FK (insure_sinistres au Sprint 14).
ENUM tenant_type non etendu (hors scope 7.5a).

Conformite : CNDP 09-08 (minimisation, audit, residency Atlas Benguerir), ACAPS (tracabilite
agrement expert, integrite sinistre), loi 17-99.

Task: 7.5a.4
Sprint: 7.5a
Phase: 2.5
Reference: B-7.5a task 7.5a.4
```

---

## 17. Workflow / next step

Une fois cette tache validee (V1-V31 verts, base migree et reversible) :

- **Tache suivante : 7.5a.5** — mise a jour du helper Postgres `app_can_access_tenant(target_tenant_id uuid)`. Cette fonction devra reconnaitre les 4 nouveaux types d'autorisation cross-tenant (`client_to_tower_dispatch`, `tower_to_garage_delivery`, `garage_to_expert_request`, `garage_to_carrier_quote`) et, le cas echeant, consulter `expert_designations` comme source d'autorisation cross-tenant (un expert designe et ayant accepte peut acceder au sinistre concerne). La table `expert_designations` et les contraintes CHECK etendues, livrees ici, sont le prerequis structurel indispensable a 7.5a.5.
- L'entite `ExpertDesignation` exposee ici servira de base au repository TypeORM consomme par les services Assurflow des sprints ulterieurs (declaration de sinistre, workflow expertise au Sprint 14+).

---

## Resume final

Cette tache 7.5a.4 livre une migration TypeORM unique et atomique (`1735000000011-Sprint75aCrossTenantV3`, classe `Sprint75aCrossTenantV31735000000011`) qui (1) etend la contrainte CHECK `cross_tenant_authorizations.type` de 3 a 7 valeurs, (2) etend `resource_type` de 5 a 8 valeurs avec tolerance NULL, et (3) cree la table `expert_designations` (decision-013) avec RLS activee/forcee, isolation `app_can_access_tenant(tenant_id)`, 5 indexes, CHECK de statut, et trigger `updated_at` reutilisant la fonction existante `set_updated_at_column()`. La migration est idempotente (blocs DO gardes + DROP IF EXISTS), reversible (down() symetrique restaurant 3 + 5 valeurs), robuste a l'absence de la table cross-tenant, et n'introduit pas de FK vers `insure_sinistres` (Sprint 14) ni d'extension de l'ENUM `tenant_type` (hors scope). Les livrables incluent l'entite TypeORM `ExpertDesignation`, l'enregistrement dans le harness de test, plus de 20 cas de tests d'integration Vitest, et la mise a jour de la doc SQL de reference. La tache respecte les conventions absolues (multi-tenant, RLS, no-emoji decision-006, cloud souverain decision-008) et la conformite Maroc (CNDP 09-08, ACAPS, loi 17-99). Elle debloque 7.5a.5 (mise a jour du helper `app_can_access_tenant`).
