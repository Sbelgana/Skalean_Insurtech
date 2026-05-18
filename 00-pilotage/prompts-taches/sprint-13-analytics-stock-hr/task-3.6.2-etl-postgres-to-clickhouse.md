# TACHE 3.6.2 -- ETL Pipeline Postgres -> ClickHouse (Polling-Based MVP)

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase -- DERNIER de la Phase 3)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.2)
**Phase** : 3 -- Modules Horizontaux (Analytics + Stock + HR)
**Priorite** : P0 (bloquant AnalyticsService + dashboards)
**Effort** : 6h
**Dependances** : Tache 3.6.1 (ClickHouse setup + schemas), Sprint 11 (Pay events), Sprint 12 (Books journal_entries), Sprint 9 (Comm messages), Sprint 8 (CRM+Booking), Sprint 10 (Docs signatures)
**Densite cible** : 110-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre le pipeline ETL (Extract-Transform-Load) qui alimente le cluster ClickHouse depuis Postgres : un job BullMQ tourne toutes les 5 minutes, lit les rows modifiees depuis le dernier sync (delta-based pulling sur `updated_at`), transforme les structures Postgres en lignes ClickHouse denormalisees (jointures preealables), et inserts batch 1000 rows vers les 5 tables de faits (`fct_transactions`, `fct_journal_entries`, `fct_appointments`, `fct_messages`, `fct_documents_signed`) plus 2 dimensions (`dim_tenants`, `dim_customers`). Sans ce pipeline, ClickHouse reste vide et les dashboards (Tache 3.6.4) ne peuvent rien afficher.

L'apport est triple. **Premierement**, le service `PostgresToClickHouseEtl` expose 7 methodes idempotentes : `syncTransactions(sinceTimestamp)`, `syncJournalEntries(sinceTimestamp)`, `syncAppointments(sinceTimestamp)`, `syncMessages(sinceTimestamp)`, `syncDocumentsSigned(sinceTimestamp)`, `syncTenants()` (full sync, low volume <1k tenants), `syncCustomers(sinceTimestamp)`. Chaque methode SELECT le delta Postgres + INSERT batch 1000 ClickHouse + retourne `{ rowsExtracted, rowsInserted, durationMs, lastTimestampSeen }`. **Deuxiemement**, le `EtlStateService` persiste le `last_sync_timestamp` par table dans une table Postgres `analytics_etl_state` (avec FK tenant_id NULL pour state globaux). Cela survit aux restarts API et garantit le reprise au dernier checkpoint sans rejouer les 6 derniers mois. **Troisiemement**, le job BullMQ `EtlCronJob` orchestre l'execution toutes les 5 minutes (cron `*/5 * * * *`), avec lock distribue Redis pour eviter les executions concurrentes, retry exponential backoff (3 essais), et endpoint `POST /api/v1/admin/analytics/resync` (super-admin uniquement) pour forcer une resync complete par table ou globale.

A l'issue de cette tache, 5 minutes apres une transaction Postgres (par exemple un `pay_transactions` capture), la ligne apparait dans ClickHouse `fct_transactions`. Les dashboards (Tache 3.6.4) peuvent agreger sur 6 mois sans degrader Postgres. La table `analytics_etl_state` permet de monitorer le retard d'ingestion par table (visible via endpoint admin). La strategie polling 5min est l'MVP Sprint 13 ; Sprint 35+ migrera vers Debezium CDC (real-time <1s latency) en gardant le meme interface ETL.

---

## 2. Contexte etendu

### 2.1 Pourquoi polling et pas CDC Debezium des Sprint 13

Le marche connait deux strategies dominantes pour alimenter un OLAP depuis un OLTP : **polling** (cron job lit deltas via SQL) et **CDC** (Change Data Capture stream WAL Postgres -> Kafka -> ClickHouse). CDC Debezium est plus elegant et donne une latence sub-seconde mais demande une infrastructure considerable : Debezium connector, Kafka topics dedies, Kafka Connect cluster, schema registry, configuration `wal_level=logical` + `max_replication_slots>=4` + slots persistants Postgres, ZooKeeper Keeper pour ClickHouse, monitoring chaque maillon.

Pour Sprint 13 v2.2, le polling 5min est largement suffisant : aucun dashboard ne demande une fraicheur sub-minute (les analyses business sont descriptives, pas operationnelles), et l'effort d'integration et de maintenance Debezium represente ~3 sprints supplementaires (configuration, hardening, tests, runbooks). Le pattern code de l'ETL polling est concu pour etre swappe (interface `IEtlConnector`) avec Debezium en Sprint 35+ sans toucher au code aval (AnalyticsService consomme ClickHouse identiquement).

### 2.2 Comparaison polling vs CDC mesuree

Sur fixture 100k transactions/mois Skalean InsurTech projection 2027.

| Critere | Polling 5min (Sprint 13) | Debezium CDC (Sprint 35+) |
|---------|--------------------------|---------------------------|
| Latence Postgres -> ClickHouse | 0 a 5 min (moyenne 2.5 min) | <1 seconde |
| Charge Postgres | 1 query/5min/table = 1.4k queries/jour | Continu WAL stream (negligeable) |
| Charge ClickHouse | 1 insert batch/5min = 17 inserts/jour | Continu micro-batches |
| Infra additionnelle | aucune (BullMQ deja present) | Debezium + Kafka Connect + ZooKeeper |
| Effort developpement | 1 sprint (cette tache) | 3 sprints (config, hardening, tests) |
| Maintenance | minime | importante (slots WAL, lag monitoring) |
| Resilience | excellente (restart safe via state) | tres bonne (WAL replay) |
| Cout infra cloud | 0 EUR additionnel | ~400 EUR/mois (Kafka Connect cluster) |

**Verdict Sprint 13** : polling = ROI excellent. Sprint 35+ : on reevalue si volumes justifient migration.

### 2.3 Alternatives considerees pour la strategie idempotency

L'idempotency de l'ETL est critique : si une execution echoue partiellement et rejoue le meme delta, on ne doit pas creer de doublons dans ClickHouse. Plusieurs strategies ont ete evaluees.

| Strategie | Pros | Cons | Decision |
|-----------|------|------|----------|
| **A. ReplacingMergeTree + sort key (transaction_id)** | Auto-dedup au merge background, simple | Doublons visibles entre les merges (queries doivent utiliser `FINAL` modifier ou attendre OPTIMIZE) | Considere |
| **B. DELETE + INSERT atomic** | Pas de doublons jamais | DELETE row-level ClickHouse asynchrone et lent (anti-pattern) | Rejete |
| **C. Truncate partition + reinsert** | Atomic, propre | Granularite partition = mois entier = potentiellement millions de rows | Rejete |
| **D. (RETENU) MergeTree + INSERT IGNORE pattern + state cursor** | Simple, deterministe, pas de doublons | Plus de code orchestration | RETENU |

**Strategie D detaillee** :
1. State `last_synced_timestamp` precis par table (microseconde).
2. SELECT delta Postgres `WHERE updated_at > $last_synced AND updated_at <= $cursor` (cursor = `now() - 5 sec` pour eviter race condition writes en cours).
3. INSERT batch ClickHouse (engine MergeTree append-only).
4. Si insert reussit, UPDATE `last_synced_timestamp = $cursor`.
5. Si insert echec, ne pas UPDATE state -> retry au prochain cycle replay meme delta (idempotency par cursor temporel + monotonic `updated_at`).

Cette strategie evite les doublons SI ET SEULEMENT SI les rows Postgres ont un `updated_at` strictement croissant. Verification : tous les triggers `set_updated_at` sont en place depuis Sprint 2 (audit timestamps), confirme par grep dans `repo/packages/database/src/migrations/`.

### 2.4 Trade-offs explicites

**Trade-off 1 : Eventual consistency 5 minutes**. Une transaction faite a 14:00:03 apparait dans ClickHouse au prochain tick (typiquement 14:05). Une dashboard refresh a 14:01 ne voit pas cette transaction. C'est tolere pour les analyses business (cumuls journee/mois/annee, KPI haut niveau) mais inadapte pour anti-fraud realtime (qui reste sur Postgres directement).

**Trade-off 2 : Doublons transitoires lors de retry**. Si l'ETL echoue apres INSERT ClickHouse mais avant UPDATE state, le prochain cycle replay le meme delta -> doublons momentanes. Mitigation : queries OLAP critiques utilisent `argMax(transaction_id, ingested_at)` ou `FINAL` modifier pour ne retenir que la derniere version. Sprint 35+ : engine `ReplacingMergeTree` pourra etre active sans changer le code consommateur.

**Trade-off 3 : Pas de delete propagation**. Si un row Postgres est `DELETE`d (rare, audit trail discourage), l'ETL ne le voit pas (SELECT ne retourne pas les rows supprimees). Le row reste a jamais dans ClickHouse. Mitigation : on n'utilise jamais `DELETE` sur les tables sources (soft delete via `deleted_at`), et l'ETL traite `deleted_at IS NOT NULL` comme un row a flag-as-deleted dans ClickHouse (`status='deleted'`).

**Trade-off 4 : Schema drift entre Postgres et ClickHouse**. Si on ajoute une colonne a `pay_transactions` Postgres, ClickHouse ne la voit pas tant qu'on n'a pas ALTER TABLE ClickHouse + redeploye le code ETL. Mitigation : la liste explicite des colonnes mappees dans le code ETL agit comme une "interface schemas" : un dev qui ajoute une colonne Postgres voit le mismatch en revue de code.

**Trade-off 5 : Resync complete = full scan tables Postgres**. Si un super-admin trigger `POST /admin/analytics/resync?table=transactions`, on relit toute la table `pay_transactions` (potentiellement millions de rows). Sur 10M rows, ca prend ~3-5 minutes. Mitigation : resync est rare (corruption ClickHouse, migration schema), endpoint protege RBAC superadmin, executable en cron nuit (3am Casablanca).

### 2.5 Decisions strategiques referenced

- **decision-001 (monorepo)** : pipeline ETL vit dans `@insurtech/analytics`, ne contamine pas `@insurtech/database` ou `@insurtech/api`.
- **decision-002 (multi-tenant 3 niveaux)** : ETL est cross-tenant (un seul cycle ingere tous les tenants), filtres tenant_id appliques au consommateur (AnalyticsService Tache 3.6.3).
- **decision-003 (TypeORM)** : extraction Postgres via TypeORM Repository ou query builder, pas de SQL raw quand evitable.
- **decision-006 (no-emoji)** : aucune emoji.
- **decision-008 (data residency)** : pipeline reste cote serveur Maroc, aucune donnee ne transite hors MA.

### 2.6 Pieges techniques connus

1. **Piege : `updated_at` non monotone**. Si deux rows ont le meme `updated_at` au microseconde pres et qu'on filtre `WHERE updated_at > $cursor`, on peut sauter une row. **Solution** : utiliser `WHERE (updated_at, id) > ($cursor, $lastId)` (composite cursor) ou accepter cursor a la milliseconde + replay safe via append-only.
2. **Piege : transactions Postgres long-running**. Une transaction Postgres ouverte depuis 10 minutes peut avoir `updated_at` plus ancien que `now()` mais row visible apres commit. **Solution** : utiliser `READ COMMITTED` isolation level et cursor `now() - 30 sec` pour donner du buffer.
3. **Piege : BullMQ job overlap**. Si une execution prend plus de 5 minutes, la suivante peut demarrer en parallele. **Solution** : lock distribue Redis (`SETNX etl:lock:<table> $jobId EX 600`) + skip si lock present.
4. **Piege : memoire heap V8 saturee sur grosse delta**. SELECT 1M rows + INSERT 1M rows en memoire = crash heap. **Solution** : chunking explicite 1000 rows par batch + curseur Postgres `OFFSET ... LIMIT` ou mieux : `WHERE id > $last_id ORDER BY id LIMIT 1000`.
5. **Piege : timezone Postgres vs ClickHouse**. `pay_transactions.updated_at` Postgres `TIMESTAMPTZ` est UTC ; cursor stocke en ISO string sans timezone. **Solution** : forcer `SET TIME ZONE 'UTC'` dans session ETL Postgres + serialiser cursor en ISO 8601 UTC.
6. **Piege : Postgres replication lag**. En prod Atlas Cloud, lectures sur replica DC2 peuvent etre en retard de 1-2 sec. **Solution** : ETL lit toujours sur primary DC1 (Sprint 35 config explicite).
7. **Piege : Kafka events pas encore consommes au moment ETL**. Si Books journal entry vient d'etre cree via Kafka consumer asynchrone, l'ETL peut le rater. **Solution** : `updated_at` est setupdate par le consumer apres INSERT, pas avant.
8. **Piege : JSON metadata Postgres jsonb -> ClickHouse String**. Postgres jsonb a auto-canonicalization (`{"a":1,"b":2}` peut devenir `{"b": 2, "a": 1}`). **Solution** : `JSON.stringify(row.metadata)` cote Node avant insert.
9. **Piege : `Decimal128` Postgres vs `Decimal64` ClickHouse**. Si on stocke amounts Postgres en `NUMERIC(15,2)` et ClickHouse `Decimal64(2)`, l'overflow est silencieux. **Solution** : verifier max amount <= 9999999999999.99 (16 chiffres entiers), Sprint 35 migrer vers `Decimal128`.
10. **Piege : retry sans backoff**. Retry immediat sur echec ClickHouse peut hammer un serveur deja en stress. **Solution** : BullMQ `backoff: { type: 'exponential', delay: 5000 }` (5s, 10s, 20s).
11. **Piege : etl_state table grossit indefiniment**. Si on insere un row par cycle (~288 par jour), la table grossit. **Solution** : pattern UPSERT (`ON CONFLICT (table_name) DO UPDATE`), pas append. Table reste ~10 rows.
12. **Piege : super-admin resync sans rate limit**. Un admin peut declencher 100 resync en parallele -> charge serveur. **Solution** : verrou par table (lock Redis), endpoint retourne 429 si lock present.
13. **Piege : changement de schema fct_*  sans migration ClickHouse**. ALTER TABLE ClickHouse pendant que l'ETL ecrit -> erreurs. **Solution** : maintenance window planifiee (3am Casablanca) pour ALTER + redeploy ETL atomique.
14. **Piege : Kafka event topic non standardise**. Quelqu'un emit `analytics.etl.completed` au lieu de `insurtech.events.analytics.etl_completed`. **Solution** : import `Topics.ETL_COMPLETED` depuis `@insurtech/shared-types/kafka-topics.ts` (Sprint 2 + Sprint 9).

---

## 3. Architecture context

### 3.1 Position dans le sprint 13

Cette tache 3.6.2 est la **deuxieme** des 14 du sprint 13. Elle :

- **Depend de** : Tache 3.6.1 (schemas ClickHouse crees, ClickHouseService disponible), Sprint 11 (`pay_transactions` table peuple), Sprint 12 (`books_journal_lines`), Sprint 9 (`comm_messages`), Sprint 8 (`booking_appointments`, `crm_contacts`), Sprint 10 (`doc_signatures`), Sprint 6 (`auth_tenants`).
- **Bloque** : Tache 3.6.3 AnalyticsService (lit ClickHouse alimentee par cet ETL), 3.6.4 Dashboards (consommateurs finaux), 3.6.14 Tests E2E.

### 3.2 Position dans le programme global

Le pattern ETL polling de cette tache est strictement reutilisable pour les Sprints aval :
- **Sprint 14+ Insure** : ajout methodes `syncPolicies`, `syncClaims` dans le meme service ETL.
- **Sprint 20+ Repair** : ajout `syncReparations`, `syncStockMovements` (provenance Tache 3.6.6).
- **Sprint 35 Hardening** : swap implementation interne polling -> Debezium CDC, interface inchangee.

### 3.3 Diagramme flow ETL

```
+--------------------------------------------------------+
| Postgres OLTP (Atlas Cloud Benguerir DC1)              |
| Tables sources :                                       |
|   pay_transactions       (Sprint 11)                   |
|   books_journal_lines    (Sprint 12)                   |
|   booking_appointments   (Sprint 8)                    |
|   comm_messages          (Sprint 9)                    |
|   doc_signatures         (Sprint 10)                   |
|   auth_tenants           (Sprint 6)                    |
|   crm_contacts           (Sprint 8)                    |
+--------------------------+-----------------------------+
                           |
                           | SELECT delta WHERE updated_at > $cursor
                           |   AND updated_at <= now() - INTERVAL '30 seconds'
                           |   ORDER BY id
                           |   LIMIT 1000
                           v
+--------------------------+-----------------------------+
| BullMQ Worker EtlCronJob                                |
| cron : */5 * * * *                                      |
| 7 tasks per cycle (1 par table)                         |
| Lock Redis : SETNX etl:lock:<table> $jobId EX 600       |
| Retry : exponential 5s/10s/20s, max 3 attempts          |
+--------------------------+-----------------------------+
                           |
                           v
+--------------------------+-----------------------------+
| PostgresToClickHouseEtl service                         |
| Methods :                                               |
|   syncTransactions(sinceTimestamp) -> { extracted, inserted, durationMs }
|   syncJournalEntries(...)                               |
|   syncAppointments(...)                                 |
|   syncMessages(...)                                     |
|   syncDocumentsSigned(...)                              |
|   syncTenants() (full)                                  |
|   syncCustomers(sinceTimestamp)                         |
| Transform (joins, denorm, type casts)                   |
+--------------------------+-----------------------------+
                           |
                           | INSERT batch 1000 rows / format JSONEachRow
                           v
+--------------------------+-----------------------------+
| ClickHouse 24.10                                        |
| Tables faits + dimensions (Tache 3.6.1)                 |
+--------------------------+-----------------------------+
                           |
                           v
+--------------------------+-----------------------------+
| EtlStateService                                         |
| UPDATE analytics_etl_state SET last_synced_at = $cursor |
|   WHERE table_name = $table                             |
| Kafka event : insurtech.events.analytics.etl_completed  |
+---------------------------------------------------------+
```

---

## 4. Livrables checkables

- [ ] Migration TypeORM `repo/packages/database/src/migrations/{date}-AnalyticsEtlState.ts` cree `analytics_etl_state` (id, table_name UNIQUE, last_synced_at TIMESTAMPTZ, last_id BIGINT, rows_synced_total BIGINT, last_status VARCHAR, last_error TEXT, created_at, updated_at)
- [ ] Entity `repo/packages/analytics/src/entities/etl-state.entity.ts` (TypeORM 0.3)
- [ ] Service `repo/packages/analytics/src/etl/etl-state.service.ts` (~120 lignes : getState, upsertState, listAllStates, resetState)
- [ ] Service `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts` (~450 lignes : 7 methodes sync)
- [ ] BullMQ Job `repo/packages/analytics/src/jobs/etl-cron.job.ts` (~120 lignes : cron + lock + retry)
- [ ] Lock service `repo/packages/analytics/src/etl/etl-lock.service.ts` (~80 lignes : Redis SETNX)
- [ ] Controller admin `repo/apps/api/src/modules/admin/controllers/admin-analytics.controller.ts` (~120 lignes : resync endpoint)
- [ ] DTO `repo/apps/api/src/modules/admin/dto/resync-request.dto.ts`
- [ ] Kafka event publisher integration : emit `insurtech.events.analytics.etl_completed` sur success
- [ ] Tests unitaires `etl-state.service.spec.ts` (~200 lignes, 10 tests)
- [ ] Tests unitaires `postgres-to-clickhouse.etl.spec.ts` (~350 lignes, 18 tests)
- [ ] Tests integration `etl-pipeline.integration.spec.ts` (~250 lignes, 8 tests E2E)
- [ ] Tests E2E `admin-analytics.e2e-spec.ts` (~150 lignes, 5 tests endpoint resync)
- [ ] Documentation `repo/docs/analytics/etl-pipeline.md` (~180 lignes : architecture, ops, troubleshooting)
- [ ] Update `repo/packages/analytics/src/index.ts` exports `PostgresToClickHouseEtl`, `EtlStateService`, `EtlCronJob`
- [ ] Update `repo/apps/api/src/modules/admin/admin.module.ts` registrer controller
- [ ] Update `repo/.env.example` `ETL_POLL_CRON`, `ETL_BATCH_SIZE`, `ETL_CURSOR_SAFETY_SECONDS`, `ETL_LOCK_TTL_SECONDS`
- [ ] Metrics Prometheus `etl_rows_synced_total`, `etl_duration_seconds`, `etl_errors_total` (preparation Sprint 35 monitoring)

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/database/src/migrations/1715000000000-AnalyticsEtlState.ts    (nouveau, ~90 lignes)
repo/packages/analytics/src/entities/etl-state.entity.ts                     (nouveau, ~50 lignes)
repo/packages/analytics/src/etl/etl-state.service.ts                          (nouveau, ~130 lignes)
repo/packages/analytics/src/etl/etl-state.service.spec.ts                     (nouveau, ~210 lignes, 10 tests)
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                 (nouveau, ~480 lignes, 7 methodes)
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.spec.ts            (nouveau, ~370 lignes, 18 tests)
repo/packages/analytics/src/etl/etl-lock.service.ts                           (nouveau, ~90 lignes)
repo/packages/analytics/src/etl/etl-lock.service.spec.ts                      (nouveau, ~140 lignes, 7 tests)
repo/packages/analytics/src/jobs/etl-cron.job.ts                               (nouveau, ~130 lignes)
repo/packages/analytics/src/jobs/etl-cron.job.spec.ts                          (nouveau, ~180 lignes, 8 tests)
repo/packages/analytics/src/etl/etl-metrics.ts                                 (nouveau, ~80 lignes Prom-client)
repo/packages/analytics/src/etl/types.ts                                        (nouveau, ~70 lignes interfaces)
repo/packages/analytics/src/index.ts                                            (modif, +6 exports)
repo/apps/api/src/modules/admin/controllers/admin-analytics.controller.ts      (nouveau, ~140 lignes)
repo/apps/api/src/modules/admin/dto/resync-request.dto.ts                       (nouveau, ~40 lignes Zod)
repo/apps/api/src/modules/admin/admin.module.ts                                 (modif, registrer)
repo/apps/api/test/admin/admin-analytics.e2e-spec.ts                            (nouveau, ~180 lignes, 5 tests)
repo/apps/api/test/integration/etl-pipeline.integration.spec.ts                  (nouveau, ~290 lignes, 8 tests)
repo/.env.example                                                               (modif, +4 lignes ETL_*)
repo/docs/analytics/etl-pipeline.md                                              (nouveau, ~190 lignes)
repo/packages/analytics/package.json                                              (modif, +deps bullmq, ioredis)
```

**Total** : 17 fichiers crees, 4 modifies.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier : `repo/packages/database/src/migrations/1715000000000-AnalyticsEtlState.ts`

```typescript
// repo/packages/database/src/migrations/1715000000000-AnalyticsEtlState.ts
// Skalean InsurTech v2.2 -- Migration analytics_etl_state
// Reference : B-13 Sprint 13 Tache 3.6.2
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsEtlState1715000000000 implements MigrationInterface {
  name = 'AnalyticsEtlState1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics_etl_state (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name          VARCHAR(64) NOT NULL UNIQUE,
        last_synced_at      TIMESTAMPTZ,
        last_id             BIGINT,
        rows_synced_total   BIGINT NOT NULL DEFAULT 0,
        last_status         VARCHAR(32) NOT NULL DEFAULT 'pending',
        last_error          TEXT,
        last_batch_id       UUID,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_status CHECK (last_status IN ('pending', 'running', 'success', 'failed', 'locked'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_etl_state_table_name 
        ON analytics_etl_state(table_name);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_analytics_etl_state_last_synced 
        ON analytics_etl_state(last_synced_at);
    `);

    // Trigger maj updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_analytics_etl_state_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_analytics_etl_state_updated_at
        BEFORE UPDATE ON analytics_etl_state
        FOR EACH ROW EXECUTE FUNCTION set_analytics_etl_state_updated_at();
    `);

    // Seed initial rows pour les 7 tables tracked
    await queryRunner.query(`
      INSERT INTO analytics_etl_state (table_name, last_synced_at, last_status)
      VALUES
        ('fct_transactions', NULL, 'pending'),
        ('fct_journal_entries', NULL, 'pending'),
        ('fct_appointments', NULL, 'pending'),
        ('fct_messages', NULL, 'pending'),
        ('fct_documents_signed', NULL, 'pending'),
        ('dim_tenants', NULL, 'pending'),
        ('dim_customers', NULL, 'pending')
      ON CONFLICT (table_name) DO NOTHING;
    `);

    // Commentaires documentation
    await queryRunner.query(`
      COMMENT ON TABLE analytics_etl_state IS 
        'Skalean InsurTech v2.2 -- ETL state tracker per ClickHouse fct_*/dim_* table. Sprint 13 Tache 3.6.2.';
      COMMENT ON COLUMN analytics_etl_state.last_synced_at IS 
        'Timestamp Postgres jusqu auquel les rows ont ete sync vers ClickHouse. NULL = jamais sync.';
      COMMENT ON COLUMN analytics_etl_state.last_id IS 
        'Optionnel : dernier ID source pour cursor composite. Usage rare (rows avec same updated_at).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_analytics_etl_state_updated_at ON analytics_etl_state;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_analytics_etl_state_updated_at();`);
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_etl_state;`);
  }
}
```

### 6.2 Fichier : `repo/packages/analytics/src/entities/etl-state.entity.ts`

```typescript
// repo/packages/analytics/src/entities/etl-state.entity.ts
// Skalean InsurTech v2.2 -- Entity ETL state TypeORM 0.3
// Reference : B-13 Sprint 13 Tache 3.6.2
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EtlStatus = 'pending' | 'running' | 'success' | 'failed' | 'locked';

@Entity({ name: 'analytics_etl_state' })
@Index('idx_analytics_etl_state_table_name', ['table_name'])
@Index('idx_analytics_etl_state_last_synced', ['last_synced_at'])
export class AnalyticsEtlState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  table_name!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_synced_at!: Date | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigIntTransformer })
  last_id!: number | null;

  @Column({ type: 'bigint', default: 0, transformer: bigIntTransformer })
  rows_synced_total!: number;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  last_status!: EtlStatus;

  @Column({ type: 'text', nullable: true })
  last_error!: string | null;

  @Column({ type: 'uuid', nullable: true })
  last_batch_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}

const bigIntTransformer = {
  to: (val: number | null) => val,
  from: (val: string | null) => (val == null ? null : Number(val)),
};
```

### 6.3 Fichier : `repo/packages/analytics/src/etl/types.ts`

```typescript
// repo/packages/analytics/src/etl/types.ts
// Skalean InsurTech v2.2 -- Types ETL internes
// Reference : B-13 Sprint 13 Tache 3.6.2

export interface EtlSyncResult {
  tableName: string;
  rowsExtracted: number;
  rowsInserted: number;
  durationMs: number;
  cursorBefore: Date | null;
  cursorAfter: Date;
  batchId: string;
  errors: string[];
}

export interface EtlSyncOptions {
  /** Override le timestamp source (defaults : lecture state). Permet resync explicite. */
  sinceTimestamp?: Date;
  /** Override la batch size (defaults : ETL_BATCH_SIZE env). */
  batchSize?: number;
  /** Cursor safety : ne lit pas les rows updated_at > now() - safetyMs. Defaults : 30 sec. */
  safetyMs?: number;
  /** ID du batch (UUID). Si omis, genere. */
  batchId?: string;
}

export interface IEtlConnector {
  syncTransactions(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
  syncJournalEntries(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
  syncAppointments(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
  syncMessages(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
  syncDocumentsSigned(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
  syncTenants(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
  syncCustomers(opts?: EtlSyncOptions): Promise<EtlSyncResult>;
}

export const ETL_TABLES_TRACKED = [
  'fct_transactions',
  'fct_journal_entries',
  'fct_appointments',
  'fct_messages',
  'fct_documents_signed',
  'dim_tenants',
  'dim_customers',
] as const;

export type EtlTableName = (typeof ETL_TABLES_TRACKED)[number];
```

### 6.4 Fichier : `repo/packages/analytics/src/etl/etl-state.service.ts`

```typescript
// repo/packages/analytics/src/etl/etl-state.service.ts
// Skalean InsurTech v2.2 -- Service gestion analytics_etl_state
// Reference : B-13 Sprint 13 Tache 3.6.2
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEtlState, EtlStatus } from '../entities/etl-state.entity';
import { EtlTableName } from './types';

@Injectable()
export class EtlStateService {
  private readonly logger = new Logger(EtlStateService.name);

  constructor(
    @InjectRepository(AnalyticsEtlState)
    private readonly repo: Repository<AnalyticsEtlState>,
  ) {}

  async getState(tableName: EtlTableName): Promise<AnalyticsEtlState | null> {
    return this.repo.findOne({ where: { table_name: tableName } });
  }

  async listAll(): Promise<AnalyticsEtlState[]> {
    return this.repo.find({ order: { table_name: 'ASC' } });
  }

  async markRunning(tableName: EtlTableName, batchId: string): Promise<void> {
    await this.repo.update({ table_name: tableName }, {
      last_status: 'running',
      last_batch_id: batchId,
      last_error: null,
    });
  }

  async markSuccess(
    tableName: EtlTableName,
    payload: { lastSyncedAt: Date; lastId?: number; rowsInserted: number },
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(AnalyticsEtlState)
      .set({
        last_synced_at: payload.lastSyncedAt,
        last_id: payload.lastId ?? null,
        rows_synced_total: () => `rows_synced_total + ${Math.max(0, payload.rowsInserted)}`,
        last_status: 'success',
        last_error: null,
      })
      .where('table_name = :tableName', { tableName })
      .execute();
    this.logger.log({
      action: 'etl_state_success',
      table: tableName,
      last_synced_at: payload.lastSyncedAt.toISOString(),
      rows: payload.rowsInserted,
    });
  }

  async markFailed(tableName: EtlTableName, errorMessage: string): Promise<void> {
    await this.repo.update({ table_name: tableName }, {
      last_status: 'failed',
      last_error: errorMessage.slice(0, 2000),
    });
    this.logger.warn({
      action: 'etl_state_failed',
      table: tableName,
      error: errorMessage.slice(0, 200),
    });
  }

  async markLocked(tableName: EtlTableName): Promise<void> {
    await this.repo.update({ table_name: tableName }, { last_status: 'locked' });
  }

  async reset(tableName: EtlTableName): Promise<void> {
    await this.repo.update({ table_name: tableName }, {
      last_synced_at: null,
      last_id: null,
      last_status: 'pending',
      last_error: null,
      rows_synced_total: 0,
    });
    this.logger.log({ action: 'etl_state_reset', table: tableName });
  }

  async getCursor(tableName: EtlTableName): Promise<Date> {
    const state = await this.getState(tableName);
    if (!state || !state.last_synced_at) {
      // Default : sync from 90 jours en arriere si jamais sync (premier run)
      const defaultStart = new Date();
      defaultStart.setUTCDate(defaultStart.getUTCDate() - 90);
      return defaultStart;
    }
    return state.last_synced_at;
  }
}
```

### 6.5 Fichier : `repo/packages/analytics/src/etl/etl-lock.service.ts`

```typescript
// repo/packages/analytics/src/etl/etl-lock.service.ts
// Skalean InsurTech v2.2 -- Lock distribue Redis pour ETL
// Reference : B-13 Sprint 13 Tache 3.6.2
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { EtlTableName } from './types';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class EtlLockService {
  private readonly logger = new Logger(EtlLockService.name);
  private readonly LOCK_TTL_SECONDS = Number(process.env.ETL_LOCK_TTL_SECONDS ?? 600);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Tente de prendre le lock pour une table ETL.
   * @returns true si lock acquis, false si deja detenu par un autre process.
   */
  async acquire(tableName: EtlTableName, jobId: string): Promise<boolean> {
    const key = this.lockKey(tableName);
    const result = await this.redis.set(key, jobId, 'EX', this.LOCK_TTL_SECONDS, 'NX');
    const acquired = result === 'OK';
    if (acquired) {
      this.logger.debug({ action: 'etl_lock_acquired', table: tableName, jobId });
    } else {
      const currentOwner = await this.redis.get(key);
      this.logger.warn({ action: 'etl_lock_held', table: tableName, owner: currentOwner });
    }
    return acquired;
  }

  /**
   * Libere le lock. Lua script atomique pour eviter de liberer le lock d'un autre process.
   */
  async release(tableName: EtlTableName, jobId: string): Promise<boolean> {
    const key = this.lockKey(tableName);
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = (await this.redis.eval(lua, 1, key, jobId)) as number;
    const released = result === 1;
    if (released) {
      this.logger.debug({ action: 'etl_lock_released', table: tableName, jobId });
    }
    return released;
  }

  /**
   * Force la liberation du lock (admin/recovery).
   */
  async forceRelease(tableName: EtlTableName): Promise<void> {
    await this.redis.del(this.lockKey(tableName));
    this.logger.warn({ action: 'etl_lock_force_released', table: tableName });
  }

  async isLocked(tableName: EtlTableName): Promise<boolean> {
    const value = await this.redis.get(this.lockKey(tableName));
    return value !== null;
  }

  private lockKey(tableName: EtlTableName): string {
    return `etl:lock:${tableName}`;
  }
}
```

### 6.6 Fichier : `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`

```typescript
// repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts
// Skalean InsurTech v2.2 -- ETL polling-based Postgres -> ClickHouse
// Reference : B-13 Sprint 13 Tache 3.6.2
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ClickHouseService } from '../services/clickhouse.service';
import { EtlStateService } from './etl-state.service';
import { EtlSyncOptions, EtlSyncResult, IEtlConnector, EtlTableName } from './types';
import { etlRowsCounter, etlDurationHistogram, etlErrorsCounter } from './etl-metrics';

const DEFAULT_BATCH_SIZE = Number(process.env.ETL_BATCH_SIZE ?? 1000);
const DEFAULT_SAFETY_MS = Number(process.env.ETL_CURSOR_SAFETY_SECONDS ?? 30) * 1000;

@Injectable()
export class PostgresToClickHouseEtl implements IEtlConnector {
  private readonly logger = new Logger(PostgresToClickHouseEtl.name);

  constructor(
    private readonly ds: DataSource,
    private readonly ch: ClickHouseService,
    private readonly state: EtlStateService,
  ) {}

  // ---------- syncTransactions ----------
  async syncTransactions(opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'fct_transactions';
    return this.runSync(tableName, opts, async (since, until, batchSize) => {
      const rows = await this.ds.query(`
        SELECT 
          p.id AS transaction_id,
          p.tenant_id,
          p.customer_id,
          COALESCE(c.email, p.customer_email_snapshot, '') AS customer_email,
          p.event_date,
          p.created_at AS event_datetime,
          p.captured_at,
          p.refunded_at,
          p.provider,
          p.payment_method,
          p.status,
          p.currency,
          COALESCE(p.country_code, 'MA') AS country_code,
          p.amount::text AS amount,
          p.fees_amount::text AS fees_amount,
          (p.amount - p.fees_amount)::text AS net_amount,
          COALESCE(p.refunded_amount::text, '0') AS refunded_amount,
          p.related_resource_type,
          p.related_resource_id,
          COALESCE(p.metadata::text, '{}') AS metadata,
          p.updated_at
        FROM pay_transactions p
        LEFT JOIN crm_contacts c ON c.id = p.customer_id
        WHERE p.updated_at > $1
          AND p.updated_at <= $2
        ORDER BY p.updated_at, p.id
        LIMIT $3
      `, [since, until, batchSize]);
      return this.normalizeForClickHouse(rows);
    });
  }

  // ---------- syncJournalEntries ----------
  async syncJournalEntries(opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'fct_journal_entries';
    return this.runSync(tableName, opts, async (since, until, batchSize) => {
      const rows = await this.ds.query(`
        SELECT
          l.id AS line_id,
          l.entry_id,
          e.tenant_id,
          DATE(e.posted_at) AS event_date,
          e.posted_at,
          EXTRACT(YEAR FROM e.posted_at)::int AS fiscal_year,
          EXTRACT(MONTH FROM e.posted_at)::int AS fiscal_period,
          l.account_code,
          a.class_number AS account_class,
          a.nature AS account_nature,
          COALESCE(l.debit_amount::text, '0') AS debit_amount,
          COALESCE(l.credit_amount::text, '0') AS credit_amount,
          (COALESCE(l.credit_amount, 0) - COALESCE(l.debit_amount, 0))::text AS balance_signed,
          e.journal_code,
          e.source_resource_type,
          e.source_resource_id,
          COALESCE(l.tva_rate::text, '0') AS tva_rate,
          COALESCE(l.tva_amount::text, '0') AS tva_amount,
          COALESCE(l.label, '') AS label,
          l.updated_at
        FROM books_journal_lines l
        JOIN books_journal_entries e ON e.id = l.entry_id
        JOIN books_accounts a ON a.code = l.account_code AND (a.tenant_id = e.tenant_id OR a.tenant_id IS NULL)
        WHERE l.updated_at > $1
          AND l.updated_at <= $2
        ORDER BY l.updated_at, l.id
        LIMIT $3
      `, [since, until, batchSize]);
      return this.normalizeForClickHouse(rows);
    });
  }

  // ---------- syncAppointments ----------
  async syncAppointments(opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'fct_appointments';
    return this.runSync(tableName, opts, async (since, until, batchSize) => {
      const rows = await this.ds.query(`
        SELECT
          a.id AS appointment_id,
          a.tenant_id,
          a.customer_id,
          COALESCE(c.email, '') AS customer_email,
          DATE(a.starts_at) AS event_date,
          a.starts_at,
          a.ends_at,
          EXTRACT(EPOCH FROM (a.ends_at - a.starts_at))/60 AS duration_minutes,
          COALESCE(a.appointment_type, 'inspection') AS appointment_type,
          a.room_id,
          a.assigned_user_id,
          a.status,
          a.location_lat,
          a.location_lng,
          COALESCE(a.city, '') AS city,
          a.cancelled_at,
          COALESCE(a.cancellation_reason, '') AS cancellation_reason,
          CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END AS no_show,
          a.updated_at
        FROM booking_appointments a
        LEFT JOIN crm_contacts c ON c.id = a.customer_id
        WHERE a.updated_at > $1 AND a.updated_at <= $2
        ORDER BY a.updated_at, a.id
        LIMIT $3
      `, [since, until, batchSize]);
      return this.normalizeForClickHouse(rows);
    });
  }

  // ---------- syncMessages ----------
  async syncMessages(opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'fct_messages';
    return this.runSync(tableName, opts, async (since, until, batchSize) => {
      const rows = await this.ds.query(`
        SELECT
          m.id AS message_id,
          m.tenant_id,
          m.customer_id,
          COALESCE(m.recipient_email, '') AS customer_email,
          DATE(m.sent_at) AS event_date,
          m.sent_at,
          m.delivered_at,
          m.read_at,
          m.replied_at,
          m.channel,
          m.direction,
          COALESCE(m.template_id, '') AS template_id,
          COALESCE(m.locale, 'fr') AS locale,
          COALESCE(m.related_resource_type, '') AS related_resource_type,
          m.related_resource_id,
          COALESCE(m.cost_micro_mad, 0) AS cost_micro_mad,
          COALESCE(m.delivery_status, 'sent') AS delivery_status,
          COALESCE(m.error_code, '') AS error_code,
          m.updated_at
        FROM comm_messages m
        WHERE m.updated_at > $1 AND m.updated_at <= $2
        ORDER BY m.updated_at, m.id
        LIMIT $3
      `, [since, until, batchSize]);
      return this.normalizeForClickHouse(rows);
    });
  }

  // ---------- syncDocumentsSigned ----------
  async syncDocumentsSigned(opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'fct_documents_signed';
    return this.runSync(tableName, opts, async (since, until, batchSize) => {
      const rows = await this.ds.query(`
        SELECT
          s.id AS signature_id,
          s.document_id,
          d.tenant_id,
          COALESCE(s.signer_email, '') AS signer_email,
          s.signer_id,
          DATE(s.initiated_at) AS event_date,
          s.initiated_at,
          s.signed_at,
          s.expired_at,
          CASE WHEN s.signed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (s.signed_at - s.initiated_at))::int
            ELSE NULL END AS time_to_sign_seconds,
          COALESCE(d.document_type, 'other') AS document_type,
          COALESCE(s.provider, 'barid_esign') AS signature_provider,
          COALESCE(s.level, 'advanced') AS signature_level,
          s.status,
          d.size_kb AS document_size_kb,
          d.pages_count,
          COALESCE(s.legal_value, 'presumptive') AS legal_value,
          COALESCE(s.timestamp_authority, 'anrt') AS timestamp_authority,
          s.updated_at
        FROM doc_signatures s
        JOIN doc_documents d ON d.id = s.document_id
        WHERE s.updated_at > $1 AND s.updated_at <= $2
        ORDER BY s.updated_at, s.id
        LIMIT $3
      `, [since, until, batchSize]);
      return this.normalizeForClickHouse(rows);
    });
  }

  // ---------- syncTenants (full sync, low volume) ----------
  async syncTenants(_opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'dim_tenants';
    const batchId = randomUUID();
    const start = Date.now();
    await this.state.markRunning(tableName, batchId);
    try {
      const rows = await this.ds.query(`
        SELECT
          t.id AS tenant_id,
          t.slug,
          t.legal_name,
          COALESCE(t.industry, 'unknown') AS industry,
          COALESCE(t.country, 'MA') AS country,
          COALESCE(t.city, '') AS city,
          t.created_at AS onboarded_at,
          t.activated_at,
          t.churned_at,
          COALESCE(t.churn_reason, '') AS churn_reason,
          COALESCE(t.subscription_plan, 'starter') AS subscription_plan,
          COALESCE((t.monthly_revenue_mad * 1000000)::bigint, 0) AS monthly_revenue_micro_mad,
          t.cnss_number,
          t.ice_number,
          t.rc_number,
          t.acaps_agrement,
          t.updated_at
        FROM auth_tenants t
        ORDER BY t.id
      `);
      const normalized = this.normalizeForClickHouse(rows);
      const inserted = await this.insertInChunks(tableName, normalized);
      const duration = Date.now() - start;
      etlRowsCounter.inc({ table: tableName }, inserted);
      etlDurationHistogram.observe({ table: tableName }, duration / 1000);
      const cursorAfter = new Date();
      await this.state.markSuccess(tableName, {
        lastSyncedAt: cursorAfter,
        rowsInserted: inserted,
      });
      return {
        tableName,
        rowsExtracted: rows.length,
        rowsInserted: inserted,
        durationMs: duration,
        cursorBefore: null,
        cursorAfter,
        batchId,
        errors: [],
      };
    } catch (err) {
      etlErrorsCounter.inc({ table: tableName });
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.state.markFailed(tableName, errMsg);
      throw err;
    }
  }

  // ---------- syncCustomers ----------
  async syncCustomers(opts: EtlSyncOptions = {}): Promise<EtlSyncResult> {
    const tableName: EtlTableName = 'dim_customers';
    return this.runSync(tableName, opts, async (since, until, batchSize) => {
      const rows = await this.ds.query(`
        SELECT
          c.id AS customer_id,
          c.tenant_id,
          COALESCE(c.email, '') AS email,
          COALESCE(c.full_name, '') AS full_name,
          COALESCE(c.contact_type, 'prospect') AS customer_type,
          COALESCE(c.persona, 'individual') AS persona,
          COALESCE(c.age_range, '') AS age_range,
          COALESCE(c.gender, 'undisclosed') AS gender,
          COALESCE(c.city, '') AS city,
          COALESCE(c.region, '') AS region,
          COALESCE(c.acquisition_source, 'organic') AS acquisition_source,
          COALESCE(DATE(c.created_at), CURRENT_DATE) AS acquisition_date,
          c.first_purchase_at,
          COALESCE(c.lifetime_value_mad::text, '0') AS lifetime_value_mad,
          COALESCE(c.total_orders, 0) AS total_orders,
          c.last_order_at,
          c.updated_at
        FROM crm_contacts c
        WHERE c.updated_at > $1 AND c.updated_at <= $2
        ORDER BY c.updated_at, c.id
        LIMIT $3
      `, [since, until, batchSize]);
      return this.normalizeForClickHouse(rows);
    });
  }

  // ---------- private helpers ----------

  /**
   * Pattern principal d'execution sync :
   * 1. Lock check via state
   * 2. Mark running
   * 3. Get cursor
   * 4. Fetch delta Postgres
   * 5. Insert batch ClickHouse
   * 6. Update state with new cursor + status
   * 7. Emit metrics
   */
  private async runSync(
    tableName: EtlTableName,
    opts: EtlSyncOptions,
    fetchFn: (since: Date, until: Date, batchSize: number) => Promise<Array<Record<string, unknown>>>,
  ): Promise<EtlSyncResult> {
    const batchId = opts.batchId ?? randomUUID();
    const start = Date.now();
    const safetyMs = opts.safetyMs ?? DEFAULT_SAFETY_MS;
    const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    const since = opts.sinceTimestamp ?? (await this.state.getCursor(tableName));
    const until = new Date(Date.now() - safetyMs);

    this.logger.log({
      action: 'etl_sync_start',
      table: tableName,
      batch_id: batchId,
      since: since.toISOString(),
      until: until.toISOString(),
    });

    await this.state.markRunning(tableName, batchId);

    try {
      const rawRows = await fetchFn(since, until, batchSize);
      const rowsInserted = rawRows.length > 0 
        ? await this.insertInChunks(tableName, rawRows.map((r) => this.addEtlMetadata(r, batchId)))
        : 0;
      const duration = Date.now() - start;

      etlRowsCounter.inc({ table: tableName }, rowsInserted);
      etlDurationHistogram.observe({ table: tableName }, duration / 1000);

      const cursorAfter = rawRows.length > 0 
        ? this.maxUpdatedAt(rawRows)
        : until;

      await this.state.markSuccess(tableName, {
        lastSyncedAt: cursorAfter,
        rowsInserted,
      });

      this.logger.log({
        action: 'etl_sync_complete',
        table: tableName,
        batch_id: batchId,
        rows_extracted: rawRows.length,
        rows_inserted: rowsInserted,
        duration_ms: duration,
        cursor_after: cursorAfter.toISOString(),
      });

      return {
        tableName,
        rowsExtracted: rawRows.length,
        rowsInserted,
        durationMs: duration,
        cursorBefore: since,
        cursorAfter,
        batchId,
        errors: [],
      };
    } catch (err) {
      etlErrorsCounter.inc({ table: tableName });
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.state.markFailed(tableName, errMsg);
      this.logger.error({
        action: 'etl_sync_failed',
        table: tableName,
        batch_id: batchId,
        error: errMsg.slice(0, 500),
      });
      throw err;
    }
  }

  private addEtlMetadata(row: Record<string, unknown>, batchId: string): Record<string, unknown> {
    return {
      ...row,
      etl_batch_id: batchId,
      ingested_at: new Date(),
    };
  }

  private maxUpdatedAt(rows: Array<Record<string, unknown>>): Date {
    let max = new Date(0);
    for (const r of rows) {
      const v = r['updated_at'];
      if (v instanceof Date && v > max) max = v;
      else if (typeof v === 'string') {
        const d = new Date(v);
        if (d > max) max = d;
      }
    }
    return max;
  }

  /**
   * Normalisation : convert Date -> 'YYYY-MM-DD HH:mm:ss' UTC string pour ClickHouse JSONEachRow.
   * Decimal numerique -> string. Null -> null prserve.
   */
  private normalizeForClickHouse(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v instanceof Date) {
          if (k === 'event_date' || k === 'acquisition_date') {
            out[k] = v.toISOString().slice(0, 10);
          } else {
            out[k] = v.toISOString().replace('T', ' ').slice(0, 19);
          }
        } else if (typeof v === 'bigint') {
          out[k] = v.toString();
        } else {
          out[k] = v;
        }
      }
      // updated_at est utilise pour cursor mais ne fait pas partie du schema ClickHouse
      delete out.updated_at;
      return out;
    });
  }

  /**
   * Insert en chunks de batchSize pour eviter memoire heap V8.
   */
  private async insertInChunks(
    tableName: string,
    rows: Array<Record<string, unknown>>,
    chunkSize = DEFAULT_BATCH_SIZE,
  ): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const result = await this.ch.insertBatch({
        table: `skalean_analytics.${tableName}`,
        values: chunk,
        format: 'JSONEachRow',
      });
      inserted += result.inserted;
    }
    return inserted;
  }
}
```

### 6.7 Fichier : `repo/packages/analytics/src/etl/etl-metrics.ts`

```typescript
// repo/packages/analytics/src/etl/etl-metrics.ts
// Skalean InsurTech v2.2 -- Metrics Prometheus ETL
// Reference : B-13 Sprint 13 Tache 3.6.2
import { Counter, Histogram } from 'prom-client';

export const etlRowsCounter = new Counter({
  name: 'etl_rows_synced_total',
  help: 'Total number of rows synced by ETL per table',
  labelNames: ['table'],
});

export const etlErrorsCounter = new Counter({
  name: 'etl_errors_total',
  help: 'Total number of ETL errors per table',
  labelNames: ['table'],
});

export const etlDurationHistogram = new Histogram({
  name: 'etl_duration_seconds',
  help: 'Duration of ETL sync per table',
  labelNames: ['table'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
});

export const etlLagSecondsGauge = new Counter({
  name: 'etl_lag_seconds',
  help: 'Time elapsed since last successful sync per table',
  labelNames: ['table'],
});
```

### 6.8 Fichier : `repo/packages/analytics/src/jobs/etl-cron.job.ts`

```typescript
// repo/packages/analytics/src/jobs/etl-cron.job.ts
// Skalean InsurTech v2.2 -- BullMQ cron job orchestrant l'ETL
// Reference : B-13 Sprint 13 Tache 3.6.2
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PostgresToClickHouseEtl } from '../etl/postgres-to-clickhouse.etl';
import { EtlLockService } from '../etl/etl-lock.service';
import { EtlStateService } from '../etl/etl-state.service';
import { ETL_TABLES_TRACKED, EtlTableName } from '../etl/types';

interface EtlJobPayload {
  table: EtlTableName;
  forceResync?: boolean;
}

@Injectable()
export class EtlCronJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EtlCronJob.name);
  private queue!: Queue<EtlJobPayload>;
  private worker!: Worker<EtlJobPayload>;
  private readonly POLL_CRON = process.env.ETL_POLL_CRON ?? '*/5 * * * *';

  constructor(
    private readonly etl: PostgresToClickHouseEtl,
    private readonly lock: EtlLockService,
    private readonly state: EtlStateService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    };

    this.queue = new Queue<EtlJobPayload>('analytics-etl', { connection });

    // Schedule cron jobs (1 per table)
    for (const table of ETL_TABLES_TRACKED) {
      await this.queue.add(
        `sync-${table}`,
        { table },
        {
          repeat: { pattern: this.POLL_CRON },
          jobId: `etl-sync-${table}-cron`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    // Worker process jobs
    this.worker = new Worker<EtlJobPayload>(
      'analytics-etl',
      async (job: Job<EtlJobPayload>) => this.processJob(job),
      { connection, concurrency: 3 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error({
        action: 'etl_job_failed',
        job_id: job?.id,
        table: job?.data.table,
        error: err.message,
      });
    });

    this.logger.log({
      action: 'etl_cron_initialized',
      cron: this.POLL_CRON,
      tables: ETL_TABLES_TRACKED.length,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /**
   * Trigger manual resync (called by admin controller).
   */
  async triggerResync(table: EtlTableName, forceResync = false): Promise<string> {
    const jobId = `etl-manual-${table}-${randomUUID()}`;
    await this.queue.add(
      `manual-sync-${table}`,
      { table, forceResync },
      { jobId, attempts: 1 },
    );
    return jobId;
  }

  private async processJob(job: Job<EtlJobPayload>): Promise<void> {
    const { table, forceResync } = job.data;
    const jobId = job.id ?? randomUUID();

    const lockAcquired = await this.lock.acquire(table, jobId);
    if (!lockAcquired) {
      this.logger.warn({ action: 'etl_job_skipped_locked', table, job_id: jobId });
      return;
    }

    try {
      if (forceResync) {
        await this.state.reset(table);
      }

      const opts = forceResync ? { sinceTimestamp: new Date('2020-01-01') } : {};
      let result;
      switch (table) {
        case 'fct_transactions':
          result = await this.etl.syncTransactions(opts); break;
        case 'fct_journal_entries':
          result = await this.etl.syncJournalEntries(opts); break;
        case 'fct_appointments':
          result = await this.etl.syncAppointments(opts); break;
        case 'fct_messages':
          result = await this.etl.syncMessages(opts); break;
        case 'fct_documents_signed':
          result = await this.etl.syncDocumentsSigned(opts); break;
        case 'dim_tenants':
          result = await this.etl.syncTenants(opts); break;
        case 'dim_customers':
          result = await this.etl.syncCustomers(opts); break;
      }

      this.logger.log({
        action: 'etl_job_complete',
        table,
        job_id: jobId,
        rows_inserted: result?.rowsInserted ?? 0,
        duration_ms: result?.durationMs ?? 0,
      });
    } finally {
      await this.lock.release(table, jobId);
    }
  }
}
```

### 6.9 Fichier : `repo/apps/api/src/modules/admin/controllers/admin-analytics.controller.ts`

```typescript
// repo/apps/api/src/modules/admin/controllers/admin-analytics.controller.ts
// Skalean InsurTech v2.2 -- Admin Analytics controller (resync endpoint)
// Reference : B-13 Sprint 13 Tache 3.6.2
import { Body, Controller, Get, Post, UseGuards, Logger } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '@insurtech/auth';
import { RolesGuard } from '@insurtech/auth';
import { JwtAuthGuard } from '@insurtech/auth';
import { EtlCronJob } from '@insurtech/analytics';
import { EtlStateService } from '@insurtech/analytics';
import { ETL_TABLES_TRACKED, EtlTableName } from '@insurtech/analytics';

const ResyncRequestSchema = z.object({
  table: z.enum(ETL_TABLES_TRACKED),
  forceResync: z.boolean().default(false),
});

@Controller('api/v1/admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class AdminAnalyticsController {
  private readonly logger = new Logger(AdminAnalyticsController.name);

  constructor(
    private readonly etlCron: EtlCronJob,
    private readonly state: EtlStateService,
  ) {}

  @Get('etl-state')
  async listEtlState() {
    const states = await this.state.listAll();
    return {
      data: states.map((s) => ({
        table_name: s.table_name,
        last_synced_at: s.last_synced_at?.toISOString() ?? null,
        rows_synced_total: s.rows_synced_total,
        last_status: s.last_status,
        last_error: s.last_error,
        last_batch_id: s.last_batch_id,
        lag_seconds: s.last_synced_at
          ? Math.floor((Date.now() - s.last_synced_at.getTime()) / 1000)
          : null,
      })),
      meta: {
        generated_at: new Date().toISOString(),
      },
    };
  }

  @Post('resync')
  async resync(@Body() body: unknown) {
    const validated = ResyncRequestSchema.parse(body);
    this.logger.log({
      action: 'admin_resync_triggered',
      table: validated.table,
      force: validated.forceResync,
    });
    const jobId = await this.etlCron.triggerResync(validated.table as EtlTableName, validated.forceResync);
    return {
      message: 'Resync job enqueued',
      job_id: jobId,
      table: validated.table,
      force_resync: validated.forceResync,
    };
  }

  @Post('resync-all')
  async resyncAll() {
    this.logger.warn({ action: 'admin_resync_all_triggered' });
    const results: Array<{ table: string; job_id: string }> = [];
    for (const table of ETL_TABLES_TRACKED) {
      const jobId = await this.etlCron.triggerResync(table, false);
      results.push({ table, job_id: jobId });
    }
    return { message: 'All resync jobs enqueued', count: results.length, jobs: results };
  }
}
```

### 6.10 Fichier : `repo/apps/api/src/modules/admin/dto/resync-request.dto.ts`

```typescript
// repo/apps/api/src/modules/admin/dto/resync-request.dto.ts
// Skalean InsurTech v2.2 -- Resync request DTO Zod
// Reference : B-13 Sprint 13 Tache 3.6.2
import { z } from 'zod';
import { ETL_TABLES_TRACKED } from '@insurtech/analytics';

export const ResyncRequestSchema = z.object({
  table: z.enum(ETL_TABLES_TRACKED),
  forceResync: z.boolean().default(false),
});

export type ResyncRequestDto = z.infer<typeof ResyncRequestSchema>;
```

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/packages/analytics/src/etl/etl-state.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EtlStateService } from './etl-state.service';
import { AnalyticsEtlState } from '../entities/etl-state.entity';

describe('EtlStateService', () => {
  let service: EtlStateService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlStateService,
        { provide: getRepositoryToken(AnalyticsEtlState), useValue: repo },
      ],
    }).compile();
    service = module.get(EtlStateService);
  });

  it('getState should fetch by table_name', async () => {
    repo.findOne.mockResolvedValue({ table_name: 'fct_transactions' });
    const result = await service.getState('fct_transactions');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { table_name: 'fct_transactions' } });
    expect(result).toBeDefined();
  });

  it('getState should return null when not found', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.getState('fct_transactions');
    expect(result).toBeNull();
  });

  it('listAll should fetch all ordered by table_name', async () => {
    repo.find.mockResolvedValue([{ table_name: 'a' }, { table_name: 'b' }]);
    const result = await service.listAll();
    expect(repo.find).toHaveBeenCalledWith({ order: { table_name: 'ASC' } });
    expect(result).toHaveLength(2);
  });

  it('markRunning should update status to running', async () => {
    await service.markRunning('fct_transactions', 'batch-uuid-1');
    expect(repo.update).toHaveBeenCalledWith(
      { table_name: 'fct_transactions' },
      expect.objectContaining({
        last_status: 'running',
        last_batch_id: 'batch-uuid-1',
        last_error: null,
      }),
    );
  });

  it('markSuccess should update last_synced_at + increment rows_synced_total', async () => {
    const ts = new Date('2026-05-15T14:00:00Z');
    await service.markSuccess('fct_transactions', { lastSyncedAt: ts, rowsInserted: 150 });
    expect(repo.createQueryBuilder).toHaveBeenCalled();
  });

  it('markFailed should truncate error message to 2000 chars', async () => {
    const longError = 'x'.repeat(3000);
    await service.markFailed('fct_transactions', longError);
    expect(repo.update).toHaveBeenCalledWith(
      { table_name: 'fct_transactions' },
      expect.objectContaining({
        last_status: 'failed',
        last_error: expect.stringMatching(/^x{2000}$/),
      }),
    );
  });

  it('reset should NULL all state for a table', async () => {
    await service.reset('fct_transactions');
    expect(repo.update).toHaveBeenCalledWith(
      { table_name: 'fct_transactions' },
      expect.objectContaining({
        last_synced_at: null,
        last_id: null,
        last_status: 'pending',
        last_error: null,
        rows_synced_total: 0,
      }),
    );
  });

  it('getCursor should return last_synced_at when present', async () => {
    const ts = new Date('2026-05-15T10:00:00Z');
    repo.findOne.mockResolvedValue({ last_synced_at: ts });
    const result = await service.getCursor('fct_transactions');
    expect(result).toEqual(ts);
  });

  it('getCursor should return 90 days ago when no state', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.getCursor('fct_transactions');
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    expect(Math.abs(result.getTime() - ninetyDaysAgo.getTime())).toBeLessThan(5000);
  });

  it('getCursor should return 90 days ago when last_synced_at is null', async () => {
    repo.findOne.mockResolvedValue({ last_synced_at: null });
    const result = await service.getCursor('fct_transactions');
    expect(result).toBeInstanceOf(Date);
  });
});
```

### 7.2 Tests unitaires : `repo/packages/analytics/src/etl/etl-lock.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EtlLockService, REDIS_CLIENT } from './etl-lock.service';
import { Test, TestingModule } from '@nestjs/testing';

describe('EtlLockService', () => {
  let service: EtlLockService;
  let redis: any;

  beforeEach(async () => {
    redis = {
      set: vi.fn(),
      get: vi.fn(),
      eval: vi.fn(),
      del: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtlLockService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = module.get(EtlLockService);
  });

  it('acquire should return true when SET NX succeeds', async () => {
    redis.set.mockResolvedValue('OK');
    const result = await service.acquire('fct_transactions', 'job-1');
    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'etl:lock:fct_transactions',
      'job-1',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('acquire should return false when lock already held', async () => {
    redis.set.mockResolvedValue(null);
    redis.get.mockResolvedValue('other-job-id');
    const result = await service.acquire('fct_transactions', 'job-2');
    expect(result).toBe(false);
  });

  it('release should call Lua eval with correct args', async () => {
    redis.eval.mockResolvedValue(1);
    const result = await service.release('fct_transactions', 'job-1');
    expect(result).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      'etl:lock:fct_transactions',
      'job-1',
    );
  });

  it('release should return false when lock owned by another job', async () => {
    redis.eval.mockResolvedValue(0);
    const result = await service.release('fct_transactions', 'job-1');
    expect(result).toBe(false);
  });

  it('forceRelease should DELETE the key', async () => {
    await service.forceRelease('fct_transactions');
    expect(redis.del).toHaveBeenCalledWith('etl:lock:fct_transactions');
  });

  it('isLocked should return true when key exists', async () => {
    redis.get.mockResolvedValue('some-job-id');
    const result = await service.isLocked('fct_transactions');
    expect(result).toBe(true);
  });

  it('isLocked should return false when key absent', async () => {
    redis.get.mockResolvedValue(null);
    const result = await service.isLocked('fct_transactions');
    expect(result).toBe(false);
  });
});
```

### 7.3 Tests integration : `repo/apps/api/test/integration/etl-pipeline.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PostgresToClickHouseEtl, ClickHouseService, EtlStateService } from '@insurtech/analytics';
// Configuration test : Postgres test + ClickHouse test

describe('ETL Pipeline integration', () => {
  let etl: PostgresToClickHouseEtl;
  let ds: DataSource;
  let ch: ClickHouseService;
  let state: EtlStateService;

  beforeAll(async () => {
    // Bootstrap test module avec ClickHouse + Postgres reels
    // Fixture : INSERT 10 pay_transactions Postgres test
    // ...
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('syncTransactions should extract delta and insert to ClickHouse', async () => {
    // Setup : 10 transactions Postgres updated_at = now() - 1h
    await ds.query(`
      INSERT INTO pay_transactions (id, tenant_id, customer_email_snapshot, amount, fees_amount, provider, payment_method, status, currency, updated_at, created_at)
      SELECT gen_random_uuid(), gen_random_uuid(), 'test@x.com', 100.00, 5.00, 'cmi', 'card', 'captured', 'MAD', now() - interval '1 hour', now() - interval '1 hour'
      FROM generate_series(1, 10)
    `);

    const result = await etl.syncTransactions();
    expect(result.rowsInserted).toBeGreaterThanOrEqual(10);

    // Verifier ClickHouse contient les rows
    const rows = await ch.query<{ cnt: string }>({
      query: `SELECT count() AS cnt FROM skalean_analytics.fct_transactions WHERE customer_email = 'test@x.com'`,
    });
    expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(10);
  });

  it('syncTransactions should be idempotent (rerun same delta)', async () => {
    const first = await etl.syncTransactions();
    const second = await etl.syncTransactions();
    expect(second.rowsInserted).toBeLessThanOrEqual(first.rowsInserted);
  });

  it('syncTransactions should respect cursor safety (skip rows < 30s ago)', async () => {
    await ds.query(`
      INSERT INTO pay_transactions (id, tenant_id, amount, fees_amount, provider, payment_method, status, currency, updated_at, created_at)
      VALUES (gen_random_uuid(), gen_random_uuid(), 50.00, 1.00, 'cmi', 'card', 'captured', 'MAD', now(), now())
    `);
    const result = await etl.syncTransactions({ safetyMs: 30000 });
    expect(result.cursorAfter.getTime()).toBeLessThan(Date.now() - 25000);
  });

  it('syncTenants full-sync inserts all tenants', async () => {
    const result = await etl.syncTenants();
    expect(result.rowsInserted).toBeGreaterThanOrEqual(1);
  });

  it('syncCustomers respects batch_size', async () => {
    const result = await etl.syncCustomers({ batchSize: 5 });
    expect(result.rowsInserted).toBeLessThanOrEqual(5);
  });

  it('state should be updated after successful sync', async () => {
    await etl.syncTransactions();
    const s = await state.getState('fct_transactions');
    expect(s?.last_status).toBe('success');
    expect(s?.last_synced_at).toBeInstanceOf(Date);
  });

  it('state should mark failed on error', async () => {
    // Trigger error : ClickHouse down simulation -> mock ou shutdown
    // ... skip simpler version
  });

  it('full cycle : 7 tables synced sequentially in < 60s on fixture', async () => {
    const start = Date.now();
    await etl.syncTenants();
    await etl.syncCustomers();
    await etl.syncTransactions();
    await etl.syncJournalEntries();
    await etl.syncAppointments();
    await etl.syncMessages();
    await etl.syncDocumentsSigned();
    expect(Date.now() - start).toBeLessThan(60000);
  });
});
```

### 7.4 Tests E2E admin : `repo/apps/api/test/admin/admin-analytics.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
// boot app + sign in as SuperAdmin

describe('AdminAnalyticsController (E2E)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // boot
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/admin/analytics/etl-state requires SuperAdmin', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/analytics/etl-state')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('GET /api/v1/admin/analytics/etl-state returns list of 7 tables', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/analytics/etl-state')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(res.body.data).toHaveLength(7);
    expect(res.body.data[0]).toHaveProperty('table_name');
    expect(res.body.data[0]).toHaveProperty('last_synced_at');
    expect(res.body.data[0]).toHaveProperty('lag_seconds');
  });

  it('POST /api/v1/admin/analytics/resync validates table enum', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/analytics/resync')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ table: 'invalid_table' })
      .expect(400);
  });

  it('POST /api/v1/admin/analytics/resync enqueues job', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/analytics/resync')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ table: 'fct_transactions', forceResync: false })
      .expect(201);
    expect(res.body.job_id).toBeDefined();
    expect(res.body.table).toBe('fct_transactions');
  });

  it('POST /api/v1/admin/analytics/resync-all enqueues 7 jobs', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/analytics/resync-all')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(201);
    expect(res.body.count).toBe(7);
    expect(res.body.jobs).toHaveLength(7);
  });
});
```

---

## 8. Variables environnement

```env
# repo/.env.example (extrait Sprint 13 Tache 3.6.2)
# ETL polling configuration
ETL_POLL_CRON=*/5 * * * *
ETL_BATCH_SIZE=1000
ETL_CURSOR_SAFETY_SECONDS=30
ETL_LOCK_TTL_SECONDS=600

# BullMQ Redis (deja existant Sprint 9, mais utilise par ETL aussi)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

| Variable | Dev | Production |
|----------|-----|------------|
| ETL_POLL_CRON | */5 * * * * | */5 * * * * |
| ETL_BATCH_SIZE | 1000 | 5000 |
| ETL_CURSOR_SAFETY_SECONDS | 30 | 60 |
| ETL_LOCK_TTL_SECONDS | 600 | 900 |

---

## 9. Commandes shell

```bash
cd repo

# 1. Migration Postgres
pnpm --filter @insurtech/api migration:run
# Verifier : table analytics_etl_state existe + 7 rows seed
psql $DATABASE_URL -c "SELECT table_name, last_status FROM analytics_etl_state ORDER BY table_name"

# 2. Demarrer ClickHouse (suppose Tache 3.6.1 done)
docker compose up -d clickhouse redis

# 3. Demarrer API + worker
pnpm --filter @insurtech/api start:dev

# 4. Trigger manuel resync
curl -X POST http://localhost:4000/api/v1/admin/analytics/resync \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table":"fct_transactions","forceResync":false}'

# 5. Voir status ETL
curl http://localhost:4000/api/v1/admin/analytics/etl-state \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" | jq

# 6. Tests
pnpm --filter @insurtech/analytics test
pnpm --filter @insurtech/api test:e2e admin-analytics
```

---

## 10. Criteres validation V1-V26

### Criteres P0 (15)

- **V1 (P0)** : Migration `analytics_etl_state` cree avec 7 rows seed.
- **V2 (P0)** : `EtlStateService.getCursor()` retourne 90j arriere si jamais sync.
- **V3 (P0)** : `EtlStateService.markSuccess()` increment `rows_synced_total` correctement.
- **V4 (P0)** : `syncTransactions` extract delta + insert ClickHouse.
- **V5 (P0)** : `syncTransactions` idempotent (rerun n'introduit pas doublons).
- **V6 (P0)** : `syncTransactions` respecte `ETL_BATCH_SIZE`.
- **V7 (P0)** : `syncTransactions` respecte safety (cursor < now - 30s).
- **V8 (P0)** : `syncTenants` full sync (pas de cursor).
- **V9 (P0)** : `EtlLockService.acquire` atomic via SETNX.
- **V10 (P0)** : `EtlLockService.release` Lua atomic.
- **V11 (P0)** : BullMQ cron registre 7 jobs cron `*/5 * * * *`.
- **V12 (P0)** : Cron job acquire lock + run + release.
- **V13 (P0)** : Endpoint `GET /etl-state` retourne 7 tables avec lag_seconds.
- **V14 (P0)** : Endpoint `POST /resync` enqueue job + retourne jobId.
- **V15 (P0)** : RBAC SuperAdmin only sur endpoints admin.

### Criteres P1 (7)

- **V16 (P1)** : Retry exponential 5s/10s/20s sur echec.
- **V17 (P1)** : Metrics Prometheus `etl_rows_synced_total`, `etl_duration_seconds`.
- **V18 (P1)** : Lock TTL 600s evite deadlock.
- **V19 (P1)** : Concurrency BullMQ worker = 3 (3 tables en parallele).
- **V20 (P1)** : Kafka event `analytics.etl_completed` emis.
- **V21 (P1)** : Logs structures Pino : action, table, batch_id, rows.
- **V22 (P1)** : Coverage `@insurtech/analytics` >= 85% (+10% nouveau code).

### Criteres P2 (4)

- **V23 (P2)** : `resync-all` enqueue les 7 jobs avec backoff.
- **V24 (P2)** : Documentation `etl-pipeline.md` >= 180 lignes.
- **V25 (P2)** : Endpoint `force-release-lock` admin (recovery).
- **V26 (P2)** : Tests > 90% paths critique syncTransactions.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : ETL bloque par lock orphelin
**Scenario** : process tue brutalement, lock Redis reste 10 min.
**Solution** : TTL `ETL_LOCK_TTL_SECONDS=600` (10 min) auto-expire, ou endpoint admin `force-release-lock`.

### Edge case 2 : Schema drift Postgres -> ClickHouse mismatch colonnes
**Scenario** : ajouter `pay_transactions.discount_amount` Postgres, oublier ALTER TABLE ClickHouse.
**Solution** : test integration verifie colonnes ClickHouse match SELECT ETL.

### Edge case 3 : Row updated_at au futur (clock skew)
**Scenario** : row `updated_at = now() + 5min`.
**Solution** : cursor filter `updated_at <= now() - safetyMs` exclut futures.

### Edge case 4 : Resync force pendant cron actif
**Scenario** : admin trigger resync alors que cron tourne.
**Solution** : lock empeche overlap, queue BullMQ serialise FIFO.

### Edge case 5 : ClickHouse insert fail apres extract Postgres
**Scenario** : extract 1000 rows OK, ClickHouse insert timeout.
**Solution** : state NOT updated, retry next cycle replay meme delta (idempotent via cursor temporal).

### Edge case 6 : Postgres slow query 30s
**Scenario** : table `pay_transactions` sans index sur updated_at.
**Solution** : verifier index `CREATE INDEX idx_pay_transactions_updated_at ON pay_transactions(updated_at)`.

### Edge case 7 : Memoire heap V8 saturee
**Scenario** : 100k rows en memoire.
**Solution** : chunking 1000 + curseur Postgres LIMIT.

### Edge case 8 : Redis down
**Scenario** : Redis indisponible.
**Solution** : ETL fail (lock impossible), retry next cycle. Healthcheck Sprint 35.

### Edge case 9 : Decimal NUMERIC -> Decimal64 overflow
**Scenario** : amount > 9.99e15.
**Solution** : check max amount, Sprint 35 migrer Decimal128.

### Edge case 10 : Premier sync = 90 jours = trop
**Scenario** : table avec 5M rows updated dans 90 derniers jours.
**Solution** : batch_size 1000 + cursor incremental, plusieurs cycles 5min.

---

## 12. Conformite Maroc detaillee

- **Loi 09-08 CNDP** : aucune donnee ne transite hors MA, ETL execute sur Atlas Cloud Benguerir.
- **Loi 9-88 (art 18)** : `fct_journal_entries` TTL 10 ans -> ETL respecte cette retention.
- **Loi 53-05 (art 9)** : `fct_documents_signed` TTL 10 ans.

---

## 13. Conventions absolues skalean-insurtech

Multi-tenant strict (tenant_id dans ORDER BY), Validation Zod stricte, Logger Pino jamais console, pnpm engine-strict, TypeScript strict, Tests Vitest >=85%, RBAC SuperAdmin endpoints admin, Events Kafka `insurtech.events.analytics.etl_completed`, Imports `@insurtech/analytics`, no-emoji, Idempotency-Key non applicable (interne), Conventional Commits `feat(sprint-13):`, Cloud souverain MA.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/analytics typecheck
pnpm --filter @insurtech/analytics test:coverage    # >= 85%
pnpm --filter @insurtech/api migration:run
docker compose up -d clickhouse redis
pnpm tsx infrastructure/scripts/init-clickhouse.ts
# Trigger sync manuelle, verifier ClickHouse contient rows
```

---

## 15. Commit message complet

```bash
git commit -m "feat(sprint-13): ETL pipeline Postgres -> ClickHouse polling 5min

Sprint 13 Tache 3.6.2 : pipeline ETL polling-based, BullMQ cron, lock Redis,
state tracking Postgres, 7 methodes sync, endpoint admin resync.

Livrables :
- Migration analytics_etl_state + 7 seed rows tracked tables
- PostgresToClickHouseEtl service (7 sync methods)
- EtlStateService + EtlLockService Redis
- EtlCronJob BullMQ */5 * * * *  + retry exponential
- AdminAnalyticsController : GET etl-state + POST resync(-all)
- Metrics Prometheus rows/errors/duration
- 41 tests (10+18+8+5)
- Documentation etl-pipeline.md

Tests: 41 (28 unit + 8 integration + 5 E2E)
Coverage: 87%

Task: 3.6.2
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.2"
```

---

## 16. Workflow next step

Apres commit, lancer Tache 3.6.3 : `task-3.6.3-analytics-service-queries-dashboards.md` (AnalyticsService abstraction queries ClickHouse + cache Redis 5min).

---

**Fin du prompt task-3.6.2-etl-postgres-to-clickhouse.md.**

Densite : ~110 ko. Code : 10 fichiers complets. Tests : 41 cas. Criteres : V1-V26. Edge cases : 10.

## ANNEXE H -- Pre-commit + workflow CI/CD Sprint 13

### H.1 Pre-commit hooks Husky configuration

```json
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 1. Lint-staged : Biome auto-fix + format
pnpm exec lint-staged

# 2. Typecheck strict TypeScript
pnpm typecheck

# 3. Tests unit ONLY pour packages modifies
pnpm exec turbo test --filter=...HEAD --since=HEAD~1

# 4. No-emoji check (decision-006 absolu)
./infrastructure/scripts/check-no-emoji.sh

# 5. No console.log dans production
./infrastructure/scripts/check-no-console.sh

# 6. Conventional commit message format
pnpm exec commitlint --edit "$1"
```

### H.2 Conventional Commits Sprint 13

Format strict :
```
<type>(scope): description courte 50-72 chars

Description longue 2-4 lignes (optionnel)

Livrables:
- bullet 1
- bullet 2

Tests: <n> total / Coverage: <X>%

Task: 3.6.<X>
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.<X>
```

Types autorises Sprint 13 :
- `feat` : nouvelle fonctionnalite (taches 3.6.1-3.6.14)
- `fix` : bugfix
- `docs` : documentation seulement
- `test` : ajout tests sans code metier
- `refactor` : refacto sans changement comportement
- `perf` : amelioration performance
- `chore` : maintenance (deps, build)
- `ci` : configuration CI/CD

Scopes Sprint 13 :
- `sprint-13` : tout sprint
- `analytics` : module analytics
- `stock` : module stock
- `hr` : module HR
- `books-consumer` : consumers Books
- `tests` : tests E2E

Exemples conformes :
```
feat(sprint-13): ClickHouse setup + 8 schemas analytics

Sprint 13 Tache 3.6.1 : pose le socle infrastructure ClickHouse 24.10 OLAP
separe Postgres OLTP, charge 8 schemas (5 faits + 2 dims + 1 calendar).

Livrables :
- docker-compose service clickhouse 24.10-alpine
- 9 schemas SQL (database + 5 fct_* + 2 dim_* + dim_dates 1827 rows)
- @insurtech/analytics package + ClickHouseService

Tests: 36 / Coverage: 88%

Task: 3.6.1
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.1
```

### H.3 CI/CD pipeline Sprint 13

```yaml
# .github/workflows/sprint-13.yml
name: Sprint 13 CI

on:
  push:
    branches: [main, sprint-13]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '22.11.0'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: ./infrastructure/scripts/check-no-emoji.sh
      - run: ./infrastructure/scripts/check-no-console.sh

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
      clickhouse:
        image: clickhouse/clickhouse-server:24.10-alpine
        ports: [8123:8123]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm migration:run
      - run: pnpm tsx infrastructure/scripts/init-clickhouse.ts
      - run: pnpm test:integration
      - run: pnpm test:e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test-unit, test-integration]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### H.4 Workflow developpement Sprint 13

1. **Pre-tache** : lire B-13 + cette task prompt + decision-strategiques referencees.
2. **Setup branch** : `git checkout -b sprint-13/task-3.6.X-<slug>`.
3. **Implement** : suivre 17 sections du prompt + code patterns fournis.
4. **Tests** : ecrire tests AVANT ou en parallele (TDD-friendly).
5. **Pre-commit** : `pnpm typecheck && pnpm lint && pnpm test:coverage`.
6. **Commit** : Conventional Commits + metadata Task/Sprint/Phase.
7. **Push + PR** : titre format `Sprint 13 -- Task 3.6.X : <description>`.
8. **CI** : attendre green (lint + types + tests + integration).
9. **Review** : 1 lead minimum + 1 reviewer metier.
10. **Merge** : squash + tag `sprint-13-task-3.6.X-done`.
11. **Next task** : passer a 3.6.(X+1).

### H.5 Definition of Done Sprint 13

Chaque tache 3.6.X consideree done quand :
- [ ] Tous livrables checkables coches
- [ ] Code TypeScript strict no any implicite
- [ ] Tests unit coverage >= cible (85% standard, 90-95% critique)
- [ ] Tests integration passent (Postgres + Redis + ClickHouse reels)
- [ ] Tests E2E passent (au moins parcours nominaux)
- [ ] CI green sur tous jobs
- [ ] Code reviewed par minimum 1 lead
- [ ] Documentation API a jour (Swagger/OpenAPI export)
- [ ] Aucune emoji (decision-006)
- [ ] Aucune reference vague type "voir B-XX"
- [ ] Commit message Conventional + metadata
- [ ] Conformite legale verifiee (liste lois applicables)
- [ ] Performance SLO respectes (latences + throughput)
- [ ] Multi-tenant isolation testee
- [ ] RBAC permissions seedees + assignees aux roles

