# TACHE 4.3.4 -- Dashboard Page : 6 Widgets (Revenue YTD, Conversion Funnel, Polices Actives, Sinistres Cours, Deals Open, Activity Feed)

**Sprint** : 16 (Phase 4 / Sprint 16 -- Web Broker App)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.4)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** : task-4.3.3 (Layout principal + sidebar + topbar + tenant switcher), Sprint 13 (endpoints analytics), Sprint 14 (endpoints insure dashboards), Sprint 8 (CRM activities feed), Sprint 4 (design tokens Sofidemy + shadcn/ui setup)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Construire la page d'accueil `/dashboard` de l'application `web-broker` (port 3001) : six widgets metier critiques affichant en temps quasi-reel les KPI du cabinet de courtage. Le dashboard est la premiere page que tout utilisateur authentifie voit apres login (redirection depuis `/login` -> `/dashboard` cf. task-4.3.2) et doit transmettre l'etat de sante commercial complet du cabinet en un coup d'oeil (regle des 3 secondes ergonomique). Les six widgets ciblent six dimensions metier orthogonales : (1) Revenue YTD avec graphique lineaire des revenus mensuels et comparaison year-over-year, (2) Conversion Funnel des deals avec les cinq stages de pipeline (lead -> qualified -> proposal -> negotiation -> won), (3) Polices Actives avec breakdown par branche (auto, sante, habitation, vie, RC pro, RC entreprise) en graphique camembert, (4) Sinistres en Cours avec breakdown par status (declared, in_review, expert, settled, closed) en graphique barres, (5) Deals Open avec top 5 prochaines dates de cloture et valeur totale MAD agreggee, (6) Activity Feed avec les dix dernieres interactions client (calls, emails, WhatsApp, meetings, notes) horodatees en temps relatif locale-aware.

Tous les widgets partagent un jeu de filtres globaux (`date_range` : custom/last_7d/last_30d/ytd/last_year + `group_by` : day/week/month + `branche` selector multi-select) syncronisise dans l'URL via nuqs (`?date_start=2026-01-01&date_end=2026-05-15&group_by=month&branches=auto,sante`) pour permettre le bookmarking + sharing direct des vues dashboard. Chaque widget gere ses propres etats loading (skeletons shadcn/ui pendant fetch), empty (illustration + CTA "Create your first deal/police/contact"), et error (toast + retry button). Un bouton refresh manuel et un toggle auto-refresh (poll 5 minutes via TanStack Query staleTime/refetchInterval) sont disponibles dans le header. L'export PDF/CSV est prepare via un lien marque "Phase 7" (Sprint 32 ajoutera l'implementation jsPDF/xlsx -- ici seulement le bouton + handler stub).

A la sortie de cette tache : `pnpm --filter @insurtech/web-broker dev` + navigation vers `http://localhost:3001/fr/dashboard` rend les six widgets avec donnees mock (si API mock activee) ou reelles (si API Sprint 13+14 demarree), les filtres appliquent + URL state synchronisee, 12+ tests Vitest + 8+ tests Playwright E2E passent. Cette tache bloque task-4.3.5 (Contacts page) qui reutilisera les patterns TanStack Query + nuqs filters + shadcn/ui DataTable etablis ici.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le dashboard est le **point d'entree quotidien** de tout courtier (commercial broker_user, administrateur broker_admin, assistant broker_assistant) connecte a Skalean Broker. La metaphore mentale : un courtier ouvre Skalean Broker le matin, doit voir en 3 secondes "ou j'en suis" sur les six dimensions cles de son metier. Sans dashboard, l'utilisateur doit naviguer manuellement entre `/contacts`, `/deals`, `/polices`, `/broker-queue`, `/sinistres` pour reconstituer l'image complete, perdant 5-10 minutes chaque matin et chaque retour de pause. Le dashboard centralise cette reconstitution en une page unique avec data agreggee precalculee cote backend (Sprint 13 ClickHouse aggregations + Sprint 14 InsureDashboardService).

Six widgets et pas dix : decision UX prise lors de la sortie Sprint 4 (validation Sofidemy design tokens) -- au-dela de six widgets, l'utilisateur subit une **surcharge cognitive** mesuree (etude interne Skalean : un dashboard a 10+ widgets fait passer le temps de scan de 4s a 18s, et les decisions prises chutent en qualite de 23%). Les six widgets choisis couvrent les six **questions naturelles** du courtier quotidien :

| # | Question naturelle | Widget reponse |
|---|--------------------|----------------|
| 1 | "Combien j'ai facture cette annee ?" | Revenue YTD (LineChart + total card + YoY %) |
| 2 | "Mes deals avancent-ils ?" | Conversion Funnel (5 stages + taux conversion par stage) |
| 3 | "Quel est mon stock de polices ?" | Polices Actives (PieChart par branche + total) |
| 4 | "Combien de sinistres je suis en cours ?" | Sinistres en Cours (BarChart par status + total) |
| 5 | "Sur quoi vais-je travailler cette semaine ?" | Deals Open Top 5 (liste + total value) |
| 6 | "Quoi de neuf depuis hier ?" | Activity Feed Last 10 (call/email/whatsapp/meeting/note) |

### Alternatives considerees

#### Recharts vs Chart.js vs Victory vs ApexCharts vs Plotly

| Critere | Recharts 2.13.x (CHOIX) | Chart.js 4 | Victory | ApexCharts | Plotly |
|---------|--------------------------|------------|---------|-------------|--------|
| React-native (composable JSX) | Oui (declaratif) | Non (canvas imperative) | Oui | Wrapper React | Wrapper React |
| Bundle size client gzipped | ~92 ko | ~62 ko | ~140 ko | ~170 ko | ~340 ko |
| SVG-based (a11y + zoom) | Oui SVG | Canvas (pas a11y) | SVG | SVG | WebGL |
| TypeScript types | Excellents | Bons | Moyens | Moyens | Faibles |
| Tooltip customization | Composant React | JSON config | Composant | JSON | JSON |
| FunnelChart | Disponible | Plugin externe | Non | Non | Oui |
| LineChart / PieChart / BarChart | Oui natif | Oui natif | Oui | Oui | Oui |
| Responsive container | Natif | Manuel | Natif | Natif | Natif |
| Animation defaults | Doux 1500ms | Plus rapide | Springs | Tres anime | Tres anime |
| RTL support | Manuel (props reverseStackOrder) | Manuel | Manuel | Bon | Bon |
| Recharts 3.0 alpha | Refactor en cours | -- | -- | -- | -- |

**Decision** : Recharts 2.13.x. Justifie par : compatibilite React 19 confirmee janvier 2026, FunnelChart inclus natif (necessaire widget 2), SVG accessible (WCAG 2.1 AA -- Sprint 4 a11y baseline), bundle raisonnable, TypeScript de premiere classe, communaute large. Recharts 3.0 alpha rejete -- breaking changes API + risque trop tot.

#### nuqs vs useSearchParams custom vs Zustand URL sync vs ts-query-string

| Critere | nuqs 2.0.x (CHOIX) | useSearchParams brut | Zustand + sync | ts-query-string |
|---------|---------------------|----------------------|----------------|------------------|
| App Router Next.js 15 | Natif (parsers SSR-safe) | Natif mais brut | Manual sync | Manual |
| Type inference parsers | Excellent (parser.parseAsX) | Aucun (string only) | Faible | Bon |
| Throttle/debounce builtin | Oui (`throttleMs`) | Manuel | Manuel | Manuel |
| Server-Side cache | Oui `createSearchParamsCache` | Manuel | Non SSR | Non SSR |
| Optimistic UI dirty state | Oui (`shallow: false`) | Manuel | Manuel | Manuel |
| Bundle size client | ~4 ko gzipped | 0 ko (natif) | ~3 ko + 1 ko sync | ~2 ko |
| Maintenu | Actif (47 a 47 stars/mois) | -- | -- | Legacy |

**Decision** : nuqs 2.0.x. Justifie par integration App Router parfaite, throttle natif (filtres date_range qui changent rapidement), serverside cache pour Server Components, et type-safe parsers (parseAsIsoDateTime, parseAsArrayOf, parseAsStringEnum) qui evitent runtime type errors. nuqs est mentionne par Stack imposee meta-prompt B-16.

#### TanStack Query staleTime + refetchInterval vs SWR vs RTK Query

| Critere | TanStack Query 5.62.0 (CHOIX) | SWR 2.x | RTK Query |
|---------|---------------------------------|---------|-----------|
| Stack imposee meta-prompt B-16 | Oui | Non | Non |
| Mutations + optimistic UI | Excellent | Bon | Bon |
| Infinite queries | Natif | Natif | Limite |
| Devtools | Excellents | Moyens | Faibles |
| SSR/RSC integration | Excellent (`dehydrate/hydrate`) | Bon | Faible |
| Window focus refetch | Configurable | Default ON | Manuel |
| staleTime + gcTime tuning | Excellent | Limite | Limite |
| Prefetch declaratif | `queryClient.prefetchQuery` | Manuel | Limite |

**Decision** : TanStack Query 5.62.0 (deja stack imposee depuis task-4.3.1, providers.tsx l'a deja initialise avec QueryClientProvider). Sur ce dashboard : staleTime 5min (300_000ms) car les KPI changent rarement intra-5min, refetchOnWindowFocus desactive (eviter rafale fetch a chaque alt-tab), refetchInterval optionnel 5min via toggle auto-refresh persistee localStorage.

#### Server Component initial fetch + Client widgets vs Full Client vs Full Server

| Strategie | Avantage | Inconvenient | Verdict |
|-----------|----------|--------------|---------|
| Full Client (`'use client'` dashboard) | Simplicite mentale | FCP retarde (waterfall fetch apres hydratation), pas SEO (mais dashboard prive donc OK), bundle JS plus gros | Rejete |
| Full Server (RSC pour tout) | Tres rapide initial render | Pas d'interactivite filtres dynamiques sans navigation, recharts requiert client | Rejete |
| Server initial parallel fetch + Suspense + Client widgets interactifs (CHOIX) | Best of both : SSR rapide + interactivite client | Plus complexe (separer concerns) | Adopte |

**Decision** : `app/[locale]/(protected)/dashboard/page.tsx` est un Server Component qui fait les 6 fetches initiaux en parallele via `Promise.all` (eviter waterfall), puis passe les data initiales aux 6 widgets Client Components qui hydratent TanStack Query cache via `useQuery(..., { initialData })`. Les filtres URL state (nuqs) declenchent ensuite des refetch client. Pattern recommande Next.js 15 RSC + TanStack Query (cf. docs.tanstack.com/query/v5/docs/framework/react/guides/ssr).

### Trade-offs explicites

1. **Six widgets fixed vs configurable** : Sprint 16 livre six widgets en dur. Sprint 32 (User Customization) ajoutera drag-drop reorder + show/hide widgets + ajout widgets supplementaires (forecast IA, leaderboard equipe). On evite la complexite premature : 80% des courtiers veulent les six widgets dans l'ordre fixe (etude UX Sofidemy).

2. **Pas de WebSocket realtime** : les widgets refetch via TanStack Query poll (5min ou bouton refresh manuel). WebSocket realtime (sinistre declare instantane) sera Sprint 28 (Notifications realtime). Acceptable : un dashboard "presque temps reel" suffit aux KPI cours (revenue YTD ne change pas chaque seconde).

3. **Recharts 2.13.x + React 19 quirk** : Recharts 2.13.x affiche un warning console "ReactDOM.findDOMNode deprecated" en React 19 dev. Resolu via `console.warn` patch dans `providers.tsx` (filter pattern) -- accepter quelques warnings dev en attendant Recharts 3.0 stable Q2 2026.

4. **FunnelChart sans pourcentages auto** : Recharts FunnelChart n'affiche pas les taux de conversion entre stages automatiquement. On ajoute manuellement via `<LabelList>` custom rendering les % calcules (e.g. "Qualified -> Proposal : 42%"). Code custom 30 lignes mais necessaire UX.

5. **PieChart accessibility limite** : Recharts PieChart ARIA labels limites. On ajoute manuellement `aria-label` sur chaque secteur + un `<table>` cache visuellement (sr-only) listant les valeurs en alternative texte (WCAG 2.1 AA conformite). Critique : auditeur ACAPS peut verifier accessibility.

6. **Activity feed sans pagination** : on charge top 10 dernieres activites. Si l'utilisateur veut plus, il navigue vers `/contacts/:id` ou `/deals/:id` pour la timeline complete. Pas de bouton "Load more" sur le widget dashboard (eviter inflation widget vertical).

7. **Pas de filter persistence cross-session** : les filtres sont URL-state-only via nuqs. Si l'utilisateur ferme le tab et revient, retour aux defauts (last_30d, group_by=month). Sprint 32 ajoutera la persistence userPreferences (table `user_dashboard_prefs` Sprint 13).

8. **Auto-refresh 5min hardcoded** : pas de choix utilisateur 1min/5min/15min. 5min est le compromis raisonnable (charge backend acceptable, UX fraicheur correcte). Sprint 32 rendra configurable si besoin metier remonte.

9. **Currency formatting MAD uniquement** : les revenus + deals affiches en MAD via `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`. Pas de multi-currency dashboard ; en realite tous les contrats MA sont en MAD (rare exception EUR pour assurance maritime -- non gere ici).

10. **PDF/CSV export stub** : boutons presents mais handlers afficheront toast "Disponible Sprint 32 (Phase 7)" pour ne pas casser UX. Le code Sprint 16 ne livre pas l'export reel pour respecter le timebox 6h.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `apps/web-broker/components/dashboard/*` reside dans le monorepo root, importe `@insurtech/shared-ui/components/{Card,Button,Skeleton}`.
- **decision-005 (Skalean AI frontier)** : aucune integration IA dans Sprint 16. Phase 7 (Sprint 32+) ajoutera "AI insights" widget (e.g. "Vos polices auto baissent de 12% ce mois -- pourquoi ?").
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, JSON messages, README, commit. Linter custom verifie en CI (`scripts/check-no-emoji.sh`). Accents francais et caracteres arabes autorises.
- **decision-007 (timezone Africa/Casablanca)** : tous les date_range filters sont interpretes en Africa/Casablanca timezone. `date-fns-tz` conversions explicit : un `last_7d` calcule `now()` puis sub 7 days en TZ MA (eviter bug UTC qui ferait perdre 1h selon DST).
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : pas d'asset CDN exterieur ici (les widgets sont 100% rendu cote client + data API Skalean).
- **decision-009 (multilinguisme MA)** : trois locales fr / ar-MA / ar. Les labels widgets, formats dates, formats nombres tous locale-aware via next-intl + date-fns + Intl.
- **decision-011 (loi 09-08 PII)** : le dashboard agrege uniquement des KPI agreggees -- jamais de CIN/RIB/email/phone affiches dans les widgets dashboard. L'activity feed affiche un nom + libelle interaction sans PII brute.

### Pieges techniques connus (10+ items)

1. **nuqs SSR hydration mismatch** : si Server Component rend avec defaults (last_30d) mais URL contient `?date_start=2026-01-01`, le client hydrate avec valeur differente -> hydration mismatch React warning. Solution : utiliser `createSearchParamsCache` server-side qui lit les params SSR + passer initial values aux clients via prop.

2. **Recharts ResponsiveContainer width=0 transient** : au premier render avant que le parent ait sa largeur calculee, ResponsiveContainer rend a width=0 et le chart est invisible. Solution : `min-h-[300px]` sur le parent + ResponsiveContainer height="100%" width="100%" + key dynamique pour force re-render apres mount (useEffect setKey).

3. **date-fns-tz parseISO + zonedTimeToUtc round-trip** : `parseISO('2026-01-01T00:00:00')` retourne un Date en TZ locale du systeme (pas Africa/Casablanca). Solution : utiliser `zonedTimeToUtc(localDateStr, 'Africa/Casablanca')` pour forcer la TZ MA avant envoi API.

4. **TanStack Query refetchInterval cleanup** : si l'utilisateur navigate hors dashboard (vers /contacts), le poll continue tant que la query est cache. Solution : utiliser `refetchIntervalInBackground: false` (defaut) + `enabled: isOnDashboardPage` derive d'`useSelectedLayoutSegment()`.

5. **PieChart 0 valeurs cause NaN** : si une branche a 0 polices (e.g. RC entreprise debut tenant), le secteur PieChart affiche NaN%. Solution : filter `data.filter(d => d.value > 0)` avant passage a `<Pie data=...>`.

6. **FunnelChart trapezoid distortion** : si stage 1 a 1000 et stage 5 a 1 (ratio 1000:1), le funnel devient un triangle quasi-degenere. Solution : utiliser `isAnimationActive={true}` + min height per stage + scale logarithmique optionnel (toggle UX).

7. **Activity feed timezones display** : "il y a 2 heures" calcule en UTC vs Africa/Casablanca cause decalages. Solution : `formatDistanceToNow(date, { locale, includeSeconds: false })` + s'assurer que `date` est passe avec TZ correct (parsing strict).

8. **Intl.NumberFormat MAD avec 0 decimales** : par defaut MAD affiche avec 2 decimales (`12 500,00 MAD`). Pour dashboard plus lisible, on veut `12 500 MAD` (0 decimales). Solution : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })`.

9. **ar-MA RTL chart direction** : Recharts charts en RTL ne mirrorent pas les X-axes automatiquement (left=earliest, right=latest doit devenir right=earliest, left=latest en RTL). Solution : passer `reverseStackOrder` + `xAxisProps={{ reversed: dir === 'rtl' }}` selon locale.

10. **Large datasets > 1000 points** : si un tenant a 5 ans d'historique mensuel = 60 points (OK), mais group_by=day sur 1 an = 365 points (sluggish). Solution : limit backend a 365 points max, downsample si plus (Sprint 13 implemente downsampling LTTB).

11. **Auto-refresh while user typing in filter** : si refetchInterval declenche pendant que l'utilisateur tape `?date_start=` partiellement, l'URL est dans un etat invalide -> backend renvoie 400. Solution : utiliser nuqs `throttleMs: 500` qui differe l'application URL pendant typing.

12. **Locale switch mid-render Recharts charts not reflowing** : Recharts utilise des refs internes calcules au mount. Switch locale mid-render ne reflow pas X/Y axes (labels rester en ancienne langue). Solution : `key={locale}` sur composant chart pour force remount on locale change.

13. **Empty state illustrations missing** : sans illustrations, les empty states sont des Cards vides texte-only -> UX faible. Solution : `@insurtech/shared-ui/illustrations` (Sprint 4) expose `<EmptyDealsIllustration>`, etc. -- 5 SVG illustrations stub si pas disponibles.

14. **Server Component params not awaited Next.js 15** : Next.js 15 a fait `params` async. `function Page({ params }: { params: { locale: string } })` casse type. Solution : `async function Page({ params }: { params: Promise<{ locale: string }> })` + `const { locale } = await params`.

15. **TanStack Query hydration without QueryClient initial** : si le Server Component fetch et passe data via prop sans rehydrate cache, les widgets Client refetch immediatement (waste). Solution : `dehydrate(queryClient)` server-side + `<HydrationBoundary state={dehydratedState}>` client-side qui peuple le cache avant les useQuery.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

`task-4.3.4` est la quatrieme des quatorze taches du Sprint 16 et depend du layout protege etabli par task-4.3.3 :

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 App skeleton + middleware auth + i18n]
   |
[4.3.2 Pages auth (login + MFA + signup + recovery)]
   |
[4.3.3 Layout principal + sidebar + topbar + tenant switcher]
   |
[4.3.4 Dashboard page : 6 widgets]  <-- ICI
   |
   +--> [4.3.5 Contacts page] (reutilise nuqs filters + TanStack Query patterns)
   +--> [4.3.6 Companies page]
   +--> [4.3.7 Deals page (kanban + table)]
   +--> [4.3.8 Polices page]
   +--> [4.3.9 Broker Queue page]
   +--> [4.3.10 Sinistres page (read-only)]
   +--> [4.3.11 Parametres + Profile pages]
   +--> [4.3.12 RBAC UI conditional rendering]
   +--> [4.3.13 I18n complete fr/ar-MA/ar + RTL]
   +--> [4.3.14 Tests E2E Playwright + a11y]
```

Sequence demarrage : Jour 1 matin completer 4.3.3 (layout), Jour 1 apres-midi 4.3.4 (dashboard 6h). Le dashboard est crucial car c'est la page que les commerciaux verront le plus -- mal concu, l'adoption Skalean Broker s'effondre.

### Position dans le programme global

Cette tache fait partie de la **Phase 4 Vertical Insure** (Sprints 13-16). Apres 4.3.4 :
- Sprint 17 (Web Customer Portal) : le dashboard customer-portal sera plus simple (3 widgets : mes polices, mes sinistres, mes paiements).
- Sprint 22 (Web Garage App) : garage aura aussi un dashboard mais axe sinistres + temps reel.
- Sprint 27 (Web InsurTech Admin) : super admin dashboard cross-tenant (KPI agreges Skalean SaaS).
- Sprint 32 (Dashboards customization) : ajoute drag-drop reorder + AI insights widgets.

Le pattern Server Component initial fetch + Suspense + Client widgets interactifs etabli ici est **canonique** pour les 7 autres dashboards du programme.

### Diagramme ASCII de l'arborescence dashboard

```
repo/apps/web-broker/
|
|-- src/
|   |-- app/[locale]/(protected)/dashboard/
|   |   |-- page.tsx                                 # Server Component initial parallel fetches + Suspense (~150 lignes)
|   |   |-- loading.tsx                              # Suspense fallback global (~30 lignes)
|   |   |-- error.tsx                                # Error boundary dashboard (~50 lignes)
|   |
|   |-- components/dashboard/
|   |   |-- dashboard-filters.tsx                    # date_range + group_by + branche selector + nuqs URL state (~180 lignes)
|   |   |-- dashboard-header.tsx                     # title + refresh button + auto-refresh toggle + export buttons (~120 lignes)
|   |   |-- dashboard-grid.tsx                       # responsive grid 6 widgets layout (~80 lignes)
|   |   |-- auto-refresh-toggle.tsx                  # toggle 5min poll persisted localStorage (~80 lignes)
|   |   |-- widget-skeleton.tsx                      # shared skeleton placeholder (~50 lignes)
|   |   |-- widget-empty-state.tsx                   # shared empty state with illustration + CTA (~70 lignes)
|   |   |-- widget-error-state.tsx                   # shared error state with retry (~50 lignes)
|   |   |-- widgets/
|   |       |-- revenue-ytd-widget.tsx               # LineChart recharts + total card + YoY % (~180 lignes)
|   |       |-- conversion-funnel-widget.tsx          # FunnelChart + conversion rates labels (~150 lignes)
|   |       |-- polices-actives-widget.tsx            # PieChart par branche + total + legend (~160 lignes)
|   |       |-- sinistres-cours-widget.tsx            # BarChart par status + total (~140 lignes)
|   |       |-- deals-open-widget.tsx                 # liste top 5 + total value MAD + count (~150 lignes)
|   |       |-- activity-feed-widget.tsx              # liste last 10 interactions + icones type + relative time (~200 lignes)
|   |
|   |-- lib/
|   |   |-- queries/
|   |   |   |-- dashboard.queries.ts                  # TanStack Query hooks (useRevenueYTD, useConversionFunnel, etc.) (~250 lignes)
|   |   |-- api/
|   |   |   |-- dashboard.api.ts                      # fetch wrappers avec types Zod (~200 lignes)
|   |   |-- formatters/
|   |       |-- dashboard-formatters.ts               # formatRevenueMAD, formatRelativeTime locale-aware, formatPercent, etc. (~180 lignes)
|   |
|   |-- hooks/
|   |   |-- use-dashboard-filters.ts                  # custom hook nuqs combine filters (~80 lignes)
|   |   |-- use-auto-refresh.ts                       # custom hook toggle + interval logic (~60 lignes)
|
|-- test/
|   |-- dashboard/
|   |   |-- revenue-ytd-widget.spec.tsx               # Vitest 3 tests
|   |   |-- conversion-funnel-widget.spec.tsx         # Vitest 2 tests
|   |   |-- polices-actives-widget.spec.tsx           # Vitest 2 tests
|   |   |-- sinistres-cours-widget.spec.tsx           # Vitest 2 tests
|   |   |-- deals-open-widget.spec.tsx                 # Vitest 1 test
|   |   |-- activity-feed-widget.spec.tsx              # Vitest 2 tests
|
repo/e2e/web/
|   |-- dashboard.spec.ts                            # Playwright 8 tests E2E
```

**Provider chain rendue sur le dashboard** :

```
<html lang="fr" dir="ltr">
  <body>
    <ThemeProvider>
      <NextIntlClientProvider locale="fr" timeZone="Africa/Casablanca">
        <Providers>
          <QueryClientProvider>
            <HydrationBoundary state={dehydratedState}>     <-- preload 6 queries SSR
              <ProtectedLayout>
                <Sidebar /> + <Topbar />
                <DashboardPage>
                  <DashboardHeader>
                    <DashboardFilters />                     <-- nuqs URL state
                    <AutoRefreshToggle />
                    <ExportButtons />
                  </DashboardHeader>
                  <DashboardGrid>
                    <Suspense fallback={<WidgetSkeleton />}>
                      <RevenueYTDWidget />                   <-- Client Component useQuery
                    </Suspense>
                    <Suspense fallback={<WidgetSkeleton />}>
                      <ConversionFunnelWidget />
                    </Suspense>
                    ... (4 autres widgets)
                  </DashboardGrid>
                </DashboardPage>
              </ProtectedLayout>
            </HydrationBoundary>
          </QueryClientProvider>
        </Providers>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

### Diagramme flux data Server -> Client

```
Server Component dashboard/page.tsx
   |
   | 1. await searchParamsCache.parse(searchParams) -- nuqs server-side
   |
   | 2. const filters = { date_start, date_end, group_by, branches }
   |
   | 3. const queryClient = new QueryClient()
   |
   | 4. Promise.all([
   |      queryClient.prefetchQuery({ queryKey: ['dashboard', 'revenue', filters], queryFn: fetchRevenueYTD }),
   |      queryClient.prefetchQuery({ queryKey: ['dashboard', 'funnel', filters], queryFn: fetchConversionFunnel }),
   |      queryClient.prefetchQuery({ queryKey: ['dashboard', 'polices', filters], queryFn: fetchPolicesActives }),
   |      queryClient.prefetchQuery({ queryKey: ['dashboard', 'sinistres', filters], queryFn: fetchSinistresCours }),
   |      queryClient.prefetchQuery({ queryKey: ['dashboard', 'deals-open', filters], queryFn: fetchDealsOpen }),
   |      queryClient.prefetchQuery({ queryKey: ['dashboard', 'activity'], queryFn: fetchActivityFeed }),
   |    ])
   |
   | 5. const dehydratedState = dehydrate(queryClient)
   |
   | 6. return <HydrationBoundary state={dehydratedState}><DashboardClient /></HydrationBoundary>
   v
Client Component DashboardClient
   |
   | 7. useDashboardFilters() reads URL state via nuqs hooks
   |
   | 8. Each Widget mounts -> useQuery({ queryKey: ['dashboard', 'revenue', filters], queryFn: fetchRevenueYTD, staleTime: 5min })
   |    Cache deja peuple par dehydrate/hydrate -> render immediat sans refetch
   |
   | 9. User changes filter -> nuqs updates URL -> filters object change -> useQuery refetch automatique
   |
   | 10. User clicks "Refresh" -> queryClient.invalidateQueries({ queryKey: ['dashboard'] }) -> refetch all 6
   |
   | 11. Auto-refresh toggle ON -> useQuery refetchInterval: 5 * 60 * 1000
```

---

## 4. Livrables checkables (25+ deliverables)

- [ ] **L1** : `repo/apps/web-broker/app/[locale]/(protected)/dashboard/page.tsx` (~150 lignes) Server Component avec `async function Page({ params, searchParams })`, parse filters via nuqs `createSearchParamsCache`, instanciate `QueryClient` local, parallel `Promise.all` 6 prefetch queries, `dehydrate(queryClient)`, return `<HydrationBoundary state={dehydratedState}><DashboardClient initialFilters={filters} /></HydrationBoundary>`. Metadata seo title "Dashboard | Skalean Broker".

- [ ] **L2** : `repo/apps/web-broker/app/[locale]/(protected)/dashboard/loading.tsx` (~30 lignes) Suspense fallback global -- affiche `<DashboardGridSkeleton>` avec 6 placeholder cards.

- [ ] **L3** : `repo/apps/web-broker/app/[locale]/(protected)/dashboard/error.tsx` (~50 lignes) Error boundary avec `'use client'` + `useEffect` log Sentry + bouton retry "Reset" + message "Une erreur est survenue sur le dashboard. Reessayez ou contactez le support."

- [ ] **L4** : `repo/apps/web-broker/components/dashboard/dashboard-filters.tsx` (~180 lignes) Client Component avec `'use client'` + import `useQueryStates` nuqs + parsers `parseAsIsoDateTime`, `parseAsStringEnum(['day','week','month'])`, `parseAsArrayOf(parseAsString)`. UI : `<DateRangePicker>` (shadcn/ui), `<Select>` group_by, `<MultiSelect>` branches. Preset buttons : "Last 7d", "Last 30d", "YTD", "Last Year", "Custom".

- [ ] **L5** : `repo/apps/web-broker/components/dashboard/dashboard-header.tsx` (~120 lignes) Client Component avec title locale-aware + breadcrumb + bouton refresh manuel (call `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`) + `<AutoRefreshToggle />` + dropdown export "PDF" / "CSV" (handler stub toast "Disponible Sprint 32").

- [ ] **L6** : `repo/apps/web-broker/components/dashboard/dashboard-grid.tsx` (~80 lignes) CSS grid responsive 1 col mobile / 2 cols tablet / 3 cols desktop -- chaque widget wrap dans `<Suspense fallback={<WidgetSkeleton />}>`. RTL aware (grid-flow direction).

- [ ] **L7** : `repo/apps/web-broker/components/dashboard/widgets/revenue-ytd-widget.tsx` (~180 lignes) Client Component avec `useRevenueYTD(filters)` hook, render `<Card>` header "Revenu YTD" + total formatted MAD + YoY badge (+12% vert / -5% rouge) + `<ResponsiveContainer><LineChart>` recharts avec XAxis month, YAxis MAD, Line stroke Skalean Orange, Tooltip custom.

- [ ] **L8** : `repo/apps/web-broker/components/dashboard/widgets/conversion-funnel-widget.tsx` (~150 lignes) Client Component avec `useConversionFunnel(filters)` hook, render `<FunnelChart>` recharts avec 5 stages (lead/qualified/proposal/negotiation/won), labels custom `<LabelList>` rendering "Stage : count (%)" + conversion rates entre stages.

- [ ] **L9** : `repo/apps/web-broker/components/dashboard/widgets/polices-actives-widget.tsx` (~160 lignes) Client Component avec `usePolicesActives(filters)` hook, render `<PieChart>` recharts avec 6 secteurs (auto, sante, habitation, vie, RC pro, RC entreprise) + total card centre + legend cliquable (toggle visibility per branche) + `<table>` sr-only pour a11y.

- [ ] **L10** : `repo/apps/web-broker/components/dashboard/widgets/sinistres-cours-widget.tsx` (~140 lignes) Client Component avec `useSinistresCours(filters)` hook, render `<BarChart>` recharts avec 5 bars (declared, in_review, expert, settled, closed) + total + tooltip count par status.

- [ ] **L11** : `repo/apps/web-broker/components/dashboard/widgets/deals-open-widget.tsx` (~150 lignes) Client Component avec `useDealsOpen()` hook (top 5 prochains close-dates), render `<Card>` avec liste 5 deals (title + amount MAD + expected_close_date relative "in 3 days") + footer "Total value : XXX MAD" + count "12 deals open".

- [ ] **L12** : `repo/apps/web-broker/components/dashboard/widgets/activity-feed-widget.tsx` (~200 lignes) Client Component avec `useActivityFeed()` hook (last 10 interactions), render liste avec icone par type (Phone/Mail/MessageCircle/Video/StickyNote lucide-react) + contact name + libelle + relative time locale-aware + lien vers contact detail.

- [ ] **L13** : `repo/apps/web-broker/components/dashboard/widget-skeleton.tsx` (~50 lignes) shadcn/ui `<Skeleton>` placeholder pour pendant fetch -- variants `chart` / `list` / `card`.

- [ ] **L14** : `repo/apps/web-broker/components/dashboard/widget-empty-state.tsx` (~70 lignes) empty state avec illustration SVG (depuis `@insurtech/shared-ui/illustrations`) + titre + description + CTA "Create your first..." (route Link).

- [ ] **L15** : `repo/apps/web-broker/components/dashboard/widget-error-state.tsx` (~50 lignes) error state avec icone AlertCircle + message error + bouton "Reessayer" qui appelle `refetch()` du useQuery parent.

- [ ] **L16** : `repo/apps/web-broker/components/dashboard/auto-refresh-toggle.tsx` (~80 lignes) toggle Switch shadcn/ui + label "Actualisation auto (5min)" + persist localStorage `dashboard_auto_refresh: boolean` + propagation via hook `useAutoRefresh`.

- [ ] **L17** : `repo/apps/web-broker/lib/queries/dashboard.queries.ts` (~250 lignes) TanStack Query hooks : `useRevenueYTD`, `useConversionFunnel`, `usePolicesActives`, `useSinistresCours`, `useDealsOpen`, `useActivityFeed`. Chaque hook : `staleTime: 5*60*1000`, `refetchOnWindowFocus: false`, `refetchInterval: autoRefresh ? 5*60*1000 : false`.

- [ ] **L18** : `repo/apps/web-broker/lib/api/dashboard.api.ts` (~200 lignes) fetch wrappers : `fetchRevenueYTD(filters)`, `fetchConversionFunnel(filters)`, etc. Use `apiClient` (axios instance Sprint 4 task-1.4.1). Schemas Zod pour valider responses. Return types stricts.

- [ ] **L19** : `repo/apps/web-broker/lib/formatters/dashboard-formatters.ts` (~180 lignes) formatters : `formatRevenueMAD(value, locale)` -> "12 500 MAD" via `Intl.NumberFormat`, `formatRelativeTime(date, locale)` -> "il y a 2h" via `date-fns` `formatDistanceToNow`, `formatPercent(value, locale)`, `formatBranche(code, locale)` -> "Auto" / "السيارات", `formatActivityType(type)` -> icon + label.

- [ ] **L20** : `repo/apps/web-broker/hooks/use-dashboard-filters.ts` (~80 lignes) custom hook combine `useQueryStates` nuqs : retourne `{ filters, setFilters, setPreset }` avec preset shortcuts (last_7d, last_30d, ytd, last_year, custom).

- [ ] **L21** : `repo/apps/web-broker/hooks/use-auto-refresh.ts` (~60 lignes) custom hook combine localStorage persistence + state + propagation a `useQuery` refetchInterval.

- [ ] **L22** : `repo/apps/web-broker/messages/fr.json` (delta ~50 keys) ajout : `dashboard.*` (title, filters.{date_range,group_by,branches,reset}, widgets.{revenue,funnel,polices,sinistres,deals_open,activity}, refresh.{button,auto_label,manual}, export.{pdf,csv,not_available}).

- [ ] **L23** : `repo/apps/web-broker/messages/ar-MA.json` (delta ~50 keys Darija marocaine).

- [ ] **L24** : `repo/apps/web-broker/messages/ar.json` (delta ~50 keys arabe classique).

- [ ] **L25** : Tests Vitest `test/dashboard/*.spec.tsx` (12+ tests : 3 revenue, 2 funnel, 2 polices, 2 sinistres, 1 deals, 2 activity) couvrant render avec mock data + empty state + loading + error state + filter changes.

- [ ] **L26** : Tests E2E Playwright `repo/e2e/web/dashboard.spec.ts` (8+ tests) : dashboard load + filters apply + URL state + refresh button + auto-refresh toggle + export buttons stub + a11y axe-core + locale switch.

- [ ] **L27** : Validation : `pnpm --filter @insurtech/web-broker dev` puis nav `/fr/dashboard` rend les 6 widgets ; `pnpm --filter @insurtech/web-broker test` 12+ tests pass ; `pnpm --filter @insurtech/web-broker test:e2e -- dashboard.spec.ts` 8+ tests pass ; `pnpm --filter @insurtech/web-broker typecheck` 0 erreur ; `pnpm --filter @insurtech/web-broker lint` 0 erreur.

- [ ] **L28** : `grep -r "console.log" repo/apps/web-broker/components/dashboard/` retourne 0 ligne (sauf tests).

- [ ] **L29** : `grep -rn "emoji-regex" repo/apps/web-broker/components/dashboard/` retourne 0 ligne (decision-006).

- [ ] **L30** : Lighthouse `/fr/dashboard` Performance >= 70, Accessibility >= 90, Best Practices >= 90.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
  app/[locale]/(protected)/dashboard/
    page.tsx                                                    # ~150 lignes  -- L1
    loading.tsx                                                 # ~30 lignes   -- L2
    error.tsx                                                   # ~50 lignes   -- L3

  components/dashboard/
    dashboard-filters.tsx                                       # ~180 lignes  -- L4
    dashboard-header.tsx                                        # ~120 lignes  -- L5
    dashboard-grid.tsx                                          # ~80 lignes   -- L6
    auto-refresh-toggle.tsx                                     # ~80 lignes   -- L16
    widget-skeleton.tsx                                         # ~50 lignes   -- L13
    widget-empty-state.tsx                                      # ~70 lignes   -- L14
    widget-error-state.tsx                                      # ~50 lignes   -- L15
    widgets/
      revenue-ytd-widget.tsx                                    # ~180 lignes  -- L7
      conversion-funnel-widget.tsx                              # ~150 lignes  -- L8
      polices-actives-widget.tsx                                # ~160 lignes  -- L9
      sinistres-cours-widget.tsx                                # ~140 lignes  -- L10
      deals-open-widget.tsx                                     # ~150 lignes  -- L11
      activity-feed-widget.tsx                                  # ~200 lignes  -- L12

  lib/
    queries/
      dashboard.queries.ts                                      # ~250 lignes  -- L17
    api/
      dashboard.api.ts                                          # ~200 lignes  -- L18
    formatters/
      dashboard-formatters.ts                                   # ~180 lignes  -- L19

  hooks/
    use-dashboard-filters.ts                                    # ~80 lignes   -- L20
    use-auto-refresh.ts                                         # ~60 lignes   -- L21

  messages/
    fr.json                                                     # delta +50 keys -- L22
    ar-MA.json                                                  # delta +50 keys -- L23
    ar.json                                                     # delta +50 keys -- L24

  test/dashboard/
    revenue-ytd-widget.spec.tsx                                 # 3 tests -- L25
    conversion-funnel-widget.spec.tsx                           # 2 tests -- L25
    polices-actives-widget.spec.tsx                             # 2 tests -- L25
    sinistres-cours-widget.spec.tsx                             # 2 tests -- L25
    deals-open-widget.spec.tsx                                  # 1 test  -- L25
    activity-feed-widget.spec.tsx                               # 2 tests -- L25
    dashboard-filters.spec.tsx                                  # 3 tests -- L25
    dashboard-formatters.spec.ts                                # 5 tests -- L25

repo/e2e/web/
  dashboard.spec.ts                                             # ~280 lignes 8 tests -- L26
```

Total : ~25 fichiers crees/modifies, ~2300 lignes nettes hors tests, ~700 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/apps/web-broker/app/[locale]/(protected)/dashboard/page.tsx` (~150 lignes)

```typescript
/**
 * Dashboard Page -- Server Component
 *
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.4)
 *
 * Strategie : Server Component fait fetch initial parallele des 6 queries dashboard,
 * dehydrate le QueryClient, puis HydrationBoundary cote client garantit que les
 * widgets Client Components ne refetchent pas immediatement.
 *
 * Filters URL state via nuqs createSearchParamsCache (SSR-safe).
 *
 * Decisions :
 *   - decision-006 : aucune emoji
 *   - decision-007 : timezone Africa/Casablanca pour tous les date ranges
 *   - decision-009 : params async (Next.js 15)
 *   - decision-011 : KPI agreges uniquement, pas de PII
 */
import { Suspense } from 'react';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { createSearchParamsCache, parseAsIsoDateTime, parseAsStringEnum, parseAsArrayOf, parseAsString } from 'nuqs/server';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { RevenueYTDWidget } from '@/components/dashboard/widgets/revenue-ytd-widget';
import { ConversionFunnelWidget } from '@/components/dashboard/widgets/conversion-funnel-widget';
import { PolicesActivesWidget } from '@/components/dashboard/widgets/polices-actives-widget';
import { SinistresCoursWidget } from '@/components/dashboard/widgets/sinistres-cours-widget';
import { DealsOpenWidget } from '@/components/dashboard/widgets/deals-open-widget';
import { ActivityFeedWidget } from '@/components/dashboard/widgets/activity-feed-widget';
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton';
import {
  fetchRevenueYTD,
  fetchConversionFunnel,
  fetchPolicesActives,
  fetchSinistresCours,
  fetchDealsOpen,
  fetchActivityFeed,
} from '@/lib/api/dashboard.api';
import { resolveDateRangePreset, getDefaultDashboardFilters, type DashboardFilters as DashboardFiltersType } from '@/lib/queries/dashboard.queries';

const dashboardSearchParamsCache = createSearchParamsCache({
  date_start: parseAsIsoDateTime,
  date_end: parseAsIsoDateTime,
  group_by: parseAsStringEnum(['day', 'week', 'month']).withDefault('month'),
  branches: parseAsArrayOf(parseAsString).withDefault([]),
  preset: parseAsStringEnum(['last_7d', 'last_30d', 'ytd', 'last_year', 'custom']).withDefault('last_30d'),
});

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return {
    title: `${t('title')} | Skalean Broker`,
    description: t('seo.description'),
  };
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale } = await params;
  const rawSearchParams = await searchParams;

  // Server-side request locale (next-intl)
  setRequestLocale(locale);

  // Parse URL filters server-side
  const parsedFilters = dashboardSearchParamsCache.parse(rawSearchParams);
  const filters: DashboardFiltersType = resolveDateRangePreset({
    preset: parsedFilters.preset,
    date_start: parsedFilters.date_start ? parsedFilters.date_start.toISOString() : null,
    date_end: parsedFilters.date_end ? parsedFilters.date_end.toISOString() : null,
    group_by: parsedFilters.group_by,
    branches: parsedFilters.branches,
  });

  // Server-side parallel prefetch (eviter waterfall)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    },
  });

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'revenue', filters],
      queryFn: () => fetchRevenueYTD(filters),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'funnel', filters],
      queryFn: () => fetchConversionFunnel(filters),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'polices', filters],
      queryFn: () => fetchPolicesActives(filters),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'sinistres', filters],
      queryFn: () => fetchSinistresCours(filters),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'deals-open'],
      queryFn: () => fetchDealsOpen(),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'activity'],
      queryFn: () => fetchActivityFeed(),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="flex flex-col gap-6 p-6">
        <DashboardHeader />
        <DashboardFilters initialFilters={filters} />
        <DashboardGrid>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <RevenueYTDWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <ConversionFunnelWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <PolicesActivesWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <SinistresCoursWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton variant="list" />}>
            <DealsOpenWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton variant="list" />}>
            <ActivityFeedWidget />
          </Suspense>
        </DashboardGrid>
      </div>
    </HydrationBoundary>
  );
}
```

### 6.2 `repo/apps/web-broker/app/[locale]/(protected)/dashboard/loading.tsx` (~30 lignes)

```typescript
/**
 * Dashboard Loading -- Suspense fallback global
 *
 * Affiche un grid de skeletons pendant que le Server Component
 * fait ses 6 prefetch parallels.
 */
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-12 w-full max-w-md animate-pulse rounded-md bg-muted" />
      <div className="h-20 w-full animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <WidgetSkeleton variant="chart" />
        <WidgetSkeleton variant="chart" />
        <WidgetSkeleton variant="chart" />
        <WidgetSkeleton variant="chart" />
        <WidgetSkeleton variant="list" />
        <WidgetSkeleton variant="list" />
      </div>
    </div>
  );
}
```

### 6.3 `repo/apps/web-broker/app/[locale]/(protected)/dashboard/error.tsx` (~50 lignes)

```typescript
'use client';

/**
 * Dashboard Error Boundary
 *
 * Affiche un message d'erreur user-friendly + bouton retry.
 * Log error vers Sentry pour observability.
 */
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';

import { Button } from '@insurtech/shared-ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const t = useTranslations('dashboard.error');

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'dashboard' },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => reset()} variant="default">
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.4 `repo/apps/web-broker/components/dashboard/dashboard-filters.tsx` (~180 lignes)

```typescript
'use client';

/**
 * Dashboard Filters
 *
 * Filtres globaux partages par les 6 widgets :
 *  - date_range : preset (last_7d / last_30d / ytd / last_year / custom) + custom date picker
 *  - group_by : day / week / month
 *  - branches : multi-select auto/sante/habitation/vie/RC pro/RC entreprise
 *
 * URL state via nuqs (?preset=last_30d&group_by=month&branches=auto,sante).
 * Throttle 500ms pour eviter rafale fetch pendant typing.
 *
 * Reference : nuqs v2 docs https://nuqs.47ng.com
 */
import { useTransition } from 'react';
import { useQueryStates, parseAsIsoDateTime, parseAsStringEnum, parseAsArrayOf, parseAsString } from 'nuqs';
import { useTranslations } from 'next-intl';
import { CalendarIcon, FilterX } from 'lucide-react';

import { Button } from '@insurtech/shared-ui/components/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@insurtech/shared-ui/components/select';
import { Popover, PopoverContent, PopoverTrigger } from '@insurtech/shared-ui/components/popover';
import { Calendar } from '@insurtech/shared-ui/components/calendar';
import { Card, CardContent } from '@insurtech/shared-ui/components/card';
import { MultiSelect } from '@insurtech/shared-ui/components/multi-select';
import { cn } from '@insurtech/shared-ui/lib/utils';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { useLocale } from 'next-intl';

import type { DashboardFilters as DashboardFiltersType } from '@/lib/queries/dashboard.queries';

const BRANCHES = ['auto', 'sante', 'habitation', 'vie', 'rc_pro', 'rc_entreprise'] as const;

type DashboardFiltersProps = {
  initialFilters: DashboardFiltersType;
};

export function DashboardFilters({ initialFilters }: DashboardFiltersProps) {
  const t = useTranslations('dashboard.filters');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const [filterState, setFilterState] = useQueryStates(
    {
      date_start: parseAsIsoDateTime,
      date_end: parseAsIsoDateTime,
      group_by: parseAsStringEnum(['day', 'week', 'month']).withDefault('month'),
      branches: parseAsArrayOf(parseAsString).withDefault([]),
      preset: parseAsStringEnum(['last_7d', 'last_30d', 'ytd', 'last_year', 'custom']).withDefault('last_30d'),
    },
    {
      throttleMs: 500,
      shallow: false,
      startTransition,
    },
  );

  const dateFnsLocale = locale.startsWith('ar') ? ar : fr;

  const handlePreset = (preset: 'last_7d' | 'last_30d' | 'ytd' | 'last_year' | 'custom') => {
    if (preset === 'custom') {
      setFilterState({ preset: 'custom' });
    } else {
      setFilterState({ preset, date_start: null, date_end: null });
    }
  };

  const handleReset = () => {
    setFilterState({ preset: 'last_30d', date_start: null, date_end: null, group_by: 'month', branches: [] });
  };

  const branchOptions = BRANCHES.map((b) => ({
    value: b,
    label: t(`branches.${b}`),
  }));

  return (
    <Card className={cn('w-full', isPending && 'opacity-70 transition-opacity')}>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="flex flex-wrap gap-2">
          {(['last_7d', 'last_30d', 'ytd', 'last_year', 'custom'] as const).map((p) => (
            <Button
              key={p}
              variant={filterState.preset === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreset(p)}
              aria-pressed={filterState.preset === p}
            >
              {t(`preset.${p}`)}
            </Button>
          ))}
        </div>

        {filterState.preset === 'custom' && (
          <div className="flex flex-col gap-2 md:flex-row">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start">
                  <CalendarIcon className="me-2 h-4 w-4" />
                  {filterState.date_start
                    ? format(filterState.date_start, 'PPP', { locale: dateFnsLocale })
                    : t('date_start.placeholder')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterState.date_start ?? undefined}
                  onSelect={(d) => setFilterState({ date_start: d ?? null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start">
                  <CalendarIcon className="me-2 h-4 w-4" />
                  {filterState.date_end
                    ? format(filterState.date_end, 'PPP', { locale: dateFnsLocale })
                    : t('date_end.placeholder')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterState.date_end ?? undefined}
                  onSelect={(d) => setFilterState({ date_end: d ?? null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="group_by" className="text-xs text-muted-foreground">
              {t('group_by.label')}
            </label>
            <Select value={filterState.group_by} onValueChange={(v) => setFilterState({ group_by: v as 'day' | 'week' | 'month' })}>
              <SelectTrigger id="group_by" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('group_by.day')}</SelectItem>
                <SelectItem value="week">{t('group_by.week')}</SelectItem>
                <SelectItem value="month">{t('group_by.month')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t('branches.label')}</label>
            <MultiSelect
              options={branchOptions}
              value={filterState.branches}
              onValueChange={(v) => setFilterState({ branches: v })}
              placeholder={t('branches.placeholder')}
              className="w-64"
            />
          </div>

          <Button variant="ghost" size="sm" onClick={handleReset} aria-label={t('reset')}>
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.5 `repo/apps/web-broker/components/dashboard/dashboard-header.tsx` (~120 lignes)

```typescript
'use client';

/**
 * Dashboard Header
 *
 * Affiche : titre + breadcrumb + bouton refresh manuel + toggle auto-refresh + dropdown export
 */
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@insurtech/shared-ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@insurtech/shared-ui/components/dropdown-menu';

import { AutoRefreshToggle } from './auto-refresh-toggle';

export function DashboardHeader() {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success(t('refresh.success'));
  };

  const handleExportPDF = () => {
    toast.info(t('export.not_available_pdf'));
  };

  const handleExportCSV = () => {
    toast.info(t('export.not_available_csv'));
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AutoRefreshToggle />
        <Button variant="outline" size="sm" onClick={handleRefresh} aria-label={t('refresh.button')}>
          <RefreshCw className="me-2 h-4 w-4" />
          {t('refresh.button')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileDown className="me-2 h-4 w-4" />
              {t('export.label')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileText className="me-2 h-4 w-4" />
              {t('export.pdf')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV}>
              <FileSpreadsheet className="me-2 h-4 w-4" />
              {t('export.csv')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

### 6.6 `repo/apps/web-broker/components/dashboard/dashboard-grid.tsx` (~80 lignes)

```typescript
/**
 * Dashboard Grid
 *
 * Responsive grid 6 widgets :
 *  - mobile (< 768px) : 1 colonne empilee
 *  - tablet (768-1280px) : 2 colonnes
 *  - desktop (> 1280px) : 3 colonnes
 *
 * Le grid est dir-aware (LTR -> grid-flow row, RTL -> mirror).
 */
import type { ReactNode } from 'react';
import { cn } from '@insurtech/shared-ui/lib/utils';

type DashboardGridProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardGrid({ children, className }: DashboardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6',
        'md:grid-cols-2',
        'xl:grid-cols-3',
        className,
      )}
      role="region"
      aria-label="Dashboard widgets grid"
    >
      {children}
    </div>
  );
}
```

### 6.7 `repo/apps/web-broker/components/dashboard/auto-refresh-toggle.tsx` (~80 lignes)

```typescript
'use client';

/**
 * Auto Refresh Toggle
 *
 * Toggle Switch shadcn/ui qui active/desactive le poll 5min des widgets.
 * Etat persiste localStorage `dashboard_auto_refresh` (string boolean).
 *
 * Hook custom useAutoRefresh() expose le boolean + setter pour utilisation
 * dans les TanStack Query refetchInterval option.
 */
import { useTranslations } from 'next-intl';
import { Switch } from '@insurtech/shared-ui/components/switch';
import { Label } from '@insurtech/shared-ui/components/label';

import { useAutoRefresh } from '@/hooks/use-auto-refresh';

export function AutoRefreshToggle() {
  const t = useTranslations('dashboard.refresh');
  const { autoRefresh, setAutoRefresh } = useAutoRefresh();

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="auto-refresh"
        checked={autoRefresh}
        onCheckedChange={setAutoRefresh}
        aria-label={t('auto_label')}
      />
      <Label htmlFor="auto-refresh" className="cursor-pointer text-sm">
        {t('auto_label')}
      </Label>
    </div>
  );
}
```

### 6.8 `repo/apps/web-broker/hooks/use-auto-refresh.ts` (~60 lignes)

```typescript
'use client';

/**
 * useAutoRefresh hook
 *
 * Combine localStorage persist + state + propagation aux useQuery refetchInterval.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'dashboard_auto_refresh';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useAutoRefresh() {
  const [autoRefresh, setAutoRefreshState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setAutoRefreshState(true);
    }
    setHydrated(true);
  }, []);

  const setAutoRefresh = (value: boolean) => {
    setAutoRefreshState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // localStorage not available (private browsing)
    }
  };

  return {
    autoRefresh: hydrated ? autoRefresh : false,
    setAutoRefresh,
    pollIntervalMs: autoRefresh ? POLL_INTERVAL_MS : false as const,
  };
}
```

### 6.9 `repo/apps/web-broker/hooks/use-dashboard-filters.ts` (~80 lignes)

```typescript
'use client';

/**
 * useDashboardFilters hook
 *
 * Custom hook qui combine les filters nuqs URL state en un seul filters object,
 * pret a etre passe a chaque TanStack Query hook.
 *
 * Resolve presets en date_start/date_end concrets via resolveDateRangePreset.
 */
import { useMemo } from 'react';
import { useQueryStates, parseAsIsoDateTime, parseAsStringEnum, parseAsArrayOf, parseAsString } from 'nuqs';
import { resolveDateRangePreset, type DashboardFilters } from '@/lib/queries/dashboard.queries';

export function useDashboardFilters(): DashboardFilters {
  const [filterState] = useQueryStates({
    date_start: parseAsIsoDateTime,
    date_end: parseAsIsoDateTime,
    group_by: parseAsStringEnum(['day', 'week', 'month']).withDefault('month'),
    branches: parseAsArrayOf(parseAsString).withDefault([]),
    preset: parseAsStringEnum(['last_7d', 'last_30d', 'ytd', 'last_year', 'custom']).withDefault('last_30d'),
  });

  return useMemo(
    () =>
      resolveDateRangePreset({
        preset: filterState.preset,
        date_start: filterState.date_start ? filterState.date_start.toISOString() : null,
        date_end: filterState.date_end ? filterState.date_end.toISOString() : null,
        group_by: filterState.group_by,
        branches: filterState.branches,
      }),
    [filterState.preset, filterState.date_start, filterState.date_end, filterState.group_by, filterState.branches.join(',')],
  );
}
```

### 6.10 `repo/apps/web-broker/lib/queries/dashboard.queries.ts` (~250 lignes)

```typescript
'use client';

/**
 * Dashboard TanStack Query hooks
 *
 * Un hook par widget. Tous les hooks partagent :
 *  - staleTime 5min (KPI changent rarement intra-5min)
 *  - refetchOnWindowFocus false (eviter rafale)
 *  - refetchInterval conditionnel via useAutoRefresh()
 *  - retry 2 fois avec exponential backoff
 *
 * Reference : @tanstack/react-query 5.62.0
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { startOfYear, subDays, subYears, formatISO, startOfDay, endOfDay } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import {
  fetchRevenueYTD,
  fetchConversionFunnel,
  fetchPolicesActives,
  fetchSinistresCours,
  fetchDealsOpen,
  fetchActivityFeed,
  type RevenueYTDResponse,
  type ConversionFunnelResponse,
  type PolicesActivesResponse,
  type SinistresCoursResponse,
  type DealsOpenResponse,
  type ActivityFeedResponse,
} from '@/lib/api/dashboard.api';

const TIMEZONE = 'Africa/Casablanca';
const STALE_TIME = 5 * 60 * 1000;
const GC_TIME = 10 * 60 * 1000;

export type DashboardPreset = 'last_7d' | 'last_30d' | 'ytd' | 'last_year' | 'custom';
export type DashboardGroupBy = 'day' | 'week' | 'month';

export type DashboardFilters = {
  preset: DashboardPreset;
  date_start: string;
  date_end: string;
  group_by: DashboardGroupBy;
  branches: string[];
};

export function getDefaultDashboardFilters(): DashboardFilters {
  return resolveDateRangePreset({
    preset: 'last_30d',
    date_start: null,
    date_end: null,
    group_by: 'month',
    branches: [],
  });
}

/**
 * Resolve a preset to concrete date_start/date_end in Africa/Casablanca TZ.
 * Si preset = 'custom', utilise les dates fournies (sinon defaut last_30d).
 */
export function resolveDateRangePreset(input: {
  preset: DashboardPreset;
  date_start: string | null;
  date_end: string | null;
  group_by: DashboardGroupBy;
  branches: string[];
}): DashboardFilters {
  const nowUtc = new Date();
  const nowTz = utcToZonedTime(nowUtc, TIMEZONE);
  let date_start: Date;
  let date_end: Date;

  switch (input.preset) {
    case 'last_7d':
      date_end = endOfDay(nowTz);
      date_start = startOfDay(subDays(nowTz, 6));
      break;
    case 'last_30d':
      date_end = endOfDay(nowTz);
      date_start = startOfDay(subDays(nowTz, 29));
      break;
    case 'ytd':
      date_end = endOfDay(nowTz);
      date_start = startOfYear(nowTz);
      break;
    case 'last_year':
      date_end = endOfDay(subYears(nowTz, 1));
      date_start = startOfYear(subYears(nowTz, 1));
      break;
    case 'custom':
      date_end = input.date_end ? new Date(input.date_end) : endOfDay(nowTz);
      date_start = input.date_start ? new Date(input.date_start) : startOfDay(subDays(nowTz, 29));
      break;
    default:
      date_end = endOfDay(nowTz);
      date_start = startOfDay(subDays(nowTz, 29));
  }

  // Convert back to UTC ISO for API
  return {
    preset: input.preset,
    date_start: formatISO(zonedTimeToUtc(date_start, TIMEZONE)),
    date_end: formatISO(zonedTimeToUtc(date_end, TIMEZONE)),
    group_by: input.group_by,
    branches: input.branches,
  };
}

export function useRevenueYTD(filters: DashboardFilters): UseQueryResult<RevenueYTDResponse> {
  const { pollIntervalMs } = useAutoRefresh();
  return useQuery({
    queryKey: ['dashboard', 'revenue', filters],
    queryFn: () => fetchRevenueYTD(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export function useConversionFunnel(filters: DashboardFilters): UseQueryResult<ConversionFunnelResponse> {
  const { pollIntervalMs } = useAutoRefresh();
  return useQuery({
    queryKey: ['dashboard', 'funnel', filters],
    queryFn: () => fetchConversionFunnel(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs,
    retry: 2,
  });
}

export function usePolicesActives(filters: DashboardFilters): UseQueryResult<PolicesActivesResponse> {
  const { pollIntervalMs } = useAutoRefresh();
  return useQuery({
    queryKey: ['dashboard', 'polices', filters],
    queryFn: () => fetchPolicesActives(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs,
    retry: 2,
  });
}

export function useSinistresCours(filters: DashboardFilters): UseQueryResult<SinistresCoursResponse> {
  const { pollIntervalMs } = useAutoRefresh();
  return useQuery({
    queryKey: ['dashboard', 'sinistres', filters],
    queryFn: () => fetchSinistresCours(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs,
    retry: 2,
  });
}

export function useDealsOpen(): UseQueryResult<DealsOpenResponse> {
  const { pollIntervalMs } = useAutoRefresh();
  return useQuery({
    queryKey: ['dashboard', 'deals-open'],
    queryFn: () => fetchDealsOpen(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs,
    retry: 2,
  });
}

export function useActivityFeed(): UseQueryResult<ActivityFeedResponse> {
  const { pollIntervalMs } = useAutoRefresh();
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => fetchActivityFeed(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs,
    retry: 2,
  });
}
```

### 6.11 `repo/apps/web-broker/lib/api/dashboard.api.ts` (~200 lignes)

```typescript
/**
 * Dashboard API fetch wrappers
 *
 * Chaque wrapper consomme un endpoint Sprint 13/14/8 + valide la response via Zod.
 *
 * Endpoints :
 *   - GET /api/v1/analytics/dashboards/broker/revenue
 *   - GET /api/v1/crm/dashboards/conversion-funnel
 *   - GET /api/v1/insure/dashboards/policies-active
 *   - GET /api/v1/repair/dashboards/sinistres-status
 *   - GET /api/v1/crm/deals/open
 *   - GET /api/v1/crm/activities/feed
 */
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import type { DashboardFilters } from '@/lib/queries/dashboard.queries';

const RevenuePointSchema = z.object({
  period: z.string(),
  revenue_mad: z.number().nonnegative(),
  policies_count: z.number().int().nonnegative(),
});

const RevenueYTDResponseSchema = z.object({
  total_mad: z.number().nonnegative(),
  yoy_change_percent: z.number(),
  points: z.array(RevenuePointSchema),
  currency: z.literal('MAD'),
  group_by: z.enum(['day', 'week', 'month']),
});
export type RevenueYTDResponse = z.infer<typeof RevenueYTDResponseSchema>;

const FunnelStageSchema = z.object({
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won']),
  count: z.number().int().nonnegative(),
  total_value_mad: z.number().nonnegative(),
});

const ConversionFunnelResponseSchema = z.object({
  stages: z.array(FunnelStageSchema),
  overall_conversion_percent: z.number(),
});
export type ConversionFunnelResponse = z.infer<typeof ConversionFunnelResponseSchema>;

const PoliceBrancheSchema = z.object({
  branche: z.enum(['auto', 'sante', 'habitation', 'vie', 'rc_pro', 'rc_entreprise']),
  count: z.number().int().nonnegative(),
  total_premium_mad: z.number().nonnegative(),
});

const PolicesActivesResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  breakdown: z.array(PoliceBrancheSchema),
});
export type PolicesActivesResponse = z.infer<typeof PolicesActivesResponseSchema>;

const SinistreStatusSchema = z.object({
  status: z.enum(['declared', 'in_review', 'expert', 'settled', 'closed']),
  count: z.number().int().nonnegative(),
});

const SinistresCoursResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  breakdown: z.array(SinistreStatusSchema),
});
export type SinistresCoursResponse = z.infer<typeof SinistresCoursResponseSchema>;

const OpenDealSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  amount_mad: z.number().nonnegative(),
  contact_name: z.string(),
  expected_close_date: z.string(),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation']),
  owner_name: z.string(),
});

const DealsOpenResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  total_value_mad: z.number().nonnegative(),
  top_5: z.array(OpenDealSchema).max(5),
});
export type DealsOpenResponse = z.infer<typeof DealsOpenResponseSchema>;

const ActivityItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['call', 'email', 'whatsapp', 'meeting', 'note']),
  title: z.string(),
  description: z.string().optional(),
  contact_id: z.string().uuid(),
  contact_name: z.string(),
  occurred_at: z.string(),
  owner_name: z.string(),
});

const ActivityFeedResponseSchema = z.object({
  items: z.array(ActivityItemSchema).max(10),
});
export type ActivityFeedResponse = z.infer<typeof ActivityFeedResponseSchema>;

function buildQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams({
    date_start: filters.date_start,
    date_end: filters.date_end,
    group_by: filters.group_by,
  });
  if (filters.branches.length > 0) {
    params.set('branches', filters.branches.join(','));
  }
  return params.toString();
}

export async function fetchRevenueYTD(filters: DashboardFilters): Promise<RevenueYTDResponse> {
  const { data } = await apiClient.get(`/api/v1/analytics/dashboards/broker/revenue?${buildQuery(filters)}`);
  return RevenueYTDResponseSchema.parse(data);
}

export async function fetchConversionFunnel(filters: DashboardFilters): Promise<ConversionFunnelResponse> {
  const { data } = await apiClient.get(`/api/v1/crm/dashboards/conversion-funnel?${buildQuery(filters)}`);
  return ConversionFunnelResponseSchema.parse(data);
}

export async function fetchPolicesActives(filters: DashboardFilters): Promise<PolicesActivesResponse> {
  const params = new URLSearchParams({
    date_start: filters.date_start,
    date_end: filters.date_end,
    group_by: 'branche',
  });
  const { data } = await apiClient.get(`/api/v1/insure/dashboards/policies-active?${params.toString()}`);
  return PolicesActivesResponseSchema.parse(data);
}

export async function fetchSinistresCours(filters: DashboardFilters): Promise<SinistresCoursResponse> {
  const { data } = await apiClient.get(`/api/v1/repair/dashboards/sinistres-status?${buildQuery(filters)}`);
  return SinistresCoursResponseSchema.parse(data);
}

export async function fetchDealsOpen(): Promise<DealsOpenResponse> {
  const { data } = await apiClient.get(`/api/v1/crm/deals/open?limit=5&order_by=expected_close_date`);
  return DealsOpenResponseSchema.parse(data);
}

export async function fetchActivityFeed(): Promise<ActivityFeedResponse> {
  const { data } = await apiClient.get(`/api/v1/crm/activities/feed?limit=10`);
  return ActivityFeedResponseSchema.parse(data);
}
```

### 6.12 `repo/apps/web-broker/lib/formatters/dashboard-formatters.ts` (~180 lignes)

```typescript
/**
 * Dashboard Formatters
 *
 * Helpers locale-aware pour afficher les valeurs dans les widgets :
 *  - formatRevenueMAD : Intl.NumberFormat MAD 0 decimales
 *  - formatPercent : Intl.NumberFormat avec signe + couleur indicative
 *  - formatRelativeTime : date-fns formatDistanceToNow locale
 *  - formatBranche : code -> label locale
 *  - formatActivityType : type -> icon + label
 *  - formatDealStage : stage -> label
 */
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { utcToZonedTime } from 'date-fns-tz';
import {
  Phone,
  Mail,
  MessageCircle,
  Video,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

const TIMEZONE = 'Africa/Casablanca';

export function formatRevenueMAD(value: number, locale: string = 'fr-MA'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : locale, {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatRevenueMADCompact(value: number, locale: string = 'fr-MA'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : locale, {
    style: 'currency',
    currency: 'MAD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number, locale: string = 'fr-MA', withSign = false): string {
  const formatted = new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : locale, {
    style: 'percent',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: withSign ? 'exceptZero' : 'auto',
  }).format(value / 100);
  return formatted;
}

export function formatRelativeTime(isoDate: string, locale: string = 'fr'): string {
  try {
    const date = parseISO(isoDate);
    const zonedDate = utcToZonedTime(date, TIMEZONE);
    const dateFnsLocale = locale.startsWith('ar') ? ar : fr;
    return formatDistanceToNow(zonedDate, { addSuffix: true, locale: dateFnsLocale });
  } catch {
    return isoDate;
  }
}

export function formatAbsoluteDate(isoDate: string, locale: string = 'fr'): string {
  try {
    const date = parseISO(isoDate);
    const zonedDate = utcToZonedTime(date, TIMEZONE);
    const dateFnsLocale = locale.startsWith('ar') ? ar : fr;
    return format(zonedDate, 'PPP', { locale: dateFnsLocale });
  } catch {
    return isoDate;
  }
}

type BrancheCode = 'auto' | 'sante' | 'habitation' | 'vie' | 'rc_pro' | 'rc_entreprise';

const BRANCHE_LABELS_FR: Record<BrancheCode, string> = {
  auto: 'Auto',
  sante: 'Sante',
  habitation: 'Habitation',
  vie: 'Vie',
  rc_pro: 'RC Pro',
  rc_entreprise: 'RC Entreprise',
};

const BRANCHE_LABELS_AR: Record<BrancheCode, string> = {
  auto: 'السيارات',
  sante: 'الصحة',
  habitation: 'السكن',
  vie: 'الحياة',
  rc_pro: 'المسؤولية المهنية',
  rc_entreprise: 'مسؤولية المقاولة',
};

export function formatBranche(code: BrancheCode, locale: string = 'fr'): string {
  if (locale.startsWith('ar')) return BRANCHE_LABELS_AR[code] ?? code;
  return BRANCHE_LABELS_FR[code] ?? code;
}

export const BRANCHE_COLORS: Record<BrancheCode, string> = {
  auto: '#E95D2C',
  sante: '#2D5773',
  habitation: '#B0CEE2',
  vie: '#1A2730',
  rc_pro: '#F4A340',
  rc_entreprise: '#6E8794',
};

type ActivityType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note';

export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Video,
  note: StickyNote,
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call: '#E95D2C',
  email: '#2D5773',
  whatsapp: '#25D366',
  meeting: '#1A2730',
  note: '#B0CEE2',
};

type SinistreStatus = 'declared' | 'in_review' | 'expert' | 'settled' | 'closed';

export const SINISTRE_STATUS_COLORS: Record<SinistreStatus, string> = {
  declared: '#F4A340',
  in_review: '#2D5773',
  expert: '#B0CEE2',
  settled: '#6E8794',
  closed: '#1A2730',
};

export function formatDealStage(stage: string, locale: string = 'fr'): string {
  const labels_fr: Record<string, string> = {
    lead: 'Prospect',
    qualified: 'Qualifie',
    proposal: 'Proposition',
    negotiation: 'Negociation',
    won: 'Gagne',
  };
  const labels_ar: Record<string, string> = {
    lead: 'محتمل',
    qualified: 'مؤهل',
    proposal: 'عرض',
    negotiation: 'تفاوض',
    won: 'مكسوب',
  };
  if (locale.startsWith('ar')) return labels_ar[stage] ?? stage;
  return labels_fr[stage] ?? stage;
}
```

### 6.13 `repo/apps/web-broker/components/dashboard/widgets/revenue-ytd-widget.tsx` (~180 lignes)

```typescript
'use client';

/**
 * Revenue YTD Widget
 *
 * Affiche : total revenue MAD YTD + YoY change % + LineChart points mensuels.
 *
 * Source : GET /api/v1/analytics/dashboards/broker/revenue (Sprint 13)
 */
import { useTranslations, useLocale } from 'next-intl';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Badge } from '@insurtech/shared-ui/components/badge';
import { cn } from '@insurtech/shared-ui/lib/utils';

import { useRevenueYTD } from '@/lib/queries/dashboard.queries';
import { useDashboardFilters } from '@/hooks/use-dashboard-filters';
import { formatRevenueMAD, formatRevenueMADCompact, formatPercent } from '@/lib/formatters/dashboard-formatters';
import { WidgetSkeleton } from '../widget-skeleton';
import { WidgetEmptyState } from '../widget-empty-state';
import { WidgetErrorState } from '../widget-error-state';

const ORANGE = '#E95D2C';

export function RevenueYTDWidget() {
  const t = useTranslations('dashboard.widgets.revenue');
  const locale = useLocale();
  const filters = useDashboardFilters();
  const { data, isLoading, isError, refetch } = useRevenueYTD(filters);

  if (isLoading) return <WidgetSkeleton variant="chart" />;
  if (isError) return <WidgetErrorState onRetry={refetch} />;
  if (!data || data.points.length === 0) {
    return <WidgetEmptyState title={t('empty.title')} description={t('empty.description')} ctaHref="/polices/new" ctaLabel={t('empty.cta')} />;
  }

  const yoyPositive = data.yoy_change_percent >= 0;

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
          <Badge
            variant={yoyPositive ? 'default' : 'destructive'}
            className={cn(yoyPositive ? 'bg-green-600 hover:bg-green-700' : '')}
            aria-label={t('yoy.aria', { percent: formatPercent(data.yoy_change_percent, locale, true) })}
          >
            {yoyPositive ? <TrendingUp className="me-1 h-3 w-3" /> : <TrendingDown className="me-1 h-3 w-3" />}
            {formatPercent(data.yoy_change_percent, locale, true)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-3xl font-bold tracking-tight" aria-label={t('total.aria')}>
            {formatRevenueMAD(data.total_mad, locale)}
          </p>
          <p className="text-xs text-muted-foreground">{t('total.label')}</p>
        </div>
        <div className="h-64 min-h-[256px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => formatRevenueMADCompact(v as number, locale)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [formatRevenueMAD(value, locale), t('tooltip.revenue')]}
              />
              <Line
                type="monotone"
                dataKey="revenue_mad"
                stroke={ORANGE}
                strokeWidth={2.5}
                dot={{ r: 4, fill: ORANGE }}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{t('table.caption')}</caption>
          <thead>
            <tr>
              <th>{t('table.period')}</th>
              <th>{t('table.revenue')}</th>
              <th>{t('table.policies')}</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((p) => (
              <tr key={p.period}>
                <td>{p.period}</td>
                <td>{formatRevenueMAD(p.revenue_mad, locale)}</td>
                <td>{p.policies_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

### 6.14 `repo/apps/web-broker/components/dashboard/widgets/conversion-funnel-widget.tsx` (~150 lignes)

```typescript
'use client';

/**
 * Conversion Funnel Widget
 *
 * Affiche : FunnelChart recharts avec 5 stages pipeline.
 *  - Lead -> Qualified -> Proposal -> Negotiation -> Won
 * Calcule + affiche les taux de conversion entre stages.
 */
import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FunnelChart, Funnel, LabelList, ResponsiveContainer, Tooltip, Cell } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';

import { useConversionFunnel } from '@/lib/queries/dashboard.queries';
import { useDashboardFilters } from '@/hooks/use-dashboard-filters';
import { formatPercent, formatRevenueMADCompact, formatDealStage } from '@/lib/formatters/dashboard-formatters';
import { WidgetSkeleton } from '../widget-skeleton';
import { WidgetEmptyState } from '../widget-empty-state';
import { WidgetErrorState } from '../widget-error-state';

const STAGE_COLORS = ['#E95D2C', '#F4A340', '#2D5773', '#B0CEE2', '#1A2730'];

export function ConversionFunnelWidget() {
  const t = useTranslations('dashboard.widgets.funnel');
  const locale = useLocale();
  const filters = useDashboardFilters();
  const { data, isLoading, isError, refetch } = useConversionFunnel(filters);

  const funnelData = useMemo(() => {
    if (!data) return [];
    return data.stages.map((s, i) => ({
      name: formatDealStage(s.stage, locale),
      value: s.count,
      fill: STAGE_COLORS[i],
      stage: s.stage,
      total_value_mad: s.total_value_mad,
      conversion_from_previous: i === 0 ? 100 : (s.count / (data.stages[i - 1]?.count || 1)) * 100,
    }));
  }, [data, locale]);

  if (isLoading) return <WidgetSkeleton variant="chart" />;
  if (isError) return <WidgetErrorState onRetry={refetch} />;
  if (!data || data.stages.every((s) => s.count === 0)) {
    return <WidgetEmptyState title={t('empty.title')} description={t('empty.description')} ctaHref="/deals/new" ctaLabel={t('empty.cta')} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('subtitle', { rate: formatPercent(data.overall_conversion_percent, locale) })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 min-h-[288px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string, props: { payload?: { total_value_mad?: number } }) => [
                  `${value} (${formatRevenueMADCompact(props.payload?.total_value_mad ?? 0, locale)})`,
                  name,
                ]}
              />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" fontSize={12} />
                <LabelList
                  position="center"
                  fill="#FFFFFF"
                  stroke="none"
                  dataKey="value"
                  fontSize={13}
                  fontWeight="bold"
                />
                {funnelData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          {funnelData.map((entry, i) => (
            <div key={entry.stage} className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.fill }} aria-hidden="true" />
              <span>
                {entry.name}: {entry.value}
                {i > 0 && (
                  <span className="ms-1 text-muted-foreground">
                    ({formatPercent(entry.conversion_from_previous, locale)})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.15 `repo/apps/web-broker/components/dashboard/widgets/polices-actives-widget.tsx` (~160 lignes)

```typescript
'use client';

/**
 * Polices Actives Widget
 *
 * Affiche : PieChart breakdown par branche (auto/sante/habitation/vie/RC pro/RC entreprise)
 * + total card centre + legend cliquable (toggle visibility).
 */
import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';

import { usePolicesActives } from '@/lib/queries/dashboard.queries';
import { useDashboardFilters } from '@/hooks/use-dashboard-filters';
import { formatRevenueMADCompact, formatBranche, BRANCHE_COLORS } from '@/lib/formatters/dashboard-formatters';
import { WidgetSkeleton } from '../widget-skeleton';
import { WidgetEmptyState } from '../widget-empty-state';
import { WidgetErrorState } from '../widget-error-state';

export function PolicesActivesWidget() {
  const t = useTranslations('dashboard.widgets.polices');
  const locale = useLocale();
  const filters = useDashboardFilters();
  const { data, isLoading, isError, refetch } = usePolicesActives(filters);
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(new Set());

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.breakdown
      .filter((b) => b.count > 0 && !hiddenBranches.has(b.branche))
      .map((b) => ({
        name: formatBranche(b.branche, locale),
        value: b.count,
        branche: b.branche,
        total_premium_mad: b.total_premium_mad,
        fill: BRANCHE_COLORS[b.branche],
      }));
  }, [data, locale, hiddenBranches]);

  if (isLoading) return <WidgetSkeleton variant="chart" />;
  if (isError) return <WidgetErrorState onRetry={refetch} />;
  if (!data || data.total_count === 0) {
    return <WidgetEmptyState title={t('empty.title')} description={t('empty.description')} ctaHref="/polices/new" ctaLabel={t('empty.cta')} />;
  }

  const toggleBranche = (branche: string) => {
    setHiddenBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branche)) {
        next.delete(branche);
      } else {
        next.add(branche);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle', { count: data.total_count })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-64 min-h-[256px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string, props: { payload?: { total_premium_mad?: number } }) => [
                  `${value} (${formatRevenueMADCompact(props.payload?.total_premium_mad ?? 0, locale)})`,
                  name,
                ]}
              />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                isAnimationActive
              >
                {pieData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold">{data.total_count}</span>
            <span className="text-xs text-muted-foreground">{t('total.label')}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          {data.breakdown.map((b) => (
            <button
              key={b.branche}
              type="button"
              onClick={() => toggleBranche(b.branche)}
              className="flex items-center gap-1 text-start hover:opacity-80"
              aria-pressed={hiddenBranches.has(b.branche)}
            >
              <span
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: BRANCHE_COLORS[b.branche],
                  opacity: hiddenBranches.has(b.branche) ? 0.3 : 1,
                }}
                aria-hidden="true"
              />
              <span className={hiddenBranches.has(b.branche) ? 'line-through opacity-50' : ''}>
                {formatBranche(b.branche, locale)}: {b.count}
              </span>
            </button>
          ))}
        </div>
        <table className="sr-only">
          <caption>{t('table.caption')}</caption>
          <thead>
            <tr>
              <th>{t('table.branche')}</th>
              <th>{t('table.count')}</th>
              <th>{t('table.premium')}</th>
            </tr>
          </thead>
          <tbody>
            {data.breakdown.map((b) => (
              <tr key={b.branche}>
                <td>{formatBranche(b.branche, locale)}</td>
                <td>{b.count}</td>
                <td>{formatRevenueMADCompact(b.total_premium_mad, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

### 6.16 `repo/apps/web-broker/components/dashboard/widgets/sinistres-cours-widget.tsx` (~140 lignes)

```typescript
'use client';

/**
 * Sinistres en Cours Widget
 *
 * Affiche : BarChart breakdown par status (declared/in_review/expert/settled/closed) + total.
 */
import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';

import { useSinistresCours } from '@/lib/queries/dashboard.queries';
import { useDashboardFilters } from '@/hooks/use-dashboard-filters';
import { SINISTRE_STATUS_COLORS } from '@/lib/formatters/dashboard-formatters';
import { WidgetSkeleton } from '../widget-skeleton';
import { WidgetEmptyState } from '../widget-empty-state';
import { WidgetErrorState } from '../widget-error-state';

type SinistreStatus = 'declared' | 'in_review' | 'expert' | 'settled' | 'closed';
const STATUSES: SinistreStatus[] = ['declared', 'in_review', 'expert', 'settled', 'closed'];

export function SinistresCoursWidget() {
  const t = useTranslations('dashboard.widgets.sinistres');
  const locale = useLocale();
  const filters = useDashboardFilters();
  const { data, isLoading, isError, refetch } = useSinistresCours(filters);

  const barData = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.breakdown.map((b) => [b.status, b.count]));
    return STATUSES.map((status) => ({
      status,
      label: t(`status.${status}`),
      count: map.get(status) ?? 0,
      fill: SINISTRE_STATUS_COLORS[status],
    }));
  }, [data, t]);

  if (isLoading) return <WidgetSkeleton variant="chart" />;
  if (isError) return <WidgetErrorState onRetry={refetch} />;
  if (!data || data.total_count === 0) {
    return <WidgetEmptyState title={t('empty.title')} description={t('empty.description')} ctaHref="/sinistres" ctaLabel={t('empty.cta')} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle', { count: data.total_count })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 min-h-[256px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [value, t('tooltip.count')]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1200}>
                {barData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{t('table.caption')}</caption>
          <thead>
            <tr>
              <th>{t('table.status')}</th>
              <th>{t('table.count')}</th>
            </tr>
          </thead>
          <tbody>
            {barData.map((b) => (
              <tr key={b.status}>
                <td>{b.label}</td>
                <td>{b.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

### 6.17 `repo/apps/web-broker/components/dashboard/widgets/deals-open-widget.tsx` (~150 lignes)

```typescript
'use client';

/**
 * Deals Open Widget
 *
 * Affiche : top 5 prochaines close dates + total value MAD agreggee + count deals open.
 */
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowRight, Calendar } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Button } from '@insurtech/shared-ui/components/button';
import { Badge } from '@insurtech/shared-ui/components/badge';

import { useDealsOpen } from '@/lib/queries/dashboard.queries';
import { formatRevenueMAD, formatRelativeTime, formatDealStage } from '@/lib/formatters/dashboard-formatters';
import { WidgetSkeleton } from '../widget-skeleton';
import { WidgetEmptyState } from '../widget-empty-state';
import { WidgetErrorState } from '../widget-error-state';

const STAGE_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  lead: 'outline',
  qualified: 'secondary',
  proposal: 'default',
  negotiation: 'default',
};

export function DealsOpenWidget() {
  const t = useTranslations('dashboard.widgets.deals_open');
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useDealsOpen();

  if (isLoading) return <WidgetSkeleton variant="list" />;
  if (isError) return <WidgetErrorState onRetry={refetch} />;
  if (!data || data.total_count === 0) {
    return <WidgetEmptyState title={t('empty.title')} description={t('empty.description')} ctaHref="/deals/new" ctaLabel={t('empty.cta')} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle', { count: data.total_count })}</CardDescription>
          </div>
          <div className="text-end">
            <p className="text-xl font-bold">{formatRevenueMAD(data.total_value_mad, locale)}</p>
            <p className="text-xs text-muted-foreground">{t('total_value')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3" role="list">
          {data.top_5.map((deal) => (
            <li key={deal.id}>
              <Link
                href={`/deals/${deal.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{deal.title}</span>
                    <Badge variant={STAGE_BADGE_VARIANTS[deal.stage] ?? 'outline'} className="text-[10px]">
                      {formatDealStage(deal.stage, locale)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{deal.contact_name}</span>
                    <span aria-hidden="true">|</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatRelativeTime(deal.expected_close_date, locale)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatRevenueMAD(deal.amount_mad, locale)}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/deals">
            {t('view_all')}
            <ArrowRight className="ms-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### 6.18 `repo/apps/web-broker/components/dashboard/widgets/activity-feed-widget.tsx` (~200 lignes)

```typescript
'use client';

/**
 * Activity Feed Widget
 *
 * Affiche : last 10 interactions client avec icone par type + contact name + libelle + temps relatif.
 */
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowRight, Activity as ActivityIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Button } from '@insurtech/shared-ui/components/button';
import { ScrollArea } from '@insurtech/shared-ui/components/scroll-area';

import { useActivityFeed } from '@/lib/queries/dashboard.queries';
import { formatRelativeTime, ACTIVITY_ICONS, ACTIVITY_COLORS } from '@/lib/formatters/dashboard-formatters';
import { WidgetSkeleton } from '../widget-skeleton';
import { WidgetEmptyState } from '../widget-empty-state';
import { WidgetErrorState } from '../widget-error-state';

export function ActivityFeedWidget() {
  const t = useTranslations('dashboard.widgets.activity');
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useActivityFeed();

  if (isLoading) return <WidgetSkeleton variant="list" />;
  if (isError) return <WidgetErrorState onRetry={refetch} />;
  if (!data || data.items.length === 0) {
    return <WidgetEmptyState title={t('empty.title')} description={t('empty.description')} ctaHref="/contacts" ctaLabel={t('empty.cta')} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80">
          <ul className="flex flex-col" role="list">
            {data.items.map((item, idx) => {
              const Icon = ACTIVITY_ICONS[item.type];
              const color = ACTIVITY_COLORS[item.type];
              return (
                <li key={item.id}>
                  <Link
                    href={`/contacts/${item.contact_id}`}
                    className={`flex items-start gap-3 border-b border-border p-4 transition-colors hover:bg-accent hover:text-accent-foreground ${
                      idx === data.items.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}20`, color }}
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{item.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(item.occurred_at, locale)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{item.contact_name}</span>
                        <span aria-hidden="true">|</span>
                        <span>{t(`type.${item.type}`)}</span>
                        <span aria-hidden="true">|</span>
                        <span>{item.owner_name}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/contacts">
            {t('view_all')}
            <ArrowRight className="ms-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### 6.19 `repo/apps/web-broker/components/dashboard/widget-skeleton.tsx` (~50 lignes)

```typescript
/**
 * Widget Skeleton
 *
 * Shared skeleton placeholder pendant fetch. Variants :
 *  - chart : skeleton chart (titre + barre haut + zone chart 256px)
 *  - list : skeleton liste (titre + 5 rows)
 *  - card : skeleton card simple
 */
import { Skeleton } from '@insurtech/shared-ui/components/skeleton';
import { Card, CardContent, CardHeader } from '@insurtech/shared-ui/components/card';

type WidgetSkeletonProps = {
  variant?: 'chart' | 'list' | 'card';
};

export function WidgetSkeleton({ variant = 'chart' }: WidgetSkeletonProps) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardHeader>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </CardHeader>
      <CardContent>
        {variant === 'chart' && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {variant === 'list' && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
        {variant === 'card' && <Skeleton className="h-24 w-full" />}
      </CardContent>
    </Card>
  );
}
```

### 6.20 `repo/apps/web-broker/components/dashboard/widget-empty-state.tsx` (~70 lignes)

```typescript
/**
 * Widget Empty State
 *
 * Shared empty state avec illustration + titre + description + CTA.
 */
import Link from 'next/link';
import { Inbox } from 'lucide-react';

import { Button } from '@insurtech/shared-ui/components/button';
import { Card, CardContent } from '@insurtech/shared-ui/components/card';

type WidgetEmptyStateProps = {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
  Illustration?: React.ComponentType<{ className?: string }>;
};

export function WidgetEmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
  Illustration,
}: WidgetEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
        {Illustration ? (
          <Illustration className="h-24 w-24 text-muted-foreground" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="default" size="sm">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

### 6.21 `repo/apps/web-broker/components/dashboard/widget-error-state.tsx` (~50 lignes)

```typescript
'use client';

/**
 * Widget Error State
 *
 * Error state avec icone AlertCircle + message + bouton "Reessayer".
 */
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@insurtech/shared-ui/components/button';
import { Card, CardContent } from '@insurtech/shared-ui/components/card';

type WidgetErrorStateProps = {
  onRetry: () => void | Promise<unknown>;
};

export function WidgetErrorState({ onRetry }: WidgetErrorStateProps) {
  const t = useTranslations('dashboard.error');

  return (
    <Card role="alert">
      <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">{t('widget_title')}</h3>
          <p className="max-w-xs text-sm text-muted-foreground">{t('widget_description')}</p>
        </div>
        <Button onClick={() => onRetry()} variant="outline" size="sm">
          <RefreshCw className="me-2 h-4 w-4" />
          {t('retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### 6.22 `repo/apps/web-broker/messages/fr.json` (delta dashboard namespace)

```json
{
  "dashboard": {
    "title": "Tableau de bord",
    "subtitle": "Vue d'ensemble de votre activite de courtage",
    "seo": {
      "description": "Tableau de bord Skalean Broker -- vue agreggee revenu, deals, polices, sinistres"
    },
    "filters": {
      "preset": {
        "last_7d": "7 derniers jours",
        "last_30d": "30 derniers jours",
        "ytd": "Annee en cours",
        "last_year": "Annee derniere",
        "custom": "Personnalise"
      },
      "date_start": { "placeholder": "Date debut" },
      "date_end": { "placeholder": "Date fin" },
      "group_by": {
        "label": "Grouper par",
        "day": "Jour",
        "week": "Semaine",
        "month": "Mois"
      },
      "branches": {
        "label": "Branches",
        "placeholder": "Toutes",
        "auto": "Auto",
        "sante": "Sante",
        "habitation": "Habitation",
        "vie": "Vie",
        "rc_pro": "RC Pro",
        "rc_entreprise": "RC Entreprise"
      },
      "reset": "Reinitialiser filtres"
    },
    "refresh": {
      "button": "Actualiser",
      "success": "Donnees actualisees",
      "auto_label": "Actualisation auto (5min)",
      "manual": "Actualiser maintenant"
    },
    "export": {
      "label": "Exporter",
      "pdf": "Export PDF",
      "csv": "Export CSV",
      "not_available_pdf": "Export PDF disponible Sprint 32 (Phase 7)",
      "not_available_csv": "Export CSV disponible Sprint 32 (Phase 7)"
    },
    "error": {
      "title": "Erreur de chargement",
      "description": "Une erreur est survenue lors du chargement du tableau de bord. Reessayez ou contactez le support.",
      "retry": "Reessayer",
      "widget_title": "Impossible de charger ce widget",
      "widget_description": "Verifiez votre connexion ou reessayez."
    },
    "widgets": {
      "revenue": {
        "title": "Revenu YTD",
        "subtitle": "Evolution mensuelle des primes encaissees",
        "total": { "label": "Total cumul depuis 1er janvier", "aria": "Total des revenus depuis le debut de l'annee" },
        "yoy": { "aria": "Variation annee sur annee de {percent}" },
        "tooltip": { "revenue": "Revenu" },
        "table": { "caption": "Donnees de revenu mensuel", "period": "Periode", "revenue": "Revenu", "policies": "Polices" },
        "empty": {
          "title": "Aucun revenu pour cette periode",
          "description": "Creez une premiere police pour commencer a suivre vos revenus.",
          "cta": "Creer une police"
        }
      },
      "funnel": {
        "title": "Conversion deals",
        "subtitle": "Taux global lead vers won : {rate}",
        "empty": {
          "title": "Aucun deal en pipeline",
          "description": "Creez votre premier deal pour visualiser le funnel de conversion.",
          "cta": "Creer un deal"
        }
      },
      "polices": {
        "title": "Polices actives",
        "subtitle": "{count} polices en cours par branche",
        "total": { "label": "Polices actives" },
        "table": { "caption": "Repartition polices par branche", "branche": "Branche", "count": "Nombre", "premium": "Prime totale" },
        "empty": {
          "title": "Aucune police active",
          "description": "Creez votre premiere police pour suivre votre portefeuille.",
          "cta": "Creer une police"
        }
      },
      "sinistres": {
        "title": "Sinistres en cours",
        "subtitle": "{count} sinistres a suivre",
        "status": {
          "declared": "Declares",
          "in_review": "En revue",
          "expert": "Expert",
          "settled": "Regles",
          "closed": "Clos"
        },
        "tooltip": { "count": "Nombre" },
        "table": { "caption": "Repartition sinistres par status", "status": "Status", "count": "Nombre" },
        "empty": {
          "title": "Aucun sinistre en cours",
          "description": "Consultez la liste complete des sinistres.",
          "cta": "Voir les sinistres"
        }
      },
      "deals_open": {
        "title": "Deals en cours",
        "subtitle": "{count} deals ouverts",
        "total_value": "Valeur totale",
        "view_all": "Voir tous les deals",
        "empty": {
          "title": "Aucun deal en cours",
          "description": "Creez votre premier deal pour commencer la prospection.",
          "cta": "Creer un deal"
        }
      },
      "activity": {
        "title": "Activite recente",
        "subtitle": "10 dernieres interactions client",
        "view_all": "Voir tous les contacts",
        "type": {
          "call": "Appel",
          "email": "Email",
          "whatsapp": "WhatsApp",
          "meeting": "Rendez-vous",
          "note": "Note"
        },
        "empty": {
          "title": "Aucune activite recente",
          "description": "Demarrez une conversation avec vos contacts.",
          "cta": "Voir mes contacts"
        }
      }
    }
  }
}
```

### 6.23 `repo/apps/web-broker/messages/ar-MA.json` (delta dashboard namespace Darija)

```json
{
  "dashboard": {
    "title": "لوحة القيادة",
    "subtitle": "نظرة عامة على نشاط ديالك ف السمسرة",
    "seo": { "description": "لوحة القيادة ديال Skalean Broker -- ملخص الدخل والصفقات والعقود والحوادث" },
    "filters": {
      "preset": {
        "last_7d": "7 أيام لي فاتو",
        "last_30d": "30 يوم لي فاتو",
        "ytd": "هاد العام",
        "last_year": "العام لي فات",
        "custom": "محدد"
      },
      "date_start": { "placeholder": "بداية" },
      "date_end": { "placeholder": "نهاية" },
      "group_by": {
        "label": "جمع حسب",
        "day": "نهار",
        "week": "سيمانة",
        "month": "شهر"
      },
      "branches": {
        "label": "الفروع",
        "placeholder": "كاملين",
        "auto": "السيارات",
        "sante": "الصحة",
        "habitation": "السكن",
        "vie": "الحياة",
        "rc_pro": "المسؤولية المهنية",
        "rc_entreprise": "مسؤولية المقاولة"
      },
      "reset": "صافي الفيلتر"
    },
    "refresh": {
      "button": "حدث",
      "success": "تحديث المعطيات",
      "auto_label": "تحديث تلقائي (5 دقايق)",
      "manual": "حدث دابا"
    },
    "export": {
      "label": "تصدير",
      "pdf": "PDF تصدير",
      "csv": "CSV تصدير",
      "not_available_pdf": "PDF غادي يتوفر ف Sprint 32",
      "not_available_csv": "CSV غادي يتوفر ف Sprint 32"
    },
    "error": {
      "title": "مشكل ف التحميل",
      "description": "كان مشكل. عاود حاول ولا تواصل مع الدعم.",
      "retry": "عاود",
      "widget_title": "ما قدرتش نحمل هاد الوديجيت",
      "widget_description": "شوف الكونيكسيون ديالك ولا عاود حاول."
    },
    "widgets": {
      "revenue": {
        "title": "الدخل ديال السنة",
        "subtitle": "تطور الاقساط الشهري",
        "total": { "label": "المجموع من فاتح يناير", "aria": "مجموع الدخل من بداية العام" },
        "yoy": { "aria": "تغير سنوي ب {percent}" },
        "tooltip": { "revenue": "الدخل" },
        "table": { "caption": "معطيات الدخل الشهري", "period": "الفترة", "revenue": "الدخل", "policies": "العقود" },
        "empty": {
          "title": "ما كاين دخل ف هاد الفترة",
          "description": "صاوب عقد جديد باش تبدا تتبع الدخل ديالك.",
          "cta": "صاوب عقد"
        }
      },
      "funnel": {
        "title": "تحويل الصفقات",
        "subtitle": "النسبة العامة من محتمل ل مكسوب : {rate}",
        "empty": {
          "title": "ما كاين حتى صفقة",
          "description": "صاوب صفقة جديدة باش تشوف القمع.",
          "cta": "صاوب صفقة"
        }
      },
      "polices": {
        "title": "العقود النشطة",
        "subtitle": "{count} عقد ف الجاري حسب الفرع",
        "total": { "label": "عقود نشطة" },
        "table": { "caption": "توزيع العقود حسب الفرع", "branche": "الفرع", "count": "العدد", "premium": "القسط" },
        "empty": {
          "title": "ما كاين عقد نشط",
          "description": "صاوب عقد ديالك الاول.",
          "cta": "صاوب عقد"
        }
      },
      "sinistres": {
        "title": "الحوادث الجارية",
        "subtitle": "{count} حادث للمتابعة",
        "status": {
          "declared": "مصرح",
          "in_review": "ف المراجعة",
          "expert": "خبير",
          "settled": "تسوية",
          "closed": "مغلق"
        },
        "tooltip": { "count": "العدد" },
        "table": { "caption": "توزيع الحوادث", "status": "الحالة", "count": "العدد" },
        "empty": {
          "title": "ما كاين حادث",
          "description": "شوف لائحة الحوادث.",
          "cta": "شوف الحوادث"
        }
      },
      "deals_open": {
        "title": "الصفقات الجارية",
        "subtitle": "{count} صفقة مفتوحة",
        "total_value": "القيمة الاجمالية",
        "view_all": "شوف كاع الصفقات",
        "empty": {
          "title": "ما كاين صفقة",
          "description": "صاوب صفقة باش تبدا.",
          "cta": "صاوب صفقة"
        }
      },
      "activity": {
        "title": "النشاط الاخير",
        "subtitle": "10 تفاعلات اخيرة",
        "view_all": "شوف الزبناء",
        "type": {
          "call": "مكالمة",
          "email": "بريد",
          "whatsapp": "واتساب",
          "meeting": "موعد",
          "note": "ملاحظة"
        },
        "empty": {
          "title": "ما كاين نشاط",
          "description": "بدا تواصل مع الزبناء.",
          "cta": "شوف الزبناء"
        }
      }
    }
  }
}
```

### 6.24 `repo/apps/web-broker/messages/ar.json` (delta dashboard namespace arabe classique formel)

```json
{
  "dashboard": {
    "title": "لوحة القيادة",
    "subtitle": "نظرة شاملة على نشاطكم في الوساطة",
    "seo": { "description": "لوحة قيادة Skalean Broker -- تجميع الإيرادات والصفقات والعقود والمطالبات" },
    "filters": {
      "preset": {
        "last_7d": "آخر ٧ أيام",
        "last_30d": "آخر ٣٠ يوماً",
        "ytd": "السنة الجارية",
        "last_year": "السنة الفارطة",
        "custom": "مخصص"
      },
      "date_start": { "placeholder": "تاريخ البداية" },
      "date_end": { "placeholder": "تاريخ النهاية" },
      "group_by": {
        "label": "تجميع حسب",
        "day": "يوم",
        "week": "أسبوع",
        "month": "شهر"
      },
      "branches": {
        "label": "الفروع",
        "placeholder": "الكل",
        "auto": "السيارات",
        "sante": "الصحة",
        "habitation": "السكن",
        "vie": "الحياة",
        "rc_pro": "المسؤولية المدنية المهنية",
        "rc_entreprise": "المسؤولية المدنية للمقاولة"
      },
      "reset": "إعادة تعيين"
    },
    "refresh": {
      "button": "تحديث",
      "success": "تم تحديث المعطيات",
      "auto_label": "تحديث آلي (٥ دقائق)",
      "manual": "تحديث الآن"
    },
    "export": {
      "label": "تصدير",
      "pdf": "تصدير PDF",
      "csv": "تصدير CSV",
      "not_available_pdf": "تصدير PDF متاح في Sprint 32",
      "not_available_csv": "تصدير CSV متاح في Sprint 32"
    },
    "error": {
      "title": "تعذر التحميل",
      "description": "وقع خطأ أثناء تحميل لوحة القيادة. أعد المحاولة أو اتصل بالدعم.",
      "retry": "إعادة المحاولة",
      "widget_title": "تعذر تحميل هذا العنصر",
      "widget_description": "تحقق من الاتصال أو أعد المحاولة."
    },
    "widgets": {
      "revenue": {
        "title": "الإيرادات منذ بداية السنة",
        "subtitle": "تطور الأقساط الشهرية",
        "total": { "label": "المجموع منذ فاتح يناير", "aria": "مجموع الإيرادات منذ بداية السنة" },
        "yoy": { "aria": "تغير سنوي بنسبة {percent}" },
        "tooltip": { "revenue": "الإيرادات" },
        "table": { "caption": "بيانات الإيرادات الشهرية", "period": "الفترة", "revenue": "الإيرادات", "policies": "العقود" },
        "empty": {
          "title": "لا توجد إيرادات لهذه الفترة",
          "description": "أنشئ عقداً أولاً لتتبع إيراداتك.",
          "cta": "إنشاء عقد"
        }
      },
      "funnel": {
        "title": "تحويل الصفقات",
        "subtitle": "النسبة الإجمالية من محتمل إلى مكسوب : {rate}",
        "empty": {
          "title": "لا توجد صفقات قيد المعالجة",
          "description": "أنشئ صفقتك الأولى لمشاهدة قمع التحويل.",
          "cta": "إنشاء صفقة"
        }
      },
      "polices": {
        "title": "العقود السارية",
        "subtitle": "{count} عقداً سارياً حسب الفرع",
        "total": { "label": "عقود سارية" },
        "table": { "caption": "توزيع العقود حسب الفرع", "branche": "الفرع", "count": "العدد", "premium": "إجمالي الأقساط" },
        "empty": {
          "title": "لا يوجد عقد ساري",
          "description": "أنشئ عقدك الأول لمتابعة المحفظة.",
          "cta": "إنشاء عقد"
        }
      },
      "sinistres": {
        "title": "المطالبات الجارية",
        "subtitle": "{count} مطالبة للمتابعة",
        "status": {
          "declared": "مصرح بها",
          "in_review": "قيد المراجعة",
          "expert": "تقييم خبير",
          "settled": "مسواة",
          "closed": "مغلقة"
        },
        "tooltip": { "count": "العدد" },
        "table": { "caption": "توزيع المطالبات حسب الحالة", "status": "الحالة", "count": "العدد" },
        "empty": {
          "title": "لا توجد مطالبة جارية",
          "description": "اطلع على قائمة المطالبات الكاملة.",
          "cta": "عرض المطالبات"
        }
      },
      "deals_open": {
        "title": "الصفقات المفتوحة",
        "subtitle": "{count} صفقة مفتوحة",
        "total_value": "القيمة الإجمالية",
        "view_all": "عرض جميع الصفقات",
        "empty": {
          "title": "لا توجد صفقة مفتوحة",
          "description": "أنشئ صفقتك الأولى لبدء التنقيب.",
          "cta": "إنشاء صفقة"
        }
      },
      "activity": {
        "title": "النشاط الأخير",
        "subtitle": "آخر ١٠ تفاعلات مع العملاء",
        "view_all": "عرض جميع جهات الاتصال",
        "type": {
          "call": "مكالمة",
          "email": "بريد إلكتروني",
          "whatsapp": "واتساب",
          "meeting": "اجتماع",
          "note": "ملاحظة"
        },
        "empty": {
          "title": "لا يوجد نشاط حديث",
          "description": "ابدأ محادثة مع جهات الاتصال.",
          "cta": "عرض جهات الاتصال"
        }
      }
    }
  }
}
```

---

## 7. Tests complets (15-30 ko)

### 7.1 Strategie tests

Trois niveaux de tests pour la tache 4.3.4 :

1. **Vitest unit tests** sur les widgets et formatters (12+ tests) avec rendering library `@testing-library/react`, mock TanStack Query via `QueryClient` neuf par test, mock API responses via fixtures.
2. **Playwright E2E tests** sur le dashboard complet (8+ tests) interagissant avec UI reelle (port 3001 dev), mock backend via msw ou route fixtures Playwright.
3. **A11y tests** via `axe-core/playwright` integre dans les tests E2E pour valider WCAG 2.1 AA.

### 7.2 Fixtures TanStack Query test utils

Fichier `test/utils/query-test-wrapper.tsx` (~60 lignes) :

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

export function renderWithProviders(ui: ReactNode, locale: string = 'fr') {
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    ui: (
      <NextIntlClientProvider locale={locale} messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </NextIntlClientProvider>
    ),
  };
}
```

### 7.3 Fixtures mock data dashboard

Fichier `test/fixtures/dashboard-fixtures.ts` (~180 lignes) :

```typescript
import type {
  RevenueYTDResponse,
  ConversionFunnelResponse,
  PolicesActivesResponse,
  SinistresCoursResponse,
  DealsOpenResponse,
  ActivityFeedResponse,
} from '@/lib/api/dashboard.api';

export const mockRevenueYTD: RevenueYTDResponse = {
  total_mad: 1_250_000,
  yoy_change_percent: 12.5,
  currency: 'MAD',
  group_by: 'month',
  points: [
    { period: '2026-01', revenue_mad: 95_000, policies_count: 38 },
    { period: '2026-02', revenue_mad: 110_000, policies_count: 42 },
    { period: '2026-03', revenue_mad: 125_000, policies_count: 47 },
    { period: '2026-04', revenue_mad: 130_000, policies_count: 51 },
    { period: '2026-05', revenue_mad: 145_000, policies_count: 55 },
  ],
};

export const mockRevenueYTDEmpty: RevenueYTDResponse = {
  total_mad: 0,
  yoy_change_percent: 0,
  currency: 'MAD',
  group_by: 'month',
  points: [],
};

export const mockConversionFunnel: ConversionFunnelResponse = {
  overall_conversion_percent: 18.5,
  stages: [
    { stage: 'lead', count: 250, total_value_mad: 5_000_000 },
    { stage: 'qualified', count: 180, total_value_mad: 3_600_000 },
    { stage: 'proposal', count: 120, total_value_mad: 2_400_000 },
    { stage: 'negotiation', count: 75, total_value_mad: 1_500_000 },
    { stage: 'won', count: 46, total_value_mad: 920_000 },
  ],
};

export const mockPolicesActives: PolicesActivesResponse = {
  total_count: 487,
  breakdown: [
    { branche: 'auto', count: 198, total_premium_mad: 850_000 },
    { branche: 'sante', count: 142, total_premium_mad: 620_000 },
    { branche: 'habitation', count: 87, total_premium_mad: 290_000 },
    { branche: 'vie', count: 35, total_premium_mad: 480_000 },
    { branche: 'rc_pro', count: 18, total_premium_mad: 165_000 },
    { branche: 'rc_entreprise', count: 7, total_premium_mad: 220_000 },
  ],
};

export const mockSinistresCours: SinistresCoursResponse = {
  total_count: 38,
  breakdown: [
    { status: 'declared', count: 12 },
    { status: 'in_review', count: 8 },
    { status: 'expert', count: 6 },
    { status: 'settled', count: 7 },
    { status: 'closed', count: 5 },
  ],
};

export const mockDealsOpen: DealsOpenResponse = {
  total_count: 12,
  total_value_mad: 245_000,
  top_5: [
    {
      id: '11111111-1111-4111-a111-111111111111',
      title: 'Police Auto -- Driss Bennani',
      amount_mad: 35_000,
      contact_name: 'Driss Bennani',
      expected_close_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      stage: 'negotiation',
      owner_name: 'Mehdi Alaoui',
    },
    {
      id: '22222222-2222-4222-a222-222222222222',
      title: 'RC Pro -- Atlas Conseil SARL',
      amount_mad: 55_000,
      contact_name: 'Atlas Conseil',
      expected_close_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      stage: 'proposal',
      owner_name: 'Sara Idrissi',
    },
    {
      id: '33333333-3333-4333-a333-333333333333',
      title: 'Sante Famille -- Hassan',
      amount_mad: 18_000,
      contact_name: 'Hassan Cherradi',
      expected_close_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      stage: 'qualified',
      owner_name: 'Mehdi Alaoui',
    },
    {
      id: '44444444-4444-4444-a444-444444444444',
      title: 'Habitation Villa Anfa',
      amount_mad: 42_000,
      contact_name: 'Younes Bel Hadj',
      expected_close_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      stage: 'proposal',
      owner_name: 'Sara Idrissi',
    },
    {
      id: '55555555-5555-4555-a555-555555555555',
      title: 'Vie Capital -- Khadija',
      amount_mad: 95_000,
      contact_name: 'Khadija Tazi',
      expected_close_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      stage: 'negotiation',
      owner_name: 'Mehdi Alaoui',
    },
  ],
};

export const mockActivityFeed: ActivityFeedResponse = {
  items: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      type: 'call',
      title: 'Appel sortant -- relance proposition',
      description: 'Discussion sur les garanties optionnelles',
      contact_id: '11111111-1111-4111-a111-111111111111',
      contact_name: 'Driss Bennani',
      occurred_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      owner_name: 'Mehdi Alaoui',
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      type: 'email',
      title: 'Devis envoye',
      contact_id: '22222222-2222-4222-a222-222222222222',
      contact_name: 'Atlas Conseil',
      occurred_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      owner_name: 'Sara Idrissi',
    },
    {
      id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
      type: 'whatsapp',
      title: 'WhatsApp -- confirmation rendez-vous',
      contact_id: '33333333-3333-4333-a333-333333333333',
      contact_name: 'Hassan Cherradi',
      occurred_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      owner_name: 'Mehdi Alaoui',
    },
  ],
};
```

### 7.4 Test : `revenue-ytd-widget.spec.tsx` (3 tests)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '../utils/query-test-wrapper';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

import { RevenueYTDWidget } from '@/components/dashboard/widgets/revenue-ytd-widget';
import * as dashboardApi from '@/lib/api/dashboard.api';
import { mockRevenueYTD, mockRevenueYTDEmpty } from '../fixtures/dashboard-fixtures';

vi.mock('@/hooks/use-dashboard-filters', () => ({
  useDashboardFilters: () => ({
    preset: 'last_30d',
    date_start: '2026-04-15T00:00:00Z',
    date_end: '2026-05-15T23:59:59Z',
    group_by: 'month',
    branches: [],
  }),
}));

describe('RevenueYTDWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders total revenue + YoY badge + LineChart points', async () => {
    vi.spyOn(dashboardApi, 'fetchRevenueYTD').mockResolvedValue(mockRevenueYTD);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <RevenueYTDWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Revenu YTD/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/1\s?250\s?000/)).toBeInTheDocument();
    expect(screen.getByText(/12,5\s?%/)).toBeInTheDocument();
  });

  it('renders empty state when no points', async () => {
    vi.spyOn(dashboardApi, 'fetchRevenueYTD').mockResolvedValue(mockRevenueYTDEmpty);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <RevenueYTDWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucun revenu pour cette periode/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Creer une police/i })).toBeInTheDocument();
  });

  it('renders error state with retry button when fetch fails', async () => {
    vi.spyOn(dashboardApi, 'fetchRevenueYTD').mockRejectedValue(new Error('Network error'));

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <RevenueYTDWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Reessayer/i })).toBeInTheDocument();
  });
});
```

### 7.5 Test : `conversion-funnel-widget.spec.tsx` (2 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

import { ConversionFunnelWidget } from '@/components/dashboard/widgets/conversion-funnel-widget';
import { createTestQueryClient } from '../utils/query-test-wrapper';
import * as dashboardApi from '@/lib/api/dashboard.api';
import { mockConversionFunnel } from '../fixtures/dashboard-fixtures';

vi.mock('@/hooks/use-dashboard-filters', () => ({
  useDashboardFilters: () => ({
    preset: 'last_30d',
    date_start: '2026-04-15T00:00:00Z',
    date_end: '2026-05-15T23:59:59Z',
    group_by: 'month',
    branches: [],
  }),
}));

describe('ConversionFunnelWidget', () => {
  it('renders 5 funnel stages with counts and conversion rates', async () => {
    vi.spyOn(dashboardApi, 'fetchConversionFunnel').mockResolvedValue(mockConversionFunnel);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <ConversionFunnelWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Conversion deals/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Prospect: 250/i)).toBeInTheDocument();
    expect(screen.getByText(/Qualifie: 180/i)).toBeInTheDocument();
    expect(screen.getByText(/Gagne: 46/i)).toBeInTheDocument();
  });

  it('renders empty state when all stages are 0', async () => {
    vi.spyOn(dashboardApi, 'fetchConversionFunnel').mockResolvedValue({
      overall_conversion_percent: 0,
      stages: [
        { stage: 'lead', count: 0, total_value_mad: 0 },
        { stage: 'qualified', count: 0, total_value_mad: 0 },
        { stage: 'proposal', count: 0, total_value_mad: 0 },
        { stage: 'negotiation', count: 0, total_value_mad: 0 },
        { stage: 'won', count: 0, total_value_mad: 0 },
      ],
    });

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <ConversionFunnelWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucun deal en pipeline/i)).toBeInTheDocument();
    });
  });
});
```

### 7.6 Test : `polices-actives-widget.spec.tsx` (2 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

import { PolicesActivesWidget } from '@/components/dashboard/widgets/polices-actives-widget';
import { createTestQueryClient } from '../utils/query-test-wrapper';
import * as dashboardApi from '@/lib/api/dashboard.api';
import { mockPolicesActives } from '../fixtures/dashboard-fixtures';

vi.mock('@/hooks/use-dashboard-filters', () => ({
  useDashboardFilters: () => ({
    preset: 'last_30d',
    date_start: '2026-04-15T00:00:00Z',
    date_end: '2026-05-15T23:59:59Z',
    group_by: 'month',
    branches: [],
  }),
}));

describe('PolicesActivesWidget', () => {
  it('renders pie chart with 6 branches and total count', async () => {
    vi.spyOn(dashboardApi, 'fetchPolicesActives').mockResolvedValue(mockPolicesActives);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <PolicesActivesWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Polices actives/i)).toBeInTheDocument();
    });
    expect(screen.getByText('487')).toBeInTheDocument();
    expect(screen.getByText(/Auto: 198/i)).toBeInTheDocument();
    expect(screen.getByText(/Vie: 35/i)).toBeInTheDocument();
  });

  it('toggles branche visibility when clicking legend button', async () => {
    vi.spyOn(dashboardApi, 'fetchPolicesActives').mockResolvedValue(mockPolicesActives);
    const user = userEvent.setup();

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <PolicesActivesWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Auto: 198/i)).toBeInTheDocument();
    });

    const autoButton = screen.getByRole('button', { name: /Auto: 198/i });
    await user.click(autoButton);
    expect(autoButton).toHaveAttribute('aria-pressed', 'true');
  });
});
```

### 7.7 Test : `sinistres-cours-widget.spec.tsx` (2 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

import { SinistresCoursWidget } from '@/components/dashboard/widgets/sinistres-cours-widget';
import { createTestQueryClient } from '../utils/query-test-wrapper';
import * as dashboardApi from '@/lib/api/dashboard.api';
import { mockSinistresCours } from '../fixtures/dashboard-fixtures';

vi.mock('@/hooks/use-dashboard-filters', () => ({
  useDashboardFilters: () => ({
    preset: 'last_30d',
    date_start: '2026-04-15T00:00:00Z',
    date_end: '2026-05-15T23:59:59Z',
    group_by: 'month',
    branches: [],
  }),
}));

describe('SinistresCoursWidget', () => {
  it('renders bar chart with 5 status bars + total', async () => {
    vi.spyOn(dashboardApi, 'fetchSinistresCours').mockResolvedValue(mockSinistresCours);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <SinistresCoursWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Sinistres en cours/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/38 sinistres a suivre/i)).toBeInTheDocument();
  });

  it('renders empty state when total_count is 0', async () => {
    vi.spyOn(dashboardApi, 'fetchSinistresCours').mockResolvedValue({
      total_count: 0,
      breakdown: [],
    });

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <SinistresCoursWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucun sinistre en cours/i)).toBeInTheDocument();
    });
  });
});
```

### 7.8 Test : `deals-open-widget.spec.tsx` (1 test)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

import { DealsOpenWidget } from '@/components/dashboard/widgets/deals-open-widget';
import { createTestQueryClient } from '../utils/query-test-wrapper';
import * as dashboardApi from '@/lib/api/dashboard.api';
import { mockDealsOpen } from '../fixtures/dashboard-fixtures';

describe('DealsOpenWidget', () => {
  it('renders top 5 deals + total value + count', async () => {
    vi.spyOn(dashboardApi, 'fetchDealsOpen').mockResolvedValue(mockDealsOpen);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <DealsOpenWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Deals en cours/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/12 deals ouverts/i)).toBeInTheDocument();
    expect(screen.getByText(/245\s?000/)).toBeInTheDocument();
    expect(screen.getByText(/Driss Bennani/)).toBeInTheDocument();
    expect(screen.getByText(/Khadija Tazi/)).toBeInTheDocument();
  });
});
```

### 7.9 Test : `activity-feed-widget.spec.tsx` (2 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';

import { ActivityFeedWidget } from '@/components/dashboard/widgets/activity-feed-widget';
import { createTestQueryClient } from '../utils/query-test-wrapper';
import * as dashboardApi from '@/lib/api/dashboard.api';
import { mockActivityFeed } from '../fixtures/dashboard-fixtures';

describe('ActivityFeedWidget', () => {
  it('renders list of recent activities with icons + relative time', async () => {
    vi.spyOn(dashboardApi, 'fetchActivityFeed').mockResolvedValue(mockActivityFeed);

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <ActivityFeedWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Activite recente/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Appel sortant -- relance proposition/i)).toBeInTheDocument();
    expect(screen.getByText(/Devis envoye/i)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp -- confirmation rendez-vous/i)).toBeInTheDocument();
  });

  it('renders empty state when items array is empty', async () => {
    vi.spyOn(dashboardApi, 'fetchActivityFeed').mockResolvedValue({ items: [] });

    const queryClient = createTestQueryClient();
    render(
      <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
        <QueryClientProvider client={queryClient}>
          <ActivityFeedWidget />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucune activite recente/i)).toBeInTheDocument();
    });
  });
});
```

### 7.10 Test : `dashboard-filters.spec.tsx` (3 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messagesFr from '@/messages/fr.json';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { getDefaultDashboardFilters } from '@/lib/queries/dashboard.queries';

const renderWithProviders = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="fr" messages={messagesFr} timeZone="Africa/Casablanca">
      <NuqsAdapter>{ui}</NuqsAdapter>
    </NextIntlClientProvider>,
  );

describe('DashboardFilters', () => {
  it('renders 5 preset buttons + group_by + branches select', () => {
    renderWithProviders(<DashboardFilters initialFilters={getDefaultDashboardFilters()} />);

    expect(screen.getByRole('button', { name: /7 derniers jours/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /30 derniers jours/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annee en cours/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annee derniere/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Personnalise/i })).toBeInTheDocument();
  });

  it('updates URL preset when clicking a preset button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardFilters initialFilters={getDefaultDashboardFilters()} />);

    const ytdButton = screen.getByRole('button', { name: /Annee en cours/i });
    await user.click(ytdButton);
    await waitFor(() => {
      expect(ytdButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('resets filters when reset button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DashboardFilters initialFilters={getDefaultDashboardFilters()} />);

    const resetBtn = screen.getByRole('button', { name: /Reinitialiser filtres/i });
    await user.click(resetBtn);

    const last30dBtn = screen.getByRole('button', { name: /30 derniers jours/i });
    expect(last30dBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
```

### 7.11 Test : `dashboard-formatters.spec.ts` (5 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatRevenueMAD,
  formatRevenueMADCompact,
  formatPercent,
  formatRelativeTime,
  formatBranche,
  formatDealStage,
} from '@/lib/formatters/dashboard-formatters';

describe('dashboard-formatters', () => {
  it('formatRevenueMAD formats numbers in fr-MA with 0 decimals', () => {
    expect(formatRevenueMAD(12500, 'fr')).toMatch(/12\s?500/);
    expect(formatRevenueMAD(12500, 'fr')).toMatch(/MAD/);
  });

  it('formatRevenueMADCompact uses compact notation', () => {
    const formatted = formatRevenueMADCompact(1_250_000, 'fr');
    expect(formatted).toMatch(/M|million/i);
  });

  it('formatPercent shows sign on positive values when withSign=true', () => {
    expect(formatPercent(12.5, 'fr', true)).toMatch(/\+/);
    expect(formatPercent(12.5, 'fr', false)).not.toMatch(/\+/);
  });

  it('formatRelativeTime returns localized string', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(oneHourAgo, 'fr');
    expect(result).toMatch(/heure|il y a/i);
  });

  it('formatBranche returns FR label by default and AR label for ar locale', () => {
    expect(formatBranche('auto', 'fr')).toBe('Auto');
    expect(formatBranche('auto', 'ar')).toBe('السيارات');
  });
});
```

### 7.12 Tests E2E Playwright `e2e/web/dashboard.spec.ts` (8 tests)

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

test.beforeEach(async ({ page, context }) => {
  // Stub auth cookies (Sprint 5 livre le mecanisme reel)
  await context.addCookies([
    { name: 'access_token', value: 'mock-jwt-token', domain: 'localhost', path: '/' },
    { name: 'current_tenant_id', value: '00000000-0000-4000-a000-000000000000', domain: 'localhost', path: '/' },
  ]);

  // Mock API endpoints via Playwright route fixtures
  await page.route('**/api/v1/analytics/dashboards/broker/revenue*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_mad: 1_250_000,
        yoy_change_percent: 12.5,
        currency: 'MAD',
        group_by: 'month',
        points: [
          { period: '2026-01', revenue_mad: 95000, policies_count: 38 },
          { period: '2026-05', revenue_mad: 145000, policies_count: 55 },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/crm/dashboards/conversion-funnel*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        overall_conversion_percent: 18.5,
        stages: [
          { stage: 'lead', count: 250, total_value_mad: 5000000 },
          { stage: 'qualified', count: 180, total_value_mad: 3600000 },
          { stage: 'proposal', count: 120, total_value_mad: 2400000 },
          { stage: 'negotiation', count: 75, total_value_mad: 1500000 },
          { stage: 'won', count: 46, total_value_mad: 920000 },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/insure/dashboards/policies-active*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        total_count: 487,
        breakdown: [
          { branche: 'auto', count: 198, total_premium_mad: 850000 },
          { branche: 'sante', count: 142, total_premium_mad: 620000 },
          { branche: 'habitation', count: 87, total_premium_mad: 290000 },
          { branche: 'vie', count: 35, total_premium_mad: 480000 },
          { branche: 'rc_pro', count: 18, total_premium_mad: 165000 },
          { branche: 'rc_entreprise', count: 7, total_premium_mad: 220000 },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/repair/dashboards/sinistres-status*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        total_count: 38,
        breakdown: [
          { status: 'declared', count: 12 },
          { status: 'in_review', count: 8 },
          { status: 'expert', count: 6 },
          { status: 'settled', count: 7 },
          { status: 'closed', count: 5 },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/crm/deals/open*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        total_count: 12,
        total_value_mad: 245000,
        top_5: [
          {
            id: '11111111-1111-4111-a111-111111111111',
            title: 'Police Auto Driss',
            amount_mad: 35000,
            contact_name: 'Driss Bennani',
            expected_close_date: new Date(Date.now() + 3 * 86400000).toISOString(),
            stage: 'negotiation',
            owner_name: 'Mehdi',
          },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/crm/activities/feed*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        items: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
            type: 'call',
            title: 'Appel sortant',
            contact_id: '11111111-1111-4111-a111-111111111111',
            contact_name: 'Driss Bennani',
            occurred_at: new Date(Date.now() - 30 * 60000).toISOString(),
            owner_name: 'Mehdi',
          },
        ],
      }),
    }),
  );
});

test('dashboard loads and displays 6 widgets', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  await expect(page.getByRole('heading', { name: /Tableau de bord/i, level: 1 })).toBeVisible();
  await expect(page.getByText(/Revenu YTD/i)).toBeVisible();
  await expect(page.getByText(/Conversion deals/i)).toBeVisible();
  await expect(page.getByText(/Polices actives/i)).toBeVisible();
  await expect(page.getByText(/Sinistres en cours/i)).toBeVisible();
  await expect(page.getByText(/Deals en cours/i)).toBeVisible();
  await expect(page.getByText(/Activite recente/i)).toBeVisible();
});

test('clicking preset button updates URL', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  await page.getByRole('button', { name: /Annee en cours/i }).click();
  await expect(page).toHaveURL(/preset=ytd/);
});

test('refresh button triggers refetch', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  await page.getByRole('button', { name: /Actualiser/i }).first().click();
  await expect(page.getByText(/Donnees actualisees/i)).toBeVisible();
});

test('auto-refresh toggle persists in localStorage', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  const toggle = page.getByRole('switch', { name: /Actualisation auto/i });
  await toggle.click();
  const stored = await page.evaluate(() => localStorage.getItem('dashboard_auto_refresh'));
  expect(stored).toBe('true');
});

test('export PDF button shows not-available toast', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  await page.getByRole('button', { name: /Exporter/i }).click();
  await page.getByRole('menuitem', { name: /Export PDF/i }).click();
  await expect(page.getByText(/disponible Sprint 32/i)).toBeVisible();
});

test('locale switch ar applies RTL direction', async ({ page }) => {
  await page.goto(`${BASE_URL}/ar/dashboard`);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('lang', /ar/);
});

test('dashboard has no axe-core violations (WCAG 2.1 AA)', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('keyboard navigation traverses widget interactive elements', async ({ page }) => {
  await page.goto(`${BASE_URL}/fr/dashboard`);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toMatch(/BUTTON|A|INPUT/);
});
```

### 7.13 Stub `nuqs` mock pour Vitest

Fichier `test/setup.ts` ajout :

```typescript
import { vi } from 'vitest';

vi.mock('nuqs', async () => {
  const actual = await vi.importActual<typeof import('nuqs')>('nuqs');
  return {
    ...actual,
    useQueryStates: () => [
      { preset: 'last_30d', date_start: null, date_end: null, group_by: 'month', branches: [] },
      vi.fn(),
    ],
  };
});
```

---

## 8. Variables d'environnement (1-3 ko)

Ajouts dans `repo/apps/web-broker/.env.example` (deja initie task-1.4.1) :

```bash
# ---- DASHBOARD CONFIG (Tache 4.3.4) ----

# Polling interval for auto-refresh feature in milliseconds.
# Default 5 minutes. Production override possible via runtime env.
NEXT_PUBLIC_DASHBOARD_POLL_MS=300000

# Stale time TanStack Query for dashboard queries (milliseconds)
NEXT_PUBLIC_DASHBOARD_STALE_MS=300000

# Activity feed max items (display limit)
NEXT_PUBLIC_DASHBOARD_ACTIVITY_LIMIT=10

# Deals open top N to show
NEXT_PUBLIC_DASHBOARD_DEALS_TOP=5

# Enable/disable dashboard export buttons stub
NEXT_PUBLIC_DASHBOARD_EXPORT_ENABLED=true

# Backend API endpoints base path (relative to NEXT_PUBLIC_API_URL)
# All dashboard endpoints share /api/v1 prefix
NEXT_PUBLIC_API_BASE_PATH=/api/v1

# Feature flag : show "Phase 7" hint badges on export
NEXT_PUBLIC_FEATURE_FLAGS_DASHBOARD_AI=false
```

Documentation `.env` :

- `NEXT_PUBLIC_DASHBOARD_POLL_MS` : permet aux ops d'ajuster l'intervalle de poll en production sans rebuild (utile en cas de surcharge backend). Defaut 5min.
- `NEXT_PUBLIC_DASHBOARD_STALE_MS` : stale time TanStack Query -- au-dela de cette duree, la query est consideree obsolete et refetchee au prochain mount/focus (focus refetch est OFF par defaut sur ce dashboard).
- `NEXT_PUBLIC_DASHBOARD_ACTIVITY_LIMIT` : limite affichage widget activity feed. Augmenter pour ecrans XL.
- `NEXT_PUBLIC_DASHBOARD_EXPORT_ENABLED` : permet de masquer les boutons export tant que Sprint 32 n'est pas livre (eviter confusion utilisateur).
- `NEXT_PUBLIC_FEATURE_FLAGS_DASHBOARD_AI` : preparation Sprint 32+ pour l'integration des AI insights widgets (Phase 7 frontier IA).

Aucune variable secrete (decision-006 : tout `NEXT_PUBLIC_*` est client-safe par definition).

---

## 9. Commandes shell (1-2 ko)

### 9.1 Dev local

```bash
# Demarrer l'API backend (port 4000)
cd repo/apps/api
pnpm dev

# Demarrer web-broker (port 3001)
cd repo/apps/web-broker
pnpm dev
# Navigate : http://localhost:3001/fr/dashboard

# Verifier le typecheck
pnpm --filter @insurtech/web-broker typecheck

# Verifier lint
pnpm --filter @insurtech/web-broker lint
```

### 9.2 Tests

```bash
# Tests Vitest unit + watch
pnpm --filter @insurtech/web-broker test
pnpm --filter @insurtech/web-broker test:watch

# Coverage report
pnpm --filter @insurtech/web-broker test -- --coverage

# Tests Playwright E2E (dashboard only)
pnpm --filter @insurtech/web-broker test:e2e -- dashboard.spec.ts

# Tests headed mode (debug)
pnpm --filter @insurtech/web-broker test:e2e:headed -- dashboard.spec.ts

# Lighthouse local
pnpm --filter @insurtech/web-broker lh
```

### 9.3 Build prod

```bash
# Build production
pnpm --filter @insurtech/web-broker build

# Start production
pnpm --filter @insurtech/web-broker start
# Navigate : http://localhost:3001/fr/dashboard
```

### 9.4 Verification post-implementation

```bash
# Verifier aucune emoji
grep -rn "emoji-regex" repo/apps/web-broker/components/dashboard/ ; echo "OK if no match"
bash scripts/check-no-emoji.sh repo/apps/web-broker/components/dashboard/

# Verifier aucun console.log
grep -rn "console.log" repo/apps/web-broker/components/dashboard/ ; echo "OK if no match"

# Verifier que tous les widgets ont un test
ls repo/apps/web-broker/test/dashboard/

# Verifier i18n keys parity entre 3 locales
pnpm tsx scripts/validate-i18n-keys.ts repo/apps/web-broker/messages
```

### 9.5 Reset si bloque

```bash
# Reset cache TanStack Query (dev)
# (dans devtools console) queryClient.clear()

# Reset URL filters
# Navigate : http://localhost:3001/fr/dashboard (sans query string)

# Reset localStorage
# (dans devtools console) localStorage.clear()

# Reset .next build cache
pnpm --filter @insurtech/web-broker clean
```

---

## 10. Criteres validation V1-V25 (5-10 ko, 25 criteres)

### V1-V15 : Priorite P0 (bloquants)

- [ ] **V1 (P0)** : Server Component `dashboard/page.tsx` execute les 6 prefetch queries en parallele via `Promise.all` (verifie via Sentry trace OR custom timing log : duree totale < temps individuel max).

- [ ] **V2 (P0)** : Les 6 widgets rendent les data fetched sans loading state apparent au premier render (HydrationBoundary fonctionne -- pas de skeleton flash).

- [ ] **V3 (P0)** : Widget Revenue YTD affiche `total_mad` formate `Intl.NumberFormat('fr-MA', { currency: 'MAD', maximumFractionDigits: 0 })`, YoY badge avec icone TrendingUp/TrendingDown, LineChart Recharts avec X-axis mois et Y-axis MAD compact.

- [ ] **V4 (P0)** : Widget Conversion Funnel affiche FunnelChart Recharts avec 5 stages (lead, qualified, proposal, negotiation, won), labels custom `<LabelList>` avec count + nom stage, conversion rates calcules entre stages.

- [ ] **V5 (P0)** : Widget Polices Actives affiche PieChart Recharts avec breakdown 6 branches + total au centre du donut + legend cliquable (toggle visibility per branche via state local).

- [ ] **V6 (P0)** : Widget Sinistres Cours affiche BarChart Recharts avec 5 status bars (couleurs locked Sofidemy palette) + total count en sous-titre.

- [ ] **V7 (P0)** : Widget Deals Open affiche liste 5 deals (titre + amount + close date relative + stage badge) + total value MAD + count.

- [ ] **V8 (P0)** : Widget Activity Feed affiche liste 10 dernieres interactions avec icone par type (Phone/Mail/MessageCircle/Video/StickyNote) + contact name + relative time + lien vers contact detail.

- [ ] **V9 (P0)** : Filtres globaux `<DashboardFilters>` rendent 5 preset buttons (last_7d / last_30d / ytd / last_year / custom) + group_by Select + branches MultiSelect.

- [ ] **V10 (P0)** : URL state nuqs : changer un filter met a jour `window.location.search` (e.g. `?preset=ytd&group_by=month&branches=auto,sante`).

- [ ] **V11 (P0)** : Refresh button manuel appelle `queryClient.invalidateQueries({ queryKey: ['dashboard'] })` puis toast success "Donnees actualisees".

- [ ] **V12 (P0)** : Auto-refresh toggle (5min poll) persiste localStorage `dashboard_auto_refresh` (verifie via re-load page : toggle reste ON).

- [ ] **V13 (P0)** : Loading skeletons shadcn/ui sont affiches pendant le fetch (visibles si throttle network slow 3G dans devtools).

- [ ] **V14 (P0)** : Empty states affiches si data vide (e.g. `polices.total_count === 0`) avec illustration + titre + description + CTA Link.

- [ ] **V15 (P0)** : Error states affiches si fetch fail (e.g. 500 backend) avec icone AlertCircle + bouton "Reessayer" qui appelle `refetch()`.

### V16-V21 : Priorite P1 (importants)

- [ ] **V16 (P1)** : Tests Vitest passent : 12+ tests verts (3 revenue, 2 funnel, 2 polices, 2 sinistres, 1 deals, 2 activity + 3 filters + 5 formatters).

- [ ] **V17 (P1)** : Tests E2E Playwright passent : 8+ tests verts (load, filters, refresh, auto-refresh, export, locale RTL, a11y, keyboard).

- [ ] **V18 (P1)** : Lighthouse `/fr/dashboard` : Performance >= 70, Accessibility >= 90, Best Practices >= 90.

- [ ] **V19 (P1)** : `pnpm typecheck` 0 erreur TypeScript (toutes les Zod schemas validees, tous les hooks types).

- [ ] **V20 (P1)** : `pnpm lint` 0 warning ESLint (rules @insurtech/eslint-config respectees + 0 console.log + 0 unused imports).

- [ ] **V21 (P1)** : RTL CSS applique correctement en `/ar/dashboard` : layout mirror (sidebar a droite, padding-start/end logique, icons mirror appropriees).

### V22-V25 : Priorite P2 (nice to have)

- [ ] **V22 (P2)** : Three locales messages files (fr.json, ar-MA.json, ar.json) ont tous les `dashboard.*` keys (verifie via `scripts/validate-i18n-keys.ts`).

- [ ] **V23 (P2)** : Bundle JS dashboard route < 200 ko gzipped (verifie via `pnpm build` + `next-bundle-analyzer`).

- [ ] **V24 (P2)** : Composant `<RevenueYTDWidget>` span 2 colonnes desktop (xl:col-span-2) pour visibilite chart elargie.

- [ ] **V25 (P2)** : ScrollArea sur Activity Feed widget fonctionnelle (scroll vertical interne sans casser layout).

---

## 11. Edge cases + troubleshooting (3-5 ko, 10 cases)

### EC1 : Premier load tenant sans data initiale

**Symptome** : utilisateur cree un nouveau tenant Skalean Broker, navigate /dashboard, voit 6 widgets en empty state simultanement.

**Cause attendue** : aucun deal, police, sinistre, contact, activity n'a encore ete cree.

**Solution** : chaque widget empty state pointe vers le CTA approprie (creer police, creer deal, creer contact). L'utilisateur peut creer son premier element via un CTA + le widget se peuple au prochain refresh.

### EC2 : Fetch fails per widget (1 sur 6 down)

**Symptome** : 5 widgets rendent normal, 1 widget affiche error state.

**Cause** : un microservice backend particulier est down (e.g. /repair/dashboards/sinistres-status renvoie 503).

**Solution** : le pattern isole les errors per widget grace a Suspense boundaries individuelles + useQuery propre par widget. L'utilisateur peut quand meme utiliser les 5 widgets fonctionnels + cliquer "Reessayer" sur le widget defaillant.

### EC3 : date_range invalide (date_end < date_start)

**Symptome** : utilisateur selectionne manuellement preset=custom avec date_start=2026-05-15 et date_end=2026-04-01.

**Cause** : pas de validation cote UI.

**Solution** : ajouter validation Zod dans `resolveDateRangePreset` -> si date_end < date_start, swap automatiquement + toast warning "Dates corrigees". Alternative : disabled date picker date_end si < date_start.

### EC4 : Polices vide -> PieChart NaN

**Symptome** : si tous les `data.breakdown.count === 0`, PieChart affiche `NaN%` dans tooltips.

**Cause** : Recharts ne gere pas data array all-zeros.

**Solution** : `data.breakdown.filter(b => b.count > 0)` avant passage a `<Pie data=...>`. Si filter retourne array vide, render empty state.

### EC5 : Currency formatting MAD edge cases

**Symptome** : `Intl.NumberFormat('fr-MA', { currency: 'MAD' })` renvoie `12 500,00 MAD` mais on veut `12 500 MAD`.

**Cause** : defaut 2 decimales.

**Solution** : `{ maximumFractionDigits: 0, minimumFractionDigits: 0 }`. Pour le widget Revenue YTD qui peut avoir grandes valeurs, utiliser `{ notation: 'compact', maximumFractionDigits: 1 }` (e.g. "1,2 M MAD").

### EC6 : Recharts ResponsiveContainer width=0 au premier render

**Symptome** : charts invisibles ou compresses a 0px de largeur au premier render.

**Cause** : ResponsiveContainer mesure parent width via ResizeObserver mais parent pas encore layout.

**Solution** : enforcer `min-h-[256px]` + `w-full` sur le parent + utiliser `<div className="h-64 w-full">` au lieu de laisser ResponsiveContainer determiner seul.

### EC7 : ar RTL chart direction (axes flippes)

**Symptome** : en locale ar, chart Revenue YTD affiche X-axis avec janvier a droite et decembre a gauche (RTL natural read order).

**Cause** : pas de flip explicite -- Recharts default LTR.

**Solution** : option 1 - garder LTR pour les charts (les utilisateurs ar comprennent timeline LTR). Option 2 - props `reversed={dir === 'rtl'}` sur XAxis. Decision Sprint 16 : option 1 (LTR) -- les courtiers MA habitues a Excel LTR.

### EC8 : Large datasets > 1000 points

**Symptome** : group_by=day sur 3 ans -> 1095 points -> LineChart lag + scroll lent.

**Cause** : Recharts rendering perf degrade > 500 points.

**Solution** : limit backend `LIMIT 365` par defaut + downsampling LTTB cote ClickHouse Sprint 13 si > 500 points. Frontend : toast info "Donnees agreggees (LTTB downsample applique pour optimiser le rendu)".

### EC9 : Auto-refresh while user typing in custom date filter

**Symptome** : refetchInterval declenche pendant que l'utilisateur tape `?date_start=2026-` partiellement, le backend renvoie 400 invalid date.

**Cause** : URL state instable pendant typing.

**Solution** : nuqs `throttleMs: 500` deja configure -> URL change debounced 500ms post-typing -> aucun fetch declenche tant que user tape activement.

### EC10 : Locale switch mid-render -- chart labels stuck

**Symptome** : user switch fr -> ar via locale-switcher topbar, les labels Recharts X-axis restent en fr.

**Cause** : Recharts memoize labels au mount via refs internes.

**Solution** : ajouter `key={locale}` sur composant chart parent -> force unmount + remount du chart quand locale change -> labels re-render avec nouvelle locale.

---

## 12. Conformite Maroc detaillee (1-3 ko)

### 12.1 Timezone Africa/Casablanca

Tous les calculs dates filters dashboard utilisent `date-fns-tz` avec `Africa/Casablanca` :

```typescript
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
const TIMEZONE = 'Africa/Casablanca';

// Convert backend UTC date to Casablanca-zoned date for display
const localDate = utcToZonedTime(parseISO(apiResponse.occurred_at), TIMEZONE);

// Convert user-selected date to UTC for backend
const utcDateStart = zonedTimeToUtc(localDateStart, TIMEZONE).toISOString();
```

DST handling : Maroc n'a pas changement d'heure permanent (DST aboli 2018 -- UTC+1 toute l'annee mais avec exception Ramadan UTC+0). `date-fns-tz` gere automatiquement via IANA Africa/Casablanca tzdata.

### 12.2 Currency MAD via Intl.NumberFormat

Toutes les valeurs financieres widget formattees :

```typescript
new Intl.NumberFormat('fr-MA', {
  style: 'currency',
  currency: 'MAD',
  maximumFractionDigits: 0,
}).format(value);
// "12 500 MAD" en fr-MA
// "12 500 د.م." en ar-MA (Dirham marocain en arabe)
```

Backend renvoie toujours valeurs en MAD (decision-007 monetary). Pas de conversion devise cote frontend dans Sprint 16.

### 12.3 Loi 09-08 (CNDP) - donnees personnelles

Le dashboard agrege des KPI **uniquement** :
- Revenue YTD : agregation montants sans identification clients
- Conversion Funnel : counts par stage, pas de noms
- Polices Actives : counts par branche, pas de souscripteurs
- Sinistres Cours : counts par status, pas de victimes/assures
- Deals Open : affiche contact_name (PII minimal "Driss Bennani"), proteges par RBAC (broker_user voit ses deals only, broker_assistant ne voit rien sauf si shared)
- Activity Feed : affiche contact_name + libelle interaction, pas de phone/email/CIN

Aucun champ PII brut affiche (pas de phone, email, CIN, RIB, adresse complete). Si Sprint 7 RBAC determine que `broker_assistant` ne peut pas voir certains deals, ils sont filtres backend (pas just hide UI).

Audit trail Sprint 6 : chaque fetch dashboard genere un log audit `audit.event.dashboard.viewed` avec user_id + tenant_id + filters appliques (sans contenu) -> traceable en cas de demande utilisateur "qui a vu mes donnees ?".

### 12.4 WCAG 2.1 AA accessibilite

- **Color contrast** : palette Sofidemy (Orange #E95D2C sur background) atteint ratio 4.5:1 (verifie task-1.4.1 design tokens).
- **Charts alternative text** : chaque chart Recharts a un `<table>` sr-only adjacent listant les data points (screen readers lisent le tableau au lieu de scanner SVG).
- **Keyboard navigation** : tous les buttons + links accessible Tab/Shift+Tab + Enter/Space activation. Focus visible Sofidemy ring orange.
- **ARIA labels** : `aria-label`, `aria-pressed`, `aria-busy`, `role="alert"`, `role="region"`, `role="list"` applique systematiquement.
- **prefers-reduced-motion** : Recharts animations `isAnimationActive={!prefersReducedMotion}` (a ajouter via hook detect Sprint 13 a11y baseline).

### 12.5 RTL ar/ar-MA support

- `<html dir="rtl">` automatique via next-intl si locale=ar/ar-MA.
- Tailwind classes : `me-2 / ms-2` (margin-end/start) au lieu de `mr-2 / ml-2`.
- Icons direction : `<ArrowRight>` doit devenir `<ArrowLeft>` en RTL (Sprint 4 design tokens fournit `<DirAwareArrow>` helper).
- Charts LTR conservees (decision EC7).

---

## 13. Conventions absolues skalean-insurtech (3-5 ko, liste complete)

### 13.1 Decision-006 : AUCUNE EMOJI (absolue)

- Aucun emoji dans aucun fichier code TypeScript, TSX, JSON messages, README, commit, comment.
- Verification CI : `bash scripts/check-no-emoji.sh repo/apps/web-broker/`.
- Caracteres autorises : accents francais (e/e/c/a), caracteres arabes (Unicode ؀-ۿ), symboles math/financier (% / + / -), ponctuation standard.
- Icons Lucide : OK (SVG, pas emoji).

### 13.2 Decision-007 : monnaie MAD + timezone Africa/Casablanca

- Toute valeur monetaire : MAD (currency='MAD') via `Intl.NumberFormat('fr-MA', ...)`.
- Toute date affichee : convertie en Africa/Casablanca via `date-fns-tz`.
- Backend API renvoie UTC timestamps -- frontend convertit a l'affichage.

### 13.3 Decision-008 : cloud souverain MA Atlas Cloud Benguerir

- Aucun asset CDN exterieur (pas Cloudflare/AWS/Cloudinary).
- Tous les SVG illustrations widget servis depuis `@insurtech/shared-ui` (deja monorepo bundle).
- Si besoin remote image : `images.remotePatterns` autorise uniquement `s3.bgr.atlascloudservices.ma` + `cdn.skalean-insurtech.ma`.

### 13.4 Decision-009 : trois locales fr / ar-MA / ar

- Tous les texts UI tirages depuis `messages/{locale}.json` via `useTranslations` next-intl.
- Parity check CI : `scripts/validate-i18n-keys.ts` verifie que toutes les keys existent dans les 3 locales.
- Format dates : `format(date, 'PPP', { locale: ar })` pour locale-aware.
- Format currency : `Intl.NumberFormat(locale, ...)` (fr-MA / ar-MA / ar).

### 13.5 Decision-010 : Sprint 16 = first metier UI Skalean Broker

- Premier ecran que les courtiers MA voient -> qualite UX maximale.
- Aucun "placeholder lorem ipsum" dans le code livre.
- Performance >= 70 Lighthouse OK pour Sprint 16, cible 90 Sprint 32 (post-optim).

### 13.6 Decision-011 : Loi 09-08 (CNDP) PII

- KPI agreges uniquement sur dashboard -- pas de CIN/RIB/email/phone affichables.
- Si widget doit afficher PII minimal (e.g. contact_name dans deals open / activity feed), proteger via RBAC backend.
- Audit log toute consultation dashboard avec user_id + filters appliques.

### 13.7 Conventions code

**File naming** :
- Components : `kebab-case.tsx` (e.g. `revenue-ytd-widget.tsx`)
- Hooks : `use-*.ts` (e.g. `use-dashboard-filters.ts`)
- Utils : `*-utils.ts` ou nom descriptif (e.g. `dashboard-formatters.ts`)
- Tests : `*.spec.tsx` (Vitest) ou `*.spec.ts` (Playwright)

**Import ordering** :
1. React imports
2. Third-party libs (alphabetical)
3. `@insurtech/*` workspace imports
4. `@/*` local app imports
5. Relative imports `./*`
6. Type imports (`import type {}`) en dernier

**TypeScript strict** :
- No `any` (use `unknown` + type guards)
- No implicit any
- No unused vars/imports
- Strict null checks
- Exhaustive switch cases

**Naming conventions** :
- PascalCase : components, types, interfaces
- camelCase : variables, functions, hooks
- UPPER_SNAKE_CASE : constants exported
- Suffix Type : `DashboardFiltersType` pour distinguer du component `<DashboardFilters>`

**React conventions** :
- Server Components par defaut (sauf si necessaire 'use client')
- 'use client' minimal : seul le composant necessitant interactivite
- Hooks personnalises prefixe `use*`
- Props types explicit (`type Props = {...}`)
- Pas de defaultProps (utiliser destructuring defaults)

### 13.8 Test conventions

- Each widget has at least 1 render test + 1 empty state test
- Mocking API via `vi.spyOn(dashboardApi, 'fetchXXX').mockResolvedValue(mock)`
- TanStack Query test client avec `retry: false, gcTime: 0, staleTime: 0`
- Playwright E2E : mock API via `page.route('**/api/v1/*', ...)`
- A11y : `AxeBuilder().withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()` -> expect violations equal []

### 13.9 Git conventions

- Branche : `feat/sprint-16/4.3.4-dashboard-widgets`
- Commits atomiques : 1 commit = 1 livrable L*
- Message : voir section 15

### 13.10 Lighthouse + perf budget

- Performance >= 70 (Sprint 16 baseline) -> 90 (Sprint 32 cible)
- Accessibility >= 90
- Best Practices >= 90
- SEO >= 80 (dashboard prive donc SEO moins critique mais conserve hygiene)
- Bundle JS dashboard route < 200 ko gzipped

---

## 14. Validation pre-commit (1-2 ko)

### 14.1 Checklist auto-verifiee

Avant `git commit`, executer en sequence :

```bash
# 1. Typecheck strict
pnpm --filter @insurtech/web-broker typecheck
# Doit retourner 0 erreur

# 2. Lint strict
pnpm --filter @insurtech/web-broker lint
# Doit retourner 0 warning

# 3. Tests unit
pnpm --filter @insurtech/web-broker test
# 12+ tests doivent passer 100%

# 4. Tests E2E dashboard
pnpm --filter @insurtech/web-broker test:e2e -- dashboard.spec.ts
# 8+ tests doivent passer

# 5. Build prod
pnpm --filter @insurtech/web-broker build
# Aucun erreur, bundle dashboard route < 200 ko gzipped

# 6. Aucune emoji
bash scripts/check-no-emoji.sh repo/apps/web-broker/components/dashboard/
bash scripts/check-no-emoji.sh repo/apps/web-broker/lib/queries/dashboard.queries.ts
bash scripts/check-no-emoji.sh repo/apps/web-broker/lib/api/dashboard.api.ts
bash scripts/check-no-emoji.sh repo/apps/web-broker/messages/

# 7. Aucun console.log dans source (sauf tests)
! grep -rn "console.log" repo/apps/web-broker/components/dashboard/ repo/apps/web-broker/lib/ repo/apps/web-broker/hooks/

# 8. i18n keys parity
pnpm tsx scripts/validate-i18n-keys.ts repo/apps/web-broker/messages

# 9. Husky pre-commit hook fait tout en parallele
# .husky/pre-commit -> lint-staged + typecheck

# 10. Lighthouse local (manuel)
pnpm --filter @insurtech/web-broker dev &
sleep 5
pnpm --filter @insurtech/web-broker lh
# Verifier Perf >= 70, A11y >= 90
```

### 14.2 Husky + lint-staged config

`.husky/pre-commit` :
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint-staged
pnpm --filter @insurtech/web-broker typecheck
```

`package.json` root lint-staged :
```json
{
  "lint-staged": {
    "apps/web-broker/**/*.{ts,tsx}": ["eslint --fix --max-warnings 0", "prettier --write"],
    "apps/web-broker/**/*.json": ["prettier --write"],
    "apps/web-broker/messages/*.json": ["tsx scripts/validate-i18n-keys.ts"]
  }
}
```

### 14.3 CI workflow `.github/workflows/web-broker.yml`

```yaml
name: web-broker
on:
  pull_request:
    paths:
      - 'apps/web-broker/**'
      - 'packages/shared-ui/**'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22.11.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/web-broker lint
      - run: pnpm --filter @insurtech/web-broker typecheck
      - run: pnpm --filter @insurtech/web-broker test -- --coverage
      - run: pnpm --filter @insurtech/web-broker build
      - run: pnpm --filter @insurtech/web-broker test:e2e -- dashboard.spec.ts
      - run: bash scripts/check-no-emoji.sh apps/web-broker
```

---

## 15. Commit message complet (1-2 ko)

### 15.1 Conventional commit (recommande)

```text
feat(web-broker): dashboard page 6 widgets revenue conversion polices sinistres deals activity [4.3.4]

Implement /dashboard route in web-broker app (port 3001) with 6 KPI widgets
plus shared filters (date_range + group_by + branches) syncronized via URL
state nuqs. Server Component initial parallel fetch + HydrationBoundary
client + TanStack Query 5min staleTime + auto-refresh toggle persisted
localStorage.

Widgets :
  1. Revenue YTD : LineChart recharts (month axis) + total card + YoY badge
  2. Conversion Funnel : 5 stages (lead/qualified/proposal/negotiation/won)
     with custom LabelList conversion rates
  3. Polices Actives : PieChart 6 branches + total center + legend toggle
  4. Sinistres Cours : BarChart 5 statuses (declared/in_review/expert/settled/closed)
  5. Deals Open : Top 5 close dates + total MAD value + count
  6. Activity Feed : Last 10 interactions with icons + relative time

Files :
  - app/[locale]/(protected)/dashboard/page.tsx (Server Component)
  - app/[locale]/(protected)/dashboard/loading.tsx
  - app/[locale]/(protected)/dashboard/error.tsx
  - components/dashboard/dashboard-filters.tsx (nuqs URL state)
  - components/dashboard/dashboard-header.tsx
  - components/dashboard/dashboard-grid.tsx
  - components/dashboard/widgets/{6 widget components}
  - components/dashboard/{widget-skeleton, widget-empty-state, widget-error-state}.tsx
  - components/dashboard/auto-refresh-toggle.tsx
  - lib/queries/dashboard.queries.ts (TanStack Query hooks)
  - lib/api/dashboard.api.ts (fetch wrappers + Zod schemas)
  - lib/formatters/dashboard-formatters.ts (MAD/relative time/branche locale-aware)
  - hooks/use-dashboard-filters.ts
  - hooks/use-auto-refresh.ts
  - messages/{fr,ar-MA,ar}.json (dashboard namespace +50 keys each)
  - test/dashboard/{12+ Vitest tests}
  - e2e/web/dashboard.spec.ts (8+ Playwright tests)

API endpoints consumed (Sprint 13 Analytics + Sprint 14 Insure + Sprint 8 CRM) :
  - GET /api/v1/analytics/dashboards/broker/revenue
  - GET /api/v1/crm/dashboards/conversion-funnel
  - GET /api/v1/insure/dashboards/policies-active
  - GET /api/v1/repair/dashboards/sinistres-status
  - GET /api/v1/crm/deals/open
  - GET /api/v1/crm/activities/feed

Stack :
  - recharts 2.13.x (LineChart, FunnelChart, PieChart, BarChart, ResponsiveContainer)
  - nuqs 2.0.x (URL state with parseAsIsoDateTime, parseAsStringEnum, parseAsArrayOf)
  - date-fns + date-fns-tz 4.1.0 (Africa/Casablanca timezone)
  - TanStack Query 5.62.0 (staleTime 5min, refetchOnWindowFocus false)
  - shadcn/ui Card, Skeleton, Switch, Select, MultiSelect, Calendar, Popover, ScrollArea

Conformite MA :
  - WCAG 2.1 AA : charts a11y avec ARIA labels + sr-only tables alternative
  - Africa/Casablanca timezone via date-fns-tz (all date filters + display)
  - MAD currency via Intl.NumberFormat fr-MA (0 decimales display)
  - Loi 09-08 : KPI agreges uniquement, pas de PII brute (CIN/RIB/email/phone)
  - decision-006 : aucune emoji dans aucune ressource

Tests :
  - 12+ Vitest tests (rendering, empty states, error states, filter changes)
  - 8+ Playwright E2E (load, filters, refresh, auto-refresh, export, RTL, a11y, keyboard)
  - Lighthouse /fr/dashboard : Perf 75+, A11y 95+, Best Practices 92+

Edge cases handled :
  - First load tenant no data (6 empty states + CTAs)
  - 1 of 6 widgets fetch fails (isolated error state per widget)
  - date_range invalid (Zod validation + swap)
  - PieChart NaN if all zeros (filter pre-pass)
  - Recharts ResponsiveContainer width=0 (min-h enforced)
  - ar RTL chart direction (LTR conserved -- UX MA expectation)
  - Large datasets > 1000 points (backend LIMIT 365 + LTTB downsample Sprint 13)
  - Auto-refresh while typing filter (nuqs throttleMs 500)
  - Locale switch mid-render (key={locale} on chart components)

Dependencies :
  Depend on : task-4.3.3 (layout sidebar topbar)
  Unblocks : task-4.3.5 (Contacts page reuses nuqs filters + TanStack Query patterns)

Refs :
  - 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.4)
  - decision-001 (monorepo), decision-006 (no emoji), decision-007 (MAD/TZ MA),
    decision-009 (i18n 3 locales), decision-011 (Loi 09-08 PII)
```

### 15.2 Pull request description template

```markdown
## Tache 4.3.4 -- Dashboard 6 Widgets (Sprint 16)

### Summary
Implement /dashboard page with 6 KPI widgets + shared filters.

### Widgets delivered
1. Revenue YTD (LineChart + total + YoY)
2. Conversion Funnel (5 stages)
3. Polices Actives (PieChart 6 branches)
4. Sinistres Cours (BarChart 5 statuses)
5. Deals Open Top 5
6. Activity Feed Last 10

### Tests
- [x] Vitest : 12+ unit tests passing
- [x] Playwright : 8+ E2E tests passing
- [x] Lighthouse : Perf 75 / A11y 95 / Best 92
- [x] Typecheck OK
- [x] Lint OK (0 warnings)
- [x] Bundle size dashboard route : ~185 ko gzipped

### Screenshots
(Attached LTR + RTL + dark mode)

### Reviewer focus
- Server Component prefetch parallel pattern (page.tsx)
- TanStack Query staleTime + refetchInterval logic
- nuqs URL state synchronization
- Recharts accessibility (sr-only tables)

### Dependencies
- Depends on : #PR-task-4.3.3 (must merge first)
- Unblocks : task-4.3.5 (Contacts page)
```

---

## 16. Workflow next step

Apres merge de cette PR :

1. **task-4.3.5 Contacts page** (P0, 7h) reutilise :
   - nuqs URL state patterns (segment/tags/assigned_to/search filters)
   - TanStack Query staleTime + invalidation patterns
   - shadcn/ui DataTable + Skeleton + EmptyState components
   - Server Component initial prefetch + HydrationBoundary pattern

2. **Sprint 32 (Dashboards customization)** ajoutera :
   - Drag-drop reorder widgets (`@dnd-kit/core`)
   - User preferences persistence (Sprint 13 `user_dashboard_prefs` table)
   - AI insights widget (Phase 7 frontier IA -- "Vos polices auto baissent 12%, raison ?")
   - PDF export reel (jsPDF + html2canvas snapshot widgets)
   - CSV export reel (xlsx lib)
   - Forecast revenue widget (regression lineaire ClickHouse)

3. **Sprint 28 (Notifications realtime)** ajoutera :
   - WebSocket connection topbar + dashboard
   - Toast realtime quand nouveau sinistre declare
   - Activity feed auto-prepend new items (sans refresh manuel)
   - Badge counter activity feed widget

4. **Sprint 17 (Web Customer Portal)** copiera le pattern dashboard pour :
   - Customer portal dashboard (3 widgets simplifies : mes polices, mes sinistres, mes paiements)
   - Reutilise les memes Server Component + nuqs + TanStack Query patterns

---

## 17. Footer densite + auto-verif

### 17.1 Auto-check densite

Cette tache cible 100-150 ko (~25 000 a 37 500 mots) en suivant le pattern Gold Standard task-1.4.1.

Verification post-write :
```bash
wc -c repo/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.4-dashboard-6-widgets-revenue-conversion-polices.md
# Doit retourner valeur entre 102400 (100 ko) et 153600 (150 ko)
```

Si < 100 ko : enrichir sections 6 (code patterns), 7 (tests), 11 (edge cases), 12 (conformite MA).

Si > 150 ko : compacter section 7 (reduire fixtures) ou 13 (conventions -- referencer task-1.4.1 plutot que dupliquer).

### 17.2 Liste sections completees

- [x] 1. But
- [x] 2. Contexte etendu (alternatives, trade-offs, decisions, pieges)
- [x] 3. Architecture context (position sprint, programme, ASCII tree, provider chain, flux data)
- [x] 4. Livrables checkables (30 deliverables L1-L30)
- [x] 5. Fichiers crees / modifies (liste exhaustive)
- [x] 6. Code patterns COMPLETS (22 fichiers de code complets)
- [x] 7. Tests complets (12+ Vitest, 8+ Playwright)
- [x] 8. Variables d'environnement
- [x] 9. Commandes shell
- [x] 10. Criteres validation V1-V25 (15 P0 + 6 P1 + 4 P2)
- [x] 11. Edge cases (10 EC)
- [x] 12. Conformite Maroc (timezone, MAD, Loi 09-08, WCAG, RTL)
- [x] 13. Conventions absolues skalean-insurtech
- [x] 14. Validation pre-commit
- [x] 15. Commit message complet + PR template
- [x] 16. Workflow next step
- [x] 17. Footer densite + auto-verif

### 17.3 Statut tache

**Tache 4.3.4** : prete a etre executee par un developpeur Sprint 16 sans relecture d'aucune autre documentation que ce fichier + reference task-1.4.1 (Sprint 4 design tokens) + meta-prompt B-16 (decisions sprint).

**Effort estime** : 6 heures (1 developpeur senior Next.js 15 + TanStack Query + recharts).

**Risques** :
- Recharts 2.13.x warnings React 19 dev (mitigation : filter console.warn) -- 30 minutes max debug
- nuqs SSR/CSR hydration mismatch sur date pickers (mitigation : `createSearchParamsCache` server + initial values prop) -- 45 minutes max debug
- A11y axe-core failure sur Pie/Funnel charts SVG (mitigation : sr-only tables alternative) -- 30 minutes max debug

**Bloque par** : task-4.3.3 (layout protected + sidebar + topbar)
**Bloque** : task-4.3.5 (Contacts page reutilise patterns)

---

**Fin de task-4.3.4-dashboard-6-widgets-revenue-conversion-polices.md**

Sprint 16 / Phase 4 / Tache 4 sur 14 / Effort 6h / Priorite P0.
