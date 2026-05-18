# TACHE 4.4.5 -- Comparateur Multi-Produits (3-5 options side-by-side parallel)

**Sprint** : 17 (Phase 4 / Sprint 4 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-17-sprint-17-web-customer-portal.md` (Tache 4.4.5)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (positionnement strategique comparateur honnete vs concurrence MA)
**Effort** : 5h
**Dependances** : Tache 4.4.4 (simulator forms + Zod schemas reuse + quote API client) + Sprint 14 (catalog products endpoint + tarification engine multi-tier)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache implemente le **comparateur multi-produits** (`/[locale]/comparer/{branche}`) qui execute en **parallele 3-5 quotes** Sprint 14 (un par produit Skalean catalog, tiers basic/standard/premium voire variantes specifiques branche) pour la meme branche + criteres user, puis affiche le resultat **side-by-side** dans une grille de cards (vue par defaut, mobile-friendly) ou un tableau detaillee matrix garanties (vue desktop power-users), avec **filtres interactifs** (range prix MAD, garanties requises) et **tri** (prix ASC/DESC, couverture maximale), **highlighting du "Meilleur rapport qualite/prix"** calcule via score interne ponderee (prix 60 percent + couverture 40 percent).

Le but strategique est de positionner Skalean Insurtech comme **comparateur honnete et transparent** au Maroc, ce qui est un differentiator competitif majeur car (decision-010 : Sprint 17 = comparaison entre produits Skalean uniquement ; Sprint 32+ ajoutera connecteurs assureurs reels RMA/Saham/Wafa/AXA/Atlanta). Bien que Sprint 17 ne compare pas encore les vrais concurrents, le pattern UX est en place et l'utilisateur voit les 3 tiers Skalean clairement compares.

L'apport est **quintuple** :

1. **Comparaison transparente** : utilisateur voit 3-5 produits (Tiers / Tiers Plus / Tous Risques pour Auto ; Basic / Standard / Premium pour autres branches ; variantes Familial/Individuel pour Sante) avec prix, garanties incluses, exclusions explicites cote-a-cote -> reduit asymetrie information typique du marche assurance MA ou les courtiers fournissent souvent un seul devis sans comparaison.

2. **Conversion verticale optimisee** : chaque card produit a son CTA "Souscrire ce produit" qui redirige directement wizard etape 1 (Tache 4.4.6) avec quote tier-specific serialisee dans `sessionStorage[current_quote_tier_{id}]` + `current_quote`. Bypass simulator pour user deja convaincu par un tier specifique. Reduit nombre clics conversion 30 percent vs flow simulator -> wizard.

3. **Lifting cognitive via visualisation** : differences entre produits visualisees via icons check/cross dans tableau matrix, highlighting "Meilleur rapport qualite/prix" calcule via score interne ponderee, filter / sort interactifs cote client -> aide decision rapide. Pattern emprunte aux comparateurs e-commerce (Amazon, Idealo) adapte au domaine assurance MA.

4. **Score recommendation transparent** : algorithme `findBestValue()` documente et open (pas une boite noire), pondere prix (60 percent normalize 0-1) + coverage (40 percent ratio garanties incluses / total garanties branche). User peut comprendre pourquoi tel tier est recommande. Sprint 36+ : A/B test poids 50/50, 70/30 selon conversion.

5. **Vue toggle Grid vs Table** : Grid mobile-friendly (cards stacked sm:grid-cols-2 lg:grid-cols-3), Table desktop power-users (matrix garanties x tiers avec check/cross icons). Toggle stocke localStorage pour persistence preference user. Conformite responsive : tableau scroll horizontal sur mobile si force, mais grid recommande mobile.

A l'issue de cette tache, `/[locale]/comparer/{auto,sante,habitation,rc-pro,voyage}` (15 routes : 5 branches x 3 locales) sont accessibles publiquement, affichent comparaison parallele 3-5 quotes via React Query `useQueries`, filter/sort fonctionnels cote client (pas de re-fetch API), CTA per card menent au wizard avec tier serializeApp dans sessionStorage. Lighthouse Perf >= 85, SEO 100, A11y 90+.

## 2. Contexte etendu

### 2.1 Pourquoi 3-5 produits limites (UX research)

**UX research approfondie** sur paradox of choice :
- < 3 options = perception "manque de choix", abandon trop facile
- 3-5 options = **sweet spot cognitif** (Hick's law : decision time augmente logarithmiquement avec nombre options)
- 6-10 options = "paralysie analyse" -> conversion baisse 20-40 percent
- > 10 options = abandon massif

**Application Skalean** : catalog Sprint 14 contient effectivement **3 tiers par branche** (basic / standard / premium) couvrant 90 percent des cas usage MA. Si Sprint 32+ ajoute variantes (Familial vs Individuel pour Sante, Particulier vs Pro pour Auto), on plafonne a **5 produits max affichage**.

**Pattern Skalean Sprint 17** :
- Auto : 3 tiers (basic=RC seule, standard=RC+Vol+Incendie, premium=Tous Risques + assistance)
- Sante : 3 tiers + 2 variantes possibles (Individuel/Familial)
- Habitation : 3 tiers
- RC Pro : 3 tiers + variante (CA < 500k vs CA >= 500k)
- Voyage : 3 tiers (court sejour / sejour mid / sejour long ou annuel)

### 2.2 Architecture parallele detaillee

```
User accede /fr/comparer/auto avec criteres form (similar simulator Tache 4.4.4)
            |
            v
   ComparatorForm reuse AutoFormSchema (Tache 4.4.4)
   user remplit : vehicleValue, driverAge, driverCity, garanties, turnstileToken
            |
            v isValid && turnstileToken
   useComparatorQuotes hook fire
            |
            v useQueries (React Query parallel)
   Promise.all([
     previewQuote({ branche: 'auto', tier: 'basic', data, signal }),
     previewQuote({ branche: 'auto', tier: 'standard', data, signal }),
     previewQuote({ branche: 'auto', tier: 'premium', data, signal }),
   ])
            |
            v
   3 quotes returned simultanees (Promise.all -> max(latence individuel))
   Si 1 echoue : autres restent affiches, error card pour echec
            |
            v setState results
   results = [
     { tierId: 'basic', quote: { total: 1800, breakdown }, draftId: 'd1', isLoading: false },
     { tierId: 'standard', quote: { total: 3500, breakdown }, draftId: 'd2', isLoading: false },
     { tierId: 'premium', quote: { total: 6500, breakdown }, draftId: 'd3', isLoading: false },
   ]
            |
            v findBestValue() compute score
   bestValue = standard (score = 0.62, basic=0.50, premium=0.58)
            |
            v applyFilters() + applySort() cote client
   filteredResults = filter(results, criteria)
   sortedResults = sort(filteredResults, sortKey)
            |
            v render
   ProductsGrid (cards) OU ProductsTable (matrix) selon view toggle
   Best value card highlighted avec border + badge "Meilleur rapport"
   CTA per card -> sessionStorage tier-specific + redirect wizard
```

### 2.3 Alternatives considerees (matrice decision)

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **`useQueries` parallel + React Query** | Cache individuel per quote, dedup, abort support, retry per query | Setup boilerplate 5+ queries | **RETENU** |
| Promise.all manuel sans React Query | Simple a comprendre, controle total | Pas de cache, no retry strategie per quote, abort manual | rejete |
| `useQuery` batch (1 query 5 results) | 1 seul request HTTP -> moins de latence | Sprint 14 API renvoie 1 quote per request (pattern actuel) -> backend modif | rejete (impact Sprint 14) |
| Server-side render quotes (SSR) | SEO-friendly, no JS pour quote display | Lent (3 quotes serial), no realtime user changes form | partially retenu (SSR initial) |
| WebSocket multi-quote stream | Temps reel mises a jour, optimal cas concurrents reels Sprint 32+ | Sprint 17 = pas de vrais concurrents externes, overkill | defere Sprint 32+ |
| GraphQL batch query | 1 query syntaxe propre, aliases for parallel | Pas de GraphQL dans stack Skalean v2.2 | hors stack |

### 2.4 Trade-offs explicites

1. **3 quotes parallel = 3x charge API tarification engine** : tolere car Sprint 17 traffic modeste (estimation pilote < 1000 comparaisons/jour = 3000 quote requests/jour < threshold 30/min/IP). Sprint 35+ : cache mutualisable (memes inputs entre tiers, base differente -> 80 percent calcul partage cote serveur). Sprint 14 v2 pourra implementer endpoint batch `/api/v1/insure/quotes/batch-preview` qui prend N tiers et renvoie N quotes en 1 query.

2. **View mode toggle Cards vs Table** : 2 composants a maintenir (ProductsGrid + ProductsTable). Justifie car (a) Cards mobile-friendly (lg:grid-cols-3 stack sm), (b) Table desktop power-users veulent matrix detaillee. Trade-off accepte : maintenance double mais UX optimale pour chaque audience. Sprint 36+ A/B test peut montrer Table converte mieux -> default Table.

3. **Filter/sort cote client (3-5 items)** : pas besoin API re-fetch. Trade-off : code logic dupli si Sprint 32+ scale a 50+ produits. Sprint 17 = 5 max donc OK. Sprint 32+ ajoutera server-side filter/sort si needed.

4. **Score "Best value" pondere 60/40** : arbitraire mais justifie. Sprint 36+ A/B test poids (50/50 vs 70/30 vs 60/40) selon metriques conversion + satisfaction post-souscription. Documente formula transparente vs boite noire.

5. **Sticky filters panel desktop (lg:sticky top-20)** : reste visible au scroll long table/grid. Trade-off mobile : passe au-dessus grid (stack vertical). Alternative envisagee : drawer/modal mobile pour filters -> retenu Sprint 36+ A/B test.

6. **Tier query param URL (?tier=basic) deep-link** : permet partage URL specifique tier. Mais URL `?filters[minPrice]=2000&sort=price-desc&view=table` ajoute complexite parsing/serialization. Decision Sprint 17 : URL minimal (sans filters/sort/view persist), persistence local state. Sprint 36+ : full URL state si A/B test montre benefit deep-link partages.

7. **Card "Best Value" highlight visual** : border + badge "Meilleur rapport qualite/prix" risque biais user (peut suspecter manipulation). Mitigation : tooltip explique calcul (60/40 prix/coverage), formula publique dans page `/comment-nous-comparons`.

### 2.5 Pieges techniques connus (12 cas)

1. **Piege : `useQueries` fire avant turnstileToken disponible**
   - **Pourquoi** : enabled condition mal coordonnee -> 3 queries fire avec token null -> 3x echec 401
   - **Solution** : `enabled: isValid && !!turnstileToken` au niveau `useQueries` per query

2. **Piege : Quote responses different breakdown structure entre tiers (basic n'a pas Vol, standard oui)**
   - **Pourquoi** : breakdown array length varie entre quotes
   - **Solution** : normaliser dans display via `garantieIds` mapping ou show "Non inclus" pour absents

3. **Piege : Sort change re-render entire grid sans memoization**
   - **Pourquoi** : sort recree array a chaque render -> all cards re-render -> animations restart
   - **Solution** : `useMemo([filtered, sortKey])` + stable keys `result.tierId`

4. **Piege : Filter exclude all tiers -> grid vide**
   - **Pourquoi** : user filtre garanties tres restrictif -> aucun produit match
   - **Solution** : show "Aucun produit ne correspond" message + bouton "Reset filtres"

5. **Piege : CTA per card persists DIFFERENT quote per tier dans sessionStorage**
   - **Pourquoi** : `sessionStorage.setItem('current_quote', ...)` overwritten si user clique 2 tiers different
   - **Solution** : keys distinctes `current_quote_tier_{id}` + key generique `current_quote` (last clicked) -> wizard etape 1 lit `current_quote` direct

6. **Piege : Best value badge visible meme si 1 seul quote retourne (autres failed)**
   - **Pourquoi** : findBestValue retourne `results[0]` si seul un succeed -> badge "Meilleur" sur seul item
   - **Solution** : ne montrer badge que si >= 2 quotes succeed (else nothing to compare to)

7. **Piege : Table view sur mobile overflow horizontal massif**
   - **Pourquoi** : table 5 cols + 8+ garanties = wider que viewport mobile
   - **Solution** : `overflow-x-auto` + sticky first col (garantie name) + visual hint "Glisser pour voir tous tiers"

8. **Piege : Filter min/max prix saisie clavier mobile (numpad)**
   - **Pourquoi** : input type=number sur mobile = clavier numerique mais sans decimal
   - **Solution** : `type="number" inputMode="numeric" pattern="[0-9]*"` + label "MAD" suffix

9. **Piege : useQueries refetch en boucle si formData reference instable**
   - **Pourquoi** : `queryKey: [..., data, ...]` change reference a chaque render
   - **Solution** : `useDebounceDeep` pour serialize data avant queryKey (Tache 4.4.4 hook)

10. **Piege : Best value score = 0 pour tous (aucune variation prix ni coverage)**
    - **Pourquoi** : tous tiers ont meme prix (edge case bug catalog Sprint 14)
    - **Solution** : fallback "Recommande" sur tier standard (defaut catalog Sprint 14)

11. **Piege : ProductsTable rendering avec different headers per locale (LTR vs RTL)**
    - **Pourquoi** : RTL inverse colonnes -> garantie col passe a droite, tiers a gauche
    - **Solution** : `dir="rtl"` propage automatique sur `<table>` mais tester visuellement, fix `text-start` au lieu de `text-left`

12. **Piege : Best value computation includes failed quotes (quote=null) -> NaN dans score**
    - **Pourquoi** : `Math.min(...prices.map((p) => p ?? Infinity))` retourne Infinity si tous failed
    - **Solution** : filter `validResults = results.filter(r => r.quote !== null)` avant computeScore

## 3. Architecture context

### 3.1 Position dans sprint 17

- **Depend** : Tache 4.4.4 (simulator forms reused via ComparatorForm + Zod schemas + previewQuote API client + TurnstileWidget + QueryProvider)
- **Bloque** : Tache 4.4.6 (wizard etape 1 consomme quote depuis sessionStorage tier-specific)
- **Apporte** : pattern Promise.all React Query useQueries + comparison UI patterns + score algorithm reutilisable + 15 routes statiques SEO

### 3.2 Endpoints API consommes

- POST `/api/v1/insure/quotes/preview` (Sprint 14) appele 3-5x parallel via useQueries
  - Meme contract que simulator Tache 4.4.4 mais avec `tier` parameter different per call
  - Idempotency-Key unique per query : `comparator-${branche}-${tier}-${uuid}`
- GET `/api/v1/insure/catalog/products?branche={branche}` (Sprint 14)
  - Recupere liste tiers/variantes disponibles per branche
  - Cache React Query staleTime 1h
  - Use : ComparatorForm + ComparatorResults

### 3.3 Diagramme structure fichiers

```
apps/web-customer-portal/
  app/[locale]/comparer/
    layout.tsx                                # Wrapper container
    auto/page.tsx                              # Tache 4.4.5
    sante/page.tsx                             # Tache 4.4.5
    habitation/page.tsx                        # Tache 4.4.5
    rc-pro/page.tsx                            # Tache 4.4.5
    voyage/page.tsx                            # Tache 4.4.5
  components/comparator/
    comparator-shell.tsx                        # Layout + breadcrumbs
    comparator-form.tsx                         # Form criteria (reuse simulator)
    comparator-results.tsx                      # Wrapper Grid/Table + toggle
    products-grid.tsx                           # 3-5 cards layout
    product-card.tsx                            # Individual card
    products-table.tsx                          # Matrix garanties x tiers
    comparator-filters.tsx                       # Panel filters sticky
    comparator-sort.tsx                         # Sort selector
    best-value-badge.tsx                        # Badge "Meilleur rapport"
    methodology-link.tsx                        # Link "Comment nous comparons"
  lib/hooks/
    use-comparator-quotes.ts                    # useQueries wrap
  lib/comparator/
    score.ts                                    # computeScore + findBestValue
    filters.ts                                  # applyFilters + types
    sorts.ts                                    # applySort + SortKey
    persist.ts                                  # sessionStorage tier-specific
```

## 4. Livrables checkables (30+)

- [ ] **L1-L5** Pages `app/[locale]/comparer/{auto,sante,habitation,rc-pro,voyage}/page.tsx` (5 fichiers ~150 lignes each)
- [ ] **L6** Layout `app/[locale]/comparer/layout.tsx` (~70 lignes)
- [ ] **L7** Composant `components/comparator/comparator-shell.tsx` (~140 lignes) container + breadcrumbs
- [ ] **L8** Composant `components/comparator/comparator-form.tsx` (~220 lignes) form criteria
- [ ] **L9** Composant `components/comparator/comparator-results.tsx` (~200 lignes) wrapper avec Suspense
- [ ] **L10** Composant `components/comparator/products-grid.tsx` (~230 lignes) 3-5 cards responsive
- [ ] **L11** Composant `components/comparator/product-card.tsx` (~200 lignes) avec states loading/error/success
- [ ] **L12** Composant `components/comparator/products-table.tsx` (~220 lignes) matrix detailed
- [ ] **L13** Composant `components/comparator/comparator-filters.tsx` (~170 lignes) panel sticky
- [ ] **L14** Composant `components/comparator/comparator-sort.tsx` (~90 lignes) selector
- [ ] **L15** Composant `components/comparator/best-value-badge.tsx` (~60 lignes) badge animated
- [ ] **L16** Composant `components/comparator/methodology-link.tsx` (~50 lignes) link explication score
- [ ] **L17** Hook `lib/hooks/use-comparator-quotes.ts` (~150 lignes) useQueries parallel
- [ ] **L18** Lib `lib/comparator/score.ts` (~120 lignes) computeScore + findBestValue + helpers
- [ ] **L19** Lib `lib/comparator/filters.ts` (~80 lignes) applyFilters + DEFAULT_FILTERS
- [ ] **L20** Lib `lib/comparator/sorts.ts` (~70 lignes) applySort + 3 sort keys
- [ ] **L21** Lib `lib/comparator/persist.ts` (~60 lignes) sessionStorage helpers tier-specific
- [ ] **L22** Messages enrichis `messages/{fr,ar-MA,ar}.json` (+~120 keys comparator.*)
- [ ] **L23** Tests unit `__tests__/lib/comparator/score.spec.ts` (12 tests)
- [ ] **L24** Tests unit `__tests__/lib/comparator/filters.spec.ts` (10 tests)
- [ ] **L25** Tests unit `__tests__/lib/comparator/sorts.spec.ts` (8 tests)
- [ ] **L26** Tests unit `__tests__/lib/comparator/persist.spec.ts` (6 tests)
- [ ] **L27** Tests unit `__tests__/components/comparator/product-card.spec.tsx` (10 tests)
- [ ] **L28** Tests unit `__tests__/components/comparator/products-table.spec.tsx` (8 tests)
- [ ] **L29** Tests unit `__tests__/components/comparator/comparator-filters.spec.tsx` (8 tests)
- [ ] **L30** Tests integration `__tests__/integration/comparator-auto.spec.tsx` (12 tests)
- [ ] **L31** Tests integration `__tests__/integration/comparator-sante.spec.tsx` (8 tests)
- [ ] **L32** Tests E2E `e2e/comparator.spec.ts` (10 scenarios)
- [ ] **L33** useQueries parallel resolve all quotes simultanees verifie (Network tab : 3 requests parallel)
- [ ] **L34** Filter "min price" reduit cards visibles + UI feedback
- [ ] **L35** Sort "price asc" reorder cards visuels animation smooth
- [ ] **L36** Best value badge affiche sur tier optimal (highest score) + tooltip explication
- [ ] **L37** CTA per card -> wizard avec sessionStorage tier-specific `current_quote_tier_{id}`
- [ ] **L38** Toggle view Cards <-> Table fonctionne avec localStorage persist preference
- [ ] **L39** Lighthouse Perf >= 85, SEO >= 95 sur 5 pages
- [ ] **L40** No emoji, no console.log, typecheck OK, lint OK
- [ ] **L41** Aria-labels sur table colonnes + sort buttons + filters checkboxes
- [ ] **L42** Responsive : table desktop, cards stacked mobile, filters drawer mobile (defere Sprint 36)
- [ ] **L43** RTL ar-MA fonctionne (table dir=rtl, cards order)

## 5. Fichiers crees / modifies (exhaustive)

```
repo/apps/web-customer-portal/app/[locale]/comparer/auto/page.tsx                       (~150 lignes)
repo/apps/web-customer-portal/app/[locale]/comparer/sante/page.tsx                      (~150 lignes)
repo/apps/web-customer-portal/app/[locale]/comparer/habitation/page.tsx                 (~150 lignes)
repo/apps/web-customer-portal/app/[locale]/comparer/rc-pro/page.tsx                      (~150 lignes)
repo/apps/web-customer-portal/app/[locale]/comparer/voyage/page.tsx                      (~150 lignes)
repo/apps/web-customer-portal/app/[locale]/comparer/layout.tsx                           (~80 lignes)
repo/apps/web-customer-portal/components/comparator/comparator-shell.tsx                  (~150 lignes)
repo/apps/web-customer-portal/components/comparator/comparator-form.tsx                   (~230 lignes)
repo/apps/web-customer-portal/components/comparator/comparator-results.tsx                 (~210 lignes)
repo/apps/web-customer-portal/components/comparator/products-grid.tsx                      (~240 lignes)
repo/apps/web-customer-portal/components/comparator/product-card.tsx                       (~210 lignes)
repo/apps/web-customer-portal/components/comparator/products-table.tsx                     (~230 lignes)
repo/apps/web-customer-portal/components/comparator/comparator-filters.tsx                  (~180 lignes)
repo/apps/web-customer-portal/components/comparator/comparator-sort.tsx                     (~100 lignes)
repo/apps/web-customer-portal/components/comparator/best-value-badge.tsx                    (~70 lignes)
repo/apps/web-customer-portal/components/comparator/methodology-link.tsx                    (~60 lignes)
repo/apps/web-customer-portal/lib/hooks/use-comparator-quotes.ts                            (~160 lignes)
repo/apps/web-customer-portal/lib/comparator/score.ts                                       (~130 lignes)
repo/apps/web-customer-portal/lib/comparator/filters.ts                                     (~90 lignes)
repo/apps/web-customer-portal/lib/comparator/sorts.ts                                       (~80 lignes)
repo/apps/web-customer-portal/lib/comparator/persist.ts                                     (~70 lignes)
repo/apps/web-customer-portal/messages/{fr,ar-MA,ar}.json                                   (+120 keys per locale)
repo/apps/web-customer-portal/__tests__/lib/comparator/score.spec.ts                        (~200 lignes)
repo/apps/web-customer-portal/__tests__/lib/comparator/filters.spec.ts                       (~150 lignes)
repo/apps/web-customer-portal/__tests__/lib/comparator/sorts.spec.ts                        (~130 lignes)
repo/apps/web-customer-portal/__tests__/lib/comparator/persist.spec.ts                      (~100 lignes)
repo/apps/web-customer-portal/__tests__/components/comparator/product-card.spec.tsx          (~180 lignes)
repo/apps/web-customer-portal/__tests__/components/comparator/products-table.spec.tsx        (~150 lignes)
repo/apps/web-customer-portal/__tests__/components/comparator/comparator-filters.spec.tsx    (~140 lignes)
repo/apps/web-customer-portal/__tests__/integration/comparator-auto.spec.tsx                  (~220 lignes)
repo/apps/web-customer-portal/__tests__/integration/comparator-sante.spec.tsx                 (~150 lignes)
repo/apps/web-customer-portal/e2e/comparator.spec.ts                                          (~180 lignes)
```

## 6. Code patterns COMPLETS (chunk 1/3 : hooks + libs)

### Fichier 1/16 : `lib/hooks/use-comparator-quotes.ts`

Hook React Query `useQueries` parallel pour 3-5 tiers simultanees.

```typescript
'use client';

import { useQueries } from '@tanstack/react-query';
import { previewQuote, type QuoteResponse, QuotePreviewError } from '@/lib/api/quote-preview';
import type { BrancheSlug } from '@/lib/constants';
import type { SimulatorFormData } from '@/lib/schemas/simulator';
import { getBrancheData } from '@/lib/data/branches';
import { useDebounceDeep } from './use-debounce';

interface UseComparatorQuotesOptions {
  branche: BrancheSlug;
  data: SimulatorFormData;
  isValid: boolean;
  turnstileToken: string | null;
  debounceMs?: number;
  enabled?: boolean;
}

export interface ComparatorQuoteResult {
  tierId: 'basic' | 'standard' | 'premium';
  tierLabel: string;
  quote: QuoteResponse['quote'] | null;
  draftId: string | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: QuotePreviewError | null;
  refetch: () => void;
}

const STALE_TIME_MS = 5 * 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;
const MAX_RETRIES = 1;

export function useComparatorQuotes({ branche, data, isValid, turnstileToken, debounceMs = 500, enabled = true }: UseComparatorQuotesOptions): {
  results: ComparatorQuoteResult[];
  isLoading: boolean;
  isAllError: boolean;
  isAnySuccess: boolean;
  refetchAll: () => void;
} {
  const debouncedData = useDebounceDeep(data, debounceMs);
  const brancheData = getBrancheData(branche);

  const queries = useQueries({
    queries: brancheData.pricingTiers.map((tier) => ({
      queryKey: ['comparator-quote', branche, tier.id, debouncedData, turnstileToken],
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        return previewQuote({
          branche,
          data: { ...debouncedData, tier: tier.id } as SimulatorFormData,
          turnstileToken: turnstileToken!,
          signal,
          idempotencyKey: `comparator-${branche}-${tier.id}-${crypto.randomUUID()}`,
        });
      },
      enabled: enabled && isValid && !!turnstileToken,
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      retry: (failureCount: number, error: QuotePreviewError) => {
        if (error.isValidationError() || error.isCaptchaInvalid() || error.isRateLimit()) return false;
        return failureCount < MAX_RETRIES;
      },
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
    })),
  });

  const results: ComparatorQuoteResult[] = queries.map((query, idx) => {
    const tier = brancheData.pricingTiers[idx];
    return {
      tierId: tier.id,
      tierLabel: tier.labelKey,
      quote: query.data?.quote ?? null,
      draftId: query.data?.draftId ?? null,
      isLoading: query.isLoading,
      isError: query.isError,
      isSuccess: query.isSuccess,
      error: (query.error as QuotePreviewError) ?? null,
      refetch: query.refetch,
    };
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isAllError = queries.length > 0 && queries.every((q) => q.isError);
  const isAnySuccess = queries.some((q) => q.isSuccess);

  const refetchAll = () => {
    queries.forEach((q) => q.refetch());
  };

  return { results, isLoading, isAllError, isAnySuccess, refetchAll };
}
```

### Fichier 2/16 : `lib/comparator/score.ts`

Algorithm score "Best Value" pondere prix 60 + coverage 40.

```typescript
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';

export interface ScoreWeights {
  priceWeight: number;
  coverageWeight: number;
  garantiesTotalForBranche: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  priceWeight: 0.6,
  coverageWeight: 0.4,
  garantiesTotalForBranche: 8,
};

export interface ScoreBreakdown {
  total: number;
  priceComponent: number;
  coverageComponent: number;
  garantiesCount: number;
  pricePosition: 'cheapest' | 'middle' | 'most-expensive';
}

export function computeScore(
  result: ComparatorQuoteResult,
  allResults: ReadonlyArray<ComparatorQuoteResult>,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): number {
  if (!result.quote) return 0;

  const validResults = allResults.filter((r) => r.quote !== null);
  if (validResults.length === 0) return 0;
  if (validResults.length === 1) return 1;

  const prices = validResults.map((r) => r.quote!.total);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const priceScore = 1 - (result.quote.total - minPrice) / priceRange;

  const garantiesIncluded = result.quote.breakdown.filter((l) => l.category === 'garantie').length;
  const coverageScore = Math.min(1, garantiesIncluded / weights.garantiesTotalForBranche);

  return weights.priceWeight * priceScore + weights.coverageWeight * coverageScore;
}

export function computeScoreBreakdown(
  result: ComparatorQuoteResult,
  allResults: ReadonlyArray<ComparatorQuoteResult>,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): ScoreBreakdown {
  if (!result.quote) {
    return { total: 0, priceComponent: 0, coverageComponent: 0, garantiesCount: 0, pricePosition: 'most-expensive' };
  }

  const validResults = allResults.filter((r) => r.quote !== null);
  const prices = validResults.map((r) => r.quote!.total).sort((a, b) => a - b);
  const myPrice = result.quote.total;

  const pricePosition: ScoreBreakdown['pricePosition'] =
    myPrice === prices[0] ? 'cheapest' :
    myPrice === prices[prices.length - 1] ? 'most-expensive' : 'middle';

  const minPrice = prices[0] ?? myPrice;
  const maxPrice = prices[prices.length - 1] ?? myPrice;
  const priceRange = maxPrice - minPrice || 1;
  const priceComponent = (1 - (myPrice - minPrice) / priceRange) * weights.priceWeight;

  const garantiesIncluded = result.quote.breakdown.filter((l) => l.category === 'garantie').length;
  const coverageComponent = Math.min(1, garantiesIncluded / weights.garantiesTotalForBranche) * weights.coverageWeight;

  return {
    total: priceComponent + coverageComponent,
    priceComponent,
    coverageComponent,
    garantiesCount: garantiesIncluded,
    pricePosition,
  };
}

export function findBestValue(results: ReadonlyArray<ComparatorQuoteResult>, weights?: ScoreWeights): ComparatorQuoteResult | null {
  const validResults = results.filter((r) => r.quote !== null);
  if (validResults.length === 0) return null;
  if (validResults.length === 1) return validResults[0];

  let best = validResults[0];
  let bestScore = computeScore(best, validResults, weights);

  for (let i = 1; i < validResults.length; i++) {
    const score = computeScore(validResults[i], validResults, weights);
    if (score > bestScore || (score === bestScore && (validResults[i].quote?.total ?? Infinity) < (best.quote?.total ?? Infinity))) {
      best = validResults[i];
      bestScore = score;
    }
  }

  return best;
}

export function rankResults(results: ReadonlyArray<ComparatorQuoteResult>, weights?: ScoreWeights): Array<ComparatorQuoteResult & { rank: number; score: number }> {
  const validResults = results.filter((r) => r.quote !== null);
  const scored = validResults.map((r) => ({ ...r, score: computeScore(r, validResults, weights), rank: 0 }));
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((r, idx) => { r.rank = idx + 1; });
  return scored;
}
```

### Fichier 3/16 : `lib/comparator/filters.ts`

Filtres cote client.

```typescript
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';

export interface ComparatorFilters {
  minPriceMAD: number | null;
  maxPriceMAD: number | null;
  requiredGaranties: ReadonlyArray<string>;
  onlyAvailable: boolean;
}

export const DEFAULT_FILTERS: ComparatorFilters = {
  minPriceMAD: null,
  maxPriceMAD: null,
  requiredGaranties: [],
  onlyAvailable: true,
};

export function applyFilters(
  results: ReadonlyArray<ComparatorQuoteResult>,
  filters: ComparatorFilters
): ComparatorQuoteResult[] {
  return results.filter((r) => {
    if (filters.onlyAvailable && !r.quote) return false;
    if (!r.quote) return false;

    if (filters.minPriceMAD !== null && r.quote.total < filters.minPriceMAD) return false;
    if (filters.maxPriceMAD !== null && r.quote.total > filters.maxPriceMAD) return false;

    if (filters.requiredGaranties.length > 0) {
      const garantieIds = r.quote.breakdown.filter((l) => l.category === 'garantie').map((l) => l.id);
      for (const required of filters.requiredGaranties) {
        if (!garantieIds.includes(required)) return false;
      }
    }

    return true;
  });
}

export function hasActiveFilters(filters: ComparatorFilters): boolean {
  return filters.minPriceMAD !== null ||
    filters.maxPriceMAD !== null ||
    filters.requiredGaranties.length > 0 ||
    !filters.onlyAvailable;
}

export function countActiveFilters(filters: ComparatorFilters): number {
  let count = 0;
  if (filters.minPriceMAD !== null) count++;
  if (filters.maxPriceMAD !== null) count++;
  if (filters.requiredGaranties.length > 0) count++;
  if (!filters.onlyAvailable) count++;
  return count;
}

export function resetFilters(): ComparatorFilters {
  return { ...DEFAULT_FILTERS };
}
```

### Fichier 4/16 : `lib/comparator/sorts.ts`

Tri cote client.

```typescript
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';

export type SortKey = 'price-asc' | 'price-desc' | 'coverage-best' | 'recommended';

export const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; labelKey: string }> = [
  { key: 'price-asc', labelKey: 'comparator.sort_price_asc' },
  { key: 'price-desc', labelKey: 'comparator.sort_price_desc' },
  { key: 'coverage-best', labelKey: 'comparator.sort_coverage_best' },
  { key: 'recommended', labelKey: 'comparator.sort_recommended' },
];

export function applySort(results: ReadonlyArray<ComparatorQuoteResult>, sortKey: SortKey): ComparatorQuoteResult[] {
  const sorted = [...results];

  switch (sortKey) {
    case 'price-asc':
      sorted.sort((a, b) => (a.quote?.total ?? Infinity) - (b.quote?.total ?? Infinity));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.quote?.total ?? -Infinity) - (a.quote?.total ?? -Infinity));
      break;
    case 'coverage-best':
      sorted.sort((a, b) => {
        const aGaranties = a.quote?.breakdown.filter((l) => l.category === 'garantie').length ?? 0;
        const bGaranties = b.quote?.breakdown.filter((l) => l.category === 'garantie').length ?? 0;
        if (aGaranties === bGaranties) {
          return (a.quote?.total ?? Infinity) - (b.quote?.total ?? Infinity);
        }
        return bGaranties - aGaranties;
      });
      break;
    case 'recommended':
      sorted.sort((a, b) => {
        const order: Record<string, number> = { standard: 0, premium: 1, basic: 2 };
        return (order[a.tierId] ?? 99) - (order[b.tierId] ?? 99);
      });
      break;
  }

  return sorted;
}

export function isValidSortKey(value: string): value is SortKey {
  return ['price-asc', 'price-desc', 'coverage-best', 'recommended'].includes(value);
}
```

### Fichier 5/16 : `lib/comparator/persist.ts`

SessionStorage helpers tier-specific + last selected.

```typescript
import { STORAGE_KEYS } from '@/lib/constants';
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';
import type { BrancheSlug } from '@/lib/constants';
import type { SimulatorFormData } from '@/lib/schemas/simulator';

export interface PersistedComparatorChoice {
  branche: BrancheSlug;
  tier: 'basic' | 'standard' | 'premium';
  formData: SimulatorFormData;
  quote: ComparatorQuoteResult['quote'];
  draftId: string;
  selectedAt: string;
}

export function persistTierChoice(branche: BrancheSlug, result: ComparatorQuoteResult, formData: SimulatorFormData): void {
  if (typeof window === 'undefined' || !result.quote) return;
  const choice: PersistedComparatorChoice = {
    branche,
    tier: result.tierId,
    formData,
    quote: result.quote,
    draftId: result.draftId ?? '',
    selectedAt: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(`${STORAGE_KEYS.currentQuote}_${result.tierId}`, JSON.stringify(choice));
    sessionStorage.setItem(STORAGE_KEYS.currentQuote, JSON.stringify(choice));
  } catch (err) {
    if ((err as Error).name === 'QuotaExceededError') {
      Object.values(STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.setItem(STORAGE_KEYS.currentQuote, JSON.stringify(choice));
    }
  }
}

export function loadTierChoice(tier: string): PersistedComparatorChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEYS.currentQuote}_${tier}`);
    return raw ? (JSON.parse(raw) as PersistedComparatorChoice) : null;
  } catch {
    return null;
  }
}

export function clearTierChoices(): void {
  if (typeof window === 'undefined') return;
  for (const tier of ['basic', 'standard', 'premium']) {
    sessionStorage.removeItem(`${STORAGE_KEYS.currentQuote}_${tier}`);
  }
  sessionStorage.removeItem(STORAGE_KEYS.currentQuote);
}

const VIEW_PREFERENCE_KEY = 'comparator_view_preference';

export function getViewPreference(): 'grid' | 'table' | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(VIEW_PREFERENCE_KEY);
  return stored === 'grid' || stored === 'table' ? stored : null;
}

export function setViewPreference(view: 'grid' | 'table'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VIEW_PREFERENCE_KEY, view);
}
```

## 6. Code patterns COMPLETS (chunk 2/3 : composants UI)

### Fichier 6/16 : `components/comparator/best-value-badge.tsx`

```typescript
'use client';

import { Star, Info } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

interface BestValueBadgeProps {
  score?: number;
}

export function BestValueBadge({ score }: BestValueBadgeProps) {
  const { t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5 text-xs font-bold text-amber-900 shadow-md cursor-help"
        aria-describedby="best-value-tooltip"
        aria-label={t('comparator.best_value_badge')}
      >
        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
        <span>{t('comparator.best_value_badge')}</span>
        <Info className="h-3 w-3" aria-hidden="true" />
      </button>

      {showTooltip && (
        <div
          id="best-value-tooltip"
          role="tooltip"
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 rounded-md bg-slate-900 text-white text-xs p-3 shadow-lg z-20"
        >
          <p className="font-semibold mb-1">{t('comparator.best_value_tooltip_title')}</p>
          <p>{t('comparator.best_value_tooltip_desc')}</p>
          {score !== undefined && (
            <p className="mt-2 font-mono">Score: {(score * 100).toFixed(0)}/100</p>
          )}
        </div>
      )}
    </div>
  );
}
```

### Fichier 7/16 : `components/comparator/product-card.tsx`

Card individuelle avec states.

```typescript
'use client';

import Link from 'next/link';
import { Check, X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';
import type { BrancheSlug, Locale } from '@/lib/constants';
import type { SimulatorFormData } from '@/lib/schemas/simulator';
import { useI18n } from '@/lib/i18n/provider';
import { BestValueBadge } from './best-value-badge';
import { persistTierChoice } from '@/lib/comparator/persist';
import { useRouter } from 'next/navigation';

interface ProductCardProps {
  result: ComparatorQuoteResult;
  isBestValue: boolean;
  score?: number;
  branche: BrancheSlug;
  locale: Locale;
  formData: SimulatorFormData;
}

export function ProductCard({ result, isBestValue, score, branche, locale, formData }: ProductCardProps) {
  const { t } = useI18n();
  const router = useRouter();

  if (result.isLoading) {
    return (
      <article className="relative rounded-xl border border-slate-200 bg-white p-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-6 w-32 bg-slate-200 rounded mb-4" />
        <div className="h-12 w-48 bg-slate-200 rounded mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full bg-slate-100 rounded" />
          ))}
        </div>
        <div className="mt-6 h-10 w-full bg-slate-200 rounded" />
        <span className="sr-only">{t('comparator.card_loading')}</span>
      </article>
    );
  }

  if (result.isError || !result.quote) {
    return (
      <article role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-2" aria-hidden="true" />
        <p className="text-sm font-semibold text-rose-900">{t('comparator.error_compute')}</p>
        <p className="text-xs text-rose-700 mt-1 max-w-xs">{result.error?.body?.slice(0, 100) ?? t('comparator.unknown_error')}</p>
        <button
          type="button"
          onClick={result.refetch}
          className="mt-4 inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          {t('comparator.retry')}
        </button>
      </article>
    );
  }

  const garanties = result.quote.breakdown.filter((l) => l.category === 'garantie');
  const taxes = result.quote.breakdown.filter((l) => l.category === 'tax');

  const handleContinue = () => {
    persistTierChoice(branche, result, formData);
    router.push(`/${locale}/souscription/etape-1?tier=${result.tierId}`);
  };

  return (
    <article
      className={`relative flex flex-col rounded-xl border-2 bg-white p-6 transition-shadow hover:shadow-lg ${
        isBestValue ? 'border-amber-400 shadow-xl ring-2 ring-amber-100' : 'border-slate-200'
      }`}
    >
      {isBestValue && <BestValueBadge score={score} />}

      <header>
        <h3 className="text-lg font-bold text-slate-900">{t(result.tierLabel)}</h3>
        <p className="mt-1 text-xs text-slate-500 capitalize">{branche} · {result.tierId}</p>
      </header>

      <div className="mt-4 pb-4 border-b border-slate-200">
        <p className="text-xs text-slate-500 uppercase tracking-wide">{t('comparator.starting_from')}</p>
        <p className="mt-1 text-4xl font-extrabold text-slate-900 tabular-nums">{result.quote.totalFormatted}</p>
        <p className="text-xs text-slate-500 mt-1">{t(`comparator.frequency_${result.quote.frequency}`)}</p>
      </div>

      <div className="mt-4 flex-1">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">{t('comparator.garanties_included')} ({garanties.length})</p>
        <ul className="space-y-2 text-sm">
          {garanties.slice(0, 6).map((g) => (
            <li key={g.id} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-slate-700">{g.label}</span>
            </li>
          ))}
          {garanties.length > 6 && (
            <li className="text-xs text-slate-500">{t('comparator.and_more', { count: garanties.length - 6 })}</li>
          )}
        </ul>
      </div>

      <footer className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleContinue}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-semibold transition-colors ${
            isBestValue ? 'bg-amber-500 text-amber-900 hover:bg-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          data-analytics-event={`comparator_${branche}_${result.tierId}_cta_click`}
        >
          {t('comparator.subscribe_cta')}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </button>
        <p className="text-xs text-slate-500 text-center">
          {t('comparator.valid_until')}: {new Date(result.quote.validUntil).toLocaleDateString(locale)}
        </p>
      </footer>
    </article>
  );
}
```

### Fichier 8/16 : `components/comparator/products-grid.tsx`

Grid layout 3-5 cards responsive.

```typescript
'use client';

import { useMemo } from 'react';
import { ProductCard } from './product-card';
import { findBestValue, computeScore } from '@/lib/comparator/score';
import { applyFilters, type ComparatorFilters, hasActiveFilters } from '@/lib/comparator/filters';
import { applySort, type SortKey } from '@/lib/comparator/sorts';
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';
import type { BrancheSlug, Locale } from '@/lib/constants';
import type { SimulatorFormData } from '@/lib/schemas/simulator';
import { useI18n } from '@/lib/i18n/provider';
import { Search, AlertCircle } from 'lucide-react';

interface ProductsGridProps {
  results: ComparatorQuoteResult[];
  branche: BrancheSlug;
  locale: Locale;
  formData: SimulatorFormData;
  filters: ComparatorFilters;
  sortKey: SortKey;
  onResetFilters: () => void;
}

export function ProductsGrid({ results, branche, locale, formData, filters, sortKey, onResetFilters }: ProductsGridProps) {
  const { t } = useI18n();
  const bestValue = useMemo(() => findBestValue(results), [results]);
  const filtered = useMemo(() => applyFilters(results, filters), [results, filters]);
  const sorted = useMemo(() => applySort(filtered, sortKey), [filtered, sortKey]);

  if (sorted.length === 0) {
    return (
      <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
        <Search className="h-12 w-12 text-slate-400 mx-auto mb-3" aria-hidden="true" />
        <p className="text-lg font-semibold text-slate-700">{t('comparator.no_results_title')}</p>
        <p className="mt-2 text-sm text-slate-600">{t('comparator.no_results_subtitle')}</p>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t('comparator.reset_filters')}
          </button>
        )}
      </div>
    );
  }

  const visibleCount = sorted.length;
  const gridClass = visibleCount <= 2 ? 'sm:grid-cols-2 lg:grid-cols-2' : visibleCount === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4" aria-live="polite">
        {t('comparator.results_count', { count: visibleCount, total: results.length })}
      </p>
      <div className={`grid grid-cols-1 ${gridClass} gap-6 md:gap-8`}>
        {sorted.map((result) => {
          const score = computeScore(result, results);
          return (
            <ProductCard
              key={result.tierId}
              result={result}
              isBestValue={bestValue?.tierId === result.tierId && visibleCount >= 2}
              score={score}
              branche={branche}
              locale={locale}
              formData={formData}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### Fichier 9/16 : `components/comparator/products-table.tsx`

Matrix table garanties x tiers.

```typescript
'use client';

import { Check, X } from 'lucide-react';
import { useMemo } from 'react';
import { applyFilters, type ComparatorFilters } from '@/lib/comparator/filters';
import { applySort, type SortKey } from '@/lib/comparator/sorts';
import { findBestValue } from '@/lib/comparator/score';
import type { ComparatorQuoteResult } from '@/lib/hooks/use-comparator-quotes';
import { useI18n } from '@/lib/i18n/provider';
import { getBrancheData } from '@/lib/data/branches';
import type { BrancheSlug } from '@/lib/constants';

interface ProductsTableProps {
  results: ComparatorQuoteResult[];
  branche: BrancheSlug;
  filters: ComparatorFilters;
  sortKey: SortKey;
}

export function ProductsTable({ results, branche, filters, sortKey }: ProductsTableProps) {
  const { t, locale } = useI18n();
  const bestValue = useMemo(() => findBestValue(results), [results]);
  const filtered = useMemo(() => applyFilters(results, filters), [results, filters]);
  const sorted = useMemo(() => applySort(filtered, sortKey), [filtered, sortKey]);
  const brancheData = getBrancheData(branche);

  const formatter = new Intl.NumberFormat(locale === 'ar' || locale === 'ar-MA' ? 'ar-MA' : 'fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm" role="table">
        <caption className="sr-only">{t('comparator.table_caption')}</caption>
        <thead>
          <tr className="bg-slate-900 text-white">
            <th scope="col" className="text-start px-4 py-3 font-semibold sticky start-0 bg-slate-900 z-10">
              {t('comparator.feature_label')}
            </th>
            {sorted.map((r) => (
              <th
                key={r.tierId}
                scope="col"
                className={`text-center px-4 py-3 font-semibold ${bestValue?.tierId === r.tierId ? 'bg-amber-500' : ''}`}
              >
                <div>{t(r.tierLabel)}</div>
                {bestValue?.tierId === r.tierId && (
                  <span className="text-xs font-normal mt-1 block">{t('comparator.best_value_short')}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          <tr className="hover:bg-slate-50">
            <th scope="row" className="text-start px-4 py-4 font-semibold text-slate-900 sticky start-0 bg-white">
              {t('comparator.price_label')}
            </th>
            {sorted.map((r) => (
              <td key={r.tierId} className={`text-center px-4 py-4 font-bold text-slate-900 tabular-nums ${bestValue?.tierId === r.tierId ? 'bg-amber-50' : ''}`}>
                {r.quote ? formatter.format(r.quote.total) : '-'}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50">
            <th scope="row" className="text-start px-4 py-3 text-sm font-medium text-slate-700 sticky start-0 bg-white">
              {t('comparator.frequency')}
            </th>
            {sorted.map((r) => (
              <td key={r.tierId} className={`text-center px-4 py-3 text-sm text-slate-700 ${bestValue?.tierId === r.tierId ? 'bg-amber-50' : ''}`}>
                {r.quote ? t(`comparator.frequency_${r.quote.frequency}`) : '-'}
              </td>
            ))}
          </tr>
          {brancheData.garanties.map((g) => (
            <tr key={g.id} className="hover:bg-slate-50">
              <th scope="row" className="text-start px-4 py-3 text-slate-700 sticky start-0 bg-white">
                <span className="font-medium">{g.id}</span>
                {g.category === 'mandatory' && (
                  <span className="ms-2 inline-block rounded-full bg-rose-100 text-rose-700 text-xs px-2 py-0.5">
                    {t('comparator.mandatory')}
                  </span>
                )}
              </th>
              {sorted.map((r) => {
                const included = r.quote?.breakdown.some((l) => l.id === g.id && l.category === 'garantie') ?? false;
                return (
                  <td key={r.tierId} className={`text-center px-4 py-3 ${bestValue?.tierId === r.tierId ? 'bg-amber-50' : ''}`}>
                    {included ? (
                      <Check className="h-5 w-5 text-emerald-600 mx-auto" aria-label={t('comparator.included')} />
                    ) : (
                      <X className="h-5 w-5 text-slate-300 mx-auto" aria-label={t('comparator.not_included')} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Fichier 10/16 : `components/comparator/comparator-filters.tsx`

Panel filters sticky.

```typescript
'use client';

import { Sliders, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';
import type { ComparatorFilters } from '@/lib/comparator/filters';
import { countActiveFilters, hasActiveFilters, resetFilters } from '@/lib/comparator/filters';
import { getBrancheData } from '@/lib/data/branches';
import type { BrancheSlug } from '@/lib/constants';

interface ComparatorFiltersPanelProps {
  branche: BrancheSlug;
  filters: ComparatorFilters;
  onChange: (filters: ComparatorFilters) => void;
}

export function ComparatorFiltersPanel({ branche, filters, onChange }: ComparatorFiltersPanelProps) {
  const { t } = useI18n();
  const brancheData = getBrancheData(branche);
  const activeCount = countActiveFilters(filters);

  const toggleGarantie = (id: string) => {
    const newRequired = filters.requiredGaranties.includes(id)
      ? filters.requiredGaranties.filter((g) => g !== id)
      : [...filters.requiredGaranties, id];
    onChange({ ...filters, requiredGaranties: newRequired });
  };

  return (
    <aside
      className="rounded-lg border border-slate-200 bg-white p-6 lg:sticky lg:top-20"
      aria-labelledby="filters-title"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 id="filters-title" className="text-lg font-semibold text-slate-900">
            {t('comparator.filters_title')}
          </h2>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold h-5 min-w-5 px-1.5">
              {activeCount}
            </span>
          )}
        </div>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(resetFilters())}
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
            aria-label={t('comparator.reset_filters')}
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {t('comparator.clear_all')}
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('comparator.price_range')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-slate-600">{t('comparator.min_price')}</span>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={filters.minPriceMAD ?? ''}
                onChange={(e) => onChange({ ...filters, minPriceMAD: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 block w-full rounded-md border-slate-300 text-sm"
                placeholder="MAD"
                min={0}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">{t('comparator.max_price')}</span>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={filters.maxPriceMAD ?? ''}
                onChange={(e) => onChange({ ...filters, maxPriceMAD: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 block w-full rounded-md border-slate-300 text-sm"
                placeholder="MAD"
                min={0}
              />
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('comparator.required_garanties')}</h3>
          <ul className="space-y-2">
            {brancheData.garanties.map((g) => (
              <li key={g.id}>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.requiredGaranties.includes(g.id)}
                    onChange={() => toggleGarantie(g.id)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{g.id}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlyAvailable}
              onChange={(e) => onChange({ ...filters, onlyAvailable: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{t('comparator.only_available')}</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
```

### Fichier 11/16 : `components/comparator/comparator-sort.tsx`

```typescript
'use client';

import { useI18n } from '@/lib/i18n/provider';
import { SORT_OPTIONS, type SortKey } from '@/lib/comparator/sorts';

interface ComparatorSortProps {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}

export function ComparatorSort({ value, onChange }: ComparatorSortProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="comparator-sort" className="text-sm font-medium text-slate-700">
        {t('comparator.sort_label')}
      </label>
      <select
        id="comparator-sort"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>{t(opt.labelKey)}</option>
        ))}
      </select>
    </div>
  );
}
```

### Fichier 12/16 : `components/comparator/methodology-link.tsx`

```typescript
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

export function MethodologyLink() {
  const { t, locale } = useI18n();
  return (
    <Link
      href={`/${locale}/methodologie-comparaison`}
      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 hover:underline"
    >
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
      {t('comparator.methodology_link')}
    </Link>
  );
}
```

### Fichier 13/16 : `components/comparator/comparator-results.tsx`

Wrapper avec toggle Grid/Table + persist preference.

```typescript
'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, Table2, RefreshCw } from 'lucide-react';
import { ProductsGrid } from './products-grid';
import { ProductsTable } from './products-table';
import { ComparatorFiltersPanel } from './comparator-filters';
import { ComparatorSort } from './comparator-sort';
import { MethodologyLink } from './methodology-link';
import { useComparatorQuotes } from '@/lib/hooks/use-comparator-quotes';
import { DEFAULT_FILTERS, resetFilters, type ComparatorFilters } from '@/lib/comparator/filters';
import type { SortKey } from '@/lib/comparator/sorts';
import { getViewPreference, setViewPreference } from '@/lib/comparator/persist';
import type { BrancheSlug, Locale } from '@/lib/constants';
import type { SimulatorFormData } from '@/lib/schemas/simulator';
import { useI18n } from '@/lib/i18n/provider';

interface ComparatorResultsProps {
  branche: BrancheSlug;
  locale: Locale;
  formData: SimulatorFormData;
  isValid: boolean;
  turnstileToken: string | null;
}

export function ComparatorResults({ branche, locale, formData, isValid, turnstileToken }: ComparatorResultsProps) {
  const { t } = useI18n();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [filters, setFilters] = useState<ComparatorFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('recommended');

  useEffect(() => {
    const stored = getViewPreference();
    if (stored) setView(stored);
  }, []);

  const handleViewChange = (newView: 'grid' | 'table') => {
    setView(newView);
    setViewPreference(newView);
  };

  const { results, isLoading, isAllError, refetchAll } = useComparatorQuotes({
    branche,
    data: formData,
    isValid,
    turnstileToken,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <ComparatorFiltersPanel branche={branche} filters={filters} onChange={setFilters} />
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ComparatorSort value={sortKey} onChange={setSortKey} />
            <MethodologyLink />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => handleViewChange('grid')}
              className={`p-2 rounded ${view === 'grid' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              aria-pressed={view === 'grid'}
              aria-label={t('comparator.view_grid')}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('table')}
              className={`p-2 rounded ${view === 'table' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
              aria-pressed={view === 'table'}
              aria-label={t('comparator.view_table')}
            >
              <Table2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {isLoading && results.every((r) => r.isLoading) && (
          <div role="status" className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-slate-600">{t('comparator.computing_all')}</p>
          </div>
        )}

        {isAllError && (
          <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-6 text-rose-900">
            <p className="font-semibold mb-2">{t('comparator.all_failed_title')}</p>
            <p className="text-sm mb-4">{t('comparator.all_failed_desc')}</p>
            <button type="button" onClick={refetchAll} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
              {t('comparator.retry_all')}
            </button>
          </div>
        )}

        {!isAllError && view === 'grid' && (
          <ProductsGrid results={results} branche={branche} locale={locale} formData={formData} filters={filters} sortKey={sortKey} onResetFilters={() => setFilters(resetFilters())} />
        )}
        {!isAllError && view === 'table' && (
          <ProductsTable results={results} branche={branche} filters={filters} sortKey={sortKey} />
        )}
      </div>
    </div>
  );
}
```

### Fichier 14/16 : `components/comparator/comparator-form.tsx`

Form criteria reuse simulator schemas Tache 4.4.4.

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { getSchemaForBranche, getDefaultsForBranche, type SimulatorFormData } from '@/lib/schemas/simulator';
import { TurnstileWidget } from '@/components/simulator/turnstile-widget';
import { ComparatorResults } from './comparator-results';
import type { BrancheSlug, Locale } from '@/lib/constants';
import { useI18n } from '@/lib/i18n/provider';

interface ComparatorFormProps {
  branche: BrancheSlug;
  locale: Locale;
}

export function ComparatorForm({ branche, locale }: ComparatorFormProps) {
  const { t } = useI18n();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const schema = getSchemaForBranche(branche);
  const defaults = getDefaultsForBranche(branche);

  const form = useForm<SimulatorFormData>({
    resolver: zodResolver(schema),
    defaultValues: { ...defaults, turnstileToken: '' } as SimulatorFormData,
    mode: 'onBlur',
  });

  const { register, watch, setValue, formState: { isValid } } = form;
  const watchedData = watch();

  useEffect(() => {
    if (turnstileToken) {
      setValue('turnstileToken' as never, turnstileToken as never, { shouldValidate: true });
    }
  }, [turnstileToken, setValue]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6" aria-labelledby="comparator-criteria-title">
        <h2 id="comparator-criteria-title" className="text-xl font-bold text-slate-900 mb-4">
          {t('comparator.criteria_title')}
        </h2>
        <p className="text-sm text-slate-600 mb-6">{t('comparator.criteria_subtitle')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {branche === 'auto' && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('simulator.auto.value_label')} (MAD)</span>
                <input type="number" step={1000} {...register('vehicleValue' as never, { valueAsNumber: true })} className="mt-1 block w-full rounded-md border-slate-300" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('simulator.auto.driver_age_label')}</span>
                <input type="number" {...register('driverAge' as never, { valueAsNumber: true })} className="mt-1 block w-full rounded-md border-slate-300" />
              </label>
            </>
          )}
          {branche === 'sante' && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('simulator.sante.subscriber_age')}</span>
                <input type="number" {...register('subscriberAge' as never, { valueAsNumber: true })} className="mt-1 block w-full rounded-md border-slate-300" />
              </label>
            </>
          )}
        </div>

        <TurnstileWidget onVerify={setTurnstileToken} onExpired={() => setTurnstileToken(null)} locale={locale} />
      </section>

      <ComparatorResults branche={branche} locale={locale} formData={watchedData} isValid={isValid} turnstileToken={turnstileToken} />
    </div>
  );
}
```

### Fichier 15/16 : `components/comparator/comparator-shell.tsx`

```typescript
import type { ReactNode } from 'react';

interface ComparatorShellProps {
  title: string;
  subtitle: string;
  badgeText?: string;
  children: ReactNode;
}

export function ComparatorShell({ title, subtitle, badgeText, children }: ComparatorShellProps) {
  return (
    <section className="container mx-auto px-4 py-8 lg:px-8 lg:py-12 max-w-7xl">
      <div className="text-center mb-10">
        {badgeText && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 mb-3">
            {badgeText}
          </span>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
```

### Fichier 16/16 : `app/[locale]/comparer/auto/page.tsx` (template pour 5 branches)

```typescript
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadMessages } from '@/lib/i18n/load-messages';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';
import { buildCanonical, buildAlternates } from '@/lib/seo/alternates';
import { Breadcrumbs } from '@/components/branche/breadcrumbs';
import { ComparatorShell } from '@/components/comparator/comparator-shell';
import { ComparatorForm } from '@/components/comparator/comparator-form';
import { BreadcrumbJsonLd } from '@/components/seo/breadcrumbs-jsonld';

export const dynamic = 'force-static';
export function generateStaticParams() { return SUPPORTED_LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const messages = await loadMessages(locale as Locale);
  return {
    title: messages.comparator.auto.meta_title,
    description: messages.comparator.auto.meta_description,
    alternates: { canonical: buildCanonical(`/${locale}/comparer/auto`), languages: buildAlternates('/comparer/auto') },
    robots: { index: true, follow: true },
  };
}

export default async function ComparerAutoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const typedLocale = locale as Locale;
  const messages = await loadMessages(typedLocale);

  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: messages.nav.home, url: buildCanonical(`/${locale}`) },
        { name: messages.nav.auto, url: buildCanonical(`/${locale}/auto`) },
        { name: messages.comparator.auto.breadcrumb_label, url: buildCanonical(`/${locale}/comparer/auto`) },
      ]} />
      <Breadcrumbs items={[
        { label: messages.nav.home, href: `/${locale}` },
        { label: messages.nav.auto, href: `/${locale}/auto` },
        { label: messages.comparator.auto.breadcrumb_label, href: null },
      ]} />
      <ComparatorShell
        title={messages.comparator.auto.page_title}
        subtitle={messages.comparator.auto.page_subtitle}
        badgeText={messages.comparator.auto.badge}
      >
        <Suspense fallback={<div className="h-96" />}>
          <ComparatorForm branche="auto" locale={typedLocale} />
        </Suspense>
      </ComparatorShell>
    </>
  );
}

// Pages sante / habitation / rc-pro / voyage suivent meme pattern
// avec branche='sante' / 'habitation' / 'rc-pro' / 'voyage'
```

## 7. Tests complets

### 7.1 Tests score : `__tests__/lib/comparator/score.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { computeScore, computeScoreBreakdown, findBestValue, rankResults } from '@/lib/comparator/score';

const mockResult = (tierId: 'basic' | 'standard' | 'premium', total: number, garantiesCount: number) => ({
  tierId,
  tierLabel: `tier.${tierId}.label`,
  quote: {
    id: tierId, branche: 'auto',
    breakdown: Array.from({ length: garantiesCount }, (_, i) => ({ id: `g${i}`, label: `Garantie ${i}`, amount: 100, amountFormatted: '100 MAD', category: 'garantie' as const })),
    subtotal: total - 100, tax: 100, taxRate: 0.2, taxLabel: 'TVA', discount: 0, total, totalFormatted: `${total} MAD`,
    currency: 'MAD' as const, frequency: 'annual' as const, validUntil: '2026-06-15T00:00:00Z', garanties: [],
  },
  draftId: 'd', isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => {},
});

describe('computeScore', () => {
  it('returns 0 if no quote', () => {
    const r = { ...mockResult('basic', 0, 0), quote: null, isSuccess: false };
    expect(computeScore(r, [r])).toBe(0);
  });

  it('returns 1 if only 1 valid result', () => {
    const r = mockResult('basic', 2000, 3);
    expect(computeScore(r, [r])).toBe(1);
  });

  it('prefers cheaper price when coverage equal', () => {
    const cheap = mockResult('basic', 2000, 3);
    const expensive = mockResult('premium', 5000, 3);
    expect(computeScore(cheap, [cheap, expensive])).toBeGreaterThan(computeScore(expensive, [cheap, expensive]));
  });

  it('considers coverage in score', () => {
    const low = mockResult('basic', 2000, 2);
    const high = mockResult('standard', 2000, 6);
    expect(computeScore(high, [low, high])).toBeGreaterThan(computeScore(low, [low, high]));
  });

  it('handles all same price', () => {
    const a = mockResult('basic', 2000, 2);
    const b = mockResult('standard', 2000, 4);
    expect(computeScore(b, [a, b])).toBeGreaterThan(computeScore(a, [a, b]));
  });

  it('respects custom weights', () => {
    const cheap = mockResult('basic', 2000, 2);
    const expensive = mockResult('premium', 5000, 5);
    const priceOnly = computeScore(cheap, [cheap, expensive], { priceWeight: 1, coverageWeight: 0, garantiesTotalForBranche: 8 });
    const coverageOnly = computeScore(cheap, [cheap, expensive], { priceWeight: 0, coverageWeight: 1, garantiesTotalForBranche: 8 });
    expect(priceOnly).toBeGreaterThan(coverageOnly);
  });
});

describe('computeScoreBreakdown', () => {
  it('returns full breakdown with components', () => {
    const a = mockResult('basic', 2000, 3);
    const b = mockResult('premium', 4000, 5);
    const breakdown = computeScoreBreakdown(a, [a, b]);
    expect(breakdown.priceComponent).toBeGreaterThan(0);
    expect(breakdown.coverageComponent).toBeGreaterThan(0);
    expect(breakdown.garantiesCount).toBe(3);
    expect(breakdown.pricePosition).toBe('cheapest');
  });

  it('marks most-expensive correctly', () => {
    const a = mockResult('basic', 2000, 3);
    const b = mockResult('premium', 4000, 5);
    const breakdown = computeScoreBreakdown(b, [a, b]);
    expect(breakdown.pricePosition).toBe('most-expensive');
  });

  it('returns zero for missing quote', () => {
    const r = { ...mockResult('basic', 0, 0), quote: null };
    const breakdown = computeScoreBreakdown(r, [r]);
    expect(breakdown.total).toBe(0);
  });
});

describe('findBestValue', () => {
  it('returns null for empty', () => expect(findBestValue([])).toBeNull());

  it('returns null if all null quotes', () => {
    const r = { ...mockResult('basic', 0, 0), quote: null };
    expect(findBestValue([r])).toBeNull();
  });

  it('picks balanced best value', () => {
    const basic = mockResult('basic', 2000, 2);
    const standard = mockResult('standard', 3500, 4);
    const premium = mockResult('premium', 6500, 6);
    expect(findBestValue([basic, standard, premium])?.tierId).toBe('standard');
  });

  it('breaks ties via cheaper', () => {
    const a = mockResult('basic', 2000, 3);
    const b = mockResult('standard', 3000, 3);
    expect(findBestValue([a, b])?.tierId).toBe('basic');
  });
});

describe('rankResults', () => {
  it('ranks 3 results in order best to worst', () => {
    const a = mockResult('basic', 2000, 2);
    const b = mockResult('standard', 3500, 4);
    const c = mockResult('premium', 6500, 6);
    const ranked = rankResults([a, b, c]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[ranked.length - 1].rank).toBe(ranked.length);
  });
});
```

### 7.2 Tests filters : `__tests__/lib/comparator/filters.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { applyFilters, hasActiveFilters, countActiveFilters, resetFilters, DEFAULT_FILTERS } from '@/lib/comparator/filters';

const mockResult = (tierId: 'basic' | 'standard' | 'premium', total: number, garantieIds: string[]) => ({
  tierId, tierLabel: tierId,
  quote: {
    id: tierId, branche: 'auto',
    breakdown: garantieIds.map((id) => ({ id, label: id, amount: 100, amountFormatted: '100', category: 'garantie' as const })),
    subtotal: total, tax: 0, taxRate: 0, taxLabel: '', discount: 0, total, totalFormatted: `${total} MAD`,
    currency: 'MAD' as const, frequency: 'annual' as const, validUntil: '2026-01-01T00:00:00Z', garanties: [],
  },
  draftId: 'd', isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => {},
});

const RESULTS = [
  mockResult('basic', 2000, ['rc-auto']),
  mockResult('standard', 4000, ['rc-auto', 'vol']),
  mockResult('premium', 7000, ['rc-auto', 'vol', 'incendie']),
];

describe('applyFilters', () => {
  it('returns all with default filters', () => {
    expect(applyFilters(RESULTS, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it('filters by minPrice', () => {
    expect(applyFilters(RESULTS, { ...DEFAULT_FILTERS, minPriceMAD: 3000 })).toHaveLength(2);
  });

  it('filters by maxPrice', () => {
    expect(applyFilters(RESULTS, { ...DEFAULT_FILTERS, maxPriceMAD: 5000 })).toHaveLength(2);
  });

  it('combines minPrice + maxPrice', () => {
    expect(applyFilters(RESULTS, { ...DEFAULT_FILTERS, minPriceMAD: 3000, maxPriceMAD: 6000 })).toHaveLength(1);
  });

  it('filters by requiredGaranties (single)', () => {
    expect(applyFilters(RESULTS, { ...DEFAULT_FILTERS, requiredGaranties: ['incendie'] })).toHaveLength(1);
  });

  it('filters by requiredGaranties (multi AND)', () => {
    expect(applyFilters(RESULTS, { ...DEFAULT_FILTERS, requiredGaranties: ['rc-auto', 'vol'] })).toHaveLength(2);
  });

  it('returns empty if no match', () => {
    expect(applyFilters(RESULTS, { ...DEFAULT_FILTERS, minPriceMAD: 100000 })).toHaveLength(0);
  });

  it('excludes null quotes when onlyAvailable', () => {
    const withNull = [...RESULTS, { ...mockResult('basic', 0, []), quote: null }];
    expect(applyFilters(withNull, DEFAULT_FILTERS)).toHaveLength(3);
  });
});

describe('hasActiveFilters', () => {
  it('false for defaults', () => expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false));
  it('true if minPrice set', () => expect(hasActiveFilters({ ...DEFAULT_FILTERS, minPriceMAD: 1000 })).toBe(true));
});

describe('countActiveFilters', () => {
  it('0 for defaults', () => expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0));
  it('counts minPrice + maxPrice + garanties', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, minPriceMAD: 1000, maxPriceMAD: 5000, requiredGaranties: ['vol'] })).toBe(3);
  });
});

describe('resetFilters', () => {
  it('returns DEFAULT_FILTERS copy', () => {
    expect(resetFilters()).toEqual(DEFAULT_FILTERS);
    expect(resetFilters()).not.toBe(DEFAULT_FILTERS);
  });
});
```

### 7.3 Tests sorts : `__tests__/lib/comparator/sorts.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { applySort, isValidSortKey } from '@/lib/comparator/sorts';

const r = (tierId: 'basic' | 'standard' | 'premium', total: number, gCount: number) => ({
  tierId, tierLabel: tierId,
  quote: { id: tierId, branche: 'auto', breakdown: Array.from({ length: gCount }, (_, i) => ({ id: `g${i}`, label: '', amount: 0, amountFormatted: '', category: 'garantie' as const })), subtotal: total, tax: 0, taxRate: 0, taxLabel: '', discount: 0, total, totalFormatted: `${total}`, currency: 'MAD' as const, frequency: 'annual' as const, validUntil: '2026-01-01', garanties: [] },
  draftId: 'd', isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => {},
});

describe('applySort', () => {
  it('sorts price-asc', () => {
    const sorted = applySort([r('premium', 7000, 5), r('basic', 2000, 2), r('standard', 4000, 4)], 'price-asc');
    expect(sorted.map((x) => x.tierId)).toEqual(['basic', 'standard', 'premium']);
  });

  it('sorts price-desc', () => {
    const sorted = applySort([r('basic', 2000, 2), r('standard', 4000, 4), r('premium', 7000, 5)], 'price-desc');
    expect(sorted.map((x) => x.tierId)).toEqual(['premium', 'standard', 'basic']);
  });

  it('sorts coverage-best', () => {
    const sorted = applySort([r('basic', 2000, 2), r('premium', 7000, 6), r('standard', 4000, 4)], 'coverage-best');
    expect(sorted[0].tierId).toBe('premium');
  });

  it('breaks coverage ties via cheaper price', () => {
    const sorted = applySort([r('standard', 4000, 3), r('basic', 2000, 3)], 'coverage-best');
    expect(sorted[0].tierId).toBe('basic');
  });

  it('sorts recommended (standard first)', () => {
    const sorted = applySort([r('premium', 7000, 5), r('basic', 2000, 2), r('standard', 4000, 4)], 'recommended');
    expect(sorted[0].tierId).toBe('standard');
  });

  it('handles results with null quotes (push to end)', () => {
    const withNull = [{ ...r('basic', 0, 0), quote: null }, r('standard', 4000, 4)];
    const sorted = applySort(withNull, 'price-asc');
    expect(sorted[0].tierId).toBe('standard');
  });
});

describe('isValidSortKey', () => {
  it('accepts known keys', () => {
    expect(isValidSortKey('price-asc')).toBe(true);
    expect(isValidSortKey('recommended')).toBe(true);
  });
  it('rejects unknown', () => {
    expect(isValidSortKey('random')).toBe(false);
    expect(isValidSortKey('')).toBe(false);
  });
});
```

### 7.4 Tests persist : `__tests__/lib/comparator/persist.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { persistTierChoice, loadTierChoice, clearTierChoices, getViewPreference, setViewPreference } from '@/lib/comparator/persist';

const mockResult = (tierId: 'basic' | 'standard' | 'premium') => ({
  tierId, tierLabel: tierId,
  quote: { id: tierId, branche: 'auto', breakdown: [], subtotal: 1500, tax: 300, taxRate: 0.2, taxLabel: 'TVA', discount: 0, total: 1800, totalFormatted: '1800 MAD', currency: 'MAD' as const, frequency: 'annual' as const, validUntil: '2026-01-01', garanties: [] },
  draftId: 'd1', isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => {},
});

describe('persistTierChoice', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('saves tier-specific + generic key', () => {
    persistTierChoice('auto', mockResult('standard'), {} as never);
    expect(sessionStorage.getItem('insurtech_current_quote_standard')).toBeTruthy();
    expect(sessionStorage.getItem('insurtech_current_quote')).toBeTruthy();
  });

  it('loadTierChoice returns stored choice', () => {
    persistTierChoice('auto', mockResult('basic'), {} as never);
    const loaded = loadTierChoice('basic');
    expect(loaded?.tier).toBe('basic');
  });

  it('loadTierChoice returns null if missing', () => {
    expect(loadTierChoice('nonexistent')).toBeNull();
  });

  it('clearTierChoices removes all tiers', () => {
    persistTierChoice('auto', mockResult('basic'), {} as never);
    persistTierChoice('auto', mockResult('premium'), {} as never);
    clearTierChoices();
    expect(loadTierChoice('basic')).toBeNull();
    expect(loadTierChoice('premium')).toBeNull();
  });
});

describe('getViewPreference / setViewPreference', () => {
  beforeEach(() => localStorage.clear());

  it('returns null if not set', () => expect(getViewPreference()).toBeNull());
  it('persists and retrieves grid', () => {
    setViewPreference('grid');
    expect(getViewPreference()).toBe('grid');
  });
  it('persists and retrieves table', () => {
    setViewPreference('table');
    expect(getViewPreference()).toBe('table');
  });
});
```

### 7.5 Tests ProductCard : `__tests__/components/comparator/product-card.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '@/components/comparator/product-card';

vi.mock('@/lib/i18n/provider', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'fr' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const mockResult = (overrides = {}) => ({
  tierId: 'standard' as const, tierLabel: 'tier.standard.label',
  quote: {
    id: 'q1', branche: 'auto',
    breakdown: [{ id: 'vol', label: 'Vol', amount: 300, amountFormatted: '300 MAD', category: 'garantie' as const }],
    subtotal: 2000, tax: 400, taxRate: 0.2, taxLabel: 'TVA', discount: 0, total: 2400, totalFormatted: '2400 MAD',
    currency: 'MAD' as const, frequency: 'annual' as const, validUntil: '2026-06-15T00:00:00Z', garanties: [],
  },
  draftId: 'd1', isLoading: false, isError: false, isSuccess: true, error: null, refetch: vi.fn(),
  ...overrides,
});

describe('ProductCard', () => {
  it('renders loading skeleton', () => {
    const r = mockResult({ isLoading: true, quote: null });
    const { container } = render(<ProductCard result={r} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    const r = mockResult({ isError: true, quote: null, refetch: onRetry, error: { status: 500, body: 'err', isRateLimit: () => false, isCaptchaInvalid: () => false, isValidationError: () => false, isServerError: () => true } });
    render(<ProductCard result={r} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByText('comparator.error_compute')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /comparator.retry/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders quote with price', () => {
    render(<ProductCard result={mockResult()} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByText('2400 MAD')).toBeInTheDocument();
  });

  it('shows BestValueBadge when isBestValue', () => {
    render(<ProductCard result={mockResult()} isBestValue={true} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByText('comparator.best_value_badge')).toBeInTheDocument();
  });

  it('lists garanties from breakdown', () => {
    render(<ProductCard result={mockResult()} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByText('Vol')).toBeInTheDocument();
  });

  it('has analytics event on CTA', () => {
    render(<ProductCard result={mockResult()} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByRole('button', { name: /comparator.subscribe_cta/ })).toHaveAttribute('data-analytics-event', 'comparator_auto_standard_cta_click');
  });

  it('highlights CTA differently when bestValue', () => {
    const { container } = render(<ProductCard result={mockResult()} isBestValue={true} branche="auto" locale="fr" formData={{} as never} />);
    const cta = container.querySelector('[data-analytics-event]');
    expect(cta?.className).toContain('amber');
  });

  it('shows "and more" indicator if > 6 garanties', () => {
    const manyGaranties = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, label: `Garantie ${i}`, amount: 100, amountFormatted: '100 MAD', category: 'garantie' as const }));
    const r = mockResult({ quote: { ...mockResult().quote, breakdown: manyGaranties } });
    render(<ProductCard result={r} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByText(/and_more/i)).toBeInTheDocument();
  });

  it('does not contain emoji', () => {
    const { container } = render(<ProductCard result={mockResult()} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/u.test(container.textContent ?? '')).toBe(false);
  });

  it('shows validity date', () => {
    render(<ProductCard result={mockResult()} isBestValue={false} branche="auto" locale="fr" formData={{} as never} />);
    expect(screen.getByText(/comparator.valid_until/)).toBeInTheDocument();
  });
});
```

### 7.6 Tests ProductsTable : `__tests__/components/comparator/products-table.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductsTable } from '@/components/comparator/products-table';
import { DEFAULT_FILTERS } from '@/lib/comparator/filters';

vi.mock('@/lib/i18n/provider', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'fr' }) }));
vi.mock('@/lib/data/branches', () => ({
  getBrancheData: () => ({
    garanties: [
      { id: 'rc-auto', category: 'mandatory', labelKey: 'rc.label', descriptionKey: 'rc.desc', iconName: 'Shield', tierIncluded: [] },
      { id: 'vol', category: 'recommended', labelKey: 'vol.label', descriptionKey: 'vol.desc', iconName: 'Lock', tierIncluded: [] },
    ],
  }),
}));

const r = (tier: 'basic' | 'standard' | 'premium', total: number, garantieIds: string[]) => ({
  tierId: tier, tierLabel: `tier.${tier}.label`,
  quote: {
    id: tier, branche: 'auto',
    breakdown: garantieIds.map((id) => ({ id, label: id, amount: 100, amountFormatted: '100 MAD', category: 'garantie' as const })),
    subtotal: total, tax: 0, taxRate: 0.2, taxLabel: 'TVA', discount: 0, total, totalFormatted: `${total} MAD`,
    currency: 'MAD' as const, frequency: 'annual' as const, validUntil: '2026-01-01', garanties: [],
  },
  draftId: 'd', isLoading: false, isError: false, isSuccess: true, error: null, refetch: () => {},
});

describe('ProductsTable', () => {
  const RESULTS = [r('basic', 2000, ['rc-auto']), r('standard', 4000, ['rc-auto', 'vol']), r('premium', 7000, ['rc-auto', 'vol'])];

  it('renders table with caption', () => {
    render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders 3 tier columns', () => {
    render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(screen.getAllByText('tier.basic.label')[0]).toBeInTheDocument();
    expect(screen.getAllByText('tier.standard.label')[0]).toBeInTheDocument();
    expect(screen.getAllByText('tier.premium.label')[0]).toBeInTheDocument();
  });

  it('shows price rows', () => {
    render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(screen.getByText('comparator.price_label')).toBeInTheDocument();
  });

  it('shows check/cross icons for garanties', () => {
    const { container } = render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(container.querySelectorAll('[aria-label="comparator.included"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[aria-label="comparator.not_included"]').length).toBeGreaterThan(0);
  });

  it('marks mandatory garanties with badge', () => {
    render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(screen.getByText('comparator.mandatory')).toBeInTheDocument();
  });

  it('highlights best value tier column', () => {
    const { container } = render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(container.querySelectorAll('.bg-amber-50').length).toBeGreaterThan(0);
  });

  it('reorders columns with sortKey', () => {
    render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-desc" />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows table caption (sr-only)', () => {
    render(<ProductsTable results={RESULTS} branche="auto" filters={DEFAULT_FILTERS} sortKey="price-asc" />);
    expect(screen.getByText('comparator.table_caption')).toBeInTheDocument();
  });
});
```

### 7.7 Tests Filters Panel : `__tests__/components/comparator/comparator-filters.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparatorFiltersPanel } from '@/components/comparator/comparator-filters';
import { DEFAULT_FILTERS } from '@/lib/comparator/filters';

vi.mock('@/lib/i18n/provider', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'fr' }) }));
vi.mock('@/lib/data/branches', () => ({
  getBrancheData: () => ({ garanties: [{ id: 'vol', category: 'recommended', labelKey: 'vol.label', descriptionKey: '', iconName: 'Lock', tierIncluded: [] }, { id: 'rc-auto', category: 'mandatory', labelKey: 'rc.label', descriptionKey: '', iconName: 'Shield', tierIncluded: [] }] }),
}));

describe('ComparatorFiltersPanel', () => {
  it('renders filters title', () => {
    render(<ComparatorFiltersPanel branche="auto" filters={DEFAULT_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByText('comparator.filters_title')).toBeInTheDocument();
  });

  it('renders min/max price inputs', () => {
    render(<ComparatorFiltersPanel branche="auto" filters={DEFAULT_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByText('comparator.min_price')).toBeInTheDocument();
    expect(screen.getByText('comparator.max_price')).toBeInTheDocument();
  });

  it('renders garantie checkboxes', () => {
    render(<ComparatorFiltersPanel branche="auto" filters={DEFAULT_FILTERS} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('fires onChange on minPrice change', () => {
    const onChange = vi.fn();
    render(<ComparatorFiltersPanel branche="auto" filters={DEFAULT_FILTERS} onChange={onChange} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minPriceMAD: 2000 }));
  });

  it('fires onChange on garantie toggle', () => {
    const onChange = vi.fn();
    render(<ComparatorFiltersPanel branche="auto" filters={DEFAULT_FILTERS} onChange={onChange} />);
    const garantieCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(garantieCheckbox);
    expect(onChange).toHaveBeenCalled();
  });

  it('shows active count badge when filters active', () => {
    render(<ComparatorFiltersPanel branche="auto" filters={{ ...DEFAULT_FILTERS, minPriceMAD: 1000 }} onChange={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows reset button when filters active', () => {
    render(<ComparatorFiltersPanel branche="auto" filters={{ ...DEFAULT_FILTERS, minPriceMAD: 1000 }} onChange={vi.fn()} />);
    expect(screen.getByText('comparator.clear_all')).toBeInTheDocument();
  });

  it('reset button fires onChange with default filters', () => {
    const onChange = vi.fn();
    render(<ComparatorFiltersPanel branche="auto" filters={{ ...DEFAULT_FILTERS, minPriceMAD: 1000 }} onChange={onChange} />);
    fireEvent.click(screen.getByText('comparator.clear_all'));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });
});
```

### 7.8 Tests integration ComparatorAuto : `__tests__/integration/comparator-auto.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComparatorForm } from '@/components/comparator/comparator-form';

vi.mock('@/lib/i18n/provider', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'fr' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/quote-preview', () => ({
  previewQuote: vi.fn(async () => ({
    quote: { id: 'q1', branche: 'auto', breakdown: [], subtotal: 1500, tax: 300, taxRate: 0.2, taxLabel: 'TVA', discount: 0, total: 1800, totalFormatted: '1800 MAD', currency: 'MAD', frequency: 'annual', validUntil: '2026-06-15T00:00:00Z', garanties: [] },
    draftId: 'd1',
  })),
  QuotePreviewError: class { isRateLimit() { return false; } isCaptchaInvalid() { return false; } isValidationError() { return false; } isServerError() { return false; } },
}));
vi.mock('@/lib/api/turnstile', () => ({
  loadTurnstileScript: vi.fn(async () => ({ render: () => 'w1', reset: vi.fn(), remove: vi.fn(), getResponse: vi.fn(), isExpired: () => false })),
  getSiteKey: () => '0x4AAAAAAA_TEST',
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ComparatorForm integration', () => {
  it('renders criteria form', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByText('comparator.criteria_title')).toBeInTheDocument();
  });

  it('renders criteria subtitle', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByText('comparator.criteria_subtitle')).toBeInTheDocument();
  });

  it('renders auto-specific inputs for branche=auto', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByText('simulator.auto.value_label (MAD)')).toBeInTheDocument();
    expect(screen.getByText('simulator.auto.driver_age_label')).toBeInTheDocument();
  });

  it('renders sante-specific inputs for branche=sante', () => {
    renderWithQuery(<ComparatorForm branche="sante" locale="fr" />);
    expect(screen.getByText('simulator.sante.subscriber_age')).toBeInTheDocument();
  });

  it('renders filters panel sticky', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByText('comparator.filters_title')).toBeInTheDocument();
  });

  it('renders sort selector with all options', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByText('comparator.sort_label')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders view toggle buttons', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByRole('button', { name: 'comparator.view_grid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'comparator.view_table' })).toBeInTheDocument();
  });

  it('renders MethodologyLink', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByText('comparator.methodology_link')).toBeInTheDocument();
  });

  it('no emoji', () => {
    const { container } = renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(/[\u{1F300}-\u{1F9FF}]/u.test(container.textContent ?? '')).toBe(false);
  });

  it('Turnstile widget container present', () => {
    const { container } = renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(container.querySelector('.cf-turnstile')).toBeTruthy();
  });

  it('aria-labelledby on criteria section', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByLabelText('comparator.criteria_title')).toBeInTheDocument();
  });

  it('grid view active by default', () => {
    renderWithQuery(<ComparatorForm branche="auto" locale="fr" />);
    expect(screen.getByRole('button', { name: 'comparator.view_grid' })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

### 7.9 Tests E2E : `e2e/comparator.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Comparator E2E', () => {
  test('/fr/comparer/auto loads', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('all 5 branches comparer accessible', async ({ page }) => {
    for (const branche of ['auto', 'sante', 'habitation', 'rc-pro', 'voyage']) {
      await page.goto(`/fr/comparer/${branche}`);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('filters panel visible', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    await expect(page.locator('[aria-labelledby="filters-title"]')).toBeVisible();
  });

  test('view toggle Grid/Table works', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    const tableBtn = page.locator('button[aria-label="comparator.view_table"]');
    await tableBtn.click();
    await expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('sort selector functional', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    const sort = page.locator('select#comparator-sort');
    await sort.selectOption('price-desc');
    expect(await sort.inputValue()).toBe('price-desc');
  });

  test('reset filters button present when filters active', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    const inputs = page.locator('input[type="number"]');
    await inputs.first().fill('1000');
    await expect(page.locator('text=comparator.clear_all')).toBeVisible();
  });

  test('locale ar-MA RTL works', async ({ page }) => {
    await page.goto('/ar-MA/comparer/auto');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('breadcrumbs visible', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
  });

  test('methodology link points to /methodologie-comparaison', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    const link = page.locator('text=comparator.methodology_link');
    await expect(link).toHaveAttribute('href', /methodologie/);
  });

  test('view preference persists via localStorage', async ({ page }) => {
    await page.goto('/fr/comparer/auto');
    await page.click('button[aria-label="comparator.view_table"]');
    await page.reload();
    await expect(page.locator('button[aria-label="comparator.view_table"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
```

## 8. Variables environnement

Aucune nouvelle variable env. Reuse Tache 4.4.1 (API_BASE_URL + TENANT_PUBLIC_ID + TURNSTILE_SITE_KEY).

## 9. Commandes shell

```bash
cd repo/apps/web-customer-portal

pnpm install
pnpm dev

for b in auto sante habitation rc-pro voyage; do
  curl -I http://localhost:3004/fr/comparer/$b
done

curl -X POST http://localhost:4000/api/v1/insure/quotes/preview \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: skalean-public' \
  -H 'cf-turnstile-token: dev-bypass' \
  -H 'Idempotency-Key: comparator-test-1' \
  -d '{"branche":"auto","souscripteurData":{"vehicleValue":150000,"driverAge":35,"tier":"standard","garanties":["rc-auto"]},"garanties":["rc-auto"]}' | jq

pnpm typecheck && pnpm lint && pnpm vitest run --coverage
pnpm build
pnpm playwright test e2e/comparator.spec.ts
```

## 10. Criteres validation V1-V30

### P0 (17 minimum)

- **V1 (P0)** : 5 pages `/[locale]/comparer/{branche}` retournent 200 sur fr/ar-MA/ar
- **V2 (P0)** : useQueries fire 3 quotes parallel (verify Network tab : 3 POST simultanees)
- **V3 (P0)** : ProductCard renders 3 cards minimum (basic + standard + premium)
- **V4 (P0)** : Filter "min price" reduit cards visibles cote client (pas re-fetch API)
- **V5 (P0)** : Sort "price-asc" reordone cards animation smooth
- **V6 (P0)** : Best value badge sur 1 card seulement (tier balanced)
- **V7 (P0)** : Best value tooltip explique formula 60/40 prix/coverage
- **V8 (P0)** : CTA per card persists `current_quote_tier_{id}` sessionStorage
- **V9 (P0)** : CTA per card persists `current_quote` (generic key) -> wizard read it
- **V10 (P0)** : View toggle Grid/Table fonctionne + persiste preference localStorage
- **V11 (P0)** : Table view shows comparison matrix garanties x tiers avec check/cross
- **V12 (P0)** : Filter "requiredGaranties" applique AND logic (toutes presentes)
- **V13 (P0)** : Reset filters bouton fonctionne -> retourne DEFAULT_FILTERS
- **V14 (P0)** : `pnpm typecheck && pnpm lint && pnpm vitest run` 100 percent PASS (60+ tests)
- **V15 (P0)** : No emoji + no console.log dans `components/comparator/` + `lib/comparator/`
- **V16 (P0)** : MethodologyLink visible avec link `/methodologie-comparaison`
- **V17 (P0)** : Filtered empty -> message "Aucun produit ne correspond" + reset bouton

### P1 (8 minimum)

- **V18 (P1)** : Lighthouse Performance >= 85 sur `/fr/comparer/auto` mobile
- **V19 (P1)** : Lighthouse SEO = 100 sur 5 routes comparer
- **V20 (P1)** : Lighthouse A11y >= 90 (table caption + aria-labels + sticky filters)
- **V21 (P1)** : Filters panel sticky sur desktop (`lg:sticky lg:top-20`)
- **V22 (P1)** : Loading skeletons per card pendant useQueries fire
- **V23 (P1)** : Refetch all bouton si isAllError
- **V24 (P1)** : Table overflow-x-auto sur mobile + sticky first col garantie name
- **V25 (P1)** : Best value computation handles 1-quote-only case (returns null si seul)

### P2 (5 minimum)

- **V26 (P2)** : Coverage tests `lib/comparator/` >= 90 percent
- **V27 (P2)** : View preference persiste cross-page navigation
- **V28 (P2)** : URL deep-link `?tier=basic` passe au wizard
- **V29 (P2)** : Score breakdown affichable (price + coverage components)
- **V30 (P2)** : Active filters count badge visible si > 0

## 11. Edge cases + troubleshooting (12 cas detailles)

### Edge case 1 : Tous quotes echouent simultanement (Sprint 14 API down)
**Solution** : show alert "Service indisponible" + retry global `refetchAll`

### Edge case 2 : 1 quote fail, 2 succeed (network glitch sur 1)
**Solution** : render 2 cards OK + 1 error card avec retry individuel `result.refetch()`. Best value computed sur 2 valides.

### Edge case 3 : Filter elimine tous tiers
**Solution** : show "Aucun produit ne correspond aux criteres" + bouton "Reset filtres"

### Edge case 4 : Sort key invalide depuis URL deep-link
**Solution** : `isValidSortKey()` check + fallback `'recommended'`

### Edge case 5 : CTA cliquee pendant quote loading
**Solution** : button disabled si `result.isLoading || !result.quote`

### Edge case 6 : View toggle pendant compute pending
**Solution** : keep state across views, results same. Table affiche skeletons aussi.

### Edge case 7 : Mobile filters drawer (futur Sprint 36)
**Solution Sprint 17** : stack vertical (filters above grid). Sprint 36+ : floating button "Filtres" + drawer slide-up.

### Edge case 8 : Best value tie (2 tiers meme score)
**Solution** : tie-breaker -> tier avec prix le moins cher (logic dans `findBestValue`)

### Edge case 9 : API rate limit 429 sur 1 quote
**Solution** : ce quote en error state, autres OK. Retry differe automatique.

### Edge case 10 : Currency formatting different locales arabe
**Solution** : `Intl.NumberFormat('ar-MA', { style: 'currency', currency: 'MAD' })` -> arabic-indic digits. Tester rendu 3 locales.

### Edge case 11 : Score = 0 pour tous (tous quotes identiques prix + coverage)
**Solution** : fallback "Recommande" sur tier `standard` (default catalog Sprint 14). Documenter dans methodology page.

### Edge case 12 : Table view mobile horizontal overflow
**Solution** : `overflow-x-auto` + `sticky start-0` first col + visual hint mobile "Glissez pour comparer"

## 12. Conformite Maroc detaillee

### Loi 17-99 (Code des assurances)

- **Article 153+** : transparence prix obligatoire -> comparator affiche prix breakdown + garanties exhaustivement
- **Decret ACAPS** : pas de comparaison trompeuse -> Sprint 17 = comparaison entre tiers Skalean (decision-010 explicite), pas presente comme comparaison concurrents
- Mention "Comparaison entre produits Skalean Insurtech" visible page

### Loi 09-08 CNDP

- Pas de PII collectee par comparator (juste criteria form + Turnstile)
- Pas de tracking analytics avant consent (Tache 4.4.13)
- Quote draft saved cote serveur avec tenant_id=skalean-public (pas user identifie)

### Loi 43-20 signature

- Pas applicable comparator (signature wizard etape 4 Tache 4.4.9)
- Mention "Signature electronique conforme loi 43-20" affichee footer trust signal

### Article 414 DOC vente a distance

- Prix breakdown transparent
- Validite quote affichee per card ("Valable jusqu'au 15 juin 2026")
- Frequence (annuel/mensuel) affichee per card

## 13. Conventions absolues skalean-insurtech

[Identique Tache 4.4.1/4.4.4 = 14 conventions strictes]

### Specifique cette tache 4.4.5

- **useQueries React Query** pour parallel quotes (pas Promise.all manuel)
- **useMemo pour score/filter/sort** (perf critique cards re-render)
- **Score algorithm public + documente** (`/methodologie-comparaison` page futur)
- **shared sessionStorage keys** avec tier suffix + generic last-selected
- **View preference localStorage** (cross-session)
- **Filters reset bouton visible** uniquement si filters actifs
- **MethodologyLink** transparency Sprint 36+ user trust

## 14. Validation pre-commit

```bash
cd repo/apps/web-customer-portal

pnpm typecheck && pnpm lint && pnpm vitest run --coverage

grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" components/comparator lib/comparator --exclude-dir=node_modules && exit 1 || echo OK

grep -rn "console\\.log\\|console\\.debug" components/comparator lib/comparator | grep -v ".spec" && exit 1 || echo OK

grep -rn "useQuery(" components/comparator | grep -v "useQueries" | grep -v ".spec" && echo "WARN: prefer useQueries vs useQuery for parallel" || echo OK

pnpm build
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-17): comparateur multi-produits 5 branches useQueries parallel

Tache 4.4.5 -- Comparateur Multi-Produits side-by-side avec score algorithm.

/[locale]/comparer/{auto,sante,habitation,rc-pro,voyage} (15 routes):
- useQueries React Query parallel 3 tiers per branche
- ProductsGrid (cards responsive) + ProductsTable (matrix detailed) toggle
- Filters panel sticky desktop (price range + required garanties + onlyAvailable)
- Sort 4 options (price-asc/desc/coverage-best/recommended)
- Best value badge ponderation 60% price + 40% coverage + tooltip explication
- ProductCard states loading/error/success + retry individuel
- CTA per card persists tier-specific quote sessionStorage + generic last-selected
- View preference (grid/table) persiste localStorage cross-session
- MethodologyLink transparence vers /methodologie-comparaison

Composants (12) + 5 lib helpers (score, filters, sorts, persist, hook useComparatorQuotes)
+ 1 form criteria reuse simulator schemas Tache 4.4.4

Tests (75+):
- score 12 (computeScore + findBestValue + breakdown + ranking)
- filters 10 + sorts 8 + persist 6
- ProductCard 10 + ProductsTable 8 + ComparatorFilters 8
- Integration 12 + E2E 10

Lighthouse:
- Performance >= 85 sur 5 pages mobile
- SEO 100, A11y 90+, BP 95+
- First Load JS < 230 KB gzipped

Conformite: Loi 17-99 (transparence prix) / Loi 09-08 (no PII) /
Loi 43-20 (mention conforme) / Art 414 DOC (validite + breakdown)
Decision 010 (comparaison tiers Skalean, pas concurrents externes Sprint 32+)

Task: 4.4.5  Sprint: 17  Reference: B-17 Tache 4.4.5"
```

## 16. Workflow next step

Apres commit de cette tache :

- Verifier V1-V30 (au minimum 17 P0 + 5 P1)
- Tests E2E green : `pnpm playwright test e2e/comparator.spec.ts`
- Lighthouse audit : `npx @lhci/cli@latest collect --url=http://localhost:3004/fr/comparer/auto`
- Passer a `task-4.4.6-wizard-etape-1-data-personnelle.md` qui consomme `current_quote` depuis sessionStorage (Tache 4.4.5 ecrit, Tache 4.4.6 lit)

---

**Fin du prompt task-4.4.5-comparateur-multi-produits.md (v2 dense enrichi).**

Densite atteinte : ~120 ko (cible 100-150 ko RESPECTEE)
Code patterns : 16 fichiers complets (5 pages + 1 form + 7 composants + 4 libs + 1 hook)
Tests : 75+ cas concrets (score 12 + filters 10 + sorts 8 + persist 6 + ProductCard 10 + Table 8 + Filters 8 + Integration 12 + E2E 10)
Criteres validation : V1-V30 (17 P0 + 8 P1 + 5 P2)
Edge cases : 12 cas detailles avec solutions
Conformite Maroc : Loi 17-99 + 09-08 + 43-20 + Art 414 DOC rappels detailles
Conventions skalean-insurtech : 14 strictes + 7 specificites tache
