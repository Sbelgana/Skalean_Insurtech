# META-PROMPT B-11 -- SPRINT 11 PAY MULTI-PASSERELLES MA

**Version** : v2.2 (Option B)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 11 / 35 (cumul) -- Phase 3 Sprint 4
**Position** : Apres Docs+Signature, avant Books+Compliance
**Numerotation taches** : 3.4.1 a 3.4.14
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (sprint le plus critique commercialement -- viabilite paiement = viabilite produit)

---

## Objectif Global du Sprint

Implementer **orchestrateur paiement multi-passerelles marocaines** : CMI (cards), YouCan Pay (cards alternative), PayZone (cards + cash kiosques), Inwi Money + Orange Money + M-Wallet BAM (mobile wallets). Pattern Strategy + Adapter avec fallback automatique, anti-fraude, reconciliation banque, refunds.

A la sortie de ce sprint :
- 6 passerelles paiement integrees avec abstraction commune `PaymentGatewayInterface`
- Orchestrateur central : routing intelligent par tenant settings + montant + type produit
- 3D Secure compliance (cards EMV) -- mandatory MA depuis 2023
- Webhook receivers per provider avec verification HMAC
- Reconciliation auto match transactions banque (CSV import)
- Refund flow (partial + full) avec workflow approval
- Retry policies + DLQ
- PCI-DSS compliance : NEVER stocker card data, tokenisation provider-side
- Pattern fallback : si CMI down, retry YouCan Pay
- Anti-fraude basique : rules engine (montant suspect, velocity, IP risk)
- 50+ tests E2E avec sandboxes 6 providers + fixtures realistes

---

## Frontiere du Sprint

**INCLUS** :
- 6 gateway clients : CMI / YouCan Pay / PayZone / Inwi Money / Orange Money / M-Wallet BAM
- PaymentGatewayInterface + base abstract class
- PaymentOrchestrator + GatewaySelector (routing)
- PCI-DSS compliance (no card storage)
- 3D Secure flow (cards EMV)
- Webhooks receivers (6 providers)
- Refund (full + partial)
- Reconciliation manuelle CSV bank statement
- Fraud detection rules engine basique
- Anti-replay + idempotency
- Tests E2E exhaustifs + sandbox CMI

**EXCLU** (sera ajoute aux sprints suivants) :
- Reconciliation auto banking API (Phase 7+ partenariat banques)
- Recurring payments (Phase 7+ pour primes mensuelles)
- Subscription billing (Phase 7+ SaaS pricing)
- IA-powered fraud detection (Sprint 30+ defere)
- Crypto payments (jamais MVP -- pas legal MA)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regle M7 multi-passerelles
2. `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` -- tables pay_*
3. `00-pilotage/documentation/2-variables-environnement.env` -- catalog providers env vars
4. `00-pilotage/documentation/4-templates-generation.md` -- pattern 8 (gateway clients)
5. Sortie Sprint 9 : Comm orchestrator pour notifications paiement
6. Sortie Sprint 10 : Docs pour generation factures

---

## Stack Imposee (Sprint 11)

| Composant | Version | Notes |
|-----------|---------|-------|
| undici | 7.1.1 | HTTP client gateway providers |
| crypto Node | native | HMAC webhook signature, 3DS data |
| zod | 3.24.1 | validation requests/webhooks |
| ulid | 2.3.0 | idempotency_keys |
| date-fns | 4.1.0 | retry/timeout management |
| bullmq | 5.30.1 | retry queues + DLQ |

Variables env : `CMI_MERCHANT_ID/STORE_KEY/CLIENT_ID`, `YOUCAN_PAY_PUBLIC_KEY/PRIVATE_KEY/WEBHOOK_SECRET`, `PAYZONE_API_KEY/MERCHANT_ID`, `INWI_MONEY_*`, `ORANGE_MONEY_*`, `MWALLET_BAM_*`.

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 3.4.1 | Entities pay_methods + pay_transactions + pay_reconciliation enrichies + Zod | 4h | P0 | Sprint 10 |
| 3.4.2 | PaymentGatewayInterface + base abstract gateway | 4h | P0 | 3.4.1 |
| 3.4.3 | CMI Gateway (cards EMV + 3DS) | 7h | P0 | 3.4.2 |
| 3.4.4 | YouCan Pay Gateway (cards alternative) | 5h | P0 | 3.4.3 |
| 3.4.5 | PayZone Gateway (cards + cash kiosques) | 5h | P0 | 3.4.4 |
| 3.4.6 | Inwi Money + Orange Money + M-Wallet BAM Gateways (mobile wallets) | 7h | P0 | 3.4.5 |
| 3.4.7 | PaymentOrchestrator + GatewaySelector (routing par tenant settings) | 6h | P0 | 3.4.6 |
| 3.4.8 | Webhooks receivers (6 providers) + signature verification | 7h | P0 | 3.4.7 |
| 3.4.9 | Refund service (partial + full) avec workflow approval | 5h | P0 | 3.4.8 |
| 3.4.10 | Reconciliation service (CSV bank statement import + auto-match) | 6h | P0 | 3.4.9 |
| 3.4.11 | Fraud detection rules engine basique | 5h | P0 | 3.4.10 |
| 3.4.12 | BullMQ retry queues + DLQ + idempotency | 4h | P0 | 3.4.11 |
| 3.4.13 | Endpoints REST `/api/v1/pay/*` + integration Comm + Docs | 5h | P0 | 3.4.12 |
| 3.4.14 | Tests E2E (50+) avec sandboxes 6 providers + fixtures realistes | 10h | P0 | 3.4.13 |

**Total** : 80 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 3.4.1 -- Entities pay_methods + pay_transactions + pay_reconciliation

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 4h / Depend de Sprint 10

**But** : Enrichir entities pay_* (Sprint 2 deja migration) avec types TypeScript + schemas Zod CRUD + helpers.

**Livrables checkables** :
- [ ] Entity `repo/packages/pay/src/entities/pay-method.entity.ts` (mode paiement configure par tenant)
- [ ] Entity `repo/packages/pay/src/entities/pay-transaction.entity.ts` (transactions individuelles)
- [ ] Entity `repo/packages/pay/src/entities/pay-reconciliation.entity.ts` (reconciliation banque)
- [ ] Enums :
  - `PaymentProvider` : `'cmi' | 'youcan_pay' | 'payzone' | 'inwi_money' | 'orange_money' | 'mwallet_bam'`
  - `PaymentMethod` : `'card' | 'wallet' | 'cash_kiosk' | 'bank_transfer'`
  - `TransactionStatus` : `'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled'`
  - `Currency` : `'MAD'` (only MVP)
- [ ] Schemas Zod :
  - `InitiatePaymentSchema` : amount + currency + customer_email + customer_phone + return_url + metadata
  - `RefundRequestSchema` : transaction_id + amount (full ou partial) + reason
  - `ReconciliationRowSchema` : CSV row format banque
- [ ] Validators MA : amount montant max 100000 MAD per transaction (BAM regulation), currency MAD only
- [ ] Champ `provider_transaction_id` UNIQUE per provider (anti-duplicate)
- [ ] Champ `idempotency_key` (ULID) UNIQUE pour eviter double charge
- [ ] Tests : entity hydrate + Zod reject invalid + helpers

**Pattern critique : table pay_transactions champs critiques**

```sql
CREATE TABLE pay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth_tenants(id),

  -- Reference business
  related_resource_type text,                       -- 'invoice', 'police', 'devis'
  related_resource_id uuid,
  customer_email citext NOT NULL,
  customer_phone text,

  -- Money (DECIMAL pas FLOAT pour precision)
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'MAD',
  fees_amount numeric(15, 2) DEFAULT 0,                -- frais provider

  -- Provider
  provider text NOT NULL,
  provider_method text NOT NULL,
  provider_transaction_id text,
  provider_reference text,

  -- Status workflow
  status text NOT NULL DEFAULT 'pending',
  authorization_code text,
  failure_reason text,

  -- 3DS
  three_d_secure_enabled boolean DEFAULT false,
  three_d_secure_status text,

  -- Idempotency + tracking
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb,

  -- Timestamps
  initiated_at timestamptz NOT NULL DEFAULT NOW(),
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,

  created_by uuid REFERENCES auth_users(id),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_pay_transactions_tenant_status ON pay_transactions(tenant_id, status, initiated_at DESC);
CREATE INDEX idx_pay_transactions_resource ON pay_transactions(tenant_id, related_resource_type, related_resource_id);
CREATE UNIQUE INDEX idx_pay_provider_txn ON pay_transactions(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
```

**Fichiers crees / modifies** :
```
repo/packages/pay/src/entities/pay-method.entity.ts                       # ~50 lignes
repo/packages/pay/src/entities/pay-transaction.entity.ts                   # ~80 lignes
repo/packages/pay/src/entities/pay-reconciliation.entity.ts                # ~50 lignes
repo/packages/pay/src/schemas/payment.schema.ts                            # ~80 lignes
repo/packages/pay/src/schemas/refund.schema.ts                             # ~30 lignes
repo/packages/pay/src/schemas/reconciliation.schema.ts                     # ~40 lignes
repo/packages/pay/src/types/{enums}.ts                                     # ~30 lignes
```

**Notes implementation** :
- Numeric(15,2) precision : critical money (jamais float)
- BAM regulation : limite 100k MAD per transaction sans declaration BAM (+gros = wire transfer special)
- Idempotency_key : ULID + UNIQUE constraint = double-charge impossible
- provider_transaction_id UNIQUE : anti-duplicate webhook processing
- Status workflow strict : transitions validees service Tache 3.4.7

**Criteres validation** :
- V1 (P0) : Entities hydrate
- V2 (P0) : Amount > 100000 MAD rejete (BAM rule)
- V3 (P0) : Currency != MAD rejete
- V4 (P0) : Idempotency key UNIQUE
- V5 (P0) : Schemas Zod tests reject invalid
- V6 (P1) : Tests 6+ scenarios

---

## Tache 3.4.2 -- PaymentGatewayInterface + Base Abstract Gateway

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 4h / Depend de 3.4.1

**But** : Definir interface commune `PaymentGatewayInterface` + classe abstraite `BaseGateway` partageant logique commune (HTTP client, retry, logging, errors).

**Contexte** : Strategy + Adapter pattern -- chaque gateway provider implemente interface commune. PaymentOrchestrator (Tache 3.4.7) ne connait pas details specifiques providers, juste interface.

**Livrables checkables** :
- [ ] Interface `repo/packages/pay/src/interfaces/payment-gateway.interface.ts` :
  - `initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>` -- retourne provider_transaction_id + redirect_url ou form_data
  - `getStatus(providerTransactionId): Promise<PaymentStatus>`
  - `capture(providerTransactionId, amount?): Promise<CaptureResult>` -- pour cards 2-step (auth + capture)
  - `refund(providerTransactionId, amount, reason): Promise<RefundResult>` -- partial ou full
  - `cancel(providerTransactionId): Promise<void>` -- avant capture
  - `verifyWebhookSignature(rawBody, signature): boolean`
- [ ] Abstract class `repo/packages/pay/src/gateways/base-gateway.ts` :
  - HTTP client undici instance with retry/timeout
  - Logger Pino injected
  - Common methods : `signRequest()`, `verifyResponse()`, `normalizeError()`
  - Abstract members force implementation : `provider`, `baseUrl`, `apiKey`
- [ ] Types : `InitiatePaymentRequest`, `InitiatePaymentResult`, `PaymentStatus`, `CaptureResult`, `RefundResult`
- [ ] Errors typed : `GatewayUnavailableError`, `GatewayInvalidRequestError`, `GatewayInsufficientFundsError`, `GatewayCardDeclinedError`, `GatewayFraudDetectedError`
- [ ] Tests : interface compile + base class HTTP retry works

**Pattern critique : interface PaymentGateway**

```typescript
// repo/packages/pay/src/interfaces/payment-gateway.interface.ts
export interface InitiatePaymentRequest {
  amount: number;                    // en MAD (decimal 15,2)
  currency: 'MAD';
  idempotencyKey: string;            // ULID
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  description?: string;
  returnUrl: string;                 // post-payment redirect
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  providerTransactionId: string;
  redirectUrl?: string;              // page provider where user pays (cards + 3DS)
  formData?: Record<string, string>; // alternative : POST form to provider URL
  qrCode?: string;                    // pour mobile wallets
  metadata: Record<string, unknown>;
}

export interface PaymentStatus {
  providerTransactionId: string;
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded';
  amount: number;
  authorizationCode?: string;
  failureReason?: string;
  threeDSecureStatus?: 'authenticated' | 'not_authenticated' | 'attempted' | 'unavailable';
  capturedAt?: Date;
  rawProviderResponse: Record<string, unknown>;  // pour audit
}

export interface PaymentGatewayInterface {
  readonly provider: string;
  initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;
  getStatus(providerTransactionId: string): Promise<PaymentStatus>;
  capture?(providerTransactionId: string, amount?: number): Promise<{ captured: boolean }>;
  refund(providerTransactionId: string, amount: number, reason: string): Promise<RefundResult>;
  cancel(providerTransactionId: string): Promise<void>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
```

**Fichiers crees / modifies** :
```
repo/packages/pay/src/interfaces/payment-gateway.interface.ts             # ~100 lignes
repo/packages/pay/src/gateways/base-gateway.ts                             # ~150 lignes (HTTP + retry + logging)
repo/packages/pay/src/types/gateway-results.ts                              # ~80 lignes
repo/packages/pay/src/errors/gateway-errors.ts                              # ~60 lignes (5 error classes)
```

**Criteres validation** :
- V1 (P0) : Interface declare 6+ methods
- V2 (P0) : Base class HTTP retry sur 5xx
- V3 (P0) : Errors typed correctement
- V4 (P0) : Compile TypeScript strict
- V5 (P1) : Tests base class 4+ scenarios

---

## Tache 3.4.3 -- CMI Gateway (Cards EMV + 3DS)

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 7h / Depend de 3.4.2

**But** : Integration **CMI** (Centre Monetique Interbancaire MA) -- principale passerelle cards EMV au Maroc, infrastructure officielle utilisees par 90% banques. 3D Secure mandatory.

**Contexte** : CMI = solution standard banques marocaines (BMCE, Attijariwafa, Banque Populaire, etc.). API redirect-based : merchant redirige user vers page CMI 3DS, post-payment retour sur returnUrl avec status. Documentation : portail merchant CMI.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/gateways/cmi/cmi.gateway.ts` extends BaseGateway implements PaymentGatewayInterface
- [ ] `initiate()` : construit form data with HMAC signature -> retourne URL CMI 3DS + form_data
- [ ] `getStatus()` : query CMI status API (post-redirect)
- [ ] `refund()` : POST refund API
- [ ] `verifyWebhookSignature()` : verify hash retour CMI matches expected (HMAC-SHA512)
- [ ] Variables env : `CMI_MERCHANT_ID`, `CMI_STORE_KEY` (secret hash), `CMI_CLIENT_ID`, `CMI_BASE_URL` (sandbox vs prod)
- [ ] 3DS flow : `Authentication-Type: 1` (3DS mandatory)
- [ ] Currency code : `504` (MAD ISO 4217 numeric)
- [ ] Hash computation : SHA-512 sur concat fields (specifique CMI documentation)
- [ ] Card data : NEVER stocke notre cote -- redirect form vers CMI
- [ ] Mock client `MockCmiGateway` pour tests
- [ ] Tests : initiate happy + 3DS auth + decline + refund

**Pattern critique : CMI form data + hash**

```typescript
// repo/packages/pay/src/gateways/cmi/cmi.gateway.ts
async initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
  // CMI exige form POST vers leur URL avec hash signature
  const formData: Record<string, string> = {
    clientid: env.CMI_CLIENT_ID,
    storekey: '',  // hash inclut storekey mais pas dans form
    storetype: '3D_PAY_HOSTING',
    TranType: 'Auth',           // 1-step authorization
    amount: request.amount.toFixed(2),
    currency: '504',             // MAD ISO numeric
    oid: request.idempotencyKey, // order id = our idempotency key
    okUrl: request.returnUrl,
    failUrl: request.cancelUrl,
    callbackUrl: `${env.API_BASE_URL}/api/v1/public/webhooks/cmi`,
    lang: 'fr',
    rnd: ulid(),                  // random nonce
    email: request.customerEmail,
    BillToName: request.customerName ?? '',
    encoding: 'utf-8',
  };

  // Hash CMI : SHA-512 sur concat fields specific order
  const hashFields = [
    formData.clientid, formData.oid, formData.amount, formData.okUrl,
    formData.failUrl, formData.TranType, formData.rnd, env.CMI_STORE_KEY,
  ].join('|');
  formData.HASH = createHash('sha512').update(hashFields).digest('base64');

  return {
    providerTransactionId: formData.oid,
    redirectUrl: env.CMI_BASE_URL + '/fim/est3Dgate', // form POST URL
    formData,
    metadata: { hash_method: 'sha512', three_d_secure: true },
  };
}
```

**Fichiers crees / modifies** :
```
repo/packages/pay/src/gateways/cmi/cmi.gateway.ts                          # ~300 lignes
repo/packages/pay/src/gateways/cmi/cmi.gateway.spec.ts                     # ~250 lignes
repo/packages/pay/src/gateways/cmi/cmi-types.ts                             # types CMI specific
repo/packages/pay/src/gateways/cmi/cmi-error-mapping.ts                     # CMI error codes -> normalized
repo/packages/pay/src/gateways/cmi/mock-cmi.gateway.ts                       # mock for tests
```

**Notes implementation** :
- Form POST (vs JSON API) : CMI legacy approach -- frontend genere `<form action="...CMI..." method="POST">` avec input hidden
- 3DS hosting : user redirige vers page CMI (UI bancaire) -- nous ne touchons pas card data (PCI-DSS scope reduit)
- Hash SHA-512 : signature anti-tampering form data
- Sandbox : `https://testpayten.cmi.co.ma` -- prod `https://payten.cmi.co.ma`
- Webhook callback : CMI POST a notre callbackUrl post-payment (Tache 3.4.8)

**Criteres validation** :
- V1 (P0) : initiate retourne formData + hash
- V2 (P0) : Hash SHA-512 correctement calcule
- V3 (P0) : 3DS enabled (storetype 3D_PAY_HOSTING)
- V4 (P0) : Currency 504 (MAD)
- V5 (P0) : webhook signature verification
- V6 (P0) : Tests 12+ scenarios mock
- V7 (P0) : Card data NEVER in our scope (verifie via tests)

---

## Tache 3.4.4 -- YouCan Pay Gateway (Cards Alternative)

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 5h / Depend de 3.4.3

**But** : Integration **YouCan Pay** (startup MA fintech, alternative legere a CMI). API REST moderne JSON. Cards 3DS supportees.

**Contexte** : YouCan Pay = alternative emergente, plus simple integration que CMI, fees plus competitives. Fallback ideal si CMI indisponible. Public API documentee : `https://api.youcanpay.com`.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.ts`
- [ ] `initiate()` : POST `/transactions` JSON -> retourne `payment_url` + token
- [ ] `getStatus()` : GET `/transactions/:token`
- [ ] `refund()` : POST `/refunds`
- [ ] `verifyWebhookSignature()` : HMAC-SHA256 verification (env `YOUCAN_PAY_WEBHOOK_SECRET`)
- [ ] Variables env : `YOUCAN_PAY_PUBLIC_KEY`, `YOUCAN_PAY_PRIVATE_KEY`, `YOUCAN_PAY_WEBHOOK_SECRET`, `YOUCAN_PAY_BASE_URL`
- [ ] Mock client + tests

**Fichiers crees / modifies** :
```
repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.ts            # ~200 lignes
repo/packages/pay/src/gateways/youcan-pay/youcan-pay.gateway.spec.ts        # ~150 lignes
repo/packages/pay/src/gateways/youcan-pay/mock-youcan-pay.gateway.ts        # mock
```

**Criteres validation** :
- V1 (P0) : initiate retourne payment_url
- V2 (P0) : getStatus retourne PaymentStatus normalise
- V3 (P0) : Webhook signature HMAC-SHA256 verifiee
- V4 (P0) : Refund partial + full
- V5 (P0) : Tests 8+ scenarios

---

## Tache 3.4.5 -- PayZone Gateway (Cards + Cash Kiosques)

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 5h / Depend de 3.4.4

**But** : Integration **PayZone** -- inclut paiement cash via kiosques (Tabac shops + agences PayZone) -- cible audience non-bancarisee MA.

**Contexte** : ~30% MA non-bancarises ne peuvent pas payer cards en ligne. PayZone permet generer voucher avec barcode + payer cash a kiosque. Solution unique MA pour inclusion paiement.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/gateways/payzone/payzone.gateway.ts`
- [ ] Methods : initiate (genere voucher + barcode + URL) + getStatus + refund (cash refund process specifique)
- [ ] Cash voucher : barcode 1D Code 128 + 7 jours expiry default
- [ ] Cards EMV path additionnel
- [ ] Webhook receiver : kiosque scan voucher + paiement -> webhook update transaction
- [ ] Variables env : `PAYZONE_API_KEY`, `PAYZONE_MERCHANT_ID`, `PAYZONE_BASE_URL`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/pay/src/gateways/payzone/payzone.gateway.ts                  # ~250 lignes
repo/packages/pay/src/gateways/payzone/voucher-renderer.ts                  # generate barcode + PDF voucher
repo/packages/pay/src/gateways/payzone/payzone.gateway.spec.ts              # ~150 lignes
```

**Notes implementation** :
- Cash voucher PDF : utilise PdfGeneratorService Sprint 10 + barcode library
- Voucher TTL 7 jours : balance UX vs reservation cash flow
- Refund cash : pas instantane (BAM rules) -- credit account ou wire transfer
- Inclusion : critique pour proposition valeur Skalean (toucher non-bancarises)

**Criteres validation** :
- V1 (P0) : initiate cash retourne voucher PDF + barcode
- V2 (P0) : initiate cards retourne payment_url
- V3 (P0) : Voucher TTL 7 jours
- V4 (P0) : Webhook kiosque scan update status
- V5 (P0) : Tests 10+ scenarios

---

## Tache 3.4.6 -- Mobile Wallets : Inwi Money + Orange Money + M-Wallet BAM

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 7h / Depend de 3.4.5

**But** : Integration 3 wallets mobile MA : **Inwi Money**, **Orange Money**, **M-Wallet BAM** (operateur Bank Al-Maghrib pour interop).

**Contexte** : Mobile money MA en croissance : 25%+ transactions retail. Penetration smartphone elevee. Inwi + Orange + IAM operent leurs wallets. M-Wallet BAM = projet inter-operabilite.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/gateways/inwi-money/inwi-money.gateway.ts`
- [ ] Service `repo/packages/pay/src/gateways/orange-money/orange-money.gateway.ts`
- [ ] Service `repo/packages/pay/src/gateways/mwallet-bam/mwallet-bam.gateway.ts`
- [ ] Pattern commun : initiate retourne QR code + USSD code (user scan/dial mobile)
- [ ] STK Push (SIM Toolkit) : provider envoi notification user mobile -> user confirme avec PIN
- [ ] Polling status (vs webhook) souvent : poll provider 30s interval jusqu'a confirme/expired
- [ ] Variables env per provider
- [ ] Mocks + tests

**Fichiers crees / modifies** :
```
repo/packages/pay/src/gateways/inwi-money/inwi-money.gateway.ts            # ~200 lignes
repo/packages/pay/src/gateways/orange-money/orange-money.gateway.ts         # ~200 lignes
repo/packages/pay/src/gateways/mwallet-bam/mwallet-bam.gateway.ts          # ~200 lignes
repo/packages/pay/src/gateways/{wallet}/{wallet}.gateway.spec.ts            # tests per wallet
```

**Notes implementation** :
- Wallets souvent polling (vs webhook) -- BullMQ recurrent job poll status
- STK Push : user tap notification mobile + saisi PIN -> wallet confirme
- QR code alternative : user scan QR avec wallet app -> confirme
- API maturity : wallets MA APIs jeunes, evolutifs (versionning critical)

**Criteres validation** :
- V1 (P0) : 3 gateways implementent interface
- V2 (P0) : QR code + USSD genere
- V3 (P0) : Polling status fonctionne
- V4 (P0) : Tests per wallet 5+ scenarios

---

## Tache 3.4.7 -- PaymentOrchestrator + GatewaySelector

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 6h / Depend de 3.4.6

**But** : Service centralise routing paiement vers gateway optimal selon : tenant settings (providers actifs), montant, type produit, fallback policy.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/services/payment-orchestrator.service.ts`
- [ ] Service `repo/packages/pay/src/services/gateway-selector.service.ts`
- [ ] Method `initiatePayment(request, options): Promise<{ transactionId, redirectUrl, formData? }>` :
  1. GatewaySelector decide provider preferred + fallbacks
  2. Tente initiate avec provider preferred
  3. Si echec (GatewayUnavailableError) : retry avec next fallback
  4. INSERT row pay_transactions avec idempotency_key + status='pending'
  5. Retourne redirectUrl/formData au frontend
- [ ] GatewaySelector logique :
  - Lire `tenant.settings.payment_providers` (array enabled providers + priority)
  - Filter par eligibilite : montant > 5000 MAD -> only cards (wallets ont limites), customer phone Inwi -> Inwi Money preferred, etc.
  - Retourne ordered list providers a tenter
- [ ] Method `cancelPayment(transactionId)`
- [ ] Method `getTransactionStatus(transactionId)` (re-query provider si stale)
- [ ] Idempotency : meme `idempotency_key` retourne meme transactionId (evite double charge)
- [ ] Audit log + Kafka events `pay.transaction_initiated/captured/failed/refunded`
- [ ] Tests : routing logique + fallback + idempotency

**Pattern critique : routing avec fallback**

```typescript
// repo/packages/pay/src/services/payment-orchestrator.service.ts
async initiatePayment(
  request: InitiatePaymentRequest,
  options?: { preferredProvider?: PaymentProvider },
): Promise<InitiatePaymentResult & { transactionId: string }> {
  // 1. Idempotency check
  const existing = await this.transactionsRepo.findOne({
    where: { idempotency_key: request.idempotencyKey, tenant_id: getCurrentTenantId() },
  });
  if (existing) {
    return { transactionId: existing.id, ...existing.metadata.initiateResult };
  }

  // 2. Get ordered providers list
  const providers = await this.gatewaySelector.selectProviders(request, options);
  if (providers.length === 0) {
    throw new BadRequestException({ code: 'NO_AVAILABLE_GATEWAY' });
  }

  // 3. Try each provider
  for (const provider of providers) {
    const gateway = this.gatewayRegistry.get(provider);
    try {
      const result = await gateway.initiate(request);
      const txn = await this.transactionsRepo.save({
        tenant_id: getCurrentTenantId(), idempotency_key: request.idempotencyKey,
        amount: request.amount, currency: request.currency,
        provider, status: 'pending',
        provider_transaction_id: result.providerTransactionId,
        customer_email: request.customerEmail,
        metadata: { initiateResult: result, providers_tried: providers.slice(0, providers.indexOf(provider) + 1) },
      });
      await this.kafkaPublisher.publish(Topics.PAY_TRANSACTION_INITIATED, { txn_id: txn.id, provider });
      return { transactionId: txn.id, ...result };
    } catch (err) {
      logger.warn({ msg: 'gateway_failed', provider, error: err.message });
      if (err instanceof GatewayUnavailableError) continue; // try next
      throw err; // other errors don't retry (decline, fraud, etc.)
    }
  }

  throw new ServiceUnavailableException({ code: 'ALL_GATEWAYS_UNAVAILABLE', providers_tried: providers });
}
```

**Fichiers crees / modifies** :
```
repo/packages/pay/src/services/payment-orchestrator.service.ts            # ~300 lignes
repo/packages/pay/src/services/gateway-selector.service.ts                 # ~200 lignes
repo/packages/pay/src/services/gateway-registry.service.ts                 # ~80 lignes (DI registry)
repo/packages/pay/src/services/{several}.service.spec.ts                   # tests ~300 lignes total
```

**Notes implementation** :
- Gateway registry DI : injection 6 gateways au boot, lookup par enum
- Fallback only on `GatewayUnavailableError` -- decline/fraud errors don't retry (eviter spam)
- Idempotency global : meme key sur 2 calls API = 1 seule transaction (critique anti double charge)
- Tenant settings JSONB : `{ payment_providers: ['cmi', 'youcan_pay'], default_provider: 'cmi', max_amount_wallet: 1000 }`

**Criteres validation** :
- V1 (P0) : Provider preferred utilise si dispo
- V2 (P0) : Fallback sur next si premier unavailable
- V3 (P0) : All gateways down -> 503
- V4 (P0) : Idempotency : meme key retourne meme transactionId
- V5 (P0) : Audit + Kafka events
- V6 (P0) : Tests routing 12+ scenarios

---

## Tache 3.4.8 -- Webhooks Receivers (6 Providers) + Signature Verification

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 7h / Depend de 3.4.7

**But** : 6 endpoints public recevant webhooks des providers + signature verification + idempotency + async processing.

**Livrables checkables** :
- [ ] 6 controllers : `repo/apps/api/src/modules/pay/webhooks/{provider}-webhook.controller.ts`
- [ ] Endpoints `POST /api/v1/public/webhooks/cmi` (et 5 autres providers)
- [ ] Pattern commun (extends Sprint 9 webhooks) :
  - Read raw body
  - Verify signature (HMAC SHA-256/512 selon provider) timing-safe
  - Idempotency via `pay_webhooks_received` table (Sprint 2)
  - Publish Kafka event `pay.webhook_received`
  - Return 200 OK immediate
- [ ] Consumer Kafka `pay-webhook-processor.consumer.ts` :
  - Match transaction via provider_transaction_id
  - Update transaction status (authorized/captured/failed)
  - Trigger downstream events :
    - Si captured + related_resource = invoice -> mark facture paid
    - Si captured -> generate facture PDF (Sprint 10)
    - Si captured -> envoyer notification confirmation paiement (Sprint 9)
    - Si failed -> envoyer notification echec
- [ ] Tests : 6 webhooks per provider + idempotency + downstream events

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/pay/webhooks/{6 controllers}.ts                  # ~600 lignes total
repo/apps/api/src/modules/pay/middleware/{6 signatures}.ts                  # ~400 lignes total
repo/apps/api/src/modules/pay/consumers/pay-webhook-processor.consumer.ts   # ~300 lignes
repo/apps/api/test/pay/webhooks/{6 specs}.e2e-spec.ts                       # tests
```

**Notes implementation** :
- Pattern reutilise Sprint 9 (WA + Mailgun webhooks) pour 6 providers
- Idempotency_key : provider + provider_transaction_id + status (eviter double-process meme update)
- Downstream events critiques : facture genere apres capture
- Tests par provider : envoi webhook synthetic + verifier processing

**Criteres validation** :
- V1 (P0) : 6 webhooks endpoints fonctionnent
- V2 (P0) : Signatures verifiees per provider
- V3 (P0) : Idempotency : duplicate webhook ignore
- V4 (P0) : Captured -> facture PDF genere + email
- V5 (P0) : Failed -> notification user
- V6 (P0) : Tests E2E 12+ scenarios

---

## Tache 3.4.9 -- Refund Service (Partial + Full) avec Workflow Approval

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 5h / Depend de 3.4.8

**But** : Service refund full ou partiel avec workflow approval (admin requires pour montants > 1000 MAD).

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/services/refund.service.ts`
- [ ] Methods :
  - `requestRefund(transactionId, amount, reason): Promise<RefundRequest>` -- creates pending refund_request
  - `approveRefund(refundRequestId, approverId): Promise<void>` -- super_admin approval (montants > 1000 MAD)
  - `rejectRefund(refundRequestId, reason)`
  - `executeRefund(refundRequestId): Promise<void>` -- call provider gateway.refund() + update txn
- [ ] Migration : table `pay_refund_requests` (id, transaction_id, amount, reason, requested_by, status enum 'pending|approved|rejected|executed|failed', approved_by, approved_at, executed_at, provider_refund_id)
- [ ] ABAC TimeBasedPolicy (Sprint 7) : refund autorise < 90 jours apres transaction
- [ ] Auto-approve pour amount <= 1000 MAD (limit configurable per tenant)
- [ ] Endpoints :
  - `POST /api/v1/pay/transactions/:id/refund` (request)
  - `POST /api/v1/pay/refund-requests/:id/approve` (admin)
  - `POST /api/v1/pay/refund-requests/:id/reject`
- [ ] Notification : email user apres refund execute
- [ ] Audit + Kafka events
- [ ] Tests : refund full + partial + approval flow + 90 jours limit

**Fichiers crees / modifies** :
```
repo/packages/pay/src/services/refund.service.ts                          # ~250 lignes
repo/packages/database/src/migrations/{date}-PayRefundRequests.ts          # ~50 lignes
repo/packages/pay/src/entities/pay-refund-request.entity.ts                # ~40 lignes
repo/apps/api/src/modules/pay/controllers/refund.controller.ts            # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Request refund cree pending row
- V2 (P0) : Auto-approve <= 1000 MAD
- V3 (P0) : > 1000 MAD require approval admin
- V4 (P0) : Approval execute provider refund + update txn
- V5 (P0) : Refund > 90 jours rejete (ABAC)
- V6 (P0) : Notification user
- V7 (P0) : Tests 10+ scenarios

---

## Tache 3.4.10 -- Reconciliation Service (CSV Bank + Auto-Match)

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 6h / Depend de 3.4.9

**But** : Service reconciliation : import CSV releve banque + match automatique avec transactions Skalean + report ecarts.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/services/reconciliation.service.ts`
- [ ] Methods :
  - `importBankStatement(csv: Buffer, source: 'cmi_settlement' | 'youcan_settlement' | 'bank_account'): Promise<ImportResult>` -- parse CSV + INSERT pay_reconciliation rows
  - `autoMatch(dateRange): Promise<{ matched, unmatched, ambiguous }>` -- match par amount + date + reference
  - `manualMatch(reconciliationId, transactionId)` -- audit override
- [ ] Migration : table `pay_reconciliation` deja Sprint 2 (rows import + status enum 'unmatched' | 'matched' | 'manual_match' | 'discrepancy')
- [ ] Endpoint `POST /api/v1/pay/reconciliation/import` (upload CSV)
- [ ] Endpoint `POST /api/v1/pay/reconciliation/auto-match`
- [ ] Endpoint `GET /api/v1/pay/reconciliation/discrepancies`
- [ ] Algorithm match : amount exact + date +/- 2 jours + provider_reference Levenshtein < 3
- [ ] Report : transactions Skalean mais pas dans banque (PROBLEM!), banque mais pas Skalean (?)
- [ ] Permissions : `pay.reconciliation.manage`
- [ ] Tests : import CSV + auto-match correct + ambiguous flagged

**Fichiers crees / modifies** :
```
repo/packages/pay/src/services/reconciliation.service.ts                   # ~300 lignes
repo/packages/pay/src/services/csv-parser.service.ts                        # ~150 lignes (multiple bank formats)
repo/apps/api/src/modules/pay/controllers/reconciliation.controller.ts     # ~150 lignes
```

**Notes implementation** :
- CSV parsers : multiples formats banques (BMCE, Attijariwafa, BP, etc.) -- parser specific per source
- Auto-match algorithm : amount exact mandatory, date tolerance, reference fuzzy
- Discrepancies : Kafka event alerte finance team
- Sprint 12 (Books) consumera reconciliation pour ecritures comptables

**Criteres validation** :
- V1 (P0) : Import CSV reussi
- V2 (P0) : Auto-match identifie matched + unmatched + ambiguous
- V3 (P0) : Manual match force assignation
- V4 (P0) : Report discrepancies
- V5 (P0) : Tests 8+ scenarios

---

## Tache 3.4.11 -- Fraud Detection Rules Engine Basique

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 5h / Depend de 3.4.10

**But** : Rules engine simple detectant transactions suspectes : montant exceptionnel, velocity (3 cards meme IP en 5min), country mismatch, etc.

**Livrables checkables** :
- [ ] Service `repo/packages/pay/src/services/fraud-detection.service.ts`
- [ ] Method `evaluate(request): Promise<{ riskScore: number, flags: string[], action: 'allow' | 'review' | 'block' }>`
- [ ] Rules :
  - `amount_exceptional` : amount > avg(last 30 days transactions ce contact) x 5
  - `velocity_too_high` : > 3 transactions same IP < 5 min
  - `card_country_mismatch` : carte BIN country != phone country code
  - `suspicious_email` : disposable email domains (10minutemail, etc.)
  - `multiple_failed_attempts` : > 3 declines same card last 1h
- [ ] Score 0-100 : > 80 block, 50-80 review (manual approval), < 50 allow
- [ ] Storage decisions : table `pay_fraud_evaluations` (audit trail)
- [ ] Block action : reject avant gateway call (eviter cost API)
- [ ] Review action : queue admin pour decision
- [ ] Audit + Kafka events sur high-risk
- [ ] Sprint 30+ : enrichir avec IA (defere)
- [ ] Tests : rules trigger correct sur scenarios fraude

**Fichiers crees / modifies** :
```
repo/packages/pay/src/services/fraud-detection.service.ts                  # ~250 lignes
repo/packages/pay/src/services/fraud-rules/{several}.rule.ts                # 5 rules ~50 lignes chacune
repo/packages/database/src/migrations/{date}-PayFraudEvaluations.ts         # ~40 lignes
```

**Criteres validation** :
- V1 (P0) : Rules engine evalue transactions
- V2 (P0) : Block action bloque avant gateway
- V3 (P0) : Review action queue admin
- V4 (P0) : Audit trail des decisions
- V5 (P0) : Tests 10+ scenarios fraude

---

## Tache 3.4.12 -- BullMQ Retry Queues + DLQ + Idempotency

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 4h / Depend de 3.4.11

**But** : Queues BullMQ pour async operations payment : poll status mobile wallets, retry capture, refund execution.

**Livrables checkables** :
- [ ] Queues :
  - `pay-poll-status` : poll wallet providers status (recurring 30s)
  - `pay-execute-refund` : execute refund async (retry 3x)
  - `pay-fraud-review` : queue admin pour review high-risk
- [ ] Workers correspondants
- [ ] DLQ via Kafka apres max retries
- [ ] Idempotency check : worker re-verify status DB avant action

**Fichiers crees / modifies** :
```
repo/packages/pay/src/workers/{3 workers}.ts                               # ~300 lignes total
```

**Criteres validation** :
- V1 (P0) : Polling wallet works
- V2 (P0) : Retry refund 3x avec backoff
- V3 (P0) : DLQ apres 3 echecs
- V4 (P1) : Tests 6+ scenarios

---

## Tache 3.4.13 -- Endpoints REST + Integration Comm + Docs

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 5h / Depend de 3.4.12

**But** : Controllers exposant API pay + integration cross-module avec Comm (notifications) + Docs (factures auto).

**Livrables checkables** :
- [ ] Controller `payments.controller.ts` :
  - `POST /api/v1/pay/initiate` (orchestrator)
  - `GET /api/v1/pay/transactions` (filtres)
  - `GET /api/v1/pay/transactions/:id`
  - `POST /api/v1/pay/transactions/:id/cancel`
  - `GET /api/v1/pay/methods` (tenant configured providers)
- [ ] Controller `payment-stats.controller.ts` (revenue stats Sprint 13 enrichira)
- [ ] Integration via Kafka events :
  - `pay.transaction_captured` -> Sprint 9 Comm orchestrator envoie email + WhatsApp confirmation
  - `pay.transaction_captured` -> Sprint 10 Docs genere facture PDF auto + envoie email
  - `pay.transaction_failed` -> Comm envoie notification echec + retry suggestion
- [ ] Permissions : `pay.transactions.create/read`, `pay.refunds.request/approve`
- [ ] Tests E2E

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/pay/controllers/{several}.ts                     # ~400 lignes total
repo/apps/api/src/modules/pay/consumers/pay-events-handlers.consumer.ts    # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Endpoints CRUD operationnels
- V2 (P0) : Capture event -> facture PDF auto generee
- V3 (P0) : Capture event -> notification user
- V4 (P0) : Fail event -> notification echec
- V5 (P0) : Tests E2E 8+ scenarios

---

## Tache 3.4.14 -- Tests E2E Exhaustifs (50+) avec Sandboxes

**Metadonnees** : Phase 3 / Sprint 11 / P0 / 10h / Depend de 3.4.13

**But** : Suite tests E2E avec mock 6 providers + sandbox CMI integration reelle (test cards) + fixtures realistes.

**Livrables checkables** :

**Tests E2E (50+)** :
- [ ] Per gateway (6 providers x 8 tests = 48) : initiate happy + decline + 3DS + webhook valid + webhook invalid + refund + cancel + idempotency
- [ ] Orchestrator routing : preferred provider + fallback + all unavailable
- [ ] Reconciliation : import CSV + auto-match + discrepancies
- [ ] Fraud detection : 5 rules trigger correct
- [ ] Cross-module : capture -> facture genere + email envoye

**Sandboxes** :
- [ ] CMI sandbox integration tests reels (test cards CMI)
- [ ] Mocks 5 autres providers (saving on costs)
- [ ] Fixtures : transactions historiques, refunds, fraud events

**Fichiers crees / modifies** :
```
repo/apps/api/test/pay/{50+ specs}.e2e-spec.ts
repo/apps/api/test/pay/fixtures/{several mocks}.ts
repo/infrastructure/scripts/seed-pay-test-data.ts                          # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 50+ tests passent
- V2 (P0) : Sandbox CMI integration reelle OK
- V3 (P0) : Mocks 5 providers fonctionnent
- V4 (P0) : Reproducibility 5x runs
- V5 (P0) : Coverage all critical flows

---

## Sortie du Sprint 11

A la fin de l'execution des 14 taches :

```
Pay multi-passerelles MA operational :
  - 6 gateways : CMI / YouCan Pay / PayZone / Inwi Money / Orange Money / M-Wallet BAM
  - PaymentGatewayInterface + base abstract (Strategy + Adapter)
  - PaymentOrchestrator + GatewaySelector (routing intelligent)
  - 3D Secure mandatory cards (compliance MA)
  - Webhooks 6 providers + signature HMAC verification
  - Refund partial + full + workflow approval > 1000 MAD
  - Reconciliation CSV banque + auto-match
  - Fraud detection rules engine basique
  - Anti-replay + idempotency strict (ULID)
  - PCI-DSS : NEVER stocker card data
  - Cross-module : capture -> facture PDF auto + notification

50+ tests E2E avec sandbox CMI + mocks 5 autres
```

**Sprint 12 (Books + Compliance ACAPS) demarre avec** :
- Reconciliation feed -> ecritures comptables auto
- Plan comptable marocain CGNC connecte aux transactions
- Reports ACAPS prepares avec donnees pay reelles

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-3.4.X-*.md` dans `00-pilotage/prompts-taches/sprint-11-pay/`.

**Patterns code inline conserves** : table pay_transactions schema critique, PaymentGatewayInterface, CMI form data + hash, orchestrator routing avec fallback.

**Reference** : `00-pilotage/documentation/2-variables-environnement.env` couvre tous providers env vars exhaustivement.

---

**Fin du meta-prompt B-11 v2.2 format Option B.**
