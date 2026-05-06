# META-PROMPT B-23 -- SPRINT 23 WEB GARAGE MOBILE PWA (TECHNICIEN)

**Version** : v2.2 (Option B)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 23 / 35 (cumul) -- Phase 5 Sprint 5
**Position** : Apres Web Garage App, avant Flux Sinistre Client
**Numerotation taches** : 5.5.1 a 5.5.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (PWA technicien critique pour productivite garage on-the-floor)

---

## Objectif Global du Sprint

Construire **web-garage-mobile** (port 3003) -- PWA installable pour technicien garage : focus mobile-first sur use cases atelier (prise photos sinistre + log hours rapide + accept work + quick status updates). Pattern PWA Sprint 18 reutilise (manifest + service worker + push + offline). Productivite atelier prioritaire : 1-2 taps pour actions frequentes.

Use case : technicien arrive matin, ouvre PWA installee sur son smartphone, voit ses orders du jour, prend photos, log hours en temps reel, marque taches completees -- meme si connexion intermittente atelier.

A la sortie de ce sprint :
- web-garage-mobile PWA installable (port 3003 dev / `garage-mobile.skalean-insurtech.ma` prod)
- Auth simplifiee : pin code 6 chiffres OR biometric (post-login initial)
- Pages technicien-focused : Mes orders du jour + Detail order + Reception (camera) + Diagnostic photos + Hours timer + Quick QC checklist
- Camera direct integration (photos arrivee/diagnostic/QC)
- Hours timer real-time avec auto-pause si inactif > 5min
- Offline support : log hours + photos staged + sync quand online
- Bottom nav 5 tabs : Aujourd'hui / Mes orders / Camera / Notifications / Profil
- Push notifications : nouveau sinistre assigne + parts arrived
- Voice-to-text optionnel (Web Speech API) pour notes
- Tests Playwright mobile viewport + Lighthouse PWA 100

---

## Frontiere du Sprint

**INCLUS** :
- App PWA installable
- Auth simplifiee technicien (pin/biometric)
- 7 pages mobile-focused
- Camera integration native
- Hours timer + offline tracking
- Service worker + cache + background sync
- Push notifications
- Voice-to-text optional
- Tests E2E mobile

**EXCLU** (sera ajoute aux sprints suivants) :
- Pages garage_admin / garage_gestionnaire (utilisent web-garage Sprint 22 desktop)
- Reports + analytics (desktop only)
- AR/VR diagnostic visualisation -- Phase 7+
- Apps natives iOS/Android -- post-MVP

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 18 : pattern PWA Serwist + manifest + service worker
2. Sortie Sprint 22 : web-garage desktop endpoints utilises
3. Sortie Sprint 19-21 : backend Repair workflow

---

## Stack Imposee (Sprint 23)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router |
| @serwist/next | 9.x | service worker PWA (reuse Sprint 18) |
| web-push | 3.6.x | push notifications |
| @hookform/resolvers + react-hook-form | wizard mobile |
| zod | 3.24.1 | validation |

Pas de nouvelle dep majeure -- reuse stack Sprint 18.

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 5.5.1 | App skeleton PWA + manifest + service worker (reuse `shared-pwa` Sprint 4 + pattern Sprint 18) | 5h | P0 | Sprint 22 |
| 5.5.2 | Auth simplifiee : pin code 6 chiffres + biometric WebAuthn | 6h | P0 | 5.5.1 |
| 5.5.3 | Layout mobile : bottom nav 5 tabs + topbar compact + FAB | 4h | P0 | 5.5.2 |
| 5.5.4 | Page "Aujourd'hui" : orders du jour + agenda + alerts | 5h | P0 | 5.5.3 |
| 5.5.5 | Page detail order mobile : actions rapides + photos + hours | 7h | P0 | 5.5.4 |
| 5.5.6 | Reception mobile : camera direct + checklist 12 points + signature | 7h | P0 | 5.5.5 |
| 5.5.7 | Diagnostic photos mobile : camera burst + IA suggestions display | 5h | P0 | 5.5.6 |
| 5.5.8 | Hours timer real-time : start/stop/auto-pause + offline log | 6h | P0 | 5.5.7 |
| 5.5.9 | Quick QC checklist mobile + signature pad | 5h | P0 | 5.5.8 |
| 5.5.10 | Service worker offline cache + background sync hours/photos | 6h | P0 | 5.5.9 |
| 5.5.11 | Push notifications + voice-to-text optional | 4h | P0 | 5.5.10 |
| 5.5.12 | Tests Playwright mobile + Lighthouse PWA 100 + WCAG | 8h | P0 | 5.5.11 |

**Total** : 68 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 5.5.1 -- App Skeleton PWA Reuse Sprint 18 Pattern

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 5h / Depend de Sprint 22

**But** : Initialiser app `web-garage-mobile` reutilisant pattern PWA Sprint 18 (Serwist + manifest + service worker + push).

**Livrables checkables** :
- [ ] Folder `repo/apps/web-garage-mobile/`
- [ ] Setup Next.js 15 + Serwist (reuse config Sprint 18)
- [ ] `manifest.json` :
  - `name: "Skalean Atelier Tech"`
  - `short_name: "Atelier"`
  - `theme_color: #1A2730` (Sofidemy navy)
  - `display: 'standalone'`
  - Icons sizes (512/192/180)
  - Shortcuts : "Mes orders", "Camera reception"
- [ ] Service worker `app/sw.ts` reuse pattern Sprint 18 + hooks `@insurtech/shared-pwa` (Sprint 4 Tache 1.4.9) + custom : runtime cache backend API + offline pages
- [ ] Package partage `@insurtech/garage-shared` :
  - Components reutilises desktop + mobile (cards, badges, status displays)
  - API client wrapper
  - Types
- [ ] Variables env : `NEXT_PUBLIC_VAPID_KEY`, `NEXT_PUBLIC_API_BASE_URL`
- [ ] Tests : app demarre + manifest valid + sw registered + Lighthouse PWA score baseline

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/                                                       # full Next.js 15 PWA
repo/apps/web-garage-mobile/public/manifest.json
repo/apps/web-garage-mobile/app/sw.ts                                               # reuse Sprint 18 + customize
repo/apps/web-garage-mobile/serwist.config.ts
repo/packages/garage-shared/                                                        # shared package web-garage + mobile
repo/packages/garage-shared/src/components/{several}.tsx                            # ~400 lignes
repo/packages/garage-shared/src/api/client.ts                                       # ~100 lignes
```

**Notes implementation** :
- Reuse 80% pattern Sprint 18 (web-assure-mobile)
- Adaptations garage : sidebar admin different mobile UX
- Pre-fetch critical pages au boot pour offline immediate

**Criteres validation** :
- V1 (P0) : App demarre port 3003
- V2 (P0) : Manifest installable
- V3 (P0) : Service worker registered
- V4 (P0) : Package shared utilisable
- V5 (P0) : Tests setup 5+ scenarios

---

## Tache 5.5.2 -- Auth Simplifiee : Pin + Biometric

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 6h / Depend de 5.5.1

**But** : Auth simplifiee technicien : login initial classique (email + password Sprint 5), puis sessions ulterieures via pin 6 chiffres OR biometric (WebAuthn fingerprint/face).

**Contexte** : UX critique : technicien ouvre PWA frequemment dans atelier (mains sales, gants), saisie email/password trop laborieuse. Pin OU biometric = 1-2 secondes acces.

**Livrables checkables** :
- [ ] Backend extension Sprint 5 :
  - Endpoint `POST /api/v1/auth/setup-pin` : user authentifie set pin 6 chiffres -> stored hash bcrypt
  - Endpoint `POST /api/v1/auth/verify-pin` : email + pin -> JWT short-lived (4h)
  - Endpoint `POST /api/v1/auth/setup-biometric` : register WebAuthn credential
  - Endpoint `POST /api/v1/auth/verify-biometric` : verify WebAuthn assertion -> JWT
- [ ] Frontend pages :
  - `/login` : email + password (premiere fois OR si pin oublie)
  - `/setup-pin` : choisir pin 6 chiffres (post-login premiere fois)
  - `/setup-biometric` : prompt WebAuthn (optional skip)
  - `/quick-login` : reconnu user (cookie persistent) -> pin pad OU biometric -> JWT new
- [ ] Pin pad UI : numeric keypad 6 digits + auto-submit
- [ ] WebAuthn integration : `navigator.credentials.create()` + `.get()`
- [ ] Sessions persistence : refresh token longue duree (30j) + access token short (4h)
- [ ] Migration : table `auth_user_pins` (id, user_id, pin_hash, created_at, last_used_at) + table `auth_user_credentials` (WebAuthn)
- [ ] Tests : flows pin + biometric

**Pattern critique : WebAuthn biometric**

```typescript
// repo/apps/web-garage-mobile/lib/auth/biometric.ts
export async function setupBiometric(userId: string, displayName: string): Promise<{ success: boolean }> {
  // Get challenge from backend
  const challengeResponse = await fetch('/api/auth/biometric/challenge', { method: 'POST' });
  const { challenge, rp_id } = await challengeResponse.json();

  // Browser API : create credential
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: Uint8Array.from(challenge, c => c.charCodeAt(0)),
      rp: { name: 'Skalean Atelier', id: rp_id },
      user: {
        id: new TextEncoder().encode(userId),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',  // built-in (TouchID/FaceID/fingerprint)
        userVerification: 'required',
      },
      attestation: 'direct',
    },
  });

  if (!credential) throw new Error('Biometric setup failed');

  // Send to backend
  const response = await fetch('/api/auth/biometric/setup', {
    method: 'POST',
    body: JSON.stringify({ credential: credentialToJson(credential) }),
  });

  return { success: response.ok };
}

export async function verifyBiometric(): Promise<{ accessToken: string }> {
  const challengeResponse = await fetch('/api/auth/biometric/verify-challenge', { method: 'POST' });
  const { challenge, rp_id } = await challengeResponse.json();

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: Uint8Array.from(challenge, c => c.charCodeAt(0)),
      rpId: rp_id,
      userVerification: 'required',
    },
  });

  if (!assertion) throw new Error('Biometric verification failed');

  const response = await fetch('/api/auth/biometric/verify', {
    method: 'POST',
    body: JSON.stringify({ assertion: assertionToJson(assertion) }),
  });

  return await response.json();
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AuthUserPinsCredentials.ts             # ~50 lignes
repo/packages/auth/src/services/pin-auth.service.ts                                  # ~150 lignes
repo/packages/auth/src/services/biometric-auth.service.ts                            # ~250 lignes
repo/apps/api/src/modules/auth/controllers/quick-auth.controller.ts                  # ~150 lignes
repo/apps/web-garage-mobile/app/[locale]/(auth)/{4 pages}.tsx                         # ~600 lignes
repo/apps/web-garage-mobile/lib/auth/biometric.ts                                     # ~150 lignes
repo/apps/web-garage-mobile/lib/auth/pin.ts                                            # ~80 lignes
repo/apps/web-garage-mobile/components/auth/pin-pad.tsx                                # ~150 lignes
```

**Notes implementation** :
- WebAuthn : `authenticatorAttachment: 'platform'` -> built-in biometric (TouchID/Face ID/fingerprint)
- Pin storage : bcrypt cost 10 (rapide validation, secure)
- Pin si oublie : fallback login email + password (rate-limited Sprint 5)
- iOS Safari + Android Chrome support WebAuthn (large coverage)

**Criteres validation** :
- V1 (P0) : Setup pin OK
- V2 (P0) : Verify pin -> JWT
- V3 (P0) : Setup biometric WebAuthn
- V4 (P0) : Verify biometric -> JWT
- V5 (P0) : Pin oublie fallback login email
- V6 (P0) : Tests 8+ scenarios

---

## Tache 5.5.3 -- Layout Mobile : Bottom Nav

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 4h / Depend de 5.5.2

**But** : Layout mobile-first : bottom nav 5 tabs + topbar compact + FAB.

**Livrables checkables** :
- [ ] Bottom nav 5 tabs :
  1. **Aujourd'hui** (home icon) -- agenda + orders du jour
  2. **Mes orders** (list icon) -- list active orders assignes
  3. **Camera** (camera icon, FAB-like central) -- quick photo capture
  4. **Notifications** (bell icon, badge counter) -- push received
  5. **Profil** (user icon) -- info + logout
- [ ] Topbar compact : back button context + page title + tenant badge
- [ ] FAB "Quick Action" : context-sensitive (selon page : "Take photo" / "Log hours" / "Mark complete")
- [ ] Pull-to-refresh
- [ ] Safe area insets (notch iPhone)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx                        # ~120 lignes
repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx                            # ~150 lignes
repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx                          # ~100 lignes
repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx                        # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : Bottom nav 5 tabs
- V2 (P0) : Topbar compact
- V3 (P0) : FAB context-sensitive
- V4 (P0) : Safe areas
- V5 (P0) : Tests 5+ scenarios

---

## Tache 5.5.4 -- Page "Aujourd'hui"

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 5h / Depend de 5.5.3

**But** : Page accueil "Aujourd'hui" -- landing matin technicien : agenda + orders du jour + alerts.

**Livrables checkables** :
- [ ] Page `/today` :
  - Header : Bonjour {name} + date jour
  - **Section Agenda** : RDV reception clients (Sprint 8 booking) du jour heure par heure
  - **Section Orders en cours** : list cards orders assignes lui (status + sinistre + vehicle + estimated_completion)
  - **Section Alerts** :
    - Parts arrivees aujourd'hui (Sprint 19 tracking)
    - QC echecs a re-check
    - Reminders : permis/formation expire
- [ ] Quick stats : hours_logged today / orders_completed_today / hours_remaining
- [ ] Tap card -> navigate detail order
- [ ] Pull-to-refresh data
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx                     # ~150 lignes
repo/apps/web-garage-mobile/components/today/{several sections}.tsx                       # ~400 lignes
```

**Criteres validation** :
- V1 (P0) : Sections complete
- V2 (P0) : Data quick fetch
- V3 (P0) : Tap navigation
- V4 (P0) : Pull-to-refresh
- V5 (P0) : Tests 5+ scenarios

---

## Tache 5.5.5 -- Page Detail Order Mobile

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 7h / Depend de 5.5.4

**But** : Page detail order optimisee mobile : actions rapides + photos + hours + tasks checklist.

**Livrables checkables** :
- [ ] Page `/orders/:id` :
  - Header : order_number + sinistre + vehicle (compact)
  - Section status visual : badge + completion %
  - Section Tasks : checklist (chaque tache : tap to mark completed)
  - Section Parts : list parts (status arrival visual)
  - Section Photos : grid + bouton "Add photo" -> camera
  - Section Hours : timer prominent + total today + history
  - Bouton "Mark complete" en bas (visible apres 100% tasks)
- [ ] Quick actions FAB :
  - Take photo
  - Start/Stop hours timer
  - Add note (voice-to-text option)
- [ ] Optimistic UI : tap mark task -> immediate feedback + sync
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx                 # ~250 lignes
repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx                       # ~300 lignes
repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx                     # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Page complete sections
- V2 (P0) : Tap task mark completed
- V3 (P0) : Quick actions FAB
- V4 (P0) : Optimistic UI
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.5.6 -- Reception Mobile : Camera Direct

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 7h / Depend de 5.5.5

**But** : Page reception optimisee mobile : camera direct + checklist 12 points compacte + signature reception customer.

**Livrables checkables** :
- [ ] Page `/sinistres/:id/reception` :
  - Step 1 : Take photos (camera direct + grid 8-12 angles)
  - Step 2 : Checklist 12 points (compact mobile UI : swipe through items)
  - Step 3 : Customer documents upload (CIN + permis + attestation)
  - Step 4 : Customer signature pad
  - Step 5 : Submit + transition sinistre 'under_diagnostic'
- [ ] Camera : `<input capture="environment">` + multi-photo accumulation
- [ ] Photos preview gallery + delete option avant submit
- [ ] Checklist 12 points UI : swipe slides per category (carrosserie/vitres/roues/interieur)
- [ ] Signature pad : html5 canvas + clear button + save
- [ ] Save draft local storage : si interruption, resume
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx     # ~200 lignes
repo/apps/web-garage-mobile/components/reception/mobile-camera-capture.tsx                   # ~250 lignes
repo/apps/web-garage-mobile/components/reception/checklist-mobile-swipe.tsx                   # ~200 lignes
repo/apps/web-garage-mobile/components/reception/signature-pad-mobile.tsx                      # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Camera direct multi-photo
- V2 (P0) : Checklist swipe UI
- V3 (P0) : Signature pad
- V4 (P0) : Save draft
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.5.7 -- Diagnostic Photos Mobile

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 5h / Depend de 5.5.6

**But** : Page diagnostic mobile : prise photos burst + voir IA suggestions Sprint 20 + ajouter notes/photos manuels.

**Livrables checkables** :
- [ ] Page `/sinistres/:id/diagnostic` :
  - Section "Mes photos" : grid + bouton add
  - Section "IA Suggestions" (auto-load apres photos uploaded) :
    - Confidence visual
    - Damages detected list
    - Parts needed
    - Tap card pour voir details
  - Section "Validation" :
    - Bouton "Accept all" (rapid)
    - Edit mode : modify damages + parts
    - "Reject" + manual diagnostic
  - Section "Notes" : textarea + voice-to-text optional
  - Bouton "Generate Report" (rapport technique PDF)
- [ ] Camera burst mode : prendre 3-5 photos rapidement (eviter bouger entre photos)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx    # ~200 lignes
repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx                          # ~150 lignes
repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx                  # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Camera burst photos
- V2 (P0) : IA suggestions display
- V3 (P0) : Validation actions
- V4 (P0) : Notes voice-to-text
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.5.8 -- Hours Timer Real-Time + Offline Log

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 6h / Depend de 5.5.7

**But** : Timer hours real-time critical pour productivite atelier : start/stop + auto-pause inactif + offline log + sync online.

**Livrables checkables** :
- [ ] Component `<HoursTimer>` :
  - Display HH:MM:SS counting up
  - Bouton Start/Stop
  - Auto-pause si app background OR inactive > 5min (configurable)
  - Resume confirmation prompt si pause longue
- [ ] Storage local : `localStorage.timer_state` { order_id, started_at, last_active_at, paused_at, total_seconds }
- [ ] Sync online : POST `/api/v1/repair/orders/:id/log-hours` quand online + clear local
- [ ] Background sync via service worker : si online apres offline, sync queue
- [ ] Page "Mon timer" : voir total today + history sessions today + edit manual entry possible
- [ ] Edge cases :
  - App close : preserve state (localStorage)
  - Multiple orders simultanes : 1 timer actif a la fois (UI prompt si tentative parallel)
  - Auto-pause si phone screen off
- [ ] Tests : timer accuracy + offline + sync

**Pattern critique : timer offline + background sync**

```typescript
// repo/apps/web-garage-mobile/lib/timer/hours-timer.ts
export class HoursTimer {
  private state: TimerState | null = null;
  private interval: number | null = null;

  start(orderId: string): void {
    if (this.state) {
      throw new Error('Timer already running. Stop current order first.');
    }
    this.state = {
      order_id: orderId,
      started_at: Date.now(),
      last_active_at: Date.now(),
      total_seconds: 0,
      synced: false,
    };
    this.persistState();
    this.startTicking();
  }

  stop(): { totalSeconds: number; orderId: string } {
    if (!this.state) throw new Error('No timer running');
    const result = { totalSeconds: this.state.total_seconds, orderId: this.state.order_id };

    // Try to sync online
    this.syncIfOnline(result);

    // Clear state
    this.state = null;
    localStorage.removeItem('timer_state');
    if (this.interval) clearInterval(this.interval);
    return result;
  }

  private startTicking(): void {
    this.interval = window.setInterval(() => {
      if (!this.state) return;

      const now = Date.now();
      const elapsed = (now - this.state.last_active_at) / 1000;

      // Auto-pause si inactif > 5min
      if (elapsed > 300) {
        this.pause('Auto-pause inactivity');
        return;
      }

      this.state.total_seconds += 1;
      this.state.last_active_at = now;
      this.persistState();
    }, 1000);
  }

  private async syncIfOnline(result: { totalSeconds: number; orderId: string }): Promise<void> {
    if (navigator.onLine) {
      try {
        await fetch(`/api/v1/repair/orders/${result.orderId}/log-hours`, {
          method: 'POST',
          body: JSON.stringify({ hours: result.totalSeconds / 3600 }),
        });
      } catch {
        // Queue for background sync
        await this.queueForSync(result);
      }
    } else {
      // Offline : queue for background sync
      await this.queueForSync(result);
    }
  }

  private async queueForSync(result: any): Promise<void> {
    // Use IndexedDB queue + service worker background sync
    const sw = await navigator.serviceWorker.ready;
    if ('sync' in sw) {
      await idb.add('timer_sync_queue', result);
      await (sw as any).sync.register('sync-timer-logs');
    }
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/lib/timer/hours-timer.ts                                    # ~250 lignes
repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts                                # ~150 lignes (IndexedDB)
repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx                          # ~150 lignes
repo/apps/web-garage-mobile/app/[locale]/(protected)/timer/page.tsx                       # ~120 lignes
repo/apps/web-garage-mobile/app/sw.ts                                                     # update : background sync handler
```

**Criteres validation** :
- V1 (P0) : Timer accuracy 1s
- V2 (P0) : Auto-pause 5min
- V3 (P0) : Persist localStorage
- V4 (P0) : Offline queue + sync online
- V5 (P0) : Background sync service worker
- V6 (P0) : Tests 10+ scenarios

---

## Tache 5.5.9 -- Quick QC Checklist Mobile

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 5h / Depend de 5.5.8

**But** : Page QC checklist 10 points mobile-friendly + photos after + signature inspector.

**Livrables checkables** :
- [ ] Page `/sinistres/:id/qc` :
  - Checklist 10 points : large tap targets (44px+) + radio "Pass/Fail/N/A"
  - Photos after : grid + camera direct
  - Inspector signature pad
  - Bouton "Mark Passed" / "Mark Failed" (avec items)
- [ ] Compact UI : 1 question per slide swipe (eviter scroll trop long)
- [ ] Save progressif : chaque point save server-side immediate
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx          # ~150 lignes
repo/apps/web-garage-mobile/components/qc/qc-mobile-swipe.tsx                              # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 10 points checklist swipe
- V2 (P0) : Photos after
- V3 (P0) : Signature pad
- V4 (P0) : Save progressif
- V5 (P0) : Tests 5+ scenarios

---

## Tache 5.5.10 -- Service Worker Offline Cache + Background Sync

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 6h / Depend de 5.5.9

**But** : Service worker complete : offline cache strategies + background sync hours timer + photos staged.

**Livrables checkables** :
- [ ] Cache strategies (Serwist + custom) :
  - **Static assets** : Cache First
  - **API GET requests** : Network First fallback Cache (orders du jour visibles offline)
  - **API POST/PUT/PATCH** : Background Sync queue (offline)
- [ ] Background sync registrations :
  - `sync-timer-logs` (Tache 5.5.8 hours)
  - `sync-photos-uploads` (photos pending S3)
  - `sync-checklist-updates` (QC + reception)
- [ ] Offline page custom : "Vous etes hors ligne. Vos data seront synchronisees au retour internet."
- [ ] Sync queue UI : page `/sync-status` avec list pending items
- [ ] Manual retry button per item
- [ ] **Conflict resolution strategy detaille (Last-Write-Wins + user prompt)** :
  - Strategy default : **Last-Write-Wins** avec timestamp serveur (server authoritative)
  - Detection conflict : sync POST/PUT retourne 409 Conflict si `version` field changes detected (optimistic locking via `updated_at` timestamp comparison)
  - User prompt si conflit detecte : modal "Cette tache a ete modifiee par X (chef garage) il y a 5min. Vos modifications offline : [diff]. Que voulez-vous faire ?" avec 3 boutons : `Garder mes changements (overwrite serveur)` / `Garder version serveur (annule mes modifs offline)` / `Merge manuel (champ-par-champ)`
  - Cas particuliers conflit non-resolvables :
    - Sinistre status changed cross-tenant (e.g. closed cote chef garage) -> reject offline change + notify technicien
    - Stock part deja consume (count discrepancy) -> retry with adjusted quantity OR escalate to chef
  - Conflict log : `audit_log` table track resolution choices (compliance ACAPS)
  - Tests E2E conflicts : 5+ scenarios (timer concurrent / photos overwrite / status race condition / stock count discrepancy / order completed both sides)
- [ ] Tests offline complete

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/app/sw.ts                                                     # update : 3 sync types
repo/apps/web-garage-mobile/lib/sync/sync-queue.ts                                          # ~250 lignes (IndexedDB orchestrator)
repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx                  # ~150 lignes
repo/apps/web-garage-mobile/app/[locale]/offline/page.tsx                                    # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Cache static + API
- V2 (P0) : 3 background sync types
- V3 (P0) : Offline page
- V4 (P0) : Sync queue UI
- V5 (P0) : Conflict resolution
- V6 (P0) : Tests offline 8+ scenarios

---

## Tache 5.5.11 -- Push Notifications + Voice-to-Text

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 4h / Depend de 5.5.10

**But** : Push notifications technicien (nouveau order assigne + parts arrived + critical updates) + voice-to-text optional pour notes.

**Livrables checkables** :
- [ ] Push subscription PWA (reuse Sprint 18 pattern)
- [ ] Backend events trigger push :
  - Nouveau order assigne au technicien
  - Parts arrived (Sprint 19 tracking)
  - QC failed -> re-work
  - Sinistre priority change to urgent
- [ ] Voice-to-text : Web Speech API integration optional
  - Notes saisie dans diagnostic + orders
  - Languages supportes : fr-MA + ar
  - Fallback typing keyboard si Web Speech non-supporte (iOS Safari avant iOS 14.5)
- [ ] Toggle settings : enable voice-to-text per user
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts                                     # ~150 lignes
repo/apps/web-garage-mobile/components/voice/voice-input.tsx                                # ~120 lignes
repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx                         # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Push subscription
- V2 (P0) : 4 event types push
- V3 (P0) : Voice-to-text fr/ar
- V4 (P0) : Fallback if not supported
- V5 (P0) : Tests 5+ scenarios

---

## Tache 5.5.12 -- Tests Playwright Mobile + Lighthouse PWA

**Metadonnees** : Phase 5 / Sprint 23 / P0 / 8h / Depend de 5.5.11

**But** : Suite tests Playwright + viewports mobile + Lighthouse PWA 100 + accessibility.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] Auth pin + biometric (4)
- [ ] Today + orders mobile views (3)
- [ ] Order detail + actions rapides (2)
- [ ] Reception camera + checklist + signature (2)
- [ ] Diagnostic photos + IA + validation (2)
- [ ] Hours timer offline + sync (2)
- [ ] Push notifications subscription (1)

**Lighthouse PWA audit** :
- [ ] PWA = 100
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] Best Practices > 95

**Mobile viewports tests** :
- [ ] iPhone SE (375x667), iPhone 14 (390x844)
- [ ] Pixel 7 (412x915)
- [ ] Galaxy S22 (360x780)

**Fichiers crees / modifies** :
```
repo/apps/web-garage-mobile/e2e/{15+ specs}.spec.ts
repo/apps/web-garage-mobile/playwright.config.ts                                            # mobile viewports
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : Lighthouse PWA 100
- V3 (P0) : Mobile viewports OK
- V4 (P0) : CI green
- V5 (P0) : Reproducibility 5x

---

## Sortie du Sprint 23

A la fin de l'execution des 12 taches :

```
Web Garage Mobile PWA operational :
  - PWA installable port 3003
  - Auth pin code 6 chiffres + biometric WebAuthn (UX rapide atelier)
  - 7 pages mobile-focused : today + orders + camera + reception + diagnostic + qc + timer
  - Bottom nav 5 tabs + topbar compact + FAB context-sensitive
  - Camera direct integration (multi-photo)
  - Hours timer real-time + auto-pause + offline log + background sync
  - Service worker 3 sync types (timer + photos + checklist)
  - Push notifications technicien (nouveau order + parts arrived + QC failed)
  - Voice-to-text optional fr/ar
  - 15+ tests Playwright mobile + Lighthouse PWA 100

Productivite technicien atelier maximisee : 1-2 taps actions frequentes
```

**Sprint 24 (Flux Sinistre Client end-to-end) demarre avec** :
- Backend Repair complet (Sprints 19-21)
- Web-garage desktop (Sprint 22) + Web-garage-mobile PWA (Sprint 23)
- Web-assure-mobile (Sprint 18)
- Sprint 24 : flux M8 complet (declaration -> choix garage -> appointment -> reparation -> livraison) end-to-end

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-5.5.X-*.md` dans `00-pilotage/prompts-taches/sprint-23-web-garage-mobile/`.

**Patterns code inline conserves** : WebAuthn biometric setup + verify, hours timer offline + background sync IndexedDB queue.

**Reference** : Sprint 18 pattern PWA reutilise + Sprint 22 endpoints backend.

---

**Fin du meta-prompt B-23 v2.2 format Option B.**
