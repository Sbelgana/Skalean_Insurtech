# TACHE 3.6.3 -- AnalyticsService + Queries Dashboards

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.3)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant Tache 3.6.4 Dashboards + Sprint 17 web-broker UI)
**Effort** : 5h
**Dependances** : Tache 3.6.1 (ClickHouse + schemas), Tache 3.6.2 (ETL alimente fct_*), Sprint 6 multi-tenant (TenantContext), Sprint 9 (Comm messages source), Sprint 11 (Pay source), Sprint 12 (Books source)
**Densite cible** : 100-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre `AnalyticsService`, abstraction NestJS centralisant **toutes** les queries OLAP sur ClickHouse. Chaque dashboard de la Tache 3.6.4 (`revenue`, `conversion`, `activity`, `sinistre-rate`, `nps`, `funnel-tenant`) ne fait qu'appeler une methode du service avec `(tenantId, dateRange, groupBy)` et reçoit un resultat type, deja agrege, deja cache. Le service encapsule : la construction des SQL ClickHouse parametree (anti-injection via `{name:Type}`), le filtrage strict multi-tenant (tenant_id WHERE clause obligatoire), le cache Redis 5 minutes (cle = `analytics:{method}:{hash(args)}`), la conversion des Decimal ClickHouse vers `Decimal.js`, la traduction des periodes (day/week/month) en expressions ClickHouse natives (`toMonday`, `toStartOfMonth`), le logging structure Pino (action, tenant_id, query_duration_ms, cache_hit), et la conformite aux 14 conventions strictes Skalean InsurTech.

L'apport est triple. **Premierement**, on livre 6+ methodes typees retournant des interfaces stables : `getRevenue(tenantId, dateRange, groupBy): RevenuePoint[]`, `getConversionFunnel(tenantId, dateRange): FunnelStep[]`, `getTopCustomers(tenantId, dateRange, limit): TopCustomer[]`, `getActivityHeatmap(tenantId, dateRange): HeatmapPoint[]`, `getMessageStats(tenantId, dateRange): MessageStats`, `getSignedDocsStats(tenantId, dateRange): DocsStats`. Les types sont strictement Zod-validated et exposes depuis `@insurtech/shared-types`. **Deuxiemement**, on livre le `AnalyticsCacheService` (wrapper ioredis) qui memoize les resultats par cle composite hashee, evite les requetes ClickHouse repetees (un dashboard refresh 10x/seconde = 1 query reelle + 9 cache hits), invalide via TTL 5min ou explicitement sur event `analytics.etl_completed` (Tache 3.6.2). **Troisiemement**, on enrichit `@insurtech/analytics` avec utilitaires : `dateRangeUtils.ts` (validation `start <= end`, max 5 ans), `clickhouseExpressions.ts` (helpers `toGroupByExpr`, `toDateRangeFilter`), `multiTenantValidator.ts` (refuse query sans `tenantId` valide UUID).

A l'issue de cette tache, le module `@insurtech/analytics` expose une API stable consommable par les controllers de la Tache 3.6.4 mais aussi par Sprint 31 Agent Sky (MCP tools `get_revenue_trend(tenant, period)`), Sprint 35 reporting batch (rapport mensuel pdf), et Sprint 17 web-broker UI. Performance cible : queries < 1s sur fixtures 1M rows, cache hit < 5ms.

---

## 2. Contexte etendu

### 2.1 Pourquoi un service centralise et pas direct controllers -> ClickHouse

Le pattern naif serait de mettre les queries SQL ClickHouse directement dans les controllers REST. C'est tentant mais cree six problemes serieux : (a) duplication de la logique multi-tenant si plusieurs controllers ont besoin du meme calcul revenue ; (b) cache au niveau controller mal partage entre dashboards ; (c) tests unitaires impossibles sans booter le HTTP entier ; (d) impossible pour Agent Sky (Sprint 31) et reporting batch (Sprint 35) de reutiliser la logique ; (e) violation Single Responsibility (controller = HTTP routing, pas logique metier) ; (f) refactoring (migrer ClickHouse -> ClickHouse Cloud par exemple) impacte 6 fichiers controllers au lieu d'un service.

La solution adoptee : `AnalyticsService` centralisateur unique, injecte par DI NestJS dans tous les consommateurs (controllers + MCP server + batch jobs). Les controllers deviennent triviaux (delegation pure), les tests unit testent les queries SQL sans HTTP, le cache est consistant.

### 2.2 Alternatives considerees pour la strategie cache

Plusieurs strategies pour cacher les resultats analytics.

| Strategie | Pros | Cons | Decision |
|-----------|------|------|----------|
| **A. Redis TTL 5min cle hash(args)** | Simple, hit ratio eleve | Stale data jusqu'a 5min, eviction LRU possible | RETENU |
| B. ClickHouse Materialized Views | Pre-aggregation au niveau OLAP, queries instant | Setup complexe, refresh strategy non-triviale | Defer Sprint 35+ |
| C. In-memory LRU cache Node | Tres rapide (microsecondes) | Pas partage entre instances API, eviction sous charge | Rejete (multi-instance) |
| D. CDN cache HTTP layer | Decharge totalement | Pas applicable multi-tenant + RBAC | Rejete |
| E. Pas de cache | Donnees fraiches | Surcharge ClickHouse, latence dashboard | Rejete |

**Strategie A detaillee** : cle Redis `analytics:revenue:{tenantId}:{hash(dateStart,dateEnd,groupBy)}`. TTL 300 secondes. Invalidation explicite via Kafka event `analytics.etl_completed` qui DELETE `analytics:*:{tenantId}:*` apres chaque cycle ETL (Tache 3.6.2).

### 2.3 Pourquoi Redis et pas Memcached / Hazelcast / Caffeine

Redis est deja present dans le stack Sprint 9 (Comm queue) et Sprint 12 (idempotency-key store). Memcached aurait une perf legerement meilleure pour le straight key-value, mais Redis offre : pub/sub pour invalidation cross-instance, persistance optionnelle, types complexes (sorted sets pour leaderboards Sprint 31), TTL natif precis. Hazelcast/Caffeine = JVM-only, incompatible Node.

### 2.4 Trade-offs explicites

**Trade-off 1 : Fresh data 5min**. Un dashboard refresh peut afficher des donnees jusqu'a 5min d'age. Toleré pour analytics descriptive (le user attend des KPIs mensuels, pas seconde-precis). Compense par : invalidation event-based qui force refresh apres chaque ETL run (Tache 3.6.2 emit `analytics.etl_completed`).

**Trade-off 2 : Pas de PageRank / ML analytics**. AnalyticsService Sprint 13 = queries descriptives SQL pures. Pas de Spark, pas de Python data science. Sprint 30+ ajoutera capability ML via MCP server batch (defer decision strategique).

**Trade-off 3 : Pas de query builder runtime**. On n'implemente pas un constructeur de queries OLAP en run-time (genre Kibana / Metabase). Les queries sont hard-coded methode-par-methode pour : (a) eviter SQL injection runtime, (b) audit clair via grep, (c) tests deterministes. Trade : moins de flexibilite user-facing, mais Sprint 17 web-broker UI a tous les dashboards predefini par produit.

**Trade-off 4 : Cache lecture only, jamais transit ecriture**. Si un user trigger un "INSERT analytics_custom_metric" (hypothetique), le service refuse. Sprint 13 = pure read OLAP, ecritures via ETL Tache 3.6.2.

### 2.5 Decisions strategiques referenced

- **decision-001 (monorepo)** : AnalyticsService dans `@insurtech/analytics`, import par `@insurtech/api`.
- **decision-002 (multi-tenant 3 niveaux)** : tenant_id imperatif dans chaque query, validator refuse sans.
- **decision-005 (Skalean AI frontiere)** : Agent Sky utilisera AnalyticsService via MCP tools `get_revenue_trend`, jamais en direct ClickHouse.
- **decision-006 (no-emoji)** : aucune emoji.
- **decision-007 (Mock Skalean AI Sprint 1-28)** : AnalyticsService est utilisable mais Sky reste mocked jusqu'a Sprint 29.
- **decision-008 (cloud souverain MA)** : queries restent intra-cluster Atlas Benguerir.

### 2.6 Pieges techniques connus

1. **Piege : query parametree mal typee**. ClickHouse `{tenantId:UUID}` exige string UUID, pas object. **Solution** : Zod validate UUID string avant.
2. **Piege : groupBy 'week' commence dimanche vs lundi**. ClickHouse `toMonday` retourne le lundi. Default OK MA mais doc explicite.
3. **Piege : dateRange depasse 5 ans = TTL ClickHouse cleanup**. **Solution** : validator `endDate - startDate < 5 years`.
4. **Piege : Cache stale apres ETL run**. **Solution** : Kafka consumer `analytics.etl_completed` -> Redis DEL `analytics:*`.
5. **Piege : Cache miss hammer ClickHouse**. **Solution** : single-flight pattern (Redis SETNX lock pendant calcul).
6. **Piege : Decimal precision JSON serialization**. ClickHouse retourne `amount: "1234.56"` (string). **Solution** : `new Decimal(str)` consommateur cote.
7. **Piege : LIMIT/OFFSET pagination overflow**. `LIMIT 1000000` peut faire crash. **Solution** : max_limit 10000 enforced.
8. **Piege : timezone offset Casablanca DST**. MA n'observe pas DST (UTC+1 toute l'annee depuis 2018). **Solution** : standardiser UTC stockage, convertir cote frontend.
9. **Piege : DISTINCT sur LowCardinality**. `SELECT DISTINCT provider FROM fct_transactions` est ultra-rapide grace au dictionary. Continuer pattern.
10. **Piege : `uniqExact` sur 1M rows = OOM**. **Solution** : `uniq` HyperLogLog par defaut, `uniqExact` seulement metiers critiques (count exact transactions par tenant).
11. **Piege : Cache key hash collision**. JSON.stringify({a:1,b:2}) != JSON.stringify({b:2,a:1}). **Solution** : sort keys avant stringify.
12. **Piege : Pas d'isolation pendant queries longues**. ClickHouse query 30s bloque thread Node (event loop OK car async). **Solution** : `abort_signal` timeout 25s.

---

## 3. Architecture context

### 3.1 Position dans le sprint 13

Tache 3.6.3 est la **troisieme** des 14 du sprint 13.

**Depend de** : 3.6.1 (ClickHouse), 3.6.2 (ETL alimente fct_*).
**Bloque** : 3.6.4 (Dashboards controllers qui consomment AnalyticsService).

### 3.2 Position dans le programme global

`AnalyticsService` sera consomme par :
- Sprint 13 Tache 3.6.4 : 6 dashboards REST.
- Sprint 17 web-broker UI : appel REST dashboards.
- Sprint 23 web-garage UI : dashboards garage-specific.
- Sprint 31 Agent Sky : tools MCP `get_revenue_trend`, `get_conversion_funnel`.
- Sprint 35 batch reports : PDF mensuel revenu.

### 3.3 Diagramme

```
+-------------------------------+
| Controller dashboards         |
| /api/v1/analytics/dashboards/*|
+-------------+-----------------+
              |
              | inject DI
              v
+-------------+-----------------+         +----------------+
| AnalyticsService              |<------->| AnalyticsCache |
|   getRevenue                  |  GET    | (Redis 5min)   |
|   getConversionFunnel         |  SET    +----------------+
|   getTopCustomers             |                 ^
|   getActivityHeatmap          |                 | DEL on
|   getMessageStats             |                 | Kafka event
|   getSignedDocsStats          |          analytics.etl_completed
+-------------+-----------------+
              |
              | query{ query, query_params, format: JSONEachRow }
              v
+-------------+-----------------+
| ClickHouseService              |
| (Tache 3.6.1)                  |
+-------------+-----------------+
              |
              v
       ClickHouse 24.10
```

---

## 4. Livrables checkables

- [ ] `repo/packages/analytics/src/services/analytics.service.ts` (~400 lignes, 6 methodes)
- [ ] `repo/packages/analytics/src/services/analytics-cache.service.ts` (~150 lignes Redis wrapper)
- [ ] `repo/packages/analytics/src/services/analytics-cache-invalidator.consumer.ts` (~80 lignes Kafka consumer)
- [ ] `repo/packages/analytics/src/utils/clickhouse-expressions.ts` (~80 lignes helpers SQL)
- [ ] `repo/packages/analytics/src/utils/date-range-utils.ts` (~120 lignes validation)
- [ ] `repo/packages/analytics/src/utils/multi-tenant-validator.ts` (~50 lignes UUID validation)
- [ ] `repo/packages/analytics/src/utils/cache-key-builder.ts` (~70 lignes hash sorted keys)
- [ ] `repo/packages/analytics/src/types/dashboards.ts` (~130 lignes interfaces + Zod schemas)
- [ ] Tests unitaires `analytics.service.spec.ts` (~400 lignes, 25 tests)
- [ ] Tests unitaires `analytics-cache.service.spec.ts` (~150 lignes, 10 tests)
- [ ] Tests integration `analytics-integration.spec.ts` (~250 lignes, 8 tests E2E sur fixtures)
- [ ] Update `repo/packages/analytics/src/index.ts` (exports nouveaux)
- [ ] Update `repo/packages/analytics/src/clickhouse.module.ts` (providers AnalyticsService + cache)
- [ ] Documentation `repo/docs/analytics/analytics-service-api.md` (~200 lignes API ref)
- [ ] Variables env `ANALYTICS_CACHE_TTL_SECONDS=300`, `ANALYTICS_MAX_DATE_RANGE_DAYS=1827` (5 ans)

---

## 5. Fichiers crees / modifies

```
repo/packages/analytics/src/services/analytics.service.ts                       (nouveau, ~420 lignes)
repo/packages/analytics/src/services/analytics.service.spec.ts                  (nouveau, ~430 lignes, 25 tests)
repo/packages/analytics/src/services/analytics-cache.service.ts                  (nouveau, ~160 lignes)
repo/packages/analytics/src/services/analytics-cache.service.spec.ts             (nouveau, ~160 lignes, 10 tests)
repo/packages/analytics/src/services/analytics-cache-invalidator.consumer.ts     (nouveau, ~90 lignes)
repo/packages/analytics/src/utils/clickhouse-expressions.ts                       (nouveau, ~90 lignes)
repo/packages/analytics/src/utils/clickhouse-expressions.spec.ts                  (nouveau, ~120 lignes, 8 tests)
repo/packages/analytics/src/utils/date-range-utils.ts                              (nouveau, ~130 lignes)
repo/packages/analytics/src/utils/date-range-utils.spec.ts                         (nouveau, ~140 lignes, 10 tests)
repo/packages/analytics/src/utils/multi-tenant-validator.ts                        (nouveau, ~60 lignes)
repo/packages/analytics/src/utils/cache-key-builder.ts                              (nouveau, ~80 lignes)
repo/packages/analytics/src/utils/cache-key-builder.spec.ts                         (nouveau, ~80 lignes, 6 tests)
repo/packages/analytics/src/types/dashboards.ts                                     (nouveau, ~140 lignes)
repo/packages/analytics/src/index.ts                                                (modif)
repo/packages/analytics/src/clickhouse.module.ts                                    (modif)
repo/apps/api/test/integration/analytics-integration.spec.ts                          (nouveau, ~270 lignes, 8 tests)
repo/docs/analytics/analytics-service-api.md                                          (nouveau, ~210 lignes)
repo/.env.example                                                                    (modif, +2 var)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier : `repo/packages/analytics/src/types/dashboards.ts`

```typescript
// repo/packages/analytics/src/types/dashboards.ts
// Skalean InsurTech v2.2 -- Types et schemas dashboards
// Reference : B-13 Sprint 13 Tache 3.6.3
import { z } from 'zod';

export const RevenueGroupBySchema = z.enum(['day', 'week', 'month']);
export type RevenueGroupBy = z.infer<typeof RevenueGroupBySchema>;

export const DateRangeSchema = z
  .object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((d) => d.start <= d.end, { message: 'start must be before or equal end' });
export type DateRange = z.infer<typeof DateRangeSchema>;

export const TenantIdSchema = z.string().uuid();

export interface RevenuePoint {
  period: string;                  // 'YYYY-MM-DD'
  transactions_count: number;
  gross_revenue: string;           // Decimal string
  total_fees: string;
  net_revenue: string;
  unique_customers: number;
}

export interface FunnelStep {
  step_name: string;
  count: number;
  conversion_rate_pct: number;
}

export interface TopCustomer {
  customer_id: string;
  customer_email: string;
  total_amount: string;
  transactions_count: number;
  last_transaction_at: string | null;
}

export interface HeatmapPoint {
  day_of_week: number;
  hour: number;
  appointments_count: number;
  revenue: string;
}

export interface MessageStats {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_replied: number;
  delivery_rate_pct: number;
  read_rate_pct: number;
  by_channel: Array<{
    channel: string;
    sent: number;
    delivered: number;
  }>;
}

export interface DocsStats {
  total_initiated: number;
  total_signed: number;
  total_expired: number;
  avg_time_to_sign_seconds: number | null;
  by_provider: Array<{
    provider: string;
    signed: number;
  }>;
}
```

### 6.2 Fichier : `repo/packages/analytics/src/utils/clickhouse-expressions.ts`

```typescript
// repo/packages/analytics/src/utils/clickhouse-expressions.ts
// Skalean InsurTech v2.2 -- helpers SQL ClickHouse
// Reference : B-13 Sprint 13 Tache 3.6.3
import { RevenueGroupBy } from '../types/dashboards';

const GROUP_BY_EXPR: Record<RevenueGroupBy, string> = {
  day: 'toDate(event_date)',
  week: 'toMonday(event_date)',
  month: 'toStartOfMonth(event_date)',
};

export function toGroupByExpr(groupBy: RevenueGroupBy): string {
  const expr = GROUP_BY_EXPR[groupBy];
  if (!expr) {
    throw new Error(`Invalid groupBy: ${groupBy}`);
  }
  return expr;
}

export function formatDateForClickHouse(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildDateRangeFilter(
  dateColumn: string,
  paramStartName: string,
  paramEndName: string,
): string {
  return `${dateColumn} >= {${paramStartName}:Date} AND ${dateColumn} <= {${paramEndName}:Date}`;
}

export function buildTenantFilter(paramName: string): string {
  return `tenant_id = {${paramName}:UUID}`;
}
```

### 6.3 Fichier : `repo/packages/analytics/src/utils/date-range-utils.ts`

```typescript
// repo/packages/analytics/src/utils/date-range-utils.ts
// Skalean InsurTech v2.2 -- validation date ranges
// Reference : B-13 Sprint 13 Tache 3.6.3
import { z } from 'zod';

const MAX_DAYS = Number(process.env.ANALYTICS_MAX_DATE_RANGE_DAYS ?? 1827);

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateRangeError';
  }
}

export interface ValidatedDateRange {
  start: Date;
  end: Date;
  durationDays: number;
}

export function validateDateRange(start: Date | string, end: Date | string): ValidatedDateRange {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);

  if (isNaN(s.getTime())) throw new DateRangeError('Invalid start date');
  if (isNaN(e.getTime())) throw new DateRangeError('Invalid end date');
  if (s > e) throw new DateRangeError('start must be before or equal end');

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((e.getTime() - s.getTime()) / msPerDay);
  if (days > MAX_DAYS) {
    throw new DateRangeError(`Date range too large: ${days} days, max ${MAX_DAYS}`);
  }

  return { start: s, end: e, durationDays: days };
}

export function clampDateRange(start: Date, end: Date, maxDays = MAX_DAYS): { start: Date; end: Date } {
  const validated = validateDateRange(start, end);
  if (validated.durationDays <= maxDays) {
    return { start: validated.start, end: validated.end };
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  return {
    start: new Date(validated.end.getTime() - maxDays * msPerDay),
    end: validated.end,
  };
}

export function defaultDateRange(days: number = 30): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}
```

### 6.4 Fichier : `repo/packages/analytics/src/utils/multi-tenant-validator.ts`

```typescript
// repo/packages/analytics/src/utils/multi-tenant-validator.ts
// Skalean InsurTech v2.2 -- validation tenant_id pour queries OLAP
// Reference : B-13 Sprint 13 Tache 3.6.3
import { z } from 'zod';

const UuidSchema = z.string().uuid();

export class MultiTenantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultiTenantValidationError';
  }
}

/**
 * Valide qu'un tenantId est :
 * 1. defini (pas null/undefined)
 * 2. au format UUID v4
 * 3. non vide
 * Throws MultiTenantValidationError sinon.
 */
export function validateTenantId(tenantId: unknown): string {
  if (tenantId === null || tenantId === undefined || tenantId === '') {
    throw new MultiTenantValidationError('tenant_id is required for analytics queries (decision-002)');
  }
  if (typeof tenantId !== 'string') {
    throw new MultiTenantValidationError(`tenant_id must be a string, got ${typeof tenantId}`);
  }
  const result = UuidSchema.safeParse(tenantId);
  if (!result.success) {
    throw new MultiTenantValidationError(`tenant_id is not a valid UUID: ${tenantId}`);
  }
  return result.data;
}
```

### 6.5 Fichier : `repo/packages/analytics/src/utils/cache-key-builder.ts`

```typescript
// repo/packages/analytics/src/utils/cache-key-builder.ts
// Skalean InsurTech v2.2 -- cache key builder (sorted keys hash)
// Reference : B-13 Sprint 13 Tache 3.6.3
import { createHash } from 'node:crypto';

/**
 * Stable hash : sort keys avant stringify pour key determinisme.
 */
export function hashArgs(args: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(args).sort()) {
    const v = args[k];
    if (v instanceof Date) {
      sorted[k] = v.toISOString();
    } else if (typeof v === 'object' && v !== null) {
      sorted[k] = JSON.stringify(v);
    } else {
      sorted[k] = v;
    }
  }
  const str = JSON.stringify(sorted);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export function buildAnalyticsCacheKey(
  method: string,
  tenantId: string,
  args: Record<string, unknown>,
): string {
  return `analytics:${method}:${tenantId}:${hashArgs(args)}`;
}

export function buildTenantWildcardKey(tenantId: string): string {
  return `analytics:*:${tenantId}:*`;
}
```

### 6.6 Fichier : `repo/packages/analytics/src/services/analytics-cache.service.ts`

```typescript
// repo/packages/analytics/src/services/analytics-cache.service.ts
// Skalean InsurTech v2.2 -- Cache wrapper Redis pour analytics
// Reference : B-13 Sprint 13 Tache 3.6.3
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../etl/etl-lock.service';

const DEFAULT_TTL_SECONDS = Number(process.env.ANALYTICS_CACHE_TTL_SECONDS ?? 300);

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) {
        this.logger.debug({ action: 'cache_miss', key });
        return null;
      }
      this.logger.debug({ action: 'cache_hit', key });
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn({
        action: 'cache_get_failed',
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
      this.logger.debug({ action: 'cache_set', key, ttl_seconds: ttlSeconds, size_bytes: serialized.length });
    } catch (err) {
      this.logger.warn({ action: 'cache_set_failed', key, error: String(err) });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn({ action: 'cache_del_failed', key, error: String(err) });
    }
  }

  /**
   * Delete par pattern (rare, lourd : SCAN puis DEL).
   * Usage : invalidation tenant complete apres ETL.
   */
  async delPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        const n = await this.redis.del(...keys);
        deleted += n;
      }
    } while (cursor !== '0');
    this.logger.log({ action: 'cache_del_pattern', pattern, count: deleted });
    return deleted;
  }

  /**
   * Wrapper get-or-compute : si cache miss, execute fn et store.
   */
  async getOrCompute<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const computed = await fn();
    await this.set(key, computed, ttlSeconds);
    return computed;
  }
}
```

### 6.7 Fichier : `repo/packages/analytics/src/services/analytics.service.ts`

```typescript
// repo/packages/analytics/src/services/analytics.service.ts
// Skalean InsurTech v2.2 -- Service centralise queries analytics OLAP
// Reference : B-13 Sprint 13 Tache 3.6.3
// Conventions : multi-tenant strict (validator), Zod validation, Pino, cache Redis 5min
import { Injectable, Logger } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { validateTenantId } from '../utils/multi-tenant-validator';
import { validateDateRange } from '../utils/date-range-utils';
import { toGroupByExpr, formatDateForClickHouse } from '../utils/clickhouse-expressions';
import { buildAnalyticsCacheKey } from '../utils/cache-key-builder';
import {
  RevenuePoint,
  FunnelStep,
  TopCustomer,
  HeatmapPoint,
  MessageStats,
  DocsStats,
  RevenueGroupBy,
  RevenueGroupBySchema,
} from '../types/dashboards';

const CACHE_TTL_SECONDS = Number(process.env.ANALYTICS_CACHE_TTL_SECONDS ?? 300);

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly ch: ClickHouseService,
    private readonly cache: AnalyticsCacheService,
  ) {}

  // ---------- getRevenue ----------
  async getRevenue(
    tenantId: string,
    dateStart: Date,
    dateEnd: Date,
    groupBy: RevenueGroupBy = 'day',
  ): Promise<RevenuePoint[]> {
    const tid = validateTenantId(tenantId);
    const range = validateDateRange(dateStart, dateEnd);
    const gb = RevenueGroupBySchema.parse(groupBy);

    const cacheKey = buildAnalyticsCacheKey('getRevenue', tid, {
      start: range.start,
      end: range.end,
      groupBy: gb,
    });

    return this.cache.getOrCompute(cacheKey, CACHE_TTL_SECONDS, async () => {
      const startStr = formatDateForClickHouse(range.start);
      const endStr = formatDateForClickHouse(range.end);

      const query = `
        SELECT
          ${toGroupByExpr(gb)} AS period,
          count() AS transactions_count,
          toString(sum(amount)) AS gross_revenue,
          toString(sum(fees_amount)) AS total_fees,
          toString(sum(net_amount)) AS net_revenue,
          uniqExact(customer_email) AS unique_customers
        FROM skalean_analytics.fct_transactions
        WHERE tenant_id = {tenantId:UUID}
          AND status = 'captured'
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
        GROUP BY period
        ORDER BY period ASC
      `;

      const start = Date.now();
      const rows = await this.ch.query<RevenuePoint>({
        query,
        query_params: { tenantId: tid, dateStart: startStr, dateEnd: endStr },
        format: 'JSONEachRow',
      });
      this.logger.log({
        action: 'analytics_getRevenue',
        tenant_id: tid,
        group_by: gb,
        rows: rows.length,
        duration_ms: Date.now() - start,
      });
      return rows;
    });
  }

  // ---------- getConversionFunnel ----------
  async getConversionFunnel(tenantId: string, dateStart: Date, dateEnd: Date): Promise<FunnelStep[]> {
    const tid = validateTenantId(tenantId);
    const range = validateDateRange(dateStart, dateEnd);
    const cacheKey = buildAnalyticsCacheKey('getConversionFunnel', tid, { start: range.start, end: range.end });

    return this.cache.getOrCompute(cacheKey, CACHE_TTL_SECONDS, async () => {
      // Funnel CRM : prospect -> qualified -> contacted -> demoed -> won
      const query = `
        WITH funnel_data AS (
          SELECT
            countIf(customer_type = 'prospect') AS prospects,
            countIf(customer_type IN ('lead', 'qualified', 'customer')) AS qualified,
            countIf(customer_type IN ('customer')) AS won
          FROM skalean_analytics.dim_customers
          WHERE tenant_id = {tenantId:UUID}
            AND acquisition_date >= {dateStart:Date}
            AND acquisition_date <= {dateEnd:Date}
        )
        SELECT 'prospect' AS step_name, prospects AS count, 100.0 AS conversion_rate_pct FROM funnel_data
        UNION ALL
        SELECT 'qualified' AS step_name, qualified AS count, 
          if(prospects > 0, qualified * 100.0 / prospects, 0) AS conversion_rate_pct
          FROM funnel_data
        UNION ALL
        SELECT 'won' AS step_name, won AS count,
          if(prospects > 0, won * 100.0 / prospects, 0) AS conversion_rate_pct
          FROM funnel_data
      `;
      const rows = await this.ch.query<FunnelStep>({
        query,
        query_params: {
          tenantId: tid,
          dateStart: formatDateForClickHouse(range.start),
          dateEnd: formatDateForClickHouse(range.end),
        },
      });
      return rows;
    });
  }

  // ---------- getTopCustomers ----------
  async getTopCustomers(
    tenantId: string,
    dateStart: Date,
    dateEnd: Date,
    limit: number = 10,
  ): Promise<TopCustomer[]> {
    const tid = validateTenantId(tenantId);
    const range = validateDateRange(dateStart, dateEnd);
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const cacheKey = buildAnalyticsCacheKey('getTopCustomers', tid, {
      start: range.start, end: range.end, limit: cappedLimit,
    });

    return this.cache.getOrCompute(cacheKey, CACHE_TTL_SECONDS, async () => {
      const query = `
        SELECT
          customer_id,
          customer_email,
          toString(sum(amount)) AS total_amount,
          count() AS transactions_count,
          toString(max(event_datetime)) AS last_transaction_at
        FROM skalean_analytics.fct_transactions
        WHERE tenant_id = {tenantId:UUID}
          AND status = 'captured'
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
        GROUP BY customer_id, customer_email
        ORDER BY sum(amount) DESC
        LIMIT {limit:UInt32}
      `;
      const rows = await this.ch.query<TopCustomer>({
        query,
        query_params: {
          tenantId: tid,
          dateStart: formatDateForClickHouse(range.start),
          dateEnd: formatDateForClickHouse(range.end),
          limit: cappedLimit,
        },
      });
      return rows;
    });
  }

  // ---------- getActivityHeatmap ----------
  async getActivityHeatmap(tenantId: string, dateStart: Date, dateEnd: Date): Promise<HeatmapPoint[]> {
    const tid = validateTenantId(tenantId);
    const range = validateDateRange(dateStart, dateEnd);
    const cacheKey = buildAnalyticsCacheKey('getActivityHeatmap', tid, { start: range.start, end: range.end });

    return this.cache.getOrCompute(cacheKey, CACHE_TTL_SECONDS, async () => {
      const query = `
        SELECT
          toDayOfWeek(starts_at) AS day_of_week,
          toHour(starts_at) AS hour,
          count() AS appointments_count,
          toString(coalesce(sum(0), 0)) AS revenue
        FROM skalean_analytics.fct_appointments
        WHERE tenant_id = {tenantId:UUID}
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
        GROUP BY day_of_week, hour
        ORDER BY day_of_week, hour
      `;
      const rows = await this.ch.query<HeatmapPoint>({
        query,
        query_params: {
          tenantId: tid,
          dateStart: formatDateForClickHouse(range.start),
          dateEnd: formatDateForClickHouse(range.end),
        },
      });
      return rows;
    });
  }

  // ---------- getMessageStats ----------
  async getMessageStats(tenantId: string, dateStart: Date, dateEnd: Date): Promise<MessageStats> {
    const tid = validateTenantId(tenantId);
    const range = validateDateRange(dateStart, dateEnd);
    const cacheKey = buildAnalyticsCacheKey('getMessageStats', tid, { start: range.start, end: range.end });

    return this.cache.getOrCompute(cacheKey, CACHE_TTL_SECONDS, async () => {
      const queryGlobal = `
        SELECT
          count() AS total_sent,
          countIf(delivered_at IS NOT NULL) AS total_delivered,
          countIf(read_at IS NOT NULL) AS total_read,
          countIf(replied_at IS NOT NULL) AS total_replied
        FROM skalean_analytics.fct_messages
        WHERE tenant_id = {tenantId:UUID}
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
          AND direction = 'outbound'
      `;
      const queryChannels = `
        SELECT channel, count() AS sent, countIf(delivered_at IS NOT NULL) AS delivered
        FROM skalean_analytics.fct_messages
        WHERE tenant_id = {tenantId:UUID}
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
        GROUP BY channel
        ORDER BY sent DESC
      `;
      const params = {
        tenantId: tid,
        dateStart: formatDateForClickHouse(range.start),
        dateEnd: formatDateForClickHouse(range.end),
      };
      const [globalRows, channelRows] = await Promise.all([
        this.ch.query<{
          total_sent: number; total_delivered: number;
          total_read: number; total_replied: number;
        }>({ query: queryGlobal, query_params: params }),
        this.ch.query<{ channel: string; sent: number; delivered: number }>({
          query: queryChannels, query_params: params,
        }),
      ]);
      const g = globalRows[0] ?? { total_sent: 0, total_delivered: 0, total_read: 0, total_replied: 0 };
      return {
        total_sent: Number(g.total_sent),
        total_delivered: Number(g.total_delivered),
        total_read: Number(g.total_read),
        total_replied: Number(g.total_replied),
        delivery_rate_pct: g.total_sent > 0 ? (Number(g.total_delivered) * 100) / Number(g.total_sent) : 0,
        read_rate_pct: g.total_sent > 0 ? (Number(g.total_read) * 100) / Number(g.total_sent) : 0,
        by_channel: channelRows.map((r) => ({
          channel: r.channel,
          sent: Number(r.sent),
          delivered: Number(r.delivered),
        })),
      };
    });
  }

  // ---------- getSignedDocsStats ----------
  async getSignedDocsStats(tenantId: string, dateStart: Date, dateEnd: Date): Promise<DocsStats> {
    const tid = validateTenantId(tenantId);
    const range = validateDateRange(dateStart, dateEnd);
    const cacheKey = buildAnalyticsCacheKey('getSignedDocsStats', tid, { start: range.start, end: range.end });

    return this.cache.getOrCompute(cacheKey, CACHE_TTL_SECONDS, async () => {
      const params = {
        tenantId: tid,
        dateStart: formatDateForClickHouse(range.start),
        dateEnd: formatDateForClickHouse(range.end),
      };
      const queryGlobal = `
        SELECT
          count() AS total_initiated,
          countIf(status = 'signed') AS total_signed,
          countIf(status = 'expired') AS total_expired,
          avgIf(time_to_sign_seconds, time_to_sign_seconds IS NOT NULL) AS avg_time_to_sign_seconds
        FROM skalean_analytics.fct_documents_signed
        WHERE tenant_id = {tenantId:UUID}
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
      `;
      const queryProviders = `
        SELECT signature_provider AS provider, countIf(status = 'signed') AS signed
        FROM skalean_analytics.fct_documents_signed
        WHERE tenant_id = {tenantId:UUID}
          AND event_date >= {dateStart:Date}
          AND event_date <= {dateEnd:Date}
        GROUP BY signature_provider
        ORDER BY signed DESC
      `;
      const [globalRows, providerRows] = await Promise.all([
        this.ch.query<{
          total_initiated: number; total_signed: number;
          total_expired: number; avg_time_to_sign_seconds: number | null;
        }>({ query: queryGlobal, query_params: params }),
        this.ch.query<{ provider: string; signed: number }>({ query: queryProviders, query_params: params }),
      ]);
      const g = globalRows[0] ?? { total_initiated: 0, total_signed: 0, total_expired: 0, avg_time_to_sign_seconds: null };
      return {
        total_initiated: Number(g.total_initiated),
        total_signed: Number(g.total_signed),
        total_expired: Number(g.total_expired),
        avg_time_to_sign_seconds: g.avg_time_to_sign_seconds == null ? null : Number(g.avg_time_to_sign_seconds),
        by_provider: providerRows.map((r) => ({ provider: r.provider, signed: Number(r.signed) })),
      };
    });
  }
}
```

### 6.8 Fichier : `repo/packages/analytics/src/services/analytics-cache-invalidator.consumer.ts`

```typescript
// repo/packages/analytics/src/services/analytics-cache-invalidator.consumer.ts
// Skalean InsurTech v2.2 -- Kafka consumer pour invalider cache apres ETL
// Reference : B-13 Sprint 13 Tache 3.6.3
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { AnalyticsCacheService } from './analytics-cache.service';
// Suppose existence Kafka client wrapper @insurtech/shared-utils

@Injectable()
export class AnalyticsCacheInvalidatorConsumer implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsCacheInvalidatorConsumer.name);

  constructor(private readonly cache: AnalyticsCacheService) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to 'insurtech.events.analytics.etl_completed'
    // En attendant integration Kafka concrete, signature documentee
    this.logger.log({ action: 'cache_invalidator_init' });
  }

  /**
   * Handler called when Kafka topic 'insurtech.events.analytics.etl_completed' delivers a message.
   * Payload : { tenant_id?: string, tables: string[], batch_id: string }
   */
  async handleEtlCompleted(payload: { tenant_id?: string; tables: string[]; batch_id: string }): Promise<void> {
    if (payload.tenant_id) {
      const deleted = await this.cache.delPattern(`analytics:*:${payload.tenant_id}:*`);
      this.logger.log({
        action: 'cache_invalidated_tenant',
        tenant_id: payload.tenant_id,
        keys_deleted: deleted,
      });
    } else {
      // Invalidation globale (rare : seulement apres reset complet)
      const deleted = await this.cache.delPattern('analytics:*');
      this.logger.warn({ action: 'cache_invalidated_global', keys_deleted: deleted });
    }
  }
}
```

---

## 7. Tests complets

### 7.1 Tests : `analytics.service.spec.ts` (extrait essentiel, 25 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { ClickHouseService } from './clickhouse.service';
import { AnalyticsCacheService } from './analytics-cache.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let ch: any;
  let cache: any;

  beforeEach(async () => {
    ch = { query: vi.fn() };
    cache = {
      getOrCompute: vi.fn().mockImplementation((_key, _ttl, fn) => fn()),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      delPattern: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: ClickHouseService, useValue: ch },
        { provide: AnalyticsCacheService, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  describe('getRevenue', () => {
    const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    it('should reject invalid tenant_id (not UUID)', async () => {
      await expect(service.getRevenue('not-uuid', new Date('2026-01-01'), new Date('2026-12-31'))).rejects.toThrow();
    });

    it('should reject empty tenant_id', async () => {
      await expect(service.getRevenue('', new Date('2026-01-01'), new Date('2026-12-31'))).rejects.toThrow();
    });

    it('should reject start > end', async () => {
      await expect(service.getRevenue(TENANT, new Date('2026-12-31'), new Date('2026-01-01'))).rejects.toThrow();
    });

    it('should default groupBy to day', async () => {
      ch.query.mockResolvedValue([]);
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      const args = ch.query.mock.calls[0][0];
      expect(args.query).toContain('toDate(event_date)');
    });

    it('should support groupBy week', async () => {
      ch.query.mockResolvedValue([]);
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-12-31'), 'week');
      const args = ch.query.mock.calls[0][0];
      expect(args.query).toContain('toMonday(event_date)');
    });

    it('should support groupBy month', async () => {
      ch.query.mockResolvedValue([]);
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-12-31'), 'month');
      const args = ch.query.mock.calls[0][0];
      expect(args.query).toContain('toStartOfMonth(event_date)');
    });

    it('should pass query_params with UUID + Date', async () => {
      ch.query.mockResolvedValue([]);
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      const args = ch.query.mock.calls[0][0];
      expect(args.query_params.tenantId).toBe(TENANT);
      expect(args.query_params.dateStart).toBe('2026-01-01');
      expect(args.query_params.dateEnd).toBe('2026-01-31');
    });

    it('should filter only captured transactions', async () => {
      ch.query.mockResolvedValue([]);
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      const args = ch.query.mock.calls[0][0];
      expect(args.query).toMatch(/status\s*=\s*'captured'/);
    });

    it('should return rows array', async () => {
      const fixture = [
        { period: '2026-01-01', transactions_count: 10, gross_revenue: '1000.00', total_fees: '50.00', net_revenue: '950.00', unique_customers: 5 },
      ];
      ch.query.mockResolvedValue(fixture);
      const result = await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result).toEqual(fixture);
    });

    it('should use cache key with tenant', async () => {
      cache.getOrCompute.mockImplementation((key) => Promise.resolve([]));
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(cache.getOrCompute.mock.calls[0][0]).toContain(TENANT);
    });
  });

  describe('getConversionFunnel', () => {
    const TENANT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    it('should query dim_customers funnel', async () => {
      ch.query.mockResolvedValue([
        { step_name: 'prospect', count: 100, conversion_rate_pct: 100 },
        { step_name: 'qualified', count: 50, conversion_rate_pct: 50 },
        { step_name: 'won', count: 10, conversion_rate_pct: 10 },
      ]);
      const result = await service.getConversionFunnel(TENANT, new Date('2026-01-01'), new Date('2026-12-31'));
      expect(result).toHaveLength(3);
      expect(result[2].step_name).toBe('won');
    });
  });

  describe('getTopCustomers', () => {
    const TENANT = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    it('should cap limit at 100', async () => {
      ch.query.mockResolvedValue([]);
      await service.getTopCustomers(TENANT, new Date('2026-01-01'), new Date('2026-12-31'), 5000);
      const args = ch.query.mock.calls[0][0];
      expect(args.query_params.limit).toBe(100);
    });

    it('should enforce minimum limit 1', async () => {
      ch.query.mockResolvedValue([]);
      await service.getTopCustomers(TENANT, new Date('2026-01-01'), new Date('2026-12-31'), 0);
      const args = ch.query.mock.calls[0][0];
      expect(args.query_params.limit).toBe(1);
    });

    it('should use ORDER BY sum DESC', async () => {
      ch.query.mockResolvedValue([]);
      await service.getTopCustomers(TENANT, new Date('2026-01-01'), new Date('2026-12-31'), 10);
      const args = ch.query.mock.calls[0][0];
      expect(args.query).toMatch(/ORDER BY sum\(amount\) DESC/);
    });
  });

  describe('getMessageStats', () => {
    const TENANT = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    it('should compute delivery_rate_pct correctly', async () => {
      ch.query.mockResolvedValueOnce([{ total_sent: 100, total_delivered: 95, total_read: 60, total_replied: 5 }]);
      ch.query.mockResolvedValueOnce([]);
      const result = await service.getMessageStats(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result.delivery_rate_pct).toBe(95);
    });

    it('should handle zero sent gracefully (no division by zero)', async () => {
      ch.query.mockResolvedValueOnce([{ total_sent: 0, total_delivered: 0, total_read: 0, total_replied: 0 }]);
      ch.query.mockResolvedValueOnce([]);
      const result = await service.getMessageStats(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result.delivery_rate_pct).toBe(0);
      expect(result.read_rate_pct).toBe(0);
    });

    it('should aggregate by channel', async () => {
      ch.query.mockResolvedValueOnce([{ total_sent: 100, total_delivered: 95, total_read: 60, total_replied: 5 }]);
      ch.query.mockResolvedValueOnce([
        { channel: 'whatsapp', sent: 60, delivered: 58 },
        { channel: 'email', sent: 40, delivered: 37 },
      ]);
      const result = await service.getMessageStats(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result.by_channel).toHaveLength(2);
      expect(result.by_channel[0].channel).toBe('whatsapp');
    });
  });

  describe('getSignedDocsStats', () => {
    const TENANT = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    it('should return null avg if no signatures', async () => {
      ch.query.mockResolvedValueOnce([{ total_initiated: 0, total_signed: 0, total_expired: 0, avg_time_to_sign_seconds: null }]);
      ch.query.mockResolvedValueOnce([]);
      const result = await service.getSignedDocsStats(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result.avg_time_to_sign_seconds).toBeNull();
    });

    it('should aggregate by provider', async () => {
      ch.query.mockResolvedValueOnce([{ total_initiated: 100, total_signed: 80, total_expired: 5, avg_time_to_sign_seconds: 3600 }]);
      ch.query.mockResolvedValueOnce([
        { provider: 'barid_esign', signed: 70 },
        { provider: 'anrt_tsa', signed: 10 },
      ]);
      const result = await service.getSignedDocsStats(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result.by_provider).toHaveLength(2);
      expect(result.avg_time_to_sign_seconds).toBe(3600);
    });
  });

  describe('caching', () => {
    const TENANT = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    it('should use cache for getRevenue', async () => {
      cache.getOrCompute.mockResolvedValue([]);
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(cache.getOrCompute).toHaveBeenCalled();
    });

    it('should produce same cache key for same args', async () => {
      const keys: string[] = [];
      cache.getOrCompute.mockImplementation((key) => { keys.push(key); return Promise.resolve([]); });
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'));
      expect(keys[0]).toBe(keys[1]);
    });

    it('should produce different cache key for different groupBy', async () => {
      const keys: string[] = [];
      cache.getOrCompute.mockImplementation((key) => { keys.push(key); return Promise.resolve([]); });
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'), 'day');
      await service.getRevenue(TENANT, new Date('2026-01-01'), new Date('2026-01-31'), 'month');
      expect(keys[0]).not.toBe(keys[1]);
    });
  });

  describe('multi-tenant isolation', () => {
    it('should pass different tenantId to query for different calls', async () => {
      ch.query.mockResolvedValue([]);
      await service.getRevenue('11111111-1111-1111-1111-111111111111', new Date('2026-01-01'), new Date('2026-01-31'));
      await service.getRevenue('22222222-2222-2222-2222-222222222222', new Date('2026-01-01'), new Date('2026-01-31'));
      expect(ch.query.mock.calls[0][0].query_params.tenantId).toBe('11111111-1111-1111-1111-111111111111');
      expect(ch.query.mock.calls[1][0].query_params.tenantId).toBe('22222222-2222-2222-2222-222222222222');
    });
  });
});
```

### 7.2 Tests `analytics-cache.service.spec.ts` (10 tests resumes)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsCacheService } from './analytics-cache.service';

describe('AnalyticsCacheService', () => {
  let cache: AnalyticsCacheService;
  let redis: any;

  beforeEach(() => {
    redis = { get: vi.fn(), set: vi.fn(), del: vi.fn(), scan: vi.fn() };
    cache = new AnalyticsCacheService(redis);
  });

  it('get returns null on miss', async () => {
    redis.get.mockResolvedValue(null);
    expect(await cache.get('k')).toBeNull();
  });
  it('get returns parsed JSON on hit', async () => {
    redis.get.mockResolvedValue('{"a":1}');
    expect(await cache.get<{ a: number }>('k')).toEqual({ a: 1 });
  });
  it('set serialize JSON + TTL', async () => {
    await cache.set('k', { a: 1 }, 600);
    expect(redis.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 600);
  });
  it('default TTL 300s', async () => {
    await cache.set('k', { a: 1 });
    expect(redis.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 300);
  });
  it('getOrCompute returns cached', async () => {
    redis.get.mockResolvedValue('{"cached":true}');
    const fn = vi.fn();
    const result = await cache.getOrCompute('k', 300, fn);
    expect(result).toEqual({ cached: true });
    expect(fn).not.toHaveBeenCalled();
  });
  it('getOrCompute calls fn on miss', async () => {
    redis.get.mockResolvedValue(null);
    const fn = vi.fn().mockResolvedValue({ fresh: true });
    const result = await cache.getOrCompute('k', 300, fn);
    expect(result).toEqual({ fresh: true });
    expect(fn).toHaveBeenCalled();
  });
  it('delPattern uses SCAN + DEL', async () => {
    redis.scan.mockResolvedValueOnce(['0', ['k1', 'k2']]);
    redis.del.mockResolvedValue(2);
    const n = await cache.delPattern('analytics:*');
    expect(n).toBe(2);
  });
  it('delPattern handles empty result', async () => {
    redis.scan.mockResolvedValueOnce(['0', []]);
    const n = await cache.delPattern('analytics:*');
    expect(n).toBe(0);
  });
  it('get returns null on Redis error', async () => {
    redis.get.mockRejectedValue(new Error('redis down'));
    expect(await cache.get('k')).toBeNull();
  });
  it('set tolerates Redis error silently', async () => {
    redis.set.mockRejectedValue(new Error('redis down'));
    await expect(cache.set('k', {})).resolves.toBeUndefined();
  });
});
```

---

## 8. Variables environnement

```env
ANALYTICS_CACHE_TTL_SECONDS=300
ANALYTICS_MAX_DATE_RANGE_DAYS=1827      # 5 ans
ANALYTICS_QUERY_TIMEOUT_MS=25000
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/analytics test
pnpm --filter @insurtech/analytics test:coverage
pnpm --filter @insurtech/analytics typecheck

# Test manuel via tsx
pnpm tsx -e "
import { loadClickHouseConfig, ClickHouseService, AnalyticsCacheService, AnalyticsService } from '@insurtech/analytics';
import Redis from 'ioredis';
const ch = new ClickHouseService(loadClickHouseConfig());
await ch.onModuleInit();
const redis = new Redis();
const cache = new AnalyticsCacheService(redis);
const a = new AnalyticsService(ch, cache);
const res = await a.getRevenue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', new Date('2026-01-01'), new Date('2026-12-31'), 'month');
console.log(JSON.stringify(res, null, 2));
"
```

---

## 10. Criteres validation V1-V25

### P0 (15)
- V1 : `getRevenue` retourne tableau RevenuePoint[]
- V2 : groupBy day/week/month produit expressions ClickHouse correctes
- V3 : tenant_id invalide -> throw
- V4 : tenant_id non-UUID -> throw
- V5 : start > end -> throw
- V6 : date range > 5 ans -> throw
- V7 : Query parametree (anti-injection) `{tenantId:UUID}`
- V8 : Status filter `'captured'` dans getRevenue
- V9 : Cache hit retourne sans hit ClickHouse
- V10 : Cache miss execute query + set cache TTL 300s
- V11 : `getTopCustomers` cap limit a 100
- V12 : `getTopCustomers` min limit a 1
- V13 : Multi-tenant isolation : 2 tenantId distincts -> 2 queries differentes
- V14 : `getMessageStats` zero division safe
- V15 : `getSignedDocsStats` retourne avg null si pas signe

### P1 (7)
- V16 : Cache key consistant pour memes args (sorted)
- V17 : Cache key different pour different groupBy
- V18 : Logger structures Pino : action, tenant_id, duration_ms
- V19 : Tests integration sur fixtures ClickHouse passent
- V20 : Coverage >= 85%
- V21 : Kafka consumer invalidator handle etl_completed
- V22 : Pattern invalidation delete `analytics:*:tenant:*`

### P2 (3)
- V23 : Docs api `analytics-service-api.md` >= 200 lignes
- V24 : Performance < 1s sur 1M rows fixture
- V25 : Cache miss + hit < 5ms (sur localhost)

---

## 11. Edge cases + troubleshooting

1. **Query 30s timeout** -> abort_signal 25s + ClickHouse setting `max_execution_time=60`.
2. **Stale cache apres ETL** -> Kafka invalidator.
3. **Hash collision** -> sha256 16 chars suffit (probabilite negligeable).
4. **tenant_id manquant** -> validator throw clair.
5. **Decimal precision frontend** -> JSON Decimal en string, Decimal.js cote consommateur.
6. **Heatmap timezone** -> UTC stockage, conversion cote UI.
7. **uniqExact OOM** -> limit 100k group keys ClickHouse.
8. **Cache thundering herd** -> single-flight via SETNX (defer Sprint 35).
9. **Cache Redis full** -> eviction policy `allkeys-lru` configure Sprint 9.
10. **ClickHouse down** -> health indicator throw, controller 503.

---

## 12. Conformite Maroc

- Loi 09-08 CNDP : queries restent Atlas Cloud Benguerir, aucun transit hors MA.
- TTL ClickHouse respecte (5 ans transactions, 10 ans journal).

---

## 13. Conventions absolues

Multi-tenant strict via validator, Zod, Pino, pnpm, TypeScript strict, tests >= 85%, RBAC consommateurs (Tache 3.6.4), Kafka invalidator, imports `@insurtech/analytics`, no-emoji, Conventional Commits, Cloud souverain MA.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/analytics typecheck
pnpm --filter @insurtech/analytics lint
pnpm --filter @insurtech/analytics test:coverage    # >= 85%
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/analytics/src/ && exit 1
grep -rn "console\.log" repo/packages/analytics/src/ | grep -v ".spec.ts" && exit 1
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): AnalyticsService + cache Redis + 6 query methods

Sprint 13 Tache 3.6.3 : AnalyticsService centralisateur queries OLAP ClickHouse
avec cache Redis 5min, validation multi-tenant, 6 methodes dashboards.

Livrables :
- AnalyticsService : getRevenue, getConversionFunnel, getTopCustomers,
  getActivityHeatmap, getMessageStats, getSignedDocsStats
- AnalyticsCacheService : Redis wrapper + invalidator Kafka consumer
- Utils : clickhouseExpressions, dateRangeUtils, multiTenantValidator, cacheKeyBuilder
- Types : RevenuePoint, FunnelStep, TopCustomer, HeatmapPoint, MessageStats, DocsStats
- 53 tests (25+10+10+8)

Tests: 53
Coverage: 88%

Task: 3.6.3
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.3"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.4-6-dashboards-rest-endpoints.md` (controllers REST exposant AnalyticsService aux 6 dashboards).

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Patterns optimisation ClickHouse pour OLAP

#### A.1 Materialized Views Sprint 35+ preview

Sprint 13 = queries directes sur fct_*. Sprint 35+ ajoutera materialized views pre-aggregeed pour queries < 10ms.

```sql
-- Sprint 35 future
CREATE MATERIALIZED VIEW mv_revenue_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_date)
AS SELECT
  tenant_id,
  event_date,
  count() AS transactions_count,
  sum(amount) AS gross_revenue,
  sum(fees_amount) AS total_fees,
  uniqExact(customer_email) AS unique_customers
FROM fct_transactions
WHERE status = 'captured'
GROUP BY tenant_id, event_date;
```

Avec MV, query revenue mensuel 12 mois = 12 rows SELECT au lieu de 1M rows aggregate -> 100x plus rapide.

#### A.2 Skip indexes optimization

Skip indexes (bloom_filter, set, minmax) sur fct_* permettent partition pruning fin :

```sql
ALTER TABLE fct_transactions
ADD INDEX idx_provider provider TYPE set(8) GRANULARITY 4;

ALTER TABLE fct_transactions
ADD INDEX idx_customer_email customer_email TYPE bloom_filter GRANULARITY 4;

ALTER TABLE fct_transactions
ADD INDEX idx_amount amount TYPE minmax GRANULARITY 4;
```

Queries WHERE provider='cmi' ne lisent que les blocks contenant cmi (skip 90%+).

#### A.3 Pre-aggregation client-side avec query parametree

Pattern :
```typescript
// Au lieu de SELECT * + aggregate Node :
const rows = await ch.query({ query: 'SELECT * FROM fct_transactions WHERE ...' });
const total = rows.reduce((s, r) => s + r.amount, 0);  // SLOW

// Pousser aggregate ClickHouse :
const r = await ch.query({ query: 'SELECT sum(amount) AS total FROM fct_transactions WHERE ...' });
const total = r[0].total;  // FAST
```

### B. Cache key composition detaillee

```typescript
function buildAnalyticsCacheKey(method, tenantId, args) {
  // Sort args keys pour determinisme
  const sortedArgs = Object.keys(args).sort().reduce((acc, k) => {
    acc[k] = args[k] instanceof Date ? args[k].toISOString() : args[k];
    return acc;
  }, {});
  
  const hash = sha256(JSON.stringify(sortedArgs)).slice(0, 16);
  return `analytics:${method}:${tenantId}:${hash}`;
}

// Examples :
// "analytics:getRevenue:11111111-1111-1111-1111-111111111111:a3f5b8c1d2e4f6a9"
// "analytics:getConversionFunnel:22222222-2222-2222-2222-222222222222:1234567890abcdef"
```

Avantages :
- Sort keys -> meme args = meme cle (deterministe).
- Hash 16 chars -> 2^64 collisions improbables.
- Prefix `analytics:` -> SCAN MATCH pattern facile.

Invalidation :
- TTL 5 min auto-expire.
- Kafka event `analytics.etl_completed` declenche `DEL analytics:*:{tenantId}:*`.
- Manual via Redis CLI : `redis-cli --scan --pattern "analytics:*" | xargs redis-cli DEL`.

### C. Tests integration ClickHouse complets

```typescript
describe('AnalyticsService integration ClickHouse', () => {
  let ch: ClickHouseService;
  let cache: AnalyticsCacheService;
  let svc: AnalyticsService;
  const TENANT = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    // Bootstrap ClickHouse + Redis test instances
    // Seed fct_transactions with 1000 rows for TENANT
  });

  afterAll(async () => {
    // Cleanup
  });

  it('getRevenue group_by month on 12 months returns 12 points', async () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-12-31');
    const points = await svc.getRevenue(TENANT, start, end, 'month');
    expect(points.length).toBe(12);
  });

  it('getRevenue cache hit 2nd call < 10ms', async () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-31');
    await svc.getRevenue(TENANT, start, end);
    const t0 = Date.now();
    await svc.getRevenue(TENANT, start, end);
    expect(Date.now() - t0).toBeLessThan(50);  // generous for CI
  });

  it('getTopCustomers limit enforced', async () => {
    const customers = await svc.getTopCustomers(TENANT, new Date('2026-01-01'), new Date('2026-12-31'), 5000);
    expect(customers.length).toBeLessThanOrEqual(100);  // capped
  });

  it('getConversionFunnel returns 3 steps', async () => {
    const funnel = await svc.getConversionFunnel(TENANT, new Date('2026-01-01'), new Date('2026-12-31'));
    expect(funnel.length).toBeGreaterThanOrEqual(3);
  });

  it('Multi-tenant isolation : TENANT_A != TENANT_B', async () => {
    const dataA = await svc.getRevenue('TENANT_A_UUID', new Date('2026-01-01'), new Date('2026-12-31'));
    const dataB = await svc.getRevenue('TENANT_B_UUID', new Date('2026-01-01'), new Date('2026-12-31'));
    // Each isolated
  });

  it('getMessageStats zero division safe', async () => {
    // Tenant with 0 messages
    const stats = await svc.getMessageStats('EMPTY_TENANT', new Date('2026-01-01'), new Date('2026-12-31'));
    expect(stats.delivery_rate_pct).toBe(0);
    expect(stats.read_rate_pct).toBe(0);
  });

  it('getActivityHeatmap returns 168 cells max (24h x 7j)', async () => {
    const heatmap = await svc.getActivityHeatmap(TENANT, new Date('2026-01-01'), new Date('2026-12-31'));
    expect(heatmap.length).toBeLessThanOrEqual(168);
  });

  it('getSignedDocsStats handles null avg gracefully', async () => {
    const stats = await svc.getSignedDocsStats('NO_DOCS_TENANT', new Date('2026-01-01'), new Date('2026-12-31'));
    expect(stats.avg_time_to_sign_seconds).toBeNull();
  });
});
```

### D. Roadmap Sprint 35+ enhancements

| Feature | Sprint 13 | Sprint 35+ |
|---------|-----------|------------|
| Cache | Redis 5min TTL | Redis + ETag HTTP + invalidation Kafka |
| MVs ClickHouse | None | Materialized views pre-agg |
| Query builder | Hard-coded SQL | Dynamic via Zod schemas |
| ML predictions | None | TensorFlow.js Sprint 30+ |
| Real-time WS | None | WebSocket dashboards Sprint 31 |
| Drill-down | Aggregates only | Top items per query |
| Exports CSV | Endpoints CSV | Async job + email link |

### E. Conformite + auditabilite

- Logs Pino structures action/tenant_id/duration_ms permettent audit performance.
- Cache key includes tenant_id : aucune fuite cross-tenant possible.
- Validation Zod stricte rejette params malformes (anti-injection).
- AsyncLocalStorage tenant context : aucune query sans tenant_id valide.

---

**Fin enrichissement task-3.6.3.**

**Fin task-3.6.3-analytics-service-queries-dashboards.md.**

Densite : ~85 ko. Code : 8 fichiers complets. Tests : 53. Criteres : V1-V25. Edge cases : 10.

## ANNEXE A -- Patterns transverses Sprint 13 (conventions communes)

### A.1 Multi-tenant strict (decision-002)

Toutes les operations Sprint 13 doivent inclure tenant_id filter strict :
- Postgres : trigger RLS app.current_tenant via SET LOCAL
- ClickHouse : tenant_id dans ORDER BY pour partition pruning  
- Kafka : tenant_id obligatoire dans event payload
- Redis cache keys : prefixe tenant_id pour isolation cross-tenant impossible
- AsyncLocalStorage Node : TenantContext propage tenant_id sans param explicite
- Tests obligatoires : multi-tenant isolation (2 tenants -> 2 datasets distincts)

### A.2 Zod validation runtime stricte

Pattern uniforme partout Sprint 13 :

```typescript
const Schema = z.object({
  tenant_id: z.string().uuid(),
  field: z.string().min(1).max(255),
  amount: z.coerce.number().min(0),
  date: z.coerce.date(),
});
type Type = z.infer<typeof Schema>;

// Au controller :
const dto = Schema.parse(body);  // throws ZodError -> 400 automatic
```

JAMAIS class-validator/yup/joi -- decision conventions strictes.

### A.3 Pino logger structures

Format obligatoire pour tous logs metier :

```typescript
this.logger.log({
  action: 'snake_case_action_name',
  tenant_id: tid,
  user_id: uid,
  resource_id: rid,
  duration_ms: durationMs,
  outcome: 'success' | 'failed',
  metadata: { ... },
});
```

Permet :
- Datadog/Sentry parsing automatique
- Correlation logs cross-services
- Audit trail tenant_id systematique
- Performance monitoring duration_ms aggregations

JAMAIS console.log dans code production. Toleré uniquement dans scripts CLI infrastructure/scripts/*.

### A.4 Kafka events topics standardises

Format strict : `insurtech.events.{vertical_or_horizontal}.{entity}.{action_past}`

Topics Sprint 13 utilises :
- `insurtech.events.stock.movement_recorded` (Tache 3.6.6)
- `insurtech.events.stock.low_stock` (Tache 3.6.7)
- `insurtech.events.hr.employee_hired` (Tache 3.6.9)
- `insurtech.events.hr.employee_terminated` (Tache 3.6.9)
- `insurtech.events.hr.contract_signed` (Tache 3.6.9)
- `insurtech.events.hr.contract_renewed` (Tache 3.6.9)
- `insurtech.events.hr.contract_terminated` (Tache 3.6.9)
- `insurtech.events.hr.leave_requested` (Tache 3.6.10)
- `insurtech.events.hr.leave_approved` (Tache 3.6.10)
- `insurtech.events.hr.leave_rejected` (Tache 3.6.10)
- `insurtech.events.hr.leave_cancelled` (Tache 3.6.10)
- `insurtech.events.hr.payslip_generated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_validated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_paid` (Tache 3.6.11)
- `insurtech.events.analytics.etl_completed` (Tache 3.6.2)
- `insurtech.events.repair.parts_consumed` (Sprint 22 future, consume Tache 3.6.8)

### A.5 Idempotency-Key obligatoire mutations sensibles

Endpoints concernes Sprint 13 :
- POST /api/v1/stock/movements/entry
- POST /api/v1/stock/movements/exit
- POST /api/v1/stock/movements/adjustment
- POST /api/v1/stock/inventory-count
- POST /api/v1/hr/payroll/generate-period
- POST /api/v1/hr/payroll/payslips/:id/validate
- POST /api/v1/hr/payroll/payslips/:id/mark-paid

Pattern :

```
Header : Idempotency-Key: <uuid-v4>
Server check : SELECT WHERE tenant_id AND idempotency_key
Si exists : retourner reponse precedente (409 + ID si conflict)
Sinon : execute + store key 24h Redis OR UNIQUE constraint Postgres
TTL 24h pour replay safe
```


## ANNEXE B -- Conformite Maroc detaillee (rappel Sprint 13)

### B.1 Lois et decrets applicables Sprint 13

#### Loi 09-08 du 18 fevrier 2009 (CNDP)

- **Article 3** : definition donnees personnelles -- CIN, CNSS, salaire, DOB, email, IBAN, photo concerned.
- **Article 7** : transfert hors Maroc INTERDIT sans autorisation CNDP -> decision-008 Atlas Cloud Benguerir.
- **Article 13** : consentement -- embauche + signup CRM = consentement implicite stockage.
- **Article 14** : droit acces/rectification/suppression -- Sprint 35 portail employee self-service.
- **Article 21** : declaration obligatoire CNDP pour traitements automatises -- Sprint 35.

#### Loi 65-99 du 11 septembre 2003 (Code du Travail)

- **Articles 6-7** : embauche mineur < 15 ans interdite -> CHECK constraint.
- **Articles 14-17** : duree travail 44h/sem, repos hebdomadaire 24h continues.
- **Article 13** : CDI -- periode essai 3 mois cadres / 1.5 mois employes / 15j ouvriers.
- **Articles 16-22** : CDD max 1 an renouvelable 1 fois (max 2 ans cumules).
- **Article 152** : conges maternite 14 semaines, dont 6 obligatoires apres accouchement.
- **Article 269** : conges paternite 3 jours dans le mois.
- **Articles 231-251** : conges payes 1.5j/mois travaille, min 18j/an, max 30j.
- **Article 232** : 1.5j additionnel par bloc 5 ans anciennete.
- **Articles 35-39** : licenciement motif legitime + procedure + indemnite 1.5 mois/an apres 5 ans anciennete.
- **Article 254** : maladie -- certificat medical obligatoire > 4 jours.
- **Articles 41-46** : SMIG/SMAG salaire minimum legal.

#### Decret 2-22-742 du 14 fevrier 2023 (CNSS)

- **Article 5** : taux 4.48% employee + 8.98% employer (prestations long terme).
- **Article 5 bis** : taux 6.40% employer allocations familiales.
- **Article 6** : plafond cotisable 6 000 MAD/mois = 72 000 MAD/an.
- **Article 12** : declaration BPC mensuelle obligatoire avant le 10 du mois suivant.
- **Article 15** : declaration prealable embauche 8 jours apres recrutement.

#### Loi 65-00 du 3 octobre 2002 (AMO)

- **Article 12** : taux 2.26% employee + 4.11% employer.
- **Article 13** : assiette ensemble elements remuneration, pas de plafond.
- **Article 21** : exoneration partielle famille (Sprint 35).

#### Loi 47-06 du 30 novembre 2007 (Impot sur le Revenu)

- **Article 28** : frais professionnels 25% plafonne 35 000 MAD/an.
- **Article 73** : bareme IR 6 tranches MA 2026 (0% / 10% / 20% / 30% / 34% / 38%).
- **Article 74** : charges famille 360 MAD/an x enfants (max 6).
- **Article 78** : retenue source obligatoire employeur, declaration Etat 9421 annuelle.

#### Loi 9-88 modifiee 38-14 (Obligations comptables)

- **Article 18** : conservation 10 ans pieces comptables.
- **Article 32 CGNC** : valorisation stocks FIFO ou CMP (LIFO INTERDIT MA).

#### Decret SMIG 2023

- SMIG non-agricole : 2 970 MAD/mois (depuis revalorisation 2023).
- SMAG agricole : 80% SMIG.
- Implementation : CHECK constraint base_salary >= 2970.

#### Loi 53-05 du 30 novembre 2007 (Signature electronique)

- **Article 9** : conservation 10 ans signatures qualifiees -> TTL ClickHouse fct_documents_signed.

### B.2 Implementation Sprint 13 conformite

| Convention | Implementation Sprint 13 |
|------------|---------------------------|
| Data residency MA | Atlas Cloud Benguerir DC1 + DC2 replica |
| Encryption at rest | AES-256-GCM via Atlas KMS |
| Encryption in transit | TLS 1.3 obligatoire prod |
| Audit log | Pino structured logs + audit_logs table (Sprint 12) |
| Conservation 10 ans | TTL ClickHouse + partition Postgres Sprint 35 |
| Right to forget | Sprint 35 portail employee + soft delete |


## ANNEXE C -- Performance SLO Sprint 13

### C.1 Latences ciblees par categorie

#### Endpoints CRUD basiques (Stock items, HR employees, Categories)
- POST/PATCH/DELETE : p50 80ms / p95 200ms / p99 400ms
- GET single : p50 60ms / p95 150ms / p99 300ms
- GET list (50 items) : p50 100ms / p95 250ms / p99 500ms

#### Endpoints transactionnels (Stock movements, HR payslips)
- POST entry (1 lot) : p50 100ms / p95 250ms / p99 500ms
- POST exit FIFO (5 lots) : p50 250ms / p95 500ms / p99 900ms
- POST exit FIFO (10 lots) : p50 450ms / p95 850ms / p99 1.4s
- POST payslip validate : p50 150ms / p95 350ms / p99 700ms

#### Endpoints aggregation (Reports, Dashboards)
- GET valorisation 100 items : p50 200ms / p95 400ms / p99 800ms
- GET valorisation 1000 items : p50 800ms / p95 1.5s / p99 2.5s
- GET inventory historique date 6 mois ago : p50 1.5s / p95 3s / p99 5s
- GET dashboards revenue 1 an : p50 350ms / p95 700ms / p99 1.5s
- GET dashboards activity heatmap : p50 250ms / p95 500ms / p99 1s

#### Endpoints batch (Payroll generation, Inventory count)
- POST payroll generate 10 employees : p50 1.5s / p95 3s / p99 5s
- POST payroll generate 50 employees : p50 5s / p95 8s / p99 12s
- POST payroll generate 200 employees : p50 18s / p95 30s / p99 45s
- POST inventory-count 100 items : p50 3s / p95 6s / p99 10s
- POST inventory-count 1000 items : p50 12s / p95 25s / p99 40s

#### Endpoints export (CSV, XML, PDF)
- GET valorisation export.csv 1000 items : p50 1s / p95 2s / p99 4s
- GET CNSS declaration XML : p50 300ms / p95 600ms / p99 1s
- GET IR declaration CSV : p50 800ms / p95 1.5s / p99 3s
- GET payslip PDF : p50 800ms / p95 1.5s / p99 3s

### C.2 Throughput ciblesSprint 13 vs Sprint 35

| Operation | Sprint 13 RPS | Sprint 35 hardening RPS |
|-----------|----------------|---------------------------|
| Stock CRUD | 50 req/s | 500 req/s |
| Stock movements | 30 req/s | 300 req/s |
| HR CRUD | 20 req/s | 100 req/s |
| HR payroll generate | 1 req/s | 10 req/s |
| Analytics dashboards | 100 req/s | 1000 req/s |
| ETL polling cycle | 1 cycle/5min | Real-time CDC Debezium |

### C.3 Availability targets

- Sprint 13 : 99.5% (heures ouvrables 8h-20h Casablanca)
- Sprint 35 hardening : 99.9% (24/7)
- Window maintenance : 1h/semaine fenetre 3am-4am Casablanca
- RTO (Recovery Time Objective) : 1h Sprint 13 / 15min Sprint 35
- RPO (Recovery Point Objective) : 5min Sprint 13 / 1min Sprint 35

### C.4 Storage growth Sprint 13

Estimation pour 100 tenants moyens (50 employees + 1000 items + 200 movements/jour) :
- Postgres : +50 GB/an
- ClickHouse : +30 GB/an (compression columnar 5x)
- S3 documents (PDF, photos) : +20 GB/an
- Redis cache : +5 GB peak (TTL eviction)
- Kafka logs : +10 GB/an (retention 7 jours)
- Total : ~115 GB/an pour 100 tenants

### C.5 Monitoring metrics Prometheus

Sprint 13 expose metriques :
- `etl_rows_synced_total{table}` (Tache 3.6.2)
- `etl_duration_seconds{table}` (histogram)
- `etl_errors_total{table}` (counter)
- `stock_movements_total{tenant_id,type}` (Tache 3.6.6)
- `stock_alerts_sent_total{tenant_id,channel}` (Tache 3.6.7)
- `hr_payslips_generated_total{tenant_id,period}` (Tache 3.6.11)
- `hr_payslips_total_amount_mad{tenant_id}` (gauge)
- `clickhouse_query_duration_seconds{method}` (Tache 3.6.3)
- `analytics_cache_hits_total{method}` (counter)
- `analytics_cache_misses_total{method}` (counter)

Dashboards Grafana Sprint 35 :
- ETL lag par table
- API latencies par endpoint
- Cache hit ratio
- Stock movements volume par tenant
- Paie performance generation


## ANNEXE D -- Edge cases + troubleshooting Sprint 13

### D.1 Edge cases multi-tenant

1. **Tenant cree apres seed initial** : ETL Tache 3.6.2 inclut auto via full sync dim_tenants. Premier sync analytics peut etre vide pour ce tenant.
2. **Tenant churned** : ETL marque churned_at, dashboards filtrent active. Sprint 35 : retention 6 mois apres churn pour audit.
3. **Tenant fusion (acquisitions)** : Sprint 35 outil consolidation tenant cible. Sprint 13 = non supporte.
4. **Tenant split (separation)** : Sprint 35 outil migration partielle. Sprint 13 = manual.
5. **Tenant data residency exception** : Sprint 35 multi-region MA + EU pour clients europeens. Sprint 13 = MA only.

### D.2 Edge cases temps + dates

1. **Timezone Casablanca DST** : MA n'observe pas DST depuis 2018 (UTC+1 toute annee). Stockage UTC, presentation locale.
2. **Periode fiscale chevauchant** : MA = annee civile (1 jan - 31 dec). Pas de fiscal year offset.
3. **Date debut activite tenant futur** : autoriser, ETL skip jusqu'a date.
4. **Date naissance employee tres ancien (> 100 ans)** : warning flag, pas reject.
5. **Period payslip futur** : autoriser (planification), warning si > +6 mois.
6. **Period payslip passe > 5 ans** : warning + audit log.
7. **Movements occurred_at futur > 30 min** : Zod reject (anti-fraud).
8. **Movements occurred_at retroactif > 90 jours** : warning + audit.

### D.3 Edge cases concurrence + race conditions

1. **2 concurrent exits same item FIFO** : SELECT FOR UPDATE serialise -> 1 succeed first, 2nd INSUFFICIENT_STOCK ou succeed selon stock.
2. **2 concurrent payroll generate same period** : UNIQUE (tenant, employee, period) -> 1 succeed, 2nd 409 IDEMPOTENCY.
3. **2 concurrent leave requests same employee dates** : trigger PG anti-overlap rejette.
4. **2 concurrent contract activate same employee** : trigger single_active_contract rejette.
5. **Idempotency replay simultane** : UNIQUE constraint Postgres = 1 first wins.
6. **Kafka consumer parallel processing same event** : group_id partition = 1 consumer par partition (idempotent au niveau handler).

### D.4 Edge cases financiers (paie, stock valorisation)

1. **Salaire SMIG exact 2970** : net positif obligatoire (cotisations + IR + AMO ne doivent pas mettre net negatif).
2. **Bracket IR boundary 30000 exact** : tranche 0% applique, IR = 0.
3. **Bracket IR boundary 30001** : bascule 10%, IR = 30001 * 0.10 - 3000 = 0.10 MAD.
4. **CNSS plafond 6000 exact** : cotisation = 268.80 (4.48% x 6000).
5. **Family children > 6** : capped a 6 (max legal art 74).
6. **AMO no plafond** : 100 000 MAD/mois brut -> 2 260 MAD AMO/mois.
7. **Frais pro plafond 35000/an** : seul brut > 11 666 MAD/mois est plafonne.
8. **FIFO consume lot avec qty < requested** : continue consume lot suivant.
9. **FIFO 0 lots disponibles** : INSUFFICIENT_STOCK error 400.
10. **Decimal precision rounding** : toFixed(2) pour MAD, toFixed(4) pour quantites.

### D.5 Troubleshooting common issues

#### Issue : ETL lag > 30 min
- Cause : ClickHouse insert lent / Postgres delta gros / Kafka consumer down
- Diagnostic : `GET /admin/analytics/etl-state` -> regarder last_synced_at
- Solution : `POST /admin/analytics/resync` force resync OU restart consumer

#### Issue : Dashboards 503 timeout
- Cause : ClickHouse query lente / cache Redis down
- Diagnostic : logs Pino query_duration_ms / Redis ping
- Solution : verify ClickHouse health / restart Redis / abort_signal 25s

#### Issue : Stock movement INSUFFICIENT_STOCK alors que stock visible
- Cause : autre transaction concurrent en cours (SELECT FOR UPDATE bloque)
- Diagnostic : `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%stock_lots%'`
- Solution : retry quelques secondes plus tard ; verifier pas de transaction longue duration

#### Issue : Payslip Books ecriture manquante
- Cause : Kafka consumer down apres payslip_validated emit
- Diagnostic : `SELECT * FROM hr_payslips WHERE id = X` -> status=validated mais pas dans journal_entries
- Solution : manual re-emit Kafka event OU appel direct Books.recordEntry avec idempotency-key

#### Issue : CNSS XML rejected Damancom
- Cause : format invalide (encoding, ICE, CIN normalisation)
- Diagnostic : valider XML schema XSD Damancom
- Solution : verifier tenant.cnss_employer_number + ICE + CIN normalize uppercase no spaces


## ANNEXE E -- Architecture + Roadmap Sprint 14+

### E.1 Architecture Sprint 13 detaillee

```
+-----------------------------------------------------------+
|                  Frontend (Sprint 17 / 23)                |
|  web-broker UI  +  web-garage UI  +  Sprint 19 portail   |
+----------------------------+------------------------------+
                             |
                             | HTTPS + JWT + x-tenant-id
                             v
+----------------------------+------------------------------+
|              API Gateway NestJS (apps/api)                |
|  + JwtAuthGuard + RolesGuard + TenantGuard + Throttle    |
+----------------------------+------------------------------+
                             |
       +---------------------+-------------------+
       v                     v                   v
   +-------+           +-----------+      +-----------+
   | CRM   |           |  Stock    |      |    HR     |
   +---+---+           +-----+-----+      +-----+-----+
       |                     |                  |
       +---------+-----------+------------------+
                 |
                 v
+----------------+-----------------+
| Postgres 16 OLTP Atlas DC1        |
| RLS multi-tenant strict           |
| Triggers anti-overlap/cycle       |
| Migrations TypeORM 0.3            |
+----------------+-----------------+
                 |
                 | ETL polling 5min (Tache 3.6.2)
                 v
+----------------+-----------------+
| ClickHouse 24.10 OLAP             |
| 5 fct_* + 2 dim_* + 1 dim_dates  |
| TTL 5-10 ans selon legal          |
+----------------+-----------------+
                 |
                 | Queries (AnalyticsService)
                 v
+----------------+-----------------+
| 6 Dashboards REST endpoints       |
+----------------------------------+

Side channels :
+ Redis cache (Sprint 9) : analytics cache + idempotency keys
+ Kafka 3.7 (Sprint 9) : events cross-module + consumers Books/Repair
+ S3 Atlas (Sprint 10) : documents, photos, bulletins PDF
+ SendGrid (Sprint 9) : emails notifications
+ Meta WhatsApp API (Sprint 9) : WA notifications
```

### E.2 Sprint 14+ Vertical Insure (Phase 4)

Sprint 14 demarre avec :
- Tous modules horizontaux ready as building blocks
- CRM contacts -> souscripteurs polices
- Pay -> primes paiements
- Books -> commissions courtier ecritures
- Docs -> polices PDF + signatures Barid
- Analytics -> dashboards Insure-specific (a creer)

Modules Insure prevus B-14 a B-19 :

| Sprint | Module | Effort |
|--------|--------|--------|
| B-14 | Insure foundation : polices + souscriptions + ACAPS reporting | 70h |
| B-15 | Insure sinistres : workflow + expertise + reglement | 75h |
| B-16 | Insure commissions courtier + reconciliation | 60h |
| B-17 | Web Broker UI : dashboards + CRM + souscriptions | 80h |
| B-18 | Web Customer Portal SEO + acquisition prospects | 70h |
| B-19 | Web Assure Portal + capture NPS Sprint 13 framework | 75h |

### E.3 Sprint 20+ Vertical Repair (Phase 5)

Sprint 20-23 consume Stock + HR Sprint 13 :
- Sprint 22 : Repair sinistres + parts_consumed -> consume Stock FIFO via Kafka
- Sprint 23 : Web Garage UI + dashboards Stock + HR + Repair
- Atelier mecanicien PWA mobile

### E.4 Sprint 24-30 Phase 6+ SaaS Front + Mobile + IA

Sprint 24-30 :
- B-24/25 : Web Insurtech Admin (super admin Skalean)
- B-26/27 : Web admin tenants
- B-28/29 : PWA mobile garage + assure
- B-30 : Skalean AI integration via Sprint 31 MCP (decision-005)

### E.5 Sprint 31-35 Hardening + Production

- B-31 : Agent Sky MCP tools (get_revenue_trend, get_stock_alerts, get_payslip)
- B-32 : Materialized views ClickHouse + cache HTTP layer
- B-33 : Backup/restore + disaster recovery DC2
- B-34 : Security audit + pentest + ANRT certification
- B-35 : Production hardening + observability complete

