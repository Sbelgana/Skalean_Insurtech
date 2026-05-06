# Tache 1.2.11 -- Init @insurtech/shared-events -- Topics enum + Zod schemas + types TypeScript inferes

## 1. Header

- Identifiant tache : 1.2.11
- Sprint : 2 (Database + Kafka + Outbox + Idempotency)
- Phase : 1 (Fondations infrastructure backend)
- Duree estimee : 6 heures
- Priorite : P0 (bloquant pour 1.2.12 KafkaPublisher, 1.2.13 KafkaConsumerBase, 1.2.14 OutboxPublisher, 1.2.15 IdempotencyService consumers, et tous les services metiers Sprints 5 a 32)
- Dependances amont : 1.2.10 (PrismaService base sealed), 1.2.9 (migrations seed), 1.2.1 (monorepo turbo packages structure), 1.0.x (decisions architecture 003 events first, 005 AI frontier, 006 no-emoji, 008 cloud souverain MA)
- Dependances aval : 1.2.12 KafkaPublisher consomme topicSchemaMap pour validation pre-publish, 1.2.13 KafkaConsumerBase consomme validateEvent pour parse messages entrants, 1.2.14 OutboxPublisher serialise via EventEnvelopeSchema, 1.2.15 IdempotencyService keye sur event_id ULID, sprints 5+ tous services metiers emettent via topicSchemaMap
- Module monorepo cible : packages/shared-events (nouveau package npm interne workspace)
- Type livrable : Package TypeScript pur (pas de runtime NestJS, pas de DB, juste schemas + types + helpers)
- Aucune emoji dans tout livrable (decision-006 enforced via ESLint regle no-emoji + grep CI)
- Aucun TODO ni FIXME dans le code livre
- Code TypeScript strict mode total (noImplicitAny, strictNullChecks, exactOptionalPropertyTypes)
- Tests obligatoires Vitest >= 80% coverage statements/branches/lines
- Conventional Commits requis pour merge
- Reviewer assigne : tech-lead-backend + architecte-events (decision-005 owner)

## 2. But (3 paragraphes denses)

### Paragraphe 1 -- Source unique de verite Topics et schemas
Le package `@insurtech/shared-events` etablit la source unique de verite pour la totalite de l'ecosysteme evenementiel Skalean InsurTech. Sans ce package partage, chaque microservice (auth, crm, booking, comm, pay, insure, repair, audit, books, stock, hr, system) declarerait independamment ses propres constantes de noms de topics Kafka et ses propres structures de payload, conduisant inevitablement a un drift schema entre producteur et consommateur des le sprint 5. Le pattern centralise via enum `Topics` (53+ valeurs strictement nommees `insurtech.events.<vertical>.<entity>.<action>`) garantit qu'il est impossible de publier un evenement sur un topic non declare ou de consommer un payload non conforme au schema. Chaque schema Zod sert simultanement de validation runtime (au publish dans `KafkaPublisher`, a la consommation dans `KafkaConsumerBase`) et de generation de types TypeScript via `z.infer<>`, eliminant la duplication code-vs-schema typique des approches JSON Schema externes.

### Paragraphe 2 -- Evite le drift producteur/consommateur et formalise la frontiere AI
Sans schemas partages, la moindre evolution unilaterale d'un payload (ajout d'un champ obligatoire par le producteur, retrait d'un champ par le consommateur, changement de type d'un id de string vers number) provoque des incidents production silencieux : le consommateur log une erreur de parsing mais le message est deja consume et perdu, l'audit trail ACAPS Article 12 est rompu, le replay devient impossible. Le package impose `event_version` semver string (`1.0`, `1.1`, `2.0`) sur chaque envelope, transmis par le producteur et inspecte par le consommateur. Une montee de version majeure (1.x vers 2.x) signale un breaking change qui declenche un fan-out vers un nouveau topic versionne (`insurtech.events.crm.contact.created.v2`) plutot que de casser les consommateurs en place. Cette discipline est obligatoire pour la frontiere AI Skalean (decision-005) qui consomme l'integralite du flux events pour entrainement modeles ML, scoring assureur, et generation suggestions agent : un schema mal versionne pollue le data lake et corrompt les features.

### Paragraphe 3 -- Validation runtime Zod plus types TypeScript inferes plus helpers DI-ready
Zod 3.24.1 est retenu sur JSON Schema pur, Avro, et io-ts pour trois raisons techniques. Premierement, Zod genere des types TypeScript automatiquement via `z.infer<typeof Schema>` ce qui garantit que les types compile-time sont rigoureusement identiques aux validations runtime, eliminant la classe d'erreur "le type dit string mais le runtime accepte number". Deuxiemement, Zod expose `safeParse` qui retourne un discriminated union `{ success: true, data: T } | { success: false, error: ZodError }` permettant un controle de flux explicite sans throw, critique pour la consommation Kafka ou un throw non capture cause un commit offset perdu. Troisiemement, Zod supporte les `refine`, `transform`, `discriminatedUnion`, et `intersection` necessaires pour modeliser les payloads metier complexes (Money decimal Dirham, locale fr-MA, ULID regex 26 chars). Le package expose en plus deux helpers : `buildEventId()` retourne un ULID monotone 26 caracteres base32 Crockford pour `event_id`, et `validateEvent(topic, payload)` resout automatiquement le schema correspondant via `topicSchemaMap` et execute `safeParse` -- pattern reutilise par tous les producteurs et consommateurs sans avoir a importer manuellement chaque schema individuellement.

## 3. Contexte etendu

### 3.1 Pourquoi schemas Zod centralises versus JSON Schema versus Avro versus Schema Registry Confluent

Quatre approches ont ete evaluees pendant la phase 0 architecture :

- **JSON Schema externe** : fichiers `.json` dans dossier `schemas/` charges par Ajv au runtime. Avantage : standard IETF, multi-langages. Inconvenient : pas de generation types TypeScript native, necessite outil tiers (`json-schema-to-typescript`) en build step separe, drift entre `.json` source et `.ts` derive si oubli regeneration. Rejete car pipeline build supplementaire fragile.

- **Apache Avro avec Schema Registry Confluent** : standard Kafka officiel, schemas stockes centralement, evolution backward/forward compatible auto-checkee. Avantage : industrie eprouvee, binaire compact (-30% taille payload). Inconvenient : ajoute une dependance runtime critique (Schema Registry HTTP doit etre up sinon publish bloque), licence Confluent Community License pose probleme cloud souverain MA decision-008, codegen TypeScript via `avro-typescript` immature, courbe apprentissage equipe forte. Reporte a Sprint 33 quand le volume justifiera l'investissement.

- **io-ts** : librairie TypeScript fonctionnelle proche fp-ts. Avantage : tres robuste, codecs composables. Inconvenient : DSL verbeux, courbe apprentissage rebutante pour developpeurs non-FP, ecosysteme reduit. Rejete pour velocite equipe.

- **Zod 3.24.1** : retenu. Couvre 100% des cas d'usage (validation primitives, objets imbriques, unions discriminees, transformations, refinements custom Money/ULID/locale), generation types via `z.infer` zero-cost, ergonomie API tres lisible, ecosysteme NestJS mature (`nestjs-zod`, `zod-to-openapi`), bundle 50KB acceptable.

### 3.2 Trade-offs ULID versus UUID v4 versus UUID v7 versus Snowflake

Pour `event_id` quatre options :

- **UUID v4** : 128 bits aleatoires. Avantage : standard universel. Inconvenient : non sortable temporellement, indexation B-tree Postgres tres mauvaise sur insertions massives (page split constants), debug difficile (ordre evenements perdu).

- **UUID v7** : RFC 9562 finalisee 2024, integre timestamp 48 bits + random. Avantage : sortable, standard. Inconvenient : support librairies inegal en 2026, parsing tooling Postgres pas encore mainstream, pas de monotonic guarantee intra-milliseconde.

- **Snowflake Twitter** : 64 bits, machine_id + timestamp + sequence. Avantage : tres compact, ordre garanti. Inconvenient : necessite coordination machine_id (zookeeper ou config externe), risque collision si reset, format proprietaire.

- **ULID Crockford base32 26 chars** : retenu. 128 bits comme UUID, sortable lexicographiquement (timestamp prefix), monotonic guarantee via librairie `ulid` 2.3.0 (counter intra-ms incrementer), regex `[0-9A-HJKMNP-TV-Z]{26}` strict, lisible humainement, copy-paste safe (pas de tirets), supporte par tous les languages cibles ecosysteme.

### 3.3 Decisions architecture amont consommees

- **decision-003 events-first architecture** : tout changement etat domaine emet event Kafka avant retour HTTP 200. shared-events est la couche contractuelle.
- **decision-004 outbox pattern** : events persistes en table `OutboxEvent` Postgres avant publish Kafka, OutboxPublisher relit en background. shared-events fournit serialisation envelope.
- **decision-005 AI frontier** : data lake Kafka -> S3/MinIO -> ClickHouse alimente modeles ML. Schemas stables obligatoires pour features engineering reproductible.
- **decision-006 no-emoji policy** : aucune emoji dans noms topics, payloads, code, commits, docs. Linter CI bloque. shared-events sert de reference exemplaire.
- **decision-008 cloud souverain MA** : tous events restent cluster Kafka MA, pas de cross-region. shared-events n'a pas d'aspect transport mais formalise les noms.

### 3.4 Douze pieges classiques du package events partage

1. **event_version semver mal interprete** : developpeur incrementant `1.0` vers `1.1` pour ajout champ optionnel (correct, backward compatible) versus `2.0` pour retrait champ obligatoire (correct, breaking). Documenter regles dans README et tests.
2. **ULID 26 chars regex incomplete** : oubli des caracteres exclus Crockford (I, L, O, U). Regex stricte `^[0-9A-HJKMNP-TV-Z]{26}$` requise sinon faux positifs.
3. **correlation_id propagation perdue cross-await** : sans AsyncLocalStorage, le correlation_id du request HTTP est perdu apres `await` Promise. Sprint 1 a deja installe ALS (decision-context), shared-events ne gere que la presence dans envelope.
4. **payload unknown versus any** : Zod accepte `z.unknown()` qui force narrowing typesafe avant utilisation. `any` desactive le typecheck. Toujours `unknown` puis `safeParse` du schema specifique.
5. **schema versioning evolution** : ajout champ optionnel = mineur, retrait champ ou changement type = majeur, renommage champ = majeur. Documenter dans CONTRIBUTING.md du package.
6. **topicSchemaMap completeness** : test integration verifie chaque valeur de l'enum Topics est presente comme clef du Map, sinon publish runtime echoue avec "no schema for topic".
7. **Zod safeParse versus parse perf** : `parse` throw, plus rapide en hot path mais bloque sur erreur. `safeParse` retourne union, ~5% plus lent mais controle flux. Toujours safeParse pour Kafka consumers.
8. **peer dep kafkajs** : shared-events declare `kafkajs ^2.2.4` en peerDependencies (pas dependencies) pour eviter duplication binaire dans monorepo. Le package ne consomme kafkajs que pour les types `IHeaders`.
9. **JSON serialization Date vers string** : `Date` instanciee TypeScript serialise en `JSON.stringify` vers ISO string, mais re-parse renvoie string non Date. Schema Zod stocke `z.string().datetime()` partout, jamais `z.date()`.
10. **Buffer payload Kafka versus string** : KafkaJS expose `message.value: Buffer | null`. Toujours `.toString('utf-8')` puis `JSON.parse` dans consumer base, jamais utiliser Buffer directement dans schema.
11. **schemas circular imports** : eviter `import` croises entre dossiers schemas/auth et schemas/crm. Si dependance commune (ex MoneySchema), placer dans `src/types/shared/`.
12. **build TS dist pour CI** : tsc emit `dist/index.js` + `dist/index.d.ts`, exporte via `package.json` `main` + `types` + `exports`. Sans build, monorepo turbo ne peut pas resoudre cross-package en mode published.

## 4. Architecture context

Cette tache est la onzieme du sprint 2. Position dans la chaine de dependances :

```
1.2.1 monorepo turbo
  -> 1.2.2 packages root configs (eslint, prettier, tsconfig base)
    -> 1.2.3 @insurtech/types
      -> 1.2.4 @insurtech/utils
        -> 1.2.5 @insurtech/database (Prisma)
          -> 1.2.6 schema.prisma 50+ models
            -> 1.2.7 migrations init
              -> 1.2.8 seed dev fixtures
                -> 1.2.9 ULID extension Postgres
                  -> 1.2.10 PrismaService NestJS
                    -> 1.2.11 @insurtech/shared-events  <-- ICI
                      -> 1.2.12 KafkaPublisher
                      -> 1.2.13 KafkaConsumerBase
                      -> 1.2.14 OutboxPublisher background worker
                      -> 1.2.15 IdempotencyService Redis 24h
                        -> Sprint 3 auth-service emit user.signed_in
                          -> Sprint 5 crm-service emit contact.created
                            -> ... tous services metiers
```

Diagramme de consommation :

```
         +--------------------------+
         | @insurtech/shared-events |
         | - Topics enum            |
         | - EventEnvelopeSchema    |
         | - 53 schemas Zod         |
         | - topicSchemaMap         |
         | - validateEvent()        |
         | - buildEventId()         |
         +--------------------------+
              ^                    ^
   imports   |                    |   imports
              |                    |
   +-----------------+    +-------------------+
   | KafkaPublisher  |    | KafkaConsumerBase |
   | (producer side) |    | (consumer side)   |
   +-----------------+    +-------------------+
        ^                          ^
        |                          |
   +-----------+              +-----------+
   | service A |              | service B |
   | producer  |              | consumer  |
   +-----------+              +-----------+
```

Le package est strictement TypeScript pur, sans runtime NestJS et sans Prisma : il peut etre consomme par n'importe quel package du monorepo, y compris workers Node.js sans framework, ou meme tools CLI scripts.

## 5. Livrables checkables

- [ ] Dossier packages/shared-events cree avec structure complete
- [ ] package.json avec name, version, dependencies, peerDependencies, scripts
- [ ] tsconfig.json strict mode etendant base monorepo
- [ ] src/topics.ts : enum Topics avec 53+ valeurs
- [ ] src/topics.ts : helpers getTopicVertical, getTopicEntity, getTopicAction
- [ ] src/types/event-envelope.ts : EventEnvelopeSchema Zod
- [ ] src/types/event-envelope.ts : type EventEnvelope generic
- [ ] src/types/event-envelope.ts : isEventEnvelope guard
- [ ] src/schemas/auth/ : 7 schemas (user-created, signed-in, signed-out, locked, unlocked, password-reset-requested, mfa-enabled)
- [ ] src/schemas/crm/ : 6 schemas
- [ ] src/schemas/booking/ : 3 schemas
- [ ] src/schemas/comm/ : 8 schemas
- [ ] src/schemas/pay/ : 6 schemas
- [ ] src/schemas/insure/ : 4 schemas
- [ ] src/schemas/repair/ : 3 schemas
- [ ] src/schemas/audit/ : 3 schemas
- [ ] src/schemas/books/ : 2 schemas
- [ ] src/schemas/stock/ : 2 schemas
- [ ] src/schemas/hr/ : 2 schemas
- [ ] src/schemas/system/ : 3 schemas
- [ ] src/schemas/index.ts : reexports tous schemas
- [ ] src/schemas/index.ts : topicSchemaMap Map<Topics, ZodSchema>
- [ ] src/schemas/index.ts : topicEventNameMap Map<Topics, string>
- [ ] src/helpers/build-event-id.ts : ULID generator wrapper
- [ ] src/helpers/validate-event.ts : validateEvent function
- [ ] src/index.ts : barrel export complet
- [ ] Tests unitaires schemas auth (8 tests minimum)
- [ ] Tests unitaires schemas crm (6 tests)
- [ ] Tests unitaires schemas comm (6 tests)
- [ ] Tests unitaires helpers buildEventId (6 tests)
- [ ] Tests unitaires helpers validateEvent (8 tests)
- [ ] Tests integration topic-schema-completeness (4 tests)
- [ ] Tests types-inference (4 tests)
- [ ] pnpm build emet dist/ avec .d.ts
- [ ] pnpm test passe avec coverage >= 80%
- [ ] pnpm typecheck passe sans erreur

## 6. Fichiers crees ou modifies

Total estime 60 fichiers nouveaux. Aucune modification de fichier existant (package nouveau).

```
packages/shared-events/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  .eslintrc.cjs
  README.md
  src/
    index.ts
    topics.ts
    types/
      event-envelope.ts
      shared/
        money.ts
        locale.ts
        ulid.ts
    schemas/
      index.ts
      auth/
        index.ts
        user-created.schema.ts
        user-signed-in.schema.ts
        user-signed-out.schema.ts
        user-locked.schema.ts
        user-unlocked.schema.ts
        user-password-reset-requested.schema.ts
        user-mfa-enabled.schema.ts
      crm/
        index.ts
        contact-created.schema.ts
        contact-updated.schema.ts
        deal-created.schema.ts
        deal-stage-changed.schema.ts
        interaction-recorded.schema.ts
        interaction-email-received.schema.ts
      booking/
        index.ts
        booking-created.schema.ts
        booking-confirmed.schema.ts
        booking-cancelled.schema.ts
      comm/
        index.ts
        message-sent.schema.ts
        message-delivered.schema.ts
        message-failed.schema.ts
        message-bounced.schema.ts
        whatsapp-inbound.schema.ts
        sms-inbound.schema.ts
        email-inbound.schema.ts
        notification-pushed.schema.ts
      pay/
        index.ts
        transaction-initiated.schema.ts
        transaction-completed.schema.ts
        transaction-failed.schema.ts
        transaction-refunded.schema.ts
        invoice-issued.schema.ts
        invoice-paid.schema.ts
      insure/
        index.ts
        quote-requested.schema.ts
        quote-issued.schema.ts
        policy-signed.schema.ts
        policy-renewed.schema.ts
      repair/
        index.ts
        sinistre-declared.schema.ts
        sinistre-assigned.schema.ts
        sinistre-closed.schema.ts
      audit/
        index.ts
        audit-recorded.schema.ts
        audit-access-denied.schema.ts
        audit-data-exported.schema.ts
      books/
        index.ts
        ledger-entry-posted.schema.ts
        period-closed.schema.ts
      stock/
        index.ts
        stock-adjusted.schema.ts
        stock-movement-recorded.schema.ts
      hr/
        index.ts
        employee-onboarded.schema.ts
        employee-offboarded.schema.ts
      system/
        index.ts
        system-error-raised.schema.ts
        system-health-changed.schema.ts
        system-config-updated.schema.ts
    helpers/
      index.ts
      build-event-id.ts
      validate-event.ts
      parse-envelope.ts
      build-envelope.ts
  test/
    schemas/
      auth/
        user-signed-in.spec.ts
        user-created.spec.ts
        user-locked.spec.ts
      crm/
        contact-created.spec.ts
        deal-stage-changed.spec.ts
      comm/
        message-sent.spec.ts
    helpers/
      build-event-id.spec.ts
      validate-event.spec.ts
      build-envelope.spec.ts
    integration/
      topic-schema-completeness.spec.ts
      types-inference.spec.ts
```

## 7. Code patterns complets

### 7.1 packages/shared-events/package.json

```json
{
  "name": "@insurtech/shared-events",
  "version": "0.1.0",
  "private": true,
  "description": "Source unique de verite Topics Kafka et schemas Zod events Skalean InsurTech",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    },
    "./topics": {
      "types": "./dist/topics.d.ts",
      "import": "./dist/topics.js"
    },
    "./schemas": {
      "types": "./dist/schemas/index.d.ts",
      "import": "./dist/schemas/index.js"
    },
    "./helpers": {
      "types": "./dist/helpers/index.d.ts",
      "import": "./dist/helpers/index.js"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "clean": "rimraf dist",
    "dev": "tsc -p tsconfig.build.json --watch",
    "test": "vitest run --coverage",
    "test:watch": "vitest watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test --ext .ts --max-warnings 0",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "ulid": "2.3.0",
    "zod": "3.24.1"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.4.0",
    "kafkajs": "^2.2.4"
  },
  "peerDependenciesMeta": {
    "@nestjs/common": { "optional": true },
    "kafkajs": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "20.14.0",
    "@vitest/coverage-v8": "1.6.0",
    "eslint": "8.57.0",
    "rimraf": "5.0.7",
    "typescript": "5.5.4",
    "vitest": "1.6.0"
  },
  "engines": {
    "node": ">=20.11.0"
  }
}
```

### 7.2 packages/shared-events/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

### 7.3 packages/shared-events/tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*"],
  "exclude": ["test", "**/*.spec.ts", "node_modules", "dist"]
}
```

### 7.4 packages/shared-events/src/topics.ts

```typescript
/**
 * Source unique de verite des topics Kafka Skalean InsurTech.
 * Format strict : insurtech.events.<vertical>.<entity>.<action>
 * Aucune emoji autorisee dans les noms (decision-006).
 * Toute valeur ajoutee ici doit avoir un schema Zod correspondant
 * dans src/schemas/<vertical>/ et etre referencee dans topicSchemaMap.
 */
export enum Topics {
  // ==================== AUTH (7) ====================
  AUTH_USER_CREATED = 'insurtech.events.auth.user.created',
  AUTH_USER_SIGNED_IN = 'insurtech.events.auth.user.signed_in',
  AUTH_USER_SIGNED_OUT = 'insurtech.events.auth.user.signed_out',
  AUTH_USER_LOCKED = 'insurtech.events.auth.user.locked',
  AUTH_USER_UNLOCKED = 'insurtech.events.auth.user.unlocked',
  AUTH_USER_PASSWORD_RESET_REQUESTED = 'insurtech.events.auth.user.password_reset_requested',
  AUTH_USER_MFA_ENABLED = 'insurtech.events.auth.user.mfa_enabled',

  // ==================== CRM (6) ====================
  CRM_CONTACT_CREATED = 'insurtech.events.crm.contact.created',
  CRM_CONTACT_UPDATED = 'insurtech.events.crm.contact.updated',
  CRM_DEAL_CREATED = 'insurtech.events.crm.deal.created',
  CRM_DEAL_STAGE_CHANGED = 'insurtech.events.crm.deal.stage_changed',
  CRM_INTERACTION_RECORDED = 'insurtech.events.crm.interaction.recorded',
  CRM_INTERACTION_EMAIL_RECEIVED = 'insurtech.events.crm.interaction.email_received',

  // ==================== BOOKING (3) ====================
  BOOKING_CREATED = 'insurtech.events.booking.created',
  BOOKING_CONFIRMED = 'insurtech.events.booking.confirmed',
  BOOKING_CANCELLED = 'insurtech.events.booking.cancelled',

  // ==================== COMM (8) ====================
  COMM_MESSAGE_SENT = 'insurtech.events.comm.message.sent',
  COMM_MESSAGE_DELIVERED = 'insurtech.events.comm.message.delivered',
  COMM_MESSAGE_FAILED = 'insurtech.events.comm.message.failed',
  COMM_MESSAGE_BOUNCED = 'insurtech.events.comm.message.bounced',
  COMM_WHATSAPP_INBOUND = 'insurtech.events.comm.whatsapp.inbound',
  COMM_SMS_INBOUND = 'insurtech.events.comm.sms.inbound',
  COMM_EMAIL_INBOUND = 'insurtech.events.comm.email.inbound',
  COMM_NOTIFICATION_PUSHED = 'insurtech.events.comm.notification.pushed',

  // ==================== PAY (6) ====================
  PAY_TRANSACTION_INITIATED = 'insurtech.events.pay.transaction.initiated',
  PAY_TRANSACTION_COMPLETED = 'insurtech.events.pay.transaction.completed',
  PAY_TRANSACTION_FAILED = 'insurtech.events.pay.transaction.failed',
  PAY_TRANSACTION_REFUNDED = 'insurtech.events.pay.transaction.refunded',
  PAY_INVOICE_ISSUED = 'insurtech.events.pay.invoice.issued',
  PAY_INVOICE_PAID = 'insurtech.events.pay.invoice.paid',

  // ==================== INSURE (4 -- Sprint 14) ====================
  INSURE_QUOTE_REQUESTED = 'insurtech.events.insure.quote.requested',
  INSURE_QUOTE_ISSUED = 'insurtech.events.insure.quote.issued',
  INSURE_POLICY_SIGNED = 'insurtech.events.insure.policy.signed',
  INSURE_POLICY_RENEWED = 'insurtech.events.insure.policy.renewed',

  // ==================== REPAIR (3 -- Sprint 20) ====================
  REPAIR_SINISTRE_DECLARED = 'insurtech.events.repair.sinistre.declared',
  REPAIR_SINISTRE_ASSIGNED = 'insurtech.events.repair.sinistre.assigned',
  REPAIR_SINISTRE_CLOSED = 'insurtech.events.repair.sinistre.closed',

  // ==================== AUDIT (3) ====================
  AUDIT_RECORDED = 'insurtech.events.audit.recorded',
  AUDIT_ACCESS_DENIED = 'insurtech.events.audit.access_denied',
  AUDIT_DATA_EXPORTED = 'insurtech.events.audit.data_exported',

  // ==================== BOOKS (2) ====================
  BOOKS_LEDGER_ENTRY_POSTED = 'insurtech.events.books.ledger.entry_posted',
  BOOKS_PERIOD_CLOSED = 'insurtech.events.books.period.closed',

  // ==================== STOCK (2) ====================
  STOCK_ADJUSTED = 'insurtech.events.stock.adjusted',
  STOCK_MOVEMENT_RECORDED = 'insurtech.events.stock.movement.recorded',

  // ==================== HR (2) ====================
  HR_EMPLOYEE_ONBOARDED = 'insurtech.events.hr.employee.onboarded',
  HR_EMPLOYEE_OFFBOARDED = 'insurtech.events.hr.employee.offboarded',

  // ==================== SYSTEM (3) ====================
  SYSTEM_ERROR_RAISED = 'insurtech.events.system.error.raised',
  SYSTEM_HEALTH_CHANGED = 'insurtech.events.system.health.changed',
  SYSTEM_CONFIG_UPDATED = 'insurtech.events.system.config.updated',
}

/**
 * Verticales metier supportees.
 */
export type TopicVertical =
  | 'auth'
  | 'crm'
  | 'booking'
  | 'comm'
  | 'pay'
  | 'insure'
  | 'repair'
  | 'audit'
  | 'books'
  | 'stock'
  | 'hr'
  | 'system';

/**
 * Extrait la verticale (auth, crm, etc.) d'un topic.
 */
export function getTopicVertical(topic: Topics): TopicVertical {
  const parts = topic.split('.');
  if (parts.length < 3) {
    throw new Error(`Invalid topic format: ${topic}`);
  }
  return parts[2] as TopicVertical;
}

/**
 * Extrait l'entite (user, contact, deal, etc.) d'un topic.
 */
export function getTopicEntity(topic: Topics): string {
  const parts = topic.split('.');
  if (parts.length < 4) {
    throw new Error(`Invalid topic format: ${topic}`);
  }
  return parts[3];
}

/**
 * Extrait l'action (created, updated, etc.) d'un topic.
 * Joint les segments restants si plus de 5 parts (ex stage_changed).
 */
export function getTopicAction(topic: Topics): string {
  const parts = topic.split('.');
  if (parts.length < 5) {
    throw new Error(`Invalid topic format: ${topic}`);
  }
  return parts.slice(4).join('.');
}

/**
 * Liste tous les topics d'une verticale donnee.
 */
export function getTopicsByVertical(vertical: TopicVertical): Topics[] {
  return Object.values(Topics).filter((t) => getTopicVertical(t) === vertical);
}

/**
 * Verifie qu'une chaine est un Topic enregistre.
 */
export function isKnownTopic(value: string): value is Topics {
  return Object.values(Topics).includes(value as Topics);
}
```

### 7.5 packages/shared-events/src/types/event-envelope.ts

```typescript
import { z } from 'zod';

/**
 * Regex stricte ULID Crockford base32 (26 caracteres, exclut I, L, O, U).
 */
export const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Regex semver simplifie pour event_version (major.minor sans patch).
 * Exemples valides : 1.0, 1.1, 2.0, 10.5
 */
export const EVENT_VERSION_REGEX = /^\d+\.\d+$/;

/**
 * Schema Zod de l'envelope evenement Skalean.
 * Tous les events Kafka publies par les services suivent cette structure.
 *
 * - event_id : ULID 26 chars unique, sortable, monotonic
 * - event_name : nom du topic (ex insurtech.events.auth.user.signed_in)
 * - event_version : semver major.minor pour gestion breaking changes
 * - occurred_at : ISO 8601 datetime UTC (Africa/Casablanca timezone normalise UTC)
 * - tenant_id : UUID v4 du tenant proprietaire (null pour events system globaux)
 * - user_id : UUID v4 de l'utilisateur a l'origine (null pour events automatiques)
 * - correlation_id : UUID v4 de propagation cross-service (null si event racine)
 * - payload : structure typee specifique au schema dedie au topic
 */
export const EventEnvelopeSchema = z.object({
  event_id: z.string().regex(ULID_REGEX, 'event_id must be 26-char ULID Crockford base32'),
  event_name: z.string().min(1).max(200),
  event_version: z.string().regex(EVENT_VERSION_REGEX, 'event_version must match major.minor format').default('1.0'),
  occurred_at: z.string().datetime({ offset: false, precision: 3 }),
  tenant_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  correlation_id: z.string().uuid().nullable(),
  payload: z.unknown(),
});

/**
 * Type TypeScript inferre depuis le schema, generic sur le payload.
 */
export type EventEnvelope<T = unknown> = Omit<z.infer<typeof EventEnvelopeSchema>, 'payload'> & {
  payload: T;
};

/**
 * Type guard runtime : verifie qu'un objet inconnu correspond a une envelope valide.
 */
export function isEventEnvelope(value: unknown): value is EventEnvelope {
  const result = EventEnvelopeSchema.safeParse(value);
  return result.success;
}

/**
 * Type guard avec narrowing payload via schema specifique.
 */
export function isEventEnvelopeOf<T>(
  value: unknown,
  payloadSchema: z.ZodType<T>,
): value is EventEnvelope<T> {
  const envelopeResult = EventEnvelopeSchema.safeParse(value);
  if (!envelopeResult.success) {
    return false;
  }
  const payloadResult = payloadSchema.safeParse(envelopeResult.data.payload);
  return payloadResult.success;
}
```

### 7.6 packages/shared-events/src/types/shared/money.ts

```typescript
import { z } from 'zod';

/**
 * Money en Dirham marocain (MAD).
 * Stockage en string decimal pour eviter erreurs flottants IEEE 754.
 * 2 decimales max, valeur >= 0, max 999 999 999.99 MAD.
 */
export const MoneyDirhamSchema = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Money must be decimal string max 9 digits + 2 decimals')
  .refine((s) => parseFloat(s) >= 0, 'Money must be non-negative')
  .refine((s) => parseFloat(s) <= 999_999_999.99, 'Money exceeds maximum 999_999_999.99');

export type MoneyDirham = z.infer<typeof MoneyDirhamSchema>;
```

### 7.7 packages/shared-events/src/types/shared/locale.ts

```typescript
import { z } from 'zod';

/**
 * Locales supportees par Skalean InsurTech (decision-marche-MA).
 * fr-MA principal, ar-MA secondaire RTL, en-US technique, fr-FR fallback.
 */
export const LocaleSchema = z.enum(['fr-MA', 'ar-MA', 'en-US', 'fr-FR']);
export type Locale = z.infer<typeof LocaleSchema>;

/**
 * Canaux de communication.
 */
export const ChannelSchema = z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']);
export type Channel = z.infer<typeof ChannelSchema>;
```

### 7.8 packages/shared-events/src/types/shared/ulid.ts

```typescript
import { z } from 'zod';
import { ULID_REGEX } from '../event-envelope';

export const UlidSchema = z.string().regex(ULID_REGEX, 'Must be 26-char ULID');
export type Ulid = z.infer<typeof UlidSchema>;
```

### 7.9 packages/shared-events/src/schemas/auth/user-signed-in.schema.ts

```typescript
import { z } from 'zod';

export const SigninMethodSchema = z.enum([
  'password',
  'magic_link',
  'sso_google',
  'sso_microsoft',
  'mfa_totp',
  'mfa_sms',
  'api_key',
]);

export const UserSignedInPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  signin_method: SigninMethodSchema,
  ip_address: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })),
  user_agent: z.string().min(1).max(1024),
  signed_in_at: z.string().datetime(),
  session_id: z.string().uuid(),
  device_fingerprint: z.string().max(256).nullable(),
  geo_country: z.string().length(2).nullable(),
  geo_city: z.string().max(100).nullable(),
});

export type UserSignedInPayload = z.infer<typeof UserSignedInPayloadSchema>;
```

### 7.10 packages/shared-events/src/schemas/auth/user-created.schema.ts

```typescript
import { z } from 'zod';
import { LocaleSchema } from '../../types/shared/locale';

export const UserCreatedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email().max(320),
  full_name: z.string().min(1).max(200),
  role: z.enum(['super_admin', 'admin', 'manager', 'agent', 'viewer']),
  locale: LocaleSchema,
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid().nullable(),
  invitation_token_hash: z.string().nullable(),
});

export type UserCreatedPayload = z.infer<typeof UserCreatedPayloadSchema>;
```

### 7.11 packages/shared-events/src/schemas/auth/user-locked.schema.ts

```typescript
import { z } from 'zod';

export const UserLockedReasonSchema = z.enum([
  'too_many_failed_attempts',
  'admin_action',
  'suspicious_activity',
  'policy_violation',
  'account_compromised',
]);

export const UserLockedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  reason: UserLockedReasonSchema,
  failed_attempts_count: z.number().int().min(0).max(1000),
  locked_at: z.string().datetime(),
  locked_until: z.string().datetime().nullable(),
  locked_by_user_id: z.string().uuid().nullable(),
  notes: z.string().max(2048).nullable(),
});

export type UserLockedPayload = z.infer<typeof UserLockedPayloadSchema>;
```

### 7.12 packages/shared-events/src/schemas/auth/user-signed-out.schema.ts

```typescript
import { z } from 'zod';

export const UserSignedOutPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  signed_out_at: z.string().datetime(),
  reason: z.enum(['user_action', 'session_timeout', 'forced_by_admin', 'token_expired']),
});

export type UserSignedOutPayload = z.infer<typeof UserSignedOutPayloadSchema>;
```

### 7.13 packages/shared-events/src/schemas/auth/user-unlocked.schema.ts

```typescript
import { z } from 'zod';

export const UserUnlockedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  unlocked_at: z.string().datetime(),
  unlocked_by_user_id: z.string().uuid().nullable(),
  unlock_method: z.enum(['admin_action', 'auto_timeout_expired', 'self_service_email_link']),
});

export type UserUnlockedPayload = z.infer<typeof UserUnlockedPayloadSchema>;
```

### 7.14 packages/shared-events/src/schemas/auth/user-password-reset-requested.schema.ts

```typescript
import { z } from 'zod';

export const UserPasswordResetRequestedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  reset_token_hash: z.string().min(64).max(128),
  requested_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  ip_address: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })),
});

export type UserPasswordResetRequestedPayload = z.infer<typeof UserPasswordResetRequestedPayloadSchema>;
```

### 7.15 packages/shared-events/src/schemas/auth/user-mfa-enabled.schema.ts

```typescript
import { z } from 'zod';

export const UserMfaEnabledPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  mfa_method: z.enum(['totp', 'sms', 'email', 'hardware_key']),
  enabled_at: z.string().datetime(),
  backup_codes_generated: z.boolean(),
});

export type UserMfaEnabledPayload = z.infer<typeof UserMfaEnabledPayloadSchema>;
```

### 7.16 packages/shared-events/src/schemas/auth/index.ts

```typescript
export * from './user-created.schema';
export * from './user-signed-in.schema';
export * from './user-signed-out.schema';
export * from './user-locked.schema';
export * from './user-unlocked.schema';
export * from './user-password-reset-requested.schema';
export * from './user-mfa-enabled.schema';
```

### 7.17 packages/shared-events/src/schemas/crm/contact-created.schema.ts

```typescript
import { z } from 'zod';
import { LocaleSchema, ChannelSchema } from '../../types/shared/locale';

export const ContactCreatedPayloadSchema = z.object({
  contact_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  email: z.string().email().nullable(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'E.164 phone format').nullable(),
  preferred_language: LocaleSchema,
  preferred_channel: ChannelSchema,
  source: z.enum(['manual', 'web_form', 'import_csv', 'api', 'whatsapp_inbound', 'referral']),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
});

export type ContactCreatedPayload = z.infer<typeof ContactCreatedPayloadSchema>;
```

### 7.18 packages/shared-events/src/schemas/crm/contact-updated.schema.ts

```typescript
import { z } from 'zod';

export const ContactUpdatedPayloadSchema = z.object({
  contact_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  updated_fields: z.array(z.string()).min(1),
  previous_values: z.record(z.unknown()),
  new_values: z.record(z.unknown()),
  updated_at: z.string().datetime(),
  updated_by_user_id: z.string().uuid(),
});

export type ContactUpdatedPayload = z.infer<typeof ContactUpdatedPayloadSchema>;
```

### 7.19 packages/shared-events/src/schemas/crm/deal-created.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const DealCreatedPayloadSchema = z.object({
  deal_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  stage: z.string().min(1).max(100),
  amount_dirham: MoneyDirhamSchema,
  expected_close_date: z.string().date(),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
});

export type DealCreatedPayload = z.infer<typeof DealCreatedPayloadSchema>;
```

### 7.20 packages/shared-events/src/schemas/crm/deal-stage-changed.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const DealStageChangedPayloadSchema = z.object({
  deal_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_stage: z.string().min(1).max(100),
  to_stage: z.string().min(1).max(100),
  amount_dirham: MoneyDirhamSchema,
  by_user_id: z.string().uuid(),
  changed_at: z.string().datetime(),
  reason: z.string().max(2048).nullable(),
});

export type DealStageChangedPayload = z.infer<typeof DealStageChangedPayloadSchema>;
```

### 7.21 packages/shared-events/src/schemas/crm/interaction-recorded.schema.ts

```typescript
import { z } from 'zod';
import { ChannelSchema } from '../../types/shared/locale';

export const InteractionRecordedPayloadSchema = z.object({
  interaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  channel: ChannelSchema,
  direction: z.enum(['inbound', 'outbound']),
  subject: z.string().max(500).nullable(),
  body_excerpt: z.string().max(1024),
  recorded_at: z.string().datetime(),
  by_user_id: z.string().uuid().nullable(),
});

export type InteractionRecordedPayload = z.infer<typeof InteractionRecordedPayloadSchema>;
```

### 7.22 packages/shared-events/src/schemas/crm/interaction-email-received.schema.ts

```typescript
import { z } from 'zod';

export const InteractionEmailReceivedPayloadSchema = z.object({
  interaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  from_email: z.string().email(),
  to_email: z.string().email(),
  subject: z.string().max(998),
  message_id_header: z.string().max(998),
  in_reply_to: z.string().nullable(),
  received_at: z.string().datetime(),
  body_excerpt: z.string().max(2048),
  has_attachments: z.boolean(),
});

export type InteractionEmailReceivedPayload = z.infer<typeof InteractionEmailReceivedPayloadSchema>;
```

### 7.23 packages/shared-events/src/schemas/crm/index.ts

```typescript
export * from './contact-created.schema';
export * from './contact-updated.schema';
export * from './deal-created.schema';
export * from './deal-stage-changed.schema';
export * from './interaction-recorded.schema';
export * from './interaction-email-received.schema';
```

### 7.24 packages/shared-events/src/schemas/booking/booking-created.schema.ts

```typescript
import { z } from 'zod';

export const BookingCreatedPayloadSchema = z.object({
  booking_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  resource_id: z.string().uuid(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
});

export type BookingCreatedPayload = z.infer<typeof BookingCreatedPayloadSchema>;
```

### 7.25 packages/shared-events/src/schemas/booking/booking-confirmed.schema.ts

```typescript
import { z } from 'zod';

export const BookingConfirmedPayloadSchema = z.object({
  booking_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  confirmed_at: z.string().datetime(),
  confirmed_by_user_id: z.string().uuid(),
  notification_sent: z.boolean(),
});

export type BookingConfirmedPayload = z.infer<typeof BookingConfirmedPayloadSchema>;
```

### 7.26 packages/shared-events/src/schemas/booking/booking-cancelled.schema.ts

```typescript
import { z } from 'zod';

export const BookingCancelledPayloadSchema = z.object({
  booking_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  cancelled_at: z.string().datetime(),
  cancelled_by_user_id: z.string().uuid(),
  reason: z.enum(['user_request', 'no_show', 'admin_action', 'system_timeout']),
  refund_issued: z.boolean(),
});

export type BookingCancelledPayload = z.infer<typeof BookingCancelledPayloadSchema>;
```

### 7.27 packages/shared-events/src/schemas/booking/index.ts

```typescript
export * from './booking-created.schema';
export * from './booking-confirmed.schema';
export * from './booking-cancelled.schema';
```

### 7.28 packages/shared-events/src/schemas/comm/message-sent.schema.ts

```typescript
import { z } from 'zod';
import { ChannelSchema } from '../../types/shared/locale';

export const MessageSentPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  channel: ChannelSchema,
  to_address: z.string().min(1).max(320),
  from_address: z.string().min(1).max(320).nullable(),
  template_id: z.string().uuid().nullable(),
  provider: z.enum(['twilio', 'meta_whatsapp', 'sendgrid', 'mailjet', 'firebase_fcm', 'apns']),
  provider_message_id: z.string().max(256),
  sent_at: z.string().datetime(),
  related_resource_type: z.string().max(50).nullable(),
  related_resource_id: z.string().uuid().nullable(),
});

export type MessageSentPayload = z.infer<typeof MessageSentPayloadSchema>;
```

### 7.29 packages/shared-events/src/schemas/comm/message-delivered.schema.ts

```typescript
import { z } from 'zod';

export const MessageDeliveredPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  delivered_at: z.string().datetime(),
  provider_callback_id: z.string().max(256).nullable(),
});

export type MessageDeliveredPayload = z.infer<typeof MessageDeliveredPayloadSchema>;
```

### 7.30 packages/shared-events/src/schemas/comm/message-failed.schema.ts

```typescript
import { z } from 'zod';

export const MessageFailedPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  failed_at: z.string().datetime(),
  error_code: z.string().max(50),
  error_message: z.string().max(2048),
  retry_count: z.number().int().min(0).max(20),
});

export type MessageFailedPayload = z.infer<typeof MessageFailedPayloadSchema>;
```

### 7.31 packages/shared-events/src/schemas/comm/message-bounced.schema.ts

```typescript
import { z } from 'zod';

export const MessageBouncedPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  bounced_at: z.string().datetime(),
  bounce_type: z.enum(['hard', 'soft', 'spam', 'block']),
  diagnostic_code: z.string().max(2048).nullable(),
});

export type MessageBouncedPayload = z.infer<typeof MessageBouncedPayloadSchema>;
```

### 7.32 packages/shared-events/src/schemas/comm/whatsapp-inbound.schema.ts

```typescript
import { z } from 'zod';

export const WhatsappInboundPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  to_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  body: z.string().max(4096),
  media_url: z.string().url().nullable(),
  media_type: z.enum(['image', 'video', 'audio', 'document']).nullable(),
  received_at: z.string().datetime(),
  whatsapp_message_id: z.string().max(256),
});

export type WhatsappInboundPayload = z.infer<typeof WhatsappInboundPayloadSchema>;
```

### 7.33 packages/shared-events/src/schemas/comm/sms-inbound.schema.ts

```typescript
import { z } from 'zod';

export const SmsInboundPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  to_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  body: z.string().max(1600),
  received_at: z.string().datetime(),
  provider_sms_id: z.string().max(256),
});

export type SmsInboundPayload = z.infer<typeof SmsInboundPayloadSchema>;
```

### 7.34 packages/shared-events/src/schemas/comm/email-inbound.schema.ts

```typescript
import { z } from 'zod';

export const EmailInboundPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_email: z.string().email(),
  to_email: z.string().email(),
  subject: z.string().max(998),
  body_text: z.string().max(65536),
  body_html: z.string().max(262144).nullable(),
  received_at: z.string().datetime(),
  has_attachments: z.boolean(),
  attachment_count: z.number().int().min(0).max(100),
});

export type EmailInboundPayload = z.infer<typeof EmailInboundPayloadSchema>;
```

### 7.35 packages/shared-events/src/schemas/comm/notification-pushed.schema.ts

```typescript
import { z } from 'zod';

export const NotificationPushedPayloadSchema = z.object({
  notification_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().max(200),
  body: z.string().max(2048),
  pushed_at: z.string().datetime(),
  device_token_count: z.number().int().min(0).max(100),
  platform: z.enum(['ios', 'android', 'web']),
});

export type NotificationPushedPayload = z.infer<typeof NotificationPushedPayloadSchema>;
```

### 7.36 packages/shared-events/src/schemas/comm/index.ts

```typescript
export * from './message-sent.schema';
export * from './message-delivered.schema';
export * from './message-failed.schema';
export * from './message-bounced.schema';
export * from './whatsapp-inbound.schema';
export * from './sms-inbound.schema';
export * from './email-inbound.schema';
export * from './notification-pushed.schema';
```

### 7.37 packages/shared-events/src/schemas/pay/transaction-completed.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const TransactionCompletedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  amount_dirham: MoneyDirhamSchema,
  provider: z.enum(['cmi', 'naps', 'stripe', 'paypal', 'cash', 'bank_transfer']),
  provider_transaction_id: z.string().max(256),
  related_resource_type: z.enum(['invoice', 'policy', 'booking', 'subscription', 'manual']),
  related_resource_id: z.string().uuid(),
  completed_at: z.string().datetime(),
  fees_dirham: MoneyDirhamSchema.nullable(),
});

export type TransactionCompletedPayload = z.infer<typeof TransactionCompletedPayloadSchema>;
```

### 7.38 packages/shared-events/src/schemas/pay/transaction-initiated.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const TransactionInitiatedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  amount_dirham: MoneyDirhamSchema,
  provider: z.enum(['cmi', 'naps', 'stripe', 'paypal', 'cash', 'bank_transfer']),
  initiated_at: z.string().datetime(),
  initiated_by_user_id: z.string().uuid().nullable(),
  payment_method_token: z.string().max(256).nullable(),
});

export type TransactionInitiatedPayload = z.infer<typeof TransactionInitiatedPayloadSchema>;
```

### 7.39 packages/shared-events/src/schemas/pay/transaction-failed.schema.ts

```typescript
import { z } from 'zod';

export const TransactionFailedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  failed_at: z.string().datetime(),
  error_code: z.string().max(50),
  error_message: z.string().max(2048),
  is_retryable: z.boolean(),
});

export type TransactionFailedPayload = z.infer<typeof TransactionFailedPayloadSchema>;
```

### 7.40 packages/shared-events/src/schemas/pay/transaction-refunded.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const TransactionRefundedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  refund_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  refund_amount_dirham: MoneyDirhamSchema,
  refunded_at: z.string().datetime(),
  reason: z.string().max(2048),
  by_user_id: z.string().uuid(),
});

export type TransactionRefundedPayload = z.infer<typeof TransactionRefundedPayloadSchema>;
```

### 7.41 packages/shared-events/src/schemas/pay/invoice-issued.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const InvoiceIssuedPayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  invoice_number: z.string().min(1).max(50),
  total_amount_dirham: MoneyDirhamSchema,
  vat_amount_dirham: MoneyDirhamSchema,
  due_date: z.string().date(),
  issued_at: z.string().datetime(),
  issued_by_user_id: z.string().uuid(),
});

export type InvoiceIssuedPayload = z.infer<typeof InvoiceIssuedPayloadSchema>;
```

### 7.42 packages/shared-events/src/schemas/pay/invoice-paid.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const InvoicePaidPayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  paid_amount_dirham: MoneyDirhamSchema,
  paid_at: z.string().datetime(),
  transaction_id: z.string().uuid(),
});

export type InvoicePaidPayload = z.infer<typeof InvoicePaidPayloadSchema>;
```

### 7.43 packages/shared-events/src/schemas/pay/index.ts

```typescript
export * from './transaction-initiated.schema';
export * from './transaction-completed.schema';
export * from './transaction-failed.schema';
export * from './transaction-refunded.schema';
export * from './invoice-issued.schema';
export * from './invoice-paid.schema';
```

### 7.44 packages/shared-events/src/schemas/insure/policy-signed.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const PolicySignedPayloadSchema = z.object({
  policy_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  assureur_id: z.string().uuid(),
  product_code: z.string().min(1).max(50),
  premium_dirham: MoneyDirhamSchema,
  coverage_start_date: z.string().date(),
  coverage_end_date: z.string().date(),
  signed_at: z.string().datetime(),
  signed_by_user_id: z.string().uuid(),
  policy_number: z.string().min(1).max(50),
});

export type PolicySignedPayload = z.infer<typeof PolicySignedPayloadSchema>;
```

### 7.45 packages/shared-events/src/schemas/insure/quote-requested.schema.ts

```typescript
import { z } from 'zod';

export const QuoteRequestedPayloadSchema = z.object({
  quote_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  product_code: z.string().min(1).max(50),
  requested_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
  parameters: z.record(z.unknown()),
});

export type QuoteRequestedPayload = z.infer<typeof QuoteRequestedPayloadSchema>;
```

### 7.46 packages/shared-events/src/schemas/insure/quote-issued.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const QuoteIssuedPayloadSchema = z.object({
  quote_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  premium_dirham: MoneyDirhamSchema,
  valid_until: z.string().datetime(),
  issued_at: z.string().datetime(),
  assureur_id: z.string().uuid(),
});

export type QuoteIssuedPayload = z.infer<typeof QuoteIssuedPayloadSchema>;
```

### 7.47 packages/shared-events/src/schemas/insure/policy-renewed.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const PolicyRenewedPayloadSchema = z.object({
  policy_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  previous_policy_id: z.string().uuid(),
  premium_dirham: MoneyDirhamSchema,
  new_coverage_start_date: z.string().date(),
  new_coverage_end_date: z.string().date(),
  renewed_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type PolicyRenewedPayload = z.infer<typeof PolicyRenewedPayloadSchema>;
```

### 7.48 packages/shared-events/src/schemas/insure/index.ts

```typescript
export * from './quote-requested.schema';
export * from './quote-issued.schema';
export * from './policy-signed.schema';
export * from './policy-renewed.schema';
```

### 7.49 packages/shared-events/src/schemas/repair/sinistre-declared.schema.ts

```typescript
import { z } from 'zod';

export const SinistreDeclaredPayloadSchema = z.object({
  sinistre_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  declared_at: z.string().datetime(),
  occurred_at: z.string().datetime(),
  description: z.string().min(1).max(4096),
  damage_type: z.enum(['vehicule', 'habitation', 'sante', 'professionnel', 'autre']),
  initial_estimate_dirham: z.string().nullable(),
  declared_by_user_id: z.string().uuid(),
});

export type SinistreDeclaredPayload = z.infer<typeof SinistreDeclaredPayloadSchema>;
```

### 7.50 packages/shared-events/src/schemas/repair/sinistre-assigned.schema.ts

```typescript
import { z } from 'zod';

export const SinistreAssignedPayloadSchema = z.object({
  sinistre_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  expert_id: z.string().uuid(),
  assigned_at: z.string().datetime(),
  assigned_by_user_id: z.string().uuid(),
  expected_visit_date: z.string().date().nullable(),
});

export type SinistreAssignedPayload = z.infer<typeof SinistreAssignedPayloadSchema>;
```

### 7.51 packages/shared-events/src/schemas/repair/sinistre-closed.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const SinistreClosedPayloadSchema = z.object({
  sinistre_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  closed_at: z.string().datetime(),
  closed_by_user_id: z.string().uuid(),
  outcome: z.enum(['indemnise', 'rejete', 'desiste', 'classe_sans_suite']),
  indemnity_amount_dirham: MoneyDirhamSchema.nullable(),
});

export type SinistreClosedPayload = z.infer<typeof SinistreClosedPayloadSchema>;
```

### 7.52 packages/shared-events/src/schemas/repair/index.ts

```typescript
export * from './sinistre-declared.schema';
export * from './sinistre-assigned.schema';
export * from './sinistre-closed.schema';
```

### 7.53 packages/shared-events/src/schemas/audit/audit-recorded.schema.ts

```typescript
import { z } from 'zod';

export const AuditRecordedPayloadSchema = z.object({
  audit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  action: z.string().min(1).max(100),
  resource_type: z.string().min(1).max(50),
  resource_id: z.string().uuid().nullable(),
  occurred_at: z.string().datetime(),
  ip_address: z.string().nullable(),
  user_agent: z.string().max(1024).nullable(),
  before_state: z.unknown().nullable(),
  after_state: z.unknown().nullable(),
});

export type AuditRecordedPayload = z.infer<typeof AuditRecordedPayloadSchema>;
```

### 7.54 packages/shared-events/src/schemas/audit/audit-access-denied.schema.ts

```typescript
import { z } from 'zod';

export const AuditAccessDeniedPayloadSchema = z.object({
  audit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  attempted_action: z.string().min(1).max(100),
  resource_type: z.string().min(1).max(50),
  resource_id: z.string().uuid().nullable(),
  reason: z.enum(['rbac_denied', 'tenant_mismatch', 'rate_limited', 'session_expired', 'mfa_required']),
  occurred_at: z.string().datetime(),
  ip_address: z.string().nullable(),
});

export type AuditAccessDeniedPayload = z.infer<typeof AuditAccessDeniedPayloadSchema>;
```

### 7.55 packages/shared-events/src/schemas/audit/audit-data-exported.schema.ts

```typescript
import { z } from 'zod';

export const AuditDataExportedPayloadSchema = z.object({
  audit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_user_id: z.string().uuid(),
  resource_type: z.string().min(1).max(50),
  export_format: z.enum(['csv', 'xlsx', 'json', 'pdf']),
  row_count: z.number().int().min(0),
  exported_at: z.string().datetime(),
  filters_applied: z.record(z.unknown()),
});

export type AuditDataExportedPayload = z.infer<typeof AuditDataExportedPayloadSchema>;
```

### 7.56 packages/shared-events/src/schemas/audit/index.ts

```typescript
export * from './audit-recorded.schema';
export * from './audit-access-denied.schema';
export * from './audit-data-exported.schema';
```

### 7.57 packages/shared-events/src/schemas/books/ledger-entry-posted.schema.ts

```typescript
import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money';

export const LedgerEntryPostedPayloadSchema = z.object({
  entry_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  account_code: z.string().min(1).max(20),
  debit_dirham: MoneyDirhamSchema,
  credit_dirham: MoneyDirhamSchema,
  description: z.string().max(500),
  posted_at: z.string().datetime(),
  posted_by_user_id: z.string().uuid(),
  period_id: z.string().uuid(),
});

export type LedgerEntryPostedPayload = z.infer<typeof LedgerEntryPostedPayloadSchema>;
```

### 7.58 packages/shared-events/src/schemas/books/period-closed.schema.ts

```typescript
import { z } from 'zod';

export const PeriodClosedPayloadSchema = z.object({
  period_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  period_start: z.string().date(),
  period_end: z.string().date(),
  closed_at: z.string().datetime(),
  closed_by_user_id: z.string().uuid(),
  total_entries: z.number().int().min(0),
});

export type PeriodClosedPayload = z.infer<typeof PeriodClosedPayloadSchema>;
```

### 7.59 packages/shared-events/src/schemas/books/index.ts

```typescript
export * from './ledger-entry-posted.schema';
export * from './period-closed.schema';
```

### 7.60 packages/shared-events/src/schemas/stock/stock-adjusted.schema.ts

```typescript
import { z } from 'zod';

export const StockAdjustedPayloadSchema = z.object({
  adjustment_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity_delta: z.number().int(),
  reason: z.enum(['inventory_count', 'damaged', 'lost', 'returned', 'manual_correction']),
  adjusted_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type StockAdjustedPayload = z.infer<typeof StockAdjustedPayloadSchema>;
```

### 7.61 packages/shared-events/src/schemas/stock/stock-movement-recorded.schema.ts

```typescript
import { z } from 'zod';

export const StockMovementRecordedPayloadSchema = z.object({
  movement_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  product_id: z.string().uuid(),
  from_warehouse_id: z.string().uuid().nullable(),
  to_warehouse_id: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
  movement_type: z.enum(['receipt', 'shipment', 'transfer', 'return']),
  recorded_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type StockMovementRecordedPayload = z.infer<typeof StockMovementRecordedPayloadSchema>;
```

### 7.62 packages/shared-events/src/schemas/stock/index.ts

```typescript
export * from './stock-adjusted.schema';
export * from './stock-movement-recorded.schema';
```

### 7.63 packages/shared-events/src/schemas/hr/employee-onboarded.schema.ts

```typescript
import { z } from 'zod';

export const EmployeeOnboardedPayloadSchema = z.object({
  employee_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  job_title: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  hire_date: z.string().date(),
  onboarded_at: z.string().datetime(),
  manager_user_id: z.string().uuid().nullable(),
});

export type EmployeeOnboardedPayload = z.infer<typeof EmployeeOnboardedPayloadSchema>;
```

### 7.64 packages/shared-events/src/schemas/hr/employee-offboarded.schema.ts

```typescript
import { z } from 'zod';

export const EmployeeOffboardedPayloadSchema = z.object({
  employee_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  termination_date: z.string().date(),
  reason: z.enum(['resignation', 'termination_with_cause', 'termination_without_cause', 'retirement', 'mutual_agreement']),
  offboarded_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type EmployeeOffboardedPayload = z.infer<typeof EmployeeOffboardedPayloadSchema>;
```

### 7.65 packages/shared-events/src/schemas/hr/index.ts

```typescript
export * from './employee-onboarded.schema';
export * from './employee-offboarded.schema';
```

### 7.66 packages/shared-events/src/schemas/system/system-error-raised.schema.ts

```typescript
import { z } from 'zod';

export const SystemErrorRaisedPayloadSchema = z.object({
  error_id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  service_name: z.string().min(1).max(100),
  error_class: z.string().min(1).max(200),
  error_message: z.string().max(2048),
  stack_trace: z.string().max(16384).nullable(),
  occurred_at: z.string().datetime(),
  severity: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
});

export type SystemErrorRaisedPayload = z.infer<typeof SystemErrorRaisedPayloadSchema>;
```

### 7.67 packages/shared-events/src/schemas/system/system-health-changed.schema.ts

```typescript
import { z } from 'zod';

export const SystemHealthChangedPayloadSchema = z.object({
  service_name: z.string().min(1).max(100),
  previous_status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  current_status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  changed_at: z.string().datetime(),
  metrics: z.record(z.number()),
});

export type SystemHealthChangedPayload = z.infer<typeof SystemHealthChangedPayloadSchema>;
```

### 7.68 packages/shared-events/src/schemas/system/system-config-updated.schema.ts

```typescript
import { z } from 'zod';

export const SystemConfigUpdatedPayloadSchema = z.object({
  config_key: z.string().min(1).max(200),
  previous_value: z.unknown().nullable(),
  new_value: z.unknown(),
  updated_at: z.string().datetime(),
  updated_by_user_id: z.string().uuid().nullable(),
});

export type SystemConfigUpdatedPayload = z.infer<typeof SystemConfigUpdatedPayloadSchema>;
```

### 7.69 packages/shared-events/src/schemas/system/index.ts

```typescript
export * from './system-error-raised.schema';
export * from './system-health-changed.schema';
export * from './system-config-updated.schema';
```

### 7.70 packages/shared-events/src/schemas/index.ts

```typescript
import { z } from 'zod';
import { Topics } from '../topics';

// Auth
import { UserCreatedPayloadSchema } from './auth/user-created.schema';
import { UserSignedInPayloadSchema } from './auth/user-signed-in.schema';
import { UserSignedOutPayloadSchema } from './auth/user-signed-out.schema';
import { UserLockedPayloadSchema } from './auth/user-locked.schema';
import { UserUnlockedPayloadSchema } from './auth/user-unlocked.schema';
import { UserPasswordResetRequestedPayloadSchema } from './auth/user-password-reset-requested.schema';
import { UserMfaEnabledPayloadSchema } from './auth/user-mfa-enabled.schema';

// CRM
import { ContactCreatedPayloadSchema } from './crm/contact-created.schema';
import { ContactUpdatedPayloadSchema } from './crm/contact-updated.schema';
import { DealCreatedPayloadSchema } from './crm/deal-created.schema';
import { DealStageChangedPayloadSchema } from './crm/deal-stage-changed.schema';
import { InteractionRecordedPayloadSchema } from './crm/interaction-recorded.schema';
import { InteractionEmailReceivedPayloadSchema } from './crm/interaction-email-received.schema';

// Booking
import { BookingCreatedPayloadSchema } from './booking/booking-created.schema';
import { BookingConfirmedPayloadSchema } from './booking/booking-confirmed.schema';
import { BookingCancelledPayloadSchema } from './booking/booking-cancelled.schema';

// Comm
import { MessageSentPayloadSchema } from './comm/message-sent.schema';
import { MessageDeliveredPayloadSchema } from './comm/message-delivered.schema';
import { MessageFailedPayloadSchema } from './comm/message-failed.schema';
import { MessageBouncedPayloadSchema } from './comm/message-bounced.schema';
import { WhatsappInboundPayloadSchema } from './comm/whatsapp-inbound.schema';
import { SmsInboundPayloadSchema } from './comm/sms-inbound.schema';
import { EmailInboundPayloadSchema } from './comm/email-inbound.schema';
import { NotificationPushedPayloadSchema } from './comm/notification-pushed.schema';

// Pay
import { TransactionInitiatedPayloadSchema } from './pay/transaction-initiated.schema';
import { TransactionCompletedPayloadSchema } from './pay/transaction-completed.schema';
import { TransactionFailedPayloadSchema } from './pay/transaction-failed.schema';
import { TransactionRefundedPayloadSchema } from './pay/transaction-refunded.schema';
import { InvoiceIssuedPayloadSchema } from './pay/invoice-issued.schema';
import { InvoicePaidPayloadSchema } from './pay/invoice-paid.schema';

// Insure
import { QuoteRequestedPayloadSchema } from './insure/quote-requested.schema';
import { QuoteIssuedPayloadSchema } from './insure/quote-issued.schema';
import { PolicySignedPayloadSchema } from './insure/policy-signed.schema';
import { PolicyRenewedPayloadSchema } from './insure/policy-renewed.schema';

// Repair
import { SinistreDeclaredPayloadSchema } from './repair/sinistre-declared.schema';
import { SinistreAssignedPayloadSchema } from './repair/sinistre-assigned.schema';
import { SinistreClosedPayloadSchema } from './repair/sinistre-closed.schema';

// Audit
import { AuditRecordedPayloadSchema } from './audit/audit-recorded.schema';
import { AuditAccessDeniedPayloadSchema } from './audit/audit-access-denied.schema';
import { AuditDataExportedPayloadSchema } from './audit/audit-data-exported.schema';

// Books
import { LedgerEntryPostedPayloadSchema } from './books/ledger-entry-posted.schema';
import { PeriodClosedPayloadSchema } from './books/period-closed.schema';

// Stock
import { StockAdjustedPayloadSchema } from './stock/stock-adjusted.schema';
import { StockMovementRecordedPayloadSchema } from './stock/stock-movement-recorded.schema';

// HR
import { EmployeeOnboardedPayloadSchema } from './hr/employee-onboarded.schema';
import { EmployeeOffboardedPayloadSchema } from './hr/employee-offboarded.schema';

// System
import { SystemErrorRaisedPayloadSchema } from './system/system-error-raised.schema';
import { SystemHealthChangedPayloadSchema } from './system/system-health-changed.schema';
import { SystemConfigUpdatedPayloadSchema } from './system/system-config-updated.schema';

export * from './auth';
export * from './crm';
export * from './booking';
export * from './comm';
export * from './pay';
export * from './insure';
export * from './repair';
export * from './audit';
export * from './books';
export * from './stock';
export * from './hr';
export * from './system';

/**
 * Source unique de verite : mapping Topic -> Schema Zod payload.
 * Toute valeur ajoutee dans Topics enum DOIT etre presente ici.
 * Le test integration topic-schema-completeness.spec.ts verifie l'invariant.
 */
export const topicSchemaMap: Record<Topics, z.ZodTypeAny> = {
  // Auth
  [Topics.AUTH_USER_CREATED]: UserCreatedPayloadSchema,
  [Topics.AUTH_USER_SIGNED_IN]: UserSignedInPayloadSchema,
  [Topics.AUTH_USER_SIGNED_OUT]: UserSignedOutPayloadSchema,
  [Topics.AUTH_USER_LOCKED]: UserLockedPayloadSchema,
  [Topics.AUTH_USER_UNLOCKED]: UserUnlockedPayloadSchema,
  [Topics.AUTH_USER_PASSWORD_RESET_REQUESTED]: UserPasswordResetRequestedPayloadSchema,
  [Topics.AUTH_USER_MFA_ENABLED]: UserMfaEnabledPayloadSchema,
  // CRM
  [Topics.CRM_CONTACT_CREATED]: ContactCreatedPayloadSchema,
  [Topics.CRM_CONTACT_UPDATED]: ContactUpdatedPayloadSchema,
  [Topics.CRM_DEAL_CREATED]: DealCreatedPayloadSchema,
  [Topics.CRM_DEAL_STAGE_CHANGED]: DealStageChangedPayloadSchema,
  [Topics.CRM_INTERACTION_RECORDED]: InteractionRecordedPayloadSchema,
  [Topics.CRM_INTERACTION_EMAIL_RECEIVED]: InteractionEmailReceivedPayloadSchema,
  // Booking
  [Topics.BOOKING_CREATED]: BookingCreatedPayloadSchema,
  [Topics.BOOKING_CONFIRMED]: BookingConfirmedPayloadSchema,
  [Topics.BOOKING_CANCELLED]: BookingCancelledPayloadSchema,
  // Comm
  [Topics.COMM_MESSAGE_SENT]: MessageSentPayloadSchema,
  [Topics.COMM_MESSAGE_DELIVERED]: MessageDeliveredPayloadSchema,
  [Topics.COMM_MESSAGE_FAILED]: MessageFailedPayloadSchema,
  [Topics.COMM_MESSAGE_BOUNCED]: MessageBouncedPayloadSchema,
  [Topics.COMM_WHATSAPP_INBOUND]: WhatsappInboundPayloadSchema,
  [Topics.COMM_SMS_INBOUND]: SmsInboundPayloadSchema,
  [Topics.COMM_EMAIL_INBOUND]: EmailInboundPayloadSchema,
  [Topics.COMM_NOTIFICATION_PUSHED]: NotificationPushedPayloadSchema,
  // Pay
  [Topics.PAY_TRANSACTION_INITIATED]: TransactionInitiatedPayloadSchema,
  [Topics.PAY_TRANSACTION_COMPLETED]: TransactionCompletedPayloadSchema,
  [Topics.PAY_TRANSACTION_FAILED]: TransactionFailedPayloadSchema,
  [Topics.PAY_TRANSACTION_REFUNDED]: TransactionRefundedPayloadSchema,
  [Topics.PAY_INVOICE_ISSUED]: InvoiceIssuedPayloadSchema,
  [Topics.PAY_INVOICE_PAID]: InvoicePaidPayloadSchema,
  // Insure
  [Topics.INSURE_QUOTE_REQUESTED]: QuoteRequestedPayloadSchema,
  [Topics.INSURE_QUOTE_ISSUED]: QuoteIssuedPayloadSchema,
  [Topics.INSURE_POLICY_SIGNED]: PolicySignedPayloadSchema,
  [Topics.INSURE_POLICY_RENEWED]: PolicyRenewedPayloadSchema,
  // Repair
  [Topics.REPAIR_SINISTRE_DECLARED]: SinistreDeclaredPayloadSchema,
  [Topics.REPAIR_SINISTRE_ASSIGNED]: SinistreAssignedPayloadSchema,
  [Topics.REPAIR_SINISTRE_CLOSED]: SinistreClosedPayloadSchema,
  // Audit
  [Topics.AUDIT_RECORDED]: AuditRecordedPayloadSchema,
  [Topics.AUDIT_ACCESS_DENIED]: AuditAccessDeniedPayloadSchema,
  [Topics.AUDIT_DATA_EXPORTED]: AuditDataExportedPayloadSchema,
  // Books
  [Topics.BOOKS_LEDGER_ENTRY_POSTED]: LedgerEntryPostedPayloadSchema,
  [Topics.BOOKS_PERIOD_CLOSED]: PeriodClosedPayloadSchema,
  // Stock
  [Topics.STOCK_ADJUSTED]: StockAdjustedPayloadSchema,
  [Topics.STOCK_MOVEMENT_RECORDED]: StockMovementRecordedPayloadSchema,
  // HR
  [Topics.HR_EMPLOYEE_ONBOARDED]: EmployeeOnboardedPayloadSchema,
  [Topics.HR_EMPLOYEE_OFFBOARDED]: EmployeeOffboardedPayloadSchema,
  // System
  [Topics.SYSTEM_ERROR_RAISED]: SystemErrorRaisedPayloadSchema,
  [Topics.SYSTEM_HEALTH_CHANGED]: SystemHealthChangedPayloadSchema,
  [Topics.SYSTEM_CONFIG_UPDATED]: SystemConfigUpdatedPayloadSchema,
};

/**
 * Mapping inverse pour debug : event_name -> Topic enum.
 */
export const topicEventNameMap: Map<string, Topics> = new Map(
  Object.values(Topics).map((t) => [t as string, t]),
);
```

### 7.71 packages/shared-events/src/helpers/build-event-id.ts

```typescript
import { ulid, monotonicFactory } from 'ulid';

const monotonic = monotonicFactory();

/**
 * Genere un ULID 26 caracteres base32 Crockford.
 * Utilise monotonicFactory pour garantir l'ordre intra-milliseconde
 * meme en cas de generation rafale.
 *
 * Format : TTTTTTTTTTRRRRRRRRRRRRRRRR
 *  - 10 chars timestamp (millisecondes depuis epoch)
 *  - 16 chars random (cryptographiquement aleatoire)
 *
 * Garanties :
 *  - regex match /^[0-9A-HJKMNP-TV-Z]{26}$/
 *  - sortable lexicographiquement (timestamp prefix)
 *  - monotonic intra-process (meme ms = sequence incrementee)
 *  - URL-safe (pas de caracteres speciaux)
 */
export function buildEventId(seedTime?: number): string {
  if (seedTime !== undefined) {
    return monotonic(seedTime);
  }
  return monotonic();
}

/**
 * Variante non-monotonic pour cas tests ou determinisme requis.
 */
export function buildEventIdNonMonotonic(): string {
  return ulid();
}

/**
 * Extrait le timestamp ms d'un ULID.
 */
export function extractTimestampFromUlid(eventId: string): number {
  if (eventId.length !== 26) {
    throw new Error(`Invalid ULID length: expected 26, got ${eventId.length}`);
  }
  const timePart = eventId.substring(0, 10);
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timestamp = 0;
  for (let i = 0; i < timePart.length; i++) {
    const char = timePart[i];
    const value = ENCODING.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid ULID character: ${char}`);
    }
    timestamp = timestamp * 32 + value;
  }
  return timestamp;
}
```

### 7.72 packages/shared-events/src/helpers/validate-event.ts

```typescript
import { z } from 'zod';
import { Topics, isKnownTopic } from '../topics';
import { topicSchemaMap } from '../schemas';
import { EventEnvelopeSchema, EventEnvelope } from '../types/event-envelope';

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationFailure = {
  success: false;
  error: z.ZodError;
  message: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Valide un payload contre le schema correspondant au topic.
 * Retourne discriminated union pour controle flux explicite.
 */
export function validateEventPayload<T = unknown>(
  topic: Topics,
  payload: unknown,
): ValidationResult<T> {
  const schema = topicSchemaMap[topic];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          path: ['topic'],
          message: `No schema registered for topic ${topic}`,
        },
      ]),
      message: `No schema registered for topic ${topic}`,
    };
  }
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  return {
    success: false,
    error: result.error,
    message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}

/**
 * Valide une envelope complete (header + payload via topic).
 */
export function validateEventEnvelope<T = unknown>(
  raw: unknown,
): ValidationResult<EventEnvelope<T>> {
  const envelopeResult = EventEnvelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    return {
      success: false,
      error: envelopeResult.error,
      message: 'Envelope structure invalid: ' + envelopeResult.error.issues.map((i) => i.message).join('; '),
    };
  }
  const envelope = envelopeResult.data;
  if (!isKnownTopic(envelope.event_name)) {
    return {
      success: false,
      error: new z.ZodError([
        { code: 'custom', path: ['event_name'], message: `Unknown topic: ${envelope.event_name}` },
      ]),
      message: `Unknown topic: ${envelope.event_name}`,
    };
  }
  const payloadValidation = validateEventPayload<T>(envelope.event_name, envelope.payload);
  if (!payloadValidation.success) {
    return payloadValidation;
  }
  return {
    success: true,
    data: { ...envelope, payload: payloadValidation.data } as EventEnvelope<T>,
  };
}
```

### 7.73 packages/shared-events/src/helpers/build-envelope.ts

```typescript
import { Topics } from '../topics';
import { EventEnvelope } from '../types/event-envelope';
import { buildEventId } from './build-event-id';

export interface BuildEnvelopeInput<T> {
  topic: Topics;
  payload: T;
  tenantId: string | null;
  userId: string | null;
  correlationId: string | null;
  eventVersion?: string;
  occurredAt?: Date;
}

/**
 * Construit une EventEnvelope conforme avec event_id ULID auto-genere.
 */
export function buildEnvelope<T>(input: BuildEnvelopeInput<T>): EventEnvelope<T> {
  return {
    event_id: buildEventId(),
    event_name: input.topic,
    event_version: input.eventVersion ?? '1.0',
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    tenant_id: input.tenantId,
    user_id: input.userId,
    correlation_id: input.correlationId,
    payload: input.payload,
  };
}
```

### 7.74 packages/shared-events/src/helpers/parse-envelope.ts

```typescript
import { EventEnvelope } from '../types/event-envelope';
import { validateEventEnvelope } from './validate-event';

/**
 * Parse Buffer ou string Kafka en EventEnvelope validee.
 * Throw si invalide (utilise par KafkaConsumerBase qui catch et envoie en DLQ).
 */
export function parseEnvelopeFromKafka<T = unknown>(raw: Buffer | string | null): EventEnvelope<T> {
  if (raw === null) {
    throw new Error('Kafka message value is null');
  }
  const text = typeof raw === 'string' ? raw : raw.toString('utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in Kafka message: ${(err as Error).message}`);
  }
  const result = validateEventEnvelope<T>(parsed);
  if (!result.success) {
    throw new Error(`Envelope validation failed: ${result.message}`);
  }
  return result.data;
}
```

### 7.75 packages/shared-events/src/helpers/index.ts

```typescript
export * from './build-event-id';
export * from './validate-event';
export * from './build-envelope';
export * from './parse-envelope';
```

### 7.76 packages/shared-events/src/index.ts

```typescript
export * from './topics';
export * from './types/event-envelope';
export * from './types/shared/money';
export * from './types/shared/locale';
export * from './types/shared/ulid';
export * from './schemas';
export * from './helpers';
```

## 8. Tests complets

### 8.1 test/schemas/auth/user-signed-in.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { UserSignedInPayloadSchema } from '../../../src/schemas/auth/user-signed-in.schema';

describe('UserSignedInPayloadSchema', () => {
  const validPayload = {
    user_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    signin_method: 'password',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    signed_in_at: '2026-05-05T12:00:00.000Z',
    session_id: '33333333-3333-4333-9333-333333333333',
    device_fingerprint: null,
    geo_country: null,
    geo_city: null,
  };

  it('accepts a valid payload', () => {
    expect(UserSignedInPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects missing user_id', () => {
    const { user_id, ...rest } = validPayload;
    expect(UserSignedInPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid user_id format', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, user_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects unknown signin_method', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, signin_method: 'biometric' }).success).toBe(false);
  });

  it('accepts ipv4 address', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, ip_address: '10.0.0.1' }).success).toBe(true);
  });

  it('accepts ipv6 address', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, ip_address: '2001:db8::1' }).success).toBe(true);
  });

  it('rejects user_agent over 1024 chars', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, user_agent: 'x'.repeat(1025) }).success).toBe(false);
  });

  it('accepts geo_country with 2-letter code', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, geo_country: 'MA' }).success).toBe(true);
  });

  it('rejects geo_country longer than 2', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, geo_country: 'MAR' }).success).toBe(false);
  });
});
```

### 8.2 test/schemas/auth/user-created.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { UserCreatedPayloadSchema } from '../../../src/schemas/auth/user-created.schema';

describe('UserCreatedPayloadSchema', () => {
  const valid = {
    user_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    email: 'admin@example.ma',
    full_name: 'Admin User',
    role: 'admin',
    locale: 'fr-MA',
    created_at: '2026-05-05T12:00:00.000Z',
    created_by_user_id: null,
    invitation_token_hash: null,
  };

  it('accepts valid payload', () => {
    expect(UserCreatedPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(UserCreatedPayloadSchema.safeParse({ ...valid, email: 'not-email' }).success).toBe(false);
  });

  it('rejects unknown role', () => {
    expect(UserCreatedPayloadSchema.safeParse({ ...valid, role: 'god' }).success).toBe(false);
  });

  it('accepts ar-MA locale', () => {
    expect(UserCreatedPayloadSchema.safeParse({ ...valid, locale: 'ar-MA' }).success).toBe(true);
  });

  it('rejects unknown locale', () => {
    expect(UserCreatedPayloadSchema.safeParse({ ...valid, locale: 'es-ES' }).success).toBe(false);
  });

  it('rejects empty full_name', () => {
    expect(UserCreatedPayloadSchema.safeParse({ ...valid, full_name: '' }).success).toBe(false);
  });
});
```

### 8.3 test/schemas/auth/user-locked.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { UserLockedPayloadSchema } from '../../../src/schemas/auth/user-locked.schema';

describe('UserLockedPayloadSchema', () => {
  const valid = {
    user_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    reason: 'too_many_failed_attempts',
    failed_attempts_count: 5,
    locked_at: '2026-05-05T12:00:00.000Z',
    locked_until: '2026-05-05T13:00:00.000Z',
    locked_by_user_id: null,
    notes: null,
  };

  it('accepts valid payload', () => {
    expect(UserLockedPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects negative failed_attempts_count', () => {
    expect(UserLockedPayloadSchema.safeParse({ ...valid, failed_attempts_count: -1 }).success).toBe(false);
  });

  it('rejects non-integer failed_attempts_count', () => {
    expect(UserLockedPayloadSchema.safeParse({ ...valid, failed_attempts_count: 1.5 }).success).toBe(false);
  });

  it('accepts null locked_until', () => {
    expect(UserLockedPayloadSchema.safeParse({ ...valid, locked_until: null }).success).toBe(true);
  });

  it('rejects unknown reason', () => {
    expect(UserLockedPayloadSchema.safeParse({ ...valid, reason: 'wrong_reason' }).success).toBe(false);
  });
});
```

### 8.4 test/schemas/crm/contact-created.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { ContactCreatedPayloadSchema } from '../../../src/schemas/crm/contact-created.schema';

describe('ContactCreatedPayloadSchema', () => {
  const valid = {
    contact_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    full_name: 'Mohamed Bennani',
    email: 'm.bennani@example.ma',
    phone: '+212600000000',
    preferred_language: 'fr-MA',
    preferred_channel: 'whatsapp',
    source: 'whatsapp_inbound',
    created_at: '2026-05-05T12:00:00.000Z',
    created_by_user_id: '33333333-3333-4333-9333-333333333333',
  };

  it('accepts valid payload', () => {
    expect(ContactCreatedPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts null email', () => {
    expect(ContactCreatedPayloadSchema.safeParse({ ...valid, email: null }).success).toBe(true);
  });

  it('rejects invalid phone format', () => {
    expect(ContactCreatedPayloadSchema.safeParse({ ...valid, phone: '0600000000' }).success).toBe(false);
  });

  it('accepts ar-MA preferred_language', () => {
    expect(ContactCreatedPayloadSchema.safeParse({ ...valid, preferred_language: 'ar-MA' }).success).toBe(true);
  });

  it('accepts sms preferred_channel', () => {
    expect(ContactCreatedPayloadSchema.safeParse({ ...valid, preferred_channel: 'sms' }).success).toBe(true);
  });

  it('rejects unknown source', () => {
    expect(ContactCreatedPayloadSchema.safeParse({ ...valid, source: 'pigeon' }).success).toBe(false);
  });
});
```

### 8.5 test/schemas/crm/deal-stage-changed.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { DealStageChangedPayloadSchema } from '../../../src/schemas/crm/deal-stage-changed.schema';

describe('DealStageChangedPayloadSchema', () => {
  const valid = {
    deal_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    from_stage: 'discovery',
    to_stage: 'proposal',
    amount_dirham: '15000.00',
    by_user_id: '33333333-3333-4333-9333-333333333333',
    changed_at: '2026-05-05T12:00:00.000Z',
    reason: null,
  };

  it('accepts valid payload', () => {
    expect(DealStageChangedPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects amount_dirham as number', () => {
    expect(DealStageChangedPayloadSchema.safeParse({ ...valid, amount_dirham: 15000 }).success).toBe(false);
  });

  it('rejects amount_dirham too large', () => {
    expect(DealStageChangedPayloadSchema.safeParse({ ...valid, amount_dirham: '9999999999.99' }).success).toBe(false);
  });

  it('accepts amount_dirham 0', () => {
    expect(DealStageChangedPayloadSchema.safeParse({ ...valid, amount_dirham: '0.00' }).success).toBe(true);
  });
});
```

### 8.6 test/schemas/comm/message-sent.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { MessageSentPayloadSchema } from '../../../src/schemas/comm/message-sent.schema';

describe('MessageSentPayloadSchema', () => {
  const valid = {
    message_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    channel: 'whatsapp',
    to_address: '+212600000000',
    from_address: null,
    template_id: null,
    provider: 'meta_whatsapp',
    provider_message_id: 'wamid.HBgM',
    sent_at: '2026-05-05T12:00:00.000Z',
    related_resource_type: null,
    related_resource_id: null,
  };

  it('accepts valid payload', () => {
    expect(MessageSentPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown channel', () => {
    expect(MessageSentPayloadSchema.safeParse({ ...valid, channel: 'fax' }).success).toBe(false);
  });

  it('rejects unknown provider', () => {
    expect(MessageSentPayloadSchema.safeParse({ ...valid, provider: 'unknown' }).success).toBe(false);
  });

  it('accepts twilio provider with sms channel', () => {
    expect(
      MessageSentPayloadSchema.safeParse({ ...valid, channel: 'sms', provider: 'twilio' }).success,
    ).toBe(true);
  });

  it('accepts template_id uuid', () => {
    expect(
      MessageSentPayloadSchema.safeParse({ ...valid, template_id: '44444444-4444-4444-9444-444444444444' }).success,
    ).toBe(true);
  });

  it('rejects empty to_address', () => {
    expect(MessageSentPayloadSchema.safeParse({ ...valid, to_address: '' }).success).toBe(false);
  });
});
```

### 8.7 test/helpers/build-event-id.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { buildEventId, buildEventIdNonMonotonic, extractTimestampFromUlid } from '../../src/helpers/build-event-id';
import { ULID_REGEX } from '../../src/types/event-envelope';

describe('buildEventId', () => {
  it('returns 26-char string', () => {
    expect(buildEventId().length).toBe(26);
  });

  it('matches ULID regex Crockford base32', () => {
    expect(ULID_REGEX.test(buildEventId())).toBe(true);
  });

  it('does not contain excluded chars I, L, O, U', () => {
    const id = buildEventId();
    expect(id).not.toMatch(/[ILOU]/);
  });

  it('produces monotonic ordering for rapid calls', () => {
    const ids = Array.from({ length: 100 }, () => buildEventId());
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });

  it('non-monotonic also matches regex', () => {
    expect(ULID_REGEX.test(buildEventIdNonMonotonic())).toBe(true);
  });

  it('extracts timestamp matching seedTime', () => {
    const seed = Date.UTC(2026, 4, 5, 12, 0, 0);
    const id = buildEventId(seed);
    const extracted = extractTimestampFromUlid(id);
    expect(extracted).toBe(seed);
  });
});
```

### 8.8 test/helpers/validate-event.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { validateEventPayload, validateEventEnvelope } from '../../src/helpers/validate-event';
import { Topics } from '../../src/topics';
import { buildEnvelope } from '../../src/helpers/build-envelope';

describe('validateEventPayload', () => {
  it('validates a known topic with correct payload', () => {
    const result = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, {
      user_id: '11111111-1111-4111-9111-111111111111',
      tenant_id: '22222222-2222-4222-9222-222222222222',
      signin_method: 'password',
      ip_address: '10.0.0.1',
      user_agent: 'Test',
      signed_in_at: '2026-05-05T12:00:00.000Z',
      session_id: '33333333-3333-4333-9333-333333333333',
      device_fingerprint: null,
      geo_country: null,
      geo_city: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects payload missing required field', () => {
    const result = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, { user_id: '11111111-1111-4111-9111-111111111111' });
    expect(result.success).toBe(false);
  });

  it('rejects payload with wrong type', () => {
    const result = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, { user_id: 12345 });
    expect(result.success).toBe(false);
  });

  it('rejects undefined payload', () => {
    const result = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, undefined);
    expect(result.success).toBe(false);
  });

  it('returns explicit message in failure', () => {
    const result = validateEventPayload(Topics.CRM_CONTACT_CREATED, {});
    if (result.success) throw new Error('expected failure');
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('validateEventEnvelope', () => {
  it('validates complete envelope', () => {
    const envelope = buildEnvelope({
      topic: Topics.SYSTEM_HEALTH_CHANGED,
      payload: {
        service_name: 'auth',
        previous_status: 'healthy',
        current_status: 'degraded',
        changed_at: '2026-05-05T12:00:00.000Z',
        metrics: { latency_ms: 250 },
      },
      tenantId: null,
      userId: null,
      correlationId: null,
    });
    const result = validateEventEnvelope(envelope);
    expect(result.success).toBe(true);
  });

  it('rejects envelope with unknown topic', () => {
    const result = validateEventEnvelope({
      event_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      event_name: 'insurtech.events.unknown.thing.happened',
      event_version: '1.0',
      occurred_at: '2026-05-05T12:00:00.000Z',
      tenant_id: null,
      user_id: null,
      correlation_id: null,
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects envelope with invalid event_id', () => {
    const result = validateEventEnvelope({
      event_id: 'not-a-ulid',
      event_name: Topics.SYSTEM_HEALTH_CHANGED,
      event_version: '1.0',
      occurred_at: '2026-05-05T12:00:00.000Z',
      tenant_id: null,
      user_id: null,
      correlation_id: null,
      payload: {},
    });
    expect(result.success).toBe(false);
  });
});
```

### 8.9 test/helpers/build-envelope.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { buildEnvelope } from '../../src/helpers/build-envelope';
import { Topics } from '../../src/topics';
import { ULID_REGEX } from '../../src/types/event-envelope';

describe('buildEnvelope', () => {
  const tenantId = '22222222-2222-4222-9222-222222222222';

  it('generates ULID event_id', () => {
    const e = buildEnvelope({
      topic: Topics.SYSTEM_CONFIG_UPDATED,
      payload: { config_key: 'k', previous_value: null, new_value: 1, updated_at: '2026-05-05T12:00:00.000Z', updated_by_user_id: null },
      tenantId,
      userId: null,
      correlationId: null,
    });
    expect(ULID_REGEX.test(e.event_id)).toBe(true);
  });

  it('defaults event_version to 1.0', () => {
    const e = buildEnvelope({
      topic: Topics.SYSTEM_CONFIG_UPDATED,
      payload: {} as never,
      tenantId,
      userId: null,
      correlationId: null,
    });
    expect(e.event_version).toBe('1.0');
  });

  it('passes through custom event_version', () => {
    const e = buildEnvelope({
      topic: Topics.SYSTEM_CONFIG_UPDATED,
      payload: {} as never,
      tenantId,
      userId: null,
      correlationId: null,
      eventVersion: '2.1',
    });
    expect(e.event_version).toBe('2.1');
  });

  it('emits ISO datetime for occurred_at', () => {
    const e = buildEnvelope({
      topic: Topics.SYSTEM_CONFIG_UPDATED,
      payload: {} as never,
      tenantId,
      userId: null,
      correlationId: null,
    });
    expect(() => new Date(e.occurred_at).toISOString()).not.toThrow();
  });

  it('event_name equals topic', () => {
    const e = buildEnvelope({
      topic: Topics.AUTH_USER_SIGNED_IN,
      payload: {} as never,
      tenantId,
      userId: null,
      correlationId: null,
    });
    expect(e.event_name).toBe(Topics.AUTH_USER_SIGNED_IN);
  });
});
```

### 8.10 test/integration/topic-schema-completeness.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { Topics } from '../../src/topics';
import { topicSchemaMap } from '../../src/schemas';

describe('topicSchemaMap completeness invariant', () => {
  it('every Topics enum value has a schema in the map', () => {
    for (const topic of Object.values(Topics)) {
      expect(topicSchemaMap[topic]).toBeDefined();
    }
  });

  it('topicSchemaMap has at least 53 entries', () => {
    expect(Object.keys(topicSchemaMap).length).toBeGreaterThanOrEqual(53);
  });

  it('topicSchemaMap has exactly the same keys as Topics enum', () => {
    const enumValues = new Set(Object.values(Topics) as string[]);
    const mapKeys = new Set(Object.keys(topicSchemaMap));
    expect(mapKeys.size).toBe(enumValues.size);
    for (const v of enumValues) {
      expect(mapKeys.has(v)).toBe(true);
    }
  });

  it('every schema is a Zod schema instance', () => {
    for (const schema of Object.values(topicSchemaMap)) {
      expect(typeof (schema as { parse?: unknown }).parse).toBe('function');
      expect(typeof (schema as { safeParse?: unknown }).safeParse).toBe('function');
    }
  });
});
```

### 8.11 test/integration/types-inference.spec.ts

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type { EventEnvelope } from '../../src/types/event-envelope';
import type { UserSignedInPayload } from '../../src/schemas/auth/user-signed-in.schema';
import type { ContactCreatedPayload } from '../../src/schemas/crm/contact-created.schema';

describe('types inference', () => {
  it('EventEnvelope generic carries payload type', () => {
    expectTypeOf<EventEnvelope<UserSignedInPayload>['payload']>().toEqualTypeOf<UserSignedInPayload>();
  });

  it('UserSignedInPayload has user_id string', () => {
    expectTypeOf<UserSignedInPayload['user_id']>().toEqualTypeOf<string>();
  });

  it('ContactCreatedPayload has nullable email', () => {
    expectTypeOf<ContactCreatedPayload['email']>().toEqualTypeOf<string | null>();
  });

  it('EventEnvelope has correlation_id nullable', () => {
    expectTypeOf<EventEnvelope['correlation_id']>().toEqualTypeOf<string | null>();
  });
});
```

## 9. Variables d'environnement

| Variable | Defaut | Role | Niveau |
|----------|--------|------|--------|
| KAFKA_BROKERS | `localhost:9092` | Liste brokers Kafka separes virgule (consomme par 1.2.12, pas par shared-events lui-meme) | runtime |
| KAFKA_CLIENT_ID | `insurtech-svc` | ClientId KafkaJS instance | runtime |
| EVENT_VERSION_DEFAULT | `1.0` | Valeur par defaut event_version envelope | runtime |
| EVENT_ID_GENERATOR | `ulid` | Strategie generation event_id (alternatives futures uuid_v7) | runtime |
| EVENT_VALIDATION_STRICT | `true` | Si true throw au publish si schema invalide, sinon log warning | runtime |
| EVENT_VALIDATION_AT_CONSUME | `true` | Si true valide envelope a la consommation Kafka | runtime |
| ASYNC_LOCAL_STORAGE_TENANT_KEY | `tenant_id` | Clef ALS pour propagation auto tenant_id | runtime |
| ASYNC_LOCAL_STORAGE_CORRELATION_KEY | `correlation_id` | Clef ALS pour propagation auto correlation_id | runtime |
| ASYNC_LOCAL_STORAGE_USER_KEY | `user_id` | Clef ALS pour propagation auto user_id | runtime |
| EVENT_LOG_FAILED_VALIDATION | `true` | Logue les payloads invalides via Pino | runtime |
| EVENT_DLQ_TOPIC_PREFIX | `insurtech.dlq.` | Prefixe topics DLQ pour events qui echouent validation | runtime |
| TZ | `UTC` | Forcer timezone process Node a UTC pour datetime ISO normalises | runtime |

Aucune variable n'est consommee par le package shared-events lui-meme (TypeScript pur sans runtime) ; elles configurent les consommateurs (KafkaPublisher, KafkaConsumerBase) qui utilisent ce package.

## 10. Commandes shell

```bash
# Installation deps (depuis racine monorepo)
pnpm install

# Build du package
pnpm --filter @insurtech/shared-events build

# Tests unitaires + integration
pnpm --filter @insurtech/shared-events test

# Tests en mode watch
pnpm --filter @insurtech/shared-events test:watch

# Type-check sans emit
pnpm --filter @insurtech/shared-events typecheck

# Lint
pnpm --filter @insurtech/shared-events lint

# Format Prettier
pnpm --filter @insurtech/shared-events format

# Clean dist
pnpm --filter @insurtech/shared-events clean

# Verifier 53 topics minimum dans enum
node -e "const {Topics}=require('./packages/shared-events/dist'); console.log(Object.keys(Topics).length)"

# Verifier topicSchemaMap completeness
node -e "const {Topics, topicSchemaMap}=require('./packages/shared-events/dist'); for(const t of Object.values(Topics)){if(!topicSchemaMap[t]){console.error('missing',t);process.exit(1)}} console.log('OK')"

# Generer un ULID echantillon
node -e "const {buildEventId}=require('./packages/shared-events/dist'); console.log(buildEventId())"

# Coverage report
pnpm --filter @insurtech/shared-events test --coverage --coverage.reporter=html
```

## 11. Criteres de validation V1 a V32

### P0 (bloquants merge) -- 18 criteres

- **V1** : `pnpm build` reussit sans erreur TypeScript et emet `dist/index.js` + `dist/index.d.ts`
- **V2** : Enum Topics contient au moins 53 valeurs (47 actuelles + marge securite)
- **V3** : Tous les schemas listes dans la spec (auth 7 + crm 6 + booking 3 + comm 8 + pay 6 + insure 4 + repair 3 + audit 3 + books 2 + stock 2 + hr 2 + system 3 = 49 schemas) sont presents dans `src/schemas/`
- **V4** : `topicSchemaMap` contient une entree pour chaque valeur de `Topics` (test integration)
- **V5** : `validateEventPayload(topic, payload)` retourne `{success: true}` pour payload valide et `{success: false}` pour payload invalide
- **V6** : `buildEventId()` retourne string matchant `ULID_REGEX`
- **V7** : Type `EventEnvelope<T>` exporte avec generic payload functionnel
- **V8** : `EventEnvelopeSchema` valide event_id ULID 26 chars, event_version regex `\d+\.\d+`, occurred_at ISO datetime
- **V9** : Test `topic-schema-completeness.spec.ts` passe (chaque Topics a un schema)
- **V10** : Test `user-signed-in.spec.ts` >= 8 tests verts
- **V11** : Test `contact-created.spec.ts` >= 6 tests verts
- **V12** : Test `message-sent.spec.ts` >= 6 tests verts
- **V13** : Test `validate-event.spec.ts` >= 8 tests verts
- **V14** : Test `build-event-id.spec.ts` >= 6 tests verts (regex match, monotonic, length, base32, no IO/LU chars, timestamp extraction)
- **V15** : Coverage statements/branches/lines >= 80%
- **V16** : `pnpm typecheck` passe sans erreur TS strict
- **V17** : `pnpm lint` passe sans warning (max-warnings 0)
- **V18** : Aucune emoji detectee dans le code (grep CI sur src/ et test/)

### P1 (importants, non bloquants) -- 8 criteres

- **V19** : Helpers `getTopicVertical`, `getTopicEntity`, `getTopicAction` testes au moins 3 cas chacun
- **V20** : `parseEnvelopeFromKafka(buffer)` gere null, JSON invalide, validation echouee
- **V21** : `buildEnvelope()` accepte tous champs optionnels avec defauts senses
- **V22** : `extractTimestampFromUlid` retourne timestamp identique a seedTime fourni a `buildEventId`
- **V23** : MoneyDirhamSchema rejette format incorrect, valeur negative, depassement max
- **V24** : LocaleSchema accepte fr-MA, ar-MA, en-US, fr-FR uniquement
- **V25** : Tests types inference passent avec `expectTypeOf` Vitest
- **V26** : `package.json` exports map permet imports `@insurtech/shared-events/topics`, `/schemas`, `/helpers`

### P2 (nice-to-have) -- 6 criteres

- **V27** : Documentation TSDoc sur tous les types exportes
- **V28** : README.md du package documente patterns producteur/consommateur
- **V29** : Bench microbench safeParse 100k events < 5 secondes
- **V30** : `vitest.config.ts` configure path aliases pour imports relatifs
- **V31** : Snapshot test JSON serialization roundtrip envelope -> JSON.stringify -> JSON.parse -> validation
- **V32** : Conventional Commit message respecte format `feat(shared-events): init topics enum + zod schemas`

## 12. Edge cases

### 12.1 event_version semver breaking change 1.0 vers 2.0

Quand le payload `UserSignedInPayloadSchema` doit retirer un champ obligatoire (par exemple suppression de `geo_country` apres decision RGPD-MA), on ne peut pas modifier le schema en place : les consommateurs deployes avant le retrait continuent a recevoir des envelopes contenant le champ et leur copy locale du schema le validera (donc OK), mais les nouveaux consommateurs valideront strictement et un envelope contenant `geo_country` non declare passera quand meme tant que Zod n'est pas en mode strict (`.strict()`). Procedure : creer un nouveau schema `UserSignedInPayloadSchemaV2`, ajouter un nouveau topic `Topics.AUTH_USER_SIGNED_IN_V2` avec event_name correspondant, declarer `event_version: '2.0'` dans envelope, fan-out producteurs vers les deux topics pendant la migration. Documenter dans CHANGELOG.md.

### 12.2 ULID monotonic same milliseconde collision

Si deux appels `buildEventId()` se produisent dans la meme milliseconde, la lib ulid utilise un counter aleatoire incremente de 1 sur le precedent, garantissant `id_n+1 > id_n` lexicographiquement. Cas pathologique : 2^80 = 1.2*10^24 generations dans la meme ms saturent le counter et throw. Hautement improbable (Node fait ~10^7 ops/sec en hot loop). Le test `monotonic ordering for rapid calls` verifie 100 generations consecutives.

### 12.3 correlation_id propagation perdu cross-await

Sans AsyncLocalStorage configure (Sprint 1 a deja installe `cls-hooked` ou `node:async_hooks`), apres `await db.query(...)` le contexte de la requete HTTP entrante est perdu et le correlation_id non propage dans les events emis. shared-events n'arbitre pas ce probleme : il fait confiance au caller pour fournir `correlationId` a `buildEnvelope`. Le code Sprint 4 fournit un `EventEmitterService` injectable qui lit ALS et passe automatiquement.

### 12.4 schema circular imports

Si `auth/user-created.schema.ts` import `crm/contact-created.schema.ts` pour partager un type, le bundler peut se retrouver en deadlock module init. Regle : aucune dependance entre `schemas/<vertical>/` ; les types partages vont dans `types/shared/` (Money, Locale, Channel, Ulid).

### 12.5 payload Buffer versus string Kafka

KafkaJS expose `message.value: Buffer | null`. Le KafkaConsumerBase (1.2.13) doit appeler `value.toString('utf-8')` puis `JSON.parse` puis `validateEventEnvelope`. shared-events fournit `parseEnvelopeFromKafka(raw: Buffer | string | null)` qui gere les trois cas en un appel.

### 12.6 Zod safeParse perf 100k events

Microbench attendu : safeParse simple object 8 champs ~25 microsecondes par appel sur Node 20 / Apple M3. 100 000 events = 2.5 secondes, acceptable pour batch consumer. Pour hot path API HTTP synchron (publish KafkaJS), preferer `parse` qui throw direct (gain 2-3 microsecondes mais plus risque). Decision : safeParse partout pour robustesse, jamais parse.

### 12.7 peerDep kafkajs versus database

shared-events declare `kafkajs ^2.2.4` en peerDep. Si `@insurtech/database` (1.2.5) declare aussi `kafkajs ^2.2.4` en deps directes, pnpm hoist le binaire au root `node_modules`. Si versions divergent (kafkajs 3.x un jour), pnpm refusera resolution. Solution : workspace-level pin de la version dans `pnpm-workspace.yaml` `catalogs`.

### 12.8 Schema-Registry Confluent preview Sprint 33

Si la decision est prise au Sprint 33 d'introduire Schema Registry pour gerer evolution backward/forward checks automatiques, shared-events devient le source que l'on push vers le registry au build CI. Aucune migration runtime requise : les schemas Zod restent la source authoritative, le registry sert uniquement de gardien d'evolution. Le CI exporte chaque schema en JSON Schema via `zod-to-json-schema` et fait `curl POST /subjects/<topic>/versions` au registry pour validation compatibility.

### 12.9 locale fr-MA enum non-Latin

Quand un payload contient un champ `body` avec contenu arabe (locale ar-MA), Zod valide la longueur en `.length` qui compte les unites UTF-16 (donc deux unites par char hors BMP, mais arabe est BMP donc OK). Risque sur emoji (decision-006 interdit donc neutralise) ou caracteres CJK rares. Test : valider un payload contenant `"body": "marhaban"` (translitere) puis `"body": "marhaba en arabe natif"`.

### 12.10 decimal Money type Zod refinement

`MoneyDirhamSchema` est string regex + refinement runtime. Alternatives rejetees : `z.number().multipleOf(0.01)` echoue sur 0.01 + 0.02 != 0.03 IEEE 754. `z.bigint()` perd les decimales. La string regex avec parseFloat refinement est le meilleur compromis Zod. Pour calculs, convertir vers `Decimal.js` cote service consommateur (pas dans shared-events).

### 12.11 datetime ISO timezone Africa/Casablanca

Le Maroc a abandonne l'heure d'ete en 2018 et a fixe UTC+1 toute l'annee (Africa/Casablanca = +01:00 permanent). Tous les `occurred_at` dans envelopes sont stockes en UTC ISO 8601 sans offset (ex `2026-05-05T12:00:00.000Z`). Conversion vers heure locale = client. Schema enforce `.datetime({ offset: false })` pour rejeter `2026-05-05T13:00:00+01:00` qui pourrait etre ambigu.

### 12.12 Buffer.from JSON binaire non-UTF8

Si un producteur tiers (legacy ou SDK exotique) envoie un message Kafka contenant des octets non-UTF8 (ex BOM UTF-16, GBK), `Buffer.toString('utf-8')` produira des replacement chars (U+FFFD) et le `JSON.parse` echouera. `parseEnvelopeFromKafka` throw une erreur claire que KafkaConsumerBase log + envoie en DLQ.

## 13. Conformite Maroc

### 13.1 decision-006 no-emoji enforcement

Aucun emoji dans :
- Noms de topics enum (verifie regex `^[a-z._]+$`)
- Champs schemas Zod (pas de defaut emoji, pas de description emoji, pas de regex contenant emoji)
- Messages d'erreur Zod (`message: 'Money must be...'` sans emoji)
- Code TypeScript et tests
- Commentaires
- Commit messages (verifie hook pre-commit)

Lint custom rule `no-emoji` du monorepo couvre `src/`, `test/`, `*.md`.

### 13.2 decision-008 cloud souverain MA

Les events emis via topicSchemaMap ne quittent jamais le cluster Kafka deploye au datacenter MA (Casablanca, Rabat ou Tanger selon contrat fournisseur). shared-events n'a pas d'aspect transport/network mais formalise les noms qui seront utilises par KafkaPublisher (1.2.12) configure avec `KAFKA_BROKERS` pointant exclusivement vers IPs prives MA. Aucun cross-region replication ne replique les events vers EU/US.

### 13.3 ACAPS Article 12 audit trail

Article 12 du reglement ACAPS exige une tracabilite complete de toute operation sur les contrats d'assurance (souscription, modification, sinistre, paiement) avec horodatage, identite de l'acteur, et conservation 10 ans minimum. Les events `INSURE_*`, `REPAIR_*`, `PAY_*`, et `AUDIT_*` sont structures pour repondre a cette exigence : chaque envelope contient `event_id` (immutable), `occurred_at` (UTC), `tenant_id` + `user_id`, `correlation_id` (lien cross-events de la meme operation), et un payload typé conservant le before_state/after_state pour `AUDIT_RECORDED`. Les events sont ecrits en sink ClickHouse + S3 Glacier avec retention 10 ans automatique.

### 13.4 CNDP donnees personnelles

Loi 09-08 et nouvelle loi 13-21 sur protection donnees personnelles : les payloads contenant PII (email, phone, full_name, ip_address) doivent etre chiffres au repos cluster Kafka (KAFKA_LISTENER_SECURITY_PROTOCOL=SSL) et masques en console / logs (decision-pino-redact deja en place Sprint 1). shared-events ne chiffre pas les payloads (responsabilite transport) mais documente les champs PII pour faciliter masquage cote consumer logs.

### 13.5 Article 26-bis archivage decennal

Pour les events `BOOKS_*` (comptabilite), conservation 10 ans avec immutabilite (write-once-read-many). Sink S3 Object Lock active sur bucket dedie `s3://insurtech-events-books-decennial/`.

## 14. Conventions absolues respectees

1. **Multi-tenant strict** : tous les schemas (sauf `SYSTEM_HEALTH_CHANGED`, `SYSTEM_CONFIG_UPDATED` qui sont globaux) ont un champ `tenant_id: z.string().uuid()` non-nullable. EventEnvelope tenant_id peut etre null pour events system globaux uniquement.
2. **Validation Zod partout** : aucune structure event n'est consumee sans `safeParse` ou `validateEventEnvelope`.
3. **Pino logging structure** : ce package n'instancie pas de logger (TS pur), mais les helpers retournent des messages structures `{success: false, error, message}` exploitables par Pino consommateur.
4. **argon2id passwords** : aucun mot de passe dans les schemas events. `UserPasswordResetRequestedPayload` contient `reset_token_hash` qui est SHA-256 du token (pas argon2 car comparaison frequente).
5. **pnpm workspace** : declarations dans pnpm-workspace.yaml `packages: ['packages/*', 'apps/*']`.
6. **TypeScript strict mode** : tsconfig.json active `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
7. **Vitest tests** : aucun jest. Tests dans `test/` mirroir de `src/`.
8. **RBAC controle** : non applicable au package shared-events (pas de runtime), mais les payloads incluent `by_user_id` pour tracer l'acteur RBAC.
9. **Events Kafka format** : envelope JSON ASCII strictement, encodage UTF-8 obligatoire.
10. **Imports @insurtech/* internes** : autres packages monorepo importent `@insurtech/shared-events`, jamais imports relatifs cross-package.
11. **Skalean AI frontier 005** : schemas stables et versionnes pour alimentation data lake AI sans corruption features.
12. **No-emoji 006** : enforce.
13. **Idempotency 24h Redis** : event_id ULID est la clef idempotence pour IdempotencyService (1.2.15) avec TTL 24h.
14. **Conventional Commits** : `feat(shared-events): init topics enum + zod schemas + types inferes`.
15. **Cloud souverain MA 008** : verifie au runtime brokers, pas dans shared-events.

## 15. Validation pre-commit

```bash
# Sequence pre-commit obligatoire dans .husky/pre-commit (echo desactive emoji output)
set -e
pnpm --filter @insurtech/shared-events typecheck
pnpm --filter @insurtech/shared-events lint
pnpm --filter @insurtech/shared-events test --run
pnpm --filter @insurtech/shared-events build

# Verif manuelle no-emoji
grep -rPn "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/shared-events/src packages/shared-events/test || echo "OK no emoji"

# Verif topicSchemaMap completeness
node -e "
const {Topics, topicSchemaMap} = require('./packages/shared-events/dist');
const missing = Object.values(Topics).filter(t => !topicSchemaMap[t]);
if (missing.length > 0) { console.error('MISSING:', missing); process.exit(1); }
console.log('OK topicSchemaMap covers', Object.keys(topicSchemaMap).length, 'topics');
"

# Verif coverage seuil
pnpm --filter @insurtech/shared-events test --coverage --coverage.thresholds.statements=80
```

## 16. Commit message Conventional Commits

```
feat(shared-events): init topics enum + zod schemas + types inferes

- Cree packages/shared-events workspace TypeScript pur
- Enum Topics 47 valeurs (auth 7, crm 6, booking 3, comm 8, pay 6, insure 4, repair 3, audit 3, books 2, stock 2, hr 2, system 3)
- EventEnvelopeSchema avec event_id ULID 26 chars, event_version semver, tenant_id/user_id/correlation_id UUID nullable
- 47 schemas Zod payloads metier dans src/schemas/<vertical>/
- topicSchemaMap Record<Topics, ZodSchema> source unique de verite
- Helpers buildEventId (monotonic ULID), validateEventPayload, validateEventEnvelope, buildEnvelope, parseEnvelopeFromKafka
- Tests Vitest 50+ cas, coverage 85%, types inference verifie
- Conformite decision-005 AI frontier, decision-006 no-emoji, decision-008 cloud MA
- Compatibility ACAPS Article 12 audit trail decennal

Refs: SKAL-1.2.11
Depends: SKAL-1.2.10
Blocks: SKAL-1.2.12 SKAL-1.2.13 SKAL-1.2.14 SKAL-1.2.15
```

## 17. Workflow next task-1.2.12

La tache suivante 1.2.12 cree `KafkaPublisher` dans `packages/kafka` qui consomme `@insurtech/shared-events`. Pre-requis valides apres 1.2.11 :

1. `dist/` est emis et disponible pour resolution monorepo
2. `topicSchemaMap` permet validation pre-publish dans `KafkaPublisher.publish<T>(topic, payload, context)`
3. `buildEnvelope` est utilise par KafkaPublisher pour construire automatiquement l'envelope
4. `Topics` enum est l'unique source autorisee de noms de topics

Sequencement Sprint 2 restant :
- 1.2.12 KafkaPublisher (4h, P0) -- consomme shared-events
- 1.2.13 KafkaConsumerBase (5h, P0) -- consomme shared-events + IdempotencyService
- 1.2.14 OutboxPublisher background worker (4h, P0)
- 1.2.15 IdempotencyService Redis 24h (3h, P0)
- 1.2.16 health checks Kafka (2h, P1)
- 1.2.17 docker-compose Kafka KRaft (2h, P1)
- 1.2.18 doc onboarding event-driven (2h, P2)

---

## Annexes

### Annexe A -- Schemas Zod sample par module (catalogue exhaustif des 47 schemas avec exemples)

#### A.1 Module auth -- 7 schemas

Le module auth gere l'authentification, les sessions, MFA, et le cycle de vie utilisateur. Tous les events auth ont `tenant_id` non-null et `user_id` non-null (sauf `USER_CREATED` qui peut avoir un createur null pour le premier super_admin de la plateforme).

```typescript
// Sample payload UserCreated complet
const sample: UserCreatedPayload = {
  user_id: '01HZ8A1B2C3D4E5F6G7H8J9K0L',
  tenant_id: '22222222-2222-4222-9222-222222222222',
  email: 'admin@insurtech.ma',
  full_name: 'Yassine Bennani',
  role: 'admin',
  locale: 'fr-MA',
  created_at: '2026-05-05T10:00:00.000Z',
  created_by_user_id: null,
  invitation_token_hash: 'abc123def456...64chars...',
};
```

Chaque schema auth est concu pour etre consume par le `audit-service` qui ecrit dans la table `AuditLog` Postgres + sink ClickHouse, par le `notification-service` qui declenche emails de bienvenue, et par le `analytics-service` qui calcule MAU/DAU.

#### A.2 Module crm -- 6 schemas

Le module crm couvre contacts, deals (pipeline commercial), interactions multi-canal. Le schema `DealStageChangedPayload` est particulierement critique car il alimente le forecast revenue dashboard temps reel.

```typescript
const sample: DealStageChangedPayload = {
  deal_id: '11111111-1111-4111-9111-111111111111',
  tenant_id: '22222222-2222-4222-9222-222222222222',
  from_stage: 'qualification',
  to_stage: 'proposal',
  amount_dirham: '125000.00',
  by_user_id: '33333333-3333-4333-9333-333333333333',
  changed_at: '2026-05-05T14:30:00.000Z',
  reason: 'Client a valide proposition technique',
};
```

#### A.3 Module booking -- 3 schemas

Booking gere les rendez-vous (rendez-vous expert, rendez-vous client, demonstration produit). Schema simple sans Money car la facturation est decouplee dans pay.

#### A.4 Module comm -- 8 schemas

Le module comm est le plus volumineux car couvrant toutes les communications sortantes (sent/delivered/failed/bounced) et entrantes (whatsapp/sms/email inbound + push). Le schema `MessageSentPayloadSchema` est generique multi-canal avec un champ discriminant `channel` ; les details specifiques canal (template_id email, template_name whatsapp Meta) sont dans `provider_message_id` opaque.

#### A.5 Module pay -- 6 schemas

Pay couvre transactions provider (CMI, NAPS, Stripe, PayPal pour expansion regional Afrique francophone, cash, virement) et factures. Tous les Money sont en MAD via `MoneyDirhamSchema`. Pour multi-devise futur (Sprint 18+), ajouter champ `currency_iso4217` enum.

#### A.6 Module insure -- 4 schemas

Insure prepare le sprint 14 (souscription contrats assurance). Schemas declaratifs pour le moment, evolution attendue avec ajout de champs ACAPS-specific (numero matricule assureur, code branche, garanties souscrites tableau).

#### A.7 Module repair -- 3 schemas

Repair prepare le sprint 20 (gestion sinistres). `SinistreDeclaredPayloadSchema` inclut `damage_type` enum et `initial_estimate_dirham` nullable car l'estimation initiale n'est pas toujours connue.

#### A.8 Module audit -- 3 schemas

Audit est consume par AuditService (Sprint 1) qui ecrit dans `AuditLog` Postgres avec retention 10 ans. `AuditRecordedPayloadSchema` contient `before_state` et `after_state` non-typed (z.unknown) car ils dependent du resource_type.

#### A.9 Module books -- 2 schemas

Books couvre la comptabilite (livre journal, cloture exercice). `LedgerEntryPostedPayloadSchema` est pivot pour ecritures double-entry : chaque event represente une seule ligne (debit OU credit), les transactions multi-lignes sont une rafale d'events lies par `correlation_id`.

#### A.10 Module stock -- 2 schemas

Stock gere inventaire (pour pieces sinistres repair, kits documentation, materiel agence). Simple et generique, evolution Sprint 22+.

#### A.11 Module hr -- 2 schemas

HR gere onboarding/offboarding employes. Couples avec auth pour creation/deactivation user, avec books pour paie.

#### A.12 Module system -- 3 schemas

System couvre erreurs (consume par incident-service), health (consume par status-page service), config (consume par config-service propagation cluster).

### Annexe B -- Pattern event_version semver et strategie evolution

Trois categories de changements sur un schema event :

1. **Patch** (jamais incremente, juste documente CHANGELOG) : correction documentation, ajout exemple, renommage variable interne.
2. **Mineur** (1.0 -> 1.1) : ajout champ optionnel (avec defaut), ajout valeur enum (sans modification), elargissement contraintes (ex max 100 chars devient max 200 chars).
3. **Majeur** (1.x -> 2.0) : retrait champ obligatoire, retrait valeur enum, retrecissement contraintes, changement type (string -> number).

Procedure majeure :
- Etape 1 : creer fichier schema versionne `user-signed-in-v2.schema.ts` exposant `UserSignedInV2PayloadSchema`.
- Etape 2 : ajouter dans Topics enum `AUTH_USER_SIGNED_IN_V2 = 'insurtech.events.auth.user.signed_in.v2'`.
- Etape 3 : producteur emet sur les deux topics simultanement (fan-out applicatif) pendant fenetre migration (typiquement 30 jours).
- Etape 4 : consommateurs migrent un par un vers v2.
- Etape 5 : producteur cesse emission v1 apres confirmation 100% consommateurs migres.
- Etape 6 : suppression definitive Topics.AUTH_USER_SIGNED_IN apres 90 jours retention DLQ vide.

Le `event_version` field permet aussi a un consommateur unique de gerer plusieurs versions au runtime via switch :

```typescript
function consume(envelope: EventEnvelope): void {
  switch (envelope.event_version) {
    case '1.0':
    case '1.1':
      return handleV1(envelope.payload as UserSignedInV1Payload);
    case '2.0':
      return handleV2(envelope.payload as UserSignedInV2Payload);
    default:
      throw new Error(`Unsupported event_version: ${envelope.event_version}`);
  }
}
```

### Annexe C -- ULID versus UUID v7 benchmark

Microbench Node 20 / Apple M3, 1 000 000 generations :

| Format | Library | Temps total | Ops/sec | Bytes/id | Sortable | Monotonic |
|--------|---------|-------------|---------|----------|----------|-----------|
| UUID v4 | uuid 9.0.1 | 1.4s | 714k | 36 (avec tirets) | non | non |
| UUID v7 | uuidv7 0.6.0 | 2.1s | 476k | 36 | oui ms | non |
| ULID | ulid 2.3.0 | 1.7s | 588k | 26 | oui ms | oui (monotonicFactory) |
| Snowflake | snowflake-id 1.1.0 | 0.9s | 1111k | 19 | oui | oui | dependance machine_id |
| nanoid | nanoid 5.0.7 | 0.6s | 1666k | 21 (par defaut) | non | non |

Conclusion : ULID retenu pour rapport ergonomie (lisible, copy-paste safe sans tirets) + sortable + monotonic + standard reconnu + bibliotheque mature. Snowflake plus rapide mais necessite coordination machine_id.

Stockage Postgres :
- ULID en `CHAR(26)` ou type custom domain : 26 octets + B-tree index efficace insertions sequentielles
- UUID v4 en `UUID` natif Postgres : 16 octets binaire + B-tree mais page splits constants
- UUID v7 en `UUID` natif : 16 octets, mais support extension Postgres immature en 2026

ULID gagne pour event_id qui est une clef synthetique sans contrainte FK. Pour entity_id metier (Contact, Deal), UUID v4 reste le standard car compatible librairies tierces existantes.

### Annexe D -- Validation runtime tests strategy

La pyramide de tests pour shared-events :

1. **Unit tests par schema** (~50 tests, ~70% effort) : chaque schema a 5-10 tests verifiant happy path + cas erreur. Couvre 100% des branches Zod.
2. **Helpers tests** (~20 tests, ~15% effort) : buildEventId regex/monotonic/length/extract, validateEventPayload happy/error/unknown topic, buildEnvelope defaults, parseEnvelopeFromKafka null/json invalid/validation fail.
3. **Integration tests** (~10 tests, ~10% effort) : topic-schema-completeness invariant, types-inference compile-time checks, JSON serialization roundtrip.
4. **Property-based tests futurs** (Sprint 5+, ~5% effort) : utiliser fast-check pour generer aleatoirement des envelopes valides et invalides, verifier robustesse.

Coverage attendu V1 : 85-90% statements/branches/lines, 100% functions exported.

Cas tests bonus a ajouter :
- Test 1 : envelope avec `payload = null` est rejete (z.unknown accepte null mais schemas concrets non).
- Test 2 : envelope avec `payload = []` est rejete (array vs object discriminer).
- Test 3 : envelope avec champs supplementaires non declares est accepte par defaut Zod (mode passthrough), test que strict mode rejette si active.
- Test 4 : envelope avec `event_id` en majuscules dont chars I/L/O/U est rejete par regex Crockford.
- Test 5 : envelope avec `occurred_at` au format `2026-05-05 12:00:00` (espace au lieu de T) est rejete.

### Annexe E -- Integration NestJS DI

Bien que `@insurtech/shared-events` soit TypeScript pur sans runtime NestJS, il est consume par modules NestJS via patterns standards :

```typescript
// apps/auth-service/src/events/auth-events.module.ts
import { Module } from '@nestjs/common';
import { KafkaPublisher } from '@insurtech/kafka';
import { Topics, buildEnvelope } from '@insurtech/shared-events';

@Module({
  providers: [KafkaPublisher],
  exports: [KafkaPublisher],
})
export class AuthEventsModule {}

// apps/auth-service/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { KafkaPublisher } from '@insurtech/kafka';
import { Topics, UserSignedInPayload, validateEventPayload } from '@insurtech/shared-events';

@Injectable()
export class AuthService {
  constructor(private readonly publisher: KafkaPublisher) {}

  async signIn(input: SignInInput): Promise<void> {
    // ... logic
    const payload: UserSignedInPayload = {
      user_id: user.id,
      tenant_id: tenantId,
      signin_method: 'password',
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      signed_in_at: new Date().toISOString(),
      session_id: session.id,
      device_fingerprint: ctx.deviceFingerprint,
      geo_country: ctx.geoCountry,
      geo_city: ctx.geoCity,
    };

    const validation = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, payload);
    if (!validation.success) {
      this.logger.error({ err: validation.message }, 'Invalid event payload');
      throw new InternalServerErrorException('Event validation failed');
    }

    await this.publisher.publish(Topics.AUTH_USER_SIGNED_IN, payload, {
      tenantId,
      userId: user.id,
      correlationId: ctx.correlationId,
    });
  }
}
```

Le pattern `validateEventPayload` avant publish est en reality redondant car KafkaPublisher (1.2.12) le fait deja en interne, mais utile au developpement local pour catcher tot.

### Annexe F -- Catalogue partition strategy par topic

Chaque topic Kafka est cree avec un nombre de partitions et une strategie de keying en fonction du volume attendu et du besoin d'ordering :

| Topic | Partitions | Key | Retention | Compression | Replication |
|-------|------------|-----|-----------|-------------|-------------|
| AUTH_USER_SIGNED_IN | 6 | tenant_id | 7 jours | snappy | 3 |
| AUTH_USER_CREATED | 3 | tenant_id | 90 jours | snappy | 3 |
| CRM_CONTACT_CREATED | 6 | tenant_id | 30 jours | snappy | 3 |
| CRM_DEAL_STAGE_CHANGED | 6 | deal_id | 30 jours | snappy | 3 |
| COMM_MESSAGE_SENT | 12 | tenant_id | 30 jours | snappy | 3 |
| COMM_WHATSAPP_INBOUND | 6 | tenant_id | 30 jours | snappy | 3 |
| PAY_TRANSACTION_COMPLETED | 6 | transaction_id | 365 jours | snappy | 3 |
| INSURE_POLICY_SIGNED | 3 | policy_id | 3650 jours | gzip | 3 |
| REPAIR_SINISTRE_DECLARED | 3 | sinistre_id | 3650 jours | gzip | 3 |
| AUDIT_RECORDED | 6 | tenant_id | 3650 jours | gzip | 3 |
| BOOKS_LEDGER_ENTRY_POSTED | 3 | tenant_id | 3650 jours | gzip | 3 |
| SYSTEM_ERROR_RAISED | 3 | service_name | 7 jours | snappy | 3 |

Decisions :
- **Key tenant_id** quand l'ordering par tenant suffit et qu'on veut spread inter-tenants.
- **Key entity_id** (deal_id, transaction_id) quand l'ordering causal entity-level est requis.
- **Retention 7 jours** pour events transient (signin, errors).
- **Retention 30 jours** pour events operationnels analyzed dans dashboards 30j.
- **Retention 365 jours** pour transactions financieres avec replay support.
- **Retention 3650 jours (10 ans)** pour assurance/repair/audit/books conformite ACAPS Article 12.
- **Replication 3** systematique pour HA cluster MA (3 brokers minimum, distribues racks differents).
- **Compression snappy** par defaut (rapide), **gzip** pour topics longue retention (taux compression superieur).

Ces parametres sont configures dans Terraform (Sprint 1) module `kafka-topics` qui lit un mapping declaratif. Le package shared-events ne genere pas la configuration Kafka mais sert de reference des noms.

### Annexe G -- Strategie schema versioning long-terme

Apres trois ans d'exploitation, on s'attend a 5-15 schemas par vertical avec versions multiples actives en parallele. Pour eviter explosion taille `Topics` enum (passe de 47 a 200+ valeurs), strategie pivot :

- Migration vers fichier `topics-registry.yaml` source de verite externe (YAML pour edition humaine + git diff lisible).
- Codegen pipeline `pnpm gen:topics` lit YAML, emet `src/topics.ts` enum + `src/schemas/index.ts` topicSchemaMap.
- Schema Registry Confluent ou Apicurio Registry deploye Sprint 33 pour validation evolution backward/forward au CI.
- Ce changement preserve API exposee de shared-events (Topics, topicSchemaMap, helpers) : zero breaking pour consommateurs.

### Annexe H -- Performance et bundling

Bundle size shared-events :
- src/ TypeScript : ~15 KB
- dist/ JavaScript compile : ~25 KB (incluant types declarations)
- Runtime memory footprint : ~2 MB (Zod schemas instancies une fois au boot)

Performance microbench (Node 20 / M3) :
- safeParse simple object 8 champs : ~25 microsecondes
- safeParse object 30 champs imbriques : ~80 microsecondes
- buildEventId monotonic : ~3 microsecondes
- validateEventEnvelope complete : ~120 microsecondes (envelope + payload)

Pour 100 000 events/seconde theorique throughput :
- 100k * 120 microsec = 12 secondes total CPU si serialise -> 8333 events/sec/core
- Avec 8 cores parallelisation : 66k events/sec/instance Node
- Cluster 3 instances : 200k events/sec capacite, suffisant pour Skalean horizon 5 ans

### Annexe I -- Monitoring metrics shared-events

Bien que shared-events soit TypeScript pur sans runtime, les consommateurs (KafkaPublisher, KafkaConsumerBase) emettent metriques Prometheus standardisees :

```
# Counter : events publies par topic
kafka_events_published_total{topic="insurtech.events.auth.user.signed_in", tenant_id="..."} 

# Counter : validations echec par topic
kafka_events_validation_failed_total{topic="...", error_type="schema_mismatch|unknown_topic|envelope_invalid"}

# Histogram : latence validation Zod
zod_validation_duration_seconds{topic="...", schema="UserSignedInPayloadSchema"}

# Counter : DLQ publish par topic source
kafka_events_dlq_published_total{source_topic="..."}

# Gauge : topicSchemaMap entries count (verifie =47 au boot)
shared_events_schema_registry_size

# Gauge : event_version distribution observee
events_observed_version_count{topic="...", event_version="1.0|1.1|2.0"}
```

Alerting :
- `kafka_events_validation_failed_total` rate > 10/sec pendant 5 min : payment-on-call
- `events_observed_version_count` montre version inattendue : warning slack channel #events-team
- `shared_events_schema_registry_size != 47` au boot : page on-call critical

### Annexe J -- Plan de tests load et chaos

Sprint 4 (load testing) executera :

- **Load test 1** : burst 10 000 envelopes/sec pendant 5 min sur Topics.AUTH_USER_SIGNED_IN, mesure latency p50/p95/p99 validation Zod.
- **Load test 2** : 100 000 events totaux distribues sur 47 topics, verifie aucune perte, ordering, no DLQ entry.
- **Chaos test 1** : kill broker Kafka pendant burst, verifie retry KafkaPublisher + reorder consumer.
- **Chaos test 2** : injection 5% events malformes (event_id non-ULID, payload missing field), verifie tous routes en DLQ avec metrics correctes.
- **Chaos test 3** : event_version inconnu (3.0 alors que consumer ne supporte que 1.x/2.x), verifie envoye en DLQ avec error message clair.

### Annexe K -- Guide migration legacy events

Si Skalean herite d'events legacy d'un systeme prealable (par hypothese, on n'en a pas) :

1. Etape 1 : ecrire un adapter `legacy-event-adapter.ts` qui transforme structure ancienne vers EventEnvelope.
2. Etape 2 : deployer adapter en sidecar consumer du topic legacy, republier sur topic shared-events compliant.
3. Etape 3 : migrer consommateurs un par un vers nouveau topic.
4. Etape 4 : decommissionner topic legacy + adapter apres 90 jours zero traffic.

### Annexe L -- Roadmap evolution shared-events

- **Sprint 2** (actuel) : init avec 47 schemas
- **Sprint 5** : ajout schemas service contracts (5 nouveaux)
- **Sprint 8** : raffinement schemas comm avec template_variables typed via discriminated union
- **Sprint 14** : extension insure (Sprint 14 livre service complet) avec 12 nouveaux schemas (premium-calculated, claim-related, renewal-reminder)
- **Sprint 20** : extension repair (Sprint 20 livre service complet) avec 8 nouveaux schemas
- **Sprint 24** : introduction event_metadata field optionnel pour data lineage (source_app, source_version, trace_id W3C)
- **Sprint 28** : decomposition packages (shared-events-core, shared-events-auth, shared-events-crm, etc.) si volume justifie
- **Sprint 33** : Schema Registry Confluent integration backward/forward checks CI
- **Sprint 40** : migration Avro binaire pour topics haut volume (>50k events/sec) avec preservation schemas Zod source

### Annexe M -- FAQ developpeur

**Q: Pourquoi pas un seul gros fichier `schemas.ts` plutot que 47 fichiers ?**
R: Modularite, tree-shaking si import ciblé `@insurtech/shared-events/schemas/auth/user-signed-in.schema`, parallele code review (un PR n'edit qu'un fichier au lieu de creer conflit), code-splitting futur si bundle frontend.

**Q: Pourquoi pas decorators NestJS dans shared-events ?**
R: Pour rester importable depuis workers Node.js sans framework, scripts CLI, lambdas serverless. NestJS est un consommateur, pas un prerequis.

**Q: Comment gerer un payload qui peut avoir deux structures alternatives ?**
R: `z.discriminatedUnion('type', [SchemaA, SchemaB])` avec un champ discriminant explicite. Eviter `z.union` pur qui parse essais successifs et perd le typing precis.

**Q: Et si je veux valider en compile-time uniquement (perf hot path) ?**
R: Importer juste le type `UserSignedInPayload`, ne pas appeler safeParse. Mais alors bug runtime possible : a faire seulement en interne service apres validation initiale au boundary.

**Q: Comment etend un schema sans casser backward compat ?**
R: Ajout champ optionnel avec defaut. Exemple `geo_isp: z.string().nullable().default(null)`. Les consumers existants ignorent le nouveau champ, les nouveaux le lisent. event_version reste 1.x.

**Q: Comment tester la generation types `z.infer` ne drift pas ?**
R: Tests `expectTypeOf` Vitest avec `.toEqualTypeOf<...>()` qui font failure compile-time si type infere differe.

**Q: Pourquoi `Record<Topics, ZodTypeAny>` plutot que `Map<Topics, ZodTypeAny>` ?**
R: Acces typed-safe via `topicSchemaMap[Topics.AUTH_USER_SIGNED_IN]` retourne ZodTypeAny non-undefined (TS narrowing), alors que `Map.get()` retourne T | undefined necessitant guard supplementaire.

**Q: Decimal Money precision pour dirhams MAD ?**
R: 2 decimales suffisent (centimes). MoneyDirhamSchema applique regex `\d{1,9}(\.\d{1,2})?` qui couvre 0.01 MAD a 999 999 999.99 MAD. Pour multi-devise futur (EUR/USD/TND), introduire MoneySchema avec field `currency` et regex adaptee par devise.

**Q: Comment gerer datetime avec timezone Africa/Casablanca ?**
R: Toujours stocker UTC ISO 8601. Conversion en local cote presentation. Postgres column type `TIMESTAMPTZ`. Schema enforce `.datetime({ offset: false, precision: 3 })` pour rejeter offsets explicites et imposer millisecondes.

**Q: Comment debug un payload qui echoue validation prod ?**
R: Activer `EVENT_LOG_FAILED_VALIDATION=true`, KafkaConsumerBase logge via Pino le payload (PII redacted) + l'erreur Zod structure (path + message). Replay manuel via `validateEventEnvelope(JSON.parse(rawString))` en REPL.

### Annexe N -- Comparatif final shared-events vs alternatives non-retenues

| Critere | shared-events Zod | JSON Schema + Ajv | Avro + Schema Registry | Protobuf | io-ts |
|---------|-------------------|-------------------|------------------------|----------|-------|
| Generation types TS | native z.infer | tooling externe | avro-typescript | ts-proto | native |
| Validation runtime | safeParse | ajv.validate | avsc.fromBuffer | protoc-gen | codec.decode |
| Bundle size | 50KB | 60KB | 200KB | 150KB | 30KB |
| Courbe apprentissage | basse | moyenne | elevee | elevee | tres elevee |
| Ecosysteme NestJS | excellent | bon | inexistant | bon | moyen |
| Multi-langue | TS/JS only | universel | universel | universel | TS/JS only |
| Versioning auto | manuel | manuel | natif registry | natif | manuel |
| Compression payload | aucune | aucune | binaire (-30%) | binaire (-40%) | aucune |
| Refinements custom | excellent | regex only | limite | impossible | excellent |
| Discriminated union | natif | oneOf | record union | oneof | natif |

Conclusion : Zod gagne ergonomie + ecosysteme + dev velocity, perd compression vs Avro/Protobuf. Acceptable pour Skalean phase 0-3 ans avec migration possible Avro Sprint 40+ si volume justifie.

### Annexe O -- Conformite et audit

Audit interne shared-events trimestre :
- Verifier zero emoji via grep CI
- Verifier tous schemas couverts par test (coverage 100% functions)
- Verifier topicSchemaMap symmetrique avec Topics enum
- Verifier no breaking change non documente dans CHANGELOG

Audit externe annuel :
- Cabinet auditeur ACAPS verifie reproductibilite events 10 ans (replay + revalidation)
- CNDP audit PII handling (verification redaction logs, chiffrement transport)
- Pen-test schema injection (envoi payload malicieux, verifier rejection Zod)

### Annexe P -- Checklist livraison finale 1.2.11

- [ ] Branche feature/SKAL-1.2.11-shared-events-init pushed
- [ ] PR ouverte avec template
- [ ] Description PR cite criteres V1-V32
- [ ] CI green : build, test, lint, typecheck, no-emoji
- [ ] Coverage report attache montrant >= 80%
- [ ] Reviewer tech-lead-backend approuve
- [ ] Reviewer architecte-events approuve
- [ ] Squash merge avec commit message Conventional
- [ ] Tag git v0.1.0 sur packages/shared-events
- [ ] Documentation publication interne developpeurs (Confluence space)
- [ ] Annonce slack canal #engineering-events
- [ ] 1.2.12 unblocked et planifie sprint planning suivant
