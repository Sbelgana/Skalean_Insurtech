# ORCHESTRATEUR SPRINT 11 -- Phase 3 / Sprint 4 : Pay Multi-Passerelles MA (6 gateways)
# 14 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (Option B detaillee)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 11 / 35 (cumul) -- Sprint 4 dans Phase 3
**Reference meta-prompt** : `B-11-sprint-11-pay-ma-multi.md`
**Reference verification** : `V-11-sprint-11-verification.md`
**Numerotation taches** : 3.4.1 a 3.4.14
**Effort total** : ~80 heures developpement / 2 semaines
**Apport metier** : 6 passerelles MA integrees + reconciliation Books

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 14 taches** du Sprint 11 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-11** -- pour code complet, patterns critiques et tests exhaustifs, lire le meta-prompt B-11 reference dans chaque tache.

---

## OBJECTIF DU SPRINT 11

Sprint 11 (3.4) -- Pay Multi-Passerelles MA (6 gateways). Voir B-11-sprint-11-pay-ma-multi.md pour contexte detaille.

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/
  task-3.4.1-prompt.md       # Entities pay_methods + pay_transactions + pay_reconciliation
  task-3.4.2-prompt.md       # PaymentGatewayInterface + Base Abstract Gateway
  task-3.4.3-prompt.md       # CMI Gateway (Cards EMV + 3DS)
  task-3.4.4-prompt.md       # YouCan Pay Gateway (Cards Alternative)
  task-3.4.5-prompt.md       # PayZone Gateway (Cards + Cash Kiosques)
  task-3.4.6-prompt.md       # Mobile Wallets : Inwi Money + Orange Money + M-Wallet BAM
  task-3.4.7-prompt.md       # PaymentOrchestrator + GatewaySelector
  task-3.4.8-prompt.md       # Webhooks Receivers (6 Providers) + Signature Verification
  task-3.4.9-prompt.md       # Refund Service (Partial + Full) avec Workflow Approval
  task-3.4.10-prompt.md       # Reconciliation Service (CSV Bank + Auto-Match)
  task-3.4.11-prompt.md       # Fraud Detection Rules Engine Basique
  task-3.4.12-prompt.md       # BullMQ Retry Queues + DLQ + Idempotency
  task-3.4.13-prompt.md       # Endpoints REST + Integration Comm + Docs
  task-3.4.14-prompt.md       # Tests E2E Exhaustifs (50+) avec Sandboxes
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-11-sprint-11-verification.md
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
4. La verification finale V-11 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

APRES avoir execute les 14 taches et commite chacune :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-11-sprint-11-verification.md
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

### Position du Sprint 4 dans la Phase 3

Sprint 11 (3.4) -- **Pay Multi-Passerelles MA (6 gateways)**.

Voir `B-11-sprint-11-pay-ma-multi.md` (section "POSITION DANS LA PHASE" + "DEPENDANCES") pour contexte detaille des dependances cross-sprints (entrees consommees + sorties produites).

### Modules concernes par cette Phase

@insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

### Apport metier de ce sprint

6 passerelles MA integrees + reconciliation Books

### Decisions strategiques applicables

Cf. `00-pilotage/decisions/`. Decisions cles pour ce sprint : voir B-11 section "Decisions strategiques applicables".

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

Chaque tache ci-dessous indique : metadata (priorite/effort/deps), but extrait de B-11, actions principales (livrables checkables), fichiers cibles, criteres P0, validation et commit.

**Pour code complet, patterns critiques, tests exhaustifs** : lire le prompt tache detaille genere depuis B-11.

---

### Tache 1 / 14 : Entities pay_methods + pay_transactions + pay_reconciliation

**Metadonnees** : P0 | 4h | Depend de : Depend de Sprint 10

**But** : Enrichir entities pay_* (Sprint 2 deja migration) avec types TypeScript + schemas Zod CRUD + helpers.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.1-prompt.md
```

**Actions principales attendues** :
- Entity `repo/packages/pay/src/entities/pay-method.entity.ts` (mode paiement configure par tenant)
- Entity `repo/packages/pay/src/entities/pay-transaction.entity.ts` (transactions individuelles)
- Entity `repo/packages/pay/src/entities/pay-reconciliation.entity.ts` (reconciliation banque)
- Enums :
- Schemas Zod :
- Validators MA : amount montant max 100000 MAD per transaction (BAM regulation), currency MAD only

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/entities/pay-method.entity.ts`
  - `repo/packages/pay/src/entities/pay-transaction.entity.ts`
  - `repo/packages/pay/src/entities/pay-reconciliation.entity.ts`
  - `repo/packages/pay/src/schemas/payment.schema.ts`
  - `repo/packages/pay/src/schemas/refund.schema.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Entities hydrate
  - V2 (P0) : Amount > 100000 MAD rejete (BAM rule)
  - V3 (P0) : Currency != MAD rejete

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
git commit -m "feat(sprint-11): entities pay_methods + pay_transactions + pay_reconciliation

Task: 3.4.1
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.1"
```

---

### Tache 2 / 14 : PaymentGatewayInterface + Base Abstract Gateway

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.4.1

**But** : Definir interface commune `PaymentGatewayInterface` + classe abstraite `BaseGateway` partageant logique commune (HTTP client, retry, logging, errors).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.2-prompt.md
```

**Actions principales attendues** :
- Interface `repo/packages/pay/src/interfaces/payment-gateway.interface.ts` :
- Abstract class `repo/packages/pay/src/gateways/base-gateway.ts` :
- Types : `InitiatePaymentRequest`, `InitiatePaymentResult`, `PaymentStatus`, `CaptureResult`, `RefundResult`
- Errors typed : `GatewayUnavailableError`, `GatewayInvalidRequestError`, `GatewayInsufficientFundsError`, `GatewayCardDeclinedError`, `GatewayFraudDetectedError`
- Tests : interface compile + base class HTTP retry works

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/interfaces/payment-gateway.interface.ts`
  - `repo/packages/pay/src/gateways/base-gateway.ts`
  - `repo/packages/pay/src/types/gateway-results.ts`
  - `repo/packages/pay/src/errors/gateway-errors.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Interface declare 6+ methods
  - V2 (P0) : Base class HTTP retry sur 5xx
  - V3 (P0) : Errors typed correctement

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
git commit -m "feat(sprint-11): paymentgatewayinterface + base abstract gateway

Task: 3.4.2
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.2"
```

---

### Tache 3 / 14 : CMI Gateway (Cards EMV + 3DS)

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.4.2

**But** : Integration **CMI** (Centre Monetique Interbancaire MA) -- principale passerelle cards EMV au Maroc, infrastructure officielle utilisees par 90% banques. 3D Secure mandatory.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.3-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/gateways/cmi/cmi.gateway.ts` extends BaseGateway implements PaymentGatewayInterface
- `initiate()` : construit form data with HMAC signature -> retourne URL CMI 3DS + form_data
- `getStatus()` : query CMI status API (post-redirect)
- `refund()` : POST refund API
- `verifyWebhookSignature()` : verify hash retour CMI matches expected (HMAC-SHA512)
- Variables env : `CMI_MERCHANT_ID`, `CMI_STORE_KEY` (secret hash), `CMI_CLIENT_ID`, `CMI_BASE_URL` (sandbox vs prod)

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/gateways/cmi/cmi.gateway.ts`
  - `repo/packages/pay/src/gateways/cmi/cmi.gateway.spec.ts`
  - `repo/packages/pay/src/gateways/cmi/cmi-types.ts`
  - `repo/packages/pay/src/gateways/cmi/cmi-error-mapping.ts`
  - `repo/packages/pay/src/gateways/cmi/mock-cmi.gateway.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : initiate retourne formData + hash
  - V2 (P0) : Hash SHA-512 correctement calcule
  - V3 (P0) : 3DS enabled (storetype 3D_PAY_HOSTING)

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
git commit -m "feat(sprint-11): cmi gateway (cards emv + 3ds)

Task: 3.4.3
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.3"
```

---

### Tache 4 / 14 : YouCan Pay Gateway (Cards Alternative)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.4.3

**But** : Integration **YouCan Pay** (startup MA fintech, alternative legere a CMI). API REST moderne JSON. Cards 3DS supportees.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.4-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.ts`
- `initiate()` : POST `/transactions` JSON -> retourne `payment_url` + token
- `getStatus()` : GET `/transactions/:token`
- `refund()` : POST `/refunds`
- `verifyWebhookSignature()` : HMAC-SHA256 verification (env `YOUCAN_PAY_WEBHOOK_SECRET`)
- Variables env : `YOUCAN_PAY_PUBLIC_KEY`, `YOUCAN_PAY_PRIVATE_KEY`, `YOUCAN_PAY_WEBHOOK_SECRET`, `YOUCAN_PAY_BASE_URL`

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.ts`
  - `repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.spec.ts`
  - `repo/packages/pay/src/gateways/youcan-pay/mock-youcan-pay.gateway.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : initiate retourne payment_url
  - V2 (P0) : getStatus retourne PaymentStatus normalise
  - V3 (P0) : Webhook signature HMAC-SHA256 verifiee

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
git commit -m "feat(sprint-11): youcan pay gateway (cards alternative)

Task: 3.4.4
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.4"
```

---

### Tache 5 / 14 : PayZone Gateway (Cards + Cash Kiosques)

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.4.4

**But** : Integration **PayZone** -- inclut paiement cash via kiosques (Tabac shops + agences PayZone) -- cible audience non-bancarisee MA.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.5-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/gateways/payzone/payzone.gateway.ts`
- Methods : initiate (genere voucher + barcode + URL) + getStatus + refund (cash refund process specifique)
- Cash voucher : barcode 1D Code 128 + 7 jours expiry default
- Cards EMV path additionnel
- Webhook receiver : kiosque scan voucher + paiement -> webhook update transaction
- Variables env : `PAYZONE_API_KEY`, `PAYZONE_MERCHANT_ID`, `PAYZONE_BASE_URL`

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/gateways/payzone/payzone.gateway.ts`
  - `repo/packages/pay/src/gateways/payzone/voucher-renderer.ts`
  - `repo/packages/pay/src/gateways/payzone/payzone.gateway.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : initiate cash retourne voucher PDF + barcode
  - V2 (P0) : initiate cards retourne payment_url
  - V3 (P0) : Voucher TTL 7 jours

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
git commit -m "feat(sprint-11): payzone gateway (cards + cash kiosques)

Task: 3.4.5
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.5"
```

---

### Tache 6 / 14 : Mobile Wallets : Inwi Money + Orange Money + M-Wallet BAM

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.4.5

**But** : Integration 3 wallets mobile MA : **Inwi Money**, **Orange Money**, **M-Wallet BAM** (operateur Bank Al-Maghrib pour interop).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.6-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/gateways/inwi-money/inwi-money.gateway.ts`
- Service `repo/packages/pay/src/gateways/orange-money/orange-money.gateway.ts`
- Service `repo/packages/pay/src/gateways/mwallet-bam/mwallet-bam.gateway.ts`
- Pattern commun : initiate retourne QR code + USSD code (user scan/dial mobile)
- STK Push (SIM Toolkit) : provider envoi notification user mobile -> user confirme avec PIN
- Polling status (vs webhook) souvent : poll provider 30s interval jusqu'a confirme/expired

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/gateways/inwi-money/inwi-money.gateway.ts`
  - `repo/packages/pay/src/gateways/orange-money/orange-money.gateway.ts`
  - `repo/packages/pay/src/gateways/mwallet-bam/mwallet-bam.gateway.ts`
  - `repo/packages/pay/src/gateways/{wallet}/{wallet}.gateway.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 3 gateways implementent interface
  - V2 (P0) : QR code + USSD genere
  - V3 (P0) : Polling status fonctionne

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
git commit -m "feat(sprint-11): mobile wallets : inwi money + orange money + m-wallet bam

Task: 3.4.6
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.6"
```

---

### Tache 7 / 14 : PaymentOrchestrator + GatewaySelector

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.4.6

**But** : Service centralise routing paiement vers gateway optimal selon : tenant settings (providers actifs), montant, type produit, fallback policy.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.7-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/services/payment-orchestrator.service.ts`
- Service `repo/packages/pay/src/services/gateway-selector.service.ts`
- Method `initiatePayment(request, options): Promise<{ transactionId, redirectUrl, formData? }>` :
- GatewaySelector logique :
- Method `cancelPayment(transactionId)`
- Method `getTransactionStatus(transactionId)` (re-query provider si stale)

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/services/payment-orchestrator.service.ts`
  - `repo/packages/pay/src/services/gateway-selector.service.ts`
  - `repo/packages/pay/src/services/gateway-registry.service.ts`
  - `repo/packages/pay/src/services/{several}.service.spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Provider preferred utilise si dispo
  - V2 (P0) : Fallback sur next si premier unavailable
  - V3 (P0) : All gateways down -> 503

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
git commit -m "feat(sprint-11): paymentorchestrator + gatewayselector

Task: 3.4.7
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.7"
```

---

### Tache 8 / 14 : Webhooks Receivers (6 Providers) + Signature Verification

**Metadonnees** : P0 | 7h | Depend de : Depend de 3.4.7

**But** : 6 endpoints public recevant webhooks des providers + signature verification + idempotency + async processing.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.8-prompt.md
```

**Actions principales attendues** :
- 6 controllers : `repo/apps/api/src/modules/pay/webhooks/{provider}-webhook.controller.ts`
- Endpoints `POST /api/v1/public/webhooks/cmi` (et 5 autres providers)
- Pattern commun (extends Sprint 9 webhooks) :
- Consumer Kafka `pay-webhook-processor.consumer.ts` :
- Tests : 6 webhooks per provider + idempotency + downstream events

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/pay/webhooks/{6 controllers}.ts`
  - `repo/apps/api/src/modules/pay/middleware/{6 signatures}.ts`
  - `repo/apps/api/src/modules/pay/consumers/pay-webhook-processor.consumer.ts`
  - `repo/apps/api/test/pay/webhooks/{6 specs}.e2e-spec.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 6 webhooks endpoints fonctionnent
  - V2 (P0) : Signatures verifiees per provider
  - V3 (P0) : Idempotency : duplicate webhook ignore

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
git commit -m "feat(sprint-11): webhooks receivers (6 providers) + signature verification

Task: 3.4.8
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.8"
```

---

### Tache 9 / 14 : Refund Service (Partial + Full) avec Workflow Approval

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.4.8

**But** : Service refund full ou partiel avec workflow approval (admin requires pour montants > 1000 MAD).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.9-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/services/refund.service.ts`
- Methods :
- Migration : table `pay_refund_requests` (id, transaction_id, amount, reason, requested_by, status enum 'pending|approved|rejected|executed|failed', approved_by, approved_at, executed_at, provider_r...
- ABAC TimeBasedPolicy (Sprint 7) : refund autorise < 90 jours apres transaction
- Auto-approve pour amount <= 1000 MAD (limit configurable per tenant)
- Endpoints :

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/services/refund.service.ts`
  - `repo/packages/database/src/migrations/{date}-PayRefundRequests.ts`
  - `repo/packages/pay/src/entities/pay-refund-request.entity.ts`
  - `repo/apps/api/src/modules/pay/controllers/refund.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Request refund cree pending row
  - V2 (P0) : Auto-approve <= 1000 MAD
  - V3 (P0) : > 1000 MAD require approval admin

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
git commit -m "feat(sprint-11): refund service (partial + full) avec workflow approval

Task: 3.4.9
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.9"
```

---

### Tache 10 / 14 : Reconciliation Service (CSV Bank + Auto-Match)

**Metadonnees** : P0 | 6h | Depend de : Depend de 3.4.9

**But** : Service reconciliation : import CSV releve banque + match automatique avec transactions Skalean + report ecarts.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.10-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/services/reconciliation.service.ts`
- Methods :
- Migration : table `pay_reconciliation` deja Sprint 2 (rows import + status enum 'unmatched' | 'matched' | 'manual_match' | 'discrepancy')
- Endpoint `POST /api/v1/pay/reconciliation/import` (upload CSV)
- Endpoint `POST /api/v1/pay/reconciliation/auto-match`
- Endpoint `GET /api/v1/pay/reconciliation/discrepancies`

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/services/reconciliation.service.ts`
  - `repo/packages/pay/src/services/csv-parser.service.ts`
  - `repo/apps/api/src/modules/pay/controllers/reconciliation.controller.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Import CSV reussi
  - V2 (P0) : Auto-match identifie matched + unmatched + ambiguous
  - V3 (P0) : Manual match force assignation

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
git commit -m "feat(sprint-11): reconciliation service (csv bank + auto-match)

Task: 3.4.10
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.10"
```

---

### Tache 11 / 14 : Fraud Detection Rules Engine Basique

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.4.10

**But** : Rules engine simple detectant transactions suspectes : montant exceptionnel, velocity (3 cards meme IP en 5min), country mismatch, etc.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.11-prompt.md
```

**Actions principales attendues** :
- Service `repo/packages/pay/src/services/fraud-detection.service.ts`
- Method `evaluate(request): Promise<{ riskScore: number, flags: string[], action: 'allow' | 'review' | 'block' }>`
- Rules :
- Score 0-100 : > 80 block, 50-80 review (manual approval), < 50 allow
- Storage decisions : table `pay_fraud_evaluations` (audit trail)
- Block action : reject avant gateway call (eviter cost API)

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/services/fraud-detection.service.ts`
  - `repo/packages/pay/src/services/fraud-rules/{several}.rule.ts`
  - `repo/packages/database/src/migrations/{date}-PayFraudEvaluations.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Rules engine evalue transactions
  - V2 (P0) : Block action bloque avant gateway
  - V3 (P0) : Review action queue admin

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
git commit -m "feat(sprint-11): fraud detection rules engine basique

Task: 3.4.11
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.11"
```

---

### Tache 12 / 14 : BullMQ Retry Queues + DLQ + Idempotency

**Metadonnees** : P0 | 4h | Depend de : Depend de 3.4.11

**But** : Queues BullMQ pour async operations payment : poll status mobile wallets, retry capture, refund execution.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.12-prompt.md
```

**Actions principales attendues** :
- Queues :
- Workers correspondants
- DLQ via Kafka apres max retries
- Idempotency check : worker re-verify status DB avant action

**Fichiers cibles principaux** :
  - `repo/packages/pay/src/workers/{3 workers}.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Polling wallet works
  - V2 (P0) : Retry refund 3x avec backoff
  - V3 (P0) : DLQ apres 3 echecs

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
git commit -m "feat(sprint-11): bullmq retry queues + dlq + idempotency

Task: 3.4.12
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.12"
```

---

### Tache 13 / 14 : Endpoints REST + Integration Comm + Docs

**Metadonnees** : P0 | 5h | Depend de : Depend de 3.4.12

**But** : Controllers exposant API pay + integration cross-module avec Comm (notifications) + Docs (factures auto).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.13-prompt.md
```

**Actions principales attendues** :
- Controller `payments.controller.ts` :
- Controller `payment-stats.controller.ts` (revenue stats Sprint 13 enrichira)
- Integration via Kafka events :
- Permissions : `pay.transactions.create/read`, `pay.refunds.request/approve`
- Tests E2E

**Fichiers cibles principaux** :
  - `repo/apps/api/src/modules/pay/controllers/{several}.ts`
  - `repo/apps/api/src/modules/pay/consumers/pay-events-handlers.consumer.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : Endpoints CRUD operationnels
  - V2 (P0) : Capture event -> facture PDF auto generee
  - V3 (P0) : Capture event -> notification user

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
git commit -m "feat(sprint-11): endpoints rest + integration comm + docs

Task: 3.4.13
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.13"
```

---

### Tache 14 / 14 : Tests E2E Exhaustifs (50+) avec Sandboxes

**Metadonnees** : P0 | 10h | Depend de : Depend de 3.4.13

**But** : Suite tests E2E avec mock 6 providers + sandbox CMI integration reelle (test cards) + fixtures realistes.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-11-pay-ma-multi/task-3.4.14-prompt.md
```

**Actions principales attendues** :
- Per gateway (6 providers x 8 tests = 48) : initiate happy + decline + 3DS + webhook valid + webhook invalid + refund + cancel + idempotency
- Orchestrator routing : preferred provider + fallback + all unavailable
- Reconciliation : import CSV + auto-match + discrepancies
- Fraud detection : 5 rules trigger correct
- Cross-module : capture -> facture genere + email envoye
- CMI sandbox integration tests reels (test cards CMI)

**Fichiers cibles principaux** :
  - `repo/apps/api/test/pay/{50+ specs}.e2e-spec.ts`
  - `repo/apps/api/test/pay/fixtures/{several mocks}.ts`
  - `repo/infrastructure/scripts/seed-pay-test-data.ts`

**Criteres P0 cles** (verification automatique post-task) :
  - V1 (P0) : 50+ tests passent
  - V2 (P0) : Sandbox CMI integration reelle OK
  - V3 (P0) : Mocks 5 providers fonctionnent

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
git commit -m "feat(sprint-11): tests e2e exhaustifs (50+) avec sandboxes

Task: 3.4.14
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Decisions: see B-11 Tache 3.4.14"
```

---


## VERIFICATION DU SPRINT 11

Une fois les 14 taches terminees et commitees, **lancer la verification automatique** :

```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-11-sprint-11-verification.md
```

Le fichier de verification V-11 contient :

- **Criteres P0 bloquants** : compilation TypeScript / tests Vitest / Biome lint / no-emoji / conventional commits
- **Criteres P1 avertissements** : couverture >= 85% / dependencies coherentes / docs API / metriques performance
- **Criteres P2 notes** : coverage >= 90% modules critiques / lighthouse score / accessibility
- **Auto-reparation** pour criteres recuperables (e.g. relance tests flaky)
- **Generation automatique** du rapport `sprint11-verify-report.md`
- **Calcul score global** + statut GO / GO CONDITIONNEL / NO-GO

**Score minimum requis pour GO** : >= 95% (sprint termine, GO Sprint suivant)
**Score minimum pour GO CONDITIONNEL** : 85-94% (hot fix requis, retard <= 1 semaine)
**En dessous de 85%** : NO-GO, **reprise sprint requise** (escalation Saad/Abla decision)

Apres execution, lire le rapport :

```bash
cat skalean-insurtech/sprint11-verify-report.md
```

Si statut **GO** ou **GO CONDITIONNEL**, executer le commit de cloture :

```bash
git add skalean-insurtech/sprint11-verify-report.md
git commit -m "chore(sprint-11): close sprint 11 with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : 3 (Modules Horizontaux)
- Sprint : 11 (Phase 3 / Sprint 4)
- Apport : 6 passerelles MA integrees + reconciliation Books
- Tests E2E cumules : {N}+

Sprint 11 completed -- handoff to Sprint 12."
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 11]
   |
   v
[Tache 3.4.1: Entities pay_methods + pay_transactions + pay_reconcili]
   | -> compile -> tests -> commit
   v
[Tache 3.4.2: PaymentGatewayInterface + Base Abstract Gateway]
   | -> compile -> tests -> commit
   v
[Tache 3.4.3: CMI Gateway (Cards EMV + 3DS)]
   | -> compile -> tests -> commit
   v
[Tache 3.4.4: YouCan Pay Gateway (Cards Alternative)]
   | -> compile -> tests -> commit
   v
[Tache 3.4.5: PayZone Gateway (Cards + Cash Kiosques)]
   | -> compile -> tests -> commit
   v
[Tache 3.4.6: Mobile Wallets : Inwi Money + Orange Money + M-Wallet B]
   | -> compile -> tests -> commit
   v
[Tache 3.4.7: PaymentOrchestrator + GatewaySelector]
   | -> compile -> tests -> commit
   v
[Tache 3.4.8: Webhooks Receivers (6 Providers) + Signature Verificati]
   | -> compile -> tests -> commit
   v
[Tache 3.4.9: Refund Service (Partial + Full) avec Workflow Approval]
   | -> compile -> tests -> commit
   v
[Tache 3.4.10: Reconciliation Service (CSV Bank + Auto-Match)]
   | -> compile -> tests -> commit
   v
[Tache 3.4.11: Fraud Detection Rules Engine Basique]
   | -> compile -> tests -> commit
   v
[Tache 3.4.12: BullMQ Retry Queues + DLQ + Idempotency]
   | -> compile -> tests -> commit
   v
[Tache 3.4.13: Endpoints REST + Integration Comm + Docs]
   | -> compile -> tests -> commit
   v
[Tache 3.4.14: Tests E2E Exhaustifs (50+) avec Sandboxes]
   | -> compile -> tests -> commit
   v
[Verification automatique sprint 11 -- V-11]
   |
   v
[Rapport sprint11-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint suivant
[Score 85-94%] -> GO CONDITIONNEL -> hot fix puis cloture
[Score < 85%]  -> NO-GO -> reprise sprint
```

**Duree totale estimee** : 80 heures (5h par tache moyenne -- 2 devs FTE en parallele).

**Modules skalean-insurtech affectes** : @insurtech/crm, @insurtech/booking, @insurtech/comm, @insurtech/docs, @insurtech/signature, @insurtech/pay, @insurtech/books, @insurtech/compliance, @insurtech/analytics, @insurtech/stock, @insurtech/hr

**Apport metier principal** : 6 passerelles MA integrees + reconciliation Books.

**Prerequis Sprint 12** : Sprint 11 GO complet (score >= 95% verification automatique V-11).

**Sprint suivant** : Sprint 12.

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 10 (verification GO)

```bash
# Verifier Sprint 10 GO
ls skalean-insurtech/sprint10-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint10-verify-report.md
```

### Lancement Sprint 11 (Cowork lit cet orchestrateur)

```bash
# Cowork command (claude-code or cowork CLI) :
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-11-sprint-11-pay-ma-multi.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-11-sprint-11-pay-ma-multi.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-11-sprint-11-verification.md
```

### Suivi temps reel execution

```bash
# Tail le log Cowork
tail -f skalean-insurtech/cowork-sprint-11.log

# Verifier progression commits
git log --oneline --since="2 weeks ago" -- repo/ | grep "Sprint: 11"
```

### Apres completion -- verifier rapport

```bash
cat skalean-insurtech/sprint11-verify-report.md
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire d'abord B-11** complet avant generation prompts taches (contexte critique)
2. **Generer les 14 prompts taches** dans `00-pilotage/prompts-taches/sprint-11-*/` AVANT de commencer execution
3. **Toujours respecter l'ordre** des taches (dependances explicites)
4. **Commit chaque tache separement** (granularite Git pour rollback facile)
5. **NE JAMAIS modifier `00-pilotage/`** -- uniquement `repo/`
6. **En cas de doute**, escalader Saad/Abla via Slack `#insurtech-dev` plutot que faire choix arbitraire
7. **Documentation continue** : si tu prends une decision technique, ajouter ADR dans `repo/docs/architecture/`

---

**Fin de l'orchestrateur C-11 v2.2 detaille -- Sprint 11 (3.4) Pay Multi-Passerelles MA (6 gateways).**

**Total taches detaillees** : 14 | **Effort cumul** : ~80h | **Apport** : 6 passerelles MA integrees + reconciliation Books
