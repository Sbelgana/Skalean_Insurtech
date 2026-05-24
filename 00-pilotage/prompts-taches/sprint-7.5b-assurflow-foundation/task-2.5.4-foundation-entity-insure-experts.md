# Tache 2.5.4 -- Foundation entity `insure_experts` -- Catalogue/annuaire des experts (migration TypeORM)

- Identifiant : 2.5.4 (reference historique B-7.5b)
- Sprint : 7.5b (Phase 2 / Sprint 5 dans la numerotation continue)
- Phase : 2
- Priorite : P0
- Effort : 1 heure
- Dependances : 2.5.3 (table foundation precedente du Sprint 7.5b, qui fournit le contexte de schema et la sequence de numerotation des migrations 1735000000xxx)
- Bloque : 2.5.5 (renommage/migration de `expert_designations` vers `insure_expert_assignments`, qui referencera `insure_experts`)
- Statut : a faire
- Densite cible : 80 a 150 ko (cible ~95-110 ko)
- Convention emoji : AUCUNE EMOJI dans ce document, dans le code SQL, dans le code TypeScript, dans les commits, dans les logs, dans les tests, dans les commentaires de migration, dans les noms de fichiers, dans les noms de variables, dans les messages d'erreur Zod, dans les libelles UI futurs. Decision-006 ABSOLUE. Le hook `check-no-emoji.sh` echoue la CI si une seule emoji est detectee.

## 1. But

Cette tache cree la table de fondation `insure_experts` : le **catalogue** (annuaire/directory) des profils d'experts en assurance du vertical Assurflow (decision-011 : Skalean est l'entreprise, Assurflow est le vertical InsurTech, Sofidemy est la marque commerciale). Une seule migration TypeORM 0.3 atomique, idempotente et reversible introduit la table Postgres 16 `insure_experts`, ses cinq indexes (dont deux GIN sur des colonnes `text[]`), l'activation Row Level Security (RLS) avec `ENABLE` + `FORCE`, une policy d'isolation tenant reposant sur le helper `app_can_access_tenant(tenant_id)`, le trigger `BEFORE UPDATE` reutilisant la fonction partagee `set_updated_at_column()` (Sprint 1, jamais recreee ici), les `GRANT` necessaires au role applicatif `insurtech_app`, et les `COMMENT` documentaires.

Cette table est strictement le **catalogue** des experts : qui ils sont, leur agrement ACAPS, leur specialite, leurs zones d'intervention, leurs metriques agregees de performance et leur statut KYB (Know Your Business). Elle est le **COMPLEMENT** -- et non le remplacement -- de la table `expert_designations` livree par le Sprint 7.5a. La table `expert_designations` (qui sera renommee `insure_expert_assignments` par la tache 2.5.5 qui suit) trace les **designations par sinistre** : quel expert a ete missionne sur quel dossier, quand, avec quel honoraire. La table `insure_experts` repond a la question "qui sont nos experts" ; `expert_designations`/`insure_expert_assignments` repond a la question "qui a ete designe sur ce sinistre precis". Les deux coexistent ; la tache 2.5.4 n'altere jamais `expert_designations`.

L'implementation du service applicatif (CRUD, recherche, workflow KYB, scoring) est **deleguee au Sprint 14**. La tache 2.5.4 ne produit que la couche persistante : la migration, l'alignement avec l'entite TypeORM squelette `insure-expert.entity.ts` (issue de la tache 2.5.1), les tests d'integration sur un harnais Postgres reel, et la documentation SQL. Aucun controleur, aucun service NestJS, aucune route HTTP n'est livre ici.

Le perimetre est volontairement etroit et exhaustivement specifie pour rendre la tache executable en une heure par un agent ou un developpeur sans decision residuelle : chaque colonne, chaque contrainte, chaque index, chaque commentaire SQL est fixe ci-dessous. Aucune liberte d'interpretation n'est laissee sur le nommage (`insure_experts`, prefixe `insure_` du vertical), sur la numerotation de migration (`1735000000013`), sur le role de connexion (`insurtech_app`), ni sur la reutilisation des objets partages du Sprint 1.

En une phrase de cadrage : cette tache livre une table Postgres `insure_experts`, son entite TypeORM alignee, ses tests (migration + integration reelle) et sa documentation, le tout reversible et conforme aux decisions 006 (no-emoji), 008 (souverainete MA), 011 (naming), 012 et 013 (separation catalogue/transactionnel). La granularite de specification ci-dessous vise l'execution sans decision residuelle.

## 2. Contexte etendu

### 2.1. Catalogue versus designation par sinistre : pourquoi deux tables distinctes

Le domaine de l'expertise sinistre en assurance automobile et multirisque au Maroc impose une separation nette entre l'**identite durable** d'un expert et ses **interventions ponctuelles**. Un expert agree ACAPS possede un profil stable : nom, numero CIN, numero d'agrement ACAPS, specialite (automobile, incendie, degats des eaux, responsabilite civile), zones geographiques d'intervention, cabinet de rattachement. Ce profil change rarement (renouvellement d'agrement tous les N ans, ajout d'une specialite). En revanche, ce meme expert est missionne des dizaines de fois par mois sur des sinistres distincts, chaque mission ayant son propre cycle de vie (designation, acceptation, expertise, rapport, cloture) et son propre honoraire negocie.

Modeliser ces deux realites dans une seule table serait une erreur de normalisation : on dupliquerait le profil complet de l'expert a chaque designation, ou bien on melangerait des colonnes a duree de vie radicalement differente. La table `insure_experts` (catalogue) porte une ligne par expert. La table `expert_designations`/`insure_expert_assignments` (transactionnelle) porte une ligne par mission, avec une FK `expert_id` vers `insure_experts(id)`. C'est une relation un-a-plusieurs classique : un expert (catalogue) -> plusieurs designations (transactionnel). La tache 2.5.5 etablira cette FK lors du renommage.

Cette separation est aussi imposee par le RGPD-MA (Loi 09-08 / CNDP) : les donnees personnelles de l'expert (CIN, telephone, email, document CIN) vivent dans `insure_experts` et sont soumises a une politique de retention et d'isolation RLS dediee ; les donnees transactionnelles de mission vivent ailleurs et ont leur propre cycle de purge. Melanger les deux compliquerait l'application du droit a l'oubli et la minimisation des donnees. Concretement, une demande d'effacement portant sur l'identite d'un expert (cessation d'activite, retrait d'agrement) doit pouvoir s'appliquer au catalogue sans interferer avec la conservation legale des traces de missions (qui repondent a une obligation comptable et assurantielle distincte). La frontiere catalogue/transactionnel est donc autant une frontiere de modelisation qu'une frontiere de gouvernance des donnees.

Concretement, le catalogue est ecrit rarement (creation, mise a jour de profil, transition de statut KYB) et lu intensement (listings, recommandations, recherches multi-criteres au Sprint 14-15). Le transactionnel est ecrit a chaque mission. Les profils de charge sont opposes, ce qui justifie aussi des strategies d'indexation distinctes : GIN orientees recherche cote catalogue, B-tree orientees jointures et tri chronologique cote transactionnel.

### 2.2. La contrainte conditionnelle carrier_internal

La colonne `expert_type` discrimine quatre natures d'expert : `independent` (expert independant exercant en son nom propre), `firm_admin` (gerant d'un cabinet d'expertise), `associate` (expert associe rattache a un cabinet) et `carrier_internal` (expert salarie interne d'une compagnie d'assurance). Cette derniere categorie est specifique : un expert interne appartient a une compagnie (carrier) precise, identifiee par `carrier_tenant_id` (FK vers `auth_tenants(id)`, la compagnie etant elle-meme un tenant de la plateforme).

La contrainte conditionnelle `chk_insure_experts_carrier_internal` impose que `carrier_tenant_id` soit obligatoirement renseigne lorsque `expert_type = 'carrier_internal'`, et reste libre (peut etre NULL) pour les trois autres types. L'expression SQL est : `(expert_type = 'carrier_internal' AND carrier_tenant_id IS NOT NULL) OR (expert_type <> 'carrier_internal')`. Cette formulation est volontairement permissive pour les types non-internes : un expert independant peut neanmoins avoir un `carrier_tenant_id` NULL (cas normal) sans violer la contrainte. Le piege classique serait d'ecrire `carrier_tenant_id IS NULL` pour les non-internes, ce qui interdirait abusivement tout rattachement et casserait des cas legitimes futurs. La contrainte ne valide donc QUE l'obligation pour les internes.

Une subtilite SQL importante : un CHECK n'est viole que si son expression s'evalue a FALSE ; une evaluation a NULL (par exemple si `expert_type` etait NULL) ne declenche pas le rejet. Ici `expert_type` est `NOT NULL`, donc la branche `expert_type <> 'carrier_internal'` est toujours definie (TRUE ou FALSE), ce qui rend la contrainte deterministe. C'est pourquoi l'ordre des branches et le `NOT NULL` sur `expert_type` sont co-essentiels : retirer le `NOT NULL` introduirait une faille ou une ligne `carrier_internal` avec `expert_type` NULL passerait au travers.

### 2.3. Unicite et expiration de l'agrement ACAPS

L'Autorite de Controle des Assurances et de la Prevoyance Sociale (ACAPS) delivre a chaque expert un numero d'agrement unique au niveau national. La colonne `acaps_agrement_number varchar(50) NOT NULL UNIQUE` materialise cette unicite **globale** (et non par tenant) : un numero d'agrement ACAPS identifie une personne physique agreee dans tout le Royaume, deux tenants ne peuvent pas declarer le meme numero. C'est l'une des rares contraintes cross-tenant volontaires de la plateforme, justifiee par le fait que l'agrement est une donnee de registre public national, pas une donnee proprietaire d'un cabinet.

La colonne `acaps_agrement_expiry_date date NOT NULL` porte la date d'expiration de l'agrement. Le statut `expired_agrement` (dans l'enum `status`) materialise un expert dont l'agrement a expire : un job nightly (Sprint 14) basculera automatiquement les experts vers ce statut lorsque `acaps_agrement_expiry_date < CURRENT_DATE`. La table ne contient aucun trigger de calcul automatique de ce statut : la migration 2.5.4 se borne a stocker la donnee ; la logique metier de basculement est deleguee au Sprint 14. Les documents justificatifs (`cin_document_url`, `acaps_agrement_document_url`) sont des URLs vers le stockage objet souverain (MinIO/S3 Atlas Benguerir, decision-008), pas des blobs en base.

Le monitoring d'expiration relevera d'une projection planifiee : le job nightly du Sprint 14 selectionnera les experts dont l'agrement expire dans une fenetre glissante (par exemple 30 jours) pour declencher une alerte de renouvellement, puis basculera en `expired_agrement` ceux qui ont effectivement depasse la date. La migration 2.5.4 garantit que la donnee necessaire (`acaps_agrement_expiry_date` non NULL, indexable indirectement via `status`) est disponible et fiable. Aucune regle d'unicite n'est posee sur le couple `(tenant_id, acaps_agrement_number)` : l'unicite est strictement globale, sans dimension tenant, conformement au caractere national du registre.

### 2.4. Indexes GIN sur colonnes text[] pour la recherche par specialite et zone

La recherche d'experts par specialite ACAPS (`acaps_specialty text[]`) et par zone d'intervention (`active_zones text[]`) est un cas d'usage central du Sprint 14 : "trouver tous les experts automobile actifs dans la region Casablanca-Settat". Ces deux colonnes sont des tableaux Postgres (`text[]`). Pour rendre efficaces les operateurs de conteneur `@>`, `<@` et `&&` (overlap), un index B-tree classique est inutilisable : seul un index GIN (Generalized Inverted Index) indexe le contenu d'un tableau. D'ou `idx_insure_experts_specialty USING GIN (acaps_specialty)` et `idx_insure_experts_zones USING GIN (active_zones)`.

Le piege ici est de declarer un index B-tree par defaut sur un `text[]` : Postgres l'acceptera syntaxiquement mais il n'accelerera jamais une requete `WHERE acaps_specialty @> ARRAY['auto']`. Il faut imperativement le mot-cle `USING GIN`. Un second piege : ne pas confondre GIN (pour les tableaux et le JSONB) avec GiST. Pour des `text[]` de cardinalite modeste, GIN est le bon choix (lectures rapides, ecritures legerement plus couteuses, ce qui est acceptable pour un catalogue a faible taux d'ecriture).

La classe d'operateurs implicite pour `text[]` sous GIN est `array_ops`, native a Postgres ; aucune extension (`btree_gin`, `intarray`) n'est requise pour les operateurs ensemblistes standards. Le cout d'ecriture marginal du GIN (mises a jour de l'index inverse a chaque INSERT/UPDATE sur ces colonnes) est negligeable pour un catalogue, ou les ecritures sont rares et les lectures de recherche frequentes. On accepte donc explicitement le compromis "ecriture legerement plus chere contre recherche rapide", coherent avec le profil de charge decrit en 2.1.

### 2.5. Cycle de vie KYB et machine a etats du statut

La colonne `status` materialise une machine a etats du cycle de vie KYB (Know Your Business) de l'expert. L'etat initial par defaut est `pending_kyb` : tout expert nouvellement insere est en attente de revue de conformite (verification de l'agrement ACAPS, du CIN, de l'ICE du cabinet le cas echeant). Les transitions prevues (implementees au Sprint 14, pas ici) sont :

- `pending_kyb -> active` : la revue KYB est validee (un reviewer renseigne `kyb_reviewed_at` et `kyb_reviewed_by_user_id`) ; l'expert devient eligible aux designations.
- `pending_kyb -> inactive` : la revue est rejetee (motif dans `kyb_rejection_reason`) ou l'expert se retire avant validation.
- `active -> suspended` : suspension temporaire (mesure disciplinaire, signalement, controle ACAPS en cours) ; reversible vers `active`.
- `active -> expired_agrement` : bascule automatique par le job nightly lorsque `acaps_agrement_expiry_date < CURRENT_DATE` ; reversible vers `active` apres renouvellement de l'agrement.
- `active|suspended|expired_agrement -> inactive` : desactivation logique (cessation d'activite) avant purge eventuelle conforme a la retention legale.

La migration 2.5.4 ne code AUCUNE de ces transitions : elle garantit seulement que l'ensemble des etats est exhaustif et contraint par le CHECK `status IN ('active', 'pending_kyb', 'suspended', 'expired_agrement', 'inactive')`, et que l'etat initial est `pending_kyb` via le DEFAULT. La machine a etats applicative (guards, transitions autorisees, journalisation des changements) appartient au service `service-experts` du Sprint 14.

### 2.6. Consommation aval (Sprint 14 et au-dela)

La table `insure_experts` est une fondation. Elle sera consommee par :

- **Sprint 14** : module `service-experts` (NestJS) implementant le CRUD complet, le workflow KYB (soumission, revue, approbation/rejet avec `kyb_rejection_reason`), la recherche multi-critere (specialite GIN, zone GIN, statut, rating), le scoring de performance (alimentation de `avg_rating`, `avg_response_time_hours`, `total_missions`), et le basculement automatique de statut `expired_agrement`.
- **Sprint 15** : moteur de selection/recommandation d'expert pour une designation (consommera `baseline_honoraire_mad`, `active_zones`, `avg_rating`).
- **Sprint 16** : tableaux de bord compagnie (carrier) listant les experts internes via `carrier_tenant_id`.
- **Sprint 28** : reporting ACAPS sur le vivier d'experts agrees par tenant.

La tache 2.5.5 (qui suit immediatement) renommera `expert_designations` en `insure_expert_assignments` et y ajoutera la FK `expert_id -> insure_experts(id)`, scellant la relation catalogue/transactionnel. La tache 2.5.6 ajoutera `insure_expert_reports` (rapports d'expertise) referencant egalement `insure_experts(id)`.

### 2.7. Alternatives evaluees et trade-offs

Le tableau suivant resume les alternatives de modelisation evaluees et la raison de leur rejet ou de leur adoption.

| Alternative | Description | Decision | Raison |
|---|---|---|---|
| A -- table unique | Fusionner catalogue + designations en une seule table | Rejetee | Duplication du profil par mission, retention RGPD melangee, cardinalites opposees (cf. 2.1) |
| B -- metriques calculees a la volee | `total_missions`/`avg_rating` calculees par agregation sur les assignments | Rejetee | Trop couteux pour les listings/recommandations frequents ; on materialise et on recalcule en nightly |
| C -- jointures pour specialty/zones | `acaps_specialty`/`active_zones` en tables de jointure normalisees | Rejetee V1 | Cardinalite faible (1-5 specialites, 1-10 zones) ; `text[]` + GIN suffisent ; normalisation future possible |
| D -- enum natif Postgres | `expert_type`/`status` en types ENUM natifs | Rejetee V1 | `ALTER TYPE ... ADD VALUE` non transactionnel et difficile a reverser proprement ; `varchar` + CHECK trivialement reversible |
| E -- colonne JSONB unique | Agrement + metriques + metadata en un seul JSONB | Rejetee | Perte du typage fort, des CHECK granulaires, de l'index B-tree sur `status` et de la lisibilite |
| F -- text[] + GIN (retenue) | Tableaux Postgres indexes GIN pour specialite/zone | Adoptee | Meilleur compromis lecture/simplicite pour un catalogue stable et reglemente |
| G -- varchar + CHECK (retenue) | `expert_type`/`status` en `varchar(50)` + CHECK IN | Adoptee | Integrite equivalente a l'ENUM, reversibilite triviale, lisibilite psql, union TS alignee |

**Detail Alternative A (table unique)** : melanger catalogue et designations imposerait soit la duplication du profil expert a chaque mission (denormalisation massive, anomalies de mise a jour), soit la cohabitation de colonnes a esperance de vie incompatible. Rejetee pour des raisons de normalisation, de retention RGPD differenciee et de cardinalite (cf. 2.1).

**Detail Alternative B (metriques a la volee)** : recalculer `total_missions`, `avg_rating`, `avg_response_time_hours` par agregation sur `insure_expert_assignments` a chaque affichage serait trop couteux pour les ecrans de listing et de recommandation appeles frequemment. On materialise donc les metriques dans le catalogue, alimentees par un job/projection (Sprint 14). Trade-off accepte : risque de desynchronisation transitoire, corrige par recalcul nightly.

**Detail Alternative D (ENUM natif)** : les types enum Postgres sont rigides a faire evoluer (ajout de valeur via `ALTER TYPE ... ADD VALUE` non transactionnel avant Postgres 12, et toujours non reversible proprement en migration), ce qui complique le `down()`. Le couple `varchar` + `CHECK IN (...)` offre la meme garantie d'integrite tout en restant trivialement reversible et lisible dans les `\d` de psql. Trade-off accepte : la liste des valeurs autorisees vit dans la contrainte CHECK (et est dupliquee cote TypeScript via les types union `ExpertType`/`ExpertStatus`), au prix d'une legere redondance documentee.

**Detail Alternative E (JSONB)** : on perdrait le typage fort, les contraintes CHECK granulaires, l'indexabilite B-tree sur `status`, et la lisibilite. JSONB serait justifie pour des attributs reellement libres et evolutifs, ce qui n'est pas le cas d'un catalogue d'experts au schema stable et reglemente (ACAPS).

**Trade-off retention** : les donnees PII de l'expert (CIN, telephone, email) relevent du RGPD-MA. La retention est alignee sur l'obligation legale ACAPS (7 ans apres cessation d'activite) et CNDP (minimisation). La colonne `status = 'inactive'` permet une desactivation logique avant purge.

### 2.8. Quatorze pieges critiques anticipes

1. **FK vers auth_tenants et auth_users, jamais bare tenants/users** : toutes les references etrangeres pointent vers `auth_tenants(id)` et `auth_users(id)` (schema d'authentification de la plateforme). Ecrire `REFERENCES tenants(id)` ou `REFERENCES users(id)` provoque une erreur "relation does not exist" car ces tables nues n'existent pas. *Solution* : toujours prefixer `auth_` ; verifier via `\d insure_experts` que les FK affichees pointent sur `auth_tenants`/`auth_users`.
2. **timestamptz et jamais timestamp** : `created_at`, `updated_at`, `kyb_reviewed_at` sont tous en `timestamptz` (avec fuseau). Utiliser `timestamp` sans fuseau corromprait les comparaisons cross-DC (DC1 Tier III + DC2 Tier IV, decision-008) et les jobs nightly. *Solution* : grep le DDL pour `timestamp ` nu (sans `tz`) et le bannir.
3. **Reutilisation du trigger set_updated_at_column()** : la fonction `set_updated_at_column()` est creee une seule fois au Sprint 1. La migration 2.5.4 cree UNIQUEMENT le trigger `trg_insure_experts_updated_at` qui l'appelle. Recreer la fonction (`CREATE OR REPLACE FUNCTION`) dans cette migration est interdit ; le `down()` ne doit JAMAIS la dropper (elle est partagee par des dizaines de tables). *Solution* : le `up()` ne contient aucun `CREATE FUNCTION` ; le `down()` aucun `DROP FUNCTION`.
4. **GIN obligatoire sur text[]** : les indexes sur `acaps_specialty` et `active_zones` doivent utiliser `USING GIN`. Un B-tree par defaut serait silencieusement inutile (cf. 2.4). *Solution* : verifier `indexdef` contient `USING gin`.
5. **CHECK conditionnel carrier_internal** : la contrainte ne valide que l'obligation de `carrier_tenant_id` pour les internes, pas son interdiction pour les autres (cf. 2.2). Inverser la logique casse les cas legitimes. *Solution* : tester les deux branches (interne sans carrier rejete ; non-interne avec carrier accepte).
6. **Numerotation de migration vs Sprint 7.5a** : le Sprint 7.5a a consomme les numeros 011 et 012 (`1735000000011`, `1735000000012`). La presente migration prend le numero suivant : `1735000000013`, classe `Sprint75bInsureExperts1735000000013`. Reutiliser 011 ou 012 provoque un conflit d'ordre d'execution TypeORM et une migration ignoree ou rejouee. *Solution* : verifier l'unicite du timestamp dans `index.ts`.
7. **down() ne droppe pas la fonction partagee** : le `down()` droppe le trigger `trg_insure_experts_updated_at` PUIS la table `insure_experts` (dans cet ordre, le trigger d'abord car il depend de la table, mais en pratique `DROP TABLE` suffit a supprimer le trigger ; on droppe explicitement le trigger par hygiene avant la table). Il ne touche JAMAIS `set_updated_at_column()` ni `app_can_access_tenant()`. *Solution* : revue de code du `down()`.
8. **expert_designations versus insure_experts** : ne jamais confondre. `expert_designations` (renommee `insure_expert_assignments` en 2.5.5) est transactionnel et appartient au Sprint 7.5a. `insure_experts` est le catalogue, livre ICI. La tache 2.5.4 ne modifie pas `expert_designations`. *Solution* : aucune instruction SQL ne mentionne `expert_designations` dans cette migration.
9. **UNIQUE global sur acaps_agrement_number** : c'est une unicite cross-tenant volontaire (registre national, cf. 2.3). Ne pas la transformer en `UNIQUE (tenant_id, acaps_agrement_number)` par reflexe multi-tenant. *Solution* : la contrainte UNIQUE porte sur la seule colonne `acaps_agrement_number`.
10. **RLS ENABLE + FORCE** : il faut les deux. `ENABLE ROW LEVEL SECURITY` active les policies pour les roles non-proprietaires ; `FORCE ROW LEVEL SECURITY` les applique meme au proprietaire de la table (sinon les migrations executees en owner contourneraient l'isolation). La policy unique `insure_experts_tenant_isolation` couvre toutes les commandes (`FOR ALL`) via `USING (app_can_access_tenant(tenant_id))`. *Solution* : verifier `relrowsecurity = t` ET `relforcerowsecurity = t`.
11. **GRANT au role applicatif** : le role `insurtech_app` doit recevoir `SELECT, INSERT, UPDATE, DELETE` sur la table. Sans GRANT, l'application (qui se connecte en `insurtech_app`, pas en owner) recoit "permission denied". *Solution* : verifier `role_table_grants`.
12. **Index partiel carrier_internal avec predicat** : `idx_insure_experts_carrier_internal (carrier_tenant_id) WHERE expert_type = 'carrier_internal'` est un index PARTIEL. Oublier la clause `WHERE` indexerait inutilement les milliers d'experts non-internes ayant `carrier_tenant_id` NULL. *Solution* : verifier la presence de `WHERE (expert_type = 'carrier_internal')` dans `indexdef`.
13. **numeric mappe en string cote TypeScript** : le pilote `pg`/TypeORM renvoie les colonnes `numeric` comme des chaines pour preserver la precision arbitraire. Mapper `avg_rating` ou `baseline_honoraire_mad` en `number` exposerait a des erreurs de virgule flottante sur des montants MAD. *Solution* : typer ces proprietes en `string` dans l'entite ; ne convertir via `Number(...)` que dans les assertions de test.
14. **DEFAULT sur les colonnes text[]** : le DEFAULT des tableaux est `'{}'` (litteral de tableau vide), pas `ARRAY[]` ni `NULL`. Combine avec `NOT NULL`, cela garantit qu'un INSERT omettant `acaps_specialty`/`active_zones` produit un tableau vide non NULL, simplifiant les operateurs GIN (jamais de NULL a gerer). *Solution* : verifier dans le DDL `text[] NOT NULL DEFAULT '{}'`.

### 2.9. Decisions architecturales liees

- **decision-012** : la couche transactionnelle des designations (`expert_designations`) a ete livree au Sprint 7.5a ; le renommage vers `insure_expert_assignments` est planifie (tache 2.5.5) pour homogeneiser le prefixe `insure_` du vertical Assurflow.
- **decision-013** : le catalogue des experts est une table de fondation dediee `insure_experts`, distincte de la table transactionnelle, alimentee par un workflow KYB au Sprint 14. La presente tache 2.5.4 materialise cette decision au niveau persistant.
- **Preview Sprint 14** : implementation service (CRUD, KYB, recherche, scoring, basculement `expired_agrement`).

### 2.10. Modele de donnees des metriques agregees

Les quatre colonnes de metriques (`total_missions`, `avg_rating`, `avg_response_time_hours`, `baseline_honoraire_mad`) materialisent un cache de projection alimente par le Sprint 14. Leur semantique precise :

- `total_missions integer NOT NULL DEFAULT 0` : nombre cumule de missions cloturees portees par l'expert, recalcule par agregation sur `insure_expert_assignments`. Type `integer` suffisant (un expert depasse rarement quelques milliers de missions sur sa carriere).
- `avg_rating numeric(3,2) NOT NULL DEFAULT 0` : note moyenne sur une echelle 0.00 a 5.00 ; precision 3, echelle 2 (deux decimales). Renvoye en `string` cote TypeScript.
- `avg_response_time_hours numeric(8,2) NOT NULL DEFAULT 0` : delai moyen de reponse a une designation, en heures ; precision 8 autorise jusqu'a 999999.99 heures (marge confortable).
- `baseline_honoraire_mad numeric(12,2) NOT NULL DEFAULT 0` : honoraire de reference indicatif en dirhams marocains ; precision 12, echelle 2, soit jusqu'a 9 999 999 999.99 MAD. C'est un montant : il ne doit JAMAIS etre mappe en `number` cote applicatif (cf. piege 13).

Toutes ces metriques ont un DEFAULT a 0 et sont `NOT NULL` : un expert nouvellement insere (en `pending_kyb`) a des metriques nulles parfaitement coherentes, sans NULL a gerer dans les tris et les agregations. Le recalcul nightly du Sprint 14 met a jour ces colonnes ; entre deux recalculs, une legere desynchronisation est toleree (cf. Alternative B).

## 3. Contexte etendu (suite) -- positionnement dans la chaine de fondation

La tache 2.5.4 est la **quatrieme** migration de fondation sur les neuf prevues par le Sprint 7.5b (position 4/9). Elle s'inscrit dans la chaine de fondation des entites du domaine expertise du vertical Assurflow. Le catalogue `insure_experts` est le noeud racine ; les tables transactionnelles aval le referencent.

```
                    Sprint 7.5a (livre)
                    +-----------------------+
                    | expert_designations   |  (transactionnel, par sinistre)
                    | -> renomme en 2.5.5   |
                    +-----------+-----------+
                                |
            FK expert_id (etablie en 2.5.5)
                                |
                                v
   2.5.4 (ICI)   +--------------------------------+
   ============> |        insure_experts          |   CATALOGUE / ANNUAIRE
                 |  (id, tenant_id, user_id,      |   une ligne par expert
                 |   acaps_agrement_number UNIQUE,|
                 |   expert_type, status, GIN     |
                 |   specialty/zones, metriques)  |
                 +----------------+---------------+
                                  ^
            +---------------------+----------------------+
            |                                            |
   2.5.5 FK expert_id                          2.5.6 FK expert_id
            |                                            |
 +----------+-----------+                    +-----------+-----------+
 | insure_expert_       |                    | insure_expert_        |
 | assignments (2.5.5)  |                    | reports (2.5.6)       |
 | ex expert_designat.  |                    | rapports d'expertise  |
 +----------------------+                    +-----------------------+
```

Relation a `expert_designations` : la table livree par le Sprint 7.5a porte les designations par sinistre (qui, quand, quel honoraire sur quel dossier). Elle est independante de `insure_experts` jusqu'a la tache 2.5.5 qui ajoute la FK `expert_id`. Avant 2.5.5, les deux tables coexistent sans contrainte referentielle reciproque ; la tache 2.5.4 ne cree donc aucune FK vers/depuis `expert_designations`.

Position dans la roadmap Phase 2 : le Sprint 7.5b est un sprint de fondation intercale (numerotation continue : Phase 2 / Sprint 5) qui pose les tables persistantes du domaine expertise et remorquage (tow) du vertical Assurflow avant l'implementation fonctionnelle des Sprints 14-16. La presente tache 2.5.4 est le pivot du sous-domaine expertise : elle cree le noeud racine (`insure_experts`) dont dependront les FK des taches 2.5.5 (assignments) et 2.5.6 (reports). Sans 2.5.4, ces deux taches ne peuvent etablir leur FK `expert_id`.

### 3.1. Sequence d'application et verification post-migration

Sequence concrete d'execution attendue dans un environnement de developpement :

1. La base est initialisee et toutes les migrations 001 a 012 sont appliquees (helpers Sprint 1, identite Sprint 2, expertise transactionnelle Sprint 7.5a 011/012).
2. `pnpm --filter @insurtech/database run migration:run` execute 013, dont le journal affiche "Migration Sprint75bInsureExperts1735000000013 has been executed successfully".
3. La table `insure_experts` existe avec 28 colonnes, 5 indexes, RLS active (ENABLE + FORCE), une policy, un trigger, un grant et des commentaires.
4. `migration:revert` rejoue le `down()` : la table disparait, la fonction partagee `set_updated_at_column()` reste presente (verifiable via `pg_proc`).
5. Un second `migration:run` recree la table a l'identique (idempotence/reversibilite, critere V35).

Cette sequence est la garantie que la migration s'insere proprement dans la chaine sans casser l'existant et qu'elle est integralement reversible. C'est aussi le scenario exerce par le test de migration (section 7.4, cas up/down/up).

### 3.2. Contrat d'interface vers l'aval

Le contrat que `insure_experts` expose aux taches et sprints aval est stable et minimal :

- Cle primaire `id uuid` : cible des FK `expert_id` des taches 2.5.5 (`insure_expert_assignments`) et 2.5.6 (`insure_expert_reports`).
- Colonne `tenant_id` : garantit que toute jointure aval reste dans le perimetre tenant via RLS.
- Colonnes de recherche `acaps_specialty`, `active_zones`, `status` : socle des requetes de selection/recommandation (Sprint 14-15).
- Colonnes de metriques : alimentees par projection (Sprint 14), lues par recommandation (Sprint 15).

Aucune de ces colonnes ne sera renommee par les taches aval connues ; seules des FK et des tables s'ajouteront en reference. Ce contrat de stabilite est ce qui justifie l'investissement de specification detaillee dans la presente tache.

## 4. Architecture context

Couche d'execution : la migration vit dans le package partage `@insurtech/database` (sources des migrations TypeORM), montee par les services consommateurs au Sprint 14 (`service-experts`, port a definir). Toute lecture/ecriture applicative force le GUC `app.current_tenant_id` via le `TenantTransactionInterceptor` (tache 2.2.4) qui execute `SET LOCAL app.current_tenant_id = '<uuid>'` dans la transaction, ce qui rend la policy RLS `app_can_access_tenant(tenant_id)` operante. Le role de connexion applicatif est `insurtech_app` (decision-008, separation owner/app).

Sequence d'execution des migrations (rappel) : les migrations TypeORM s'executent dans l'ordre croissant strict de leur prefixe numerique, garanti par le tableau ordonne de `migrations/index.ts`. Les prerequis de 013 sont donc : (a) la migration des extensions et helpers RLS du Sprint 1 (tache 1.1.4) qui cree `gen_random_uuid()` via pgcrypto, la fonction `set_updated_at_column()` et la fonction `app_can_access_tenant(uuid)` ainsi que le role `insurtech_app` ; (b) les migrations Identity du Sprint 2 qui creent `auth_tenants` et `auth_users` ; (c) les migrations 011 et 012 du Sprint 7.5a (`expert_designations`, rapports). Aucune de ces dependances n'est recreee par 013 : la migration 013 est volontairement minimale et ne touche qu'a la creation de sa propre table et de ses objets dependants directs (indexes, policy, trigger appelant la fonction partagee, grant, comments).

### 4.1. Detail des invariants persistants

Invariants persistants garantis par cette migration :

- Isolation tenant stricte : aucune ligne `insure_experts` n'est lisible/ecrivable hors du tenant courant (RLS FORCE + policy).
- Integrite referentielle : `tenant_id -> auth_tenants(id) ON DELETE CASCADE` (suppression d'un tenant purge ses experts) ; `user_id -> auth_users(id) ON DELETE RESTRICT` (un expert ne peut perdre son compte utilisateur tant qu'il existe) ; `carrier_tenant_id -> auth_tenants(id)` (sans cascade : la suppression d'une compagnie ne doit pas casser silencieusement le profil) ; `kyb_reviewed_by_user_id -> auth_users(id)` (reviewer KYB).
- Coherence metier : CHECK `expert_type` (4 valeurs), CHECK `status` (5 valeurs), CHECK conditionnel `carrier_internal`.
- Unicite registre national : `acaps_agrement_number` UNIQUE global.
- Recherche performante : 2 indexes GIN (specialite, zones), 1 index statut, 1 index tenant, 1 index partiel carrier.
- Horodatage automatique : `updated_at` mis a jour par trigger a chaque UPDATE ; `created_at` fixe a l'insertion.
- Valeurs par defaut sures : `status = 'pending_kyb'`, `total_missions = 0`, `avg_rating = 0`, `avg_response_time_hours = 0`, `baseline_honoraire_mad = 0`, `acaps_specialty = '{}'`, `active_zones = '{}'`.

### 4.2. Frontiere de responsabilite migration vs service

La migration 2.5.4 est responsable EXCLUSIVEMENT de la structure persistante. Elle ne contient ni logique de transition d'etat KYB, ni calcul de metriques, ni job de bascule `expired_agrement`, ni validation Zod, ni endpoint. Ces responsabilites sont explicitement deleguees au Sprint 14 (`service-experts`). Cette frontiere claire evite que la migration n'embarque du code metier difficile a versionner et a reverser, et garantit que le `down()` reste un simple `DROP TABLE` sans effet de bord sur des objets partages.

### 4.3. Strategie d'indexation detaillee et profil de requete

Le choix des cinq indexes n'est pas arbitraire : il decoule des cinq familles de requetes attendues au Sprint 14-16.

| Index | Type | Colonnes | Requete cible | Justification |
|---|---|---|---|---|
| `idx_insure_experts_tenant` | B-tree | `(tenant_id)` | Scan/listing par tenant | Toutes les requetes RLS filtrent implicitement par tenant ; l'index acclere la verification de la policy et les listings full-tenant. |
| `idx_insure_experts_status` | B-tree | `(status)` | Filtre `WHERE status = 'active'` | Les listings et le job de basculement `expired_agrement` filtrent massivement sur `status` ; cardinalite faible mais selectivite utile combinee au tenant. |
| `idx_insure_experts_specialty` | GIN | `(acaps_specialty)` | `acaps_specialty @> ARRAY[...]` | Recherche par specialite ACAPS ; seul GIN indexe le contenu d'un `text[]`. |
| `idx_insure_experts_zones` | GIN | `(active_zones)` | `active_zones && ARRAY[...]` | Recherche par chevauchement de zones d'intervention ; operateur overlap accelere par GIN. |
| `idx_insure_experts_carrier_internal` | B-tree partiel | `(carrier_tenant_id) WHERE expert_type = 'carrier_internal'` | Tableaux de bord compagnie (Sprint 16) | Index partiel : seuls les experts internes ont un `carrier_tenant_id` pertinent ; evite d'indexer les milliers de lignes a `carrier_tenant_id` NULL. |

Aucun index composite n'est pose en V1 : la combinaison `(tenant_id, status)` pourrait etre envisagee au Sprint 14 si le plan d'execution montre un besoin, mais on evite l'optimisation prematuree. Les index GIN n'ont pas de notion d'ordre, donc tout `ORDER BY` (par exemple `avg_rating DESC`) reste un tri post-filtrage ; pour les volumes attendus (catalogue de quelques milliers d'experts par tenant), cela est parfaitement acceptable.

### 4.4. Interaction RLS, policy et GUC de transaction

La policy `insure_experts_tenant_isolation` est de type `FOR ALL` (SELECT, INSERT, UPDATE, DELETE) et n'utilise qu'une clause `USING`. Sans clause `WITH CHECK` explicite, Postgres applique la clause `USING` egalement comme `WITH CHECK` pour les INSERT et UPDATE : une ligne ne peut etre inseree ou modifiee que si `app_can_access_tenant(tenant_id)` est vrai pour le tenant courant. Concretement, un INSERT dont le `tenant_id` ne correspond pas au GUC `app.current_tenant_id` est rejete avec "new row violates row-level security policy". Cette symetrie `USING`/`WITH CHECK` implicite est volontaire : elle empeche aussi bien la lecture que l'ecriture cross-tenant sans avoir a dupliquer la condition.

Le helper `app_can_access_tenant(uuid)` (Sprint 1) lit le GUC `app.current_tenant_id` positionne par `SET LOCAL` dans la transaction applicative (via `TenantTransactionInterceptor`). Le `SET LOCAL` est essentiel : il limite la portee du GUC a la transaction courante, evitant toute fuite de contexte entre requetes reutilisant la meme connexion du pool. Une connexion sans `SET LOCAL` (GUC absent) voit la policy echouer de maniere fermee (aucune ligne accessible), ce qui est le comportement sur attendu : en cas de doute, on ne montre rien.

## 5. Livrables checkables

- [ ] Migration `1735000000013-Sprint75bInsureExperts.ts` creee dans le package `@insurtech/database` (repertoire des migrations), classe exportee `Sprint75bInsureExperts1735000000013 implements MigrationInterface`.
- [ ] Methode `up(queryRunner)` : `CREATE TABLE insure_experts` avec les 28 colonnes exactes, PRIMARY KEY, toutes les FK (auth_tenants/auth_users), les CHECK (`expert_type`, `status`, `chk_insure_experts_carrier_internal`), l'UNIQUE sur `acaps_agrement_number`, les DEFAULT.
- [ ] Methode `up()` : creation des 5 indexes (`idx_insure_experts_tenant`, `idx_insure_experts_status`, `idx_insure_experts_specialty` GIN, `idx_insure_experts_zones` GIN, `idx_insure_experts_carrier_internal` partiel).
- [ ] Methode `up()` : `ALTER TABLE insure_experts ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`.
- [ ] Methode `up()` : `CREATE POLICY insure_experts_tenant_isolation ON insure_experts FOR ALL USING (app_can_access_tenant(tenant_id))`.
- [ ] Methode `up()` : `CREATE TRIGGER trg_insure_experts_updated_at BEFORE UPDATE ON insure_experts FOR EACH ROW EXECUTE FUNCTION set_updated_at_column()` (fonction NON recreee).
- [ ] Methode `up()` : `GRANT SELECT, INSERT, UPDATE, DELETE ON insure_experts TO insurtech_app`.
- [ ] Methode `up()` : `COMMENT ON TABLE` et `COMMENT ON COLUMN` documentaires (au moins sur la table et les colonnes sensibles PII et la regle carrier_internal).
- [ ] Methode `down(queryRunner)` : `DROP TRIGGER IF EXISTS trg_insure_experts_updated_at ON insure_experts` puis `DROP TABLE IF EXISTS insure_experts`. AUCUN drop de `set_updated_at_column()` ni `app_can_access_tenant()`.
- [ ] La migration est idempotente sur replay (sequence up -> down -> up sans erreur).
- [ ] Test de migration `1735000000013-Sprint75bInsureExperts.spec.ts` : verifie up cree la table, down la supprime, up/down/up est reversible.
- [ ] Test d'integration `insure-experts.integration.spec.ts` : insertion valide d'un expert independent.
- [ ] Test d'integration : insertion `carrier_internal` SANS `carrier_tenant_id` rejetee par CHECK.
- [ ] Test d'integration : insertion `carrier_internal` AVEC `carrier_tenant_id` acceptee.
- [ ] Test d'integration : double insertion du meme `acaps_agrement_number` rejetee (UNIQUE).
- [ ] Test d'integration : violation CHECK `expert_type` hors enum rejetee.
- [ ] Test d'integration : violation CHECK `status` hors enum rejetee.
- [ ] Test d'integration : isolation RLS entre 2 tenants (tenant A ne voit pas l'expert du tenant B).
- [ ] Test d'integration : recherche GIN par specialite (`acaps_specialty @> ARRAY['auto']`) retourne les bons experts.
- [ ] Test d'integration : recherche GIN par zone (`active_zones && ARRAY['casablanca']`) retourne les bons experts.
- [ ] Test d'integration : FK `user_id` ON DELETE RESTRICT empeche la suppression d'un user reference.
- [ ] Test d'integration : FK `tenant_id` ON DELETE CASCADE purge les experts a la suppression du tenant.
- [ ] Test d'integration : trigger `updated_at` modifie l'horodatage a l'UPDATE.
- [ ] Test d'integration : DEFAULT `status = 'pending_kyb'`, `total_missions = 0`, `acaps_specialty = '{}'` appliques.
- [ ] Entite TypeORM `insure-expert.entity.ts` (squelette 2.5.1) alignee colonne par colonne avec le DDL (verifie dans la doc, section 7).
- [ ] Fragment SQL documentaire ajoute a la doc du package database.
- [ ] Tous les fichiers passent `check-no-emoji.sh`, `tsc --noEmit`, `biome check`, et la suite Vitest >= 85% de couverture.

## 6. Fichiers crees / modifies

| Fichier | Action | Description |
|---|---|---|
| `packages/database/src/migrations/1735000000013-Sprint75bInsureExperts.ts` | cree | Migration TypeORM (up/down) creant `insure_experts`, indexes, RLS, policy, trigger, grant, comments. |
| `packages/database/src/migrations/__tests__/1735000000013-Sprint75bInsureExperts.spec.ts` | cree | Test unitaire de la migration (up cree, down supprime, reversibilite). |
| `packages/database/src/entities/insure-expert.entity.ts` | modifie | Alignement de l'entite squelette (issue de 2.5.1) avec le DDL final (colonnes, types, defaults, enums). |
| `packages/database/test/integration/insure-experts.integration.spec.ts` | cree | Tests d'integration Postgres reel (insert, CHECK, UNIQUE, RLS, GIN, FK, trigger, defaults). |
| `packages/database/docs/schema/insure_experts.md` | cree | Fragment de documentation SQL (DDL annote, regles metier, index, RLS). |
| `packages/database/src/migrations/index.ts` | modifie | Ajout de l'export de la migration `Sprint75bInsureExperts1735000000013` dans le tableau ordonne. |

Dependances et impacts inter-fichiers de cette tache :

- La migration `1735000000013-Sprint75bInsureExperts.ts` est la seule source de verite du schema ; tout autre fichier doit s'y aligner.
- L'entite `insure-expert.entity.ts` reflete le DDL colonne par colonne (28 proprietes) ; toute divergence casse `tsc` ou les tests d'integration.
- Le fichier `index.ts` enregistre la classe dans le tableau ordonne ; sans cet enregistrement, la DataSource n'execute jamais la migration.
- Le test de migration valide la structure (table, indexes, RLS, policy, trigger, grant, reversibilite).
- Le test d'integration valide le comportement runtime (contraintes, RLS, GIN, FK, defaults) sur Postgres reel.
- Le fragment de documentation `insure_experts.md` sert de reference operationnelle aux equipes aval (Sprint 14-16).

Aucun fichier hors de ce tableau n'est touche par la tache 2.5.4 ; en particulier, `expert_designations` et ses fichiers associes ne sont pas modifies (cf. piege 8).

## 7. Code patterns complets

### 7.1. Migration complete (up + down)

Fichier : `packages/database/src/migrations/1735000000013-Sprint75bInsureExperts.ts`

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 7.5b -- Tache 2.5.4
 * Catalogue (annuaire) des experts en assurance du vertical Assurflow.
 * COMPLEMENT de expert_designations (Sprint 7.5a, transactionnel par sinistre).
 * Decision-013 : le catalogue est une table de fondation dediee.
 * Numerotation : le Sprint 7.5a a consomme 011 et 012 ; ici 013.
 * Reutilise la fonction partagee set_updated_at_column() (Sprint 1) -- NE PAS la recreer.
 * RLS : ENABLE + FORCE + policy app_can_access_tenant(tenant_id).
 */
export class Sprint75bInsureExperts1735000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table catalogue des experts.
    await queryRunner.query(`
      CREATE TABLE insure_experts (
        id                            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                     uuid          NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id                       uuid          NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        full_name                     varchar(255)  NOT NULL,
        cin_number                    varchar(20)   NOT NULL,
        cin_document_url              text          NOT NULL,
        phone                         varchar(20)   NOT NULL,
        email                         varchar(255)  NOT NULL,
        acaps_agrement_number         varchar(50)   NOT NULL UNIQUE,
        acaps_agrement_document_url   text          NOT NULL,
        acaps_agrement_expiry_date    date          NOT NULL,
        acaps_specialty               text[]        NOT NULL DEFAULT '{}',
        firm_name                     varchar(255),
        firm_ice                      varchar(15),
        expert_type                   varchar(50)   NOT NULL
                                        CHECK (expert_type IN ('independent', 'firm_admin', 'associate', 'carrier_internal')),
        carrier_tenant_id             uuid          REFERENCES auth_tenants(id),
        active_zones                  text[]        NOT NULL DEFAULT '{}',
        total_missions                integer       NOT NULL DEFAULT 0,
        avg_rating                    numeric(3,2)  NOT NULL DEFAULT 0,
        avg_response_time_hours       numeric(8,2)  NOT NULL DEFAULT 0,
        baseline_honoraire_mad        numeric(12,2) NOT NULL DEFAULT 0,
        status                        varchar(50)   NOT NULL DEFAULT 'pending_kyb'
                                        CHECK (status IN ('active', 'pending_kyb', 'suspended', 'expired_agrement', 'inactive')),
        kyb_reviewed_at               timestamptz,
        kyb_reviewed_by_user_id       uuid          REFERENCES auth_users(id),
        kyb_rejection_reason          text,
        notes                         text,
        created_at                    timestamptz   NOT NULL DEFAULT now(),
        updated_at                    timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT chk_insure_experts_carrier_internal
          CHECK (
            (expert_type = 'carrier_internal' AND carrier_tenant_id IS NOT NULL)
            OR (expert_type <> 'carrier_internal')
          )
      );
    `);

    // 2. Indexes.
    await queryRunner.query(`CREATE INDEX idx_insure_experts_tenant ON insure_experts (tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_insure_experts_status ON insure_experts (status);`);
    await queryRunner.query(`CREATE INDEX idx_insure_experts_specialty ON insure_experts USING GIN (acaps_specialty);`);
    await queryRunner.query(`CREATE INDEX idx_insure_experts_zones ON insure_experts USING GIN (active_zones);`);
    await queryRunner.query(`
      CREATE INDEX idx_insure_experts_carrier_internal
        ON insure_experts (carrier_tenant_id)
        WHERE expert_type = 'carrier_internal';
    `);

    // 3. RLS : ENABLE + FORCE (FORCE applique meme au proprietaire de la table).
    await queryRunner.query(`ALTER TABLE insure_experts ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE insure_experts FORCE ROW LEVEL SECURITY;`);

    // 4. Policy d'isolation tenant (couvre toutes les commandes via FOR ALL).
    await queryRunner.query(`
      CREATE POLICY insure_experts_tenant_isolation
        ON insure_experts
        FOR ALL
        USING (app_can_access_tenant(tenant_id));
    `);

    // 5. Trigger updated_at -- REUTILISE la fonction partagee set_updated_at_column() (Sprint 1).
    await queryRunner.query(`
      CREATE TRIGGER trg_insure_experts_updated_at
        BEFORE UPDATE ON insure_experts
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_column();
    `);

    // 6. GRANT au role applicatif (l'app se connecte en insurtech_app, pas en owner).
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON insure_experts TO insurtech_app;`);

    // 7. Documentation.
    await queryRunner.query(`COMMENT ON TABLE insure_experts IS 'Catalogue (annuaire) des experts en assurance Assurflow. Complement de expert_designations (transactionnel). Decision-013.';`);
    await queryRunner.query(`COMMENT ON COLUMN insure_experts.cin_number IS 'CIN expert -- donnee PII RGPD-MA Loi 09-08, isolation RLS obligatoire.';`);
    await queryRunner.query(`COMMENT ON COLUMN insure_experts.acaps_agrement_number IS 'Numero agrement ACAPS -- unique au niveau national (registre public), UNIQUE global volontaire.';`);
    await queryRunner.query(`COMMENT ON COLUMN insure_experts.acaps_agrement_expiry_date IS 'Date expiration agrement ACAPS ; bascule vers status expired_agrement via job nightly (Sprint 14).';`);
    await queryRunner.query(`COMMENT ON COLUMN insure_experts.expert_type IS 'independent | firm_admin | associate | carrier_internal. carrier_internal exige carrier_tenant_id (chk_insure_experts_carrier_internal).';`);
    await queryRunner.query(`COMMENT ON COLUMN insure_experts.carrier_tenant_id IS 'Compagnie de rattachement (tenant) pour les experts internes ; obligatoire si expert_type = carrier_internal.';`);
    await queryRunner.query(`COMMENT ON COLUMN insure_experts.status IS 'active | pending_kyb | suspended | expired_agrement | inactive. Defaut pending_kyb (workflow KYB Sprint 14).';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordre : trigger puis table. NE JAMAIS dropper set_updated_at_column() (fonction partagee Sprint 1).
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_insure_experts_updated_at ON insure_experts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS insure_experts;`);
    // La policy, les indexes, le grant et les comments sont supprimes en cascade par DROP TABLE.
  }
}
```

Note sur l'atomicite : TypeORM execute chaque migration dans une transaction unique par defaut (sauf desactivation explicite via `transaction: false`). L'ensemble du `up()` est donc atomique : si l'une des sept etapes echoue, l'integralite est annulee et la table n'existe pas a moitie creee. Le `DROP TABLE IF EXISTS` du `down()` est idempotent et tolere une table absente, ce qui rend le revert sur sur une migration partiellement appliquee.

### 7.2. Enregistrement dans l'index ordonne des migrations

Fichier : `packages/database/src/migrations/index.ts` (extrait, ajout en fin de tableau apres les migrations 011 et 012 du Sprint 7.5a)

```typescript
import { Sprint75aExpertDesignations1735000000011 } from './1735000000011-Sprint75aExpertDesignations';
import { Sprint75aExpertReports1735000000012 } from './1735000000012-Sprint75aExpertReports';
import { Sprint75bInsureExperts1735000000013 } from './1735000000013-Sprint75bInsureExperts';

/**
 * Tableau ordonne des migrations consomme par la DataSource TypeORM.
 * L'ordre est strictement croissant par timestamp ; 013 suit 012 (Sprint 7.5a).
 */
export const migrations = [
  // ... migrations precedentes ...
  Sprint75aExpertDesignations1735000000011,
  Sprint75aExpertReports1735000000012,
  Sprint75bInsureExperts1735000000013,
] as const;
```

### 7.3. Entite TypeORM alignee

Fichier : `packages/database/src/entities/insure-expert.entity.ts` (alignement du squelette 2.5.1 avec le DDL)

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catalogue des experts Assurflow (decision-013).
 * Alignee 1:1 avec la migration 1735000000013-Sprint75bInsureExperts.
 * Service applicatif (CRUD/KYB/recherche) deleguee au Sprint 14.
 */
export type ExpertType = 'independent' | 'firm_admin' | 'associate' | 'carrier_internal';
export type ExpertStatus = 'active' | 'pending_kyb' | 'suspended' | 'expired_agrement' | 'inactive';

@Entity({ name: 'insure_experts' })
@Index('idx_insure_experts_tenant', ['tenantId'])
@Index('idx_insure_experts_status', ['status'])
export class InsureExpert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'cin_number', type: 'varchar', length: 20 })
  cinNumber!: string;

  @Column({ name: 'cin_document_url', type: 'text' })
  cinDocumentUrl!: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone!: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'acaps_agrement_number', type: 'varchar', length: 50, unique: true })
  acapsAgrementNumber!: string;

  @Column({ name: 'acaps_agrement_document_url', type: 'text' })
  acapsAgrementDocumentUrl!: string;

  @Column({ name: 'acaps_agrement_expiry_date', type: 'date' })
  acapsAgrementExpiryDate!: string;

  @Column({ name: 'acaps_specialty', type: 'text', array: true, default: () => `'{}'` })
  acapsSpecialty!: string[];

  @Column({ name: 'firm_name', type: 'varchar', length: 255, nullable: true })
  firmName!: string | null;

  @Column({ name: 'firm_ice', type: 'varchar', length: 15, nullable: true })
  firmIce!: string | null;

  @Column({ name: 'expert_type', type: 'varchar', length: 50 })
  expertType!: ExpertType;

  @Column({ name: 'carrier_tenant_id', type: 'uuid', nullable: true })
  carrierTenantId!: string | null;

  @Column({ name: 'active_zones', type: 'text', array: true, default: () => `'{}'` })
  activeZones!: string[];

  @Column({ name: 'total_missions', type: 'integer', default: 0 })
  totalMissions!: number;

  @Column({ name: 'avg_rating', type: 'numeric', precision: 3, scale: 2, default: 0 })
  avgRating!: string;

  @Column({ name: 'avg_response_time_hours', type: 'numeric', precision: 8, scale: 2, default: 0 })
  avgResponseTimeHours!: string;

  @Column({ name: 'baseline_honoraire_mad', type: 'numeric', precision: 12, scale: 2, default: 0 })
  baselineHonoraireMad!: string;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'pending_kyb' })
  status!: ExpertStatus;

  @Column({ name: 'kyb_reviewed_at', type: 'timestamptz', nullable: true })
  kybReviewedAt!: Date | null;

  @Column({ name: 'kyb_reviewed_by_user_id', type: 'uuid', nullable: true })
  kybReviewedByUserId!: string | null;

  @Column({ name: 'kyb_rejection_reason', type: 'text', nullable: true })
  kybRejectionReason!: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Tableau d'alignement DDL <-> entite (controle exhaustif) :

| Colonne SQL | Type SQL | Propriete entite | Type TS |
|---|---|---|---|
| id | uuid PK | id | string |
| tenant_id | uuid NOT NULL | tenantId | string |
| user_id | uuid NOT NULL | userId | string |
| full_name | varchar(255) | fullName | string |
| cin_number | varchar(20) | cinNumber | string |
| cin_document_url | text | cinDocumentUrl | string |
| phone | varchar(20) | phone | string |
| email | varchar(255) | email | string |
| acaps_agrement_number | varchar(50) UNIQUE | acapsAgrementNumber | string |
| acaps_agrement_document_url | text | acapsAgrementDocumentUrl | string |
| acaps_agrement_expiry_date | date | acapsAgrementExpiryDate | string |
| acaps_specialty | text[] | acapsSpecialty | string[] |
| firm_name | varchar(255) NULL | firmName | string \| null |
| firm_ice | varchar(15) NULL | firmIce | string \| null |
| expert_type | varchar(50) CHECK | expertType | ExpertType |
| carrier_tenant_id | uuid NULL | carrierTenantId | string \| null |
| active_zones | text[] | activeZones | string[] |
| total_missions | integer | totalMissions | number |
| avg_rating | numeric(3,2) | avgRating | string |
| avg_response_time_hours | numeric(8,2) | avgResponseTimeHours | string |
| baseline_honoraire_mad | numeric(12,2) | baselineHonoraireMad | string |
| status | varchar(50) CHECK | status | ExpertStatus |
| kyb_reviewed_at | timestamptz NULL | kybReviewedAt | Date \| null |
| kyb_reviewed_by_user_id | uuid NULL | kybReviewedByUserId | string \| null |
| kyb_rejection_reason | text NULL | kybRejectionReason | string \| null |
| notes | text NULL | notes | string \| null |
| created_at | timestamptz | createdAt | Date |
| updated_at | timestamptz | updatedAt | Date |

Note : les `numeric` sont mappes en `string` cote TypeScript (TypeORM/pg renvoie les numeric en chaine pour preserver la precision arbitraire ; ne jamais mapper en `number` un montant MAD au risque d'erreurs de virgule flottante).

### 7.4. Test de migration (up/down/reversibilite)

Fichier : `packages/database/src/migrations/__tests__/1735000000013-Sprint75bInsureExperts.spec.ts`

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { Sprint75bInsureExperts1735000000013 } from '../1735000000013-Sprint75bInsureExperts';
import { buildTestDataSource } from '../../../test/helpers/test-datasource';

describe('Migration 1735000000013-Sprint75bInsureExperts', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // buildTestDataSource applique toutes les migrations jusqu'a 012 (prerequis :
    // auth_tenants, auth_users, set_updated_at_column(), app_can_access_tenant(), role insurtech_app).
    dataSource = await buildTestDataSource({ runMigrationsUpTo: '1735000000012' });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  async function tableExists(name: string): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists;`,
      [name],
    );
    return rows[0]?.exists === true;
  }

  it('up() cree la table insure_experts', async () => {
    const runner = dataSource.createQueryRunner();
    const migration = new Sprint75bInsureExperts1735000000013();
    await migration.up(runner);
    await runner.release();
    expect(await tableExists('insure_experts')).toBe(true);
  });

  it('cree les 28 colonnes attendues', async () => {
    const rows: Array<{ count: string }> = await dataSource.query(
      `SELECT count(*)::text AS count FROM information_schema.columns WHERE table_name = 'insure_experts';`,
    );
    expect(Number(rows[0]?.count)).toBe(28);
  });

  it('cree les 5 indexes attendus', async () => {
    const rows: Array<{ indexname: string }> = await dataSource.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'insure_experts';`,
    );
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'idx_insure_experts_tenant',
        'idx_insure_experts_status',
        'idx_insure_experts_specialty',
        'idx_insure_experts_zones',
        'idx_insure_experts_carrier_internal',
      ]),
    );
  });

  it('les indexes specialty et zones sont en GIN', async () => {
    const rows: Array<{ indexname: string; indexdef: string }> = await dataSource.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE indexname IN ('idx_insure_experts_specialty', 'idx_insure_experts_zones');`,
    );
    for (const r of rows) {
      expect(r.indexdef.toLowerCase()).toContain('using gin');
    }
  });

  it('l index carrier_internal est partiel (clause WHERE)', async () => {
    const rows: Array<{ indexdef: string }> = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_insure_experts_carrier_internal';`,
    );
    expect(rows[0]?.indexdef.toLowerCase()).toContain("where (expert_type = 'carrier_internal'");
  });

  it('active RLS ENABLE et FORCE', async () => {
    const rows: Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await dataSource.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'insure_experts';`,
      );
    expect(rows[0]?.relrowsecurity).toBe(true);
    expect(rows[0]?.relforcerowsecurity).toBe(true);
  });

  it('cree la policy insure_experts_tenant_isolation', async () => {
    const rows: Array<{ policyname: string }> = await dataSource.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'insure_experts';`,
    );
    expect(rows.map((r) => r.policyname)).toContain('insure_experts_tenant_isolation');
  });

  it('cree le trigger trg_insure_experts_updated_at reutilisant set_updated_at_column', async () => {
    const rows: Array<{ tgname: string }> = await dataSource.query(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'insure_experts'::regclass AND NOT tgisinternal;`,
    );
    expect(rows.map((r) => r.tgname)).toContain('trg_insure_experts_updated_at');
    // La fonction partagee doit toujours exister (non recreee, non supprimee).
    const fn: Array<{ exists: boolean }> = await dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column') AS exists;`,
    );
    expect(fn[0]?.exists).toBe(true);
  });

  it('accorde les privileges au role insurtech_app', async () => {
    const rows: Array<{ privilege_type: string }> = await dataSource.query(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_name = 'insure_experts' AND grantee = 'insurtech_app';`,
    );
    const privileges = rows.map((r) => r.privilege_type);
    expect(privileges).toEqual(
      expect.arrayContaining(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
    );
  });

  it('down() supprime la table mais conserve set_updated_at_column', async () => {
    const runner = dataSource.createQueryRunner();
    const migration = new Sprint75bInsureExperts1735000000013();
    await migration.down(runner);
    await runner.release();
    expect(await tableExists('insure_experts')).toBe(false);
    const fn: Array<{ exists: boolean }> = await dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column') AS exists;`,
    );
    expect(fn[0]?.exists).toBe(true);
  });

  it('up -> down -> up est idempotent et reversible', async () => {
    const migration = new Sprint75bInsureExperts1735000000013();
    const r1 = dataSource.createQueryRunner();
    await migration.up(r1);
    await r1.release();
    expect(await tableExists('insure_experts')).toBe(true);
    const r2 = dataSource.createQueryRunner();
    await migration.down(r2);
    await r2.release();
    expect(await tableExists('insure_experts')).toBe(false);
    const r3 = dataSource.createQueryRunner();
    await migration.up(r3);
    await r3.release();
    expect(await tableExists('insure_experts')).toBe(true);
  });
});
```

### 7.5. Tests d'integration (harnais Postgres reel)

Fichier : `packages/database/test/integration/insure-experts.integration.spec.ts`

```typescript
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DataSource, type QueryRunner } from 'typeorm';
import { buildTestDataSource } from '../helpers/test-datasource';
import { seedTenant, seedUser } from '../helpers/auth-seeds';

/**
 * Tests d'integration de la table catalogue insure_experts.
 * Harnais : Postgres 16 reel ; isolation tenant via SET LOCAL app.current_tenant_id.
 * Connexion en role insurtech_app pour eprouver RLS FORCE et les GRANT.
 */
describe('insure_experts (integration)', () => {
  let dataSource: DataSource;
  let tenantA: string;
  let tenantB: string;
  let carrierTenant: string;
  let userA: string;
  let userB: string;
  let reviewerA: string;

  beforeAll(async () => {
    dataSource = await buildTestDataSource({ runMigrationsUpTo: '1735000000013', role: 'insurtech_app' });
    tenantA = await seedTenant(dataSource, 'Cabinet Casablanca');
    tenantB = await seedTenant(dataSource, 'Cabinet Rabat');
    carrierTenant = await seedTenant(dataSource, 'Compagnie Atlanta');
    userA = await seedUser(dataSource, tenantA, 'expert.a@example.ma');
    userB = await seedUser(dataSource, tenantB, 'expert.b@example.ma');
    reviewerA = await seedUser(dataSource, tenantA, 'reviewer.a@example.ma');
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  afterEach(async () => {
    // Nettoyage en owner pour contourner RLS lors du teardown.
    await dataSource.query(`SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000';`);
    await dataSource.query(`DELETE FROM insure_experts WHERE true;`);
  });

  /** Execute une fonction au sein d'une transaction avec le GUC tenant positionne. */
  async function withTenant<T>(tenantId: string, fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = dataSource.createQueryRunner();
    await qr.startTransaction();
    try {
      await qr.query(`SET LOCAL app.current_tenant_id = '${tenantId}';`);
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  function insertSql(): string {
    return `
      INSERT INTO insure_experts
        (tenant_id, user_id, full_name, cin_number, cin_document_url, phone, email,
         acaps_agrement_number, acaps_agrement_document_url, acaps_agrement_expiry_date,
         acaps_specialty, expert_type, carrier_tenant_id, active_zones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id, status, total_missions, acaps_specialty, avg_rating;
    `;
  }

  it('insere un expert independent valide avec defaults', async () => {
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Karim Bennani', 'AB123456', 'https://s3/cin/a.pdf',
        '+212600000001', 'karim@example.ma', 'ACAPS-EXP-0001', 'https://s3/agr/a.pdf',
        '2030-12-31', ['auto'], 'independent', null, ['casablanca', 'mohammedia'],
      ]),
    );
    expect(rows[0].status).toBe('pending_kyb');
    expect(rows[0].total_missions).toBe(0);
    expect(rows[0].acaps_specialty).toEqual(['auto']);
    expect(Number(rows[0].avg_rating)).toBe(0);
  });

  it('insere un expert firm_admin avec firm_name et firm_ice', async () => {
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(
        `INSERT INTO insure_experts
          (tenant_id, user_id, full_name, cin_number, cin_document_url, phone, email,
           acaps_agrement_number, acaps_agrement_document_url, acaps_agrement_expiry_date,
           firm_name, firm_ice, expert_type, active_zones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id;`,
        [
          tenantA, userA, 'Nadia Alaoui', 'XY010203', 'https://s3/cin/fa.pdf',
          '+212600000100', 'nadia@example.ma', 'ACAPS-EXP-FA01', 'https://s3/agr/fa.pdf',
          '2031-03-31', 'Cabinet Alaoui Expertise', '001234567000089', 'firm_admin', ['rabat'],
        ],
      ),
    );
    expect(rows[0].id).toBeDefined();
  });

  it('rejette carrier_internal SANS carrier_tenant_id (CHECK conditionnel)', async () => {
    await expect(
      withTenant(tenantA, (qr) =>
        qr.query(insertSql(), [
          tenantA, userA, 'Salwa Idrissi', 'CD222333', 'https://s3/cin/c.pdf',
          '+212600000002', 'salwa@example.ma', 'ACAPS-EXP-0002', 'https://s3/agr/c.pdf',
          '2029-06-30', ['incendie'], 'carrier_internal', null, ['rabat'],
        ]),
      ),
    ).rejects.toThrow(/chk_insure_experts_carrier_internal/);
  });

  it('accepte carrier_internal AVEC carrier_tenant_id', async () => {
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Salwa Idrissi', 'CD222333', 'https://s3/cin/c.pdf',
        '+212600000002', 'salwa@example.ma', 'ACAPS-EXP-0003', 'https://s3/agr/c.pdf',
        '2029-06-30', ['incendie'], 'carrier_internal', carrierTenant, ['rabat'],
      ]),
    );
    expect(rows[0].id).toBeDefined();
  });

  it('accepte un independent AVEC carrier_tenant_id NULL (CHECK permissif)', async () => {
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Independant Libre', 'ZZ999888', 'https://s3/cin/il.pdf',
        '+212600000200', 'libre@example.ma', 'ACAPS-EXP-IL01', 'https://s3/agr/il.pdf',
        '2030-01-01', ['rc'], 'independent', null, ['fes'],
      ]),
    );
    expect(rows[0].id).toBeDefined();
  });

  it('rejette un acaps_agrement_number duplique (UNIQUE global)', async () => {
    await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Expert Un', 'EF444555', 'https://s3/cin/d.pdf',
        '+212600000003', 'un@example.ma', 'ACAPS-EXP-DUP', 'https://s3/agr/d.pdf',
        '2031-01-01', ['auto'], 'independent', null, ['fes'],
      ]),
    );
    await expect(
      withTenant(tenantB, (qr) =>
        qr.query(insertSql(), [
          tenantB, userB, 'Expert Deux', 'GH666777', 'https://s3/cin/e.pdf',
          '+212600000004', 'deux@example.ma', 'ACAPS-EXP-DUP', 'https://s3/agr/e.pdf',
          '2031-01-01', ['auto'], 'independent', null, ['tanger'],
        ]),
      ),
    ).rejects.toThrow(/acaps_agrement_number/);
  });

  it('rejette un expert_type hors enum', async () => {
    await expect(
      withTenant(tenantA, (qr) =>
        qr.query(insertSql(), [
          tenantA, userA, 'Mauvais Type', 'IJ888999', 'https://s3/cin/f.pdf',
          '+212600000005', 'bad@example.ma', 'ACAPS-EXP-0010', 'https://s3/agr/f.pdf',
          '2030-01-01', ['auto'], 'wizard', null, ['agadir'],
        ]),
      ),
    ).rejects.toThrow();
  });

  it('rejette un status hors enum', async () => {
    await expect(
      withTenant(tenantA, (qr) =>
        qr.query(
          `INSERT INTO insure_experts
            (tenant_id, user_id, full_name, cin_number, cin_document_url, phone, email,
             acaps_agrement_number, acaps_agrement_document_url, acaps_agrement_expiry_date,
             expert_type, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12);`,
          [
            tenantA, userA, 'Statut Invalide', 'KL101112', 'https://s3/cin/g.pdf',
            '+212600000006', 'st@example.ma', 'ACAPS-EXP-0011', 'https://s3/agr/g.pdf',
            '2030-01-01', 'independent', 'archived',
          ],
        ),
      ),
    ).rejects.toThrow();
  });

  it('isole les experts entre tenants (RLS)', async () => {
    await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Expert Tenant A', 'MN131415', 'https://s3/cin/h.pdf',
        '+212600000007', 'ta@example.ma', 'ACAPS-EXP-0020', 'https://s3/agr/h.pdf',
        '2030-01-01', ['auto'], 'independent', null, ['casablanca'],
      ]),
    );
    const seenByB = await withTenant(tenantB, (qr) =>
      qr.query(`SELECT id FROM insure_experts;`),
    );
    expect(seenByB).toHaveLength(0);
    const seenByA = await withTenant(tenantA, (qr) =>
      qr.query(`SELECT id FROM insure_experts;`),
    );
    expect(seenByA).toHaveLength(1);
  });

  it('empeche un tenant d UPDATE l expert d un autre tenant (RLS write)', async () => {
    const created = await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Expert RLS Write', 'WR010101', 'https://s3/cin/rw.pdf',
        '+212600000300', 'rw@example.ma', 'ACAPS-EXP-RW01', 'https://s3/agr/rw.pdf',
        '2030-01-01', ['auto'], 'independent', null, ['casablanca'],
      ]),
    );
    const id = created[0].id;
    const affected = await withTenant(tenantB, (qr) =>
      qr.query(`UPDATE insure_experts SET notes = 'tentative' WHERE id = $1 RETURNING id;`, [id]),
    );
    expect(affected).toHaveLength(0);
  });

  it('recherche GIN par specialite (operateur @>)', async () => {
    await withTenant(tenantA, (qr) => {
      return qr.query(insertSql(), [
        tenantA, userA, 'Specialiste Auto', 'OP161718', 'https://s3/cin/i.pdf',
        '+212600000008', 'sa@example.ma', 'ACAPS-EXP-0030', 'https://s3/agr/i.pdf',
        '2030-01-01', ['auto', 'rc'], 'independent', null, ['casablanca'],
      ]);
    });
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(`SELECT id FROM insure_experts WHERE acaps_specialty @> ARRAY['auto'];`),
    );
    expect(rows).toHaveLength(1);
    const none = await withTenant(tenantA, (qr) =>
      qr.query(`SELECT id FROM insure_experts WHERE acaps_specialty @> ARRAY['maritime'];`),
    );
    expect(none).toHaveLength(0);
  });

  it('recherche GIN par zone (operateur overlap &&)', async () => {
    await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Expert Zones', 'QR192021', 'https://s3/cin/j.pdf',
        '+212600000009', 'ez@example.ma', 'ACAPS-EXP-0040', 'https://s3/agr/j.pdf',
        '2030-01-01', ['auto'], 'independent', null, ['casablanca', 'settat'],
      ]),
    );
    const hit = await withTenant(tenantA, (qr) =>
      qr.query(`SELECT id FROM insure_experts WHERE active_zones && ARRAY['settat','marrakech'];`),
    );
    expect(hit).toHaveLength(1);
  });

  it('applique le DEFAULT acaps_specialty = {} quand omis', async () => {
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(
        `INSERT INTO insure_experts
          (tenant_id, user_id, full_name, cin_number, cin_document_url, phone, email,
           acaps_agrement_number, acaps_agrement_document_url, acaps_agrement_expiry_date, expert_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING acaps_specialty, active_zones, avg_response_time_hours, baseline_honoraire_mad;`,
        [
          tenantA, userA, 'Defauts Tableaux', 'DT020304', 'https://s3/cin/dt.pdf',
          '+212600000400', 'dt@example.ma', 'ACAPS-EXP-DT01', 'https://s3/agr/dt.pdf',
          '2030-01-01', 'independent',
        ],
      ),
    );
    expect(rows[0].acaps_specialty).toEqual([]);
    expect(rows[0].active_zones).toEqual([]);
    expect(Number(rows[0].avg_response_time_hours)).toBe(0);
    expect(Number(rows[0].baseline_honoraire_mad)).toBe(0);
  });

  it('met a jour updated_at via trigger', async () => {
    const inserted = await withTenant(tenantA, (qr) =>
      qr.query(
        insertSql() + ';',
        [
          tenantA, userA, 'Expert Update', 'ST222324', 'https://s3/cin/k.pdf',
          '+212600000010', 'eu@example.ma', 'ACAPS-EXP-0050', 'https://s3/agr/k.pdf',
          '2030-01-01', ['auto'], 'independent', null, ['oujda'],
        ],
      ),
    );
    const id = inserted[0].id;
    const before = await withTenant(tenantA, (qr) =>
      qr.query(`SELECT updated_at FROM insure_experts WHERE id = $1;`, [id]),
    );
    await new Promise((r) => setTimeout(r, 20));
    await withTenant(tenantA, (qr) =>
      qr.query(`UPDATE insure_experts SET notes = 'KYB en cours' WHERE id = $1;`, [id]),
    );
    const after = await withTenant(tenantA, (qr) =>
      qr.query(`SELECT updated_at FROM insure_experts WHERE id = $1;`, [id]),
    );
    expect(new Date(after[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before[0].updated_at).getTime(),
    );
  });

  it('accepte un kyb_reviewed_by_user_id valide (reviewer KYB)', async () => {
    const rows = await withTenant(tenantA, (qr) =>
      qr.query(
        `INSERT INTO insure_experts
          (tenant_id, user_id, full_name, cin_number, cin_document_url, phone, email,
           acaps_agrement_number, acaps_agrement_document_url, acaps_agrement_expiry_date,
           expert_type, status, kyb_reviewed_at, kyb_reviewed_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), $13) RETURNING id, status;`,
        [
          tenantA, userA, 'Expert Revu', 'RV050607', 'https://s3/cin/rv.pdf',
          '+212600000500', 'rv@example.ma', 'ACAPS-EXP-RV01', 'https://s3/agr/rv.pdf',
          '2030-01-01', 'independent', 'active', reviewerA,
        ],
      ),
    );
    expect(rows[0].status).toBe('active');
  });

  it('empeche la suppression d un user reference (ON DELETE RESTRICT)', async () => {
    await withTenant(tenantA, (qr) =>
      qr.query(insertSql(), [
        tenantA, userA, 'Expert FK', 'UV252627', 'https://s3/cin/l.pdf',
        '+212600000011', 'fk@example.ma', 'ACAPS-EXP-0060', 'https://s3/agr/l.pdf',
        '2030-01-01', ['auto'], 'independent', null, ['kenitra'],
      ]),
    );
    await expect(
      dataSource.query(`DELETE FROM auth_users WHERE id = $1;`, [userA]),
    ).rejects.toThrow();
  });

  it('purge les experts a la suppression du tenant (ON DELETE CASCADE)', async () => {
    const throwaway = await seedTenant(dataSource, 'Cabinet Jetable');
    const throwawayUser = await seedUser(dataSource, throwaway, 'jetable@example.ma');
    await withTenant(throwaway, (qr) =>
      qr.query(insertSql(), [
        throwaway, throwawayUser, 'Expert Cascade', 'CA303132', 'https://s3/cin/ca.pdf',
        '+212600000600', 'ca@example.ma', 'ACAPS-EXP-CA01', 'https://s3/agr/ca.pdf',
        '2030-01-01', ['auto'], 'independent', null, ['tetouan'],
      ]),
    );
    await dataSource.query(`DELETE FROM auth_tenants WHERE id = $1;`, [throwaway]);
    const remaining = await dataSource.query(
      `SELECT count(*)::int AS count FROM insure_experts WHERE tenant_id = $1;`,
      [throwaway],
    );
    expect(remaining[0].count).toBe(0);
  });
});
```

### 7.6. Fragment de documentation SQL

Fichier : `packages/database/docs/schema/insure_experts.md` (extrait operationnel)

```sql
-- Catalogue des experts Assurflow (decision-013). Complement de expert_designations.
-- Recherche typique Sprint 14 : experts auto actifs dans une zone, tries par rating.
SET LOCAL app.current_tenant_id = '<tenant-uuid>';
SELECT id, full_name, acaps_agrement_number, avg_rating, baseline_honoraire_mad
FROM insure_experts
WHERE status = 'active'
  AND acaps_specialty @> ARRAY['auto']      -- index GIN idx_insure_experts_specialty
  AND active_zones && ARRAY['casablanca']   -- index GIN idx_insure_experts_zones
ORDER BY avg_rating DESC, avg_response_time_hours ASC
LIMIT 20;

-- Experts internes d'une compagnie (index partiel idx_insure_experts_carrier_internal).
SELECT id, full_name FROM insure_experts
WHERE expert_type = 'carrier_internal' AND carrier_tenant_id = '<carrier-uuid>';

-- Experts dont l'agrement ACAPS expire dans les 30 jours (monitoring Sprint 14).
SELECT id, full_name, acaps_agrement_number, acaps_agrement_expiry_date
FROM insure_experts
WHERE status = 'active'
  AND acaps_agrement_expiry_date < CURRENT_DATE + INTERVAL '30 days'
ORDER BY acaps_agrement_expiry_date ASC;
```

### 7.7. Annotation colonne par colonne du DDL

Pour ne laisser aucune ambiguite a l'executant, voici la justification de chaque colonne du `CREATE TABLE` de la section 7.1, dans l'ordre du DDL.

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` : cle primaire technique. `gen_random_uuid()` provient de pgcrypto (active au Sprint 1). UUID v4 non sequentiel, pas d'exposition de cardinalite.
- `tenant_id uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE` : tenant proprietaire de la ligne ; cle d'isolation RLS. CASCADE : la suppression d'un tenant purge ses experts.
- `user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT` : compte utilisateur de l'expert. RESTRICT : on ne peut supprimer un user tant qu'un profil expert le reference (preserve l'integrite et la tracabilite).
- `full_name varchar(255) NOT NULL` : nom complet de l'expert (PII).
- `cin_number varchar(20) NOT NULL` : numero de carte d'identite nationale (PII sensible, RGPD-MA).
- `cin_document_url text NOT NULL` : URL souveraine du scan CIN (stockage objet, pas de blob en base).
- `phone varchar(20) NOT NULL` : telephone (PII). Longueur 20 pour formats internationaux `+212...`.
- `email varchar(255) NOT NULL` : courriel (PII).
- `acaps_agrement_number varchar(50) NOT NULL UNIQUE` : numero d'agrement ACAPS, unique au niveau national (cf. 2.3).
- `acaps_agrement_document_url text NOT NULL` : URL du document d'agrement (preuve).
- `acaps_agrement_expiry_date date NOT NULL` : date d'expiration de l'agrement (type `date`, pas `timestamptz`, car il s'agit d'une date calendaire sans heure).
- `acaps_specialty text[] NOT NULL DEFAULT '{}'` : specialites ACAPS, indexe GIN.
- `firm_name varchar(255)` : nom du cabinet (nullable ; pertinent pour `firm_admin`/`associate`).
- `firm_ice varchar(15)` : ICE du cabinet (nullable ; format valide cote app).
- `expert_type varchar(50) NOT NULL CHECK (...)` : type d'expert, 4 valeurs.
- `carrier_tenant_id uuid REFERENCES auth_tenants(id)` : compagnie de rattachement (nullable, sans ON DELETE explicite = NO ACTION ; cf. piege 12).
- `active_zones text[] NOT NULL DEFAULT '{}'` : zones d'intervention, indexe GIN.
- `total_missions integer NOT NULL DEFAULT 0` : metrique (cf. 2.10).
- `avg_rating numeric(3,2) NOT NULL DEFAULT 0` : metrique note moyenne.
- `avg_response_time_hours numeric(8,2) NOT NULL DEFAULT 0` : metrique delai moyen.
- `baseline_honoraire_mad numeric(12,2) NOT NULL DEFAULT 0` : honoraire de reference (montant MAD).
- `status varchar(50) NOT NULL DEFAULT 'pending_kyb' CHECK (...)` : etat KYB, 5 valeurs.
- `kyb_reviewed_at timestamptz` : horodatage de la revue KYB (nullable tant que non revu).
- `kyb_reviewed_by_user_id uuid REFERENCES auth_users(id)` : reviewer KYB (nullable).
- `kyb_rejection_reason text` : motif de rejet KYB (nullable).
- `notes text` : notes libres internes (nullable).
- `created_at timestamptz NOT NULL DEFAULT now()` : horodatage de creation.
- `updated_at timestamptz NOT NULL DEFAULT now()` : horodatage de derniere modification, maintenu par le trigger.

Total : 28 colonnes, ce qui correspond au critere V6. Toute deviation de ce compte (colonne ajoutee ou retiree) doit etre repercutee simultanement dans l'entite TypeORM (section 7.3) et dans l'assertion `count(*)` du test de migration (section 7.4).

### 7.8. Ordre des operations dans up() et raison de cet ordre

L'ordre des sept etapes du `up()` n'est pas indifferent :

1. `CREATE TABLE` d'abord : tous les objets suivants dependent de l'existence de la table.
2. Indexes ensuite : ils peuvent etre crees avant ou apres les donnees, mais avant l'activation RLS par convention de lisibilite.
3. `ENABLE` puis `FORCE` RLS : l'activation doit preceder la creation de la policy (une policy sur une table sans RLS active n'aurait aucun effet).
4. `CREATE POLICY` : apres l'activation RLS.
5. `CREATE TRIGGER` : reference la fonction partagee deja existante (Sprint 1) ; aucune dependance sur les etapes precedentes hormis la table.
6. `GRANT` : peut etre place a tout moment apres la creation de la table ; positionne ici pour regrouper la securite.
7. `COMMENT` : purement documentaire, place en dernier.

Le `down()` inverse partiellement cet ordre mais s'appuie sur la cascade de `DROP TABLE` : supprimer la table supprime automatiquement ses indexes, sa policy, son grant et ses commentaires. Seul le trigger est droppe explicitement avant, par hygiene, bien que `DROP TABLE` le supprimerait aussi. La fonction partagee `set_updated_at_column()` n'est jamais touchee.

## 8. Tests complets

La strategie de test combine (a) tests de migration (section 7.4), (b) tests d'integration sur Postgres reel (section 7.5). Le harnais ne mocke pas Postgres : il execute les migrations 001 a 013 sur une base ephemere, se connecte en role `insurtech_app`, et positionne `SET LOCAL app.current_tenant_id` par transaction pour activer RLS. Couverture cible : >= 90% (database est un domaine critique, decision tests-strict).

Cas couverts (au moins 24) :

1. up() cree la table `insure_experts`.
2. up() cree exactement 28 colonnes (assertion `count(*)` sur `information_schema.columns`).
3. up() cree les 5 indexes (tenant, status, specialty GIN, zones GIN, carrier partiel).
4. Les indexes `specialty` et `zones` contiennent `USING gin` dans `indexdef`.
5. L'index `carrier_internal` est partiel (clause `WHERE (expert_type = 'carrier_internal')`).
6. RLS `relrowsecurity` = true.
7. RLS `relforcerowsecurity` = true.
8. Policy `insure_experts_tenant_isolation` presente.
9. Trigger `trg_insure_experts_updated_at` present.
10. Fonction `set_updated_at_column` toujours presente apres up.
11. GRANT SELECT/INSERT/UPDATE/DELETE accorde a `insurtech_app`.
12. down() supprime la table.
13. down() conserve `set_updated_at_column`.
14. Cycle up -> down -> up reversible.
15. Insertion expert `independent` valide ; defaults appliques (`status = pending_kyb`, `total_missions = 0`, `acaps_specialty = '{}'`, `avg_rating = 0`).
16. Insertion expert `firm_admin` avec `firm_name` et `firm_ice` valide.
17. CHECK : `carrier_internal` sans `carrier_tenant_id` rejete (`chk_insure_experts_carrier_internal`).
18. CHECK : `carrier_internal` avec `carrier_tenant_id` accepte.
19. CHECK : `independent` avec `carrier_tenant_id` NULL accepte (permissif).
20. UNIQUE : `acaps_agrement_number` duplique cross-tenant rejete.
21. CHECK : `expert_type` hors enum rejete.
22. CHECK : `status` hors enum rejete.
23. RLS lecture : tenant B ne voit pas l'expert de tenant A ; tenant A voit son propre expert.
24. RLS ecriture : tenant B ne peut pas UPDATE l'expert de tenant A (0 ligne affectee).
25. GIN specialite : `@> ARRAY['auto']` retourne le match ; specialite absente retourne vide.
26. GIN zones : `&& ARRAY[...]` (overlap) retourne le match.
27. DEFAULT tableaux : insertion sans `acaps_specialty`/`active_zones` produit `[]` (et `avg_response_time_hours`/`baseline_honoraire_mad` = 0).
28. Trigger : UPDATE incremente `updated_at`.
29. Insertion avec `kyb_reviewed_by_user_id` valide (reviewer KYB) et `status = active`.
30. FK user_id ON DELETE RESTRICT : suppression du user bloquee.
31. FK tenant_id ON DELETE CASCADE : suppression du tenant purge les experts (tenant jetable).

32. Insertion `associate` avec `firm_name`/`firm_ice` et `carrier_tenant_id` NULL acceptee (CHECK permissif).
33. `acaps_agrement_expiry_date` de type `date` (pas `timestamptz`) verifie via `information_schema`.
34. COMMENT sur la table contient la mention `decision-013`.
35. COMMENT sur `cin_number` mentionne la nature PII / Loi 09-08.
36. Insertion avec `acaps_specialty` multi-valeurs (`['auto','incendie','rc']`) et recherche `@> ARRAY['incendie','rc']` retourne le match (containment multiple).
37. UPDATE du `status` de `pending_kyb` vers `active` accepte (transition non contrainte au niveau base ; la machine a etats est applicative).

Harnais helper attendu (`test/helpers/test-datasource.ts`) : expose `buildTestDataSource({ runMigrationsUpTo, role })` qui cree une base ephemere (TESTCONTAINERS ou base dediee `insurtech_test`), execute les migrations jusqu'au timestamp fourni, et retourne une `DataSource` connectee dans le role demande (`insurtech_app` pour eprouver RLS et GRANT, owner pour le teardown). `auth-seeds.ts` expose `seedTenant(ds, name): Promise<string>` et `seedUser(ds, tenantId, email): Promise<string>` retournant les UUID crees (inserts effectues en owner, hors RLS).

Note sur le determinisme : chaque test purge `insure_experts` en `afterEach` (en owner, GUC tenant a l'UUID zero pour contourner RLS au teardown), ce qui garantit l'independance des cas et la repetabilite. Les numeros d'agrement ACAPS de test sont prefixes `ACAPS-EXP-` et uniques par cas pour eviter les collisions sur la contrainte UNIQUE globale meme si un test ne nettoie pas correctement.

## 9. Variables d'environnement

| Variable | Exemple | Role |
|---|---|---|
| `DATABASE_URL` | `postgresql://insurtech_owner:***@localhost:5432/insurtech` | DSN owner pour appliquer les migrations. |
| `DATABASE_APP_URL` | `postgresql://insurtech_app:***@localhost:5432/insurtech` | DSN role applicatif (RLS FORCE actif), utilise par les tests d'integration. |
| `DATABASE_TEST_URL` | `postgresql://insurtech_owner:***@localhost:5432/insurtech_test` | Base ephemere de tests. |
| `PGSSLMODE` | `require` | TLS 1.3 obligatoire (decision-008, cloud souverain MA). |
| `TZ` | `Africa/Casablanca` | Fuseau pour coherence des `timestamptz` et jobs nightly. |
| `NODE_ENV` | `test` | Active le harnais de test et la base ephemere. |

## 10. Commandes shell

```bash
# Installer (pnpm uniquement, engine-strict Node >= 22.11.0).
pnpm install

# Generer/regenerer la migration manuellement (le fichier est ecrit a la main ici).
# Verification de la compilation TypeScript stricte du package database.
pnpm --filter @insurtech/database exec tsc --noEmit

# Lint Biome.
pnpm --filter @insurtech/database exec biome check src test

# Appliquer la migration sur la base de dev.
pnpm --filter @insurtech/database run migration:run

# Verifier le statut des migrations (013 doit apparaitre appliquee, apres 011/012).
pnpm --filter @insurtech/database run migration:show

# Revert (execute down() de la derniere migration -> doit supprimer insure_experts).
pnpm --filter @insurtech/database run migration:revert

# Tests de migration + integration (Vitest).
pnpm --filter @insurtech/database run test -- insure-experts

# Verification anti-emoji (decision-006).
bash scripts/check-no-emoji.sh packages/database/src/migrations/1735000000013-Sprint75bInsureExperts.ts

# Inspection manuelle du DDL applique.
psql "$DATABASE_URL" -c "\d+ insure_experts"
psql "$DATABASE_URL" -c "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'insure_experts';"
psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'insure_experts';"
```

## 11. Criteres de validation

Chaque critere indique : commande, sortie attendue, mode d'echec.

### Priorite P0 (bloquants, >= 15)

- **V1** -- Fichier migration present. Commande : `test -f packages/database/src/migrations/1735000000013-Sprint75bInsureExperts.ts`. Attendu : exit 0. Echec : fichier absent ou mal nomme.
- **V2** -- Classe correctement nommee. Commande : `grep -q "class Sprint75bInsureExperts1735000000013 implements MigrationInterface" .../1735000000013-*.ts`. Attendu : match. Echec : nom de classe errone (rupture de l'ordre TypeORM).
- **V3** -- Numerotation 013 (pas 011/012). Commande : `ls packages/database/src/migrations | grep 1735000000013`. Attendu : un fichier. Echec : reutilisation de 011/012 (conflit Sprint 7.5a).
- **V4** -- Compilation stricte. Commande : `pnpm --filter @insurtech/database exec tsc --noEmit`. Attendu : exit 0. Echec : erreurs `strict`, `noUncheckedIndexedAccess`, etc.
- **V5** -- migration:run reussit. Commande : `pnpm --filter @insurtech/database run migration:run`. Attendu : "Migration Sprint75bInsureExperts1735000000013 has been executed successfully". Echec : SQL invalide.
- **V6** -- Table creee avec 28 colonnes. Commande : `psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.columns WHERE table_name='insure_experts';"`. Attendu : 28. Echec : colonne manquante/en trop.
- **V7** -- FK vers auth_tenants/auth_users (pas tenants/users). Commande : `psql -c "\d insure_experts" | grep -E "auth_tenants|auth_users"`. Attendu : references auth_*. Echec : references bare tenants/users (relation inexistante).
- **V8** -- timestamptz partout. Commande : `psql -c "SELECT data_type FROM information_schema.columns WHERE table_name='insure_experts' AND column_name IN ('created_at','updated_at','kyb_reviewed_at');"`. Attendu : `timestamp with time zone` x3. Echec : `timestamp without time zone`.
- **V9** -- CHECK expert_type. Commande : insertion `expert_type='wizard'`. Attendu : rejet. Echec : insertion acceptee.
- **V10** -- CHECK status. Commande : insertion `status='archived'`. Attendu : rejet. Echec : acceptee.
- **V11** -- CHECK carrier_internal conditionnel. Commande : `carrier_internal` sans `carrier_tenant_id`. Attendu : rejet `chk_insure_experts_carrier_internal`. Echec : acceptee.
- **V12** -- UNIQUE acaps_agrement_number. Commande : double insertion meme numero. Attendu : rejet contrainte unique. Echec : doublon accepte.
- **V13** -- RLS ENABLE + FORCE. Commande : `psql -c "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='insure_experts';"`. Attendu : `t | t`. Echec : `f` sur l'un des deux.
- **V14** -- Policy isolation. Commande : `psql -c "SELECT policyname FROM pg_policies WHERE tablename='insure_experts';"`. Attendu : `insure_experts_tenant_isolation`. Echec : absente.
- **V15** -- Isolation cross-tenant effective (lecture). Commande : test integration RLS (cas 23). Attendu : vert. Echec : fuite de donnees cross-tenant.
- **V16** -- Isolation cross-tenant effective (ecriture). Commande : test integration RLS write (cas 24). Attendu : 0 ligne affectee. Echec : UPDATE cross-tenant aboutit.
- **V17** -- Trigger updated_at present. Commande : `psql -c "SELECT tgname FROM pg_trigger WHERE tgrelid='insure_experts'::regclass AND NOT tgisinternal;"`. Attendu : `trg_insure_experts_updated_at`. Echec : absent.
- **V18** -- down() supprime la table, conserve la fonction partagee. Commande : `migration:revert` puis check `pg_proc`. Attendu : table absente, `set_updated_at_column` presente. Echec : fonction droppee (casse les autres tables).

### Priorite P1 (importants, >= 8)

- **V19** -- 5 indexes presents. Commande : `psql -c "SELECT indexname FROM pg_indexes WHERE tablename='insure_experts';"`. Attendu : les 5 noms. Echec : index manquant.
- **V20** -- Indexes GIN sur text[]. Commande : `psql -c "SELECT indexdef FROM pg_indexes WHERE indexname IN ('idx_insure_experts_specialty','idx_insure_experts_zones');"`. Attendu : `USING gin`. Echec : B-tree.
- **V21** -- Index partiel carrier. Commande : `grep WHERE` dans `indexdef` de `idx_insure_experts_carrier_internal`. Attendu : `WHERE (expert_type = 'carrier_internal')`. Echec : index complet.
- **V22** -- GRANT au role applicatif. Commande : `psql -c "SELECT privilege_type FROM information_schema.role_table_grants WHERE table_name='insure_experts' AND grantee='insurtech_app';"`. Attendu : SELECT, INSERT, UPDATE, DELETE. Echec : permission denied a l'app.
- **V23** -- Recherche GIN specialite fonctionnelle. Commande : test integration cas 25. Attendu : vert. Echec : faux positif/negatif.
- **V24** -- Recherche GIN zones fonctionnelle. Commande : test integration cas 26. Attendu : vert. Echec : overlap non detecte.
- **V25** -- FK user_id ON DELETE RESTRICT. Commande : test integration cas 30. Attendu : suppression bloquee. Echec : suppression cascade ou orpheline.
- **V26** -- FK tenant_id ON DELETE CASCADE. Commande : test integration cas 31. Attendu : experts purges. Echec : experts orphelins ou suppression du tenant bloquee.
- **V27** -- Defaults appliques. Commande : test integration cas 15/27. Attendu : `pending_kyb`/0/`{}`. Echec : NULL ou autre.
- **V28** -- Entite TypeORM alignee. Commande : revue tableau d'alignement section 7.3 + `tsc`. Attendu : 28 proprietes coherentes. Echec : divergence type/nom.

### Priorite P2 (qualite, >= 5)

- **V29** -- COMMENT table present. Commande : `psql -c "SELECT obj_description('insure_experts'::regclass);"`. Attendu : description non NULL mentionnant decision-013. Echec : NULL.
- **V30** -- COMMENT colonnes sensibles. Commande : `psql -c "\d+ insure_experts"` -> colonnes cin_number, acaps_agrement_number commentees. Attendu : commentaires presents. Echec : absents.
- **V31** -- Couverture >= 90%. Commande : `pnpm --filter @insurtech/database run test -- --coverage insure-experts`. Attendu : >= 90% sur le fichier migration. Echec : < 90%.
- **V32** -- Zero emoji. Commande : `bash scripts/check-no-emoji.sh packages/database/src/migrations/1735000000013-Sprint75bInsureExperts.ts`. Attendu : exit 0. Echec : emoji detectee, CI rouge.
- **V33** -- Biome clean. Commande : `pnpm --filter @insurtech/database exec biome check src test`. Attendu : exit 0. Echec : warnings/erreurs de style.
- **V34** -- Migration enregistree dans index.ts. Commande : `grep Sprint75bInsureExperts1735000000013 packages/database/src/migrations/index.ts`. Attendu : import + entree tableau. Echec : migration non chargee par la DataSource.
- **V35** -- Reversibilite up/down/up. Commande : test migration cas 14 (idempotence). Attendu : vert. Echec : erreur au replay.

### Matrice de synthese de la validation

| Famille | Criteres | Verification principale |
|---|---|---|
| Existence/structure | V1, V2, V3, V6, V8 | Fichier, classe, numerotation, 28 colonnes, timestamptz |
| Integrite contraintes | V7, V9, V10, V11, V12 | FK auth_*, CHECK type/status/carrier, UNIQUE ACAPS |
| Securite RLS | V13, V14, V15, V16, V22 | ENABLE+FORCE, policy, isolation lecture/ecriture, GRANT |
| Indexation | V19, V20, V21, V23, V24 | 5 indexes, GIN sur text[], partiel carrier, recherches fonctionnelles |
| Cycle de vie | V5, V17, V18, V35 | run, trigger, revert conservant la fonction, reversibilite |
| Qualite/conformite | V4, V25, V26, V27, V28, V29, V30, V31, V32, V33, V34 | tsc, FK delete, defaults, entite, comments, couverture, emoji, biome, index.ts |

Regle d'or : aucun critere P0 (V1 a V18) ne peut etre marque vert sans preuve d'execution (sortie de commande ou test vert). Les criteres P1 et P2 suivent la meme exigence mais peuvent etre traites apres les P0. La tache n'est consideree terminee que lorsque l'ensemble V1 a V35 est vert et que la CI (incluant `check-no-emoji.sh`) passe.

## 12. Edge cases et troubleshooting

1. **"relation auth_tenants does not exist"** : les migrations 001-012 n'ont pas ete appliquees avant. *Resolution* : le harnais doit executer toutes les migrations prerequises. Verifier `runMigrationsUpTo` et l'ordre dans `index.ts`.
2. **"function app_can_access_tenant(uuid) does not exist"** : le helper RLS du Sprint 1 (tache 1.1.4) est absent. *Resolution* : verifier que la migration des helpers RLS precede 013. Ne JAMAIS recreer ce helper dans 013.
3. **"function set_updated_at_column() does not exist"** : idem, fonction Sprint 1 manquante. *Resolution* : ne pas la recreer ici ; corriger l'ordre des migrations.
4. **RLS ne filtre pas (tenant B voit tout)** : le GUC `app.current_tenant_id` n'est pas positionne, OU la connexion est faite en owner sans `FORCE`. *Resolution* : verifier `SET LOCAL app.current_tenant_id` dans la transaction et la connexion en role `insurtech_app`. `FORCE ROW LEVEL SECURITY` est requis pour appliquer la policy meme a l'owner.
5. **GIN index "data type text[] has no default operator class for access method gin"** : extension manquante ou colonne mal typee. *Resolution* : Postgres 16 supporte nativement GIN sur `text[]` via `array_ops` ; aucune extension requise. Verifier que la colonne est bien `text[]` et non `varchar[]` mal declaree.
6. **CHECK carrier_internal rejette a tort un independent avec carrier_tenant_id** : la contrainte a ete inversee. *Resolution* : la forme correcte autorise `carrier_tenant_id` NULL ou non pour les non-internes ; relire 7.1 et tester le cas 19.
7. **"permission denied for table insure_experts"** lors d'un test integration : le GRANT au role `insurtech_app` est absent ou la connexion utilise le mauvais role. *Resolution* : verifier l'instruction GRANT dans up() et le `role` passe a `buildTestDataSource`.
8. **migration:revert echoue "cannot drop function set_updated_at_column because other objects depend on it"** : signe d'une erreur grave -- le down() tente de dropper la fonction partagee. *Resolution* : retirer toute instruction `DROP FUNCTION` du down().
9. **numeric renvoye comme string en TS, comparaisons cassees** : c'est attendu (pg renvoie les numeric en string). *Resolution* : ne pas forcer `number` ; comparer via `Number(value)` uniquement pour les assertions de test, jamais pour stocker des montants.
10. **Conflit d'ordre avec 011/012** : si TypeORM rejoue ou ignore 013, le timestamp est duplique. *Resolution* : verifier l'unicite du timestamp 1735000000013 et l'absence de doublon de numero dans `index.ts`.
11. **"new row violates row-level security policy" a l'INSERT** : le `tenant_id` insere ne correspond pas au GUC `app.current_tenant_id` positionne dans la transaction. *Resolution* : aligner la valeur de `tenant_id` de l'INSERT sur le GUC de la transaction courante.
12. **CASCADE inattendu : suppression d'une compagnie carrier supprime des experts** : la FK `carrier_tenant_id` aurait ete declaree `ON DELETE CASCADE` par erreur. *Resolution* : `carrier_tenant_id` ne porte AUCUNE clause ON DELETE (defaut NO ACTION) ; seul `tenant_id` est en CASCADE. Relire le DDL 7.1.
13. **Test flaky sur updated_at (egalite stricte)** : sans pause, l'horloge peut renvoyer la meme valeur. *Resolution* : conserver le `setTimeout(20)` et asserter `>` et non `>=`.
14. **`avg_rating` insere a 6.00 accepte par la base** : la migration ne pose aucun CHECK de borne sur les metriques (precision/echelle seulement). *Resolution* : la validation de borne (0..5) est deleguee a Zod au Sprint 14 ; ne pas ajouter de CHECK ici pour ne pas figer la regle metier dans la migration.
15. **`firm_ice` accepte une chaine non numerique de 15 caracteres** : la base ne contraint que la longueur (`varchar(15)`). *Resolution* : le format ICE (15 chiffres) est valide cote application (Zod) au Sprint 14 ; comportement attendu au niveau persistant.
16. **Replay de la migration apres un down() partiel** : si `down()` a echoue apres le DROP TRIGGER mais avant le DROP TABLE, un nouveau `up()` echouerait sur "relation insure_experts already exists". *Resolution* : le `down()` etant transactionnel (TypeORM), un echec annule tout ; en cas d'etat incoherent manuel, dropper la table a la main avant de rejouer. Le `DROP TABLE IF EXISTS` rend le down() re-executable sans erreur.

## 13. Conformite Maroc

- **ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)** : l'expertise sinistre exige un agrement ACAPS nominatif. La colonne `acaps_agrement_number` (UNIQUE global) materialise l'identifiant du registre national des experts agrees. `acaps_agrement_expiry_date` porte la date d'expiration ; le statut `expired_agrement` permet de bloquer toute designation d'un expert dont l'agrement a expire (logique de basculement Sprint 14). Les documents `acaps_agrement_document_url` constituent la preuve d'agrement, conservee en stockage souverain.
- **CNDP / Loi 09-08 (protection des donnees personnelles)** : `cin_number`, `cin_document_url`, `phone`, `email` sont des donnees a caractere personnel. L'isolation RLS (`ENABLE` + `FORCE` + policy `app_can_access_tenant`) garantit qu'aucun tenant n'accede aux PII d'un expert hors de son perimetre. La retention est alignee sur l'obligation legale (7 ans ACAPS post-cessation), avec desactivation logique `status = 'inactive'` avant purge. Les COMMENT SQL documentent explicitement la nature PII des colonnes sensibles.
- **Loi 17-99 (Code des assurances)** : encadre l'activite d'expertise en assurance au Maroc. La separation catalogue (`insure_experts`) / designation (`expert_designations`) refletera la tracabilite exigee : qui est habilite (catalogue agree) versus qui a expertise quel sinistre (transactionnel). La table catalogue prepare la conformite aux obligations de tracabilite et de qualification des intervenants.
- **Decision-008 (cloud souverain MA)** : aucune donnee d'assure ni d'expert ne quitte le territoire (Atlas Benguerir, DC1 Tier III + DC2 Tier IV). Les URLs de documents pointent vers le stockage objet souverain (AES-256-GCM au repos, TLS 1.3 en transit). `timestamptz` + `TZ=Africa/Casablanca` assurent la coherence temporelle inter-DC.
- **ICE (Identifiant Commun de l'Entreprise)** : la colonne `firm_ice varchar(15)` porte l'ICE du cabinet de rattachement pour les types `firm_admin`/`associate`. L'ICE marocain est un identifiant a 15 chiffres ; la validation de format est deleguee a la couche applicative (Zod, Sprint 14), la base ne posant que la contrainte de longueur.
- **Retention et droit a l'oubli (operationnalisation)** : la table prepare l'application differenciee de la retention. Une cessation d'activite passe l'expert en `status = 'inactive'` (desactivation logique immediate, plus visible dans les recherches actives). La purge physique (DELETE) n'intervient qu'apres l'expiration du delai legal de conservation ACAPS (7 ans post-cessation), declenchee par un job de retention du Sprint 28. La separation catalogue/transactionnel (cf. 2.1) permet de purger l'identite de l'expert sans detruire les traces de missions soumises a une obligation comptable distincte ; seules les colonnes PII (`cin_number`, `cin_document_url`, `phone`, `email`) seraient anonymisees en priorite si une demande CNDP d'effacement partiel etait recue avant le terme legal.
- **Auditabilite des acces PII** : tout acces applicatif aux colonnes PII passe par une connexion `insurtech_app` sous RLS, et les logs structures (Pino) tracent `tenant_id`, `user_id`, `action`. La migration ne pose pas le mecanisme d'audit (couche applicative, decision multi-tenant strict), mais elle garantit la condition prealable : aucune lecture PII possible hors tenant grace a RLS FORCE.

## 14. Conventions absolues skalean-insurtech

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sur toutes les routes sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; contexte propage par `AsyncLocalStorage` ; isolation Postgres via RLS et helper `app_can_access_tenant()` ; audit trail systematique des acces.
- **Validation strict** : Zod uniquement ; schemas exportes ; pattern `const Schema = z.object(...)` ; types derives par `type X = z.infer<typeof Schema>`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; logs JSON structures avec champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id parametres 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER` applique.
- **Package manager strict** : pnpm uniquement ; `engine-strict` Node >= 22.11.0 ; `save-exact` ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` possede son `.spec.ts` ; couverture globale >= 85%, >= 90% pour auth/database/signature.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles v3.0.
- **Events strict** : topics Kafka `insurtech.events.{vertical}.{entity}.{action}` ; schema Zod par evenement ; `Idempotency-Key` sur les operations critiques.
- **Imports strict** : alias `@insurtech/{name}` ; paths dans `tsconfig.base.json` ; ordre Node natif / externes / `@insurtech` / relatifs.
- **Skalean AI strict (decision-005)** : acces IA uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un modele frontier ; mock en sprints 1-28, reel au sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; la CI echoue si une emoji est detectee.
- **Idempotency-Key strict** : obligatoire sur `POST /payments`, `/signatures`, `/claims`, et les ecritures MCP ; TTL 24h en Redis.
- **Conventional Commits strict** : format `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure hors du Maroc ; chiffrement AES-256-GCM ; TLS 1.3.
- **Naming v3.0 (decision-011)** : Skalean (entreprise), Assurflow (vertical), Sofidemy (marque).

## 15. Validation pre-commit

```bash
# 1. Compilation stricte.
pnpm --filter @insurtech/database exec tsc --noEmit

# 2. Lint et format.
pnpm --filter @insurtech/database exec biome check src test

# 3. Anti-emoji (decision-006).
bash scripts/check-no-emoji.sh \
  packages/database/src/migrations/1735000000013-Sprint75bInsureExperts.ts \
  packages/database/src/entities/insure-expert.entity.ts \
  packages/database/test/integration/insure-experts.integration.spec.ts

# 4. Tests cibles + couverture.
pnpm --filter @insurtech/database run test -- --coverage insure-experts

# 5. Aller-retour migration sur base de dev (sanity).
pnpm --filter @insurtech/database run migration:run
pnpm --filter @insurtech/database run migration:revert
pnpm --filter @insurtech/database run migration:run

# 6. Husky/commitlint valideront le message de commit ci-dessous.
```

Toutes les commandes doivent retourner exit 0. Le hook husky `pre-commit` execute `lint-staged` (biome + check-no-emoji) ; `commit-msg` execute commitlint.

## 16. Message de commit

```
feat(sprint-7.5b): foundation entity insure_experts catalog + rls

Cree la table de fondation insure_experts, catalogue (annuaire) des experts
en assurance du vertical Assurflow (decision-013). Complement de la table
transactionnelle expert_designations (Sprint 7.5a) qui sera renommee
insure_expert_assignments par la tache 2.5.5.

Contenu de la migration 1735000000013-Sprint75bInsureExperts :
- CREATE TABLE insure_experts (28 colonnes) : PII expert, agrement ACAPS
  (UNIQUE global, expiry), specialites et zones en text[], metriques agregees,
  workflow KYB, type d'expert (independent/firm_admin/associate/carrier_internal).
- CHECK conditionnel chk_insure_experts_carrier_internal : carrier_tenant_id
  obligatoire si expert_type = carrier_internal.
- FK vers auth_tenants(id) et auth_users(id) ; ON DELETE CASCADE/RESTRICT.
- 5 indexes : tenant, status, GIN(acaps_specialty), GIN(active_zones),
  partiel(carrier_tenant_id) WHERE expert_type = carrier_internal.
- RLS ENABLE + FORCE + policy insure_experts_tenant_isolation
  USING app_can_access_tenant(tenant_id).
- Trigger trg_insure_experts_updated_at reutilisant set_updated_at_column()
  (fonction partagee Sprint 1, non recreee). down() ne droppe jamais cette fonction.
- GRANT SELECT/INSERT/UPDATE/DELETE a insurtech_app. COMMENT documentaires.

Alignement de l'entite TypeORM insure-expert.entity.ts (squelette 2.5.1).
Tests : migration (up/down/reversibilite) + integration Postgres reel
(insert valide, CHECK carrier_internal, UNIQUE ACAPS, isolation RLS 2 tenants,
recherche GIN specialite/zones, FK RESTRICT/CASCADE, trigger updated_at, defaults).
Implementation du service (CRUD/KYB/recherche/scoring) deleguee au Sprint 14.

Conformite : ACAPS (agrement/expiry), CNDP Loi 09-08 (PII expert sous RLS),
loi 17-99 (Code des assurances). Souverainete MA (decision-008).

Task: 2.5.4
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: 013 + preview sprint 14
```

## 17. Workflow next step

Apres validation de la tache 2.5.4 (table catalogue `insure_experts` creee, testee, RLS verifiee, entite alignee, CI verte) :

- Passer a la tache **2.5.5** : renommage de la table transactionnelle `expert_designations` (livree au Sprint 7.5a) en `insure_expert_assignments`, pour homogeneiser le prefixe `insure_` du vertical Assurflow. Cette tache ajoutera la FK `expert_id -> insure_experts(id)` etablissant la relation catalogue (un) -> assignments (plusieurs), avec gestion du renommage des indexes, des contraintes, de la policy RLS et du trigger associes. La migration suivante prendra le numero `1735000000014`.
- La tache 2.5.5 dependra donc directement de 2.5.4 (FK cible) et de l'existant 7.5a (`expert_designations` source).
- Sequence aval indicative : 2.5.6 `insure_expert_reports` (rapports d'expertise, FK `expert_id`), puis Sprint 14 pour l'implementation des services (`service-experts` : CRUD, workflow KYB, recherche GIN multi-critere, scoring de performance, basculement automatique `expired_agrement`).
- Verification de non-regression : apres 2.5.5, rejouer la suite d'integration `insure-experts` pour s'assurer que le renommage et l'ajout de FK n'ont pas casse l'isolation RLS ni les indexes GIN du catalogue.
- Tracabilite documentaire : a la cloture, mettre a jour le `_SUMMARY.md` du Sprint 7.5b pour marquer la tache 2.5.4 comme livree et referencer la migration `1735000000013`.
- Coherence de la suite : verifier que les taches 2.5.5 et 2.5.6 referencent bien `insure_experts(id)` et non une table renommee de maniere incoherente, afin de preserver la chaine de FK du sous-domaine expertise.
- Point de vigilance pour 2.5.5 : la FK `expert_id` ajoutee a `insure_expert_assignments` devra etre `ON DELETE RESTRICT` ou `ON DELETE SET NULL` selon la regle metier de tracabilite (a confirmer dans 2.5.5), jamais `CASCADE`, afin de ne pas perdre l'historique de missions a la suppression d'un profil expert.
- Point de vigilance pour le Sprint 14 : le job de basculement `expired_agrement` doit s'executer en owner ou avec un GUC tenant approprie, sous peine que RLS masque les lignes a traiter.
- Checklist de cloture avant de marquer 2.5.4 terminee : (a) les 35 criteres V1-V35 sont verts ; (b) la migration s'applique et se reverte proprement sur une base fraiche ; (c) l'entite TypeORM compile en mode strict et reflete les 28 colonnes ; (d) le fragment de documentation SQL est commite ; (e) `check-no-emoji.sh` passe sur les trois fichiers livres ; (f) le message de commit respecte le format Conventional Commits de la section 16.

---

Fin de la tache 2.5.4 -- Sprint 7.5b (Phase 2) -- Foundation entity `insure_experts` (catalogue des experts). Reference historique B-7.5b. Priorite P0. Effort 1h. Depend de 2.5.3, bloque 2.5.5. Decision-013 + preview Sprint 14. AUCUNE EMOJI (decision-006 ABSOLUE).
