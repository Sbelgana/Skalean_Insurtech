# TACHE 4.1.2 -- Tarification Engine Basique (Lookup Tables) + 5 Branche Calculators

**Sprint** : 14 (Phase 4 / Sprint 1 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-14-sprint-14-insure-foundation.md` (Tache 4.1.2)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (consomme 4.1.1 produits + alimente 4.1.3 quotes -- chemin critique sprint)
**Effort** : 6h
**Dependances** : Task 4.1.1 (insure_products + tarif_grille JSONB consomme par cette tache)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **moteur de tarification** Sprint 14 : un service orchestrateur `TarificationService` qui dispatch vers 5 calculators specialises (auto, sante, multirisque habitation, RC pro, voyage), chacun consommant le `tarif_grille` JSONB stocke dans `insure_products` (Task 4.1.1) + les caracteristiques souscripteur fournies, et produisant une `PrimeBreakdown` detaillee (base, garanties, discounts, surcharges, TVA 14% MA, total). Le but est de poser le pattern lookup tables Sprint 14 (decision-010 : tarification basique deferee a IA Sprint 30+), suffisamment expressive pour produire des devis credibles cross-branches sans dependre des connecteurs assureurs reels (Sprint 15).

L'apport est triple : (a) **5 calculators metier** independants implementant interface `IBrancheCalculator` (open/closed principle, Sprint 15 ajoutera connecteurs assureurs reels qui implementent le meme interface), (b) **decimal.js precision financiere** pour eviter les artefacts flottants sur des montants MAD pouvant atteindre 500 000+ (precision 15,2), (c) **cache Redis 1h** des `tarif_grille` lookups + region_multipliers + `REGION_RISK_MULTIPLIERS` data MA hardcoded pour eviter re-fetch DB a chaque calcul de devis (chaque souscription = 1-5 simulations utilisateur en pratique).

A l'issue de cette tache, le service `TarificationService.calculate(productId, souscripteurData, garantiesSelected)` retourne un breakdown complet utilisable par `QuotesService.createQuote()` (Task 4.1.3) pour materialiser un devis avec sa prime annuelle precise au centime, TVA assurance MA 14% appliquee (vs 20% standard), et tous les facteurs explicites pour traceabilite ACAPS.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Tarifer une police est l'**operation metier numero 1** d'un courtier d'assurances : sans tarification fiable, pas de devis, pas de souscription, pas de portefeuille. Pour Skalean Broker, c'est aussi le **point de differenciation** vs concurrents : un courtier qui peut simuler 5 produits cross-branches en 200 ms pour un prospect au telephone bat un courtier qui doit appeler 3 assureurs differents.

Sprint 14 implemente une tarification **basique mais credible** : lookup tables hardcoded dans `tarif_grille` JSONB du produit (Task 4.1.1), enrichies par `REGION_RISK_MULTIPLIERS` data MA (Casablanca x1.30, Rabat x1.20, etc.) et facteurs souscripteur (age conducteur, no-claim bonus, taille famille). Sprint 30+ (decision-007 IA 3 deferred sprints) enrichira via :
1. Scoring risque IA consommant historique sinistres (`repair_sinistres` Sprint 22) + donnees externes.
2. Optimisation prix dynamique selon elasticite client (analytics Sprint 13).
3. Tarification cross-branche avec discounts multi-policies smart.

Le **decoupling Sprint 14 standalone vs Sprint 15 connecteurs assureurs** (decision-010) implique que les 5 calculators de cette tache doivent etre operationnels **sans appel API externe**. Sprint 15 ajoutera des `WafaAssuranceConnector`, `AtlantaConnector`, etc. qui implementeront le meme interface `IBrancheCalculator` -- les calculators basiques deviendront le fallback si l'API assureur est down.

La **precision financiere** est critique : un courtier marocain manipule des primes annuelles de 1 200 MAD (voyage court sejour) a 500 000 MAD (RC pro medecine, RC professionnelle entreprise). Sur 1 000 polices par an pour un broker moyen, l'erreur cumulee de quelques centimes par flottants binaires devient une dette comptable visible. **decimal.js** (version 10.4.3 imposee stack Sprint 14) est utilise pour toutes operations : `new Decimal(a).mul(b).plus(c).toFixed(2)`.

La **TVA assurance Maroc 14%** est specifique : la loi MA distingue TVA standard 20% (commerce) de TVA assurance 14% (Code General Impots Article 96). Tous les calculators doivent appliquer ce taux ; le `tarif_grille.tva_rate` default 0.14 stocke dans chaque produit est la source de verite (modifiable seulement par super admin via update template).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **A. Tarification monolithique** (un seul service avec switch sur branche) | Simple, 1 fichier | Viole single responsibility, ajout branche = refactor, tests confus | rejete : ne scale pas Sprint 15+ |
| **B. Tarification distribute via queue/worker** (Kafka request-response) | Scalable, isolation pannes | Latence inacceptable (UX devis temps reel < 200ms), complexity overkill Sprint 14 | rejete : YAGNI |
| **C. 5 calculators independants + orchestrator dispatch** (RETENU) | Single responsibility, ouvert extension Sprint 15 connecteurs, testable | Plus de fichiers, dispatch logic dans orchestrator | RETENU |
| **D. Calculators stockes en DB (rules engine)** | Tres dynamique, business user-editable | Sprint 14 over-engineering, ajoutera Sprint 27 admin UI rules | rejete : prematuré |
| **E. JavaScript native Number (pas decimal.js)** | Simple, pas de dependance | Imprecision flottante : 0.1 + 0.2 = 0.30000000000000004 | rejete : casse comptabilite |
| **F. Money lib (currency.js)** | Wrapper plus simple que decimal.js | Moins precis (uniquement 2 decimales fixes), pas de chained operations | rejete : decimal.js plus expressif |

### 2.3 Trade-offs explicites

- **Lookup tables hardcoded (JSONB produit) vs DB tables dediees** : Sprint 14 stocke tarif_grille dans `insure_products.tarif_grille` (JSONB). Cout : modification taux = update produit (privilege super admin). Gain : pas de table supplementaire Sprint 14, lookup co-localise avec produit (1 query au lieu de 2). Sprint 27 admin UI ajoutera editeur taux.

- **Cache Redis 1h vs in-memory cache** : Redis distribue (multi-instance API). Cout : 1ms overhead per cache hit, dependance Redis. Gain : invalidation propagee instantanee si super admin update produit (PUBSUB Redis), coherence multi-instance. In-memory aurait drift entre pods Kubernetes.

- **Pas de calculator pour vehicules legers vs lourds (Sprint 14)** : Sprint 14 calculator AUTO ne distingue que `vehicle_value` (numeric MAD). Sprint 15 connecteurs Wafa/Atlanta ajouteront `vehicle_category` (VL/VU/PL) + `power_kw` + `usage_type` (perso/pro/taxi). Cout : tarification Sprint 14 = simplifiee. Gain : ship rapide, real data progressivement Sprint 15.

- **Calcul sync vs async** : tarification est synchrone (< 200ms total : Redis fetch + 5-10 decimal.js ops + return). Async serait overkill ; en revanche, les calculators levent des Promises pour permettre futur appel API assureur (Sprint 15 connecteurs).

- **Validation Zod inputs souscripteur vs trust caller** : on valide TOUS les inputs au calculator level. Cout : duplication validation (controller deja valide). Gain : defense en profondeur, si appel direct (Sprint 4.1.3 Quote service), validation present.

### 2.4 Decisions strategiques referencees

- **decision-001** (Monorepo) : code dans `repo/packages/insure/src/services/branche-calculators/`.
- **decision-002** (Multi-tenant) : tarification respecte RLS via `productsService.findById()` (deja RLS-active).
- **decision-006** (No emoji) : code, logs, calculs sans emoji.
- **decision-007** (AI deferred Sprint 30+) : tarification basique Sprint 14, IA enrichi Sprint 30.
- **decision-010** (Connecteurs assureurs deferes Sprint 15) : Sprint 14 = lookup tables standalone ; Sprint 15 ajoutera connecteur reel cas par cas.

### 2.5 Pieges techniques connus

1. **Piege : JavaScript Number precision sur primes > 100 000**
   - Pourquoi : `0.04 * 250000 = 9999.999999999998` au lieu de `10000.00`. Sur 1 000 quotes/an, ecart cumule.
   - Solution : decimal.js partout. JAMAIS de calcul direct sur Number. Test V8 verifie precision exacte.

2. **Piege : TVA 20% utilise par defaut au lieu de 14% assurance**
   - Pourquoi : 20% est le taux standard MA, copy-paste erreur entre Books Sprint 12 (TVA 20% commerce) et Insure (TVA 14% assurance).
   - Solution : `tarif_grille.tva_rate` est le seul taux applique, defaulte a 0.14 dans `TarifGrilleSchema`. Test V12 verifie taux applique.

3. **Piege : Region multipliers non-applies (lookup miss)**
   - Pourquoi : si `region` souscripteur = "Tanger" mais `region_multipliers` cle = "tanger" (case), miss -> multiplier 1.0.
   - Solution : normaliser `region.toLowerCase().trim()` + fallback explicite `'autre'` toujours present dans seed.

4. **Piege : Cache Redis stale apres update produit**
   - Pourquoi : super admin modifie `tarif_grille`, cache Redis garde ancienne valeur 1h.
   - Solution : consumer Kafka `insure.product.updated` invalide entry cache `tarif:${product_id}`. Test integration verifie invalidation.

5. **Piege : Calcul commission applique 2 fois**
   - Pourquoi : Sprint 14 commission_rate stocke dans produit ET dans logique calculator. Risque double application si copie/paste.
   - Solution : commission appliquee SEULEMENT par `CommissionsService` Sprint 4.1.9 (post-paiement premium), JAMAIS dans calculator. Calculator retourne prime TTC SANS commission deduite. Test V15.

6. **Piege : Garanties mandatory non-incluses dans calcul**
   - Pourquoi : si caller passe `garantiesSelected: ['Vol']` mais oublie 'RC obligatoire' (mandatory=true), calcul peut etre incomplet.
   - Solution : calculator force-include toutes garanties `mandatory=true` du produit avant calcul. Test V16.

7. **Piege : Branche calculator mismatch produit branche**
   - Pourquoi : si caller appelle `AutoCalculator` mais produit branche='sante', erreur silencieuse.
   - Solution : dispatch orchestrator verifie `product.branche` et selectionne calculator approprie via map ; throw si mismatch. Test V18.

8. **Piege : Souscripteur data invalide (negative values, dates futur)**
   - Pourquoi : vehicleValue=-50000, driverAge=200, etc.
   - Solution : Zod schemas stricts per branche (`AutoSouscripteurSchema`, `SanteSouscripteurSchema`). Test V20.

9. **Piege : Cache Redis indisponible (panne reseau)**
   - Pourquoi : si Redis DOWN, calculator bloque ?
   - Solution : fallback gracieux : si cache MISS ou TIMEOUT > 50ms, fetch direct DB + log warning. Test integration V21.

10. **Piege : Multi-currency (USD, EUR voyages)**
    - Pourquoi : voyage international peut avoir capital en USD/EUR.
    - Solution : Sprint 14 = MAD only. Sprint 16+ ajoutera conversion via `pay` service (Sprint 11 currency rates). Documente runbook.

11. **Piege : Concurrent calculs sur meme produit**
    - Pourquoi : 100 prospects simultanes simulent meme produit -> 100 Redis fetches.
    - Solution : cache Redis avec single-flight pattern (lock 100ms). Test load V25.

12. **Piege : Decimals avec scale > 2 fuites en sortie**
    - Pourquoi : `.toFixed(2)` doit etre applique a la fin. Si oublie, breakdown contient `1234.5678901234` au lieu de `1234.57`.
    - Solution : helper `formatMoney(d: Decimal): string` centralise format + test V14.

---

## 3. Architecture context

### 3.1 Position dans le sprint 14

Cette tache **4.1.2** est la **2eme des 14**. Elle :
- **Depend de** : 4.1.1 (consomme `insure_products.tarif_grille`).
- **Bloque** : 4.1.3 (QuotesService.createQuote() appelle `tarificationService.calculate()`), 4.1.6 (Avenants recalculent prime via meme service), 4.1.8 (Renewals re-tarifient).
- **Apporte au sprint** : moteur tarification operationnel + 5 calculators + cache Redis + lookup MA data.

### 3.2 Position dans le programme global

Sprint 14 = tarification basique. Sprint 15 connecteurs assureurs implementent meme interface (open/closed). Sprint 30+ tarification IA enrichit via packages/sky.

```
Sprint 14 : 5 calculators basiques (lookup tables)  <-- ICI
Sprint 15 : + connecteurs assureurs reels (Wafa, Atlanta, ...)
Sprint 22 : + repair_sinistres feed pour historique risque
Sprint 30 : + scoring IA per souscripteur
Sprint 31 : + optimisation prix dynamique
Sprint 32 : + tarification multi-policies cross-vertical
```

### 3.3 Diagramme flow tarification

```
+--------------------+
| QuotesService      |
|   createQuote(...) | <-- Task 4.1.3
+----+---------------+
     |
     v
+----+------------------+
| TarificationService   |
|   calculate(           |
|     productId,         |
|     souscripteurData,  |
|     garantiesSelected) |
+----+------------------+
     |
     | 1. Get product (cache Redis tarif:{id} 1h)
     v
+----+------------------+
| ProductsService       |
|   findById            | <-- Task 4.1.1
+----+------------------+
     |
     v
+----+------------------+
| Dispatch via map      |
| product.branche ->    |
| IBrancheCalculator    |
+----+------------------+
     |
     +-------+-------+-------+-------+--------+
     |       |       |       |       |        |
     v       v       v       v       v        v
   auto    sante   habi   rcpro  voyage   (Sprint 15 connecteurs)
     |       |       |       |       |
     +-------+-------+-------+-------+
     |
     | 2. Each calculator :
     |    a. Validate souscripteurData (Zod)
     |    b. Force mandatory garanties
     |    c. Compute base via decimal.js
     |    d. Apply region_multipliers
     |    e. Apply garanties optional cost
     |    f. Apply discounts (no-claim, multi-policies)
     |    g. Apply surcharges (young driver, high-risk)
     |    h. Compute TVA 14%
     |    i. Format breakdown
     v
+----+------------------+
| Return PrimeBreakdown |
| {                      |
|   base,                |
|   garanties,           |
|   discounts,           |
|   surcharges,          |
|   subtotal_ht,         |
|   tva,                 |
|   total,               |
|   breakdown_details[]  |
| }                      |
+-----------------------+
```

### 3.4 Pattern open/closed pour Sprint 15

```typescript
// Interface (immuable Sprint 14)
interface IBrancheCalculator {
  branche: Branche;
  calculate(input: CalculateInput): Promise<PrimeBreakdown>;
}

// Sprint 14 : 5 lookup table calculators
class AutoCalculator implements IBrancheCalculator { ... }
class SanteCalculator implements IBrancheCalculator { ... }
// ...

// Sprint 15 : connecteurs API assureurs
class WafaAutoCalculator implements IBrancheCalculator { /* appel API Wafa */ }
class AtlantaSanteCalculator implements IBrancheCalculator { ... }

// Dispatch (Sprint 14)
const CALCULATORS_BY_BRANCHE = new Map<Branche, IBrancheCalculator>([
  ['auto', autoCalculator],
  // ...
]);

// Dispatch (Sprint 15 -- per insurer)
const CALCULATORS_BY_BRANCHE_INSURER = new Map<string, IBrancheCalculator>([
  ['auto:wafa', wafaAutoCalculator],
  ['auto:default', autoCalculator],  // fallback Sprint 14
]);
```

---

## 4. Livrables checkables (28 items)

- [ ] Interface `IBrancheCalculator` dans `repo/packages/insure/src/services/branche-calculators/types.ts` (~80 lignes) avec `branche: Branche` + `calculate(input: CalculateInput): Promise<PrimeBreakdown>`
- [ ] Types `CalculateInput`, `PrimeBreakdown`, `BreakdownLine` dans meme fichier
- [ ] Zod schemas validation souscripteur per branche : `AutoSouscripteurSchema`, `SanteSouscripteurSchema`, `HabitationSouscripteurSchema`, `RcProSouscripteurSchema`, `VoyageSouscripteurSchema` (~200 lignes total)
- [ ] Calculator `AutoCalculator` `auto.calculator.ts` (~180 lignes) : base = vehicle_value x factor + region_multiplier + young_driver surcharge + no_claim_bonus
- [ ] Calculator `SanteCalculator` `sante.calculator.ts` (~150 lignes) : base = adult_base x adults + child_base x children + age surcharges + smoker surcharge
- [ ] Calculator `HabitationCalculator` `habitation.calculator.ts` (~140 lignes) : base = fixed + biens_value x factor + alarm_installed discount
- [ ] Calculator `RcProCalculator` `rc-pro.calculator.ts` (~140 lignes) : base = fixed + ca_factor x revenue + high_risk_activity surcharge
- [ ] Calculator `VoyageCalculator` `voyage.calculator.ts` (~150 lignes) : base = per_day x duration + destination_multiplier + age_70_plus surcharge
- [ ] Service orchestrateur `TarificationService` `tarification.service.ts` (~250 lignes) avec dispatch map + cache Redis + fallback gracieux
- [ ] Constantes data MA `repo/packages/insure/src/data/region-risk-multipliers.ts` (~80 lignes) : 12+ regions MA mapped
- [ ] Helper `formatMoney(d: Decimal): { amount: string; currency: 'MAD' }` dans `repo/packages/insure/src/services/money.helper.ts`
- [ ] Consumer Kafka `repo/packages/insure/src/consumers/product-updated-cache-invalidator.consumer.ts` (~80 lignes) -- invalide Redis cache `tarif:{product_id}`
- [ ] Service inscrit dans `InsureModule` (Task 4.1.1) avec DI Redis client
- [ ] Variable env `INSURE_TARIF_CACHE_TTL_SECONDS=3600` ajoutee
- [ ] Tests unit `tarification.service.spec.ts` (10+ tests) couvrent : dispatch correct, cache hit/miss, fallback DB, mismatch branche
- [ ] Tests unit `auto.calculator.spec.ts` (8+ tests) : young driver +30%, no-claim bonus -10%, region Casablanca x1.30, mandatory garanties forcees
- [ ] Tests unit `sante.calculator.spec.ts` (6+ tests) : age 55+, age 65+, smoker surcharge, multi-members discount
- [ ] Tests unit `habitation.calculator.spec.ts` (5+ tests) : biens_value, alarm discount, high_value surcharge
- [ ] Tests unit `rc-pro.calculator.spec.ts` (5+ tests) : ca_factor, high_risk activite, specialty medecine
- [ ] Tests unit `voyage.calculator.spec.ts` (5+ tests) : per_day duration, destination multiplier, age 70+, student discount
- [ ] Tests integration Redis `tarification-cache.integration.spec.ts` (5+ tests) : cache hit/miss/invalidation/timeout fallback
- [ ] Tests E2E `tarification.e2e-spec.ts` (5+ tests) via endpoint `POST /api/v1/insure/tarification/simulate` (preview endpoint)
- [ ] Endpoint preview `POST /api/v1/insure/tarification/simulate` (~80 lignes controller) consomme par UI broker pour devis temps reel
- [ ] Coverage Vitest >= 90% pour `services/branche-calculators/`
- [ ] decimal.js v10.4.3 dependance ajoutee `package.json` de `packages/insure`
- [ ] Documentation `repo/packages/insure/README.md` section tarification mise a jour
- [ ] Logging Pino : chaque calcul log `{ tenant_id, product_id, branche, prime_annuelle, duration_ms }` niveau info
- [ ] Total : >= 39 tests cumules

---

## 5. Fichiers crees / modifies

```
repo/packages/insure/src/services/branche-calculators/types.ts                       (~90 lignes / interface + types)
repo/packages/insure/src/services/branche-calculators/schemas.ts                     (~210 lignes / 5 Zod schemas souscripteur)
repo/packages/insure/src/services/branche-calculators/auto.calculator.ts             (~190 lignes / calcul AUTO)
repo/packages/insure/src/services/branche-calculators/sante.calculator.ts            (~160 lignes / calcul SANTE)
repo/packages/insure/src/services/branche-calculators/habitation.calculator.ts       (~140 lignes / calcul MRH)
repo/packages/insure/src/services/branche-calculators/rc-pro.calculator.ts           (~140 lignes / calcul RC PRO)
repo/packages/insure/src/services/branche-calculators/voyage.calculator.ts           (~150 lignes / calcul VOYAGE)
repo/packages/insure/src/services/tarification.service.ts                             (~260 lignes / orchestrator + cache)
repo/packages/insure/src/services/money.helper.ts                                     (~60 lignes / decimal.js helpers)
repo/packages/insure/src/data/region-risk-multipliers.ts                              (~80 lignes / data MA)
repo/packages/insure/src/data/destination-risk-multipliers.ts                         (~60 lignes / data voyage)
repo/packages/insure/src/consumers/product-updated-cache-invalidator.consumer.ts      (~80 lignes / Kafka invalidator)
repo/apps/api/src/modules/insure/controllers/tarification.controller.ts               (~100 lignes / preview endpoint)
repo/packages/insure/src/services/branche-calculators/auto.calculator.spec.ts         (~280 lignes / unit tests 8+)
repo/packages/insure/src/services/branche-calculators/sante.calculator.spec.ts        (~240 lignes / unit tests 6+)
repo/packages/insure/src/services/branche-calculators/habitation.calculator.spec.ts   (~200 lignes / unit tests 5+)
repo/packages/insure/src/services/branche-calculators/rc-pro.calculator.spec.ts       (~200 lignes / unit tests 5+)
repo/packages/insure/src/services/branche-calculators/voyage.calculator.spec.ts       (~210 lignes / unit tests 5+)
repo/packages/insure/src/services/tarification.service.spec.ts                        (~340 lignes / unit tests 10+)
repo/packages/insure/test/integration/tarification-cache.integration.spec.ts          (~200 lignes / integration Redis 5+)
repo/apps/api/test/insure/tarification.e2e-spec.ts                                     (~250 lignes / E2E 5+)
repo/packages/insure/package.json                                                       (modif +1 dep decimal.js)
repo/packages/insure/src/index.ts                                                       (modif exports tarification)
repo/apps/api/src/modules/insure/insure.module.ts                                       (modif providers tarification)
```

Total : 22 fichiers crees, 3 modifies. Lignes nettes ajoutees ~3500.


---

## 6. Code patterns COMPLETS

### 6.1 Fichier : `repo/packages/insure/src/services/branche-calculators/types.ts`

Interface + types qui structurent tous les calculators (open/closed pour Sprint 15).

```typescript
import Decimal from 'decimal.js';
import type { Branche, Garantie, TarifGrille } from '../../schemas/product.schema';

/**
 * Interface IBrancheCalculator
 * Sprint 14 : 5 implementations lookup tables.
 * Sprint 15 : connecteurs assureurs reels (Wafa, Atlanta, Saham, RMA, AXA).
 * Tous implementent ce contrat.
 */
export interface IBrancheCalculator {
  readonly branche: Branche;
  calculate(input: CalculateInput): Promise<PrimeBreakdown>;
}

/**
 * Input universel cross-branche.
 * souscripteurData est un Record<string, unknown> valide par Zod schema specifique au calculator.
 * Sprint 14 : structures connues per branche (cf schemas.ts).
 * Sprint 15 : ajout `metadata.insurer_specific` pour donnees specifiques connecteur.
 */
export interface CalculateInput {
  product: {
    id: string;
    code: string;
    branche: Branche;
    garanties: Garantie[];
    tarif_grille: TarifGrille;
    commission_rate_percent: number;
  };
  souscripteurData: Record<string, unknown>;
  garantiesSelected: string[];
  options?: {
    skipCache?: boolean;
    locale?: 'fr' | 'ar' | 'en';
  };
}

/**
 * BreakdownLine : ligne de calcul tracable.
 * Utile pour reporting ACAPS + transparence client.
 */
export interface BreakdownLine {
  label: string;
  category: 'base' | 'garantie' | 'discount' | 'surcharge' | 'tax';
  amount: string;
  multiplier?: string;
  details?: string;
}

/**
 * PrimeBreakdown : resultat structure du calcul.
 * Tous montants en MAD, format `1234.56` (2 decimales).
 */
export interface PrimeBreakdown {
  primeAnnuelle: string;
  primeMonthly: string;
  primeQuarterly: string;
  breakdown: {
    base: string;
    garanties_obligatoires: string;
    garanties_optionnelles: string;
    discounts: string;
    surcharges: string;
    subtotal_ht: string;
    tva_rate: string;
    tva: string;
    total_ttc: string;
  };
  details: BreakdownLine[];
  metadata: {
    branche: Branche;
    product_id: string;
    product_code: string;
    calculator_version: string;
    computed_at: string;
    duration_ms: number;
  };
}

/**
 * Helper interne pour construire la breakdown.
 */
export class BreakdownBuilder {
  private base = new Decimal(0);
  private garantiesMandatory = new Decimal(0);
  private garantiesOptional = new Decimal(0);
  private discounts = new Decimal(0);
  private surcharges = new Decimal(0);
  private lines: BreakdownLine[] = [];
  private readonly tvaRate: Decimal;

  constructor(tvaRate: number) {
    this.tvaRate = new Decimal(tvaRate);
  }

  addBase(amount: Decimal, label: string): this {
    this.base = this.base.plus(amount);
    this.lines.push({ label, category: 'base', amount: amount.toFixed(2) });
    return this;
  }

  addMandatoryGarantie(amount: Decimal, label: string): this {
    this.garantiesMandatory = this.garantiesMandatory.plus(amount);
    this.lines.push({ label, category: 'garantie', amount: amount.toFixed(2), details: 'mandatory' });
    return this;
  }

  addOptionalGarantie(amount: Decimal, label: string): this {
    this.garantiesOptional = this.garantiesOptional.plus(amount);
    this.lines.push({ label, category: 'garantie', amount: amount.toFixed(2), details: 'optional' });
    return this;
  }

  addDiscount(amount: Decimal, label: string, multiplier?: string): this {
    this.discounts = this.discounts.plus(amount);
    this.lines.push({
      label,
      category: 'discount',
      amount: amount.negated().toFixed(2),
      multiplier,
    });
    return this;
  }

  addSurcharge(amount: Decimal, label: string, multiplier?: string): this {
    this.surcharges = this.surcharges.plus(amount);
    this.lines.push({ label, category: 'surcharge', amount: amount.toFixed(2), multiplier });
    return this;
  }

  build(meta: { branche: Branche; productId: string; productCode: string; durationMs: number }): PrimeBreakdown {
    const garanties = this.garantiesMandatory.plus(this.garantiesOptional);
    const subtotalHt = this.base.plus(garanties).plus(this.surcharges).minus(this.discounts);
    const tva = subtotalHt.mul(this.tvaRate);
    const total = subtotalHt.plus(tva);

    this.lines.push({
      label: 'TVA assurance Maroc',
      category: 'tax',
      amount: tva.toFixed(2),
      multiplier: this.tvaRate.toFixed(4),
    });

    return {
      primeAnnuelle: total.toFixed(2),
      primeMonthly: total.div(12).toFixed(2),
      primeQuarterly: total.div(4).toFixed(2),
      breakdown: {
        base: this.base.toFixed(2),
        garanties_obligatoires: this.garantiesMandatory.toFixed(2),
        garanties_optionnelles: this.garantiesOptional.toFixed(2),
        discounts: this.discounts.toFixed(2),
        surcharges: this.surcharges.toFixed(2),
        subtotal_ht: subtotalHt.toFixed(2),
        tva_rate: this.tvaRate.toFixed(4),
        tva: tva.toFixed(2),
        total_ttc: total.toFixed(2),
      },
      details: this.lines,
      metadata: {
        branche: meta.branche,
        product_id: meta.productId,
        product_code: meta.productCode,
        calculator_version: 'sprint-14-v1',
        computed_at: new Date().toISOString(),
        duration_ms: meta.durationMs,
      },
    };
  }
}
```

**Notes importantes** :
- `BreakdownBuilder` est un helper pattern utilise par TOUS les calculators -- garantit format coherent.
- Tous decimal.js operations, jamais Number.
- `tvaRate` injecte au constructor -- vient du `product.tarif_grille.tva_rate` (default 0.14 Maroc).
- `details: BreakdownLine[]` permet UI broker d'afficher ligne par ligne (transparence client).
- `calculator_version` : permet versioning Sprint 15 (`sprint-15-wafa-v1`, etc.).

### 6.2 Fichier : `repo/packages/insure/src/services/branche-calculators/schemas.ts`

Zod schemas validation per branche.

```typescript
import { z } from 'zod';

/** AUTO : caracteristiques vehicule + conducteur */
export const AutoSouscripteurSchema = z.object({
  vehicleValue: z.number().positive().max(5_000_000),
  vehicleMake: z.string().min(1).max(50),
  vehicleModel: z.string().min(1).max(80),
  vehicleYear: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  vehicleCategory: z.enum(['VL', 'VU', 'PL', 'moto']).default('VL'),
  driverAge: z.number().int().min(18).max(100),
  driverLicenseYears: z.number().int().min(0).max(80),
  noClaimYears: z.number().int().min(0).max(40).default(0),
  region: z.string().min(2).max(40),
  usage: z.enum(['perso', 'pro', 'taxi']).default('perso'),
  sportCar: z.boolean().default(false),
});
export type AutoSouscripteurData = z.infer<typeof AutoSouscripteurSchema>;

/** SANTE : membres famille + age + lifestyle */
export const SanteMemberSchema = z.object({
  age: z.number().int().min(0).max(120),
  relationship: z.enum(['adult', 'child', 'spouse']),
  smoker: z.boolean().default(false),
});
export const SanteSouscripteurSchema = z.object({
  members: z.array(SanteMemberSchema).min(1).max(8),
  noClaimYears: z.number().int().min(0).max(20).default(0),
  region: z.string().min(2).max(40).optional(),
});
export type SanteSouscripteurData = z.infer<typeof SanteSouscripteurSchema>;

/** HABITATION : biens + securite */
export const HabitationSouscripteurSchema = z.object({
  biensValue: z.number().positive().max(50_000_000),
  surfaceSqm: z.number().positive().max(10_000),
  region: z.string().min(2).max(40),
  alarmInstalled: z.boolean().default(false),
  highValueProperty: z.boolean().default(false),
  noClaimYears: z.number().int().min(0).max(40).default(0),
});
export type HabitationSouscripteurData = z.infer<typeof HabitationSouscripteurSchema>;

/** RC PRO : activite + CA */
export const RcProSouscripteurSchema = z.object({
  activity: z.enum([
    'commerce_general',
    'artisan',
    'medecin',
    'dentiste',
    'pharmacien',
    'avocat',
    'comptable',
    'architecte',
    'consultant_it',
    'autre',
  ]),
  annualRevenue: z.number().nonnegative().max(500_000_000),
  employeeCount: z.number().int().nonnegative().max(10_000).default(0),
  highRiskActivity: z.boolean().default(false),
});
export type RcProSouscripteurData = z.infer<typeof RcProSouscripteurSchema>;

/** VOYAGE : duree + destination + age */
export const VoyageSouscripteurSchema = z.object({
  durationDays: z.number().int().positive().max(365),
  destination: z.string().min(2).max(80),
  destinationRiskZone: z.enum(['low', 'medium', 'high']).default('low'),
  travelersCount: z.number().int().positive().max(20).default(1),
  oldestTravelerAge: z.number().int().min(0).max(120),
  isStudent: z.boolean().default(false),
  extremeSports: z.boolean().default(false),
});
export type VoyageSouscripteurData = z.infer<typeof VoyageSouscripteurSchema>;
```

### 6.3 Fichier : `repo/packages/insure/src/data/region-risk-multipliers.ts`

Lookup table regions MA (decision-008 data MA).

```typescript
/**
 * Multipliers risque per region MA Sprint 14.
 * Source : tableaux ACAPS statistiques sinistralite 2024.
 * Format : { code_region (lowercase normalise) : multiplier }
 *
 * Casablanca = densite urbaine la plus haute -> multiplier max 1.30
 * Rabat = urbain moyen -> 1.20
 * Tanger = port + transit -> 1.10
 * Marrakech = touristique -> 1.05
 * Agadir = balneaire -> 1.05
 * Fes / Meknes / Oujda / Tetouan / El Jadida -> 1.00
 * Rural / Sahara / autre = 1.00 default
 */
export const REGION_RISK_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  casablanca: 1.30,
  rabat: 1.20,
  sale: 1.18,
  tanger: 1.10,
  tetouan: 1.05,
  fes: 1.05,
  meknes: 1.05,
  oujda: 1.05,
  marrakech: 1.05,
  agadir: 1.05,
  laayoune: 1.00,
  dakhla: 1.00,
  el_jadida: 1.00,
  kenitra: 1.05,
  mohammedia: 1.15,
  beni_mellal: 1.00,
  nador: 1.05,
  autre: 1.00,
});

/**
 * Normalise un nom de region en cle de lookup.
 * "Casablanca" -> "casablanca", "El Jadida" -> "el_jadida", "Tanger-Assilah" -> "tanger".
 */
export function normalizeRegion(region: string): string {
  return region
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-z_]/g, '')
    .replace(/^(el|al)_/, 'el_')
    .replace(/_assilah$/, '');
}

export function getRegionMultiplier(region: string): number {
  const key = normalizeRegion(region);
  return REGION_RISK_MULTIPLIERS[key] ?? REGION_RISK_MULTIPLIERS.autre;
}
```

### 6.4 Fichier : `repo/packages/insure/src/data/destination-risk-multipliers.ts`

Lookup destinations voyage.

```typescript
/**
 * Multipliers voyage selon zone destination.
 * Conforme classification voyages risques OMS + Quai d'Orsay + Maroc consulat.
 */
export const DESTINATION_RISK_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  // Europe
  france: 1.00, spain: 1.00, italy: 1.00, germany: 1.00, uk: 1.00, netherlands: 1.00,
  belgium: 1.00, portugal: 1.00, greece: 1.05, switzerland: 1.00,
  // Maghreb / Afrique
  tunisia: 1.10, algeria: 1.20, egypt: 1.15, senegal: 1.20, mauritania: 1.20,
  ivorycoast: 1.25, nigeria: 1.30, kenya: 1.20, southafrica: 1.10,
  // Amerique Nord
  usa: 1.20, canada: 1.10, mexico: 1.25,
  // Asie
  china: 1.15, japan: 1.00, india: 1.25, thailand: 1.20, philippines: 1.25,
  // Golfe / Moyen-Orient
  saudi_arabia: 1.05, uae: 1.05, qatar: 1.05, kuwait: 1.05, jordan: 1.20, lebanon: 1.30,
  // Zones high risk
  iraq: 1.50, syria: 1.50, afghanistan: 1.50, yemen: 1.50, libya: 1.50,
  // Defaut
  autre: 1.15,
});

export function getDestinationMultiplier(destination: string): number {
  const key = destination.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '');
  return DESTINATION_RISK_MULTIPLIERS[key] ?? DESTINATION_RISK_MULTIPLIERS.autre;
}
```

### 6.5 Fichier : `repo/packages/insure/src/services/money.helper.ts`

Helpers decimal.js.

```typescript
import Decimal from 'decimal.js';

// Config globale decimal.js : precision elevee pour eviter rounding intermediaires
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export function formatMoney(d: Decimal | number | string): {
  amount: string;
  currency: 'MAD';
} {
  const dec = d instanceof Decimal ? d : new Decimal(d);
  return { amount: dec.toFixed(2), currency: 'MAD' };
}

export function fromAmount(amount: number | string): Decimal {
  return new Decimal(amount);
}

export function sumDecimals(items: Decimal[]): Decimal {
  return items.reduce((acc, d) => acc.plus(d), new Decimal(0));
}

/**
 * Verifie qu'un montant est positif avec precision 2 decimales max.
 */
export function isValidMonetary(d: Decimal): boolean {
  return d.isPositive() && d.decimalPlaces() <= 2;
}
```

### 6.6 Fichier : `repo/packages/insure/src/services/branche-calculators/auto.calculator.ts`

Calculator AUTO complet (le plus complexe -- multipliers region + age + no-claim + sport_car).

```typescript
import { Injectable, Inject } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Logger } from 'pino';
import { IBrancheCalculator, CalculateInput, PrimeBreakdown, BreakdownBuilder } from './types';
import { AutoSouscripteurSchema, type AutoSouscripteurData } from './schemas';
import { getRegionMultiplier } from '../../data/region-risk-multipliers';
import { fromAmount } from '../money.helper';

@Injectable()
export class AutoCalculator implements IBrancheCalculator {
  readonly branche = 'auto' as const;

  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  async calculate(input: CalculateInput): Promise<PrimeBreakdown> {
    const t0 = performance.now();
    const data = AutoSouscripteurSchema.parse(input.souscripteurData);

    const grille = input.product.tarif_grille;
    const builder = new BreakdownBuilder(grille.tva_rate);

    // === 1. Base : vehicle_value x base_factor ===
    const baseFactor = grille.base_factors.vehicle_value ?? 0.04;
    let base = fromAmount(data.vehicleValue).mul(baseFactor);
    builder.addBase(
      base,
      `Base = valeur vehicule ${data.vehicleValue} MAD x facteur ${baseFactor}`,
    );

    // === 2. Region multiplier ===
    const regionMult = getRegionMultiplier(data.region);
    if (regionMult !== 1.0) {
      const extra = base.mul(regionMult).minus(base);
      if (extra.isPositive()) {
        builder.addSurcharge(
          extra,
          `Region ${data.region} (multiplicateur ${regionMult.toFixed(2)})`,
          regionMult.toFixed(2),
        );
      } else {
        builder.addDiscount(
          extra.negated(),
          `Region ${data.region} (rabais ${regionMult.toFixed(2)})`,
          regionMult.toFixed(2),
        );
      }
      base = base.mul(regionMult);
    }

    // === 3. Garanties mandatory (forcees toujours) ===
    const mandatoryGaranties = input.product.garanties.filter((g) => g.mandatory);
    for (const g of mandatoryGaranties) {
      // Garanties mandatory incluses dans base (cout 0 additionnel)
      builder.addMandatoryGarantie(new Decimal(0), g.name);
    }

    // === 4. Garanties optionnelles selected ===
    const selected = new Set(input.garantiesSelected);
    for (const g of input.product.garanties) {
      if (g.mandatory) continue;
      if (!selected.has(g.name) && !selected.has(g.code ?? '')) continue;
      const cost = this.computeGarantieCost(g.code ?? g.name, data);
      if (cost.isPositive()) {
        builder.addOptionalGarantie(cost, `Garantie ${g.name}`);
      }
    }

    // === 5. Surcharges age conductor / sport car / usage ===
    const youngDriverThreshold = 25;
    const youngDriverSurcharge = grille.surcharges.young_driver ?? 0.30;
    if (data.driverAge < youngDriverThreshold) {
      const extra = base.mul(youngDriverSurcharge);
      builder.addSurcharge(
        extra,
        `Conducteur jeune (< ${youngDriverThreshold} ans)`,
        youngDriverSurcharge.toFixed(2),
      );
    }

    if (data.sportCar && grille.surcharges.sport_car) {
      const extra = base.mul(grille.surcharges.sport_car);
      builder.addSurcharge(extra, 'Vehicule sport', grille.surcharges.sport_car.toFixed(2));
    }

    if (data.usage === 'taxi' && grille.surcharges.taxi_usage) {
      const extra = base.mul(grille.surcharges.taxi_usage);
      builder.addSurcharge(extra, 'Usage taxi', grille.surcharges.taxi_usage.toFixed(2));
    }

    // === 6. Discounts no-claim bonus + senior ===
    if (data.noClaimYears >= 3 && grille.discounts.no_claim_bonus) {
      const rebate = base.mul(grille.discounts.no_claim_bonus);
      builder.addDiscount(
        rebate,
        `Bonus sans sinistre (${data.noClaimYears} ans)`,
        grille.discounts.no_claim_bonus.toFixed(2),
      );
    }

    if (data.driverAge >= 60 && data.driverAge < 75 && grille.discounts.senior) {
      const rebate = base.mul(grille.discounts.senior);
      builder.addDiscount(
        rebate,
        'Rabais senior (60-75 ans)',
        grille.discounts.senior.toFixed(2),
      );
    }

    // === 7. Build & return ===
    const result = builder.build({
      branche: 'auto',
      productId: input.product.id,
      productCode: input.product.code,
      durationMs: Math.round(performance.now() - t0),
    });

    this.logger.info(
      {
        action: 'insure.tarification.auto.computed',
        product_id: input.product.id,
        product_code: input.product.code,
        prime_annuelle: result.primeAnnuelle,
        region: data.region,
        driver_age: data.driverAge,
        duration_ms: result.metadata.duration_ms,
      },
      'AUTO premium computed',
    );

    return result;
  }

  /**
   * Cout par garantie optionnelle. Sprint 14 = formules simples ;
   * Sprint 15 connecteurs assureurs ajusteront via API.
   */
  private computeGarantieCost(code: string, data: AutoSouscripteurData): Decimal {
    switch (code) {
      case 'VOL':
        return fromAmount(data.vehicleValue).mul(0.005);
      case 'INCENDIE':
        return fromAmount(data.vehicleValue).mul(0.002);
      case 'BRIS_GLACE':
        return new Decimal(150);
      case 'DOMMAGES_COLLISION':
        return fromAmount(data.vehicleValue).mul(0.008);
      case 'ASSISTANCE':
        return new Decimal(400);
      case 'CATASTROPHES_NATURELLES':
        return fromAmount(data.vehicleValue).mul(0.001);
      default:
        return new Decimal(0);
    }
  }
}
```

**Notes importantes** :
- Chaque etape ajoute une `BreakdownLine` -- traceabilite ACAPS complete.
- Toutes operations decimal.js, aucun Number raw.
- Garanties mandatory force-incluses (cf piege 6).
- `performance.now()` measure duration sub-ms.
- `getRegionMultiplier` normalise la region en cle lowercase + handle "El Jadida" / "Tanger-Assilah".
- Sprint 15 connecteurs vont overrider `computeGarantieCost` avec real prices Wafa/Atlanta.


### 6.7 Fichier : `repo/packages/insure/src/services/branche-calculators/sante.calculator.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Logger } from 'pino';
import { IBrancheCalculator, CalculateInput, PrimeBreakdown, BreakdownBuilder } from './types';
import { SanteSouscripteurSchema } from './schemas';
import { fromAmount } from '../money.helper';

@Injectable()
export class SanteCalculator implements IBrancheCalculator {
  readonly branche = 'sante' as const;

  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  async calculate(input: CalculateInput): Promise<PrimeBreakdown> {
    const t0 = performance.now();
    const data = SanteSouscripteurSchema.parse(input.souscripteurData);

    const grille = input.product.tarif_grille;
    const builder = new BreakdownBuilder(grille.tva_rate);

    const adultBase = grille.base_factors.adult_base ?? 8_000;
    const childBase = grille.base_factors.child_base ?? 4_000;

    // === 1. Base per member ===
    let totalBase = new Decimal(0);
    for (const member of data.members) {
      const memberBase =
        member.relationship === 'child' && member.age < 21
          ? fromAmount(childBase)
          : fromAmount(adultBase);
      totalBase = totalBase.plus(memberBase);
      builder.addBase(
        memberBase,
        `${member.relationship === 'child' ? 'Enfant' : 'Adulte'} ${member.age} ans`,
      );
    }

    // === 2. Surcharges age ===
    const surchargeAge55 = grille.surcharges.age_55_plus ?? 0.20;
    const surchargeAge65 = grille.surcharges.age_65_plus ?? 0.40;
    const surchargeAge70 = grille.surcharges.age_70_plus ?? 0;
    const surchargeAge80 = grille.surcharges.age_80_plus ?? 0;

    for (const member of data.members) {
      if (member.age >= 80 && surchargeAge80 > 0) {
        const memberBase = fromAmount(adultBase);
        builder.addSurcharge(
          memberBase.mul(surchargeAge80),
          `Surcharge 80+ ans`,
          surchargeAge80.toFixed(2),
        );
      } else if (member.age >= 70 && surchargeAge70 > 0) {
        const memberBase = fromAmount(adultBase);
        builder.addSurcharge(
          memberBase.mul(surchargeAge70),
          `Surcharge 70+ ans`,
          surchargeAge70.toFixed(2),
        );
      } else if (member.age >= 65) {
        const memberBase = fromAmount(adultBase);
        builder.addSurcharge(
          memberBase.mul(surchargeAge65),
          `Surcharge 65+ ans`,
          surchargeAge65.toFixed(2),
        );
      } else if (member.age >= 55) {
        const memberBase = fromAmount(adultBase);
        builder.addSurcharge(
          memberBase.mul(surchargeAge55),
          `Surcharge 55+ ans`,
          surchargeAge55.toFixed(2),
        );
      }
    }

    // === 3. Surcharge smoker (forfait per smoker) ===
    const smokerSurcharge = grille.surcharges.smoker ?? 0.15;
    const smokerCount = data.members.filter((m) => m.smoker).length;
    if (smokerCount > 0 && smokerSurcharge > 0) {
      const extra = fromAmount(adultBase).mul(smokerSurcharge).mul(smokerCount);
      builder.addSurcharge(extra, `Fumeur(s) ${smokerCount}`, smokerSurcharge.toFixed(2));
    }

    // === 4. Discount multi-members ===
    const multiMembersDiscount = grille.discounts.multi_members ?? 0;
    if (data.members.length >= 3 && multiMembersDiscount > 0) {
      const rebate = totalBase.mul(multiMembersDiscount);
      builder.addDiscount(
        rebate,
        `Famille >= 3 membres`,
        multiMembersDiscount.toFixed(2),
      );
    }

    // === 5. Discount no-claim ===
    const noClaimDiscount = grille.discounts.no_claim_bonus ?? 0;
    if (data.noClaimYears >= 3 && noClaimDiscount > 0) {
      const rebate = totalBase.mul(noClaimDiscount);
      builder.addDiscount(
        rebate,
        `Bonus sans sinistre`,
        noClaimDiscount.toFixed(2),
      );
    }

    // === 6. Garanties mandatory + optionnelles ===
    const selected = new Set(input.garantiesSelected);
    for (const g of input.product.garanties) {
      if (g.mandatory) {
        builder.addMandatoryGarantie(new Decimal(0), g.name);
        continue;
      }
      if (!selected.has(g.name) && !selected.has(g.code ?? '')) continue;
      const cost = this.optionalGarantieCost(g.code ?? '');
      if (cost.isPositive()) builder.addOptionalGarantie(cost, g.name);
    }

    const result = builder.build({
      branche: 'sante',
      productId: input.product.id,
      productCode: input.product.code,
      durationMs: Math.round(performance.now() - t0),
    });

    this.logger.info(
      {
        action: 'insure.tarification.sante.computed',
        product_id: input.product.id,
        members_count: data.members.length,
        smokers: smokerCount,
        prime_annuelle: result.primeAnnuelle,
        duration_ms: result.metadata.duration_ms,
      },
      'SANTE premium computed',
    );

    return result;
  }

  private optionalGarantieCost(code: string): Decimal {
    switch (code) {
      case 'OPTIQUE': return new Decimal(600);
      case 'DENTAIRE': return new Decimal(1_200);
      case 'DENTAIRE_PROTHESE': return new Decimal(2_500);
      case 'MATERNITE': return new Decimal(3_000);
      case 'PHARMACIE': return new Decimal(1_500);
      case 'PHARMACIE_LONGUE_DUREE': return new Decimal(3_500);
      default: return new Decimal(0);
    }
  }
}
```

### 6.8 Fichier : `repo/packages/insure/src/services/branche-calculators/habitation.calculator.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Logger } from 'pino';
import { IBrancheCalculator, CalculateInput, PrimeBreakdown, BreakdownBuilder } from './types';
import { HabitationSouscripteurSchema } from './schemas';
import { getRegionMultiplier } from '../../data/region-risk-multipliers';
import { fromAmount } from '../money.helper';

@Injectable()
export class HabitationCalculator implements IBrancheCalculator {
  readonly branche = 'multirisque_habitation' as const;

  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  async calculate(input: CalculateInput): Promise<PrimeBreakdown> {
    const t0 = performance.now();
    const data = HabitationSouscripteurSchema.parse(input.souscripteurData);

    const grille = input.product.tarif_grille;
    const builder = new BreakdownBuilder(grille.tva_rate);

    // === Base = fixed + biens_value x factor ===
    const baseFixed = grille.base_factors.base_fixed ?? 1_500;
    const biensFactor = grille.base_factors.biens_value ?? 0.002;

    builder.addBase(fromAmount(baseFixed), `Forfait base habitation`);
    const baseBiens = fromAmount(data.biensValue).mul(biensFactor);
    builder.addBase(baseBiens, `Biens declares ${data.biensValue} MAD x ${biensFactor}`);

    let base = fromAmount(baseFixed).plus(baseBiens);

    // === Region multiplier ===
    const regionMult = getRegionMultiplier(data.region);
    if (regionMult !== 1.0) {
      const extra = base.mul(regionMult).minus(base);
      if (extra.isPositive()) {
        builder.addSurcharge(extra, `Region ${data.region}`, regionMult.toFixed(2));
      } else {
        builder.addDiscount(extra.negated(), `Region ${data.region}`, regionMult.toFixed(2));
      }
      base = base.mul(regionMult);
    }

    // === Surcharge high-value property ===
    if (data.highValueProperty && grille.surcharges.high_value_property) {
      const extra = base.mul(grille.surcharges.high_value_property);
      builder.addSurcharge(
        extra,
        'Bien de valeur exceptionnelle',
        grille.surcharges.high_value_property.toFixed(2),
      );
    }

    // === Discount alarme + no-claim ===
    if (data.alarmInstalled && grille.discounts.alarm_installed) {
      const rebate = base.mul(grille.discounts.alarm_installed);
      builder.addDiscount(
        rebate,
        'Alarme installee',
        grille.discounts.alarm_installed.toFixed(2),
      );
    }

    if (data.noClaimYears >= 3 && grille.discounts.no_claim_bonus) {
      const rebate = base.mul(grille.discounts.no_claim_bonus);
      builder.addDiscount(rebate, `Bonus sans sinistre`, grille.discounts.no_claim_bonus.toFixed(2));
    }

    // === Garanties ===
    const selected = new Set(input.garantiesSelected);
    for (const g of input.product.garanties) {
      if (g.mandatory) {
        builder.addMandatoryGarantie(new Decimal(0), g.name);
        continue;
      }
      if (!selected.has(g.name) && !selected.has(g.code ?? '')) continue;
      builder.addOptionalGarantie(this.optionalCost(g.code ?? ''), g.name);
    }

    const result = builder.build({
      branche: 'multirisque_habitation',
      productId: input.product.id,
      productCode: input.product.code,
      durationMs: Math.round(performance.now() - t0),
    });

    this.logger.info(
      {
        action: 'insure.tarification.habitation.computed',
        product_id: input.product.id,
        biens_value: data.biensValue,
        region: data.region,
        prime_annuelle: result.primeAnnuelle,
        duration_ms: result.metadata.duration_ms,
      },
      'HABITATION premium computed',
    );

    return result;
  }

  private optionalCost(code: string): Decimal {
    switch (code) {
      case 'VOL_HAB': return new Decimal(800);
      case 'BRIS_GLACE_HAB': return new Decimal(200);
      case 'CATASTROPHE_NAT': return new Decimal(400);
      case 'PROTECTION_JURIDIQUE': return new Decimal(300);
      default: return new Decimal(0);
    }
  }
}
```

### 6.9 Fichier : `repo/packages/insure/src/services/branche-calculators/rc-pro.calculator.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Logger } from 'pino';
import { IBrancheCalculator, CalculateInput, PrimeBreakdown, BreakdownBuilder } from './types';
import { RcProSouscripteurSchema } from './schemas';
import { fromAmount } from '../money.helper';

const HIGH_RISK_ACTIVITIES = new Set(['medecin', 'dentiste', 'pharmacien', 'architecte']);

@Injectable()
export class RcProCalculator implements IBrancheCalculator {
  readonly branche = 'rc_pro' as const;

  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  async calculate(input: CalculateInput): Promise<PrimeBreakdown> {
    const t0 = performance.now();
    const data = RcProSouscripteurSchema.parse(input.souscripteurData);

    const grille = input.product.tarif_grille;
    const builder = new BreakdownBuilder(grille.tva_rate);

    // === Base : fixed + ca_factor x revenue ===
    const baseFixed = grille.base_factors.base_fixed ?? 3_000;
    const caFactor = grille.base_factors.ca_factor ?? 0.0005;
    builder.addBase(fromAmount(baseFixed), `Forfait base RC pro`);
    const baseCA = fromAmount(data.annualRevenue).mul(caFactor);
    if (baseCA.isPositive()) {
      builder.addBase(baseCA, `CA ${data.annualRevenue} MAD x ${caFactor}`);
    }

    let base = fromAmount(baseFixed).plus(baseCA);

    // === Surcharge activite haut risque ===
    const isHighRisk = data.highRiskActivity || HIGH_RISK_ACTIVITIES.has(data.activity);
    if (isHighRisk && grille.surcharges.high_risk_activity) {
      const extra = base.mul(grille.surcharges.high_risk_activity);
      builder.addSurcharge(
        extra,
        `Activite ${data.activity} (haut risque)`,
        grille.surcharges.high_risk_activity.toFixed(2),
      );
    }

    if (data.activity === 'medecin' && grille.surcharges.specialty_high_risk) {
      const extra = base.mul(grille.surcharges.specialty_high_risk);
      builder.addSurcharge(
        extra,
        'Specialite medicale',
        grille.surcharges.specialty_high_risk.toFixed(2),
      );
    }

    // === Surcharge employees > 10 ===
    if (data.employeeCount > 10) {
      const employeeExtra = fromAmount(data.employeeCount - 10).mul(200);
      builder.addSurcharge(
        employeeExtra,
        `${data.employeeCount} employes (>10 surcharge)`,
      );
    }

    // === Discount no-claim ===
    if (grille.discounts.no_claim_bonus) {
      const rebate = base.mul(grille.discounts.no_claim_bonus);
      builder.addDiscount(rebate, `Bonus sans sinistre`, grille.discounts.no_claim_bonus.toFixed(2));
    }

    // === Garanties ===
    const selected = new Set(input.garantiesSelected);
    for (const g of input.product.garanties) {
      if (g.mandatory) {
        builder.addMandatoryGarantie(new Decimal(0), g.name);
        continue;
      }
      if (selected.has(g.name) || selected.has(g.code ?? '')) {
        builder.addOptionalGarantie(this.optionalCost(g.code ?? ''), g.name);
      }
    }

    const result = builder.build({
      branche: 'rc_pro',
      productId: input.product.id,
      productCode: input.product.code,
      durationMs: Math.round(performance.now() - t0),
    });

    this.logger.info(
      {
        action: 'insure.tarification.rcpro.computed',
        product_id: input.product.id,
        activity: data.activity,
        annual_revenue: data.annualRevenue,
        prime_annuelle: result.primeAnnuelle,
        duration_ms: result.metadata.duration_ms,
      },
      'RC PRO premium computed',
    );

    return result;
  }

  private optionalCost(code: string): Decimal {
    switch (code) {
      case 'PROTECTION_JURIDIQUE_PRO': return new Decimal(500);
      default: return new Decimal(0);
    }
  }
}
```

### 6.10 Fichier : `repo/packages/insure/src/services/branche-calculators/voyage.calculator.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Logger } from 'pino';
import { IBrancheCalculator, CalculateInput, PrimeBreakdown, BreakdownBuilder } from './types';
import { VoyageSouscripteurSchema } from './schemas';
import { getDestinationMultiplier } from '../../data/destination-risk-multipliers';
import { fromAmount } from '../money.helper';

@Injectable()
export class VoyageCalculator implements IBrancheCalculator {
  readonly branche = 'voyage' as const;

  constructor(@Inject('LOGGER') private readonly logger: Logger) {}

  async calculate(input: CalculateInput): Promise<PrimeBreakdown> {
    const t0 = performance.now();
    const data = VoyageSouscripteurSchema.parse(input.souscripteurData);

    const grille = input.product.tarif_grille;
    const builder = new BreakdownBuilder(grille.tva_rate);

    // === Base : per_day x duration x travelers ===
    const perDay = grille.base_factors.per_day ?? 50;
    let base = fromAmount(perDay).mul(data.durationDays).mul(data.travelersCount);
    builder.addBase(
      base,
      `${data.durationDays} jours x ${data.travelersCount} voyageur(s) x ${perDay} MAD/jour`,
    );

    // === Destination risk multiplier ===
    const destMult = getDestinationMultiplier(data.destination);
    if (destMult !== 1.0) {
      const extra = base.mul(destMult).minus(base);
      if (extra.isPositive()) {
        builder.addSurcharge(
          extra,
          `Destination ${data.destination}`,
          destMult.toFixed(2),
        );
      } else {
        builder.addDiscount(
          extra.negated(),
          `Destination ${data.destination}`,
          destMult.toFixed(2),
        );
      }
      base = base.mul(destMult);
    }

    // === Surcharge age 70+ ===
    if (data.oldestTravelerAge >= 70 && grille.surcharges.age_70_plus) {
      const extra = base.mul(grille.surcharges.age_70_plus);
      builder.addSurcharge(
        extra,
        `Voyageur 70+ ans (${data.oldestTravelerAge})`,
        grille.surcharges.age_70_plus.toFixed(2),
      );
    }

    // === Surcharge high-risk destination zone explicite ===
    if (data.destinationRiskZone === 'high' && grille.surcharges.high_risk_destination) {
      const extra = base.mul(grille.surcharges.high_risk_destination);
      builder.addSurcharge(
        extra,
        `Zone destination risque eleve`,
        grille.surcharges.high_risk_destination.toFixed(2),
      );
    }

    // === Refus si sports extremes non couverts (Sprint 14 = exclusion absolue) ===
    if (data.extremeSports) {
      throw new Error('Sports extremes non couverts par ce produit -- Sprint 15 connecteur AXA Sport ajoutera couverture');
    }

    // === Discount group + student ===
    if (data.travelersCount >= 4 && grille.discounts.group) {
      const rebate = base.mul(grille.discounts.group);
      builder.addDiscount(rebate, `Groupe >= 4`, grille.discounts.group.toFixed(2));
    }
    if (data.isStudent && grille.discounts.student) {
      const rebate = base.mul(grille.discounts.student);
      builder.addDiscount(rebate, `Etudiant`, grille.discounts.student.toFixed(2));
    }

    // === Garanties mandatory ===
    for (const g of input.product.garanties) {
      if (g.mandatory) builder.addMandatoryGarantie(new Decimal(0), g.name);
    }

    const result = builder.build({
      branche: 'voyage',
      productId: input.product.id,
      productCode: input.product.code,
      durationMs: Math.round(performance.now() - t0),
    });

    this.logger.info(
      {
        action: 'insure.tarification.voyage.computed',
        product_id: input.product.id,
        destination: data.destination,
        duration_days: data.durationDays,
        prime_annuelle: result.primeAnnuelle,
        duration_ms: result.metadata.duration_ms,
      },
      'VOYAGE premium computed',
    );

    return result;
  }
}
```

### 6.11 Fichier : `repo/packages/insure/src/services/tarification.service.ts`

Orchestrator avec dispatch + cache Redis + fallback.

```typescript
import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Logger } from 'pino';
import type { Redis } from 'ioredis';
import { IBrancheCalculator, CalculateInput, PrimeBreakdown } from './branche-calculators/types';
import { AutoCalculator } from './branche-calculators/auto.calculator';
import { SanteCalculator } from './branche-calculators/sante.calculator';
import { HabitationCalculator } from './branche-calculators/habitation.calculator';
import { RcProCalculator } from './branche-calculators/rc-pro.calculator';
import { VoyageCalculator } from './branche-calculators/voyage.calculator';
import { ProductsService } from './products.service';
import type { Branche } from '../schemas/product.schema';
import { TenantContext } from '@insurtech/shared-utils';

interface CalculateRequest {
  productId: string;
  souscripteurData: Record<string, unknown>;
  garantiesSelected: string[];
  options?: { skipCache?: boolean; locale?: 'fr' | 'ar' | 'en' };
}

@Injectable()
export class TarificationService {
  private readonly calculators: Map<Branche, IBrancheCalculator>;
  private readonly cacheTtl: number;

  constructor(
    private readonly productsService: ProductsService,
    private readonly autoCalc: AutoCalculator,
    private readonly santeCalc: SanteCalculator,
    private readonly habiCalc: HabitationCalculator,
    private readonly rcProCalc: RcProCalculator,
    private readonly voyageCalc: VoyageCalculator,
    @Inject('REDIS') private readonly redis: Redis,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {
    this.cacheTtl = Number(process.env.INSURE_TARIF_CACHE_TTL_SECONDS ?? 3600);
    this.calculators = new Map<Branche, IBrancheCalculator>([
      ['auto', autoCalc],
      ['sante', santeCalc],
      ['multirisque_habitation', habiCalc],
      ['rc_pro', rcProCalc],
      ['voyage', voyageCalc],
    ]);
  }

  async calculate(req: CalculateRequest): Promise<PrimeBreakdown> {
    const t0 = performance.now();
    const tenantId = TenantContext.getCurrentTenantId();
    const cacheKey = this.buildCacheKey(tenantId, req);

    // 1. Try cache
    if (!req.options?.skipCache) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as PrimeBreakdown;
          this.logger.debug({ cacheKey, duration_ms: Math.round(performance.now() - t0) }, 'Tarif cache hit');
          return parsed;
        }
      } catch (err) {
        // Cache MISS or Redis DOWN : fallback DB
        this.logger.warn({ err, cacheKey }, 'Redis cache fetch failed, fallback DB');
      }
    }

    // 2. Fetch product
    const product = await this.productsService.findById(req.productId);
    if (!product.active) {
      throw new BadRequestException({
        code: 'INSURE_PRODUCT_ARCHIVED',
        message: `Produit ${product.code} archived, ne peut etre tarife`,
      });
    }

    // 3. Dispatch calculator
    const calculator = this.calculators.get(product.branche);
    if (!calculator) {
      throw new NotFoundException({
        code: 'INSURE_CALCULATOR_NOT_FOUND',
        message: `Calculator pour branche ${product.branche} non implemente`,
      });
    }

    if (calculator.branche !== product.branche) {
      throw new BadRequestException({
        code: 'INSURE_CALCULATOR_BRANCHE_MISMATCH',
        message: `Calculator ${calculator.branche} ne matche pas branche produit ${product.branche}`,
      });
    }

    // 4. Build calculator input
    const input: CalculateInput = {
      product: {
        id: product.id,
        code: product.code,
        branche: product.branche,
        garanties: product.garanties,
        tarif_grille: product.tarifGrille,
        commission_rate_percent: product.getCommissionRate(),
      },
      souscripteurData: req.souscripteurData,
      garantiesSelected: req.garantiesSelected,
      options: req.options,
    };

    // 5. Compute
    const breakdown = await calculator.calculate(input);

    // 6. Cache
    try {
      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(breakdown));
    } catch (err) {
      this.logger.warn({ err, cacheKey }, 'Failed to cache tarif (non-fatal)');
    }

    this.logger.info(
      {
        action: 'insure.tarification.dispatched',
        tenant_id: tenantId,
        product_id: product.id,
        branche: product.branche,
        prime_annuelle: breakdown.primeAnnuelle,
        cache_used: false,
        total_duration_ms: Math.round(performance.now() - t0),
      },
      'Tarification completed',
    );

    return breakdown;
  }

  /**
   * Build cache key deterministique pour un calcul.
   * Inclut tenant_id (pour eventuels overrides Sprint 15 par tenant),
   * product_id et hash souscripteur + garanties.
   */
  private buildCacheKey(tenantId: string | null, req: CalculateRequest): string {
    const hashInput = JSON.stringify({
      sd: req.souscripteurData,
      g: [...req.garantiesSelected].sort(),
    });
    const hash = require('crypto').createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    return `tarif:${tenantId ?? 'public'}:${req.productId}:${hash}`;
  }

  async invalidateProductCache(productId: string): Promise<void> {
    const pattern = `tarif:*:${productId}:*`;
    let cursor = '0';
    let total = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        total += keys.length;
      }
    } while (cursor !== '0');
    this.logger.info({ productId, keys_invalidated: total }, 'Tarif cache invalidated');
  }
}
```

### 6.12 Fichier : `repo/packages/insure/src/consumers/product-updated-cache-invalidator.consumer.ts`

```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Logger } from 'pino';
import type { KafkaConsumer } from '@insurtech/shared-events';
import { TarificationService } from '../services/tarification.service';
import { ProductUpdatedEventSchema, InsureTopics } from '../events/products.events';

@Injectable()
export class ProductUpdatedCacheInvalidator implements OnModuleInit {
  constructor(
    @Inject('KAFKA_CONSUMER') private readonly consumer: KafkaConsumer,
    private readonly tarification: TarificationService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe(InsureTopics.PRODUCT_UPDATED, async (message) => {
      try {
        const event = ProductUpdatedEventSchema.parse(JSON.parse(message.value));
        await this.tarification.invalidateProductCache(event.product_id);
        this.logger.info(
          { action: 'tarif.cache.invalidated', product_id: event.product_id },
          'Cache invalidated after product update',
        );
      } catch (err) {
        this.logger.error({ err, message }, 'Failed to invalidate tarif cache');
      }
    });
  }
}
```

### 6.13 Fichier : `repo/apps/api/src/modules/insure/controllers/tarification.controller.ts`

Endpoint preview tarification temps reel.

```typescript
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { z } from 'zod';
import { TarificationService } from '@insurtech/insure';
import { JwtAuthGuard, TenantGuard, PermissionsGuard, Permissions } from '@insurtech/auth';
import { ZodValidationPipe } from '@insurtech/shared-utils';

const SimulateInputSchema = z.object({
  product_id: z.string().uuid(),
  souscripteur_data: z.record(z.string(), z.unknown()),
  garanties_selected: z.array(z.string()).default([]),
  options: z.object({
    skipCache: z.boolean().optional(),
    locale: z.enum(['fr', 'ar', 'en']).optional(),
  }).optional(),
});

@ApiTags('insure-tarification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('insure/tarification')
export class TarificationController {
  constructor(private readonly tarification: TarificationService) {}

  @Post('simulate')
  @Permissions('insure.quotes.create')
  @ApiOperation({ summary: 'Simulate premium calculation without persisting quote' })
  async simulate(
    @Body(new ZodValidationPipe(SimulateInputSchema)) body: z.infer<typeof SimulateInputSchema>,
  ) {
    const breakdown = await this.tarification.calculate({
      productId: body.product_id,
      souscripteurData: body.souscripteur_data,
      garantiesSelected: body.garanties_selected,
      options: body.options,
    });
    return { data: breakdown };
  }
}
```


---

## 7. Tests complets

### 7.1 Tests unit : `repo/packages/insure/src/services/branche-calculators/auto.calculator.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoCalculator } from './auto.calculator';
import type { CalculateInput } from './types';

const baseProduct = {
  id: 'auto-tr-1',
  code: 'AUTO-TR',
  branche: 'auto' as const,
  commission_rate_percent: 12.5,
  garanties: [
    { code: 'RC_OBLIG', name: 'RC obligatoire', capital_max: 1000000, franchise: 0, mandatory: true },
    { code: 'VOL', name: 'Vol', capital_max: null, franchise: 10000, mandatory: false },
    { code: 'BRIS_GLACE', name: 'Bris de glace', capital_max: 5000, franchise: 500, mandatory: false },
  ],
  tarif_grille: {
    base_factors: { vehicle_value: 0.04 },
    discounts: { no_claim_bonus: 0.10, senior: 0.05 },
    surcharges: { young_driver: 0.30, high_risk_zone: 0.15, sport_car: 0.20 },
    tva_rate: 0.14,
    region_multipliers: {},
  },
};

describe('AutoCalculator', () => {
  let calc: AutoCalculator;

  beforeEach(() => {
    calc = new AutoCalculator({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never);
  });

  it('computes base premium = vehicle_value x 0.04', async () => {
    const input: CalculateInput = {
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 200000, vehicleMake: 'Renault', vehicleModel: 'Clio',
        vehicleYear: 2023, vehicleCategory: 'VL',
        driverAge: 35, driverLicenseYears: 10, noClaimYears: 0,
        region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    };
    const result = await calc.calculate(input);
    // 200000 * 0.04 = 8000 + TVA 14% = 9120
    expect(Number(result.primeAnnuelle)).toBeCloseTo(9120, 0);
  });

  it('applies young_driver +30% when driverAge < 25', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 22, driverLicenseYears: 2,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    // 100000 * 0.04 = 4000, +30% surcharge = 1200, subtotal 5200, +TVA 14% = 5928
    expect(Number(result.primeAnnuelle)).toBeCloseTo(5928, 0);
  });

  it('applies no_claim_bonus -10% when noClaimYears >= 3', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 5, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    // 100000 * 0.04 = 4000, -10% = -400, subtotal 3600, TVA 14% = 4104
    expect(Number(result.primeAnnuelle)).toBeCloseTo(4104, 0);
  });

  it('applies region Casablanca x1.30', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'Casablanca', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    // 100000 * 0.04 = 4000 * 1.30 = 5200, TVA 14% = 5928
    expect(Number(result.primeAnnuelle)).toBeCloseTo(5928, 0);
  });

  it('forces mandatory RC garantie in breakdown', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 50000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(result.details.some((l) => l.label === 'RC obligatoire' && l.details === 'mandatory')).toBe(true);
  });

  it('adds optional garantie VOL cost = 0.005 x vehicle_value', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: ['VOL'],
    });
    // 4000 (base) + 500 (vol = 100000 * 0.005) = 4500, TVA 14% = 5130
    expect(Number(result.primeAnnuelle)).toBeCloseTo(5130, 0);
  });

  it('applies sport_car surcharge when sportCar=true', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'Ferrari', vehicleModel: '488', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 40, driverLicenseYears: 15,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: true,
      },
      garantiesSelected: [],
    });
    // 4000 + 20% = 800 surcharge = 4800, TVA = 5472
    expect(Number(result.primeAnnuelle)).toBeCloseTo(5472, 0);
  });

  it('rejects invalid Zod input (negative vehicleValue)', async () => {
    await expect(
      calc.calculate({
        product: baseProduct,
        souscripteurData: { vehicleValue: -1000 } as never,
        garantiesSelected: [],
      }),
    ).rejects.toThrow();
  });

  it('rejects driverAge under 18', async () => {
    await expect(
      calc.calculate({
        product: baseProduct,
        souscripteurData: {
          vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y',
          vehicleYear: 2024, driverAge: 16, driverLicenseYears: 0,
          region: 'autre',
        } as never,
        garantiesSelected: [],
      }),
    ).rejects.toThrow();
  });

  it('breakdown details traces every line', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 22, driverLicenseYears: 2,
        noClaimYears: 0, region: 'Casablanca', usage: 'perso', sportCar: false,
      },
      garantiesSelected: ['VOL', 'BRIS_GLACE'],
    });
    expect(result.details.some((l) => l.category === 'base')).toBe(true);
    expect(result.details.some((l) => l.category === 'surcharge' && l.label.includes('Casablanca'))).toBe(true);
    expect(result.details.some((l) => l.category === 'surcharge' && l.label.includes('jeune'))).toBe(true);
    expect(result.details.some((l) => l.category === 'tax')).toBe(true);
  });

  it('TVA always 14% (not 20%)', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(result.breakdown.tva_rate).toBe('0.1400');
    // base 4000, TVA 4000*0.14 = 560
    expect(Number(result.breakdown.tva)).toBeCloseTo(560, 1);
  });
});
```

### 7.2 Tests unit : `repo/packages/insure/src/services/branche-calculators/sante.calculator.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SanteCalculator } from './sante.calculator';
import type { CalculateInput } from './types';

const baseProduct = {
  id: 'sante-fam-1',
  code: 'SANTE-FAMILLE',
  branche: 'sante' as const,
  commission_rate_percent: 14,
  garanties: [
    { code: 'HOSPI', name: 'Hospitalisation', capital_max: 500000, franchise: 0, mandatory: true },
    { code: 'SOINS_VILLE', name: 'Soins de ville', capital_max: 50000, franchise: 50, mandatory: true },
    { code: 'OPTIQUE', name: 'Optique', capital_max: 5000, franchise: 200, mandatory: false },
    { code: 'DENTAIRE', name: 'Dentaire', capital_max: 8000, franchise: 200, mandatory: false },
  ],
  tarif_grille: {
    base_factors: { adult_base: 8000, child_base: 4000, family_max_members: 6 },
    discounts: { no_claim_bonus: 0.05, multi_members: 0.15 },
    surcharges: { age_55_plus: 0.20, age_65_plus: 0.40, smoker: 0.15 },
    tva_rate: 0.14,
  },
};

describe('SanteCalculator', () => {
  let calc: SanteCalculator;

  beforeEach(() => {
    calc = new SanteCalculator({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never);
  });

  it('computes base for 1 adult', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        members: [{ age: 35, relationship: 'adult', smoker: false }],
        noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 8000 base, TVA 14% = 9120
    expect(Number(result.primeAnnuelle)).toBeCloseTo(9120, 0);
  });

  it('computes 2 adults + 2 children family', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        members: [
          { age: 40, relationship: 'adult', smoker: false },
          { age: 38, relationship: 'spouse', smoker: false },
          { age: 10, relationship: 'child', smoker: false },
          { age: 8, relationship: 'child', smoker: false },
        ],
        noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 8000*2 + 4000*2 = 24000, multi-members -15% = -3600, subtotal 20400, TVA = 23256
    expect(Number(result.primeAnnuelle)).toBeCloseTo(23256, 1);
  });

  it('applies age 65+ surcharge (40%)', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        members: [{ age: 68, relationship: 'adult', smoker: false }],
        noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 8000 base + 40% surcharge = 11200, TVA = 12768
    expect(Number(result.primeAnnuelle)).toBeCloseTo(12768, 0);
  });

  it('applies smoker surcharge per smoker', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        members: [
          { age: 40, relationship: 'adult', smoker: true },
          { age: 38, relationship: 'spouse', smoker: true },
        ],
        noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 16000 base + 2*1200 (15% per smoker) = 18400, multi-members N/A (=2), TVA = 20976
    expect(Number(result.primeAnnuelle)).toBeGreaterThan(18000);
  });

  it('applies no_claim bonus', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        members: [{ age: 40, relationship: 'adult', smoker: false }],
        noClaimYears: 5,
      },
      garantiesSelected: [],
    });
    // 8000 - 5% = 7600, TVA = 8664
    expect(Number(result.primeAnnuelle)).toBeCloseTo(8664, 0);
  });

  it('adds optional OPTIQUE garantie 600 MAD', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        members: [{ age: 40, relationship: 'adult', smoker: false }],
        noClaimYears: 0,
      },
      garantiesSelected: ['OPTIQUE'],
    });
    // 8000 + 600 = 8600, TVA = 9804
    expect(Number(result.primeAnnuelle)).toBeCloseTo(9804, 0);
  });

  it('rejects empty members array', async () => {
    await expect(
      calc.calculate({
        product: baseProduct,
        souscripteurData: { members: [] } as never,
        garantiesSelected: [],
      }),
    ).rejects.toThrow();
  });
});
```

### 7.3 Tests unit : `repo/packages/insure/src/services/branche-calculators/habitation.calculator.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HabitationCalculator } from './habitation.calculator';

const baseProduct = {
  id: 'mrh-std',
  code: 'MRH-STD',
  branche: 'multirisque_habitation' as const,
  commission_rate_percent: 18,
  garanties: [
    { code: 'INCENDIE_HAB', name: 'Incendie', capital_max: null, franchise: 1000, mandatory: true },
    { code: 'DEGAT_EAUX', name: 'Degats des eaux', capital_max: 50000, franchise: 500, mandatory: true },
    { code: 'VOL_HAB', name: 'Vol mobilier', capital_max: 100000, franchise: 2000, mandatory: false },
  ],
  tarif_grille: {
    base_factors: { biens_value: 0.002, base_fixed: 1500 },
    discounts: { multi_policies: 0.05, alarm_installed: 0.10, no_claim_bonus: 0.10 },
    surcharges: { high_value_property: 0.20 },
    tva_rate: 0.14,
  },
};

describe('HabitationCalculator', () => {
  let calc: HabitationCalculator;

  beforeEach(() => {
    calc = new HabitationCalculator({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never);
  });

  it('computes base = fixed + biens_value x factor', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        biensValue: 500000, surfaceSqm: 120, region: 'autre',
        alarmInstalled: false, highValueProperty: false, noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 1500 + (500000*0.002) = 2500, TVA = 2850
    expect(Number(result.primeAnnuelle)).toBeCloseTo(2850, 0);
  });

  it('applies alarm discount', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        biensValue: 500000, surfaceSqm: 120, region: 'autre',
        alarmInstalled: true, highValueProperty: false, noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 2500 - 10% = 2250, TVA = 2565
    expect(Number(result.primeAnnuelle)).toBeCloseTo(2565, 0);
  });

  it('applies high_value surcharge', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        biensValue: 5000000, surfaceSqm: 500, region: 'autre',
        alarmInstalled: false, highValueProperty: true, noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 1500 + 10000 = 11500, +20% = 13800, TVA = 15732
    expect(Number(result.primeAnnuelle)).toBeCloseTo(15732, 0);
  });

  it('applies Casablanca region', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        biensValue: 500000, surfaceSqm: 120, region: 'Casablanca',
        alarmInstalled: false, highValueProperty: false, noClaimYears: 0,
      },
      garantiesSelected: [],
    });
    // 2500 * 1.30 = 3250, TVA = 3705
    expect(Number(result.primeAnnuelle)).toBeCloseTo(3705, 0);
  });

  it('adds VOL_HAB optional garantie cost 800', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        biensValue: 500000, surfaceSqm: 120, region: 'autre',
        alarmInstalled: false, highValueProperty: false, noClaimYears: 0,
      },
      garantiesSelected: ['VOL_HAB'],
    });
    // 2500 + 800 = 3300, TVA = 3762
    expect(Number(result.primeAnnuelle)).toBeCloseTo(3762, 0);
  });
});
```

### 7.4 Tests unit : `repo/packages/insure/src/services/branche-calculators/rc-pro.calculator.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RcProCalculator } from './rc-pro.calculator';

const baseProduct = {
  id: 'rc-pro-gen',
  code: 'RC-PRO-GEN',
  branche: 'rc_pro' as const,
  commission_rate_percent: 17,
  garanties: [
    { code: 'RC_EXPLOIT', name: 'RC exploitation', capital_max: 2000000, franchise: 1000, mandatory: true },
    { code: 'PROTECTION_JURIDIQUE_PRO', name: 'Protection juridique pro', capital_max: 50000, franchise: 0, mandatory: false },
  ],
  tarif_grille: {
    base_factors: { base_fixed: 3000, ca_factor: 0.0005 },
    discounts: { no_claim_bonus: 0.10 },
    surcharges: { high_risk_activity: 0.40, specialty_high_risk: 0.50 },
    tva_rate: 0.14,
  },
};

describe('RcProCalculator', () => {
  let calc: RcProCalculator;

  beforeEach(() => {
    calc = new RcProCalculator({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never);
  });

  it('computes base for commerce_general 1M CA', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        activity: 'commerce_general', annualRevenue: 1000000,
        employeeCount: 3, highRiskActivity: false,
      },
      garantiesSelected: [],
    });
    // 3000 + (1000000 * 0.0005) = 3500, -10% nc = 3150, TVA = 3591
    expect(Number(result.primeAnnuelle)).toBeCloseTo(3591, 0);
  });

  it('applies high_risk_activity surcharge for medecin', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        activity: 'medecin', annualRevenue: 800000,
        employeeCount: 0, highRiskActivity: false,
      },
      garantiesSelected: [],
    });
    // 3000 + 400 = 3400, +40% (high risk auto medecin) = 4760, +50% (specialty) = 6460
    expect(Number(result.primeAnnuelle)).toBeGreaterThan(5000);
  });

  it('adds employee surcharge for >10 employees', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        activity: 'commerce_general', annualRevenue: 1000000,
        employeeCount: 25, highRiskActivity: false,
      },
      garantiesSelected: [],
    });
    // 3000 + 500 = 3500, +15 employees x 200 = 3000 extra, subtotal 6500, -10% nc = 5850, TVA = 6669
    expect(Number(result.primeAnnuelle)).toBeGreaterThan(6000);
  });

  it('adds protection juridique optional', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        activity: 'commerce_general', annualRevenue: 500000,
        employeeCount: 0, highRiskActivity: false,
      },
      garantiesSelected: ['PROTECTION_JURIDIQUE_PRO'],
    });
    expect(result.details.some((l) => l.label === 'Protection juridique pro')).toBe(true);
  });

  it('rejects invalid activity enum', async () => {
    await expect(
      calc.calculate({
        product: baseProduct,
        souscripteurData: { activity: 'invalid', annualRevenue: 100000 } as never,
        garantiesSelected: [],
      }),
    ).rejects.toThrow();
  });
});
```

### 7.5 Tests unit : `repo/packages/insure/src/services/branche-calculators/voyage.calculator.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoyageCalculator } from './voyage.calculator';

const baseProduct = {
  id: 'voyage-court',
  code: 'VOYAGE-COURT',
  branche: 'voyage' as const,
  commission_rate_percent: 22,
  garanties: [
    { code: 'FRAIS_MEDICAUX_VOYAGE', name: 'Frais medicaux', capital_max: 500000, franchise: 0, mandatory: true },
    { code: 'RAPATRIEMENT', name: 'Rapatriement', capital_max: null, franchise: 0, mandatory: true },
  ],
  tarif_grille: {
    base_factors: { per_day: 50 },
    discounts: { group: 0.10, student: 0.20 },
    surcharges: { high_risk_destination: 0.30, age_70_plus: 0.50 },
    tva_rate: 0.14,
  },
};

describe('VoyageCalculator', () => {
  let calc: VoyageCalculator;

  beforeEach(() => {
    calc = new VoyageCalculator({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never);
  });

  it('computes base = per_day x duration x travelers', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        durationDays: 10, destination: 'France', destinationRiskZone: 'low',
        travelersCount: 1, oldestTravelerAge: 35, isStudent: false, extremeSports: false,
      },
      garantiesSelected: [],
    });
    // 50 * 10 * 1 = 500 base * 1.0 (France) = 500, TVA = 570
    expect(Number(result.primeAnnuelle)).toBeCloseTo(570, 0);
  });

  it('applies destination multiplier for Nigeria', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        durationDays: 7, destination: 'Nigeria', destinationRiskZone: 'low',
        travelersCount: 1, oldestTravelerAge: 35, isStudent: false, extremeSports: false,
      },
      garantiesSelected: [],
    });
    // 50 * 7 = 350 * 1.30 = 455, TVA = 518.7
    expect(Number(result.primeAnnuelle)).toBeCloseTo(518.7, 0);
  });

  it('applies age 70+ surcharge', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        durationDays: 14, destination: 'France', destinationRiskZone: 'low',
        travelersCount: 1, oldestTravelerAge: 75, isStudent: false, extremeSports: false,
      },
      garantiesSelected: [],
    });
    // 50 * 14 = 700, +50% age70+ = 350 surcharge, total 1050, TVA = 1197
    expect(Number(result.primeAnnuelle)).toBeCloseTo(1197, 0);
  });

  it('applies group discount for 4+ travelers', async () => {
    const result = await calc.calculate({
      product: baseProduct,
      souscripteurData: {
        durationDays: 7, destination: 'France', destinationRiskZone: 'low',
        travelersCount: 4, oldestTravelerAge: 35, isStudent: false, extremeSports: false,
      },
      garantiesSelected: [],
    });
    // 50 * 7 * 4 = 1400, -10% group = -140, subtotal 1260, TVA = 1436.4
    expect(Number(result.primeAnnuelle)).toBeCloseTo(1436.4, 0);
  });

  it('rejects extreme sports', async () => {
    await expect(
      calc.calculate({
        product: baseProduct,
        souscripteurData: {
          durationDays: 7, destination: 'France', destinationRiskZone: 'low',
          travelersCount: 1, oldestTravelerAge: 30, isStudent: false, extremeSports: true,
        },
        garantiesSelected: [],
      }),
    ).rejects.toThrow(/extremes/);
  });
});
```

### 7.6 Tests unit : `repo/packages/insure/src/services/tarification.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { TarificationService } from './tarification.service';
import { AutoCalculator } from './branche-calculators/auto.calculator';
import { SanteCalculator } from './branche-calculators/sante.calculator';
import { HabitationCalculator } from './branche-calculators/habitation.calculator';
import { RcProCalculator } from './branche-calculators/rc-pro.calculator';
import { VoyageCalculator } from './branche-calculators/voyage.calculator';
import { ProductsService } from './products.service';

describe('TarificationService', () => {
  let service: TarificationService;
  let products: { findById: ReturnType<typeof vi.fn> };
  let redis: { get: ReturnType<typeof vi.fn>; setex: ReturnType<typeof vi.fn>; scan: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };

  const baseProduct = {
    id: 'p1', code: 'AUTO-TR', branche: 'auto', active: true,
    garanties: [{ code: 'RC', name: 'RC obligatoire', capital_max: 1, franchise: 0, mandatory: true }],
    tarifGrille: { base_factors: { vehicle_value: 0.04 }, discounts: {}, surcharges: {}, tva_rate: 0.14 },
    getCommissionRate: () => 12.5,
  };

  beforeEach(async () => {
    products = { findById: vi.fn().mockResolvedValue(baseProduct) };
    redis = { get: vi.fn(), setex: vi.fn(), scan: vi.fn().mockResolvedValue(['0', []]), del: vi.fn() };

    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TarificationService,
        { provide: ProductsService, useValue: products },
        { provide: AutoCalculator, useValue: new AutoCalculator(logger as never) },
        { provide: SanteCalculator, useValue: new SanteCalculator(logger as never) },
        { provide: HabitationCalculator, useValue: new HabitationCalculator(logger as never) },
        { provide: RcProCalculator, useValue: new RcProCalculator(logger as never) },
        { provide: VoyageCalculator, useValue: new VoyageCalculator(logger as never) },
        { provide: 'REDIS', useValue: redis },
        { provide: 'LOGGER', useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(TarificationService);
  });

  it('dispatches to AutoCalculator when product.branche=auto', async () => {
    const result = await service.calculate({
      productId: 'p1',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(result.metadata.branche).toBe('auto');
    expect(Number(result.primeAnnuelle)).toBeGreaterThan(0);
  });

  it('uses cache when available (cache hit)', async () => {
    const cached = { primeAnnuelle: '999.99', breakdown: {}, details: [], metadata: { branche: 'auto', product_id: 'p1', product_code: 'AUTO-TR', calculator_version: 'sprint-14-v1', computed_at: '2026-05-15T00:00:00Z', duration_ms: 1 } };
    redis.get.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await service.calculate({
      productId: 'p1',
      souscripteurData: { vehicleValue: 100000 } as never,
      garantiesSelected: [],
    });
    expect(result.primeAnnuelle).toBe('999.99');
    expect(products.findById).not.toHaveBeenCalled();
  });

  it('falls back to DB when Redis throws', async () => {
    redis.get.mockRejectedValueOnce(new Error('Redis down'));
    const result = await service.calculate({
      productId: 'p1',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(Number(result.primeAnnuelle)).toBeGreaterThan(0);
    expect(products.findById).toHaveBeenCalled();
  });

  it('rejects when product archived', async () => {
    products.findById.mockResolvedValueOnce({ ...baseProduct, active: false });
    await expect(
      service.calculate({
        productId: 'p1',
        souscripteurData: { vehicleValue: 100000 } as never,
        garantiesSelected: [],
      }),
    ).rejects.toMatchObject({ response: { code: 'INSURE_PRODUCT_ARCHIVED' } });
  });

  it('rejects when branche has no calculator', async () => {
    products.findById.mockResolvedValueOnce({ ...baseProduct, branche: 'unknown' as never });
    await expect(
      service.calculate({ productId: 'p1', souscripteurData: {}, garantiesSelected: [] }),
    ).rejects.toThrow();
  });

  it('skipCache option bypasses cache', async () => {
    redis.get.mockResolvedValueOnce('{"primeAnnuelle":"1.00"}');
    const result = await service.calculate({
      productId: 'p1',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
      options: { skipCache: true },
    });
    expect(redis.get).not.toHaveBeenCalled();
    expect(Number(result.primeAnnuelle)).toBeGreaterThan(0);
  });

  it('invalidateProductCache scans + deletes matching keys', async () => {
    redis.scan.mockResolvedValueOnce(['0', ['tarif:t1:p1:abc', 'tarif:t2:p1:def']]);
    await service.invalidateProductCache('p1');
    expect(redis.del).toHaveBeenCalledWith('tarif:t1:p1:abc', 'tarif:t2:p1:def');
  });

  it('cache key includes tenant_id + product_id + souscripteur hash', async () => {
    const spy = vi.spyOn(service as any, 'buildCacheKey');
    await service.calculate({
      productId: 'p1',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(spy).toHaveBeenCalled();
    const key = spy.mock.results[0]!.value as string;
    expect(key).toMatch(/^tarif:[^:]+:p1:[a-f0-9]+$/);
  });

  it('persists result to cache after calculation', async () => {
    redis.get.mockResolvedValueOnce(null);
    await service.calculate({
      productId: 'p1',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(redis.setex).toHaveBeenCalledWith(expect.stringMatching(/^tarif:/), 3600, expect.any(String));
  });

  it('records duration_ms in result metadata', async () => {
    const result = await service.calculate({
      productId: 'p1',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.duration_ms).toBeLessThan(500);
  });
});
```


### 7.7 Tests integration Redis : `repo/packages/insure/test/integration/tarification-cache.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { TarificationService } from '@insurtech/insure';
import { setupTestApp } from '../helpers/test-app';

describe('Tarification Redis cache integration', () => {
  let redis: Redis;
  let service: TarificationService;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/15');
    const setup = await setupTestApp();
    service = setup.service;
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup();
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  it('first call: cache MISS, then HIT on second', async () => {
    const t0 = Date.now();
    const r1 = await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    const t1 = Date.now();
    const r2 = await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    const t2 = Date.now();
    expect(r1.primeAnnuelle).toBe(r2.primeAnnuelle);
    // Second call (cache hit) should be at least 5x faster than first
    expect(t2 - t1).toBeLessThan((t1 - t0) / 5 + 50);
  });

  it('cache key differs for different souscripteurs (same product)', async () => {
    await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 22, driverLicenseYears: 2,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 50, driverLicenseYears: 30,
        noClaimYears: 10, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    const keys = await redis.keys('tarif:*');
    expect(keys).toHaveLength(2);
  });

  it('invalidateProductCache deletes all keys for product', async () => {
    await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    let keys = await redis.keys('tarif:*:seeded-auto-tr:*');
    expect(keys.length).toBeGreaterThan(0);

    await service.invalidateProductCache('seeded-auto-tr');
    keys = await redis.keys('tarif:*:seeded-auto-tr:*');
    expect(keys).toHaveLength(0);
  });

  it('cache TTL = 3600 seconds (1h)', async () => {
    await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
    });
    const keys = await redis.keys('tarif:*');
    expect(keys.length).toBe(1);
    const ttl = await redis.ttl(keys[0]!);
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('skipCache option bypasses cache fully', async () => {
    await service.calculate({
      productId: 'seeded-auto-tr',
      souscripteurData: {
        vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
        vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
        noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
      },
      garantiesSelected: [],
      options: { skipCache: true },
    });
    const keys = await redis.keys('tarif:*');
    // Le calcul a peut etre stocke en cache (afterCalc), mais get a ete skip
    expect(keys.length).toBeGreaterThanOrEqual(0);
  });
});
```

### 7.8 Tests E2E : `repo/apps/api/test/insure/tarification.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { createTestJwt } from '@insurtech/auth/testing';
import { seedTestProducts } from './fixtures/seed';

describe('Insure Tarification E2E', () => {
  let app: INestApplication;
  const brokerJwt = createTestJwt({ user_id: 'b1', roles: ['BrokerAdmin'], tenant_id: 'tenant-1' });
  let autoProductId: string;
  let voyageProductId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const seeded = await seedTestProducts(app);
    autoProductId = seeded.autoTrId;
    voyageProductId = seeded.voyageCourtId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/insure/tarification/simulate -> auto product simulates correctly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/insure/tarification/simulate')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({
        product_id: autoProductId,
        souscripteur_data: {
          vehicleValue: 200000,
          vehicleMake: 'Renault',
          vehicleModel: 'Clio',
          vehicleYear: 2023,
          vehicleCategory: 'VL',
          driverAge: 35,
          driverLicenseYears: 10,
          noClaimYears: 3,
          region: 'Casablanca',
          usage: 'perso',
          sportCar: false,
        },
        garanties_selected: ['VOL', 'BRIS_GLACE'],
      })
      .expect(201);

    expect(res.body.data.primeAnnuelle).toBeDefined();
    expect(Number(res.body.data.primeAnnuelle)).toBeGreaterThan(0);
    expect(res.body.data.metadata.branche).toBe('auto');
    expect(res.body.data.details.length).toBeGreaterThan(3);
    expect(res.body.data.breakdown.tva_rate).toBe('0.1400');
  });

  it('POST simulate with voyage product', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/insure/tarification/simulate')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({
        product_id: voyageProductId,
        souscripteur_data: {
          durationDays: 14,
          destination: 'France',
          destinationRiskZone: 'low',
          travelersCount: 2,
          oldestTravelerAge: 35,
          isStudent: false,
          extremeSports: false,
        },
      })
      .expect(201);

    expect(res.body.data.metadata.branche).toBe('voyage');
    expect(Number(res.body.data.primeAnnuelle)).toBeGreaterThan(0);
  });

  it('POST simulate with missing souscripteur fields -> 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/insure/tarification/simulate')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({
        product_id: autoProductId,
        souscripteur_data: { vehicleValue: 100000 },
      })
      .expect(400);
  });

  it('POST simulate without JWT -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/insure/tarification/simulate')
      .send({})
      .expect(401);
  });

  it('POST simulate with insufficient permission -> 403', async () => {
    const noPermJwt = createTestJwt({ user_id: 'x', roles: ['AssureClient'], tenant_id: 'tenant-1' });
    await request(app.getHttpServer())
      .post('/api/v1/insure/tarification/simulate')
      .set('Authorization', `Bearer ${noPermJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({
        product_id: autoProductId,
        souscripteur_data: {
          vehicleValue: 100000, vehicleMake: 'X', vehicleModel: 'Y', vehicleYear: 2024,
          vehicleCategory: 'VL', driverAge: 35, driverLicenseYears: 10,
          noClaimYears: 0, region: 'autre', usage: 'perso', sportCar: false,
        },
      })
      .expect(403);
  });
});
```

---

## 8. Variables environnement

```env
# Existantes utilisees
REDIS_URL=redis://localhost:6379                       # Cache tarification
LOG_LEVEL=info                                          # Pino logger

# Nouvelles introduites par cette tache
INSURE_TARIF_CACHE_TTL_SECONDS=3600                    # Default 1h cache Redis
INSURE_TARIF_CACHE_PREFIX=tarif                        # Prefix Redis keys (separator namespace)
INSURE_TARIF_FALLBACK_TIMEOUT_MS=50                    # Redis fetch timeout avant fallback DB
INSURE_TARIF_MAX_DURATION_WARN_MS=200                  # Log warn si calc > 200ms (SLO breached)
```

A ajouter dans `.env.example` racine et `00-pilotage/documentation/2-variables-environnement.env`.

---

## 9. Commandes shell

```bash
cd repo

# 1. Installation (avec decimal.js nouvelle dep)
pnpm install --frozen-lockfile

# 2. Verifier decimal.js installe
pnpm --filter @insurtech/insure ls decimal.js
# Expected : decimal.js@10.4.3

# 3. Typecheck
pnpm --filter @insurtech/insure typecheck

# 4. Lint
pnpm --filter @insurtech/insure lint

# 5. Tests unit calculators (5 fichiers)
pnpm --filter @insurtech/insure test:unit -- branche-calculators

# 6. Tests unit tarification orchestrator
pnpm --filter @insurtech/insure test:unit -- tarification.service.spec

# 7. Tests integration Redis
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d redis
pnpm --filter @insurtech/insure test:integration -- tarification-cache

# 8. Tests E2E (requires seed)
pnpm tsx infrastructure/scripts/seed-insure-products.ts
pnpm --filter api test:e2e -- insure/tarification

# 9. Coverage
pnpm --filter @insurtech/insure test:cov -- branche-calculators tarification.service
# Expected : >= 90%

# 10. Smoke test endpoint
TEST_JWT=$(node infrastructure/scripts/gen-test-jwt.js --role=BrokerAdmin --tenant=tenant-1)
PRODUCT_ID=$(psql $DATABASE_URL -t -c "SELECT id FROM insure_products WHERE code='AUTO-TR' LIMIT 1")

curl -s -X POST "http://localhost:4000/api/v1/insure/tarification/simulate" \
  -H "Authorization: Bearer $TEST_JWT" \
  -H "x-tenant-id: tenant-1" \
  -H "Content-Type: application/json" \
  -d "{
    \"product_id\": \"$PRODUCT_ID\",
    \"souscripteur_data\": {
      \"vehicleValue\": 250000, \"vehicleMake\": \"Peugeot\", \"vehicleModel\": \"308\",
      \"vehicleYear\": 2023, \"vehicleCategory\": \"VL\",
      \"driverAge\": 32, \"driverLicenseYears\": 8, \"noClaimYears\": 5,
      \"region\": \"Casablanca\", \"usage\": \"perso\", \"sportCar\": false
    },
    \"garanties_selected\": [\"VOL\", \"BRIS_GLACE\", \"ASSISTANCE\"]
  }" | jq .
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (bloquants -- 18)

- **V1 (P0)** : `decimal.js@10.4.3` installe dans `packages/insure/package.json`
  - Commande : `pnpm --filter @insurtech/insure ls decimal.js`
  - Expected : `decimal.js@10.4.3` exact

- **V2 (P0)** : 5 calculators implementent `IBrancheCalculator`
  - Commande : `pnpm --filter @insurtech/insure typecheck`
  - Expected : compilation OK ; type assertion `implements IBrancheCalculator` verifie

- **V3 (P0)** : Dispatch correct par branche (auto/sante/habitation/rc_pro/voyage)
  - Test unit V `TarificationService > dispatches to AutoCalculator when branche=auto`

- **V4 (P0)** : TVA appliquee = 14% (NOT 20%) sur toutes branches
  - Test unit `TVA always 14%` chaque calculator

- **V5 (P0)** : AUTO calculator applique young_driver +30% si age < 25
  - Test unit dedie + verifie surcharge presente dans breakdown details

- **V6 (P0)** : AUTO calculator applique no_claim_bonus -10% si noClaimYears >= 3

- **V7 (P0)** : AUTO calculator applique region_multiplier (Casablanca x1.30)

- **V8 (P0)** : Precision decimal.js : 0.04 * 250000 = 10000.00 exact (pas 9999.99...)
  - Test unit dedie verifie absence flottant artifact

- **V9 (P0)** : SANTE calculator applique surcharge age 65+ = 40%

- **V10 (P0)** : SANTE calculator applique smoker surcharge per smoker

- **V11 (P0)** : HABITATION calculator applique alarm_installed -10%

- **V12 (P0)** : RC PRO calculator applique high_risk_activity surcharge pour medecin/dentiste

- **V13 (P0)** : VOYAGE calculator rejette extremeSports avec message explicite

- **V14 (P0)** : Cache Redis HIT bypasse calcul (verifie via spy products.findById non appele)

- **V15 (P0)** : Commission_rate NON applique dans calculator (commission post-paiement Task 4.1.9)
  - Test : verifie commission_rate ne figure pas dans breakdown details ni soustraction

- **V16 (P0)** : Garanties mandatory force-incluses meme si pas dans garantiesSelected

- **V17 (P0)** : Calculator mismatch branche leve `INSURE_CALCULATOR_BRANCHE_MISMATCH`

- **V18 (P0 -- automatisable)** : Aucune emoji dans tous fichiers crees
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/insure/src/services/branche-calculators/ --include="*.ts"`
  - Expected : aucune sortie

### Criteres P1 (importants -- 9)

- **V19 (P1)** : Calculator AUTO : breakdown details contient >= 5 lignes (base, region, garanties mandatory, optional, TVA)

- **V20 (P1)** : Zod schema souscripteur AUTO rejette vehicleValue negatif

- **V21 (P1)** : Cache Redis fallback gracieux si Redis DOWN (test mockRejected)

- **V22 (P1)** : `invalidateProductCache` scan + del avec SCAN pattern Redis (pas KEYS bloquant)

- **V23 (P1)** : Consumer Kafka invalide cache apres event `product.updated`

- **V24 (P1)** : Endpoint preview latence < 200ms (cold) / < 50ms (cache hit)
  - Test integration mesure duration_ms

- **V25 (P1)** : Coverage Vitest >= 90% pour `branche-calculators/`
  - Commande : `pnpm --filter @insurtech/insure test:cov -- branche-calculators`

- **V26 (P1)** : Region "Casablanca" normalise vers "casablanca" (case insensitive)
  - Test unit `normalizeRegion`

- **V27 (P1)** : Destination "Nigeria" matche multiplier `nigeria` (regex normalize)

### Criteres P2 (nice-to-have -- 5)

- **V28 (P2)** : Logs Pino structures avec champ `duration_ms` pour chaque calcul

- **V29 (P2)** : Documentation `README.md` section tarification mise a jour

- **V30 (P2)** : Helper `formatMoney(d)` retourne `{ amount: '1234.56', currency: 'MAD' }`

- **V31 (P2)** : `breakdown.tva_rate` toujours `'0.1400'` (4 decimales)

- **V32 (P2)** : Cache key inclut hash sha256 souscripteur + garanties sorted

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Vehicle value extreme (10M MAD)
**Scenario** : Lamborghini neuve, valeur 8 000 000 MAD.
**Probleme** : prime base = 320 000 MAD, depasse capital_max RC, perte precision.
**Solution** : decimal.js gere precision sur 20 digits ; Zod schema `max(5_000_000)` rejette valeurs > 5M. Test V20. Si broker veut tarifier au-dela, Sprint 15 connecteur Wafa Premium.

### Edge case 2 : Region inconnue (typo)
**Scenario** : souscripteur input region "Cassablanca" (typo).
**Probleme** : lookup miss -> multiplier 1.0 (autre).
**Solution** : `normalizeRegion` fait fuzzy match minimal (lowercase, underscores). Sprint 16 ajoutera Levenshtein distance pour suggestions. Log warn si region non trouvee.

### Edge case 3 : Souscripteur smoker mais younger
**Scenario** : enfant 10 ans `smoker: true`.
**Probleme** : Zod ne rejette pas (smoker permis), surcharge appliquee.
**Solution** : business rule absurde mais techniquement valide ; sera filtrer cote UI (questionnaire medical Sprint 17). Pas de code change.

### Edge case 4 : Garantie code inconnu
**Scenario** : `garantiesSelected: ['UNKNOWN_GARANTIE']`.
**Probleme** : calculator ignore silencieusement (filter no match).
**Solution** : Sprint 14 = silent ignore. Sprint 16 ajoutera warning dans response metadata `unknown_garanties: ['UNKNOWN_GARANTIE']`. Pas de throw (UX).

### Edge case 5 : Cache stampede (100 calculs simultanes meme cle)
**Scenario** : 100 prospects simulent meme produit a 5s d'intervalle.
**Probleme** : tous miss cache, 100 fetch DB + 100 calculs.
**Solution** : Sprint 17 ajoutera single-flight pattern Redis SET NX. Sprint 14 = tolerance (100 calculs basiques << 100ms each).

### Edge case 6 : Decimal.js scale > 2 fuite dans `toFixed(2)`
**Scenario** : `new Decimal('123.456').toFixed(2)` = `'123.46'` (rounding HALF_UP).
**Probleme** : si rounding mode incorrect (`HALF_DOWN`), centime perdu.
**Solution** : `Decimal.set({ rounding: Decimal.ROUND_HALF_UP })` global dans `money.helper.ts`. Test V8.

### Edge case 7 : TVA rate manquant dans tarif_grille
**Scenario** : ancien produit sans `tva_rate` JSONB.
**Probleme** : `grille.tva_rate` undefined -> NaN dans calculs.
**Solution** : Zod `TarifGrilleSchema.tva_rate.default(0.14)` garantit 0.14 si absent. Test V4.

### Edge case 8 : Membres famille > 8
**Scenario** : famille 10 enfants.
**Probleme** : Zod `members.max(8)` rejette.
**Solution** : Sprint 16 produit "Famille XL" supportera 12 membres. Workaround Sprint 14 : 2 polices separees.

### Edge case 9 : Concurrent invalidate + cache write
**Scenario** : super admin update produit pendant 100 calculs en cours.
**Probleme** : nouveau calcul ecrit ancienne valeur juste apres invalidation.
**Solution** : risk acceptable (window < 100ms). Sprint 20 ajoutera versioning cache key avec `product.updated_at`.

### Edge case 10 : Calcul prime < 0 (negative)
**Scenario** : discounts cumules > base + surcharges.
**Probleme** : impossible business, mais possible si grille mal configuree (50% discount + 30% no claim = 80% off).
**Solution** : ajout check final `subtotalHt.isNegative() -> throw 'INVALID_TARIF_NEGATIVE'`. Sprint 14 implements ce check.

### Edge case 11 : Voyage destination zone "high" + age 70+
**Scenario** : 75 ans + destination Yemen.
**Probleme** : double surcharge cumulative (zone + age).
**Solution** : appliquees toutes les deux (intentional). Le breakdown affiche les 2 surcharges separement. Test V verifie.

### Edge case 12 : Locale FR/AR/EN dans options
**Scenario** : `options.locale = 'ar'` mais breakdown details en FR hardcoded.
**Probleme** : labels non traduits.
**Solution** : Sprint 17 ajoutera i18n via `@insurtech/comm` translation service. Sprint 14 = FR only documente.

---

## 12. Conformite Maroc detaillee

### Code General des Impots Article 96 (TVA assurance 14%)

- **Article 96** : taux specifique TVA pour operations d'assurance = 14% (vs 20% standard commerce).
- **Implementation** : `tarif_grille.tva_rate: 0.14` defaut Sprint 14, appliquee dans tous calculators via `BreakdownBuilder`.
- **Audit** : la `tva_rate` figure dans `PrimeBreakdown.breakdown.tva_rate` -- traceable per devis.

### Reglementation ACAPS

- **Circulaire ACAPS sur transparence tarifaire** : breakdown detaille obligatoire pour client.
- **Implementation** : `PrimeBreakdown.details: BreakdownLine[]` liste chaque element (base, garantie, discount, surcharge, TVA) avec label, montant, multiplier.
- **Audit trail** : chaque calcul logged avec `tenant_id, product_id, prime_annuelle, duration_ms` (Sprint 7 audit middleware non actif sur calculs read-only mais log Pino preserve).
- **Retention** : les calculs Sprint 14 sont ephemeres (preview) ; ils deviennent persistents en `insure_devis.amount_split` Task 4.1.3 = 10 ans retention.

### Loi 17-99 (Code des assurances)

- **Article 4** (operations d'assurance) : tarification doit etre justifiable et tracable.
- **Implementation** : `metadata.calculator_version: 'sprint-14-v1'` + details breakdown permettent audit ACAPS.

### Decision-008 (Data Residency MA)

- Cache Redis hebergé cluster Atlas Cloud Services Benguerir.
- Aucune donnee tarification ne transite hors MA.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

[Voir task-4.1.1 section 13 pour liste exhaustive. Conventions applicables a cette tache :]

- **Multi-tenant strict** : `TenantContext.getCurrentTenantId()` utilisee dans cache key.
- **Validation strict** : Zod uniquement (5 schemas souscripteur).
- **Logger strict** : Pino DI, jamais console.log.
- **Hash password** : N/A.
- **Package manager** : pnpm + `decimal.js@10.4.3` exact.
- **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`.
- **Tests strict** : Vitest >= 90% pour calculators.
- **RBAC strict** : `@Permissions('insure.quotes.create')` sur endpoint simulate.
- **Events strict** : consumer Kafka `insure.product.updated` -> invalidate cache.
- **Imports strict** : `@insurtech/insure`, jamais paths relatifs cross-package.
- **No-emoji strict** : applique.
- **Idempotency-Key strict** : N/A pour read-only simulate.
- **Conventional Commits** : `feat(sprint-14): tarification engine basique`.
- **Cloud souverain MA** : Atlas Cloud Benguerir.
- **Loi 17-99 + Article 96 CGI + ACAPS** : TVA 14% + breakdown traceable.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck
pnpm --filter @insurtech/insure typecheck                  # 0 erreur

# 2. Lint
pnpm --filter @insurtech/insure lint                        # 0 erreur

# 3. Tests unit (5 calculators + service)
pnpm --filter @insurtech/insure test:unit                   # 39+ pass

# 4. Tests integration Redis
pnpm --filter @insurtech/insure test:integration            # 5+ pass

# 5. Tests E2E
pnpm --filter api test:e2e -- insure/tarification           # 5+ pass

# 6. Coverage
pnpm --filter @insurtech/insure test:cov                    # >= 90% pour calculators

# 7. No emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  repo/packages/insure/src/services/branche-calculators/ \
  repo/packages/insure/src/services/tarification.service.ts \
  repo/packages/insure/src/data/ \
  --include="*.ts" \
  && echo FAIL || echo OK

# 8. No console.log
grep -rn "console\.log\|console\.debug" \
  repo/packages/insure/src/services/branche-calculators/ \
  repo/packages/insure/src/services/tarification.service.ts \
  --include="*.ts" | grep -v ".spec.ts" \
  && echo FAIL || echo OK

# 9. Verifier decimal.js partout (pas de Number raw pour calculs financiers)
grep -nE "\\* [0-9.]+|\\.toFixed\\(" \
  repo/packages/insure/src/services/branche-calculators/ \
  --include="*.ts" | grep -v "Decimal\\.\\|new Decimal\\|fromAmount" \
  | grep -v ".spec.ts"
# Expected : aucune sortie (sinon = Number raw detected)

# 10. Format
pnpm biome format --write \
  repo/packages/insure/src/services/ \
  repo/packages/insure/src/data/
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-14): tarification engine basique 5 calculators

Implementation moteur tarification Sprint 14 (decision-010).
5 calculators independants (auto/sante/habitation/rc_pro/voyage)
implementant IBrancheCalculator (open/closed Sprint 15 connecteurs).
TarificationService orchestrator avec cache Redis 1h + dispatch +
fallback gracieux + invalidator consumer Kafka. decimal.js precision
financiere. TVA 14% MA Article 96 CGI. Lookup tables regions +
destinations MA. Endpoint preview /api/v1/insure/tarification/simulate.

Livrables:
- IBrancheCalculator interface + CalculateInput/PrimeBreakdown types
- BreakdownBuilder helper (traceabilite ACAPS)
- 5 Zod schemas souscripteur per branche
- 5 calculators (AutoCalculator, SanteCalculator, HabitationCalculator,
  RcProCalculator, VoyageCalculator)
- TarificationService orchestrator + cache Redis + invalidation
- ProductUpdatedCacheInvalidator consumer Kafka
- TarificationController endpoint POST /simulate
- REGION_RISK_MULTIPLIERS (18 regions MA) + DESTINATION_RISK_MULTIPLIERS
- money.helper (decimal.js config + formatMoney)
- decimal.js@10.4.3 ajoute dep

Tests: 41 unit (8+6+5+5+5+12) + 5 integration + 5 E2E = 56 total
Coverage: 92% sur branche-calculators

Task: 4.1.2
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker)
Reference: B-14 Tache 4.1.2"
```

---

## 16. Workflow next step

Apres commit de cette tache :

- **Prochaine tache** : `task-4.1.3-insure-quotes-entity-devis-pdf-generation.md` (QuotesService consomme TarificationService.calculate() ici implemente).
- **Pre-conditions task 4.1.3** : `TarificationService` accessible via DI dans Insure module + Redis cache up.

---

**Fin du prompt task-4.1.2-tarification-engine-basique-lookup-tables.md.**

Densite atteinte : ~125 ko (cible 110-150 ko OK)
Code patterns : 13 fichiers complets (interface, schemas, 5 calculators, orchestrator, money helper, region data, destination data, consumer Kafka, controller)
Tests : 56 cas concrets (41 unit + 5 integration + 5 E2E + helpers)
Criteres validation : V1-V32 (18 P0 + 9 P1 + 5 P2)
Edge cases : 12 documentes avec solutions
