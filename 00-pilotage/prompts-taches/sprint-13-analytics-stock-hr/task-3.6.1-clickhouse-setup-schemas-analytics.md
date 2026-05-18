# TACHE 3.6.1 -- ClickHouse Setup Docker-Compose + Schemas Analytics

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase -- DERNIER de la Phase 3)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.1)
**Phase** : 3 -- Modules Horizontaux (Analytics + Stock + HR)
**Priorite** : P0 (bloquant ETL + dashboards + tout Analytics aval)
**Effort** : 5h
**Dependances** : Sprint 12 termine (Pay events alimentent revenue analytics, Books journal_entries -> P&L analytics), Sprint 11 (Pay multi-MA), Sprint 6 multi-tenant, Sprint 2 database initiale
**Densite cible** : 110-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache pose les fondations du module Analytics de Skalean InsurTech v2.2 : un cluster **ClickHouse 24.10** OLAP separe de Postgres OLTP, charge avec 8 schemas analytiques (5 tables de faits + 2 tables de dimensions + 1 calendrier dates pre-rempli sur 5 ans). Postgres reste optimise pour les transactions (writes + reads simples sub-100ms), tandis que ClickHouse absorbe toutes les requetes d'agregation pesantes (sum/count/group-by sur 1M+ rows) en moins de 200ms grace au stockage columnar et a la compression dictionnaire. Sans cette separation, les dashboards revenue/conversion/sinistre tueraient les performances API en cours de production : un full scan de `pay_transactions` sur 6 mois bloquerait les acquisitions de paiement temps reel pendant 3-8 secondes.

L'apport est triple. **Premierement**, on ajoute un service Docker `clickhouse` au `docker-compose.yml` racine, base sur l'image officielle `clickhouse/clickhouse-server:24.10-alpine`, expose en HTTP (port 8123) et native (port 9000), avec volume persistant `clickhouse_data` et configuration adaptee aux ressources locales developpeur (memory_overcommit_ratio_denominator_for_user 1, max_memory_usage 8GB). Variables d'environnement nouvelles : `CLICKHOUSE_URL=http://localhost:8123`, `CLICKHOUSE_USERNAME=default`, `CLICKHOUSE_PASSWORD=` (vide en dev, robuste en prod), `CLICKHOUSE_DATABASE=skalean_analytics`. **Deuxiemement**, on cree 8 fichiers SQL dans `repo/infrastructure/clickhouse/schemas/` definissant les tables avec engine MergeTree, partitionnement mensuel par `toYYYYMM(event_date)`, ordre primaire `(tenant_id, event_datetime, transaction_id)` pour partition pruning multi-tenant efficient, TTL 5 ans par defaut (configurable per type), skip indexes sur `tenant_id` et `customer_id`. **Troisiemement**, on livre un module NestJS `@insurtech/analytics` exportant `ClickHouseService` (singleton injectable, healthcheck, ping, query, insert batch), `ClickHouseModule.forRoot()` (lecture config), et un script `init-clickhouse.ts` charge de creer la database + executer les 8 schemas SQL + seeder `dim_dates` (1827 lignes = 5 ans).

A l'issue de cette tache, lancer `docker compose up clickhouse` puis `pnpm tsx infrastructure/scripts/init-clickhouse.ts` cree un cluster ClickHouse local accessible avec les 8 tables analytics + la dimension dates pre-remplie, le ClickHouseService NestJS retourne `ping() === 'Ok.'`, et les controllers/services aval (Tache 3.6.2 ETL, 3.6.3 AnalyticsService, 3.6.4 Dashboards) disposent d'une cible fonctionnelle. Cette tache prepare la Phase 4 Vertical Insure (Sprint 14+) qui ajoutera `fct_polices`, `fct_sinistres`, et la Phase 5 Vertical Repair (Sprint 20+) qui ajoutera `fct_reparations`. Le pattern de schema (MergeTree + partition mensuelle + TTL 5 ans + index multi-tenant) est strictement reutilisable.

---

## 2. Contexte etendu

### 2.1 Pourquoi separer OLTP (Postgres) et OLAP (ClickHouse)

Postgres 16 sur Atlas Cloud Benguerir DC1 Tier III est imbattable pour les workloads transactionnels Skalean InsurTech v2.2 : un `INSERT INTO pay_transactions` ou un `SELECT * FROM contacts WHERE id = X` finit en moins de 5 millisecondes, les triggers RLS multi-tenant tournent en 200 microsecondes, les contraintes FK garantissent l'integrite. C'est l'usage pour lequel Postgres est concu : OLTP (OnLine Transaction Processing), row-oriented, B-tree, ACID strict.

Mais des qu'on demande a Postgres une requete analytique du genre "donne-moi le revenu mensuel par provider sur les 24 derniers mois, par tenant, group by mois", Postgres doit faire un full scan ou un index range scan sur potentiellement plusieurs millions de lignes, agreger en memoire, puis renvoyer. Sur 5 millions de `pay_transactions`, cela prend entre 3 et 12 secondes selon les indexes, et pire : cela monopolise CPU + memoire I/O du Postgres, ralentissant simultanement toutes les autres operations transactionnelles (paiement en cours, signature en cours, etc.). Une seule dashboard refresh peut faire monter la latence p99 API de 80ms a 1200ms.

ClickHouse est concu pour OLAP : stockage columnar (chaque colonne stockee separement, compressee par dictionnaire LowCardinality), agregations vectorielles (SIMD), partition pruning naturel (le moteur lit uniquement les partitions concernees par le filtre date), execution parallele. Sur la meme requete revenue mensuel par provider 24 mois 5M rows, ClickHouse renvoie en 80-150 millisecondes sans degrader le moindre autre service. Comparaison concrete mesuree sur fixture 5M `pay_transactions` :

| Engine | Query revenue mensuel 24 mois | CPU pendant | Memoire pic | Impact OLTP |
|--------|-------------------------------|-------------|-------------|-------------|
| Postgres 16 (avec indexes) | 4.8 secondes | 85% (1 core) | 1.2 GB | latence p99 +800ms |
| ClickHouse 24.10 MergeTree | 110 millisecondes | 30% (4 cores) | 180 MB | nul (cluster separe) |

ClickHouse est 43x plus rapide ET ne contamine pas Postgres. Le cout : maintenir un second moteur, et un pipeline ETL pour copier les donnees (Tache 3.6.2). C'est un cout largement amorti des 10 dashboards consommateurs concurrents.

### 2.2 Pourquoi ClickHouse plutot que Druid, Pinot, BigQuery, Snowflake

Le marche OLAP propose plusieurs candidats. Pour Skalean InsurTech v2.2, ClickHouse a ete retenu pour les raisons suivantes.

| Option | Avantages | Inconvenients | Decision |
|--------|-----------|---------------|----------|
| **ClickHouse 24.10** (retenu) | Open-source, mature, perf top-tier, SQL standard, single binary, deployable Atlas Cloud Benguerir | Pas de transactions multi-table (acceptable OLAP), maturite ecosysteme Node moindre que Postgres | **RETENU** |
| Apache Druid | Excellent real-time ingestion | Complexite operationnelle (5+ services : historical, broker, coordinator, indexer, middlemanager), pas adapte petite/moyenne echelle | Rejete |
| Apache Pinot | Excellent multi-tenant analytics | Stack Java lourde, courbe apprentissage forte | Rejete |
| BigQuery (Google) | Serverless, scaling infini | **VIOLATION decision-008** (data hors Maroc -- USA/EU), couts variables imprevisibles, vendor lock-in | Rejete (illegal CNDP) |
| Snowflake | Excellent OLAP managed | **VIOLATION decision-008**, US-hosted only, couts eleves | Rejete (illegal CNDP) |
| TimescaleDB | Postgres-native, simple | Performances moindres OLAP pur, pas conçu columnar agressif | Rejete (pas gain suffisant) |
| Materialized views Postgres | Zero infra additionnelle | Refresh manuel, blocage table source, pas de partition pruning | Rejete (insuffisant a 1M+ rows) |

**Verdict** : ClickHouse 24.10 colle parfaitement aux contraintes Skalean InsurTech : (a) deployable sur Atlas Cloud Benguerir DC1/DC2 (decision-008 conformite loi 09-08 CNDP), (b) open-source pas de vendor lock-in (c) single binary operationnellement simple (un seul service docker), (d) performances OLAP de classe mondiale, (e) SQL standard expressif, (f) drivers Node officiels matures (`@clickhouse/client@1.10.1`).

### 2.3 Alternatives considerees pour le partitionnement et l'ordre

Le choix du `PARTITION BY` et de l'`ORDER BY` ClickHouse est critique car il determine le partition pruning et la compression. Plusieurs strategies ont ete testees sur fixtures.

| Strategie | PARTITION BY | ORDER BY | Pros | Cons | Decision |
|-----------|--------------|----------|------|------|----------|
| **A. Retenu** | `toYYYYMM(event_date)` | `(tenant_id, event_datetime, transaction_id)` | Tenant-aware pruning, range scan rapide, partition mensuelle compacte | Rebalancing si tenant tres asymetrique | RETENU |
| B. Tenant first partition | `(toYYYYMM(event_date), tenant_id)` | `(event_datetime, transaction_id)` | Partition par tenant = isolation forte | Trop de partitions (1000 tenants x 60 mois = 60k partitions), perf merge en chute | Rejete |
| C. Pas de tenant dans ORDER BY | `toYYYYMM(event_date)` | `(event_datetime)` | Compression maximale | Pas de pruning multi-tenant, queries lentes | Rejete |
| D. Granularity hebdomadaire | `toMonday(event_date)` | `(tenant_id, event_datetime)` | Partitions plus petites | Trop nombreuses (260 partitions / 5 ans), overhead metadata | Rejete |
| E. Granularity quotidienne | `event_date` | `(tenant_id, event_datetime)` | Partitions tres petites | 1825 partitions / 5 ans, performance merges catastrophique | Rejete |

**Verdict** : Strategie A. `PARTITION BY toYYYYMM(event_date)` cree 60 partitions sur 5 ans, manageable. `ORDER BY (tenant_id, ...)` permet le partition pruning multi-tenant : une query avec `WHERE tenant_id = 'xxx' AND event_date >= '2026-01'` lit uniquement les bytes mensuels du tenant xxx pour ce mois. Index granularity 8192 (default) donne un bon compromis entre overhead memoire et selectivite.

### 2.4 Trade-offs explicites

**Trade-off 1 : Append-only naturel ClickHouse vs UPDATE classique**. ClickHouse n'est pas concu pour UPDATE/DELETE row-level efficient (ALTER TABLE ... UPDATE est asynchrone et tres lent). On accepte le pattern "append-only" : chaque event en base se traduit par un INSERT dans la table de faits. Les corrections (par exemple un paiement remboursed) sont des nouvelles lignes avec `status='refunded'` plutot que UPDATE des lignes existantes. Cela peut introduire des doublons logiques. Mitigation : engine **ReplacingMergeTree** (Tache 3.6.2 ETL) qui dedupe au merge sur primary key, et `FINAL` modifier dans queries OLAP critiques.

**Trade-off 2 : Eventual consistency avec Postgres**. Le pipeline ETL polling 5min (Tache 3.6.2) introduit un decalage de fraicheur entre Postgres et ClickHouse. Une dashboard refreshee a 14h00 peut montrer des donnees vraies jusqu'a 13h55. C'est tolere pour les analyses business (pas critique sub-minute) mais inadapte pour les use-cases anti-fraud temps reel (Sprint 11 PSP webhook callbacks). Mitigation : Pay anti-fraud reste Postgres-only, ClickHouse est analytics descriptive uniquement.

**Trade-off 3 : Volume disque 2x**. ClickHouse stocke une copie compressed des donnees Postgres relevantes pour analytics. Sur 5 ans avec 10M transactions/mois (estimation projection 2030), cela donne approximativement 600 GB Postgres + 80 GB ClickHouse (compression 7.5x typique columnar). Le surcout disque est largement compense par les gains de performance et la possibilite de queries OLAP impossibles autrement. Sur Atlas Cloud Benguerir, le cout disque NVMe SSD est de l'ordre de 0.15 USD/GB/mois.

**Trade-off 4 : Maintenance et expertise**. ClickHouse demande une expertise specifique (DDL different, types specifiques `LowCardinality`, `Decimal64`, fonctions natives `toMonday`, `uniqExact`). Mitigation : la documentation de ces patterns est concentre dans le package `@insurtech/analytics` + les schemas SQL versionnes en git + un cookbook `docs/analytics/clickhouse-cookbook.md` (Tache 3.6.14 Phase 3 closure).

### 2.5 Decisions strategiques referenced

- **decision-001 (monorepo)** : `@insurtech/analytics` est un package du monorepo pnpm, importe par `apps/api` et `apps/mcp-server` (Sprint 31 Agent Sky lit metrics analytics).
- **decision-002 (multi-tenant 3 niveaux)** : `tenant_id` est dans l'ORDER BY de chaque table de faits ClickHouse pour permettre le partition pruning et l'isolation logique.
- **decision-003 (TypeORM vs Prisma)** : Postgres reste TypeORM 0.3 ; ClickHouse n'utilise PAS TypeORM (incompatible), mais le driver natif `@clickhouse/client@1.10.1` via service NestJS abstractif.
- **decision-005 (Skalean AI frontiere)** : ClickHouse est accessible par Agent Sky uniquement via `@insurtech/analytics` (REST tools), jamais en direct.
- **decision-006 (no-emoji)** : aucune emoji dans schemas SQL, services, logs, scripts init.
- **decision-008 (data residency Maroc)** : ClickHouse cluster prod deploye Atlas Cloud Benguerir DC1 + replication DC2 Tier IV, configuration encryption at rest AES-256-GCM via Atlas KMS, TLS 1.3 pour le port 8123 prod.

### 2.6 Pieges techniques connus

1. **Piege : ClickHouse refuse DELETE/UPDATE row-level synchrone**. Une operation `ALTER TABLE fct_transactions DELETE WHERE transaction_id='xxx'` est asynchrone, peut prendre des minutes, et bloque les autres ALTER. **Solution** : ne JAMAIS faire DELETE/UPDATE row-level ; utiliser pattern append-only + ReplacingMergeTree (Tache 3.6.2), ou recreer la table en cas de purge massive (TRUNCATE supporte).

2. **Piege : timezone mismatch Postgres/ClickHouse**. Postgres stocke par defaut `TIMESTAMPTZ` en UTC mais TypeORM peut convertir en `Africa/Casablanca` selon config. ClickHouse `DateTime` est sans timezone par defaut. **Solution** : standardiser tout en UTC cote storage + conversion locale uniquement a la presentation. Forcer `SET timezone = 'UTC'` dans session Postgres ETL, et `DateTime` ClickHouse interprete comme UTC.

3. **Piege : Decimal64(2) overflow sur amounts grands**. `Decimal64(2)` a 18 chiffres significatifs, mais l'echelle 2 reduit a 16 chiffres entiers utiles. Si on fait `sum(amount)` sur 100M transactions x 100k MAD chacune = 10e13 MAD = depasse. **Solution** : utiliser `Decimal128(2)` (38 chiffres significatifs) pour les colonnes `amount` aggregeables, ou caster en `Float64` au moment de l'aggregation si precision moins critique.

4. **Piege : LowCardinality sur colonne haute cardinalite**. `LowCardinality(String)` est une optimisation dictionnaire ; tres efficace pour colonnes a moins de ~10k valeurs distinctes (provider, status, currency, payment_method) mais nuisible pour `customer_email` (millions de valeurs). **Solution** : utiliser `LowCardinality` UNIQUEMENT sur colonnes a dictionnaire restreint, jamais sur IDs ou emails.

5. **Piege : index granularity 8192 trop grossier pour selective queries**. Le default est bon pour scans aggregatifs, mais une query `SELECT * WHERE transaction_id = 'xxx'` lira toujours 8192 rows minimum. **Solution** : pour queries point-lookup, prevoir un skip-index `data_skipping_indexes`. Sprint 13 = pas de point-lookup OLAP ; on garde 8192.

6. **Piege : `uniqExact` vs `uniq` confusion**. `uniqExact(col)` est un COUNT DISTINCT exact, lent et memoire-intensif sur grandes cardinalites. `uniq(col)` utilise HyperLogLog, 100x plus rapide, precision ~1%. **Solution** : utiliser `uniq` pour dashboards "approximations OK" (top customers, unique visitors), `uniqExact` UNIQUEMENT pour comptages exacts metier (transactions uniques par tenant).

7. **Piege : `JSONEachRow` vs `JSON` format pour driver Node**. Le driver `@clickhouse/client` parse `JSONEachRow` ligne par ligne (stream-friendly), tandis que `JSON` retourne un objet wrapper avec metadata. **Solution** : preferer `JSONEachRow` pour les queries analytics (stream resultat, memoire bornee). Reserver `JSON` aux queries metadata.

8. **Piege : TTL declenche pendant query analytics**. Si une partition expire pendant l'execution d'une query, ClickHouse peut renvoyer des resultats incomplets. **Solution** : TTL 5 ans confortable, et planifier `OPTIMIZE TABLE ... FINAL` durant les fenetres low-traffic (3am Casablanca).

9. **Piege : skema migration sans `ON CLUSTER`**. En production multi-shard, omettre `ON CLUSTER skalean_cluster` dans les DDL crée une divergence entre shards. **Solution** : Sprint 13 dev = single-node, donc pas de `ON CLUSTER`. Production Sprint 35 = cluster 3 shards x 2 replicas + ZooKeeper Keeper, on rajoutera `ON CLUSTER skalean_cluster` dans les schemas SQL.

10. **Piege : `clickhouse-server` permissions sur volumes Docker**. Le user `clickhouse` (UID 101) doit avoir lecture/ecriture sur `/var/lib/clickhouse`. Sur Linux dev, le volume bind-mounted peut etre owned root et echouer au demarrage. **Solution** : utiliser volume Docker named (`clickhouse_data:/var/lib/clickhouse`) plutot que bind mount local, ou `chown -R 101:101` apres `docker volume create`.

11. **Piege : `dim_dates` seed trop lourd au runtime app**. Si on seed 1827 lignes (5 ans) au boot de l'API, on ralentit le startup de 200-400ms inutilement. **Solution** : seed une fois via script `init-clickhouse.ts` lance explicitement (CI fixtures + dev manual), avec idempotency `INSERT INTO dim_dates SELECT ... WHERE NOT EXISTS (SELECT 1 FROM dim_dates WHERE date = candidate)`.

12. **Piege : connection pool exhaustion driver ClickHouse**. Le driver `@clickhouse/client` n'a pas de pool integre comme `pg`. Si on instancie un client par requete (anti-pattern), on epuise les TCP connections. **Solution** : `ClickHouseService` singleton + un seul client partage + max_open_connections 10 par instance API.

13. **Piege : `Nullable(UUID)` syntaxe ClickHouse**. ClickHouse ne supporte pas tous les types en Nullable. `Nullable(LowCardinality(String))` est interdit (combinaison non-supportee). **Solution** : preferer placeholders chaine vide '' au lieu de NULL pour colonnes LowCardinality, ou utiliser `String` sans LowCardinality pour les nullable.

14. **Piege : DateTime precision differente**. ClickHouse `DateTime` est precision seconde (32-bit), `DateTime64(3)` precision milliseconde, `DateTime64(6)` microseconde. Postgres TIMESTAMP est microseconde par defaut. **Solution** : si event timestamps precision milliseconde necessaire (audit), utiliser `DateTime64(3)`. Sinon `DateTime` suffit (transactions financieres a la seconde).

15. **Piege : healthcheck `/ping` retourne `Ok.\n` (avec point et newline)**. Le strict equality `=== 'Ok.'` echoue. **Solution** : `response.text().then(s => s.trim() === 'Ok.')` pour normaliser.

---

## 3. Architecture context

### 3.1 Position dans le sprint 13

Cette tache 3.6.1 est la **premiere** des 14 du sprint 13 et conditionne toutes les suivantes.

**Depend de** :
- Sprint 12 termine : Pay events et Books journal_entries existent, sont consommables.
- Sprint 6 multi-tenant : TenantContext AsyncLocalStorage propage tenant_id.
- Sprint 2 base : `docker-compose.yml` est en place avec Postgres + Redis + Kafka.

**Bloque** (depend de cette tache) :
- Tache 3.6.2 ETL Postgres -> ClickHouse (necessite tables crees + ClickHouseService).
- Tache 3.6.3 AnalyticsService (queries vers ClickHouse).
- Tache 3.6.4 6 dashboards endpoints (consomment AnalyticsService).
- Tache 3.6.14 Tests E2E (incluent ClickHouse connectivity).
- Sprint 14+ Insure : `fct_polices`, `fct_sinistres` ajoutees aux schemas.
- Sprint 20+ Repair : `fct_reparations`, `fct_garage_metrics`.

**Apport au sprint** : socle infrastructure ClickHouse + 8 schemas analytics + service NestJS + script init. Sans cette tache, aucun dashboard ne peut exister.

### 3.2 Position dans le programme global

Sprint 13 termine la **Phase 3 -- Modules Horizontaux** (6 sprints : CRM+Booking / Comm WA+Email / Docs+Signature / Pay multi-MA / Books+Compliance / Analytics+Stock+HR). C'est la fondation transverse de tout Skalean InsurTech v2.2 avant l'attaque des verticaux metier.

A l'issue de Sprint 13, le socle analytique est pose et reutilise par :
- **Sprint 14-19 (Phase 4 Vertical Insure)** : ajout `fct_polices`, `fct_sinistres`, `fct_commissions`, et 8 dashboards Insure-specific (ratio sinistre/prime par branche, top assureurs, retention courtier).
- **Sprint 20-23 (Phase 5 Vertical Repair)** : `fct_reparations`, `fct_garage_revenue`, dashboards Repair (delai moyen reparation, taux first-time-fix, top pieces consommees).
- **Sprint 24-28 (Phase 6 SaaS Front)** : dashboards UI broker (Sprint 17 web-broker) et garage (Sprint 23 web-garage) consomment les endpoints REST.
- **Sprint 31 (Agent Sky)** : Sky utilise tools MCP `get_revenue_trend`, `get_top_clients` qui interrogent ClickHouse.
- **Sprint 35 (Production hardening)** : cluster ClickHouse passe single-node a 3 shards x 2 replicas + ZooKeeper Keeper.

### 3.3 Diagramme architecture analytics

```
                          +---------------------------+
                          |   PostgreSQL 16 OLTP      |
                          |   Atlas Cloud Benguerir   |
                          |   DC1 Tier III (primary)  |
                          |   DC2 Tier IV (replica)   |
                          +------------+--------------+
                                       | CDC (Sprint 13: polling)
                                       | (Sprint 35+: Debezium)
                                       v
                          +------------+--------------+
                          |   ETL Pipeline            |
                          |   @insurtech/analytics    |
                          |   etl/postgres-to-ch.etl  |
                          |   BullMQ cron 5min        |
                          +------------+--------------+
                                       | INSERT batch 1000 rows
                                       v
+------------------------+   +---------+----------------+   +-------------------------+
| docker: clickhouse:    |   |  ClickHouse 24.10        |   | dim_dates seed (5 ans)  |
| 24.10-alpine           +-->|  fct_transactions        |<--+ 1827 lignes pre-remplies|
| HTTP 8123 / native 9000|   |  fct_journal_entries     |   +-------------------------+
| volume clickhouse_data |   |  fct_appointments        |
+------------------------+   |  fct_messages            |
                             |  fct_documents_signed    |
                             |  dim_tenants             |
                             |  dim_customers           |
                             +---------+----------------+
                                       | SELECT (queries OLAP)
                                       v
                          +------------+--------------+
                          |   AnalyticsService        |
                          |   @insurtech/analytics    |
                          |   services/analytics.svc  |
                          |   + cache Redis 5min      |
                          +------------+--------------+
                                       | injected by DI NestJS
                                       v
                          +------------+--------------+
                          |   DashboardsController    |
                          |   /api/v1/analytics/      |
                          |     dashboards/revenue    |
                          |     dashboards/conversion |
                          |     ... (6 total)          |
                          +------------+--------------+
                                       | JSON response
                                       v
                          +------------+--------------+
                          |  Sprint 17 web-broker UI  |
                          |  Sprint 23 web-garage UI  |
                          |  Sprint 31 Agent Sky      |
                          +---------------------------+
```

---

## 4. Livrables checkables

- [ ] `repo/docker-compose.yml` mis a jour avec service `clickhouse` (image 24.10-alpine, ports 8123/9000, volume named, healthcheck, env vars, ulimits)
- [ ] `repo/.env.example` ajoute 4 variables `CLICKHOUSE_URL`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`
- [ ] `repo/infrastructure/clickhouse/config/clickhouse-server.xml` (config overrides : max_memory_usage, log_queries, format_schema_path)
- [ ] `repo/infrastructure/clickhouse/config/users.xml` (user `default` no password en dev, password obligatoire prod via env var)
- [ ] `repo/infrastructure/clickhouse/schemas/00-database.sql` (CREATE DATABASE IF NOT EXISTS skalean_analytics)
- [ ] `repo/infrastructure/clickhouse/schemas/01-fct_transactions.sql` (~60 lignes, MergeTree, partition mensuelle, TTL 5 ans)
- [ ] `repo/infrastructure/clickhouse/schemas/02-fct_journal_entries.sql` (~55 lignes)
- [ ] `repo/infrastructure/clickhouse/schemas/03-fct_appointments.sql` (~50 lignes)
- [ ] `repo/infrastructure/clickhouse/schemas/04-fct_messages.sql` (~55 lignes)
- [ ] `repo/infrastructure/clickhouse/schemas/05-fct_documents_signed.sql` (~50 lignes)
- [ ] `repo/infrastructure/clickhouse/schemas/06-dim_tenants.sql` (~35 lignes, ReplacingMergeTree)
- [ ] `repo/infrastructure/clickhouse/schemas/07-dim_customers.sql` (~40 lignes, ReplacingMergeTree)
- [ ] `repo/infrastructure/clickhouse/schemas/08-dim_dates.sql` (~30 lignes, MergeTree)
- [ ] `repo/packages/analytics/package.json` (nouveau package, dep `@clickhouse/client@1.10.1`, `decimal.js@10.4.3`, `date-fns@4.1.0`, `@nestjs/common`, `@insurtech/shared-config`, `@insurtech/shared-utils`)
- [ ] `repo/packages/analytics/tsconfig.json` (extend tsconfig.base, paths)
- [ ] `repo/packages/analytics/src/index.ts` (exports publics)
- [ ] `repo/packages/analytics/src/clickhouse.module.ts` (~80 lignes, NestJS module avec forRoot config)
- [ ] `repo/packages/analytics/src/config/clickhouse.config.ts` (~50 lignes, Zod schema lecture env)
- [ ] `repo/packages/analytics/src/services/clickhouse.service.ts` (~250 lignes, singleton, ping, query, insert batch, transactions OLAP-style)
- [ ] `repo/packages/analytics/src/services/clickhouse.service.spec.ts` (~280 lignes, 20+ tests vitest)
- [ ] `repo/packages/analytics/src/types/clickhouse-types.ts` (~80 lignes, interfaces internes)
- [ ] `repo/packages/analytics/src/utils/clickhouse-errors.ts` (~60 lignes, custom errors)
- [ ] `repo/infrastructure/scripts/init-clickhouse.ts` (~200 lignes, executable via tsx, idempotent, seed dim_dates 1827 lignes)
- [ ] `repo/infrastructure/scripts/__tests__/init-clickhouse.spec.ts` (~150 lignes, tests scenarios)
- [ ] `repo/apps/api/src/modules/health/clickhouse.health-indicator.ts` (~80 lignes, indicator Terminus)
- [ ] `repo/apps/api/src/modules/health/health.module.ts` mis a jour (registrer ClickHouseHealthIndicator)
- [ ] Mise a jour `repo/turbo.json` : task `analytics:test` cache `packages/analytics/src/**`
- [ ] Mise a jour `repo/.gitignore` : `infrastructure/clickhouse/data/` (volumes locaux dev)
- [ ] Documentation `repo/packages/analytics/README.md` (~150 lignes, usage, configuration, troubleshooting)
- [ ] Documentation `repo/docs/analytics/clickhouse-cookbook.md` (~200 lignes, queries patterns, anti-patterns)

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/docker-compose.yml                                                       (modif : +50 lignes service clickhouse + volumes + networks)
repo/.env.example                                                              (modif : +6 lignes CLICKHOUSE_*)
repo/infrastructure/clickhouse/config/clickhouse-server.xml                    (nouveau, ~80 lignes config XML overrides)
repo/infrastructure/clickhouse/config/users.xml                                (nouveau, ~50 lignes users + profiles)
repo/infrastructure/clickhouse/schemas/00-database.sql                         (nouveau, ~10 lignes CREATE DATABASE)
repo/infrastructure/clickhouse/schemas/01-fct_transactions.sql                 (nouveau, ~65 lignes)
repo/infrastructure/clickhouse/schemas/02-fct_journal_entries.sql              (nouveau, ~55 lignes)
repo/infrastructure/clickhouse/schemas/03-fct_appointments.sql                 (nouveau, ~50 lignes)
repo/infrastructure/clickhouse/schemas/04-fct_messages.sql                     (nouveau, ~55 lignes)
repo/infrastructure/clickhouse/schemas/05-fct_documents_signed.sql             (nouveau, ~50 lignes)
repo/infrastructure/clickhouse/schemas/06-dim_tenants.sql                      (nouveau, ~35 lignes)
repo/infrastructure/clickhouse/schemas/07-dim_customers.sql                    (nouveau, ~40 lignes)
repo/infrastructure/clickhouse/schemas/08-dim_dates.sql                        (nouveau, ~30 lignes)
repo/packages/analytics/package.json                                           (nouveau, ~50 lignes, deps strictes save-exact)
repo/packages/analytics/tsconfig.json                                          (nouveau, extend base)
repo/packages/analytics/tsconfig.build.json                                    (nouveau, exclude tests)
repo/packages/analytics/src/index.ts                                           (nouveau, ~20 lignes exports)
repo/packages/analytics/src/clickhouse.module.ts                               (nouveau, ~80 lignes Module forRoot)
repo/packages/analytics/src/config/clickhouse.config.ts                        (nouveau, ~60 lignes Zod schema)
repo/packages/analytics/src/services/clickhouse.service.ts                     (nouveau, ~260 lignes)
repo/packages/analytics/src/services/clickhouse.service.spec.ts                (nouveau, ~300 lignes Vitest, 22 tests)
repo/packages/analytics/src/types/clickhouse-types.ts                          (nouveau, ~90 lignes interfaces)
repo/packages/analytics/src/utils/clickhouse-errors.ts                         (nouveau, ~70 lignes custom errors)
repo/packages/analytics/README.md                                              (nouveau, ~160 lignes documentation)
repo/infrastructure/scripts/init-clickhouse.ts                                 (nouveau, ~220 lignes, idempotent)
repo/infrastructure/scripts/__tests__/init-clickhouse.spec.ts                  (nouveau, ~170 lignes, 10 tests)
repo/apps/api/src/modules/health/clickhouse.health-indicator.ts                (nouveau, ~90 lignes Terminus)
repo/apps/api/src/modules/health/health.module.ts                              (modif : import ClickHouseHealthIndicator)
repo/turbo.json                                                                (modif : task analytics:test pipeline)
repo/.gitignore                                                                (modif : +1 ligne infrastructure/clickhouse/data/)
repo/docs/analytics/clickhouse-cookbook.md                                     (nouveau, ~220 lignes patterns / anti-patterns)
```

**Total** : 28 fichiers crees, 5 fichiers modifies.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier : `repo/docker-compose.yml` (extrait modifie pour service clickhouse)

```yaml
# repo/docker-compose.yml (extrait : section services nouvelle)
# Skalean InsurTech v2.2 -- service ClickHouse OLAP analytics
# Reference : 00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md (Tache 3.6.1)
# Reference : decision-008 (Cloud souverain MA -- production Atlas Cloud Benguerir)
# 
# Profil : single-node dev/staging ; production = 3 shards x 2 replicas + ZooKeeper Keeper (Sprint 35)

services:
  # ... (autres services Postgres, Redis, Kafka deja presents) ...

  clickhouse:
    image: clickhouse/clickhouse-server:24.10-alpine
    container_name: insurtech-clickhouse
    hostname: clickhouse
    restart: unless-stopped
    ports:
      - "8123:8123"                       # HTTP interface (driver Node)
      - "9000:9000"                       # Native TCP (clients clickhouse-client)
      - "9009:9009"                       # Inter-server replication (single-node : inutile mais expose)
    environment:
      CLICKHOUSE_DB: ${CLICKHOUSE_DATABASE:-skalean_analytics}
      CLICKHOUSE_USER: ${CLICKHOUSE_USERNAME:-default}
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD:-}
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
      # Settings runtime
      CLICKHOUSE_SKIP_USER_SETUP: 0
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - clickhouse_logs:/var/log/clickhouse-server
      - ./infrastructure/clickhouse/config/clickhouse-server.xml:/etc/clickhouse-server/config.d/skalean-overrides.xml:ro
      - ./infrastructure/clickhouse/config/users.xml:/etc/clickhouse-server/users.d/skalean-users.xml:ro
      - ./infrastructure/clickhouse/schemas:/docker-entrypoint-initdb.d:ro
    ulimits:
      nofile:
        soft: 262144
        hard: 262144
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8123/ping || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - insurtech-internal
    deploy:
      resources:
        limits:
          memory: 8G                       # dev local cap ; prod = no cap (instance dediee)
          cpus: '4.0'
        reservations:
          memory: 2G
          cpus: '1.0'

volumes:
  clickhouse_data:
    name: insurtech_clickhouse_data
    driver: local
  clickhouse_logs:
    name: insurtech_clickhouse_logs
    driver: local

networks:
  insurtech-internal:
    name: insurtech-internal
    driver: bridge
```

**Notes importantes** :
- L'image `24.10-alpine` est ~250 MB (vs ~500 MB image full Debian).
- `CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1` active le SQL-driven access control (necessaire pour Sprint 35 RBAC ClickHouse fin).
- Volume `clickhouse_data` named (pas bind mount) pour eviter probleme permissions Docker Desktop sur Mac/Windows.
- Volume schemas en `:ro` charge a l'init du container (premier demarrage), idempotent ensuite.
- Ulimits 262144 : ClickHouse ouvre beaucoup de fichiers (partitions + index). Default Docker 1024 = crash.
- Healthcheck `wget /ping` simple ; toolkit `curl` absent de l'image alpine.
- Memory 8G dev cap = compromis poste developpeur 16-32GB RAM ; production = pas de limite (instance VM dediee 64GB+).

### 6.2 Fichier : `repo/.env.example` (extrait ajoute)

```env
# -----------------------------------------------------------------------------
# ClickHouse OLAP (Sprint 13 -- Tache 3.6.1)
# Reference : B-13 Sprint 13 Analytics + Stock + HR
# -----------------------------------------------------------------------------
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=skalean_analytics
CLICKHOUSE_REQUEST_TIMEOUT_MS=30000
CLICKHOUSE_MAX_OPEN_CONNECTIONS=10
# Production : utiliser HTTPS via reverse proxy nginx + TLS 1.3 Atlas Cloud Benguerir
# CLICKHOUSE_URL=https://analytics.skalean.ma:443
# CLICKHOUSE_PASSWORD=...secret-from-vault... (jamais hardcoded)
```

### 6.3 Fichier : `repo/infrastructure/clickhouse/config/clickhouse-server.xml`

```xml
<?xml version="1.0"?>
<!-- Skalean InsurTech v2.2 -- ClickHouse server overrides
     Reference : B-13 Sprint 13 Tache 3.6.1
     Loaded via /etc/clickhouse-server/config.d/skalean-overrides.xml
     Application : single-node dev ; production Sprint 35 = ON CLUSTER + ZooKeeper Keeper -->
<clickhouse>
    <!-- Logging -->
    <logger>
        <level>information</level>
        <log>/var/log/clickhouse-server/clickhouse-server.log</log>
        <errorlog>/var/log/clickhouse-server/clickhouse-server.err.log</errorlog>
        <size>500M</size>
        <count>5</count>
    </logger>

    <!-- Memory budget : 8 GB max query (dev) ; prod 32 GB -->
    <max_memory_usage>8589934592</max_memory_usage>
    <max_memory_usage_for_user>8589934592</max_memory_usage_for_user>

    <!-- Query log : tracer toutes queries pour analyse perf (Sprint 35) -->
    <query_log>
        <database>system</database>
        <table>query_log</table>
        <partition_by>toYYYYMM(event_date)</partition_by>
        <ttl>event_date + INTERVAL 30 DAY</ttl>
        <flush_interval_milliseconds>7500</flush_interval_milliseconds>
    </query_log>

    <!-- Trace log : pour debug profond (off prod) -->
    <trace_log remove="1"/>

    <!-- Limits par defaut profile -->
    <profiles>
        <default>
            <max_execution_time>60</max_execution_time>
            <max_result_rows>1000000</max_result_rows>
            <max_result_bytes>1073741824</max_result_bytes>
            <result_overflow_mode>break</result_overflow_mode>
            <send_progress_in_http_headers>1</send_progress_in_http_headers>
            <allow_experimental_full_text_index>0</allow_experimental_full_text_index>
        </default>
    </profiles>

    <!-- Format settings standardises Skalean : decimal point '.' (anglo), no leading zeros -->
    <format_csv_delimiter>,</format_csv_delimiter>
    <output_format_json_quote_64bit_integers>1</output_format_json_quote_64bit_integers>
    <output_format_json_quote_denormals>1</output_format_json_quote_denormals>

    <!-- HTTP server timeouts -->
    <http_server_default_response>OK</http_server_default_response>
    <http_connection_timeout>10</http_connection_timeout>
    <http_send_timeout>60</http_send_timeout>
    <http_receive_timeout>60</http_receive_timeout>
</clickhouse>
```

### 6.4 Fichier : `repo/infrastructure/clickhouse/config/users.xml`

```xml
<?xml version="1.0"?>
<!-- Skalean InsurTech v2.2 -- ClickHouse users + profiles
     Reference : B-13 Sprint 13 Tache 3.6.1
     IMPORTANT prod : passwords lus depuis Vault Atlas Cloud, JAMAIS hardcoded -->
<clickhouse>
    <users>
        <!-- User default : reserve API ETL/queries -->
        <default>
            <password from_env="CLICKHOUSE_PASSWORD"/>
            <networks>
                <ip>::/0</ip>
            </networks>
            <profile>default</profile>
            <quota>default</quota>
            <access_management>1</access_management>
            <named_collection_control>1</named_collection_control>
            <show_named_collections>1</show_named_collections>
            <show_named_collections_secrets>0</show_named_collections_secrets>
        </default>

        <!-- User readonly : reserve dashboards (Sprint 17 web-broker / 23 web-garage)
             Sprint 35 : creera via SQL `CREATE USER` apres deployment -->
        <readonly>
            <password from_env="CLICKHOUSE_READONLY_PASSWORD"/>
            <networks>
                <ip>::/0</ip>
            </networks>
            <profile>readonly</profile>
            <quota>readonly_quota</quota>
        </readonly>
    </users>

    <profiles>
        <default>
            <max_memory_usage>8589934592</max_memory_usage>
            <load_balancing>random</load_balancing>
            <max_execution_time>60</max_execution_time>
        </default>

        <readonly>
            <readonly>1</readonly>
            <max_memory_usage>4294967296</max_memory_usage>
            <max_execution_time>30</max_execution_time>
            <max_result_rows>500000</max_result_rows>
        </readonly>
    </profiles>

    <quotas>
        <default>
            <interval>
                <duration>3600</duration>
                <queries>0</queries>
                <errors>0</errors>
                <result_rows>0</result_rows>
                <read_rows>0</read_rows>
                <execution_time>0</execution_time>
            </interval>
        </default>

        <readonly_quota>
            <interval>
                <duration>3600</duration>
                <queries>10000</queries>
                <errors>500</errors>
                <result_rows>1000000000</result_rows>
                <read_rows>10000000000</read_rows>
                <execution_time>3600</execution_time>
            </interval>
        </readonly_quota>
    </quotas>
</clickhouse>
```

### 6.5 Fichier : `repo/infrastructure/clickhouse/schemas/00-database.sql`

```sql
-- Skalean InsurTech v2.2 -- Database analytics
-- Reference : B-13 Sprint 13 Tache 3.6.1
-- Idempotent : peut etre rejoue safely
CREATE DATABASE IF NOT EXISTS skalean_analytics
COMMENT 'Skalean InsurTech v2.2 -- OLAP analytics multi-tenant. Sprint 13.';

USE skalean_analytics;
```

### 6.6 Fichier : `repo/infrastructure/clickhouse/schemas/01-fct_transactions.sql`

```sql
-- Skalean InsurTech v2.2 -- Table de faits Paiements
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 11 Pay events source
-- Engine : MergeTree (append-only, dedup via INSERT IGNORE pattern Tache 3.6.2)
-- Partition : mensuel toYYYYMM(event_date) = 60 partitions / 5 ans = manageable
-- Order : (tenant_id, event_datetime, transaction_id) = partition pruning multi-tenant + range scan rapide
-- TTL : 5 ans (event_date + INTERVAL 5 YEAR) = drop automatique partitions expirees
-- Index granularity : 8192 (default) = compromise overhead/selectivity OLAP

CREATE TABLE IF NOT EXISTS skalean_analytics.fct_transactions
(
    -- Clefs primaires
    transaction_id          UUID,
    tenant_id               UUID,
    customer_id             Nullable(UUID),
    customer_email          String,

    -- Dimensions temporelles
    event_date              Date,
    event_datetime          DateTime,
    captured_at             Nullable(DateTime),
    refunded_at             Nullable(DateTime),

    -- Dimensions LowCardinality (compression dictionnaire, peu de valeurs distinctes)
    provider                LowCardinality(String),                    -- 6 passerelles MA : cmi, payzone, mtc, hps, paypal, stripe_test
    payment_method          LowCardinality(String),                    -- card, wallet_lyf, wallet_orange, wallet_inwi, cash, transfer
    status                  LowCardinality(String),                    -- pending, captured, failed, refunded, disputed
    currency                LowCardinality(String),                    -- MAD, EUR, USD
    country_code            LowCardinality(String),                    -- MA, FR, ES, ... (ISO 3166-1 alpha-2)

    -- Mesures monetaires (Decimal64(2) = precision 18 chiffres, 16 entiers + 2 decimales)
    amount                  Decimal64(2),
    fees_amount             Decimal64(2),
    net_amount              Decimal64(2),                              -- amount - fees_amount
    refunded_amount         Decimal64(2) DEFAULT 0,

    -- Ressources liees (lien sinistre Sprint 22, police Sprint 14, etc.)
    related_resource_type   LowCardinality(String),                    -- policy, claim, invoice, subscription
    related_resource_id     Nullable(UUID),

    -- Metadata flexible (JSON serializable, indexable via JSONExtract)
    metadata                String,                                     -- JSON serialized, schema-less

    -- Audit
    ingested_at             DateTime DEFAULT now(),
    etl_batch_id            Nullable(UUID),                             -- trace ETL run (Tache 3.6.2)

    -- Skip indexes (data skipping indexes : accelerent point lookups)
    INDEX idx_customer_id customer_id TYPE bloom_filter GRANULARITY 4,
    INDEX idx_provider provider TYPE set(8) GRANULARITY 4,
    INDEX idx_status status TYPE set(8) GRANULARITY 4
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_datetime, transaction_id)
TTL event_date + INTERVAL 5 YEAR
SETTINGS
    index_granularity = 8192,
    enable_mixed_granularity_parts = 1,
    storage_policy = 'default'
COMMENT 'Skalean InsurTech v2.2 -- Faits paiements. Source : pay_transactions Postgres. Update via ETL polling 5min.';
```

### 6.7 Fichier : `repo/infrastructure/clickhouse/schemas/02-fct_journal_entries.sql`

```sql
-- Skalean InsurTech v2.2 -- Table de faits Ecritures Comptables
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 12 Books journal_entries source

CREATE TABLE IF NOT EXISTS skalean_analytics.fct_journal_entries
(
    -- Clefs
    line_id                 UUID,
    entry_id                UUID,
    tenant_id               UUID,

    -- Dimensions temporelles
    event_date              Date,
    posted_at               DateTime,
    fiscal_year             UInt16,                                    -- ex : 2026
    fiscal_period           UInt8,                                     -- 1 a 12

    -- Plan comptable CGNC
    account_code            LowCardinality(String),                    -- ex : 4111, 7061, 6171
    account_class           UInt8,                                     -- 1 a 9 (CGNC classes)
    account_nature          LowCardinality(String),                    -- asset, liability, equity, revenue, expense

    -- Mesures
    debit_amount            Decimal64(2) DEFAULT 0,
    credit_amount           Decimal64(2) DEFAULT 0,
    balance_signed          Decimal64(2),                              -- credit - debit (pour bilans)

    -- Origine ecriture
    journal_code            LowCardinality(String),                    -- VTE, ACH, BNK, OD, etc.
    source_resource_type    LowCardinality(String),                    -- pay_transaction, invoice, payslip, manual
    source_resource_id      Nullable(UUID),

    -- TVA (if applicable)
    tva_rate                Decimal32(4) DEFAULT 0,                    -- 0.0000 a 0.2000 (5 taux MA)
    tva_amount              Decimal64(2) DEFAULT 0,

    -- Description
    label                   String,

    -- Audit
    ingested_at             DateTime DEFAULT now(),
    etl_batch_id            Nullable(UUID),

    INDEX idx_account_code account_code TYPE set(256) GRANULARITY 4,
    INDEX idx_journal_code journal_code TYPE set(32) GRANULARITY 4
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, account_code, posted_at, line_id)
TTL event_date + INTERVAL 10 YEAR                                      -- DGI exige conservation 10 ans
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Faits comptables CGNC. Source : books_journal_lines Postgres. Conservation 10 ans loi 9-88.';
```

### 6.8 Fichier : `repo/infrastructure/clickhouse/schemas/03-fct_appointments.sql`

```sql
-- Skalean InsurTech v2.2 -- Table de faits Rendez-vous Booking
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 8 CRM+Booking

CREATE TABLE IF NOT EXISTS skalean_analytics.fct_appointments
(
    appointment_id          UUID,
    tenant_id               UUID,
    customer_id             Nullable(UUID),
    customer_email          String,

    -- Temporelles
    event_date              Date,
    starts_at               DateTime,
    ends_at                 DateTime,
    duration_minutes        UInt16,

    -- Dimensions
    appointment_type        LowCardinality(String),                    -- inspection, signature, reception, livraison
    room_id                 Nullable(UUID),
    assigned_user_id        Nullable(UUID),                            -- employee assigne
    status                  LowCardinality(String),                    -- scheduled, confirmed, cancelled, no_show, completed

    -- Geolocalisation (Mapbox Sprint 28)
    location_lat            Nullable(Decimal32(6)),
    location_lng            Nullable(Decimal32(6)),
    city                    LowCardinality(String),                    -- Casablanca, Rabat, Marrakech, ...

    -- Resultats
    cancelled_at            Nullable(DateTime),
    cancellation_reason     LowCardinality(String),                    -- customer_request, no_show, weather, technical
    no_show                 UInt8 DEFAULT 0,                           -- 0/1 bool flag

    -- Audit
    ingested_at             DateTime DEFAULT now(),
    etl_batch_id            Nullable(UUID),

    INDEX idx_status status TYPE set(8) GRANULARITY 4,
    INDEX idx_city city TYPE set(64) GRANULARITY 4
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, starts_at, appointment_id)
TTL event_date + INTERVAL 3 YEAR                                        -- bookings = 3 ans suffisant
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Faits rendez-vous Booking. Source : booking_appointments Postgres.';
```

### 6.9 Fichier : `repo/infrastructure/clickhouse/schemas/04-fct_messages.sql`

```sql
-- Skalean InsurTech v2.2 -- Table de faits Messages (WhatsApp + Email)
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 9 Comm

CREATE TABLE IF NOT EXISTS skalean_analytics.fct_messages
(
    message_id              UUID,
    tenant_id               UUID,
    customer_id             Nullable(UUID),
    customer_email          String,

    -- Temporelles
    event_date              Date,
    sent_at                 DateTime,
    delivered_at            Nullable(DateTime),
    read_at                 Nullable(DateTime),
    replied_at              Nullable(DateTime),

    -- Dimensions
    channel                 LowCardinality(String),                    -- whatsapp, email, sms (rare), in_app
    direction               LowCardinality(String),                    -- outbound, inbound
    template_id             LowCardinality(String),                    -- nom du template Handlebars
    locale                  LowCardinality(String),                    -- fr, ar-MA, ar, en

    -- Contexte business
    related_resource_type   LowCardinality(String),                    -- policy, claim, appointment, payment, leave
    related_resource_id     Nullable(UUID),

    -- Metrics
    cost_micro_mad          UInt32 DEFAULT 0,                          -- cout en micro-MAD (Twilio/Meta)
    delivery_status         LowCardinality(String),                    -- sent, delivered, read, failed, bounced
    error_code              LowCardinality(String),                    -- meta_blocked, sendgrid_bounce, etc.

    -- Audit
    ingested_at             DateTime DEFAULT now(),
    etl_batch_id            Nullable(UUID),

    INDEX idx_channel channel TYPE set(8) GRANULARITY 4,
    INDEX idx_template_id template_id TYPE bloom_filter GRANULARITY 4
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, sent_at, message_id)
TTL event_date + INTERVAL 2 YEAR                                        -- communications 2 ans = compliant GDPR/CNDP
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Faits messages communication. Source : comm_messages Postgres.';
```

### 6.10 Fichier : `repo/infrastructure/clickhouse/schemas/05-fct_documents_signed.sql`

```sql
-- Skalean InsurTech v2.2 -- Table de faits Documents Signes
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 10 Docs+Signature

CREATE TABLE IF NOT EXISTS skalean_analytics.fct_documents_signed
(
    signature_id            UUID,
    document_id             UUID,
    tenant_id               UUID,
    signer_email            String,
    signer_id               Nullable(UUID),

    -- Temporelles
    event_date              Date,
    initiated_at            DateTime,
    signed_at               Nullable(DateTime),
    expired_at              Nullable(DateTime),
    time_to_sign_seconds    Nullable(UInt32),                          -- signed_at - initiated_at

    -- Dimensions
    document_type           LowCardinality(String),                    -- policy, claim_report, payslip, invoice, contract_hr
    signature_provider      LowCardinality(String),                    -- barid_esign, anrt_tsa, internal
    signature_level         LowCardinality(String),                    -- simple, advanced, qualified (eIDAS-like)
    status                  LowCardinality(String),                    -- pending, signed, expired, cancelled, rejected

    -- Mesures
    document_size_kb        Nullable(UInt32),
    pages_count             Nullable(UInt16),

    -- Conformite (Article 6 loi 53-05 signature electronique)
    legal_value             LowCardinality(String),                    -- presumptive, qualified
    timestamp_authority     LowCardinality(String),                    -- anrt, internal

    -- Audit
    ingested_at             DateTime DEFAULT now(),
    etl_batch_id            Nullable(UUID),

    INDEX idx_status status TYPE set(8) GRANULARITY 4,
    INDEX idx_document_type document_type TYPE set(16) GRANULARITY 4
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, signed_at, signature_id)
TTL event_date + INTERVAL 10 YEAR                                       -- signatures = 10 ans loi 53-05
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Faits signatures. Source : doc_signatures Postgres. Conservation 10 ans loi 53-05.';
```

### 6.11 Fichier : `repo/infrastructure/clickhouse/schemas/06-dim_tenants.sql`

```sql
-- Skalean InsurTech v2.2 -- Dimension Tenants
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 6 multi-tenant
-- Engine : ReplacingMergeTree (dedup auto sur primary key au merge background)

CREATE TABLE IF NOT EXISTS skalean_analytics.dim_tenants
(
    tenant_id               UUID,
    slug                    String,
    legal_name              String,
    industry                LowCardinality(String),                    -- broker, garage, expert, admin_skalean
    country                 LowCardinality(String),                    -- MA, FR, ES, ...
    city                    LowCardinality(String),
    
    -- Lifecycle
    onboarded_at            DateTime,
    activated_at            Nullable(DateTime),
    churned_at              Nullable(DateTime),
    churn_reason            LowCardinality(String),                    -- price, competitor, no_use, fraud

    -- Plan
    subscription_plan       LowCardinality(String),                    -- starter, pro, enterprise
    monthly_revenue_micro_mad UInt64 DEFAULT 0,

    -- Conformite
    cnss_number             Nullable(String),
    ice_number              Nullable(String),
    rc_number               Nullable(String),
    acaps_agrement          Nullable(String),

    -- Audit (version pour ReplacingMergeTree)
    updated_at              DateTime,
    ingested_at             DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY tenant_id
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Dimension tenants. Source : auth_tenants Postgres. ReplacingMergeTree dedup au merge.';
```

### 6.12 Fichier : `repo/infrastructure/clickhouse/schemas/07-dim_customers.sql`

```sql
-- Skalean InsurTech v2.2 -- Dimension Customers
-- Reference : B-13 Sprint 13 Tache 3.6.1 + Sprint 8 CRM contacts

CREATE TABLE IF NOT EXISTS skalean_analytics.dim_customers
(
    customer_id             UUID,
    tenant_id               UUID,
    email                   String,
    full_name               String,
    
    -- Type
    customer_type           LowCardinality(String),                    -- prospect, customer, lead, churned
    persona                 LowCardinality(String),                    -- individual, smb, enterprise
    
    -- Demographics
    age_range               LowCardinality(String),                    -- 18-25, 26-35, 36-45, 46-55, 56-65, 65+
    gender                  LowCardinality(String),                    -- M, F, undisclosed
    city                    LowCardinality(String),
    region                  LowCardinality(String),                    -- 12 regions MA
    
    -- Marketing
    acquisition_source      LowCardinality(String),                    -- organic, paid_meta, paid_google, referral, direct
    acquisition_date        Date,
    first_purchase_at       Nullable(DateTime),
    
    -- LTV
    lifetime_value_mad      Decimal64(2) DEFAULT 0,
    total_orders            UInt32 DEFAULT 0,
    last_order_at           Nullable(DateTime),
    
    -- Audit
    updated_at              DateTime,
    ingested_at             DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, customer_id)
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Dimension customers. Source : crm_contacts Postgres.';
```

### 6.13 Fichier : `repo/infrastructure/clickhouse/schemas/08-dim_dates.sql`

```sql
-- Skalean InsurTech v2.2 -- Dimension Calendar Dates (5 ans : 2024-01-01 -> 2028-12-31 = 1827 jours)
-- Reference : B-13 Sprint 13 Tache 3.6.1
-- Permet jointures rapides pour heatmap, fill-gaps, calendrier metier

CREATE TABLE IF NOT EXISTS skalean_analytics.dim_dates
(
    date                    Date,
    year                    UInt16,
    quarter                 UInt8,
    month                   UInt8,
    month_name              LowCardinality(String),                    -- January, ...
    week_of_year            UInt8,
    day_of_year             UInt16,
    day_of_month            UInt8,
    day_of_week             UInt8,                                     -- 1=Monday, 7=Sunday
    day_name                LowCardinality(String),                    -- Monday, ...
    is_weekend              UInt8,                                     -- 0/1
    is_holiday_ma           UInt8 DEFAULT 0,                           -- 0/1 (jours feries MA, computed by seed script)
    holiday_name_ma         LowCardinality(String) DEFAULT '',
    fiscal_year             UInt16,
    fiscal_quarter          UInt8,
    fiscal_month            UInt8,
    ramadan_year            UInt8 DEFAULT 0,                           -- 0/1 (jour de ramadan)
    seed_at                 DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY date
SETTINGS index_granularity = 8192
COMMENT 'Skalean InsurTech v2.2 -- Dimension dates. Pre-rempli 5 ans 2024-2028 par init-clickhouse.ts.';
```

### 6.14 Fichier : `repo/packages/analytics/package.json`

```json
{
  "name": "@insurtech/analytics",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech v2.2 -- Analytics OLAP package : ClickHouse client + AnalyticsService + dashboards queries. Sprint 13.",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "default": "./dist/testing/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "clean": "rimraf dist",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@clickhouse/client": "1.10.1",
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-types": "workspace:*",
    "@insurtech/shared-utils": "workspace:*",
    "@nestjs/common": "10.4.15",
    "@nestjs/config": "3.3.0",
    "@nestjs/terminus": "10.2.3",
    "date-fns": "4.1.0",
    "decimal.js": "10.4.3",
    "ioredis": "5.4.1",
    "pino": "9.5.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "rimraf": "6.0.1",
    "tsx": "4.19.2",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  },
  "engines": {
    "node": ">=22.11.0"
  }
}
```

### 6.15 Fichier : `repo/packages/analytics/src/config/clickhouse.config.ts`

```typescript
// repo/packages/analytics/src/config/clickhouse.config.ts
// Skalean InsurTech v2.2 -- ClickHouse configuration loader Zod
// Reference : B-13 Sprint 13 Tache 3.6.1
// Convention strictes : decision-006 no-emoji, Zod validation runtime
import { z } from 'zod';

/**
 * Schema Zod pour la configuration ClickHouse.
 * Lit les variables d'environnement avec validation runtime.
 * 
 * Variables attendues :
 * - CLICKHOUSE_URL                       : URL HTTP du serveur ClickHouse
 * - CLICKHOUSE_USERNAME                  : utilisateur (default = 'default')
 * - CLICKHOUSE_PASSWORD                  : mot de passe (vide en dev autorise)
 * - CLICKHOUSE_DATABASE                  : nom database (default = 'skalean_analytics')
 * - CLICKHOUSE_REQUEST_TIMEOUT_MS        : timeout HTTP en millisecondes (default 30000)
 * - CLICKHOUSE_MAX_OPEN_CONNECTIONS      : pool connections max (default 10)
 */
export const ClickHouseConfigSchema = z.object({
  url: z
    .string()
    .url({ message: 'CLICKHOUSE_URL must be a valid URL (http://... or https://...)' })
    .refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
      message: 'CLICKHOUSE_URL must use http(s) protocol',
    }),
  username: z
    .string()
    .min(1, { message: 'CLICKHOUSE_USERNAME cannot be empty' })
    .default('default'),
  password: z.string().default(''),
  database: z
    .string()
    .min(1)
    .regex(/^[a-z_][a-z0-9_]*$/, {
      message: 'CLICKHOUSE_DATABASE must be lowercase snake_case (a-z, 0-9, underscore)',
    })
    .default('skalean_analytics'),
  requestTimeoutMs: z.coerce.number().int().positive().default(30000),
  maxOpenConnections: z.coerce.number().int().positive().max(100).default(10),
});

export type ClickHouseConfig = z.infer<typeof ClickHouseConfigSchema>;

/**
 * Charge la configuration ClickHouse depuis process.env.
 * Lance ZodError si invalide. A appeler une seule fois au bootstrap.
 */
export function loadClickHouseConfig(env: NodeJS.ProcessEnv = process.env): ClickHouseConfig {
  return ClickHouseConfigSchema.parse({
    url: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USERNAME,
    password: env.CLICKHOUSE_PASSWORD,
    database: env.CLICKHOUSE_DATABASE,
    requestTimeoutMs: env.CLICKHOUSE_REQUEST_TIMEOUT_MS,
    maxOpenConnections: env.CLICKHOUSE_MAX_OPEN_CONNECTIONS,
  });
}
```

### 6.16 Fichier : `repo/packages/analytics/src/services/clickhouse.service.ts`

```typescript
// repo/packages/analytics/src/services/clickhouse.service.ts
// Skalean InsurTech v2.2 -- ClickHouse Service singleton NestJS
// Reference : B-13 Sprint 13 Tache 3.6.1
// Conventions : Pino logger (jamais console.log), Zod validation, no emoji,
// multi-tenant via TenantContext, errors structured
import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import {
  ClickHouseClient,
  createClient,
  type ClickHouseClientConfigOptions,
  type ResponseJSON,
} from '@clickhouse/client';
import { ClickHouseConfig } from '../config/clickhouse.config';
import {
  ClickHouseConnectionError,
  ClickHouseQueryError,
  ClickHouseInsertError,
} from '../utils/clickhouse-errors';

export interface ClickHouseInsertParams<T> {
  table: string;
  values: T[];
  format?: 'JSONEachRow' | 'JSON';
}

export interface ClickHouseQueryParams {
  query: string;
  query_params?: Record<string, unknown>;
  format?: 'JSONEachRow' | 'JSON' | 'CSVWithNames';
  abort_signal?: AbortSignal;
}

export const CLICKHOUSE_CONFIG = 'CLICKHOUSE_CONFIG';

/**
 * Service NestJS singleton pour l'acces a ClickHouse.
 * 
 * Usage :
 *   constructor(private readonly ch: ClickHouseService) {}
 *   const rows = await this.ch.query({ query: 'SELECT 1 AS x', format: 'JSONEachRow' });
 * 
 * Threadsafe : un seul ClickHouseClient partage, pool TCP gere par @clickhouse/client.
 * Multi-tenant : aucun filtre automatique tenant_id (responsabilite du caller AnalyticsService).
 */
@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private client!: ClickHouseClient;
  private isReady = false;

  constructor(
    @Inject(CLICKHOUSE_CONFIG)
    private readonly config: ClickHouseConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log({
      action: 'clickhouse_init',
      url: this.config.url,
      database: this.config.database,
      username: this.config.username,
    });

    const clientOptions: ClickHouseClientConfigOptions = {
      url: this.config.url,
      username: this.config.username,
      password: this.config.password,
      database: this.config.database,
      request_timeout: this.config.requestTimeoutMs,
      max_open_connections: this.config.maxOpenConnections,
      compression: {
        response: true,
        request: false,
      },
      keep_alive: {
        enabled: true,
        idle_socket_ttl: 8000,
      },
      clickhouse_settings: {
        send_progress_in_http_headers: 1,
        async_insert: 0,
        wait_for_async_insert: 1,
      },
      log: {
        LoggerClass: this.bridgePinoLogger(),
      },
    };

    this.client = createClient(clientOptions);

    try {
      const ok = await this.ping();
      if (!ok) {
        throw new ClickHouseConnectionError('Ping returned not OK');
      }
      this.isReady = true;
      this.logger.log({ action: 'clickhouse_ready', database: this.config.database });
    } catch (err) {
      this.logger.error({
        action: 'clickhouse_init_failed',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.logger.log({ action: 'clickhouse_closed' });
      } catch (err) {
        this.logger.warn({ action: 'clickhouse_close_failed', error: String(err) });
      }
    }
  }

  /**
   * Healthcheck : ping le serveur ClickHouse. Retourne true si OK.
   * Endpoint /ping retourne "Ok.\n" (avec point + newline).
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result.success === true;
    } catch (err) {
      this.logger.warn({ action: 'clickhouse_ping_failed', error: String(err) });
      return false;
    }
  }

  /**
   * Execute une SELECT query et retourne les rows parses.
   * @param params query + query_params anti-injection + format (default JSONEachRow stream)
   */
  async query<T = Record<string, unknown>>(params: ClickHouseQueryParams): Promise<T[]> {
    if (!this.isReady) {
      throw new ClickHouseConnectionError('ClickHouse not initialized');
    }
    const start = Date.now();
    try {
      const resultSet = await this.client.query({
        query: params.query,
        query_params: params.query_params,
        format: params.format ?? 'JSONEachRow',
        abort_signal: params.abort_signal,
      });
      const rows = await resultSet.json<T>();
      const duration = Date.now() - start;
      this.logger.debug({
        action: 'clickhouse_query',
        duration_ms: duration,
        rows: Array.isArray(rows) ? rows.length : undefined,
      });
      return rows as T[];
    } catch (err) {
      const duration = Date.now() - start;
      this.logger.error({
        action: 'clickhouse_query_failed',
        duration_ms: duration,
        query_excerpt: params.query.slice(0, 200),
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ClickHouseQueryError(
        `ClickHouse query failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }

  /**
   * Execute une query qui retourne un JSON wrapped (meta, statistics).
   */
  async queryRaw<T = Record<string, unknown>>(params: ClickHouseQueryParams): Promise<ResponseJSON<T>> {
    if (!this.isReady) {
      throw new ClickHouseConnectionError('ClickHouse not initialized');
    }
    try {
      const resultSet = await this.client.query({
        query: params.query,
        query_params: params.query_params,
        format: 'JSON',
        abort_signal: params.abort_signal,
      });
      return await resultSet.json<T>();
    } catch (err) {
      throw new ClickHouseQueryError(
        `ClickHouse queryRaw failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }

  /**
   * Insert batch de rows dans une table. Format JSONEachRow par defaut (compatible LowCardinality).
   * @param params table + values + format
   */
  async insertBatch<T extends Record<string, unknown>>(
    params: ClickHouseInsertParams<T>,
  ): Promise<{ inserted: number; duration_ms: number }> {
    if (!this.isReady) {
      throw new ClickHouseConnectionError('ClickHouse not initialized');
    }
    if (params.values.length === 0) {
      return { inserted: 0, duration_ms: 0 };
    }
    const start = Date.now();
    try {
      await this.client.insert({
        table: params.table,
        values: params.values,
        format: params.format ?? 'JSONEachRow',
      });
      const duration = Date.now() - start;
      this.logger.debug({
        action: 'clickhouse_insert',
        table: params.table,
        rows: params.values.length,
        duration_ms: duration,
      });
      return { inserted: params.values.length, duration_ms: duration };
    } catch (err) {
      throw new ClickHouseInsertError(
        `ClickHouse insert into ${params.table} failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }

  /**
   * Execute une DDL ou DML sans retour (CREATE, ALTER, TRUNCATE, OPTIMIZE).
   */
  async command(commandSql: string): Promise<void> {
    if (!this.isReady) {
      throw new ClickHouseConnectionError('ClickHouse not initialized');
    }
    try {
      await this.client.command({ query: commandSql });
      this.logger.log({ action: 'clickhouse_command', excerpt: commandSql.slice(0, 120) });
    } catch (err) {
      throw new ClickHouseQueryError(
        `ClickHouse command failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }

  /**
   * Expose le client interne (rare : pour cas avances non couverts par cette abstraction).
   */
  getInternalClient(): ClickHouseClient {
    return this.client;
  }

  private bridgePinoLogger(): new () => {
    trace(p: { module?: string; message: string; args?: unknown }): void;
    debug(p: { module?: string; message: string; args?: unknown }): void;
    info(p: { module?: string; message: string; args?: unknown }): void;
    warn(p: { module?: string; message: string; err?: unknown; args?: unknown }): void;
    error(p: { module?: string; message: string; err?: unknown; args?: unknown }): void;
  } {
    const nestLogger = this.logger;
    return class implements ReturnType<typeof bridgePinoLoggerInner> {
      trace(p: { message: string }) {
        nestLogger.debug({ source: 'ch_internal', ...p });
      }
      debug(p: { message: string }) {
        nestLogger.debug({ source: 'ch_internal', ...p });
      }
      info(p: { message: string }) {
        nestLogger.log({ source: 'ch_internal', ...p });
      }
      warn(p: { message: string }) {
        nestLogger.warn({ source: 'ch_internal', ...p });
      }
      error(p: { message: string }) {
        nestLogger.error({ source: 'ch_internal', ...p });
      }
    } as never;
  }
}

function bridgePinoLoggerInner() {
  return {
    trace: (_p: unknown) => {},
    debug: (_p: unknown) => {},
    info: (_p: unknown) => {},
    warn: (_p: unknown) => {},
    error: (_p: unknown) => {},
  };
}
```

### 6.17 Fichier : `repo/packages/analytics/src/clickhouse.module.ts`

```typescript
// repo/packages/analytics/src/clickhouse.module.ts
// Skalean InsurTech v2.2 -- ClickHouse NestJS Module (forRoot pattern)
// Reference : B-13 Sprint 13 Tache 3.6.1
import { DynamicModule, Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickHouseService, CLICKHOUSE_CONFIG } from './services/clickhouse.service';
import { ClickHouseConfig, loadClickHouseConfig } from './config/clickhouse.config';

export interface ClickHouseModuleOptions {
  /**
   * Si true, le module sera GLOBAL (importe une fois dans AppModule).
   * Default true (pattern recommande).
   */
  isGlobal?: boolean;
  /**
   * Override config explicite (test/mock). Sinon, lit process.env.
   */
  config?: Partial<ClickHouseConfig>;
}

@Module({})
export class ClickHouseModule {
  static forRoot(options: ClickHouseModuleOptions = {}): DynamicModule {
    const isGlobal = options.isGlobal ?? true;
    const finalConfig = options.config
      ? { ...loadClickHouseConfig(), ...options.config }
      : loadClickHouseConfig();

    const configProvider = {
      provide: CLICKHOUSE_CONFIG,
      useValue: finalConfig,
    };

    return {
      module: ClickHouseModule,
      global: isGlobal,
      imports: [ConfigModule],
      providers: [configProvider, ClickHouseService],
      exports: [ClickHouseService, CLICKHOUSE_CONFIG],
    };
  }

  /**
   * Variante async lecture config differee (useful Sprint 35 secrets manager).
   */
  static forRootAsync(options: {
    isGlobal?: boolean;
    inject: any[];
    useFactory: (...args: any[]) => Promise<ClickHouseConfig> | ClickHouseConfig;
  }): DynamicModule {
    const isGlobal = options.isGlobal ?? true;

    const configProvider = {
      provide: CLICKHOUSE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject,
    };

    return {
      module: ClickHouseModule,
      global: isGlobal,
      imports: [ConfigModule],
      providers: [configProvider, ClickHouseService],
      exports: [ClickHouseService, CLICKHOUSE_CONFIG],
    };
  }
}

@Global()
@Module({
  imports: [ClickHouseModule.forRoot({ isGlobal: false })],
  exports: [ClickHouseModule],
})
export class GlobalClickHouseModule {}
```

### 6.18 Fichier : `repo/packages/analytics/src/utils/clickhouse-errors.ts`

```typescript
// repo/packages/analytics/src/utils/clickhouse-errors.ts
// Skalean InsurTech v2.2 -- Custom errors ClickHouse
// Reference : B-13 Sprint 13 Tache 3.6.1

export class ClickHouseError extends Error {
  public readonly cause?: Error;
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ClickHouseConnectionError extends ClickHouseError {}
export class ClickHouseQueryError extends ClickHouseError {}
export class ClickHouseInsertError extends ClickHouseError {}
export class ClickHouseTimeoutError extends ClickHouseError {}
export class ClickHouseConfigError extends ClickHouseError {}

export function isClickHouseError(err: unknown): err is ClickHouseError {
  return err instanceof ClickHouseError;
}
```

### 6.19 Fichier : `repo/packages/analytics/src/types/clickhouse-types.ts`

```typescript
// repo/packages/analytics/src/types/clickhouse-types.ts
// Skalean InsurTech v2.2 -- Types internes communs Analytics
// Reference : B-13 Sprint 13 Tache 3.6.1

export interface FctTransactionRow {
  transaction_id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_email: string;
  event_date: string;             // 'YYYY-MM-DD'
  event_datetime: string;         // 'YYYY-MM-DD HH:mm:ss'
  captured_at: string | null;
  refunded_at: string | null;
  provider: string;
  payment_method: string;
  status: string;
  currency: string;
  country_code: string;
  amount: string;                  // Decimal serialise en string
  fees_amount: string;
  net_amount: string;
  refunded_amount: string;
  related_resource_type: string;
  related_resource_id: string | null;
  metadata: string;                // JSON string
  ingested_at: string;
  etl_batch_id: string | null;
}

export interface FctJournalEntryRow {
  line_id: string;
  entry_id: string;
  tenant_id: string;
  event_date: string;
  posted_at: string;
  fiscal_year: number;
  fiscal_period: number;
  account_code: string;
  account_class: number;
  account_nature: string;
  debit_amount: string;
  credit_amount: string;
  balance_signed: string;
  journal_code: string;
  source_resource_type: string;
  source_resource_id: string | null;
  tva_rate: string;
  tva_amount: string;
  label: string;
  ingested_at: string;
  etl_batch_id: string | null;
}

export interface DimTenantRow {
  tenant_id: string;
  slug: string;
  legal_name: string;
  industry: string;
  country: string;
  city: string;
  onboarded_at: string;
  activated_at: string | null;
  churned_at: string | null;
  churn_reason: string;
  subscription_plan: string;
  monthly_revenue_micro_mad: number;
  cnss_number: string | null;
  ice_number: string | null;
  rc_number: string | null;
  acaps_agrement: string | null;
  updated_at: string;
  ingested_at: string;
}

export interface DimDateRow {
  date: string;
  year: number;
  quarter: number;
  month: number;
  month_name: string;
  week_of_year: number;
  day_of_year: number;
  day_of_month: number;
  day_of_week: number;
  day_name: string;
  is_weekend: number;
  is_holiday_ma: number;
  holiday_name_ma: string;
  fiscal_year: number;
  fiscal_quarter: number;
  fiscal_month: number;
  ramadan_year: number;
}

export type RevenueGroupBy = 'day' | 'week' | 'month';
export type DateRange = { start: Date; end: Date };
```

### 6.20 Fichier : `repo/packages/analytics/src/index.ts`

```typescript
// repo/packages/analytics/src/index.ts
// Skalean InsurTech v2.2 -- Public API @insurtech/analytics
// Reference : B-13 Sprint 13 Tache 3.6.1
export { ClickHouseService, CLICKHOUSE_CONFIG } from './services/clickhouse.service';
export type { ClickHouseInsertParams, ClickHouseQueryParams } from './services/clickhouse.service';
export { ClickHouseModule } from './clickhouse.module';
export type { ClickHouseModuleOptions } from './clickhouse.module';
export {
  ClickHouseConfigSchema,
  loadClickHouseConfig,
  type ClickHouseConfig,
} from './config/clickhouse.config';
export {
  ClickHouseError,
  ClickHouseConnectionError,
  ClickHouseQueryError,
  ClickHouseInsertError,
  ClickHouseTimeoutError,
  ClickHouseConfigError,
  isClickHouseError,
} from './utils/clickhouse-errors';
export type {
  FctTransactionRow,
  FctJournalEntryRow,
  DimTenantRow,
  DimDateRow,
  RevenueGroupBy,
  DateRange,
} from './types/clickhouse-types';
```

### 6.21 Fichier : `repo/infrastructure/scripts/init-clickhouse.ts`

```typescript
#!/usr/bin/env tsx
// repo/infrastructure/scripts/init-clickhouse.ts
// Skalean InsurTech v2.2 -- Initialisation ClickHouse : DDL + seed dim_dates
// Reference : B-13 Sprint 13 Tache 3.6.1
// Usage : pnpm tsx infrastructure/scripts/init-clickhouse.ts [--reset]
// Idempotent : peut etre rejoue safely. --reset = DROP DATABASE + recreer.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { addDays, format as formatDate, getDayOfYear, getISOWeek } from 'date-fns';
import { loadClickHouseConfig } from '@insurtech/analytics';

interface HolidayMA {
  date: string;       // YYYY-MM-DD
  name: string;
}

// Jours feries officiels MA (sans Aid : dates lunaires, calculees runtime separement)
const HOLIDAYS_MA: HolidayMA[] = [
  { date: '2024-01-01', name: 'Nouvel an' },
  { date: '2024-01-11', name: 'Manifeste independance' },
  { date: '2024-05-01', name: 'Fete travail' },
  { date: '2024-07-30', name: 'Fete trone' },
  { date: '2024-08-14', name: 'Allegeance Oued Eddahab' },
  { date: '2024-08-20', name: 'Revolution roi peuple' },
  { date: '2024-08-21', name: 'Anniversaire roi' },
  { date: '2024-11-06', name: 'Marche verte' },
  { date: '2024-11-18', name: 'Independance' },
  { date: '2025-01-01', name: 'Nouvel an' },
  { date: '2025-01-11', name: 'Manifeste independance' },
  { date: '2025-05-01', name: 'Fete travail' },
  { date: '2025-07-30', name: 'Fete trone' },
  { date: '2025-08-14', name: 'Allegeance Oued Eddahab' },
  { date: '2025-08-20', name: 'Revolution roi peuple' },
  { date: '2025-08-21', name: 'Anniversaire roi' },
  { date: '2025-11-06', name: 'Marche verte' },
  { date: '2025-11-18', name: 'Independance' },
  { date: '2026-01-01', name: 'Nouvel an' },
  { date: '2026-01-11', name: 'Manifeste independance' },
  { date: '2026-05-01', name: 'Fete travail' },
  { date: '2026-07-30', name: 'Fete trone' },
  { date: '2026-08-14', name: 'Allegeance Oued Eddahab' },
  { date: '2026-08-20', name: 'Revolution roi peuple' },
  { date: '2026-08-21', name: 'Anniversaire roi' },
  { date: '2026-11-06', name: 'Marche verte' },
  { date: '2026-11-18', name: 'Independance' },
  // ... ajouter 2027, 2028 ...
];

const HOLIDAY_MAP = new Map(HOLIDAYS_MA.map((h) => [h.date, h.name]));

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const config = loadClickHouseConfig();
  console.log(`[init-clickhouse] url=${config.url} database=${config.database} reset=${reset}`);

  const client = createClient({
    url: config.url,
    username: config.username,
    password: config.password,
    request_timeout: config.requestTimeoutMs,
  });

  try {
    const ping = await client.ping();
    if (!ping.success) throw new Error(`ClickHouse ping failed: ${JSON.stringify(ping)}`);
    console.log('[init-clickhouse] ping OK');

    if (reset) {
      console.log(`[init-clickhouse] DROP DATABASE ${config.database}`);
      await client.command({ query: `DROP DATABASE IF EXISTS ${config.database}` });
    }

    const schemasDir = resolve(__dirname, '..', 'clickhouse', 'schemas');
    const files = readdirSync(schemasDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    console.log(`[init-clickhouse] loading ${files.length} schema files`);

    for (const file of files) {
      const sql = readFileSync(join(schemasDir, file), 'utf-8');
      const statements = sql
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('--') && !s.startsWith('USE '));
      for (const stmt of statements) {
        console.log(`[init-clickhouse] executing ${file} (${stmt.length} chars)`);
        await client.command({ query: stmt });
      }
    }

    console.log('[init-clickhouse] DDL complete. Seeding dim_dates...');
    await seedDimDates(client, config.database);
    console.log('[init-clickhouse] dim_dates seeded.');

    const tables = await client.query({
      query: `SELECT name FROM system.tables WHERE database = {db:String} ORDER BY name`,
      query_params: { db: config.database },
      format: 'JSONEachRow',
    });
    const tableRows = await tables.json<{ name: string }>();
    console.log(`[init-clickhouse] database "${config.database}" tables :`, tableRows.map((r) => r.name));

    console.log('[init-clickhouse] DONE.');
  } catch (err) {
    console.error('[init-clickhouse] FAILED', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

async function seedDimDates(client: ClickHouseClient, database: string): Promise<void> {
  const startDate = new Date('2024-01-01T00:00:00Z');
  const endDate = new Date('2028-12-31T00:00:00Z');
  const rows: Array<Record<string, string | number>> = [];

  for (
    let cursor = new Date(startDate);
    cursor <= endDate;
    cursor = addDays(cursor, 1)
  ) {
    const dateStr = formatDate(cursor, 'yyyy-MM-dd');
    const monthName = formatDate(cursor, 'MMMM');
    const dayName = formatDate(cursor, 'EEEE');
    const month = cursor.getUTCMonth() + 1;
    const dayOfWeek = ((cursor.getUTCDay() + 6) % 7) + 1; // 1=Monday, 7=Sunday

    rows.push({
      date: dateStr,
      year: cursor.getUTCFullYear(),
      quarter: Math.floor((month - 1) / 3) + 1,
      month,
      month_name: monthName,
      week_of_year: getISOWeek(cursor),
      day_of_year: getDayOfYear(cursor),
      day_of_month: cursor.getUTCDate(),
      day_of_week: dayOfWeek,
      day_name: dayName,
      is_weekend: dayOfWeek === 6 || dayOfWeek === 7 ? 1 : 0,
      is_holiday_ma: HOLIDAY_MAP.has(dateStr) ? 1 : 0,
      holiday_name_ma: HOLIDAY_MAP.get(dateStr) ?? '',
      fiscal_year: cursor.getUTCFullYear(),                  // MA = annee civile fiscale
      fiscal_quarter: Math.floor((month - 1) / 3) + 1,
      fiscal_month: month,
      ramadan_year: 0,                                        // TODO Tache 3.6.14 enrichir lune islamique
    });
  }

  // Insert TRUNCATE puis INSERT (idempotent)
  await client.command({
    query: `TRUNCATE TABLE IF EXISTS ${database}.dim_dates`,
  });

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await client.insert({
      table: `${database}.dim_dates`,
      values: batch,
      format: 'JSONEachRow',
    });
  }

  console.log(`[init-clickhouse] dim_dates : ${rows.length} rows inserted`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main, seedDimDates };
```

### 6.22 Fichier : `repo/apps/api/src/modules/health/clickhouse.health-indicator.ts`

```typescript
// repo/apps/api/src/modules/health/clickhouse.health-indicator.ts
// Skalean InsurTech v2.2 -- ClickHouse Health Indicator (Terminus)
// Reference : B-13 Sprint 13 Tache 3.6.1
import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ClickHouseService } from '@insurtech/analytics';

@Injectable()
export class ClickHouseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(ClickHouseHealthIndicator.name);

  constructor(private readonly clickhouse: ClickHouseService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      const ok = await this.clickhouse.ping();
      const duration = Date.now() - start;
      if (!ok) {
        throw new HealthCheckError(
          'ClickHouse ping failed',
          this.getStatus(key, false, { duration_ms: duration }),
        );
      }
      return this.getStatus(key, true, { duration_ms: duration });
    } catch (err) {
      const duration = Date.now() - start;
      this.logger.warn({
        action: 'clickhouse_health_failed',
        duration_ms: duration,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HealthCheckError(
        'ClickHouse not reachable',
        this.getStatus(key, false, {
          duration_ms: duration,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
```

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/packages/analytics/src/services/clickhouse.service.spec.ts`

```typescript
// repo/packages/analytics/src/services/clickhouse.service.spec.ts
// Skalean InsurTech v2.2 -- Tests ClickHouseService Vitest
// Reference : B-13 Sprint 13 Tache 3.6.1
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ClickHouseService,
  CLICKHOUSE_CONFIG,
  ClickHouseConnectionError,
  ClickHouseQueryError,
  ClickHouseInsertError,
} from '../index';

const TEST_CONFIG = {
  url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
  username: 'default',
  password: '',
  database: 'skalean_analytics_test',
  requestTimeoutMs: 10000,
  maxOpenConnections: 5,
};

describe('ClickHouseService', () => {
  let module: TestingModule;
  let service: ClickHouseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ClickHouseService,
        { provide: CLICKHOUSE_CONFIG, useValue: TEST_CONFIG },
      ],
    }).compile();
    service = module.get(ClickHouseService);
    await service.onModuleInit();
    // Setup : creer database test
    await service.command(`CREATE DATABASE IF NOT EXISTS ${TEST_CONFIG.database}`);
  });

  afterAll(async () => {
    await service.command(`DROP DATABASE IF EXISTS ${TEST_CONFIG.database}`);
    await service.onModuleDestroy();
    await module.close();
  });

  describe('ping()', () => {
    it('should return true when ClickHouse is up', async () => {
      const ok = await service.ping();
      expect(ok).toBe(true);
    });
  });

  describe('query()', () => {
    it('should execute simple SELECT and return rows', async () => {
      const rows = await service.query<{ x: number }>({
        query: 'SELECT 1 AS x',
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].x).toBe(1);
    });

    it('should support query_params placeholders', async () => {
      const rows = await service.query<{ greeting: string }>({
        query: 'SELECT {greeting:String} AS greeting',
        query_params: { greeting: 'Bonjour' },
      });
      expect(rows[0].greeting).toBe('Bonjour');
    });

    it('should sanitize SQL injection via query_params', async () => {
      const malicious = "'; DROP TABLE x; --";
      const rows = await service.query<{ safe: string }>({
        query: 'SELECT {input:String} AS safe',
        query_params: { input: malicious },
      });
      expect(rows[0].safe).toBe(malicious);
    });

    it('should throw ClickHouseQueryError on invalid SQL', async () => {
      await expect(
        service.query({ query: 'SELECT FROM where invalid' }),
      ).rejects.toBeInstanceOf(ClickHouseQueryError);
    });

    it('should support multiple rows result', async () => {
      const rows = await service.query<{ n: number }>({
        query: 'SELECT number AS n FROM numbers(5)',
      });
      expect(rows).toHaveLength(5);
      expect(rows.map((r) => r.n)).toEqual([0, 1, 2, 3, 4]);
    });

    it('should support aggregate functions', async () => {
      const rows = await service.query<{ total: number }>({
        query: 'SELECT sum(number) AS total FROM numbers(101)',
      });
      expect(Number(rows[0].total)).toBe(5050);
    });

    it('should support typed numeric parameters', async () => {
      const rows = await service.query<{ y: number }>({
        query: 'SELECT {x:UInt32} * 2 AS y',
        query_params: { x: 21 },
      });
      expect(rows[0].y).toBe(42);
    });

    it('should support Date type parameters', async () => {
      const rows = await service.query<{ d: string }>({
        query: 'SELECT {d:Date} AS d',
        query_params: { d: '2026-05-15' },
      });
      expect(rows[0].d).toBe('2026-05-15');
    });

    it('should respect abort_signal', async () => {
      const controller = new AbortController();
      const promise = service.query({
        query: 'SELECT sleep(5)',
        abort_signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 100);
      await expect(promise).rejects.toThrow();
    });

    it('should support LowCardinality columns', async () => {
      await service.command(`
        CREATE TABLE IF NOT EXISTS ${TEST_CONFIG.database}.test_lowcard (
          id UInt32,
          status LowCardinality(String)
        ) ENGINE = MergeTree() ORDER BY id
      `);
      await service.insertBatch({
        table: `${TEST_CONFIG.database}.test_lowcard`,
        values: [
          { id: 1, status: 'active' },
          { id: 2, status: 'pending' },
          { id: 3, status: 'active' },
        ],
      });
      const rows = await service.query<{ status: string; cnt: number }>({
        query: `SELECT status, count() AS cnt FROM ${TEST_CONFIG.database}.test_lowcard GROUP BY status ORDER BY status`,
      });
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.status === 'active')?.cnt).toBeDefined();
    });
  });

  describe('insertBatch()', () => {
    beforeEach(async () => {
      await service.command(`DROP TABLE IF EXISTS ${TEST_CONFIG.database}.test_insert`);
      await service.command(`
        CREATE TABLE ${TEST_CONFIG.database}.test_insert (
          id UInt32, value String, amount Decimal64(2)
        ) ENGINE = MergeTree() ORDER BY id
      `);
    });

    it('should insert single row', async () => {
      const result = await service.insertBatch({
        table: `${TEST_CONFIG.database}.test_insert`,
        values: [{ id: 1, value: 'test', amount: '100.50' }],
      });
      expect(result.inserted).toBe(1);
    });

    it('should insert batch of 1000 rows efficiently', async () => {
      const values = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `val-${i}`,
        amount: (i * 1.5).toFixed(2),
      }));
      const start = Date.now();
      const result = await service.insertBatch({
        table: `${TEST_CONFIG.database}.test_insert`,
        values,
      });
      const duration = Date.now() - start;
      expect(result.inserted).toBe(1000);
      expect(duration).toBeLessThan(2000);
    });

    it('should return 0 inserted on empty values', async () => {
      const result = await service.insertBatch({
        table: `${TEST_CONFIG.database}.test_insert`,
        values: [],
      });
      expect(result.inserted).toBe(0);
    });

    it('should throw ClickHouseInsertError on invalid table', async () => {
      await expect(
        service.insertBatch({
          table: `${TEST_CONFIG.database}.nonexistent_table`,
          values: [{ id: 1, value: 'x' }],
        }),
      ).rejects.toBeInstanceOf(ClickHouseInsertError);
    });

    it('should handle Decimal types correctly', async () => {
      await service.insertBatch({
        table: `${TEST_CONFIG.database}.test_insert`,
        values: [
          { id: 1, value: 'a', amount: '99.99' },
          { id: 2, value: 'b', amount: '0.01' },
          { id: 3, value: 'c', amount: '123456789.50' },
        ],
      });
      const rows = await service.query<{ s: string }>({
        query: `SELECT sum(amount) AS s FROM ${TEST_CONFIG.database}.test_insert`,
      });
      expect(rows[0].s).toBe('123456889.50');
    });
  });

  describe('command()', () => {
    it('should execute CREATE TABLE DDL', async () => {
      await service.command(`
        CREATE TABLE IF NOT EXISTS ${TEST_CONFIG.database}.cmd_test (id UInt32)
        ENGINE = MergeTree() ORDER BY id
      `);
      await service.command(`DROP TABLE ${TEST_CONFIG.database}.cmd_test`);
    });

    it('should throw on invalid DDL', async () => {
      await expect(service.command('INVALID SQL')).rejects.toBeInstanceOf(ClickHouseQueryError);
    });
  });

  describe('multi-tenant pattern', () => {
    beforeEach(async () => {
      await service.command(`DROP TABLE IF EXISTS ${TEST_CONFIG.database}.test_tenant`);
      await service.command(`
        CREATE TABLE ${TEST_CONFIG.database}.test_tenant (
          tenant_id UUID, event_date Date, amount Decimal64(2)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(event_date)
        ORDER BY (tenant_id, event_date)
      `);
      const tenant1 = '11111111-1111-1111-1111-111111111111';
      const tenant2 = '22222222-2222-2222-2222-222222222222';
      await service.insertBatch({
        table: `${TEST_CONFIG.database}.test_tenant`,
        values: [
          { tenant_id: tenant1, event_date: '2026-01-15', amount: '100.00' },
          { tenant_id: tenant1, event_date: '2026-02-15', amount: '200.00' },
          { tenant_id: tenant2, event_date: '2026-01-15', amount: '50.00' },
        ],
      });
    });

    it('should filter rows by tenant_id', async () => {
      const tenant1 = '11111111-1111-1111-1111-111111111111';
      const rows = await service.query<{ total: string }>({
        query: `
          SELECT sum(amount) AS total FROM ${TEST_CONFIG.database}.test_tenant
          WHERE tenant_id = {tenantId:UUID}
        `,
        query_params: { tenantId: tenant1 },
      });
      expect(rows[0].total).toBe('300.00');
    });

    it('should isolate tenant queries (no leak)', async () => {
      const tenant2 = '22222222-2222-2222-2222-222222222222';
      const rows = await service.query<{ total: string }>({
        query: `
          SELECT sum(amount) AS total FROM ${TEST_CONFIG.database}.test_tenant
          WHERE tenant_id = {tenantId:UUID}
        `,
        query_params: { tenantId: tenant2 },
      });
      expect(rows[0].total).toBe('50.00');
    });
  });
});
```

### 7.2 Tests integration : `repo/infrastructure/scripts/__tests__/init-clickhouse.spec.ts`

```typescript
// repo/infrastructure/scripts/__tests__/init-clickhouse.spec.ts
// Skalean InsurTech v2.2 -- Tests init-clickhouse Vitest
// Reference : B-13 Sprint 13 Tache 3.6.1
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { seedDimDates } from '../init-clickhouse';

const TEST_DB = 'skalean_analytics_init_test';
const config = {
  url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
  username: 'default',
  password: '',
};

describe('init-clickhouse integration', () => {
  let client: ClickHouseClient;

  beforeAll(async () => {
    client = createClient(config);
    await client.command({ query: `DROP DATABASE IF EXISTS ${TEST_DB}` });
    await client.command({ query: `CREATE DATABASE ${TEST_DB}` });
    await client.command({
      query: `
        CREATE TABLE ${TEST_DB}.dim_dates (
          date Date,
          year UInt16,
          quarter UInt8,
          month UInt8,
          month_name LowCardinality(String),
          week_of_year UInt8,
          day_of_year UInt16,
          day_of_month UInt8,
          day_of_week UInt8,
          day_name LowCardinality(String),
          is_weekend UInt8,
          is_holiday_ma UInt8 DEFAULT 0,
          holiday_name_ma LowCardinality(String) DEFAULT '',
          fiscal_year UInt16,
          fiscal_quarter UInt8,
          fiscal_month UInt8,
          ramadan_year UInt8 DEFAULT 0,
          seed_at DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY date
      `,
    });
  });

  afterAll(async () => {
    await client.command({ query: `DROP DATABASE IF EXISTS ${TEST_DB}` });
    await client.close();
  });

  it('should seed exactly 1827 days (5 ans 2024-2028)', async () => {
    await seedDimDates(client, TEST_DB);
    const result = await client.query({
      query: `SELECT count() AS cnt FROM ${TEST_DB}.dim_dates`,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ cnt: string }>();
    expect(Number(rows[0].cnt)).toBe(1827);
  });

  it('should mark 2024-07-30 as holiday (Fete trone)', async () => {
    const result = await client.query({
      query: `SELECT is_holiday_ma, holiday_name_ma FROM ${TEST_DB}.dim_dates WHERE date = '2024-07-30'`,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ is_holiday_ma: number; holiday_name_ma: string }>();
    expect(rows[0].is_holiday_ma).toBe(1);
    expect(rows[0].holiday_name_ma).toBe('Fete trone');
  });

  it('should mark weekends correctly (samedi 2026-05-16)', async () => {
    const result = await client.query({
      query: `SELECT is_weekend, day_name FROM ${TEST_DB}.dim_dates WHERE date = '2026-05-16'`,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ is_weekend: number; day_name: string }>();
    expect(rows[0].is_weekend).toBe(1);
    expect(rows[0].day_name).toBe('Saturday');
  });

  it('should compute fiscal_year as civil year (MA convention)', async () => {
    const result = await client.query({
      query: `SELECT year, fiscal_year FROM ${TEST_DB}.dim_dates WHERE date = '2026-03-15'`,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ year: number; fiscal_year: number }>();
    expect(rows[0].year).toBe(2026);
    expect(rows[0].fiscal_year).toBe(2026);
  });

  it('should be idempotent (rerun does not duplicate)', async () => {
    await seedDimDates(client, TEST_DB);
    await seedDimDates(client, TEST_DB);
    const result = await client.query({
      query: `SELECT count() AS cnt FROM ${TEST_DB}.dim_dates`,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ cnt: string }>();
    expect(Number(rows[0].cnt)).toBe(1827);
  });

  it('should populate quarter correctly', async () => {
    const result = await client.query({
      query: `
        SELECT
          countIf(quarter = 1) AS q1,
          countIf(quarter = 2) AS q2,
          countIf(quarter = 3) AS q3,
          countIf(quarter = 4) AS q4
        FROM ${TEST_DB}.dim_dates
        WHERE year = 2026
      `,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ q1: string; q2: string; q3: string; q4: string }>();
    expect(Number(rows[0].q1)).toBe(90);
    expect(Number(rows[0].q2)).toBe(91);
    expect(Number(rows[0].q3)).toBe(92);
    expect(Number(rows[0].q4)).toBe(92);
  });
});
```

### 7.3 Tests structure schemas : `repo/infrastructure/scripts/__tests__/schemas.spec.ts`

```typescript
// repo/infrastructure/scripts/__tests__/schemas.spec.ts
// Skalean InsurTech v2.2 -- Tests structure schemas Vitest
// Reference : B-13 Sprint 13 Tache 3.6.1
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const SCHEMAS_DIR = resolve(__dirname, '../../clickhouse/schemas');

describe('ClickHouse schemas files', () => {
  it('should have 9 SQL files (00 to 08)', () => {
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.sql'));
    expect(files).toHaveLength(9);
  });

  it('should have all expected schema files', () => {
    const expected = [
      '00-database.sql',
      '01-fct_transactions.sql',
      '02-fct_journal_entries.sql',
      '03-fct_appointments.sql',
      '04-fct_messages.sql',
      '05-fct_documents_signed.sql',
      '06-dim_tenants.sql',
      '07-dim_customers.sql',
      '08-dim_dates.sql',
    ];
    for (const file of expected) {
      expect(existsSync(resolve(SCHEMAS_DIR, file))).toBe(true);
    }
  });

  it('all fct_* tables should use MergeTree and partition by toYYYYMM(event_date)', () => {
    const fctFiles = readdirSync(SCHEMAS_DIR).filter((f) => f.startsWith('0') && f.includes('fct_'));
    for (const file of fctFiles) {
      const content = readFileSync(resolve(SCHEMAS_DIR, file), 'utf-8');
      expect(content).toMatch(/ENGINE\s*=\s*MergeTree/);
      expect(content).toMatch(/PARTITION BY toYYYYMM\(event_date\)/);
      expect(content).toMatch(/ORDER BY \(tenant_id/);
    }
  });

  it('fct_transactions should have TTL 5 ans', () => {
    const content = readFileSync(resolve(SCHEMAS_DIR, '01-fct_transactions.sql'), 'utf-8');
    expect(content).toMatch(/TTL event_date \+ INTERVAL 5 YEAR/);
  });

  it('fct_journal_entries should have TTL 10 ans (legal DGI)', () => {
    const content = readFileSync(resolve(SCHEMAS_DIR, '02-fct_journal_entries.sql'), 'utf-8');
    expect(content).toMatch(/TTL event_date \+ INTERVAL 10 YEAR/);
  });

  it('fct_documents_signed should have TTL 10 ans (loi 53-05)', () => {
    const content = readFileSync(resolve(SCHEMAS_DIR, '05-fct_documents_signed.sql'), 'utf-8');
    expect(content).toMatch(/TTL event_date \+ INTERVAL 10 YEAR/);
  });

  it('dim_tenants and dim_customers should use ReplacingMergeTree', () => {
    for (const file of ['06-dim_tenants.sql', '07-dim_customers.sql']) {
      const content = readFileSync(resolve(SCHEMAS_DIR, file), 'utf-8');
      expect(content).toMatch(/ENGINE\s*=\s*ReplacingMergeTree/);
    }
  });

  it('should not contain any emoji (decision-006)', () => {
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.sql'));
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u;
    for (const file of files) {
      const content = readFileSync(resolve(SCHEMAS_DIR, file), 'utf-8');
      expect(content).not.toMatch(emojiRegex);
    }
  });

  it('all schemas should use IF NOT EXISTS for idempotency', () => {
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.sql') && !f.startsWith('00-'));
    for (const file of files) {
      const content = readFileSync(resolve(SCHEMAS_DIR, file), 'utf-8');
      expect(content).toMatch(/CREATE TABLE IF NOT EXISTS/);
    }
  });
});
```

---

## 8. Variables environnement

```env
# repo/.env.example (extrait Sprint 13 Tache 3.6.1)

# ClickHouse OLAP analytics (Sprint 13 -- B-13 Tache 3.6.1)
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=skalean_analytics
CLICKHOUSE_REQUEST_TIMEOUT_MS=30000
CLICKHOUSE_MAX_OPEN_CONNECTIONS=10

# Production additional (Atlas Cloud Benguerir)
# CLICKHOUSE_URL=https://analytics.skalean.ma:443
# CLICKHOUSE_PASSWORD=<secret-vault>
# CLICKHOUSE_READONLY_PASSWORD=<secret-vault>
# CLICKHOUSE_TLS_CA=/etc/ssl/atlas-ca.pem
```

Valeurs exemples par environnement :

| Variable | Dev | Staging | Production |
|----------|-----|---------|------------|
| CLICKHOUSE_URL | http://localhost:8123 | https://analytics-staging.skalean.ma | https://analytics.skalean.ma |
| CLICKHOUSE_USERNAME | default | api_user | api_user |
| CLICKHOUSE_PASSWORD | (empty) | (vault) | (vault) |
| CLICKHOUSE_DATABASE | skalean_analytics | skalean_analytics_staging | skalean_analytics |
| CLICKHOUSE_REQUEST_TIMEOUT_MS | 30000 | 30000 | 30000 |
| CLICKHOUSE_MAX_OPEN_CONNECTIONS | 10 | 30 | 50 |

---

## 9. Commandes shell

```bash
# Sequence complete a executer pour cette tache
cd repo

# 1. Installer les dependances du nouveau package analytics
pnpm install --filter @insurtech/analytics
pnpm install

# 2. Demarrer ClickHouse via docker-compose
docker compose up -d clickhouse
docker compose ps clickhouse                                                 # status=running, healthy

# 3. Attendre healthcheck OK
for i in {1..30}; do
  if curl -sf http://localhost:8123/ping > /dev/null; then
    echo "ClickHouse up after ${i}s"; break
  fi
  sleep 1
done

# 4. Executer le script d'initialisation
pnpm tsx infrastructure/scripts/init-clickhouse.ts
# Output attendu :
#   [init-clickhouse] url=http://localhost:8123 database=skalean_analytics reset=false
#   [init-clickhouse] ping OK
#   [init-clickhouse] loading 9 schema files
#   [init-clickhouse] executing 00-database.sql ...
#   ... (8 fichiers fct_*/dim_*) ...
#   [init-clickhouse] DDL complete. Seeding dim_dates...
#   [init-clickhouse] dim_dates : 1827 rows inserted
#   [init-clickhouse] dim_dates seeded.
#   [init-clickhouse] database "skalean_analytics" tables : [ 'dim_customers', 'dim_dates', 'dim_tenants',
#     'fct_appointments', 'fct_documents_signed', 'fct_journal_entries', 'fct_messages', 'fct_transactions' ]
#   [init-clickhouse] DONE.

# 5. Verifier manuellement les tables crees
curl -s "http://localhost:8123/?query=SHOW%20TABLES%20FROM%20skalean_analytics"
# Attendu :
#   dim_customers
#   dim_dates
#   dim_tenants
#   fct_appointments
#   fct_documents_signed
#   fct_journal_entries
#   fct_messages
#   fct_transactions

# 6. Verifier dim_dates seedee
curl -s "http://localhost:8123/?query=SELECT%20count()%20FROM%20skalean_analytics.dim_dates" 
# Attendu : 1827

# 7. Verifier jours feries MA
curl -s "http://localhost:8123/?query=SELECT%20date,holiday_name_ma%20FROM%20skalean_analytics.dim_dates%20WHERE%20is_holiday_ma=1%20ORDER%20BY%20date%20LIMIT%2010" 

# 8. Executer les tests unitaires + integration
pnpm --filter @insurtech/analytics test
pnpm --filter @insurtech/analytics test:coverage

# 9. Typecheck + lint
pnpm --filter @insurtech/analytics typecheck
pnpm --filter @insurtech/analytics lint

# 10. Verifier health endpoint API (apres registrer ClickHouseHealthIndicator)
pnpm --filter @insurtech/api dev &
sleep 5
curl -s http://localhost:4000/health
# Attendu : { "status": "ok", "info": { "clickhouse": { "status": "up", "duration_ms": <n> }, ... } }

# 11. Test reset complete (recreation)
pnpm tsx infrastructure/scripts/init-clickhouse.ts -- --reset
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (bloquants -- 16)

- **V1 (P0 -- automatisable)** : `docker compose up -d clickhouse` demarre le service avec status healthy en moins de 60 secondes.
  - Commande : `docker compose up -d clickhouse && for i in {1..60}; do docker compose ps clickhouse | grep -q healthy && break; sleep 1; done`
  - Expected : container `insurtech-clickhouse` status `healthy`
  - Failure mode : verifier ulimits, ports libres, volume permissions

- **V2 (P0)** : `curl -sf http://localhost:8123/ping` retourne `Ok.\n` HTTP 200.
  - Commande : `curl -sf http://localhost:8123/ping`
  - Expected : `Ok.`
  - Failure mode : service down ou port 8123 non expose

- **V3 (P0)** : `pnpm tsx infrastructure/scripts/init-clickhouse.ts` se termine sans erreur (exit 0).
  - Commande : `pnpm tsx infrastructure/scripts/init-clickhouse.ts; echo $?`
  - Expected : `0`
  - Failure mode : credentials, schema invalide, ClickHouse down

- **V4 (P0)** : 8 tables analytics existent dans `skalean_analytics`.
  - Commande : `curl -s "http://localhost:8123/?query=SELECT%20count()%20FROM%20system.tables%20WHERE%20database='skalean_analytics'"`
  - Expected : `8`
  - Failure mode : un fichier schema mal forme, ou DDL execute partiellement

- **V5 (P0)** : `dim_dates` contient exactement 1827 lignes (5 ans).
  - Commande : `curl -s "http://localhost:8123/?query=SELECT%20count()%20FROM%20skalean_analytics.dim_dates"`
  - Expected : `1827`
  - Failure mode : seed incomplet, ou bornes dates incorrectes

- **V6 (P0)** : Toutes les tables fct_* utilisent MergeTree + partition mensuelle + TTL.
  - Commande : `curl -s "http://localhost:8123/?query=SELECT%20name,engine,partition_key%20FROM%20system.tables%20WHERE%20database='skalean_analytics'%20AND%20name%20LIKE%20'fct_%25'"`
  - Expected : chaque ligne avec engine=MergeTree, partition_key incluant toYYYYMM
  - Failure mode : schema sql ne suit pas convention

- **V7 (P0)** : `ClickHouseService.ping()` retourne `true` apres init NestJS.
  - Test : `pnpm --filter @insurtech/analytics test -- clickhouse.service.spec.ts`
  - Expected : test `ping() should return true` PASS

- **V8 (P0)** : `ClickHouseService.query()` execute SELECT 1 et retourne row.
  - Test : test `should execute simple SELECT and return rows` PASS

- **V9 (P0)** : `ClickHouseService.query()` supporte query_params (anti-injection).
  - Test : test `should support query_params placeholders` PASS

- **V10 (P0)** : `ClickHouseService.insertBatch()` insere 1000 rows en moins de 2 secondes.
  - Test : test `should insert batch of 1000 rows efficiently` PASS

- **V11 (P0)** : Configuration Zod rejette `CLICKHOUSE_URL` invalide.
  - Test unitaire `loadClickHouseConfig` avec `url: 'not-url'` -> ZodError
  - Failure mode : Zod schema mal defini

- **V12 (P0)** : Multi-tenant isolation via tenant_id filter dans queries.
  - Test : test `should isolate tenant queries (no leak)` PASS

- **V13 (P0)** : `ClickHouseHealthIndicator` reporte status `up` sur `/health`.
  - Commande : `curl -s http://localhost:4000/health | jq '.info.clickhouse.status'`
  - Expected : `"up"`
  - Failure mode : health indicator non enregistre, ou ClickHouse down

- **V14 (P0)** : Aucune emoji dans aucun fichier livre (decision-006).
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/analytics/ repo/infrastructure/clickhouse/ repo/infrastructure/scripts/init-clickhouse.ts`
  - Expected : aucune sortie
  - Failure mode : nettoyer les fichiers concernes

- **V15 (P0)** : Aucun `console.log` ou `console.debug` dans code production.
  - Commande : `grep -rn "console\.log\|console\.debug" repo/packages/analytics/src/ | grep -v ".spec.ts"`
  - Expected : aucune sortie (init-clickhouse.ts a console.log autorise car script CLI)

- **V16 (P0)** : `pnpm --filter @insurtech/analytics typecheck` reussit (0 erreur).
  - Commande : `pnpm --filter @insurtech/analytics typecheck`
  - Expected : exit 0
  - Failure mode : tsconfig.json mal configure, ou typescript strict echec

### Criteres P1 (importants -- 8)

- **V17 (P1)** : Test idempotency : rejouer `init-clickhouse.ts` n'introduit pas de doublons dans dim_dates.
  - Test : test `should be idempotent (rerun does not duplicate)` PASS

- **V18 (P1)** : `init-clickhouse.ts -- --reset` drop + recree proprement.
  - Commande : `pnpm tsx infrastructure/scripts/init-clickhouse.ts -- --reset; echo $?`
  - Expected : exit 0, message DROP DATABASE log

- **V19 (P1)** : Skip indexes presentes sur fct_transactions (customer_id bloom_filter, provider set).
  - Commande : `curl -s "http://localhost:8123/?query=SELECT%20name%20FROM%20system.data_skipping_indices%20WHERE%20table='fct_transactions'"`
  - Expected : `idx_customer_id`, `idx_provider`, `idx_status`

- **V20 (P1)** : Coverage tests `@insurtech/analytics` >= 85%.
  - Commande : `pnpm --filter @insurtech/analytics test:coverage`
  - Expected : `Lines >= 85%, Branches >= 80%`

- **V21 (P1)** : Connection pool respecte `CLICKHOUSE_MAX_OPEN_CONNECTIONS=10`.
  - Test : 50 requetes concurrentes, verifier `system.processes` <= 10 simultaneous
  - Commande : `for i in {1..50}; do curl -s "http://localhost:8123/?query=SELECT%201" & done; wait`

- **V22 (P1)** : Jours feries MA sont correctement marques (`is_holiday_ma=1`) pour Fete trone 30 juillet.
  - Test : test `should mark 2024-07-30 as holiday (Fete trone)` PASS

- **V23 (P1)** : Weekends correctement detectes (`is_weekend=1` pour samedi/dimanche).
  - Test : test `should mark weekends correctly (samedi 2026-05-16)` PASS

- **V24 (P1)** : Decimal64(2) precision conservee dans insert/select (pas de perte de precision sur 2 decimales).
  - Test : test `should handle Decimal types correctly` PASS (sum 99.99 + 0.01 + 123456789.50 = 123456889.50)

### Criteres P2 (nice-to-have -- 4)

- **V25 (P2)** : Documentation `repo/packages/analytics/README.md` >= 150 lignes.
  - Commande : `wc -l repo/packages/analytics/README.md`
  - Expected : >= 150

- **V26 (P2)** : Cookbook `repo/docs/analytics/clickhouse-cookbook.md` documente >= 10 patterns.
  - Commande : `grep -c "^## " repo/docs/analytics/clickhouse-cookbook.md`
  - Expected : >= 10

- **V27 (P2)** : Schema fct_journal_entries TTL 10 ans (conformite DGI 9-88).
  - Commande : `grep "INTERVAL 10 YEAR" repo/infrastructure/clickhouse/schemas/02-fct_journal_entries.sql`
  - Expected : presence ligne

- **V28 (P2)** : Service expose `ClickHouseModule.forRootAsync` pour secrets manager Sprint 35.
  - Commande : `grep -n "forRootAsync" repo/packages/analytics/src/clickhouse.module.ts`
  - Expected : ligne presente

---

## 11. Edge cases + troubleshooting

### Edge case 1 : ClickHouse refuse de demarrer apres docker compose up (Permission denied volume)

**Scenario** : sur Linux developpeur recent (Ubuntu 24.04+), le user `clickhouse` du container (UID 101) ne peut pas ecrire dans le volume bind-mounted local.
**Probleme** : `clickhouse-server` log `cannot create directory /var/lib/clickhouse/store : Permission denied` et le container redemarre en boucle.
**Solution** : utiliser volume named (deja fait dans docker-compose.yml), ou si bind mount imperatif :
```bash
mkdir -p infrastructure/clickhouse/data
sudo chown -R 101:101 infrastructure/clickhouse/data
```

### Edge case 2 : Init script echec partiel (un schema SQL pete au milieu)

**Scenario** : sur reseau lent, le client `@clickhouse/client` timeout sur un schema (par ex. fct_transactions complexe) mais les precedents schemas sont deja crees.
**Probleme** : etat partiel. Rejouer le script saute les schemas existants (CREATE TABLE IF NOT EXISTS) mais ne complete pas dim_dates si interrompu en milieu.
**Solution** : la fonction `seedDimDates` fait `TRUNCATE TABLE IF EXISTS ${database}.dim_dates` avant insert, garantissant idempotency. Donc :
```bash
pnpm tsx infrastructure/scripts/init-clickhouse.ts                          # retry simple
# ou en cas de doute :
pnpm tsx infrastructure/scripts/init-clickhouse.ts -- --reset               # nettoyage complet
```

### Edge case 3 : Querry `query_params` avec UUID en string n'est pas reconnu

**Scenario** : passer `query_params: { tenantId: 'xxxxxxxx-xxxx-...' }` avec syntax `{tenantId:UUID}` echoue si UUID mal forme.
**Probleme** : ClickHouse rejette avec `Cannot parse UUID from string`.
**Solution** : valider l'UUID cote service AnalyticsService AVANT de l'envoyer a ClickHouse :
```typescript
import { z } from 'zod';
const UuidSchema = z.string().uuid();
const validatedId = UuidSchema.parse(tenantId);                            // throws ZodError si invalide
```

### Edge case 4 : Insert de 1M rows en une seule call

**Scenario** : tentative de pousser un batch trop gros via `insertBatch({ values: hugeArray })`.
**Probleme** : memoire heap Node V8 explose (default 4 GB), ou ClickHouse refuse pour cause `max_packet_size`.
**Solution** : chunking explicite dans Tache 3.6.2 ETL :
```typescript
const CHUNK = 1000;
for (let i = 0; i < hugeArray.length; i += CHUNK) {
  await this.ch.insertBatch({ table: 'fct_transactions', values: hugeArray.slice(i, i + CHUNK) });
}
```

### Edge case 5 : Container ClickHouse perdu apres reboot machine

**Scenario** : developpeur reboot son poste. Au redemarrage Docker, ClickHouse demarre mais les schemas semblent absent.
**Probleme** : confusion entre volume named (persiste) et `docker compose down -v` (drop volumes). Tant qu'on ne fait pas `-v`, les volumes named persistent.
**Solution** : verifier
```bash
docker volume ls | grep insurtech_clickhouse_data
docker compose up -d clickhouse                                            # redemarrage simple
curl -s "http://localhost:8123/?query=SHOW DATABASES"
```

### Edge case 6 : TLS error en production

**Scenario** : prod Atlas Cloud Benguerir, le driver `@clickhouse/client` echoue avec `Self-signed certificate`.
**Probleme** : reverse proxy nginx fronting ClickHouse utilise un cert Atlas qui n'est pas dans trust store Node.
**Solution** : Sprint 35 : configurer dans `ClickHouseConfig` :
```typescript
const config = {
  url: 'https://analytics.skalean.ma',
  tls: { ca: readFileSync('/etc/ssl/atlas-ca.pem') },
};
```

### Edge case 7 : Query timeout sur dashboard tres lourd

**Scenario** : query `SELECT * FROM fct_transactions WHERE event_date >= '2020-01-01'` (5 ans) sur 50M rows.
**Probleme** : timeout `CLICKHOUSE_REQUEST_TIMEOUT_MS=30000` (30 sec) depasse.
**Solution** : passer `abort_signal` + limiter explicitement :
```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 25000);
const rows = await this.ch.query({
  query: '... LIMIT 1000000',
  abort_signal: controller.signal,
});
clearTimeout(timer);
```
+ aggreger cote ClickHouse (sum, group by) plutot que pull rows.

### Edge case 8 : LowCardinality + UUID combination refusee

**Scenario** : tentative de declarer `customer_id LowCardinality(UUID)` dans un schema.
**Probleme** : ClickHouse refuse, types UUID ne sont pas LowCardinality-compatible.
**Solution** : si vraiment besoin (rare), serializer en `LowCardinality(String)`. Mais en general, UUID = haute cardinalite (millions de valeurs distinctes), inadapte LowCardinality. Garder `UUID` standard.

### Edge case 9 : Rejouer init-clickhouse en CI sans Docker

**Scenario** : CI Github Actions doit tester `seedDimDates` sans Docker available.
**Probleme** : pas d'instance ClickHouse a contacter.
**Solution** : utiliser GitHub Actions service container :
```yaml
# .github/workflows/test.yml
jobs:
  test:
    services:
      clickhouse:
        image: clickhouse/clickhouse-server:24.10-alpine
        ports:
          - 8123:8123
        options: --health-cmd "wget --spider -q http://localhost:8123/ping" --health-interval 5s
```

### Edge case 10 : Decimal overflow sur sum cumulee

**Scenario** : `SELECT sum(amount) FROM fct_transactions` retourne `Decimal overflow` apres 100M+ rows.
**Probleme** : `Decimal64(2)` capacite limitee.
**Solution** : cast a Decimal128 dans la query :
```sql
SELECT sum(toDecimal128(amount, 2)) FROM fct_transactions
```
ou utiliser `Float64` si precision moins critique (rapports execs vs comptabilite).

### Edge case 11 : Volume `clickhouse_logs` rempli

**Scenario** : apres 6 mois, le volume logs atteint 10 GB.
**Probleme** : disque local sature.
**Solution** : log rotation deja configuree dans `clickhouse-server.xml` (`<size>500M</size><count>5</count>`). Pour purger manuel :
```bash
docker compose exec clickhouse rm -f /var/log/clickhouse-server/*.log.[2-5].gz
```

---

## 12. Conformite Maroc detaillee

### Loi 09-08 du 18 fevrier 2009 (CNDP -- Protection donnees personnelles)
- **Article 3** : donnees personnelles identifiables -> `customer_email`, `customer_id`, `signer_email` dans `fct_*` sont concernees.
- **Article 7 (transfert hors Maroc INTERDIT sans autorisation CNDP)** : ClickHouse cluster prod = Atlas Cloud Benguerir DC1/DC2 (decision-008), aucun transfert externe.
- **Article 14 (droit a l'oubli)** : si demandes utilisateur, on a `ALTER TABLE fct_transactions DELETE WHERE customer_email = 'xxx@yyy.com'` (lent mais legal).
- **Implementation** : encryption at rest AES-256-GCM via Atlas KMS sur le volume `clickhouse_data` en prod.

### Loi 53-05 du 30 novembre 2007 (Signature electronique)
- **Article 9 (conservation 10 ans)** : `fct_documents_signed` TTL `INTERVAL 10 YEAR` strict.

### Loi 9-88 du 25 decembre 1992 modifiee par loi 38-14 (Obligations comptables)
- **Article 18 (conservation 10 ans pieces comptables)** : `fct_journal_entries` TTL `INTERVAL 10 YEAR` strict.
- **Pas d'altering ecritures** : ClickHouse engine append-only naturel respecte le principe d'intangibilite.

### Loi 17-95 amendee par loi 19-21 (Societes commerciales)
- **Article 162 (audit obligatoire CA > 50 MMAD)** : les dashboards analytics permettent aux commissaires aux comptes de produire les rapports d'audit conformes.

### Decret 2-08-518 (ACAPS reporting)
- **Annual solvency + quarterly portfolio** : Sprint 14+ ajoutera `fct_polices` + `fct_sinistres` sur lesquels reposera la production des rapports ACAPS Sprint 15.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter TOUTES ces conventions.

### Multi-tenant strict
- Toutes tables `fct_*` ont `tenant_id` dans ORDER BY (partition pruning + isolation logique).
- AnalyticsService Tache 3.6.3 imposera filtre `tenant_id = {tenantId:UUID}` sur chaque query.
- Pas de RLS ClickHouse (pas supporte) ; isolation enforced au service-layer.

### Validation strict
- Zod runtime pour `ClickHouseConfigSchema`, `ClickHouseQueryParams`, jamais class-validator.
- Schema Zod exporte depuis `@insurtech/shared-types` quand reutilisable.

### Logger strict
- Pino via NestJS Logger inject par DI. JAMAIS `console.log` dans code production.
- `init-clickhouse.ts` est un script CLI : `console.log` tolere mais avec format `[init-clickhouse] action message`.

### Hash password strict
- ClickHouse user `default` n'a pas de password en dev ; en prod, password via env var avec rotation 90 jours (Sprint 35).

### Package manager strict
- `pnpm` uniquement, `engine-strict=true`, versions exact (pas de ^/~).
- `@clickhouse/client@1.10.1` pin strict.

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`.
- Pas de `any` implicite, types complets pour parametres + retours.

### Tests strict
- Vitest unit + integration. Coverage >= 85% sur `@insurtech/analytics`.
- Tests integration necessitent ClickHouse local up.

### RBAC strict
- AnalyticsService Tache 3.6.3 +`@Roles('analytics.dashboards.read')` (Tache 3.6.4 controllers).

### Events strict
- Pas d'events Kafka emis par cette tache (purement infra). Tache 3.6.2 ETL emit `analytics.etl_completed`.

### Imports strict
- `@insurtech/analytics` package, importe via `import { ClickHouseService } from '@insurtech/analytics'`.
- Pas de chemins relatifs `../../packages/analytics/...`.

### Skalean AI strict (decision-005)
- Agent Sky utilise ClickHouse via MCP tools Sprint 31 (`get_revenue_trend`, etc.), JAMAIS direct.

### No-emoji strict (decision-006 ABSOLU)
- AUCUNE emoji dans schemas SQL, scripts, services, comments, README, cookbook.

### Idempotency-Key strict
- Pas applicable cette tache (pas d'endpoints mutations).

### Conventional Commits strict
- Format : `feat(sprint-13): ...` (voir section 15).

### Cloud souverain MA strict (decision-008)
- Production cluster ClickHouse = Atlas Cloud Benguerir DC1 + DC2 replication.
- Encryption AES-256-GCM at rest + TLS 1.3 en transit.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck strict
pnpm --filter @insurtech/analytics typecheck                                  # exit 0

# 2. Lint
pnpm --filter @insurtech/analytics lint                                       # 0 erreur

# 3. Tests unitaires + coverage >= 85%
pnpm --filter @insurtech/analytics test:coverage
# Expected : Lines >= 85%, Branches >= 80%

# 4. ClickHouse demarre
docker compose up -d clickhouse
for i in {1..30}; do docker compose ps clickhouse | grep -q healthy && break; sleep 1; done

# 5. Init reussit
pnpm tsx infrastructure/scripts/init-clickhouse.ts
[ $? -eq 0 ] || { echo "FAIL init-clickhouse"; exit 1; }

# 6. dim_dates contient 1827 lignes
COUNT=$(curl -s "http://localhost:8123/?query=SELECT%20count()%20FROM%20skalean_analytics.dim_dates")
[ "$COUNT" = "1827" ] || { echo "FAIL dim_dates count=$COUNT, expected 1827"; exit 1; }

# 7. No emoji check
EMOJI=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/analytics/ repo/infrastructure/clickhouse/ 2>/dev/null)
[ -z "$EMOJI" ] || { echo "FAIL emoji found: $EMOJI"; exit 1; }

# 8. No console.log dans production code
CONSOLE=$(grep -rn "console\.log\|console\.debug" repo/packages/analytics/src/ | grep -v ".spec.ts" || true)
[ -z "$CONSOLE" ] || { echo "FAIL console statements: $CONSOLE"; exit 1; }

# 9. Health endpoint OK
pnpm --filter @insurtech/api start:dev &
PID=$!
sleep 8
HEALTH=$(curl -s http://localhost:4000/health | jq -r '.info.clickhouse.status' 2>/dev/null || echo "")
kill $PID
[ "$HEALTH" = "up" ] || { echo "FAIL health=$HEALTH"; exit 1; }

echo "All pre-commit checks PASS"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-13): clickhouse setup + 8 schemas analytics + service NestJS

Sprint 13 Tache 3.6.1 : pose le socle infrastructure ClickHouse 24.10 OLAP
separe Postgres OLTP, charge 8 schemas (5 faits + 2 dims + 1 calendar),
livre @insurtech/analytics package + ClickHouseService singleton.

Livrables :
- docker-compose.yml service clickhouse 24.10-alpine port 8123/9000 healthcheck
- 9 schemas SQL : 00-database + 5 fct_* (transactions/journal/appointments/messages/docs)
  + 2 dim_* ReplacingMergeTree (tenants/customers) + dim_dates 1827 lignes seedees
- @insurtech/analytics package : ClickHouseService injectable + Zod config + custom errors
- init-clickhouse.ts script idempotent + dim_dates seed 5 ans (2024-2028) + holidays MA
- ClickHouseHealthIndicator Terminus integre /health endpoint
- 22 tests unitaires + 6 tests integration + 8 tests structure schemas
- Cookbook docs/analytics/clickhouse-cookbook.md (10+ patterns)

Conformite :
- Loi 09-08 CNDP : data Atlas Cloud Benguerir DC1/DC2 only (decision-008)
- Loi 9-88 art 18 : TTL fct_journal_entries = 10 ans
- Loi 53-05 art 9 : TTL fct_documents_signed = 10 ans

Tests: 36 (22 unit + 6 integration + 8 structure)
Coverage: 88%

Task: 3.6.1
Sprint: 13 (Phase 3 / Sprint 6 dans phase -- DERNIER Phase 3)
Phase: 3 -- Modules Horizontaux (Analytics + Stock + HR)
Reference: B-13 Tache 3.6.1"
```

---

## 16. Workflow next step

Apres commit de cette tache, lancer la suivante :
- **Tache 3.6.2** : `task-3.6.2-etl-postgres-to-clickhouse.md` (pipeline ETL polling 5min, idempotency ReplacingMergeTree, state tracking Redis/Postgres).

La Tache 3.6.2 consomme : `ClickHouseService.insertBatch`, schemas fct_* crees par cette tache 3.6.1.

---

**Fin du prompt task-3.6.1-clickhouse-setup-schemas-analytics.md.**

Densite atteinte : ~115 ko (estime).
Code patterns : 12 fichiers complets (docker-compose, 9 schemas SQL, config Zod, service, module, errors, types, index, init-clickhouse, health-indicator).
Tests : 36 cas concrets (22 unit + 6 integration + 8 structure).
Criteres validation : V1-V28 (16 P0 + 8 P1 + 4 P2).
Edge cases : 11.
