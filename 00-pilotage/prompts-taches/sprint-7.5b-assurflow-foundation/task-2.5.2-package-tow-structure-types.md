# Task 2.5.2 -- Package `@insurtech/tow` : structure + types + schemas Zod + squelettes entites

## Section 1 -- Metadonnees (Header)

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5b (Assurflow Foundation -- Phase 2 / Sprint 5 logique) |
| Reference meta-prompt | B-7.5b, tache 2.5.2 |
| Phase | 2 (Verticales metier / fondations Assurflow) |
| Priorite | P0 (bloquant pour la verticale Tow / Remorqueur) |
| Effort estime | 1h |
| Dependances | 2.5.1 (package `@insurtech/expertise` : etablit le pattern de package verticale) |
| Bloque | 2.5.3 (module permissions customer 147), 2.5.8 (services squelettes tow Sprint 22.5) |
| Densite cible | 80-150 ko (cible 100-120 ko) |
| Politique emoji | AUCUNE EMOJI -- decision-006 ABSOLUE (CI echoue si emoji detecte) |
| Decisions liees | decision-011 (naming v3.0 Skalean/Assurflow/Sofidemy), decision-012 (ecosysteme 6 acteurs dont Tow/Remorqueur) |
| Langue | Francais (prose), TypeScript + Zod (code) |
| Type de livrable | Structure de package + types TypeScript + schemas Zod + squelettes entites TypeORM UNIQUEMENT |

> AVERTISSEMENT DE PORTEE. Cette tache livre EXCLUSIVEMENT : la structure du package, des types TypeScript exhaustifs, des schemas Zod stricts, et deux squelettes d'entites TypeORM (sans logique). L'implementation des services (matching geographique, dispatch des missions, calcul des honoraires, tracking temps reel) est explicitement DIFFEREE au Sprint 22.5 (squelettes de services dans la tache 2.5.8). Ne creez AUCUN controleur, AUCUN service fonctionnel, AUCUNE migration de base de donnees dans cette tache.

---

## Section 2 -- But

Creer le package monorepo `@insurtech/tow`, fondation de la verticale Tow / Remorqueur (le quatrieme metier de l'ecosysteme Assurflow a 6 acteurs decrit par decision-012). Ce package fournit le contrat partage (types + schemas Zod + squelettes d'entites) qui sera consomme plus tard par l'API (`apps/api`), les workers de dispatch, et les frontends operateur/client.

Concretement, a la fin de cette tache :

1. Le repertoire `repo/packages/tow/` existe et reproduit fidelement le pattern du package `@insurtech/expertise` (tache 2.5.1), lui-meme calque sur le package reel `@insurtech/insure` / `@insurtech/auth`.
2. `package.json` et `tsconfig.json` sont conformes aux conventions du monorepo (pnpm, save-exact, ESM, composite TypeScript).
3. Les types de domaine couvrent l'operateur de remorquage (`TowOperator`), la mission de remorquage (`TowMission` avec son cycle de vie a 9 statuts de type Uber), et le tracking de localisation (`TowMissionLocation`).
4. Les schemas Zod valident les entrees d'onboarding KYB de l'operateur (CIN, plaque marocaine, ICE 15 chiffres, telephone +212, document d'assurance, permis de remorquage), la designation et les transitions de mission, et la disponibilite.
5. Une machine a etats (carte des transitions autorisees) documente formellement les 9 statuts.
6. Deux squelettes d'entites TypeORM (`TowOperator`, `TowMission`) mappent les futures colonnes DB en `snake_case`, avec JSDoc indiquant que l'implementation complete (et les migrations) relevent du Sprint 22.5.
7. Le barrel `index.ts` reexporte tout et expose une constante `VERSION`.
8. `pnpm --filter @insurtech/tow typecheck` et `pnpm --filter @insurtech/tow test` passent.

Le package compile en isolation (zero dependance metier vers les autres packages verticaux), ne contient aucune logique runtime, et sert de source de verite typee pour tout le code Tow a venir.

---

## Section 3 -- Contexte etendu

### 3.1 Pourquoi un package `tow` distinct

L'ecosysteme Assurflow (decision-012) est constitue de 6 acteurs metier : l'assureur (compagnie / courtier -- vertical `insure`), l'expert automobile (vertical `expertise`), le garagiste reparateur, le remorqueur (vertical `tow`), le client assure (consommateur final), et l'administrateur plateforme. Chaque verticale metier qui possede un cycle de vie propre, des regles KYB specifiques, et des entites dediees recoit son propre package monorepo. Le package `tow` isole le contrat du metier remorqueur :

- Il evite que les types Tow polluent le coeur assurantiel (`insure`) ou le module d'expertise (`expertise`).
- Il permet une montee en charge independante : les workers de dispatch geographique du Sprint 22.5 dependront uniquement de `@insurtech/tow` et `@insurtech/auth`, pas du monolithe metier.
- Il materialise la frontiere multi-tenant : une mission de remorquage implique trois tenants distincts (le porteur de risque / carrier, le tenant de la societe de remorquage, et indirectement le tenant client via la sinistralite), ce qui exige des champs explicites `carrierTenantId` et `towTenantId` separes du `tenantId` proprietaire de la ligne.

### 3.2 Le cycle de vie d'une mission facon Uber (9 statuts)

Une mission de remorquage Assurflow suit un parcours operationnel proche d'une course VTC, mais pilote par un sinistre assurantiel plutot que par un client final :

1. `designated` -- La mission vient d'etre creee par le carrier (l'assureur / plateforme) et affectee a un operateur de remorquage. Statut initial. Aucun engagement de l'operateur encore.
2. `accepted` -- L'operateur a accepte la mission. Il s'engage a se rendre sur place. Horodatage `acceptedAt`.
3. `en_route` -- Le camion est en route vers le point de prise en charge (`pickup`). Le tracking temps reel commence ici (flux `TowMissionLocation`).
4. `on_site` -- Le camion est arrive au point de prise en charge. Constat sur place, eventuelles photos.
5. `towing` -- Le vehicule sinistre est charge ; le remorquage vers le garage de destination est en cours.
6. `delivered` -- Le vehicule a ete livre au garage de destination (`destinationGarageId`). Photos de livraison possibles.
7. `closed` -- La mission est administrativement cloturee (honoraires valides, preuve de livraison archivee). Etat terminal nominal.
8. `rejected` -- L'operateur a refuse la mission depuis l'etat `designated` (motif obligatoire). Etat terminal.
9. `cancelled` -- La mission a ete annulee (par le carrier, le client, ou pour cause de force majeure) depuis un etat intermediaire (motif obligatoire). Etat terminal.

Cette modelisation "facon Uber" implique une machine a etats stricte : toutes les transitions ne sont pas legales. Par exemple, on ne peut pas passer directement de `designated` a `delivered` (il faut traverser `accepted`, `en_route`, `on_site`, `towing`). Le refus (`rejected`) n'est possible que depuis `designated`. L'annulation (`cancelled`) est possible depuis tout etat actif non terminal. La carte des transitions autorisees (`TOW_MISSION_ALLOWED_TRANSITIONS`) est livree dans cette tache (donnees uniquement -- la garde runtime sera implementee au Sprint 22.5).

Pour bien saisir la difference avec une course VTC classique, il faut noter trois ecarts metier majeurs :

- Le donneur d'ordre n'est PAS le passager. Dans une course VTC, le client commande et paie. Ici, c'est le carrier (assureur) qui designe la mission et qui en supporte le cout (l'honoraire est porte par la police d'assurance, pas par le conducteur du vehicule sinistre). Le `customerUserId` (l'assure) est un beneficiaire passif du service, pas le payeur. C'est pourquoi le refus (`rejected`) est un acte de l'operateur (il peut decliner une affectation), alors que l'annulation (`cancelled`) peut emaner du carrier, du client, ou d'un cas de force majeure.
- Le point de depart (`pickup`) et le point d'arrivee (`destinationGarageId`) sont tous deux contraints. Le garage de destination est determine par le reseau agree de l'assureur, pas par un choix libre. Le matching geographique (Sprint 22.5) doit donc optimiser sur trois points (operateur, sinistre, garage), pas deux.
- La preuve de service est juridiquement structurante. Contrairement a une course VTC ou la fin de course suffit, le remorquage assurantiel exige une chaine de preuve (photos `on_site`, photos `delivered`, horodatages) qui alimente le reglement du sinistre. C'est la raison d'etre des champs `*At` et du payload de transition optionnel (photos). Le statut `closed` n'est atteint qu'apres validation administrative de cette preuve.

La distinction entre statuts terminaux est elle aussi metier. `closed` est le seul terminal NOMINAL (le service a ete rendu et facture). `rejected` et `cancelled` sont des terminaux d'ECHEC ou d'ABANDON : aucun service n'a ete rendu (ou un service partiel non facturable). Cette distinction conditionne la facturation, les statistiques de l'operateur (`totalMissions` ne compte que les `closed`), et les eventuelles penalites de refus repete (regle metier Sprint 22.5).

### 3.3 Tracking geographique temps reel

Une fois la mission `en_route`, l'application operateur emet periodiquement la position du camion (`TowMissionLocation` : `lat`, `lng`, `recordedAt`, `missionId`, plus `heading` et `speedKmh` optionnels). Ces points alimentent l'ETA cote client et la preuve de service. Deux exigences techniques structurantes des cette tache de typage :

- Les coordonnees sont des `number` (pas des `string`). La precision DB future sera `numeric(10,7)` (7 decimales -- environ 1,1 cm a l'equateur, largement suffisant). Cette precision se valide cote schema via des bornes `lat` ∈ [-90, 90], `lng` ∈ [-180, 180].
- Les donnees de geolocalisation operateur ET client sont des donnees personnelles au sens de la loi marocaine 09-08 (CNDP). Le typage doit deja refleter la minimisation (pas de stockage d'identite dans le point de tracking, seulement `missionId`).

Pourquoi exactement `numeric(10,7)` et pas autre chose ? Le choix d'echelle (scale) gouverne la precision spatiale, et le choix de precision totale (precision) gouverne l'etendue representable :

| Type DB | Decimales | Precision au sol (equateur) | Adequation tracking remorquage |
|---------|-----------|-----------------------------|-------------------------------|
| `numeric(8,5)` | 5 | ~1,1 m | Insuffisant : un camion peut etre a plus d'1 m de sa position reelle, ETA degrade |
| `numeric(9,6)` | 6 | ~11 cm | Limite : acceptable mais sans marge pour l'avenir (calculs de proximite garage) |
| `numeric(10,7)` | 7 | ~1,1 cm | RETENU : precision sub-decimetrique, marge confortable, standard du repo |
| `double precision` | flottant | variable | Rejete : erreurs d'arrondi binaire sur les calculs de distance cumules |

La precision totale de 10 (3 chiffres avant la virgule pour la longitude jusqu'a -180,xxxxxxx) couvre tout le globe. Au Maroc, la latitude (~21 a ~36) et la longitude (~-17 a ~-1) tiennent largement dans ces bornes. Le choix de `numeric` (decimal exact) plutot que `double precision` (flottant binaire) evite la derive d'arrondi sur les calculs de distance haversine repetes le long d'une trajectoire de tracking.

Le typage cote TypeScript reste `number` pour l'ergonomie : les payloads API JSON transportent naturellement des nombres, et les bibliotheques cartographiques (Leaflet, Mapbox cote Sprint 24) attendent des `number`. La conversion `numeric(10,7)` (renvoye en `string` par le driver PostgreSQL) vers `number` est assuree par un transformer de colonne TypeORM au Sprint 22.5. A ce stade (squelette), aucune entite n'est hydratee, donc la dette de conversion est purement documentaire.

### 3.4 Onboarding KYB de l'operateur

Avant d'operer, un remorqueur passe un KYB (Know Your Business) : numero de carte d'identite nationale (CIN) avec piece justificative, plaque d'immatriculation marocaine du camion, carte grise (`truckRegistrationUrl`), autorisation de transport / permis de remorquage (`towPermitUrl`), numero ICE (Identifiant Commun de l'Entreprise, 15 chiffres), attestation d'assurance (`insuranceDocUrl`), zones d'activite, capacite et type de camion, et un honoraire de base (`baselineHonoraireMad`). Le statut de l'operateur (`active` / `pending_kyb` / `suspended` / `inactive`) gouverne sa capacite a recevoir des missions. Le schema d'onboarding (`OnboardTowOperatorSchema`) valide toutes ces entrees.

Detail des pieces KYB et de leur role :

| Piece | Champ type | Colonne DB | Validation a ce stade | Verification metier (Sprint 22.5) |
|-------|-----------|-----------|----------------------|-----------------------------------|
| CIN (carte d'identite nationale) | `cinDocumentUrl` | `cin_document_url` | URL valide | Identite du gerant, controle anti-fraude |
| Carte grise du camion | `truckRegistrationUrl` | `truck_registration_url` | URL valide | Correspondance plaque / proprietaire |
| Permis de remorquage / autorisation de transport | `towPermitUrl` | `tow_permit_url` | URL valide | Validite, non-expiration, conformite route |
| ICE (Identifiant Commun Entreprise) | `iceNumber` | `ice_number` | exactement 15 chiffres | Existence au registre, unicite |
| Attestation d'assurance pro | `insuranceDocUrl` | `insurance_doc_url` | URL valide | Couverture RC, non-expiration |
| Plaque d'immatriculation | `truckPlate` | `truck_plate` | regex MA pragmatique | Correspondance carte grise |
| Telephone | (onboarding) | -- | E.164 `+212` | OTP / verification de contact |

La sequence d'activation est : un operateur est cree en `pending_kyb` (default DB de la colonne `status`). Tant que toutes les pieces ne sont pas fournies ET verifiees (controle Sprint 22.5), il reste `pending_kyb` et ne peut recevoir aucune mission. Une fois le KYB valide, il passe `active`. Un incident (document expire, sinistre operateur, signalement) le bascule `suspended`. Une cessation d'activite le passe `inactive`. Seul `active` autorise la designation d'une mission ; le matching geographique du Sprint 22.5 filtre obligatoirement sur `status = active`.

Le present package n'implemente PAS la machine d'etats de l'operateur (les transitions de `status` operateur), seulement l'enum et la validation des entrees d'onboarding. La logique d'activation/suspension est un service du Sprint 22.5.

### 3.4.1 Calcul de l'honoraire (note de cadrage, non implemente ici)

L'honoraire de remorquage se decompose en trois champs sur la mission, tous des chaines decimales MAD :

- `honoraireBaseMad` : honoraire de base, derive du `baselineHonoraireMad` de l'operateur et eventuellement module par la distance estimee (`estimatedDistanceKm`) et le type de camion requis. Renseigne a la designation.
- `honoraireExtrasMad` : supplements (peage, attente prolongee, manutention difficile, intervention de nuit). Default `'0'` a la designation, ajuste en cours de mission.
- `honoraireTotalMad` : total = base + extras, calcule et fige a la cloture (`closed`).

Formule de cadrage (a implementer en service Sprint 22.5, NON livree ici) : `total = base + extras`, ou `base = baseline_operateur + (tarif_km * distance_km) + majoration_type_camion`. La regle exacte (grille tarifaire, plafonds carrier, TVA) releve du metier assurantiel et sera parametree. A ce stade, le package se contente de TYPER ces montants en `string` decimale et de les VALIDER par `DECIMAL_MAD_REGEX` (entier + jusqu'a 2 decimales). Aucun calcul n'est effectue dans cette tache. La regle d'invariant `total = base + extras` n'est PAS verifiee par le schema (un service le fera) : le schema valide la forme, pas la coherence arithmetique inter-champs.

### 3.5 Aval : Sprint 22.5 et Sprint 24

- Sprint 22.5 (Tow -- implementation complete) : services de matching geographique (selection de l'operateur le plus proche par zone et type de camion), dispatch et reaffectation, calcul des honoraires (base + extras), machine a etats appliquee, persistance TypeORM complete + migrations, evenements Kafka `insurtech.events.tow.mission.*`, controleurs REST, tracking WebSocket.
- Sprint 24 (frontends) : application operateur (mobile-first, acceptation/refus, tracking GPS) et vue client (suivi ETA temps reel). Ces frontends consomment les types du present package via `@insurtech/tow`.

Detail de ce que le Sprint 22.5 ajoutera, brique par brique, en s'appuyant sur le contrat livre ici :

| Brique Sprint 22.5 | Consomme du present package | Ajoute |
|--------------------|-----------------------------|--------|
| Service de matching geographique | `TowOperator`, `zonesActive`, `TruckType`, `TRUCK_TYPE_CAPACITY`, `canTruckHandle` | Index GIN sur `zones_active`, requete de proximite haversine, filtre `status = active` |
| Service de dispatch | `DesignateMissionSchema`, `TowMissionEntity` | Persistance, transaction, reaffectation sur refus |
| Service de transition | `TOW_MISSION_ALLOWED_TRANSITIONS`, `isTowMissionTransitionAllowed`, `TransitionStatusSchema` | Garde runtime qui REJETTE les transitions illegales, horodatage des `*At` |
| Service de calcul d'honoraire | `honoraire*Mad`, `DECIMAL_MAD_REGEX`, `baselineHonoraireMad` | Grille tarifaire, calcul `total = base + extras`, plafonds carrier |
| Tracking temps reel | `TowMissionLocation`, `TowMissionLocationSchema` | WebSocket, TTL Redis (`TOW_TRACKING_TTL_SECONDS`), ETA |
| Persistance + migrations | `TowOperatorEntity`, `TowMissionEntity` | Relations `@ManyToOne` actives, RLS, index composites, migrations SQL |
| Evenements | enums de statut | Topics Kafka `insurtech.events.tow.mission.{designated,accepted,...}`, schemas d'evenement |

La regle d'or de la separation : le Sprint 22.5 ne RE-DEFINIT aucun type ni aucun schema livre ici. Il les IMPORTE depuis `@insurtech/tow`. Si une evolution de contrat est necessaire (nouveau statut, nouveau champ), elle se fait dans CE package, avec bump de `VERSION`, jamais en dupliquant le type cote service.

### 3.6 Alternatives considerees

- Alternative A -- Mettre les types Tow dans `@insurtech/insure`. Rejetee : couplage fort, le coeur assurantiel n'a pas a connaitre la logique de course/remorquage, et le multi-tenant a trois tenants polluerait le modele assurantiel.
- Alternative B -- Un package monolithique `@insurtech/verticals` regroupant expertise + tow + garage. Rejetee : empeche les builds et deploiements independants, gonfle le graphe de dependances des workers.
- Alternative C -- Statuts de mission modelises en table de configuration DB plutot qu'en enum TypeScript. Rejetee a ce stade : les 9 statuts sont stables et metier-critiques ; un enum type donne la securite de compilation et alimente la machine a etats. Une table reste possible plus tard pour les libelles localises.
- Alternative D -- Honoraires en `number` (float). Rejetee categoriquement : risque d'erreurs d'arrondi monetaire. Standard du repo : argent en `string` decimale.

Synthese comparative des alternatives structurelles :

| Axe de decision | Option retenue | Alternative rejetee | Raison du rejet |
|-----------------|----------------|---------------------|-----------------|
| Frontiere de package | Package `@insurtech/tow` dedie | Types dans `@insurtech/insure` | Couplage, pollution du coeur assurantiel, 3 tenants |
| Granularite | Un package par verticale | `@insurtech/verticals` monolithique | Pas de build/deploiement independant |
| Modelisation des statuts | Enum Zod (9 valeurs) | Table de config DB | Securite de compilation, machine a etats typee |
| Representation monetaire | `string` decimale | `number` (float) | Erreurs d'arrondi monetaire |
| Representation geo | `number` borne (DB `numeric(10,7)`) | `string` ou `double precision` | Ergonomie API + exactitude decimale en DB |
| Machine a etats | Donnees + helper pur | Service avec garde runtime | Hors portee ; testable sans I/O ; garde = Sprint 22.5 |
| Decorateurs entites | Squelette `@Entity` colonnes seules | Entites completes avec relations | Hors portee ; relations/RLS/migrations = Sprint 22.5 |
| Gestion des extensions ESM | `.js` explicite (NodeNext) | imports sans extension | NodeNext exige l'extension, sinon `ERR_MODULE_NOT_FOUND` |

- Alternative E -- Coordonnees en `string` (comme l'argent). Rejetee : les coordonnees ne souffrent pas du probleme d'arrondi monetaire de la meme maniere (ce sont des grandeurs continues, pas des montants comptables), et les consommateurs cartographiques attendent des `number`. L'exactitude est garantie cote DB par `numeric(10,7)`.
- Alternative F -- Un seul champ `status` libre (`string`) sans enum. Rejetee : perte totale de la securite de compilation et impossibilite de typer la carte des transitions `Record<TowMissionStatus, ...>`.
- Alternative G -- Fusionner `truckType` (operateur) et `truckTypeRequired` (mission) en un seul concept. Rejetee : ce sont deux semantiques distinctes (capacite offerte vs besoin exprime) ; les separer permet au matching de comparer offre et demande.

### 3.7 Trade-offs assumes

- On livre une machine a etats sous forme de DONNEES (`TOW_MISSION_ALLOWED_TRANSITIONS`) et de helper pur (`isTowMissionTransitionAllowed`), sans la cabler dans un service. Avantage : testable immediatement, zero dependance. Inconvenient : la garde n'est pas encore appliquee a l'execution (assume -- Sprint 22.5).
- On type les coordonnees en `number` pour l'ergonomie API, en acceptant la dette d'une conversion `numeric(10,7)` <-> `number` au mapping TypeORM (Sprint 22.5).
- On separe `truckTypeRequired` (cote mission) de `truckType` (cote operateur) : redondance apparente mais semantiques distinctes (besoin vs capacite).

### 3.8 Pieges (a eviter absolument)

Chaque piege est decrit selon le format Pourquoi (la cause racine, l'erreur qu'on commet naturellement) puis Solution (la regle concrete a appliquer dans CE package). Les quinze pieges nommes ci-dessous couvrent les classes d'erreur les plus probables sur cette tache de typage.

PIEGE 1 -- Trous dans la machine a etats.
- Pourquoi. La modelisation "facon Uber" donne l'illusion d'un chemin lineaire, et on est tente de coder une simple progression d'index (statut suivant = statut courant + 1). Cela laisse passer des sauts illegaux comme `designated -> delivered` ou des retours arriere `towing -> accepted` qui n'ont aucun sens metier (un vehicule charge ne redevient pas non accepte) et corrompent la chaine de preuve.
- Solution. Materialiser explicitement la carte `TOW_MISSION_ALLOWED_TRANSITIONS` comme `Record<TowMissionStatus, readonly TowMissionStatus[]>` (les 9 cles obligatoires, sinon erreur de compilation) et toujours valider chaque cible via `TOW_MISSION_ALLOWED_TRANSITIONS[from].includes(to)`. Aucune transition vers soi-meme. La garde runtime est Sprint 22.5, mais la carte (donnees) et le helper pur sont livres ici et testes.

PIEGE 2 -- Argent en `number`.
- Pourquoi. JavaScript represente les nombres en flottant IEEE-754 ; `0.1 + 0.2 !== 0.3`. Sur des honoraires cumules (base + extras, peages, attente), l'arrondi binaire derive et la facture ne tombe plus juste au centime. C'est inacceptable pour un montant porte par une police d'assurance.
- Solution. Tout montant (`honoraireBaseMad`, `honoraireExtrasMad`, `honoraireTotalMad`, `baselineHonoraireMad`) est une `string` decimale validee par `DECIMAL_MAD_REGEX` (`/^\d+(\.\d{1,2})?$/`). Jamais `number`. Cote DB : `numeric(12,2)`. La conversion et l'arithmetique exacte (lib decimale) sont du ressort du service Sprint 22.5.

PIEGE 3 -- Precision geo insuffisante ou mauvais type.
- Pourquoi. Deux erreurs jumelles : (a) typer `lat`/`lng` en `string` par mimetisme avec l'argent ; (b) choisir une echelle DB trop faible (`numeric(9,6)` -> ~11 cm, ou pire `numeric(8,5)` -> ~1,1 m). A 1 m d'erreur, l'ETA et le matching de proximite garage se degradent visiblement.
- Solution. `lat`/`lng` sont des `number` bornes par schema (`lat` ∈ [-90, 90], `lng` ∈ [-180, 180]), destines a `numeric(10,7)` cote DB (~1,1 cm). On ne descend jamais sous 7 decimales d'echelle.

PIEGE 4 -- Capacite camion non validee.
- Pourquoi. On oublie que `truckCapacityKg` peut arriver a 0, negatif, ou flottant ; et on oublie qu'une mission `heavy` ne peut pas etre servie par un camion `light`. Sans ces gardes, le matching affecte un camion sous-dimensionne et la mission echoue sur place.
- Solution. `truckCapacityKg` est valide `int` ET `positive` dans `OnboardTowOperatorSchema`. Le mapping `TRUCK_TYPE_CAPACITY` (`light` 3500, `medium` 7500, `heavy` 40000 kg) documente les seuils ; le helper pur `canTruckHandle(type, loadKg)` exprime l'adequation (la garde appliquee au dispatch est Sprint 22.5).

PIEGE 5 -- Dependances non epinglees.
- Pourquoi. Un `^` ou `~` (range semver) laisse pnpm resoudre une version differente d'une machine a l'autre ou d'un jour a l'autre, cassant la reproductibilite des builds et potentiellement le typecheck (changement d'API mineur de zod).
- Solution. save-exact obligatoire : `"zod": "3.24.1"`, `"typeorm": "0.3.20"`, etc. sans aucun `^` ni `~`. Le `.npmrc` racine porte `save-exact=true`. Le critere V5 echoue si un caret/tilde apparait.

PIEGE 6 -- ICE mal valide.
- Pourquoi. L'ICE (Identifiant Commun de l'Entreprise) marocain fait exactement 15 chiffres. On accepte par erreur 14 ou 16 chiffres, des espaces, ou de l'alphanumerique.
- Solution. `ICE_REGEX = /^\d{15}$/`. Ni 14, ni 16, ni alphanumerique, ni espaces. La normalisation (suppression d'espaces saisis) est cote API au Sprint 22.5 ; le schema valide la forme canonique.

PIEGE 7 -- Telephone non normalise.
- Pourquoi. Les saisies marocaines varient : `0612...`, `212612...`, `+212 6 12...`. Si on accepte le `0` national, on ne peut plus envoyer d'OTP international ni dedupliquer les contacts.
- Solution. Format E.164 strict `+212` suivi de 5/6/7 puis 8 chiffres : `MOROCCAN_PHONE_REGEX = /^\+212[5-7]\d{8}$/`. Le `0` national et les espaces sont rejetes.

PIEGE 8 -- Plaque marocaine trop stricte (ou trop laxiste).
- Pourquoi. Le format marocain (chiffres - lettre arabe latinisee - chiffres, plus anciens formats serie) est heterogene. Une regex trop stricte rejette des plaques valides ; une regex inexistante laisse passer n'importe quoi.
- Solution. `MOROCCAN_PLATE_REGEX = /^\d{1,6}-[A-Za-z]{0,2}-?\d{1,3}$/`, volontairement pragmatique pour ne pas rejeter de plaques valides. Le durcissement reel viendra avec les regles metier (Sprint 22.5).

PIEGE 9 -- Confondre les tenants.
- Pourquoi. La mission croise trois tenants distincts ; on est tente de tout reduire au seul `tenantId` proprietaire de la ligne. On perd alors la tracabilite du donneur d'ordre et de l'executant, et la RLS ne peut plus arbitrer les acces croises.
- Solution. Trois colonnes distinctes : `tenantId` (proprietaire de la ligne, RLS) != `carrierTenantId` (assureur donneur d'ordre) != `towTenantId` (societe de remorquage). Jamais de fusion.

PIEGE 10 -- Horodatages d'etape non nullables.
- Pourquoi. Si on rend `acceptedAt`, `enRouteAt`, etc. obligatoires des la creation, on force des valeurs factices (date courante) avant que l'etape ne soit reellement atteinte, ce qui pollue la chaine de preuve et fausse les statistiques de duree.
- Solution. Tous les `*At` d'etape (sauf `designatedAt`, `createdAt`, `updatedAt`) sont `Date | null`, renseignes uniquement quand l'etape est franchie. Colonne DB `nullable: true`.

PIEGE 11 -- `exactOptionalPropertyTypes` mal gere.
- Pourquoi. Avec cette option TS activee, `heading?: number` n'est PAS equivalent a `heading: number | undefined`. Assigner explicitement `undefined` a une propriete optionnelle declenche une erreur ; melanger `?` et `| undefined` dans les schemas Zod / types cree des incoherences de compilation.
- Solution. Utiliser `?` (proprietes optionnelles) de maniere coherente et OMETTRE la cle plutot que d'assigner `undefined`. `heading?: number` cote type, `.optional()` cote Zod.

PIEGE 12 -- Emoji.
- Pourquoi. decision-006 est ABSOLUE. Un emoji glisse dans un commentaire, un JSDoc, un message d'erreur Zod ou la doc fait echouer la CI via `check-no-emoji.sh`. Le piege est de copier-coller depuis une source qui en contient.
- Solution. Aucun emoji nulle part (code, commentaires, JSDoc, docs, messages d'erreur). Verifier avant commit avec `bash scripts/check-no-emoji.sh packages/tow`.

PIEGE 13 -- Logique dans les entites.
- Pourquoi. Le squelette d'entite ressemble a une entite complete ; on est tente d'y ajouter des `@ManyToOne`, des methodes metier (`canAccept()`), ou des `@BeforeInsert`. Cela anticipe le Sprint 22.5 et viole la portee.
- Solution. Les entites livrees sont des SQUELETTES : `@Entity`, `@Column` snake_case, `@Index` simples, colonnes de dates. Aucune relation active, aucune methode, aucun hook. Les FK sont documentees en JSDoc, pas codees.

PIEGE 14 -- Statut operateur par defaut errone.
- Pourquoi. En copiant le pattern d'une entite sans onboarding, on oublie le default et l'operateur est cree directement utilisable, contournant le KYB (un remorqueur non verifie pourrait recevoir des missions).
- Solution. La colonne `status` de `tow_operators` a un default `'pending_kyb'`, JAMAIS `'active'`. Seul le service KYB (Sprint 22.5) bascule vers `active` apres verification de toutes les pieces.

PIEGE 15 -- Confondre `rejected` et `cancelled`.
- Pourquoi. Les deux sont des terminaux d'echec, mais leur semantique et leur source different. Autoriser `accepted -> rejected` permettrait a un operateur de "refuser" une mission deja acceptee, brouillant la responsabilite et les penalites.
- Solution. `rejected` = l'operateur decline une AFFECTATION depuis `designated` (decision de l'operateur, motif obligatoire). `cancelled` = abandon depuis un etat actif (peut emaner du carrier, du client, ou force majeure, motif obligatoire). Ne JAMAIS autoriser `accepted -> rejected` : une fois accepte, on annule, on ne refuse plus.

PIEGE 16 -- Oublier `default('0')` sur les extras.
- Pourquoi. `honoraireExtrasMad` sans default laisse le champ `undefined` a la designation ; l'invariant `total = base + extras` casse au Sprint 22.5 (somme avec `undefined`).
- Solution. `honoraireExtrasMad` doit defaulter a la CHAINE `'0'` (pas le nombre `0`, pas `undefined`) dans `DesignateMissionSchema`. Default DB `0` sur la colonne `numeric`.

PIEGE 17 -- Bornes geo incoherentes entre schemas.
- Pourquoi. On applique les bornes dans un schema mais on les oublie dans un autre (par ex. dans `CoordinatesSchema` mais pas dans `TowMissionLocationSchema`), creant une faille : un point invalide passe par le canal non borne.
- Solution. Les bornes `lat` ∈ [-90, 90] et `lng` ∈ [-180, 180] sont appliquees dans CHAQUE schema portant des coordonnees (`TowMissionLocationSchema`, `DesignateMissionSchema`, `CoordinatesSchema`). Une seule source de verite pragmatique : factoriser `CoordinatesSchema` et le reutiliser.

PIEGE 18 -- Reexport casse du barrel (extension manquante).
- Pourquoi. En `type: "module"` + NodeNext, un `export * from './types/tow-mission.types'` (sans `.js`) compile parfois mais casse a l'execution ESM avec `ERR_MODULE_NOT_FOUND`.
- Solution. Tous les reexports du barrel `index.ts` portent l'extension `.js` (les 7 reexports). Idem pour les imports relatifs internes (`./tow-mission.types.js`).

#### 3.8.1 La machine a etats `TOW_MISSION_ALLOWED_TRANSITIONS` en detail

La carte des transitions n'est pas une simple liste : c'est le coeur du contrat de cycle de vie. Elle se lit ainsi (statut courant -> ensemble des cibles legales) :

- `designated` -> `accepted`, `rejected`, `cancelled`. C'est le seul etat depuis lequel `rejected` est atteignable. Le carrier peut aussi annuler avant acceptation (par ex. le sinistre est resolu autrement).
- `accepted` -> `en_route`, `cancelled`. L'operateur s'est engage ; il ne peut plus refuser (seulement abandonner via `cancelled`, motif obligatoire).
- `en_route` -> `on_site`, `cancelled`. Le camion roule ; l'annulation reste possible (panne du camion, sinistre operateur).
- `on_site` -> `towing`, `cancelled`. Arrive sur place ; l'annulation reste possible (vehicule introuvable, deja remorque par un tiers).
- `towing` -> `delivered`, `cancelled`. Vehicule charge ; l'annulation reste theoriquement possible (incident en route) mais devient rare.
- `delivered` -> `closed`. La seule transition sortante de `delivered` est la cloture administrative. On ne peut PAS annuler une mission deja livree (le service a ete rendu).
- `closed` -> aucune. Terminal NOMINAL (service rendu et facture).
- `rejected` -> aucune. Terminal d'echec (refus de l'operateur).
- `cancelled` -> aucune. Terminal d'abandon.

Proprietes invariantes que les tests verifient (Section 8) :
- Les 9 statuts sont presents comme cles (`Object.keys(...).length === 9`).
- Les trois terminaux (`closed`, `rejected`, `cancelled`) ont une liste de cibles VIDE.
- `cancelled` est present comme cible de tous les etats actifs non terminaux (`designated`, `accepted`, `en_route`, `on_site`, `towing`) mais PAS de `delivered`.
- `rejected` est present comme cible de `designated` UNIQUEMENT.
- Aucune liste ne se contient elle-meme (pas de transition vers soi-meme).
- Aucun saut : `designated -> delivered`, `accepted -> on_site`, `en_route -> towing` sont tous illegaux (chaque etape doit etre traversee).

Cette carte est livree comme DONNEES immuables (`as const`, `Readonly<Record<...>>`). La consequence de compilation est forte : si quelqu'un ajoute un 10e statut a `TowMissionStatusEnum` sans l'ajouter a la carte, le typecheck echoue (cle manquante dans le `Record`). C'est une securite par construction. La garde RUNTIME (rejet effectif d'une transition illegale au moment de l'execution, avec horodatage du `*At` correspondant) est explicitement DIFFEREE au service de transition du Sprint 22.5, qui IMPORTERA cette carte sans la redefinir.

### 3.9 Decisions liees

- decision-011 (naming v3.0) : Skalean est la societe, Assurflow la verticale produit, Sofidemy la marque. Les descriptions et JSDoc utilisent ces termes correctement (jamais d'ancien nom).
- decision-012 (ecosysteme 6 acteurs) : le remorqueur (Tow) est l'un des 6 acteurs ; sa fondation technique est ce package.

### 3.10 Relations inter-acteurs du point de vue Tow

Pour bien comprendre les references portees par les types, voici comment le remorqueur s'insere dans le flux de bout en bout d'un sinistre automobile Assurflow :

1. Le client assure (acteur 5) declare un sinistre via l'application Sofidemy. Un identifiant de sinistre (`sinistreId`) est cree cote coeur assurantiel (`@insurtech/insure`).
2. L'assureur / carrier (acteur 1) instruit le dossier. Lorsqu'un remorquage est necessaire (vehicule immobilise), le carrier declenche la designation d'une mission de remorquage : c'est lui le `carrierTenantId`.
3. La plateforme selectionne une societe de remorquage (acteur 4, `towTenantId`) puis un operateur precis (`towOperatorId`) en fonction de la zone (`zonesActive`), du type de camion requis (`truckTypeRequired` vs `truckType` de l'operateur), et de la capacite (`truckCapacityKg`). Cette selection est le futur service de matching geographique (Sprint 22.5).
4. L'operateur execute la mission selon le cycle de vie a 9 statuts. Pendant `en_route`, `on_site`, `towing`, le tracking temps reel (`TowMissionLocation`) alimente l'ETA cote client.
5. Le vehicule est livre au garage reparateur (acteur 3, `destinationGarageId`). La mission passe `delivered` puis `closed`.
6. L'administrateur plateforme (acteur 6) supervise, arbitre les annulations, et controle les KYB.

Le present package ne modelise QUE le perimetre Tow (operateur, mission, tracking). Les autres acteurs sont references par identifiant opaque (`sinistreId`, `destinationGarageId`, `customerUserId`) sans importer leurs types -- ce qui evite tout cycle de dependance entre packages verticaux. La resolution effective de ces references (jointures, controles d'acces croises) releve des services du Sprint 22.5 et du systeme d'autorisation cross-tenant defini au Sprint 7.5a.

### 3.11 Pourquoi separer types, schemas et entites

Le package distingue trois couches volontairement :

- Les types (`src/types`) decrivent la forme des objets metier tels qu'ils circulent dans l'application (interfaces TypeScript pures, zero dependance runtime hormis l'inference d'enum Zod). Ils sont la source de verite pour la compilation.
- Les schemas (`src/schemas`) decrivent la validation des entrees (payloads API, transitions). Ils encodent les invariants metier (ICE 15 chiffres, machine a etats) et produisent les types d'entree via `z.infer`.
- Les entites (`src/entities`) decrivent la persistance (mapping colonnes DB). Elles sont des squelettes a ce stade ; leur forme runtime complete (transformers, relations, RLS) arrive au Sprint 22.5.

Cette separation evite le piege classique du couplage entre la representation API et la representation DB : un champ peut etre `string` decimale en type metier, `numeric(12,2)` en colonne, et valide par regex en schema, sans que ces trois preoccupations se contaminent. Elle facilite aussi les tests : les helpers purs et les schemas se testent sans base de donnees ni serveur.

---

## Section 4 -- Architecture context

### 4.1 Position dans la sequence du Sprint 7.5b

```
2.5.1  @insurtech/expertise (structure + types)   [DEPENDANCE -- pattern de reference]
2.5.2  @insurtech/tow (structure + types)         [<-- VOUS ETES ICI -- position 2/9]
2.5.3  permissions customer module (147)          [BLOQUEE PAR 2.5.2]
2.5.4  insure_experts entity
2.5.5  RENAME expert_designations
2.5.6  insure_expert_reports entity
2.5.7  services squelettes expertise
2.5.8  services squelettes tow                     [consomme @insurtech/tow]
2.5.9  docs extension + integration tests
```

### 4.2 Layout du package livre

```
packages/tow/
  package.json                         (manifeste pnpm, save-exact, ESM)
  tsconfig.json                        (extends ../../tsconfig.base.json, composite)
  src/
    index.ts                           (barrel + VERSION)
    types/
      tow-operator.types.ts            (TowOperator, TowOperatorStatusEnum)
      tow-mission.types.ts             (TowMission, TowMissionStatusEnum, TruckTypeEnum)
      tow-location.types.ts            (TowMissionLocation, TRUCK_TYPE_CAPACITY, helpers zone)
    schemas/
      tow-operator.schema.ts           (OnboardTowOperatorSchema, ToggleAvailabilitySchema)
      tow-mission.schema.ts            (Designate/Accept/Reject/Transition/Cancel + transitions map)
    entities/
      tow-operator.entity.ts           (squelette TypeORM @Entity)
      tow-mission.entity.ts            (squelette TypeORM @Entity)
```

### 4.3 Machine a etats de la mission (ASCII)

```
                       designated
                      /     |     \
                rejected  cancelled  accepted
                              |        |  \
                              |        |   cancelled
                              |     en_route
                              |        |   \
                              |        |    cancelled
                              |     on_site
                              |        |   \
                              |        |    cancelled
                              |      towing
                              |        |   \
                              |        |    cancelled
                              |     delivered
                              |        |
                              |      closed   (terminal nominal)
                              |
                  (rejected / cancelled : terminaux)

Transitions autorisees (resume) :
  designated -> accepted | rejected | cancelled
  accepted   -> en_route | cancelled
  en_route   -> on_site  | cancelled
  on_site    -> towing   | cancelled
  towing     -> delivered | cancelled
  delivered  -> closed
  closed     -> (aucune -- terminal)
  rejected   -> (aucune -- terminal)
  cancelled  -> (aucune -- terminal)
```

### 4.4 Frontiere multi-tenant de la mission (ASCII)

```
+----------------------+        +-----------------------+
|  carrierTenantId     |        |  towTenantId          |
|  (assureur / carrier)|--------|  (societe remorquage) |
|  donneur d'ordre     |  ref   |  execute la mission   |
+----------------------+        +-----------------------+
            |                              |
            | sinistreId                   | towOperatorId
            v                              v
   +-------------------+          +--------------------+
   |  customerUserId   |          |  TowOperator       |
   |  (assure -- PII)  |          |  (KYB, plaque, ICE)|
   +-------------------+          +--------------------+

tenantId = proprietaire de la ligne (RLS) -- distinct des trois references ci-dessus.
```

---

## Section 5 -- Livrables checkables

- [ ] L-01 : Repertoire `repo/packages/tow/` cree.
- [ ] L-02 : `packages/tow/package.json` present, name `@insurtech/tow`, version `0.1.0`, private true, type module.
- [ ] L-03 : Dependance runtime `zod` epinglee a `3.24.1` (save-exact, sans `^`/`~`).
- [ ] L-04 : Dependance runtime `typeorm` epinglee a `0.3.20` (pour les squelettes d'entites).
- [ ] L-05 : `reflect-metadata` present (requis par TypeORM decorateurs).
- [ ] L-06 : devDeps `@types/node` 22.10.5, `typescript` 5.7.3, `vitest` 2.1.8 (save-exact).
- [ ] L-07 : `packages/tow/tsconfig.json` etend `../../tsconfig.base.json`, composite true, declaration true, noEmit false.
- [ ] L-08 : `src/types/tow-mission.types.ts` exporte `TowMissionStatusEnum` (9 options), `TowMissionStatus`, `TruckTypeEnum` (3 options), `TruckType`, interface `TowMission`.
- [ ] L-09 : `src/types/tow-operator.types.ts` exporte `TowOperatorStatusEnum` (4 options), `TowOperatorStatus`, interface `TowOperator`.
- [ ] L-10 : `src/types/tow-location.types.ts` exporte `TowMissionLocation`, son schema Zod, `TRUCK_TYPE_CAPACITY`, et les helpers de zone.
- [ ] L-11 : `src/schemas/tow-operator.schema.ts` exporte `OnboardTowOperatorSchema`, `OnboardTowOperatorInput`, `ToggleAvailabilitySchema`, `ToggleAvailabilityInput`.
- [ ] L-12 : `src/schemas/tow-mission.schema.ts` exporte `DesignateMissionSchema`, `AcceptMissionSchema`, `RejectMissionSchema`, `TransitionStatusSchema`, `CancelMissionSchema` + types inferes.
- [ ] L-13 : `TOW_MISSION_ALLOWED_TRANSITIONS` exporte avec les 9 statuts couverts.
- [ ] L-14 : Helper pur `isTowMissionTransitionAllowed(from, to)` exporte.
- [ ] L-15 : `src/entities/tow-operator.entity.ts` : squelette TypeORM `@Entity('tow_operators')` avec colonnes `snake_case`.
- [ ] L-16 : `src/entities/tow-mission.entity.ts` : squelette TypeORM `@Entity('tow_missions')` avec colonnes `snake_case`.
- [ ] L-17 : JSDoc des entites indiquant tables DB + impl complete = Sprint 22.5.
- [ ] L-18 : `src/index.ts` reexporte tous les types/schemas/entites + exporte `VERSION = '0.1.0'`.
- [ ] L-19 : Regex plaque marocaine, ICE 15 chiffres, telephone `+212`, decimale honoraire presentes dans les schemas.
- [ ] L-20 : `zonesActive` valide avec au moins 1 zone.
- [ ] L-21 : `truckCapacityKg` valide entier positif.
- [ ] L-22 : Coordonnees `lat`/`lng` bornees (-90/90, -180/180) dans les schemas.
- [ ] L-23 : Fichier de tests `test/tow.spec.ts` (ou equivalent) avec 20+ assertions.
- [ ] L-24 : `pnpm --filter @insurtech/tow typecheck` passe (0 erreur).
- [ ] L-25 : `pnpm --filter @insurtech/tow test` passe.
- [ ] L-26 : `pnpm --filter @insurtech/tow build` genere `dist/index.d.ts` et `dist/index.js`.
- [ ] L-27 : `check-no-emoji.sh` ne detecte aucun emoji dans `packages/tow`.
- [ ] L-28 : Aucun service fonctionnel, aucun controleur, aucune migration cree (portee respectee).

---

## Section 6 -- Fichiers crees / modifies

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/tow/package.json` | CREER | Manifeste pnpm, ESM, save-exact, scripts build/typecheck/test/lint/clean |
| `packages/tow/tsconfig.json` | CREER | Etend tsconfig.base, composite, declaration |
| `packages/tow/src/index.ts` | CREER | Barrel + `VERSION` |
| `packages/tow/src/types/tow-mission.types.ts` | CREER | `TowMission`, enums statut/camion |
| `packages/tow/src/types/tow-operator.types.ts` | CREER | `TowOperator`, enum statut operateur |
| `packages/tow/src/types/tow-location.types.ts` | CREER | `TowMissionLocation`, mapping capacite, helpers zone |
| `packages/tow/src/schemas/tow-operator.schema.ts` | CREER | Onboarding KYB + disponibilite |
| `packages/tow/src/schemas/tow-mission.schema.ts` | CREER | Designate/Accept/Reject/Transition/Cancel + transitions map |
| `packages/tow/src/entities/tow-operator.entity.ts` | CREER | Squelette TypeORM |
| `packages/tow/src/entities/tow-mission.entity.ts` | CREER | Squelette TypeORM |
| `packages/tow/test/tow.spec.ts` | CREER | Tests Vitest (20+ assertions) |
| `packages/tow/vitest.config.ts` | CREER | Config Vitest minimale |
| `pnpm-workspace.yaml` | VERIFIER | `packages/*` couvre deja `tow` (aucune modification attendue) |

---

## Section 7 -- Code patterns COMPLETS

> Tous les blocs ci-dessous sont a creer tels quels. TypeScript strict, imports explicites, `const Schema = z.object(...)` puis `type X = z.infer<typeof Schema>`. Argent en `string`. Coordonnees en `number`. Aucune emoji.

### 7.1 Fichier : `packages/tow/package.json`

```json
{
  "name": "@insurtech/tow",
  "version": "0.1.0",
  "description": "Skalean InsurTech v3.0 (Assurflow) -- Tow/Remorqueur vertical foundation: types, Zod schemas, entity skeletons. Service implementation deferred to Sprint 22.5 (decision-012, 6-actor ecosystem). Initialized in Sprint 7.5b Task 2.5.2.",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest watch",
    "lint": "biome check --no-errors-on-unmatched src",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "reflect-metadata": "0.2.2",
    "typeorm": "0.3.20",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  },
  "sideEffects": false
}
```

Notes importantes :
- save-exact : aucune version n'a de `^` ou `~`. Verifiez `.npmrc` racine (`save-exact=true`) ; tout ajout ulterieur doit rester epingle.
- `type: "module"` -> ESM. Les imports dans le code doivent etre des chemins explicites.
- `typeorm` et `reflect-metadata` sont des dependances runtime parce que les squelettes d'entites utilisent les decorateurs. Ils ne sont PAS utilises a l'execution dans cette tache (pas de DataSource), mais le typecheck en a besoin.
- `sideEffects: false` permet le tree-shaking cote consommateurs.

### 7.2 Fichier : `packages/tow/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

Notes importantes :
- `composite: true` est requis pour les references de projet du monorepo (`tsc -b`).
- `noEmit: false` surcharge l'eventuel `noEmit: true` de la base (la base est partagee par des apps qui ne emettent pas).
- Les fichiers `*.spec.ts` sont exclus du build de declaration mais restent compiles par Vitest.
- Les decorateurs TypeORM exigent `experimentalDecorators` et `emitDecoratorMetadata` : ils DOIVENT etre actives dans `tsconfig.base.json`. Si ce n'est pas le cas dans la base, ajoutez-les ici dans `compilerOptions`. (Voir Section 12, edge case EC-04.)

### 7.3 Fichier : `packages/tow/src/types/tow-mission.types.ts`

```typescript
import { z } from 'zod';

/**
 * Statuts du cycle de vie d'une mission de remorquage (modele facon Uber).
 * 9 statuts. La machine a etats (transitions autorisees) est definie dans
 * src/schemas/tow-mission.schema.ts (TOW_MISSION_ALLOWED_TRANSITIONS).
 *
 * - designated : mission creee par le carrier et affectee a un operateur (etat initial)
 * - accepted   : operateur a accepte la mission
 * - en_route   : camion en route vers le point de prise en charge (tracking demarre)
 * - on_site    : camion arrive au point de prise en charge
 * - towing     : vehicule charge, remorquage vers le garage en cours
 * - delivered  : vehicule livre au garage de destination
 * - closed     : mission cloturee administrativement (terminal nominal)
 * - rejected   : mission refusee par l'operateur depuis designated (terminal)
 * - cancelled  : mission annulee depuis un etat actif intermediaire (terminal)
 */
export const TowMissionStatusEnum = z.enum([
  'designated',
  'accepted',
  'en_route',
  'on_site',
  'towing',
  'delivered',
  'closed',
  'rejected',
  'cancelled',
]);

export type TowMissionStatus = z.infer<typeof TowMissionStatusEnum>;

/**
 * Type de camion requis / disponible.
 * - light  : vehicule leger (jusqu'a 3500 kg de capacite de remorquage)
 * - medium : poids moyen (jusqu'a 7500 kg)
 * - heavy  : poids lourd (au-dela)
 * Le mapping de capacite est defini dans tow-location.types.ts (TRUCK_TYPE_CAPACITY).
 */
export const TruckTypeEnum = z.enum(['light', 'medium', 'heavy']);

export type TruckType = z.infer<typeof TruckTypeEnum>;

/**
 * Mission de remorquage.
 *
 * Multi-tenant : trois references de tenant coexistent.
 *  - tenantId        : proprietaire de la ligne (porte par la RLS)
 *  - carrierTenantId : assureur / plateforme donneur d'ordre
 *  - towTenantId     : societe de remorquage qui execute
 *
 * Argent : tous les champs honoraires sont des chaines decimales (jamais number).
 * Geo : pickupLat/pickupLng/destinationLat/destinationLng sont des number
 *       (futur numeric(10,7) cote DB).
 *
 * Les horodatages d'etape sont null tant que l'etape n'est pas atteinte.
 */
export interface TowMission {
  id: string;
  tenantId: string;
  carrierTenantId: string;
  towTenantId: string;
  towOperatorId: string;
  sinistreId: string;
  customerUserId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  destinationGarageId: string;
  destinationLat: number;
  destinationLng: number;
  truckTypeRequired: TruckType;
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  honoraireBaseMad: string;
  honoraireExtrasMad: string;
  honoraireTotalMad: string;
  status: TowMissionStatus;
  designatedAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  enRouteAt: Date | null;
  onSiteAt: Date | null;
  towingStartedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sous-ensemble des statuts terminaux (aucune transition sortante).
 * Utile pour les gardes du Sprint 22.5.
 */
export const TOW_MISSION_TERMINAL_STATUSES: readonly TowMissionStatus[] = [
  'closed',
  'rejected',
  'cancelled',
] as const;

/**
 * Sous-ensemble des statuts actifs (la mission est en cours d'execution).
 * en_route, on_site, towing constituent la fenetre de tracking temps reel.
 */
export const TOW_MISSION_ACTIVE_STATUSES: readonly TowMissionStatus[] = [
  'accepted',
  'en_route',
  'on_site',
  'towing',
] as const;
```

Notes importantes :
- `TowMissionStatusEnum.options` aura exactement 9 elements -- teste en Section 8.
- `TruckTypeEnum.options` aura exactement 3 elements.
- Ne jamais transformer un champ honoraire en `number`. Le standard du repo est argent = `string` decimale.
- `as const` sur les sous-ensembles fige le tuple en readonly literal.

### 7.4 Fichier : `packages/tow/src/types/tow-operator.types.ts`

```typescript
import { z } from 'zod';
import { TruckTypeEnum, type TruckType } from './tow-mission.types.js';

/**
 * Statut d'un operateur de remorquage.
 * - active       : KYB valide, peut recevoir des missions
 * - pending_kyb  : onboarding en cours, en attente de verification KYB
 * - suspended    : suspendu (incident, document expire)
 * - inactive     : desactive (depart, cessation)
 */
export const TowOperatorStatusEnum = z.enum([
  'active',
  'pending_kyb',
  'suspended',
  'inactive',
]);

export type TowOperatorStatus = z.infer<typeof TowOperatorStatusEnum>;

/**
 * Operateur de remorquage (remorqueur).
 *
 * Multi-tenant : tenantId est le tenant de la societe de remorquage.
 * ownerUserId reference l'utilisateur (auth_users) proprietaire du compte.
 *
 * Documents KYB (URLs vers le stockage souverain MA, chiffre AES-256-GCM) :
 *  - cinDocumentUrl       : piece d'identite nationale (CIN)
 *  - truckRegistrationUrl : carte grise du camion
 *  - towPermitUrl         : autorisation de transport / permis de remorquage
 *  - insuranceDocUrl      : attestation d'assurance professionnelle
 *
 * iceNumber : Identifiant Commun de l'Entreprise (15 chiffres).
 * baselineHonoraireMad : honoraire de base (string decimale, MAD).
 */
export interface TowOperator {
  id: string;
  tenantId: string;
  ownerUserId: string;
  fullName: string;
  cinDocumentUrl: string;
  truckPlate: string;
  truckRegistrationUrl: string;
  towPermitUrl: string;
  iceNumber: string;
  insuranceDocUrl: string;
  zonesActive: string[];
  truckCapacityKg: number;
  truckType: TruckType;
  status: TowOperatorStatus;
  totalMissions: number;
  avgRating: number;
  baselineHonoraireMad: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reexport pratique pour les consommateurs qui n'importent que ce module.
 */
export { TruckTypeEnum };
export type { TruckType };
```

Notes importantes :
- Import du type `TruckType` depuis `tow-mission.types.js` (extension `.js` obligatoire en ESM/NodeNext meme pour un fichier `.ts` source).
- `zonesActive: string[]` (codes de zone -- voir helpers dans `tow-location.types.ts`).
- `avgRating` est un `number` (note moyenne 0-5), pas de l'argent.
- `totalMissions` entier non negatif.

### 7.5 Fichier : `packages/tow/src/types/tow-location.types.ts`

```typescript
import { z } from 'zod';
import type { TruckType } from './tow-mission.types.js';

/**
 * Point de localisation temps reel d'une mission de remorquage.
 *
 * CNDP / loi 09-08 : donnee personnelle de geolocalisation. Minimisation
 * appliquee -- aucun identifiant de personne stocke ici, uniquement missionId.
 *
 * lat/lng sont des number bornes (futur numeric(10,7) cote DB).
 * heading (cap, degres 0-360) et speedKmh sont optionnels.
 */
export interface TowMissionLocation {
  missionId: string;
  lat: number;
  lng: number;
  recordedAt: Date;
  heading?: number;
  speedKmh?: number;
}

/**
 * Schema Zod du point de localisation.
 * Bornes geographiques strictes ; precision destinee a numeric(10,7).
 */
export const TowMissionLocationSchema = z.object({
  missionId: z.string().min(1, 'missionId requis'),
  lat: z
    .number()
    .min(-90, 'latitude >= -90')
    .max(90, 'latitude <= 90'),
  lng: z
    .number()
    .min(-180, 'longitude >= -180')
    .max(180, 'longitude <= 180'),
  recordedAt: z.coerce.date(),
  heading: z
    .number()
    .min(0, 'cap >= 0')
    .max(360, 'cap <= 360')
    .optional(),
  speedKmh: z
    .number()
    .min(0, 'vitesse >= 0')
    .max(200, 'vitesse <= 200')
    .optional(),
});

export type TowMissionLocationInput = z.infer<typeof TowMissionLocationSchema>;

/**
 * Mapping type de camion -> capacite maximale de remorquage (kg).
 * Sert de seuil d'adequation besoin/camion (garde appliquee au Sprint 22.5).
 */
export const TRUCK_TYPE_CAPACITY: Readonly<Record<TruckType, number>> = {
  light: 3500,
  medium: 7500,
  heavy: 40000,
} as const;

/**
 * Indique si un camion de type donne peut servir une charge donnee (kg).
 * Helper pur (sans effet de bord) -- la garde runtime est Sprint 22.5.
 */
export function canTruckHandle(truckType: TruckType, loadKg: number): boolean {
  if (!Number.isFinite(loadKg) || loadKg <= 0) {
    return false;
  }
  return loadKg <= TRUCK_TYPE_CAPACITY[truckType];
}

/**
 * Code de zone d'activite. Convention Assurflow :
 *   MA-<prefixe region 2-3 lettres majuscules>-<numero de zone 2 chiffres>
 * Exemples : MA-CAS-01, MA-RAB-02, MA-MAR-10.
 */
export const TOW_ZONE_CODE_REGEX = /^MA-[A-Z]{2,3}-\d{2}$/;

/**
 * Valide un code de zone.
 */
export function isValidZoneCode(code: string): boolean {
  return TOW_ZONE_CODE_REGEX.test(code);
}

/**
 * Schema Zod d'un code de zone (reutilise dans l'onboarding operateur).
 */
export const ZoneCodeSchema = z
  .string()
  .regex(TOW_ZONE_CODE_REGEX, 'code de zone invalide (attendu MA-XXX-99)');

/**
 * Extrait le prefixe de region d'un code de zone valide. Renvoie null si invalide.
 * Exemple : 'MA-CAS-01' -> 'CAS'.
 */
export function zoneRegionPrefix(code: string): string | null {
  if (!isValidZoneCode(code)) {
    return null;
  }
  const parts = code.split('-');
  return parts[1] ?? null;
}
```

Notes importantes :
- `z.coerce.date()` accepte une chaine ISO et la convertit en `Date` (utile cote API JSON).
- `TRUCK_TYPE_CAPACITY` est typee `Readonly<Record<TruckType, number>>` : ajouter un type de camion sans capacite provoque une erreur de compilation (securite).
- Les helpers `canTruckHandle`, `isValidZoneCode`, `zoneRegionPrefix` sont PURS (testables sans I/O).
- `noUncheckedIndexedAccess` impose `parts[1] ?? null`.

### 7.6 Fichier : `packages/tow/src/schemas/tow-operator.schema.ts`

```typescript
import { z } from 'zod';
import { TruckTypeEnum } from '../types/tow-mission.types.js';
import { ZoneCodeSchema } from '../types/tow-location.types.js';

/**
 * Regex plaque d'immatriculation marocaine (format pragmatique).
 * Accepte les formats usuels :
 *   - "12345-A-6"      (chiffres - lettre latine - chiffres)
 *   - "12345-6"        (anciens formats / serie)
 *   - lettres jusqu'a 2 caracteres pour la serie centrale.
 * On reste tolerant pour ne pas rejeter des plaques valides.
 */
export const MOROCCAN_PLATE_REGEX = /^\d{1,6}-[A-Za-z]{0,2}-?\d{1,3}$/;

/**
 * Regex ICE marocain : exactement 15 chiffres.
 */
export const ICE_REGEX = /^\d{15}$/;

/**
 * Regex telephone marocain E.164 : +212 suivi de 5/6/7 puis 8 chiffres.
 */
export const MOROCCAN_PHONE_REGEX = /^\+212[5-7]\d{8}$/;

/**
 * Regex montant decimal (MAD) : entier optionnel + jusqu'a 2 decimales.
 * Exemples valides : "0", "150", "150.50", "1200.00".
 */
export const DECIMAL_MAD_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Schema d'onboarding KYB d'un operateur de remorquage.
 * Valide toutes les pieces et metadonnees necessaires a l'activation.
 */
export const OnboardTowOperatorSchema = z.object({
  fullName: z
    .string()
    .min(2, 'nom complet trop court')
    .max(120, 'nom complet trop long'),
  phone: z
    .string()
    .regex(MOROCCAN_PHONE_REGEX, 'telephone marocain invalide (attendu +212XXXXXXXXX)'),
  cinDocumentUrl: z.string().url('URL CIN invalide'),
  truckPlate: z
    .string()
    .regex(MOROCCAN_PLATE_REGEX, 'plaque marocaine invalide'),
  truckRegistrationUrl: z.string().url('URL carte grise invalide'),
  towPermitUrl: z.string().url('URL permis de remorquage invalide'),
  iceNumber: z.string().regex(ICE_REGEX, 'ICE invalide (15 chiffres attendus)'),
  insuranceDocUrl: z.string().url('URL attestation assurance invalide'),
  zonesActive: z
    .array(ZoneCodeSchema)
    .min(1, 'au moins une zone d activite requise'),
  truckCapacityKg: z
    .number()
    .int('capacite entiere requise')
    .positive('capacite strictement positive requise'),
  truckType: TruckTypeEnum,
  baselineHonoraireMad: z
    .string()
    .regex(DECIMAL_MAD_REGEX, 'honoraire de base decimal invalide'),
});

export type OnboardTowOperatorInput = z.infer<typeof OnboardTowOperatorSchema>;

/**
 * Schema de bascule de disponibilite de l'operateur.
 * available=true -> l'operateur accepte de recevoir des missions.
 */
export const ToggleAvailabilitySchema = z.object({
  available: z.boolean(),
  reason: z.string().max(280, 'motif trop long').optional(),
});

export type ToggleAvailabilityInput = z.infer<typeof ToggleAvailabilitySchema>;
```

Notes importantes :
- Toutes les URLs de documents sont validees `z.string().url()`.
- `iceNumber` strictement 15 chiffres : un 14 ou 16 chiffres echoue.
- `zonesActive` reutilise `ZoneCodeSchema` -> chaque element doit matcher `MA-XXX-99`.
- `truckCapacityKg` doit etre `int` ET `positive`.
- `baselineHonoraireMad` est une chaine decimale (jamais number).

### 7.7 Fichier : `packages/tow/src/schemas/tow-mission.schema.ts`

```typescript
import { z } from 'zod';
import {
  TowMissionStatusEnum,
  TruckTypeEnum,
  type TowMissionStatus,
} from '../types/tow-mission.types.js';
import { DECIMAL_MAD_REGEX } from './tow-operator.schema.js';

/**
 * Sous-schema coordonnees geographiques bornees.
 */
const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Schema de designation d'une mission (creation + affectation initiale).
 * Statut resultant : designated.
 */
export const DesignateMissionSchema = z.object({
  carrierTenantId: z.string().min(1, 'carrierTenantId requis'),
  towTenantId: z.string().min(1, 'towTenantId requis'),
  towOperatorId: z.string().min(1, 'towOperatorId requis'),
  sinistreId: z.string().min(1, 'sinistreId requis'),
  customerUserId: z.string().min(1, 'customerUserId requis'),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupAddress: z.string().min(3, 'adresse de prise en charge requise'),
  destinationGarageId: z.string().min(1, 'destinationGarageId requis'),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  truckTypeRequired: TruckTypeEnum,
  estimatedDistanceKm: z.number().nonnegative('distance >= 0'),
  estimatedDurationMin: z.number().int().nonnegative('duree >= 0'),
  honoraireBaseMad: z.string().regex(DECIMAL_MAD_REGEX, 'honoraire de base invalide'),
  honoraireExtrasMad: z
    .string()
    .regex(DECIMAL_MAD_REGEX, 'extras invalides')
    .default('0'),
  notes: z.string().max(2000).optional(),
});

export type DesignateMissionInput = z.infer<typeof DesignateMissionSchema>;

/**
 * Schema d'acceptation d'une mission par l'operateur.
 * Transition : designated -> accepted.
 */
export const AcceptMissionSchema = z.object({
  missionId: z.string().min(1, 'missionId requis'),
  acknowledged: z.literal(true),
});

export type AcceptMissionInput = z.infer<typeof AcceptMissionSchema>;

/**
 * Schema de refus d'une mission par l'operateur (motif obligatoire).
 * Transition : designated -> rejected.
 */
export const RejectMissionSchema = z.object({
  missionId: z.string().min(1, 'missionId requis'),
  reason: z
    .string()
    .min(3, 'motif de refus requis')
    .max(500, 'motif de refus trop long'),
});

export type RejectMissionInput = z.infer<typeof RejectMissionSchema>;

/**
 * Payload optionnel attache a certaines transitions (photos de constat / livraison).
 */
const TransitionPayloadSchema = z
  .object({
    photos: z.array(z.string().url()).max(20).optional(),
    note: z.string().max(2000).optional(),
    location: CoordinatesSchema.optional(),
  })
  .optional();

/**
 * Schema generique de transition de statut.
 * newStatus doit etre un statut valide ; la legalite de la transition
 * elle-meme se verifie via isTowMissionTransitionAllowed (Sprint 22.5 pour la garde runtime).
 */
export const TransitionStatusSchema = z.object({
  missionId: z.string().min(1, 'missionId requis'),
  newStatus: TowMissionStatusEnum,
  payload: TransitionPayloadSchema,
});

export type TransitionStatusInput = z.infer<typeof TransitionStatusSchema>;

/**
 * Schema d'annulation d'une mission (motif obligatoire).
 * Transition : <etat actif> -> cancelled.
 */
export const CancelMissionSchema = z.object({
  missionId: z.string().min(1, 'missionId requis'),
  reason: z
    .string()
    .min(3, 'motif d annulation requis')
    .max(500, 'motif d annulation trop long'),
});

export type CancelMissionInput = z.infer<typeof CancelMissionSchema>;

/**
 * Carte des transitions autorisees de la machine a etats (9 statuts).
 * Cle = statut courant ; valeur = liste des statuts cibles legaux.
 * Les statuts terminaux (closed, rejected, cancelled) ont une liste vide.
 *
 * Regles :
 *   designated -> accepted | rejected | cancelled
 *   accepted   -> en_route | cancelled
 *   en_route   -> on_site  | cancelled
 *   on_site    -> towing   | cancelled
 *   towing     -> delivered | cancelled
 *   delivered  -> closed
 *   closed     -> (terminal)
 *   rejected   -> (terminal)
 *   cancelled  -> (terminal)
 */
export const TOW_MISSION_ALLOWED_TRANSITIONS: Readonly<
  Record<TowMissionStatus, readonly TowMissionStatus[]>
> = {
  designated: ['accepted', 'rejected', 'cancelled'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['on_site', 'cancelled'],
  on_site: ['towing', 'cancelled'],
  towing: ['delivered', 'cancelled'],
  delivered: ['closed'],
  closed: [],
  rejected: [],
  cancelled: [],
} as const;

/**
 * Helper pur : indique si la transition from -> to est autorisee.
 * Aucune transition vers soi-meme n'est legale (les listes ne se contiennent pas).
 */
export function isTowMissionTransitionAllowed(
  from: TowMissionStatus,
  to: TowMissionStatus,
): boolean {
  const allowed = TOW_MISSION_ALLOWED_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Helper pur : indique si un statut est terminal (aucune transition sortante).
 */
export function isTowMissionTerminal(status: TowMissionStatus): boolean {
  return TOW_MISSION_ALLOWED_TRANSITIONS[status].length === 0;
}
```

Notes importantes :
- `AcceptMissionSchema` exige `acknowledged: z.literal(true)` -- un accusé explicite, pas un boolean libre.
- `honoraireExtrasMad` a une valeur par defaut `'0'` (chaine).
- `TransitionPayloadSchema` est optionnel et porte les photos pour `delivered`/`on_site`.
- `TOW_MISSION_ALLOWED_TRANSITIONS` est `Readonly<Record<...>>` : oublier un statut provoque une erreur de compilation (les 9 cles sont obligatoires).
- `isTowMissionTransitionAllowed('designated', 'delivered')` renvoie `false` (teste en Section 8).

Matrice complete des transitions (from -> to autorises). Cette table est la representation tabulaire exhaustive de `TOW_MISSION_ALLOWED_TRANSITIONS`. Une case `oui` signifie que la transition est legale ; `--` signifie illegale.

| from \ to | designated | accepted | en_route | on_site | towing | delivered | closed | rejected | cancelled |
|-----------|-----------|----------|----------|---------|--------|-----------|--------|----------|-----------|
| designated | -- | oui | -- | -- | -- | -- | -- | oui | oui |
| accepted | -- | -- | oui | -- | -- | -- | -- | -- | oui |
| en_route | -- | -- | -- | oui | -- | -- | -- | -- | oui |
| on_site | -- | -- | -- | -- | oui | -- | -- | -- | oui |
| towing | -- | -- | -- | -- | -- | oui | -- | -- | oui |
| delivered | -- | -- | -- | -- | -- | -- | oui | -- | -- |
| closed | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| rejected | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| cancelled | -- | -- | -- | -- | -- | -- | -- | -- | -- |

Lecture : la diagonale est entierement `--` (aucune transition vers soi-meme). Les trois dernieres lignes (terminaux) sont entierement `--` (aucune sortie). La colonne `cancelled` est `oui` pour les cinq etats actifs mais `--` pour `delivered` (on n'annule pas un service rendu). La colonne `rejected` est `oui` pour `designated` seulement.

Note sur le calcul de l'honoraire (NON implemente ici). Le service de calcul du Sprint 22.5 appliquera l'invariant `honoraireTotalMad = honoraireBaseMad + honoraireExtrasMad`, ou `honoraireBaseMad = baselineHonoraireMad_operateur + tarif_km * estimatedDistanceKm + majoration_type_camion`. Le present package ne calcule RIEN : il TYPE ces trois montants en `string` decimale et les VALIDE par `DECIMAL_MAD_REGEX` (entier + jusqu'a 2 decimales). L'addition decimale exacte (via une bibliotheque decimale, jamais l'arithmetique flottante native) et la coherence inter-champs sont du ressort du service. Le schema valide la FORME de chaque montant, pas la COHERENCE arithmetique entre eux.

### 7.8 Fichier : `packages/tow/src/entities/tow-operator.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * SQUELETTE D'ENTITE -- Sprint 7.5b Task 2.5.2.
 *
 * Table DB cible : tow_operators.
 * FK semantiques (contraintes ajoutees au Sprint 22.5) :
 *   - tenant_id    -> auth_tenants(id)
 *   - owner_user_id -> auth_users(id)
 *
 * L'implementation complete (relations actives, index composites, RLS,
 * migrations, methodes metier) est DIFFEREE au Sprint 22.5. Ne pas ajouter
 * de logique ici.
 *
 * CNDP / loi 09-08 : les URLs de documents pointent vers un stockage souverain
 * MA chiffre AES-256-GCM ; aucune donnee brute d'identite n'est stockee en clair.
 */
@Entity('tow_operators')
export class TowOperatorEntity {
  @PrimaryColumn('uuid', { name: 'id' })
  id!: string;

  @Index('idx_tow_operators_tenant')
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'owner_user_id' })
  ownerUserId!: string;

  @Column('varchar', { name: 'full_name', length: 120 })
  fullName!: string;

  @Column('text', { name: 'cin_document_url' })
  cinDocumentUrl!: string;

  @Column('varchar', { name: 'truck_plate', length: 32 })
  truckPlate!: string;

  @Column('text', { name: 'truck_registration_url' })
  truckRegistrationUrl!: string;

  @Column('text', { name: 'tow_permit_url' })
  towPermitUrl!: string;

  @Column('varchar', { name: 'ice_number', length: 15 })
  iceNumber!: string;

  @Column('text', { name: 'insurance_doc_url' })
  insuranceDocUrl!: string;

  @Column('text', { name: 'zones_active', array: true })
  zonesActive!: string[];

  @Column('integer', { name: 'truck_capacity_kg' })
  truckCapacityKg!: number;

  @Column('varchar', { name: 'truck_type', length: 16 })
  truckType!: string;

  @Column('varchar', { name: 'status', length: 16, default: 'pending_kyb' })
  status!: string;

  @Column('integer', { name: 'total_missions', default: 0 })
  totalMissions!: number;

  @Column('numeric', { name: 'avg_rating', precision: 3, scale: 2, default: 0 })
  avgRating!: number;

  @Column('numeric', { name: 'baseline_honoraire_mad', precision: 12, scale: 2 })
  baselineHonoraireMad!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Notes importantes :
- `@Entity('tow_operators')` : nom de table en `snake_case` pluriel.
- Toutes les colonnes utilisent `name:` en `snake_case` explicite.
- `baseline_honoraire_mad` est `numeric(12,2)` en DB mais mappe en `string` cote TS (transformer Sprint 22.5).
- `zones_active` est un tableau texte PostgreSQL (`text[]`).
- Aucune methode metier. Aucun `@ManyToOne` actif (FK semantiques en commentaire -- ajoutees Sprint 22.5).

### 7.9 Fichier : `packages/tow/src/entities/tow-mission.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * SQUELETTE D'ENTITE -- Sprint 7.5b Task 2.5.2.
 *
 * Table DB cible : tow_missions.
 * FK semantiques (contraintes ajoutees au Sprint 22.5) :
 *   - tenant_id         -> auth_tenants(id)
 *   - carrier_tenant_id -> auth_tenants(id)
 *   - tow_tenant_id     -> auth_tenants(id)
 *   - tow_operator_id   -> tow_operators(id)
 *   - customer_user_id  -> auth_users(id)
 *
 * Coordonnees : numeric(10,7) (precision ~1.1 cm).
 * Argent : numeric(12,2) mappe en string cote TS.
 * Machine a etats : voir TOW_MISSION_ALLOWED_TRANSITIONS (schemas/tow-mission.schema.ts).
 *
 * L'implementation complete (relations, index composites, RLS, migrations,
 * application de la machine a etats) est DIFFEREE au Sprint 22.5.
 */
@Entity('tow_missions')
export class TowMissionEntity {
  @PrimaryColumn('uuid', { name: 'id' })
  id!: string;

  @Index('idx_tow_missions_tenant')
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'carrier_tenant_id' })
  carrierTenantId!: string;

  @Column('uuid', { name: 'tow_tenant_id' })
  towTenantId!: string;

  @Index('idx_tow_missions_operator')
  @Column('uuid', { name: 'tow_operator_id' })
  towOperatorId!: string;

  @Column('uuid', { name: 'sinistre_id' })
  sinistreId!: string;

  @Column('uuid', { name: 'customer_user_id' })
  customerUserId!: string;

  @Column('numeric', { name: 'pickup_lat', precision: 10, scale: 7 })
  pickupLat!: number;

  @Column('numeric', { name: 'pickup_lng', precision: 10, scale: 7 })
  pickupLng!: number;

  @Column('text', { name: 'pickup_address' })
  pickupAddress!: string;

  @Column('uuid', { name: 'destination_garage_id' })
  destinationGarageId!: string;

  @Column('numeric', { name: 'destination_lat', precision: 10, scale: 7 })
  destinationLat!: number;

  @Column('numeric', { name: 'destination_lng', precision: 10, scale: 7 })
  destinationLng!: number;

  @Column('varchar', { name: 'truck_type_required', length: 16 })
  truckTypeRequired!: string;

  @Column('numeric', { name: 'estimated_distance_km', precision: 8, scale: 2 })
  estimatedDistanceKm!: number;

  @Column('integer', { name: 'estimated_duration_min' })
  estimatedDurationMin!: number;

  @Column('numeric', { name: 'honoraire_base_mad', precision: 12, scale: 2 })
  honoraireBaseMad!: string;

  @Column('numeric', { name: 'honoraire_extras_mad', precision: 12, scale: 2, default: 0 })
  honoraireExtrasMad!: string;

  @Column('numeric', { name: 'honoraire_total_mad', precision: 12, scale: 2 })
  honoraireTotalMad!: string;

  @Index('idx_tow_missions_status')
  @Column('varchar', { name: 'status', length: 16, default: 'designated' })
  status!: string;

  @Column('timestamptz', { name: 'designated_at' })
  designatedAt!: Date;

  @Column('timestamptz', { name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column('timestamptz', { name: 'rejected_at', nullable: true })
  rejectedAt!: Date | null;

  @Column('text', { name: 'rejection_reason', nullable: true })
  rejectionReason!: string | null;

  @Column('timestamptz', { name: 'en_route_at', nullable: true })
  enRouteAt!: Date | null;

  @Column('timestamptz', { name: 'on_site_at', nullable: true })
  onSiteAt!: Date | null;

  @Column('timestamptz', { name: 'towing_started_at', nullable: true })
  towingStartedAt!: Date | null;

  @Column('timestamptz', { name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;

  @Column('timestamptz', { name: 'closed_at', nullable: true })
  closedAt!: Date | null;

  @Column('timestamptz', { name: 'cancelled_at', nullable: true })
  cancelledAt!: Date | null;

  @Column('text', { name: 'cancelled_reason', nullable: true })
  cancelledReason!: string | null;

  @Column('text', { name: 'notes', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Notes importantes :
- Coordonnees en `numeric(10,7)`. NE PAS reduire la precision.
- Les colonnes d'horodatage d'etape sont `nullable: true` et typees `Date | null`.
- `status` a un default `'designated'` (etat initial).
- Index sur `tenant_id`, `tow_operator_id`, `status` -- les index composites complets relevent du Sprint 22.5.

### 7.10 Fichier : `packages/tow/src/index.ts`

```typescript
/**
 * @insurtech/tow -- Fondation de la verticale Tow / Remorqueur (Assurflow).
 * Skalean InsurTech v3.0. decision-012 (ecosysteme 6 acteurs).
 *
 * Ce package expose UNIQUEMENT le contrat partage : types, schemas Zod,
 * squelettes d'entites. L'implementation des services est differee au Sprint 22.5.
 */

// Types
export * from './types/tow-mission.types.js';
export * from './types/tow-operator.types.js';
export * from './types/tow-location.types.js';

// Schemas
export * from './schemas/tow-operator.schema.js';
export * from './schemas/tow-mission.schema.js';

// Entites (squelettes -- impl complete Sprint 22.5)
export * from './entities/tow-operator.entity.js';
export * from './entities/tow-mission.entity.js';

/**
 * Version du contrat du package @insurtech/tow.
 */
export const VERSION = '0.1.0' as const;
```

Notes importantes :
- Tous les reexports utilisent l'extension `.js` (ESM/NodeNext).
- `VERSION` est une constante litterale alignee sur `package.json`.
- Le barrel ne contient AUCUNE logique d'execution.

### 7.11 Fichier : `packages/tow/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
```

Notes importantes :
- `globals: true` permet d'utiliser `describe/it/expect` sans import explicite (ou importez depuis `vitest` -- les deux fonctionnent).
- `environment: 'node'` : aucun DOM requis.

---

## Section 8 -- Tests complets

> Fichier : `packages/tow/test/tow.spec.ts`. 20+ assertions reparties en plusieurs `describe`. Couvre : comptes d'options des enums, validite/invalidite des schemas (ICE 15 chiffres, plaque, telephone +212, decimale honoraire), carte des transitions, helpers purs, et export du barrel.

```typescript
import { describe, it, expect } from 'vitest';

import {
  VERSION,
  TowMissionStatusEnum,
  TruckTypeEnum,
  TowOperatorStatusEnum,
  TOW_MISSION_ALLOWED_TRANSITIONS,
  TOW_MISSION_TERMINAL_STATUSES,
  TOW_MISSION_ACTIVE_STATUSES,
  isTowMissionTransitionAllowed,
  isTowMissionTerminal,
  OnboardTowOperatorSchema,
  ToggleAvailabilitySchema,
  DesignateMissionSchema,
  AcceptMissionSchema,
  RejectMissionSchema,
  TransitionStatusSchema,
  CancelMissionSchema,
  TowMissionLocationSchema,
  TRUCK_TYPE_CAPACITY,
  canTruckHandle,
  isValidZoneCode,
  zoneRegionPrefix,
  ICE_REGEX,
  MOROCCAN_PHONE_REGEX,
  MOROCCAN_PLATE_REGEX,
  DECIMAL_MAD_REGEX,
  TowOperatorEntity,
  TowMissionEntity,
} from '../src/index.js';

describe('barrel + version', () => {
  it('exporte VERSION 0.1.0', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('exporte les squelettes d entites', () => {
    expect(typeof TowOperatorEntity).toBe('function');
    expect(typeof TowMissionEntity).toBe('function');
  });
});

describe('enums -- comptes d options', () => {
  it('TowMissionStatusEnum a exactement 9 options', () => {
    expect(TowMissionStatusEnum.options).toHaveLength(9);
  });

  it('TowMissionStatusEnum contient les 9 statuts attendus', () => {
    expect(TowMissionStatusEnum.options).toEqual([
      'designated',
      'accepted',
      'en_route',
      'on_site',
      'towing',
      'delivered',
      'closed',
      'rejected',
      'cancelled',
    ]);
  });

  it('TruckTypeEnum a exactement 3 options', () => {
    expect(TruckTypeEnum.options).toHaveLength(3);
  });

  it('TowOperatorStatusEnum a exactement 4 options', () => {
    expect(TowOperatorStatusEnum.options).toHaveLength(4);
  });

  it('TowOperatorStatusEnum contient les statuts attendus', () => {
    expect(TowOperatorStatusEnum.options).toEqual([
      'active',
      'pending_kyb',
      'suspended',
      'inactive',
    ]);
  });
});

describe('machine a etats -- transitions autorisees', () => {
  it('couvre les 9 statuts comme cles', () => {
    expect(Object.keys(TOW_MISSION_ALLOWED_TRANSITIONS)).toHaveLength(9);
  });

  it('designated -> accepted autorise', () => {
    expect(isTowMissionTransitionAllowed('designated', 'accepted')).toBe(true);
  });

  it('designated -> rejected autorise', () => {
    expect(isTowMissionTransitionAllowed('designated', 'rejected')).toBe(true);
  });

  it('designated -> cancelled autorise', () => {
    expect(isTowMissionTransitionAllowed('designated', 'cancelled')).toBe(true);
  });

  it('designated -> delivered REFUSE (saut interdit)', () => {
    expect(isTowMissionTransitionAllowed('designated', 'delivered')).toBe(false);
  });

  it('accepted -> en_route autorise', () => {
    expect(isTowMissionTransitionAllowed('accepted', 'en_route')).toBe(true);
  });

  it('en_route -> on_site autorise', () => {
    expect(isTowMissionTransitionAllowed('en_route', 'on_site')).toBe(true);
  });

  it('on_site -> towing autorise', () => {
    expect(isTowMissionTransitionAllowed('on_site', 'towing')).toBe(true);
  });

  it('towing -> delivered autorise', () => {
    expect(isTowMissionTransitionAllowed('towing', 'delivered')).toBe(true);
  });

  it('delivered -> closed autorise', () => {
    expect(isTowMissionTransitionAllowed('delivered', 'closed')).toBe(true);
  });

  it('accepted -> rejected REFUSE (refus seulement depuis designated)', () => {
    expect(isTowMissionTransitionAllowed('accepted', 'rejected')).toBe(false);
  });

  it('closed est terminal', () => {
    expect(isTowMissionTerminal('closed')).toBe(true);
  });

  it('rejected est terminal', () => {
    expect(isTowMissionTerminal('rejected')).toBe(true);
  });

  it('cancelled est terminal', () => {
    expect(isTowMissionTerminal('cancelled')).toBe(true);
  });

  it('designated n est pas terminal', () => {
    expect(isTowMissionTerminal('designated')).toBe(false);
  });

  it('TOW_MISSION_TERMINAL_STATUSES a 3 elements', () => {
    expect(TOW_MISSION_TERMINAL_STATUSES).toHaveLength(3);
  });

  it('TOW_MISSION_ACTIVE_STATUSES a 4 elements', () => {
    expect(TOW_MISSION_ACTIVE_STATUSES).toHaveLength(4);
  });
});

describe('regex de validation', () => {
  it('ICE_REGEX accepte 15 chiffres', () => {
    expect(ICE_REGEX.test('001234567000089')).toBe(true);
  });

  it('ICE_REGEX rejette 14 chiffres', () => {
    expect(ICE_REGEX.test('00123456700008')).toBe(false);
  });

  it('ICE_REGEX rejette 16 chiffres', () => {
    expect(ICE_REGEX.test('0012345670000890')).toBe(false);
  });

  it('MOROCCAN_PHONE_REGEX accepte +212 valide', () => {
    expect(MOROCCAN_PHONE_REGEX.test('+212612345678')).toBe(true);
  });

  it('MOROCCAN_PHONE_REGEX rejette format 0X', () => {
    expect(MOROCCAN_PHONE_REGEX.test('0612345678')).toBe(false);
  });

  it('MOROCCAN_PLATE_REGEX accepte une plaque usuelle', () => {
    expect(MOROCCAN_PLATE_REGEX.test('12345-A-6')).toBe(true);
  });

  it('DECIMAL_MAD_REGEX accepte 150.50', () => {
    expect(DECIMAL_MAD_REGEX.test('150.50')).toBe(true);
  });

  it('DECIMAL_MAD_REGEX rejette 3 decimales', () => {
    expect(DECIMAL_MAD_REGEX.test('150.505')).toBe(false);
  });
});

describe('OnboardTowOperatorSchema', () => {
  const valid = {
    fullName: 'Brahim Remorquage SARL',
    phone: '+212661112233',
    cinDocumentUrl: 'https://storage.ma/cin.pdf',
    truckPlate: '12345-A-6',
    truckRegistrationUrl: 'https://storage.ma/grise.pdf',
    towPermitUrl: 'https://storage.ma/permis.pdf',
    iceNumber: '001234567000089',
    insuranceDocUrl: 'https://storage.ma/assurance.pdf',
    zonesActive: ['MA-CAS-01', 'MA-RAB-02'],
    truckCapacityKg: 5000,
    truckType: 'medium' as const,
    baselineHonoraireMad: '350.00',
  };

  it('accepte un onboarding valide', () => {
    expect(OnboardTowOperatorSchema.safeParse(valid).success).toBe(true);
  });

  it('rejette un ICE de 14 chiffres', () => {
    const r = OnboardTowOperatorSchema.safeParse({ ...valid, iceNumber: '00123456700008' });
    expect(r.success).toBe(false);
  });

  it('rejette un telephone non +212', () => {
    const r = OnboardTowOperatorSchema.safeParse({ ...valid, phone: '0612345678' });
    expect(r.success).toBe(false);
  });

  it('rejette zonesActive vide', () => {
    const r = OnboardTowOperatorSchema.safeParse({ ...valid, zonesActive: [] });
    expect(r.success).toBe(false);
  });

  it('rejette une capacite negative', () => {
    const r = OnboardTowOperatorSchema.safeParse({ ...valid, truckCapacityKg: -1 });
    expect(r.success).toBe(false);
  });

  it('rejette un honoraire non decimal', () => {
    const r = OnboardTowOperatorSchema.safeParse({ ...valid, baselineHonoraireMad: 'abc' });
    expect(r.success).toBe(false);
  });

  it('rejette un code de zone mal forme', () => {
    const r = OnboardTowOperatorSchema.safeParse({ ...valid, zonesActive: ['CASA-1'] });
    expect(r.success).toBe(false);
  });
});

describe('ToggleAvailabilitySchema', () => {
  it('accepte available=true', () => {
    expect(ToggleAvailabilitySchema.safeParse({ available: true }).success).toBe(true);
  });

  it('rejette available manquant', () => {
    expect(ToggleAvailabilitySchema.safeParse({}).success).toBe(false);
  });
});

describe('DesignateMissionSchema', () => {
  const valid = {
    carrierTenantId: 'carrier-1',
    towTenantId: 'tow-1',
    towOperatorId: 'op-1',
    sinistreId: 'sin-1',
    customerUserId: 'cust-1',
    pickupLat: 33.5731,
    pickupLng: -7.5898,
    pickupAddress: 'Boulevard Mohammed V, Casablanca',
    destinationGarageId: 'garage-1',
    destinationLat: 33.589,
    destinationLng: -7.61,
    truckTypeRequired: 'light' as const,
    estimatedDistanceKm: 12.4,
    estimatedDurationMin: 25,
    honoraireBaseMad: '300.00',
  };

  it('accepte une designation valide', () => {
    const r = DesignateMissionSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('applique honoraireExtrasMad par defaut a 0', () => {
    const r = DesignateMissionSchema.parse(valid);
    expect(r.honoraireExtrasMad).toBe('0');
  });

  it('rejette une latitude hors bornes', () => {
    const r = DesignateMissionSchema.safeParse({ ...valid, pickupLat: 200 });
    expect(r.success).toBe(false);
  });
});

describe('AcceptMissionSchema / RejectMissionSchema / CancelMissionSchema', () => {
  it('Accept exige acknowledged=true', () => {
    expect(AcceptMissionSchema.safeParse({ missionId: 'm1', acknowledged: true }).success).toBe(true);
    expect(AcceptMissionSchema.safeParse({ missionId: 'm1', acknowledged: false }).success).toBe(false);
  });

  it('Reject exige un motif', () => {
    expect(RejectMissionSchema.safeParse({ missionId: 'm1', reason: 'indisponible' }).success).toBe(true);
    expect(RejectMissionSchema.safeParse({ missionId: 'm1', reason: '' }).success).toBe(false);
  });

  it('Cancel exige un motif', () => {
    expect(CancelMissionSchema.safeParse({ missionId: 'm1', reason: 'client absent' }).success).toBe(true);
    expect(CancelMissionSchema.safeParse({ missionId: 'm1' }).success).toBe(false);
  });
});

describe('TransitionStatusSchema', () => {
  it('accepte un statut valide', () => {
    const r = TransitionStatusSchema.safeParse({ missionId: 'm1', newStatus: 'en_route' });
    expect(r.success).toBe(true);
  });

  it('accepte un payload de photos', () => {
    const r = TransitionStatusSchema.safeParse({
      missionId: 'm1',
      newStatus: 'delivered',
      payload: { photos: ['https://storage.ma/p1.jpg'] },
    });
    expect(r.success).toBe(true);
  });

  it('rejette un statut inconnu', () => {
    const r = TransitionStatusSchema.safeParse({ missionId: 'm1', newStatus: 'flying' });
    expect(r.success).toBe(false);
  });
});

describe('TowMissionLocationSchema + helpers geo', () => {
  it('accepte un point valide', () => {
    const r = TowMissionLocationSchema.safeParse({
      missionId: 'm1',
      lat: 33.5731,
      lng: -7.5898,
      recordedAt: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });

  it('rejette une longitude hors bornes', () => {
    const r = TowMissionLocationSchema.safeParse({
      missionId: 'm1',
      lat: 33,
      lng: 999,
      recordedAt: new Date().toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it('TRUCK_TYPE_CAPACITY couvre les 3 types', () => {
    expect(Object.keys(TRUCK_TYPE_CAPACITY)).toHaveLength(3);
  });

  it('canTruckHandle : light gere 3000 kg mais pas 5000 kg', () => {
    expect(canTruckHandle('light', 3000)).toBe(true);
    expect(canTruckHandle('light', 5000)).toBe(false);
  });

  it('isValidZoneCode valide MA-CAS-01', () => {
    expect(isValidZoneCode('MA-CAS-01')).toBe(true);
    expect(isValidZoneCode('casa')).toBe(false);
  });

  it('zoneRegionPrefix extrait CAS', () => {
    expect(zoneRegionPrefix('MA-CAS-01')).toBe('CAS');
    expect(zoneRegionPrefix('invalide')).toBe(null);
  });
});

describe('machine a etats -- couverture exhaustive de la matrice', () => {
  it('chemin nominal complet est entierement legal', () => {
    const path: Array<[string, string]> = [
      ['designated', 'accepted'],
      ['accepted', 'en_route'],
      ['en_route', 'on_site'],
      ['on_site', 'towing'],
      ['towing', 'delivered'],
      ['delivered', 'closed'],
    ];
    for (const [from, to] of path) {
      expect(
        isTowMissionTransitionAllowed(
          from as keyof typeof TOW_MISSION_ALLOWED_TRANSITIONS,
          to as keyof typeof TOW_MISSION_ALLOWED_TRANSITIONS,
        ),
      ).toBe(true);
    }
  });

  it('cancelled est legal depuis tous les etats actifs non livres', () => {
    for (const from of ['designated', 'accepted', 'en_route', 'on_site', 'towing'] as const) {
      expect(isTowMissionTransitionAllowed(from, 'cancelled')).toBe(true);
    }
  });

  it('cancelled est ILLEGAL depuis delivered (service rendu)', () => {
    expect(isTowMissionTransitionAllowed('delivered', 'cancelled')).toBe(false);
  });

  it('rejected n est legal que depuis designated', () => {
    expect(isTowMissionTransitionAllowed('designated', 'rejected')).toBe(true);
    for (const from of ['accepted', 'en_route', 'on_site', 'towing', 'delivered'] as const) {
      expect(isTowMissionTransitionAllowed(from, 'rejected')).toBe(false);
    }
  });

  it('aucune transition vers soi-meme n est legale', () => {
    for (const s of TowMissionStatusEnum.options) {
      expect(isTowMissionTransitionAllowed(s, s)).toBe(false);
    }
  });

  it('les sauts d etape sont tous illegaux', () => {
    expect(isTowMissionTransitionAllowed('designated', 'en_route')).toBe(false);
    expect(isTowMissionTransitionAllowed('accepted', 'on_site')).toBe(false);
    expect(isTowMissionTransitionAllowed('en_route', 'towing')).toBe(false);
    expect(isTowMissionTransitionAllowed('on_site', 'delivered')).toBe(false);
  });

  it('les retours arriere sont tous illegaux', () => {
    expect(isTowMissionTransitionAllowed('en_route', 'accepted')).toBe(false);
    expect(isTowMissionTransitionAllowed('towing', 'on_site')).toBe(false);
    expect(isTowMissionTransitionAllowed('delivered', 'towing')).toBe(false);
  });

  it('les terminaux n ont aucune cible', () => {
    for (const t of ['closed', 'rejected', 'cancelled'] as const) {
      expect(TOW_MISSION_ALLOWED_TRANSITIONS[t]).toHaveLength(0);
    }
  });

  it('TOW_MISSION_TERMINAL_STATUSES correspond aux listes vides', () => {
    for (const s of TowMissionStatusEnum.options) {
      const isTerminalByList = TOW_MISSION_ALLOWED_TRANSITIONS[s].length === 0;
      const isTerminalBySet = TOW_MISSION_TERMINAL_STATUSES.includes(s);
      expect(isTerminalBySet).toBe(isTerminalByList);
    }
  });
});

describe('regex -- cas supplementaires', () => {
  it('ICE_REGEX rejette de l alphanumerique', () => {
    expect(ICE_REGEX.test('00123456700008A')).toBe(false);
  });

  it('ICE_REGEX rejette une chaine avec espaces', () => {
    expect(ICE_REGEX.test('0012 3456 7000 089')).toBe(false);
  });

  it('MOROCCAN_PHONE_REGEX accepte +212 5/6/7 en tete', () => {
    expect(MOROCCAN_PHONE_REGEX.test('+212512345678')).toBe(true);
    expect(MOROCCAN_PHONE_REGEX.test('+212712345678')).toBe(true);
  });

  it('MOROCCAN_PHONE_REGEX rejette un prefixe 8', () => {
    expect(MOROCCAN_PHONE_REGEX.test('+212812345678')).toBe(false);
  });

  it('DECIMAL_MAD_REGEX accepte un entier sans decimale', () => {
    expect(DECIMAL_MAD_REGEX.test('1200')).toBe(true);
    expect(DECIMAL_MAD_REGEX.test('0')).toBe(true);
  });

  it('DECIMAL_MAD_REGEX rejette une virgule (separateur FR)', () => {
    expect(DECIMAL_MAD_REGEX.test('150,50')).toBe(false);
  });

  it('DECIMAL_MAD_REGEX rejette un signe negatif', () => {
    expect(DECIMAL_MAD_REGEX.test('-10.00')).toBe(false);
  });

  it('MOROCCAN_PLATE_REGEX rejette une chaine vide', () => {
    expect(MOROCCAN_PLATE_REGEX.test('')).toBe(false);
  });
});

describe('canTruckHandle -- adequation capacite', () => {
  it('rejette une charge nulle ou negative', () => {
    expect(canTruckHandle('medium', 0)).toBe(false);
    expect(canTruckHandle('medium', -100)).toBe(false);
  });

  it('rejette une charge non finie', () => {
    expect(canTruckHandle('heavy', Number.POSITIVE_INFINITY)).toBe(false);
    expect(canTruckHandle('heavy', Number.NaN)).toBe(false);
  });

  it('medium gere exactement 7500 kg (borne incluse)', () => {
    expect(canTruckHandle('medium', 7500)).toBe(true);
    expect(canTruckHandle('medium', 7501)).toBe(false);
  });

  it('heavy gere une charge lourde', () => {
    expect(canTruckHandle('heavy', 30000)).toBe(true);
  });
});

describe('schemas -- montants decimaux et coordonnees', () => {
  it('DesignateMissionSchema rejette un honoraire de base non decimal', () => {
    const base = {
      carrierTenantId: 'c', towTenantId: 't', towOperatorId: 'o', sinistreId: 's',
      customerUserId: 'u', pickupLat: 33, pickupLng: -7, pickupAddress: 'rue X',
      destinationGarageId: 'g', destinationLat: 33, destinationLng: -7,
      truckTypeRequired: 'light' as const, estimatedDistanceKm: 1, estimatedDurationMin: 1,
      honoraireBaseMad: '12.345',
    };
    expect(DesignateMissionSchema.safeParse(base).success).toBe(false);
  });

  it('OnboardTowOperatorSchema accepte un honoraire entier', () => {
    const valid = {
      fullName: 'X SARL', phone: '+212661112233',
      cinDocumentUrl: 'https://s.ma/c.pdf', truckPlate: '12345-A-6',
      truckRegistrationUrl: 'https://s.ma/g.pdf', towPermitUrl: 'https://s.ma/p.pdf',
      iceNumber: '001234567000089', insuranceDocUrl: 'https://s.ma/a.pdf',
      zonesActive: ['MA-CAS-01'], truckCapacityKg: 5000, truckType: 'medium' as const,
      baselineHonoraireMad: '350',
    };
    expect(OnboardTowOperatorSchema.safeParse(valid).success).toBe(true);
  });

  it('TowMissionLocationSchema accepte heading et speedKmh optionnels', () => {
    const r = TowMissionLocationSchema.safeParse({
      missionId: 'm1', lat: 33, lng: -7, recordedAt: new Date().toISOString(),
      heading: 180, speedKmh: 60,
    });
    expect(r.success).toBe(true);
  });

  it('TowMissionLocationSchema rejette une vitesse aberrante', () => {
    const r = TowMissionLocationSchema.safeParse({
      missionId: 'm1', lat: 33, lng: -7, recordedAt: new Date().toISOString(),
      speedKmh: 500,
    });
    expect(r.success).toBe(false);
  });
});

describe('barrel -- exhaustivite des exports', () => {
  it('expose toutes les regex de validation', () => {
    expect(ICE_REGEX).toBeInstanceOf(RegExp);
    expect(MOROCCAN_PHONE_REGEX).toBeInstanceOf(RegExp);
    expect(MOROCCAN_PLATE_REGEX).toBeInstanceOf(RegExp);
    expect(DECIMAL_MAD_REGEX).toBeInstanceOf(RegExp);
  });

  it('expose les sous-ensembles de statuts', () => {
    expect(Array.isArray(TOW_MISSION_TERMINAL_STATUSES)).toBe(true);
    expect(Array.isArray(TOW_MISSION_ACTIVE_STATUSES)).toBe(true);
  });

  it('expose les helpers purs comme fonctions', () => {
    expect(typeof isTowMissionTransitionAllowed).toBe('function');
    expect(typeof isTowMissionTerminal).toBe('function');
    expect(typeof canTruckHandle).toBe('function');
    expect(typeof isValidZoneCode).toBe('function');
    expect(typeof zoneRegionPrefix).toBe('function');
  });
});
```

Notes importantes :
- Le fichier importe depuis `../src/index.js` (barrel) -> verifie aussi que tous les exports sont accessibles.
- Les tests d'enums (9 / 3 / 4) sont les garde-fous principaux contre une modification accidentelle.
- Les tests de transition couvrent un saut interdit (`designated -> delivered`) et un refus tardif interdit (`accepted -> rejected`).
- Les blocs ajoutes verifient la matrice de maniere exhaustive (chemin nominal, cancelled depuis chaque etat actif, rejected depuis designated uniquement, sauts et retours arriere illegaux, transitions vers soi-meme, coherence terminaux/sous-ensemble), des cas regex supplementaires (alphanumerique, espaces, virgule FR, signe negatif, prefixes telephone), l'adequation `canTruckHandle` sur les bornes, et l'exhaustivite du barrel.
- Plus de 60 `it(...)` au total, largement au-dessus du minimum de 20.

---

## Section 9 -- Variables d'environnement

Cette tache n'introduit AUCUN runtime, donc aucune nouvelle variable n'est strictement requise. Les variables ci-dessous sont documentees pour le Sprint 22.5 (consommateur du package) et listees ici par anticipation.

| Variable | Portee | Description | Exemple |
|----------|--------|-------------|---------|
| `TOW_TRACKING_TTL_SECONDS` | Sprint 22.5 | TTL Redis des points de tracking temps reel | `86400` |
| `TOW_MAX_ZONES_PER_OPERATOR` | Sprint 22.5 | Borne haute du nombre de zones d'activite | `12` |
| `TOW_DEFAULT_HONORAIRE_MAD` | Sprint 22.5 | Honoraire de base par defaut si non fourni | `300.00` |
| `STORAGE_BUCKET_TOW_DOCS` | Sprint 22.5 | Bucket souverain MA des documents KYB | `tow-kyb-docs` |
| `KAFKA_TOPIC_TOW_EVENTS` | Sprint 22.5 | Topic des evenements Tow | `insurtech.events.tow.mission` |
| `NODE_ENV` | Build/test | Environnement d'execution | `test` |

Notes importantes :
- Aucune de ces variables ne doit etre lue dans le code de cette tache (sinon violation de portee).
- Aucune donnee d'assure ne quitte le Maroc (decision-008) : `STORAGE_BUCKET_TOW_DOCS` pointe vers Atlas Benguerir.

---

## Section 10 -- Commandes shell

```bash
# Depuis la racine du monorepo (repo/).

# 1. Creer l'arborescence du package.
mkdir -p packages/tow/src/types packages/tow/src/schemas packages/tow/src/entities packages/tow/test

# 2. Creer les fichiers (voir Section 7 pour le contenu exact) :
#    packages/tow/package.json
#    packages/tow/tsconfig.json
#    packages/tow/vitest.config.ts
#    packages/tow/src/index.ts
#    packages/tow/src/types/tow-mission.types.ts
#    packages/tow/src/types/tow-operator.types.ts
#    packages/tow/src/types/tow-location.types.ts
#    packages/tow/src/schemas/tow-operator.schema.ts
#    packages/tow/src/schemas/tow-mission.schema.ts
#    packages/tow/src/entities/tow-operator.entity.ts
#    packages/tow/src/entities/tow-mission.entity.ts
#    packages/tow/test/tow.spec.ts

# 3. Installer les dependances (epinglees, save-exact).
pnpm install

# 4. Verifier les types.
pnpm --filter @insurtech/tow typecheck

# 5. Lancer les tests.
pnpm --filter @insurtech/tow test

# 6. Construire le package.
pnpm --filter @insurtech/tow build

# 7. Verifier les artefacts de declaration.
ls packages/tow/dist/index.d.ts packages/tow/dist/index.js

# 8. Lint (Biome).
pnpm --filter @insurtech/tow lint

# 9. Verifier l'absence d'emoji (decision-006).
bash scripts/check-no-emoji.sh packages/tow

# 10. Nettoyer (optionnel).
pnpm --filter @insurtech/tow clean
```

Notes importantes :
- `pnpm install` est requis au moins une fois pour lier le nouveau package dans le workspace.
- Sur Windows/PowerShell, utilisez l'outil Bash pour ces commandes POSIX, ou adaptez `mkdir`/`ls`.

---

## Section 11 -- Criteres de validation

> Format : ID -- priorite -- commande -- attendu -- mode d'echec. P0 >= 15, P1 >= 8, P2 >= 5.

### P0 (bloquants -- 17)

| ID | Commande | Attendu | Mode d'echec |
|----|----------|---------|--------------|
| V1 | `test -d packages/tow/src/types` | repertoire present | structure incomplete |
| V2 | `cat packages/tow/package.json \| grep '"@insurtech/tow"'` | name present | mauvais nom de package |
| V3 | `grep '"zod": "3.24.1"' packages/tow/package.json` | match exact | version non epinglee |
| V4 | `grep '"typeorm": "0.3.20"' packages/tow/package.json` | match exact | dependance entites manquante |
| V5 | `! grep -E '"\^\|~' packages/tow/package.json` | aucun caret/tilde | save-exact viole |
| V6 | `pnpm --filter @insurtech/tow typecheck` | exit 0 | erreurs de types |
| V7 | `pnpm --filter @insurtech/tow test` | exit 0, tests verts | assertion echouee |
| V8 | `pnpm --filter @insurtech/tow build` | dist genere | build casse |
| V9 | `test -f packages/tow/dist/index.d.ts` | declaration emise | declaration absente |
| V10 | `grep -c "'designated'\|'accepted'\|'en_route'\|'on_site'\|'towing'\|'delivered'\|'closed'\|'rejected'\|'cancelled'" packages/tow/src/types/tow-mission.types.ts` | 9 statuts | enum incomplet |
| V11 | `grep "z.enum(\['light', 'medium', 'heavy'\])" packages/tow/src/types/tow-mission.types.ts` | present | TruckType incorrect |
| V12 | `grep "TOW_MISSION_ALLOWED_TRANSITIONS" packages/tow/src/schemas/tow-mission.schema.ts` | present | machine a etats absente |
| V13 | `grep "isTowMissionTransitionAllowed" packages/tow/src/schemas/tow-mission.schema.ts` | present | helper absent |
| V14 | `grep "@Entity('tow_operators')" packages/tow/src/entities/tow-operator.entity.ts` | present | entite manquante |
| V15 | `grep "@Entity('tow_missions')" packages/tow/src/entities/tow-mission.entity.ts` | present | entite manquante |
| V16 | `grep "export const VERSION = '0.1.0'" packages/tow/src/index.ts` | present | VERSION manquante |
| V17 | `bash scripts/check-no-emoji.sh packages/tow` | exit 0 | emoji detecte (decision-006) |

### P1 (importants -- 9)

| ID | Commande | Attendu | Mode d'echec |
|----|----------|---------|--------------|
| V18 | `grep "/^\\\\d{15}\$/" packages/tow/src/schemas/tow-operator.schema.ts` | ICE_REGEX present | validation ICE absente |
| V19 | `grep "\\+212" packages/tow/src/schemas/tow-operator.schema.ts` | telephone +212 | regex telephone absente |
| V20 | `grep "MOROCCAN_PLATE_REGEX" packages/tow/src/schemas/tow-operator.schema.ts` | present | plaque non validee |
| V21 | `grep "DECIMAL_MAD_REGEX" packages/tow/src/schemas/tow-operator.schema.ts` | present | honoraire non valide |
| V22 | `grep "numeric', { name: 'pickup_lat', precision: 10, scale: 7" packages/tow/src/entities/tow-mission.entity.ts` | present | precision geo incorrecte |
| V23 | `grep "TRUCK_TYPE_CAPACITY" packages/tow/src/types/tow-location.types.ts` | present | mapping capacite absent |
| V24 | `grep "honoraireBaseMad: string" packages/tow/src/types/tow-mission.types.ts` | present | argent en number |
| V25 | `grep "min(1" packages/tow/src/schemas/tow-operator.schema.ts` | zonesActive min 1 | zones non bornees |
| V26 | `grep "extends.*tsconfig.base.json" packages/tow/tsconfig.json` | present | tsconfig non herite |

### P2 (souhaitables -- 12)

| ID | Commande | Attendu | Mode d'echec |
|----|----------|---------|--------------|
| V27 | `grep "TowMissionLocation" packages/tow/src/types/tow-location.types.ts` | present | type tracking absent |
| V28 | `grep "TOW_ZONE_CODE_REGEX" packages/tow/src/types/tow-location.types.ts` | present | helper zone absent |
| V29 | `grep "Sprint 22.5" packages/tow/src/entities/tow-mission.entity.ts` | JSDoc present | tracabilite portee absente |
| V30 | `grep "ToggleAvailabilitySchema" packages/tow/src/schemas/tow-operator.schema.ts` | present | disponibilite absente |
| V31 | `grep -c "it(" packages/tow/test/tow.spec.ts` | >= 20 | tests insuffisants |
| V32 | `grep "sideEffects.*false" packages/tow/package.json` | present | tree-shaking non declare |
| V33 | `grep "isTowMissionTerminal" packages/tow/src/schemas/tow-mission.schema.ts` | present | helper terminal absent |
| V34 | `grep "canTruckHandle" packages/tow/src/types/tow-location.types.ts` | present | helper adequation absent |
| V35 | `grep "pending_kyb" packages/tow/src/entities/tow-operator.entity.ts` | default present | KYB contournable |
| V36 | `grep "default('0')" packages/tow/src/schemas/tow-mission.schema.ts` | present | extras non defaultes |
| V37 | `grep -c "@Column" packages/tow/src/entities/tow-mission.entity.ts` | >= 25 | colonnes mission incompletes |
| V38 | `grep "VERSION = '0.1.0'" packages/tow/src/index.ts` | aligne package.json | VERSION desynchronisee |

Synthese des compteurs de criteres : 17 P0 + 9 P1 + 12 P2 = 38 criteres de validation, repartis pour garantir la portee (structure, save-exact, typecheck/test/build, enums, machine a etats, entites, regex, geo, helpers, tests). Le seuil de la meta-regle (P0 >= 15, P1 >= 8, P2 >= 5) est largement depasse.

---

## Section 12 -- Edge cases + troubleshooting

- EC-01 -- Saut de statut interdit. `designated -> delivered` doit retourner `false`. Si votre carte autorise ce saut, vous avez introduit un trou de securite. Verifiez `TOW_MISSION_ALLOWED_TRANSITIONS['designated']` = `['accepted', 'rejected', 'cancelled']`.
- EC-02 -- Refus tardif. `rejected` ne doit etre atteignable que depuis `designated`. Un `accepted -> rejected` doit echouer (utiliser `cancelled`).
- EC-03 -- Erreur ESM "Cannot find module". En `type: "module"` + NodeNext, les imports relatifs DOIVENT porter l'extension `.js` (meme pour `.ts`). Symptome : `ERR_MODULE_NOT_FOUND`. Corrigez tous les imports relatifs.
- EC-04 -- Decorateurs TypeORM non reconnus. Si `tsc` se plaint des decorateurs (`Experimental support for decorators...`), c'est que `experimentalDecorators`/`emitDecoratorMetadata` ne sont pas actifs dans `tsconfig.base.json`. Ajoutez-les dans `compilerOptions` du `tsconfig.json` du package.
- EC-05 -- `exactOptionalPropertyTypes`. Avec cette option, `heading?: number` n'accepte pas explicitement `undefined` assigne. Ne forcez pas `heading: undefined` ; omettez la cle.
- EC-06 -- Index PostgreSQL sur `text[]`. La colonne `zones_active` (`text[]`) ne supporte pas un index B-tree simple. L'index GIN approprie est defini au Sprint 22.5 (ne pas l'ajouter ici).
- EC-07 -- ICE avec espaces. Un ICE saisi avec espaces (`0012 3456 7000 089`) echoue `ICE_REGEX`. La normalisation (suppression des espaces) est cote API (Sprint 22.5) ; le schema valide la forme canonique 15 chiffres.
- EC-08 -- Plaque trop permissive. Le `MOROCCAN_PLATE_REGEX` livre est volontairement tolerant. Si une plaque manifestement invalide passe, c'est attendu a ce stade ; un durcissement viendra avec les regles metier reelles (Sprint 22.5).
- EC-09 -- `numeric` mappe en string vs number. TypeORM renvoie les `numeric` en `string` par defaut. Les coordonnees sont typees `number` cote entite pour l'ergonomie ; un transformer de colonne (Sprint 22.5) garantira la conversion. A ce stade, l'entite n'est jamais hydratee (pas de DataSource), donc aucun probleme runtime.
- EC-10 -- Test qui importe `../src/index.ts` au lieu de `.js`. Vitest tolere les deux ; preferez `.js` pour rester coherent avec l'ESM de production.
- EC-11 -- Default `honoraireExtrasMad` perdu apres `safeParse`. Le default `'0'` n'est applique que si la cle est ABSENTE de l'entree. Si le client envoie `honoraireExtrasMad: undefined` explicitement avec `exactOptionalPropertyTypes`, le comportement differe : omettez la cle plutot que d'envoyer `undefined`. Le test `applique honoraireExtrasMad par defaut a 0` couvre le cas nominal (cle absente).
- EC-12 -- `z.coerce.date()` sur une chaine invalide. `recordedAt: 'pas-une-date'` produit un `Invalid Date` qui echoue la validation `z.coerce.date()` (Zod verifie `!isNaN`). Ne pas supposer qu'une chaine arbitraire est acceptee ; seules les chaines ISO 8601 (ou timestamps numeriques) sont coercees correctement.
- EC-13 -- Capacite camion flottante. `truckCapacityKg: 5000.5` echoue `.int()`. Les capacites sont des entiers (kg). Le piege est d'accepter un flottant provenant d'un calcul cote client ; arrondir AVANT envoi (cote API Sprint 22.5).
- EC-14 -- `zonesActive` avec doublons. Le schema accepte `['MA-CAS-01', 'MA-CAS-01']` (chaque element matche `ZoneCodeSchema`). La deduplication n'est PAS faite ici ; elle releve du service d'onboarding (Sprint 22.5). A ce stade, le schema valide la FORME de chaque code, pas l'unicite de l'ensemble.
- EC-15 -- Coordonnees aux bornes exactes. `lat: -90`, `lat: 90`, `lng: -180`, `lng: 180` sont VALIDES (bornes incluses via `.min()/.max()`). Ne pas confondre avec une borne exclusive ; un point au pole ou a l'antimeridien passe. Au Maroc ce cas ne se presente pas, mais le schema est generaliste.
- EC-16 -- `TransitionStatusSchema` accepte un statut syntaxiquement valide mais illegal en transition. Le schema valide que `newStatus` est l'un des 9 statuts (enum), PAS que la transition `from -> newStatus` est legale. La legalite se verifie via `isTowMissionTransitionAllowed` (helper) et sera appliquee par la garde runtime du Sprint 22.5. Ne pas attendre du schema seul qu'il bloque un saut illegal.
- EC-17 -- Build composite sans `tsconfig.base.json` resolu. Si `extends: "../../tsconfig.base.json"` ne resout pas (chemin relatif errone, base absente), `tsc` echoue avec `File not found`. Verifier la profondeur du chemin relatif depuis `packages/tow/`.

---

## Section 13 -- Conformite Maroc

- Autorisation de transport / permis de remorquage. Le champ `towPermitUrl` et la colonne `tow_permit_url` materialisent l'obligation de detenir une autorisation de transport routier. Le KYB ne peut etre valide (`status = active`) sans ce document. La verification effective est un controle metier du Sprint 22.5.
- ICE (Identifiant Commun de l'Entreprise). Obligatoire pour toute entreprise marocaine. Valide a 15 chiffres exactement (`ICE_REGEX`). Stocke en `varchar(15)`.
- Attestation d'assurance. `insuranceDocUrl` / `insurance_doc_url` : preuve de l'assurance professionnelle du remorqueur. Pre-requis KYB.
- CIN. `cinDocumentUrl` / `cin_document_url` : piece d'identite du proprietaire / gerant.
- CNDP -- loi 09-08 (protection des donnees personnelles). Deux flux de geolocalisation sont des donnees personnelles : la position du camion (operateur) et, indirectement, la localisation du client assure (point de prise en charge).
  - Minimisation : le point de tracking (`TowMissionLocation`) ne stocke que `missionId` -- aucun identifiant nominatif.
  - Residence des donnees (decision-008) : toutes les donnees (documents KYB, points de tracking, missions) restent au Maroc (cloud souverain Atlas Benguerir), chiffrees AES-256-GCM au repos, TLS 1.3 en transit.
  - Conservation : les TTL des points de tracking (`TOW_TRACKING_TTL_SECONDS`) limitent la duree de conservation (parametre Sprint 22.5).
  - Finalite : la geolocalisation sert exclusivement a l'execution et a la preuve de la mission de remorquage.

---

## Section 14 -- Conventions absolues

- Multi-tenant strict : l'entete `x-tenant-id` est obligatoire sur toutes les routes sauf `/api/v1/public/*` et `/api/v1/admin/*`. `TenantGuard` applique. Contexte propage via `AsyncLocalStorage`. RLS PostgreSQL via `app_can_access_tenant()`. Audit trail systematique. (Cette tache ne cree pas de routes, mais les types portent deja `tenantId`, `carrierTenantId`, `towTenantId`.)
- Validation strict : Zod uniquement. Tous les schemas sont exportes. Pattern impose : `const Schema = z.object(...)` puis `type X = z.infer<typeof Schema>`.
- Logger strict : Pino injecte (`nestjs-pino`). Jamais de `console.log`. Champs JSON structures : `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`. (Aucun logger dans cette tache.)
- Hash strict : argon2id parametres `65536/3/4`. Jamais bcrypt. `PASSWORD_PEPPER` applique. (Hors portee ici.)
- Package manager strict : pnpm uniquement. `engine-strict`, Node >= 22.11.0. save-exact (aucun `^` ni `~`). `link-workspace-packages=deep`.
- TypeScript strict : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes`. Imports explicites.
- Tests strict : Vitest + Playwright. Chaque `.ts` a son `.spec.ts`. Couverture >= 85 % (et >= 90 % pour auth/database/signature).
- RBAC strict : `@Roles()` par endpoint. `RolesGuard` + `TenantGuard`. 26 roles en v3.0. (Hors portee ici -- pas d'endpoint.)
- Events strict : Kafka, topics `insurtech.events.{vertical}.{entity}.{action}`. Un schema Zod par evenement. `Idempotency-Key` sur les operations critiques. (Topics Tow definis au Sprint 22.5.)
- Imports strict : `@insurtech/{name}`. Paths declares dans `tsconfig.base.json`. Ordre des imports : Node / externes / `@insurtech/*` / relatifs.
- Skalean AI strict (decision-005) : acces uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un modele frontier. Mock pour les sprints 1-28, reel a partir du sprint 29. (Hors portee ici.)
- No-emoji strict (decision-006 ABSOLUE) : aucun emoji nulle part (code, commentaires, docs). `check-no-emoji.sh` ; la CI echoue sinon.
- Idempotency-Key strict : obligatoire sur `POST /payments`, `/signatures`, `/claims`, et les ecritures MCP. TTL 24h dans Redis.
- Conventional Commits strict : `<type>(scope): description`. `commitlint` via husky.
- Cloud souverain MA strict (decision-008) : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee d'assure ne quitte le Maroc ; AES-256-GCM au repos ; TLS 1.3 en transit.
- Naming v3.0 (decision-011) : Skalean (societe), Assurflow (verticale produit), Sofidemy (marque). N'utiliser aucun ancien nom.

---

## Section 15 -- Validation pre-commit

```bash
# A executer avant tout commit, depuis repo/.

# 1. Typecheck du package.
pnpm --filter @insurtech/tow typecheck

# 2. Tests.
pnpm --filter @insurtech/tow test

# 3. Build (verifie l'emission des declarations).
pnpm --filter @insurtech/tow build

# 4. Lint Biome.
pnpm --filter @insurtech/tow lint

# 5. Anti-emoji (decision-006).
bash scripts/check-no-emoji.sh packages/tow

# 6. Verifier l'absence de caret/tilde dans le manifeste.
! grep -E '"[~^]' packages/tow/package.json && echo "save-exact OK"

# 7. Verifier qu'aucun service/controleur n'a ete cree (portee).
test ! -d packages/tow/src/services && test ! -d packages/tow/src/controllers && echo "portee respectee"
```

Le commit est autorise uniquement si les sept etapes passent sans erreur.

---

## Section 16 -- Message de commit

```
feat(sprint-7.5b): package @insurtech/tow structure + types

Cree le package monorepo @insurtech/tow, fondation de la verticale
Tow / Remorqueur de l'ecosysteme Assurflow a 6 acteurs (decision-012).

Livrables :
- package.json (ESM, save-exact, zod 3.24.1, typeorm 0.3.20) + tsconfig composite
- types : TowMission (9 statuts), TruckType (3), TowOperator (4 statuts),
  TowMissionLocation (tracking geo)
- schemas Zod : onboarding KYB operateur (CIN, plaque MA, ICE 15 chiffres,
  telephone +212, assurance, permis), designation/acceptation/refus/transition/
  annulation de mission, disponibilite
- machine a etats : TOW_MISSION_ALLOWED_TRANSITIONS + isTowMissionTransitionAllowed
- squelettes d'entites TypeORM (tow_operators, tow_missions, colonnes snake_case)
- barrel index.ts + VERSION
- tests Vitest (40+ assertions : enums, transitions, schemas, helpers geo)

Portee : types/schemas/squelettes uniquement. Implementation des services
differee au Sprint 22.5. Aucune emoji (decision-006).

Task: 2.5.2
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: 012
```

---

## Section 17 -- Workflow next step

Une fois cette tache validee (les 7 etapes pre-commit vertes, commit pousse) :

1. Passer a la tache 2.5.3 -- module de permissions customer (147 permissions). Cette tache etend le catalogue de permissions pour l'acteur client (customer) de l'ecosysteme a 6 acteurs ; elle est BLOQUEE par la presente tache (2.5.2) car certaines permissions referencent les ressources Tow (missions, tracking) dont les types viennent d'etre etablis.
2. Verifier que `@insurtech/tow` est resolu correctement par le workspace (`pnpm ls --filter @insurtech/tow`) avant de demarrer 2.5.3.
3. Tenir a jour le suivi : marquer 2.5.2 `completed`, basculer 2.5.3 `in_progress`.
4. Rappel : les services Tow (matching, dispatch, calcul honoraires, application de la machine a etats, persistance, evenements Kafka) sont a implementer au Sprint 22.5 (squelettes prepares en tache 2.5.8). Ne pas les anticiper.

Sortie attendue de 2.5.3 : extension du catalogue de permissions a ~147 entrees customer, tests RBAC associes, documentation `5-roles-permissions.md` mise a jour.

---

Fin de la tache 2.5.2 -- Package `@insurtech/tow` : structure + types + schemas Zod + squelettes entites. Sprint 7.5b (Assurflow Foundation). decision-012. AUCUNE EMOJI (decision-006).
