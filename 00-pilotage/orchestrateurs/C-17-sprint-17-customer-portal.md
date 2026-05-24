# ORCHESTRATEUR SPRINT 17 v3.0 -- Phase 4 / Sprint 4 : Customer Portal (B2C Souscripteur)
# REFONTE v3.0 : 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (REFONTE complete v2.2 -- Customer = acteur souscripteur distinct du Assure)
**Phase** : 4 -- Vertical Insure (Customer-facing web)
**Sprint** : 17 / 40 (cumul v3.0) -- Phase 4 Sprint 4
**Reference meta-prompt** : `B-17-sprint-17-customer-portal-v3.md`
**Reference verification** : `V-17-sprint-17-verification.md`
**Numerotation taches** : 4.4.1 a 4.4.14
**Effort total** : ~75 heures developpement / 1.5 semaines
**Priorite** : P0 (acteur 4 ecosystem 6 acteurs decision-012)
**Apport metier** : Portal customer souscripteur + FNOL + tracking real-time + Sky AI

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 17 v3.0 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-17 v3.0** -- pour code complet, patterns FNOL wizard + SSE tracking + Sky AI + WhatsApp scope strict, lire le meta-prompt B-17 reference dans chaque tache.

**REFONTE CRITIQUE v3.0** par rapport a v2.2 :
- Customer Portal = portal BACKOFFICE post-souscription (vs Wizard vente SEO v2.2)
- Customer (acteur 4) = personne ayant souscrit la police (titulaire contrat)
- Distinct du Assure (acteur 5) qui est la personne assuree (Sprint 18 mobile)
- 4 NOUVELLES taches v3.0 : FNOL declaration + Tracking SSE 12 milestones + Sky AI estimation + WhatsApp scope strict customer
- Theme Sofidemy (bleu marine #0E1B3D + gold #C8A465) -- decision-011
- 4 langues (fr + ar classique + ar-MA darija + en) -- decision-008
- PWA installable + offline-first AsyncStorage 30 jours cache

---

## OBJECTIF DU SPRINT 17 v3.0

Sprint 17 (4.4) -- Customer Portal Backoffice (B2C Souscripteur). Voir B-17 v3.0 pour contexte detaille.

App `apps/web-customer-portal` (Next.js 14 App Router PWA) qui permet au **Customer souscripteur** de :
- Visualiser ses polices souscrites (vue centrale dashboard)
- Suivre ses sinistres declares en temps reel (SSE 12 milestones)
- Declarer un nouveau sinistre FNOL (wizard 6 etapes)
- Estimer cout/duree avec Sky AI integration
- Payer ses primes + telecharger ses factures
- Acceder aux documents personnels (polices + attestations + rapports expert)
- Gerer son profil + preferences + multilingue
- Communiquer scope strict via WhatsApp (Sprint 9 v3.0 status only)

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-17-customer-portal-v3/
  task-4.4.1-prompt.md   # Bootstrap Next.js 14 + PWA + theme Sofidemy + i18n 4 langues
  task-4.4.2-prompt.md   # Auth customer + onboarding + KYC simplifie
  task-4.4.3-prompt.md   # Dashboard customer (vue centrale)
  task-4.4.4-prompt.md   # Polices visualisation + souscription + renewal
  task-4.4.5-prompt.md   # NOUVEAU FNOL declaration wizard 6 etapes
  task-4.4.6-prompt.md   # Sinistres list + filters + status overview
  task-4.4.7-prompt.md   # REFONDU Tracking sinistre real-time SSE (12 milestones)
  task-4.4.8-prompt.md   # NOUVEAU Sky AI integration customer (status + estimation)
  task-4.4.9-prompt.md   # Paiements primes + factures + history
  task-4.4.10-prompt.md  # Documents personnels (download + sharing)
  task-4.4.11-prompt.md  # Profile + preferences + multilingue switching
  task-4.4.12-prompt.md  # NOUVEAU Feedback + ratings + support tickets
  task-4.4.13-prompt.md  # NOUVEAU WhatsApp scope strict customer (8 templates)
  task-4.4.14-prompt.md  # Tests E2E 40+ + seeds 20 customers + accessibility WCAG 2.1 AA
```

**Verification du sprint** :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions applicables** : decision-008 (data residency + multilingue) + decision-011 (rebrand Sofidemy) + decision-012 (ecosystem 6 acteurs) + correction Saad #7 (WhatsApp scope strict heritage Sprint 9)

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/apps/web-customer-portal/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run apps/web-customer-portal` + `pnpm playwright test` -- tous PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Build PWA** (`pnpm build` -- service worker genere)
7. **Commit** Conventional Commits
8. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : Les taches ont des dependances. Tache 4.4.5 FNOL utilise Auth de 4.4.2. Tache 4.4.7 Tracking SSE utilise sinistres de 4.4.6. Tache 4.4.8 Sky AI consume tracking SSE.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier
4. La verification finale V-17 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

Apres la 14eme tache, lancer **automatiquement** :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```

Le script bash auto-reparation V-17 verifie 85+ criteres (14 taches + 12 transversaux + 6 specifiques Sprint 17) et produit `sprint17-verify-report.md`.

---

## REGLES ABSOLUES skalean-insurtech v3.0 (a appliquer dans CHAQUE tache)

### Conventions techniques

- **TypeScript strict** + Next.js 14 App Router + pnpm + monorepo workspace
- **Theme Sofidemy** decision-011 : palettes primary #0E1B3D + secondary #C8A465 / typography Inter + NotoSansArabic
- **NextAuth.js** + JWT + refresh token (Sprint 5 reuse)
- **Tanstack Query 5** pour server state + AsyncStorage persistence
- **shadcn/ui + Radix UI** + Tailwind CSS (NextUI v2 alternative considere mais shadcn confirme decision-011)
- **next-intl** pour i18n 4 langues + RTL ar + ar-MA
- **react-hook-form + Zod** pour validation
- **next-pwa** pour PWA installable + service worker
- **AUCUNE EMOJI** absolument -- decision-006
- **Conventional Commits lowercase** + body <= 200 chars + footer obligatoire (`Task:` + `Sprint:` + `Phase:` + `Decisions:`)
- **Pino logs structures** uniquement (jamais console.log/error)
- **Vitest + Playwright** tests par feature (.spec.ts + .e2e.ts) + coverage >= 85%
- **Multi-tenant strict** : tous les hooks/services prennent `tenantId` parametre

### Specifique Sprint 17 v3.0

- **Customer != Assure** : Customer Portal Sprint 17 web, Assure Mobile Sprint 18 Expo (distinction critique decision-012)
- **Permissions Sprint 7.5a** : 17 perms `customer.*` enforced sur tous endpoints (souscription + paiement + FNOL + management)
- **Heritage Sprint 9 v3.0** : Communications via @insurtech/comm avec content_type (status_only / data_sensible / urgent) -- WhatsApp uniquement status_only
- **PWA installable** : manifest.json + service worker + icons 180x180 + 512x512 + offline-first
- **WCAG 2.1 AA** : accessibility audit obligatoire (axe-core + pa11y)
- **Lighthouse score** : Performance >= 85 / Accessibility >= 95 / Best Practices >= 90 / SEO >= 90
- **Mobile-first responsive** : breakpoints 320px / 768px / 1024px / 1280px / 1536px

### Conformite InsurTech Maroc (8 lois critiques Sprint 17)

- **Loi 09-08 CNDP** : protection donnees customer + correction Saad #7 (WhatsApp scope strict heritage Sprint 9)
- **Loi ACAPS** : retention 10 ans toute communication customer + audit logs
- **Loi 43-20 signature electronique** : signature police Barid eSign (Sprint 10) reuse
- **Loi 17-95 contrat assurance** : conditions contractuelles affichees obligatoires (PDF telechargeables)
- **ANRT (Telecoms)** : SMS via providers homologues (Sprint 9 v3.0 SMS OTP only)
- **DGI Fiscalite** : factures conformes (TVA 10% Pay Sprint 11)
- **Bank Al-Maghrib (BAM)** : paiement carte bancaire CMI conforme (Sprint 11)
- **CNDP - cookies + tracking** : banniere cookies + opt-in Marketing (analytics Google Analytics 4)

---

## CONTEXTE PHASE 4 -- Vertical Insure (Skalean Broker ERP)

### Position du Sprint 4 dans la Phase 4

Sprint 17 (4.4) -- **Customer Portal Backoffice** -- suit Sprint 16 (Insure Broker ERP backoffice) et precede Sprint 18 (Assure Mobile App).

C'est le **4eme sprint de Phase 4 Vertical Insure** apres Sprints 13 (Insure foundation), 14 (Police modele DB + Workflow), 15 (Sky AI Score Risque), 16 (Broker ERP backoffice).

### Modules concernes par cette Phase

`apps/web-customer-portal/` (NOUVEAU Next.js 14 PWA), `apps/api/src/modules/customer/`, `infrastructure/customer-templates/` (emails + PDFs), `apps/web-broker-portal/` (reuse composants Sprint 16).

### Apport metier de ce sprint

Sprint 17 v3.0 est l'**acteur 4 Customer** de l'ecosystem 6 acteurs (decision-012). Avec Sprint 18 (Assure mobile), il finalise la **B2C experience**.

**Impact downstream** : Sprint 17 GO conditionne Sprint 19 (Vertical Repair Foundation -- garage doit recevoir FNOL declares par customer), Sprint 22.5 (Tow Mission -- triggered apres FNOL customer), Sprint 24 (Master Orchestrator -- coordination FNOL workflow).

**Apport Demo Day 30 juin 2026 (decision-015)** : Sprint 17 = portal customer DEMO-READY (souscription + FNOL + tracking SSE + Sky AI estimation visible audience).

### Decisions strategiques applicables

- **decision-006** : NO emoji policy
- **decision-008** : Data residency Maroc + multilingue 4 langues
- **decision-011** : Rebrand Sofidemy theme bleu marine + gold
- **decision-012** : Ecosystem 6 acteurs (Customer acteur 4 distinct)
- **correction Saad #7** : WhatsApp scope strict heritage Sprint 9 v3.0
- **decision-015** : Demo Day 30 juin 2026 jalon

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

---

### Tache 1 / 14 : Bootstrap Next.js 14 + apps/web-customer-portal + PWA

**Metadonnees** : P0 | 5h | Depend de : Sprint 16

**But** : Bootstrap apps/web-customer-portal Next.js 14 App Router + theme Sofidemy + i18n 4 langues + PWA installable + 8 pages squelette navigables.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-customer-portal-v3/task-4.4.1-prompt.md
```

**Actions principales attendues** :

- Bootstrap `repo/apps/web-customer-portal/` Next.js 14 App Router monorepo workspace
- `package.json` avec name `@insurtech/web-customer-portal` + dependencies (next 14.2.x + react 18.3.x + tailwindcss 3.4.x + shadcn-ui + radix-ui + next-intl 3.x + next-pwa 5.x + @tanstack/react-query 5.62.x + react-hook-form + zod + lucide-react + recharts)
- `tsconfig.json` strict mode + path aliases `@/*` -> `./src/*` + workspace types
- `tailwind.config.ts` avec theme Sofidemy palettes (`primary: { 500: '#0E1B3D' }, secondary: { 500: '#C8A465' }`) + fonts Inter + NotoSansArabic
- `app/layout.tsx` racine + ThemeProvider + QueryProvider + Toaster
- `app/[locale]/layout.tsx` avec next-intl provider + 4 langues
- `messages/{fr,ar,ar-MA,en}.json` translations baseline (commons + navigation + dashboard + sinistres + polices)
- `next.config.mjs` avec next-pwa config + i18n + image domains + headers security
- `public/manifest.json` PWA + icons 180x180 + 512x512 (theme color Sofidemy primary)
- `public/sw.js` service worker (genere par next-pwa workbox)
- 8 pages squelette App Router : `(auth)/login/page.tsx` + `(dashboard)/page.tsx` + `(dashboard)/polices/page.tsx` + `(dashboard)/sinistres/page.tsx` + `(dashboard)/sinistres/nouveau/page.tsx` + `(dashboard)/sinistres/[id]/page.tsx` + `(dashboard)/paiements/page.tsx` + `(dashboard)/profile/page.tsx`
- Layout `(dashboard)/layout.tsx` avec Sidebar + Header + UserMenu + LanguageSwitcher
- Composants UI bootstrap shadcn-ui : Button + Card + Input + Select + Dialog + Toast (`pnpm dlx shadcn-ui@latest add ...`)
- Tests bootstrap 5+ : page render + i18n switching + PWA manifest valid + theme applied

**Fichiers cibles principaux** :
- `repo/apps/web-customer-portal/package.json`
- `repo/apps/web-customer-portal/tsconfig.json`
- `repo/apps/web-customer-portal/tailwind.config.ts`
- `repo/apps/web-customer-portal/next.config.mjs`
- `repo/apps/web-customer-portal/public/manifest.json`
- `repo/apps/web-customer-portal/src/app/layout.tsx`
- `repo/apps/web-customer-portal/src/app/[locale]/layout.tsx`
- `repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/layout.tsx`
- `repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/page.tsx`
- `repo/apps/web-customer-portal/src/messages/{fr,ar,ar-MA,en}.json`
- `repo/apps/web-customer-portal/src/styles/sofidemy.css`
- `repo/apps/web-customer-portal/src/components/ui/*` (shadcn baseline)
- `repo/apps/web-customer-portal/src/components/layout/Sidebar.tsx`
- `repo/apps/web-customer-portal/src/components/layout/Header.tsx`
- `repo/apps/web-customer-portal/src/components/i18n/LanguageSwitcher.tsx`

**Criteres P0 cles** :
- V1 (P0) : Next.js 14 App Router structure complete + build OK
- V2 (P0) : Theme Sofidemy applique (verify color values DOM)
- V3 (P0) : i18n 4 langues fonctionnelle + RTL ar + ar-MA
- V4 (P0) : 8 pages App Router navigables
- V5 (P0) : PWA manifest valid + service worker genere
- V6 (P0) : Tests bootstrap 5+ PASS

**Validation** :
```bash
cd repo/apps/web-customer-portal
pnpm install
pnpm tsc --noEmit
pnpm build
pnpm vitest run
pnpm dev &
sleep 5

# Verify PWA manifest
curl -s http://localhost:3000/manifest.json | jq '.theme_color, .icons | length'
# Attendu: "#0E1B3D" + nb icons

# Verify pages
curl -I http://localhost:3000/fr
curl -I http://localhost:3000/ar
# Attendu: 200 OK pour fr et ar

# Verify Lighthouse PWA score (preview manuelle)
# pnpm dlx lighthouse http://localhost:3000/fr --only-categories=pwa
# Attendu: PWA score > 90
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-17): REFONTE bootstrap next 14 + web-customer-portal + pwa + sofidemy + i18n

- Next.js 14 App Router + monorepo workspace
- Theme Sofidemy palettes + fonts Inter + NotoSansArabic
- i18n 4 langues fr/ar/ar-MA/en + RTL ar
- PWA installable + manifest + service worker
- 8 pages App Router squelette
- shadcn-ui baseline + Tanstack Query
- 5+ tests bootstrap

Task: 4.4.1
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: decision-011 sofidemy + decision-008 multilingue"
```

---

### Tache 2 / 14 : Auth customer + onboarding + KYC simplifie

**Metadonnees** : P0 | 5h | Depend de : 4.4.1

**But** : Auth customer via NextAuth (Sprint 5 reuse) + onboarding 3 etapes (Email/Password + KYC CIN + Verification SMS OTP) + Permissions Sprint 7.5a `customer.profile.update` + `customer.profile.view`.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-17-customer-portal-v3/task-4.4.2-prompt.md
```

**Actions principales attendues** :

- Configurer NextAuth.js v5 avec credentials provider + JWT strategy (Sprint 5 reuse)
- Onboarding wizard 3 etapes (`/onboarding/etape-1` + `/etape-2` + `/etape-3`)
  - Etape 1 : Email + Password + Confirm Password + Acceptance CGU + Newsletter optional
  - Etape 2 : KYC simplifie -- CIN (regex `/^[A-Z]{1,2}\d{1,8}$/`) + Date naissance + Adresse Maroc
  - Etape 3 : Verification telephone SMS OTP (Sprint 9 v3.0 SMS service OTP only, 6 digits, TTL 5 min)
- Service `customer-auth.service.ts` API endpoints :
  - `POST /api/v1/customer/auth/register` (etape 1) + `POST /etape-2-kyc` + `POST /etape-3-verify-otp`
  - `POST /api/v1/customer/auth/login` (email + password)
  - `POST /api/v1/customer/auth/refresh` (JWT refresh)
- Hook `useCustomerAuth()` client-side : `login()` + `logout()` + `register()` + `currentUser`
- Middleware Next.js `middleware.ts` : redirect /dashboard si non-authenticated
- Pages : `(auth)/login` + `(auth)/register` + `(auth)/forgot-password` + `(auth)/onboarding/etape-{1,2,3}`
- Tests E2E Playwright 8+ : login happy path + onboarding 3 etapes + KYC validation + OTP verification

**Fichiers cibles principaux** :
- `repo/apps/web-customer-portal/src/lib/auth/nextauth.config.ts`
- `repo/apps/web-customer-portal/src/lib/auth/auth-options.ts`
- `repo/apps/web-customer-portal/src/middleware.ts`
- `repo/apps/web-customer-portal/src/app/[locale]/(auth)/login/page.tsx`
- `repo/apps/web-customer-portal/src/app/[locale]/(auth)/register/page.tsx`
- `repo/apps/web-customer-portal/src/app/[locale]/(auth)/onboarding/[etape]/page.tsx`
- `repo/apps/web-customer-portal/src/hooks/useCustomerAuth.ts`
- `repo/apps/web-customer-portal/e2e/auth-onboarding.e2e.ts`
- `repo/apps/api/src/modules/customer/customer-auth.controller.ts`
- `repo/apps/api/src/modules/customer/customer-auth.service.ts`

**Criteres P0 cles** :
- V1 (P0) : NextAuth.js v5 + credentials + JWT + refresh OK
- V2 (P0) : Onboarding 3 etapes wizard fonctionnel
- V3 (P0) : KYC CIN regex validation + duplicate check
- V4 (P0) : SMS OTP via Sprint 9 v3.0 (TTL 5 min + 6 digits)
- V5 (P0) : Middleware redirect non-authenticated -> /login
- V6 (P0) : Tests E2E 8+ PASS

**Validation** :
```bash
cd repo/apps/web-customer-portal
pnpm vitest run src/hooks/useCustomerAuth.test.ts
pnpm playwright test e2e/auth-onboarding.e2e.ts

# Test API endpoints
curl -X POST http://localhost:3001/api/v1/customer/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456","cgu":true}'
# Attendu: { userId, sessionId, nextStep: "kyc" }
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-17): auth customer + onboarding 3 etapes + kyc + otp sms

Task: 4.4.2
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: sprint 5 nextauth reuse + sprint 9 v3 sms otp"
```

---

### Tache 3 / 14 : Dashboard customer (vue centrale)

**Metadonnees** : P0 | 4h | Depend de : 4.4.2

**But** : Dashboard customer `/` page racine post-login (vue centrale 4 widgets : Polices actives + Sinistres en cours + Paiements en attente + Actions rapides).

**Pattern Dashboard layout** :
- Header welcome `t('dashboard.greeting', { name: user.firstName })` + Last login timestamp
- Stats cards row : 4 stats (polices actives + sinistres en cours + paiements en attente + score Sky AI)
- Section "Mes polices actives" (cards horizontales scroll) -- 4 cards max + lien "Voir tout"
- Section "Mes sinistres en cours" (cards verticales) -- 3 cards max + tracking progress bar SSE preview
- Section "Actions rapides" 4 boutons larges (Declarer sinistre / Voir factures / Update profile / Contact support)
- Footer : 4 langues switcher + Mentions legales + Politique CNDP

**Actions principales attendues** :
- Page `app/[locale]/(dashboard)/page.tsx` server component avec `getServerSession()` Sprint 5
- Hook `useCustomerDashboard()` Tanstack Query fetch `/api/v1/customer/dashboard`
- 4 widgets composants : `PolicesActivesWidget` + `SinistresEnCoursWidget` + `PaiementsEnAttenteWidget` + `ActionsRapidesWidget`
- Service `customer-dashboard.service.ts` (API) -- agrege polices + sinistres + paiements + score Sky AI
- Tests 6+ : dashboard render + widgets fetch + permissions + empty state

**Criteres P0** : V1 4 widgets dashboard / V2 Permission `customer.profile.view` enforce / V3 Multilingue / V4 Empty state si pas de polices / V5 Tests 6+

**Commit** : `feat(sprint-17): dashboard customer + 4 widgets + actions rapides` (Task: 4.4.3)

---

### Tache 4 / 14 : Polices visualisation + souscription + renewal

**Metadonnees** : P0 | 6h | Depend de : 4.4.3

**But** : Pages polices (`/polices` list + `/polices/[id]` detail) avec souscription nouvelle police + renewal expirees.

**Actions principales attendues** :
- Page `/polices` list filtres (status / type / dates) + tableau cards polices
- Page `/polices/[id]` detail : Couvertures + Vehicule + Conducteur + Documents + Historique sinistres
- Page `/polices/souscrire` wizard 4 etapes (Type produit + KYC + Couvertures + Signature + Paiement) -- reuse Sprint 10 Barid eSign
- Bouton "Renouveler" sur polices proches expiration (J-30) -- auto-pre-fill data + signature Sprint 10 + paiement Sprint 11
- Hook `usePolices()` + `usePolice(id)` + `useRenewalQuote(policeId)`
- Permissions Sprint 7.5a : `customer.polices.view` + `customer.polices.subscribe` + `customer.polices.renew`
- Tests E2E 8+ : list + detail + souscription wizard + renewal + paiement

**Criteres P0** : V1 List + detail page / V2 Souscription wizard 4 etapes / V3 Renewal workflow / V4 Permissions enforce / V5 Tests E2E 8+

**Commit** : `feat(sprint-17): polices + souscription wizard + renewal workflow` (Task: 4.4.4)

---

### Tache 5 / 14 : NOUVEAU FNOL declaration wizard 6 etapes

**Metadonnees** : P0 | 8h | Depend de : 4.4.4

**But** : **NOUVEAU v3.0** -- FNOL (First Notice Of Loss) wizard 6 etapes mobile-first + auto-trigger Sprint 24 master orchestrator (Repair workflow).

**6 etapes wizard** :
1. Type sinistre (4 cards : collision / vol / incendie / autre) + police concernee (dropdown si plusieurs)
2. Date / heure / lieu (date picker + geolocation auto + adresse manuelle)
3. Description sinistre (textarea 500 chars + voice recording optional)
4. Photos sinistre (Expo Camera multi-shot 3-10 photos + upload S3 signed URL)
5. Tierces parties impliquees (formulaire dynamique 0-3 tiers : nom + telephone + assurance + plaque)
6. Recap + Signature electronique (Sprint 10 Barid eSign reuse) + Submit

**Pattern wizard step routing** :
- URL `/sinistres/nouveau?step=1` + state persistence localStorage
- Sauvegarde auto draft toutes 30 secondes (resume si interruption)
- Validation Zod par etape (block next si invalid)
- Submit final API `POST /api/v1/customer/sinistres/declare` -> trigger Sprint 24 Kafka `insurtech.events.repair`

**Actions principales attendues** :
- Pages `/sinistres/nouveau/[step]/page.tsx` (Step 1 a Step 6)
- Composants `FnolStepXForm` (1 par etape)
- Hook `useFnolWizard()` -- state machine XState / Tanstack Query mutations
- Service `customer-fnol.service.ts` API endpoint POST declare + draft management
- Trigger Kafka producer Sprint 24 orchestrator `insurtech.events.repair`
- Notification customer success via Sprint 9 v3.0 `customer_fnol_received` template (status_only WhatsApp + Email)
- Tests E2E Playwright 10+ : wizard happy path + draft resume + photo upload + signature

**Fichiers cibles principaux** :
- `repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/sinistres/nouveau/page.tsx` (stepper)
- `repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/sinistres/nouveau/[step]/page.tsx`
- `repo/apps/web-customer-portal/src/components/fnol/FnolStep1TypePolice.tsx` (1-6)
- `repo/apps/web-customer-portal/src/hooks/useFnolWizard.ts`
- `repo/apps/web-customer-portal/src/services/customer-fnol-client.service.ts`
- `repo/apps/api/src/modules/customer/customer-fnol.controller.ts`
- `repo/apps/api/src/modules/customer/customer-fnol.service.ts`
- `repo/apps/web-customer-portal/e2e/fnol-wizard.e2e.ts`

**Criteres P0** :
- V1 (P0) : Wizard 6 etapes complete + URL routing
- V2 (P0) : Validation Zod par etape
- V3 (P0) : Draft auto-save 30s + resume
- V4 (P0) : Photos upload S3 multipart
- V5 (P0) : Trigger Sprint 24 Kafka event verifie
- V6 (P0) : Notification customer Sprint 9 v3.0 envoyee
- V7 (P0) : Permission `customer.sinistres.report`
- V8 (P0) : Tests E2E 10+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-17): NOUVEAU fnol declaration wizard 6 etapes + sprint 24 trigger

- Wizard URL routing 6 etapes + state persistence
- Validation Zod + draft auto-save 30s
- Photos S3 signed multipart upload
- Signature Sprint 10 Barid eSign reuse
- Trigger Sprint 24 master orchestrator Kafka
- Notification customer Sprint 9 v3.0 status_only
- Tests E2E 10+

Task: 4.4.5
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: ecosystem 6 acteurs + sprint 24 trigger"
```

---

### Tache 6 / 14 : Sinistres list + filters + status overview

**Metadonnees** : P0 | 4h | Depend de : 4.4.5

**But** : Page `/sinistres` list filtres avances + status overview cards (En cours / Resolus / Refuses).

**Actions principales attendues** :
- Page `/sinistres` server component fetch list
- Composant `SinistresList` avec filtres (status / type / date range / police) + pagination
- Composant `SinistresOverview` 3 stats cards (active count + resolved count + refused count)
- Hook `useSinistresList(filters)` Tanstack Query
- Permissions `customer.sinistres.view`
- Tests 5+

**Criteres P0** : V1 Filtres avances / V2 Pagination / V3 Permission / V4 Tests 5+

**Commit** : `feat(sprint-17): sinistres list + filters + overview` (Task: 4.4.6)

---

### Tache 7 / 14 : REFONDU Tracking sinistre real-time SSE (12 milestones)

**Metadonnees** : P0 | 6h | Depend de : 4.4.6

**But** : **REFONDU v3.0** -- Page tracking `/sinistres/[id]` avec SSE real-time + 12 milestones progression.

**12 milestones references v3.0** :
1. `declared` -- FNOL declare par customer
2. `carrier_reviewed` -- Carrier examine declaration
3. `tow_dispatched` -- Depanneuse dispatchee (Sprint 22.5)
4. `vehicle_received` -- Vehicule recu garage
5. `diagnosed` -- Diagnostic garage termine
6. `devis_sent_expert` -- Devis envoye expert (Sprint 23 PartsHub)
7. `expert_validated` -- Expert valide devis
8. `carrier_approved` -- Carrier approuve devis
9. `parts_ordered` -- Pieces commandees (Sprint 23 PartsHub Phase 1)
10. `repair_in_progress` -- Reparation en cours
11. `qc_done` -- Quality Control termine
12. `ready_for_delivery` -- Pret livraison

**Pattern SSE** :
- Endpoint `GET /api/v1/customer/sinistres/[id]/stream` SSE (text/event-stream)
- Client `useRealtimeTracking(sinistreId)` hook avec EventSource
- Events emis : `milestone` + `status_changed` + `eta_updated`
- Reconnection auto + 30s heartbeat

**Actions principales attendues** :
- Page `/sinistres/[id]/page.tsx` avec Tabs (Overview / Tracking / Documents / Communications)
- Tab Tracking : 12 milestones progress + ETA + GPS map (si tow active)
- Composant `MilestoneTimeline` vertical timeline avec icons + dates
- Hook `useRealtimeTracking(sinistreId)` EventSource SSE
- API SSE endpoint `customer.sinistres.tracking.controller.ts` (server-side push)
- Permission `customer.sinistres.view`
- Tests E2E 8+ : SSE connection + milestone update + reconnection

**Fichiers cibles principaux** :
- `repo/apps/web-customer-portal/src/app/[locale]/(dashboard)/sinistres/[id]/page.tsx`
- `repo/apps/web-customer-portal/src/components/tracking/MilestoneTimeline.tsx`
- `repo/apps/web-customer-portal/src/components/tracking/GpsMap.tsx`
- `repo/apps/web-customer-portal/src/hooks/useRealtimeTracking.ts`
- `repo/apps/api/src/modules/customer/customer-sinistres-tracking.controller.ts`

**Criteres P0** : V1 SSE endpoint / V2 12 milestones display / V3 Reconnection auto / V4 Permission / V5 Tests E2E 8+

**Commit** :
```bash
git commit -m "feat(sprint-17): REFONDU tracking sinistre real-time sse 12 milestones

Task: 4.4.7
Sprint: 17 (Phase 4 / Sprint 4)"
```

---

### Tache 8 / 14 : NOUVEAU Sky AI integration customer (status + estimation)

**Metadonnees** : P0 | 6h | Depend de : 4.4.7

**But** : **NOUVEAU v3.0** -- Integration Sky AI (Sprint 15) cote customer : status risque + estimation cout/duree sinistre + recommendation Sprint 26.5.

**Actions principales attendues** :
- Composant `SkyAiScoreWidget` dashboard customer (score risque + couleur indicator green/orange/red)
- Composant `SkyAiEstimationCard` page sinistre detail (cout estime + duree estimee + confidence %)
- Hook `useSkyAiCustomer(customerId)` fetch Sprint 15 service
- Hook `useSkyAiEstimation(sinistreId)` fetch Sprint 15 estimation
- Service `customer-sky-ai.service.ts` (API) -- forward calls a Sprint 15 service
- Affichage transparent confidence < 70% (avertir customer)
- Permissions `customer.sky_ai.view`
- Tests 6+ : score render + estimation display + low confidence warning + GDPR explanation (loi 09-08 article 22 "right to explanation IA")

**Criteres P0** :
- V1 (P0) : SkyAiScoreWidget dashboard
- V2 (P0) : SkyAiEstimationCard sinistre page
- V3 (P0) : Low confidence warning visible
- V4 (P0) : GDPR explanation IA (article 22 loi 09-08)
- V5 (P0) : Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-17): NOUVEAU sky ai integration customer score + estimation + explanation

Task: 4.4.8
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: sprint 15 sky ai integration + gdpr article 22"
```

---

### Tache 9 / 14 : Paiements primes + factures + history

**Metadonnees** : P0 | 5h | Depend de : 4.4.8

**But** : Page `/paiements` history + factures + paiement carte (CMI Sprint 11) + abonnement automatique (RIB SEPA Maroc).

**Actions principales attendues** :
- Page `/paiements` history paiements + filtres (status / date / police)
- Page `/paiements/factures` download PDF factures conformes DGI (TVA 10%)
- Page `/paiements/payer/[id]` workflow paiement carte CMI (Sprint 11)
- Page `/paiements/abonnement` setup RIB SEPA Maroc auto-debit
- Hook `usePaiementsHistory()` + `useFactures()` + `usePaiementCb(invoiceId)`
- Permissions `customer.paiements.view` + `customer.paiements.pay`
- Tests 6+

**Criteres P0** : V1 History + factures DGI / V2 Paiement CMI / V3 RIB SEPA / V4 Permissions / V5 Tests 6+

**Commit** : `feat(sprint-17): paiements primes + factures + history + cmi + sepa` (Task: 4.4.9)

---

### Tache 10 / 14 : Documents personnels (download + sharing)

**Metadonnees** : P0 | 3h | Depend de : 4.4.9

**But** : Page `/documents` lecture-seule + download S3 signed URL (1h expiration) + sharing avec lien temporaire.

**Actions principales attendues** :
- Page `/documents` liste documents (polices PDF + attestations + rapports expert + factures)
- Filtres par type + date + police + sinistre
- Download S3 signed URL 1h expiration
- Sharing lien temporaire 7 jours expiration (`/share/[token]`)
- Permissions `customer.documents.view` + `customer.documents.share`
- Tests 4+

**Commit** : `feat(sprint-17): documents personnels download + sharing temporaire` (Task: 4.4.10)

---

### Tache 11 / 14 : Profile + preferences + multilingue switching

**Metadonnees** : P0 | 4h | Depend de : 4.4.10

**But** : Page `/profile` profile update + preferences notifications (Sprint 9 v3.0 user prefs) + multilingue switching + delete account (CNDP loi 09-08 article 22).

**Actions principales attendues** :
- Page `/profile` Tabs : Info personnelles + Preferences notifications + Securite + Langue + Suppression compte
- Tab Info : Nom + Telephone + Email + Adresse (KYC update)
- Tab Preferences : WhatsApp/Email/Push/SMS toggles (heritage Sprint 9 user prefs)
- Tab Securite : Change password + 2FA setup + sessions actives
- Tab Langue : 4 langues switcher + impact i18n direct
- Tab Suppression : RGPD compliance (loi 09-08 article 22 droit a l'oubli) + workflow 30 jours grace period
- Hook `useCustomerProfile()` + `useUpdatePreferences()` + `useDeleteAccount()`
- Permissions `customer.profile.view` + `customer.profile.update` + `customer.profile.delete`
- Tests 8+ : update profile + change langue + delete workflow + RGPD

**Criteres P0** :
- V1 (P0) : 5 tabs Profile fonctionnels
- V2 (P0) : Delete account RGPD workflow 30 jours
- V3 (P0) : Multilingue switching persiste
- V4 (P0) : Tests 8+

**Commit** : `feat(sprint-17): profile + preferences notifications + multilingue + rgpd delete` (Task: 4.4.11)

---

### Tache 12 / 14 : NOUVEAU Feedback + ratings + support tickets

**Metadonnees** : P0 | 4h | Depend de : 4.4.11

**But** : **NOUVEAU v3.0** -- Page `/feedback` ratings sinistres resolus + support tickets + chat live (Sprint 31 Agent Sky deferred).

**Actions principales attendues** :
- Page `/feedback` ratings sinistres resolus (1-5 stars + commentaire 500 chars)
- Page `/support` tickets ouverts + history + bouton "Nouveau ticket"
- Page `/support/nouveau` workflow ticket (categorie + description + photos optional)
- Page `/support/[id]` detail ticket + threading messages support
- Chat live widget (placeholder Sprint 31 Agent Sky)
- Service `customer-feedback.service.ts` + `customer-support.service.ts`
- Permissions `customer.feedback.submit` + `customer.support.create_ticket`
- Tests 6+

**Commit** : `feat(sprint-17): NOUVEAU feedback ratings + support tickets + chat live placeholder` (Task: 4.4.12)

---

### Tache 13 / 14 : NOUVEAU WhatsApp scope strict customer (8 templates)

**Metadonnees** : P0 | 3h | Depend de : 4.4.12

**But** : **NOUVEAU v3.0** -- Integration Sprint 9 v3.0 customer-side : 8 templates whitelist customer + UI preferences + opt-out CNDP.

**8 templates Customer whitelist** (Sprint 9 STATUS_ONLY_TEMPLATES.customer) :
1. `customer_fnol_received` -- "Declaration recue"
2. `customer_repair_started` -- "Reparation commencee"
3. `customer_repair_ready_for_delivery` -- "Vehicule pret"
4. `customer_payment_received` -- "Paiement recu"
5. `customer_policy_renewal_j30` -- "Renouvellement J-30"
6. `customer_policy_renewal_j7` -- "Renouvellement J-7"
7. `customer_milestone_update` -- "Avancement sinistre"
8. `customer_assure_declared_fnol` -- "Assure a declare sinistre" (cas B2B)

**Actions principales attendues** :
- Composant `WhatsAppPreferences` dans Tab Preferences (Sprint 17 Tache 11)
- Toggle "Activer WhatsApp" + Toggle "Recevoir mises a jour milestones"
- Lien public opt-out `/optout?token=xxx` (no auth -- CNDP loi 09-08 obligation)
- Endpoint `POST /api/v1/customer/whatsapp/preferences` (Sprint 9 user prefs reuse)
- Hook `useWhatsappPreferences()`
- Permissions `customer.notifications.manage`
- Tests 4+

**Commit** : `feat(sprint-17): NOUVEAU whatsapp scope strict customer + 8 templates + opt-out cndp` (Task: 4.4.13)

---

### Tache 14 / 14 : Tests E2E 40+ + seeds 20 customers + accessibility WCAG 2.1 AA

**Metadonnees** : P0 | 12h | Depend de : 4.4.13

**But** : Tests E2E exhaustifs Playwright 40+ scenarios + seeds 20 customers realistic (4 personas Maroc) + accessibility WCAG 2.1 AA + Lighthouse audit + EAS-style build production.

**Tests E2E categories** :
1. Auth + onboarding 3 etapes (5+ scenarios)
2. Dashboard + widgets (4+ scenarios)
3. Polices souscription + renewal (6+ scenarios)
4. FNOL wizard 6 etapes (8+ scenarios)
5. Tracking SSE 12 milestones (5+ scenarios)
6. Sky AI integration (3+ scenarios)
7. Paiements CMI + factures (4+ scenarios)
8. Documents download + sharing (3+ scenarios)
9. Profile + multilingue switching (4+ scenarios)
10. WhatsApp preferences + opt-out (3+ scenarios)

**Seeds 20 customers (4 personas Maroc)** :
- **5 Casa B2C particuliers** : 25-65 ans + assurance auto + maison
- **5 Rabat fonctionnaires** : 35-55 ans + assurance vie + sante
- **5 Marrakech entrepreneurs** : 30-50 ans + assurance multirisque + responsabilite civile
- **5 Tanger B2B PME** : DAF entreprises 10-50 employes + flotte automobile

**Accessibility WCAG 2.1 AA** : audit axe-core + pa11y + screen reader VoiceOver tests + keyboard navigation 100%

**Lighthouse targets** : Performance >= 85 / Accessibility >= 95 / Best Practices >= 90 / SEO >= 90 / PWA >= 90

**Coverage Sprint 17** >= 85%.

**Actions principales attendues** :
- 40+ tests Playwright E2E categories
- Seeds 20 customers via API seeds script
- Audit accessibility WCAG 2.1 AA report
- Lighthouse audit production build
- Build production `pnpm build` + verify bundle size < 500 KB initial + lazy load chunks

**Commit Conventional Commits** :
```bash
git commit -m "test(sprint-17): tests e2e 40+ + seeds 20 customers + accessibility wcag + lighthouse

- 40+ tests Playwright E2E (10 categories)
- Seeds 20 customers 4 personas Maroc
- Accessibility WCAG 2.1 AA audit
- Lighthouse Perf 85 / A11y 95 / SEO 90 / PWA 90
- Coverage >= 85%
- Build production < 500KB initial

Task: 4.4.14
Sprint: 17 (Phase 4 / Sprint 4)"
```

---

## VERIFICATION DU SPRINT 17

Apres execution des 14 taches, lancer **automatiquement** :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md
```

Le script bash auto-reparation V-17 :
- Verifie **85+ criteres** : 14 taches (~65 criteres) + 12 transversaux + 6 specifiques (Lighthouse + Accessibility + PWA + SEO + SSE + Sky AI)
- Production rapport `sprint17-verify-report.md` avec score % + jalon GO/CONDITIONNEL/NO-GO

**Decision matrix** :
- **Score >= 90%** -> GO : tag `sprint-17-complete-v3-customer-portal` + deploiement progressif
- **Score 80-90%** -> GO CONDITIONNEL : dette technique + Sprint 18 demarre parallele
- **Score < 80%** -> NO-GO : escalation + Sprint 18 reste bloque

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 17 v3.0]
   |
   v
[Tache 4.4.1 : Bootstrap Next.js 14 + PWA + Sofidemy + i18n]
   |  5h
   v
[Tache 4.4.2 : Auth customer + onboarding 3 etapes + KYC + OTP]
   |  5h
   v
[Tache 4.4.3 : Dashboard customer 4 widgets]
   |  4h
   v
[Tache 4.4.4 : Polices + souscription wizard + renewal]
   |  6h
   v
[Tache 4.4.5 : NOUVEAU FNOL wizard 6 etapes + Sprint 24 trigger]
   |  8h
   v
[Tache 4.4.6 : Sinistres list + filters]
   |  4h
   v
[Tache 4.4.7 : REFONDU Tracking SSE 12 milestones]
   |  6h
   v
[Tache 4.4.8 : NOUVEAU Sky AI integration]
   |  6h
   v
[Tache 4.4.9 : Paiements primes + factures + CMI]
   |  5h
   v
[Tache 4.4.10 : Documents personnels download + sharing]
   |  3h
   v
[Tache 4.4.11 : Profile + preferences + multilingue + RGPD]
   |  4h
   v
[Tache 4.4.12 : NOUVEAU Feedback + support tickets]
   |  4h
   v
[Tache 4.4.13 : NOUVEAU WhatsApp scope strict customer]
   |  3h
   v
[Tache 4.4.14 : Tests E2E 40+ + seeds 20 + accessibility + Lighthouse]
   |  12h
   v
[V-17 verification automatique]
   |
   v
[Score >= 90%] -> GO -> tag sprint-17-complete-v3-customer-portal
                 -> Sprint 18 (Assure Mobile) peut demarrer
```

**Duree totale** : ~75 heures / 1.5 semaines
**Coverage cible** : >= 85% standard
**Modules livres** : `apps/web-customer-portal` (NOUVEAU Next.js 14 PWA), `apps/api/src/modules/customer/`

**Apport principal** : Customer Portal Backoffice acteur 4 ecosystem 6 acteurs + FNOL declaration + Tracking SSE real-time + Sky AI integration + WhatsApp scope strict customer

**Sprint suivant** : Sprint 18 Assure Mobile App (acteur 5 distinct Customer).

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 16 + Sprint 7.5a permissions
```bash
# Verifier Sprint 16 GO (Broker ERP backoffice prerequis)
grep '^Statut.*GO' skalean-insurtech/sprint16-verify-report.md

# Verifier permissions customer.* Sprint 7.5a
grep "customer\." repo/packages/auth/src/permissions/customer.permissions.ts | wc -l
# Attendu: >= 17 permissions customer.* (decision-007)

# Verifier Sprint 9 v3.0 GO (Comm module)
grep '^Statut.*GO' skalean-insurtech/sprint09-verify-report.md
# Critique : sans Sprint 9 v3.0, WhatsApp scope strict customer impossible
```

### Lancement Sprint 17 (Cowork lit cet orchestrateur)
```bash
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-17-sprint-17-customer-portal-v3.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-17-sprint-17-customer-portal-v3.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md \
  --branch sprint-17-customer-portal-v3
```

### Suivi temps reel execution
```bash
# Logs dev server
cd repo/apps/web-customer-portal && pnpm dev

# Progress commits Sprint 17
git log --oneline --since="2 weeks ago" -- repo/apps/web-customer-portal | grep "Sprint: 17"
# Attendu: 14 commits (1 par tache)

# Test manuel FNOL wizard dev
open http://localhost:3000/fr/sinistres/nouveau
```

### Apres completion -- verifier rapport
```bash
cat skalean-insurtech/sprint17-verify-report.md

# Si GO, tag + push
git tag -a "sprint-17-complete-v3-customer-portal" -m "Sprint 17 v3.0 Customer Portal complete

- Next.js 14 PWA + theme Sofidemy + 4 langues
- Auth customer + onboarding 3 etapes + KYC + OTP
- Dashboard customer 4 widgets
- Polices souscription + renewal
- FNOL wizard 6 etapes + Sprint 24 trigger
- Sinistres list + filters
- Tracking SSE 12 milestones real-time
- Sky AI integration + estimation + GDPR explanation
- Paiements CMI + factures DGI + SEPA
- Documents download + sharing temporaire
- Profile + RGPD delete + multilingue
- Feedback + support tickets
- WhatsApp scope strict customer 8 templates
- 40+ tests E2E + seeds 20 customers
- Accessibility WCAG 2.1 AA + Lighthouse Perf 85+"

git push origin sprint-17-complete-v3-customer-portal
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire B-17 v3.0 complet (816 lignes)** AVANT generation prompts -- patterns FNOL wizard + SSE tracking + Sky AI integration + WhatsApp scope strict sont detailles dedans
2. **Customer != Assure** : Sprint 17 web Customer Portal souscripteur. Sprint 18 mobile Assure App personne assuree. Distinction critique decision-012
3. **Sprint 9 v3.0 prerequis** : WhatsApp scope strict customer (Tache 4.4.13) depend Sprint 9 v3.0 STATUS_ONLY_TEMPLATES.customer (8 templates)
4. **Sprint 24 trigger** : FNOL wizard (Tache 4.4.5) MUST trigger Kafka event `insurtech.events.repair` pour Sprint 24 master orchestrator
5. **PWA installable** : manifest.json + service worker + icons obligatoires Lighthouse PWA score > 90
6. **WCAG 2.1 AA** : accessibility audit obligatoire (Tache 4.4.14) -- screen readers + keyboard navigation
7. **Lighthouse targets** : Performance >= 85 / Accessibility >= 95 / SEO >= 90 / PWA >= 90
8. **RGPD delete account** : loi 09-08 article 22 droit a l'oubli -- workflow 30 jours grace period obligatoire (Tache 4.4.11)
9. **Sky AI explanation** : loi 09-08 article 22 droit a explication IA -- afficher confidence + algorithme summary (Tache 4.4.8)
10. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/
11. **Tenant isolation** : tous services API prennent `tenantId` parametre (multi-tenant Sprint 6)
12. **Mobile-first** : breakpoints 320/768/1024/1280/1536 -- Sprint 17 sert aussi tablette + desktop responsive

---

**Fin orchestrateur C-17 v3.0 -- Sprint 17 (4.4) Customer Portal Backoffice (acteur 4 ecosystem 6 acteurs).**

**Total taches** : 14 (10 v2.2 adaptees + 4 v3.0 nouvelles : FNOL + Tracking SSE + Sky AI + WhatsApp customer)
**Effort** : ~75h
**Apport** : Customer Portal Backoffice + FNOL + Tracking real-time + Sky AI estimation + WhatsApp scope strict
