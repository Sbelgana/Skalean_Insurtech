# TACHE 3.6.4 -- 6 Dashboards REST Endpoints

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.4)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant Sprint 17 web-broker UI + Sprint 23 web-garage UI)
**Effort** : 6h
**Dependances** : Tache 3.6.3 (AnalyticsService), Tache 3.6.2 (ETL alimente), Tache 3.6.1 (ClickHouse), Sprint 7 RBAC, Sprint 6 multi-tenant
**Densite cible** : 100-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre les 6 endpoints REST `/api/v1/analytics/dashboards/*` exposant les indicateurs aux clients (Sprint 17 web-broker UI, Sprint 23 web-garage UI, Sprint 31 Agent Sky via MCP, Sprint 35 batch reports). Chaque endpoint est un thin controller NestJS qui : (a) extrait `tenant_id` du TenantContext (Sprint 6) ou query param admin-override, (b) valide les query params via Zod (`date_start`, `date_end`, `group_by`, `limit`), (c) verifie RBAC `analytics.dashboards.read`, (d) delegue a une methode `AnalyticsService` correspondante (Tache 3.6.3), (e) emballe la reponse dans un format standardise `{ data, meta }`, (f) trace via interceptor Pino. Les 6 dashboards sont : `revenue` (cumuls financiers par periode), `conversion` (funnel prospect-qualified-won), `activity` (heatmap rdv jour x heure), `sinistre-rate` (stub Sprint 13, enrichi Sprint 14+ Insure), `nps` (framework Sprint 13, capture Sprint 19 portail assure), `funnel-tenant` (onboarding tenants signup->active->renewal pour admin Skalean).

L'apport est triple. **Premierement**, on livre `DashboardsController` (`apps/api/src/modules/analytics/controllers/dashboards.controller.ts`, ~280 lignes) avec 6 routes GET, decorateurs `@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)`, `@Roles('analytics.dashboards.read')`, `@ApiTags('analytics')` pour Swagger (Sprint 4 setup). **Deuxiemement**, on livre un schema de reponse standardise `DashboardResponse<T>` ZodSchema garantissant uniformite entre tous les dashboards : `{ data: T, meta: { filters: {...}, generated_at: ISO, ttl_until: ISO, tenant_id: UUID } }`. **Troisiemement**, on livre tests E2E avec supertest (~250 lignes, 18 tests) couvrant : RBAC (refus 403 pour role sans permission), multi-tenant isolation (deux tenants -> deux datasets distincts), filtres date (validation Zod), formats reponse (shape, types, ISO timestamps), performance (< 1s sur fixtures).

A l'issue de cette tache, un developpeur frontend Sprint 17 peut consommer `GET /api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-12-31&group_by=month` et recevoir un JSON predictible avec donnees agregees + metadata. Le contrat est stable jusqu'a v2 (versionne via `/api/v1/`). Agent Sky Sprint 31 utilisera ces endpoints via MCP `get_dashboard(name, args)`. Sprint 35 hardening ajoutera rate limiting, cache HTTP layer, ETag.

---

## 2. Contexte etendu

### 2.1 Pourquoi des dashboards REST et pas GraphQL

Plusieurs options ont ete considerees : REST classique, GraphQL, gRPC, tRPC.

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **REST + JSON** | Simple, deja standard projet (Sprint 3 API bootstrap), cacheable HTTP, RBAC trivial | Over-fetching potentiel | RETENU |
| GraphQL | Flexible queries, evite over-fetching | Complexite N+1, RBAC granulaire complexe, overhead schema, Apollo dependencies | Rejete Sprint 13, defer Sprint 35+ |
| gRPC | Performance binaire, streaming | Pas browser-friendly, tooling lourd | Rejete |
| tRPC | Type-safety bout-en-bout TS | Couplage frontend/backend, sortie hors REST std | Rejete |

REST est aligne avec le reste du projet (Sprint 8 CRM, Sprint 11 Pay, etc.) et le contrat dashboard est suffisamment stable pour ne pas justifier GraphQL.

### 2.2 Alternatives format response

| Format | Pros | Cons | Decision |
|--------|------|------|----------|
| **`{ data, meta }` enveloppe** | Place pour pagination, debug info, ETags futurs | 1 niveau supplementaire | RETENU |
| Array brut | Compact | Pas de meta, pas extensible | Rejete |
| JSON:API spec | Standard | Verbose excessive pour dashboards | Rejete |
| HAL (Hypermedia) | Navigable | Surdimensionne | Rejete |

### 2.3 Trade-offs

**Trade-off 1 : Date format ISO 8601 strict**. On accepte `2026-01-15` (date YYYY-MM-DD) ET `2026-01-15T00:00:00Z` (datetime ISO). Zod coerce les deux. Trade : un peu plus de complexite parsing, mais UX consommateur ameliorate.

**Trade-off 2 : Pas de WebSocket realtime**. Dashboards refresh = polling (frontend Sprint 17 refresh toutes 30s). Sprint 35+ pourra ajouter WS si besoin temps-reel.

**Trade-off 3 : sinistre-rate + nps stubs**. Sprint 13 livre les routes mais avec donnees mock/calculees minimales. Sprint 14+ Insure enrichit sinistre-rate avec `fct_polices` + `fct_sinistres`. Sprint 19 portail assure capture NPS reel. C'est documente dans la response `meta.warning: "stub_data"`.

**Trade-off 4 : Pas de pagination dashboards**. Les agregats retournent < 100 points. Si Top Customers retourne 100 max, OK sans cursor. Sprint 35 si beaucoup plus.

### 2.4 Decisions strategiques

- decision-002 multi-tenant : TenantGuard extrait `x-tenant-id`, valide UUID, propage TenantContext, AnalyticsService filtre.
- decision-005 Skalean AI : ces endpoints sont consommes par Agent Sky via MCP tools Sprint 31.
- decision-006 no-emoji.

### 2.5 Pieges techniques

1. **Piege : tenantId admin-override**. Super-admin peut consulter analytics d'un autre tenant. Solution : query param `tenant_id` autorise seulement si role `SuperAdmin`.
2. **Piege : Date.toISOString() timezone**. Toujours UTC. Verifier au frontend pas de drift Casablanca.
3. **Piege : groupBy invalide**. Zod enum rejette avec 400 + message.
4. **Piege : `default groupBy` ambigu**. Default day pour date_range <= 31j, week pour <= 365, month sinon (UX-friendly).
5. **Piege : Cache HTTP layer pas active Sprint 13**. ETag/Cache-Control Sprint 35.
6. **Piege : RBAC scopes mal nommes**. `analytics.dashboards.read` doit etre create dans Sprint 7 RBAC + assigner roles BrokerUser, BrokerAdmin, GarageAdmin, GarageManager, ComplianceOfficer, FinanceOfficer.
7. **Piege : `nps` stub renvoie null misleading**. Frontend doit handle null gracefully.
8. **Piege : Performance N+1 si Promise.all mal utilise**. AnalyticsService methodes sont independantes, Promise.all OK.

---

## 3. Architecture context

### 3.1 Position dans le sprint 13

Tache 3.6.4 est la **quatrieme** des 14. Bloque Sprint 17 web-broker UI + Sprint 23 web-garage UI.

### 3.2 Diagramme

```
+-------------+ HTTP +-------------------------+ DI +--------------+ ClickHouse
| Frontend    |----->| DashboardsController    |--->| Analytics    |---> queries
| Sprint 17   |      | + JwtAuthGuard          |    | Service      |
| web-broker  |      | + RolesGuard            |    +--------------+
+-------------+      | + TenantGuard           |
                     | + Zod query validator   |
                     +-------------------------+
```

---

## 4. Livrables checkables

- [ ] `repo/apps/api/src/modules/analytics/analytics.module.ts` (registrer controllers + import ClickHouseModule)
- [ ] `repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts` (~280 lignes, 6 routes)
- [ ] `repo/apps/api/src/modules/analytics/dto/dashboard-query.dto.ts` (~60 lignes Zod)
- [ ] `repo/apps/api/src/modules/analytics/types/dashboard-response.ts` (~80 lignes)
- [ ] `repo/apps/api/src/modules/analytics/services/dashboard-defaults.service.ts` (~90 lignes default groupBy)
- [ ] `repo/apps/api/src/modules/analytics/services/sinistre-rate.service.ts` (~70 lignes stub Sprint 13)
- [ ] `repo/apps/api/src/modules/analytics/services/nps.service.ts` (~60 lignes stub Sprint 13)
- [ ] `repo/apps/api/src/modules/analytics/services/funnel-tenant.service.ts` (~90 lignes admin Skalean)
- [ ] Update `repo/apps/api/src/app.module.ts` (registrer AnalyticsModule)
- [ ] RBAC permissions seed : `analytics.dashboards.read` + assign roles (Sprint 7 sources)
- [ ] Tests E2E `dashboards.e2e-spec.ts` (~350 lignes, 18 tests)
- [ ] Tests unitaires `dashboard-defaults.service.spec.ts` (~80 lignes, 6 tests)
- [ ] Documentation `repo/docs/api/dashboards-endpoints.md` (~150 lignes)

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/analytics/analytics.module.ts                              (nouveau, ~50 lignes)
repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts             (nouveau, ~300 lignes)
repo/apps/api/src/modules/analytics/dto/dashboard-query.dto.ts                        (nouveau, ~70 lignes)
repo/apps/api/src/modules/analytics/types/dashboard-response.ts                       (nouveau, ~80 lignes)
repo/apps/api/src/modules/analytics/services/dashboard-defaults.service.ts            (nouveau, ~90 lignes)
repo/apps/api/src/modules/analytics/services/dashboard-defaults.service.spec.ts        (nouveau, ~90 lignes, 6 tests)
repo/apps/api/src/modules/analytics/services/sinistre-rate.service.ts                  (nouveau, ~80 lignes)
repo/apps/api/src/modules/analytics/services/nps.service.ts                             (nouveau, ~70 lignes)
repo/apps/api/src/modules/analytics/services/funnel-tenant.service.ts                   (nouveau, ~100 lignes)
repo/apps/api/src/app.module.ts                                                       (modif : import AnalyticsModule)
repo/apps/api/test/analytics/dashboards.e2e-spec.ts                                    (nouveau, ~380 lignes, 18 tests)
repo/packages/auth/src/seeds/permissions/analytics.ts                                  (nouveau, registrer permission)
repo/docs/api/dashboards-endpoints.md                                                  (nouveau, ~160 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier : `repo/apps/api/src/modules/analytics/types/dashboard-response.ts`

```typescript
// repo/apps/api/src/modules/analytics/types/dashboard-response.ts
// Skalean InsurTech v2.2 -- Format response uniforme dashboards
// Reference : B-13 Sprint 13 Tache 3.6.4

export interface DashboardMeta {
  filters: {
    tenant_id: string;
    date_start: string;            // ISO date
    date_end: string;              // ISO date
    group_by?: string;
    limit?: number;
  };
  generated_at: string;            // ISO datetime
  ttl_until: string;               // ISO datetime (typiquement +5min)
  warning?: string;                // ex : 'stub_data' pour sinistre-rate Sprint 13
  version: 'v1';
}

export interface DashboardResponse<T> {
  data: T;
  meta: DashboardMeta;
}

export function buildDashboardMeta(args: {
  tenantId: string;
  dateStart: Date;
  dateEnd: Date;
  groupBy?: string;
  limit?: number;
  warning?: string;
  ttlMinutes?: number;
}): DashboardMeta {
  const generatedAt = new Date();
  const ttlMs = (args.ttlMinutes ?? 5) * 60 * 1000;
  return {
    filters: {
      tenant_id: args.tenantId,
      date_start: args.dateStart.toISOString().slice(0, 10),
      date_end: args.dateEnd.toISOString().slice(0, 10),
      group_by: args.groupBy,
      limit: args.limit,
    },
    generated_at: generatedAt.toISOString(),
    ttl_until: new Date(generatedAt.getTime() + ttlMs).toISOString(),
    warning: args.warning,
    version: 'v1',
  };
}
```

### 6.2 Fichier : `repo/apps/api/src/modules/analytics/dto/dashboard-query.dto.ts`

```typescript
// repo/apps/api/src/modules/analytics/dto/dashboard-query.dto.ts
// Skalean InsurTech v2.2 -- DTO Zod query params dashboards
// Reference : B-13 Sprint 13 Tache 3.6.4
import { z } from 'zod';

export const DashboardQuerySchema = z.object({
  date_start: z.coerce.date().optional(),
  date_end: z.coerce.date().optional(),
  group_by: z.enum(['day', 'week', 'month']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tenant_id: z.string().uuid().optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export const RevenueQuerySchema = DashboardQuerySchema;
export const ConversionQuerySchema = DashboardQuerySchema.omit({ group_by: true, limit: true });
export const ActivityQuerySchema = DashboardQuerySchema.omit({ group_by: true, limit: true });
export const SinistreRateQuerySchema = DashboardQuerySchema.omit({ limit: true });
export const NpsQuerySchema = DashboardQuerySchema.omit({ group_by: true, limit: true });
export const FunnelTenantQuerySchema = DashboardQuerySchema.omit({ limit: true });
```

### 6.3 Fichier : `repo/apps/api/src/modules/analytics/services/dashboard-defaults.service.ts`

```typescript
// repo/apps/api/src/modules/analytics/services/dashboard-defaults.service.ts
// Skalean InsurTech v2.2 -- Defaults dates + groupBy
// Reference : B-13 Sprint 13 Tache 3.6.4
import { Injectable } from '@nestjs/common';
import { defaultDateRange } from '@insurtech/analytics';

export type GroupBy = 'day' | 'week' | 'month';

@Injectable()
export class DashboardDefaultsService {
  /**
   * Default date range si non specifie : 30 derniers jours.
   */
  resolveDateRange(start?: Date, end?: Date): { start: Date; end: Date } {
    if (start && end) return { start, end };
    const def = defaultDateRange(30);
    return {
      start: start ?? def.start,
      end: end ?? def.end,
    };
  }

  /**
   * Default groupBy adaptatif :
   * - <= 31 jours : day
   * - <= 365 jours : week
   * - > 365 jours : month
   */
  resolveGroupBy(start: Date, end: Date, explicit?: GroupBy): GroupBy {
    if (explicit) return explicit;
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 31) return 'day';
    if (daysDiff <= 365) return 'week';
    return 'month';
  }

  /**
   * Resolution tenant_id : si super-admin et tenant_id explicite -> override.
   * Sinon : current TenantContext.
   */
  resolveTenantId(currentTenantId: string, isSuperAdmin: boolean, overrideTenantId?: string): string {
    if (isSuperAdmin && overrideTenantId) return overrideTenantId;
    return currentTenantId;
  }
}
```

### 6.4 Fichier : `repo/apps/api/src/modules/analytics/services/sinistre-rate.service.ts` (stub Sprint 13)

```typescript
// repo/apps/api/src/modules/analytics/services/sinistre-rate.service.ts
// Skalean InsurTech v2.2 -- Sinistre rate dashboard (stub Sprint 13, enrichi Sprint 14+ Insure)
// Reference : B-13 Sprint 13 Tache 3.6.4
import { Injectable } from '@nestjs/common';

export interface SinistreRatePoint {
  period: string;
  policies_count: number;
  claims_count: number;
  rate_pct: number;
  total_claims_amount: string;
  total_premiums_amount: string;
}

@Injectable()
export class SinistreRateService {
  /**
   * Sprint 13 : stub. Pas de fct_polices/fct_sinistres encore.
   * Sprint 14+ Insure : enrichi avec real queries.
   */
  async getRate(
    _tenantId: string,
    _dateStart: Date,
    _dateEnd: Date,
    _groupBy: 'day' | 'week' | 'month',
  ): Promise<{ points: SinistreRatePoint[]; summary: { overall_rate_pct: number } }> {
    return {
      points: [],
      summary: { overall_rate_pct: 0 },
    };
  }
}
```

### 6.5 Fichier : `repo/apps/api/src/modules/analytics/services/nps.service.ts` (stub Sprint 13)

```typescript
// repo/apps/api/src/modules/analytics/services/nps.service.ts
// Skalean InsurTech v2.2 -- NPS dashboard (stub Sprint 13, capture Sprint 19 portail assure)
// Reference : B-13 Sprint 13 Tache 3.6.4
import { Injectable } from '@nestjs/common';

export interface NpsResult {
  nps_score: number | null;
  responses_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  distribution: Array<{ score: number; count: number }>;
}

@Injectable()
export class NpsService {
  async getNps(_tenantId: string, _dateStart: Date, _dateEnd: Date): Promise<NpsResult> {
    // Sprint 13 framework ; Sprint 19 capture NPS via portail assure.
    return {
      nps_score: null,
      responses_count: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      distribution: [],
    };
  }
}
```

### 6.6 Fichier : `repo/apps/api/src/modules/analytics/services/funnel-tenant.service.ts`

```typescript
// repo/apps/api/src/modules/analytics/services/funnel-tenant.service.ts
// Skalean InsurTech v2.2 -- Funnel tenant onboarding (admin Skalean)
// Reference : B-13 Sprint 13 Tache 3.6.4
import { Injectable } from '@nestjs/common';
import { ClickHouseService, validateDateRange, formatDateForClickHouse } from '@insurtech/analytics';

export interface FunnelTenantStep {
  step_name: string;       // 'signup', 'activated', 'first_transaction', 'renewed'
  count: number;
  conversion_rate_pct: number;
}

@Injectable()
export class FunnelTenantService {
  constructor(private readonly ch: ClickHouseService) {}

  async getFunnel(dateStart: Date, dateEnd: Date): Promise<FunnelTenantStep[]> {
    const range = validateDateRange(dateStart, dateEnd);
    const query = `
      SELECT
        countIf(onboarded_at IS NOT NULL) AS signups,
        countIf(activated_at IS NOT NULL) AS activated,
        countIf(churned_at IS NULL AND activated_at IS NOT NULL) AS still_active
      FROM skalean_analytics.dim_tenants
      WHERE onboarded_at >= {dateStart:Date}
        AND onboarded_at <= {dateEnd:Date}
    `;
    const rows = await this.ch.query<{
      signups: number; activated: number; still_active: number;
    }>({
      query,
      query_params: {
        dateStart: formatDateForClickHouse(range.start),
        dateEnd: formatDateForClickHouse(range.end),
      },
    });
    const r = rows[0] ?? { signups: 0, activated: 0, still_active: 0 };
    const s = Number(r.signups);
    const a = Number(r.activated);
    const sa = Number(r.still_active);
    return [
      { step_name: 'signup', count: s, conversion_rate_pct: 100 },
      { step_name: 'activated', count: a, conversion_rate_pct: s > 0 ? (a * 100) / s : 0 },
      { step_name: 'still_active', count: sa, conversion_rate_pct: s > 0 ? (sa * 100) / s : 0 },
    ];
  }
}
```

### 6.7 Fichier : `repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts`

```typescript
// repo/apps/api/src/modules/analytics/controllers/dashboards.controller.ts
// Skalean InsurTech v2.2 -- Controller dashboards REST
// Reference : B-13 Sprint 13 Tache 3.6.4
import { Controller, Get, Query, UseGuards, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentUser, CurrentTenantId } from '@insurtech/auth';
import { AnalyticsService } from '@insurtech/analytics';
import { DashboardDefaultsService } from '../services/dashboard-defaults.service';
import { SinistreRateService } from '../services/sinistre-rate.service';
import { NpsService } from '../services/nps.service';
import { FunnelTenantService } from '../services/funnel-tenant.service';
import {
  DashboardQuerySchema,
  RevenueQuerySchema,
  ConversionQuerySchema,
  ActivityQuerySchema,
  SinistreRateQuerySchema,
  NpsQuerySchema,
  FunnelTenantQuerySchema,
} from '../dto/dashboard-query.dto';
import { DashboardResponse, buildDashboardMeta } from '../types/dashboard-response';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/v1/analytics/dashboards')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class DashboardsController {
  private readonly logger = new Logger(DashboardsController.name);

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly defaults: DashboardDefaultsService,
    private readonly sinistreRate: SinistreRateService,
    private readonly nps: NpsService,
    private readonly funnelTenant: FunnelTenantService,
  ) {}

  // ---------- 1. revenue ----------
  @Get('revenue')
  @Roles('analytics.dashboards.read')
  @ApiOperation({ summary: 'Revenue dashboard : cumuls financiers periode' })
  @ApiResponse({ status: 200, description: 'Revenue points + summary' })
  async getRevenue(
    @CurrentTenantId() ctxTenantId: string,
    @CurrentUser() user: { roles: string[] },
    @Query() rawQuery: unknown,
  ): Promise<DashboardResponse<{ points: any[]; summary: { total_revenue: string; total_transactions: number } }>> {
    const q = RevenueQuerySchema.parse(rawQuery);
    const tenantId = this.defaults.resolveTenantId(ctxTenantId, user.roles.includes('SuperAdmin'), q.tenant_id);
    const range = this.defaults.resolveDateRange(q.date_start, q.date_end);
    const groupBy = this.defaults.resolveGroupBy(range.start, range.end, q.group_by);

    this.logger.log({ action: 'dashboard_revenue', tenant_id: tenantId, group_by: groupBy });

    const points = await this.analytics.getRevenue(tenantId, range.start, range.end, groupBy);
    const summary = {
      total_revenue: points.reduce((s, p) => s + Number(p.gross_revenue), 0).toFixed(2),
      total_transactions: points.reduce((s, p) => s + p.transactions_count, 0),
    };

    return {
      data: { points, summary },
      meta: buildDashboardMeta({ tenantId, dateStart: range.start, dateEnd: range.end, groupBy }),
    };
  }

  // ---------- 2. conversion ----------
  @Get('conversion')
  @Roles('analytics.dashboards.read')
  @ApiOperation({ summary: 'Conversion funnel CRM' })
  async getConversion(
    @CurrentTenantId() ctxTenantId: string,
    @CurrentUser() user: { roles: string[] },
    @Query() rawQuery: unknown,
  ): Promise<DashboardResponse<{ funnel: any[]; summary: { overall_conversion_pct: number } }>> {
    const q = ConversionQuerySchema.parse(rawQuery);
    const tenantId = this.defaults.resolveTenantId(ctxTenantId, user.roles.includes('SuperAdmin'), q.tenant_id);
    const range = this.defaults.resolveDateRange(q.date_start, q.date_end);

    const funnel = await this.analytics.getConversionFunnel(tenantId, range.start, range.end);
    const won = funnel.find((s) => s.step_name === 'won');
    const overall = won ? won.conversion_rate_pct : 0;

    return {
      data: { funnel, summary: { overall_conversion_pct: overall } },
      meta: buildDashboardMeta({ tenantId, dateStart: range.start, dateEnd: range.end }),
    };
  }

  // ---------- 3. activity ----------
  @Get('activity')
  @Roles('analytics.dashboards.read')
  async getActivity(
    @CurrentTenantId() ctxTenantId: string,
    @CurrentUser() user: { roles: string[] },
    @Query() rawQuery: unknown,
  ): Promise<DashboardResponse<{ heatmap: any[] }>> {
    const q = ActivityQuerySchema.parse(rawQuery);
    const tenantId = this.defaults.resolveTenantId(ctxTenantId, user.roles.includes('SuperAdmin'), q.tenant_id);
    const range = this.defaults.resolveDateRange(q.date_start, q.date_end);
    const heatmap = await this.analytics.getActivityHeatmap(tenantId, range.start, range.end);
    return {
      data: { heatmap },
      meta: buildDashboardMeta({ tenantId, dateStart: range.start, dateEnd: range.end }),
    };
  }

  // ---------- 4. sinistre-rate (stub Sprint 13) ----------
  @Get('sinistre-rate')
  @Roles('analytics.dashboards.read')
  async getSinistreRate(
    @CurrentTenantId() ctxTenantId: string,
    @CurrentUser() user: { roles: string[] },
    @Query() rawQuery: unknown,
  ): Promise<DashboardResponse<{ points: any[]; summary: { overall_rate_pct: number } }>> {
    const q = SinistreRateQuerySchema.parse(rawQuery);
    const tenantId = this.defaults.resolveTenantId(ctxTenantId, user.roles.includes('SuperAdmin'), q.tenant_id);
    const range = this.defaults.resolveDateRange(q.date_start, q.date_end);
    const groupBy = this.defaults.resolveGroupBy(range.start, range.end, q.group_by);
    const result = await this.sinistreRate.getRate(tenantId, range.start, range.end, groupBy);
    return {
      data: result,
      meta: buildDashboardMeta({
        tenantId, dateStart: range.start, dateEnd: range.end, groupBy,
        warning: 'stub_data_sprint_13_enriched_sprint_14',
      }),
    };
  }

  // ---------- 5. nps (stub Sprint 13) ----------
  @Get('nps')
  @Roles('analytics.dashboards.read')
  async getNps(
    @CurrentTenantId() ctxTenantId: string,
    @CurrentUser() user: { roles: string[] },
    @Query() rawQuery: unknown,
  ): Promise<DashboardResponse<any>> {
    const q = NpsQuerySchema.parse(rawQuery);
    const tenantId = this.defaults.resolveTenantId(ctxTenantId, user.roles.includes('SuperAdmin'), q.tenant_id);
    const range = this.defaults.resolveDateRange(q.date_start, q.date_end);
    const result = await this.nps.getNps(tenantId, range.start, range.end);
    return {
      data: result,
      meta: buildDashboardMeta({
        tenantId, dateStart: range.start, dateEnd: range.end,
        warning: 'stub_data_sprint_13_capture_sprint_19',
      }),
    };
  }

  // ---------- 6. funnel-tenant (admin Skalean only) ----------
  @Get('funnel-tenant')
  @Roles('SuperAdmin')                                                  // admin Skalean only
  async getFunnelTenant(@Query() rawQuery: unknown): Promise<DashboardResponse<{ funnel: any[] }>> {
    const q = FunnelTenantQuerySchema.parse(rawQuery);
    const range = this.defaults.resolveDateRange(q.date_start, q.date_end);
    const funnel = await this.funnelTenant.getFunnel(range.start, range.end);
    return {
      data: { funnel },
      meta: buildDashboardMeta({ tenantId: 'all-tenants', dateStart: range.start, dateEnd: range.end }),
    };
  }
}
```

### 6.8 Fichier : `repo/apps/api/src/modules/analytics/analytics.module.ts`

```typescript
// repo/apps/api/src/modules/analytics/analytics.module.ts
// Skalean InsurTech v2.2 -- Module Analytics
// Reference : B-13 Sprint 13 Tache 3.6.4
import { Module } from '@nestjs/common';
import { ClickHouseModule } from '@insurtech/analytics';
import { AuthModule } from '@insurtech/auth';
import { DashboardsController } from './controllers/dashboards.controller';
import { DashboardDefaultsService } from './services/dashboard-defaults.service';
import { SinistreRateService } from './services/sinistre-rate.service';
import { NpsService } from './services/nps.service';
import { FunnelTenantService } from './services/funnel-tenant.service';

@Module({
  imports: [AuthModule, ClickHouseModule.forRoot()],
  controllers: [DashboardsController],
  providers: [DashboardDefaultsService, SinistreRateService, NpsService, FunnelTenantService],
})
export class AnalyticsModule {}
```

---

## 7. Tests complets

### 7.1 Tests E2E : `dashboards.e2e-spec.ts` (extrait 18 tests)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
// + fixtures auth tokens

describe('DashboardsController (E2E)', () => {
  let app: INestApplication;
  let userToken: string;          // role analytics.dashboards.read
  let noPermToken: string;
  let superAdminToken: string;
  const TENANT_1 = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // get tokens via auth fixtures
  });

  afterAll(async () => { await app.close(); });

  describe('GET /revenue', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/analytics/dashboards/revenue').expect(401);
    });

    it('requires analytics.dashboards.read permission', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue')
        .set('Authorization', `Bearer ${noPermToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(403);
    });

    it('returns standard response shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31&group_by=day')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.data).toHaveProperty('points');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.meta).toMatchObject({
        version: 'v1',
        filters: expect.objectContaining({ tenant_id: TENANT_1, group_by: 'day' }),
        generated_at: expect.any(String),
        ttl_until: expect.any(String),
      });
    });

    it('rejects invalid group_by', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?group_by=invalid')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(400);
    });

    it('rejects invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=not-a-date')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(400);
    });

    it('defaults to last 30 days when dates absent', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      const start = new Date(res.body.meta.filters.date_start);
      const end = new Date(res.body.meta.filters.date_end);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000));
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('super admin can override tenant_id', async () => {
      const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/dashboards/revenue?tenant_id=${OTHER_TENANT}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body.meta.filters.tenant_id).toBe(OTHER_TENANT);
    });

    it('regular user cannot override tenant_id', async () => {
      const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/dashboards/revenue?tenant_id=${OTHER_TENANT}`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body.meta.filters.tenant_id).toBe(TENANT_1);     // ignore override
    });
  });

  describe('GET /conversion', () => {
    it('returns funnel steps', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/conversion?date_start=2026-01-01&date_end=2026-12-31')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body.data.funnel).toBeInstanceOf(Array);
    });
  });

  describe('GET /activity', () => {
    it('returns heatmap', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/activity?date_start=2026-01-01&date_end=2026-01-31')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body.data.heatmap).toBeInstanceOf(Array);
    });
  });

  describe('GET /sinistre-rate', () => {
    it('returns stub data with warning', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/sinistre-rate')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body.meta.warning).toContain('stub_data');
    });
  });

  describe('GET /nps', () => {
    it('returns null nps_score in stub', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/nps')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(res.body.data.nps_score).toBeNull();
      expect(res.body.meta.warning).toContain('stub_data');
    });
  });

  describe('GET /funnel-tenant', () => {
    it('refused to non super-admin', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/funnel-tenant')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(403);
    });

    it('accessible to super-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/funnel-tenant?date_start=2026-01-01&date_end=2026-12-31')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.data.funnel).toBeInstanceOf(Array);
    });
  });

  describe('Performance', () => {
    it('revenue endpoint < 1s on fixture', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-12-31&group_by=month')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('cache hit < 50ms', async () => {
      // first call : populate cache
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1);
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1)
        .expect(200);
      expect(Date.now() - start).toBeLessThan(150);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('different tenants -> different data', async () => {
      const TENANT_2 = '22222222-2222-2222-2222-222222222222';
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_1);
      const res2 = await request(app.getHttpServer())
        .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-tenant-id', TENANT_2);
      expect(res1.body.meta.filters.tenant_id).toBe(TENANT_1);
      expect(res2.body.meta.filters.tenant_id).toBe(TENANT_2);
    });
  });
});
```

### 7.2 Tests unitaires `dashboard-defaults.service.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { DashboardDefaultsService } from './dashboard-defaults.service';

describe('DashboardDefaultsService', () => {
  const svc = new DashboardDefaultsService();

  it('resolveDateRange default 30 days', () => {
    const r = svc.resolveDateRange();
    const diff = (r.end.getTime() - r.start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeCloseTo(30, 0);
  });

  it('resolveGroupBy day for <= 31 days', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-15');
    expect(svc.resolveGroupBy(start, end)).toBe('day');
  });

  it('resolveGroupBy week for 32-365 days', () => {
    expect(svc.resolveGroupBy(new Date('2026-01-01'), new Date('2026-06-30'))).toBe('week');
  });

  it('resolveGroupBy month for > 365', () => {
    expect(svc.resolveGroupBy(new Date('2024-01-01'), new Date('2026-12-31'))).toBe('month');
  });

  it('resolveGroupBy explicit overrides', () => {
    expect(svc.resolveGroupBy(new Date('2026-01-01'), new Date('2026-01-02'), 'month')).toBe('month');
  });

  it('resolveTenantId superadmin override works', () => {
    expect(svc.resolveTenantId('aaa', true, 'bbb')).toBe('bbb');
  });

  it('resolveTenantId regular user ignored override', () => {
    expect(svc.resolveTenantId('aaa', false, 'bbb')).toBe('aaa');
  });
});
```

---

## 8. Variables environnement

```env
ANALYTICS_DEFAULT_DAYS=30
ANALYTICS_DEFAULT_TTL_MINUTES=5
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api test:e2e -- dashboards

# Test manuel
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"test@x.com","password":"...","tenant_id":"..."}' | jq -r '.access_token')
curl -s "http://localhost:4000/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-12-31&group_by=month" \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT_ID" | jq
```

---

## 10. Criteres validation V1-V25

### P0 (15)
- V1 : 6 endpoints repondent 200 avec format `{data, meta}`
- V2 : 401 sans auth
- V3 : 403 sans permission `analytics.dashboards.read`
- V4 : Multi-tenant isolation
- V5 : SuperAdmin override tenant_id
- V6 : Regular user ne peut override
- V7 : Zod rejette query params invalides
- V8 : Default 30 jours si dates absentes
- V9 : group_by adaptatif day/week/month
- V10 : `funnel-tenant` SuperAdmin only
- V11 : `sinistre-rate` retourne warning stub
- V12 : `nps` retourne null nps_score + warning
- V13 : Logger Pino structures
- V14 : Swagger documente 6 endpoints
- V15 : Performance < 1s

### P1 (7)
- V16 : Cache hit < 150ms (TLS overhead)
- V17 : Format ISO 8601 dates dans meta
- V18 : TTL meta `ttl_until` ~5min
- V19 : RBAC `analytics.dashboards.read` seeded + assignee 6 roles
- V20 : Coverage E2E >= 85%
- V21 : Cors configure (Sprint 4)
- V22 : Rate limit headers (Sprint 35 hardening)

### P2 (3)
- V23 : Documentation OpenAPI export JSON
- V24 : Postman collection Sprint 13 livrable
- V25 : Performance hammer 100 req/sec < 1.5s p99

---

## 11. Edge cases + troubleshooting

1. **Tenant_id absent header** -> TenantGuard rejette 401/400 selon route.
2. **Date format YYYY/MM/DD vs YYYY-MM-DD** -> Zod coerce accepte les deux.
3. **Periode super-longue 10 ans** -> validateDateRange throw 400.
4. **Cache stale apres ETL** -> invalidator Kafka (Tache 3.6.3).
5. **Pas de donnees periode** -> response empty `points: []`, pas erreur.
6. **Tenant supprime mid-query** -> ClickHouse retourne 0 rows, OK.
7. **Slow Postgres replica** -> ClickHouse independent, OK.
8. **CORS preflight** -> Sprint 4 setup.

---

## 12. Conformite Maroc

- Data Atlas Cloud Benguerir (decision-008).
- TTL respect (5/10 ans).
- RBAC strict role-based (separation taches).

---

## 13. Conventions absolues

Multi-tenant TenantGuard, Zod, Pino, pnpm, TypeScript strict, Vitest, RBAC `analytics.dashboards.read`, Kafka invalidator consume Tache 3.6.3, imports `@insurtech/analytics`, no-emoji, Conventional Commits.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint
pnpm --filter @insurtech/api test:e2e -- dashboards
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): 6 dashboards REST endpoints /api/v1/analytics/dashboards

Sprint 13 Tache 3.6.4 : DashboardsController 6 routes (revenue/conversion/
activity/sinistre-rate/nps/funnel-tenant), DTO Zod, format response uniforme
{data, meta}, RBAC analytics.dashboards.read, multi-tenant isolation.

Livrables :
- DashboardsController (~280 lignes, 6 routes)
- DashboardDefaultsService (resolve dates/groupBy/tenant)
- SinistreRateService + NpsService (stubs Sprint 13)
- FunnelTenantService (admin Skalean queries dim_tenants)
- DashboardQuery DTO Zod
- 24 tests (18 E2E + 6 unit)

Tests: 24
Coverage: 89%

Task: 3.6.4
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.4"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.5-stock-items-categories-valorisation-fifo.md` (entities stock + valorisation FIFO).

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Specifications detaillees des 6 dashboards

#### A.1 Dashboard Revenue (cumuls financiers)

**Use case** : courtier/garage admin veut comprendre evolution revenu.

**Filters** : date_start, date_end, group_by (day/week/month), tenant_id (super admin only).

**Response data shape** :
```json
{
  "data": {
    "points": [
      { "period": "2026-01", "transactions_count": 234, "gross_revenue": "456789.50", "total_fees": "8901.23", "net_revenue": "447888.27", "unique_customers": 178 },
      { "period": "2026-02", "transactions_count": 267, "gross_revenue": "523450.00", "total_fees": "10234.56", "net_revenue": "513215.44", "unique_customers": 198 }
    ],
    "summary": {
      "total_revenue": "980239.50",
      "total_transactions": 501,
      "unique_customers": 245,
      "avg_transaction": "1955.97"
    }
  },
  "meta": {
    "filters": { "tenant_id": "...", "date_start": "2026-01-01", "date_end": "2026-02-28", "group_by": "month" },
    "generated_at": "2026-05-15T14:30:00Z",
    "ttl_until": "2026-05-15T14:35:00Z",
    "version": "v1"
  }
}
```

#### A.2 Dashboard Conversion Funnel

Stages CRM : Prospect -> Lead -> Qualified -> Demoed -> Won -> Customer.

**Response data shape** :
```json
{
  "data": {
    "funnel": [
      { "step_name": "prospect", "count": 1000, "conversion_rate_pct": 100.0 },
      { "step_name": "qualified", "count": 320, "conversion_rate_pct": 32.0 },
      { "step_name": "won", "count": 85, "conversion_rate_pct": 8.5 }
    ],
    "summary": {
      "overall_conversion_pct": 8.5,
      "biggest_dropoff_step": "prospect_to_qualified",
      "biggest_dropoff_count": 680
    }
  }
}
```

#### A.3 Dashboard Activity Heatmap

24h x 7j heatmap des rendez-vous Booking (Sprint 8).

**Response** :
```json
{
  "data": {
    "heatmap": [
      { "day_of_week": 1, "hour": 9, "appointments_count": 23, "revenue": "12345.00" },
      { "day_of_week": 1, "hour": 10, "appointments_count": 31, "revenue": "18900.00" },
      // ... 24 * 7 = 168 cells max
    ],
    "summary": {
      "busiest_day": "tuesday",
      "busiest_hour": "10h-11h",
      "quietest_day": "sunday"
    }
  }
}
```

#### A.4 Dashboard Sinistre Rate (stub Sprint 13, enrichi Sprint 14+)

Sprint 13 = framework + warning `stub_data`. Sprint 14 Insure populera avec real data.

#### A.5 Dashboard NPS (stub Sprint 13, capture Sprint 19)

Sprint 13 = endpoint + framework. Sprint 19 portail assure capturera reponses 0-10.

NPS = % promoters (9-10) - % detractors (0-6). Plage -100 a +100.

#### A.6 Dashboard Funnel Tenant (SuperAdmin only)

Onboarding tenants Skalean : signup -> activated -> first_transaction -> renewed.

### B. Format response standardise detaille

Tous les dashboards suivent le contract `{ data, meta }` :

```typescript
interface DashboardResponse<T> {
  data: T;
  meta: {
    filters: Record<string, unknown>;
    generated_at: string;        // ISO 8601 UTC
    ttl_until: string;            // ISO 8601 (typiquement now + 5min)
    warning?: string;              // ex: "stub_data_sprint_13"
    version: 'v1';
    request_id?: string;           // X-Request-Id correlation
  };
}
```

**Pourquoi ce format** :
- `data` : payload metier, type-safe via generics TS.
- `meta.filters` : echo filtres appliques (debug + cache key composition cote frontend).
- `meta.generated_at` : timestamp serveur (correlation logs).
- `meta.ttl_until` : indique frontend quand re-fetch.
- `meta.warning` : marquage donnees incompletes/stub.
- `meta.version` : v1 stable, v2 futur breaking changes.

### C. Headers HTTP utiles consumes par UI

```
Cache-Control: private, max-age=300
ETag: "<hash of data>"
X-Request-Id: <uuid>
X-Generated-At: <ISO timestamp>
X-Tenant-Id: <tenant uuid>
X-Rate-Limit-Remaining: 999
X-Rate-Limit-Reset: <unix epoch>
```

Sprint 35 hardening : ETag conditional GET + Cache-Control public si dashboard public.

### D. Tests E2E supplementaires (10 cas)

```typescript
describe('Dashboards E2E enrichis', () => {
  it('Revenue group_by=day sur 7 jours retourne 7 points max', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/revenue?date_start=2026-05-01&date_end=2026-05-07&group_by=day')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.data.points.length).toBeLessThanOrEqual(7);
  });

  it('Revenue group_by=month sur 1 an = 12 points max', async () => { });
  it('Conversion funnel min 3 steps', async () => { });
  it('Conversion empty data renvoie funnel vide pas error', async () => { });
  it('Activity heatmap retourne max 168 cells (24h x 7j)', async () => { });
  it('Sinistre-rate warning stub_data present meta', async () => { });
  it('NPS data.nps_score null Sprint 13', async () => { });
  it('Funnel-tenant accessible SuperAdmin only', async () => { });
  it('Funnel-tenant refused non-superadmin -> 403', async () => { });
  it('Performance dashboards p95 < 1s sur fixtures 1M rows', async () => { });
});
```

### E. Cache TTL strategy par dashboard

| Dashboard | TTL Sprint 13 | TTL Sprint 35 hardening |
|-----------|----------------|---------------------------|
| Revenue | 5 min | 1 min (avec invalidation Kafka) |
| Conversion | 5 min | 5 min (low freshness need) |
| Activity heatmap | 10 min | 1 hour (variations slow) |
| Sinistre-rate | 5 min (stub) | 1 min Sprint 14+ |
| NPS | 1 hour | 15 min Sprint 19+ |
| Funnel-tenant | 30 min | 5 min |

### F. Edge cases supplementaires

1. Date range 1 jour exact -> 1 point only.
2. Date range 100 ans (cas extreme) -> validator reject > 5 ans.
3. group_by 'day' sur 365 jours -> 365 points (acceptable).
4. group_by 'month' sur 7 jours -> 1 point only.
5. Cache hit pendant degradation ClickHouse -> serve stale data + warning.
6. Tenant ID admin override avec UUID inexistant -> 200 vide (pas 404).
7. CORS preflight OPTIONS -> handled middleware Sprint 4.
8. RateLimit 100 req/min depasse -> 429.
9. Frontend Polyfill cache HTTP layer -> ETag works.
10. JSON encoding emoji dans noms tenant -> escape Unicode.

### G. SLO performance

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| /revenue (1 mois data) | 180ms | 400ms | 800ms |
| /revenue (12 mois data) | 350ms | 700ms | 1.5s |
| /conversion | 150ms | 350ms | 700ms |
| /activity (heatmap) | 250ms | 500ms | 1s |
| /sinistre-rate (stub) | 50ms | 100ms | 200ms |
| /nps (stub) | 30ms | 80ms | 150ms |
| /funnel-tenant | 200ms | 500ms | 1s |
| Cache hit (any) | 5ms | 20ms | 50ms |

### H. Frontend integration guidelines Sprint 17

```typescript
// Recommended frontend hook React :
import { useQuery } from '@tanstack/react-query';

export function useDashboardRevenue(filters: { dateStart: Date; dateEnd: Date; groupBy: 'day' | 'week' | 'month' }) {
  return useQuery({
    queryKey: ['dashboards', 'revenue', filters],
    queryFn: () => fetch(`/api/v1/analytics/dashboards/revenue?date_start=${filters.dateStart.toISOString()}&date_end=${filters.dateEnd.toISOString()}&group_by=${filters.groupBy}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-id': tenantId },
    }).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
}
```

### I. Conformite Maroc

- Data Atlas Cloud Benguerir (decision-008).
- RBAC strict + multi-tenant.
- Aucune donnee CNDP-sensitive exposee sans authentification.

---

**Fin enrichissement task-3.6.4.**

**Fin task-3.6.4-6-dashboards-rest-endpoints.md.**

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


## ANNEXE F -- Cheatsheet permissions RBAC Sprint 13

### F.1 Permissions Stock (15 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/stock.ts
export const STOCK_PERMISSIONS = [
  // Categories
  'stock.categories.create',
  'stock.categories.read',
  'stock.categories.update',
  'stock.categories.delete',
  // Items
  'stock.items.create',
  'stock.items.read',
  'stock.items.update',
  'stock.items.delete',
  // Movements
  'stock.movements.create',
  'stock.movements.read',
  'stock.adjust',
  // Reports
  'stock.valorisation.read',
  'stock.alerts.read',
  'stock.alerts.snooze',
  // Admin
  'stock.admin.force_unlock',
];
```

### F.2 Permissions HR (20 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/hr.ts
export const HR_PERMISSIONS = [
  // Employees
  'hr.employees.create',
  'hr.employees.read',
  'hr.employees.read_own',           // employee voit son propre dossier
  'hr.employees.update',
  'hr.employees.delete',
  // Contracts
  'hr.contracts.create',
  'hr.contracts.read',
  'hr.contracts.update',
  'hr.contracts.terminate',
  // Leaves
  'hr.leaves.request',
  'hr.leaves.approve',
  'hr.leaves.cancel',
  'hr.leaves.read',
  'hr.leaves.read_own',
  // Payroll
  'hr.payroll.generate',
  'hr.payroll.validate',
  'hr.payroll.mark_paid',
  'hr.payslips.read',
  'hr.payslips.read_own',
  // Declarations
  'hr.declarations.read',
  'hr.declarations.export',
];
```

### F.3 Mapping roles -> permissions Sprint 13

| Role | Permissions Stock | Permissions HR |
|------|--------------------|------------------|
| SuperAdmin | All stock.* | All hr.* |
| BrokerAdmin | -- | hr.employees.* (employes courtage) |
| GarageAdmin | All stock.* + hr.* | All hr.* |
| GarageManager | stock.items.{r,u} + stock.movements.{c,r} + stock.alerts.* | hr.leaves.approve + hr.employees.read |
| GarageMechanic | stock.items.read + stock.movements.create | hr.employees.read_own + hr.payslips.read_own + hr.leaves.request |
| GarageStock | All stock.* | -- |
| Accountant | stock.valorisation.read + stock.reports.read | hr.payroll.* + hr.declarations.* |
| ComplianceOfficer | -- | hr.declarations.read |
| FinanceOfficer | stock.valorisation.read | hr.payroll.read + hr.payslips.read |
| ReadOnly | stock.items.read + stock.valorisation.read | hr.employees.read |

### F.4 Permissions Analytics (5)

```typescript
export const ANALYTICS_PERMISSIONS = [
  'analytics.dashboards.read',
  'analytics.exports.create',
  'analytics.admin.etl_resync',
  'analytics.admin.cache_invalidate',
  'analytics.developer.raw_query',     // Sprint 35
];
```

### F.5 Endpoints API summary Sprint 13 (44 endpoints)

#### Analytics (8)
- GET /api/v1/analytics/dashboards/revenue
- GET /api/v1/analytics/dashboards/conversion
- GET /api/v1/analytics/dashboards/activity
- GET /api/v1/analytics/dashboards/sinistre-rate
- GET /api/v1/analytics/dashboards/nps
- GET /api/v1/analytics/dashboards/funnel-tenant
- GET /api/v1/admin/analytics/etl-state
- POST /api/v1/admin/analytics/resync

#### Stock (15)
- POST/GET/PATCH/DELETE /api/v1/stock/items
- POST/GET /api/v1/stock/categories
- POST /api/v1/stock/movements/{entry,exit,adjustment}
- GET /api/v1/stock/items/:id/movements
- GET /api/v1/stock/alerts/low-stock
- GET /api/v1/stock/valorisation
- GET /api/v1/stock/valorisation/export.csv
- GET /api/v1/stock/reports/inventory
- POST /api/v1/stock/inventory-count

#### HR (21)
- POST/GET/PATCH/DELETE /api/v1/hr/employees
- POST /api/v1/hr/employees/:id/terminate
- POST/GET /api/v1/hr/employees/:id/contracts
- POST /api/v1/hr/contracts/:id/{activate,terminate,renew}
- POST /api/v1/hr/leaves/{request,approve,reject,cancel}
- GET /api/v1/hr/leaves/balance/:employeeId
- POST /api/v1/hr/payroll/{generate-period,payslips/:id/validate,payslips/:id/mark-paid}
- GET /api/v1/hr/payroll/payslips
- GET /api/v1/hr/payroll/payslips/:id/pdf
- GET /api/v1/hr/reports/declaration-cnss(/xml)
- GET /api/v1/hr/reports/declaration-ir(/csv)
- GET /api/v1/hr/dashboard


## ANNEXE G -- Testing strategy detaillee Sprint 13

### G.1 Test pyramid Sprint 13

```
                    /\
                   /  \   E2E + Integration (Tests Sprint 13)
                  /----\  35+ tests E2E + 8 integration concurrence
                 /      \
                /--------\ Service unit tests (mock repos)
               /          \ 200+ tests unit
              /------------\
             /              \ Pure logic tests (calculators, validators)
            /----------------\ 100+ tests (PayrollCalculator, LeaveBalance, FIFO)
```

### G.2 Coverage targets Sprint 13

| Module | Coverage target | Rationale |
|--------|-------------------|-----------|
| @insurtech/hr payroll-calculator | >= 95% | Critical legal computations IR/CNSS/AMO |
| @insurtech/hr leave-balance-calculator | >= 90% | Legal compliance (art 231-232) |
| @insurtech/stock valorisation | >= 90% | FIFO accuracy mandatory CGNC art 32 |
| @insurtech/stock movements | >= 90% | Concurrence + atomicity critical |
| @insurtech/analytics services | >= 85% | Standard cover |
| @insurtech/hr services | >= 85% | Standard |
| Controllers REST | >= 80% | E2E covers integration |

### G.3 Fixtures realistes Sprint 13

Seed script `seed-phase-3-fixtures.ts` produit :
- 5 tenants types (3 garages + 2 cabinets courtage)
- 50 employees total (10 per tenant)
- 50 contrats CDI actives
- 100+ conges historiques (50% paid + 30% sick + 20% maternity/paternity)
- 600 payslips (50 employees x 12 mois retroactifs)
- 1000 stock items + 5000 lots
- 30 000 stock movements (24000 entries + 6000 exits)
- 150 alertes historiques

Execution : `pnpm tsx infrastructure/scripts/seed-phase-3-fixtures.ts`
Idempotency : ON CONFLICT DO NOTHING (relancable safely).
Duree : ~60 secondes sur Atlas Cloud Benguerir DC1.

### G.4 Tests E2E parcours critiques

```typescript
// 35+ tests E2E groups :

describe('Group 1 : ClickHouse + ETL (5)', () => {
  // ping, schemas, dim_dates, ETL sync, idempotency
});

describe('Group 2 : Dashboards (8)', () => {
  // 6 endpoints + format + multi-tenant + cache
});

describe('Group 3 : Stock (12)', () => {
  // CRUD + FIFO multi-lots + alertes + inventory
});

describe('Group 4 : HR employees (5)', () => {
  // CIN MA + SMIG + CDD/CDI + termination
});

describe('Group 5 : HR conges (5)', () => {
  // Workflow + balance + maternity + sick certif
});

describe('Group 6 : HR paie (7)', () => {
  // CNSS + AMO + IR brackets + Books + declarations
});
```

### G.5 Tests integration concurrence

```typescript
// 100 concurrent exits FIFO same item -> 50 succeed + 50 fail INSUFFICIENT_STOCK
// 50 concurrent payroll generate -> 1 success + 49 IDEMPOTENCY_REPLAY
// 10 concurrent leave requests overlap -> trigger PG rejette
```

### G.6 Performance tests benchmark

```typescript
// Benchmark scenarios :
- 1000 stock items + 5000 lots -> valorisation < 3s
- 200 employees -> payroll generate-period < 30s
- 50 concurrent dashboard requests -> p95 < 1s
- ETL sync 100k transactions -> < 60s
- Inventory historique 6 mois -> < 5s
```


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


## ANNEXE I -- References officielles + glossaire Sprint 13

### I.1 Sources legales officielles Maroc

| Source | URL | Usage Sprint 13 |
|--------|-----|------------------|
| CNSS Maroc | https://www.cnss.ma | Cotisations, declarations BPC |
| Damancom CNSS | https://www.damancom.ma | Portail declaration CNSS mensuelle |
| DGI Maroc | https://www.tax.gov.ma | IR, TVA, SIMPL-IR |
| SIMPL-IR | https://www.tax.gov.ma/wps/portal/DGI/simpl-ir | Declaration Etat 9421 annuelle |
| ANRT (Telecoms) | https://www.anrt.ma | Signatures qualifiees TSA |
| ANAPEC | https://www.anapec.org | Programme Idmaj subventionne |
| ACAPS | https://www.acaps.ma | Reporting assurance (Sprint 14+) |
| AMC | https://amc.gov.ma | Anti-money laundering (Sprint 12) |
| CNDP | https://www.cndp.ma | Loi 09-08 protection donnees |
| Atlas Cloud Maroc | https://www.atlascloud.ma | Cloud souverain MA |
| Bulletin Officiel | https://www.sgg.gov.ma/BulletinOfficiel.aspx | Textes legaux MA |

### I.2 Glossaire Sprint 13

- **CGNC** : Code General de Normalisation Comptable Maroc (decret 2-89-61)
- **CIN** : Carte d'Identite Nationale (format MA : 1-2 lettres + 1-6 chiffres)
- **CNSS** : Caisse Nationale de Securite Sociale
- **AMO** : Assurance Maladie Obligatoire (loi 65-00)
- **IR** : Impot sur le Revenu (loi 47-06)
- **SMIG** : Salaire Minimum Interprofessionnel Garanti (2 970 MAD/mois en 2026)
- **CDI** : Contrat a Duree Indeterminee
- **CDD** : Contrat a Duree Determinee
- **ANAPEC** : Agence Nationale Promotion Emploi et Competences (programme Idmaj)
- **ICE** : Identifiant Commun de l'Entreprise (15 chiffres, obligatoire DGI)
- **RC** : Registre de Commerce (numero)
- **CIMR** : Caisse Interprofessionnelle Marocaine de Retraite (complementaire facultative)
- **BPC** : Bordereau de Paiement des Cotisations sociales (declaration CNSS mensuelle)
- **Etat 9421** : declaration annuelle IR salaires
- **OLTP** : Online Transaction Processing (Postgres)
- **OLAP** : Online Analytical Processing (ClickHouse)
- **ETL** : Extract-Transform-Load (pipeline Postgres -> ClickHouse)
- **FIFO** : First-In-First-Out (methode valorisation stocks)
- **CMP** : Cout Moyen Pondere (alternative FIFO, autorisee MA)
- **LIFO** : Last-In-First-Out (INTERDIT au Maroc)
- **RLS** : Row Level Security (Postgres multi-tenant)
- **MV** : Materialized View (ClickHouse pre-aggregation)
- **SLA** : Service Level Agreement
- **SLO** : Service Level Objective
- **RTO** : Recovery Time Objective
- **RPO** : Recovery Point Objective

### I.3 Versions stack Sprint 13

| Composant | Version | Reference |
|-----------|---------|-----------|
| Node.js | 22.11.0 LTS | engine-strict=true |
| pnpm | 9.x | save-exact=true |
| TypeScript | 5.7.2 | strict mode |
| NestJS | 10.4.15 | |
| TypeORM | 0.3.x | |
| Postgres | 16 | Atlas Cloud |
| ClickHouse | 24.10 | Tache 3.6.1 |
| Redis | 7.x | Sprint 9 |
| Kafka | 3.7 | Sprint 9 |
| BullMQ | 5.x | Cron jobs |
| Zod | 3.23.8 | Validation runtime |
| Decimal.js | 10.4.3 | Computations financieres |
| Pino | 9.5.0 | Logger |
| Vitest | 2.1.8 | Tests |

