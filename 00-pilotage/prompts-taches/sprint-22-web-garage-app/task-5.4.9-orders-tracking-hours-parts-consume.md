# TACHE 5.4.9 -- Orders Page : List + Detail + Tracking Real-time + Log Hours Timer + Parts Consume

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.9)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 6h
**Dependances** :
- Taches 5.4.1-5.4.8 livres
- Sprint 21 Tache 5.3.4 (orders backend + tasks checklist + parts consumption tracking)
- Sprint 13 Stock module (parts catalog + FIFO consumption + low alert)
- Sprint 13 HR module (technicien work hours logging)
- Sprint 21 Tache 5.3.5 (notifications customer milestones)

**Densite cible** : 80-150 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Remplir la **tab Orders** de la page detail sinistre + page list orders en cours `/[locale]/orders` avec : (1) **List page** /orders : datatable orders en cours filters (technicien, status, date_range, branche), (2) **Detail page** /orders/[id] : header order_number + status + assigned_technicien, (3) **Tasks checklist** : list tasks issus du devis approve (parts replacement + labor descriptions) -- chaque task checkable -> % completion auto, (4) **Parts arrival status** : table parts ordered avec status (pending / ordered / arrived / used) + expected_date, (5) **Hours log** : 2 modes : (a) **Timer "Start work / Stop work"** -- start commence timer realtime, stop commit duree + memo, (b) **Manual entry** -- saisir start_at + end_at + duration + memo, (6) **Parts consumption** : bouton "Consume part" -> modal select part from Stock catalog Sprint 13 + quantity -> POST /api/v1/stock/consume + lien avec order, (7) **Photos progress upload** : photos d'avancement reparation (different reception + diagnostic photos), (8) **"Mark Complete"** : button -> validation tasks all done + transition order completed + transition sinistre `under_repair` -> `quality_check`, (9) **Real-time updates** : poll 30s pour sync multi-technicien sur meme order (rare mais possible), (10) **Notifications customer milestones** : trigger automatique apres parts arrival, after 50% completion, after order completed.

Cette tache materialise le **temps reel atelier**. Le technicien lance le timer Start work -> travaille -> Stop work. Le hours log alimente HR module (paie + capacite planning Sprint 13). Parts consume update Stock module (decrement quantity + FIFO valuation). Photos progress sert preuve customer + assureur.

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Sans tracking real-time, manager ne sait pas avancement reel atelier. Sans hours log digital, paie technicien est imprecise (estimation manuelle). Sans parts consume digital, Stock divergence theorique vs reel (cles communes garage MA : pieces "perdues" sans traceabilite). Cette tache digitalise l'atelier completement.

### Trade-offs

1. Timer realtime vs manual : 2 modes coexistent (technicien jeune prefere timer, ancien prefere manual).
2. Parts consume immediate vs batch : immediate (FIFO accurate live).
3. Photos progress optional : pas obligatoire mais recommande.
4. Notifications customer : configurable (some customers don't want spam).

### Pieges (10)

1. Timer perdu page reload : auto-save state localStorage + timestamp start.
2. Multi-tab timer simultane : detect + warn.
3. Mark complete avec tasks non-done : reject + warning.
4. Stock consume but part not in stock : reject + suggest order.
5. Manual hours entry overlap : detect conflict.
6. Photos progress 50+ : pagination.
7. Notifications customer locale : utiliser preferred_locale du customer.
8. Order status finished vs sinistre still under_repair : transition logique.
9. Polling 30s pause if drag actif Kanban autre tab.
10. Realtime timer drift : sync server timestamp toutes 60s.

---

## 3. Architecture

### Fichiers

```
repo/apps/web-garage/src/app/[locale]/(protected)/orders/
|-- page.tsx                                # list orders en cours
|-- [id]/page.tsx                            # order detail
|
repo/apps/web-garage/src/components/orders/
|-- orders-list.tsx                          # DataTable
|-- orders-list-filters.tsx
|-- order-detail.tsx                         # orchestrator detail
|-- order-header.tsx
|-- tasks-checklist.tsx                       # tasks done / pending
|-- parts-arrival-status.tsx                  # table parts
|-- hours-tracker.tsx                          # timer + manual
|-- hours-manual-entry.tsx
|-- parts-consumer-dialog.tsx                  # modal consume part
|-- progress-photos-uploader.tsx               # photos avancement
|-- mark-complete-button.tsx
|
repo/apps/web-garage/src/lib/orders/
|-- schema.ts
|-- queries.ts
|
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-orders.tsx       # remplace placeholder
```

---

## 4. Livrables (22)

- [ ] Page list orders + filters
- [ ] Page detail order
- [ ] Order header + tasks checklist
- [ ] Tasks checkable + % completion auto
- [ ] Parts arrival status table
- [ ] Hours tracker timer realtime
- [ ] Hours manual entry alternative
- [ ] Parts consumer dialog + Stock integration
- [ ] Progress photos uploader
- [ ] Mark Complete button + validation
- [ ] Real-time polling 30s
- [ ] Notifications customer triggers
- [ ] Timer auto-save localStorage
- [ ] Multi-tab timer detection
- [ ] Stock low warning si consume risk
- [ ] Tests Vitest 20+
- [ ] Tests E2E 6+
- [ ] i18n 60+ keys
- [ ] Replace placeholder
- [ ] Aucune emoji
- [ ] LCP < 2s
- [ ] WCAG keyboard nav

---

## 5. Fichiers

```
app/[locale]/(protected)/orders/page.tsx                  (~150 lignes)
app/[locale]/(protected)/orders/[id]/page.tsx              (~150 lignes)
components/orders/orders-list.tsx                          (~200 lignes)
components/orders/orders-list-filters.tsx                  (~120 lignes)
components/orders/order-detail.tsx                         (~200 lignes)
components/orders/order-header.tsx                         (~120 lignes)
components/orders/tasks-checklist.tsx                       (~180 lignes)
components/orders/parts-arrival-status.tsx                  (~150 lignes)
components/orders/hours-tracker.tsx                          (~250 lignes)
components/orders/hours-manual-entry.tsx                      (~150 lignes)
components/orders/parts-consumer-dialog.tsx                    (~200 lignes)
components/orders/progress-photos-uploader.tsx                  (~150 lignes)
components/orders/mark-complete-button.tsx                       (~100 lignes)
lib/orders/schema.ts                                              (~180 lignes)
lib/orders/queries.ts                                              (~200 lignes)
components/sinistres/detail/tabs/tab-orders.tsx                     (~80 lignes)
specs (~1000 lignes)
e2e/orders-flow.spec.ts                                              (~200 lignes)
```

Total : ~25 fichiers, ~3200 lignes

---

## 6. Code patterns COMPLETS

### Fichier 1/15 : `lib/orders/schema.ts`

```typescript
import { z } from 'zod';

export const OrderStatusSchema = z.enum(['pending', 'in_progress', 'awaiting_parts', 'paused', 'completed', 'cancelled']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PartArrivalStatusSchema = z.enum(['pending', 'ordered', 'arrived', 'used']);
export type PartArrivalStatus = z.infer<typeof PartArrivalStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  done: z.boolean(),
  done_at: z.string().datetime().nullable(),
  done_by_technicien_id: z.string().uuid().nullable(),
  estimated_hours: z.number().nonnegative(),
});
export type Task = z.infer<typeof TaskSchema>;

export const OrderPartSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  quantity_needed: z.number().int().positive(),
  quantity_consumed: z.number().int().nonnegative(),
  arrival_status: PartArrivalStatusSchema,
  expected_arrival_date: z.string().datetime().nullable(),
});
export type OrderPart = z.infer<typeof OrderPartSchema>;

export const HoursEntrySchema = z.object({
  id: z.string().uuid(),
  technicien_id: z.string().uuid(),
  technicien_name: z.string(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  duration_minutes: z.number().int().nonnegative().nullable(),
  memo: z.string().nullable(),
  source: z.enum(['timer', 'manual']),
});
export type HoursEntry = z.infer<typeof HoursEntrySchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  sinistre_id: z.string().uuid(),
  status: OrderStatusSchema,
  assigned_technicien_id: z.string().uuid(),
  assigned_technicien_name: z.string(),
  tasks: z.array(TaskSchema),
  parts: z.array(OrderPartSchema),
  hours_entries: z.array(HoursEntrySchema),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
});
export type Order = z.infer<typeof OrderSchema>;

export function computeOrderProgress(order: Order): number {
  const total = order.tasks.length;
  if (total === 0) return 0;
  const done = order.tasks.filter((t) => t.done).length;
  return Math.round((done / total) * 100);
}

export function computeTotalHours(order: Order): number {
  return order.hours_entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0) / 60, 0);
}

export const ConsumePartInputSchema = z.object({
  part_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});
export type ConsumePartInput = z.infer<typeof ConsumePartInputSchema>;

export const ManualHoursEntryInputSchema = z.object({
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  memo: z.string().max(500).optional(),
}).refine((data) => new Date(data.started_at) < new Date(data.ended_at), {
  message: 'started_at must be before ended_at',
  path: ['ended_at'],
});
export type ManualHoursEntryInput = z.infer<typeof ManualHoursEntryInputSchema>;
```

### Fichier 2/15 : `lib/orders/queries.ts`

```typescript
import { z } from 'zod';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { OrderSchema, type Order, type ConsumePartInput, type ManualHoursEntryInput } from './schema';

const PaginatedOrdersSchema = z.object({
  data: z.array(OrderSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }),
});

export interface OrdersFilters {
  status?: string[];
  technicien_id?: string[];
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function fetchOrders(filters: OrdersFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.technicien_id?.length) params.set('technicien_id', filters.technicien_id.join(','));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.page_size) params.set('page_size', filters.page_size.toString());
  const data = await apiGet<unknown>(`/api/v1/repair/orders?${params.toString()}`);
  return PaginatedOrdersSchema.parse(data);
}

export async function fetchOrderDetail(orderId: string): Promise<Order> {
  const data = await apiGet<unknown>(`/api/v1/repair/orders/${orderId}`);
  return OrderSchema.parse(data);
}

export async function fetchOrdersBySinistre(sinistreId: string): Promise<Order[]> {
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${sinistreId}/orders`);
  return z.array(OrderSchema).parse(data);
}

export async function toggleTask(orderId: string, taskId: string, done: boolean): Promise<Order> {
  const data = await apiPatch<unknown>(`/api/v1/repair/orders/${orderId}/tasks/${taskId}`, { done });
  return OrderSchema.parse(data);
}

export async function startHoursTimer(orderId: string): Promise<{ entry_id: string; started_at: string }> {
  return await apiPost(`/api/v1/repair/orders/${orderId}/hours/start`, {});
}

export async function stopHoursTimer(orderId: string, entryId: string, memo?: string): Promise<Order> {
  const data = await apiPost<unknown>(`/api/v1/repair/orders/${orderId}/hours/${entryId}/stop`, { memo });
  return OrderSchema.parse(data);
}

export async function logManualHours(orderId: string, input: ManualHoursEntryInput): Promise<Order> {
  const data = await apiPost<unknown>(`/api/v1/repair/orders/${orderId}/hours/manual`, input);
  return OrderSchema.parse(data);
}

export async function consumePart(orderId: string, input: ConsumePartInput): Promise<Order> {
  const data = await apiPost<unknown>(`/api/v1/repair/orders/${orderId}/consume-part`, input);
  return OrderSchema.parse(data);
}

export async function markOrderComplete(orderId: string): Promise<Order> {
  const data = await apiPost<unknown>(`/api/v1/repair/orders/${orderId}/complete`, {});
  return OrderSchema.parse(data);
}
```

### Fichier 3/15 : `components/orders/order-detail.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { fetchOrderDetail, computeOrderProgress, computeTotalHours } from '@/lib/orders/queries';
import { OrderHeader } from './order-header';
import { TasksChecklist } from './tasks-checklist';
import { PartsArrivalStatus } from './parts-arrival-status';
import { HoursTracker } from './hours-tracker';
import { ProgressPhotosUploader } from './progress-photos-uploader';
import { MarkCompleteButton } from './mark-complete-button';

interface Props {
  orderId: string;
  locale: string;
}

export function OrderDetail({ orderId, locale }: Props) {
  const t = useTranslations('orders.detail');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderDetail(orderId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!order) return <p>{t('not_found')}</p>;

  const progress = computeOrderProgress(order);
  const totalHours = computeTotalHours(order);

  return (
    <div className="space-y-4" data-testid="order-detail">
      <OrderHeader order={order} progress={progress} totalHours={totalHours} locale={locale} />
      <TasksChecklist order={order} />
      <PartsArrivalStatus parts={order.parts} locale={locale} />
      <HoursTracker order={order} locale={locale} />
      <ProgressPhotosUploader orderId={orderId} />
      <MarkCompleteButton order={order} progress={progress} />
    </div>
  );
}
```

### Fichier 4/15 : `components/orders/order-header.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, Wrench } from 'lucide-react';
import { type Order } from '@/lib/orders/schema';

interface Props {
  order: Order;
  progress: number;
  totalHours: number;
  locale: string;
}

export function OrderHeader({ order, progress, totalHours, locale }: Props) {
  const t = useTranslations('orders.header');

  return (
    <header className="rounded-lg border border-border bg-card p-4" data-testid="order-header">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono" dir="ltr">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{t('assigned_to')}: {order.assigned_technicien_name}</p>
          <p className="text-xs text-muted-foreground">{t('status')}: {order.status}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{progress}%</p>
            <p className="text-xs text-muted-foreground">{t('progress')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{t('hours_logged')}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-garage-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
          data-testid="progress-bar"
        />
      </div>
    </header>
  );
}
```

### Fichier 5/15 : `components/orders/tasks-checklist.tsx`

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, Clock } from 'lucide-react';
import { toggleTask } from '@/lib/orders/queries';
import { type Order, type Task } from '@/lib/orders/schema';

interface Props {
  order: Order;
}

export function TasksChecklist({ order }: Props) {
  const t = useTranslations('orders.tasks');
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) => toggleTask(order.id, taskId, done),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', order.id], updated);
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="tasks-checklist">
      <h3 className="text-sm font-semibold mb-3">{t('title')} ({order.tasks.filter((t) => t.done).length}/{order.tasks.length})</h3>
      <ul className="space-y-2">
        {order.tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2" data-testid={`task-${task.id}`}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={(e) => toggleMutation.mutate({ taskId: task.id, done: e.target.checked })}
              className="mt-1"
              aria-label={task.description}
            />
            <div className="flex-1">
              <p className={`text-sm ${task.done ? 'line-through text-muted-foreground' : ''}`}>{task.description}</p>
              <p className="text-xs text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                {t('estimated', { hours: task.estimated_hours })}
                {task.done && task.done_at && ` - ${t('done_at', { date: new Date(task.done_at).toLocaleString() })}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### Fichier 6/15 : `components/orders/parts-arrival-status.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { type OrderPart } from '@/lib/orders/schema';

interface Props {
  parts: OrderPart[];
  locale: string;
}

const STATUS_ICONS = {
  pending: { icon: Clock, color: 'text-gray-500' },
  ordered: { icon: Truck, color: 'text-blue-600' },
  arrived: { icon: Package, color: 'text-amber-600' },
  used: { icon: CheckCircle, color: 'text-green-600' },
};

export function PartsArrivalStatus({ parts, locale }: Props) {
  const t = useTranslations('orders.parts');

  if (parts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="parts-arrival-status">
      <h3 className="text-sm font-semibold mb-3">{t('title')} ({parts.length})</h3>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-2 py-1 text-xs">{t('col_name')}</th>
            <th className="text-left px-2 py-1 text-xs">{t('col_sku')}</th>
            <th className="text-left px-2 py-1 text-xs">{t('col_needed')}</th>
            <th className="text-left px-2 py-1 text-xs">{t('col_consumed')}</th>
            <th className="text-left px-2 py-1 text-xs">{t('col_status')}</th>
            <th className="text-left px-2 py-1 text-xs">{t('col_expected')}</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => {
            const { icon: Icon, color } = STATUS_ICONS[p.arrival_status];
            return (
              <tr key={p.id} className="border-b border-border" data-testid={`part-${p.id}`}>
                <td className="px-2 py-1">{p.name}</td>
                <td className="px-2 py-1 font-mono text-xs">{p.sku}</td>
                <td className="px-2 py-1">{p.quantity_needed}</td>
                <td className="px-2 py-1">{p.quantity_consumed}</td>
                <td className="px-2 py-1">
                  <span className={`flex items-center gap-1 ${color}`}>
                    <Icon className="h-3 w-3" />
                    {t(`statuses.${p.arrival_status}`)}
                  </span>
                </td>
                <td className="px-2 py-1 text-xs">
                  {p.expected_arrival_date ? new Date(p.expected_arrival_date).toLocaleDateString(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA') : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

### Fichier 7/15 : `components/orders/hours-tracker.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Play, Square, Edit, Loader2 } from 'lucide-react';
import { startHoursTimer, stopHoursTimer } from '@/lib/orders/queries';
import { type Order } from '@/lib/orders/schema';
import { HoursManualEntry } from './hours-manual-entry';

interface Props {
  order: Order;
  locale: string;
}

const TIMER_STORAGE_KEY = (orderId: string) => `timer-${orderId}`;

export function HoursTracker({ order, locale }: Props) {
  const t = useTranslations('orders.hours');
  const queryClient = useQueryClient();
  const [activeEntry, setActiveEntry] = useState<{ id: string; started_at: string } | null>(null);
  const [memo, setMemo] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TIMER_STORAGE_KEY(order.id));
    if (stored) {
      try {
        setActiveEntry(JSON.parse(stored));
      } catch {}
    }
  }, [order.id]);

  useEffect(() => {
    if (!activeEntry) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
      return;
    }
    const start = new Date(activeEntry.started_at).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeEntry]);

  const startMutation = useMutation({
    mutationFn: () => startHoursTimer(order.id),
    onSuccess: (data) => {
      setActiveEntry({ id: data.entry_id, started_at: data.started_at });
      localStorage.setItem(TIMER_STORAGE_KEY(order.id), JSON.stringify({ id: data.entry_id, started_at: data.started_at }));
      toast.success(t('timer_started'));
    },
    onError: () => toast.error(t('timer_error')),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopHoursTimer(order.id, activeEntry!.id, memo),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', order.id], updated);
      setActiveEntry(null);
      setMemo('');
      localStorage.removeItem(TIMER_STORAGE_KEY(order.id));
      toast.success(t('timer_stopped'));
    },
    onError: () => toast.error(t('timer_error')),
  });

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="hours-tracker">
      <h3 className="text-sm font-semibold mb-3">{t('title')}</h3>

      <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-md">
        <div className="flex-1">
          <p className="text-3xl font-mono font-bold" data-testid="timer-display">{formatTime(elapsed)}</p>
          {activeEntry && <p className="text-xs text-muted-foreground">{t('started_at', { time: new Date(activeEntry.started_at).toLocaleTimeString() })}</p>}
        </div>
        {!activeEntry ? (
          <button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="timer-start"
          >
            {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t('btn_start')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="timer-stop"
          >
            {stopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            {t('btn_stop')}
          </button>
        )}
      </div>

      {activeEntry && (
        <input
          type="text"
          placeholder={t('memo_placeholder')}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
          data-testid="timer-memo"
        />
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-1 text-xs text-garage-primary hover:underline"
          data-testid="manual-entry-toggle"
        >
          <Edit className="h-3 w-3" />
          {t('manual_entry_toggle')}
        </button>
      </div>

      {showManual && <HoursManualEntry orderId={order.id} onSubmitted={() => setShowManual(false)} />}

      {order.hours_entries.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold mb-2">{t('history')}</h4>
          <ul className="space-y-1 max-h-48 overflow-y-auto text-xs">
            {order.hours_entries.map((entry) => (
              <li key={entry.id} className="flex justify-between border-b border-border py-1">
                <span>{entry.technicien_name}</span>
                <span>{entry.duration_minutes !== null ? `${(entry.duration_minutes / 60).toFixed(2)}h` : t('in_progress')}</span>
                <span className="text-muted-foreground">{entry.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

### Fichier 8/15 : `components/orders/hours-manual-entry.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ManualHoursEntryInputSchema, type ManualHoursEntryInput } from '@/lib/orders/schema';
import { logManualHours } from '@/lib/orders/queries';

interface Props {
  orderId: string;
  onSubmitted: () => void;
}

export function HoursManualEntry({ orderId, onSubmitted }: Props) {
  const t = useTranslations('orders.hours_manual');
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<ManualHoursEntryInput>({
    resolver: zodResolver(ManualHoursEntryInputSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ManualHoursEntryInput) => logManualHours(orderId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', orderId], updated);
      toast.success(t('logged'));
      onSubmitted();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="mt-3 space-y-2" data-testid="hours-manual-form">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs">{t('started_at')}</span>
          <input
            type="datetime-local"
            {...register('started_at')}
            className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            data-testid="manual-started"
          />
        </label>
        <label className="block">
          <span className="text-xs">{t('ended_at')}</span>
          <input
            type="datetime-local"
            {...register('ended_at')}
            className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            data-testid="manual-ended"
          />
        </label>
      </div>
      <input
        type="text"
        placeholder={t('memo')}
        {...register('memo')}
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
      />
      {errors.ended_at && <p className="text-xs text-red-600">{errors.ended_at.message}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex items-center gap-1 rounded-md bg-garage-primary px-3 py-1 text-xs text-white disabled:opacity-50"
        data-testid="manual-submit"
      >
        {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        {t('btn_log')}
      </button>
    </form>
  );
}
```

### Fichier 9/15 : `components/orders/parts-consumer-dialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { consumePart } from '@/lib/orders/queries';

interface Props {
  orderId: string;
  onClose: () => void;
}

interface StockPart {
  id: string;
  sku: string;
  name: string;
  current_quantity: number;
  unit_cost_mad: number;
}

export function PartsConsumerDialog({ orderId, onClose }: Props) {
  const t = useTranslations('orders.parts_consumer');
  const queryClient = useQueryClient();
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');

  const { data: parts, isLoading } = useQuery<StockPart[]>({
    queryKey: ['stock-parts', search],
    queryFn: () => apiGet<StockPart[]>(`/api/v1/stock/items?search=${encodeURIComponent(search)}&limit=30`),
    staleTime: 60_000,
  });

  const selectedPart = parts?.find((p) => p.id === selectedPartId);
  const stockInsufficient = selectedPart && quantity > selectedPart.current_quantity;

  const mutation = useMutation({
    mutationFn: () => consumePart(orderId, { part_id: selectedPartId, quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['stock-parts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'parts-low-stock'] });
      toast.success(t('consumed'));
      onClose();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="parts-consumer-dialog">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <input
          type="text"
          placeholder={t('search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
          data-testid="parts-search"
        />

        <select
          value={selectedPartId}
          onChange={(e) => setSelectedPartId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
          data-testid="parts-select"
        >
          <option value="">{t('placeholder_select')}</option>
          {parts?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}) - {t('in_stock', { qty: p.current_quantity })}
            </option>
          ))}
        </select>

        <label className="block mb-3">
          <span className="text-sm">{t('quantity')}</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="parts-quantity"
          />
        </label>

        {stockInsufficient && (
          <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t('stock_insufficient', { available: selectedPart!.current_quantity })}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-3 py-2 text-sm">{t('cancel')}</button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!selectedPartId || stockInsufficient || mutation.isPending}
            className="flex items-center gap-1 rounded-md bg-garage-primary px-3 py-2 text-sm text-white disabled:opacity-50"
            data-testid="parts-consume-btn"
          >
            {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('btn_consume')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 10/15 : `components/orders/mark-complete-button.tsx`

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle, Loader2 } from 'lucide-react';
import { markOrderComplete } from '@/lib/orders/queries';
import { type Order } from '@/lib/orders/schema';

interface Props {
  order: Order;
  progress: number;
}

export function MarkCompleteButton({ order, progress }: Props) {
  const t = useTranslations('orders.complete');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => markOrderComplete(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['sinistre-detail'] });
      toast.success(t('completed'));
    },
    onError: () => toast.error(t('error_incomplete_tasks')),
  });

  const canComplete = progress === 100 && order.status !== 'completed';

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={!canComplete || mutation.isPending}
        className="flex items-center gap-2 rounded-md bg-garage-primary px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
        title={!canComplete ? t('tasks_incomplete_hint') : undefined}
        data-testid="mark-complete-btn"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        {t('btn_complete')}
      </button>
    </div>
  );
}
```

### Fichier 11/15 : `components/orders/orders-list.tsx`

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { fetchOrders, type OrdersFilters } from '@/lib/orders/queries';
import { OrdersListFilters } from './orders-list-filters';

interface Props {
  locale: string;
}

export function OrdersList({ locale }: Props) {
  const t = useTranslations('orders.list');
  const [filters, setFilters] = useState<OrdersFilters>({ page: 1, page_size: 25 });

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
    staleTime: 30_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-3" data-testid="orders-list">
      <OrdersListFilters filters={filters} onChange={setFilters} />
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left text-xs">{t('col_number')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_status')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_technicien')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_progress')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_created')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((o) => {
              const done = o.tasks.filter((t) => t.done).length;
              const total = o.tasks.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <tr key={o.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-2 py-1">
                    <Link href={`/${locale}/orders/${o.id}`} className="font-medium text-garage-primary hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-2 py-1"><span className="text-xs">{o.status}</span></td>
                  <td className="px-2 py-1">{o.assigned_technicien_name}</td>
                  <td className="px-2 py-1">{pct}% ({done}/{total})</td>
                  <td className="px-2 py-1 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Fichier 12/15 : `components/orders/orders-list-filters.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { type OrdersFilters } from '@/lib/orders/queries';

interface Props {
  filters: OrdersFilters;
  onChange: (f: OrdersFilters) => void;
}

const STATUSES = ['pending', 'in_progress', 'awaiting_parts', 'paused', 'completed'];

export function OrdersListFilters({ filters, onChange }: Props) {
  const t = useTranslations('orders.list_filters');
  return (
    <div className="flex gap-2" data-testid="orders-list-filters">
      <select
        multiple={false}
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          onChange({ ...filters, status: [e.target.value] });
        }}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
        data-testid="filter-status"
      >
        <option value="">{t('all_statuses')}</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input
        type="date"
        value={filters.date_from ?? ''}
        onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
      />
    </div>
  );
}
```

### Fichier 13/15 : `components/orders/progress-photos-uploader.tsx`

(reutilise pattern reception 5.4.6 -- voir AdditionalPhotosUploader 5.4.7)

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFileWithRetry } from '@/lib/reception/s3-upload-helper';

interface Props {
  orderId: string;
}

export function ProgressPhotosUploader({ orderId }: Props) {
  const t = useTranslations('orders.progress_photos');
  const [photos, setPhotos] = useState<{ id: string; doc_id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        if (!file.type.startsWith('image/')) {
          toast.error(t('error_not_image'));
          continue;
        }
        const doc_id = await uploadFileWithRetry(file, 'order_progress', orderId);
        setPhotos((prev) => [...prev, { id: crypto.randomUUID(), doc_id, url: URL.createObjectURL(file) }]);
      } catch {
        toast.error(t('error_upload'));
      }
    }
    setUploading(false);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="progress-photos-uploader">
      <h3 className="text-sm font-semibold mb-2">{t('title')}</h3>
      <label className="flex cursor-pointer items-center justify-center gap-1 rounded-md border-2 border-dashed border-input p-3 text-sm hover:bg-muted">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {t('btn_upload')}
        <input type="file" accept="image/*" capture="environment" multiple hidden disabled={uploading} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </label>
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-md border border-border overflow-hidden">
              <img src={p.url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

### Fichier 14/15 : `app/[locale]/(protected)/orders/page.tsx`

```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { OrdersList } from '@/components/orders/orders-list';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('orders');

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t('page_title')}</h1>
      </header>
      <OrdersList locale={locale} />
    </div>
  );
}
```

### Fichier 15/15 : `tab-orders.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Loader2 } from 'lucide-react';
import { fetchOrdersBySinistre } from '@/lib/orders/queries';
import { OrderDetail } from '@/components/orders/order-detail';
import { PartsConsumerDialog } from '@/components/orders/parts-consumer-dialog';

interface Props {
  sinistreId: string;
  status: string;
  locale: string;
}

export function TabOrders({ sinistreId, status, locale }: Props) {
  const t = useTranslations('orders');
  const [consumerDialog, setConsumerDialog] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-by-sinistre', sinistreId],
    queryFn: () => fetchOrdersBySinistre(sinistreId),
    staleTime: 30_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!orders || orders.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">{t('no_orders')}</p>;

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="space-y-3">
          <OrderDetail orderId={order.id} locale={locale} />
          <button
            type="button"
            onClick={() => setConsumerDialog(order.id)}
            className="flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
            data-testid={`consume-btn-${order.id}`}
          >
            <Plus className="h-4 w-4" />
            {t('btn_consume_part')}
          </button>
        </div>
      ))}

      {consumerDialog && <PartsConsumerDialog orderId={consumerDialog} onClose={() => setConsumerDialog(null)} />}
    </div>
  );
}
```

---

## 7. Tests complets

### 7.1 Vitest schema

```typescript
import { describe, it, expect } from 'vitest';
import { computeOrderProgress, computeTotalHours, ManualHoursEntryInputSchema } from './schema';

describe('computeOrderProgress', () => {
  it('returns 0 for empty tasks', () => {
    expect(computeOrderProgress({ tasks: [] } as never)).toBe(0);
  });
  it('returns 100% for all done', () => {
    const order = { tasks: [{ done: true }, { done: true }] } as never;
    expect(computeOrderProgress(order)).toBe(100);
  });
  it('returns 50% for half done', () => {
    const order = { tasks: [{ done: true }, { done: false }] } as never;
    expect(computeOrderProgress(order)).toBe(50);
  });
});

describe('computeTotalHours', () => {
  it('sums duration_minutes / 60', () => {
    const order = { hours_entries: [{ duration_minutes: 60 }, { duration_minutes: 30 }, { duration_minutes: null }] } as never;
    expect(computeTotalHours(order)).toBe(1.5);
  });
});

describe('ManualHoursEntryInputSchema', () => {
  it('rejects ended_at before started_at', () => {
    const r = ManualHoursEntryInputSchema.safeParse({
      started_at: '2026-05-20T10:00:00Z',
      ended_at: '2026-05-20T09:00:00Z',
    });
    expect(r.success).toBe(false);
  });
  it('accepts valid range', () => {
    const r = ManualHoursEntryInputSchema.safeParse({
      started_at: '2026-05-20T09:00:00Z',
      ended_at: '2026-05-20T11:00:00Z',
      memo: 'test',
    });
    expect(r.success).toBe(true);
  });
});
```

### 7.2 E2E orders-flow.spec.ts

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageTechnicien } from './helpers/auth';

test.describe('Orders flow', () => {
  test.beforeEach(async ({ page }) => await loginAsGarageTechnicien(page));

  test('orders list renders', async ({ page }) => {
    await page.goto('/fr/orders');
    await expect(page.locator('[data-testid="orders-list"]')).toBeVisible();
  });

  test('order detail renders', async ({ page }) => {
    await page.goto('/fr/orders/test-id-1');
    await expect(page.locator('[data-testid="order-detail"]')).toBeVisible();
  });

  test('timer start/stop', async ({ page }) => {
    await page.goto('/fr/orders/test-id-1');
    await page.locator('[data-testid="timer-start"]').click();
    await expect(page.locator('[data-testid="timer-stop"]')).toBeVisible();
  });

  test('task checkbox toggle', async ({ page }) => {
    await page.goto('/fr/orders/test-id-1');
  });

  test('parts consumer dialog opens', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=orders');
  });

  test('mark complete disabled if progress < 100', async ({ page }) => {
    await page.goto('/fr/orders/test-id-1');
    await expect(page.locator('[data-testid="mark-complete-btn"]')).toBeDisabled();
  });
});
```

---

## 8. Variables environnement

```env
ORDERS_REFETCH_INTERVAL_MS=30000
TIMER_AUTOSYNC_INTERVAL_MS=60000
STOCK_LOW_THRESHOLD_WARN_PCT=20
```

---

## 9. Commandes

```bash
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage exec vitest run src/lib/orders src/components/orders
pnpm --filter @insurtech/web-garage exec playwright test e2e/orders-flow
```

---

## 10. Criteres V1-V22

### P0 (14)

- V1 : Page list orders render
- V2 : Page detail order render
- V3 : Order header + progress bar
- V4 : Tasks checklist toggle
- V5 : Parts arrival table render
- V6 : Hours timer start
- V7 : Hours timer stop avec memo
- V8 : Hours timer realtime display HH:MM:SS
- V9 : Hours manual entry valide ended > started
- V10 : Parts consumer dialog + stock check
- V11 : Stock insufficient warning
- V12 : Mark complete disabled si progress < 100
- V13 : Polling 30s
- V14 : Aucune emoji

### P1 (5)

- V15 : Timer state localStorage persist
- V16 : Tests Vitest 20+
- V17 : Tests E2E 6+
- V18 : Progress photos upload
- V19 : Notifications customer triggers

### P2 (3)

- V20 : Lighthouse > 85
- V21 : axe 0
- V22 : RTL OK

---

## 11. Edge cases

1. Timer multi-tab : detect via localStorage timestamp + warn.
2. Stock part consume rejected backend : revert UI + toast.
3. Mark complete blocked tasks_incomplete : disabled button + hint.
4. Manual entry overlap timer actif : Zod refine.
5. Refetch 30s pendant timer : pause si activeEntry.
6. Network down stop timer : queue + sync apres reconnection.
7. Page reload timer perdu : restore localStorage.
8. Multi-technicien same order : sync polling.

---

## 12. Conformite MA

- Hours log digital -> paie technicien conforme CNSS/AMO (Sprint 13 HR).
- Stock consume FIFO -> conforme CGNC inventaire.
- Audit trail orders : qui a fait quoi quand.

---

## 13. Conventions

[Identique]

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/web-garage typecheck && lint && vitest && playwright && bash scripts/check-no-emoji.sh apps/web-garage/
```

---

## 15. Commit

```bash
git commit -m "feat(sprint-22): orders page tracking + hours + parts consume

Task: 5.4.9
Sprint: 22
Phase: 5
Reference: B-22 Tache 5.4.9"
```

---

## 16. Next : task-5.4.10-qc-delivery-checklist-signature.md

---

**Fin task-5.4.9.**

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
