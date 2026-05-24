# META-PROMPT PHASE B SPRINT 32 v3.0 -- REFONTE Connecteurs InsurTech Maroc (8 carriers)
# 18 taches detaillees Cowork avec patterns code + integration carrier-by-carrier
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (REFONTE complete v2.2 -- API maturity reality check)
**Phase** : 7 -- IA + Connecteurs InsurTech (deferred sprint)
**Sprint** : 32 / 40 (cumul v3.0)
**Reference orchestrateur** : `C-32-sprint-32-insure-connecteurs.md`
**Reference verification** : `V-32-sprint-32-verification.md`
**Numerotation taches** : 7.2.1 a 7.2.18 (vs 7.2.1 a 7.2.10 v2.2)
**Effort total** : ~140 heures developpement / 3 semaines (vs 75h v2.2)
**Apport metier** : Connecteurs 8 carriers Maroc avec reality check API maturity + fallback strategy

---

## REFONTE v3.0 -- API Maturity Reality Check

**Probleme v2.2 identifie** :

Le v2.2 supposait que tous les carriers Maroc auraient des APIs REST modernes documentees. **Realite terrain** (audit Saad janvier 2025) :

| Carrier | API REST | OAuth2 | Docs publiques | Sandbox | Score Maturity |
|---------|----------|--------|----------------|---------|----------------|
| Wafa Assurance | OUI partiel | Non | Limite | Non | 3/10 |
| RMA Assurance | NON | Non | Non | Non | 1/10 |
| Saham Assurance (Sanlam) | OUI partiel | OUI | Limite | OUI | 5/10 |
| AXA Assurance Maroc | OUI | OUI | Bonne | OUI | 7/10 |
| Atlanta Assurance | NON | Non | Non | Non | 1/10 |
| Allianz Maroc | OUI partiel | OUI | Limite | Non | 4/10 |
| MAMDA-MCMA | NON | Non | Non | Non | 1/10 |
| Sanad (groupe AXA) | OUI partiel | OUI | Limite | OUI | 5/10 |

**Strategie v3.0 multi-niveaux** :
- **Tier 1** (AXA + Allianz + Sanad + Saham) : API REST -- integration directe
- **Tier 2** (Wafa) : API partielle -- combinaison API + portail web scraping
- **Tier 3** (RMA + Atlanta + MAMDA) : Pas d'API -- fallback Email + portail web scraping + workflow manuel

---

## REFONTE v3.0 -- Differences majeures vs v2.2

| Element | v2.2 | v3.0 |
|---------|------|------|
| Nombre carriers | 5 generiques | 8 carriers Maroc reels + tiers |
| Integration strategy | API REST homogene | 3 tiers (API + scraping + manuel) |
| Fallback | Non present | Email + scraping web + workflow manuel |
| Authentication | OAuth2 partout | OAuth2 OR API key OR session web scraping |
| Endpoints supportes | 10 par carrier | Variables selon tier |
| Rate limiting | Generique | Per carrier (Wafa: 10/min, AXA: 100/min, etc.) |
| Audit ACAPS | Basique | Avance + circuit breaker + retry policies |
| Data normalization | Non | Layer normalisation v3.0 (chaque carrier = format different) |

---

## POSITION DANS LA PHASE

Sprint 32 (7.2) -- DEFERRED. Suit Sprint 31 (Agent Sky) et precede Sprint 33 (Pentest Securite). **Apres Demo Day 30 juin 2026** (decision-015 fallback).

**Sprints consommateurs** (upstream) :
- Sprint 14 (Insure Foundation) -- consume API carriers pour policies sync
- Sprint 21 (Sinistre Workflow) -- consume API carriers pour FNOL + payment approval
- Sprint 24 (Flux 5 acteurs) -- consume Decision Engine + carrier APIs
- Sprint 26.5 (Carrier Portal) -- consume API carriers pour reports

---

## DEPENDANCES

**Entrees consommees** :
- Sprint 14 entites Insure (policies + claims + payments)
- Sprint 26.5 Carrier Portal (UI + workflows)
- Sprint 9 Comm (email fallback Tier 3)
- Sprint 20b Sky AI (Decision Engine routing)

**Sorties produites** :
- Service `@insurtech/carrier-connectors` package
- 8 connectors specifiques (Tier 1: 4 / Tier 2: 1 / Tier 3: 3)
- Data normalization layer (formats heterogenes -> schema unifie)
- Circuit breakers + retry policies per carrier
- Audit ACAPS connect/disconnect/sync events
- Fallback workflows (email + scraping)

---

## DECISIONS STRATEGIQUES APPLICABLES

- **decision-008 data residency Maroc** : connecteurs hebergent en local + secrets Atlas KMS
- **decision-013 expert acteur** : connecteurs sync data carrier -> expert designations
- **API maturity reality check** : strategie pragmatique multi-tiers

---

## REGLES ABSOLUES skalean-insurtech v3.0

(Identique B-14 batch + specificites connecteurs :)

**Specifique Sprint 32 v3.0** :
- **Circuit breaker** : opossum lib avec config per carrier
- **Retry policies** : exponential backoff + jitter
- **Rate limiting** : per carrier configurable
- **Secrets management** : Atlas Cloud KMS (jamais hardcoded)
- **Audit ACAPS** : chaque sync/connect/disconnect log 10 ans
- **Data normalization** : schema unifie `NormalizedCarrierData` (mapping per carrier)
- **Fallback hierarchie** : API -> scraping -> email -> manual workflow
- **Mock mode** : feature flag `MOCK_CARRIER_CONNECTORS=true` pour Sprint 21/24/26.5 testing
- **Sandboxing** : tous Tier 1 ont environnement sandbox + production

---

## EXECUTION SEQUENTIELLE DES 18 TACHES

---

### Tache 7.2.1 : Package @insurtech/carrier-connectors + architecture

**Metadonnees** : P0 | 5h | Depend de : Sprint 31

**But** : Creer package @insurtech/carrier-connectors + architecture multi-tiers + abstractions.

**Actions principales** :
- Dossier `repo/packages/carrier-connectors/`
- Architecture :
  ```
  packages/carrier-connectors/
    src/
      types/
        normalized-carrier-data.types.ts      # Schema unifie
        carrier-tier.types.ts                  # Tier 1/2/3 enum
      schemas/
      services/
        carrier-connector-registry.service.ts # Registry des 8 carriers
        carrier-normalizer.service.ts          # Data normalization layer
        circuit-breaker-manager.service.ts     # Circuit breakers per carrier
      connectors/
        base/
          base-carrier-connector.ts             # Abstract class
          tier1-api-connector.ts                # Tier 1 implementation
          tier2-hybrid-connector.ts             # Tier 2 implementation
          tier3-fallback-connector.ts           # Tier 3 implementation
        carriers/
          axa.connector.ts                      # Tier 1
          allianz.connector.ts                  # Tier 1
          saham.connector.ts                    # Tier 1
          sanad.connector.ts                    # Tier 1
          wafa.connector.ts                     # Tier 2
          rma.connector.ts                      # Tier 3
          atlanta.connector.ts                  # Tier 3
          mamda.connector.ts                    # Tier 3
  ```

**Pattern code `base-carrier-connector.ts`** :
```typescript
export abstract class BaseCarrierConnector {
  abstract readonly carrierCode: string;
  abstract readonly tier: 1 | 2 | 3;
  abstract readonly capabilities: CarrierCapability[];

  protected readonly logger: PinoLogger;
  protected readonly circuitBreaker: CircuitBreaker;
  protected readonly acapsAudit: AcapsAuditService;

  // === API methods (abstract) ===
  abstract authenticate(): Promise<AuthResult>;
  abstract fetchPolicy(policyNumber: string): Promise<NormalizedPolicy>;
  abstract submitFnol(input: FnolSubmissionInput): Promise<FnolResult>;
  abstract fetchClaimStatus(claimId: string): Promise<NormalizedClaim>;
  abstract submitDevisForApproval(input: DevisApprovalInput): Promise<ApprovalResult>;

  // === Common methods (concrete) ===
  protected async withCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.fire(operation);
  }

  protected async withRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
    return retry(operation, { retries: maxAttempts, factor: 2, minTimeout: 1000 });
  }

  protected async auditOperation(operation: string, success: boolean, metadata?: any) {
    await this.acapsAudit.log({
      entityType: 'carrier_connector',
      entityId: `${this.carrierCode}:${operation}`,
      action: success ? 'sync_success' : 'sync_failure',
      metadata: { carrier: this.carrierCode, tier: this.tier, ...metadata }
    });
  }
}
```

**Commit** :
```bash
git commit -m "feat(sprint-32): package @insurtech/carrier-connectors + architecture multi-tiers

Task: 7.2.1
Sprint: 32 (Phase 7 / Sprint 2)
Phase: 7 -- IA + Connecteurs
Decisions: api maturity reality check"
```

---

### Tache 7.2.2 : Data normalization layer (schema unifie NormalizedCarrierData)

**Metadonnees** : P0 | 6h | Depend de : 7.2.1

**But** : Layer normalisation -- chaque carrier renvoie formats differents, on unifie en `NormalizedCarrierData`.

**Actions principales** :

Pattern `normalized-carrier-data.types.ts` :
```typescript
export interface NormalizedPolicy {
  // Identifiants
  policyNumber: string;
  carrierCode: 'WAFA' | 'RMA' | 'SAHAM' | 'AXA' | 'ATLANTA' | 'ALLIANZ' | 'MAMDA' | 'SANAD';
  
  // Customer
  customer: {
    cin: string;
    fullName: string;
    phone: string;
    email: string | null;
    address: string;
  };
  
  // Couvertures
  branch: 'auto' | 'sante' | 'habitation' | 'rc_pro' | 'voyage';
  coverages: Array<{
    name: string;
    limitMad: string;        // decimal precision
    deductibleMad: string;
  }>;
  
  // Dates
  startDate: Date;
  endDate: Date;
  
  // Financial
  premiumMad: string;        // decimal
  
  // Status
  status: 'active' | 'suspended' | 'expired' | 'cancelled';
  
  // Vehicle (auto only)
  vehicle?: {
    plate: string;
    make: string;
    model: string;
    year: number;
    vin: string;
  };
  
  // Original raw response (audit purpose)
  rawResponse: Record<string, any>;
  
  // Normalization metadata
  normalizedAt: Date;
  normalizerVersion: string;
  carrierApiVersion: string;
}
```

Service `carrier-normalizer.service.ts` :
- `normalizePolicy(carrierCode, rawResponse)` -- mapping per carrier
- Mapping tables `repo/packages/carrier-connectors/src/normalizers/{carrier}-mapper.ts` (8 fichiers)
- Validation Zod schema NormalizedPolicy
- Tests 20+ (1 per carrier minimum)

**Commit** :
```bash
git commit -m "feat(sprint-32): data normalization layer + mapping per carrier

Task: 7.2.2
Sprint: 32 (Phase 7 / Sprint 2)"
```

---

### Tache 7.2.3 : Circuit breaker + retry policies (opossum)

**Metadonnees** : P0 | 4h | Depend de : 7.2.2

**But** : Circuit breakers per carrier avec config differenciee selon Tier.

**Actions** :
- Service `circuit-breaker-manager.service.ts` :
  - Config per carrier (timeout + threshold + reset)
  - Tier 1 : timeout 5s + 50% errors threshold + reset 30s
  - Tier 2 : timeout 15s + 30% errors + reset 60s
  - Tier 3 : timeout 60s + 10% errors + reset 5min
- Metrics Prometheus per circuit breaker
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): circuit breaker + retry policies per carrier

Task: 7.2.3"
```

---

### Tache 7.2.4 : TIER 1 -- AXA Assurance connector (REST API + OAuth2)

**Metadonnees** : P0 | 8h | Depend de : 7.2.3

**But** : Connecteur AXA (Tier 1 -- meilleure API). REST API + OAuth2 + sandbox.

**Actions principales** :
- Service `axa.connector.ts` extends `Tier1ApiConnector` :
  - `authenticate()` : OAuth2 client_credentials grant -> bearer token + refresh
  - `fetchPolicy(policyNumber)` : GET `/api/v2/policies/{number}` + parse
  - `submitFnol(input)` : POST `/api/v2/claims` + payload AXA format
  - `fetchClaimStatus(claimId)` : GET `/api/v2/claims/{id}/status`
  - `submitDevisForApproval(input)` : POST `/api/v2/claims/{id}/devis-approval`
- Rate limiting : 100 req/min (per AXA documentation)
- Secrets : Atlas KMS storage `AXA_CLIENT_ID` + `AXA_CLIENT_SECRET` + `AXA_API_BASE_URL`
- Sandbox + Production env switch
- Tests 15+

**Pattern code `axa.connector.ts.fetchPolicy`** :
```typescript
async fetchPolicy(policyNumber: string): Promise<NormalizedPolicy> {
  return this.withCircuitBreaker(async () => {
    const token = await this.getValidToken();
    
    const response = await axios.get(
      `${this.config.baseUrl}/api/v2/policies/${policyNumber}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 5000
      }
    );

    const normalized = await this.normalizer.normalizePolicy('AXA', response.data);
    
    await this.auditOperation('fetchPolicy', true, {
      policyNumber: policyNumber,
      responseTimeMs: response.headers['x-response-time']
    });

    return normalized;
  });
}
```

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 1 axa connector (rest api + oauth2)

Task: 7.2.4
Decisions: api maturity tier 1"
```

---

### Tache 7.2.5 : TIER 1 -- Allianz Maroc connector

**Metadonnees** : P0 | 7h | Depend de : 7.2.4

**But** : Connecteur Allianz (Tier 1 -- API REST + OAuth2 partiel).

**Actions** : Pattern identique AXA, adapte API Allianz specifics.

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 1 allianz maroc connector

Task: 7.2.5"
```

---

### Tache 7.2.6 : TIER 1 -- Saham Assurance (Sanlam) connector

**Metadonnees** : P0 | 7h | Depend de : 7.2.5

**But** : Connecteur Saham (Tier 1 -- API REST + OAuth2 + sandbox).

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 1 saham connector (sanlam group)

Task: 7.2.6"
```

---

### Tache 7.2.7 : TIER 1 -- Sanad connector (groupe AXA)

**Metadonnees** : P0 | 6h | Depend de : 7.2.6

**But** : Connecteur Sanad (Tier 1 -- partage infrastructure AXA).

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 1 sanad connector (groupe axa)

Task: 7.2.7"
```

---

### Tache 7.2.8 : TIER 2 -- Wafa Assurance connector hybride (API + scraping)

**Metadonnees** : P0 | 12h | Depend de : 7.2.7

**But** : Connecteur Wafa (Tier 2 -- API partielle + portail web scraping pour endpoints manquants).

**Actions principales** :
- Service `wafa.connector.ts` extends `Tier2HybridConnector` :
  - **API partielle** : `fetchPolicy` + `fetchClaimStatus` via API
  - **Scraping web** : `submitFnol` + `submitDevisForApproval` via Playwright headless
- Setup Playwright dans Docker :
  ```dockerfile
  FROM mcr.microsoft.com/playwright:v1.42.0-jammy
  ```
- Workflow scraping :
  - Login portail Wafa (credentials Atlas KMS)
  - Session cookies cache 4h
  - Navigation + form filling + submit
  - Wait for confirmation page + extract result
  - Screenshot proof (audit ACAPS)
- Rate limiting : 10 req/min (lent scraping)
- Tests 12+ (incluant tests scraping E2E)

**Pattern code `wafa.connector.ts.submitFnol` (scraping)** :
```typescript
async submitFnol(input: FnolSubmissionInput): Promise<FnolResult> {
  return this.withCircuitBreaker(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: await this.getSessionState() // cached login
    });
    const page = await context.newPage();

    // Navigate to FNOL form
    await page.goto('https://portail.wafa-assurances.com/fnol/new');

    // Fill form
    await page.fill('input[name="policyNumber"]', input.policyNumber);
    await page.fill('textarea[name="description"]', input.description);
    await page.selectOption('select[name="type"]', input.type);

    // Upload photos
    for (const photoUrl of input.photosUrls) {
      const photoBuffer = await this.downloadPhoto(photoUrl);
      await page.setInputFiles('input[type="file"]', {
        name: 'photo.jpg',
        buffer: photoBuffer
      });
    }

    // Submit
    await page.click('button[type="submit"]');

    // Wait confirmation
    await page.waitForSelector('.confirmation-message', { timeout: 30000 });
    const claimId = await page.locator('.claim-id').textContent();

    // Screenshot proof
    const screenshot = await page.screenshot();
    await this.uploadAuditScreenshot(screenshot, `fnol-wafa-${claimId}`);

    await browser.close();

    return { claimId, carrier: 'WAFA', method: 'scraping' };
  });
}
```

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 2 wafa connector hybride api + scraping playwright

Task: 7.2.8
Decisions: api maturity tier 2 fallback strategy"
```

---

### Tache 7.2.9 : TIER 3 -- RMA Assurance connector (fallback email + manual)

**Metadonnees** : P0 | 8h | Depend de : 7.2.8

**But** : Connecteur RMA (Tier 3 -- pas d'API). Fallback : email + workflow manuel.

**Actions principales** :
- Service `rma.connector.ts` extends `Tier3FallbackConnector` :
  - `fetchPolicy` : pas dispo API -> verification manuelle via portail web (lazy lookup)
  - `submitFnol` : envoi email a `sinistres@rma-assurance.ma` avec PDF FNOL standardise + screenshot audit
  - `fetchClaimStatus` : pas dispo -> polling email replies + manual update broker_admin
  - `submitDevisForApproval` : envoi email avec devis PDF + tracking ID
- Generation PDF FNOL standardise (template Handlebars)
- Workflow asynchrone : ticket support cree -> broker_admin notifie -> follow-up manuel
- Tests 10+ (mock SMTP)

**Pattern code `rma.connector.ts.submitFnol`** :
```typescript
async submitFnol(input: FnolSubmissionInput): Promise<FnolResult> {
  return this.withCircuitBreaker(async () => {
    // 1. Generate FNOL PDF standardise
    const pdfBuffer = await this.pdfGenerator.generate('rma-fnol-template', input);
    
    // 2. Send email a RMA
    const trackingId = `RMA-FNOL-${Date.now()}`;
    await this.emailService.sendEmail({
      from: 'sinistres-broker@assurflow.ma',
      to: 'sinistres@rma-assurance.ma',
      cc: 'broker-admin@assurflow.ma',
      subject: `[Assurflow] FNOL ${trackingId} - Police ${input.policyNumber}`,
      body: `Bonjour,
      
Veuillez trouver ci-joint la declaration FNOL pour la police ${input.policyNumber}.

Tracking ID : ${trackingId}
Customer : ${input.customerName}
Date sinistre : ${input.sinistreDate}
Type : ${input.type}

Merci de nous repondre avec le numero de dossier officiel RMA.

Cordialement,
Assurflow Connectors`,
      attachments: [{ filename: 'FNOL.pdf', content: pdfBuffer }]
    });

    // 3. Create manual workflow ticket
    await this.workflowTicketsRepo.save({
      type: 'rma_fnol_manual_follow_up',
      trackingId,
      carrier: 'RMA',
      status: 'awaiting_carrier_reply',
      slaHours: 48,
      assignedToUserId: input.brokerAdminId
    });

    // 4. Audit
    await this.auditOperation('submitFnol', true, {
      trackingId,
      method: 'email_fallback',
      sla: '48h'
    });

    return { claimId: trackingId, carrier: 'RMA', method: 'email_fallback', status: 'awaiting_manual' };
  });
}
```

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 3 rma connector fallback email + manual workflow

Task: 7.2.9
Decisions: api maturity tier 3 pragmatic"
```

---

### Tache 7.2.10 : TIER 3 -- Atlanta Assurance connector

**Metadonnees** : P0 | 6h | Depend de : 7.2.9

**But** : Connecteur Atlanta (Tier 3 -- pattern identique RMA).

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 3 atlanta connector fallback

Task: 7.2.10"
```

---

### Tache 7.2.11 : TIER 3 -- MAMDA-MCMA connector

**Metadonnees** : P0 | 7h | Depend de : 7.2.10

**But** : Connecteur MAMDA (Tier 3 -- mutuelle pas d'API + workflow specifique secteur agricole).

**Actions** : Specificites MAMDA : assurances agricoles (recoltes + betail) -- adapter mapping types sinistres.

**Commit** :
```bash
git commit -m "feat(sprint-32): TIER 3 mamda-mcma connector fallback (specifique agricole)

Task: 7.2.11"
```

---

### Tache 7.2.12 : Carrier Connector Registry + service orchestration

**Metadonnees** : P0 | 5h | Depend de : 7.2.11

**But** : Registry central qui route les requests vers le bon connector selon carrier.

**Actions** :
- Service `carrier-connector-registry.service.ts` :
  - `register(carrierCode, connector)` -- bootstrap des 8 connectors
  - `getConnector(carrierCode)` -- retrieve connector instance
  - `routeRequest(carrierCode, operation, input)` -- dispatch
  - `getHealthStatus()` -- aggregate sante 8 connectors (circuit breaker states)
- Health endpoint `/api/v1/connectors/health` (carrier_admin only)
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): carrier connector registry + orchestration

Task: 7.2.12"
```

---

### Tache 7.2.13 : Audit ACAPS sync events + traceability

**Metadonnees** : P0 | 4h | Depend de : 7.2.12

**But** : Audit ACAPS centralise pour chaque sync/connect/disconnect/error event.

**Actions** :
- Migration ajout colonnes `compliance_acaps_audits.carrier_code` + `tier` + `operation_type` + `circuit_breaker_state`
- Service `carrier-connectors-audit.service.ts`
- Dashboard internal : sync events history per carrier
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-32): audit acaps sync events + traceability connectors

Task: 7.2.13"
```

---

### Tache 7.2.14 : Mock mode + sandbox/production switch

**Metadonnees** : P0 | 4h | Depend de : 7.2.13

**But** : Feature flag `MOCK_CARRIER_CONNECTORS=true` pour Sprint 21/24/26.5 testing + switch sandbox/production.

**Actions** :
- Mock connectors `repo/packages/carrier-connectors/src/connectors/mocks/` (1 per carrier reel)
- Config environnement : `CARRIER_ENV=sandbox|production`
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): mock mode + sandbox/production switch

Task: 7.2.14"
```

---

### Tache 7.2.15 : Endpoints REST internal + permissions carrier_admin

**Metadonnees** : P0 | 3h | Depend de : 7.2.14

**But** : Endpoints REST internes pour monitoring + admin connectors.

**Actions** :
- Controller `connectors.controller.ts` :
  - `GET /api/v1/connectors/health` -- health check 8 connectors
  - `GET /api/v1/connectors/metrics` -- Prometheus metrics
  - `POST /api/v1/connectors/{code}/test` -- ping test (admin)
  - `POST /api/v1/connectors/{code}/reset-circuit` -- reset circuit breaker (admin)
- Permission Sprint 7.5a : `carrier_admin.connectors.manage` (NOUVEAU permission, ajouter Sprint 7.5b update)
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-32): endpoints rest internal + permissions admin

Task: 7.2.15"
```

---

### Tache 7.2.16 : Monitoring Prometheus + Grafana + alertes

**Metadonnees** : P0 | 5h | Depend de : 7.2.15

**But** : Monitoring production Prometheus + Grafana + alertes Slack si circuit breaker open ou erreurs.

**Actions** :
- Metrics : `carrier_connector_request_total{carrier, operation, status}` + `carrier_connector_latency` + `circuit_breaker_state{carrier}`
- Grafana dashboard `carrier-connectors-monitoring.json`
- Alertes Slack `#connectors-alerts` : circuit open + error rate > 10%
- Tests 4+

**Commit** :
```bash
git commit -m "feat(sprint-32): monitoring prometheus + grafana + alertes connectors

Task: 7.2.16"
```

---

### Tache 7.2.17 : Documentation carrier-by-carrier

**Metadonnees** : P0 | 5h | Depend de : 7.2.16

**But** : Documentation complete pour chaque carrier (~150 lignes per carrier = 1200 lignes).

**Actions** :
- Docs `repo/docs/connectors/` (8 fichiers + overview) :
  - `overview.md` -- architecture 3 tiers + capabilities matrix
  - `axa.md` + `allianz.md` + `saham.md` + `sanad.md` -- Tier 1 specifics
  - `wafa.md` -- Tier 2 hybride
  - `rma.md` + `atlanta.md` + `mamda.md` -- Tier 3 fallback workflows
- Capabilities matrix actualisee selon evolution APIs Maroc

**Commit** :
```bash
git commit -m "docs(sprint-32): documentation carrier-by-carrier + matrix capabilities

Task: 7.2.17"
```

---

### Tache 7.2.18 : Tests E2E 50+ + integration tests + benchmarks

**Metadonnees** : P0 | 12h | Depend de : 7.2.17

**But** : Tests E2E 50+ scenarios + integration tests per connector + benchmarks performance.

**Actions** :
- Tests E2E happy path per carrier (8 carriers * 4 operations = 32 tests minimum)
- Tests circuit breaker (force errors -> verify open + reset)
- Tests rate limiting per carrier
- Tests data normalization (mapping correctness)
- Tests fallback Tier 3 (email + workflow ticket)
- Tests scraping Tier 2 Wafa (Playwright recorded scenarios)
- Benchmarks latence per carrier
- Mock VCR cassettes for replay tests
- Coverage Sprint 32 >= 85%

**Commit** :
```bash
git commit -m "test(sprint-32): tests e2e 50+ + integration + benchmarks 8 carriers

Task: 7.2.18
Sprint: 32 (Phase 7 / Sprint 2)"
```

---

## SYNTHESE -- Cloture Sprint 32 v3.0

```bash
# 18 commits Sprint 32
git log --since="3 weeks ago" --pretty=format:"%s" -- repo/packages/carrier-connectors | grep "Task: 7.2" | wc -l
# Attendu : 18

# 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/carrier-connectors --include="*.ts" --include="*.md" | wc -l
# Attendu : 0

# Lancer V-32
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md

# Si V-32 GO (>= 95%)
git tag -a "sprint-32-complete-v3-connecteurs-8-carriers" -m "Sprint 32 v3.0 Connecteurs InsurTech Maroc complete

- 8 carriers integres (4 Tier 1 + 1 Tier 2 + 3 Tier 3)
- Data normalization layer
- Circuit breakers + retry policies per carrier
- Fallback email + scraping Playwright
- Mock mode + sandbox/production
- 50+ tests E2E PASS"

git push origin sprint-32-complete-v3-connecteurs-8-carriers
```

---

## METRIQUES DE VALIDATION

| Metrique | Cible | Mesure |
|----------|-------|--------|
| 18 commits Sprint 32 | 18/18 | git log Task: 7.2.* |
| 8 carriers connectors | 8 | registry.size |
| Tier 1 (API REST) | 4 | AXA + Allianz + Saham + Sanad |
| Tier 2 (Hybride) | 1 | Wafa |
| Tier 3 (Fallback) | 3 | RMA + Atlanta + MAMDA |
| Data normalization mappers | 8 | normalizers/*.ts |
| Circuit breakers configures | 8 | per carrier config |
| Tests E2E | >= 50 | Playwright + Vitest |
| Coverage @insurtech/carrier-connectors | >= 85% | Vitest coverage |
| Grafana dashboard | Active | dashboards.json |

---

## CONFORMITE InsurTech Maroc v3.0

- **decision-008 data residency** : secrets Atlas KMS + audit ACAPS
- **API maturity reality check** : pragmatic strategy 3 tiers (vs ideal v2.2 homogene)
- **Audit ACAPS 10 ans** : tous events sync logged

---

## RISQUES + MITIGATIONS

1. **Wafa change portail web (scraping casse)** -> mitigation : detection visuelle + alerte broker_admin + fallback email
2. **Tier 3 SLA 48h depasse (carrier lent)** -> mitigation : escalade carrier_admin + Saad/Abla + alternative carrier suggestion
3. **API rate limit Tier 1 exceeded** -> mitigation : queue Kafka + retry exponential + circuit breaker
4. **Secrets carriers fuite** -> mitigation : Atlas KMS rotation 90j + audit access logs
5. **Normalisation mapping incorrect (data perdue)** -> mitigation : tests automatises per carrier + raw_response audit obligatoire

---

**Fin meta-prompt B-32 v3.0 -- Sprint 32 (7.2) REFONTE Connecteurs InsurTech Maroc 8 carriers.**

**Total taches** : 18 (10 v2.2 + 8 v3.0 nouvelles) | **Effort** : ~140h | **Apport** : 8 carriers integres avec strategie multi-tiers pragmatique
