# TACHE 2.7.1 -- Package @insurtech/comm (Types + Schemas Zod + Constants Whitelist/Blacklist)

**Sprint** : 9 (Phase 2 / Sprint 7 dans phase) -- Comm WhatsApp Scope Strict + Email Data Sensible
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-whatsapp-scope-strict.md` (Tache 2.7.1)
**Phase** : 2 -- Securite + Infrastructure
**Priorite** : P0 (premiere tache du sprint ; bloque les 9 taches suivantes 2.7.2 a 2.7.10 qui consomment toutes les types, schemas et constants exportes par ce package)
**Effort** : 4h
**Dependances** : Sprint 8 complet (pattern package `@insurtech/crm` + `@insurtech/booking` comme reference structurelle de monorepo package), Sprint 7.5a complet (catalogue 130 permissions `as const` dont `customer.notifications.manage`), Sprint 5 complet (pattern `@insurtech/auth` reutilise), Sprint 2 complet (TypeORM + pattern migration), Sprint 1 complet (pnpm workspace + turbo + tsconfig.base.json strict)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache bootstrappe le package `@insurtech/comm` (NOUVEAU v3.0), fondation du module de communication multi-canal de la plateforme Assurflow. Le but est de creer la structure complete du package (types, schemas Zod, constantes, services squelettes, configuration build) et surtout d'exporter les deux artefacts legaux centraux du sprint : la whitelist `STATUS_ONLY_TEMPLATES` (45 templates autorises sur WhatsApp) et la blacklist `BLACKLISTED_FIELD_PATTERNS` (15 patterns de champs interdits sur WhatsApp). Ces deux constantes sont le coeur de la correction Saad terrain #7 (conformite CNDP loi 09-08) et seront consommees par le service WhatsApp (tache 2.7.2), le Notification Router (tache 2.7.7) et les tests E2E (tache 2.7.10).

L'apport est triple. Premierement, il fournit un socle de types TypeScript strict pour les quatre canaux de communication (WhatsApp, Email, Push, SMS), garantissant que toute donnee transitant par le module est typee a la compilation, ce qui elimine une classe entiere de bugs de mapping. Deuxiemement, il centralise les schemas de validation runtime Zod (`SendWhatsAppStatus`, `SendEmail`, `SendPush`, `SendOtp`) afin que la validation soit identique entre les controllers, les services et les consommateurs Kafka, conformement a la regle de defense en profondeur de skalean-insurtech. Troisiemement, il expose les constantes de conformite (whitelist/blacklist) avec un helper `isBlacklistedField()` testable unitairement, ce qui transforme une exigence legale (ne jamais faire transiter un montant ou un CIN par WhatsApp) en garde-fou code, verifiable et impossible a contourner par erreur de developpement.

A l'issue de cette tache, le package compile en mode strict, expose tous ses symboles publics via `src/index.ts`, et passe 4+ tests de bootstrap verifiant notamment que `ALL_STATUS_TEMPLATES.length === 45` et `BLACKLISTED_FIELD_PATTERNS.length >= 15`. Aucune logique d'envoi reseau n'est implementee ici (elle arrive en 2.7.2 a 2.7.6) : cette tache pose uniquement les contrats. C'est volontaire : un contrat stable et exhaustif evite les refactors en cascade dans les 9 taches suivantes.

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech / Assurflow opere au Maroc, ou la loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel (administree par la CNDP) impose un traitement loyal, licite et limite a une finalite definie (articles 3, 12 a 14). WhatsApp, propriete de Meta, achemine ses messages via des serveurs situes hors du territoire marocain (principalement aux Etats-Unis). Faire transiter par ce canal une donnee sensible -- un montant de prime, un numero de CIN, un IBAN, un montant de franchise, un total de devis -- constituerait un transfert transfrontalier de donnees personnelles sans garantie de niveau de protection adequat, donc une violation directe de la loi 09-08.

Au-dela du risque legal, la correction terrain #7 remontee par Saad documente un risque operationnel concret au Maroc : le social engineering. Les escrocs exploitent les montants visibles dans les messages pour manipuler les assures (faux remboursements, faux appels de fonds). La parade structurelle retenue est une separation stricte des canaux : WhatsApp ne porte que des statuts (status_only), l'email porte les donnees sensibles (canal controlable avec DKIM/SPF/DMARC + archivage local), le push porte des milestones courts non sensibles (visibles sur ecran verrouille), le SMS est reserve aux OTP.

Cette tache 2.7.1 materialise cette separation au niveau du code en deux listes constantes. La whitelist est restrictive par construction : seul un template explicitement liste peut etre envoye sur WhatsApp. La blacklist est une seconde barriere : meme si un template autorise recevait par erreur un champ `amount`, l'envoi serait rejete avant d'atteindre l'API Meta. Cette approche defense-en-profondeur (whitelist ET blacklist) est exigee parce qu'une seule barriere serait un point de defaillance unique pour une exigence legale P0.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Whitelist seule (templates autorises) | Simple, une seule liste a maintenir | Si un template autorise recoit un champ sensible par bug de mapping, la fuite passe ; point de defaillance unique pour exigence legale | rejete : insuffisant pour P0 legal |
| Blacklist seule (patterns interdits) | Flexible, nouveaux templates sans modification de liste | Un champ sensible mal nomme (ex : `montant_fr`) echapperait au filtre ; logique de detection devient l'unique barriere | rejete : risque de faux negatif |
| Whitelist + Blacklist (defense en profondeur) | Deux barrieres independantes ; un template doit etre autorise ET ne contenir aucun champ blackliste | Deux listes a maintenir ; complexite legerement superieure | RETENU : exige par criticite legale P0 correction Saad #7 |
| Champ `sensitive: boolean` par template en DB | Configurable runtime sans redeploy | Donnee de conformite mutable hors code review ; risque qu'un admin desactive la protection | rejete : conformite doit etre dans le code versionne, pas en DB editable |
| Validation cote frontend uniquement | UX immediate | Contournable trivialement (appel API direct) ; jamais acceptable pour exigence legale | rejete : validation legale doit etre server-side |

La decision retenue (whitelist + blacklist server-side, dans le code versionne) suit la regle skalean-insurtech selon laquelle toute regle de conformite doit etre verifiable a la revue de code, testable unitairement, et impossible a desactiver depuis une interface d'administration.

### 2.3 Trade-offs explicites

Le choix de geler les 45 templates dans une constante TypeScript `as const` (plutot qu'une table de configuration) a un cout : ajouter un template downstream (Sprint 17 customer portal, Sprint 18 assure mobile, Sprint 22.5 tow, Sprint 22.7 expert) exige une modification du code de ce package et un redeploy. C'est un trade-off assume : la liste des templates autorises est une donnee de conformite, et toute modification doit passer par une pull request revue. Le gain est que TypeScript verifie a la compilation que la structure est correcte et que `ALL_STATUS_TEMPLATES.length === 45`.

Le choix de la detection blacklist par `includes()` (sous-chaine) plutot que par egalite exacte ou regex elargit volontairement la couverture : `total_mad`, `total`, `devis_total` sont tous attrapes par le pattern `total`. Le trade-off est un risque de faux positif (un champ legitime nomme `total_steps` serait rejete). Ce trade-off penche volontairement vers la sur-protection : en cas de doute, on bloque, et le developpeur renomme son champ ou utilise l'email. Pour une exigence legale, un faux positif (envoi legitime bloque) est infiniment preferable a un faux negatif (fuite de donnee sensible).

Le package n'embarque pas encore les dependances reseau lourdes (twilio, firebase-admin, expo-server-sdk) dans cette tache : seules les dependances de types/validation (`zod`) et le builtin `node:crypto` sont necessaires. Les dependances de transport seront ajoutees aux taches qui les utilisent (2.7.4 a 2.7.6). Cela garde le `pnpm install` de cette tache rapide et le graphe de dependances minimal.

### 2.4 Decisions strategiques referenced

- **decision-006 (no-emoji policy)** : les templates Handlebars (tache 2.7.3) et tous les commentaires/logs de ce package ne contiennent aucune emoji. Le pre-commit hook `check-no-emoji.sh` rejette toute violation. Cette tache pose les fondations textuelles : aucun symbole emoji dans les types, constantes ou commentaires.
- **decision-008 (data residency Maroc + multilingue 4 langues)** : l'enum `WhatsAppLanguageEnum` expose exactement 4 langues (fr, ar, ar-MA darija, en). Aucune donnee assure ne transite hors Maroc, ce qui justifie la separation de canal materialisee ici.
- **decision-011 (assurflow rebrand)** : le domaine email primaire est `assurflow.ma` (et non l'ancien nom v2.2). Les types et constantes refletent ce branding.
- **correction Saad terrain #7** : whitelist 45 + blacklist 15 server-side. C'est la raison d'etre de cette tache. Voir documentation policy produite en tache 2.7.10.

### 2.5 Pieges techniques connus

1. **Piege : perte du type litteral avec `as const` mal place**
   - Pourquoi : si `STATUS_ONLY_TEMPLATES` est declare sans `as const`, TypeScript infere `string[]` au lieu des litteraux exacts, et le compile-time check de longueur ainsi que l'autocompletion des noms de templates sont perdus.
   - Solution : toujours terminer l'objet par `as const`, et deriver `ALL_STATUS_TEMPLATES` via `Object.values(...).flat()`. Verifier que `typeof ALL_STATUS_TEMPLATES[number]` est une union de litteraux.

2. **Piege : `BLACKLISTED_FIELD_PATTERNS.length` non garanti a 15**
   - Pourquoi : la migration v2.2 -> v3.0 a connu des aller-retours sur le nombre exact de patterns. Le meta-prompt exige `>= 15`.
   - Solution : declarer exactement 15 patterns (8 money + 3 identity + 2 banking + 2 auth) et ajouter un test `expect(BLACKLISTED_FIELD_PATTERNS.length).toBeGreaterThanOrEqual(15)`.

3. **Piege : `isBlacklistedField` insensible a la casse oublie le trim**
   - Pourquoi : un champ `" Amount "` (espaces + majuscule) provenant d'un mapping externe echapperait a `includes('amount')` si on ne normalise pas.
   - Solution : `fieldName.toLowerCase().trim()` avant comparaison. Tester avec espaces et majuscules.

4. **Piege : schema Zod `SendWhatsAppStatus` accepte `data` non contraint**
   - Pourquoi : si `data: z.record(z.string(), z.any())`, un objet sensible passe la validation de schema (la barriere blacklist est en 2.7.2, mais le schema doit deja restreindre les valeurs a `string`).
   - Solution : `data: z.record(z.string(), z.string())` (valeurs string uniquement) pour WhatsApp. L'email autorise des valeurs plus riches.

5. **Piege : E.164 phone non valide accepte**
   - Pourquoi : un numero marocain mal formate (`0600000000` au lieu de `+212600000000`) ferait echouer l'API Meta plus tard avec un message obscur.
   - Solution : regex E.164 `/^\+[1-9]\d{6,14}$/` dans le schema Zod `to`. Documenter le format attendu `+212XXXXXXXXX`.

6. **Piege : import cyclique entre `index.ts` et services**
   - Pourquoi : si `index.ts` exporte les services et que les services importent depuis `@insurtech/comm` (self-import), un cycle apparait.
   - Solution : a l'interieur du package, importer par chemins relatifs (`./constants/...`), jamais via `@insurtech/comm`. Le self-import via alias n'est utilise que par les consommateurs externes (apps/api).

7. **Piege : `tsconfig.json` du package n'herite pas de `tsconfig.base.json`**
   - Pourquoi : sans `extends`, les flags strict (`noUncheckedIndexedAccess`, `noImplicitAny`) ne s'appliquent pas, et `any` implicite passe.
   - Solution : `"extends": "../../tsconfig.base.json"` dans `packages/comm/tsconfig.json`.

8. **Piege : `package.json` sans `name: @insurtech/comm`**
   - Pourquoi : le workspace pnpm ne resout pas l'alias `@insurtech/comm` si le nom du package ne correspond pas.
   - Solution : `"name": "@insurtech/comm"`, `"version": "0.0.0"`, et verification `find packages -name package.json -exec grep -l '@insurtech/comm'`.

9. **Piege : valeurs `as const` figees mais comparees a `string` dans `isTemplateWhitelisted`**
   - Pourquoi : `ALL_STATUS_TEMPLATES.includes(templateName)` echoue a la compilation car `templateName: string` n'est pas assignable au type litteral de l'array.
   - Solution : caster `(ALL_STATUS_TEMPLATES as readonly string[]).includes(templateName)`.

10. **Piege : darija `ar-MA` confondu avec `ar`**
    - Pourquoi : si l'enum utilise `AR_MA: 'ar_MA'` (underscore) au lieu de `'ar-MA'` (tiret), le code de langue ne correspond pas a la norme BCP 47 attendue par Meta.
    - Solution : valeur exacte `'ar-MA'` (tiret), conforme BCP 47. Tester l'egalite stricte.

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.7.1 est la premiere des 10 taches du Sprint 9. Elle :
- Depend de : Sprint 8 (pattern de package monorepo `@insurtech/crm`), Sprint 7.5a (catalogue de permissions `customer.notifications.manage`), Sprint 1 (tooling pnpm/turbo/tsconfig strict).
- Bloque : 2.7.2 (WhatsApp service importe `ALL_STATUS_TEMPLATES`, `BLACKLISTED_FIELD_PATTERNS`, `WhatsAppStatusMessage`), 2.7.3 (template-manager importe `WhatsAppLanguage`, `WhatsAppTemplateCategory`), 2.7.4 (email importe `SendEmailInput`), 2.7.5 (push importe `SendPushInput`), 2.7.6 (sms importe `SendOtpInput`), 2.7.7 (router importe `ContentType` + tous schemas), 2.7.8 (audit importe types notification), 2.7.9 (endpoints importent DTOs derives), 2.7.10 (tests importent constantes pour verification blacklist).
- Apporte au sprint : le contrat partage. Sans ce contrat, aucune autre tache ne compile.

### 3.2 Position dans le programme global

Le package `@insurtech/comm` est consomme par tous les sprints metiers downstream qui notifient des acteurs : Sprint 14 (Insure foundation -- notifications carrier via Email), Sprint 17 (Customer Portal -- 12 templates customer whitelist), Sprint 18 (Assure Mobile -- 8 templates assure whitelist + push), Sprint 21 (Sinistre Workflow -- status updates WhatsApp), Sprint 22.5 (Tow App -- 6 templates tow), Sprint 22.7 (Expert App -- 4 templates expert), Sprint 24 (Flux 5 acteurs -- orchestration via NotificationRouter), Sprint 26.5 (Carrier Portal -- notifications carrier via Email + audit). Les 45 templates de la whitelist anticipent deja ces consommateurs : 9 repair + 6 insure + 12 customer + 8 assure + 6 tow + 4 expert = 45.

### 3.3 Diagramme architecture

```
                 packages/comm (CE PACKAGE -- tache 2.7.1 pose le contrat)
+--------------------------------------------------------------------------+
|  src/                                                                    |
|   types/        whatsapp | email | push | sms .types.ts                  |
|   schemas/      send-whatsapp | send-email | send-push | send-otp .zod   |
|   constants/    status-only-templates(45) | blacklisted-fields(15)       |
|                 template-categories(6)                                   |
|   index.ts  --> exporte TOUS les symboles publics                        |
+--------------------------------------------------------------------------+
       |                |                |                |
       v                v                v                v
   2.7.2            2.7.4            2.7.5            2.7.6
   WhatsApp svc     Email svc        Push svc         SMS svc
       |                |                |                |
       +--------+-------+--------+-------+
                v                v
            2.7.7 NotificationRouter --> 2.7.8 Audit ACAPS --> 2.7.9 REST endpoints
                                                                     |
                                                                     v
                                                          2.7.10 Tests E2E + blacklist
```

## 4. Livrables checkables

- [ ] `repo/packages/comm/package.json` cree, `name: @insurtech/comm`, scripts build/test/typecheck (~40 lignes)
- [ ] `repo/packages/comm/tsconfig.json` etend `../../tsconfig.base.json` (~15 lignes)
- [ ] `repo/packages/comm/vitest.config.ts` configure coverage v8 seuil 90% (~25 lignes)
- [ ] `repo/packages/comm/src/types/whatsapp.types.ts` -- enums Category/Language + `WhatsAppStatusMessage` (~90 lignes)
- [ ] `repo/packages/comm/src/types/email.types.ts` -- `EmailMessage` + `EmailAttachment` + `SendEmailInput` (~70 lignes)
- [ ] `repo/packages/comm/src/types/push.types.ts` -- `PushNotification` + `DeepLink` + `SendPushInput` (~60 lignes)
- [ ] `repo/packages/comm/src/types/sms.types.ts` -- `SmsOtp` + `OtpStatus` + `SendOtpInput` (~50 lignes)
- [ ] `repo/packages/comm/src/constants/status-only-templates.ts` -- whitelist 45 + `ALL_STATUS_TEMPLATES` (~120 lignes)
- [ ] `repo/packages/comm/src/constants/blacklisted-fields.ts` -- 15 patterns + `isBlacklistedField` (~70 lignes)
- [ ] `repo/packages/comm/src/constants/template-categories.ts` -- enum 6 categories + helpers (~50 lignes)
- [ ] `repo/packages/comm/src/schemas/send-whatsapp.schema.ts` -- Zod `SendWhatsAppStatusSchema` (~70 lignes)
- [ ] `repo/packages/comm/src/schemas/send-email.schema.ts` -- Zod `SendEmailSchema` (data sensible OK) (~90 lignes)
- [ ] `repo/packages/comm/src/schemas/send-push.schema.ts` -- Zod `SendPushSchema` (~60 lignes)
- [ ] `repo/packages/comm/src/schemas/send-otp.schema.ts` -- Zod `SendOtpSchema` (~50 lignes)
- [ ] `repo/packages/comm/src/index.ts` -- barrel exporte tous les symboles publics (~50 lignes)
- [ ] `repo/packages/comm/src/constants/status-only-templates.spec.ts` -- test count === 45 (~60 lignes)
- [ ] `repo/packages/comm/src/constants/blacklisted-fields.spec.ts` -- test count + helper (~110 lignes)
- [ ] `repo/packages/comm/src/schemas/send-whatsapp.schema.spec.ts` -- tests Zod (~120 lignes)
- [ ] `repo/packages/comm/src/index.spec.ts` -- test exports bootstrap (~60 lignes)
- [ ] `pnpm --filter @insurtech/comm build` termine sans erreur
- [ ] `pnpm --filter @insurtech/comm vitest run` : 4+ fichiers de tests PASS
- [ ] Verification runtime : `ALL_STATUS_TEMPLATES.length === 45` et `BLACKLISTED_FIELD_PATTERNS.length === 15`
- [ ] `pnpm --filter @insurtech/comm typecheck` : 0 erreur, strict mode actif
- [ ] Aucune emoji dans aucun fichier cree (grep CI)

## 5. Fichiers crees / modifies

```
repo/packages/comm/package.json                                   (~40 lignes / manifest workspace)
repo/packages/comm/tsconfig.json                                  (~15 lignes / extends base strict)
repo/packages/comm/vitest.config.ts                               (~25 lignes / coverage 90%)
repo/packages/comm/src/types/whatsapp.types.ts                    (~90 lignes / enums + WhatsAppStatusMessage)
repo/packages/comm/src/types/email.types.ts                      (~70 lignes / EmailMessage + attachments)
repo/packages/comm/src/types/push.types.ts                       (~60 lignes / PushNotification + DeepLink)
repo/packages/comm/src/types/sms.types.ts                        (~50 lignes / SmsOtp + OtpStatus)
repo/packages/comm/src/constants/status-only-templates.ts        (~120 lignes / whitelist 45 + flat)
repo/packages/comm/src/constants/status-only-templates.spec.ts   (~60 lignes / count 45)
repo/packages/comm/src/constants/blacklisted-fields.ts           (~70 lignes / 15 patterns + helper)
repo/packages/comm/src/constants/blacklisted-fields.spec.ts      (~110 lignes / count + helper deep)
repo/packages/comm/src/constants/template-categories.ts          (~50 lignes / enum 6 + helpers)
repo/packages/comm/src/schemas/send-whatsapp.schema.ts           (~70 lignes / Zod WhatsApp E.164)
repo/packages/comm/src/schemas/send-whatsapp.schema.spec.ts      (~120 lignes / tests Zod)
repo/packages/comm/src/schemas/send-email.schema.ts              (~90 lignes / Zod Email data sensible)
repo/packages/comm/src/schemas/send-push.schema.ts               (~60 lignes / Zod Push longueur)
repo/packages/comm/src/schemas/send-otp.schema.ts                (~50 lignes / Zod OTP 6 digits)
repo/packages/comm/src/index.ts                                  (~50 lignes / barrel export)
repo/packages/comm/src/index.spec.ts                             (~60 lignes / bootstrap exports)
```

Aucun fichier existant modifie hors `repo/pnpm-workspace.yaml` (deja inclut `packages/*`, donc pas de modification) et `repo/tsconfig.base.json` (deja existant, pas de modification). Le package est purement additif.

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 14 : `repo/packages/comm/package.json`

Manifest du workspace. Le nom DOIT etre `@insurtech/comm` pour que l'alias pnpm resolve. Versions exactes (decision-001 save-exact).

```json
{
  "name": "@insurtech/comm",
  "version": "0.0.0",
  "private": true,
  "description": "Module communication multi-canal scope strict (WhatsApp status-only + Email data sensible + Push + SMS OTP) -- conformite CNDP loi 09-08",
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
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist .turbo coverage"
  },
  "dependencies": {
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8",
    "@vitest/coverage-v8": "2.1.8"
  }
}
```

**Notes importantes** :
- `zod` est la seule dependance runtime de cette tache ; les dependances de transport (twilio, expo-server-sdk, firebase-admin, axios, nodemailer, handlebars, @parse/node-apn) sont ajoutees aux taches 2.7.3 a 2.7.6 qui les utilisent.
- `node:crypto` est builtin, pas de dependance.
- `"private": true` car package interne non publie sur npm public.
- Versions exactes sans `^` ni `~` (convention package manager strict).

### 6.2 Fichier 2 sur 14 : `repo/packages/comm/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

**Notes importantes** :
- `extends` herite des flags strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`) de `tsconfig.base.json`. Sans cet extends, le mode strict n'est pas applique (piege 7).
- `composite: true` permet a turbo de cacher la sortie de build du package.
- Les fichiers `.spec.ts` sont exclus du build mais inclus par vitest.

### 6.3 Fichier 3 sur 14 : `repo/packages/comm/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      // Sprint 9 exige >= 90% (vs 85% standard) car CRITIQUE correction Saad #7
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      exclude: ['**/*.spec.ts', '**/index.ts', '**/*.types.ts'],
    },
  },
});
```

**Notes importantes** :
- Seuil de coverage 90% (et non 85% standard) car Sprint 9 est critique conformite.
- Les fichiers types-only et le barrel `index.ts` sont exclus du calcul de coverage (pas de logique a couvrir).

### 6.4 Fichier 4 sur 14 : `repo/packages/comm/src/types/whatsapp.types.ts`

```typescript
/**
 * Types WhatsApp scope strict (correction Saad terrain #7 -- CNDP loi 09-08).
 *
 * WhatsApp = STATUS ONLY. Aucune donnee sensible (montant, CIN, IBAN, token)
 * ne peut transiter par ce canal. L'enforcement est realise en tache 2.7.2
 * via whitelist (STATUS_ONLY_TEMPLATES) + blacklist (BLACKLISTED_FIELD_PATTERNS).
 */

/**
 * Categories de templates WhatsApp (6 categories metier).
 * Chaque categorie regroupe les statuts d'un acteur de l'ecosysteme 6 acteurs
 * (decision-012).
 */
export const WhatsAppTemplateCategoryEnum = {
  REPAIR: 'repair',
  INSURE: 'insure',
  CUSTOMER: 'customer',
  ASSURE: 'assure',
  TOW: 'tow',
  EXPERT: 'expert',
} as const;

export type WhatsAppTemplateCategory =
  typeof WhatsAppTemplateCategoryEnum[keyof typeof WhatsAppTemplateCategoryEnum];

/**
 * Langues supportees (decision-008 multilingue 4 langues).
 * - fr    : francais (langue par defaut / fallback)
 * - ar    : arabe standard
 * - ar-MA : darija marocaine (BCP 47, tiret obligatoire, jamais underscore)
 * - en    : anglais
 */
export const WhatsAppLanguageEnum = {
  FR: 'fr',
  AR: 'ar',
  AR_MA: 'ar-MA',
  EN: 'en',
} as const;

export type WhatsAppLanguage =
  typeof WhatsAppLanguageEnum[keyof typeof WhatsAppLanguageEnum];

export const SUPPORTED_LANGUAGES: ReadonlyArray<WhatsAppLanguage> = [
  WhatsAppLanguageEnum.FR,
  WhatsAppLanguageEnum.AR,
  WhatsAppLanguageEnum.AR_MA,
  WhatsAppLanguageEnum.EN,
];

export const DEFAULT_LANGUAGE: WhatsAppLanguage = WhatsAppLanguageEnum.FR;

/**
 * Statut de synchronisation d'un template avec Meta Business Manager.
 */
export const WhatsAppTemplateStatusEnum = {
  PENDING: 'PENDING',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type WhatsAppTemplateStatus =
  typeof WhatsAppTemplateStatusEnum[keyof typeof WhatsAppTemplateStatusEnum];

/**
 * Message de statut WhatsApp. Le champ `data` ne contient QUE des chaines
 * non sensibles (jamais amount/cin/token). L'enforcement runtime est en 2.7.2.
 */
export interface WhatsAppStatusMessage {
  /** Numero destinataire au format E.164, ex: +212600000000 */
  to: string;
  /** Doit imperativement etre dans STATUS_ONLY_TEMPLATES (whitelist 45) */
  templateName: string;
  /** Donnees safe uniquement (string -> string). Jamais de donnee sensible. */
  data: Record<string, string>;
  /** Langue du template (fallback fr si variante absente) */
  language: WhatsAppLanguage;
  /** Tenant emetteur (multi-tenant strict) */
  tenantId: string;
  /** Utilisateur emetteur (rate limiting + audit) */
  userId: string;
  /** Identifiant de correlation pour tracabilite (genere si absent) */
  correlationId?: string;
}

/**
 * Resultat d'un envoi WhatsApp reussi.
 */
export interface WhatsAppSendResult {
  messageId: string;
  status: 'sent';
}
```

**Notes importantes** :
- `data: Record<string, string>` (valeurs string seulement) limite deja les valeurs ; la barriere blacklist (2.7.2) verifie les NOMS de champs.
- `ar-MA` avec tiret (piege 10).
- `DEFAULT_LANGUAGE` centralise le fallback fr utilise par le service WhatsApp.

### 6.5 Fichier 5 sur 14 : `repo/packages/comm/src/types/email.types.ts`

```typescript
import type { WhatsAppLanguage } from './whatsapp.types';

/**
 * Types Email. Canal PRIMARY pour donnees sensibles (montants, CIN, IBAN OK).
 * Authenticite garantie par DKIM/SPF/DMARC (tache 2.7.4). Archivage local Maroc.
 */

/**
 * Piece jointe email (typiquement un PDF de facture/devis/recu).
 */
export interface EmailAttachment {
  /** Contenu encode base64 */
  contentBase64: string;
  /** Nom de fichier affiche, ex: facture-2026-00042.pdf */
  filename: string;
  /** MIME type, ex: application/pdf */
  mimeType: string;
}

/**
 * Entree d'envoi email. Contrairement a WhatsApp, `data` peut contenir
 * des donnees sensibles (amount, cin, iban) : l'email est le canal autorise.
 */
export interface SendEmailInput {
  /** Adresse destinataire (RFC 5322) */
  to: string;
  /** Nom d'expediteur affiche, ex: "Assurflow Sinistres" */
  fromName: string;
  /** Nom du template HTML (templates/email/...) */
  templateName: string;
  /** Donnees du template -- DONNEES SENSIBLES AUTORISEES ICI */
  data: Record<string, string | number | boolean>;
  /** Langue (4 langues partagees avec WhatsApp) */
  language: WhatsAppLanguage;
  /** Pieces jointes optionnelles */
  attachments?: EmailAttachment[];
  /** Tenant emetteur */
  tenantId: string;
  /** Utilisateur emetteur */
  userId: string;
  /** Correlation pour tracabilite */
  correlationId?: string;
}

/**
 * Message email rendu (apres compilation du template).
 */
export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

/**
 * Resultat d'envoi email.
 */
export interface EmailSendResult {
  messageId: string;
  provider: 'sendgrid' | 'mailjet';
}
```

**Notes importantes** :
- `data` autorise `string | number | boolean` (plus riche que WhatsApp) car l'email porte les montants.
- Le commentaire "DONNEES SENSIBLES AUTORISEES ICI" est intentionnel : il documente la frontiere de canal au point de definition du type.

### 6.6 Fichier 6 sur 14 : `repo/packages/comm/src/types/push.types.ts`

```typescript
import type { WhatsAppLanguage } from './whatsapp.types';

/**
 * Types Push notifications mobile. Milestones courts uniquement.
 * Visible sur ecran verrouille -> JAMAIS de donnee sensible (montant, CIN).
 * Validation longueur (title <= 50, body <= 100) + regex anti-sensible en 2.7.5.
 */

export const PushPriorityEnum = {
  NORMAL: 'normal',
  HIGH: 'high',
} as const;

export type PushPriority =
  typeof PushPriorityEnum[keyof typeof PushPriorityEnum];

/**
 * Lien profond (deep link) ouvrant un ecran de l'app mobile.
 */
export interface DeepLink {
  /** Schema d'ecran, ex: assurflow://sinistre/{id} */
  screen: string;
  /** Parametres du lien */
  params?: Record<string, string>;
}

/**
 * Entree d'envoi push. Contenu court non sensible.
 */
export interface SendPushInput {
  /** Token Expo du device, ex: ExponentPushToken[xxxxxxxx] */
  expoPushToken: string;
  /** Titre court (<= 50 chars) */
  title: string;
  /** Corps court (<= 100 chars), jamais de donnee sensible */
  body: string;
  /** Nom du template (audit) */
  templateName: string;
  /** Lien profond optionnel */
  deepLink?: string;
  /** Identifiant sinistre optionnel (data payload, pas affiche) */
  sinistreId?: string;
  /** Priorite (urgent = high) */
  priority?: PushPriority;
  /** Langue */
  language: WhatsAppLanguage;
  /** Tenant emetteur */
  tenantId: string;
  /** Utilisateur emetteur */
  userId: string;
  /** Correlation */
  correlationId?: string;
}

export interface PushSendResult {
  ticketId: string;
  status: 'sent';
}
```

### 6.7 Fichier 7 sur 14 : `repo/packages/comm/src/types/sms.types.ts`

```typescript
/**
 * Types SMS. Canal RESERVE OTP only (2FA authentication).
 * Aucune notification generale. Pas de methode sendSms() publique (2.7.6).
 */

export const OtpStatusEnum = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
} as const;

export type OtpStatus = typeof OtpStatusEnum[keyof typeof OtpStatusEnum];

/**
 * Entree d'envoi OTP. Seule operation SMS autorisee.
 */
export interface SendOtpInput {
  /** Numero E.164, ex: +212600000000 */
  phone: string;
  /** Code OTP exactement 6 chiffres */
  otp: string;
  /** Duree de validite -- doit etre 5 minutes (2.7.6 enforce) */
  ttlMinutes: number;
  /** Tenant emetteur */
  tenantId: string;
  /** Utilisateur emetteur */
  userId: string;
  /** Correlation */
  correlationId?: string;
}

export interface SmsOtp {
  sid: string;
  status: OtpStatus;
  provider: 'twilio' | 'orange-maroc';
}
```

### 6.8 Fichier 8 sur 14 : `repo/packages/comm/src/constants/template-categories.ts`

```typescript
import {
  WhatsAppTemplateCategoryEnum,
  type WhatsAppTemplateCategory,
} from '../types/whatsapp.types';

/**
 * Liste ordonnee des 6 categories de templates (ecosysteme 6 acteurs, decision-012).
 */
export const ALL_TEMPLATE_CATEGORIES: ReadonlyArray<WhatsAppTemplateCategory> = [
  WhatsAppTemplateCategoryEnum.REPAIR,
  WhatsAppTemplateCategoryEnum.INSURE,
  WhatsAppTemplateCategoryEnum.CUSTOMER,
  WhatsAppTemplateCategoryEnum.ASSURE,
  WhatsAppTemplateCategoryEnum.TOW,
  WhatsAppTemplateCategoryEnum.EXPERT,
];

/**
 * Nombre attendu de templates par categorie (verifie compile + test).
 * Total = 9 + 6 + 12 + 8 + 6 + 4 = 45.
 */
export const EXPECTED_TEMPLATES_PER_CATEGORY: Readonly<
  Record<WhatsAppTemplateCategory, number>
> = {
  repair: 9,
  insure: 6,
  customer: 12,
  assure: 8,
  tow: 6,
  expert: 4,
};

/**
 * Determine la categorie d'un nom de template a partir de son prefixe.
 * @throws Error si le prefixe ne correspond a aucune categorie connue
 */
export function categoryFromTemplateName(
  templateName: string,
): WhatsAppTemplateCategory {
  const prefix = templateName.split('_')[0];
  const match = ALL_TEMPLATE_CATEGORIES.find((c) => c === prefix);
  if (!match) {
    throw new Error(
      `Cannot derive category from template name '${templateName}' (prefix '${prefix}')`,
    );
  }
  return match;
}
```

### 6.9 Fichier 9 sur 14 : `repo/packages/comm/src/constants/status-only-templates.ts`

Whitelist legale. Le coeur de la correction Saad #7 cote autorisation. `as const` obligatoire (piege 1).

```typescript
import type { WhatsAppTemplateCategory } from '../types/whatsapp.types';

/**
 * WHITELIST des 45 templates autorises sur WhatsApp (correction Saad #7 CNDP).
 *
 * Un template non liste ici NE PEUT PAS etre envoye sur WhatsApp (rejet
 * BadRequestException en tache 2.7.2). Toute modification de cette liste est
 * une modification de conformite et doit passer par revue de code.
 *
 * Repartition : repair(9) + insure(6) + customer(12) + assure(8) + tow(6) + expert(4) = 45
 */
export const STATUS_ONLY_TEMPLATES = {
  // Garage repair statuses (9)
  repair: [
    'repair_vehicle_received',
    'repair_diagnostic_complete',
    'repair_devis_sent_expert',
    'repair_in_progress',
    'repair_qc_done',
    'repair_ready_for_delivery',
    'repair_completed',
    'repair_delayed',
    'repair_quality_check_failed',
  ],

  // Insurance carrier statuses (6)
  insure: [
    'insure_fnol_acknowledged',
    'insure_review_started',
    'insure_review_completed',
    'insure_devis_approved',
    'insure_payment_authorized',
    'insure_case_closed',
  ],

  // Customer (B2C) statuses (12) -- Sprint 17 reference
  customer: [
    'customer_otp_login',
    'customer_policy_subscribed',
    'customer_premium_due_j15',
    'customer_premium_due_j7',
    'customer_premium_due_j3',
    'customer_premium_overdue',
    'customer_fnol_received',
    'customer_fnol_carrier_reviewed',
    'customer_sinistre_progress_update',
    'customer_repair_ready_delivery',
    'customer_payment_received',
    'customer_feedback_request',
  ],

  // Assure (Sprint 18) statuses (8)
  assure: [
    'assure_fnol_received',
    'assure_tow_dispatched',
    'assure_tow_arriving_soon',
    'assure_repair_in_progress',
    'assure_repair_ready_delivery',
    'assure_milestone_update',
    'assure_emergency_acknowledged',
    'assure_policy_renewal_due',
  ],

  // Tow operator statuses (6)
  tow: [
    'tow_mission_assigned',
    'tow_pickup_confirmed',
    'tow_vehicle_loaded',
    'tow_in_transit',
    'tow_delivery_complete',
    'tow_payment_received',
  ],

  // Expert statuses (4)
  expert: [
    'expert_mission_assigned',
    'expert_inspection_complete',
    'expert_report_validated',
    'expert_payment_received',
  ],
} as const;

/**
 * Liste aplatie des 45 templates (compile-time = 45).
 */
export const ALL_STATUS_TEMPLATES: ReadonlyArray<string> =
  Object.values(STATUS_ONLY_TEMPLATES).flat();

/**
 * Type litteral de tous les noms de templates autorises.
 */
export type StatusOnlyTemplateName =
  (typeof STATUS_ONLY_TEMPLATES)[keyof typeof STATUS_ONLY_TEMPLATES][number];

/**
 * Verifie si un template est dans la whitelist (utilise par 2.7.2).
 */
export function isTemplateWhitelisted(templateName: string): boolean {
  return ALL_STATUS_TEMPLATES.includes(templateName);
}

/**
 * Retourne la liste de templates d'une categorie donnee.
 */
export function templatesForCategory(
  category: WhatsAppTemplateCategory,
): ReadonlyArray<string> {
  return STATUS_ONLY_TEMPLATES[category];
}
```

### 6.10 Fichier 10 sur 14 : `repo/packages/comm/src/constants/blacklisted-fields.ts`

Blacklist legale. Le coeur de la correction Saad #7 cote contenu. 15 patterns exactement.

```typescript
/**
 * BLACKLIST server-side (correction Saad terrain #7 -- CNDP loi 09-08).
 *
 * Ces patterns ne peuvent JAMAIS apparaitre comme nom de champ dans le `data`
 * d'un message WhatsApp. La detection est par sous-chaine insensible a la casse :
 * 'total' attrape 'total', 'total_mad', 'devis_total'.
 *
 * Enforcement : detectBlacklistedFields() (2.7.2) leve BadRequestException
 * AVANT tout appel a l'API Meta. Defense en profondeur avec la whitelist.
 *
 * Total = 8 money + 3 identity + 2 banking + 2 auth = 15 patterns.
 */
export const BLACKLISTED_FIELD_PATTERNS: ReadonlyArray<string> = [
  // Money / montants (8)
  'amount',
  'price',
  'total_mad',
  'total',
  'devis_total',
  'franchise',
  'honoraire',
  'reimbursement',

  // Identity / donnees identite (3)
  'cin',
  'passport',
  'national_id',

  // Banking / donnees bancaires (2)
  'iban',
  'cvv',

  // Auth / donnees authentification (2)
  'token',
  'password',
] as const;

/**
 * Vrai si le nom de champ contient un pattern blackliste.
 * Normalise (lowercase + trim) avant comparaison (piege 3).
 */
export function isBlacklistedField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().trim();
  return BLACKLISTED_FIELD_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

/**
 * Scanne recursivement un objet et retourne les chemins des champs blacklistes.
 * Deep scan (objets imbriques), pas de recursion dans les arrays.
 */
export function detectBlacklistedFields(
  data: Record<string, unknown>,
): string[] {
  const violations: string[] = [];

  const scan = (obj: Record<string, unknown>, path = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (isBlacklistedField(key)) {
        violations.push(fullPath);
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        scan(value as Record<string, unknown>, fullPath);
      }
    }
  };

  scan(data);
  return violations;
}
```

**Notes importantes** :
- `detectBlacklistedFields` est expose ici (et reutilise par 2.7.2) pour etre testable isolement.
- Detection par `includes()` (sur-protection assumee, trade-off 2.3).

### 6.11 Fichier 11 sur 14 : `repo/packages/comm/src/schemas/send-whatsapp.schema.ts`

```typescript
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../types/whatsapp.types';

/**
 * Regex E.164 : '+' suivi d'un chiffre 1-9 puis 6 a 14 chiffres.
 * Maroc : +212XXXXXXXXX (12 caracteres au total apres le +212).
 */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Schema de validation runtime d'un envoi de statut WhatsApp.
 * Note : `data` restreint a Record<string,string> (valeurs string).
 * La verification des NOMS de champs (blacklist) est faite en 2.7.2.
 */
export const SendWhatsAppStatusSchema = z.object({
  to: z
    .string()
    .regex(E164_REGEX, 'to must be E.164 format (e.g. +212600000000)'),
  templateName: z.string().min(1).max(100),
  data: z.record(z.string(), z.string()),
  language: z.enum(
    SUPPORTED_LANGUAGES as unknown as [string, ...string[]],
  ),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
});

export type SendWhatsAppStatusDto = z.infer<typeof SendWhatsAppStatusSchema>;
```

### 6.12 Fichier 12 sur 14 : `repo/packages/comm/src/schemas/send-email.schema.ts`

```typescript
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../types/whatsapp.types';

/**
 * Schema piece jointe email.
 */
export const EmailAttachmentSchema = z.object({
  contentBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
});

/**
 * Schema d'envoi email. `data` autorise string | number | boolean
 * (DONNEES SENSIBLES OK : montants, CIN, IBAN). Email est le canal autorise.
 */
export const SendEmailSchema = z.object({
  to: z.string().email('to must be a valid email address'),
  fromName: z.string().min(1).max(100),
  templateName: z.string().min(1).max(100),
  data: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
  language: z.enum(
    SUPPORTED_LANGUAGES as unknown as [string, ...string[]],
  ),
  attachments: z.array(EmailAttachmentSchema).max(10).optional(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
});

export type SendEmailDto = z.infer<typeof SendEmailSchema>;
```

### 6.13 Fichier 13 sur 14 : `repo/packages/comm/src/schemas/send-push.schema.ts` + `send-otp.schema.ts`

`send-push.schema.ts` :

```typescript
import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../types/whatsapp.types';

/**
 * Schema push. Contraintes de longueur (title <= 50, body <= 100)
 * appliquees ici ET cote service (2.7.5, defense en profondeur).
 */
export const SendPushSchema = z.object({
  expoPushToken: z
    .string()
    .regex(/^ExponentPushToken\[.+\]$/, 'invalid Expo push token format'),
  title: z.string().min(1).max(50, 'title must be <= 50 chars'),
  body: z.string().min(1).max(100, 'body must be <= 100 chars'),
  templateName: z.string().min(1).max(100),
  deepLink: z.string().max(255).optional(),
  sinistreId: z.string().uuid().optional(),
  priority: z.enum(['normal', 'high']).optional(),
  language: z.enum(SUPPORTED_LANGUAGES as unknown as [string, ...string[]]),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
});

export type SendPushDto = z.infer<typeof SendPushSchema>;
```

`send-otp.schema.ts` :

```typescript
import { z } from 'zod';

/**
 * Schema OTP. Exactement 6 chiffres, TTL exactement 5 minutes (2.7.6 enforce).
 */
export const SendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'phone must be E.164 format'),
  otp: z.string().regex(/^\d{6}$/, 'otp must be exactly 6 digits'),
  ttlMinutes: z.literal(5),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
});

export type SendOtpDto = z.infer<typeof SendOtpSchema>;
```

### 6.14 Fichier 14 sur 14 : `repo/packages/comm/src/index.ts`

Barrel d'export. Tous les symboles publics consommes par les apps. Aucun self-import (piege 6).

```typescript
// Types
export * from './types/whatsapp.types';
export * from './types/email.types';
export * from './types/push.types';
export * from './types/sms.types';

// Constants
export {
  STATUS_ONLY_TEMPLATES,
  ALL_STATUS_TEMPLATES,
  isTemplateWhitelisted,
  templatesForCategory,
  type StatusOnlyTemplateName,
} from './constants/status-only-templates';

export {
  BLACKLISTED_FIELD_PATTERNS,
  isBlacklistedField,
  detectBlacklistedFields,
} from './constants/blacklisted-fields';

export {
  ALL_TEMPLATE_CATEGORIES,
  EXPECTED_TEMPLATES_PER_CATEGORY,
  categoryFromTemplateName,
} from './constants/template-categories';

// Schemas Zod
export {
  SendWhatsAppStatusSchema,
  type SendWhatsAppStatusDto,
} from './schemas/send-whatsapp.schema';
export {
  SendEmailSchema,
  EmailAttachmentSchema,
  type SendEmailDto,
} from './schemas/send-email.schema';
export {
  SendPushSchema,
  type SendPushDto,
} from './schemas/send-push.schema';
export {
  SendOtpSchema,
  type SendOtpDto,
} from './schemas/send-otp.schema';
```

**Notes importantes** :
- Imports internes par chemins relatifs (`./constants/...`). L'alias `@insurtech/comm` n'est utilise QUE par les consommateurs externes (apps/api, autres packages).
- Re-export selectif des constantes (pas de `export *` sur les constants) pour controler la surface publique.

## 7. Tests complets

### 7.1 Tests constantes whitelist : `src/constants/status-only-templates.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  STATUS_ONLY_TEMPLATES,
  ALL_STATUS_TEMPLATES,
  isTemplateWhitelisted,
  templatesForCategory,
} from './status-only-templates';
import { EXPECTED_TEMPLATES_PER_CATEGORY } from './template-categories';

describe('STATUS_ONLY_TEMPLATES whitelist (correction Saad #7)', () => {
  it('contient exactement 45 templates au total', () => {
    expect(ALL_STATUS_TEMPLATES.length).toBe(45);
  });

  it('respecte la repartition par categorie (9/6/12/8/6/4)', () => {
    expect(STATUS_ONLY_TEMPLATES.repair.length).toBe(9);
    expect(STATUS_ONLY_TEMPLATES.insure.length).toBe(6);
    expect(STATUS_ONLY_TEMPLATES.customer.length).toBe(12);
    expect(STATUS_ONLY_TEMPLATES.assure.length).toBe(8);
    expect(STATUS_ONLY_TEMPLATES.tow.length).toBe(6);
    expect(STATUS_ONLY_TEMPLATES.expert.length).toBe(4);
  });

  it('aligne les longueurs avec EXPECTED_TEMPLATES_PER_CATEGORY', () => {
    for (const [cat, expected] of Object.entries(EXPECTED_TEMPLATES_PER_CATEGORY)) {
      expect(templatesForCategory(cat as never).length).toBe(expected);
    }
  });

  it('ne contient aucun nom de template duplique', () => {
    const unique = new Set(ALL_STATUS_TEMPLATES);
    expect(unique.size).toBe(ALL_STATUS_TEMPLATES.length);
  });

  it('isTemplateWhitelisted retourne true pour un template connu', () => {
    expect(isTemplateWhitelisted('customer_otp_login')).toBe(true);
    expect(isTemplateWhitelisted('repair_completed')).toBe(true);
  });

  it('isTemplateWhitelisted retourne false pour un template inconnu', () => {
    expect(isTemplateWhitelisted('malicious_template_xyz')).toBe(false);
    expect(isTemplateWhitelisted('')).toBe(false);
  });

  it('chaque nom de template prefixe par sa categorie', () => {
    for (const t of STATUS_ONLY_TEMPLATES.repair) expect(t.startsWith('repair_')).toBe(true);
    for (const t of STATUS_ONLY_TEMPLATES.expert) expect(t.startsWith('expert_')).toBe(true);
  });
});
```

### 7.2 Tests constantes blacklist : `src/constants/blacklisted-fields.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  BLACKLISTED_FIELD_PATTERNS,
  isBlacklistedField,
  detectBlacklistedFields,
} from './blacklisted-fields';

describe('BLACKLISTED_FIELD_PATTERNS (CNDP loi 09-08)', () => {
  it('contient au moins 15 patterns', () => {
    expect(BLACKLISTED_FIELD_PATTERNS.length).toBeGreaterThanOrEqual(15);
  });

  it('contient les patterns money critiques', () => {
    for (const p of ['amount', 'total', 'devis_total', 'franchise', 'honoraire']) {
      expect(BLACKLISTED_FIELD_PATTERNS).toContain(p);
    }
  });

  it('contient les patterns identite et bancaires', () => {
    for (const p of ['cin', 'passport', 'national_id', 'iban', 'cvv']) {
      expect(BLACKLISTED_FIELD_PATTERNS).toContain(p);
    }
  });

  it('contient les patterns auth', () => {
    expect(BLACKLISTED_FIELD_PATTERNS).toContain('token');
    expect(BLACKLISTED_FIELD_PATTERNS).toContain('password');
  });
});

describe('isBlacklistedField', () => {
  it('detecte amount, cin, iban', () => {
    expect(isBlacklistedField('amount')).toBe(true);
    expect(isBlacklistedField('cin')).toBe(true);
    expect(isBlacklistedField('iban')).toBe(true);
  });

  it('detecte par sous-chaine (total_mad, devis_total)', () => {
    expect(isBlacklistedField('total_mad')).toBe(true);
    expect(isBlacklistedField('devis_total')).toBe(true);
  });

  it('est insensible a la casse et aux espaces', () => {
    expect(isBlacklistedField(' Amount ')).toBe(true);
    expect(isBlacklistedField('CIN')).toBe(true);
    expect(isBlacklistedField('  IBAN')).toBe(true);
  });

  it('laisse passer les champs safe', () => {
    expect(isBlacklistedField('customer_first_name')).toBe(false);
    expect(isBlacklistedField('sinistre_id_short')).toBe(false);
    expect(isBlacklistedField('declaration_date')).toBe(false);
  });
});

describe('detectBlacklistedFields deep scan', () => {
  it('retourne vide pour un objet safe', () => {
    expect(detectBlacklistedFields({ first_name: 'Ali', date: '2026-05-25' })).toEqual([]);
  });

  it('detecte un champ blackliste au premier niveau', () => {
    expect(detectBlacklistedFields({ amount: '5000' })).toEqual(['amount']);
  });

  it('detecte un champ blackliste imbrique (path complet)', () => {
    const result = detectBlacklistedFields({ payment: { amount: '5000', date: 'x' } });
    expect(result).toContain('payment.amount');
  });

  it('detecte plusieurs violations', () => {
    const result = detectBlacklistedFields({ cin: 'AB12', iban: 'MA64', safe: 'ok' });
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['cin', 'iban']));
  });

  it('ne recurse pas dans les arrays', () => {
    expect(detectBlacklistedFields({ items: ['amount', 'cin'] })).toEqual([]);
  });
});
```

### 7.3 Tests schema Zod : `src/schemas/send-whatsapp.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SendWhatsAppStatusSchema } from './send-whatsapp.schema';

const VALID = {
  to: '+212600000000',
  templateName: 'customer_fnol_received',
  data: { customer_first_name: 'Ali' },
  language: 'fr',
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
};

describe('SendWhatsAppStatusSchema', () => {
  it('accepte un payload valide', () => {
    expect(SendWhatsAppStatusSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejette un numero non E.164', () => {
    const r = SendWhatsAppStatusSchema.safeParse({ ...VALID, to: '0600000000' });
    expect(r.success).toBe(false);
  });

  it('rejette une langue non supportee', () => {
    const r = SendWhatsAppStatusSchema.safeParse({ ...VALID, language: 'es' });
    expect(r.success).toBe(false);
  });

  it('accepte les 4 langues supportees', () => {
    for (const language of ['fr', 'ar', 'ar-MA', 'en']) {
      expect(SendWhatsAppStatusSchema.safeParse({ ...VALID, language }).success).toBe(true);
    }
  });

  it('rejette data avec valeur non-string', () => {
    const r = SendWhatsAppStatusSchema.safeParse({ ...VALID, data: { x: 5 } });
    expect(r.success).toBe(false);
  });

  it('rejette tenantId non-uuid', () => {
    const r = SendWhatsAppStatusSchema.safeParse({ ...VALID, tenantId: 'abc' });
    expect(r.success).toBe(false);
  });

  it('accepte correlationId optionnel valide', () => {
    const r = SendWhatsAppStatusSchema.safeParse({
      ...VALID,
      correlationId: '33333333-3333-3333-3333-333333333333',
    });
    expect(r.success).toBe(true);
  });
});
```

### 7.4 Tests bootstrap exports : `src/index.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import * as comm from './index';

describe('@insurtech/comm barrel exports', () => {
  it('exporte ALL_STATUS_TEMPLATES (45)', () => {
    expect(comm.ALL_STATUS_TEMPLATES).toBeDefined();
    expect(comm.ALL_STATUS_TEMPLATES.length).toBe(45);
  });

  it('exporte BLACKLISTED_FIELD_PATTERNS (>=15)', () => {
    expect(comm.BLACKLISTED_FIELD_PATTERNS.length).toBeGreaterThanOrEqual(15);
  });

  it('exporte les helpers de conformite', () => {
    expect(typeof comm.isTemplateWhitelisted).toBe('function');
    expect(typeof comm.isBlacklistedField).toBe('function');
    expect(typeof comm.detectBlacklistedFields).toBe('function');
  });

  it('exporte les 4 schemas Zod', () => {
    expect(comm.SendWhatsAppStatusSchema).toBeDefined();
    expect(comm.SendEmailSchema).toBeDefined();
    expect(comm.SendPushSchema).toBeDefined();
    expect(comm.SendOtpSchema).toBeDefined();
  });

  it('exporte les enums de langues et categories', () => {
    expect(comm.SUPPORTED_LANGUAGES.length).toBe(4);
    expect(comm.ALL_TEMPLATE_CATEGORIES.length).toBe(6);
  });
});
```

### 7.5 Tests schema Email : `src/schemas/send-email.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SendEmailSchema, EmailAttachmentSchema } from './send-email.schema';

const VALID_EMAIL = {
  to: 'assure@example.ma',
  fromName: 'Assurflow Sinistres',
  templateName: 'customer_premium_invoice',
  data: { customer_first_name: 'Ali', amount: 5000, paid: false },
  language: 'fr',
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
};

describe('SendEmailSchema (data sensible OK)', () => {
  it('accepte un payload valide avec montant numerique', () => {
    expect(SendEmailSchema.safeParse(VALID_EMAIL).success).toBe(true);
  });

  it('accepte data sensible (amount, cin, iban) -- email autorise', () => {
    const r = SendEmailSchema.safeParse({
      ...VALID_EMAIL,
      data: { amount: 12500, cin: 'AB123456', iban: 'MA64011519000001234567890' },
    });
    expect(r.success).toBe(true);
  });

  it('rejette un email destinataire invalide', () => {
    const r = SendEmailSchema.safeParse({ ...VALID_EMAIL, to: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('accepte data booleen et string et number melanges', () => {
    const r = SendEmailSchema.safeParse({
      ...VALID_EMAIL,
      data: { s: 'x', n: 1, b: true },
    });
    expect(r.success).toBe(true);
  });

  it('rejette plus de 10 pieces jointes', () => {
    const att = {
      contentBase64: 'AAAA',
      filename: 'f.pdf',
      mimeType: 'application/pdf',
    };
    const r = SendEmailSchema.safeParse({
      ...VALID_EMAIL,
      attachments: Array.from({ length: 11 }, () => att),
    });
    expect(r.success).toBe(false);
  });

  it('valide une piece jointe PDF correcte', () => {
    const r = EmailAttachmentSchema.safeParse({
      contentBase64: 'JVBERi0xLjQ=',
      filename: 'facture-2026-00042.pdf',
      mimeType: 'application/pdf',
    });
    expect(r.success).toBe(true);
  });
});
```

### 7.6 Tests schemas Push + OTP : `src/schemas/send-push.schema.spec.ts` et `send-otp.schema.spec.ts`

`send-push.schema.spec.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { SendPushSchema } from './send-push.schema';

const VALID_PUSH = {
  expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'Sinistre mis a jour',
  body: 'Consultez votre application pour les details',
  templateName: 'assure_milestone_update',
  language: 'fr',
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
};

describe('SendPushSchema', () => {
  it('accepte un payload valide', () => {
    expect(SendPushSchema.safeParse(VALID_PUSH).success).toBe(true);
  });

  it('rejette un title > 50 chars', () => {
    const r = SendPushSchema.safeParse({ ...VALID_PUSH, title: 'x'.repeat(51) });
    expect(r.success).toBe(false);
  });

  it('rejette un body > 100 chars', () => {
    const r = SendPushSchema.safeParse({ ...VALID_PUSH, body: 'x'.repeat(101) });
    expect(r.success).toBe(false);
  });

  it('rejette un token Expo mal forme', () => {
    const r = SendPushSchema.safeParse({ ...VALID_PUSH, expoPushToken: 'abc' });
    expect(r.success).toBe(false);
  });

  it('accepte priority high', () => {
    expect(SendPushSchema.safeParse({ ...VALID_PUSH, priority: 'high' }).success).toBe(true);
  });
});
```

`send-otp.schema.spec.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { SendOtpSchema } from './send-otp.schema';

const VALID_OTP = {
  phone: '+212600000000',
  otp: '123456',
  ttlMinutes: 5,
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
};

describe('SendOtpSchema', () => {
  it('accepte un OTP 6 digits + ttl 5', () => {
    expect(SendOtpSchema.safeParse(VALID_OTP).success).toBe(true);
  });

  it('rejette un OTP non 6 digits', () => {
    expect(SendOtpSchema.safeParse({ ...VALID_OTP, otp: '12345' }).success).toBe(false);
    expect(SendOtpSchema.safeParse({ ...VALID_OTP, otp: 'abcdef' }).success).toBe(false);
  });

  it('rejette un ttl different de 5', () => {
    expect(SendOtpSchema.safeParse({ ...VALID_OTP, ttlMinutes: 10 }).success).toBe(false);
  });

  it('rejette un phone non E.164', () => {
    expect(SendOtpSchema.safeParse({ ...VALID_OTP, phone: '0600000000' }).success).toBe(false);
  });
});
```

### 7.7 Fixtures partagees : `src/test/fixtures/comm-fixtures.ts`

```typescript
import type { WhatsAppStatusMessage } from '../../types/whatsapp.types';
import type { SendEmailInput } from '../../types/email.types';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

/** Statut WhatsApp safe (aucune donnee sensible). */
export function makeWhatsAppStatus(
  overrides: Partial<WhatsAppStatusMessage> = {},
): WhatsAppStatusMessage {
  return {
    to: '+212600000000',
    templateName: 'customer_fnol_received',
    data: { customer_first_name: 'Ali', sinistre_id_short: 'SIN-0042' },
    language: 'fr',
    tenantId: TENANT,
    userId: USER,
    ...overrides,
  };
}

/** Statut WhatsApp VOLONTAIREMENT non conforme (pour tester les rejets). */
export function makeWhatsAppStatusWithBlacklist(
  field: string,
): WhatsAppStatusMessage {
  return makeWhatsAppStatus({ data: { [field]: 'value' } });
}

/** Email avec donnees sensibles (autorise). */
export function makeEmailInput(
  overrides: Partial<SendEmailInput> = {},
): SendEmailInput {
  return {
    to: 'assure@example.ma',
    fromName: 'Assurflow',
    templateName: 'customer_premium_invoice',
    data: { amount: 12500, iban: 'MA64011519000001234567890' },
    language: 'fr',
    tenantId: TENANT,
    userId: USER,
    ...overrides,
  };
}
```

### 6.15 Fichier 15 sur 17 : `repo/packages/comm/src/types/notification.types.ts`

Types transverses consommes par le Notification Router (2.7.7) et l'audit ACAPS (2.7.8). Definis ici pour que le contrat soit stable des 2.7.1.

```typescript
import type { WhatsAppLanguage } from './whatsapp.types';

/**
 * Canaux de communication (4 canaux scope strict).
 */
export const NotificationChannelEnum = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
} as const;

export type NotificationChannel =
  typeof NotificationChannelEnum[keyof typeof NotificationChannelEnum];

/**
 * Type de contenu -- determine le routage canal (correction Saad #7).
 * - status_only   : WhatsApp + Push (jamais data sensible)
 * - data_sensible : Email ONLY (montants/CIN/IBAN)
 * - urgent        : multi-canal (Push + SMS + Email)
 */
export const ContentTypeEnum = {
  STATUS_ONLY: 'status_only',
  DATA_SENSIBLE: 'data_sensible',
  URGENT: 'urgent',
} as const;

export type ContentType =
  typeof ContentTypeEnum[keyof typeof ContentTypeEnum];

/**
 * Statut d'une notification dans l'audit ACAPS.
 */
export const NotificationStatusEnum = {
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export type NotificationStatus =
  typeof NotificationStatusEnum[keyof typeof NotificationStatusEnum];

/**
 * Entree de log audit ACAPS (consommee par les 4 services + le router).
 * recipientHash : HMAC-SHA256 16 chars (jamais phone/email en clair).
 */
export interface LogNotificationInput {
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  templateName: string;
  language: WhatsAppLanguage;
  recipientHash: string;
  messageId: string | null;
  correlationId: string;
  durationMs: number;
  status: NotificationStatus;
  failureReason?: string;
}

/**
 * Preferences de notification d'un utilisateur (lues par le router 2.7.7).
 */
export interface UserNotificationPreferences {
  userId: string;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  language: WhatsAppLanguage;
  expoPushToken?: string;
}
```

**Notes importantes** :
- `LogNotificationInput` est le contrat exact appele par `WhatsAppService.auditFailed` (2.7.2), `EmailService` (2.7.4) et le router (2.7.7). En le definissant ici, on evite tout decalage de signature entre services.
- `ContentType` est le pivot du routage : c'est la donnee d'entree qui decide si WhatsApp est autorise (status_only) ou interdit (data_sensible).

### 6.16 Fichier 16 sur 17 : `repo/packages/comm/src/constants/channel-policy.ts`

Politique de canal par `ContentType`, source de verite du routage (consommee par 2.7.7). Materialise la correction Saad #7 au niveau des constantes.

```typescript
import {
  ContentTypeEnum,
  NotificationChannelEnum,
  type ContentType,
  type NotificationChannel,
} from '../types/notification.types';

/**
 * Canaux AUTORISES par type de contenu (correction Saad #7).
 *
 * REGLE ABSOLUE : 'data_sensible' n'inclut JAMAIS 'whatsapp' ni 'push'
 * (donnees sensibles uniquement par email). 'status_only' n'inclut JAMAIS
 * de donnee sensible (enforcement runtime par blacklist en 2.7.2).
 */
export const CHANNEL_POLICY: Readonly<
  Record<ContentType, ReadonlyArray<NotificationChannel>>
> = {
  [ContentTypeEnum.STATUS_ONLY]: [
    NotificationChannelEnum.WHATSAPP,
    NotificationChannelEnum.PUSH,
  ],
  [ContentTypeEnum.DATA_SENSIBLE]: [NotificationChannelEnum.EMAIL],
  [ContentTypeEnum.URGENT]: [
    NotificationChannelEnum.PUSH,
    NotificationChannelEnum.SMS,
    NotificationChannelEnum.EMAIL,
  ],
};

/**
 * Verifie qu'un canal est autorise pour un type de contenu.
 */
export function isChannelAllowedFor(
  contentType: ContentType,
  channel: NotificationChannel,
): boolean {
  return CHANNEL_POLICY[contentType].includes(channel);
}

/**
 * Garde-fou de conformite : WhatsApp ne doit JAMAIS apparaitre pour data_sensible.
 * Utilise par un test invariant (2.7.1) et par le router (2.7.7).
 */
export function assertNoWhatsAppForSensitive(): void {
  if (
    CHANNEL_POLICY[ContentTypeEnum.DATA_SENSIBLE].includes(
      NotificationChannelEnum.WHATSAPP,
    )
  ) {
    throw new Error(
      'CONFORMITE VIOLATION: data_sensible ne doit jamais inclure whatsapp (correction Saad #7)',
    );
  }
}
```

### 6.17 Fichier 17 sur 17 : `repo/packages/comm/src/index.ts` (ajout des types transverses)

```typescript
// ... exports de 6.14 ...

// Types transverses notification (consommes par router + audit)
export {
  NotificationChannelEnum,
  ContentTypeEnum,
  NotificationStatusEnum,
  type NotificationChannel,
  type ContentType,
  type NotificationStatus,
  type LogNotificationInput,
  type UserNotificationPreferences,
} from './types/notification.types';

export {
  CHANNEL_POLICY,
  isChannelAllowedFor,
  assertNoWhatsAppForSensitive,
} from './constants/channel-policy';
```

### 6.18 Catalogue de reference des 45 templates whitelist (variables sures)

Ce catalogue documente chaque template autorise, sa finalite et ses variables SURES (aucune variable money/cin/token). Il sert de reference unique pour les sprints downstream (17, 18, 21, 22.5, 22.7) qui consommeront ces templates. Toutes les variables listees sont non sensibles par construction.

| Template | Categorie | Finalite | Variables sures |
|----------|-----------|----------|-----------------|
| repair_vehicle_received | repair | Vehicule recu au garage | customer_first_name, vehicle_plate, garage_name |
| repair_diagnostic_complete | repair | Diagnostic termine | customer_first_name, vehicle_plate, diagnostic_date |
| repair_devis_sent_expert | repair | Devis transmis a l'expert | customer_first_name, sinistre_id_short, expert_name |
| repair_in_progress | repair | Reparation en cours | customer_first_name, vehicle_plate, eta_date |
| repair_qc_done | repair | Controle qualite effectue | customer_first_name, vehicle_plate |
| repair_ready_for_delivery | repair | Vehicule pret a recuperer | customer_first_name, vehicle_plate, garage_name, garage_hours |
| repair_completed | repair | Reparation cloturee | customer_first_name, vehicle_plate |
| repair_delayed | repair | Retard signale | customer_first_name, vehicle_plate, new_eta_date, reason_label |
| repair_quality_check_failed | repair | Controle qualite a refaire | customer_first_name, vehicle_plate |
| insure_fnol_acknowledged | insure | Sinistre accuse reception | customer_first_name, sinistre_id_short |
| insure_review_started | insure | Examen demarre | customer_first_name, sinistre_id_short |
| insure_review_completed | insure | Examen termine | customer_first_name, sinistre_id_short |
| insure_devis_approved | insure | Devis approuve (statut, pas montant) | customer_first_name, sinistre_id_short |
| insure_payment_authorized | insure | Paiement autorise (statut) | customer_first_name, sinistre_id_short |
| insure_case_closed | insure | Dossier clos | customer_first_name, sinistre_id_short |
| customer_otp_login | customer | OTP de connexion (statut, pas le code) | customer_first_name |
| customer_policy_subscribed | customer | Police souscrite | customer_first_name, policy_id_short |
| customer_premium_due_j15 | customer | Echeance prime J-15 (statut, pas montant) | customer_first_name, due_date |
| customer_premium_due_j7 | customer | Echeance prime J-7 | customer_first_name, due_date |
| customer_premium_due_j3 | customer | Echeance prime J-3 | customer_first_name, due_date |
| customer_premium_overdue | customer | Prime en retard (statut) | customer_first_name, due_date |
| customer_fnol_received | customer | Declaration recue | customer_first_name, declaration_date, sinistre_id_short, sinistre_type_label |
| customer_fnol_carrier_reviewed | customer | Sinistre examine carrier | customer_first_name, sinistre_id_short |
| customer_sinistre_progress_update | customer | Avancement sinistre | customer_first_name, sinistre_id_short, milestone_label |
| customer_repair_ready_delivery | customer | Reparation prete | customer_first_name, vehicle_plate, garage_name |
| customer_payment_received | customer | Paiement recu (statut, pas montant) | customer_first_name, reference_short |
| customer_feedback_request | customer | Demande d'avis | customer_first_name |
| assure_fnol_received | assure | Declaration recue (assure) | assure_first_name, sinistre_id_short |
| assure_tow_dispatched | assure | Depanneuse envoyee | assure_first_name, tow_eta_minutes |
| assure_tow_arriving_soon | assure | Depanneuse proche | assure_first_name, tow_eta_minutes |
| assure_repair_in_progress | assure | Reparation en cours | assure_first_name, vehicle_plate |
| assure_repair_ready_delivery | assure | Reparation prete | assure_first_name, vehicle_plate, garage_name |
| assure_milestone_update | assure | Mise a jour jalon | assure_first_name, milestone_label |
| assure_emergency_acknowledged | assure | Urgence prise en compte | assure_first_name, sinistre_id_short |
| assure_policy_renewal_due | assure | Renouvellement (statut) | assure_first_name, renewal_date |
| tow_mission_assigned | tow | Mission assignee | tow_operator_name, mission_id_short, pickup_location_label |
| tow_pickup_confirmed | tow | Prise en charge confirmee | tow_operator_name, mission_id_short |
| tow_vehicle_loaded | tow | Vehicule charge | tow_operator_name, vehicle_plate, mission_id_short |
| tow_in_transit | tow | En transit | customer_first_name, vehicle_plate, destination_name, mission_id_short |
| tow_delivery_complete | tow | Livraison effectuee | tow_operator_name, destination_name, mission_id_short |
| tow_payment_received | tow | Paiement recu (statut) | tow_operator_name, mission_id_short |
| expert_mission_assigned | expert | Mission d'expertise assignee | expert_name, mission_id_short, location_label |
| expert_inspection_complete | expert | Inspection terminee | expert_name, mission_id_short |
| expert_report_validated | expert | Rapport valide | expert_name, mission_id_short |
| expert_payment_received | expert | Honoraires recus (statut, pas montant) | expert_name, mission_id_short |

Total : 9 + 6 + 12 + 8 + 6 + 4 = 45. Aucune ligne ne reference de variable money/cin/token/iban : la separation de canal est respectee des la conception des templates.

### 6.19 Test invariant de conformite du routage : `src/constants/channel-policy.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  CHANNEL_POLICY,
  isChannelAllowedFor,
  assertNoWhatsAppForSensitive,
} from './channel-policy';

describe('CHANNEL_POLICY (correction Saad #7 -- invariant)', () => {
  it('data_sensible n autorise QUE email (jamais whatsapp/push)', () => {
    expect(CHANNEL_POLICY.data_sensible).toEqual(['email']);
    expect(CHANNEL_POLICY.data_sensible).not.toContain('whatsapp');
    expect(CHANNEL_POLICY.data_sensible).not.toContain('push');
  });

  it('status_only autorise whatsapp + push', () => {
    expect(CHANNEL_POLICY.status_only).toEqual(expect.arrayContaining(['whatsapp', 'push']));
  });

  it('urgent autorise push + sms + email', () => {
    expect(CHANNEL_POLICY.urgent).toEqual(expect.arrayContaining(['push', 'sms', 'email']));
  });

  it('isChannelAllowedFor refuse whatsapp pour data_sensible', () => {
    expect(isChannelAllowedFor('data_sensible', 'whatsapp')).toBe(false);
    expect(isChannelAllowedFor('status_only', 'whatsapp')).toBe(true);
  });

  it('assertNoWhatsAppForSensitive ne leve pas (config conforme)', () => {
    expect(() => assertNoWhatsAppForSensitive()).not.toThrow();
  });
});
```

### 7.8 Tests categories : `src/constants/template-categories.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  ALL_TEMPLATE_CATEGORIES,
  EXPECTED_TEMPLATES_PER_CATEGORY,
  categoryFromTemplateName,
} from './template-categories';

describe('template-categories', () => {
  it('expose exactement 6 categories', () => {
    expect(ALL_TEMPLATE_CATEGORIES).toHaveLength(6);
    expect(ALL_TEMPLATE_CATEGORIES).toEqual([
      'repair', 'insure', 'customer', 'assure', 'tow', 'expert',
    ]);
  });

  it('la somme des comptes attendus vaut 45', () => {
    const sum = Object.values(EXPECTED_TEMPLATES_PER_CATEGORY).reduce((a, b) => a + b, 0);
    expect(sum).toBe(45);
  });

  it('derive la categorie depuis le prefixe du nom', () => {
    expect(categoryFromTemplateName('repair_completed')).toBe('repair');
    expect(categoryFromTemplateName('customer_otp_login')).toBe('customer');
    expect(categoryFromTemplateName('expert_payment_received')).toBe('expert');
  });

  it('leve une erreur pour un prefixe inconnu', () => {
    expect(() => categoryFromTemplateName('unknown_template')).toThrow(
      "Cannot derive category",
    );
  });

  it('chaque categorie a un compte attendu strictement positif', () => {
    for (const c of ALL_TEMPLATE_CATEGORIES) {
      expect(EXPECTED_TEMPLATES_PER_CATEGORY[c]).toBeGreaterThan(0);
    }
  });
});
```

### 7.9 Tests langues : `src/types/whatsapp.types.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  WhatsAppLanguageEnum,
  WhatsAppTemplateCategoryEnum,
} from './whatsapp.types';

describe('whatsapp.types langues + categories', () => {
  it('expose exactement 4 langues', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(4);
    expect(SUPPORTED_LANGUAGES).toEqual(['fr', 'ar', 'ar-MA', 'en']);
  });

  it('darija utilise le tiret ar-MA (BCP 47), pas underscore', () => {
    expect(WhatsAppLanguageEnum.AR_MA).toBe('ar-MA');
    expect(SUPPORTED_LANGUAGES).not.toContain('ar_MA');
  });

  it('la langue par defaut est fr (fallback)', () => {
    expect(DEFAULT_LANGUAGE).toBe('fr');
    expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it('expose 6 categories enum', () => {
    expect(Object.keys(WhatsAppTemplateCategoryEnum)).toHaveLength(6);
  });
});
```

## 8. Variables environnement

### 8.1 Tableau de tracabilite des criteres de validation

Ce tableau mappe chaque metrique de validation du B-09 (section "Metriques de Validation") aux criteres de cette tache, pour garantir la tracabilite Phase A -> Phase B.

| Metrique B-09 | Critere(s) tache 2.7.1 | Verification |
|---------------|------------------------|--------------|
| Whitelist enforcement | V2, V6, V16, V17 | `ALL_STATUS_TEMPLATES.length === 45`, helper `isTemplateWhitelisted` |
| Blacklist enforcement | V3, V4, V5 | `BLACKLISTED_FIELD_PATTERNS.length === 15`, `detectBlacklistedFields` deep scan |
| Coverage Sprint 9 >= 90% | V19 | `vitest run --coverage` |
| 0 emoji | V15 | grep CI pre-commit |
| Conventional commits | section 15 | format `feat(sprint-09): ...` |
| Separation de canal (Saad #7) | V (channel-policy 6.19) | `CHANNEL_POLICY.data_sensible === ['email']` |

### 8.2 Variables d'environnement

Cette tache n'introduit pas de variable d'environnement requise au runtime (pas d'I/O reseau). Les variables suivantes sont declarees ici pour reference et seront consommees par les taches 2.7.2 a 2.7.6. Elles doivent etre ajoutees a `repo/.env.example` au format ci-dessous (valeurs exemples, jamais de vraie cle commitee).

```env
# WhatsApp Meta Cloud API (tache 2.7.2) -- exemples
WHATSAPP_META_PHONE_NUMBER_ID=109876543210987
WHATSAPP_META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxx_example_long_lived
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=verify_token_example_change_me
WHATSAPP_META_APP_SECRET=app_secret_example_change_me

# Phone hash secret (tache 2.7.2/2.7.8) -- SHA256 HMAC salt
PHONE_HASH_SECRET=replace_with_32_bytes_random_hex

# Rate limiting (tache 2.7.2)
COMM_RATE_LIMIT_WA_PER_HOUR=10
COMM_RATE_LIMIT_EMAIL_PER_HOUR=100

# Email (tache 2.7.4)
EMAIL_DOMAIN_PRIMARY=assurflow.ma
EMAIL_DKIM_SELECTOR=assurflow
```

## 9. Commandes shell

```bash
cd repo

# 1. Installation des dependances workspace
pnpm install --frozen-lockfile

# 2. Build du package
pnpm --filter @insurtech/comm build

# 3. Typecheck strict
pnpm --filter @insurtech/comm typecheck

# 4. Tests + coverage
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage

# 5. Verification runtime des comptes whitelist/blacklist
node -e "import('./packages/comm/dist/index.js').then(c => console.log('Templates:', c.ALL_STATUS_TEMPLATES.length, '| Blacklist:', c.BLACKLISTED_FIELD_PATTERNS.length))"
# Attendu: Templates: 45 | Blacklist: 15

# 6. Verification nom du package (alias workspace)
grep '"name": "@insurtech/comm"' packages/comm/package.json && echo OK
```

## 10. Criteres validation V1-V24

### Criteres P0 (bloquants -- 15)

- **V1 (P0 -- automatisable)** : `pnpm --filter @insurtech/comm build` reussit. Commande : voir 9.2. Expected : exit 0, repertoire `dist/` cree. Failure mode : erreur strict -> verifier `extends` tsconfig.
- **V2 (P0 -- automatisable)** : `ALL_STATUS_TEMPLATES.length === 45`. Commande : voir 9.5. Expected : `Templates: 45`. Failure mode : recompter par categorie (9/6/12/8/6/4).
- **V3 (P0 -- automatisable)** : `BLACKLISTED_FIELD_PATTERNS.length === 15`. Expected : `Blacklist: 15`. Failure mode : verifier 8+3+2+2.
- **V4 (P0)** : helper `isBlacklistedField` exporte et fonctionnel. Test : `blacklisted-fields.spec.ts` PASS.
- **V5 (P0)** : helper `detectBlacklistedFields` deep scan exporte. Test : detecte `payment.amount`.
- **V6 (P0)** : helper `isTemplateWhitelisted` exporte. Test : true pour `customer_otp_login`, false pour inconnu.
- **V7 (P0 -- automatisable)** : `pnpm --filter @insurtech/comm typecheck` 0 erreur. Failure mode : `any` implicite -> ajouter type explicite.
- **V8 (P0)** : 4 schemas Zod exportes (`SendWhatsAppStatusSchema`, `SendEmailSchema`, `SendPushSchema`, `SendOtpSchema`). Test : `index.spec.ts`.
- **V9 (P0)** : schema WhatsApp rejette numero non E.164. Test : `0600000000` -> success false.
- **V10 (P0)** : schema WhatsApp `data` rejette valeurs non-string. Test : `{ x: 5 }` -> success false.
- **V11 (P0)** : schema Email `data` accepte string|number|boolean (data sensible OK). Test : `{ amount: 5000 }` -> success true.
- **V12 (P0)** : schema OTP impose `ttlMinutes` litteral 5 + otp 6 digits. Test : `ttlMinutes: 10` -> false.
- **V13 (P0 -- automatisable)** : tous les `package.json` workspace ont `name: @insurtech/...`. Commande : `grep '"name": "@insurtech/comm"' packages/comm/package.json`.
- **V14 (P0)** : `index.ts` n'a aucun self-import `@insurtech/comm`. Commande : `! grep -rn "@insurtech/comm" packages/comm/src/`.
- **V15 (P0 -- automatisable)** : aucune emoji. Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/comm/src/ ; test $? -ne 0`.

### Criteres P1 (importants -- 6)

- **V16 (P1)** : `as const` present sur `STATUS_ONLY_TEMPLATES` (type litteral preserve). Test : `StatusOnlyTemplateName` est une union, pas `string`.
- **V17 (P1)** : aucun template duplique dans la whitelist. Test : `new Set(ALL_STATUS_TEMPLATES).size === 45`.
- **V18 (P1)** : `SUPPORTED_LANGUAGES.length === 4` et contient `ar-MA` (tiret). Test : `index.spec.ts`.
- **V19 (P1)** : coverage >= 90% sur les fichiers a logique (constants + schemas). Commande : `test:coverage`.
- **V20 (P1)** : `EXPECTED_TEMPLATES_PER_CATEGORY` aligne avec longueurs reelles. Test : 7.1.
- **V21 (P1)** : `categoryFromTemplateName('repair_completed') === 'repair'`. Test unitaire.

### Criteres P2 (nice-to-have -- 3)

- **V22 (P2)** : `vitest.config.ts` exclut types-only et index du coverage. Verification : config.
- **V23 (P2)** : commentaires JSDoc presents sur chaque export public. Verification : revue.
- **V24 (P2)** : `package.json` description mentionne CNDP loi 09-08. Verification : grep.

## 11. Edge cases + troubleshooting

### Edge case 1 : objet `data` vide
**Scenario** : un statut sans variable (`data: {}`). **Probleme** : `detectBlacklistedFields({})` doit retourner `[]` sans erreur. **Solution** : la boucle `Object.entries({})` est vide, retour `[]`. Tester explicitement.

### Edge case 2 : champ nomme exactement comme un faux positif
**Scenario** : un champ legitime `total_steps`. **Probleme** : `includes('total')` le bloque (faux positif). **Solution** : trade-off assume (2.3) ; renommer en `steps_count` ou passer par email. Documenter dans la policy.

### Edge case 3 : valeur null dans data imbrique
**Scenario** : `{ payment: null }`. **Probleme** : recursion sur null crasherait. **Solution** : la garde `value !== null` empeche la recursion. Tester.

### Edge case 4 : numero E.164 a la limite (15 chiffres)
**Scenario** : `+212600000000` (12 apres +) vs un numero a 15 chiffres. **Probleme** : la regex doit accepter 7 a 15 chiffres. **Solution** : `\d{6,14}` apres le premier chiffre = 7 a 15 chiffres total. Tester un numero court invalide et un valide.

### Edge case 5 : darija envoyee comme `ar_MA`
**Scenario** : un consommateur envoie `language: 'ar_MA'` (underscore). **Probleme** : rejet par l'enum. **Solution** : le schema Zod `z.enum` rejette ; documenter le format BCP 47 tiret. Tester rejet.

### Edge case 6 : template name avec espaces
**Scenario** : `templateName: ' customer_otp_login '`. **Probleme** : `isTemplateWhitelisted` echoue car non trimme. **Solution** : la whitelist compare exactement ; le caller doit fournir un nom propre. Le schema impose `min(1)` mais pas le trim. Documenter que le caller normalise (en 2.7.2 on rejette si non whitelist).

### Edge case 7 : pieces jointes email > 10
**Scenario** : 11 attachments. **Probleme** : limite providers (taille totale). **Solution** : `z.array(...).max(10)` rejette. Tester 11 -> false.

### Edge case 8 : build sans `pnpm install` prealable
**Scenario** : `pnpm --filter @insurtech/comm build` sans install. **Probleme** : `zod` introuvable. **Solution** : toujours `pnpm install --frozen-lockfile` d'abord (9.1).

### Edge case 9 : champ data avec cle numerique
**Scenario** : `data: { "123": "valeur" }`. **Probleme** : une cle purement numerique passe la blacklist (aucun pattern ne matche) mais peut casser le mapping positionnel Meta. **Solution** : la blacklist ne bloque pas (correct, ce n'est pas une donnee sensible nommee), le renderer (2.7.2) trie par cle ; documenter que les cles doivent etre des identifiants lisibles. Tester `isBlacklistedField('123') === false`.

### Edge case 10 : `detectBlacklistedFields` sur un objet avec prototype pollue
**Scenario** : un objet construit via `JSON.parse('{"__proto__": {"amount": "x"}}')`. **Probleme** : `Object.entries` n'itere pas sur `__proto__` (non enumerable), donc la valeur polluee n'est pas scannee, mais elle n'est pas non plus dans `data` propre. **Solution** : `Object.entries` ignore le prototype par design ; pas de faux negatif sur les cles propres. Documenter que seules les cles propres enumerables sont scannees (ce qui est le cas des payloads JSON normaux).

### Edge case 11 : langue valide mais casse differente (`FR` au lieu de `fr`)
**Scenario** : un consommateur envoie `language: 'FR'`. **Probleme** : `z.enum` est sensible a la casse, rejet. **Solution** : le schema rejette `FR` ; documenter que les codes langue sont en minuscules (sauf `ar-MA` ou `MA` est en majuscules par convention BCP 47). Tester rejet de `FR`.

### Edge case 12 : `correlationId` fourni mais non-uuid
**Scenario** : `correlationId: 'abc'`. **Probleme** : le schema impose `.uuid()`, rejet. **Solution** : laisser le champ optionnel et generer un uuid si absent cote service (2.7.2) ; si fourni, il doit etre un uuid valide. Tester rejet de `'abc'` et acceptation d'un uuid.

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP) -- Protection des donnees personnelles
- **Article 3** : finalite definie. Implementation : la separation de canal (status_only vs data_sensible) materialise une finalite explicite par canal.
- **Articles 12-14** : traitement loyal et licite. Implementation : la blacklist `BLACKLISTED_FIELD_PATTERNS` empeche structurellement le transit de donnees sensibles vers WhatsApp (serveurs hors MA). C'est la mesure technique de conformite centrale du sprint.
- Reference : `00-pilotage/decisions/008-data-residency-maroc.md` + correction Saad terrain #7.

### Loi ACAPS -- Retention 10 ans
- Pas directement implementee dans cette tache (audit en 2.7.8), mais les types `WhatsAppStatusMessage`/`SendEmailInput` portent `tenantId`/`userId`/`correlationId` requis par l'audit ACAPS. Cette tache pose les champs de tracabilite.

### decision-008 -- Multilingue 4 langues
- `SUPPORTED_LANGUAGES` = `[fr, ar, ar-MA, en]` exactement. Aucune langue hors de cet ensemble n'est acceptee par les schemas.

## 13. Conventions absolues skalean-insurtech

Cette tache respecte TOUTES les conventions ci-dessous.

**Multi-tenant strict** : tous les types d'entree (`WhatsAppStatusMessage`, `SendEmailInput`, `SendPushInput`, `SendOtpInput`) portent `tenantId`. Le filtrage par tenant est applique dans les services (2.7.2+).

**Validation strict** : Zod uniquement (jamais class-validator/yup/joi). Pattern `const Schema = z.object({...}); type Dto = z.infer<typeof Schema>;`. Schemas exportes depuis le package pour reutilisation controller + service.

**Logger strict** : aucun `console.log` dans le code de production (uniquement Pino injecte dans les services 2.7.2+). Cette tache ne contient pas de log runtime.

**Hash password strict** : non applicable a cette tache (pas d'auth). Le phone hash (SHA256 HMAC) est en 2.7.2.

**Package manager strict** : pnpm uniquement, versions exactes (`zod: 3.24.1`, pas de `^`). `engine-strict=true`.

**TypeScript strict** : `extends tsconfig.base.json` (strict, noUncheckedIndexedAccess, noImplicitAny, noImplicitReturns). Aucun `any` implicite. Imports explicites (pas de `import *` sauf barrel re-export et namespace zod).

**Tests strict** : Vitest. Chaque fichier a logique a un `.spec.ts`. Coverage >= 90% (Sprint 9 critique).

**RBAC strict** : non applicable (pas d'endpoint ici). La permission `customer.notifications.manage` est enforce en 2.7.9.

**Events strict** : non applicable a cette tache (pas de publication Kafka). Format topic `insurtech.events.{vertical}.{entity}.{action}` reserve aux taches downstream.

**Imports strict** : ordre 1) node natifs 2) externes (zod) 3) `@insurtech/*` 4) relatifs. A l'interieur du package : chemins relatifs uniquement.

**Skalean AI strict** : non applicable.

**No-emoji strict (decision-006 ABSOLU)** : aucune emoji dans code/commentaires/constantes. Verifie par V15 + pre-commit.

**Idempotency-Key strict** : non applicable a cette tache (pas de mutation reseau). Applique aux endpoints sensibles en 2.7.9.

**Conventional Commits strict** : `feat(sprint-09): ...` avec metadata Task/Sprint/Phase.

**Cloud souverain MA strict** : la separation de canal materialise la non-sortie des donnees sensibles hors MA (decision-008).

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/comm typecheck            # 0 erreur
pnpm --filter @insurtech/comm test                 # tous PASS
pnpm --filter @insurtech/comm test:coverage        # >= 90%

# no-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/comm/src/ && echo FAIL || echo OK

# no-console
grep -rn "console\.log\|console\.debug" packages/comm/src/ --include="*.ts" | grep -v ".spec.ts" && echo FAIL || echo OK

# verification comptes
node -e "import('./packages/comm/dist/index.js').then(c => { if (c.ALL_STATUS_TEMPLATES.length !== 45) process.exit(1); if (c.BLACKLISTED_FIELD_PATTERNS.length < 15) process.exit(1); console.log('counts OK'); })"
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-09): package @insurtech/comm + types + schemas + constants

Bootstrap du module communication multi-canal scope strict (correction
Saad terrain #7 CNDP loi 09-08). Pose le contrat partage consomme par les
9 taches suivantes du Sprint 9.

Livrables:
- 4 canaux (WhatsApp + Email + Push + SMS) types TypeScript strict
- STATUS_ONLY_TEMPLATES whitelist 45 templates (6 categories 9/6/12/8/6/4)
- BLACKLISTED_FIELD_PATTERNS 15 patterns server-side (money/identity/banking/auth)
- Helpers isBlacklistedField + detectBlacklistedFields + isTemplateWhitelisted
- 4 schemas Zod (SendWhatsAppStatus/SendEmail/SendPush/SendOtp)
- Barrel index.ts

Tests: 27 unit (whitelist + blacklist + schemas + bootstrap)
Coverage: >= 90%

Task: 2.7.1
Sprint: 9 (Phase 2 / Sprint 7)
Phase: 2 -- Securite + Infrastructure
Reference: B-09 Tache 2.7.1
Decisions: correction saad #7 + decision-006 + decision-008 cndp"
```

## 16. Workflow next step

Apres commit de cette tache : passer a `task-2.7.2-whatsapp-service-scope-strict-7-etapes.md`. Le service WhatsApp importe directement `ALL_STATUS_TEMPLATES`, `BLACKLISTED_FIELD_PATTERNS`, `detectBlacklistedFields`, `WhatsAppStatusMessage` et `WhatsAppLanguage` exportes par cette tache. Verifier que `pnpm --filter @insurtech/comm build` a bien genere `dist/` avant de demarrer 2.7.2.

---

**Fin du prompt task-2.7.1.**

Densite atteinte : ~85 ko
Code patterns : 14 fichiers complets
Tests : 27 cas concrets (4 fichiers spec)
Criteres validation : V1-V24
Edge cases : 8
