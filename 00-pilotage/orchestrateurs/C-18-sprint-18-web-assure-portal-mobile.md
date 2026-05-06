# ORCHESTRATEUR SPRINT 18 -- Phase 4 / Sprint 5 : Web Assure Portal + Mobile PWA
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 18 / 35 (cumul) -- Sprint 5 dans Phase 4
**Reference meta-prompt** : `B-18-sprint-18-web-assure-portal-mobile.md`
**Reference verification** : `V-18-sprint-18-verification.md`
**Numerotation taches** : 4.5.1 a 4.5.14
**Effort total** : ~85 heures developpement / 2 semaines
**Apport metier** : web-assure-portal + web-assure-mobile PWA Lighthouse 100

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 18 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-18** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-18 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 18

Sprint 18 (4.5) -- Web Assure Portal + Mobile PWA. Voir B-18-sprint-18-web-assure-portal-mobile.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/
  task-4.5.1-prompt.md       # App Skeleton + PWA Setup
  task-4.5.2-prompt.md       # Auth Assure : OTP Login + Signup Auto-Link
  task-4.5.3-prompt.md       # Layout Assure : Header + Bottom Nav + Sidebar
  task-4.5.4-prompt.md       # Mes Polices Page : List + Detail
  task-4.5.5-prompt.md       # Premiums Echeancier + Paiement Reglement
  task-4.5.6-prompt.md       # Declarer Sinistre Etape 1 : Infos + Photos
  task-4.5.7-prompt.md       # Declarer Sinistre Etape 2 : Choix Garage M8
  task-4.5.8-prompt.md       # Declarer Sinistre Etape 3 : Appointment Booking + Confirmation
  task-4.5.9-prompt.md       # Mes Sinistres : List + Detail Timeline
  task-4.5.10-prompt.md       # Mes Documents + QR Scanner
  task-4.5.11-prompt.md       # Notifications Center + Push PWA
  task-4.5.12-prompt.md       # Service Worker + Offline Cache
  task-4.5.13-prompt.md       # I18n + RTL + Mobile-First Responsive
  task-4.5.14-prompt.md       # Tests E2E + Lighthouse PWA + Phase 4 Closure
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-18-sprint-18-verification.md
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
4. La verification finale V-18 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-18-sprint-18-verification.md
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

## CONTEXTE PHASE 4 -- Vertical Insure (Skalean Broker ERP)

### Position du Sprint 5 dans la Phase 4

Sprint 18 (4.5) -- **Web Assure Portal + Mobile PWA**.

Voir `B-18-sprint-18-web-assure-portal-mobile.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

### Apport metier de ce sprint

web-assure-portal + web-assure-mobile PWA Lighthouse 100

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-18 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-18, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-18.

---

### Tache 1 / 14 : App Skeleton + PWA Setup

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 17

**But** : Initialiser 2 apps : web-assure-portal (desktop) et web-assure-mobile (PWA installable).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.1-prompt.md
```

**Actions principales attendues** :
- Folder `repo/apps/web-assure-portal/` (Next.js 15 desktop)
- Folder `repo/apps/web-assure-mobile/` (Next.js 15 PWA)
- Package partage `repo/packages/assure-shared/` :
- PWA setup web-assure-mobile :
- Web-assure-portal : layout desktop (sidebar)
- Web-assure-mobile : layout mobile (bottom nav + headers compacts)

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/`
  - `repo/apps/web-assure-mobile/`
  - `repo/apps/web-assure-mobile/public/manifest.json`
  - `repo/apps/web-assure-mobile/app/sw.ts`
  - `repo/apps/web-assure-mobile/serwist.config.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 2 apps demarrent (3005 + 3006)
  - V2 (P0) : Manifest.json valide
  - V3 (P0) : Service worker registered + activated

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
git commit -m "feat(sprint-18): app skeleton + pwa setup

Task: 4.5.1
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.1"
```

---

### Tache 2 / 14 : Auth Assure : OTP Login + Signup Auto-Link

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.5.1

**But** : Authentification simplifiee assures via OTP (One-Time Password) email/SMS -- pas password traditionnel (UX mobile-first).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.2-prompt.md
```

**Actions principales attendues** :
- Backend (extension Sprint 5 auth) : nouveau endpoint OTP-based
- OTP : 6 digits aleatoires + TTL 10 min + max 3 tentatives
- Storage OTP : Redis avec TTL
- Auto-link logic :
- Frontend pages :
- JWT assure : claims includes `user_type='assure'`, `linked_contact_id`, `tenants[]`

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AssureUsers.ts`
  - `repo/packages/auth/src/entities/assure-user.entity.ts`
  - `repo/packages/auth/src/services/otp-auth.service.ts`
  - `repo/apps/api/src/modules/auth/controllers/assure-auth.controller.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/assure-login-otp.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : OTP generation + Redis storage TTL 10min
  - V2 (P0) : OTP envoyee email + SMS si phone
  - V3 (P0) : Verify correct -> JWT

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
git commit -m "feat(sprint-18): auth assure : otp login + signup auto-link

Task: 4.5.2
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.2"
```

---

### Tache 3 / 14 : Layout Assure : Header + Bottom Nav + Sidebar

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.5.2

**But** : Layouts adaptes : web-assure-portal (sidebar desktop) et web-assure-mobile (bottom navigation mobile pattern).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.3-prompt.md
```

**Actions principales attendues** :
- Web-assure-portal layout :
- Web-assure-mobile layout :
- Bouton flottant FAB "Declarer sinistre" : visible toujours mobile (acces rapide critical use case)
- Notifications badge counter : sync avec service worker push events
- Tests : navigation + responsive

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/components/layout/sidebar.tsx`
  - `repo/apps/web-assure-portal/components/layout/header.tsx`
  - `repo/apps/web-assure-mobile/components/layout/bottom-nav.tsx`
  - `repo/apps/web-assure-mobile/components/layout/mobile-header.tsx`
  - `repo/apps/web-assure-mobile/components/layout/declare-sinistre-fab.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Desktop sidebar + navigation
  - V2 (P0) : Mobile bottom nav 5 tabs
  - V3 (P0) : FAB Declarer sinistre persistent

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
git commit -m "feat(sprint-18): layout assure : header + bottom nav + sidebar

Task: 4.5.3
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.3"
```

---

### Tache 4 / 14 : Mes Polices Page : List + Detail

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.5.3

**But** : Page mes polices : list + detail riche (garanties + premiums + avenants + actions).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.4-prompt.md
```

**Actions principales attendues** :
- Page list `/polices` :
- Page detail `/polices/:id` :
- Endpoints consume Sprint 14+ /api/v1/insure/policies (filtre par contact_id)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/polices/page.tsx`
  - `repo/apps/web-assure-portal/app/[locale]/polices/[id]/page.tsx`
  - `repo/apps/web-assure-mobile/app/[locale]/polices/page.tsx`
  - `repo/apps/web-assure-mobile/app/[locale]/polices/[id]/page.tsx`
  - `repo/packages/assure-shared/src/components/policy-card.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List polices personnel
  - V2 (P0) : Detail tabs all functional
  - V3 (P0) : Actions selon contexte

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
git commit -m "feat(sprint-18): mes polices page : list + detail

Task: 4.5.4
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.4"
```

---

### Tache 5 / 14 : Premiums Echeancier + Paiement Reglement

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.5.4

**But** : Page mes premiums : echeancier complet + status paiements + bouton "Payer" qui declenche flow Pay Sprint 11.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.5-prompt.md
```

**Actions principales attendues** :
- Page `/polices/:id/premiums` :
- History payments : preuves paiement + receipts download
- Auto-payment setup (Phase 7+ : carte memorisee + auto-prelevement echeance)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/polices/[id]/premiums/page.tsx`
  - `repo/packages/assure-shared/src/components/premiums-timeline.tsx`
  - `repo/packages/assure-shared/src/components/payment-method-dialog.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Timeline visible
  - V2 (P0) : Pay flow complete
  - V3 (P0) : Receipts download

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
git commit -m "feat(sprint-18): premiums echeancier + paiement reglement

Task: 4.5.5
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.5"
```

---

### Tache 6 / 14 : Declarer Sinistre Etape 1 : Infos + Photos

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.5.5

**But** : Etape 1 wizard declaration sinistre : infos + photos (camera mobile direct OU upload).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.6-prompt.md
```

**Actions principales attendues** :
- Page `/sinistres/declarer/etape-1` (mobile prioritise)
- Selection police impactee (dropdown si multiple)
- Form :
- Mobile camera integration : `<input type="file" accept="image/*" capture="environment">`
- Upload photos S3 multi-tenant (Sprint 10) avec compression client-side avant upload
- GPS auto-fill adresse via Google Maps API (Phase 7+ enrichi)

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-1/page.tsx`
  - `repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-1/page.tsx`
  - `repo/packages/assure-shared/src/components/sinistre-photos-upload.tsx`
  - `repo/packages/assure-shared/src/lib/gps-geolocation.ts`
  - `repo/packages/assure-shared/src/lib/image-compress.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Form complet
  - V2 (P0) : Photos upload + compression
  - V3 (P0) : Camera mobile direct

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
git commit -m "feat(sprint-18): declarer sinistre etape 1 : infos + photos

Task: 4.5.6
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.6"
```

---

### Tache 7 / 14 : Declarer Sinistre Etape 2 : Choix Garage M8

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.5.6

**But** : Flux M8 -- assure choisit garage parmi liste garages disponibles : Skalean Atlas (priorite) + autres garages partenaires Cross-Tenant Sprint 25.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.7-prompt.md
```

**Actions principales attendues** :
- Page `/sinistres/declarer/etape-2`
- List garages disponibles :
- Selection garage + click "Continuer" -> etape 3
- Endpoint backend : `GET /api/v1/repair/garages/available?branche=auto&lat=...&lng=...&max_distance_km=20`
- Sprint 25 cross-tenant fournira liste garages partenaires
- Sprint 19 Repair Foundation aura entity Skalean Atlas comme premier garage default

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-2/page.tsx`
  - `repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-2/page.tsx`
  - `repo/packages/assure-shared/src/components/garage-card.tsx`
  - `repo/packages/assure-shared/src/components/garages-filters.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List garages avec geolocalisation
  - V2 (P0) : Skalean Atlas highlighted
  - V3 (P0) : Filtres distance + rating + specialite

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
git commit -m "feat(sprint-18): declarer sinistre etape 2 : choix garage m8

Task: 4.5.7
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.7"
```

---

### Tache 8 / 14 : Declarer Sinistre Etape 3 : Appointment Booking + Confirmation

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.5.7

**But** : Etape 3 finale : choisir creneau RDV chez garage choisi + confirmation finale + create sinistre + notification garage.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.8-prompt.md
```

**Actions principales attendues** :
- Page `/sinistres/declarer/etape-3`
- Calendar widget : creneaux disponibles garage (consume Sprint 8 Booking endpoint)
- Selection date + heure
- Recap final visualization
- Submit "Confirmer declaration" :
- Page confirmation finale `/sinistres/declarer/confirmation` :

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-3/page.tsx`
  - `repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/confirmation/page.tsx`
  - `repo/packages/assure-shared/src/components/calendar-widget.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Calendar widget creneaux
  - V2 (P0) : Submit cree sinistre + appointment
  - V3 (P0) : Notifications garage + assure

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
git commit -m "feat(sprint-18): declarer sinistre etape 3 : appointment booking + confirmation

Task: 4.5.8
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.8"
```

---

### Tache 9 / 14 : Mes Sinistres : List + Detail Timeline

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.5.8

**But** : Page mes sinistres : list + detail avec timeline statut + tracking en temps reel.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.9-prompt.md
```

**Actions principales attendues** :
- Page list `/sinistres` :
- Page detail `/sinistres/:id` :
- Real-time updates : poll /sinistres/:id toutes 30s OR Server-Sent Events (Phase 7+)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/sinistres/page.tsx`
  - `repo/apps/web-assure-portal/app/[locale]/sinistres/[id]/page.tsx`
  - `repo/packages/assure-shared/src/components/sinistre-timeline.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List + filtres
  - V2 (P0) : Detail timeline visuelle
  - V3 (P0) : Status updates polling

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
git commit -m "feat(sprint-18): mes sinistres : list + detail timeline

Task: 4.5.9
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.9"
```

---

### Tache 10 / 14 : Mes Documents + QR Scanner

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.5.9

**But** : Page mes documents : list + telechargement + QR scanner verification documents (cas police lecture sur smartphone).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.10-prompt.md
```

**Actions principales attendues** :
- Page list `/documents` : tous documents lies a l'assure (polices PDF + factures + attestations + bulletins)
- Filters : type doc + date_range + police lien
- PDF preview inline (`react-pdf`)
- Download : signed URL S3
- QR Scanner page `/documents/scan-qr` :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/app/[locale]/documents/page.tsx`
  - `repo/apps/web-assure-mobile/app/[locale]/documents/scan-qr/page.tsx`
  - `repo/packages/assure-shared/src/components/qr-scanner.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List documents
  - V2 (P0) : PDF preview + download
  - V3 (P0) : QR scanner camera

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
git commit -m "feat(sprint-18): mes documents + qr scanner

Task: 4.5.10
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.10"
```

---

### Tache 11 / 14 : Notifications Center + Push PWA

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.5.10

**But** : Centre notifications in-app + push notifications PWA mobile (criticum sinistre updates + reminders premiums).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.11-prompt.md
```

**Actions principales attendues** :
- Page `/notifications` : list + filters + mark read/unread
- Backend : table `notifications` + endpoints
- Push notifications subscription PWA :
- Backend send push notification :
- Service worker handler : afficher notification + click -> open app page concernee
- Settings : opt-in/out per type notification

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-Notifications.ts`
  - `repo/packages/notifications/src/services/push-subscription.service.ts`
  - `repo/packages/notifications/src/services/web-push-sender.service.ts`
  - `repo/apps/web-assure-mobile/components/push/permission-prompt.tsx`
  - `repo/apps/web-assure-portal/app/[locale]/notifications/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Subscription PWA fonctionne
  - V2 (P0) : Backend send push
  - V3 (P0) : Service worker handler

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
git commit -m "feat(sprint-18): notifications center + push pwa

Task: 4.5.11
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.11"
```

---

### Tache 12 / 14 : Service Worker + Offline Cache

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.5.11

**But** : Service worker offline cache strategies (PWA-quality experience meme connexion intermittente).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.12-prompt.md
```

**Actions principales attendues** :
- Cache strategies Serwist :
- Offline page custom : "Vous etes hors ligne. Vos polices sont visibles. Pas de declaration sinistre possible offline."
- Background sync : photos sinistre pending stockes IndexedDB, sync quand online
- Tests offline mode

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-mobile/app/sw.ts`
  - `repo/apps/web-assure-mobile/app/[locale]/offline/page.tsx`
  - `repo/packages/assure-shared/src/lib/background-sync.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cache static assets
  - V2 (P0) : Network First API
  - V3 (P0) : Background sync upload

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
git commit -m "feat(sprint-18): service worker + offline cache

Task: 4.5.12
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.12"
```

---

### Tache 13 / 14 : I18n + RTL + Mobile-First Responsive

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.5.12

**But** : Internationalisation 3 locales + RTL + mobile-first responsive (critique 60%+ users mobile MA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.13-prompt.md
```

**Actions principales attendues** :
- Messages 3 locales (fr / ar-MA / ar) -- ~500 keys per locale
- RTL CSS appliquee ar/ar-MA
- Mobile-first : breakpoints sm/md/lg/xl
- Touch-friendly : tap targets 44px+
- PWA : viewport-fit cover (notch iPhone)
- Tests responsive multiple viewports

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/messages/{fr,ar-MA,ar}.json`
  - `repo/apps/web-assure-mobile/messages/{fr,ar-MA,ar}.json`
  - `repo/packages/assure-shared/messages/{shared keys}.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 locales complete
  - V2 (P0) : RTL fonctionne
  - V3 (P0) : Mobile-first all viewports

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
git commit -m "feat(sprint-18): i18n + rtl + mobile-first responsive

Task: 4.5.13
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.13"
```

---

### Tache 14 / 14 : Tests E2E + Lighthouse PWA + Phase 4 Closure

**Metadonnees** : P0 | 12h | Depend de : Depend de 4.5.13

**But** : Suite tests E2E exhaustive + Lighthouse PWA audit + closure officielle Phase 4.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-18-web-assure-portal-mobile/task-4.5.14-prompt.md
```

**Actions principales attendues** :
- Auth OTP : request + verify + auto-link contact (4)
- Polices : list + detail + actions (3)
- Premiums : timeline + payment flow (2)
- Declarer sinistre wizard 3 etapes (3)
- Mes sinistres : list + detail timeline (2)
- Notifications + push subscription (2)

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-portal/e2e/{15+ specs}.spec.ts`
  - `repo/apps/web-assure-mobile/e2e/{15+ specs}.spec.ts`
  - `repo/docs/phase-4-completion.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : Lighthouse PWA 100
  - V3 (P0) : Phase 4 closure document

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
git commit -m "feat(sprint-18): tests e2e + lighthouse pwa + phase 4 closure

Task: 4.5.14
Sprint: 18 (Phase 4 / Sprint 5)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-18 Tache 4.5.14"
```

---


## VERIFICATION DU SPRINT 18

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-18-sprint-18-verification.md
```

Le fichier de verification V-18 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint18-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint18-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint18-verify-report.md
git commit -m "chore(sprint-18): close sprint 18 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 4 (Vertical Insure (Skalean Broker ERP))
- Sprint : 18 (Phase 4 / Sprint 5)
- Apport : web-assure-portal + web-assure-mobile PWA Lighthouse 100
- Tests E2E cumules : {N}+

Sprint 18 completed -- handoff to Sprint 19."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 18]
   |
   v
[Tache 4.5.1: App Skeleton + PWA Setup]
   | -> compile -> tests -> commit
   v
[Tache 4.5.2: Auth Assure : OTP Login + Signup Auto-Link]
   | -> compile -> tests -> commit
   v
[Tache 4.5.3: Layout Assure : Header + Bottom Nav + Sidebar]
   | -> compile -> tests -> commit
   v
[Tache 4.5.4: Mes Polices Page : List + Detail]
   | -> compile -> tests -> commit
   v
[Tache 4.5.5: Premiums Echeancier + Paiement Reglement]
   | -> compile -> tests -> commit
   v
[Tache 4.5.6: Declarer Sinistre Etape 1 : Infos + Photos]
   | -> compile -> tests -> commit
   v
[Tache 4.5.7: Declarer Sinistre Etape 2 : Choix Garage M8]
   | -> compile -> tests -> commit
   v
[Tache 4.5.8: Declarer Sinistre Etape 3 : Appointment Booking + Confi]
   | -> compile -> tests -> commit
   v
[Tache 4.5.9: Mes Sinistres : List + Detail Timeline]
   | -> compile -> tests -> commit
   v
[Tache 4.5.10: Mes Documents + QR Scanner]
   | -> compile -> tests -> commit
   v
[Tache 4.5.11: Notifications Center + Push PWA]
   | -> compile -> tests -> commit
   v
[Tache 4.5.12: Service Worker + Offline Cache]
   | -> compile -> tests -> commit
   v
[Tache 4.5.13: I18n + RTL + Mobile-First Responsive]
   | -> compile -> tests -> commit
   v
[Tache 4.5.14: Tests E2E + Lighthouse PWA + Phase 4 Closure]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 18 -- V-18]
   |
   v
[Rapport sprint18-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 85 heures (6h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

**Apport metier principal** : web-assure-portal + web-assure-mobile PWA Lighthouse 100.

**Prerequis Sprint 19** : Sprint 18 GO complet (score >= 95% verification automatique V-18).

**Sprint suivant** : Sprint 19.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 17 (verification GO)

```bash
# Verifier Sprint 17 GO
ls skalean-insurtech/sprint17-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint17-verify-report.md
```

### Lancement Sprint 18 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-18-sprint-18-web-assure-portal-mobile.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-18-sprint-18-web-assure-portal-mobile.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-18-sprint-18-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-18.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 18"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint18-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-18** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-18-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-18 v2.2 detaille -- Sprint 18 (4.5) Web Assure Portal + Mobile PWA.**

**Total taches detaillees** : 14 | **Effort cumul** : ~85h | **Apport** : web-assure-portal + web-assure-mobile PWA Lighthouse 100
