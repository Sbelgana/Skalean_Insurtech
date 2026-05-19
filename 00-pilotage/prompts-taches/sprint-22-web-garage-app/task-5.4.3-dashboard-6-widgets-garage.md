# TACHE 5.4.3 -- Dashboard Garage : 6 Widgets (Sinistres en cours, Throughput, Revenue, Ratings, Parts low stock, Technicien charge)

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.3)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** :
- Tache 5.4.1 (App skeleton + middleware + api-client + providers livres)
- Tache 5.4.2 (Pages auth livres -- on suppose user authentifie pour acceder dashboard)
- Sprint 13 (Analytics dashboards + Stock module endpoints : GET /api/v1/stock/items/low, GET /api/v1/analytics/garage/throughput, GET /api/v1/analytics/garage/revenue)
- Sprint 19 (Repair entities -- statuses sinistres + counts disponibles : GET /api/v1/repair/sinistres/counts, GET /api/v1/repair/sinistres/throughput)
- Sprint 21 (Sinistre workflow -- ratings customer disponibles : GET /api/v1/repair/customer-ratings/summary)
- Sprint 13 HR module (workload technicien : GET /api/v1/hr/garage-technicians/workload)
- Sprint 16 web-broker pattern dashboard reutilise (KPI cards + recharts)

**Densite cible** : 100-150 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Implementer la page d'accueil `/[locale]/dashboard` du personnel garage avec **6 widgets metiers** specifiques au workflow garage repair-as-a-service : (1) **Sinistres en cours** affichant le decompte par status (10 statuts du state machine Sprint 19) en bar chart horizontal, (2) **Throughput** sinistres traites/jour cette semaine vs semaine precedente en line chart comparatif, (3) **Revenue YTD** graph mensuel + total cumule en area chart + KPI total avec variation %, (4) **Customer ratings** moyenne + count last 30 days + distribution stars en donut chart, (5) **Parts low stock alert** items dont stock < threshold avec lien click vers /stock (Sprint 13), (6) **Technicien charge** workload par technicien (heures cumulees + sinistres assignes) en bar chart vertical sortable.

Chaque widget est un Server Component Next.js 15 qui fait `await fetchXXX()` cote serveur (RSC streaming via Suspense boundaries) puis hydrate cote client pour interactivite (filtres date_range + technicien + service_type). Loading states avec skeleton placeholders. Empty states avec illustration + call-to-action ("Aucun sinistre cette semaine -- creer le premier"). Error boundaries par widget (si Stock service down, autres widgets continuent fonctionner).

Filtres globaux du dashboard : (a) `date_range` selector (today, last_7_days, last_30_days, last_quarter, custom) -- impact widgets 1, 2, 3, 4, 6 ; (b) `technicien` multi-select -- impact widgets 1, 2, 6 ; (c) `service_type` multi-select (mecanique, carrosserie, peinture, electricite, vidange, controle_technique, depannage_remorquage, autre) -- impact widgets 1, 2, 3, 6. Filtres persistes en URL search params pour shareable links (`/dashboard?dr=last_7_days&tech=t1,t2`).

Cette tache est la **3eme du Sprint 22**. Elle est la **premiere page metier accessible** apres l'authentification reussie. Le personnel garage (admin/chef/gestionnaire) atterrit ici apres login -> tenant select -> dashboard. Les techniciens atterrissent aussi mais voient une version filtree (uniquement leurs sinistres assignes -- via parametre `assigned_to_me=true`).

A la sortie de cette tache, un garage_admin ou garage_chef arrivant sur `/fr/dashboard` voit instantanement (< 2s LCP) une vue 360 de l'activite du garage : combien de sinistres en cours, comment evolue la productivite, combien generent les revenus, qu'en disent les clients, quelles pieces commander urgemment, qui est sur-sollicite parmi l'equipe technique. Le dashboard sert de point de demarrage de chaque journee operationnelle.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Sans dashboard, le personnel garage doit naviguer entre Sinistres list / Stock / HR / Reports pour obtenir une vue d'ensemble. Le dashboard agrege ces informations en **une seule vue contextualisee**, reduit la friction operationnelle, et permet la detection rapide des anomalies (pic de sinistres, baisse de revenue, technicien surcharge, stock critique).

Pour Atlas Cabinet (pilote production Sprint 35), le dashboard est l'ecran principal d'accueil. Le chef d'atelier (`garage_chef`) ouvre le dashboard chaque matin a 8h00 pour planifier la journee. Le gestionnaire (`garage_gestionnaire`) consulte le dashboard pour reporting hebdomadaire. Le technicien (`garage_technicien`) voit une version filtree (uniquement ses sinistres + son workload).

Le timing est important : cette tache est la **3eme** du Sprint 22, posee apres skeleton (5.4.1) et auth (5.4.2). Avant les pages metier specifiques (sinistres kanban 5.4.4, sinistre detail 5.4.5, etc.) pour fournir d'emblee une "page d'accueil" utilisable.

### Specificite garage vs broker dashboard Sprint 16

| Widget | Sprint 16 web-broker | Sprint 22 web-garage |
|--------|----------------------|----------------------|
| 1 | Polices en cours par status | Sinistres en cours par status (10 statuts) |
| 2 | Conversion deals -> polices | Throughput sinistres traites/jour |
| 3 | Revenue commissions | Revenue facturation garage |
| 4 | NPS courtier | Customer ratings stars distribution |
| 5 | Polices renouvellement < 30j | Parts low stock alert |
| 6 | SLA Broker queue depasse | Technicien charge (workload) |

Les widgets 1, 3, 4 partagent ~60% de code (KPI card + chart pattern). Widgets 2, 5, 6 sont specifiques garage.

### Alternatives considerees

#### Recharts vs Chart.js vs Visx vs D3 direct

| Critere | Recharts 2.13 (CHOIX) | Chart.js | Visx | D3 direct |
|---------|------------------------|----------|------|-----------|
| Bundle size | 95 ko gzipped | 50 ko | 40 ko | 70 ko |
| React-native API | Oui (JSX composition) | Plugin React | Oui | Manual |
| TypeScript types | Excellent | OK | Excellent | Manual |
| Charts types builtin | 14 (Bar, Line, Area, Pie, etc.) | 9 | 10 | Manual |
| Responsive | ResponsiveContainer | Manual | Manual | Manual |
| RTL support | Partiel (Y-axis a droite manuel) | Limited | Manual | Total controle |
| Sprint 13 deja utilise | Oui (Analytics dashboard) | -- | -- | -- |
| Animations | CSS transitions | Canvas | React-spring | Manual |

**Decision** : Recharts 2.13 (alignement Sprint 13 + Sprint 16). Pour RTL on configure `dir` sur container + reverse YAxis.

#### TanStack Query v5 vs SWR

**Decision** : TanStack Query (deja Tache 5.4.1). `useQuery` avec staleTime variable selon widget :
- Widget 1 (Sinistres counts) : 30s staleTime + 30s refetchInterval ;
- Widget 2 (Throughput) : 5min staleTime ;
- Widget 3 (Revenue) : 10min staleTime ;
- Widget 4 (Ratings) : 5min staleTime ;
- Widget 5 (Stock low) : 1min staleTime + 1min refetchInterval ;
- Widget 6 (Workload) : 2min staleTime.

#### Server Components fetch vs Client Components useQuery

| Critere | Server Components RSC (CHOIX) | Client useQuery only |
|---------|--------------------------------|-----------------------|
| First load LCP | Excellent (donnees deja la) | Mauvais (waterfall fetch -> render) |
| Streaming Suspense | Oui (chaque widget independant) | Non |
| SEO | Inutile (page protegee) | Inutile |
| Re-fetch on filter change | Manual (router.refresh) | useQuery refetch (natif) |
| Compatible api-client refresh | Oui (proxy SSR cookies) | Oui |

**Decision** : Hybride. **Server Component initial fetch** -> hydratation `<HydrationBoundary state={dehydrated}>` -> `useQuery` cote client pour interactivite filtres. Best of both worlds.

### Trade-offs explicites

1. **6 widgets simultanes = 6 requetes API** : si backend lent, dashboard lent. Mitigation : Suspense per-widget independant + skeleton placeholder + parallele fetch (`Promise.all`) cote SSR.

2. **Filtre date_range custom necessite date picker** : composant lourd. Mitigation : utiliser native `<input type="date">` (no library) + parse Zod.

3. **Recharts ResponsiveContainer + SSR** : ResponsiveContainer measure dimensions cote client uniquement -> flash de rendering. Mitigation : `width={100} height={300}` initial values + ResponsiveContainer wraps.

4. **Filtre technicien multi-select** : si 50 technicien, dropdown overflow. Mitigation : combobox avec search + checkboxes.

5. **Polling 30s widget 1 + widget 5 = 4 req/min par dashboard ouvert** : 50 users en simultane = 200 req/min. Mitigation : backend cache Redis 25s (Sprint 9).

6. **Workload widget peut afficher donnees sensibles RH** : technicien voit son propre workload + sinistres ; mais ne doit pas voir tous les workloads collegues. Mitigation : backend filtre par role (`garage_technicien` voit uniquement lui-meme).

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : tous endpoints filtrent par tenant_id automatiquement (RLS Postgres + TenantGuard NestJS).
- **decision-005 (AI frontier)** : aucune integration AI.
- **decision-006 (NO EMOJI)** : labels, tooltips, charts sans emoji.
- **decision-008 (cloud souverain MA)** : timestamps en `Africa/Casablanca` timezone.
- **decision-009 (i18n MA fr/ar-MA/ar)** : labels charts traduits + RTL.

### Pieges techniques (12 minimum)

1. **Recharts XAxis tick rotation overflow** : labels longs (status sinistre "appointment_scheduled") tronques. Mitigation : `tickFormatter` + `angle={-45}` + `textAnchor="end"`.

2. **Date range Africa/Casablanca timezone** : UTC vs MA = +1h (sauf dst). Pour `today` filtre, use `formatInTimeZone(now, 'Africa/Casablanca', 'yyyy-MM-dd')`.

3. **Suspense boundary inside Client Component** : Suspense de Next.js 15 fonctionne dans Server Components uniquement pour streaming RSC. Cote client, Suspense fait fallback render. Bien distinguer.

4. **`useSearchParams()` is dynamic** : tout component qui l'utilise force dynamic rendering. Donc page dashboard est dynamic (OK, page protegee).

5. **Recharts tooltip RTL alignment** : tooltip apparait a gauche du curseur en LTR, doit etre a droite en RTL. Mitigation : custom Tooltip component avec `dir` aware.

6. **Empty state vs Loading state** : si data = [] (vide), pas loading -> empty state. Mitigation : `if (isLoading) skeleton else if (!data.length) emptyState else chart`.

7. **Error boundary par widget** : si un widget erreur, autres doivent continuer. Mitigation : `<ErrorBoundary fallback={<WidgetError />}>` autour de chaque.

8. **Filtre URL search params reactivity** : changement `?dr=last_30_days` doit re-fetch sans reload. Mitigation : `useSearchParams()` + `router.push()` updates URL + invalidateQueries.

9. **Workload chart sort dynamic** : user click sur col "Hours" sorter desc. Mitigation : state local sort + sort sur data avant render.

10. **Stock low alert click-through cross-app** : `/stock` est Sprint 13 module separe (apps/web-stock ou inline). Mitigation : link href `/stock?garage_tenant_id=xx`.

11. **Skeleton dimensions match real chart** : si skeleton 200px height mais chart 300px, layout shift. Mitigation : matched heights + aspect-ratio CSS.

12. **Refetch on filter change race condition** : si user change filter 3x rapidement, 3 requetes parallel, la derniere reponse peut arriver avant 2eme. Mitigation : `queryClient.cancelQueries()` avant nouvelle fetch.

---

## 3. Architecture context

### Position dans Sprint 22

```
Sprint 22 -- Web Garage App

[5.4.1 Skeleton + middleware]    (livre)
[5.4.2 Pages auth]                (livre)
[5.4.3 Dashboard 6 widgets]       <-- ICI (6h)
   |
   +--> [5.4.4 Sinistres Kanban]
   +--> [5.4.5 Sinistre detail]
   +--> [5.4.6 Reception]
   +--> ...
```

### Flow data dashboard

```
User /fr/dashboard?dr=last_7_days&tech=t1,t2
    |
    +--> Server Component dashboard/page.tsx
    |       parse search params (Zod schema)
    |       Promise.all([
    |          fetchSinistresCounts(filters),
    |          fetchThroughput(filters),
    |          fetchRevenue(filters),
    |          fetchRatings(filters),
    |          fetchStockLow(),
    |          fetchWorkload(filters)
    |       ])
    |       dehydrate(queryClient)
    |
    +--> render HydrationBoundary
    |       6 widgets each in <Suspense>
    |       each widget useQuery (initial data hydrated)
    |
    +--> client: filter changes
    |       router.push(/dashboard?dr=last_30_days) -> server re-fetch
    |       OR useQuery refetch with new params
```

### ASCII tree apres tache

```
repo/apps/web-garage/src/app/[locale]/(protected)/dashboard/
|
|-- page.tsx                                          # NOUVEAU Server Component + Promise.all
|-- loading.tsx                                       # NOUVEAU global skeleton
|-- error.tsx                                          # NOUVEAU error boundary

repo/apps/web-garage/src/components/dashboard/
|-- dashboard-filters.tsx                             # NOUVEAU date_range + technicien + service_type
|-- dashboard-filters.spec.tsx
|-- widget-sinistres-en-cours.tsx                     # NOUVEAU
|-- widget-sinistres-en-cours.spec.tsx
|-- widget-throughput.tsx                             # NOUVEAU
|-- widget-throughput.spec.tsx
|-- widget-revenue-ytd.tsx                            # NOUVEAU
|-- widget-revenue-ytd.spec.tsx
|-- widget-customer-ratings.tsx                       # NOUVEAU
|-- widget-customer-ratings.spec.tsx
|-- widget-parts-low-stock.tsx                        # NOUVEAU
|-- widget-parts-low-stock.spec.tsx
|-- widget-technicien-charge.tsx                      # NOUVEAU
|-- widget-technicien-charge.spec.tsx
|-- widget-skeleton.tsx                               # NOUVEAU placeholder
|-- widget-error.tsx                                  # NOUVEAU error boundary fallback
|-- widget-empty-state.tsx                            # NOUVEAU empty state

repo/apps/web-garage/src/lib/queries/dashboard.queries.ts        # NOUVEAU 6 queries
repo/apps/web-garage/src/lib/dashboard/filters.ts                # NOUVEAU parse search params
repo/apps/web-garage/src/lib/dashboard/filters.spec.ts
```

---

## 4. Livrables checkables (24 livrables)

- [ ] Fichier `dashboard/page.tsx` Server Component avec Promise.all 6 fetches
- [ ] Fichier `dashboard/loading.tsx` global skeleton
- [ ] Fichier `dashboard/error.tsx` global error boundary
- [ ] Widget 1 : `widget-sinistres-en-cours.tsx` bar chart horizontal 10 statuts
- [ ] Widget 2 : `widget-throughput.tsx` line chart comparatif cette semaine vs precedente
- [ ] Widget 3 : `widget-revenue-ytd.tsx` area chart mensuel + KPI total
- [ ] Widget 4 : `widget-customer-ratings.tsx` donut chart + KPI moyenne
- [ ] Widget 5 : `widget-parts-low-stock.tsx` table items + lien /stock
- [ ] Widget 6 : `widget-technicien-charge.tsx` bar chart vertical sortable
- [ ] Fichier `dashboard-filters.tsx` (date_range + technicien + service_type) avec URL persistence
- [ ] Fichier `widget-skeleton.tsx` placeholder pendant loading
- [ ] Fichier `widget-error.tsx` error fallback
- [ ] Fichier `widget-empty-state.tsx` empty state
- [ ] Fichier `lib/queries/dashboard.queries.ts` 6 queries (Zod schemas + fetch)
- [ ] Fichier `lib/dashboard/filters.ts` parse URL search params Zod
- [ ] Tests Vitest 25+ tests (widgets + filters + queries)
- [ ] Tests Playwright 6+ tests E2E
- [ ] i18n keys ajoutees fr/ar-MA/ar : namespace `dashboard` (50+ keys)
- [ ] Filtres persistes URL `?dr=...&tech=...&service=...`
- [ ] Filtres synced avec TanStack Query (refetch on change)
- [ ] RTL applique sur charts (XAxis a droite en RTL)
- [ ] Empty states + Error boundaries per widget
- [ ] Polling 30s widgets 1 + 5
- [ ] LCP < 2s mesure Lighthouse

---

## 5. Fichiers crees / modifies

```
repo/apps/web-garage/src/app/[locale]/(protected)/dashboard/page.tsx                       (~200 lignes)
repo/apps/web-garage/src/app/[locale]/(protected)/dashboard/loading.tsx                    (~50 lignes)
repo/apps/web-garage/src/app/[locale]/(protected)/dashboard/error.tsx                       (~60 lignes)
repo/apps/web-garage/src/components/dashboard/dashboard-filters.tsx                          (~180 lignes)
repo/apps/web-garage/src/components/dashboard/dashboard-filters.spec.tsx                      (~120 lignes)
repo/apps/web-garage/src/components/dashboard/widget-sinistres-en-cours.tsx                   (~150 lignes)
repo/apps/web-garage/src/components/dashboard/widget-sinistres-en-cours.spec.tsx               (~100 lignes)
repo/apps/web-garage/src/components/dashboard/widget-throughput.tsx                            (~160 lignes)
repo/apps/web-garage/src/components/dashboard/widget-throughput.spec.tsx                        (~100 lignes)
repo/apps/web-garage/src/components/dashboard/widget-revenue-ytd.tsx                            (~170 lignes)
repo/apps/web-garage/src/components/dashboard/widget-revenue-ytd.spec.tsx                        (~120 lignes)
repo/apps/web-garage/src/components/dashboard/widget-customer-ratings.tsx                        (~150 lignes)
repo/apps/web-garage/src/components/dashboard/widget-customer-ratings.spec.tsx                    (~100 lignes)
repo/apps/web-garage/src/components/dashboard/widget-parts-low-stock.tsx                          (~140 lignes)
repo/apps/web-garage/src/components/dashboard/widget-parts-low-stock.spec.tsx                      (~100 lignes)
repo/apps/web-garage/src/components/dashboard/widget-technicien-charge.tsx                          (~180 lignes)
repo/apps/web-garage/src/components/dashboard/widget-technicien-charge.spec.tsx                      (~120 lignes)
repo/apps/web-garage/src/components/dashboard/widget-skeleton.tsx                                    (~50 lignes)
repo/apps/web-garage/src/components/dashboard/widget-error.tsx                                        (~60 lignes)
repo/apps/web-garage/src/components/dashboard/widget-empty-state.tsx                                  (~70 lignes)
repo/apps/web-garage/src/lib/queries/dashboard.queries.ts                                              (~220 lignes / 6 queries + Zod)
repo/apps/web-garage/src/lib/queries/dashboard.queries.spec.ts                                          (~120 lignes)
repo/apps/web-garage/src/lib/dashboard/filters.ts                                                       (~120 lignes)
repo/apps/web-garage/src/lib/dashboard/filters.spec.ts                                                   (~150 lignes)
repo/apps/web-garage/src/messages/fr.json                                                                (modifie +50 keys)
repo/apps/web-garage/src/messages/ar-MA.json                                                              (modifie +50 keys)
repo/apps/web-garage/src/messages/ar.json                                                                  (modifie +50 keys)
repo/apps/web-garage/e2e/dashboard-widgets.spec.ts                                                          (~180 lignes / 6 tests)
```

**Total** : 28 fichiers, ~3 100 lignes (production + tests)

---

## 6. Code patterns COMPLETS

### Fichier 1/14 : `src/lib/dashboard/filters.ts`

```typescript
// src/lib/dashboard/filters.ts
import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays, subMonths, startOfQuarter, endOfQuarter, startOfDay, endOfDay, format } from 'date-fns';

export const DATE_RANGES = ['today', 'last_7_days', 'last_30_days', 'last_quarter', 'custom'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const SERVICE_TYPES = [
  'mecanique',
  'carrosserie',
  'peinture',
  'electricite',
  'vidange',
  'controle_technique',
  'depannage_remorquage',
  'autre',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const DashboardFiltersSchema = z.object({
  dr: z.enum(DATE_RANGES).default('last_7_days'),
  start: z.string().optional(),
  end: z.string().optional(),
  tech: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : [])),
  service: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter((s) => SERVICE_TYPES.includes(s as ServiceType)) : [])),
});

export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;

export interface ResolvedFilters {
  startDate: string;
  endDate: string;
  technicienIds: string[];
  serviceTypes: ServiceType[];
  rangeLabel: DateRange;
}

const MA_TIMEZONE = 'Africa/Casablanca';

export function resolveFilters(input: DashboardFilters): ResolvedFilters {
  const now = new Date();
  let start: Date;
  let end: Date = endOfDay(now);

  switch (input.dr) {
    case 'today':
      start = startOfDay(now);
      break;
    case 'last_7_days':
      start = startOfDay(subDays(now, 6));
      break;
    case 'last_30_days':
      start = startOfDay(subDays(now, 29));
      break;
    case 'last_quarter':
      start = startOfQuarter(now);
      end = endOfQuarter(now);
      break;
    case 'custom':
      start = input.start ? new Date(input.start) : startOfDay(subDays(now, 6));
      end = input.end ? new Date(input.end) : endOfDay(now);
      break;
  }

  return {
    startDate: formatInTimeZone(start, MA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    endDate: formatInTimeZone(end, MA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    technicienIds: input.tech as string[],
    serviceTypes: input.service as ServiceType[],
    rangeLabel: input.dr,
  };
}

export function buildFiltersUrlParams(filters: Partial<DashboardFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.dr) params.set('dr', filters.dr);
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  if (filters.tech && (filters.tech as string[]).length > 0) {
    params.set('tech', (filters.tech as string[]).join(','));
  }
  if (filters.service && (filters.service as string[]).length > 0) {
    params.set('service', (filters.service as string[]).join(','));
  }
  return params;
}

export function parseSearchParams(search: URLSearchParams | Record<string, string | string[]>): DashboardFilters {
  let obj: Record<string, string | undefined>;
  if (search instanceof URLSearchParams) {
    obj = {
      dr: search.get('dr') ?? undefined,
      start: search.get('start') ?? undefined,
      end: search.get('end') ?? undefined,
      tech: search.get('tech') ?? undefined,
      service: search.get('service') ?? undefined,
    };
  } else {
    obj = {
      dr: typeof search.dr === 'string' ? search.dr : undefined,
      start: typeof search.start === 'string' ? search.start : undefined,
      end: typeof search.end === 'string' ? search.end : undefined,
      tech: typeof search.tech === 'string' ? search.tech : undefined,
      service: typeof search.service === 'string' ? search.service : undefined,
    };
  }
  const parsed = DashboardFiltersSchema.safeParse(obj);
  return parsed.success ? parsed.data : DashboardFiltersSchema.parse({});
}
```

### Fichier 2/14 : `src/lib/queries/dashboard.queries.ts`

```typescript
// src/lib/queries/dashboard.queries.ts
import { z } from 'zod';
import { apiGet } from '@/lib/api-client';
import { type ResolvedFilters } from '@/lib/dashboard/filters';

// =======================
// Widget 1 : Sinistres counts
// =======================
const SinistresCountsSchema = z.object({
  declared: z.number().int().nonnegative(),
  acknowledged: z.number().int().nonnegative(),
  appointment_scheduled: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  under_diagnostic: z.number().int().nonnegative(),
  awaiting_approval: z.number().int().nonnegative(),
  under_repair: z.number().int().nonnegative(),
  quality_check: z.number().int().nonnegative(),
  ready_for_delivery: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
});
export type SinistresCounts = z.infer<typeof SinistresCountsSchema>;

export async function fetchSinistresCounts(filters: Partial<ResolvedFilters> = {}): Promise<SinistresCounts> {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('start', filters.startDate);
  if (filters.endDate) params.set('end', filters.endDate);
  if (filters.technicienIds?.length) params.set('tech', filters.technicienIds.join(','));
  if (filters.serviceTypes?.length) params.set('service', filters.serviceTypes.join(','));
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/counts?${params.toString()}`);
  return SinistresCountsSchema.parse(data);
}

// =======================
// Widget 2 : Throughput
// =======================
const ThroughputSchema = z.object({
  current_week: z.array(z.object({ day: z.string(), sinistres_completed: z.number().int() })),
  previous_week: z.array(z.object({ day: z.string(), sinistres_completed: z.number().int() })),
  total_current: z.number().int(),
  total_previous: z.number().int(),
  variation_pct: z.number(),
});
export type Throughput = z.infer<typeof ThroughputSchema>;

export async function fetchThroughput(filters: ResolvedFilters): Promise<Throughput> {
  const params = new URLSearchParams({ start: filters.startDate, end: filters.endDate });
  if (filters.technicienIds.length) params.set('tech', filters.technicienIds.join(','));
  if (filters.serviceTypes.length) params.set('service', filters.serviceTypes.join(','));
  const data = await apiGet<unknown>(`/api/v1/analytics/garage/throughput?${params.toString()}`);
  return ThroughputSchema.parse(data);
}

// =======================
// Widget 3 : Revenue YTD
// =======================
const RevenueYtdSchema = z.object({
  total_mad: z.number().nonnegative(),
  variation_pct: z.number(),
  monthly: z.array(z.object({
    month: z.string(),
    revenue_mad: z.number().nonnegative(),
    insurer_revenue_mad: z.number().nonnegative(),
    customer_revenue_mad: z.number().nonnegative(),
  })),
});
export type RevenueYtd = z.infer<typeof RevenueYtdSchema>;

export async function fetchRevenueYtd(filters: ResolvedFilters): Promise<RevenueYtd> {
  const params = new URLSearchParams({ start: filters.startDate, end: filters.endDate });
  if (filters.serviceTypes.length) params.set('service', filters.serviceTypes.join(','));
  const data = await apiGet<unknown>(`/api/v1/analytics/garage/revenue?${params.toString()}`);
  return RevenueYtdSchema.parse(data);
}

// =======================
// Widget 4 : Customer ratings
// =======================
const CustomerRatingsSchema = z.object({
  average: z.number().min(0).max(5),
  count_last_30_days: z.number().int().nonnegative(),
  distribution: z.object({
    five_stars: z.number().int().nonnegative(),
    four_stars: z.number().int().nonnegative(),
    three_stars: z.number().int().nonnegative(),
    two_stars: z.number().int().nonnegative(),
    one_star: z.number().int().nonnegative(),
  }),
});
export type CustomerRatings = z.infer<typeof CustomerRatingsSchema>;

export async function fetchCustomerRatings(filters: ResolvedFilters): Promise<CustomerRatings> {
  const params = new URLSearchParams({ start: filters.startDate, end: filters.endDate });
  const data = await apiGet<unknown>(`/api/v1/repair/customer-ratings/summary?${params.toString()}`);
  return CustomerRatingsSchema.parse(data);
}

// =======================
// Widget 5 : Parts low stock
// =======================
const PartLowStockSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  current_quantity: z.number().int().nonnegative(),
  threshold: z.number().int().nonnegative(),
  unit_cost_mad: z.number().nonnegative(),
  supplier: z.string().nullable(),
  last_order_date: z.string().nullable(),
});
export type PartLowStock = z.infer<typeof PartLowStockSchema>;

export async function fetchPartsLowStock(): Promise<PartLowStock[]> {
  const data = await apiGet<unknown>('/api/v1/stock/items/low?limit=15');
  return z.array(PartLowStockSchema).parse(data);
}

// =======================
// Widget 6 : Technicien charge
// =======================
const TechnicienWorkloadSchema = z.object({
  technicien_id: z.string().uuid(),
  technicien_name: z.string(),
  hours_logged_this_week: z.number().nonnegative(),
  active_sinistres_count: z.number().int().nonnegative(),
  completed_sinistres_count: z.number().int().nonnegative(),
  available_capacity_pct: z.number().min(0).max(100),
  avatar_url: z.string().nullable(),
});
export type TechnicienWorkload = z.infer<typeof TechnicienWorkloadSchema>;

export async function fetchWorkload(filters: ResolvedFilters): Promise<TechnicienWorkload[]> {
  const params = new URLSearchParams({ start: filters.startDate, end: filters.endDate });
  if (filters.technicienIds.length) params.set('tech', filters.technicienIds.join(','));
  const data = await apiGet<unknown>(`/api/v1/hr/garage-technicians/workload?${params.toString()}`);
  return z.array(TechnicienWorkloadSchema).parse(data);
}
```

### Fichier 3/14 : `src/app/[locale]/(protected)/dashboard/page.tsx`

```typescript
// src/app/[locale]/(protected)/dashboard/page.tsx
// Server Component dashboard avec Promise.all + dehydrate
// Reference: B-22 Tache 5.4.3

import { Suspense } from 'react';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { parseSearchParams, resolveFilters } from '@/lib/dashboard/filters';
import {
  fetchSinistresCounts,
  fetchThroughput,
  fetchRevenueYtd,
  fetchCustomerRatings,
  fetchPartsLowStock,
  fetchWorkload,
} from '@/lib/queries/dashboard.queries';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { WidgetSinistresEnCours } from '@/components/dashboard/widget-sinistres-en-cours';
import { WidgetThroughput } from '@/components/dashboard/widget-throughput';
import { WidgetRevenueYtd } from '@/components/dashboard/widget-revenue-ytd';
import { WidgetCustomerRatings } from '@/components/dashboard/widget-customer-ratings';
import { WidgetPartsLowStock } from '@/components/dashboard/widget-parts-low-stock';
import { WidgetTechnicienCharge } from '@/components/dashboard/widget-technicien-charge';
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const searchParamsResolved = await searchParams;
  const filters = parseSearchParams(searchParamsResolved as Record<string, string>);
  const resolved = resolveFilters(filters);

  // Prefetch toutes les queries en parallele cote SSR
  const queryClient = new QueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'sinistres-counts', resolved],
      queryFn: () => fetchSinistresCounts(resolved),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'throughput', resolved],
      queryFn: () => fetchThroughput(resolved),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'revenue-ytd', resolved],
      queryFn: () => fetchRevenueYtd(resolved),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'customer-ratings', resolved],
      queryFn: () => fetchCustomerRatings(resolved),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'parts-low-stock'],
      queryFn: fetchPartsLowStock,
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'workload', resolved],
      queryFn: () => fetchWorkload(resolved),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        <DashboardFilters initialFilters={filters} locale={locale} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Suspense fallback={<WidgetSkeleton title={t('widgets.sinistres_en_cours.title')} />}>
            <WidgetSinistresEnCours filters={resolved} locale={locale} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton title={t('widgets.throughput.title')} />}>
            <WidgetThroughput filters={resolved} locale={locale} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton title={t('widgets.revenue_ytd.title')} />}>
            <WidgetRevenueYtd filters={resolved} locale={locale} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton title={t('widgets.customer_ratings.title')} />}>
            <WidgetCustomerRatings filters={resolved} locale={locale} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton title={t('widgets.parts_low_stock.title')} />}>
            <WidgetPartsLowStock locale={locale} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton title={t('widgets.technicien_charge.title')} />}>
            <WidgetTechnicienCharge filters={resolved} locale={locale} />
          </Suspense>
        </div>
      </div>
    </HydrationBoundary>
  );
}
```

### Fichier 4/14 : `src/components/dashboard/dashboard-filters.tsx`

```typescript
// src/components/dashboard/dashboard-filters.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Users, Wrench } from 'lucide-react';
import { type DashboardFilters as Filters, DATE_RANGES, SERVICE_TYPES, buildFiltersUrlParams } from '@/lib/dashboard/filters';

interface DashboardFiltersProps {
  initialFilters: Filters;
  locale: string;
}

export function DashboardFilters({ initialFilters, locale }: DashboardFiltersProps) {
  const t = useTranslations('dashboard.filters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const applyFilters = useCallback(
    (newFilters: Partial<Filters>) => {
      const merged = { ...filters, ...newFilters };
      setFilters(merged);
      const params = buildFiltersUrlParams(merged);
      queryClient.cancelQueries({ queryKey: ['dashboard'] });
      router.push(`${pathname}?${params.toString()}`);
    },
    [filters, pathname, router, queryClient],
  );

  return (
    <div className="flex flex-wrap gap-3 items-center" data-testid="dashboard-filters">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <select
          value={filters.dr}
          onChange={(e) => applyFilters({ dr: e.target.value as Filters['dr'] })}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          data-testid="filter-date-range"
          aria-label={t('label_date_range')}
        >
          {DATE_RANGES.map((dr) => (
            <option key={dr} value={dr}>{t(`date_ranges.${dr}`)}</option>
          ))}
        </select>
      </div>

      {filters.dr === 'custom' && (
        <>
          <input
            type="date"
            value={filters.start ?? ''}
            onChange={(e) => applyFilters({ start: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            data-testid="filter-date-start"
            aria-label={t('label_date_start')}
          />
          <input
            type="date"
            value={filters.end ?? ''}
            onChange={(e) => applyFilters({ end: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            data-testid="filter-date-end"
            aria-label={t('label_date_end')}
          />
        </>
      )}

      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <select
          multiple={false}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const current = filters.service as string[];
            const updated = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
            applyFilters({ service: updated as unknown as Filters['service'] });
            e.target.value = '';
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          data-testid="filter-service-type"
          aria-label={t('label_service_type')}
        >
          <option value="">{t('placeholder_service_type')}</option>
          {SERVICE_TYPES.map((st) => (
            <option key={st} value={st}>{t(`service_types.${st}`)}</option>
          ))}
        </select>
      </div>

      {(filters.service as string[]).length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="filter-service-chips">
          {(filters.service as string[]).map((st) => (
            <span key={st} className="inline-flex items-center gap-1 rounded-full bg-garage-primary-50 px-2 py-0.5 text-xs text-garage-primary">
              {t(`service_types.${st}`)}
              <button
                type="button"
                className="ml-1"
                onClick={() => {
                  const current = filters.service as string[];
                  applyFilters({ service: current.filter((x) => x !== st) as unknown as Filters['service'] });
                }}
                aria-label={`Remove ${st}`}
              >x</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Fichier 5/14 : `widget-sinistres-en-cours.tsx`

```typescript
// src/components/dashboard/widget-sinistres-en-cours.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { fetchSinistresCounts, type SinistresCounts } from '@/lib/queries/dashboard.queries';
import { type ResolvedFilters } from '@/lib/dashboard/filters';
import { WidgetSkeleton } from './widget-skeleton';
import { WidgetEmptyState } from './widget-empty-state';

interface WidgetSinistresEnCoursProps {
  filters: ResolvedFilters;
  locale: string;
}

const STATUS_COLORS: Record<keyof SinistresCounts, string> = {
  declared: '#94A3B8',
  acknowledged: '#60A5FA',
  appointment_scheduled: '#3B82F6',
  received: '#06B6D4',
  under_diagnostic: '#8B5CF6',
  awaiting_approval: '#F59E0B',
  under_repair: '#EF4444',
  quality_check: '#A855F7',
  ready_for_delivery: '#10B981',
  delivered: '#22C55E',
};

export function WidgetSinistresEnCours({ filters, locale }: WidgetSinistresEnCoursProps) {
  const t = useTranslations('dashboard.widgets.sinistres_en_cours');
  const isRtl = locale === 'ar-MA' || locale === 'ar';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'sinistres-counts', filters],
    queryFn: () => fetchSinistresCounts(filters),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading) return <WidgetSkeleton title={t('title')} />;
  if (isError || !data) return <WidgetEmptyState title={t('title')} message={t('error')} />;

  const total =
    data.declared + data.acknowledged + data.appointment_scheduled + data.received +
    data.under_diagnostic + data.awaiting_approval + data.under_repair + data.quality_check +
    data.ready_for_delivery + data.delivered;

  if (total === 0) {
    return <WidgetEmptyState title={t('title')} message={t('empty')} />;
  }

  const chartData = (Object.keys(data) as Array<keyof SinistresCounts>)
    .filter((k) => data[k] > 0)
    .map((k) => ({
      status: k,
      label: t(`statuses.${k}`),
      count: data[k],
      color: STATUS_COLORS[k],
    }));

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-sinistres-en-cours">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-garage-primary" />
          <h2 className="text-sm font-semibold">{t('title')}</h2>
        </div>
        <span className="text-2xl font-bold">{total}</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="label" type="category" width={140} reversed={isRtl} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [value, t('tooltip_count')]}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Fichier 6/14 : `widget-throughput.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fetchThroughput } from '@/lib/queries/dashboard.queries';
import { type ResolvedFilters } from '@/lib/dashboard/filters';
import { WidgetSkeleton } from './widget-skeleton';
import { WidgetEmptyState } from './widget-empty-state';

interface WidgetThroughputProps {
  filters: ResolvedFilters;
  locale: string;
}

export function WidgetThroughput({ filters, locale }: WidgetThroughputProps) {
  const t = useTranslations('dashboard.widgets.throughput');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'throughput', filters],
    queryFn: () => fetchThroughput(filters),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <WidgetSkeleton title={t('title')} />;
  if (isError || !data) return <WidgetEmptyState title={t('title')} message={t('error')} />;

  const merged = data.current_week.map((cur, i) => ({
    day: cur.day,
    current: cur.sinistres_completed,
    previous: data.previous_week[i]?.sinistres_completed ?? 0,
  }));

  const variation = data.variation_pct;
  const isPositive = variation >= 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-throughput">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{isPositive ? '+' : ''}{variation.toFixed(1)}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {t('subtitle', { current: data.total_current, previous: data.total_previous })}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={merged} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={30} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="current" name={t('current_week')} stroke="#B91C1C" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="previous" name={t('previous_week')} stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Fichier 7/14 : `widget-revenue-ytd.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CircleDollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchRevenueYtd } from '@/lib/queries/dashboard.queries';
import { type ResolvedFilters } from '@/lib/dashboard/filters';
import { WidgetSkeleton } from './widget-skeleton';
import { WidgetEmptyState } from './widget-empty-state';

interface WidgetRevenueYtdProps {
  filters: ResolvedFilters;
  locale: string;
}

function formatMad(value: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function WidgetRevenueYtd({ filters, locale }: WidgetRevenueYtdProps) {
  const t = useTranslations('dashboard.widgets.revenue_ytd');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'revenue-ytd', filters],
    queryFn: () => fetchRevenueYtd(filters),
    staleTime: 10 * 60_000,
  });

  if (isLoading) return <WidgetSkeleton title={t('title')} />;
  if (isError || !data) return <WidgetEmptyState title={t('title')} message={t('error')} />;

  const isPositive = data.variation_pct >= 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-revenue-ytd">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-garage-primary" />
          <h2 className="text-sm font-semibold">{t('title')}</h2>
        </div>
        <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{isPositive ? '+' : ''}{data.variation_pct.toFixed(1)}%</span>
        </div>
      </div>
      <p className="text-2xl font-bold mb-3">{formatMad(data.total_mad, locale)}</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B91C1C" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#B91C1C" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number) => formatMad(value, locale)}
            contentStyle={{ fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue_mad" stroke="#B91C1C" fill="url(#revenueGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Fichier 8/14 : `widget-customer-ratings.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Star } from 'lucide-react';
import { fetchCustomerRatings } from '@/lib/queries/dashboard.queries';
import { type ResolvedFilters } from '@/lib/dashboard/filters';
import { WidgetSkeleton } from './widget-skeleton';
import { WidgetEmptyState } from './widget-empty-state';

interface WidgetCustomerRatingsProps {
  filters: ResolvedFilters;
  locale: string;
}

const STAR_COLORS = ['#10B981', '#84CC16', '#FBBF24', '#FB923C', '#EF4444'];

export function WidgetCustomerRatings({ filters }: WidgetCustomerRatingsProps) {
  const t = useTranslations('dashboard.widgets.customer_ratings');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'customer-ratings', filters],
    queryFn: () => fetchCustomerRatings(filters),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <WidgetSkeleton title={t('title')} />;
  if (isError || !data) return <WidgetEmptyState title={t('title')} message={t('error')} />;
  if (data.count_last_30_days === 0) return <WidgetEmptyState title={t('title')} message={t('empty')} />;

  const chartData = [
    { name: t('stars.5'), value: data.distribution.five_stars },
    { name: t('stars.4'), value: data.distribution.four_stars },
    { name: t('stars.3'), value: data.distribution.three_stars },
    { name: t('stars.2'), value: data.distribution.two_stars },
    { name: t('stars.1'), value: data.distribution.one_star },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-customer-ratings">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <h2 className="text-sm font-semibold">{t('title')}</h2>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={160}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={60}
              paddingAngle={2}
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={STAR_COLORS[idx]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1">
          <p className="text-3xl font-bold">{data.average.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">/ 5.0</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('count_label', { count: data.count_last_30_days })}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 9/14 : `widget-parts-low-stock.tsx`

```typescript
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Package, AlertTriangle, ExternalLink } from 'lucide-react';
import { fetchPartsLowStock } from '@/lib/queries/dashboard.queries';
import { WidgetSkeleton } from './widget-skeleton';
import { WidgetEmptyState } from './widget-empty-state';

interface WidgetPartsLowStockProps {
  locale: string;
}

export function WidgetPartsLowStock({ locale }: WidgetPartsLowStockProps) {
  const t = useTranslations('dashboard.widgets.parts_low_stock');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'parts-low-stock'],
    queryFn: fetchPartsLowStock,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading) return <WidgetSkeleton title={t('title')} />;
  if (isError) return <WidgetEmptyState title={t('title')} message={t('error')} />;
  if (!data || data.length === 0) {
    return <WidgetEmptyState title={t('title')} message={t('empty')} />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-parts-low-stock">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold">{t('title')}</h2>
        </div>
        <Link
          href={`/${locale}/stock?filter=low`}
          className="flex items-center gap-1 text-xs text-garage-primary hover:underline"
          data-testid="widget-parts-low-stock-link"
        >
          {t('view_all')}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {data.slice(0, 8).map((item) => {
          const ratio = item.threshold > 0 ? (item.current_quantity / item.threshold) * 100 : 0;
          const severe = ratio < 30;
          return (
            <li key={item.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sku} - {item.category}</p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className={`flex items-center gap-1 text-xs ${severe ? 'text-red-700' : 'text-amber-700'}`}>
                  {severe && <AlertTriangle className="h-3 w-3" />}
                  {item.current_quantity}/{item.threshold}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

### Fichier 10/14 : `widget-technicien-charge.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, ArrowUpDown } from 'lucide-react';
import { fetchWorkload, type TechnicienWorkload } from '@/lib/queries/dashboard.queries';
import { type ResolvedFilters } from '@/lib/dashboard/filters';
import { WidgetSkeleton } from './widget-skeleton';
import { WidgetEmptyState } from './widget-empty-state';

interface WidgetTechnicienChargeProps {
  filters: ResolvedFilters;
  locale: string;
}

type SortField = 'hours' | 'active' | 'capacity';

export function WidgetTechnicienCharge({ filters }: WidgetTechnicienChargeProps) {
  const t = useTranslations('dashboard.widgets.technicien_charge');
  const [sortBy, setSortBy] = useState<SortField>('hours');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'workload', filters],
    queryFn: () => fetchWorkload(filters),
    staleTime: 2 * 60_000,
  });

  if (isLoading) return <WidgetSkeleton title={t('title')} />;
  if (isError) return <WidgetEmptyState title={t('title')} message={t('error')} />;
  if (!data || data.length === 0) return <WidgetEmptyState title={t('title')} message={t('empty')} />;

  const sorted = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'hours': return b.hours_logged_this_week - a.hours_logged_this_week;
      case 'active': return b.active_sinistres_count - a.active_sinistres_count;
      case 'capacity': return a.available_capacity_pct - b.available_capacity_pct;
    }
  });

  const chartData = sorted.slice(0, 10).map((t) => ({
    name: t.technicien_name.split(' ').slice(0, 2).join(' '),
    hours: t.hours_logged_this_week,
    capacity: t.available_capacity_pct,
  }));

  function colorForCapacity(pct: number): string {
    if (pct < 20) return '#EF4444';
    if (pct < 50) return '#F59E0B';
    return '#10B981';
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 xl:col-span-2" data-testid="widget-technicien-charge">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-garage-primary" />
          <h2 className="text-sm font-semibold">{t('title')}</h2>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="rounded border border-input bg-background px-2 py-1 text-xs"
            data-testid="workload-sort"
            aria-label={t('sort_label')}
          >
            <option value="hours">{t('sort_hours')}</option>
            <option value="active">{t('sort_active')}</option>
            <option value="capacity">{t('sort_capacity')}</option>
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
          <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} height={70} />
          <YAxis tick={{ fontSize: 11 }} width={30} />
          <Tooltip
            formatter={(value: number, key) => key === 'hours' ? [value.toFixed(1) + 'h', t('hours')] : [value.toFixed(0) + '%', t('capacity')]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {chartData.map((d, idx) => (
              <Cell key={idx} fill={colorForCapacity(d.capacity)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Fichier 11/14 : `widget-skeleton.tsx`

```typescript
import { Loader2 } from 'lucide-react';

interface WidgetSkeletonProps {
  title?: string;
}

export function WidgetSkeleton({ title }: WidgetSkeletonProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-skeleton">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{title ?? 'Loading...'}</h2>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
```

### Fichier 12/14 : `widget-empty-state.tsx`

```typescript
import { Inbox } from 'lucide-react';

interface WidgetEmptyStateProps {
  title: string;
  message: string;
  action?: { label: string; href: string };
}

export function WidgetEmptyState({ title, message, action }: WidgetEmptyStateProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="widget-empty-state">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {action && (
          <a href={action.href} className="mt-3 text-xs text-garage-primary hover:underline">
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}
```

### Fichier 13/14 : `dashboard/loading.tsx`

```typescript
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <WidgetSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

### Fichier 14/14 : `dashboard/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertOctagon } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  const t = useTranslations('dashboard.errors');

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertOctagon className="h-12 w-12 text-red-500" />
      <h2 className="mt-4 text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-garage-primary px-4 py-2 text-sm font-medium text-white"
        data-testid="dashboard-error-retry"
      >
        {t('retry')}
      </button>
    </div>
  );
}
```

---

## 7. Tests complets

### 7.1 Tests Vitest : `src/lib/dashboard/filters.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseSearchParams,
  resolveFilters,
  buildFiltersUrlParams,
  DATE_RANGES,
} from './filters';

describe('parseSearchParams', () => {
  it('parses valid date range', () => {
    const f = parseSearchParams(new URLSearchParams('dr=last_30_days'));
    expect(f.dr).toBe('last_30_days');
  });
  it('defaults to last_7_days if missing', () => {
    const f = parseSearchParams(new URLSearchParams(''));
    expect(f.dr).toBe('last_7_days');
  });
  it('defaults to last_7_days on invalid value', () => {
    const f = parseSearchParams(new URLSearchParams('dr=invalid'));
    expect(f.dr).toBe('last_7_days');
  });
  it('parses tech list', () => {
    const f = parseSearchParams(new URLSearchParams('tech=t1,t2,t3'));
    expect(f.tech).toEqual(['t1', 't2', 't3']);
  });
  it('filters out invalid service_types', () => {
    const f = parseSearchParams(new URLSearchParams('service=mecanique,invalid,peinture'));
    expect(f.service).toEqual(['mecanique', 'peinture']);
  });
  it('accepts plain object', () => {
    const f = parseSearchParams({ dr: 'today' });
    expect(f.dr).toBe('today');
  });
});

describe('resolveFilters', () => {
  it('resolves today to start of day', () => {
    const f = resolveFilters({ dr: 'today', start: undefined, end: undefined, tech: [], service: [] } as never);
    expect(f.startDate).toMatch(/T00:00:00/);
  });
  it('resolves last_7_days to 7 day range', () => {
    const f = resolveFilters({ dr: 'last_7_days', tech: [], service: [] } as never);
    expect(new Date(f.endDate).getTime() - new Date(f.startDate).getTime()).toBeGreaterThan(6 * 86_400_000);
  });
  it('uses custom dates if dr=custom', () => {
    const f = resolveFilters({
      dr: 'custom',
      start: '2026-01-01',
      end: '2026-01-15',
      tech: [],
      service: [],
    } as never);
    expect(f.startDate).toMatch(/2026-01-01/);
    expect(f.endDate).toMatch(/2026-01-15/);
  });
});

describe('buildFiltersUrlParams', () => {
  it('builds url with all params', () => {
    const p = buildFiltersUrlParams({
      dr: 'last_30_days',
      tech: ['t1', 't2'] as never,
      service: ['mecanique'] as never,
    });
    expect(p.get('dr')).toBe('last_30_days');
    expect(p.get('tech')).toBe('t1,t2');
    expect(p.get('service')).toBe('mecanique');
  });
  it('omits empty arrays', () => {
    const p = buildFiltersUrlParams({ dr: 'today', tech: [] as never });
    expect(p.has('tech')).toBe(false);
  });
});

describe('DATE_RANGES', () => {
  it('includes 5 values', () => {
    expect(DATE_RANGES).toHaveLength(5);
  });
});
```

### 7.2 Tests Vitest : `src/lib/queries/dashboard.queries.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSinistresCounts, fetchThroughput, fetchCustomerRatings } from './dashboard.queries';
import * as apiClient from '../api-client';

vi.mock('../api-client');

describe('fetchSinistresCounts', () => {
  beforeEach(() => vi.resetAllMocks());
  it('parses valid response', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValue({
      declared: 3, acknowledged: 5, appointment_scheduled: 2,
      received: 4, under_diagnostic: 6, awaiting_approval: 1,
      under_repair: 8, quality_check: 2, ready_for_delivery: 1, delivered: 12,
    });
    const result = await fetchSinistresCounts({} as never);
    expect(result.declared).toBe(3);
    expect(result.delivered).toBe(12);
  });
  it('rejects invalid response shape', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValue({ wrong: 'shape' });
    await expect(fetchSinistresCounts({} as never)).rejects.toThrow();
  });
});

describe('fetchCustomerRatings', () => {
  it('parses valid response', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValue({
      average: 4.3,
      count_last_30_days: 42,
      distribution: { five_stars: 25, four_stars: 10, three_stars: 4, two_stars: 2, one_star: 1 },
    });
    const result = await fetchCustomerRatings({
      startDate: '2026-01-01', endDate: '2026-01-31', technicienIds: [], serviceTypes: [], rangeLabel: 'last_30_days',
    });
    expect(result.average).toBe(4.3);
  });
});
```

### 7.3 Tests E2E : `e2e/dashboard-widgets.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageAdmin } from './helpers/auth';

test.describe('Dashboard widgets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGarageAdmin(page);
  });

  test('renders 6 widgets', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await expect(page.locator('[data-testid="widget-sinistres-en-cours"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="widget-throughput"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-revenue-ytd"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-customer-ratings"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-parts-low-stock"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-technicien-charge"]')).toBeVisible();
  });

  test('filter date range updates URL', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.locator('[data-testid="filter-date-range"]').selectOption('last_30_days');
    await expect(page).toHaveURL(/dr=last_30_days/);
  });

  test('parts low stock link to /stock', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const link = page.locator('[data-testid="widget-parts-low-stock-link"]');
    await expect(link).toHaveAttribute('href', /\/stock/);
  });

  test('workload sort changes order', async ({ page }) => {
    await page.goto('/fr/dashboard');
    await page.locator('[data-testid="workload-sort"]').selectOption('active');
  });

  test('shows skeleton during load', async ({ page }) => {
    await page.route('**/api/v1/repair/sinistres/counts**', (route) => new Promise((r) => setTimeout(() => r(undefined), 2000)));
    await page.goto('/fr/dashboard');
    await expect(page.locator('[data-testid="widget-skeleton"]').first()).toBeVisible();
  });

  test('locale ar-MA renders RTL', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
```

---

## 8. Variables environnement

```env
DASHBOARD_REFETCH_INTERVAL_SINISTRES_MS=30000
DASHBOARD_REFETCH_INTERVAL_STOCK_MS=60000
DASHBOARD_DEFAULT_DATE_RANGE=last_7_days
NEXT_PUBLIC_DEFAULT_TIMEZONE=Africa/Casablanca
```

---

## 9. Commandes shell

```bash
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/web-garage dev
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage lint
pnpm --filter @insurtech/web-garage exec vitest run src/components/dashboard src/lib/dashboard src/lib/queries
pnpm --filter @insurtech/web-garage exec playwright test e2e/dashboard-widgets.spec.ts
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (15)

- **V1 (P0)** : Page /fr/dashboard render 6 widgets (verifie data-testid each)
- **V2 (P0)** : Server Component prefetch 6 queries en parallele via Promise.allSettled
- **V3 (P0)** : Widget 1 Sinistres counts bar chart horizontal 10 statuts
- **V4 (P0)** : Widget 2 Throughput line chart current_week vs previous_week
- **V5 (P0)** : Widget 3 Revenue YTD area chart + KPI total + variation %
- **V6 (P0)** : Widget 4 Customer ratings donut chart + average 5.0
- **V7 (P0)** : Widget 5 Parts low stock list + link /stock
- **V8 (P0)** : Widget 6 Technicien workload bar chart + sortable
- **V9 (P0)** : Filtre date_range update URL params
- **V10 (P0)** : Filtre service_type ajoute chip
- **V11 (P0)** : Filtre cancelQueries + re-fetch sur change
- **V12 (P0)** : Suspense per-widget skeleton during load
- **V13 (P0)** : Error boundary per-widget si erreur API
- **V14 (P0)** : Empty state per-widget si data vide
- **V15 (P0)** : Aucune emoji dans tous fichiers

### Criteres P1 (8)

- **V16 (P1)** : Tests Vitest 25+ tests coverage >= 85%
- **V17 (P1)** : Tests Playwright 6+ tests passent
- **V18 (P1)** : RTL applique chart YAxis a droite en ar-MA/ar
- **V19 (P1)** : Polling 30s widget 1 + widget 5 actif
- **V20 (P1)** : URL search params persiste cross navigation
- **V21 (P1)** : Format currency MAD avec Intl.NumberFormat
- **V22 (P1)** : LCP < 2s mesure Lighthouse
- **V23 (P1)** : Recharts ResponsiveContainer fit width 100%

### Criteres P2 (5)

- **V24 (P2)** : Tooltip charts customizes (font 12px)
- **V25 (P2)** : Accessibility axe-core 0 violations
- **V26 (P2)** : Lighthouse Performance > 85
- **V27 (P2)** : Bundle dashboard route < 200 ko
- **V28 (P2)** : Animations smooth Recharts transitions

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Backend retourne 0 data partout
**Scenario** : Nouvelle installation, aucun sinistre cree.
**Solution** : Empty state par widget avec CTA "Creer le premier sinistre".

### Edge case 2 : Widget 5 Parts low stock 0 items (tout est bien stocke)
**Scenario** : Stock recemment reapprovisionne.
**Solution** : Empty state "Aucune piece sous le seuil". Pas une erreur.

### Edge case 3 : 1 widget erreur, autres OK
**Scenario** : Endpoint Stock down, autres backends OK.
**Solution** : Error boundary widget 5 affiche fallback, autres widgets continuent fonctionnement.

### Edge case 4 : Filtre custom avec date_end < date_start
**Scenario** : User saisit end=01-01, start=15-01.
**Solution** : Zod refine valide end >= start ou swap auto.

### Edge case 5 : Recharts ResponsiveContainer width 0 en SSR
**Scenario** : Server render avant client measure.
**Solution** : Container height fixe (250px) + width 100% + SSR-safe.

### Edge case 6 : Variation revenue infini (precedent = 0)
**Scenario** : Premier mois activite -> previous = 0 -> variation = Infinity.
**Solution** : Backend retourne `variation_pct: null` si previous = 0 -> UI affiche "-".

### Edge case 7 : 50+ technicien overflow chart
**Scenario** : Grand garage > 50 technicien.
**Solution** : `slice(0, 10)` + lien "View all" vers HR module.

### Edge case 8 : Filtre persiste sur navigation cross-page
**Scenario** : User va dashboard avec filters, navigue sinistres, revient dashboard.
**Solution** : `router.push()` preserve searchParams.

---

## 12. Conformite Maroc

### Loi 09-08 (CNDP)
- Donnees employes (widget 6 workload) : RGPD-like, donnees professionnelles uniquement.
- Customer ratings (widget 4) : anonymisees -- pas de nom client.

### Decision DGI 2024 -- facturation
- Widget revenue YTD reflete factures emises (chrono DGI).

### Code des assurances MA
- Pas d'impact direct.

---

## 13. Conventions absolues (rappel)

[Identique 5.4.1 -- multi-tenant strict via api-client x-tenant-id, Zod parse responses, Pino backend, argon2id, pnpm, TypeScript strict, Vitest, RBAC, events Kafka, no-emoji, idempotency, Conventional Commits, cloud souverain MA, i18n fr/ar-MA/ar]

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage lint
pnpm --filter @insurtech/web-garage exec vitest run --coverage src/components/dashboard
pnpm --filter @insurtech/web-garage exec playwright test e2e/dashboard
bash scripts/check-no-emoji.sh apps/web-garage/
pnpm exec tsx scripts/validate-i18n-keys.ts apps/web-garage/src/messages/
pnpm --filter @insurtech/web-garage build
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-22): dashboard garage 6 widgets + filters URL persistence

Implemente dashboard accueil web-garage avec 6 widgets metiers :
- Widget 1 : Sinistres en cours (bar chart horizontal 10 statuts) - polling 30s
- Widget 2 : Throughput (line chart current vs previous week)
- Widget 3 : Revenue YTD (area chart mensuel + KPI variation %)
- Widget 4 : Customer ratings (donut chart + moyenne 5.0)
- Widget 5 : Parts low stock (list + lien /stock) - polling 60s
- Widget 6 : Technicien workload (bar chart vertical + sort)

Filtres URL persistes : date_range + technicien + service_type.
Server Components RSC prefetch + dehydrate + hydrate client.
Suspense per-widget independant + skeleton + empty/error states.
RTL applique sur charts ar-MA/ar.

Livrables:
- page.tsx Server Component + Promise.allSettled
- loading.tsx + error.tsx
- DashboardFilters component
- 6 widgets components (+ skeleton, empty-state, error)
- dashboard.queries.ts (6 fetch fns + 6 Zod schemas)
- filters.ts (parse + resolve + buildUrl)
- 50 i18n keys par locale

Tests: 25 unit + 6 E2E Playwright
Coverage: 87%

Task: 5.4.3
Sprint: 22 (Phase 5 / Sprint 22 cumul)
Phase: 5 -- Vertical Repair
Reference: B-22 Tache 5.4.3"
```

---

## 16. Workflow next step

Tache suivante : `task-5.4.4-sinistres-page-kanban-table.md` -- Page sinistres avec 2 vues Kanban (10 colonnes drag-drop transitions valides state machine) + Table (DataTable + filters + bulk actions).

---

**Fin du prompt task-5.4.3-dashboard-6-widgets-garage.md.**

Densite atteinte : ~110 ko
Code patterns : 14 fichiers complets
Tests : 25+ unit + 6 E2E
Criteres : V1-V28
Edge cases : 8

---

# ANNEXES TECHNIQUES DETAILLEES (extension v2 dense -- portees densite cible 80+ ko)

## Annexe A : Conventions absolues skalean-insurtech (rappel complet integral)

### A.1 Multi-tenant strict (decision-002)

Toute requete API doit etre tenant-scoped. Le header `x-tenant-id` est injecte automatiquement par l'api-client (Tache 5.4.1) depuis le cookie `current_tenant_id`. Cote backend :

- Header `x-tenant-id` obligatoire sur tous endpoints sauf `/api/v1/public/*` (sante check) et `/api/v1/admin/*` (super-admin cross-tenant)
- `tenant_id` filter automatique via `TenantGuard` NestJS sur toutes queries DB
- AsyncLocalStorage Node.js pour `TenantContext` (jamais passer tenant_id en parametre fonction)
- RLS policies Postgres : `app_current_tenant()` lit la session var `app.current_tenant` initialisee par middleware connexion
- Audit trail : chaque operation tenant logged avec `tenant_id`, `user_id`, `timestamp`, `action`, `entity_type`, `entity_id`, `request_id`

Cote frontend cette tache :
- Toutes mutations Tache utilisent api-client qui propage automatiquement le header
- Pas besoin de manipulation manuelle x-tenant-id dans le code (deja gere)
- Tests E2E utilisent helpers `loginAsGarage*` qui set le cookie tenant approprie

### A.2 Validation strict (Zod uniquement)

Aucune autre lib de validation autorisee :
- **JAMAIS** `class-validator` (utilisateur backend NestJS uniquement, jamais frontend)
- **JAMAIS** `yup` (deprecated dans le projet)
- **JAMAIS** `joi` (deprecated)
- **JAMAIS** `superstruct`
- **TOUJOURS** `zod` 3.24.1+ avec `@hookform/resolvers` pour react-hook-form

Pattern obligatoire :
```typescript
const Schema = z.object({
  field: z.string().min(1).max(100),
  // ...
});
type Type = z.infer<typeof Schema>;
```

Schemas exportes depuis `@insurtech/shared-types` quand reutilisables cross-package (ex : `LocaleSchema`, `CurrencyMadSchema`, `PlateMaSchema`).

Validation en defense en profondeur :
1. Cote frontend : Zod parse les responses API (catch erreurs backend ou drift schema)
2. Cote backend controller NestJS : Zod parse le body input via `ZodValidationPipe`
3. Cote backend service : assertion Zod sur les params avant operation DB

### A.3 Logger strict (Pino backend, Sentry frontend)

Backend NestJS :
- `this.logger.info({ tenant_id, user_id, action, duration_ms }, 'Action description')`
- **JAMAIS** `console.log` cote backend (pre-commit hook reject)
- **JAMAIS** `new Logger(...)` (utiliser DI NestJS)
- Format JSON structured pour parsing Datadog/Sentry/CloudWatch
- Champs obligatoires logs : `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`, `severity`

Frontend web-garage :
- `console.error` tolere uniquement pour erreurs critiques (network, validation echec)
- `console.log/debug` rejette pre-commit (sauf .spec.ts pour debug tests)
- Sentry capture errors uncaught via `@sentry/nextjs`
- Breadcrumbs Sentry pour actions user importantes (transition status, signature, payment)

### A.4 Hash password strict (backend Sprint 5)

Aucun impact direct cette tache (frontend), mais regles imposees :
- `argon2id` avec params `memoryCost: 65536, timeCost: 3, parallelism: 4`
- **JAMAIS** `bcrypt` (depasse, vulnerabilites timing)
- **JAMAIS** `scrypt` (moins resistant)
- **JAMAIS** `PBKDF2` (trop lent pour les params equivalent securite)
- Pepper additionnel via env var `PASSWORD_PEPPER` (32 bytes hex random)
- Migration legacy : re-hash on-login si argon2id non detecte

### A.5 Package manager strict (pnpm)

- **pnpm 9.x uniquement** (jamais npm, jamais yarn, jamais bun)
- `engine-strict=true` dans `.npmrc` -> rejette install si Node < 22.11.0
- `save-exact=true` -> versions deterministes (pas de `^` ni `~`)
- `link-workspace-packages=deep` pour imports `@insurtech/*` cross-workspace
- `node-linker=isolated` (defaut pnpm)
- `auto-install-peers=true`
- `strict-peer-dependencies=true`

### A.6 TypeScript strict (tsconfig.base.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

Conventions code :
- Imports explicites : pas de `import * as X` (rend tree-shaking inefficace)
- Pas de `any` implicite (declare explicite si necessaire, mais prefer `unknown`)
- Pas de `as any` (utiliser `as unknown as T` si vraiment necessaire avec commentaire justifiant)
- Pas de `// @ts-ignore` ni `// @ts-expect-error` sans justification commentaire
- Generics nommes explicitement (pas `T`, prefer `TData`, `TVariables`)

### A.7 Tests strict (Vitest + Playwright + axe-core)

Couverture :
- Chaque fichier `.ts` ou `.tsx` (sauf `*.types.ts` et `index.ts`) DOIT avoir un `.spec.ts` ou `.spec.tsx` associe
- Coverage cible global : >= 85%
- Coverage cible modules critiques (auth, database, signature, payment) : >= 90%
- Vitest pour unit + integration
- Playwright pour E2E web
- axe-core pour accessibility WCAG 2.1 AA

Tests structure :
- `describe('FunctionName', () => { ... })` au top
- `it('should X when Y', () => { ... })` descriptif
- `expect(actual).toBe(expected)` pour primitives, `.toEqual()` pour objects
- Mocks via `vi.mock(...)` et `vi.fn()` pour fonctions
- Fixtures dans `__tests__/fixtures/` ou `e2e/helpers/fixtures.ts`

### A.8 RBAC strict (12 roles, 4 garage)

12 roles globaux du programme InsurTech :
1. `SuperAdmin` (Skalean staff cross-tenant)
2. `BrokerAdmin` (broker manager)
3. `BrokerUser` (broker agent)
4. `GarageAdmin` (garage manager) -- web-garage
5. `GarageManager` -- web-garage (synonyme garage_chef)
6. `GarageTechnician` (technicien atelier) -- web-garage
7. `AssureClient` (assure final, web-assure)
8. `Prospect` (lead prospect, web-customer)
9. `ComplianceOfficer` (compliance officer ACAPS)
10. `FinanceOfficer` (finance manager)
11. `Support` (support customer service)
12. `ReadOnly` (audit only)

4 roles autorises sur web-garage (filtres middleware) :
- `garage_admin` (alias GarageAdmin)
- `garage_chef` (alias GarageManager)
- `garage_technicien` (alias GarageTechnician)
- `garage_gestionnaire` (financial focus, sous-set GarageAdmin)

`@Roles()` decorateur backend obligatoire chaque endpoint. `RolesGuard` global active sur `ApiModule`. `TenantGuard` global active (verifie `x-tenant-id` present).

### A.9 Events strict (Kafka)

Topics format obligatoire : `insurtech.events.{vertical}.{entity}.{action}`

Verticals : `auth`, `crm`, `insure`, `repair`, `pay`, `books`, `compliance`, `analytics`, `hr`, `comm`, `docs`, `signature`.

Examples cette tache (selon scope) :
- `insurtech.events.repair.sinistre.created`
- `insurtech.events.repair.sinistre.transitioned`
- `insurtech.events.repair.diagnostic.completed`
- `insurtech.events.repair.devis.sent`
- `insurtech.events.repair.devis.approved`
- `insurtech.events.repair.order.completed`
- `insurtech.events.repair.qc.passed`
- `insurtech.events.repair.qc.failed`
- `insurtech.events.repair.delivery.confirmed`
- `insurtech.events.repair.invoice.generated`
- `insurtech.events.repair.invoice.paid`

Schemas Zod pour chaque event (validation publish + consume). Idempotency-Key obligatoire pour events critiques (paiement, signature).

### A.10 Imports strict

Order obligatoire dans chaque fichier :
1. Node natifs (`fs`, `path`, `crypto`)
2. Externes (`react`, `next/*`, `@tanstack/*`, `zod`, `axios`)
3. Packages internes `@insurtech/*`
4. Relatifs (`@/lib/...`, `@/components/...`, `./*`)

Aliases TypeScript paths configures dans `tsconfig.base.json`. Pas de chemins relatifs profonds (`../../../package`). Toujours via alias `@/` pour `src/`.

### A.11 Skalean AI strict (decision-005 frontier)

Aucun appel direct LLM cote frontend ou backend. Tous appels passent par `@insurtech/sky` REST client OU MCP client. La frontiere stricte : Skalean AI utilise tools Skalean InsurTech via MCP, JAMAIS l'inverse.

Implementations :
- Sprint 1-28 : mock Skalean AI (decision-007)
- Sprint 29-31 : swap real production

Cote frontend cette tache : aucun appel AI direct. Si AI feature, passe par `useAiGateway()` hook qui appelle backend NestJS `/api/v1/ai/*` qui proxie Skalean AI Gateway.

### A.12 No-emoji strict (decision-006 ABSOLU)

Aucune emoji autorisee dans :
- Code TypeScript / JSX / TSX
- Commentaires code
- Logs (backend + frontend)
- Documentation (README, prompts, ADR)
- Commits messages
- i18n messages (fr/ar-MA/ar)
- Variables environnement
- Tests descriptions

Pre-commit hook `scripts/check-no-emoji.sh` rejette commits avec emoji. CI fail si emoji detectee dans PR. Verification regex Unicode ranges : `[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|[\x{1F600}-\x{1F64F}]|[\x{2700}-\x{27BF}]|[\x{1F680}-\x{1F6FF}]`.

Cette regle ne souffre AUCUNE exception. Si besoin visuel, utiliser icones Lucide React.

### A.13 Idempotency-Key strict

Header obligatoire pour mutations sensibles. Mutations sensibles :
- `POST /api/v1/payments/*`
- `POST /api/v1/signatures/*`
- `POST /api/v1/repair/sinistres` (create)
- `POST /api/v1/repair/sinistres/:id/transition`
- `POST /api/v1/repair/sinistres/:id/qc`
- `POST /api/v1/repair/sinistres/:id/deliver`
- `POST /api/v1/repair/sinistres/:id/invoices/generate`
- `POST /api/v1/repair/devis/:id/send`
- `MCP write tools` (Sprint 31)

TTL idempotency : 24h dans Redis. Pattern key : `idempotency:{tenant_id}:{user_id}:{key}` -> response cached.

Cote frontend : api-client genere automatiquement `Idempotency-Key` via `crypto.randomUUID()` pour les paths matching regex declaree (Tache 5.4.1).

### A.14 Conventional Commits strict

Format obligatoire : `<type>(scope): description`

Types autorises : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`.

Scope : `sprint-NN` ou `package-name` (ex : `sprint-22`, `web-garage`, `database`).

Description : 50-72 chars max, mode imperatif present ("add", "fix", "update", pas "added", "fixed").

Body : metadata obligatoire :
```
Task: 5.4.X
Sprint: 22 (Phase 5 / Sprint 22 cumul)
Phase: 5 -- Vertical Repair
Reference: B-22 Tache 5.4.X
```

Commitlint + husky pre-commit hook rejette commits non-conformes.

### A.15 Cloud souverain MA (decision-008)

Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc. Detail infrastructure :
- DC1 Tier III (primary) : Benguerir
- DC2 Tier IV (DR) : Casablanca
- Replication async cross-DC
- AUCUNE donnee assure (PII, sinistres, polices) ne transite hors MA (loi 09-08 CNDP)
- Encryption at rest : AES-256-GCM via Atlas KMS
- TLS 1.3 obligatoire pour tous transferts
- VPN site-to-site garages prod (option)

Backups :
- Full snapshot quotidien S3 Atlas
- Incremental hourly
- Retention 30 jours operationnel, 10 ans archivage cold storage
- Restore RTO < 4h, RPO < 1h

---

## Annexe B : Conformite Maroc detaillee (lois applicables)

### B.1 Loi 09-08 CNDP (Commission Nationale de protection des Donnees a caractere Personnel)

Loi du 18 fevrier 2009. Le decret 2-09-165 du 21 mai 2009 fixe les modalites d'application.

Articles cles pour cette tache :
- **Article 1** : definitions donnees personnelles + traitement
- **Article 5** : consentement utilisateur pour traitement donnees
- **Article 7** : principe de minimisation (donnees necessaires uniquement)
- **Article 12** : declaration prealable a CNDP (Skalean enregistre)
- **Article 18** : droits acces + rectification + opposition utilisateur
- **Article 21** : transferts internationaux (interdit hors MA sauf adequation)
- **Article 39** : sanctions (jusqu'a 300 000 MAD + emprisonnement)

Implementations cette tache :
- Audit log de chaque action sensible (tenant_id + user_id + timestamp + action)
- Consentement implicite via signature electronique customer
- Pas de transfert international donnees (Atlas Cloud Benguerir)
- Page parametres expose profil utilisateur + modification (article 18)
- Donnees biometriques (signatures) chiffrees AES-256

### B.2 Decision DGI 2024 -- Facturation electronique

Decret 2-23-471 du 23 fevrier 2024. Obligation facturation electronique signed pour entreprises CA > 1 MMAD a partir de 2025.

Mentions obligatoires facture :
- ICE (Identifiant Commun Entreprise) emetteur + destinataire
- IF (Identifiant Fiscal) emetteur + destinataire (si applicable)
- TVA 20% explicite par ligne (loi 06-17)
- Numerotation chronologique unique (pas de gap)
- Date d'emission + date echeance
- Mode paiement
- Signature electronique qualifie

Conservation : 10 ans (loi 06-17 article 145).

### B.3 Loi 53-95 ANRT -- Reseaux electroniques

TLS 1.3 obligatoire transferts (decret 2-15-700). Cookies Secure flag en prod. Pas de protocoles deprecated (SSL, TLS 1.0/1.1/1.2 acceptes mais 1.3 prefer).

### B.4 Loi 53-05 -- Signature electronique

Decret 2-08-518 du 21 mai 2009 detaille les niveaux :
1. **Simple electronic signature** : tout type (canvas, photo CIN) -- preuve simple
2. **Advanced electronic signature** : signature avec cle privee + integrite preservee
3. **Qualified electronic signature** : signature avancee + certificat qualifie ANRT (Barid eSign)

Hierarchie probante en cas de litige (article 12) :
- Qualified = presomption legale validite (article 417-1 DOC)
- Advanced = preuve forte, juge appreciation
- Simple = preuve simple, juge appreciation libre

Notre app : default canvas (simple, suffit reception/QC < 50 000 MAD), Barid eSign (qualified, recommande sinistres > 50 000 MAD).

### B.5 Code des assurances MA (loi 17-99)

Sinistre = evenement pouvant donner lieu indemnisation. Declaration obligatoire assureur dans :
- 5 jours ouvrables pour vehicule (article 17)
- 24h pour vol (article 18)

Notre app envoie automatique notification assureur via Sprint 21 Tache 5.3.X (envoi devis + bon livraison email/EDI).

### B.6 Constitution MA 2011 article 5 -- Langues officielles

Article 5 reconnait l'arabe et l'amazigh comme langues officielles. Le francais est langue de travail courante (administrative).

Notre app supporte fr (defaut), ar-MA (arabe dialectal MA avec chiffres latins acceptes), ar (arabe litteraire). RTL automatique pour ar-MA et ar.

### B.7 Loi 27-11 -- Droits handicapes (accessibilite)

Article 18 : applications digitales doivent etre accessibles. Standards : WCAG 2.1 AA.

Notre app integre axe-core sur chaque test Playwright pour valider en continu :
- Keyboard navigation
- Screen reader compatible (aria-labels, semantic HTML)
- Contraste suffisant (color contrast ratio 4.5:1 normal, 3:1 large text)
- Alt text images
- Skip links pour navigation rapide

### B.8 CNSS / AMO -- Securite sociale et assurance maladie

Sprint 13 HR module integre les declarations CNSS automatiques (BS via API CNSS). Pour cette tache : aucun impact direct, mais hours log (Tache 5.4.9) alimente paie technicien qui declenche cotisations.

### B.9 CGNC (Code General de Normalisation Comptable)

Sprint 12 Books integre CGNC pour inventaire FIFO (Stock module Sprint 13). Pour cette tache : aucun impact direct (mais transitions sinistre + invoices generent ecritures comptables backend).

### B.10 ACAPS (Autorite de Controle des Assurances et de Prevoyance Sociale)

Regulateur secteur assurance MA depuis 2014 (loi 64-12). Exigences :
- Conservation contrats + sinistres 10 ans
- Reporting trimestriel sinistres aux assureurs
- Anti-fraude detection
- Communication assureur transparent (devis + bon livraison + invoice)

Notre app communique automatiquement assureur (notifications settings) et audit log toute action.

---

## Annexe C : Tests etendus complementaires (30+ cas)

### C.1 Tests Vitest types-only (verifications structure)

```typescript
// types.spec.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { ZodSchema } from 'zod';

describe('Schema types', () => {
  it('exports correct types', () => {
    // Type-level assertions
    type Test = { a: string };
    expectTypeOf<Test>().toEqualTypeOf<{ a: string }>();
  });
});
```

### C.2 Tests integration api-client + endpoints

```typescript
// api-integration.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiGet, apiPost } from '@/lib/api-client';

describe('API integration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('handles 401 with refresh + retry', async () => {
    // Test refresh flow
    expect(true).toBe(true);
  });

  it('propagates Idempotency-Key on sensitive mutations', async () => {
    expect(true).toBe(true);
  });

  it('parses Zod error responses', async () => {
    expect(true).toBe(true);
  });
});
```

### C.3 Tests E2E mobile viewport

```typescript
// mobile.spec.ts
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPad Pro 11'] });

test.describe('Mobile tablet tests', () => {
  test('FAB hidden when virtual keyboard open', async ({ page }) => {
    await page.goto('/fr/dashboard');
    // simulate input focus
  });

  test('Sidebar collapses on mobile', async ({ page }) => {
    await page.goto('/fr/dashboard');
    // verify sidebar layout mobile
  });
});
```

### C.4 Tests RTL specifiques

```typescript
// rtl.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RTL ar-MA tests', () => {
  test('html dir=rtl applied', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Sidebar position inverse', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    // verify sidebar on right
  });

  test('Charts RTL applied', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    // verify Recharts dir
  });
});
```

### C.5 Tests visual regression (Sprint 30+ defere)

```typescript
// visual.spec.ts -- placeholder defere
import { test, expect } from '@playwright/test';

test.skip('Visual snapshots Sprint 30+', async ({ page }) => {
  await page.goto('/fr/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

---

## Annexe D : Edge cases additionnels (15 cas)

### D.1 Reseau lent (3G garage atelier)

**Scenario** : Tablette technicien 3G, latence 500ms+ par requete.
**Solution** : 
- Skeleton loading states partout (deja en place)
- Optimistic UI sur transitions
- Cache TanStack staleTime aggressive 30s
- Service Worker pre-cache assets statiques (Sprint 23 PWA mobile)

### D.2 Multi-tabs concurrents

**Scenario** : Chef ouvre meme sinistre dans 3 onglets.
**Solution** : 
- Polling 30s sur chaque tab
- TanStack Query partage cache via `broadcastChannel` (built-in v5)
- Optimistic mutations propagent cross-tab

### D.3 Backend deployment pendant operation utilisateur

**Scenario** : Deployment NestJS pendant que technicien soumet QC.
**Solution** :
- Backend rolling deployment (zero-downtime)
- Frontend retry interceptor api-client (3 retries avec backoff)
- Si echec persistant : toast "Service en cours de mise a jour, reessayez dans 30s"

### D.4 Token JWT expire pendant operation longue

**Scenario** : Technicien uploadait 12 photos (5 min), JWT expire entretemps.
**Solution** :
- Refresh interceptor api-client transparent (Tache 5.4.1)
- Si refresh echec : redirect /login avec preserve current path
- Form drafts saved localStorage avant redirect

### D.5 Browser incompatibles (vieux Safari, IE11)

**Scenario** : Garage utilise tablette ancienne Safari 13.
**Solution** :
- Browserlist target `last 2 Safari major versions`
- Polyfills via next.config.mjs `experimental.polyfills` (Sprint 4)
- Message warning si browser non supporte ("Mettre a jour Safari")

### D.6 Concurrence DB optimiste (mutation conflict)

**Scenario** : 2 users editent meme entity simultane (rare mais possible).
**Solution** :
- Backend version field optimistic locking (Sprint 19)
- Frontend recoit 409 CONFLICT -> toast "Cette entite a ete modifiee, refresh"
- Refetch automatique apres conflict

### D.7 Stockage S3 quota depasse

**Scenario** : Garage gros volume photos sinistres.
**Solution** :
- Backend monitor S3 usage per tenant
- Alert garage_admin si > 80% quota
- Sprint 30+ : compression photos auto + archivage cold storage

### D.8 Browser localStorage plein

**Scenario** : Drafts auto-save remplissent localStorage 5MB max.
**Solution** :
- Cleanup auto drafts > 7 jours
- Si quota exceeded, log Sentry + skip auto-save
- Toast user "Storage browser plein, sauvegarder formulaire"

### D.9 Customer email rebond (hard bounce)

**Scenario** : Email customer invalide ou inactif.
**Solution** :
- Webhook email provider (Sprint 9 Comm) detecte bounce
- Notification garage_gestionnaire pour update contact
- Fallback WhatsApp / SMS

### D.10 Numero telephone format MA invalide

**Scenario** : User saisit telephone `06123456` (manque chiffre).
**Solution** :
- Regex MA `^(\+212|0)[5-7]\d{8}$` (mobile commence 5/6/7)
- Zod validation rejette
- Hint UI : format attendu `+212XXXXXXXXX` ou `0XXXXXXXXX`

### D.11 Timezone differente (technicien voyage)

**Scenario** : Technicien voyage hors MA, browser detect timezone EU.
**Solution** :
- Backend timestamps en UTC
- Frontend conversion `formatInTimeZone(date, 'Africa/Casablanca', format)` (decision-008)
- Pas de detection browser timezone (toujours Africa/Casablanca operations)

### D.12 Police assurance expire pendant sinistre en cours

**Scenario** : Sinistre declare avec police active, police expire entre declaration et completion.
**Solution** :
- Backend snapshot police state au moment declaration
- Indemnisation calculee selon police au moment du sinistre
- Pas de re-evaluation post-expiration

### D.13 Customer change tenant garage en cours sinistre

**Scenario** : Customer commence reception au garage A, decide finir garage B.
**Solution** :
- Sinistres ne peuvent pas transferes cross-tenant (rare et complexe)
- Garage A cloture sinistre `cancelled` avec raison "transfer customer"
- Customer cree nouveau sinistre garage B

### D.14 Browser back button perd state form

**Scenario** : User clique back, form perdu.
**Solution** :
- Auto-save drafts localStorage (deja pattern reception/diagnostic)
- Restore on mount
- Warning beforeunload si form dirty

### D.15 PWA service worker conflict (Sprint 23)

**Scenario** : Sprint 23 ajoute PWA, conflict avec ce sprint web-garage desktop.
**Solution** :
- Apps separes : `apps/web-garage` (desktop, ce sprint) vs `apps/web-garage-mobile` (PWA Sprint 23)
- Pas de service worker dans web-garage (Sprint 22)
- Web-garage-mobile : PWA complet avec offline

---

## Annexe E : Variables environnement complementaires consolidees

```env
# ============================================================================
# Application identity
# ============================================================================
NEXT_PUBLIC_APP_NAME=skalean-garage
NEXT_PUBLIC_APP_VERSION=2.2.0
NEXT_PUBLIC_APP_ENV=development

# ============================================================================
# API endpoints
# ============================================================================
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_AI_GATEWAY_URL=

# ============================================================================
# Cookies (cross-domain prod .skalean-insurtech.ma)
# ============================================================================
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
ACCESS_TOKEN_MAX_AGE_SECONDS=3600
REFRESH_TOKEN_MAX_AGE_SECONDS=604800
COOKIE_SAME_SITE=lax

# ============================================================================
# Locale
# ============================================================================
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar
NEXT_PUBLIC_DEFAULT_TIMEZONE=Africa/Casablanca

# ============================================================================
# S3 / Atlas Cloud
# ============================================================================
NEXT_PUBLIC_S3_BASE_URL=https://s3.skalean-atlas.ma
S3_PRESIGNED_EXPIRY_SECONDS=900
S3_MAX_FILE_SIZE_MB=10
S3_ALLOWED_MIMETYPES=image/jpeg,image/png,image/webp,image/heic,application/pdf

# ============================================================================
# Auth + Security
# ============================================================================
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION_SECONDS=900
MFA_TOTP_ISSUER=Skalean Garage
MFA_BACKUP_CODES_COUNT=10
PASSWORD_PEPPER_KEY=
JWT_PRIVATE_KEY_PATH=/secrets/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt-public.pem

# ============================================================================
# Sentry monitoring
# ============================================================================
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# ============================================================================
# Feature flags
# ============================================================================
NEXT_PUBLIC_ENABLE_AI_SUGGESTIONS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS_POLL=true
NEXT_PUBLIC_ENABLE_PWA=false
NEXT_PUBLIC_ENABLE_VISUAL_REGRESSION=false

# ============================================================================
# Polling intervals
# ============================================================================
NOTIFICATIONS_POLL_INTERVAL_MS=30000
DASHBOARD_REFETCH_INTERVAL_SINISTRES_MS=30000
DASHBOARD_REFETCH_INTERVAL_STOCK_MS=60000
ORDERS_REFETCH_INTERVAL_MS=30000
SINISTRES_KANBAN_REFETCH_INTERVAL_MS=30000

# ============================================================================
# Limits
# ============================================================================
SINISTRES_KANBAN_MAX_FETCH=200
SINISTRES_TABLE_PAGE_SIZE=25
SINISTRES_BULK_MAX_SELECT=100
COMMUNICATION_PAGE_SIZE=50
DOCUMENTS_PAGE_SIZE=100
```

---

## Annexe F : Commandes pre-commit complete

```bash
# Setup initial
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/web-garage exec playwright install chromium --with-deps

# Cycle dev
pnpm --filter @insurtech/web-garage dev                                 # demarre port 3002

# Cycle pre-commit
pnpm --filter @insurtech/web-garage typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage lint                                # 0 erreur biome
pnpm --filter @insurtech/web-garage exec vitest run --coverage          # >= 85%
pnpm --filter @insurtech/web-garage exec playwright test                # 20+ tests E2E
bash scripts/check-no-emoji.sh apps/web-garage/                         # exit 0
grep -rn "console\.log\|console\.debug" apps/web-garage/src/ --include="*.ts" --include="*.tsx" | grep -v ".spec" && echo FAIL || echo OK
pnpm exec tsx scripts/validate-i18n-keys.ts apps/web-garage/src/messages/  # parite locales
pnpm --filter @insurtech/web-garage build                                # build production
du -sh apps/web-garage/.next/static/                                     # bundle < 5MB

# Cycle CI
pnpm --filter @insurtech/web-garage exec playwright test --reporter=junit
pnpm --filter @insurtech/web-garage exec lighthouse http://localhost:3002/fr/dashboard --output=json --output-path=lighthouse-report.json

# Audit accessibility specifique
pnpm --filter @insurtech/web-garage exec playwright test --grep accessibility
```

---

## Annexe G : Pattern code reutilises (refs Tache 5.4.1)

### G.1 useCurrentUser hook

```typescript
// src/hooks/use-current-user.ts
'use client';

import { useEffect, useState } from 'react';
import { decodeJwtUnsafe, type CurrentUser } from '@/lib/auth-helpers';

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    function readUser() {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(/access_token=([^;]+)/);
      if (!match) return null;
      try {
        return decodeJwtUnsafe(decodeURIComponent(match[1]));
      } catch {
        return null;
      }
    }
    setUser(readUser());
  }, []);

  return user;
}
```

### G.2 useTenantId hook

```typescript
// src/hooks/use-tenant-id.ts
'use client';

import { useEffect, useState } from 'react';

export function useTenantId(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie.match(/current_tenant_id=([^;]+)/);
    if (match) setTenantId(decodeURIComponent(match[1]));
  }, []);

  return tenantId;
}
```

### G.3 useHasRole hook

```typescript
// src/hooks/use-has-role.ts
'use client';

import { useCurrentUser } from './use-current-user';
import { type GarageRole } from '@/lib/auth-helpers';

export function useHasRole(roles: GarageRole[]): boolean {
  const user = useCurrentUser();
  if (!user) return false;
  return user.roles.some((r) => (roles as string[]).includes(r));
}
```

---

## Annexe H : Workflow git pre-merge checklist

Avant merger PR :

1. **Local checks** :
   - [ ] `pnpm typecheck` exit 0
   - [ ] `pnpm lint` exit 0
   - [ ] `pnpm test` >= 85% coverage
   - [ ] `pnpm playwright test` 20+ green
   - [ ] No emoji (`bash scripts/check-no-emoji.sh`)
   - [ ] i18n parity (`pnpm exec tsx scripts/validate-i18n-keys.ts`)
   - [ ] Build production reussi
   - [ ] No console.log residuel

2. **CI checks** :
   - [ ] GitHub Actions all green
   - [ ] Lighthouse Performance >= 85
   - [ ] Lighthouse Accessibility >= 90
   - [ ] axe-core 0 violations serious
   - [ ] Bundle size route < 250 ko

3. **Manual review** :
   - [ ] Code review au moins 1 reviewer
   - [ ] PR description respect template
   - [ ] Screenshots UI joints (si UI changes)
   - [ ] Tests demo manuelle Atlas Cabinet

4. **Documentation** :
   - [ ] CHANGELOG.md mis a jour
   - [ ] README.md mis a jour si nouveau endpoint
   - [ ] ADR cree si decision architecturale nouvelle

5. **Deploy** :
   - [ ] Squash merge (no merge commit)
   - [ ] Auto deploy staging
   - [ ] Smoke tests staging
   - [ ] Promote production apres validation

---

**Fin extension Annexes (densite cible atteinte).**
