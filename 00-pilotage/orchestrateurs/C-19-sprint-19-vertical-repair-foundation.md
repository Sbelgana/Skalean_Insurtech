# ORCHESTRATEUR SPRINT 19 -- Phase 5 / Sprint 1 : Vertical Repair Foundation (Skalean Atlas seed)
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 19 / 35 (cumul) -- Sprint 1 dans Phase 5
**Reference meta-prompt** : `B-19-sprint-19-vertical-repair-foundation.md`
**Reference verification** : `V-19-sprint-19-verification.md`
**Numerotation taches** : 5.1.1 a 5.1.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Skalean Garage Foundation + Atlas seed

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 19 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-19** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-19 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 19

Sprint 19 (5.1) -- Vertical Repair Foundation (Skalean Atlas seed). Voir B-19-sprint-19-vertical-repair-foundation.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/
  task-5.1.1-prompt.md       # repair_garages Entity + Skalean Atlas Seed
  task-5.1.2-prompt.md       # repair_sinistres Entity + Workflow Status
  task-5.1.3-prompt.md       # repair_diagnostics Entity + Service
  task-5.1.4-prompt.md       # repair_devis Entity + PDF + Approbation
  task-5.1.5-prompt.md       # repair_orders Entity + Service
  task-5.1.6-prompt.md       # Integration Stock : Consommation Pieces Auto
  task-5.1.7-prompt.md       # Integration HR : Assignment Technicien + Heures
  task-5.1.8-prompt.md       # repair_invoices Facturation Finale
  task-5.1.9-prompt.md       # Integration Pay + Books Ecritures
  task-5.1.10-prompt.md       # repair_warranties Tracking + Reclamations
  task-5.1.11-prompt.md       # Endpoints REST + Permissions Repair
  task-5.1.12-prompt.md       # Dashboards Repair
  task-5.1.13-prompt.md       # Tests E2E + Fixtures + Seeds
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-19-sprint-19-verification.md
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
4. La verification finale V-19 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-19-sprint-19-verification.md
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

### Position du Sprint 1 dans la Phase 5

Sprint 19 (5.1) -- **Vertical Repair Foundation (Skalean Atlas seed)**.

Voir `B-19-sprint-19-vertical-repair-foundation.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

Skalean Garage Foundation + Atlas seed

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-19 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-19, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-19.

---

### Tache 1 / 13 : repair_garages Entity + Skalean Atlas Seed

**Metadonnees** : P0 | 5h | Depend de : Depend de Phase 4

**But** : Entity garages avec catalog services + capacities + specialties + Skalean Atlas comme premier seed.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.1-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_garages` :
- Migration : table `repair_garage_services` :
- Service `garages.service.ts` (CRUD) + permissions
- Seed Skalean Atlas : 1 entity + 8 services types + opening_hours Lun-Sam 8h-19h + Casablanca Mers Sultan
- Seed initial Sprint 22 ajoutera plus de garages partenaires
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairGarages.ts`
  - `repo/packages/repair/src/entities/repair-garage.entity.ts`
  - `repo/packages/repair/src/entities/repair-garage-service.entity.ts`
  - `repo/packages/repair/src/services/garages.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/garages.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration creee
  - V2 (P0) : Skalean Atlas seed reussit
  - V3 (P0) : 8 services seed

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
git commit -m "feat(sprint-19): repair_garages entity + skalean atlas seed

Task: 5.1.1
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.1"
```

---

### Tache 2 / 13 : repair_sinistres Entity + Workflow Status

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.1.1

**But** : Entity sinistres + workflow status complet (10 etats) + transitions strictes + audit trail.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.2-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_sinistres` :
- 10 etats workflow :
- Service `sinistres.service.ts` :
- Validation transitions strictes (state machine)
- Audit trail : table `repair_sinistre_status_history` (id, sinistre_id, from_status, to_status, changed_by, changed_at, comment)
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairSinistres.ts`
  - `repo/packages/repair/src/entities/repair-sinistre.entity.ts`
  - `repo/packages/repair/src/entities/repair-sinistre-status-history.entity.ts`
  - `repo/packages/repair/src/services/sinistres.service.ts`
  - `repo/packages/repair/src/services/sinistre-state-machine.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration tables + indexes
  - V2 (P0) : 10 status enum
  - V3 (P0) : State machine valide transitions

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
git commit -m "feat(sprint-19): repair_sinistres entity + workflow status

Task: 5.1.2
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.2"
```

---

### Tache 3 / 13 : repair_diagnostics Entity + Service

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.1.2

**But** : Diagnostic initial du sinistre par technicien : list problems detectes + estimation pieces necessaires + heures estimees + photos.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.3-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_diagnostics` :
- Service `diagnostics.service.ts` :
- Endpoints :
- Permissions : `repair.diagnostics.start/create/complete`
- Sprint 20 IA Estimation Photos enrichira (mock pendant Sprint 19 dev)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairDiagnostics.ts`
  - `repo/packages/repair/src/entities/repair-diagnostic.entity.ts`
  - `repo/packages/repair/src/services/diagnostics.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/diagnostics.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Diagnostic create + transition status
  - V2 (P0) : Problems addition + computation totals
  - V3 (P0) : Complete transition status

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
git commit -m "feat(sprint-19): repair_diagnostics entity + service

Task: 5.1.3
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.3"
```

---

### Tache 4 / 13 : repair_devis Entity + PDF + Approbation

**Metadonnees** : P0 | 7h | Depend de : Depend de 5.1.3

**But** : Generation devis post-diagnostic + PDF + envoi assureur/client + workflow approbation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.4-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_devis` :
- Service `devis.service.ts` :
- PDF devis : utilise PdfGenerator Sprint 10 + template `devis-reparation.hbs`
- Validity 14 jours par defaut
- Cron expire after validity
- Si police lien : envoie a assureur (Sprint 32 connecteurs Phase 7) + customer

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairDevis.ts`
  - `repo/packages/repair/src/entities/repair-devis.entity.ts`
  - `repo/packages/repair/src/services/devis.service.ts`
  - `repo/packages/repair/src/services/devis-numbering.service.ts`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/devis-reparation.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Devis creation depuis diagnostic
  - V2 (P0) : Items computation precision
  - V3 (P0) : PDF generation

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
git commit -m "feat(sprint-19): repair_devis entity + pdf + approbation

Task: 5.1.4
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.4"
```

---

### Tache 5 / 13 : repair_orders Entity + Service

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.1.4

**But** : Ordres reparation (work orders) post-devis approbation : assignment technicien + tracking heures + checklist taches.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.5-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_orders` :
- Service `orders.service.ts` :
- Tracking : heures_logged + cumul vs estimate
- Endpoints :
- Permissions : `repair.orders.*`
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairOrders.ts`
  - `repo/packages/repair/src/entities/repair-order.entity.ts`
  - `repo/packages/repair/src/services/orders.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/orders.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Order creation depuis devis approved
  - V2 (P0) : Hours tracking
  - V3 (P0) : Parts consumption integration Stock

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
git commit -m "feat(sprint-19): repair_orders entity + service

Task: 5.1.5
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.5"
```

---

### Tache 6 / 13 : Integration Stock : Consommation Pieces Auto

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.1.5

**But** : Auto-consume pieces stock via Kafka event quand `repair_orders.consumePart()` -> Sprint 13 Stock movement type='exit' + idempotency.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.6-prompt.md
```

**Actions principales attendues** :
- Consumer Kafka `repair.parts_consumed` -> Sprint 13 stock movement (deja prepare dans Sprint 13 Tache 3.6.8)
- Verification : Sprint 13 deja livre integration -- Sprint 19 emit Kafka event correct
- Tests integration end-to-end : sinistre -> diagnostic -> devis approved -> order start -> consume part -> Stock decrement + valorisation FIFO + journal entry comptable
- Edge cases : insufficient stock -> order ne peut pas continuer (validation business)

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/orders.service.ts`
  - `repo/apps/api/test/repair/integration/stock-integration.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Kafka event emis correctement
  - V2 (P0) : Stock decrement automatique
  - V3 (P0) : FIFO valorisation correcte

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
git commit -m "feat(sprint-19): integration stock : consommation pieces auto

Task: 5.1.6
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.6"
```

---

### Tache 7 / 13 : Integration HR : Assignment Technicien + Heures

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.1.6

**But** : Integration HR Sprint 13 : assignment sinistre/order a technicien employe + tracking heures workforce.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.7-prompt.md
```

**Actions principales attendues** :
- Validation assignment : technicien existe + role='technicien' + actif
- Tracking heures : update `hr_employees.hours_worked_this_month` ou table separee `hr_time_logs`
- Migration : table `hr_time_logs` :
- Service `hr-time-logs.service.ts` (cross-module : repair calls)
- Endpoint `GET /api/v1/hr/employees/:id/time-logs?month=YYYY-MM` (consume Sprint 22 web-garage UI)
- Integration paie Sprint 13 : heures workforce -> bulletin paie

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-HrTimeLogs.ts`
  - `repo/packages/hr/src/entities/hr-time-log.entity.ts`
  - `repo/packages/hr/src/services/hr-time-logs.service.ts`
  - `repo/packages/repair/src/services/orders.service.ts`
  - `repo/apps/api/src/modules/hr/controllers/time-logs.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Assignment validation
  - V2 (P0) : Hours logged automatique
  - V3 (P0) : Integration paie

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
git commit -m "feat(sprint-19): integration hr : assignment technicien + heures

Task: 5.1.7
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.7"
```

---

### Tache 8 / 13 : repair_invoices Facturation Finale

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.1.7

**But** : Facturation finale post-reparation : assureur (si police impactee) OR client (si pas police OR retract franchise).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.8-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_invoices` :
- Service `invoices.service.ts` :
- Numerotation sequentiel UNIQUE per tenant + DGI conform (Sprint 12 pattern)
- Champs DGI : ICE garage + ICE acheteur + RC + patente + TVA breakdown
- Recipient logic :
- Endpoints CRUD + send + payment

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairInvoices.ts`
  - `repo/packages/repair/src/entities/repair-invoice.entity.ts`
  - `repo/packages/repair/src/services/invoices.service.ts`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/repair-invoice.hbs`
  - `repo/apps/api/src/modules/repair/controllers/invoices.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Invoice creation depuis order completed
  - V2 (P0) : Recipient logic (insurer vs customer)
  - V3 (P0) : DGI conform fields

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
git commit -m "feat(sprint-19): repair_invoices facturation finale

Task: 5.1.8
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.8"
```

---

### Tache 9 / 13 : Integration Pay + Books Ecritures

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.1.8

**But** : Integration Pay Sprint 11 (paiement final) + Books Sprint 12 (ecritures comptables).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.9-prompt.md
```

**Actions principales attendues** :
- Trigger Pay (Sprint 11) : assureur ou customer paie facture
- Consumer Kafka `pay.transaction_captured` Sprint 11 :
- Sprint 12 Books deja consumer general -> ecriture auto :
- Sinistre status='delivered' + transition 'closed' apres paiement complet
- Tests integration

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/consumers/pay-to-invoice.consumer.ts`
  - `repo/apps/api/test/repair/integration/pay-books-integration.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Pay event -> invoice paid
  - V2 (P0) : Journal entry creee
  - V3 (P0) : Sinistre transition 'closed'

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
git commit -m "feat(sprint-19): integration pay + books ecritures

Task: 5.1.9
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.9"
```

---

### Tache 10 / 13 : repair_warranties Tracking + Reclamations

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.1.9

**But** : Garanties post-reparation : duration variable selon types pieces + reclamations dans periode garantie.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.10-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_warranties` :
- Migration : table `repair_warranty_claims` :
- Service `warranties.service.ts` :
- Cron daily : expire warranties + reminders 30j avant expiration
- Endpoints CRUD + claims
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairWarranties.ts`
  - `repo/packages/repair/src/entities/{2 entities}.ts`
  - `repo/packages/repair/src/services/warranties.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/warranties.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Warranty creation post-delivery
  - V2 (P0) : Claim submission
  - V3 (P0) : Resolution workflow

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
git commit -m "feat(sprint-19): repair_warranties tracking + reclamations

Task: 5.1.10
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.10"
```

---

### Tache 11 / 13 : Endpoints REST + Permissions Repair

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.1.10

**But** : Consolidation endpoints `/api/v1/repair/*` + permissions Repair dans matrice RBAC Sprint 7.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.11-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog Sprint 7 :
- Update PermissionsMatrix : 4 roles garage (garage_admin / garage_chef / garage_technicien / garage_gestionnaire)
- Tests permissions

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/auth/src/rbac/permissions-matrix.ts`
  - `repo/apps/api/test/repair/sprint-19-permissions.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 20+ permissions Repair
  - V2 (P0) : 4 roles garage configures
  - V3 (P0) : Tests RBAC 8+ scenarios

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
git commit -m "feat(sprint-19): endpoints rest + permissions repair

Task: 5.1.11
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.11"
```

---

### Tache 12 / 13 : Dashboards Repair

**Metadonnees** : P1 | 4h | Depend de : Depend de 5.1.11

**But** : Etendre Sprint 13 analytics avec metriques Repair-specific.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.12-prompt.md
```

**Actions principales attendues** :
- ETL Sprint 13 etendu : add tables fct_sinistres, fct_orders, fct_invoices_repair
- Dashboards :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
  - `repo/infrastructure/clickhouse/schemas/fct_{sinistres,orders,invoices_repair}.sql`
  - `repo/apps/api/src/modules/analytics/services/repair-dashboards.service.ts`

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
git commit -m "feat(sprint-19): dashboards repair

Task: 5.1.12
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.12"
```

---

### Tache 13 / 13 : Tests E2E + Fixtures + Seeds

**Metadonnees** : P0 | 10h | Depend de : Depend de 5.1.12

**But** : Suite tests E2E exhaustive + fixtures realistes + seed Skalean Atlas complete.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.13-prompt.md
```

**Actions principales attendues** :
- Garages : CRUD + Skalean Atlas seed + filters geolocation (5)
- Sinistres : workflow 10 transitions + invalid rejected + audit (10)
- Diagnostics : start + add problems + complete (3)
- Devis : create + items + send + approve + reject + expire (6)
- Orders : start + log hours + consume parts + complete (5)
- Stock integration : consume + FIFO + insufficient (3)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/repair/{40+ specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-repair-fixtures.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Skalean Atlas operationnel

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
git commit -m "feat(sprint-19): tests e2e + fixtures + seeds

Task: 5.1.13
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-19 Tache 5.1.13"
```

---


## VERIFICATION DU SPRINT 19

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-19-sprint-19-verification.md
```

Le fichier de verification V-19 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint19-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint19-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint19-verify-report.md
git commit -m "chore(sprint-19): close sprint 19 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 19 (Phase 5 / Sprint 1)
- Apport : Skalean Garage Foundation + Atlas seed
- Tests E2E cumules : {N}+

Sprint 19 completed -- handoff to Sprint 20."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 19]
   |
   v
[Tache 5.1.1: repair_garages Entity + Skalean Atlas Seed]
   | -> compile -> tests -> commit
   v
[Tache 5.1.2: repair_sinistres Entity + Workflow Status]
   | -> compile -> tests -> commit
   v
[Tache 5.1.3: repair_diagnostics Entity + Service]
   | -> compile -> tests -> commit
   v
[Tache 5.1.4: repair_devis Entity + PDF + Approbation]
   | -> compile -> tests -> commit
   v
[Tache 5.1.5: repair_orders Entity + Service]
   | -> compile -> tests -> commit
   v
[Tache 5.1.6: Integration Stock : Consommation Pieces Auto]
   | -> compile -> tests -> commit
   v
[Tache 5.1.7: Integration HR : Assignment Technicien + Heures]
   | -> compile -> tests -> commit
   v
[Tache 5.1.8: repair_invoices Facturation Finale]
   | -> compile -> tests -> commit
   v
[Tache 5.1.9: Integration Pay + Books Ecritures]
   | -> compile -> tests -> commit
   v
[Tache 5.1.10: repair_warranties Tracking + Reclamations]
   | -> compile -> tests -> commit
   v
[Tache 5.1.11: Endpoints REST + Permissions Repair]
   | -> compile -> tests -> commit
   v
[Tache 5.1.12: Dashboards Repair]
   | -> compile -> tests -> commit
   v
[Tache 5.1.13: Tests E2E + Fixtures + Seeds]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 19 -- V-19]
   |
   v
[Rapport sprint19-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : Skalean Garage Foundation + Atlas seed.

**Prerequis Sprint 20** : Sprint 19 GO complet (score >= 95% verification automatique V-19).

**Sprint suivant** : Sprint 20.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 18 (verification GO)

```bash
# Verifier Sprint 18 GO
ls skalean-insurtech/sprint18-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint18-verify-report.md
```

### Lancement Sprint 19 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-19-sprint-19-vertical-repair-foundation.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-19-sprint-19-vertical-repair-foundation.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-19-sprint-19-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-19.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 19"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint19-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-19** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-19-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-19 v2.2 detaille -- Sprint 19 (5.1) Vertical Repair Foundation (Skalean Atlas seed).**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : Skalean Garage Foundation + Atlas seed
