# ORCHESTRATEUR SPRINT 14 -- Phase 4 / Sprint 1 : Insure Foundation (lookup tables tarification)
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 14 / 35 (cumul) -- Sprint 1 dans Phase 4
**Reference meta-prompt** : `B-14-sprint-14-insure-foundation.md`
**Reference verification** : `V-14-sprint-14-verification.md`
**Numerotation taches** : 4.1.1 a 4.1.14
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : Skalean Broker Foundation (7 entities + tarification lookup)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 14 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-14** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-14 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 14

Sprint 14 (4.1) -- Insure Foundation (lookup tables tarification). Voir B-14-sprint-14-insure-foundation.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/
  task-4.1.1-prompt.md       # insure_products Entity + Catalog 5 Branches
  task-4.1.2-prompt.md       # Tarification Engine Basique (Lookup Tables)
  task-4.1.3-prompt.md       # insure_quotes Entity + Devis PDF
  task-4.1.4-prompt.md       # insure_policies Entity + Status Workflow
  task-4.1.5-prompt.md       # Souscription Workflow : Quote -> Policy via Signature
  task-4.1.6-prompt.md       # insure_avenants Entity + Service
  task-4.1.7-prompt.md       # insure_premiums Echeancier + Tracking
  task-4.1.8-prompt.md       # insure_renewals Cron 60j Avant Expiration
  task-4.1.9-prompt.md       # insure_commissions Auto-Calcul + Books
  task-4.1.10-prompt.md       # Cron Reminders Primes Echues
  task-4.1.11-prompt.md       # Auto-Log Interactions CRM + ACAPS Data Feed
  task-4.1.12-prompt.md       # Endpoints REST + Permissions
  task-4.1.13-prompt.md       # Dashboards Insure
  task-4.1.14-prompt.md       # Tests E2E (50+) + Fixtures + Seeds
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
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
4. La verification finale V-14 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
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

### Position du Sprint 1 dans la Phase 4

Sprint 14 (4.1) -- **Insure Foundation (lookup tables tarification)**.

Voir `B-14-sprint-14-insure-foundation.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

### Apport metier de ce sprint

Skalean Broker Foundation (7 entities + tarification lookup)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-14 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-14, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-14.

---

### Tache 1 / 14 : insure_products Entity + Catalog 5 Branches

**Metadonnees** : P0 | 6h | Depend de : Depend de Phase 3

**But** : Catalog produits assurance (5 branches initiales MVP) gere par super admin Skalean (templates) et personnalise per tenant broker (variantes commerciales).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.1-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_products` :
- Entity `repo/packages/insure/src/entities/insure-product.entity.ts`
- Service `products.service.ts` :
- Catalog seed 5 branches initiales :
- Garanties typiques par branche pre-configurees (e.g. auto : RC obligatoire, vol, incendie, bris glace)
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureProducts.ts`
  - `repo/packages/insure/src/entities/insure-product.entity.ts`
  - `repo/packages/insure/src/services/products.service.ts`
  - `repo/packages/insure/src/schemas/product.schema.ts`
  - `repo/packages/insure/src/seeds/products-templates.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Migration creee + 5 branches enum
  - V2 (P0) : Templates super admin only
  - V3 (P0) : Variants tenant heritage parent

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
git commit -m "feat(sprint-14): insure_products entity + catalog 5 branches

Task: 4.1.1
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.1"
```

---

### Tache 2 / 14 : Tarification Engine Basique (Lookup Tables)

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.1.1

**But** : Engine calcul prime annuelle a partir caracteristiques souscripteur + produit. Sprint 14 = lookup tables simples (multipliers per region, age, vehicle category, etc.). Sprint 30+ enrichira avec IA.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.2-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/insure/src/services/tarification.service.ts`
- Method `calculatePremium(productId, souscripteurData, garantiesSelected): { primeAnnuelle, breakdown }` :
- Lookup tables initiaux per branche :
- Inputs validation : Zod schemas per branche
- Tests : 5 branches x 5 scenarios = 25 tests calcul prime
- Cache lookup tables 1h Redis (eviter re-fetch DB chaque calcul)

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/tarification.service.ts`
  - `repo/packages/insure/src/services/branche-calculators/auto.calculator.ts`
  - `repo/packages/insure/src/services/branche-calculators/sante.calculator.ts`
  - `repo/packages/insure/src/services/branche-calculators/habitation.calculator.ts`
  - `repo/packages/insure/src/services/branche-calculators/rc-pro.calculator.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 calculators (1 par branche) implementent interface
  - V2 (P0) : Auto : young driver +30%
  - V3 (P0) : Auto : no claim bonus -10%

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
git commit -m "feat(sprint-14): tarification engine basique (lookup tables)

Task: 4.1.2
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.2"
```

---

### Tache 3 / 14 : insure_quotes Entity + Devis PDF

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.1.2

**But** : Quotes (devis) entity + service generation devis PDF + envoi email + tracking acceptance.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.3-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_quotes` :
- Service `quotes.service.ts` :
- Validity : default 30 jours apres send (configurable)
- Cron job : expire quotes apres validity
- PDF devis : utilise PdfGeneratorService Sprint 10 + template `devis.hbs` (deja Sprint 10) + breakdown detaille
- Email envoi : utilise Comm orchestrator Sprint 9 + template `quote_generated`

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureQuotes.ts`
  - `repo/packages/insure/src/entities/insure-quote.entity.ts`
  - `repo/packages/insure/src/services/quotes.service.ts`
  - `repo/packages/insure/src/jobs/expire-quotes.cron.ts`
  - `repo/apps/api/src/modules/insure/controllers/quotes.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Create quote auto-tarification
  - V2 (P0) : Send genere PDF + email
  - V3 (P0) : Validity expiry cron

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
git commit -m "feat(sprint-14): insure_quotes entity + devis pdf

Task: 4.1.3
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.3"
```

---

### Tache 4 / 14 : insure_policies Entity + Status Workflow

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.1.3

**But** : Policies entity + service avec status workflow strict (active -> renewal_requested / cancelled / expired).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.4-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_policies` :
- Service `policies.service.ts` :
- Status workflow strict avec validation
- Numerotation policy_number sequentiel UNIQUE per tenant + format `POL-AUTO-2026-00001`
- Endpoints :
- Audit + Kafka events

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsurePolicies.ts`
  - `repo/packages/insure/src/entities/insure-policy.entity.ts`
  - `repo/packages/insure/src/services/policies.service.ts`
  - `repo/packages/insure/src/services/policy-numbering.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/policies.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : policy_number sequentiel format correct
  - V2 (P0) : Status workflow transitions valid only
  - V3 (P0) : Cancel avec reason + audit

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
git commit -m "feat(sprint-14): insure_policies entity + status workflow

Task: 4.1.4
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.4"
```

---

### Tache 5 / 14 : Souscription Workflow : Quote -> Policy via Signature

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.1.4

**But** : Workflow complete : quote accepted -> generate police PDF non-signee -> send Barid eSign signature -> webhook complete -> create policy active + apply ANRT timestamp + archive.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.5-prompt.md
```

**Actions principales attendues** :
- Service `souscription.service.ts`
- Method `initiateSouscription(quoteId): Promise<{ policy_id, signing_workflow_id }>` :
- Consumer `signature-completed.consumer.ts` :
- Endpoint `POST /api/v1/insure/quotes/:id/initiate-souscription`
- Tests : full workflow happy path + signature decline + signature expired

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/souscription.service.ts`
  - `repo/packages/insure/src/consumers/signature-completed.consumer.ts`
  - `repo/apps/api/src/modules/insure/controllers/souscription.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Initiate souscription cree policy + signing workflow
  - V2 (P0) : Signature completed -> policy active + premiums + commission
  - V3 (P0) : Signature declined -> policy cancelled

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
git commit -m "feat(sprint-14): souscription workflow : quote -> policy via signature

Task: 4.1.5
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.5"
```

---

### Tache 6 / 14 : insure_avenants Entity + Service

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.1.5

**But** : Avenants (modifications police active) : ajout/retrait garanties + recalcul prime + workflow signature similaire.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.6-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_avenants` :
- Service `avenants.service.ts` :
- Endpoints :
- Tests : create + signature + impact prime

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureAvenants.ts`
  - `repo/packages/insure/src/entities/insure-avenant.entity.ts`
  - `repo/packages/insure/src/services/avenants.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/avenants.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Create avenant ajout garantie
  - V2 (P0) : Recalcul prime + complement pro-rata
  - V3 (P0) : Workflow signature trigger

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
git commit -m "feat(sprint-14): insure_avenants entity + service

Task: 4.1.6
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.6"
```

---

### Tache 7 / 14 : insure_premiums Echeancier + Tracking

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.1.6

**But** : Premiums echeancier paiement (annuel ou fractionne mensuel/trimestriel) + tracking paiements via Pay Sprint 11.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.7-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_premiums` :
- Service `premiums.service.ts` :
- Annual frequency : 1 echeance prime_annuelle a start_date
- Quarterly : 4 echeances prime/4 + supplement 5% (frais fractionnement)
- Monthly : 12 echeances prime/12 + supplement 8%
- Consumer Kafka `pay.transaction_captured` :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsurePremiums.ts`
  - `repo/packages/insure/src/entities/insure-premium.entity.ts`
  - `repo/packages/insure/src/services/premiums.service.ts`
  - `repo/packages/insure/src/consumers/pay-to-premium.consumer.ts`
  - `repo/apps/api/src/modules/insure/controllers/premiums.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Schedule annual / quarterly / monthly
  - V2 (P0) : Pay capture -> premium paid auto
  - V3 (P0) : Overdue cron daily

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
git commit -m "feat(sprint-14): insure_premiums echeancier + tracking

Task: 4.1.7
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.7"
```

---

### Tache 8 / 14 : insure_renewals Cron 60j Avant Expiration

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.1.7

**But** : Cron job auto-detect polices expirant dans 60 jours + generate renewal quote + envoie email proposal.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.8-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_renewals` :
- Service `renewals.service.ts` :
- Cron job daily : `findPoliciesExpiringIn(60)` -> propose renewal pour chaque
- Quote renewal : meme product + garanties + recalcul tarification (peut changer)
- Endpoints :
- Tests : cron + workflow

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureRenewals.ts`
  - `repo/packages/insure/src/entities/insure-renewal.entity.ts`
  - `repo/packages/insure/src/services/renewals.service.ts`
  - `repo/packages/insure/src/jobs/renewal-cron.job.ts`
  - `repo/apps/api/src/modules/insure/controllers/renewals.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cron daily detect expiring 60j
  - V2 (P0) : Renewal quote genere + email envoyee
  - V3 (P0) : Accept renewal -> new policy

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
git commit -m "feat(sprint-14): insure_renewals cron 60j avant expiration

Task: 4.1.8
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.8"
```

---

### Tache 9 / 14 : insure_commissions Auto-Calcul + Books

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.1.8

**But** : Auto-calcul commission courtier a chaque police active + tracking + integration Books (ecriture compte 706 produits).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.9-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_commissions` :
- Service `commissions.service.ts` :
- Trigger via consumer Kafka `insure.premium_paid` -> recordCommission
- Endpoint `GET /api/v1/insure/commissions` (filtres + stats)
- Stats : total commissions YTD, per branche, per assureur
- Tests : calcul + journal entry creation

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureCommissions.ts`
  - `repo/packages/insure/src/entities/insure-commission.entity.ts`
  - `repo/packages/insure/src/services/commissions.service.ts`
  - `repo/packages/insure/src/consumers/premium-paid-to-commission.consumer.ts`
  - `repo/apps/api/src/modules/insure/controllers/commissions.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Calcul commission correct (prime x rate)
  - V2 (P0) : Premium paid -> commission recorded auto
  - V3 (P0) : Journal entry creee

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
git commit -m "feat(sprint-14): insure_commissions auto-calcul + books

Task: 4.1.9
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.9"
```

---

### Tache 10 / 14 : Cron Reminders Primes Echues

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.1.9

**But** : Cron jobs envoyant reminders primes a echeance : J-15, J-7, J-3 + post-echeance (overdue).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.10-prompt.md
```

**Actions principales attendues** :
- Cron job daily `premium-reminders.job.ts` :
- Templates Comm 3 locales pre-remplis (Sprint 9 deja templates)
- Escalade : J+15 overdue -> notify broker + super admin tenant (action requise)
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/jobs/premium-reminders.cron.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Cron daily emit reminders
  - V2 (P0) : Anti-doublon via reminder_sent_at
  - V3 (P0) : Escalade J+15 super admin

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
git commit -m "feat(sprint-14): cron reminders primes echues

Task: 4.1.10
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.10"
```

---

### Tache 11 / 14 : Auto-Log Interactions CRM + ACAPS Data Feed

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.1.10

**But** : Consumer Kafka events Insure -> auto-log interactions CRM Sprint 8 (timeline contact) + alimente ACAPS reports Sprint 12 (feed donnees reelles).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.11-prompt.md
```

**Actions principales attendues** :
- Consumer `insure-events-to-crm.consumer.ts` :
- Update ACAPS reports (Sprint 12) : utiliser donnees reelles polices au lieu fixtures
- Sprint 12 reports auto-enrichis :
- Endpoint resync ACAPS data : `POST /api/v1/admin/acaps/resync-source-data`
- Tests integration

**Fichiers cibles principaux** :
  - `repo/packages/crm/src/consumers/insure-events-to-crm.consumer.ts`
  - `repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Insure events -> CRM interactions logged
  - V2 (P0) : ACAPS reports utilisent donnees reelles
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
git commit -m "feat(sprint-14): auto-log interactions crm + acaps data feed

Task: 4.1.11
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.11"
```

---

### Tache 12 / 14 : Endpoints REST + Permissions

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.1.11

**But** : Consolidation endpoints `/api/v1/insure/*` + permissions Insure dans matrice RBAC Sprint 7.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.12-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog (Sprint 7) :
- Mise a jour PermissionsMatrix Sprint 7 : roles broker_* avec permissions Insure
- Tests permissions per role

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/auth/src/rbac/permissions-matrix.ts`
  - `repo/apps/api/test/insure/permissions.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ permissions Insure ajoutees
  - V2 (P0) : Roles broker_admin/user/assistant : permissions correctes
  - V3 (P0) : Tests RBAC 10+ scenarios

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
git commit -m "feat(sprint-14): endpoints rest + permissions

Task: 4.1.12
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.12"
```

---

### Tache 13 / 14 : Dashboards Insure

**Metadonnees** : P1 | 4h | Depend de : Depend de 4.1.12

**But** : Etendre dashboards Sprint 13 avec metriques Insure-specific.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.13-prompt.md
```

**Actions principales attendues** :
- Dashboards added :
- ETL Sprint 13 : add tables fct_policies + fct_quotes + fct_commissions a sync
- Cache Redis 5min
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
  - `repo/infrastructure/clickhouse/schemas/fct_{policies,quotes,commissions}.sql`
  - `repo/apps/api/src/modules/analytics/services/insure-dashboards.service.ts`

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
git commit -m "feat(sprint-14): dashboards insure

Task: 4.1.13
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.13"
```

---

### Tache 14 / 14 : Tests E2E (50+) + Fixtures + Seeds

**Metadonnees** : P0 | 11h | Depend de : Depend de 4.1.13

**But** : Suite tests E2E exhaustive + fixtures realistes 5 branches + seeds dev complete.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-14-insure-foundation/task-4.1.14-prompt.md
```

**Actions principales attendues** :
- Products : CRUD templates + variants + 5 branches (8)
- Tarification : 5 calculators x 5 scenarios = 25 (25)
- Quotes : create + send + accept + reject + expire (5)
- Policies : create from quote + signature + cancel + expire (5)
- Avenants : workflow + recalcul prime (3)
- Premiums : annual / quarterly / monthly + payment integration (4)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/insure/{50+ specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-insure.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 50+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Fixtures realistes 5 branches

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
git commit -m "feat(sprint-14): tests e2e (50+) + fixtures + seeds

Task: 4.1.14
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-14 Tache 4.1.14"
```

---


## VERIFICATION DU SPRINT 14

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
```

Le fichier de verification V-14 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint14-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint14-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint14-verify-report.md
git commit -m "chore(sprint-14): close sprint 14 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 4 (Vertical Insure (Skalean Broker ERP))
- Sprint : 14 (Phase 4 / Sprint 1)
- Apport : Skalean Broker Foundation (7 entities + tarification lookup)
- Tests E2E cumules : {N}+

Sprint 14 completed -- handoff to Sprint 15."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 14]
   |
   v
[Tache 4.1.1: insure_products Entity + Catalog 5 Branches]
   | -> compile -> tests -> commit
   v
[Tache 4.1.2: Tarification Engine Basique (Lookup Tables)]
   | -> compile -> tests -> commit
   v
[Tache 4.1.3: insure_quotes Entity + Devis PDF]
   | -> compile -> tests -> commit
   v
[Tache 4.1.4: insure_policies Entity + Status Workflow]
   | -> compile -> tests -> commit
   v
[Tache 4.1.5: Souscription Workflow : Quote -> Policy via Signature]
   | -> compile -> tests -> commit
   v
[Tache 4.1.6: insure_avenants Entity + Service]
   | -> compile -> tests -> commit
   v
[Tache 4.1.7: insure_premiums Echeancier + Tracking]
   | -> compile -> tests -> commit
   v
[Tache 4.1.8: insure_renewals Cron 60j Avant Expiration]
   | -> compile -> tests -> commit
   v
[Tache 4.1.9: insure_commissions Auto-Calcul + Books]
   | -> compile -> tests -> commit
   v
[Tache 4.1.10: Cron Reminders Primes Echues]
   | -> compile -> tests -> commit
   v
[Tache 4.1.11: Auto-Log Interactions CRM + ACAPS Data Feed]
   | -> compile -> tests -> commit
   v
[Tache 4.1.12: Endpoints REST + Permissions]
   | -> compile -> tests -> commit
   v
[Tache 4.1.13: Dashboards Insure]
   | -> compile -> tests -> commit
   v
[Tache 4.1.14: Tests E2E (50+) + Fixtures + Seeds]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 14 -- V-14]
   |
   v
[Rapport sprint14-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

**Apport metier principal** : Skalean Broker Foundation (7 entities + tarification lookup).

**Prerequis Sprint 15** : Sprint 14 GO complet (score >= 95% verification automatique V-14).

**Sprint suivant** : Sprint 15.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 13 (verification GO)

```bash
# Verifier Sprint 13 GO
ls skalean-insurtech/sprint13-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint13-verify-report.md
```

### Lancement Sprint 14 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-14-sprint-14-insure-foundation.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-14-sprint-14-insure-foundation.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-14-sprint-14-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-14.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 14"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint14-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-14** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-14-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-14 v2.2 detaille -- Sprint 14 (4.1) Insure Foundation (lookup tables tarification).**

**Total taches detaillees** : 14 | **Effort cumul** : ~80h | **Apport** : Skalean Broker Foundation (7 entities + tarification lookup)
