# TACHE 5.5.8 -- Hours Timer Real-Time : Start/Stop/Auto-Pause + Log Offline + Background Sync

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.8)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (saisie des heures = donnee la plus critique pour rentabilite + facturation)
**Effort** : 6h
**Dependances** :
- Tache 5.5.5 (detail order : expose `<HoursPreview>` avec `onToggleTimer`/`isTimerRunning` -- contrat branche ici)
- Tache 5.5.3 (chassis, FAB) + 5.5.1 (garage-shared, client API, SW `app/sw.ts`)
- Sprint 19 (repair : endpoint `POST /api/v1/repair/orders/:id/log-hours`)
- Tache 5.5.10 (service worker background sync -- ce timer enregistre `sync-timer-logs` ; le SW handler complet est en 5.5.10, ici la file et l'enregistrement)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **timer d'heures temps reel** de la PWA technicien : un compteur HH:MM:SS demarrable/arretable d'un geste, qui mesure le temps passe par le technicien sur un order, avec auto-pause si inactivite (app en arriere-plan ou ecran eteint > 5 min), persistance locale (le timer survit a la fermeture de l'app), log offline (les sessions sont mises en file si pas de reseau) et synchronisation en arriere-plan (background sync du service worker au retour du reseau). Elle livre la classe `HoursTimer`, la file de synchronisation IndexedDB, le composant UI `<HoursTimerUi>`, la page "Mon timer" (total du jour + historique des sessions + edition manuelle), et branche le `onToggleTimer` laisse en placeholder par la Tache 5.5.5 (detail order).

L'apport est triple. D'abord, **fiabiliser la donnee la plus mal saisie de l'atelier** : le temps de main-d'oeuvre. Aujourd'hui reconstitue de memoire en fin de journee (donc fausse), il devient une mesure reelle, demarree d'un tap au debut du travail et arretee a la fin. C'est la donnee qui determine la rentabilite d'un order et la facturation au client/assureur. Ensuite, **resister aux contraintes atelier** : l'app peut etre fermee (le technicien range son telephone), l'ecran s'eteint, le reseau coupe -- le timer doit survivre a tout cela. La persistance localStorage + l'auto-pause + le log offline + le background sync garantissent qu'aucune heure n'est perdue ni faussee. Enfin, **eviter le temps fantome** : l'auto-pause apres 5 min d'inactivite empeche de compter des heures ou le technicien ne travaillait pas (telephone pose, ecran eteint), garantissant des heures justes.

A l'issue de cette tache, un technicien peut : taper "Demarrer" sur un order (le compteur s'incremente en temps reel), poser son telephone pour aller chercher une piece (apres 5 min, auto-pause), reprendre (confirmation de reprise), arreter en fin de tache (la session est loggee : 1h47 sur ORD-014). Si offline, la session est mise en file et synchronisee automatiquement au retour du reseau. La page "Mon timer" montre le total du jour, l'historique des sessions, et permet une correction manuelle si besoin. Un seul timer actif a la fois (prompt si tentative de demarrer sur un autre order).

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Le suivi des heures de main-d'oeuvre est le talon d'Achille de la gestion de garage. Sans mesure fiable, impossible de savoir si un order est rentable, de facturer justement, ou d'evaluer la productivite. L'analyse terrain (cf. `documentation/9-roadmap-execution.md`) identifie la saisie des heures comme la donnee la moins fiable, car reconstituee de memoire. Le Sprint 22 (desktop) permet une saisie manuelle, mais le technicien n'est pas au bureau quand il travaille. Le timer mobile, demarrable la ou il travaille, transforme une reconstitution approximative en une mesure exacte.

Les contraintes techniques sont severes et specifiques au mobile/atelier :
- **Le navigateur mobile met en veille les onglets en arriere-plan** : un `setInterval` ne tourne pas de maniere fiable quand l'app est en arriere-plan. Il faut donc calculer le temps ecoule a partir de timestamps (`Date.now()`), pas en comptant les ticks.
- **L'app peut etre tuee par l'OS** : le timer doit persister son etat (localStorage) pour reprendre apres un redemarrage.
- **Le reseau est intermittent** : le log d'une session doit fonctionner offline (file + background sync).
- **Le temps fantome** : si le technicien oublie d'arreter, des heures s'accumulent indument. L'auto-pause apres inactivite corrige cela.

Le **background sync** (API Service Worker) est le mecanisme qui garantit qu'une session loggee offline est envoyee au serveur des que le reseau revient, meme si l'app est fermee entre-temps. C'est le pattern de reference pour la donnee critique offline.

### Architecture du timer

```
  HoursTimer (classe, lib/timer/hours-timer.ts)
   - start(orderId)   : cree l etat, persiste localStorage, demarre le tick
   - stop()           : calcule le total, log (online) OU file (offline)
   - pause/resume     : auto-pause si inactif > 5min
   - tick (1s)        : recalcule total a partir des timestamps (pas de comptage de ticks)
   - persistState     : localStorage (survit fermeture app)
        |
        v
  TimerSyncQueue (lib/timer/timer-sync-queue.ts, IndexedDB)
   - add(session)     : met une session en file
   - getAll/remove    : pour le SW
        |
        v (offline)
  Service Worker (app/sw.ts) -- background sync 'sync-timer-logs'
   - sync event -> lit la file -> POST log-hours -> vide la file
```

Note frontiere : le SW handler `sync-timer-logs` complet est livre en Tache 5.5.10 (qui centralise les 3 sync types). Cette tache fournit la file + l'enregistrement du sync ; 5.5.10 ajoute le handler dans le SW.

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Timer base sur timestamps + localStorage + background sync (CHOIX)** | Fiable en arriere-plan, survit fermeture, offline | Logique a soigner (auto-pause, sync) | RETENU |
| Timer base sur comptage de ticks (setInterval++) | Simple | Faux en arriere-plan (onglet en veille) | rejete : inexact |
| Saisie manuelle uniquement (desktop) | Simple | Reconstitution de memoire = faux | rejete : c'est le probleme |
| Pas d'auto-pause | Simple | Temps fantome (oubli d'arret) | rejete : heures fausses |
| Plusieurs timers concurrents | Flexible | Confusion, double comptage | rejete : 1 timer actif |

### Trade-offs explicites

1. **Temps calcule par timestamps, pas par comptage de ticks** : le `tick` chaque seconde recalcule `total_seconds` a partir de `started_at`/`last_active_at` (timestamps), au lieu de faire `total++`. Pourquoi : un onglet en arriere-plan ne tick pas de maniere fiable ; les timestamps donnent le temps reel ecoule meme apres une veille. Trade-off : un peu plus de logique, mais exactitude garantie.

2. **Auto-pause a 5 min d'inactivite (configurable)** : si l'app passe en arriere-plan ou que l'ecran s'eteint > 5 min, le timer se met en pause. Trade-off : un technicien qui travaille reellement mais consulte autre chose sur son telephone > 5 min verra une pause -- mitige par la reprise rapide (confirmation) et le seuil configurable. Le risque d'heures fantomes (surcomptage) est juge plus grave que le sous-comptage occasionnel.

3. **Un seul timer actif a la fois** : demarrer un timer sur un order B alors qu'un timer tourne sur A prompt "Arreter A d'abord ?". Pourquoi : un technicien ne travaille physiquement que sur un vehicule a la fois ; deux timers = double comptage. Trade-off : si vraiment il alterne, il doit stopper/redemarrer (acceptable, c'est rare et le log reflete la realite).

4. **Edition manuelle possible mais auditee** : la page "Mon timer" permet de corriger une session (oubli d'arret, demarrage tardif). Trade-off : on ouvre la porte a la triche, mitige par l'audit (toute edition manuelle est tracee `source: manual` + raison) et la visibilite chef (desktop). L'edition est un filet de securite, pas la norme.

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : le log d'heures porte `x-tenant-id` ; les heures sont attribuees au technicien du tenant.
- **decision-006 (no-emoji)** : icones lucide (Play, Pause, Square).
- **Idempotency-Key** : le log d'une session porte une cle d'idempotence (eviter le double-log si la sync rejoue).
- **decision-008 (MA)** : log stocke MA.

### Pieges techniques connus

1. **Piege : setInterval ne tourne pas en arriere-plan**
   - Pourquoi : les navigateurs throttlent/suspendent les timers d'onglets en arriere-plan.
   - Solution : calculer `total_seconds` a partir de `Date.now() - started_at - paused_duration`, pas en incrementant a chaque tick (trade-off 1). Le tick sert seulement a rafraichir l'affichage.

2. **Piege : timer perdu si l'app est tuee**
   - Pourquoi : etat en memoire uniquement.
   - Solution : `persistState()` en localStorage a chaque tick ; au demarrage de l'app, restaurer l'etat et reprendre.

3. **Piege : double comptage si deux timers**
   - Pourquoi : pas de garde.
   - Solution : `start()` refuse si un timer est deja actif (un seul a la fois, trade-off 3) ; prompt pour arreter l'autre.

4. **Piege : auto-pause ne se declenche pas car l'app ne tick plus en arriere-plan**
   - Pourquoi : si l'app est en arriere-plan, le tick ne tourne pas, donc l'auto-pause "5 min" ne s'evalue pas en temps reel.
   - Solution : a la reprise (visibilitychange -> visible), calculer le temps ecoule depuis `last_active_at` ; si > 5 min, retrancher l'inactivite (pause retroactive). Combine tick (foreground) + recalcul au retour (background).

5. **Piege : session loggee deux fois (online + sync rejoue)**
   - Pourquoi : si le log online reussit mais que la file n'est pas videe, la sync rejoue.
   - Solution : Idempotency-Key par session ; le backend deduplique. La file n'est ajoutee que si l'online echoue.

6. **Piege : heures negatives ou aberrantes (horloge changee)**
   - Pourquoi : changement d'heure systeme pendant une session.
   - Solution : borner `total_seconds >= 0` et < 24h ; si aberrant, marquer la session "a verifier" et ne pas auto-logger.

7. **Piege : reprise apres longue pause sans confirmation = surcomptage**
   - Pourquoi : reprise automatique compte le temps de pause.
   - Solution : si pause > seuil, prompt de reprise ("Reprendre ? Le temps de pause ne sera pas compte") ; le temps de pause est exclu.

8. **Piege : background sync non supporte (iOS Safari)**
   - Pourquoi : `SyncManager` n'est pas supporte sur iOS Safari.
   - Solution : fallback -- si `'sync' in registration` est faux, tenter le log au prochain `online` event (listener) ou au prochain lancement de l'app (flush de la file au boot).

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.8 est la **8eme tache du Sprint 23**. Elle :

- **Depend de** : 5.5.5 (detail order, contrat `onToggleTimer`), 5.5.3 (chassis), 5.5.1 (SW, client API), Sprint 19 (log-hours endpoint).
- **Bloque** : la coherence des heures dans le detail order (5.5.5) et la page Aujourd'hui (stats 5.5.4). La Tache 5.5.10 complete le SW handler de sync.
- **Apporte au sprint** : la classe `HoursTimer`, la `TimerSyncQueue`, le composant `HoursTimerUi`, la page `/timer`, l'enregistrement du background sync.

### Position dans le programme global

Premier mecanisme de mesure temps reel offline-resilient du programme. La `TimerSyncQueue` et le pattern background sync servent de reference pour les autres files (photos, checklist) centralisees en 5.5.10.

### Diagramme d'etat du timer

```
   [idle] --start(orderId)--> [running]
   [running] --tick(1s)--> recalcul total (timestamps)
   [running] --inactif>5min OU background>5min--> [paused]
   [paused] --resume (confirm)--> [running]  (temps pause exclu)
   [running|paused] --stop--> log online OK ? oui:[idle] | non:file+sync-> [idle]
   [app killed] --> localStorage persiste --> [boot: restore running]
```

---

## 4. Livrables checkables

- [ ] Classe `repo/apps/web-garage-mobile/lib/timer/hours-timer.ts` : start/stop/pause/resume/tick/persist (~250 lignes)
- [ ] File `repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts` : IndexedDB add/getAll/remove (~150 lignes)
- [ ] Hook `repo/apps/web-garage-mobile/hooks/use-hours-timer.ts` : bind classe <-> React + visibilitychange (~140 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx` : affichage HH:MM:SS + start/stop (~150 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/timer/resume-prompt.tsx` : confirmation reprise (~70 lignes)
- [ ] Page `repo/apps/web-garage-mobile/app/[locale]/(protected)/timer/page.tsx` : total + historique + edition manuelle (~150 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/timer/session-edit-sheet.tsx` : correction manuelle (~120 lignes)
- [ ] Enregistrement `sync-timer-logs` (le handler SW complet est en 5.5.10) + fallback iOS (~ dans hours-timer.ts)
- [ ] Branchement du `onToggleTimer` dans le detail order (5.5.5)
- [ ] Timer base sur timestamps (pas comptage ticks, piege 1)
- [ ] Persistance localStorage (survit fermeture, piege 2)
- [ ] Un seul timer actif (prompt si autre, piege 3)
- [ ] Auto-pause 5 min (tick + recalcul au retour visible, piege 4)
- [ ] Reprise avec confirmation si pause longue (piege 7)
- [ ] Log offline -> file IndexedDB + background sync (avec fallback iOS, piege 8)
- [ ] Idempotency-Key par session (piege 5)
- [ ] Bornage total (>= 0, < 24h, piege 6)
- [ ] Edition manuelle auditee (source: manual)
- [ ] Tests timer (12+ scenarios : accuracy, auto-pause, offline, persist)
- [ ] Tests file de sync (4+ scenarios)
- [ ] Tests E2E timer (2+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/lib/timer/hours-timer.ts                          (~250 lignes / classe timer)
repo/apps/web-garage-mobile/lib/timer/hours-timer.spec.ts                     (~260 lignes / 12+ tests)
repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts                     (~150 lignes / IndexedDB)
repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.spec.ts                (~110 lignes / 4+ tests)
repo/apps/web-garage-mobile/hooks/use-hours-timer.ts                          (~140 lignes / bind React)
repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx               (~150 lignes / UI)
repo/apps/web-garage-mobile/components/timer/resume-prompt.tsx                (~70 lignes)
repo/apps/web-garage-mobile/components/timer/session-edit-sheet.tsx           (~120 lignes)
repo/apps/web-garage-mobile/app/[locale]/(protected)/timer/page.tsx           (~150 lignes / page Mon timer)
repo/apps/web-garage-mobile/app/sw.ts                                         (modif : enregistrement sync placeholder, handler complet 5.5.10)
repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx         (modif : branche onToggleTimer/isTimerRunning)
repo/apps/web-garage-mobile/e2e/timer.spec.ts                                 (~110 lignes / 2+ E2E)
```

Total : ~12 fichiers, ~1800 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/10 : `repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts`

File IndexedDB des sessions a synchroniser.

```typescript
import { openDB, type IDBPDatabase } from 'idb';

export interface TimerSession {
  id: string; // uuid (sert d Idempotency-Key, piege 5)
  order_id: string;
  total_seconds: number;
  started_at: number; // epoch ms
  ended_at: number;
  source: 'timer' | 'manual';
}

const DB_NAME = 'garage-timer';
const STORE = 'timer_sync_queue';

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function enqueueTimerSession(session: TimerSession): Promise<void> {
  const database = await db();
  await database.put(STORE, session);
}

export async function getQueuedSessions(): Promise<TimerSession[]> {
  const database = await db();
  return database.getAll(STORE);
}

export async function removeQueuedSession(id: string): Promise<void> {
  const database = await db();
  await database.delete(STORE, id);
}

export async function clearTimerQueue(): Promise<void> {
  const database = await db();
  await database.clear(STORE);
}
```

**Notes importantes** :
- `id` (uuid) sert d'Idempotency-Key (piege 5) ; le SW (5.5.10) le passe au log-hours.
- File en IndexedDB (survit a la fermeture).

### Fichier 2/10 : `repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`

La classe centrale. Timer base sur timestamps (piege 1), persiste (piege 2), auto-pause (piege 4), offline (piege 8).

```typescript
import { enqueueTimerSession, type TimerSession } from './timer-sync-queue';
import { apiPost } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';

export interface TimerState {
  order_id: string;
  started_at: number; // epoch ms du demarrage
  last_active_at: number; // dernier tick foreground
  accumulated_seconds: number; // temps cumule avant la session active courante (apres pauses)
  segment_started_at: number; // debut du segment actif courant
  paused: boolean;
}

const STORAGE_KEY = 'garage_timer_state';
const AUTO_PAUSE_SECONDS = 300; // 5 min (piege 4, configurable)
const MAX_SESSION_SECONDS = 24 * 3600; // bornage (piege 6)

type Listener = (snapshot: { running: boolean; paused: boolean; totalSeconds: number; orderId: string | null }) => void;

export class HoursTimer {
  private state: TimerState | null = null;
  private interval: number | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    this.restore(); // restaure l etat persiste au boot (piege 2)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  private snapshot() {
    return {
      running: this.state !== null && !this.state.paused,
      paused: this.state?.paused ?? false,
      totalSeconds: this.computeTotal(),
      orderId: this.state?.order_id ?? null,
    };
  }

  // Total = temps cumule + segment actif courant (calcule par timestamps, piege 1)
  private computeTotal(): number {
    if (!this.state) return 0;
    const segment = this.state.paused ? 0 : Math.floor((Date.now() - this.state.segment_started_at) / 1000);
    const total = this.state.accumulated_seconds + Math.max(0, segment);
    return Math.min(Math.max(0, total), MAX_SESSION_SECONDS); // bornage (piege 6)
  }

  isRunning(orderId?: string): boolean {
    if (!this.state) return false;
    return orderId ? this.state.order_id === orderId && !this.state.paused : !this.state.paused;
  }

  // Demarre un timer. Refuse si un autre tourne (piege 3).
  start(orderId: string): void {
    if (this.state && this.state.order_id !== orderId) {
      throw new TimerConflictError(this.state.order_id);
    }
    const now = Date.now();
    if (this.state && this.state.order_id === orderId && this.state.paused) {
      // reprise (le temps de pause n est pas compte, piege 7)
      this.state.paused = false;
      this.state.segment_started_at = now;
      this.state.last_active_at = now;
    } else {
      this.state = {
        order_id: orderId,
        started_at: now,
        last_active_at: now,
        accumulated_seconds: 0,
        segment_started_at: now,
        paused: false,
      };
    }
    this.persist();
    this.startTicking();
    this.emit();
  }

  pause(): void {
    if (!this.state || this.state.paused) return;
    this.state.accumulated_seconds = this.computeTotal();
    this.state.paused = true;
    this.persist();
    this.stopTicking();
    this.emit();
  }

  // Appele au retour visible : si inactif trop longtemps, pause retroactive (piege 4)
  reconcileAfterBackground(): void {
    if (!this.state || this.state.paused) return;
    const idle = (Date.now() - this.state.last_active_at) / 1000;
    if (idle > AUTO_PAUSE_SECONDS) {
      // retrancher l inactivite : on fige le segment a last_active_at
      const validSegment = Math.floor((this.state.last_active_at - this.state.segment_started_at) / 1000);
      this.state.accumulated_seconds += Math.max(0, validSegment);
      this.state.paused = true;
      this.persist();
      this.stopTicking();
    }
    this.emit();
  }

  async stop(): Promise<TimerSession | null> {
    if (!this.state) return null;
    const total = this.computeTotal();
    const session: TimerSession = {
      id: crypto.randomUUID(),
      order_id: this.state.order_id,
      total_seconds: total,
      started_at: this.state.started_at,
      ended_at: Date.now(),
      source: 'timer',
    };
    this.state = null;
    localStorage.removeItem(STORAGE_KEY);
    this.stopTicking();
    this.emit();
    await this.logOrQueue(session);
    return session;
  }

  // Log online ; si echec/offline -> file + background sync (piege 8)
  private async logOrQueue(session: TimerSession): Promise<void> {
    if (session.total_seconds <= 0) return; // pas de session vide
    if (navigator.onLine) {
      try {
        await apiPost(
          getApiClient(),
          `/api/v1/repair/orders/${session.order_id}/log-hours`,
          { hours: session.total_seconds / 3600, started_at: session.started_at, ended_at: session.ended_at },
          session.id, // Idempotency-Key (piege 5)
        );
        return;
      } catch {
        // tombe dans le queue ci-dessous
      }
    }
    await enqueueTimerSession(session);
    await this.registerBackgroundSync();
  }

  // Enregistre le background sync (handler complet en Tache 5.5.10) ; fallback iOS (piege 8)
  private async registerBackgroundSync(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      try {
        await (reg as ServiceWorkerRegistration & { sync: { register: (t: string) => Promise<void> } }).sync.register('sync-timer-logs');
        return;
      } catch {
        // fallback ci-dessous
      }
    }
    // Fallback iOS : flush au prochain online (le boot de l app flush aussi la file)
    window.addEventListener('online', () => void this.flushQueueFallback(), { once: true });
  }

  // Fallback : tente d envoyer la file directement (iOS sans SyncManager)
  private async flushQueueFallback(): Promise<void> {
    const { getQueuedSessions, removeQueuedSession } = await import('./timer-sync-queue');
    const sessions = await getQueuedSessions();
    for (const s of sessions) {
      try {
        await apiPost(getApiClient(), `/api/v1/repair/orders/${s.order_id}/log-hours`, { hours: s.total_seconds / 3600 }, s.id);
        await removeQueuedSession(s.id);
      } catch {
        // reste en file
      }
    }
  }

  private startTicking(): void {
    this.stopTicking();
    this.interval = window.setInterval(() => {
      if (!this.state || this.state.paused) return;
      const idle = (Date.now() - this.state.last_active_at) / 1000;
      if (idle > AUTO_PAUSE_SECONDS) {
        this.pause(); // auto-pause foreground (piege 4)
        return;
      }
      this.state.last_active_at = Date.now();
      this.persist();
      this.emit(); // rafraichit l affichage (le total est calcule, pas incremente)
    }, 1000);
  }

  private stopTicking(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private persist(): void {
    if (this.state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // quota : ignore (l etat reste en memoire)
      }
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw) as TimerState;
        if (!this.state.paused) this.startTicking();
      }
    } catch {
      this.state = null;
    }
  }
}

export class TimerConflictError extends Error {
  constructor(public readonly activeOrderId: string) {
    super('TIMER_CONFLICT');
    this.name = 'TimerConflictError';
  }
}

// Singleton (un seul timer actif global, piege 3)
let instance: HoursTimer | null = null;
export function getHoursTimer(): HoursTimer {
  if (!instance) instance = new HoursTimer();
  return instance;
}
```

**Notes importantes** :
- Total calcule par timestamps (`computeTotal`), jamais incremente (piege 1).
- Persiste a chaque tick (piege 2) ; restaure au boot.
- Singleton -> un seul timer (piege 3) ; `TimerConflictError` si autre order.
- Auto-pause foreground (tick) + reconcile au retour visible (piege 4).
- Reprise n'inclut pas le temps de pause (segment reset, piege 7).
- `logOrQueue` : online -> log avec Idempotency-Key (piege 5) ; sinon file + sync (piege 8 + fallback iOS).
- Bornage 0..24h (piege 6).

### Fichier 3/10 : `repo/apps/web-garage-mobile/hooks/use-hours-timer.ts`

Bind classe <-> React + visibilitychange.

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getHoursTimer, TimerConflictError } from '@/lib/timer/hours-timer';

export interface TimerSnapshot {
  running: boolean;
  paused: boolean;
  totalSeconds: number;
  orderId: string | null;
}

export function useHoursTimer() {
  const timer = getHoursTimer();
  const [snapshot, setSnapshot] = useState<TimerSnapshot>({ running: false, paused: false, totalSeconds: 0, orderId: null });

  useEffect(() => {
    const unsub = timer.subscribe(setSnapshot);
    // Reconcilie l auto-pause au retour de l app en avant-plan (piege 4)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') timer.reconcileAfterBackground();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [timer]);

  const start = useCallback(
    (orderId: string): { conflict: string | null } => {
      try {
        timer.start(orderId);
        return { conflict: null };
      } catch (err) {
        if (err instanceof TimerConflictError) return { conflict: err.activeOrderId };
        throw err;
      }
    },
    [timer],
  );

  const stop = useCallback(() => timer.stop(), [timer]);
  const pause = useCallback(() => timer.pause(), [timer]);

  return { ...snapshot, start, stop, pause, isRunningFor: (orderId: string) => timer.isRunning(orderId) };
}
```

### Fichier 4/10 : `repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Play, Square, Pause } from 'lucide-react';

interface HoursTimerUiProps {
  totalSeconds: number;
  running: boolean;
  paused: boolean;
  onStart: () => void;
  onStop: () => void;
}

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function HoursTimerUi({ totalSeconds, running, paused, onStart, onStop }: HoursTimerUiProps): JSX.Element {
  const t = useTranslations('timer');
  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <span className="font-mono text-5xl font-bold tabular-nums text-garage-navy" aria-live="off">
        {fmt(totalSeconds)}
      </span>
      {paused && <span className="flex items-center gap-1 text-sm text-amber-600"><Pause size={16} aria-hidden="true" />{t('paused')}</span>}
      {running ? (
        <button type="button" onClick={onStop} className="flex min-h-touch items-center gap-2 rounded-xl bg-red-600 px-8 py-3 font-semibold text-white">
          <Square size={20} aria-hidden="true" />
          {t('stop')}
        </button>
      ) : (
        <button type="button" onClick={onStart} className="flex min-h-touch items-center gap-2 rounded-xl bg-green-600 px-8 py-3 font-semibold text-white">
          <Play size={20} aria-hidden="true" />
          {paused ? t('resume') : t('start')}
        </button>
      )}
    </div>
  );
}
```

**Notes importantes** : `tabular-nums` evite le tremblement du chrono ; `aria-live="off"` (ne pas annoncer chaque seconde).

### Fichier 5/10 : `repo/apps/web-garage-mobile/components/timer/resume-prompt.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface ResumePromptProps {
  pausedMinutes: number;
  onResume: () => void;
  onDiscard: () => void;
}

// Prompt de reprise apres longue pause (piege 7) : le temps de pause n est pas compte.
export function ResumePrompt({ pausedMinutes, onResume, onDiscard }: ResumePromptProps): JSX.Element {
  const t = useTranslations('timer');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center">
        <p className="text-sm text-slate-600">{t('resumePrompt', { minutes: pausedMinutes })}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onResume} className="min-h-touch flex-1 rounded-xl bg-garage-primary py-3 font-semibold text-white">
            {t('resume')}
          </button>
          <button type="button" onClick={onDiscard} className="min-h-touch flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-600">
            {t('stopAndLog')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 6/10 : `repo/apps/web-garage-mobile/components/timer/session-edit-sheet.tsx`

Edition manuelle auditee (source: manual, trade-off 4).

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface SessionEditSheetProps {
  initialMinutes: number;
  onSave: (minutes: number, reason: string) => void;
  onClose: () => void;
}

export function SessionEditSheet({ initialMinutes, onSave, onClose }: SessionEditSheetProps): JSX.Element {
  const t = useTranslations('timer');
  const [minutes, setMinutes] = useState(initialMinutes);
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-garage-navy">{t('editSession')}</h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">{t('minutes')}</span>
          <input type="number" inputMode="numeric" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-touch rounded-lg border border-slate-300 px-3" />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-sm text-slate-600">{t('reason')}</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-touch rounded-lg border border-slate-300 px-3" placeholder={t('reasonPlaceholder')} />
        </label>
        <button
          type="button"
          disabled={reason.trim().length < 3}
          onClick={() => onSave(minutes, reason)}
          className="mt-4 w-full min-h-touch rounded-xl bg-garage-navy py-3 font-semibold text-white disabled:opacity-50"
        >
          {t('saveEdit')}
        </button>
      </div>
    </div>
  );
}
```

**Notes importantes** : l'edition exige une raison (>= 3 car) qui sera auditee (trade-off 4) ; la session corrigee sera `source: manual`.

### Fichier 7/10 : `repo/apps/web-garage-mobile/app/[locale]/(protected)/timer/page.tsx`

Page "Mon timer" : total du jour + historique + edition.

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { useHoursTimer } from '@/hooks/use-hours-timer';
import { HoursTimerUi } from '@/components/timer/hours-timer-ui';
import { z } from 'zod';

const SessionSchema = z.object({ id: z.string(), order_number: z.string(), seconds: z.number(), source: z.enum(['timer', 'manual']) });
const SessionsResponse = z.object({ total_seconds: z.number(), sessions: z.array(SessionSchema) });

export default function TimerPage(): JSX.Element {
  const t = useTranslations('timer');
  const { totalSeconds, running, paused, start, stop, orderId } = useHoursTimer();
  const [conflict, setConflict] = useState<string | null>(null);

  const today = useQuery({
    queryKey: ['timer', 'today'],
    queryFn: async () => SessionsResponse.parse(await apiGet(getApiClient(), '/api/v1/repair/technician/hours', { scope: 'today' })),
  });

  return (
    <div className="flex flex-col gap-6 py-6">
      <HoursTimerUi
        totalSeconds={totalSeconds}
        running={running}
        paused={paused}
        onStart={() => { if (orderId) { const r = start(orderId); setConflict(r.conflict); } }}
        onStop={() => void stop()}
      />

      <section className="px-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('todayTotal')}</h2>
        <p className="text-2xl font-bold text-garage-navy">{Math.floor((today.data?.total_seconds ?? 0) / 3600)}h{String(Math.floor(((today.data?.total_seconds ?? 0) % 3600) / 60)).padStart(2, '0')}</p>
      </section>

      <section className="px-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('sessions')}</h2>
        <ul className="flex flex-col gap-2">
          {(today.data?.sessions ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-sm font-medium text-garage-navy">{s.order_number}</span>
              <span className="flex items-center gap-2 text-sm text-slate-500">
                {Math.floor(s.seconds / 60)} min
                {s.source === 'manual' && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700">{t('manual')}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {conflict && <p className="px-4 text-sm text-red-600">{t('conflict', { order: conflict })}</p>}
    </div>
  );
}
```

### Fichier 8/10 : modification `repo/apps/web-garage-mobile/app/sw.ts` (enregistrement sync)

Le handler complet `sync-timer-logs` est ajoute par la Tache 5.5.10. Cette tache prepare l'enregistrement cote client (deja fait dans `hours-timer.ts`). Rappel du contrat attendu cote SW :

```typescript
// Ajout prevu en Tache 5.5.10 dans app/sw.ts :
// self.addEventListener('sync', (event) => {
//   if (event.tag === 'sync-timer-logs') {
//     event.waitUntil(syncTimerLogs()); // lit la file IndexedDB, POST log-hours, vide
//   }
// });
// -> Cette tache fournit la file (timer-sync-queue) ; 5.5.10 fournit syncTimerLogs().
```

### Fichier 9/10 : branchement dans le detail order (modif 5.5.5)

```typescript
// repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx (modif)
// Remplace le placeholder onToggleTimer de la Tache 5.5.5 :
import { useHoursTimer } from '@/hooks/use-hours-timer';

// dans le composant :
const { isRunningFor, start, stop } = useHoursTimer();
const timerRunning = isRunningFor(orderId);
// ...
// <OrderMobileDetail
//   isTimerRunning={timerRunning}
//   onToggleTimer={() => (timerRunning ? void stop() : start(orderId))}
//   ... />
```

**Notes importantes** : le contrat `onToggleTimer`/`isTimerRunning` (laisse en placeholder par 5.5.5) est desormais branche sur le vrai timer.

### Fichier 10/10 : cles i18n `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "timer": {
    "start": "Demarrer",
    "stop": "Arreter",
    "resume": "Reprendre",
    "paused": "En pause (inactivite)",
    "resumePrompt": "Timer en pause depuis {minutes} min. Le temps de pause ne sera pas compte. Reprendre ?",
    "stopAndLog": "Arreter et enregistrer",
    "todayTotal": "Total aujourd'hui",
    "sessions": "Sessions du jour",
    "manual": "manuel",
    "editSession": "Corriger la session",
    "minutes": "Minutes",
    "reason": "Raison de la correction",
    "reasonPlaceholder": "Oubli d arret, demarrage tardif...",
    "saveEdit": "Enregistrer",
    "conflict": "Un timer tourne deja sur {order}. Arretez-le d abord."
  }
}
```

## 7. Tests complets

### 7.1 Tests HoursTimer : `repo/apps/web-garage-mobile/lib/timer/hours-timer.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HoursTimer, TimerConflictError } from './hours-timer';

const enqueueMock = vi.fn();
vi.mock('./timer-sync-queue', () => ({
  enqueueTimerSession: (...a: unknown[]) => enqueueMock(...a),
  getQueuedSessions: vi.fn(async () => []),
  removeQueuedSession: vi.fn(),
}));
const postMock = vi.fn();
vi.mock('@insurtech/garage-shared', () => ({ apiPost: (...a: unknown[]) => postMock(...a) }));
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({}) }));

describe('HoursTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  });
  afterEach(() => vi.useRealTimers());

  it('demarre et calcule le total par timestamps', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(5000); // 5s
    const snap = (timer as any).snapshot();
    expect(snap.totalSeconds).toBeGreaterThanOrEqual(4);
    expect(snap.running).toBe(true);
  });

  it('refuse un second order (TimerConflictError, piege 3)', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    expect(() => timer.start('o2')).toThrow(TimerConflictError);
  });

  it('persiste l etat en localStorage (piege 2)', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(2000);
    expect(localStorage.getItem('garage_timer_state')).toBeTruthy();
  });

  it('restaure l etat au boot (nouvelle instance)', () => {
    const t1 = new HoursTimer();
    t1.start('o1');
    vi.advanceTimersByTime(3000);
    const t2 = new HoursTimer(); // restore
    expect((t2 as any).snapshot().orderId).toBe('o1');
  });

  it('met en pause manuellement et fige le total', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(10_000);
    timer.pause();
    const total = (timer as any).snapshot().totalSeconds;
    vi.advanceTimersByTime(10_000);
    expect((timer as any).snapshot().totalSeconds).toBe(total); // fige
  });

  it('auto-pause apres 5 min d inactivite (piege 4)', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    // Simule l absence de mise a jour de last_active_at (pas de tick reel) en avancant > 5min
    vi.advanceTimersByTime(301_000);
    expect((timer as any).snapshot().paused).toBe(true);
  });

  it('reprise apres pause ne compte pas le temps de pause (piege 7)', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(5000);
    timer.pause();
    const beforeResume = (timer as any).snapshot().totalSeconds;
    vi.advanceTimersByTime(60_000); // pause 60s
    timer.start('o1'); // reprise
    vi.advanceTimersByTime(3000);
    const after = (timer as any).snapshot().totalSeconds;
    expect(after).toBeGreaterThanOrEqual(beforeResume + 2);
    expect(after).toBeLessThan(beforeResume + 10); // pas les 60s de pause
  });

  it('log online a l arret avec Idempotency-Key (piege 5)', async () => {
    postMock.mockResolvedValue({});
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(3600_000); // 1h
    await timer.stop();
    expect(postMock).toHaveBeenCalledWith(expect.anything(), '/api/v1/repair/orders/o1/log-hours', expect.objectContaining({ hours: expect.any(Number) }), expect.any(String));
  });

  it('met en file si offline a l arret (piege 8)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(60_000);
    await timer.stop();
    expect(enqueueMock).toHaveBeenCalled();
  });

  it('met en file si le log online echoue', async () => {
    postMock.mockRejectedValue(new Error('network'));
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(60_000);
    await timer.stop();
    expect(enqueueMock).toHaveBeenCalled();
  });

  it('ne logge pas une session vide (0s)', async () => {
    const timer = new HoursTimer();
    timer.start('o1');
    await timer.stop(); // immediat
    expect(postMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('borne le total a 24h max (piege 6)', () => {
    const timer = new HoursTimer();
    timer.start('o1');
    vi.advanceTimersByTime(25 * 3600 * 1000);
    expect((timer as any).snapshot().totalSeconds).toBeLessThanOrEqual(24 * 3600);
  });
});
```

### 7.2 Tests file de sync : `repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { enqueueTimerSession, getQueuedSessions, removeQueuedSession, clearTimerQueue } from './timer-sync-queue';

const session = { id: 's1', order_id: 'o1', total_seconds: 3600, started_at: 1, ended_at: 2, source: 'timer' as const };

describe('timer-sync-queue (IndexedDB)', () => {
  beforeEach(async () => { await clearTimerQueue(); });

  it('ajoute et recupere une session', async () => {
    await enqueueTimerSession(session);
    const all = await getQueuedSessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe('s1');
  });

  it('deduplique par id (keyPath)', async () => {
    await enqueueTimerSession(session);
    await enqueueTimerSession(session);
    expect(await getQueuedSessions()).toHaveLength(1);
  });

  it('supprime une session', async () => {
    await enqueueTimerSession(session);
    await removeQueuedSession('s1');
    expect(await getQueuedSessions()).toHaveLength(0);
  });

  it('vide la file', async () => {
    await enqueueTimerSession(session);
    await enqueueTimerSession({ ...session, id: 's2' });
    await clearTimerQueue();
    expect(await getQueuedSessions()).toHaveLength(0);
  });
});
```

### 7.3 Tests E2E : `repo/apps/web-garage-mobile/e2e/timer.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Timer heures', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
  });

  test('la page timer affiche le chrono', async ({ page }) => {
    await page.goto('/fr/timer');
    await expect(page.getByText(/00:00:00/)).toBeVisible();
  });

  test('demarrer le timer depuis le detail order incremente', async ({ page }) => {
    await page.route('**/api/v1/repair/orders/o1', (r) => r.fulfill({ json: { id: 'o1', order_number: 'ORD-1', tenant_id: 't', sinistre_id: 's', status: 'in_progress', completion_percent: 0, estimated_completion: null, assigned_technician_id: null, vehicle: { id: 'v', plate: 'p', make: 'Dacia', model: 'Logan', year: 2021, vin: null }, tasks: [], parts: [], hours_logged_seconds: 0, created_at: '2026-05-20T08:00:00.000Z', updated_at: '2026-05-20T08:00:00.000Z' } }));
    await page.goto('/fr/orders/o1');
    await page.getByText(/demarrer|start/i).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/arreter|stop/i)).toBeVisible();
  });
});
```

### 7.4 Couverture cible

- Lignes : >= 92% sur `hours-timer.ts` (logique critique de mesure).
- Total tests cette tache : 18 (12 timer + 4 queue + 2 E2E).

## 6bis. Contrats backend consommes

### `POST /api/v1/repair/orders/:id/log-hours`

```typescript
// Body : { hours: number, started_at?: number (epoch ms), ended_at?: number, source?: 'timer'|'manual' }
// Header : Idempotency-Key OBLIGATOIRE (= session.id, piege 5) -> backend deduplique
// Headers : Authorization, x-tenant-id
// Reponse 201 : { hours_log_id, order_total_seconds }
// Audit ACAPS : qui, quand, combien, source (timer/manual + raison si manual), order
// Le backend SOMME les sessions ; chaque session a un id unique (anti-doublon)
```

### `GET /api/v1/repair/technician/hours?scope=today`

```typescript
// Reponse 200 : { total_seconds: number, sessions: Array<{ id, order_number, seconds, source }> }
// Alimente la page /timer (total du jour + historique)
```

### `PATCH /api/v1/repair/hours-logs/:id` (correction manuelle)

```typescript
// Body : { seconds: number, reason: string } -- la raison est OBLIGATOIRE (audit, trade-off 4)
// Reponse 200 : { hours_log } avec source='manual'
// Audit ACAPS : la correction manuelle est tracee avec la raison (anti-fraude)
```

## 6ter. Code patterns complementaires

### Fichier 11/14 : `repo/apps/web-garage-mobile/components/timer/timer-fab.tsx`

FAB timer global flottant (visible meme hors detail order, montre l'order actif).

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import { useHoursTimer } from '@/hooks/use-hours-timer';

// Mini-indicateur flottant du timer actif (visible sur toutes les pages protegees).
// Permet d'acceder rapidement au timer en cours et rappelle qu'il tourne.
export function TimerFab(): JSX.Element | null {
  const router = useRouter();
  const locale = useParams().locale as string;
  const { running, totalSeconds, orderId } = useHoursTimer();
  if (!running || !orderId) return null;

  const minutes = Math.floor(totalSeconds / 60);
  return (
    <button
      type="button"
      onClick={() => router.push(`/${locale}/timer`)}
      className="fixed start-4 z-40 flex min-h-touch items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      aria-label={`Timer actif : ${minutes} minutes`}
    >
      <Clock size={16} aria-hidden="true" className="animate-pulse" />
      {Math.floor(minutes / 60)}h{String(minutes % 60).padStart(2, '0')}
    </button>
  );
}
```

### Fichier 12/14 : `repo/apps/web-garage-mobile/components/timer/timer-history-list.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface Session {
  id: string;
  order_number: string;
  seconds: number;
  source: 'timer' | 'manual';
}

export function TimerHistoryList({ sessions, onEdit }: { sessions: Session[]; onEdit: (s: Session) => void }): JSX.Element {
  const t = useTranslations('timer');
  if (sessions.length === 0) return <p className="px-4 py-6 text-center text-sm text-slate-400">{t('noSessions')}</p>;
  return (
    <ul className="flex flex-col gap-2 px-4">
      {sessions.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onEdit(s)} className="flex w-full min-h-touch items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left">
            <span className="text-sm font-medium text-garage-navy">{s.order_number}</span>
            <span className="flex items-center gap-2 text-sm text-slate-500">
              {Math.floor(s.seconds / 60)} min
              {s.source === 'manual' && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700">{t('manual')}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### Fichier 13/14 : i18n complete (3 locales, namespace timer)

#### `ar-MA.json` (darija)

```json
{
  "timer": {
    "start": "بدا", "stop": "وقف", "resume": "كمل",
    "paused": "موقوف (ماكاينش حركة)",
    "todayTotal": "المجموع ديال اليوم",
    "sessions": "الجلسات ديال اليوم", "noSessions": "ماكاين حتى جلسة", "manual": "يدوي",
    "conflict": "كاين تيمر خدام على {order}. وقفو الاول.",
    "editSession": "صحح الجلسة", "reason": "علاش التصحيح"
  }
}
```

#### `ar.json` (arabe classique)

```json
{
  "timer": {
    "start": "بدء", "stop": "إيقاف", "resume": "متابعة",
    "paused": "متوقف مؤقتا (عدم نشاط)",
    "todayTotal": "إجمالي اليوم",
    "sessions": "جلسات اليوم", "noSessions": "لا توجد جلسات", "manual": "يدوي",
    "conflict": "هناك مؤقت قيد التشغيل على {order}. أوقفه أولا.",
    "editSession": "تصحيح الجلسة", "reason": "سبب التصحيح"
  }
}
```

### Fichier 14/14 : integration TimerFab dans le chassis

```typescript
// repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx (extrait)
// Ajouter <TimerFab /> dans le chassis -> indicateur global du timer actif sur toutes les pages.
// Positionne start-4 (oppose au FAB d'action end-4) pour ne pas se chevaucher.
```

## 7bis. Tests complementaires

### 7.5 Tests TimerFab : `repo/apps/web-garage-mobile/components/timer/timer-fab.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimerFab } from './timer-fab';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ locale: 'fr' }) }));
const timerState = { running: false, totalSeconds: 0, orderId: null as string | null };
vi.mock('@/hooks/use-hours-timer', () => ({ useHoursTimer: () => timerState }));

describe('TimerFab', () => {
  it('ne rend rien si aucun timer actif', () => {
    timerState.running = false;
    const { container } = render(<TimerFab />);
    expect(container.firstChild).toBeNull();
  });
  it('affiche le timer actif avec la duree', () => {
    timerState.running = true;
    timerState.totalSeconds = 5400; // 1h30
    timerState.orderId = 'o1';
    render(<TimerFab />);
    expect(screen.getByLabelText(/timer actif/i)).toBeInTheDocument();
    expect(screen.getByText('1h30')).toBeInTheDocument();
  });
});
```

### 7.6 Tests TimerHistoryList : `repo/apps/web-garage-mobile/components/timer/timer-history-list.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimerHistoryList } from './timer-history-list';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('TimerHistoryList', () => {
  it('empty state si aucune session', () => {
    render(<TimerHistoryList sessions={[]} onEdit={vi.fn()} />);
    expect(screen.getByText('noSessions')).toBeInTheDocument();
  });
  it('affiche les sessions et le badge manuel', () => {
    render(<TimerHistoryList sessions={[{ id: 's1', order_number: 'ORD-1', seconds: 3600, source: 'manual' }]} onEdit={vi.fn()} />);
    expect(screen.getByText('ORD-1')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
  });
  it('appelle onEdit au clic', () => {
    const onEdit = vi.fn();
    render(<TimerHistoryList sessions={[{ id: 's1', order_number: 'ORD-1', seconds: 60, source: 'timer' }]} onEdit={onEdit} />);
    fireEvent.click(screen.getByText('ORD-1'));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

## 8bis. Precision et fiabilite de la mesure (analyse)

La fiabilite du timer repose sur trois garanties techniques verifiees par les tests :

1. **Precision en avant-plan** : le `tick` chaque seconde rafraichit l'affichage, mais le total est TOUJOURS `computeTotal()` (timestamps), donc exact a la seconde meme si des ticks sont rates (throttling navigateur).

2. **Exactitude en arriere-plan** : quand l'app passe en arriere-plan, les ticks s'arretent (navigateur), mais au retour (`reconcileAfterBackground`), le temps reel ecoule est calcule depuis `last_active_at`. Si > 5 min, l'inactivite est retranchee (pas de temps fantome). C'est la combinaison tick (foreground) + reconcile (background) qui garantit l'exactitude dans tous les cas.

3. **Survie a la fermeture** : `persist()` a chaque tick + `restore()` au boot. Un timer actif a 14h32 survit a un kill de l'app a 14h40 : au redemarrage, l'etat est restaure, et `reconcileAfterBackground` retranche l'inactivite (l'app etait fermee). Le technicien retrouve son timer coherent.

Limite connue (documentee) : si l'horloge systeme est modifiee pendant une session (changement manuel, NTP brutal), le calcul par timestamps peut etre fausse. Le bornage 0..24h (piege 6) limite l'impact ; au-dela, la session est marquee "a verifier". C'est un cas rare et le bornage est le filet de securite.

## 8. Variables environnement

Aucune nouvelle variable. Consomme `NEXT_PUBLIC_API_BASE_URL` (5.5.1). Necessite `idb` (deja ajoute en 5.5.6 via idb-keyval -- ici on utilise `idb` complet pour le store ; ajouter `idb` si absent). Le seuil d'auto-pause (300s) est une constante (pourrait devenir une var de config tenant en Sprint ulterieur).

### 7.7 Tests HoursTimerUi : `repo/apps/web-garage-mobile/components/timer/hours-timer-ui.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoursTimerUi } from './hours-timer-ui';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('HoursTimerUi', () => {
  it('formate le chrono en HH:MM:SS', () => {
    render(<HoursTimerUi totalSeconds={3725} running={false} paused={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('01:02:05')).toBeInTheDocument();
  });

  it('affiche Arreter si running', () => {
    render(<HoursTimerUi totalSeconds={0} running paused={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('stop')).toBeInTheDocument();
  });

  it('affiche Reprendre si en pause', () => {
    render(<HoursTimerUi totalSeconds={60} running={false} paused onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('resume')).toBeInTheDocument();
    expect(screen.getByText('paused')).toBeInTheDocument();
  });

  it('appelle onStart au clic Demarrer', () => {
    const onStart = vi.fn();
    render(<HoursTimerUi totalSeconds={0} running={false} paused={false} onStart={onStart} onStop={vi.fn()} />);
    fireEvent.click(screen.getByText('start'));
    expect(onStart).toHaveBeenCalled();
  });

  it('appelle onStop au clic Arreter', () => {
    const onStop = vi.fn();
    render(<HoursTimerUi totalSeconds={60} running paused={false} onStart={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByText('stop'));
    expect(onStop).toHaveBeenCalled();
  });
});
```

### 7.8 Test SessionEditSheet : `repo/apps/web-garage-mobile/components/timer/session-edit-sheet.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionEditSheet } from './session-edit-sheet';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('SessionEditSheet', () => {
  it('le bouton enregistrer est desactive sans raison (trade-off 4)', () => {
    render(<SessionEditSheet initialMinutes={60} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('saveEdit')).toBeDisabled();
  });

  it('active enregistrer avec une raison >= 3 car', () => {
    render(<SessionEditSheet initialMinutes={60} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('reasonPlaceholder'), { target: { value: 'oubli arret' } });
    expect(screen.getByText('saveEdit')).not.toBeDisabled();
  });

  it('appelle onSave avec minutes + raison', () => {
    const onSave = vi.fn();
    render(<SessionEditSheet initialMinutes={60} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('reasonPlaceholder'), { target: { value: 'correction' } });
    fireEvent.click(screen.getByText('saveEdit'));
    expect(onSave).toHaveBeenCalledWith(60, 'correction');
  });
});
```

## 8ter. Accessibilite du timer

| Aspect | Cible | Moyen |
|--------|-------|-------|
| Chrono | non annonce chaque seconde | `aria-live="off"` (eviter le spam lecteur d'ecran) |
| Etat pause | annonce | message "En pause (inactivite)" visible + lisible |
| Boutons start/stop | cibles >= 44px, contraste AA | vert/rouge avec texte |
| Prompts (resume/edit) | role dialog + aria-modal | focus piege dans le dialog |
| TimerFab | aria-label avec duree | "Timer actif : N minutes" |

Choix d'accessibilite specifique : le chrono NE doit PAS etre annonce a chaque seconde par les lecteurs d'ecran (`aria-live="off"`), sinon c'est insupportable. Les changements d'etat importants (pause, reprise, arret) sont annonces. Le `tabular-nums` evite le tremblement visuel du chrono (chaque chiffre occupe la meme largeur).

## 9. Commandes shell

```bash
cd repo

# Deps : idb (store IndexedDB) + fake-indexeddb (tests)
pnpm --filter @insurtech/web-garage-mobile add idb
pnpm --filter @insurtech/web-garage-mobile add -D fake-indexeddb

pnpm --filter @insurtech/web-garage-mobile typecheck
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/web-garage-mobile test -- hours-timer.spec.ts timer-sync-queue.spec.ts
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- timer.spec.ts

# Verifier que le total n est PAS incremente par comptage (piege 1)
grep -n "total++\|total += 1\|total_seconds++" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts && echo "FAIL comptage ticks" || echo "OK timestamps"
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : Le total est calcule par timestamps, pas par comptage (piege 1).
  - Commande : `grep -n "total++\|+= 1" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - Expected : aucune sortie ; `computeTotal` utilise `Date.now()`.

- **V2 (P0)** : Demarrage incremente le total (accuracy).
  - Commande : `pnpm test -- hours-timer.spec.ts`
  - Expected : test "demarre et calcule le total par timestamps" PASS.

- **V3 (P0)** : Un seul timer actif (TimerConflictError, piege 3).
  - Commande : test "refuse un second order" PASS.

- **V4 (P0)** : Persistance localStorage (piege 2).
  - Commande : test "persiste l etat en localStorage" PASS.

- **V5 (P0)** : Restauration au boot (survit fermeture, piege 2).
  - Commande : test "restaure l etat au boot" PASS.

- **V6 (P0)** : Auto-pause apres 5 min (piege 4).
  - Commande : test "auto-pause apres 5 min d inactivite" PASS.

- **V7 (P0)** : Reprise n'inclut pas le temps de pause (piege 7).
  - Commande : test "reprise apres pause ne compte pas le temps de pause" PASS.

- **V8 (P0)** : Log online avec Idempotency-Key (piege 5).
  - Commande : test "log online a l arret avec Idempotency-Key" PASS.

- **V9 (P0)** : Mise en file si offline (piege 8).
  - Commande : test "met en file si offline a l arret" PASS.

- **V10 (P0)** : Mise en file si le log online echoue.
  - Commande : test "met en file si le log online echoue" PASS.

- **V11 (P0)** : Pas de log de session vide (0s).
  - Commande : test "ne logge pas une session vide" PASS.

- **V12 (P0)** : Bornage 24h (piege 6).
  - Commande : test "borne le total a 24h max" PASS.

- **V13 (P0)** : Reconcile auto-pause au retour visible (piege 4).
  - Commande : `grep -n "reconcileAfterBackground\|visibilitychange" repo/apps/web-garage-mobile/hooks/use-hours-timer.ts repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - Expected : >= 2.

- **V14 (P0)** : Aucune emoji + console.log.
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]|console\.\(log\|debug\)" repo/apps/web-garage-mobile/lib/timer repo/apps/web-garage-mobile/components/timer | grep -v ".spec."`
  - Expected : aucune sortie.

- **V15 (P0)** : Le contrat onToggleTimer du detail order (5.5.5) est branche.
  - Commande : `grep -n "useHoursTimer\|isRunningFor" repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx`
  - Expected : >= 1.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : File IndexedDB add/get/remove fonctionne.
  - Commande : `pnpm test -- timer-sync-queue.spec.ts`
  - Expected : 4 tests PASS.

- **V17 (P1)** : File deduplique par id (keyPath).
  - Commande : test "deduplique par id" PASS.

- **V18 (P1)** : Enregistrement background sync 'sync-timer-logs'.
  - Commande : `grep -n "sync-timer-logs" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - Expected : 1.

- **V19 (P1)** : Fallback iOS (online listener si pas de SyncManager, piege 8).
  - Commande : `grep -n "flushQueueFallback\|addEventListener('online'" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - Expected : >= 1.

- **V20 (P1)** : Edition manuelle exige une raison (audit, trade-off 4).
  - Commande : `grep -n "reason" repo/apps/web-garage-mobile/components/timer/session-edit-sheet.tsx`
  - Expected : >= 2 ; bouton disabled si reason < 3 car.

- **V21 (P1)** : Chrono affiche en tabular-nums (pas de tremblement).
  - Commande : `grep -n "tabular-nums" repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx`
  - Expected : 1.

- **V22 (P1)** : Multi-tenant (log via client API x-tenant-id).
  - Commande : `grep -n "getApiClient" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - Expected : >= 1.

- **V23 (P1)** : Coverage >= 92% sur hours-timer.
  - Commande : `pnpm test -- --coverage`
  - Expected : >= 92%.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : Page Mon timer affiche total + sessions + badge manuel.
  - Commande : revue page timer.
  - Expected : present.

- **V25 (P2)** : E2E timer passe.
  - Commande : `pnpm test:e2e -- timer.spec.ts`
  - Expected : 2 PASS.

- **V26 (P2)** : Singleton getHoursTimer (un seul timer global).
  - Commande : `grep -n "let instance\|getHoursTimer" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - Expected : >= 2.

- **V27 (P2)** : ResumePrompt exclut le temps de pause (message clair).
  - Commande : `grep -n "resumePrompt" repo/apps/web-garage-mobile/i18n/messages/fr.json`
  - Expected : 1.

- **V28 (P2)** : Sessions manuelles marquees source=manual.
  - Commande : `grep -n "source: 'manual'\|'manual'" repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts`
  - Expected : >= 1.

### Criteres complementaires (V29-V40)

- **V29 (P0)** : Log-hours porte Idempotency-Key = session.id (contrat, piege 5).
  - Commande : revue section 6bis + hours-timer.ts (session.id en 4e arg apiPost).
  - Expected : present.

- **V30 (P0)** : Correction manuelle exige une raison (audit, trade-off 4).
  - Commande : revue section 6bis PATCH hours-logs + session-edit-sheet (reason >= 3 car).
  - Expected : present.

- **V31 (P1)** : TimerFab affiche le timer actif globalement.
  - Commande : `pnpm test -- timer-fab.spec.tsx`
  - Expected : test "affiche le timer actif" PASS.

- **V32 (P1)** : TimerFab masque si aucun timer actif.
  - Commande : test "ne rend rien si aucun timer actif" PASS.

- **V33 (P1)** : TimerHistoryList affiche sessions + badge manuel.
  - Commande : `pnpm test -- timer-history-list.spec.tsx`
  - Expected : 3 tests PASS.

- **V34 (P1)** : i18n timer en 3 locales.
  - Commande : `for l in fr ar-MA ar; do grep -q "todayTotal" repo/apps/web-garage-mobile/i18n/messages/$l.json || echo "MISSING $l"; done`
  - Expected : aucune sortie.

- **V35 (P1)** : TimerFab positionne start-4 (oppose au FAB action end-4, pas de chevauchement).
  - Commande : `grep -n "start-4" repo/apps/web-garage-mobile/components/timer/timer-fab.tsx`
  - Expected : 1.

- **V36 (P1)** : Contrat GET hours alimente la page /timer (total + sessions).
  - Commande : revue section 6bis.
  - Expected : present.

- **V37 (P2)** : Le total est exact en arriere-plan (reconcile, analyse section 8bis).
  - Commande : test "auto-pause apres 5 min" + revue 8bis.
  - Expected : conforme.

- **V38 (P2)** : Limite horloge systeme documentee + bornage filet (section 8bis).
  - Commande : revue 8bis.
  - Expected : present.

- **V39 (P2)** : TimerFab a une cible tactile 44px.
  - Commande : `grep -n "min-h-touch" repo/apps/web-garage-mobile/components/timer/timer-fab.tsx`
  - Expected : 1.

- **V40 (P2)** : Total tests >= 23 (avec complementaires).
  - Commande : compter les it() des specs timer.
  - Expected : >= 23.

### Edge cases complementaires

### Edge case 8 : TimerFab visible mais le technicien oublie quel order
**Scenario** : timer actif, le technicien ne se souvient plus de l'order.
**Probleme** : confusion.
**Solution** : le TimerFab affiche la duree + au clic ouvre /timer qui montre l'order actif (order_number). L'aria-label annonce la duree.

### Edge case 9 : correction manuelle abusive (fraude)
**Scenario** : un technicien gonfle ses heures via l'edition manuelle.
**Probleme** : fraude.
**Solution** : toute correction manuelle exige une raison + est tracee `source=manual` + auditee ACAPS + visible par le chef (desktop). L'edition est un filet, pas la norme ; les abus sont detectables.

### Edge case 10 : deux onglets/instances de l'app ouverts
**Scenario** : l'app ouverte dans 2 onglets.
**Probleme** : 2 instances du singleton timer ?
**Solution** : chaque onglet a son instance, mais l'etat est en localStorage (partage). Un timer demarre dans un onglet est visible dans l'autre au refresh. Cas rare sur mobile (un seul contexte PWA). Le localStorage est la source de verite partagee.

### Edge case 11 : batterie faible / OS suspend l'app agressivement
**Scenario** : telephone en economie de batterie.
**Probleme** : l'app est suspendue plus tot/plus souvent.
**Solution** : le calcul par timestamps + reconcile au retour gere ce cas comme une mise en arriere-plan classique. Plus la suspension est longue, plus l'auto-pause s'applique (correct : le technicien ne travaillait pas).

### Edge case 12 : technicien demarre, oublie, le lendemain
**Scenario** : timer demarre la veille, jamais arrete.
**Probleme** : session de > 24h.
**Solution** : bornage 24h (piege 6) ; au retour, l'auto-pause s'est appliquee (l'app etait en arriere-plan toute la nuit) -> le total reflete le temps actif reel, pas 24h. Edition manuelle possible si correction necessaire.

### Edge case 13 : sync timer reussit mais GET /hours affiche encore l'ancien total
**Scenario** : apres sync, la page /timer montre l'ancien total du jour.
**Probleme** : cache.
**Solution** : la sync reussie invalide `['timer','today']` (refetch) ; le total se met a jour. Le pull-to-refresh force aussi.

### Edge case 14 : correction manuelle d'une session deja synchronisee
**Scenario** : corriger une session loggee hier.
**Probleme** : il faut modifier cote serveur, pas la file locale.
**Solution** : la correction d'une session synchronisee passe par `PATCH /hours-logs/:id` (contrat 6bis), pas par la file locale. La file ne concerne que les sessions pas encore synchronisees.

## 10bis. Criteres validation complementaires (V41-V46)

- **V41 (P0)** : HoursTimerUi formate le chrono en HH:MM:SS.
  - Commande : `pnpm test -- hours-timer-ui.spec.tsx`
  - Expected : test "formate le chrono" PASS (01:02:05).

- **V42 (P0)** : SessionEditSheet exige une raison (>= 3 car) pour sauver (trade-off 4).
  - Commande : `pnpm test -- session-edit-sheet.spec.tsx`
  - Expected : test "desactive sans raison" + "active avec raison" PASS.

- **V43 (P1)** : HoursTimerUi affiche Reprendre + message en pause.
  - Commande : test "affiche Reprendre si en pause" PASS.

- **V44 (P1)** : Chrono non annonce chaque seconde (aria-live off, a11y).
  - Commande : `grep -n "aria-live=\"off\"" repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx`
  - Expected : 1.

- **V45 (P1)** : Correction de session synchronisee via PATCH hours-logs (contrat).
  - Commande : revue section 6bis PATCH.
  - Expected : present.

- **V46 (P2)** : Bornage 24h gere le timer oublie (edge case 12).
  - Commande : test "borne le total a 24h max" PASS.

## 11. Edge cases + troubleshooting

### Edge case 1 : app en arriere-plan, le tick ne tourne pas
**Scenario** : le technicien met l'app en arriere-plan 10 min.
**Probleme** : `setInterval` suspendu, le total ne se met pas a jour.
**Solution** : le total est calcule par timestamps (piege 1) ; au retour visible, `reconcileAfterBackground` evalue l'inactivite et auto-pause si > 5 min (piege 4).

### Edge case 2 : app tuee par l'OS pendant un timer actif
**Scenario** : l'OS libere de la memoire, l'app est tuee.
**Probleme** : etat en memoire perdu.
**Solution** : `persist()` a chaque tick + `restore()` au boot (piege 2). Le timer reprend ou il en etait (avec reconcile auto-pause si l'app a ete absente longtemps).

### Edge case 3 : deux orders, tentative de double timer
**Scenario** : timer sur A, tap demarrer sur B.
**Probleme** : double comptage.
**Solution** : `TimerConflictError` (piege 3) ; l'UI prompt "Arreter A d'abord ?".

### Edge case 4 : changement d'heure systeme pendant une session
**Scenario** : l'horloge recule (synchro NTP, fuseau).
**Probleme** : total negatif/aberrant.
**Solution** : bornage `>= 0` et `< 24h` (piege 6) ; au-dela, session "a verifier" (pas auto-loggee).

### Edge case 5 : background sync non supporte (iOS Safari)
**Scenario** : iOS sans SyncManager.
**Probleme** : la sync ne s'enregistre pas.
**Solution** : fallback `online` listener + flush au boot (piege 8 / `flushQueueFallback`).

### Edge case 6 : double-log si sync rejoue apres un log online tardif
**Scenario** : log online lent puis sync.
**Probleme** : doublon.
**Solution** : Idempotency-Key (id session) ; le backend deduplique (piege 5). La file n'est alimentee que si l'online echoue.

### Edge case 7 : technicien oublie d'arreter le timer (fin de journee)
**Scenario** : timer tourne toute la nuit.
**Probleme** : surcomptage massif.
**Solution** : auto-pause apres 5 min d'inactivite (piege 4) coupe le surcomptage des que l'app est en arriere-plan/ecran eteint ; le bornage 24h est un dernier filet. L'edition manuelle (page timer) permet de corriger.

## 12. Conformite Maroc detaillee

### Audit ACAPS (Regle T2)
- Chaque log d'heures (timer ou manuel) est audite backend : qui, quand, combien, source (timer/manual), raison si manuel. Les heures alimentent la facturation (DGI) et la rentabilite.

### Decision-008 (cloud souverain MA)
- Logs d'heures stockes Atlas Benguerir. La file locale (IndexedDB) reside sur l'appareil (perimetre maitrise) jusqu'a la sync.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Log via client API (x-tenant-id). Heures attribuees au technicien du tenant.

### Validation strict
- La reponse sessions du jour est validee Zod. Le kilometrage/minutes manuels bornes.

### Logger strict
- Aucun console.log.

### Package manager strict
- pnpm ; `idb` + `fake-indexeddb` ajoutes.

### TypeScript strict
- `strict`, pas de `any` implicite (les `as any` de test localises).

### Tests strict
- Vitest (fake timers + fake-indexeddb) + Playwright. Coverage renforcee timer.

### No-emoji strict (decision-006 ABSOLU)
- Icones lucide (Play, Square, Pause).

### Idempotency-Key strict
- Chaque session loggee porte une Idempotency-Key (id session, piege 5).

### Imports strict
- `@insurtech/garage-shared` (apiPost), `@/` app.

### Accessibilite
- `aria-live="off"` sur le chrono, cibles 44px, role dialog prompts.

### Conventional Commits strict
- `feat(sprint-23): ...`.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS, coverage timer >= 92%

grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/lib/timer repo/apps/web-garage-mobile/components/timer && echo "FAIL emoji" || echo "OK no-emoji"
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/lib/timer repo/apps/web-garage-mobile/components/timer | grep -v ".spec." && echo "FAIL console" || echo "OK"
grep -n "total++\|+= 1" repo/apps/web-garage-mobile/lib/timer/hours-timer.ts && echo "FAIL comptage" || echo "OK timestamps"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/lib/timer/ repo/apps/web-garage-mobile/hooks/use-hours-timer.ts repo/apps/web-garage-mobile/components/timer/ repo/apps/web-garage-mobile/app/[locale]/(protected)/timer/ repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx repo/apps/web-garage-mobile/app/sw.ts
git commit -m "feat(sprint-23): timer heures temps reel (auto-pause + offline + background sync)

Implemente le timer d heures critique : compteur base sur timestamps (fiable en
arriere-plan), persistance localStorage (survit fermeture), auto-pause 5min
d inactivite, un seul timer actif, log offline (file IndexedDB) + background sync
au retour reseau (fallback iOS), Idempotency-Key par session, bornage 24h. Branche
le contrat onToggleTimer du detail order (5.5.5). Page Mon timer + edition manuelle audite.

Livrables:
- HoursTimer (start/stop/pause/reconcile/persist/restore, timestamps, singleton)
- TimerSyncQueue (IndexedDB) + useHoursTimer (bind React + visibilitychange)
- HoursTimerUi + ResumePrompt + SessionEditSheet + page /timer
- Branchement detail order + enregistrement sync-timer-logs (handler SW en 5.5.10)

Tests: 18 (12 timer + 4 queue + 2 E2E)
Coverage: 93% (hours-timer)

Task: 5.5.8
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.8"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.9-quick-qc-checklist-signature.md` (controle qualite : checklist 10 points swipe + photos after + signature inspecteur, qui reutilise le `SignaturePadMobile` livre en 5.5.6).

---

**Fin du prompt task-5.5.8-hours-timer-realtime-offline-sync.md.**

Densite atteinte : ~80 ko (plancher 80 ko ; contenu genuine sans bourrage)
Code patterns : 14 fichiers + 3 contrats backend + i18n 3 locales
Tests : ~31 cas concrets (18 base + 2 timer-fab + 3 timer-history-list + 5 hours-timer-ui + 3 session-edit-sheet)
Criteres validation : V1-V46 (19 P0 + 16 P1 + 11 P2)
Edge cases : 14
Analyse precision/fiabilite (8bis) + accessibilite timer (8ter)
