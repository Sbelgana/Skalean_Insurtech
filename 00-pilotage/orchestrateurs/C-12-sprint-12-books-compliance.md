# ORCHESTRATEUR SPRINT 12 -- Phase 3 / Sprint 5 : Books CGNC + Compliance ACAPS/DGI/AMC
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 12 / 35 (cumul) -- Sprint 5 dans Phase 3
**Reference meta-prompt** : `B-12-sprint-12-books-compliance.md`
**Reference verification** : `V-12-sprint-12-verification.md`
**Numerotation taches** : 3.5.1 a 3.5.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Plan CGNC + ACAPS reports + DGI SAFT-MA + AMC AML

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 12 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-12** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-12 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 12

Sprint 12 (3.5) -- Books CGNC + Compliance ACAPS/DGI/AMC. Voir B-12-sprint-12-books-compliance.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/
  task-3.5.1-prompt.md       # Plan Comptable CGNC Seed + AccountChart Entity
  task-3.5.2-prompt.md       # books_journal_entries Entity + JournalService
  task-3.5.3-prompt.md       # Auto-Generation Ecritures depuis Pay Events
  task-3.5.4-prompt.md       # TVA Service + 5 Taux MA
  task-3.5.5-prompt.md       # Invoices Module : Numerotation Legale + Format DGI
  task-3.5.6-prompt.md       # Bilan + Compte Resultat Generation
  task-3.5.7-prompt.md       # ACAPS Report Framework + compliance_acaps_reports Entity
  task-3.5.8-prompt.md       # Report Trimestriel : Portefeuille Polices + Sinistres
  task-3.5.9-prompt.md       # Report Annuel : Solvabilite + Reserves Techniques
  task-3.5.10-prompt.md       # AML Monitoring + Alertes AMC
  task-3.5.11-prompt.md       # SAFT-MA Export XML
  task-3.5.12-prompt.md       # Endpoints REST + Scheduled Jobs
  task-3.5.13-prompt.md       # Tests E2E (30+) + Fixtures + Seeds
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-12-sprint-12-verification.md
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
4. La verification finale V-12 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-12-sprint-12-verification.md
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

## CONTEXTE PHASE 3 -- Modules Horizontaux

### Position du Sprint 5 dans la Phase 3

Sprint 12 (3.5) -- **Books CGNC + Compliance ACAPS/DGI/AMC**.

Voir `B-12-sprint-12-books-compliance.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

### Apport metier de ce sprint

Plan CGNC + ACAPS reports + DGI SAFT-MA + AMC AML

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-12 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-12, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-12.

---

### Tache 1 / 13 : Plan Comptable CGNC Seed + AccountChart Entity

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 11

**But** : Charger le **Plan Comptable General Marocain (CGNC)** complet : classes 1-9 + sous-comptes standards + comptes specifiques metier insurtech.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.1-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/books/src/entities/books-account.entity.ts` :
- Migration TypeORM table `books_accounts`
- Seed `seed-cgnc-plan.ts` : ~250 comptes standards CGNC (classes 1-9 hierarchique)
- Seed comptes specifiques insurtech :
- Service `repo/packages/books/src/services/account-chart.service.ts` :
- Endpoint `GET /api/v1/books/accounts` (liste avec hierarchy)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-BooksAccounts.ts`
  - `repo/packages/books/src/entities/books-account.entity.ts`
  - `repo/packages/books/src/seeds/cgnc-classes.ts`
  - `repo/packages/books/src/seeds/insurtech-accounts.ts`
  - `repo/packages/books/src/services/account-chart.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Seed CGNC reussi (250+ comptes)
  - V2 (P0) : Hierarchy correct (parent/child)
  - V3 (P0) : Comptes insurtech presents (4421-4425, 706x)

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
git commit -m "feat(sprint-12): plan comptable cgnc seed + accountchart entity

Task: 3.5.1
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.1"
```

---

### Tache 2 / 13 : books_journal_entries Entity + JournalService

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.5.1

**But** : Implementer ecritures comptables : double-entry bookkeeping (debit/credit), journal entries balanced, validation rules.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.2-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/books/src/entities/books-journal-entry.entity.ts` :
- Entity `repo/packages/books/src/entities/books-journal-line.entity.ts` :
- Migrations TypeORM
- Service `journal.service.ts` :
- Validation : double-entry balanced (sum debits = sum credits) sinon BadRequestException
- Validation : tous accounts existent (FK + active)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-BooksJournalEntries.ts`
  - `repo/packages/books/src/entities/books-journal-entry.entity.ts`
  - `repo/packages/books/src/entities/books-journal-line.entity.ts`
  - `repo/packages/books/src/services/journal.service.ts`
  - `repo/packages/books/src/services/journal-numbering.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Entry balanced (debits = credits) accepte
  - V2 (P0) : Entry imbalanced rejete avec details
  - V3 (P0) : Entry vide rejete

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
git commit -m "feat(sprint-12): books_journal_entries entity + journalservice

Task: 3.5.2
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.2"
```

---

### Tache 3 / 13 : Auto-Generation Ecritures depuis Pay Events

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.5.2

**But** : Consumer Kafka qui ecoute events `pay.transaction_captured` (Sprint 11) + auto-genere ecriture comptable correspondante.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.3-prompt.md
```

**Actions principales attendues** :
- Consumer `repo/packages/books/src/consumers/pay-to-journal.consumer.ts` extends KafkaConsumerBase
- Topic : `insurtech.events.pay.transaction_captured`
- Pattern ecriture standard (encaissement client) :
- Si transaction liee a invoice : reverse la creance precedente
- Mapping providers -> comptes :
- Auto-validation ecriture (status='validated' direct car automatique + traceable)

**Fichiers cibles principaux** :
  - `repo/packages/books/src/consumers/pay-to-journal.consumer.ts`
  - `repo/packages/books/src/consumers/pay-to-journal.consumer.spec.ts`
  - `repo/packages/books/src/services/journal-templates.service.ts`
  - `repo/packages/books/src/types/journal-templates.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Pay captured event -> ecriture creee
  - V2 (P0) : Comptes corrects (debit banque, credit client)
  - V3 (P0) : Idempotency : 2 events meme transactionId -> 1 ecriture

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
git commit -m "feat(sprint-12): auto-generation ecritures depuis pay events

Task: 3.5.3
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.3"
```

---

### Tache 4 / 13 : TVA Service + 5 Taux MA

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.5.3

**But** : Service TVA marocaine : 5 taux (0%, 7%, 10%, 14%, 20%) + calcul HT/TVA/TTC + declaration mensuelle TVA preparation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.4-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/books/src/services/tva.service.ts`
- Methods :
- Taux MA :
- Categories produits insurtech :
- Stockage : settings tenant pour taux par defaut + categories activated
- Endpoint `GET /api/v1/books/tva/calculate` (preview calcul)

**Fichiers cibles principaux** :
  - `repo/packages/books/src/services/tva.service.ts`
  - `repo/packages/books/src/services/tva.service.spec.ts`
  - `repo/packages/books/src/types/tva.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : `calculateTtc(100, 20)` retourne `{ ht: 100, tva: 20, ttc: 120 }`
  - V2 (P0) : 5 taux supportes
  - V3 (P0) : Rounding precision (decimal.js)

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
git commit -m "feat(sprint-12): tva service + 5 taux ma

Task: 3.5.4
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.4"
```

---

### Tache 5 / 13 : Invoices Module : Numerotation Legale + Format DGI

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.5.4

**But** : Module factures : numerotation legale sequentielle + champs obligatoires DGI (ICE, RC, patente, TVA breakdown) + generation PDF (Sprint 10) + envoi email (Sprint 9).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.5-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/books/src/entities/books-invoice.entity.ts` :
- Service `invoices.service.ts` :
- Numerotation : pattern `FACT-{YEAR}-{SEQUENCE}` ou customizable per tenant settings
- Champs obligatoires DGI :
- Generation PDF : utilise PdfGeneratorService Sprint 10 + template `facture.hbs`
- Envoi email : Sprint 9 Comm orchestrator + template `invoice_sent`

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-BooksInvoices.ts`
  - `repo/packages/books/src/entities/books-invoice.entity.ts`
  - `repo/packages/books/src/services/invoices.service.ts`
  - `repo/packages/books/src/services/invoice-numbering.service.ts`
  - `repo/apps/api/src/modules/books/controllers/invoices.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Invoice cree avec numerotation auto
  - V2 (P0) : Numerotation sequentielle UNIQUE per tenant
  - V3 (P0) : Champs DGI presents dans PDF

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
git commit -m "feat(sprint-12): invoices module : numerotation legale + format dgi

Task: 3.5.5
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.5"
```

---

### Tache 6 / 13 : Bilan + Compte Resultat Generation

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.5.5

**But** : Generation bilan (snapshot patrimoine) + compte de resultat (revenus/charges periode) selon format CGNC standard.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.6-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/books/src/services/financial-statements.service.ts`
- Methods :
- Bilan structure :
- Compte resultat structure :
- Endpoints :
- Format response : JSON detaille + PDF export

**Fichiers cibles principaux** :
  - `repo/packages/books/src/services/financial-statements.service.ts`
  - `repo/packages/books/src/services/financial-statements.service.spec.ts`
  - `repo/apps/api/src/modules/books/controllers/financial-reports.controller.ts`
  - `repo/packages/docs/src/templates/{fr}/bilan.hbs`
  - `repo/packages/docs/src/templates/{fr}/compte-resultat.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : generateBilan retourne actif + passif balanced
  - V2 (P0) : generateCompteResultat retourne resultat net
  - V3 (P0) : grandLivre detail correct

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
git commit -m "feat(sprint-12): bilan + compte resultat generation

Task: 3.5.6
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.6"
```

---

### Tache 7 / 13 : ACAPS Report Framework + compliance_acaps_reports Entity

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.5.6

**But** : Framework reports ACAPS : entity tracking generation + soumission + scheduled jobs cron + workflow validation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.7-prompt.md
```

**Actions principales attendues** :
- Migration : table `compliance_acaps_reports` :
- Entity correspondante
- Service `acaps-reporting.service.ts` :
- Workflow report : draft -> pending_review -> submitted -> accepted/rejected
- Cron jobs :
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-ComplianceAcapsReports.ts`
  - `repo/packages/compliance/src/entities/compliance-acaps-report.entity.ts`
  - `repo/packages/compliance/src/services/acaps-reporting.service.ts`
  - `repo/packages/compliance/src/jobs/quarterly-acaps-cron.job.ts`
  - `repo/packages/compliance/src/jobs/annual-acaps-cron.job.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration creee
  - V2 (P0) : generateReport cree draft
  - V3 (P0) : Workflow transitions valides

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
git commit -m "feat(sprint-12): acaps report framework + compliance_acaps_reports entity

Task: 3.5.7
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.7"
```

---

### Tache 8 / 13 : Report Trimestriel : Portefeuille Polices + Sinistres

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.5.7

**But** : Generation report trimestriel ACAPS : agregats portefeuille polices (souscrites, encours, resiliees) + sinistres (declares, regles, en cours).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.8-prompt.md
```

**Actions principales attendues** :
- Service `quarterly-portfolio-report.service.ts`
- Method `generate(tenantId, quarter): AcapsQuarterlyReport`
- Sections report :
- Source data : Sprint 14+ Insure entities (lecture seule). Sprint 12 fournit framework, donnees reelles Sprint 14
- Format export : XML structure ACAPS schema
- PDF export : tables + graphiques (utilise `chart.js` server-side ou simple HTML tables)

**Fichiers cibles principaux** :
  - `repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts`
  - `repo/packages/compliance/src/services/quarterly-portfolio-report.service.spec.ts`
  - `repo/packages/compliance/src/templates/acaps-quarterly.xsl`
  - `repo/packages/docs/src/templates/{fr}/acaps-quarterly.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : generate retourne structure complete
  - V2 (P0) : 8 sections presentes
  - V3 (P0) : Format XML respecte schema ACAPS

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
git commit -m "feat(sprint-12): report trimestriel : portefeuille polices + sinistres

Task: 3.5.8
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.8"
```

---

### Tache 9 / 13 : Report Annuel : Solvabilite + Reserves Techniques

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.5.8

**But** : Report annuel ACAPS : marge solvabilite + provisions techniques + bilan + compte resultat detaille branche.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.9-prompt.md
```

**Actions principales attendues** :
- Service `annual-solvency-report.service.ts`
- Sections :
- Format export XML schema annuel ACAPS
- PDF reformat lisible humain
- Tests fixtures

**Fichiers cibles principaux** :
  - `repo/packages/compliance/src/services/annual-solvency-report.service.ts`
  - `repo/packages/compliance/src/services/annual-solvency-report.service.spec.ts`
  - `repo/packages/docs/src/templates/{fr}/acaps-annual.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Report annuel structure complete
  - V2 (P0) : Marge solvabilite calcul correct
  - V3 (P0) : Bilan + compte resultat integres

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
git commit -m "feat(sprint-12): report annuel : solvabilite + reserves techniques

Task: 3.5.9
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.9"
```

---

### Tache 10 / 13 : AML Monitoring + Alertes AMC

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.5.9

**But** : Anti-Money Laundering monitoring : rules engine detect transactions suspectes + declaration soupcon AMC (Autorite Marocaine du Capital) + audit trail.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.10-prompt.md
```

**Actions principales attendues** :
- Migration : table `compliance_aml_alerts` (Sprint 2 partial) :
- Service `aml-monitoring.service.ts`
- Rules :
- Risk score : weighted sum rules triggered
- Alertes status workflow : pending_review -> cleared OR escalated -> reported_to_amc
- Endpoint `GET /api/v1/compliance/aml/alerts` (super admin)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-ComplianceAmlAlerts.ts`
  - `repo/packages/compliance/src/services/aml-monitoring.service.ts`
  - `repo/packages/compliance/src/services/aml-rules/{5 rules}.ts`
  - `repo/apps/api/src/modules/compliance/controllers/aml-alerts.controller.ts`
  - `repo/packages/docs/src/templates/{fr}/aml-declaration-soupcon.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 rules engines fonctionnent
  - V2 (P0) : Alert cree avec risk_score
  - V3 (P0) : Workflow status transitions

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
git commit -m "feat(sprint-12): aml monitoring + alertes amc

Task: 3.5.10
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.10"
```

---

### Tache 11 / 13 : SAFT-MA Export XML

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.5.10

**But** : Export SAFT-MA (Standard Audit File for Tax-Maroc) : format XML standardise pour controles fiscaux DGI.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.11-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/books/src/services/saft-ma-exporter.service.ts`
- Method `export(tenantId, exerciseYear): Buffer` -- retourne XML SAFT-MA
- Structure XML SAFT-MA :
- Validation contre XSD officiel DGI (si dispo)
- Performance : > 100k entries -> stream XML (vs full memory)
- Endpoint `POST /api/v1/books/saft-ma/export?exercise_year=2026` -> retourne XML download

**Fichiers cibles principaux** :
  - `repo/packages/books/src/services/saft-ma-exporter.service.ts`
  - `repo/packages/books/src/services/saft-ma-exporter.service.spec.ts`
  - `repo/packages/books/src/saft-ma/saft-ma.xsd`
  - `repo/apps/api/src/modules/books/controllers/saft-ma.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Export retourne XML valide
  - V2 (P0) : Structure SAFT-MA respecte
  - V3 (P0) : 100% data exercice incluse

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
git commit -m "feat(sprint-12): saft-ma export xml

Task: 3.5.11
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.11"
```

---

### Tache 12 / 13 : Endpoints REST + Scheduled Jobs

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.5.11

**But** : Controllers exposant API books + compliance + scheduled cron jobs reports + integration avec autres modules.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.12-prompt.md
```

**Actions principales attendues** :
- Controllers livres dans taches precedentes (consolidation)
- Cron jobs BullMQ scheduled :
- Notification super admin tenant : email envoie quand draft genere (need review)
- Integration cross-module :
- Tests integration

**Fichiers cibles principaux** :
  - `repo/packages/books/src/jobs/{several cron}.ts`
  - `repo/packages/compliance/src/jobs/{several cron}.ts`
  - `repo/packages/comm/src/templates/{fr,ar-MA,ar}/acaps-draft-ready.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cron jobs declenches selon schedule
  - V2 (P0) : Notification super admin recue
  - V3 (P0) : Cross-module events fonctionnent

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
git commit -m "feat(sprint-12): endpoints rest + scheduled jobs

Task: 3.5.12
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.12"
```

---

### Tache 13 / 13 : Tests E2E (30+) + Fixtures + Seeds

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.5.12

**But** : Suite tests E2E exhaustifs + fixtures comptables realistes + seed plan comptable complete.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-12-books-compliance/task-3.5.13-prompt.md
```

**Actions principales attendues** :
- Plan comptable : seed reussit + lookup + custom accounts (4)
- Journal entries : create balanced + reverse + numerotation + RBAC (8)
- Pay -> Journal auto : event triggers ecriture + idempotency (3)
- TVA : 5 taux + calcul precision + declaration mensuelle (4)
- Invoices : create + validate + PDF + email + payment + cancel (6)
- Bilan + Compte resultat : aggregations correct (3)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/books/{20 specs}.e2e-spec.ts`
  - `repo/apps/api/test/compliance/{10 specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-books-fixtures.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 30+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Fixtures realistes 6 mois

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
git commit -m "feat(sprint-12): tests e2e (30+) + fixtures + seeds

Task: 3.5.13
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux
Decisions: see B-12 Tache 3.5.13"
```

---


## VERIFICATION DU SPRINT 12

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-12-sprint-12-verification.md
```

Le fichier de verification V-12 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint12-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint12-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint12-verify-report.md
git commit -m "chore(sprint-12): close sprint 12 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 3 (Modules Horizontaux)
- Sprint : 12 (Phase 3 / Sprint 5)
- Apport : Plan CGNC + ACAPS reports + DGI SAFT-MA + AMC AML
- Tests E2E cumules : {N}+

Sprint 12 completed -- handoff to Sprint 13."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 12]
   |
   v
[Tache 3.5.1: Plan Comptable CGNC Seed + AccountChart Entity]
   | -> compile -> tests -> commit
   v
[Tache 3.5.2: books_journal_entries Entity + JournalService]
   | -> compile -> tests -> commit
   v
[Tache 3.5.3: Auto-Generation Ecritures depuis Pay Events]
   | -> compile -> tests -> commit
   v
[Tache 3.5.4: TVA Service + 5 Taux MA]
   | -> compile -> tests -> commit
   v
[Tache 3.5.5: Invoices Module : Numerotation Legale + Format DGI]
   | -> compile -> tests -> commit
   v
[Tache 3.5.6: Bilan + Compte Resultat Generation]
   | -> compile -> tests -> commit
   v
[Tache 3.5.7: ACAPS Report Framework + compliance_acaps_reports Entit]
   | -> compile -> tests -> commit
   v
[Tache 3.5.8: Report Trimestriel : Portefeuille Polices + Sinistres]
   | -> compile -> tests -> commit
   v
[Tache 3.5.9: Report Annuel : Solvabilite + Reserves Techniques]
   | -> compile -> tests -> commit
   v
[Tache 3.5.10: AML Monitoring + Alertes AMC]
   | -> compile -> tests -> commit
   v
[Tache 3.5.11: SAFT-MA Export XML]
   | -> compile -> tests -> commit
   v
[Tache 3.5.12: Endpoints REST + Scheduled Jobs]
   | -> compile -> tests -> commit
   v
[Tache 3.5.13: Tests E2E (30+) + Fixtures + Seeds]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 12 -- V-12]
   |
   v
[Rapport sprint12-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

**Apport metier principal** : Plan CGNC + ACAPS reports + DGI SAFT-MA + AMC AML.

**Prerequis Sprint 13** : Sprint 12 GO complet (score >= 95% verification automatique V-12).

**Sprint suivant** : Sprint 13.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 11 (verification GO)

```bash
# Verifier Sprint 11 GO
ls skalean-insurtech/sprint11-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint11-verify-report.md
```

### Lancement Sprint 12 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-12-sprint-12-books-compliance.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-12-sprint-12-books-compliance.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-12-sprint-12-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-12.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 12"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint12-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-12** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-12-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-12 v2.2 detaille -- Sprint 12 (3.5) Books CGNC + Compliance ACAPS/DGI/AMC.**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : Plan CGNC + ACAPS reports + DGI SAFT-MA + AMC AML
