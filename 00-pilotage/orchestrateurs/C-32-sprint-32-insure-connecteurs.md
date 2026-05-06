# ORCHESTRATEUR SPRINT 32 -- Phase 7 / Sprint 4 : Insure Connecteurs Assureurs (5 connecteurs)
# 13 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 32 / 35 (cumul) -- Sprint 4 dans Phase 7
**Reference meta-prompt** : `B-32-sprint-32-insure-connecteurs.md`
**Reference verification** : `V-32-sprint-32-verification.md`
**Numerotation taches** : 7.4.1 a 7.4.13
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : 5 connecteurs assureurs reels (Wafa+Atlanta+Saham+RMA+AXA)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 13 taches** du Sprint 32 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-32** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-32 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 32

Sprint 32 (7.4) -- Insure Connecteurs Assureurs (5 connecteurs). Voir B-32-sprint-32-insure-connecteurs.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/
  task-7.4.1-prompt.md       # InsurerConnectorInterface + Base Abstract Class
  task-7.4.2-prompt.md       # Wafa Assurance Connector (Priorite 1)
  task-7.4.3-prompt.md       # Atlanta Assurance Connector
  task-7.4.4-prompt.md       # Saham Connector
  task-7.4.5-prompt.md       # RMA Connector
  task-7.4.6-prompt.md       # AXA Maroc Connector
  task-7.4.7-prompt.md       # TarificationOrchestrator (Routing + Fallback)
  task-7.4.8-prompt.md       # SouscriptionOrchestrator (Push Police vers Assureur)
  task-7.4.9-prompt.md       # Sync Polices Service (Pull Updates Assureurs)
  task-7.4.10-prompt.md       # Sinistres Connector : Declaration + Pull Updates
  task-7.4.11-prompt.md       # Webhook Receivers Per Assureur (5 Endpoints)
  task-7.4.12-prompt.md       # Endpoints REST + Admin Monitoring
  task-7.4.13-prompt.md       # Tests E2E (40+) avec Mocks 5 Assureurs
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md
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
4. La verification finale V-32 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 13 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md
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

### Position du Sprint 4 dans la Phase 7

Sprint 32 (7.4) -- **Insure Connecteurs Assureurs (5 connecteurs)**.

Voir `B-32-sprint-32-insure-connecteurs.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

### Apport metier de ce sprint

5 connecteurs assureurs reels (Wafa+Atlanta+Saham+RMA+AXA)

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-32 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 13 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-32, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-32.

---

### Tache 1 / 13 : InsurerConnectorInterface + Base Abstract Class

**Metadonnees** : P0 | 5h | Depend de : Depend de Sprint 14

**But** : Definir interface commune pour 5 connecteurs assureurs + classe abstraite gerant HTTP + retry + circuit breaker.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.1-prompt.md
```

**Actions principales attendues** :
- Interface `repo/packages/insure/src/connectors/insurer-connector.interface.ts` :
- Abstract class `base-insurer-connector.ts` :
- Errors typed : `InsurerUnavailableError`, `InsurerInvalidDataError`, `InsurerProductNotFoundError`, `InsurerCircuitBreakerOpenError`
- Types : `InsurerQuote`, `InsurerPolicy`, `InsurerSinistre`, `InsurerProduct`
- Tests : interface + base class HTTP + circuit breaker

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/connectors/insurer-connector.interface.ts`
  - `repo/packages/insure/src/connectors/base-insurer-connector.ts`
  - `repo/packages/insure/src/connectors/types.ts`
  - `repo/packages/insure/src/connectors/errors.ts`
  - `repo/packages/insure/package.json`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Interface declare 8 methods
  - V2 (P0) : Base class HTTP retry + circuit breaker
  - V3 (P0) : Circuit breaker open -> InsurerCircuitBreakerOpenError

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
git commit -m "feat(sprint-32): insurerconnectorinterface + base abstract class

Task: 7.4.1
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.1"
```

---

### Tache 2 / 13 : Wafa Assurance Connector (Priorite 1)

**Metadonnees** : P0 | 8h | Depend de : Depend de 7.4.1

**But** : Implementation premier connecteur Wafa Assurance (premier partenaire commercial cible MA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.2-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/insure/src/connectors/wafa/wafa.connector.ts` extends BaseInsurerConnector
- Implement methods :
- Authentification : API key (env `WAFA_API_KEY`) bearer + client_id/client_secret pour OAuth2 si requis
- Mapping data Wafa -> Skalean :
- Variables env : `WAFA_API_BASE_URL`, `WAFA_API_KEY`, `WAFA_CLIENT_ID`, `WAFA_CLIENT_SECRET`, `WAFA_WEBHOOK_SECRET`
- Mock client `MockWafaConnector` pour tests

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/connectors/wafa/wafa.connector.ts`
  - `repo/packages/insure/src/connectors/wafa/wafa.connector.spec.ts`
  - `repo/packages/insure/src/connectors/wafa/wafa-mapping.ts`
  - `repo/packages/insure/src/connectors/wafa/types.ts`
  - `repo/packages/insure/src/connectors/wafa/mock-wafa.connector.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Connector implements interface
  - V2 (P0) : 7 methods fonctionnent (mock)
  - V3 (P0) : HMAC signature verification

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
git commit -m "feat(sprint-32): wafa assurance connector (priorite 1)

Task: 7.4.2
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.2"
```

---

### Tache 3 / 13 : Atlanta Assurance Connector

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.2

**But** : Connecteur Atlanta Assurance (autre partenaire majeur).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.3-prompt.md
```

**Actions principales attendues** :
- Service `atlanta.connector.ts` similaire pattern Wafa
- Pattern reutilise : meme interface, adaptations Atlanta-specific
- Variables env : `ATLANTA_*`
- Mapping Atlanta -> Skalean
- Mock + tests

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/connectors/atlanta/atlanta.connector.ts`
  - `repo/packages/insure/src/connectors/atlanta/atlanta-mapping.ts`
  - `repo/packages/insure/src/connectors/atlanta/mock-atlanta.connector.ts`
  - `repo/packages/insure/src/connectors/atlanta/atlanta.connector.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Connector implements interface
  - V2 (P0) : 7 methods fonctionnent
  - V3 (P0) : Tests 10+ scenarios

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
git commit -m "feat(sprint-32): atlanta assurance connector

Task: 7.4.3
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.3"
```

---

### Tache 4 / 13 : Saham Connector

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.3

**But** : Connecteur Saham (groupe Sanlam international, presence MA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.4-prompt.md
```

**Actions principales attendues** :
- (Voir B-XX pour livrables detailles)

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/connectors/saham/saham.connector.ts`
  - `repo/packages/insure/src/connectors/saham/saham-mapping.ts`
  - `repo/packages/insure/src/connectors/saham/mock-saham.connector.ts`
  - `repo/packages/insure/src/connectors/saham/saham.connector.spec.ts`

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
git commit -m "feat(sprint-32): saham connector

Task: 7.4.4
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.4"
```

---

### Tache 5 / 13 : RMA Connector

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.4

**But** : Connecteur RMA (Royale Marocaine d'Assurances, leader marche local).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.5-prompt.md
```

**Actions principales attendues** :
- (Voir B-XX pour livrables detailles)

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/connectors/rma/rma.connector.ts`
  - `repo/packages/insure/src/connectors/rma/rma-mapping.ts`
  - `repo/packages/insure/src/connectors/rma/mock-rma.connector.ts`
  - `repo/packages/insure/src/connectors/rma/rma.connector.spec.ts`

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
git commit -m "feat(sprint-32): rma connector

Task: 7.4.5
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.5"
```

---

### Tache 6 / 13 : AXA Maroc Connector

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.5

**But** : Connecteur AXA (filiale internationale, leader sante MA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.6-prompt.md
```

**Actions principales attendues** :
- (Voir B-XX pour livrables detailles)

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/connectors/axa/axa.connector.ts`
  - `repo/packages/insure/src/connectors/axa/axa-mapping.ts`
  - `repo/packages/insure/src/connectors/axa/mock-axa.connector.ts`
  - `repo/packages/insure/src/connectors/axa/axa.connector.spec.ts`

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
git commit -m "feat(sprint-32): axa maroc connector

Task: 7.4.6
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.6"
```

---

### Tache 7 / 13 : TarificationOrchestrator (Routing + Fallback)

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.6

**But** : Override TarificationService Sprint 14 : si product associe a un assureur connecte -> query real-time. Si assureur down (circuit breaker open) ou pas connecte -> fallback lookup tables Sprint 14.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/insure/src/services/tarification-orchestrator.service.ts`
- Method `getQuote(productId, souscripteurData): { source: 'insurer_realtime' | 'fallback_lookup', breakdown }`
- Logic :
- Cache 5min Redis : eviter quote storm pour produit/data identique
- Logging : source ratio (% real-time vs fallback)
- Tests : real-time success, fallback on circuit breaker, fallback on no connector

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/tarification-orchestrator.service.ts`
  - `repo/packages/insure/src/services/tarification-orchestrator.service.spec.ts`
  - `repo/packages/insure/src/services/connector-registry.service.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Real-time success retourne `source='insurer_realtime'`
  - V2 (P0) : Circuit breaker open -> fallback automatique
  - V3 (P0) : Pas connecteur -> fallback Sprint 14

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
git commit -m "feat(sprint-32): tarificationorchestrator (routing + fallback)

Task: 7.4.7
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.7"
```

---

### Tache 8 / 13 : SouscriptionOrchestrator (Push Police vers Assureur)

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.7

**But** : Apres signature police complete (Sprint 14), pousser police vers assureur (creation chez eux) + storage `insurer_policy_number`.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.8-prompt.md
```

**Actions principales attendues** :
- Consumer Kafka `signature-completed-insure-push.consumer.ts`
- Listen event `signature.workflow_completed` filtre `related_resource_type='insure_policy'`
- Logic :
- Idempotency : verifier `insurer_policy_number` deja set avant submit (eviter doublons)
- Migration : add columns `insure_policies.insurer_policy_number`, `insurer_status`, `insurer_synced_at`
- Tests : push success, retry on transient, DLQ on permanent, idempotency

**Fichiers cibles principaux** :
  - `repo/packages/database/src/migrations/{date}-AddInsurerSyncColumns.ts`
  - `repo/packages/insure/src/consumers/signature-completed-insure-push.consumer.ts`
  - `repo/packages/insure/src/jobs/insurer-push-retry.worker.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Signature complete -> push assureur
  - V2 (P0) : insurer_policy_number stocke
  - V3 (P0) : Idempotency : 2eme call ignore

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
git commit -m "feat(sprint-32): souscriptionorchestrator (push police vers assureur)

Task: 7.4.8
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.8"
```

---

### Tache 9 / 13 : Sync Polices Service (Pull Updates Assureurs)

**Metadonnees** : P0 | 6h | Depend de : Depend de 7.4.8

**But** : Cron job pull updates polices depuis assureurs (cas modifications cote assureur : suspension, prime ajustee, etc.) + reconcile Skalean.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.9-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/insure/src/services/policy-sync.service.ts`
- Method `syncPoliciesFromInsurer(provider): Promise<{ updated, conflicts }>` :
- Cron job daily 6h matin
- Endpoint manual trigger : `POST /api/v1/admin/insure/sync-policies?provider=wafa`
- Logs : policies synced, updated, conflicts
- Tests : sync OK + conflicts detection

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/policy-sync.service.ts`
  - `repo/packages/insure/src/jobs/policy-sync.cron.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-insure-sync.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Sync detect updates assureur
  - V2 (P0) : Update Skalean
  - V3 (P0) : Conflicts flagged

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
git commit -m "feat(sprint-32): sync polices service (pull updates assureurs)

Task: 7.4.9
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.9"
```

---

### Tache 10 / 13 : Sinistres Connector : Declaration + Pull Updates

**Metadonnees** : P0 | 5h | Depend de : Depend de 7.4.9

**But** : Permettre declaration sinistre depuis Skalean vers assureur + sync updates assureur retour. Sprint 22 implementera workflow sinistre complet ; Sprint 32 prepare connecteur.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.10-prompt.md
```

**Actions principales attendues** :
- Methods `declareSinistre()` + `getSinistre()` deja Sprint 32 dans connectors (Tache 7.4.2-6)
- Service `sinistre-sync.service.ts` :
- Migration prep tables sinistres (Sprint 22 enrichira) : add columns `repair_sinistres.insurer_sinistre_number`, `insurer_status`
- Sprint 32 livre infrastructure ; Sprint 22 utilisera
- Tests via mocks

**Fichiers cibles principaux** :
  - `repo/packages/insure/src/services/sinistre-sync.service.ts`
  - `repo/packages/database/src/migrations/{date}-AddSinistreInsurerSync.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : declareToInsurer push sinistre
  - V2 (P0) : Sync from insurer
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
git commit -m "feat(sprint-32): sinistres connector : declaration + pull updates

Task: 7.4.10
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.10"
```

---

### Tache 11 / 13 : Webhook Receivers Per Assureur (5 Endpoints)

**Metadonnees** : P0 | 7h | Depend de : Depend de 7.4.10

**But** : 5 endpoints webhooks (un par assureur) pour recevoir notifications real-time depuis assureurs (status update, sinistre regle, etc.).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.11-prompt.md
```

**Actions principales attendues** :
- 5 controllers `/api/v1/public/webhooks/{wafa,atlanta,saham,rma,axa}`
- Pattern reutilise Sprint 9/10/11 :
- Consumer Kafka `insurer-webhook-processor.consumer.ts` :
- Tests E2E : 5 webhooks per provider

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/insure/webhooks/{5 controllers}.ts`
  - `repo/apps/api/src/modules/insure/middleware/{5 signatures}.ts`
  - `repo/apps/api/src/modules/insure/consumers/insurer-webhook-processor.consumer.ts`
  - `repo/apps/api/test/insure/webhooks/{5 specs}.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 5 webhooks endpoints
  - V2 (P0) : Signatures verifiees per assureur
  - V3 (P0) : Idempotency

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
git commit -m "feat(sprint-32): webhook receivers per assureur (5 endpoints)

Task: 7.4.11
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.11"
```

---

### Tache 12 / 13 : Endpoints REST + Admin Monitoring

**Metadonnees** : P0 | 4h | Depend de : Depend de 7.4.11

**But** : Endpoints API publique connectors + admin monitoring health connectors.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.12-prompt.md
```

**Actions principales attendues** :
- Endpoint `GET /api/v1/insure/connectors` (list configured)
- Endpoint `POST /api/v1/insure/connectors/:provider/test` (super admin : test connection)
- Endpoint admin `GET /api/v1/admin/insure/connectors/health` :
- Dashboard ADMIN : page health connectors (Sprint 27 enrichira UI)
- Tests

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/insure/controllers/connectors.controller.ts`
  - `repo/apps/api/src/modules/admin/controllers/admin-connectors-health.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : List connecteurs
  - V2 (P0) : Test connection
  - V3 (P0) : Health endpoint admin

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
git commit -m "feat(sprint-32): endpoints rest + admin monitoring

Task: 7.4.12
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.12"
```

---

### Tache 13 / 13 : Tests E2E (40+) avec Mocks 5 Assureurs

**Metadonnees** : P0 | 9h | Depend de : Depend de 7.4.12

**But** : Suite tests E2E + circuit breaker scenarios + mock 5 assureurs.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.4.13-prompt.md
```

**Actions principales attendues** :
- Per connecteur (5 x 6 tests = 30) : getQuote / submitPolicy / getPolicy / cancelPolicy / declareSinistre / verifyWebhookSignature
- TarificationOrchestrator : real-time + fallback + cache (3)
- SouscriptionOrchestrator : push + retry + DLQ (3)
- PolicySync : sync + conflicts (2)
- Webhooks : 5 receivers signature verified (5)
- Circuit breaker : open after errors + halfopen reset (2)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/insure/connectors/{30+ specs}.e2e-spec.ts`
  - `repo/apps/api/test/fixtures/mock-insurer-servers/{5 mock servers}`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 40+ tests passent
  - V2 (P0) : Mocks 5 assureurs fonctionnent
  - V3 (P0) : Circuit breaker scenarios verifies

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
git commit -m "feat(sprint-32): tests e2e (40+) avec mocks 5 assureurs

Task: 7.4.13
Sprint: 32 (Phase 7 / Sprint 4)
Phase: 7 -- Hardening + Integrations + Pilote
Decisions: see B-32 Tache 7.4.13"
```

---


## VERIFICATION DU SPRINT 32

Une fois les 13 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md
```

Le fichier de verification V-32 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint32-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint32-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint32-verify-report.md
git commit -m "chore(sprint-32): close sprint 32 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 7 (Hardening + Integrations + Pilote)
- Sprint : 32 (Phase 7 / Sprint 4)
- Apport : 5 connecteurs assureurs reels (Wafa+Atlanta+Saham+RMA+AXA)
- Tests E2E cumules : {N}+

Sprint 32 completed -- handoff to Sprint 33."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 32]
   |
   v
[Tache 7.4.1: InsurerConnectorInterface + Base Abstract Class]
   | -> compile -> tests -> commit
   v
[Tache 7.4.2: Wafa Assurance Connector (Priorite 1)]
   | -> compile -> tests -> commit
   v
[Tache 7.4.3: Atlanta Assurance Connector]
   | -> compile -> tests -> commit
   v
[Tache 7.4.4: Saham Connector]
   | -> compile -> tests -> commit
   v
[Tache 7.4.5: RMA Connector]
   | -> compile -> tests -> commit
   v
[Tache 7.4.6: AXA Maroc Connector]
   | -> compile -> tests -> commit
   v
[Tache 7.4.7: TarificationOrchestrator (Routing + Fallback)]
   | -> compile -> tests -> commit
   v
[Tache 7.4.8: SouscriptionOrchestrator (Push Police vers Assureur)]
   | -> compile -> tests -> commit
   v
[Tache 7.4.9: Sync Polices Service (Pull Updates Assureurs)]
   | -> compile -> tests -> commit
   v
[Tache 7.4.10: Sinistres Connector : Declaration + Pull Updates]
   | -> compile -> tests -> commit
   v
[Tache 7.4.11: Webhook Receivers Per Assureur (5 Endpoints)]
   | -> compile -> tests -> commit
   v
[Tache 7.4.12: Endpoints REST + Admin Monitoring]
   | -> compile -> tests -> commit
   v
[Tache 7.4.13: Tests E2E (40+) avec Mocks 5 Assureurs]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 32 -- V-32]
   |
   v
[Rapport sprint32-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (6h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : apps/mcp-server, @insurtech/sky, @insurtech/sky-ui, infrastructure (Atlas Cloud Services prod, Cloudflare CDN, K6 chaos)

**Apport metier principal** : 5 connecteurs assureurs reels (Wafa+Atlanta+Saham+RMA+AXA).

**Prerequis Sprint 33** : Sprint 32 GO complet (score >= 95% verification automatique V-32).

**Sprint suivant** : Sprint 33.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 31 (verification GO)

```bash
# Verifier Sprint 31 GO
ls skalean-insurtech/sprint31-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint31-verify-report.md
```

### Lancement Sprint 32 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-32-sprint-32-insure-connecteurs.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-32-sprint-32-insure-connecteurs.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-32.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 32"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint32-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-32** complet avant generation prompts taches (contexte critique)
2. **Generer les 13 prompts taches** dans `00-pilotage/prompts-taches/sprint-32-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-32 v2.2 detaille -- Sprint 32 (7.4) Insure Connecteurs Assureurs (5 connecteurs).**

**Total taches detaillees** : 13 | **Effort cumul** : ~80h | **Apport** : 5 connecteurs assureurs reels (Wafa+Atlanta+Saham+RMA+AXA)
