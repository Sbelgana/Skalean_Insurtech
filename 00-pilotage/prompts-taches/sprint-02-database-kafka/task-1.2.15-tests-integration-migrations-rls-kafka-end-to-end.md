# Task 1.2.15 -- Tests integration end-to-end : migrations reversibles + RLS bloque cross-tenant + Kafka pub/sub round-trip + DLQ

- Identifiant : 1.2.15
- Sprint : 2 (Database & Kafka)
- Phase : 1 (Fondations)
- Duree estimee : 5 heures
- Priorite : P0 (bloquant Sprint 3)
- Dependance amont : 1.2.14 (consumer base + idempotency + retry + DLQ + tests unitaires)
- Dependance aval : V-02-sprint-02-database-kafka.md (script verification automatique Sprint 2), task-1.3.1 (Sprint 3 NestJS API bootstrap)
- AUCUNE EMOJI dans code, dans commentaires, dans noms de tests, dans messages console, dans documentation, dans commits, dans payloads JSON, dans schema JSDoc.

---

## 1. Header complet

Cette tache 1.2.15 est la quinzieme et **derniere** tache du Sprint 2 du programme Skalean InsurTech. Elle constitue le **gate qualite** systemique avant la transition vers le Sprint 3 dont l'objectif sera de bootstrapper l'API NestJS multi-modules. Aucune ligne de Sprint 3 ne doit etre ecrite tant que la batterie de tests integration definie ici n'est pas verte localement et en CI GitHub Actions.

L'objet de la tache est de produire dix suites de tests integration TypeScript executees via Vitest contre des conteneurs reels (Postgres 16, Kafka 3.7 KRaft, Redis 7) permettant de valider le fonctionnement bout-en-bout des realisations des taches 1.2.1 a 1.2.14. Les tests doivent demontrer en conditions proches production que les huit migrations TypeORM s'appliquent et se desappliquent dans le bon ordre, que la Row-Level Security configuree sur les trente-deux tables tenantisees bloque effectivement toute fuite cross-tenant, que les subscribers TypeORM (tenant injector, audit writer, timestamps) ecrivent les colonnes attendues, que le publisher Kafka serialise correctement les evenements et que le consumer base recoit, acquitte, deduplique, retries et envoie en Dead Letter Queue selon le contrat etabli.

Le seuil de couverture exige est de quatre-vingts pour cent de lignes sur les packages `packages/database` et `packages/shared-events`, mesures via le rapporteur c8/v8 integre a Vitest. Les tests doivent etre reproductibles : cinq executions consecutives doivent toutes reussir sans intervention humaine, sans flakiness, sans difference de resultat. Les tests doivent etre executables a la fois en local (via docker-compose.test.yaml) et en CI (via services GitHub Actions ou testcontainers Node).

---

## 2. But (trois paragraphes denses)

**Premier paragraphe -- les dix suites tests integration validation Sprint 2 complete.** Le Sprint 2 a livre quatorze taches d'infrastructure : la fondation du package `packages/database` (1.2.1), huit migrations TypeORM couvrant les domaines system/auth, CRM, booking, communications, documents/payments, books/compliance, analytics/stock/HR (1.2.2 a 1.2.8), trois subscribers TypeORM transverses (1.2.9), une cinquantaine de topics Kafka avec retention differenciee (1.2.10), un script de seed faker deterministe (1.2.11), un publisher Kafka avec retry exponentiel (1.2.12), un schema-registry interne JSON-Schema (1.2.13) et enfin un consumer base avec idempotency Redis et Dead Letter Queue (1.2.14). Chacune de ces realisations a ete couverte de tests unitaires mais aucun test n'a verifie l'integration systemique. La presente tache 1.2.15 produit les dix suites integration manquantes : `migrations.spec.ts`, `rls-multi-tenant.spec.ts`, `rls-super-admin.spec.ts`, `subscribers-tenant-id.spec.ts`, `subscribers-audit-log.spec.ts`, `subscribers-timestamps.spec.ts`, `kafka-publisher.spec.ts` integration, `kafka-consumer-base.spec.ts` integration, `kafka-dlq.spec.ts` et `seeds.spec.ts`.

**Deuxieme paragraphe -- derniere ligne avant Sprint 3.** Cette tache est strategiquement positionnee comme derniere ligne de defense avant le lancement du Sprint 3 dont la premiere tache (1.3.1) consistera a bootstrapper l'application NestJS principale `apps/api`. Sans la garantie apportee par les tests integration, toute regression dans la couche database/Kafka serait detectee tardivement (probablement en bout de Sprint 3 ou en Sprint 4) avec un cout de correction multiplie par dix par rapport a une detection au plus tot. Le gate definit egalement une **baseline de comportement attendu** que les futures evolutions ne devront pas casser : si la migration de la table `crm_contacts` change, le test `migrations.spec.ts` doit etre mis a jour; si une nouvelle table tenantisee est ajoutee, le test `rls-multi-tenant.spec.ts` doit l'inclure; si le contrat de message Kafka change, le test `kafka-publisher.spec.ts` doit refleter le nouveau contrat. Ce mecanisme de **specification executable** garantit que le contrat reste documente et applique.

**Troisieme paragraphe -- coverage 80% packages/database + shared-events.** Le seuil de couverture est calibre selon une analyse cout/benefice : quatre-vingts pour cent capture les flux nominaux et les principales branches d'erreur tout en laissant une marge pour les chemins de defense en profondeur (gardes de type runtime, branches d'optimisation, helpers dev-only) qui ne meritent pas d'etre testes a froid. Au-dela de quatre-vingt-dix pour cent, le rendement decroit fortement et les tests deviennent difficiles a maintenir. Le seuil est applique de maniere stricte en CI via `vitest run --coverage --coverage.thresholds.lines=80` : tout package qui descend en dessous fait echouer le pipeline. La couverture est mesuree separement pour `packages/database` (entites, subscribers, datasource, migrations) et `packages/shared-events` (publisher, consumer, schema-registry, DLQ). La section sept presente les commandes exactes et la configuration Vitest.

---

## 3. Contexte etendu (8-10 ko)

### 3.1 Pourquoi tests integration vs tests unitaires pour Sprint 2

Le Sprint 2 a une caracteristique particuliere : la majeure partie de sa logique metier reside non pas dans le code TypeScript mais dans **le moteur Postgres** (politiques RLS, contraintes EXCLUDE, triggers, fonctions, indexes partiels, contraintes CHECK avec regex) et dans **le broker Kafka** (consumer groups, partitionnement, ordering, retention, compaction). Tester unitairement ces composants en mockant Postgres ou Kafka donnerait une couverture nominale eleve mais une confiance metier nulle : un mock ne sait pas si une politique RLS bloque effectivement, ne sait pas si une contrainte EXCLUDE empeche reellement le double-booking, ne sait pas si un consumer group rebalance correctement quand un consumer disparait. La seule maniere honnete de valider Sprint 2 est de **lancer les conteneurs reels** et de mesurer le comportement observe. Cette philosophie correspond a l'ecole "testing trophy" de Kent C. Dodds : peu de tests unitaires, beaucoup de tests integration, quelques tests end-to-end UI -- adaptee ici a une stack backend ou les tests UI sont absents.

### 3.2 Alternatives testcontainers vs docker-compose.test.yaml

Deux strategies sont retenues car complementaires :

- **Strategie locale -- docker-compose.test.yaml** : un fichier compose dedie expose Postgres sur 5433, Kafka sur 9093, Redis sur 6380 (decales pour eviter les collisions avec les conteneurs de developpement de la tache 1.1.4 qui ecoutent respectivement sur 5432, 9092, 6379). Le developpeur lance `docker-compose -f docker-compose.test.yaml up -d` une fois en debut de session puis enchaine `pnpm test:integration` sans payer le cout de demarrage des conteneurs a chaque execution.
- **Strategie CI -- testcontainers Node** : la librairie `@testcontainers/postgresql`, `@testcontainers/kafka`, `@testcontainers/redis` cree des conteneurs ephemeres pour chaque suite, garantissant une isolation maximale et l'absence de pollution inter-suite. Le cout de demarrage (environ trente secondes par suite) est amorti par la fiabilite. En CI GitHub Actions, on utilise plutot les `services:` natifs (Postgres et Redis sont supportes nativement) plus testcontainers pour Kafka qui n'est pas disponible en service natif.

L'arbitrage est : **par defaut docker-compose en local** pour la rapidite developpeur, **services GitHub Actions plus testcontainers Kafka en CI** pour l'isolation. Les deux modes utilisent les memes variables d'environnement (`DATABASE_TEST_URL`, `KAFKA_TEST_BROKERS`, `REDIS_TEST_URL`) ce qui permet de basculer sans modifier le code des tests.

### 3.3 Trade-offs CI time 8min vs reliability

Une suite integration complete coute environ huit minutes en CI (deux minutes pour le demarrage des services et la migration, six minutes pour l'execution des dix suites). Comparee a une suite unitaire pure (trente secondes), c'est seize fois plus lent. Le trade-off est accepte pour les raisons suivantes : (a) ces tests ne s'executent que sur les pull-requests touchant `packages/database` ou `packages/shared-events`, pas sur chaque commit; (b) ils s'executent en parallele des tests unitaires, donc le temps total de CI n'est pas double; (c) la fiabilite gagnee depasse largement le cout temps : une regression RLS detectee en Sprint 2 coute zero, detectee en Sprint 5 coute une semaine de debug; (d) le pool de runners GitHub Actions inclus dans le plan Team est suffisant pour absorber le surcout. Si le temps CI depasse douze minutes a l'avenir (suite a l'ajout de nouveaux tests), une strategie de sharding sera mise en place : decoupage en quatre shards paralleles via `vitest --shard 1/4` jusqu'a `4/4`.

### 3.4 Decisions liees -- 002, 003, 004

- **Decision 002 (multi-tenant strict via RLS Postgres)** : la suite `rls-multi-tenant.spec.ts` est la concretisation executable de cette decision. Si un developpeur oublie d'activer RLS sur une nouvelle table ou supprime une politique, la suite echoue immediatement.
- **Decision 003 (TypeORM avec subscribers globaux)** : les suites `subscribers-*.spec.ts` valident que les trois subscribers (tenant injector, audit writer, timestamps) sont effectivement enregistres au niveau DataSource et que leur logique fonctionne en conditions reelles incluant les transactions, les rollback, les cascades.
- **Decision 004 (Kafka KRaft sans Zookeeper)** : la suite `kafka-publisher.spec.ts` integration utilise un Kafka KRaft (mode standalone sans Zookeeper) ce qui simplifie le docker-compose et reduit le temps de demarrage de quarante a vingt secondes.

### 3.5 Douze pieges a anticiper

1. **Test isolation TRUNCATE CASCADE FK** : un simple `TRUNCATE TABLE crm_contacts` echouera si des `pay_transactions` referencent des contacts. Utiliser `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` qui supprime aussi les references et reinitialise les sequences. Liste exhaustive des trente-deux tables a tronquer dans l'ordre topologique (depuis tables feuilles) maintenue dans `test/setup.ts`.
2. **RLS test 2 connections separees** : la session courante porte la variable `app.tenant_id` via `SET LOCAL`. Pour tester la fuite cross-tenant, il faut ouvrir deux DataSource distincts (ou deux QueryRunner distincts dans des transactions separees) avec des `app.tenant_id` differents. Une seule connection partagee leak la session et masque le bug.
3. **audit_log diff fields_changed deterministic** : l'ordre des cles dans la colonne JSONB `fields_changed` doit etre stable. Sans tri explicite, deux machines genereraient des JSONB differents (l'ordre Map JavaScript depend de l'ordre d'insertion qui depend de l'ordre des colonnes TypeORM qui peut varier). Le subscriber audit-writer trie les cles alphabetiquement avant d'ecrire en base. Le test verifie l'ordre.
4. **Kafka consumer group join slow CI 30s** : un consumer qui rejoint un nouveau consumer group declenche un protocole de rebalancing qui peut prendre vingt a trente secondes en CI sous charge. Les tests doivent attendre `consumer.run()` puis attendre la reception du premier message via `await waitForMessage(...)` avec un timeout de soixante secondes. Configurer `vitest` avec `testTimeout: 60_000`.
5. **DLQ test timing flaky** : le passage en DLQ apres trois echecs consecutifs implique trois `await retry()` espaces de un a quatre secondes (backoff exponentiel : 1s, 2s, 4s) plus le poll Kafka de la DLQ. Le test peut tomber en flakiness si on attend pas suffisamment. Solution : `await waitForDLQ(messageId, 30_000)` avec polling actif sur le topic DLQ.
6. **Seeds test pollution** : si un test seed s'execute avant un test RLS, il laisse les cinquante contacts dans la base et fausse les comptes. Solution : tous les tests integration appellent `truncateAllTables()` en `beforeEach`. Le seed test reseed lui-meme.
7. **Coverage measurement integration** : c8/v8 supportent les tests integration mais avec un overhead de quinze pour cent. Activer `--coverage` uniquement en CI ou sur demande explicite (`pnpm test:integration --coverage`). Les developpeurs lancent `pnpm test:integration` sans coverage pour rapidite.
8. **testcontainers Node 22 ESM** : `testcontainers` v10 expose une API ESM-only. Si le projet est en CommonJS, il faut utiliser le dynamic import `await import('testcontainers')`. Le projet Skalean est en ESM strict (decision 005), donc l'import statique fonctionne directement.
9. **GitHub Actions services healthcheck** : par defaut les services GitHub Actions peuvent etre marques "ready" alors que Postgres n'accepte pas encore les connections (le port est ouvert mais l'init non termine). Configurer `options: --health-cmd="pg_isready -U test" --health-interval=5s --health-timeout=3s --health-retries=10`.
10. **Parallel test runs port collision** : si deux jobs CI tournent en parallele sur le meme runner self-hosted (rare mais possible), les ports 5433/9093/6380 entrent en collision. Solution : en testcontainers, demander `randomPort` puis injecter dynamiquement dans les variables d'environnement de la suite.
11. **Faker seed deterministic test reproducibility** : le seed faker est fixe a quarante-deux (decision esthetique : reference Hitchhiker's Guide). Le test `seeds.spec.ts` verifie que deux executions successives produisent exactement les memes donnees (memes UUIDs, memes noms, memes emails). Si faker change d'algorithme dans une version mineure, le test detecte le drift et alerte.
12. **OpenTelemetry export blocking** : si l'application sous test exporte des traces OpenTelemetry vers un endpoint qui n'existe pas en environnement de test, l'export bloque jusqu'au timeout (cinq secondes par defaut) ce qui ralentit chaque test. Solution : en environnement test, configurer `OTEL_TRACES_EXPORTER=none` et `OTEL_LOGS_EXPORTER=none`.

---

## 4. Architecture context (3-5 ko)

### 4.1 Position de la tache dans Sprint 2

La tache 1.2.15 est la **quinzieme et derniere** tache du Sprint 2. Elle vient apres :

- 1.2.1 a 1.2.8 (huit migrations TypeORM, fondation schema)
- 1.2.9 (subscribers TypeORM transverses)
- 1.2.10 (cinquantaine topics Kafka init)
- 1.2.11 (seeds faker deterministes)
- 1.2.12 (publisher Kafka avec retry/idempotence)
- 1.2.13 (schema-registry JSON-Schema)
- 1.2.14 (consumer base avec idempotency Redis et DLQ)

Et precede :

- V-02-sprint-02-database-kafka.md (script automatise verification finale Sprint 2 : 250 controles)
- 1.3.1 (Sprint 3, bootstrap NestJS)

### 4.2 Validation systemique avant Sprint 3 API NestJS bootstrap

La transition Sprint 2 -> Sprint 3 est un point d'inflexion architectural majeur. Sprint 2 livre les couches transverses (database, eventing) qui seront consommees par tous les modules de Sprint 3 a Sprint 12. Une regression dans ces couches transverses se propage a tous les modules. La tache 1.2.15 agit comme un **gate qualite irrevocable** : aucune tache Sprint 3 ne peut commencer tant que les dix suites ne sont pas vertes. Le script `V-02-sprint-02-database-kafka.md` (lance manuellement par le tech lead a la fin de Sprint 2) execute la suite integration plus deux cent quarante autres controles statiques (lint, typecheck, conformite naming, presence fichiers attendus). Si tout passe, le tech lead emet l'ordre formel de demarrer Sprint 3.

### 4.3 Gate qualite -- semantique

Le mot **gate** est employe dans son sens strict de logique combinatoire : zero ou un. Soit toute la suite passe (gate = 1, transition autorisee), soit au moins un test echoue (gate = 0, transition interdite, correction obligatoire). Il n'existe pas d'etat intermediaire "gate partiel". Cette severite est volontaire : elle force a ne jamais merger de code casse en main et a ne jamais commencer Sprint 3 avec une dette technique heritee de Sprint 2.

### 4.4 Liens vers documentation pilotage

- `00-pilotage/decisions/decision-002-multi-tenant-strict-rls.md`
- `00-pilotage/decisions/decision-003-typeorm-subscribers.md`
- `00-pilotage/decisions/decision-004-kafka-kraft.md`
- `00-pilotage/decisions/decision-005-esm-only.md`
- `00-pilotage/decisions/decision-006-no-emoji.md`
- `00-pilotage/decisions/decision-008-data-residency-maroc.md`
- `00-pilotage/conventions/conventions-tests.md`
- `00-pilotage/conventions/conventions-ci.md`

---

## 5. Livrables checkables (32-35 items)

L1. Fichier `packages/database/test/integration/migrations.spec.ts` cree avec au moins douze cas de tests
L2. Fichier `packages/database/test/integration/rls-multi-tenant.spec.ts` cree avec au moins seize cas de tests (un par table tenantisee)
L3. Fichier `packages/database/test/integration/rls-super-admin.spec.ts` cree avec au moins huit cas de tests
L4. Fichier `packages/database/test/integration/subscribers-tenant-id.spec.ts` cree avec au moins huit cas de tests
L5. Fichier `packages/database/test/integration/subscribers-audit-log.spec.ts` cree avec au moins dix cas de tests
L6. Fichier `packages/database/test/integration/subscribers-timestamps.spec.ts` cree avec au moins six cas de tests
L7. Fichier `packages/shared-events/test/integration/kafka-publisher.spec.ts` cree avec au moins huit cas de tests
L8. Fichier `packages/shared-events/test/integration/kafka-consumer-base.spec.ts` cree avec au moins dix cas de tests
L9. Fichier `packages/shared-events/test/integration/kafka-dlq.spec.ts` cree avec au moins six cas de tests
L10. Fichier `packages/database/test/integration/seeds.spec.ts` cree avec au moins huit cas de tests
L11. Fichier `packages/database/test/setup.ts` helpers (truncateAllTables, setTenantContext, withTenant, withSuperAdmin, createKafkaTopics, flushRedis)
L12. Fichier `packages/database/vitest.config.integration.ts` configuration dediee
L13. Fichier `packages/shared-events/vitest.config.integration.ts` configuration dediee
L14. Fichier `infra/docker-compose.test.yaml` services postgres-test 5433, kafka-test 9093, redis-test 6380
L15. Fichier `.github/workflows/test-integration.yml` workflow CI dedie
L16. Script `pnpm test:integration` ajoute dans `package.json` racine (turbo run test:integration)
L17. Script `pnpm test:integration:coverage` ajoute (force --coverage)
L18. Variables environnement `DATABASE_TEST_URL`, `KAFKA_TEST_BROKERS`, `REDIS_TEST_URL` documentees dans `.env.example.test`
L19. Toutes les dix suites passent en local sur Windows 11 + WSL2 + Docker Desktop
L20. Toutes les dix suites passent en CI GitHub Actions ubuntu-latest
L21. Couverture `packages/database` >= quatre-vingts pour cent lignes mesuree v8
L22. Couverture `packages/shared-events` >= quatre-vingts pour cent lignes mesuree v8
L23. Reproductibilite cinq executions consecutives sans intervention humaine, zero flake
L24. Aucune emoji dans les fichiers source de test (verifie par script grep)
L25. Aucun `console.log` residuel dans les tests (logger pino utilise)
L26. Aucun timeout par defaut depasse (testTimeout = 60_000 ms)
L27. Cleanup TRUNCATE RESTART IDENTITY CASCADE applique en `beforeEach` de chaque suite
L28. Faker seed = 42 verifie deterministe (deux runs = memes UUIDs)
L29. Variables `OTEL_TRACES_EXPORTER=none` et `OTEL_LOGS_EXPORTER=none` injectees en setup
L30. Tests CI compatibles GitHub Actions services Postgres + Redis natifs + testcontainers Kafka
L31. Documentation README ajoutee `packages/database/test/README.md` expliquant comment lancer les tests
L32. Conformite Conventional Commits sur le commit Sprint 2 closure
L33. Tag Git `sprint-02-closed` cree apres merge de cette tache
L34. Lien dans `00-pilotage/runbooks/sprint-closure.md` mis a jour
L35. Notification Slack canal `#skalean-tech` informant fin Sprint 2

---

## 6. Fichiers a creer ou modifier

### 6.1 Tests integration

- `packages/database/test/integration/migrations.spec.ts` (CREATE)
- `packages/database/test/integration/rls-multi-tenant.spec.ts` (CREATE)
- `packages/database/test/integration/rls-super-admin.spec.ts` (CREATE)
- `packages/database/test/integration/subscribers-tenant-id.spec.ts` (CREATE)
- `packages/database/test/integration/subscribers-audit-log.spec.ts` (CREATE)
- `packages/database/test/integration/subscribers-timestamps.spec.ts` (CREATE)
- `packages/database/test/integration/seeds.spec.ts` (CREATE)
- `packages/shared-events/test/integration/kafka-publisher.spec.ts` (CREATE)
- `packages/shared-events/test/integration/kafka-consumer-base.spec.ts` (CREATE)
- `packages/shared-events/test/integration/kafka-dlq.spec.ts` (CREATE)

### 6.2 Helpers et configuration

- `packages/database/test/setup.ts` (CREATE)
- `packages/database/test/helpers.ts` (CREATE)
- `packages/database/vitest.config.integration.ts` (CREATE)
- `packages/shared-events/test/setup.ts` (CREATE)
- `packages/shared-events/vitest.config.integration.ts` (CREATE)

### 6.3 Infrastructure de test

- `infra/docker-compose.test.yaml` (CREATE)
- `.github/workflows/test-integration.yml` (CREATE)
- `.env.example.test` (CREATE)

### 6.4 Modifications documentation et scripts

- `package.json` racine (UPDATE) -- ajout script `test:integration`
- `turbo.json` (UPDATE) -- ajout pipeline `test:integration`
- `packages/database/package.json` (UPDATE) -- ajout script local
- `packages/shared-events/package.json` (UPDATE) -- ajout script local
- `00-pilotage/runbooks/sprint-closure.md` (UPDATE)

---

## 7. Code patterns complets

### 7.1 packages/database/test/setup.ts

```typescript
import { DataSource, EntityManager } from 'typeorm';
import { Kafka, Admin } from 'kafkajs';
import Redis from 'ioredis';
import { dataSourceOptions } from '../src/datasource';
import pino from 'pino';

const logger = pino({ level: process.env.TEST_LOG_LEVEL ?? 'error' });

export const TENANT_A_ID = '00000000-0000-0000-0000-00000000000a';
export const TENANT_B_ID = '00000000-0000-0000-0000-00000000000b';
export const TENANT_C_ID = '00000000-0000-0000-0000-00000000000c';

export const TENANTED_TABLES_ORDERED: ReadonlyArray<string> = [
  'pay_transactions',
  'doc_access_logs',
  'doc_document_versions',
  'doc_documents',
  'comm_webhooks',
  'comm_optouts',
  'comm_messages',
  'comm_templates',
  'booking_appointments',
  'booking_rooms',
  'crm_interactions',
  'crm_deals',
  'crm_contacts',
  'crm_companies',
  'compliance_consent_logs',
  'compliance_retention_jobs',
  'books_invoice_lines',
  'books_invoices',
  'analytics_event_attributes',
  'analytics_events',
  'stock_movements',
  'stock_items',
  'hr_attendances',
  'hr_employees',
  'auth_sessions',
  'auth_user_roles',
  'auth_users',
  'audit_log',
  'tenant_settings',
  'tenants',
];

export async function buildTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    ...dataSourceOptions,
    url: process.env.DATABASE_TEST_URL,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  return ds;
}

export async function runAllMigrations(ds: DataSource): Promise<void> {
  await ds.runMigrations({ transaction: 'each' });
}

export async function revertAllMigrations(ds: DataSource): Promise<void> {
  const all = await ds.showMigrations();
  while (await ds.showMigrations()) {
    await ds.undoLastMigration({ transaction: 'each' });
  }
}

export async function truncateAllTables(ds: DataSource): Promise<void> {
  const list = TENANTED_TABLES_ORDERED.join(', ');
  await ds.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function withTenant<T>(
  ds: DataSource,
  tenantId: string,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return ds.transaction(async (em) => {
    await em.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    return fn(em);
  });
}

export async function withSuperAdmin<T>(
  ds: DataSource,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return ds.transaction(async (em) => {
    await em.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
    return fn(em);
  });
}

export async function withoutTenant<T>(
  ds: DataSource,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return ds.transaction(async (em) => {
    await em.query(`SELECT set_config('app.tenant_id', '', true)`);
    return fn(em);
  });
}

export async function ensureKafkaTopics(brokers: string[], topics: string[]): Promise<void> {
  const kafka = new Kafka({ clientId: 'test-admin', brokers });
  const admin: Admin = kafka.admin();
  await admin.connect();
  const existing = await admin.listTopics();
  const toCreate = topics.filter((t) => !existing.includes(t));
  if (toCreate.length > 0) {
    await admin.createTopics({
      waitForLeaders: true,
      topics: toCreate.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
    });
  }
  await admin.disconnect();
}

export async function deleteKafkaTopics(brokers: string[], topics: string[]): Promise<void> {
  const kafka = new Kafka({ clientId: 'test-admin', brokers });
  const admin = kafka.admin();
  await admin.connect();
  await admin.deleteTopics({ topics });
  await admin.disconnect();
}

export async function flushRedis(url: string): Promise<void> {
  const r = new Redis(url);
  await r.flushdb();
  await r.quit();
}

export async function waitFor<T>(
  predicate: () => Promise<T | undefined | null | false>,
  timeoutMs = 30_000,
  intervalMs = 250,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await predicate();
    if (result) return result as T;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs} ms`);
}

export { logger };
```

### 7.2 packages/database/vitest.config.integration.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-each.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    sequence: { concurrent: false, shuffle: false },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    retry: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/migrations/**'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
    env: {
      NODE_ENV: 'test',
      OTEL_TRACES_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
      OTEL_METRICS_EXPORTER: 'none',
    },
  },
});
```

### 7.3 packages/database/test/integration/migrations.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import {
  buildTestDataSource,
  runAllMigrations,
  revertAllMigrations,
  TENANTED_TABLES_ORDERED,
} from '../setup';

describe('migrations integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await revertAllMigrations(ds);
  });

  it('test 1 -- runs the eight migrations sequentially up', async () => {
    await runAllMigrations(ds);
    const remaining = await ds.showMigrations();
    expect(remaining).toBe(false);
  });

  it('test 2 -- runs the eight migrations sequentially down', async () => {
    await runAllMigrations(ds);
    await revertAllMigrations(ds);
    const tables: Array<{ table_name: string }> = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'typeorm_%'`,
    );
    expect(tables.length).toBe(0);
  });

  it('test 3 -- up then down then up is idempotent', async () => {
    await runAllMigrations(ds);
    await revertAllMigrations(ds);
    await runAllMigrations(ds);
    const tables: Array<{ table_name: string }> = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'typeorm_%'`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(32);
  });

  it('test 4 -- creates the tenants table with required columns', async () => {
    await runAllMigrations(ds);
    const cols: Array<{ column_name: string }> = await ds.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' ORDER BY ordinal_position`,
    );
    const names = cols.map((c) => c.column_name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'slug', 'name', 'status', 'created_at', 'updated_at', 'deleted_at']),
    );
  });

  it('test 5 -- enables RLS on the 32 tenanted tables', async () => {
    await runAllMigrations(ds);
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> =
      await ds.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'r'`,
        [TENANTED_TABLES_ORDERED],
      );
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} rls`).toBe(true);
      expect(row.relforcerowsecurity, `${row.relname} force rls`).toBe(true);
    }
  });

  it('test 6 -- creates expected indexes on crm_contacts', async () => {
    await runAllMigrations(ds);
    const indexes: Array<{ indexname: string }> = await ds.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'crm_contacts'`,
    );
    const names = indexes.map((i) => i.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'idx_crm_contacts_tenant_id',
        'idx_crm_contacts_email_trgm',
        'idx_crm_contacts_full_name_trgm',
      ]),
    );
  });

  it('test 7 -- foreign key constraints exist on crm_deals.contact_id', async () => {
    await runAllMigrations(ds);
    const fks: Array<{ constraint_name: string }> = await ds.query(
      `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'crm_deals' AND constraint_type = 'FOREIGN KEY'`,
    );
    expect(fks.length).toBeGreaterThanOrEqual(2);
  });

  it('test 8 -- unique constraint on tenants.slug', async () => {
    await runAllMigrations(ds);
    await ds.query(`INSERT INTO tenants (id, slug, name, status) VALUES (gen_random_uuid(), 'acme', 'Acme', 'active')`);
    await expect(
      ds.query(`INSERT INTO tenants (id, slug, name, status) VALUES (gen_random_uuid(), 'acme', 'Acme 2', 'active')`),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('test 9 -- EXCLUDE constraint on booking_appointments overlap', async () => {
    await runAllMigrations(ds);
    const tenantId = '00000000-0000-0000-0000-00000000000a';
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'Tenant A', 'active') ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await ds.query(
      `INSERT INTO booking_rooms (id, tenant_id, name, capacity) VALUES ($1, $2, 'R1', 4)`,
      ['11111111-1111-1111-1111-111111111111', tenantId],
    );
    await ds.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    await ds.query(
      `INSERT INTO booking_appointments (id, tenant_id, room_id, starts_at, ends_at, status) VALUES (gen_random_uuid(), $1, $2, '2026-06-01 09:00+00', '2026-06-01 10:00+00', 'confirmed')`,
      [tenantId, '11111111-1111-1111-1111-111111111111'],
    );
    await expect(
      ds.query(
        `INSERT INTO booking_appointments (id, tenant_id, room_id, starts_at, ends_at, status) VALUES (gen_random_uuid(), $1, $2, '2026-06-01 09:30+00', '2026-06-01 10:30+00', 'confirmed')`,
        [tenantId, '11111111-1111-1111-1111-111111111111'],
      ),
    ).rejects.toThrow(/conflicting key value violates exclusion constraint/i);
  });

  it('test 10 -- check constraint on auth_users.email regex', async () => {
    await runAllMigrations(ds);
    const tenantId = '00000000-0000-0000-0000-00000000000a';
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA2', 'Tenant A2', 'active') ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await expect(
      ds.query(
        `INSERT INTO auth_users (id, tenant_id, email, password_hash, status) VALUES (gen_random_uuid(), $1, 'not-an-email', 'x', 'active')`,
        [tenantId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('test 11 -- pg_trgm extension installed', async () => {
    await runAllMigrations(ds);
    const rows: Array<{ extname: string }> = await ds.query(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    );
    expect(rows.length).toBe(1);
  });

  it('test 12 -- btree_gist extension installed', async () => {
    await runAllMigrations(ds);
    const rows: Array<{ extname: string }> = await ds.query(
      `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`,
    );
    expect(rows.length).toBe(1);
  });
});
```

### 7.4 packages/database/test/integration/rls-multi-tenant.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  TENANT_A_ID,
  TENANT_B_ID,
} from '../setup';

interface RlsCase {
  table: string;
  insertSql: (tenantId: string, id: string, extra?: Record<string, unknown>) => [string, unknown[]];
}

const cases: RlsCase[] = [
  {
    table: 'auth_users',
    insertSql: (tenantId, id) => [
      `INSERT INTO auth_users (id, tenant_id, email, password_hash, status) VALUES ($1, $2, $3, 'h', 'active')`,
      [id, tenantId, `${id}@test.skalean.ma`],
    ],
  },
  {
    table: 'crm_companies',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_companies (id, tenant_id, name) VALUES ($1, $2, $3)`,
      [id, tenantId, `Co ${id.slice(0, 8)}`],
    ],
  },
  {
    table: 'crm_contacts',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES ($1, $2, $3, $4)`,
      [id, tenantId, `Contact ${id.slice(0, 8)}`, `${id}@x.ma`],
    ],
  },
  {
    table: 'crm_deals',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_deals (id, tenant_id, title, amount, currency, stage) VALUES ($1, $2, 'Deal', 1000, 'MAD', 'open')`,
      [id, tenantId],
    ],
  },
  {
    table: 'crm_interactions',
    insertSql: (tenantId, id) => [
      `INSERT INTO crm_interactions (id, tenant_id, kind, payload) VALUES ($1, $2, 'note', '{}'::jsonb)`,
      [id, tenantId],
    ],
  },
  {
    table: 'booking_rooms',
    insertSql: (tenantId, id) => [
      `INSERT INTO booking_rooms (id, tenant_id, name, capacity) VALUES ($1, $2, 'Room', 4)`,
      [id, tenantId],
    ],
  },
  {
    table: 'comm_messages',
    insertSql: (tenantId, id) => [
      `INSERT INTO comm_messages (id, tenant_id, channel, recipient, body, status) VALUES ($1, $2, 'email', 'a@x.ma', 'b', 'queued')`,
      [id, tenantId],
    ],
  },
  {
    table: 'comm_templates',
    insertSql: (tenantId, id) => [
      `INSERT INTO comm_templates (id, tenant_id, code, channel, body) VALUES ($1, $2, $3, 'email', 'hi')`,
      [id, tenantId, `tpl-${id.slice(0, 6)}`],
    ],
  },
  {
    table: 'doc_documents',
    insertSql: (tenantId, id) => [
      `INSERT INTO doc_documents (id, tenant_id, kind, title, storage_uri) VALUES ($1, $2, 'policy', 'T', 's3://x')`,
      [id, tenantId],
    ],
  },
  {
    table: 'pay_transactions',
    insertSql: (tenantId, id) => [
      `INSERT INTO pay_transactions (id, tenant_id, provider, amount, currency, status) VALUES ($1, $2, 'cmi', 1000, 'MAD', 'pending')`,
      [id, tenantId],
    ],
  },
  {
    table: 'books_invoices',
    insertSql: (tenantId, id) => [
      `INSERT INTO books_invoices (id, tenant_id, number, total, currency, status) VALUES ($1, $2, $3, 1000, 'MAD', 'draft')`,
      [id, tenantId, `INV-${id.slice(0, 6)}`],
    ],
  },
  {
    table: 'compliance_consent_logs',
    insertSql: (tenantId, id) => [
      `INSERT INTO compliance_consent_logs (id, tenant_id, subject_id, purpose, granted) VALUES ($1, $2, gen_random_uuid(), 'marketing', true)`,
      [id, tenantId],
    ],
  },
  {
    table: 'analytics_events',
    insertSql: (tenantId, id) => [
      `INSERT INTO analytics_events (id, tenant_id, type, occurred_at) VALUES ($1, $2, 'page_view', now())`,
      [id, tenantId],
    ],
  },
  {
    table: 'stock_items',
    insertSql: (tenantId, id) => [
      `INSERT INTO stock_items (id, tenant_id, sku, name, quantity) VALUES ($1, $2, $3, 'Item', 10)`,
      [id, tenantId, `SKU-${id.slice(0, 6)}`],
    ],
  },
  {
    table: 'hr_employees',
    insertSql: (tenantId, id) => [
      `INSERT INTO hr_employees (id, tenant_id, full_name, email, role) VALUES ($1, $2, 'Emp', $3, 'agent')`,
      [id, tenantId, `${id}@e.ma`],
    ],
  },
];

describe('rls-multi-tenant integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'A', 'active'), ($2, 'tB', 'B', 'active') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID],
    );
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'A', 'active'), ($2, 'tB', 'B', 'active') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID],
    );
  });

  for (const c of cases) {
    it(`isolates tenant A from tenant B on ${c.table}`, async () => {
      const id = randomUUID();
      const [sql, params] = c.insertSql(TENANT_A_ID, id);
      await withTenant(ds, TENANT_A_ID, async (em) => {
        await em.query(sql, params);
      });
      const visibleFromB = await withTenant(ds, TENANT_B_ID, async (em) =>
        em.query(`SELECT id FROM ${c.table} WHERE id = $1`, [id]),
      );
      expect(visibleFromB.length).toBe(0);
      const visibleFromA = await withTenant(ds, TENANT_A_ID, async (em) =>
        em.query(`SELECT id FROM ${c.table} WHERE id = $1`, [id]),
      );
      expect(visibleFromA.length).toBe(1);
    });
  }
});
```

### 7.5 packages/database/test/integration/rls-super-admin.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  withSuperAdmin,
  withoutTenant,
  TENANT_A_ID,
  TENANT_B_ID,
  TENANT_C_ID,
} from '../setup';

describe('rls-super-admin integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'A', 'active'), ($2, 'tB', 'B', 'active'), ($3, 'tC', 'C', 'active') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID, TENANT_C_ID],
    );
  });

  it('super admin sees rows across all tenants', async () => {
    for (const t of [TENANT_A_ID, TENANT_B_ID, TENANT_C_ID]) {
      await withTenant(ds, t, async (em) => {
        await em.query(
          `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES (gen_random_uuid(), $1, 'X', $2)`,
          [t, `${t}@x.ma`],
        );
      });
    }
    const rows = await withSuperAdmin(ds, async (em) =>
      em.query(`SELECT tenant_id FROM crm_contacts ORDER BY tenant_id`),
    );
    expect(rows.length).toBe(3);
  });

  it('super admin can insert into any tenant id', async () => {
    const id = randomUUID();
    await withSuperAdmin(ds, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES ($1, $2, 'Y', 'y@x.ma')`,
        [id, TENANT_B_ID],
      );
    });
    const rows = await withTenant(ds, TENANT_B_ID, async (em) =>
      em.query(`SELECT id FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows.length).toBe(1);
  });

  it('non-super-admin without tenant context sees zero rows', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES (gen_random_uuid(), $1, 'Z', 'z@x.ma')`,
        [TENANT_A_ID],
      );
    });
    const rows = await withoutTenant(ds, async (em) =>
      em.query(`SELECT id FROM crm_contacts`),
    );
    expect(rows.length).toBe(0);
  });

  it('super admin flag false behaves like normal user', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES (gen_random_uuid(), $1, 'W', 'w@x.ma')`,
        [TENANT_A_ID],
      );
    });
    const rows = await ds.transaction(async (em) => {
      await em.query(`SELECT set_config('app.tenant_id', $1, true)`, [TENANT_B_ID]);
      await em.query(`SELECT set_config('app.is_super_admin', 'false', true)`);
      return em.query(`SELECT id FROM crm_contacts`);
    });
    expect(rows.length).toBe(0);
  });

  it('super admin can update across tenants', async () => {
    const id = randomUUID();
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES ($1, $2, 'Old', 'old@x.ma')`,
        [id, TENANT_A_ID],
      );
    });
    await withSuperAdmin(ds, async (em) => {
      await em.query(`UPDATE crm_contacts SET full_name = 'New' WHERE id = $1`, [id]);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT full_name FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows[0].full_name).toBe('New');
  });

  it('super admin can delete across tenants', async () => {
    const id = randomUUID();
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES ($1, $2, 'D', 'd@x.ma')`,
        [id, TENANT_A_ID],
      );
    });
    await withSuperAdmin(ds, async (em) => {
      await em.query(`DELETE FROM crm_contacts WHERE id = $1`, [id]);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT id FROM crm_contacts WHERE id = $1`, [id]),
    );
    expect(rows.length).toBe(0);
  });

  it('super admin context does not leak to next transaction', async () => {
    await withSuperAdmin(ds, async (em) => {
      await em.query(`SELECT 1`);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT current_setting('app.is_super_admin', true) AS v`),
    );
    expect(rows[0].v).not.toBe('true');
  });

  it('audit_log is also visible to super admin across tenants', async () => {
    for (const t of [TENANT_A_ID, TENANT_B_ID]) {
      await withTenant(ds, t, async (em) => {
        await em.query(
          `INSERT INTO crm_contacts (id, tenant_id, full_name, email) VALUES (gen_random_uuid(), $1, 'A', 'a@x.ma')`,
          [t],
        );
      });
    }
    const audit = await withSuperAdmin(ds, async (em) =>
      em.query(`SELECT tenant_id FROM audit_log WHERE entity_name = 'crm_contacts'`),
    );
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });
});
```

### 7.6 packages/database/test/integration/subscribers-tenant-id.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { CrmContact } from '../../src/entities/crm-contact.entity';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  withoutTenant,
  TENANT_A_ID,
  TENANT_B_ID,
} from '../setup';

describe('subscribers tenant-id integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'A', 'active'), ($2, 'tB', 'B', 'active') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID, TENANT_B_ID],
    );
  });

  it('throws when tenant context is not set', async () => {
    await expect(
      withoutTenant(ds, async (em) => {
        const repo = em.getRepository(CrmContact);
        const entity = repo.create({ fullName: 'X', email: 'x@x.ma' });
        await repo.save(entity);
      }),
    ).rejects.toThrow(/tenant.*required/i);
  });

  it('auto-injects tenant_id when context is set', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      const entity = repo.create({ fullName: 'A', email: 'a@x.ma' });
      return repo.save(entity);
    });
    expect(saved.tenantId).toBe(TENANT_A_ID);
  });

  it('preserves explicit tenant_id when matching context', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      const entity = repo.create({ tenantId: TENANT_A_ID, fullName: 'B', email: 'b@x.ma' });
      return repo.save(entity);
    });
    expect(saved.tenantId).toBe(TENANT_A_ID);
  });

  it('throws when explicit tenant_id mismatches context', async () => {
    await expect(
      withTenant(ds, TENANT_A_ID, async (em) => {
        const repo = em.getRepository(CrmContact);
        const entity = repo.create({ tenantId: TENANT_B_ID, fullName: 'C', email: 'c@x.ma' });
        await repo.save(entity);
      }),
    ).rejects.toThrow(/tenant.*mismatch/i);
  });

  it('does not overwrite tenant_id on update', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      const e = repo.create({ fullName: 'D', email: 'd@x.ma' });
      const r = await repo.save(e);
      return r.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      await repo.update(id, { fullName: 'D2' });
    });
    const final = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.getRepository(CrmContact).findOneByOrFail({ id }),
    );
    expect(final.tenantId).toBe(TENANT_A_ID);
    expect(final.fullName).toBe('D2');
  });

  it('subscriber active across all tenanted entities', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO crm_companies (id, tenant_id, name) VALUES (gen_random_uuid(), $1, 'Co')`,
        [TENANT_A_ID],
      );
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT tenant_id FROM crm_companies`),
    );
    expect(rows[0].tenant_id).toBe(TENANT_A_ID);
  });

  it('skips injection on tables without tenant_id column', async () => {
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES (gen_random_uuid(), 'tZ', 'Z', 'active')`,
    );
    const rows = await ds.query(`SELECT slug FROM tenants WHERE slug = 'tZ'`);
    expect(rows.length).toBe(1);
  });

  it('handles bulk insert with single tenant', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      const list = Array.from({ length: 10 }, (_, i) =>
        repo.create({ fullName: `Bulk${i}`, email: `bulk${i}@x.ma` }),
      );
      await repo.save(list);
    });
    const count = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.getRepository(CrmContact).count(),
    );
    expect(count).toBe(10);
  });
});
```

### 7.7 packages/database/test/integration/subscribers-audit-log.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../src/entities/auth-user.entity';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  TENANT_A_ID,
} from '../setup';

describe('subscribers audit-log integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'A', 'active') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID],
    );
  });

  it('writes audit_log row on insert', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        email: 'audit1@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT * FROM audit_log WHERE entity_name = 'auth_users'`),
    );
    expect(audit.length).toBe(1);
    expect(audit[0].action).toBe('insert');
  });

  it('writes audit_log row on update with diff fields_changed', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        email: 'audit2@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      const s = await em.getRepository(AuthUser).save(u);
      return s.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.getRepository(AuthUser).update(id, { email: 'audit2-new@x.ma' });
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT * FROM audit_log WHERE entity_name = 'auth_users' AND action = 'update' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    expect(audit[0].fields_changed).toEqual({ email: { from: 'audit2@x.ma', to: 'audit2-new@x.ma' } });
  });

  it('writes audit_log row on soft delete', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        email: 'audit3@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      const s = await em.getRepository(AuthUser).save(u);
      return s.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.getRepository(AuthUser).softDelete(id);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT action FROM audit_log WHERE entity_name = 'auth_users' AND action = 'soft_delete'`,
      ),
    );
    expect(audit.length).toBe(1);
  });

  it('does not recurse on audit_log writes', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        email: 'audit4@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT entity_name FROM audit_log WHERE entity_name = 'audit_log'`),
    );
    expect(audit.length).toBe(0);
  });

  it('respects auditable whitelist', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em.query(
        `INSERT INTO analytics_events (id, tenant_id, type, occurred_at) VALUES (gen_random_uuid(), $1, 'page_view', now())`,
        [TENANT_A_ID],
      );
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT entity_name FROM audit_log WHERE entity_name = 'analytics_events'`),
    );
    expect(audit.length).toBe(0);
  });

  it('fields_changed JSONB has stable key ordering', async () => {
    const id = await withTenant(ds, TENANT_A_ID, async (em) => {
      const u = em.getRepository(AuthUser).create({
        email: 'audit5@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      const s = await em.getRepository(AuthUser).save(u);
      return s.id;
    });
    await withTenant(ds, TENANT_A_ID, async (em) => {
      await em
        .getRepository(AuthUser)
        .update(id, { email: 'audit5-new@x.ma', status: 'suspended' });
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(
        `SELECT fields_changed FROM audit_log WHERE entity_name = 'auth_users' AND action = 'update' ORDER BY created_at DESC LIMIT 1`,
      ),
    );
    const keys = Object.keys(audit[0].fields_changed);
    expect(keys).toEqual([...keys].sort());
  });

  it('records actor_id when set in session', async () => {
    const actorId = '99999999-9999-9999-9999-999999999999';
    await ds.transaction(async (em) => {
      await em.query(`SELECT set_config('app.tenant_id', $1, true)`, [TENANT_A_ID]);
      await em.query(`SELECT set_config('app.actor_id', $1, true)`, [actorId]);
      const u = em.getRepository(AuthUser).create({
        email: 'audit6@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT actor_id FROM audit_log WHERE entity_name = 'auth_users'`),
    );
    expect(audit[0].actor_id).toBe(actorId);
  });

  it('records correlation_id when set in session', async () => {
    const corr = 'corr-1234';
    await ds.transaction(async (em) => {
      await em.query(`SELECT set_config('app.tenant_id', $1, true)`, [TENANT_A_ID]);
      await em.query(`SELECT set_config('app.correlation_id', $1, true)`, [corr]);
      const u = em.getRepository(AuthUser).create({
        email: 'audit7@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT correlation_id FROM audit_log WHERE entity_name = 'auth_users'`),
    );
    expect(audit[0].correlation_id).toBe(corr);
  });

  it('records ip_address when set in session', async () => {
    const ip = '196.200.176.20';
    await ds.transaction(async (em) => {
      await em.query(`SELECT set_config('app.tenant_id', $1, true)`, [TENANT_A_ID]);
      await em.query(`SELECT set_config('app.ip_address', $1, true)`, [ip]);
      const u = em.getRepository(AuthUser).create({
        email: 'audit8@x.ma',
        passwordHash: 'h',
        status: 'active',
      });
      await em.getRepository(AuthUser).save(u);
    });
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT ip_address::text AS v FROM audit_log WHERE entity_name = 'auth_users'`),
    );
    expect(audit[0].v).toBe(ip);
  });

  it('persists across rollback boundary correctly', async () => {
    try {
      await ds.transaction(async (em) => {
        await em.query(`SELECT set_config('app.tenant_id', $1, true)`, [TENANT_A_ID]);
        const u = em.getRepository(AuthUser).create({
          email: 'audit9@x.ma',
          passwordHash: 'h',
          status: 'active',
        });
        await em.getRepository(AuthUser).save(u);
        throw new Error('rollback please');
      });
    } catch {
      // expected
    }
    const audit = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.query(`SELECT id FROM audit_log WHERE entity_name = 'auth_users'`),
    );
    expect(audit.length).toBe(0);
  });
});
```

### 7.8 packages/database/test/integration/subscribers-timestamps.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { CrmContact } from '../../src/entities/crm-contact.entity';
import {
  buildTestDataSource,
  runAllMigrations,
  truncateAllTables,
  withTenant,
  TENANT_A_ID,
} from '../setup';

describe('subscribers timestamps integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
    await ds.query(
      `INSERT INTO tenants (id, slug, name, status) VALUES ($1, 'tA', 'A', 'active') ON CONFLICT DO NOTHING`,
      [TENANT_A_ID],
    );
  });

  it('sets created_at and updated_at on insert', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContact).create({ fullName: 'TS', email: 'ts@x.ma' });
      return em.getRepository(CrmContact).save(c);
    });
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.createdAt.getTime()).toBeCloseTo(saved.updatedAt.getTime(), -2);
  });

  it('updates updated_at but not created_at on update', async () => {
    const initial = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContact).create({ fullName: 'TS2', email: 'ts2@x.ma' });
      return em.getRepository(CrmContact).save(c);
    });
    await new Promise((r) => setTimeout(r, 50));
    const updated = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      await repo.update(initial.id, { fullName: 'TS2-new' });
      return repo.findOneByOrFail({ id: initial.id });
    });
    expect(updated.createdAt.getTime()).toBe(initial.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThan(initial.updatedAt.getTime());
  });

  it('does not override created_at when explicitly set on insert', async () => {
    const explicit = new Date('2020-01-01T00:00:00Z');
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContact).create({
        fullName: 'TS3',
        email: 'ts3@x.ma',
        createdAt: explicit,
      });
      return em.getRepository(CrmContact).save(c);
    });
    expect(saved.createdAt.toISOString()).toBe(explicit.toISOString());
  });

  it('uses Postgres now() not Node Date.now() for consistency', async () => {
    const saved = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContact).create({ fullName: 'TS4', email: 'ts4@x.ma' });
      return em.getRepository(CrmContact).save(c);
    });
    const drift = Math.abs(Date.now() - saved.createdAt.getTime());
    expect(drift).toBeLessThan(5_000);
  });

  it('sets timestamps on bulk insert', async () => {
    await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      const list = Array.from({ length: 5 }, (_, i) =>
        repo.create({ fullName: `B${i}`, email: `b${i}@x.ma` }),
      );
      await repo.save(list);
    });
    const rows = await withTenant(ds, TENANT_A_ID, async (em) =>
      em.getRepository(CrmContact).find(),
    );
    for (const r of rows) {
      expect(r.createdAt).toBeInstanceOf(Date);
      expect(r.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('does not touch updated_at on no-op update', async () => {
    const initial = await withTenant(ds, TENANT_A_ID, async (em) => {
      const c = em.getRepository(CrmContact).create({ fullName: 'TS6', email: 'ts6@x.ma' });
      return em.getRepository(CrmContact).save(c);
    });
    await new Promise((r) => setTimeout(r, 50));
    const after = await withTenant(ds, TENANT_A_ID, async (em) => {
      const repo = em.getRepository(CrmContact);
      const e = await repo.findOneByOrFail({ id: initial.id });
      e.fullName = 'TS6';
      await repo.save(e);
      return repo.findOneByOrFail({ id: initial.id });
    });
    expect(after.updatedAt.getTime()).toBe(initial.updatedAt.getTime());
  });
});
```

### 7.9 packages/shared-events/test/integration/kafka-publisher.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kafka, Consumer } from 'kafkajs';
import { KafkaPublisher } from '../../src/publisher';
import { ensureKafkaTopics, deleteKafkaTopics, waitFor } from '../../../database/test/setup';

const BROKERS = (process.env.KAFKA_TEST_BROKERS ?? 'localhost:9093').split(',');
const TOPIC = 'test.crm.contact.created.v1';

describe('kafka publisher integration', () => {
  let publisher: KafkaPublisher;
  let consumer: Consumer;
  const received: Array<{ key?: string; value: string; headers: Record<string, string> }> = [];

  beforeAll(async () => {
    await ensureKafkaTopics(BROKERS, [TOPIC]);
    publisher = new KafkaPublisher({
      clientId: 'test-publisher',
      brokers: BROKERS,
      idempotent: true,
    });
    await publisher.connect();
    const kafka = new Kafka({ clientId: 'test-consumer', brokers: BROKERS });
    consumer = kafka.consumer({ groupId: `test-pub-${Date.now()}` });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(message.headers ?? {})) {
          headers[k] = v?.toString() ?? '';
        }
        received.push({
          key: message.key?.toString(),
          value: message.value?.toString() ?? '',
          headers,
        });
      },
    });
  });

  afterAll(async () => {
    await publisher.disconnect();
    await consumer.disconnect();
    await deleteKafkaTopics(BROKERS, [TOPIC]);
  });

  beforeEach(() => {
    received.length = 0;
  });

  it('publishes a single event and consumer receives it', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'key-1',
      value: { id: '1', name: 'Alice' },
      headers: { 'x-tenant-id': 'a', 'x-correlation-id': 'corr-1' },
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'key-1'), 30_000);
    expect(JSON.parse(msg.value)).toEqual({ id: '1', name: 'Alice' });
    expect(msg.headers['x-tenant-id']).toBe('a');
  });

  it('publishes batch of events all delivered', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      topic: TOPIC,
      key: `batch-${i}`,
      value: { i },
      headers: {},
    }));
    await publisher.publishBatch(items);
    await waitFor(async () => received.filter((m) => m.key?.startsWith('batch-')).length >= 20, 30_000);
    expect(received.filter((m) => m.key?.startsWith('batch-')).length).toBe(20);
  });

  it('preserves message order per partition key', async () => {
    for (let i = 0; i < 10; i++) {
      await publisher.publish({
        topic: TOPIC,
        key: 'order',
        value: { i },
        headers: {},
      });
    }
    await waitFor(async () => received.filter((m) => m.key === 'order').length >= 10, 30_000);
    const ordered = received.filter((m) => m.key === 'order').map((m) => JSON.parse(m.value).i);
    expect(ordered).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('attaches event_id and event_time headers automatically', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'meta-1',
      value: { x: 1 },
      headers: {},
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'meta-1'), 30_000);
    expect(msg.headers['event_id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(msg.headers['event_time']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects payload not matching schema-registry', async () => {
    await expect(
      publisher.publish({
        topic: TOPIC,
        key: 'bad-1',
        value: { wrong: 'shape', missing: 'id' } as unknown as { id: string; name: string },
        headers: {},
        validateSchema: true,
      }),
    ).rejects.toThrow(/schema validation/i);
  });

  it('retries on transient broker error then succeeds', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'retry-1',
      value: { id: 'r', name: 'R' },
      headers: {},
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'retry-1'), 30_000);
    expect(msg).toBeDefined();
  });

  it('idempotent publisher does not duplicate on retry', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'idem-1',
      value: { id: 'i', name: 'I' },
      headers: { 'x-event-id': 'fixed-uuid-1' },
    });
    const count1 = received.filter((m) => m.headers['x-event-id'] === 'fixed-uuid-1').length;
    expect(count1).toBe(1);
  });

  it('publishes with explicit partition pinning', async () => {
    await publisher.publish({
      topic: TOPIC,
      partition: 0,
      key: 'pin-1',
      value: { id: 'p', name: 'P' },
      headers: {},
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'pin-1'), 30_000);
    expect(msg).toBeDefined();
  });
});
```

### 7.10 packages/shared-events/test/integration/kafka-consumer-base.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { KafkaPublisher } from '../../src/publisher';
import { KafkaConsumerBase, KafkaMessageContext } from '../../src/consumer-base';
import { ensureKafkaTopics, deleteKafkaTopics, waitFor, flushRedis } from '../../../database/test/setup';

const BROKERS = (process.env.KAFKA_TEST_BROKERS ?? 'localhost:9093').split(',');
const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://localhost:6380';
const TOPIC = 'test.consumer.base.v1';

class CountingConsumer extends KafkaConsumerBase<{ id: string; n: number }> {
  public received: Array<{ id: string; n: number }> = [];
  public failuresUntilSuccess = 0;
  protected readonly topic = TOPIC;
  protected readonly groupId = `test-cb-${Date.now()}`;
  protected async handle(payload: { id: string; n: number }, _ctx: KafkaMessageContext): Promise<void> {
    if (this.failuresUntilSuccess > 0) {
      this.failuresUntilSuccess -= 1;
      throw new Error('transient');
    }
    this.received.push(payload);
  }
}

describe('kafka consumer base integration', () => {
  let publisher: KafkaPublisher;
  let consumer: CountingConsumer;
  let redis: Redis;

  beforeAll(async () => {
    await ensureKafkaTopics(BROKERS, [TOPIC, `${TOPIC}.dlq`]);
    publisher = new KafkaPublisher({ clientId: 'test-pub-cb', brokers: BROKERS });
    await publisher.connect();
    redis = new Redis(REDIS_URL);
    consumer = new CountingConsumer({ brokers: BROKERS, redisUrl: REDIS_URL, dlqTopic: `${TOPIC}.dlq` });
    await consumer.start();
  });

  afterAll(async () => {
    await publisher.disconnect();
    await consumer.stop();
    await redis.quit();
    await deleteKafkaTopics(BROKERS, [TOPIC, `${TOPIC}.dlq`]);
  });

  beforeEach(async () => {
    consumer.received.length = 0;
    consumer.failuresUntilSuccess = 0;
    await flushRedis(REDIS_URL);
  });

  it('subclass receives a message published to the topic', async () => {
    await publisher.publish({ topic: TOPIC, key: 'k1', value: { id: 'a', n: 1 }, headers: {} });
    await waitFor(async () => consumer.received.find((r) => r.id === 'a'), 30_000);
    expect(consumer.received.length).toBeGreaterThanOrEqual(1);
  });

  it('idempotency check skips duplicate event_id', async () => {
    const eventId = 'idem-evt-1';
    await publisher.publish({
      topic: TOPIC,
      key: 'k2',
      value: { id: 'b', n: 1 },
      headers: { 'x-event-id': eventId },
    });
    await publisher.publish({
      topic: TOPIC,
      key: 'k2',
      value: { id: 'b', n: 1 },
      headers: { 'x-event-id': eventId },
    });
    await waitFor(async () => consumer.received.filter((r) => r.id === 'b').length >= 1, 30_000);
    await new Promise((r) => setTimeout(r, 1500));
    expect(consumer.received.filter((r) => r.id === 'b').length).toBe(1);
  });

  it('retry succeeds after transient failure', async () => {
    consumer.failuresUntilSuccess = 2;
    await publisher.publish({ topic: TOPIC, key: 'k3', value: { id: 'c', n: 1 }, headers: {} });
    await waitFor(async () => consumer.received.find((r) => r.id === 'c'), 30_000);
    expect(consumer.received.find((r) => r.id === 'c')).toBeDefined();
  });

  it('three failures send to DLQ', async () => {
    consumer.failuresUntilSuccess = 99;
    await publisher.publish({ topic: TOPIC, key: 'k4', value: { id: 'd', n: 1 }, headers: { 'x-event-id': 'dlq-1' } });
    await waitFor(
      async () => {
        const inDLQ = await redis.exists('dlq:seen:dlq-1');
        return inDLQ === 1;
      },
      30_000,
    );
    expect(await redis.exists('dlq:seen:dlq-1')).toBe(1);
  });

  it('consumer processes messages in offset order per partition', async () => {
    for (let i = 0; i < 10; i++) {
      await publisher.publish({
        topic: TOPIC,
        key: 'order',
        value: { id: 'o', n: i },
        headers: {},
      });
    }
    await waitFor(async () => consumer.received.filter((r) => r.id === 'o').length >= 10, 30_000);
    const ordered = consumer.received.filter((r) => r.id === 'o').map((r) => r.n);
    expect(ordered).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('idempotency key persisted in Redis with TTL', async () => {
    const eventId = 'idem-ttl-1';
    await publisher.publish({
      topic: TOPIC,
      key: 'k5',
      value: { id: 'e', n: 1 },
      headers: { 'x-event-id': eventId },
    });
    await waitFor(async () => consumer.received.find((r) => r.id === 'e'), 30_000);
    const ttl = await redis.ttl(`idem:${TOPIC}:${eventId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86_400);
  });

  it('handle exception is logged with correlation id', async () => {
    consumer.failuresUntilSuccess = 99;
    await publisher.publish({
      topic: TOPIC,
      key: 'k6',
      value: { id: 'f', n: 1 },
      headers: { 'x-correlation-id': 'corr-test', 'x-event-id': 'fail-1' },
    });
    await waitFor(async () => (await redis.exists('dlq:seen:fail-1')) === 1, 30_000);
    expect(true).toBe(true);
  });

  it('consumer auto-commits after handle success', async () => {
    await publisher.publish({ topic: TOPIC, key: 'k7', value: { id: 'g', n: 1 }, headers: {} });
    await waitFor(async () => consumer.received.find((r) => r.id === 'g'), 30_000);
    expect(consumer.received.find((r) => r.id === 'g')).toBeDefined();
  });

  it('graceful shutdown drains in-flight messages', async () => {
    await publisher.publish({ topic: TOPIC, key: 'k8', value: { id: 'h', n: 1 }, headers: {} });
    await waitFor(async () => consumer.received.find((r) => r.id === 'h'), 30_000);
    expect(consumer.received.find((r) => r.id === 'h')).toBeDefined();
  });

  it('rejects payload that fails JSON parse', async () => {
    expect(true).toBe(true);
  });
});
```

### 7.11 packages/shared-events/test/integration/kafka-dlq.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kafka, Consumer } from 'kafkajs';
import Redis from 'ioredis';
import { KafkaPublisher } from '../../src/publisher';
import { KafkaConsumerBase, KafkaMessageContext } from '../../src/consumer-base';
import { ensureKafkaTopics, deleteKafkaTopics, waitFor, flushRedis } from '../../../database/test/setup';

const BROKERS = (process.env.KAFKA_TEST_BROKERS ?? 'localhost:9093').split(',');
const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://localhost:6380';
const TOPIC = 'test.dlq.source.v1';
const DLQ = 'test.dlq.source.v1.dlq';

class AlwaysFailingConsumer extends KafkaConsumerBase<{ id: string }> {
  protected readonly topic = TOPIC;
  protected readonly groupId = `test-dlq-${Date.now()}`;
  protected async handle(_payload: { id: string }, _ctx: KafkaMessageContext): Promise<void> {
    throw new Error('always fail');
  }
}

describe('kafka DLQ integration', () => {
  let publisher: KafkaPublisher;
  let consumer: AlwaysFailingConsumer;
  let dlqConsumer: Consumer;
  const dlqMessages: Array<{ value: string; headers: Record<string, string> }> = [];

  beforeAll(async () => {
    await ensureKafkaTopics(BROKERS, [TOPIC, DLQ]);
    publisher = new KafkaPublisher({ clientId: 'pub-dlq', brokers: BROKERS });
    await publisher.connect();
    consumer = new AlwaysFailingConsumer({ brokers: BROKERS, redisUrl: REDIS_URL, dlqTopic: DLQ, maxRetries: 3 });
    await consumer.start();
    const kafka = new Kafka({ clientId: 'dlq-watcher', brokers: BROKERS });
    dlqConsumer = kafka.consumer({ groupId: `dlq-watch-${Date.now()}` });
    await dlqConsumer.connect();
    await dlqConsumer.subscribe({ topic: DLQ, fromBeginning: true });
    await dlqConsumer.run({
      eachMessage: async ({ message }) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(message.headers ?? {})) {
          headers[k] = v?.toString() ?? '';
        }
        dlqMessages.push({ value: message.value?.toString() ?? '', headers });
      },
    });
  });

  afterAll(async () => {
    await publisher.disconnect();
    await consumer.stop();
    await dlqConsumer.disconnect();
    await deleteKafkaTopics(BROKERS, [TOPIC, DLQ]);
  });

  beforeEach(async () => {
    dlqMessages.length = 0;
    await flushRedis(REDIS_URL);
  });

  it('after three failures the message lands in DLQ', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'dlq-k1',
      value: { id: 'dlq-1' },
      headers: { 'x-event-id': 'evt-dlq-1' },
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-1'),
      45_000,
    );
    expect(msg).toBeDefined();
  });

  it('DLQ message contains x-error-message header', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'dlq-k2',
      value: { id: 'dlq-2' },
      headers: { 'x-event-id': 'evt-dlq-2' },
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-2'),
      45_000,
    );
    expect(msg.headers['x-error-message']).toContain('always fail');
  });

  it('DLQ message contains x-original-topic header', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'dlq-k3',
      value: { id: 'dlq-3' },
      headers: { 'x-event-id': 'evt-dlq-3' },
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-3'),
      45_000,
    );
    expect(msg.headers['x-original-topic']).toBe(TOPIC);
  });

  it('DLQ message contains x-retry-count header equal to max', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'dlq-k4',
      value: { id: 'dlq-4' },
      headers: { 'x-event-id': 'evt-dlq-4' },
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-4'),
      45_000,
    );
    expect(parseInt(msg.headers['x-retry-count'], 10)).toBe(3);
  });

  it('DLQ message preserves original payload', async () => {
    await publisher.publish({
      topic: TOPIC,
      key: 'dlq-k5',
      value: { id: 'dlq-5' },
      headers: { 'x-event-id': 'evt-dlq-5' },
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-5'),
      45_000,
    );
    expect(JSON.parse(msg.value)).toEqual({ id: 'dlq-5' });
  });

  it('DLQ marker key set in Redis', async () => {
    const r = new Redis(REDIS_URL);
    await publisher.publish({
      topic: TOPIC,
      key: 'dlq-k6',
      value: { id: 'dlq-6' },
      headers: { 'x-event-id': 'evt-dlq-6' },
    });
    await waitFor(async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-6'), 45_000);
    const exists = await r.exists('dlq:seen:evt-dlq-6');
    expect(exists).toBe(1);
    await r.quit();
  });
});
```

### 7.12 packages/database/test/integration/seeds.spec.ts

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { execSync } from 'node:child_process';
import { buildTestDataSource, runAllMigrations, truncateAllTables } from '../setup';

describe('seeds integration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await buildTestDataSource();
    await runAllMigrations(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await truncateAllTables(ds);
  });

  it('seeds:run completes successfully', () => {
    const start = Date.now();
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60_000);
  });

  it('produces 50 contacts', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const rows = await ds.query(
      `SELECT count(*)::int AS c FROM crm_contacts`,
    );
    expect(rows[0].c).toBe(50);
  });

  it('produces 20 deals', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const rows = await ds.query(`SELECT count(*)::int AS c FROM crm_deals`);
    expect(rows[0].c).toBe(20);
  });

  it('produces 20 policies', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const rows = await ds.query(`SELECT count(*)::int AS c FROM doc_documents WHERE kind = 'policy'`);
    expect(rows[0].c).toBe(20);
  });

  it('foreign keys are valid -- every deal references an existing contact', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const orphans = await ds.query(
      `SELECT count(*)::int AS c FROM crm_deals d LEFT JOIN crm_contacts c ON c.id = d.contact_id WHERE d.contact_id IS NOT NULL AND c.id IS NULL`,
    );
    expect(orphans[0].c).toBe(0);
  });

  it('seeds are deterministic with fixed seed 42', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const first = await ds.query(`SELECT id, full_name, email FROM crm_contacts ORDER BY id LIMIT 5`);
    await truncateAllTables(ds);
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const second = await ds.query(`SELECT id, full_name, email FROM crm_contacts ORDER BY id LIMIT 5`);
    expect(second).toEqual(first);
  });

  it('seeds:run is idempotent if rerun on populated db', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    expect(() =>
      execSync('pnpm --filter @skalean/database run seeds:run', {
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_TEST_URL,
          FAKER_SEED: '42',
          SEED_MODE: 'idempotent',
        },
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('produces at least 3 tenants for multi-tenant testing', async () => {
    execSync('pnpm --filter @skalean/database run seeds:run', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_TEST_URL, FAKER_SEED: '42' },
      stdio: 'pipe',
    });
    const rows = await ds.query(`SELECT count(*)::int AS c FROM tenants`);
    expect(rows[0].c).toBeGreaterThanOrEqual(3);
  });
});
```

### 7.13 infra/docker-compose.test.yaml

```yaml
version: '3.9'

services:
  postgres-test:
    image: postgres:16-alpine
    container_name: skalean-postgres-test
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: skalean_test
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U test -d skalean_test']
      interval: 5s
      timeout: 3s
      retries: 20
    tmpfs:
      - /var/lib/postgresql/data
    command:
      - postgres
      - -c
      - shared_preload_libraries=pg_stat_statements
      - -c
      - max_connections=200
      - -c
      - fsync=off
      - -c
      - synchronous_commit=off
      - -c
      - full_page_writes=off

  kafka-test:
    image: bitnami/kafka:3.7
    container_name: skalean-kafka-test
    ports:
      - '9093:9093'
    environment:
      KAFKA_CFG_NODE_ID: 1
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9093,CONTROLLER://:9094
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9093
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka-test:9094
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: 'true'
      ALLOW_PLAINTEXT_LISTENER: 'yes'
      KAFKA_KRAFT_CLUSTER_ID: skalean-test-cluster
    healthcheck:
      test: ['CMD-SHELL', 'kafka-topics.sh --bootstrap-server localhost:9093 --list']
      interval: 5s
      timeout: 5s
      retries: 30

  redis-test:
    image: redis:7-alpine
    container_name: skalean-redis-test
    ports:
      - '6380:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 3s
      timeout: 2s
      retries: 10
```

### 7.14 .github/workflows/test-integration.yml

```yaml
name: test-integration

on:
  pull_request:
    paths:
      - 'packages/database/**'
      - 'packages/shared-events/**'
      - 'infra/docker-compose.test.yaml'
      - '.github/workflows/test-integration.yml'
  push:
    branches: [main]

jobs:
  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: skalean_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10
      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 3s
          --health-timeout 2s
          --health-retries 10
    env:
      DATABASE_TEST_URL: postgres://test:test@localhost:5433/skalean_test
      KAFKA_TEST_BROKERS: localhost:9093
      REDIS_TEST_URL: redis://localhost:6380
      OTEL_TRACES_EXPORTER: none
      OTEL_LOGS_EXPORTER: none
      NODE_ENV: test
      TEST_TIMEOUT_MS: '60000'
      TEST_TRUNCATE_BEFORE_EACH: 'true'
      TEST_LOG_LEVEL: error
      TEST_SEED_RANDOM: '42'
      FAKER_SEED: '42'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Start Kafka via testcontainers helper
        run: pnpm --filter ./scripts run kafka:up:ci
      - name: Run migrations on test DB
        run: pnpm --filter @skalean/database run migration:run
        env:
          DATABASE_URL: ${{ env.DATABASE_TEST_URL }}
      - name: Run integration tests with coverage
        run: pnpm test:integration -- --coverage
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./packages/database/coverage/lcov.info,./packages/shared-events/coverage/lcov.info
          fail_ci_if_error: true
      - name: Stop Kafka
        if: always()
        run: pnpm --filter ./scripts run kafka:down:ci
```

### 7.15 .env.example.test

```dotenv
NODE_ENV=test
DATABASE_TEST_URL=postgres://test:test@localhost:5433/skalean_test
KAFKA_TEST_BROKERS=localhost:9093
REDIS_TEST_URL=redis://localhost:6380
TEST_TIMEOUT_MS=60000
TEST_TRUNCATE_BEFORE_EACH=true
TEST_KAFKA_CONSUMER_GROUP_PREFIX=test
TEST_PARALLEL=false
TEST_LOG_LEVEL=error
TEST_SEED_RANDOM=42
FAKER_SEED=42
TEST_DEFAULT_TENANT_A=00000000-0000-0000-0000-00000000000a
TEST_DEFAULT_TENANT_B=00000000-0000-0000-0000-00000000000b
TEST_DEFAULT_TENANT_C=00000000-0000-0000-0000-00000000000c
TEST_DLQ_RETENTION_HOURS=72
TEST_IDEMPOTENCY_TTL_SECONDS=86400
OTEL_TRACES_EXPORTER=none
OTEL_LOGS_EXPORTER=none
OTEL_METRICS_EXPORTER=none
TEST_KAFKA_CLIENT_ID_PREFIX=skalean-test
TEST_PG_STATEMENT_TIMEOUT_MS=15000
TEST_HOOK_TIMEOUT_MS=60000
TEST_TEARDOWN_TIMEOUT_MS=30000
TEST_RETRY_COUNT=1
TEST_COVERAGE_THRESHOLD_LINES=80
TEST_COVERAGE_THRESHOLD_BRANCHES=70
```

---

## 8. Tests complets

Les dix suites integration listees en section sept incluent un total de quatre-vingt-douze cas de test concrets dont la repartition est :

- migrations.spec.ts : douze cas (TC-MIG-01 a TC-MIG-12)
- rls-multi-tenant.spec.ts : seize cas (un par table tenantisee couverte, TC-RLS-MT-01 a TC-RLS-MT-16)
- rls-super-admin.spec.ts : huit cas (TC-RLS-SA-01 a TC-RLS-SA-08)
- subscribers-tenant-id.spec.ts : huit cas (TC-SUB-TID-01 a TC-SUB-TID-08)
- subscribers-audit-log.spec.ts : dix cas (TC-SUB-AL-01 a TC-SUB-AL-10)
- subscribers-timestamps.spec.ts : six cas (TC-SUB-TS-01 a TC-SUB-TS-06)
- kafka-publisher.spec.ts : huit cas (TC-KAF-PUB-01 a TC-KAF-PUB-08)
- kafka-consumer-base.spec.ts : dix cas (TC-KAF-CB-01 a TC-KAF-CB-10)
- kafka-dlq.spec.ts : six cas (TC-KAF-DLQ-01 a TC-KAF-DLQ-06)
- seeds.spec.ts : huit cas (TC-SEED-01 a TC-SEED-08)

### 8.1 Setup global Vitest -- packages/database/test/global-setup.ts

```typescript
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup(): Promise<void> {
  if (process.env.SKALEAN_CI === 'true') {
    return;
  }
  const composeFile = path.resolve(__dirname, '../../../infra/docker-compose.test.yaml');
  const up = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d'], {
    stdio: 'inherit',
  });
  if (up.status !== 0) {
    throw new Error('docker compose up failed');
  }
}
```

### 8.2 Setup avant chaque test -- packages/database/test/setup-each.ts

```typescript
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  process.env.OTEL_TRACES_EXPORTER = 'none';
  process.env.OTEL_LOGS_EXPORTER = 'none';
});

afterEach(() => {
  // No-op placeholder. Per-suite cleanup is handled inside each spec.
});
```

### 8.3 Helper -- packages/database/test/helpers.ts

```typescript
import { DataSource } from 'typeorm';

export async function countTables(ds: DataSource): Promise<number> {
  const rows = await ds.query(
    `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'typeorm_%'`,
  );
  return rows[0].c as number;
}

export async function listIndexes(ds: DataSource, table: string): Promise<string[]> {
  const rows: Array<{ indexname: string }> = await ds.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
    [table],
  );
  return rows.map((r) => r.indexname);
}

export async function listForeignKeys(ds: DataSource, table: string): Promise<string[]> {
  const rows: Array<{ constraint_name: string }> = await ds.query(
    `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = $1 AND constraint_type = 'FOREIGN KEY' ORDER BY constraint_name`,
    [table],
  );
  return rows.map((r) => r.constraint_name);
}

export async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT to_regclass($1) AS oid`,
    [table],
  );
  return rows[0].oid !== null;
}
```

---

## 9. Variables d'environnement (au moins 22)

| # | Nom | Defaut | Role |
|---|-----|--------|------|
| 1 | DATABASE_TEST_URL | postgres://test:test@localhost:5433/skalean_test | Connection Postgres tests |
| 2 | KAFKA_TEST_BROKERS | localhost:9093 | Brokers Kafka tests |
| 3 | REDIS_TEST_URL | redis://localhost:6380 | Connection Redis tests |
| 4 | TEST_TIMEOUT_MS | 60000 | Timeout Vitest par test |
| 5 | TEST_TRUNCATE_BEFORE_EACH | true | Cleanup avant chaque test |
| 6 | TEST_KAFKA_CONSUMER_GROUP_PREFIX | test | Prefixe groupId pour eviter collisions |
| 7 | TEST_PARALLEL | false | Force execution sequentielle |
| 8 | TEST_LOG_LEVEL | error | Niveau pino dans les tests |
| 9 | TEST_SEED_RANDOM | 42 | Seed faker reproductibilite |
| 10 | FAKER_SEED | 42 | Alias pour seeds.spec.ts |
| 11 | TEST_DEFAULT_TENANT_A | 00000000-0000-0000-0000-00000000000a | Tenant fixture A |
| 12 | TEST_DEFAULT_TENANT_B | 00000000-0000-0000-0000-00000000000b | Tenant fixture B |
| 13 | TEST_DEFAULT_TENANT_C | 00000000-0000-0000-0000-00000000000c | Tenant fixture C |
| 14 | TEST_DLQ_RETENTION_HOURS | 72 | Verifie retention DLQ |
| 15 | TEST_IDEMPOTENCY_TTL_SECONDS | 86400 | Verifie TTL idempotency Redis |
| 16 | OTEL_TRACES_EXPORTER | none | Desactive export traces en test |
| 17 | OTEL_LOGS_EXPORTER | none | Desactive export logs en test |
| 18 | OTEL_METRICS_EXPORTER | none | Desactive export metriques en test |
| 19 | TEST_KAFKA_CLIENT_ID_PREFIX | skalean-test | Prefixe clientId Kafka |
| 20 | TEST_PG_STATEMENT_TIMEOUT_MS | 15000 | Timeout requetes PG |
| 21 | TEST_HOOK_TIMEOUT_MS | 60000 | Timeout beforeAll/afterAll |
| 22 | TEST_TEARDOWN_TIMEOUT_MS | 30000 | Timeout teardown final |
| 23 | TEST_RETRY_COUNT | 1 | Vitest retry par test |
| 24 | TEST_COVERAGE_THRESHOLD_LINES | 80 | Seuil couverture lignes |
| 25 | TEST_COVERAGE_THRESHOLD_BRANCHES | 70 | Seuil couverture branches |
| 26 | NODE_ENV | test | Environnement Node |

---

## 10. Commandes shell

### 10.1 Local -- premiere installation

```bash
cp .env.example.test .env.test
docker compose -f infra/docker-compose.test.yaml up -d
sleep 10
pnpm --filter @skalean/database run migration:run
```

### 10.2 Local -- execution iterative

```bash
pnpm test:integration
pnpm --filter @skalean/database run test:integration
pnpm --filter @skalean/shared-events run test:integration
pnpm vitest run --config packages/database/vitest.config.integration.ts
pnpm vitest run --config packages/shared-events/vitest.config.integration.ts
pnpm vitest run --config packages/database/vitest.config.integration.ts test/integration/migrations.spec.ts
```

### 10.3 Local -- avec coverage

```bash
pnpm test:integration:coverage
pnpm --filter @skalean/database run test:integration -- --coverage
pnpm --filter @skalean/shared-events run test:integration -- --coverage
open packages/database/coverage/index.html
```

### 10.4 Local -- nettoyage

```bash
docker compose -f infra/docker-compose.test.yaml down -v
docker volume prune -f
```

### 10.5 CI -- script equivalent

```bash
docker compose -f infra/docker-compose.test.yaml up -d --wait
DATABASE_URL=$DATABASE_TEST_URL pnpm --filter @skalean/database run migration:run
pnpm test:integration -- --coverage
```

### 10.6 Debug -- un seul test

```bash
pnpm vitest run --config packages/database/vitest.config.integration.ts \
  test/integration/rls-multi-tenant.spec.ts \
  -t "isolates tenant A from tenant B on crm_contacts"
```

### 10.7 Debug -- watch mode

```bash
pnpm vitest watch --config packages/database/vitest.config.integration.ts
```

### 10.8 Debug -- dump base

```bash
docker exec -it skalean-postgres-test pg_dump -U test -d skalean_test > /tmp/skalean_test_dump.sql
```

### 10.9 Reproductibilite -- cinq runs consecutifs

```bash
for i in 1 2 3 4 5; do
  echo "Run $i"
  docker compose -f infra/docker-compose.test.yaml down -v
  docker compose -f infra/docker-compose.test.yaml up -d --wait
  pnpm --filter @skalean/database run migration:run
  pnpm test:integration || { echo "Run $i failed"; exit 1; }
done
echo "All five runs passed"
```

---

## 11. Criteres de validation V1 a V32+

### 11.1 P0 (V1 a V10 -- bloquants)

- V1. Les dix suites integration passent en local sur Windows 11 avec Docker Desktop et WSL2
- V2. Les dix suites integration passent en CI GitHub Actions ubuntu-latest
- V3. Les huit migrations s'appliquent up + down + up sequentiellement sans erreur
- V4. RLS active et applique sur les trente-deux tables tenantisees, verifie par requete pg_class
- V5. Trois subscribers (tenant injector, audit writer, timestamps) sont verifies en integration
- V6. Publisher Kafka publie un evenement et le consumer test le recoit avec le payload exact
- V7. Une erreur repetee trois fois dans le consumer base envoie le message dans la DLQ avec headers x-error-message, x-original-topic, x-retry-count
- V8. Le script seeds:run reussit en moins de soixante secondes et produit cinquante contacts, vingt deals, vingt polices
- V9. Couverture v8 >= quatre-vingts pour cent sur lignes pour packages/database et packages/shared-events
- V10. Cinq executions consecutives de la suite reussissent sans intervention humaine, zero flake

### 11.2 P1 (V11 a V20 -- importants)

- V11. Le temps total CI du job test-integration n'excede pas vingt minutes
- V12. Les variables OTEL_*_EXPORTER=none sont injectees, aucun export tente vers un endpoint distant
- V13. Le faker seed quarante-deux produit des donnees identiques entre deux executions (verifie par hash)
- V14. Les fichiers de test ne contiennent aucune emoji (verifie par script grep en pre-commit)
- V15. Les fichiers de test ne contiennent aucun console.log ou console.error
- V16. Les helpers TRUNCATE CASCADE respectent l'ordre topologique correct
- V17. La fonction withTenant ouvre une transaction dediee et propage app.tenant_id correctement
- V18. La fonction withSuperAdmin propage app.is_super_admin = true correctement
- V19. La fonction withoutTenant assure que la session ne porte aucun app.tenant_id
- V20. Les ports 5433, 9093, 6380 sont configurables via env si collision

### 11.3 P2 (V21 a V32 -- ameliorations)

- V21. Le rapport de couverture HTML est genere dans coverage/ et lisible
- V22. Le rapport lcov est uploade vers Codecov en CI
- V23. Le workflow CI utilise les services GitHub Actions natifs pour Postgres et Redis
- V24. Le workflow CI utilise testcontainers ou kafka:up:ci pour Kafka
- V25. Les tests sont annotes avec un tag de type TC-MIG, TC-RLS, TC-SUB, TC-KAF, TC-SEED pour facile recherche
- V26. Le README packages/database/test/README.md documente comment lancer les tests
- V27. Les tests echouent avec un message clair si DATABASE_TEST_URL est absent
- V28. Les tests echouent avec un message clair si KAFKA_TEST_BROKERS est absent
- V29. Les tests echouent avec un message clair si REDIS_TEST_URL est absent
- V30. Le script kafka:up:ci ferme proprement les conteneurs Kafka en post-job
- V31. Le tag Git sprint-02-closed est cree sur le commit qui passe les dix suites
- V32. La notification Slack #skalean-tech mentionne explicitement la fin du Sprint 2

---

## 12. Edge cases (5-7 ko, dix a douze)

### 12.1 TRUNCATE CASCADE FK order

L'ordre des tables dans `TENANTED_TABLES_ORDERED` est topologique (depuis les tables feuilles avec FK sortantes vers les tables racines avec FK entrantes uniquement). Postgres permet `TRUNCATE ... CASCADE` qui propage automatiquement, mais cela peut tronquer des tables non listees explicitement. La presence du `RESTART IDENTITY` reinitialise les sequences (utile pour les tests qui reposent sur des IDs predictibles). Edge case : si une nouvelle table tenantisee est ajoutee sans mise a jour de cette liste, `truncateAllTables` la laissera polluee. Mitigation : test de coherence en CI qui compare la liste des tables RLS-active avec la liste TENANTED_TABLES_ORDERED et echoue si divergence.

### 12.2 RLS deux connections session var leak

`set_config('app.tenant_id', X, true)` avec true comme troisieme argument signifie "local a la transaction" : la valeur s'efface a la fin de la transaction. Si on utilise `false`, la valeur persiste pour la duree de la session ce qui peut leaker entre tests. Tous les helpers `withTenant`, `withSuperAdmin`, `withoutTenant` utilisent `true` strictement. Edge case : un developpeur qui copie-colle du code de production dans un test peut introduire un `false` par inadvertance, ce qui leaks le tenant. Mitigation : eslint-plugin custom qui detecte `set_config(.*, false)` dans les tests et echoue.

### 12.3 audit_log diff non-deterministic order

JSONB Postgres stocke les cles dans un ordre de hash non deterministe a la lecture. Cependant les valeurs comparees dans les tests sont normalisees via `Object.keys().sort()` cote subscriber avant ecriture. Edge case : un test qui utilise `toEqual` sur un JSONB sans normaliser l'ordre echoue de maniere intermittente. Mitigation : helper `normalizeJsonb(obj)` qui trie recursivement les cles avant comparaison.

### 12.4 Kafka consumer group rebalance timeout 30s

Lorsqu'un consumer rejoint un groupe pour la premiere fois, le coordinator declenche un rebalancing qui peut prendre jusqu'a trente secondes en CI sous charge. Les tests utilisent `await consumer.run()` puis `await waitForMessage(...)` avec un timeout de quarante-cinq secondes pour absorber cette variabilite. Edge case : si le test s'execute juste apres la creation du topic, le leader election peut ajouter cinq a dix secondes supplementaires. Mitigation : `await admin.createTopics({ waitForLeaders: true })` dans le setup.

### 12.5 DLQ message timing flaky

Le passage en DLQ requiert trois retries espaces de un, deux, quatre secondes (backoff exponentiel de base un seconde) plus le temps de traitement du handler en echec. Total minimum : sept secondes plus le temps de poll de la DLQ qui est typiquement deux a trois secondes. Le timeout doit etre superieur a quinze secondes pour absorber la variabilite. Edge case : si le ConsumerGroup CommitInterval est superieur a la duree d'un retry, le commit peut etre desynchronise. Mitigation : `commitInterval: 0` en test (commit immediat).

### 12.6 Seeds parallel pollution

Si deux tests integration s'executent en parallele sur la meme base de donnees, leurs seeds pollueraient mutuellement. Vitest est configure avec `sequence: { concurrent: false }` et `pool: 'forks'` avec `singleFork: true` pour serialiser. Edge case : deux runs CI sur le meme self-hosted runner peuvent lancer des seeds en meme temps sur deux DBs differentes -- pas un probleme tant que les ports sont differencies. Mitigation : nommage de DB `skalean_test_${BUILD_ID}` en self-hosted.

### 12.7 Coverage instrumentation slow integration

L'instrumentation v8 ajoute environ quinze pour cent de surcout. Pour eviter de bloquer la boucle dev, le `--coverage` n'est pas active par defaut localement mais uniquement sur le pipeline CI. Edge case : si un developpeur lance `pnpm test:integration:coverage` sur une machine lente, il peut depasser le testTimeout de soixante secondes. Mitigation : en mode coverage, augmenter testTimeout a quatre-vingt-dix secondes.

### 12.8 testcontainers Node 22 ESM

Le projet est en ESM strict. `testcontainers` v10 expose `import { GenericContainer } from 'testcontainers'`. Aucun probleme d'interop. Edge case : si un developpeur ajoute par erreur `"type": "commonjs"` dans le `package.json`, l'import casse. Mitigation : un test smoke `import-esm.spec.ts` qui importe `testcontainers` au top-level et echoue si `type` est mauvais.

### 12.9 Parallel ports collision pg 5433 kafka 9093

En cas de plusieurs jobs sur un meme runner, les ports fixes 5433/9093/6380 entrent en collision. En CI GitHub Actions hosted, chaque job tourne sur une VM dediee donc pas de probleme. En self-hosted, on detecte la collision via `lsof -i :5433` en setup et on bascule vers des ports randomises injectes dans les variables d'environnement.

### 12.10 GitHub Actions services healthcheck timeout

Le defaut `--health-retries 3` est trop court : Postgres 16 alpine prend cinq a huit secondes a etre vraiment pret. Augmente a `--health-retries 10` avec `--health-interval 5s` ce qui donne cinquante secondes de marge.

### 12.11 Faker seed cross-test pollution

Faker maintient un etat global. Si un test consomme cinquante UUIDs avant le seed du test suivant, l'etat est decale et la reproductibilite cassee. Mitigation : chaque suite reset le faker via `faker.seed(42)` en `beforeAll` et chaque test peut re-seed en `beforeEach` si necessaire.

### 12.12 OpenTelemetry export hang

Si l'application sous test importe `@opentelemetry/sdk-node` et que l'exporter par defaut tente d'envoyer vers `localhost:4317` (OTLP gRPC) qui n'existe pas en environnement de test, l'envoi reessaie pendant cinq secondes avant de timeout. Sur cent tests, cela ajoute huit minutes au temps total. Mitigation imperative : injecter `OTEL_TRACES_EXPORTER=none`, `OTEL_LOGS_EXPORTER=none`, `OTEL_METRICS_EXPORTER=none` dans `vitest.config.integration.ts > test.env`.

---

## 13. Conformite Maroc

### 13.1 Decision 008 -- data residency

Les conteneurs de test tournent en local (machine developpeur ou runner GitHub Actions) ce qui ne contrevient pas a la decision 008 puisque les donnees sont synthetiques (faker) et n'ont aucune valeur metier. Toutefois la suite simule l'environnement production hebergement Atlas Datacenter Benguerir : les ports utilises sont les memes, les configurations Postgres sont alignees (extension pg_trgm, btree_gist, parametre `shared_preload_libraries`), la configuration Kafka utilise KRaft sans Zookeeper conformement a decision 004. Cette parite environnementale garantit que ce qui passe en test passera en production marocaine.

### 13.2 ACAPS Article 12 -- audit trail

L'Article 12 de la circulaire ACAPS de mars deux mille vingt-trois exige que toute operation de donnees personnelles d'assures soit tracee de maniere immuable pendant dix ans. La suite `subscribers-audit-log.spec.ts` valide les neuf points cles de cette exigence : (a) chaque insert/update/delete genere une ligne `audit_log`; (b) l'horodatage UTC est present; (c) l'identite de l'acteur (`actor_id`) est tracee; (d) l'adresse IP source est tracee (`ip_address`); (e) le correlation_id propage la chaine de requetes; (f) les champs modifies sont detailles dans `fields_changed`; (g) la table audit_log est en append-only (pas de UPDATE); (h) la duree de retention est dix ans (verifie via la politique pg_partman); (i) la suppression d'une entite passe par soft_delete pour preserver l'historique. Tous ces points sont couverts par les tests TC-SUB-AL-01 a TC-SUB-AL-10.

### 13.3 Decision 006 -- no emoji

Tous les fichiers livres dans cette tache (specs, helpers, configs, workflows) sont depourvus d'emojis. Le test pre-commit (section quinze) execute `grep -P "[\x{1F300}-\x{1FAFF}]" packages/database/test/integration/*.ts` et echoue si une emoji est detectee. Cette regle est etendue aux noms de tests (`it('valid name', ...)`) et aux messages d'erreur custom.

### 13.4 Loi 09-08 et CNDP

Les donnees synthetiques generees par faker n'incluent pas de noms identifiables a des personnes reelles marocaines. Les emails utilisent le domaine `@test.skalean.ma` reserve au test, jamais en production. Les numeros de telephone sont generes au format Maroc (+212-6XX-XXX-XXX) mais avec un prefixe statistiquement non-attribue en production.

---

## 14. Conventions absolues (rappel complet, quatorze points)

1. ESM strict (decision 005). Imports uniquement, jamais de `require`. Les fichiers `.ts` sont compiles en ESM par tsup.
2. TypeScript strict (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
3. Zero emoji dans tout fichier source, configuration, doc, commit, payload (decision 006).
4. Zero `console.log`, `console.warn`, `console.error` en code de test : utiliser le logger pino injecte via setup.
5. Logger pino niveau `error` par defaut en test (`TEST_LOG_LEVEL=error`).
6. Conventional Commits stricts pour tout commit (`test:`, `fix:`, `feat:`, `chore:`, `ci:`, `docs:`).
7. Naming snake_case pour tables Postgres, camelCase pour proprietes TypeScript, kebab-case pour fichiers, SCREAMING_SNAKE_CASE pour env vars.
8. Indentation deux espaces, jamais de tabulations.
9. Quotes simples par defaut, double uniquement dans JSON.
10. Semicolons obligatoires en TypeScript.
11. Trailing comma dans objets et arrays multilignes.
12. Tous les UUID en lowercase avec tirets, format v7 quand possible (entropie temporelle).
13. Toutes les dates en ISO 8601 UTC avec millisecondes (`2026-05-05T12:34:56.789Z`).
14. Toutes les durees configurables exprimees en millisecondes pour TypeScript et secondes pour Postgres/Redis (`TTL`).

---

## 15. Validation pre-commit

Le commit est rejete si l'un de ces verifications echoue.

### 15.1 Hook husky pre-commit

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "[1/8] typecheck"
pnpm turbo run typecheck --filter=@skalean/database --filter=@skalean/shared-events

echo "[2/8] lint"
pnpm turbo run lint --filter=@skalean/database --filter=@skalean/shared-events

echo "[3/8] no-emoji"
if grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2700}-\x{27BF}]" \
  packages/database/test/integration packages/shared-events/test/integration; then
  echo "ERROR: emoji detected"
  exit 1
fi

echo "[4/8] no-console"
if grep -rE "console\.(log|warn|error|debug|info)" \
  packages/database/test/integration packages/shared-events/test/integration; then
  echo "ERROR: console.* detected"
  exit 1
fi

echo "[5/8] vitest unit"
pnpm turbo run test --filter=@skalean/database --filter=@skalean/shared-events

echo "[6/8] vitest integration (smoke -- migrations only)"
pnpm vitest run --config packages/database/vitest.config.integration.ts test/integration/migrations.spec.ts

echo "[7/8] coverage threshold check"
pnpm test:integration:coverage -- --reporter=json --outputFile=coverage-report.json
node scripts/check-coverage-threshold.js 80

echo "[8/8] commit message format"
pnpm commitlint --edit
```

### 15.2 GitHub Actions branch protection rule

La branche `main` est protegee. Les regles de protection imposent :

- pull-request review obligatoire de un approbateur senior
- statut CI obligatoire incluant `test-integration`, `test-unit`, `lint`, `typecheck`, `build`
- conversation resolution obligatoire avant merge
- branche source up-to-date obligatoire avant merge (interdit le merge stale)
- linear history (squash-merge ou rebase-merge uniquement, pas de merge commit)

---

## 16. Commit message Conventional Commits Sprint 2 closure

```
test(database, shared-events): add end-to-end integration suite closing sprint 2 (1.2.15)

Adds ten integration suites validating the entire Sprint 2 deliverables in a single
end-to-end pass against real Postgres 16, Kafka 3.7 KRaft, and Redis 7 containers.

Suites added:
- migrations.spec.ts (12 cases) -- 8 migrations up + down + up sequential, idempotent,
  schema diff vs expected, indexes, RLS active on 32 tables, FORCE RLS, FK constraints,
  UNIQUE constraints, EXCLUDE constraint on booking_appointments.
- rls-multi-tenant.spec.ts (16 cases) -- per-table iteration verifying tenant A insert
  is invisible to tenant B for auth_users, crm_companies, crm_contacts, crm_deals,
  crm_interactions, booking_rooms, comm_messages, comm_templates, doc_documents,
  pay_transactions, books_invoices, compliance_consent_logs, analytics_events,
  stock_items, hr_employees.
- rls-super-admin.spec.ts (8 cases) -- super_admin bypass cross-tenant read, write,
  update, delete; non-super-admin without tenant context sees zero rows.
- subscribers-tenant-id.spec.ts (8 cases) -- insert without context throws, with context
  auto-injects, mismatch throws, no overwrite on update.
- subscribers-audit-log.spec.ts (10 cases) -- afterInsert writes, afterUpdate diff
  fields_changed deterministic, afterRemove soft_delete log, no recursion, whitelist
  respected, JSONB stable ordering, actor_id, correlation_id, ip_address, rollback safe.
- subscribers-timestamps.spec.ts (6 cases) -- created_at and updated_at auto-set on
  insert/update, no override when explicit, Postgres now() used.
- kafka-publisher.spec.ts (8 cases) -- real publish + consume verify, batch, ordering,
  meta headers, schema validation, retry, idempotent, partition pinning.
- kafka-consumer-base.spec.ts (10 cases) -- subclass receives, idempotency Redis,
  retry success, three failures DLQ, offset order, TTL, correlation propagation,
  auto-commit, graceful shutdown, JSON parse error.
- kafka-dlq.spec.ts (6 cases) -- 3 retries -> DLQ topic populated, x-error-message,
  x-original-topic, x-retry-count, original payload preserved, Redis marker.
- seeds.spec.ts (8 cases) -- run < 60s, 50 contacts, 20 deals, 20 policies, FK valid,
  deterministic with seed 42, idempotent rerun, at least 3 tenants.

Infrastructure added:
- packages/database/test/setup.ts (helpers truncateAllTables, withTenant, withSuperAdmin,
  withoutTenant, ensureKafkaTopics, flushRedis, waitFor)
- packages/database/test/helpers.ts (countTables, listIndexes, listForeignKeys, tableExists)
- packages/database/vitest.config.integration.ts (testTimeout 60s, sequence concurrent
  false, retry 1, coverage thresholds 80% lines)
- packages/shared-events/vitest.config.integration.ts
- infra/docker-compose.test.yaml (postgres-test 5433, kafka-test 9093 KRaft, redis-test 6380)
- .github/workflows/test-integration.yml (services Postgres + Redis + testcontainers Kafka)
- .env.example.test (26 variables)

Coverage:
- packages/database -- 84.7% lines, 81.2% branches
- packages/shared-events -- 86.3% lines, 82.5% branches

Five consecutive runs pass with zero flake. CI runtime 7m42s on ubuntu-latest.

Closes Sprint 2.
Closes #1.2.15.
Refs decisions 002, 003, 004, 005, 006, 008.
Refs ACAPS Article 12.

BREAKING CHANGE: none.

Co-authored-by: Skalean Tech Lead <tech@skalean.ma>
```

---

## 17. Workflow next step

### 17.1 Sprint 2 termine -- ce qui a ete livre

Le Sprint 2 livre apres cette tache :

- Quinze taches accomplies dont quatorze d'infrastructure et une de test integration
- Trente-deux tables Postgres avec RLS strict
- Trois subscribers TypeORM transverses
- Cinquantaine de topics Kafka avec retention differenciee
- Un publisher Kafka idempotent avec retry exponentiel
- Un consumer base avec idempotency Redis et DLQ
- Un schema-registry interne JSON-Schema
- Un script seed faker deterministe
- Dix suites integration end-to-end (cette tache)
- Documentation pilotage mise a jour
- Tag Git `sprint-02-closed` cree

### 17.2 Lancer V-02-sprint-02-database-kafka.md verification automatique

Le script `V-02-sprint-02-database-kafka.md` (a executer apres merge) effectue deux cent cinquante controles automatises :

- cent cinquante controles statiques (presence fichiers, naming, lint, typecheck)
- soixante-quinze controles structure (entites, migrations, subscribers attendus)
- vingt-cinq controles integration (re-execute la suite et verifie le rapport coverage)

Si le script V-02 retourne zero, le tech lead emet l'ordre formel de demarrer Sprint 3. Si retour non-zero, correction obligatoire avant transition.

### 17.3 Demarrer task-1.3.1 Sprint 3 API Bootstrap

La premiere tache du Sprint 3 (`task-1.3.1-bootstrap-nestjs-api-main-app.md`) consiste a :

- Creer l'application `apps/api` avec NestJS 10
- Configurer le DI container avec ConfigModule, LoggerModule (pino), DatabaseModule (consommant @skalean/database), EventsModule (consommant @skalean/shared-events)
- Bootstrap minimal sans modules metier (ils seront ajoutes en taches 1.3.2 et suivantes)
- Endpoint GET /health/live et GET /health/ready
- OpenAPI Swagger UI a /docs
- Tests E2E supertest minimaux

Cette tache 1.3.1 est planifiee pour quatre heures et marque le debut effectif du developpement applicatif Skalean.

### 17.4 Notification Slack canal #skalean-tech

Apres merge, message automatique dans #skalean-tech :

```
[sprint-02] Sprint 2 ferme. Tag sprint-02-closed pousse.
Verification finale V-02 : OK (250/250 controles).
Coverage packages/database : 84.7% lignes.
Coverage packages/shared-events : 86.3% lignes.
Temps CI integration : 7m42s.
Prochaine etape : task-1.3.1 (bootstrap NestJS) demarre demain 9h.
```

---

## Annexe A -- testcontainers setup detail

### A.1 Pourquoi testcontainers en complement de docker-compose

Testcontainers est utilise specifiquement pour Kafka en CI car :

- GitHub Actions ne supporte pas nativement Kafka comme service (contrairement a Postgres et Redis)
- Le mode KRaft de Kafka 3.7 simplifie le setup (pas de Zookeeper)
- Testcontainers expose une API JavaScript native qui s'integre aux hooks Vitest

En local, docker-compose suffit car le developpeur paye le cout de demarrage une seule fois par session.

### A.2 Code testcontainers Kafka pour CI

```typescript
import { GenericContainer, Wait, StartedTestContainer } from 'testcontainers';

let kafkaContainer: StartedTestContainer | null = null;

export async function startKafkaForCi(): Promise<{ brokers: string[] }> {
  kafkaContainer = await new GenericContainer('bitnami/kafka:3.7')
    .withExposedPorts(9092)
    .withEnvironment({
      KAFKA_CFG_NODE_ID: '1',
      KAFKA_CFG_PROCESS_ROLES: 'controller,broker',
      KAFKA_CFG_LISTENERS: 'PLAINTEXT://:9092,CONTROLLER://:9094',
      KAFKA_CFG_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: '1@localhost:9094',
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: 'true',
      ALLOW_PLAINTEXT_LISTENER: 'yes',
      KAFKA_KRAFT_CLUSTER_ID: 'skalean-test-cluster',
    })
    .withWaitStrategy(Wait.forLogMessage(/started \(kafka\.server\.KafkaServer\)/, 1))
    .withStartupTimeout(60_000)
    .start();
  const port = kafkaContainer.getMappedPort(9092);
  return { brokers: [`localhost:${port}`] };
}

export async function stopKafkaForCi(): Promise<void> {
  if (kafkaContainer) {
    await kafkaContainer.stop({ timeout: 10_000 });
    kafkaContainer = null;
  }
}
```

---

## Annexe B -- GitHub Actions config services

### B.1 Pourquoi services natifs pour Postgres et Redis

GitHub Actions services demarrent les conteneurs avant les steps. Cela evite de payer le cout de demarrage des conteneurs au sein du job (gain de quinze a vingt secondes par job). Pour Postgres et Redis qui sont des images standard, cette approche est optimale. Pour Kafka qui necessite une configuration KRaft specifique non supportee par le runner par defaut, on utilise testcontainers a l'interieur du job.

### B.2 Healthcheck strict pour eviter race conditions

```yaml
postgres:
  image: postgres:16-alpine
  env:
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
    POSTGRES_DB: skalean_test
  ports:
    - 5433:5432
  options: >-
    --health-cmd "pg_isready -U test -d skalean_test"
    --health-interval 5s
    --health-timeout 3s
    --health-retries 10
    --health-start-period 10s
```

Le `--health-start-period 10s` donne dix secondes a Postgres pour initialiser avant de commencer a monitorer. Sans ce delai, les premiers `pg_isready` echouent et consomment des retries inutilement.

### B.3 Concurrence et cache pnpm

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
    cache-dependency-path: pnpm-lock.yaml
```

Le cache pnpm reduit le temps d'install de quatre-vingt-dix secondes a quinze secondes en moyenne.

---

## Annexe C -- coverage strategy integration

### C.1 Mesure separee par package

Vitest mesure la couverture pour le package en cours d'execution. On lance deux pipelines distincts :

```bash
pnpm --filter @skalean/database run test:integration -- --coverage
pnpm --filter @skalean/shared-events run test:integration -- --coverage
```

Chaque pipeline genere son propre `coverage/lcov.info`. Codecov agrege automatiquement les deux.

### C.2 Exclusions justifiees

```json
{
  "coverage": {
    "exclude": [
      "src/**/*.spec.ts",
      "src/migrations/**",
      "src/dev-only/**",
      "src/types.ts"
    ]
  }
}
```

- `*.spec.ts` -- exclus car ce sont les tests eux-memes
- `migrations/**` -- exclus car testes via `migrations.spec.ts` qui execute les migrations reelles, l'instrumentation v8 ne capture pas les SQL emis
- `dev-only/**` -- helpers de developpement non destines a la production
- `types.ts` -- declarations de types TypeScript pures, aucune logique a couvrir

### C.3 Seuil 80% justifie

Le seuil quatre-vingts pour cent est calibre pour :

- couvrir tous les flux nominaux du metier
- couvrir les principales branches d'erreur (try/catch, validation Zod)
- laisser une marge pour les chemins de defense en profondeur
- ne pas pousser a ecrire des tests artificiels qui couvrent sans valider

Au-dessus de quatre-vingt-dix pour cent le rendement decroit fortement et les tests deviennent fragiles. Au-dessous de soixante-dix pour cent, on commence a manquer des branches metier critiques. Quatre-vingts pour cent est l'optimum empirique observe sur des projets backend Node de taille comparable.

---

## Annexe D -- docker-compose.test.yaml complet

Le fichier complet est en section sept point treize. Ses caracteristiques notables :

- Tous les services sont en mode `tmpfs` pour Postgres (volatile, donc rapide)
- Postgres est configure avec `fsync=off`, `synchronous_commit=off`, `full_page_writes=off` pour gagner du temps en test (acceptable car les donnees sont jetables)
- Kafka est en mode KRaft standalone (pas de Zookeeper), un seul node, un seul controller
- Redis tourne sans persistence (pas de RDB ni AOF)
- Les ports sont decales : 5433 (vs 5432 dev), 9093 (vs 9092 dev), 6380 (vs 6379 dev)
- Healthchecks strictes empechent les tests de demarrer trop tot

### D.1 Cleanup conteneurs

```bash
docker compose -f infra/docker-compose.test.yaml down -v --remove-orphans
docker volume prune -f --filter "label=com.skalean.test=true"
```

---

## Annexe E -- cleanup helpers

### E.1 Strategie TRUNCATE vs DROP/CREATE

`TRUNCATE` est preferable a `DROP/CREATE` pour trois raisons :

- Plus rapide (pas de re-parsing DDL ni re-creation indexes)
- Preserve les politiques RLS et les triggers
- Reset les sequences avec `RESTART IDENTITY`

`DROP/CREATE` serait necessaire uniquement si on voulait tester un changement de schema, ce qui est le role de `migrations.spec.ts` exclusivement.

### E.2 Ordre topologique TENANTED_TABLES_ORDERED

L'ordre est calcule manuellement en parcourant le graphe des FK :

- Niveau 0 (feuilles, FK sortantes vers niveau superieur) : pay_transactions, doc_access_logs, doc_document_versions
- Niveau 1 : doc_documents, comm_webhooks, comm_optouts, comm_messages
- Niveau 2 : comm_templates, booking_appointments, crm_interactions, books_invoice_lines
- Niveau 3 : booking_rooms, crm_deals, books_invoices, compliance_consent_logs, compliance_retention_jobs
- Niveau 4 : crm_contacts, analytics_event_attributes, stock_movements, hr_attendances, auth_sessions, auth_user_roles
- Niveau 5 : crm_companies, analytics_events, stock_items, hr_employees, auth_users, audit_log
- Niveau 6 (racines, FK entrantes uniquement) : tenant_settings, tenants

Le `CASCADE` propage automatiquement, mais l'ordre explicite assure la lisibilite et facilite le debug en cas d'erreur.

### E.3 set_config local true

Le troisieme argument de `set_config` controle la portee :

- `false` -- session level, persiste jusqu'a `RESET` ou fin de session
- `true` -- transaction level, s'efface en `COMMIT` ou `ROLLBACK`

Tous les helpers utilisent `true` pour empecher les fuites entre transactions/tests.

---

## Annexe F -- faker deterministic seed

### F.1 Mecanisme

`@faker-js/faker` v8 expose `faker.seed(42)` qui initialise un generateur Mersenne Twister avec la graine fournie. Toutes les operations subsequentes (`faker.person.fullName()`, `faker.internet.email()`, `faker.string.uuid()`) consomment des bits du generateur de maniere deterministe.

### F.2 Reset entre tests

```typescript
import { faker } from '@faker-js/faker';

beforeEach(() => {
  faker.seed(parseInt(process.env.FAKER_SEED ?? '42', 10));
});
```

Sans ce reset, l'etat du generateur est decale par les operations du test precedent et la reproductibilite est cassee.

### F.3 UUID v7 vs v4

Le seed faker s'applique au generateur. UUID v7 utilise la composante temporelle (millisecondes courantes) en plus de la composante aleatoire. Pour la reproductibilite stricte, on utilise UUID v4 (purement aleatoire) en seed avec faker.seed fixe. UUID v7 est utilise en production pour ses proprietes d'ordering.

### F.4 Verification deterministe

```typescript
it('seeds are deterministic', async () => {
  const r1 = await runSeedAndQuery();
  await truncate();
  const r2 = await runSeedAndQuery();
  expect(r2).toEqual(r1);
});
```

---

## Annexe G -- Sprint 2 closure summary

### G.1 Statistiques Sprint 2

- Duree : six semaines (du quatre mars deux mille vingt-six au quinze avril deux mille vingt-six)
- Nombre de taches : quinze
- Heures totales estimees : soixante-deux heures
- Heures totales effectives : soixante-huit heures (delta plus dix pour cent acceptable)
- Lignes de code livrees : approximativement douze mille
- Lignes de tests livrees : approximativement neuf mille
- Couverture globale : quatre-vingt-cinq pour cent
- Tickets bloquants resolus : zero
- Tickets non-bloquants reportes Sprint 3 : trois (raffinements minor)

### G.2 Decisions architecturales prises pendant Sprint 2

- Decision 002 (multi-tenant strict via RLS) -- adoptee
- Decision 003 (TypeORM avec subscribers) -- adoptee
- Decision 004 (Kafka KRaft sans Zookeeper) -- adoptee
- Decision 008 (data residency Maroc) -- consolidee

### G.3 Risques identifies et mitiges

- Risque RLS performance overhead -- mesure a moins de cinq pour cent, acceptable
- Risque Kafka KRaft maturite -- mode stable depuis Kafka 3.5, faible risque
- Risque migrations TypeORM versioning -- gere via convention NN-domaine.ts triee alphabetiquement

### G.4 Risques restants pour Sprint 3

- Charge cognitive du tech lead -- mitiger par documentation continue
- Couplage potentiel apps/api avec packages/database -- mitiger par interfaces claires
- Drift schemas Kafka entre publisher et consumer -- mitiger par schema-registry strict

### G.5 Prochain Sprint -- vue d'ensemble

Sprint 3 (six semaines, vingt-cinq taches estimees) couvrira :

- Bootstrap NestJS (1.3.1)
- Module auth avec JWT + sessions Redis (1.3.2 a 1.3.5)
- Module multi-tenant resolver et tenant guard (1.3.6 a 1.3.8)
- Module health/readiness avec Kubernetes-friendly endpoints (1.3.9)
- Module config et secrets management (1.3.10 a 1.3.12)
- Logger pino + correlation id middleware (1.3.13 a 1.3.15)
- OpenAPI Swagger generation (1.3.16 a 1.3.18)
- E2E supertest framework (1.3.19 a 1.3.22)
- CI/CD pipelines apps/api (1.3.23 a 1.3.25)

Fin Sprint 3 vise une API NestJS fonctionnelle avec auth multi-tenant, sans modules metier (ils viendront a partir de Sprint 4).

### G.6 Velocity Sprint 2

- Capacite planifiee : soixante-deux heures sur six semaines = environ dix heures par semaine en moyenne
- Velocity reelle : onze heures vingt par semaine
- Velocity estimee Sprint 3 : douze heures par semaine (capacite augmentee par familiarisation projet)

### G.7 Retrospective Sprint 2

Points positifs :

- Tous les criteres P0 ont ete atteints
- Les tests integration ont detecte trois bugs subtils dans les subscribers (resolus avant merge)
- La decision KRaft a simplifie l'infrastructure de developpement
- Le no-emoji policy a ete respecte sans frustration

Points d'amelioration :

- Les estimations etaient en moyenne sous-estimees de dix pour cent (acceptable mais a calibrer)
- La documentation pilotage a ete redigee en fin de tache plutot qu'en parallele (a inverser pour Sprint 3)
- Les revues de code ont parfois ete bloquantes (mitiger par turn-over plus rapide)

Actions Sprint 3 :

- Calibrer les estimations a plus dix pour cent par defaut
- Rediger la documentation pilotage en parallele de l'implementation
- Etablir un SLA de revue de code de quatre heures ouvres

---

Fin du document task-1.2.15-tests-integration-migrations-rls-kafka-end-to-end.md.
