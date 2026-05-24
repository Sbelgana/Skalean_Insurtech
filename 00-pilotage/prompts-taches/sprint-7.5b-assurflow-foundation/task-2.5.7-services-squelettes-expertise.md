# Task 2.5.7 -- Services squelettes @insurtech/expertise (signatures + NotImplementedException)

## 1. Header

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5b (Assurflow Foundation) |
| Reference | B-7.5b -- tache renumerotee 2.5.7 |
| Phase | 2 (Foundation packages metier) |
| Priorite | P0 (bloquant pour Sprint 8+) |
| Effort estime | 1h |
| Dependances | 2.5.6 (schemas Zod @insurtech/expertise livres) |
| Bloque | 2.5.8 (services squelettes @insurtech/tow) |
| Package cible | `@insurtech/expertise` |
| Repertoire | `repo/packages/expertise/src/services/` |
| Densite attendue | 80-150 ko |
| Emoji | AUCUNE EMOJI (decision-006, ABSOLUE) |
| Langue | Prose francaise, code TypeScript/NestJS |
| Auteur | Equipe Plateforme Skalean |
| Statut | A IMPLEMENTER |

Cette tache fait partie du Sprint 7.5b dont l'objectif est de poser les fondations
compilables et exportables des packages metier de la verticale Assurflow avant le
demarrage des sprints fonctionnels (Sprint 8 et au-dela). Elle ne livre PAS de logique
metier : elle livre la SURFACE DE CONTRAT (signatures de methodes typees) des quatre
services du domaine expertise, accompagnee de squelettes qui journalisent puis levent
explicitement une `NotImplementedException`. L'implementation reelle est differee aux
Sprints 14 (catalogue + affectations) et 22.7 (validation devis + rapports).

---

## 2. But

Creer les quatre fichiers de service squelette du package `@insurtech/expertise` :

1. `experts-catalog.service.ts` -- `ExpertsCatalogService`
2. `expert-assignments.service.ts` -- `ExpertAssignmentsService`
3. `expert-validation.service.ts` -- `ExpertValidationService`
4. `expert-reports-basic.service.ts` -- `ExpertReportsBasicService`

Chaque service est une classe NestJS `@Injectable()` qui expose des methodes aux
SIGNATURES COMPLETES (parametres types + types de retour issus des types et schemas
livres par la tache 2.5.1). Le corps de chaque methode :

1. journalise un objet structure `{ action, ... }` via `PinoLogger` (jamais `console.log`) ;
2. leve immediatement `throw new NotImplementedException('Sprint XX Tache Y.Z -- ...')`.

Le message de la `NotImplementedException` nomme le sprint et la tache exacts qui
implementeront la methode :

- `ExpertsCatalogService` -> `'Sprint 14 Tache 4.1.15 -- implementation defere'`
- `ExpertAssignmentsService` -> `'Sprint 14 Tache 4.1.16 -- implementation defere'`
- `ExpertValidationService` -> `'Sprint 22.7 -- validation devis ligne par ligne decimal.js'`
- `ExpertReportsBasicService` -> `'Sprint 22.7 -- signature Barid eSign + transitions'`

Le barrel `index.ts` du package est mis a jour pour exporter les quatre services, et un
module NestJS `ExpertiseModule` (squelette `@Module`) est ajoute pour cabler les quatre
providers. Des tests Vitest verifient que chaque service est defini et que chacune de ses
methodes leve bien `NotImplementedException`.

L'objectif strategique : permettre aux sprints aval ET a la couche API d'importer,
referencer et typer ces services des maintenant, contre une signature STABLE, sans
attendre l'implementation. Le contrat est fige ; seul le corps reste a remplir.

---

## 3. Contexte etendu

### 3.1. Pourquoi des squelettes maintenant (approche contract-first)

La verticale Assurflow v3.0 est construite par couches. Les packages de fondation
(`@insurtech/expertise`, `@insurtech/tow`, `@insurtech/claims`, etc.) doivent COMPILER et
EXPORTER leur surface publique avant que les sprints fonctionnels et la couche API ne
commencent a s'y rattacher. Si l'on attendait l'implementation complete de chaque service
avant d'exposer sa signature, on creerait un goulet d'etranglement : la couche API
(`apps/api`), les controleurs, les tests d'integration, les contrats OpenAPI et les autres
packages dependants seraient bloques jusqu'a la fin du Sprint 22.7.

L'approche retenue est dite contract-first : on fige d'abord la SIGNATURE (le contrat
TypeScript), puis on remplit le corps plus tard. Les avantages :

- **Parallelisation** : pendant que le Sprint 14 implementera le catalogue d'experts,
  l'equipe API pourra deja ecrire les controleurs qui injectent `ExpertsCatalogService`
  et appellent `onboardExpert(...)`, en sachant exactement le type des parametres et du
  retour. Le compilateur TypeScript valide la coherence sans que la logique existe.
- **Stabilite du typage** : les types `Expert`, `ExpertAssignment`, `ExpertReport` et les
  schemas d'entree (`OnboardExpertInput`, etc.) sont importes depuis le package lui-meme
  (livres en 2.5.1). Toute la chaine aval se compile contre ces types. Un changement de
  signature plus tard sera detecte par le compilateur sur l'ensemble du monorepo.
- **Detection precoce des trous de conception** : ecrire les signatures completes oblige a
  reflechir aux parametres (`currentUserId`, `reviewerUserId`, `reason`, `payload`) et aux
  retours des maintenant. Les manques de modelisation ressortent immediatement, pas au
  Sprint 22.7.
- **Documentation vivante** : chaque methode porte une JSDoc decrivant le comportement
  FUTUR et le sprint qui l'implementera. Le squelette devient un cahier des charges
  executable.

### 3.2. La carte de differement (deferral map)

Chaque methode est rattachee au sprint qui la rendra fonctionnelle. Cette carte est encodee
DANS le code (message de la `NotImplementedException`) ET reproduite ici :

| Service | Methode | Sprint d'implementation | Tache |
|---------|---------|-------------------------|-------|
| ExpertsCatalogService | onboardExpert | Sprint 14 | 4.1.15 |
| ExpertsCatalogService | approveKyb | Sprint 14 | 4.1.15 |
| ExpertsCatalogService | rejectKyb | Sprint 14 | 4.1.15 |
| ExpertsCatalogService | suspendExpert | Sprint 14 | 4.1.15 |
| ExpertsCatalogService | checkAgrementExpiry | Sprint 14 | 4.1.15 |
| ExpertsCatalogService | searchExperts | Sprint 14 | 4.1.15 |
| ExpertAssignmentsService | designateExpert | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | acceptAssignment | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | rejectAssignment | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | scheduleVisit | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | recordVisit | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | completeAssignment | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | cancelAssignment | Sprint 14 | 4.1.16 |
| ExpertAssignmentsService | listAssignments | Sprint 14 | 4.1.16 |
| ExpertValidationService | validateDevis | Sprint 22.7 | validation devis |
| ExpertValidationService | modifyDevis | Sprint 22.7 | validation devis |
| ExpertValidationService | rejectDevis | Sprint 22.7 | validation devis |
| ExpertReportsBasicService | createReport | Sprint 22.7 | rapports + signature |
| ExpertReportsBasicService | submitReport | Sprint 22.7 | rapports + signature |
| ExpertReportsBasicService | getReport | Sprint 22.7 | rapports + signature |
| ExpertReportsBasicService | listReports | Sprint 22.7 | rapports + signature |

### 3.3. NotImplementedException comme contrat explicite et teste

Un point ESSENTIEL de conception : `NotImplementedException` n'est PAS un placeholder
toleré faute de mieux. C'est un CONTRAT EXPLICITE, assertable par les tests :

- Une methode squelette qui retournerait `null` ou `undefined`, ou qui retournerait un objet
  vide, serait dangereuse : un appelant aval pourrait croire qu'elle fonctionne et batir
  dessus une logique fausse. Un `null` silencieux se propage et explose loin de la source.
- `NotImplementedException` (HTTP 501 cote NestJS) echoue BRUYAMMENT et IMMEDIATEMENT.
  Tout appel en production ou en test d'integration aval leve une erreur claire portant le
  sprint d'implementation dans le message. Impossible de batir par erreur sur du vide.
- Les tests squelette ASSERTENT ce comportement : chaque methode DOIT lever
  `NotImplementedException`. Si quelqu'un implemente partiellement une methode sans retirer
  ni adapter le test, le test rouge le signale. Le squelette est donc verrouille par des
  tests jusqu'a son implementation complete.
- Le message porte la tracabilite : `'Sprint 14 Tache 4.1.15 -- implementation defere'`
  permet a un developpeur qui rencontre l'exception de savoir IMMEDIATEMENT ou et quand la
  methode sera ecrite, sans chercher dans le backlog.

### 3.4. Alternatives etudiees et arbitrages

| Option | Description | Decision |
|--------|-------------|----------|
| A. Package vide | Ne rien livrer, attendre Sprint 14 | REJETEE -- bloque l'API et les sprints aval, casse la parallelisation |
| B. Squelettes (RETENUE) | Signatures completes + NotImplementedException + tests | RETENUE -- contrat stable, compilation, parallelisation, cout 1h |
| C. Implementation complete maintenant | Tout coder au Sprint 7.5b | REJETEE -- explose le scope du Sprint Foundation, melange fondation et fonctionnel, dette de coordination |
| D. Stubs retournant des mocks | Retourner des objets factices | REJETEE -- piege silencieux, faux positifs aval, masque les trous |

L'option B coute environ 1h, debloque immediatement les couches superieures, et fige le
contrat sans engager de logique prematuree. C'est l'equilibre cout/benefice optimal pour un
sprint de fondation.

### 3.5. Compromis (trade-offs)

- **Avantage** : surface stable, compilation garantie, parallelisation des sprints, doc
  vivante, detection precoce des manques de modelisation.
- **Cout** : risque que la signature evolue au Sprint 14/22.7 si la modelisation initiale
  etait incomplete. Mitigation : la JSDoc detaillee force la reflexion en amont ; un
  changement de signature reste detecte par le compilateur sur tout le monorepo.
- **Cout** : maintenance des tests squelette (ils devront etre adaptes a l'implementation).
  C'est voulu : le test rouge force a traiter consciemment chaque methode au moment de
  l'implementer.

### 3.6. Pieges identifies (a eviter absolument)

1. **Contexte de logger manquant** : oublier `this.logger.setContext(ServiceName.name)`
   dans le constructeur. Sans cela, les logs ne portent pas le nom du service et deviennent
   illisibles. OBLIGATOIRE dans chaque constructeur.
2. **Journaliser APRES le throw** : le `this.logger.xxx(...)` doit precéder le
   `throw new NotImplementedException(...)`. Apres le throw, le code est inatteignable. On
   journalise toujours AVANT de lever l'exception.
3. **Importer des types comme des valeurs** : `Expert`, `ExpertAssignment`, `ExpertReport`
   et les types d'entree sont des TYPES. Ils doivent etre importes avec
   `import type { ... }`. Un `import { Expert }` (sans `type`) sur un type pur peut casser
   l'arbre de dependances ou tomber sous `verbatimModuleSyntax`.
4. **NotImplementedException vs NotImplemented** : la classe NestJS s'appelle
   `NotImplementedException` (avec le suffixe `Exception`), pas `NotImplemented`. Importer
   depuis `@nestjs/common`.
5. **Imports de barrel circulaires** : le barrel `index.ts` ne doit pas creer de cycle.
   Les services importent depuis `../types/...` et `../schemas/...`, jamais depuis le barrel
   racine. Le barrel re-exporte les services ; il ne doit pas etre importe par eux.
6. **@Injectable sans module** : un service `@Injectable()` non declare dans un module
   NestJS ne sera pas injectable cote API. On livre donc un `ExpertiseModule` squelette qui
   liste les quatre providers (ou, a minima, on documente ce cablage pour le Sprint 14).
7. **nestjs-pino en peer/dev dependency** : `@nestjs/common` et `nestjs-pino` doivent etre
   declares (peer pour la lib, dev pour les tests). Sans cela, le typecheck echoue sur
   `PinoLogger` et `@Injectable`.
8. **console.log interdit** : decision logger strict. Aucun `console.log`, `console.error`,
   etc. Seul `PinoLogger` est autorise. Un script CI verifie l'absence de `console.`.
9. **Message d'exception incorrect** : le test assertera le TYPE `NotImplementedException`.
   Mais le message doit nommer le bon sprint/tache. Une faute ici casse la tracabilite.
10. **Type de retour relache** : ne pas typer le retour `Promise<any>`. Chaque methode
    retourne `Promise<Expert>`, `Promise<ExpertAssignment>`, `Promise<ExpertReport>`,
    `Promise<Expert[]>`, etc. Le contrat n'a de valeur que s'il est precisement type.
11. **Oubli du `async`** : les methodes retournent des `Promise<...>`. Les declarer `async`
    et lever l'exception donne une Promise rejetee proprement, coherente avec le contrat
    asynchrone reel. Le test devra alors `await expect(...).rejects.toThrow(...)`.
12. **PinoLogger injecte sans token** : `PinoLogger` s'injecte directement via le
    constructeur (`private readonly logger: PinoLogger`). En test, on le mocke avec un objet
    portant les methodes `info`, `warn`, `error`, `setContext`.

### 3.7. Decisions de reference

- **decision-012** : tous les packages metier de fondation exposent leurs services en
  contract-first ; squelette + `NotImplementedException` + tests des le sprint de fondation,
  implementation differee au sprint fonctionnel nomme.
- **decision-013** : tout differement DOIT etre trace dans le code par un message
  d'exception nommant explicitement le sprint et la tache cible ; interdiction de
  `// TODO` muet sans rattachement de sprint.
- **decision-006** : aucune emoji nulle part (ABSOLUE).
- **decision-005** : IA uniquement via `@insurtech/sky` ou MCP (sans objet ici, aucun appel
  IA dans ces squelettes mais rappele pour coherence).

---

## 4. Architecture context

### 4.1. Position dans le Sprint 7.5b

Tache 7 sur 9 de la sequence des packages de fondation Assurflow :

```
2.5.1  types + schemas @insurtech/expertise          [livre]
2.5.2  types + schemas @insurtech/tow                 [livre]
2.5.3  types + schemas @insurtech/claims              [livre]
2.5.4  fixtures + builders de test                    [livre]
2.5.5  config tsconfig/vitest des packages            [livre]
2.5.6  schemas Zod expertise finalises                [livre]  <- dependance directe
2.5.7  services squelettes @insurtech/expertise       [CETTE TACHE]  <- 7/9
2.5.8  services squelettes @insurtech/tow             [bloquee par 2.5.7]
2.5.9  barrel monorepo + verification compilation     [bloquee par 2.5.8]
```

### 4.2. Schema des quatre services et de leur remplissage futur

```
+---------------------------------------------------------------------------+
|                    @insurtech/expertise (package metier)                  |
|                                                                           |
|  src/                                                                     |
|   +-- types/         (livre 2.5.1)                                        |
|   |    +-- Expert, ExpertAssignment, ExpertReport, enums de statut        |
|   +-- schemas/       (livre 2.5.1 + 2.5.6)                                |
|   |    +-- OnboardExpertInput, DesignateExpertInput, RecordVisitInput ... |
|   +-- services/      (CETTE TACHE -- squelettes)                          |
|   |    |                                                                  |
|   |    +-- experts-catalog.service.ts ......... ExpertsCatalogService     |
|   |    |     onboardExpert / approveKyb / rejectKyb / suspendExpert       |
|   |    |     checkAgrementExpiry (cron) / searchExperts                   |
|   |    |     => NotImplementedException 'Sprint 14 Tache 4.1.15'          |
|   |    |                                                                  |
|   |    +-- expert-assignments.service.ts ...... ExpertAssignmentsService  |
|   |    |     designateExpert / acceptAssignment / rejectAssignment        |
|   |    |     scheduleVisit / recordVisit / completeAssignment             |
|   |    |     cancelAssignment / listAssignments                          |
|   |    |     => NotImplementedException 'Sprint 14 Tache 4.1.16'          |
|   |    |                                                                  |
|   |    +-- expert-validation.service.ts ....... ExpertValidationService   |
|   |    |     validateDevis / modifyDevis / rejectDevis                    |
|   |    |     => NotImplementedException 'Sprint 22.7 -- decimal.js'       |
|   |    |                                                                  |
|   |    +-- expert-reports-basic.service.ts .... ExpertReportsBasicService |
|   |          createReport / submitReport / getReport / listReports        |
|   |          => NotImplementedException 'Sprint 22.7 -- Barid eSign'      |
|   |                                                                       |
|   +-- expertise.module.ts ... ExpertiseModule (@Module) cable 4 providers |
|   +-- index.ts ............... barrel re-exporte types + schemas + 4 svc  |
+---------------------------------------------------------------------------+
                                   |
                                   | (consomme contre signature stable)
                                   v
   +-------------------------+   +-----------------------+   +----------------+
   | apps/api controleurs    |   | Sprint 14 (catalogue  |   | Sprint 22.7    |
   | injectent les services  |   | + affectations)       |   | (validation +  |
   | et typent les appels    |   | remplit les corps     |   | rapports)      |
   +-------------------------+   +-----------------------+   +----------------+
```

### 4.3. Flux de dependances internes

```
types/*.ts  ----import type---->  services/*.service.ts
schemas/*.ts -- import type ---->  services/*.service.ts
services/*.service.ts ---------->  expertise.module.ts (providers)
types + schemas + services + module --> index.ts (barrel, re-export uniquement)
```

Aucune dependance circulaire : les services ne dependent JAMAIS du barrel ; le barrel ne
fait que re-exporter.

### 4.4. Machine a etats encodee par le contrat (reference future)

Les signatures des services encodent implicitement les machines a etats qui seront
implementees aux Sprints 14 et 22.7. Elles sont reproduites ici pour que les couches aval
comprennent l'intention du contrat.

Cycle de vie de l'expert (ExpertsCatalogService) :

```
   onboardExpert
        |
        v
   [pending_kyb] --approveKyb--> [active] --suspendExpert--> [suspended]
        |                            ^
        |                            | (reactivation, Sprint 14)
        +--rejectKyb--> [rejected]   |
                                     |
        checkAgrementExpiry (cron) --+-- agrement expire --> [suspended]
```

Cycle de vie de l'affectation (ExpertAssignmentsService) :

```
   designateExpert
        |
        v
   [designated] --acceptAssignment--> [accepted] --scheduleVisit--> [scheduled]
        |                                                                |
        +--rejectAssignment--> [rejected]                       recordVisit
        |                                                                |
        +--cancelAssignment--> [cancelled] <----(a tout moment)         v
                                                                    [visited]
                                                                         |
                                                          completeAssignment
                                                                         |
                                                                         v
                                                                    [completed]
```

Cycle de vie du rapport (ExpertReportsBasicService + ExpertValidationService) :

```
   createReport
        |
        v
   [draft] --(validateDevis / modifyDevis / rejectDevis alimentent le rapport)-->
        |
   submitReport (signature Barid eSign)
        |
        v
   [submitted] --> [signed]
```

Ces transitions ne sont PAS implementees au Sprint 7.5b : seules les signatures qui les
declencheront sont posees. Les gardes de transition (verification de l'etat courant,
controle d'identite de l'acteur, idempotence) sont ajoutees aux Sprints 14 et 22.7.

---

## 5. Livrables checkables

1. Fichier `src/services/experts-catalog.service.ts` cree.
2. Fichier `src/services/expert-assignments.service.ts` cree.
3. Fichier `src/services/expert-validation.service.ts` cree.
4. Fichier `src/services/expert-reports-basic.service.ts` cree.
5. `ExpertsCatalogService` est `@Injectable()` avec `PinoLogger` injecte.
6. `ExpertAssignmentsService` est `@Injectable()` avec `PinoLogger` injecte.
7. `ExpertValidationService` est `@Injectable()` avec `PinoLogger` injecte.
8. `ExpertReportsBasicService` est `@Injectable()` avec `PinoLogger` injecte.
9. Chaque constructeur appelle `this.logger.setContext(<ServiceName>.name)`.
10. Les 6 methodes de `ExpertsCatalogService` ont des signatures completes typees.
11. Les 8 methodes de `ExpertAssignmentsService` ont des signatures completes typees.
12. Les 3 methodes de `ExpertValidationService` ont des signatures completes typees.
13. Les 4 methodes de `ExpertReportsBasicService` ont des signatures completes typees.
14. Chaque methode journalise un objet structure `{ action, ... }` avant le throw.
15. Chaque methode leve `NotImplementedException` avec le message du bon sprint/tache.
16. Aucun `console.log`/`console.*` dans les fichiers livres.
17. Tous les types metier sont importes via `import type`.
18. `NotImplementedException` est importe depuis `@nestjs/common`.
19. Fichier `src/expertise.module.ts` cree (`@Module` cablant les 4 providers).
20. Barrel `src/index.ts` mis a jour pour exporter les 4 services + le module.
21. Spec `experts-catalog.service.spec.ts` : defined + chaque methode throws.
22. Spec `expert-assignments.service.spec.ts` : defined + chaque methode throws.
23. Spec `expert-validation.service.spec.ts` : defined + chaque methode throws.
24. Spec `expert-reports-basic.service.spec.ts` : defined + chaque methode throws.
25. Au moins 24 `it()` cumules sur les 4 specs.
26. `pnpm --filter @insurtech/expertise typecheck` passe sans erreur.
27. `pnpm --filter @insurtech/expertise build` passe sans erreur.
28. `pnpm --filter @insurtech/expertise lint` passe sans erreur.
29. `pnpm --filter @insurtech/expertise test` passe (tous les it() verts).
30. `@nestjs/common` et `nestjs-pino` declares en peer/dev dans le package.json du package.

---

## 6. Fichiers crees / modifies

| Chemin (relatif au package `@insurtech/expertise`) | Action | Description |
|----------------------------------------------------|--------|-------------|
| `src/services/experts-catalog.service.ts` | CREE | ExpertsCatalogService (6 methodes squelette) |
| `src/services/expert-assignments.service.ts` | CREE | ExpertAssignmentsService (8 methodes squelette) |
| `src/services/expert-validation.service.ts` | CREE | ExpertValidationService (3 methodes squelette) |
| `src/services/expert-reports-basic.service.ts` | CREE | ExpertReportsBasicService (4 methodes squelette) |
| `src/services/experts-catalog.service.spec.ts` | CREE | Spec Vitest catalogue |
| `src/services/expert-assignments.service.spec.ts` | CREE | Spec Vitest affectations |
| `src/services/expert-validation.service.spec.ts` | CREE | Spec Vitest validation |
| `src/services/expert-reports-basic.service.spec.ts` | CREE | Spec Vitest rapports |
| `src/expertise.module.ts` | CREE | ExpertiseModule (@Module squelette) |
| `src/index.ts` | MODIFIE | Barrel : ajout export des 4 services + module |
| `package.json` | MODIFIE | Ajout peerDeps/devDeps @nestjs/common + nestjs-pino |

---

## 7. Code patterns COMPLETS

> Ces blocs sont le coeur de la tache. Reproduire les fichiers a l'identique en adaptant les
> chemins d'import aux noms exacts des fichiers de types/schemas livres en 2.5.1 (les chemins
> `../types/expert` etc. ci-dessous suivent la convention de nommage du package). Chaque
> methode porte une JSDoc decrivant le comportement FUTUR et le sprint qui l'implementera.

### 7.1. `src/services/experts-catalog.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { Expert } from '../types/expert';
import type { OnboardExpertInput } from '../schemas/onboard-expert.schema';

/**
 * Filtres de recherche d'experts dans le catalogue.
 *
 * Tous les champs sont optionnels. La recherche combine les filtres en ET logique.
 * `carrierTenantId` permet a un porteur de risque de restreindre la recherche aux
 * experts qu'il a references ou agrees pour son tenant.
 */
export interface SearchExpertsFilters {
  /** Specialites recherchees (auto, BTP, incendie, RC, etc.). */
  specialty?: string[];
  /** Zones geographiques couvertes (codes regions/prefectures Maroc). */
  zones?: string[];
  /** Statut de l'expert (active, suspended, pending_kyb, rejected, etc.). */
  status?: string;
  /** Tenant porteur de risque pour restreindre la recherche. */
  carrierTenantId?: string;
}

/**
 * Service de gestion du catalogue des experts (cabinets et experts independants).
 *
 * Responsabilites (a implementer au Sprint 14, Tache 4.1.15) :
 *  - onboarding d'un expert (creation + collecte des pieces KYB) ;
 *  - cycle de vie de l'agrement KYB (approbation, rejet) ;
 *  - suspension administrative ;
 *  - surveillance de l'expiration des agrements (cron quotidien) ;
 *  - recherche multicritere dans le catalogue.
 *
 * Etat actuel (Sprint 7.5b) : SQUELETTE. Toutes les methodes journalisent un evenement
 * structure puis levent une NotImplementedException nommant le sprint d'implementation.
 * Le contrat (signatures + types) est fige et consommable par les couches aval.
 */
@Injectable()
export class ExpertsCatalogService {
  /** Message de differement commun a toutes les methodes du catalogue. */
  private static readonly DEFER_MESSAGE = 'Sprint 14 Tache 4.1.15 -- implementation defere';

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ExpertsCatalogService.name);
  }

  /**
   * Enregistre (onboard) un nouvel expert dans le catalogue.
   *
   * Comportement futur (Sprint 14) : valide l'entree via le schema Zod OnboardExpertInput,
   * cree l'entite Expert au statut `pending_kyb`, declenche la collecte des pieces KYB,
   * emet l'evenement Kafka `insurtech.events.expertise.expert.onboarded`, ecrit l'audit
   * trail avec `currentUserId` comme acteur.
   *
   * @param input Donnees d'onboarding validees (raison sociale, agrement, specialites...).
   * @param currentUserId Identifiant de l'utilisateur initiateur (acteur de l'audit).
   * @returns L'expert cree au statut initial.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.15.
   */
  async onboardExpert(input: OnboardExpertInput, currentUserId: string): Promise<Expert> {
    this.logger.warn(
      { action: 'onboardExpert', currentUserId, specialty: input.specialty },
      ExpertsCatalogService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertsCatalogService.DEFER_MESSAGE);
  }

  /**
   * Approuve le dossier KYB d'un expert et le fait passer au statut `active`.
   *
   * Comportement futur (Sprint 14) : verifie que l'expert est `pending_kyb`, valide la
   * completude des pieces, passe le statut a `active`, horodate l'approbation avec
   * `reviewerUserId`, emet `insurtech.events.expertise.expert.kyb_approved`.
   *
   * @param expertId Identifiant de l'expert a approuver.
   * @param reviewerUserId Identifiant du reviewer KYB (acteur de l'audit).
   * @returns L'expert au statut `active`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.15.
   */
  async approveKyb(expertId: string, reviewerUserId: string): Promise<Expert> {
    this.logger.warn(
      { action: 'approveKyb', expertId, reviewerUserId },
      ExpertsCatalogService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertsCatalogService.DEFER_MESSAGE);
  }

  /**
   * Rejette le dossier KYB d'un expert avec un motif obligatoire.
   *
   * Comportement futur (Sprint 14) : passe le statut a `rejected`, persiste le motif,
   * notifie l'expert, emet `insurtech.events.expertise.expert.kyb_rejected`, ecrit l'audit.
   *
   * @param expertId Identifiant de l'expert dont le KYB est rejete.
   * @param reviewerUserId Identifiant du reviewer KYB (acteur de l'audit).
   * @param reason Motif du rejet (persistence + notification).
   * @returns L'expert au statut `rejected`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.15.
   */
  async rejectKyb(expertId: string, reviewerUserId: string, reason: string): Promise<Expert> {
    this.logger.warn(
      { action: 'rejectKyb', expertId, reviewerUserId, reason },
      ExpertsCatalogService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertsCatalogService.DEFER_MESSAGE);
  }

  /**
   * Suspend administrativement un expert actif avec un motif obligatoire.
   *
   * Comportement futur (Sprint 14) : passe le statut a `suspended`, empeche toute nouvelle
   * affectation, conserve les affectations en cours, emet
   * `insurtech.events.expertise.expert.suspended`, ecrit l'audit.
   *
   * @param expertId Identifiant de l'expert a suspendre.
   * @param reason Motif de la suspension (persistence + notification).
   * @returns L'expert au statut `suspended`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.15.
   */
  async suspendExpert(expertId: string, reason: string): Promise<Expert> {
    this.logger.warn(
      { action: 'suspendExpert', expertId, reason },
      ExpertsCatalogService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertsCatalogService.DEFER_MESSAGE);
  }

  /**
   * Verifie quotidiennement (cron) l'expiration des agrements ACAPS des experts.
   *
   * Comportement futur (Sprint 14) : tache planifiee quotidienne ; parcourt les experts
   * `active`, repere les agrements expirant sous 30 jours (alerte) ou expires (suspension
   * automatique), emet les evenements correspondants, ecrit l'audit systeme.
   *
   * @returns void (effet de bord : alertes et suspensions automatiques).
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.15.
   */
  async checkAgrementExpiry(): Promise<void> {
    this.logger.warn({ action: 'checkAgrementExpiry' }, ExpertsCatalogService.DEFER_MESSAGE);
    throw new NotImplementedException(ExpertsCatalogService.DEFER_MESSAGE);
  }

  /**
   * Recherche multicritere dans le catalogue des experts.
   *
   * Comportement futur (Sprint 14) : applique les filtres en ET logique sous contrainte
   * RLS multi-tenant, retourne la liste des experts correspondants, journalise la requete.
   *
   * @param filters Filtres optionnels combines en ET logique.
   * @returns Liste des experts correspondant aux filtres.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.15.
   */
  async searchExperts(filters: SearchExpertsFilters): Promise<Expert[]> {
    this.logger.warn({ action: 'searchExperts', filters }, ExpertsCatalogService.DEFER_MESSAGE);
    throw new NotImplementedException(ExpertsCatalogService.DEFER_MESSAGE);
  }
}
```

### 7.2. `src/services/expert-assignments.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { ExpertAssignment } from '../types/expert-assignment';
import type { DesignateExpertInput } from '../schemas/designate-expert.schema';
import type { RecordVisitInput } from '../schemas/record-visit.schema';

/**
 * Filtres de listing des affectations d'experts.
 *
 * Permet de filtrer par expert, par dossier sinistre, par statut d'affectation et par
 * tenant porteur de risque. Tous les champs sont optionnels (ET logique).
 */
export interface ListAssignmentsFilters {
  /** Identifiant de l'expert affecte. */
  expertId?: string;
  /** Identifiant du dossier sinistre lie. */
  claimId?: string;
  /** Statut de l'affectation (designated, accepted, scheduled, visited, completed...). */
  status?: string;
  /** Tenant porteur de risque. */
  carrierTenantId?: string;
}

/**
 * Service de gestion du cycle de vie des affectations d'experts a des dossiers sinistre.
 *
 * Responsabilites (a implementer au Sprint 14, Tache 4.1.16) :
 *  - designation d'un expert sur un dossier par le porteur de risque ;
 *  - acceptation/refus de l'affectation par l'expert ;
 *  - planification de la visite d'expertise ;
 *  - enregistrement du compte rendu de visite ;
 *  - cloture / annulation de l'affectation ;
 *  - listing multicritere des affectations.
 *
 * Etat actuel (Sprint 7.5b) : SQUELETTE. Toutes les methodes journalisent un evenement
 * structure puis levent une NotImplementedException nommant le sprint d'implementation.
 */
@Injectable()
export class ExpertAssignmentsService {
  /** Message de differement commun a toutes les methodes d'affectation. */
  private static readonly DEFER_MESSAGE = 'Sprint 14 Tache 4.1.16 -- implementation defere';

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ExpertAssignmentsService.name);
  }

  /**
   * Designe (affecte) un expert a un dossier sinistre.
   *
   * Comportement futur (Sprint 14) : valide l'entree via DesignateExpertInput, verifie que
   * l'expert est `active` et couvre la zone/specialite du sinistre, cree l'affectation au
   * statut `designated`, notifie l'expert, emet
   * `insurtech.events.expertise.assignment.designated`, ecrit l'audit avec `carrierUserId`.
   *
   * @param input Donnees de designation (expertId, claimId, contexte...).
   * @param carrierUserId Utilisateur du porteur de risque initiateur (audit).
   * @returns L'affectation creee au statut `designated`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async designateExpert(
    input: DesignateExpertInput,
    carrierUserId: string,
  ): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'designateExpert', carrierUserId, claimId: input.claimId },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Accepte une affectation par l'expert designe.
   *
   * Comportement futur (Sprint 14) : verifie que l'affectation est `designated` et que
   * `expertUserId` correspond a l'expert designe, passe au statut `accepted`, emet
   * `insurtech.events.expertise.assignment.accepted`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param expertUserId Utilisateur expert acceptant (audit).
   * @returns L'affectation au statut `accepted`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async acceptAssignment(assignmentId: string, expertUserId: string): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'acceptAssignment', assignmentId, expertUserId },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Refuse une affectation par l'expert designe avec un motif obligatoire.
   *
   * Comportement futur (Sprint 14) : passe au statut `rejected`, persiste le motif, notifie
   * le porteur de risque pour reaffectation, emet
   * `insurtech.events.expertise.assignment.rejected`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param expertUserId Utilisateur expert refusant (audit).
   * @param reason Motif du refus (persistence + notification).
   * @returns L'affectation au statut `rejected`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async rejectAssignment(
    assignmentId: string,
    expertUserId: string,
    reason: string,
  ): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'rejectAssignment', assignmentId, expertUserId, reason },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Planifie la visite d'expertise pour une affectation acceptee.
   *
   * Comportement futur (Sprint 14) : verifie que l'affectation est `accepted`, enregistre la
   * date/heure de visite, passe au statut `scheduled`, notifie l'assure et le porteur, emet
   * `insurtech.events.expertise.assignment.scheduled`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param scheduledAt Date et heure planifiees de la visite.
   * @returns L'affectation au statut `scheduled`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async scheduleVisit(assignmentId: string, scheduledAt: Date): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'scheduleVisit', assignmentId, scheduledAt: scheduledAt.toISOString() },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Enregistre le compte rendu de la visite d'expertise.
   *
   * Comportement futur (Sprint 14) : valide le payload via RecordVisitInput, attache les
   * constatations et pieces jointes, passe au statut `visited`, emet
   * `insurtech.events.expertise.assignment.visited`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param payload Donnees du compte rendu de visite (constatations, photos...).
   * @returns L'affectation au statut `visited`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async recordVisit(assignmentId: string, payload: RecordVisitInput): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'recordVisit', assignmentId },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Cloture une affectation dont l'expertise est terminee.
   *
   * Comportement futur (Sprint 14) : verifie que le rapport d'expertise est soumis, passe au
   * statut `completed`, declenche la suite du workflow sinistre, emet
   * `insurtech.events.expertise.assignment.completed`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @returns L'affectation au statut `completed`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async completeAssignment(assignmentId: string): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'completeAssignment', assignmentId },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Annule une affectation avec un motif obligatoire.
   *
   * Comportement futur (Sprint 14) : passe au statut `cancelled`, persiste le motif, libere
   * l'expert, emet `insurtech.events.expertise.assignment.cancelled`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param reason Motif de l'annulation (persistence + notification).
   * @returns L'affectation au statut `cancelled`.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async cancelAssignment(assignmentId: string, reason: string): Promise<ExpertAssignment> {
    this.logger.warn(
      { action: 'cancelAssignment', assignmentId, reason },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }

  /**
   * Liste les affectations selon des filtres multicriteres.
   *
   * Comportement futur (Sprint 14) : applique les filtres en ET logique sous contrainte RLS
   * multi-tenant, retourne la liste des affectations, journalise la requete.
   *
   * @param filters Filtres optionnels combines en ET logique.
   * @returns Liste des affectations correspondantes.
   * @throws NotImplementedException Implementation differee au Sprint 14 Tache 4.1.16.
   */
  async listAssignments(filters: ListAssignmentsFilters): Promise<ExpertAssignment[]> {
    this.logger.warn(
      { action: 'listAssignments', filters },
      ExpertAssignmentsService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertAssignmentsService.DEFER_MESSAGE);
  }
}
```

### 7.3. `src/services/expert-validation.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { ExpertReport } from '../types/expert-report';
import type { DevisModification } from '../types/devis-modification';

/**
 * Service de validation des devis par l'expert (validation ligne par ligne).
 *
 * Responsabilites (a implementer au Sprint 22.7) :
 *  - validation d'un devis (acceptation telle quelle) ;
 *  - modification d'un devis ligne par ligne (recalcul en arithmetique decimale exacte
 *    via decimal.js, jamais en flottant IEEE 754) ;
 *  - rejet d'un devis avec justification.
 *
 * La validation produit/alimente un rapport d'expertise (ExpertReport) qui conditionne le
 * paiement du sinistre : conformement au workflow ACAPS, aucune indemnisation n'est versee
 * avant validation du devis par l'expert agree.
 *
 * Etat actuel (Sprint 7.5b) : SQUELETTE. Toutes les methodes journalisent un evenement
 * structure puis levent une NotImplementedException nommant le sprint d'implementation.
 */
@Injectable()
export class ExpertValidationService {
  /** Message de differement commun a toutes les methodes de validation. */
  private static readonly DEFER_MESSAGE =
    'Sprint 22.7 -- validation devis ligne par ligne decimal.js';

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ExpertValidationService.name);
  }

  /**
   * Valide un devis tel quel et alimente le rapport d'expertise.
   *
   * Comportement futur (Sprint 22.7) : verifie l'affectation et l'identite de l'expert,
   * marque le devis comme valide sans modification, recalcule les totaux en decimal.js,
   * met a jour le rapport d'expertise, emet
   * `insurtech.events.expertise.devis.validated`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param devisId Identifiant du devis valide.
   * @param expertUserId Utilisateur expert validant (audit).
   * @returns Le rapport d'expertise mis a jour.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async validateDevis(
    assignmentId: string,
    devisId: string,
    expertUserId: string,
  ): Promise<ExpertReport> {
    this.logger.warn(
      { action: 'validateDevis', assignmentId, devisId, expertUserId },
      ExpertValidationService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertValidationService.DEFER_MESSAGE);
  }

  /**
   * Modifie un devis ligne par ligne et recalcule en arithmetique decimale exacte.
   *
   * Comportement futur (Sprint 22.7) : applique les modifications (quantites, prix unitaires,
   * lignes ajoutees/supprimees), recalcule chaque montant et le total via decimal.js (zero
   * arrondi flottant), met a jour le rapport d'expertise avec la trace des modifications,
   * emet `insurtech.events.expertise.devis.modified`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param devisId Identifiant du devis modifie.
   * @param modifications Liste des modifications ligne par ligne a appliquer.
   * @param expertUserId Utilisateur expert modifiant (audit).
   * @returns Le rapport d'expertise mis a jour avec les montants recalcules.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async modifyDevis(
    assignmentId: string,
    devisId: string,
    modifications: DevisModification[],
    expertUserId: string,
  ): Promise<ExpertReport> {
    this.logger.warn(
      {
        action: 'modifyDevis',
        assignmentId,
        devisId,
        expertUserId,
        modificationsCount: modifications.length,
      },
      ExpertValidationService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertValidationService.DEFER_MESSAGE);
  }

  /**
   * Rejette un devis avec une justification obligatoire.
   *
   * Comportement futur (Sprint 22.7) : marque le devis comme rejete, persiste la
   * justification, met a jour le rapport d'expertise, notifie les parties, emet
   * `insurtech.events.expertise.devis.rejected`, ecrit l'audit.
   *
   * @param assignmentId Identifiant de l'affectation.
   * @param devisId Identifiant du devis rejete.
   * @param justification Justification du rejet (persistence + notification).
   * @param expertUserId Utilisateur expert rejetant (audit).
   * @returns Le rapport d'expertise mis a jour.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async rejectDevis(
    assignmentId: string,
    devisId: string,
    justification: string,
    expertUserId: string,
  ): Promise<ExpertReport> {
    this.logger.warn(
      { action: 'rejectDevis', assignmentId, devisId, expertUserId, justification },
      ExpertValidationService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertValidationService.DEFER_MESSAGE);
  }
}
```

### 7.4. `src/services/expert-reports-basic.service.ts`

```typescript
import { Injectable, NotImplementedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { ExpertReport } from '../types/expert-report';

/**
 * Filtres de listing des rapports d'expertise.
 *
 * Permet de filtrer par affectation, par expert, par statut de rapport et par tenant.
 * Tous les champs sont optionnels (ET logique).
 */
export interface ListReportsFilters {
  /** Identifiant de l'affectation liee. */
  assignmentId?: string;
  /** Identifiant de l'expert auteur. */
  expertId?: string;
  /** Statut du rapport (draft, submitted, signed...). */
  status?: string;
  /** Tenant porteur de risque. */
  carrierTenantId?: string;
}

/**
 * Service basique de gestion des rapports d'expertise.
 *
 * Responsabilites (a implementer au Sprint 22.7) :
 *  - creation d'un rapport au statut `draft` ;
 *  - soumission du rapport (transition + signature electronique Barid eSign) ;
 *  - consultation d'un rapport ;
 *  - listing multicritere des rapports.
 *
 * La soumission du rapport implique la signature electronique via Barid eSign (prestataire
 * marocain) et les transitions d'etat associees. Ces mecanismes sont implementes au
 * Sprint 22.7.
 *
 * Etat actuel (Sprint 7.5b) : SQUELETTE. Toutes les methodes journalisent un evenement
 * structure puis levent une NotImplementedException nommant le sprint d'implementation.
 */
@Injectable()
export class ExpertReportsBasicService {
  /** Message de differement commun a toutes les methodes de rapports. */
  private static readonly DEFER_MESSAGE =
    'Sprint 22.7 -- signature Barid eSign + transitions';

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ExpertReportsBasicService.name);
  }

  /**
   * Cree un rapport d'expertise au statut `draft` pour une affectation.
   *
   * Comportement futur (Sprint 22.7) : verifie l'affectation et l'identite de l'expert, cree
   * le rapport au statut `draft` rattache a l'affectation, emet
   * `insurtech.events.expertise.report.created`, ecrit l'audit avec `expertUserId`.
   *
   * @param assignmentId Identifiant de l'affectation source.
   * @param expertUserId Utilisateur expert auteur (audit).
   * @returns Le rapport cree au statut `draft`.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async createReport(assignmentId: string, expertUserId: string): Promise<ExpertReport> {
    this.logger.warn(
      { action: 'createReport', assignmentId, expertUserId },
      ExpertReportsBasicService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertReportsBasicService.DEFER_MESSAGE);
  }

  /**
   * Soumet un rapport d'expertise (transition + signature Barid eSign).
   *
   * Comportement futur (Sprint 22.7) : verifie que le rapport est `draft` et complet,
   * declenche la signature electronique via Barid eSign, passe au statut `submitted` puis
   * `signed`, emet `insurtech.events.expertise.report.submitted`, ecrit l'audit.
   *
   * @param reportId Identifiant du rapport a soumettre.
   * @returns Le rapport au statut `submitted`/`signed`.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async submitReport(reportId: string): Promise<ExpertReport> {
    this.logger.warn(
      { action: 'submitReport', reportId },
      ExpertReportsBasicService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertReportsBasicService.DEFER_MESSAGE);
  }

  /**
   * Recupere un rapport d'expertise par son identifiant.
   *
   * Comportement futur (Sprint 22.7) : verifie les droits d'acces RLS multi-tenant, retourne
   * le rapport, journalise la consultation.
   *
   * @param reportId Identifiant du rapport.
   * @returns Le rapport demande.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async getReport(reportId: string): Promise<ExpertReport> {
    this.logger.warn(
      { action: 'getReport', reportId },
      ExpertReportsBasicService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertReportsBasicService.DEFER_MESSAGE);
  }

  /**
   * Liste les rapports d'expertise selon des filtres multicriteres.
   *
   * Comportement futur (Sprint 22.7) : applique les filtres en ET logique sous contrainte
   * RLS multi-tenant, retourne la liste des rapports, journalise la requete.
   *
   * @param filters Filtres optionnels combines en ET logique.
   * @returns Liste des rapports correspondants.
   * @throws NotImplementedException Implementation differee au Sprint 22.7.
   */
  async listReports(filters: ListReportsFilters): Promise<ExpertReport[]> {
    this.logger.warn(
      { action: 'listReports', filters },
      ExpertReportsBasicService.DEFER_MESSAGE,
    );
    throw new NotImplementedException(ExpertReportsBasicService.DEFER_MESSAGE);
  }
}
```

### 7.5. `src/expertise.module.ts` (squelette `@Module`)

```typescript
import { Module } from '@nestjs/common';

import { ExpertsCatalogService } from './services/experts-catalog.service';
import { ExpertAssignmentsService } from './services/expert-assignments.service';
import { ExpertValidationService } from './services/expert-validation.service';
import { ExpertReportsBasicService } from './services/expert-reports-basic.service';

/**
 * Module NestJS de la verticale expertise (Assurflow).
 *
 * Cable les quatre services du domaine expertise en tant que providers et les exporte pour
 * injection dans les modules consommateurs (couche API, autres modules metier).
 *
 * Etat actuel (Sprint 7.5b) : SQUELETTE. Les providers sont cables mais leurs corps levent
 * NotImplementedException. Le cablage de la persistence (repositories), du bus Kafka et des
 * dependances externes (Barid eSign, decimal.js) sera complete aux Sprints 14 et 22.7.
 *
 * Note : nestjs-pino fournit PinoLogger. Le module consommateur doit avoir importe le
 * LoggerModule de nestjs-pino a la racine de l'application pour que PinoLogger soit
 * resolvable a l'injection.
 */
@Module({
  providers: [
    ExpertsCatalogService,
    ExpertAssignmentsService,
    ExpertValidationService,
    ExpertReportsBasicService,
  ],
  exports: [
    ExpertsCatalogService,
    ExpertAssignmentsService,
    ExpertValidationService,
    ExpertReportsBasicService,
  ],
})
export class ExpertiseModule {}
```

### 7.6. `src/index.ts` (barrel -- ajout des exports)

```typescript
// Barrel du package @insurtech/expertise.
// Re-exporte uniquement la surface publique : types, schemas, services et module.
// IMPORTANT : ce barrel ne doit JAMAIS etre importe par les fichiers du package
// (risque de cycle). Il agrege pour les consommateurs externes uniquement.

// --- Types (livres en tache 2.5.1) ---
export type { Expert } from './types/expert';
export type { ExpertAssignment } from './types/expert-assignment';
export type { ExpertReport } from './types/expert-report';
export type { DevisModification } from './types/devis-modification';

// --- Schemas Zod (livres en taches 2.5.1 / 2.5.6) ---
export { OnboardExpertSchema } from './schemas/onboard-expert.schema';
export type { OnboardExpertInput } from './schemas/onboard-expert.schema';
export { DesignateExpertSchema } from './schemas/designate-expert.schema';
export type { DesignateExpertInput } from './schemas/designate-expert.schema';
export { RecordVisitSchema } from './schemas/record-visit.schema';
export type { RecordVisitInput } from './schemas/record-visit.schema';

// --- Services squelettes (tache 2.5.7) ---
export { ExpertsCatalogService } from './services/experts-catalog.service';
export type { SearchExpertsFilters } from './services/experts-catalog.service';
export { ExpertAssignmentsService } from './services/expert-assignments.service';
export type { ListAssignmentsFilters } from './services/expert-assignments.service';
export { ExpertValidationService } from './services/expert-validation.service';
export { ExpertReportsBasicService } from './services/expert-reports-basic.service';
export type { ListReportsFilters } from './services/expert-reports-basic.service';

// --- Module NestJS (tache 2.5.7) ---
export { ExpertiseModule } from './expertise.module';
```

> Note : les lignes de re-export des types/schemas existants doivent etre alignees sur ce
> qui a ete effectivement exporte en 2.5.1/2.5.6. N'ajouter QUE les blocs services + module
> si le barrel possedait deja ses exports de types/schemas. Ne pas dupliquer une ligne
> d'export existante (le typecheck signalerait une re-declaration).

### 7.7. `src/services/experts-catalog.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

import { ExpertsCatalogService } from './experts-catalog.service';
import type { OnboardExpertInput } from '../schemas/onboard-expert.schema';

/**
 * Construit un PinoLogger mocke (info/warn/error/debug + setContext).
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

describe('ExpertsCatalogService (squelette)', () => {
  let logger: PinoLogger;
  let service: ExpertsCatalogService;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new ExpertsCatalogService(logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom du service dans le constructeur', () => {
    expect(logger.setContext).toHaveBeenCalledWith('ExpertsCatalogService');
  });

  it('onboardExpert leve NotImplementedException et journalise avant le throw', async () => {
    const input = { specialty: ['auto'] } as unknown as OnboardExpertInput;
    await expect(service.onboardExpert(input, 'user-1')).rejects.toThrow(NotImplementedException);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'onboardExpert' }),
      expect.stringContaining('Sprint 14 Tache 4.1.15'),
    );
  });

  it('approveKyb leve NotImplementedException', async () => {
    await expect(service.approveKyb('exp-1', 'rev-1')).rejects.toThrow(NotImplementedException);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approveKyb' }),
      expect.any(String),
    );
  });

  it('rejectKyb leve NotImplementedException', async () => {
    await expect(service.rejectKyb('exp-1', 'rev-1', 'motif')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('suspendExpert leve NotImplementedException', async () => {
    await expect(service.suspendExpert('exp-1', 'motif')).rejects.toThrow(NotImplementedException);
  });

  it('checkAgrementExpiry leve NotImplementedException', async () => {
    await expect(service.checkAgrementExpiry()).rejects.toThrow(NotImplementedException);
  });

  it('searchExperts leve NotImplementedException', async () => {
    await expect(service.searchExperts({ specialty: ['auto'] })).rejects.toThrow(
      NotImplementedException,
    );
  });
});
```

### 7.8. `src/services/expert-assignments.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

import { ExpertAssignmentsService } from './expert-assignments.service';
import type { DesignateExpertInput } from '../schemas/designate-expert.schema';
import type { RecordVisitInput } from '../schemas/record-visit.schema';

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

describe('ExpertAssignmentsService (squelette)', () => {
  let logger: PinoLogger;
  let service: ExpertAssignmentsService;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new ExpertAssignmentsService(logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom du service', () => {
    expect(logger.setContext).toHaveBeenCalledWith('ExpertAssignmentsService');
  });

  it('designateExpert leve NotImplementedException', async () => {
    const input = { claimId: 'claim-1' } as unknown as DesignateExpertInput;
    await expect(service.designateExpert(input, 'carrier-1')).rejects.toThrow(
      NotImplementedException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'designateExpert' }),
      expect.stringContaining('Sprint 14 Tache 4.1.16'),
    );
  });

  it('acceptAssignment leve NotImplementedException', async () => {
    await expect(service.acceptAssignment('a-1', 'exp-1')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('rejectAssignment leve NotImplementedException', async () => {
    await expect(service.rejectAssignment('a-1', 'exp-1', 'motif')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('scheduleVisit leve NotImplementedException', async () => {
    await expect(service.scheduleVisit('a-1', new Date())).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('recordVisit leve NotImplementedException', async () => {
    const payload = { notes: 'rien' } as unknown as RecordVisitInput;
    await expect(service.recordVisit('a-1', payload)).rejects.toThrow(NotImplementedException);
  });

  it('completeAssignment leve NotImplementedException', async () => {
    await expect(service.completeAssignment('a-1')).rejects.toThrow(NotImplementedException);
  });

  it('cancelAssignment leve NotImplementedException', async () => {
    await expect(service.cancelAssignment('a-1', 'motif')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('listAssignments leve NotImplementedException', async () => {
    await expect(service.listAssignments({ status: 'designated' })).rejects.toThrow(
      NotImplementedException,
    );
  });
});
```

### 7.9. `src/services/expert-validation.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

import { ExpertValidationService } from './expert-validation.service';
import type { DevisModification } from '../types/devis-modification';

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

describe('ExpertValidationService (squelette)', () => {
  let logger: PinoLogger;
  let service: ExpertValidationService;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new ExpertValidationService(logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom du service', () => {
    expect(logger.setContext).toHaveBeenCalledWith('ExpertValidationService');
  });

  it('validateDevis leve NotImplementedException avec mention Sprint 22.7', async () => {
    await expect(service.validateDevis('a-1', 'd-1', 'exp-1')).rejects.toThrow(
      NotImplementedException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'validateDevis' }),
      expect.stringContaining('Sprint 22.7'),
    );
  });

  it('modifyDevis leve NotImplementedException', async () => {
    const mods = [] as DevisModification[];
    await expect(service.modifyDevis('a-1', 'd-1', mods, 'exp-1')).rejects.toThrow(
      NotImplementedException,
    );
  });

  it('rejectDevis leve NotImplementedException', async () => {
    await expect(service.rejectDevis('a-1', 'd-1', 'justification', 'exp-1')).rejects.toThrow(
      NotImplementedException,
    );
  });
});
```

### 7.10. `src/services/expert-reports-basic.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

import { ExpertReportsBasicService } from './expert-reports-basic.service';

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

describe('ExpertReportsBasicService (squelette)', () => {
  let logger: PinoLogger;
  let service: ExpertReportsBasicService;

  beforeEach(() => {
    logger = createLoggerMock();
    service = new ExpertReportsBasicService(logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('appelle setContext avec le nom du service', () => {
    expect(logger.setContext).toHaveBeenCalledWith('ExpertReportsBasicService');
  });

  it('createReport leve NotImplementedException avec mention Sprint 22.7', async () => {
    await expect(service.createReport('a-1', 'exp-1')).rejects.toThrow(NotImplementedException);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'createReport' }),
      expect.stringContaining('Sprint 22.7'),
    );
  });

  it('submitReport leve NotImplementedException', async () => {
    await expect(service.submitReport('r-1')).rejects.toThrow(NotImplementedException);
  });

  it('getReport leve NotImplementedException', async () => {
    await expect(service.getReport('r-1')).rejects.toThrow(NotImplementedException);
  });

  it('listReports leve NotImplementedException', async () => {
    await expect(service.listReports({ status: 'draft' })).rejects.toThrow(
      NotImplementedException,
    );
  });
});
```

---

## 8. Tests complets

Les quatre fichiers `.spec.ts` ci-dessus (sections 7.7 a 7.10) constituent la suite de tests
de cette tache. Recapitulatif du decompte des `it()` :

| Spec | `it()` | Detail |
|------|--------|--------|
| experts-catalog.service.spec.ts | 9 | defined + setContext + 6 methodes + assertion log onboardExpert |
| expert-assignments.service.spec.ts | 11 | defined + setContext + 8 methodes + assertion log designateExpert |
| expert-validation.service.spec.ts | 5 | defined + setContext + 3 methodes (+ assertion log/mention 22.7) |
| expert-reports-basic.service.spec.ts | 6 | defined + setContext + 4 methodes (+ assertion log/mention 22.7) |
| **TOTAL** | **31** | >= 24 requis |

### 8.1. Strategie de test

- **PinoLogger mocke** : aucun logger reel n'est instancie. Un objet mock portant
  `setContext`, `info`, `warn`, `error`, `debug`, `trace`, `fatal` (tous `vi.fn()`) est passe
  au constructeur. Cela isole le test et permet d'asserter les appels de journalisation.
- **`rejects.toThrow`** : les methodes etant `async`, elles retournent une Promise rejetee.
  On utilise `await expect(promise).rejects.toThrow(NotImplementedException)` pour verifier
  le type d'exception leve.
- **Assertion de journalisation avant throw** : pour au moins une methode par service, on
  verifie que `logger.warn` a ete appele avec un objet `{ action: '...' }` et un message
  contenant le sprint cible. Cela garantit que le log precede le throw (sinon, le log
  n'aurait pas eu lieu puisque l'exception interrompt l'execution).
- **Assertion setContext** : on verifie que le constructeur appelle
  `logger.setContext('<NomDuService>')`. Cela verrouille le piege n.1 (contexte de logger).

### 8.2. Pourquoi tester les squelettes

Tester des squelettes peut sembler redondant. Ce n'est pas le cas ici :

1. Les tests verrouillent le CONTRAT : si une methode est partiellement implementee sans
   adaptation du test, le test rouge force a traiter consciemment chaque differement.
2. Ils garantissent la coherence du message (sprint cible) et donc la tracabilite.
3. Ils valident que le squelette compile et s'instancie (constructeur correct, PinoLogger
   injectable).
4. Ils maintiennent la couverture du package au-dessus du seuil (decision tests strict
   >= 85%) meme avant l'implementation reelle.

---

## 9. Variables environnement

Ces squelettes ne consomment aucune variable a l'execution (ils levent avant tout effet de
bord). Les variables ci-dessous sont referencees pour COHERENCE : elles seront utilisees
lors de l'implementation reelle aux Sprints 14 et 22.7, et conditionnent deja la
configuration de journalisation Pino utilisee a l'instanciation.

| Variable | Type | Defaut | Role |
|----------|------|--------|------|
| `LOG_LEVEL` | string | `info` | Niveau de journalisation Pino (trace/debug/info/warn/error/fatal). |
| `NODE_ENV` | string | `development` | Environnement ; conditionne le formatage Pino (pretty en dev, JSON en prod). |
| `SERVICE_NAME` | string | `assurflow-api` | Nom de service injecte dans les logs structures. |
| `KAFKA_BROKERS` | string | (vide) | Brokers Kafka pour les evenements (utilise au Sprint 14, non au 7.5b). |
| `BARID_ESIGN_BASE_URL` | string | (vide) | Endpoint Barid eSign pour la signature des rapports (Sprint 22.7). |
| `BARID_ESIGN_API_KEY` | string | (vide) | Cle d'API Barid eSign (Sprint 22.7, stockee en coffre, jamais en clair). |

---

## 10. Commandes shell

```bash
# Typecheck du package (DOIT passer sans erreur)
pnpm --filter @insurtech/expertise typecheck

# Build du package
pnpm --filter @insurtech/expertise build

# Lint du package
pnpm --filter @insurtech/expertise lint

# Tests Vitest du package (tous les it() verts)
pnpm --filter @insurtech/expertise test

# Tests avec couverture
pnpm --filter @insurtech/expertise test -- --coverage

# Verification absence d'emoji (decision-006)
bash scripts/check-no-emoji.sh packages/expertise/src

# Verification absence de console.log
grep -rn "console\." packages/expertise/src --include="*.ts" | grep -v ".spec.ts" || echo "OK: aucun console."
```

---

## 11. Criteres de validation

### Priorite P0 (bloquants -- au moins 15)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V1 | Les 4 fichiers service existent | `ls packages/expertise/src/services/*.service.ts` | 4 fichiers listes | Fichier manquant |
| V2 | Typecheck passe | `pnpm --filter @insurtech/expertise typecheck` | Exit 0 | Erreur de type |
| V3 | Build passe | `pnpm --filter @insurtech/expertise build` | Exit 0 | Echec compilation |
| V4 | Tests passent | `pnpm --filter @insurtech/expertise test` | Tous verts | Test rouge |
| V5 | ExpertsCatalogService.onboardExpert throw NotImplementedException | test V4 | rejets.toThrow OK | Pas de throw |
| V6 | Toutes les methodes de ExpertsCatalogService throw | test V4 | 6/6 throw | Une methode ne throw pas |
| V7 | Toutes les methodes de ExpertAssignmentsService throw | test V4 | 8/8 throw | Une methode ne throw pas |
| V8 | Toutes les methodes de ExpertValidationService throw | test V4 | 3/3 throw | Une methode ne throw pas |
| V9 | Toutes les methodes de ExpertReportsBasicService throw | test V4 | 4/4 throw | Une methode ne throw pas |
| V10 | 0 console.log dans src (hors spec) | `grep -rn "console\." packages/expertise/src --include="*.ts"` | aucun match (hors spec) | console present |
| V11 | NotImplementedException importe de @nestjs/common | `grep -n "NotImplementedException" packages/expertise/src/services/experts-catalog.service.ts` | import present | mauvaise source |
| V12 | PinoLogger injecte + setContext appele | test V4 (assertion setContext) | OK | setContext non appele |
| V13 | Message Sprint 14 dans catalogue + assignments | `grep -rn "Sprint 14" packages/expertise/src/services` | matches present | mauvais message |
| V14 | Message Sprint 22.7 dans validation + reports | `grep -rn "Sprint 22.7" packages/expertise/src/services` | matches present | mauvais message |
| V15 | Barrel exporte les 4 services | `grep -n "Service" packages/expertise/src/index.ts` | 4 exports | export manquant |
| V16 | ExpertiseModule existe et cable 4 providers | `cat packages/expertise/src/expertise.module.ts` | 4 providers/exports | module manquant |
| V17 | 0 emoji dans src | `bash scripts/check-no-emoji.sh packages/expertise/src` | OK | emoji detecte |

### Priorite P1 (importants -- au moins 8)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V18 | Lint passe | `pnpm --filter @insurtech/expertise lint` | Exit 0 | violation lint |
| V19 | >= 24 it() cumules | `grep -rc "it(" packages/expertise/src/services/*.spec.ts` | somme >= 24 | trop peu de tests |
| V20 | import type pour Expert/ExpertAssignment/ExpertReport | `grep -n "import type" packages/expertise/src/services/*.service.ts` | present partout | import valeur |
| V21 | Chaque methode journalise { action } avant throw | test V4 (assertion warn) | OK | log apres throw |
| V22 | @nestjs/common + nestjs-pino declares | `cat packages/expertise/package.json` | presents en peer/dev | dependance manquante |
| V23 | Couverture >= 85% | `pnpm --filter @insurtech/expertise test -- --coverage` | >= 85% | couverture insuffisante |
| V24 | Pas de cycle barrel | `pnpm --filter @insurtech/expertise build` | Exit 0 | cycle detecte |
| V25 | Methodes async retournent Promise typee | inspection / typecheck | Promise<T> precise | Promise<any> |
| V26 | Aucun TODO muet (decision-013) | `grep -rn "TODO" packages/expertise/src --include="*.ts"` | aucun (ou rattache) | TODO sans sprint |

### Priorite P2 (souhaitables -- au moins 5)

| ID | Critere | Commande | Resultat attendu | Mode d'echec |
|----|---------|----------|------------------|--------------|
| V27 | JSDoc presente sur chaque methode | inspection | JSDoc + @throws | doc manquante |
| V28 | DEFER_MESSAGE statique factorise par service | inspection | const statique | message duplique en dur |
| V29 | Interfaces de filtres exportees et typees | `grep -n "Filters" packages/expertise/src/index.ts` | exportees | filtres inline any |
| V30 | Logger mocke complet dans les specs | inspection specs | helper createLoggerMock | mock incomplet |
| V31 | Ordre des imports respecte (Node/external/@insurtech/relative) | inspection | conforme | ordre incorrect |
| V32 | Module documente la dependance LoggerModule racine | inspection module | note JSDoc presente | non documente |

---

## 12. Edge cases et troubleshooting

1. **`PinoLogger` introuvable au typecheck** : `nestjs-pino` non installe en devDependency.
   Solution : `pnpm --filter @insurtech/expertise add -D nestjs-pino @nestjs/common` (ou en
   peer selon la convention monorepo) puis `pnpm install`.
2. **`NotImplementedException` undefined a l'execution** : import depuis le mauvais module.
   Doit etre `@nestjs/common`, pas `@nestjs/core` ni un module local.
3. **Test passe alors que la methode ne throw pas** : oubli du `await` devant `expect(...)`.
   Toujours `await expect(p).rejects.toThrow(...)` pour une methode async.
4. **`logger.setContext is not a function` en test** : le mock ne porte pas `setContext`.
   Utiliser `createLoggerMock()` complet (section 7.7).
5. **Cycle de dependances au build** : un service importe depuis `../index` (le barrel).
   Corriger en important directement depuis `../types/...` ou `../schemas/...`.
6. **`import type` casse a l'execution** : un type importe comme valeur avec
   `verbatimModuleSyntax` active. Verifier que tous les types metier utilisent `import type`.
7. **Re-declaration au barrel** : une ligne d'export deja presente (types/schemas de 2.5.1)
   a ete dupliquee. Ne rajouter QUE les blocs services + module.
8. **Couverture sous 85%** : une methode squelette non testee. Verifier que CHAQUE methode a
   son `it()` correspondant qui declenche le throw (donc l'execution de la ligne de log).
9. **`@Injectable` non resolvable cote API** : le service n'est pas dans les providers d'un
   module importe. Verifier que `ExpertiseModule` est importe par le module consommateur.
10. **Message d'exception non assertable** : le test cherche `'Sprint 14 Tache 4.1.15'` mais
    le code ecrit `'Sprint14'` ou une variante. Aligner exactement la chaine.
11. **`scheduledAt` non serialisable dans le log** : passer un objet `Date` brut dans le log
    structure produit un format non deterministe. La methode `scheduleVisit` journalise
    `scheduledAt.toISOString()` pour une chaine ISO 8601 stable et testable.
12. **Spec rouge faute d'`await` sur le constructeur** : `setContext` est appele de maniere
    synchrone dans le constructeur ; l'assertion `expect(logger.setContext).toHaveBeenCalled`
    doit etre faite APRES l'instanciation dans le `beforeEach`, jamais avant.
13. **`vi.fn()` partage entre tests** : recreer le mock dans `beforeEach` (et non au niveau
    module) garantit que les compteurs d'appels (`toHaveBeenCalledWith`) sont remis a zero
    entre chaque `it()`. Un mock partage produit des faux positifs cumulatifs.

### 12.1. Tableau de diagnostic rapide

| Symptome | Cause probable | Correctif |
|----------|----------------|-----------|
| `Cannot find module 'nestjs-pino'` | dependance non installee | `pnpm install` + ajout devDep |
| `NotImplementedException is not a constructor` | mauvais import | importer depuis `@nestjs/common` |
| test vert sans throw | `await` manquant | `await expect(p).rejects.toThrow(...)` |
| `setContext is not a function` | mock incomplet | utiliser `createLoggerMock()` |
| cycle au build | service importe le barrel | importer `../types` / `../schemas` |
| couverture < 85% | methode non testee | un `it()` par methode |
| lint: import inutilise | type importe non utilise | retirer ou utiliser `import type` |

### 12.2. Verification manuelle du contrat

Pour confirmer rapidement, hors tests, que toutes les methodes levent bien, un script
ad hoc (non livre, a usage de verification ponctuelle) peut instancier chaque service avec
un logger no-op et appeler chaque methode dans un `try/catch`, en comptant les
`NotImplementedException`. Le decompte doit egaler le nombre total de methodes (21). Toute
methode qui ne leverait pas signalerait une implementation prematuree ou un oubli de throw.

---

## 13. Conformite Maroc

Ces squelettes encodent, dans leur surface de contrat, le workflow d'expertise tel
qu'attendu par le cadre ACAPS (Autorite de Controle des Assurances et de la Prevoyance
Sociale) :

- **Validation avant paiement** : la presence des methodes `validateDevis` / `modifyDevis` /
  `rejectDevis` (ExpertValidationService) et le fait que le rapport d'expertise conditionne
  la suite du workflow sinistre materialisent la regle ACAPS selon laquelle aucune
  indemnisation n'est versee avant validation du devis par un expert agree. Le contrat est
  pose des maintenant ; le verrou metier (impossibilite de declencher un paiement sans
  rapport valide) sera applique au moment de l'implementation (Sprints 14 et 22.7).
- **Agrement expert** : `checkAgrementExpiry` (cron quotidien) encode la surveillance des
  agrements ACAPS des experts ; un expert dont l'agrement est expire ne pourra plus etre
  affecte. La logique de suspension automatique est implementee au Sprint 14.
- **KYB** : `approveKyb` / `rejectKyb` encodent le controle de connaissance de l'expert
  (Know Your Business) prealable a toute activite.

Les exigences CNDP (Commission Nationale de controle de la protection des Donnees a
caractere Personnel, loi 09-08) et la loi 17-99 portant Code des assurances sont notees
ici pour memoire : leur APPLICATION effective (minimisation des donnees, consentement,
tracabilite des acces, anonymisation, residence des donnees) intervient au moment de
l'implementation des corps de methodes (Sprints 14 et 22.7), et non au stade du squelette
qui ne manipule aucune donnee a caractere personnel.

---

## 14. Conventions absolues skalean-insurtech

> A respecter integralement. Bien que la plupart ne s'appliquent pleinement qu'a
> l'implementation, elles cadrent la conception des squelettes et sont reproduites en
> entier pour reference.

- **Multi-tenant strict** : `x-tenant-id` obligatoire sauf `/api/v1/public/*` et
  `/api/v1/admin/*` ; `TenantGuard` ; `AsyncLocalStorage` ; RLS via
  `app_can_access_tenant()` ; audit trail systematique.
- **Validation strict** : Zod uniquement ; schemas exportes ; `const Schema = z.object(...)` ;
  `type X = z.infer<typeof Schema>`.
- **Logger strict** : Pino injecte (`nestjs-pino` `PinoLogger`) ; jamais `console.log` ;
  champs JSON structures `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; engine-strict Node >= 22.11.0 ;
  save-exact ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`,
  `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; couverture
  >= 85% (>= 90% pour auth/database/signature).
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles v3.0.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par
  evenement ; `Idempotency-Key` sur les operations critiques.
- **Imports strict** : `@insurtech/{name}` ; paths via `tsconfig.base.json` ; ordre
  Node / external / `@insurtech` / relatif.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais
  d'appel direct a un fournisseur frontier ; mock du Sprint 1 a 28, reel a partir du 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ;
  `check-no-emoji.sh` ; la CI echoue si une emoji est detectee.
- **Idempotency-Key strict** : sur `POST /payments`, `/signatures`, `/claims`, et les
  ecritures MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2
  Tier IV ; aucune donnee assure ne quitte le Maroc ; AES-256-GCM ; TLS 1.3.
- **Naming v3.0 (decision-011)** : Skalean (entreprise), Assurflow (verticale),
  Sofidemy (marque).

---

## 15. Validation pre-commit

```bash
# 1. Typecheck
pnpm --filter @insurtech/expertise typecheck

# 2. Lint
pnpm --filter @insurtech/expertise lint

# 3. Tests + couverture
pnpm --filter @insurtech/expertise test -- --coverage

# 4. Absence d'emoji (decision-006)
bash scripts/check-no-emoji.sh packages/expertise/src

# 5. Absence de console.* (hors spec)
grep -rn "console\." packages/expertise/src --include="*.ts" | grep -v ".spec.ts" \
  && echo "ECHEC: console detecte" || echo "OK"

# 6. Verification des messages de differement
grep -rn "Sprint 14 Tache 4.1.15" packages/expertise/src/services/experts-catalog.service.ts
grep -rn "Sprint 14 Tache 4.1.16" packages/expertise/src/services/expert-assignments.service.ts
grep -rn "Sprint 22.7" packages/expertise/src/services/expert-validation.service.ts
grep -rn "Sprint 22.7" packages/expertise/src/services/expert-reports-basic.service.ts

# 7. Build final
pnpm --filter @insurtech/expertise build
```

Tous les controles doivent passer (exit 0 / OK) avant de committer. Le hook husky
`pre-commit` rejoue lint + tests + check-no-emoji sur les fichiers stages.

---

## 16. Commit message

```
feat(sprint-7.5b): services squelettes @insurtech/expertise signatures

Livre les quatre services squelette du package @insurtech/expertise en
approche contract-first : ExpertsCatalogService (6 methodes),
ExpertAssignmentsService (8 methodes), ExpertValidationService (3 methodes)
et ExpertReportsBasicService (4 methodes). Chaque methode expose une
signature complete typee (parametres + retour issus des types et schemas
livres en 2.5.1), journalise un evenement structure via PinoLogger puis
leve NotImplementedException nommant le sprint d'implementation.

- Catalogue + affectations differes au Sprint 14 (Taches 4.1.15 / 4.1.16)
- Validation devis + rapports differes au Sprint 22.7
- ExpertiseModule (@Module) cable les 4 providers et les exporte
- Barrel index.ts mis a jour (export des 4 services + module)
- 31 tests Vitest : service defini + chaque methode leve
  NotImplementedException + journalisation avant throw
- 0 console.log, 0 emoji, import type pour tous les types metier

Task: 2.5.7
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: defere sprint 14 + sprint 22.7
```

---

## 17. Workflow next step

Une fois cette tache validee (tous les criteres P0 verts, lint/typecheck/build/test au
vert, zero emoji, zero console), passer a :

**task-2.5.8 -- services squelettes @insurtech/tow**

La tache 2.5.8 applique exactement le meme patron (contract-first, signatures completes,
PinoLogger + journalisation structuree, `NotImplementedException` avec sprint cible nomme,
ExpertiseModule equivalent `TowModule`, barrel mis a jour, specs Vitest assertant que
chaque methode leve) au package `@insurtech/tow` (gestion du remorquage/depannage). Elle
est BLOQUEE par la presente tache 2.5.7 et reutilise les memes conventions, le meme helper
`createLoggerMock`, et la meme strategie de differement. Une fois 2.5.8 livree, la tache
2.5.9 verifiera la compilation du barrel monorepo complet.

---

<!-- FIN DU FICHIER -- task-2.5.7-services-squelettes-expertise.md -- Sprint 7.5b -- Phase 2 -- P0 -- Effort 1h -- AUCUNE EMOJI (decision-006) -->
