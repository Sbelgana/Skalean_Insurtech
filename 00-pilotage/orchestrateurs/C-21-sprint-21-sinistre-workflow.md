# ORCHESTRATEUR SPRINT 21 -- Phase 5 / Sprint 3 : Sinistre Workflow Detaille
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 21 / 35 (cumul) -- Sprint 3 dans Phase 5
**Reference meta-prompt** : `B-21-sprint-21-sinistre-workflow.md`
**Reference verification** : `V-21-sprint-21-verification.md`
**Numerotation taches** : 5.3.1 a 5.3.13
**Effort total** : ~70 heures developpement / 2 semaines
**Apport metier** : Sinistre Workflow detaille + split facturation

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 21 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-21** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-21 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 21

Sprint 21 (5.3) -- Sinistre Workflow Detaille. Voir B-21-sprint-21-sinistre-workflow.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/
  task-5.3.1-prompt.md       # Reception Vehicule
  task-5.3.2-prompt.md       # Diagnostic Enrichi : IA + Technicien
  task-5.3.3-prompt.md       # Envoi Devis : Assureur + Client + Tracking
  task-5.3.4-prompt.md       # Approbation Tracking : Conditions + Extensions
  task-5.3.5-prompt.md       # Reparation Tracking Real-Time
  task-5.3.6-prompt.md       # QC Checklist + Livraison
  task-5.3.7-prompt.md       # Facturation Split Assureur / Customer
  task-5.3.8-prompt.md       # Documents Auto-Generes
  task-5.3.9-prompt.md       # Notifications Real-Time Multi-Channel
  task-5.3.10-prompt.md       # Mock Integration Assureur
  task-5.3.11-prompt.md       # Garantie Tracking + Reclamations
  task-5.3.12-prompt.md       # Endpoints REST + Permissions
  task-5.3.13-prompt.md       # Tests E2E Workflow Complet (40+) + Edge Cases
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-21-sprint-21-verification.md
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
4. La verification finale V-21 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-21-sprint-21-verification.md
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

### Position du Sprint 3 dans la Phase 5

Sprint 21 (5.3) -- **Sinistre Workflow Detaille**.

Voir `B-21-sprint-21-sinistre-workflow.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

### Apport metier de ce sprint

Sinistre Workflow detaille + split facturation

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-21 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-21, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-21.

---

### Tache 1 / 13 : Reception Vehicule

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 20

**But** : Workflow reception vehicule : checklist arrivee + photos + verification documents customer (carte grise + permis + attestation assurance).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.1-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_receptions` :
- Service `receptions.service.ts` :
- Checklist 12 points :
- Documents customer required (Sprint 10 docs) :
- Signature reception customer : utilise Sprint 10 Barid eSign signature simple (acceptation reception)
- Endpoints REST + permissions

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairReceptions.ts`
  - `repo/packages/repair/src/entities/repair-reception.entity.ts`
  - `repo/packages/repair/src/services/receptions.service.ts`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/reception-checklist.hbs`
  - `repo/apps/api/src/modules/repair/controllers/receptions.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Reception start + photos + checklist
  - V2 (P0) : 3 documents customer uploaded
  - V3 (P0) : Signature reception customer

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
git commit -m "feat(sprint-21): reception vehicule

Task: 5.3.1
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.1"
```

---

### Tache 2 / 13 : Diagnostic Enrichi : IA + Technicien

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.3.1

**But** : Workflow diagnostic complet : IA suggestions Sprint 20 + technicien expertise + photos additionnelles + rapport technique PDF.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.2-prompt.md
```

**Actions principales attendues** :
- Update Sprint 19 `diagnostics.service.ts` :
- Rapport technique structure :
- Endpoint `POST /api/v1/repair/diagnostics/:id/generate-report`
- Auto-attach rapport au sinistre + envoie assureur si police impactee
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/diagnostics.service.ts`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Diagnostic enriched IA + technicien
  - V2 (P0) : Photos additionnelles upload
  - V3 (P0) : Rapport technique PDF generated

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
git commit -m "feat(sprint-21): diagnostic enrichi : ia + technicien

Task: 5.3.2
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.2"
```

---

### Tache 3 / 13 : Envoi Devis : Assureur + Client + Tracking

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.3.2

**But** : Workflow envoi devis : recipients selon contexte + tracking lecture/approbation + relances automatiques.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.3-prompt.md
```

**Actions principales attendues** :
- Update Sprint 19 `devis.service.ts.send()` :
- Migration : ajouter colonnes `repair_devis.read_at` + `read_by_type` ('insurer' | 'customer')
- Cron relances :
- Mock assureur : simule webhook approbation 1-3 jours apres send (env `MOCK_INSURER_APPROVAL_DELAY_HOURS`)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddDevisReadTracking.ts`
  - `repo/packages/repair/src/services/devis.service.ts`
  - `repo/packages/repair/src/jobs/devis-relances-cron.ts`
  - `repo/packages/repair/src/services/mock-insurer-approval.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Recipients logic correct
  - V2 (P0) : Tracking lecture
  - V3 (P0) : Relances automatiques

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
git commit -m "feat(sprint-21): envoi devis : assureur + client + tracking

Task: 5.3.3
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.3"
```

---

### Tache 4 / 13 : Approbation Tracking : Conditions + Extensions

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.3.3

**But** : Tracking approbation enrichi : conditions assureur (franchise applicable, exclusions, plafond) + extensions (devis additionnel pieces decouvert in-progress).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.4-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_devis_approvals` :
- Service `devis-approvals.service.ts` :
- Workflow extensions :
- Migration : ajouter `repair_devis.parent_devis_id` (FK self : avenant)
- Endpoints :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairDevisApprovals.ts`
  - `repo/packages/repair/src/entities/repair-devis-approval.entity.ts`
  - `repo/packages/repair/src/services/devis-approvals.service.ts`
  - `repo/apps/api/src/modules/repair/controllers/devis-approvals.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Approval avec conditions stockees
  - V2 (P0) : Avenants supported
  - V3 (P0) : getApprovalConditions retourne data complete

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
git commit -m "feat(sprint-21): approbation tracking : conditions + extensions

Task: 5.3.4
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.4"
```

---

### Tache 5 / 13 : Reparation Tracking Real-Time

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.3.4

**But** : Tracking advanced reparation : % completion + parts arrived + technicien hours en temps reel.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.5-prompt.md
```

**Actions principales attendues** :
- Update Sprint 19 `repair_orders` entity :
- Service `orders-tracking.service.ts` :
- Real-time updates : Kafka events + Sprint 18 mobile assure poll status (Sprint 23 garage app real-time)
- Notifications customer : milestones (50% completion, 100% completed, ready for delivery)
- Endpoints :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddOrderTrackingColumns.ts`
  - `repo/packages/repair/src/services/orders-tracking.service.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-progress-update.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : % completion tracking
  - V2 (P0) : Parts arrival tracking
  - V3 (P0) : Hours logged HR

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
git commit -m "feat(sprint-21): reparation tracking real-time

Task: 5.3.5
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.5"
```

---

### Tache 6 / 13 : QC Checklist + Livraison

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.3.5

**But** : Quality Control checklist post-reparation + livraison customer avec signature reception + photos final + bon livraison.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.6-prompt.md
```

**Actions principales attendues** :
- Migration : table `repair_quality_checks` :
- Migration : table `repair_deliveries` :
- Service `quality-checks.service.ts` :
- Service `deliveries.service.ts` :
- QC checklist 10 points :
- Endpoints

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-RepairQualityChecks.ts`
  - `repo/packages/database/src/migrations/{date}-RepairDeliveries.ts`
  - `repo/packages/repair/src/entities/{2 entities}.ts`
  - `repo/packages/repair/src/services/quality-checks.service.ts`
  - `repo/packages/repair/src/services/deliveries.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : QC 10 points + photos
  - V2 (P0) : QC failed -> re-work
  - V3 (P0) : Delivery + signature

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
git commit -m "feat(sprint-21): qc checklist + livraison

Task: 5.3.6
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.6"
```

---

### Tache 7 / 13 : Facturation Split Assureur / Customer

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.3.6

**But** : Facturation split intelligente : montant assureur (couverture police) + montant customer (franchise + non-couvert).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.7-prompt.md
```

**Actions principales attendues** :
- Update Sprint 19 `invoices.service.ts.createFromCompletedOrder()` :
- Migration : ajouter `repair_invoices.split_parent_id` (FK self : 2 factures liees same sinistre)
- Reglements :
- Tests : split correct + edge cases (full coverage = customer 0, exclusion = customer paie)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddInvoiceSplitParent.ts`
  - `repo/packages/repair/src/services/invoices.service.ts`
  - `repo/packages/repair/src/services/invoices.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Split correct (insurer + customer)
  - V2 (P0) : Pas police : customer full
  - V3 (P0) : Coverage cap respect

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
git commit -m "feat(sprint-21): facturation split assureur / customer

Task: 5.3.7
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.7"
```

---

### Tache 8 / 13 : Documents Auto-Generes

**Metadonnees** : P0 | 6h | Depend de : Depend de 5.3.7

**But** : Auto-generation documents officiels chaque etape : rapport diagnostic + bon de reception + bon livraison + certificat conformite.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.8-prompt.md
```

**Actions principales attendues** :
- Documents auto-generes (utilise Sprint 10 Docs+Signature) :
- Templates 3 locales chacun
- Auto-attach a sinistre + envoi destinataires automatique via Comm Sprint 9
- Archive : tous documents archives 10 ans (loi 43-20)
- Endpoint `GET /api/v1/repair/sinistres/:id/documents` (liste tous documents lies)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-reception.hbs`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/diagnostic-report.hbs`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/devis-approval.hbs`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/bon-livraison.hbs`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/certificat-conformite-reparation.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 documents auto-generes
  - V2 (P0) : Templates 3 locales
  - V3 (P0) : Auto-attach sinistre

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
git commit -m "feat(sprint-21): documents auto-generes

Task: 5.3.8
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.8"
```

---

### Tache 9 / 13 : Notifications Real-Time Multi-Channel

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.3.8

**But** : Notifications real-time chaque etape sinistre : email + WhatsApp + push notifications PWA Sprint 18.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.9-prompt.md
```

**Actions principales attendues** :
- Templates Comm Sprint 9 :
- Auto-trigger notifications via Kafka consumers `repair.sinistre.*` events
- Channels per notification :
- Locale : utilise customer.preferred_language Sprint 8
- Tests integration

**Fichiers cibles principaux** :
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/repair-{8 templates}.hbs`
  - `repo/packages/repair/src/consumers/repair-events-to-comm.consumer.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 8 templates locales 3 langues
  - V2 (P0) : Auto-trigger sur events Kafka
  - V3 (P0) : Multi-channel selon urgency

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
git commit -m "feat(sprint-21): notifications real-time multi-channel

Task: 5.3.9
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.9"
```

---

### Tache 10 / 13 : Mock Integration Assureur

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.3.9

**But** : Mock service simulant integration assureur (push devis + receive approbation) -- Sprint 32 (Phase 7) reel via connecteurs.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.10-prompt.md
```

**Actions principales attendues** :
- Service `mock-insurer-integration.service.ts` :
- Cron `mock-insurer-callbacks.job` :
- Cron retourne approval ou rejection avec conditions realistic :
- Sprint 32 reel : MockService swap par RealConnectorService (5 assureurs)
- Tests : verify mock callbacks
- Documentation pattern swap

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/mock-insurer-integration.service.ts`
  - `repo/packages/repair/src/jobs/mock-insurer-callbacks.cron.ts`
  - `repo/docs/insurer-integration-migration-sprint-32.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Mock pushDevis log + scheduled callback
  - V2 (P0) : Cron declenche callbacks
  - V3 (P0) : Approval realistic + Rejection 10%

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
git commit -m "feat(sprint-21): mock integration assureur

Task: 5.3.10
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.10"
```

---

### Tache 11 / 13 : Garantie Tracking + Reclamations

**Metadonnees** : P0 | 5h | Depend de : Depend de 5.3.10

**But** : Workflow garantie post-livraison enrichi : tracking expiration + reclamations + intervention curative gratuite (re-reparation pieces defectueuses).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.11-prompt.md
```

**Actions principales attendues** :
- Update Sprint 19 `repair_warranties` entity :
- Service `warranty-claims.service.ts` (Sprint 19 ebauche, Sprint 21 enrichi) :
- Cron daily : expire warranties + envoie reminders 30j avant expiration
- Endpoint customer Sprint 18 : `POST /api/v1/repair/warranties/:id/claim` (declaration reclamation depuis mobile)
- Notifications customer + garage
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/repair/src/services/warranty-claims.service.ts`
  - `repo/packages/repair/src/jobs/warranty-expiry-reminder.cron.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/warranty-{expires-soon,claim-received}.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Submit claim workflow
  - V2 (P0) : Re-repair free cree nouveau sinistre
  - V3 (P0) : Partial refund Pay integration

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
git commit -m "feat(sprint-21): garantie tracking + reclamations

Task: 5.3.11
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.11"
```

---

### Tache 12 / 13 : Endpoints REST + Permissions

**Metadonnees** : P0 | 4h | Depend de : Depend de 5.3.11

**But** : Consolidation endpoints REST + permissions enrichies catalog Sprint 7.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.12-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog :
- Update PermissionsMatrix : roles garage_* enrichis
- Tests permissions

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/auth/src/rbac/permissions-matrix.ts`
  - `repo/apps/api/test/repair/sprint-21-permissions.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ permissions Sprint 21 ajoutees
  - V2 (P0) : Roles enrichis
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
git commit -m "feat(sprint-21): endpoints rest + permissions

Task: 5.3.12
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.12"
```

---

### Tache 13 / 13 : Tests E2E Workflow Complet (40+) + Edge Cases

**Metadonnees** : P0 | 9h | Depend de : Depend de 5.3.12

**But** : Suite tests E2E exhaustive workflow end-to-end + edge cases + fixtures realistic.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-21-sinistre-workflow/task-5.3.13-prompt.md
```

**Actions principales attendues** :
- Workflow happy path complete : declared -> closed (1 test long mais critical) (1)
- Reception : checklist + photos + documents (4)
- Diagnostic : IA + technicien + rapport (3)
- Devis : envoi + tracking + approval + relances (5)
- Approbation : conditions + extensions avenants (4)
- Reparation tracking : milestones + parts + hours (5)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/repair/sprint-21-workflow/{40+ specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-sprint-21-fixtures.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Edge cases couverts

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
git commit -m "feat(sprint-21): tests e2e workflow complet (40+) + edge cases

Task: 5.3.13
Sprint: 21 (Phase 5 / Sprint 3)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Decisions: see B-21 Tache 5.3.13"
```

---


## VERIFICATION DU SPRINT 21

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-21-sprint-21-verification.md
```

Le fichier de verification V-21 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint21-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint21-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint21-verify-report.md
git commit -m "chore(sprint-21): close sprint 21 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 5 (Vertical Repair (Skalean Garage ERP))
- Sprint : 21 (Phase 5 / Sprint 3)
- Apport : Sinistre Workflow detaille + split facturation
- Tests E2E cumules : {N}+

Sprint 21 completed -- handoff to Sprint 22."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 21]
   |
   v
[Tache 5.3.1: Reception Vehicule]
   | -> compile -> tests -> commit
   v
[Tache 5.3.2: Diagnostic Enrichi : IA + Technicien]
   | -> compile -> tests -> commit
   v
[Tache 5.3.3: Envoi Devis : Assureur + Client + Tracking]
   | -> compile -> tests -> commit
   v
[Tache 5.3.4: Approbation Tracking : Conditions + Extensions]
   | -> compile -> tests -> commit
   v
[Tache 5.3.5: Reparation Tracking Real-Time]
   | -> compile -> tests -> commit
   v
[Tache 5.3.6: QC Checklist + Livraison]
   | -> compile -> tests -> commit
   v
[Tache 5.3.7: Facturation Split Assureur / Customer]
   | -> compile -> tests -> commit
   v
[Tache 5.3.8: Documents Auto-Generes]
   | -> compile -> tests -> commit
   v
[Tache 5.3.9: Notifications Real-Time Multi-Channel]
   | -> compile -> tests -> commit
   v
[Tache 5.3.10: Mock Integration Assureur]
   | -> compile -> tests -> commit
   v
[Tache 5.3.11: Garantie Tracking + Reclamations]
   | -> compile -> tests -> commit
   v
[Tache 5.3.12: Endpoints REST + Permissions]
   | -> compile -> tests -> commit
   v
[Tache 5.3.13: Tests E2E Workflow Complet (40+) + Edge Cases]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 21 -- V-21]
   |
   v
[Rapport sprint21-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 70 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/repair, apps/web-garage, apps/web-garage-mobile, cross_tenant tables

**Apport metier principal** : Sinistre Workflow detaille + split facturation.

**Prerequis Sprint 22** : Sprint 21 GO complet (score >= 95% verification automatique V-21).

**Sprint suivant** : Sprint 22.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 20 (verification GO)

```bash
# Verifier Sprint 20 GO
ls skalean-insurtech/sprint20-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint20-verify-report.md
```

### Lancement Sprint 21 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-21-sprint-21-sinistre-workflow.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-21-sprint-21-sinistre-workflow.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-21-sprint-21-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-21.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 21"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint21-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-21** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-21-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-21 v2.2 detaille -- Sprint 21 (5.3) Sinistre Workflow Detaille.**

**Total taches detaillees** : 13 | **Effort cumul** : ~70h | **Apport** : Sinistre Workflow detaille + split facturation
