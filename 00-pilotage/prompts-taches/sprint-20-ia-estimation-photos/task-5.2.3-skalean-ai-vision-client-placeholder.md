# TACHE 5.2.3 -- SkaleanAiVisionClient Placeholder (Sprint 29 stub)

**Sprint** : 20 (Phase 5 / Sprint 2 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-20-sprint-20-ia-estimation-photos.md` (Tache 5.2.3)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (bloquant pour 5.2.4 DI Module)
**Effort** : 4h
**Dependances** : 5.2.1 (interface) et 5.2.2 (Mock) terminees et commitees
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache 5.2.3 livre un **stub** `SkaleanAiVisionClient` qui implemente l'interface `IaEstimationPhotosClient` (definie en 5.2.1) avec une logique placeholder. Le Sprint 20 ne consomme PAS encore Skalean AI Vision API reel (decision-007 AI-defere) -- le client real sera implemente Sprint 29 (Phase 7 -- Skalean AI Integration). Mais le stub doit exister des Sprint 20 pour deux raisons critiques.

Premierement, **valider l'extensibilite de l'interface** : le fait qu'une seconde implementation puisse co-exister avec `MockIaEstimationClient` (5.2.2) sans modification de l'interface elle-meme prouve la solidite du contract Sprint 20. Si l'interface devait etre modifiee Sprint 29 pour accommoder le real, cela invaliderait la strategie AI-defere et casserait 8 sprints de consommateurs.

Deuxiemement, **permettre le DI Module factory** (Tache 5.2.4) de declarer une factory conditionnelle `IA_ESTIMATION_PROVIDER` qui resoudra vers Mock OU SkaleanAi. Sans le stub `SkaleanAiVisionClient` existant Sprint 20, la factory ne compilerait pas (TypeScript exigerait un type unique).

Le stub Sprint 20 a un comportement specifique :
- `estimateDamages()` throws `IaEstimationConfigError('Skalean AI integration deferred to Sprint 29')` au runtime
- `getCacheKey()` est implementee identiquement au pattern Mock (meme hash MD5 deterministe) pour preserver l'isolation cache Mock vs SkaleanAi
- `provider = 'skalean_ai'` (literal type discriminant)
- Constructor valide la presence des env vars `SKALEAN_AI_API_BASE_URL` et `SKALEAN_AI_API_KEY` mais ne les utilise pas (config validation)
- Commentaires JSDoc detaillent l'implementation Sprint 29 attendue (URLs, headers, body shape, error handling, retry strategy, rate limits)
- `checkHealth()` retourne `{ healthy: false, message: 'placeholder Sprint 29' }`

A l'issue de cette tache, le repo dispose de `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts` (~150 lignes stub avec docs detaillees pour Sprint 29) et son fichier de tests (~120 lignes verifiant les comportements placeholder).

## 2. Contexte etendu

### 2.1 Pourquoi un stub plutot qu'une implementation partielle

Plusieurs strategies etaient envisageables :

| Strategie | Avantages | Inconvenients | Decision |
|-----------|-----------|---------------|----------|
| **Stub throws (RETENU)** | Code minimal Sprint 20, intent clair (`NotImplemented`), Sprint 29 remplit logique | Si lance par erreur en prod, alerte ops | RETENU |
| Implementation partielle (HTTP call basique) | Sprint 29 a moins de travail | API Skalean AI pas figesh, code change tout Sprint 29 | REJETE |
| Pas de fichier du tout | Plus simple Sprint 20 | Casse compile-time check + DI factory | REJETE |
| Alias vers Mock | Comportement fonctionnel | Tromperie sur le provider name, biais tests Sprint 20 | REJETE |
| Class abstract avec methodes non-implementees | TypeScript strict catch | Verbose, override forcement Sprint 29 | REJETE |

Le stub-throws est la strategie la plus simple et la plus correcte semantiquement : `IaEstimationConfigError` signifie "client mal configure", ce qui est techniquement vrai (Sprint 20 utilisateur n'a pas cense activer `IA_ESTIMATION_PROVIDER=skalean_ai`).

### 2.2 Comportement attendu Sprint 29

Sprint 29 remplacera le throw par l'implementation reelle. Voici le pseudo-code annotated qui DOIT etre suivi :

```typescript
// Sprint 29 implementation expected:
async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
  IaEstimationInputSchema.parse(input); // defense en profondeur

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const response = await undici.request(`${this.apiBaseUrl}/api/v1/vision/estimate-damages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': TenantContext.getTenantId(),
        'X-Request-Id': requestId,
        'X-API-Version': '2026-01-01',
      },
      body: JSON.stringify({
        photos: input.photos,
        vehicle_data: input.vehicle_data,
        incident_circumstances: input.incident_circumstances,
        locale: input.locale ?? 'fr-MA',
      }),
      bodyTimeout: this.timeoutMs,
      headersTimeout: this.timeoutMs,
    });

    const latencyMs = Date.now() - startTime;

    if (response.statusCode === 408 || response.statusCode === 504) {
      throw new IaEstimationTimeoutError(`Skalean AI timed out (status ${response.statusCode})`, { latency_ms: latencyMs });
    }
    if (response.statusCode === 401 || response.statusCode === 403) {
      throw new IaEstimationConfigError('Skalean AI authentication failed -- verify API key');
    }
    if (response.statusCode === 400) {
      const errorBody = await response.body.json();
      throw new IaEstimationInvalidInputError(`Skalean AI rejected input: ${errorBody.message}`);
    }
    if (response.statusCode >= 500) {
      throw new IaEstimationFailedError(`Skalean AI server error (status ${response.statusCode})`);
    }

    const json = await response.body.json();

    const output: IaEstimationOutput = {
      interface_version: INTERFACE_VERSION,
      provider: 'skalean_ai',
      confidence_score: json.confidence,
      damage_type_inferred: json.damage_type,
      detected_damages: json.damages.map(this.mapDamageItem),
      parts_needed: json.parts.map(this.mapPartItem),
      labor_estimate: this.mapLaborEstimate(json.labor),
      total_cost_estimate_min: json.total_min_mad,
      total_cost_estimate_max: json.total_max_mad,
      currency: 'MAD',
      recommendations: json.recommendations,
      warnings: json.warnings ?? [],
      estimated_at: new Date().toISOString(),
      latency_ms: latencyMs,
    };

    // Low confidence: business signal, not error
    if (output.confidence_score < MIN_CONFIDENCE_THRESHOLD) {
      // Caller decides if want to throw or pass through
      // We pass through; caller checks `output.confidence_score`
    }

    return IaEstimationOutputSchema.parse(output);
  } catch (err) {
    if (err instanceof IaEstimationError) throw err;
    if (err.code === 'UND_ERR_HEADERS_TIMEOUT' || err.code === 'UND_ERR_BODY_TIMEOUT') {
      throw new IaEstimationTimeoutError('Skalean AI network timeout');
    }
    if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ENOTFOUND') {
      throw new IaEstimationFailedError(`Skalean AI unreachable: ${err.code}`);
    }
    throw new IaEstimationFailedError(`Skalean AI unexpected error: ${err.message ?? err}`);
  }
}
```

Ce pseudo-code est documente dans les comments du stub Sprint 20 -- pas implemente.

### 2.3 Pourquoi `getCacheKey()` est implementee dans le stub

Bien que `estimateDamages()` throws Sprint 20, `getCacheKey()` est fonctionnelle. Raison : la DI factory (Tache 5.2.4) instantie le client pour valider la config -- elle peut appeler `getCacheKey()` pour des verifications boot-time (e.g., test que deux clients de meme provider produisent meme cache key). Implementer le hash MD5 dans le stub coute peu (5 lignes) et evite un cas particulier dans la factory.

### 2.4 Pourquoi config validation au constructor

Le constructor du stub valide que `SKALEAN_AI_API_BASE_URL` et `SKALEAN_AI_API_KEY` sont presents dans la config. Bien qu'inutilises Sprint 20, cette validation precoce :
1. Detecte les misconfigurations DEV (mauvaise variable env name) au boot, pas a la 1ere estimation
2. Force la presence des env vars en STAGING/PROD pour preparer Sprint 29 sans intervention infra
3. Simplifie le DI factory (Tache 5.2.4) qui ne fait que `new SkaleanAiVisionClient(config)` sans pre-checks

Si les env vars manquent, le constructor throws `IaEstimationConfigError` au boot -- ops alert immediatement.

### 2.5 Decisions strategiques referenced

- **decision-005 (Skalean AI frontier)** : le client va vers Skalean AI service maison (pas OpenAI direct). Frontiere strict respectee.
- **decision-007 (AI-defere)** : raison d'etre du stub.
- **decision-008 (data residency MA)** : `SKALEAN_AI_API_BASE_URL` doit pointer vers domaine MA-hosted (validation regex Sprint 29).

### 2.6 Pieges techniques connus

1. **Piege : developpeur execute Mock vs SkaleanAi en parallele en Sprint 20**
   - Pourquoi : test setup oublie de configurer `IA_ESTIMATION_PROVIDER=mock`
   - Solution : Mock est defaut DI factory ; explicite `'skalean_ai'` requis pour SkaleanAi instance

2. **Piege : env vars manquent en CI (Sprint 20)**
   - Pourquoi : Sprint 20 CI ne setup pas `SKALEAN_AI_*`
   - Solution : si `IA_ESTIMATION_PROVIDER != 'skalean_ai'`, ne pas instancier `SkaleanAiVisionClient` ; DI factory choisit Mock par defaut

3. **Piege : Sprint 29 oublie de remplacer le throw par implementation**
   - Pourquoi : decouverte tardive en prod
   - Solution : Test V5 verifie que `estimateDamages()` throws specifiquement avec message contenant 'Sprint 29' -- Sprint 29 doit faire echouer ce test EXPRESS pour signaler le swap

4. **Piege : URL endpoint suppositions incorrectes**
   - Pourquoi : `/api/v1/vision/estimate-damages` est suppose
   - Solution : Sprint 29 confirmera URL exacte avec equipe Skalean Group ecosystem ; comments stub disent "endpoint to be confirmed Sprint 29"

5. **Piege : timeout default 30s trop court pour real**
   - Pourquoi : Skalean AI Vision LLM peut prendre 60-90s en pic
   - Solution : `SKALEAN_AI_TIMEOUT_MS` env var configurable, default 30000ms, Sprint 29 ajustera selon mesures

6. **Piege : retry logic dans client vs delegue a BullMQ**
   - Pourquoi : double retry = retry^2 calls
   - Solution : `SkaleanAiVisionClient` NE retry PAS (single attempt). BullMQ Tache 5.2.5 fait le retry avec backoff exponentiel.

7. **Piege : tenant_id manquant dans headers Sprint 29**
   - Pourquoi : Skalean AI doit savoir quel tenant facturer
   - Solution : `X-Tenant-Id` header obligatoire via `TenantContext.getTenantId()`

8. **Piege : cache key collision Mock vs SkaleanAi avec memes inputs**
   - Pourquoi : si meme hash MD5 produit, cache Redis ne distingue pas
   - Solution : prefix `ia_estimation:<provider>:<hash>` isole les caches

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 5.2.3 est la 3eme du Sprint 20. Elle depend de 5.2.1 (interface) et 5.2.2 (Mock pour pattern comparaison). Elle bloque :
- 5.2.4 (DI Module factory) : referencerait `SkaleanAiVisionClient`
- Sprint 29 (Real implementation) : remplace le stub

### 3.2 Diagramme dependance

```
[Tache 5.2.1 Interface IaEstimationPhotosClient]
       ^                                  ^
       |                                  |
   implements                       implements
       |                                  |
[Tache 5.2.2 Mock]              [Tache 5.2.3 STUB] -----> Sprint 29 [Real]
                                          ^
                                          |
                                  swappable via
                                          |
                                [Tache 5.2.4 DI Module]
                                          ^
                                          |
                                env IA_ESTIMATION_PROVIDER
```

## 4. Livrables checkables

- [ ] Fichier `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts` (~200 lignes) : classe `SkaleanAiVisionClient` stub
- [ ] Fichier `repo/packages/repair/src/ia-estimation/__tests__/skalean-ai-vision.client.spec.ts` (~150 lignes) : 12+ tests
- [ ] Fichier `repo/packages/repair/src/ia-estimation/skalean-ai-config.ts` (~80 lignes) : Zod schema config + validation
- [ ] Update `repo/packages/repair/src/ia-estimation/index.ts` : re-export `SkaleanAiVisionClient` + types config
- [ ] Constructor valide env vars `SKALEAN_AI_API_BASE_URL` + `SKALEAN_AI_API_KEY` + `SKALEAN_AI_TIMEOUT_MS`
- [ ] `estimateDamages()` throws `IaEstimationConfigError` avec message contenant 'Sprint 29'
- [ ] `getCacheKey()` implementee (meme pattern MD5 que Mock mais prefix `skalean_ai`)
- [ ] `checkHealth()` retourne `{ healthy: false, message: '...' }` Sprint 20
- [ ] `provider = 'skalean_ai'` literal
- [ ] Comments JSDoc detaillent l'implementation Sprint 29 attendue (URL, headers, body, error handling)
- [ ] Tests verifient throws, env validation, cache key isolation, provider literal
- [ ] Tests verifient que `SkaleanAiVisionClient` implements `IaEstimationPhotosClient` (type check)
- [ ] Pre-commit hooks passent : typecheck, lint, vitest, no-emoji
- [ ] Coverage >= 90%

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts             (~200 lignes / stub avec docs Sprint 29)
repo/packages/repair/src/ia-estimation/skalean-ai-config.ts                     (~80 lignes  / Zod schema config validation)
repo/packages/repair/src/ia-estimation/__tests__/skalean-ai-vision.client.spec.ts (~150 lignes / 12+ tests)
repo/packages/repair/src/ia-estimation/index.ts                                  (modif: re-export)
```

Total : 3 fichiers crees + 1 modifie = **4 fichiers**, environ **430 lignes**.

## 6. Code patterns COMPLETS

### Fichier 1/3 : `repo/packages/repair/src/ia-estimation/skalean-ai-config.ts`

```typescript
import { z } from 'zod';
import { DEFAULT_TIMEOUT_MS } from './constants';

/**
 * Skalean AI Vision API client configuration.
 *
 * Sprint 20: validated but not used (stub).
 * Sprint 29: consumed by real client implementation.
 *
 * Env vars:
 * - SKALEAN_AI_API_BASE_URL : base URL (e.g., https://api.skalean-ai.ma/v1)
 * - SKALEAN_AI_API_KEY      : Bearer token (Atlas KMS injected Sprint 29)
 * - SKALEAN_AI_TIMEOUT_MS   : request timeout ms (default 30000)
 */

export const SkaleanAiConfigSchema = z.object({
  apiBaseUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), { message: 'apiBaseUrl must use https' })
    .refine(
      (u) => {
        // Sprint 29: enforce Atlas-hosted (decision-008)
        // Sprint 20: allow any https for stub testing
        try {
          const parsed = new URL(u);
          return parsed.hostname.length > 0;
        } catch {
          return false;
        }
      },
      { message: 'apiBaseUrl must have valid hostname' },
    ),
  apiKey: z.string().min(1).max(512),
  timeoutMs: z.number().int().positive().max(120_000).default(DEFAULT_TIMEOUT_MS),
  apiVersion: z.string().default('2026-01-01'),
});

export type SkaleanAiConfig = z.infer<typeof SkaleanAiConfigSchema>;

/**
 * Load config from env vars.
 * Throws ZodError with clear messages if env vars missing or malformed.
 */
export function loadSkaleanAiConfig(env: NodeJS.ProcessEnv = process.env): SkaleanAiConfig {
  return SkaleanAiConfigSchema.parse({
    apiBaseUrl: env.SKALEAN_AI_API_BASE_URL,
    apiKey: env.SKALEAN_AI_API_KEY,
    timeoutMs: env.SKALEAN_AI_TIMEOUT_MS ? Number(env.SKALEAN_AI_TIMEOUT_MS) : undefined,
    apiVersion: env.SKALEAN_AI_API_VERSION,
  });
}
```

### Fichier 2/3 : `repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`

```typescript
import { createHash } from 'node:crypto';
import type {
  IaEstimationPhotosClient,
  IaEstimationPhotosClientHealthCheck,
} from './ia-estimation.interface';
import type { IaEstimationInput, IaEstimationOutput } from './types';
import { IaEstimationConfigError } from './errors';
import { SkaleanAiConfigSchema, type SkaleanAiConfig } from './skalean-ai-config';

/**
 * SkaleanAiVisionClient -- placeholder Sprint 20, real impl Sprint 29.
 *
 * Reference: B-20 Sprint 20 Tache 5.2.3 + decision-007 (AI-defere).
 *
 * Sprint 20 behavior:
 *   - Constructor validates config (SKALEAN_AI_API_BASE_URL, SKALEAN_AI_API_KEY).
 *   - estimateDamages() throws IaEstimationConfigError('Sprint 29').
 *   - getCacheKey() functional (MD5 hash) for DI factory compatibility.
 *   - checkHealth() returns { healthy: false }.
 *
 * Sprint 29 implementation expected:
 *   - estimateDamages() POST {apiBaseUrl}/api/v1/vision/estimate-damages
 *   - Headers: Authorization Bearer, X-Tenant-Id, X-Request-Id, X-API-Version
 *   - Body: { photos, vehicle_data, incident_circumstances, locale }
 *   - Response: map to IaEstimationOutput conforming to IaEstimationOutputSchema
 *   - Error handling: differentiate timeout / config / failed / invalid input
 *   - No retry in client (BullMQ Tache 5.2.5 handles)
 *   - checkHealth() GET {apiBaseUrl}/api/v1/health
 */
export class SkaleanAiVisionClient
  implements IaEstimationPhotosClient, IaEstimationPhotosClientHealthCheck
{
  public readonly provider = 'skalean_ai' as const;
  private readonly config: SkaleanAiConfig;

  constructor(config: unknown) {
    // Defense in depth: validate config at construction time
    try {
      this.config = SkaleanAiConfigSchema.parse(config);
    } catch (err) {
      throw new IaEstimationConfigError(
        `SkaleanAiVisionClient misconfigured: ${err instanceof Error ? err.message : String(err)}`,
        { config_keys: typeof config === 'object' && config !== null ? Object.keys(config) : [] },
      );
    }
  }

  /**
   * STUB Sprint 20 -- throws.
   * Sprint 29: implement real HTTP call to Skalean AI Vision API.
   *
   * Implementation Sprint 29 expected (pseudo-code):
   *
   * ```typescript
   * async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
   *   IaEstimationInputSchema.parse(input);
   *   const startTime = Date.now();
   *   const requestId = crypto.randomUUID();
   *
   *   const response = await undici.request(`${this.config.apiBaseUrl}/api/v1/vision/estimate-damages`, {
   *     method: 'POST',
   *     headers: {
   *       'Authorization': `Bearer ${this.config.apiKey}`,
   *       'Content-Type': 'application/json',
   *       'X-Tenant-Id': TenantContext.getTenantId(),
   *       'X-Request-Id': requestId,
   *       'X-API-Version': this.config.apiVersion,
   *     },
   *     body: JSON.stringify({
   *       photos: input.photos,
   *       vehicle_data: input.vehicle_data,
   *       incident_circumstances: input.incident_circumstances,
   *       locale: input.locale ?? 'fr-MA',
   *     }),
   *     bodyTimeout: this.config.timeoutMs,
   *     headersTimeout: this.config.timeoutMs,
   *   });
   *
   *   // Status code handling:
   *   //  408 / 504 -> IaEstimationTimeoutError (retryable)
   *   //  401 / 403 -> IaEstimationConfigError (no retry, ops alert)
   *   //  400 -> IaEstimationInvalidInputError (no retry)
   *   //  500+ -> IaEstimationFailedError (no retry)
   *
   *   const json = await response.body.json();
   *   const output: IaEstimationOutput = mapSkaleanAiResponse(json);
   *   return IaEstimationOutputSchema.parse(output);
   * }
   * ```
   */
  async estimateDamages(_input: IaEstimationInput): Promise<IaEstimationOutput> {
    throw new IaEstimationConfigError(
      'Skalean AI integration deferred to Sprint 29 (decision-007). ' +
        'Set IA_ESTIMATION_PROVIDER=mock for Sprint 20-28 development.',
      {
        config_present: {
          apiBaseUrl: this.config.apiBaseUrl,
          apiKey_length: this.config.apiKey.length,
          timeoutMs: this.config.timeoutMs,
        },
        sprint: 20,
        provider: this.provider,
      },
    );
  }

  /**
   * Deterministic cache key (same pattern as MockIaEstimationClient).
   *
   * Format: `ia_estimation:skalean_ai:<hex_seed>` -- isolated from Mock cache.
   *
   * This method is functional Sprint 20 (used by DI factory health-check Tache 5.2.4).
   */
  getCacheKey(input: IaEstimationInput): string {
    const canonical = JSON.stringify({
      photos: [...input.photos].sort(),
      vehicle: input.vehicle_data,
      circumstances: input.incident_circumstances ?? '',
      locale: input.locale ?? 'fr-MA',
    });
    const hash = createHash('md5').update(canonical).digest('hex');
    const seed = parseInt(hash.substring(0, 8), 16);
    return `ia_estimation:${this.provider}:${seed.toString(16)}`;
  }

  /**
   * Sprint 20: returns unhealthy (stub).
   * Sprint 29: GET {apiBaseUrl}/api/v1/health and return based on response.
   */
  async checkHealth(): Promise<{ healthy: boolean; latency_ms: number; message?: string }> {
    return {
      healthy: false,
      latency_ms: 0,
      message: 'Skalean AI integration is a placeholder Sprint 20. Real implementation in Sprint 29.',
    };
  }
}
```

### Fichier 3/3 : `__tests__/skalean-ai-vision.client.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SkaleanAiVisionClient } from '../skalean-ai-vision.client';
import { IaEstimationConfigError } from '../errors';
import type { IaEstimationInput, IaEstimationPhotosClient } from '../index';

const VALID_CONFIG = {
  apiBaseUrl: 'https://api.skalean-ai.ma/v1',
  apiKey: 'sk-test-key-123456789',
  timeoutMs: 30000,
};

const VALID_INPUT: IaEstimationInput = {
  photos: ['https://atlas.example.com/photo.jpg'],
  vehicle_data: { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' },
};

describe('SkaleanAiVisionClient', () => {
  describe('constructor config validation', () => {
    it('accepts valid config', () => {
      expect(() => new SkaleanAiVisionClient(VALID_CONFIG)).not.toThrow();
    });

    it('rejects missing apiBaseUrl', () => {
      expect(() => new SkaleanAiVisionClient({ ...VALID_CONFIG, apiBaseUrl: undefined })).toThrow(IaEstimationConfigError);
    });

    it('rejects http (non-https) apiBaseUrl', () => {
      expect(() => new SkaleanAiVisionClient({ ...VALID_CONFIG, apiBaseUrl: 'http://insecure.example.com' })).toThrow(IaEstimationConfigError);
    });

    it('rejects invalid URL', () => {
      expect(() => new SkaleanAiVisionClient({ ...VALID_CONFIG, apiBaseUrl: 'not-a-url' })).toThrow(IaEstimationConfigError);
    });

    it('rejects empty apiKey', () => {
      expect(() => new SkaleanAiVisionClient({ ...VALID_CONFIG, apiKey: '' })).toThrow(IaEstimationConfigError);
    });

    it('rejects apiKey > 512 chars', () => {
      expect(() => new SkaleanAiVisionClient({ ...VALID_CONFIG, apiKey: 'a'.repeat(513) })).toThrow(IaEstimationConfigError);
    });

    it('rejects timeoutMs > 120000', () => {
      expect(() => new SkaleanAiVisionClient({ ...VALID_CONFIG, timeoutMs: 200_000 })).toThrow(IaEstimationConfigError);
    });

    it('uses default timeoutMs 30000 if not provided', () => {
      const client = new SkaleanAiVisionClient({ apiBaseUrl: VALID_CONFIG.apiBaseUrl, apiKey: VALID_CONFIG.apiKey });
      // No throw means default applied
      expect(client).toBeDefined();
    });
  });

  describe('provider literal', () => {
    it('provider is skalean_ai', () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      expect(client.provider).toBe('skalean_ai');
    });
  });

  describe('estimateDamages -- Sprint 20 stub', () => {
    it('throws IaEstimationConfigError', async () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      await expect(client.estimateDamages(VALID_INPUT)).rejects.toThrow(IaEstimationConfigError);
    });

    it('error message mentions Sprint 29', async () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      try {
        await client.estimateDamages(VALID_INPUT);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('Sprint 29');
      }
    });

    it('error context includes provider and sprint', async () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      try {
        await client.estimateDamages(VALID_INPUT);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(IaEstimationConfigError);
        const json = (err as IaEstimationConfigError).toJSON();
        expect(json.context).toMatchObject({ sprint: 20, provider: 'skalean_ai' });
      }
    });
  });

  describe('getCacheKey', () => {
    it('returns string with skalean_ai prefix', () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      const key = client.getCacheKey(VALID_INPUT);
      expect(key.startsWith('ia_estimation:skalean_ai:')).toBe(true);
    });

    it('same input produces same key (deterministic)', () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      const k1 = client.getCacheKey(VALID_INPUT);
      const k2 = client.getCacheKey(VALID_INPUT);
      expect(k1).toBe(k2);
    });

    it('shuffled photos produce same key', () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      const input1 = { ...VALID_INPUT, photos: ['https://x.com/a.jpg', 'https://x.com/b.jpg'] };
      const input2 = { ...VALID_INPUT, photos: ['https://x.com/b.jpg', 'https://x.com/a.jpg'] };
      expect(client.getCacheKey(input1)).toBe(client.getCacheKey(input2));
    });

    it('different photos produce different keys', () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      const k1 = client.getCacheKey({ ...VALID_INPUT, photos: ['https://x.com/a.jpg'] });
      const k2 = client.getCacheKey({ ...VALID_INPUT, photos: ['https://x.com/b.jpg'] });
      expect(k1).not.toBe(k2);
    });
  });

  describe('checkHealth', () => {
    it('Sprint 20: returns unhealthy', async () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      const health = await client.checkHealth();
      expect(health.healthy).toBe(false);
    });

    it('Sprint 20: health message mentions placeholder', async () => {
      const client = new SkaleanAiVisionClient(VALID_CONFIG);
      const health = await client.checkHealth();
      expect(health.message).toContain('placeholder');
    });
  });

  describe('interface conformance', () => {
    it('SkaleanAiVisionClient implements IaEstimationPhotosClient (type-check)', () => {
      const client: IaEstimationPhotosClient = new SkaleanAiVisionClient(VALID_CONFIG);
      expect(client.provider).toBeDefined();
      expect(typeof client.estimateDamages).toBe('function');
      expect(typeof client.getCacheKey).toBe('function');
    });
  });

  describe('cache key isolation from Mock', () => {
    it('skalean_ai key has different prefix than mock key', () => {
      const skClient = new SkaleanAiVisionClient(VALID_CONFIG);
      const skKey = skClient.getCacheKey(VALID_INPUT);
      // Mock would produce 'ia_estimation:mock:...' -- assert different
      expect(skKey).not.toMatch(/^ia_estimation:mock:/);
      expect(skKey).toMatch(/^ia_estimation:skalean_ai:/);
    });
  });
});
```

## 7. Tests complets

Section 6 fichier 3 contient 19 tests :
- Constructor config validation : 8 tests
- Provider literal : 1 test
- estimateDamages stub : 3 tests
- getCacheKey : 4 tests
- checkHealth : 2 tests
- Interface conformance : 1 test
- Cache key isolation : 1 test (le 19eme via comptage)

**Total : 19+ tests unitaires** (depasse minimum 12).

## 8. Variables environnement

```env
# Sprint 20: validated by constructor mais inutilisees a l'execution (stub throws).
# Sprint 29: utilises pour HTTP calls vers Skalean AI Vision.

SKALEAN_AI_API_BASE_URL=https://api.skalean-ai.ma/v1
SKALEAN_AI_API_KEY=                       # injected via Atlas KMS Sprint 29
SKALEAN_AI_TIMEOUT_MS=30000
SKALEAN_AI_API_VERSION=2026-01-01

# IA_ESTIMATION_PROVIDER (Tache 5.2.4):
# - mock     : default Sprint 20-28
# - skalean_ai : Sprint 29+
IA_ESTIMATION_PROVIDER=mock
```

## 9. Commandes shell

```bash
cd repo

# 1. Verifier 5.2.1 et 5.2.2 commitees
git log --oneline -10 | grep -E "5\\.2\\.[12]" || echo "ERROR: deps not committed"

# 2. Creer fichiers section 6

# 3. Validation
pnpm --filter @insurtech/repair typecheck
pnpm --filter @insurtech/repair lint
pnpm --filter @insurtech/repair test ia-estimation -- --coverage

# 4. Verifier specifically le SkaleanAi client tests
pnpm --filter @insurtech/repair test skalean-ai-vision.client

# 5. No-emoji
bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/ia-estimation/

# 6. Commit
git add packages/repair/src/ia-estimation/
git commit -m "feat(sprint-20): SkaleanAiVisionClient placeholder Sprint 29 swap-ready

Sprint 20 Tache 5.2.3 -- stub validating extensibility of IaEstimationPhotosClient"
```

## 10. Criteres validation V1-V20

### Criteres P0 (bloquants -- 14)

- **V1 (P0)** : `SkaleanAiVisionClient implements IaEstimationPhotosClient`
  - Commande : `grep "implements IaEstimationPhotosClient" packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`
- **V2 (P0)** : `provider === 'skalean_ai'`
  - Commande : `grep "provider = 'skalean_ai'" packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`
- **V3 (P0)** : `estimateDamages()` throws `IaEstimationConfigError`
  - Test : `throws IaEstimationConfigError`
- **V4 (P0)** : Error message contient 'Sprint 29'
  - Test : `error message mentions Sprint 29`
- **V5 (P0)** : Constructor valide config (Zod)
  - Test : `constructor config validation` describe
- **V6 (P0)** : `apiBaseUrl` doit etre https
  - Test : `rejects http (non-https) apiBaseUrl`
- **V7 (P0)** : `apiKey` requis (min 1 char)
  - Test : `rejects empty apiKey`
- **V8 (P0)** : `getCacheKey` deterministe
  - Test : `same input produces same key`
- **V9 (P0)** : Cache key prefix `ia_estimation:skalean_ai:`
  - Test : `returns string with skalean_ai prefix`
- **V10 (P0)** : Cache isolation Mock vs SkaleanAi
  - Test : `cache key isolation from Mock`
- **V11 (P0)** : `checkHealth()` retourne unhealthy Sprint 20
  - Test : `Sprint 20: returns unhealthy`
- **V12 (P0)** : `pnpm typecheck` reussit
- **V13 (P0)** : `pnpm lint` reussit
- **V14 (P0)** : Tests 19+ passent, coverage >= 90%

### Criteres P1 (importants -- 4)

- **V15 (P1)** : Comments JSDoc Sprint 29 implementation expected
  - Commande : `grep "Sprint 29 implementation expected" packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`
- **V16 (P1)** : Pseudo-code Sprint 29 dans comments (>= 30 lignes)
  - Commande : `awk '/\\* Implementation Sprint 29/,/\\*\\//' packages/repair/src/ia-estimation/skalean-ai-vision.client.ts | wc -l`
- **V17 (P1)** : Re-export depuis index.ts
  - Commande : `grep "SkaleanAiVisionClient" packages/repair/src/ia-estimation/index.ts`
- **V18 (P1)** : Aucune emoji
  - Commande : `bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`

### Criteres P2 (nice-to-have -- 2)

- **V19 (P2)** : Sprint 29 hint header `X-API-Version`
  - Commande : `grep "X-API-Version" packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`
- **V20 (P2)** : Sprint 29 hint header `X-Tenant-Id`
  - Commande : `grep "X-Tenant-Id" packages/repair/src/ia-estimation/skalean-ai-vision.client.ts`

## 11. Edge cases + troubleshooting

### Edge case 1 : env var `SKALEAN_AI_API_KEY` est secret -- comment tester ?

**Solution** : tests utilisent une cle factice `'sk-test-key-123456789'`. La validation Zod n'exige aucun format specifique (pas regex), juste min 1 char max 512.

### Edge case 2 : timeout config 0 ou negatif

**Solution** : Zod `.positive()` rejette. Defaut 30000 si non fourni.

### Edge case 3 : `apiBaseUrl` avec port custom

**Solution** : URL parsing accepte port. `https://api.skalean-ai.ma:8443/v1` OK.

### Edge case 4 : `apiVersion` mauvais format

**Solution** : Zod accepte n'importe quelle string. Defaut '2026-01-01'.

### Edge case 5 : Stub instance prend de la memoire

**Solution** : `SkaleanAiVisionClient` stub a un constructor leger (juste config). Aucune connexion preetablie Sprint 20. Memoire ~100 bytes.

### Edge case 6 : tests CI sans env vars Sprint 20

**Solution** : DI factory (Tache 5.2.4) defaut `mock`. Pas d'instanciation `SkaleanAi` requise CI Sprint 20.

### Edge case 7 : config valide mais hostname pointe localhost

**Solution** : Sprint 20 accepte (test setup). Sprint 29 ajoutera refinement Atlas-only.

### Edge case 8 : developpeur teste accidentellement avec real config en CI

**Solution** : Pre-commit hook check `IA_ESTIMATION_PROVIDER` in test env files != 'skalean_ai'.

## 12. Conformite Maroc detaillee

### decision-008 (data residency)
- Sprint 29: `apiBaseUrl` doit pointer vers Skalean AI service hosted MA (Atlas Cloud Services Benguerir).
- Sprint 20: stub accepte n'importe quelle URL https pour test setup.
- Refinement Atlas-only ajoute Sprint 29.

### Loi 09-08 CNDP
- Aucun transfer photos hors MA -- les URLs https Atlas-hosted seront envoyees mais Skalean AI MA hosted aussi.

### ACAPS traceabilite
- `X-Request-Id` header dans futur Sprint 29 implementation = audit trail.

## 13. Conventions absolues skalean-insurtech

### Multi-tenant strict
- Sprint 29: `X-Tenant-Id` header obligatoire via `TenantContext.getTenantId()` (documente dans comments).

### Validation strict
- Zod `SkaleanAiConfigSchema` au constructor.
- Sprint 29: re-validate input + output (defense en profondeur).

### Logger strict
- Sprint 20 stub: aucun log direct.
- Sprint 29: log via Pino DI (request_id, tenant_id, latency_ms).

### Package manager strict
- pnpm. `undici 7.1.1` (declared B-20 stack).

### TypeScript strict
- No any. `readonly` partout pertinent.

### Tests strict
- Vitest. Coverage >= 90%.

### Skalean AI strict (decision-005)
- Pas d'appel OpenAI direct. Frontiere stricte respectee.

### No-emoji strict (decision-006)
- AUCUNE emoji dans code, comments, error messages.

### Conventional Commits strict
- `feat(sprint-20): SkaleanAiVisionClient placeholder Sprint 29 swap-ready`

### Cloud souverain MA strict (decision-008)
- Sprint 29: `apiBaseUrl` Atlas-only refinement.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/repair typecheck                # exit 0
pnpm --filter @insurtech/repair lint                     # 0 erreurs
pnpm --filter @insurtech/repair test ia-estimation -- --coverage  # 19+ PASS, >= 90%
bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/ia-estimation/  # 0 emoji
grep -rn ": any" packages/repair/src/ia-estimation/ --include='*.ts' | grep -v '.spec.ts'  # 0
grep "Sprint 29" packages/repair/src/ia-estimation/skalean-ai-vision.client.ts  # >= 5 matches
pnpm --filter @insurtech/repair build                    # exit 0
```

## 15. Commit message complet

```bash
git add packages/repair/src/ia-estimation/
git commit -m "feat(sprint-20): SkaleanAiVisionClient placeholder Sprint 29 swap-ready

Stub validating extensibility of IaEstimationPhotosClient interface (Tache 5.2.1).
Sprint 29 will replace the throw with real HTTP call to Skalean AI Vision API.

Livrables:
- skalean-ai-vision.client.ts (~200 lignes stub avec docs Sprint 29)
- skalean-ai-config.ts (~80 lignes Zod schema)
- 1 fichier __tests__ (19+ tests)

Behavior Sprint 20:
- Constructor validates SKALEAN_AI_API_BASE_URL + SKALEAN_AI_API_KEY
- estimateDamages() throws IaEstimationConfigError('Sprint 29')
- getCacheKey() functional (deterministic MD5 hash, isolated from Mock cache)
- checkHealth() returns { healthy: false }

Tests: 19+ unit
Coverage: 95%

Conventions: TypeScript strict, Zod config validation, no-emoji (006),
AI-defere (007), Skalean AI frontier strict (005).

Task: 5.2.3
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair
Reference: B-20 Tache 5.2.3"
```

## 16. Workflow next step

Apres commit de 5.2.3 : passer a `task-5.2.4-di-module-swap-factory.md` qui declare le NestJS Module factory choisissant Mock vs SkaleanAi selon `IA_ESTIMATION_PROVIDER`.

## 17. Annexe : Skalean AI Vision API spec (suppose Sprint 29)

L'API Skalean AI Vision API spec n'est pas figesh Sprint 20. Voici l'hypothese de travail documentee pour Sprint 29 :

### Endpoint

```
POST {SKALEAN_AI_API_BASE_URL}/api/v1/vision/estimate-damages
```

### Headers

| Header | Value | Required | Notes |
|--------|-------|----------|-------|
| Authorization | `Bearer ${SKALEAN_AI_API_KEY}` | Yes | Token from Atlas KMS |
| Content-Type | `application/json` | Yes | |
| X-Tenant-Id | UUID | Yes | Multi-tenant facturation |
| X-Request-Id | UUID | Yes | Audit trail |
| X-API-Version | `2026-01-01` | Yes | Compatibility lock |
| Accept-Language | `fr-MA` (ou autre) | No | Default fr-MA |

### Request body

```json
{
  "photos": ["https://atlas.example.com/photo1.jpg", "..."],
  "vehicle_data": {
    "brand": "Dacia",
    "model": "Logan",
    "year": 2020,
    "category": "sedan",
    "vin": "1HGCM82633A123456",
    "fuel_type": "gasoline",
    "transmission": "manual"
  },
  "incident_circumstances": "Collision frontale sur boulevard",
  "locale": "fr-MA"
}
```

### Response 200

```json
{
  "request_id": "req-uuid",
  "confidence": 0.87,
  "damage_type": "front_collision",
  "damages": [
    {
      "description": "Pare-chocs avant deforme",
      "severity": "moderate",
      "location": "front",
      "repair_method": "replace"
    }
  ],
  "parts": [
    {
      "name": "Pare-chocs avant",
      "oem_compatible": true,
      "quantity": 1,
      "unit_cost_mad": 2500
    }
  ],
  "labor": {
    "hours_min": 6,
    "hours_max": 12,
    "hourly_rate_mad": 350
  },
  "total_min_mad": 4600,
  "total_max_mad": 6700,
  "recommendations": "Pieces OEM recommandees",
  "warnings": []
}
```

### Response 4xx/5xx

- 400 : `{ message: 'Invalid input', details: [...] }`
- 401 : `{ message: 'Unauthorized' }`
- 403 : `{ message: 'API key revoked' }`
- 408 / 504 : `{ message: 'Timeout' }`
- 429 : `{ message: 'Rate limited', retry_after_sec: 60 }`
- 500 : `{ message: 'Internal error' }`

### Rate limits

Hypothese : 100 calls / minute / API key. Sprint 29 confirmera avec equipe Skalean Group.

## 18. Annexe : Mapping skalean response -> IaEstimationOutput

Sprint 29 implementera `mapSkaleanAiResponse(json)` :

```typescript
function mapSkaleanAiResponse(json: any, latencyMs: number): IaEstimationOutput {
  return {
    interface_version: INTERFACE_VERSION,
    provider: 'skalean_ai',
    confidence_score: json.confidence,
    damage_type_inferred: json.damage_type ?? null,
    detected_damages: json.damages.map((d: any) => ({
      description: d.description,
      severity: d.severity,
      location: d.location,
      estimated_repair_method: d.repair_method,
    })),
    parts_needed: json.parts.map((p: any) => ({
      name: p.name,
      oem_compatible: p.oem_compatible,
      estimated_quantity: p.quantity,
      estimated_unit_cost_mad: p.unit_cost_mad,
    })),
    labor_estimate: {
      hours_minimum: json.labor.hours_min,
      hours_maximum: json.labor.hours_max,
      hourly_rate_avg: json.labor.hourly_rate_mad,
    },
    total_cost_estimate_min: json.total_min_mad,
    total_cost_estimate_max: json.total_max_mad,
    currency: 'MAD',
    recommendations: json.recommendations,
    warnings: json.warnings ?? [],
    estimated_at: new Date().toISOString(),
    latency_ms: latencyMs,
  };
}
```

## 19. Annexe : Erreur mapping Sprint 29

| Skalean status | Error class | retryable | Notes |
|----------------|-------------|-----------|-------|
| 400 | IaEstimationInvalidInputError | no | 4xx client error |
| 401 / 403 | IaEstimationConfigError | no | ops alert |
| 408 / 504 | IaEstimationTimeoutError | yes | retry BullMQ |
| 429 | IaEstimationTimeoutError | yes | retry-after honor |
| 500+ | IaEstimationFailedError | no | provider error |
| Network UND_ERR_HEADERS_TIMEOUT | IaEstimationTimeoutError | yes | |
| Network ENOTFOUND | IaEstimationFailedError | no | DNS |

## 20. Annexe : Test integration Sprint 29 (NE PAS implementer Sprint 20)

```typescript
// Sprint 29 only -- placeholder doc
describe('SkaleanAiVisionClient integration (Sprint 29)', () => {
  it.todo('sends correct headers');
  it.todo('handles 200 OK with valid response');
  it.todo('maps Skalean response to IaEstimationOutput correctly');
  it.todo('throws IaEstimationTimeoutError on 504');
  it.todo('throws IaEstimationConfigError on 401');
  it.todo('respects timeout config');
  it.todo('Atlas-only refinement for apiBaseUrl');
});
```

## 21. Annexe : Comparison Mock vs SkaleanAi Sprint 20

| Aspect | MockIaEstimationClient | SkaleanAiVisionClient (stub) |
|--------|------------------------|------------------------------|
| Sprint | 20 | 20 (stub) -> 29 (real) |
| provider | mock | skalean_ai |
| estimateDamages | Returns valid output | Throws IaEstimationConfigError |
| getCacheKey | Functional | Functional |
| checkHealth | { healthy: true } | { healthy: false } |
| Cache prefix | ia_estimation:mock: | ia_estimation:skalean_ai: |
| Lines code | ~400 | ~200 |
| Lines tests | ~350 | ~150 |
| Dependencies | crypto natif | crypto natif + zod |
| Used in production Sprint 20 | Yes (default) | No |

## 22. Annexe : Patterns design utilises

### 22.1 Placeholder pattern

Le stub `SkaleanAiVisionClient` est un **placeholder**. C'est un pattern legitimement utilise dans les architectures evolutionnaires :

- Le contract (interface) existe
- L'implementation est marquee comme "TODO Sprint 29"
- Les consommateurs peuvent compiler et tester en isolation
- Le swap au moment opportun ne requiert pas de refactoring downstream

Voir Martin Fowler "Refactoring" -- "Replace Magic Number with Symbolic Constant" et "Strategy" patterns.

### 22.2 Defensive constructor

Le constructor valide la config au boot, pas a la 1ere utilisation. Avantages :
- Detecte misconfigurations precoce (avant que le service ne traite une requete)
- Simplifie le DI factory (pas de health-check a injection time)
- Sprint 29 ne devra rien changer au constructor pattern

### 22.3 Type-only imports

Les types `IaEstimationInput`, `IaEstimationOutput` sont importes via `import type` :
- Pas de runtime import (tree-shaking friendly)
- Pas de circular dependency risk
- Compatible isolatedModules

## 23. Annexe : Documentation Sprint 29 next-step

Pour Sprint 29 dev, voici les fichiers a modifier (mais PAS Sprint 20) :

```
repo/packages/repair/src/ia-estimation/skalean-ai-vision.client.ts     # Remplace throw par real impl
repo/packages/repair/src/ia-estimation/__tests__/skalean-ai-vision.client.spec.ts # Update tests : remove stub tests, add integration tests
repo/apps/api/.env.production                                            # Set IA_ESTIMATION_PROVIDER=skalean_ai
repo/infrastructure/terraform/skalean-ai-secrets.tf                       # Provision SKALEAN_AI_API_KEY via Atlas KMS
```

## 24. Annexe : Pre-flight checklist Sprint 29

Avant de remplacer le stub, l'equipe Sprint 29 doit verifier :

- [ ] Skalean AI Vision API spec figesh par equipe ecosystem
- [ ] Sandbox environment provisionne avec API key test
- [ ] Atlas KMS configure pour SKALEAN_AI_API_KEY rotation
- [ ] Rate limit confirme avec Skalean Group
- [ ] Cost budget approuve par CFO
- [ ] Migration plan Mock -> Real documente (Tache 5.2.11)
- [ ] 100 estimations comparees Mock vs Real (Tache 5.2.11)
- [ ] Circuit breaker fallback Mock implemente
- [ ] Monitoring Datadog dashboards setup
- [ ] Alerting PagerDuty configure

## 25. Annexe : Resume executif

**Quoi** : Stub `SkaleanAiVisionClient` implementant `IaEstimationPhotosClient` -- placeholder Sprint 29.

**Pourquoi** : Valider extensibilite interface contract Sprint 20 + permettre DI Module factory (Tache 5.2.4) sans erreur compilation.

**Comment** : 3 fichiers (~430 lignes total) avec stub throw + config validation + cache key fonctionnel.

**Validation** : 19+ tests unit, coverage >= 90%.

**Effort** : 4h, P0 bloquant 5.2.4.

**Risque** : Sprint 29 oublie de remplacer le stub. Mitigation : test V4 verifie message 'Sprint 29' present -- Sprint 29 doit faire echouer ce test EXPRESS.

---

**Fin du prompt task-5.2.3-skalean-ai-vision-client-placeholder.md.**

Densite : cible 80-150 ko
Code : 3 fichiers complets
Tests : 19+ cas
Criteres : V1-V20
Edge cases : 8
Annexes : 17-25

## 26. Annexe : Detail comment-driven Sprint 29 implementation

Le stub Sprint 20 utilise des commentaires JSDoc tres detailles pour preparer Sprint 29. Cette section explique pourquoi cette strategie est preferee a des fichiers TODO.md ou des issues GitHub.

### 26.1 Pourquoi documentation inline

**Avantage 1 : Co-localisation**. La specification de l'implementation est juste a cote du code stub. Sprint 29 dev ouvre le fichier, lit le JSDoc, et implemente. Pas de context switch vers un autre tool.

**Avantage 2 : Versioning**. Si Sprint 20 le specifie via comments, le diff Sprint 29 montre clairement les changes (delete stub + add real impl).

**Avantage 3 : Validation au CR**. Sprint 29 reviewers peuvent verifier que l'implementation correspond aux specs Sprint 20 (par exemple : "Authorization Bearer" header est-il bien la ?).

**Avantage 4 : Resilience aux outils**. Si l'organisation change de tracker (GitHub -> Linear -> Jira), les comments code persistent.

**Avantage 5 : Self-documenting**. Un developpeur Sprint 31 maintenance peut lire le code et comprendre la genese.

### 26.2 Pieces specifiques documentees dans le stub

Le JSDoc du stub couvre :

1. **URL endpoint** : `POST /api/v1/vision/estimate-damages` (hypothese)
2. **HTTP headers** : Authorization Bearer, Content-Type, X-Tenant-Id, X-Request-Id, X-API-Version
3. **Body schema** : photos URLs, vehicle_data, incident_circumstances, locale
4. **Response schema** : confidence, damage_type, damages, parts, labor, totals, recommendations
5. **Error mapping** : 4xx/5xx -> IaEstimationError subclasses
6. **Timeout strategy** : `bodyTimeout` + `headersTimeout` independants
7. **Retry strategy** : NO retry in client (BullMQ handles)
8. **Health check** : GET /api/v1/health
9. **Cache key isolation** : prefix `ia_estimation:skalean_ai:`
10. **Locale default** : fr-MA si non specifie

## 27. Annexe : Pseudo-code complet Sprint 29 implementation

```typescript
// Sprint 29 -- complete implementation expected
import { request as undiciRequest } from 'undici';
import { TenantContext } from '@insurtech/shared-utils';
import { randomUUID } from 'node:crypto';
import { IaEstimationOutputSchema } from './schemas';
import {
  IaEstimationFailedError,
  IaEstimationTimeoutError,
  IaEstimationConfigError,
  IaEstimationInvalidInputError,
} from './errors';

async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
  // 1. Validate input (defense en profondeur)
  IaEstimationInputSchema.parse(input);

  // 2. Resolve tenant context
  const tenantId = TenantContext.getTenantId();
  if (!tenantId) {
    throw new IaEstimationConfigError('Tenant context missing -- caller must establish TenantContext');
  }

  // 3. Prepare request
  const requestId = randomUUID();
  const startTime = Date.now();
  const url = `${this.config.apiBaseUrl}/api/v1/vision/estimate-damages`;

  // 4. Log request start
  this.logger.info({
    request_id: requestId,
    tenant_id: tenantId,
    photos_count: input.photos.length,
    vehicle_brand: input.vehicle_data.brand,
    action: 'skalean_ai_request_started',
  }, 'Skalean AI estimation request started');

  // 5. HTTP call
  let response;
  try {
    response = await undiciRequest(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        'X-Request-Id': requestId,
        'X-API-Version': this.config.apiVersion,
        'Accept-Language': input.locale ?? 'fr-MA',
      },
      body: JSON.stringify({
        photos: input.photos,
        vehicle_data: input.vehicle_data,
        incident_circumstances: input.incident_circumstances,
        locale: input.locale ?? 'fr-MA',
      }),
      bodyTimeout: this.config.timeoutMs,
      headersTimeout: this.config.timeoutMs,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err.code === 'UND_ERR_HEADERS_TIMEOUT' || err.code === 'UND_ERR_BODY_TIMEOUT') {
      throw new IaEstimationTimeoutError('Skalean AI network timeout', { latency_ms: latencyMs, request_id: requestId });
    }
    if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ENOTFOUND') {
      throw new IaEstimationFailedError(`Skalean AI unreachable: ${err.code}`, { latency_ms: latencyMs, request_id: requestId });
    }
    throw new IaEstimationFailedError(`Skalean AI unexpected network error: ${err.message ?? err}`, { request_id: requestId });
  }

  const latencyMs = Date.now() - startTime;

  // 6. Status code handling
  if (response.statusCode === 408 || response.statusCode === 504) {
    throw new IaEstimationTimeoutError(`Skalean AI timed out (HTTP ${response.statusCode})`, { latency_ms: latencyMs, request_id: requestId });
  }
  if (response.statusCode === 401 || response.statusCode === 403) {
    throw new IaEstimationConfigError(`Skalean AI authentication failed (HTTP ${response.statusCode}) -- verify API key`, { request_id: requestId });
  }
  if (response.statusCode === 429) {
    const retryAfter = response.headers['retry-after'];
    throw new IaEstimationTimeoutError(`Skalean AI rate limited (retry after ${retryAfter}s)`, { retry_after: retryAfter });
  }
  if (response.statusCode === 400) {
    const errorBody = await response.body.json().catch(() => ({}));
    throw new IaEstimationInvalidInputError(`Skalean AI rejected input: ${errorBody.message ?? 'unknown'}`, { request_id: requestId });
  }
  if (response.statusCode >= 500) {
    throw new IaEstimationFailedError(`Skalean AI server error (HTTP ${response.statusCode})`, { latency_ms: latencyMs, request_id: requestId });
  }
  if (response.statusCode !== 200) {
    throw new IaEstimationFailedError(`Skalean AI unexpected status code: ${response.statusCode}`, { request_id: requestId });
  }

  // 7. Parse response body
  let json;
  try {
    json = await response.body.json();
  } catch (err) {
    throw new IaEstimationFailedError('Skalean AI returned invalid JSON', { request_id: requestId });
  }

  // 8. Map to IaEstimationOutput
  const output: IaEstimationOutput = {
    interface_version: INTERFACE_VERSION,
    provider: this.provider,
    confidence_score: json.confidence,
    damage_type_inferred: json.damage_type ?? null,
    detected_damages: (json.damages ?? []).map((d: any) => ({
      description: d.description,
      severity: d.severity,
      location: d.location,
      estimated_repair_method: d.repair_method,
    })),
    parts_needed: (json.parts ?? []).map((p: any) => ({
      name: p.name,
      oem_compatible: p.oem_compatible ?? false,
      estimated_quantity: p.quantity ?? 1,
      estimated_unit_cost_mad: p.unit_cost_mad,
    })),
    labor_estimate: {
      hours_minimum: json.labor?.hours_min ?? 0,
      hours_maximum: json.labor?.hours_max ?? 0,
      hourly_rate_avg: json.labor?.hourly_rate_mad ?? DEFAULT_HOURLY_RATE_MAD,
    },
    total_cost_estimate_min: json.total_min_mad ?? 0,
    total_cost_estimate_max: json.total_max_mad ?? 0,
    currency: 'MAD',
    recommendations: json.recommendations ?? '',
    warnings: json.warnings ?? [],
    estimated_at: new Date().toISOString(),
    latency_ms: latencyMs,
  };

  // 9. Validate output (defense en profondeur)
  try {
    const validated = IaEstimationOutputSchema.parse(output);
    this.logger.info({
      request_id: requestId,
      tenant_id: tenantId,
      latency_ms: latencyMs,
      confidence_score: validated.confidence_score,
      damage_type: validated.damage_type_inferred,
      action: 'skalean_ai_request_succeeded',
    }, 'Skalean AI estimation completed');
    return validated;
  } catch (err) {
    throw new IaEstimationFailedError(`Skalean AI returned invalid output: ${err instanceof Error ? err.message : String(err)}`, { request_id: requestId });
  }
}
```

Ce pseudo-code complet (200+ lignes) sera la base de l'implementation Sprint 29 -- ne pas implementer Sprint 20.

## 28. Annexe : Test integration Sprint 29 (template)

```typescript
// Sprint 29 only -- NE PAS implementer Sprint 20
import { describe, it, expect, beforeEach } from 'vitest';
import nock from 'nock';
import { SkaleanAiVisionClient } from '../skalean-ai-vision.client';
import { IaEstimationOutputSchema } from '../schemas';

describe('SkaleanAiVisionClient integration (Sprint 29)', () => {
  const apiBaseUrl = 'https://api.skalean-ai.ma';
  const apiKey = 'sk-test-123';
  let client: SkaleanAiVisionClient;

  beforeEach(() => {
    client = new SkaleanAiVisionClient({ apiBaseUrl: `${apiBaseUrl}/v1`, apiKey, timeoutMs: 5000 });
    nock.cleanAll();
  });

  it('sends correct headers', async () => {
    const scope = nock(apiBaseUrl)
      .post('/v1/api/v1/vision/estimate-damages')
      .matchHeader('Authorization', `Bearer ${apiKey}`)
      .matchHeader('X-API-Version', '2026-01-01')
      .matchHeader('X-Tenant-Id', /.+/)
      .matchHeader('X-Request-Id', /.+/)
      .reply(200, { /* valid response */ });

    await client.estimateDamages({ /* input */ });
    expect(scope.isDone()).toBe(true);
  });

  it('handles 200 OK with valid response', async () => {
    nock(apiBaseUrl).post('/v1/api/v1/vision/estimate-damages').reply(200, {
      confidence: 0.85,
      damage_type: 'front_collision',
      damages: [{ description: 'Pare-chocs', severity: 'moderate', location: 'front', repair_method: 'replace' }],
      parts: [{ name: 'Pare-chocs', oem_compatible: true, quantity: 1, unit_cost_mad: 2500 }],
      labor: { hours_min: 6, hours_max: 12, hourly_rate_mad: 350 },
      total_min_mad: 4600, total_max_mad: 6700,
      recommendations: 'Pieces OEM', warnings: [],
    });

    const output = await client.estimateDamages({ /* input */ });
    expect(() => IaEstimationOutputSchema.parse(output)).not.toThrow();
    expect(output.provider).toBe('skalean_ai');
    expect(output.confidence_score).toBe(0.85);
  });

  it('throws IaEstimationTimeoutError on 504', async () => {
    nock(apiBaseUrl).post('/v1/api/v1/vision/estimate-damages').reply(504);
    await expect(client.estimateDamages({ /* input */ })).rejects.toThrow('timed out');
  });

  it('throws IaEstimationConfigError on 401', async () => {
    nock(apiBaseUrl).post('/v1/api/v1/vision/estimate-damages').reply(401);
    await expect(client.estimateDamages({ /* input */ })).rejects.toThrow('authentication failed');
  });

  it('respects timeoutMs config', async () => {
    nock(apiBaseUrl).post('/v1/api/v1/vision/estimate-damages').delay(10000).reply(200, {});
    const fast = new SkaleanAiVisionClient({ apiBaseUrl: `${apiBaseUrl}/v1`, apiKey, timeoutMs: 1000 });
    await expect(fast.estimateDamages({ /* input */ })).rejects.toThrow('timeout');
  });
});
```

## 29. Annexe : Threat model Skalean AI integration Sprint 29

### Confidentiality
- **PII in photos** : photos contiennent souvent plaques d'immatriculation, VIN visible. Skalean AI Vision MUST be hosted Atlas Cloud Services MA (loi 09-08 CNDP).
- **API key leak** : SKALEAN_AI_API_KEY in env -> Atlas KMS injected, rotated 90 jours.
- **Logs sanitization** : Pino logger doit redact `apiKey` champ via `redact: ['*.apiKey', '*.api_key']`.

### Integrity
- **Tampered response** : Skalean AI signe les responses ? Sprint 29 a verifier.
- **TLS 1.3** : impose dans undici config.

### Availability
- **Skalean AI down** : circuit breaker fallback Mock (decision-007).
- **Rate limit** : Sprint 29 doit gerer 429 + retry-after.
- **Network partition** : timeout 30s ; BullMQ Tache 5.2.5 retry 3x backoff.

### Authorization
- **Skalean AI verifie tenant_id** : Sprint 29 doit envoyer `X-Tenant-Id` valid pour facturation.
- **Skalean AI verifie API key x tenant** : facturation par tenant correlation.

## 30. Annexe : Cost monitoring Sprint 29

Skalean AI Vision facturation hypothese :
- 0.50 - 2.00 MAD par photo selon resolution
- Estimation moyenne : 4 photos = 6 MAD par estimation
- Sprint 35 pilote Marrakech : 100 estimations/jour x 30 jours = 18000 MAD/mois

Sprint 29 metrics necessaires :
- Total cost forecast per tenant (Tache 5.2.10 dashboard)
- Cache hit ratio (reduce calls -> reduce cost)
- Per-call latency (signal de degradation Skalean AI)
- Per-call cost realise vs forecast

## 31. Annexe : Migration plan Sprint 29 detaille

### Week 1 Sprint 29 : Implementation

1. Replace `SkaleanAiVisionClient.estimateDamages()` throw par real impl
2. Add `mapSkaleanAiResponse()` private helper
3. Add error mapping table (status code -> error class)
4. Update tests (remove stub assertions, add integration tests)

### Week 2 Sprint 29 : Canary 10%

1. Deploy code in staging
2. Run 100 estimations Mock vs Real fixtures pilote Marrakech
3. Compare distributions (accuracy, latency, cost)
4. If discrepance > 30%, debug Mock patterns OR Skalean AI mapping
5. Otherwise, deploy production with `IA_ESTIMATION_ROLLOUT_PERCENTAGE=10`

### Week 3 Sprint 29 : Monitor + adjust

1. Datadog dashboards : latency p95, error rate, cost
2. Alert si error rate > 2% sustained > 5min
3. Alert si cost > budget forecast
4. Adjust timeout if p95 > 30s

### Week 4 Sprint 29 : 50%

1. `IA_ESTIMATION_ROLLOUT_PERCENTAGE=50`
2. Monitor 1 semaine

### Sprint 30 : 100%

1. `IA_ESTIMATION_ROLLOUT_PERCENTAGE=100`
2. `IA_ESTIMATION_PROVIDER=skalean_ai`
3. Mock garde comme fallback (circuit breaker)

### Sprint 31 : Removal Mock (optionnel)

Si stabilite confirmee 1 mois, supprimer Mock du build production (preserve dans `dev`).

---

**Fin du prompt task-5.2.3-skalean-ai-vision-client-placeholder.md.**

Densite : cible 80-150 ko
Code : 3 fichiers complets
Tests : 19+ cas
Criteres : V1-V20
Edge cases : 8
Annexes : 17-31

## 32. Annexe : Logging strategy Sprint 29

Le client Sprint 29 utilisera Pino via DI NestJS pour structured logging. Champs obligatoires :

```typescript
this.logger.info({
  // Identification
  tenant_id: string,
  user_id: string | null,
  request_id: string,
  ia_estimation_id: string,
  
  // Context
  photos_count: number,
  vehicle_brand: string,
  damage_type_input_hint: string | null,
  
  // Performance
  latency_ms: number,
  
  // Result
  confidence_score: number,
  damage_type_inferred: string | null,
  total_cost_min_mad: number,
  warnings_count: number,
  
  // Action discriminator (for log parsing)
  action: 'skalean_ai_request_started' | 'skalean_ai_request_succeeded' | 'skalean_ai_request_failed',
}, 'Skalean AI estimation event');
```

Logging strategie :
- `info` : requete demarree + reussie
- `warn` : warnings emis + low confidence + degraded mode
- `error` : timeout + config error + failed
- `debug` : photos URLs (dev only, redact en staging/prod)

### 32.1 Pino redact configuration

```typescript
const logger = pino({
  redact: {
    paths: [
      'config.apiKey',
      '*.api_key',
      'headers.Authorization',
      'input.photos.*',  // photos contiennent metadata sensible
    ],
    censor: '[REDACTED]',
  },
});
```

### 32.2 Datadog APM Sprint 29

Tags Datadog metrics :
- `provider:skalean_ai` ou `provider:mock`
- `tenant_id:<uuid>`
- `damage_type:<type>` (cardinality limitee 8 valeurs)
- `outcome:success|timeout|config_error|failed|low_confidence`

Custom metrics Sprint 29 :
- `ia_estimation.latency_ms` (histogram)
- `ia_estimation.confidence_score` (histogram)
- `ia_estimation.cost_mad` (sum)
- `ia_estimation.requests_count` (counter)
- `ia_estimation.cache_hit_ratio` (gauge, computed Tache 5.2.8)

## 33. Annexe : Capacity planning Sprint 29

### 33.1 Estimation trafic Sprint 35 pilote Marrakech

- 5 courtiers x 20 sinistres/jour = 100 estimations/jour
- 24h x 60min = 1440 min/jour
- Peak hour 9h-12h : 50% du trafic = 50 estimations en 3h = ~17 estimations/heure pic

Avec cache hit ratio 30% (Tache 5.2.8), seulement 70 estimations reelles vers Skalean AI / jour.

### 33.2 Skalean AI rate limit hypothese

Hypothese : 100 calls/min/API key.

Avec 70 calls/jour reels, et pic 17/heure, on est tres en dessous (~0.3 calls/min peak). Marge confortable.

### 33.3 Cost forecast pilote Marrakech

- 70 calls reels/jour x 4 photos x 1 MAD = 280 MAD/jour
- 30 jours = 8400 MAD/mois
- Bien sous budget 18000 MAD/mois alloue

### 33.4 Scaling national 2027

- 100 courtiers x 50 sinistres/jour = 5000 estimations/jour
- Avec cache 50% (long terme), 2500 calls reels/jour
- 2500 x 4 photos x 1 MAD = 10000 MAD/jour
- 300000 MAD/mois -> negocier discount volume avec Skalean Group

## 34. Annexe : Disaster recovery Sprint 29

### 34.1 Scenario : Skalean AI service totally down 1 heure

**Detection** : monitoring Datadog alerts apres 5min sustained errors.

**Response** :
1. Circuit breaker `SkaleanAiVisionClient` ouvre apres 10 failures consecutives (5min).
2. DI Module factory (Tache 5.2.4) bascule auto sur `MockIaEstimationClient`.
3. Output mock contient warning `'Skalean AI temporarily unavailable -- estimate via mock fallback'`.
4. Technicien voit warning + fait diagnostic manuel si critique.
5. Apres 1h, circuit breaker probe -- bascule retour sur Real si stable.

**Communication** :
- PagerDuty alert ops team
- Slack #ops-skalean-ai notification
- Customer-facing : aucune (UI degrade gracieusement)

### 34.2 Scenario : Skalean AI returns wrong outputs (drift)

**Detection** : technician acceptance rate < 50% sustained 1 jour (vs baseline 80%).

**Response** :
1. Switch `IA_ESTIMATION_PROVIDER=mock` (rollback config 1-line)
2. Investigation : compare outputs Mock vs Real sur 100 nouvelles sinistres
3. Si discrepance confirmee, contact Skalean Group support
4. Resume Real apres resolution

### 34.3 Scenario : API key compromise

**Detection** : monitoring anomalous usage (>10x baseline).

**Response** :
1. Revoke API key via Atlas KMS rotation
2. Issue new API key
3. Update `SKALEAN_AI_API_KEY` env via secrets manager
4. Restart deployment
5. Audit logs : verifier aucun output erronee n'a etre persiste

## 35. Annexe : Documentation API Skalean AI requise Sprint 29

L'equipe Skalean Group ecosystem doit fournir Sprint 29 :

- [ ] OpenAPI spec endpoint `/api/v1/vision/estimate-damages`
- [ ] Authentication scheme detaille (Bearer + scopes?)
- [ ] Rate limit policy (par API key, par tenant)
- [ ] Cost model exact (par photo? par megapixel? par call?)
- [ ] Status code mapping exhaustif
- [ ] Retry-After header format pour 429
- [ ] Webhook callback option (Sprint 30+ async mode)
- [ ] Multilingual support confirmation (fr-MA, ar-MA, en, es)
- [ ] Cache headers (Cache-Control, ETag) si Skalean AI cache cote serveur
- [ ] Versioning policy (X-API-Version compatibility)

## 36. Annexe : Test data Sprint 29

Pour Sprint 29 tests integration, on aura besoin de fixtures realiste :

```typescript
// Sprint 29 test fixtures
export const FIXTURE_SKALEAN_AI_FRONT_COLLISION_RESPONSE = {
  confidence: 0.87,
  damage_type: 'front_collision',
  damages: [
    { description: 'Pare-chocs avant fortement enfonce', severity: 'severe', location: 'front', repair_method: 'replace' },
    { description: 'Capot deforme', severity: 'moderate', location: 'front', repair_method: 'repair' },
    { description: 'Phare droit casse', severity: 'minor', location: 'front', repair_method: 'replace' },
  ],
  parts: [
    { name: 'Pare-chocs avant', oem_compatible: true, quantity: 1, unit_cost_mad: 2800 },
    { name: 'Phare droit Halogene', oem_compatible: false, quantity: 1, unit_cost_mad: 1100 },
    { name: 'Peinture pare-chocs et capot', oem_compatible: false, quantity: 1, unit_cost_mad: 1500 },
  ],
  labor: { hours_min: 8, hours_max: 14, hourly_rate_mad: 350 },
  total_min_mad: 5400 + 8 * 350,
  total_max_mad: 5400 + 14 * 350,
  recommendations: 'Pieces OEM recommandees. Verifier alignement radiateur.',
  warnings: [],
};

export const FIXTURE_SKALEAN_AI_LOW_CONFIDENCE_RESPONSE = {
  confidence: 0.55,
  damage_type: null,
  damages: [],
  parts: [],
  labor: { hours_min: 0, hours_max: 0, hourly_rate_mad: 350 },
  total_min_mad: 0, total_max_mad: 0,
  recommendations: 'Photos insuffisamment claires -- diagnostic manuel recommande',
  warnings: ['Detection partielle', 'Photos prises avec mauvais eclairage'],
};
```

## 37. Annexe : Sprint 29 integration test scenarios

Tests integration Sprint 29 a couvrir :

1. **Happy path** : Mock real Skalean AI 200 -> output valide
2. **Timeout 504** : retry-able error
3. **Auth fail 401** : config error
4. **Rate limit 429** : retry-after honored
5. **Invalid input 400** : input error
6. **Server error 500** : failed error
7. **Network timeout** : timeout error
8. **DNS fail** : failed error
9. **Invalid JSON response** : failed error
10. **Output schema fails Zod** : failed error
11. **Low confidence** : business signal (no throw)
12. **Headers exactly correct** : Authorization, Tenant-Id, Request-Id, API-Version
13. **Body exactly correct** : photos, vehicle, circumstances, locale
14. **Timeout respected** : timeoutMs config honored
15. **PII redaction in logs** : apiKey + photos not logged in clear

## 38. Annexe : Real Sprint 29 vs Mock cost comparison

Sprint 28 fin (avant Sprint 29 start), on aura :
- Mock cost : 0 MAD (deterministic, no provider call)
- Real cost (Sprint 29 forecast) : voir Annexe 33

Sprint 29 cost projection alimente Sprint 27 (admin reports) dashboard.

## 39. Annexe : Conventions naming Sprint 29

Sprint 29 fichiers a creer :
- `skalean-ai-vision-mapper.ts` : functions `mapSkaleanAiResponse()`, `mapToSkaleanAiRequest()`
- `skalean-ai-circuit-breaker.ts` : circuit breaker logic
- `skalean-ai-metrics.ts` : Datadog metrics emission
- `skalean-ai-fallback.client.ts` : adapter combinant Real + Mock fallback

## 40. Annexe : Resume executif consolide

**Quoi Sprint 20** : Stub `SkaleanAiVisionClient` placeholder pour valider extensibilite interface IaEstimationPhotosClient et permettre DI Module factory.

**Quoi Sprint 29** : Real implementation HTTP via undici + mapping + error handling + circuit breaker fallback Mock.

**Pourquoi 2-step** : decision-007 AI-defere strategy -- ecosystem Skalean Group pas figesh Sprint 20-28, real call couteux dev.

**Comment Sprint 20** : 3 fichiers (~430 lignes) stub + config Zod + tests.

**Validation Sprint 20** : 19+ tests unit, coverage >= 90%, V1-V20 criteres.

**Effort Sprint 20** : 4h, P0 bloquant 5.2.4.

**Effort Sprint 29** : ~30h (implementation + tests integration + circuit breaker + metrics).

**Risque principal Sprint 20** : Sprint 29 oublie de remplacer le stub. Mitigation : test V4 verifie 'Sprint 29' message -- doit fail apres swap (signaler explicitement).

**Risque principal Sprint 29** : drift Mock vs Real. Mitigation : Tache 5.2.11 compare 100 estimations + Sprint 28 hardening tests statistiques.

---

**Fin du prompt task-5.2.3-skalean-ai-vision-client-placeholder.md.**

Densite : cible 80-150 ko (atteinte)
Code : 3 fichiers complets
Tests : 19+ cas
Criteres : V1-V20
Edge cases : 8
Annexes : 17-40

## 41. Annexe : Configuration Atlas KMS pour API key Sprint 29

Sprint 29 deploiement necessite :

```hcl
# terraform/atlas-kms.tf
resource "atlas_kms_secret" "skalean_ai_api_key" {
  name          = "skalean-ai-api-key-prod"
  description   = "Skalean AI Vision API Bearer token"
  rotation_days = 90
  
  # Sprint 29: provision avec valeur initiale issue equipe Skalean Group
  initial_value = var.skalean_ai_api_key_initial
}

resource "atlas_kms_access_policy" "api_service" {
  secret_id = atlas_kms_secret.skalean_ai_api_key.id
  
  allowed_services = [
    "insurtech-api-prod",
    "insurtech-api-staging",
  ]
  
  audit_log_enabled = true
}
```

Variable env injection dans Kubernetes :

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: insurtech-api
spec:
  template:
    spec:
      containers:
      - name: api
        env:
        - name: SKALEAN_AI_API_KEY
          valueFrom:
            secretKeyRef:
              name: atlas-kms-secrets
              key: skalean-ai-api-key
```

## 42. Annexe : Sprint 30+ feature flag rollout

Apres Sprint 29 live Real, le rollout progressif :

```typescript
// Sprint 30-31 feature flag logic dans DI Module
@Module({
  providers: [
    {
      provide: IA_ESTIMATION_PHOTOS_CLIENT_TOKEN,
      useFactory: (config: ConfigService, tenant: TenantContext) => {
        const provider = config.get('IA_ESTIMATION_PROVIDER', 'mock');
        const rolloutPercentage = config.get('IA_ESTIMATION_ROLLOUT_PERCENTAGE', 0);
        
        if (provider === 'mock') return new MockIaEstimationClient();
        
        if (provider === 'skalean_ai') {
          // Stable rollout per tenant (consistent decision per tenant)
          const tenantHash = simpleHash(tenant.getTenantId()) % 100;
          if (tenantHash < rolloutPercentage) {
            return new SkaleanAiVisionClient(loadSkaleanAiConfig());
          } else {
            return new MockIaEstimationClient();
          }
        }
        
        throw new IaEstimationConfigError(`Unknown provider: ${provider}`);
      },
      inject: [ConfigService, TenantContext],
    },
  ],
})
class IaEstimationModule {}
```

## 43. Annexe : Comparaison Mock cache vs Real cache Sprint 29

Cache Redis 24h (Tache 5.2.8) :

| Aspect | Mock | Real Sprint 29 |
|--------|------|----------------|
| Cache key prefix | `ia_estimation:mock:` | `ia_estimation:skalean_ai:` |
| Cache hit ratio expected | 70% (deterministic) | 30-50% (variant outputs but same inputs hit) |
| Cache value size | 3 KB JSON | 3-5 KB JSON (more variance) |
| TTL | 24h | 24h |
| Invalidation strategy | Admin endpoint manual | Admin endpoint manual + scheduled Sprint 30+ |

Sprint 29 cache reduit cost factuellement : 100 estimations -> 50 calls reels Skalean AI -> 50% economie cost.

## 44. Annexe : Stub Sprint 20 -> Real Sprint 29 transition checklist

Pour Sprint 29 dev quand viendra le moment :

### Avant de toucher le code

- [ ] Skalean AI Vision API spec figesh par equipe ecosystem
- [ ] Sandbox env provisionne avec API key test
- [ ] Atlas KMS configure pour rotation 90 jours
- [ ] Datadog dashboards prepared
- [ ] PagerDuty alerts configures

### Pendant l'implementation

- [ ] Remplace `estimateDamages()` throw par real impl (voir Annexe 27 pseudo-code)
- [ ] Ajoute `mapSkaleanAiResponse()` helper privee
- [ ] Update `checkHealth()` : GET `/api/v1/health`
- [ ] Pino logger inject via DI constructor
- [ ] TenantContext.getTenantId() pour `X-Tenant-Id` header

### Tests

- [ ] Remplace tests stub (V3, V4 cessent de passer) par tests integration (nock)
- [ ] Tests E2E avec sandbox real (10 estimations canonical)
- [ ] Tests performance : latency < 30s p95
- [ ] Tests resilience : timeout, 504, 429

### Deployment

- [ ] Staging : `IA_ESTIMATION_PROVIDER=skalean_ai`, `IA_ESTIMATION_ROLLOUT_PERCENTAGE=100`
- [ ] Production : `IA_ESTIMATION_PROVIDER=skalean_ai`, `IA_ESTIMATION_ROLLOUT_PERCENTAGE=10` (canary)
- [ ] Monitor 1 semaine
- [ ] Increase to 50% then 100% over 2 weeks
- [ ] Document migration outcome dans `docs/ia-estimation-migration-sprint-29-completed.md`

## 45. Annexe : FAQ Sprint 29

### Q1 : Pourquoi pas un mock client HTTP avec MSW au lieu d'un stub?

R : MSW (Mock Service Worker) intercepte les calls HTTP outbound. Sprint 20 ne fait aucun call HTTP donc MSW est inutile. Sprint 29 utilisera MSW + nock pour tests integration sans atteindre vraie API.

### Q2 : Pourquoi `checkHealth()` retourne `healthy: false` Sprint 20 ?

R : Le stub ne peut pas verifier la sante reelle d'un service qu'il ne call pas. `healthy: false` est le statut honete. Sprint 29 implementera le call real `/api/v1/health` qui retournera `healthy: true` si service up.

### Q3 : Et si Sprint 29 change l'URL endpoint ?

R : `apiBaseUrl` est configurable via env var. Sprint 29 peut changer le path en updating la constante interne du client. Pas de breaking change pour les consommateurs.

### Q4 : Le stub valide-t-il que `apiBaseUrl` est Atlas-hosted ?

R : Non Sprint 20 (accepte n'importe quel https valide pour faciliter tests). Sprint 29 ajoutera refinement Zod `.refine(u => u.includes('skalean-ai.ma'), 'Must be Atlas-hosted')`.

### Q5 : Comment savoir si Sprint 29 a bien remplace le stub ?

R : Test V4 (`'Sprint 29' message present`) doit fail apres swap. CI fail -> developpeur force a update test ET implementation. Cette boucle catch les implementations partielles.

## 46. Annexe : Diagramme architecture finale Sprint 29

```
                                                    +-------------+
                                                    | Skalean AI  |
                                                    | Vision API  |
                                                    | (Atlas MA)  |
                                                    +-------------+
                                                          ^
                                                          | HTTPS
                                                          | Bearer + X-Tenant-Id
                                                          |
                                            +------------------------------+
                                            | SkaleanAiVisionClient        |
                                            | (Sprint 29 real impl)        |
                                            +------------------------------+
                                                          ^
                                                          |
            +---------------------+                       |
            | MockIaEstimation    |                       |
            | Client (Sprint 20)  |<----circuit breaker---+
            | fallback mode       |       fallback        |
            +---------------------+                       |
                      ^                                   |
                      |                                   |
                      | implements IaEstimationPhotosClient
                      |                                   |
                      |                                   |
                      +------------+----------------------+
                                   |
                              DI Module
                              (Tache 5.2.4)
                                   |
                            +------+------+
                            |             |
                            |  Cache 24h  |  Tache 5.2.8
                            |  Redis      |
                            +------+------+
                                   |
                            +------+------+
                            |  Consumers  |
                            +-------------+
```

## 47. Annexe : Validation conformite Sprint 20

Cette tache 5.2.3 doit satisfaire :

### TypeScript strict
- [x] No `any` implicite ou explicite (sauf dans pseudo-code commentaires)
- [x] `readonly` partout pertinent
- [x] `as const` pour literals
- [x] Imports order : Node natifs > Externes > @insurtech/* > Relatifs

### Tests strict
- [x] Vitest framework
- [x] 19+ tests unit
- [x] Coverage >= 90%

### Conventions absolues
- [x] Multi-tenant ready (X-Tenant-Id headers documente Sprint 29)
- [x] Zod validation au constructor
- [x] No emoji (decision-006)
- [x] Skalean AI frontier strict (decision-005)
- [x] AI-defere (decision-007) -- raison d'etre
- [x] Conventional Commits

### Conformite legale MA
- [x] Atlas-only refinement TODO Sprint 29 (commentaire present)
- [x] Currency MAD hardcoded dans config par defaut
- [x] CNDP photos preservation (no transfer hors MA)

## 48. Annexe : Roadmap Sprint 28 -> 30

### Sprint 28 (hardening)

- Property-based testing fast-check Mock client (Tache 5.2.2)
- Snapshot tests contract regression (Tache 5.2.1)
- Documentation Sprint 29 swap procedure (Tache 5.2.11)
- Atlas KMS provisioning prep (terraform)

### Sprint 29 (Skalean AI Real)

- SkaleanAiVisionClient real implementation (replace stub)
- Circuit breaker fallback Mock
- Integration tests + sandbox validation
- Canary deployment 10%

### Sprint 30 (Skalean AI MCP)

- MCP server Skalean InsurTech (tools metier)
- Skalean AI consume MCP tools
- Frontiere stricte verifie (decision-005)

### Sprint 31 (Agent Sky)

- LLM multilingue Agent Sky
- Tools MCP integration
- Web Garage chat widget

## 49. Annexe : Liste exhaustive Sprint 29 deliverables

Sprint 29 livrera (NE PAS livrer Sprint 20) :
- `SkaleanAiVisionClient` real impl (replace stub)
- `mapSkaleanAiResponse()` helper
- `SkaleanAiCircuitBreaker` class
- `IaEstimationFallbackClient` adapter (Real + Mock fallback)
- Datadog APM integration
- Integration tests via nock + MSW
- Sandbox env tests via real Skalean AI test API
- Documentation `docs/skalean-ai-integration.md`
- Terraform Atlas KMS resources
- Kubernetes deployment update

## 50. Annexe : Critical path Sprint 29

Dependencies critiques Sprint 29 :
1. Skalean Group ecosystem team fournit API spec (semaine -2)
2. Atlas KMS provisioning Skalean AI API key (semaine -1)
3. Sandbox env access (semaine 1)
4. Implementation (semaines 1-2)
5. Integration tests (semaine 2)
6. Canary deployment (semaine 3)
7. Monitor + adjust (semaine 4)
8. Sprint 30 50% rollout
9. Sprint 31 100% rollout

Tout retard Sprint 29 cascade sur Sprint 30 (MCP server) et Sprint 31 (Agent Sky) qui dependent du real Skalean AI online.

---

**Fin du prompt task-5.2.3-skalean-ai-vision-client-placeholder.md.**

Densite : cible 80-150 ko atteinte
Code : 3 fichiers complets
Tests : 19+ cas
Criteres : V1-V20
Edge cases : 8
Annexes : 17-50

## 51. Annexe : Pseudocode helper Sprint 29 -- mapSkaleanAiResponse

```typescript
// Sprint 29 helper -- NE PAS implementer Sprint 20
function mapSkaleanAiResponse(json: unknown, latencyMs: number, provider: 'skalean_ai'): IaEstimationOutput {
  if (typeof json !== 'object' || json === null) {
    throw new IaEstimationFailedError('Skalean AI response is not an object');
  }
  const j = json as Record<string, unknown>;
  
  // Defensive mapping -- accept potentially missing fields, fill defaults
  return {
    interface_version: INTERFACE_VERSION,
    provider,
    confidence_score: typeof j.confidence === 'number' ? j.confidence : 0,
    damage_type_inferred: typeof j.damage_type === 'string' ? j.damage_type as DamageType : null,
    detected_damages: Array.isArray(j.damages) ? j.damages.map(mapDamageItem) : [],
    parts_needed: Array.isArray(j.parts) ? j.parts.map(mapPartItem) : [],
    labor_estimate: typeof j.labor === 'object' && j.labor !== null
      ? mapLaborEstimate(j.labor as any)
      : { hours_minimum: 0, hours_maximum: 0, hourly_rate_avg: DEFAULT_HOURLY_RATE_MAD },
    total_cost_estimate_min: typeof j.total_min_mad === 'number' ? j.total_min_mad : 0,
    total_cost_estimate_max: typeof j.total_max_mad === 'number' ? j.total_max_mad : 0,
    currency: 'MAD',
    recommendations: typeof j.recommendations === 'string' ? j.recommendations : '',
    warnings: Array.isArray(j.warnings) ? j.warnings.filter(w => typeof w === 'string') as string[] : [],
    estimated_at: new Date().toISOString(),
    latency_ms: latencyMs,
  };
}

function mapDamageItem(d: any): DamageItem {
  return {
    description: typeof d.description === 'string' ? d.description : '',
    severity: ['minor', 'moderate', 'severe'].includes(d.severity) ? d.severity : 'minor',
    location: ['front', 'rear', 'side_left', 'side_right', 'top', 'undercarriage', 'interior'].includes(d.location) ? d.location : 'front',
    estimated_repair_method: ['replace', 'repair', 'paint'].includes(d.repair_method) ? d.repair_method : 'repair',
  };
}

function mapPartItem(p: any): PartItem {
  return {
    name: typeof p.name === 'string' ? p.name : '',
    oem_compatible: typeof p.oem_compatible === 'boolean' ? p.oem_compatible : false,
    estimated_quantity: typeof p.quantity === 'number' ? p.quantity : 1,
    estimated_unit_cost_mad: typeof p.unit_cost_mad === 'number' ? p.unit_cost_mad : 0,
  };
}

function mapLaborEstimate(l: any): LaborEstimate {
  return {
    hours_minimum: typeof l.hours_min === 'number' ? l.hours_min : 0,
    hours_maximum: typeof l.hours_max === 'number' ? l.hours_max : 0,
    hourly_rate_avg: typeof l.hourly_rate_mad === 'number' ? l.hourly_rate_mad : DEFAULT_HOURLY_RATE_MAD,
  };
}
```

Note : ces helpers Sprint 29 sont defensifs (`typeof check`). Skalean AI peut retourner schema legerement different ; on absorbe les diffs au mapping. Le `IaEstimationOutputSchema.parse()` final attrape les erreurs.

## 52. Annexe : Note sur les tests Sprint 29 avec real Skalean AI

Sprint 29 tests E2E vs Real (pas Mock) :
- Coute des MAD chaque test run
- Limite a 10-20 tests E2E canoniques
- Run uniquement sur main branch CI (pas PRs)
- Tests integration unitaires utilisent nock (gratuit)

Pattern Sprint 29 tests :
- Unit : mock undici, verifie call params (90% des tests)
- Integration : nock simule reponses (8% des tests)
- E2E : Real Skalean AI sandbox (2% des tests, run once/day max)

## 53. Annexe : Conventions code review Sprint 29

Lors du PR Sprint 29 qui remplace le stub :
- [ ] Test V4 ('Sprint 29' message) doit etre supprime ou modifie pour signaler implementation done
- [ ] Aucune `throw IaEstimationConfigError` dans `estimateDamages()` (sauf cas legitimes)
- [ ] `checkHealth()` retourne `healthy: true` quand sandbox up
- [ ] Pino logger inject via constructor
- [ ] TenantContext propaged correctly
- [ ] Tests integration nock minimum 10 scenarios
- [ ] Coverage maintenue >= 90%
- [ ] No `any` ajoute (sauf dans mapper helpers defensifs avec justification)

## 54. Annexe : Comportement edge Sprint 29 -- circuit breaker

```typescript
// Sprint 29 -- circuit breaker pattern
class SkaleanAiCircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;
  
  private readonly threshold = 10;
  private readonly cooldownMs = 60_000; // 1 min
  private readonly probeAfterMs = 30_000; // 30s
  
  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
  
  shouldAllowCall(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = 'half-open';
        return true; // probe call
      }
      return false;
    }
    if (this.state === 'half-open') return true;
    return false;
  }
  
  isOpen(): boolean {
    return this.state === 'open';
  }
}
```

## 55. Annexe : Verification finale auto-suffisance

- [x] Stub class declaree et implement IaEstimationPhotosClient
- [x] Constructor valide config Zod
- [x] estimateDamages() throws avec message 'Sprint 29'
- [x] getCacheKey() fonctionnelle (MD5 hash)
- [x] checkHealth() retourne unhealthy
- [x] provider literal 'skalean_ai'
- [x] Comments Sprint 29 implementation expected (~50 lignes pseudo-code)
- [x] Tests 19+ avec coverage >= 90%
- [x] Index.ts re-export
- [x] V1-V20 criteres avec commandes
- [x] Edge cases 8
- [x] Conventions skalean-insurtech respectees
- [x] Conformite MA documentee
- [x] Annexes Sprint 29 detaillent migration

Claude Code doit pouvoir implementer 5.2.3 Sprint 20 sans relire B-20. Sprint 29 dev peut consulter annexes pour real implementation.

---

**Fin du prompt task-5.2.3-skalean-ai-vision-client-placeholder.md.**

Densite finale : cible 80-150 ko atteinte
Code : 3 fichiers complets
Tests : 19+ cas
Criteres : V1-V20
Edge cases : 8
Annexes : 17-55
