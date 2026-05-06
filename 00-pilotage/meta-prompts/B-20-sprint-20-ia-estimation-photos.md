# META-PROMPT B-20 -- SPRINT 20 IA ESTIMATION PHOTOS

**Version** : v2.2 (Option B -- AI-defere strategy)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 20 / 35 (cumul) -- Phase 5 Sprint 2
**Position** : Apres Vertical Repair Foundation, avant Sinistre Workflow
**Numerotation taches** : 5.2.1 a 5.2.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (mock pendant dev, swap Sprint 30+ avec Skalean AI reel)

---

## Objectif Global du Sprint

Implementer **service IA estimation photos** pour automation diagnostic vehicule sinistre. Sprint 20 livre **mock client + interface stable** : Skalean AI vision API (vrai service IA) sera connecte Sprint 30+ via DI swap (decision-007 AI-defere). Le mock retourne data realistic structuree permettant tous les flows downstream de fonctionner pendant Sprint 19-29 development.

A la sortie de ce sprint :
- Interface `IaEstimationPhotosClient` + 2 implementations (Mock + RealSkaleanAi placeholder)
- Mock service realistic : detection damages + pieces necessaires + cout estimate + confidence score
- DI swap Sprint 30+ : `MockIaEstimationClient` -> `SkaleanAiVisionClient` une seule ligne config
- Auto-trigger lors `repair_diagnostics.start()` + photos disponibles
- Suggestions visible dans diagnostic + technicien valide/edit
- Endpoints REST + Kafka events
- Tests avec photos fixtures realistes
- Foundation prete pour Sprint 30+ Skalean AI reel

---

## Frontiere du Sprint

**INCLUS** :
- Interface IaEstimationPhotosClient
- Mock service implementation (data realistic)
- Auto-trigger lors diagnostic start
- Integration repair_diagnostics : suggestions auto + UI (technicien valide)
- Cache results 24h Redis
- Endpoints REST
- Tests

**EXCLU** (sera ajoute aux sprints suivants) :
- Real Skalean AI integration -- Sprint 30+ defere (decision-007)
- Vision API direct (sans Skalean AI service) -- pas dans roadmap
- IA estimation cross-branche (sante, habitation) -- Phase 7+
- Apprentissage continu sur feedback technicien -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 19 : entities Repair + diagnostics
2. Decision-007 : AI-defere strategy (mock pendant dev, swap Sprint 30+)
3. Format Skalean AI service : a definir Sprint 30+ (Sprint 20 utilise interface generique)

---

## Stack Imposee (Sprint 20)

| Composant | Version | Notes |
|-----------|---------|-------|
| undici | 7.1.1 | HTTP client (Sprint 30+ vers Skalean AI) |
| zod | 3.24.1 | validation responses |

Variables env : `IA_ESTIMATION_PROVIDER` (= 'mock' Sprint 20, 'skalean_ai' Sprint 30+), `SKALEAN_AI_API_BASE_URL` + `SKALEAN_AI_API_KEY` (Sprint 30+).

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 5.2.1 | IaEstimationPhotosClient interface + types | 5h | P0 | Sprint 19 |
| 5.2.2 | MockIaEstimationClient implementation (data realistic) | 7h | P0 | 5.2.1 |
| 5.2.3 | SkaleanAiVisionClient placeholder (Sprint 30+ stub) | 4h | P0 | 5.2.2 |
| 5.2.4 | DI Module configuration (swap factory) | 4h | P0 | 5.2.3 |
| 5.2.5 | Auto-trigger lors diagnostic.start() + photos available | 5h | P0 | 5.2.4 |
| 5.2.6 | repair_ia_estimations entity + service (storage results) | 5h | P0 | 5.2.5 |
| 5.2.7 | Workflow validation : technicien edit/accept suggestions IA | 6h | P0 | 5.2.6 |
| 5.2.8 | Cache Redis 24h + invalidation | 4h | P0 | 5.2.7 |
| 5.2.9 | Endpoints REST `/api/v1/repair/ia-estimations/*` | 4h | P0 | 5.2.8 |
| 5.2.10 | Audit + Kafka events + integration ETL Analytics Sprint 13 | 4h | P0 | 5.2.9 |
| 5.2.11 | Documentation swap Sprint 30+ + migration plan | 4h | P0 | 5.2.10 |
| 5.2.12 | Tests E2E (25+) + photos fixtures realistic | 8h | P0 | 5.2.11 |

**Total** : 60 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 5.2.1 -- IaEstimationPhotosClient Interface + Types

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 5h / Depend de Sprint 19

**But** : Definir interface commune pour 2 implementations (Mock + Real) + types output structurees + contracts versions stable.

**Livrables checkables** :
- [ ] Interface `repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts` :
  - `provider: string` (mock | skalean_ai)
  - `estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput>`
  - `getCacheKey(input): string`
- [ ] Types input :
  - `IaEstimationInput` : photos (array URLs S3) + vehicle_data (marque/modele/annee/categorie) + incident_circumstances (text optional)
- [ ] Types output (return realistic structure) :
  - `IaEstimationOutput`:
    - confidence_score (0-1)
    - detected_damages (array : { description, severity 'minor'|'moderate'|'severe', location 'front'|'rear'|'side_left'|'side_right'|'top'|'undercarriage'|'interior', estimated_repair_method 'replace'|'repair'|'paint' })
    - parts_needed (array : { name, oem_compatible, estimated_quantity, estimated_unit_cost_mad })
    - labor_estimate (object : { hours_minimum, hours_maximum, hourly_rate_avg })
    - total_cost_estimate_min, total_cost_estimate_max
    - recommendations (text : conseils technicien)
    - warnings (array : si detection limitee, photos manquantes, etc.)
- [ ] Validation Zod schemas pour input + output (anti-injection + integrity)
- [ ] Errors typed : `IaEstimationFailedError`, `IaEstimationTimeoutError`, `IaEstimationLowConfidenceError`
- [ ] Tests : interface contracts + Zod validation

**Pattern critique : interface + types output structurees**

```typescript
// repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts
import { z } from 'zod';

export const IaEstimationOutputSchema = z.object({
  confidence_score: z.number().min(0).max(1),
  detected_damages: z.array(z.object({
    description: z.string().min(1),
    severity: z.enum(['minor', 'moderate', 'severe']),
    location: z.enum(['front', 'rear', 'side_left', 'side_right', 'top', 'undercarriage', 'interior']),
    estimated_repair_method: z.enum(['replace', 'repair', 'paint']),
  })),
  parts_needed: z.array(z.object({
    name: z.string(),
    oem_compatible: z.boolean(),
    estimated_quantity: z.number().positive(),
    estimated_unit_cost_mad: z.number().nonnegative(),
  })),
  labor_estimate: z.object({
    hours_minimum: z.number().nonnegative(),
    hours_maximum: z.number().nonnegative(),
    hourly_rate_avg: z.number().nonnegative(),
  }),
  total_cost_estimate_min: z.number().nonnegative(),
  total_cost_estimate_max: z.number().nonnegative(),
  recommendations: z.string(),
  warnings: z.array(z.string()),
});

export type IaEstimationOutput = z.infer<typeof IaEstimationOutputSchema>;

export interface IaEstimationPhotosClient {
  provider: string;
  estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput>;
  getCacheKey(input: IaEstimationInput): string;
}
```

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/ia-estimation.interface.ts            # ~120 lignes
repo/packages/repair/src/ia-estimation/types.ts                                # ~80 lignes
repo/packages/repair/src/ia-estimation/errors.ts                                # ~50 lignes (3 errors)
repo/packages/repair/src/ia-estimation/schemas.ts                                # ~80 lignes (Zod)
```

**Notes implementation** :
- Confidence_score : indicateur fiabilite IA (Sprint 20 mock : 0.85-0.95 randomise ; Sprint 30+ reel)
- Output schemas vers : permet evolution sans breaking (versionne contract)
- Errors typed : differentiation low_confidence vs failure (low_confidence pourrait fallback manuel)

**Criteres validation** :
- V1 (P0) : Interface declare 3 methods
- V2 (P0) : Types Zod-validated
- V3 (P0) : Errors typed 3 classes
- V4 (P0) : Tests contracts 6+ scenarios

---

## Tache 5.2.2 -- MockIaEstimationClient Implementation

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 7h / Depend de 5.2.1

**But** : Mock client retournant data realistic (basee patterns reels reparations auto MA) permettant flows downstream fonctionnent.

**Livrables checkables** :
- [ ] Class `MockIaEstimationClient implements IaEstimationPhotosClient`
- [ ] Method `estimateDamages` :
  1. Sleep 1-3s (simulate API call latency)
  2. Detection patterns selon photos input metadata (filename hints "front_collision", "rear_damage", etc.)
  3. Generate realistic data structures :
     - Front collision : pare-chocs avant + capot + phares + radiateur (3-5 parts)
     - Rear collision : pare-chocs arriere + coffre + feux (2-4 parts)
     - Side damage : porte + retroviseur + aile (2-3 parts)
     - Bris glace : pare-brise OR vitre (1 part)
     - Vol : variable selon metadata
  4. Pricing realistic MA :
     - Pare-chocs : 1500-3500 MAD
     - Capot : 2000-5000 MAD
     - Pare-brise : 800-2500 MAD
     - Pneu : 800-1500 MAD per tire
     - Plaquettes frein : 350-700 MAD
  5. Labor hours selon severity : minor (1-3h), moderate (4-10h), severe (12-30h)
  6. Confidence score : 0.85-0.95 (randomise)
  7. Warnings : occasional ("Photos prises sous mauvais eclairage", "Detection partielle")
- [ ] Edge cases :
  - 0 photos : throw `IaEstimationFailedError("photos required")`
  - photos URL invalid (non-S3 ou inaccessible) : warning + estimation degradee
  - Vehicle marque/modele unknown : warning + generic estimate
- [ ] Pseudo-deterministic : meme input -> meme output (utilise hash photos + vehicle_data)
- [ ] Tests : 15+ scenarios damage types + edge cases

**Pattern critique : mock realistic generation**

```typescript
// repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts
import crypto from 'node:crypto';

export class MockIaEstimationClient implements IaEstimationPhotosClient {
  provider = 'mock';

  async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
    if (input.photos.length === 0) {
      throw new IaEstimationFailedError('photos required');
    }

    // Pseudo-deterministic seed
    const seed = crypto.createHash('md5').update(JSON.stringify({
      photos: input.photos.sort(),
      vehicle: input.vehicle_data,
    })).digest('hex');
    const seedNum = parseInt(seed.substring(0, 8), 16);

    // Latency 1-3s
    await new Promise(r => setTimeout(r, 1000 + (seedNum % 2000)));

    // Detect damage type from filename hints OR seed-based
    const damageType = this.detectDamageType(input.photos, seedNum);

    const output = this.generateOutput(damageType, input.vehicle_data, seedNum);

    // Validate own output (defensive)
    return IaEstimationOutputSchema.parse(output);
  }

  private detectDamageType(photos: string[], seed: number): DamageType {
    // Filename hints check
    const firstFilename = photos[0].toLowerCase();
    if (firstFilename.includes('front')) return 'front_collision';
    if (firstFilename.includes('rear')) return 'rear_collision';
    if (firstFilename.includes('side')) return 'side_damage';
    if (firstFilename.includes('glass')) return 'broken_glass';
    if (firstFilename.includes('theft')) return 'theft';

    // Seed-based fallback
    const types = ['front_collision', 'rear_collision', 'side_damage', 'broken_glass'];
    return types[seed % 4] as DamageType;
  }

  private generateOutput(damageType: DamageType, vehicle: VehicleData, seed: number): IaEstimationOutput {
    const confidence = 0.85 + ((seed % 100) / 1000); // 0.85-0.95

    const damages = DAMAGE_PATTERNS[damageType].damages;
    const parts = DAMAGE_PATTERNS[damageType].parts.map(p => ({
      ...p,
      estimated_unit_cost_mad: this.adjustPriceForVehicle(p.base_price, vehicle, seed),
    }));

    const partsTotal = parts.reduce((sum, p) => sum + (p.estimated_unit_cost_mad * p.estimated_quantity), 0);
    const laborHoursMin = DAMAGE_PATTERNS[damageType].labor_min;
    const laborHoursMax = DAMAGE_PATTERNS[damageType].labor_max;
    const hourlyRate = 350; // average MA garage

    return {
      confidence_score: Math.round(confidence * 100) / 100,
      detected_damages: damages,
      parts_needed: parts,
      labor_estimate: { hours_minimum: laborHoursMin, hours_maximum: laborHoursMax, hourly_rate_avg: hourlyRate },
      total_cost_estimate_min: Math.round(partsTotal + laborHoursMin * hourlyRate),
      total_cost_estimate_max: Math.round(partsTotal + laborHoursMax * hourlyRate),
      recommendations: this.generateRecommendations(damageType, damages),
      warnings: confidence < 0.90 ? ['Detection partielle - validation technicien requise'] : [],
    };
  }

  getCacheKey(input: IaEstimationInput): string {
    const seed = crypto.createHash('md5').update(JSON.stringify({
      photos: input.photos.sort(),
      vehicle: input.vehicle_data,
    })).digest('hex');
    return `ia_estimation:mock:${seed}`;
  }
}

const DAMAGE_PATTERNS = {
  front_collision: {
    damages: [
      { description: 'Pare-chocs avant deforme', severity: 'moderate', location: 'front', estimated_repair_method: 'replace' },
      { description: 'Capot deforme', severity: 'moderate', location: 'front', estimated_repair_method: 'repair' },
      { description: 'Phare droit casse', severity: 'minor', location: 'front', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Pare-chocs avant', oem_compatible: true, estimated_quantity: 1, base_price: 2500 },
      { name: 'Phare droit', oem_compatible: false, estimated_quantity: 1, base_price: 1200 },
      { name: 'Peinture pare-chocs', oem_compatible: false, estimated_quantity: 1, base_price: 800 },
    ],
    labor_min: 6, labor_max: 12,
  },
  rear_collision: { /* similar */ },
  side_damage: { /* similar */ },
  broken_glass: {
    damages: [{ description: 'Pare-brise fissure', severity: 'minor', location: 'front', estimated_repair_method: 'replace' }],
    parts: [{ name: 'Pare-brise', oem_compatible: false, estimated_quantity: 1, base_price: 1500 }],
    labor_min: 1.5, labor_max: 2.5,
  },
  theft: { /* similar */ },
};
```

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts            # ~400 lignes
repo/packages/repair/src/ia-estimation/damage-patterns.data.ts                  # ~250 lignes (5 types)
repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.spec.ts        # ~250 lignes (tests)
```

**Notes implementation** :
- Pseudo-deterministic seed : tests reproductibles
- Patterns realistic MA : prix ajustes marche local
- Latency simulation : tests timeout handling
- Sprint 30+ : remplace par real Skalean AI vision

**Criteres validation** :
- V1 (P0) : Mock retourne data structuree
- V2 (P0) : 5 damage types supportes
- V3 (P0) : Pseudo-deterministic (seed)
- V4 (P0) : Latency simulation 1-3s
- V5 (P0) : Edge cases handled
- V6 (P0) : Tests 15+ scenarios

---

## Tache 5.2.3 -- SkaleanAiVisionClient Placeholder

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 4h / Depend de 5.2.2

**But** : Stub `SkaleanAiVisionClient` avec interface implementation -- Sprint 30+ remplira logique reelle (HTTP call Skalean AI vision API).

**Livrables checkables** :
- [ ] Class `SkaleanAiVisionClient implements IaEstimationPhotosClient`
- [ ] Methods :
  - `estimateDamages` : throw `NotImplementedException('Skalean AI integration deferred to Sprint 30+')` Sprint 20
  - `getCacheKey` : implementee (idempotency similar pattern Mock)
- [ ] Constructor : require `apiBaseUrl`, `apiKey` env -- valide presence sinon throws config error
- [ ] Comments documentation : indique Sprint 30+ implementation
- [ ] Tests : verifier instance creation + throws Sprint 20

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts              # ~150 lignes (stub)
repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.spec.ts          # ~80 lignes (tests stub)
```

**Notes implementation** :
- Sprint 30+ implementera : POST `/api/v1/vision/estimate-damages` body { photos_urls, vehicle_data, language } -> output similaire format
- Authentification : Bearer apiKey + X-Tenant-Id header
- Cache layer : same pattern Mock (Tache 5.2.8)
- Versioning : header `X-API-Version: 2026-01-01` (compatibility)

**Criteres validation** :
- V1 (P0) : Class exists implementing interface
- V2 (P0) : estimateDamages throws NotImplementedException
- V3 (P0) : Constructor validates config
- V4 (P0) : Tests 4+ scenarios

---

## Tache 5.2.4 -- DI Module Configuration (Swap Factory)

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 4h / Depend de 5.2.3

**But** : NestJS Module providing `IaEstimationPhotosClient` via factory based on env `IA_ESTIMATION_PROVIDER`. Permet swap Sprint 30+ une seule ligne config.

**Livrables checkables** :
- [ ] Module `repo/packages/repair/src/ia-estimation/ia-estimation.module.ts`
- [ ] Provider factory :
  ```typescript
  {
    provide: 'IaEstimationPhotosClient',
    useFactory: (config) => {
      const provider = config.get('IA_ESTIMATION_PROVIDER', 'mock');
      if (provider === 'skalean_ai') return new SkaleanAiVisionClient(config);
      return new MockIaEstimationClient();
    },
    inject: [ConfigService],
  }
  ```
- [ ] Sprint 20 default : `mock` (Sprint 30+ swap to `skalean_ai`)
- [ ] Logger : log provider used at boot
- [ ] Health check : test estimation 1 photo dummy au boot
- [ ] Tests : verify mock by default + swap config

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/ia-estimation.module.ts                  # ~120 lignes
repo/packages/repair/src/ia-estimation/ia-estimation.module.spec.ts             # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Module provides client
- V2 (P0) : Mock default
- V3 (P0) : Swap config swap implementation
- V4 (P0) : Logger + health check
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.2.5 -- Auto-Trigger Lors Diagnostic.Start()

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 5h / Depend de 5.2.4

**But** : Auto-call IaEstimationPhotosClient lors diagnostic start si photos disponibles + store result.

**Livrables checkables** :
- [ ] Update Sprint 19 `diagnostics.service.ts.start()` :
  - Apres create diagnostic row
  - Si sinistre.incident_data.photos[] non vide
  - Call `iaClient.estimateDamages(...)` async (background BullMQ job)
  - Storage result dans `repair_ia_estimations` (Tache 5.2.6)
  - Notification technicien via WebSocket OR poll endpoint
- [ ] Job BullMQ : `RunIaEstimationJob` (queue `ia-estimations`) handle async (peut prendre 30s+)
- [ ] Retry policy : 3 attempts exponential backoff
- [ ] DLQ apres echecs : alert technicien manuel diagnostic
- [ ] Tests : trigger + async + retry + DLQ

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/diagnostics.service.ts                          # update : auto-trigger
repo/packages/repair/src/jobs/run-ia-estimation.job.ts                              # ~150 lignes
repo/packages/repair/src/jobs/ia-estimation-worker.ts                                # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : Auto-trigger lors diagnostic start
- V2 (P0) : Async via BullMQ
- V3 (P0) : Retry 3x backoff
- V4 (P0) : DLQ alerte
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.2.6 -- repair_ia_estimations Entity + Service

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 5h / Depend de 5.2.5

**But** : Storage results IA estimation : preservation history + audit + analytics.

**Livrables checkables** :
- [ ] Migration : table `repair_ia_estimations` :
  - id, sinistre_id (FK), diagnostic_id (FK), provider (enum 'mock' | 'skalean_ai'), input_photos (jsonb : URLs), input_vehicle_data (jsonb), output_data (jsonb : full IaEstimationOutput), confidence_score (numeric), status (enum 'pending' | 'completed' | 'failed' | 'low_confidence'), error_message, requested_at, completed_at, latency_ms (int), validated_by_technician (boolean), technician_edits (jsonb -- diff applique par technicien)
- [ ] Service `ia-estimations.service.ts` :
  - `create(diagnosticId, input)` -- INSERT pending
  - `markCompleted(id, output)` -- update status + output_data
  - `markFailed(id, error)`
  - `markValidatedByTechnician(id, edits)` -- technicien valide + edits eventuels
  - `findByDiagnostic(diagnosticId)`
- [ ] Endpoints :
  - `GET /api/v1/repair/ia-estimations/:id`
  - `GET /api/v1/repair/sinistres/:id/ia-estimations`
  - `POST /api/v1/repair/ia-estimations/:id/validate` (technicien)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RepairIaEstimations.ts             # ~50 lignes
repo/packages/repair/src/entities/repair-ia-estimation.entity.ts                  # ~50 lignes
repo/packages/repair/src/services/ia-estimations.service.ts                       # ~200 lignes
repo/apps/api/src/modules/repair/controllers/ia-estimations.controller.ts          # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Migration creee
- V2 (P0) : Service CRUD operationnel
- V3 (P0) : technician_edits diff stocke
- V4 (P0) : Tests 8+ scenarios

---

## Tache 5.2.7 -- Workflow Validation Technicien

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 6h / Depend de 5.2.6

**But** : Technicien diagnostic page (Sprint 22 web-garage) : voir suggestions IA + edit/accept/reject + apply au diagnostic.

**Livrables checkables** :
- [ ] Workflow process :
  1. IA generates output -> stored Tache 5.2.6
  2. Status diagnostic : `under_diagnostic` (technicien examine)
  3. Technicien voit suggestions IA dans UI Sprint 22 (preparation)
  4. Options : Accept all / Edit / Reject + manual diagnostic
  5. Si accept : copy IA suggestions vers diagnostic.problems[] + parts_needed[]
  6. Si edit : apply edits + log diff in `technician_edits`
  7. Si reject : technicien diagnostic from scratch
  8. Mark `validated_by_technician = true` + transition diagnostic.completed
- [ ] Endpoint `POST /api/v1/repair/diagnostics/:id/apply-ia-estimation` body { ia_estimation_id, action: 'accept' | 'edit' | 'reject', edits? }
- [ ] Audit + Kafka events
- [ ] Tests : 3 actions

**Fichiers crees / modifies** :
```
repo/packages/repair/src/services/diagnostics.service.ts                          # update : applyIaEstimation()
repo/apps/api/src/modules/repair/controllers/diagnostics.controller.ts             # update endpoint
```

**Criteres validation** :
- V1 (P0) : Accept copies suggestions
- V2 (P0) : Edit applies + logs diff
- V3 (P0) : Reject preserves diagnostic vide
- V4 (P0) : Audit complete
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.2.8 -- Cache Redis 24h + Invalidation

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 4h / Depend de 5.2.7

**But** : Cache responses IA 24h Redis (eviter re-call meme input + reduire cout Skalean AI Sprint 30+).

**Livrables checkables** :
- [ ] Wrapper cache autour client :
  - Get cache key via `client.getCacheKey(input)`
  - Cache hit : return + log hit
  - Cache miss : call client + cache result 24h
- [ ] Invalidation manuelle endpoint super admin (en cas mauvais output)
- [ ] Metrics : cache hit ratio (Sprint 27 admin dashboard)
- [ ] Tests cache hit/miss + invalidation

**Fichiers crees / modifies** :
```
repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.ts             # ~150 lignes (decorator pattern)
repo/packages/repair/src/ia-estimation/cached-ia-estimation.client.spec.ts         # tests
```

**Criteres validation** :
- V1 (P0) : Cache hit returns same result
- V2 (P0) : Cache miss calls client
- V3 (P0) : TTL 24h
- V4 (P0) : Invalidation force
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.2.9 -- Endpoints REST

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 4h / Depend de 5.2.8

**But** : Endpoints REST exposes IA estimations + admin monitoring + permissions.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes
- [ ] Endpoint admin : `GET /api/v1/admin/ia-estimations/health` :
  - Provider current (mock | skalean_ai)
  - Cache hit ratio 24h
  - Average latency
  - Failure rate
- [ ] Endpoint manual trigger (re-run estimation) : `POST /api/v1/repair/diagnostics/:id/re-estimate`
- [ ] Permissions : `repair.ia_estimations.read/validate`, `admin.ia_estimations.monitor`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/admin/controllers/admin-ia-estimations.controller.ts     # ~80 lignes
repo/packages/auth/src/rbac/permissions.enum.ts                                     # update
```

**Criteres validation** :
- V1 (P0) : Endpoints REST operationnels
- V2 (P0) : Health endpoint
- V3 (P0) : Manual re-estimate
- V4 (P0) : Tests 6+ scenarios

---

## Tache 5.2.10 -- Audit + Kafka + Analytics

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 4h / Depend de 5.2.9

**But** : Audit complet + Kafka events + integration ETL Sprint 13 ClickHouse pour analytics IA.

**Livrables checkables** :
- [ ] Kafka events :
  - `repair.ia_estimation_requested`
  - `repair.ia_estimation_completed`
  - `repair.ia_estimation_failed`
  - `repair.ia_estimation_validated_by_technician`
- [ ] ETL Sprint 13 etend : sync `repair_ia_estimations` -> `fct_ia_estimations`
- [ ] Dashboard IA : cache hit / latency / accuracy (technician acceptance rate)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                       # update : sync fct_ia_estimations
repo/infrastructure/clickhouse/schemas/fct_ia_estimations.sql                        # nouvelle table
repo/apps/api/src/modules/analytics/services/ia-estimations-dashboard.service.ts      # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Kafka events emits
- V2 (P0) : ETL sync clickhouse
- V3 (P0) : Dashboard accuracy + perf
- V4 (P0) : Tests 6+ scenarios

---

## Tache 5.2.11 -- Documentation Swap Sprint 30+

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 4h / Depend de 5.2.10

**But** : Documentation complete migration Mock -> Real Skalean AI Sprint 30+ : checklist + swap procedure + validation.

**Livrables checkables** :
- [ ] Document `repo/docs/ia-estimation-migration-sprint-30.md`
- [ ] Sections :
  - Pre-migration checklist (Skalean AI service ready, sandbox tested, etc.)
  - Swap procedure : env var change `IA_ESTIMATION_PROVIDER=skalean_ai` + restart API
  - Validation post-migration : compare 100 estimations Mock vs Real (verifier coherence outputs)
  - Rollback procedure : revert env var
  - Performance comparison : latency p95 Mock vs Real
  - Cost monitoring : Skalean AI per-call pricing tracking
- [ ] Tests integration Sprint 30+ template (a remplir par equipe Sprint 30)

**Fichiers crees / modifies** :
```
repo/docs/ia-estimation-migration-sprint-30.md                                      # ~250 lignes
repo/docs/ia-estimation-architecture.md                                              # ~150 lignes (architecture)
```

**Criteres validation** :
- V1 (P0) : Documentation complete
- V2 (P0) : Procedure detaillee
- V3 (P0) : Tests integration template

---

## Tache 5.2.12 -- Tests E2E + Photos Fixtures

**Metadonnees** : Phase 5 / Sprint 20 / P0 / 8h / Depend de 5.2.11

**But** : Suite tests E2E + fixtures photos realistic (10+ photos per damage type) pour reproducibility.

**Livrables checkables** :

**Tests E2E (25+)** :
- [ ] Mock client : 5 damage types + edge cases (10)
- [ ] DI swap : provider config (3)
- [ ] Auto-trigger : diagnostic start -> ia estimation (3)
- [ ] Workflow validation technicien : accept / edit / reject (3)
- [ ] Cache : hit/miss/invalidate (3)
- [ ] Audit + Kafka events (3)

**Fixtures photos** :
- 50+ photos S3 categorize per damage type (ou bucket S3 fixtures dedicated)
- Filename hints : `front_collision_001.jpg`, `rear_damage_002.jpg`, etc.

**Fichiers crees / modifies** :
```
repo/apps/api/test/repair/ia-estimation/{25+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-photos-fixtures.ts                                  # upload S3 photos test
```

**Criteres validation** :
- V1 (P0) : 25+ tests passent
- V2 (P0) : Fixtures photos reproducibles
- V3 (P0) : CI green
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 20

A la fin de l'execution des 12 taches :

```
IA Estimation Photos operational :
  - Interface IaEstimationPhotosClient + 2 implementations (Mock + SkaleanAi placeholder)
  - Mock client realistic (5 damage types + pricing MA)
  - DI swap factory configurable env IA_ESTIMATION_PROVIDER
  - Auto-trigger lors diagnostic.start() + BullMQ async
  - repair_ia_estimations entity + workflow validation technicien
  - Cache Redis 24h (eviter re-call same input)
  - Endpoints REST + admin monitoring health
  - ETL ClickHouse + dashboard accuracy
  - Documentation migration Sprint 30+ complete

25+ tests E2E
Sprint 30+ ready : swap Mock -> Real une seule ligne env var
```

**Sprint 21 (Sinistre Workflow) demarre avec** :
- IA estimation operationnelle pour suggestions diagnostic
- Sprint 21 implemente workflow detaille declaration -> reglement complet

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-5.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-20-ia-estimation-photos/`.

**Patterns code inline conserves** : interface IaEstimationOutputSchema Zod, mock realistic generation avec damage patterns + pseudo-deterministic seed.

**Reference** : Sprint 19 entities Repair pour relations.

---

**Fin du meta-prompt B-20 v2.2 format Option B.**
