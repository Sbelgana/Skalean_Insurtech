# ORCHESTRATEUR SPRINT 26 -- Phase 6 / Sprint 1 : Admin Foundation (web-insurtech-admin + impersonation)
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 6 -- Admin Platform
**Sprint** : 26 / 35 (cumul) -- Sprint 1 dans Phase 6
**Reference meta-prompt** : `B-26-sprint-26-admin-foundation.md`
**Reference verification** : `V-26-sprint-26-verification.md`
**Numerotation taches** : 6.1.1 a 6.1.12
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : web-insurtech-admin + impersonation + monitoring

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 12 taches** du Sprint 26 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-26** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-26 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 26

Sprint 26 (6.1) -- Admin Foundation (web-insurtech-admin + impersonation). Voir B-26-sprint-26-admin-foundation.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/
  task-6.1.1-prompt.md       # App Skeleton + Middleware Super Admin
  task-6.1.2-prompt.md       # Pages Auth Super Admin
  task-6.1.3-prompt.md       # Layout Admin + Privilege Escalation Indicator
  task-6.1.4-prompt.md       # Dashboard Platform-Wide
  task-6.1.5-prompt.md       # Tenants List Page
  task-6.1.6-prompt.md       # Tenant Detail Page
  task-6.1.7-prompt.md       # Onboarding Wizard UI
  task-6.1.8-prompt.md       # Users Management Cross-Tenant + Impersonate
  task-6.1.9-prompt.md       # Capabilities Matrix UI
  task-6.1.10-prompt.md       # Health Monitoring
  task-6.1.11-prompt.md       # Audit Logs Viewer + Search Avance
  task-6.1.12-prompt.md       # Tests E2E + WCAG + Lighthouse
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-26-sprint-26-verification.md
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
4. La verification finale V-26 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 12 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-26-sprint-26-verification.md
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

## CONTEXTE PHASE 6 -- Admin Platform

### Position du Sprint 1 dans la Phase 6

Sprint 26 (6.1) -- **Admin Foundation (web-insurtech-admin + impersonation)**.

Voir `B-26-sprint-26-admin-foundation.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/web-insurtech-admin, packages/admin (impersonation, tenants management, compliance reports)

### Apport metier de ce sprint

web-insurtech-admin + impersonation + monitoring

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-26 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-26, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-26.

---

### Tache 1 / 12 : App Skeleton + Middleware Super Admin

**Metadonnees** : P0 | 6h | Depend de : Depend de Phase 5

**But** : Initialiser app `web-insurtech-admin` Next.js 15 avec middleware enforce super_admin role + 2FA mandatory + session 4h.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.1-prompt.md
```

**Actions principales attendues** :
- Folder `repo/apps/web-insurtech-admin/`
- App skeleton Next.js 15 reuse pattern Sprint 16
- Middleware enrichi :
- Variables env : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_NAME=skalean-admin`
- Layout protected : redirect tous routes vers /login si non auth
- Tests : middleware blocks non-super_admin

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/`
  - `repo/apps/web-insurtech-admin/middleware.ts`
  - `repo/apps/web-insurtech-admin/app/layout.tsx`
  - `repo/apps/web-insurtech-admin/app/[locale]/(auth)/layout.tsx`
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/layout.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : App demarre port 3000
  - V2 (P0) : Non super_admin redirect /access-denied
  - V3 (P0) : 2FA mandatory enforce

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
git commit -m "feat(sprint-26): app skeleton + middleware super admin

Task: 6.1.1
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.1"
```

---

### Tache 2 / 12 : Pages Auth Super Admin

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.1.1

**But** : Pages auth super_admin : login + MFA verify + setup-2FA + recovery codes (TOTP + recovery 12 codes).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.2-prompt.md
```

**Actions principales attendues** :
- Pages :
- Workflow setup-2FA : QR code Google Authenticator + verify TOTP + generate 12 recovery codes + force download avant continue
- Recovery codes : 12 codes 8 chars alphanumeric, single-use, stored hashed bcrypt
- Pattern reutilise Sprint 16
- Tests Playwright

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(auth)/{6 pages}.tsx`
  - `repo/apps/web-insurtech-admin/components/auth/{several}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Login + MFA
  - V2 (P0) : Setup 2FA QR + recovery codes mandatory
  - V3 (P0) : Recovery code accepted

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
git commit -m "feat(sprint-26): pages auth super admin

Task: 6.1.2
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.2"
```

---

### Tache 3 / 12 : Layout Admin + Privilege Escalation Indicator

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.1.2

**But** : Layout admin avec sidebar + topbar + indicator visuel privilege escalation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.3-prompt.md
```

**Actions principales attendues** :
- Sidebar :
- Topbar :
- **Privilege escalation indicator** : banner top quand admin agit cross-tenant ("Vous agissez sur tenant X" + Stop button)
- Audit footer : "Toutes vos actions sont enregistrees" + ID session visible
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/components/layout/admin-sidebar.tsx`
  - `repo/apps/web-insurtech-admin/components/layout/admin-topbar.tsx`
  - `repo/apps/web-insurtech-admin/components/layout/privilege-escalation-banner.tsx`
  - `repo/apps/web-insurtech-admin/components/layout/audit-footer.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Sidebar complete
  - V2 (P0) : Topbar + search global
  - V3 (P0) : Privilege escalation banner

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
git commit -m "feat(sprint-26): layout admin + privilege escalation indicator

Task: 6.1.3
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.3"
```

---

### Tache 4 / 12 : Dashboard Platform-Wide

**Metadonnees** : P0 | 7h | Depend de : Depend de 6.1.3

**But** : Dashboard accueil avec 6 widgets KPIs platform-wide (cross-tenant aggregations).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.4-prompt.md
```

**Actions principales attendues** :
- Widgets :
- Filters : date_range + tenant_type + region
- Real-time refresh : poll 30s
- Click drill-down : tap widget -> detail page
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/dashboard/page.tsx`
  - `repo/apps/web-insurtech-admin/components/dashboard/{6 widgets}.tsx`
  - `repo/apps/web-insurtech-admin/lib/queries/admin-dashboard.queries.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 6 widgets cross-tenant
  - V2 (P0) : Filters apply
  - V3 (P0) : Click drill-down

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
git commit -m "feat(sprint-26): dashboard platform-wide

Task: 6.1.4
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.4"
```

---

### Tache 5 / 12 : Tenants List Page

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.1.4

**But** : Page list tous tenants : DataTable + filters + bulk actions.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.5-prompt.md
```

**Actions principales attendues** :
- DataTable columns : name + type (broker/garage) + subtype (atlas/managed/api) + status + city + users_count + active_polices/sinistres + revenue_30d + onboarded_at
- Filters : type + subtype + status + region + onboarding_status
- Search : nom + ICE
- Bulk actions : suspend + reactivate + send notification + export CSV
- "Onboard new tenant" button -> wizard Tache 6.1.7
- Click tenant -> detail Tache 6.1.6

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/page.tsx`
  - `repo/apps/web-insurtech-admin/components/tenants/tenants-table.tsx`
  - `repo/apps/web-insurtech-admin/components/tenants/tenants-bulk-actions.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List + filters + search
  - V2 (P0) : Bulk actions
  - V3 (P0) : Tests 6+ scenarios

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
git commit -m "feat(sprint-26): tenants list page

Task: 6.1.5
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.5"
```

---

### Tache 6 / 12 : Tenant Detail Page

**Metadonnees** : P0 | 7h | Depend de : Depend de 6.1.5

**But** : Page detail tenant : info + capabilities + users + activity + KPIs per tenant.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.6-prompt.md
```

**Actions principales attendues** :
- Header : nom + ICE + type + subtype + status badge
- Tabs :
- Actions :
- Privilege escalation banner active quand Impersonate started
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/page.tsx`
  - `repo/apps/web-insurtech-admin/components/tenants/tenant-detail-tabs.tsx`
  - `repo/apps/web-insurtech-admin/components/tenants/impersonate-button.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 8 tabs functional
  - V2 (P0) : Impersonate workflow
  - V3 (P0) : Suspend tenant

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
git commit -m "feat(sprint-26): tenant detail page

Task: 6.1.6
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.6"
```

---

### Tache 7 / 12 : Onboarding Wizard UI

**Metadonnees** : P0 | 7h | Depend de : Depend de 6.1.6

**But** : UI onboarding wizard 7 steps consumant Sprint 25 backend.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.7-prompt.md
```

**Actions principales attendues** :
- Wizard 7 steps (Sprint 25 Tache 5.7.7) :
- Stepper progress visible
- Save draft : permits exit + resume later
- Validation per step : Zod schemas + display errors
- Final step : trigger backend launch + display success + tenant ID created
- Tests : flow complete + draft + resume

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/onboarding/page.tsx`
  - `repo/apps/web-insurtech-admin/components/onboarding/{7 steps components}.tsx`
  - `repo/apps/web-insurtech-admin/components/onboarding/wizard-progress.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 7 steps complete
  - V2 (P0) : Draft save + resume
  - V3 (P0) : Validation per step

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
git commit -m "feat(sprint-26): onboarding wizard ui

Task: 6.1.7
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.7"
```

---

### Tache 8 / 12 : Users Management Cross-Tenant + Impersonate

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.1.7

**But** : Page users management cross-tenant : list + invite + suspend + reset MFA + impersonate avec audit complet.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.8-prompt.md
```

**Actions principales attendues** :
- Page `/users` :
- Actions :
- **Impersonate workflow** :
- Audit log : chaque impersonation start/stop + actions during
- Permissions : `admin.users.impersonate`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/users/page.tsx`
  - `repo/apps/web-insurtech-admin/components/users/users-table.tsx`
  - `repo/apps/web-insurtech-admin/components/users/impersonate-modal.tsx`
  - `repo/packages/auth/src/services/impersonation.service.ts`
  - `repo/apps/api/src/modules/admin/controllers/impersonation.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Users list + filters
  - V2 (P0) : Invite + suspend + reset MFA
  - V3 (P0) : Impersonate workflow complete

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
git commit -m "feat(sprint-26): users management cross-tenant + impersonate

Task: 6.1.8
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.8"
```

---

### Tache 9 / 12 : Capabilities Matrix UI

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.1.8

**But** : UI configurer capabilities per tenant + history changes.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.9-prompt.md
```

**Actions principales attendues** :
- Page `/tenants/:id/capabilities` :
- History changes : table audit per capability (who + when + before/after)
- Bulk actions : enable/disable batch capabilities
- Validation : certaines capabilities requirent autres (e.g. `insure.connectors.api_access` requirent `repair.sinistres.send_status_updates`)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/capabilities/page.tsx`
  - `repo/apps/web-insurtech-admin/components/capabilities/capabilities-matrix-ui.tsx`
  - `repo/apps/web-insurtech-admin/components/capabilities/changes-history.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Matrix display
  - V2 (P0) : Toggle + save
  - V3 (P0) : History changes

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
git commit -m "feat(sprint-26): capabilities matrix ui

Task: 6.1.9
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.9"
```

---

### Tache 10 / 12 : Health Monitoring

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.1.9

**But** : Page health monitoring : status services + metrics OTEL + alerts proactives.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.10-prompt.md
```

**Actions principales attendues** :
- Page `/health` :
- Auto-refresh 30s
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/health/page.tsx`
  - `repo/apps/web-insurtech-admin/components/health/{several monitors}.tsx`
  - `repo/apps/api/src/modules/admin/controllers/health-monitoring.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Services status
  - V2 (P0) : Metrics OTEL
  - V3 (P0) : Alerts active

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
git commit -m "feat(sprint-26): health monitoring

Task: 6.1.10
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.10"
```

---

### Tache 11 / 12 : Audit Logs Viewer + Search Avance

**Metadonnees** : P0 | 5h | Depend de : Depend de 6.1.10

**But** : Viewer audit logs avec search avance : filters per user, tenant, action, date, IP, action type.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.11-prompt.md
```

**Actions principales attendues** :
- Page `/audit-logs` :
- Endpoint backend optimized : pagination + indexes audit_log
- Performance : > 10M rows audit -> queries optimisees + ClickHouse archive
- Permissions : `admin.audit_logs.read`
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/audit-logs/page.tsx`
  - `repo/apps/web-insurtech-admin/components/audit/audit-logs-table.tsx`
  - `repo/apps/web-insurtech-admin/components/audit/audit-detail-modal.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Filters complete
  - V2 (P0) : Search free text
  - V3 (P0) : Export CSV

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
git commit -m "feat(sprint-26): audit logs viewer + search avance

Task: 6.1.11
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.11"
```

---

### Tache 12 / 12 : Tests E2E + WCAG + Lighthouse

**Metadonnees** : P0 | 6h | Depend de : Depend de 6.1.11

**But** : Suite tests Playwright E2E + WCAG 2.1 AA + Lighthouse audits.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-26-admin-foundation/task-6.1.12-prompt.md
```

**Actions principales attendues** :
- Auth super_admin + 2FA + recovery codes (4)
- Dashboard platform-wide (1)
- Tenants list + detail + actions (3)
- Onboarding wizard 7 steps (2)
- Users impersonate workflow + audit (2)
- Capabilities edit + validation (1)

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/e2e/{15+ specs}.spec.ts`
  - `repo/apps/web-insurtech-admin/playwright.config.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ tests passent
  - V2 (P0) : Lighthouse perf 90+
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
git commit -m "feat(sprint-26): tests e2e + wcag + lighthouse

Task: 6.1.12
Sprint: 26 (Phase 6 / Sprint 1)
Phase: 6 -- Admin Platform
Decisions: see B-26 Tache 6.1.12"
```

---


## VERIFICATION DU SPRINT 26

Une fois les 12 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-26-sprint-26-verification.md
```

Le fichier de verification V-26 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint26-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint26-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint26-verify-report.md
git commit -m "chore(sprint-26): close sprint 26 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 6 (Admin Platform)
- Sprint : 26 (Phase 6 / Sprint 1)
- Apport : web-insurtech-admin + impersonation + monitoring
- Tests E2E cumules : {N}+

Sprint 26 completed -- handoff to Sprint 27."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 26]
   |
   v
[Tache 6.1.1: App Skeleton + Middleware Super Admin]
   | -> compile -> tests -> commit
   v
[Tache 6.1.2: Pages Auth Super Admin]
   | -> compile -> tests -> commit
   v
[Tache 6.1.3: Layout Admin + Privilege Escalation Indicator]
   | -> compile -> tests -> commit
   v
[Tache 6.1.4: Dashboard Platform-Wide]
   | -> compile -> tests -> commit
   v
[Tache 6.1.5: Tenants List Page]
   | -> compile -> tests -> commit
   v
[Tache 6.1.6: Tenant Detail Page]
   | -> compile -> tests -> commit
   v
[Tache 6.1.7: Onboarding Wizard UI]
   | -> compile -> tests -> commit
   v
[Tache 6.1.8: Users Management Cross-Tenant + Impersonate]
   | -> compile -> tests -> commit
   v
[Tache 6.1.9: Capabilities Matrix UI]
   | -> compile -> tests -> commit
   v
[Tache 6.1.10: Health Monitoring]
   | -> compile -> tests -> commit
   v
[Tache 6.1.11: Audit Logs Viewer + Search Avance]
   | -> compile -> tests -> commit
   v
[Tache 6.1.12: Tests E2E + WCAG + Lighthouse]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 26 -- V-26]
   |
   v
[Rapport sprint26-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/web-insurtech-admin, packages/admin (impersonation, tenants management, compliance reports)

**Apport metier principal** : web-insurtech-admin + impersonation + monitoring.

**Prerequis Sprint 27** : Sprint 26 GO complet (score >= 95% verification automatique V-26).

**Sprint suivant** : Sprint 27.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 25 (verification GO)

```bash
# Verifier Sprint 25 GO
ls skalean-insurtech/sprint25-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint25-verify-report.md
```

### Lancement Sprint 26 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-26-sprint-26-admin-foundation.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-26-sprint-26-admin-foundation.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-26-sprint-26-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-26.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 26"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint26-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-26** complet avant generation prompts taches (contexte critique)
2. **Generer les 12 prompts taches** dans `00-pilotage/prompts-taches/sprint-26-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-26 v2.2 detaille -- Sprint 26 (6.1) Admin Foundation (web-insurtech-admin + impersonation).**

**Total taches detaillees** : 12 | **Effort cumul** : ~70h | **Apport** : web-insurtech-admin + impersonation + monitoring
