# META-PROMPT B-32 -- SPRINT 32 INSURE CONNECTEURS ASSUREURS (DEFERED)

**Version** : v2.2 (Option B)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 32 / 35 (cumul) -- Phase 7 Sprint 4
**Position** : Apres Skalean AI defere (B-29/30/31), avant Pentest securite
**Numerotation taches** : 7.4.1 a 7.4.13
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (connexion assureurs = livre avec Phase 7 Pilote, decision strategique decision-010)

> **NOTE STRATEGIQUE** : Sprint defere de Phase 4 (B-15 origine) a Phase 7 (B-32) selon decision-010. Rationale : (1) Skalean Broker ERP fonctionne pleinement avec Sprint 14 lookup tables sans connecteurs reels, (2) ACAPS Programme Emergence ne demande pas integration assureurs, (3) Partenariats commerciaux + sandboxes assureurs acquis en parallele Phase 7 pilote, (4) Pilote Marrakech demarre avec 1 seul assureur (Wafa cible) au lieu d'attendre 5 simultanes.

---

## Objectif Global du Sprint

Implementer **5 connecteurs API assureurs marocains** : Wafa Assurance, Atlanta Assurance, Saham, RMA, AXA. Pattern Adapter similaire PaymentGateway Sprint 11. Tarification reelle (override lookup tables Sprint 14), synchronisation polices bi-directionnelle, sinistres pull/push, webhook receivers per assureur. Sprint 32 = passerelle critique entre Skalean Broker ERP et infrastructure assureurs.

A la sortie de ce sprint :
- Interface commune `InsurerConnectorInterface` + 5 implementations
- Tarification real-time depuis assureurs (avec fallback Sprint 14 si API down)
- Souscription end-to-end : Skalean -> assureur (police creee chez assureur)
- Synchronisation polices : pull updates depuis assureurs (cron + webhooks)
- Sinistres : declaration declarated to assureurs + pull updates statut
- Webhook receivers per assureur avec signature verification
- Cache responses 5min Redis (tarification + lookups)
- Retry policies + circuit breaker (assureur API peut etre instable)
- Audit log + Kafka events
- Tests E2E avec mocks 5 assureurs (sandbox real integration en pilote Sprint 35)

---

## Frontiere du Sprint

**INCLUS** :
- InsurerConnectorInterface + base abstract class
- 5 connecteurs : Wafa / Atlanta / Saham / RMA / AXA
- Tarification real-time depuis assureurs
- Souscription : push police vers assureur
- Sync polices bi-directionnel (Skalean -> assureur + assureur -> Skalean)
- Sinistres : declaration + pull updates
- Webhook receivers per assureur
- Cache + circuit breaker + retry
- Tests E2E avec mocks

**EXCLU** (sera ajoute aux sprints suivants) :
- Onboarding nouveaux assureurs (Phase 7+ admin UI)
- Real-time pricing comparison engine (Phase 7+ feature competitive)
- IA-powered analyse polices assureurs (Sprint 30+ defere)
- Workflow reglement sinistre auto avec assureurs (Sprint 22+)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/2-variables-environnement.env` -- WAFA_*, ATLANTA_*, SAHAM_*, RMA_*, AXA_*
2. Sortie Sprint 14 Foundation Insure : entities + tarification + workflow
3. APIs documentation per assureur (a obtenir via partenariats commerciaux)
4. Pattern Adapter Sprint 11 (PaymentGateway) : modele d'inspiration

---

## Stack Imposee (Sprint 32)

| Composant | Version | Notes |
|-----------|---------|-------|
| undici | 7.1.1 | HTTP client assureurs |
| opossum | 8.5.0 | circuit breaker (eviter cascades de failures) |
| zod | 3.24.1 | validation responses assureurs |
| crypto Node | native | HMAC webhooks |

Variables env (per assureur) : `{ASSUREUR}_API_BASE_URL`, `{ASSUREUR}_API_KEY/CLIENT_ID/CLIENT_SECRET`, `{ASSUREUR}_WEBHOOK_SECRET`.

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 7.4.1 | InsurerConnectorInterface + base abstract class + circuit breaker | 5h | P0 | Sprint 14 |
| 7.4.2 | Wafa Assurance connector (priorite 1 -- partenaire principal cible) | 8h | P0 | 7.4.1 |
| 7.4.3 | Atlanta Assurance connector | 6h | P0 | 7.4.2 |
| 7.4.4 | Saham connector | 6h | P0 | 7.4.3 |
| 7.4.5 | RMA connector | 6h | P0 | 7.4.4 |
| 7.4.6 | AXA Maroc connector | 6h | P0 | 7.4.5 |
| 7.4.7 | TarificationOrchestrator (route vers assureur si dispo, fallback lookup) | 6h | P0 | 7.4.6 |
| 7.4.8 | SouscriptionOrchestrator (push police vers assureur a signature complete) | 6h | P0 | 7.4.7 |
| 7.4.9 | Sync polices service (pull updates assureurs + reconcile Skalean) | 6h | P0 | 7.4.8 |
| 7.4.10 | Sinistres connector : declaration + pull updates | 5h | P0 | 7.4.9 |
| 7.4.11 | Webhook receivers per assureur (5 endpoints + signature verification) | 7h | P0 | 7.4.10 |
| 7.4.12 | Endpoints REST `/api/v1/insure/connectors/*` + admin monitoring | 4h | P0 | 7.4.11 |
| 7.4.13 | Tests E2E (40+) avec mocks 5 assureurs + circuit breaker scenarios | 9h | P0 | 7.4.12 |

**Total** : 80 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 7.4.1 -- InsurerConnectorInterface + Base Abstract Class

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 5h / Depend de Sprint 14

**But** : Definir interface commune pour 5 connecteurs assureurs + classe abstraite gerant HTTP + retry + circuit breaker.

**Contexte** : Pattern Adapter (similaire PaymentGateway Sprint 11). Chaque connecteur implemente interface, orchestrators (Tache 7.4.7+) ne connaissent pas details specifiques. Circuit breaker critique car APIs assureurs MA peuvent etre instables.

**Livrables checkables** :
- [ ] Interface `repo/packages/insure/src/connectors/insurer-connector.interface.ts` :
  - `provider: string`
  - `getQuote(productCode, souscripteurData): Promise<InsurerQuote>` -- tarification real-time
  - `submitPolicy(policyData, souscripteurData): Promise<{ insurerPolicyNumber }>` -- creation police chez assureur
  - `cancelPolicy(insurerPolicyNumber, reason): Promise<void>`
  - `getPolicy(insurerPolicyNumber): Promise<InsurerPolicy>` -- query status
  - `listProducts(): Promise<InsurerProduct[]>` -- catalog disponible
  - `declareSinistre(sinistreData): Promise<{ insurerSinistreNumber }>`
  - `getSinistre(insurerSinistreNumber): Promise<InsurerSinistre>`
  - `verifyWebhookSignature(rawBody, signature): boolean`
- [ ] Abstract class `base-insurer-connector.ts` :
  - HTTP client undici with retry/timeout
  - **Circuit breaker** opossum (timeout 10s, errorThresholdPercentage 50%, resetTimeout 30s)
  - Cache responses Redis 5min (queries non-mutating : getQuote, getPolicy, listProducts)
  - Logger Pino + metrics OTEL (latency, success rate per assureur)
- [ ] Errors typed : `InsurerUnavailableError`, `InsurerInvalidDataError`, `InsurerProductNotFoundError`, `InsurerCircuitBreakerOpenError`
- [ ] Types : `InsurerQuote`, `InsurerPolicy`, `InsurerSinistre`, `InsurerProduct`
- [ ] Tests : interface + base class HTTP + circuit breaker

**Pattern critique : circuit breaker integration**

```typescript
// repo/packages/insure/src/connectors/base-insurer-connector.ts
import CircuitBreaker from 'opossum';

export abstract class BaseInsurerConnector implements InsurerConnectorInterface {
  abstract provider: string;
  abstract apiBaseUrl: string;
  abstract apiKey: string;

  private getQuoteBreaker: CircuitBreaker;
  private submitPolicyBreaker: CircuitBreaker;

  constructor() {
    this.getQuoteBreaker = new CircuitBreaker(this._getQuote.bind(this), {
      timeout: 10000,                  // 10s timeout
      errorThresholdPercentage: 50,    // 50% errors -> open
      resetTimeout: 30000,             // try again 30s after open
      rollingCountTimeout: 60000,      // window 60s
      rollingCountBuckets: 10,
    });

    this.getQuoteBreaker.on('open', () => {
      logger.warn({ msg: 'circuit_breaker_open', provider: this.provider, operation: 'getQuote' });
    });
    this.getQuoteBreaker.on('halfOpen', () => {
      logger.info({ msg: 'circuit_breaker_halfopen', provider: this.provider });
    });
    this.getQuoteBreaker.on('close', () => {
      logger.info({ msg: 'circuit_breaker_closed', provider: this.provider });
    });
  }

  async getQuote(productCode: string, souscripteurData: any): Promise<InsurerQuote> {
    try {
      return await this.getQuoteBreaker.fire(productCode, souscripteurData);
    } catch (err) {
      if (this.getQuoteBreaker.opened) {
        throw new InsurerCircuitBreakerOpenError({ provider: this.provider });
      }
      throw err;
    }
  }

  protected abstract _getQuote(productCode: string, souscripteurData: any): Promise<InsurerQuote>;
}
```

**Fichiers crees / modifies** :
```
repo/packages/insure/src/connectors/insurer-connector.interface.ts            # ~80 lignes
repo/packages/insure/src/connectors/base-insurer-connector.ts                  # ~250 lignes
repo/packages/insure/src/connectors/types.ts                                    # ~80 lignes
repo/packages/insure/src/connectors/errors.ts                                   # ~50 lignes (4 error classes)
repo/packages/insure/package.json                                               # add : opossum
```

**Notes implementation** :
- Circuit breaker per operation (getQuote, submitPolicy, etc.) -- isolation
- Cache Redis 5min : query non-mutating only (getQuote, listProducts, getPolicy stateless)
- Metrics OTEL : permettent monitoring health connecteurs Sprint 32
- Errors typed : differentiation pour orchestrators (fallback vs propagation)

**Criteres validation** :
- V1 (P0) : Interface declare 8 methods
- V2 (P0) : Base class HTTP retry + circuit breaker
- V3 (P0) : Circuit breaker open -> InsurerCircuitBreakerOpenError
- V4 (P0) : Cache Redis 5min hit
- V5 (P0) : Metrics OTEL emit
- V6 (P0) : Tests 8+ scenarios

---

## Tache 7.4.2 -- Wafa Assurance Connector (Priorite 1)

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 8h / Depend de 7.4.1

**But** : Implementation premier connecteur Wafa Assurance (premier partenaire commercial cible MA).

**Contexte** : Wafa = filiale Attijariwafa Bank, leader marche assurance MA. Choix priorite 1 : volumes + reputation + stabilite. Sprint 32 implemente le connecteur ; partenariat commercial doit etre acquis en parallele (Sprint 35 pilote).

**Livrables checkables** :
- [ ] Service `repo/packages/insure/src/connectors/wafa/wafa.connector.ts` extends BaseInsurerConnector
- [ ] Implement methods :
  - `_getQuote()` : POST `/quotes` -> retourne quote_id + prime + garanties detaillees
  - `_submitPolicy()` : POST `/policies` -> retourne wafa_policy_number + status
  - `_cancelPolicy()` : POST `/policies/:id/cancel`
  - `_getPolicy()` : GET `/policies/:id`
  - `_listProducts()` : GET `/products`
  - `_declareSinistre()` : POST `/claims`
  - `_getSinistre()` : GET `/claims/:id`
  - `verifyWebhookSignature()` : HMAC-SHA256 signature header `X-Wafa-Signature` (env `WAFA_WEBHOOK_SECRET`)
- [ ] Authentification : API key (env `WAFA_API_KEY`) bearer + client_id/client_secret pour OAuth2 si requis
- [ ] Mapping data Wafa -> Skalean :
  - Wafa product codes -> Skalean branche/product
  - Wafa garanties -> Skalean garanties JSONB
  - Wafa errors -> normalized errors
- [ ] Variables env : `WAFA_API_BASE_URL`, `WAFA_API_KEY`, `WAFA_CLIENT_ID`, `WAFA_CLIENT_SECRET`, `WAFA_WEBHOOK_SECRET`
- [ ] Mock client `MockWafaConnector` pour tests
- [ ] Sandbox vs prod via env URL
- [ ] Tests integration via mock

**Fichiers crees / modifies** :
```
repo/packages/insure/src/connectors/wafa/wafa.connector.ts                     # ~350 lignes
repo/packages/insure/src/connectors/wafa/wafa.connector.spec.ts                 # ~250 lignes
repo/packages/insure/src/connectors/wafa/wafa-mapping.ts                        # ~150 lignes (data mapping)
repo/packages/insure/src/connectors/wafa/types.ts                                # types Wafa-specific
repo/packages/insure/src/connectors/wafa/mock-wafa.connector.ts                  # mock
```

**Notes implementation** :
- Wafa API documentation : a obtenir via partenariat commercial (Sprint 35 pilote phase)
- Interim : implement basique structure + mock interface ; Sprint 35 pilote refinera avec API reelle
- Sandbox URL diff prod : isolation tests
- Mapping critical : Wafa products code != Skalean code (translation layer)

**Criteres validation** :
- V1 (P0) : Connector implements interface
- V2 (P0) : 7 methods fonctionnent (mock)
- V3 (P0) : HMAC signature verification
- V4 (P0) : Mapping data Wafa <-> Skalean
- V5 (P0) : Tests 12+ scenarios mock

---

## Tache 7.4.3 -- Atlanta Assurance Connector

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.2

**But** : Connecteur Atlanta Assurance (autre partenaire majeur).

**Livrables checkables** :
- [ ] Service `atlanta.connector.ts` similaire pattern Wafa
- [ ] Pattern reutilise : meme interface, adaptations Atlanta-specific
- [ ] Variables env : `ATLANTA_*`
- [ ] Mapping Atlanta -> Skalean
- [ ] Mock + tests

**Fichiers crees / modifies** :
```
repo/packages/insure/src/connectors/atlanta/atlanta.connector.ts              # ~300 lignes
repo/packages/insure/src/connectors/atlanta/atlanta-mapping.ts                  # ~120 lignes
repo/packages/insure/src/connectors/atlanta/mock-atlanta.connector.ts            # mock
repo/packages/insure/src/connectors/atlanta/atlanta.connector.spec.ts            # tests
```

**Criteres validation** :
- V1 (P0) : Connector implements interface
- V2 (P0) : 7 methods fonctionnent
- V3 (P0) : Tests 10+ scenarios

---

## Tache 7.4.4 -- Saham Connector

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.3

**But** : Connecteur Saham (groupe Sanlam international, presence MA).

**Livrables checkables** : Pattern similaire Wafa/Atlanta. Variables env `SAHAM_*`. Mock + tests.

**Fichiers crees / modifies** :
```
repo/packages/insure/src/connectors/saham/saham.connector.ts                   # ~300 lignes
repo/packages/insure/src/connectors/saham/saham-mapping.ts                      # ~120 lignes
repo/packages/insure/src/connectors/saham/mock-saham.connector.ts                # mock
repo/packages/insure/src/connectors/saham/saham.connector.spec.ts                # tests
```

**Criteres validation** : V1-V3 similaires Atlanta.

---

## Tache 7.4.5 -- RMA Connector

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.4

**But** : Connecteur RMA (Royale Marocaine d'Assurances, leader marche local).

**Livrables checkables** : Pattern similaire. Variables `RMA_*`. Mock + tests.

**Fichiers crees / modifies** :
```
repo/packages/insure/src/connectors/rma/rma.connector.ts                       # ~300 lignes
repo/packages/insure/src/connectors/rma/rma-mapping.ts                          # ~120 lignes
repo/packages/insure/src/connectors/rma/mock-rma.connector.ts                    # mock
repo/packages/insure/src/connectors/rma/rma.connector.spec.ts                    # tests
```

**Criteres validation** : V1-V3 similaires.

---

## Tache 7.4.6 -- AXA Maroc Connector

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.5

**But** : Connecteur AXA (filiale internationale, leader sante MA).

**Livrables checkables** : Pattern similaire. Variables `AXA_*`. Mock + tests.

**Fichiers crees / modifies** :
```
repo/packages/insure/src/connectors/axa/axa.connector.ts                       # ~300 lignes
repo/packages/insure/src/connectors/axa/axa-mapping.ts                          # ~120 lignes
repo/packages/insure/src/connectors/axa/mock-axa.connector.ts                    # mock
repo/packages/insure/src/connectors/axa/axa.connector.spec.ts                    # tests
```

**Criteres validation** : V1-V3 similaires.

---

## Tache 7.4.7 -- TarificationOrchestrator (Routing + Fallback)

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.6

**But** : Override TarificationService Sprint 14 : si product associe a un assureur connecte -> query real-time. Si assureur down (circuit breaker open) ou pas connecte -> fallback lookup tables Sprint 14.

**Livrables checkables** :
- [ ] Service `repo/packages/insure/src/services/tarification-orchestrator.service.ts`
- [ ] Method `getQuote(productId, souscripteurData): { source: 'insurer_realtime' | 'fallback_lookup', breakdown }`
- [ ] Logic :
  1. Lookup product `insurer_id`
  2. Si assureur connecte ET circuit breaker closed : query connecteur
  3. Si echec OR pas connecte : fallback Sprint 14 calculator
  4. Tag source dans response (transparency)
- [ ] Cache 5min Redis : eviter quote storm pour produit/data identique
- [ ] Logging : source ratio (% real-time vs fallback)
- [ ] Tests : real-time success, fallback on circuit breaker, fallback on no connector

**Pattern critique : routing avec fallback**

```typescript
// repo/packages/insure/src/services/tarification-orchestrator.service.ts
async getQuote(productId: string, souscripteurData: any): Promise<TarificationResult> {
  const product = await this.productsService.findById(productId);

  // Try real-time si assureur configure
  if (product.insurer_id) {
    const connector = this.connectorRegistry.get(product.insurer_provider);
    if (connector) {
      try {
        const insurerQuote = await connector.getQuote(product.code, souscripteurData);
        logger.info({ msg: 'quote_from_insurer', provider: product.insurer_provider });
        return {
          source: 'insurer_realtime',
          breakdown: this.normalizeInsurerQuote(insurerQuote),
        };
      } catch (err) {
        if (err instanceof InsurerCircuitBreakerOpenError || err instanceof InsurerUnavailableError) {
          logger.warn({ msg: 'insurer_unavailable_fallback', provider: product.insurer_provider });
          // Fallback to lookup
        } else {
          throw err; // other errors don't fallback (data invalid, etc.)
        }
      }
    }
  }

  // Fallback : Sprint 14 lookup tables
  const fallbackQuote = await this.sprintFourteenTarificationService.calculate(
    product, souscripteurData, []  // garanties from product default
  );
  return {
    source: 'fallback_lookup',
    breakdown: fallbackQuote,
  };
}
```

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/tarification-orchestrator.service.ts        # ~200 lignes
repo/packages/insure/src/services/tarification-orchestrator.service.spec.ts   # ~150 lignes
repo/packages/insure/src/services/connector-registry.service.ts                # ~80 lignes (DI registry)
```

**Notes implementation** :
- ConnectorRegistry : DI 5 connectors -> Map<provider, Connector>
- Source tagging dans response : transparency utilisateur (broker sait quand fallback)
- Sprint 27 admin : monitor % fallback per product (alertes si > 10%)

**Criteres validation** :
- V1 (P0) : Real-time success retourne `source='insurer_realtime'`
- V2 (P0) : Circuit breaker open -> fallback automatique
- V3 (P0) : Pas connecteur -> fallback Sprint 14
- V4 (P0) : Errors data invalid : pas fallback (propagate)
- V5 (P0) : Cache hit 5min
- V6 (P0) : Tests 10+ scenarios

---

## Tache 7.4.8 -- SouscriptionOrchestrator (Push Police vers Assureur)

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.7

**But** : Apres signature police complete (Sprint 14), pousser police vers assureur (creation chez eux) + storage `insurer_policy_number`.

**Livrables checkables** :
- [ ] Consumer Kafka `signature-completed-insure-push.consumer.ts`
- [ ] Listen event `signature.workflow_completed` filtre `related_resource_type='insure_policy'`
- [ ] Logic :
  1. Get policy + product + insurer
  2. Si insurer connecte : `connector.submitPolicy()` -> retourne `insurer_policy_number`
  3. Update policy : ajout `insurer_policy_number`, `insurer_status='active'`
  4. Si echec : retry via BullMQ (3x backoff exp), DLQ apres
  5. Audit + Kafka events
- [ ] Idempotency : verifier `insurer_policy_number` deja set avant submit (eviter doublons)
- [ ] Migration : add columns `insure_policies.insurer_policy_number`, `insurer_status`, `insurer_synced_at`
- [ ] Tests : push success, retry on transient, DLQ on permanent, idempotency

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddInsurerSyncColumns.ts          # ~40 lignes
repo/packages/insure/src/consumers/signature-completed-insure-push.consumer.ts # ~200 lignes
repo/packages/insure/src/jobs/insurer-push-retry.worker.ts                       # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Signature complete -> push assureur
- V2 (P0) : insurer_policy_number stocke
- V3 (P0) : Idempotency : 2eme call ignore
- V4 (P0) : Retry transient errors
- V5 (P0) : DLQ apres 3 echecs
- V6 (P0) : Tests 8+ scenarios

---

## Tache 7.4.9 -- Sync Polices Service (Pull Updates Assureurs)

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 6h / Depend de 7.4.8

**But** : Cron job pull updates polices depuis assureurs (cas modifications cote assureur : suspension, prime ajustee, etc.) + reconcile Skalean.

**Livrables checkables** :
- [ ] Service `repo/packages/insure/src/services/policy-sync.service.ts`
- [ ] Method `syncPoliciesFromInsurer(provider): Promise<{ updated, conflicts }>` :
  1. List policies Skalean avec ce provider + status='active'
  2. Pour chaque : `connector.getPolicy(insurer_policy_number)`
  3. Compare avec Skalean state
  4. Si difference : update Skalean (preserve audit) + Kafka event `insure.policy_synced`
  5. Si conflict (e.g. assureur status='cancelled' alors Skalean 'active') : flag conflict + alert super admin
- [ ] Cron job daily 6h matin
- [ ] Endpoint manual trigger : `POST /api/v1/admin/insure/sync-policies?provider=wafa`
- [ ] Logs : policies synced, updated, conflicts
- [ ] Tests : sync OK + conflicts detection

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/policy-sync.service.ts                       # ~250 lignes
repo/packages/insure/src/jobs/policy-sync.cron.ts                                # ~80 lignes
repo/apps/api/src/modules/admin/controllers/admin-insure-sync.controller.ts     # ~80 lignes
```

**Notes implementation** :
- Cron 6h matin : assureurs majoritairement actifs business hours
- Conflict detection : assureur source de verite par defaut (mais alert humain)
- Performance : batch 50 policies per provider call (eviter rate limit)

**Criteres validation** :
- V1 (P0) : Sync detect updates assureur
- V2 (P0) : Update Skalean
- V3 (P0) : Conflicts flagged
- V4 (P0) : Cron daily
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.4.10 -- Sinistres Connector : Declaration + Pull Updates

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 5h / Depend de 7.4.9

**But** : Permettre declaration sinistre depuis Skalean vers assureur + sync updates assureur retour. Sprint 22 implementera workflow sinistre complet ; Sprint 32 prepare connecteur.

**Livrables checkables** :
- [ ] Methods `declareSinistre()` + `getSinistre()` deja Sprint 32 dans connectors (Tache 7.4.2-6)
- [ ] Service `sinistre-sync.service.ts` :
  - `declareToInsurer(sinistreId): Promise<{ insurer_sinistre_number }>` -- push sinistre vers assureur
  - `syncSinistresFromInsurer(provider): updates`
- [ ] Migration prep tables sinistres (Sprint 22 enrichira) : add columns `repair_sinistres.insurer_sinistre_number`, `insurer_status`
- [ ] Sprint 32 livre infrastructure ; Sprint 22 utilisera
- [ ] Tests via mocks

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/sinistre-sync.service.ts                     # ~200 lignes
repo/packages/database/src/migrations/{date}-AddSinistreInsurerSync.ts          # ~40 lignes
```

**Criteres validation** :
- V1 (P0) : declareToInsurer push sinistre
- V2 (P0) : Sync from insurer
- V3 (P0) : Tests 6+ scenarios

---

## Tache 7.4.11 -- Webhook Receivers Per Assureur (5 Endpoints)

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 7h / Depend de 7.4.10

**But** : 5 endpoints webhooks (un par assureur) pour recevoir notifications real-time depuis assureurs (status update, sinistre regle, etc.).

**Livrables checkables** :
- [ ] 5 controllers `/api/v1/public/webhooks/{wafa,atlanta,saham,rma,axa}`
- [ ] Pattern reutilise Sprint 9/10/11 :
  - Read raw body
  - Verify signature HMAC per assureur (env `{ASSUREUR}_WEBHOOK_SECRET`)
  - Idempotency `comm_webhooks_received` table (extension multi-source)
  - Publish Kafka event `insure.webhook_received_{provider}`
  - Return 200 OK immediate
- [ ] Consumer Kafka `insurer-webhook-processor.consumer.ts` :
  - Process events : policy status change, premium ajustee, sinistre regle
  - Update Skalean state correspondants
  - Trigger downstream : notification user (Sprint 9), audit
- [ ] Tests E2E : 5 webhooks per provider

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/insure/webhooks/{5 controllers}.ts                   # ~500 lignes total
repo/apps/api/src/modules/insure/middleware/{5 signatures}.ts                   # ~300 lignes total
repo/apps/api/src/modules/insure/consumers/insurer-webhook-processor.consumer.ts  # ~250 lignes
repo/apps/api/test/insure/webhooks/{5 specs}.e2e-spec.ts                        # tests
```

**Criteres validation** :
- V1 (P0) : 5 webhooks endpoints
- V2 (P0) : Signatures verifiees per assureur
- V3 (P0) : Idempotency
- V4 (P0) : Status updates appliquees
- V5 (P0) : Tests E2E 10+ scenarios

---

## Tache 7.4.12 -- Endpoints REST + Admin Monitoring

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 4h / Depend de 7.4.11

**But** : Endpoints API publique connectors + admin monitoring health connectors.

**Livrables checkables** :
- [ ] Endpoint `GET /api/v1/insure/connectors` (list configured)
- [ ] Endpoint `POST /api/v1/insure/connectors/:provider/test` (super admin : test connection)
- [ ] Endpoint admin `GET /api/v1/admin/insure/connectors/health` :
  - Per provider : status (closed/halfopen/open), success_rate_24h, latency_p95, last_error
- [ ] Dashboard ADMIN : page health connectors (Sprint 27 enrichira UI)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/insure/controllers/connectors.controller.ts          # ~120 lignes
repo/apps/api/src/modules/admin/controllers/admin-connectors-health.controller.ts # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : List connecteurs
- V2 (P0) : Test connection
- V3 (P0) : Health endpoint admin
- V4 (P0) : Tests 6+ scenarios

---

## Tache 7.4.13 -- Tests E2E (40+) avec Mocks 5 Assureurs

**Metadonnees** : Phase 7 / Sprint 32 / P0 / 9h / Depend de 7.4.12

**But** : Suite tests E2E + circuit breaker scenarios + mock 5 assureurs.

**Livrables checkables** :

**Tests E2E (40+)** :
- [ ] Per connecteur (5 x 6 tests = 30) : getQuote / submitPolicy / getPolicy / cancelPolicy / declareSinistre / verifyWebhookSignature
- [ ] TarificationOrchestrator : real-time + fallback + cache (3)
- [ ] SouscriptionOrchestrator : push + retry + DLQ (3)
- [ ] PolicySync : sync + conflicts (2)
- [ ] Webhooks : 5 receivers signature verified (5)
- [ ] Circuit breaker : open after errors + halfopen reset (2)

**Mocks** :
- 5 mock servers (nock or MSW) pour chaque assureur
- Scenarios : success / errors transient / errors permanent / timeout / circuit breaker

**Fichiers crees / modifies** :
```
repo/apps/api/test/insure/connectors/{30+ specs}.e2e-spec.ts
repo/apps/api/test/fixtures/mock-insurer-servers/{5 mock servers}
```

**Criteres validation** :
- V1 (P0) : 40+ tests passent
- V2 (P0) : Mocks 5 assureurs fonctionnent
- V3 (P0) : Circuit breaker scenarios verifies
- V4 (P0) : CI green
- V5 (P0) : Reproducibility 5x

---

## Sortie du Sprint 32

A la fin de l'execution des 13 taches :

```
Insurer Connectors operational :
  - 5 connecteurs : Wafa / Atlanta / Saham / RMA / AXA
  - InsurerConnectorInterface + base abstract class
  - Circuit breaker per operation per assureur (resilient cascading failures)
  - Cache Redis 5min query non-mutating
  - TarificationOrchestrator : real-time + fallback Sprint 14 lookup
  - SouscriptionOrchestrator : push police vers assureur
  - PolicySync : pull updates daily + conflict detection
  - Sinistres : declaration + pull updates (Sprint 22 enrichira)
  - 5 webhooks endpoints + signature verification HMAC
  - Admin monitoring health connecteurs

40+ tests E2E avec 5 mock assureurs
```

**Sprint 33 (Insure Lifecycle Police avance) demarre avec** :
- Connecteurs ready
- Lifecycle police standard fonctionne
- Sprint 33 ajoute features avancees : transferts, fractionnement, suspensions, etc.

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-7.4.X-*.md` dans `00-pilotage/prompts-taches/sprint-32-insure-connecteurs/`.

**Patterns code inline conserves** : circuit breaker integration opossum, routing avec fallback (try real-time -> catch CircuitBreakerOpen -> fallback lookup).

**Reference** : `00-pilotage/documentation/2-variables-environnement.env` couvre catalog WAFA_*, ATLANTA_*, SAHAM_*, RMA_*, AXA_*.

---

**Fin du meta-prompt B-15 v2.2 format Option B.**
