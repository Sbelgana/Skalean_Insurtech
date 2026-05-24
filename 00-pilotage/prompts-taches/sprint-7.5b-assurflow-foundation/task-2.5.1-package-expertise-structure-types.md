# Task 2.5.1 -- Package @insurtech/expertise : structure + types fondation Expert

> Sprint : 7.5b (Assurflow Foundation -- Phase 2 / Sprint 5)
> Reference : B-7.5b task 2.5.1
> Phase : 2 -- Securite extensions
> Priorite : P0 (bloquant pour tout le vertical Expert)
> Effort : 1h
> Dependances : Sprint 7.5a (enum AuthRole 26 roles v3.0, tables auth_tenants / auth_users, tsconfig.base.json, conventions monorepo)
> Densite cible : 80-150 ko (cible ~100-115 ko)
> AUCUNE EMOJI (decision-006, ABSOLUE) -- aucun caractere emoji nulle part dans ce document ni dans les livrables.

---

## 1. Header

Cette tache cree le package monorepo `@insurtech/expertise`, fondation TypeScript du vertical Expert d'Assurflow. Le vertical Expert materialise la decision-013 : dans un sinistre auto, l'assureur (carrier) ne paie pas directement le devis du garage ; il **designe un expert agree ACAPS** qui se rend (physiquement ou via dossier photo) sur le vehicule sinistre, **valide, modifie ou rejette le devis** du garage, puis remet un **rapport d'expertise signe** sur lequel l'assureur s'appuie pour payer. Le package livre EXCLUSIVEMENT la fondation type-safe (structure de package, types TypeScript exhaustifs, schemas Zod de validation, squelettes d'entites TypeORM avec signatures) ; l'implementation des services (logique metier, repositories cables, generation PDF, signature electronique, evenements Kafka) est **explicitement reportee au Sprint 14**. Les squelettes de services NestJS sont traites dans la tache 2.5.7 (PAS ici).

Recapitulatif :

| Champ | Valeur |
|---|---|
| Sprint | 7.5b (Assurflow Foundation) |
| Reference backlog | B-7.5b task 2.5.1 |
| Phase | 2 -- Securite extensions |
| Priorite | P0 |
| Effort estime | 1h |
| Dependances | Sprint 7.5a |
| Package livre | `@insurtech/expertise` v0.1.0 |
| Position | 1 / 9 (premier des packages verticaux du Sprint 7.5b) |
| Densite | 80-150 ko |
| Decisions appliquees | 011 (naming v3.0), 012 (securite multi-tenant), 013 (workflow expert-central) |
| Emoji | AUCUNE (decision-006) |

---

## 2. But

Creer un package npm interne `@insurtech/expertise` dans le monorepo pnpm (`repo/packages/expertise/`) qui expose, de maniere strictement typee et validee :

1. Les **types TypeScript** decrivant les trois entites de domaine du vertical Expert : l'expert (`Expert`), la mission/designation (`ExpertAssignment`), et le rapport d'expertise (`ExpertReport`), ainsi que les enumerations associees (type d'expert, statut, specialite ACAPS, statut de mission, decision de rapport, statut de signature legale).
2. Les **schemas Zod** de validation des operations d'entree (onboarding expert, validation/rejet KYB, recherche, designation, acceptation/rejet de mission, creation/soumission de rapport), avec contraintes regex Maroc-specifiques (CIN, telephone +212, numero d'agrement ACAPS, ICE 15 chiffres, montant decimal en string).
3. Les **squelettes d'entites TypeORM** (`insure_expert`, `insure_expert_assignment`, `insure_expert_report`) : decorateurs `@Entity` / `@Column` en snake_case, semantique de cle etrangere vers `auth_tenants(id)` et `auth_users(id)`. Le DDL effectif des tables est cree par les taches 2.5.4 / 2.5.5 / 2.5.6 ; le cablage complet (relations, repositories, DataSource) est realise au Sprint 14.
4. Une **table de capacites** mappant les 4 roles experts de l'enum `AuthRole` v3.0 (26 roles, Sprint 7.5a) vers leurs capacites fonctionnelles.
5. Un **barrel** `index.ts` re-exportant l'API publique + une constante `VERSION`.

Le but n'est PAS d'implementer la logique metier. C'est de figer un contrat type-safe partage que consommeront, au Sprint 14, les modules NestJS du backend, le frontend expert, et les autres packages verticaux (`@insurtech/tow`, `@insurtech/garage`, `@insurtech/signature`).

---

## 3. Contexte etendu

### 3.1 Pourquoi un package dedie

Assurflow est organise en **monorepo pnpm** ou chaque domaine fonctionnel (vertical) est isole dans un package `@insurtech/<nom>` versionne independamment, buildable independamment (`tsc` avec `composite: true`), et consomme par reference de workspace (`link-workspace-packages=deep`). Cette discipline garantit :

- **Frontiere de domaine explicite** : les types Expert ne fuient pas dans les autres verticaux par accident ; toute dependance inter-package est declaree dans le `package.json`.
- **Build incremental** : `composite: true` + `declaration: true` permet a turbo/tsc de ne recompiler que les packages impactes.
- **Reutilisation cote frontend ET backend** : les types et schemas Zod sont isomorphes (pas de dependance NestJS/TypeORM dans la couche types/schemas), donc reutilisables dans le frontend Next.js de l'espace expert sans tirer le backend.

Le vertical Expert merite son propre package (et non un sous-dossier de `@insurtech/insure`) parce que son cycle de vie metier, ses roles RBAC, sa conformite ACAPS, et son calendrier de livraison (fondation 7.5b, implementation Sprint 14) sont distincts du coeur assurance.

### 3.2 Le workflow expert-central (decision-013)

La decision-013 etablit que l'expert est l'arbitre independant du montant payable. Le flux nominal :

1. **Sinistre declare** : un assure declare un sinistre auto chez son assureur (carrier). Un dossier sinistre (`sinistreId`) existe deja (vertical sinistre, hors de cette tache).
2. **Garage etablit un devis** : le vehicule arrive dans un garage (eventuellement via le vertical `@insurtech/tow`) ; le garage saisit un devis (`devisId`).
3. **Carrier designe un expert** : l'assureur choisit un expert agree ACAPS dans la zone du garage et cree une **mission** (`ExpertAssignment`, statut `designated`). La mission porte la geolocalisation du garage (`garageLat`, `garageLng`) pour le routage.
4. **Expert accepte ou rejette** : l'expert recoit la mission (statut `accepted` ou `rejected` avec `rejectionReason`).
5. **Expert realise l'expertise** : visite planifiee (`visitScheduledAt`) puis realisee (`visitCompletedAt`) ; statut `in_progress`.
6. **Expert remet un rapport** : `ExpertReport` en `draft` -> `completed`. Decision : `validated` (devis OK), `modified` (devis reduit/corrige, voir `modifications`), ou `rejected`. Le rapport est **signe electroniquement** (`signatureId`, `signedAt`, `signatureLegalStatus`) -> statut `signed`.
7. **Rapport soumis au carrier** : statut `submitted_to_carrier` ; le carrier le recoit (`carrierReceivedAt`) et l'accepte (`accepted_by_carrier`) ou le conteste (`contested_by_carrier`).
8. **Carrier paie** : sur la base du montant valide par l'expert, le carrier paie le garage. L'expert est lui-meme remunere : honoraires (`honoraireMad`, `honoraireInvoiceId`, `honorairePaymentStatus`).

Ce flux fait de l'expert un acteur de confiance reglementee : il doit etre agree ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale), avec un numero d'agrement et une date d'expiration verifies lors d'un **KYB** (Know Your Business). D'ou les statuts `pending_kyb`, `active`, `expired_agrement`.

### 3.3 Les 4 types d'expert

L'enum `ExpertTypeEnum` distingue :

- `independent` : expert independant, exerce en son nom propre, agrement ACAPS personnel.
- `firm_admin` : administrateur d'un cabinet d'expertise (firme), gere des associes ; possede `firmName` + `firmIce`.
- `associate` : expert associe rattache a un cabinet (rapporte a un `firm_admin`).
- `carrier_internal` : expert salarie interne d'un assureur ; rattache via `carrierTenantId` au tenant de l'assureur.

Ces 4 types correspondent un-pour-un aux 4 roles experts de l'enum `AuthRole` v3.0 (Sprint 7.5a) : `expert_independent`, `expert_firm_admin`, `expert_associate`, `expert_carrier_internal`. La table de capacites (`expert-roles.types.ts`) materialise ce mapping.

### 3.4 Consommateurs aval (Sprint 14 / 22.7)

| Sprint | Module | Usage des artefacts de cette tache |
|---|---|---|
| Sprint 14 | `expertise-service` (NestJS) | Importe types + schemas + entites ; cable repositories TypeORM, services, controllers, RBAC. |
| Sprint 14 | Frontend espace expert (Next.js) | Importe types + schemas Zod pour formulaires d'onboarding et de rapport. |
| Sprint 14 | `@insurtech/signature` | Consomme `signatureId` / `signatureLegalStatus` pour la signature du rapport. |
| Sprint 14 | `@insurtech/tow` + `@insurtech/garage` | Lient `garageTenantId`, geolocalisation, et `devisId` aux missions. |
| Sprint 22.7 | Notation & reputation experts | Etend `avgRating`, `avgResponseTimeHours`, `totalMissions`. |
| Sprint 22.7 | Marketplace experts | Recherche/matching geographique via `activeZones` + `acapsSpecialty`. |

### 3.5 Alternatives considerees

| Option | Description | Verdict |
|---|---|---|
| A. Sous-dossier de @insurtech/insure | Mettre les types Expert dans le coeur assurance. | Rejete : frontiere de domaine floue, cycle de vie et roles distincts, couplage non desire. |
| B. Package @insurtech/expertise dedie (RETENU) | Package versionne, buildable, isomorphe types+schemas, squelettes entites separes. | Retenu : conforme a la discipline monorepo, frontiere nette, reutilisable front/back. |
| C. Types generes depuis le schema SQL | Generer les types depuis le DDL des taches 2.5.4-2.5.6. | Rejete : inverse l'ordre de dependance ; le contrat type doit preceder le DDL et le piloter. |
| D. Schemas runtime uniquement (Zod) sans types statiques | Tout deriver de Zod via z.infer sans interfaces dediees. | Partiellement retenu : on derive les inputs de Zod, mais les entites de domaine ont des interfaces explicites (champs serveur Date/null non exprimes a l'input). |

### 3.6 Trade-offs

- **Interfaces explicites vs z.infer** : les entites de domaine (`Expert`, `ExpertAssignment`, `ExpertReport`) sont des `interface` TypeScript explicites (champs `Date`, `string | null`, compteurs serveur) ; les **inputs** d'API derivent de Zod via `z.infer`. On ne fabrique pas l'entite complete a partir d'un schema Zod, car beaucoup de champs sont calcules/positionnes cote serveur (timestamps, statut, compteurs).
- **Money as string** : tous les montants (`baselineHonoraireMad`, `honoraireMad`) sont des `string` au format decimal (`/^\d+(\.\d{1,2})?$/`), jamais des `number`, pour eviter les erreurs de virgule flottante IEEE-754 sur des montants financiers.
- **Squelettes entites sans relations** : les entites TypeORM declarent les colonnes FK comme simples `@Column` (uuid) et NON comme `@ManyToOne`/`@JoinColumn`, car le cablage relationnel et le DataSource sont reportes au Sprint 14. On fige la forme des colonnes (matching DB), pas le graphe d'objets.
- **exactOptionalPropertyTypes** : impose de distinguer `field?: T` de `field: T | undefined`. Les champs nullables cote DB sont modelises `T | null` (presents, valeur nulle), pas `T | undefined` (absents).

### 3.7 Pieges nommes (8-12)

1. **Piege CIN marocaine** : le format CIN est 1 ou 2 lettres majuscules suivies de 6 ou 7 chiffres (`/^[A-Z]{1,2}\d{6,7}$/`). Ne pas confondre avec un passeport ou un titre de sejour. Toujours en MAJUSCULES.
2. **Piege telephone** : format E.164 marocain strict `/^\+212[0-9]{9}$/` (le prefixe `+212` suivi de 9 chiffres). Refuser `0612...`, `00212...`, ou un `+212` suivi du `0` national.
3. **Piege numero ACAPS** : `/^ACAPS-\d{4}-EXP-\d{3,5}$/` (annee 4 chiffres, suffixe 3 a 5 chiffres). Une erreur frequente est d'oublier le segment `EXP`.
4. **Piege expiration agrement** : `acapsAgrementExpiryDate` doit etre dans le futur a l'onboarding (`refine(d => d > new Date())`). Un agrement expire passe l'expert au statut `expired_agrement` (pas de mission possible).
5. **Piege ICE** : l'Identifiant Commun de l'Entreprise marocain fait exactement **15 chiffres** (`/^\d{15}$/`), uniquement pour les types `firm_admin`/`associate` (cabinet). Optionnel pour `independent`.
6. **Piege Money** : ne JAMAIS typer un montant en `number`. Toujours `string` decimal. Les conversions se font cote service au Sprint 14, jamais dans les types.
7. **Piege Date vs string** : les entites de domaine portent des `Date` natifs ; les schemas Zod d'input utilisent `z.coerce.date()` pour parser une string ISO. Ne pas melanger.
8. **Piege exactOptionalPropertyTypes** : un champ nullable serveur est `T | null`, pas `T | undefined`. Un input optionnel Zod est `.optional()` (-> `T | undefined`). Ne pas confondre nullable (DB) et optionnel (input).
9. **Piege snake_case entites** : les colonnes TypeORM doivent etre en snake_case explicite (`@Column({ name: 'tenant_id' })`) pour matcher le DDL des taches 2.5.4-2.5.6, alors que les proprietes TS sont camelCase.
10. **Piege enum comptes** : 4 types d'expert, 5 statuts expert, 10 specialites, 6 statuts mission, 3 decisions rapport, 6 statuts rapport, 3 statuts signature, 4 roles. Les tests verifient les cardinalites exactes.
11. **Piege import .js** : avec `type: "module"` + ESM + `composite`, les imports relatifs intra-package n'ont PAS d'extension `.js` dans les sources `src/` (resolus par le bundler/tsc en mode NodeNext via tsconfig.base) -- respecter la convention du depot (imports relatifs sans extension dans src, comme `@insurtech/insure`).
12. **Piege specialite vide** : `acapsSpecialty` est un tableau qui doit contenir au moins 1 specialite (`.min(1)`). Un expert sans specialite ne peut pas etre matche a une mission.

### 3.8 Decisions appliquees

- **decision-011 (naming v3.0)** : Skalean = la societe (editeur) ; Assurflow = la plateforme/vertical assurance ; Sofidemy = la marque commerciale. Les noms de package portent le prefixe technique `@insurtech/` (legacy conserve volontairement pour ne pas casser les imports).
- **decision-012 (securite multi-tenant)** : toute entite porte `tenantId` ; isolation RLS au niveau DB ; les FK referencent `auth_tenants(id)`.
- **decision-013 (workflow expert-central)** : l'expert valide le devis avant paiement carrier ; modelise par `ExpertAssignment` + `ExpertReport` decrits ci-dessus.

---

## 4. Architecture context

### 4.1 Position dans le Sprint 7.5b

Cette tache est la **1ere des 9** taches du Sprint 7.5b (fondations verticales). Elle ne depend que du Sprint 7.5a (enum roles, tables auth, tsconfig de base). Les 8 taches suivantes (2.5.2 package @insurtech/tow, 2.5.3 package garage, 2.5.4/2.5.5/2.5.6 DDL des tables expert, 2.5.7 squelettes services NestJS, etc.) s'appuient sur ce package.

```
Sprint 7.5a (roles, auth_tenants, auth_users, tsconfig.base)
        |
        v
[2.5.1] @insurtech/expertise  <-- CETTE TACHE (position 1/9)
        |
        +--> [2.5.2] @insurtech/tow
        +--> [2.5.3] @insurtech/garage
        +--> [2.5.4] DDL insure_expert
        +--> [2.5.5] DDL insure_expert_assignment
        +--> [2.5.6] DDL insure_expert_report
        +--> [2.5.7] squelettes services NestJS (expertise-service)
```

### 4.2 Layout du package (ASCII)

```
repo/packages/expertise/
|-- package.json                          # @insurtech/expertise v0.1.0
|-- tsconfig.json                         # extends ../../tsconfig.base.json
`-- src/
    |-- index.ts                          # barrel + VERSION
    |-- types/
    |   |-- expert.types.ts               # Expert + enums (type/statut/specialite)
    |   |-- expert-assignment.types.ts    # ExpertAssignment + enum statut mission
    |   |-- expert-report.types.ts        # ExpertReport + enums (decision/statut/signature)
    |   `-- expert-roles.types.ts         # mapping 4 roles experts -> capacites
    |-- schemas/
    |   |-- expert.schema.ts              # Onboard/ApproveKyb/RejectKyb/SearchExperts
    |   |-- expert-assignment.schema.ts   # Designate/Accept/Reject/Cancel/Search
    |   `-- expert-report.schema.ts       # Create/Update/Submit/Sign/Decision
    `-- entities/
        |-- insure-expert.entity.ts            # squelette @Entity insure_expert
        |-- insure-expert-assignment.entity.ts # squelette insure_expert_assignment
        `-- insure-expert-report.entity.ts     # squelette insure_expert_report
```

### 4.3 Extension par Sprint 14 / 22.7

```
[2.5.1 -- CE PACKAGE: types + schemas + squelettes entites]
        |
        v (Sprint 14)
expertise-service NestJS
  |-- entities cablees (relations @ManyToOne, DataSource)
  |-- repositories TypeORM
  |-- services (onboarding, KYB, assignment, report, PDF, signature)
  |-- controllers REST + @Roles() + TenantGuard
  |-- events Kafka insurtech.events.expertise.*
        |
        v (Sprint 22.7)
notation/reputation + marketplace experts (matching geo + specialite)
```

---

## 5. Livrables checkables

Chemins relatifs a `repo/` :

1. `packages/expertise/package.json` -- existe, name `@insurtech/expertise`, version `0.1.0`, private true, type module.
2. `packages/expertise/tsconfig.json` -- existe, extends `../../tsconfig.base.json`, composite true.
3. `packages/expertise/src/index.ts` -- existe, re-exporte tous les modules + `VERSION`.
4. `packages/expertise/src/types/expert.types.ts` -- existe, exporte `ExpertTypeEnum`, `ExpertType`, `ExpertStatusEnum`, `ExpertStatus`, `ExpertSpecialtyEnum`, `ExpertSpecialty`, `Expert`.
5. `packages/expertise/src/types/expert-assignment.types.ts` -- existe, exporte `ExpertAssignmentStatusEnum`, `ExpertAssignmentStatus`, `ExpertAssignment`, `HonorairePaymentStatusEnum`, `HonorairePaymentStatus`.
6. `packages/expertise/src/types/expert-report.types.ts` -- existe, exporte `ExpertReportDecisionEnum`, `ExpertReportDecision`, `ExpertReportStatusEnum`, `ExpertReportStatus`, `SignatureLegalStatusEnum`, `SignatureLegalStatus`, `ExpertReport`.
7. `packages/expertise/src/types/expert-roles.types.ts` -- existe, exporte `EXPERT_ROLES`, `ExpertRole`, `ExpertCapability`, `EXPERT_ROLE_CAPABILITIES`.
8. `packages/expertise/src/schemas/expert.schema.ts` -- existe, exporte `OnboardExpertSchema`, `OnboardExpertInput`, `ApproveKybSchema`, `ApproveKybInput`, `RejectKybSchema`, `RejectKybInput`, `SearchExpertsSchema`, `SearchExpertsInput`.
9. `packages/expertise/src/schemas/expert-assignment.schema.ts` -- existe, exporte `DesignateExpertSchema`, `AcceptAssignmentSchema`, `RejectAssignmentSchema`, `CancelAssignmentSchema`, `SearchAssignmentsSchema` + leurs `Input`.
10. `packages/expertise/src/schemas/expert-report.schema.ts` -- existe, exporte `CreateReportSchema`, `UpdateReportSchema`, `SubmitReportSchema`, `RecordDecisionSchema`, `SignReportSchema` + leurs `Input`.
11. `packages/expertise/src/entities/insure-expert.entity.ts` -- existe, classe `InsureExpert` decoree `@Entity('insure_expert')`.
12. `packages/expertise/src/entities/insure-expert-assignment.entity.ts` -- existe, classe `InsureExpertAssignment` decoree `@Entity('insure_expert_assignment')`.
13. `packages/expertise/src/entities/insure-expert-report.entity.ts` -- existe, classe `InsureExpertReport` decoree `@Entity('insure_expert_report')`.
14. `pnpm --filter @insurtech/expertise typecheck` -- passe sans erreur.
15. `pnpm --filter @insurtech/expertise build` -- produit `dist/index.js` + `dist/index.d.ts`.
16. `pnpm --filter @insurtech/expertise lint` -- aucun probleme biome.
17. `pnpm --filter @insurtech/expertise test` -- tous les tests verts.
18. `packages/expertise/src/types/expert.types.spec.ts` -- existe (tests enums + type).
19. `packages/expertise/src/schemas/expert.schema.spec.ts` -- existe (tests regex CIN/phone/ACAPS/ICE).
20. `packages/expertise/src/schemas/expert-assignment.schema.spec.ts` -- existe.
21. `packages/expertise/src/schemas/expert-report.schema.spec.ts` -- existe.
22. `packages/expertise/src/index.spec.ts` -- existe (tests barrel + VERSION).
23. `dist/index.d.ts` -- contient les declarations exportees (apres build).
24. Aucun emoji dans aucun fichier livre (check-no-emoji.sh vert).
25. `acapsSpecialty` contient exactement 10 options dans l'enum.

---

## 6. Fichiers crees / modifies

| Fichier | Type | Lignes approx. | Description |
|---|---|---|---|
| `packages/expertise/package.json` | cree | 30 | Manifeste npm interne. |
| `packages/expertise/tsconfig.json` | cree | 14 | Config TS composite. |
| `packages/expertise/src/index.ts` | cree | 45 | Barrel + VERSION. |
| `packages/expertise/src/types/expert.types.ts` | cree | 130 | Enums + interface Expert. |
| `packages/expertise/src/types/expert-assignment.types.ts` | cree | 105 | Enum + interface ExpertAssignment. |
| `packages/expertise/src/types/expert-report.types.ts` | cree | 120 | Enums + interface ExpertReport. |
| `packages/expertise/src/types/expert-roles.types.ts` | cree | 110 | Mapping roles -> capacites. |
| `packages/expertise/src/schemas/expert.schema.ts` | cree | 150 | Schemas Zod expert. |
| `packages/expertise/src/schemas/expert-assignment.schema.ts` | cree | 95 | Schemas Zod mission. |
| `packages/expertise/src/schemas/expert-report.schema.ts` | cree | 110 | Schemas Zod rapport. |
| `packages/expertise/src/entities/insure-expert.entity.ts` | cree | 120 | Squelette entite expert. |
| `packages/expertise/src/entities/insure-expert-assignment.entity.ts` | cree | 115 | Squelette entite mission. |
| `packages/expertise/src/entities/insure-expert-report.entity.ts` | cree | 110 | Squelette entite rapport. |
| `packages/expertise/src/types/expert.types.spec.ts` | cree | 90 | Tests enums + type. |
| `packages/expertise/src/schemas/expert.schema.spec.ts` | cree | 180 | Tests regex/refine. |
| `packages/expertise/src/schemas/expert-assignment.schema.spec.ts` | cree | 90 | Tests mission. |
| `packages/expertise/src/schemas/expert-report.schema.spec.ts` | cree | 95 | Tests rapport. |
| `packages/expertise/src/index.spec.ts` | cree | 50 | Tests barrel. |

Total approx. : ~1750 lignes (sources + tests).

---

## 7. Code patterns COMPLETS

> Tous les blocs ci-dessous sont a creer tels quels. Aucun placeholder. TypeScript strict, Zod 3.24.1, TypeORM 0.3.20.

### 7.1 `packages/expertise/package.json`

```json
{
  "name": "@insurtech/expertise",
  "version": "0.1.0",
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
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest watch",
    "lint": "biome check --no-errors-on-unmatched src",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "typeorm": "0.3.20",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  }
}
```

Notes importantes :
- Versions **save-exact** (aucun `^` ni `~`), conformement a `.npmrc` du depot (`save-exact=true`).
- `zod` et `typeorm` sont des `dependencies` runtime (pas devDeps) car les schemas et entites en dependent a l'execution.
- `exports` map miroir exact de `@insurtech/insure`.

### 7.2 `packages/expertise/tsconfig.json`

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
- `extends` la base monorepo (qui porte `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `moduleResolution: NodeNext`, `emitDecoratorMetadata`, `experimentalDecorators`).
- `noEmit: false` surcharge la base (qui peut etre `noEmit: true`) car ce package emet vraiment du JS + declarations.
- Les `*.spec.ts` sont exclus du build (testes par vitest, pas emis dans dist).

### 7.3 `packages/expertise/src/types/expert.types.ts`

```typescript
import { z } from 'zod';

/**
 * Type d'expert (decision-013).
 * Chaque valeur correspond a un role AuthRole v3.0 (Sprint 7.5a) :
 * independent -> expert_independent
 * firm_admin -> expert_firm_admin
 * associate -> expert_associate
 * carrier_internal -> expert_carrier_internal
 */
export const ExpertTypeEnum = z.enum([
  'independent',
  'firm_admin',
  'associate',
  'carrier_internal',
]);
export type ExpertType = z.infer<typeof ExpertTypeEnum>;

/**
 * Statut du cycle de vie d'un expert.
 * pending_kyb : agrement ACAPS soumis, en attente de validation KYB.
 * active : KYB valide, agrement valide, peut recevoir des missions.
 * suspended : suspendu administrativement (peut etre reactive).
 * expired_agrement : agrement ACAPS expire (acapsAgrementExpiryDate < now).
 * inactive : desactive (depart, radiation).
 */
export const ExpertStatusEnum = z.enum([
  'active',
  'pending_kyb',
  'suspended',
  'expired_agrement',
  'inactive',
]);
export type ExpertStatus = z.infer<typeof ExpertStatusEnum>;

/**
 * Specialites d'expertise auto agreees ACAPS (10 valeurs).
 * Un expert porte au moins une specialite ; le matching de mission
 * (Sprint 22.7) croise specialite + zone geographique.
 */
export const ExpertSpecialtyEnum = z.enum([
  'auto_collision',
  'auto_mechanical',
  'auto_electrical',
  'auto_bodywork',
  'auto_total_loss',
  'auto_glass',
  'auto_marine',
  'auto_motorcycle',
  'auto_truck',
  'auto_fraud_investigation',
]);
export type ExpertSpecialty = z.infer<typeof ExpertSpecialtyEnum>;

/**
 * Entite de domaine Expert.
 *
 * Multi-tenant (decision-012) : tenantId reference auth_tenants(id) ;
 * userId reference auth_users(id). carrierTenantId est non-null
 * uniquement pour expertType === 'carrier_internal'.
 *
 * Tous les montants sont des strings decimales (Money as string) :
 * baselineHonoraireMad au format /^\d+(\.\d{1,2})?$/.
 *
 * Les champs nullables cote DB sont modelises `T | null` (presents,
 * potentiellement nuls) et non `T | undefined` (exactOptionalPropertyTypes).
 */
export interface Expert {
  /** UUID v4, cle primaire. */
  readonly id: string;
  /** FK auth_tenants(id) : tenant proprietaire de l'expert. */
  readonly tenantId: string;
  /** FK auth_users(id) : compte utilisateur de l'expert. */
  readonly userId: string;
  /** Nom complet legal de l'expert (3-255 caracteres). */
  readonly fullName: string;
  /** Numero CIN marocain (format /^[A-Z]{1,2}\d{6,7}$/). */
  readonly cinNumber: string;
  /** URL du document CIN stocke (stockage souverain MA). */
  readonly cinDocumentUrl: string;
  /** Telephone E.164 marocain (/^\+212[0-9]{9}$/). */
  readonly phone: string;
  /** Email de contact. */
  readonly email: string;
  /** Numero d'agrement ACAPS (/^ACAPS-\d{4}-EXP-\d{3,5}$/). */
  readonly acapsAgrementNumber: string;
  /** URL du document d'agrement ACAPS. */
  readonly acapsAgrementDocumentUrl: string;
  /** Date d'expiration de l'agrement ACAPS. */
  readonly acapsAgrementExpiryDate: Date;
  /** Specialites agreees (au moins une). */
  readonly acapsSpecialty: ExpertSpecialty[];
  /** Raison sociale du cabinet (null si independant/carrier_internal). */
  readonly firmName: string | null;
  /** ICE du cabinet (15 chiffres, null si non applicable). */
  readonly firmIce: string | null;
  /** Type d'expert. */
  readonly expertType: ExpertType;
  /** FK auth_tenants(id) du carrier (non-null si carrier_internal). */
  readonly carrierTenantId: string | null;
  /** Zones geographiques d'intervention (au moins une). */
  readonly activeZones: string[];
  /** Nombre total de missions realisees. */
  readonly totalMissions: number;
  /** Note moyenne (0 a 5). */
  readonly avgRating: number;
  /** Temps de reponse moyen en heures. */
  readonly avgResponseTimeHours: number;
  /** Honoraire de reference (MAD, string decimale). */
  readonly baselineHonoraireMad: string;
  /** Statut courant. */
  readonly status: ExpertStatus;
  /** Date de revue KYB (null si non revu). */
  readonly kybReviewedAt: Date | null;
  /** FK auth_users(id) du reviewer KYB (null si non revu). */
  readonly kybReviewedByUserId: string | null;
  /** Raison de rejet KYB (null si non rejete). */
  readonly kybRejectionReason: string | null;
  /** Notes libres administratives. */
  readonly notes: string | null;
  /** Timestamp de creation. */
  readonly createdAt: Date;
  /** Timestamp de derniere modification. */
  readonly updatedAt: Date;
}
```

Notes importantes :
- `ExpertSpecialtyEnum` a **exactement 10** options (teste).
- `carrierTenantId` est `string | null` (non `undefined`), conformement a `exactOptionalPropertyTypes`.
- Tous les champs sont `readonly` : l'entite de domaine est immuable cote consommateur (les mutations passent par les services Sprint 14).

### 7.4 `packages/expertise/src/types/expert-assignment.types.ts`

```typescript
import { z } from 'zod';

/**
 * Statut d'une mission d'expertise (6 valeurs).
 * designated : carrier a designe l'expert, en attente de reponse.
 * accepted : expert a accepte la mission.
 * rejected : expert a refuse (rejectionReason renseigne).
 * in_progress : visite/expertise en cours.
 * completed : mission terminee (rapport remis et accepte).
 * cancelled : annulee par le carrier (cancelledReason renseigne).
 */
export const ExpertAssignmentStatusEnum = z.enum([
  'designated',
  'accepted',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
]);
export type ExpertAssignmentStatus = z.infer<typeof ExpertAssignmentStatusEnum>;

/**
 * Statut de paiement des honoraires de l'expert pour la mission.
 */
export const HonorairePaymentStatusEnum = z.enum([
  'pending',
  'invoiced',
  'paid',
  'disputed',
]);
export type HonorairePaymentStatus = z.infer<typeof HonorairePaymentStatusEnum>;

/**
 * Entite de domaine ExpertAssignment (mission/designation).
 *
 * Lie un carrier (assureur) a un expert pour un sinistre donne.
 * tenantId est le tenant proprietaire de la mission (le carrier).
 * Geolocalisation du garage portee pour le routage geographique.
 * Montants en string decimale (Money as string).
 */
export interface ExpertAssignment {
  /** UUID v4, cle primaire. */
  readonly id: string;
  /** FK auth_tenants(id) : tenant proprietaire de la mission. */
  readonly tenantId: string;
  /** FK auth_tenants(id) : tenant du carrier designateur. */
  readonly carrierTenantId: string;
  /** FK auth_users(id) : utilisateur carrier ayant designe. */
  readonly carrierUserId: string;
  /** FK auth_tenants(id) : tenant de l'expert designe. */
  readonly expertTenantId: string;
  /** UUID de l'expert (insure_expert.id). */
  readonly expertId: string;
  /** FK auth_users(id) : compte utilisateur de l'expert. */
  readonly expertUserId: string;
  /** UUID du sinistre concerne. */
  readonly sinistreId: string;
  /** FK auth_tenants(id) du garage (null si inconnu). */
  readonly garageTenantId: string | null;
  /** Adresse textuelle du garage (null si non renseignee). */
  readonly garageAddress: string | null;
  /** Latitude du garage (null si non geolocalise). */
  readonly garageLat: number | null;
  /** Longitude du garage (null si non geolocalise). */
  readonly garageLng: number | null;
  /** Statut courant de la mission. */
  readonly status: ExpertAssignmentStatus;
  /** Date de designation. */
  readonly designatedAt: Date;
  /** Date d'acceptation (null tant que non accepte). */
  readonly acceptedAt: Date | null;
  /** Date de rejet (null tant que non rejete). */
  readonly rejectedAt: Date | null;
  /** Raison du rejet par l'expert (null si non rejete). */
  readonly rejectionReason: string | null;
  /** Date planifiee de visite (null si non planifiee). */
  readonly visitScheduledAt: Date | null;
  /** Date effective de visite (null si non realisee). */
  readonly visitCompletedAt: Date | null;
  /** Date de soumission du rapport (null si non soumis). */
  readonly reportSubmittedAt: Date | null;
  /** Date de completion de la mission (null si non completee). */
  readonly completedAt: Date | null;
  /** Date d'annulation (null si non annulee). */
  readonly cancelledAt: Date | null;
  /** Raison d'annulation (null si non annulee). */
  readonly cancelledReason: string | null;
  /** Honoraire convenu pour la mission (MAD string, null si non fixe). */
  readonly honoraireMad: string | null;
  /** UUID de la facture d'honoraires (null si non facture). */
  readonly honoraireInvoiceId: string | null;
  /** Statut de paiement des honoraires. */
  readonly honorairePaymentStatus: HonorairePaymentStatus;
  /** Notes libres. */
  readonly notes: string | null;
  /** Timestamp de creation. */
  readonly createdAt: Date;
  /** Timestamp de derniere modification. */
  readonly updatedAt: Date;
}
```

Notes importantes :
- `ExpertAssignmentStatusEnum` a **exactement 6** options.
- `garageLat`/`garageLng` sont `number | null` (coordonnees), exception au principe Money-as-string (ce ne sont pas des montants).

### 7.5 `packages/expertise/src/types/expert-report.types.ts`

```typescript
import { z } from 'zod';

/**
 * Decision de l'expert sur le devis du garage (3 valeurs).
 * validated : devis valide tel quel.
 * modified : devis corrige (voir modifications).
 * rejected : devis rejete.
 */
export const ExpertReportDecisionEnum = z.enum([
  'validated',
  'modified',
  'rejected',
]);
export type ExpertReportDecision = z.infer<typeof ExpertReportDecisionEnum>;

/**
 * Statut du rapport d'expertise (6 valeurs).
 * draft : brouillon en cours de redaction.
 * completed : redaction terminee, pret a signer.
 * signed : signe electroniquement.
 * submitted_to_carrier : transmis au carrier.
 * accepted_by_carrier : accepte par le carrier.
 * contested_by_carrier : conteste par le carrier.
 */
export const ExpertReportStatusEnum = z.enum([
  'draft',
  'completed',
  'signed',
  'submitted_to_carrier',
  'accepted_by_carrier',
  'contested_by_carrier',
]);
export type ExpertReportStatus = z.infer<typeof ExpertReportStatusEnum>;

/**
 * Statut legal de la signature electronique (3 valeurs).
 * pending : signature demandee, en attente.
 * signed : signee, valeur legale acquise.
 * expired : demande de signature expiree.
 */
export const SignatureLegalStatusEnum = z.enum([
  'pending',
  'signed',
  'expired',
]);
export type SignatureLegalStatus = z.infer<typeof SignatureLegalStatusEnum>;

/**
 * Entite de domaine ExpertReport (rapport d'expertise).
 *
 * Produit terminal du workflow expert (decision-013).
 * reportContent et modifications sont des JSON arbitraires
 * (Record<string, unknown>) figes au Sprint 14 par un schema dedie.
 */
export interface ExpertReport {
  /** UUID v4, cle primaire. */
  readonly id: string;
  /** FK auth_tenants(id) : tenant proprietaire du rapport. */
  readonly tenantId: string;
  /** UUID de la mission (insure_expert_assignment.id). */
  readonly assignmentId: string;
  /** UUID de l'expert (insure_expert.id). */
  readonly expertId: string;
  /** FK auth_users(id) : compte utilisateur de l'expert. */
  readonly expertUserId: string;
  /** UUID du devis garage expertise (null si pas de devis lie). */
  readonly devisId: string | null;
  /** Contenu structure du rapport (JSON). */
  readonly reportContent: Record<string, unknown>;
  /** URLs des photos d'expertise. */
  readonly photosUrls: string[];
  /** Decision sur le devis (null tant que non decidee). */
  readonly decision: ExpertReportDecision | null;
  /** Justification de la decision (null si non renseignee). */
  readonly decisionJustification: string | null;
  /** Detail des modifications apportees au devis (JSON). */
  readonly modifications: Record<string, unknown>;
  /** URL du PDF genere (null tant que non genere). */
  readonly pdfUrl: string | null;
  /** Date de generation du PDF (null si non genere). */
  readonly pdfGeneratedAt: Date | null;
  /** UUID de la signature (@insurtech/signature, null si non signe). */
  readonly signatureId: string | null;
  /** Date de signature (null si non signe). */
  readonly signedAt: Date | null;
  /** Statut legal de la signature. */
  readonly signatureLegalStatus: SignatureLegalStatus;
  /** Statut courant du rapport. */
  readonly status: ExpertReportStatus;
  /** Date de soumission au carrier (null si non soumis). */
  readonly submittedToCarrierAt: Date | null;
  /** Date de reception par le carrier (null si non recu). */
  readonly carrierReceivedAt: Date | null;
  /** Notes libres. */
  readonly notes: string | null;
  /** Timestamp de creation. */
  readonly createdAt: Date;
  /** Timestamp de derniere modification. */
  readonly updatedAt: Date;
}
```

Notes importantes :
- 3 enums : decision (3), statut (6), signature (3).
- `reportContent` et `modifications` sont `Record<string, unknown>` (jamais `any`) -- la forme stricte sera figee au Sprint 14.

### 7.6 `packages/expertise/src/types/expert-roles.types.ts`

```typescript
/**
 * Mapping des 4 roles experts de l'enum AuthRole v3.0 (Sprint 7.5a, 26 roles)
 * vers leurs capacites fonctionnelles dans le vertical Expert.
 *
 * Les 26 roles v3.0 incluent notamment (extrait pertinent ici) :
 * expert_independent, expert_firm_admin, expert_associate,
 * expert_carrier_internal. Cette table ne couvre que ces 4 roles ;
 * les RolesGuard du Sprint 14 consommeront EXPERT_ROLE_CAPABILITIES.
 */

/** Les 4 roles experts (sous-ensemble de AuthRole v3.0). */
export const EXPERT_ROLES = [
  'expert_independent',
  'expert_firm_admin',
  'expert_associate',
  'expert_carrier_internal',
] as const;

export type ExpertRole = (typeof EXPERT_ROLES)[number];

/** Capacites atomiques du vertical Expert. */
export type ExpertCapability =
  | 'expert:onboard:self'
  | 'expert:manage:firm_members'
  | 'expert:accept:assignment'
  | 'expert:reject:assignment'
  | 'expert:create:report'
  | 'expert:sign:report'
  | 'expert:submit:report'
  | 'expert:view:own_missions'
  | 'expert:view:firm_missions'
  | 'expert:view:carrier_missions';

/**
 * Mapping role -> capacites.
 *
 * expert_independent : exerce seul, gere ses propres missions.
 * expert_firm_admin : gere les membres du cabinet + ses propres missions
 *   + visibilite sur les missions du cabinet.
 * expert_associate : associe rattache, gere ses propres missions.
 * expert_carrier_internal : expert salarie d'un carrier, visibilite sur
 *   les missions du carrier.
 */
export const EXPERT_ROLE_CAPABILITIES: Readonly<
  Record<ExpertRole, ReadonlyArray<ExpertCapability>>
> = {
  expert_independent: [
    'expert:onboard:self',
    'expert:accept:assignment',
    'expert:reject:assignment',
    'expert:create:report',
    'expert:sign:report',
    'expert:submit:report',
    'expert:view:own_missions',
  ],
  expert_firm_admin: [
    'expert:onboard:self',
    'expert:manage:firm_members',
    'expert:accept:assignment',
    'expert:reject:assignment',
    'expert:create:report',
    'expert:sign:report',
    'expert:submit:report',
    'expert:view:own_missions',
    'expert:view:firm_missions',
  ],
  expert_associate: [
    'expert:accept:assignment',
    'expert:reject:assignment',
    'expert:create:report',
    'expert:sign:report',
    'expert:submit:report',
    'expert:view:own_missions',
  ],
  expert_carrier_internal: [
    'expert:accept:assignment',
    'expert:reject:assignment',
    'expert:create:report',
    'expert:sign:report',
    'expert:submit:report',
    'expert:view:own_missions',
    'expert:view:carrier_missions',
  ],
} as const;
```

Notes importantes :
- `EXPERT_ROLES` a **exactement 4** entrees (teste).
- Le mapping est `Readonly` + `ReadonlyArray` pour empecher la mutation cote consommateur.

### 7.7 `packages/expertise/src/schemas/expert.schema.ts`

```typescript
import { z } from 'zod';
import { ExpertSpecialtyEnum, ExpertTypeEnum } from '../types/expert.types';

/** Regex CIN marocaine : 1-2 lettres majuscules + 6-7 chiffres. */
const CIN_REGEX = /^[A-Z]{1,2}\d{6,7}$/;
/** Regex telephone E.164 marocain. */
const PHONE_MA_REGEX = /^\+212[0-9]{9}$/;
/** Regex numero d'agrement ACAPS. */
const ACAPS_AGREMENT_REGEX = /^ACAPS-\d{4}-EXP-\d{3,5}$/;
/** Regex ICE marocain : exactement 15 chiffres. */
const ICE_REGEX = /^\d{15}$/;
/** Regex montant decimal MAD (Money as string). */
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Schema d'onboarding d'un expert.
 * Toutes les contraintes Maroc-specifiques sont appliquees ici.
 */
export const OnboardExpertSchema = z.object({
  fullName: z.string().min(3).max(255),
  cinNumber: z.string().regex(CIN_REGEX, 'CIN invalide (format [A-Z]{1,2}\\d{6,7})'),
  cinDocumentUrl: z.string().url(),
  phone: z.string().regex(PHONE_MA_REGEX, 'Telephone invalide (format +212XXXXXXXXX)'),
  email: z.string().email(),
  acapsAgrementNumber: z
    .string()
    .regex(ACAPS_AGREMENT_REGEX, 'Numero ACAPS invalide (format ACAPS-YYYY-EXP-NNN)'),
  acapsAgrementDocumentUrl: z.string().url(),
  acapsAgrementExpiryDate: z.coerce
    .date()
    .refine((d) => d > new Date(), 'L agrement ACAPS doit expirer dans le futur'),
  acapsSpecialty: z.array(ExpertSpecialtyEnum).min(1),
  expertType: ExpertTypeEnum,
  firmName: z.string().min(2).max(255).optional(),
  firmIce: z.string().regex(ICE_REGEX, 'ICE invalide (15 chiffres)').optional(),
  carrierTenantId: z.string().uuid().optional(),
  activeZones: z.array(z.string().min(1)).min(1),
  baselineHonoraireMad: z.string().regex(MONEY_REGEX, 'Montant invalide (decimal)'),
});
export type OnboardExpertInput = z.infer<typeof OnboardExpertSchema>;

/** Schema de validation KYB (approbation). */
export const ApproveKybSchema = z.object({
  expertId: z.string().uuid(),
  reviewedByUserId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
export type ApproveKybInput = z.infer<typeof ApproveKybSchema>;

/** Schema de rejet KYB (raison obligatoire). */
export const RejectKybSchema = z.object({
  expertId: z.string().uuid(),
  reviewedByUserId: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});
export type RejectKybInput = z.infer<typeof RejectKybSchema>;

/** Schema de recherche d'experts (filtres + pagination). */
export const SearchExpertsSchema = z.object({
  specialty: ExpertSpecialtyEnum.optional(),
  zone: z.string().min(1).optional(),
  expertType: ExpertTypeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchExpertsInput = z.infer<typeof SearchExpertsSchema>;
```

Notes importantes :
- Tous les schemas exportes (`const Schema = z.object`, `type = z.infer`), conforme convention validation stricte.
- `firmIce` optionnel : present uniquement pour cabinets (validation croisee type/ICE au Sprint 14).

### 7.8 `packages/expertise/src/schemas/expert-assignment.schema.ts`

```typescript
import { z } from 'zod';

/** Regex montant decimal MAD. */
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/** Schema de designation d'un expert par un carrier. */
export const DesignateExpertSchema = z.object({
  expertId: z.string().uuid(),
  expertTenantId: z.string().uuid(),
  sinistreId: z.string().uuid(),
  garageTenantId: z.string().uuid().optional(),
  garageAddress: z.string().min(1).max(500).optional(),
  garageLat: z.number().min(-90).max(90).optional(),
  garageLng: z.number().min(-180).max(180).optional(),
  honoraireMad: z.string().regex(MONEY_REGEX, 'Montant invalide').optional(),
  notes: z.string().max(2000).optional(),
});
export type DesignateExpertInput = z.infer<typeof DesignateExpertSchema>;

/** Schema d'acceptation d'une mission par l'expert. */
export const AcceptAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  visitScheduledAt: z.coerce.date().optional(),
});
export type AcceptAssignmentInput = z.infer<typeof AcceptAssignmentSchema>;

/** Schema de rejet d'une mission (raison obligatoire). */
export const RejectAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});
export type RejectAssignmentInput = z.infer<typeof RejectAssignmentSchema>;

/** Schema d'annulation d'une mission par le carrier. */
export const CancelAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});
export type CancelAssignmentInput = z.infer<typeof CancelAssignmentSchema>;

/** Schema de recherche de missions. */
export const SearchAssignmentsSchema = z.object({
  sinistreId: z.string().uuid().optional(),
  expertId: z.string().uuid().optional(),
  status: z
    .enum([
      'designated',
      'accepted',
      'rejected',
      'in_progress',
      'completed',
      'cancelled',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchAssignmentsInput = z.infer<typeof SearchAssignmentsSchema>;
```

Notes importantes :
- `garageLat`/`garageLng` bornes geographiques valides.
- Les raisons (`reject`, `cancel`) ont une longueur minimale (10) pour eviter les motifs vides.

### 7.9 `packages/expertise/src/schemas/expert-report.schema.ts`

```typescript
import { z } from 'zod';
import { ExpertReportDecisionEnum } from '../types/expert-report.types';

/** Schema de creation d'un rapport (draft). */
export const CreateReportSchema = z.object({
  assignmentId: z.string().uuid(),
  devisId: z.string().uuid().optional(),
  reportContent: z.record(z.string(), z.unknown()),
  photosUrls: z.array(z.string().url()).default([]),
});
export type CreateReportInput = z.infer<typeof CreateReportSchema>;

/** Schema de mise a jour d'un rapport (brouillon). */
export const UpdateReportSchema = z.object({
  reportId: z.string().uuid(),
  reportContent: z.record(z.string(), z.unknown()).optional(),
  photosUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(5000).optional(),
});
export type UpdateReportInput = z.infer<typeof UpdateReportSchema>;

/** Schema d'enregistrement de la decision de l'expert. */
export const RecordDecisionSchema = z.object({
  reportId: z.string().uuid(),
  decision: ExpertReportDecisionEnum,
  decisionJustification: z.string().min(10).max(5000),
  modifications: z.record(z.string(), z.unknown()).default({}),
});
export type RecordDecisionInput = z.infer<typeof RecordDecisionSchema>;

/** Schema de signature electronique du rapport. */
export const SignReportSchema = z.object({
  reportId: z.string().uuid(),
  signatureId: z.string().uuid(),
});
export type SignReportInput = z.infer<typeof SignReportSchema>;

/** Schema de soumission du rapport au carrier. */
export const SubmitReportSchema = z.object({
  reportId: z.string().uuid(),
});
export type SubmitReportInput = z.infer<typeof SubmitReportSchema>;
```

Notes importantes :
- `reportContent` / `modifications` valides comme `z.record(z.string(), z.unknown())` (JSON cle-valeur), jamais `z.any()`.
- La soumission au carrier requiert un rapport signe (regle metier verifiee cote service Sprint 14).

### 7.10 `packages/expertise/src/entities/insure-expert.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Squelette d'entite TypeORM pour la table `insure_expert`.
 *
 * IMPORTANT (perimetre 2.5.1) : ce fichier ne fige QUE la forme des colonnes
 * (mapping camelCase -> snake_case). Le DDL physique de la table est cree par
 * la tache 2.5.4. Le cablage complet (relations @ManyToOne, DataSource,
 * repositories, index) est realise au Sprint 14.
 *
 * Semantique FK (decision-012) :
 *   tenant_id -> auth_tenants(id)
 *   user_id -> auth_users(id)
 *   carrier_tenant_id -> auth_tenants(id) (nullable)
 *   kyb_reviewed_by_user_id -> auth_users(id) (nullable)
 */
@Entity('insure_expert')
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

  @Column({ name: 'phone', type: 'varchar', length: 13 })
  phone!: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'acaps_agrement_number', type: 'varchar', length: 30 })
  acapsAgrementNumber!: string;

  @Column({ name: 'acaps_agrement_document_url', type: 'text' })
  acapsAgrementDocumentUrl!: string;

  @Column({ name: 'acaps_agrement_expiry_date', type: 'date' })
  acapsAgrementExpiryDate!: Date;

  @Column({ name: 'acaps_specialty', type: 'text', array: true })
  acapsSpecialty!: string[];

  @Column({ name: 'firm_name', type: 'varchar', length: 255, nullable: true })
  firmName!: string | null;

  @Column({ name: 'firm_ice', type: 'varchar', length: 15, nullable: true })
  firmIce!: string | null;

  @Column({ name: 'expert_type', type: 'varchar', length: 30 })
  expertType!: string;

  @Column({ name: 'carrier_tenant_id', type: 'uuid', nullable: true })
  carrierTenantId!: string | null;

  @Column({ name: 'active_zones', type: 'text', array: true })
  activeZones!: string[];

  @Column({ name: 'total_missions', type: 'integer', default: 0 })
  totalMissions!: number;

  @Column({ name: 'avg_rating', type: 'numeric', precision: 3, scale: 2, default: 0 })
  avgRating!: number;

  @Column({ name: 'avg_response_time_hours', type: 'numeric', precision: 6, scale: 2, default: 0 })
  avgResponseTimeHours!: number;

  @Column({ name: 'baseline_honoraire_mad', type: 'numeric', precision: 12, scale: 2 })
  baselineHonoraireMad!: string;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'pending_kyb' })
  status!: string;

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

Notes importantes :
- `baseline_honoraire_mad` est `numeric` cote DB mais expose `string` cote TS (TypeORM serialise le numeric en string -- coherent avec Money-as-string).
- Aucune relation `@ManyToOne` : reportee Sprint 14.

### 7.11 `packages/expertise/src/entities/insure-expert-assignment.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Squelette d'entite TypeORM pour la table `insure_expert_assignment`.
 *
 * IMPORTANT (perimetre 2.5.1) : forme des colonnes uniquement. DDL physique
 * cree par la tache 2.5.5. Cablage complet au Sprint 14.
 *
 * Semantique FK (decision-012) :
 *   tenant_id, carrier_tenant_id, expert_tenant_id, garage_tenant_id
 *     -> auth_tenants(id)
 *   carrier_user_id, expert_user_id -> auth_users(id)
 */
@Entity('insure_expert_assignment')
export class InsureExpertAssignment {
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

  @Column({ name: 'expert_id', type: 'uuid' })
  expertId!: string;

  @Column({ name: 'expert_user_id', type: 'uuid' })
  expertUserId!: string;

  @Column({ name: 'sinistre_id', type: 'uuid' })
  sinistreId!: string;

  @Column({ name: 'garage_tenant_id', type: 'uuid', nullable: true })
  garageTenantId!: string | null;

  @Column({ name: 'garage_address', type: 'varchar', length: 500, nullable: true })
  garageAddress!: string | null;

  @Column({ name: 'garage_lat', type: 'double precision', nullable: true })
  garageLat!: number | null;

  @Column({ name: 'garage_lng', type: 'double precision', nullable: true })
  garageLng!: number | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'designated' })
  status!: string;

  @Column({ name: 'designated_at', type: 'timestamptz' })
  designatedAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'visit_scheduled_at', type: 'timestamptz', nullable: true })
  visitScheduledAt!: Date | null;

  @Column({ name: 'visit_completed_at', type: 'timestamptz', nullable: true })
  visitCompletedAt!: Date | null;

  @Column({ name: 'report_submitted_at', type: 'timestamptz', nullable: true })
  reportSubmittedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason!: string | null;

  @Column({ name: 'honoraire_mad', type: 'numeric', precision: 12, scale: 2, nullable: true })
  honoraireMad!: string | null;

  @Column({ name: 'honoraire_invoice_id', type: 'uuid', nullable: true })
  honoraireInvoiceId!: string | null;

  @Column({ name: 'honoraire_payment_status', type: 'varchar', length: 20, default: 'pending' })
  honorairePaymentStatus!: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Notes importantes :
- `garage_lat`/`garage_lng` en `double precision` (coordonnees, pas montant).
- Statut par defaut `designated` (etat initial de la mission).

### 7.12 `packages/expertise/src/entities/insure-expert-report.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Squelette d'entite TypeORM pour la table `insure_expert_report`.
 *
 * IMPORTANT (perimetre 2.5.1) : forme des colonnes uniquement. DDL physique
 * cree par la tache 2.5.6. Cablage complet au Sprint 14.
 *
 * Semantique FK (decision-012) :
 *   tenant_id -> auth_tenants(id)
 *   expert_user_id -> auth_users(id)
 *   assignment_id -> insure_expert_assignment(id)
 *   expert_id -> insure_expert(id)
 */
@Entity('insure_expert_report')
export class InsureExpertReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'expert_id', type: 'uuid' })
  expertId!: string;

  @Column({ name: 'expert_user_id', type: 'uuid' })
  expertUserId!: string;

  @Column({ name: 'devis_id', type: 'uuid', nullable: true })
  devisId!: string | null;

  @Column({ name: 'report_content', type: 'jsonb', default: {} })
  reportContent!: Record<string, unknown>;

  @Column({ name: 'photos_urls', type: 'text', array: true, default: [] })
  photosUrls!: string[];

  @Column({ name: 'decision', type: 'varchar', length: 20, nullable: true })
  decision!: string | null;

  @Column({ name: 'decision_justification', type: 'text', nullable: true })
  decisionJustification!: string | null;

  @Column({ name: 'modifications', type: 'jsonb', default: {} })
  modifications!: Record<string, unknown>;

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl!: string | null;

  @Column({ name: 'pdf_generated_at', type: 'timestamptz', nullable: true })
  pdfGeneratedAt!: Date | null;

  @Column({ name: 'signature_id', type: 'uuid', nullable: true })
  signatureId!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;

  @Column({ name: 'signature_legal_status', type: 'varchar', length: 20, default: 'pending' })
  signatureLegalStatus!: string;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'draft' })
  status!: string;

  @Column({ name: 'submitted_to_carrier_at', type: 'timestamptz', nullable: true })
  submittedToCarrierAt!: Date | null;

  @Column({ name: 'carrier_received_at', type: 'timestamptz', nullable: true })
  carrierReceivedAt!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Notes importantes :
- `report_content` et `modifications` en `jsonb` (Postgres), exposes `Record<string, unknown>`.
- Statut par defaut `draft`, `signature_legal_status` par defaut `pending`.

### 7.13 `packages/expertise/src/index.ts`

```typescript
/**
 * Barrel public du package @insurtech/expertise.
 * Re-exporte l'API stable consommee par les modules NestJS (Sprint 14),
 * le frontend expert, et les autres packages verticaux.
 */

// Types
export * from './types/expert.types';
export * from './types/expert-assignment.types';
export * from './types/expert-report.types';
export * from './types/expert-roles.types';

// Schemas Zod
export * from './schemas/expert.schema';
export * from './schemas/expert-assignment.schema';
export * from './schemas/expert-report.schema';

// Entites TypeORM (squelettes, cablage Sprint 14)
export * from './entities/insure-expert.entity';
export * from './entities/insure-expert-assignment.entity';
export * from './entities/insure-expert-report.entity';

/** Version du contrat type du package (semver). */
export const VERSION = '0.1.0' as const;
```

Notes importantes :
- `VERSION` est `as const` (litteral `'0.1.0'`, type fige).
- Ordre des re-exports : types, schemas, entites (du plus pur au plus couple).

---

## 8. Tests complets

> Vitest 2.1.8. Chaque `.ts` source a son `.spec.ts`. Couverture cible >= 85%.

### 8.1 `packages/expertise/src/types/expert.types.spec.ts`

```typescript
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type Expert,
  ExpertSpecialtyEnum,
  ExpertStatusEnum,
  type ExpertType,
  ExpertTypeEnum,
} from './expert.types';

describe('ExpertTypeEnum', () => {
  it('contient exactement 4 types', () => {
    expect(ExpertTypeEnum.options).toHaveLength(4);
  });
  it('contient les 4 valeurs attendues', () => {
    expect(ExpertTypeEnum.options).toEqual([
      'independent',
      'firm_admin',
      'associate',
      'carrier_internal',
    ]);
  });
  it('rejette une valeur inconnue', () => {
    expect(ExpertTypeEnum.safeParse('unknown').success).toBe(false);
  });
});

describe('ExpertStatusEnum', () => {
  it('contient exactement 5 statuts', () => {
    expect(ExpertStatusEnum.options).toHaveLength(5);
  });
  it('inclut expired_agrement', () => {
    expect(ExpertStatusEnum.options).toContain('expired_agrement');
  });
});

describe('ExpertSpecialtyEnum', () => {
  it('contient exactement 10 specialites', () => {
    expect(ExpertSpecialtyEnum.options).toHaveLength(10);
  });
  it('inclut auto_fraud_investigation', () => {
    expect(ExpertSpecialtyEnum.options).toContain('auto_fraud_investigation');
  });
});

describe('Expert type', () => {
  it('expose un expertType de type ExpertType', () => {
    expectTypeOf<Expert['expertType']>().toEqualTypeOf<ExpertType>();
  });
  it('modelise carrierTenantId comme string | null', () => {
    expectTypeOf<Expert['carrierTenantId']>().toEqualTypeOf<string | null>();
  });
  it('modelise baselineHonoraireMad comme string (Money as string)', () => {
    expectTypeOf<Expert['baselineHonoraireMad']>().toEqualTypeOf<string>();
  });
});
```

### 8.2 `packages/expertise/src/schemas/expert.schema.spec.ts`

```typescript
import { describe, expect, it } from 'vitest';
import {
  ApproveKybSchema,
  OnboardExpertSchema,
  RejectKybSchema,
  SearchExpertsSchema,
} from './expert.schema';

const futureDate = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString();
};

const validInput = (): Record<string, unknown> => ({
  fullName: 'Karim El Fassi',
  cinNumber: 'AB123456',
  cinDocumentUrl: 'https://storage.ma/cin.pdf',
  phone: '+212612345678',
  email: 'karim@expert.ma',
  acapsAgrementNumber: 'ACAPS-2024-EXP-123',
  acapsAgrementDocumentUrl: 'https://storage.ma/agrement.pdf',
  acapsAgrementExpiryDate: futureDate(),
  acapsSpecialty: ['auto_collision'],
  expertType: 'independent',
  activeZones: ['Casablanca'],
  baselineHonoraireMad: '1500.00',
});

describe('OnboardExpertSchema -- CIN', () => {
  it('accepte une CIN valide', () => {
    expect(OnboardExpertSchema.safeParse(validInput()).success).toBe(true);
  });
  it('rejette une CIN en minuscules', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), cinNumber: 'ab123456' });
    expect(r.success).toBe(false);
  });
  it('rejette une CIN trop courte', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), cinNumber: 'A12345' });
    expect(r.success).toBe(false);
  });
});

describe('OnboardExpertSchema -- telephone +212', () => {
  it('accepte un +212 valide', () => {
    expect(OnboardExpertSchema.safeParse(validInput()).success).toBe(true);
  });
  it('rejette un numero national 06', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), phone: '0612345678' });
    expect(r.success).toBe(false);
  });
  it('rejette un +212 suivi du 0', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), phone: '+2120612345678' });
    expect(r.success).toBe(false);
  });
});

describe('OnboardExpertSchema -- numero ACAPS', () => {
  it('accepte un numero ACAPS valide', () => {
    expect(OnboardExpertSchema.safeParse(validInput()).success).toBe(true);
  });
  it('rejette un numero sans segment EXP', () => {
    const r = OnboardExpertSchema.safeParse({
      ...validInput(),
      acapsAgrementNumber: 'ACAPS-2024-123',
    });
    expect(r.success).toBe(false);
  });
});

describe('OnboardExpertSchema -- expiry refine', () => {
  it('rejette une date d expiration passee', () => {
    const r = OnboardExpertSchema.safeParse({
      ...validInput(),
      acapsAgrementExpiryDate: '2000-01-01T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });
});

describe('OnboardExpertSchema -- ICE 15 chiffres', () => {
  it('accepte un ICE de 15 chiffres', () => {
    const r = OnboardExpertSchema.safeParse({
      ...validInput(),
      expertType: 'firm_admin',
      firmName: 'Cabinet Atlas',
      firmIce: '001234567000089',
    });
    expect(r.success).toBe(true);
  });
  it('rejette un ICE de 14 chiffres', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), firmIce: '00123456700008' });
    expect(r.success).toBe(false);
  });
});

describe('OnboardExpertSchema -- specialite + montant', () => {
  it('rejette une liste de specialites vide', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), acapsSpecialty: [] });
    expect(r.success).toBe(false);
  });
  it('rejette un montant non decimal', () => {
    const r = OnboardExpertSchema.safeParse({ ...validInput(), baselineHonoraireMad: '15,00' });
    expect(r.success).toBe(false);
  });
});

describe('ApproveKybSchema / RejectKybSchema', () => {
  it('approuve avec uuid valides', () => {
    const r = ApproveKybSchema.safeParse({
      expertId: '11111111-1111-1111-1111-111111111111',
      reviewedByUserId: '22222222-2222-2222-2222-222222222222',
    });
    expect(r.success).toBe(true);
  });
  it('rejette KYB sans raison suffisante', () => {
    const r = RejectKybSchema.safeParse({
      expertId: '11111111-1111-1111-1111-111111111111',
      reviewedByUserId: '22222222-2222-2222-2222-222222222222',
      reason: 'court',
    });
    expect(r.success).toBe(false);
  });
});

describe('SearchExpertsSchema', () => {
  it('applique les defauts de pagination', () => {
    const r = SearchExpertsSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });
});
```

### 8.3 `packages/expertise/src/schemas/expert-assignment.schema.spec.ts`

```typescript
import { describe, expect, it } from 'vitest';
import {
  AcceptAssignmentSchema,
  CancelAssignmentSchema,
  DesignateExpertSchema,
  RejectAssignmentSchema,
  SearchAssignmentsSchema,
} from './expert-assignment.schema';

const uuid = '33333333-3333-3333-3333-333333333333';

describe('DesignateExpertSchema', () => {
  it('accepte une designation minimale', () => {
    const r = DesignateExpertSchema.safeParse({
      expertId: uuid,
      expertTenantId: uuid,
      sinistreId: uuid,
    });
    expect(r.success).toBe(true);
  });
  it('rejette une latitude hors bornes', () => {
    const r = DesignateExpertSchema.safeParse({
      expertId: uuid,
      expertTenantId: uuid,
      sinistreId: uuid,
      garageLat: 200,
    });
    expect(r.success).toBe(false);
  });
});

describe('AcceptAssignmentSchema', () => {
  it('accepte avec date de visite', () => {
    const r = AcceptAssignmentSchema.safeParse({
      assignmentId: uuid,
      visitScheduledAt: '2026-07-01T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});

describe('RejectAssignmentSchema / CancelAssignmentSchema', () => {
  it('rejette sans raison suffisante', () => {
    expect(RejectAssignmentSchema.safeParse({ assignmentId: uuid, reason: 'no' }).success).toBe(
      false,
    );
  });
  it('annule avec raison valide', () => {
    const r = CancelAssignmentSchema.safeParse({
      assignmentId: uuid,
      reason: 'Sinistre clos par accord amiable',
    });
    expect(r.success).toBe(true);
  });
});

describe('SearchAssignmentsSchema', () => {
  it('applique les defauts', () => {
    const r = SearchAssignmentsSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });
  it('rejette un statut inconnu', () => {
    expect(SearchAssignmentsSchema.safeParse({ status: 'frozen' }).success).toBe(false);
  });
});
```

### 8.4 `packages/expertise/src/schemas/expert-report.schema.spec.ts`

```typescript
import { describe, expect, it } from 'vitest';
import {
  CreateReportSchema,
  RecordDecisionSchema,
  SignReportSchema,
  SubmitReportSchema,
  UpdateReportSchema,
} from './expert-report.schema';

const uuid = '44444444-4444-4444-4444-444444444444';

describe('CreateReportSchema', () => {
  it('accepte un rapport avec contenu et defaut photos vide', () => {
    const r = CreateReportSchema.parse({ assignmentId: uuid, reportContent: { km: 12000 } });
    expect(r.photosUrls).toEqual([]);
  });
  it('rejette une URL photo invalide', () => {
    const r = CreateReportSchema.safeParse({
      assignmentId: uuid,
      reportContent: {},
      photosUrls: ['pas-une-url'],
    });
    expect(r.success).toBe(false);
  });
});

describe('RecordDecisionSchema', () => {
  it('accepte une decision validee justifiee', () => {
    const r = RecordDecisionSchema.safeParse({
      reportId: uuid,
      decision: 'validated',
      decisionJustification: 'Devis conforme aux dommages constates.',
    });
    expect(r.success).toBe(true);
  });
  it('rejette une decision inconnue', () => {
    const r = RecordDecisionSchema.safeParse({
      reportId: uuid,
      decision: 'maybe',
      decisionJustification: 'Justification suffisante ici.',
    });
    expect(r.success).toBe(false);
  });
  it('applique le defaut modifications vide', () => {
    const r = RecordDecisionSchema.parse({
      reportId: uuid,
      decision: 'modified',
      decisionJustification: 'Reduction du poste peinture.',
    });
    expect(r.modifications).toEqual({});
  });
});

describe('SignReportSchema / SubmitReportSchema / UpdateReportSchema', () => {
  it('signe avec signatureId uuid', () => {
    expect(SignReportSchema.safeParse({ reportId: uuid, signatureId: uuid }).success).toBe(true);
  });
  it('soumet avec reportId', () => {
    expect(SubmitReportSchema.safeParse({ reportId: uuid }).success).toBe(true);
  });
  it('met a jour les notes', () => {
    expect(UpdateReportSchema.safeParse({ reportId: uuid, notes: 'RAS' }).success).toBe(true);
  });
});
```

### 8.5 `packages/expertise/src/index.spec.ts`

```typescript
import { describe, expect, it } from 'vitest';
import * as pkg from './index';
import { VERSION } from './index';

describe('barrel @insurtech/expertise', () => {
  it('expose VERSION 0.1.0', () => {
    expect(VERSION).toBe('0.1.0');
  });
  it('re-exporte les enums de types', () => {
    expect(pkg.ExpertTypeEnum).toBeDefined();
    expect(pkg.ExpertAssignmentStatusEnum).toBeDefined();
    expect(pkg.ExpertReportStatusEnum).toBeDefined();
    expect(pkg.SignatureLegalStatusEnum).toBeDefined();
  });
  it('re-exporte les schemas Zod', () => {
    expect(pkg.OnboardExpertSchema).toBeDefined();
    expect(pkg.DesignateExpertSchema).toBeDefined();
    expect(pkg.CreateReportSchema).toBeDefined();
  });
  it('re-exporte les entites TypeORM', () => {
    expect(pkg.InsureExpert).toBeDefined();
    expect(pkg.InsureExpertAssignment).toBeDefined();
    expect(pkg.InsureExpertReport).toBeDefined();
  });
  it('expose le mapping des roles experts (4 roles)', () => {
    expect(pkg.EXPERT_ROLES).toHaveLength(4);
    expect(Object.keys(pkg.EXPERT_ROLE_CAPABILITIES)).toHaveLength(4);
  });
});
```

Recapitulatif tests : 5 fichiers spec, > 35 cas `it`, couvrant cardinalites d'enums (4/5/10/6/3/6/3/4), regex CIN/+212/ACAPS/ICE/Money, refine d'expiration, defauts de pagination, `expectTypeOf` sur l'entite, et barrel.

---

## 9. Variables d'environnement

Ce package est une fondation type/schema sans I/O ; il n'a pas de variables propres a l'execution. Les variables ci-dessous sont celles du contexte monorepo a respecter (consommees par les services Sprint 14 et la CI) :

| Variable | Role | Exemple / valeur |
|---|---|---|
| `NODE_VERSION` | Version Node imposee (engine-strict). | `>=22.11.0` |
| `PNPM_HOME` | Chemin pnpm (package manager unique). | `~/.local/share/pnpm` |
| `DATABASE_URL` | Connexion Postgres (utilisee par les entites au Sprint 14). | `postgres://...@dc1-atlas-benguerir/...` |
| `TZ` | Fuseau horaire des timestamps. | `Africa/Casablanca` |
| `CI` | Indicateur d'execution en integration continue. | `true` |
| `BIOME_BINARY` | Binaire biome pour le lint. | `node_modules/.bin/biome` |

---

## 10. Commandes shell

```bash
# Installation des dependances du workspace (a la racine du monorepo)
pnpm install

# Typecheck du package (aucune emission)
pnpm --filter @insurtech/expertise typecheck

# Build (emet dist/index.js + dist/index.d.ts)
pnpm --filter @insurtech/expertise build

# Lint biome
pnpm --filter @insurtech/expertise lint

# Tests vitest
pnpm --filter @insurtech/expertise test

# Tests en watch (dev)
pnpm --filter @insurtech/expertise test:watch

# Nettoyage
pnpm --filter @insurtech/expertise clean

# Verification anti-emoji (script depot, decision-006)
bash scripts/check-no-emoji.sh packages/expertise
```

---

## 11. Criteres de validation

> Format : ID -- priorite -- commande -- attendu -- mode d'echec.

P0 (>= 15) :

- V1 (P0) -- `test -f packages/expertise/package.json` -- fichier present -- absent => structure incomplete.
- V2 (P0) -- `node -e "require('./packages/expertise/package.json').name"` -- affiche `@insurtech/expertise` -- nom errone => import casse.
- V3 (P0) -- `node -e "console.log(require('./packages/expertise/package.json').version)"` -- `0.1.0` -- version differente => semver incoherent.
- V4 (P0) -- `test -f packages/expertise/tsconfig.json` -- present -- absent => build impossible.
- V5 (P0) -- `pnpm --filter @insurtech/expertise typecheck` -- exit 0 -- erreur TS => types invalides.
- V6 (P0) -- `pnpm --filter @insurtech/expertise build` -- exit 0 + dist/index.js -- echec => non consommable.
- V7 (P0) -- `test -f packages/expertise/dist/index.d.ts` -- present apres build -- absent => declarations manquantes.
- V8 (P0) -- `pnpm --filter @insurtech/expertise test` -- exit 0 -- echec => regressions.
- V9 (P0) -- `grep -c "z.enum" packages/expertise/src/types/expert.types.ts` -- >= 3 -- moins => enums manquants.
- V10 (P0) -- `node -e "..."` verifiant `ExpertSpecialtyEnum.options.length` -- `10` -- != 10 => specialites incompletes.
- V11 (P0) -- `node -e "..."` verifiant `ExpertTypeEnum.options.length` -- `4` -- != 4 => types incoherents.
- V12 (P0) -- `node -e "..."` verifiant `ExpertAssignmentStatusEnum.options.length` -- `6` -- != 6 => statuts mission.
- V13 (P0) -- `node -e "..."` verifiant `ExpertReportStatusEnum.options.length` -- `6` -- != 6 => statuts rapport.
- V14 (P0) -- `node -e "..."` verifiant `EXPERT_ROLES.length` -- `4` -- != 4 => roles incoherents.
- V15 (P0) -- `bash scripts/check-no-emoji.sh packages/expertise` -- aucun emoji -- emoji => CI fail (decision-006).
- V16 (P0) -- `grep -q "OnboardExpertSchema" packages/expertise/src/index.ts` -- present -- absent => schema non exporte.

P1 (>= 8) :

- V17 (P1) -- `pnpm --filter @insurtech/expertise lint` -- exit 0 -- probleme biome => style non conforme.
- V18 (P1) -- test CIN regex (spec) -- rejette `ab123456` -- accepte => regex CIN cassee.
- V19 (P1) -- test phone regex (spec) -- rejette `0612345678` -- accepte => regex +212 cassee.
- V20 (P1) -- test ACAPS regex (spec) -- rejette `ACAPS-2024-123` -- accepte => regex ACAPS cassee.
- V21 (P1) -- test ICE regex (spec) -- rejette 14 chiffres -- accepte => regex ICE cassee.
- V22 (P1) -- test expiry refine (spec) -- rejette date passee -- accepte => refine cassee.
- V23 (P1) -- `grep -q "save-exact" .npmrc` et absence de `^`/`~` dans deps -- exact -- caret => versions flottantes.
- V24 (P1) -- `grep -q "VERSION = '0.1.0'" packages/expertise/src/index.ts` -- present -- absent => version barrel manquante.

P2 (>= 5) :

- V25 (P2) -- `grep -q "Money as string" packages/expertise/src/types/expert.types.ts` -- present -- absent => doc montant manquante.
- V26 (P2) -- `grep -q "auth_tenants" packages/expertise/src/entities/insure-expert.entity.ts` -- present -- absent => FK doc manquante.
- V27 (P2) -- `grep -q "Sprint 14" packages/expertise/src/entities/insure-expert-report.entity.ts` -- present -- absent => perimetre non documente.
- V28 (P2) -- `grep -c "@Column" packages/expertise/src/entities/insure-expert.entity.ts` -- >= 20 -- moins => colonnes manquantes.
- V29 (P2) -- `expectTypeOf` (spec) sur `Expert['carrierTenantId']` -- `string | null` -- echec => modele nullable errone.

---

## 12. Edge cases + troubleshooting

1. **`composite: true` exige `declaration: true`** : si tsc se plaint de `composite`, verifier que `declaration: true` est present et que `tsconfig.base.json` n'impose pas `noEmit: true` sans surcharge (ce package surcharge `noEmit: false`).
2. **Decorateurs TypeORM ignores** : si `@Entity`/`@Column` declenchent une erreur, verifier `experimentalDecorators` et `emitDecoratorMetadata` dans `tsconfig.base.json`. Ils sont requis pour TypeORM 0.3.x.
3. **Import Zod manquant** : avec `noImplicitAny`, oublier `import { z } from 'zod'` casse tout le fichier. Chaque fichier schemas/types qui utilise Zod importe `z` explicitement.
4. **`exactOptionalPropertyTypes` vs nullable** : si une affectation `field = null` echoue, verifier que le type est `T | null` (et non `T | undefined`). Les colonnes nullable DB sont `T | null`.
5. **Regex echappee dans message Zod** : dans `OnboardExpertSchema`, le message de la regex CIN contient `\\d` (double backslash) car c'est une string. Ne pas confondre avec la regex elle-meme.
6. **`z.coerce.date()` sur string invalide** : une string ISO malformee produit `Invalid Date` ; le `.refine(d => d > new Date())` echoue alors car `Invalid Date > now` est `false`. Comportement attendu (rejet).
7. **noUncheckedIndexedAccess sur `.options`** : acceder a `Enum.options[0]` donne `string | undefined`. Dans les tests, comparer le tableau entier (`toEqual([...])`) plutot que par index.
8. **Build avant test** : vitest teste les sources `.ts` directement (pas dist), donc un test peut passer alors que le build echoue. Toujours lancer `typecheck` ET `build` en plus de `test`.
9. **Filter pnpm sans install** : `pnpm --filter @insurtech/expertise build` echoue si `pnpm install` n'a pas lie le workspace. Lancer `pnpm install` a la racine d'abord.
10. **jsonb default `{}`** : TypeORM serialise le default `{}` ; si une migration future detecte une difference de schema, c'est le DDL (tache 2.5.6) qui fait foi, pas le squelette.

---

## 13. Conformite Maroc

### 13.1 ACAPS (agrement experts)

L'Autorite de Controle des Assurances et de la Prevoyance Sociale agree les experts en automobile. Le package modelise :

- **Format du numero d'agrement** : `ACAPS-YYYY-EXP-NNN` (`/^ACAPS-\d{4}-EXP-\d{3,5}$/`), ou `YYYY` est l'annee d'agrement et `NNN` un sequentiel de 3 a 5 chiffres.
- **Expiration** : `acapsAgrementExpiryDate` obligatoire ; a l'onboarding la date doit etre future ; un agrement expire bascule l'expert en statut `expired_agrement` (aucune mission possible). La verification periodique est cablee au Sprint 14.
- **Specialites** : 10 specialites auto agreees (`ExpertSpecialtyEnum`). Un expert doit declarer au moins une specialite ; le matching mission/specialite (Sprint 22.7) s'appuie sur ce champ.
- **Document justificatif** : `acapsAgrementDocumentUrl` pointe vers le scan de l'agrement, stocke sur le cloud souverain marocain (decision-008).

### 13.2 CNDP (loi 09-08) -- PII expert

La loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel impose :

- **Minimisation** : seules les donnees necessaires a l'exercice (nom, CIN, telephone, email, agrement) sont collectees.
- **Documents sensibles** : `cinDocumentUrl` et `acapsAgrementDocumentUrl` referencent des fichiers chiffres au repos (AES-256-GCM) sur stockage souverain ; aucune donnee assure/expert ne quitte le Maroc (decision-008).
- **Tracabilite** : les revues KYB (`kybReviewedAt`, `kybReviewedByUserId`, `kybRejectionReason`) constituent une piste d'audit conforme. L'audit trail complet est cable au Sprint 14.
- **Droit a l'effacement** : le statut `inactive` permet la desactivation ; la purge effective relevera des procedures CNDP du Sprint 14.

### 13.3 Loi 17-99 (Code des assurances)

Le Code des assurances marocain (loi 17-99) encadre l'expertise comme acte prealable a l'indemnisation. La modelisation `ExpertAssignment` -> `ExpertReport` -> decision (`validated`/`modified`/`rejected`) materialise le role de l'expert comme tiers de confiance entre l'assureur et le garage/assure, conformement aux obligations d'evaluation contradictoire des dommages.

---

## 14. Conventions absolues skalean-insurtech

> Liste reproduite integralement. Toute violation bloque la PR.

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sur toutes les routes sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` applique a chaque controller ; contexte propage via `AsyncLocalStorage` ; isolation au niveau base via RLS et la fonction `app_can_access_tenant()` ; chaque acces ecrit dans l'audit trail.
- **Validation strict** : Zod uniquement ; tous les schemas exportes ; pattern `const Schema = z.object(...)` puis `type = z.infer<typeof Schema>`.
- **Logger strict** : Pino injecte (`nestjs-pino`) ; jamais `console.log` ; JSON structure avec champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id parametres 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER` applique.
- **Package manager strict** : pnpm uniquement ; `engine-strict` Node `>=22.11.0` ; `save-exact` (aucun `^` ni `~`) ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` possede son `.spec.ts` ; couverture `>= 85%` (et `>= 90%` pour auth/database/signature).
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles v3.0.
- **Events strict** : Kafka, topics `insurtech.events.{vertical}.{entity}.{action}` ; un schema Zod par evenement ; `Idempotency-Key` pour les evenements critiques.
- **Imports strict** : packages internes `@insurtech/{name}` ; chemins via `tsconfig.base.json` paths ; ordre des imports Node / externes / `@insurtech` / relatifs.
- **Skalean AI strict (decision-005)** : acces IA uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un modele frontier ; mock pour les sprints 1-28, reel a partir du sprint 29.
- **No-emoji strict (decision-006, ABSOLUE)** : aucun emoji nulle part ; `check-no-emoji.sh` ; la CI echoue si un emoji est detecte.
- **Idempotency-Key strict** : obligatoire sur `POST /payments`, `/signatures`, `/claims`, et les ecritures MCP ; TTL 24h dans Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne quitte le Maroc ; chiffrement AES-256-GCM ; TLS 1.3.
- **Naming v3.0 (decision-011)** : Skalean (societe), Assurflow (vertical/plateforme), Sofidemy (marque commerciale).

---

## 15. Validation pre-commit

```bash
# 1. Typecheck
pnpm --filter @insurtech/expertise typecheck

# 2. Lint
pnpm --filter @insurtech/expertise lint

# 3. Tests
pnpm --filter @insurtech/expertise test

# 4. Build
pnpm --filter @insurtech/expertise build

# 5. Anti-emoji (decision-006)
bash scripts/check-no-emoji.sh packages/expertise

# 6. Verification versions exactes (aucun ^ ou ~)
! grep -E '"[~^]' packages/expertise/package.json
```

Les 6 etapes doivent passer (exit 0) avant tout commit. Le hook husky `pre-commit` execute lint + anti-emoji ; le hook `pre-push` execute typecheck + test + build.

---

## 16. Commit message

```
feat(sprint-7.5b): package @insurtech/expertise structure + types

Cree le package monorepo @insurtech/expertise (fondation du vertical
Expert, decision-013). Livre la structure de package, les types
TypeScript exhaustifs (Expert / ExpertAssignment / ExpertReport +
enumerations), les schemas Zod de validation (onboarding, KYB,
designation, rapport) avec contraintes Maroc (CIN, +212, ACAPS, ICE,
Money as string), le mapping des 4 roles experts vers leurs capacites,
et les squelettes d'entites TypeORM (colonnes snake_case, FK vers
auth_tenants/auth_users). L'implementation des services est reportee
au Sprint 14 ; le DDL des tables aux taches 2.5.4/2.5.5/2.5.6.

Conforme TypeScript strict, validation Zod, save-exact, no-emoji.

Task: 2.5.1
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2 -- Securite extensions
Decisions: 012 + 013
```

---

## 17. Workflow -- etape suivante

Une fois cette tache validee (V1-V29 verts, commit pousse) :

- **Etape immediate** : passer a la tache **2.5.2 -- package `@insurtech/tow`** (fondation du vertical remorquage/depannage), qui suit la meme structure (types + schemas + squelettes entites) et reference les memes tables `auth_tenants`/`auth_users`. Le package `@insurtech/tow` liera `garageTenantId` et la geolocalisation deja modelisee dans `ExpertAssignment`.
- **Puis** : 2.5.3 (`@insurtech/garage`), 2.5.4/2.5.5/2.5.6 (DDL des tables `insure_expert`, `insure_expert_assignment`, `insure_expert_report`), 2.5.7 (squelettes de services NestJS du vertical Expert).
- **Plus loin (Sprint 14)** : cablage complet (services, repositories, controllers RBAC, generation PDF, signature, evenements Kafka). **Sprint 22.7** : notation/reputation + marketplace experts.

Ne pas demarrer 2.5.7 (squelettes services) avant que 2.5.1, 2.5.4, 2.5.5 et 2.5.6 soient mergees, car les services importent a la fois les types (2.5.1) et dependent du DDL (2.5.4-2.5.6).

---

> Densite cible : 80-150 ko (~100-115 ko). Blocs de code complets : 23 (package.json, tsconfig.json, 4 fichiers types, 3 schemas, 3 entites, index.ts, 5 fichiers de tests, + commandes/commit). Tests : 5 fichiers spec, > 35 cas it. Criteres de validation : 29 (V1-V29 ; P0 = 16, P1 = 8, P2 = 5). Sections : 17 dans l'ordre + footer. AUCUNE EMOJI (decision-006).
