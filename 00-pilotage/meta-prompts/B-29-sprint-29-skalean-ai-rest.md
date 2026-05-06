# META-PROMPT B-29 -- SPRINT 29 SKALEAN AI REST INTEGRATION

**Version** : v2.2 (Option B -- PREMIER sprint Phase 7)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 29 / 35 (cumul) -- Phase 7 Sprint 1
**Position** : Apres Phase 6 admin platform complete, debut Phase 7 hardening
**Numerotation taches** : 7.1.1 a 7.1.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (AI-defere swap -- decision-007 mise en oeuvre)

---

## Objectif Global du Sprint

Implementer **SkaleanAiVisionClient reel** en remplacement du `MockIaEstimationClient` Sprint 20 + activation pattern AI-defere swap (decision-007). Sprint 29 = premier sprint Phase 7 + execute la promesse architecturale : **swap one-line config** (`IA_ESTIMATION_PROVIDER=skalean_ai`) bascule du mock realistic vers Skalean AI vision API reel.

A la sortie de ce sprint :
- SkaleanAiVisionClient implementation complete (HTTP REST integration)
- Authentication Bearer + tenant context headers
- Cache Redis 24h reuse Sprint 20 wrapper
- Migration validation : compare 100 estimations Mock vs Real (coherence outputs)
- Cost monitoring : Skalean AI per-call pricing tracking + alerts budget
- Performance comparison : latency p95 Mock vs Real
- Rollback procedure documente
- Health check + circuit breaker
- Tests integration end-to-end (sandbox Skalean AI)
- Activation gradual : 10% trafic real / 90% mock -> 50/50 -> 100% real

---

## Frontiere du Sprint

**INCLUS** :
- SkaleanAiVisionClient HTTP integration
- Auth + headers + versioning
- Cache reuse Sprint 20 wrapper
- Migration validation Mock vs Real
- Cost monitoring + alerts budget
- Health check + circuit breaker
- Activation gradual (feature flag percentage rollout)
- Rollback procedure
- Tests integration

**EXCLU** (sera ajoute aux sprints suivants) :
- Skalean AI MCP (Model Context Protocol) integration -- Sprint 30
- Agent Sky multilingue chatbot -- Sprint 31
- Skalean AI other capabilities (text generation, embeddings) -- Phase 7+
- IA-powered features avances (fraud detection, lifetime value) -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 20 : MockIaEstimationClient + interface + DI module
2. Decision-007 : AI-defere strategy
3. Skalean AI service documentation (vision API contract -- assumed available externe)
4. Sortie Sprint 26 : admin monitoring health endpoints

## Dependencies Sprint precedents (explicites)

Ce Sprint 29 **depend critiquement** de :
- **Sprint 13** (Analytics ClickHouse + ETL) : pipeline ETL ClickHouse alimente ai_usage_metrics + ia_cost_tracking ; dashboards consommation Skalean AI tokens + cout MAD per call ; SkaleanAiClient cost monitoring publish events sur topic `insurtech.events.ai.usage.*` consume par ETL ClickHouse Sprint 13
- **Sprint 20** (IA Estimation Photos Mock) : interface `IaEstimationPhotosClient` definie ; Sprint 29 livre implementation reelle `SkaleanAiVisionClient` swap-able (decision-007)
- **Sprint 26** (Admin Foundation) : monitoring endpoints `/health/ai` + alerting budget Skalean AI
- **Sprint 6/7** (Multi-tenant + RBAC) : SkaleanAiClient respect tenant context propagation + permissions `ai.skalean.invoke`

---

## Stack Imposee (Sprint 29)

| Composant | Version | Notes |
|-----------|---------|-------|
| undici | 7.1.1 | HTTP client (Skalean AI calls) |
| opossum | 8.5.0 | circuit breaker |
| zod | 3.24.1 | validation responses Skalean AI |

Variables env :
- `SKALEAN_AI_API_BASE_URL` (e.g. `https://ai.skalean.ma/v1`)
- `SKALEAN_AI_API_KEY` (Bearer token)
- `SKALEAN_AI_API_VERSION` (e.g. `2026-05-01`)
- `IA_ESTIMATION_ROLLOUT_PERCENT` (0-100, default 0 Sprint 29 boot, augmente progressivement)
- `SKALEAN_AI_BUDGET_MAD_MONTHLY` (alert threshold)

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 7.1.1 | SkaleanAiVisionClient HTTP REST implementation complete | 7h | P0 | Sprint 20 |
| 7.1.2 | Auth Bearer + headers + versioning + retry strategy | 5h | P0 | 7.1.1 |
| 7.1.3 | Cache Redis 24h reuse + cost reduction strategy | 5h | P0 | 7.1.2 |
| 7.1.4 | Circuit breaker + health check + fallback Mock | 6h | P0 | 7.1.3 |
| 7.1.5 | Cost monitoring : per-call pricing + budget alerts | 6h | P0 | 7.1.4 |
| 7.1.6 | Activation gradual feature flag : 0% -> 10% -> 50% -> 100% | 5h | P0 | 7.1.5 |
| 7.1.7 | Migration validation : compare 100 Mock vs Real outputs | 7h | P0 | 7.1.6 |
| 7.1.8 | Performance comparison : latency p95 + accuracy benchmarks | 5h | P0 | 7.1.7 |
| 7.1.9 | Rollback procedure documente + tested | 4h | P0 | 7.1.8 |
| 7.1.10 | Admin dashboard Skalean AI : metrics + costs + accuracy + alerts | 5h | P0 | 7.1.9 |
| 7.1.11 | Documentation finale integration + runbook ops | 4h | P0 | 7.1.10 |
| 7.1.12 | Tests integration end-to-end (15+) sandbox Skalean AI | 9h | P0 | 7.1.11 |

**Total** : 68 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 7.1.1 -- SkaleanAiVisionClient HTTP Implementation

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 7h / Depend de Sprint 20

**But** : Implementation complete `SkaleanAiVisionClient` -- replace stub Sprint 20 Tache 5.2.3 par integration HTTP REST reelle.

**Livrables checkables** :
- [ ] Class `SkaleanAiVisionClient implements IaEstimationPhotosClient`
- [ ] Method `estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput>` :
  1. Build request body Skalean AI format :
     - photos_urls : array S3 signed URLs (24h validity)
     - vehicle_data : marque/modele/annee/categorie
     - language : 'fr' (default) selon tenant locale
     - context : 'sinistre_estimation_repair'
  2. POST `${SKALEAN_AI_API_BASE_URL}/vision/estimate-damages`
  3. Headers : Authorization Bearer + X-Tenant-Id + X-API-Version + Idempotency-Key
  4. Timeout : 30s (vision processing peut etre long)
  5. Response parse + Zod validation (utilise `IaEstimationOutputSchema` Sprint 20)
  6. Mapping Skalean AI response -> IaEstimationOutput format Sprint 20
  7. Audit logging request/response (sans photos URLs en clair)
- [ ] Method `getCacheKey(input)` : memorise meme strategy Mock (hash photos + vehicle)
- [ ] Provider = `'skalean_ai'`
- [ ] Tests unit : mock HTTP responses + validation outputs + edge cases

**Pattern critique : SkaleanAiVisionClient HTTP**

```typescript
// repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts
import { request } from 'undici';
import { z } from 'zod';
import crypto from 'node:crypto';

@Injectable()
export class SkaleanAiVisionClient implements IaEstimationPhotosClient {
  provider = 'skalean_ai';

  constructor(
    private config: SkaleanAiConfig,
    private cacheService: CacheService,
    private logger: Logger,
  ) {
    if (!config.apiBaseUrl || !config.apiKey) {
      throw new Error('Skalean AI config invalid : SKALEAN_AI_API_BASE_URL + SKALEAN_AI_API_KEY required');
    }
  }

  async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
    const startTime = Date.now();
    const idempotencyKey = this.computeIdempotencyKey(input);

    try {
      const body = {
        photos_urls: input.photos,
        vehicle_data: input.vehicle_data,
        language: input.locale ?? 'fr',
        context: 'sinistre_estimation_repair',
      };

      const response = await request(`${this.config.apiBaseUrl}/vision/estimate-damages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'X-Tenant-Id': getCurrentTenantId(),
          'X-API-Version': this.config.apiVersion,
          'Idempotency-Key': idempotencyKey,
          'X-Request-Source': 'skalean-insurtech-sprint-29',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      const latencyMs = Date.now() - startTime;

      if (response.statusCode === 429) {
        throw new IaEstimationRateLimitError({ retry_after: response.headers['retry-after'] });
      }

      if (response.statusCode === 402) {
        throw new IaEstimationBudgetExceededError({ message: 'Skalean AI quota exhausted' });
      }

      if (response.statusCode !== 200) {
        const errorBody = await response.body.json();
        throw new IaEstimationFailedError({
          provider: 'skalean_ai',
          status_code: response.statusCode,
          error: errorBody,
        });
      }

      const rawOutput = await response.body.json();

      // Map Skalean AI native response -> Sprint 20 IaEstimationOutput format
      const mapped = this.mapToOutputFormat(rawOutput);

      // Validate output (defensive : Skalean AI evolution should not break us)
      const validated = IaEstimationOutputSchema.parse(mapped);

      // Audit log (sans photos URLs en clair)
      this.logger.info({
        provider: 'skalean_ai',
        confidence: validated.confidence_score,
        latency_ms: latencyMs,
        damages_count: validated.detected_damages.length,
        idempotency_key: idempotencyKey,
      }, 'Skalean AI estimation success');

      return validated;
    } catch (error) {
      this.logger.error({
        provider: 'skalean_ai',
        error: error.message,
        latency_ms: Date.now() - startTime,
      }, 'Skalean AI estimation failed');
      throw error;
    }
  }

  getCacheKey(input: IaEstimationInput): string {
    const seed = crypto.createHash('md5').update(JSON.stringify({
      photos: input.photos.sort(),
      vehicle: input.vehicle_data,
    })).digest('hex');
    return `ia_estimation:skalean_ai:${seed}`;
  }

  private computeIdempotencyKey(input: IaEstimationInput): string {
    return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex').substring(0, 32);
  }

  private mapToOutputFormat(rawSkaleanAi: any): IaEstimationOutput {
    // Translate Skalean AI native format to Sprint 20 IaEstimationOutput
    return {
      confidence_score: rawSkaleanAi.confidence ?? 0.5,
      detected_damages: rawSkaleanAi.damages?.map((d: any) => ({
        description: d.description,
        severity: d.severity,
        location: d.location,
        estimated_repair_method: d.repair_method,
      })) ?? [],
      parts_needed: rawSkaleanAi.parts?.map((p: any) => ({
        name: p.name,
        oem_compatible: p.oem ?? false,
        estimated_quantity: p.quantity,
        estimated_unit_cost_mad: p.unit_cost,
      })) ?? [],
      labor_estimate: {
        hours_minimum: rawSkaleanAi.labor?.min_hours ?? 0,
        hours_maximum: rawSkaleanAi.labor?.max_hours ?? 0,
        hourly_rate_avg: rawSkaleanAi.labor?.rate ?? 350,
      },
      total_cost_estimate_min: rawSkaleanAi.total_min ?? 0,
      total_cost_estimate_max: rawSkaleanAi.total_max ?? 0,
      recommendations: rawSkaleanAi.recommendations ?? '',
      warnings: rawSkaleanAi.warnings ?? [],
    };
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts                  # ~400 lignes (replace stub Sprint 20)
repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts             # ~250 lignes
repo/packages/repair/src/ia-estimation/skalean-ai-config.ts                          # ~80 lignes
repo/packages/repair/src/ia-estimation/skalean-ai-mapping.ts                          # ~150 lignes
```

**Notes implementation** :
- Idempotency-Key : critique pour eviter double-bill Skalean AI si retry
- X-API-Version header : evolution backward-compatible
- Timeout 30s : vision processing peut etre lent
- Mapping defensive : Skalean AI evolution gracefulle (champs manquants -> defaults)

**Criteres validation** :
- V1 (P0) : Implementation complete (replace stub)
- V2 (P0) : HTTP request + headers correct
- V3 (P0) : Mapping Skalean AI -> Sprint 20 format
- V4 (P0) : Errors typed (rate limit + budget + failed)
- V5 (P0) : Audit logging
- V6 (P0) : Tests 15+ scenarios

---

## Tache 7.1.2 -- Auth + Headers + Versioning + Retry

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 5h / Depend de 7.1.1

**But** : Auth strategy enrichie + retry policy + headers complete pour interactions stables.

**Livrables checkables** :
- [ ] Auth : Bearer token rotation strategy :
  - API key encrypted KMS at rest
  - Decrypted runtime + cached 5min memory
  - Rotation : remplace cle apres event/breach (script ops)
- [ ] Retry strategy avec exponential backoff :
  - Network errors : 3 retries (1s, 2s, 4s)
  - 5xx errors : 3 retries
  - 4xx errors (sauf 429) : NO retry (client error)
  - 429 rate limit : retry apres `Retry-After` header
- [ ] Headers complete :
  - `Authorization: Bearer ${apiKey}`
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `X-Tenant-Id: ${currentTenantId}`
  - `X-API-Version: 2026-05-01`
  - `Idempotency-Key: ${sha256(input).substring(0,32)}`
  - `X-Request-Source: skalean-insurtech-sprint-29`
  - `User-Agent: Skalean-InsurTech/1.0`
- [ ] Tests retry + auth + headers

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/skalean-ai-retry-policy.ts                      # ~150 lignes
repo/packages/repair/src/ia-estimation/skalean-ai-auth.service.ts                       # ~150 lignes (KMS rotation)
```

**Criteres validation** :
- V1 (P0) : Bearer auth + KMS
- V2 (P0) : Retry exponential backoff
- V3 (P0) : 429 retry-after respect
- V4 (P0) : 4xx no retry
- V5 (P0) : Tests 8+ scenarios

---

## Tache 7.1.3 -- Cache Redis 24h Reuse

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 5h / Depend de 7.1.2

**But** : Reuse cache wrapper Sprint 20 Tache 5.2.8 avec optimization cost reduction.

**Livrables checkables** :
- [ ] Cache wrapper deja livre Sprint 20 -- verify fonctionne avec Skalean AI provider
- [ ] Cache key inclut provider : `ia_estimation:skalean_ai:{hash}` (vs Mock `ia_estimation:mock:{hash}`)
- [ ] TTL configurable per provider :
  - Mock : 24h
  - Skalean AI : 24h (cost reduction)
- [ ] Metrics cache hit ratio : per provider + per tenant
- [ ] Cost reduction tracking : `cache_hits_saved_calls * avg_cost_per_call = savings_mad`
- [ ] Endpoint admin : `GET /api/v1/admin/ai/cache-stats`
- [ ] Tests cache hit ratio

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts                   # update : metrics per provider
repo/packages/admin/src/services/ai-cache-stats.service.ts                                # ~150 lignes
repo/apps/api/src/modules/admin/controllers/ai-monitoring.controller.ts                    # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Cache hit ratio per provider
- V2 (P0) : Savings MAD computed
- V3 (P0) : Endpoint admin stats
- V4 (P0) : Tests 6+ scenarios

---

## Tache 7.1.4 -- Circuit Breaker + Health Check + Fallback Mock

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 6h / Depend de 7.1.3

**But** : Circuit breaker opossum + health check + fallback Mock si Skalean AI down (graceful degradation).

**Livrables checkables** :
- [ ] Circuit breaker config :
  - Timeout : 30s
  - errorThresholdPercentage : 30%
  - resetTimeout : 60s
  - rollingCountBuckets : 10
- [ ] States : closed (healthy) / open (failing) / half-open (testing recovery)
- [ ] Fallback : si circuit open OR errors -> degrade vers MockIaEstimationClient
- [ ] Logging breaker state transitions + alerts super_admin
- [ ] Health check endpoint `/health/skalean-ai` :
  - Test ping endpoint Skalean AI
  - Last call success rate (5min window)
  - Circuit breaker state
  - Cache hit ratio
- [ ] Auto-recovery : breaker reopen apres healthy successive calls
- [ ] Notifications super_admin si breaker open > 5min
- [ ] Tests : breaker states + fallback Mock

**Pattern critique : circuit breaker + fallback**

```typescript
// repo/packages/repair/src/ia-estimation/skalean-ai-circuit-breaker.ts
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerSkaleanAiClient implements IaEstimationPhotosClient {
  provider = 'skalean_ai';
  private breaker: CircuitBreaker;

  constructor(
    private skaleanAiClient: SkaleanAiVisionClient,
    private mockFallbackClient: MockIaEstimationClient,
    private logger: Logger,
    private commService: CommOrchestrator,
  ) {
    this.breaker = new CircuitBreaker(
      this.skaleanAiClient.estimateDamages.bind(this.skaleanAiClient),
      {
        timeout: 30_000,
        errorThresholdPercentage: 30,
        resetTimeout: 60_000,
        rollingCountBuckets: 10,
        name: 'skalean-ai-vision',
      }
    );

    // Fallback automatic vers Mock
    this.breaker.fallback(async (input: IaEstimationInput) => {
      this.logger.warn({ input }, 'Skalean AI breaker open, falling back to Mock');
      const result = await this.mockFallbackClient.estimateDamages(input);
      // Mark output as fallback (so admin sees source)
      result.warnings = [...(result.warnings ?? []), 'FALLBACK_MOCK : Skalean AI degraded'];
      return result;
    });

    // Listen state transitions
    this.breaker.on('open', () => {
      this.logger.error('Skalean AI circuit breaker OPEN');
      this.alertSuperAdmin('skalean_ai_breaker_open');
    });
    this.breaker.on('halfOpen', () => {
      this.logger.info('Skalean AI circuit breaker HALF-OPEN (testing recovery)');
    });
    this.breaker.on('close', () => {
      this.logger.info('Skalean AI circuit breaker CLOSED (healthy)');
    });
  }

  async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
    return this.breaker.fire(input);
  }

  getCacheKey(input: IaEstimationInput): string {
    return this.skaleanAiClient.getCacheKey(input);
  }

  getHealthStatus() {
    return {
      breaker_state: this.breaker.opened ? 'open' : (this.breaker.halfOpen ? 'half_open' : 'closed'),
      stats: this.breaker.stats,
    };
  }

  private async alertSuperAdmin(reason: string): Promise<void> {
    await this.commService.send({
      type: 'transactional',
      template: 'admin_skalean_ai_breaker_alert',
      to: { email: 'admin@skalean-insurtech.ma' },
      variables: { reason, timestamp: new Date().toISOString() },
    });
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/skalean-ai-circuit-breaker.ts                      # ~250 lignes
repo/apps/api/src/modules/admin/controllers/ai-health.controller.ts                         # ~120 lignes
repo/packages/comm/src/templates/{fr}/admin-skalean-ai-{breaker-alert,recovered}.hbs        # 2 templates
```

**Criteres validation** :
- V1 (P0) : Circuit breaker config
- V2 (P0) : Fallback Mock automatic
- V3 (P0) : Health check endpoint
- V4 (P0) : Notifications super_admin
- V5 (P0) : Tests 8+ scenarios

---

## Tache 7.1.5 -- Cost Monitoring + Budget Alerts

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 6h / Depend de 7.1.4

**But** : Tracking cout per call + per tenant + budget alerts + dashboard cost.

**Livrables checkables** :
- [ ] Migration : table `ia_estimation_calls_log` :
  - id, tenant_id, provider, request_id, latency_ms, input_size_bytes, output_size_bytes, estimated_cost_mad (compute selon tariff Skalean AI), confidence_score, status (success/failed/timeout), called_at
- [ ] Service `cost-tracking.service.ts` :
  - `recordCall(call_data)` : insert log + compute cost
  - `getMonthlyTotalSpend(tenantId, month)` : sum cost
  - `getMonthlyTotalSpend(month)` : sum cross-tenants (super_admin)
  - `checkBudgetExceeded(tenantId)` : compare vs budget threshold
- [ ] Tariff Skalean AI (configuration env) :
  - `SKALEAN_AI_TARIFF_PER_VISION_CALL_MAD=2.50` (example)
  - `SKALEAN_AI_TARIFF_PER_PHOTO_PROCESSED_MAD=0.50` (example)
- [ ] Budget alerts :
  - Tenant : 80% / 100% / 120% budget month
  - Platform global : 80% / 100% Skalean AI budget global month
  - Notifications super_admin + tenant admin
- [ ] Cron daily : compute current spend + alert si depassement
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-IaEstimationCallsLog.ts                          # ~50 lignes
repo/packages/repair/src/entities/ia-estimation-call-log.entity.ts                              # ~50 lignes
repo/packages/admin/src/services/cost-tracking.service.ts                                          # ~250 lignes
repo/packages/admin/src/jobs/budget-alerts.cron.ts                                                  # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Calls log
- V2 (P0) : Cost computation per call
- V3 (P0) : Budget thresholds
- V4 (P0) : Notifications alerts
- V5 (P0) : Tests 8+ scenarios

---

## Tache 7.1.6 -- Activation Gradual Feature Flag

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 5h / Depend de 7.1.5

**But** : Feature flag percentage-based rollout : 0% -> 10% -> 50% -> 100% trafic Skalean AI vs Mock.

**Livrables checkables** :
- [ ] Variable env `IA_ESTIMATION_ROLLOUT_PERCENT` (0-100, default 0)
- [ ] Service `IaEstimationRouter` :
  - Si `rollout_percent = 0` : 100% Mock
  - Si `rollout_percent = 100` : 100% Skalean AI
  - Sinon : random per call (hash request -> deterministic for same input)
- [ ] Update Sprint 20 DI Module : utilise router au lieu single client
- [ ] Endpoint admin : `POST /api/v1/admin/ai/rollout/set` body { percent } -- super_admin only
- [ ] Audit complet rollout changes
- [ ] Plan rollout typique :
  - Week 1 : 0% (bake real client tests)
  - Week 2 : 10% (real users sample)
  - Week 3 : 50% (validate accuracy)
  - Week 4 : 100% (full migration)
- [ ] Rollback : decrease percent vers 0 si issues
- [ ] Tests

**Pattern critique : router percentage-based**

```typescript
// repo/packages/repair/src/ia-estimation/ia-estimation-router.ts
import crypto from 'node:crypto';

@Injectable()
export class IaEstimationRouter implements IaEstimationPhotosClient {
  provider = 'router';

  constructor(
    private mockClient: MockIaEstimationClient,
    private skaleanAiClient: CircuitBreakerSkaleanAiClient,
    private rolloutService: RolloutService,
  ) {}

  async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
    const rolloutPercent = await this.rolloutService.getCurrentPercent();

    if (rolloutPercent === 0) {
      return this.mockClient.estimateDamages(input);
    }
    if (rolloutPercent === 100) {
      return this.skaleanAiClient.estimateDamages(input);
    }

    // Deterministic per-input routing : same input -> same provider (consistency)
    const hash = crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
    const inputBucket = parseInt(hash.substring(0, 8), 16) % 100;

    if (inputBucket < rolloutPercent) {
      return this.skaleanAiClient.estimateDamages(input);
    } else {
      return this.mockClient.estimateDamages(input);
    }
  }

  getCacheKey(input: IaEstimationInput): string {
    // Cache key reflects which provider used (deterministic)
    const rolloutPercent = this.rolloutService.getCurrentPercentSync();
    if (rolloutPercent === 0) return this.mockClient.getCacheKey(input);
    if (rolloutPercent === 100) return this.skaleanAiClient.getCacheKey(input);
    // For mixed mode, use input-deterministic provider
    const hash = crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
    const bucket = parseInt(hash.substring(0, 8), 16) % 100;
    return bucket < rolloutPercent ? this.skaleanAiClient.getCacheKey(input) : this.mockClient.getCacheKey(input);
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/ia-estimation-router.ts                            # ~250 lignes
repo/packages/admin/src/services/rollout.service.ts                                          # ~150 lignes
repo/apps/api/src/modules/admin/controllers/rollout.controller.ts                              # ~100 lignes
repo/packages/repair/src/ia-estimation/ia-estimation.module.ts                                  # update : utilise router
```

**Criteres validation** :
- V1 (P0) : Router percentage-based
- V2 (P0) : Deterministic per input
- V3 (P0) : Endpoint admin set rollout
- V4 (P0) : Audit changes
- V5 (P0) : Tests 8+ scenarios

---

## Tache 7.1.7 -- Migration Validation : 100 Mock vs Real

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 7h / Depend de 7.1.6

**But** : Script validation : compare 100 estimations Mock vs Real Skalean AI -- verifier coherence outputs.

**Livrables checkables** :
- [ ] Script `repo/infrastructure/scripts/validate-skalean-ai-migration.ts` :
  - Take 100 input fixtures variees (5 damage types Sprint 20 mock + edge cases)
  - Run via Mock -> capture outputs
  - Run via Skalean AI -> capture outputs
  - Compute deltas :
    - Total cost estimate diff (avg + p50 + p95)
    - Damages count match rate
    - Parts needed match rate
    - Confidence score correlation
  - Generate report HTML : side-by-side comparison
  - Flag outliers : Real disagrees significativement avec Mock (might indicate Real catching things Mock missed)
- [ ] Run sandbox Skalean AI (env staging dedicated)
- [ ] Document acceptance criteria : delta total_cost_estimate < 30% avg + > 80% damages_count_match
- [ ] Tests script + idempotency

**Fichiers crees / modifies** :
```
repo/infrastructure/scripts/validate-skalean-ai-migration.ts                                       # ~400 lignes
repo/infrastructure/scripts/migration-validation-report.template.html                                # template HTML
repo/infrastructure/fixtures/ia-estimation-100-validation.json                                       # 100 inputs realistic
```

**Notes implementation** :
- Sandbox Skalean AI : env staging dedicated (eviter cost prod testing)
- Outliers analysis : Real catching nuances Mock not capturing -> validate quality Real
- Acceptance criteria avant rollout production

**Criteres validation** :
- V1 (P0) : Script execute 100 inputs
- V2 (P0) : Report HTML genere
- V3 (P0) : Acceptance criteria documente
- V4 (P0) : Sandbox env separate

---

## Tache 7.1.8 -- Performance Comparison Benchmarks

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 5h / Depend de 7.1.7

**But** : Benchmarks performance : latency p95 Mock vs Real + accuracy benchmarks.

**Livrables checkables** :
- [ ] Script `benchmark-skalean-ai-performance.ts` :
  - Run 1000 calls Mock + 1000 calls Real (concurrent + sequential)
  - Mesures : latency p50/p95/p99 + throughput rps + error rate
  - Compare : Real likely slower (real model inference) but more accurate
- [ ] Benchmarks accuracy :
  - Run 100 calls scenarios known truth (manual annotated by experts Skalean Atlas)
  - Compute precision + recall + F1 per damage type
  - Compare Mock vs Real scores
- [ ] Reports : 2 reports HTML
  - Performance benchmark
  - Accuracy benchmark
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/infrastructure/scripts/benchmark-skalean-ai-performance.ts                                       # ~300 lignes
repo/infrastructure/scripts/benchmark-skalean-ai-accuracy.ts                                            # ~300 lignes
repo/infrastructure/fixtures/100-annotated-scenarios.json                                                # truth fixtures
```

**Criteres validation** :
- V1 (P0) : Benchmarks executes
- V2 (P0) : Reports generes
- V3 (P0) : Insights documentes (latency vs accuracy trade-off)

---

## Tache 7.1.9 -- Rollback Procedure

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 4h / Depend de 7.1.8

**But** : Procedure rollback : si issues detectees post-rollout, revert vers Mock rapidement.

**Livrables checkables** :
- [ ] Document `repo/docs/skalean-ai-rollback-procedure.md`
- [ ] Sections :
  - Detection issues : monitoring alerts (Tache 7.1.4 + 7.1.5)
  - Decision tree : when rollback ?
    - Latency p95 > 5x baseline
    - Error rate > 5%
    - Accuracy regressions detected
    - Cost surge unexpected
  - Steps rollback :
    1. Set `IA_ESTIMATION_ROLLOUT_PERCENT=0` via admin endpoint
    2. Verify all traffic now Mock (latency drops back)
    3. Investigate Skalean AI issues
    4. Communicate impact internal + tenants
  - Recovery procedure : after fix, re-rollout gradually
- [ ] Tests rollback : simulate via env change + verify all traffic Mock < 60s
- [ ] Runbook ops : page Notion liens incident response

**Fichiers crees / modifies** :
```
repo/docs/skalean-ai-rollback-procedure.md                                                            # ~300 lignes
repo/docs/skalean-ai-incident-response-runbook.md                                                      # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Procedure complete
- V2 (P0) : Decision tree clair
- V3 (P0) : Tests rollback < 60s
- V4 (P0) : Runbook ops

---

## Tache 7.1.10 -- Admin Dashboard Skalean AI

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 5h / Depend de 7.1.9

**But** : Page admin dashboard Skalean AI : metrics + costs + accuracy + alerts visibility.

**Livrables checkables** :
- [ ] Page `/ai-monitoring/skalean-ai` :
  - **Section status** : breaker state + last health check + uptime 30j
  - **Section trafic** : calls per provider (last 7j) + rollout percent current
  - **Section performance** : latency p95 chart + error rate chart
  - **Section costs** : monthly spend MAD + budget % used + per tenant breakdown
  - **Section accuracy** : technician acceptance rate Sprint 20 (ratio accept_all / edit / reject)
  - **Section alerts** : recent breakerm budget exceeded, etc.
- [ ] Action buttons :
  - "Set rollout percent" (super_admin only)
  - "Force breaker reset"
  - "Run health check"
- [ ] Real-time refresh 30s
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/skalean-ai/page.tsx                # ~250 lignes
repo/apps/web-insurtech-admin/components/ai-monitoring/{several charts}.tsx                              # ~500 lignes
```

**Criteres validation** :
- V1 (P0) : Dashboard complet
- V2 (P0) : Real-time refresh
- V3 (P0) : Actions admin
- V4 (P0) : Tests 5+ scenarios

---

## Tache 7.1.11 -- Documentation Finale

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 4h / Depend de 7.1.10

**But** : Documentation complete integration + runbook ops + onboarding equipe.

**Livrables checkables** :
- [ ] Documents :
  - `repo/docs/skalean-ai-integration-architecture.md` (architecture)
  - `repo/docs/skalean-ai-onboarding-guide.md` (developers + ops)
  - `repo/docs/skalean-ai-cost-optimization.md` (best practices)
- [ ] Diagrammes Mermaid

**Fichiers crees / modifies** :
```
repo/docs/skalean-ai-integration-architecture.md                                                        # ~300 lignes
repo/docs/skalean-ai-onboarding-guide.md                                                                  # ~200 lignes
repo/docs/skalean-ai-cost-optimization.md                                                                  # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : 3 documents complets
- V2 (P0) : Diagrams clairs

---

## Tache 7.1.12 -- Tests Integration End-to-End

**Metadonnees** : Phase 7 / Sprint 29 / P0 / 9h / Depend de 7.1.11

**But** : Suite tests integration end-to-end avec sandbox Skalean AI + tests resilience.

**Livrables checkables** :

**Tests integration (15+)** :
- [ ] HTTP integration sandbox : success + 200 OK (3)
- [ ] Errors handling : 401 / 402 / 429 / 500 (4)
- [ ] Retry exponential backoff (2)
- [ ] Circuit breaker open + fallback Mock (2)
- [ ] Cost tracking accuracy (2)
- [ ] Rollout router percentage (2)
- [ ] Migration validation script run (1)
- [ ] Performance benchmark Mock vs Real (1)

**Fichiers crees / modifies** :
```
repo/apps/api/test/integration/skalean-ai/{15+ specs}.e2e-spec.ts
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : Sandbox integration green
- V3 (P0) : CI green
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 29

A la fin de l'execution des 12 taches :

```
Skalean AI REST Integration operational :
  - SkaleanAiVisionClient HTTP integration complete (replace stub Sprint 20)
  - Auth Bearer + KMS + headers + retry exponential backoff
  - Cache Redis 24h reuse + cost tracking
  - Circuit breaker + fallback Mock automatic
  - Cost monitoring per call + budget alerts thresholds
  - Activation gradual rollout 0% -> 100% (deterministic per input)
  - Migration validation script (100 Mock vs Real)
  - Performance + accuracy benchmarks
  - Rollback procedure documente + tested < 60s
  - Admin dashboard Skalean AI metrics + costs + accuracy
  - Documentation complete (architecture + onboarding + cost optimization)

15+ tests integration sandbox Skalean AI green

DECISION-007 AI-DEFERE EXECUTED : pattern Mock -> Real swap operational
```

**Sprint 30 (Skalean AI MCP integration) demarre avec** :
- REST integration operational
- Sprint 30 : MCP (Model Context Protocol) integration -- agent tools + structured interaction
- Pattern reutilisable Sprint 31 Agent Sky multilingue

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-7.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-29-skalean-ai-rest/`.

**Patterns code inline conserves** : SkaleanAiVisionClient HTTP request + auth + idempotency + mapping defensive ; circuit breaker + fallback Mock automatic ; router percentage-based deterministic per input.

**Reference** : Sprint 20 Mock + interface IaEstimationPhotosClient.

---

**Fin du meta-prompt B-29 v2.2 format Option B.**
