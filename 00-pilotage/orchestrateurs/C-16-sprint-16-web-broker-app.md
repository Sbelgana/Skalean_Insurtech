# ORCHESTRATEUR SPRINT 16 -- Phase 4 / Sprint 3 : Web Broker App (port 3001)
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 16 / 35 (cumul) -- Sprint 3 dans Phase 4
**Reference meta-prompt** : `B-16-sprint-16-web-broker-app.md`
**Reference verification** : `V-16-sprint-16-verification.md`
**Numerotation taches** : 4.3.1 a 4.3.14
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : web-broker port 3001 production-ready

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 16 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-16** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-16 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 16

Sprint 16 (4.3) -- Web Broker App (port 3001). Voir B-16-sprint-16-web-broker-app.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/
  task-4.3.1-prompt.md       # App Skeleton + Layouts + Middleware Auth
  task-4.3.2-prompt.md       # Pages Auth : Login + MFA + Signup + Recovery
  task-4.3.3-prompt.md       # Layout Principal + Sidebar + Topbar + Tenant Switcher
  task-4.3.4-prompt.md       # Dashboard Page : 6 Widgets
  task-4.3.5-prompt.md       # Contacts Page : List + Filters + Detail Timeline
  task-4.3.6-prompt.md       # Companies Page
  task-4.3.7-prompt.md       # Deals Page : Kanban + Table
  task-4.3.8-prompt.md       # Polices Page : List + Detail Avec Premiums
  task-4.3.9-prompt.md       # Broker Queue Page : Pending Dossiers + Validate/Reject
  task-4.3.10-prompt.md       # Sinistres Page Read-Only (M9 Courtier Sans Intervention)
  task-4.3.11-prompt.md       # Parametres + Profile Pages
  task-4.3.12-prompt.md       # RBAC UI : Conditional Rendering Per Role
  task-4.3.13-prompt.md       # I18n Complete : fr / ar-MA / ar + RTL
  task-4.3.14-prompt.md       # Tests E2E Playwright (20+) + Accessibility
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-16-sprint-16-verification.md
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
4. La verification finale V-16 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-16-sprint-16-verification.md
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

### Position du Sprint 3 dans la Phase 4

Sprint 16 (4.3) -- **Web Broker App (port 3001)**.

Voir `B-16-sprint-16-web-broker-app.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

### Apport metier de ce sprint

web-broker port 3001 production-ready

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-16 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-16, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-16.

---

### Tache 1 / 14 : App Skeleton + Layouts + Middleware Auth

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 7

**But** : Initialiser app `web-broker` Next.js 15 App Router avec structure complete : layouts (root + protected + auth), middleware auth + tenant context, i18n setup, providers (TanStack Query + theme + toasts).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.1-prompt.md
```

**Actions principales attendues** :
- Folder `repo/apps/web-broker/` setup (extends Sprint 4 skeleton si deja init)
- Files : `app/layout.tsx` (root), `app/(auth)/layout.tsx`, `app/(protected)/layout.tsx`
- Middleware `middleware.ts` :
- Providers `app/providers.tsx` :
- I18n setup : `next-intl` ou Next.js native -- 3 locales fr / ar-MA / ar
- Folder structure `app/[locale]/(auth)/...` et `app/[locale]/(protected)/...`

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/layout.tsx`
  - `repo/apps/web-broker/app/[locale]/(auth)/layout.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/layout.tsx`
  - `repo/apps/web-broker/middleware.ts`
  - `repo/apps/web-broker/app/providers.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : App demarre sur port 3001
  - V2 (P0) : Middleware redirect non-auth -> /login
  - V3 (P0) : Middleware locale detection + redirect URL

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
git commit -m "feat(sprint-16): app skeleton + layouts + middleware auth

Task: 4.3.1
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.1"
```

---

### Tache 2 / 14 : Pages Auth : Login + MFA + Signup + Recovery

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.3.1

**But** : Pages authentication consumant endpoints Sprint 5 : login + MFA verify + signup + email-verification + forgot-password + reset-password.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.2-prompt.md
```

**Actions principales attendues** :
- Page `/login` : email + password form (react-hook-form + Zod) + submit -> POST /auth/signin
- Si response `needs_mfa: true` -> redirect `/verify-mfa?challenge=...`
- Page `/verify-mfa` : 6 digits TOTP input + submit -> POST /auth/verify-mfa + redirect /dashboard
- Page `/signup` : email + password + display_name + locale + submit -> POST /auth/signup
- Page `/email-sent` : message verification email envoye
- Page `/forgot-password` : email + submit -> POST /auth/forgot-password

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(auth)/verify-mfa/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(auth)/signup/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(auth)/forgot-password/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(auth)/reset-password/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Login email + password OK -> redirect /dashboard
  - V2 (P0) : Login mauvais creds -> toast error
  - V3 (P0) : Login MFA enabled -> redirect /verify-mfa

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
git commit -m "feat(sprint-16): pages auth : login + mfa + signup + recovery

Task: 4.3.2
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.2"
```

---

### Tache 3 / 14 : Layout Principal + Sidebar + Topbar + Tenant Switcher

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.3.2

**But** : Layout protected app : sidebar navigation gauche + topbar (search + notifications + user menu + tenant switcher).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.3-prompt.md
```

**Actions principales attendues** :
- Component `<Sidebar>` :
- Component `<Topbar>` :
- Component `<Breadcrumbs>` : auto-genere depuis pathname
- Responsive : sidebar collapse < 768px (sheet mobile)
- Sticky header
- Tests : navigation + tenant switch + locale switch + logout

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/components/layout/sidebar.tsx`
  - `repo/apps/web-broker/components/layout/topbar.tsx`
  - `repo/apps/web-broker/components/layout/tenant-switcher.tsx`
  - `repo/apps/web-broker/components/layout/locale-switcher.tsx`
  - `repo/apps/web-broker/components/layout/user-menu.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Sidebar visible + navigation works
  - V2 (P0) : Topbar all features
  - V3 (P0) : Tenant switcher swap context

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
git commit -m "feat(sprint-16): layout principal + sidebar + topbar + tenant switcher

Task: 4.3.3
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.3"
```

---

### Tache 4 / 14 : Dashboard Page : 6 Widgets

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.3.3

**But** : Page dashboard accueil consume endpoints Analytics Sprint 13 + Insure dashboards Sprint 14 -- 6 widgets clefs.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.4-prompt.md
```

**Actions principales attendues** :
- Widgets :
- Filters : date_range + group_by (day/week/month) shared par widgets
- Loading states : skeleton placeholders
- Empty states : si pas data, message + suggested actions
- URL state : filtres synced via nuqs
- Refresh button manuel

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/dashboard/page.tsx`
  - `repo/apps/web-broker/components/dashboard/{6 widgets}.tsx`
  - `repo/apps/web-broker/components/dashboard/dashboard-filters.tsx`
  - `repo/apps/web-broker/lib/queries/dashboard.queries.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 6 widgets render avec data
  - V2 (P0) : Filters apply across widgets
  - V3 (P0) : Loading + empty states

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
git commit -m "feat(sprint-16): dashboard page : 6 widgets

Task: 4.3.4
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.4"
```

---

### Tache 5 / 14 : Contacts Page : List + Filters + Detail Timeline

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.3.4

**But** : Page contacts complete : list avec filtres + pagination + create/edit form + detail page avec timeline interactions.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.5-prompt.md
```

**Actions principales attendues** :
- Page `/contacts` (list) :
- Modal `<ContactFormDialog>` create/edit :
- Page `/contacts/:id` (detail) :
- Optimistic UI : create -> immediate display avec etat 'pending', success replace, fail revert
- Tests : CRUD + search + filters + bulk + detail

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/contacts/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/contacts/[id]/page.tsx`
  - `repo/apps/web-broker/components/contacts/contacts-table.tsx`
  - `repo/apps/web-broker/components/contacts/contact-form-dialog.tsx`
  - `repo/apps/web-broker/components/contacts/contact-timeline.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List + pagination + sort
  - V2 (P0) : Filters apply
  - V3 (P0) : Search debounced

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
git commit -m "feat(sprint-16): contacts page : list + filters + detail timeline

Task: 4.3.5
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.5"
```

---

### Tache 6 / 14 : Companies Page

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.3.5

**But** : Page companies similaire contacts (CRUD + list + detail).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.6-prompt.md
```

**Actions principales attendues** :
- Page list + filters (industry, city, search) + create/edit (ICE + checksum validation MA) + detail (avec contacts associes)
- Reutilise pattern Tache 4.3.5
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/companies/{several}.tsx`
  - `repo/apps/web-broker/components/companies/{components}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : CRUD complet
  - V2 (P0) : ICE validation MA
  - V3 (P0) : Detail avec contacts lies

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
git commit -m "feat(sprint-16): companies page

Task: 4.3.6
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.6"
```

---

### Tache 7 / 14 : Deals Page : Kanban + Table

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.3.6

**But** : Page deals avec 2 vues : Kanban (drag-drop stages) + Table.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.7-prompt.md
```

**Actions principales attendues** :
- View toggle : Kanban / Table
- Vue Kanban : 5+ colonnes (stages pipeline) + drag-drop deals entre stages
- On drop : POST /api/v1/crm/deals/:id/move-stage avec reason prompt
- Optimistic UI : deal moved immediately, revert si echec
- Vue Table : DataTable + filters (stage, owner, date_range, amount_range)
- Modal create/edit : title + amount + currency MAD + stage + contact + expected_close_date

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/deals/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/page.tsx`
  - `repo/apps/web-broker/components/deals/deals-kanban.tsx`
  - `repo/apps/web-broker/components/deals/deals-table.tsx`
  - `repo/apps/web-broker/components/deals/deal-form-dialog.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Kanban view drag-drop
  - V2 (P0) : Stage move POST API + audit
  - V3 (P0) : Table view filters

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
git commit -m "feat(sprint-16): deals page : kanban + table

Task: 4.3.7
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.7"
```

---

### Tache 8 / 14 : Polices Page : List + Detail Avec Premiums

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.3.7

**But** : Page polices avec list + detail riche (timeline + premiums echeancier + avenants + renouvellements).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.8-prompt.md
```

**Actions principales attendues** :
- Page list :
- Page detail :
- Forms modaux : create avenant / cancel / suspend / transfer (consume Sprint 15 services)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/polices/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/polices/[id]/page.tsx`
  - `repo/apps/web-broker/components/polices/polices-table.tsx`
  - `repo/apps/web-broker/components/polices/policy-detail-tabs.tsx`
  - `repo/apps/web-broker/components/polices/{several action dialogs}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List + filters
  - V2 (P0) : Detail tabs all functional
  - V3 (P0) : Cancel modal pro-rata preview

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
git commit -m "feat(sprint-16): polices page : list + detail avec premiums

Task: 4.3.8
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.8"
```

---

### Tache 9 / 14 : Broker Queue Page : Pending Dossiers + Validate/Reject

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.3.8

**But** : Page list broker queue (Sprint 15 BrokerValidationQueueService) : dossiers a valider + actions + SLA timer.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.9-prompt.md
```

**Actions principales attendues** :
- Page list :
- Detail dossier :
- Actions :
- Notifications real-time : new dossier assigne -> toast + bell counter
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/page.tsx`
  - `repo/apps/web-broker/components/broker-queue/queue-table.tsx`
  - `repo/apps/web-broker/components/broker-queue/sla-timer.tsx`
  - `repo/apps/web-broker/components/broker-queue/validate-reject-dialogs.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List + filtres + SLA timer visible
  - V2 (P0) : Validate trigger souscription + replace provisional
  - V3 (P0) : Reject + reason + notify customer

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
git commit -m "feat(sprint-16): broker queue page : pending dossiers + validate/reject

Task: 4.3.9
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.9"
```

---

### Tache 10 / 14 : Sinistres Page Read-Only (M9 Courtier Sans Intervention)

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.3.9

**But** : Page sinistres lecture seule pour broker (M9 : courtier ne traite PAS sinistres -- Skalean fait via flux client M8 garage). Broker peut SUIVRE sinistres lies a ses polices mais pas intervenir.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.10-prompt.md
```

**Actions principales attendues** :
- Page list read-only :
- Page detail read-only :
- Permission : `repair.sinistres.read` (Sprint 21 permissions)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/sinistres/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx`
  - `repo/apps/web-broker/components/sinistres/sinistre-status-flow.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List read-only fonctionne
  - V2 (P0) : Detail read-only complet
  - V3 (P0) : Pas de boutons Create/Edit/Delete

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
git commit -m "feat(sprint-16): sinistres page read-only (m9 courtier sans intervention)

Task: 4.3.10
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.10"
```

---

### Tache 11 / 14 : Parametres + Profile Pages

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.3.10

**But** : Pages parametres tenant (admin only) + profile user + MFA setup.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.11-prompt.md
```

**Actions principales attendues** :
- Page `/parametres` (broker_admin only) :
- Page `/profile` (all users) :
- MFA setup workflow : QR code display + verify TOTP + recovery codes download
- Active sessions : list + revoke individual + revoke all
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/parametres/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/parametres/{several tabs}.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/profile/page.tsx`
  - `repo/apps/web-broker/app/[locale]/(protected)/profile/{several tabs}.tsx`
  - `repo/apps/web-broker/components/profile/mfa-setup-flow.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Parametres tabs accessibles broker_admin
  - V2 (P0) : Profile tabs accessibles tous users
  - V3 (P0) : MFA setup flow QR -> verify -> codes

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
git commit -m "feat(sprint-16): parametres + profile pages

Task: 4.3.11
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.11"
```

---

### Tache 12 / 14 : RBAC UI : Conditional Rendering Per Role

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.3.11

**But** : RBAC UI : afficher/masquer features selon role utilisateur (3 roles broker : admin / user / assistant).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.12-prompt.md
```

**Actions principales attendues** :
- Hook `useUserPermissions()` -- retourne user.role + permissions effectives (depuis JWT decoded)
- Hook `usePermission(permission: string): boolean` -- check si user a une permission specifique
- Component `<HasPermission permission="...">{children}</HasPermission>` -- conditional render
- Component `<HasRole role={['broker_admin', 'broker_user']}>{children}</HasRole>`
- Application :
- Server-side double-check : meme si UI cache, backend rejette (Sprint 7 PermissionGuard)

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/lib/auth/use-permissions.tsx`
  - `repo/apps/web-broker/components/auth/has-permission.tsx`
  - `repo/apps/web-broker/components/auth/has-role.tsx`
  - `repo/apps/web-broker/test/rbac-ui.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `useUserPermissions` retourne data correcte
  - V2 (P0) : `<HasPermission>` cache si manque
  - V3 (P0) : Sidebar items conditionnels

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
git commit -m "feat(sprint-16): rbac ui : conditional rendering per role

Task: 4.3.12
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.12"
```

---

### Tache 13 / 14 : I18n Complete : fr / ar-MA / ar + RTL

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.3.12

**But** : Internationalisation complete app web-broker : 3 locales + RTL pour ar/ar-MA + locale switcher.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.13-prompt.md
```

**Actions principales attendues** :
- Fichiers translations : `messages/{fr,ar-MA,ar}.json` -- toutes UI strings
- Lib `next-intl` ou pattern Next.js native i18n
- CSS RTL : `[dir="rtl"]` selectors + flip flexbox + icons mirroring
- Component `<LocaleSwitcher>` : dropdown locale selection
- Date format locale-aware : `date-fns` avec locale fr / ar
- Currency format : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/messages/fr.json`
  - `repo/apps/web-broker/messages/ar-MA.json`
  - `repo/apps/web-broker/messages/ar.json`
  - `repo/apps/web-broker/lib/i18n/use-translations.tsx`
  - `repo/apps/web-broker/components/layout/locale-switcher.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 locales fichiers complets
  - V2 (P0) : Switch locale change UI texts
  - V3 (P0) : RTL CSS applique ar/ar-MA

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
git commit -m "feat(sprint-16): i18n complete : fr / ar-ma / ar + rtl

Task: 4.3.13
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.13"
```

---

### Tache 14 / 14 : Tests E2E Playwright (20+) + Accessibility

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.3.13

**But** : Suite tests Playwright complete + accessibility checks (a11y).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.14-prompt.md
```

**Actions principales attendues** :
- Auth : login + signup + MFA + recovery (5)
- Dashboard : widgets render + filters (2)
- Contacts : CRUD + search + bulk (3)
- Companies : CRUD (2)
- Deals : Kanban drag + table + create (3)
- Polices : list + detail + cancel + suspend (4)

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/e2e/{20+ specs}.spec.ts`
  - `repo/apps/web-broker/e2e/fixtures/auth-helpers.ts`
  - `repo/apps/web-broker/e2e/fixtures/test-tenant-setup.ts`
  - `repo/apps/web-broker/playwright.config.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 20+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Accessibility WCAG 2.1 AA

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
git commit -m "feat(sprint-16): tests e2e playwright (20+) + accessibility

Task: 4.3.14
Sprint: 16 (Phase 4 / Sprint 3)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-16 Tache 4.3.14"
```

---


## VERIFICATION DU SPRINT 16

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-16-sprint-16-verification.md
```

Le fichier de verification V-16 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint16-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint16-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint16-verify-report.md
git commit -m "chore(sprint-16): close sprint 16 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 4 (Vertical Insure (Skalean Broker ERP))
- Sprint : 16 (Phase 4 / Sprint 3)
- Apport : web-broker port 3001 production-ready
- Tests E2E cumules : {N}+

Sprint 16 completed -- handoff to Sprint 17."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 16]
   |
   v
[Tache 4.3.1: App Skeleton + Layouts + Middleware Auth]
   | -> compile -> tests -> commit
   v
[Tache 4.3.2: Pages Auth : Login + MFA + Signup + Recovery]
   | -> compile -> tests -> commit
   v
[Tache 4.3.3: Layout Principal + Sidebar + Topbar + Tenant Switcher]
   | -> compile -> tests -> commit
   v
[Tache 4.3.4: Dashboard Page : 6 Widgets]
   | -> compile -> tests -> commit
   v
[Tache 4.3.5: Contacts Page : List + Filters + Detail Timeline]
   | -> compile -> tests -> commit
   v
[Tache 4.3.6: Companies Page]
   | -> compile -> tests -> commit
   v
[Tache 4.3.7: Deals Page : Kanban + Table]
   | -> compile -> tests -> commit
   v
[Tache 4.3.8: Polices Page : List + Detail Avec Premiums]
   | -> compile -> tests -> commit
   v
[Tache 4.3.9: Broker Queue Page : Pending Dossiers + Validate/Reject]
   | -> compile -> tests -> commit
   v
[Tache 4.3.10: Sinistres Page Read-Only (M9 Courtier Sans Intervention]
   | -> compile -> tests -> commit
   v
[Tache 4.3.11: Parametres + Profile Pages]
   | -> compile -> tests -> commit
   v
[Tache 4.3.12: RBAC UI : Conditional Rendering Per Role]
   | -> compile -> tests -> commit
   v
[Tache 4.3.13: I18n Complete : fr / ar-MA / ar + RTL]
   | -> compile -> tests -> commit
   v
[Tache 4.3.14: Tests E2E Playwright (20+) + Accessibility]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 16 -- V-16]
   |
   v
[Rapport sprint16-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

**Apport metier principal** : web-broker port 3001 production-ready.

**Prerequis Sprint 17** : Sprint 16 GO complet (score >= 95% verification automatique V-16).

**Sprint suivant** : Sprint 17.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 15 (verification GO)

```bash
# Verifier Sprint 15 GO
ls skalean-insurtech/sprint15-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint15-verify-report.md
```

### Lancement Sprint 16 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-16-sprint-16-web-broker-app.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-16-sprint-16-web-broker-app.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-16-sprint-16-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-16.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 16"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint16-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-16** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-16-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-16 v2.2 detaille -- Sprint 16 (4.3) Web Broker App (port 3001).**

**Total taches detaillees** : 14 | **Effort cumul** : ~75h | **Apport** : web-broker port 3001 production-ready
