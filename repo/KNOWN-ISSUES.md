# Known Issues

## Bitnami Docker Images Deprecation (Mai 2026)

**Status** : RESOLVED

**Probleme** : Bitnami a deprecate les images sous le namespace `bitnami/*` mid-2025. Les tags publies avant cette date restent dans `bitnami/*` pour quelques temps, mais les nouveaux tags et certains anciens disparaissent. `docker pull bitnami/kafka:3.7.1` renvoie "manifest not found".

**Solution appliquee** : Migration vers le namespace `bitnamilegacy/*` qui heberge la copie 1:1 des images Bitnami pour la compatibilite retroactive.

**Fichiers modifies** :
- `infra/docker-compose.test.yaml` (kafka: `bitnami/kafka:3.7` -> `bitnamilegacy/kafka:3.7.1`)
- `infrastructure/docker/docker-compose.dev.yaml` (kafka + kafka-init-topics : `bitnami/kafka:3.7.1` -> `bitnamilegacy/kafka:3.7.1`)
- `infrastructure/docker/docker-compose.test.yaml` (kafka : `bitnami/kafka:3.7.1` -> `bitnamilegacy/kafka:3.7.1`)
- `.github/workflows/ci.yaml` (kafka service : `bitnami/kafka:3.7.1` -> `bitnamilegacy/kafka:3.7.1`)

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

**Considerations long terme** : a moyen terme, evaluer migration vers les images officielles upstream :
- `bitnamilegacy/kafka` -> `apache/kafka` (config env vars completement differente)
- `bitnamilegacy/postgresql` -> `postgres` (officiel, deja utilise dans nos composes)
- `bitnamilegacy/redis` -> `redis` (officiel, deja utilise dans nos composes)
- `bitnamilegacy/minio` -> `minio/minio` (officiel, deja utilise dans nos composes)

Cette migration necessitera ajustement des variables environnement (Bitnami utilise des conventions specifiques `KAFKA_CFG_*` versus apache `KAFKA_*`).

## MinIO mc Client -- Tag pinne RELEASE.2024-11-07 disparu (Mai 2026)

**Status** : RESOLVED

**Probleme** : `docker pull minio/mc:RELEASE.2024-11-07T00-52-20Z` renvoie "manifest not found". L'image serveur (`minio/minio` au meme tag) reste disponible.

**Solution appliquee** : Switch vers `minio/mc:latest` pour le container `minio-init-buckets`. C'est un init container ephemere qui execute juste `mc mb` une fois ; le tag `:latest` n'introduit pas de risque de reproducibilite pour la fonction qu'il execute, et le serveur MinIO lui reste pinne.

**Fichiers modifies** :
- `infrastructure/docker/docker-compose.dev.yaml` (minio-init-buckets : `minio/mc:RELEASE.2024-11-07T00-52-20Z` -> `minio/mc:latest`)

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## pg CJS named import in ESM modules (Mai 2026)

**Status** : RESOLVED

**Probleme** : `import { Pool, Client } from 'pg'` echoue au runtime dans les packages ayant `"type": "module"` :
```
SyntaxError: The requested module 'pg' does not provide an export named 'Pool'
```
Le package `pg` est CJS ; Node ESM ne peut pas resoudre statiquement les named exports d'un module CJS.

**Solution appliquee** : pattern default-import + destructuring :
```typescript
import pg from 'pg';
const { Pool } = pg;
// usage : new Pool(...) (value), let p: InstanceType<typeof Pool> (type)
```

**Fichiers modifies (8)** :
- `apps/platform/scripts/seed-dev.ts`
- `apps/platform/scripts/seed-reset.ts`
- `apps/platform/test/seeds/seeds.spec.ts`
- `apps/platform/test/seeds/faker-locale.spec.ts`
- `apps/platform/test/seeds/data-coherence.spec.ts`
- `infrastructure/scripts/__tests__/postgres-extensions.spec.ts`
- `infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts`
- `infrastructure/scripts/__tests__/postgres-roles.spec.ts`

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3), tests integration seeds.spec.ts.

## Vitest config split : unit vs integration (Mai 2026)

**Status** : RESOLVED

**Probleme** : `pnpm test` (config racine) faisait tourner les tests integration en PARALLELE (`singleFork: false`). Les fichiers `*.spec.ts` dans `test/integration/**` et `src/test/integration/**` tapaient tous la meme DB Postgres simultanement -> race conditions massives :
- `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`
- `relation "typeorm_metadata" already exists`
- `relation "auth_tenants" already exists`

**Solution appliquee** :
- `vitest.config.ts` racine : exclude `**/test/integration/**` et `**/src/test/integration/**` (unit tests parallel-safe uniquement)
- `packages/database/vitest.config.integration.ts` : `include` etendu pour couvrir LES DEUX scopes (`test/integration/**` ET `src/test/integration/**`), `singleFork: true`, `concurrent: false`
- `package.json` racine : `pnpm test:integration` execute via `turbo run test:integration --concurrency=1` (packages serialises)
- duplicate `test:integration` retire du `package.json` racine

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## Sprint 2 task 1.2.15 quality gate tests -- schema desync (Mai 2026)

**Status** : OPEN -- a fixer Sprint 3 hors-bande (1-2h estime)

**Probleme** : Les specs `packages/database/test/integration/*.spec.ts` (Sprint 2 quality gate, task 1.2.15, commit `a2d4a45`) referencent des noms de colonnes qui n'existent PAS dans le schema reel produit par les migrations Sprint 2 (tasks 1.2.2-1.2.8).

**Symptomes** : ~70 tests integration en `QueryFailedError: column "X" of relation "Y" does not exist`.

**Mismatches identifies** (echantillon) :

| Test attend | Schema reel | Fichier migration |
|---|---|---|
| `comm_messages.recipient` | `comm_messages.to_address` | `1735000000004-Communications.ts` |
| `comm_messages.body` | (n'existe pas, content via template) | id. |
| `comm_templates.code` | `comm_templates.name` | id. |
| `comm_templates.body` | `comm_templates.body_template` | id. |
| `doc_documents.kind` | `doc_documents.type` | `1735000000005-DocsPayments.ts` |
| `doc_documents.storage_uri` | `doc_documents.s3_bucket + s3_key` | id. |
| `pay_transactions.provider` | `pay_transactions.pay_method_id` (FK) | id. |
| `books_invoices.number` | `books_invoices.invoice_number` | `1735000000006-BooksCompliance.ts` |
| `booking_appointments.starts_at` | `booking_appointments.time_range tstzrange` | `1735000000003-Booking.ts` |
| `compliance_consent_logs.subject_id` | (a verifier) | `1735000000006-BooksCompliance.ts` |
| `analytics_events.event_type` | (a verifier) | `1735000000007-AnalyticsStockHr.ts` |
| `stock_items.quantity` | (a verifier) | id. |
| `hr_employees.email` | (a verifier) | id. |

**Cause racine** : Les specs Sprint 2 task 1.2.15 ont ete generes avec des assumptions de schema (probablement un ancien design Cowork) AVANT que les migrations finales (tasks 1.2.2-1.2.8) ne soient ecrites. Personne n'a jamais lance ces tests contre une vraie DB avant cette pause technique.

**Tests affectes** (16 fichiers):
- `test/integration/rls-multi-tenant.spec.ts` (la plupart des fails)
- `test/integration/migrations.spec.ts` (TC-MIG-09 EXCLUDE booking_appointments)
- `test/integration/rls-super-admin.spec.ts`
- `test/integration/subscribers-audit-log.spec.ts`
- `test/integration/subscribers-tenant-id.spec.ts`
- `test/integration/subscribers-timestamps.spec.ts`
- `test/integration/seeds.spec.ts`

**Plan de fix recommande Sprint 3 hors-bande** :
1. Lire chaque migration `1735000000003-Booking.ts` ... `1735000000007-AnalyticsStockHr.ts` et extraire le vrai schema
2. Reecrire les INSERT SQL dans `rls-multi-tenant.spec.ts` et autres specs pour matcher les colonnes reelles
3. Pour `booking_appointments` : remplacer `starts_at + ends_at` par `time_range tstzrange`
4. Pour `pay_transactions.provider` : creer prealablement un `pay_method` et utiliser son `pay_method_id`
5. Pour `comm_messages.recipient` : utiliser `to_address`
6. Pour `books_invoices.number` : utiliser `invoice_number` (verifier format CHECK constraint)
7. Re-lancer `pnpm test:integration` et iterer jusqu'a 0 fail

**Validation infrastructure confirmee** : les 8 migrations s'appliquent SANS erreur sur DB fresh (verifie par 112 tests passants sur `src/test/integration/migrations-*.spec.ts`). Le CODE Sprint 2 est OK, ce sont les TESTS quality gate qui sont desynchronises.

## Sprint 2 task 1.2.15 quality gate -- kafka-dlq.spec.ts logic broken (Mai 2026)

**Status** : OPEN -- a fixer Sprint 3 hors-bande (30-60 min estime)

**Probleme** : Le spec `packages/shared-events/test/integration/kafka-dlq.spec.ts` (TC-KAF-DLQ-01 a TC-KAF-DLQ-06) timeout sur `waitFor 45s` pour 6 des 9 fails shared-events integration.

**Cause racine** : Le test simule la logique DLQ MANUELLEMENT inline (lignes 40-77 : eachMessage handler qui incremente Redis counter puis route vers DLQ si count >= 3). Mais la logique est cassee :
1. Le test envoie UN message avec event-id unique
2. Le consumer le recoit UNE fois -> counter Redis = 1
3. Condition `count >= MAX_RETRIES` (1 >= 3) = FALSE -> pas de routage DLQ
4. Pas de commit offset, mais Kafka ne re-delivre PAS dans le meme run (sans rebalance/restart)
5. `waitFor` cherche le message en DLQ -> timeout 45s

Le test n'utilise PAS la vraie classe `KafkaConsumerBase` ni `dlq-publisher.service.ts` qui existent en production (commit `10f3afe` task 1.2.13). Il teste une simulation buggee, pas le vrai code.

**Production code Sprint 2 OK** : `dlq-publisher.service.ts` et `kafka-consumer.base.ts` sont testes par les 101 unit tests de `packages/shared-events` qui PASSENT tous (`pnpm test`).

**Plan de fix recommande Sprint 3 hors-bande** :
- Reecrire `kafka-dlq.spec.ts` pour instancier un vrai `KafkaConsumerBase` avec un handler qui throw, et observer la routage automatique vers le topic DLQ
- OU supprimer ce spec et le remplacer par un test sur `dlq-publisher.service.ts` qui mock la transport layer

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## Trigram performance test flaky -- Postgres planner sur tables vides (Mai 2026)

**Status** : KNOWN, low priority

**Probleme** : `packages/database/src/test/integration/trigram-performance.spec.ts` echoue avec :
```
expected 'Seq Scan on crm_companies' to match /idx_crm_companies_name_trgm|Bitmap Index Scan|Index Scan/
```

**Cause racine** : Le planner Postgres choisit `Seq Scan` plutot qu'un index scan quand la table contient tres peu de lignes (< quelques milliers). Le test execute `EXPLAIN` sur une table fraichement migree sans donnees.

**Plan de fix Sprint 3 hors-bande** : avant l'assertion EXPLAIN, inserer ~5000 lignes de donnees fictives dans `crm_companies` pour forcer le planner a utiliser l'index. Augmenter `random_page_cost` peut aussi aider.

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).
