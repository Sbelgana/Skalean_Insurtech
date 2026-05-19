# TACHE 5.2.2 -- MockIaEstimationClient Implementation Deterministe

**Sprint** : 20 (Phase 5 / Sprint 2 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-20-sprint-20-ia-estimation-photos.md` (Tache 5.2.2)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (bloquant pour 5.2.3, 5.2.4, 5.2.5, 5.2.8, 5.2.12)
**Effort** : 7h
**Dependances** : 5.2.1 (Interface + Types Zod) terminee et commitee
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache 5.2.2 implemente la premiere implementation de l'interface `IaEstimationPhotosClient` definie a la tache 5.2.1. Le `MockIaEstimationClient` est l'implementation deterministe utilisee pendant les Sprint 20 a 28 (decision-007 AI-defere). Son role critique est de retourner des outputs realistes et structures permettant tous les flows downstream (Sprint 21 Sinistre Workflow, Sprint 22 Web Garage UI, Sprint 23 Web Garage Mobile, Sprint 24 Flux Sinistre Client, Sprint 13 ETL Analytics) de fonctionner sans dependance sur Skalean AI Vision API reel (qui sera connecte Sprint 29 par swap DI).

Le but est triple. Premierement, fournir un mock **deterministe** : meme input produit toujours meme output, ce qui est essentiel pour les tests reproductibles (unit, integration, E2E) et pour les fixtures partagees Sprint 22 web-garage et Sprint 23 mobile. Le determinisme est obtenu via un seed pseudo-aleatoire calcule par hash MD5 sur `(photos triees + vehicle_data)`. Deuxiemement, generer des outputs **realistes au contexte Maroc** : prix pieces en MAD selon barème ANELEC 2025, taux horaire moyen garage 350 MAD, marques courantes (Dacia, Renault, Peugeot, Hyundai, Toyota), damage types frequents au pilote Marrakech (front_collision, broken_glass, side_damage en premier). Troisiemement, simuler une **latence reseau** entre 1000-3000ms pour que les tests downstream rencontrent les memes timing constraints qu'avec le real Sprint 29 (qui aura latence 5000-30000ms reels, mais l'ordre de grandeur permet de detecter les races conditions).

A l'issue de cette tache, le repo dispose de `repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts` (le mock complet ~400 lignes), `damage-patterns.data.ts` (les templates de damage par type, ~250 lignes), `pricing-rules.ts` (ajustements prix par marque/modele/annee, ~150 lignes), `mock-clock.ts` (clock injectable pour tests reproductibles, ~50 lignes), et 4 fichiers de tests (~600 lignes total). Le mock implemente strictement l'interface 5.2.1 sans devier du contract output schema (`IaEstimationOutputSchema` validation defensive interne).

## 2. Contexte etendu

### 2.1 Pourquoi un mock deterministe et pas random pur

Un mock random pur (`Math.random()` libre) pose 4 problemes critiques :

**Probleme 1 : Tests flaky**. Un test `expect(estimation.total_cost).toBeGreaterThan(5000)` peut passer 99% du temps et fail 1% (quand random produit valeur basse). Le determinisme garantit que CI green = code correct.

**Probleme 2 : Reproduction bugs impossible**. Si production Sprint 20 (pendant mock period) revele un bug avec une estimation specifique, sans seed reproductible, l'equipe ne peut pas reproduire localement.

**Probleme 3 : Tests snapshot impossibles**. Vitest `toMatchSnapshot()` requiert outputs constants. Sans seed, chaque run produit fichiers snapshot differents.

**Probleme 4 : Cache Redis poisoning fictif**. Le cache (Tache 5.2.8) suppose qu'un meme cache key produit meme output. Random pur viole cette invariant, faisant l'effet pendant tests E2E que le cache "ne marche pas".

La solution est un seed pseudo-aleatoire deriv des inputs : `seed = hash(photos triees + vehicle_data + incident_circumstances)`. Avec une fonction hash deterministe (MD5 ou SHA-256), meme input -> meme seed -> meme sequence de "random" values via un generateur seedable (e.g., LCG, xorshift32, ou Math.random remplace par fonction custom).

### 2.2 Choix du generateur pseudo-aleatoire

| Generateur | Avantages | Inconvenients | Decision |
|------------|-----------|---------------|----------|
| **MD5 hash + slicing (RETENU)** | Standard Node crypto natif, deterministe, distribution uniforme, pas de dependance externe | Pas cryptographiquement secure (mais ce n'est pas l'objectif) | RETENU pour simplicite et zero-dep |
| `Math.random()` libre | Le plus simple | Non-deterministe | REJETE (cf 2.1) |
| `seedrandom` package npm | Genere pretty random | Dependance externe additionnelle | REJETE (zero-dep preferable) |
| LCG / xorshift32 custom | Tres rapide | Reinvente la roue | REJETE |
| `crypto.randomInt(min, max)` Node | Standard, secure | Non-seedable (CSRNG) | REJETE |

Pattern retenu :
```typescript
const seed = crypto.createHash('md5').update(JSON.stringify({photos: photos.sort(), vehicle})).digest('hex');
const seedNum = parseInt(seed.substring(0, 8), 16);
// Use seedNum + ad-hoc operations (modulo, division) for pseudo-random values
```

### 2.3 Alternatives considerees pour la generation des damage patterns

| Strategie | Avantages | Inconvenients | Decision |
|-----------|-----------|---------------|----------|
| **Templates fixes par damage_type (RETENU)** | Simple, realiste, evolutif | Rigide, ne reproduit pas la diversite reelle | RETENU pour mock predictible |
| Generation LLM cote mock (e.g., embed petit modele Claude) | Plus diversifie | Defere precisement ce qu'on veut eviter (decision-007) | REJETE |
| Database fixtures pre-construites (~1000 cas) | Tres realiste | Maintenance lourde, repository grossit | REJETE pour Sprint 20 |
| Generation aleatoire pure | Diversite garantie | Pas determinist, pas realiste | REJETE |

Templates fixes signifient : pour chaque `DamageType` (front_collision, rear_collision, side_damage, broken_glass, theft, flood, fire, vandalism), un template `DamagePattern` contient liste damages + liste parts + range labor. Le seed seedNum est utilise pour des micro-variations (small price adjustments, randomization parmi 2-3 variants par template).

### 2.4 Sources de prix MA utilisees

Les `base_price_mad` proviennent de l'enquete interne Skalean Garage pilote Marrakech 2025 + barème ANELEC public :

| Piece | Range MA 2025 | Mock value |
|-------|---------------|------------|
| Pare-chocs avant (Dacia Logan) | 1500-3500 | 2500 |
| Pare-chocs arriere (Dacia Logan) | 1200-2800 | 2000 |
| Capot (Dacia Logan) | 2000-5000 | 3500 |
| Phare droit/gauche | 800-1800 | 1200 |
| Feu arriere | 400-900 | 650 |
| Pare-brise | 800-2500 | 1500 |
| Vitre laterale | 400-1200 | 700 |
| Aile avant | 1000-2500 | 1800 |
| Porte complete | 2500-6000 | 4000 |
| Retroviseur | 300-700 | 500 |
| Pneu standard | 600-1500 | 1000 |
| Plaquettes frein | 300-700 | 500 |
| Peinture pare-chocs | 600-1200 | 800 |
| Peinture aile | 800-1500 | 1100 |
| Peinture porte | 1200-2200 | 1700 |

Adjustments par marque (multiplicateurs) :
- Dacia : 1.0 (baseline)
- Renault : 1.1
- Peugeot : 1.15
- Hyundai : 1.05
- Toyota : 1.20
- BMW / Mercedes : 1.80
- Tesla : 2.50

### 2.5 Decisions strategiques referenced

- **decision-007 (AI-defere)** : raison d'etre fondamentale du mock
- **decision-008 (data residency MA)** : prix MAD, hourly_rate baseline 350 MAD ANELEC, locales fr-MA/ar-MA prioritaires
- **decision-006 (no-emoji)** : aucune emoji dans le code, comments, fixtures
- **decision-001 (monorepo)** : implementation dans `packages/repair/`

### 2.6 Pieges techniques connus

1. **Piege : `Math.random()` accidentel dans le mock**
   - Pourquoi : developpeur peut oublier la regle et appeler `Math.random()` directement
   - Solution : Biome rule + grep pre-commit `grep "Math.random" mock-ia-estimation.client.ts` -> FAIL CI

2. **Piege : hash collision sur photos triees identiques mais vehicle different**
   - Pourquoi : si hash ne couvre que photos, deux vehicules differents avec memes photos produisent meme seed
   - Solution : hash inclut `photos.sort()` ET `vehicle_data` complet ET `incident_circumstances`

3. **Piege : `Date.now()` non-injectable**
   - Pourquoi : `estimated_at` doit varier en prod mais etre fix en test
   - Solution : `MockClock` injectable via constructor, default `() => new Date()`

4. **Piege : latency simulation bloquante UI**
   - Pourquoi : si appele depuis un thread synchrone, 1-3s gel l'UI
   - Solution : mock est `async`, utilise `setTimeout` Promise

5. **Piege : detection damage_type via filename trop strict**
   - Pourquoi : URL S3 hash signed peut ne pas contenir "front_collision" textuel
   - Solution : fallback sur seed-based si aucun hint detecte (cf damage-types.ts FILENAME_HINTS)

6. **Piege : prix negatifs ou zero apres adjustments**
   - Pourquoi : multiplicateur negatif accidentel ou base_price = 0
   - Solution : `Math.max(MIN_PART_PRICE_MAD, adjusted)` clamp

7. **Piege : confidence_score arrondi flottant > 1**
   - Pourquoi : `0.95 + 0.001 * seed_variation` peut produire 0.951 puis 1.001
   - Solution : `Math.min(0.95, Math.max(0.85, computed))` clamp + `Math.round(x * 100) / 100`

8. **Piege : labor_hours.min > max**
   - Pourquoi : template definit min=2 max=4, seed ajoute variation max-=3 -> 2 > 1
   - Solution : sort apres adjustments `if (min > max) [min, max] = [max, min]`

9. **Piege : memes photos shuffled produisent seeds differents**
   - Pourquoi : `JSON.stringify({photos: ['a', 'b']})` !== `JSON.stringify({photos: ['b', 'a']})`
   - Solution : `photos.sort()` AVANT hash

10. **Piege : output schema validation echoue silencieusement**
    - Pourquoi : `IaEstimationOutputSchema.safeParse(output)` ignore par mock
    - Solution : utiliser `.parse()` (throws ZodError) pour fail fast en dev/test

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 5.2.2 est la 2eme du Sprint 20. Elle depend de 5.2.1 (interface stable). Elle bloque :
- 5.2.3 (SkaleanAiVisionClient placeholder) : compare implementations
- 5.2.4 (DI Module) : choisit entre Mock et Real selon env
- 5.2.5 (auto-trigger) : appelle Mock via DI
- 5.2.8 (cache) : decore Mock avec cache layer
- 5.2.12 (tests E2E) : utilise Mock pour 25+ scenarios

### 3.2 Diagramme flow Mock

```
[Input: photos[] + vehicle_data + circumstances]
       |
       | 1. Validate input (defense en profondeur)
       v
[IaEstimationInputSchema.parse(input)]
       |
       | 2. Compute deterministic seed
       v
[crypto.md5(photos.sort() + vehicle + circumstances)]
       |
       | 3. Simulate latency 1-3s
       v
[setTimeout(seed % 2000 + 1000)]
       |
       | 4. Infer damage_type from filename OR seed
       v
[inferDamageTypeFromFilename() OR seed-based fallback]
       |
       | 5. Select damage pattern template
       v
[DAMAGE_PATTERNS[damage_type]]
       |
       | 6. Adjust prices for vehicle + seed variations
       v
[adjustPriceForVehicle() + clamp]
       |
       | 7. Compute total_cost = parts + labor
       v
[computePartsTotal() + labor_hours * hourly_rate]
       |
       | 8. Add warnings if confidence < 0.90
       v
[Conditional warnings array]
       |
       | 9. Build IaEstimationOutput object
       v
[Output object construction]
       |
       | 10. Validate output (defense en profondeur)
       v
[IaEstimationOutputSchema.parse(output)]
       |
       v
[Return validated output]
```

## 4. Livrables checkables

- [ ] Fichier `repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts` (~400 lignes) : classe `MockIaEstimationClient implements IaEstimationPhotosClient`
- [ ] Fichier `repo/packages/repair/src/ia-estimation/damage-patterns.data.ts` (~250 lignes) : 8 templates `DamagePattern` (one par damage_type)
- [ ] Fichier `repo/packages/repair/src/ia-estimation/pricing-rules.ts` (~150 lignes) : `BRAND_MULTIPLIERS`, `YEAR_DEPRECIATION`, helpers `adjustPriceForVehicle()`
- [ ] Fichier `repo/packages/repair/src/ia-estimation/mock-clock.ts` (~50 lignes) : `MockClock` injectable interface + default impl
- [ ] Fichier `repo/packages/repair/src/ia-estimation/seed.ts` (~80 lignes) : helpers `computeSeed()`, `seedRandom()`, `seedChoice()`, `seedFloat()`, `seedInt()`
- [ ] Fichier `repo/packages/repair/src/ia-estimation/recommendations.ts` (~120 lignes) : templates recommandations textuelles par damage_type x locale (4 locales)
- [ ] Fichier `repo/packages/repair/src/ia-estimation/__tests__/mock-ia-estimation.client.spec.ts` (~350 lignes) : 20+ tests unit
- [ ] Fichier `repo/packages/repair/src/ia-estimation/__tests__/damage-patterns.spec.ts` (~150 lignes) : 8+ tests
- [ ] Fichier `repo/packages/repair/src/ia-estimation/__tests__/pricing-rules.spec.ts` (~120 lignes) : 10+ tests
- [ ] Fichier `repo/packages/repair/src/ia-estimation/__tests__/seed.spec.ts` (~100 lignes) : 8+ tests (determinisme, distribution)
- [ ] Update `repo/packages/repair/src/ia-estimation/index.ts` : re-export `MockIaEstimationClient`
- [ ] Update `repo/packages/repair/package.json` : verifier `crypto` (natif Node, pas de dep)
- [ ] Tests verifient : meme input -> meme output (determinisme strict)
- [ ] Tests verifient : output respecte `IaEstimationOutputSchema` (defense en profondeur)
- [ ] Tests verifient : 8 damage_types supportes
- [ ] Tests verifient : latency simulee 1000-3000ms
- [ ] Tests verifient : edge cases (0 photos throws, 12 photos OK, marque inconnue fallback)
- [ ] Pre-commit hooks passent : typecheck, lint, vitest, no-emoji, no-console
- [ ] Coverage >= 90%

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts                 (~400 lignes / classe Mock principale)
repo/packages/repair/src/ia-estimation/damage-patterns.data.ts                       (~250 lignes / 8 templates DamagePattern)
repo/packages/repair/src/ia-estimation/pricing-rules.ts                              (~150 lignes / multiplicateurs marques + helpers)
repo/packages/repair/src/ia-estimation/mock-clock.ts                                  (~50 lignes  / clock injectable)
repo/packages/repair/src/ia-estimation/seed.ts                                        (~80 lignes  / pseudo-random helpers)
repo/packages/repair/src/ia-estimation/recommendations.ts                              (~120 lignes / templates texte par locale)
repo/packages/repair/src/ia-estimation/__tests__/mock-ia-estimation.client.spec.ts    (~350 lignes / 20+ tests)
repo/packages/repair/src/ia-estimation/__tests__/damage-patterns.spec.ts              (~150 lignes / 8+ tests)
repo/packages/repair/src/ia-estimation/__tests__/pricing-rules.spec.ts                (~120 lignes / 10+ tests)
repo/packages/repair/src/ia-estimation/__tests__/seed.spec.ts                          (~100 lignes / 8+ tests)
repo/packages/repair/src/ia-estimation/index.ts                                       (modif: ajouter MockIaEstimationClient)
```

Total : 10 fichiers crees + 1 modifie = **11 fichiers**, environ **1770 lignes** code + tests.

## 6. Code patterns COMPLETS

### Fichier 1/10 : `repo/packages/repair/src/ia-estimation/seed.ts`

```typescript
import { createHash } from 'node:crypto';
import type { IaEstimationInput } from './types';

/**
 * Pseudo-random utilities driven by deterministic seed.
 *
 * Sprint 20 Tache 5.2.2 -- MockIaEstimationClient determinisme.
 *
 * The mock client uses MD5 hash of (sorted photos + vehicle_data + circumstances)
 * to compute a 32-bit seed. This seed drives all "random" choices in the mock
 * via the helpers in this file.
 *
 * NOT cryptographically secure (MD5 is not collision-resistant for adversarial inputs),
 * but acceptable for mock purposes (no security boundary).
 */

/**
 * Compute deterministic seed from IaEstimationInput.
 * Same input -> same 32-bit seed.
 */
export function computeSeed(input: IaEstimationInput): number {
  const canonical = JSON.stringify({
    photos: [...input.photos].sort(),
    vehicle: input.vehicle_data,
    circumstances: input.incident_circumstances ?? '',
    locale: input.locale ?? 'fr-MA',
  });
  const hash = createHash('md5').update(canonical).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
}

/**
 * Derive next seed from current seed (LCG-style).
 * Used to advance the "pseudo-random sequence" without re-hashing.
 */
export function nextSeed(seed: number): number {
  // Linear Congruential Generator constants (Numerical Recipes)
  return (seed * 1664525 + 1013904223) % 4294967296;
}

/**
 * Generate float in [0, 1) from seed.
 */
export function seedFloat(seed: number): number {
  return (seed % 1000000) / 1000000;
}

/**
 * Generate integer in [min, max] inclusive from seed.
 */
export function seedInt(seed: number, min: number, max: number): number {
  if (min > max) throw new Error('seedInt: min > max');
  const range = max - min + 1;
  return min + (seed % range);
}

/**
 * Pick one element from array based on seed.
 */
export function seedChoice<T>(seed: number, choices: readonly T[]): T {
  if (choices.length === 0) throw new Error('seedChoice: empty array');
  return choices[seed % choices.length] as T;
}

/**
 * Generate float in [min, max) from seed.
 */
export function seedFloatRange(seed: number, min: number, max: number): number {
  if (min > max) throw new Error('seedFloatRange: min > max');
  return min + seedFloat(seed) * (max - min);
}
```

### Fichier 2/10 : `repo/packages/repair/src/ia-estimation/mock-clock.ts`

```typescript
/**
 * MockClock -- injectable time source for deterministic tests.
 *
 * Sprint 20 Tache 5.2.2.
 *
 * Production: default impl returns new Date() and real setTimeout.
 * Tests: inject custom clock with fixed dates and instant sleeps.
 */

export interface MockClock {
  now(): Date;
  sleep(ms: number): Promise<void>;
}

export const defaultClock: MockClock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
};

export function createFixedClock(fixedDate: Date): MockClock {
  return {
    now: () => fixedDate,
    sleep: () => Promise.resolve(),
  };
}

export function createInstantClock(): MockClock {
  return {
    now: () => new Date('2026-05-19T10:00:00.000+01:00'),
    sleep: () => Promise.resolve(),
  };
}
```

### Fichier 3/10 : `repo/packages/repair/src/ia-estimation/pricing-rules.ts`

```typescript
import type { VehicleData } from './types';
import { DEFAULT_HOURLY_RATE_MAD } from './constants';
import { seedFloatRange, nextSeed } from './seed';

/**
 * Pricing rules for Mock IA estimation.
 *
 * Sources:
 * - ANELEC barème public 2025
 * - Skalean Garage pilote Marrakech 2025 internal survey
 *
 * Sprint 29 Real: Skalean AI Vision uses its own pricing engine (per-tenant).
 */

export const MIN_PART_PRICE_MAD = 50;
export const MAX_PART_PRICE_MAD = 1_000_000;

/**
 * Brand multipliers applied to base prices.
 * Dacia is the baseline (1.0). Luxury brands are more expensive.
 */
export const BRAND_MULTIPLIERS: Record<string, number> = {
  dacia: 1.0,
  renault: 1.1,
  peugeot: 1.15,
  citroen: 1.15,
  hyundai: 1.05,
  kia: 1.05,
  toyota: 1.20,
  honda: 1.20,
  nissan: 1.20,
  ford: 1.25,
  fiat: 1.10,
  seat: 1.15,
  skoda: 1.20,
  volkswagen: 1.45,
  audi: 1.65,
  bmw: 1.80,
  mercedes: 1.80,
  'mercedes-benz': 1.80,
  porsche: 2.20,
  tesla: 2.50,
  jaguar: 2.10,
  landrover: 2.20,
  'land rover': 2.20,
  volvo: 1.55,
  lexus: 1.85,
};

export const DEFAULT_BRAND_MULTIPLIER = 1.30;

/**
 * Year depreciation factor: older cars have cheaper non-OEM parts available.
 * Returns multiplier 0.85-1.0 based on age in years.
 */
export function yearDepreciationFactor(year: number): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  if (age <= 0) return 1.0;
  if (age <= 3) return 1.0;
  if (age <= 7) return 0.95;
  if (age <= 12) return 0.90;
  return 0.85;
}

/**
 * Category surcharge (SUV/Truck have heavier parts).
 */
export const CATEGORY_MULTIPLIERS: Record<VehicleData['category'], number> = {
  sedan: 1.0,
  suv: 1.15,
  pickup: 1.20,
  van: 1.10,
  minibus: 1.10,
  truck: 1.35,
  motorcycle: 0.55,
  other: 1.0,
};

/**
 * Adjust a base part price for a given vehicle.
 * Returns price in MAD (rounded to nearest 10 MAD).
 */
export function adjustPriceForVehicle(
  basePrice: number,
  vehicle: VehicleData,
  seed: number,
): number {
  const brandKey = vehicle.brand.toLowerCase().trim();
  const brandMult = BRAND_MULTIPLIERS[brandKey] ?? DEFAULT_BRAND_MULTIPLIER;
  const categoryMult = CATEGORY_MULTIPLIERS[vehicle.category];
  const yearFactor = yearDepreciationFactor(vehicle.year);
  // Seed-based variation: +/- 10%
  const variation = seedFloatRange(seed, 0.9, 1.1);
  const adjusted = basePrice * brandMult * categoryMult * yearFactor * variation;
  const clamped = Math.max(MIN_PART_PRICE_MAD, Math.min(MAX_PART_PRICE_MAD, adjusted));
  return Math.round(clamped / 10) * 10;
}

/**
 * Determine hourly rate for labor. Sprint 20: constant DEFAULT_HOURLY_RATE_MAD.
 * Sprint 29: per-tenant rates from garage profile.
 */
export function getHourlyRate(vehicle: VehicleData, _tenant?: string): number {
  // Luxury brands often have specialized labor (higher rate)
  const brandKey = vehicle.brand.toLowerCase().trim();
  const luxuryBrands = ['bmw', 'mercedes', 'mercedes-benz', 'audi', 'porsche', 'tesla', 'jaguar'];
  if (luxuryBrands.includes(brandKey)) return DEFAULT_HOURLY_RATE_MAD * 1.5;
  return DEFAULT_HOURLY_RATE_MAD;
}
```

### Fichier 4/10 : `repo/packages/repair/src/ia-estimation/recommendations.ts`

```typescript
import type { DamageType } from './damage-types';

/**
 * Localized recommendation templates per damage_type and locale.
 * Used by Mock client to populate `recommendations` field.
 */

type Locale = 'fr-MA' | 'ar-MA' | 'en' | 'es';

export const RECOMMENDATION_TEMPLATES: Record<DamageType, Record<Locale, string>> = {
  front_collision: {
    'fr-MA': 'Pieces OEM recommandees pour pare-chocs et capot. Peinture aftermarket acceptable. Verifier alignement radiateur et systeme refroidissement avant remise en route.',
    'ar-MA': 'يُنصح بقطع غيار أصلية للصدام الأمامي والغطاء. طلاء غير أصلي مقبول. تحقق من محاذاة الرادياتير ونظام التبريد قبل إعادة التشغيل.',
    en: 'OEM parts recommended for front bumper and hood. Aftermarket paint acceptable. Verify radiator alignment and cooling system before restart.',
    es: 'Se recomiendan piezas OEM para el parachoques delantero y el capo. Pintura aftermarket aceptable. Verifique la alineacion del radiador y el sistema de refrigeracion antes del reinicio.',
  },
  rear_collision: {
    'fr-MA': 'Verifier integrite du coffre et des feux arriere. Pieces aftermarket acceptables si garantie 2 ans. Test waterproof apres remise en place.',
    'ar-MA': 'تحقق من سلامة الصندوق والأضواء الخلفية. قطع غير أصلية مقبولة بضمان سنتين. اختبار العزل المائي بعد التركيب.',
    en: 'Verify trunk integrity and rear lights. Aftermarket parts acceptable if 2-year warranty. Waterproof test after reinstall.',
    es: 'Verifique la integridad del maletero y las luces traseras. Piezas aftermarket aceptables con garantia de 2 anos. Prueba de impermeabilidad despues de la reinstalacion.',
  },
  side_damage: {
    'fr-MA': 'Verifier mecanisme de porte et serrure. Si retroviseur electrique, tester connexions. Peinture en cabine pour finition uniforme.',
    'ar-MA': 'تحقق من آلية الباب والقفل. إذا كانت المرآة كهربائية، اختبر التوصيلات. الطلاء في الكابينة للحصول على لمسة نهائية موحدة.',
    en: 'Verify door mechanism and lock. If electric mirror, test connections. Paint in cabin for uniform finish.',
    es: 'Verifique el mecanismo de la puerta y la cerradura. Si el espejo es electrico, pruebe las conexiones. Pintura en cabina para acabado uniforme.',
  },
  broken_glass: {
    'fr-MA': 'Pare-brise feuillete obligatoire (norme MA NM 03.1.002). Detection capteurs (ADAS si present) a recalibrer. Joint etancheite a remplacer si > 5 ans.',
    'ar-MA': 'الزجاج الأمامي المُغلَّف إلزامي (معيار MA NM 03.1.002). معايرة مستشعرات الكشف (ADAS إن وجدت). استبدل حشية العزل إذا كانت أقدم من 5 سنوات.',
    en: 'Laminated windshield mandatory (MA NM 03.1.002 standard). ADAS sensors (if present) require recalibration. Replace weatherstripping if >5 years old.',
    es: 'Parabrisas laminado obligatorio (norma MA NM 03.1.002). Sensores ADAS (si presentes) requieren recalibracion. Reemplace la junta si es >5 anos.',
  },
  theft: {
    'fr-MA': 'Inventaire detaille requis. Photos avant/apres obligatoires. Coordination avec autorites + assurance pour declaration. Refonte centrale serrurerie si effractions.',
    'ar-MA': 'مطلوب جرد مفصل. صور قبل/بعد إلزامية. التنسيق مع السلطات والتأمين للإعلان. إعادة تشكيل القفل المركزي في حالة الاقتحام.',
    en: 'Detailed inventory required. Before/after photos mandatory. Coordinate with authorities and insurance for declaration. Central lock rework if break-in.',
    es: 'Se requiere inventario detallado. Fotos antes/despues obligatorias. Coordine con autoridades y aseguradora para la declaracion. Rework de cerradura central si hubo allanamiento.',
  },
  flood: {
    'fr-MA': 'Demontage interieur complet. Sechage 72h minimum. Test circuit electrique. Remplacement tapis et garnitures imbibees. Verifier corrosion mecanique apres 1 mois.',
    'ar-MA': 'تفكيك داخلي كامل. تجفيف 72 ساعة على الأقل. اختبار الدائرة الكهربائية. استبدل السجاد والتنجيد المبلل. تحقق من تآكل الميكانيكا بعد شهر.',
    en: 'Full interior disassembly. 72h minimum drying. Test electrical circuits. Replace soaked carpets and trim. Check mechanical corrosion after 1 month.',
    es: 'Desmontaje interior completo. Secado minimo 72h. Test de circuito electrico. Reemplazo de alfombras y tapizado empapados. Verificar corrosion mecanica despues de 1 mes.',
  },
  fire: {
    'fr-MA': 'Evaluation structure carrosserie obligatoire avant reparation. Si chassis affecte, vehicule a declarer en perte totale. Refonte circuit electrique si feu moteur.',
    'ar-MA': 'تقييم هيكل الجسم إلزامي قبل الإصلاح. إذا تأثر الشاسيه، يجب الإعلان عن خسارة كاملة. إعادة تشكيل الدائرة الكهربائية في حالة حريق المحرك.',
    en: 'Body structure assessment mandatory before repair. If chassis affected, declare total loss. Electrical circuit rework if engine fire.',
    es: 'Evaluacion estructural obligatoria antes de reparar. Si el chasis esta afectado, declarar perdida total. Rework del circuito electrico si incendio de motor.',
  },
  vandalism: {
    'fr-MA': 'Photos detaillees pour assurance. Si rayures profondes carrosserie, ponçage + peinture en cabine. Verifier serrures et antenne.',
    'ar-MA': 'صور مفصلة للتأمين. في حالة الخدوش العميقة، صنفرة وطلاء في الكابينة. تحقق من الأقفال والهوائي.',
    en: 'Detailed photos for insurance. If deep body scratches, sanding + cabin paint. Verify locks and antenna.',
    es: 'Fotos detalladas para el seguro. Si arañazos profundos en carroceria, lijado + pintura en cabina. Verifique cerraduras y antena.',
  },
};

export function getRecommendation(damageType: DamageType, locale: Locale = 'fr-MA'): string {
  return RECOMMENDATION_TEMPLATES[damageType]?.[locale] ?? RECOMMENDATION_TEMPLATES[damageType]['fr-MA'];
}
```

### Fichier 5/10 : `repo/packages/repair/src/ia-estimation/damage-patterns.data.ts`

```typescript
import type { DamageType } from './damage-types';
import type { DamageItem, PartItem } from './types';

/**
 * Damage patterns templates per DamageType.
 *
 * Each template defines:
 * - damages: list of DamageItem describing the typical damages
 * - parts: list of PartItem with BASE prices (before vehicle adjustment)
 * - labor_min/max: labor hours range
 *
 * Sprint 20 Tache 5.2.2 -- MockIaEstimationClient data foundation.
 * Sprint 29 Real: Skalean AI Vision infers these dynamically from photos.
 */

export interface DamagePatternPartBase {
  name: string;
  oem_compatible: boolean;
  estimated_quantity: number;
  base_price_mad: number;
}

export interface DamagePattern {
  damages: DamageItem[];
  parts: DamagePatternPartBase[];
  labor_min: number;
  labor_max: number;
}

export const DAMAGE_PATTERNS: Record<DamageType, DamagePattern> = {
  front_collision: {
    damages: [
      { description: 'Pare-chocs avant deforme', severity: 'moderate', location: 'front', estimated_repair_method: 'replace' },
      { description: 'Capot legerement enfonce', severity: 'minor', location: 'front', estimated_repair_method: 'repair' },
      { description: 'Phare droit casse', severity: 'minor', location: 'front', estimated_repair_method: 'replace' },
      { description: 'Calandre fissuree', severity: 'minor', location: 'front', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Pare-chocs avant', oem_compatible: true, estimated_quantity: 1, base_price_mad: 2500 },
      { name: 'Phare droit', oem_compatible: false, estimated_quantity: 1, base_price_mad: 1200 },
      { name: 'Calandre avant', oem_compatible: true, estimated_quantity: 1, base_price_mad: 600 },
      { name: 'Peinture pare-chocs', oem_compatible: false, estimated_quantity: 1, base_price_mad: 800 },
    ],
    labor_min: 6,
    labor_max: 12,
  },
  rear_collision: {
    damages: [
      { description: 'Pare-chocs arriere enfonce', severity: 'moderate', location: 'rear', estimated_repair_method: 'replace' },
      { description: 'Coffre legerement deforme', severity: 'minor', location: 'rear', estimated_repair_method: 'repair' },
      { description: 'Feu arriere casse', severity: 'minor', location: 'rear', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Pare-chocs arriere', oem_compatible: true, estimated_quantity: 1, base_price_mad: 2000 },
      { name: 'Feu arriere droit', oem_compatible: false, estimated_quantity: 1, base_price_mad: 650 },
      { name: 'Peinture pare-chocs', oem_compatible: false, estimated_quantity: 1, base_price_mad: 800 },
    ],
    labor_min: 4,
    labor_max: 10,
  },
  side_damage: {
    damages: [
      { description: 'Porte conducteur enfoncee', severity: 'moderate', location: 'side_left', estimated_repair_method: 'repair' },
      { description: 'Retroviseur gauche casse', severity: 'minor', location: 'side_left', estimated_repair_method: 'replace' },
      { description: 'Aile avant gauche raye', severity: 'minor', location: 'side_left', estimated_repair_method: 'paint' },
    ],
    parts: [
      { name: 'Retroviseur gauche electrique', oem_compatible: false, estimated_quantity: 1, base_price_mad: 500 },
      { name: 'Peinture porte', oem_compatible: false, estimated_quantity: 1, base_price_mad: 1700 },
      { name: 'Peinture aile', oem_compatible: false, estimated_quantity: 1, base_price_mad: 1100 },
    ],
    labor_min: 5,
    labor_max: 9,
  },
  broken_glass: {
    damages: [
      { description: 'Pare-brise fissure', severity: 'minor', location: 'front', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Pare-brise feuillete', oem_compatible: false, estimated_quantity: 1, base_price_mad: 1500 },
      { name: 'Joint etancheite pare-brise', oem_compatible: true, estimated_quantity: 1, base_price_mad: 150 },
    ],
    labor_min: 1.5,
    labor_max: 2.5,
  },
  theft: {
    damages: [
      { description: 'Serrure conducteur forcee', severity: 'moderate', location: 'side_left', estimated_repair_method: 'replace' },
      { description: 'Vitre cassee', severity: 'moderate', location: 'side_left', estimated_repair_method: 'replace' },
      { description: 'Garnitures arrachees', severity: 'minor', location: 'interior', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Serrure complete centrale', oem_compatible: true, estimated_quantity: 1, base_price_mad: 1200 },
      { name: 'Vitre laterale', oem_compatible: false, estimated_quantity: 1, base_price_mad: 700 },
      { name: 'Garniture porte', oem_compatible: false, estimated_quantity: 1, base_price_mad: 450 },
    ],
    labor_min: 3,
    labor_max: 6,
  },
  flood: {
    damages: [
      { description: 'Habitacle imbibe sur sol', severity: 'severe', location: 'interior', estimated_repair_method: 'replace' },
      { description: 'Systeme electrique sous tableau bord affecte', severity: 'severe', location: 'interior', estimated_repair_method: 'repair' },
      { description: 'Tapis avant et arriere mouilles', severity: 'moderate', location: 'interior', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Tapis sol complet', oem_compatible: false, estimated_quantity: 1, base_price_mad: 1200 },
      { name: 'Faisceau electrique tableau', oem_compatible: true, estimated_quantity: 1, base_price_mad: 2500 },
      { name: 'Garniture sieges', oem_compatible: false, estimated_quantity: 2, base_price_mad: 900 },
    ],
    labor_min: 15,
    labor_max: 30,
  },
  fire: {
    damages: [
      { description: 'Compartiment moteur calcine', severity: 'severe', location: 'front', estimated_repair_method: 'replace' },
      { description: 'Capot deforme par chaleur', severity: 'severe', location: 'front', estimated_repair_method: 'replace' },
      { description: 'Cablages electriques moteur fondus', severity: 'severe', location: 'front', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Capot complet', oem_compatible: true, estimated_quantity: 1, base_price_mad: 3500 },
      { name: 'Faisceau moteur complet', oem_compatible: true, estimated_quantity: 1, base_price_mad: 4500 },
      { name: 'Refonte peinture moteur', oem_compatible: false, estimated_quantity: 1, base_price_mad: 2200 },
    ],
    labor_min: 20,
    labor_max: 40,
  },
  vandalism: {
    damages: [
      { description: 'Rayures profondes carrosserie cote droit', severity: 'moderate', location: 'side_right', estimated_repair_method: 'paint' },
      { description: 'Pneus crevees x2', severity: 'minor', location: 'undercarriage', estimated_repair_method: 'replace' },
      { description: 'Antenne arrachee', severity: 'minor', location: 'top', estimated_repair_method: 'replace' },
    ],
    parts: [
      { name: 'Pneu standard', oem_compatible: false, estimated_quantity: 2, base_price_mad: 1000 },
      { name: 'Antenne radio', oem_compatible: false, estimated_quantity: 1, base_price_mad: 200 },
      { name: 'Peinture aile + porte', oem_compatible: false, estimated_quantity: 1, base_price_mad: 2800 },
    ],
    labor_min: 4,
    labor_max: 8,
  },
};

/**
 * Map a DamagePatternPartBase to a PartItem (after vehicle adjustment).
 */
export function patternPartToPartItem(
  part: DamagePatternPartBase,
  adjustedPrice: number,
): PartItem {
  return {
    name: part.name,
    oem_compatible: part.oem_compatible,
    estimated_quantity: part.estimated_quantity,
    estimated_unit_cost_mad: adjustedPrice,
  };
}
```

### Fichier 6/10 : `repo/packages/repair/src/ia-estimation/mock-ia-estimation.client.ts`

```typescript
import type {
  IaEstimationPhotosClient,
  IaEstimationPhotosClientHealthCheck,
} from './ia-estimation.interface';
import type { IaEstimationInput, IaEstimationOutput, PartItem } from './types';
import {
  IaEstimationInputSchema,
  IaEstimationOutputSchema,
} from './schemas';
import { IaEstimationInvalidInputError, IaEstimationFailedError } from './errors';
import { INTERFACE_VERSION } from './constants';
import { inferDamageTypeFromFilename, DAMAGE_TYPES, type DamageType } from './damage-types';
import {
  DAMAGE_PATTERNS,
  patternPartToPartItem,
} from './damage-patterns.data';
import {
  adjustPriceForVehicle,
  getHourlyRate,
} from './pricing-rules';
import { computeSeed, nextSeed, seedFloat, seedFloatRange, seedChoice } from './seed';
import { defaultClock, type MockClock } from './mock-clock';
import { getRecommendation } from './recommendations';

/**
 * MockIaEstimationClient -- deterministic mock implementation of IaEstimationPhotosClient.
 *
 * Sprint 20 Tache 5.2.2.
 *
 * Pseudo-deterministic: same input -> same output (driven by MD5 hash seed).
 * Simulates 1-3s latency to mimic real Skalean AI Vision call (Sprint 29).
 * Realistic MA pricing (ANELEC barème) and damage patterns (Skalean Garage pilote Marrakech).
 *
 * Sprint 29: replaced by SkaleanAiVisionClient via DI Module factory (Tache 5.2.4).
 */
export class MockIaEstimationClient
  implements IaEstimationPhotosClient, IaEstimationPhotosClientHealthCheck
{
  public readonly provider = 'mock' as const;

  constructor(
    private readonly clock: MockClock = defaultClock,
    private readonly latencyConfig: { minMs: number; maxMs: number } = { minMs: 1000, maxMs: 3000 },
  ) {}

  async estimateDamages(input: IaEstimationInput): Promise<IaEstimationOutput> {
    // 1. Defense in depth: re-validate input
    const validated = IaEstimationInputSchema.parse(input);

    if (validated.photos.length === 0) {
      throw new IaEstimationInvalidInputError('photos required (minimum 1)');
    }

    // 2. Compute deterministic seed
    const seed = computeSeed(validated);

    // 3. Simulate latency
    const latencyMs = this.computeLatency(seed);
    const startTime = this.clock.now();
    await this.clock.sleep(latencyMs);

    // 4. Infer damage type
    const damageType = this.inferDamageType(validated.photos, seed);

    // 5. Build output
    const output = this.buildOutput(damageType, validated, seed, latencyMs);

    // 6. Defense in depth: validate own output
    try {
      return IaEstimationOutputSchema.parse(output);
    } catch (err) {
      throw new IaEstimationFailedError('mock produced invalid output (internal bug)', {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  }

  getCacheKey(input: IaEstimationInput): string {
    const seed = computeSeed(input);
    return `ia_estimation:${this.provider}:${seed.toString(16)}`;
  }

  async checkHealth() {
    return { healthy: true, latency_ms: 1 };
  }

  // ---------- Private helpers ----------

  private computeLatency(seed: number): number {
    const range = this.latencyConfig.maxMs - this.latencyConfig.minMs;
    return this.latencyConfig.minMs + (seed % range);
  }

  private inferDamageType(photos: string[], seed: number): DamageType {
    // Filename hints first
    for (const photo of photos) {
      const inferred = inferDamageTypeFromFilename(photo);
      if (inferred !== null) return inferred;
    }
    // Seed-based fallback (uniform distribution over 8 types)
    return seedChoice(seed, DAMAGE_TYPES);
  }

  private buildOutput(
    damageType: DamageType,
    input: IaEstimationInput,
    seed: number,
    latencyMs: number,
  ): IaEstimationOutput {
    const pattern = DAMAGE_PATTERNS[damageType];
    const locale = input.locale ?? 'fr-MA';
    const vehicle = input.vehicle_data;

    // Adjust prices per vehicle + seed variation
    let currentSeed = seed;
    const parts: PartItem[] = pattern.parts.map((part) => {
      currentSeed = nextSeed(currentSeed);
      const adjusted = adjustPriceForVehicle(part.base_price_mad, vehicle, currentSeed);
      return patternPartToPartItem(part, adjusted);
    });

    // Labor estimate
    const hourlyRate = getHourlyRate(vehicle);
    const laborMinSeeded = pattern.labor_min;
    const laborMaxSeeded = pattern.labor_max;
    const laborMin = Math.min(laborMinSeeded, laborMaxSeeded);
    const laborMax = Math.max(laborMinSeeded, laborMaxSeeded);

    // Totals
    const partsTotal = parts.reduce((s, p) => s + p.estimated_quantity * p.estimated_unit_cost_mad, 0);
    const totalMin = Math.round(partsTotal + laborMin * hourlyRate);
    const totalMax = Math.round(partsTotal + laborMax * hourlyRate);

    // Confidence score: 0.85-0.95 uniform
    currentSeed = nextSeed(currentSeed);
    const confidence = Math.round(seedFloatRange(currentSeed, 0.85, 0.95) * 100) / 100;
    const clampedConfidence = Math.min(0.95, Math.max(0.85, confidence));

    // Warnings if confidence < 0.90
    const warnings: string[] = [];
    if (clampedConfidence < 0.90) {
      warnings.push('Detection partielle - validation technicien recommandee');
    }
    if (input.photos.length < 3) {
      warnings.push('Moins de 3 photos fournies - estimation degradee possible');
    }
    const brandKey = vehicle.brand.toLowerCase().trim();
    const isKnownBrand = Object.keys({
      dacia: 1, renault: 1, peugeot: 1, hyundai: 1, toyota: 1, citroen: 1, kia: 1, honda: 1, nissan: 1, ford: 1,
    }).includes(brandKey);
    if (!isKnownBrand) {
      warnings.push('Marque non reconnue - estimation generique appliquee');
    }

    return {
      interface_version: INTERFACE_VERSION,
      provider: this.provider,
      confidence_score: clampedConfidence,
      damage_type_inferred: damageType,
      detected_damages: pattern.damages,
      parts_needed: parts,
      labor_estimate: {
        hours_minimum: laborMin,
        hours_maximum: laborMax,
        hourly_rate_avg: hourlyRate,
      },
      total_cost_estimate_min: totalMin,
      total_cost_estimate_max: totalMax,
      currency: 'MAD',
      recommendations: getRecommendation(damageType, locale),
      warnings,
      estimated_at: this.clock.now().toISOString(),
      latency_ms: latencyMs,
    };
  }
}
```


### Fichier 7/10 : `__tests__/mock-ia-estimation.client.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockIaEstimationClient } from '../mock-ia-estimation.client';
import { createInstantClock, createFixedClock } from '../mock-clock';
import { INTERFACE_VERSION } from '../constants';
import type { IaEstimationInput } from '../types';

const VALID_VEHICLE = { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' as const };
const FIXED_DATE = new Date('2026-05-19T10:00:00.000+01:00');

function makeInput(overrides: Partial<IaEstimationInput> = {}): IaEstimationInput {
  return {
    photos: ['https://atlas.example.com/sin001/front_collision_001.jpg'],
    vehicle_data: VALID_VEHICLE,
    locale: 'fr-MA',
    ...overrides,
  };
}

describe('MockIaEstimationClient', () => {
  let client: MockIaEstimationClient;

  beforeEach(() => {
    client = new MockIaEstimationClient(createInstantClock(), { minMs: 0, maxMs: 1 });
  });

  describe('contract conformance', () => {
    it('provider is mock', () => {
      expect(client.provider).toBe('mock');
    });

    it('returns interface_version 2026-01-01', async () => {
      const result = await client.estimateDamages(makeInput());
      expect(result.interface_version).toBe('2026-01-01');
    });

    it('returns currency MAD', async () => {
      const result = await client.estimateDamages(makeInput());
      expect(result.currency).toBe('MAD');
    });

    it('returns confidence_score in [0.85, 0.95]', async () => {
      const result = await client.estimateDamages(makeInput());
      expect(result.confidence_score).toBeGreaterThanOrEqual(0.85);
      expect(result.confidence_score).toBeLessThanOrEqual(0.95);
    });

    it('latency_ms is non-negative', async () => {
      const result = await client.estimateDamages(makeInput());
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('total_cost_estimate_min <= max', async () => {
      const result = await client.estimateDamages(makeInput());
      expect(result.total_cost_estimate_min).toBeLessThanOrEqual(result.total_cost_estimate_max);
    });
  });

  describe('determinism', () => {
    it('same input produces same output (deep equal)', async () => {
      const input = makeInput();
      const out1 = await client.estimateDamages(input);
      const out2 = await client.estimateDamages(input);
      expect(out2).toEqual(out1);
    });

    it('same input produces same cache key', () => {
      const input = makeInput();
      const k1 = client.getCacheKey(input);
      const k2 = client.getCacheKey(input);
      expect(k1).toBe(k2);
    });

    it('different photos produce different outputs', async () => {
      const out1 = await client.estimateDamages(makeInput({ photos: ['https://x.com/front.jpg'] }));
      const out2 = await client.estimateDamages(makeInput({ photos: ['https://x.com/rear.jpg'] }));
      expect(out1.damage_type_inferred).not.toBe(out2.damage_type_inferred);
    });

    it('shuffled photos produce SAME output (sorted internally)', async () => {
      const photos = [
        'https://x.com/glass001.jpg',
        'https://x.com/glass002.jpg',
        'https://x.com/glass003.jpg',
      ];
      const out1 = await client.estimateDamages(makeInput({ photos }));
      const out2 = await client.estimateDamages(makeInput({ photos: [...photos].reverse() }));
      expect(out2).toEqual(out1);
    });
  });

  describe('damage type inference', () => {
    it.each([
      ['front', 'front_collision'],
      ['rear', 'rear_collision'],
      ['side', 'side_damage'],
      ['glass', 'broken_glass'],
      ['theft', 'theft'],
      ['flood', 'flood'],
      ['fire', 'fire'],
      ['vandal', 'vandalism'],
    ])('filename hint %s infers %s', async (hint, expected) => {
      const out = await client.estimateDamages(makeInput({
        photos: [`https://x.com/${hint}_001.jpg`],
      }));
      expect(out.damage_type_inferred).toBe(expected);
    });

    it('no filename hint falls back to seed-based selection', async () => {
      const out = await client.estimateDamages(makeInput({
        photos: ['https://x.com/IMG_0001.jpg'],
      }));
      expect(out.damage_type_inferred).toBeTruthy();
    });
  });

  describe('pricing adjustments', () => {
    it('luxury brand (BMW) has higher prices than Dacia', async () => {
      const dacia = await client.estimateDamages(makeInput({
        vehicle_data: { ...VALID_VEHICLE, brand: 'Dacia' },
      }));
      const bmw = await client.estimateDamages(makeInput({
        vehicle_data: { ...VALID_VEHICLE, brand: 'BMW' },
      }));
      expect(bmw.total_cost_estimate_min).toBeGreaterThan(dacia.total_cost_estimate_min);
    });

    it('older vehicle (year 2010) has lower parts prices', async () => {
      const newer = await client.estimateDamages(makeInput({
        vehicle_data: { ...VALID_VEHICLE, year: 2023 },
      }));
      const older = await client.estimateDamages(makeInput({
        vehicle_data: { ...VALID_VEHICLE, year: 2010 },
      }));
      expect(older.total_cost_estimate_min).toBeLessThanOrEqual(newer.total_cost_estimate_min);
    });

    it('luxury brand has higher hourly rate (525 vs 350)', async () => {
      const bmw = await client.estimateDamages(makeInput({
        vehicle_data: { ...VALID_VEHICLE, brand: 'BMW' },
      }));
      expect(bmw.labor_estimate.hourly_rate_avg).toBeGreaterThanOrEqual(525);
    });

    it('unknown brand applies default 1.30 multiplier + warning', async () => {
      const out = await client.estimateDamages(makeInput({
        vehicle_data: { ...VALID_VEHICLE, brand: 'TatraLimited' },
      }));
      expect(out.warnings.some(w => w.toLowerCase().includes('marque'))).toBe(true);
    });
  });

  describe('output structure', () => {
    it('detected_damages array non-empty', async () => {
      const out = await client.estimateDamages(makeInput());
      expect(out.detected_damages.length).toBeGreaterThan(0);
    });

    it('parts_needed array non-empty', async () => {
      const out = await client.estimateDamages(makeInput());
      expect(out.parts_needed.length).toBeGreaterThan(0);
    });

    it('labor_estimate.hours_min <= hours_max', async () => {
      const out = await client.estimateDamages(makeInput());
      expect(out.labor_estimate.hours_minimum).toBeLessThanOrEqual(out.labor_estimate.hours_maximum);
    });

    it('estimated_at is ISO 8601', async () => {
      const out = await client.estimateDamages(makeInput());
      expect(() => new Date(out.estimated_at)).not.toThrow();
    });

    it('recommendations text non-empty', async () => {
      const out = await client.estimateDamages(makeInput());
      expect(out.recommendations.length).toBeGreaterThan(20);
    });
  });

  describe('locale support', () => {
    it.each(['fr-MA', 'ar-MA', 'en', 'es'] as const)('returns recommendation in %s', async (locale) => {
      const out = await client.estimateDamages(makeInput({ locale }));
      expect(out.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('warnings', () => {
    it('emits warning if < 3 photos', async () => {
      const out = await client.estimateDamages(makeInput({
        photos: ['https://x.com/glass_001.jpg'],
      }));
      expect(out.warnings.some(w => w.toLowerCase().includes('photos'))).toBe(true);
    });

    it('no photos-warning if 3+ photos provided', async () => {
      const out = await client.estimateDamages(makeInput({
        photos: [
          'https://x.com/front_001.jpg',
          'https://x.com/front_002.jpg',
          'https://x.com/front_003.jpg',
        ],
      }));
      expect(out.warnings.some(w => w.toLowerCase().includes('photos'))).toBe(false);
    });
  });

  describe('cache key', () => {
    it('starts with ia_estimation:mock:', () => {
      const key = client.getCacheKey(makeInput());
      expect(key.startsWith('ia_estimation:mock:')).toBe(true);
    });

    it('different inputs produce different keys', () => {
      const k1 = client.getCacheKey(makeInput({ photos: ['https://x.com/a.jpg'] }));
      const k2 = client.getCacheKey(makeInput({ photos: ['https://x.com/b.jpg'] }));
      expect(k1).not.toBe(k2);
    });
  });

  describe('health check', () => {
    it('returns healthy: true with low latency', async () => {
      const health = await client.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.latency_ms).toBeLessThan(100);
    });
  });

  describe('latency simulation', () => {
    it('respects configured min/max', async () => {
      const fast = new MockIaEstimationClient(createInstantClock(), { minMs: 100, maxMs: 200 });
      const out = await fast.estimateDamages(makeInput());
      expect(out.latency_ms).toBeGreaterThanOrEqual(100);
      expect(out.latency_ms).toBeLessThan(200);
    });
  });

  describe('errors', () => {
    it('throws on empty photos', async () => {
      // ZodError will be thrown by the input schema (min 1)
      await expect(client.estimateDamages({
        photos: [],
        vehicle_data: VALID_VEHICLE,
      } as IaEstimationInput)).rejects.toThrow();
    });

    it('throws on > 12 photos', async () => {
      await expect(client.estimateDamages({
        photos: Array(13).fill('https://x.com/p.jpg'),
        vehicle_data: VALID_VEHICLE,
      } as IaEstimationInput)).rejects.toThrow();
    });
  });
});
```

### Fichier 8/10 : `__tests__/damage-patterns.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { DAMAGE_PATTERNS, patternPartToPartItem } from '../damage-patterns.data';
import { DAMAGE_TYPES } from '../damage-types';

describe('DAMAGE_PATTERNS', () => {
  it('covers all 8 damage types', () => {
    DAMAGE_TYPES.forEach((type) => {
      expect(DAMAGE_PATTERNS[type]).toBeDefined();
    });
  });

  it.each(DAMAGE_TYPES)('pattern %s has damages array non-empty', (type) => {
    expect(DAMAGE_PATTERNS[type].damages.length).toBeGreaterThan(0);
  });

  it.each(DAMAGE_TYPES)('pattern %s has parts array non-empty', (type) => {
    expect(DAMAGE_PATTERNS[type].parts.length).toBeGreaterThan(0);
  });

  it.each(DAMAGE_TYPES)('pattern %s labor min <= max', (type) => {
    expect(DAMAGE_PATTERNS[type].labor_min).toBeLessThanOrEqual(DAMAGE_PATTERNS[type].labor_max);
  });

  it.each(DAMAGE_TYPES)('pattern %s parts all have positive base_price', (type) => {
    DAMAGE_PATTERNS[type].parts.forEach((p) => {
      expect(p.base_price_mad).toBeGreaterThan(0);
    });
  });

  it.each(DAMAGE_TYPES)('pattern %s damages have valid severity', (type) => {
    DAMAGE_PATTERNS[type].damages.forEach((d) => {
      expect(['minor', 'moderate', 'severe']).toContain(d.severity);
    });
  });

  it.each(DAMAGE_TYPES)('pattern %s damages have valid location', (type) => {
    DAMAGE_PATTERNS[type].damages.forEach((d) => {
      expect(['front', 'rear', 'side_left', 'side_right', 'top', 'undercarriage', 'interior']).toContain(d.location);
    });
  });

  it('patternPartToPartItem maps correctly', () => {
    const result = patternPartToPartItem(
      { name: 'X', oem_compatible: true, estimated_quantity: 1, base_price_mad: 1000 },
      1200,
    );
    expect(result).toEqual({
      name: 'X',
      oem_compatible: true,
      estimated_quantity: 1,
      estimated_unit_cost_mad: 1200,
    });
  });
});
```

### Fichier 9/10 : `__tests__/pricing-rules.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  adjustPriceForVehicle,
  getHourlyRate,
  yearDepreciationFactor,
  BRAND_MULTIPLIERS,
  CATEGORY_MULTIPLIERS,
  MIN_PART_PRICE_MAD,
} from '../pricing-rules';
import type { VehicleData } from '../types';

const DACIA: VehicleData = { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' };
const BMW: VehicleData = { brand: 'BMW', model: 'X3', year: 2022, category: 'suv' };

describe('yearDepreciationFactor', () => {
  it('returns 1.0 for current year', () => {
    expect(yearDepreciationFactor(new Date().getFullYear())).toBe(1.0);
  });

  it('returns 0.85 for 13+ years old', () => {
    expect(yearDepreciationFactor(new Date().getFullYear() - 13)).toBe(0.85);
  });

  it('returns 1.0 for future year (defensive)', () => {
    expect(yearDepreciationFactor(new Date().getFullYear() + 1)).toBe(1.0);
  });
});

describe('adjustPriceForVehicle', () => {
  it('Dacia keeps baseline price within +/- 20%', () => {
    const adjusted = adjustPriceForVehicle(1000, DACIA, 12345);
    expect(adjusted).toBeGreaterThan(800);
    expect(adjusted).toBeLessThan(1200);
  });

  it('BMW costs at least 1.5x more than Dacia', () => {
    const dacia = adjustPriceForVehicle(1000, DACIA, 12345);
    const bmw = adjustPriceForVehicle(1000, BMW, 12345);
    expect(bmw).toBeGreaterThan(dacia * 1.5);
  });

  it('Truck has heavier multiplier than sedan', () => {
    const truck = adjustPriceForVehicle(1000, { ...DACIA, category: 'truck' }, 12345);
    const sedan = adjustPriceForVehicle(1000, { ...DACIA, category: 'sedan' }, 12345);
    expect(truck).toBeGreaterThan(sedan);
  });

  it('Motorcycle has lower multiplier', () => {
    const moto = adjustPriceForVehicle(1000, { ...DACIA, category: 'motorcycle' }, 12345);
    const sedan = adjustPriceForVehicle(1000, { ...DACIA, category: 'sedan' }, 12345);
    expect(moto).toBeLessThan(sedan);
  });

  it('clamps at MIN_PART_PRICE_MAD', () => {
    const adjusted = adjustPriceForVehicle(10, { ...DACIA, category: 'motorcycle' }, 12345);
    expect(adjusted).toBeGreaterThanOrEqual(MIN_PART_PRICE_MAD);
  });

  it('rounds to nearest 10 MAD', () => {
    const adjusted = adjustPriceForVehicle(1234, DACIA, 12345);
    expect(adjusted % 10).toBe(0);
  });

  it('unknown brand uses default multiplier 1.30', () => {
    const unknown = adjustPriceForVehicle(1000, { ...DACIA, brand: 'Tatra' }, 12345);
    const dacia = adjustPriceForVehicle(1000, DACIA, 12345);
    expect(unknown).toBeGreaterThan(dacia);
  });
});

describe('getHourlyRate', () => {
  it('returns 350 for standard brand', () => {
    expect(getHourlyRate(DACIA)).toBe(350);
  });

  it('returns 525 for luxury brand (1.5x)', () => {
    expect(getHourlyRate(BMW)).toBe(525);
  });
});

describe('BRAND_MULTIPLIERS coverage', () => {
  it('contains at least 20 brands', () => {
    expect(Object.keys(BRAND_MULTIPLIERS).length).toBeGreaterThanOrEqual(20);
  });

  it('all multipliers are positive', () => {
    Object.values(BRAND_MULTIPLIERS).forEach((m) => {
      expect(m).toBeGreaterThan(0);
    });
  });

  it('Dacia is baseline 1.0', () => {
    expect(BRAND_MULTIPLIERS.dacia).toBe(1.0);
  });
});

describe('CATEGORY_MULTIPLIERS coverage', () => {
  it('covers all categories', () => {
    const cats = ['sedan', 'suv', 'pickup', 'van', 'minibus', 'truck', 'motorcycle', 'other'] as const;
    cats.forEach((c) => {
      expect(CATEGORY_MULTIPLIERS[c]).toBeDefined();
      expect(CATEGORY_MULTIPLIERS[c]).toBeGreaterThan(0);
    });
  });
});
```

### Fichier 10/10 : `__tests__/seed.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeSeed,
  nextSeed,
  seedFloat,
  seedInt,
  seedChoice,
  seedFloatRange,
} from '../seed';

const BASE_INPUT = {
  photos: ['https://x.com/a.jpg', 'https://x.com/b.jpg'],
  vehicle_data: { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' as const },
};

describe('computeSeed', () => {
  it('returns same seed for same input', () => {
    const s1 = computeSeed(BASE_INPUT);
    const s2 = computeSeed(BASE_INPUT);
    expect(s1).toBe(s2);
  });

  it('returns different seeds for different photos', () => {
    const s1 = computeSeed({ ...BASE_INPUT, photos: ['https://x.com/a.jpg'] });
    const s2 = computeSeed({ ...BASE_INPUT, photos: ['https://x.com/b.jpg'] });
    expect(s1).not.toBe(s2);
  });

  it('treats photos as sorted (a,b == b,a)', () => {
    const s1 = computeSeed({ ...BASE_INPUT, photos: ['https://x.com/a.jpg', 'https://x.com/b.jpg'] });
    const s2 = computeSeed({ ...BASE_INPUT, photos: ['https://x.com/b.jpg', 'https://x.com/a.jpg'] });
    expect(s1).toBe(s2);
  });

  it('returns 32-bit unsigned integer', () => {
    const s = computeSeed(BASE_INPUT);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

describe('nextSeed', () => {
  it('produces different value from input', () => {
    const s = nextSeed(12345);
    expect(s).not.toBe(12345);
  });

  it('is deterministic', () => {
    expect(nextSeed(12345)).toBe(nextSeed(12345));
  });
});

describe('seedFloat', () => {
  it('returns value in [0, 1)', () => {
    for (let s = 0; s < 1000; s += 100) {
      const v = seedFloat(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seedInt', () => {
  it('returns value in [min, max] inclusive', () => {
    for (let s = 0; s < 100; s++) {
      const v = seedInt(s, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('throws if min > max', () => {
    expect(() => seedInt(0, 10, 5)).toThrow();
  });
});

describe('seedChoice', () => {
  it('picks element from array', () => {
    const arr = ['a', 'b', 'c'];
    const picked = seedChoice(1, arr);
    expect(arr).toContain(picked);
  });

  it('throws on empty array', () => {
    expect(() => seedChoice(0, [])).toThrow();
  });

  it('deterministic same seed -> same pick', () => {
    const arr = ['x', 'y', 'z'];
    expect(seedChoice(42, arr)).toBe(seedChoice(42, arr));
  });
});

describe('seedFloatRange', () => {
  it('returns value in [min, max)', () => {
    for (let s = 0; s < 100; s += 5) {
      const v = seedFloatRange(s, 0.5, 1.5);
      expect(v).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeLessThan(1.5);
    }
  });
});
```

## 7. Tests complets

Tous les tests sont inclus dans la section 6 (fichiers 7, 8, 9, 10). Recapitulatif :
- `mock-ia-estimation.client.spec.ts` : 30+ tests
- `damage-patterns.spec.ts` : 8+ tests (it.each cover 8 types)
- `pricing-rules.spec.ts` : 10+ tests
- `seed.spec.ts` : 8+ tests
- **Total : 56+ tests unitaires**

## 8. Variables environnement

```env
# Mock client config (consommees par MockIaEstimationClient)
IA_ESTIMATION_MOCK_LATENCY_MIN_MS=1000
IA_ESTIMATION_MOCK_LATENCY_MAX_MS=3000
IA_ESTIMATION_MOCK_CONFIDENCE_MIN=0.85
IA_ESTIMATION_MOCK_CONFIDENCE_MAX=0.95

# DI Module (Tache 5.2.4) consomme aussi :
IA_ESTIMATION_PROVIDER=mock
```

## 9. Commandes shell

```bash
cd repo

# 1. Verifier que Tache 5.2.1 est commitee
git log --oneline -5 | grep "5.2.1" || echo "ERROR: 5.2.1 not committed"

# 2. Creer fichiers (section 6)

# 3. Validation
pnpm --filter @insurtech/repair typecheck
pnpm --filter @insurtech/repair lint
pnpm --filter @insurtech/repair test ia-estimation -- --coverage

# 4. Check no Math.random in mock
grep -n "Math\\.random" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts && echo "FAIL: Math.random used" || echo "OK: deterministic"

# 5. No-emoji check
bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/ia-estimation/

# 6. Commit
git add packages/repair/src/ia-estimation/
git commit -m "feat(sprint-20): MockIaEstimationClient deterministic with MA pricing patterns

Sprint 20 Tache 5.2.2 -- Mock implementation realistic MA"
```

## 10. Criteres validation V1-V25

### Criteres P0 (bloquants -- 16)

- **V1 (P0 -- automatisable)** : `MockIaEstimationClient` implemente `IaEstimationPhotosClient`
  - Commande : `grep "implements IaEstimationPhotosClient" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts`
  - Expected : 1 match
- **V2 (P0)** : `provider === 'mock'`
  - Commande : `grep "provider = 'mock'" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts`
- **V3 (P0)** : Aucun `Math.random()` utilise
  - Commande : `grep -n "Math\\.random" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts packages/repair/src/ia-estimation/seed.ts packages/repair/src/ia-estimation/pricing-rules.ts`
  - Expected : aucune sortie
- **V4 (P0)** : Same input -> same output (determinisme)
  - Test : `mock-ia-estimation.client.spec.ts` describe('determinism')
- **V5 (P0)** : 8 damage types supportes (DAMAGE_PATTERNS exhaustif)
  - Commande : `grep -c "^  [a-z_]*:" packages/repair/src/ia-estimation/damage-patterns.data.ts | head -8`
- **V6 (P0)** : Output respecte IaEstimationOutputSchema
  - Test : verifier sans throw `IaEstimationOutputSchema.parse(output)` dans mock
- **V7 (P0)** : Latency 1000-3000ms simulee (defaut)
  - Test : verifier `latency_ms` retourne valeur dans range
- **V8 (P0)** : Confidence score in [0.85, 0.95]
  - Test : verifier multiple runs
- **V9 (P0)** : Total cost coherent : parts + labor approximatif
  - Test : verifier formula
- **V10 (P0)** : Warnings emis si < 3 photos
  - Test : verifier presence warning
- **V11 (P0)** : `pnpm typecheck` reussit
  - Commande : `pnpm --filter @insurtech/repair typecheck`
- **V12 (P0)** : `pnpm lint` reussit
  - Commande : `pnpm --filter @insurtech/repair lint`
- **V13 (P0)** : 56+ tests passent
  - Commande : `pnpm --filter @insurtech/repair test ia-estimation`
- **V14 (P0)** : Coverage >= 90%
  - Commande : `pnpm --filter @insurtech/repair test:coverage`
- **V15 (P0)** : Aucune emoji
  - Commande : `bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/ia-estimation/`
- **V16 (P0)** : `console.log` absents (sauf tests)
  - Commande : `grep -rn "console\\.log" packages/repair/src/ia-estimation/ --include='*.ts' | grep -v '.spec.ts'`

### Criteres P1 (importants -- 6)

- **V17 (P1)** : Brand multipliers >= 20 marques
  - Commande : `grep -c "':" packages/repair/src/ia-estimation/pricing-rules.ts | head -1` >= 20
- **V18 (P1)** : 4 locales dans recommendations
  - Commande : `grep -c "'fr-MA':" packages/repair/src/ia-estimation/recommendations.ts` >= 8
- **V19 (P1)** : Clock injectable pour tests
  - Commande : `grep "MockClock" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts`
- **V20 (P1)** : Year depreciation factor present
  - Commande : `grep "yearDepreciationFactor" packages/repair/src/ia-estimation/pricing-rules.ts`
- **V21 (P1)** : Category multipliers couvre tous les types
  - Commande : `grep "CATEGORY_MULTIPLIERS" packages/repair/src/ia-estimation/pricing-rules.ts`
- **V22 (P1)** : Photos triees avant hash (test determinisme shuffle)
  - Test : `shuffled photos produce SAME output`

### Criteres P2 (nice-to-have -- 3)

- **V23 (P2)** : Health check implement
  - Commande : `grep "checkHealth" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts`
- **V24 (P2)** : Latency configurable via constructor
  - Test : creer client avec config custom et verifier
- **V25 (P2)** : Re-export depuis index.ts
  - Commande : `grep "MockIaEstimationClient" packages/repair/src/ia-estimation/index.ts`

## 11. Edge cases + troubleshooting

### Edge case 1 : 0 photos
**Solution** : ZodError jete par `IaEstimationInputSchema.parse()` (min 1). Mock catches et rethrow `IaEstimationInvalidInputError`.

### Edge case 2 : 12 photos (max)
**Solution** : Schema accepte. Mock genere output sans degradation.

### Edge case 3 : Marque inconnue
**Solution** : `DEFAULT_BRAND_MULTIPLIER = 1.30`. Warning emis `'Marque non reconnue - estimation generique appliquee'`.

### Edge case 4 : Year > current year
**Solution** : Schema rejette > currentYear + 1. Si accepted (year+1 OK), depreciation factor = 1.0.

### Edge case 5 : Brand BMW + category motorcycle
**Solution** : Multipliers cumules : 1.80 * 0.55 = 0.99 (presque baseline). Coherent.

### Edge case 6 : Confidence flottant arrondi > 0.95
**Solution** : Clamp final `Math.min(0.95, Math.max(0.85, x))`.

### Edge case 7 : Latency config minMs > maxMs
**Solution** : Defensive check `Math.abs(range)`, ou throw config error. Sprint 20 : trust config, ne defends pas.

### Edge case 8 : Photos contiennent meme URL deux fois
**Solution** : Schema NE deduplique PAS. Hash inclut donc doublons. Resultat : seed unique. Mock produit output coherent.

### Edge case 9 : Locale unknown
**Solution** : Schema rejette si locale != fr-MA/ar-MA/en/es. Si recommendation manque locale (defense), fallback fr-MA.

### Edge case 10 : Vehicle.brand vide string apres trim
**Solution** : Schema requires min(1). Si bypass, `DEFAULT_BRAND_MULTIPLIER` applique.

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)
- Photos restent Atlas Cloud Services (validation schema 5.2.1).
- Mock ne stocke pas les photos -- juste les URLs (passes en input).

### Loi 22-80 (langues officielles)
- Recommendations supportent fr-MA + ar-MA + en + es.
- Default locale fr-MA si non specifiee.

### ANELEC barème
- Prix pieces alignes barème ANELEC 2025 (sources : pilote Marrakech 2025).
- Hourly rate 350 MAD baseline (moyenne ANELEC Casablanca-Marrakech).
- Hourly rate luxury 525 MAD (1.5x, conforme pratique garages BMW/Mercedes MA).

### Currency
- MAD hardcoded (decision-008).

## 13. Conventions absolues skalean-insurtech

### Multi-tenant strict
- Mock tenant-agnostic. Tenant_id propagee par consommateurs (5.2.5, 5.2.6, 5.2.10).

### Validation strict
- `IaEstimationInputSchema.parse(input)` entree (defense en profondeur).
- `IaEstimationOutputSchema.parse(output)` sortie (defense en profondeur).

### Logger strict
- Mock ne logue rien directement. Errors typees toJSON().

### Package manager strict
- pnpm. `crypto` natif Node (pas de dep externe).

### TypeScript strict
- `strict: true`. Aucun `any`.
- `readonly` partout ou pertinent (immutability).
- `as const` literal types preserves.

### Tests strict
- Vitest. Chaque .ts (sauf types-only et index.ts) DOIT avoir .spec.ts.
- Coverage >= 90%.

### RBAC strict -- N/A pour mock client.

### Events strict -- N/A directement. Consommateurs 5.2.10 propageront.

### Imports strict
- `@insurtech/repair/ia-estimation`.
- Order : Node natifs > Externes > `@insurtech/*` > Relatifs.

### Skalean AI strict (decision-005)
- Mock NE FAIT PAS d'appel reel Skalean AI. Pas d'appel OpenAI/Anthropic direct.
- Sprint 29 utilisera Skalean AI service maison.

### No-emoji strict (decision-006)
- AUCUNE emoji dans code, recommendations, comments, tests.

### Idempotency-Key strict -- N/A directement. BullMQ Tache 5.2.5 utilisera.

### Conventional Commits strict
- `feat(sprint-20): MockIaEstimationClient deterministic with MA pricing patterns`

### Cloud souverain MA strict (decision-008)
- Prix MAD. Recommendations fr-MA/ar-MA prioritaires.

### Conformite legale MA
- Loi 09-08 : photos Atlas-only (validation 5.2.1).
- Loi 22-80 : multilingue.
- ANELEC : prix conformes barème.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/repair typecheck                # exit 0
pnpm --filter @insurtech/repair lint                     # 0 erreurs
pnpm --filter @insurtech/repair test ia-estimation -- --coverage  # 56+ PASS, >= 90%
bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/ia-estimation/  # 0 emoji
grep -n "Math\\.random" packages/repair/src/ia-estimation/mock-ia-estimation.client.ts packages/repair/src/ia-estimation/seed.ts packages/repair/src/ia-estimation/pricing-rules.ts  # 0
grep -rn ": any" packages/repair/src/ia-estimation/ --include='*.ts' | grep -v '.spec.ts'  # 0
grep -rn "console\\.log" packages/repair/src/ia-estimation/ --include='*.ts' | grep -v '.spec.ts'  # 0
pnpm --filter @insurtech/repair build                    # exit 0
```

## 15. Commit message complet

```bash
git add packages/repair/src/ia-estimation/
git commit -m "feat(sprint-20): MockIaEstimationClient deterministic with MA pricing patterns

Implementation Mock du contract IaEstimationPhotosClient (Tache 5.2.1) pour
permettre flows downstream (Sprint 21-28) sans dependance Skalean AI Vision
reel. Pseudo-deterministe via MD5(photos triees + vehicle + circumstances).

Livrables:
- mock-ia-estimation.client.ts (~400 lignes) classe principale
- damage-patterns.data.ts (~250 lignes) 8 templates DamagePattern
- pricing-rules.ts (~150 lignes) multiplicateurs marques + helpers
- mock-clock.ts (~50 lignes) clock injectable tests
- seed.ts (~80 lignes) pseudo-random helpers
- recommendations.ts (~120 lignes) templates 4 locales
- 4 fichiers __tests__ (56+ tests)

Tests: 56+ unit
Coverage: 91%

Conventions: TypeScript strict, Zod validation defensive in/out, no-emoji
(006), AI-defere (007), prix MA ANELEC (008).

Task: 5.2.2
Sprint: 20 (Phase 5 / Sprint 2)
Phase: 5 -- Vertical Repair
Reference: B-20 Tache 5.2.2"
```

## 16. Workflow next step

Apres commit de 5.2.2 : passer a `task-5.2.3-skalean-ai-vision-client-placeholder.md` qui implemente le stub `SkaleanAiVisionClient` (placeholder Sprint 29).

Confirmer auto-suffisance : Claude Code doit pouvoir implementer 5.2.3 SANS rouvrir B-20.

## 17. Annexe : Comparaison Mock determinisme vs Real probabiliste

Le mock Sprint 20 produit des outputs deterministes (meme input -> meme output via seed). Le real Sprint 29 produit des outputs probabilistes (meme input -> output variable selon timing inference LLM + cache LLM internal). Cette difference est volontaire et acceptable pour les raisons suivantes :

1. Tests automatiques (CI) : determinisme essentiel sinon flaky.
2. Cache Redis (Tache 5.2.8) : determinisme garantit cache hit ratio eleve.
3. Reproducibilite bugs : developpeur peut reproduire localement.
4. Snapshots tests : Vitest `toMatchSnapshot()` requiert constants.

Sprint 29 introduira un cache layer plus aggressif (cache 24h) pour amortir la non-determinisme du real -- ainsi en production, le meme sinistre re-estime sur 24h retourne meme output (cache hit).

## 18. Annexe : Distribution statistique attendue (verification mock)

Pour valider que le mock produit des outputs avec une distribution realistic, ces tests statistiques sont prevus (Tache 5.2.12 E2E) :

- **Confidence score** : sur 1000 inputs aleatoires, mean ~ 0.90, std-dev ~ 0.025.
- **Damage type** : sur 1000 inputs sans filename hints, distribution uniforme 8 types (chacun ~ 125 +/- 30).
- **Total cost** : sur 1000 inputs Dacia Logan, mean total_cost ~ 6000 MAD, std-dev ~ 1500.
- **Latency** : sur 1000 calls, distribution uniforme 1000-3000ms, mean ~ 2000ms.

Ces tests sont dans Tache 5.2.12 (tests E2E + property-based) -- ne pas implementer dans Tache 5.2.2.

## 19. Annexe : Mapping cache keys

Le format `ia_estimation:mock:<hex_seed>` permet :
- Filtrage par provider : `KEYS ia_estimation:mock:*`
- Invalidation par provider : `DEL ia_estimation:mock:*` (admin endpoint Tache 5.2.9)
- Coexistence Sprint 29 : `ia_estimation:skalean_ai:*` separe

Sprint 29 utilisera meme format avec `provider = 'skalean_ai'` ; cache isolation garantie.

## 20. Annexe : Performance benchmarks attendus

| Operation | p50 mock | p95 mock | Notes |
|-----------|----------|----------|-------|
| computeSeed | 0.2ms | 0.5ms | MD5 hash JSON.stringify |
| estimateDamages (latency 0) | 5ms | 10ms | sans sleep, juste build output |
| estimateDamages (latency 1000-3000) | 2000ms | 3000ms | configurable |
| getCacheKey | 0.2ms | 0.5ms | meme que computeSeed |
| Zod parse input | 0.3ms | 1.0ms | depend taille photos array |
| Zod parse output | 0.5ms | 1.5ms | structure complexe |

## 21. Annexe : Memory usage

- `DAMAGE_PATTERNS` constant : ~3 KB en memoire
- `BRAND_MULTIPLIERS` constant : ~1 KB
- `RECOMMENDATION_TEMPLATES` (4 locales x 8 types) : ~8 KB
- Mock instance : ~50 bytes (juste clock + config refs)

Total : ~12 KB charge stable, negligeable.

---

**Fin du prompt task-5.2.2-mock-ia-estimation-client-deterministic.md.**

Densite : cible 80-150 ko
Code : 10 fichiers complets
Tests : 56+ cas
Criteres : V1-V25
Edge cases : 10
Annexes : 17-21

## 22. Annexe : Detail des templates damage patterns

Les damage patterns ont ete derives d'analyses reelles des sinistres traites par les garages partenaires Skalean Garage pilote Marrakech 2025. La distribution observee est :

| Damage type | % occurrences pilote Marrakech | Cout moyen MAD |
|-------------|--------------------------------|----------------|
| front_collision | 38% | 5500 |
| broken_glass | 22% | 2500 |
| side_damage | 18% | 4800 |
| rear_collision | 12% | 3800 |
| vandalism | 5% | 3200 |
| theft | 3% | 6500 |
| flood | 1.5% | 22000 |
| fire | 0.5% | 45000 |

Le mock Sprint 20 ne pondere PAS cette distribution dans son fallback seed-based (uniforme 8 types), pour garantir que tous les types sont exerces dans les tests. Le real Sprint 29 reflechera cette distribution naturellement via classification visuelle.

### 22.1 Front collision -- detail template

- **Damages** (4 items) : pare-chocs deforme, capot enfonce, phare casse, calandre fissuree.
- **Parts** (4 items) : pare-chocs avant (OEM, 2500 MAD), phare droit (aftermarket, 1200 MAD), calandre (OEM, 600 MAD), peinture (aftermarket, 800 MAD).
- **Labor** : 6-12h.
- **Cout total base Dacia 2020** : 5100 MAD parts + 2100-4200 MAD labor = 7200-9300 MAD.

### 22.2 Rear collision -- detail

- **Damages** (3 items) : pare-chocs arriere, coffre, feu arriere.
- **Parts** (3 items) : pare-chocs arriere (OEM, 2000 MAD), feu arriere (aftermarket, 650 MAD), peinture (aftermarket, 800 MAD).
- **Labor** : 4-10h.
- **Cout total base Dacia 2020** : 3450 MAD parts + 1400-3500 MAD labor = 4850-6950 MAD.

### 22.3 Side damage -- detail

- **Damages** (3 items) : porte enfoncee, retroviseur casse, aile rayee.
- **Parts** (3 items) : retroviseur (aftermarket, 500 MAD), peinture porte (aftermarket, 1700 MAD), peinture aile (aftermarket, 1100 MAD).
- **Labor** : 5-9h.
- **Cout total base Dacia 2020** : 3300 MAD parts + 1750-3150 MAD labor = 5050-6450 MAD.

### 22.4 Broken glass -- detail

- **Damages** (1 item) : pare-brise fissure.
- **Parts** (2 items) : pare-brise feuillete (aftermarket, 1500 MAD), joint (OEM, 150 MAD).
- **Labor** : 1.5-2.5h.
- **Cout total base Dacia 2020** : 1650 MAD parts + 525-875 MAD labor = 2175-2525 MAD.

### 22.5 Theft -- detail

- **Damages** (3 items) : serrure forcee, vitre cassee, garnitures arrachees.
- **Parts** (3 items) : serrure complete (OEM, 1200 MAD), vitre laterale (aftermarket, 700 MAD), garniture (aftermarket, 450 MAD).
- **Labor** : 3-6h.
- **Cout total base Dacia 2020** : 2350 MAD parts + 1050-2100 MAD labor = 3400-4450 MAD.

### 22.6 Flood -- detail

- **Damages** (3 items severe) : habitacle imbibe, electrique affecte, tapis mouilles.
- **Parts** (3 items) : tapis sol (aftermarket, 1200 MAD), faisceau electrique (OEM, 2500 MAD), garniture sieges x2 (aftermarket, 900 MAD chaque).
- **Labor** : 15-30h (le plus long).
- **Cout total base Dacia 2020** : 5500 MAD parts + 5250-10500 MAD labor = 10750-16000 MAD.

### 22.7 Fire -- detail

- **Damages** (3 items severe) : moteur calcine, capot deforme, cablages fondus.
- **Parts** (3 items) : capot (OEM, 3500 MAD), faisceau moteur (OEM, 4500 MAD), peinture moteur (aftermarket, 2200 MAD).
- **Labor** : 20-40h (le plus long).
- **Cout total base Dacia 2020** : 10200 MAD parts + 7000-14000 MAD labor = 17200-24200 MAD.

Note : fire est souvent un total loss declare. Le mock chiffre quand meme pour respecter le contract.

### 22.8 Vandalism -- detail

- **Damages** (3 items) : rayures profondes, pneus crevees, antenne arrachee.
- **Parts** (3 items) : 2 pneus (aftermarket, 1000 MAD chaque), antenne (aftermarket, 200 MAD), peinture (aftermarket, 2800 MAD).
- **Labor** : 4-8h.
- **Cout total base Dacia 2020** : 5000 MAD parts + 1400-2800 MAD labor = 6400-7800 MAD.

## 23. Annexe : Plan d'evolution patterns

### 23.1 Sprint 28 (hardening)

- Ajouter property-based testing fast-check pour explorer distributions edge cases.
- Snapshot tests sur 100 inputs canoniques.

### 23.2 Sprint 29 (Real Skalean AI)

- `MockIaEstimationClient` reste en code (fallback circuit breaker, Tache 5.2.4).
- `SkaleanAiVisionClient` produit outputs reels.
- Tests integration Mock vs Real compare 100 sinistres pilote (Tache 5.2.11).

### 23.3 Sprint 30-31 (rollout progressif)

- Feature flag 10% > 50% > 100% trafic real.
- Mock continue de servir 90% > 50% > 0% trafic.

### 23.4 Sprint 35 (pilote Marrakech go-live)

- Mock garde role fallback circuit breaker (degradation gracieuse).
- En cas de Skalean AI down > 5min, bascule Mock automatique.

## 24. Annexe : Threat model mock

Bien que le mock soit utilise en dev/test/staging, il merite une analyse de threat model :

### Attaques externes

- **SSRF** : Mock ne fetch PAS les photos (juste les hashs URLs). Pas de risque SSRF.
- **Prompt injection** : Mock ne consume PAS les `incident_circumstances` au sens LLM. Aucun risque injection. Sprint 29 reel doit gerer.
- **Denial of Service** : limit 12 photos cote schema, latency simulee bornee. Mock ne peut pas etre charge a couler le service.

### Attaques internes

- **Cache poisoning par developpeur** : developpeur pourrait modifier `DAMAGE_PATTERNS` pour produire prix faux. Mitigation : code review + tests.
- **Backdoor seed** : developpeur pourrait ajouter exception `if (seed === MAGIC_VALUE) return BACKDOORED_OUTPUT`. Mitigation : code review + property-based testing.

### Risques operationnels

- **Drift patterns vs reality** : ANELEC barème evolue. Mitigation : revue annuelle des `DAMAGE_PATTERNS` (Sprint 28).
- **Mock utilise en prod par erreur** : env var mal configuree. Mitigation : alerting si `IA_ESTIMATION_PROVIDER=mock` en prod (Tache 5.2.4).

## 25. Annexe : Migration plan vers Sprint 29

Quand Sprint 29 viendra, voici la sequence detaillee de transition Mock -> Real :

### Etape 1 : Verify contract compatibility

```bash
# Run mock and real side-by-side on 100 fixtures
pnpm --filter @insurtech/repair test ia-estimation -- --grep="contract-comparison"
```

### Etape 2 : Deploy Real Sprint 29 implementation

```bash
# Sprint 29 Tache: implement SkaleanAiVisionClient body (replace placeholder 5.2.3)
git checkout -b sprint-29-skalean-ai-vision
# ... implement ...
git commit -m "feat(sprint-29): SkaleanAiVisionClient real implementation"
```

### Etape 3 : Canary 10%

```bash
# Update env
IA_ESTIMATION_PROVIDER=skalean_ai
IA_ESTIMATION_ROLLOUT_PERCENTAGE=10

# DI factory routes 10% to real
kubectl rollout restart deployment/api
```

### Etape 4 : Monitor 1 semaine

- Latency p95 < 30s ?
- Confidence scores distribution coherente avec mock ?
- Cost actual < budget Skalean AI Sprint 29 ?
- Technician acceptance rate >= mock baseline ?

### Etape 5 : 50%

```bash
IA_ESTIMATION_ROLLOUT_PERCENTAGE=50
```

### Etape 6 : 100% (Sprint 31)

```bash
IA_ESTIMATION_ROLLOUT_PERCENTAGE=100
```

### Etape 7 : Mock reste comme fallback

Le `MockIaEstimationClient` reste en code production pour fallback circuit breaker (decision-007 : rollback safety < 60s).

## 26. Annexe : Patterns avances utilises dans le mock

### 26.1 Strategy pattern via DamageType

`DAMAGE_PATTERNS[damageType]` est un dictionary de strategies pre-construites. Chaque `damageType` (string literal type) selectionne un set de templates. Avantage : ajout d'un nouveau type = ajout d'une entree, pas modification d'un switch.

### 26.2 Builder pattern dans buildOutput

`buildOutput()` construit l'output etape par etape :
1. Pricing parts (loop)
2. Labor calculation
3. Totals
4. Confidence
5. Warnings (conditional)
6. Final object literal

Cette decomposition rend le code testable et lisible.

### 26.3 Decorator pattern (futur Tache 5.2.8)

`CachedIaEstimationClient` (Tache 5.2.8) decorera `MockIaEstimationClient` :
```typescript
const cached = new CachedIaEstimationClient(redis, mock);
await cached.estimateDamages(input); // cache hit/miss
```

### 26.4 Adapter pattern (Sprint 29)

`SkaleanAiVisionClient` (Sprint 29) sera un adapter entre Skalean AI Vision HTTP API et l'interface `IaEstimationPhotosClient` :
```typescript
async estimateDamages(input) {
  const skaleanResponse = await this.httpClient.post('/api/v1/vision/estimate', input);
  return this.mapToIaEstimationOutput(skaleanResponse);
}
```

### 26.5 Null Object pattern (warnings)

Quand pas de warnings, le mock retourne `warnings: []` (array vide) plutot que `warnings: null`. Cela respecte le contract et evite les checks null cote consommateur.

### 26.6 Defensive copy (photos sort)

`[...input.photos].sort()` cree une copie triee SANS muter l'array original. Important si le caller reutilise l'input.

## 27. Annexe : Auto-suffisance verification

- [x] Tous les fichiers a creer sont nommes (section 4-5)
- [x] Code patterns complets fournis (section 6, 10 fichiers)
- [x] Tests exhaustifs fournis (section 7, 56+ tests)
- [x] Variables environnement listees (section 8)
- [x] Commandes shell sequentielles (section 9)
- [x] Criteres validation V1-V25 (section 10)
- [x] Edge cases 10 (section 11)
- [x] Conformite MA detaillee (section 12)
- [x] Conventions strictes rappelees (section 13)
- [x] Validation pre-commit complete (section 14)
- [x] Commit message Conventional Commits (section 15)
- [x] Workflow next step indique (section 16)
- [x] Annexes detaillent damage patterns + threat model + migration plan

Claude Code doit pouvoir implementer 5.2.2 sans relire B-20.

## 28. Resume executif

**Quoi** : `MockIaEstimationClient` deterministe implementant `IaEstimationPhotosClient` (Tache 5.2.1) avec damage patterns realistes MA + pricing ANELEC + 4 locales recommendations.

**Pourquoi** : Permettre flows downstream (Sprint 21-28) sans dependance Skalean AI Vision reel (decision-007 AI-defere). Tests deterministes essentiels pour CI green.

**Comment** : 10 fichiers TypeScript (6 source + 4 tests) ~1770 lignes total. MD5 hash drive pseudo-random pour determinisme.

**Validation** : 56+ tests unit (determinisme + damage types + pricing + locales + warnings + edge cases), coverage >= 90%.

**Effort** : 7h, P0 bloquant pour 5.2.3-5.2.12.

**Risque principal** : drift mock vs real Sprint 29. Mitigation : Tache 5.2.11 documente procedure comparaison 100 estimations + property-based testing Sprint 28.


## 29. Annexe : Tests de regression statistique (Sprint 28 candidat)

Pour valider que le mock produit des distributions statistiques realistic, voici un test suite candidat pour Sprint 28 hardening :

```typescript
// __tests__/statistical-distribution.spec.ts (Sprint 28)
import { describe, it, expect } from 'vitest';
import { MockIaEstimationClient } from '../mock-ia-estimation.client';
import { createInstantClock } from '../mock-clock';

describe('Statistical distribution validation', () => {
  const client = new MockIaEstimationClient(createInstantClock(), { minMs: 0, maxMs: 1 });

  it('damage type distribution uniform on random URLs (1000 samples)', async () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const out = await client.estimateDamages({
        photos: [`https://x.com/IMG_${i.toString().padStart(4, '0')}.jpg`],
        vehicle_data: { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' },
      });
      counts[out.damage_type_inferred!] = (counts[out.damage_type_inferred!] ?? 0) + 1;
    }
    // Each of 8 types should appear ~125 +/- 50 times
    Object.values(counts).forEach((c) => {
      expect(c).toBeGreaterThan(75);
      expect(c).toBeLessThan(175);
    });
    expect(Object.keys(counts).length).toBe(8);
  });

  it('confidence score mean is ~0.9 (1000 samples)', async () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      const out = await client.estimateDamages({
        photos: [`https://x.com/IMG_${i}.jpg`],
        vehicle_data: { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' },
      });
      sum += out.confidence_score;
    }
    const mean = sum / 1000;
    expect(mean).toBeGreaterThan(0.88);
    expect(mean).toBeLessThan(0.92);
  });

  it('total_cost Dacia Logan front collision mean ~ 7000-8000 MAD (1000 samples)', async () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      const out = await client.estimateDamages({
        photos: [`https://x.com/front_collision_${i}.jpg`],
        vehicle_data: { brand: 'Dacia', model: 'Logan', year: 2020, category: 'sedan' },
      });
      sum += (out.total_cost_estimate_min + out.total_cost_estimate_max) / 2;
    }
    const mean = sum / 1000;
    expect(mean).toBeGreaterThan(6000);
    expect(mean).toBeLessThan(9000);
  });
});
```

Ce test pack est OPTIONNEL pour Sprint 20 (Tache 5.2.2) mais REQUIS Sprint 28 hardening avant Sprint 29 swap.

## 30. Annexe : Code review checklist

Pour le PR review de cette tache :

### Correctness
- [ ] Tous les outputs passent `IaEstimationOutputSchema.parse()` (defense en profondeur)
- [ ] Aucun `Math.random()` ou source non-deterministe
- [ ] Hash MD5 inclut TOUS les champs input pertinents (photos triees + vehicle + circumstances + locale)
- [ ] `labor_min <= labor_max` toujours (swap si necessaire)
- [ ] `total_cost_min <= total_cost_max` toujours
- [ ] `confidence_score` clamp [0.85, 0.95]

### Performance
- [ ] Computational complexity O(N) ou N = nombre de photos
- [ ] Pas de boucles imbriquees couteuses
- [ ] `JSON.stringify` une seule fois par estimateDamages
- [ ] Cache key compute partage avec estimateDamages (eviter double hash)

### Maintainability
- [ ] Chaque fonction publique a un commentaire JSDoc
- [ ] Constants extraites (pas de magic numbers en plein milieu du code)
- [ ] Types stricts partout (no any, no unknown sans guard)
- [ ] DAMAGE_PATTERNS sont en `as const` ou immutable

### Tests
- [ ] Coverage >= 90% sur tous les fichiers
- [ ] Tests determinisme (4 minimum)
- [ ] Tests it.each sur enumerable patterns
- [ ] Tests edge cases (0 photos, 12 photos, marque inconnue)
- [ ] Tests locale (4 locales)

### Conventions
- [ ] No emoji (decision-006)
- [ ] No console.log (pino logger preferred)
- [ ] No any implicit ou explicit
- [ ] Imports order respecte
- [ ] Conventional Commits respecte

## 31. Annexe : Debugging tips

### "My test is flaky"

Possible causes :
1. Test utilise `new Date()` directement sans `MockClock` -> non-deterministe.
2. Test depend de `setTimeout` reel -> utilise `vi.useFakeTimers()` ou `createInstantClock`.
3. Test compare snapshot mais output contient `estimated_at` qui drift -> mock le clock.

### "Mock output ne match pas schema Zod"

Verifier :
1. `currency: 'MAD'` literal exact (pas 'mad' lowercase).
2. `interface_version: '2026-01-01'` exact.
3. `confidence_score` est `number` finite (pas NaN).
4. `labor_estimate.hours_minimum <= hours_maximum`.
5. `total_cost_estimate_min <= total_cost_estimate_max`.

### "Cache hit rate is 0%"

Verifier :
1. `getCacheKey()` produit meme key pour memes inputs (test determinisme).
2. Photos sont triees AVANT hash (`[...photos].sort()`).
3. `vehicle_data` est canonicalise (meme keys order via JSON.stringify).

### "Prices look way off"

Verifier :
1. `BRAND_MULTIPLIERS` contient la marque (sinon `DEFAULT_BRAND_MULTIPLIER = 1.30`).
2. `yearDepreciationFactor` retourne valeur correcte pour year input.
3. `CATEGORY_MULTIPLIERS` contient le category.
4. Seed variation +/- 10% peut produire prix legerement different test-a-test.

### "Locale recommendations missing"

Verifier :
1. `RECOMMENDATION_TEMPLATES[damageType][locale]` existe.
2. Fallback `'fr-MA'` si locale manquante (defense en profondeur).

## 32. Annexe : Liens vers documentation externe

- ANELEC barème 2025 : non public (acces equipe Skalean garage)
- ISO 3779 VIN format : https://www.iso.org/standard/52200.html
- Decision 007 AI-defere : `decisions/007-ai-3-deferred-sprints.md`
- Decision 008 data residency MA : `decisions/008-data-residency-maroc.md`
- B-20 meta-prompt : `meta-prompts/B-20-sprint-20-ia-estimation-photos.md`
- Sprint 19 Repair foundation : `meta-prompts/B-19-sprint-19-vertical-repair-foundation.md`

## 33. Annexe : Comparaison avec autres mocks du projet

| Mock | Sprint | Purpose | Determinisme | Pattern |
|------|--------|---------|--------------|---------|
| MockIaEstimationClient | 20 | IA vision photos | MD5 hash | Strategy + Builder |
| MockSkaleanAiMcpServer | 30 | MCP tools | Stub + canned responses | Adapter |
| MockSkySync | 31 | Agent Sky | Stub LLM | Adapter |
| MockPayCmiClient | 11 | CMI payment | Stub gateway | Adapter |
| MockWhatsAppClient | 9 | WhatsApp comm | Stub messages | Adapter |

Le `MockIaEstimationClient` se distingue par sa complexite (8 damage patterns + pricing par marque/annee/categorie + 4 locales) et son determinisme strict (MD5 seed). Les autres mocks sont generalement plus simples (canned responses).

Cette difference de complexite reflete l'importance critique de l'IA estimation dans la chaine sinistre (Sprint 21-28 dependent) et la necessite que le mock soit suffisamment realistic pour valider les flows downstream sans deception.

## 34. Annexe : Migration notes vers Sprint 29

Quand Sprint 29 viendra, voici les points d'attention specifiques pour preserver la coherence Mock <-> Real :

### 34.1 Fields que real DOIT respecter

- `interface_version: '2026-01-01'` (strict literal, Zod rejette autre)
- `provider: 'skalean_ai'` (discriminant)
- `currency: 'MAD'` (hardcoded)
- `confidence_score` dans [0, 1] (peut etre 0.40 si vraiment incertain)
- `damage_type_inferred` dans DAMAGE_TYPES OU null si ambigu

### 34.2 Fields que real peut diverger sans casser

- `latency_ms` : real sera 5000-30000ms, mock 1000-3000ms
- `recommendations` : real generera texte libre, mock utilise templates
- `warnings` : real peut avoir warnings differents (qualite photo, eclairage)
- `parts_needed[].name` : real peut suggerer pieces non listees dans mock patterns

### 34.3 Cross-check Mock vs Real Sprint 29 procedure

Tache 5.2.11 documente la procedure detaillee :

1. Selectionner 100 sinistres pilote Marrakech avec photos reelles
2. Pour chaque, executer Mock et Real
3. Comparer :
   - Damage type inferred : agreement >= 70% acceptable
   - Total cost mean : difference < 30% acceptable
   - Labor hours mean : difference < 25% acceptable
   - Confidence score mean : Mock ~0.9, Real ~0.85 (legerement plus disperse)
4. Si discrepance majeure, investiguer et eventuellement ajuster Mock patterns

### 34.4 Fallback Mock en cas Skalean AI down (Sprint 29 Tache 7.x)

```typescript
// Sprint 29 -- Circuit breaker pattern
@Injectable()
class IaEstimationFallbackClient implements IaEstimationPhotosClient {
  constructor(
    private readonly realClient: SkaleanAiVisionClient,
    private readonly mockClient: MockIaEstimationClient,
    private readonly circuitBreaker: CircuitBreaker,
  ) {}

  async estimateDamages(input) {
    if (this.circuitBreaker.isOpen()) {
      logger.warn('Skalean AI circuit open -- using Mock');
      const mockOutput = await this.mockClient.estimateDamages(input);
      return { ...mockOutput, warnings: [...mockOutput.warnings, 'Skalean AI unavailable -- mock fallback'] };
    }
    try {
      return await this.realClient.estimateDamages(input);
    } catch (err) {
      this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  provider = 'skalean_ai' as const;
  getCacheKey(input) { return this.realClient.getCacheKey(input); }
}
```

## 35. Annexe : Glossaire

| Terme | Definition |
|-------|------------|
| Seed | Valeur 32-bit deriv input via MD5 hash |
| Pseudo-deterministic | Comportement aleatoire-apparente mais reproductible avec meme seed |
| Damage pattern | Template predefinit de damages + parts + labor pour un damage_type |
| Brand multiplier | Coefficient applique au base_price selon marque vehicle |
| Year depreciation | Coefficient applique selon age vehicle |
| Category multiplier | Coefficient applique selon vehicle category (sedan/suv/...) |
| Hourly rate | Taux horaire labor (350 MAD baseline) |
| Confidence score | Indicateur fiabilite IA [0, 1] |
| MAD | Moroccan Dirham (currency) |
| OEM | Original Equipment Manufacturer |
| Aftermarket | Pieces non-OEM, generalement moins cheres |

---

**Fin du prompt task-5.2.2-mock-ia-estimation-client-deterministic.md.**

Densite : cible 100-150 ko atteinte
Code : 10 fichiers complets
Tests : 56+ cas
Criteres : V1-V25
Edge cases : 10
Annexes : 17-35
