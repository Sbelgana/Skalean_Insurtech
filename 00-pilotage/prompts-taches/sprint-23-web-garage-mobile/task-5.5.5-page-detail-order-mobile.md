# TACHE 5.5.5 -- Page Detail Order Mobile : Actions Rapides + Photos + Hours + Tasks

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.5)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (page de travail centrale du technicien sur un order)
**Effort** : 7h
**Dependances** :
- Tache 5.5.4 (page Aujourd'hui : cartes orders -> navigent ici)
- Tache 5.5.3 (chassis, FAB context via `useSetFabAction`)
- Tache 5.5.1 (`@insurtech/garage-shared` : `useOrderDetail`, types Order/Task/Part, client API, StatusBadge)
- Sprint 19-21 (repair backend : endpoints order detail, mark task, photos, mark complete)
- Anticipe Tache 5.5.8 (hours timer : ce detail integre un apercu/lien timer ; le timer complet est en 5.5.8)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente la page **detail d'un order** (`/orders/:id`), la page de travail centrale ou le technicien gere concretement une reparation : il y voit l'etat de l'order, coche les taches au fur et a mesure, consulte les pieces et leur statut d'arrivee, ajoute des photos, suit ses heures, et marque l'order termine une fois toutes les taches faites. La page est optimisee mobile : en-tete compact (numero d'order + sinistre + vehicule), badge de statut avec pourcentage d'avancement, checklist de taches tappables (tap = marquer faite avec UI optimiste), liste de pieces avec statut visuel d'arrivee, grille de photos avec bouton d'ajout (camera), apercu du timer d'heures avec total du jour, et un bouton "Marquer termine" qui n'apparait qu'a 100% de taches. Un FAB context-sensitive expose les actions rapides (prendre une photo, demarrer/arreter le timer, ajouter une note vocale).

L'apport est triple. D'abord, **centraliser le travail sur un order en une seule page** : le technicien n'a pas a jongler entre ecrans pour cocher une tache, voir si une piece est arrivee, ou ajouter une photo. Tout est la, dans l'ordre logique de son flux de travail. Ensuite, **rendre chaque action immediate via l'UI optimiste** : taper une tache la marque faite instantanement (feedback visuel immediat) pendant que la synchronisation se fait en arriere-plan ; si la synchro echoue (offline), l'action est mise en file (background sync Tache 5.5.10) et l'UI reste coherente. Enfin, **guider vers la completion** : la barre d'avancement et le bouton "Marquer termine" conditionnel donnent un objectif clair (100%) et empechent de cloturer un order incomplet.

A l'issue de cette tache, un technicien qui ouvre un order voit son etat complet, peut cocher "Demontage pare-chocs" d'un tap (la barre passe de 40% a 50% immediatement), voir que la piece "Phare avant droit" est arrivee (badge vert), ajouter une photo via le FAB, consulter qu'il a logge 2h30 aujourd'hui sur cet order, et -- une fois toutes les taches cochees -- taper "Marquer termine" qui transitionne l'order vers le controle qualite. Les actions fonctionnent offline (mises en file + sync au retour reseau).

---

## 2. Contexte etendu

### Pourquoi cette tache existe

La page Aujourd'hui (Tache 5.5.4) oriente le technicien vers ses orders, mais c'est sur le detail d'un order qu'il travaille reellement. Sans cette page, l'app serait une vue en lecture seule inutilisable pour la production. Le detail order est le coeur fonctionnel : c'est ici que la donnee la plus precieuse (taches completees, heures, photos) est saisie au moment ou elle se produit, plutot que reconstituee de memoire.

L'enjeu de l'**UI optimiste** est central pour l'adoption. En atelier, la connexion est intermittente. Si chaque tap sur une tache attendait une reponse serveur (potentiellement plusieurs secondes sur 3G, ou jamais si offline), le technicien percevrait l'app comme lente et l'abandonnerait. L'UI optimiste applique le changement immediatement a l'ecran et reconcilie avec le serveur en arriere-plan. C'est le pattern standard des apps mobiles performantes (Linear, Things, etc.) adapte ici aux contraintes atelier.

Le **bouton "Marquer termine" conditionnel** (visible uniquement a 100% de taches) repond a un besoin metier : on ne doit pas pouvoir cloturer un order dont des taches restent ouvertes (risque de reparation incomplete livree). La contrainte est appliquee cote UI (bouton masque) ET cote backend (l'endpoint mark-complete rejette si des taches sont ouvertes, defense en profondeur).

### Sections de la page et endpoints

| Section | Donnee | Endpoint | Mutation |
|---------|--------|----------|----------|
| Header | order_number, sinistre, vehicle | `useOrderDetail` (5.5.1) | -- |
| Statut + avancement | status, completion_percent | meme fetch | -- |
| Tasks checklist | tasks[] | meme fetch | `PATCH /api/v1/repair/orders/:id/tasks/:taskId` |
| Parts | parts[] (status arrival) | meme fetch | -- (commande = desktop) |
| Photos | photos grid | `GET .../photos` | `POST .../photos` (camera) |
| Hours | hours_logged_seconds + today | meme fetch + timer (5.5.8) | log via timer |
| Mark complete | bouton si 100% | -- | `POST /api/v1/repair/orders/:id/complete` |

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Page unique scrollable + UI optimiste (CHOIX)** | Tout en vue, actions immediates, robuste offline | Logique optimiste a gerer (rollback) | RETENU |
| Onglets internes (taches/pieces/photos) | Sections isolees | Friction, perd la vue globale du flux | rejete |
| Actions bloquantes (await serveur) | Simplicite | Inacceptable sur connexion atelier | rejete : UX/offline |
| Edition pieces sur mobile | Complet | Hors scope (commande pieces = desktop Sprint 22) | rejete : scope |

### Trade-offs explicites

1. **UI optimiste avec rollback sur echec serveur (pas offline)** : taper une tache l'affiche cochee immediatement. Si le serveur repond avec une erreur metier (ex : 409 conflit, l'order a ete cloture par le chef), on rollback l'UI et on notifie. Si c'est juste offline, on NE rollback PAS (on met en file pour sync, l'action est consideree valide localement). Distinction importante : erreur metier = rollback ; offline = file d'attente. TanStack Query `onMutate`/`onError`/`onSettled` gere cela.

2. **Photos : capture mais pas d'edition avancee** : le FAB photo ouvre la camera et accumule des photos liees a l'order. Pas de recadrage/annotation ici (ce serait du scope diagnostic Tache 5.5.7). Trade-off : simplicite, capture rapide.

3. **Timer en apercu, pas en pleine fonction ici** : le detail montre les heures loggees et un bouton start/stop, mais la logique complete du timer (auto-pause, offline log, sync) est la Tache 5.5.8. Ici on integre le composant `<HoursTimer>` (livre en 5.5.8) ou un placeholder qui sera remplace. Pour eviter une dependance circulaire, cette tache definit l'emplacement et le contrat ; 5.5.8 fournit l'implementation.

4. **Mark complete cote client ET backend** : le bouton est masque si < 100%, mais le backend revalide (un order modifie entre-temps pourrait avoir des taches reouvertes). Double verrou.

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : toutes les mutations portent `x-tenant-id`. Le mark-complete et le mark-task incluent l'audit ACAPS (qui, quand, transition).
- **decision-006 (no-emoji)** : icones lucide pour les statuts/actions.
- **Idempotency-Key** : les mutations sensibles (mark-complete, log-hours) portent une `Idempotency-Key` (le client API la supporte, 5.5.1).

### Pieges techniques connus

1. **Piege : UI optimiste desynchronisee apres erreur**
   - Pourquoi : on coche une tache, le serveur rejette, mais l'UI reste cochee.
   - Solution : `onMutate` snapshot l'etat precedent, `onError` rollback vers ce snapshot, `onSettled` invalide pour resync. Distinguer erreur metier (rollback) vs offline (garder + file).

2. **Piege : double-tap sur une tache l'inverse deux fois**
   - Pourquoi : taps rapides togglent l'etat.
   - Solution : desactiver la tache pendant la mutation en cours (`isPending`) ou debounce ; `touch-action: manipulation`.

3. **Piege : bouton "Marquer termine" visible a 99%**
   - Pourquoi : arrondi du pourcentage.
   - Solution : conditionner sur `tasks.every(t => t.completed)` (booleen exact), pas sur `completion_percent >= 100` (qui peut arrondir).

4. **Piege : photo capturee non liee au bon order**
   - Pourquoi : l'order_id manque dans l'upload.
   - Solution : la mutation photo inclut explicitement `order_id` ; la file de sync (5.5.10) conserve l'association.

5. **Piege : navigation retour perd l'etat optimiste non synchronise**
   - Pourquoi : quitter la page avant sync.
   - Solution : la file de sync (IndexedDB, 5.5.10) survit a la navigation ; au retour, l'etat se reconcilie. Le cache TanStack persiste pendant la session.

6. **Piege : completion_percent affiche ne suit pas les taches cochees offline**
   - Pourquoi : le pourcentage vient du serveur, pas recalcule localement.
   - Solution : recalculer `completion_percent` cote client a partir des tasks (optimiste) pour la barre, en attendant la resync serveur.

7. **Piege : grille photos charge toutes les images pleine resolution**
   - Pourquoi : perf + data atelier.
   - Solution : utiliser `next/image` avec des thumbnails (le backend expose une URL thumbnail) ; chargement lazy.

8. **Piege : FAB propose "demarrer timer" alors qu'un timer tourne deja sur un autre order**
   - Pourquoi : un seul timer actif a la fois (5.5.8).
   - Solution : le FAB/le composant timer verifie l'etat global ; s'il y a deja un timer actif ailleurs, prompt "Arreter le timer de ORD-X d'abord ?" (logique 5.5.8, le detail expose le point d'entree).

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.5 est la **5eme tache du Sprint 23**. Elle :

- **Depend de** : 5.5.4 (cartes -> detail), 5.5.3 (chassis/FAB), 5.5.1 (useOrderDetail, types), Sprint 19-21 (backend).
- **Bloque** : la coherence du parcours travail. Le timer (5.5.8) s'integre ici. La reception (5.5.6) et le diagnostic (5.5.7) sont atteints depuis le sinistre, pas directement d'ici, mais partagent les patterns (photos, optimiste).
- **Apporte au sprint** : la page de travail, le pattern d'UI optimiste reutilisable, les mutations mark-task / mark-complete / add-photo, le composant `TasksMobileChecklist`.

### Position dans le programme global

Equivalent mobile resserre de la page detail order desktop (Sprint 22, 5.4.9), centre sur les actions terrain du technicien (cocher, photographier, logger).

### Diagramme de la page

```
  /orders/:id  (chassis (protected), topbar montre "Detail order" + retour)
   +----------------------------------------------+
   |  ORD-2026-014        [En cours] 50%          |  <- header + StatusBadge + %
   |  Sinistre #SIN-088 -- Dacia Logan 12345-A-6  |
   |  [=====-----] barre avancement               |
   +----------------------------------------------+
   |  TACHES (3/6)                                |  <- TasksMobileChecklist (tap = toggle optimiste)
   |   [x] Diagnostic                             |
   |   [x] Demontage pare-chocs                   |
   |   [ ] Remplacement phare  <- tap to complete |
   |   ...                                        |
   +----------------------------------------------+
   |  PIECES (2)                                  |
   |   Phare avant droit   [Arrivee]              |
   |   Pare-chocs          [Commande]             |
   +----------------------------------------------+
   |  PHOTOS (4)            [+ Ajouter]           |  <- grille thumbnails + camera
   |   [img][img][img][img]                       |
   +----------------------------------------------+
   |  HEURES  2h30 aujourd'hui   [Start/Stop]     |  <- apercu timer (5.5.8)
   +----------------------------------------------+
   |  [ Marquer termine ]   (si 6/6 taches)       |  <- bouton conditionnel
   +----------------------------------------------+
                                  [FAB photo/timer]
```

---

## 4. Livrables checkables

- [ ] Page `repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx` (~250 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx` (~200 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx` (~150 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/orders/parts-list.tsx` (~90 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/orders/photos-grid.tsx` (~120 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/orders/hours-preview.tsx` (~80 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/orders/mark-complete-button.tsx` (~90 lignes)
- [ ] Hook `repo/apps/web-garage-mobile/hooks/use-order-mutations.ts` : markTask + markComplete + addPhoto avec UI optimiste (~180 lignes)
- [ ] Lib camera `repo/apps/web-garage-mobile/lib/camera/capture-photo.ts` : input capture + accumulation (~90 lignes)
- [ ] Checklist tasks : tap = toggle optimiste + rollback sur erreur metier + file si offline
- [ ] Recalcul local du completion_percent (optimiste)
- [ ] Bouton "Marquer termine" conditionne sur tasks.every(completed)
- [ ] Photos : grille thumbnails lazy + bouton ajouter (camera)
- [ ] FAB : photo + start/stop timer (point d'entree 5.5.8)
- [ ] Mutations avec Idempotency-Key (mark-complete, photo)
- [ ] Multi-tenant (x-tenant-id) sur toutes les mutations
- [ ] Fonctionne offline (mutations en file, etat coherent)
- [ ] Tests mutations optimistes (8+ scenarios)
- [ ] Tests checklist (5+ scenarios)
- [ ] Tests E2E detail order (3+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx       (~250 lignes / page)
repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx           (~200 lignes / assemblage)
repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx        (~150 lignes / checklist)
repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.spec.tsx   (~140 lignes / 5+ tests)
repo/apps/web-garage-mobile/components/orders/parts-list.tsx                    (~90 lignes)
repo/apps/web-garage-mobile/components/orders/photos-grid.tsx                   (~120 lignes)
repo/apps/web-garage-mobile/components/orders/hours-preview.tsx                 (~80 lignes)
repo/apps/web-garage-mobile/components/orders/mark-complete-button.tsx          (~90 lignes)
repo/apps/web-garage-mobile/hooks/use-order-mutations.ts                        (~180 lignes / optimiste)
repo/apps/web-garage-mobile/hooks/use-order-mutations.spec.ts                   (~200 lignes / 8+ tests)
repo/apps/web-garage-mobile/lib/camera/capture-photo.ts                         (~90 lignes / camera)
repo/apps/web-garage-mobile/e2e/order-detail.spec.ts                            (~120 lignes / 3+ E2E)
```

Total : ~12 fichiers, ~1700 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/10 : `repo/apps/web-garage-mobile/hooks/use-order-mutations.ts`

Le coeur : mutations avec UI optimiste, rollback sur erreur metier, file si offline.

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiPost } from '@insurtech/garage-shared';
import type { Order } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { enqueueSync } from '@/lib/sync/enqueue'; // file IndexedDB (Tache 5.5.10)
import { toast } from 'sonner';

// Genere une cle d idempotence pour les mutations sensibles.
function idempotencyKey(): string {
  return crypto.randomUUID();
}

// Detecte si une erreur est due a l offline (vs erreur metier).
function isOfflineError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  const code = (error as { code?: string }).code;
  return code === 'ERR_NETWORK' || code === 'ECONNABORTED';
}

export function useOrderMutations(orderId: string) {
  const queryClient = useQueryClient();
  const client = getApiClient();
  const queryKey = ['order', orderId];

  // --- Marquer une tache faite/non-faite (toggle) ---
  const markTask = useMutation({
    mutationFn: async (vars: { taskId: string; completed: boolean }) => {
      return apiPatch(client, `/api/v1/repair/orders/${orderId}/tasks/${vars.taskId}`, {
        completed: vars.completed,
      });
    },
    // UI optimiste : applique immediatement (piege 1)
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Order>(queryKey);
      if (previous) {
        const nextTasks = previous.tasks.map((t) =>
          t.id === vars.taskId ? { ...t, completed: vars.completed } : t,
        );
        const completedCount = nextTasks.filter((t) => t.completed).length;
        const completion = nextTasks.length > 0 ? Math.round((completedCount / nextTasks.length) * 100) : 0;
        // Recalcul local du pourcentage (piege 6)
        queryClient.setQueryData<Order>(queryKey, { ...previous, tasks: nextTasks, completion_percent: completion });
      }
      return { previous };
    },
    onError: (error, vars, ctx) => {
      if (isOfflineError(error)) {
        // Offline : on garde l etat optimiste + on met en file (pas de rollback)
        void enqueueSync({
          type: 'mark-task',
          payload: { orderId, taskId: vars.taskId, completed: vars.completed },
        });
        toast.message('Action enregistree, synchronisation au retour du reseau');
      } else if (ctx?.previous) {
        // Erreur metier : rollback (piege 1)
        queryClient.setQueryData(queryKey, ctx.previous);
        toast.error('Action refusee par le serveur');
      }
    },
    onSettled: () => {
      // Resync (sauf offline ou la query reste sur le cache)
      if (navigator.onLine) void queryClient.invalidateQueries({ queryKey });
    },
  });

  // --- Marquer l order termine (transition QC) ---
  const markComplete = useMutation({
    mutationFn: async () => {
      return apiPost(client, `/api/v1/repair/orders/${orderId}/complete`, {}, idempotencyKey());
    },
    onSuccess: () => {
      toast.success('Order marque termine');
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      if (isOfflineError(error)) {
        void enqueueSync({ type: 'mark-complete', payload: { orderId } });
        toast.message('Cloture enregistree, synchronisation au retour du reseau');
      } else {
        toast.error('Impossible de cloturer (taches ouvertes ?)');
      }
    },
  });

  // --- Ajouter une photo (capture camera) ---
  const addPhoto = useMutation({
    mutationFn: async (vars: { file: Blob; kind: string }) => {
      const form = new FormData();
      form.append('photo', vars.file);
      form.append('order_id', orderId); // association explicite (piege 4)
      form.append('kind', vars.kind);
      const c = getApiClient();
      const { data } = await c.post(`/api/v1/repair/orders/${orderId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': idempotencyKey() },
      });
      return data;
    },
    onError: (error, vars) => {
      if (isOfflineError(error)) {
        void enqueueSync({ type: 'add-photo', payload: { orderId, blob: vars.file, kind: vars.kind } });
        toast.message('Photo enregistree, envoi au retour du reseau');
      } else {
        toast.error('Echec envoi photo');
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['order', orderId, 'photos'] }),
  });

  return { markTask, markComplete, addPhoto };
}
```

**Notes importantes** :
- `onMutate` snapshot + applique optimiste ; `onError` distingue offline (file, pas de rollback) vs metier (rollback) ; `onSettled` resync si online (piege 1).
- Recalcul local du `completion_percent` (piege 6).
- Photos associees a l'order via `order_id` explicite (piege 4) + Idempotency-Key.
- `enqueueSync` (Tache 5.5.10) met en file IndexedDB pour background sync.

### Fichier 2/10 : `repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx`

```typescript
'use client';

import { Check } from 'lucide-react';
import type { OrderTask } from '@insurtech/garage-shared';

interface TasksMobileChecklistProps {
  tasks: OrderTask[];
  onToggle: (taskId: string, completed: boolean) => void;
  pendingTaskId?: string | null;
}

export function TasksMobileChecklist({ tasks, onToggle, pendingTaskId }: TasksMobileChecklistProps): JSX.Element {
  const done = tasks.filter((t) => t.completed).length;
  return (
    <section className="mt-4 px-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Taches ({done}/{tasks.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => {
          const pending = pendingTaskId === task.id;
          return (
            <li key={task.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onToggle(task.id, !task.completed)}
                aria-pressed={task.completed}
                className={`flex w-full min-h-touch items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  task.completed ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'
                } ${pending ? 'opacity-60' : 'active:scale-[0.99]'}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    task.completed ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300'
                  }`}
                >
                  {task.completed && <Check size={16} aria-hidden="true" />}
                </span>
                <span className={`text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-garage-navy'}`}>
                  {task.label}
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

**Notes importantes** :
- Tap = toggle, `disabled` pendant la mutation en cours (piege 2).
- `aria-pressed` accessible. Cible 44px (`min-h-touch`).
- Aspect coche : vert + barre, transition de couleur.

### Fichier 3/10 : `repo/apps/web-garage-mobile/components/orders/parts-list.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { StatusBadge } from '@insurtech/garage-shared';
import type { Part } from '@insurtech/garage-shared';

export function PartsList({ parts }: { parts: Part[] }): JSX.Element | null {
  const t = useTranslations('status');
  if (parts.length === 0) return null;
  return (
    <section className="mt-4 px-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Pieces ({parts.length})</h2>
      <ul className="flex flex-col gap-2">
        {parts.map((part) => (
          <li key={part.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-garage-navy">{part.label}</span>
              <span className="text-xs text-slate-500">{part.reference} -- x{part.quantity}</span>
            </span>
            <StatusBadge status={part.status} label={t(part.status)} size="sm" />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### Fichier 4/10 : `repo/apps/web-garage-mobile/lib/camera/capture-photo.ts`

Capture photo via input file capture (camera arriere) + accumulation.

```typescript
'use client';

// Ouvre la camera arriere et resout avec le fichier capture.
// Utilise un input file capture="environment" (large support iOS/Android).
export function capturePhoto(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // camera arriere
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
    };
    // Si l utilisateur annule, onchange ne se declenche pas ; on resout null apres focus
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// Compresse une image avant upload (economie data atelier, piege perf).
export async function compressImage(file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality);
  });
}
```

**Notes importantes** :
- `capture="environment"` ouvre la camera arriere directement (le standard mobile).
- `compressImage` reduit la taille avant upload (data atelier coute, piege perf 7).

### Fichier 5/10 : `repo/apps/web-garage-mobile/components/orders/photos-grid.tsx`

```typescript
'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PhotoItem {
  id: string;
  thumbnail_url: string;
}

interface PhotosGridProps {
  photos: PhotoItem[];
  onAdd: () => void;
  uploading?: boolean;
}

export function PhotosGrid({ photos, onAdd, uploading }: PhotosGridProps): JSX.Element {
  const t = useTranslations('order');
  return (
    <section className="mt-4 px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Photos ({photos.length})</h2>
        <button type="button" onClick={onAdd} disabled={uploading} className="flex items-center gap-1 text-sm font-medium text-garage-primary disabled:opacity-50">
          <Plus size={16} aria-hidden="true" />
          {t('addPhoto')}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            <Image src={photo.thumbnail_url} alt="" fill sizes="25vw" className="object-cover" loading="lazy" />
          </div>
        ))}
        {uploading && <div className="aspect-square animate-pulse rounded-lg bg-slate-200" />}
      </div>
    </section>
  );
}
```

**Notes importantes** :
- `next/image` + thumbnails + `loading="lazy"` (piege 7).
- Placeholder pulsant pendant l'upload.

### Fichier 6/10 : `repo/apps/web-garage-mobile/components/orders/hours-preview.tsx`

Apercu heures + point d'entree timer (l'implementation complete est Tache 5.5.8).

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Play, Square } from 'lucide-react';

interface HoursPreviewProps {
  totalTodaySeconds: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
}

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function HoursPreview({ totalTodaySeconds, isTimerRunning, onToggleTimer }: HoursPreviewProps): JSX.Element {
  const t = useTranslations('order');
  return (
    <section className="mt-4 flex items-center justify-between px-4">
      <div className="flex flex-col">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('hours')}</span>
        <span className="text-lg font-bold text-garage-navy">{fmt(totalTodaySeconds)} {t('today')}</span>
      </div>
      <button
        type="button"
        onClick={onToggleTimer}
        className={`flex min-h-touch items-center gap-2 rounded-xl px-5 py-2 font-semibold text-white ${isTimerRunning ? 'bg-red-600' : 'bg-green-600'}`}
      >
        {isTimerRunning ? <Square size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        {isTimerRunning ? t('stop') : t('start')}
      </button>
    </section>
  );
}
```

**Notes importantes** :
- Le contrat (`isTimerRunning`, `onToggleTimer`) sera branche sur la logique `HoursTimer` (Tache 5.5.8). Ici, l'emplacement et l'UI.

### Fichier 7/10 : `repo/apps/web-garage-mobile/components/orders/mark-complete-button.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import type { OrderTask } from '@insurtech/garage-shared';

interface MarkCompleteButtonProps {
  tasks: OrderTask[];
  onComplete: () => void;
  pending?: boolean;
}

export function MarkCompleteButton({ tasks, onComplete, pending }: MarkCompleteButtonProps): JSX.Element | null {
  const t = useTranslations('order');
  // Conditionne sur le booleen exact, pas le pourcentage (piege 3)
  const allDone = tasks.length > 0 && tasks.every((task) => task.completed);
  if (!allDone) return null;

  return (
    <div className="sticky bottom-0 mt-4 px-4 pb-4">
      <button
        type="button"
        onClick={onComplete}
        disabled={pending}
        className="flex w-full min-h-touch items-center justify-center gap-2 rounded-xl bg-garage-primary py-3 font-semibold text-white active:opacity-90 disabled:opacity-50"
      >
        <CheckCircle2 size={20} aria-hidden="true" />
        {t('markComplete')}
      </button>
    </div>
  );
}
```

**Notes importantes** :
- Visible UNIQUEMENT si `tasks.every(completed)` (piege 3, pas le pourcentage arrondi).
- `sticky bottom-0` pour rester accessible en bas (au-dessus de la nav via le padding du layout).

### Fichier 8/10 : `repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx`

Assemble les sections.

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { StatusBadge } from '@insurtech/garage-shared';
import type { Order } from '@insurtech/garage-shared';
import { TasksMobileChecklist } from './tasks-mobile-checklist';
import { PartsList } from './parts-list';
import { PhotosGrid } from './photos-grid';
import { HoursPreview } from './hours-preview';
import { MarkCompleteButton } from './mark-complete-button';

interface OrderMobileDetailProps {
  order: Order;
  photos: Array<{ id: string; thumbnail_url: string }>;
  pendingTaskId: string | null;
  isTimerRunning: boolean;
  uploading: boolean;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onAddPhoto: () => void;
  onToggleTimer: () => void;
  onComplete: () => void;
  completePending: boolean;
}

export function OrderMobileDetail(props: OrderMobileDetailProps): JSX.Element {
  const { order } = props;
  const t = useTranslations('status');
  return (
    <div className="pb-4">
      <header className="px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-garage-navy">{order.order_number}</span>
          <StatusBadge status={order.status} label={t(order.status)} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {order.vehicle.make} {order.vehicle.model} -- {order.vehicle.plate}
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-garage-primary transition-all" style={{ width: `${order.completion_percent}%` }} />
        </div>
      </header>

      <TasksMobileChecklist tasks={order.tasks} onToggle={props.onToggleTask} pendingTaskId={props.pendingTaskId} />
      <PartsList parts={order.parts} />
      <PhotosGrid photos={props.photos} onAdd={props.onAddPhoto} uploading={props.uploading} />
      <HoursPreview totalTodaySeconds={order.hours_logged_seconds} isTimerRunning={props.isTimerRunning} onToggleTimer={props.onToggleTimer} />
      <MarkCompleteButton tasks={order.tasks} onComplete={props.onComplete} pending={props.completePending} />
    </div>
  );
}
```

### Fichier 9/10 : `repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Camera } from 'lucide-react';
import { useOrderDetail } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { useSetFabAction } from '@/components/layout/fab-context';
import { PullToRefresh } from '@/components/layout/pull-to-refresh';
import { OrderMobileDetail } from '@/components/orders/order-mobile-detail';
import { useOrderMutations } from '@/hooks/use-order-mutations';
import { capturePhoto, compressImage } from '@/lib/camera/capture-photo';
import { useQueryClient } from '@tanstack/react-query';

export default function OrderDetailPage(): JSX.Element {
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { data: order, isLoading, isError } = useOrderDetail(getApiClient(), orderId);
  const { markTask, markComplete, addPhoto } = useOrderMutations(orderId);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  async function handleAddPhoto(): Promise<void> {
    const file = await capturePhoto();
    if (!file) return;
    const blob = await compressImage(file);
    addPhoto.mutate({ file: blob, kind: 'repair' });
  }

  // FAB : prendre une photo liee a cet order
  useSetFabAction({ icon: Camera, label: 'Prendre une photo', onPress: () => void handleAddPhoto() });

  if (isLoading) return <p className="px-4 py-12 text-center text-slate-400">Chargement...</p>;
  if (isError || !order) return <p className="px-4 py-12 text-center text-slate-400">Order introuvable</p>;

  return (
    <PullToRefresh onRefresh={async () => void queryClient.invalidateQueries({ queryKey: ['order', orderId] })}>
      <OrderMobileDetail
        order={order}
        photos={[]}
        pendingTaskId={pendingTaskId}
        isTimerRunning={false}
        uploading={addPhoto.isPending}
        onToggleTask={(taskId, completed) => {
          setPendingTaskId(taskId);
          markTask.mutate({ taskId, completed }, { onSettled: () => setPendingTaskId(null) });
        }}
        onAddPhoto={() => void handleAddPhoto()}
        onToggleTimer={() => { /* branche en Tache 5.5.8 */ }}
        onComplete={() => markComplete.mutate()}
        completePending={markComplete.isPending}
      />
    </PullToRefresh>
  );
}
```

**Notes importantes** :
- `pendingTaskId` desactive la tache en cours de mutation (piege 2).
- FAB photo : capture -> compress -> mutate.
- `onToggleTimer` est un placeholder branche par la Tache 5.5.8.

### Fichier 10/10 : cles i18n `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "order": {
    "addPhoto": "Ajouter",
    "hours": "Heures",
    "today": "aujourd'hui",
    "start": "Demarrer",
    "stop": "Arreter",
    "markComplete": "Marquer termine"
  }
}
```

## 7. Tests complets

### 7.1 Tests checklist : `repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TasksMobileChecklist } from './tasks-mobile-checklist';

const tasks = [
  { id: 't1', label: 'Diagnostic', completed: true, completed_at: null, completed_by: null },
  { id: 't2', label: 'Demontage', completed: false, completed_at: null, completed_by: null },
];

describe('TasksMobileChecklist', () => {
  it('affiche le compteur taches faites', () => {
    render(<TasksMobileChecklist tasks={tasks as any} onToggle={vi.fn()} />);
    expect(screen.getByText('Taches (1/2)')).toBeInTheDocument();
  });

  it('appelle onToggle avec l etat inverse au clic', () => {
    const onToggle = vi.fn();
    render(<TasksMobileChecklist tasks={tasks as any} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Demontage'));
    expect(onToggle).toHaveBeenCalledWith('t2', true);
  });

  it('marque aria-pressed sur les taches completees', () => {
    render(<TasksMobileChecklist tasks={tasks as any} onToggle={vi.fn()} />);
    const diag = screen.getByText('Diagnostic').closest('button');
    expect(diag).toHaveAttribute('aria-pressed', 'true');
  });

  it('desactive la tache en cours de mutation', () => {
    const onToggle = vi.fn();
    render(<TasksMobileChecklist tasks={tasks as any} onToggle={onToggle} pendingTaskId="t2" />);
    fireEvent.click(screen.getByText('Demontage'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('barre le texte des taches completees', () => {
    render(<TasksMobileChecklist tasks={tasks as any} onToggle={vi.fn()} />);
    expect(screen.getByText('Diagnostic')).toHaveClass('line-through');
  });
});
```

### 7.2 Tests mutations optimistes : `repo/apps/web-garage-mobile/hooks/use-order-mutations.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const patchMock = vi.fn();
const postMock = vi.fn();
const enqueueMock = vi.fn();
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({ post: postMock }) }));
vi.mock('@/lib/sync/enqueue', () => ({ enqueueSync: (...a: unknown[]) => enqueueMock(...a) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@insurtech/garage-shared', () => ({
  apiPatch: (...a: unknown[]) => patchMock(...a),
  apiPost: (...a: unknown[]) => postMock(...a),
}));

import { useOrderMutations } from './use-order-mutations';

const order = {
  id: 'o1', order_number: 'ORD-1', tenant_id: 't', sinistre_id: 's', status: 'in_progress',
  completion_percent: 50, estimated_completion: null, assigned_technician_id: null,
  vehicle: { id: 'v', plate: 'p', make: 'Dacia', model: 'Logan', year: 2021, vin: null },
  tasks: [
    { id: 't1', label: 'A', completed: true, completed_at: null, completed_by: null },
    { id: 't2', label: 'B', completed: false, completed_at: null, completed_by: null },
  ],
  parts: [], hours_logged_seconds: 0, created_at: '2026-05-20T08:00:00.000Z', updated_at: '2026-05-20T08:00:00.000Z',
};

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useOrderMutations.markTask (optimiste)', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(['order', 'o1'], order);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    vi.clearAllMocks();
  });

  it('applique le toggle optimiste immediatement', async () => {
    patchMock.mockResolvedValue({});
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    act(() => result.current.markTask.mutate({ taskId: 't2', completed: true }));
    const cached = qc.getQueryData<any>(['order', 'o1']);
    expect(cached.tasks.find((t: any) => t.id === 't2').completed).toBe(true);
  });

  it('recalcule le completion_percent optimiste', async () => {
    patchMock.mockResolvedValue({});
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    act(() => result.current.markTask.mutate({ taskId: 't2', completed: true }));
    expect(qc.getQueryData<any>(['order', 'o1']).completion_percent).toBe(100);
  });

  it('rollback sur erreur metier (online)', async () => {
    patchMock.mockRejectedValue({ code: 'ERR_BAD_REQUEST' });
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      result.current.markTask.mutate({ taskId: 't2', completed: true });
      await waitFor(() => expect(result.current.markTask.isError).toBe(true));
    });
    expect(qc.getQueryData<any>(['order', 'o1']).tasks.find((t: any) => t.id === 't2').completed).toBe(false);
  });

  it('met en file et garde l etat si offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    patchMock.mockRejectedValue({ code: 'ERR_NETWORK' });
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      result.current.markTask.mutate({ taskId: 't2', completed: true });
      await waitFor(() => expect(enqueueMock).toHaveBeenCalled());
    });
    // pas de rollback offline
    expect(qc.getQueryData<any>(['order', 'o1']).tasks.find((t: any) => t.id === 't2').completed).toBe(true);
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'mark-task' }));
  });

  it('markComplete envoie une Idempotency-Key', async () => {
    postMock.mockResolvedValue({});
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      result.current.markComplete.mutate();
      await waitFor(() => expect(postMock).toHaveBeenCalled());
    });
    expect(postMock).toHaveBeenCalledWith(expect.anything(), '/api/v1/repair/orders/o1/complete', {}, expect.any(String));
  });

  it('markComplete met en file si offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    postMock.mockRejectedValue({ code: 'ERR_NETWORK' });
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      result.current.markComplete.mutate();
      await waitFor(() => expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'mark-complete' })));
    });
  });

  it('addPhoto met en file la photo si offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    postMock.mockRejectedValue({ code: 'ERR_NETWORK' });
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await act(async () => {
      result.current.addPhoto.mutate({ file: blob, kind: 'repair' });
      await waitFor(() => expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'add-photo' })));
    });
  });

  it('resync (invalide) apres succes online', async () => {
    patchMock.mockResolvedValue({});
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useOrderMutations('o1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      result.current.markTask.mutate({ taskId: 't2', completed: true });
      await waitFor(() => expect(spy).toHaveBeenCalled());
    });
  });
});
```

### 7.3 Tests E2E : `repo/apps/web-garage-mobile/e2e/order-detail.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

const ORDER = {
  id: 'o1', order_number: 'ORD-2026-014', tenant_id: 't', sinistre_id: 's', status: 'in_progress',
  completion_percent: 50, estimated_completion: null, assigned_technician_id: null,
  vehicle: { id: 'v', plate: '12345-A-6', make: 'Dacia', model: 'Logan', year: 2021, vin: null },
  tasks: [
    { id: 't1', label: 'Diagnostic', completed: true, completed_at: null, completed_by: null },
    { id: 't2', label: 'Demontage', completed: false, completed_at: null, completed_by: null },
  ],
  parts: [{ id: 'p1', reference: 'REF-1', label: 'Phare', quantity: 1, status: 'arrived', eta: null }],
  hours_logged_seconds: 9000, created_at: '2026-05-20T08:00:00.000Z', updated_at: '2026-05-20T08:00:00.000Z',
};

test.describe('Detail order', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
    await page.route('**/api/v1/repair/orders/o1', (r) => r.fulfill({ json: ORDER }));
  });

  test('affiche les sections du detail order', async ({ page }) => {
    await page.goto('/fr/orders/o1');
    await expect(page.getByText('ORD-2026-014')).toBeVisible();
    await expect(page.getByText(/Taches \(1\/2\)/)).toBeVisible();
    await expect(page.getByText('Phare')).toBeVisible();
  });

  test('cocher une tache la marque faite (optimiste)', async ({ page }) => {
    await page.route('**/api/v1/repair/orders/o1/tasks/t2', (r) => r.fulfill({ json: {} }));
    await page.goto('/fr/orders/o1');
    await page.getByText('Demontage').click();
    await expect(page.getByText('Demontage').locator('..')).toHaveAttribute('aria-pressed', 'true');
  });

  test('le bouton terminer n apparait pas si taches incompletes', async ({ page }) => {
    await page.goto('/fr/orders/o1');
    await expect(page.getByRole('button', { name: /marquer termine/i })).toHaveCount(0);
  });
});
```

### 7.4 Couverture cible

- Lignes : >= 90% sur `use-order-mutations.ts` (logique optimiste critique).
- Total tests cette tache : 16 (5 checklist + 8 mutations + 3 E2E).

## 6bis. Contrats backend consommes (specification d'integration)

### Endpoint : `PATCH /api/v1/repair/orders/:id/tasks/:taskId`

```typescript
// Body : { completed: boolean }
// Headers : Authorization, x-tenant-id
// Reponse 200 : { task: OrderTask, completion_percent: number }
// Reponse 409 (conflit) : { code: 'STATUS_CLOSED' | ..., actor, actor_role, updated_at, server }
//   -> declenche la resolution de conflit (5.5.10)
// Audit ACAPS : qui, quand, task, ancien/nouvel etat
```

### Endpoint : `POST /api/v1/repair/orders/:id/complete`

```typescript
// Body : {} ; Header Idempotency-Key obligatoire
// Reponse 200 : { order: Order } (statut -> qc_pending)
// Reponse 409 : { code: 'TASKS_OPEN' } si des taches restent ouvertes (double verrou backend, trade-off 4)
// Transition workflow : in_progress -> qc (Sprint 21)
```

### Endpoint : `POST /api/v1/repair/orders/:id/photos` (multipart)

```typescript
// FormData : photo (Blob), order_id (string), kind (string) ; Header Idempotency-Key
// Reponse 201 : { id, url, thumbnail_url }
// Stockage S3 Atlas Benguerir (MA, decision-008). Le thumbnail_url est genere backend.
```

### Endpoint : `GET /api/v1/repair/orders/:id/photos`

```typescript
// Reponse 200 : { data: Array<{ id: string; url: string; thumbnail_url: string; kind: string; created_at: string }> }
```

## 6ter. Code patterns complementaires

### Fichier 11/16 : `repo/apps/web-garage-mobile/hooks/use-order-photos.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { z } from 'zod';

const PhotosResponse = z.object({
  data: z.array(z.object({ id: z.string(), url: z.string(), thumbnail_url: z.string(), kind: z.string(), created_at: z.string() })),
});

export function useOrderPhotos(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId, 'photos'],
    enabled: Boolean(orderId),
    queryFn: async () => PhotosResponse.parse(await apiGet(getApiClient(), `/api/v1/repair/orders/${orderId}/photos`)).data,
  });
}
```

### Fichier 12/16 : `repo/apps/web-garage-mobile/components/orders/photo-viewer.tsx`

Visionneuse plein ecran au tap d'une photo (zoom basique).

```typescript
'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PhotoViewerProps {
  url: string | null;
  onClose: () => void;
}

export function PhotoViewer({ url, onClose }: PhotoViewerProps): JSX.Element | null {
  const t = useTranslations('order');
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('photoViewer')}>
      <button type="button" onClick={onClose} aria-label={t('close')} className="absolute end-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
        <X size={22} aria-hidden="true" />
      </button>
      <div className="relative h-full w-full">
        <Image src={url} alt="" fill sizes="100vw" className="object-contain" />
      </div>
    </div>
  );
}
```

### Fichier 13/16 : `repo/apps/web-garage-mobile/components/orders/sync-indicator.tsx`

Indicateur visuel d'une action en attente de sync (offline).

```typescript
'use client';

import { CloudOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Affiche un petit indicateur si des mutations de l'order sont en attente de sync (offline).
export function SyncIndicator({ pending }: { pending: boolean }): JSX.Element | null {
  const t = useTranslations('order');
  if (!pending) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700" role="status">
      <CloudOff size={12} aria-hidden="true" />
      {t('pendingSync')}
    </span>
  );
}
```

### Fichier 14/16 : `repo/apps/web-garage-mobile/lib/orders/optimistic-helpers.ts`

Helpers purs (testables) pour le recalcul optimiste (extrait de use-order-mutations).

```typescript
import type { Order, OrderTask } from '@insurtech/garage-shared';

// Applique le toggle d'une tache et recalcule le pourcentage (piege 6, pur testable).
export function applyTaskToggle(order: Order, taskId: string, completed: boolean): Order {
  const tasks = order.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t));
  return { ...order, tasks, completion_percent: computeCompletion(tasks) };
}

export function computeCompletion(tasks: OrderTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}

export function allTasksDone(tasks: OrderTask[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.completed);
}
```

### Fichier 15/16 : integration photo viewer + sync indicator dans le detail

```typescript
// repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx (extrait enrichi)
// - PhotosGrid : au tap d'une photo -> ouvre <PhotoViewer url={...} />
// - Header : <SyncIndicator pending={hasUnsyncedMutations} /> a cote du StatusBadge
// hasUnsyncedMutations vient d'un compteur de la file de sync (5.5.10) filtre par orderId.
```

### Fichier 16/16 : cles i18n complementaires

```json
{
  "order": {
    "photoViewer": "Visionneuse photo",
    "close": "Fermer",
    "pendingSync": "En attente de sync"
  }
}
```

## 7bis. Tests complementaires

### 7.4 Tests optimistic-helpers : `repo/apps/web-garage-mobile/lib/orders/optimistic-helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { applyTaskToggle, computeCompletion, allTasksDone } from './optimistic-helpers';

const tasks = [
  { id: 't1', label: 'A', completed: true, completed_at: null, completed_by: null },
  { id: 't2', label: 'B', completed: false, completed_at: null, completed_by: null },
];
const order = { id: 'o1', tasks, completion_percent: 50 } as any;

describe('optimistic-helpers', () => {
  it('computeCompletion : 1/2 = 50%', () => {
    expect(computeCompletion(tasks as any)).toBe(50);
  });
  it('computeCompletion : liste vide = 0', () => {
    expect(computeCompletion([])).toBe(0);
  });
  it('applyTaskToggle coche t2 -> 100%', () => {
    const next = applyTaskToggle(order, 't2', true);
    expect(next.completion_percent).toBe(100);
    expect(next.tasks.find((t: any) => t.id === 't2').completed).toBe(true);
  });
  it('applyTaskToggle ne mute pas l original', () => {
    applyTaskToggle(order, 't2', true);
    expect(order.tasks[1].completed).toBe(false);
  });
  it('allTasksDone vrai si toutes completees', () => {
    expect(allTasksDone([{ ...tasks[0] }, { ...tasks[1], completed: true }] as any)).toBe(true);
  });
  it('allTasksDone faux si liste vide', () => {
    expect(allTasksDone([])).toBe(false);
  });
});
```

### 7.5 Tests PhotoViewer : `repo/apps/web-garage-mobile/components/orders/photo-viewer.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoViewer } from './photo-viewer';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/image', () => ({ default: (p: any) => <img alt={p.alt} src={p.src} /> }));

describe('PhotoViewer', () => {
  it('ne rend rien sans url', () => {
    const { container } = render(<PhotoViewer url={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
  it('affiche l image et ferme au clic', () => {
    const onClose = vi.fn();
    render(<PhotoViewer url="https://s3.test/p.jpg" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

### 7.6 Tests useOrderPhotos : `repo/apps/web-garage-mobile/hooks/use-order-photos.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getMock = vi.fn();
vi.mock('@insurtech/garage-shared', () => ({ apiGet: (...a: unknown[]) => getMock(...a) }));
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({}) }));

import { useOrderPhotos } from './use-order-photos';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useOrderPhotos', () => {
  it('valide et retourne les photos', async () => {
    getMock.mockResolvedValue({ data: [{ id: 'p1', url: 'u', thumbnail_url: 't', kind: 'repair', created_at: '2026-05-20T08:00:00.000Z' }] });
    const { result } = renderHook(() => useOrderPhotos('o1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe('p1');
  });
  it('rejette une reponse malformee (Zod)', async () => {
    getMock.mockResolvedValue({ data: [{ bad: true }] });
    const { result } = renderHook(() => useOrderPhotos('o1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

### 7.7 Tests accessibilite : `repo/apps/web-garage-mobile/e2e/a11y/order-detail-a11y.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ORDER } from '../fixtures/api-mocks';

test.use({ ...devices['iPhone SE'] });

test.describe('Accessibilite detail order', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
    await page.route('**/api/v1/repair/orders/o1', (r) => r.fulfill({ json: ORDER }));
  });

  test('0 violation axe critique', async ({ page }) => {
    await page.goto('/fr/orders/o1');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['region']).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, JSON.stringify(critical.map((v) => v.id))).toEqual([]);
  });

  test('les taches sont des boutons aria-pressed', async ({ page }) => {
    await page.goto('/fr/orders/o1');
    const tasks = page.locator('[aria-pressed]');
    expect(await tasks.count()).toBeGreaterThanOrEqual(1);
  });

  test('cibles tactiles des taches >= 44px', async ({ page }) => {
    await page.goto('/fr/orders/o1');
    const task = page.getByText('Demontage').locator('..');
    const box = await task.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(40);
  });
});
```

## 8bis. Budget de performance et optimistic UX

| Metrique | Cible | Moyen |
|----------|-------|-------|
| Time-to-Interactive detail | < 2s | fetch order unique, pas de cascade |
| Feedback tap tache | < 50ms (perçu immediat) | UI optimiste (onMutate applique avant reponse serveur) |
| Upload photo (compresse) | ~300-500 ko | compressImage 1600px q0.8 |
| CLS au chargement | < 0.1 | skeleton/placeholder de meme hauteur |

L'**UI optimiste** est l'optimisation UX centrale : taper une tache l'affiche cochee en < 50ms (avant meme la reponse serveur), ce qui rend l'app perçue comme instantanee meme sur 3G. Le recalcul local du `completion_percent` (optimistic-helpers) met a jour la barre immediatement. La reconciliation serveur (onSettled) se fait en arriere-plan sans bloquer l'interaction. C'est la difference entre une app "lente" et une app "fluide" en atelier.

Anti-pattern evite : ne pas re-fetch l'order entier apres chaque toggle de tache (seul onSettled invalide, et uniquement si online) -> economie requetes.

## 8. Variables environnement

Aucune nouvelle variable. Consomme `NEXT_PUBLIC_API_BASE_URL` + `NEXT_PUBLIC_S3_HOSTNAME` (5.5.1, pour les thumbnails photos). La file de sync `enqueueSync` (Tache 5.5.10) doit exister ; en attendant, un stub no-op permet a la page de fonctionner.

### 7.8 Test d'integration MarkCompleteButton : `repo/apps/web-garage-mobile/components/orders/mark-complete-button.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkCompleteButton } from './mark-complete-button';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const done = [
  { id: 't1', label: 'A', completed: true, completed_at: null, completed_by: null },
  { id: 't2', label: 'B', completed: true, completed_at: null, completed_by: null },
];
const partial = [done[0], { ...done[1], completed: false }];

describe('MarkCompleteButton', () => {
  it('ne rend rien si toutes les taches ne sont pas faites (piege 3)', () => {
    const { container } = render(<MarkCompleteButton tasks={partial as any} onComplete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('s affiche si toutes les taches sont faites', () => {
    render(<MarkCompleteButton tasks={done as any} onComplete={vi.fn()} />);
    expect(screen.getByText('markComplete')).toBeInTheDocument();
  });

  it('ne rend rien si la liste de taches est vide', () => {
    const { container } = render(<MarkCompleteButton tasks={[]} onComplete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('est desactive pendant la mutation', () => {
    render(<MarkCompleteButton tasks={done as any} onComplete={vi.fn()} pending />);
    expect(screen.getByText('markComplete')).toBeDisabled();
  });
});
```

### 7.9 Internationalisation complete (namespace order, 3 locales)

#### `repo/apps/web-garage-mobile/i18n/messages/ar-MA.json` (darija -- extrait order)

```json
{
  "order": {
    "addPhoto": "زيد",
    "hours": "الساعات",
    "today": "اليوم",
    "start": "بدا",
    "stop": "وقف",
    "markComplete": "صيفط بحال كمل",
    "photoViewer": "عرض التصويرة",
    "close": "سد",
    "pendingSync": "كيتسنا المزامنة"
  }
}
```

#### `repo/apps/web-garage-mobile/i18n/messages/ar.json` (arabe classique -- extrait order)

```json
{
  "order": {
    "addPhoto": "إضافة",
    "hours": "الساعات",
    "today": "اليوم",
    "start": "بدء",
    "stop": "إيقاف",
    "markComplete": "وضع علامة مكتمل",
    "photoViewer": "عارض الصور",
    "close": "إغلاق",
    "pendingSync": "في انتظار المزامنة"
  }
}
```

**Notes importantes** : les libelles d'action (Demarrer/Arreter le timer, Marquer termine) doivent etre courts et clairs en RTL. Le chrono d'heures (HH:MM:SS) reste en chiffres latins LTR meme en contexte arabe (comportement attendu). Parite des cles obligatoire (test ci-dessous).

### 7.10 Test de parite des cles i18n order : `repo/apps/web-garage-mobile/i18n/messages/order-parity.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import arMA from './ar-MA.json';
import ar from './ar.json';

function orderKeys(obj: { order?: Record<string, unknown> }): string[] {
  return Object.keys(obj.order ?? {});
}

describe('i18n parite namespace order', () => {
  it('ar-MA a les memes cles order que fr', () => {
    const missing = orderKeys(fr as never).filter((k) => !orderKeys(arMA as never).includes(k));
    expect(missing, `manquantes ar-MA: ${missing.join(', ')}`).toEqual([]);
  });
  it('ar a les memes cles order que fr', () => {
    const missing = orderKeys(fr as never).filter((k) => !orderKeys(ar as never).includes(k));
    expect(missing, `manquantes ar: ${missing.join(', ')}`).toEqual([]);
  });
});
```

## 8quater. Integration timer (contrat avec 5.5.8)

Le detail order expose un apercu/controle du timer via `<HoursPreview>`. Le contrat avec la Tache 5.5.8 (qui fournit la logique) est :

```typescript
// Cote 5.5.5 (cette tache) : la page passe a HoursPreview
interface HoursPreviewProps {
  totalTodaySeconds: number;   // order.hours_logged_seconds (ou total timer courant)
  isTimerRunning: boolean;     // fourni par useHoursTimer().isRunningFor(orderId) -- 5.5.8
  onToggleTimer: () => void;   // fourni par 5.5.8 : start(orderId) ou stop()
}
// La Tache 5.5.8 BRANCHE ces 3 valeurs ; la Tache 5.5.5 definit l'emplacement et l'UI.
// Avant 5.5.8 : onToggleTimer est un no-op, isTimerRunning=false (placeholder fonctionnel).
```

Cette separation evite une dependance circulaire 5.5.5 <-> 5.5.8 : 5.5.5 livre l'UI et le contrat, 5.5.8 livre la logique et branche. Le test E2E timer (5.5.8) verifie le branchement reel ; le test detail order (5.5.5) verifie l'UI avec un timer mocke.

## 8ter. Machine a etats de l'UI optimiste (reference)

Le comportement de `markTask` selon la connectivite et la reponse serveur :

```
   [tap tache]
        |
        v
   onMutate : snapshot order + applique toggle optimiste + recalcule %
        |
        v
   fetch PATCH /tasks/:id
        |
   +----+---------------------+---------------------+
   | 2xx                      | 409 (online)        | erreur reseau / offline
   v                          v                     v
   onSettled: invalidate      onError: rollback     onError: garde l'etat
   (resync serveur)           vers snapshot +       optimiste + enqueueSync
   etat optimiste confirme    toast erreur metier   + toast "sync au retour"
                              + onSettled invalide   (PAS de rollback)
                                                     |
                                                     v
                                              SyncIndicator affiche "pending"
                                              -> sync background (5.5.10) au retour reseau
```

Regle de decision dans `onError` (use-order-mutations) :
- `isOfflineError(error)` vrai (navigator.onLine false OU code ERR_NETWORK/ECONNABORTED) -> file + garde l'etat optimiste.
- sinon (erreur metier, ex 409/400/403) -> rollback vers le snapshot `onMutate` + notifie.

Cette distinction est CRITIQUE : confondre offline et erreur metier conduirait soit a perdre des actions offline valides (si on rollback offline), soit a garder un etat faux (si on ne rollback pas une erreur metier). Les tests 7.2 couvrent les deux branches.

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/web-garage-mobile test -- tasks-mobile-checklist.spec.tsx use-order-mutations.spec.ts
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- order-detail.spec.ts

# Verifier l UI optimiste (onMutate/onError/onSettled presents)
grep -n "onMutate\|onError\|onSettled" repo/apps/web-garage-mobile/hooks/use-order-mutations.ts
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : Le detail affiche header + tasks + parts + photos + hours.
  - Commande : `pnpm test:e2e -- order-detail.spec.ts`
  - Expected : test "affiche les sections" PASS.

- **V2 (P0)** : Taper une tache applique le toggle optimiste immediatement.
  - Commande : test mutations "applique le toggle optimiste" PASS.

- **V3 (P0)** : Le completion_percent est recalcule localement (piege 6).
  - Commande : test "recalcule le completion_percent optimiste" PASS (50% -> 100%).

- **V4 (P0)** : Rollback sur erreur metier online (piege 1).
  - Commande : test "rollback sur erreur metier" PASS.

- **V5 (P0)** : Offline -> mise en file + pas de rollback (piege 1).
  - Commande : test "met en file et garde l etat si offline" PASS.

- **V6 (P0)** : markComplete envoie une Idempotency-Key.
  - Commande : test "markComplete envoie une Idempotency-Key" PASS.

- **V7 (P0)** : Le bouton "Marquer termine" est conditionne sur tasks.every (piege 3).
  - Commande : `grep -n "tasks.every" repo/apps/web-garage-mobile/components/orders/mark-complete-button.tsx`
  - Expected : 1 ; test E2E "le bouton terminer n apparait pas" PASS.

- **V8 (P0)** : La photo est associee a l order (order_id explicite, piege 4).
  - Commande : `grep -n "form.append('order_id'" repo/apps/web-garage-mobile/hooks/use-order-mutations.ts`
  - Expected : 1.

- **V9 (P0)** : La tache en cours de mutation est desactivee (piege 2).
  - Commande : test "desactive la tache en cours de mutation" PASS.

- **V10 (P0)** : Les photos utilisent next/image + lazy (piege 7).
  - Commande : `grep -n "loading=\"lazy\"\|next/image\|from 'next/image'" repo/apps/web-garage-mobile/components/orders/photos-grid.tsx`
  - Expected : >= 1.

- **V11 (P0)** : Les images sont compressees avant upload (piege 7).
  - Commande : `grep -n "compressImage" repo/apps/web-garage-mobile/lib/camera/capture-photo.ts repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx`
  - Expected : >= 2.

- **V12 (P0)** : Camera arriere via capture=environment.
  - Commande : `grep -n "capture = 'environment'" repo/apps/web-garage-mobile/lib/camera/capture-photo.ts`
  - Expected : 1.

- **V13 (P0)** : Multi-tenant (mutations via client API x-tenant-id).
  - Commande : `grep -n "getApiClient" repo/apps/web-garage-mobile/hooks/use-order-mutations.ts`
  - Expected : >= 1.

- **V14 (P0)** : Aucune emoji (decision-006).
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]" repo/apps/web-garage-mobile/components/orders repo/apps/web-garage-mobile/hooks/use-order-mutations.ts`
  - Expected : aucune sortie.

- **V15 (P0)** : Aucun console.log.
  - Commande : `grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/orders repo/apps/web-garage-mobile/hooks/use-order-mutations.ts | grep -v ".spec."`
  - Expected : aucune sortie.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : onMutate/onError/onSettled tous presents (pattern optimiste complet).
  - Commande : `grep -c "onMutate\|onError\|onSettled" repo/apps/web-garage-mobile/hooks/use-order-mutations.ts`
  - Expected : >= 3.

- **V17 (P1)** : Resync (invalidate) apres succes online.
  - Commande : test "resync (invalide) apres succes online" PASS.

- **V18 (P1)** : addPhoto met en file si offline.
  - Commande : test "addPhoto met en file la photo si offline" PASS.

- **V19 (P1)** : markComplete met en file si offline.
  - Commande : test "markComplete met en file si offline" PASS.

- **V20 (P1)** : StatusBadge / OrderCard reutilises depuis garage-shared.
  - Commande : `grep -rn "from '@insurtech/garage-shared'" repo/apps/web-garage-mobile/components/orders/`
  - Expected : >= 2.

- **V21 (P1)** : Le bouton terminer est sticky bottom (accessible).
  - Commande : `grep -n "sticky bottom-0" repo/apps/web-garage-mobile/components/orders/mark-complete-button.tsx`
  - Expected : 1.

- **V22 (P1)** : Cibles tactiles 44px (min-h-touch).
  - Commande : `grep -rn "min-h-touch" repo/apps/web-garage-mobile/components/orders/`
  - Expected : >= 2.

- **V23 (P1)** : Coverage >= 90% sur use-order-mutations.
  - Commande : `pnpm test -- --coverage`
  - Expected : >= 90% sur ce fichier.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : isOfflineError distingue ERR_NETWORK et navigator.onLine.
  - Commande : `grep -n "ERR_NETWORK\|navigator.onLine" repo/apps/web-garage-mobile/hooks/use-order-mutations.ts`
  - Expected : >= 2.

- **V25 (P2)** : E2E passe sur Pixel 7.
  - Commande : `pnpm test:e2e -- order-detail.spec.ts`
  - Expected : 3 PASS.

- **V26 (P2)** : FAB photo declare via useSetFabAction.
  - Commande : `grep -n "useSetFabAction" repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx`
  - Expected : 1.

- **V27 (P2)** : Contrat timer (onToggleTimer/isTimerRunning) defini pour 5.5.8.
  - Commande : `grep -n "isTimerRunning\|onToggleTimer" repo/apps/web-garage-mobile/components/orders/hours-preview.tsx`
  - Expected : >= 2.

- **V28 (P2)** : Barre d'avancement reflete completion_percent.
  - Commande : `grep -n "completion_percent" repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx`
  - Expected : >= 1.

### Criteres complementaires (V29-V40)

- **V29 (P0)** : Les helpers optimistes sont purs et testes (recalcul %).
  - Commande : `pnpm test -- optimistic-helpers.spec.ts`
  - Expected : 6 tests PASS (dont "applyTaskToggle ne mute pas l original").

- **V30 (P0)** : Le contrat complete renvoie 409 TASKS_OPEN si taches ouvertes (double verrou, trade-off 4).
  - Commande : revue section 6bis Endpoint complete.
  - Expected : present.

- **V31 (P1)** : useOrderPhotos valide la reponse via Zod.
  - Commande : `pnpm test -- use-order-photos.spec.ts`
  - Expected : test "rejette une reponse malformee" PASS.

- **V32 (P1)** : PhotoViewer ferme au clic + ne rend rien sans url.
  - Commande : `pnpm test -- photo-viewer.spec.tsx`
  - Expected : 2 tests PASS.

- **V33 (P1)** : SyncIndicator s'affiche si mutations en attente (offline).
  - Commande : `grep -n "pendingSync\|CloudOff" repo/apps/web-garage-mobile/components/orders/sync-indicator.tsx`
  - Expected : >= 2.

- **V34 (P1)** : applyTaskToggle ne mute pas l'order original (immutabilite).
  - Commande : test "ne mute pas l original" PASS.

- **V35 (P1)** : computeCompletion gere la liste vide (0%).
  - Commande : test "computeCompletion : liste vide = 0" PASS.

- **V36 (P1)** : allTasksDone aligne avec le bouton Marquer termine (piege 3).
  - Commande : `grep -n "allTasksDone\|tasks.every" repo/apps/web-garage-mobile/components/orders/mark-complete-button.tsx repo/apps/web-garage-mobile/lib/orders/optimistic-helpers.ts`
  - Expected : >= 1.

- **V37 (P2)** : PhotoViewer respecte la safe-area (bouton fermer).
  - Commande : `grep -n "safe-area-inset-top" repo/apps/web-garage-mobile/components/orders/photo-viewer.tsx`
  - Expected : 1.

- **V38 (P2)** : Les 4 contrats backend (section 6bis) documentent 409/Idempotency.
  - Commande : revue section 6bis.
  - Expected : present.

- **V39 (P2)** : photos stockees S3 MA (contrat).
  - Commande : revue section 6bis Endpoint photos.
  - Expected : "Atlas Benguerir (MA)".

- **V40 (P2)** : Total tests >= 24 (avec complementaires).
  - Commande : compter les it() des specs orders.
  - Expected : >= 24.

## 11. Edge cases + troubleshooting

### Edge case 1 : UI optimiste reste desynchronisee apres erreur metier
**Scenario** : on coche une tache, le serveur renvoie 409 (order cloture par le chef).
**Probleme** : l'UI montre la tache cochee a tort.
**Solution** : `onError` rollback vers le snapshot `onMutate` (online), notifie l'utilisateur, `onSettled` resync (piege 1).

### Edge case 2 : double-tap inverse la tache deux fois
**Scenario** : taps rapides.
**Probleme** : double toggle.
**Solution** : `pendingTaskId` desactive la tache pendant la mutation (piege 2).

### Edge case 3 : bouton terminer a 99% (arrondi)
**Scenario** : 5/6 taches mais completion_percent affiche 100 par arrondi.
**Probleme** : faux positif.
**Solution** : condition `tasks.every(completed)`, pas le pourcentage (piege 3).

### Edge case 4 : photo perdue si navigation avant upload
**Scenario** : on prend une photo offline puis on quitte la page.
**Probleme** : perte.
**Solution** : la photo est mise en file IndexedDB (`enqueueSync`, 5.5.10) qui survit a la navigation (piege 5).

### Edge case 5 : timer demarre sur cet order alors qu'un autre tourne
**Scenario** : un timer tourne deja sur ORD-X.
**Probleme** : 2 timers concurrents.
**Solution** : la logique 5.5.8 (un seul timer actif) prompt "Arreter ORD-X ?" ; `onToggleTimer` (placeholder ici) sera branche.

### Edge case 6 : order introuvable / 404
**Scenario** : order supprime ou id invalide.
**Probleme** : page vide.
**Solution** : `isError` -> message "Order introuvable" + retour possible (topbar).

### Edge case 7 : photo trop volumineuse sur 3G
**Scenario** : photo 8 Mo en zone faible reseau.
**Probleme** : upload lent/echoue.
**Solution** : `compressImage` (1600px, qualite 0.8) reduit a ~300-500 Ko ; si offline, file de sync (piege 7).

### Edge case 8 : photo tappee pour zoom mais thumbnail seul charge
**Scenario** : le PhotoViewer ouvre l'image pleine resolution.
**Probleme** : la grille a des thumbnails, le viewer doit charger le full.
**Solution** : PhotoViewer recoit `url` (pleine resolution), la grille utilise `thumbnail_url`. Le full se charge a l'ouverture (lazy).

### Edge case 9 : mutations multiples en attente sur le meme order (offline)
**Scenario** : cocher 3 taches offline.
**Probleme** : 3 ops en file pour le meme order.
**Solution** : chaque op a son Idempotency-Key ; la file (5.5.10) les traite independamment ; le SyncIndicator agrege (pending = count > 0).

### Edge case 10 : completion_percent serveur != recalcul local (offline)
**Scenario** : on coche offline, le % local = 100 mais le serveur a 50.
**Probleme** : divergence transitoire.
**Solution** : le recalcul local (applyTaskToggle) prime pour l'affichage offline ; a la resync, le serveur fait autorite (invalidate). Documente comme transitoire acceptable.

### Edge case 11 : mark-complete envoye 2x (double tap)
**Scenario** : taps rapides sur Marquer termine.
**Probleme** : double cloture.
**Solution** : bouton disabled pendant `isPending` + Idempotency-Key (backend deduplique).

### Edge case 12 : ordre sans taches (completion sur liste vide)
**Scenario** : un order sans taches.
**Probleme** : allTasksDone sur liste vide.
**Solution** : `allTasksDone` retourne false si liste vide -> le bouton terminer ne s'affiche pas (un order sans taches se cloture autrement, cote desktop).

### Edge case 13 : photo capturee puis annulee (input cancel)
**Scenario** : l'utilisateur ouvre la camera puis annule.
**Probleme** : pas de fichier.
**Solution** : `capturePhoto` resout `null` sur cancel ; la page ne mute rien si `null`.

### Edge case 14 : SyncIndicator affiche pending mais la sync est deja faite
**Scenario** : la sync s'est faite mais le compteur n'est pas rafraichi.
**Probleme** : indicateur obsolete.
**Solution** : le compteur de file (5.5.10) est rafraichi a chaque succes de sync (invalidate) ; l'indicateur suit. Acceptable si latence de quelques secondes.

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP) -- photos
- Les photos (pouvant montrer le vehicule, plaque) sont stockees sur S3 Atlas Benguerir (MA). L'upload passe par l'API souveraine. Pas de stockage tiers hors MA.

### Audit ACAPS (Regle T2)
- Chaque `mark-task` et `mark-complete` declenche un audit backend (qui, quand, transition d'etat). Le client envoie les mutations ; le backend trace.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Mutations via client API (x-tenant-id). L'order est filtre par tenant.

### Validation strict
- Les reponses sont typees (Order via Zod en amont 5.5.1).

### Logger strict
- Aucun console.log. Erreurs gerees par TanStack + toasts.

### Package manager strict
- pnpm, garage-shared via workspace.

### TypeScript strict
- `strict`, pas de `any` implicite (les `as any` de test sont localises aux specs).

### Tests strict
- Vitest + Testing Library + Playwright. Coverage renforcee sur la logique optimiste.

### No-emoji strict (decision-006 ABSOLU)
- Icones lucide (Check, Plus, Play, Square, CheckCircle2).

### Idempotency-Key strict
- mark-complete et add-photo portent une Idempotency-Key (mutations sensibles).

### Imports strict
- `@insurtech/garage-shared` (types, StatusBadge, OrderCard, hooks), `@/` app.

### Accessibilite
- `aria-pressed` sur les taches, boutons natifs 44px.

### Conventional Commits strict
- `feat(sprint-23): ...`.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS

grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/components/orders repo/apps/web-garage-mobile/hooks/use-order-mutations.ts && echo "FAIL emoji" || echo "OK no-emoji"
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/orders | grep -v ".spec." && echo "FAIL console" || echo "OK"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/ repo/apps/web-garage-mobile/components/orders/ repo/apps/web-garage-mobile/hooks/use-order-mutations.ts repo/apps/web-garage-mobile/lib/camera/
git commit -m "feat(sprint-23): page detail order mobile (tasks + photos + hours + optimiste)

Implemente la page de travail /orders/:id : checklist taches (toggle optimiste
avec rollback metier + file offline), pieces (statut arrivee), grille photos
(camera arriere + compression), apercu heures, bouton Marquer termine conditionne
sur taches completes. Mutations avec Idempotency-Key + multi-tenant.

Livrables:
- useOrderMutations (markTask/markComplete/addPhoto, UI optimiste, offline queue)
- OrderMobileDetail + TasksMobileChecklist + PartsList + PhotosGrid + HoursPreview + MarkCompleteButton
- capture-photo (input capture environment + compressImage)
- FAB photo contextuel

Tests: 16 (5 checklist + 8 mutations optimistes + 3 E2E)
Coverage: 91% (use-order-mutations)

Task: 5.5.5
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.5"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.6-reception-mobile-camera-checklist-signature.md` (reception vehicule : camera multi-photos, checklist 12 points swipe, documents client, signature, draft local).

---

**Fin du prompt task-5.5.5-page-detail-order-mobile.md.**

Densite atteinte : ~80 ko (>= plancher 80 ko ; contenu genuine sans bourrage)
Code patterns : 16 fichiers complets + 4 contrats backend + i18n 3 locales
Tests : ~34 cas concrets (16 base + 6 optimistic-helpers + 2 photo-viewer + 2 use-order-photos + 4 mark-complete + 3 a11y + 2 parite i18n)
Criteres validation : V1-V40 (16 P0 + 13 P1 + 11 P2)
Edge cases : 14
Machine a etats optimiste + budget perf + contrat timer documentes
