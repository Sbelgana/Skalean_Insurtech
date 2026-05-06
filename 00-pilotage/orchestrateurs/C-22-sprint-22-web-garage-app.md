# ORCHESTRATEUR SPRINT 22 -- Phase 5 / Sprint 4 : Web Garage App (port 3002)
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 22 / 35 (cumul) -- Sprint 4 dans Phase 5
**Reference meta-prompt** : `B-22-sprint-22-web-garage-app.md`
**Reference verification** : `V-22-sprint-22-verification.md`
**Numerotation taches** : 5.4.1 a 5.4.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : web-garage port 3002 production-ready

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 22 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-22** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-22 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 22

Sprint 22 (5.4) -- Web Garage App (port 3002). Voir B-22-sprint-22-web-garage-app.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/
  task-5.4.1-prompt.md       # App Skeleton + Layout
  task-5.4.2-prompt.md       # Pages Auth Reuse Sprint 16
  task-5.4.3-prompt.md       # Dashboard Garage : 6 Widgets
  task-5.4.4-prompt.md       # Sinistres Page : Kanban + Table
  task-5.4.5-prompt.md       # Sinistre Detail Page : Timeline + Tabs
  task-5.4.6-prompt.md       # Reception Page
  task-5.4.7-prompt.md       # Diagnostics Page : IA + Technicien
  task-5.4.8-prompt.md       # Devis Page : Create + Items + Send
  task-5.4.9-prompt.md       # Orders Page : Tracking + Hours + Parts
  task-5.4.10-prompt.md       # QC + Delivery Page
  task-5.4.11-prompt.md       # Invoices Page : Split Preview + Download
  task-5.4.12-prompt.md       # Parametres + 4 Roles RBAC + I18n
  task-5.4.13-prompt.md       # Tests Playwright + WCAG + Lighthouse
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-22-sprint-22-verification.md
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
4. La verification finale V-22 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-22-sprint-22-verification.md
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

### Position du Sprint 4 dans la Phase 5

Sprint 22 (5.4) -- **Web Garage App (port 3002)**.

Voir `B-22-sprint-22-web-garage-app.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

web-garage port 3002 production-ready

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-22 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-22, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-22.

---

### Tache 1 / 13 : App Skeleton + Layout

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 21

**But** : Initialiser app `web-garage` reutilisant pattern Sprint 16 (middleware auth + tenant + i18n) + layout adapte garage workflow.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.1-prompt.md
```

**Actions principales attendues** :
- Folder `repo/apps/web-garage/`
- App skeleton Next.js 15 + design tokens Sofidemy Sprint 4
- Middleware reutilise pattern Sprint 16 (cookies httpOnly + tenant context + locale)
- Layout principal :
- FAB "Nouveau sinistre" : visible toujours (creation manuelle si client direct)
- Notifications bell : poll 30s

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/`
  - `repo/apps/web-garage/middleware.ts`
  - `repo/apps/web-garage/app/[locale]/(auth)/layout.tsx`
  - `repo/apps/web-garage/app/[locale]/(protected)/layout.tsx`
  - `repo/apps/web-garage/components/layout/sidebar.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : App demarre port 3002
  - V2 (P0) : Middleware fonctionne
  - V3 (P0) : Layout sidebar + topbar

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
git commit -m "feat(sprint-22): app skeleton + layout

Task: 5.4.1
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.1"
```

---

### Tache 2 / 13 : Pages Auth Reuse Sprint 16

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.4.1

**But** : Reutilise pattern auth Sprint 16 : login + MFA + signup + recovery + select-tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.2-prompt.md
```

**Actions principales attendues** :
- Reuse 7 pages auth Sprint 16 (copy-paste avec adaptations garage branding)
- Endpoints API auth deja dispos Sprint 5
- Tests 5+ scenarios

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(auth)/{7 pages}.tsx`
  - `repo/apps/web-garage/components/auth/{several reuse}`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Login + MFA flow OK
  - V2 (P0) : Tests 5+ scenarios

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
git commit -m "feat(sprint-22): pages auth reuse sprint 16

Task: 5.4.2
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.2"
```

---

### Tache 3 / 13 : Dashboard Garage : 6 Widgets

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.4.2

**But** : Dashboard accueil avec widgets specifiques garage operations.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.3-prompt.md
```

**Actions principales attendues** :
- 6 widgets :
- Filters : date_range + technicien + service_type
- Loading + empty states
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/dashboard/page.tsx`
  - `repo/apps/web-garage/components/dashboard/{6 widgets}.tsx`
  - `repo/apps/web-garage/lib/queries/dashboard.queries.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 6 widgets render
  - V2 (P0) : Filters apply
  - V3 (P0) : Tests 5+ scenarios

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
git commit -m "feat(sprint-22): dashboard garage : 6 widgets

Task: 5.4.3
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.3"
```

---

### Tache 4 / 13 : Sinistres Page : Kanban + Table

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.4.3

**But** : Page sinistres avec 2 vues : Kanban par status (similar deals Sprint 16) + Table.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.4-prompt.md
```

**Actions principales attendues** :
- View toggle : Kanban / Table
- Vue Kanban : 10 colonnes (10 status sinistre Sprint 19) + drag-drop transitions valides
- On drop : POST `/api/v1/repair/sinistres/:id/transition` (state machine valide Sprint 19)
- Cards : sinistre_number + customer + vehicle + technicien + dates + priority badge
- Optimistic UI : transition immediate + revert si state machine reject
- Vue Table : DataTable + filters (status, technicien, branche, date_range, priority)

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/page.tsx`
  - `repo/apps/web-garage/components/sinistres/sinistres-kanban.tsx`
  - `repo/apps/web-garage/components/sinistres/sinistres-table.tsx`
  - `repo/apps/web-garage/components/sinistres/sinistre-card.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Kanban 10 colonnes
  - V2 (P0) : Drag-drop transitions
  - V3 (P0) : Optimistic UI + revert

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
git commit -m "feat(sprint-22): sinistres page : kanban + table

Task: 5.4.4
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.4"
```

---

### Tache 5 / 13 : Sinistre Detail Page : Timeline + Tabs

**Metadonnees** : P0 | 8h | Depend de : Depend de 5.4.4

**But** : Page detail sinistre riche avec timeline visuelle + tabs pour chaque etape workflow.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.5-prompt.md
```

**Actions principales attendues** :
- Header : sinistre_number + status big badge + customer + vehicle + dates
- **Timeline visuelle** : 10 etapes status avec dates + responsable + comments (audit history Sprint 19)
- Tabs :
- Action buttons contextual :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/page.tsx`
  - `repo/apps/web-garage/components/sinistres/sinistre-timeline.tsx`
  - `repo/apps/web-garage/components/sinistres/sinistre-detail-tabs.tsx`
  - `repo/apps/web-garage/components/sinistres/contextual-actions.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Detail tabs all functional
  - V2 (P0) : Timeline visuelle
  - V3 (P0) : Contextual actions selon status

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
git commit -m "feat(sprint-22): sinistre detail page : timeline + tabs

Task: 5.4.5
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.5"
```

---

### Tache 6 / 13 : Reception Page

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.4.5

**But** : Page reception (Tab dans sinistre detail) : checklist 12 points + photos upload + 3 documents customer + signature reception.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.6-prompt.md
```

**Actions principales attendues** :
- Form react-hook-form 12 points checklist (Sprint 21 Tache 5.3.1) :
- Photos uploader : multiple photos (recommande 8-12 angles)
- Documents customer upload :
- Signature pad customer : html5 canvas signature OR Barid eSign embed
- Submit : POST endpoint reception + transition sinistre
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx`
  - `repo/apps/web-garage/components/reception/checklist-12-points.tsx`
  - `repo/apps/web-garage/components/reception/photos-uploader.tsx`
  - `repo/apps/web-garage/components/reception/signature-pad.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 12 points checklist form
  - V2 (P0) : Photos upload S3
  - V3 (P0) : 3 docs customer upload

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
git commit -m "feat(sprint-22): reception page

Task: 5.4.6
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.6"
```

---

### Tache 7 / 13 : Diagnostics Page : IA + Technicien

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.4.6

**But** : Page diagnostic avec **visualization IA suggestions Sprint 20** + technicien validation/edit/reject + rapport generation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.7-prompt.md
```

**Actions principales attendues** :
- Section "IA Suggestions" :
- Actions :
- Section "Manual Diagnostic" :
- Photos additionnelles upload (technicien analyse approfondie)
- Bouton "Generate Report" -> rapport technique PDF
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx`
  - `repo/apps/web-garage/components/diagnostic/ia-suggestions-display.tsx`
  - `repo/apps/web-garage/components/diagnostic/manual-diagnostic-form.tsx`
  - `repo/apps/web-garage/components/diagnostic/confidence-gauge.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : IA suggestions display complete
  - V2 (P0) : 3 actions (accept/edit/reject)
  - V3 (P0) : Manual diagnostic alternative

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
git commit -m "feat(sprint-22): diagnostics page : ia + technicien

Task: 5.4.7
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.7"
```

---

### Tache 8 / 13 : Devis Page : Create + Items + Send

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.4.7

**But** : Page devis : creation depuis diagnostic + editor items + envoi assureur/client + tracking lecture/approbation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.8-prompt.md
```

**Actions principales attendues** :
- Bouton "Create Devis" depuis diagnostic completed
- Auto-populate items depuis diagnostic (parts + labor)
- Items editor :
- Validity date selector (default 14 jours)
- Recipients selection :
- Bouton "Send" : trigger Sprint 21 Tache 5.3.3 envoi + tracking

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/devis/page.tsx`
  - `repo/apps/web-garage/components/devis/devis-editor.tsx`
  - `repo/apps/web-garage/components/devis/devis-tracking.tsx`
  - `repo/apps/web-garage/components/devis/avenant-form.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Create from diagnostic
  - V2 (P0) : Items editor + auto totals
  - V3 (P0) : Send + recipients

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
git commit -m "feat(sprint-22): devis page : create + items + send

Task: 5.4.8
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.8"
```

---

### Tache 9 / 13 : Orders Page : Tracking + Hours + Parts

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.4.8

**But** : Page orders : list orders en cours + tracking real-time (% completion + parts arrival) + log hours + consume parts.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.9-prompt.md
```

**Actions principales attendues** :
- Page liste : orders en cours + filters (technicien, status, date_range)
- Page detail order :
- Real-time updates : poll 30s
- Notifications customer trigger automatic milestones (Sprint 21 Tache 5.3.5)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/orders/page.tsx`
  - `repo/apps/web-garage/app/[locale]/(protected)/orders/[id]/page.tsx`
  - `repo/apps/web-garage/components/orders/tasks-checklist.tsx`
  - `repo/apps/web-garage/components/orders/parts-arrival-status.tsx`
  - `repo/apps/web-garage/components/orders/hours-tracker.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Order detail complete
  - V2 (P0) : Hours timer + manual log
  - V3 (P0) : Parts consumer integration Stock

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
git commit -m "feat(sprint-22): orders page : tracking + hours + parts

Task: 5.4.9
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.9"
```

---

### Tache 10 / 13 : QC + Delivery Page

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.4.9

**But** : Pages QC checklist 10 points + livraison + signature reception customer + bon livraison.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.10-prompt.md
```

**Actions principales attendues** :
- Page QC :
- Page Delivery (post-QC passed) :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx`
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/delivery/page.tsx`
  - `repo/apps/web-garage/components/qc/checklist-10-points.tsx`
  - `repo/apps/web-garage/components/delivery/delivery-confirmation.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : QC 10 points + photos + signature
  - V2 (P0) : Pass/Fail workflow
  - V3 (P0) : Delivery + signature customer

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
git commit -m "feat(sprint-22): qc + delivery page

Task: 5.4.10
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.10"
```

---

### Tache 11 / 13 : Invoices Page : Split Preview + Download

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.4.10

**But** : Page invoices : list factures (split insurer + customer) + preview avant generation + PDF download + tracking paiement.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.11-prompt.md
```

**Actions principales attendues** :
- Page list invoices : DataTable filtres status + recipient_type
- **Preview split avant generation** (UX critique) :
- Page detail invoice :
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/invoices/page.tsx`
  - `repo/apps/web-garage/components/invoices/split-preview.tsx`
  - `repo/apps/web-garage/components/invoices/invoice-detail.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Split preview avant generation
  - V2 (P0) : Generate produit 2 factures
  - V3 (P0) : PDF preview + download

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
git commit -m "feat(sprint-22): invoices page : split preview + download

Task: 5.4.11
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.11"
```

---

### Tache 12 / 13 : Parametres + 4 Roles RBAC + I18n

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.4.11

**But** : Pages parametres garage + RBAC UI 4 roles + i18n complete.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.12-prompt.md
```

**Actions principales attendues** :
- Page parametres (garage_admin only) :
- RBAC UI Sprint 16 pattern reutilise :
- I18n fr/ar-MA/ar messages complets (~600 keys)
- RTL CSS
- Locale switcher
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/parametres/page.tsx`
  - `repo/apps/web-garage/components/auth/has-role-garage.tsx`
  - `repo/apps/web-garage/messages/{fr,ar-MA,ar}.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Parametres garage_admin only
  - V2 (P0) : 4 roles UI conditional
  - V3 (P0) : I18n 3 locales

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
git commit -m "feat(sprint-22): parametres + 4 roles rbac + i18n

Task: 5.4.12
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.12"
```

---

### Tache 13 / 13 : Tests Playwright + WCAG + Lighthouse

**Metadonnees** : P0 | 8h | Depend de : Depend de 5.4.12

**But** : Suite tests Playwright E2E + accessibility WCAG 2.1 AA + Lighthouse audits.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-22-web-garage-app/task-5.4.13-prompt.md
```

**Actions principales attendues** :
- Auth login + MFA (3)
- Dashboard widgets (2)
- Sinistres Kanban + Table + transitions (4)
- Sinistre detail tabs (3)
- Reception checklist + photos + signature (2)
- Diagnostic IA + technicien validation (2)

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/e2e/{20+ specs}.spec.ts`
  - `repo/apps/web-garage/playwright.config.ts`

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
git commit -m "feat(sprint-22): tests playwright + wcag + lighthouse

Task: 5.4.13
Sprint: 22 (Phase 5 / Sprint 4)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-22 Tache 5.4.13"
```

---


## VERIFICATION DU SPRINT 22

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-22-sprint-22-verification.md
```

Le fichier de verification V-22 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint22-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint22-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint22-verify-report.md
git commit -m "chore(sprint-22): close sprint 22 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 22 (Phase 5 / Sprint 4)
- Apport : web-garage port 3002 production-ready
- Tests E2E cumules : {N}+

Sprint 22 completed -- handoff to Sprint 23."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 22]
   |
   v
[Tache 5.4.1: App Skeleton + Layout]
   | -> compile -> tests -> commit
   v
[Tache 5.4.2: Pages Auth Reuse Sprint 16]
   | -> compile -> tests -> commit
   v
[Tache 5.4.3: Dashboard Garage : 6 Widgets]
   | -> compile -> tests -> commit
   v
[Tache 5.4.4: Sinistres Page : Kanban + Table]
   | -> compile -> tests -> commit
   v
[Tache 5.4.5: Sinistre Detail Page : Timeline + Tabs]
   | -> compile -> tests -> commit
   v
[Tache 5.4.6: Reception Page]
   | -> compile -> tests -> commit
   v
[Tache 5.4.7: Diagnostics Page : IA + Technicien]
   | -> compile -> tests -> commit
   v
[Tache 5.4.8: Devis Page : Create + Items + Send]
   | -> compile -> tests -> commit
   v
[Tache 5.4.9: Orders Page : Tracking + Hours + Parts]
   | -> compile -> tests -> commit
   v
[Tache 5.4.10: QC + Delivery Page]
   | -> compile -> tests -> commit
   v
[Tache 5.4.11: Invoices Page : Split Preview + Download]
   | -> compile -> tests -> commit
   v
[Tache 5.4.12: Parametres + 4 Roles RBAC + I18n]
   | -> compile -> tests -> commit
   v
[Tache 5.4.13: Tests Playwright + WCAG + Lighthouse]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 22 -- V-22]
   |
   v
[Rapport sprint22-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : web-garage port 3002 production-ready.

**Prerequis Sprint 23** : Sprint 22 GO complet (score >= 95% verification automatique V-22).

**Sprint suivant** : Sprint 23.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 21 (verification GO)

```bash
# Verifier Sprint 21 GO
ls skalean-insurtech/sprint21-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint21-verify-report.md
```

### Lancement Sprint 22 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-22-sprint-22-web-garage-app.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-22-sprint-22-web-garage-app.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-22-sprint-22-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-22.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 22"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint22-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-22** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-22-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-22 v2.2 detaille -- Sprint 22 (5.4) Web Garage App (port 3002).**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : web-garage port 3002 production-ready
