# Task 7.5a.3 - Extension du type CrossTenantAuthorizationType (3 vers 7 valeurs) et CrossTenantResourceType (5 vers 8 valeurs) - Ecosysteme Assurflow v3.0

## 1. Header metadata

| Champ | Valeur |
| --- | --- |
| Programme | Skalean InsurTech v3.0 |
| Marque verticale | Assurflow |
| Sprint | 7.5a (Assurflow Foundation) |
| Reference meta-prompt | B-7.5a tache 7.5a.3 |
| Phase | 2.5 Migration Assurflow |
| Position dans le sprint | Tache 3 / 10 |
| Priorite | P0 (bloquant pour 7.5a.4 et 7.5a.5) |
| Effort estime | 2h |
| Dependances | 7.5a.2 (extension des 26 roles tenant-user) DOIT etre terminee et mergee |
| Bloque | 7.5a.4 (migration DB ajoutant la contrainte CHECK alignee sur ces types + table expert_designations), 7.5a.5 (consommation du helper requiresTimeBoundedAuthorization par le service ABAC) |
| Package cible | `@insurtech/database` |
| Fichier coeur | `packages/database/src/entities/system/cross-tenant-authorization.entity.ts` |
| Densite cible | 80-150 ko (cible ~110-125 ko) |
| Decisions referencees | decision-006 (no-emoji), decision-008 (cloud souverain MA), decision-012, decision-013, decision-014 |
| Couverture tests exigee | >=90% (package database tier critique) |
| AUCUNE EMOJI AUTORISEE | Conformite decision-006 ABSOLUE - le pre-commit `check-no-emoji.sh` et la CI echouent sur toute emoji |

Cette tache est une extension de types TypeScript purement additive et retrocompatible. Elle ne supprime ni ne renomme aucune valeur existante. Elle prepare le terrain de la migration SQL 7.5a.4 qui materialisera ces memes chaines dans une contrainte `CHECK`. Toute divergence entre l'union TypeScript et la contrainte SQL provoquerait des erreurs d'insertion silencieuses au runtime ; cette tache doit donc etre traitee comme un contrat partage entre la couche ORM et la couche base de donnees.

---

## 2. But

L'objectif de cette tache est d'etendre le vocabulaire d'autorisations inter-tenants de la plateforme Skalean InsurTech pour couvrir l'ecosysteme operationnel complet d'Assurflow v3.0. Aujourd'hui, le type `CrossTenantAuthorizationType` ne reconnait que trois scenarios de partage de droits entre organisations : l'affectation d'un sinistre d'un courtier vers un garage (`broker_to_garage_assignment`), l'autorisation pour un assure de se rendre dans un garage (`assure_to_garage_visit`), et l'acces multi-tenant d'un utilisateur plateforme (`multi_tenant_user_access`). Or l'architecture cible Assurflow v3.0 introduit un ecosysteme a six acteurs (assure/client, remorqueur/tow, garage, expert, carrier/assureur, plateforme) reliant la totalite du parcours d'un sinistre auto, du depannage initial jusqu'au reglement de la facture. Ces nouveaux flux operationnels exigent quatre nouveaux types d'autorisation inter-tenants et trois nouveaux types de ressources partageables.

Concretement, il faut faire passer l'union `CrossTenantAuthorizationType` de 3 a 7 valeurs et l'union `CrossTenantResourceType` de 5 a 8 valeurs, dans l'entite TypeORM `CrossTenantAuthorization` du package `@insurtech/database`. Les quatre nouveaux types couvrent : la commande d'un remorqueur par le client (`client_to_tower_dispatch`), la livraison du vehicule par le remorqueur vers le garage (`tower_to_garage_delivery`), la communication du garage vers l'expert designe par le carrier (`garage_to_expert_request`), et la transmission du devis du garage vers le carrier (`garage_to_carrier_quote`). Les trois nouvelles ressources couvrent la mission de remorquage (`mission`), le dossier d'expertise (`expertise`) et la commande de pieces PartsHub (`parts_order`). L'extension est strictement additive : les trois types et cinq ressources existants restent inchanges, garantissant que les autorisations deja persistees restent valides et que les services Sprint 6/26 deja construits ne cassent pas.

Enfin, cette tache introduit un helper de domaine `requiresTimeBoundedAuthorization(type)` qui factorise une regle metier cruciale : toutes les autorisations sont time-bounded (elles expirent), a l'exception de `multi_tenant_user_access` qui est la seule autorisation persistante (utilisee par le role `super_admin_platform`). Ce helper sera consomme par le service ABAC du Sprint 7 (tache 2.3.7) pour decider s'il faut imposer un `expires_at` futur lors de la creation d'une autorisation. Deux tableaux geles (`ALL_CROSS_TENANT_TYPES`, `ALL_CROSS_TENANT_RESOURCE_TYPES`) sont egalement exposes pour permettre l'iteration exhaustive dans les tests, les validateurs Zod et les futures migrations.

---

## 3. Contexte etendu

### 3.1 Pourquoi passer de 3 a 7 types

La version initiale de la plateforme (Sprint 6, framework cross-tenant) modelisait un parcours sinistre simplifie : un courtier affecte un sinistre a un garage, et un assure obtient un droit de visite. Ce modele a trois types suffisait pour le MVP courtage-garage. La vision Assurflow v3.0 (decision-012) elargit le perimetre a un veritable ecosysteme de mobilite assurantielle dans lequel chaque etape physique du sinistre (depannage, transport, reparation, expertise, indemnisation) correspond a un transfert de droits entre deux organisations juridiquement distinctes (donc deux tenants distincts). Chacun de ces transferts doit etre trace, borne dans le temps, et revocable, conformement a la minimisation du partage de donnees imposee par la loi 09-08 (CNDP).

Les quatre nouveaux flux suivent la chronologie reelle d'un sinistre auto :

1. Le client constate un accident et commande un remorqueur via l'application mobile Assurflow. Cela cree une autorisation `client_to_tower_dispatch` : le tenant assure/client autorise le tenant remorqueur a acceder aux donnees minimales de la mission (position, vehicule, contact). Validite : duree de la mission de depannage (typiquement quelques heures).
2. Le remorqueur recupere le vehicule et le livre au garage choisi. Cela cree une autorisation `tower_to_garage_delivery` : le tenant remorqueur autorise le tenant garage a acceder a la mission et au vehicule jusqu'a la completion de la livraison (typiquement le jour meme).
3. Le garage commence le diagnostic et doit communiquer avec l'expert designe par le carrier. Cela cree une autorisation `garage_to_expert_request` : le tenant garage autorise le tenant expert a echanger sur le dossier ; le carrier est en copie (CC). Validite bornee a 30 jours (delai d'expertise ACAPS).
4. Une fois l'expertise validee, le garage transmet l'information du devis au carrier. Cela cree une autorisation `garage_to_carrier_quote` : le tenant garage autorise le tenant carrier a consulter le devis ; le carrier est en CC apres validation de l'expert. Validite bornee a 30 jours.

### 3.2 L'ecosysteme a 6 acteurs

| Acteur (tenant_type) | Role principal | Tenant cree par | Exemple de role tenant-user (cf 7.5a.2) |
| --- | --- | --- | --- |
| assure / client | Souscripteur d'une police, declarant du sinistre, commanditaire du depannage | Plateforme a l'inscription | `client_app_user` |
| tow / remorqueur | Prestataire de depannage et de transport du vehicule | Plateforme / partenaire | `tow_dispatcher`, `tow_driver` |
| garage | Reparateur agree, emetteur de devis et factures | Carrier / plateforme | `garage_manager`, `garage_mechanic` |
| expert | Expert automobile designe par le carrier, evalue les dommages | Carrier | `expert_lead`, `expert_assessor` |
| carrier / assureur | Compagnie d'assurance, valide les expertises et regle les factures | Plateforme | `carrier_claims_handler`, `carrier_supervisor` |
| platform / plateforme | Skalean, super administration cross-tenant | Skalean | `super_admin_platform` |

### 3.3 Les workflows actives par chaque nouveau type

| Type | Flux | from_tenant (createur) | to_tenant (consommateur) | resource_type typique | Validite typique | requiresTimeBounded |
| --- | --- | --- | --- | --- | --- | --- |
| client_to_tower_dispatch | Commande de remorquage | assure/client | tow | mission / sinistre | duree de la mission (heures) | true |
| tower_to_garage_delivery | Livraison vehicule au garage | tow | garage | mission / sinistre | jusqu'a completion livraison (jour) | true |
| garage_to_expert_request | Communication garage-expert (carrier en CC) | garage | expert | expertise / sinistre | 30 jours | true |
| garage_to_carrier_quote | Transmission devis au carrier (apres validation expert) | garage | carrier | devis / facture | 30 jours | true |
| broker_to_garage_assignment | Affectation sinistre courtier-garage (existant) | broker | garage | sinistre | variable | true |
| assure_to_garage_visit | Droit de visite assure-garage (existant) | assure | garage | sinistre | variable | true |
| multi_tenant_user_access | Acces plateforme super-admin (existant) | platform | tout tenant | tenant | non borne (persistant) | false |

### 3.3bis Scenario de bout en bout (parcours sinistre Assurflow v3.0)

Pour ancrer la comprehension des 7 types, voici le deroule complet d'un sinistre auto type, du choc initial au reglement, avec l'autorisation inter-tenant creee a chaque etape. Les UUID sont fictifs et illustratifs.

1. Accident et declaration. L'assure Karim (tenant client `T-CLIENT`) declare un accident depuis l'application mobile Assurflow. Aucun cross-tenant a ce stade : la declaration reste dans le tenant client jusqu'a affectation.

2. Commande de remorqueur. Karim demande un depannage. Le backend cree une autorisation `client_to_tower_dispatch` : `from_tenant_id = T-CLIENT`, `to_tenant_id = T-TOW` (remorqueur le plus proche), `resource_type = 'mission'`, `resource_id = M-001`, `scope = ['mission:read', 'mission:update_status', 'client:contact_read']`, `expires_at = now + 4h` (duree estimee de la mission). `requiresTimeBoundedAuthorization('client_to_tower_dispatch') === true` : le service ABAC verifie que l'expiration est bornee.

3. Prise en charge et livraison au garage. Le remorqueur recupere le vehicule et le conduit au garage agree choisi. Le backend cree une autorisation `tower_to_garage_delivery` : `from_tenant_id = T-TOW`, `to_tenant_id = T-GARAGE`, `resource_type = 'mission'`, `resource_id = M-001`, `scope = ['mission:read', 'vehicle:read']`, `expires_at = now + 24h` (jusqu'a completion de la livraison). A la fin de la livraison, le statut de la mission passe a `delivered`, et cette autorisation pourra etre revoquee (`revoked_at` renseigne) ou laissee expirer.

4. Diagnostic et demande d'expertise. Le garage diagnostique les dommages et doit echanger avec l'expert designe par le carrier. Le backend cree une autorisation `garage_to_expert_request` : `from_tenant_id = T-GARAGE`, `to_tenant_id = T-EXPERT`, `resource_type = 'expertise'`, `resource_id = E-001`, `scope = ['expertise:read', 'expertise:comment', 'photos:read']`, `expires_at = now + 30 jours` (delai d'expertise ACAPS), `metadata = { cc_tenant_ids: ['T-CARRIER'] }` (le carrier est tenu informe). `requiresTimeBoundedAuthorization` retourne `true`, l'ABAC plafonne l'expiration a 30 jours.

5. Validation de l'expertise. L'expert evalue les dommages, valide ou ajuste le devis. L'expertise `E-001` passe au statut `validated`.

6. Transmission du devis au carrier. Apres validation de l'expert, le garage transmet le devis au carrier pour reglement. Le backend cree une autorisation `garage_to_carrier_quote` : `from_tenant_id = T-GARAGE`, `to_tenant_id = T-CARRIER`, `resource_type = 'devis'`, `resource_id = D-001`, `scope = ['devis:read', 'facture:read']`, `expires_at = now + 30 jours`, `metadata = { expertise_id: 'E-001', validated_by: 'T-EXPERT' }`. Le carrier consulte le devis et declenche le reglement.

7. Cloture. Une fois le sinistre regle, les autorisations encore actives sont revoquees (`revoked_at`, `revoked_by_user_id`, `revoked_reason = 'sinistre_closed'`) conformement a la minimisation loi 09-08 : aucun tenant ne conserve d'acces au-dela du besoin operationnel.

Ce scenario illustre que chaque type correspond a une transition reelle du parcours, et que les 4 nouveaux types sont indispensables pour couvrir le cycle complet sans recourir a des contournements (par exemple ouvrir indument un `multi_tenant_user_access` au remorqueur, ce qui violerait gravement la minimisation).

### 3.4 Alternatives de modelisation (analyse decisionnelle)

| Option | Description | Avantages | Inconvenients | Decision |
| --- | --- | --- | --- | --- |
| Union de litteraux TS + colonne `text` + CHECK SQL | Approche actuelle : `type CrossTenantAuthorizationType = 'a' \| 'b' \| ...` mappee sur une colonne `text` contrainte par un `CHECK` SQL | Migrations additives triviales (ajouter une valeur au CHECK) ; pas de verrou sur le type Postgres ; type-safety TS complete ; serialisation JSON naturelle | Necessite de synchroniser manuellement l'union TS et le CHECK SQL (drift possible) | RETENUE - aligne sur le code reel et decision-013 |
| Enum Postgres natif (`CREATE TYPE ... AS ENUM`) | Type enum cote DB | Validation forte cote DB ; stockage compact | `ALTER TYPE ... ADD VALUE` non transactionnel avant PG 12 ; suppression/renommage de valeur tres couteux ; couplage fort schema/code | REJETEE - rigidite migratoire |
| Table de lookup `cross_tenant_authorization_types` + FK | Normalisation des types dans une table de reference | Extensible sans migration de schema ; metadonnees par type | Jointure supplementaire a chaque verification ABAC (cout perf sur chemin critique RLS) ; sur-ingenierie pour 7 valeurs stables | REJETEE - cout perf sur le chemin critique `app_can_access_tenant()` |
| `varchar` libre sans contrainte | Colonne texte non contrainte | Flexibilite maximale | Aucune garantie d'integrite ; valeurs invalides possibles ; pas de type-safety | REJETEE - viole l'integrite metier |

L'option retenue conserve l'union de litteraux TypeScript adossee a une colonne `text` plus une contrainte `CHECK` cote SQL (ajoutee en 7.5a.4). Le present code TS est la source de verite cote application ; le CHECK SQL est la source de verite cote base. Les deux DOIVENT lister exactement les memes chaines.

### 3.5 Trade-offs

- Avantage : extension purement additive, zero risque de regression sur les autorisations existantes ; les lignes deja persistees restent valides.
- Avantage : type-safety complete cote TypeScript des la compilation (toute valeur non listee est rejetee a la compilation).
- Cout : la verification d'integrite definitive (rejet d'une valeur inconnue) n'arrive qu'apres l'application de la migration 7.5a.4 (le CHECK SQL). Entre le merge de cette tache et l'application de 7.5a.4, une insertion d'une nouvelle valeur compilerait mais serait acceptee par la DB sans contrainte (colonne `text` libre). C'est attendu et documente comme piege 3.6.1.
- Cout : maintien manuel de la synchronisation TS / SQL / Zod. On l'attenue par un test snapshot des valeurs (section 8) et par les tableaux geles iterables.

### 3.6 Pieges techniques nommes

#### 3.6.1 Piege - Type ajoute en TS mais CHECK SQL non encore migre

Pourquoi : tant que la migration 7.5a.4 n'a pas ete appliquee, la colonne `type` reste un `text` libre (le CHECK initial ne liste que les 3 anciennes valeurs, ou aucun CHECK selon l'historique). Une insertion d'une nouvelle valeur passe la compilation TS et passe aussi cote DB sans erreur tant que l'ancien CHECK ne la bloque pas, ou est bloquee par l'ancien CHECK si celui-ci enumere strictement les 3 valeurs. Dans les deux cas le comportement est incoherent avec l'intention.

Solution : ne JAMAIS persister une autorisation portant un des 4 nouveaux types tant que 7.5a.4 n'est pas mergee et appliquee en environnement cible. Cette tache 7.5a.3 ne fait qu'etendre le contrat de type ; elle declare explicitement dans son commit body que la materialisation DB suit en 7.5a.4. Le test d'integration (section 8.4) documente cette dependance via un commentaire et un test marque `it.todo` qui sera active en 7.5a.4.

#### 3.6.2 Piege - Gestion du resource_type nullable

Pourquoi : la colonne `resource_type` est `nullable` (type TS `CrossTenantResourceType | null`). Une autorisation peut etre accordee au niveau tenant entier (sans ressource specifique, `resource_type = null` et `resource_id = null`) ou ciblee sur une ressource precise. Oublier le `| null` dans les helpers ou les schemas Zod casserait `exactOptionalPropertyTypes`.

Solution : tous les schemas et helpers manipulant `resourceType` doivent accepter explicitement `null`. Le schema Zod utilise `.nullable()` et non `.optional()`. Le helper `requiresTimeBoundedAuthorization` ne prend que `type` en parametre et n'est pas impacte par `resourceType`.

#### 3.6.3 Piege - Matching bidirectionnel from/to tenant

Pourquoi : la fonction Postgres `app_can_access_tenant(target)` (condition 3) verifie `from_tenant_id = current OR to_tenant_id = target`. Une autorisation est donc directionnelle au niveau metier (createur -> consommateur) mais doit etre interrogeable dans les deux sens lors de la verification d'acces. Confondre la direction (inverser from/to lors de la creation) accorderait un droit a la mauvaise organisation.

Solution : respecter strictement la table 3.3 (from_tenant = createur, to_tenant = consommateur). Documenter chaque type avec son createur et son consommateur dans la JSDoc. Les tests verifient la coherence directionnelle attendue de chaque type via les metadonnees documentaires (pas de logique runtime ajoutee ici, mais le contrat est documente).

#### 3.6.4 Piege - Oubli d'un nouveau type dans requiresTimeBoundedAuthorization

Pourquoi : le helper retourne `false` uniquement pour `multi_tenant_user_access` et `true` pour tout le reste. Si on l'implementait via une liste explicite des types time-bounded, l'ajout d'un futur type necessiterait de penser a l'ajouter a la liste, ce qui est une source d'erreur.

Solution : implementer le helper par exclusion (`return type !== 'multi_tenant_user_access'`). Ainsi tout nouveau type est time-bounded par defaut, ce qui est le comportement souhaite et le plus sur. Un test snapshot verifie qu'aucun nouveau type n'echappe a cette regle.

#### 3.6.5 Piege - Drift entre union TS et CHECK SQL

Pourquoi : si la migration 7.5a.4 liste un ensemble de chaines different (faute de frappe, ordre different sans importance mais valeur manquante avec importance), la DB rejetterait des valeurs valides ou accepterait des valeurs invalides.

Solution : un test snapshot (section 8.5) capture la liste exacte triee des 7 types et 8 ressources sous forme de chaine canonique. La migration 7.5a.4 referencera ces memes chaines. On ajoute aussi une note d'integration imposant la verification croisee manuelle a la revue de 7.5a.4.

#### 3.6.6 Piege - Renommage involontaire d'une valeur existante

Pourquoi : modifier une chaine existante (par exemple `assure_to_garage_visit` -> `assured_to_garage_visit`) invaliderait toutes les autorisations deja persistees et casserait le CHECK SQL existant.

Solution : test snapshot des 3 valeurs historiques verifiant qu'elles sont inchangees au caractere pres. Toute modification accidentelle fait echouer le test.

#### 3.6.7 Piege - Import non explicite / import *

Pourquoi : la convention TypeScript strict interdit `import *`. Un `import * as typeorm` casserait la regle de lint et le tree-shaking.

Solution : conserver les imports nommes explicites de TypeORM deja presents dans le fichier reel. N'ajouter aucun import inutile.

#### 3.6.8 Piege - Extension `.js` manquante dans les imports ESM

Pourquoi : le package `@insurtech/database` est en ESM pur (`"type": "module"`). Les imports relatifs DOIVENT porter l'extension `.js` (ex : `./auth-tenant.entity.js`). Oublier l'extension casse la resolution au runtime Node 22.

Solution : conserver les extensions `.js` existantes. Le nouveau fichier spec importera `./cross-tenant-authorization.entity.js`.

#### 3.6.9 Piege - Tableau gele non readonly cote type

Pourquoi : exporter un tableau mutable permettrait a un consommateur de muter accidentellement la liste canonique des types.

Solution : declarer les tableaux avec `as const` et le type `readonly CrossTenantAuthorizationType[]`, et les figer avec `Object.freeze`. Un test verifie l'immuabilite et la longueur.

#### 3.6.10 Piege - Couverture du helper sous le seuil 90%

Pourquoi : le package database est tier critique (>=90%). Un helper non integralement teste fait chuter la couverture.

Solution : tester `requiresTimeBoundedAuthorization` sur les 7 types (couverture des deux branches : `false` pour `multi_tenant_user_access`, `true` pour les 6 autres).

#### 3.6.11 Piege - Mise a jour oubliee de l'export d'index system

Pourquoi : le `system/index.ts` reexporte deja `CrossTenantAuthorizationType` et `CrossTenantResourceType`. Si on ajoute le helper et les tableaux sans les exporter, ils ne seront pas accessibles depuis `@insurtech/database`.

Solution : etendre l'export nomme dans `system/index.ts` pour inclure `requiresTimeBoundedAuthorization`, `ALL_CROSS_TENANT_TYPES` et `ALL_CROSS_TENANT_RESOURCE_TYPES`. Aucune modification du barrel racine `entities/index.ts` n'est necessaire car il fait deja `export * from './system/index.js'`.

#### 3.6.12 Piege - Validite non bornee confondue avec absence d'expiration

Pourquoi : la colonne `expires_at` est `NOT NULL` au niveau schema. Meme `multi_tenant_user_access` doit fournir une date d'expiration ; sa specificite est qu'elle peut etre tres lointaine (renouvelee), pas qu'elle est nulle. Confondre `requiresTimeBoundedAuthorization === false` avec `expires_at NULL autorise` provoquerait une violation de contrainte NOT NULL.

Solution : documenter dans la JSDoc du helper que `false` signifie "pas de borne de duree metier imposee par le type" et non "expires_at peut etre null". Le service ABAC (7.5a.5) reste responsable de fournir une date d'expiration valide dans tous les cas.

#### 3.6.13 Piege - Confusion entre scope[] et resource_type

Pourquoi : la colonne `scope` (text[]) et la colonne `resource_type` repondent a deux questions differentes. `resource_type` + `resource_id` ciblent UNE ressource precise (par exemple un sinistre donne), tandis que `scope` enumere les permissions accordees sur cette ressource ou ce tenant (par exemple `['mission:read', 'mission:update_status']`). Confondre les deux, par exemple en mettant `'mission'` dans `scope` au lieu de `resource_type`, produirait une autorisation sans ressource ciblee et avec un scope incoherent.

Solution : documenter la separation des responsabilites. `resource_type` est typee par l'union `CrossTenantResourceType`, `scope` est un tableau de chaines libres au format `{ressource}:{action}`. Le schema Zod `createCrossTenantAuthorizationSchema` distingue clairement les deux champs. Les tests d'instanciation (section 7.2) renseignent les deux champs separement pour illustrer l'usage correct.

#### 3.6.14 Piege - z.enum versus z.union de litteraux

Pourquoi : on pourrait modeliser l'union Zod via `z.union([z.literal('a'), z.literal('b'), ...])`. C'est verbeux, plus lent a la validation et n'expose pas `.options` (utilise par le test anti-drift section 7.8).

Solution : utiliser `z.enum([...])` qui expose `.options` (tableau des valeurs) permettant le balayage exhaustif et le snapshot croise. Le test anti-drift depend explicitement de `crossTenantAuthorizationTypeSchema.options`.

#### 3.6.15 Piege - Ordre des litteraux et stabilite du snapshot

Pourquoi : si le test snapshot comparait l'ordre de declaration des litteraux (et non un ordre trie), tout reordonnancement esthetique de l'union casserait le test sans raison metier.

Solution : tous les snapshots trient les valeurs (`.sort()`) avant comparaison. Seuls les ajouts, suppressions et renommages reels declenchent un echec, pas les reorganisations.

#### 3.6.16 Piege - Carrier en CC modelise comme une autorisation distincte

Pourquoi : sur les flux `garage_to_expert_request` et `garage_to_carrier_quote`, le carrier est en copie. La tentation serait de creer une seconde autorisation `garage_to_carrier_*` rien que pour la mise en copie, doublant les lignes et compliquant l'audit.

Solution : la mise en copie est documentee dans `metadata.cc_tenant_ids` (tableau d'UUID de tenants en copie) et non par une autorisation supplementaire. Une autorisation distincte n'est creee que lorsqu'un veritable transfert de droits a lieu (par exemple `garage_to_carrier_quote` quand le carrier doit reellement consulter le devis, pas seulement etre informe).

### 3.7 Decisions referencees

- decision-012 : adoption de l'ecosysteme Assurflow v3.0 a 6 acteurs (assure, tow, garage, expert, carrier, platform). Justifie l'introduction des 4 nouveaux types.
- decision-013 : modelisation des types d'autorisation par union de litteraux TS adossee a un CHECK SQL plutot que par enum natif ou table de lookup. Justifie la conservation du pattern union.
- decision-014 : regle metier "toute autorisation inter-tenant est time-bounded sauf l'acces super-admin plateforme". Justifie le helper `requiresTimeBoundedAuthorization`.

---

## 4. Architecture context

### 4.1 Position dans le sprint 7.5a

```
Sprint 7.5a - Assurflow Foundation (Phase 2.5 Migration)
  7.5a.1  Scaffolding package assurflow                 [termine]
  7.5a.2  Extension des 26 roles tenant-user            [DEPENDANCE - doit etre mergee]
  7.5a.3  Extension CrossTenantAuthorizationType 3->7    <=== CETTE TACHE (3/10)
  7.5a.4  Migration DB : CHECK aligne + expert_designations [BLOQUEE par 7.5a.3]
  7.5a.5  Service ABAC consommant requiresTimeBounded    [BLOQUEE par 7.5a.3]
  7.5a.6  Entites mission / expertise / parts_order
  7.5a.7  Topics Kafka ecosysteme
  7.5a.8  Endpoints dispatch remorquage
  7.5a.9  Endpoints expertise
  7.5a.10 Tests E2E parcours sinistre complet
```

### 4.2 Chaine de dependance directe

- En amont : 7.5a.2 a etendu les roles tenant-user a 26 valeurs (notamment `tow_dispatcher`, `expert_assessor`, `carrier_claims_handler`). Ces roles sont les acteurs qui creeront/consommeront les autorisations definies ici.
- En aval direct : 7.5a.4 consommera litteralement les 7 chaines `CrossTenantAuthorizationType` et les 8 chaines `CrossTenantResourceType` pour construire la contrainte `CHECK (type IN (...))` et `CHECK (resource_type IN (...) OR resource_type IS NULL)`. Toute divergence casse l'integrite.
- En aval direct : 7.5a.5 importera `requiresTimeBoundedAuthorization` depuis `@insurtech/database` pour decider, dans le service ABAC, s'il faut imposer une `expires_at` future bornee selon le type.

### 4.3 Diagramme ASCII des 7 flux cross-tenant entre les 6 acteurs

```
                         +-------------------+
                         |   PLATFORM        |
                         |  (super_admin)    |
                         +---------+---------+
                                   |
              multi_tenant_user_access (NON borne, persistant)
                                   |
                                   v  (acces a tout tenant)
   +-----------+   +-----------+   +-----------+   +-----------+   +-----------+
   |  ASSURE / |   |   TOW /   |   |  GARAGE   |   |  EXPERT   |   | CARRIER / |
   |  CLIENT   |   | REMORQUEUR|   |           |   |           |   | ASSUREUR  |
   +-----+-----+   +-----+-----+   +-----+-----+   +-----+-----+   +-----+-----+
         |               |               |               |               |
         | (1) client_to_tower_dispatch  |               |               |
         +-------------> | duree mission |               |               |
                         |               |               |               |
                         | (2) tower_to_garage_delivery  |               |
                         +-------------> | jusqu'a livr. |               |
                                         |               |               |
                                         | (3) garage_to_expert_request  |
                                         +-------------> | 30 jours      |
                                         |               | (carrier CC)  |
                                         |               |               |
                                         | (4) garage_to_carrier_quote (apres validation expert)
                                         +---------------------------------------------> | 30j
                                         |               |               |               |
         (existant) broker_to_garage_assignment : BROKER ----------------> GARAGE
         (existant) assure_to_garage_visit       : ASSURE ----------------> GARAGE
```

Legende : la fleche part du `from_tenant_id` (createur de l'autorisation) vers le `to_tenant_id` (consommateur). Le carrier est en CC sur les flux 3 et 4 via le champ `metadata` (cle `cc_tenant_ids`), sans creer une autorisation distincte pour la simple mise en copie.

---

## 5. Livrables checkables

- [ ] L'union `CrossTenantAuthorizationType` compte exactement 7 valeurs.
- [ ] Les 3 valeurs historiques (`broker_to_garage_assignment`, `assure_to_garage_visit`, `multi_tenant_user_access`) sont inchangees au caractere pres.
- [ ] Les 4 nouvelles valeurs (`client_to_tower_dispatch`, `tower_to_garage_delivery`, `garage_to_expert_request`, `garage_to_carrier_quote`) sont presentes.
- [ ] L'union `CrossTenantResourceType` compte exactement 8 valeurs.
- [ ] Les 5 valeurs historiques (`sinistre`, `police`, `devis`, `facture`, `tenant`) sont inchangees.
- [ ] Les 3 nouvelles ressources (`mission`, `expertise`, `parts_order`) sont presentes.
- [ ] Chaque nouveau type d'autorisation porte une JSDoc indiquant createur, consommateur, validite typique.
- [ ] Le helper `requiresTimeBoundedAuthorization(type)` est exporte avec JSDoc complete.
- [ ] Le helper retourne `false` uniquement pour `multi_tenant_user_access`.
- [ ] Le tableau gele `ALL_CROSS_TENANT_TYPES` est exporte (readonly, 7 entrees, `Object.freeze`).
- [ ] Le tableau gele `ALL_CROSS_TENANT_RESOURCE_TYPES` est exporte (readonly, 8 entrees, `Object.freeze`).
- [ ] L'entite `CrossTenantAuthorization` conserve toutes ses colonnes et index existants a l'identique.
- [ ] Le fichier `system/index.ts` exporte le helper et les deux tableaux geles.
- [ ] Le fichier de tests `cross-tenant-authorization.spec.ts` existe et compte >=20 cas `it`.
- [ ] Un schema Zod miroir `crossTenantAuthorizationTypeSchema` est fourni dans `@insurtech/shared-types`.
- [ ] Le typecheck du package `@insurtech/database` passe.
- [ ] Le lint du package `@insurtech/database` passe (aucun `import *`, aucun `console.*`).
- [ ] Les tests du package `@insurtech/database` passent.
- [ ] La couverture du fichier entite/helper est >=90%.
- [ ] Aucune emoji presente dans les fichiers modifies (verifie par `check-no-emoji.sh`).
- [ ] Aucun placeholder (`TODO`/`FIXME`/`...`) introduit dans le code de production.
- [ ] Le commit suit Conventional Commits avec body complet (Task/Sprint/Phase/Reference).
- [ ] Le snapshot des valeurs de type est capture et stable.
- [ ] La note d'integration documentant la dependance au CHECK SQL de 7.5a.4 est presente dans la spec.

---

## 6. Fichiers crees / modifies

| Fichier | Action | Delta lignes | Description |
| --- | --- | --- | --- |
| `packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | Modifie | +~35 | Extension des 2 unions, ajout du helper et des 2 tableaux geles, JSDoc enrichie. Entite et colonnes inchangees. |
| `packages/database/src/entities/system/cross-tenant-authorization.spec.ts` | Cree | +~140 | Suite de tests Vitest (>=20 it) : unions, helper, tableaux geles, snapshot, retro-compatibilite. |
| `packages/database/src/entities/system/index.ts` | Modifie | +~3 | Ajout des exports du helper et des deux tableaux geles. |
| `packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.ts` | Cree | +~70 | Schema Zod miroir des unions pour validation runtime. |
| `packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.spec.ts` | Cree | +~50 | Tests de parse/reject du schema Zod. |
| `packages/shared-types/src/index.ts` | Modifie | +~1 | Reexport du barrel cross-tenant si non present. |

Note : aucune modification du barrel racine `packages/database/src/entities/index.ts` n'est requise (il fait deja `export * from './system/index.js'`). On verifie simplement la propagation.

---

## 7. Code patterns complets

### 7.1 Fichier entite complet etendu

Chemin : `packages/database/src/entities/system/cross-tenant-authorization.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTenant } from './auth-tenant.entity.js';
import { AuthUser } from './auth-user.entity.js';

/**
 * Types d'autorisation inter-tenants reconnus par la plateforme Skalean
 * InsurTech, etendus pour l'ecosysteme Assurflow v3.0 (decision-012).
 *
 * Chaque valeur represente un transfert de droits entre deux organisations
 * juridiquement distinctes (deux tenants), trace, borne dans le temps (sauf
 * `multi_tenant_user_access`) et revocable. La colonne SQL `type` est un
 * `text` contraint par un CHECK aligne sur cette union (migration 7.5a.4).
 *
 * Source de verite cote application. Toute valeur ajoutee ici DOIT etre
 * ajoutee a l'identique a la contrainte CHECK SQL pour eviter tout drift.
 *
 * Types historiques (Sprint 6, inchanges) :
 * - `broker_to_garage_assignment` : un courtier affecte un sinistre a un
 *   garage. from_tenant = broker, to_tenant = garage. Borne dans le temps.
 * - `assure_to_garage_visit` : un assure obtient un droit de visite/depot
 *   chez un garage. from_tenant = assure, to_tenant = garage. Borne.
 * - `multi_tenant_user_access` : acces cross-tenant de la super-administration
 *   plateforme (role `super_admin_platform`). from_tenant = platform,
 *   to_tenant = tout tenant cible. SEUL type NON borne dans le temps (acces
 *   persistant renouvelable). Voir `requiresTimeBoundedAuthorization`.
 *
 * Types Assurflow v3.0 (nouveaux) :
 * - `client_to_tower_dispatch` : le client commande un remorqueur via
 *   l'application mobile. Cree par le tenant assure/client (createur),
 *   consomme par le tenant remorqueur (tow). Validite typique : la duree de
 *   la mission de depannage (quelques heures). Borne dans le temps.
 * - `tower_to_garage_delivery` : le remorqueur livre le vehicule au garage
 *   choisi. Cree par le tenant remorqueur (tow), consomme par le tenant
 *   garage. Validite typique : jusqu'a la completion de la livraison (jour
 *   meme). Borne dans le temps.
 * - `garage_to_expert_request` : le garage communique avec l'expert designe
 *   par le carrier ; le carrier est en copie (CC via metadata.cc_tenant_ids).
 *   Cree par le tenant garage (createur), consomme par le tenant expert.
 *   Validite : 30 jours (delai d'expertise ACAPS). Borne dans le temps.
 * - `garage_to_carrier_quote` : le garage transmet l'information du devis au
 *   carrier, apres validation de l'expert (le carrier est en CC). Cree par le
 *   tenant garage (createur), consomme par le tenant carrier. Validite :
 *   30 jours. Borne dans le temps.
 */
export type CrossTenantAuthorizationType =
  | 'broker_to_garage_assignment'
  | 'assure_to_garage_visit'
  | 'multi_tenant_user_access'
  | 'client_to_tower_dispatch'
  | 'tower_to_garage_delivery'
  | 'garage_to_expert_request'
  | 'garage_to_carrier_quote';

/**
 * Types de ressources sur lesquelles une autorisation inter-tenant peut etre
 * ciblee (colonne `resource_type`, nullable). Lorsque `resource_type` est
 * `null`, l'autorisation porte sur le tenant entier, sans ressource precise.
 *
 * Ressources historiques (Sprint 6, inchangees) : `sinistre`, `police`,
 * `devis`, `facture`, `tenant`.
 *
 * Ressources Assurflow v3.0 (nouvelles) :
 * - `mission` : mission de remorquage (tow mission), partagee du client vers
 *   le remorqueur puis du remorqueur vers le garage.
 * - `expertise` : dossier / rapport d'expertise produit par l'expert designe.
 * - `parts_order` : commande de pieces detachees via PartsHub.
 *
 * La colonne SQL `resource_type` est un `text` nullable contraint par un CHECK
 * aligne sur cette union (migration 7.5a.4).
 */
export type CrossTenantResourceType =
  | 'sinistre'
  | 'police'
  | 'devis'
  | 'facture'
  | 'tenant'
  | 'mission'
  | 'expertise'
  | 'parts_order';

/**
 * Liste canonique gelee de tous les types d'autorisation inter-tenants.
 * Utilisee pour l'iteration exhaustive dans les tests, les validateurs Zod
 * et les futures migrations. L'ordre n'a pas d'importance metier mais est
 * stable pour faciliter les snapshots.
 *
 * Le tableau est gele (`Object.freeze`) pour empecher toute mutation
 * accidentelle de la liste canonique cote consommateur.
 */
export const ALL_CROSS_TENANT_TYPES: readonly CrossTenantAuthorizationType[] =
  Object.freeze([
    'broker_to_garage_assignment',
    'assure_to_garage_visit',
    'multi_tenant_user_access',
    'client_to_tower_dispatch',
    'tower_to_garage_delivery',
    'garage_to_expert_request',
    'garage_to_carrier_quote',
  ] as const);

/**
 * Liste canonique gelee de tous les types de ressources inter-tenants.
 * Utilisee pour l'iteration exhaustive dans les tests, les validateurs Zod
 * et les futures migrations.
 *
 * Le tableau est gele (`Object.freeze`) pour empecher toute mutation
 * accidentelle de la liste canonique cote consommateur.
 */
export const ALL_CROSS_TENANT_RESOURCE_TYPES: readonly CrossTenantResourceType[] =
  Object.freeze([
    'sinistre',
    'police',
    'devis',
    'facture',
    'tenant',
    'mission',
    'expertise',
    'parts_order',
  ] as const);

/**
 * Indique si un type d'autorisation inter-tenant doit imposer une borne de
 * duree metier (expiration bornee imposee par le type).
 *
 * Regle metier (decision-014) : toute autorisation inter-tenant est bornee
 * dans le temps, a l'exception de `multi_tenant_user_access` qui est l'acces
 * persistant de la super-administration plateforme (role
 * `super_admin_platform`). Ce dernier reste renouvelable mais n'est pas
 * contraint a une duree courte imposee par le type lui-meme.
 *
 * Important : un retour `false` signifie "aucune borne de duree metier imposee
 * par le type", et NON "expires_at peut etre NULL". La colonne `expires_at`
 * reste NOT NULL au niveau schema dans tous les cas ; le service ABAC
 * (Sprint 7 tache 2.3.7 / 7.5a.5) reste responsable de fournir une date
 * d'expiration valide pour chaque autorisation, y compris persistante.
 *
 * L'implementation procede par exclusion (et non par liste positive) afin que
 * tout futur type soit borne dans le temps par defaut, comportement le plus
 * sur et le plus conforme a la minimisation du partage de donnees (loi 09-08).
 *
 * @param type - Le type d'autorisation inter-tenant a evaluer.
 * @returns `true` si le type impose une borne de duree metier, `false` pour
 *   l'unique type non borne `multi_tenant_user_access`.
 *
 * @example
 * requiresTimeBoundedAuthorization('garage_to_expert_request'); // true
 * requiresTimeBoundedAuthorization('multi_tenant_user_access'); // false
 */
export function requiresTimeBoundedAuthorization(
  type: CrossTenantAuthorizationType,
): boolean {
  return type !== 'multi_tenant_user_access';
}

/**
 * Cross-tenant authorization (Sprint 6 framework / Sprint 26 runtime),
 * etendue pour l'ecosysteme Assurflow v3.0 (Sprint 7.5a).
 *
 * Helper Postgres `app_can_access_tenant(target)` Cond 3 :
 *   IF app_cross_tenant_authorization_id() points to active row
 *      WHERE from_tenant_id = current OR to_tenant_id = target
 *      AND revoked_at IS NULL AND expires_at > NOW()
 *   THEN allow.
 *
 * Index partiel actif : `WHERE revoked_at IS NULL AND expires_at > NOW()`
 * pour minimiser le scan a chaque verification.
 */
@Entity('cross_tenant_authorizations')
@Index('idx_cta_from_tenant', ['fromTenantId'])
@Index('idx_cta_to_tenant', ['toTenantId'])
@Index('idx_cta_type', ['type'])
export class CrossTenantAuthorization {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'type', type: 'text' })
  type!: CrossTenantAuthorizationType;

  @Column({ name: 'from_tenant_id', type: 'uuid' })
  fromTenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_tenant_id' })
  fromTenant!: AuthTenant;

  @Column({ name: 'to_tenant_id', type: 'uuid' })
  toTenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_tenant_id' })
  toTenant!: AuthTenant;

  @Column({ name: 'scope', type: 'text', array: true, default: () => `'{}'::text[]` })
  scope!: string[];

  @Column({ name: 'resource_type', type: 'text', nullable: true })
  resourceType!: CrossTenantResourceType | null;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ name: 'granted_by_user_id', type: 'uuid' })
  grantedByUserId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'granted_by_user_id' })
  grantedByUser!: AuthUser;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_by_user_id', type: 'uuid', nullable: true })
  revokedByUserId!: string | null;

  @Column({ name: 'revoked_reason', type: 'text', nullable: true })
  revokedReason!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;
}
```

Notes importantes :
- L'entite et ses colonnes/index sont reproduites a l'identique du fichier reel. Seuls les deux unions ont ete etendues et trois nouveaux symboles exportes (le helper et les deux tableaux) ont ete ajoutes en tete de fichier.
- Les imports nommes de TypeORM sont conserves tels quels (aucun `import *`). Les extensions `.js` ESM sont preservees.
- Les tableaux geles utilisent `as const` puis `Object.freeze` ; le type annote `readonly ...[]` empeche la mutation a la compilation, `Object.freeze` l'empeche au runtime.
- Le helper procede par exclusion (`!== 'multi_tenant_user_access'`) pour rendre tout futur type time-bounded par defaut (piege 3.6.4).
- Aucun `console.*`, aucune emoji, aucun placeholder.

### 7.2 Fichier de tests complet

Chemin : `packages/database/src/entities/system/cross-tenant-authorization.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  ALL_CROSS_TENANT_TYPES,
  ALL_CROSS_TENANT_RESOURCE_TYPES,
  CrossTenantAuthorization,
  requiresTimeBoundedAuthorization,
  type CrossTenantAuthorizationType,
  type CrossTenantResourceType,
} from './cross-tenant-authorization.entity.js';

describe('CrossTenantAuthorizationType union', () => {
  it('contient exactement 7 valeurs', () => {
    expect(ALL_CROSS_TENANT_TYPES).toHaveLength(7);
  });

  it('conserve les 3 types historiques inchanges', () => {
    expect(ALL_CROSS_TENANT_TYPES).toContain('broker_to_garage_assignment');
    expect(ALL_CROSS_TENANT_TYPES).toContain('assure_to_garage_visit');
    expect(ALL_CROSS_TENANT_TYPES).toContain('multi_tenant_user_access');
  });

  it('introduit les 4 nouveaux types Assurflow v3.0', () => {
    expect(ALL_CROSS_TENANT_TYPES).toContain('client_to_tower_dispatch');
    expect(ALL_CROSS_TENANT_TYPES).toContain('tower_to_garage_delivery');
    expect(ALL_CROSS_TENANT_TYPES).toContain('garage_to_expert_request');
    expect(ALL_CROSS_TENANT_TYPES).toContain('garage_to_carrier_quote');
  });

  it('accepte un type valide a la compilation (type-check runtime indirect)', () => {
    const valid: CrossTenantAuthorizationType = 'client_to_tower_dispatch';
    expect(ALL_CROSS_TENANT_TYPES).toContain(valid);
  });

  it('snapshot canonique des 7 valeurs (detecte tout renommage ou ajout)', () => {
    const sorted = [...ALL_CROSS_TENANT_TYPES].sort();
    expect(sorted).toEqual([
      'assure_to_garage_visit',
      'broker_to_garage_assignment',
      'client_to_tower_dispatch',
      'garage_to_carrier_quote',
      'garage_to_expert_request',
      'multi_tenant_user_access',
      'tower_to_garage_delivery',
    ]);
  });

  it('ne contient aucun doublon', () => {
    const unique = new Set(ALL_CROSS_TENANT_TYPES);
    expect(unique.size).toBe(ALL_CROSS_TENANT_TYPES.length);
  });
});

describe('CrossTenantResourceType union', () => {
  it('contient exactement 8 valeurs', () => {
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toHaveLength(8);
  });

  it('conserve les 5 ressources historiques inchangees', () => {
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('sinistre');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('police');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('devis');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('facture');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('tenant');
  });

  it('introduit les 3 nouvelles ressources Assurflow v3.0', () => {
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('mission');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('expertise');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('parts_order');
  });

  it('snapshot canonique des 8 valeurs', () => {
    const sorted = [...ALL_CROSS_TENANT_RESOURCE_TYPES].sort();
    expect(sorted).toEqual([
      'devis',
      'expertise',
      'facture',
      'mission',
      'parts_order',
      'police',
      'sinistre',
      'tenant',
    ]);
  });

  it('accepte la valeur null comme ressource au niveau type (nullable)', () => {
    const noResource: CrossTenantResourceType | null = null;
    expect(noResource).toBeNull();
  });

  it('ne contient aucun doublon', () => {
    const unique = new Set(ALL_CROSS_TENANT_RESOURCE_TYPES);
    expect(unique.size).toBe(ALL_CROSS_TENANT_RESOURCE_TYPES.length);
  });
});

describe('requiresTimeBoundedAuthorization', () => {
  it('retourne false uniquement pour multi_tenant_user_access', () => {
    expect(requiresTimeBoundedAuthorization('multi_tenant_user_access')).toBe(
      false,
    );
  });

  it('retourne true pour broker_to_garage_assignment', () => {
    expect(
      requiresTimeBoundedAuthorization('broker_to_garage_assignment'),
    ).toBe(true);
  });

  it('retourne true pour assure_to_garage_visit', () => {
    expect(requiresTimeBoundedAuthorization('assure_to_garage_visit')).toBe(
      true,
    );
  });

  it('retourne true pour client_to_tower_dispatch', () => {
    expect(requiresTimeBoundedAuthorization('client_to_tower_dispatch')).toBe(
      true,
    );
  });

  it('retourne true pour tower_to_garage_delivery', () => {
    expect(requiresTimeBoundedAuthorization('tower_to_garage_delivery')).toBe(
      true,
    );
  });

  it('retourne true pour garage_to_expert_request', () => {
    expect(requiresTimeBoundedAuthorization('garage_to_expert_request')).toBe(
      true,
    );
  });

  it('retourne true pour garage_to_carrier_quote', () => {
    expect(requiresTimeBoundedAuthorization('garage_to_carrier_quote')).toBe(
      true,
    );
  });

  it('retourne true pour tous les types sauf multi_tenant_user_access (balayage exhaustif)', () => {
    for (const type of ALL_CROSS_TENANT_TYPES) {
      const expected = type !== 'multi_tenant_user_access';
      expect(requiresTimeBoundedAuthorization(type)).toBe(expected);
    }
  });

  it('garantit qu un seul type est non borne dans le temps', () => {
    const nonBounded = ALL_CROSS_TENANT_TYPES.filter(
      (t) => !requiresTimeBoundedAuthorization(t),
    );
    expect(nonBounded).toEqual(['multi_tenant_user_access']);
  });
});

describe('Tableaux geles', () => {
  it('ALL_CROSS_TENANT_TYPES est gele (immuable au runtime)', () => {
    expect(Object.isFrozen(ALL_CROSS_TENANT_TYPES)).toBe(true);
  });

  it('ALL_CROSS_TENANT_RESOURCE_TYPES est gele (immuable au runtime)', () => {
    expect(Object.isFrozen(ALL_CROSS_TENANT_RESOURCE_TYPES)).toBe(true);
  });

  it('refuse la mutation de ALL_CROSS_TENANT_TYPES', () => {
    expect(() => {
      // @ts-expect-error mutation interdite sur readonly frozen
      ALL_CROSS_TENANT_TYPES.push('invalid_type');
    }).toThrow();
  });
});

describe('Entite CrossTenantAuthorization (metadata TypeORM)', () => {
  it('est instanciable et expose les colonnes attendues', () => {
    const auth = new CrossTenantAuthorization();
    auth.type = 'garage_to_expert_request';
    auth.fromTenantId = '00000000-0000-0000-0000-000000000001';
    auth.toTenantId = '00000000-0000-0000-0000-000000000002';
    auth.scope = [];
    auth.resourceType = 'expertise';
    auth.resourceId = null;
    auth.grantedByUserId = '00000000-0000-0000-0000-000000000003';
    auth.expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    auth.revokedAt = null;
    auth.revokedByUserId = null;
    auth.revokedReason = null;
    auth.metadata = { cc_tenant_ids: ['00000000-0000-0000-0000-000000000004'] };

    expect(auth.type).toBe('garage_to_expert_request');
    expect(auth.resourceType).toBe('expertise');
    expect(auth.resourceId).toBeNull();
    expect(requiresTimeBoundedAuthorization(auth.type)).toBe(true);
  });

  it('accepte resourceType null pour une autorisation au niveau tenant', () => {
    const auth = new CrossTenantAuthorization();
    auth.type = 'multi_tenant_user_access';
    auth.resourceType = null;
    expect(auth.resourceType).toBeNull();
    expect(requiresTimeBoundedAuthorization(auth.type)).toBe(false);
  });
});

/**
 * NOTE D'INTEGRATION (dependance 7.5a.4) :
 * Les 7 chaines de `ALL_CROSS_TENANT_TYPES` et les 8 chaines de
 * `ALL_CROSS_TENANT_RESOURCE_TYPES` DOIVENT correspondre exactement a la
 * contrainte CHECK ajoutee par la migration 7.5a.4 sur les colonnes `type`
 * et `resource_type` de la table `cross_tenant_authorizations`. Le test
 * d'integration suivant sera active lorsque 7.5a.4 sera mergee : il insere
 * une autorisation de chaque type via le repository et verifie l'absence de
 * violation de contrainte CHECK.
 */
describe('Integration CHECK SQL (active en 7.5a.4)', () => {
  it.todo(
    'insere une autorisation de chacun des 7 types sans violation de CHECK',
  );
  it.todo(
    'rejette une valeur de type inconnue avec violation de CHECK 23514',
  );
});
```

Notes importantes :
- Le test `// @ts-expect-error` valide a la fois l'immuabilite runtime (`toThrow`) et l'interdiction a la compilation (le commentaire echoue le build si la mutation devenait permise, signalant une regression de typage).
- Les tests `it.todo` documentent la dependance a 7.5a.4 sans faire echouer la suite, et seront convertis en tests reels lors de cette tache aval.
- Aucune connexion DB n'est requise pour cette suite (tests purement unitaires sur les types et le helper) ; l'instanciation de l'entite teste uniquement la structure de classe, pas la persistance.

### 7.3 Diff de l'index system

Chemin : `packages/database/src/entities/system/index.ts`

```typescript
export {
  CrossTenantAuthorization,
  ALL_CROSS_TENANT_TYPES,
  ALL_CROSS_TENANT_RESOURCE_TYPES,
  requiresTimeBoundedAuthorization,
  type CrossTenantAuthorizationType,
  type CrossTenantResourceType,
} from './cross-tenant-authorization.entity.js';
```

Notes importantes :
- Seul le bloc d'export nomme de `cross-tenant-authorization.entity.js` est modifie : on ajoute le helper et les deux tableaux geles. Les exports de type existants sont conserves.
- Le tableau `systemEntities` plus bas dans le fichier reste inchange (l'entite y est deja referencee).
- Le barrel racine `entities/index.ts` n'a pas besoin de modification (`export * from './system/index.js'` propage automatiquement les nouveaux exports nommes).

### 7.4 Schema Zod miroir (validation runtime)

Chemin : `packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Schema Zod miroir de l'union `CrossTenantAuthorizationType` de
 * `@insurtech/database`. Sert a valider au runtime (DTO API, payloads
 * d'evenements Kafka) les types d'autorisation inter-tenants.
 *
 * Cette liste DOIT rester strictement synchronisee avec
 * `ALL_CROSS_TENANT_TYPES` de l'entite `CrossTenantAuthorization` et avec la
 * contrainte CHECK SQL (migration 7.5a.4). Toute divergence est detectee par
 * le test snapshot croise.
 */
export const crossTenantAuthorizationTypeSchema = z.enum([
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
]);

export type CrossTenantAuthorizationTypeInput = z.infer<
  typeof crossTenantAuthorizationTypeSchema
>;

/**
 * Schema Zod miroir de l'union `CrossTenantResourceType`. Nullable car une
 * autorisation peut porter sur le tenant entier (resource_type = null).
 */
export const crossTenantResourceTypeSchema = z
  .enum([
    'sinistre',
    'police',
    'devis',
    'facture',
    'tenant',
    'mission',
    'expertise',
    'parts_order',
  ])
  .nullable();

export type CrossTenantResourceTypeInput = z.infer<
  typeof crossTenantResourceTypeSchema
>;

/**
 * Schema de creation d'une autorisation inter-tenant (DTO API).
 * `expiresAt` est exige meme pour les types non bornes par le type lui-meme
 * (cf `requiresTimeBoundedAuthorization`) : le schema impose toujours une date.
 */
export const createCrossTenantAuthorizationSchema = z.object({
  type: crossTenantAuthorizationTypeSchema,
  fromTenantId: z.string().uuid(),
  toTenantId: z.string().uuid(),
  scope: z.array(z.string()).default([]),
  resourceType: crossTenantResourceTypeSchema.default(null),
  resourceId: z.string().uuid().nullable().default(null),
  expiresAt: z.coerce.date(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type CreateCrossTenantAuthorizationInput = z.infer<
  typeof createCrossTenantAuthorizationSchema
>;
```

Notes importantes :
- On utilise `z.enum` (et non `z.union(z.literal(...))`) pour la concision et la performance ; le resultat de `z.infer` est l'union de litteraux exacte.
- `crossTenantResourceTypeSchema` est `.nullable()` et non `.optional()` (piege 3.6.2).
- `createCrossTenantAuthorizationSchema.expiresAt` est toujours requis, conformement au piege 3.6.12 (NOT NULL au niveau schema meme pour les types non bornes).

### 7.5 Tests du schema Zod

Chemin : `packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  crossTenantAuthorizationTypeSchema,
  crossTenantResourceTypeSchema,
  createCrossTenantAuthorizationSchema,
} from './cross-tenant-authorization.schema.js';

describe('crossTenantAuthorizationTypeSchema', () => {
  it('accepte les 7 types valides', () => {
    for (const t of [
      'broker_to_garage_assignment',
      'assure_to_garage_visit',
      'multi_tenant_user_access',
      'client_to_tower_dispatch',
      'tower_to_garage_delivery',
      'garage_to_expert_request',
      'garage_to_carrier_quote',
    ]) {
      expect(crossTenantAuthorizationTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejette un type inconnu', () => {
    expect(
      crossTenantAuthorizationTypeSchema.safeParse('garage_to_unknown').success,
    ).toBe(false);
  });

  it('rejette une chaine vide', () => {
    expect(crossTenantAuthorizationTypeSchema.safeParse('').success).toBe(false);
  });
});

describe('crossTenantResourceTypeSchema', () => {
  it('accepte les 8 ressources valides', () => {
    for (const r of [
      'sinistre',
      'police',
      'devis',
      'facture',
      'tenant',
      'mission',
      'expertise',
      'parts_order',
    ]) {
      expect(crossTenantResourceTypeSchema.safeParse(r).success).toBe(true);
    }
  });

  it('accepte null (autorisation au niveau tenant)', () => {
    expect(crossTenantResourceTypeSchema.safeParse(null).success).toBe(true);
  });

  it('rejette une ressource inconnue', () => {
    expect(crossTenantResourceTypeSchema.safeParse('contract').success).toBe(
      false,
    );
  });
});

describe('createCrossTenantAuthorizationSchema', () => {
  it('parse un payload complet valide', () => {
    const result = createCrossTenantAuthorizationSchema.safeParse({
      type: 'client_to_tower_dispatch',
      fromTenantId: '00000000-0000-0000-0000-000000000001',
      toTenantId: '00000000-0000-0000-0000-000000000002',
      scope: ['mission:read'],
      resourceType: 'mission',
      resourceId: '00000000-0000-0000-0000-000000000003',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      metadata: {},
    });
    expect(result.success).toBe(true);
  });

  it('applique les valeurs par defaut (scope, resourceType, metadata)', () => {
    const parsed = createCrossTenantAuthorizationSchema.parse({
      type: 'multi_tenant_user_access',
      fromTenantId: '00000000-0000-0000-0000-000000000001',
      toTenantId: '00000000-0000-0000-0000-000000000002',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    expect(parsed.scope).toEqual([]);
    expect(parsed.resourceType).toBeNull();
    expect(parsed.metadata).toEqual({});
  });

  it('rejette un payload sans expiresAt', () => {
    const result = createCrossTenantAuthorizationSchema.safeParse({
      type: 'tower_to_garage_delivery',
      fromTenantId: '00000000-0000-0000-0000-000000000001',
      toTenantId: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(false);
  });

  it('rejette un fromTenantId non UUID', () => {
    const result = createCrossTenantAuthorizationSchema.safeParse({
      type: 'garage_to_carrier_quote',
      fromTenantId: 'not-a-uuid',
      toTenantId: '00000000-0000-0000-0000-000000000002',
      expiresAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
```

Notes importantes :
- Les tests Zod garantissent la coherence runtime du contrat. Le snapshot croise (test ci-dessous) verifie que l'enum Zod et l'union TS listent les memes valeurs.

### 7.6 Exemple d'usage dans une politique ABAC (Sprint 7.5a.5, illustratif)

Chemin (futur, illustratif) : `packages/auth/src/abac/cross-tenant.policy.ts`

```typescript
import {
  requiresTimeBoundedAuthorization,
  type CrossTenantAuthorizationType,
} from '@insurtech/database';

const MAX_BOUNDED_DURATION_MS = 30 * 24 * 3600 * 1000; // 30 jours (plafond ACAPS)

/**
 * Valide la date d'expiration proposee pour une autorisation inter-tenant.
 * Pour les types bornes dans le temps, impose une expiration future et
 * inferieure au plafond. Pour le type non borne (multi_tenant_user_access),
 * exige uniquement une date future (renouvelable).
 */
export function validateAuthorizationExpiry(
  type: CrossTenantAuthorizationType,
  expiresAt: Date,
  now: Date = new Date(),
): { valid: boolean; reason?: string } {
  if (expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: 'expires_at_in_past' };
  }
  if (requiresTimeBoundedAuthorization(type)) {
    const horizon = now.getTime() + MAX_BOUNDED_DURATION_MS;
    if (expiresAt.getTime() > horizon) {
      return { valid: false, reason: 'expires_at_exceeds_bounded_horizon' };
    }
  }
  return { valid: true };
}
```

Notes importantes :
- Cet exemple illustre comment 7.5a.5 consomme le helper. Il n'est PAS livre par cette tache 7.5a.3 (il est fourni a titre de documentation du contrat consomme).

### 7.7 Exemple de reference des chaines dans la migration 7.5a.4 (illustratif)

Chemin (futur, illustratif) : `packages/database/src/migrations/1730000000000-AssurflowCrossTenantCheck.ts`

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';

const TYPES = [
  'broker_to_garage_assignment',
  'assure_to_garage_visit',
  'multi_tenant_user_access',
  'client_to_tower_dispatch',
  'tower_to_garage_delivery',
  'garage_to_expert_request',
  'garage_to_carrier_quote',
];

const RESOURCE_TYPES = [
  'sinistre',
  'police',
  'devis',
  'facture',
  'tenant',
  'mission',
  'expertise',
  'parts_order',
];

export class AssurflowCrossTenantCheck1730000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const typeList = TYPES.map((t) => `'${t}'`).join(', ');
    const resourceList = RESOURCE_TYPES.map((r) => `'${r}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE cross_tenant_authorizations
       DROP CONSTRAINT IF EXISTS chk_cta_type`,
    );
    await queryRunner.query(
      `ALTER TABLE cross_tenant_authorizations
       ADD CONSTRAINT chk_cta_type CHECK (type IN (${typeList}))`,
    );
    await queryRunner.query(
      `ALTER TABLE cross_tenant_authorizations
       DROP CONSTRAINT IF EXISTS chk_cta_resource_type`,
    );
    await queryRunner.query(
      `ALTER TABLE cross_tenant_authorizations
       ADD CONSTRAINT chk_cta_resource_type
       CHECK (resource_type IS NULL OR resource_type IN (${resourceList}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE cross_tenant_authorizations
       DROP CONSTRAINT IF EXISTS chk_cta_resource_type`,
    );
    await queryRunner.query(
      `ALTER TABLE cross_tenant_authorizations
       DROP CONSTRAINT IF EXISTS chk_cta_type`,
    );
  }
}
```

Notes importantes :
- Cet exemple montre comment 7.5a.4 referencera EXACTEMENT les memes chaines. La revue de 7.5a.4 doit comparer ces deux constantes avec `ALL_CROSS_TENANT_TYPES` / `ALL_CROSS_TENANT_RESOURCE_TYPES`. Il n'est PAS livre par cette tache.

### 7.8 Test snapshot croise TS / Zod (anti-drift)

Chemin : `packages/shared-types/src/cross-tenant/cross-tenant-authorization.cross-check.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { crossTenantAuthorizationTypeSchema } from './cross-tenant-authorization.schema.js';

/**
 * Verifie que l'enum Zod liste exactement les 7 types attendus. Si la
 * migration 7.5a.4 ou l'union TS de @insurtech/database diverge, ce snapshot
 * trie le revele immediatement.
 */
describe('Anti-drift TS / Zod / SQL', () => {
  it('enum Zod liste les 7 types canoniques tries', () => {
    const values = [...crossTenantAuthorizationTypeSchema.options].sort();
    expect(values).toEqual([
      'assure_to_garage_visit',
      'broker_to_garage_assignment',
      'client_to_tower_dispatch',
      'garage_to_carrier_quote',
      'garage_to_expert_request',
      'multi_tenant_user_access',
      'tower_to_garage_delivery',
    ]);
  });
});
```

Notes importantes :
- Ce snapshot est intentionnellement identique a celui du fichier entite (section 7.2). Toute divergence entre les deux fichiers (database et shared-types) provoque l'echec d'au moins un des deux tests, signalant le drift.

### 7.9 Barrel shared-types (diff)

Chemin : `packages/shared-types/src/index.ts`

```typescript
export * from './cross-tenant/cross-tenant-authorization.schema.js';
```

Notes importantes :
- Ligne ajoutee uniquement si le barrel ne reexporte pas deja le dossier `cross-tenant`. Verifier la presence avant ajout pour eviter un doublon d'export.

---

## 8. Tests complets

### 8.1 Couverture des unions de types

Les tests de la section 7.2 verifient : longueur exacte (7 et 8), presence de chaque valeur historique et nouvelle, absence de doublon, snapshot canonique trie. Le snapshot trie est la garde principale contre tout renommage ou ajout/suppression involontaire.

### 8.2 Couverture du helper requiresTimeBoundedAuthorization

Chaque type est teste individuellement (7 cas) plus un balayage exhaustif sur `ALL_CROSS_TENANT_TYPES` plus une assertion que `multi_tenant_user_access` est l'unique type non borne. Les deux branches du `if` interne (en realite une seule expression booleenne) sont couvertes : retour `false` (1 type) et retour `true` (6 types).

### 8.3 Couverture des tableaux geles

Tests d'immuabilite (`Object.isFrozen`), de longueur, et de rejet de mutation (`toThrow` + `@ts-expect-error`). Le `@ts-expect-error` agit comme test de regression de typage : si l'annotation `readonly` disparaissait, la compilation echouerait.

### 8.4 Note d'integration CHECK SQL (dependance 7.5a.4)

Deux tests `it.todo` documentent les verifications a activer en 7.5a.4 : insertion d'une autorisation de chacun des 7 types sans violation de contrainte, et rejet d'une valeur inconnue avec code d'erreur Postgres `23514` (check_violation). Ces tests deviendront des tests d'integration reels (avec un repository TypeORM et une base de test) dans la tache aval.

### 8.5 Tests Zod (section 7.5) et anti-drift (section 7.8)

Les schemas Zod sont testes en acceptation (valeurs valides) et en rejet (valeurs inconnues, chaine vide, UUID invalide, absence d'`expiresAt`). Le test anti-drift garantit que l'enum Zod et l'union TS listent le meme ensemble trie.

### 8.6 Recapitulatif du nombre de cas de test

| Suite | Fichier | Nombre de `it` (hors todo) |
| --- | --- | --- |
| CrossTenantAuthorizationType union | entity.spec | 6 |
| CrossTenantResourceType union | entity.spec | 5 |
| requiresTimeBoundedAuthorization | entity.spec | 9 |
| Tableaux geles | entity.spec | 3 |
| Entite CrossTenantAuthorization | entity.spec | 2 |
| crossTenantAuthorizationTypeSchema | schema.spec | 3 |
| crossTenantResourceTypeSchema | schema.spec | 3 |
| createCrossTenantAuthorizationSchema | schema.spec | 4 |
| Anti-drift TS/Zod/SQL | cross-check.spec | 1 |
| Total cas `it` | | 36 |
| Cas `it.todo` (actives en 7.5a.4) | entity.spec | 2 |

Largement au-dessus du seuil de 20 cas exige.

---

## 9. Variables environnement

| Variable | Exemple de valeur | Role |
| --- | --- | --- |
| `NODE_ENV` | `test` | Active le profil de configuration de test pour Vitest. |
| `DATABASE_URL` | `postgres://insurtech:insurtech@localhost:5432/insurtech_test` | Connexion utilisee par les tests d'integration TypeORM (active seulement pour les `it.todo` une fois convertis en 7.5a.4). |
| `PASSWORD_PEPPER` | `dev-pepper-rotate-me-32bytes-minimum` | Non utilise directement ici mais charge par le bootstrap du package auth ; present pour coherence d'environnement. |
| `TZ` | `Africa/Casablanca` | Fuseau horaire des tests temporels (`expiresAt`) ; aligne sur le cloud souverain MA. |
| `VITEST_POOL` | `forks` | Strategie d'isolation des tests TypeORM (evite les fuites de metadata decorateurs entre fichiers). |
| `PNPM_HOME` | `C:\Users\belga\AppData\Local\pnpm` | Repertoire pnpm ; engine-strict impose Node >= 22.11.0. |

---

## 10. Commandes shell

```bash
# A la racine du monorepo

# 1. Verification de type stricte du package database
pnpm --filter @insurtech/database typecheck

# 2. Lint (ESLint flat config) du package database
pnpm --filter @insurtech/database lint

# 3. Tests unitaires Vitest du package database
pnpm --filter @insurtech/database test

# 4. Tests avec couverture (seuil >=90% sur le tier critique)
pnpm --filter @insurtech/database test -- --coverage

# 5. Verification de type + lint + test du package shared-types (schema Zod)
pnpm --filter @insurtech/shared-types typecheck
pnpm --filter @insurtech/shared-types lint
pnpm --filter @insurtech/shared-types test

# 6. Construction des deux packages pour verifier la propagation des exports
pnpm --filter @insurtech/database build
pnpm --filter @insurtech/shared-types build

# 7. Verification no-emoji (decision-006)
bash scripts/check-no-emoji.sh packages/database/src/entities/system/cross-tenant-authorization.entity.ts
bash scripts/check-no-emoji.sh packages/database/src/entities/system/cross-tenant-authorization.spec.ts

# 8. Verification absence de console.*
rg -n "console\." packages/database/src/entities/system/cross-tenant-authorization.entity.ts || echo "OK: aucun console"
```

---

## 11. Criteres de validation

### Criteres P0 (bloquants)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
| --- | --- | --- | --- | --- |
| V1 | L'union `CrossTenantAuthorizationType` a 7 valeurs | `rg -c "'.*'" packages/database/src/entities/system/cross-tenant-authorization.entity.ts` puis inspection | 7 litteraux dans l'union | Type incomplet, casse aval 7.5a.4 |
| V2 | Les 3 types historiques inchanges | `pnpm --filter @insurtech/database test -- -t "types historiques inchanges"` | test vert | Renommage casse les lignes persistees |
| V3 | Les 4 nouveaux types presents | `pnpm --filter @insurtech/database test -- -t "nouveaux types Assurflow"` | test vert | Type manquant, flux non couvert |
| V4 | L'union `CrossTenantResourceType` a 8 valeurs | `pnpm --filter @insurtech/database test -- -t "exactement 8 valeurs"` | test vert | Ressource manquante |
| V5 | Les 5 ressources historiques inchangees | `pnpm --filter @insurtech/database test -- -t "ressources historiques inchangees"` | test vert | Renommage |
| V6 | Les 3 nouvelles ressources presentes | `pnpm --filter @insurtech/database test -- -t "nouvelles ressources Assurflow"` | test vert | Ressource manquante |
| V7 | `requiresTimeBoundedAuthorization` retourne false uniquement pour multi_tenant_user_access | `pnpm --filter @insurtech/database test -- -t "non borne dans le temps"` | test vert | Regle metier violee (decision-014) |
| V8 | Helper teste sur les 7 types | `pnpm --filter @insurtech/database test -- -t "balayage exhaustif"` | test vert | Branche non couverte |
| V9 | Typecheck database passe | `pnpm --filter @insurtech/database typecheck` | exit 0 | Erreur de type, build casse |
| V10 | Lint database passe | `pnpm --filter @insurtech/database lint` | exit 0 | import *, console, style |
| V11 | Tests database passent | `pnpm --filter @insurtech/database test` | exit 0, 0 echec | Regression |
| V12 | Aucune emoji | `bash scripts/check-no-emoji.sh packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | exit 0 | Emoji presente, CI echoue (decision-006) |
| V13 | Entite et colonnes inchangees | `git diff packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | seules les unions + helpers ajoutes | Colonne supprimee/renommee casse le schema |
| V14 | Export du helper et des tableaux dans index system | `rg "requiresTimeBoundedAuthorization" packages/database/src/entities/system/index.ts` | match present | Symbole non accessible depuis @insurtech/database |
| V15 | Snapshot canonique stable | `pnpm --filter @insurtech/database test -- -t "snapshot canonique"` | test vert | Drift de valeurs |
| V16 | Tableaux geles immuables | `pnpm --filter @insurtech/database test -- -t "gele"` | test vert | Mutation possible |

### Criteres P1 (importants)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
| --- | --- | --- | --- | --- |
| V17 | Couverture >=90% sur le fichier entite | `pnpm --filter @insurtech/database test -- --coverage` | >=90% lignes/branches | Tier critique sous seuil |
| V18 | Schema Zod accepte les 7 types | `pnpm --filter @insurtech/shared-types test -- -t "7 types valides"` | test vert | Drift Zod/TS |
| V19 | Schema Zod rejette un type inconnu | `pnpm --filter @insurtech/shared-types test -- -t "type inconnu"` | test vert | Validation laxiste |
| V20 | resource_type Zod accepte null | `pnpm --filter @insurtech/shared-types test -- -t "accepte null"` | test vert | nullable mal gere (piege 3.6.2) |
| V21 | Anti-drift TS/Zod | `pnpm --filter @insurtech/shared-types test -- -t "Anti-drift"` | test vert | Listes divergentes |
| V22 | createCrossTenantAuthorizationSchema exige expiresAt | `pnpm --filter @insurtech/shared-types test -- -t "sans expiresAt"` | test vert (rejet) | NOT NULL viole (piege 3.6.12) |
| V23 | Aucun console.* | `rg "console\." packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | aucun match | Logger strict viole |
| V24 | Build database propage les exports | `pnpm --filter @insurtech/database build` | exit 0, .d.ts contient les symboles | Export non genere |

### Criteres P2 (qualite)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
| --- | --- | --- | --- | --- |
| V25 | JSDoc presente sur chaque nouveau type | inspection / `rg "client_to_tower_dispatch" -A2` JSDoc | bloc JSDoc decrit createur/consommateur/validite | Documentation manquante |
| V26 | Note d'integration 7.5a.4 presente dans la spec | `rg "NOTE D'INTEGRATION" packages/database/src/entities/system/cross-tenant-authorization.spec.ts` | match present | Dependance non documentee |
| V27 | Imports explicites (pas de import *) | `rg "import \*" packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | aucun match | Convention import strict |
| V28 | Extensions .js ESM presentes | `rg "from './auth-tenant.entity.js'" packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | match present | Resolution ESM cassee |
| V29 | Aucun placeholder | `rg "TODO\|FIXME\|\.\.\." packages/database/src/entities/system/cross-tenant-authorization.entity.ts` | aucun match (hors it.todo de spec) | Placeholder interdit |
| V30 | Commit conforme Conventional Commits | `git log -1 --pretty=%s` | `feat(sprint-7.5a): ...` | commitlint echoue |

Total : 30 criteres (P0 : 16, P1 : 8, P2 : 6).

---

## 12. Edge cases et troubleshooting

1. Insertion d'un nouveau type avant 7.5a.4 : tant que la migration n'est pas appliquee, la colonne `type` n'est pas contrainte par les 7 valeurs. Ne persister aucune autorisation des nouveaux types en environnement non migre. Symptome : insertion silencieusement acceptee sans CHECK. Remede : appliquer 7.5a.4.
2. Mutation d'un tableau gele : une tentative de `push` leve `TypeError` en mode strict ESM. Symptome : `Cannot add property ..., object is not extensible`. Remede : ne jamais muter ; cloner avec `[...ALL_CROSS_TENANT_TYPES]` si besoin local.
3. `resourceType` defini a `undefined` au lieu de `null` : avec `exactOptionalPropertyTypes`, `undefined` n'est pas assignable a `CrossTenantResourceType | null`. Symptome : erreur de type. Remede : utiliser `null` explicitement.
4. Drift Zod vs entite : si un developpeur ajoute un type cote entite mais oublie le schema Zod, le test anti-drift (section 7.8) echoue. Remede : mettre a jour les deux listes simultanement.
5. `multi_tenant_user_access` cree sans `expiresAt` : meme non borne par le type, la colonne est NOT NULL. Symptome : violation `not_null_violation` (Postgres 23502). Remede : toujours fournir une date d'expiration (renouvelable).
6. Inversion from/to tenant : creer `garage_to_expert_request` avec `fromTenantId = expert` accorderait le droit dans le mauvais sens. Symptome : l'expert ne voit pas le dossier alors que le garage si. Remede : respecter la table 3.3 (from = createur garage, to = consommateur expert).
7. Test `@ts-expect-error` qui ne declenche aucune erreur : si l'annotation `readonly` est retiree par erreur, le compilateur signale `Unused '@ts-expect-error' directive`. Symptome : echec typecheck. Remede : restaurer l'annotation readonly.
8. Couverture en dessous de 90% : un type ajoute sans test de helper correspondant fait chuter la couverture de branches. Remede : le balayage exhaustif (section 8.2) couvre tout type futur automatiquement.
9. Oubli de l'extension `.js` dans le nouvel import de spec : `from './cross-tenant-authorization.entity'` casse au runtime ESM. Symptome : `ERR_MODULE_NOT_FOUND`. Remede : ajouter `.js`.
10. Doublon d'export dans le barrel shared-types : ajouter deux fois la ligne provoque une erreur de symbole duplique. Remede : verifier avant ajout (section 7.9).
11. Type `metadata` trop large : `Record<string, unknown>` accepte n'importe quelle forme, donc `cc_tenant_ids` n'est pas type-safe. Symptome : faute de frappe dans la cle non detectee. Remede : 7.5a.5 introduira un schema Zod dedie pour `metadata` selon le type d'autorisation ; cette tache conserve `Record<string, unknown>` pour ne pas sur-contraindre prematurement.
12. Confusion mission vs sinistre comme `resource_type` : une mission de remorquage est rattachee a un sinistre mais reste une ressource distincte. Utiliser `resource_type = 'mission'` pour les autorisations tow, `resource_type = 'sinistre'` pour la portee globale du dossier. Remede : suivre la table 3.3.
13. Tests Vitest qui chargent les decorateurs TypeORM en double : si `VITEST_POOL` n'est pas `forks`, les metadata des entites peuvent fuiter entre fichiers et provoquer `CannotDetermineEntityError`. Remede : configurer `pool: 'forks'` dans `vitest.config.ts` du package database.
14. `z.coerce.date()` sur une chaine ISO invalide : produit `Invalid Date` sans erreur de parse Zod par defaut. Symptome : `expiresAt` corrompu. Remede : 7.5a.5 ajoutera un `.refine((d) => !Number.isNaN(d.getTime()))` ; cette tache se limite au contrat de type.
15. Oubli de la regeneration des `.d.ts` : si le build n'est pas relance, les consommateurs (auth, shared-types) voient l'ancienne union a 3 valeurs. Symptome : type non reconnu cote consommateur. Remede : `pnpm --filter @insurtech/database build` puis recompiler les dependants.

---

## 13. Conformite Maroc detaillee

### 13.1 CNDP - Loi 09-08 (protection des donnees personnelles)

L'extension des types d'autorisation inter-tenants touche directement le partage de donnees a caractere personnel entre organisations distinctes (assure, remorqueur, garage, expert, carrier). La loi 09-08 impose :

- Minimisation : chaque autorisation doit etre bornee dans le temps (sauf le seul cas plateforme), ce que materialise le helper `requiresTimeBoundedAuthorization`. Le partage cesse a l'expiration, conformement au principe de finalite (article 3 de la loi 09-08 : les donnees ne sont collectees et traitees que pour une finalite determinee et pour la duree necessaire).
- Tracabilite et audit : chaque autorisation porte `granted_by_user_id`, `granted_at`, `revoked_at`, `revoked_by_user_id`, `revoked_reason`, garantissant un audit trail complet du partage (article 4 et obligations de l'article 23 sur la securite et la tracabilite des traitements).
- Revocabilite : la colonne `revoked_at`/`revoked_reason` permet de cesser un partage a tout moment, respectant le droit d'opposition (article 9).
- Le champ `scope` (text[]) limite le perimetre de droits accordes, renforçant la minimisation (ne partager que les champs strictement necessaires a la mission).

### 13.2 ACAPS - tracabilite de la communication avec l'expert

L'Autorite de Controle des Assurances et de la Prevoyance Sociale (ACAPS) impose la tracabilite des echanges relatifs a l'expertise et a l'indemnisation. Le type `garage_to_expert_request` (validite bornee a 30 jours, delai standard d'expertise) et le type `garage_to_carrier_quote` (transmission du devis apres validation de l'expert, carrier en CC) garantissent que chaque communication garage-expert-carrier est materialisee par une autorisation datee, bornee et auditable. Le champ `metadata.cc_tenant_ids` documente la mise en copie du carrier sans creer d'autorisation superflue, tout en conservant la trace de qui a ete tenu informe.

### 13.3 Loi 17-99 (Code des assurances)

Le Code des assurances marocain (loi 17-99) encadre les relations entre assures, assureurs, intermediaires et reparateurs. Les types `broker_to_garage_assignment`, `garage_to_carrier_quote` et `garage_to_expert_request` modelisent des transferts de droits conformes au circuit reglementaire de gestion d'un sinistre (declaration, expertise, devis, reglement). La bornage temporel et l'audit garantissent la conformite documentaire exigee en cas de controle ou de litige.

### 13.4 Cloud souverain (decision-008)

Toutes les donnees de ces autorisations residant dans la table `cross_tenant_authorizations` sont stockees sur le cloud souverain Atlas Cloud Benguerir (DC1 Tier III + DC2 Tier IV). Aucune donnee assure ne quitte le territoire marocain (loi 09-08). Chiffrement AES-256-GCM au repos, TLS 1.3 en transit.

---

## 14. Conventions absolues skalean-insurtech

- Multi-tenant strict : header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; filtre automatique `tenant_id` via `TenantGuard` ; contexte tenant via `AsyncLocalStorage` (`TenantContext`) ; RLS via la fonction Postgres `app_can_access_tenant()` ; audit trail par operation.
- Validation strict : Zod uniquement (jamais class-validator, yup ou joi) ; schemas dans `@insurtech/shared-types` ; `const Schema = z.object({...})` ; `type T = z.infer<typeof Schema>`.
- Logger strict : Pino via `this.logger` injecte ; jamais `console.log` ; JSON structure ; champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- Hash strict : argon2id (memoryCost 65536, timeCost 3, parallelism 4) ; jamais bcrypt ; pepper `PASSWORD_PEPPER`.
- Package manager strict : pnpm uniquement ; `engine-strict=true`, Node >= 22.11.0 ; `save-exact=true` ; `link-workspace-packages=deep`.
- TypeScript strict : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites (jamais `import *`).
- Tests strict : Vitest unit + integration ; Playwright E2E ; chaque `.ts` (sauf types-only / `index.ts`) possede son `.spec.ts` ; couverture >=85% global, >=90% auth/database/signature.
- RBAC strict : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` globaux ; 26 roles en v3.0.
- Events strict : topics Kafka `insurtech.events.{vertical}.{entity}.{action}` ; schema Zod par evenement ; `Idempotency-Key` pour les evenements critiques.
- Imports strict : `@insurtech/{name}` ; paths via `tsconfig.base.json` ; ordre Node / external / `@insurtech` / relatif.
- Skalean AI strict (decision-005) : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct OpenAI/Anthropic ; mock Sprint 1-28, reel Sprint 29.
- No-emoji strict (decision-006 ABSOLUE) : aucune emoji nulle part ; pre-commit `check-no-emoji.sh` ; la CI echoue sur toute emoji.
- Idempotency-Key strict : obligatoire sur POST `/payments`, `/signatures`, `/claims`, et les ecritures MCP ; TTL 24h Redis ; cle `idempotency:{tenant_id}:{user_id}:{key}`.
- Conventional Commits strict : `<type>(scope): description` ; commitlint via husky.
- Cloud souverain MA strict (decision-008) : Atlas Cloud Benguerir uniquement ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc (loi 09-08) ; AES-256-GCM ; TLS 1.3.

---

## 15. Validation pre-commit

```bash
# Bloc executable a lancer avant tout commit (depuis la racine monorepo)

set -e

# 1. No-emoji (decision-006)
bash scripts/check-no-emoji.sh \
  packages/database/src/entities/system/cross-tenant-authorization.entity.ts \
  packages/database/src/entities/system/cross-tenant-authorization.spec.ts \
  packages/database/src/entities/system/index.ts \
  packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.ts \
  packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.spec.ts \
  packages/shared-types/src/cross-tenant/cross-tenant-authorization.cross-check.spec.ts

# 2. No-console dans le code de production
! rg -n "console\." packages/database/src/entities/system/cross-tenant-authorization.entity.ts
! rg -n "console\." packages/shared-types/src/cross-tenant/cross-tenant-authorization.schema.ts

# 3. Aucun placeholder dans le code de production
! rg -n "TODO|FIXME" packages/database/src/entities/system/cross-tenant-authorization.entity.ts

# 4. Typecheck
pnpm --filter @insurtech/database typecheck
pnpm --filter @insurtech/shared-types typecheck

# 5. Lint
pnpm --filter @insurtech/database lint
pnpm --filter @insurtech/shared-types lint

# 6. Tests
pnpm --filter @insurtech/database test
pnpm --filter @insurtech/shared-types test

echo "Pre-commit OK"
```

---

## 16. Commit message complet

```
feat(sprint-7.5a): extend CrossTenantAuthorizationType 3 to 7 types (v3.0 ecosystem)

Etend le vocabulaire d'autorisations inter-tenants pour couvrir l'ecosysteme
operationnel complet d'Assurflow v3.0 (6 acteurs : assure, tow, garage, expert,
carrier, platform).

Changements :
- CrossTenantAuthorizationType : 3 -> 7 valeurs. Ajout de
  client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request,
  garage_to_carrier_quote. Les 3 types historiques restent inchanges.
- CrossTenantResourceType : 5 -> 8 valeurs. Ajout de mission, expertise,
  parts_order. Les 5 ressources historiques restent inchangees.
- Nouveau helper requiresTimeBoundedAuthorization(type) : true pour tout type
  sauf multi_tenant_user_access (decision-014).
- Nouveaux tableaux geles ALL_CROSS_TENANT_TYPES et
  ALL_CROSS_TENANT_RESOURCE_TYPES pour iteration exhaustive.
- Schema Zod miroir dans @insurtech/shared-types avec tests anti-drift.
- Suite de tests Vitest (36 cas) + 2 it.todo pour l'integration CHECK SQL.

Extension purement additive et retrocompatible : aucune valeur supprimee ni
renommee, les autorisations deja persistees restent valides.

La materialisation de la contrainte CHECK SQL alignee sur ces chaines suit en
tache 7.5a.4 (ne pas persister les nouveaux types avant son application).

Conformite : loi 09-08 (minimisation, audit, revocabilite), ACAPS (tracabilite
expertise), loi 17-99 (circuit sinistre). decision-006 (no-emoji) respectee.

Task: 7.5a.3
Sprint: 7.5a (Assurflow Foundation)
Phase: 2.5 Migration Assurflow
Reference: B-7.5a task 7.5a.3
```

---

## 17. Workflow next step

Une fois cette tache mergee (typecheck/lint/test verts, couverture >=90%, no-emoji confirme, criteres V1-V30 valides), passer a la tache 7.5a.4 :

- Tache 7.5a.4 - Migration DB : ajouter la contrainte `CHECK (type IN (...))` sur la colonne `type` et `CHECK (resource_type IS NULL OR resource_type IN (...))` sur `resource_type` de la table `cross_tenant_authorizations`, en referencant EXACTEMENT les 7 et 8 chaines definies ici (cf section 7.7). Creer egalement la table `expert_designations` reliant un sinistre, un expert (tenant) et le carrier mandant. La revue de 7.5a.4 doit comparer mot pour mot les constantes de la migration avec `ALL_CROSS_TENANT_TYPES` et `ALL_CROSS_TENANT_RESOURCE_TYPES`, et convertir les deux `it.todo` de la spec en tests d'integration reels.
- Puis 7.5a.5 - Service ABAC consommant `requiresTimeBoundedAuthorization` pour imposer l'expiration bornee lors de la creation d'autorisations (cf exemple section 7.6).

---

## Footer

- Densite cible atteinte : fichier dans la fourchette 80-150 ko.
- Nombre de blocs de code complets : 9 (entite complete, spec entite, diff index system, schema Zod, spec Zod, exemple politique ABAC, exemple migration 7.5a.4, anti-drift cross-check, diff barrel shared-types) plus les blocs shell.
- Nombre de cas de test : 36 cas `it` executables + 2 cas `it.todo` (actives en 7.5a.4).
- Criteres de validation : V1 a V30 (P0 : 16, P1 : 8, P2 : 6).
- Edge cases / troubleshooting : 15 cas documentes.
- Pieges techniques nommes : 16 (sections 3.6.1 a 3.6.16).
- Conformite Maroc : loi 09-08 (CNDP), ACAPS, loi 17-99, cloud souverain decision-008.
- AUCUNE EMOJI (decision-006 ABSOLUE).
