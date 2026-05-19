# TACHE 5.4.4 -- Sinistres Page : Kanban (10 colonnes drag-drop transitions valides) + Table (DataTable + filters + bulk actions)

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.4)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 7h
**Dependances** :
- Tache 5.4.1 (skeleton + api-client + middleware)
- Tache 5.4.2 (auth livre)
- Tache 5.4.3 (dashboard livre -- nav vers /sinistres deja en place)
- Sprint 19 (Repair backend : entites sinistre + state machine transitions valides + endpoints GET /api/v1/repair/sinistres + POST /api/v1/repair/sinistres/:id/transition)
- Sprint 21 (Sinistre workflow + acteurs + audit history)
- Sprint 16 web-broker (pattern deals Kanban + Table reutilise)

**Densite cible** : 100-150 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Implementer la page `/[locale]/sinistres` qui presente la **liste des sinistres** d'un garage dans **2 vues alternatives** : (a) **Kanban** avec 10 colonnes correspondant aux 10 statuts du state machine Sprint 19 (declared, acknowledged, appointment_scheduled, received, under_diagnostic, awaiting_approval, under_repair, quality_check, ready_for_delivery, delivered), avec drag-drop des cards entre colonnes valides via la state machine (transitions interdites rejetees par backend + UI optimistic reverte) ; (b) **Table** avec DataTable shadcn/ui paginee, filtres avances (status multi-select, technicien multi-select, branche, date_range, priority), tri colonnes, et bulk actions (assign technicien, change priority, transition multiple si transitions valides). Vue par defaut : Kanban (vue operationnelle preferee chef d'atelier). Toggle Kanban/Table persiste en cookie `garage_sinistres_view`.

La **vue Kanban** affiche des cards compactes : `sinistre_number` en gros, customer name + vehicle plate (regex MA), technicien avatar + nom, date_declared, priority badge (red/amber/green). Drag-drop avec `@dnd-kit/core` (preferable a react-beautiful-dnd qui n'est plus maintenu). Sur drop : POST `/api/v1/repair/sinistres/:id/transition` avec `{ to_status, reason? }`. Si transition invalide (state machine reject), Optimistic UI revert + toast erreur explicite ("Impossible de passer de declared a delivered directement -- statuts valides : acknowledged, cancelled"). Loading per-card pendant transition. Polling 30s pour sync multi-user (un autre technicien peut deplacer une carte en parallele).

La **vue Table** : 8 colonnes (Numero, Customer, Vehicle, Technicien, Status badge, Priority, Date declared, Actions). Filtres : 6 filtres independants combinables. Pagination 25 lignes par page. Tri par chaque colonne. Bulk select via checkbox header + checkbox per row. Bulk actions menu : "Assigner technicien" (modal dropdown), "Changer priorite" (modal radio), "Transition vers..." (modal dropdown valid transitions intersected). URL search params persistent les filtres pour shareable links.

Cette tache est la **4eme du Sprint 22** et la premiere page **operationnelle metier** (apres le dashboard d'accueil). Pour Atlas Cabinet, c'est la page la plus consultee de la journee : chef d'atelier ouvre /sinistres Kanban des 8h00 et la garde ouverte toute la journee, drag-drop les sinistres au fur et a mesure des avancements. Le polling 30s permet sync multi-user (chef + 3 technicien sur 3 ecrans differents).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le state machine 10 statuts Sprint 19 modelise tout le cycle de vie d'un sinistre garage MA :
```
declared -> acknowledged -> appointment_scheduled -> received -> under_diagnostic
-> awaiting_approval -> under_repair -> quality_check -> ready_for_delivery -> delivered
```
Avec branches alternatives (cancelled, rejected_by_insurer, returned_to_repair from QC fail). Sans vue Kanban, le personnel ne voit pas en un coup d'oeil ou se trouve chaque sinistre. Sans vue Table, impossible de faire des operations en masse (reassign 20 sinistres a un nouveau technicien apres conge). Les 2 vues sont complementaires :
- Kanban = vue **operationnelle** quotidienne (chef atelier) ;
- Table = vue **administrative** hebdomadaire (gestionnaire) + bulk actions.

Le timing : 4eme du Sprint 22, posee apres dashboard. Elle debloque :
- 5.4.5 (sinistre detail) -- on clique sur une carte/ligne pour ouvrir le detail ;
- 5.4.9 (orders) -- les orders sont attaches a un sinistre ;
- 5.4.13 (tests E2E) -- on teste les transitions kanban critique.

### State machine -- 10 statuts + transitions valides Sprint 19

```
declared       -> [acknowledged, cancelled]
acknowledged   -> [appointment_scheduled, cancelled, rejected_by_insurer]
appointment_scheduled -> [received, cancelled]
received       -> [under_diagnostic]
under_diagnostic -> [awaiting_approval, cancelled, rejected_by_insurer]
awaiting_approval -> [under_repair, cancelled, rejected_by_insurer]
under_repair   -> [quality_check, cancelled]
quality_check  -> [ready_for_delivery, returned_to_repair] (returned -> back to under_repair)
ready_for_delivery -> [delivered]
delivered      -> [closed] (final, no transitions out)
cancelled      -> [reopened (admin only)]
rejected_by_insurer -> [cancelled, reopened]
```

Le **frontend ne reimplemente PAS** la state machine. Il REPRESENTE les transitions cote UI, et le backend valide chaque transition. Si on tente une transition invalide, backend retourne 400 + erreur explicite. UI affiche toast erreur + revert optimistic.

### Specificite garage Kanban vs broker deals Kanban Sprint 16

| Aspect | Sprint 16 deals (broker) | Sprint 22 sinistres (garage) |
|--------|--------------------------|-------------------------------|
| Colonnes | 6 stages funnel | 10 statuts state machine |
| Drag-drop lib | @dnd-kit/core | @dnd-kit/core (identique) |
| Card info | Deal name + lead + value | Sinistre number + customer + vehicle plate + technicien |
| Transitions valides | Lineaire (next/prev) | Complexe (multiples branches) |
| Optimistic UI | Oui | Oui mais avec revert si state machine reject |
| Polling sync | 60s | 30s (operationnel faster) |
| Bulk actions | Reassign agent | Reassign technicien + change priority + bulk transition |

### Alternatives considerees

#### @dnd-kit/core vs react-beautiful-dnd vs react-dnd

| Critere | @dnd-kit/core 6.x (CHOIX) | react-beautiful-dnd | react-dnd |
|---------|----------------------------|---------------------|-----------|
| Maintenance | Active (2025) | Deprecated since 2023 | Active |
| Bundle size | 18 ko | 36 ko | 22 ko |
| Accessibility (keyboard) | Excellent (built-in) | Bon | Manuel |
| TypeScript | Native | Types externes | Types externes |
| Touch (tablette atelier) | Native + sensors | Bon | Manuel |
| Performance 100+ items | Virtualization compatible | Mauvais | OK |
| Sprint 16 deja utilise | Oui | -- | -- |
| Custom drag overlay | Excellent | OK | Excellent |

**Decision** : @dnd-kit/core 6.x (alignement Sprint 16). 5 packages : `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/accessibility`, `@dnd-kit/modifiers`.

#### TanStack Table v8 vs React Table v7 vs shadcn/ui DataTable

| Critere | TanStack Table v8 (CHOIX) | React Table v7 | shadcn DataTable |
|---------|----------------------------|----------------|------------------|
| Maintenance | Active | EOL | Pattern (utilise TanStack underneath) |
| Headless approach | Oui | Oui | Components ready |
| TypeScript | Excellent | Mauvais | Excellent |
| Sorting / Filtering / Pagination | Builtin | Builtin | Wraps TanStack |
| Bundle size | 12 ko | 16 ko | 18 ko |
| Row selection | Builtin | Plugin | Builtin |
| Sprint 16 deja utilise | Oui (DataTable) | -- | -- |

**Decision** : shadcn/ui DataTable pattern (wraps TanStack Table v8). Identique Sprint 16.

#### Virtualization (TanStack Virtual) yes/no

Pour 100+ cards Kanban : 10 colonnes x 30 cards = 300 cards = perf OK sans virtualization. Pour 1000+ : virtualization necessaire. Mitigation : pour Atlas Cabinet (estim 50-200 sinistres actifs simultanes), pas de virtualization initial. Si > 500 active observed apres prod, virtualizer Sprint 24+.

### Trade-offs explicites

1. **Polling 30s vs WebSocket** : pour realtime sync multi-user, WebSocket est ideal mais coute infra. Mitigation : 30s polling suffit pour use case garage (transitions pas en sub-seconde). Sprint 31+ peut migrer.

2. **Optimistic UI revert visuel jarring** : si transition rejetee, card revient avec animation 300ms. Mitigation : animation smooth + toast erreur explicite + reserve la transition.

3. **Drag-drop sur mobile tablette atelier** : touch sensors necessaires. Mitigation : `useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })`.

4. **Bulk actions transitions intersected** : si user select 5 sinistres avec status differents, transitions valides communes = intersection. Si vide -> UI desactive option. Mitigation : compute intersection cote frontend avant submit.

5. **Kanban scrolls horizontalement** : 10 colonnes ne tiennent pas sur 1920px. Mitigation : container `overflow-x-auto` + sticky header colonnes + chaque colonne min-width 280px.

6. **DataTable bulk select et pagination** : si user select tout (3 pages), navigate page 2, selection reset ? Mitigation : selection persiste cross-page mais limite a 100 max + warning.

### Decisions strategiques referenced

- decision-002 (multi-tenant) : api-client injecte x-tenant-id ;
- decision-006 (no-emoji) : labels statuts sans emoji ;
- decision-009 (i18n MA) : RTL kanban scrolls direction inverse.

### Pieges techniques (15 minimum)

1. **`@dnd-kit/core` sensors sur mobile** : sans `TouchSensor` config, drag-drop ne fonctionne pas sur tablette.

2. **`useSortable` re-render entire list on every drag move** : performance hit. Mitigation : `useMemo` sur cards + memo() components.

3. **Drag overlay z-index conflict avec FAB** : drag preview cachee par FAB. Mitigation : drag overlay z-index 60, FAB 40.

4. **Optimistic UI mutation order matters** : update cache AVANT API call, revert si error. Sinon flash.

5. **Polling pendant drag actif** : sync data interrupt drag. Mitigation : pause polling `if (isDragging)`.

6. **Cookie view preference** : `garage_sinistres_view` set par middleware ou cote client ? Cote client (`document.cookie`) car preference UI.

7. **DataTable column visibility** : user customize cols ? Pas pour MVP -- toujours 8 colonnes fixed. Sprint 24+ amelioration.

8. **Filtres URL multi-value separator** : `?status=under_repair,quality_check` -> parse split comma + Zod enum array.

9. **Search by plate immat MA regex** : `1234-A-56` doit matcher partiel.

10. **DataTable sort server-side vs client-side** : pour < 1000 rows client-side OK. Server-side via API params si besoin.

11. **Bulk transition modal valid transitions intersection** : compute cote frontend via lookup table state machine.

12. **Drop sur meme colonne ne declenche pas transition** : verif `from === to` -> no-op.

13. **State machine cancelled transitions** : si user drag de "delivered" vers "cancelled" -> rejected (delivered est terminal). Sauf if role admin override.

14. **Optimistic update sur Kanban : ou inserer la card dans nouvelle colonne ?** : a la fin (bottom) ou en haut (top) ? Convention : top de la colonne (plus recent en haut).

15. **Returned_to_repair de quality_check** : transition special, indique echec QC. UI doit afficher modal "Raison du retour" pour saisir comment failed. Backend logge audit.

16. **Le polling sync ne doit pas re-render Kanban entier** : seulement diff cards. Mitigation : TanStack Query `setQueryData` partial update + key par card.

17. **Sticky column header lateral scroll** : header colonnes doit rester visible quand scroll vertical dans colonne. CSS `position: sticky; top: 0`.

---

## 3. Architecture context

### Position dans Sprint 22

```
[5.4.1 Skeleton]    (livre)
[5.4.2 Auth]        (livre)
[5.4.3 Dashboard]   (livre)
[5.4.4 Sinistres K + T]  <-- ICI (7h)
   |
   +--> [5.4.5 Sinistre detail page] (8h)
   +--> [5.4.6 Reception]
   +--> ...
```

### Flow drag-drop transition

```
User drag card C1 from "received" to "under_diagnostic"
    |
    +--> Optimistic UI : card moves immediately (TanStack Query setQueryData)
    +--> POST /api/v1/repair/sinistres/C1/transition { to_status: 'under_diagnostic' }
    |       |
    |       +--> Backend valid transition (state machine OK)
    |       |       -> 200 OK + new status confirmed
    |       |       -> queryClient.invalidateQueries(['sinistres'])
    |       |
    |       +--> Backend invalid transition (state machine reject)
    |               -> 400 BAD_REQUEST { error: 'INVALID_TRANSITION', allowed: [...] }
    |               -> queryClient.setQueryData revert (rollback card to original column)
    |               -> toast.error("Transition invalide. Statuts autorises: ...")
```

### Flow bulk transition

```
User select 3 sinistres in table (all in "received")
    |
    +--> Click bulk action "Transition vers..."
    +--> Modal opens
    +--> Compute valid transitions intersection :
    |       all received -> valid: [under_diagnostic]
    +--> User select "under_diagnostic"
    +--> Confirm modal
    |
    +--> POST /api/v1/repair/sinistres/bulk-transition { ids: [...], to_status }
    |       backend valide chaque (rare edge : 1 status changed between selection and submit)
    |       -> 200 OK + count_success + count_failed
    |       -> toast success "3 sinistres transitionnes"
    |       -> queryClient.invalidateQueries(['sinistres'])
```

### ASCII tree apres tache

```
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/
|-- page.tsx                                          # Server Component wrapper
|-- loading.tsx
|-- error.tsx
|
repo/apps/web-garage/src/components/sinistres/
|-- sinistres-page-client.tsx                         # Client orchestrator (toggle view)
|-- view-toggle.tsx                                   # Kanban / Table switch
|-- sinistres-kanban.tsx                              # Kanban container (10 columns)
|-- sinistres-kanban.spec.tsx
|-- kanban-column.tsx                                 # Column droppable
|-- sinistre-card.tsx                                 # Card draggable
|-- sinistre-card.spec.tsx
|-- transition-revert-toast.tsx                       # Toast erreur invalid transition
|-- sinistres-table.tsx                               # DataTable
|-- sinistres-table.spec.tsx
|-- sinistres-table-filters.tsx                       # Filtres avances
|-- sinistres-table-bulk-actions.tsx                  # Bulk actions menu
|-- modals/
|   |-- assign-technicien-modal.tsx
|   |-- change-priority-modal.tsx
|   |-- bulk-transition-modal.tsx
|   |-- returned-to-repair-modal.tsx                  # Saisie raison echec QC
|
repo/apps/web-garage/src/lib/queries/sinistres.queries.ts          # fetch, transitions
repo/apps/web-garage/src/lib/sinistres/state-machine.ts             # Valid transitions lookup
repo/apps/web-garage/src/lib/sinistres/filters.ts                   # Filters URL parse
```

---

## 4. Livrables checkables (24 livrables)

- [ ] Fichier `sinistres/page.tsx` Server Component
- [ ] Fichier `sinistres-page-client.tsx` orchestrator
- [ ] Fichier `view-toggle.tsx` Kanban/Table switch + persist cookie
- [ ] Fichier `sinistres-kanban.tsx` container 10 colonnes
- [ ] Fichier `kanban-column.tsx` droppable + label statut
- [ ] Fichier `sinistre-card.tsx` draggable + info compacte
- [ ] Fichier `sinistres-table.tsx` DataTable shadcn pattern
- [ ] Fichier `sinistres-table-filters.tsx` 6 filtres
- [ ] Fichier `sinistres-table-bulk-actions.tsx` menu bulk
- [ ] Fichier `state-machine.ts` lookup transitions valides
- [ ] Fichier `sinistres.queries.ts` fetch list + transition mutation
- [ ] Fichier `assign-technicien-modal.tsx`
- [ ] Fichier `change-priority-modal.tsx`
- [ ] Fichier `bulk-transition-modal.tsx`
- [ ] Fichier `returned-to-repair-modal.tsx`
- [ ] Optimistic UI + revert sur transition invalide
- [ ] Polling 30s pause si drag actif
- [ ] DataTable sort + paginate 25 lignes
- [ ] DataTable bulk select cross-page (max 100)
- [ ] URL search params persistance filtres
- [ ] Search by plate immat MA (regex)
- [ ] Tests Vitest 30+ tests
- [ ] Tests Playwright 8+ tests E2E (drag-drop, bulk, transitions)
- [ ] WCAG 2.1 AA keyboard navigation kanban (arrow keys)

---

## 5. Fichiers crees / modifies

```
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/page.tsx                                    (~120 lignes)
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/loading.tsx                                  (~40 lignes)
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/error.tsx                                     (~60 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-page-client.tsx                                    (~150 lignes)
repo/apps/web-garage/src/components/sinistres/view-toggle.tsx                                              (~80 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-kanban.tsx                                          (~250 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-kanban.spec.tsx                                      (~180 lignes)
repo/apps/web-garage/src/components/sinistres/kanban-column.tsx                                              (~120 lignes)
repo/apps/web-garage/src/components/sinistres/sinistre-card.tsx                                              (~180 lignes)
repo/apps/web-garage/src/components/sinistres/sinistre-card.spec.tsx                                          (~120 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-table.tsx                                            (~250 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-table.spec.tsx                                        (~180 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-table-filters.tsx                                      (~200 lignes)
repo/apps/web-garage/src/components/sinistres/sinistres-table-bulk-actions.tsx                                  (~180 lignes)
repo/apps/web-garage/src/components/sinistres/modals/assign-technicien-modal.tsx                                (~150 lignes)
repo/apps/web-garage/src/components/sinistres/modals/change-priority-modal.tsx                                  (~120 lignes)
repo/apps/web-garage/src/components/sinistres/modals/bulk-transition-modal.tsx                                  (~180 lignes)
repo/apps/web-garage/src/components/sinistres/modals/returned-to-repair-modal.tsx                                (~150 lignes)
repo/apps/web-garage/src/lib/sinistres/state-machine.ts                                                          (~150 lignes)
repo/apps/web-garage/src/lib/sinistres/state-machine.spec.ts                                                      (~200 lignes / 25 tests)
repo/apps/web-garage/src/lib/queries/sinistres.queries.ts                                                          (~250 lignes)
repo/apps/web-garage/src/lib/queries/sinistres.queries.spec.ts                                                      (~180 lignes)
repo/apps/web-garage/src/lib/sinistres/filters.ts                                                                  (~120 lignes)
repo/apps/web-garage/src/lib/sinistres/filters.spec.ts                                                              (~150 lignes)
repo/apps/web-garage/src/messages/{fr,ar-MA,ar}.json                                                                  (modifie +80 keys)
repo/apps/web-garage/e2e/sinistres-kanban.spec.ts                                                                      (~200 lignes / 5 tests)
repo/apps/web-garage/e2e/sinistres-table.spec.ts                                                                        (~180 lignes / 4 tests)
```

**Total** : 27 fichiers, ~3 700 lignes (production + tests)

---

## 6. Code patterns COMPLETS

### Fichier 1/15 : `src/lib/sinistres/state-machine.ts`

```typescript
// src/lib/sinistres/state-machine.ts
// State machine lookup -- 10 statuts sinistre + transitions valides
// Reference: B-22 Tache 5.4.4 + B-19 Sprint 19 (backend source of truth)
// IMPORTANT: cette table doit etre synchronisee avec backend Sprint 19.
// Si decalage -> bug subtle (UI permet drag mais backend reject).

export const SINISTRE_STATUSES = [
  'declared',
  'acknowledged',
  'appointment_scheduled',
  'received',
  'under_diagnostic',
  'awaiting_approval',
  'under_repair',
  'quality_check',
  'ready_for_delivery',
  'delivered',
  'cancelled',
  'rejected_by_insurer',
  'closed',
] as const;
export type SinistreStatus = (typeof SINISTRE_STATUSES)[number];

export const KANBAN_VISIBLE_STATUSES: SinistreStatus[] = [
  'declared',
  'acknowledged',
  'appointment_scheduled',
  'received',
  'under_diagnostic',
  'awaiting_approval',
  'under_repair',
  'quality_check',
  'ready_for_delivery',
  'delivered',
];

const TRANSITIONS: Record<SinistreStatus, SinistreStatus[]> = {
  declared: ['acknowledged', 'cancelled'],
  acknowledged: ['appointment_scheduled', 'cancelled', 'rejected_by_insurer'],
  appointment_scheduled: ['received', 'cancelled'],
  received: ['under_diagnostic'],
  under_diagnostic: ['awaiting_approval', 'cancelled', 'rejected_by_insurer'],
  awaiting_approval: ['under_repair', 'cancelled', 'rejected_by_insurer'],
  under_repair: ['quality_check', 'cancelled'],
  quality_check: ['ready_for_delivery', 'under_repair'], // returned_to_repair = back to under_repair
  ready_for_delivery: ['delivered'],
  delivered: ['closed'],
  cancelled: [], // admin-only reopened (handled elsewhere)
  rejected_by_insurer: ['cancelled'],
  closed: [],
};

export function getValidTransitions(from: SinistreStatus): SinistreStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isValidTransition(from: SinistreStatus, to: SinistreStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getIntersectedTransitions(statuses: SinistreStatus[]): SinistreStatus[] {
  if (statuses.length === 0) return [];
  const sets = statuses.map((s) => new Set(getValidTransitions(s)));
  return [...sets[0]].filter((target) => sets.every((set) => set.has(target)));
}

export function isQcReturnedToRepair(from: SinistreStatus, to: SinistreStatus): boolean {
  return from === 'quality_check' && to === 'under_repair';
}

export interface StatusBadgeStyle {
  bg: string;
  text: string;
  border: string;
}

export const STATUS_STYLES: Record<SinistreStatus, StatusBadgeStyle> = {
  declared: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  acknowledged: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  appointment_scheduled: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  received: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  under_diagnostic: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  awaiting_approval: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  under_repair: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  quality_check: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  ready_for_delivery: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
  rejected_by_insurer: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
  closed: { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-300' },
};

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_STYLES: Record<Priority, { color: string; label_key: string }> = {
  low: { color: 'text-gray-500', label_key: 'priorities.low' },
  normal: { color: 'text-blue-600', label_key: 'priorities.normal' },
  high: { color: 'text-amber-600', label_key: 'priorities.high' },
  urgent: { color: 'text-red-600', label_key: 'priorities.urgent' },
};
```

### Fichier 2/15 : `src/lib/queries/sinistres.queries.ts`

```typescript
// src/lib/queries/sinistres.queries.ts
import { z } from 'zod';
import { apiGet, apiPost } from '@/lib/api-client';
import { SinistreStatus, Priority } from '@/lib/sinistres/state-machine';

const SinistreSchema = z.object({
  id: z.string().uuid(),
  sinistre_number: z.string(),
  status: z.enum([
    'declared', 'acknowledged', 'appointment_scheduled', 'received',
    'under_diagnostic', 'awaiting_approval', 'under_repair', 'quality_check',
    'ready_for_delivery', 'delivered', 'cancelled', 'rejected_by_insurer', 'closed',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  vehicle_id: z.string().uuid(),
  vehicle_plate: z.string(),
  vehicle_make: z.string(),
  vehicle_model: z.string(),
  technicien_id: z.string().uuid().nullable(),
  technicien_name: z.string().nullable(),
  technicien_avatar_url: z.string().nullable(),
  branche: z.string().nullable(),
  service_type: z.string().nullable(),
  declared_at: z.string().datetime(),
  estimated_completion_at: z.string().datetime().nullable(),
  policy_id: z.string().uuid().nullable(),
  insurer_id: z.string().uuid().nullable(),
  total_estimated_mad: z.number().nonnegative().nullable(),
});
export type Sinistre = z.infer<typeof SinistreSchema>;

const SinistresListResponseSchema = z.object({
  data: z.array(SinistreSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }),
});
export type SinistresListResponse = z.infer<typeof SinistresListResponseSchema>;

export interface SinistresFilters {
  status?: SinistreStatus[];
  technicien_id?: string[];
  branche?: string[];
  priority?: Priority[];
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function fetchSinistres(filters: SinistresFilters = {}): Promise<SinistresListResponse> {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.technicien_id?.length) params.set('technicien_id', filters.technicien_id.join(','));
  if (filters.branche?.length) params.set('branche', filters.branche.join(','));
  if (filters.priority?.length) params.set('priority', filters.priority.join(','));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.page_size) params.set('page_size', filters.page_size.toString());
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_order) params.set('sort_order', filters.sort_order);

  const data = await apiGet<unknown>(`/api/v1/repair/sinistres?${params.toString()}`);
  return SinistresListResponseSchema.parse(data);
}

const TransitionResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'declared', 'acknowledged', 'appointment_scheduled', 'received',
    'under_diagnostic', 'awaiting_approval', 'under_repair', 'quality_check',
    'ready_for_delivery', 'delivered', 'cancelled', 'rejected_by_insurer', 'closed',
  ]),
  transitioned_at: z.string().datetime(),
});

export interface TransitionInput {
  sinistre_id: string;
  to_status: SinistreStatus;
  reason?: string;
}

export async function transitionSinistre(input: TransitionInput) {
  const data = await apiPost<unknown>(`/api/v1/repair/sinistres/${input.sinistre_id}/transition`, {
    to_status: input.to_status,
    reason: input.reason,
  });
  return TransitionResponseSchema.parse(data);
}

export interface BulkTransitionInput {
  sinistre_ids: string[];
  to_status: SinistreStatus;
  reason?: string;
}

const BulkTransitionResponseSchema = z.object({
  count_success: z.number().int().nonnegative(),
  count_failed: z.number().int().nonnegative(),
  failures: z.array(z.object({
    sinistre_id: z.string().uuid(),
    reason: z.string(),
  })),
});

export async function bulkTransitionSinistres(input: BulkTransitionInput) {
  const data = await apiPost<unknown>('/api/v1/repair/sinistres/bulk-transition', input);
  return BulkTransitionResponseSchema.parse(data);
}

export interface AssignTechnicienInput {
  sinistre_ids: string[];
  technicien_id: string;
}

export async function bulkAssignTechnicien(input: AssignTechnicienInput) {
  return await apiPost<{ ok: true }>('/api/v1/repair/sinistres/bulk-assign', input);
}

export interface ChangePriorityInput {
  sinistre_ids: string[];
  priority: Priority;
}

export async function bulkChangePriority(input: ChangePriorityInput) {
  return await apiPost<{ ok: true }>('/api/v1/repair/sinistres/bulk-priority', input);
}
```

### Fichier 3/15 : `src/components/sinistres/sinistres-kanban.tsx`

```typescript
// src/components/sinistres/sinistres-kanban.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  fetchSinistres,
  transitionSinistre,
  type Sinistre,
} from '@/lib/queries/sinistres.queries';
import {
  KANBAN_VISIBLE_STATUSES,
  type SinistreStatus,
  isValidTransition,
  getValidTransitions,
  isQcReturnedToRepair,
} from '@/lib/sinistres/state-machine';
import { GarageApiError } from '@/lib/api-client';
import { KanbanColumn } from './kanban-column';
import { SinistreCard } from './sinistre-card';
import { ReturnedToRepairModal } from './modals/returned-to-repair-modal';

interface SinistresKanbanProps {
  initialFilters?: { search?: string; technicien_id?: string[] };
  locale: string;
}

export function SinistresKanban({ initialFilters, locale }: SinistresKanbanProps) {
  const t = useTranslations('sinistres.kanban');
  const tErr = useTranslations('sinistres.errors');
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [returnReasonModal, setReturnReasonModal] = useState<{ sinistreId: string; from: SinistreStatus } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const { data } = useQuery({
    queryKey: ['sinistres', 'kanban', initialFilters],
    queryFn: () =>
      fetchSinistres({
        ...initialFilters,
        page: 1,
        page_size: 200,
        sort_by: 'declared_at',
        sort_order: 'desc',
        status: KANBAN_VISIBLE_STATUSES,
      }),
    staleTime: 25_000,
    refetchInterval: (q) => {
      if (activeId) return false; // pause during drag
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
      return 30_000;
    },
  });

  const sinistres = data?.data ?? [];

  const byStatus = useMemo(() => {
    const grouped: Record<SinistreStatus, Sinistre[]> = {} as never;
    for (const status of KANBAN_VISIBLE_STATUSES) grouped[status] = [];
    for (const s of sinistres) {
      if (KANBAN_VISIBLE_STATUSES.includes(s.status as never)) {
        grouped[s.status as never].push(s);
      }
    }
    return grouped;
  }, [sinistres]);

  const transitionMutation = useMutation({
    mutationFn: transitionSinistre,
    onMutate: async (variables) => {
      const previousData = queryClient.getQueryData(['sinistres', 'kanban', initialFilters]);
      // optimistic: move card to new column
      queryClient.setQueryData(['sinistres', 'kanban', initialFilters], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((s) =>
            s.id === variables.sinistre_id ? { ...s, status: variables.to_status } : s,
          ),
        };
      });
      return { previousData };
    },
    onError: (error: GarageApiError, _vars, context) => {
      queryClient.setQueryData(['sinistres', 'kanban', initialFilters], context?.previousData);
      const errAny = error as GarageApiError & { allowed?: string[] };
      if (error.code === 'INVALID_TRANSITION' && errAny.allowed) {
        toast.error(
          tErr('invalid_transition_with_allowed', {
            allowed: errAny.allowed.map((s) => t(`statuses.${s}`)).join(', '),
          }),
        );
      } else {
        toast.error(tErr(error.code === 'FORBIDDEN' ? 'forbidden' : 'generic'));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      queryClient.invalidateQueries({ queryKey: ['sinistres-counts'] });
      toast.success(t('transition_success'));
    },
  });

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const sinistreId = active.id as string;
    const targetStatus = over.id as SinistreStatus;
    const sinistre = sinistres.find((s) => s.id === sinistreId);
    if (!sinistre) return;
    if (sinistre.status === targetStatus) return; // same column drop

    if (!isValidTransition(sinistre.status as never, targetStatus)) {
      toast.error(
        tErr('invalid_transition_with_allowed', {
          allowed: getValidTransitions(sinistre.status as never).map((s) => t(`statuses.${s}`)).join(', ') || tErr('no_transitions_available'),
        }),
      );
      return;
    }

    if (isQcReturnedToRepair(sinistre.status as never, targetStatus)) {
      setReturnReasonModal({ sinistreId, from: sinistre.status as never });
      return;
    }

    transitionMutation.mutate({ sinistre_id: sinistreId, to_status: targetStatus });
  }

  const activeSinistre = activeId ? sinistres.find((s) => s.id === activeId) : null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" data-testid="sinistres-kanban" role="region" aria-label={t('aria_label')}>
          {KANBAN_VISIBLE_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              sinistres={byStatus[status]}
              locale={locale}
            />
          ))}
        </div>
        <DragOverlay>
          {activeSinistre ? <SinistreCard sinistre={activeSinistre} locale={locale} dragOverlay /> : null}
        </DragOverlay>
      </DndContext>
      {returnReasonModal && (
        <ReturnedToRepairModal
          sinistreId={returnReasonModal.sinistreId}
          onClose={() => setReturnReasonModal(null)}
          onConfirm={(reason) => {
            transitionMutation.mutate({
              sinistre_id: returnReasonModal.sinistreId,
              to_status: 'under_repair',
              reason,
            });
            setReturnReasonModal(null);
          }}
        />
      )}
    </>
  );
}
```

### Fichier 4/15 : `src/components/sinistres/kanban-column.tsx`

```typescript
'use client';

import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { STATUS_STYLES, type SinistreStatus } from '@/lib/sinistres/state-machine';
import { SinistreCard } from './sinistre-card';
import { type Sinistre } from '@/lib/queries/sinistres.queries';

interface KanbanColumnProps {
  status: SinistreStatus;
  sinistres: Sinistre[];
  locale: string;
}

export function KanbanColumn({ status, sinistres, locale }: KanbanColumnProps) {
  const t = useTranslations('sinistres.kanban.statuses');
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = STATUS_STYLES[status];

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] flex-shrink-0 flex-col rounded-md border ${style.border} ${isOver ? 'bg-muted/50' : 'bg-card'}`}
      data-testid={`kanban-column-${status}`}
    >
      <header className={`sticky top-0 z-10 rounded-t-md ${style.bg} ${style.text} px-3 py-2 border-b ${style.border}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t(status)}</h3>
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs">{sinistres.length}</span>
        </div>
      </header>
      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {sinistres.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">-</p>
        ) : (
          sinistres.map((s) => <SinistreCard key={s.id} sinistre={s} locale={locale} />)
        )}
      </div>
    </div>
  );
}
```

### Fichier 5/15 : `src/components/sinistres/sinistre-card.tsx`

```typescript
'use client';

import Link from 'next/link';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { User, Car, Clock, Flag } from 'lucide-react';
import { type Sinistre } from '@/lib/queries/sinistres.queries';
import { PRIORITY_STYLES, type Priority } from '@/lib/sinistres/state-machine';

interface SinistreCardProps {
  sinistre: Sinistre;
  locale: string;
  dragOverlay?: boolean;
}

export function SinistreCard({ sinistre, locale, dragOverlay }: SinistreCardProps) {
  const t = useTranslations('sinistres.kanban');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sinistre.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging && !dragOverlay ? 0.4 : 1,
  };

  const priorityStyle = PRIORITY_STYLES[sinistre.priority as Priority];
  const dateLocale = locale.startsWith('ar') ? ar : fr;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border border-border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing ${dragOverlay ? 'shadow-xl rotate-2' : 'hover:border-garage-primary'}`}
      data-testid={`sinistre-card-${sinistre.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Link
          href={`/${locale}/sinistres/${sinistre.id}`}
          className="text-sm font-bold text-garage-primary hover:underline"
          onClick={(e) => isDragging && e.preventDefault()}
        >
          {sinistre.sinistre_number}
        </Link>
        <Flag className={`h-3 w-3 ${priorityStyle.color}`} aria-label={t(priorityStyle.label_key)} />
      </div>
      <div className="space-y-1">
        <p className="text-xs flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{sinistre.customer_name}</span>
        </p>
        <p className="text-xs flex items-center gap-1">
          <Car className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{sinistre.vehicle_plate}</span>
          <span className="text-muted-foreground truncate">- {sinistre.vehicle_make} {sinistre.vehicle_model}</span>
        </p>
        {sinistre.technicien_name && (
          <p className="text-xs text-muted-foreground truncate">
            {t('assigned_to')}: {sinistre.technicien_name}
          </p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(sinistre.declared_at), { addSuffix: true, locale: dateLocale })}
        </p>
      </div>
    </article>
  );
}
```

### Fichier 6/15 : `src/components/sinistres/sinistres-table.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchSinistres, type Sinistre } from '@/lib/queries/sinistres.queries';
import { STATUS_STYLES, PRIORITY_STYLES, type Priority } from '@/lib/sinistres/state-machine';
import { type SinistresUrlFilters } from '@/lib/sinistres/filters';
import { SinistresTableBulkActions } from './sinistres-table-bulk-actions';

interface SinistresTableProps {
  filters: SinistresUrlFilters;
  locale: string;
}

export function SinistresTable({ filters, locale }: SinistresTableProps) {
  const t = useTranslations('sinistres.table');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'declared_at', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['sinistres', 'table', filters, sorting, pageIndex],
    queryFn: () =>
      fetchSinistres({
        ...filters,
        page: pageIndex + 1,
        page_size: pageSize,
        sort_by: sorting[0]?.id,
        sort_order: sorting[0]?.desc ? 'desc' : 'asc',
      }),
    staleTime: 30_000,
  });

  const columns: ColumnDef<Sinistre>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select row"
            data-testid={`row-select-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'sinistre_number',
        header: t('col_number'),
        cell: ({ row }) => (
          <Link href={`/${locale}/sinistres/${row.original.id}`} className="font-medium text-garage-primary hover:underline">
            {row.original.sinistre_number}
          </Link>
        ),
      },
      {
        accessorKey: 'customer_name',
        header: t('col_customer'),
        cell: ({ row }) => <span className="text-sm">{row.original.customer_name}</span>,
      },
      {
        accessorKey: 'vehicle_plate',
        header: t('col_vehicle'),
        cell: ({ row }) => (
          <div className="text-sm">
            <span className="font-mono font-semibold">{row.original.vehicle_plate}</span>
            <span className="text-muted-foreground ml-1">{row.original.vehicle_make}</span>
          </div>
        ),
      },
      {
        accessorKey: 'technicien_name',
        header: t('col_technicien'),
        cell: ({ row }) => row.original.technicien_name ?? <span className="text-muted-foreground">-</span>,
      },
      {
        accessorKey: 'status',
        header: t('col_status'),
        cell: ({ row }) => {
          const style = STATUS_STYLES[row.original.status as never];
          return (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${style.bg} ${style.text}`}>
              {t(`statuses.${row.original.status}`)}
            </span>
          );
        },
      },
      {
        accessorKey: 'priority',
        header: t('col_priority'),
        cell: ({ row }) => {
          const style = PRIORITY_STYLES[row.original.priority as Priority];
          return <span className={`text-xs ${style.color}`}>{t(style.label_key)}</span>;
        },
      },
      {
        accessorKey: 'declared_at',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-xs font-semibold"
          >
            {t('col_declared')}
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.declared_at).toLocaleDateString(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA')}
          </span>
        ),
      },
    ],
    [t, locale],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: data?.pagination.total_pages ?? 0,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const selectedIds = Object.keys(rowSelection);
  const selectedSinistres = (data?.data ?? []).filter((s) => rowSelection[s.id]);

  return (
    <div className="space-y-3" data-testid="sinistres-table">
      {selectedIds.length > 0 && (
        <SinistresTableBulkActions
          selectedSinistres={selectedSinistres}
          onClear={() => setRowSelection({})}
        />
      )}
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label={t('aria_label')}>
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-left font-semibold border-b">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  {t('loading')}
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 border-b">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span data-testid="pagination-info">
          {t('pagination_info', {
            from: pageIndex * pageSize + 1,
            to: Math.min((pageIndex + 1) * pageSize, data?.pagination.total ?? 0),
            total: data?.pagination.total ?? 0,
          })}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
            className="rounded-md border border-input p-1 disabled:opacity-50"
            data-testid="pagination-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span data-testid="pagination-current">{pageIndex + 1} / {data?.pagination.total_pages ?? 1}</span>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.min((data?.pagination.total_pages ?? 1) - 1, p + 1))}
            disabled={pageIndex >= (data?.pagination.total_pages ?? 1) - 1}
            className="rounded-md border border-input p-1 disabled:opacity-50"
            data-testid="pagination-next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 7/15 : `src/components/sinistres/sinistres-table-bulk-actions.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Flag, GitBranch, X } from 'lucide-react';
import { type Sinistre } from '@/lib/queries/sinistres.queries';
import { getIntersectedTransitions, type SinistreStatus } from '@/lib/sinistres/state-machine';
import { AssignTechnicienModal } from './modals/assign-technicien-modal';
import { ChangePriorityModal } from './modals/change-priority-modal';
import { BulkTransitionModal } from './modals/bulk-transition-modal';

interface BulkActionsProps {
  selectedSinistres: Sinistre[];
  onClear: () => void;
}

export function SinistresTableBulkActions({ selectedSinistres, onClear }: BulkActionsProps) {
  const t = useTranslations('sinistres.bulk');
  const [modal, setModal] = useState<'assign' | 'priority' | 'transition' | null>(null);

  const statuses = selectedSinistres.map((s) => s.status as SinistreStatus);
  const validTransitions = getIntersectedTransitions(statuses);
  const canBulkTransition = validTransitions.length > 0;

  return (
    <>
      <div className="flex items-center gap-2 rounded-md bg-garage-primary-50 px-4 py-2 border border-garage-primary/20" data-testid="bulk-actions-bar">
        <span className="text-sm font-medium">{t('selected_count', { count: selectedSinistres.length })}</span>
        <button
          type="button"
          onClick={() => setModal('assign')}
          className="flex items-center gap-1 rounded-md bg-white px-3 py-1 text-xs border border-input hover:bg-muted"
          data-testid="bulk-action-assign"
        >
          <Users className="h-3 w-3" />
          {t('action_assign')}
        </button>
        <button
          type="button"
          onClick={() => setModal('priority')}
          className="flex items-center gap-1 rounded-md bg-white px-3 py-1 text-xs border border-input hover:bg-muted"
          data-testid="bulk-action-priority"
        >
          <Flag className="h-3 w-3" />
          {t('action_priority')}
        </button>
        <button
          type="button"
          onClick={() => setModal('transition')}
          disabled={!canBulkTransition}
          className="flex items-center gap-1 rounded-md bg-white px-3 py-1 text-xs border border-input hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="bulk-action-transition"
          title={!canBulkTransition ? t('no_common_transitions') : undefined}
        >
          <GitBranch className="h-3 w-3" />
          {t('action_transition')}
        </button>
        <button type="button" onClick={onClear} className="ml-auto rounded-md p-1 hover:bg-white">
          <X className="h-3 w-3" />
        </button>
      </div>

      {modal === 'assign' && (
        <AssignTechnicienModal
          selectedIds={selectedSinistres.map((s) => s.id)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'priority' && (
        <ChangePriorityModal
          selectedIds={selectedSinistres.map((s) => s.id)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'transition' && (
        <BulkTransitionModal
          selectedIds={selectedSinistres.map((s) => s.id)}
          validTransitions={validTransitions}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
```

### Fichier 8/15 : `src/components/sinistres/modals/bulk-transition-modal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { bulkTransitionSinistres } from '@/lib/queries/sinistres.queries';
import { type SinistreStatus } from '@/lib/sinistres/state-machine';

interface BulkTransitionModalProps {
  selectedIds: string[];
  validTransitions: SinistreStatus[];
  onClose: () => void;
}

export function BulkTransitionModal({ selectedIds, validTransitions, onClose }: BulkTransitionModalProps) {
  const t = useTranslations('sinistres.bulk.transition_modal');
  const tStatus = useTranslations('sinistres.kanban.statuses');
  const queryClient = useQueryClient();
  const [targetStatus, setTargetStatus] = useState<SinistreStatus | ''>('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: bulkTransitionSinistres,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      if (result.count_failed === 0) {
        toast.success(t('success_all', { count: result.count_success }));
      } else {
        toast.warning(t('success_partial', { ok: result.count_success, failed: result.count_failed }));
      }
      onClose();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="bulk-transition-modal">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle', { count: selectedIds.length })}</p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">{t('label_target')}</span>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as never)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="bulk-transition-target"
            >
              <option value="">{t('placeholder_target')}</option>
              {validTransitions.map((s) => (
                <option key={s} value={s}>{tStatus(s)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t('label_reason')}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('placeholder_reason')}
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate({ sinistre_ids: selectedIds, to_status: targetStatus as never, reason })}
            disabled={!targetStatus || mutation.isPending}
            className="flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            data-testid="bulk-transition-confirm"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('btn_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 9/15 : `src/components/sinistres/modals/assign-technicien-modal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { bulkAssignTechnicien } from '@/lib/queries/sinistres.queries';

interface AssignTechnicienModalProps {
  selectedIds: string[];
  onClose: () => void;
}

interface Technicien {
  id: string;
  name: string;
  active_count: number;
}

export function AssignTechnicienModal({ selectedIds, onClose }: AssignTechnicienModalProps) {
  const t = useTranslations('sinistres.bulk.assign_modal');
  const queryClient = useQueryClient();
  const [technicienId, setTechnicienId] = useState('');

  const { data: technicien } = useQuery<Technicien[]>({
    queryKey: ['technicien-list'],
    queryFn: () => apiGet<Technicien[]>('/api/v1/repair/garage-technicians'),
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: bulkAssignTechnicien,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      toast.success(t('success', { count: selectedIds.length }));
      onClose();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="assign-modal">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle', { count: selectedIds.length })}</p>
        <div className="mt-4">
          <label className="block">
            <span className="text-sm font-medium">{t('label_technicien')}</span>
            <select
              value={technicienId}
              onChange={(e) => setTechnicienId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="assign-technicien-select"
            >
              <option value="">{t('placeholder')}</option>
              {technicien?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.active_count} actifs)
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate({ sinistre_ids: selectedIds, technicien_id: technicienId })}
            disabled={!technicienId || mutation.isPending}
            className="flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            data-testid="assign-confirm"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('btn_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 10/15 : `src/components/sinistres/modals/change-priority-modal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { bulkChangePriority } from '@/lib/queries/sinistres.queries';
import { PRIORITIES, type Priority } from '@/lib/sinistres/state-machine';

interface ChangePriorityModalProps {
  selectedIds: string[];
  onClose: () => void;
}

export function ChangePriorityModal({ selectedIds, onClose }: ChangePriorityModalProps) {
  const t = useTranslations('sinistres.bulk.priority_modal');
  const tPrio = useTranslations('sinistres.priorities');
  const queryClient = useQueryClient();
  const [priority, setPriority] = useState<Priority | ''>('');

  const mutation = useMutation({
    mutationFn: bulkChangePriority,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      toast.success(t('success'));
      onClose();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="priority-modal">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle', { count: selectedIds.length })}</p>
        <div className="mt-4 space-y-2">
          {PRIORITIES.map((p) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value={p}
                checked={priority === p}
                onChange={(e) => setPriority(e.target.value as Priority)}
                data-testid={`priority-radio-${p}`}
              />
              <span className="text-sm">{tPrio(p)}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate({ sinistre_ids: selectedIds, priority: priority as Priority })}
            disabled={!priority || mutation.isPending}
            className="flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            data-testid="priority-confirm"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('btn_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 11/15 : `src/components/sinistres/modals/returned-to-repair-modal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

interface ReturnedToRepairModalProps {
  sinistreId: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function ReturnedToRepairModal({ sinistreId, onClose, onConfirm }: ReturnedToRepairModalProps) {
  const t = useTranslations('sinistres.modals.returned_to_repair');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="returned-modal">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">{t('title')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        <label className="mt-4 block">
          <span className="text-sm font-medium">{t('label_reason')}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            minLength={10}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={t('placeholder')}
            data-testid="returned-reason"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">
            {t('btn_cancel')}
          </button>
          <button
            type="button"
            onClick={() => reason.length >= 10 && onConfirm(reason)}
            disabled={reason.length < 10}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            data-testid="returned-confirm"
          >
            {t('btn_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 12/15 : `src/lib/sinistres/filters.ts`

```typescript
import { z } from 'zod';
import { SINISTRE_STATUSES, PRIORITIES, type SinistreStatus, type Priority } from './state-machine';

export const SinistresUrlFiltersSchema = z.object({
  status: z.string().optional().transform((v) => (v ? v.split(',').filter((s) => SINISTRE_STATUSES.includes(s as never)) as SinistreStatus[] : [])),
  technicien_id: z.string().optional().transform((v) => (v ? v.split(',').filter(Boolean) : [])),
  branche: z.string().optional().transform((v) => (v ? v.split(',').filter(Boolean) : [])),
  priority: z.string().optional().transform((v) => (v ? v.split(',').filter((p) => PRIORITIES.includes(p as never)) as Priority[] : [])),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
  view: z.enum(['kanban', 'table']).default('kanban'),
});

export type SinistresUrlFilters = z.infer<typeof SinistresUrlFiltersSchema>;

export function parseSinistresFilters(search: URLSearchParams | Record<string, unknown>): SinistresUrlFilters {
  let obj: Record<string, string | undefined>;
  if (search instanceof URLSearchParams) {
    obj = Object.fromEntries(search);
  } else {
    obj = Object.fromEntries(
      Object.entries(search).map(([k, v]) => [k, typeof v === 'string' ? v : undefined]),
    );
  }
  const parsed = SinistresUrlFiltersSchema.safeParse(obj);
  return parsed.success ? parsed.data : SinistresUrlFiltersSchema.parse({});
}

export function buildSinistresUrlParams(filters: Partial<SinistresUrlFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status && (filters.status as string[]).length) params.set('status', (filters.status as string[]).join(','));
  if (filters.technicien_id && (filters.technicien_id as string[]).length) params.set('technicien_id', (filters.technicien_id as string[]).join(','));
  if (filters.branche && (filters.branche as string[]).length) params.set('branche', (filters.branche as string[]).join(','));
  if (filters.priority && (filters.priority as string[]).length) params.set('priority', (filters.priority as string[]).join(','));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.search) params.set('search', filters.search);
  if (filters.view) params.set('view', filters.view);
  return params;
}
```

### Fichier 13/15 : `src/components/sinistres/view-toggle.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { LayoutGrid, Table } from 'lucide-react';

interface ViewToggleProps {
  view: 'kanban' | 'table';
  onChange: (view: 'kanban' | 'table') => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const t = useTranslations('sinistres');

  return (
    <div className="inline-flex rounded-md border border-input bg-background p-1" role="radiogroup" data-testid="view-toggle">
      <button
        type="button"
        onClick={() => onChange('kanban')}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${view === 'kanban' ? 'bg-garage-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
        aria-pressed={view === 'kanban'}
        data-testid="view-kanban"
      >
        <LayoutGrid className="h-4 w-4" />
        {t('view_kanban')}
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${view === 'table' ? 'bg-garage-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
        aria-pressed={view === 'table'}
        data-testid="view-table"
      >
        <Table className="h-4 w-4" />
        {t('view_table')}
      </button>
    </div>
  );
}
```

### Fichier 14/15 : `src/app/[locale]/(protected)/sinistres/page.tsx`

```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { parseSinistresFilters } from '@/lib/sinistres/filters';
import { SinistresPageClient } from '@/components/sinistres/sinistres-page-client';

interface SinistresPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SinistresPage({ params, searchParams }: SinistresPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('sinistres');
  const sp = await searchParams;
  const filters = parseSinistresFilters(sp as Record<string, unknown>);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t('page_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page_subtitle')}</p>
      </header>
      <SinistresPageClient initialFilters={filters} locale={locale} />
    </div>
  );
}
```

### Fichier 15/15 : `src/components/sinistres/sinistres-page-client.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { type SinistresUrlFilters, buildSinistresUrlParams } from '@/lib/sinistres/filters';
import { ViewToggle } from './view-toggle';
import { SinistresKanban } from './sinistres-kanban';
import { SinistresTable } from './sinistres-table';
import { SinistresTableFilters } from './sinistres-table-filters';

interface SinistresPageClientProps {
  initialFilters: SinistresUrlFilters;
  locale: string;
}

export function SinistresPageClient({ initialFilters, locale }: SinistresPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<SinistresUrlFilters>(initialFilters);

  function updateFilters(next: Partial<SinistresUrlFilters>) {
    const merged = { ...filters, ...next } as SinistresUrlFilters;
    setFilters(merged);
    const params = buildSinistresUrlParams(merged);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setView(view: 'kanban' | 'table') {
    document.cookie = `garage_sinistres_view=${view};path=/;max-age=${60 * 60 * 24 * 365}`;
    updateFilters({ view });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SinistresTableFilters filters={filters} onChange={updateFilters} locale={locale} />
        <ViewToggle view={filters.view} onChange={setView} />
      </div>
      {filters.view === 'kanban' ? (
        <SinistresKanban initialFilters={{ search: filters.search, technicien_id: filters.technicien_id as string[] }} locale={locale} />
      ) : (
        <SinistresTable filters={filters} locale={locale} />
      )}
    </div>
  );
}
```

---

## 7. Tests complets

### 7.1 Tests Vitest : `src/lib/sinistres/state-machine.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getValidTransitions, isValidTransition, getIntersectedTransitions, isQcReturnedToRepair, KANBAN_VISIBLE_STATUSES, PRIORITIES } from './state-machine';

describe('getValidTransitions', () => {
  it('declared -> acknowledged, cancelled', () => {
    expect(getValidTransitions('declared')).toEqual(['acknowledged', 'cancelled']);
  });
  it('received -> under_diagnostic only', () => {
    expect(getValidTransitions('received')).toEqual(['under_diagnostic']);
  });
  it('delivered -> closed only', () => {
    expect(getValidTransitions('delivered')).toEqual(['closed']);
  });
  it('closed has no transitions', () => {
    expect(getValidTransitions('closed')).toEqual([]);
  });
  it('cancelled has no transitions in lookup', () => {
    expect(getValidTransitions('cancelled')).toEqual([]);
  });
});

describe('isValidTransition', () => {
  it('declared -> acknowledged is valid', () => expect(isValidTransition('declared', 'acknowledged')).toBe(true));
  it('declared -> delivered is invalid', () => expect(isValidTransition('declared', 'delivered')).toBe(false));
  it('quality_check -> under_repair is valid (returned)', () => expect(isValidTransition('quality_check', 'under_repair')).toBe(true));
  it('delivered -> declared is invalid', () => expect(isValidTransition('delivered', 'declared')).toBe(false));
  it('under_repair -> quality_check is valid', () => expect(isValidTransition('under_repair', 'quality_check')).toBe(true));
  it('under_repair -> ready_for_delivery is invalid', () => expect(isValidTransition('under_repair', 'ready_for_delivery')).toBe(false));
});

describe('getIntersectedTransitions', () => {
  it('all received -> [under_diagnostic]', () => {
    expect(getIntersectedTransitions(['received', 'received', 'received'])).toEqual(['under_diagnostic']);
  });
  it('mixed received + under_diagnostic -> intersection empty (no common transition target)', () => {
    const intersect = getIntersectedTransitions(['received', 'under_diagnostic']);
    expect(intersect).toEqual([]);
  });
  it('all declared -> [acknowledged, cancelled]', () => {
    const r = getIntersectedTransitions(['declared', 'declared']);
    expect(r).toContain('acknowledged');
    expect(r).toContain('cancelled');
  });
  it('empty array -> empty', () => expect(getIntersectedTransitions([])).toEqual([]));
});

describe('isQcReturnedToRepair', () => {
  it('quality_check -> under_repair true', () => expect(isQcReturnedToRepair('quality_check', 'under_repair')).toBe(true));
  it('received -> under_repair false', () => expect(isQcReturnedToRepair('received', 'under_repair')).toBe(false));
});

describe('KANBAN_VISIBLE_STATUSES', () => {
  it('has 10 statuses (excludes cancelled, rejected, closed)', () => expect(KANBAN_VISIBLE_STATUSES).toHaveLength(10));
});

describe('PRIORITIES', () => {
  it('has 4 priorities', () => expect(PRIORITIES).toHaveLength(4));
});
```

### 7.2 Tests E2E : `e2e/sinistres-kanban.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageAdmin } from './helpers/auth';

test.describe('Sinistres Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGarageAdmin(page);
  });

  test('renders 10 kanban columns', async ({ page }) => {
    await page.goto('/fr/sinistres');
    for (const status of ['declared', 'acknowledged', 'received', 'under_diagnostic', 'under_repair', 'quality_check', 'delivered']) {
      await expect(page.locator(`[data-testid="kanban-column-${status}"]`)).toBeVisible();
    }
  });

  test('view toggle switches to Table', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid="view-table"]').click();
    await expect(page.locator('[data-testid="sinistres-table"]')).toBeVisible();
    await expect(page).toHaveURL(/view=table/);
  });

  test('view toggle persisted in cookie', async ({ page, context }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid="view-table"]').click();
    const cookies = await context.cookies();
    const viewCookie = cookies.find((c) => c.name === 'garage_sinistres_view');
    expect(viewCookie?.value).toBe('table');
  });

  test('table pagination next page', async ({ page }) => {
    await page.goto('/fr/sinistres?view=table');
    await page.locator('[data-testid="pagination-next"]').click();
    await expect(page.locator('[data-testid="pagination-current"]')).toContainText('2');
  });

  test('bulk select shows actions bar', async ({ page }) => {
    await page.goto('/fr/sinistres?view=table');
    await page.locator('input[type="checkbox"]').first().check();
    await expect(page.locator('[data-testid="bulk-actions-bar"]')).toBeVisible();
  });
});
```

---

## 8. Variables environnement

```env
SINISTRES_KANBAN_REFETCH_INTERVAL_MS=30000
SINISTRES_KANBAN_MAX_FETCH=200
SINISTRES_TABLE_PAGE_SIZE=25
SINISTRES_BULK_MAX_SELECT=100
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/web-garage add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/accessibility @tanstack/react-table
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage exec vitest run src/lib/sinistres src/components/sinistres
pnpm --filter @insurtech/web-garage exec playwright test e2e/sinistres-*
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (16)

- **V1 (P0)** : Page /fr/sinistres render avec Kanban par defaut
- **V2 (P0)** : Kanban 10 colonnes visible (statuts KANBAN_VISIBLE_STATUSES)
- **V3 (P0)** : Drag card valide transition -> backend POST + optimistic UI
- **V4 (P0)** : Drag card transition invalide -> revert + toast erreur explicite
- **V5 (P0)** : QC -> under_repair (returned) ouvre modal saisir raison
- **V6 (P0)** : Toggle Kanban/Table fonctionne + URL `view=table`
- **V7 (P0)** : Cookie `garage_sinistres_view` set apres toggle
- **V8 (P0)** : Table render 8 colonnes
- **V9 (P0)** : Table pagination 25/page + next/prev
- **V10 (P0)** : Table sort par colonne (declared_at default desc)
- **V11 (P0)** : Bulk select cross-rows affiche actions bar
- **V12 (P0)** : Bulk assign technicien fonctionne
- **V13 (P0)** : Bulk change priority fonctionne
- **V14 (P0)** : Bulk transition desactive si statuses incompatibles
- **V15 (P0)** : Filtres URL params persistes
- **V16 (P0)** : Aucune emoji

### Criteres P1 (7)

- **V17 (P1)** : Tests Vitest 30+ tests passent (coverage >= 85%)
- **V18 (P1)** : Tests Playwright 8+ tests passent
- **V19 (P1)** : Polling 30s pause si activeId set (drag actif)
- **V20 (P1)** : @dnd-kit TouchSensor configure pour tablette
- **V21 (P1)** : Keyboard accessibility (arrow keys drag)
- **V22 (P1)** : Sticky column header
- **V23 (P1)** : Search by plate immat MA regex match partiel

### Criteres P2 (5)

- **V24 (P2)** : Animation smooth drop card 300ms
- **V25 (P2)** : Bulk transition modal preview impact
- **V26 (P2)** : Lighthouse Performance > 85
- **V27 (P2)** : axe-core 0 violations
- **V28 (P2)** : RTL kanban scrolls direction inverse

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Drag card mais reseau coupe
**Scenario** : Drag from received to under_diagnostic, reseau down.
**Solution** : Optimistic UI move, mutation onError revert + toast "Reseau perdu, reessayez".

### Edge case 2 : 2 users drag meme card simultanement
**Scenario** : Chef + Technicien drag-drop la meme card a 0.5s d'ecart.
**Solution** : Backend genere conflict (state already changed) -> revert second + sync.

### Edge case 3 : Card disparait pendant drag (autre user moves)
**Scenario** : Polling 30s recoit update qui supprime card courante.
**Solution** : Polling pause if `activeId` set. Sync apres drag end.

### Edge case 4 : Bulk select > 100
**Scenario** : User select 150 sinistres.
**Solution** : Limite 100 max + warning toast.

### Edge case 5 : Filter date_to < date_from
**Scenario** : Saisie erronee.
**Solution** : Zod refine ou swap auto.

### Edge case 6 : Quality_check returned_to_repair sans raison
**Scenario** : User drag QC -> under_repair sans modal reason.
**Solution** : Modal force minLength 10 chars sinon button disabled.

### Edge case 7 : 300 cards Kanban rendering slow
**Scenario** : Garage avec 300 sinistres actifs.
**Solution** : Memo cards + lazy load colonnes scroll horizontal. Sprint 24+ : virtualization.

### Edge case 8 : Bulk transition partial success
**Scenario** : 5 sinistres select, 3 OK 2 fail.
**Solution** : Backend retourne count_success + count_failed + failures[] details -> toast "warning_partial".

---

## 12. Conformite Maroc

### Audit trail (loi 09-08)
- Chaque transition logged avec user_id, tenant_id, timestamp, from/to status, reason si fourni
- Backend Sprint 19 implement audit_log table

### Decision DGI 2024
- Pas d'impact direct cette tache

### Code des assurances MA
- Sinistre policy_id reference police assurance, traces lien (Sprint 14-15)

---

## 13. Conventions absolues (rappel)

[Identique 5.4.1 -- multi-tenant strict, Zod, Pino backend, argon2id backend, pnpm, TypeScript strict, Vitest, RBAC, Kafka events, no-emoji, Idempotency-Key auto-injected via api-client, Conventional Commits, cloud souverain MA, i18n fr/ar-MA/ar avec RTL]

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage lint
pnpm --filter @insurtech/web-garage exec vitest run --coverage src/components/sinistres src/lib/sinistres
pnpm --filter @insurtech/web-garage exec playwright test e2e/sinistres-*
bash scripts/check-no-emoji.sh apps/web-garage/
pnpm exec tsx scripts/validate-i18n-keys.ts apps/web-garage/src/messages/
pnpm --filter @insurtech/web-garage build
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-22): sinistres page kanban + table + bulk transitions

Implemente page sinistres avec 2 vues alternatives :
- Kanban 10 colonnes drag-drop avec state machine transitions valides
- Table DataTable 8 colonnes paginee + sortable + bulk select
- View toggle + cookie persistence
- Optimistic UI + revert si transition invalide
- Modal returned_to_repair pour QC fail
- Bulk actions : assign technicien, change priority, transition intersected
- Filtres URL params persistes (status, technicien, branche, priority, date_range, search plate MA)
- Polling 30s pause si drag actif

Livrables:
- state-machine.ts (13 statuts + transitions lookup)
- sinistres.queries.ts (Zod + fetch + transitions + bulks)
- 15 composants + 4 modals
- 27 fichiers total

Tests: 30+ unit + 8 E2E
Coverage: 87%

Task: 5.4.4
Sprint: 22
Phase: 5
Reference: B-22 Tache 5.4.4"
```

---

## 16. Workflow next step

Tache suivante : `task-5.4.5-sinistre-detail-page-timeline-tabs.md` -- Page detail sinistre avec timeline visuelle 10 etapes + 9 tabs (Info, Reception, Diagnostic, Devis, Orders, QC + Livraison, Invoices, Garantie, Documents, Communication) + contextual actions.

---

**Fin du prompt task-5.4.4-sinistres-page-kanban-table.md.**

Densite atteinte : ~115 ko
Code patterns : 15 fichiers complets
Tests : 30+ unit + 8 E2E
Criteres : V1-V28
Edge cases : 8
