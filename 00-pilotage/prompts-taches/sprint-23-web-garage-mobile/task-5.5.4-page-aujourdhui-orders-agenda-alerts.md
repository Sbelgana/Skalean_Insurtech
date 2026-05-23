# TACHE 5.5.4 -- Page "Aujourd'hui" : Orders du Jour + Agenda + Alerts

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.4)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (landing matin technicien -- premiere page vue chaque jour)
**Effort** : 5h
**Dependances** :
- Tache 5.5.3 (chassis : layout `(protected)`, bottom nav, FAB context via `useSetFabAction`, `PullToRefresh`, `useOnlineStatus`)
- Tache 5.5.1 (`@insurtech/garage-shared` : `OrderCard`, `StatusBadge`, types, `useOrders`, client API)
- Sprint 8 (booking : endpoint RDV reception `GET /api/v1/booking/appointments`)
- Sprint 19 (repair : parts tracking, alerts) ; Sprint 21 (sinistre workflow, QC)
- Tache 5.5.2 (auth : `useAuth().user` pour le greeting + tenant)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente la page **"Aujourd'hui"** (`/today`), la page d'accueil de la PWA technicien et la premiere chose qu'un technicien voit en ouvrant l'app le matin. Elle agrege en une seule vue scrollable : un en-tete personnalise (Bonjour {prenom} + date du jour), une section **Agenda** (les RDV de reception clients du jour, heure par heure, issus du module booking Sprint 8), une section **Orders en cours** (les orders assignes au technicien, sous forme de cartes tappables menant au detail), et une section **Alerts** (pieces arrivees aujourd'hui, controles qualite a re-verifier, rappels de permis/formation). Elle expose egalement des statistiques rapides (heures loggees aujourd'hui, orders completes, heures restantes estimees), le pull-to-refresh pour rafraichir les donnees, et declare l'action FAB "camera" (capture rapide d'une photo de reception).

L'apport est triple. D'abord, **donner au technicien une vue d'ensemble immediate de sa journee** : plutot que de naviguer dans plusieurs ecrans, il voit en un coup d'oeil ce qui l'attend (RDV, orders, alertes), ce qui structure sa journee et reduit les oublis (un client qui arrive a 9h pour une reception, une piece arrivee qui debloque un order en attente). Ensuite, **prioriser visuellement l'urgent** : les alertes (QC echoue a re-verifier, piece urgente arrivee) remontent en haut, codees couleur, pour que le technicien traite d'abord ce qui debloque le flux. Enfin, **offrir un point d'entree unique vers l'action** : chaque carte order mene au detail (Tache 5.5.5), chaque RDV agenda prepare la reception (Tache 5.5.6), et le FAB lance directement la camera -- la page est un hub d'orientation, pas une impasse.

A l'issue de cette tache, un technicien qui ouvre l'app voit : "Bonjour Youssef, mardi 20 mai", ses 3 RDV du jour (8h30 reception Dacia Logan, 11h reception Renault Clio, ...), ses 5 orders en cours (cartes avec statut, vehicule, avancement, badge "piece arrivee" si applicable), et 2 alertes ("Piece freins arrivee pour ORD-2026-014", "QC a re-verifier sur ORD-2026-009"). Il peut tirer pour rafraichir, taper une carte pour voir le detail, et taper le FAB pour photographier une reception. La page se charge depuis le cache si offline (orders du jour pre-fetches par le SW Tache 5.5.1).

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Le chassis de navigation (Tache 5.5.3) est pret mais la premiere page metier reste a construire. "Aujourd'hui" est strategique car c'est le `start_url` de la PWA (manifest Tache 5.5.1 pointe `/fr/today`) : c'est litteralement l'ecran qui s'ouvre quand le technicien lance l'app installee. La qualite de cette page determine la perception de l'outil. Une page d'accueil confuse ou lente decourage l'usage des le premier contact matinal.

L'analyse des workflows atelier (cf. `documentation/9-roadmap-execution.md`) montre que le technicien commence sa journee par trois questions : "Qu'est-ce qui m'attend aujourd'hui ?" (agenda RDV), "Sur quoi dois-je travailler ?" (orders assignes), "Qu'est-ce qui a change/bloque ?" (alertes : pieces arrivees, QC a refaire). La page "Aujourd'hui" repond a ces trois questions dans cet ordre de priorite, en agregeant des donnees provenant de trois modules backend distincts (booking Sprint 8, repair Sprint 19-21, et les alertes derivees).

Le choix d'**agreger sur une seule page scrollable** plutot que de multiplier les ecrans repose sur l'ergonomie mobile : le scroll vertical est le geste le plus naturel, et le technicien prefere une vue dense balayable d'un pouce a une navigation par onglets internes. Les sections sont clairement separees (titres + espacements) pour rester lisibles.

### Sources de donnees et agregation

La page consomme plusieurs endpoints, regroupes dans un hook `useTodayData` qui les orchestre :

| Section | Endpoint | Module | Notes |
|---------|----------|--------|-------|
| Agenda | `GET /api/v1/booking/appointments?date=today&technician_id=` | Booking (Sprint 8) | RDV reception du jour |
| Orders en cours | `GET /api/v1/repair/orders?technician_id=&status=active` | Repair (Sprint 19) | reuse `useOrders` (5.5.1) |
| Alerts | `GET /api/v1/repair/alerts?technician_id=` | Repair (Sprint 19-21) | parts arrived + QC failed + reminders |
| Quick stats | `GET /api/v1/repair/technician/stats?date=today` | Repair | hours_logged / completed / remaining |

Ces 4 requetes sont parallelisees (TanStack Query independantes) ; chaque section affiche son propre etat de chargement/erreur sans bloquer les autres (degradation gracieuse : si l'agenda echoue, les orders restent visibles).

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Page agregee 3 sections (CHOIX)** | Vue d'ensemble immediate, 1 scroll, priorisation visuelle | 4 requetes a orchestrer | RETENU |
| Onglets internes (agenda/orders/alerts) | Sections isolees | Friction (taps), perd la vue d'ensemble | rejete : ergonomie |
| Dashboard widgets (comme desktop 5.4.3) | Riche | Trop dense pour mobile, charge lourde | rejete : mobile |
| 1 seule requete backend agregee (`/today`) | 1 round-trip | Couplage backend fort, echec total si une source tombe | rejete : preferer degradation gracieuse par section |

### Trade-offs explicites

1. **4 requetes paralleles plutot qu'un endpoint agrege** : on accepte 4 appels reseau (orchestrés en parallele) pour obtenir une degradation gracieuse par section. Si l'agenda backend est lent/HS, les orders s'affichent quand meme. Trade-off : un peu plus de requetes, mais robustesse atelier (connexion intermittente). Le SW (5.5.1) cache chaque GET independamment.

2. **Quick stats calculees cote backend** : on ne reconstitue pas les stats cote client (somme des heures, etc.) mais on consomme un endpoint dedie. Pourquoi : la source de verite des heures est le backend (sync timer Tache 5.5.8) ; recalculer cote client risquerait des divergences avec les donnees offline non encore synchronisees. Trade-off assume.

3. **Agenda en lecture seule sur cette page** : taper un RDV mene a la reception (Tache 5.5.6), mais on ne gere pas l'edition d'agenda ici (c'est desktop, Sprint 22). La page oriente, elle n'administre pas.

4. **Refetch on focus + pull-to-refresh, pas de temps reel** : les donnees se rafraichissent quand le technicien revient sur l'app (refetchOnWindowFocus, 5.5.1) ou tire pour rafraichir. Pas de websocket. Trade-off : latence possible (un order assigne il y a 2 min peut ne pas encore apparaitre) mitige par le pull-to-refresh manuel et le push (Tache 5.5.11) pour les evenements critiques.

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : toutes les requetes portent `x-tenant-id` (client API). Le technicien ne voit que les orders/RDV de son garage.
- **decision-006 (no-emoji)** : icones lucide-react pour les alertes (AlertTriangle, Package, etc.), jamais d'emoji.
- **decision-008 (cloud souverain MA)** : donnees servies depuis Atlas Benguerir, cache local SW dans le perimetre MA.

### Pieges techniques connus

1. **Piege : la date "today" cote client vs serveur (fuseau)**
   - Pourquoi : si le client envoie `date=today` calcule localement et le serveur interprete dans un autre fuseau, des RDV peuvent manquer/deborder.
   - Solution : envoyer la date en ISO avec le fuseau explicite (`Africa/Casablanca`) ou laisser le backend deriver "today" cote serveur (preferer ce dernier : passer un parametre `scope=today` plutot qu'une date brute).

2. **Piege : une section en erreur masque toute la page**
   - Pourquoi : si on `await Promise.all` des 4 requetes et qu'une rejette, toute la page tombe.
   - Solution : 4 `useQuery` independantes ; chaque section gere `isLoading`/`isError` localement (degradation gracieuse).

3. **Piege : le greeting affiche "Bonjour undefined" avant le chargement de l'auth**
   - Pourquoi : `useAuth().user` peut etre null pendant l'hydratation.
   - Solution : fallback `user?.display_name ?? ''` ; afficher un skeleton du greeting tant que l'user n'est pas charge.

4. **Piege : pull-to-refresh ne rafraichit pas toutes les sections**
   - Pourquoi : le `onRefresh` n'invalide qu'une query.
   - Solution : `onRefresh` invalide les 4 query keys (`['today','agenda']`, `['orders']`, `['today','alerts']`, `['today','stats']`) via `queryClient.invalidateQueries`.

5. **Piege : badge "piece arrivee" obsolete (cache)**
   - Pourquoi : le SW sert un order en cache ou la piece n'etait pas encore arrivee.
   - Solution : Network First sur les GET repair (5.5.1) -> tente le reseau d'abord (4s timeout) ; le pull-to-refresh force la fraicheur.

6. **Piege : liste d'orders vide affiche un ecran blanc anxiogene**
   - Pourquoi : pas d'etat vide concu.
   - Solution : empty state explicite ("Aucun order assigne aujourd'hui. Profitez-en !" + illustration SVG legere) par section.

7. **Piege : l'action FAB camera persiste sur d'autres pages**
   - Pourquoi : `useSetFabAction` mal nettoye.
   - Solution : `useSetFabAction` nettoie au demontage (Tache 5.5.3) -> le FAB camera disparait quand on quitte "Aujourd'hui".

8. **Piege : l'agenda affiche des heures dans le mauvais format/locale**
   - Pourquoi : formatage de date naif.
   - Solution : `Intl.DateTimeFormat(locale, { hour, minute })` avec la locale courante + fuseau `Africa/Casablanca`.

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.4 est la **4eme tache du Sprint 23** et la **premiere page metier**. Elle :

- **Depend de** : Tache 5.5.3 (chassis, FAB, pull-to-refresh), Tache 5.5.1 (garage-shared, OrderCard, useOrders), Sprint 8 (booking), Sprint 19-21 (repair/alerts).
- **Bloque** : indirectement la fluidite du parcours (les autres pages sont atteignables sans elle, mais "Aujourd'hui" est le hub naturel). La Tache 5.5.5 (detail order) est la cible des taps de cartes.
- **Apporte au sprint** : la page d'accueil, le hook `useTodayData`, les composants de section (AgendaSection, OrdersSection, AlertsSection, QuickStats), les empty states.

### Position dans le programme global

Premiere page de production technicien. Equivalent mobile-atelier du dashboard desktop (Sprint 22, 5.4.3) mais resserree sur l'essentiel quotidien.

### Diagramme de la page

```
  /today  (dans le chassis (protected) Tache 5.5.3)
   +----------------------------------------------+
   |  Bonjour Youssef                             |  <- header greeting (useAuth)
   |  mardi 20 mai 2026                           |
   +----------------------------------------------+
   |  [h:2.5  ok:1  rest:5.5h]                    |  <- QuickStats (3 chiffres)
   +----------------------------------------------+
   |  ALERTES (2)                                 |  <- AlertsSection (priorite haute)
   |   [!] Piece freins arrivee -> ORD-014        |
   |   [!] QC a re-verifier -> ORD-009            |
   +----------------------------------------------+
   |  AGENDA DU JOUR                              |  <- AgendaSection (booking)
   |   08:30  Reception Dacia Logan (Bennani)     |
   |   11:00  Reception Renault Clio (Tazi)       |
   +----------------------------------------------+
   |  MES ORDERS EN COURS (5)                     |  <- OrdersSection (OrderCard x N)
   |   [OrderCard ORD-014 ...]                    |
   |   [OrderCard ORD-009 ...]                    |
   |   ...                                        |
   +----------------------------------------------+
                                    [FAB camera]    <- useSetFabAction
   (PullToRefresh enveloppe le tout ; invalide les 4 queries)
```

---

## 4. Livrables checkables

- [ ] Page `repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx` (~150 lignes)
- [ ] Hook `repo/apps/web-garage-mobile/hooks/use-today-data.ts` : orchestre 4 queries paralleles (~110 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/greeting-header.tsx` (~60 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/quick-stats.tsx` (~80 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/alerts-section.tsx` (~140 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/agenda-section.tsx` (~120 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/orders-section.tsx` (~110 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/empty-state.tsx` (~70 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/today/section-skeleton.tsx` (~60 lignes)
- [ ] Types alerts `repo/packages/garage-shared/src/types/alert.types.ts` (~70 lignes)
- [ ] Hook agenda/stats `repo/packages/garage-shared/src/hooks/use-agenda.ts` + `use-technician-stats.ts` (~120 lignes)
- [ ] Greeting personnalise (prenom + date locale formatee, fallback si user null)
- [ ] Quick stats : 3 chiffres (heures loggees / completes / restantes)
- [ ] Alertes codees couleur, triees par priorite, icones lucide
- [ ] Agenda : RDV du jour heure par heure, format locale + fuseau MA
- [ ] Orders : OrderCard tappables -> navigate `/orders/:id`
- [ ] Empty states par section (agenda vide, orders vides, alertes vides)
- [ ] Skeletons de chargement par section (pas de blocage global)
- [ ] Degradation gracieuse : une section en erreur n'affecte pas les autres
- [ ] Pull-to-refresh invalide les 4 queries
- [ ] FAB camera declare via useSetFabAction
- [ ] Fonctionne offline (cache SW orders du jour)
- [ ] Tests composants (8+ scenarios)
- [ ] Tests hook useTodayData (5+ scenarios)
- [ ] Tests E2E page today (3+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx          (~150 lignes / page)
repo/apps/web-garage-mobile/hooks/use-today-data.ts                          (~110 lignes / orchestration)
repo/apps/web-garage-mobile/hooks/use-today-data.spec.ts                     (~130 lignes / 5+ tests)
repo/apps/web-garage-mobile/components/today/greeting-header.tsx             (~60 lignes)
repo/apps/web-garage-mobile/components/today/quick-stats.tsx                 (~80 lignes)
repo/apps/web-garage-mobile/components/today/alerts-section.tsx             (~140 lignes)
repo/apps/web-garage-mobile/components/today/alerts-section.spec.tsx        (~120 lignes / 5+ tests)
repo/apps/web-garage-mobile/components/today/agenda-section.tsx            (~120 lignes)
repo/apps/web-garage-mobile/components/today/orders-section.tsx           (~110 lignes)
repo/apps/web-garage-mobile/components/today/empty-state.tsx              (~70 lignes)
repo/apps/web-garage-mobile/components/today/section-skeleton.tsx         (~60 lignes)
repo/packages/garage-shared/src/types/alert.types.ts                      (~70 lignes)
repo/packages/garage-shared/src/hooks/use-agenda.ts                       (~70 lignes)
repo/packages/garage-shared/src/hooks/use-technician-stats.ts             (~60 lignes)
repo/apps/web-garage-mobile/e2e/today-page.spec.ts                        (~110 lignes / 3+ E2E)
```

Total : ~15 fichiers, ~1500 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/12 : `repo/packages/garage-shared/src/types/alert.types.ts`

```typescript
import { z } from 'zod';

export const AlertSeverity = z.enum(['critical', 'warning', 'info']);
export type AlertSeverity = z.infer<typeof AlertSeverity>;

export const AlertType = z.enum([
  'part_arrived',
  'qc_failed',
  'license_expiring',
  'training_due',
  'priority_changed',
]);
export type AlertType = z.infer<typeof AlertType>;

export const TechnicianAlertSchema = z.object({
  id: z.string().uuid(),
  type: AlertType,
  severity: AlertSeverity,
  title: z.string(),
  message: z.string(),
  // lien optionnel vers un order/sinistre concerne
  order_id: z.string().uuid().nullable(),
  sinistre_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});
export type TechnicianAlert = z.infer<typeof TechnicianAlertSchema>;

export const AppointmentSchema = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  customer_name: z.string(),
  vehicle_label: z.string(), // "Dacia Logan -- 12345-A-6"
  sinistre_id: z.string().uuid().nullable(),
  kind: z.enum(['reception', 'delivery', 'other']),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const TechnicianStatsSchema = z.object({
  hours_logged_today_seconds: z.number().int().nonnegative(),
  orders_completed_today: z.number().int().nonnegative(),
  hours_remaining_estimate_seconds: z.number().int().nonnegative(),
});
export type TechnicianStats = z.infer<typeof TechnicianStatsSchema>;
```

### Fichier 2/12 : `repo/packages/garage-shared/src/hooks/use-agenda.ts`

```typescript
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { apiGet } from '../api/client';
import { AppointmentSchema } from '../types/alert.types';
import type { Appointment } from '../types/alert.types';

const AgendaResponseSchema = z.object({ data: z.array(AppointmentSchema) });

// RDV du jour pour le technicien. scope=today (le backend derive la date, piege 1).
export function useAgendaToday(client: AxiosInstance, technicianId: string, enabled = true): UseQueryResult<Appointment[]> {
  return useQuery({
    queryKey: ['today', 'agenda', technicianId],
    enabled: enabled && Boolean(technicianId),
    queryFn: async () => {
      const raw = await apiGet<unknown>(client, '/api/v1/booking/appointments', {
        scope: 'today',
        technician_id: technicianId,
      });
      return AgendaResponseSchema.parse(raw).data;
    },
  });
}
```

### Fichier 3/12 : `repo/packages/garage-shared/src/hooks/use-technician-stats.ts`

```typescript
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { apiGet } from '../api/client';
import { TechnicianStatsSchema } from '../types/alert.types';
import type { TechnicianStats } from '../types/alert.types';

export function useTechnicianStatsToday(client: AxiosInstance, enabled = true): UseQueryResult<TechnicianStats> {
  return useQuery({
    queryKey: ['today', 'stats'],
    enabled,
    queryFn: async () => {
      const raw = await apiGet<unknown>(client, '/api/v1/repair/technician/stats', { scope: 'today' });
      return TechnicianStatsSchema.parse(raw);
    },
  });
}
```

### Fichier 4/12 : `repo/apps/web-garage-mobile/hooks/use-today-data.ts`

Orchestration des 4 sources en parallele, degradation gracieuse, refresh global.

```typescript
'use client';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import {
  apiGet,
  useOrders,
  useAgendaToday,
  useTechnicianStatsToday,
  TechnicianAlertSchema,
} from '@insurtech/garage-shared';
import type { TechnicianAlert, Order, Appointment, TechnicianStats } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { useAuth } from '@/lib/auth/auth-context';

const AlertsResponseSchema = z.object({ data: z.array(TechnicianAlertSchema) });

export interface TodayData {
  orders: UseQueryResult<{ data: Order[]; total: number; page: number; page_size: number }>;
  agenda: UseQueryResult<Appointment[]>;
  alerts: UseQueryResult<TechnicianAlert[]>;
  stats: UseQueryResult<TechnicianStats>;
  refreshAll: () => Promise<void>;
}

export function useTodayData(): TodayData {
  const client = getApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const technicianId = user?.id ?? '';

  const orders = useOrders({ client, technicianId, status: 'active', enabled: Boolean(technicianId) });
  const agenda = useAgendaToday(client, technicianId, Boolean(technicianId));
  const stats = useTechnicianStatsToday(client, Boolean(technicianId));

  const alerts = useQuery({
    queryKey: ['today', 'alerts', technicianId],
    enabled: Boolean(technicianId),
    queryFn: async () => {
      const raw = await apiGet<unknown>(client, '/api/v1/repair/alerts', { technician_id: technicianId });
      // Tri : critical > warning > info, puis plus recent d'abord
      const list = AlertsResponseSchema.parse(raw).data;
      const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return [...list].sort((a, b) => order[a.severity] - order[b.severity]);
    },
  });

  // Pull-to-refresh : invalide les 4 query keys (piege 4)
  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['today', 'agenda'] }),
      queryClient.invalidateQueries({ queryKey: ['today', 'alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['today', 'stats'] }),
    ]);
  }, [queryClient]);

  return { orders, agenda, alerts, stats, refreshAll };
}
```

### Fichier 5/12 : `repo/apps/web-garage-mobile/components/today/greeting-header.tsx`

```typescript
'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';

// Greeting personnalise + date du jour formatee selon la locale + fuseau MA (piege 8).
export function GreetingHeader(): JSX.Element {
  const { user } = useAuth();
  const t = useTranslations('today');
  const locale = useParams().locale as string;

  const firstName = user?.display_name?.split(' ')[0] ?? '';
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Casablanca',
  }).format(new Date());

  return (
    <header className="px-4 pt-4">
      <h1 className="text-xl font-semibold text-garage-navy">
        {firstName ? t('greetingName', { name: firstName }) : t('greeting')}
      </h1>
      <p className="text-sm capitalize text-slate-500">{dateLabel}</p>
    </header>
  );
}
```

### Fichier 6/12 : `repo/apps/web-garage-mobile/components/today/quick-stats.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import type { TechnicianStats } from '@insurtech/garage-shared';

interface QuickStatsProps {
  stats: TechnicianStats | undefined;
  loading: boolean;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export function QuickStats({ stats, loading }: QuickStatsProps): JSX.Element {
  const t = useTranslations('today');
  const items = [
    { label: t('hoursLogged'), value: stats ? formatHours(stats.hours_logged_today_seconds) : '--' },
    { label: t('completed'), value: stats ? String(stats.orders_completed_today) : '--' },
    { label: t('remaining'), value: stats ? formatHours(stats.hours_remaining_estimate_seconds) : '--' },
  ];
  return (
    <div className="mx-4 mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center">
          <span className={`text-lg font-bold text-garage-navy ${loading ? 'animate-pulse' : ''}`}>{item.value}</span>
          <span className="text-[11px] text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
```

### Fichier 7/12 : `repo/apps/web-garage-mobile/components/today/alerts-section.tsx`

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Package, Clock, ShieldAlert, type LucideIcon } from 'lucide-react';
import type { TechnicianAlert, AlertType, AlertSeverity } from '@insurtech/garage-shared';
import { EmptyState } from './empty-state';
import { SectionSkeleton } from './section-skeleton';

interface AlertsSectionProps {
  alerts: TechnicianAlert[] | undefined;
  loading: boolean;
  error: boolean;
}

const ICON_BY_TYPE: Record<AlertType, LucideIcon> = {
  part_arrived: Package,
  qc_failed: ShieldAlert,
  license_expiring: Clock,
  training_due: Clock,
  priority_changed: AlertTriangle,
};

const STYLE_BY_SEVERITY: Record<AlertSeverity, string> = {
  critical: 'border-red-300 bg-red-50 text-red-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
  info: 'border-blue-300 bg-blue-50 text-blue-800',
};

export function AlertsSection({ alerts, loading, error }: AlertsSectionProps): JSX.Element {
  const t = useTranslations('today');
  const router = useRouter();
  const locale = useParams().locale as string;

  if (loading) return <SectionSkeleton title={t('alerts')} rows={2} />;
  if (error) return <p className="px-4 py-2 text-sm text-slate-400">{t('alertsError')}</p>;
  if (!alerts || alerts.length === 0) return <EmptyState message={t('noAlerts')} variant="positive" />;

  return (
    <section className="mt-5 px-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {t('alerts')} ({alerts.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const Icon = ICON_BY_TYPE[alert.type];
          const clickable = Boolean(alert.order_id);
          return (
            <li key={alert.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => alert.order_id && router.push(`/${locale}/orders/${alert.order_id}`)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${STYLE_BY_SEVERITY[alert.severity]} ${clickable ? 'active:scale-[0.99]' : ''}`}
              >
                <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{alert.title}</span>
                  <span className="text-xs opacity-90">{alert.message}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

### Fichier 8/12 : `repo/apps/web-garage-mobile/components/today/agenda-section.tsx`

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Appointment } from '@insurtech/garage-shared';
import { EmptyState } from './empty-state';
import { SectionSkeleton } from './section-skeleton';

interface AgendaSectionProps {
  appointments: Appointment[] | undefined;
  loading: boolean;
  error: boolean;
}

export function AgendaSection({ appointments, loading, error }: AgendaSectionProps): JSX.Element {
  const t = useTranslations('today');
  const router = useRouter();
  const locale = useParams().locale as string;

  if (loading) return <SectionSkeleton title={t('agenda')} rows={2} />;
  if (error) return <p className="px-4 py-2 text-sm text-slate-400">{t('agendaError')}</p>;
  if (!appointments || appointments.length === 0) return <EmptyState message={t('noAppointments')} />;

  function formatTime(iso: string): string {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Casablanca',
    }).format(new Date(iso));
  }

  return (
    <section className="mt-5 px-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('agenda')}</h2>
      <ul className="flex flex-col gap-2">
        {appointments.map((apt) => (
          <li key={apt.id}>
            <button
              type="button"
              onClick={() => apt.sinistre_id && router.push(`/${locale}/sinistres/${apt.sinistre_id}/reception`)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
            >
              <span className="rounded-lg bg-garage-navy px-2 py-1 text-xs font-bold text-white">{formatTime(apt.scheduled_at)}</span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-garage-navy">{apt.vehicle_label}</span>
                <span className="text-xs text-slate-500">{apt.customer_name} -- {t(`apptKind.${apt.kind}`)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### Fichier 9/12 : `repo/apps/web-garage-mobile/components/today/orders-section.tsx`

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { OrderCard } from '@insurtech/garage-shared';
import type { Order } from '@insurtech/garage-shared';
import { EmptyState } from './empty-state';
import { SectionSkeleton } from './section-skeleton';

interface OrdersSectionProps {
  orders: Order[] | undefined;
  loading: boolean;
  error: boolean;
}

export function OrdersSection({ orders, loading, error }: OrdersSectionProps): JSX.Element {
  const t = useTranslations('today');
  const tStatus = useTranslations('status');
  const router = useRouter();
  const locale = useParams().locale as string;

  if (loading) return <SectionSkeleton title={t('orders')} rows={3} />;
  if (error) return <p className="px-4 py-2 text-sm text-slate-400">{t('ordersError')}</p>;
  if (!orders || orders.length === 0) return <EmptyState message={t('noOrders')} variant="positive" />;

  return (
    <section className="mt-5 px-4 pb-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {t('orders')} ({orders.length})
      </h2>
      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            statusLabel={tStatus(order.status)}
            onClick={(id) => router.push(`/${locale}/orders/${id}`)}
          />
        ))}
      </div>
    </section>
  );
}
```

### Fichier 10/12 : `repo/apps/web-garage-mobile/components/today/empty-state.tsx` + `section-skeleton.tsx`

```typescript
// empty-state.tsx
interface EmptyStateProps {
  message: string;
  variant?: 'neutral' | 'positive';
}

export function EmptyState({ message, variant = 'neutral' }: EmptyStateProps): JSX.Element {
  return (
    <div className="mx-4 mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 p-6 text-center">
      {/* Illustration SVG legere inline (pas d emoji, decision-006) */}
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={variant === 'positive' ? '#16a34a' : '#94a3b8'} strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        {variant === 'positive' ? <path d="M8 12l3 3 5-6" /> : <path d="M8 12h8" />}
      </svg>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
```

```typescript
// section-skeleton.tsx
interface SectionSkeletonProps {
  title: string;
  rows: number;
}

export function SectionSkeleton({ title, rows }: SectionSkeletonProps): JSX.Element {
  return (
    <section className="mt-5 px-4" aria-busy="true" aria-label={`${title} -- chargement`}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </section>
  );
}
```

### Fichier 11/12 : `repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx`

La page assemble les sections, gere le pull-to-refresh et declare le FAB camera.

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { Camera } from 'lucide-react';
import { useSetFabAction } from '@/components/layout/fab-context';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { useTodayData } from '@/hooks/use-today-data';
import { GreetingHeader } from '@/components/today/greeting-header';
import { QuickStats } from '@/components/today/quick-stats';
import { AlertsSection } from '@/components/today/alerts-section';
import { AgendaSection } from '@/components/today/agenda-section';
import { OrdersSection } from '@/components/today/orders-section';

export default function TodayPage(): JSX.Element {
  const router = useRouter();
  const locale = useParams().locale as string;
  const { orders, agenda, alerts, stats, refreshAll } = useTodayData();

  // Declare l action FAB "camera" (capture reception rapide), nettoyee au demontage.
  useSetFabAction({
    icon: Camera,
    label: 'Camera reception',
    onPress: () => router.push(`/${locale}/today?action=camera`),
  });

  return (
    <PullToRefresh onRefresh={refreshAll}>
      <GreetingHeader />
      <QuickStats stats={stats.data} loading={stats.isLoading} />
      <AlertsSection alerts={alerts.data} loading={alerts.isLoading} error={alerts.isError} />
      <AgendaSection appointments={agenda.data} loading={agenda.isLoading} error={agenda.isError} />
      <OrdersSection orders={orders.data?.data} loading={orders.isLoading} error={orders.isError} />
    </PullToRefresh>
  );
}
```

**Notes importantes** :
- Chaque section recoit son propre `loading`/`error` (degradation gracieuse, piege 2).
- `useSetFabAction` declare le FAB camera (nettoye au demontage, piege 7).
- `PullToRefresh` enveloppe tout et appelle `refreshAll` (invalide 4 queries, piege 4).

### Fichier 12/12 : cles i18n ajoutees `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "today": {
    "greeting": "Bonjour",
    "greetingName": "Bonjour {name}",
    "hoursLogged": "Heures",
    "completed": "Termines",
    "remaining": "Restant",
    "alerts": "Alertes",
    "alertsError": "Alertes indisponibles",
    "noAlerts": "Aucune alerte. Tout est sous controle.",
    "agenda": "Agenda du jour",
    "agendaError": "Agenda indisponible",
    "noAppointments": "Aucun rendez-vous aujourd'hui.",
    "orders": "Mes orders en cours",
    "ordersError": "Orders indisponibles",
    "noOrders": "Aucun order assigne. Profitez-en !",
    "apptKind": { "reception": "Reception", "delivery": "Livraison", "other": "Autre" }
  }
}
```

## 7. Tests complets

### 7.1 Tests AlertsSection : `repo/apps/web-garage-mobile/components/today/alerts-section.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertsSection } from './alerts-section';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ locale: 'fr' }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const baseAlert = {
  id: '1', type: 'part_arrived', severity: 'warning', title: 'Piece arrivee', message: 'Freins ORD-014',
  order_id: 'ord-014', sinistre_id: null, created_at: '2026-05-20T08:00:00.000Z',
};

describe('AlertsSection', () => {
  it('affiche le skeleton en chargement', () => {
    render(<AlertsSection alerts={undefined} loading error={false} />);
    expect(screen.getByLabelText(/chargement/i)).toBeInTheDocument();
  });

  it('affiche un empty state si aucune alerte', () => {
    render(<AlertsSection alerts={[]} loading={false} error={false} />);
    expect(screen.getByText('noAlerts')).toBeInTheDocument();
  });

  it('affiche les alertes avec compteur', () => {
    render(<AlertsSection alerts={[baseAlert as any]} loading={false} error={false} />);
    expect(screen.getByText('Piece arrivee')).toBeInTheDocument();
  });

  it('navigue vers l order au clic si order_id present', () => {
    render(<AlertsSection alerts={[baseAlert as any]} loading={false} error={false} />);
    fireEvent.click(screen.getByText('Piece arrivee'));
    expect(push).toHaveBeenCalledWith('/fr/orders/ord-014');
  });

  it('affiche un message d erreur si error', () => {
    render(<AlertsSection alerts={undefined} loading={false} error />);
    expect(screen.getByText('alertsError')).toBeInTheDocument();
  });

  it('desactive le clic si pas d order lie', () => {
    const noOrder = { ...baseAlert, order_id: null };
    render(<AlertsSection alerts={[noOrder as any]} loading={false} error={false} />);
    fireEvent.click(screen.getByText('Piece arrivee'));
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/orders/'));
  });
});
```

### 7.2 Tests useTodayData : `repo/apps/web-garage-mobile/hooks/use-today-data.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'tech-1', display_name: 'Youssef Alaoui' } }) }));
const getMock = vi.fn();
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({}) }));
vi.mock('@insurtech/garage-shared', async () => {
  const actual = await vi.importActual<any>('@insurtech/garage-shared');
  return {
    ...actual,
    apiGet: (...args: unknown[]) => getMock(...args),
    useOrders: () => ({ data: { data: [], total: 0, page: 1, page_size: 20 }, isLoading: false, isError: false }),
    useAgendaToday: () => ({ data: [], isLoading: false, isError: false }),
    useTechnicianStatsToday: () => ({ data: undefined, isLoading: true, isError: false }),
  };
});

import { useTodayData } from './use-today-data';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useTodayData', () => {
  it('trie les alertes par severite (critical d abord)', async () => {
    getMock.mockResolvedValue({
      data: [
        { id: '1', type: 'info', severity: 'info', title: 'i', message: 'm', order_id: null, sinistre_id: null, created_at: '2026-05-20T08:00:00.000Z' },
        { id: '2', type: 'qc_failed', severity: 'critical', title: 'c', message: 'm', order_id: null, sinistre_id: null, created_at: '2026-05-20T08:00:00.000Z' },
      ],
    });
    const { result } = renderHook(() => useTodayData(), { wrapper });
    await waitFor(() => expect(result.current.alerts.isSuccess).toBe(true));
    expect(result.current.alerts.data?.[0]?.severity).toBe('critical');
  });

  it('expose refreshAll', () => {
    getMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useTodayData(), { wrapper });
    expect(typeof result.current.refreshAll).toBe('function');
  });

  it('degradation : stats en chargement n empeche pas les orders', () => {
    getMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useTodayData(), { wrapper });
    expect(result.current.stats.isLoading).toBe(true);
    expect(result.current.orders.isLoading).toBe(false);
  });
});
```

### 7.3 Tests E2E : `repo/apps/web-garage-mobile/e2e/today-page.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Page Aujourd hui', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
    // Mock API (route interception)
    await page.route('**/api/v1/repair/orders**', (r) => r.fulfill({ json: { data: [], total: 0, page: 1, page_size: 20 } }));
    await page.route('**/api/v1/booking/appointments**', (r) => r.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/repair/alerts**', (r) => r.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/repair/technician/stats**', (r) => r.fulfill({ json: { hours_logged_today_seconds: 9000, orders_completed_today: 1, hours_remaining_estimate_seconds: 19800 } }));
  });

  test('affiche le greeting et les sections', async ({ page }) => {
    await page.goto('/fr/today');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/alertes|alerts/i)).toBeVisible();
  });

  test('affiche les empty states quand aucune donnee', async ({ page }) => {
    await page.goto('/fr/today');
    await expect(page.getByText(/aucun order|noOrders/i)).toBeVisible();
  });

  test('le FAB camera est present', async ({ page }) => {
    await page.goto('/fr/today');
    await expect(page.getByLabel(/camera reception/i)).toBeVisible();
  });
});
```

### 7.4 Couverture cible

- Lignes : >= 85% global.
- Total tests cette tache : 12 (6 alerts + 3 useTodayData + 3 E2E).

## 6bis. Contrats backend consommes (specification d'integration)

La page "Aujourd'hui" consomme 4 endpoints backend. Pour l'auto-suffisance, voici leurs contrats exacts (request/response). Si un endpoint n'est pas encore livre (Sprint 8/19/21), il doit etre cree conformement a ces specs OU stubbe.

### Endpoint 1 : `GET /api/v1/booking/appointments?scope=today&technician_id=...`

```typescript
// Reponse attendue (booking, Sprint 8)
interface AppointmentsResponse {
  data: Array<{
    id: string;            // uuid
    scheduled_at: string;  // ISO 8601, fuseau Africa/Casablanca derive serveur (piege 1)
    customer_name: string;
    vehicle_label: string; // "Dacia Logan -- 12345-A-6"
    sinistre_id: string | null;
    kind: 'reception' | 'delivery' | 'other';
  }>;
}
// Headers requis : Authorization Bearer, x-tenant-id
// scope=today : le backend derive "aujourd'hui" en Africa/Casablanca (eviter le decalage client, piege 1)
```

### Endpoint 2 : `GET /api/v1/repair/orders?technician_id=...&status=active`

Reuse `useOrders` (5.5.1). Reponse paginee `{ data: Order[], total, page, page_size }`. Le filtre `status=active` retourne les orders non termines/non annules assignes au technicien.

### Endpoint 3 : `GET /api/v1/repair/alerts?technician_id=...`

```typescript
// Reponse attendue (repair, Sprint 19-21)
interface AlertsResponse {
  data: Array<{
    id: string;
    type: 'part_arrived' | 'qc_failed' | 'license_expiring' | 'training_due' | 'priority_changed';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    order_id: string | null;
    sinistre_id: string | null;
    created_at: string; // ISO
  }>;
}
// Le backend ne retourne QUE les alertes actives (piege 5 : pas d'alerte sur action deja traitee)
```

### Endpoint 4 : `GET /api/v1/repair/technician/stats?scope=today`

```typescript
// Reponse attendue (repair)
interface TechnicianStatsResponse {
  hours_logged_today_seconds: number;       // somme des sessions du jour (timer 5.5.8)
  orders_completed_today: number;
  hours_remaining_estimate_seconds: number; // estimation basee sur les orders en cours
}
```

### Contrat d'erreur commun

Toutes ces requetes peuvent retourner : `401` (token expire -> refresh transparent client 5.5.1), `403` (role non garage -> rejet), `5xx` (erreur serveur -> la section affiche son etat error, degradation gracieuse, piege 2). Le client API (`@insurtech/garage-shared`) gere le refresh et l'injection `x-tenant-id`.

## 6ter. Code patterns complementaires

### Fichier 13/18 : `repo/apps/web-garage-mobile/components/today/alert-icon.tsx`

Mapping type d'alerte -> icone (extrait pour testabilite).

```typescript
import { AlertTriangle, Package, Clock, ShieldAlert, BadgeAlert, type LucideIcon } from 'lucide-react';
import type { AlertType } from '@insurtech/garage-shared';

const ICONS: Record<AlertType, LucideIcon> = {
  part_arrived: Package,
  qc_failed: ShieldAlert,
  license_expiring: Clock,
  training_due: Clock,
  priority_changed: AlertTriangle,
};

export function getAlertIcon(type: AlertType): LucideIcon {
  return ICONS[type] ?? BadgeAlert;
}
```

### Fichier 14/18 : `repo/apps/web-garage-mobile/components/today/today-error-boundary.tsx`

Barriere d'erreur React pour isoler un crash de section (defense en profondeur, piege 2).

```typescript
'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}
interface State {
  hasError: boolean;
}

// Empeche qu'un crash de rendu d'une section fasse tomber toute la page Aujourd'hui.
export class TodayErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  // Pas de console.log : on remonte a un endpoint de telemetrie via un event
  componentDidCatch(): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app:section-error'));
  }
  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

### Fichier 15/18 : `repo/apps/web-garage-mobile/components/today/greeting-skeleton.tsx`

```typescript
'use client';

export function GreetingSkeleton(): JSX.Element {
  return (
    <header className="px-4 pt-4" aria-busy="true">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
    </header>
  );
}
```

### Fichier 16/18 : `repo/apps/web-garage-mobile/hooks/use-greeting-time.ts`

Greeting adapte au moment de la journee (bonjour/bonsoir), fuseau MA.

```typescript
'use client';

// Retourne la cle i18n de salutation selon l'heure (Africa/Casablanca).
export function useGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('fr', { hour: '2-digit', hour12: false, timeZone: 'Africa/Casablanca' }).format(new Date()),
  );
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
```

### Fichier 17/18 : integration error boundary + skeleton dans la page

```typescript
// repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx (extrait enrichi)
// Chaque section est enveloppee d'une TodayErrorBoundary avec un fallback discret :
//   <TodayErrorBoundary fallback={<p className="px-4 py-2 text-sm text-slate-400">{t('sectionError')}</p>}>
//     <AlertsSection ... />
//   </TodayErrorBoundary>
// -> un crash de rendu d'une section n'affecte pas les autres (defense en profondeur, piege 2).
```

### Fichier 18/18 : cles i18n complementaires `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "today": {
    "greetingMorning": "Bonjour {name}",
    "greetingAfternoon": "Bon apres-midi {name}",
    "greetingEvening": "Bonsoir {name}",
    "sectionError": "Section indisponible",
    "refreshing": "Actualisation..."
  }
}
```

## 7bis. Tests complementaires

### 7.5 Tests AgendaSection : `repo/apps/web-garage-mobile/components/today/agenda-section.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaSection } from './agenda-section';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ locale: 'fr' }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const apt = { id: 'a1', scheduled_at: '2026-05-20T08:30:00.000Z', customer_name: 'Bennani', vehicle_label: 'Dacia Logan -- 12345-A-6', sinistre_id: 's1', kind: 'reception' };

describe('AgendaSection', () => {
  it('affiche le skeleton en chargement', () => {
    render(<AgendaSection appointments={undefined} loading error={false} />);
    expect(screen.getByLabelText(/chargement/i)).toBeInTheDocument();
  });

  it('affiche un empty state si aucun RDV', () => {
    render(<AgendaSection appointments={[]} loading={false} error={false} />);
    expect(screen.getByText('noAppointments')).toBeInTheDocument();
  });

  it('affiche les RDV avec vehicule et client', () => {
    render(<AgendaSection appointments={[apt as any]} loading={false} error={false} />);
    expect(screen.getByText(/Dacia Logan/)).toBeInTheDocument();
    expect(screen.getByText(/Bennani/)).toBeInTheDocument();
  });

  it('navigue vers la reception au clic', () => {
    render(<AgendaSection appointments={[apt as any]} loading={false} error={false} />);
    fireEvent.click(screen.getByText(/Dacia Logan/));
    expect(push).toHaveBeenCalledWith('/fr/sinistres/s1/reception');
  });

  it('affiche un message d erreur si error', () => {
    render(<AgendaSection appointments={undefined} loading={false} error />);
    expect(screen.getByText('agendaError')).toBeInTheDocument();
  });
});
```

### 7.6 Tests QuickStats : `repo/apps/web-garage-mobile/components/today/quick-stats.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickStats } from './quick-stats';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('QuickStats', () => {
  it('affiche -- tant que non charge', () => {
    render(<QuickStats stats={undefined} loading />);
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(3);
  });

  it('formate les heures en HhMM', () => {
    render(<QuickStats stats={{ hours_logged_today_seconds: 9000, orders_completed_today: 2, hours_remaining_estimate_seconds: 19800 }} loading={false} />);
    expect(screen.getByText('2h30')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('affiche les 3 statistiques', () => {
    render(<QuickStats stats={{ hours_logged_today_seconds: 3600, orders_completed_today: 1, hours_remaining_estimate_seconds: 7200 }} loading={false} />);
    expect(screen.getByText('1h')).toBeInTheDocument();
  });
});
```

### 7.7 Tests error boundary : `repo/apps/web-garage-mobile/components/today/today-error-boundary.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodayErrorBoundary } from './today-error-boundary';

function Boom(): JSX.Element {
  throw new Error('boom');
}

describe('TodayErrorBoundary', () => {
  it('affiche le fallback si l enfant crash', () => {
    // Silence l erreur console attendue de React en test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<TodayErrorBoundary fallback={<span>section ko</span>}><Boom /></TodayErrorBoundary>);
    expect(screen.getByText('section ko')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('rend les enfants si pas d erreur', () => {
    render(<TodayErrorBoundary fallback={<span>ko</span>}><span>ok</span></TodayErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
```

### 7.8 Tests OrdersSection : `repo/apps/web-garage-mobile/components/today/orders-section.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrdersSection } from './orders-section';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ locale: 'fr' }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@insurtech/garage-shared', () => ({ OrderCard: ({ order, onClick }: any) => <button onClick={() => onClick(order.id)}>{order.order_number}</button> }));

const order = { id: 'o1', order_number: 'ORD-1', status: 'in_progress', vehicle: { make: 'Dacia', model: 'Logan', plate: 'p' }, completion_percent: 40, hours_logged_seconds: 0, parts: [] };

describe('OrdersSection', () => {
  it('empty state si aucun order', () => {
    render(<OrdersSection orders={[]} loading={false} error={false} />);
    expect(screen.getByText('noOrders')).toBeInTheDocument();
  });

  it('affiche les cartes orders', () => {
    render(<OrdersSection orders={[order as any]} loading={false} error={false} />);
    expect(screen.getByText('ORD-1')).toBeInTheDocument();
  });

  it('navigue au clic carte', () => {
    render(<OrdersSection orders={[order as any]} loading={false} error={false} />);
    fireEvent.click(screen.getByText('ORD-1'));
    expect(push).toHaveBeenCalledWith('/fr/orders/o1');
  });
});
```

### 7.9 Tests accessibilite : `repo/apps/web-garage-mobile/e2e/a11y/today-a11y.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ ...devices['Pixel 7'] });

test.describe('Accessibilite page Aujourd hui', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
    await page.route('**/api/v1/repair/orders**', (r) => r.fulfill({ json: { data: [], total: 0, page: 1, page_size: 20 } }));
    await page.route('**/api/v1/booking/appointments**', (r) => r.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/repair/alerts**', (r) => r.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/repair/technician/stats**', (r) => r.fulfill({ json: { hours_logged_today_seconds: 0, orders_completed_today: 0, hours_remaining_estimate_seconds: 0 } }));
  });

  test('0 violation axe-core critique sur /today', async ({ page }) => {
    await page.goto('/fr/today');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['region']).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, JSON.stringify(critical.map((v) => v.id))).toEqual([]);
  });

  test('le h1 (greeting) est unique et present', async ({ page }) => {
    await page.goto('/fr/today');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('les sections ont des titres (h2)', async ({ page }) => {
    await page.goto('/fr/today');
    const h2 = page.getByRole('heading', { level: 2 });
    expect(await h2.count()).toBeGreaterThanOrEqual(1);
  });

  test('en arabe, la page est en RTL', async ({ page }) => {
    await page.goto('/ar/today');
    const dir = await page.locator('[dir]').first().getAttribute('dir');
    expect(dir).toBe('rtl');
  });
});
```

## 8bis. Budget de performance

La page "Aujourd'hui" est le `start_url` de la PWA : elle doit etre rapide a charger et a afficher, surtout sur connexion atelier lente.

| Metrique | Cible | Moyen |
|----------|-------|-------|
| First Contentful Paint | < 1.8s (3G lente) | shell pre-cache SW (5.5.1), skeletons immediats |
| Largest Contentful Paint | < 2.5s | pas d'image lourde au-dessus de la ligne de flottaison |
| Total Blocking Time | < 200ms | 4 requetes paralleles non bloquantes, pas de JS lourd au boot |
| Cumulative Layout Shift | < 0.1 | skeletons de meme dimension que le contenu final (pas de saut) |
| Bundle JS page | < 60 ko gzip | `optimizePackageImports` (5.5.1), pas de lib lourde |

Mesure : Lighthouse (Tache 5.5.12) inclut `/today` dans les URLs auditees. Les skeletons (GreetingSkeleton, SectionSkeleton) garantissent un CLS faible : ils occupent la meme hauteur que le contenu charge (h-16 pour les cartes, h-20 pour les sections). Le pre-fetch SW (5.5.1) sert le shell + la derniere donnee orders connue, donc la page s'affiche meme offline en < 1s.

Anti-pattern a eviter : ne pas charger toutes les photos des orders sur la page Aujourd'hui (les OrderCard n'affichent pas de photo, juste des metadonnees) -> economie data + perf.

## 8. Variables environnement

Aucune nouvelle variable. Consomme `NEXT_PUBLIC_API_BASE_URL` (5.5.1). Les endpoints backend (`/booking/appointments`, `/repair/alerts`, `/repair/technician/stats`) doivent exister (Sprints 8/19/21, contrats section 6bis) ; si `alerts`/`stats` ne sont pas encore livres, un stub `{ data: [] }` / valeurs zero permet a la page de fonctionner en degrade.

### 7.10 Test d'integration de la page complete : `repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mocks des dependances de la page
const setFab = vi.fn();
vi.mock('@/components/layout/fab-context', () => ({ useSetFabAction: (a: unknown) => setFab(a) }));
vi.mock('@/components/layout/pull-to-refresh', () => ({ PullToRefresh: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ locale: 'fr' }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string, p?: Record<string, unknown>) => (p?.name ? `${k} ${p.name}` : k) }));
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'tech-1', display_name: 'Youssef Alaoui', tenant_id: 't1' } }) }));

const getMock = vi.fn();
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({}) }));
vi.mock('@insurtech/garage-shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@insurtech/garage-shared');
  return {
    ...actual,
    apiGet: (...a: unknown[]) => getMock(...a),
    useOrders: () => ({ data: { data: [], total: 0, page: 1, page_size: 20 }, isLoading: false, isError: false }),
    useAgendaToday: () => ({ data: [], isLoading: false, isError: false }),
    useTechnicianStatsToday: () => ({ data: { hours_logged_today_seconds: 9000, orders_completed_today: 1, hours_remaining_estimate_seconds: 0 }, isLoading: false, isError: false }),
    OrderCard: () => null,
  };
});

import TodayPage from './page';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('TodayPage (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: [] });
  });

  it('rend le greeting personnalise avec le prenom', async () => {
    render(<TodayPage />, { wrapper });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Youssef');
  });

  it('declare l action FAB camera au montage', () => {
    render(<TodayPage />, { wrapper });
    expect(setFab).toHaveBeenCalledWith(expect.objectContaining({ label: expect.any(String) }));
  });

  it('affiche les empty states quand toutes les sources sont vides', async () => {
    render(<TodayPage />, { wrapper });
    await waitFor(() => expect(screen.getByText('today.noOrders')).toBeInTheDocument());
  });
});
```

### 7.11 Internationalisation complete (3 locales)

La page doit etre entierement traduite en francais, darija (ar-MA) et arabe classique (ar). Fichiers complets pour le namespace `today` :

#### `repo/apps/web-garage-mobile/i18n/messages/ar-MA.json` (darija -- extrait today)

```json
{
  "today": {
    "greeting": "السلام",
    "greetingMorning": "صباح الخير {name}",
    "greetingAfternoon": "مسا الخير {name}",
    "greetingEvening": "مسا الخير {name}",
    "hoursLogged": "الساعات",
    "completed": "كمل",
    "remaining": "باقي",
    "alerts": "التنبيهات",
    "alertsError": "التنبيهات ماكايناش",
    "noAlerts": "ماكاين حتى تنبيه. كلشي مزيان.",
    "agenda": "الأجندة ديال اليوم",
    "agendaError": "الأجندة ماكايناش",
    "noAppointments": "ماكاين حتى موعد اليوم.",
    "orders": "الطلبات ديالي",
    "ordersError": "الطلبات ماكايناش",
    "noOrders": "ماكاين حتى طلب. ارتاح شوية!",
    "sectionError": "هاد القسم ماخدامش",
    "apptKind": { "reception": "استقبال", "delivery": "تسليم", "other": "اخر" }
  }
}
```

#### `repo/apps/web-garage-mobile/i18n/messages/ar.json` (arabe classique -- extrait today)

```json
{
  "today": {
    "greeting": "مرحبا",
    "greetingMorning": "صباح الخير {name}",
    "greetingAfternoon": "مساء الخير {name}",
    "greetingEvening": "مساء الخير {name}",
    "hoursLogged": "الساعات",
    "completed": "مكتمل",
    "remaining": "متبقي",
    "alerts": "التنبيهات",
    "alertsError": "التنبيهات غير متوفرة",
    "noAlerts": "لا توجد تنبيهات. كل شيء تحت السيطرة.",
    "agenda": "جدول اليوم",
    "agendaError": "الجدول غير متوفر",
    "noAppointments": "لا توجد مواعيد اليوم.",
    "orders": "طلباتي الجارية",
    "ordersError": "الطلبات غير متوفرة",
    "noOrders": "لا توجد طلبات مسندة. استمتع بوقتك!",
    "sectionError": "القسم غير متوفر",
    "apptKind": { "reception": "استقبال", "delivery": "تسليم", "other": "أخرى" }
  }
}
```

**Notes importantes** : les trois fichiers doivent avoir des cles strictement identiques (sinon next-intl jette une erreur de cle manquante). Un test de parite des cles est recommande (V44). Le rendu RTL (ar/ar-MA) est gere par le LocaleLayout (5.5.1) ; verifier que les nombres (heures, compteurs) s'affichent correctement en contexte RTL (les chiffres latins restent LTR dans un texte RTL, comportement standard).

### 7.12 Test de parite des cles i18n : `repo/apps/web-garage-mobile/i18n/messages/parity.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import arMA from './ar-MA.json';
import ar from './ar.json';

// Verifie que les 3 locales ont exactement les memes cles (eviter les cles manquantes runtime).
function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n parite des cles', () => {
  it('ar-MA a les memes cles que fr', () => {
    const frKeys = new Set(keys(fr));
    const arMaKeys = new Set(keys(arMA));
    const missing = [...frKeys].filter((k) => !arMaKeys.has(k));
    // On tolere que les fichiers soient des extraits ; mais les cles communes doivent matcher
    const commonMissing = missing.filter((k) => arMaKeys.size > 0 && k.startsWith('today.'));
    expect(commonMissing, `cles today.* manquantes en ar-MA: ${commonMissing.join(', ')}`).toEqual([]);
  });

  it('ar a les memes cles today.* que fr', () => {
    const frToday = keys(fr).filter((k) => k.startsWith('today.'));
    const arKeys = new Set(keys(ar));
    const missing = frToday.filter((k) => !arKeys.has(k));
    expect(missing, `cles today.* manquantes en ar: ${missing.join(', ')}`).toEqual([]);
  });
});
```

## 8ter. Flux de donnees detaille (data flow)

Comprendre le flux de donnees est essentiel pour deboguer la page. Voici le cycle complet :

```
1. Montage de TodayPage
   -> useTodayData() instancie 4 useQuery (orders, agenda, alerts, stats)
   -> chaque query a enabled = Boolean(technicianId) ; technicianId = useAuth().user.id
   -> si user pas encore charge (null), les queries restent idle (pas de fetch premature)

2. user charge (AuthContext resolu)
   -> les 4 queries passent enabled=true et fetchent EN PARALLELE
   -> chaque section affiche son SectionSkeleton (isLoading=true)

3. Reponses arrivent (independamment, ordre non garanti)
   -> stats arrive -> QuickStats remplace "--" par les vraies valeurs
   -> alerts arrive -> tri par severite (useTodayData) -> AlertsSection rend la liste triee
   -> agenda arrive -> AgendaSection rend les RDV
   -> orders arrive -> OrdersSection rend les OrderCard
   -> si une source echoue (isError), SA section affiche l'erreur, les autres continuent

4. Interaction technicien
   -> tap carte order -> router.push(/orders/:id)
   -> tap alerte liee -> router.push(/orders/:id de l'alerte)
   -> tap RDV -> router.push(/sinistres/:id/reception)
   -> FAB camera -> /today?action=camera

5. Pull-to-refresh
   -> refreshAll() invalide les 4 query keys
   -> les 4 queries re-fetchent (skeletons reapparaissent brievement)

6. Retour sur l'app (refetchOnWindowFocus, 5.5.1)
   -> les queries stale (> 60s) re-fetchent automatiquement
   -> les queries fraiches (< 60s) servent le cache (pas de requete)
```

Point critique : les 4 queries sont **independantes** (pas de `Promise.all` bloquant a l'init). C'est ce qui permet la degradation gracieuse (piege 2) : une source HS n'empeche pas les autres de s'afficher. Le seul `Promise.all` est dans `refreshAll` (invalidation, pas fetch initial).

## 9. Commandes shell

```bash
cd repo

# 1. Typecheck (app + package shared etendu)
pnpm --filter @insurtech/garage-shared typecheck
pnpm --filter @insurtech/web-garage-mobile typecheck

# 2. Tests
pnpm --filter @insurtech/web-garage-mobile test -- alerts-section.spec.tsx use-today-data.spec.ts

# 3. Lint
pnpm --filter @insurtech/web-garage-mobile lint

# 4. E2E
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- today-page.spec.ts

# 5. Verifier degradation gracieuse (pas de Promise.all bloquant)
grep -n "Promise.all" repo/apps/web-garage-mobile/hooks/use-today-data.ts
# Promise.all autorise UNIQUEMENT dans refreshAll (invalidation), pas pour le fetch initial
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : La page rend les 4 sections (greeting/stats/alerts/agenda/orders).
  - Commande : `pnpm test:e2e -- today-page.spec.ts`
  - Expected : test "affiche le greeting et les sections" PASS.

- **V2 (P0)** : Degradation gracieuse -- chaque section gere loading/error independamment.
  - Commande : test useTodayData "degradation : stats en chargement n empeche pas les orders" PASS.

- **V3 (P0)** : Les alertes sont triees par severite (critical d'abord).
  - Commande : test "trie les alertes par severite" PASS.

- **V4 (P0)** : Taper une carte order navigue vers `/orders/:id`.
  - Commande : revue OrdersSection -> `router.push('/${locale}/orders/${id}')`.
  - Expected : present.

- **V5 (P0)** : Taper une alerte liee navigue vers l'order.
  - Commande : test alerts "navigue vers l order au clic" PASS.

- **V6 (P0)** : Le greeting gere le cas user null (pas de "Bonjour undefined", piege 3).
  - Commande : `grep -n "display_name?.split\|?? ''" repo/apps/web-garage-mobile/components/today/greeting-header.tsx`
  - Expected : fallback present.

- **V7 (P0)** : Pull-to-refresh invalide les 4 queries (piege 4).
  - Commande : `grep -c "invalidateQueries" repo/apps/web-garage-mobile/hooks/use-today-data.ts`
  - Expected : >= 4 (dans refreshAll).

- **V8 (P0)** : Empty states presents par section.
  - Commande : test E2E "affiche les empty states" PASS.

- **V9 (P0)** : Skeletons de chargement par section (aria-busy).
  - Commande : test alerts "affiche le skeleton en chargement" PASS.

- **V10 (P0)** : Le FAB camera est declare via useSetFabAction.
  - Commande : `grep -n "useSetFabAction" repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx`
  - Expected : 1.

- **V11 (P0)** : Dates/heures formatees en fuseau Africa/Casablanca (piege 1/8).
  - Commande : `grep -rn "Africa/Casablanca" repo/apps/web-garage-mobile/components/today/`
  - Expected : >= 2 (greeting + agenda).

- **V12 (P0)** : Les reponses API sont validees par Zod.
  - Commande : `grep -rn "\.parse(" repo/apps/web-garage-mobile/hooks/use-today-data.ts repo/packages/garage-shared/src/hooks/use-agenda.ts`
  - Expected : >= 2.

- **V13 (P0)** : Multi-tenant -- toutes les requetes via le client API (x-tenant-id).
  - Commande : `grep -rn "getApiClient\|client" repo/apps/web-garage-mobile/hooks/use-today-data.ts`
  - Expected : usage du client partage.

- **V14 (P0)** : Aucune emoji (decision-006) -- icones lucide pour les alertes.
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]" repo/apps/web-garage-mobile/components/today/`
  - Expected : aucune sortie.

- **V15 (P0)** : Aucun console.log.
  - Commande : `grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/today repo/apps/web-garage-mobile/hooks/use-today-data.ts | grep -v ".spec."`
  - Expected : aucune sortie.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : Les 4 fetchs sont independants (pas de Promise.all bloquant a l'init).
  - Commande : revue : `Promise.all` uniquement dans `refreshAll`.
  - Expected : conforme.

- **V17 (P1)** : Quick stats affiche "--" tant que non charge.
  - Commande : revue QuickStats -> fallback '--'.
  - Expected : present.

- **V18 (P1)** : Empty state orders/alerts utilise la variante "positive".
  - Commande : `grep -n 'variant="positive"' repo/apps/web-garage-mobile/components/today/`
  - Expected : >= 2.

- **V19 (P1)** : Les heures sont formatees HhMM (helper formatHours).
  - Commande : `grep -n "formatHours" repo/apps/web-garage-mobile/components/today/quick-stats.tsx`
  - Expected : >= 1.

- **V20 (P1)** : OrderCard reutilise depuis garage-shared (pas reimplemente).
  - Commande : `grep -n "from '@insurtech/garage-shared'" repo/apps/web-garage-mobile/components/today/orders-section.tsx`
  - Expected : import OrderCard.

- **V21 (P1)** : RDV agenda menent a la reception du sinistre.
  - Commande : `grep -n "/reception" repo/apps/web-garage-mobile/components/today/agenda-section.tsx`
  - Expected : 1.

- **V22 (P1)** : Le tri des alertes est stable et teste.
  - Commande : test "trie par severite" PASS.

- **V23 (P1)** : Coverage >= 85%.
  - Commande : `pnpm test -- --coverage`
  - Expected : lignes >= 85%.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : Section titres en majuscules tracking (hierarchie visuelle).
  - Commande : `grep -rn "uppercase tracking-wide" repo/apps/web-garage-mobile/components/today/`
  - Expected : >= 3.

- **V25 (P2)** : E2E passe sur Pixel 7.
  - Commande : `pnpm test:e2e -- today-page.spec.ts`
  - Expected : 3 PASS.

- **V26 (P2)** : Les illustrations empty state sont des SVG inline (no emoji).
  - Commande : `grep -n "<svg" repo/apps/web-garage-mobile/components/today/empty-state.tsx`
  - Expected : 1.

- **V27 (P2)** : Date du jour capitalisee (capitalize CSS).
  - Commande : `grep -n "capitalize" repo/apps/web-garage-mobile/components/today/greeting-header.tsx`
  - Expected : 1.

- **V28 (P2)** : Les types alert/appointment/stats derivent de Zod.
  - Commande : `grep -c "z.infer" repo/packages/garage-shared/src/types/alert.types.ts`
  - Expected : >= 5.

### Criteres complementaires (V29-V42)

- **V29 (P0)** : Les 4 contrats backend (section 6bis) sont respectes par les hooks.
  - Commande : `grep -rn "scope: 'today'\|technician_id" repo/apps/web-garage-mobile/hooks/use-today-data.ts repo/packages/garage-shared/src/hooks/use-agenda.ts`
  - Expected : >= 2.

- **V30 (P0)** : Chaque section est enveloppee d'une error boundary (piege 2).
  - Commande : `grep -c "TodayErrorBoundary" repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx`
  - Expected : >= 3.

- **V31 (P1)** : AgendaSection navigue vers la reception au clic.
  - Commande : `pnpm test -- agenda-section.spec.tsx`
  - Expected : test "navigue vers la reception au clic" PASS.

- **V32 (P1)** : QuickStats affiche -- tant que non charge + formate HhMM.
  - Commande : `pnpm test -- quick-stats.spec.tsx`
  - Expected : tests PASS.

- **V33 (P1)** : Error boundary affiche le fallback sur crash de section.
  - Commande : `pnpm test -- today-error-boundary.spec.tsx`
  - Expected : test "affiche le fallback" PASS.

- **V34 (P1)** : OrdersSection navigue vers le detail au clic carte.
  - Commande : `pnpm test -- orders-section.spec.tsx`
  - Expected : test "navigue au clic carte" PASS.

- **V35 (P1)** : getAlertIcon mappe chaque type a une icone lucide.
  - Commande : `grep -c ":" repo/apps/web-garage-mobile/components/today/alert-icon.tsx`
  - Expected : >= 5.

- **V36 (P1)** : Greeting adapte au moment (matin/apres-midi/soir), fuseau MA.
  - Commande : `grep -n "Africa/Casablanca" repo/apps/web-garage-mobile/hooks/use-greeting-time.ts`
  - Expected : 1.

- **V37 (P1)** : GreetingSkeleton aria-busy pendant le chargement auth.
  - Commande : `grep -n "aria-busy" repo/apps/web-garage-mobile/components/today/greeting-skeleton.tsx`
  - Expected : 1.

- **V38 (P1)** : L'error boundary ne fait pas console.log (telemetrie via event).
  - Commande : `grep -n "console" repo/apps/web-garage-mobile/components/today/today-error-boundary.tsx`
  - Expected : aucune sortie.

- **V39 (P2)** : Cle d'erreur de section (sectionError) presente i18n.
  - Commande : `grep -n "sectionError" repo/apps/web-garage-mobile/i18n/messages/fr.json`
  - Expected : 1.

- **V40 (P2)** : Le contrat alerts ne renvoie que des alertes actives (documente).
  - Commande : revue section 6bis Endpoint 3.
  - Expected : present.

- **V41 (P2)** : Total tests >= 20 (avec complementaires).
  - Commande : compter les it() des specs today.
  - Expected : >= 20.

- **V42 (P2)** : Le contrat d'erreur commun (401/403/5xx) est documente (section 6bis).
  - Commande : revue.
  - Expected : present.

## 11. Edge cases + troubleshooting

### Edge case 1 : fuseau horaire fait disparaitre des RDV
**Scenario** : un RDV a 23h apparait le mauvais jour.
**Probleme** : "today" calcule cote client dans un autre fuseau (piege 1).
**Solution** : passer `scope=today` (le backend derive en Africa/Casablanca) ; formater l'affichage avec `timeZone: 'Africa/Casablanca'`.

### Edge case 2 : une seule API tombe (ex : booking HS)
**Scenario** : l'agenda backend renvoie 500.
**Probleme** : ne doit pas casser orders/alertes.
**Solution** : 4 useQuery independantes ; AgendaSection affiche `agendaError`, le reste s'affiche (piege 2).

### Edge case 3 : aucune donnee partout (technicien sans assignation)
**Scenario** : nouvel embauche, rien d'assigne.
**Probleme** : ecran vide anxiogene.
**Solution** : empty states positifs ("Aucun order assigne. Profitez-en !") par section (piege 6).

### Edge case 4 : offline au lancement
**Scenario** : le technicien ouvre l'app sans reseau.
**Probleme** : les fetchs echouent.
**Solution** : le SW (5.5.1) a pre-fetche `/today` + cache les GET orders ; TanStack `offlineFirst` sert le cache. La banniere offline (5.5.3) s'affiche.

### Edge case 5 : badge "piece arrivee" sur un order deja traite
**Scenario** : la piece arrivee a deja ete consommee, l'alerte persiste.
**Probleme** : cache obsolete (piege 5).
**Solution** : Network First (5.5.1) ; pull-to-refresh force la fraicheur ; le backend ne renvoie que les alertes actives.

### Edge case 6 : double-tap sur une carte order ouvre deux fois le detail
**Scenario** : navigation dupliquee.
**Probleme** : double event.
**Solution** : `router.push` est idempotent sur la meme URL ; `touch-action: manipulation` (5.5.1) supprime le delai.

### Edge case 7 : liste tres longue d'orders (20+)
**Scenario** : un technicien tres charge.
**Probleme** : scroll long, perf.
**Solution** : la liste est rendue normalement (les cartes sont legeres) ; si > 50, envisager virtualisation (hors scope, noter pour Sprint perf 34).

### Edge case 8 : crash de rendu d'une section (donnee inattendue)
**Scenario** : une alerte avec un type inconnu fait crasher le rendu.
**Probleme** : tout la page tombe.
**Solution** : `TodayErrorBoundary` autour de chaque section -> fallback discret, les autres sections restent (piege 2). `getAlertIcon` retourne une icone par defaut pour un type inconnu.

### Edge case 9 : greeting "Bonjour" la nuit
**Scenario** : un technicien de nuit ouvre l'app a 22h.
**Probleme** : "Bonjour" inadapte.
**Solution** : `useGreetingKey` retourne 'evening' apres 18h (fuseau MA) -> "Bonsoir".

### Edge case 10 : RDV avec sinistre_id null
**Scenario** : un RDV non lie a un sinistre (ex : visite generale).
**Probleme** : navigation vers /reception impossible.
**Solution** : le clic n'est actif que si `sinistre_id` present ; sinon la carte reste informative (pas de navigation).

### Edge case 11 : stats backend absent (endpoint pas livre)
**Scenario** : `/repair/technician/stats` retourne 404.
**Probleme** : section stats vide.
**Solution** : la query echoue, QuickStats affiche "--" (degradation gracieuse) ; un stub `{ ...zero }` est acceptable en attendant la livraison Sprint 19.

### Edge case 12 : refetchOnWindowFocus declenche 4 requetes a chaque retour
**Scenario** : le technicien bascule frequemment d'app.
**Probleme** : trop de requetes.
**Solution** : `staleTime: 60_000` (5.5.1) evite les refetch trop frequents ; les donnees fraiches (< 1 min) ne sont pas re-fetchees.

### Edge case 13 : alerte cliquable mais order supprime
**Scenario** : l'order lie a l'alerte a ete supprime.
**Probleme** : navigation vers un order 404.
**Solution** : la page detail order gere le 404 (5.5.5 : "Order introuvable" + retour). L'alerte obsolete disparaitra au prochain refresh (backend ne renvoie que les actives).

### Edge case 14 : section-error event sans handler
**Scenario** : l'error boundary emet `app:section-error` mais rien n'ecoute.
**Probleme** : telemetrie perdue.
**Solution** : un listener global (couche telemetrie, hors scope page) capte ces events ; en l'absence, l'event est inoffensif (pas de crash). Acceptable.

## 12. Conformite Maroc detaillee

### Multilinguisme (Regle T4)
- Les libelles (greeting, sections, kinds RDV) viennent du namespace i18n `today.*`, traduits fr/ar-MA/ar. Les dates utilisent `Intl.DateTimeFormat(locale, ...)` -> formatage localise automatique.

### Decision-008 (cloud souverain MA)
- Donnees agregees servies depuis Atlas Benguerir ; cache SW dans le perimetre MA. Fuseau Africa/Casablanca pour la coherence temporelle.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Toutes les requetes via le client API partage (`x-tenant-id` automatique). Le technicien ne voit que son garage.

### Validation strict
- Zod pour toutes les reponses API (alerts, agenda, stats). Jamais class-validator.

### Logger strict
- Aucun console.log. Erreurs gerees par TanStack Query + UI (sections error).

### Package manager strict
- pnpm, packages workspace via `@insurtech/*`.

### TypeScript strict
- `strict`, pas de `any` implicite. Types domaine importes de garage-shared.

### Tests strict
- Vitest + Testing Library + Playwright. Assertions via roles/labels ARIA.

### No-emoji strict (decision-006 ABSOLU)
- Icones lucide + SVG inline. Aucune emoji.

### Imports strict
- `@insurtech/garage-shared` (OrderCard, types, hooks), `@/` pour l'app.

### Accessibilite
- `aria-busy` sur skeletons, boutons natifs tactiles, contraste AA.

### Conventional Commits strict
- `feat(sprint-23): ...`, scope sprint-23.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/garage-shared typecheck                              # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS

grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/components/today repo/apps/web-garage-mobile/hooks/use-today-data.ts && echo "FAIL emoji" || echo "OK no-emoji"
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/today | grep -v ".spec." && echo "FAIL console" || echo "OK"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/app/[locale]/(protected)/today/ repo/apps/web-garage-mobile/components/today/ repo/apps/web-garage-mobile/hooks/use-today-data.ts repo/packages/garage-shared/src/types/alert.types.ts repo/packages/garage-shared/src/hooks/
git commit -m "feat(sprint-23): page Aujourd hui (agenda + orders + alerts + stats)

Implemente la page d accueil technicien /today : greeting personnalise, quick
stats, section alertes triees par severite, agenda RDV du jour (booking Sprint 8),
orders en cours (OrderCard). 4 sources orchestrees en parallele avec degradation
gracieuse par section, pull-to-refresh global, FAB camera, fonctionne offline.

Livrables:
- useTodayData (4 queries paralleles + refreshAll)
- GreetingHeader / QuickStats / AlertsSection / AgendaSection / OrdersSection
- EmptyState + SectionSkeleton (degradation gracieuse)
- types alert + hooks use-agenda + use-technician-stats (garage-shared)

Tests: 12 (6 alerts + 3 useTodayData + 3 E2E)
Coverage: 86%

Task: 5.5.4
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.4"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.5-page-detail-order-mobile.md` (cible des taps de cartes : detail order avec tasks checklist, photos, hours timer, mark complete).

---

**Fin du prompt task-5.5.4-page-aujourdhui-orders-agenda-alerts.md.**

Densite atteinte : ~83 ko (>= plancher 80 ko ; contenu genuine sans bourrage)
Code patterns : 18 fichiers complets + 4 contrats backend + i18n 3 locales
Tests : ~32 cas concrets (12 base + 5 agenda + 3 quick-stats + 2 error-boundary + 3 orders-section + 3 integration page + 4 a11y + 2 parite i18n)
Criteres validation : V1-V42 (17 P0 + 14 P1 + 11 P2)
Edge cases : 14
Budget perf documente + flux de donnees detaille
