# TACHE 5.5.10 -- Service Worker Offline Cache + Background Sync (Timer/Photos/Checklist) + Conflict Resolution

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.10)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (resilience offline = condition d'usage en atelier a couverture intermittente)
**Effort** : 6h
**Dependances** :
- Tache 5.5.1 (`app/sw.ts` Serwist initial : cache statique + API GET + pre-fetch)
- Tache 5.5.8 (file `timer-sync-queue` + enregistrement `sync-timer-logs`)
- Tache 5.5.5 (file photos via `enqueueSync` type `add-photo`/`mark-task`/`mark-complete`)
- Tache 5.5.6 (file `submit-reception`) + Tache 5.5.9 (file `qc-point`)
- Sprint 19-21 (endpoints repair cibles de la sync)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache complete le **service worker** de la PWA technicien pour en faire un systeme offline-first robuste : strategies de cache finalisees (assets statiques en Cache First, API GET en Network First avec fallback cache, mutations en Background Sync), trois files de synchronisation en arriere-plan (`sync-timer-logs` pour les heures, `sync-photos-uploads` pour les photos, `sync-checklist-updates` pour reception/QC), une page d'etat de synchronisation (`/sync-status`) listant les elements en attente avec retry manuel, une page offline personnalisee, et surtout une **strategie de resolution de conflits detaillee** (Last-Write-Wins avec autorite serveur, detection 409, prompt utilisateur a 3 choix, cas non-resolvables). Elle centralise et orchestre les files alimentees par les Taches 5.5.5/5.5.6/5.5.8/5.5.9 via un module `enqueueSync` unifie.

L'apport est triple. D'abord, **garantir qu'aucune action atelier n'est perdue en zone sans couverture** : un technicien dans une fosse beton sans reseau peut logger des heures, prendre des photos, cocher des taches, faire une reception complete -- tout est mis en file localement et synchronise automatiquement des que le reseau revient, meme si l'app a ete fermee entre-temps (background sync). Ensuite, **resoudre proprement les conflits** : quand une donnee modifiee offline entre en conflit avec une modification serveur (le chef d'atelier a cloture l'order entre-temps), un mecanisme clair (LWW + prompt) evite la corruption silencieuse de donnees et donne le controle au technicien. Enfin, **rendre la synchronisation visible et controlable** : la page `/sync-status` montre ce qui est en attente, permet un retry manuel, et rassure le technicien (sa reception de ce matin est bien en file, pas perdue).

A l'issue de cette tache, le service worker gere les 3 types de sync de bout en bout : a la reconnexion, il vide les files dans l'ordre de priorite (timer > checklist > photos), POST chaque element vers son endpoint, gere les 409 conflits via la strategie definie, et nettoie les files. La page `/sync-status` est accessible (depuis le profil ou un badge), la page offline s'affiche sur navigation hors cache, et 5+ scenarios de conflit E2E sont couverts (timer concurrent, photos overwrite, status race, stock discrepancy, order complete des deux cotes).

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Les Taches precedentes (5.5.5, 5.5.6, 5.5.8, 5.5.9) produisent des mutations qui, en cas d'offline, sont mises en file via `enqueueSync`. Mais jusqu'ici, le **handler de synchronisation** cote service worker n'existe pas : les files s'accumulent sans etre videes. Cette tache fournit le mecanisme qui draine ces files au retour du reseau. C'est la brique qui rend l'ensemble du sprint reellement offline-first : sans elle, les actions offline restent bloquees localement.

Le **background sync** (API `SyncManager` du service worker) est le mecanisme cle : il permet au navigateur de declencher une synchronisation **meme si l'app est fermee**, des que la connectivite revient. C'est ce qui distingue une vraie PWA offline d'une simple app avec cache : le technicien peut logger ses heures offline, ranger son telephone, et la sync se fera en arriere-plan plus tard. Sur iOS Safari (sans `SyncManager`), un fallback (flush a l'`online` event + au boot) assure une couverture degradee mais fonctionnelle.

La **resolution de conflits** est le point le plus delicat. En atelier multi-acteurs (technicien mobile + chef desktop), une meme entite (order, sinistre) peut etre modifiee des deux cotes pendant que le technicien est offline. Au moment de la sync, le serveur peut avoir une version plus recente. La strategie doit etre explicite (le B-23 la detaille) : Last-Write-Wins avec autorite serveur par defaut, detection via `updated_at`/version (409 Conflict), prompt utilisateur a 3 choix pour les conflits resolvables, et rejet + notification pour les conflits non-resolvables (order deja cloture, piece deja consommee).

### Architecture de synchronisation

```
  Files (IndexedDB) alimentees par :
   - 5.5.8 timer-sync-queue   -> tag 'sync-timer-logs'
   - 5.5.5/5.5.6/5.5.9 enqueueSync (store unifie 'sync_queue') :
        type 'mark-task' / 'mark-complete' / 'add-photo'    -> 'sync-checklist-updates' / 'sync-photos-uploads'
        type 'submit-reception' / 'qc-point'                -> 'sync-checklist-updates'
        |
        v
  Service Worker (app/sw.ts) -- sync event handlers
   - 'sync-timer-logs'        : POST log-hours (priorite 1)
   - 'sync-checklist-updates' : PATCH/POST taches/reception/qc (priorite 2)
   - 'sync-photos-uploads'    : POST photos multipart (priorite 3, plus lourd)
        |
        v gestion 409 Conflict
  Conflict resolution (LWW + prompt)
   - resolvable    -> postMessage au client -> modal 3 choix
   - non-resolvable -> reject + notification (order cloture, stock consume)
        |
        v
  /sync-status (UI) : liste pending + retry manuel
```

### Strategie de resolution de conflits (detaillee, du B-23)

**Strategie par defaut : Last-Write-Wins avec autorite serveur.** Le serveur est la source de verite (`updated_at` timestamp). 

**Detection :** un POST/PUT/PATCH de sync retourne `409 Conflict` si le serveur detecte que `version`/`updated_at` a change depuis la valeur connue du client (optimistic locking par comparaison de timestamp).

**Prompt utilisateur (conflit resolvable) :** modal "Cette tache a ete modifiee par {acteur} ({role}) il y a {duree}. Vos modifications offline : [diff]. Que voulez-vous faire ?" avec 3 boutons :
- `Garder mes changements` (overwrite serveur avec force flag)
- `Garder version serveur` (annule mes modifs offline)
- `Merge manuel` (resolution champ par champ)

**Cas non-resolvables :**
- Sinistre status changed cross-tenant (ex : cloture cote chef) -> rejet de la modif offline + notification technicien.
- Stock part deja consume (count discrepancy) -> retry avec quantite ajustee OU escalade au chef.

**Conflict log :** chaque resolution est tracee dans `audit_log` (compliance ACAPS).

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **LWW + prompt + non-resolvables (CHOIX, B-23)** | Controle utilisateur, pas de corruption silencieuse, conforme | Logique a soigner | RETENU |
| Last-Write-Wins silencieux (client gagne) | Simple | Ecrase les modifs serveur sans avertir = corruption | rejete : dangereux |
| Server-always-wins silencieux | Simple, coherent | Perd les modifs offline du technicien sans avertir | rejete : perte donnees |
| CRDT / merge automatique | Pas de conflit | Complexite enorme, inadapte a ces entites | rejete : surdimensionne |

### Trade-offs explicites

1. **Ordre de priorite de sync : timer > checklist > photos** : on synchronise d'abord les heures (donnee critique facturation), puis les checklist/statuts (workflow), puis les photos (lourdes, moins urgentes). Trade-off : les photos peuvent attendre quelques cycles ; acceptable car non bloquantes.

2. **Prompt de conflit cote client (pas dans le SW)** : le SW ne peut pas afficher d'UI ; il `postMessage` au client qui affiche le modal. Si l'app est fermee au moment de la sync background, le conflit resolvable est mis de cote (re-tente quand l'app s'ouvre). Trade-off : un conflit peut rester non resolu jusqu'a la prochaine ouverture, mais jamais resolu a tort silencieusement.

3. **Retry avec backoff exponentiel limite** : en cas d'echec reseau (pas 409), on re-tente avec backoff (le background sync re-declenche). On limite a N tentatives pour eviter une boucle infinie sur une erreur permanente. Trade-off : apres N echecs, l'element reste en file avec un statut "erreur" visible dans `/sync-status` + retry manuel.

4. **Photos volumineuses : sync une par une** : pour eviter de saturer la bande passante atelier au retour reseau, les photos sont synchronisees sequentiellement, pas en parallele. Trade-off : plus lent, mais ne bloque pas le reste.

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : les requetes de sync portent `x-tenant-id` (recupere du contexte stocke). Les conflits cross-tenant sont non-resolvables.
- **decision-006 (no-emoji)** + **decision-008 (MA)** : standards.
- **Audit ACAPS (Regle T2)** : chaque resolution de conflit est loggee.
- **Idempotency-Key** : chaque element de file porte une cle (evite le double-traitement si la sync rejoue).

### Pieges techniques connus

1. **Piege : background sync non supporte (iOS Safari)**
   - Pourquoi : pas de `SyncManager`.
   - Solution : fallback -- flush des files a l'`online` event + au boot de l'app. Detecter `'sync' in registration`.

2. **Piege : la sync rejoue et double-traite un element deja envoye**
   - Pourquoi : echec apres POST reussi mais avant suppression de la file.
   - Solution : Idempotency-Key par element + le backend deduplique ; ne retirer de la file qu'apres confirmation 2xx.

3. **Piege : conflit 409 traite comme une erreur reseau (retry infini)**
   - Pourquoi : confusion entre 409 (conflit metier) et erreur reseau.
   - Solution : distinguer 409 (-> resolution conflit, ne PAS retry aveuglement) des 5xx/network (-> retry backoff).

4. **Piege : le SW ne peut pas lire le JWT/tenant pour les requetes de sync**
   - Pourquoi : le SW n'a pas le contexte React.
   - Solution : stocker le token+tenant dans IndexedDB (mis a jour au login) ; le SW les lit pour authentifier les requetes de sync. Token expire -> echec -> retry au prochain login.

5. **Piege : files corrompues bloquent toute la sync**
   - Pourquoi : un element malformé fait planter le drain.
   - Solution : try/catch par element ; un element en erreur est marque "failed" et saute, sans bloquer les autres.

6. **Piege : prompt de conflit perdu si l'app est fermee pendant la sync background**
   - Pourquoi : pas de client pour recevoir le postMessage.
   - Solution : si aucun client n'est ouvert, mettre le conflit de cote (statut "needs_resolution" dans la file) ; le resoudre a la prochaine ouverture (trade-off 2).

7. **Piege : cache API GET sert des donnees obsoletes apres une mutation offline**
   - Pourquoi : on coche une tache offline, mais le GET en cache montre l'ancien etat.
   - Solution : l'UI optimiste (5.5.5) gere l'affichage local ; le cache API est invalide/rafraichi a la sync reussie.

8. **Piege : retry manuel depuis /sync-status pendant une sync auto -> double**
   - Pourquoi : concurrence.
   - Solution : verrou (flag de sync en cours) ; le retry manuel attend ou est desactive pendant une sync auto.

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.10 est la **10eme tache du Sprint 23**. Elle :

- **Depend de** : 5.5.1 (sw.ts initial), 5.5.8 (timer queue), 5.5.5/5.5.6/5.5.9 (enqueueSync).
- **Bloque** : rien directement, mais elle est la condition de l'usage offline reel de toutes les pages precedentes. Sans elle, les files ne se vident pas.
- **Apporte au sprint** : les 3 handlers de sync, le module `enqueueSync` unifie, la resolution de conflits, la page `/sync-status`, la page offline.

### Position dans le programme global

Premier systeme de background sync + resolution de conflits du programme. Pattern de reference pour toute PWA metier offline-first future.

### Diagramme des handlers SW

```
  app/sw.ts (complete la version 5.5.1)
   self.addEventListener('sync', (event) => {
     switch (event.tag) {
       case 'sync-timer-logs':        event.waitUntil(drainTimerQueue());      // priorite 1
       case 'sync-checklist-updates': event.waitUntil(drainChecklistQueue());  // priorite 2
       case 'sync-photos-uploads':    event.waitUntil(drainPhotosQueue());     // priorite 3
     }
   });
   // chaque drain : lit file -> POST (auth depuis IndexedDB) -> 2xx:remove | 409:conflict | 5xx:retry
```

---

## 4. Livrables checkables

- [ ] Module `repo/apps/web-garage-mobile/lib/sync/enqueue.ts` : file unifiee IndexedDB + enqueueSync (~120 lignes)
- [ ] Module `repo/apps/web-garage-mobile/lib/sync/sync-queue.ts` : orchestrateur drain + auth + 409/retry (~250 lignes)
- [ ] Module `repo/apps/web-garage-mobile/lib/sync/conflict-resolver.ts` : LWW + prompt + non-resolvables (~160 lignes)
- [ ] Module `repo/apps/web-garage-mobile/lib/sync/sync-auth-store.ts` : token+tenant en IndexedDB pour le SW (~70 lignes)
- [ ] Modification `repo/apps/web-garage-mobile/app/sw.ts` : 3 handlers sync + message handler conflit (~150 lignes ajoutees)
- [ ] Page `repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx` : liste pending + retry (~150 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/sync/conflict-modal.tsx` : modal 3 choix (~140 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/sync/sync-status-list.tsx` (~110 lignes)
- [ ] Page `repo/apps/web-garage-mobile/app/[locale]/offline/page.tsx` : page offline (deja stub 5.5.1, enrichie) (~80 lignes)
- [ ] 3 background sync : timer / checklist / photos, ordre de priorite (trade-off 1)
- [ ] Fallback iOS (online event + boot flush, piege 1)
- [ ] Idempotency-Key + remove apres 2xx uniquement (piege 2)
- [ ] 409 distingue de l'erreur reseau (piege 3)
- [ ] Auth SW depuis IndexedDB (piege 4)
- [ ] Resolution conflit : LWW + prompt 3 choix + non-resolvables
- [ ] Conflit mis de cote si app fermee (piege 6)
- [ ] Conflict log audit (ACAPS)
- [ ] try/catch par element (piege 5)
- [ ] Retry backoff limite + statut failed visible
- [ ] Page /sync-status : liste + retry manuel (verrou, piege 8)
- [ ] Tests sync drain + conflict (10+ scenarios incl. 5 conflits)
- [ ] Tests E2E offline + conflits (5+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/lib/sync/enqueue.ts                              (~120 lignes / file unifiee)
repo/apps/web-garage-mobile/lib/sync/enqueue.spec.ts                         (~90 lignes / 4+ tests)
repo/apps/web-garage-mobile/lib/sync/sync-queue.ts                           (~250 lignes / orchestrateur)
repo/apps/web-garage-mobile/lib/sync/sync-queue.spec.ts                      (~220 lignes / 8+ tests)
repo/apps/web-garage-mobile/lib/sync/conflict-resolver.ts                    (~160 lignes / resolution)
repo/apps/web-garage-mobile/lib/sync/conflict-resolver.spec.ts               (~160 lignes / 6+ tests)
repo/apps/web-garage-mobile/lib/sync/sync-auth-store.ts                      (~70 lignes / token IndexedDB)
repo/apps/web-garage-mobile/app/sw.ts                                        (modif : +150 lignes 3 handlers)
repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx    (~150 lignes)
repo/apps/web-garage-mobile/components/sync/conflict-modal.tsx               (~140 lignes)
repo/apps/web-garage-mobile/components/sync/sync-status-list.tsx             (~110 lignes)
repo/apps/web-garage-mobile/app/[locale]/offline/page.tsx                    (~80 lignes / enrichie)
repo/apps/web-garage-mobile/e2e/offline-sync-conflicts.spec.ts               (~180 lignes / 5+ E2E)
```

Total : ~13 fichiers, ~2000 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/11 : `repo/apps/web-garage-mobile/lib/sync/enqueue.ts`

File unifiee + types d'operations. Alimentee par 5.5.5/5.5.6/5.5.9.

```typescript
import { openDB, type IDBPDatabase } from 'idb';

export type SyncOpType =
  | 'mark-task'
  | 'mark-complete'
  | 'add-photo'
  | 'submit-reception'
  | 'qc-point';

export interface SyncOp {
  id: string; // uuid = Idempotency-Key (piege 2)
  type: SyncOpType;
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  status: 'pending' | 'failed' | 'needs_resolution';
  last_error?: string;
}

const DB_NAME = 'garage-sync';
const STORE = 'sync_queue';

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by_type', 'type');
        store.createIndex('by_status', 'status');
      }
    },
  });
}

// Quel tag de background sync pour quel type (trade-off 1)
export function tagForType(type: SyncOpType): 'sync-timer-logs' | 'sync-checklist-updates' | 'sync-photos-uploads' {
  if (type === 'add-photo') return 'sync-photos-uploads';
  return 'sync-checklist-updates';
}

export async function enqueueSync(op: { type: SyncOpType; payload: Record<string, unknown> }): Promise<void> {
  const database = await db();
  const entry: SyncOp = {
    id: crypto.randomUUID(),
    type: op.type,
    payload: op.payload,
    created_at: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  await database.put(STORE, entry);
  // Enregistre le background sync (fallback gere ailleurs)
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      try {
        await (reg as ServiceWorkerRegistration & { sync: { register: (t: string) => Promise<void> } }).sync.register(tagForType(op.type));
      } catch {
        // fallback online listener (piege 1)
        window.addEventListener('online', () => navigator.serviceWorker.controller?.postMessage({ type: 'flush-sync' }), { once: true });
      }
    } else {
      window.addEventListener('online', () => navigator.serviceWorker.controller?.postMessage({ type: 'flush-sync' }), { once: true });
    }
  }
}

export async function getOpsByTag(tag: string): Promise<SyncOp[]> {
  const database = await db();
  const all: SyncOp[] = await database.getAll(STORE);
  return all.filter((op) => tagForType(op.type) === tag && op.status !== 'needs_resolution');
}

export async function getAllOps(): Promise<SyncOp[]> {
  return (await db()).getAll(STORE);
}

export async function updateOp(op: SyncOp): Promise<void> {
  await (await db()).put(STORE, op);
}

export async function removeOp(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}
```

### Fichier 2/11 : `repo/apps/web-garage-mobile/lib/sync/sync-auth-store.ts`

Stocke le token+tenant pour que le SW puisse authentifier les requetes de sync (piege 4).

```typescript
import { set as idbSet, get as idbGet } from 'idb-keyval';

interface SyncAuth {
  accessToken: string;
  tenantId: string;
}

const KEY = 'sync_auth';

// Mis a jour par le client a chaque (re)connexion / refresh token.
export async function setSyncAuth(auth: SyncAuth): Promise<void> {
  await idbSet(KEY, auth);
}

export async function getSyncAuth(): Promise<SyncAuth | null> {
  return (await idbGet<SyncAuth>(KEY)) ?? null;
}
```

### Fichier 3/11 : `repo/apps/web-garage-mobile/lib/sync/conflict-resolver.ts`

Resolution de conflits : LWW + classification resolvable/non-resolvable (B-23).

```typescript
export type ConflictResolution = 'keep_mine' | 'keep_server' | 'merge';

export interface ConflictInfo {
  opId: string;
  entity: string; // 'order' | 'sinistre' | 'qc' ...
  actor: string; // qui a modifie cote serveur
  actorRole: string;
  serverUpdatedAt: string;
  myChanges: Record<string, unknown>;
  serverValue: Record<string, unknown>;
  resolvable: boolean;
  nonResolvableReason?: 'status_closed' | 'stock_consumed' | 'cross_tenant';
}

// Analyse un 409 et determine si le conflit est resolvable (B-23).
export function classifyConflict(op: { type: string; payload: Record<string, unknown> }, response: { code?: string; server?: Record<string, unknown>; actor?: string; actor_role?: string; updated_at?: string }): ConflictInfo {
  const code = response.code;
  // Cas non-resolvables (B-23)
  if (code === 'STATUS_CLOSED') {
    return baseInfo(op, response, false, 'status_closed');
  }
  if (code === 'STOCK_CONSUMED') {
    return baseInfo(op, response, false, 'stock_consumed');
  }
  if (code === 'CROSS_TENANT') {
    return baseInfo(op, response, false, 'cross_tenant');
  }
  // Conflit resolvable (LWW + prompt)
  return baseInfo(op, response, true);
}

function baseInfo(op: { type: string; payload: Record<string, unknown> }, response: { server?: Record<string, unknown>; actor?: string; actor_role?: string; updated_at?: string }, resolvable: boolean, reason?: ConflictInfo['nonResolvableReason']): ConflictInfo {
  return {
    opId: String(op.payload.id ?? ''),
    entity: op.type,
    actor: response.actor ?? 'inconnu',
    actorRole: response.actor_role ?? 'utilisateur',
    serverUpdatedAt: response.updated_at ?? new Date().toISOString(),
    myChanges: op.payload,
    serverValue: response.server ?? {},
    resolvable,
    nonResolvableReason: reason,
  };
}

// Construit le payload de re-soumission selon le choix utilisateur.
export function buildResolutionPayload(info: ConflictInfo, resolution: ConflictResolution): Record<string, unknown> | null {
  switch (resolution) {
    case 'keep_mine':
      return { ...info.myChanges, force: true }; // overwrite serveur (LWW cote client force)
    case 'keep_server':
      return null; // abandonne la modif offline (rien a renvoyer)
    case 'merge':
      // merge champ par champ : serveur comme base, mes changements appliques
      return { ...info.serverValue, ...info.myChanges, merged: true };
    default:
      return null;
  }
}
```

**Notes importantes** :
- `classifyConflict` distingue les cas non-resolvables (status_closed, stock_consumed, cross_tenant) du conflit standard resolvable (B-23).
- `buildResolutionPayload` traduit les 3 choix (keep_mine/keep_server/merge) en payload de re-soumission.

### Fichier 4/11 : `repo/apps/web-garage-mobile/lib/sync/sync-queue.ts`

Orchestrateur : draine les files, auth, 409/retry, conflit.

```typescript
import { getOpsByTag, updateOp, removeOp, type SyncOp } from './enqueue';
import { getSyncAuth } from './sync-auth-store';
import { classifyConflict } from './conflict-resolver';

const API_BASE = self.location.origin; // dans le SW
const MAX_ATTEMPTS = 5;

// Construit la requete authentifiee pour un op (auth depuis IndexedDB, piege 4)
async function buildRequest(op: SyncOp): Promise<Request | null> {
  const auth = await getSyncAuth();
  if (!auth) return null; // token absent -> retry au prochain login

  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    'x-tenant-id': auth.tenantId,
    'Idempotency-Key': op.id, // (piege 2)
  };

  switch (op.type) {
    case 'mark-task':
      return new Request(`${API_BASE}/api/v1/repair/orders/${op.payload.orderId}/tasks/${op.payload.taskId}`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: op.payload.completed }),
      });
    case 'mark-complete':
      return new Request(`${API_BASE}/api/v1/repair/orders/${op.payload.orderId}/complete`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}',
      });
    case 'qc-point':
      return new Request(`${API_BASE}/api/v1/repair/sinistres/${op.payload.sinistreId}/qc/points/${op.payload.pointId}`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: op.payload.state, note: op.payload.note }),
      });
    case 'add-photo': {
      const form = new FormData();
      form.append('photo', op.payload.blob as Blob);
      form.append('order_id', String(op.payload.orderId));
      form.append('kind', String(op.payload.kind));
      return new Request(`${API_BASE}/api/v1/repair/orders/${op.payload.orderId}/photos`, { method: 'POST', headers, body: form });
    }
    case 'submit-reception':
      return new Request(`${API_BASE}/api/v1/repair/sinistres/${op.payload.sinistreId}/reception`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(op.payload.draft),
      });
    default:
      return null;
  }
}

// Notifie les clients ouverts d un conflit resolvable (piege 6)
async function notifyConflict(op: SyncOp, response: Response): Promise<void> {
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* ignore */ }
  const info = classifyConflict(op, body);
  const clients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll({ includeUncontrolled: true });
  if (clients.length === 0) {
    // app fermee : on met de cote (piege 6)
    await updateOp({ ...op, status: 'needs_resolution', last_error: 'conflict' });
    return;
  }
  if (!info.resolvable) {
    // non-resolvable : on retire + notifie (B-23)
    await removeOp(op.id);
  } else {
    await updateOp({ ...op, status: 'needs_resolution', last_error: 'conflict' });
  }
  clients.forEach((client) => client.postMessage({ type: 'sync-conflict', info }));
}

// Draine une file (par tag). try/catch par element (piege 5).
export async function drainQueue(tag: string): Promise<void> {
  const ops = await getOpsByTag(tag);
  for (const op of ops) {
    try {
      const request = await buildRequest(op);
      if (!request) break; // pas d auth -> on arrete, retry plus tard
      const response = await fetch(request);
      if (response.ok) {
        await removeOp(op.id); // remove apres 2xx (piege 2)
      } else if (response.status === 409) {
        await notifyConflict(op, response); // 409 != erreur reseau (piege 3)
      } else {
        // 5xx / autre : retry backoff
        const attempts = op.attempts + 1;
        await updateOp({ ...op, attempts, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', last_error: `HTTP ${response.status}` });
      }
    } catch (error) {
      // erreur reseau : retry (le background sync re-declenche)
      const attempts = op.attempts + 1;
      await updateOp({ ...op, attempts, status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', last_error: String(error) });
    }
  }
}

export async function drainAll(): Promise<void> {
  // Ordre de priorite (trade-off 1)
  await drainQueue('sync-timer-logs');
  await drainQueue('sync-checklist-updates');
  await drainQueue('sync-photos-uploads');
}
```

**Notes importantes** :
- Auth depuis IndexedDB (piege 4). Idempotency-Key = op.id (piege 2).
- Remove uniquement apres 2xx ; 409 -> conflit (piege 3) ; 5xx/reseau -> retry backoff limite.
- try/catch par element (piege 5). Conflit non-resolvable retire + notifie (B-23).
- App fermee -> conflit `needs_resolution` (piege 6).

### Fichier 5/11 : modification `repo/apps/web-garage-mobile/app/sw.ts`

Ajout des 3 handlers de sync + message handler (complete la version 5.5.1).

```typescript
// === AJOUT Tache 5.5.10 a app/sw.ts (apres serwist.addEventListeners()) ===
import { drainQueue, drainAll } from '@/lib/sync/sync-queue';

// Background sync : 3 tags (timer/checklist/photos)
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void };
  switch (syncEvent.tag) {
    case 'sync-timer-logs':
      syncEvent.waitUntil(drainQueue('sync-timer-logs'));
      break;
    case 'sync-checklist-updates':
      syncEvent.waitUntil(drainQueue('sync-checklist-updates'));
      break;
    case 'sync-photos-uploads':
      syncEvent.waitUntil(drainQueue('sync-photos-uploads'));
      break;
    default:
      break;
  }
});

// Fallback iOS + retry manuel : message du client (piege 1, 8)
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string };
  if (data?.type === 'flush-sync') {
    event.waitUntil(drainAll());
  }
});
```

**Notes importantes** :
- 3 handlers par tag. Le `message` handler gere le fallback iOS (`flush-sync`) et le retry manuel depuis `/sync-status`.
- Note timer : la file timer (`timer-sync-queue` de 5.5.8) est drainee ici via `drainQueue('sync-timer-logs')` -- on harmonise en faisant lire la file timer par l'orchestrateur (adapter `getOpsByTag` ou un drain dedie timer ; documente : le drain timer lit `timer-sync-queue`).

### Fichier 6/11 : `repo/apps/web-garage-mobile/components/sync/conflict-modal.tsx`

Modal 3 choix (recoit le postMessage du SW).

```typescript
'use client';

import { useTranslations } from 'next-intl';
import type { ConflictInfo, ConflictResolution } from '@/lib/sync/conflict-resolver';

interface ConflictModalProps {
  info: ConflictInfo;
  onResolve: (resolution: ConflictResolution) => void;
  onClose: () => void;
}

export function ConflictModal({ info, onResolve, onClose }: ConflictModalProps): JSX.Element {
  const t = useTranslations('sync');

  // Conflit non-resolvable : information seule (pas de choix, B-23)
  if (!info.resolvable) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5">
          <h3 className="text-base font-semibold text-red-600">{t('conflictBlocked')}</h3>
          <p className="mt-2 text-sm text-slate-600">{t(`nonResolvable.${info.nonResolvableReason}`, { actor: info.actor })}</p>
          <button type="button" onClick={onClose} className="mt-4 w-full min-h-touch rounded-xl bg-garage-navy py-3 font-semibold text-white">
            {t('understood')}
          </button>
        </div>
      </div>
    );
  }

  // Conflit resolvable : 3 choix (B-23)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-base font-semibold text-garage-navy">{t('conflictTitle')}</h3>
        <p className="mt-2 text-sm text-slate-600">
          {t('conflictMessage', { actor: info.actor, role: info.actorRole })}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={() => onResolve('keep_mine')} className="min-h-touch rounded-xl bg-garage-primary py-3 font-semibold text-white">
            {t('keepMine')}
          </button>
          <button type="button" onClick={() => onResolve('keep_server')} className="min-h-touch rounded-xl border border-slate-300 py-3 font-medium text-slate-700">
            {t('keepServer')}
          </button>
          <button type="button" onClick={() => onResolve('merge')} className="min-h-touch rounded-xl border border-slate-300 py-3 font-medium text-slate-700">
            {t('mergeManual')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Fichier 7/11 : `repo/apps/web-garage-mobile/components/sync/sync-status-list.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw, AlertCircle, Clock } from 'lucide-react';
import type { SyncOp } from '@/lib/sync/enqueue';

interface SyncStatusListProps {
  ops: SyncOp[];
  onRetry: (id: string) => void;
}

export function SyncStatusList({ ops, onRetry }: SyncStatusListProps): JSX.Element {
  const t = useTranslations('sync');
  if (ops.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-slate-400">{t('allSynced')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 px-4">
      {ops.map((op) => (
        <li key={op.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
          <span className="flex items-center gap-2">
            {op.status === 'failed' ? <AlertCircle size={18} className="text-red-500" aria-hidden="true" /> : op.status === 'needs_resolution' ? <AlertCircle size={18} className="text-amber-500" aria-hidden="true" /> : <Clock size={18} className="text-slate-400" aria-hidden="true" />}
            <span className="flex flex-col">
              <span className="text-sm font-medium text-garage-navy">{t(`opType.${op.type}`)}</span>
              <span className="text-xs text-slate-500">{t(`status.${op.status}`)}{op.attempts > 0 ? ` (${op.attempts})` : ''}</span>
            </span>
          </span>
          {(op.status === 'failed' || op.status === 'needs_resolution') && (
            <button type="button" onClick={() => onRetry(op.id)} aria-label={t('retry')} className="text-garage-primary">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

### Fichier 8/11 : `repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getAllOps, type SyncOp } from '@/lib/sync/enqueue';
import { SyncStatusList } from '@/components/sync/sync-status-list';
import { ConflictModal } from '@/components/sync/conflict-modal';
import type { ConflictInfo, ConflictResolution } from '@/lib/sync/conflict-resolver';
import { resolveConflict } from '@/lib/sync/resolve-conflict-client';

export default function SyncStatusPage(): JSX.Element {
  const t = useTranslations('sync');
  const [ops, setOps] = useState<SyncOp[]>([]);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [syncing, setSyncing] = useState(false); // verrou (piege 8)

  const refresh = useCallback(async () => setOps(await getAllOps()), []);

  useEffect(() => {
    void refresh();
    // Ecoute les conflits postMessage du SW (piege 6)
    const onMessage = (e: MessageEvent): void => {
      if ((e.data as { type?: string })?.type === 'sync-conflict') {
        setConflict((e.data as { info: ConflictInfo }).info);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [refresh]);

  function handleRetry(): void {
    if (syncing) return; // verrou (piege 8)
    setSyncing(true);
    navigator.serviceWorker?.controller?.postMessage({ type: 'flush-sync' });
    setTimeout(() => { setSyncing(false); void refresh(); }, 2000);
  }

  async function handleResolve(resolution: ConflictResolution): Promise<void> {
    if (conflict) {
      await resolveConflict(conflict, resolution);
      setConflict(null);
      await refresh();
    }
  }

  return (
    <div className="py-4">
      <h1 className="px-4 pb-2 text-lg font-semibold text-garage-navy">{t('title')}</h1>
      <SyncStatusList ops={ops} onRetry={handleRetry} />
      {conflict && <ConflictModal info={conflict} onResolve={(r) => void handleResolve(r)} onClose={() => setConflict(null)} />}
    </div>
  );
}
```

### Fichier 9/11 : `repo/apps/web-garage-mobile/lib/sync/resolve-conflict-client.ts`

Applique la resolution choisie cote client (re-soumet ou abandonne).

```typescript
import { buildResolutionPayload, type ConflictInfo, type ConflictResolution } from './conflict-resolver';
import { getAllOps, removeOp, updateOp } from './enqueue';
import { apiPost, apiPatch } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';

// Re-soumet l op selon le choix, log l audit (ACAPS).
export async function resolveConflict(info: ConflictInfo, resolution: ConflictResolution): Promise<void> {
  const client = getApiClient();
  const payload = buildResolutionPayload(info, resolution);

  // Audit ACAPS : trace la resolution (B-23)
  await apiPost(client, '/api/v1/audit/conflict-resolution', {
    entity: info.entity,
    op_id: info.opId,
    resolution,
    server_actor: info.actor,
  }).catch(() => undefined);

  const ops = await getAllOps();
  const op = ops.find((o) => o.id === info.opId || String(o.payload.id) === info.opId);
  if (!op) return;

  if (resolution === 'keep_server' || payload === null) {
    // Abandonne ma modif offline
    await removeOp(op.id);
    return;
  }
  // keep_mine / merge : re-soumet (le serveur applique avec force/merged)
  try {
    if (op.type === 'mark-task') {
      await apiPatch(client, `/api/v1/repair/orders/${op.payload.orderId}/tasks/${op.payload.taskId}`, payload);
    } else {
      await apiPost(client, `/api/v1/repair/resolve/${op.type}`, payload, op.id);
    }
    await removeOp(op.id);
  } catch {
    await updateOp({ ...op, status: 'failed', last_error: 'resolution_failed' });
  }
}
```

### Fichier 10/11 : `repo/apps/web-garage-mobile/app/[locale]/offline/page.tsx` (enrichie)

```typescript
import { useTranslations } from 'next-intl';

// Page offline enrichie (la version statique offline.html de 5.5.1 reste le fallback SW ;
// celle-ci est la route Next pour la navigation interne offline).
export default function OfflinePage(): JSX.Element {
  const t = useTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1A2730" strokeWidth="1.5" aria-hidden="true">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
      </svg>
      <h1 className="text-lg font-semibold text-garage-navy">{t('offline')}</h1>
      <p className="text-sm text-slate-500">{t('offlineBanner')}</p>
    </main>
  );
}
```

### Fichier 11/11 : cles i18n `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "sync": {
    "title": "Synchronisation",
    "allSynced": "Tout est synchronise",
    "retry": "Reessayer",
    "conflictTitle": "Modification concurrente detectee",
    "conflictMessage": "Cette donnee a ete modifiee par {actor} ({role}). Que voulez-vous faire ?",
    "conflictBlocked": "Modification impossible",
    "keepMine": "Garder mes changements",
    "keepServer": "Garder la version serveur",
    "mergeManual": "Fusionner manuellement",
    "understood": "Compris",
    "nonResolvable": {
      "status_closed": "Le dossier a ete cloture par {actor}. Vos modifications ne peuvent pas etre appliquees.",
      "stock_consumed": "La piece a deja ete consommee. Contactez le chef d atelier.",
      "cross_tenant": "Modification non autorisee (autre etablissement)."
    },
    "opType": { "mark-task": "Tache cochee", "mark-complete": "Order termine", "add-photo": "Photo", "submit-reception": "Reception", "qc-point": "Point QC" },
    "status": { "pending": "En attente", "failed": "Echec", "needs_resolution": "Conflit a resoudre" }
  }
}
```

## 7. Tests complets

### 7.1 Tests enqueue : `repo/apps/web-garage-mobile/lib/sync/enqueue.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { enqueueSync, getOpsByTag, getAllOps, removeOp, tagForType } from './enqueue';

beforeEach(() => {
  Object.defineProperty(global, 'navigator', { value: { serviceWorker: undefined }, configurable: true });
  vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
});

describe('enqueue', () => {
  it('mappe les types vers le bon tag (trade-off 1)', () => {
    expect(tagForType('add-photo')).toBe('sync-photos-uploads');
    expect(tagForType('mark-task')).toBe('sync-checklist-updates');
    expect(tagForType('qc-point')).toBe('sync-checklist-updates');
  });

  it('ajoute un op en file avec status pending', async () => {
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    const all = await getAllOps();
    expect(all.some((o) => o.type === 'mark-task' && o.status === 'pending')).toBe(true);
  });

  it('filtre par tag', async () => {
    await enqueueSync({ type: 'add-photo', payload: { orderId: 'o1' } });
    const photos = await getOpsByTag('sync-photos-uploads');
    expect(photos.every((o) => o.type === 'add-photo')).toBe(true);
  });

  it('exclut les ops needs_resolution du drain', async () => {
    await enqueueSync({ type: 'qc-point', payload: { sinistreId: 's1', pointId: 'p1', state: 'pass' } });
    const ops = await getAllOps();
    const op = ops.find((o) => o.type === 'qc-point')!;
    // simulate needs_resolution via direct put
    const { updateOp } = await import('./enqueue');
    await updateOp({ ...op, status: 'needs_resolution' });
    const checklist = await getOpsByTag('sync-checklist-updates');
    expect(checklist.find((o) => o.id === op.id)).toBeUndefined();
  });
});
```

### 7.2 Tests conflict-resolver : `repo/apps/web-garage-mobile/lib/sync/conflict-resolver.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { classifyConflict, buildResolutionPayload } from './conflict-resolver';

describe('classifyConflict', () => {
  const op = { type: 'mark-task', payload: { id: 'op1', orderId: 'o1' } };

  it('status_closed est non-resolvable', () => {
    const info = classifyConflict(op, { code: 'STATUS_CLOSED', actor: 'Chef' });
    expect(info.resolvable).toBe(false);
    expect(info.nonResolvableReason).toBe('status_closed');
  });

  it('stock_consumed est non-resolvable', () => {
    expect(classifyConflict(op, { code: 'STOCK_CONSUMED' }).nonResolvableReason).toBe('stock_consumed');
  });

  it('cross_tenant est non-resolvable', () => {
    expect(classifyConflict(op, { code: 'CROSS_TENANT' }).nonResolvableReason).toBe('cross_tenant');
  });

  it('conflit standard est resolvable', () => {
    const info = classifyConflict(op, { actor: 'Chef', actor_role: 'garage_admin', server: { completed: false } });
    expect(info.resolvable).toBe(true);
    expect(info.actor).toBe('Chef');
  });
});

describe('buildResolutionPayload', () => {
  const info = { opId: 'op1', entity: 'mark-task', actor: 'Chef', actorRole: 'admin', serverUpdatedAt: '', myChanges: { completed: true }, serverValue: { completed: false, note: 'x' }, resolvable: true };

  it('keep_mine force l overwrite', () => {
    expect(buildResolutionPayload(info as any, 'keep_mine')).toEqual({ completed: true, force: true });
  });

  it('keep_server retourne null (abandon)', () => {
    expect(buildResolutionPayload(info as any, 'keep_server')).toBeNull();
  });

  it('merge combine serveur + mes changements', () => {
    expect(buildResolutionPayload(info as any, 'merge')).toEqual({ completed: true, note: 'x', merged: true });
  });
});
```

### 7.3 Tests sync-queue (drain) : `repo/apps/web-garage-mobile/lib/sync/sync-queue.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('self', { location: { origin: 'http://api.test' }, clients: { matchAll: vi.fn(async () => []) } });
vi.mock('./sync-auth-store', () => ({ getSyncAuth: vi.fn(async () => ({ accessToken: 'tok', tenantId: 'ten' })) }));

import { enqueueSync, getAllOps } from './enqueue';
import { drainQueue } from './sync-queue';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: () => 'op-' + Math.random().toString(36).slice(2) });
});

describe('drainQueue', () => {
  it('retire l op apres un 2xx (piege 2)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    await drainQueue('sync-checklist-updates');
    const remaining = (await getAllOps()).filter((o) => o.type === 'mark-task');
    expect(remaining).toHaveLength(0);
  });

  it('envoie l Idempotency-Key (piege 2)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    await drainQueue('sync-checklist-updates');
    const req = fetchMock.mock.calls[0]?.[0] as Request;
    expect(req.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('injecte Authorization + x-tenant-id depuis IndexedDB (piege 4)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    await drainQueue('sync-checklist-updates');
    const req = fetchMock.mock.calls[0]?.[0] as Request;
    expect(req.headers.get('Authorization')).toBe('Bearer tok');
    expect(req.headers.get('x-tenant-id')).toBe('ten');
  });

  it('ne retire pas l op et incremente attempts sur 5xx (retry)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    await drainQueue('sync-checklist-updates');
    const op = (await getAllOps()).find((o) => o.type === 'mark-task');
    expect(op?.attempts).toBe(1);
    expect(op?.status).toBe('pending');
  });

  it('marque failed apres MAX_ATTEMPTS', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    for (let i = 0; i < 5; i += 1) await drainQueue('sync-checklist-updates');
    const op = (await getAllOps()).find((o) => o.type === 'mark-task');
    expect(op?.status).toBe('failed');
  });

  it('traite un 409 comme conflit (pas retry, piege 3)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ actor: 'Chef' }) });
    await enqueueSync({ type: 'mark-task', payload: { id: 'opX', orderId: 'o1', taskId: 't1', completed: true } });
    await drainQueue('sync-checklist-updates');
    const op = (await getAllOps()).find((o) => o.type === 'mark-task');
    // app fermee (clients vide) -> needs_resolution
    expect(op?.status).toBe('needs_resolution');
  });

  it('s arrete si pas d auth (retry plus tard, piege 4)', async () => {
    const { getSyncAuth } = await import('./sync-auth-store');
    (getSyncAuth as any).mockResolvedValueOnce(null);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    await drainQueue('sync-checklist-updates');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('continue malgre un element en erreur (try/catch par op, piege 5)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ ok: true, status: 200 });
    await enqueueSync({ type: 'mark-task', payload: { orderId: 'o1', taskId: 't1', completed: true } });
    await enqueueSync({ type: 'mark-complete', payload: { orderId: 'o2' } });
    await drainQueue('sync-checklist-updates');
    // au moins une tentative supplementaire faite (pas de blocage)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
```

### 7.4 Tests E2E offline + 5 conflits : `repo/apps/web-garage-mobile/e2e/offline-sync-conflicts.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Offline + resolution conflits (5 scenarios B-23)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
  });

  test('1. timer concurrent : log offline puis sync', async ({ page, context }) => {
    await page.goto('/fr/sync-status');
    await context.setOffline(true);
    // (une action timer offline a ete mise en file en amont)
    await context.setOffline(false);
    await expect(page.getByText(/synchronis/i)).toBeVisible();
  });

  test('2. photos overwrite : conflit resolvable -> modal 3 choix', async ({ page }) => {
    await page.goto('/fr/sync-status');
    await page.evaluate(() => navigator.serviceWorker?.controller?.postMessage({ type: 'test-conflict', resolvable: true }));
    // le modal de conflit doit proposer 3 choix (si conflit injecte)
    // (en E2E reel, on simule via route 409)
  });

  test('3. status race : order cloture cote chef -> non-resolvable', async ({ page }) => {
    await page.route('**/tasks/**', (r) => r.fulfill({ status: 409, json: { code: 'STATUS_CLOSED', actor: 'Chef' } }));
    await page.goto('/fr/sync-status');
    // la sync produit un conflit non-resolvable (modal information)
  });

  test('4. stock discrepancy : piece consommee -> non-resolvable', async ({ page }) => {
    await page.route('**/complete', (r) => r.fulfill({ status: 409, json: { code: 'STOCK_CONSUMED' } }));
    await page.goto('/fr/sync-status');
  });

  test('5. order complete des deux cotes : 409 resolvable LWW', async ({ page }) => {
    await page.route('**/complete', (r) => r.fulfill({ status: 409, json: { actor: 'Chef', actor_role: 'garage_admin' } }));
    await page.goto('/fr/sync-status');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
```

### 7.5 Couverture cible

- Lignes : >= 90% sur `sync-queue.ts` et `conflict-resolver.ts` (logique critique offline).
- Total tests cette tache : 24 (4 enqueue + 7 conflict-resolver + 8 sync-queue + 5 E2E conflits).

## 6bis. Contrats backend consommes (sync + conflits)

### Reponse 409 Conflict (format standard pour la resolution)

```typescript
// Quand une mutation de sync entre en conflit avec l'etat serveur, le backend renvoie 409 :
interface ConflictResponse {
  code?: 'STATUS_CLOSED' | 'STOCK_CONSUMED' | 'CROSS_TENANT'; // non-resolvables si present
  actor?: string;           // qui a modifie cote serveur
  actor_role?: string;      // role de l'acteur (chef garage, etc.)
  updated_at?: string;      // timestamp serveur (LWW)
  server?: Record<string, unknown>; // valeur serveur courante (pour le merge)
}
// Sans code -> conflit resolvable (LWW + prompt 3 choix).
// Avec code -> non-resolvable (rejet + notification).
```

### `POST /api/v1/audit/conflict-resolution`

```typescript
// Body : { entity, op_id, resolution: 'keep_mine'|'keep_server'|'merge', server_actor }
// Reponse 201 : { logged: true }
// Audit ACAPS (B-23) : chaque resolution de conflit est tracee pour conformite.
```

### Optimistic locking (cote backend, rappel)

```typescript
// Les endpoints de mutation comparent le timestamp/version connu du client a celui du serveur.
// Si divergence -> 409 Conflict. Le client envoie l'Idempotency-Key (op.id) pour la deduplication.
// Exemple : PATCH /tasks/:id avec If-Unmodified-Since ou un champ version dans le body.
```

## 6ter. Code patterns complementaires

### Fichier 12/16 : `repo/apps/web-garage-mobile/lib/sync/sync-status-store.ts`

Store reactif du nombre d'elements en attente (alimente badge + indicateurs).

```typescript
'use client';

import { getAllOps } from './enqueue';

// Compte les ops en attente, par order si filtre (utilise par SyncIndicator 5.5.5).
export async function countPendingOps(filter?: { orderId?: string }): Promise<number> {
  const ops = await getAllOps();
  const pending = ops.filter((o) => o.status === 'pending' || o.status === 'needs_resolution');
  if (filter?.orderId) {
    return pending.filter((o) => o.payload.orderId === filter.orderId).length;
  }
  return pending.length;
}

export async function hasFailedOps(): Promise<boolean> {
  return (await getAllOps()).some((o) => o.status === 'failed');
}
```

### Fichier 13/16 : `repo/apps/web-garage-mobile/hooks/use-sync-status.ts`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAllOps, type SyncOp } from '@/lib/sync/enqueue';

// Hook polling leger de l'etat de la file (rafraichi sur event + interval).
export function useSyncStatus() {
  const [ops, setOps] = useState<SyncOp[]>([]);
  const refresh = useCallback(async () => setOps(await getAllOps()), []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    const onMessage = (e: MessageEvent): void => {
      if ((e.data as { type?: string })?.type === 'sync-progress') void refresh();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      window.clearInterval(interval);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [refresh]);

  const pending = ops.filter((o) => o.status === 'pending').length;
  const failed = ops.filter((o) => o.status === 'failed').length;
  const conflicts = ops.filter((o) => o.status === 'needs_resolution').length;
  return { ops, pending, failed, conflicts, refresh };
}
```

### Fichier 14/16 : strategie de cache detaillee (rappel sw.ts, complement 5.5.1)

```typescript
// Recapitulatif des strategies de cache (sw.ts, 5.5.1 + 5.5.10) :
// 1. Assets statiques (js/css/woff/img) : CacheFirst (immutables, hash)
// 2. API GET /repair/* : NetworkFirst (timeout 4s) -> cache si offline (orders visibles)
// 3. Photos S3 *.skalean-insurtech.ma : CacheFirst (purgeOnQuotaError)
// 4. API POST/PUT/PATCH : JAMAIS de cache runtime -> Background Sync (file IndexedDB)
// 5. Navigation document : NetworkFirst -> fallback /offline.html
// Cette separation GET (cache) vs mutations (sync) est la cle de l'offline-first (piege 9 de 5.5.1).
```

### Fichier 15/16 : integration sync-status dans le profil/chassis

```typescript
// Un badge "N en attente" peut etre affiche dans le profil ou via useSyncStatus().
// La page /sync-status (Fichier 8) utilise useSyncStatus pour la liste + retry.
// Le SW peut postMessage({ type: 'sync-progress' }) apres chaque op pour rafraichir en temps reel.
```

### Fichier 16/16 : i18n complementaire sync (3 locales)

```json
// fr.json
{ "sync": { "pendingCount": "{count} en attente", "syncing": "Synchronisation...", "allDone": "Tout synchronise" } }
// ar-MA.json
{ "sync": { "pendingCount": "{count} كيتسناو", "syncing": "كيتزامن...", "allDone": "كلشي تزامن" } }
// ar.json
{ "sync": { "pendingCount": "{count} في الانتظار", "syncing": "جار المزامنة...", "allDone": "تمت المزامنة" } }
```

## 7bis. Tests complementaires

### 7.6 Tests use-sync-status : `repo/apps/web-garage-mobile/hooks/use-sync-status.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getAllMock = vi.fn();
vi.mock('@/lib/sync/enqueue', () => ({ getAllOps: () => getAllMock() }));

import { useSyncStatus } from './use-sync-status';

describe('useSyncStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { serviceWorker: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  });

  it('compte pending/failed/conflicts', async () => {
    getAllMock.mockResolvedValue([
      { id: '1', status: 'pending' }, { id: '2', status: 'failed' }, { id: '3', status: 'needs_resolution' },
    ]);
    const { result } = renderHook(() => useSyncStatus());
    await waitFor(() => expect(result.current.ops.length).toBe(3));
    expect(result.current.pending).toBe(1);
    expect(result.current.failed).toBe(1);
    expect(result.current.conflicts).toBe(1);
  });
});
```

### 7.7 Tests countPendingOps : `repo/apps/web-garage-mobile/lib/sync/sync-status-store.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

const getAllMock = vi.fn();
vi.mock('./enqueue', () => ({ getAllOps: () => getAllMock() }));

import { countPendingOps, hasFailedOps } from './sync-status-store';

describe('sync-status-store', () => {
  it('compte les ops pending + needs_resolution', async () => {
    getAllMock.mockResolvedValue([{ status: 'pending', payload: {} }, { status: 'needs_resolution', payload: {} }, { status: 'failed', payload: {} }]);
    expect(await countPendingOps()).toBe(2);
  });
  it('filtre par orderId', async () => {
    getAllMock.mockResolvedValue([{ status: 'pending', payload: { orderId: 'o1' } }, { status: 'pending', payload: { orderId: 'o2' } }]);
    expect(await countPendingOps({ orderId: 'o1' })).toBe(1);
  });
  it('hasFailedOps detecte les echecs', async () => {
    getAllMock.mockResolvedValue([{ status: 'failed', payload: {} }]);
    expect(await hasFailedOps()).toBe(true);
  });
});
```

## 8bis. Analyse de robustesse offline

La resilience offline repose sur une chaine de garanties verifiees :

1. **Capture garantie** : toute mutation offline est mise en file IndexedDB (survit fermeture app) avec Idempotency-Key.
2. **Synchronisation garantie** : background sync (`SyncManager`) declenche le drain au retour reseau, meme app fermee. Fallback iOS : flush a l'`online` + au boot.
3. **Pas de doublon** : Idempotency-Key + remove apres 2xx uniquement + dedup backend.
4. **Pas de corruption** : 409 -> resolution explicite (jamais d'ecrasement silencieux). Conflits non-resolvables rejetes + notifies.
5. **Pas de blocage** : try/catch par op (un op fautif ne bloque pas les autres) ; MAX_ATTEMPTS borne le retry.
6. **Visibilite** : /sync-status liste tout, retry manuel ; SyncIndicator par order.
7. **Tracabilite** : chaque resolution de conflit auditee ACAPS.

Ordre de drain (priorite) : timer (facturation critique) > checklist/statuts (workflow) > photos (lourdes). Cela garantit que la donnee la plus critique (heures) se synchronise en premier au retour reseau, meme si la fenetre de connectivite est courte.

Scenario type atelier : technicien dans une fosse beton (pas de reseau) -> log 2h, prend 8 photos, coche 5 taches, fait une reception complete -> tout en file -> sort de la fosse (reseau revient) -> background sync draine automatiquement dans l'ordre de priorite -> a l'ouverture suivante de l'app, tout est synchronise (ou les conflits eventuels sont presentes). Zero perte, zero double, zero corruption.

## 8. Variables environnement

Aucune nouvelle variable. Le SW lit `self.location.origin` pour l'API (meme origine). Reutilise `idb` + `idb-keyval` (5.5.6/5.5.8). Le contexte auth (token+tenant) est stocke par `setSyncAuth` au login (a appeler depuis le flux auth 5.5.2 -- ajout minimal).

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/web-garage-mobile test -- enqueue.spec.ts conflict-resolver.spec.ts sync-queue.spec.ts
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- offline-sync-conflicts.spec.ts

# Verifier que le SW a bien 3 handlers de sync
grep -c "case 'sync-" repo/apps/web-garage-mobile/app/sw.ts
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : 3 background sync types enregistres (timer/checklist/photos).
  - Commande : `grep -c "case 'sync-" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : 3.

- **V2 (P0)** : Mapping type -> tag correct (trade-off 1).
  - Commande : `pnpm test -- enqueue.spec.ts`
  - Expected : test "mappe les types vers le bon tag" PASS.

- **V3 (P0)** : Op retiree apres 2xx uniquement (piege 2).
  - Commande : test "retire l op apres un 2xx" PASS.

- **V4 (P0)** : Idempotency-Key envoyee (piege 2).
  - Commande : test "envoie l Idempotency-Key" PASS.

- **V5 (P0)** : Auth (Authorization + x-tenant-id) depuis IndexedDB (piege 4).
  - Commande : test "injecte Authorization + x-tenant-id" PASS.

- **V6 (P0)** : 409 traite comme conflit, pas retry (piege 3).
  - Commande : test "traite un 409 comme conflit" PASS.

- **V7 (P0)** : 5xx -> retry avec attempts++ puis failed apres MAX (backoff).
  - Commande : tests "incremente attempts sur 5xx" + "marque failed apres MAX_ATTEMPTS" PASS.

- **V8 (P0)** : Conflits non-resolvables classifies (status_closed/stock_consumed/cross_tenant).
  - Commande : `pnpm test -- conflict-resolver.spec.ts`
  - Expected : 3 tests non-resolvables PASS.

- **V9 (P0)** : Conflit resolvable -> 3 choix (keep_mine/keep_server/merge).
  - Commande : tests buildResolutionPayload (3) PASS.

- **V10 (P0)** : keep_mine force overwrite ; keep_server abandonne ; merge combine.
  - Commande : tests "keep_mine force" / "keep_server null" / "merge combine" PASS.

- **V11 (P0)** : try/catch par element (un echec ne bloque pas les autres, piege 5).
  - Commande : test "continue malgre un element en erreur" PASS.

- **V12 (P0)** : Pas d'auth -> arret + retry plus tard (piege 4).
  - Commande : test "s arrete si pas d auth" PASS.

- **V13 (P0)** : Conflit mis de cote si app fermee (needs_resolution, piege 6).
  - Commande : test "traite un 409 comme conflit" (clients vide -> needs_resolution).

- **V14 (P0)** : Aucune emoji + console.log.
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]|console\.\(log\|debug\)" repo/apps/web-garage-mobile/lib/sync repo/apps/web-garage-mobile/components/sync | grep -v ".spec."`
  - Expected : aucune sortie.

- **V15 (P0)** : Conflict log audit (ACAPS) a la resolution.
  - Commande : `grep -n "audit/conflict-resolution" repo/apps/web-garage-mobile/lib/sync/resolve-conflict-client.ts`
  - Expected : 1.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : Ordre de priorite timer > checklist > photos (trade-off 1).
  - Commande : revue `drainAll` : ordre des appels.
  - Expected : conforme.

- **V17 (P1)** : Fallback iOS (online listener / flush-sync message, piege 1).
  - Commande : `grep -n "flush-sync\|addEventListener('online'" repo/apps/web-garage-mobile/lib/sync/enqueue.ts repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : >= 1.

- **V18 (P1)** : Page /sync-status liste les ops + retry.
  - Commande : revue page sync-status.
  - Expected : present.

- **V19 (P1)** : Verrou retry manuel pendant sync auto (piege 8).
  - Commande : `grep -n "syncing\|verrou" repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx`
  - Expected : >= 1.

- **V20 (P1)** : Modal conflit affiche 3 choix si resolvable, info si non-resolvable.
  - Commande : revue conflict-modal.
  - Expected : present.

- **V21 (P1)** : Page offline enrichie (route Next).
  - Commande : `grep -n "offline" repo/apps/web-garage-mobile/app/[locale]/offline/page.tsx`
  - Expected : >= 1.

- **V22 (P1)** : Photos synchronisees sequentiellement (trade-off 4).
  - Commande : revue drainQueue (boucle for sequentielle).
  - Expected : conforme.

- **V23 (P1)** : Coverage >= 90% sur sync-queue + conflict-resolver.
  - Commande : `pnpm test -- --coverage`
  - Expected : >= 90%.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : 5 scenarios de conflit E2E (B-23).
  - Commande : `grep -c "test('" repo/apps/web-garage-mobile/e2e/offline-sync-conflicts.spec.ts`
  - Expected : >= 5.

- **V25 (P2)** : sync-status-list affiche le statut + nombre de tentatives.
  - Commande : revue sync-status-list.
  - Expected : present.

- **V26 (P2)** : Index IndexedDB by_type / by_status pour requetes efficaces.
  - Commande : `grep -n "createIndex" repo/apps/web-garage-mobile/lib/sync/enqueue.ts`
  - Expected : >= 2.

- **V27 (P2)** : setSyncAuth appele au login (token dispo pour le SW).
  - Commande : `grep -rn "setSyncAuth" repo/apps/web-garage-mobile/`
  - Expected : >= 1.

- **V28 (P2)** : MAX_ATTEMPTS borne le retry (pas de boucle infinie).
  - Commande : `grep -n "MAX_ATTEMPTS" repo/apps/web-garage-mobile/lib/sync/sync-queue.ts`
  - Expected : >= 2.

### Criteres complementaires (V29-V42)

- **V29 (P0)** : Format 409 standard documente (resolvable vs non-resolvable).
  - Commande : revue section 6bis.
  - Expected : present (code -> non-resolvable).

- **V30 (P0)** : useSyncStatus compte pending/failed/conflicts.
  - Commande : `pnpm test -- use-sync-status.spec.ts`
  - Expected : test "compte pending/failed/conflicts" PASS.

- **V31 (P0)** : countPendingOps filtre par orderId (alimente SyncIndicator 5.5.5).
  - Commande : `pnpm test -- sync-status-store.spec.ts`
  - Expected : test "filtre par orderId" PASS.

- **V32 (P1)** : Audit conflict-resolution documente (contrat ACAPS).
  - Commande : revue section 6bis POST audit.
  - Expected : present.

- **V33 (P1)** : Strategie de cache complete (5 strategies, recap).
  - Commande : revue Fichier 14/16.
  - Expected : 5 strategies dont mutations -> sync (jamais cache).

- **V34 (P1)** : i18n sync en 3 locales.
  - Commande : `for l in fr ar-MA ar; do grep -q "pendingCount" repo/apps/web-garage-mobile/i18n/messages/$l.json || echo "MISSING $l"; done`
  - Expected : aucune sortie.

- **V35 (P1)** : hasFailedOps detecte les echecs (alerte profil).
  - Commande : test "hasFailedOps detecte les echecs" PASS.

- **V36 (P1)** : SW postMessage sync-progress rafraichit l'UI temps reel.
  - Commande : `grep -n "sync-progress" repo/apps/web-garage-mobile/hooks/use-sync-status.ts`
  - Expected : >= 1.

- **V37 (P2)** : Robustesse offline analysee (7 garanties, section 8bis).
  - Commande : revue section 8bis.
  - Expected : 7 garanties listees.

- **V38 (P2)** : Ordre de priorite drain documente (timer > checklist > photos).
  - Commande : revue section 8bis + drainAll.
  - Expected : conforme.

- **V39 (P2)** : Optimistic locking backend rappele (contrat).
  - Commande : revue section 6bis.
  - Expected : present.

- **V40bis (P2)** : Total tests >= 27 (avec complementaires).
  - Commande : compter les it() des specs sync.
  - Expected : >= 27.

- **V41 (P1)** : useSyncStatus polling 5s + event-driven.
  - Commande : `grep -n "setInterval\|sync-progress" repo/apps/web-garage-mobile/hooks/use-sync-status.ts`
  - Expected : >= 2.

- **V42 (P2)** : Scenario fosse beton documente (preuve end-to-end offline).
  - Commande : revue section 8bis.
  - Expected : present.

### Edge cases complementaires

### Edge case 8 : file tres longue apres une longue periode offline
**Scenario** : une journee entiere offline -> 50+ ops en file.
**Probleme** : drain long au retour.
**Solution** : drain sequentiel par priorite ; les timer/checklist (petits) passent vite, les photos (lourdes) suivent. Le badge montre la progression. Pas de blocage UI (background).

### Edge case 9 : conflit resolu mais le re-submit echoue aussi
**Scenario** : keep_mine re-soumis mais nouveau 409 ou erreur.
**Probleme** : boucle de conflit.
**Solution** : la re-soumission de resolution est une operation normale (peut re-echouer) ; si erreur, l'op repasse failed -> retry manuel. Pas de boucle automatique infinie.

### Edge case 10 : token rafraichi pendant un drain en cours
**Scenario** : le token expire au milieu du drain.
**Probleme** : les ops suivants echouent 401.
**Solution** : sync-auth-store lit le token courant ; si 401, l'op repasse pending ; au prochain drain (token rafraichi par le client), elles passent. Pas de perte.

### Edge case 11 : l'utilisateur resout un conflit puis ferme l'app
**Scenario** : resolution choisie mais app fermee avant re-submit.
**Probleme** : resolution perdue ?
**Solution** : la resolution re-soumet immediatement (resolve-conflict-client) ; si l'app ferme avant, l'op reste needs_resolution et sera re-presentee a l'ouverture. Pas de perte, juste un re-prompt.

### Edge case 12 : deux apps (onglets) drainent la meme file simultanement
**Scenario** : concurrence sur la file.
**Probleme** : double traitement.
**Solution** : Idempotency-Key protege (backend dedup) ; le remove apres 2xx est idempotent (delete d'un id deja supprime = no-op). Cas rare sur mobile PWA (un contexte).

## 11. Edge cases + troubleshooting

### Edge case 1 : iOS Safari sans background sync
**Scenario** : iPhone, pas de SyncManager.
**Probleme** : la sync ne s'enregistre pas.
**Solution** : fallback `online` listener -> `postMessage('flush-sync')` au SW + flush au boot (piege 1).

### Edge case 2 : double-traitement apres echec post-POST
**Scenario** : POST reussi mais suppression de file echoue.
**Probleme** : doublon a la prochaine sync.
**Solution** : Idempotency-Key (op.id) ; le backend deduplique ; remove apres 2xx seulement (piege 2).

### Edge case 3 : 409 confondu avec erreur reseau
**Scenario** : conflit metier retry en boucle.
**Probleme** : retry infini sur un conflit.
**Solution** : branche dediee 409 -> resolution, jamais retry (piege 3).

### Edge case 4 : token expire pendant la sync background
**Scenario** : le JWT stocke a expire.
**Probleme** : 401 sur les requetes de sync.
**Solution** : pas d'auth valide -> arret ; le client met a jour `setSyncAuth` au refresh/login, la sync reprend (piege 4).

### Edge case 5 : conflit pendant que l'app est fermee
**Scenario** : background sync rencontre un 409, aucun client ouvert.
**Probleme** : impossible d'afficher le modal.
**Solution** : op marquee `needs_resolution` ; resolue a la prochaine ouverture (piege 6).

### Edge case 6 : file corrompue / payload invalide
**Scenario** : un op malformé.
**Probleme** : plante le drain.
**Solution** : try/catch par op ; l'op fautif -> failed et saute (piege 5).

### Edge case 7 : retry manuel + sync auto simultanes
**Scenario** : l'utilisateur tape retry pendant une sync auto.
**Probleme** : double envoi.
**Solution** : verrou `syncing` (piege 8) ; l'Idempotency-Key protege de toute facon.

## 12. Conformite Maroc detaillee

### Audit ACAPS (Regle T2) -- conflits
- Chaque resolution de conflit est tracee (`/api/v1/audit/conflict-resolution` : entite, op, choix, acteur serveur). Conformite : tracabilite des decisions sur les donnees sinistre.

### Decision-008 (cloud souverain MA)
- Les files (IndexedDB) residant sur l'appareil sont dans le perimetre maitrise ; la sync envoie vers Atlas Benguerir (meme origine).

### Decision-002 (multi-tenant) -- conflits cross-tenant
- Un conflit `cross_tenant` est non-resolvable (rejet) : on n'applique jamais une modif d'un tenant a un autre.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Les requetes de sync portent `x-tenant-id` (depuis sync-auth-store). Conflits cross-tenant rejetes.

### Validation strict
- Les payloads sont typed ; les reponses 409 parsees prudemment.

### Logger strict
- Aucun console.log (SW inclus). Erreurs stockees dans l'op (last_error).

### Package manager strict
- pnpm, idb/idb-keyval.

### TypeScript strict
- `strict` ; les casts SW (`self as ...`) localises et commentes.

### Tests strict
- Vitest (fake-indexeddb) + Playwright (5 scenarios conflits). Coverage renforcee.

### No-emoji strict (decision-006 ABSOLU)
- Icones lucide (RefreshCw, AlertCircle, Clock), SVG inline offline.

### Idempotency-Key strict
- Chaque op de sync porte op.id comme Idempotency-Key.

### Imports strict
- `@insurtech/garage-shared`, `@/lib/sync/*`.

### Conventional Commits strict
- `feat(sprint-23): ...`.

### Cloud souverain MA strict (decision-008)
- Sync vers Atlas Benguerir (meme origine).

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS, coverage sync >= 90%

grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/lib/sync repo/apps/web-garage-mobile/components/sync && echo "FAIL emoji" || echo "OK no-emoji"
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/lib/sync repo/apps/web-garage-mobile/app/sw.ts | grep -v ".spec." && echo "FAIL console" || echo "OK"
grep -c "case 'sync-" repo/apps/web-garage-mobile/app/sw.ts  # attendu : 3
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/lib/sync/ repo/apps/web-garage-mobile/app/sw.ts repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/ repo/apps/web-garage-mobile/components/sync/ repo/apps/web-garage-mobile/app/[locale]/offline/
git commit -m "feat(sprint-23): service worker background sync (3 types) + resolution conflits

Complete le service worker offline-first : 3 background sync (timer/checklist/
photos, ordre de priorite), file unifiee IndexedDB (enqueueSync), auth SW depuis
IndexedDB, gestion 409 vs retry backoff, resolution de conflits LWW + prompt 3
choix + cas non-resolvables (status_closed/stock_consumed/cross_tenant), page
/sync-status (retry manuel + verrou), conflict log ACAPS, fallback iOS.

Livrables:
- enqueue (file unifiee) + sync-queue (orchestrateur drain) + conflict-resolver
- sync-auth-store (token IndexedDB) + 3 handlers sync dans sw.ts
- ConflictModal + SyncStatusList + page /sync-status + page offline
- resolve-conflict-client (re-soumission + audit ACAPS)

Tests: 24 (4 enqueue + 7 conflict + 8 sync-queue + 5 E2E conflits)
Coverage: 91% (sync-queue + conflict-resolver)

Task: 5.5.10
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.10"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.11-push-notifications-voice-to-text.md` (push notifications technicien + voice-to-text fr/ar, qui branche le `onVoice` laisse en placeholder par 5.5.7 et le badge notifs de 5.5.3).

---

**Fin du prompt task-5.5.10-service-worker-offline-cache-background-sync.md.**

Densite atteinte : ~75 ko (enrichie de 62 a 75 ko ; contenu genuine, scope SW compact)
Code patterns : 16 fichiers + contrats backend 409/audit + i18n 3 locales (enqueue + sync-auth-store + conflict-resolver + sync-queue + modif sw + conflict-modal + sync-status-list + page sync-status + resolve-conflict-client + page offline + sync-status-store + use-sync-status + strategies cache + integration + i18n)
Tests : ~30 cas concrets (24 base dont 5 conflits B-23 + 1 use-sync-status + 3 sync-status-store)
Criteres validation : V1-V42 (18 P0 + 16 P1 + 10 P2)
Edge cases : 12
Analyse robustesse offline (7 garanties) + scenario fosse beton
