# ORCHESTRATEUR SPRINT 15 -- Phase 4 / Sprint 2 : Insure Lifecycle Avance (transferts/flottes/queue)
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 15 / 35 (cumul) -- Sprint 2 dans Phase 4
**Reference meta-prompt** : `B-15-sprint-15-insure-lifecycle-police.md`
**Reference verification** : `V-15-sprint-15-verification.md`
**Numerotation taches** : 4.2.1 a 4.2.13
**Effort total** : ~75 heures developpement / 2 semaines
**Apport metier** : Lifecycle police complete (transferts + flottes + queue)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 15 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-15** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-15 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 15

Sprint 15 (4.2) -- Insure Lifecycle Avance (transferts/flottes/queue). Voir B-15-sprint-15-insure-lifecycle-police.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/
  task-4.2.1-prompt.md       # Transfer Entity + Workflow Signature Double
  task-4.2.2-prompt.md       # Fractionnement Primes Runtime
  task-4.2.3-prompt.md       # Suspension Temporaire + Reprise
  task-4.2.4-prompt.md       # Resiliation Anticipee + Remboursement Pro-Rata
  task-4.2.5-prompt.md       # Polices Flottes (1 Police, N Objets)
  task-4.2.6-prompt.md       # Endossements Auto
  task-4.2.7-prompt.md       # Endossements Sante
  task-4.2.8-prompt.md       # Endossements Habitation/RC Pro/Voyage
  task-4.2.9-prompt.md       # BrokerValidationQueueService (File Web-Customer-Portal)
  task-4.2.10-prompt.md       # ProvisionalPolicyService (Doc Provisoire 7 Jours)
  task-4.2.11-prompt.md       # Endpoints REST Avances + Permissions Enrichies
  task-4.2.12-prompt.md       # Audit Trail Enrichi + Kafka Events
  task-4.2.13-prompt.md       # Tests E2E (50+) + Fixtures Cas Complexes
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-15-sprint-15-verification.md
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
4. La verification finale V-15 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-15-sprint-15-verification.md
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

### Position du Sprint 2 dans la Phase 4

Sprint 15 (4.2) -- **Insure Lifecycle Avance (transferts/flottes/queue)**.

Voir `B-15-sprint-15-insure-lifecycle-police.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

### Apport metier de ce sprint

Lifecycle police complete (transferts + flottes + queue)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-15 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-15, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-15.

---

### Tache 1 / 13 : Transfer Entity + Workflow Signature Double

**Metadonnees** : P0 | 6h | Depend de : Depend de Sprint 14

**But** : Permettre transfert police d'un souscripteur a un autre (vente vehicule, succession, mutation entreprise) avec workflow signature double (cedant + cessionnaire).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.1-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_transfers` :
- Service `transfers.service.ts` :
- Conditions transfert :
- Workflow signature : 2 signers (cedant order=1, cessionnaire order=2) sequential
- Apres signature complete :
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureTransfers.ts`
  - `repo/packages/insure/src/entities/insure-transfer.entity.ts`
  - `repo/packages/insure/src/services/transfers.service.ts`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/transfer-cession.hbs`
  - `repo/apps/api/src/modules/insure/controllers/transfers.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Initiate transfer cree row + PDF + signing workflow 2 signers
  - V2 (P0) : Police pas active rejete
  - V3 (P0) : Pending existant rejete

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
git commit -m "feat(sprint-15): transfer entity + workflow signature double

Task: 4.2.1
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.1"
```

---

### Tache 2 / 13 : Fractionnement Primes Runtime

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.2.1

**But** : Permettre conversion mid-year d'un fractionnement (e.g. annuel -> mensuel) avec recalcul echeancier + frais conversion.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.2-prompt.md
```

**Actions principales attendues** :
- Service `fractionnement.service.ts`
- Method `changeFrequency(policyId, newFrequency: 'monthly' | 'quarterly' | 'annual', effectiveDate)`:
- Frais conversion : configurable per tenant (default 3%)
- Endpoint `POST /api/v1/insure/policies/:id/change-frequency`
- Permissions : `insure.premiums.change_frequency`
- Tests : conversion all combos + frais correct

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/fractionnement.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/fractionnement.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Change annual -> monthly recompute echeancier
  - V2 (P0) : Frais 3% applique
  - V3 (P0) : Premiums futurs cancelled

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
git commit -m "feat(sprint-15): fractionnement primes runtime

Task: 4.2.2
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.2"
```

---

### Tache 3 / 13 : Suspension Temporaire + Reprise

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.2.2

**But** : Permettre suspension temporaire police (vehicule en panne, voyage long) + reprise ulterieure avec ajustements pro-rata.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.3-prompt.md
```

**Actions principales attendues** :
- Migration : ajouter colonnes `insure_policies.suspended_at`, `suspended_until`, `suspension_reason`, `resumed_at`
- Service `suspension.service.ts` :
- Conditions :
- Endpoints :
- Status workflow : active -> suspended -> active (avec extension end_date)
- Notifications Comm aux assures

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddSuspensionColumns.ts`
  - `repo/packages/insure/src/services/suspension.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/suspension.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Suspend transition status + cancel premiums futurs
  - V2 (P0) : Resume restore status + extension end_date
  - V3 (P0) : Suspension > 6 mois rejetee

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
git commit -m "feat(sprint-15): suspension temporaire + reprise

Task: 4.2.3
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.3"
```

---

### Tache 4 / 13 : Resiliation Anticipee + Remboursement Pro-Rata

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.2.3

**But** : Resiliation police avant end_date avec computation remboursement pro-rata + frais resiliation + integration Pay refund.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.4-prompt.md
```

**Actions principales attendues** :
- Service `resiliation.service.ts`
- Method `cancel(policyId, reason, effectiveDate): { refundAmount, breakdown }`:
- Cas particuliers (conformite legale MA) :
- **Tracking conformite 17-99** :
- Endpoint `POST /api/v1/insure/policies/:id/cancel`
- Notifications Comm + email confirmation refund

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/resiliation.service.ts`
  - `repo/packages/insure/src/services/resiliation.service.spec.ts`
  - `repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Pro-rata calcul correct (decimal.js)
  - V2 (P0) : Frais 5% applique
  - V3 (P0) : Droit retract 30 jours integral

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
git commit -m "feat(sprint-15): resiliation anticipee + remboursement pro-rata

Task: 4.2.4
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.4"
```

---

### Tache 5 / 13 : Polices Flottes (1 Police, N Objets)

**Metadonnees** : P0 | 7h | Depend de : Depend de 4.2.4

**But** : Polices flottes pour entreprises : 1 police = N objets assures (vehicules entreprise, employes assurance groupe, biens immobiliers multiples).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.5-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_policy_objects` :
- Service `flotte.service.ts` :
- Compute prime totale = sum(objects.prime_share)
- Endossement signature requis pour ajout/retrait objet (workflow Sprint 10)
- Endpoints :
- Pour Sprint 14 lifecycle "single object" : auto-cree 1 objet flotte size=1 (compatible API)

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsurePolicyObjects.ts`
  - `repo/packages/insure/src/entities/insure-policy-object.entity.ts`
  - `repo/packages/insure/src/services/flotte.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/flotte.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Add object recompute prime totale
  - V2 (P0) : Remove object refund pro-rata
  - V3 (P0) : Endossement signature trigger

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
git commit -m "feat(sprint-15): polices flottes (1 police, n objets)

Task: 4.2.5
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.5"
```

---

### Tache 6 / 13 : Endossements Auto

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.2.5

**But** : Endossements specifiques branche auto : changement vehicule, ajout/retrait conducteur, changement usage (perso/pro).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.6-prompt.md
```

**Actions principales attendues** :
- Service `endossements-auto.service.ts` :
- Pattern : utilise avenants Sprint 14 + service flotte Sprint 4.2.5
- Recalcul prime via TarificationService (chaque changement impact tarif)
- Workflow signature avenant
- Endpoints :
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/endossements/auto-endossements.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/auto-endossements.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Change vehicle recompute prime
  - V2 (P0) : Add driver impact tarif si jeune
  - V3 (P0) : Change usage perso -> pro recompute (tarif pro souvent +)

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
git commit -m "feat(sprint-15): endossements auto

Task: 4.2.6
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.6"
```

---

### Tache 7 / 13 : Endossements Sante

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.2.6

**But** : Endossements sante : ajout/retrait beneficiaires (conjoint, enfants, ascendants).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.7-prompt.md
```

**Actions principales attendues** :
- Service `endossements-sante.service.ts` :
- Recalcul prime via TarificationService (chaque beneficiaire ajoute prime)
- Limites : max 5 beneficiaires (configurable), enfants jusqu'a 25 ans
- Workflow signature avenant
- Endpoints similaires Tache 4.2.6
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/endossements/sante-endossements.service.ts`
  - `repo/apps/api/src/modules/insure/controllers/sante-endossements.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Add beneficiaire recompute prime
  - V2 (P0) : Limit max 5 beneficiaires
  - V3 (P0) : Enfants > 25 ans rejete (sauf certificat scolarite/handicap)

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
git commit -m "feat(sprint-15): endossements sante

Task: 4.2.7
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.7"
```

---

### Tache 8 / 13 : Endossements Habitation/RC Pro/Voyage

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.2.7

**But** : Endossements specifiques branches restantes : habitation (modification biens declares), RC pro (changement activite), voyage (extension destination).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.8-prompt.md
```

**Actions principales attendues** :
- Service `endossements-habitation.service.ts` :
- Service `endossements-rc-pro.service.ts` :
- Service `endossements-voyage.service.ts` :
- Workflow signature avenant pour tous
- Tests

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/endossements/{3 services}.ts`
  - `repo/apps/api/src/modules/insure/controllers/{3 controllers}.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Habitation update biens recompute
  - V2 (P0) : RC pro change activite recompute
  - V3 (P0) : Voyage extend destination + duration

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
git commit -m "feat(sprint-15): endossements habitation/rc pro/voyage

Task: 4.2.8
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.8"
```

---

### Tache 9 / 13 : BrokerValidationQueueService (File Web-Customer-Portal)

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.2.8

**But** : Workflow validation manual broker pour souscriptions arrivant du flux web-customer-portal (Sprint 17 client-side). File d'attente, SLA 24h, validation/rejet.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.9-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_broker_validation_queue` :
- Service `broker-validation-queue.service.ts` :
- SLA 24h ouvrables : compute working days only (exclu weekend, holidays MA Tache 3.1.11)
- Cron job hourly : check pending > SLA -> escalate
- Notifications :
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-BrokerValidationQueue.ts`
  - `repo/packages/insure/src/entities/insure-broker-validation-queue.entity.ts`
  - `repo/packages/insure/src/services/broker-validation-queue.service.ts`
  - `repo/packages/insure/src/jobs/sla-escalation-cron.ts`
  - `repo/apps/api/src/modules/insure/controllers/broker-queue.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Enqueue cree row + notify broker
  - V2 (P0) : Assign transition + email broker
  - V3 (P0) : Validate -> trigger souscription Sprint 14

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
git commit -m "feat(sprint-15): brokervalidationqueueservice (file web-customer-portal)

Task: 4.2.9
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.9"
```

---

### Tache 10 / 13 : ProvisionalPolicyService (Doc Provisoire 7 Jours)

**Metadonnees** : P0 | 6h | Depend de : Depend de 4.2.9

**But** : Apres pre-approbation KYC web-customer-portal Sprint 17, generer document provisoire (TTL 7 jours) permettant assure d'avoir preuve assurance temporaire pendant attente police definitive emise (post-validation broker + push assureur).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.10-prompt.md
```

**Actions principales attendues** :
- Migration : table `insure_provisional_policies` :
- Service `provisional-policy.service.ts` :
- PDF provisoire : utilise PdfGenerator + template `attestation-provisoire.hbs`
- Signature : Barid eSign signature_type='simple' (vs qualified) -- doc provisoire pas valeur juridique permanente
- TTL 7 jours : cron daily revoque expired
- Document marque "PROVISIONAL" + watermark + QR code verification

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-InsureProvisionalPolicies.ts`
  - `repo/packages/insure/src/entities/insure-provisional-policy.entity.ts`
  - `repo/packages/insure/src/services/provisional-policy.service.ts`
  - `repo/packages/insure/src/jobs/provisional-expiry-cron.ts`
  - `repo/packages/docs/src/templates/{fr,ar-MA,ar}/attestation-provisoire.hbs`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Generate cree provisional + PDF + signature
  - V2 (P0) : TTL 7 jours respecte (cron expire)
  - V3 (P0) : Replace lien final policy

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
git commit -m "feat(sprint-15): provisionalpolicyservice (doc provisoire 7 jours)

Task: 4.2.10
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.10"
```

---

### Tache 11 / 13 : Endpoints REST Avances + Permissions Enrichies

**Metadonnees** : P0 | 5h | Depend de : Depend de 4.2.10

**But** : Consolidation endpoints REST + ajout permissions specifiques Sprint 15 dans matrice RBAC Sprint 7.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.11-prompt.md
```

**Actions principales attendues** :
- Endpoints livres dans taches precedentes (consolidation)
- Permissions ajoutees catalog Sprint 7 :
- Update PermissionsMatrix : roles broker_admin/user/assistant enrichis
- Audit + Kafka events tous nouveaux operations
- Tests permissions

**Fichiers cibles principaux** :
  - `repo/packages/auth/src/rbac/permissions.enum.ts`
  - `repo/packages/auth/src/rbac/permissions-matrix.ts`
  - `repo/apps/api/test/insure/sprint-15-permissions.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 12+ permissions Sprint 15 ajoutees
  - V2 (P0) : Roles broker_* enrichis
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
git commit -m "feat(sprint-15): endpoints rest avances + permissions enrichies

Task: 4.2.11
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.11"
```

---

### Tache 12 / 13 : Audit Trail Enrichi + Kafka Events

**Metadonnees** : P0 | 4h | Depend de : Depend de 4.2.11

**But** : Audit trail complete tous workflows Sprint 15 + Kafka events publies pour chaque transition critique.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.12-prompt.md
```

**Actions principales attendues** :
- Tous events Kafka publies :
- audit_log row pour chaque operation : action + resource + before/after diff
- Sprint 13 Analytics ETL : sync nouvelles tables vers ClickHouse (insure_transfers, etc.)
- Dashboards : nouveau dashboard "Insure Operations" (operations Sprint 15 metriques)
- Tests : verifier audit + Kafka pour chaque operation

**Fichiers cibles principaux** :
  - `repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts`
  - `repo/apps/api/src/modules/analytics/services/insure-operations-dashboard.service.ts`
  - `repo/apps/api/test/insure/sprint-15-audit.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 15+ Kafka events specifiques
  - V2 (P0) : audit_log enrichi
  - V3 (P0) : ETL ClickHouse sync nouvelles tables

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
git commit -m "feat(sprint-15): audit trail enrichi + kafka events

Task: 4.2.12
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.12"
```

---

### Tache 13 / 13 : Tests E2E (50+) + Fixtures Cas Complexes

**Metadonnees** : P0 | 8h | Depend de : Depend de 4.2.12

**But** : Suite tests E2E exhaustive cas complexes + fixtures realistes scenarios reels.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-15-insure-lifecycle-police/task-4.2.13-prompt.md
```

**Actions principales attendues** :
- Transfers (5) : initiate + 2 signatures + completion + cancel + decline
- Fractionnement (4) : change frequency tous combos
- Suspension (4) : suspend + resume + > 6 mois reject + extension end_date
- Resiliation (8) : pro-rata correct + droit retract + frais 5% + refund Pay + premiums cancelled + edge cases
- Flotte (5) : add/remove objects + recompute prime + 4 types objects
- Endossements auto (5) : change vehicle + drivers + usage

**Fichiers cibles principaux** :
  - `repo/apps/api/test/insure/sprint-15/{50+ specs}.e2e-spec.ts`
  - `repo/infrastructure/scripts/seed-insure-sprint15-fixtures.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 50+ tests passent
  - V2 (P0) : CI green
  - V3 (P0) : Fixtures realistes

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
git commit -m "feat(sprint-15): tests e2e (50+) + fixtures cas complexes

Task: 4.2.13
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Decisions: see B-15 Tache 4.2.13"
```

---


## VERIFICATION DU SPRINT 15

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-15-sprint-15-verification.md
```

Le fichier de verification V-15 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint15-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint15-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint15-verify-report.md
git commit -m "chore(sprint-15): close sprint 15 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 4 (Vertical Insure (Skalean Broker ERP))
- Sprint : 15 (Phase 4 / Sprint 2)
- Apport : Lifecycle police complete (transferts + flottes + queue)
- Tests E2E cumules : {N}+

Sprint 15 completed -- handoff to Sprint 16."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 15]
   |
   v
[Tache 4.2.1: Transfer Entity + Workflow Signature Double]
   | -> compile -> tests -> commit
   v
[Tache 4.2.2: Fractionnement Primes Runtime]
   | -> compile -> tests -> commit
   v
[Tache 4.2.3: Suspension Temporaire + Reprise]
   | -> compile -> tests -> commit
   v
[Tache 4.2.4: Resiliation Anticipee + Remboursement Pro-Rata]
   | -> compile -> tests -> commit
   v
[Tache 4.2.5: Polices Flottes (1 Police, N Objets)]
   | -> compile -> tests -> commit
   v
[Tache 4.2.6: Endossements Auto]
   | -> compile -> tests -> commit
   v
[Tache 4.2.7: Endossements Sante]
   | -> compile -> tests -> commit
   v
[Tache 4.2.8: Endossements Habitation/RC Pro/Voyage]
   | -> compile -> tests -> commit
   v
[Tache 4.2.9: BrokerValidationQueueService (File Web-Customer-Portal)]
   | -> compile -> tests -> commit
   v
[Tache 4.2.10: ProvisionalPolicyService (Doc Provisoire 7 Jours)]
   | -> compile -> tests -> commit
   v
[Tache 4.2.11: Endpoints REST Avances + Permissions Enrichies]
   | -> compile -> tests -> commit
   v
[Tache 4.2.12: Audit Trail Enrichi + Kafka Events]
   | -> compile -> tests -> commit
   v
[Tache 4.2.13: Tests E2E (50+) + Fixtures Cas Complexes]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 15 -- V-15]
   |
   v
[Rapport sprint15-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 75 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/insure, apps/web-broker, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile

**Apport metier principal** : Lifecycle police complete (transferts + flottes + queue).

**Prerequis Sprint 16** : Sprint 15 GO complet (score >= 95% verification automatique V-15).

**Sprint suivant** : Sprint 16.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 14 (verification GO)

```bash
# Verifier Sprint 14 GO
ls skalean-insurtech/sprint14-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint14-verify-report.md
```

### Lancement Sprint 15 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-15-sprint-15-insure-lifecycle-police.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-15-sprint-15-insure-lifecycle-police.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-15-sprint-15-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-15.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 15"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint15-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-15** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-15-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-15 v2.2 detaille -- Sprint 15 (4.2) Insure Lifecycle Avance (transferts/flottes/queue).**

**Total taches detaillees** : 13 | **Effort cumul** : ~75h | **Apport** : Lifecycle police complete (transferts + flottes + queue)
