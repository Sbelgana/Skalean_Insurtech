# ORCHESTRATEUR SPRINT 24 -- Phase 5 / Sprint 6 : Flux Sinistre Client M8 End-to-End
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 24 / 35 (cumul) -- Sprint 6 dans Phase 5
**Reference meta-prompt** : `B-24-sprint-24-flux-sinistre-client.md`
**Reference verification** : `V-24-sprint-24-verification.md`
**Numerotation taches** : 5.6.1 a 5.6.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Premier flux M8 marche MA (sinistre client end-to-end)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 24 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-24** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-24 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 24

Sprint 24 (5.6) -- Flux Sinistre Client M8 End-to-End. Voir B-24-sprint-24-flux-sinistre-client.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/
  task-5.6.1-prompt.md       # Workflow M8 Documente
  task-5.6.2-prompt.md       # Cross-Tenant Sinistre Routing
  task-5.6.3-prompt.md       # Validation Auto Pre-Screening
  task-5.6.4-prompt.md       # Dispatch Garage Workflow
  task-5.6.5-prompt.md       # Sinistre Cycle Tracker (Vue 360)
  task-5.6.6-prompt.md       # Notifications Coordonnees Multi-Parties
  task-5.6.7-prompt.md       # Dashboard "Mon Sinistre" Assure
  task-5.6.8-prompt.md       # Dashboard Broker Read-Only Sinistres
  task-5.6.9-prompt.md       # Dashboard Chef Garage : Pipeline + KPIs
  task-5.6.10-prompt.md       # Endpoints REST Cross-Tenant + Permissions
  task-5.6.11-prompt.md       # Audit Trail Cross-Tenant + Kafka Coordination
  task-5.6.12-prompt.md       # Documentation Flux M8
  task-5.6.13-prompt.md       # Tests E2E End-to-End (40+) : 1 Sinistre 5 Apps
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-24-sprint-24-verification.md
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
4. La verification finale V-24 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-24-sprint-24-verification.md
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

### Position du Sprint 6 dans la Phase 5

Sprint 24 (5.6) -- **Flux Sinistre Client M8 End-to-End**.

Voir `B-24-sprint-24-flux-sinistre-client.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

Premier flux M8 marche MA (sinistre client end-to-end)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-24 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-24, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-24.

---

### Tache 1 / 13 : Workflow M8 Documente

**Metadonnees** : P0 | 5h | Depend de : Depend de Phase 5

**But** : Documenter workflow M8 complet : flow diagram + states transitions + responsabilites + SLA + edge cases.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.1-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/workflow-m8-flux-sinistre-client.md`
- Sections :
- Diagrammes : Mermaid syntax (versionne avec code)
- Distribution : equipe technique + business + legal review
- Tests : workflow validation par scenarios humains (review)

**Fichiers cibles principaux** :
  - `repo/docs/workflow-m8-flux-sinistre-client.md`
  - `repo/docs/workflow-m8-comparison-m0.md`
  - `repo/docs/workflow-m8-sla-table.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Document complet 8 etapes
  - V2 (P0) : 5+ diagrammes sequences
  - V3 (P0) : SLA per etape definis

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
git commit -m "feat(sprint-24): workflow m8 documente

Task: 5.6.1
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.1"
```

---

### Tache 2 / 13 : Cross-Tenant Sinistre Routing

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.6.1

**But** : Mecanisme cross-tenant sinistre creation : assure declare dans tenant assure (insure) -> sinistre propage au tenant garage choisi (repair) avec data sharing controle.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.2-prompt.md
```

**Actions principales attendues** :
- Migration : table `sinistre_cross_tenant_links` (table cross-tenant centralisee, pas RLS) :
- Service `cross-tenant-sinistre-routing.service.ts` (super-tenant context) :
- Privileged context : utilise super-tenant role pour cross-tenant operations
- Audit complete : qui a access cross-tenant + when
- Endpoint `POST /api/v1/repair/sinistres/:id/dispatch` (super admin OR assure self-action)
- Tests : routing + isolation + audit

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-SinistreCrossTenantLinks.ts`
  - `repo/packages/repair/src/entities/sinistre-cross-tenant-link.entity.ts`
  - `repo/packages/repair/src/services/cross-tenant-sinistre-routing.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/sinistres-dispatch.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Dispatch source -> target tenant
  - V2 (P0) : Validation police + capacity
  - V3 (P0) : Tenant context switch correct

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
git commit -m "feat(sprint-24): cross-tenant sinistre routing

Task: 5.6.2
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.2"
```

---

### Tache 3 / 13 : Validation Auto Pre-Screening

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.6.2

**But** : Validations auto avant dispatch garage : couverture police OK + vehicle eligible + fraud rules basiques.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.3-prompt.md
```

**Actions principales attendues** :
- Service `sinistre-pre-screening.service.ts` :
- Si validations OK : status -> 'acknowledged' auto OR manual broker review (selon settings tenant)
- Si fail : status -> 'pending_review_broker' + notification broker
- Endpoint `GET /api/v1/insure/sinistres/:id/pre-screening` (preview validation)
- Tests : validations + edge cases

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/sinistre-pre-screening.service.ts`
  - `repo/packages/insure/src/services/fraud-rules-basics.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 7 validations executees
  - V2 (P0) : Errors classified
  - V3 (P0) : Auto-acknowledge si tout OK

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
git commit -m "feat(sprint-24): validation auto pre-screening

Task: 5.6.3
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.3"
```

---

### Tache 4 / 13 : Dispatch Garage Workflow

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.6.3

**But** : Workflow dispatch chef garage : recoit notification -> review sinistre -> assign technicien + schedule appointment.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.4-prompt.md
```

**Actions principales attendues** :
- Notification chef garage : push + email + WhatsApp (Sprint 9 Comm)
- Page Sprint 22 web-garage : "Sinistres pending dispatch" (queue)
- Workflow chef garage :
- Auto-suggestion technicien : algorithm round-robin + skill match (specialty Sprint 19)
- Si chef garage rejette : sinistre cancelled + assure notification + suggested re-dispatch other garage
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/dispatch-workflow.service.ts`
  - `repo/packages/repair/src/services/technician-suggestion.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/dispatch.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Notification chef garage
  - V2 (P0) : Auto-suggestion technicien
  - V3 (P0) : Accept dispatch + appointment

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
git commit -m "feat(sprint-24): dispatch garage workflow

Task: 5.6.4
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.4"
```

---

### Tache 5 / 13 : Sinistre Cycle Tracker (Vue 360)

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.6.4

**But** : Entity centralisee `sinistre_cycle_trackers` : vue 360 cross-tenant pour visualization assure / broker / garage du cycle complet.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.5-prompt.md
```

**Actions principales attendues** :
- Migration : table `sinistre_cycle_trackers` (super-tenant) :
- Service `cycle-tracker.service.ts` :
- 8 phases M8 :
- SLA tracking : compute expected_completion vs actual + status
- Endpoint `GET /api/v1/sinistres/:id/cycle-view?perspective=assure`
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-SinistreCycleTrackers.ts`
  - `repo/packages/repair/src/entities/sinistre-cycle-tracker.entity.ts`
  - `repo/packages/repair/src/services/cycle-tracker.service.ts`
  - `repo/apps/api/src/modules/sinistres/controllers/cycle-view.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Tracker created auto
  - V2 (P0) : 8 phases tracked
  - V3 (P0) : SLA computed

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
git commit -m "feat(sprint-24): sinistre cycle tracker (vue 360)

Task: 5.6.5
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.5"
```

---

### Tache 6 / 13 : Notifications Coordonnees Multi-Parties

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.6.5

**But** : Orchestrer notifications chaque transition phase pour 3 parties : assure (Sprint 18 mobile) + broker (web-broker Sprint 16) + garage (Sprint 22/23).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.6-prompt.md
```

**Actions principales attendues** :
- Templates Comm Sprint 9 (cross-tenant aware) :
- Channels per party :
- Auto-trigger via Kafka events `sinistre.cycle.phase_*`
- Locale customer respect (preferred_language)
- Tests integration coordination

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/m8/{30+ templates}.hbs`
  - `repo/packages/repair/src/consumers/cycle-events-to-notifications.consumer.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 30+ templates 3 locales
  - V2 (P0) : 4 parties notified per role
  - V3 (P0) : Channels per role correct

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
git commit -m "feat(sprint-24): notifications coordonnees multi-parties

Task: 5.6.6
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.6"
```

---

### Tache 7 / 13 : Dashboard "Mon Sinistre" Assure

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.6.6

**But** : Enrichir Sprint 18 web-assure-mobile : page "Mon Sinistre" avec vue 360 cycle complet + ETA + photos progress.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.7-prompt.md
```

**Actions principales attendues** :
- Update Sprint 18 page `/sinistres/:id` :
- Real-time updates : poll 30s OR push notifications
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-assure-mobile/app/[locale]/sinistres/[id]/page.tsx`
  - `repo/packages/assure-shared/src/components/sinistre-cycle-timeline.tsx`
  - `repo/packages/assure-shared/src/components/sinistre-parties.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cycle timeline 8 phases
  - V2 (P0) : ETA visible
  - V3 (P0) : Parties contact

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
git commit -m "feat(sprint-24): dashboard mon sinistre assure

Task: 5.6.7
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.7"
```

---

### Tache 8 / 13 : Dashboard Broker Read-Only Sinistres

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.6.7

**But** : Enrichir Sprint 16 web-broker : page sinistres read-only enrichie avec cycle 360 visible.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.8-prompt.md
```

**Actions principales attendues** :
- Update Sprint 16 page `/sinistres/:id` :
- Permission `repair.sinistres.read` (deja Sprint 21)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Vue 360 broker
  - V2 (P0) : Read-only respect
  - V3 (P0) : Tests 4+ scenarios

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
git commit -m "feat(sprint-24): dashboard broker read-only sinistres

Task: 5.6.8
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.8"
```

---

### Tache 9 / 13 : Dashboard Chef Garage : Pipeline + KPIs

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.6.8

**But** : Enrichir Sprint 22 web-garage : dashboard chef garage avec pipeline dispatch + KPIs operations.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.9-prompt.md
```

**Actions principales attendues** :
- Page `/dispatch-pipeline` (chef garage) :
- Endpoints stats consume Sprint 13 analytics
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/web-garage/app/[locale]/(protected)/dispatch-pipeline/page.tsx`
  - `repo/apps/web-garage/components/dispatch/{several components}.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Pipeline visible
  - V2 (P0) : KPIs accurate
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
git commit -m "feat(sprint-24): dashboard chef garage : pipeline + kpis

Task: 5.6.9
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.9"
```

---

### Tache 10 / 13 : Endpoints REST Cross-Tenant + Permissions

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.6.9

**But** : Consolidation endpoints cross-tenant + permissions specifiques M8.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.10-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog Sprint 7 :
- Privilege escalation rules : cross-tenant operations require super-tenant role OR specific authorization
- Tests RBAC cross-tenant

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/auth/src/rbac/cross-tenant-policies.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Permissions cross-tenant
  - V2 (P0) : Privilege escalation rules
  - V3 (P0) : Tests 8+ scenarios

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
git commit -m "feat(sprint-24): endpoints rest cross-tenant + permissions

Task: 5.6.10
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.10"
```

---

### Tache 11 / 13 : Audit Trail Cross-Tenant + Kafka Coordination

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.6.10

**But** : Audit trail enrichi cross-tenant + Kafka events coordination phases.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.11-prompt.md
```

**Actions principales attendues** :
- Kafka events :
- Audit log enrichi : `cross_tenant_action` flag pour operations sensibles
- Sprint 13 ETL etend : sync `sinistre_cycle_trackers` -> ClickHouse
- Dashboard "M8 Performance" Sprint 27 admin
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
  - `repo/infrastructure/clickhouse/schemas/fct_sinistre_cycles.sql`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 8 Kafka events specifiques
  - V2 (P0) : Audit cross-tenant flag
  - V3 (P0) : ETL ClickHouse

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
git commit -m "feat(sprint-24): audit trail cross-tenant + kafka coordination

Task: 5.6.11
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.11"
```

---

### Tache 12 / 13 : Documentation Flux M8

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.6.11

**But** : Documentation finale flux M8 pour stakeholders : technique + business + legal review.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.12-prompt.md
```

**Actions principales attendues** :
- Document `repo/docs/m8-implementation-guide.md`
- Document `repo/docs/m8-comparison-vs-traditional.md` (pour business + investisseurs)
- Document `repo/docs/m8-acaps-compliance.md` (legal review pour ACAPS)
- Architecture diagram complet
- FAQ : edge cases + troubleshooting

**Fichiers cibles principaux** :
  - `repo/docs/m8-implementation-guide.md`
  - `repo/docs/m8-comparison-vs-traditional.md`
  - `repo/docs/m8-acaps-compliance.md`
  - `repo/docs/m8-architecture-diagram.mermaid`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 4 documents complets
  - V2 (P0) : Diagrams Mermaid
  - V3 (P0) : Review ready

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
git commit -m "feat(sprint-24): documentation flux m8

Task: 5.6.12
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.12"
```

---

### Tache 13 / 13 : Tests E2E End-to-End (40+) : 1 Sinistre 5 Apps

**Metadonnees** : P0 | 12h | Depend de : Depend de 5.6.12

**But** : Suite tests E2E exhaustive : 1 sinistre traverse cycle complet 5 apps + edge cases.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-24-flux-sinistre-client/task-5.6.13-prompt.md
```

**Actions principales attendues** :
- **Test signature : Happy path complete (1 test long ~10min)** :
- Edge cases (10+) : assure cancel + garage refuse + parts delay + QC fail + mock assureur reject + cross-tenant capacity full
- Cross-tenant isolation : assure tenant pas visible garage tenant + reverse
- Notifications coordonnees : 8 phases x 3 parties = 24 notifications check
- Cycle view perspectives : 3 roles different views

**Fichiers cibles principaux** :
  - `repo/apps/api/test/integration/m8-end-to-end-happy-path.e2e-spec.ts`
  - `repo/apps/api/test/integration/m8-edge-cases/{15+ specs}.e2e-spec.ts`
  - `repo/apps/api/test/integration/m8-cross-tenant-isolation.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Happy path complete passe
  - V2 (P0) : Edge cases couverts
  - V3 (P0) : Cross-tenant isolation

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
git commit -m "feat(sprint-24): tests e2e end-to-end (40+) : 1 sinistre 5 apps

Task: 5.6.13
Sprint: 24 (Phase 5 / Sprint 6)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-24 Tache 5.6.13"
```

---


## VERIFICATION DU SPRINT 24

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-24-sprint-24-verification.md
```

Le fichier de verification V-24 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint24-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint24-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint24-verify-report.md
git commit -m "chore(sprint-24): close sprint 24 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 24 (Phase 5 / Sprint 6)
- Apport : Premier flux M8 marche MA (sinistre client end-to-end)
- Tests E2E cumules : {N}+

Sprint 24 completed -- handoff to Sprint 25."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 24]
   |
   v
[Tache 5.6.1: Workflow M8 Documente]
   | -> compile -> tests -> commit
   v
[Tache 5.6.2: Cross-Tenant Sinistre Routing]
   | -> compile -> tests -> commit
   v
[Tache 5.6.3: Validation Auto Pre-Screening]
   | -> compile -> tests -> commit
   v
[Tache 5.6.4: Dispatch Garage Workflow]
   | -> compile -> tests -> commit
   v
[Tache 5.6.5: Sinistre Cycle Tracker (Vue 360)]
   | -> compile -> tests -> commit
   v
[Tache 5.6.6: Notifications Coordonnees Multi-Parties]
   | -> compile -> tests -> commit
   v
[Tache 5.6.7: Dashboard "Mon Sinistre" Assure]
   | -> compile -> tests -> commit
   v
[Tache 5.6.8: Dashboard Broker Read-Only Sinistres]
   | -> compile -> tests -> commit
   v
[Tache 5.6.9: Dashboard Chef Garage : Pipeline + KPIs]
   | -> compile -> tests -> commit
   v
[Tache 5.6.10: Endpoints REST Cross-Tenant + Permissions]
   | -> compile -> tests -> commit
   v
[Tache 5.6.11: Audit Trail Cross-Tenant + Kafka Coordination]
   | -> compile -> tests -> commit
   v
[Tache 5.6.12: Documentation Flux M8]
   | -> compile -> tests -> commit
   v
[Tache 5.6.13: Tests E2E End-to-End (40+) : 1 Sinistre 5 Apps]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 24 -- V-24]
   |
   v
[Rapport sprint24-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : Premier flux M8 marche MA (sinistre client end-to-end).

**Prerequis Sprint 25** : Sprint 24 GO complet (score >= 95% verification automatique V-24).

**Sprint suivant** : Sprint 25.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 23 (verification GO)

```bash
# Verifier Sprint 23 GO
ls skalean-insurtech/sprint23-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint23-verify-report.md
```

### Lancement Sprint 24 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-24-sprint-24-flux-sinistre-client.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-24-sprint-24-flux-sinistre-client.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-24-sprint-24-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-24.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 24"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint24-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-24** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-24-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-24 v2.2 detaille -- Sprint 24 (5.6) Flux Sinistre Client M8 End-to-End.**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : Premier flux M8 marche MA (sinistre client end-to-end)
