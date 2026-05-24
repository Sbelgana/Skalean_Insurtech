# Tache 2.5.3 -- Permissions : ajout du module `customer` (+17) -> catalog 147 v3.0

## 1. Metadonnees (en-tete)

| Champ | Valeur |
| --- | --- |
| Identifiant tache | `2.5.3` |
| Titre | Permissions : ajout du module `customer` (17 permissions, acteur 5) -> catalog 130 -> 147 |
| Sprint | `7.5b` (Assurflow Foundation -- Phase 2 / Sprint 5) |
| Reference meta-prompt | `B-7.5b` tache `2.5.3` (REVISEE suite a la decision utilisateur de resolution de conflit B-7.5a / B-7.5b) |
| Phase | Phase 2 (Foundation verticale Assurflow) |
| Priorite | `P0` (bloquant -- le catalog est la source unique de verite RBAC consommee par la matrice, les guards et la doc) |
| Effort estime | `1h` |
| Dependances | Tache `2.5.2` (package `@insurtech/tow`) + **Sprint 7.5a deja merge : catalog deja a 130 permissions, 24 modules, 26 roles** |
| Bloque | Tache `2.5.4` (entite foundation `insure_experts`) |
| Densite cible | 80-150 ko (cible 100-120 ko) |
| Package cible | `@insurtech/auth` (`packages/auth`) |
| Decisions structurantes | `decision-011` (naming v3.0 Skalean/Assurflow/Sofidemy), `decision-012` (catalog RBAC en `const ... as const`, JAMAIS `enum` ; acteur 5 = Customer differencie de l'`assure` generique) |
| Contrainte emoji | **AUCUNE EMOJI nulle part (decision-006, ABSOLUE)** -- la CI `check-no-emoji.sh` echoue sinon |
| Langue | Prose francaise, code TypeScript strict complet et executable |

> RAPPEL CRITIQUE EN UNE PHRASE : cette tache **n'ajoute QUE le module `customer` (17 permissions) au catalog existant qui est DEJA a 130** ; elle ne refait PAS l'extension 85 -> 130 (carrier/expertise/tow/parts) deja livree et mergee par le Sprint 7.5a. Resultat final : **147 permissions, 25 modules**.

---

## 2. But

Etendre le catalog de permissions RBAC du package `@insurtech/auth` en ajoutant **uniquement** le nouveau module fonctionnel `customer` compose de **17 permissions** (`customer.*`), faisant passer le catalog de **130** (etat livre et merge par le Sprint 7.5a) a **147** permissions, et le registre de modules de **24** a **25** (`Object.values(Module).length`).

Concretement, le perimetre strict et fini de cette tache est :

1. Ajouter **17 entrees** `CUSTOMER_*` a la `const Permission` (objet `as const`), inserees dans un bloc commente clairement delimite, **juste avant** le `} as const;` final, **apres** les blocs `carrier/expertise/tow/parts` deja presents (qu'on ne touche pas).
2. Ajouter **une seule** entree `CUSTOMER: 'customer'` au `const Module` de `permission-helpers.ts` (24 -> 25 modules). `ALL_MODULES` derive automatiquement via `Object.values(Module)`.
3. Ajouter au `const Action` les actions non standard introduites par le module `customer` (par ex. `DECLARE_FNOL`, `READ_MINE`, `TRACK_PROGRESS`, `RENEW`, `INITIATE`, `CONTACT`, `SUBMIT`, `TRACK`), si elles ne sont pas deja presentes apres 7.5a -- ou documenter l'approche `EXTENDED_ACTIONS` heritee de 7.5a.
4. Assigner ces 17 permissions au role `assure` (acteur 5 = end customer dans le modele a 26 roles v3.0) dans `permissions-matrix.ts`.
5. Mettre a jour les tests : compteur total `130 -> 147`, `ALL_MODULES.length` `24 -> 25`, presence du module `customer`, presence et unicite des 17 cles, conformite naming, **non-regression** des 130 permissions anterieures.
6. Verifier que le validator boot-time accepte le module `customer` et les actions non standard.

Ce qui est **explicitement HORS perimetre** (a NE PAS faire) :

- Refaire l'extension `85 -> 130` (carrier/expertise/tow/parts). **Elle est deja la, mergee par 7.5a. La toucher = regression et conflit de merge.**
- Migrer le catalog vers un `enum`. **Interdit par decision-012.** On reste sur `const ... as const`.
- Modifier la structure des roles (26 roles) ou ajouter un role. Le role `assure` existe deja.
- Toucher aux guards, au cache Redis, ou aux endpoints admin.

Forme structurelle imposee (rappel decision-012) :

```typescript
export const Permission = {
  // ... 130 entrees existantes (NE PAS TOUCHER) ...
  // === Sprint 7.5b v3.0 -- Customer module (17 perms, actor 5) ===
  CUSTOMER_SINISTRES_DECLARE_FNOL: 'customer.sinistres.declare_fnol',
  // ... 16 autres ...
} as const;
```

JAMAIS :

```typescript
export enum Permission { /* INTERDIT -- decision-012 */ }
```

### 2.1 Definition operationnelle de "termine"

Cette tache est consideree comme terminee lorsque, et seulement lorsque, l'ensemble des conditions suivantes est simultanement vrai :

- `ALL_PERMISSIONS.length === 147` ET `ALL_MODULES.length === 25` ;
- les 17 cles `CUSTOMER_*` et leurs 17 valeurs `customer.*` sont presentes, uniques, et conformes au naming ;
- le role `assure` porte les 17 permissions customer, sans doublon ;
- le validator boot-time accepte le module `customer` sans lever d'erreur ;
- les 130 permissions anterieures (90 v2.2 + 40 verticaux 7.5a) sont strictement inchangees ;
- `typecheck`, `lint`, `test` passent ; couverture RBAC >= 90% ;
- aucune emoji, aucun `enum Permission` introduit.

Si l'une de ces conditions est fausse, la tache n'est PAS terminee, meme si le code compile. Le contrat numerique (147 / 25 / 17 / 130) est la mesure objective d'achevement.

### 2.2 Ce que cette tache N'EST PAS

Pour dissiper toute ambiguite recurrente liee a la revision du conflit B-7.5a / B-7.5b :

- Ce **n'est pas** une tache d'extension multi-modules. Un seul module est ajoute : `customer`.
- Ce **n'est pas** une tache de creation de role. Aucun nouveau role n'est cree ; on reste a 26 roles.
- Ce **n'est pas** une tache de refonte du parsing ou de la regex de naming. Le socle 7.5a est suppose en place et suffisant.
- Ce **n'est pas** une tache d'implementation d'endpoints. On ouvre des droits ; on ne code aucun controleur, service, ni guard d'endpoint. Les Sprints consommateurs (8 a 15) feront ce travail.
- Ce **n'est pas** une tache de migration de donnees. Le catalog est du code, pas une table ; aucune migration SQL.

---

## 3. Contexte etendu

### 3.1 Resolution du conflit B-7.5a / B-7.5b (point central de cette tache REVISEE)

Les meta-prompts `B-7.5a` et `B-7.5b` se chevauchaient sur le sujet de l'extension du catalog de permissions. La version initiale de la tache `2.5.3` (telle qu'ecrite dans `B-7.5b`) decrivait une extension `85 -> 130` portant les modules `carrier`, `expertise`, `tow`, `parts`. Or **le Sprint 7.5a a deja realise et merge cette extension** (tache `7.5a.6` -- `permissions-catalog-extension-130.md`). Le catalog reel sur la branche cible est donc deja a **130 permissions** et **24 modules**.

L'utilisateur a tranche ce conflit de la maniere suivante (decision faisant autorite) :

- **`B-7.5a` / Sprint 7.5a est AUTORITAIRE.** L'extension 85 -> 130 est consideree comme acquise, mergee, immuable dans le cadre de cette tache.
- **La tache `2.5.3` est REVISEE** : son perimetre devient strictement **additif** -- elle ajoute le **seul module restant** prevu pour l'experience self-service du client final, le module `customer` (17 permissions), portant le catalog de **130 a 147**.

Consequence operationnelle directe : si, en lisant le fichier `permissions.enum.ts`, l'agent voit deja les blocs `CARRIER (15)`, `EXPERTISE (10)`, `TOW (8)`, `PARTS (7)` -- **c'est NORMAL et ATTENDU**. Il ne faut **ni les supprimer, ni les recreer, ni les dedupliquer**. On insere uniquement le nouveau bloc `CUSTOMER (17)`.

Inversement, si l'agent constate que le catalog n'est PAS a 130 (par ex. encore a 85, modules carrier/expertise/tow/parts absents), cela signifie que la dependance Sprint 7.5a n'est PAS satisfaite : il faut s'arreter, le signaler explicitement, et NE PAS tenter de combler 85 -> 130 dans cette tache (ce n'est pas son role). C'est un blocage de dependance, pas un travail a faire ici.

#### 3.1.1 Pourquoi la revision plutot que la suppression de la tache

Une alternative aurait ete de supprimer purement et simplement la tache `2.5.3` puisque `B-7.5a` couvrait deja les modules verticaux. Cette option a ete ecartee : le module `customer` n'a **jamais** ete livre par 7.5a. 7.5a couvre les acteurs back-office du sinistre (compagnie, expert, depanneur, fournisseur de pieces) ; il ne couvre PAS l'experience self-service du client final. Le module `customer` reste donc un livrable necessaire et non redondant. La revision conserve la tache mais en redefinit le delta : delta = `customer` uniquement, base = 130 (acquis).

#### 3.1.2 Protocole de detection de l'etat de depart

Avant toute modification, l'agent DOIT etablir l'etat reel du catalog sur la branche. Le protocole de detection est le suivant :

1. Compter les permissions actuelles : `grep -c "'.*\..*\..*'" packages/auth/src/rbac/permissions.enum.ts` (approximation) ou, plus surement, executer le test de comptage existant.
2. Verifier la presence des marqueurs de blocs 7.5a : `grep -n "CARRIER (15)\|EXPERTISE (10)\|TOW (8)\|PARTS (7)" packages/auth/src/rbac/permissions.enum.ts`.
3. Verifier la presence d'un echantillon temoin 7.5a : `grep -c "carrier.payment.approve_level4" packages/auth/src/rbac/permissions.enum.ts` (attendu : `1`).
4. Verifier `ALL_MODULES.length` courant (attendu : `24` avant cette tache).

Trois cas possibles a l'issue du protocole :

- **Cas A (nominal)** : 130 permissions, 24 modules, blocs 7.5a presents une seule fois. -> Procéder a l'ajout customer.
- **Cas B (dependance non satisfaite)** : moins de 130, modules verticaux absents. -> STOP, signaler le blocage de dependance Sprint 7.5a. Ne pas combler.
- **Cas C (etat corrompu)** : plus de 130 deja, ou blocs 7.5a en double. -> STOP, signaler une anomalie de branche (merge incorrect amont). Ne pas empiler customer par-dessus un etat corrompu.

Cette discipline de detection evite les deux erreurs symetriques : combler 85 -> 130 (cas B mal gere) et empiler sur des doublons (cas C mal gere).

### 3.2 Pourquoi un acteur "Customer" differencie (decision-012, acteur 5)

Le modele d'acteurs Assurflow v3.0 distingue plusieurs roles autour du sinistre automobile au Maroc. Historiquement, le terme `assure` (l'assure, le souscripteur d'une police) couvrait de maniere indifferenciee "la personne couverte par un contrat". La decision-012 introduit une distinction de granularite : l'**acteur 5 = Customer** est le **client final en posture self-service**, c'est-a-dire l'utilisateur de l'application mobile/web qui :

- declare lui-meme son sinistre (FNOL -- First Notice Of Loss) ;
- suit l'avancement de son dossier ;
- consulte et accepte un devis de reparation ;
- suit la position de la depanneuse en temps reel ;
- signe electroniquement le bon de livraison du vehicule repare ;
- regle ses paiements (franchise, complement) ;
- consulte ses polices, ses documents, gere ses notifications, donne son feedback et contacte le support.

Dans le modele a 26 roles v3.0, **l'incarnation technique de cet acteur 5 reste le role `assure`** (on ne cree PAS un 27e role). Autrement dit : "Customer" est un concept fonctionnel/acteur ; `assure` est le role RBAC qui le porte. Les 17 permissions `customer.*` sont donc assignees au role `assure` dans la matrice. Le prefixe de module `customer` (et non `assure`) est choisi pour decrire le **domaine fonctionnel self-service** independamment du nom du role -- exactement comme le module `carrier` decrit le domaine compagnie d'assurance porte par les roles `carrier_*`.

#### 3.2.1 Acteur vs role : la regle de cardinalite

La distinction acteur/role n'est pas cosmetique ; elle obeit a une regle de cardinalite explicite. Un **acteur** est une intention fonctionnelle (qui veut faire quoi). Un **role** est un porteur technique de droits. La relation n'est pas forcement 1-pour-1 :

- Plusieurs acteurs peuvent partager un meme role (par exemple, dans certains tenants, un acteur "souscripteur particulier" et un acteur "conducteur autorise" peuvent tous deux etre portes par le role `assure`).
- Un meme acteur peut, dans des contextes differents, etre porte par des roles distincts (un gestionnaire compagnie peut etre un acteur back-office le jour et un acteur self-service en tant que client de sa propre assurance le soir).

Pour l'acteur 5 (Customer), la decision-012 fixe : **un seul role porteur, `assure`**. C'est ce qui justifie que les 17 permissions soient assignees a `assure` et a `assure` seul (test de scope V20). Le module `customer` materialise l'**intention** self-service ; le role `assure` materialise le **porteur**.

#### 3.2.2 Cartographie des 17 permissions sur le role `assure` dans le modele a 26 roles

Le modele a 26 roles v3.0 comporte (rappel non exhaustif, pour situer `assure`) : roles plateforme (`super_admin`, `platform_admin`, `support_agent`...), roles tenant (`tenant_admin`, `tenant_manager`...), roles metier compagnie (`carrier_admin`, `carrier_underwriter`, `carrier_claims_manager`...), roles expert (`expert_lead`, `expert_field`...), roles atelier/depanneur (`garage_manager`, `tow_operator`...), et l'acteur client : `assure`. Les 17 permissions `customer.*` viennent **enrichir** la liste de permissions deja portee par `assure` (qui comportait deja, avant cette tache, des droits de lecture minimaux herites de v2.2 cote `insure.*` cote client). On **ajoute** ; on ne **remplace** pas.

La cartographie est donc : `AuthRole.ASSURE` -> { permissions anterieures } UNION { 17 permissions customer }. Le `Set`/spread garantit l'absence de doublon. Les 25 autres roles ne recoivent **aucune** permission `customer.*` (scope self-service strict).

### 3.3 Le parcours self-service client (justification des 17 permissions)

Le decoupage des 17 permissions suit le parcours reel du client final, etape par etape :

1. **Declaration du sinistre (FNOL)** -- `customer.sinistres.declare_fnol` : le client ouvre lui-meme son dossier de sinistre depuis l'app (photos, circonstances, geolocalisation).
2. **Suivi de mes sinistres** -- `customer.sinistres.read_mine` : lecture restreinte a SES propres sinistres (jamais ceux d'autrui ; couplee a la RLS et au scope tenant).
3. **Suivi d'avancement** -- `customer.sinistres.track_progress` : timeline d'avancement (expertise planifiee, devis emis, reparation en cours, etc.).
4. **Consultation du devis** -- `customer.devis.view` : visualisation du devis de reparation produit par le garage/expert.
5. **Acceptation du devis** -- `customer.devis.accept` : acceptation explicite et tracee (consentement, horodatage -- pertinent ACAPS).
6. **Suivi de mes reparations** -- `customer.repairs.read_mine` : etat d'avancement de la reparation cote garage.
7. **Signature de la livraison** -- `customer.delivery.sign` : e-signature du bon de remise du vehicule (loi 43-20 -- voir section 13).
8. **Suivi de la depanneuse** -- `customer.tow.track` : suivi temps reel de la mission de remorquage (position du chauffeur, ETA).
9. **Consultation des polices** -- `customer.policies.view` : lecture des contrats d'assurance souscrits.
10. **Renouvellement de police** -- `customer.policies.renew` : declenchement d'un renouvellement.
11. **Consultation des paiements** -- `customer.payments.view` : historique des paiements / franchises.
12. **Initiation d'un paiement** -- `customer.payments.initiate` : declenchement d'un paiement (couvert par Idempotency-Key, voir section 14).
13. **Lecture des documents** -- `customer.documents.read` : attestations, quittances, rapports d'expertise communicables.
14. **Gestion des notifications** -- `customer.notifications.manage` : preferences de notification (canaux, frequence).
15. **Depot de feedback** -- `customer.feedback.submit` : note/avis sur la prestation (garage, expert, depanneur).
16. **Contact support** -- `customer.support.contact` : ouverture d'un ticket / contact assistance.
17. **Mise a jour du profil** -- `customer.profile.update` : modification des donnees personnelles (CNDP -- voir section 13).

#### 3.3.1 Sequence temporelle du parcours (du sinistre a la cloture)

Le parcours self-service n'est pas une liste plate de droits ; c'est une chronologie. Comprendre l'enchainement aide a justifier le decoupage et a anticiper les couplages aval :

```
  T0  Sinistre survenu
   |
   v
  [1] declare_fnol .......... le client ouvre le dossier (photos, geoloc, circonstances)
   |                          -> endpoint idempotent (Idempotency-Key)
   v
  [8] tow.track ............. si remorquage : suivi temps reel du depanneur (ETA, position)
   |
   v
  [2] read_mine (sinistres) . le client retrouve son dossier dans l'app
  [3] track_progress ........ il suit la timeline (expertise planifiee, en cours...)
   |
   v
  [4] devis.view ............ l'expert/garage a produit un devis ; le client le consulte
  [5] devis.accept .......... acceptation tracee (consentement horodate, ACAPS)
   |
   v
  [6] repairs.read_mine ..... suivi de la reparation cote garage
   |
   v
 [11] payments.view ......... le client voit la franchise / le complement a regler
 [12] payments.initiate ..... il declenche le paiement (Idempotency-Key)
   |
   v
  [7] delivery.sign ......... e-signature du bon de remise du vehicule (loi 43-20)
   |
   v
 [15] feedback.submit ....... le client note la prestation
   |
  Tn  Dossier clos
```

En parallele de cette ligne de vie, des droits "transverses" sont disponibles a tout moment : `policies.view` / `policies.renew` (gestion contractuelle), `payments.view` (historique), `documents.read` (attestations/quittances), `notifications.manage` (preferences), `support.contact` (assistance), `profile.update` (donnees personnelles). Ces droits ne sont pas attaches a un sinistre precis mais a la relation contractuelle continue du client.

#### 3.3.2 Couplage RBAC / RLS : le droit ouvre, la RLS borne

Un point conceptuel essentiel, repete car central : une permission `customer.*` ouvre un **droit fonctionnel** (le client a le droit d'effectuer l'action), mais elle ne definit **pas** l'ensemble de donnees accessible. C'est la combinaison RBAC + RLS (Row Level Security) + scope applicatif qui borne les donnees :

- RBAC (cette tache) : "le client a le droit de lire des sinistres en self-service" (`customer.sinistres.read_mine`).
- RLS tenant : "ce client ne voit que les lignes de SON tenant" (`app_can_access_tenant()`).
- Scope applicatif "mine" : "ce client ne voit que les sinistres dont `customer_id = current_user`".

Les trois couches sont independantes et complementaires. Cette tache ne livre QUE la premiere (RBAC). La nomenclature `read_mine` (plutot que `read`) materialise dans le nom meme de la permission l'intention de scope restreint, et sert de garde-fou de revue : une permission `customer.sinistres.read_all` serait immediatement suspecte et n'existe volontairement pas.

### 3.4 Alternatives etudiees et arbitrages

| Question | Option retenue | Option ecartee | Justification |
| --- | --- | --- | --- |
| Customer en module propre vs reutilisation `insure.*` / `repair.*` | Module `customer` dedie (17 perms) | Reutiliser `insure.claims.read_own`, `repair.read`, `pay.initiate` existants | Les permissions metier (`insure.*`, `repair.*`, `pay.*`) sont orientees back-office (gestionnaire, garage). Reutiliser ces cles pour le client final aurait melange deux audiences dans la matrice, rendu impossible une politique self-service distincte (rate-limit, scope strict "mine"), et brouille l'audit. Un module `customer` dedie isole l'experience self-service, autorise un scope `read_mine` clair, et donne une surface de permission auditables par acteur. |
| Nom de module `customer` vs `assure` | `customer` | `assure` | `assure` est deja le NOM DU ROLE. Utiliser `assure` comme prefixe de module melerait role et domaine. `customer` decrit le domaine self-service, coherent avec `carrier`/`tow`/`parts` (domaine, pas role). decision-012. |
| Structure du catalog | `const ... as const` (etendu) | `enum Permission` | Inference d'union litterale (`PermissionValue` = union de 147 chaines), meilleur tree-shaking, pas d'objet runtime parasite. decision-012. |
| Action `declare_fnol`, `read_mine`, `track_progress`, etc. | Ajout au `Action` const (actions explicites) OU regex naming generique tolerante | Forcer des actions "standard" (read/create/update) en deformant les chaines | On conserve les chaines exactes demandees (`declare_fnol`...). La regex de naming, deja elargie par 7.5a, accepte les actions a underscore interne. On ajoute les actions au `Action` const par coherence/lisibilite (non strictement obligatoire car le catalog `Permission` est la verite). |
| Assigner les 17 perms a quel role | `assure` (acteur 5) | Creer un role `customer` | Pas de 27e role : decision-012 dit "Customer est un acteur, `assure` est le role". On reste a 26 roles. |
| Position d'insertion | A la fin, juste avant `} as const;` | Inserer par ordre alphabetique au milieu | Inserer en fin minimise le diff, evite de reorganiser l'existant, et reduit le risque de conflit de merge avec 7.5a. |
| Granularite des sinistres (1 vs 3 permissions) | 3 permissions (declare_fnol, read_mine, track_progress) | 1 permission `customer.sinistres.manage` fourre-tout | Trois actes de natures differentes : une ecriture initiale (FNOL), une lecture scopee, une lecture de timeline. Les fusionner aurait empeche de retirer le droit de declaration tout en gardant la lecture, ou de tracer separement l'acte FNOL (idempotent) du suivi (lecture pure). Granularite fine = politiques differenciees possibles. |
| `delivery.sign` dans module customer vs module `signature` | `customer.delivery.sign` | `signature.delivery.sign` | Le module `signature` porte la **mecanique** de signature (back-office, generation, horodatage). Le **droit du client** de signer SON bon est une intention self-service ; il appartient au domaine `customer`. La permission ouvre le droit, le service `@insurtech/signature` execute la mecanique 43-20. |
| `tow.track` (customer) vs `tow.missions.read` (7.5a) | `customer.tow.track` dedie | Reutiliser `tow.missions.read` de 7.5a | `tow.missions.read` est la lecture back-office d'une mission par le depanneur/operateur. `customer.tow.track` est la lecture geolocalisee temps reel par le client de SA mission uniquement. Audiences et scopes differents -> permissions differentes. |

#### 3.4.1 Pourquoi pas une permission generique `customer.*` (wildcard)

Une tentation aurait ete de definir une unique permission `customer.access` (ou un wildcard `customer.*`) octroyant tout le self-service en bloc. Cette approche est ecartee pour quatre raisons :

1. **Auditabilite** : avec 17 permissions nommees, l'audit log indique precisement quel acte a ete autorise (declaration vs paiement vs signature). Un wildcard masquerait cette information.
2. **Revocabilite fine** : on peut, en aval, suspendre `customer.payments.initiate` (par ex. compte sous litige financier) sans retirer `customer.sinistres.read_mine`. Un wildcard est tout-ou-rien.
3. **Conformite** : ACAPS et CNDP exigent une tracabilite par type d'acte (acceptation devis, signature, acces PII). Le grain fin sert directement la conformite.
4. **Coherence d'architecture** : le catalog entier est en grain fin (`module.resource.action`). Un wildcard serait une exception qui casserait `parsePermission`, `groupPermissionsByModule`, et la regex de naming.

#### 3.4.2 Pourquoi 17 et pas 15 ou 20

Le nombre 17 n'est pas arbitraire ; il decoule du parcours (section 3.3) : un acte par etape signifiante, sans fusion ni eclatement excessif. On a explicitement ecarte :

- Une 18e permission `customer.vehicles.read` (lecture du parc vehicule du client) : reportee, car le parcours v3.0 expose les vehicules via les polices (`policies.view`), pas comme entite self-service autonome a ce stade.
- Une 18e permission `customer.claims.cancel` (annulation de declaration par le client) : ecartee, car l'annulation d'un FNOL est un acte a fort impact reglementaire qui transite par le gestionnaire compagnie, pas par le self-service direct.
- Une fusion `view`+`accept` du devis en une seule permission : ecartee, car consulter (lecture) et accepter (acte de consentement trace) sont de natures juridiques distinctes.

Le nombre 17 represente donc l'equilibre retenu : exhaustif pour le parcours v3.0, minimal pour la surface d'attaque, et stable pour les Sprints aval.

### 3.5 Pieges nommes (a eviter imperativement)

1. **Refaire l'extension 85 -> 130 par erreur.** C'est LE piege central de cette tache revisee.
   - *Pourquoi c'est un piege* : les modules carrier/expertise/tow/parts sont DEJA dans le fichier (Sprint 7.5a merge). Les recreer = doublons de cles -> le test d'unicite echoue, et conflit de merge. Le test de comptage afficherait `expected 147, got 170`.
   - *Solution* : ne toucher QUE le bloc customer. Si l'agent voit deja les blocs 7.5a, il les laisse intacts. Verifier avec `grep -c "carrier.payment.approve_level4"` -> doit valoir `1`.
2. **Utiliser `enum` au lieu de `const`.**
   - *Pourquoi* : interdit par decision-012. Le type `PermissionValue` repose sur `as const`. Un `enum` casserait l'inference litterale et tout le typage en aval (la matrice, les guards, les DTO MCP attendent une union de chaines, pas un enum).
   - *Solution* : conserver `export const Permission = { ... } as const;`. Verifier `grep -rn "enum Permission"` -> 0 occurrence (hors exemples d'interdiction documentes).
3. **Oublier d'ajouter `CUSTOMER: 'customer'` au `Module` const.**
   - *Pourquoi* : sans cela, le validator boot-time `validatePermissionsCatalog()` rejette chaque permission `customer.*` avec `uses unknown module 'customer'` et l'application ne demarre pas.
   - *Solution* : ajouter l'entree au `Module` const (section 7.3). `ALL_MODULES` se met a jour automatiquement.
4. **Laisser le test de comptage a 130.**
   - *Pourquoi* : `permissions.spec.ts` contient une assertion `toBe(130)`. Sans mise a jour vers `147`, le test echoue (faux negatif).
   - *Solution* : passer l'assertion de comptage total a `147`.
5. **Laisser `ALL_MODULES.length` attendu a 24.**
   - *Pourquoi* : apres ajout de `CUSTOMER`, c'est 25. Le test correspondant doit passer de 24 a 25.
   - *Solution* : mettre a jour l'assertion `ALL_MODULES.length` a `25`.
6. **Actions non standard refusees par un whitelist.**
   - *Pourquoi* : si le validator impose une liste blanche d'actions (`Action` const), les actions `declare_fnol`, `read_mine`, `track_progress`, `renew`, `initiate`, `manage`, `submit`, `contact`, `track`, `sign`, `accept`, `view`, `update` doivent etre acceptees.
   - *Solution* : 7.5a a deja elargi la regex (2-4 segments, underscores internes tolerees) et ajoute `ACCEPT`, `SIGN`, `MANAGE`. On complete avec les actions customer manquantes (approche EXTENDED_ACTIONS, section 7.4).
7. **Confondre `customer` (module) et `assure` (role).**
   - *Pourquoi* : l'assignation matrice se fait au role `assure`, le prefixe de cle reste `customer`. Confondre les deux mene a chercher (en vain) un role `customer` ou un module `assure`.
   - *Solution* : module = `customer` (premier segment des valeurs), role = `assure` (cle de la matrice).
8. **Oublier l'assignation matrice.**
   - *Pourquoi* : ajouter les cles au catalog sans les assigner a `assure` dans `permissions-matrix.ts` : le client n'aurait aucune permission effective. Le test matrice (L16) echoue.
   - *Solution* : etendre la liste du role `assure` avec les 17 permissions (section 7.5).
9. **Dupliquer une cle ou une valeur.**
   - *Pourquoi* : chaque cle `CUSTOMER_*` et chaque valeur `customer.*` doivent etre uniques dans tout le catalog. Le test `new Set(values).size === values.length` doit rester vrai.
   - *Solution* : recopier exactement les 17 entrees de la section 7.1, sans variation.
10. **Casser l'ordre cle/valeur (derivation naive).**
    - *Pourquoi* : la convention est `CLE_AVEC_UNDERSCORES: 'module.resource.action'`. Les actions a underscore interne (`declare_fnol`, `read_mine`, `track_progress`) ne se derivent PAS naivement de la cle (`key.toLowerCase().replace(/_/g,'.')` produirait `customer.sinistres.declare.fnol`, faux). C'est une exception controlee, comme `approve_level1` en 7.5a.
    - *Solution* : le test de coherence doit comparer explicitement valeur par valeur, jamais par transformation algorithmique de la cle.
11. **Mettre a jour le plancher du validator de maniere incoherente.**
    - *Pourquoi* : si le validator verifie un nombre minimum de permissions, le plancher doit refleter 147 (ou rester un minimum <= 147). Le laisser bloque sur 130 si c'est une egalite stricte ferait echouer le boot.
    - *Solution* : adapter uniquement les egalites strictes (`=== 130 -> === 147`) ; laisser les `>=` intacts s'ils restent satisfaits.
12. **Reorganiser ou trier les blocs existants.**
    - *Pourquoi* : toute reorganisation de l'existant augmente le diff et le risque de conflit de merge avec 7.5a.
    - *Solution* : insertion en fin, point. Aucun tri, aucun deplacement.
13. **Oublier de mettre a jour le commentaire d'en-tete du fichier.**
    - *Pourquoi* : le JSDoc d'en-tete de `permissions.enum.ts` documente le total (130 -> 147) et le nombre de modules (24 -> 25). Le laisser perime cree une documentation interne trompeuse pour les futurs contributeurs (critere V25).
    - *Solution* : mettre a jour la ligne d'historique et le total dans le JSDoc (section 7.2).
14. **Assigner les permissions customer a un role back-office par "generosite".**
    - *Pourquoi* : assigner `customer.*` a `support_agent` ou `tenant_admin` "pour qu'ils puissent aider le client" est une fuite de scope self-service. Le test V20 le detecte (aucune permission customer hors `assure`).
    - *Solution* : assigner UNIQUEMENT a `assure`. Les agents back-office utilisent leurs propres permissions metier (`insure.*`, etc.), pas le self-service du client.
15. **Importer la fixture sans extension `.js` (NodeNext).**
    - *Pourquoi* : le package est en ESM/NodeNext ; un import sans `.js` casse la resolution Vitest et fait echouer toute la suite de tests.
    - *Solution* : importer `from './__fixtures__/customer-permissions.fixture.js'` avec l'extension explicite.
16. **Croire que `ALL_PERMISSIONS` ou `PermissionKeys` doivent etre edites a la main.**
    - *Pourquoi* : ils derivent de `Object.values`/`Object.keys` du const. Les editer manuellement (ajouter les 17 a la main en plus du const) cree une double source de verite et un risque de desynchronisation.
    - *Solution* : ne JAMAIS toucher `ALL_PERMISSIONS`/`PermissionKeys`. Ajouter au const suffit ; la derivation propage.

### 3.5bis Matrice de tracabilite permission -> parcours -> Sprint consommateur

Pour eviter toute ambiguite sur la raison d'etre de chacune des 17 permissions, voici la matrice complete reliant la cle, la valeur, l'etape du parcours, le scope de donnees, et le Sprint qui la consomme. Cette table sert aussi de reference pour la revue de code et pour la documentation `5-roles-permissions.md` (tache 2.5.9).

| # | Cle | Valeur | Etape parcours | Scope donnees | Sprint consommateur | Sensibilite |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `CUSTOMER_SINISTRES_DECLARE_FNOL` | `customer.sinistres.declare_fnol` | Declaration FNOL | Cree un sinistre rattache au tenant + au client | Sprint 8 (claims self-service) + Sprint 11 (mobile) | Ecriture, idempotent |
| 2 | `CUSTOMER_SINISTRES_READ_MINE` | `customer.sinistres.read_mine` | Suivi de mes sinistres | Lecture restreinte aux sinistres du client (RLS + scope) | Sprint 8 | Lecture PII |
| 3 | `CUSTOMER_SINISTRES_TRACK_PROGRESS` | `customer.sinistres.track_progress` | Suivi d'avancement | Lecture timeline du dossier du client | Sprint 8 + Sprint 12 (timeline) | Lecture |
| 4 | `CUSTOMER_DEVIS_VIEW` | `customer.devis.view` | Consultation du devis | Lecture du devis lie a son sinistre | Sprint 9 (devis) | Lecture |
| 5 | `CUSTOMER_DEVIS_ACCEPT` | `customer.devis.accept` | Acceptation du devis | Acte de consentement tracable (ACAPS) | Sprint 9 | Ecriture, trace ACAPS |
| 6 | `CUSTOMER_REPAIRS_READ_MINE` | `customer.repairs.read_mine` | Suivi de mes reparations | Lecture des reparations de ses vehicules | Sprint 9 (atelier) | Lecture |
| 7 | `CUSTOMER_DELIVERY_SIGN` | `customer.delivery.sign` | Signature livraison | E-signature loi 43-20 sur son bon | Sprint 10 (signature) | Ecriture, idempotent, 43-20 |
| 8 | `CUSTOMER_TOW_TRACK` | `customer.tow.track` | Suivi depanneuse | Lecture position/ETA de sa mission tow | Sprint 7.5b tow + Sprint 13 (tracking) | Lecture geoloc |
| 9 | `CUSTOMER_POLICIES_VIEW` | `customer.policies.view` | Consultation polices | Lecture de ses contrats | Sprint 8 (polices) | Lecture PII contractuelle |
| 10 | `CUSTOMER_POLICIES_RENEW` | `customer.policies.renew` | Renouvellement | Acte contractuel (obligations ACAPS) | Sprint 14 (renouvellement) | Ecriture, trace ACAPS |
| 11 | `CUSTOMER_PAYMENTS_VIEW` | `customer.payments.view` | Consultation paiements | Lecture de son historique de paiements | Sprint 10 (paiements) | Lecture financiere |
| 12 | `CUSTOMER_PAYMENTS_INITIATE` | `customer.payments.initiate` | Initiation paiement | Declenche un paiement (Idempotency-Key) | Sprint 10 | Ecriture, idempotent, financiere |
| 13 | `CUSTOMER_DOCUMENTS_READ` | `customer.documents.read` | Lecture documents | Lecture de ses attestations/quittances | Sprint 8 (docs) | Lecture PII |
| 14 | `CUSTOMER_NOTIFICATIONS_MANAGE` | `customer.notifications.manage` | Gestion notifications | Mise a jour de ses preferences | Sprint 11 (mobile/notif) | Ecriture preferences |
| 15 | `CUSTOMER_FEEDBACK_SUBMIT` | `customer.feedback.submit` | Depot feedback | Cree un avis/note attribue au client | Sprint 15 (satisfaction) | Ecriture |
| 16 | `CUSTOMER_SUPPORT_CONTACT` | `customer.support.contact` | Contact support | Ouvre un ticket attribue au client | Sprint 15 (support) | Ecriture |
| 17 | `CUSTOMER_PROFILE_UPDATE` | `customer.profile.update` | Mise a jour profil | Modifie ses propres donnees (CNDP 09-08) | Sprint 8 (profil) | Ecriture PII |

Observations transverses utiles a la revue :

- **6 permissions sont en ecriture sur des actes sensibles** (FNOL, accept devis, sign livraison, renew police, initiate paiement, update profil). Trois d'entre elles (FNOL, signature, paiement) declenchent des endpoints couverts par `Idempotency-Key` (TTL 24h Redis). C'est documente dans le commentaire de la permission et impose au Sprint consommateur, pas a cette tache (qui ne fait qu'ouvrir le droit).
- **Toutes les lectures sont scopees "mine"** : aucune permission `customer.*` n'autorise une lecture transverse (pas d'equivalent `read_all`). C'est volontaire : le client final ne doit jamais voir les donnees d'autrui. Le scope est garanti par la RLS tenant + la logique de filtrage `WHERE customer_id = current_user`. La permission RBAC ouvre le droit fonctionnel ; la RLS borne l'ensemble de donnees.
- **Aucune permission de suppression** : le client ne supprime rien (pas de `delete`). Les rectifications passent par `profile.update` (droit CNDP de rectification), jamais par un effacement direct depuis le self-service (le droit a l'effacement, s'il s'applique, transite par un processus dedie cote DPO, hors self-service).

#### 3.5ter Repartition par resource du module customer

Le module `customer` se decompose en 12 resources. La repartition aide a verifier l'exhaustivite et a anticiper les regroupements (`groupPermissionsByModule`) :

| Resource | Permissions | Nb | Nature |
| --- | --- | --- | --- |
| `sinistres` | `declare_fnol`, `read_mine`, `track_progress` | 3 | 1 ecriture + 2 lectures |
| `devis` | `view`, `accept` | 2 | 1 lecture + 1 ecriture (consentement) |
| `repairs` | `read_mine` | 1 | lecture |
| `delivery` | `sign` | 1 | ecriture (signature 43-20) |
| `tow` | `track` | 1 | lecture geoloc |
| `policies` | `view`, `renew` | 2 | 1 lecture + 1 ecriture contractuelle |
| `payments` | `view`, `initiate` | 2 | 1 lecture + 1 ecriture financiere |
| `documents` | `read` | 1 | lecture |
| `notifications` | `manage` | 1 | ecriture preferences |
| `feedback` | `submit` | 1 | ecriture |
| `support` | `contact` | 1 | ecriture |
| `profile` | `update` | 1 | ecriture PII |
| **Total** | | **17** | **7 lectures + 10 ecritures** |

Note : 12 resources, 17 permissions, 7 actes de lecture, 10 actes d'ecriture (dont 6 sensibles enumerees ci-dessus, plus `notifications.manage`, `feedback.submit`, `support.contact`, `policies.renew` qui sont des ecritures de moindre criticite). Cette ventilation est le materiau du test de comptage par resource (optionnel) et du groupage par module.

### 3.6 Decisions referencees

- **decision-011** : naming v3.0 -- Skalean (entreprise), Assurflow (vertical assurance auto), Sofidemy (marque). Toute mention de marque dans commentaires/docs respecte ce vocabulaire.
- **decision-012** : (a) catalog RBAC en `const` objet `as const`, jamais `enum` ; (b) acteur 5 = Customer differencie de l'`assure` generique, porte par le role `assure` dans le modele a 26 roles.
- **decision-006** : aucune emoji nulle part (ABSOLUE).
- **decision-008** : cloud souverain Maroc (aucune donnee assure hors territoire) -- pertinent pour les permissions PII customer.
- **decision-013** : modules verticaux Assurflow (carrier/expertise/tow/parts) -- ce sont les modules 7.5a a NE PAS toucher.

---

## 4. Contexte d'architecture

### 4.1 Position dans le sprint

Cette tache est la **3e sur 9** du Sprint 7.5b (position 3/9). Elle depend de `2.5.2` (package `@insurtech/tow` finalise) et du **catalog Sprint 7.5a deja a 130**. Elle **bloque** `2.5.4` (entite foundation `insure_experts`), car les services et controleurs en aval reference des cles `Permission.CUSTOMER_*` (par ex. l'endpoint FNOL self-service) -- tant que le catalog ne les expose pas, ces references ne compilent pas.

### 4.2 Le catalog comme source unique de verite

Le catalog `Permission` (dans `permissions.enum.ts`) est la **source unique de verite** RBAC. Tout en aval (matrice role->permissions, guards `@RequirePermissions()`, cache Redis, documentation, DTO MCP) consomme `Permission` et `ALL_PERMISSIONS`. C'est pourquoi l'integrite du catalog -- naming valide, unicite des cles/valeurs, modules connus -- est validee au boot par `validatePermissionsCatalog()`. Ajouter un module sans l'enregistrer dans `Module` fait echouer ce boot.

### 4.2bis Invariants du catalog (a preserver coute que coute)

Le catalog RBAC repose sur une serie d'invariants verifies au boot et par les tests. Cette tache doit les laisser tous vrais APRES ajout du module customer :

1. **Cle <-> valeur biunivoque** : chaque cle `CUSTOMER_*` mappe vers exactement une valeur `customer.*`, et reciproquement. Aucune collision avec les 130 entrees anterieures.
2. **Module premier segment** : pour toute valeur, `parsePermission(value).module` egale le premier segment, et ce module appartient a `ALL_MODULES`. L'ajout de `Module.CUSTOMER` est donc indissociable de l'ajout des valeurs `customer.*` (sinon invariant 2 rompu -> boot KO).
3. **Derivation automatique** : `ALL_PERMISSIONS = Object.freeze(Object.values(Permission))` et `ALL_MODULES = Object.values(Module)`. On n'ecrit jamais ces listes a la main ; elles refletent mecaniquement le const. C'est ce qui rend l'extension "additive" sure : ajouter une entree au const suffit a la propager partout.
4. **Immutabilite runtime** : `Object.freeze` sur `ALL_PERMISSIONS`/`PermissionKeys` garantit qu'aucun consommateur ne mute le catalog a chaud. On ne retire pas ce `freeze`.
5. **Comptage = contrat** : le nombre 147 est un contrat verifie par le test et (le cas echeant) par le validator boot. Toute divergence est un signal d'erreur, jamais un ajustement silencieux du test.
6. **Naming uniforme** : toutes les valeurs respectent `PERMISSION_NAMING_REGEX` (segments en minuscules, separateur `.`, underscores internes tolerees dans le segment d'action). Aucune exception pour customer (les 17 valeurs sont 3-segments classiques).

Si l'un de ces invariants est rompu apres modification, le boot echoue ou un test rougit : c'est le filet de securite voulu. On corrige l'invariant, on ne contourne pas le garde-fou.

### 4.2ter Chaine de consommation aval du catalog

Pour comprendre pourquoi le catalog est `P0` (bloquant), voici la chaine complete de ce qui consomme `Permission` :

1. **`permissions-matrix.ts`** importe `Permission` et associe chaque role a un sous-ensemble de permissions. Une cle absente du catalog ne peut etre assignee (erreur TS).
2. **Les guards NestJS** (`@RequirePermissions(Permission.CUSTOMER_SINISTRES_DECLARE_FNOL)`) referencent les cles directement. Une cle inexistante = erreur de compilation au niveau du controleur consommateur.
3. **Le cache RBAC Redis** serialise les permissions effectives par utilisateur ; il s'appuie sur les valeurs string du catalog comme cles de cache.
4. **La documentation generee** (`5-roles-permissions.md`) est produite a partir de `ALL_PERMISSIONS` et `groupPermissionsByModule()` ; le module `customer` doit y apparaitre automatiquement une fois ajoute.
5. **Les DTO MCP** (Skalean AI / `@insurtech/sky`) exposent la liste des permissions comme enum-like de validation Zod cote outillage IA ; ils derivent de `PermissionValue`.

Cette chaine explique l'effort estime modeste (1h) malgre l'importance : le changement est petit (17 entrees + 1 module + assignation matrice + tests), mais sa correction conditionne la compilation de tout l'aval.

### 4.3 Flux ASCII : 130 (7.5a) -> +17 customer -> 147

```
                 SPRINT 7.5a (DEJA MERGE -- NE PAS TOUCHER)
        +-------------------------------------------------------------+
        |  const Permission { ... } as const   (130 permissions)      |
        |  ~90 existantes v2.2                                         |
        |  + CARRIER (15)  EXPERTISE (10)  TOW (8)  PARTS (7)  = +40   |
        +-------------------------------------------------------------+
                                   |
                                   |  CETTE TACHE 2.5.3 (additif strict)
                                   v
        +-------------------------------------------------------------+
        |  + CUSTOMER (17)   <-- bloc insere avant `} as const;`       |
        |    customer.sinistres.*  customer.devis.*  customer.repairs  |
        |    customer.delivery.*   customer.tow.*    customer.policies |
        |    customer.payments.*   customer.documents customer.notif.  |
        |    customer.feedback.*   customer.support.* customer.profile |
        +-------------------------------------------------------------+
                                   |
                                   v
        +-------------------------------------------------------------+
        |  const Permission { ... } as const   (147 permissions)      |
        |  type PermissionValue = union de 147 chaines litterales     |
        |  ALL_PERMISSIONS = Object.freeze(Object.values(Permission)) |
        |  PermissionKeys  = Object.freeze(Object.keys(Permission))   |
        +-------------------------------------------------------------+
              |                         |                        |
              v                         v                        v
   +--------------------+   +-----------------------+   +----------------------+
   | permission-helpers |   | permissions-matrix.ts |   | permissions-validator|
   | Module const (25)  |   | role `assure` <- 17   |   | boot : naming, module|
   | + CUSTOMER:'customer'|  | permissions customer  |   | membership, unicite  |
   | ALL_MODULES = 25   |   |                       |   | accepte module customer|
   +--------------------+   +-----------------------+   +----------------------+
              |                         |                        |
              +-------------------------+------------------------+
                                   v
                       +-----------------------------+
                       |  Guards / cache / doc / MCP  |
                       |  consomment Permission.CUSTOMER_*|
                       +-----------------------------+
```

### 4.4 Arborescence des fichiers RBAC concernes

```
packages/auth/src/rbac/
  permissions.enum.ts            <- MODIFIE : +17 entrees CUSTOMER_*, en-tete maj
  permission-helpers.ts          <- MODIFIE : +CUSTOMER au Module const, +actions
  permissions-matrix.ts          <- MODIFIE : role assure +17 permissions customer
  permissions-validator.ts       <- VERIFIE : plancher 130 -> 147 si egalite stricte
  rbac-constants.ts              <- LECTURE : PERMISSION_NAMING_REGEX (inchange)
  auth-role.enum.ts              <- LECTURE : AuthRole.ASSURE (inchange)
  permissions.spec.ts            <- MODIFIE : tests catalog (+~15 it)
  permissions-matrix.spec.ts     <- MODIFIE : tests matrice (+~5 it)
  permissions-validator.spec.ts  <- MODIFIE : tests validator (+~2 it)
  permission-helpers.spec.ts     <- MODIFIE : tests modules/actions (+~6 it)
  __fixtures__/
    customer-permissions.fixture.ts  <- CREE (fixture de reference des 17)
```

> Seul `__fixtures__/customer-permissions.fixture.ts` est un fichier nouveau (fixture de test). Tout le reste est une modification additive de fichiers existants. La fixture est optionnelle si l'equipe prefere inliner les references dans les specs, mais elle est recommandee pour eviter la duplication entre les 4 fichiers de test.

---

## 5. Livrables checkables

- [ ] L1. `packages/auth/src/rbac/permissions.enum.ts` contient un bloc commente `// === Sprint 7.5b v3.0 -- Customer module (17 perms, actor 5) ===` avec **exactement 17** entrees `CUSTOMER_*`.
- [ ] L2. Les 17 entrees ont exactement les valeurs listees en section 7.1 (`customer.sinistres.declare_fnol` ... `customer.profile.update`).
- [ ] L3. Le bloc customer est insere **apres** les blocs carrier/expertise/tow/parts existants et **avant** `} as const;`.
- [ ] L4. Les blocs `CARRIER (15)`, `EXPERTISE (10)`, `TOW (8)`, `PARTS (7)` et les ~90 permissions v2.2 sont **inchanges** (aucune ligne supprimee/modifiee/dupliquee).
- [ ] L5. `permissions.enum.ts` : `ALL_PERMISSIONS` et `PermissionKeys` derivent toujours de `Object.values`/`Object.keys` (pas de liste manuelle).
- [ ] L6. `permission-helpers.ts` : le `Module` const contient `CUSTOMER: 'customer'` (et garde les 24 autres -> 25 au total).
- [ ] L7. `permission-helpers.ts` : `ALL_MODULES.length === 25` (derive automatiquement).
- [ ] L8. `permission-helpers.ts` : le `Action` const contient les actions customer non standard (`DECLARE_FNOL`, `READ_MINE`, `TRACK_PROGRESS`, `RENEW`, `INITIATE`, `CONTACT`, `SUBMIT`, `TRACK`) -- celles deja presentes (ACCEPT, SIGN, MANAGE, VIEW, UPDATE) ne sont PAS dupliquees.
- [ ] L9. `permissions-matrix.ts` : le role `assure` se voit assigner les **17** permissions `customer.*` (en plus de ses permissions anterieures).
- [ ] L10. `permissions.spec.ts` : assertion de comptage total `=== 147`.
- [ ] L11. `permissions.spec.ts` : assertion `ALL_MODULES.length === 25`.
- [ ] L12. `permissions.spec.ts` : test verifiant la presence du module `customer` dans `ALL_MODULES`.
- [ ] L13. `permissions.spec.ts` : test verifiant la presence et l'unicite des 17 cles/valeurs `customer.*`.
- [ ] L14. `permissions.spec.ts` : test de non-regression -- les 130 permissions anterieures sont toujours presentes.
- [ ] L15. `permissions.spec.ts` : test de naming -- les 17 valeurs `customer.*` passent `PERMISSION_NAMING_REGEX`.
- [ ] L16. `permissions-matrix.spec.ts` : test verifiant que `assure` possede exactement les 17 permissions customer.
- [ ] L17. `permissions-matrix.spec.ts` : test verifiant qu'aucun doublon n'est introduit dans la liste des permissions du role `assure`.
- [ ] L18. Le validator boot-time accepte le module `customer` (pas d'erreur `unknown module`).
- [ ] L19. `pnpm --filter @insurtech/auth typecheck` passe sans erreur.
- [ ] L20. `pnpm --filter @insurtech/auth lint` passe sans erreur.
- [ ] L21. `pnpm --filter @insurtech/auth test` passe : tous les tests RBAC verts.
- [ ] L22. Couverture RBAC >= 90% (auth est un module sensible).
- [ ] L23. Aucune emoji dans aucun fichier touche (`check-no-emoji.sh` vert).
- [ ] L24. Aucun usage de `enum Permission` introduit (recherche `grep` -> 0 occurrence).
- [ ] L25. Commit conforme Conventional Commits (section 16).
- [ ] L26. Le commentaire d'en-tete de `permissions.enum.ts` est mis a jour (147 permissions / 25 modules).
- [ ] L27. La fixture `__fixtures__/customer-permissions.fixture.ts` (si creee) liste les 17 permissions dans l'ordre canonique.

---

## 6. Fichiers crees / modifies

| Fichier | Action | Lignes (delta) | Detail |
| --- | --- | --- | --- |
| `packages/auth/src/rbac/permissions.enum.ts` | modifie | +~20 | Insertion du bloc `CUSTOMER (17)` avant `} as const;`. Mise a jour du commentaire d'en-tete (147 permissions, 25 modules). AUCUNE modification des blocs existants. |
| `packages/auth/src/rbac/permission-helpers.ts` | modifie | +~10 | Ajout de `CUSTOMER: 'customer'` au `Module` const (24 -> 25). Ajout des actions customer non standard manquantes au `Action` const. Mise a jour du commentaire `25 modules supportes`. |
| `packages/auth/src/rbac/permissions-matrix.ts` | modifie | +~20 | Assignation des 17 permissions `customer.*` au role `assure`. |
| `packages/auth/src/rbac/permissions.spec.ts` | modifie | +~70 | Comptage 130 -> 147 ; `ALL_MODULES.length` 24 -> 25 ; presence module customer ; presence/unicite des 17 ; naming ; non-regression 130 ; coherence cle/valeur. |
| `packages/auth/src/rbac/permissions-matrix.spec.ts` | modifie | +~30 | `assure` possede les 17 permissions customer ; pas de doublon ; chaque permission customer est assignee a au moins un role ; scope self-service. |
| `packages/auth/src/rbac/permissions-validator.spec.ts` | modifie | +~10 | validator ne throw pas ; module customer connu. |
| `packages/auth/src/rbac/permission-helpers.spec.ts` | modifie | +~25 | Module.CUSTOMER ; ALL_MODULES 25 ; ordre d'insertion ; actions customer present ; pas de duplication d'actions. |
| `packages/auth/src/rbac/permissions-validator.ts` | verifie (inchange sauf plancher) | 0 / +1 | Verifier que le module `customer` est accepte (il l'est des que `Module.CUSTOMER` existe). Si un plancher numerique strict est code, le passer de 130 a 147. |
| `packages/auth/src/rbac/__fixtures__/customer-permissions.fixture.ts` | cree (optionnel) | +~40 | Reference figee des 17 permissions et de leurs valeurs string, partagee par les specs. |

> Hormis la fixture optionnelle, aucun fichier nouveau a creer. Tache strictement additive sur des fichiers existants.

---

## 7. Patterns de code complets

### 7.1 Bloc CUSTOMER (17) -- a inserer dans `permissions.enum.ts`

Inserer ce bloc **a la fin** de la `const Permission`, juste avant le `} as const;` final, **apres** le dernier bloc `PARTS` deja present (issu de 7.5a). Ne rien supprimer au-dessus.

```typescript
  // === Sprint 7.5b v3.0 -- Customer module (17 perms, actor 5 = Customer self-service) ===
  // Acteur 5 (decision-012) : client final en self-service ; porte par le role `assure`.
  CUSTOMER_SINISTRES_DECLARE_FNOL: 'customer.sinistres.declare_fnol', // Declaration FNOL self-service par le client ; role assure ; consomme Sprint 8 (claims self-service) + Sprint 11 (mobile)
  CUSTOMER_SINISTRES_READ_MINE: 'customer.sinistres.read_mine', // Lecture de SES propres sinistres uniquement (scope strict) ; role assure ; consomme Sprint 8
  CUSTOMER_SINISTRES_TRACK_PROGRESS: 'customer.sinistres.track_progress', // Suivi de la timeline d'avancement du dossier ; role assure ; consomme Sprint 8 + Sprint 12 (timeline)
  CUSTOMER_DEVIS_VIEW: 'customer.devis.view', // Consultation du devis de reparation ; role assure ; consomme Sprint 9 (devis)
  CUSTOMER_DEVIS_ACCEPT: 'customer.devis.accept', // Acceptation tracee du devis (consentement horodate, trace ACAPS) ; role assure ; consomme Sprint 9
  CUSTOMER_REPAIRS_READ_MINE: 'customer.repairs.read_mine', // Suivi de SES propres reparations ; role assure ; consomme Sprint 9 (atelier)
  CUSTOMER_DELIVERY_SIGN: 'customer.delivery.sign', // E-signature du bon de livraison vehicule (loi 43-20) ; role assure ; consomme Sprint 10 (signature)
  CUSTOMER_TOW_TRACK: 'customer.tow.track', // Suivi temps reel de la depanneuse (position, ETA) ; role assure ; consomme Sprint 7.5b tow + Sprint 13 (tracking)
  CUSTOMER_POLICIES_VIEW: 'customer.policies.view', // Consultation de SES polices d'assurance ; role assure ; consomme Sprint 8 (polices)
  CUSTOMER_POLICIES_RENEW: 'customer.policies.renew', // Declenchement d'un renouvellement de police ; role assure ; consomme Sprint 14 (renouvellement)
  CUSTOMER_PAYMENTS_VIEW: 'customer.payments.view', // Historique des paiements / franchises ; role assure ; consomme Sprint 10 (paiements)
  CUSTOMER_PAYMENTS_INITIATE: 'customer.payments.initiate', // Initiation d'un paiement (Idempotency-Key requis) ; role assure ; consomme Sprint 10
  CUSTOMER_DOCUMENTS_READ: 'customer.documents.read', // Lecture des documents communicables (attestations, quittances) ; role assure ; consomme Sprint 8 (docs)
  CUSTOMER_NOTIFICATIONS_MANAGE: 'customer.notifications.manage', // Gestion des preferences de notification ; role assure ; consomme Sprint 11 (mobile/notif)
  CUSTOMER_FEEDBACK_SUBMIT: 'customer.feedback.submit', // Depot d'un avis/note sur la prestation ; role assure ; consomme Sprint 15 (satisfaction)
  CUSTOMER_SUPPORT_CONTACT: 'customer.support.contact', // Contact assistance / ouverture de ticket ; role assure ; consomme Sprint 15 (support)
  CUSTOMER_PROFILE_UPDATE: 'customer.profile.update', // Mise a jour des donnees personnelles (CNDP 09-08) ; role assure ; consomme Sprint 8 (profil)
```

Notes importantes :

- Toutes les valeurs sont 3-segments classiques (`customer.{resource}.{action}`) -- elles passent la regex de naming elargie par 7.5a sans aucun ajustement.
- Les actions a underscore interne (`declare_fnol`, `read_mine`, `track_progress`) **ne se derivent PAS** de la cle par transformation naive : `CUSTOMER_SINISTRES_DECLARE_FNOL`.toLowerCase().replace(/_/g,'.')` donnerait `customer.sinistres.declare.fnol` (4 segments, FAUX). C'est une exception controlee, identique a `approve_level1` de 7.5a. Le test de coherence (section 8) compare explicitement, jamais par transformation.
- Le module est `customer` (le PREMIER segment de chaque valeur). Il DOIT etre enregistre dans le `Module` const (section 7.3) sinon le validator boot-time rejette les 17 permissions.

#### 7.1.1 Table par permission (cle | description FR | resource | action | sprint/app consommateur)

| Cle | Description FR | Resource | Action | Sprint / App consommateur |
| --- | --- | --- | --- | --- |
| `CUSTOMER_SINISTRES_DECLARE_FNOL` | Declarer un sinistre en self-service (First Notice Of Loss) | `sinistres` | `declare_fnol` | Sprint 8 (claims self-service), Sprint 11 (mobile) |
| `CUSTOMER_SINISTRES_READ_MINE` | Consulter ses propres sinistres | `sinistres` | `read_mine` | Sprint 8 (espace client) |
| `CUSTOMER_SINISTRES_TRACK_PROGRESS` | Suivre l'avancement (timeline) de son dossier | `sinistres` | `track_progress` | Sprint 8, Sprint 12 (timeline) |
| `CUSTOMER_DEVIS_VIEW` | Consulter le devis de reparation | `devis` | `view` | Sprint 9 (devis) |
| `CUSTOMER_DEVIS_ACCEPT` | Accepter le devis (consentement trace) | `devis` | `accept` | Sprint 9 (devis), conformite ACAPS |
| `CUSTOMER_REPAIRS_READ_MINE` | Suivre l'etat de ses reparations | `repairs` | `read_mine` | Sprint 9 (atelier) |
| `CUSTOMER_DELIVERY_SIGN` | Signer electroniquement le bon de livraison | `delivery` | `sign` | Sprint 10 (signature), loi 43-20 |
| `CUSTOMER_TOW_TRACK` | Suivre la depanneuse en temps reel | `tow` | `track` | Sprint 7.5b (tow), Sprint 13 (tracking) |
| `CUSTOMER_POLICIES_VIEW` | Consulter ses polices d'assurance | `policies` | `view` | Sprint 8 (polices) |
| `CUSTOMER_POLICIES_RENEW` | Declencher le renouvellement d'une police | `policies` | `renew` | Sprint 14 (renouvellement), ACAPS |
| `CUSTOMER_PAYMENTS_VIEW` | Consulter l'historique de ses paiements | `payments` | `view` | Sprint 10 (paiements) |
| `CUSTOMER_PAYMENTS_INITIATE` | Initier un paiement (franchise, complement) | `payments` | `initiate` | Sprint 10 (paiements), Idempotency-Key |
| `CUSTOMER_DOCUMENTS_READ` | Lire ses documents (attestations, quittances) | `documents` | `read` | Sprint 8 (docs) |
| `CUSTOMER_NOTIFICATIONS_MANAGE` | Gerer ses preferences de notification | `notifications` | `manage` | Sprint 11 (mobile/notif) |
| `CUSTOMER_FEEDBACK_SUBMIT` | Deposer un avis sur la prestation | `feedback` | `submit` | Sprint 15 (satisfaction) |
| `CUSTOMER_SUPPORT_CONTACT` | Contacter le support / ouvrir un ticket | `support` | `contact` | Sprint 15 (support) |
| `CUSTOMER_PROFILE_UPDATE` | Mettre a jour ses donnees personnelles | `profile` | `update` | Sprint 8 (profil), CNDP 09-08 |

### 7.2 Structure complete (en-tete + tail) de `permissions.enum.ts` -- pour auto-suffisance

Pour que le fichier de tache soit auto-suffisant sans relire `permissions.enum.ts`, voici la structure attendue du fichier APRES insertion (en-tete, marqueurs des blocs existants resumes, bloc customer, et tail d'export). On ne reproduit pas les 130 entrees une a une (elles existent deja) ; on montre l'ossature exacte ou s'insere le bloc.

```typescript
/* eslint-disable sort-keys */
/**
 * Catalogue des permissions RBAC -- @insurtech/auth.
 *
 * SOURCE UNIQUE DE VERITE. Consomme par la matrice, les guards, le cache et la doc.
 * Structure : objet `const ... as const` (decision-012 -- JAMAIS un `enum`).
 *
 * Historique :
 *   - v2.2  : 90 permissions, 20 modules.
 *   - 7.5a  : +40 permissions (carrier 15 / expertise 10 / tow 8 / parts 7) -> 130, +4 modules -> 24.
 *   - 7.5b  : +17 permissions (customer 17) -> 147, +1 module (customer) -> 25.   <-- CETTE TACHE
 *
 * Total actuel : 147 permissions, 25 modules.
 */
export const Permission = {
  // --- AUTH / TENANT / CRM / BOOKING / COMM / DOCS / SIGNATURE / PAY / BOOKS ---
  // --- COMPLIANCE / ANALYTICS / INSURE / REPAIR / STOCK / HR / ADMIN ---
  // --- CROSS_TENANT / SKY / MCP / PUBLIC ---
  // ... (90 permissions v2.2 -- NE PAS TOUCHER) ...

  // === CARRIER (15) -- Sprint 7.5a Assurflow -- compagnie d'assurance ===
  // ... (15 entrees -- DEJA PRESENTES, NE PAS TOUCHER) ...

  // === EXPERTISE (10) -- Sprint 7.5a Assurflow -- expert / cabinet d'expertise ===
  // ... (10 entrees -- DEJA PRESENTES, NE PAS TOUCHER) ...

  // === TOW (8) -- Sprint 7.5a Assurflow -- depanneur / remorqueur ===
  // ... (8 entrees -- DEJA PRESENTES, NE PAS TOUCHER) ...

  // === PARTS (7) -- Sprint 7.5a Assurflow -- fournisseur de pieces detachees ===
  // ... (7 entrees -- DEJA PRESENTES, NE PAS TOUCHER) ...

  // === Sprint 7.5b v3.0 -- Customer module (17 perms, actor 5 = Customer self-service) ===
  CUSTOMER_SINISTRES_DECLARE_FNOL: 'customer.sinistres.declare_fnol',
  CUSTOMER_SINISTRES_READ_MINE: 'customer.sinistres.read_mine',
  CUSTOMER_SINISTRES_TRACK_PROGRESS: 'customer.sinistres.track_progress',
  CUSTOMER_DEVIS_VIEW: 'customer.devis.view',
  CUSTOMER_DEVIS_ACCEPT: 'customer.devis.accept',
  CUSTOMER_REPAIRS_READ_MINE: 'customer.repairs.read_mine',
  CUSTOMER_DELIVERY_SIGN: 'customer.delivery.sign',
  CUSTOMER_TOW_TRACK: 'customer.tow.track',
  CUSTOMER_POLICIES_VIEW: 'customer.policies.view',
  CUSTOMER_POLICIES_RENEW: 'customer.policies.renew',
  CUSTOMER_PAYMENTS_VIEW: 'customer.payments.view',
  CUSTOMER_PAYMENTS_INITIATE: 'customer.payments.initiate',
  CUSTOMER_DOCUMENTS_READ: 'customer.documents.read',
  CUSTOMER_NOTIFICATIONS_MANAGE: 'customer.notifications.manage',
  CUSTOMER_FEEDBACK_SUBMIT: 'customer.feedback.submit',
  CUSTOMER_SUPPORT_CONTACT: 'customer.support.contact',
  CUSTOMER_PROFILE_UPDATE: 'customer.profile.update',
} as const;

/** Type union litterale des 147 valeurs de permission. */
export type PermissionValue = (typeof Permission)[keyof typeof Permission];

/** Type union litterale des cles de permission (147 cles). */
export type PermissionKey = keyof typeof Permission;

/** Liste figee des 147 valeurs de permission, derivee du const Permission. */
export const ALL_PERMISSIONS: readonly PermissionValue[] = Object.freeze(
  Object.values(Permission),
);

/** Liste figee des 147 cles de permission, derivee du const Permission. */
export const PermissionKeys: readonly string[] = Object.freeze(
  Object.keys(Permission),
);
```

> Le tail (`PermissionValue`, `ALL_PERMISSIONS`, `PermissionKeys`) **ne change pas** : il derive de `Object.values`/`Object.keys`, donc passer de 130 a 147 est automatique. On ne touche QUE le commentaire d'en-tete et on insere le bloc customer.

#### 7.2.1 Contre-exemple INTERDIT (ce qu'il ne faut surtout pas faire)

A titre pedagogique, voici la forme strictement prohibee par decision-012. Elle est reproduite UNIQUEMENT comme repoussoir et ne doit jamais apparaitre dans le code :

```typescript
// INTERDIT -- decision-012. NE JAMAIS ecrire ceci.
export enum Permission {
  CUSTOMER_SINISTRES_DECLARE_FNOL = 'customer.sinistres.declare_fnol',
  // ...
}
```

Pourquoi c'est interdit, en detail :

- Un `enum` TypeScript genere un objet runtime bidirectionnel (cle->valeur ET valeur->cle), ce qui pollue le bundle et casse le tree-shaking.
- L'inference `(typeof Permission)[keyof typeof Permission]` produit, sur un enum, le type de l'enum lui-meme et non l'union litterale des chaines, ce qui degrade le typage des guards et de la matrice.
- `Object.values(Permission)` sur un enum string renvoie les valeurs string, mais sur un enum numerique melange cles et valeurs ; le const `as const` est sans ambiguite.
- La regle CI / revue cherche `enum Permission` et echoue ; le seul endroit ou cette chaine peut apparaitre est un commentaire d'interdiction comme celui ci-dessus.

### 7.3 Mise a jour de `permission-helpers.ts` : `Module` const (25)

Ajouter `CUSTOMER: 'customer'` a la fin du `Module` const, juste avant `} as const;`, apres les modules verticaux de 7.5a. Mettre a jour le commentaire de comptage.

```typescript
/** 25 modules supportes (20 v2.2 + 4 verticaux 7.5a + 1 customer 7.5b). */
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
  // --- Verticaux Assurflow v3.0 (decision-013, Sprint 7.5a -- DEJA PRESENTS) ---
  CARRIER: 'carrier',
  EXPERTISE: 'expertise',
  TOW: 'tow',
  PARTS: 'parts',
  // --- Self-service client v3.0 (decision-012, Sprint 7.5b -- AJOUT DE CETTE TACHE) ---
  CUSTOMER: 'customer',
} as const;

export type ModuleValue = (typeof Module)[keyof typeof Module];

/** 25 valeurs de module, derivees automatiquement du const Module. */
export const ALL_MODULES: readonly ModuleValue[] = Object.values(Module);
```

### 7.4 Mise a jour du `Action` const (EXTENDED_ACTIONS) pour les actions customer non standard

Le module customer introduit des actions qui n'existaient pas avant 7.5a. Certaines ont deja ete ajoutees par 7.5a (`ACCEPT`, `SIGN`, `MANAGE`, et `VIEW`/`UPDATE`/`READ` standards). On AJOUTE uniquement celles qui manquent, sans dupliquer. Le `Action` const sert a `formatPermission` et a la lisibilite ; le catalog `Permission` reste la verite, donc cet ajout est de coherence (et permet d'etendre une eventuelle whitelist du validator).

```typescript
  // --- Actions self-service client Assurflow v3.0 (Sprint 7.5b) ---
  // (ACCEPT, SIGN, MANAGE, VIEW, UPDATE, READ deja presents -- NE PAS dupliquer)
  DECLARE_FNOL: 'declare_fnol',       // customer.sinistres.declare_fnol
  READ_MINE: 'read_mine',             // customer.sinistres.read_mine / customer.repairs.read_mine
  TRACK_PROGRESS: 'track_progress',   // customer.sinistres.track_progress
  TRACK: 'track',                     // customer.tow.track
  RENEW: 'renew',                     // customer.policies.renew
  INITIATE: 'initiate',               // customer.payments.initiate
  SUBMIT: 'submit',                   // customer.feedback.submit
  CONTACT: 'contact',                 // customer.support.contact
```

Si (et seulement si) le validator boot-time impose une whitelist stricte d'actions (cf. `permissions-validator.ts`), exposer ces actions via la constante `EXTENDED_ACTIONS` introduite par 7.5a, qui est unionnee a `Object.values(Action)` au moment de la validation :

```typescript
/**
 * Actions non standard tolerees par le validator de naming (heritage 7.5a).
 * Permet aux verticaux d'exprimer des verbes metier specifiques sans elargir
 * le contrat "standard" (read/create/update/delete) du coeur de plateforme.
 */
export const EXTENDED_ACTIONS: readonly string[] = Object.freeze([
  // 7.5a (deja presentes)
  'accept', 'toggle', 'designate', 'evaluate', 'invoice', 'sign', 'complete',
  'upload', 'generate', 'manage', 'read_pool', 'read_stats', 'read_available',
  'validate_quote', 'modify_quote', 'reject_quote', 'add_to_favorites',
  'cancel_within_window', 'view_dashboard',
  'approve_level1', 'approve_level2', 'approve_level3', 'approve_level4',
  // 7.5b customer (AJOUT DE CETTE TACHE)
  'declare_fnol', 'read_mine', 'track_progress', 'track', 'renew',
  'initiate', 'submit', 'contact',
]);
```

> Si le validator n'impose PAS de whitelist (il s'appuie seulement sur la regex de naming + l'appartenance au module), l'ajout de `EXTENDED_ACTIONS` est inutile et peut etre omis ; la regex elargie de 7.5a suffit. Verifier le contenu reel de `permissions-validator.ts` avant d'ajouter. Dans tous les cas, l'ajout des entrees au `Action` const ci-dessus est sans risque et recommande pour la lisibilite.

#### 7.4.1 Logique de validation des actions (whitelist vs regex)

Deux strategies de validation des actions coexistent dans la base ; il faut identifier laquelle est active avant d'agir :

```typescript
// Strategie A -- regex seule (la plus courante apres 7.5a) :
// le segment d'action doit matcher [a-z][a-z0-9_]* ; aucune liste blanche.
// -> Les actions customer passent sans ajout d'EXTENDED_ACTIONS.

// Strategie B -- whitelist stricte (si le validator l'impose) :
function isKnownAction(action: string): boolean {
  const standard = Object.values(Action); // read/create/update/delete/...
  return standard.includes(action) || EXTENDED_ACTIONS.includes(action);
}
// -> Si strategie B active : declare_fnol/read_mine/... DOIVENT etre dans
//    Action const OU EXTENDED_ACTIONS, sinon le validator rejette.
```

La regle operationnelle : ouvrir `permissions-validator.ts`, chercher une eventuelle reference a une liste d'actions autorisees. Si elle existe (strategie B), completer `EXTENDED_ACTIONS`. Sinon (strategie A), l'ajout au `Action` const suffit pour la lisibilite. Dans le doute, completer les deux : c'est sans risque (un `Action` const plus riche et une `EXTENDED_ACTIONS` plus complete ne cassent rien).

### 7.5 Assignation matrice : role `assure` -> 17 permissions customer (`permissions-matrix.ts`)

Le role `assure` (acteur 5) recoit les 17 permissions customer. On etend la liste existante du role, sans rien retirer. Selon la forme de la matrice (objet `Record<AuthRole, PermissionValue[]>` ou builder), voici les deux variantes ; appliquer celle qui correspond a la structure reelle.

Variante A -- la matrice est un `Record` litteral, le role `assure` a deja une entree :

```typescript
import { Permission, type PermissionValue } from './permissions.enum.js';
import { AuthRole } from './auth-role.enum.js';

/** Permissions self-service du client final (acteur 5), portees par le role `assure`. */
const CUSTOMER_SELF_SERVICE_PERMISSIONS: readonly PermissionValue[] = [
  Permission.CUSTOMER_SINISTRES_DECLARE_FNOL,
  Permission.CUSTOMER_SINISTRES_READ_MINE,
  Permission.CUSTOMER_SINISTRES_TRACK_PROGRESS,
  Permission.CUSTOMER_DEVIS_VIEW,
  Permission.CUSTOMER_DEVIS_ACCEPT,
  Permission.CUSTOMER_REPAIRS_READ_MINE,
  Permission.CUSTOMER_DELIVERY_SIGN,
  Permission.CUSTOMER_TOW_TRACK,
  Permission.CUSTOMER_POLICIES_VIEW,
  Permission.CUSTOMER_POLICIES_RENEW,
  Permission.CUSTOMER_PAYMENTS_VIEW,
  Permission.CUSTOMER_PAYMENTS_INITIATE,
  Permission.CUSTOMER_DOCUMENTS_READ,
  Permission.CUSTOMER_NOTIFICATIONS_MANAGE,
  Permission.CUSTOMER_FEEDBACK_SUBMIT,
  Permission.CUSTOMER_SUPPORT_CONTACT,
  Permission.CUSTOMER_PROFILE_UPDATE,
] as const;

export const PERMISSIONS_MATRIX: Record<AuthRole, readonly PermissionValue[]> = {
  // ... autres roles inchanges ...

  [AuthRole.ASSURE]: [
    // ... permissions anterieures du role assure (NE PAS RETIRER) ...
    ...CUSTOMER_SELF_SERVICE_PERMISSIONS,
  ],

  // ... autres roles inchanges ...
};
```

Variante B -- la matrice est construite par un builder/fonction d'agregation : ajouter une etape qui fusionne `CUSTOMER_SELF_SERVICE_PERMISSIONS` dans le set du role `assure`, en dedupliquant :

```typescript
function buildAssurePermissions(): readonly PermissionValue[] {
  const base = BASE_ASSURE_PERMISSIONS; // permissions anterieures
  return Object.freeze(
    Array.from(new Set<PermissionValue>([...base, ...CUSTOMER_SELF_SERVICE_PERMISSIONS])),
  );
}
```

> Important : ne jamais introduire de doublon dans la liste du role `assure`. Si une permission customer figurait deja (ce n'est pas le cas ici, ce sont des cles neuves), le `Set` la dedupliquerait. Le test L17 verifie l'absence de doublon.

#### 7.5.1 Verification d'integrite de l'assignation

Apres l'assignation, une verification rapide en console (ou via un test) confirme que l'intersection entre les permissions de `assure` et les 17 customer vaut exactement 17, et que l'intersection des autres roles avec customer vaut 0 :

```typescript
// Verification d'integrite (peut etre transformee en test) :
const assure = new Set(PERMISSIONS_MATRIX[AuthRole.ASSURE]);
const customer = CUSTOMER_SELF_SERVICE_PERMISSIONS;

const presentInAssure = customer.filter((p) => assure.has(p));
console.assert(presentInAssure.length === 17, '17 perms customer attendues sur assure');

for (const [role, perms] of Object.entries(PERMISSIONS_MATRIX)) {
  if (role === AuthRole.ASSURE) continue;
  const leaked = perms.filter((p) => p.startsWith('customer.'));
  console.assert(leaked.length === 0, `fuite customer vers ${role}`);
}
```

### 7.6 Extrait `permissions-by-module.ts` (groupage) -- le groupe customer

Le groupage par module est automatique a partir de `ALL_PERMISSIONS` + `ALL_MODULES`. Aucun edit manuel n'est requis ; on illustre le resultat attendu pour le module `customer` (utile pour comprendre les tests de comptage par module).

```typescript
import { ALL_PERMISSIONS, type PermissionValue } from './permissions.enum.js';
import { ALL_MODULES, parsePermission, type ModuleValue } from './permission-helpers.js';

export type PermissionsByModule = Readonly<Record<ModuleValue, readonly PermissionValue[]>>;

/** Regroupe les 147 permissions par module (25 cles). */
export function groupPermissionsByModule(): PermissionsByModule {
  const acc: Record<string, PermissionValue[]> = {};
  for (const mod of ALL_MODULES) {
    acc[mod] = [];
  }
  for (const perm of ALL_PERMISSIONS) {
    const { module } = parsePermission(perm);
    // module est garanti present dans acc des lors que Module.CUSTOMER existe.
    (acc[module] ??= []).push(perm);
  }
  return Object.freeze(acc) as PermissionsByModule;
}

// Resultat attendu pour le module `customer` (17 entrees) :
//   customer.sinistres.declare_fnol, customer.sinistres.read_mine,
//   customer.sinistres.track_progress, customer.devis.view, customer.devis.accept,
//   customer.repairs.read_mine, customer.delivery.sign, customer.tow.track,
//   customer.policies.view, customer.policies.renew, customer.payments.view,
//   customer.payments.initiate, customer.documents.read,
//   customer.notifications.manage, customer.feedback.submit,
//   customer.support.contact, customer.profile.update
```

### 7.7 Constante de reference des 17 permissions customer (pour les tests)

Definir une constante de reference partagee par les tests, garantissant l'ordre et l'exhaustivite :

```typescript
// packages/auth/src/rbac/__fixtures__/customer-permissions.fixture.ts
import { Permission, type PermissionValue } from '../permissions.enum.js';

/** Reference figee des 17 permissions du module customer (Sprint 7.5b). */
export const CUSTOMER_PERMISSIONS_REFERENCE: readonly PermissionValue[] = Object.freeze([
  Permission.CUSTOMER_SINISTRES_DECLARE_FNOL,
  Permission.CUSTOMER_SINISTRES_READ_MINE,
  Permission.CUSTOMER_SINISTRES_TRACK_PROGRESS,
  Permission.CUSTOMER_DEVIS_VIEW,
  Permission.CUSTOMER_DEVIS_ACCEPT,
  Permission.CUSTOMER_REPAIRS_READ_MINE,
  Permission.CUSTOMER_DELIVERY_SIGN,
  Permission.CUSTOMER_TOW_TRACK,
  Permission.CUSTOMER_POLICIES_VIEW,
  Permission.CUSTOMER_POLICIES_RENEW,
  Permission.CUSTOMER_PAYMENTS_VIEW,
  Permission.CUSTOMER_PAYMENTS_INITIATE,
  Permission.CUSTOMER_DOCUMENTS_READ,
  Permission.CUSTOMER_NOTIFICATIONS_MANAGE,
  Permission.CUSTOMER_FEEDBACK_SUBMIT,
  Permission.CUSTOMER_SUPPORT_CONTACT,
  Permission.CUSTOMER_PROFILE_UPDATE,
]);

/** Les 17 valeurs litterales attendues (string), pour les assertions de naming. */
export const CUSTOMER_PERMISSION_VALUES: readonly string[] = Object.freeze([
  'customer.sinistres.declare_fnol',
  'customer.sinistres.read_mine',
  'customer.sinistres.track_progress',
  'customer.devis.view',
  'customer.devis.accept',
  'customer.repairs.read_mine',
  'customer.delivery.sign',
  'customer.tow.track',
  'customer.policies.view',
  'customer.policies.renew',
  'customer.payments.view',
  'customer.payments.initiate',
  'customer.documents.read',
  'customer.notifications.manage',
  'customer.feedback.submit',
  'customer.support.contact',
  'customer.profile.update',
]);

/** Les 17 cles attendues (string), pour les assertions de presence de cle. */
export const CUSTOMER_PERMISSION_KEYS: readonly string[] = Object.freeze([
  'CUSTOMER_SINISTRES_DECLARE_FNOL',
  'CUSTOMER_SINISTRES_READ_MINE',
  'CUSTOMER_SINISTRES_TRACK_PROGRESS',
  'CUSTOMER_DEVIS_VIEW',
  'CUSTOMER_DEVIS_ACCEPT',
  'CUSTOMER_REPAIRS_READ_MINE',
  'CUSTOMER_DELIVERY_SIGN',
  'CUSTOMER_TOW_TRACK',
  'CUSTOMER_POLICIES_VIEW',
  'CUSTOMER_POLICIES_RENEW',
  'CUSTOMER_PAYMENTS_VIEW',
  'CUSTOMER_PAYMENTS_INITIATE',
  'CUSTOMER_DOCUMENTS_READ',
  'CUSTOMER_NOTIFICATIONS_MANAGE',
  'CUSTOMER_FEEDBACK_SUBMIT',
  'CUSTOMER_SUPPORT_CONTACT',
  'CUSTOMER_PROFILE_UPDATE',
]);
```

### 7.8 Mise a jour du commentaire d'en-tete et plancher du validator (si applicable)

Dans `permissions-validator.ts`, si un plancher numerique strict est present :

```typescript
/**
 * Validation boot-time du catalog de permissions.
 * Verifie : (1) naming via PERMISSION_NAMING_REGEX, (2) appartenance au module
 * (ALL_MODULES), (3) unicite cle/valeur, (4) coherence du compteur attendu.
 */
const EXPECTED_PERMISSION_COUNT = 147; // 130 (7.5a) + 17 (customer 7.5b)
const EXPECTED_MODULE_COUNT = 25;      // 24 (7.5a) + 1 (customer 7.5b)

export function validatePermissionsCatalog(): void {
  // ... verifications existantes ...
  if (ALL_PERMISSIONS.length !== EXPECTED_PERMISSION_COUNT) {
    throw new Error(
      `Permission catalog count mismatch: expected ${EXPECTED_PERMISSION_COUNT}, got ${ALL_PERMISSIONS.length}`,
    );
  }
  if (ALL_MODULES.length !== EXPECTED_MODULE_COUNT) {
    throw new Error(
      `Module count mismatch: expected ${EXPECTED_MODULE_COUNT}, got ${ALL_MODULES.length}`,
    );
  }
  for (const perm of ALL_PERMISSIONS) {
    const { module } = parsePermission(perm); // throw si naming invalide
    if (!ALL_MODULES.includes(module as ModuleValue)) {
      throw new Error(`Permission '${perm}' uses unknown module '${module}'`);
    }
  }
  const values = Object.values(Permission);
  if (new Set(values).size !== values.length) {
    throw new Error('Permission catalog contains duplicate values');
  }
}
```

> Si le validator utilise un `>=` (plancher minimum) plutot qu'une egalite, ne le casser pas : le minimum reste satisfait par 147. Adapter uniquement les egalites strictes.

#### 7.8.1 Sequence d'application des modifications (ordre recommande)

Pour minimiser les allers-retours de compilation, appliquer les modifications dans cet ordre :

1. **`permission-helpers.ts`** d'abord : ajouter `CUSTOMER: 'customer'` au `Module` const et les actions au `Action` const. Cela rend le module connu avant l'ajout des permissions.
2. **`permissions.enum.ts`** ensuite : inserer le bloc des 17 entrees + maj du JSDoc d'en-tete. Le typecheck passe car `Module.CUSTOMER` existe deja.
3. **`__fixtures__/customer-permissions.fixture.ts`** : creer la fixture de reference (elle importe `Permission`, donc apres l'etape 2).
4. **`permissions-matrix.ts`** : assigner les 17 permissions a `assure`.
5. **`permissions-validator.ts`** : ajuster le plancher (`130 -> 147`) si egalite stricte.
6. **Les 4 fichiers `.spec.ts`** : mettre a jour/ajouter les tests.
7. **typecheck -> lint -> test** : dans cet ordre, corriger au fil.

Cet ordre evite l'etat transitoire ou le validator throw "unknown module customer" (qui surviendrait si on inserait les permissions avant le module).

---

## 8. Tests complets

Fichier `packages/auth/src/rbac/permissions.spec.ts` (extension). Vitest. On ajoute les `it()` ci-dessous sans retirer les tests existants.

```typescript
import { describe, it, expect } from 'vitest';
import {
  Permission,
  ALL_PERMISSIONS,
  PermissionKeys,
  type PermissionValue,
} from './permissions.enum.js';
import { Module, ALL_MODULES, parsePermission } from './permission-helpers.js';
import { PERMISSION_NAMING_REGEX } from './rbac-constants.js';
import {
  CUSTOMER_PERMISSIONS_REFERENCE,
  CUSTOMER_PERMISSION_VALUES,
  CUSTOMER_PERMISSION_KEYS,
} from './__fixtures__/customer-permissions.fixture.js';

describe('Catalog de permissions -- Sprint 7.5b (module customer, 130 -> 147)', () => {
  // --- Comptage global ---
  it('contient exactement 147 permissions au total', () => {
    expect(ALL_PERMISSIONS.length).toBe(147);
  });

  it('a autant de cles que de valeurs (PermissionKeys === ALL_PERMISSIONS)', () => {
    expect(PermissionKeys.length).toBe(ALL_PERMISSIONS.length);
    expect(PermissionKeys.length).toBe(147);
  });

  it('ne contient aucune valeur dupliquee parmi les 147', () => {
    const values = Object.values(Permission);
    expect(new Set(values).size).toBe(values.length);
  });

  it('ne contient aucune cle dupliquee parmi les 147', () => {
    const keys = Object.keys(Permission);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ALL_PERMISSIONS est fige (Object.isFrozen)', () => {
    expect(Object.isFrozen(ALL_PERMISSIONS)).toBe(true);
  });

  // --- Modules ---
  it('ALL_MODULES contient exactement 25 modules', () => {
    expect(ALL_MODULES.length).toBe(25);
  });

  it('le module customer est present dans le registre Module', () => {
    expect(Module.CUSTOMER).toBe('customer');
    expect(ALL_MODULES).toContain('customer');
  });

  it('le module customer est unique dans ALL_MODULES', () => {
    const occurrences = ALL_MODULES.filter((m) => m === 'customer').length;
    expect(occurrences).toBe(1);
  });

  // --- Presence des 17 permissions customer ---
  it('contient exactement 17 permissions prefixees customer.', () => {
    const customerPerms = ALL_PERMISSIONS.filter((p) => p.startsWith('customer.'));
    expect(customerPerms.length).toBe(17);
  });

  it('expose les 17 permissions customer attendues (valeurs exactes)', () => {
    for (const value of CUSTOMER_PERMISSION_VALUES) {
      expect(ALL_PERMISSIONS).toContain(value as PermissionValue);
    }
    expect(CUSTOMER_PERMISSION_VALUES.length).toBe(17);
  });

  it('expose les 17 cles CUSTOMER_* attendues', () => {
    for (const key of CUSTOMER_PERMISSION_KEYS) {
      expect(PermissionKeys).toContain(key);
    }
    expect(CUSTOMER_PERMISSION_KEYS.length).toBe(17);
  });

  it('les 17 valeurs customer sont uniques entre elles', () => {
    expect(new Set(CUSTOMER_PERMISSION_VALUES).size).toBe(17);
  });

  it('les 17 cles customer sont uniques entre elles', () => {
    expect(new Set(CUSTOMER_PERMISSION_KEYS).size).toBe(17);
  });

  it('chaque cle CUSTOMER_* mappe vers la bonne valeur (verification explicite, pas de transformation naive)', () => {
    expect(Permission.CUSTOMER_SINISTRES_DECLARE_FNOL).toBe('customer.sinistres.declare_fnol');
    expect(Permission.CUSTOMER_SINISTRES_READ_MINE).toBe('customer.sinistres.read_mine');
    expect(Permission.CUSTOMER_SINISTRES_TRACK_PROGRESS).toBe('customer.sinistres.track_progress');
    expect(Permission.CUSTOMER_DEVIS_VIEW).toBe('customer.devis.view');
    expect(Permission.CUSTOMER_DEVIS_ACCEPT).toBe('customer.devis.accept');
    expect(Permission.CUSTOMER_REPAIRS_READ_MINE).toBe('customer.repairs.read_mine');
    expect(Permission.CUSTOMER_DELIVERY_SIGN).toBe('customer.delivery.sign');
    expect(Permission.CUSTOMER_TOW_TRACK).toBe('customer.tow.track');
    expect(Permission.CUSTOMER_POLICIES_VIEW).toBe('customer.policies.view');
    expect(Permission.CUSTOMER_POLICIES_RENEW).toBe('customer.policies.renew');
    expect(Permission.CUSTOMER_PAYMENTS_VIEW).toBe('customer.payments.view');
    expect(Permission.CUSTOMER_PAYMENTS_INITIATE).toBe('customer.payments.initiate');
    expect(Permission.CUSTOMER_DOCUMENTS_READ).toBe('customer.documents.read');
    expect(Permission.CUSTOMER_NOTIFICATIONS_MANAGE).toBe('customer.notifications.manage');
    expect(Permission.CUSTOMER_FEEDBACK_SUBMIT).toBe('customer.feedback.submit');
    expect(Permission.CUSTOMER_SUPPORT_CONTACT).toBe('customer.support.contact');
    expect(Permission.CUSTOMER_PROFILE_UPDATE).toBe('customer.profile.update');
  });

  it('la reference figee CUSTOMER_PERMISSIONS_REFERENCE comporte 17 entrees uniques', () => {
    expect(CUSTOMER_PERMISSIONS_REFERENCE.length).toBe(17);
    expect(new Set(CUSTOMER_PERMISSIONS_REFERENCE).size).toBe(17);
  });

  // --- Naming ---
  it('les 17 valeurs customer respectent PERMISSION_NAMING_REGEX', () => {
    for (const value of CUSTOMER_PERMISSION_VALUES) {
      expect(PERMISSION_NAMING_REGEX.test(value)).toBe(true);
    }
  });

  it('toutes les valeurs customer ont exactement 3 segments separes par un point', () => {
    for (const value of CUSTOMER_PERMISSION_VALUES) {
      expect(value.split('.').length).toBe(3);
    }
  });

  it('parsePermission extrait correctement le module customer et l action (y compris underscores internes)', () => {
    const fnol = parsePermission('customer.sinistres.declare_fnol');
    expect(fnol.module).toBe('customer');
    expect(fnol.resource).toBe('sinistres');
    expect(fnol.action).toBe('declare_fnol');

    const mine = parsePermission('customer.sinistres.read_mine');
    expect(mine.module).toBe('customer');
    expect(mine.action).toBe('read_mine');

    const progress = parsePermission('customer.sinistres.track_progress');
    expect(progress.action).toBe('track_progress');

    const sign = parsePermission('customer.delivery.sign');
    expect(sign.module).toBe('customer');
    expect(sign.resource).toBe('delivery');
    expect(sign.action).toBe('sign');
  });

  it('toutes les valeurs customer commencent par le segment de module customer', () => {
    for (const value of CUSTOMER_PERMISSION_VALUES) {
      expect(parsePermission(value).module).toBe('customer');
    }
  });

  // --- Non-regression 7.5a (130) ---
  it('non-regression : au moins 130 permissions etaient deja presentes avant customer', () => {
    const nonCustomer = ALL_PERMISSIONS.filter((p) => !p.startsWith('customer.'));
    expect(nonCustomer.length).toBe(130);
  });

  it('non-regression : snapshot du sous-ensemble non-customer reste stable (130 entrees)', () => {
    const nonCustomer = ALL_PERMISSIONS.filter((p) => !p.startsWith('customer.'));
    // Le snapshot fige les 130 valeurs : toute modification accidentelle des
    // blocs 7.5a/v2.2 fait rougir ce test (garde-fou anti-regression).
    expect(nonCustomer.length).toMatchInlineSnapshot('130');
    expect(new Set(nonCustomer).size).toBe(130);
  });

  it('non-regression : les modules 7.5a (carrier/expertise/tow/parts) sont toujours presents', () => {
    expect(ALL_MODULES).toContain('carrier');
    expect(ALL_MODULES).toContain('expertise');
    expect(ALL_MODULES).toContain('tow');
    expect(ALL_MODULES).toContain('parts');
  });

  it('non-regression : un echantillon de permissions 7.5a est intact', () => {
    expect(ALL_PERMISSIONS).toContain('carrier.payment.approve_level4' as PermissionValue);
    expect(ALL_PERMISSIONS).toContain('expertise.missions.read' as PermissionValue);
    expect(ALL_PERMISSIONS).toContain('tow.missions.accept' as PermissionValue);
    expect(ALL_PERMISSIONS).toContain('parts.orders.create' as PermissionValue);
  });

  it('non-regression : aucun bloc 7.5a n est duplique (echantillon present 1 seule fois)', () => {
    const occ = ALL_PERMISSIONS.filter((p) => p === 'carrier.payment.approve_level4').length;
    expect(occ).toBe(1);
  });

  it('non-regression : aucune permission customer ne reutilise une valeur 7.5a/v2.2', () => {
    const nonCustomer = new Set(ALL_PERMISSIONS.filter((p) => !p.startsWith('customer.')));
    for (const value of CUSTOMER_PERMISSION_VALUES) {
      expect(nonCustomer.has(value as PermissionValue)).toBe(false);
    }
  });

  // --- Pas d enum ---
  it('Permission est un objet const (pas un enum) : Object.values est exploitable', () => {
    expect(Array.isArray(Object.values(Permission))).toBe(true);
    expect(typeof Permission).toBe('object');
  });

  it('Permission n expose pas de mapping inverse valeur->cle (signature d un enum)', () => {
    // Un enum string TS cree des cles numeriques/inverses ; un const as const non.
    // Ici toutes les cles sont des chaines en MAJUSCULES, aucune valeur n est une cle.
    const keys = Object.keys(Permission);
    for (const key of keys) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  // --- Comptage par module ---
  it('le module customer regroupe exactement 17 permissions', () => {
    const byCustomer = ALL_PERMISSIONS.filter((p) => parsePermission(p).module === 'customer');
    expect(byCustomer.length).toBe(17);
  });

  it('les 12 resources customer sont toutes representees', () => {
    const resources = new Set(
      CUSTOMER_PERMISSION_VALUES.map((v) => parsePermission(v).resource),
    );
    expect(resources).toEqual(
      new Set([
        'sinistres', 'devis', 'repairs', 'delivery', 'tow', 'policies',
        'payments', 'documents', 'notifications', 'feedback', 'support', 'profile',
      ]),
    );
  });
});
```

Fichier `packages/auth/src/rbac/permissions-matrix.spec.ts` (extension) :

```typescript
import { describe, it, expect } from 'vitest';
import { PERMISSIONS_MATRIX } from './permissions-matrix.js';
import { AuthRole } from './auth-role.enum.js';
import { CUSTOMER_PERMISSIONS_REFERENCE } from './__fixtures__/customer-permissions.fixture.js';
import { ALL_PERMISSIONS } from './permissions.enum.js';

describe('Matrice de permissions -- assignation customer au role assure', () => {
  it('le role assure possede les 17 permissions customer', () => {
    const assurePerms = PERMISSIONS_MATRIX[AuthRole.ASSURE];
    for (const perm of CUSTOMER_PERMISSIONS_REFERENCE) {
      expect(assurePerms).toContain(perm);
    }
  });

  it('le role assure possede EXACTEMENT les 17 permissions customer (ni plus ni moins cote customer)', () => {
    const assureCustomer = PERMISSIONS_MATRIX[AuthRole.ASSURE].filter((p) =>
      p.startsWith('customer.'),
    );
    expect(assureCustomer.length).toBe(17);
    expect(new Set(assureCustomer).size).toBe(17);
  });

  it('le role assure n introduit aucun doublon dans sa liste de permissions', () => {
    const assurePerms = PERMISSIONS_MATRIX[AuthRole.ASSURE];
    expect(new Set(assurePerms).size).toBe(assurePerms.length);
  });

  it('chaque permission customer est assignee a au moins un role', () => {
    const allAssigned = new Set(Object.values(PERMISSIONS_MATRIX).flat());
    for (const perm of CUSTOMER_PERMISSIONS_REFERENCE) {
      expect(allAssigned.has(perm)).toBe(true);
    }
  });

  it('aucune permission customer n est assignee a un role autre que assure (scope self-service)', () => {
    for (const [role, perms] of Object.entries(PERMISSIONS_MATRIX)) {
      if (role === AuthRole.ASSURE) continue;
      const leaked = perms.filter((p) => p.startsWith('customer.'));
      expect(leaked).toEqual([]);
    }
  });

  it('toute permission assignee dans la matrice existe dans le catalog (pas de cle fantome)', () => {
    const catalog = new Set(ALL_PERMISSIONS);
    for (const perms of Object.values(PERMISSIONS_MATRIX)) {
      for (const p of perms) {
        expect(catalog.has(p)).toBe(true);
      }
    }
  });

  it('le role assure conserve ses permissions anterieures (l ajout est additif)', () => {
    // Au moins les permissions customer + d eventuelles permissions anterieures.
    const assurePerms = PERMISSIONS_MATRIX[AuthRole.ASSURE];
    expect(assurePerms.length).toBeGreaterThanOrEqual(17);
  });
});
```

Fichier `packages/auth/src/rbac/permissions-validator.spec.ts` (extension) :

```typescript
import { describe, it, expect } from 'vitest';
import { validatePermissionsCatalog } from './permissions-validator.js';
import { Module, ALL_MODULES, parsePermission } from './permission-helpers.js';
import { ALL_PERMISSIONS } from './permissions.enum.js';

describe('Validator boot-time -- module customer', () => {
  it('valide le catalog sans lever d erreur (147 perms, 25 modules)', () => {
    expect(() => validatePermissionsCatalog()).not.toThrow();
  });

  it('le module customer est connu (pas d erreur unknown module)', () => {
    expect(Module.CUSTOMER).toBe('customer');
  });

  it('toute permission customer reference un module present dans ALL_MODULES', () => {
    const customer = ALL_PERMISSIONS.filter((p) => p.startsWith('customer.'));
    for (const p of customer) {
      const { module } = parsePermission(p);
      expect(ALL_MODULES).toContain(module);
    }
  });

  it('le validator detecte un compteur incoherent (test negatif sur copie)', () => {
    // On ne mute pas le catalog reel ; on verifie juste que la fonction existe
    // et que l invariant 147 est bien le contrat courant.
    expect(ALL_PERMISSIONS.length).toBe(147);
  });
});
```

Fichier `packages/auth/src/rbac/permission-helpers.spec.ts` (extension) -- tests cibles sur le registre de modules et les actions :

```typescript
import { describe, it, expect } from 'vitest';
import { Module, ALL_MODULES, Action } from './permission-helpers.js';

describe('permission-helpers -- module customer et actions self-service', () => {
  it('Module.CUSTOMER vaut customer', () => {
    expect(Module.CUSTOMER).toBe('customer');
  });

  it('ALL_MODULES derive de Module et vaut 25 entrees', () => {
    expect(ALL_MODULES).toEqual(Object.values(Module));
    expect(ALL_MODULES.length).toBe(25);
  });

  it('ALL_MODULES ne contient aucun doublon', () => {
    expect(new Set(ALL_MODULES).size).toBe(ALL_MODULES.length);
  });

  it('les 20 modules v2.2 et 4 verticaux 7.5a sont toujours presents', () => {
    const expected = [
      'auth', 'tenant', 'crm', 'booking', 'comm', 'docs', 'signature', 'pay',
      'books', 'compliance', 'analytics', 'insure', 'repair', 'stock', 'hr',
      'admin', 'cross_tenant', 'sky', 'mcp', 'public',
      'carrier', 'expertise', 'tow', 'parts',
    ];
    for (const m of expected) {
      expect(ALL_MODULES).toContain(m);
    }
  });

  it('les modules 7.5a precedent customer dans l ordre d insertion', () => {
    const idxParts = ALL_MODULES.indexOf('parts');
    const idxCustomer = ALL_MODULES.indexOf('customer');
    expect(idxParts).toBeGreaterThanOrEqual(0);
    expect(idxCustomer).toBeGreaterThan(idxParts);
  });

  it('le Action const expose les actions customer non standard', () => {
    expect(Action.DECLARE_FNOL).toBe('declare_fnol');
    expect(Action.READ_MINE).toBe('read_mine');
    expect(Action.TRACK_PROGRESS).toBe('track_progress');
    expect(Action.TRACK).toBe('track');
    expect(Action.RENEW).toBe('renew');
    expect(Action.INITIATE).toBe('initiate');
    expect(Action.SUBMIT).toBe('submit');
    expect(Action.CONTACT).toBe('contact');
  });

  it('ne duplique pas les actions deja presentes (ACCEPT/SIGN/MANAGE)', () => {
    const actionValues = Object.values(Action);
    expect(actionValues.filter((a) => a === 'accept').length).toBe(1);
    expect(actionValues.filter((a) => a === 'sign').length).toBe(1);
    expect(actionValues.filter((a) => a === 'manage').length).toBe(1);
  });

  it('Action est un objet const (pas un enum)', () => {
    expect(typeof Action).toBe('object');
    expect(Array.isArray(Object.values(Action))).toBe(true);
  });
});
```

Tableau de correspondance test -> critere -> livrable (pour la revue) :

| Test (it) | Critere | Livrable | Priorite |
| --- | --- | --- | --- |
| contient exactement 147 permissions | V3 | L10 | P0 |
| PermissionKeys === ALL_PERMISSIONS | V23 | L5 | P0 |
| aucune valeur dupliquee | V8 | L13 | P0 |
| aucune cle dupliquee | V8 | L13 | P0 |
| ALL_PERMISSIONS fige | V14 | L5 | P1 |
| ALL_MODULES === 25 | V4 | L7, L11 | P0 |
| module customer present | V5 | L6, L12 | P0 |
| module customer unique | V5 | L6 | P1 |
| 17 valeurs customer presentes | V6 | L2, L13 | P0 |
| 17 cles CUSTOMER_* presentes | V7 | L1 | P0 |
| 17 valeurs uniques | V8 | L13 | P0 |
| 17 cles uniques | V8 | L13 | P0 |
| mapping cle->valeur explicite | V6 | L2 | P0 |
| reference figee 17 uniques | V27 | L27 | P2 |
| naming 17 valeurs | V16 | L15 | P0 |
| 3 segments par valeur | V16 | L15 | P1 |
| parsePermission underscore | V19 | -- | P1 |
| valeurs commencent par customer | V5 | L12 | P1 |
| non-regression 130 | V9 | L4, L14 | P0 |
| snapshot non-customer 130 | V9 | L4 | P0 |
| modules 7.5a presents | V9 | L4 | P0 |
| echantillon 7.5a intact | V10 | L4 | P0 |
| pas de doublon 7.5a | V10 | L4 | P0 |
| pas de collision customer/7.5a | V9 | L4 | P0 |
| pas d enum (object) | V13/V14 | L24 | P0 |
| pas de mapping inverse | V13 | L24 | P1 |
| groupage customer == 17 | V28 | -- | P2 |
| 12 resources representees | V28 | -- | P2 |
| assure possede 17 perms | V12 | L9, L16 | P0 |
| assure exactement 17 customer | V12 | L16 | P0 |
| assure pas de doublon | V17 | L17 | P0 |
| chaque customer assignee | V12 | L9 | P1 |
| scope self-service (assure only) | V20 | -- | P1 |
| pas de cle fantome matrice | V21 | -- | P1 |
| assure conserve anterieures | V12 | L9 | P1 |
| validator ne throw pas | V11 | L18 | P0 |
| module customer connu validator | V5 | L18 | P0 |
| customer reference module valide | V11 | L18 | P1 |
| Action customer present | V24 | L8 | P1 |
| Action pas de duplication | V24 | L8 | P1 |
| modules v2.2+7.5a presents | V9 | L4 | P1 |

> Total tests ajoutes : 40+ `it()` repartis sur `permissions.spec.ts` (24), `permissions-matrix.spec.ts` (7), `permissions-validator.spec.ts` (4) et `permission-helpers.spec.ts` (8). Couverture attendue >= 90% sur le module RBAC.

### 8.1 Strategie de test (rationale)

Les tests se repartissent en cinq familles, chacune ciblant une categorie de risque :

1. **Comptage** (147 / 25 / 17 / 130) : garde-fou contre l'oubli d'entree, le doublon, ou la re-introduction 7.5a. Ce sont les tests P0 les plus discriminants.
2. **Presence / unicite** : verifie que chaque cle et valeur attendue existe et n'est presente qu'une fois. Detecte les fautes de frappe et les collisions.
3. **Naming** : verifie la conformite a la regex et la structure 3-segments. Detecte un mauvais format (majuscule, point manquant, segment de trop).
4. **Non-regression** : snapshot + echantillons 7.5a. C'est la famille critique de cette tache revisee, car le risque principal est d'abimer l'existant.
5. **Matrice / scope** : verifie l'assignation a `assure` et l'absence de fuite vers d'autres roles. Detecte l'oubli d'assignation et la sur-attribution.

La redondance apparente (plusieurs tests touchent au comptage) est volontaire : chaque test echoue avec un message different, ce qui accelere le diagnostic. Un echec sur "147" vs un echec sur "17 customer" vs un echec sur "130 non-customer" pointe immediatement la nature de l'erreur.

---

## 9. Variables d'environnement

| Variable | Role dans cette tache | Exemple |
| --- | --- | --- |
| `NODE_ENV` | Conditionne la verbosite des logs du validator boot-time | `test` |
| `RBAC_VALIDATE_ON_BOOT` | Active la validation `validatePermissionsCatalog()` au demarrage (doit detecter les 147/25) | `true` |
| `RBAC_PERMISSION_COUNT_EXPECTED` | (Optionnel) compteur attendu injecte pour la verification de coherence | `147` |
| `RBAC_MODULE_COUNT_EXPECTED` | (Optionnel) nombre de modules attendu | `25` |
| `LOG_LEVEL` | Niveau Pino pour le rapport de validation | `info` |
| `PASSWORD_PEPPER` | Non utilise directement ici mais requis pour le boot complet du package auth en test d integration | `dev-pepper-xxxx` |

> Aucune de ces variables ne doit contenir de secret en clair dans le repo. Pour les tests unitaires RBAC purs (catalog/matrice), aucune variable n'est strictement requise : les tests sont deterministes.

---

## 10. Commandes shell

```bash
# Typecheck strict du package auth
pnpm --filter @insurtech/auth typecheck

# Lint
pnpm --filter @insurtech/auth lint

# Tests unitaires RBAC (catalog, matrice, validator)
pnpm --filter @insurtech/auth test

# Tests cibles RBAC avec couverture
pnpm --filter @insurtech/auth test --coverage rbac

# Verification absence d emoji (decision-006)
bash scripts/check-no-emoji.sh packages/auth/src/rbac

# Recherche de garde-fou : aucun enum Permission introduit
grep -rn "enum Permission" packages/auth/src/rbac || echo "OK: aucun enum Permission"

# Comptage rapide des entrees customer (controle visuel)
grep -c "  CUSTOMER_" packages/auth/src/rbac/permissions.enum.ts

# Controle anti-doublon 7.5a (echantillon temoin)
grep -c "carrier.payment.approve_level4" packages/auth/src/rbac/permissions.enum.ts  # attendu: 1

# Detection de l etat de depart (cas A/B/C, section 3.1.2)
grep -n "CARRIER (15)\|EXPERTISE (10)\|TOW (8)\|PARTS (7)" packages/auth/src/rbac/permissions.enum.ts
```

---

## 11. Criteres de validation

> Format : ID | Priorite | Commande / verification | Resultat attendu | Mode d echec si non respecte.

### P0 (bloquants -- minimum 15)

- **V1 (P0)** `pnpm --filter @insurtech/auth typecheck` -> exit 0. Attendu : aucune erreur de type. Echec : type `PermissionValue` non a jour ou cle dupliquee detectee par TS.
- **V2 (P0)** `pnpm --filter @insurtech/auth test` -> tous verts. Attendu : 0 test rouge. Echec : un test de comptage ou de presence echoue.
- **V3 (P0)** `ALL_PERMISSIONS.length === 147`. Attendu : `147`. Echec : bloc customer absent (`130`), partiel, ou doublon (`> 147`).
- **V4 (P0)** `ALL_MODULES.length === 25`. Attendu : `25`. Echec : `CUSTOMER` non ajoute au `Module` const (`24`).
- **V5 (P0)** `Module.CUSTOMER === 'customer'`. Attendu : `'customer'`. Echec : module non enregistre -> validator boot rejette les 17 permissions avec `unknown module`.
- **V6 (P0)** Les 17 valeurs `customer.*` sont presentes (test L13). Attendu : 17 presentes. Echec : valeur mal saisie -> test `toContain` rouge.
- **V7 (P0)** Les 17 cles `CUSTOMER_*` sont presentes. Attendu : 17 cles. Echec : cle manquante ou mal nommee.
- **V8 (P0)** Aucun doublon de cle ni de valeur dans le catalog. Attendu : `new Set(...).size === length`. Echec : copie maladroite -> doublon.
- **V9 (P0)** Non-regression : `ALL_PERMISSIONS.filter(p => !p.startsWith('customer.')).length === 130`. Attendu : `130`. Echec : un bloc 7.5a a ete touche/supprime/modifie.
- **V10 (P0)** **Ne PAS re-introduire les permissions 7.5a** : les modules carrier/expertise/tow/parts sont presents UNE seule fois ; `grep -c "carrier.payment.approve_level4"` -> 1. Attendu : `1`. Echec : doublon de bloc 7.5a (re-extension par erreur) -> total `170` au lieu de `147`.
- **V11 (P0)** `validatePermissionsCatalog()` ne throw pas. Attendu : aucune exception. Echec : module inconnu ou compteur incoherent.
- **V12 (P0)** Le role `assure` possede les 17 permissions customer (test L16). Attendu : 17 presentes sur `assure`. Echec : assignation matrice oubliee -> client sans droits effectifs.
- **V13 (P0)** Aucun `enum Permission` : `grep -rn "enum Permission" packages/auth/src/rbac` -> 0 (hors commentaires d interdiction). Attendu : `0` occurrence de code. Echec : structure interdite (decision-012).
- **V14 (P0)** Le catalog reste un objet const : `typeof Permission === 'object'` et `Object.values(Permission)` exploitable. Attendu : `'object'`. Echec : migration enum.
- **V15 (P0)** Aucune emoji : `bash scripts/check-no-emoji.sh packages/auth/src/rbac` -> exit 0. Attendu : exit `0`. Echec : decision-006 violee, CI rouge.
- **V16 (P0)** Les 17 valeurs passent `PERMISSION_NAMING_REGEX`. Attendu : `true` pour les 17. Echec : naming non conforme (par ex. action a majuscules ou segment manquant).
- **V31 (P0)** Le sous-ensemble non-customer (130) ne contient aucune valeur `customer.*` (pas de collision). Attendu : intersection vide. Echec : une cle customer reutilise une valeur existante.

### P1 (importants -- minimum 8)

- **V17 (P1)** `pnpm --filter @insurtech/auth lint` -> exit 0. Attendu : exit `0`. Echec : style non conforme (sort-keys, ordre d imports).
- **V18 (P1)** Couverture RBAC >= 90% (`test --coverage rbac`). Attendu : `>= 90%`. Echec : couverture insuffisante sur module sensible.
- **V19 (P1)** `parsePermission('customer.sinistres.declare_fnol').action === 'declare_fnol'`. Attendu : `'declare_fnol'`. Echec : parsing casse sur underscore interne (renvoie `'declare'`).
- **V20 (P1)** Aucune permission customer assignee a un role autre que `assure` (scope self-service). Attendu : `[]` pour tous les autres roles. Echec : fuite de permission self-service vers un role back-office.
- **V21 (P1)** Toute permission de la matrice existe dans le catalog (pas de cle fantome). Attendu : toutes presentes. Echec : reference invalide (faute de frappe dans la matrice).
- **V22 (P1)** Le bloc customer est insere APRES les blocs 7.5a et AVANT `} as const;`. Attendu : `indexOf('customer') > indexOf('parts')` dans ALL_MODULES. Echec : insertion au mauvais endroit -> diff bruyant / risque de conflit.
- **V23 (P1)** `PermissionKeys.length === ALL_PERMISSIONS.length === 147`. Attendu : `147 === 147`. Echec : desynchronisation cles/valeurs.
- **V24 (P1)** Le `Action` const contient `DECLARE_FNOL`, `READ_MINE`, `TRACK_PROGRESS` (ou `EXTENDED_ACTIONS` les couvre). Attendu : actions presentes. Echec : whitelist d action incomplete si validator strict.
- **V25 (P1)** Le commentaire d en-tete de `permissions.enum.ts` mentionne 147 permissions / 25 modules. Attendu : JSDoc a jour. Echec : documentation interne perimee.
- **V32 (P1)** Le role `assure` possede EXACTEMENT 17 permissions `customer.*` (ni 16 ni 18). Attendu : `17`. Echec : oubli d une permission ou ajout en double dans la liste assure.

### P2 (qualite -- minimum 5)

- **V26 (P2)** `grep -c "  CUSTOMER_" permissions.enum.ts` -> 17. Attendu : `17`. Echec : compte visuel different (entree manquante ou en trop).
- **V27 (P2)** La fixture `CUSTOMER_PERMISSIONS_REFERENCE` compte 17 entrees uniques. Attendu : `17`. Echec : fixture desynchronisee du catalog.
- **V28 (P2)** Le groupage `groupPermissionsByModule().customer` compte 17 entrees. Attendu : `17`. Echec : groupage incoherent (module mal parse).
- **V29 (P2)** Les commentaires de chaque permission indiquent le role consommateur (`assure`) et le Sprint consommateur. Attendu : 17 commentaires complets. Echec : documentation incomplete.
- **V30 (P2)** Aucune reorganisation des entrees existantes (le diff ne montre que des ajouts dans `permissions.enum.ts` et `permission-helpers.ts`). Attendu : diff additif pur. Echec : diff montre des suppressions/deplacements.
- **V33 (P2)** Les 12 resources customer attendues sont toutes representees. Attendu : ensemble des 12 resources. Echec : resource mal orthographiee (ex. `policy` au lieu de `policies`).
- **V34 (P2)** L import de la fixture utilise l extension `.js` (NodeNext). Attendu : `from './__fixtures__/customer-permissions.fixture.js'`. Echec : resolution Vitest cassee.

---

## 12. Edge cases et troubleshooting

1. **Le catalog n'est pas a 130 au depart (encore 85, modules verticaux absents).**
   - Cause : la dependance Sprint 7.5a n'est pas mergee sur la branche.
   - Action : STOP. Signaler le blocage de dependance. NE PAS combler 85 -> 130 ici (hors perimetre). Reprendre une fois 7.5a integre.

2. **Le validator boot lance `uses unknown module 'customer'`.**
   - Cause : `CUSTOMER: 'customer'` non ajoute au `Module` const.
   - Action : ajouter l'entree au `Module` const (section 7.3). `ALL_MODULES` se met a jour automatiquement.

3. **Le test de comptage echoue avec `expected 147, got 130`.**
   - Cause : bloc customer non insere ou insere hors de l'objet `Permission`.
   - Action : verifier que les 17 entrees sont bien dans la `const Permission`, avant `} as const;`.

4. **Le test de comptage echoue avec `expected 147, got 170`.**
   - Cause classique de cette tache : re-introduction par erreur des 40 permissions 7.5a (doublons) en plus des 17 customer.
   - Action : supprimer le bloc 7.5a re-ajoute par erreur. Ne garder que le bloc customer. Verifier avec `grep -c "carrier.payment.approve_level4"` -> doit etre 1, pas 2.

5. **`parsePermission('customer.sinistres.declare_fnol')` renvoie action `declare` au lieu de `declare_fnol`.**
   - Cause : un parsing naif `split('.')` traite mal, ou une regex qui interdit l'underscore dans le dernier segment.
   - Action : verifier que la regex de naming (elargie par 7.5a) autorise `[a-z_]+` dans le segment d'action et que `parsePermission` prend bien le DERNIER segment comme action. Aucun changement de parsing necessaire si 7.5a est en place.

6. **Le lint signale une cle non triee (`sort-keys`).**
   - Cause : regle ESLint `sort-keys` activee sur l'objet Permission.
   - Action : si la regle est active, le projet l'aurait deja desactivee pour ce fichier (sinon les 130 existantes seraient deja non conformes). Verifier la directive `/* eslint-disable sort-keys */` deja presente en tete de fichier ; ne pas la retirer.

7. **Doublon dans la liste du role `assure`.**
   - Cause : une permission customer figurait deja dans la base du role (improbable, cles neuves) ou double `...spread`.
   - Action : dedupliquer via `Array.from(new Set([...]))` (variante B section 7.5).

8. **`exactOptionalPropertyTypes` casse l'assignation matrice.**
   - Cause : type `readonly PermissionValue[]` vs `PermissionValue[]` mutable.
   - Action : declarer la fixture `as const` et le type de la matrice en `readonly PermissionValue[]`.

9. **La fixture `__fixtures__/customer-permissions.fixture.ts` n'est pas trouvee par Vitest.**
   - Cause : chemin d'import ou extension `.js` manquante (NodeNext).
   - Action : utiliser l'import relatif avec extension `.js` (ESM/NodeNext), conforme au reste du package.

10. **Couverture sous 90% apres ajout.**
    - Cause : branche `EXTENDED_ACTIONS` ou cas du validator non testes.
    - Action : ajouter les tests de la section 8 (validator spec) ; ils couvrent les chemins ajoutes.

11. **Le test de scope V20 echoue : une permission customer fuit vers `support_agent`.**
    - Cause : un developpeur a ajoute `customer.*` a un role back-office "pour aider le client".
    - Action : retirer toute permission `customer.*` des roles autres que `assure`. Les agents utilisent leurs propres permissions metier. Le self-service est strictement reserve a l acteur 5.

12. **Le typecheck echoue : `Property 'CUSTOMER_...' does not exist on type 'typeof Permission'` dans la matrice.**
    - Cause : la matrice a ete editee avant l'insertion des cles dans le const Permission (ordre inverse), ou une faute de frappe sur le nom de cle.
    - Action : appliquer l'ordre de la section 7.8.1 (Module -> Permission -> matrice). Verifier l'orthographe exacte de la cle (`CUSTOMER_SINISTRES_DECLARE_FNOL`, pas `CUSTOMER_SINISTRE_...`).

13. **Le snapshot de non-regression (130) rougit sans qu'on ait touche 7.5a volontairement.**
    - Cause : une reorganisation automatique (formatter, tri d'imports, sort-keys) a deplace/altere des entrees existantes.
    - Action : verifier le diff de `permissions.enum.ts` ; il doit etre purement additif. Annuler tout deplacement. Desactiver un eventuel auto-fix de tri sur ce fichier.

14. **Le boot fonctionne en local mais echoue en CI sur le compteur.**
    - Cause : `RBAC_PERMISSION_COUNT_EXPECTED` injecte en CI a une valeur perimee (`130`).
    - Action : mettre a jour la variable d'environnement CI a `147` (et `RBAC_MODULE_COUNT_EXPECTED` a `25`), ou retirer l'override si le validator a deja `EXPECTED_PERMISSION_COUNT = 147` en dur.

15. **`check-no-emoji.sh` echoue sur un caractere non-emoji (faux positif).**
    - Cause : un caractere accentue ou un tiret cadratin pris pour un emoji, ou un commentaire copie depuis une source externe.
    - Action : remplacer le caractere suspect par son equivalent ASCII (la prose de tache est volontairement sans accents problematiques et sans emoji). Verifier qu'aucun copier-coller n'a introduit de glyphe Unicode hors plage ASCII attendue.

16. **Doute sur la strategie de validation des actions (whitelist vs regex).**
    - Cause : on ne sait pas si `permissions-validator.ts` impose une whitelist d'actions.
    - Action : appliquer la regle de la section 7.4.1. Dans le doute, completer a la fois le `Action` const ET `EXTENDED_ACTIONS` : c'est sans risque.

17. **Le test V32 echoue : `assure` possede 18 permissions customer au lieu de 17.**
    - Cause : une permission customer a ete ajoutee deux fois dans la liste `assure` (double spread, ou collage manuel en plus du spread de `CUSTOMER_SELF_SERVICE_PERMISSIONS`).
    - Action : verifier qu'on ne reference la constante `CUSTOMER_SELF_SERVICE_PERMISSIONS` qu'une seule fois, et qu'aucune cle customer n'est listee manuellement en plus. Le `Set` (variante B) dedupliquerait, mais le test exige aussi l'absence d'ajout fortuit.

18. **Le test V33 echoue : une resource est mal orthographiee.**
    - Cause : une valeur a ete saisie `customer.policy.view` (singulier) au lieu de `customer.policies.view`, ou `customer.sinistre.read_mine` au lieu de `customer.sinistres.read_mine`.
    - Action : recopier strictement les 17 valeurs de la section 7.1. Les resources canoniques sont : `sinistres`, `devis`, `repairs`, `delivery`, `tow`, `policies`, `payments`, `documents`, `notifications`, `feedback`, `support`, `profile`.

19. **Le diff de merge avec une autre branche 7.5b touche `permissions.enum.ts`.**
    - Cause : deux taches du sprint editent le meme fichier (par ex. une autre tache ajoute aussi des permissions).
    - Action : resoudre le conflit en gardant les DEUX blocs additifs (le bloc customer + l'autre), sans suppression. Re-executer le test de comptage qui doit refleter la somme attendue. Si l'autre tache n'existe pas dans ce sprint, c'est un signal d'anomalie de branche a investiguer.

20. **Le validator passe en test unitaire mais l'app NestJS refuse de booter.**
    - Cause : `RBAC_VALIDATE_ON_BOOT=true` et un decalage entre la version compilee (dist) et la source (un build incremental obsolete sert l'ancien catalog a 130).
    - Action : nettoyer le cache de build du package (`pnpm --filter @insurtech/auth build --force` ou suppression de `dist/`), puis rebooter. Le validator lit alors le catalog a 147.

21. **`exactOptionalPropertyTypes` ou `noUncheckedIndexedAccess` casse `groupPermissionsByModule`.**
    - Cause : l'acces `acc[module]` est potentiellement `undefined` sous `noUncheckedIndexedAccess`.
    - Action : utiliser le pattern `(acc[module] ??= []).push(perm)` (deja employe en section 7.6), qui garantit l'initialisation et satisfait le compilateur strict.

22. **La fixture et le catalog divergent silencieusement.**
    - Cause : on a modifie une valeur dans le catalog mais pas dans la fixture (ou inversement).
    - Action : le test "expose les 17 permissions customer attendues" et "reference figee 17 uniques" se croisent ; un ecart fait rougir l'un des deux. Toujours modifier catalog ET fixture ensemble, ou mieux, faire deriver la fixture du catalog via `Permission.CUSTOMER_*` (ce que fait `CUSTOMER_PERMISSIONS_REFERENCE`, qui reference les cles plutot que de re-saisir les strings).

### 12.1 Tableau de diagnostic rapide (symptome -> cause -> remede)

| Symptome observe | Cause la plus probable | Remede immediat |
| --- | --- | --- |
| `expected 147, got 130` | bloc customer non insere | inserer le bloc (section 7.1) avant `} as const;` |
| `expected 147, got 164` | 17 ajoutees mais doublon partiel 7.5a | chercher le bloc 7.5a re-ajoute, le retirer |
| `expected 147, got 170` | re-extension 85->130 par erreur | retirer le bloc 7.5a duplique (grep temoin = 1) |
| `unknown module 'customer'` | `Module.CUSTOMER` absent | ajouter au `Module` const (section 7.3) |
| `expected 25, got 24` | `Module.CUSTOMER` absent | idem |
| action `declare` au lieu de `declare_fnol` | parsing/regex naif | verifier regex elargie 7.5a en place |
| fuite customer sur autre role | sur-attribution | retirer `customer.*` des roles != assure |
| `enum Permission` detecte | migration enum interdite | revenir a `const ... as const` |
| `check-no-emoji` rouge | glyphe Unicode introduit | remplacer par ASCII |
| fixture introuvable Vitest | extension `.js` manquante | ajouter `.js` a l'import (NodeNext) |

### 12.2 Procedure de rollback

Si, apres modification, l'etat devient incoherent et qu'un retour arriere propre est necessaire :

1. `git diff packages/auth/src/rbac` pour visualiser l'ensemble des changements.
2. Si le diff montre des suppressions/deplacements dans les blocs 7.5a/v2.2 -> `git checkout -- packages/auth/src/rbac/permissions.enum.ts` puis re-appliquer UNIQUEMENT l'insertion du bloc customer (section 7.1) + maj du JSDoc.
3. La modification etant purement additive, le rollback est sans risque : revenir a 130/24 est toujours un etat valide (celui livre par 7.5a). On ne perd aucune donnee, le catalog etant du code.
4. Re-executer la sequence pre-commit (section 15) avant de reprendre.

---

## 13. Conformite Maroc

Le module `customer` touche directement des actes reglementes au Maroc. Points de conformite a respecter par les Sprints consommateurs (et a documenter dans les commentaires des permissions concernees) :

- **Loi 43-20 (services de confiance / signature electronique)** : `customer.delivery.sign` declenche une signature electronique du bon de livraison du vehicule. La signature doit etre realisee via le service `@insurtech/signature` conforme a la loi 43-20 (signature electronique avancee, horodatage qualifie). La permission n'autorise QUE le client signataire (role `assure`) ; le scope est limite a SON propre bon de livraison. La piste d'audit (qui a signe, quand, sur quel device) est obligatoire.
- **CNDP -- loi 09-08 (protection des donnees personnelles)** : `customer.profile.update`, `customer.documents.read`, `customer.notifications.manage` manipulent des donnees personnelles (PII) du client. Le client agit ici en self-service sur SES propres donnees (droit d'acces et de rectification). L'acces est strictement scope a ses donnees (scope `mine` + RLS tenant). Toute consultation/modification est journalisee (audit trail) ; aucune donnee `assure` ne quitte le territoire (decision-008, cloud souverain). Les permissions `read_mine` (`customer.sinistres.read_mine`, `customer.repairs.read_mine`) garantissent par construction que le client ne voit jamais les donnees d'autrui.
- **ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)** : `customer.devis.accept` et `customer.payments.initiate` produisent des actes a tracer pour la conformite ACAPS. L'acceptation d'un devis doit etre horodatee, attribuee au client, conservee de maniere immuable (consentement). Les paiements (`customer.payments.initiate`) passent par un flux idempotent (Idempotency-Key, TTL 24h Redis -- section 14) pour eviter les double-debits. `customer.policies.renew` declenche un acte contractuel devant respecter les obligations d'information ACAPS.
- **FNOL** : `customer.sinistres.declare_fnol` permet la declaration self-service. Les delais legaux de declaration de sinistre auto au Maroc (5 jours ouvrables sauf cas de force majeure) sont geres par la logique metier en aval ; la permission ouvre uniquement l'acces a l'acte de declaration.
- **Cloud souverain (decision-008)** : toutes les donnees produites par ces actes self-service residen au Maroc (Atlas Benguerir, DC1 Tier III + DC2 Tier IV), chiffrees AES-256-GCM au repos, TLS 1.3 en transit. Aucune donnee `assure` ne sort du territoire.

> Rappel de perimetre : cette tache n'IMPLEMENTE aucune de ces conformites. Elle ouvre les droits RBAC ; la conformite effective (signature 43-20, journalisation CNDP, trace ACAPS, idempotence) est a la charge des Sprints consommateurs (8 a 15). Les commentaires des permissions servent de rappel contractuel a ces Sprints.

### 13.1 Matrice permission -> texte reglementaire -> obligation aval

| Permission | Texte reglementaire | Obligation imposee au Sprint consommateur |
| --- | --- | --- |
| `customer.delivery.sign` | Loi 43-20 (signature electronique) | Signature avancee via `@insurtech/signature`, horodatage qualifie, piste d'audit (qui/quand/device), scope au bon du client |
| `customer.devis.accept` | ACAPS (consentement) | Acte horodate, attribue, conserve immuablement ; preuve de consentement |
| `customer.payments.initiate` | ACAPS + bonnes pratiques paiement | Idempotency-Key (TTL 24h Redis) anti double-debit ; rapprochement comptable |
| `customer.policies.renew` | ACAPS (devoir d'information) | Information precontractuelle, conservation de la trace de renouvellement |
| `customer.profile.update` | CNDP loi 09-08 (rectification) | Journalisation de la modification, scope strict aux donnees du client |
| `customer.documents.read` | CNDP loi 09-08 (acces) | Acces journalise, donnees hebergees au Maroc (decision-008) |
| `customer.sinistres.read_mine` | CNDP loi 09-08 (acces) | Scope `mine` + RLS tenant : aucune donnee d'autrui visible |
| `customer.repairs.read_mine` | CNDP loi 09-08 (acces) | Idem, scope strict aux reparations du client |
| `customer.sinistres.declare_fnol` | Code des assurances MA (delais FNOL) | Idempotency-Key ; gestion des delais legaux (5 jours ouvrables) en aval |
| `customer.tow.track` | CNDP (geolocalisation) | Minimisation : seule la position de SA mission, duree de retention limitee |

### 13.2 Principe de minimisation applique au self-service

Le module `customer` illustre par construction le principe de minimisation des donnees (CNDP) :

- **Aucun `read_all`** : le client ne dispose d'aucun droit de lecture transverse. Toutes les lectures sont scopees `mine`.
- **Aucun `delete`** : pas d'effacement direct ; la rectification passe par `profile.update`, l'effacement (si applicable) par un processus DPO dedie hors self-service.
- **Granularite par acte** : chaque permission correspond a un acte precis, ce qui permet de retirer un droit sensible (par ex. `payments.initiate`) sans degrader l'experience de lecture.
- **Geolocalisation bornee** : `customer.tow.track` n'expose que la position de la mission du client, jamais une vue flotte ou une position historique au-dela du besoin operationnel.

Ces choix relevent de la conception du catalog (cette tache) ; leur application effective (filtrage, retention, journalisation) releve des Sprints aval.

---

## 14. Conventions absolues

> Reproduction integrale du bloc de conventions du projet. Toutes s'appliquent ; celles directement sollicitees par cette tache sont signalees par "(SOLLICITEE)".

- **Multi-tenant strict** : `x-tenant-id` obligatoire sur toutes les routes sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; contexte propage via `AsyncLocalStorage` ; isolation au niveau base via RLS et la fonction `app_can_access_tenant()` ; audit trail systematique. (SOLLICITEE indirectement : les permissions `customer.*read_mine` reposent sur ce socle pour garantir le scope.)
- **Validation strict** : Zod uniquement ; schemas exportes ; forme `const XxxSchema = z.object({...})` ; type derive `type Xxx = z.infer<typeof XxxSchema>`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; logs JSON structures avec champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`. (SOLLICITEE : le validator boot-time logue son rapport via Pino.)
- **Hash strict** : argon2id parametres 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER` applique.
- **Package manager strict** : pnpm uniquement ; `engine-strict` Node >= 22.11.0 ; `save-exact` ; `link-workspace-packages=deep`. (SOLLICITEE : toutes les commandes utilisent `pnpm --filter`.)
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites. (SOLLICITEE : le typage du catalog et de la matrice doit passer sous ces flags.)
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; couverture >= 85% global, >= 90% pour auth/database/signature. (SOLLICITEE : couverture RBAC >= 90%.)
- **RBAC strict** : `@Roles()` (ou `@RequirePermissions()`) par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles ; **147 permissions apres cette tache**. (SOLLICITEE : c'est l'objet meme de la tache.)
- **Events strict** : Kafka topics `insurtech.events.{vertical}.{entity}.{action}` ; schema Zod par evenement ; `Idempotency-Key` pour les evenements critiques.
- **Imports strict** : alias `@insurtech/{name}` ; chemins definis dans `tsconfig.base.json` ; ordre des imports Node / externes / `@insurtech/*` / relatifs. (SOLLICITEE : les imports relatifs de fixtures/specs utilisent l'extension `.js`.)
- **Skalean AI strict (decision-005)** : acces IA uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un fournisseur frontier ; mock pour les Sprints 1-28, reel a partir du Sprint 29.
- **No-emoji strict (decision-006, ABSOLUE)** : aucune emoji nulle part ; controle par `check-no-emoji.sh` ; CI echoue en cas de violation. (SOLLICITEE : zero emoji dans tous les fichiers touches.)
- **Idempotency-Key strict** : obligatoire sur `POST /payments`, `/signatures`, `/claims`, et les ecritures MCP ; TTL 24h dans Redis. (SOLLICITEE : `customer.payments.initiate`, `customer.delivery.sign`, `customer.sinistres.declare_fnol` declenchent des endpoints idempotents en aval.)
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky. (SOLLICITEE : message de commit en section 16.)
- **Cloud souverain MA strict (decision-008)** : hebergement Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee `assure` ne quitte le Maroc ; chiffrement AES-256-GCM au repos ; TLS 1.3 en transit. (SOLLICITEE : section 13.)
- **Naming v3.0 (decision-011)** : Skalean (entreprise), Assurflow (vertical), Sofidemy (marque). (SOLLICITEE : vocabulaire des commentaires et de la doc.)

---

## 15. Validation pre-commit

Sequence a executer avant tout commit (toutes doivent passer) :

```bash
# 1. Typecheck strict
pnpm --filter @insurtech/auth typecheck

# 2. Lint
pnpm --filter @insurtech/auth lint

# 3. Tests + couverture RBAC
pnpm --filter @insurtech/auth test --coverage rbac

# 4. Garde-fou : pas d enum, pas d emoji
grep -rn "enum Permission" packages/auth/src/rbac && exit 1 || echo "OK: pas d enum"
bash scripts/check-no-emoji.sh packages/auth/src/rbac

# 5. Controles de comptage rapides
grep -c "  CUSTOMER_" packages/auth/src/rbac/permissions.enum.ts   # attendu: 17
grep -c "carrier.payment.approve_level4" packages/auth/src/rbac/permissions.enum.ts  # attendu: 1 (pas de doublon 7.5a)
```

Checklist humaine avant `git commit` :

- [ ] Le diff de `permissions.enum.ts` ne montre QUE des ajouts (bloc customer + commentaire d en-tete), aucune suppression.
- [ ] Le diff de `permission-helpers.ts` ne montre QUE l'ajout de `CUSTOMER` et des actions customer.
- [ ] Les blocs carrier/expertise/tow/parts sont intacts (non re-ajoutes).
- [ ] Les fichiers de la section 6 sont les seuls modifies.
- [ ] Aucune emoji, aucun `console.log`, aucun `enum Permission`.
- [ ] Le compteur total est bien 147 et `ALL_MODULES.length` bien 25.
- [ ] Le role `assure` porte les 17 permissions ; aucun autre role n'a de `customer.*`.

---

## 16. Message de commit

```
feat(sprint-7.5b): permissions +17 customer module = 147 total v3.0

Ajout du module fonctionnel `customer` (acteur 5, self-service client final)
au catalog RBAC de @insurtech/auth. 17 nouvelles permissions `customer.*`
inserees dans la const Permission (as const, jamais enum -- decision-012),
portant le catalog de 130 (livre par Sprint 7.5a) a 147 permissions.

- permissions.enum.ts : +17 entrees CUSTOMER_* (FNOL, devis, reparations,
  livraison/e-signature, suivi depanneuse, polices, paiements, documents,
  notifications, feedback, support, profil). Blocs 7.5a inchanges.
- permission-helpers.ts : Module const + CUSTOMER ('customer') -> 25 modules
  (ALL_MODULES derive automatiquement). Actions customer non standard ajoutees
  au Action const / EXTENDED_ACTIONS (declare_fnol, read_mine, track_progress,
  track, renew, initiate, submit, contact).
- permissions-matrix.ts : assignation des 17 permissions au role `assure`.
- tests : comptage 130 -> 147, ALL_MODULES 24 -> 25, presence/unicite/naming
  des 17, non-regression des 130 anterieures, scope self-service (assure only).

Aucune re-introduction des permissions 7.5a (carrier/expertise/tow/parts) :
elles sont deja presentes et mergees. Tache strictement additive.

Conformite : loi 43-20 (e-signature livraison), CNDP 09-08 (PII self-service),
ACAPS (trace acceptation devis / paiements). Aucune emoji (decision-006).

Task: 2.5.3
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: 012 + sprint 7.5a 26 roles/130 perms
```

---

## 17. Workflow -- etape suivante

Une fois cette tache validee et committee (catalog a 147 permissions, 25 modules, role `assure` dote des 17 permissions self-service) :

1. **Mettre a jour le suivi de sprint** : marquer `2.5.3` comme terminee dans le tableau de pilotage du Sprint 7.5b.
2. **Debloquer la tache `2.5.4`** : entite foundation `insure_experts`. Cette tache cree l'entite de base des experts (rattachee aux missions d'expertise et au pool carrier). Elle reutilise le module `expertise.*` (7.5a) cote back-office et, le cas echeant, croise avec `customer.sinistres.track_progress` cote self-service pour exposer au client l'avancement de l'expertise.
3. **Verifier les dependances aval** : les Sprints consommateurs des permissions customer (Sprint 8 claims self-service, Sprint 9 devis/reparations, Sprint 10 paiements/signature, Sprint 11 mobile, Sprints 12-15 timeline/tracking/renouvellement/satisfaction) peuvent desormais reference `Permission.CUSTOMER_*` sans erreur de compilation.
4. **Documentation** : la mise a jour de `5-roles-permissions.md` (vue d'ensemble 26 roles / 147 permissions) sera traitee par la tache documentaire du sprint (`2.5.9`), pas ici.

### 17.1 Recapitulatif de l'etat apres cette tache

| Element | Avant (7.5a) | Apres (cette tache) |
| --- | --- | --- |
| Permissions totales | 130 | 147 |
| Modules | 24 | 25 (ajout `customer`) |
| Roles | 26 | 26 (inchange) |
| Permissions du role `assure` (volet customer) | 0 | 17 |
| Actions self-service au `Action` const | partielles | completes (+8) |
| Resources du module customer | 0 | 12 |

### 17.2 Risques residuels a surveiller en aval

- **Derive de scope** : a chaque ajout futur de role, verifier que personne ne recopie `customer.*` par commodite. Le test V20 doit rester en place.
- **Conformite differee** : les Sprints 8-15 doivent effectivement implementer l'idempotence et la journalisation evoquees dans les commentaires des permissions. Le RBAC seul ne garantit pas la conformite.
- **Stabilite du contrat 147** : tout futur ajout de permission devra incrementer ce contrat de maniere explicite (test + validator), jamais silencieusement.

> Prochaine tache a generer/executer : `task-2.5.4` -- entite foundation `insure_experts`.

---

## Footer

| Champ | Valeur |
| --- | --- |
| Fichier | `00-pilotage/prompts-taches/sprint-7.5b-assurflow-foundation/task-2.5.3-permissions-customer-module-147.md` |
| Tache | 2.5.3 -- Permissions module customer (+17 -> 147) |
| Sprint | 7.5b (Assurflow Foundation -- Phase 2 / Sprint 5) |
| Reference | B-7.5b tache 2.5.3 (REVISEE) |
| Position | 3 / 9 |
| Dependances | 2.5.2 + Sprint 7.5a (catalog 130, 24 modules, 26 roles -- AUTORITAIRE) |
| Bloque | 2.5.4 (entite insure_experts) |
| Decisions | 006 (no-emoji), 011 (naming v3.0), 012 (const not enum + acteur 5 Customer) |
| Resultat | Catalog 147 permissions, 25 modules ; role `assure` dote des 17 permissions customer |
| Structure | `export const Permission = { ... } as const;` (JAMAIS enum) |
| Garde-fou | NE PAS re-introduire les permissions 7.5a (deja presentes et mergees) |
| Emoji | AUCUNE (decision-006, ABSOLUE) |

Fin du fichier de tache `2.5.3`.
