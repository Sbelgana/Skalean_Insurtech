# ORCHESTRATEUR SPRINT 23 -- Phase 5 / Sprint 5 : Web Garage Mobile PWA + WebAuthn
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 23 / 35 (cumul) -- Sprint 5 dans Phase 5
**Reference meta-prompt** : `B-23-sprint-23-web-garage-mobile.md`
**Reference verification** : `V-23-sprint-23-verification.md`
**Numerotation taches** : 5.5.1 a 5.5.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : web-garage-mobile PWA + WebAuthn biometric

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 23 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-23** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-23 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 23

Sprint 23 (5.5) -- Web Garage Mobile PWA + WebAuthn. Voir B-23-sprint-23-web-garage-mobile.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/
  task-5.5.1-prompt.md       # App Skeleton PWA Reuse Sprint 18 Pattern
  task-5.5.2-prompt.md       # Auth Simplifiee : Pin + Biometric
  task-5.5.3-prompt.md       # Layout Mobile : Bottom Nav
  task-5.5.4-prompt.md       # Page "Aujourd'hui"
  task-5.5.5-prompt.md       # Page Detail Order Mobile
  task-5.5.6-prompt.md       # Reception Mobile : Camera Direct
  task-5.5.7-prompt.md       # Diagnostic Photos Mobile
  task-5.5.8-prompt.md       # Hours Timer Real-Time + Offline Log
  task-5.5.9-prompt.md       # Quick QC Checklist Mobile
  task-5.5.10-prompt.md       # Service Worker Offline Cache + Background Sync
  task-5.5.11-prompt.md       # Push Notifications + Voice-to-Text
  task-5.5.12-prompt.md       # Tests Playwright Mobile + Lighthouse PWA
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-23-sprint-23-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/001-010-*.md`

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run` -- tous tests PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Commit** Conventional Commits (`git add -A && git commit`)
7. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : les taches ont des **dependances** entre elles. La tache N peut importer du code cree par la tache N-1. Executer en parallele creerait des conflits irreconciliables.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier -- continue les taches restantes
4. La verification finale V-23 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-23-sprint-23-verification.md
```
Puis tu **executes CHAQUE section** du fichier de verification (commandes bash + checks automatiques).

---

## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)

### Conventions techniques

- **Multi-tenant** : CHAQUE query DB filtre par `tenant_id` automatique (Subscriber + RLS) + header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*`
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka sur `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a un fichier `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, **AUCUN `any` implicite**, `noUncheckedIndexedAccess: true`
- **Hash password** : argon2id (JAMAIS bcrypt, JAMAIS scrypt)
- **JWT** : RS256 + key rotation 90 jours
- **Encryption at rest** : AES-256-GCM (Atlas Cloud Services KMS)
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages
- **Skalean AI** : utilise UNIQUEMENT via `@insurtech/sky` ou MCP client (JAMAIS de duplication LLM/RAG/vector store)
- **AUCUNE EMOJI** dans le code, commentaires ou logs (decision-006 ABSOLUE)
- **Idempotency-Key** : header obligatoire pour mutations + tools MCP write
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite InsurTech Maroc (9 lois MA)

- **Audit ACAPS** : chaque ecriture sur `insure_*`, `repair_*`, `pay_*` declenche entree dans `compliance_acaps_audits` (10 ans retention)
- **Donnees Maroc** (loi 09-08 CNDP) : aucune donnee assure/police/sinistre/paiement ne transite hors **Atlas Cloud Services Benguerir** (decision-008 -- DC1 Tier III + DC2 Tier IV)
- **Multilinguisme** : toute communication assure (notifications/emails/WhatsApp/Sky) supporte fr/ar-MA (darija)/ar (classique)/en
- **Conformite loi 43-20** : signatures electroniques utilisent uniquement `@insurtech/signature` (Barid eSign + ANRT TSA RFC 3161 + archivage 10 ans)
- **Conformite loi 17-99 article 9** : droit retract 30j B2C tracable (Sprint 15 cancellation_legal_basis)
- **Conformite loi 9-88** : ecritures comptables CGNC plan + SAFT-MA export DGI
- **Conformite loi 43-05** : AML monitoring + SAR generation AMC
- **TVA MA** : 5 taux (0/7/10/14/20%) -- Sprint 12
- **CNSS** : 4.48% + **AMO** : 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- **Notification breach** : sous 72h CNDP + Atlas Cloud Services SOC

---

## CONTEXTE PHASE 5 -- Vertical Repair (Skalean Garage ERP)

### Position du Sprint 5 dans la Phase 5

Sprint 23 (5.5) -- **Web Garage Mobile PWA + WebAuthn**.

Voir `B-23-sprint-23-web-garage-mobile.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

web-garage-mobile PWA + WebAuthn biometric

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-23 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-23, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-23.

---

### Tache 1 / 12 : App Skeleton PWA Reuse Sprint 18 Pattern

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 22

**But** : Initialiser app `web-garage-mobile` reutilisant pattern PWA Sprint 18 (Serwist + manifest + service worker + push).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.1-prompt.md
```

**Actions principales attendues** :
- Folder `repo/apps/web-garage-mobile/`
- Setup Next.js 15 + Serwist (reuse config Sprint 18)
- `manifest.json` :
- Service worker `app/sw.ts` reuse pattern Sprint 18 + hooks `@insurtech/shared-pwa` (Sprint 4 Tache 1.4.9) + custom : runtime cache backend API + offline pages
- Package partage `@insurtech/garage-shared` :
- Variables env : `NEXT_PUBLIC_VAPID_KEY`, `NEXT_PUBLIC_API_BASE_URL`

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/`
  - `repo/apps/web-garage-mobile/public/manifest.json`
  - `repo/apps/web-garage-mobile/app/sw.ts`
  - `repo/apps/web-garage-mobile/serwist.config.ts`
  - `repo/packages/garage-shared/`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : App demarre port 3003
  - V2 (P0) : Manifest installable
  - V3 (P0) : Service worker registered

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): app skeleton pwa reuse sprint 18 pattern

Task: 5.5.1
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.1"
```

---

### Tache 2 / 12 : Auth Simplifiee : Pin + Biometric

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.5.1

**But** : Auth simplifiee technicien : login initial classique (email + password Sprint 5), puis sessions ulterieures via pin 6 chiffres OR biometric (WebAuthn fingerprint/face).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.2-prompt.md
```

**Actions principales attendues** :
- Backend extension Sprint 5 :
- Frontend pages :
- Pin pad UI : numeric keypad 6 digits + auto-submit
- WebAuthn integration : `navigator.credentials.create()` + `.get()`
- Sessions persistence : refresh token longue duree (30j) + access token short (4h)
- Migration : table `auth_user_pins` (id, user_id, pin_hash, created_at, last_used_at) + table `auth_user_credentials` (WebAuthn)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AuthUserPinsCredentials.ts`
  - `repo/packages/auth/src/services/pin-auth.service.ts`
  - `repo/packages/auth/src/services/biometric-auth.service.ts`
  - `repo/apps/api/src/modules/auth/controllers/quick-auth.controller.ts`
  - `repo/apps/web-garage-mobile/app/[locale]/(auth)/{4 pages}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Setup pin OK
  - V2 (P0) : Verify pin -> JWT
  - V3 (P0) : Setup biometric WebAuthn

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): auth simplifiee : pin + biometric

Task: 5.5.2
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.2"
```

---

### Tache 3 / 12 : Layout Mobile : Bottom Nav

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.5.2

**But** : Layout mobile-first : bottom nav 5 tabs + topbar compact + FAB.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.3-prompt.md
```

**Actions principales attendues** :
- Bottom nav 5 tabs :
- Topbar compact : back button context + page title + tenant badge
- FAB "Quick Action" : context-sensitive (selon page : "Take photo" / "Log hours" / "Mark complete")
- Pull-to-refresh
- Safe area insets (notch iPhone)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx`
  - `repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx`
  - `repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx`
  - `repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Bottom nav 5 tabs
  - V2 (P0) : Topbar compact
  - V3 (P0) : FAB context-sensitive

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): layout mobile : bottom nav

Task: 5.5.3
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.3"
```

---

### Tache 4 / 12 : Page "Aujourd'hui"

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.5.3

**But** : Page accueil "Aujourd'hui" -- landing matin technicien : agenda + orders du jour + alerts.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.4-prompt.md
```

**Actions principales attendues** :
- Page `/today` :
- Quick stats : hours_logged today / orders_completed_today / hours_remaining
- Tap card -> navigate detail order
- Pull-to-refresh data
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/today/page.tsx`
  - `repo/apps/web-garage-mobile/components/today/{several sections}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Sections complete
  - V2 (P0) : Data quick fetch
  - V3 (P0) : Tap navigation

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): page aujourd'hui

Task: 5.5.4
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.4"
```

---

### Tache 5 / 12 : Page Detail Order Mobile

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.5.4

**But** : Page detail order optimisee mobile : actions rapides + photos + hours + tasks checklist.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.5-prompt.md
```

**Actions principales attendues** :
- Page `/orders/:id` :
- Quick actions FAB :
- Optimistic UI : tap mark task -> immediate feedback + sync
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/orders/[id]/page.tsx`
  - `repo/apps/web-garage-mobile/components/orders/order-mobile-detail.tsx`
  - `repo/apps/web-garage-mobile/components/orders/tasks-mobile-checklist.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Page complete sections
  - V2 (P0) : Tap task mark completed
  - V3 (P0) : Quick actions FAB

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): page detail order mobile

Task: 5.5.5
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.5"
```

---

### Tache 6 / 12 : Reception Mobile : Camera Direct

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.5.5

**But** : Page reception optimisee mobile : camera direct + checklist 12 points compacte + signature reception customer.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.6-prompt.md
```

**Actions principales attendues** :
- Page `/sinistres/:id/reception` :
- Camera : `<input capture="environment">` + multi-photo accumulation
- Photos preview gallery + delete option avant submit
- Checklist 12 points UI : swipe slides per category (carrosserie/vitres/roues/interieur)
- Signature pad : html5 canvas + clear button + save
- Save draft local storage : si interruption, resume

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx`
  - `repo/apps/web-garage-mobile/components/reception/mobile-camera-capture.tsx`
  - `repo/apps/web-garage-mobile/components/reception/checklist-mobile-swipe.tsx`
  - `repo/apps/web-garage-mobile/components/reception/signature-pad-mobile.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Camera direct multi-photo
  - V2 (P0) : Checklist swipe UI
  - V3 (P0) : Signature pad

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): reception mobile : camera direct

Task: 5.5.6
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.6"
```

---

### Tache 7 / 12 : Diagnostic Photos Mobile

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.5.6

**But** : Page diagnostic mobile : prise photos burst + voir IA suggestions Sprint 20 + ajouter notes/photos manuels.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.7-prompt.md
```

**Actions principales attendues** :
- Page `/sinistres/:id/diagnostic` :
- Camera burst mode : prendre 3-5 photos rapidement (eviter bouger entre photos)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx`
  - `repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx`
  - `repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Camera burst photos
  - V2 (P0) : IA suggestions display
  - V3 (P0) : Validation actions

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): diagnostic photos mobile

Task: 5.5.7
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.7"
```

---

### Tache 8 / 12 : Hours Timer Real-Time + Offline Log

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.5.7

**But** : Timer hours real-time critical pour productivite atelier : start/stop + auto-pause inactif + offline log + sync online.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.8-prompt.md
```

**Actions principales attendues** :
- Component `<HoursTimer>` :
- Storage local : `localStorage.timer_state` { order_id, started_at, last_active_at, paused_at, total_seconds }
- Sync online : POST `/api/v1/repair/orders/:id/log-hours` quand online + clear local
- Background sync via service worker : si online apres offline, sync queue
- Page "Mon timer" : voir total today + history sessions today + edit manual entry possible
- Edge cases :

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/lib/timer/hours-timer.ts`
  - `repo/apps/web-garage-mobile/lib/timer/timer-sync-queue.ts`
  - `repo/apps/web-garage-mobile/components/timer/hours-timer-ui.tsx`
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/timer/page.tsx`
  - `repo/apps/web-garage-mobile/app/sw.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Timer accuracy 1s
  - V2 (P0) : Auto-pause 5min
  - V3 (P0) : Persist localStorage

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): hours timer real-time + offline log

Task: 5.5.8
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.8"
```

---

### Tache 9 / 12 : Quick QC Checklist Mobile

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.5.8

**But** : Page QC checklist 10 points mobile-friendly + photos after + signature inspector.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.9-prompt.md
```

**Actions principales attendues** :
- Page `/sinistres/:id/qc` :
- Compact UI : 1 question per slide swipe (eviter scroll trop long)
- Save progressif : chaque point save server-side immediate
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx`
  - `repo/apps/web-garage-mobile/components/qc/qc-mobile-swipe.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 10 points checklist swipe
  - V2 (P0) : Photos after
  - V3 (P0) : Signature pad

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): quick qc checklist mobile

Task: 5.5.9
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.9"
```

---

### Tache 10 / 12 : Service Worker Offline Cache + Background Sync

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.5.9

**But** : Service worker complete : offline cache strategies + background sync hours timer + photos staged.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.10-prompt.md
```

**Actions principales attendues** :
- Cache strategies (Serwist + custom) :
- Background sync registrations :
- Offline page custom : "Vous etes hors ligne. Vos data seront synchronisees au retour internet."
- Sync queue UI : page `/sync-status` avec list pending items
- Manual retry button per item
- **Conflict resolution strategy detaille (Last-Write-Wins + user prompt)** :

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/app/sw.ts`
  - `repo/apps/web-garage-mobile/lib/sync/sync-queue.ts`
  - `repo/apps/web-garage-mobile/app/[locale]/(protected)/sync-status/page.tsx`
  - `repo/apps/web-garage-mobile/app/[locale]/offline/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cache static + API
  - V2 (P0) : 3 background sync types
  - V3 (P0) : Offline page

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): service worker offline cache + background sync

Task: 5.5.10
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.10"
```

---

### Tache 11 / 12 : Push Notifications + Voice-to-Text

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.5.10

**But** : Push notifications technicien (nouveau order assigne + parts arrived + critical updates) + voice-to-text optional pour notes.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.11-prompt.md
```

**Actions principales attendues** :
- Push subscription PWA (reuse Sprint 18 pattern)
- Backend events trigger push :
- Voice-to-text : Web Speech API integration optional
- Toggle settings : enable voice-to-text per user
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts`
  - `repo/apps/web-garage-mobile/components/voice/voice-input.tsx`
  - `repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Push subscription
  - V2 (P0) : 4 event types push
  - V3 (P0) : Voice-to-text fr/ar

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): push notifications + voice-to-text

Task: 5.5.11
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.11"
```

---

### Tache 12 / 12 : Tests Playwright Mobile + Lighthouse PWA

**Metadonnees** : P0 | 8h | Depend de : Depend de 5.5.11

**But** : Suite tests Playwright + viewports mobile + Lighthouse PWA 100 + accessibility.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-23-web-garage-mobile/task-5.5.12-prompt.md
```

**Actions principales attendues** :
- Auth pin + biometric (4)
- Today + orders mobile views (3)
- Order detail + actions rapides (2)
- Reception camera + checklist + signature (2)
- Diagnostic photos + IA + validation (2)
- Hours timer offline + sync (2)

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/e2e/{15+ specs}.spec.ts`
  - `repo/apps/web-garage-mobile/playwright.config.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : Lighthouse PWA 100
  - V3 (P0) : Mobile viewports OK

**Validation** :
```bash
cd repo
pnpm tsc --noEmit                    # Typecheck strict
pnpm vitest run --coverage           # Tests unitaires + coverage
pnpm lint                            # Biome lint + format check
cd ..
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-23): tests playwright mobile + lighthouse pwa

Task: 5.5.12
Sprint: 23 (Phase 5 / Sprint 5)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-23 Tache 5.5.12"
```

---


## VERIFICATION DU SPRINT 23

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-23-sprint-23-verification.md
```

Le fichier de verification V-23 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint23-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint23-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint23-verify-report.md
git commit -m "chore(sprint-23): close sprint 23 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 23 (Phase 5 / Sprint 5)
- Apport : web-garage-mobile PWA + WebAuthn biometric
- Tests E2E cumules : {N}+

Sprint 23 completed -- handoff to Sprint 24."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 23]
   |
   v
[Tache 5.5.1: App Skeleton PWA Reuse Sprint 18 Pattern]
   | -> compile -> tests -> commit
   v
[Tache 5.5.2: Auth Simplifiee : Pin + Biometric]
   | -> compile -> tests -> commit
   v
[Tache 5.5.3: Layout Mobile : Bottom Nav]
   | -> compile -> tests -> commit
   v
[Tache 5.5.4: Page "Aujourd'hui"]
   | -> compile -> tests -> commit
   v
[Tache 5.5.5: Page Detail Order Mobile]
   | -> compile -> tests -> commit
   v
[Tache 5.5.6: Reception Mobile : Camera Direct]
   | -> compile -> tests -> commit
   v
[Tache 5.5.7: Diagnostic Photos Mobile]
   | -> compile -> tests -> commit
   v
[Tache 5.5.8: Hours Timer Real-Time + Offline Log]
   | -> compile -> tests -> commit
   v
[Tache 5.5.9: Quick QC Checklist Mobile]
   | -> compile -> tests -> commit
   v
[Tache 5.5.10: Service Worker Offline Cache + Background Sync]
   | -> compile -> tests -> commit
   v
[Tache 5.5.11: Push Notifications + Voice-to-Text]
   | -> compile -> tests -> commit
   v
[Tache 5.5.12: Tests Playwright Mobile + Lighthouse PWA]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 23 -- V-23]
   |
   v
[Rapport sprint23-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : web-garage-mobile PWA + WebAuthn biometric.

**Prerequis Sprint 24** : Sprint 23 GO complet (score >= 95% verification automatique V-23).

**Sprint suivant** : Sprint 24.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 22 (verification GO)

```bash
# Verifier Sprint 22 GO
ls skalean-insurtech/sprint22-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint22-verify-report.md
```

### Lancement Sprint 23 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-23-sprint-23-web-garage-mobile.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-23-sprint-23-web-garage-mobile.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-23-sprint-23-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-23.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 23"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint23-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-23** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-23-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-23 v2.2 detaille -- Sprint 23 (5.5) Web Garage Mobile PWA + WebAuthn.**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : web-garage-mobile PWA + WebAuthn biometric
