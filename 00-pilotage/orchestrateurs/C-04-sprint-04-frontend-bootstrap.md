# ORCHESTRATEUR SPRINT 4 -- Phase 1 / Sprint 4 : Frontend Bootstrap (8 apps Next.js)
# 16 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 1 -- Bootstrap Infrastructure
**Sprint** : 4 / 35 (cumul) -- Sprint 4 dans Phase 1
**Reference meta-prompt** : `B-04-sprint-04-frontend-bootstrap.md`
**Reference verification** : `V-04-sprint-04-verification.md`
**Numerotation taches** : 1.4.1 a 1.4.16
**Effort total** : ~90 heures developpement / 2 semaines
**Apport metier** : 8 apps Next.js demarrent + 5 packages shared + i18n + PWA

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 16 taches** du Sprint 4 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-04** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-04 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 4

Sprint 4 (1.4) -- Frontend Bootstrap (8 apps Next.js). Voir B-04-sprint-04-frontend-bootstrap.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/
  task-1.4.1-prompt.md       # web-broker Bootstrap (Port 3001)
  task-1.4.2-prompt.md       # web-garage Bootstrap (Port 3002)
  task-1.4.3-prompt.md       # web-garage-mobile Bootstrap (Port 3003 -- PWA)
  task-1.4.4-prompt.md       # web-insurtech-admin Bootstrap (Port 3000)
  task-1.4.5-prompt.md       # web-customer-portal Bootstrap (Port 3004 -- NEW v2.0 SSG + ISR + SEO)
  task-1.4.6-prompt.md       # web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)
  task-1.4.7-prompt.md       # web-assure-mobile Bootstrap (Port 3006 -- NEW v2.0 PWA)
  task-1.4.8-prompt.md       # Package shared-ui : Theme + 30+ Composants shadcn
  task-1.4.9-prompt.md       # Package shared-pwa : Hooks PWA Install/Offline/SW (NEW v2.0)
  task-1.4.10-prompt.md       # Package shared-maps : Wrapper Mapbox GL JS (NEW v2.0)
  task-1.4.11-prompt.md       # Multilingue next-intl 8 Apps + RTL
  task-1.4.12-prompt.md       # Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel)
  task-1.4.13-prompt.md       # Generation Client API TypeScript depuis OpenAPI
  task-1.4.14-prompt.md       # Layouts Partages (Sidebar + Topbar) Par Type App
  task-1.4.15-prompt.md       # Pages Placeholder + 404/500
  task-1.4.16-prompt.md       # Tests E2E + Lighthouse Baseline + Storybook (P1)
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-04-sprint-04-verification.md
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
4. La verification finale V-04 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 16 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-04-sprint-04-verification.md
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

## CONTEXTE PHASE 1 -- Bootstrap Infrastructure

### Position du Sprint 4 dans la Phase 1

Sprint 4 (1.4) -- **Frontend Bootstrap (8 apps Next.js)**.

Voir `B-04-sprint-04-frontend-bootstrap.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

### Apport metier de ce sprint

8 apps Next.js demarrent + 5 packages shared + i18n + PWA

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-04 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 16 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-04, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-04.

---

### Tache 1 / 16 : web-broker Bootstrap (Port 3001)

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 3

**But** : Initialiser l'app `web-broker` (utilisee par cabinet courtier : commerciaux, broker_admin) sur port 3001 avec Next.js 15 App Router, multilingue, theme Skalean.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.1-prompt.md
```

**Actions principales attendues** :
- `repo/apps/web-broker/package.json` enrichi (deps : next, react, next-intl, @tanstack/react-query, axios, etc.)
- `repo/apps/web-broker/next.config.mjs` configure : i18n routing, images domains (S3 buckets dev + prod), experimental.serverActions
- `repo/apps/web-broker/tsconfig.json` extends base + paths `@/*` -> `./src/*`
- `repo/apps/web-broker/tailwind.config.ts` extends `@insurtech/shared-ui/tailwind-preset`
- `repo/apps/web-broker/src/app/[locale]/layout.tsx` -- root layout avec NextIntlClientProvider + ReactQueryProvider + theme ThemeProvider
- `repo/apps/web-broker/src/app/[locale]/page.tsx` -- landing placeholder (sera dashboard Sprint 17)

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/package.json`
  - `repo/apps/web-broker/next.config.mjs`
  - `repo/apps/web-broker/tsconfig.json`
  - `repo/apps/web-broker/tailwind.config.ts`
  - `repo/apps/web-broker/src/app/[locale]/layout.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm --filter @insurtech/web-broker dev` demarre port 3001
  - V2 (P0) : `http://localhost:3001/fr` accessible, theme Skalean visible
  - V3 (P0) : `http://localhost:3001/ar` retourne page RTL

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
git commit -m "feat(sprint-04): web-broker bootstrap (port 3001)

Task: 1.4.1
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.1"
```

---

### Tache 2 / 16 : web-garage Bootstrap (Port 3002)

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.4.1

**But** : Initialiser app `web-garage` (utilisee par garage_chef + comptable + commercial garage) sur port 3002. Reutilise patterns Tache 1.4.1.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.2-prompt.md
```

**Actions principales attendues** :
- Meme structure que web-broker (layout, middleware, providers) en differenciant content
- Theme variant : ajout d'accent visuel garage (icone outil dans logo)
- Messages : focus vocabulaire garage (sinistre, devis, atelier, technicien)
- `next.config.mjs` similaire avec port specifique
- Demarrage `pnpm dev` sur port 3002
- Pages placeholder operationnelles avec navigation 3 locales

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/`
  - `package.json + next.config.mjs (port 3002)`
  - `src/app/[locale]/layout.tsx`
  - `src/app/[locale]/page.tsx`
  - `src/lib/api-client.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demarre port 3002
  - V2 (P0) : 3 locales accessibles
  - V3 (P0) : Theme Skalean variant garage applique

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
git commit -m "feat(sprint-04): web-garage bootstrap (port 3002)

Task: 1.4.2
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.2"
```

---

### Tache 3 / 16 : web-garage-mobile Bootstrap (Port 3003 -- PWA)

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.4.2

**But** : App **PWA** pour technicien garage en atelier (port 3003) avec service worker, offline support, install prompt, notifications push (Sprint 9 enrichira).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.3-prompt.md
```

**Actions principales attendues** :
- Bootstrap similaire web-broker
- PWA configure via `next-pwa` ou Workbox custom (depend choix Tache 1.4.9)
- `public/manifest.webmanifest` : name, short_name, theme_color (#E95D2C Skalean Orange), background_color, icons (192, 512), start_url, scope, display: 'standalone', orientation: 'portrait'
- Service worker configure (precache + runtime cache)
- Strategie offline : NetworkFirst pour API, CacheFirst pour assets statiques, StaleWhileRevalidate pour images
- Install prompt customise (hook `useInstallPrompt` depuis `shared-pwa`)

**Fichiers cibles principaux** :
  - `repo/apps/web-garage-mobile/`
  - `package.json + next.config.mjs (port 3003 + PWA config)`
  - `public/manifest.webmanifest`
  - `public/icons/ (192, 512, maskable)`
  - `public/sw.js (genere par next-pwa ou custom)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demarre port 3003
  - V2 (P0) : Manifest valide (chrome://manifest)
  - V3 (P0) : Service worker enregistre (DevTools > Application > Service Workers)

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
git commit -m "feat(sprint-04): web-garage-mobile bootstrap (port 3003 -- pwa)

Task: 1.4.3
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.3"
```

---

### Tache 4 / 16 : web-insurtech-admin Bootstrap (Port 3000)

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.4.3

**But** : App SuperAdmin platform (port 3000) pour Skalean Inc. -- gestion tenants, monitoring, reports cross-tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.4-prompt.md
```

**Actions principales attendues** :
- Bootstrap similaire avec port 3000
- Theme variant admin : couleur primary plus institutionelle (Navy #1A2730 dominant vs Orange #E95D2C secondaire)
- Layout differencie : sidebar admin avec sections "Tenants", "Monitoring", "Reports", "Compliance"
- Auth gate strict (Sprint 5 implementera : verifier role super_admin_platform avant rendre layout)
- Pages placeholder : `/dashboard` (overview), `/tenants` (Sprint 28), `/reports` (Sprint 29)
- Locale defaut FR (admin Skalean Maroc -- pas de localisation arabe necessaire mais possible)

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/`
  - `package.json + next.config.mjs (port 3000)`
  - `src/app/[locale]/layout.tsx (sidebar admin)`
  - `src/app/[locale]/dashboard/page.tsx`
  - `src/app/[locale]/tenants/page.tsx (placeholder)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demarre port 3000
  - V2 (P0) : Theme admin variant (Navy dominant) applique
  - V3 (P0) : Sidebar admin avec sections placeholder

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
git commit -m "feat(sprint-04): web-insurtech-admin bootstrap (port 3000)

Task: 1.4.4
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.4"
```

---

### Tache 5 / 16 : web-customer-portal Bootstrap (Port 3004 -- NEW v2.0 SSG + ISR + SEO)

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.4.4

**But** : App publique SEO (port 3004) -- site marketing + comparateur assurance + souscription en ligne. Cible : prospects / assures futurs.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.5-prompt.md
```

**Actions principales attendues** :
- Bootstrap avec port 3004
- Configuration **SSG** : pages statiques `/about`, `/products`, `/contact` build-time
- Configuration **ISR** : pages produits `/products/[slug]` revalidate every 1 hour (`revalidate: 3600`)
- **Sitemap.xml** auto-genere via `next-sitemap` ou custom
- **robots.txt** configure (allow all, except `/admin/*`, `/api/*`)
- **Open Graph tags** + Twitter Card metadata sur chaque page

**Fichiers cibles principaux** :
  - `repo/apps/web-customer-portal/`
  - `package.json + next.config.mjs (port 3004 + ISR config)`
  - `next-sitemap.config.js (sitemap.xml generation)`
  - `public/robots.txt`
  - `src/app/[locale]/layout.tsx (header + footer marketing)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demarre port 3004
  - V2 (P0) : SSG : `pnpm build` genere pages statiques
  - V3 (P0) : ISR configure (`revalidate: 3600`)

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
git commit -m "feat(sprint-04): web-customer-portal bootstrap (port 3004 -- new v2.0 ssg + isr + 

Task: 1.4.5
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.5"
```

---

### Tache 6 / 16 : web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.4.5

**But** : Self-service portail assure (port 3005) -- voir polices, declarer sinistre, paiement, profil.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.6-prompt.md
```

**Actions principales attendues** :
- Bootstrap avec port 3005
- Theme variant assure : palette plus douce (Sky Blue #B0CEE2 dominant pour reassurer assure)
- Layout self-service : topbar simple + content centre (pas de sidebar dense)
- Pages placeholder :
- Auth gate (Sprint 5 implementera : redirect si pas auth, check role assure_user)
- Build prod reussit

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demarre port 3005
  - V2 (P0) : Theme variant assure (Sky Blue dominant)
  - V3 (P0) : Pages placeholder accessibles

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
git commit -m "feat(sprint-04): web-assure-portal bootstrap (port 3005 -- new v2.0)

Task: 1.4.6
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.6"
```

---

### Tache 7 / 16 : web-assure-mobile Bootstrap (Port 3006 -- NEW v2.0 PWA)

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.4.6

**But** : App PWA mobile dediee assure pour **declarer un sinistre depuis le smartphone** (port 3006). Workflow optimise mobile-first : photos, geolocation, signature.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.7-prompt.md
```

**Actions principales attendues** :
- Bootstrap PWA similaire web-garage-mobile (Tache 1.4.3) avec port 3006
- Manifest.webmanifest avec theme assure (Sky Blue + Orange accent)
- Service worker offline : declaration sinistre offline-first (Sprint 25 implementera Pouchdb sync)
- Permissions navigator : Camera (photos), Geolocation (lieu accident)
- Pages placeholder :
- Theme color #2D5773 (ACAPS Teal) status bar (rappelle conformite)

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-mobile/`
  - `package.json + next.config.mjs (port 3006 + PWA config)`
  - `public/manifest.webmanifest (theme assure)`
  - `public/icons/ (192, 512, maskable)`
  - `src/app/[locale]/layout.tsx (mobile-first layout)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Demarre port 3006
  - V2 (P0) : Manifest valide
  - V3 (P0) : Service worker enregistre

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
git commit -m "feat(sprint-04): web-assure-mobile bootstrap (port 3006 -- new v2.0 pwa)

Task: 1.4.7
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.7"
```

---

### Tache 8 / 16 : Package shared-ui : Theme + 30+ Composants shadcn

**Metadonnees** : P0 | 8h | Depend de : Depend de 1.4.7

**But** : Package `@insurtech/shared-ui` exposant theme Skalean Sofidemy + 30+ composants shadcn/ui personnalises + Tailwind preset partage.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.8-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/shared-ui/` setup
- `tailwind-preset.ts` exporte preset Tailwind avec theme Skalean (extends config Tailwind 4)
- Variables CSS theme : `--color-primary` (Orange), `--color-secondary` (Navy), `--color-accent` (Sky Blue), `--color-acaps` (Teal), font-family Montserrat
- Mode dark configure (CSS variables `:root[data-theme="dark"]`)
- Mode RTL : utilities Tailwind `rtl:*` configurees
- **30+ composants shadcn/ui customises** :

**Fichiers cibles principaux** :
  - `repo/packages/shared-ui/`
  - `package.json + tsconfig.json`
  - `src/index.ts (re-exports)`
  - `src/styles/theme.css (CSS variables)`
  - `src/styles/fonts.css (Montserrat + Noto Naskh Arabic)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Package build reussit
  - V2 (P0) : Tailwind preset utilisable depuis 8 apps
  - V3 (P0) : Theme CSS variables Skalean appliquees

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
git commit -m "feat(sprint-04): package shared-ui : theme + 30+ composants shadcn

Task: 1.4.8
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.8"
```

---

### Tache 9 / 16 : Package shared-pwa : Hooks PWA Install/Offline/SW (NEW v2.0)

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.4.8

**But** : Package `@insurtech/shared-pwa` exposant hooks reutilisables pour les 2 apps PWA (web-garage-mobile + web-assure-mobile).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.9-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/shared-pwa/` setup
- Hook `useInstallPrompt()` -- expose `{ canInstall, prompt, dismiss }` capture event `beforeinstallprompt`
- Hook `useOnlineStatus()` -- retourne `{ isOnline }` ecoute `online`/`offline` events
- Hook `useServiceWorker()` -- expose `{ registration, update, status }` (idle/installing/installed/activating/active)
- Hook `usePushSubscription()` -- gere abonnement push notification (Sprint 9 enrichira)
- Helper `registerServiceWorker(swPath)` -- enregistre SW + ecoute updates

**Fichiers cibles principaux** :
  - `repo/packages/shared-pwa/`
  - `package.json + tsconfig.json`
  - `src/index.ts`
  - `src/hooks/useInstallPrompt.ts (~60 lignes)`
  - `src/hooks/useOnlineStatus.ts (~30 lignes)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Package build reussit
  - V2 (P0) : `useInstallPrompt()` utilisable, retourne `canInstall: true` apres event capture
  - V3 (P0) : `useOnlineStatus()` retourne online/offline correct

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
git commit -m "feat(sprint-04): package shared-pwa : hooks pwa install/offline/sw (new v2.0)

Task: 1.4.9
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.9"
```

---

### Tache 10 / 16 : Package shared-maps : Wrapper Mapbox GL JS (NEW v2.0)

**Metadonnees** : P0 | 5h | Depend de : Depend de 1.4.9

**But** : Package `@insurtech/shared-maps` wrapping Mapbox GL JS pour cartes interactives (geolocation sinistres Sprint 25, recherche garages Sprint 8 booking, etc.).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.10-prompt.md
```

**Actions principales attendues** :
- Package `repo/packages/shared-maps/` setup
- Component `<Map>` React wrapper Mapbox GL JS
- Component `<Marker>` -- marker simple
- Component `<MarkerCluster>` -- clustering pour grandes listes
- Component `<UserLocationMarker>` -- position user via Geolocation API
- Component `<SearchBox>` -- autocomplete adresse via Mapbox Geocoding API

**Fichiers cibles principaux** :
  - `repo/packages/shared-maps/`
  - `package.json + tsconfig.json`
  - `src/index.ts`
  - `src/components/Map.tsx (~80 lignes)`
  - `src/components/Marker.tsx (~40 lignes)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Package build reussit
  - V2 (P0) : `<Map>` rendable avec center default Casablanca
  - V3 (P0) : `<Marker>` ajoute marker

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
git commit -m "feat(sprint-04): package shared-maps : wrapper mapbox gl js (new v2.0)

Task: 1.4.10
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.10"
```

---

### Tache 11 / 16 : Multilingue next-intl 8 Apps + RTL

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.4.10

**But** : Configuration multilingue uniforme pour les 8 apps : 3 locales (`fr`, `ar-MA`, `ar`) avec routing, detection, RTL pour `ar`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.11-prompt.md
```

**Actions principales attendues** :
- next-intl config commun dans `@insurtech/shared-ui` ou dossier `repo/i18n/` partage
- 3 locales : `fr` (default), `ar-MA` (Darija), `ar` (Arabe classique)
- Routing locale-prefixed : `/fr/dashboard`, `/ar-MA/dashboard`, `/ar/dashboard`
- Middleware next-intl detecte locale depuis : URL > cookie > Accept-Language header > default `fr`
- Direction auto : `dir="rtl"` sur `<html>` si locale `ar` ou `ar-MA`
- Tailwind RTL utilities actives (`rtl:flex-row-reverse`, etc.)

**Fichiers cibles principaux** :
  - `repo/packages/shared-ui/src/i18n/`
  - `routing.ts (locales, defaultLocale, pathnames)`
  - `request.ts (loadMessages depuis dossier app courant)`
  - `repo/apps/{8 apps}/src/middleware.ts`
  - `repo/apps/{8 apps}/src/i18n/request.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 locales accessibles sur les 8 apps : `/fr`, `/ar-MA`, `/ar`
  - V2 (P0) : `dir="rtl"` automatique sur `<html>` si ar
  - V3 (P0) : Middleware redirect `/dashboard` -> `/fr/dashboard`

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
git commit -m "feat(sprint-04): multilingue next-intl 8 apps + rtl

Task: 1.4.11
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.11"
```

---

### Tache 12 / 16 : Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel)

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.4.11

**But** : Optimiser la DX monorepo frontend : scripts orchestres pour demarrer 1 ou plusieurs apps, Turborepo cache build, format lint unifie.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.12-prompt.md
```

**Actions principales attendues** :
- Scripts root `package.json` :
- `turbo.json` enrichi : pipeline `dev` cache:false, `build` cache:true, depend de `^build`
- Variables env partage : fichier `.env.local` racine charge par toutes les apps
- Hot reload cross-package : modification dans `shared-ui` declenche reload des apps
- Build prod monorepo : `pnpm build:apps` sequentiel ou parallel selon Turbo config
- Doctor script : `pnpm doctor` verifie node version, pnpm version, docker up, env vars valides

**Fichiers cibles principaux** :
  - `repo/package.json`
  - `repo/turbo.json`
  - `repo/scripts/dev-portals.sh`
  - `repo/scripts/dev-all.sh`
  - `repo/scripts/doctor.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm dev:web-broker` demarre 1 app
  - V2 (P0) : `pnpm dev:portals` demarre 3 apps
  - V3 (P0) : Modification dans shared-ui hot-reload les 8 apps

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
git commit -m "feat(sprint-04): tooling monorepo frontend (turbo + scripts dev parallel)

Task: 1.4.12
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.12"
```

---

### Tache 13 / 16 : Generation Client API TypeScript depuis OpenAPI

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.4.12

**But** : Generer automatiquement un client TypeScript typed depuis le Swagger OpenAPI de l'API NestJS (Sprint 3) pour eviter drift types frontend/backend.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.13-prompt.md
```

**Actions principales attendues** :
- Setup `openapi-typescript` + `openapi-fetch` dans monorepo
- Script `pnpm generate:api-client` qui :
- Package `@insurtech/api-client` exposant client + types
- Hook React Query helpers : `useApiQuery()`, `useApiMutation()` typed
- Integration dans 8 apps : remplace direct axios calls par client typed
- Validation runtime via Zod schema (auto-derive depuis OpenAPI ou manual Sprint 5+)

**Fichiers cibles principaux** :
  - `repo/packages/api-client/`
  - `package.json + tsconfig.json`
  - `src/types.gen.ts (genere -- ~10000 lignes apres Sprint 5+)`
  - `src/client.ts (~50 lignes)`
  - `src/hooks/useApiQuery.ts (~40 lignes)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `pnpm generate:api-client` reussit
  - V2 (P0) : Types generes : test TypeScript autocomplete sur endpoint `/api/v1/auth/login`
  - V3 (P0) : Hook `useApiQuery` typed retourne data correctement

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
git commit -m "feat(sprint-04): generation client api typescript depuis openapi

Task: 1.4.13
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.13"
```

---

### Tache 14 / 16 : Layouts Partages (Sidebar + Topbar) Par Type App

**Metadonnees** : P0 | 6h | Depend de : Depend de 1.4.13

**But** : Layouts partages dans `shared-ui` adaptes par type d'app : dashboard (broker, garage, admin), self-service (assure-portal), mobile (garage-mobile, assure-mobile), public (customer-portal).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.14-prompt.md
```

**Actions principales attendues** :
- `<DashboardLayout>` avec Sidebar (collapsible) + Topbar + content area + Footer
- `<SelfServiceLayout>` topbar simple + content centre + footer minimal (sans sidebar)
- `<MobileLayout>` topbar minimal + bottom navigation tabs (4 tabs typique) + content + safe area iOS
- `<PublicLayout>` header marketing + content + footer marketing complet
- Components reutilisables :
- Responsive : tous layouts mobile-first, breakpoints tailwind (sm 640, md 768, lg 1024, xl 1280)

**Fichiers cibles principaux** :
  - `repo/packages/shared-ui/src/layouts/`
  - `DashboardLayout.tsx (~120 lignes)`
  - `SelfServiceLayout.tsx (~80 lignes)`
  - `MobileLayout.tsx (~100 lignes)`
  - `PublicLayout.tsx (~80 lignes)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `<DashboardLayout>` rendable avec sidebar + topbar
  - V2 (P0) : `<SelfServiceLayout>` rendable
  - V3 (P0) : `<MobileLayout>` rendable avec BottomTabs

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
git commit -m "feat(sprint-04): layouts partages (sidebar + topbar) par type app

Task: 1.4.14
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.14"
```

---

### Tache 15 / 16 : Pages Placeholder + 404/500

**Metadonnees** : P0 | 4h | Depend de : Depend de 1.4.14

**But** : Pages placeholder coherent dans 8 apps + pages erreur globales (404, 500) avec branding Skalean.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.15-prompt.md
```

**Actions principales attendues** :
- Page 404 : `repo/apps/{8 apps}/src/app/[locale]/not-found.tsx` -- branding Skalean + bouton "retour accueil"
- Page 500 : `repo/apps/{8 apps}/src/app/[locale]/error.tsx` -- error boundary App Router + display traceId pour support
- Page Loading : `repo/apps/{8 apps}/src/app/[locale]/loading.tsx` -- skeleton ou spinner Skalean
- Pages placeholder accessibles dans navigation sidebar avec marker "Sprint X" indiquant ou implementer
- Component `<UnderConstruction sprintNumber={X}>` reutilisable
- Pages 404 + 500 utilisent layout (PublicLayout pour customer-portal, autres avec layout default)

**Fichiers cibles principaux** :
  - `repo/apps/{8 apps}/src/app/[locale]/not-found.tsx`
  - `repo/apps/{8 apps}/src/app/[locale]/error.tsx`
  - `repo/apps/{8 apps}/src/app/[locale]/loading.tsx`
  - `repo/packages/shared-ui/src/components/UnderConstruction.tsx (~30 lignes)`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 404 page rendable + branded
  - V2 (P0) : 500 page error boundary fonctionnel (test : throw Error)
  - V3 (P0) : Loading page rendable

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
git commit -m "feat(sprint-04): pages placeholder + 404/500

Task: 1.4.15
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.15"
```

---

### Tache 16 / 16 : Tests E2E + Lighthouse Baseline + Storybook (P1)

**Metadonnees** :  |  | Depend de : --

**But** : Suite tests E2E Playwright validant les 8 apps demarrent + Lighthouse baseline + Storybook setup pour shared-ui.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.16-prompt.md
```

**Actions principales attendues** :
- `repo/e2e/web/{8 apps}.spec.ts` -- 1 spec par app
- Pour chaque app : test home page rendable, locale switcher fonctionne (fr/ar), 404 trigger fonctionne, theme dark/light toggle (si applicable)
- Test mobile-safari (iPhone 14) sur 2 PWA apps : install banner visible, offline mode OK
- Test chromium sur 6 desktop apps : layout responsive verifie 320px / 768px / 1280px
- Tous tests passent en CI
- `repo/scripts/lighthouse-baseline.ts` execute Lighthouse sur les 8 apps (audit chacune)

**Fichiers cibles principaux** :
  - `repo/e2e/web/web-broker.spec.ts`
  - `repo/e2e/web/web-garage.spec.ts`
  - `... (8 specs apps)`
  - `repo/e2e/mobile/web-garage-mobile.spec.ts`
  - `repo/e2e/mobile/web-assure-mobile.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 8 specs E2E desktop passent
  - V2 (P0) : 2 specs E2E mobile passent
  - V3 (P0) : Lighthouse baseline genere pour 8 apps

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
git commit -m "feat(sprint-04): tests e2e + lighthouse baseline + storybook (p1)

Task: 1.4.16
Sprint: 4 (Phase 1 / Sprint 4)
Phase: 1 -- Bootstrap Infrastructure
Decisions: see B-04 Tache 1.4.16"
```

---


## VERIFICATION DU SPRINT 4

Une fois les 16 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-04-sprint-04-verification.md
```

Le fichier de verification V-04 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint04-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint04-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint04-verify-report.md
git commit -m "chore(sprint-04): close sprint 4 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 1 (Bootstrap Infrastructure)
- Sprint : 4 (Phase 1 / Sprint 4)
- Apport : 8 apps Next.js demarrent + 5 packages shared + i18n + PWA
- Tests E2E cumules : {N}+

Sprint 4 completed -- handoff to Sprint 5."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 4]
   |
   v
[Tache 1.4.1: web-broker Bootstrap (Port 3001)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.2: web-garage Bootstrap (Port 3002)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.3: web-garage-mobile Bootstrap (Port 3003 -- PWA)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.4: web-insurtech-admin Bootstrap (Port 3000)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.5: web-customer-portal Bootstrap (Port 3004 -- NEW v2.0 SS]
   | -> compile -> tests -> commit
   v
[Tache 1.4.6: web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.7: web-assure-mobile Bootstrap (Port 3006 -- NEW v2.0 PWA)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.8: Package shared-ui : Theme + 30+ Composants shadcn]
   | -> compile -> tests -> commit
   v
[Tache 1.4.9: Package shared-pwa : Hooks PWA Install/Offline/SW (NEW ]
   | -> compile -> tests -> commit
   v
[Tache 1.4.10: Package shared-maps : Wrapper Mapbox GL JS (NEW v2.0)]
   | -> compile -> tests -> commit
   v
[Tache 1.4.11: Multilingue next-intl 8 Apps + RTL]
   | -> compile -> tests -> commit
   v
[Tache 1.4.12: Tooling Monorepo Frontend (Turbo + Scripts Dev Parallel]
   | -> compile -> tests -> commit
   v
[Tache 1.4.13: Generation Client API TypeScript depuis OpenAPI]
   | -> compile -> tests -> commit
   v
[Tache 1.4.14: Layouts Partages (Sidebar + Topbar) Par Type App]
   | -> compile -> tests -> commit
   v
[Tache 1.4.15: Pages Placeholder + 404/500]
   | -> compile -> tests -> commit
   v
[Tache 1.4.16: Tests E2E + Lighthouse Baseline + Storybook (P1)]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 4 -- V-04]
   |
   v
[Rapport sprint04-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 90 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/database, @insurtech/shared-config, @insurtech/shared-utils, infrastructure/docker, infrastructure/scripts

**Apport metier principal** : 8 apps Next.js demarrent + 5 packages shared + i18n + PWA.

**Prerequis Sprint 5** : Sprint 4 GO complet (score >= 95% verification automatique V-04).

**Sprint suivant** : Sprint 5.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 3 (verification GO)

```bash
# Verifier Sprint 3 GO
ls skalean-insurtech/sprint03-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint03-verify-report.md
```

### Lancement Sprint 4 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-04-sprint-04-frontend-bootstrap.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-04-sprint-04-frontend-bootstrap.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-04-sprint-04-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-04.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 4"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint04-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-04** complet avant generation prompts taches (contexte critique)
2. **Generer les 16 prompts taches** dans `00-pilotage/prompts-taches/sprint-04-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-04 v2.2 detaille -- Sprint 4 (1.4) Frontend Bootstrap (8 apps Next.js).**

**Total taches detaillees** : 16 | **Effort cumul** : ~90h | **Apport** : 8 apps Next.js demarrent + 5 packages shared + i18n + PWA
