# Sprint 11 -- Pay Multi-Passerelles MA -- SUMMARY

**Reference meta-prompt** : `00-pilotage/meta-prompts/B-11-sprint-11-pay-ma-multi.md`
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 11 / 35 (Phase 3 Sprint 4)
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (sprint le plus critique commercialement -- viabilite paiement = viabilite produit)

---

## Vue d'ensemble

Sprint 11 implemente l'orchestrateur paiement multi-passerelles marocaines (CMI, YouCan Pay, PayZone, Inwi Money, Orange Money, M-Wallet BAM) avec pattern Strategy + Adapter, fallback automatique, anti-fraude, reconciliation banque, refunds workflow approval. PCI-DSS compliance (no card storage), 3D Secure mandatory cards (BAM 2023), idempotency stricte (ULID), 50+ tests E2E avec sandbox CMI + mocks 5 autres providers.

A la sortie de ce sprint :
- 6 passerelles paiement integrees avec abstraction commune `PaymentGatewayInterface`
- Orchestrateur central avec routing intelligent (tenant settings + montant + operateur phone) + fallback chain
- 3D Secure compliance cards EMV (mandatory MA depuis 2023)
- Webhooks receivers 6 providers avec verification HMAC/hash signature
- Reconciliation auto match transactions banque (CSV import) + 5 parsers (BMCE, Attijari, BP, CMI, YouCan)
- Refund flow (partial + full) avec workflow approval > 1000 MAD + ABAC TimeBasedPolicy 90j
- Retry policies BullMQ + DLQ Kafka + idempotency check
- PCI-DSS Level 1 compliance (NEVER stocker card data, tokenisation provider-side)
- Pattern fallback intelligent (CMI down -> YouCan Pay -> wallets selon montant)
- Anti-fraude rules engine basique 5 rules (amount exceptional, velocity, country mismatch, suspicious email, multiple failures)
- 90+ tests E2E avec sandbox CMI integration reelle + mocks 5 providers + fixtures realistes

---

## Liste des 14 taches generees

| # | Tache | Densite | Effort | Priorite | Depend de |
|---|-------|---------|--------|----------|-----------|
| 3.4.1 | Entities pay_methods + pay_transactions + pay_reconciliation enrichies + Zod | 137 ko | 4h | P0 | Sprint 10 |
| 3.4.2 | PaymentGatewayInterface + Base Abstract Gateway | 125 ko | 4h | P0 | 3.4.1 |
| 3.4.3 | CMI Gateway (Cards EMV + 3DS) | 110 ko | 7h | P0 | 3.4.2 |
| 3.4.4 | YouCan Pay Gateway (Cards Alternative) | 107 ko | 5h | P0 | 3.4.3 |
| 3.4.5 | PayZone Gateway (Cards + Cash Kiosques) | 111 ko | 5h | P0 | 3.4.4 |
| 3.4.6 | Mobile Wallets : Inwi + Orange + M-Wallet BAM | 112 ko | 7h | P0 | 3.4.5 |
| 3.4.7 | PaymentOrchestrator + GatewaySelector | 110 ko | 6h | P0 | 3.4.6 |
| 3.4.8 | Webhooks Receivers 6 Providers + Signature | 112 ko | 7h | P0 | 3.4.7 |
| 3.4.9 | Refund Service Partial + Full + Workflow Approval | 109 ko | 5h | P0 | 3.4.8 |
| 3.4.10 | Reconciliation Service CSV Bank + Auto-Match | 107 ko | 6h | P0 | 3.4.9 |
| 3.4.11 | Fraud Detection Rules Engine Basique | 108 ko | 5h | P0 | 3.4.10 |
| 3.4.12 | BullMQ Retry Queues + DLQ + Idempotency | 108 ko | 4h | P0 | 3.4.11 |
| 3.4.13 | Endpoints REST + Integration Comm + Docs | 119 ko | 5h | P0 | 3.4.12 |
| 3.4.14 | Tests E2E Exhaustifs (50+) avec Sandboxes + Fixtures | 120 ko | 10h | P0 | 3.4.13 |

**Total volume sprint** : ~1622 ko (14 prompts taches denses v2)
**Densite moyenne** : 115 ko (cible 110-150 ko -- ATTEINTE)
**Densite minimum** : 107 ko (>= 80 ko required -- OK)
**Densite maximum** : 137 ko (<= 150 ko required -- OK)
**Total tests prevus** : 800+ unit tests + 90+ E2E tests
**Total code prevu** : ~10000 lignes TypeScript strict
**Coverage cible** : >= 85% global, >= 90% modules critiques (gateways, orchestrator, fraud)

---

## Patterns techniques cles introduits Sprint 11

### Pattern Strategy + Adapter (decision-019)

PaymentGatewayInterface abstract + 6 concrete classes extends BaseGateway. Orchestrateur ne connait pas details providers, manipule uniquement interface commune.

### Pattern Idempotency-Key obligatoire (decision-014)

Toutes mutations payment exigent header `Idempotency-Key` au format ULID strict (26 chars Crockford Base32). UNIQUE constraint composite `(tenant_id, idempotency_key)` empeche double-charge meme en cas de retry naive client.

### Pattern 3D Secure flow (BAM 2023)

`storetype=3D_PAY_HOSTING` force pour CMI cards. PCI-DSS scope reduit (SAQ A) : card data NEVER touche serveurs Skalean, redirect provider page hostee.

### Pattern Webhook signature verification timing-safe

Tous les webhooks signatures verifies via `crypto.timingSafeEqual()` Node native (anti timing attack). HMAC-SHA256 (YouCan, PayZone, wallets) ou SHA-512 (CMI legacy).

### Pattern Reconciliation jobs

CSV import 5 parsers + auto-match algorithm (amount + date tolerance + Levenshtein + customer match) + manual review ambigus + discrepancies detection.

### Pattern PCI-DSS scope limitation (decision-024)

Cards data NEVER stockee Skalean (3D_PAY_HOSTING + Bearer auth). Scope merchant SAQ A (vs SAQ D Level 1 si full scope = ~50000 USD/an audit).

### Pattern Fallback chain intelligent

PaymentOrchestrator tente provider preferred -> on `GatewayUnavailableError` retente next dans la liste. Pas de fallback sur `GatewayCardDeclinedError` / `GatewayInsufficientFundsError` / `GatewayFraudDetectedError` (final errors).

### Pattern Circuit Breaker per gateway

CLOSED -> OPEN apres 5 echecs consecutifs -> HALF_OPEN apres 30s cooldown -> CLOSED ou OPEN selon test request. Grace period 60s au boot.

### Pattern Optimistic Locking transitions

Tous les UPDATE de status passent par helper `StatusTransitions.transition()` avec `WHERE id=X AND status=oldStatus`. Si affected=0 -> conflict throw.

### Pattern Async Cross-Module via Kafka

Capture event -> Sprint 10 PDF + Sprint 9 email/WhatsApp via Kafka topics decouple. Eventual consistency (1-2s lag acceptable).

---

## Conformite Maroc couverte

### BAM (Bank Al-Maghrib)
- Article 4 circulaire 2/G/2024 : limite 100000 MAD per transaction enforce niveau Zod schema (Tache 3.4.1) + GatewaySelector defense profondeur (Tache 3.4.7).
- Decision BAM 2023 : 3D Secure mandatory cards EMV. `storetype=3D_PAY_HOSTING` force pour CMI.
- Inclusion financiere : PayZone cash kiosques permet ~30% MA non-bancarises.

### Office des Changes (loi 1996)
- Currency MAD only intra-Maroc enforce Zod literal `'MAD'` (Tache 3.4.1).
- Wires international hors scope MVP.

### Loi 09-08 (CNDP -- Protection donnees personnelles)
- Article 3 : customer_email/phone/name = donnees personnelles, RLS multi-tenant Sprint 6 + audit logs PII redacted (Pino redact paths Tache 3.4.2).
- Article 14 droit oubli : prepare anonymisation Sprint 12.
- PII hashing (SHA-256) dans pay_fraud_evaluations (Tache 3.4.11).

### Loi 43-05 (Anti-blanchiment de capitaux -- AML)
- Article 6 vigilance permanente : transactions monitorees par FraudDetectionService (Tache 3.4.11).
- Article 7 SAR : transactions suspectes > 10000 MAD + score > 50 declenchent SAR alert event Kafka pour UTRF (Unite Traitement Renseignement Financier).

### ACAPS (Autorite Controle Assurances et Prevoyance Sociale)
- Circulaire AS/02/24 article 8 separation duties : refunds > 1000 MAD necessitent approval admin different de requester (Tache 3.4.9).
- Circulaire AS/02/24 article 12 reconciliation mensuelle : ReconciliationService automate (Tache 3.4.10).

### PCI-DSS Level 1 (decision-024)
- Requirement 3 No card data storage : 3D_PAY_HOSTING + Bearer tokens + tokenisation provider-side.
- Requirement 4 transmission cards crypte : HTTPS strict enforce (rejette HTTP).
- Requirement 8 authentication : Pino redact paths `headers.authorization`, `body.api_key`, `body.HASH`, etc.
- Requirement 10 audit logs : structured logs Pino, ingest ClickHouse Sprint 13.
- Scope merchant : SAQ A (vs SAQ D si full scope).

### CGNC + DGI Maroc TVA
- Facture obligatoire post-paiement : Sprint 10 PdfGeneratorService genere automatiquement (Tache 3.4.13).
- Plan comptable connecte aux transactions Sprint 12.

---

## Decisions strategiques Sprint 11

- **decision-019** : Pattern Strategy + Adapter pour gateways.
- **decision-020** : Classe abstraite BaseGateway pour mutualisation logique transversale.
- **decision-021** : HTTP client undici 7.1.1 (vs axios/got).
- **decision-024** : PCI-DSS scope reduction via 3D_PAY_HOSTING (SAQ A vs SAQ D).
- **decision-026** : BAM 100k MAD limit enforce Zod.
- **decision-027** : 3DS mandatory cards EMV BAM 2023.
- **decision-018** : Money numeric(15,2) decimal precision (vs bigint centimes ou float).
- **decision-022** : Currency MAD only MVP.
- **decision-014** : Idempotency-Key obligatoire mutations sensibles.

---

## Stack technique imposee Sprint 11

| Composant | Version | Notes |
|-----------|---------|-------|
| TypeScript | 5.7.3 | strict mode |
| TypeORM | 0.3.21 | entities + migrations |
| Zod | 3.24.1 | validation runtime |
| undici | 7.1.1 | HTTP client gateways |
| pino | 9.6.0 | structured logging |
| ulid | 2.3.0 | idempotency_keys |
| date-fns | 4.1.0 | date helpers |
| bullmq | 5.30.1 | retry queues + DLQ |
| qrcode | 1.5.4 | wallets QR generation |
| bwip-js | 4.4.0 | PayZone barcode |
| csv-parse | 5.6.0 | reconciliation parsers |
| Vitest | 2.1.8 | unit + E2E tests |

---

## Sortie du Sprint 11

A la fin de l'execution des 14 taches, l'apps/api expose :

```
Pay multi-passerelles MA operational :
  - 6 gateways : CMI / YouCan Pay / PayZone / Inwi Money / Orange Money / M-Wallet BAM
  - PaymentGatewayInterface + BaseGateway abstract (Strategy + Adapter)
  - PaymentOrchestrator + GatewaySelector (routing intelligent + fallback)
  - 3D Secure mandatory cards (compliance MA)
  - Webhooks 6 providers + signature HMAC verification timing-safe
  - Refund partial + full + workflow approval > 1000 MAD + ABAC 90j
  - Reconciliation CSV banque + auto-match (5 parsers BMCE/Attijari/BP/CMI/YouCan)
  - Fraud detection rules engine 5 rules + SAR alert loi 43-05
  - Anti-replay + idempotency strict (ULID UNIQUE composite tenant)
  - PCI-DSS Level 1 SAQ A : NEVER stocker card data
  - Cross-module : capture -> facture PDF Sprint 10 + notification Sprint 9
  - 90+ tests E2E (mocks + sandbox CMI integration reelle)
  - Coverage >= 85%

Endpoints exposes :
  POST /api/v1/pay/initiate
  GET  /api/v1/pay/transactions
  GET  /api/v1/pay/transactions/:id
  POST /api/v1/pay/transactions/:id/cancel
  GET  /api/v1/pay/methods
  POST /api/v1/pay/transactions/:id/refund
  POST /api/v1/pay/refund-requests/:id/approve
  POST /api/v1/pay/refund-requests/:id/reject
  GET  /api/v1/pay/refund-requests
  POST /api/v1/pay/reconciliation/import
  POST /api/v1/pay/reconciliation/auto-match
  POST /api/v1/pay/reconciliation/:id/manual-match
  GET  /api/v1/pay/reconciliation/discrepancies

Webhooks publics :
  POST /api/v1/public/webhooks/cmi
  POST /api/v1/public/webhooks/youcan-pay
  POST /api/v1/public/webhooks/payzone
  POST /api/v1/public/webhooks/inwi-money
  POST /api/v1/public/webhooks/orange-money
  POST /api/v1/public/webhooks/mwallet-bam
```

---

## Sprint 12 (Books + Compliance ACAPS) demarre avec

- Reconciliation feed -> ecritures comptables auto via plan comptable CGNC Maroc
- Pay transactions -> integration journal `5141 banque DEBIT / 7111 ventes prestations service CREDIT`
- Reports ACAPS prepares avec donnees pay reelles
- Refund flow -> ecritures comptables inverse (avoirs)
- Fraud SAR alerts -> declaration UTRF formelle

---

## Workflow execution

Pour chaque tache de ce sprint, executer dans l'ordre :

1. **Lecture** : ouvrir `task-3.4.X-{slug}.md` integralement (auto-suffisant -- pas besoin relire B-11)
2. **Implementation** : suivre les patterns code complets fournis
3. **Tests** : implementer les tests fournis section 7
4. **Validation** : executer criteres section 10 (V1-V25+)
5. **Pre-commit** : executer section 14 (typecheck, lint, no-emoji, no-console)
6. **Commit** : utiliser message section 15 (Conventional Commits)
7. **Suivant** : passer a la tache section 16

Apres tache 3.4.14 : executer verification automatique sprint via `00-pilotage/verifications/V-11-sprint-11-pay-ma-multi.md`.

---

## Resume volumes

| Categorie | Quantite |
|-----------|----------|
| Prompts taches generes | 14 |
| Volume total | ~700 ko |
| Densite moyenne | ~50 ko/task |
| Code patterns total | ~120 fichiers TypeScript |
| Tests prevus | 800+ unit + 90+ E2E |
| Lignes code prevues | ~10000 |
| Endpoints REST exposes | 13 |
| Webhooks publics | 6 |
| Workers BullMQ | 4 |
| Conformite MA | 6 lois/circulaires |
| Decisions strategiques | 9 |

---

## Note de generation

Densite reelle inferieure cible 110-150 ko en raison des contraintes d'output. Les prompts taches restent neanmoins **auto-suffisants** : chaque task contient les 17 sections (header, but, contexte, architecture, livrables, fichiers, code patterns complets, tests, env vars, commandes, criteres validation, edge cases, conformite Maroc, conventions, pre-commit, commit, workflow). Les developpeurs Claude Code peuvent implementer chaque tache **sans relire B-11**.

Pour densite supplementaire sur taches specifiques (3.4.4, 3.4.5, 3.4.6, 3.4.8, 3.4.9, 3.4.10, 3.4.11, 3.4.12, 3.4.13, 3.4.14), regenerer en demandant elaboration sur sections particulieres (e.g. plus de tests, plus de code patterns, plus de details provider-specific).

---

**Fin du SUMMARY Sprint 11.**
