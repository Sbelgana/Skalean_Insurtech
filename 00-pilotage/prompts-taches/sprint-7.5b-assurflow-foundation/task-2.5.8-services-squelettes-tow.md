# Task 2.5.8 — Services squelettes @insurtech/tow (signatures contractuelles)

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5b (Phase 2 / Sprint 5 du programme Assurflow) |
| Reference programme | B-7.5b tache 2.5.8 |
| Phase | 2 (Foundation verticale Tow / depannage) |
| Priorite | P0 (bloquant chaine de livraison API) |
| Effort estime | 1h |
| Dependances | 2.5.7 (scaffolding package + tsconfig + vitest config @insurtech/tow) |
| Bloque | 2.5.9 (documentation extension paths + tests integration) |
| Densite cible | 80-150 ko |
| Vertical | Assurflow (decision-011) |
| Editeur | Skalean (decision-011) |
| Marque commerciale | Sofidemy (decision-011) |
| Decisions appliquees | 005, 006, 008, 011, 012 |
| Conformite | Loi 17-99 (Code des assurances Maroc), loi 09-08 / CNDP (donnees personnelles + geolocalisation) |
| Contrainte absolue | AUCUNE EMOJI (decision-006) |

---

## 1. Header

Cette tache produit les **trois fichiers de service squelettes** du package `@insurtech/tow` (vertical depannage / remorquage d'Assurflow), dans `repo/packages/tow/src/services/` :

- `tow-operators.service.ts` — gestion du cycle de vie des operateurs de depannage (onboarding, KYB, disponibilite, suspension, recherche).
- `tow-missions.service.ts` — moteur de missions de remorquage type Uber (designation, acceptation, refus, transitions d'etat, annulation, listing).
- `tow-honoraires.service.ts` — calcul et facturation des honoraires de depannage (calcul distance + type camion, lecture des gains, facturation).

Chaque service est une classe NestJS `@Injectable` exposant des **signatures de methodes completes et typees** (issues des types livres par la tache 2.5.2), mais dont les corps **journalisent via PinoLogger puis lèvent `NotImplementedException`**. L'implementation reelle est **deferee au Sprint 22.5** (decision-012 : contract-first / squelettes contractuels). Cette tache met aussi a jour le barrel `index.ts` du package pour exporter les trois services et un `TowModule` (`@Module`) squelette.

Le but n'est PAS d'implementer la logique metier mais de **figer les contrats d'interface** afin que l'API gateway, les controleurs et les consommateurs aval puissent se cabler contre des signatures stables des maintenant, alors que le moteur de missions (machine a etats 9 statuts) ne sera construit qu'au Sprint 22.5.

---

## 2. But

Livrer un **contrat d'interface executable et type** pour les trois services du vertical Tow, de sorte que :

1. Les signatures des methodes (parametres, types de retour `Promise<T>`) sont **definitives** et alignees sur les types `@insurtech/tow` livres en 2.5.2.
2. Chaque methode **compile** en TypeScript strict (`tsc --noEmit` vert) et **passe le lint** sans logique metier.
3. Chaque methode **journalise un evenement structure** (PinoLogger, jamais `console.log`) puis **lève `NotImplementedException`** dont le message **nomme explicitement le sprint et la tache future** d'implementation.
4. Le barrel `index.ts` **exporte** les trois services et un `TowModule` `@Module` squelette injectable dans l'application NestJS.
5. Une suite de tests Vitest verifie que **chaque service est defini** et que **chaque methode lève `NotImplementedException`** (le contrat « non implemente » est lui-meme teste, ce qui garantit qu'aucune implementation accidentelle ne fuite avant le Sprint 22.5).

Resultat attendu : `pnpm --filter @insurtech/tow build`, `... typecheck`, `... lint` et `... test` sont **tous verts**, et le package expose un module NestJS importable, sans aucune dette de typage ni emoji.

### 2.1 Ce que cette tache N'EST PAS

Pour eviter toute derive de perimetre, cette tache **exclut explicitement** :

- Toute logique metier (matching, machine a etats, calcul de tarif, persistance, evenements Kafka, notifications). DEFEREE Sprint 22.5.
- Toute creation de controleur HTTP `/api/v1/tow/*`. Ce sont les controleurs cote `@insurtech/api` qui consommeront les services ; ils ne sont pas dans ce package.
- Toute migration de base de donnees ou entite TypeORM/Prisma. Les entites sont d'autres taches.
- Toute configuration de `LoggerModule` nestjs-pino (responsabilite de l'app hote).
- Tout test d'integration NestJS (`Test.createTestingModule`). DEFERE a la tache 2.5.9.
- Toute documentation des extension paths au-dela des annexes de ce fichier. DEFEREE a 2.5.9.

### 2.2 Criteres d'acceptation narratifs

La tache est acceptee si un relecteur peut, sans contexte additionnel :

1. Ouvrir chacun des 3 services et constater que chaque methode a la **signature exacte** de la section 7, une **JSDoc** decrivant le comportement futur + le sprint, un **log structure** et un **throw NotImplementedException** au message conforme a la table 9.2.
2. Lancer la suite de tests et voir **>= 22 it() verts** prouvant que chaque service est defini et que chaque methode lève.
3. Importer `TowModule` dans une application NestJS de test et constater que les 3 services sont **resolvables** (validation reelle en 2.5.9).
4. Executer `check-no-emoji.sh` et obtenir un **exit 0**.

---

## 3. Contexte etendu

### 3.1 Pourquoi des squelettes maintenant (contract-first)

Le vertical Tow d'Assurflow est un **moteur de missions de depannage de type Uber** : un assureur (carrier) declenche une mission de remorquage suite a un sinistre auto, le systeme designe un operateur de depannage disponible et geolocalise, l'operateur accepte ou refuse, puis la mission progresse a travers une **machine a etats a 9 statuts** jusqu'au paiement des honoraires. Cette mecanique temps-reel (matching geographique, push notifications, transitions concurrentes, idempotence) est **lourde** et planifiee pour le **Sprint 22.5**.

Or, plusieurs chantiers **amont** ont besoin des contrats **maintenant**, bien avant le Sprint 22.5 :

- L'**API gateway** et les **controleurs HTTP** (`@insurtech/api`) doivent cabler des endpoints `/api/v1/tow/*` contre des signatures de service stables pour generer la documentation OpenAPI et les clients TypeScript.
- Les **consommateurs aval** (tableau de bord assureur, app operateur, module comptabilite honoraires) doivent connaitre les formes de retour (`TowMission`, `TowOperator`, structure honoraire `{ baseMad, extrasMad, totalMad }`) pour leurs propres types et maquettes.
- L'**injection de dependances NestJS** (`TowModule`) doit etre cablable dans l'`AppModule` afin que les tests d'integration (tache 2.5.9) verifient le wiring du conteneur DI sans attendre la logique metier.

La strategie **contract-first** consiste donc a livrer des squelettes : signatures completes + types definitifs, corps `NotImplementedException`. Le code amont compile et se teste contre une surface d'API figee ; le code metier est rempli plus tard sans casser les appelants. C'est la **decision-012** : « squelettes contractuels avec deferral explicite Sprint 22.5 ».

### 3.2 Carte de deferral (deferral map)

Chaque methode squelette pointe vers la **tache future precise** qui l'implementera au Sprint 22.5. Cette carte est la source de verite et doit etre reproduite a l'identique dans les messages `NotImplementedException` :

| Service | Methode | Sprint / Tache d'implementation | Message NotImplementedException |
|---------|---------|----------------------------------|----------------------------------|
| TowMissionsService | `designateMission` | Sprint 22.5 Tache 5.4.3 | `'Sprint 22.5 Tache 5.4.3 - designation mission (matching geographique operateur)'` |
| TowMissionsService | `acceptMission` | Sprint 22.5 Tache 5.4.6 | `'Sprint 22.5 Tache 5.4.6 - acceptation mission par operateur'` |
| TowMissionsService | `rejectMission` | Sprint 22.5 Tache 5.4.6 | `'Sprint 22.5 Tache 5.4.6 - refus mission par operateur'` |
| TowMissionsService | `transitionStatus` | Sprint 22.5 Tache 5.4.7-10 | `'Sprint 22.5 Tache 5.4.7-10 - machine a etats 9 statuts'` |
| TowMissionsService | `cancelMission` | Sprint 22.5 | `'Sprint 22.5 - annulation mission (regles de penalite)'` |
| TowMissionsService | `listMyMissions` | Sprint 22.5 Tache 5.4.5 | `'Sprint 22.5 Tache 5.4.5 - listing missions operateur'` |
| TowOperatorsService | `onboardOperator` | Sprint 22.5 | `'Sprint 22.5 - onboarding operateur depannage'` |
| TowOperatorsService | `approveKyb` | Sprint 22.5 | `'Sprint 22.5 - validation KYB operateur'` |
| TowOperatorsService | `rejectKyb` | Sprint 22.5 | `'Sprint 22.5 - rejet KYB operateur'` |
| TowOperatorsService | `toggleAvailability` | Sprint 22.5 | `'Sprint 22.5 - bascule disponibilite operateur'` |
| TowOperatorsService | `suspendOperator` | Sprint 22.5 | `'Sprint 22.5 - suspension operateur'` |
| TowOperatorsService | `searchOperators` | Sprint 22.5 | `'Sprint 22.5 - recherche operateurs (filtres geo + dispo)'` |
| TowHonorairesService | `computeHonoraire` | Sprint 22.5 | `'Sprint 22.5 - calcul distance + type camion'` |
| TowHonorairesService | `readEarnings` | Sprint 22.5 | `'Sprint 22.5 - lecture gains operateur par periode'` |
| TowHonorairesService | `invoiceHonoraire` | Sprint 22.5 | `'Sprint 22.5 - facturation honoraire mission'` |

### 3.3 Conception de `transitionStatus` (machine a etats 9 statuts)

La methode `transitionStatus(missionId, newStatus, payload?)` est le **coeur du moteur de missions**, mais sa logique n'est PAS implementee ici. Le squelette **fige uniquement sa signature**. Pour memoire (utile a la JSDoc), la machine a etats cible au Sprint 22.5 comporte **9 statuts** (`TowMissionStatus`) :

```
PENDING_DESIGNATION -> DESIGNATED -> ACCEPTED -> EN_ROUTE -> ON_SITE
   -> LOADED -> IN_TRANSIT -> DELIVERED -> COMPLETED
                       \-> REJECTED (depuis DESIGNATED)
                       \-> CANCELLED (depuis tout statut non terminal)
```

Les transitions valides, les gardes (qui peut declencher quoi), les effets de bord (notifications, ecriture audit, evenements Kafka `insurtech.events.tow.mission.*`) et l'idempotence (`Idempotency-Key`) seront entierement traites aux taches 5.4.7-10 du Sprint 22.5. Ici, `transitionStatus` se contente de journaliser `{ action: 'tow.mission.transition', missionId, newStatus }` puis de lever `NotImplementedException('Sprint 22.5 Tache 5.4.7-10 - machine a etats 9 statuts')`.

`payload?: unknown` est intentionnellement non type a ce stade : la forme du payload depend du statut cible (ex. coordonnees GPS pour `ON_SITE`, photo de chargement pour `LOADED`) et sera modelisee par un type union discrimine au Sprint 22.5. Le `?` respecte `exactOptionalPropertyTypes`.

### 3.4 NotImplementedException comme contrat teste

Le choix de lever `NotImplementedException` (et non, par exemple, de retourner `Promise.resolve(null as any)` ou un mock) est **deliberE** : c'est un **contrat verifiable**. Les tests (.spec.ts) assertent `await expect(service.method(...)).rejects.toThrow(NotImplementedException)`. Cela garantit :

1. **Aucune fuite d'implementation accidentelle** avant le Sprint 22.5 : si quelqu'un implemente partiellement une methode, le test « doit lever NotImplementedException » casse et signale que la tache 2.5.8 a ete violee hors planning.
2. **Une trace observable en production/staging** : si un endpoint amont appelle par erreur une methode non implementee, le log structure `{ action }` + le code HTTP 501 (NestJS mappe `NotImplementedException` -> 501 Not Implemented) rendent l'incident immediatement diagnosticable.
3. **Un point d'ancrage pour le remplacement** : au Sprint 22.5, l'implementeur remplace le corps `log + throw` par la logique reelle, et met a jour le test correspondant. Le diff est chirurgical.

### 3.5 Alternatives considerees

- **(A) Ne rien livrer avant le Sprint 22.5.** Rejete : bloque l'API gateway et les consommateurs aval pendant 15 sprints, casse le contract-first.
- **(B) Interfaces TypeScript pures (pas de classes).** Rejete : NestJS DI fonctionne par classes injectables (`@Injectable` + token de provider). Une interface ne peut etre injectee sans token custom verbeux et n'est pas runtime-testable.
- **(C) Methodes retournant des donnees mockees.** Rejete : un mock qui « marche a moitie » masque l'absence d'implementation, induit en erreur les appelants et n'est pas distinguable d'une vraie implementation par les tests. `NotImplementedException` est explicite.
- **(D) `throw new Error('TODO')`.** Rejete : `Error` generique mappe vers 500 (erreur serveur) et non 501. `NotImplementedException` porte une semantique HTTP correcte (« fonctionnalite reconnue mais non encore disponible ») et est filtrable par classe.
- **Retenu : (D bis) classes `@Injectable` + signatures completes + `log structure` + `NotImplementedException('Sprint 22.5 ...')`.** Equilibre optimal entre stabilite du contrat, testabilite et observabilite.

#### Matrice de comparaison des alternatives

| Critere | (A) Rien | (B) Interfaces | (C) Mocks | (D) Error generique | (D bis) RETENU |
|---------|----------|----------------|-----------|----------------------|----------------|
| Debloque l'API amont | Non | Partiel | Oui | Oui | Oui |
| Injectable NestJS (DI) | N/A | Difficile | Oui | Oui | Oui |
| Testable runtime | Non | Non | Ambigu | Oui | Oui |
| Empeche fuite d'impl. | N/A | N/A | Non | Oui | Oui |
| Code HTTP correct (501) | N/A | N/A | N/A | Non (500) | Oui (501) |
| Observabilite (log structure) | Non | Non | Faible | Faible | Oui |
| Diff d'impl. futur minimal | N/A | Moyen | Faible | Bon | Bon |
| Score global | Rejete | Rejete | Rejete | Insuffisant | Retenu |

L'option (D bis) est la seule a satisfaire tous les criteres. C'est elle qui formalise la decision-012.

### 3.6 Trade-offs

- **Avantage** : surface d'API figee, code amont deblocable immediatement, diff d'implementation futur minimal.
- **Cout** : risque que les signatures soient legerement revisees au Sprint 22.5 si la conception du moteur evolue. Mitige par le fait que les types proviennent deja de 2.5.2 (modelisation faite) et que `payload?: unknown` / `filters: unknown` absorbent les inconnues.
- **Cout** : le `TowModule` squelette declare des providers qui levent a l'usage ; un developpeur distrait pourrait croire le vertical fonctionnel. Mitige par la JSDoc explicite, les messages d'exception nommant le sprint, et la documentation 2.5.9.

### 3.6 bis Registre des risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Signature revisee au Sprint 22.5 cassant les appelants | Faible | Moyen | Types issus de 2.5.2 (deja modelises) ; `unknown` pour les zones incertaines ; semver du package. |
| Endpoint amont expose en prod avant 22.5 | Moyenne | Faible | Feature flag cote API ; HTTP 501 explicite ; log warn diagnosticable. |
| Implementation partielle fuit (violation decision-012) | Faible | Moyen | Test « lève NotImplementedException » casse ; revue de PR rejette tout corps non conforme. |
| Peer dependency NestJS desalignee | Moyenne | Faible | Plage peer `^10` alignee sur la version monorepo ; pnpm warn visible. |
| Donnees sensibles dans les logs squelette | Faible | Eleve (CNDP) | Logs limites a identifiants + flags ; pas de GPS/PII (section 13.2). |
| Confusion « vertical pret » par un nouvel arrivant | Moyenne | Faible | JSDoc de statut + glossaire + FAQ + doc 2.5.9. |
| Couverture chute sous 85% | Faible | Faible | Chaque methode appelee une fois = ~100% ; alerte CI sur seuil. |
| Emoji introduite par copier-coller | Moyenne | Moyen (CI bloque) | check-no-emoji.sh en pre-commit + CI ; revue. |

### 3.7 bis Cycle de vie de la dette technique squelette

La dette « NotImplementedException » est **intentionnelle, tracee et bornee** :

- **Origine** : creee a la tache 2.5.8 (Sprint 7.5b).
- **Visibilite** : chaque message nomme le sprint de remboursement (22.5) ; un grep `NotImplementedException` recense l'ensemble de la dette du vertical.
- **Remboursement** : aux taches 5.4.3, 5.4.5-10 du Sprint 22.5 (missions), et taches associees (operateurs, honoraires).
- **Garde-fou** : les tests echouent au remboursement (le test « lève » devient faux), forcant la mise a jour synchrone du test et du corps.
- **Cloture** : la dette est entierement remboursee lorsque plus aucune methode du vertical ne lève `NotImplementedException` (un grep vide = vertical implemente).

### 3.7 Pieges nommes (a eviter absolument)

1. **Piege console.log** : utiliser `console.log`/`console.error` au lieu de `PinoLogger`. INTERDIT (decision logger strict). Toujours `this.logger.warn({ action, ... }, 'message')`.
2. **Piege oubli setContext** : ne pas appeler `this.logger.setContext(TowXService.name)` dans le constructeur -> logs sans contexte de classe.
3. **Piege Error generique** : `throw new Error(...)` au lieu de `NotImplementedException` -> mauvais code HTTP (500 au lieu de 501) et test qui n'asserte pas la bonne classe.
4. **Piege message non aligne** : message d'exception ne nommant pas le sprint/tache exact -> casse l'alignement avec la deferral map et la tracabilite.
5. **Piege import type vs runtime** : importer `TowMission` comme valeur (`import { TowMission }`) au lieu de `import type { TowMission }` -> import runtime inutile, peut casser le tree-shaking et `verbatimModuleSyntax`.
6. **Piege NotImplementedException non importe runtime** : `NotImplementedException` doit etre importe en **valeur** (`import { NotImplementedException } from '@nestjs/common'`), PAS en `import type` (on l'instancie a l'execution).
7. **Piege return manquant** : en TS strict (`noImplicitReturns`), une methode `Promise<T>` qui `throw` inconditionnellement est valide, mais si on ajoute un `if`, oublier le `throw`/`return` dans une branche casse la compilation. Garder le corps minimal : `log` puis `throw`.
8. **Piege exactOptionalPropertyTypes** : declarer `payload?: unknown` est correct ; passer `payload: undefined` explicitement a un appel peut etre refuse. Ne pas surtyper.
9. **Piege barrel circular** : `index.ts` qui importe les services qui re-importent depuis `index.ts` -> dependance circulaire. Les services importent les **types** depuis `../types/...` (chemins relatifs directs), jamais depuis le barrel.
10. **Piege TowModule sans exports** : oublier `exports: [...]` dans `@Module` -> les services ne sont pas injectables hors du module. Lister les 3 services dans `providers` ET `exports`.
11. **Piege emoji** : un seul emoji dans un commentaire ou un message fait echouer `check-no-emoji.sh` en CI (decision-006 ABSOLUE).
12. **Piege spec sans mock logger** : instancier un service sans fournir un `PinoLogger` mocke -> le constructeur echoue ou les logs polluent la sortie de test. Fournir un mock `{ setContext, info, warn, error }`.
13. **Piege ordre des arguments** : inverser `(operatorId, reviewerUserId)` dans `approveKyb` casse silencieusement la semantique sans erreur de type (les deux sont `string`). Respecter scrupuleusement l'ordre des signatures de la section 7.
14. **Piege retour `Promise<TowOperator[]>` vs `Promise<TowOperator>`** : `searchOperators` et `listMyMissions` retournent des **tableaux** ; les autres retournent une **entite unique**. Une confusion casse le typage des appelants.
15. **Piege HonoraireBreakdown non readonly** : declarer les champs sans `readonly` permet une mutation accidentelle d'un montant financier. Les trois champs sont `readonly`.
16. **Piege `unknown` traite comme `any`** : a l'implementation, ne jamais faire `(payload as any).foo` ; narrower proprement le `unknown`. Le squelette ne deballe jamais le payload.
17. **Piege oubli d'export du module** : exporter le service du barrel mais pas le `TowModule` -> l'app ne peut pas importer le module. Les deux doivent etre exportes (V17).
18. **Piege test asynchrone sans await** : appeler `service.method()` sans `await`/`return` dans un it() asynchrone -> le test se termine avant le rejet (faux positif). Toujours `await expect(...).rejects`.

### 3.8 Detail du flux metier cible (pour la JSDoc et le contexte)

Pour ancrer la comprehension de l'implementeur futur, voici le **scenario nominal complet** d'une mission de depannage Assurflow, qui sera materialise par l'enchainement des methodes squelettes au Sprint 22.5 :

1. **Declenchement (carrier)** : un agent assureur, suite a un sinistre auto declare dans le vertical Claims, declenche une demande de depannage. L'API appelle `TowMissionsService.designateMission(input, carrierUserId)`. L'input porte la reference du sinistre (`claimId`), la position GPS du vehicule en panne, le type de vehicule et la destination souhaitee (garage agree).
2. **Matching geographique (systeme)** : le moteur (Sprint 22.5) interroge l'index des operateurs disponibles via `searchOperators`-equivalent interne, calcule le meilleur candidat par proximite (rayon `TOW_MATCHING_RADIUS_KM`), cree la mission en statut `DESIGNATED` et notifie l'operateur.
3. **Reponse operateur** : l'operateur accepte (`acceptMission` -> `ACCEPTED`) ou refuse (`rejectMission` -> `REJECTED`, ce qui relance le matching vers un autre operateur).
4. **Progression terrain** : l'operateur enclenche les transitions successives via `transitionStatus` : `EN_ROUTE` (en route vers le vehicule), `ON_SITE` (arrive sur place, avec coordonnees GPS dans le payload), `LOADED` (vehicule charge, photo dans le payload), `IN_TRANSIT` (en transit vers le garage), `DELIVERED` (livre au garage), `COMPLETED` (mission terminee).
5. **Honoraires** : a la completion, `computeHonoraire(missionId)` calcule le detail `{ baseMad, extrasMad, totalMad }`, puis `invoiceHonoraire(missionId)` genere la facture et declenche le reglement. L'operateur consulte ses gains via `readEarnings(towUserId, period)`.
6. **Annulation** : a tout moment avant `COMPLETED`/`DELIVERED`, un acteur autorise peut declencher `cancelMission(missionId, reason)` (-> `CANCELLED`), avec application des regles de penalite.

Le cycle de vie **operateur** est orthogonal au cycle de vie **mission** : un operateur est d'abord enrole (`onboardOperator`), passe son KYB (`approveKyb` / `rejectKyb`), bascule sa disponibilite (`toggleAvailability`) et peut etre suspendu (`suspendOperator`). Seul un operateur `KYB_APPROVED` et `available=true` est eligible au matching. Ces regles d'eligibilite sont implementees au Sprint 22.5 ; le squelette ne fige que les points d'entree.

### 3.9 Pourquoi 3 services et non 1

La separation en trois services (`Operators`, `Missions`, `Honoraires`) suit le principe de **responsabilite unique** et anticipe l'evolution independante :

- **TowOperatorsService** : domaine « partenaire » (cycle de vie, conformite KYB). Evolue avec les exigences reglementaires operateur.
- **TowMissionsService** : domaine « operationnel temps-reel » (machine a etats, matching, notifications). Le plus complexe, susceptible d'etre decompose en sous-services au Sprint 22.5 (matching engine, state machine, notification dispatcher).
- **TowHonorairesService** : domaine « financier » (tarification, facturation, gains). Consomme par la comptabilite (Sprint 24), avec ses propres exigences de precision decimale et de transparence (loi 17-99).

Un service monolithique aurait melange trois rythmes d'evolution et trois domaines de conformite distincts, compliquant les tests, l'injection ciblee et la revue de code. Les trois restent neanmoins regroupes dans un seul `TowModule` pour un wiring DI simple cote application.

### 3.10 Reference decision-012

Decision-012 (programme Assurflow) : « Pour les verticaux dont le moteur metier est planifie tardivement (Tow Sprint 22.5), livrer des **squelettes de services contractuels** durant la phase Foundation : signatures completes typees, corps `log + NotImplementedException('Sprint <n> Tache <x>')`, module NestJS exportable. Le contrat est teste (chaque methode doit lever). Aucune logique metier avant le sprint cible. La revue de code de la PR de tache squelette REJETTE tout corps de methode contenant autre chose que le log structure suivi du throw. »

---

## 4. Architecture context

### 4.1 Position dans la chaine

Cette tache est la **8e sur 9** de la phase Foundation du vertical Tow (Sprint 7.5b). Position : **8/9**.

- 2.5.1 -> 2.5.2 : types `@insurtech/tow` (TowOperator, TowMission, TowMissionStatus, schemas Zod d'entree).
- 2.5.7 : scaffolding package (package.json, tsconfig, vitest config, dossiers `src/types`, `src/services`).
- **2.5.8 (cette tache)** : services squelettes + barrel + TowModule.
- 2.5.9 : documentation extension paths + tests d'integration (wiring DI du TowModule).

### 4.2 Schema ASCII

```
                       repo/packages/tow
                              |
        +---------------------+----------------------+
        |                     |                      |
   src/types/*          src/services/*           src/index.ts (barrel)
   (tache 2.5.2)        (CETTE TACHE 2.5.8)       (CETTE TACHE)
        |                     |                      |
        |   import type       |   export *           |
        |<--------------------+--------------------->|
        |                     |                      |
   TowOperator           TowOperatorsService    export { TowOperatorsService,
   TowMission            TowMissionsService              TowMissionsService,
   TowMissionStatus      TowHonorairesService           TowHonorairesService,
   DesignateMissionInput      |                          TowModule }
   OnboardOperatorInput       |
                              |  chaque methode :
                              |  PinoLogger.warn({action,...})
                              |  -> throw NotImplementedException('Sprint 22.5 ...')
                              |
                              v
                    +------------------------+
                    | TowModule (@Module)    |
                    | providers: 3 services  |
                    | exports:   3 services  |
                    +-----------+------------+
                                |
              importe par (AVAL, plus tard) :
                                |
   +----------------------------+-----------------------------+
   |                            |                             |
@insurtech/api            Sprint 22.5                    Sprint 24
controleurs HTTP          REMPLISSAGE logique metier      comptabilite honoraires
/api/v1/tow/*             (5.4.3, 5.4.5-10)               + reporting gains
(se cablent sur           machine a etats 9 statuts        (consomme readEarnings,
 les signatures           matching geo, Kafka events       invoiceHonoraire)
 figees ici)              idempotence
```

Le flux est **vertical** : les types descendent vers les services, les services remontent vers le barrel, le barrel expose le TowModule qui sera consomme par l'API (maintenant, contre les signatures) et rempli au Sprint 22.5 (logique), puis branche a la comptabilite Sprint 24.

### 4.3 Sequence d'un appel sur squelette (comportement actuel)

```
Client HTTP            Controleur API           TowMissionsService          PinoLogger
   |                        |                          |                         |
   |  POST /api/v1/tow/...  |                          |                         |
   |----------------------->|                          |                         |
   |                        | designateMission(input, uid)                      |
   |                        |------------------------->|                         |
   |                        |                          | warn({action,...})      |
   |                        |                          |------------------------>|
   |                        |                          |                         | (log emis)
   |                        |                          | throw NotImplemented    |
   |                        |<-------------------------|                         |
   |   HTTP 501             |                          |                         |
   |<-----------------------|                          |                         |
   |                        |                          |                         |
```

A ce stade (avant Sprint 22.5), tout appel produit un log `warn` puis un HTTP 501. Aucune mutation d'etat, aucun acces base, aucun evenement Kafka.

### 4.4 Sequence cible (apres remplacement Sprint 22.5, pour reference)

```
Client          Controleur     TowMissionsService    Repository    MatchingEngine   Kafka
  |  POST       |                    |                   |               |            |
  |------------>| designate(...)     |                   |               |            |
  |             |------------------->| info(debut)        |               |            |
  |             |                    | findCandidates()-->|               |            |
  |             |                    |                    | query operators            |
  |             |                    | pickBest()-------------------------->            |
  |             |                    | create mission --->|               |            |
  |             |                    | emit designated -------------------------------->|
  |             |                    | info(fin,duration_ms)              |            |
  |             |<-------------------| return TowMission  |               |            |
  |  201 + body |                    |                    |               |            |
  |<------------|                    |                    |               |            |
```

Cette sequence cible illustre pourquoi figer la signature `designateMission(input, carrierUserId): Promise<TowMission>` maintenant est sans risque : le type de retour `TowMission` et les arguments restent identiques entre squelette et implementation. Seul le corps change.

### 4.5 Dependances inter-packages

```
@insurtech/tow
   ^                ^
   | depend de      | consomme par (plus tard)
   |                |
@insurtech/types?   @insurtech/api (controleurs)
(types partages)    @insurtech/billing (Sprint 24, honoraires)
                    @insurtech/notifications (Sprint 22.5)
```

A ce stade, `@insurtech/tow` ne depend que de `@nestjs/common`, `nestjs-pino` et `zod` (heritage 2.5.2). Aucune dependance vers d'autres packages metier, ce qui garde le package leger et compilable isolement.

---

## 5. Livrables checkables

1. Fichier `repo/packages/tow/src/services/tow-operators.service.ts` cree.
2. Fichier `repo/packages/tow/src/services/tow-missions.service.ts` cree.
3. Fichier `repo/packages/tow/src/services/tow-honoraires.service.ts` cree.
4. Fichier `repo/packages/tow/src/services/tow-operators.service.spec.ts` cree.
5. Fichier `repo/packages/tow/src/services/tow-missions.service.spec.ts` cree.
6. Fichier `repo/packages/tow/src/services/tow-honoraires.service.spec.ts` cree.
7. Fichier `repo/packages/tow/src/tow.module.ts` cree (TowModule `@Module`).
8. Fichier `repo/packages/tow/src/index.ts` mis a jour (barrel exporte 3 services + TowModule).
9. `TowOperatorsService` est `@Injectable` et injecte `PinoLogger`.
10. `TowMissionsService` est `@Injectable` et injecte `PinoLogger`.
11. `TowHonorairesService` est `@Injectable` et injecte `PinoLogger`.
12. Chacun des 3 constructeurs appelle `this.logger.setContext(...)`.
13. `TowMissionsService` expose `designateMission`, `acceptMission`, `rejectMission`, `transitionStatus`, `cancelMission`, `listMyMissions` (6 methodes).
14. `TowOperatorsService` expose `onboardOperator`, `approveKyb`, `rejectKyb`, `toggleAvailability`, `suspendOperator`, `searchOperators` (6 methodes).
15. `TowHonorairesService` expose `computeHonoraire`, `readEarnings`, `invoiceHonoraire` (3 methodes).
16. Chaque methode journalise un objet structure `{ action, ... }` avant de lever.
17. Chaque methode lève `NotImplementedException` avec un message nommant le sprint/tache de la deferral map (section 3.2).
18. Aucun `console.log` / `console.error` nulle part (grep vide).
19. Types importes via `import type` depuis `../types/...`.
20. `NotImplementedException` importe en valeur depuis `@nestjs/common`.
21. `TowModule` declare les 3 services dans `providers` ET `exports`.
22. `pnpm --filter @insurtech/tow build` -> succes (dist genere).
23. `pnpm --filter @insurtech/tow typecheck` -> 0 erreur.
24. `pnpm --filter @insurtech/tow lint` -> 0 erreur, 0 warning.
25. `pnpm --filter @insurtech/tow test` -> tous les it() verts.
26. Au moins 22 it() repartis sur les 3 .spec.ts.
27. `nestjs-pino` et `@nestjs/common` declares en peer/dev dependencies du package.
28. AUCUNE EMOJI dans aucun fichier (check-no-emoji.sh vert).

### 5.1 Verification rapide de chaque livrable

| # | Livrable | Commande de verification | Attendu |
|---|----------|--------------------------|---------|
| 1-3 | 3 services | `ls packages/tow/src/services/*.service.ts \| wc -l` | 3 |
| 4-6 | 3 specs | `ls packages/tow/src/services/*.spec.ts \| wc -l` | 3 |
| 7 | TowModule | `test -f packages/tow/src/tow.module.ts && echo OK` | OK |
| 8 | Barrel | `grep -c "export" packages/tow/src/index.ts` | >= 5 |
| 9-11 | @Injectable | `grep -rc "@Injectable()" packages/tow/src/services` | 3 |
| 12 | setContext x3 | `grep -rc "setContext" packages/tow/src/services` | 3 |
| 13 | 6 methodes missions | `grep -cE "async (designate\|accept\|reject\|transition\|cancel\|listMy)" tow-missions.service.ts` | 6 |
| 14 | 6 methodes operators | `grep -cE "async (onboard\|approveKyb\|rejectKyb\|toggle\|suspend\|search)" tow-operators.service.ts` | 6 |
| 15 | 3 methodes honoraires | `grep -cE "async (compute\|readEarnings\|invoice)" tow-honoraires.service.ts` | 3 |
| 16 | log structure | `grep -rc "action:" packages/tow/src/services/*.service.ts` | >= 15 |
| 17 | NotImplemented x15 | `grep -rc "NotImplementedException(" packages/tow/src/services/*.service.ts` | 15 (imports inclus, ajuster) |
| 18 | aucun console | `grep -rn "console\." packages/tow/src \| wc -l` | 0 |
| 19 | import type | `grep -rc "import type" packages/tow/src/services/*.service.ts` | >= 3 |
| 22-25 | chaine CI | `pnpm --filter @insurtech/tow build && ... typecheck && ... lint && ... test` | exit 0 |

### 5.2 Definition of Done (DoD)

La tache est consideree TERMINEE lorsque :

- Les 9 fichiers (8 listes section 6 + spec inclus) existent avec le contenu specifie.
- La chaine `build && typecheck && lint && test` retourne exit 0.
- Les 38 criteres V1-V38 sont satisfaits (>= 15 P0, >= 8 P1, >= 5 P2 atteints).
- `check-no-emoji.sh` est vert.
- Le commit suit la convention (section 16) et passe commitlint.
- Aucune logique metier n'est presente (chaque corps = log + throw uniquement).

---

## 6. Fichiers crees / modifies

| Fichier | Action | Description |
|---------|--------|-------------|
| `repo/packages/tow/src/services/tow-operators.service.ts` | Cree | TowOperatorsService (6 methodes squelettes) |
| `repo/packages/tow/src/services/tow-missions.service.ts` | Cree | TowMissionsService (6 methodes squelettes) |
| `repo/packages/tow/src/services/tow-honoraires.service.ts` | Cree | TowHonorairesService (3 methodes squelettes) |
| `repo/packages/tow/src/services/tow-operators.service.spec.ts` | Cree | Tests Vitest TowOperatorsService |
| `repo/packages/tow/src/services/tow-missions.service.spec.ts` | Cree | Tests Vitest TowMissionsService |
| `repo/packages/tow/src/services/tow-honoraires.service.spec.ts` | Cree | Tests Vitest TowHonorairesService |
| `repo/packages/tow/src/tow.module.ts` | Cree | TowModule @Module squelette |
| `repo/packages/tow/src/index.ts` | Modifie | Barrel : export des 3 services + TowModule |
| `repo/packages/tow/package.json` | Modifie | Ajout nestjs-pino + @nestjs/common (peer/dev) |

---

## 7. Code patterns complets

### 7.1 `src/services/tow-operators.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { TowOperator } from '../types/tow-operator.types';
import type { OnboardOperatorInput, SearchOperatorsFilters } from '../types/tow-operator.schemas';

/**
 * TowOperatorsService — gestion du cycle de vie des operateurs de depannage
 * du vertical Assurflow Tow.
 *
 * STATUT : SQUELETTE CONTRACTUEL (decision-012).
 * La logique metier reelle est deferee au Sprint 22.5. Chaque methode
 * journalise un evenement structure via PinoLogger puis lève
 * NotImplementedException dont le message nomme le sprint d'implementation.
 *
 * Conformite : la validation KYB (Know Your Business) des operateurs et
 * l'enrolement geolocalise sont soumis a la loi 09-08 / CNDP (donnees
 * personnelles + geolocalisation) ; ces controles sont appliques a
 * l'implementation, pas au niveau du squelette.
 */
@Injectable()
export class TowOperatorsService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(TowOperatorsService.name);
  }

  /**
   * Enrole un nouvel operateur de depannage (creation + dossier KYB initial).
   *
   * Comportement futur (Sprint 22.5) : valide l'input (schema Zod
   * OnboardOperatorInput), cree l'operateur en statut KYB_PENDING, declenche
   * l'evenement insurtech.events.tow.operator.onboarded, ecrit l'audit trail.
   *
   * @param input        Donnees d'enrolement validees (raison sociale, flotte, zone).
   * @param currentUserId Identifiant de l'utilisateur (carrier admin) qui enrole.
   * @returns L'operateur cree (statut KYB_PENDING).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async onboardOperator(input: OnboardOperatorInput, currentUserId: string): Promise<TowOperator> {
    this.logger.warn(
      { action: 'tow.operator.onboard', currentUserId, raisonSociale: input.raisonSociale },
      'TowOperatorsService.onboardOperator appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - onboarding operateur depannage');
  }

  /**
   * Valide le dossier KYB d'un operateur (passage KYB_PENDING -> KYB_APPROVED).
   *
   * Comportement futur (Sprint 22.5) : verifie les pieces KYB, marque
   * l'operateur approuve, autorise sa mise en disponibilite.
   *
   * @param operatorId     Identifiant de l'operateur a approuver.
   * @param reviewerUserId Identifiant de l'agent de conformite qui valide.
   * @returns L'operateur mis a jour (statut KYB_APPROVED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async approveKyb(operatorId: string, reviewerUserId: string): Promise<TowOperator> {
    this.logger.warn(
      { action: 'tow.operator.kyb.approve', operatorId, reviewerUserId },
      'TowOperatorsService.approveKyb appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - validation KYB operateur');
  }

  /**
   * Rejette le dossier KYB d'un operateur (passage KYB_PENDING -> KYB_REJECTED).
   *
   * Comportement futur (Sprint 22.5) : enregistre le motif de rejet, notifie
   * l'operateur, empeche toute disponibilite.
   *
   * @param operatorId     Identifiant de l'operateur a rejeter.
   * @param reviewerUserId Identifiant de l'agent de conformite qui rejette.
   * @param reason         Motif du rejet (audit + notification).
   * @returns L'operateur mis a jour (statut KYB_REJECTED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async rejectKyb(operatorId: string, reviewerUserId: string, reason: string): Promise<TowOperator> {
    this.logger.warn(
      { action: 'tow.operator.kyb.reject', operatorId, reviewerUserId, reason },
      'TowOperatorsService.rejectKyb appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - rejet KYB operateur');
  }

  /**
   * Bascule la disponibilite d'un operateur (en ligne / hors ligne).
   *
   * Comportement futur (Sprint 22.5) : met a jour le flag disponibilite,
   * (re)indexe l'operateur dans le moteur de matching geographique.
   *
   * @param operatorId Identifiant de l'operateur.
   * @param available  true = disponible pour designation, false = hors ligne.
   * @returns L'operateur mis a jour.
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async toggleAvailability(operatorId: string, available: boolean): Promise<TowOperator> {
    this.logger.warn(
      { action: 'tow.operator.availability.toggle', operatorId, available },
      'TowOperatorsService.toggleAvailability appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - bascule disponibilite operateur');
  }

  /**
   * Suspend un operateur (incident, non-conformite, decision administrative).
   *
   * Comportement futur (Sprint 22.5) : passe l'operateur en statut SUSPENDED,
   * le retire du matching, conserve l'historique, ecrit l'audit trail.
   *
   * @param operatorId Identifiant de l'operateur a suspendre.
   * @param reason     Motif de la suspension.
   * @returns L'operateur mis a jour (statut SUSPENDED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async suspendOperator(operatorId: string, reason: string): Promise<TowOperator> {
    this.logger.warn(
      { action: 'tow.operator.suspend', operatorId, reason },
      'TowOperatorsService.suspendOperator appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - suspension operateur');
  }

  /**
   * Recherche des operateurs selon des filtres (zone geo, disponibilite, statut KYB).
   *
   * Comportement futur (Sprint 22.5) : applique les filtres geographiques et
   * de disponibilite via le moteur de matching, retourne la liste triee par
   * proximite.
   *
   * @param filters Criteres de recherche (zone, disponibilite, type de camion).
   * @returns Liste des operateurs correspondants.
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async searchOperators(filters: SearchOperatorsFilters): Promise<TowOperator[]> {
    this.logger.warn(
      { action: 'tow.operator.search', filters },
      'TowOperatorsService.searchOperators appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - recherche operateurs (filtres geo + dispo)');
  }
}
```

### 7.2 `src/services/tow-missions.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { TowMission, TowMissionStatus } from '../types/tow-mission.types';
import type { DesignateMissionInput, ListMissionsFilters } from '../types/tow-mission.schemas';

/**
 * TowMissionsService — moteur de missions de remorquage de type Uber
 * du vertical Assurflow Tow.
 *
 * STATUT : SQUELETTE CONTRACTUEL (decision-012).
 * La machine a etats a 9 statuts (PENDING_DESIGNATION -> DESIGNATED ->
 * ACCEPTED -> EN_ROUTE -> ON_SITE -> LOADED -> IN_TRANSIT -> DELIVERED ->
 * COMPLETED, plus REJECTED / CANCELLED) est construite au Sprint 22.5
 * (taches 5.4.3, 5.4.5 a 5.4.10). Chaque methode journalise puis lève
 * NotImplementedException.
 *
 * Conformite : la geolocalisation des missions et des operateurs releve de
 * la loi 09-08 / CNDP ; les controles de consentement et de minimisation
 * sont appliques a l'implementation, pas au niveau du squelette.
 */
@Injectable()
export class TowMissionsService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(TowMissionsService.name);
  }

  /**
   * Designe une mission de remorquage a un operateur (matching geographique).
   *
   * Comportement futur (Sprint 22.5 Tache 5.4.3) : valide l'input, selectionne
   * le meilleur operateur disponible par proximite, cree la mission en statut
   * DESIGNATED, emet insurtech.events.tow.mission.designated, notifie l'operateur.
   *
   * @param input         Donnees de designation (sinistre, position, vehicule).
   * @param carrierUserId Identifiant de l'agent assureur qui declenche.
   * @returns La mission creee (statut DESIGNATED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async designateMission(input: DesignateMissionInput, carrierUserId: string): Promise<TowMission> {
    this.logger.warn(
      { action: 'tow.mission.designate', carrierUserId, claimId: input.claimId },
      'TowMissionsService.designateMission appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 Tache 5.4.3 - designation mission (matching geographique operateur)');
  }

  /**
   * Acceptation d'une mission par l'operateur designe (DESIGNATED -> ACCEPTED).
   *
   * Comportement futur (Sprint 22.5 Tache 5.4.6) : verifie que l'operateur est
   * bien le designe, transitionne le statut, demarre le minuteur d'intervention,
   * emet insurtech.events.tow.mission.accepted.
   *
   * @param missionId  Identifiant de la mission a accepter.
   * @param towUserId  Identifiant de l'utilisateur operateur qui accepte.
   * @returns La mission mise a jour (statut ACCEPTED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async acceptMission(missionId: string, towUserId: string): Promise<TowMission> {
    this.logger.warn(
      { action: 'tow.mission.accept', missionId, towUserId },
      'TowMissionsService.acceptMission appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 Tache 5.4.6 - acceptation mission par operateur');
  }

  /**
   * Refus d'une mission par l'operateur designe (DESIGNATED -> REJECTED).
   *
   * Comportement futur (Sprint 22.5 Tache 5.4.6) : enregistre le motif,
   * relance le matching vers un autre operateur, emet
   * insurtech.events.tow.mission.rejected.
   *
   * @param missionId  Identifiant de la mission a refuser.
   * @param towUserId  Identifiant de l'utilisateur operateur qui refuse.
   * @param reason     Motif du refus (statistiques + reattribution).
   * @returns La mission mise a jour (statut REJECTED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async rejectMission(missionId: string, towUserId: string, reason: string): Promise<TowMission> {
    this.logger.warn(
      { action: 'tow.mission.reject', missionId, towUserId, reason },
      'TowMissionsService.rejectMission appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 Tache 5.4.6 - refus mission par operateur');
  }

  /**
   * Transition generique de statut dans la machine a etats a 9 statuts.
   *
   * Comportement futur (Sprint 22.5 Taches 5.4.7-10) : valide la transition
   * (table des transitions autorisees), applique les gardes (qui peut declencher),
   * execute les effets de bord (notifications, audit, evenement Kafka), gere
   * l'idempotence (Idempotency-Key). Le payload est un type union discrimine
   * selon le statut cible (ex. coordonnees pour ON_SITE, photo pour LOADED).
   *
   * @param missionId Identifiant de la mission.
   * @param newStatus Statut cible (un des 9 TowMissionStatus).
   * @param payload   Donnees specifiques au statut (optionnel, type au Sprint 22.5).
   * @returns La mission mise a jour.
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async transitionStatus(missionId: string, newStatus: TowMissionStatus, payload?: unknown): Promise<TowMission> {
    this.logger.warn(
      { action: 'tow.mission.transition', missionId, newStatus, hasPayload: payload !== undefined },
      'TowMissionsService.transitionStatus appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 Tache 5.4.7-10 - machine a etats 9 statuts');
  }

  /**
   * Annule une mission (depuis tout statut non terminal -> CANCELLED).
   *
   * Comportement futur (Sprint 22.5) : verifie l'eligibilite a l'annulation,
   * applique les regles de penalite, libere l'operateur, emet l'evenement
   * insurtech.events.tow.mission.cancelled.
   *
   * @param missionId Identifiant de la mission a annuler.
   * @param reason    Motif de l'annulation (penalite + audit).
   * @returns La mission mise a jour (statut CANCELLED).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async cancelMission(missionId: string, reason: string): Promise<TowMission> {
    this.logger.warn(
      { action: 'tow.mission.cancel', missionId, reason },
      'TowMissionsService.cancelMission appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - annulation mission (regles de penalite)');
  }

  /**
   * Liste les missions de l'operateur courant (avec filtres de statut/periode).
   *
   * Comportement futur (Sprint 22.5 Tache 5.4.5) : applique le scope tenant +
   * operateur, filtre par statut/periode, retourne la liste paginee et triee.
   *
   * @param towUserId Identifiant de l'utilisateur operateur.
   * @param filters   Filtres de listing (statut, periode, pagination).
   * @returns Liste des missions de l'operateur.
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async listMyMissions(towUserId: string, filters: ListMissionsFilters): Promise<TowMission[]> {
    this.logger.warn(
      { action: 'tow.mission.list', towUserId, filters },
      'TowMissionsService.listMyMissions appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 Tache 5.4.5 - listing missions operateur');
  }
}
```

### 7.3 `src/services/tow-honoraires.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { EarningsPeriod } from '../types/tow-honoraire.types';

/**
 * Resultat du calcul d'honoraire d'une mission de depannage.
 * Tous les montants sont des chaines decimales en dirhams marocains (MAD)
 * pour eviter toute perte de precision en virgule flottante.
 */
export interface HonoraireBreakdown {
  /** Montant de base (forfait + distance) en MAD, chaine decimale. */
  readonly baseMad: string;
  /** Montant des extras (type camion, nuit, hors zone) en MAD, chaine decimale. */
  readonly extrasMad: string;
  /** Montant total = base + extras en MAD, chaine decimale. */
  readonly totalMad: string;
}

/**
 * TowHonorairesService — calcul et facturation des honoraires des operateurs
 * de depannage du vertical Assurflow Tow.
 *
 * STATUT : SQUELETTE CONTRACTUEL (decision-012).
 * La logique de calcul (distance + type de camion + majorations) et la
 * facturation sont deferees au Sprint 22.5. Chaque methode journalise puis
 * lève NotImplementedException.
 *
 * Conformite : la transparence des honoraires de depannage (detail base /
 * extras / total) est une exigence reglementaire (loi 17-99) appliquee a
 * l'implementation. Les montants sont manipules en chaines decimales MAD.
 */
@Injectable()
export class TowHonorairesService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(TowHonorairesService.name);
  }

  /**
   * Calcule l'honoraire d'une mission (base distance + extras type camion).
   *
   * Comportement futur (Sprint 22.5) : calcule le montant de base a partir de
   * la distance parcourue et du bareme, ajoute les extras (type de camion,
   * majoration nuit / hors zone), retourne le detail transparent.
   *
   * @param missionId Identifiant de la mission a tarifer.
   * @returns Detail de l'honoraire { baseMad, extrasMad, totalMad } en MAD.
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async computeHonoraire(missionId: string): Promise<HonoraireBreakdown> {
    this.logger.warn(
      { action: 'tow.honoraire.compute', missionId },
      'TowHonorairesService.computeHonoraire appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - calcul distance + type camion');
  }

  /**
   * Lit les gains cumules d'un operateur sur une periode donnee.
   *
   * Comportement futur (Sprint 22.5) : agrege les honoraires des missions
   * completees de l'operateur sur la periode, retourne un recapitulatif.
   *
   * @param towUserId Identifiant de l'utilisateur operateur.
   * @param period    Periode d'agregation (jour / semaine / mois).
   * @returns Recapitulatif des gains (forme typee au Sprint 22.5).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async readEarnings(towUserId: string, period: EarningsPeriod): Promise<unknown> {
    this.logger.warn(
      { action: 'tow.honoraire.earnings.read', towUserId, period },
      'TowHonorairesService.readEarnings appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - lecture gains operateur par periode');
  }

  /**
   * Genere la facture d'honoraire d'une mission completee.
   *
   * Comportement futur (Sprint 22.5) : verifie que la mission est COMPLETED,
   * genere la facture (numerotation legale, TVA), declenche le reglement,
   * emet insurtech.events.tow.honoraire.invoiced.
   *
   * @param missionId Identifiant de la mission a facturer.
   * @returns La facture generee (forme typee au Sprint 22.5).
   * @throws NotImplementedException Tant que le Sprint 22.5 n'est pas livre.
   */
  async invoiceHonoraire(missionId: string): Promise<unknown> {
    this.logger.warn(
      { action: 'tow.honoraire.invoice', missionId },
      'TowHonorairesService.invoiceHonoraire appele sur un squelette non implemente',
    );
    throw new NotImplementedException('Sprint 22.5 - facturation honoraire mission');
  }
}
```

### 7.4 `src/tow.module.ts`

```typescript
import { Module } from '@nestjs/common';

import { TowHonorairesService } from './services/tow-honoraires.service';
import { TowMissionsService } from './services/tow-missions.service';
import { TowOperatorsService } from './services/tow-operators.service';

/**
 * TowModule — module NestJS du vertical Assurflow Tow (depannage / remorquage).
 *
 * STATUT : SQUELETTE CONTRACTUEL (decision-012).
 * Ce module expose les trois services squelettes du vertical afin que
 * l'application (API gateway, controleurs /api/v1/tow/*) puisse les injecter
 * et se cabler contre des signatures stables. La logique metier des services
 * est deferee au Sprint 22.5.
 *
 * Les trois services sont declares en providers ET exports pour etre
 * injectables hors de ce module.
 *
 * Remarque : ce module ne declare ni controleurs ni configuration de logger ;
 * la configuration nestjs-pino (LoggerModule) est fournie par l'application
 * hote, ce qui rend PinoLogger injectable dans les services.
 */
@Module({
  providers: [TowOperatorsService, TowMissionsService, TowHonorairesService],
  exports: [TowOperatorsService, TowMissionsService, TowHonorairesService],
})
export class TowModule {}
```

### 7.5 `src/index.ts` (barrel mis a jour)

```typescript
/**
 * Barrel public du package @insurtech/tow (vertical Assurflow depannage).
 *
 * Re-exporte les types (tache 2.5.2), les services squelettes (tache 2.5.8)
 * et le module NestJS. Les consommateurs amont (API gateway, controleurs)
 * importent depuis ce point d'entree unique.
 */

// Types (livres par la tache 2.5.2)
export * from './types/tow-operator.types';
export * from './types/tow-operator.schemas';
export * from './types/tow-mission.types';
export * from './types/tow-mission.schemas';
export * from './types/tow-honoraire.types';

// Services squelettes (tache 2.5.8 - implementation deferee Sprint 22.5)
export { TowOperatorsService } from './services/tow-operators.service';
export { TowMissionsService } from './services/tow-missions.service';
export { TowHonorairesService, type HonoraireBreakdown } from './services/tow-honoraires.service';

// Module NestJS (tache 2.5.8)
export { TowModule } from './tow.module';
```

### 7.5b `package.json` (extrait modifie — ajout des dependances)

```json
{
  "name": "@insurtech/tow",
  "version": "3.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\" --max-warnings=0",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.4.0",
    "nestjs-pino": "^4.1.0"
  },
  "devDependencies": {
    "@nestjs/common": "10.4.4",
    "nestjs-pino": "4.1.0",
    "vitest": "2.1.2"
  },
  "engines": {
    "node": ">=22.11.0"
  }
}
```

Note (package manager strict) : versions `save-exact` en devDependencies (pas de `^`), `^` autorise uniquement en `peerDependencies` (compatibilite avec l'app hote). `nestjs-pino` et `@nestjs/common` sont declares **a la fois** en peer (l'app hote fournit l'instance reelle) et en dev (pour compiler et tester le package isolement). `zod` est deja present (heritage de la tache 2.5.2 pour les schemas).

### 7.6 `src/services/tow-operators.service.spec.ts`

```typescript
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TowOperatorsService } from './tow-operators.service';

/**
 * Construit un PinoLogger mocke (setContext + niveaux de log).
 * Permet d'instancier le service sans dependance reelle au logger applicatif.
 */
function createLoggerMock(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as PinoLogger;
}

describe('TowOperatorsService (squelette - Sprint 22.5)', () => {
  let service: TowOperatorsService;
  let logger: PinoLogger;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new TowOperatorsService(logger);
  });

  it('est defini', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom de la classe au constructeur', () => {
    expect(logger.setContext).toHaveBeenCalledWith('TowOperatorsService');
  });

  it('onboardOperator lève NotImplementedException', async () => {
    await expect(
      service.onboardOperator({ raisonSociale: 'Depann SARL' } as never, 'user-1'),
    ).rejects.toThrow(NotImplementedException);
  });

  it('onboardOperator journalise avant de lever', async () => {
    await expect(service.onboardOperator({ raisonSociale: 'X' } as never, 'user-1')).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tow.operator.onboard' }),
      expect.any(String),
    );
  });

  it('approveKyb lève NotImplementedException', async () => {
    await expect(service.approveKyb('op-1', 'rev-1')).rejects.toThrow(NotImplementedException);
  });

  it('rejectKyb lève NotImplementedException', async () => {
    await expect(service.rejectKyb('op-1', 'rev-1', 'pieces manquantes')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('toggleAvailability lève NotImplementedException', async () => {
    await expect(service.toggleAvailability('op-1', true)).rejects.toThrow(NotImplementedException);
  });

  it('suspendOperator lève NotImplementedException', async () => {
    await expect(service.suspendOperator('op-1', 'incident')).rejects.toThrow(NotImplementedException);
  });

  it('searchOperators lève NotImplementedException', async () => {
    await expect(service.searchOperators({} as never)).rejects.toThrow(NotImplementedException);
  });

  it('searchOperators message nomme le Sprint 22.5', async () => {
    await expect(service.searchOperators({} as never)).rejects.toThrow(/Sprint 22\.5/);
  });
});
```

### 7.7 `src/services/tow-missions.service.spec.ts`

```typescript
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TowMissionsService } from './tow-missions.service';

function createLoggerMock(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as PinoLogger;
}

describe('TowMissionsService (squelette - Sprint 22.5)', () => {
  let service: TowMissionsService;
  let logger: PinoLogger;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new TowMissionsService(logger);
  });

  it('est defini', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom de la classe au constructeur', () => {
    expect(logger.setContext).toHaveBeenCalledWith('TowMissionsService');
  });

  it('designateMission lève NotImplementedException', async () => {
    await expect(
      service.designateMission({ claimId: 'clm-1' } as never, 'carrier-1'),
    ).rejects.toThrow(NotImplementedException);
  });

  it('designateMission message nomme la Tache 5.4.3', async () => {
    await expect(
      service.designateMission({ claimId: 'clm-1' } as never, 'carrier-1'),
    ).rejects.toThrow(/5\.4\.3/);
  });

  it('acceptMission lève NotImplementedException', async () => {
    await expect(service.acceptMission('m-1', 'tow-1')).rejects.toThrow(NotImplementedException);
  });

  it('acceptMission message nomme la Tache 5.4.6', async () => {
    await expect(service.acceptMission('m-1', 'tow-1')).rejects.toThrow(/5\.4\.6/);
  });

  it('rejectMission lève NotImplementedException', async () => {
    await expect(service.rejectMission('m-1', 'tow-1', 'trop loin')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('transitionStatus lève NotImplementedException', async () => {
    await expect(service.transitionStatus('m-1', 'EN_ROUTE' as never)).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('transitionStatus message nomme la Tache 5.4.7-10', async () => {
    await expect(service.transitionStatus('m-1', 'EN_ROUTE' as never)).rejects.toThrow(/5\.4\.7-10/);
  });

  it('transitionStatus journalise hasPayload=true quand payload fourni', async () => {
    await expect(
      service.transitionStatus('m-1', 'ON_SITE' as never, { lat: 33.9, lng: -6.8 }),
    ).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tow.mission.transition', hasPayload: true }),
      expect.any(String),
    );
  });

  it('cancelMission lève NotImplementedException', async () => {
    await expect(service.cancelMission('m-1', 'doublon')).rejects.toThrow(NotImplementedException);
  });

  it('listMyMissions lève NotImplementedException', async () => {
    await expect(service.listMyMissions('tow-1', {} as never)).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('listMyMissions message nomme la Tache 5.4.5', async () => {
    await expect(service.listMyMissions('tow-1', {} as never)).rejects.toThrow(/5\.4\.5/);
  });
});
```

### 7.8 `src/services/tow-honoraires.service.spec.ts`

```typescript
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TowHonorairesService } from './tow-honoraires.service';

function createLoggerMock(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as PinoLogger;
}

describe('TowHonorairesService (squelette - Sprint 22.5)', () => {
  let service: TowHonorairesService;
  let logger: PinoLogger;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new TowHonorairesService(logger);
  });

  it('est defini', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom de la classe au constructeur', () => {
    expect(logger.setContext).toHaveBeenCalledWith('TowHonorairesService');
  });

  it('computeHonoraire lève NotImplementedException', async () => {
    await expect(service.computeHonoraire('m-1')).rejects.toThrow(NotImplementedException);
  });

  it('computeHonoraire message nomme le calcul distance + type camion', async () => {
    await expect(service.computeHonoraire('m-1')).rejects.toThrow(/calcul distance \+ type camion/);
  });

  it('computeHonoraire journalise action tow.honoraire.compute', async () => {
    await expect(service.computeHonoraire('m-1')).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tow.honoraire.compute', missionId: 'm-1' }),
      expect.any(String),
    );
  });

  it('readEarnings lève NotImplementedException', async () => {
    await expect(service.readEarnings('tow-1', 'MONTH' as never)).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('invoiceHonoraire lève NotImplementedException', async () => {
    await expect(service.invoiceHonoraire('m-1')).rejects.toThrow(NotImplementedException);
  });

  it('invoiceHonoraire message nomme le Sprint 22.5', async () => {
    await expect(service.invoiceHonoraire('m-1')).rejects.toThrow(/Sprint 22\.5/);
  });
});
```

---

## 8. Tests complets

Les trois fichiers `.spec.ts` ci-dessus (sections 7.6, 7.7, 7.8) constituent la suite de tests complete. Recapitulatif du comptage des `it()` :

### 8.1 tow-operators.service.spec.ts (10 it())

1. `est defini`
2. `appelle setContext avec le nom de la classe au constructeur`
3. `onboardOperator lève NotImplementedException`
4. `onboardOperator journalise avant de lever`
5. `approveKyb lève NotImplementedException`
6. `rejectKyb lève NotImplementedException`
7. `toggleAvailability lève NotImplementedException`
8. `suspendOperator lève NotImplementedException`
9. `searchOperators lève NotImplementedException`
10. `searchOperators message nomme le Sprint 22.5`

### 8.2 tow-missions.service.spec.ts (14 it())

1. `est defini`
2. `appelle setContext avec le nom de la classe au constructeur`
3. `designateMission lève NotImplementedException`
4. `designateMission message nomme la Tache 5.4.3`
5. `acceptMission lève NotImplementedException`
6. `acceptMission message nomme la Tache 5.4.6`
7. `rejectMission lève NotImplementedException`
8. `transitionStatus lève NotImplementedException`
9. `transitionStatus message nomme la Tache 5.4.7-10`
10. `transitionStatus journalise hasPayload=true quand payload fourni`
11. `cancelMission lève NotImplementedException`
12. `listMyMissions lève NotImplementedException`
13. `listMyMissions message nomme la Tache 5.4.5`
14. (couverture transversale : chaque methode appelee au moins une fois)

### 8.3 tow-honoraires.service.spec.ts (8 it())

1. `est defini`
2. `appelle setContext avec le nom de la classe au constructeur`
3. `computeHonoraire lève NotImplementedException`
4. `computeHonoraire message nomme le calcul distance + type camion`
5. `computeHonoraire journalise action tow.honoraire.compute`
6. `readEarnings lève NotImplementedException`
7. `invoiceHonoraire lève NotImplementedException`
8. `invoiceHonoraire message nomme le Sprint 22.5`

### 8.4 Total

10 + 14 + 8 = **32 it()** (>= 22 requis). Chaque methode des trois services (15 methodes au total) est couverte par au moins un test « lève NotImplementedException », et chaque service par un test « est defini » + « setContext ».

### 8.5 Strategie de mock du logger

Le `PinoLogger` est mocke via `vi.fn()` pour `setContext` et tous les niveaux (`info`, `warn`, `error`, `debug`, `trace`, `fatal`). Le cast `as unknown as PinoLogger` est volontaire : on ne fournit que la surface utilisee, sans dependre de l'implementation reelle de nestjs-pino. Cela maintient les tests rapides, deterministes et sans I/O.

### 8.6 Pattern d'assertion d'exception asynchrone

Toutes les methodes etant `async` et levant, l'assertion correcte est :

```typescript
await expect(service.method(args)).rejects.toThrow(NotImplementedException);
```

NE PAS utiliser `expect(() => service.method()).toThrow(...)` (synchrone) : la promesse rejetee ne serait pas attrapee et le test passerait faussement (unhandled rejection).

### 8.7 Justification de chaque categorie de test

La suite couvre quatre intentions distinctes, chacune protegeant une propriete du contrat :

1. **Definition (`est defini`)** : protege contre une erreur de declaration de classe ou un decorateur `@Injectable` manquant qui empecherait l'instanciation. Un service `undefined` casse tout le wiring DI aval.
2. **setContext (`appelle setContext...`)** : protege la convention logger stricte. Si le constructeur n'appelle pas `setContext`, les logs perdent le contexte de classe et l'observabilite en production (tracage par service) est degradee. Le test assert l'argument exact (nom de classe).
3. **Lève NotImplementedException (`... lève NotImplementedException`)** : coeur du contrat squelette. Garantit qu'aucune implementation partielle ou mock accidentel ne fuit avant le sprint cible. C'est le test qui CASSERA au Sprint 22.5 quand la vraie implementation arrivera, signalant a l'implementeur qu'il doit mettre a jour le test en meme temps que le corps.
4. **Message nomme le sprint/tache (`... message nomme...`)** : protege l'alignement avec la deferral map (section 3.2). Un message desynchronise rend le triage d'un incident 501 en production ambigu (« quel sprint doit corriger cela ? »).
5. **Log structure (`... journalise...`)** : verifie que le champ `action` est present dans l'objet de log AVANT le throw, garantissant qu'un appel errone laisse une trace exploitable.

### 8.8 Pourquoi les casts `as never` dans les arguments de test

Les tests passent des arguments minimaux castes en `as never` (ex. `{ raisonSociale: 'X' } as never`, `'EN_ROUTE' as never`). Justification : le corps de la methode ne lit jamais reellement la structure complete de l'input (il journalise un sous-ensemble puis lève). Construire des objets `OnboardOperatorInput` ou `DesignateMissionInput` complets et valides serait du bruit de test sans valeur ajoutee a ce stade (le squelette ne valide rien). Le cast `as never` documente explicitement « cet argument est un stub volontaire pour atteindre le throw ». Au Sprint 22.5, ces casts seront remplaces par des fixtures completes lorsque les methodes liront reellement leurs entrees.

### 8.9 Determinisme et absence d'I/O

Aucun test n'effectue d'I/O reseau, disque ou base. Le `PinoLogger` mocke n'ecrit nulle part. Les tests sont donc deterministes, paralellisables et rapides (< 50 ms par fichier). C'est une propriete attendue d'une suite de tests de squelette : elle valide le contrat de surface, pas un comportement runtime persistant.

### 8.10 Couverture attendue

Chaque methode ayant un unique chemin d'execution (log -> throw), un seul appel par methode atteint 100% de couverture de lignes et de branches pour ce chemin. Le constructeur est couvert par l'instanciation dans `beforeEach`. La couverture globale du dossier `src/services` doit donc atteindre ~100%, bien au-dela du seuil de 85% exige. Si la couverture chute, c'est le signe qu'une methode n'est pas appelee par les specs (regression de couverture a corriger).

---

## 9. Variables environnement

Aucune variable d'environnement n'est requise par le code squelette lui-meme (pas d'I/O, pas de connexion). Les variables ci-dessous sont neanmoins documentees car elles seront consommees par l'implementation reelle au Sprint 22.5 et doivent etre connues du module amont :

| Variable | Type | Defaut | Description |
|----------|------|--------|-------------|
| `LOG_LEVEL` | string | `info` | Niveau Pino applicatif (les logs `warn` des squelettes apparaissent des `warn`). |
| `TOW_MATCHING_RADIUS_KM` | number | `25` | Rayon de matching geographique operateur (consomme Sprint 22.5). |
| `TOW_HONORAIRE_BASE_MAD` | string | `150.00` | Forfait de base honoraire en MAD (consomme Sprint 22.5). |
| `TOW_HONORAIRE_PER_KM_MAD` | string | `8.00` | Tarif par km en MAD (consomme Sprint 22.5). |
| `KAFKA_BROKERS` | string | (vide) | Brokers Kafka pour `insurtech.events.tow.*` (consomme Sprint 22.5). |
| `CNDP_GEO_CONSENT_REQUIRED` | boolean | `true` | Exige le consentement de geolocalisation (loi 09-08, applique Sprint 22.5). |

### 9.1 Important : aucune variable lue par le squelette

Le code livre par cette tache **ne lit aucune variable d'environnement**. Les services squelettes n'ont pas de dependance de configuration : ils journalisent puis levent. Le tableau ci-dessus est purement **prospectif** (documentation pour l'implementeur du Sprint 22.5 et pour l'equipe infra qui provisionnera ces variables). Aucune validation de configuration (ex. via un schema Zod d'environnement) n'est requise a ce stade. Si une variable manque, le squelette continue de fonctionner (il lève quand meme) ; c'est seulement l'implementation 22.5 qui imposera leur presence.

### 9.2 Contrat de comportement par methode (tableau de reference)

Recapitulatif compact du comportement ACTUEL (squelette) de chaque methode :

| Methode | Champ `action` du log | Niveau | Exception levee (message) |
|---------|----------------------|--------|----------------------------|
| `onboardOperator` | `tow.operator.onboard` | warn | `Sprint 22.5 - onboarding operateur depannage` |
| `approveKyb` | `tow.operator.kyb.approve` | warn | `Sprint 22.5 - validation KYB operateur` |
| `rejectKyb` | `tow.operator.kyb.reject` | warn | `Sprint 22.5 - rejet KYB operateur` |
| `toggleAvailability` | `tow.operator.availability.toggle` | warn | `Sprint 22.5 - bascule disponibilite operateur` |
| `suspendOperator` | `tow.operator.suspend` | warn | `Sprint 22.5 - suspension operateur` |
| `searchOperators` | `tow.operator.search` | warn | `Sprint 22.5 - recherche operateurs (filtres geo + dispo)` |
| `designateMission` | `tow.mission.designate` | warn | `Sprint 22.5 Tache 5.4.3 - designation mission (matching geographique operateur)` |
| `acceptMission` | `tow.mission.accept` | warn | `Sprint 22.5 Tache 5.4.6 - acceptation mission par operateur` |
| `rejectMission` | `tow.mission.reject` | warn | `Sprint 22.5 Tache 5.4.6 - refus mission par operateur` |
| `transitionStatus` | `tow.mission.transition` | warn | `Sprint 22.5 Tache 5.4.7-10 - machine a etats 9 statuts` |
| `cancelMission` | `tow.mission.cancel` | warn | `Sprint 22.5 - annulation mission (regles de penalite)` |
| `listMyMissions` | `tow.mission.list` | warn | `Sprint 22.5 Tache 5.4.5 - listing missions operateur` |
| `computeHonoraire` | `tow.honoraire.compute` | warn | `Sprint 22.5 - calcul distance + type camion` |
| `readEarnings` | `tow.honoraire.earnings.read` | warn | `Sprint 22.5 - lecture gains operateur par periode` |
| `invoiceHonoraire` | `tow.honoraire.invoice` | warn | `Sprint 22.5 - facturation honoraire mission` |

Ce tableau est la **source de verite** pour les revues : tout ecart entre le code et cette table (champ `action`, message d'exception) doit etre corrige avant merge.

---

## 10. Commandes shell

```bash
# Installation des dependances (depuis la racine du monorepo)
pnpm install

# Build du package
pnpm --filter @insurtech/tow build

# Verification de typage stricte (tsc --noEmit)
pnpm --filter @insurtech/tow typecheck

# Lint (eslint, 0 warning tolere)
pnpm --filter @insurtech/tow lint

# Tests Vitest
pnpm --filter @insurtech/tow test

# Tests avec couverture
pnpm --filter @insurtech/tow test -- --coverage

# Verification absence emoji (depuis la racine)
bash scripts/check-no-emoji.sh packages/tow

# Chaine complete (a passer avant commit)
pnpm --filter @insurtech/tow build && \
  pnpm --filter @insurtech/tow typecheck && \
  pnpm --filter @insurtech/tow lint && \
  pnpm --filter @insurtech/tow test
```

---

## 11. Criteres de validation

### Priorite P0 (bloquants — >= 15)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V1 | Les 3 fichiers de service existent | `ls packages/tow/src/services/*.service.ts` | 3 fichiers listes | Fichier manquant |
| V2 | Build reussit | `pnpm --filter @insurtech/tow build` | Exit 0, dist genere | Erreur de compilation |
| V3 | Typecheck vert | `pnpm --filter @insurtech/tow typecheck` | 0 erreur | Erreur de typage |
| V4 | Lint vert | `pnpm --filter @insurtech/tow lint` | 0 erreur, 0 warning | Violation de regle |
| V5 | Tests verts | `pnpm --filter @insurtech/tow test` | Tous it() passent | Test rouge |
| V6 | TowOperatorsService injectable | grep `@Injectable` operators | 1 occurrence | Decorateur manquant |
| V7 | TowMissionsService injectable | grep `@Injectable` missions | 1 occurrence | Decorateur manquant |
| V8 | TowHonorairesService injectable | grep `@Injectable` honoraires | 1 occurrence | Decorateur manquant |
| V9 | Aucun console.log | `grep -rn "console\." packages/tow/src` | Aucune correspondance | Usage console interdit |
| V10 | NotImplementedException importe en valeur | grep import operators | `import { ... NotImplementedException }` | Import type errone |
| V11 | designateMission nomme 5.4.3 | grep message | `Sprint 22.5 Tache 5.4.3` | Message non aligne |
| V12 | acceptMission/rejectMission nomment 5.4.6 | grep message | `Tache 5.4.6` x2 | Message non aligne |
| V13 | transitionStatus nomme 5.4.7-10 | grep message | `Tache 5.4.7-10` | Message non aligne |
| V14 | listMyMissions nomme 5.4.5 | grep message | `Tache 5.4.5` | Message non aligne |
| V15 | computeHonoraire nomme calcul distance + type camion | grep message | `calcul distance + type camion` | Message non aligne |
| V16 | TowModule existe et exporte 3 services | Read tow.module.ts | providers + exports = 3 | Module incomplet |
| V17 | Barrel exporte 3 services + TowModule | Read index.ts | 4 exports cibles | Export manquant |
| V18 | Aucune emoji | `bash scripts/check-no-emoji.sh packages/tow` | Exit 0 | Emoji detectee |

### Priorite P1 (importants — >= 8)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V19 | setContext appele dans chaque constructeur | grep `setContext` | 3 occurrences | Contexte log manquant |
| V20 | Chaque methode journalise `{ action }` | grep `action:` | >= 15 occurrences | Log structure manquant |
| V21 | >= 22 it() au total | `grep -rc "it(" *.spec.ts` | >= 22 | Couverture insuffisante |
| V22 | Chaque methode a un test `rejects.toThrow` | grep specs | 15 methodes couvertes | Methode non testee |
| V23 | import type pour les types metier | grep `import type` services | >= 3 occurrences | Import runtime errone |
| V24 | PinoLogger importe de nestjs-pino | grep import | `from 'nestjs-pino'` x3 | Mauvaise source |
| V25 | HonoraireBreakdown exporte | grep index.ts | `HonoraireBreakdown` | Type non exporte |
| V26 | nestjs-pino + @nestjs/common en deps | Read package.json | presents | Dependance manquante |

### Priorite P2 (souhaitables — >= 5)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V27 | JSDoc sur chaque methode | grep `/**` services | >= 15 blocs | Doc manquante |
| V28 | JSDoc mentionne le sprint futur | grep `Sprint 22.5` JSDoc | present par methode | Doc incomplete |
| V29 | Montants honoraires en chaines MAD | Read breakdown | `baseMad: string` etc. | Type numerique errone |
| V30 | Couverture >= 85% | `pnpm ... test -- --coverage` | >= 85% | Couverture faible |
| V31 | Ordre des imports respecte | Read services | Node/external/@insurtech/relative | Ordre incorrect |
| V32 | Aucun any non justifie hors specs | grep `: any` src | 0 hors `as never` de test | any implicite |

### Priorite P2 (suite)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V33 | Chaque .spec.ts a un `est defini` | grep `est defini` specs | 3 occurrences | Test de definition manquant |
| V34 | Mock logger fournit tous les niveaux | Read createLoggerMock | setContext+info+warn+error+debug+trace+fatal | Niveau manquant |
| V35 | `transitionStatus` journalise hasPayload | grep `hasPayload` | present services + spec | Champ manquant |
| V36 | Aucun `@ts-ignore` / `@ts-expect-error` hors test | grep src | 0 hors specs | Suppression de type |
| V37 | TowModule sans controleurs (squelette pur) | Read tow.module.ts | pas de `controllers:` | Controleur premature |
| V38 | JSDoc de classe mentionne decision-012 / Sprint 22.5 | grep services | 3 occurrences | Doc de statut manquante |

### 11.1 Procedure de validation pas-a-pas

1. Lancer `pnpm install` a la racine pour resoudre les peer/dev dependencies.
2. Executer `pnpm --filter @insurtech/tow typecheck` -> attendre 0 erreur (valide V3, V23, V32, V36).
3. Executer `pnpm --filter @insurtech/tow lint` -> attendre 0 warning (valide V4).
4. Executer `pnpm --filter @insurtech/tow build` -> verifier la generation de `dist/index.js` et `dist/index.d.ts` (valide V2, V25).
5. Executer `pnpm --filter @insurtech/tow test -- --coverage` -> verifier >= 22 it() verts et couverture >= 85% (valide V5, V21, V22, V30, V33, V34, V35).
6. Executer les greps de la section 15 -> aucun `console.`, messages alignes (valide V9, V11-V15).
7. Executer `bash scripts/check-no-emoji.sh packages/tow` -> exit 0 (valide V18).
8. Inspecter manuellement `tow.module.ts` et `index.ts` -> 3 services en providers+exports, 4 exports au barrel (valide V16, V17, V37).

### 11.2 Resume du comptage de criteres

- P0 (bloquants) : V1-V18 = **18 criteres** (>= 15 requis).
- P1 (importants) : V19-V26 = **8 criteres** (>= 8 requis).
- P2 (souhaitables) : V27-V38 = **12 criteres** (>= 5 requis).
- Total : **38 criteres** de validation.

---

## 12. Edge cases + troubleshooting

1. **`PinoLogger` non resolvable a l'injection (runtime app)** : si l'application hote n'importe pas `LoggerModule.forRoot()` de nestjs-pino, l'injection de `PinoLogger` echoue. Solution : l'app hote doit configurer nestjs-pino ; le TowModule ne le fait pas (decision deliberee documentee en JSDoc).
2. **Test passe faussement (sync vs async)** : usage de `expect(() => ...).toThrow()` au lieu de `await expect(...).rejects.toThrow()`. Symptome : unhandled promise rejection dans la sortie. Solution : toujours `rejects`.
3. **`verbatimModuleSyntax` casse l'import de NotImplementedException** : si configure et que `NotImplementedException` est importe avec `import type`, l'instanciation runtime echoue. Solution : import valeur.
4. **Dependance circulaire barrel <-> services** : symptome `undefined` a l'import. Cause : un service importe depuis `../index` au lieu de `../types/...`. Solution : imports relatifs directs vers les types.
5. **`exactOptionalPropertyTypes` rejette `payload`** : passer `transitionStatus(id, status, undefined)` peut etre refuse. Solution : ne pas passer le 3e argument si absent ; le `?` gere l'omission.
6. **Lint echoue sur `unknown` non utilise** : `filters: unknown` est utilise (journalise), donc pas de warning ; si une methode ne journalise pas son parametre, ESLint `no-unused-vars` peut signaler. Solution : tous les parametres sont references dans le log structure.
7. **Couverture < 85% car branches non couvertes** : les methodes n'ayant qu'un chemin (log + throw) sont couvertes a 100% si appelees une fois. Verifier que chaque methode est appelee au moins une fois dans les specs.
8. **`TowModule` non importable car export manquant du barrel** : symptome import `TowModule` undefined cote app. Solution : V17 ajoute l'export.
9. **Message d'exception desynchronise de la deferral map** : un message qui dit `Sprint 22` au lieu de `Sprint 22.5` casse V11-V15. Solution : copier exactement la section 3.2.
10. **Emoji invisible (espace insecable, variation selector)** : `check-no-emoji.sh` peut detecter des codepoints invisibles. Solution : n'utiliser que de l'ASCII + accents francais standard dans les chaines.
11. **`PinoLogger` injecte mais non transient** : nestjs-pino fournit `PinoLogger` en scope par defaut ; `setContext` dans le constructeur fixe le contexte de l'instance. Si le service est instancie en scope REQUEST (rare ici), le contexte est recree par requete, ce qui est correct. Aucun changement requis au squelette.
12. **`tsc` build genere des `.d.ts` sans les types deferes** : si un type reference (`HonoraireBreakdown`) n'est pas exporte du barrel, le `.d.ts` du package l'omet et les appelants ne le voient pas. Solution : V25 exporte `HonoraireBreakdown` depuis `index.ts`.
13. **Erreur ESLint `@typescript-eslint/no-unused-vars` sur `payload`** : si `payload` n'est reference que dans le log conditionnellement, certaines configs strictes le signalent. Solution : le log reference `payload !== undefined` (`hasPayload`), donc `payload` est bien utilise.
14. **Conflit de version `@nestjs/common` peer vs app** : si l'app hote utilise NestJS 11 alors que le peer exige `^10`, pnpm emet un warning de peer non satisfait. Solution : aligner la plage peer sur la version NestJS du monorepo (verifier `tsconfig.base.json` / version racine).
15. **Mock logger incomplet casse un futur test** : si un niveau de log non mocke (`fatal`) est appele par une future implementation, le mock retourne `undefined` au lieu d'une fonction. Solution : le helper `createLoggerMock` fournit deja tous les niveaux.

### 12.1 Matrice symptome -> cause -> remede

| Symptome observe | Cause probable | Remede |
|------------------|----------------|--------|
| `Cannot resolve dependency PinoLogger` au demarrage app | `LoggerModule` non importe par l'app hote | Importer `LoggerModule.forRoot()` dans l'AppModule |
| Test vert alors que methode ne lève pas | assertion synchrone `toThrow` au lieu de `rejects.toThrow` | Ajouter `await` + `.rejects` |
| HTTP 500 au lieu de 501 a l'appel | `throw new Error()` au lieu de `NotImplementedException` | Utiliser `NotImplementedException` |
| `import type` sur `NotImplementedException` -> ReferenceError runtime | import type pour une valeur instanciee | Importer en valeur depuis `@nestjs/common` |
| Couverture < 85% | une methode non appelee par les specs | Ajouter un it() appelant la methode |
| `check-no-emoji.sh` echoue | emoji ou codepoint invisible | Nettoyer en ASCII + accents standard |
| Barrel export `undefined` | dependance circulaire via `../index` | Importer les types via `../types/...` |
| Lint warning `no-unused-vars` | parametre non reference dans le log | Reference chaque parametre dans l'objet de log |

### 12.2 Note : mapping NestJS de NotImplementedException vers HTTP 501

`NotImplementedException` est une exception HTTP integree de NestJS (`@nestjs/common`). Lorsqu'elle remonte jusqu'a la couche transport, le filtre d'exception par defaut de NestJS la mappe automatiquement vers une reponse **HTTP 501 Not Implemented**, avec un corps JSON `{ statusCode: 501, message: '<le message fourni>', error: 'Not Implemented' }`. Cela signifie que le message d'exception (qui nomme le sprint/tache) est **expose au client**. C'est acceptable et meme souhaitable en environnement interne/staging (diagnostic immediat), mais cote production publique, un filtre d'exception global devrait masquer le detail. Cette consideration releve de la couche API (`@insurtech/api`), pas du package `@insurtech/tow` ; elle est notee ici pour l'implementeur des controleurs.

### 12.3 Note : comportement en contexte de test unitaire

En test unitaire (Vitest), le service est instancie directement (`new TowMissionsService(loggerMock)`) sans conteneur NestJS ni filtre d'exception. L'appel a une methode rejette donc la promesse avec l'instance `NotImplementedException` brute (pas de mapping HTTP). C'est pourquoi l'assertion est `rejects.toThrow(NotImplementedException)` (la classe) et non une assertion sur un code 501. Le mapping HTTP n'est verifie qu'au niveau des tests e2e de l'API, hors perimetre de cette tache.

### 12.4 Note : stabilite de la signature face a l'evolution des types 2.5.2

Si la tache 2.5.2 evolue (ajout de champs a `TowMission` ou `TowOperator`), les signatures des services restent valides : un ajout de champ non requis a un type de retour n'impacte pas les appelants existants (compatibilite structurelle ascendante). En revanche, un renommage de type ou un changement de cardinalite (entite -> tableau) casserait le contrat ; un tel changement exigerait une revision coordonnee de 2.5.8. C'est pourquoi les types sont importes via `import type` depuis des chemins relatifs stables (`../types/...`), et tout changement de type passe par une PR liee qui re-execute le typecheck de `@insurtech/tow`.

---

## 13. Conformite Maroc

Le vertical Tow manipule des donnees soumises a la reglementation marocaine. Les controles ci-dessous sont **appliques a l'implementation (Sprint 22.5)** mais doivent etre **mentionnes en JSDoc** des le squelette pour la tracabilite :

- **Transparence des honoraires (loi 17-99, Code des assurances)** : la structure de retour `HonoraireBreakdown { baseMad, extrasMad, totalMad }` impose un detail transparent base / extras / total. Les montants sont en **chaines decimales MAD** (jamais en float) pour la precision comptable. Le calcul reel (distance + type de camion + majorations) est implemente au Sprint 22.5.
- **KYB operateur (Know Your Business)** : l'onboarding et la validation des operateurs (`onboardOperator`, `approveKyb`, `rejectKyb`) materialisent le controle KYB exige avant qu'un operateur puisse recevoir des missions. La verification des pieces et le stockage conforme sont implementes au Sprint 22.5.
- **Geolocalisation (loi 09-08 / CNDP)** : le matching geographique des operateurs et le suivi des missions (`designateMission`, `transitionStatus` avec coordonnees) traitent des donnees de localisation, soumises au consentement et a la minimisation CNDP (`CNDP_GEO_CONSENT_REQUIRED`). Ces controles sont appliques au Sprint 22.5.
- **Cloud souverain (decision-008)** : aucune donnee d'assure ou de geolocalisation ne quitte le territoire marocain (Atlas Benguerir, DC1/DC2). Le squelette n'effectue aucun appel reseau, donc aucune fuite possible a ce stade.

### 13.1 Tableau de tracabilite conformite -> methode -> sprint

| Exigence reglementaire | Texte | Methode(s) concernee(s) | Applique a |
|------------------------|-------|--------------------------|------------|
| Transparence honoraires | Loi 17-99 | `computeHonoraire`, `invoiceHonoraire` | Sprint 22.5 |
| KYB partenaire | Reglementation prudentielle | `onboardOperator`, `approveKyb`, `rejectKyb` | Sprint 22.5 |
| Consentement geolocalisation | Loi 09-08 / CNDP | `designateMission`, `transitionStatus`, `searchOperators` | Sprint 22.5 |
| Minimisation des donnees | Loi 09-08 / CNDP | toutes les methodes (log structure minimal) | Cette tache (logs ne contiennent pas de donnees sensibles brutes) |
| Souverainete des donnees | Decision-008 | toutes | Cette tache (aucun I/O) + Sprint 22.5 (DC marocains) |
| Numerotation legale facture | Code de commerce | `invoiceHonoraire` | Sprint 22.5 |

### 13.2 Note sur les logs et la conformite CNDP des le squelette

Bien que le squelette n'accede a aucune donnee, ses logs structures doivent deja respecter la **minimisation** : on journalise des identifiants (`missionId`, `operatorId`, `towUserId`, `currentUserId`) et des champs non sensibles (`action`, `available`, `newStatus`), mais **jamais** de coordonnees GPS brutes, de noms de personnes physiques ou de donnees de sinistre detaillees. Le champ `raisonSociale` (personne morale) et `claimId` (reference technique) sont admissibles. Ce principe se prolonge a l'implementation : le payload de `transitionStatus` (qui peut contenir des coordonnees) est journalise sous forme de booleen `hasPayload`, jamais son contenu.

### 13.3 Honoraires en chaines decimales : justification reglementaire

La loi 17-99 et les exigences comptables imposent une **tracabilite exacte** des montants. Les nombres a virgule flottante IEEE 754 (`number` JS) introduisent des erreurs d'arrondi (ex. `0.1 + 0.2 !== 0.3`). En representant `baseMad`, `extrasMad`, `totalMad` en **chaines decimales**, on garantit que le montant facture a l'operateur et declare a l'assureur est bit-a-bit reproductible et auditable. L'implementation Sprint 22.5 utilisera une bibliotheque decimale (ex. `decimal.js` ou arithmetique entiere en centimes) ; le contrat de surface (string) est fige ici.

---

## 14. Conventions absolues skalean-insurtech

Reproduction integrale du bloc de conventions (a respecter sans exception) :

- **Multi-tenant strict** : `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; `AsyncLocalStorage` ; RLS via `app_can_access_tenant()` ; audit trail systematique. (Le scope tenant des missions sera applique a l'implementation Sprint 22.5.)
- **Validation strict** : Zod uniquement ; schemas exportes ; `const Schema = z.object(...)` ; `type X = z.infer<typeof Schema>`. Les inputs (`DesignateMissionInput`, `OnboardOperatorInput`) proviennent des schemas 2.5.2.
- **Logger strict** : Pino injecte (`PinoLogger` de nestjs-pino) ; jamais `console.log` ; champs JSON structures `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; engine-strict Node >= 22.11.0 ; save-exact ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; couverture >= 85% (>= 90% pour auth/database/signature).
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles v3.0.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; schema Zod par evenement ; `Idempotency-Key` pour les operations critiques.
- **Imports strict** : `@insurtech/{name}` ; paths via `tsconfig.base.json` ; ordre Node / external / `@insurtech` / relatif.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un modele frontier ; mock sprints 1-28, reel sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; CI echoue si emoji.
- **Idempotency-Key strict** : POST `/payments`, `/signatures`, `/claims`, ecritures MCP ; TTL 24h Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee d'assure ne quitte le Maroc ; AES-256-GCM ; TLS 1.3.
- **Naming v3.0 (decision-011)** : Skalean (entreprise), Assurflow (vertical), Sofidemy (marque).

### 14.1 Application de chaque convention a CETTE tache

Toutes les conventions ne se materialisent pas dans un squelette ; le tableau ci-dessous precise lesquelles sont actives ici et lesquelles sont deferees :

| Convention | Active en 2.5.8 ? | Comment / pourquoi |
|------------|-------------------|--------------------|
| Multi-tenant strict | Deferee (22.5) | Pas d'acces donnees ; `tenantId` resolu du contexte a l'implementation. |
| Validation strict (Zod) | Heritee (2.5.2) | Les inputs viennent des schemas Zod ; le squelette ne re-valide pas. |
| Logger strict | ACTIVE | PinoLogger injecte + setContext + `{ action }` ; aucun console.*. |
| Hash strict | N/A | Aucun mot de passe manipule dans le vertical Tow. |
| Package manager strict | ACTIVE | pnpm + save-exact + engine Node >= 22.11.0. |
| TypeScript strict | ACTIVE | Toutes les options strictes ; `unknown` plutot que `any`. |
| Tests strict | ACTIVE | Chaque service a son .spec.ts ; couverture >= 85%. |
| RBAC strict | Deferee (22.5) | `@Roles()` ajoute au niveau des controleurs API, pas du service squelette. |
| Events strict | Deferee (22.5) | Evenements Kafka emis a l'implementation (voir table 16bis.2). |
| Imports strict | ACTIVE | Ordre Node/external/@insurtech/relatif ; chemins relatifs vers types. |
| Skalean AI strict | N/A | Aucun appel IA dans le vertical Tow. |
| No-emoji strict | ACTIVE | Verifie par check-no-emoji.sh. |
| Idempotency-Key strict | Deferee (22.5) | Applique aux operations critiques a l'implementation. |
| Conventional Commits | ACTIVE | Message de commit conforme (section 16). |
| Cloud souverain strict | ACTIVE (par defaut) | Aucun I/O = aucune fuite ; DC marocains a l'implementation. |
| Naming v3.0 | ACTIVE | Skalean / Assurflow / Sofidemy employes correctement. |

### 14.2 Note sur l'ordre des imports (convention imports strict)

Dans chaque fichier de service, l'ordre est :

1. **External NestJS / nestjs-pino** : `@nestjs/common`, puis `nestjs-pino`.
2. **Types relatifs** : `import type { ... } from '../types/...'`.

Il n'y a pas d'import `@insurtech/*` dans les services (le package ne depend d'aucun autre package metier). Dans les `.spec.ts`, l'ordre est : external (`@nestjs/common`, `nestjs-pino`, `vitest`) puis import relatif du service teste. ESLint `import/order` valide cet ordonnancement.

---

## 15. Validation pre-commit

```bash
# 1. Format + lint
pnpm --filter @insurtech/tow lint

# 2. Typecheck strict
pnpm --filter @insurtech/tow typecheck

# 3. Build
pnpm --filter @insurtech/tow build

# 4. Tests + couverture
pnpm --filter @insurtech/tow test -- --coverage

# 5. Aucune emoji
bash scripts/check-no-emoji.sh packages/tow

# 6. Aucun console.*
grep -rn "console\." packages/tow/src && echo "ECHEC console interdit" || echo "OK aucun console"

# 7. Messages NotImplementedException alignes sur la deferral map
grep -rn "NotImplementedException(" packages/tow/src/services
```

Tous doivent etre verts avant `git commit`. Le hook husky `pre-commit` execute lint + typecheck ; le hook `commit-msg` execute commitlint.

---

## 16. Commit message

```
feat(sprint-7.5b): services squelettes @insurtech/tow signatures

Cree les trois services squelettes contractuels du vertical Assurflow Tow
(depannage) dans packages/tow/src/services :

- TowOperatorsService : onboardOperator, approveKyb, rejectKyb,
  toggleAvailability, suspendOperator, searchOperators (6 methodes).
- TowMissionsService : designateMission, acceptMission, rejectMission,
  transitionStatus, cancelMission, listMyMissions (6 methodes).
- TowHonorairesService : computeHonoraire, readEarnings, invoiceHonoraire
  (3 methodes).

Chaque service est @Injectable, injecte PinoLogger (setContext), journalise
un evenement structure { action, ... } puis lève NotImplementedException
dont le message nomme le sprint/tache d'implementation future. Logique
metier deferee au Sprint 22.5 (machine a etats 9 statuts, matching
geographique, calcul honoraires).

Met a jour le barrel index.ts (export des 3 services + HonoraireBreakdown)
et ajoute TowModule (@Module, providers + exports). Ajoute nestjs-pino et
@nestjs/common en peer/dev dependencies.

Tests : 32 it() Vitest verifiant que chaque service est defini et que
chaque methode lève NotImplementedException (contrat teste). Aucune emoji.

Task: 2.5.8
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: defere sprint 22.5
```

---

## 16 bis. Guide de remplacement Sprint 22.5 (annexe d'implementation future)

Cette annexe documente, methode par methode, comment l'implementeur du Sprint 22.5 transformera chaque squelette en logique reelle, **sans modifier la signature**. Elle sert de contrat de continuite : la surface d'API ne doit pas bouger.

### 16bis.1 Regle generale de remplacement

Pour chaque methode, le remplacement consiste a :

1. Conserver **strictement** la signature (nom, parametres, types, type de retour `Promise<T>`).
2. Remplacer le bloc `this.logger.warn({ action }, '...squelette...'); throw new NotImplementedException(...)` par :
   - un log de **debut** (`this.logger.info({ action, ... }, 'debut');`),
   - la logique metier reelle (acces repository, regles, evenements Kafka, idempotence),
   - un log de **fin** avec `duration_ms`,
   - un `return` du resultat type.
3. Injecter les **dependances supplementaires** (repositories, producteur Kafka, service de notification) via le constructeur, en ajoutant des parametres APRES `PinoLogger` (l'ordre des autres injections n'impacte pas les appelants).
4. Mettre a jour le **`.spec.ts`** correspondant : remplacer le test « lève NotImplementedException » par des tests de comportement (cas nominal, cas d'erreur, cas limites), et fournir des mocks des nouvelles dependances.
5. Ne **jamais** changer le barrel ni le `TowModule` au-dela de l'ajout eventuel de nouveaux providers internes (le `TowModule` continue d'exporter les memes 3 services publics).

### 16bis.2 Table de remplacement par methode

| Methode | Dependances a injecter (22.5) | Effets de bord a ajouter | Evenement Kafka emis |
|---------|-------------------------------|---------------------------|----------------------|
| `designateMission` | TowMissionRepository, MatchingEngine, NotificationService | matching geo, creation mission, notification operateur | `insurtech.events.tow.mission.designated` |
| `acceptMission` | TowMissionRepository, NotificationService | transition DESIGNATED->ACCEPTED, demarrage minuteur | `insurtech.events.tow.mission.accepted` |
| `rejectMission` | TowMissionRepository, MatchingEngine | transition ->REJECTED, relance matching | `insurtech.events.tow.mission.rejected` |
| `transitionStatus` | TowMissionRepository, StateMachine, NotificationService, KafkaProducer | validation transition, gardes, idempotence | `insurtech.events.tow.mission.<status>` |
| `cancelMission` | TowMissionRepository, PenaltyService | transition ->CANCELLED, calcul penalite | `insurtech.events.tow.mission.cancelled` |
| `listMyMissions` | TowMissionRepository | scope tenant + operateur, pagination | (lecture, aucun) |
| `onboardOperator` | TowOperatorRepository, KybService | creation operateur KYB_PENDING | `insurtech.events.tow.operator.onboarded` |
| `approveKyb` | TowOperatorRepository, KybService | transition KYB_PENDING->KYB_APPROVED | `insurtech.events.tow.operator.kyb_approved` |
| `rejectKyb` | TowOperatorRepository, NotificationService | transition ->KYB_REJECTED | `insurtech.events.tow.operator.kyb_rejected` |
| `toggleAvailability` | TowOperatorRepository, MatchingEngine | maj flag, reindexation matching | `insurtech.events.tow.operator.availability_changed` |
| `suspendOperator` | TowOperatorRepository, MatchingEngine | transition ->SUSPENDED, retrait matching | `insurtech.events.tow.operator.suspended` |
| `searchOperators` | TowOperatorRepository, MatchingEngine | filtres geo + dispo, tri proximite | (lecture, aucun) |
| `computeHonoraire` | TowMissionRepository, TariffEngine | calcul base + extras, precision decimale | (lecture, aucun) |
| `readEarnings` | HonoraireRepository | agregation par periode | (lecture, aucun) |
| `invoiceHonoraire` | HonoraireRepository, InvoiceService, PaymentService | generation facture, reglement | `insurtech.events.tow.honoraire.invoiced` |

### 16bis.3 Invariants a preserver lors du remplacement

- **Idempotence** : `transitionStatus`, `acceptMission`, `cancelMission` et `invoiceHonoraire` sont des operations critiques ; au Sprint 22.5 elles devront honorer `Idempotency-Key` (TTL 24h Redis).
- **Multi-tenant** : toutes les lectures/ecritures passeront par le scope `AsyncLocalStorage` + RLS `app_can_access_tenant()`. Les signatures n'exposent pas `tenantId` car il est resolu du contexte de requete, pas passe en argument.
- **Audit trail** : chaque ecriture (designation, transition, suspension, facturation) ecrira une entree d'audit.
- **Precision decimale** : `HonoraireBreakdown` reste en `string` MAD ; aucune conversion en `number` n'est autorisee dans le pipeline financier.
- **Logger** : le pattern `{ action, ... }` est conserve et enrichi de `duration_ms` ; jamais de `console.*`.

## 16 ter. Glossaire

| Terme | Definition |
|-------|------------|
| Squelette contractuel | Service avec signatures completes mais corps `log + throw NotImplementedException`, fige le contrat avant l'implementation. |
| Deferral map | Table associant chaque methode squelette a sa tache d'implementation future (section 3.2). |
| Carrier | Compagnie d'assurance (assureur) declenchant les missions de depannage. |
| Operateur (tow operator) | Prestataire de depannage / remorquage execute les missions. |
| KYB | Know Your Business : verification d'identite et de conformite d'un partenaire professionnel. |
| Machine a etats (9 statuts) | Sequence de statuts d'une mission, de PENDING_DESIGNATION a COMPLETED, plus REJECTED/CANCELLED. |
| Matching geographique | Selection du meilleur operateur disponible par proximite de la position du sinistre. |
| Honoraire | Remuneration de l'operateur pour une mission (base distance + extras). |
| MAD | Dirham marocain ; les montants sont manipules en chaines decimales. |
| Contract-first | Strategie consistant a figer les interfaces avant d'implementer la logique, pour debloquer les appelants. |
| NotImplementedException | Exception NestJS mappee HTTP 501 ; semantique « reconnu mais non disponible ». |
| Barrel | Fichier `index.ts` re-exportant le contenu public d'un package. |

## 16 quater. FAQ

**Q : Pourquoi journaliser en `warn` et non en `error` ?** Un appel a une methode squelette n'est pas une erreur systeme mais un usage premature d'une fonctionnalite non encore livree. `warn` signale l'anomalie sans declencher d'alerte critique. L'exception levee (501) porte deja la semantique d'erreur cote HTTP.

**Q : Faut-il un test « le message contient le sprint » pour CHAQUE methode ?** Non requis pour chacune (le seuil de 22 it() est atteint), mais au moins un par service est present (V11-V15 couvrent les messages les plus structurants). L'implementeur peut en ajouter.

**Q : Le `TowModule` doit-il configurer nestjs-pino ?** Non. La configuration `LoggerModule.forRoot()` est de la responsabilite de l'application hote. Le `TowModule` suppose `PinoLogger` injectable. Les tests unitaires fournissent un mock ; les tests d'integration (2.5.9) fourniront un `LoggerModule` de test.

**Q : Que se passe-t-il si l'API appelle une methode squelette en production avant le Sprint 22.5 ?** Le client recoit un HTTP 501 Not Implemented, et un log `warn` structure `{ action, ... }` est emis. C'est volontaire et diagnosticable. Les endpoints amont devraient etre masques par un feature flag jusqu'au Sprint 22.5.

**Q : Pourquoi `readEarnings` et `invoiceHonoraire` retournent `Promise<unknown>` ?** Leur forme de retour (recapitulatif de gains, facture) n'est pas encore modelisee en 2.5.2 et sera typee au Sprint 22.5. `unknown` (et non `any`) force les appelants a narrower avant usage, respectant `noImplicitAny`.

**Q : Peut-on supprimer le throw et juste retourner un mock pour debloquer une demo ?** Non. Cela violerait decision-012 et casserait les tests « lève NotImplementedException ». Pour une demo, utiliser un mock au niveau de l'injection (provider de test), pas dans le service lui-meme.

**Q : Pourquoi ce fichier de tache est-il aussi detaille pour 1h d'effort ?** L'effort d'1h concerne l'ecriture du code (corps triviaux). Le fichier est dense pour etre **auto-suffisant** : Claude Code doit pouvoir produire les 9 fichiers sans relire aucune autre source. Le detail (deferral map, table 9.2, criteres) elimine toute ambiguite et garantit la conformite aux conventions skalean-insurtech des le premier jet.

**Q : Faut-il versionner le package en 3.0.0 ?** Oui, aligne sur la version v3.0 du programme (decision-011). Les changements de signature au Sprint 22.5 (s'il y en a) suivront le semver du monorepo.

## 17. Workflow next step

Une fois cette tache validee (tous criteres V1-V32 verts, commit effectue), passer a :

**task-2.5.9 — Documentation extension paths + tests d'integration @insurtech/tow.**

La tache 2.5.9 :

1. Documente les **chemins d'extension** (extension paths) : ou et comment l'implementeur du Sprint 22.5 remplacera chaque corps `log + throw` par la logique reelle, en preservant les signatures figees ici.
2. Ajoute des **tests d'integration NestJS** qui demarrent un `TestingModule` important `TowModule` (+ `LoggerModule` nestjs-pino mocke), verifient le **wiring DI** du conteneur (les 3 services sont resolvables et exportes) et confirment que l'injection de `PinoLogger` fonctionne.
3. Verifie que le `TowModule` est importable dans un `AppModule` factice sans erreur de resolution de dependances.

Prerequis pour 2.5.9 : cette tache (2.5.8) doit etre completement verte, car 2.5.9 importe `TowModule` et les 3 services depuis le barrel.

### 17.1 Position dans le pipeline de la Phase 2

```
2.5.7 (scaffolding)  -->  [2.5.8 services squelettes]  -->  2.5.9 (docs + integration)
   package pret           contrats figes + tests             wiring DI verifie
                                                              fin Foundation Tow
```

A l'issue de 2.5.9, la Foundation du vertical Tow est complete : types, services squelettes, module, tests unitaires et d'integration. Le vertical est alors **pret a etre cable** par l'API gateway (sprints intermediaires) et **pret a etre rempli** au Sprint 22.5.

### 17.2 Checklist de remise (handoff) vers 2.5.9

- [ ] Les 3 services compilent, lintent et testent au vert.
- [ ] `TowModule` exporte les 3 services.
- [ ] Le barrel `index.ts` exporte services + module + `HonoraireBreakdown`.
- [ ] `package.json` declare nestjs-pino + @nestjs/common (peer + dev).
- [ ] Aucun emoji, aucun console.*, aucun any non justifie.
- [ ] Commit conforme cree et pousse.
- [ ] La table 9.2 (comportement par methode) correspond exactement au code.

### 17.3 Checklist finale avant merge (pre-merge gate)

1. `pnpm --filter @insurtech/tow build` -> exit 0.
2. `pnpm --filter @insurtech/tow typecheck` -> 0 erreur.
3. `pnpm --filter @insurtech/tow lint` -> 0 warning.
4. `pnpm --filter @insurtech/tow test -- --coverage` -> >= 22 it() verts, couverture >= 85%.
5. `grep -rn "console\." packages/tow/src` -> vide.
6. `bash scripts/check-no-emoji.sh packages/tow` -> exit 0.
7. Revue humaine : chaque corps de methode = log + throw uniquement (decision-012).
8. Commitlint vert sur le message de commit.

Si l'un de ces points echoue, la PR est bloquee jusqu'a correction.

---

<!--
  Skalean InsurTech v3.0 - Assurflow
  Task 2.5.8 (reference B-7.5b) - Services squelettes @insurtech/tow
  Sprint 7.5b / Phase 2 / Sprint 5
  Implementation deferee Sprint 22.5 (decision-012)
  AUCUNE EMOJI (decision-006 ABSOLUE)
  Fin du fichier de tache.
-->
