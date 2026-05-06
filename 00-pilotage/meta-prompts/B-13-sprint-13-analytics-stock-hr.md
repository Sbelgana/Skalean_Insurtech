# META-PROMPT B-13 -- SPRINT 13 ANALYTICS + STOCK + HR

**Version** : v2.2 (Option B)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 13 / 35 (cumul) -- DERNIER de la Phase 3
**Position** : Apres Books+Compliance, fin Phase 3
**Numerotation taches** : 3.6.1 a 3.6.14
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (analytics critiques pour pilotage tenants, stock+HR prepare Sprint 23)

---

## Objectif Global du Sprint

Implementer 3 modules horizontaux finaux : **Analytics** (ClickHouse OLAP separe + dashboards revenue/conversion/sinistre), **Stock** (pieces detachees garage avec valorisation FIFO + alertes), **HR** (employees garage : contrats + conges + paie simple). Sprint 13 termine la **Phase 3 -- 6 sprints horizontaux complete** : socle metier pret pour les verticaux Insure (Phase 4) et Repair (Phase 5).

A la sortie de ce sprint :
- ClickHouse cluster OLAP separe de Postgres OLTP (real-time analytics sans degrader API)
- ETL pipeline Postgres -> ClickHouse (Debezium CDC + Kafka Connect ou polling)
- 6 dashboards initiaux : Revenue / Conversion / Activity / Sinistre Rate / NPS / Funnel Tenant
- Stock module : items + mouvements (in/out/adjustment) + valorisation FIFO + alertes seuil
- HR module : employees + contrats + conges + bulletins paie simple (CNSS + AMO + IR)
- Endpoints REST + dashboards JSON
- Tests E2E avec fixtures
- Phase 3 (modules horizontaux) COMPLETE -> pret Phase 4 Vertical Insure

---

## Frontiere du Sprint

**INCLUS** :
- ClickHouse setup + schemas analytics
- ETL Postgres -> ClickHouse via Debezium ou polling
- 6 dashboards initiaux (revenue / conversion / activity / sinistre / NPS / funnel)
- Stock items + mouvements + valorisation FIFO
- Stock alertes seuil + notifications
- HR employees + contrats + conges + bulletins paie basique
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- Dashboards specifiques Insure (Sprint 14+)
- Dashboards specifiques Repair (Sprint 20+)
- IA-powered insights (Sprint 30+ defere)
- Stock advanced (lots, peremption, multi-warehouse) -- Phase 7+
- HR avance (formation, performance, recrutement) -- Phase 7+
- Paie complete avec liasses CNSS XML -- Phase 7+

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE3.sql` -- tables stock_*, hr_*, analytics_*
2. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles modules horizontaux
3. Sortie Sprint 11 : Pay events alimentent revenue analytics
4. Sortie Sprint 12 : Books journal entries -> P&L analytics

---

## Stack Imposee (Sprint 13)

| Composant | Version | Notes |
|-----------|---------|-------|
| ClickHouse | 24.10 | OLAP database |
| @clickhouse/client | 1.10.1 | NodeJS driver |
| Debezium | 2.7 | CDC Postgres -> Kafka (optionnel, alternative polling) |
| date-fns | 4.1.0 | manipulation periodes |
| decimal.js | 10.4.3 | precision (FIFO valorisation, paie) |

Variables env nouvelles : `CLICKHOUSE_URL`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`.

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 3.6.1 | ClickHouse setup docker-compose + schemas analytics | 5h | P0 | Sprint 12 |
| 3.6.2 | ETL pipeline Postgres -> ClickHouse (polling-based MVP) | 6h | P0 | 3.6.1 |
| 3.6.3 | AnalyticsService + queries dashboards | 5h | P0 | 3.6.2 |
| 3.6.4 | 6 dashboards endpoints (revenue, conversion, activity, sinistre, NPS, funnel) | 6h | P0 | 3.6.3 |
| 3.6.5 | Stock items entity + categories + valorisation FIFO | 5h | P0 | 3.6.4 |
| 3.6.6 | Stock mouvements entity + in/out/adjustment + impacts FIFO | 6h | P0 | 3.6.5 |
| 3.6.7 | Stock alertes seuil + notifications + reorder suggestions | 4h | P1 | 3.6.6 |
| 3.6.8 | Stock endpoints REST `/api/v1/stock/*` | 4h | P0 | 3.6.7 |
| 3.6.9 | HR employees entity + contrats (CDI/CDD/anapec) | 5h | P0 | 3.6.8 |
| 3.6.10 | HR conges entity + workflow approval + reglements RTT/conges payes | 5h | P0 | 3.6.9 |
| 3.6.11 | HR paie basique : bulletin + CNSS + AMO + IR + cotisations | 7h | P0 | 3.6.10 |
| 3.6.12 | HR endpoints REST `/api/v1/hr/*` + integration Books (charges salaire) | 5h | P0 | 3.6.11 |
| 3.6.13 | Cross-module : Stock+HR consume par Sprint 23 web-garage (preparation) | 4h | P0 | 3.6.12 |
| 3.6.14 | Tests E2E (35+) + fixtures realistes + Phase 3 closure | 8h | P0 | 3.6.13 |

**Total** : 75 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 3.6.1 -- ClickHouse Setup + Schemas Analytics

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 5h / Depend de Sprint 12

**But** : Ajouter ClickHouse au docker-compose + schemas analytics (tables denormalisees pour queries OLAP rapides).

**Contexte** : Postgres = OLTP optimise transactions (writes + reads simples). Analytics queries sur 1M+ rows = trop lent (full scans tables transactionnelles bloquent UI). ClickHouse = columnar OLAP : queries aggregations 100x plus rapides + isolation OLTP.

**Livrables checkables** :
- [ ] Update `docker-compose.yml` : ajouter service `clickhouse` (image `clickhouse/clickhouse-server:24.10-alpine`)
- [ ] Variables env : `CLICKHOUSE_URL=http://localhost:8123`, `CLICKHOUSE_USERNAME=default`, `CLICKHOUSE_PASSWORD=`, `CLICKHOUSE_DATABASE=skalean_analytics`
- [ ] Schemas tables analytics dans `repo/infrastructure/clickhouse/schemas/` :
  - `fct_transactions` (table de fait paiements -- denormalise pay_transactions + tenant + customer)
  - `fct_journal_entries` (faits comptables)
  - `fct_appointments` (faits booking)
  - `fct_messages` (faits comm)
  - `fct_documents_signed` (faits signatures)
  - `dim_tenants` (dimension tenants)
  - `dim_customers` (dimension contacts)
  - `dim_dates` (calendrier dates -- pre-rempli 5 ans)
- [ ] Engine ClickHouse : `MergeTree()` order by `(tenant_id, event_date)` -- partitions par mois
- [ ] TTL : 5 ans default (configurable per type)
- [ ] Indexes : skip indexes sur `tenant_id`, `customer_id` (facilitent partition pruning)
- [ ] Module NestJS `@insurtech/analytics` avec ClickHouseService
- [ ] Migration script : crée database + tables + dim_dates seed
- [ ] Tests : connexion CH OK, schemas crees, dim_dates rempli

**Pattern critique : table de fait fct_transactions**

```sql
-- repo/infrastructure/clickhouse/schemas/fct_transactions.sql
CREATE TABLE IF NOT EXISTS fct_transactions (
  -- Keys
  transaction_id UUID,
  tenant_id UUID,
  customer_email String,
  customer_id Nullable(UUID),

  -- Dimensions
  event_date Date,
  event_datetime DateTime,
  provider LowCardinality(String),       -- 6 values, dictionary encoded
  payment_method LowCardinality(String),
  status LowCardinality(String),
  currency LowCardinality(String),

  -- Measures
  amount Decimal64(2),
  fees_amount Decimal64(2),
  net_amount Decimal64(2),                -- amount - fees

  -- Metadata
  related_resource_type Nullable(String),
  related_resource_id Nullable(UUID),
  metadata String,                         -- JSON serialized

  -- Audit
  ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_datetime, transaction_id)
TTL event_date + INTERVAL 5 YEAR
SETTINGS index_granularity = 8192;
```

**Fichiers crees / modifies** :
```
repo/docker-compose.yml                                                       # update : add clickhouse service
repo/infrastructure/clickhouse/schemas/{8 sql files}                          # ~50 lignes chacun
repo/packages/analytics/src/services/clickhouse.service.ts                    # ~120 lignes
repo/packages/analytics/src/clickhouse.module.ts                               # module
repo/infrastructure/scripts/init-clickhouse.ts                                  # init script
repo/packages/analytics/package.json                                          # add : @clickhouse/client
```

**Notes implementation** :
- ClickHouse port 8123 (HTTP) + 9000 (native) -- HTTP suffit pour API
- LowCardinality : compression dict pour columns avec peu de valeurs distinctes
- Decimal64(2) : precision money (vs Float64)
- TTL 5 ans : balance volume vs analyses retro
- Partitions monthly : dropping old partitions = TTL implementation efficient
- Pas de UPDATE/DELETE classique ClickHouse : design append-only naturel

**Criteres validation** :
- V1 (P0) : ClickHouse demarre via docker-compose
- V2 (P0) : Tables analytics crees
- V3 (P0) : dim_dates rempli (5 ans)
- V4 (P0) : ClickHouseService ping OK
- V5 (P0) : TTL configure
- V6 (P0) : Tests connexion 5+ scenarios

---

## Tache 3.6.2 -- ETL Pipeline Postgres -> ClickHouse (Polling MVP)

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 6h / Depend de 3.6.1

**But** : Pipeline ETL alimentant ClickHouse depuis Postgres : polling-based pour MVP (simple), Debezium CDC en Phase 7+ (real-time).

**Contexte** : 2 strategies possibles :
- **Polling** : cron job lit Postgres delta + insert ClickHouse (simple, 5min latency acceptable)
- **CDC Debezium** : real-time stream Postgres WAL -> Kafka -> ClickHouse (complex, < 1s latency)

MVP = polling ; Phase 7+ migration vers Debezium si volumes le justifient.

**Livrables checkables** :
- [ ] Service `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
- [ ] Methods :
  - `syncTransactions(sinceTimestamp)` : SELECT pay_transactions WHERE updated_at > X -> INSERT fct_transactions
  - `syncJournalEntries(sinceTimestamp)` : equivalent books_journal_entries
  - `syncAppointments(sinceTimestamp)` : booking_appointments
  - `syncMessages(sinceTimestamp)` : comm_messages
  - `syncTenants()` : dim_tenants (full sync, low volume)
  - `syncCustomers(sinceTimestamp)` : dim_customers
- [ ] Cron job BullMQ : every 5 minutes
- [ ] State tracking : last sync timestamp per table dans Redis ou table `analytics_etl_state`
- [ ] Idempotency : ClickHouse `ReplacingMergeTree` engine OR delete-then-insert pattern
- [ ] Batch size 1000 rows per insert (perf optimal CH)
- [ ] Logs : duration + count rows synced
- [ ] Errors : rollback state si echec, retry next cycle
- [ ] Endpoint `POST /api/v1/admin/analytics/resync` (full resync sur demande -- super admin)
- [ ] Tests : ETL sync delta + idempotency + full resync

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                  # ~300 lignes
repo/packages/analytics/src/etl/etl-state.service.ts                            # ~80 lignes
repo/packages/analytics/src/jobs/etl-cron.job.ts                                # ~80 lignes
repo/packages/database/src/migrations/{date}-AnalyticsEtlState.ts               # state tracking
repo/apps/api/src/modules/admin/controllers/admin-analytics.controller.ts       # ~80 lignes
```

**Notes implementation** :
- Polling 5min : balance freshness vs DB load
- Idempotency via UPSERT-like pattern : delete by transaction_id + insert
- ReplacingMergeTree alternative : auto-dedup sur primary key au merge
- Sprint 14+ Insure ajoutera `fct_polices`, `fct_sinistres` -> meme pattern ETL extensible
- Migration future Debezium : pattern code stable, swap implementation interne

**Criteres validation** :
- V1 (P0) : Sync delta fonctionne
- V2 (P0) : Idempotency : 2 syncs same data -> 1 row CH
- V3 (P0) : State tracking : last_sync_timestamp persiste
- V4 (P0) : Cron 5min execute
- V5 (P0) : Batch 1000 perf OK
- V6 (P0) : Resync full force
- V7 (P0) : Tests 8+ scenarios

---

## Tache 3.6.3 -- AnalyticsService + Queries Dashboards

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 5h / Depend de 3.6.2

**But** : Service NestJS abstraction queries ClickHouse + cache + interface uniforme pour controllers dashboards.

**Livrables checkables** :
- [ ] Service `repo/packages/analytics/src/services/analytics.service.ts`
- [ ] Methods (queries reusable) :
  - `getRevenue(tenantId, dateRange, groupBy: 'day' | 'week' | 'month'): RevenuePoint[]`
  - `getConversionFunnel(tenantId, dateRange): FunnelStep[]`
  - `getTopCustomers(tenantId, dateRange, limit): TopCustomer[]`
  - `getActivityHeatmap(tenantId, dateRange): HeatmapPoint[]`
  - `getMessageStats(tenantId, dateRange): MessageStats`
  - `getSignedDocsStats(tenantId, dateRange): DocsStats`
- [ ] Cache Redis 5min sur queries (queries CH peuvent prendre 100-500ms)
- [ ] Filters tenant_id obligatoire (multi-tenant isolation)
- [ ] Logging structures : query duration + cache hit/miss
- [ ] Pattern queries optimisees : pre-aggregation (sum / count par jour) + materialized views CH (Phase 7+)
- [ ] Tests : queries retournent format correct, cache works, perf < 1s

**Pattern critique : query revenue avec ClickHouse**

```typescript
// repo/packages/analytics/src/services/analytics.service.ts
async getRevenue(
  tenantId: string,
  dateStart: Date,
  dateEnd: Date,
  groupBy: 'day' | 'week' | 'month',
): Promise<RevenuePoint[]> {
  const dateExpr = {
    day: 'toDate(event_date)',
    week: 'toMonday(event_date)',
    month: 'toStartOfMonth(event_date)',
  }[groupBy];

  const query = `
    SELECT
      ${dateExpr} AS period,
      count() AS transactions_count,
      sum(amount) AS gross_revenue,
      sum(fees_amount) AS total_fees,
      sum(net_amount) AS net_revenue,
      uniqExact(customer_email) AS unique_customers
    FROM fct_transactions
    WHERE tenant_id = {tenantId:UUID}
      AND status = 'captured'
      AND event_date >= {dateStart:Date}
      AND event_date <= {dateEnd:Date}
    GROUP BY period
    ORDER BY period ASC
  `;

  const result = await this.ch.query({
    query,
    query_params: { tenantId, dateStart: format(dateStart, 'yyyy-MM-dd'), dateEnd: format(dateEnd, 'yyyy-MM-dd') },
    format: 'JSONEachRow',
  });
  return result.json();
}
```

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/services/analytics.service.ts                     # ~300 lignes
repo/packages/analytics/src/services/analytics.service.spec.ts                # ~200 lignes
repo/packages/analytics/src/types/dashboards.ts                                # interfaces results
```

**Notes implementation** :
- ClickHouse query parameters : `{name:Type}` syntax, anti-injection
- `uniqExact` : count distinct exact (cher), `uniq` HyperLogLog approx (rapide)
- `toMonday`, `toStartOfMonth` : helpers CH built-in
- Cache key : `analytics:{method}:{hash(args)}` -> JSON 5min
- Materialized views CH : Phase 7+ pre-compute aggregates -> queries < 10ms

**Criteres validation** :
- V1 (P0) : getRevenue retourne points avec aggregates corrects
- V2 (P0) : groupBy day/week/month fonctionne
- V3 (P0) : Multi-tenant isolation (tenant_id filter)
- V4 (P0) : Cache hit 2eme call
- V5 (P0) : Performance < 1s sur fixtures realistes
- V6 (P0) : Tests 10+ scenarios

---

## Tache 3.6.4 -- 6 Dashboards Endpoints

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 6h / Depend de 3.6.3

**But** : 6 endpoints REST exposant dashboards initiaux + format response coherent (data + meta + filters).

**Livrables checkables** :
- [ ] Controller `repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts`
- [ ] Dashboards :
  1. `GET /api/v1/analytics/dashboards/revenue` -- revenue + transactions + customers
  2. `GET /api/v1/analytics/dashboards/conversion` -- funnel deals (lead -> qualified -> won) + taux conversion
  3. `GET /api/v1/analytics/dashboards/activity` -- volume CRM contacts/deals/interactions per period
  4. `GET /api/v1/analytics/dashboards/sinistre-rate` -- sinistre count + ratio (Sprint 14+ enrichira)
  5. `GET /api/v1/analytics/dashboards/nps` -- Net Promoter Score (Sprint 19 customer portal capture, Sprint 13 framework)
  6. `GET /api/v1/analytics/dashboards/funnel-tenant` -- onboarding tenant funnel (signup -> active -> renewal)
- [ ] Query params : `date_start`, `date_end`, `group_by` (day/week/month), `tenant_id` (super admin override sinon current)
- [ ] Response format standardise :
  ```json
  {
    "data": { "points": [...], "summary": {...} },
    "meta": { "filters": {...}, "generated_at": "...", "ttl_until": "..." }
  }
  ```
- [ ] Permissions : `analytics.dashboards.read`
- [ ] Tests : 6 endpoints + formats + multi-tenant + perf

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts      # ~250 lignes
repo/apps/api/src/modules/analytics/services/{several}.service.ts             # ~400 lignes (1 par dashboard)
repo/apps/api/test/analytics/dashboards.e2e-spec.ts                            # tests E2E
```

**Notes implementation** :
- Sprint 17 Web Broker UI consommera ces endpoints
- Format standardise pour facilier consumer
- TTL_until : permet client cache cote frontend
- 6 dashboards initiaux ; Sprint 14+ ajoutera dashboards specifiques verticaux

**Criteres validation** :
- V1 (P0) : 6 endpoints fonctionnent
- V2 (P0) : Format response coherent
- V3 (P0) : RBAC + multi-tenant
- V4 (P0) : Filters date_range + group_by
- V5 (P0) : Tests E2E 12+ scenarios

---

## Tache 3.6.5 -- Stock Items Entity + Categories + Valorisation FIFO

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 5h / Depend de 3.6.4

**But** : Module stock items (pieces detachees garage) avec categories + valorisation FIFO + integration future avec sinistres reparation.

**Contexte** : Garage manage stock pieces : filtres huile, plaquettes frein, pneus, etc. FIFO (First-In-First-Out) = methode valorisation comptable obligatoire MA. Permet calcul cout reel des pieces consommees + bilan precis.

**Livrables checkables** :
- [ ] Migration : tables `stock_categories`, `stock_items`, `stock_lots` :
  - `stock_categories` : id, tenant_id, name, parent_id, code (e.g. 'pneus', 'filtres')
  - `stock_items` : id, tenant_id, category_id, sku UNIQUE, name, description, unit (pcs/L/kg), reorder_threshold, ideal_stock, supplier_id (Sprint 14+ extensible), barcode, photo_url, active
  - `stock_lots` : id, item_id, lot_number, quantity_in (numeric), quantity_remaining (numeric), unit_cost (numeric 15,2), entry_date, supplier_invoice_ref, deleted_at
- [ ] Service `stock-items.service.ts` (CRUD)
- [ ] Service `stock-valorisation.service.ts` :
  - `getCurrentStock(itemId): { quantity, valorisation_fifo }` -- somme lots restants
  - `getValorisation(tenantId, atDate?): { items: [{ item, quantity, value }], total }` -- snapshot stock
- [ ] Endpoint `GET /api/v1/stock/items` (filtres : category, low_stock, search)
- [ ] Endpoint CRUD items + categories
- [ ] Photos upload (S3 Sprint 10 multi-tenant) -- `stock_items.photo_url`
- [ ] Permissions : `stock.items.create/read/update/delete`
- [ ] Tests : CRUD + valorisation FIFO calcul correct

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-StockTables.ts                  # ~80 lignes
repo/packages/stock/src/entities/{3 entities}.ts                              # ~150 lignes total
repo/packages/stock/src/services/stock-items.service.ts                       # ~200 lignes
repo/packages/stock/src/services/stock-valorisation.service.ts                # ~180 lignes (FIFO)
repo/apps/api/src/modules/stock/controllers/stock-items.controller.ts        # ~150 lignes
```

**Notes implementation** :
- FIFO : lots les plus anciens consommes premier (LIFO interdit MA en general)
- `quantity_remaining` <= `quantity_in` : decremente a chaque sortie (Tache 3.6.6)
- SKU UNIQUE per tenant : evite duplicates erreur saisie
- Categories hierarchy : parent_id (e.g. "Pneus" > "Pneus 4x4" > "Pneus 4x4 hiver")

**Criteres validation** :
- V1 (P0) : CRUD items
- V2 (P0) : SKU UNIQUE per tenant
- V3 (P0) : getCurrentStock retourne quantity + valorisation FIFO correct
- V4 (P0) : Categories hierarchy
- V5 (P0) : Photos upload S3
- V6 (P0) : Tests 8+ scenarios

---

## Tache 3.6.6 -- Stock Mouvements + Impacts FIFO

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 6h / Depend de 3.6.5

**But** : Migration table `stock_movements` + service tracking mouvements (in/out/adjustment) avec impacts auto sur lots FIFO.

**Livrables checkables** :
- [ ] Migration : table `stock_movements` :
  - id, tenant_id, item_id, lot_id (NULL si entry, set si exit), movement_type (enum 'entry' | 'exit' | 'adjustment' | 'transfer'), quantity (numeric), unit_cost (numeric, only entry), reason, related_resource_type/id (lien sinistre Sprint 22), occurred_at, created_by
- [ ] Service `stock-movements.service.ts` :
  - `recordEntry(itemId, quantity, unitCost, supplierInvoiceRef): Promise<StockLot>` -- create new lot + INSERT movement entry
  - `recordExit(itemId, quantity, reason, relatedResource): Promise<{ lots_consumed[] }>` -- FIFO logic : decrement oldest lots first
  - `recordAdjustment(itemId, deltaQuantity, reason): Promise<void>` -- correction inventaire
  - `findByItem(itemId, dateRange): Promise<StockMovement[]>` -- timeline mouvements
- [ ] FIFO logic exit :
  1. Get lots ordered by `entry_date ASC, id ASC` WHERE quantity_remaining > 0
  2. Iterate consumming lots until quantity satisfied
  3. INSERT movement per lot consumed
  4. UPDATE quantity_remaining lots
  5. Compute total_cost = sum(consumed_qty * lot_unit_cost)
- [ ] Validation : exit quantity > current stock = rejected (insufficient stock)
- [ ] Adjustment requires reason + permission `stock.adjust`
- [ ] Endpoints :
  - `POST /api/v1/stock/movements/entry` (achat/reception)
  - `POST /api/v1/stock/movements/exit` (consommation, sinistre)
  - `POST /api/v1/stock/movements/adjustment` (correction)
  - `GET /api/v1/stock/items/:id/movements` (timeline)
- [ ] Audit + Kafka events `stock.movement_recorded`
- [ ] Tests : FIFO calcul correct, insufficient stock reject, lots consumes correctement

**Pattern critique : FIFO exit logic**

```typescript
// repo/packages/stock/src/services/stock-movements.service.ts
async recordExit(
  itemId: string,
  quantity: Decimal,
  reason: string,
  relatedResource: { type: string; id: string } | null,
): Promise<{ totalCost: Decimal; lotsConsumed: Array<{ lotId: string; qty: Decimal; cost: Decimal }> }> {
  return this.dataSource.transaction(async (em) => {
    // Get available lots FIFO order
    const lots = await em.find(StockLot, {
      where: { item_id: itemId, quantity_remaining: MoreThan(0), deleted_at: IsNull() },
      order: { entry_date: 'ASC', id: 'ASC' },
    });

    let remainingToConsume = quantity;
    let totalCost = new Decimal(0);
    const lotsConsumed: Array<{ lotId: string; qty: Decimal; cost: Decimal }> = [];

    for (const lot of lots) {
      if (remainingToConsume.lte(0)) break;

      const lotRemaining = new Decimal(lot.quantity_remaining);
      const consumeFromLot = Decimal.min(remainingToConsume, lotRemaining);
      const lotCost = consumeFromLot.mul(lot.unit_cost);

      // INSERT movement
      await em.save(StockMovement, {
        tenant_id: getCurrentTenantId(),
        item_id: itemId,
        lot_id: lot.id,
        movement_type: 'exit',
        quantity: consumeFromLot.toNumber(),
        unit_cost: lot.unit_cost,
        reason,
        related_resource_type: relatedResource?.type,
        related_resource_id: relatedResource?.id,
        occurred_at: new Date(),
        created_by: getCurrentUserId(),
      });

      // UPDATE lot quantity_remaining
      await em.update(StockLot, lot.id, {
        quantity_remaining: lotRemaining.minus(consumeFromLot).toNumber(),
      });

      lotsConsumed.push({ lotId: lot.id, qty: consumeFromLot, cost: lotCost });
      totalCost = totalCost.plus(lotCost);
      remainingToConsume = remainingToConsume.minus(consumeFromLot);
    }

    if (remainingToConsume.gt(0)) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        item_id: itemId,
        requested: quantity.toString(),
        available: quantity.minus(remainingToConsume).toString(),
      });
    }

    await this.kafkaPublisher.publish(Topics.STOCK_MOVEMENT_RECORDED, { /* ... */ });
    return { totalCost, lotsConsumed };
  });
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-StockMovements.ts                # ~50 lignes
repo/packages/stock/src/entities/stock-movement.entity.ts                      # ~40 lignes
repo/packages/stock/src/services/stock-movements.service.ts                    # ~300 lignes
repo/apps/api/src/modules/stock/controllers/stock-movements.controller.ts     # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : recordEntry cree lot + movement
- V2 (P0) : recordExit FIFO consume oldest lots
- V3 (P0) : Insufficient stock reject 400
- V4 (P0) : Total cost calcul correct
- V5 (P0) : recordAdjustment update sans creer mouvement standard
- V6 (P0) : Audit + Kafka events
- V7 (P0) : Tests 12+ scenarios

---

## Tache 3.6.7 -- Stock Alertes Seuil + Notifications

**Metadonnees** : Phase 3 / Sprint 13 / P1 / 4h / Depend de 3.6.6

**But** : Service detection items sous reorder_threshold + alertes notifications + suggestions reorder.

**Livrables checkables** :
- [ ] Service `stock-alerts.service.ts` :
  - `findLowStockItems(tenantId): Promise<LowStockItem[]>` -- items where current_quantity < reorder_threshold
  - `suggestReorderQuantity(itemId): number` -- ideal_stock - current_quantity (basique MVP)
- [ ] Cron job daily : check low stock + envoie email super_admin tenant + chef garage
- [ ] Endpoint `GET /api/v1/stock/alerts/low-stock` (returns items + suggestions)
- [ ] Trigger after exit : si current < threshold -> Kafka event `stock.low_stock` -> notification real-time
- [ ] Phase 7+ : enrichi avec velocity/saisonalite (predictive)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/stock/src/services/stock-alerts.service.ts                       # ~150 lignes
repo/packages/stock/src/jobs/low-stock-cron.job.ts                              # ~60 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/low-stock-alert.hbs              # 3 templates
```

**Criteres validation** :
- V1 (P1) : findLowStockItems retourne items < threshold
- V2 (P1) : Cron daily envoie email
- V3 (P1) : Trigger after exit emit event
- V4 (P1) : Tests 5+ scenarios

---

## Tache 3.6.8 -- Stock Endpoints REST `/api/v1/stock/*`

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 4h / Depend de 3.6.7

**But** : Consolidation endpoints stock + integration avec autres modules.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Endpoint additionnels :
  - `GET /api/v1/stock/valorisation` (snapshot total per tenant)
  - `GET /api/v1/stock/reports/inventory?date=...` (inventaire complete)
  - `POST /api/v1/stock/inventory-count` (correction physique inventaire)
- [ ] Integration cross-module via Kafka :
  - Sprint 22 Repair sinistre : `repair.parts_consumed` event -> consume stock movement
  - Sprint 12 Books : entry stock -> ecriture comptable (stock 31xx + fournisseur 4411)
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/stock/controllers/{several}.ts                      # ~200 lignes
repo/packages/stock/src/consumers/repair-parts-consumed.consumer.ts            # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Endpoints CRUD operationnels
- V2 (P0) : Inventaire report OK
- V3 (P0) : Cross-module Kafka events fonctionnent
- V4 (P0) : Tests E2E 6+ scenarios

---

## Tache 3.6.9 -- HR Employees + Contrats

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 5h / Depend de 3.6.8

**But** : Module HR : entity employees + contrats (CDI/CDD/anapec) + dossier employe basique.

**Livrables checkables** :
- [ ] Migration : tables `hr_employees`, `hr_contracts` :
  - `hr_employees` : id, tenant_id, user_id (FK auth_users si compte system), full_name, cin, cnss_number, gender, date_of_birth, hired_date, department, position, base_salary (numeric), photo_url, active, terminated_date, termination_reason
  - `hr_contracts` : id, employee_id, contract_type (enum 'cdi' | 'cdd' | 'anapec' | 'stage'), start_date, end_date (NULL si CDI), monthly_salary, working_hours_week (default 44), trial_period_months, salary_components (jsonb : prime + indemnites), terms_pdf_id (FK doc_documents), status (enum 'active' | 'terminated' | 'expired')
- [ ] Service `employees.service.ts` (CRUD)
- [ ] Service `contracts.service.ts` (CRUD + transitions)
- [ ] Endpoints :
  - `POST /api/v1/hr/employees`
  - `GET /api/v1/hr/employees` (filtres : department, active)
  - `PATCH /api/v1/hr/employees/:id`
  - `POST /api/v1/hr/employees/:id/terminate`
  - `POST /api/v1/hr/employees/:id/contracts` (new contract)
  - `GET /api/v1/hr/employees/:id/contracts`
- [ ] Validation : CIN MA format, CNSS number format
- [ ] Permissions : `hr.employees.create/read/update/delete`
- [ ] Audit + Kafka events
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-HrEmployeesContracts.ts          # ~80 lignes
repo/packages/hr/src/entities/{2 entities}.ts                                  # ~80 lignes
repo/packages/hr/src/services/employees.service.ts                              # ~200 lignes
repo/packages/hr/src/services/contracts.service.ts                              # ~200 lignes
repo/apps/api/src/modules/hr/controllers/employees.controller.ts                # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : CRUD employees
- V2 (P0) : Contrats lies a employees
- V3 (P0) : CIN + CNSS format MA validate
- V4 (P0) : Termination workflow
- V5 (P0) : Multi-tenant + RBAC
- V6 (P0) : Tests 8+ scenarios

---

## Tache 3.6.10 -- HR Conges + Workflow Approval

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 5h / Depend de 3.6.9

**But** : Module conges : demandes employees + approval manager + balance reglements (conges payes 18j/an MA).

**Livrables checkables** :
- [ ] Migration : table `hr_leaves` :
  - id, employee_id, leave_type (enum 'paid' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'rtt'), start_date, end_date, days_count (numeric), reason, status (enum 'pending' | 'approved' | 'rejected' | 'cancelled'), requested_at, approved_by, approved_at, rejected_reason, certificate_doc_id (FK doc_documents pour arret maladie)
- [ ] Migration : table `hr_leave_balances` (computed) :
  - id, employee_id, year, paid_leave_balance (numeric, default 18), sick_leave_used, etc.
- [ ] Service `leaves.service.ts` :
  - `requestLeave(employeeId, type, startDate, endDate, reason)` -- valide balance + INSERT pending
  - `approveLeave(leaveId, approverId)` -- transition + decrement balance
  - `rejectLeave(leaveId, reason)`
  - `cancelLeave(leaveId)` -- avant approved
  - `getBalance(employeeId, year)`
- [ ] Conges payes MA : 18 jours/an minimum + 1.5j/mois travaille (loi)
- [ ] Workflow approval : super_admin OR manager (chef garage)
- [ ] Endpoints standards + workflow
- [ ] Notifications : email approval request + decision
- [ ] Permissions
- [ ] Tests : workflow + balance + types conges

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-HrLeaves.ts                       # ~50 lignes
repo/packages/hr/src/entities/{2 entities}.ts                                  # ~70 lignes
repo/packages/hr/src/services/leaves.service.ts                                 # ~250 lignes
repo/apps/api/src/modules/hr/controllers/leaves.controller.ts                   # ~150 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/leave-{request,approved,rejected}.hbs # templates
```

**Criteres validation** :
- V1 (P0) : Demande conges + balance check
- V2 (P0) : Approval transition + decrement balance
- V3 (P0) : Reject avec reason
- V4 (P0) : Cancel avant approved
- V5 (P0) : Notifications email envoyees
- V6 (P0) : Conges payes 18j/an MA
- V7 (P0) : Tests 10+ scenarios

---

## Tache 3.6.11 -- HR Paie Basique : Bulletin + CNSS + AMO + IR

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 7h / Depend de 3.6.10

**But** : Generation bulletins paie mensuel : salaire brut + cotisations CNSS + AMO + IR + cotisations diverses + net a payer.

**Contexte** : Paie MA : CNSS 4.48% employee + 8.98% employeur (plafond 6000 MAD), AMO 2.26% employee + 4.11% employeur, IR progressif (0% < 30k MAD/an, 10% / 20% / 30% / 34% / 38%), CIMR (retraite complementaire facultative). Sprint 13 = MVP simple ; Phase 7+ enrichira.

**Livrables checkables** :
- [ ] Migration : table `hr_payslips` :
  - id, employee_id, contract_id, period (text 'YYYY-MM'), gross_salary, cnss_employee, cnss_employer, amo_employee, amo_employer, ir_amount, other_deductions (jsonb), net_salary, payslip_pdf_id (FK doc_documents), status (enum 'draft' | 'validated' | 'paid'), created_at
- [ ] Service `payroll.service.ts` :
  - `generatePayslip(employeeId, period): Payslip` -- compute salaire + cotisations + IR
  - `validatePayslip(id)` -- transition draft -> validated + create journal entries (Sprint 12)
  - `markPaid(id, paymentRef)` -- transition validated -> paid + create payment journal
- [ ] Computations :
  - `computeCnss(grossSalary)` : 4.48% capped at 6000 MAD ceiling
  - `computeAmo(grossSalary)` : 2.26% no cap
  - `computeIr(grossAfterCnssAmo, familyExpenses)` : progressive scale MA
- [ ] Generation PDF bulletin (template `bulletin-paie.hbs` Sprint 10) avec layout standard MA
- [ ] Cron job : 25 du mois -> generate drafts payslips employees actifs
- [ ] Endpoints :
  - `POST /api/v1/hr/payroll/generate-period?period=2026-04` (super admin tenant)
  - `GET /api/v1/hr/payslips` (filters)
  - `POST /api/v1/hr/payslips/:id/validate`
  - `POST /api/v1/hr/payslips/:id/mark-paid`
  - `GET /api/v1/hr/payslips/:id/pdf`
- [ ] Permissions : `hr.payroll.generate`, `hr.payslips.read_own` (employee voit seulement les siens)
- [ ] Audit + Kafka events
- [ ] Tests : computations + workflow + multi-employee

**Pattern critique : computation paie MA**

```typescript
// repo/packages/hr/src/services/payroll-calculator.service.ts
import Decimal from 'decimal.js';

const CNSS_RATE_EMPLOYEE = new Decimal('0.0448');
const CNSS_CEILING = new Decimal('6000');         // MAD/mois
const AMO_RATE_EMPLOYEE = new Decimal('0.0226');

const IR_BRACKETS_MA = [
  { upTo: 30000,  rate: 0,    deduction: 0 },          // jusqu'a 30k MAD/an
  { upTo: 50000,  rate: 0.10, deduction: 3000 },        // 30k - 50k
  { upTo: 60000,  rate: 0.20, deduction: 8000 },        // 50k - 60k
  { upTo: 80000,  rate: 0.30, deduction: 14000 },       // 60k - 80k
  { upTo: 180000, rate: 0.34, deduction: 17200 },       // 80k - 180k
  { upTo: Infinity, rate: 0.38, deduction: 24400 },     // > 180k
];

computeCnss(grossMonthly: Decimal): Decimal {
  const base = Decimal.min(grossMonthly, CNSS_CEILING);
  return base.mul(CNSS_RATE_EMPLOYEE);
}

computeAmo(grossMonthly: Decimal): Decimal {
  return grossMonthly.mul(AMO_RATE_EMPLOYEE);
}

computeIr(grossAfterCnssAmo: Decimal, familyChildren: number = 0): Decimal {
  const annualBase = grossAfterCnssAmo.mul(12);
  // Trouver bracket
  for (const bracket of IR_BRACKETS_MA) {
    if (annualBase.lte(bracket.upTo)) {
      const annualIr = annualBase.mul(bracket.rate).minus(bracket.deduction);
      // Charges de famille : -360 MAD/an per child (max 6 enfants)
      const familyDeduction = Decimal.min(familyChildren, 6) * 360;
      return annualIr.minus(familyDeduction).div(12);
    }
  }
  return new Decimal(0);
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-HrPayslips.ts                    # ~50 lignes
repo/packages/hr/src/entities/hr-payslip.entity.ts                              # ~40 lignes
repo/packages/hr/src/services/payroll.service.ts                                # ~300 lignes
repo/packages/hr/src/services/payroll-calculator.service.ts                     # ~200 lignes
repo/packages/hr/src/services/payroll-calculator.service.spec.ts                # ~200 lignes (tests exhaustifs)
repo/packages/docs/src/templates/{fr}/bulletin-paie.hbs                          # PDF template
repo/apps/api/src/modules/hr/controllers/payroll.controller.ts                  # ~150 lignes
```

**Notes implementation** :
- Decimal.js critical : computations paie sensibles erreurs floating
- IR brackets MA : valeurs reglementaires actuelles (verifier loi finance annuelle)
- CNSS ceiling 6000 MAD/mois : cap reglementaire (au-dessus pas de cotisation supplementaire)
- Phase 7+ : enrichi (CIMR retraite, primes complexes, retenue source legale, etc.)
- Bulletin PDF format standard : exigence inspection travail
- Validate -> auto journal entries via Sprint 12 (charges salaires 6171 + cotisations 4441/4452/4456)

**Criteres validation** :
- V1 (P0) : computeCnss correct (cap 6000 MAD)
- V2 (P0) : computeAmo correct (no cap)
- V3 (P0) : computeIr correct sur 6 brackets
- V4 (P0) : Charges famille deduction
- V5 (P0) : generatePayslip retourne struct complete
- V6 (P0) : Cron 25 du mois
- V7 (P0) : Bulletin PDF lisible
- V8 (P0) : Validate -> journal entries
- V9 (P0) : Tests 15+ scenarios computations

---

## Tache 3.6.12 -- HR Endpoints + Integration Books

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 5h / Depend de 3.6.11

**But** : Consolidation endpoints HR + integration avec Books (charges salaire = ecritures comptables).

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Integration via Kafka events :
  - `hr.payslip_validated` -> Books ecriture : Charges 6171 (debit) / CNSS 4441 + AMO 4441 + IR 4452 + Banque 5141 (credits)
  - `hr.payslip_paid` -> Books ecriture paiement
- [ ] Endpoints reports :
  - `GET /api/v1/hr/reports/declaration-cnss?period=YYYY-MM` (preparation declaration CNSS mensuelle)
  - `GET /api/v1/hr/reports/declaration-ir?period=YYYY` (annual declaration)
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/hr/controllers/{several}.ts                          # ~150 lignes total
repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.ts            # ~150 lignes
repo/packages/hr/src/services/declarations.service.ts                            # ~150 lignes (CNSS + IR)
```

**Criteres validation** :
- V1 (P0) : Payslip validated -> ecriture cree
- V2 (P0) : Declaration CNSS retourne agregats
- V3 (P0) : Declaration IR annual
- V4 (P0) : Tests 6+ scenarios

---

## Tache 3.6.13 -- Cross-Module Stock+HR (Preparation Sprint 23)

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 4h / Depend de 3.6.12

**But** : Verifications integration cross-module + preparation pour Sprint 23 web-garage qui consume Stock+HR endpoints.

**Livrables checkables** :
- [ ] Documentation integration `repo/docs/integration/stock-hr-garage-flows.md` :
  - Flow garage : sinistre arrive -> assign technicien (HR employee) -> consume parts (Stock movements) -> reparation completee -> facturation (Books invoice)
- [ ] Verifications endpoints needed Sprint 23 disponibles
- [ ] Test integration end-to-end : create tenant Garage Atlas -> add 5 technicians (HR) -> add 50 stock items -> simulate consumption sinistre -> verify journal entries + stock decrement + employee assignment
- [ ] Performance : test queries dashboards avec 1000+ items + 50+ employees

**Fichiers crees / modifies** :
```
repo/docs/integration/stock-hr-garage-flows.md                                 # ~150 lignes
repo/apps/api/test/integration/garage-end-to-end.e2e-spec.ts                   # full flow integration test
```

**Criteres validation** :
- V1 (P0) : Documentation flows complete
- V2 (P0) : Test E2E garage flow passe
- V3 (P0) : Performance dashboards OK volumes realistes
- V4 (P0) : Endpoints Sprint 23 prerequis valides

---

## Tache 3.6.14 -- Tests E2E (35+) + Phase 3 Closure

**Metadonnees** : Phase 3 / Sprint 13 / P0 / 8h / Depend de 3.6.13

**But** : Suite tests E2E + fixtures realistes + closure officielle Phase 3.

**Livrables checkables** :

**Tests E2E (35+)** :
- [ ] ClickHouse : connexion + ETL sync + queries (5)
- [ ] 6 dashboards endpoints (6)
- [ ] Stock : CRUD items + movements + FIFO + alertes (10)
- [ ] HR employees + contrats + termination (4)
- [ ] HR conges : workflow + balance + types (5)
- [ ] HR paie : computations + workflow + bulletin (5)

**Fixtures realistes** :
- 100 stock items (categorise) + 500 movements + lots
- 10 employees per tenant + contrats + 30 conges historiques + 12 mois payslips

**Phase 3 closure** :
- [ ] Document `repo/docs/phase-3-completion.md` :
  - 6 sprints horizontaux livres : CRM+Booking / Comm WA+Email / Docs+Signature / Pay multi-MA / Books+Compliance / Analytics+Stock+HR
  - 87 taches detaillees Phase 3
  - 30+ entities operationnelles
  - 100+ endpoints REST
  - Conformite : loi 09-08, loi 43-20, ACAPS, CGNC, AMC, PCI-DSS, BAM rules
- [ ] Audit Phase 3 : runbook deploiement modules horizontaux

**Fichiers crees / modifies** :
```
repo/apps/api/test/{various}/{35+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-stock-hr.ts                                    # ~300 lignes
repo/docs/phase-3-completion.md                                                  # closure
```

**Criteres validation** :
- V1 (P0) : 35+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Fixtures realistes
- V4 (P0) : Documentation Phase 3 closure
- V5 (P0) : Reproducibility 5x runs

---

## Sortie du Sprint 13

A la fin de l'execution des 14 taches :

```
Analytics + Stock + HR operational :
  - ClickHouse cluster OLAP + ETL Postgres -> ClickHouse polling 5min
  - 6 dashboards initiaux (revenue / conversion / activity / sinistre / NPS / funnel)
  - Stock items + movements FIFO + alertes seuil
  - HR employees + contrats CDI/CDD/anapec
  - HR conges workflow approval + balance 18j/an MA
  - HR paie : bulletin + CNSS + AMO + IR + integration Books

Cross-module integrations :
  - Stock movements depuis sinistre repair (preparation Sprint 22)
  - HR payslip -> Books ecritures auto
  - Stock alertes -> notifications Comm

PHASE 3 COMPLETE : 6 sprints horizontaux livres
```

**PHASE 3 -- Modules Horizontaux : COMPLETE**

| Sprint | Module | Status |
|--------|--------|--------|
| B-08 | CRM + Booking | OK |
| B-09 | Comm WA + Email | OK |
| B-10 | Docs + Signature | OK |
| B-11 | Pay multi-passerelles MA | OK |
| B-12 | Books + Compliance ACAPS | OK |
| B-13 | Analytics + Stock + HR | OK |

**Sprint 14 (Phase 4 -- Vertical Insure Foundation) demarre avec** :
- Tous modules horizontaux ready as building blocks
- CRM contacts -> souscripteurs polices
- Pay -> primes paiements
- Books -> commissions courtier ecritures
- Docs -> polices PDF + signatures Barid
- Analytics -> dashboards Insure-specific
- Stock+HR pas utilise par Insure (utilise Repair Phase 5)

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-3.6.X-*.md` dans `00-pilotage/prompts-taches/sprint-13-analytics-stock-hr/`.

**Patterns code inline conserves** : table de fait fct_transactions ClickHouse, query revenue avec query parameters CH, FIFO exit logic transaction Postgres, computation paie MA brackets IR.

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE3.sql` couvre tables stock_*, hr_*, analytics_*.

---

**Fin du meta-prompt B-13 v2.2 format Option B.**
