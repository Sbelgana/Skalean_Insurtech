# ORCHESTRATEUR SPRINT 35 -- Phase 7 / Sprint 7 : Pilote Marrakech + Go-Live (4 sem + suivi)
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 35 / 35 (cumul) -- Sprint 7 dans Phase 7
**Reference meta-prompt** : `B-35-sprint-35-pilote-marrakech-go-live.md`
**Reference verification** : `V-35-sprint-35-verification.md`
**Numerotation taches** : 7.7.1 a 7.7.14
**Effort total** : ~150 heures developpement / 2 semaines
**Apport metier** : Pilote Marrakech success + Go-Live commercial

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 35 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-35** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-35 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 35

Sprint 35 (7.7) -- Pilote Marrakech + Go-Live (4 sem + suivi). Voir B-35-sprint-35-pilote-marrakech-go-live.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/
  task-7.7.1-prompt.md       # Pre-Pilote Checklist + Freeze Code
  task-7.7.2-prompt.md       # Onboarding Skalean Atlas + Wafa Assurance
  task-7.7.3-prompt.md       # Onboarding 2-3 Brokers Tenants Partenaires
  task-7.7.4-prompt.md       # Onboarding 1-2 Garages Partenaires
  task-7.7.5-prompt.md       # Customer Acquisition (50+ Assures)
  task-7.7.6-prompt.md       # Office Marrakech Setup + Support 24/7
  task-7.7.7-prompt.md       # Communications Launch
  task-7.7.8-prompt.md       # Launch Day Operations
  task-7.7.9-prompt.md       # Pilote 4 Semaines Operations
  task-7.7.10-prompt.md       # Customer Feedback Loop
  task-7.7.11-prompt.md       # KPIs Tracking + ACAPS Reporting
  task-7.7.12-prompt.md       # Lessons Learned + Retrospective
  task-7.7.13-prompt.md       # Plan Generalisation Phase 8
  task-7.7.14-prompt.md       # Programme Closure
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-35-sprint-35-verification.md
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
4. La verification finale V-35 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-35-sprint-35-verification.md
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

## CONTEXTE PHASE 7 -- Hardening + Integrations + Pilote

### Position du Sprint 7 dans la Phase 7

Sprint 35 (7.7) -- **Pilote Marrakech + Go-Live (4 sem + suivi)**.

Voir `B-35-sprint-35-pilote-marrakech-go-live.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

### Apport metier de ce sprint

Pilote Marrakech success + Go-Live commercial

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-35 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-35, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-35.

---

### Tache 1 / 14 : Pre-Pilote Checklist + Freeze Code

**Metadonnees** : P0 | 8h | Depend de : Depend de Sprint 34

**But** : Verification finale Sprint 33 + Sprint 34 acceptance criteria + code freeze + final testing.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.1-prompt.md
```

**Actions principales attendues** :
- **Sprint 33 prerequisites** :
- **Sprint 34 prerequisites** :
- **Code freeze** : 7 jours pre-launch, no new features, hotfixes only
- **Smoke testing complet** sur staging :
- **Backup pre-launch** : snapshot DB + S3 + configurations
- **Go/no-go decision** : meeting executive Skalean (CEO + CTO + COO + Legal) -> sign-off official

**Fichiers cibles principaux** :
  - `repo/docs/pilote/pre-pilote-checklist.md`
  - `repo/docs/pilote/go-no-go-decision-template.md`
  - `repo/infrastructure/scripts/pre-pilote-smoke-test.sh`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Checklist 100% green
  - V2 (P0) : Smoke tests green
  - V3 (P0) : Go/no-go signed off

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
git commit -m "feat(sprint-35): pre-pilote checklist + freeze code

Task: 7.7.1
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.1"
```

---

### Tache 2 / 14 : Onboarding Skalean Atlas + Wafa Assurance

**Metadonnees** : P0 | 10h | Depend de : Depend de 7.7.1

**But** : Activate Skalean Atlas (deja seed Sprint 19) + onboarding Wafa Assurance (connecteur Sprint 32).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.2-prompt.md
```

**Actions principales attendues** :
- Skalean Atlas activation production :
- Wafa Assurance connecteur Sprint 32 :
- Documentation operationnelle :

**Fichiers cibles principaux** :
  - `repo/docs/pilote/atlas-onboarding-complete.md`
  - `repo/docs/pilote/wafa-connecteur-activation.md`
  - `repo/infrastructure/scripts/promote-staging-to-production.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Atlas operationnel production
  - V2 (P0) : Wafa connecteur active + tests OK
  - V3 (P0) : 8 employees Atlas onboarded

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
git commit -m "feat(sprint-35): onboarding skalean atlas + wafa assurance

Task: 7.7.2
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.2"
```

---

### Tache 3 / 14 : Onboarding 2-3 Brokers Tenants Partenaires

**Metadonnees** : P0 | 12h | Depend de : Depend de 7.7.2

**But** : Identifier + onboarder 2-3 agences courtiers Marrakech (Type 2 managed_partner Sprint 25).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.3-prompt.md
```

**Actions principales attendues** :
- Identification + signature contrats partenariat :
- Onboarding wizard Sprint 25/26 execute pour chaque tenant :
- Formation users :
- Migration data legacy (si tenant existant) -- **decision strategique pilote** :
- Support dedicated premiers 30 jours : hotline + Slack channel + on-site visits

**Fichiers cibles principaux** :
  - `repo/docs/pilote/brokers-onboarding-{tenant1,tenant2,tenant3}.md`
  - `repo/docs/training/broker-formation-materials/{several}.md`
  - `repo/infrastructure/scripts/data-migration-legacy-{tenant}.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 2-3 brokers tenants activated
  - V2 (P0) : Users formed + certified
  - V3 (P0) : Data migration complete (si applicable)

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
git commit -m "feat(sprint-35): onboarding 2-3 brokers tenants partenaires

Task: 7.7.3
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.3"
```

---

### Tache 4 / 14 : Onboarding 1-2 Garages Partenaires

**Metadonnees** : P0 | 10h | Depend de : Depend de 7.7.3

**But** : Onboarder 1-2 garages partenaires Marrakech (Type 2 managed_partner ou Type 3 api_partner).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.4-prompt.md
```

**Actions principales attendues** :
- Identification garages :
- Onboarding workflow Sprint 25/26 :
- Formation users garage :
- Tests integration end-to-end :
- Support hotline dedicated

**Fichiers cibles principaux** :
  - `repo/docs/pilote/garages-onboarding-{garage1,garage2}.md`
  - `repo/docs/training/garage-formation-materials/{several}.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 1-2 garages activated
  - V2 (P0) : Tests integration M8 OK
  - V3 (P0) : Users formes

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
git commit -m "feat(sprint-35): onboarding 1-2 garages partenaires

Task: 7.7.4
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.4"
```

---

### Tache 5 / 14 : Customer Acquisition (50+ Assures)

**Metadonnees** : P0 | 14h | Depend de : Depend de 7.7.4

**But** : Acquisition 50+ customers Marrakech via campagne digital + agence physique + brokers partners referrals.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.5-prompt.md
```

**Actions principales attendues** :
- Strategie acquisition multi-channel :
- Materiel marketing :
- Offre incitative pilote :
- KPIs acquisition :
- Support sales : Sprint 8 CRM tracker pipelines

**Fichiers cibles principaux** :
  - `repo/docs/pilote/customer-acquisition-strategy.md`
  - `repo/docs/marketing/{several materials}.pdf`
  - `repo/apps/web-customer-portal/app/[locale]/landing-pilote/page.tsx`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 50+ customers acquired
  - V2 (P0) : CAC < 500 MAD
  - V3 (P0) : Conversion rate target met

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
git commit -m "feat(sprint-35): customer acquisition (50+ assures)

Task: 7.7.5
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.5"
```

---

### Tache 6 / 14 : Office Marrakech Setup + Support 24/7

**Metadonnees** : P0 | 10h | Depend de : Depend de 7.7.5

**But** : Etablir presence physique Marrakech : office + equipe + support 24/7 hotline.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.6-prompt.md
```

**Actions principales attendues** :
- Office Marrakech : location 50-100m2 quartier business + IT setup
- Equipe locale 4-6 personnes :
- Support 24/7 hotline :
- Tools support :
- SLA support :

**Fichiers cibles principaux** :
  - `repo/docs/pilote/office-marrakech-setup.md`
  - `repo/docs/pilote/support-24-7-runbook.md`
  - `repo/docs/pilote/sla-support-customers.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Office operationnel
  - V2 (P0) : Equipe locale onboarded
  - V3 (P0) : Hotline 24/7 active

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
git commit -m "feat(sprint-35): office marrakech setup + support 24/7

Task: 7.7.6
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.6"
```

---

### Tache 7 / 14 : Communications Launch

**Metadonnees** : P0 | 8h | Depend de : Depend de 7.7.6

**But** : Communications launch officiel : RP + marketing + ACAPS notification + presse MA.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.7-prompt.md
```

**Actions principales attendues** :
- RP Strategy :
- Marketing :
- ACAPS notification officielle :
- Stakeholders communications :
- Web presence :

**Fichiers cibles principaux** :
  - `repo/docs/pilote/launch-communications-plan.md`
  - `repo/docs/pilote/communique-presse.md`
  - `repo/docs/pilote/acaps-notification-official.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Communique presse distribue
  - V2 (P0) : ACAPS notification + meeting
  - V3 (P0) : Stakeholders informes

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
git commit -m "feat(sprint-35): communications launch

Task: 7.7.7
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.7"
```

---

### Tache 8 / 14 : Launch Day Operations

**Metadonnees** : P0 | 16h | Depend de : Depend de 7.7.7

**But** : Day-of launch operations : war room + monitoring intensif premier 72h.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.8-prompt.md
```

**Actions principales attendues** :
- **War room** : equipe Skalean dedicated 72h (rotation 24/7)
- Monitoring intensif :
- Issues triage :
- Hotfixes preparation :
- Comms hourly first 24h :
- Customer-facing transparency :

**Fichiers cibles principaux** :
  - `repo/docs/pilote/launch-day-runbook.md`
  - `repo/docs/pilote/war-room-protocols.md`
  - `repo/infrastructure/scripts/hotfix-deploy.sh`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : War room 72h sustained
  - V2 (P0) : Monitoring continuous
  - V3 (P0) : Issues triage SLA met

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
git commit -m "feat(sprint-35): launch day operations

Task: 7.7.8
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.8"
```

---

### Tache 9 / 14 : Pilote 4 Semaines Operations

**Metadonnees** : P0 | 24h | Depend de : Depend de 7.7.8

**But** : Operations pilote 4 semaines + daily standups + weekly reviews + issues triage continu.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.9-prompt.md
```

**Actions principales attendues** :
- **Daily standups** (15 min) :
- **Weekly reviews** (1h) :
- **Issues triage** :
- Iteration features :
- **Bi-weekly business reviews** : C-level Skalean
- Documentation evolutive : decisions + learnings

**Fichiers cibles principaux** :
  - `repo/docs/pilote/daily-standups-log.md`
  - `repo/docs/pilote/weekly-reviews-{w1,w2,w3,w4}.md`
  - `repo/docs/pilote/iterations-log.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Daily standups sustained 4 semaines
  - V2 (P0) : Weekly reviews documente
  - V3 (P0) : Issues triage SLA met

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
git commit -m "feat(sprint-35): pilote 4 semaines operations

Task: 7.7.9
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.9"
```

---

### Tache 10 / 14 : Customer Feedback Loop

**Metadonnees** : P0 | 10h | Depend de : Depend de 7.7.9

**But** : Loop feedback customers + NPS surveys + interviews + ratings + iterations rapides.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.10-prompt.md
```

**Actions principales attendues** :
- NPS surveys post-interactions critiques :
- Interviews qualitatives : 10-15 customers + 5-10 partner users
- Ratings collectes Sprint 22 web-garage post-livraison
- Analytics dashboard `/admin/feedback` :
- Iterations weekly basees feedback :
- Public reviews encourager : Google Reviews + Trustpilot

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/feedback/page.tsx`
  - `repo/packages/feedback/src/services/nps-tracker.service.ts`
  - `repo/docs/pilote/customer-feedback-analysis.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : NPS surveys + interviews
  - V2 (P0) : Dashboard feedback
  - V3 (P0) : Iterations applique

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
git commit -m "feat(sprint-35): customer feedback loop

Task: 7.7.10
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.10"
```

---

### Tache 11 / 14 : KPIs Tracking + ACAPS Reporting

**Metadonnees** : P0 | 8h | Depend de : Depend de 7.7.10

**But** : Tracking KPIs intensif + dashboards C-level + ACAPS reporting trimestriel pre-emptif.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.11-prompt.md
```

**Actions principales attendues** :
- **KPIs Business** :
- **KPIs Operationnels** :
- **KPIs Compliance** :
- Dashboards C-level :
- **ACAPS reporting trimestriel** : premier rapport pilote 30 jours (Sprint 28 backend deja consume)

**Fichiers cibles principaux** :
  - `repo/apps/web-insurtech-admin/app/[locale]/(protected)/c-level-daily/page.tsx`
  - `repo/docs/pilote/kpis-tracking-framework.md`
  - `repo/docs/pilote/acaps-first-report-pilote-q1.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : KPIs tracking framework
  - V2 (P0) : Dashboards C-level
  - V3 (P0) : ACAPS report submitted

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
git commit -m "feat(sprint-35): kpis tracking + acaps reporting

Task: 7.7.11
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.11"
```

---

### Tache 12 / 14 : Lessons Learned + Retrospective

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.7.11

**But** : Retrospective post-pilote + lessons learned documentees + planning Phase 8.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.12-prompt.md
```

**Actions principales attendues** :
- Retrospective sessions :
- Format retrospective : "Started / Stopped / Continued / Discovered"
- Lessons learned documents :
- Plan corrections + improvements Phase 8

**Fichiers cibles principaux** :
  - `repo/docs/pilote/retrospective-pilote-marrakech.md`
  - `repo/docs/pilote/lessons-learned-{technique,business,operations}.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Retrospectives 4 stakeholders groups
  - V2 (P0) : Lessons documente

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
git commit -m "feat(sprint-35): lessons learned + retrospective

Task: 7.7.12
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.12"
```

---

### Tache 13 / 14 : Plan Generalisation Phase 8

**Metadonnees** : P0 | 8h | Depend de : Depend de 7.7.12

**But** : Plan generalisation post-pilote : Casablanca + Rabat + scale-up roadmap Phase 8.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.13-prompt.md
```

**Actions principales attendues** :
- Document strategique `repo/docs/phase-8-roadmap-scale-up.md` :
- Scale-up requirements :
- Investment plan : levee fonds Series A si necessary
- Plan iterations features post-pilote :
- Expansion internationale prep : Tunisie + Algerie (Phase 9)

**Fichiers cibles principaux** :
  - `repo/docs/phase-8-roadmap-scale-up.md`
  - `repo/docs/phase-8-investment-plan.md`
  - `repo/docs/feature-backlog-prioritized.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Roadmap Phase 8 detaillee
  - V2 (P0) : Scale-up requirements
  - V3 (P0) : Feature backlog priorise

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
git commit -m "feat(sprint-35): plan generalisation phase 8

Task: 7.7.13
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.13"
```

---

### Tache 14 / 14 : Programme Closure

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.7.13

**But** : **Programme closure officielle** : 35 sprints completes + livrables finals + handover documentation.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-35-pilote-marrakech-go-live/task-7.7.14-prompt.md
```

**Actions principales attendues** :
- **Programme closure document** `repo/docs/programme-closure-final.md` :
- **Livrables finals** :
- **Handover** :
- **Communications closure** :
- Backlog Phase 8 official : Jira/Linear setup with Phase 8 epics

**Fichiers cibles principaux** :
  - `repo/docs/programme-closure-final.md`
  - `repo/docs/handover-tech-to-ops.md`
  - `repo/docs/celebration-acknowledgments.md`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Programme closure officielle
  - V2 (P0) : Handover complete
  - V3 (P0) : Communications closure

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
git commit -m "feat(sprint-35): programme closure

Task: 7.7.14
Sprint: 35 (Phase 7 / Sprint 7)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-35 Tache 7.7.14"
```

---


## VERIFICATION DU SPRINT 35

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-35-sprint-35-verification.md
```

Le fichier de verification V-35 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint35-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint35-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint35-verify-report.md
git commit -m "chore(sprint-35): close sprint 35 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 7 (Hardening + Integrations + Pilote)
- Sprint : 35 (Phase 7 / Sprint 7)
- Apport : Pilote Marrakech success + Go-Live commercial
- Tests E2E cumules : {N}+

Sprint 35 completed -- handoff to Sprint 35."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 35]
   |
   v
[Tache 7.7.1: Pre-Pilote Checklist + Freeze Code]
   | -> compile -> tests -> commit
   v
[Tache 7.7.2: Onboarding Skalean Atlas + Wafa Assurance]
   | -> compile -> tests -> commit
   v
[Tache 7.7.3: Onboarding 2-3 Brokers Tenants Partenaires]
   | -> compile -> tests -> commit
   v
[Tache 7.7.4: Onboarding 1-2 Garages Partenaires]
   | -> compile -> tests -> commit
   v
[Tache 7.7.5: Customer Acquisition (50+ Assures)]
   | -> compile -> tests -> commit
   v
[Tache 7.7.6: Office Marrakech Setup + Support 24/7]
   | -> compile -> tests -> commit
   v
[Tache 7.7.7: Communications Launch]
   | -> compile -> tests -> commit
   v
[Tache 7.7.8: Launch Day Operations]
   | -> compile -> tests -> commit
   v
[Tache 7.7.9: Pilote 4 Semaines Operations]
   | -> compile -> tests -> commit
   v
[Tache 7.7.10: Customer Feedback Loop]
   | -> compile -> tests -> commit
   v
[Tache 7.7.11: KPIs Tracking + ACAPS Reporting]
   | -> compile -> tests -> commit
   v
[Tache 7.7.12: Lessons Learned + Retrospective]
   | -> compile -> tests -> commit
   v
[Tache 7.7.13: Plan Generalisation Phase 8]
   | -> compile -> tests -> commit
   v
[Tache 7.7.14: Programme Closure]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 35 -- V-35]
   |
   v
[Rapport sprint35-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 150 heures (10h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

**Apport metier principal** : Pilote Marrakech success + Go-Live commercial.

**Prerequis Sprint final** : Sprint 35 GO complet (score >= 95% verification automatique V-35).

**Sprint suivant** : FIN PROGRAMME (Pilote Marrakech termine -> Generalisation Phase 8+).

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 34 (verification GO)

```bash
# Verifier Sprint 34 GO
ls skalean-insurtech/sprint34-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint34-verify-report.md
```

### Lancement Sprint 35 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-35-sprint-35-pilote-marrakech-go-live.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-35-sprint-35-pilote-marrakech-go-live.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-35-sprint-35-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-35.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 35"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint35-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-35** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-35-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-35 v2.2 detaille -- Sprint 35 (7.7) Pilote Marrakech + Go-Live (4 sem + suivi).**

**Total taches detaillees** : 14 | **Effort cumul** : ~150h | **Apport** : Pilote Marrakech success + Go-Live commercial
