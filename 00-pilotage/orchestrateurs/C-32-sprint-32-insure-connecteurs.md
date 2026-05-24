# ORCHESTRATEUR SPRINT 32 v3.0 -- Phase 7 / Sprint 2 : Connecteurs Insure 8 Carriers Maroc
# REFONTE v3.0 : 18 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (REFONTE complete v2.2 -- 8 carriers vs 4 carriers v2.2)
**Phase** : 7 -- Connecteurs + Integrations Carriers
**Sprint** : 32 / 40 (cumul v3.0)
**Reference meta-prompt** : `B-32-sprint-32-insure-connecteurs-v3.md`
**Reference verification** : `V-32-sprint-32-verification.md`
**Numerotation taches** : 7.2.1 a 7.2.18
**Effort total** : ~120 heures developpement / 2.5 semaines (vs 60h v2.2)
**Apport metier** : Couverture carriers Maroc ~85% marche (vs ~45% v2.2)

---

Tu es **Claude Code (ou Cowork)**. Execute **TOUTES les 18 taches** Sprint 32 v3.0 **UNE PAR UNE** dans l'ordre, puis lance V-32.

**Cet orchestrateur extrait le contenu detaille depuis B-32 v3.0** -- pour patterns code @insurtech/insure-connector + 8 implementations carriers + Circuit Breaker + reconciliation + monitoring, lire B-32 dans chaque tache.

**REFONTE STRATEGIQUE v3.0** :
- 8 carriers vs 4 v2.2 (decouverte realite ecosystem Maroc Saad terrain)
- Strategy multi-tiers :
  - **Tier 1** : 4 carriers API REST native modern (AXA + Allianz + Saham + Sanad)
  - **Tier 2** : 1 carrier hybrid API + scraping (Wafa Assurance)
  - **Tier 3** : 3 carriers fallback email + manual queue (RMA + Atlanta + MAMDA)
- Reconciliation nightly + alerting per-carrier
- Circuit Breaker + retry exponentiel + dead-letter queue
- Couverture marche estimee : ~85% sinistres auto Maroc

---

## OBJECTIF DU SPRINT 32 v3.0

Sprint 32 (7.2) -- Connecteurs Insure 8 carriers Maroc. Voir B-32 v3.0 pour contexte detaille.

Module package @insurtech/insure-connector avec :
- Interface commune `ICarrierConnector` (15+ methodes)
- 8 implementations carriers specifiques (heritage Strategy pattern)
- Capability discovery par carrier (savoir quelles operations sont supportees)
- Fallback automatique Tier 1 -> Tier 2 -> Tier 3 si carrier degraded
- Reconciliation diff Maroc carrier daily + alerting
- Audit ACAPS chaque appel external API
- Monitoring per-carrier (latency + success_rate + error_rate)

---

## CONNECTEURS 8 CARRIERS DETAILLES

### Tier 1 -- API REST native modern (4 carriers, ~50% marche)
1. **AXA Assurance Maroc** -- API REST + OAuth 2.0 + JSON + webhooks
2. **Allianz Maroc** -- API REST + JWT + JSON + polling
3. **Saham Assurance** -- API REST + API Key + JSON + webhooks
4. **Sanad Assurance** -- API REST + Basic Auth + JSON + polling

### Tier 2 -- Hybrid API REST + scraping (1 carrier, ~15% marche)
5. **Wafa Assurance** -- API partielle (devis OK + recovery email) + scraping Puppeteer broker portal (status sinistres / paiements)

### Tier 3 -- Fallback email + manual queue (3 carriers, ~20% marche)
6. **RMA Assurance** -- 100% email + IMAP parsing replies + manual queue broker_admin
7. **Atlanta Assurance** -- Email + fax automated + manual queue
8. **MAMDA Mutuelle** -- Cooperative ancienne, 100% manual queue + email

**Couverture totale** : ~85% sinistres auto Maroc -- vs ~45% v2.2 (4 carriers seulement)

---

## STRUCTURE DES FICHIERS

```
skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/
  task-7.2.1-prompt.md   # Package @insurtech/insure-connector + interface commune
  task-7.2.2-prompt.md   # Base abstract class CarrierConnectorBase + Circuit Breaker + retry
  task-7.2.3-prompt.md   # Capability discovery + registry per carrier
  task-7.2.4-prompt.md   # Connecteur AXA (Tier 1) -- OAuth 2.0 + webhooks
  task-7.2.5-prompt.md   # Connecteur Allianz (Tier 1) -- JWT + polling
  task-7.2.6-prompt.md   # Connecteur Saham (Tier 1) -- API Key + webhooks
  task-7.2.7-prompt.md   # Connecteur Sanad (Tier 1) -- Basic Auth + polling
  task-7.2.8-prompt.md   # NOUVEAU Connecteur Wafa (Tier 2) -- Hybrid API + Puppeteer
  task-7.2.9-prompt.md   # NOUVEAU Connecteur RMA (Tier 3) -- Email + IMAP parsing
  task-7.2.10-prompt.md  # NOUVEAU Connecteur Atlanta (Tier 3) -- Email + fax automated
  task-7.2.11-prompt.md  # NOUVEAU Connecteur MAMDA (Tier 3) -- Manual queue + email
  task-7.2.12-prompt.md  # Connector factory + selection logic per carrier
  task-7.2.13-prompt.md  # NOUVEAU Fallback automatique degraded carriers
  task-7.2.14-prompt.md  # Reconciliation nightly cron + diff alerts
  task-7.2.15-prompt.md  # Audit ACAPS toutes API calls + retention 10 ans
  task-7.2.16-prompt.md  # Monitoring per-carrier dashboard + Grafana
  task-7.2.17-prompt.md  # NOUVEAU Manual queue broker_admin (Tier 3 carriers)
  task-7.2.18-prompt.md  # Tests E2E + simulation 8 carriers + chaos engineering
```

**Verification** : `V-32-sprint-32-verification.md`
**Decisions cles** : 012 (ecosystem 6 acteurs) + 015 (Demo Day 30 juin) + Sprint 14 Insure dependency

---

## REGLES D'EXECUTION CRITIQUES

Sequentielle obligatoire (compile + tests + lint + commit avant tache suivante).

### Si une tache echoue : 3 tentatives reparation puis FAIL + continuer.

### Verification finale : V-32 automatique apres 18 taches.

---

## REGLES ABSOLUES skalean-insurtech v3.0

**Specifique Sprint 32 v3.0** :
- **Package @insurtech/insure-connector** (NOUVEAU v3.0) -- abstrait integrations carriers
- **Strategy Pattern + Factory** : `ICarrierConnector` interface + 8 implementations + `CarrierConnectorFactory.create(carrierId)`
- **Circuit Breaker** : `opossum` library -- ouvre apres 5 erreurs consecutives, half-open apres 30s
- **Retry exponentiel** : 3 tentatives (1s + 2s + 4s) avec jitter
- **Dead-letter queue** : Kafka topic `insurtech.dlq.carrier-calls` pour replays manuels
- **Reconciliation nightly** : cron 02:00 Maroc -- diff carrier official vs local DB + alert > 5% gap
- **Audit ACAPS** : every API call logged (carrier_id + endpoint + method + request_hash + response_hash + status + duration) -- 10 ans retention
- **Capability discovery** : table `insure_carrier_capabilities` (carrier_id + capability_name + supported boolean + notes)
- **Manual queue** (Tier 3) : interface broker_admin web pour traiter sinistres manuels avec form structure standard
- **Style code** : Sprint 7.5a permissions `carrier.*` reutilisees -- jamais redefinir
- **Monitoring Prometheus** : metrics per-carrier exposes `/metrics` endpoint Sprint 6
- **Webhooks securises** : signature HMAC verification + IP allowlist

---

## CONTEXTE PHASE 7 -- Connecteurs + Integrations Carriers

Sprint 32 (7.2) -- **Connecteurs Insure 8 carriers Maroc** -- suit Sprint 31 (Connecteurs Garages) et precede Sprint 33 (Connecteurs Experts).

### Modules concernes

`@insurtech/insure-connector` (NOUVEAU package v3.0), `@insurtech/insure` (Sprint 14 consume), `apps/api/src/modules/connectors/`, Kafka topics, Prometheus.

### Apport metier

Couverture marche carriers Maroc ~85% (vs ~45% v2.2) + resilience (Circuit Breaker + fallback Tier 1 -> 2 -> 3) + audit complet ACAPS + reconciliation automatique. **Foundation Demo Day 30 juin 2026** -- sans Sprint 32, pas de demo end-to-end realistic avec carriers reels.

---

## EXECUTION SEQUENTIELLE DES 18 TACHES

---

### Tache 1 / 18 : Package @insurtech/insure-connector + interface commune

**Metadonnees** : P0 | 5h | Depend de : Sprint 14 (Insure Module)

**But** : Bootstrap package @insurtech/insure-connector avec interface commune ICarrierConnector + 15+ methodes standardisees.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.2.1-prompt.md
```

**Actions principales attendues** :
- Dossier `repo/packages/insure-connector/`
- Interface `ICarrierConnector` avec methodes :
  - `getQuote(input)` -- devis prime
  - `subscribePolicy(input)` -- souscription
  - `getPolicyStatus(policyId)` -- status police
  - `cancelPolicy(policyId, reason)` -- resiliation
  - `submitFnol(input)` -- declaration sinistre
  - `getSinistreStatus(sinistreId)` -- status sinistre
  - `validateExpertReport(input)` -- validation rapport expert
  - `approveDevis(input)` -- approbation devis garage
  - `triggerPayment(input)` -- declenchement paiement
  - `getPaymentStatus(paymentId)`
  - `listClaimsHistory(policyId)`
  - `checkCoverage(policyId, sinistreType)`
  - `getReimbursementLimits(policyId)`
  - `subscribeWebhook(event, url)`
  - `healthCheck()` -- ping carrier API
- Types `carrier.types.ts` (CarrierIdEnum + 8 valeurs)
- Schemas Zod validation per methode
- Tests interface 4+

**Fichiers cibles principaux** :
- `repo/packages/insure-connector/package.json`
- `repo/packages/insure-connector/src/interfaces/ICarrierConnector.ts`
- `repo/packages/insure-connector/src/types/carrier.types.ts`
- `repo/packages/insure-connector/src/index.ts`

**Criteres P0 cles** :
- V1 (P0) : Package @insurtech/insure-connector cree
- V2 (P0) : Interface 15+ methodes definies
- V3 (P0) : 8 carriers enum
- V4 (P0) : TypeScript strict OK

**Commit** :
```bash
git commit -m "feat(sprint-32): package @insurtech/insure-connector + interface commune 15 methodes

Task: 7.2.1
Sprint: 32 (Phase 7 / Sprint 2)
Phase: 7 -- Connecteurs + Integrations Carriers
Decisions: decision-012 + decision-015 demo day"
```

---

### Tache 2 / 18 : Base abstract class CarrierConnectorBase + Circuit Breaker + retry

**Metadonnees** : P0 | 6h | Depend de : 7.2.1

**But** : Classe abstraite parente avec Circuit Breaker + retry exponentiel + dead-letter queue + audit ACAPS.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.2.2-prompt.md
```

**Actions principales attendues** :
- Classe `CarrierConnectorBase` (abstract) avec :
  - Circuit Breaker config (opossum library : timeout 10s + errorThresholdPercentage 50% + resetTimeout 30s)
  - Method `executeWithResilience<T>(operation, fallback?)` -- wraps Circuit Breaker + retry
  - Retry config : 3 tentatives avec backoff exponentiel (1s + 2s + 4s) + jitter
  - Dead-letter queue : si toutes tentatives echouent, publish Kafka `insurtech.dlq.carrier-calls`
  - Audit ACAPS : log every call via `acapsAuditService.logCarrierCall()` -- carrier_id + endpoint + method + request_hash + response_hash + status + duration_ms
- Tests 10+

**Fichiers cibles principaux** :
- `repo/packages/insure-connector/src/base/CarrierConnectorBase.ts`
- `repo/packages/insure-connector/src/circuit-breaker/CircuitBreakerConfig.ts`
- `repo/packages/insure-connector/src/audit/CarrierAuditLogger.ts`

**Criteres P0 cles** :
- V1 (P0) : CarrierConnectorBase abstract class
- V2 (P0) : Circuit Breaker opossum configure
- V3 (P0) : Retry exponentiel 3 tentatives
- V4 (P0) : Dead-letter queue Kafka publish
- V5 (P0) : Audit ACAPS log every call

**Commit** :
```bash
git commit -m "feat(sprint-32): base abstract class + circuit breaker + retry + dlq + audit acaps

Task: 7.2.2"
```

---

### Tache 3 / 18 : Capability discovery + registry per carrier

**Metadonnees** : P0 | 4h | Depend de : 7.2.2

**But** : Service capability discovery + table `insure_carrier_capabilities` -- savoir quelles operations sont supportees par chaque carrier.

**Actions** :
- Migration `1735000000NNN-CreateInsureCarrierCapabilities.ts` -- table avec `carrier_id`, `capability_name`, `supported boolean`, `tier (1/2/3)`, `notes`, `last_verified_at`
- Service `carrier-capability.service.ts` :
  - `getCapabilities(carrierId)` -- retourne map capabilities
  - `isSupported(carrierId, capability)` -- check rapide
  - `updateCapability(carrierId, capability, supported, notes)` -- maintenance
- Seeds initiales 8 carriers x 15 capabilities = 120 entries
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): capability discovery + registry 120 entries 8 carriers

Task: 7.2.3"
```

---

### Tache 4 / 18 : Connecteur AXA (Tier 1) -- OAuth 2.0 + webhooks

**Metadonnees** : P0 | 7h | Depend de : 7.2.3

**But** : Implementation `AXAConnector extends CarrierConnectorBase` -- API REST AXA Maroc + OAuth 2.0 + webhooks signature HMAC.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.2.4-prompt.md
```

**Actions principales** :
- Classe `AXAConnector` :
  - OAuth 2.0 client credentials flow -- tokens cached + refresh 1h avant expiration
  - 15+ methodes implementees AXA REST API
  - Webhook handler `/api/v1/connectors/axa/webhook` avec HMAC signature verify + IP allowlist
  - Events recus : policy.subscribed + fnol.acknowledged + sinistre.status_changed + payment.completed
- Service `axa-webhook-handler.service.ts.processWebhook(payload, signature)`
- Tests 12+ (mocks AXA API)

**Criteres P0 cles** :
- V1 (P0) : AXAConnector implements ICarrierConnector
- V2 (P0) : OAuth 2.0 token refresh
- V3 (P0) : Webhook HMAC verification
- V4 (P0) : 15+ methodes coverage

**Commit** :
```bash
git commit -m "feat(sprint-32): connecteur axa tier 1 oauth 2.0 + webhooks hmac

Task: 7.2.4
Decisions: tier 1 api rest native carriers modernes"
```

---

### Tache 5 / 18 : Connecteur Allianz (Tier 1) -- JWT + polling

**Metadonnees** : P0 | 7h | Depend de : 7.2.4

**But** : `AllianzConnector` -- API Allianz Maroc + JWT auth + polling (pas de webhooks).

**Actions** :
- JWT auth header `Authorization: Bearer <token>` -- token renewal cron 30 min
- Polling service `allianz-polling.service.ts` cron 5 min check status changes
- 15+ methodes Allianz REST
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-32): connecteur allianz tier 1 jwt + polling

Task: 7.2.5"
```

---

### Tache 6 / 18 : Connecteur Saham (Tier 1) -- API Key + webhooks

**Metadonnees** : P0 | 7h | Depend de : 7.2.5

**But** : `SahamConnector` -- API Saham + API Key header + webhooks.

**Actions** :
- API Key static header `X-Saham-Api-Key`
- Webhooks Saham (similar AXA mais signature differente -- proprietary SHA1 base64)
- 15+ methodes Saham REST
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-32): connecteur saham tier 1 api key + webhooks

Task: 7.2.6"
```

---

### Tache 7 / 18 : Connecteur Sanad (Tier 1) -- Basic Auth + polling

**Metadonnees** : P0 | 7h | Depend de : 7.2.6

**But** : `SanadConnector` -- API Sanad + Basic Auth + polling.

**Actions** :
- Basic Auth (username:password base64)
- Polling cron 10 min
- 15+ methodes Sanad REST
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-32): connecteur sanad tier 1 basic auth + polling

Task: 7.2.7"
```

---

### Tache 8 / 18 : NOUVEAU Connecteur Wafa (Tier 2) -- Hybrid API + Puppeteer

**Metadonnees** : P0 | 10h | Depend de : 7.2.7

**But** : **NOUVEAU v3.0** -- `WafaConnector` -- API partielle (devis + paiements) + Puppeteer scraping broker portal (status sinistres).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.2.8-prompt.md
```

**Actions principales** :
- API Wafa partielle :
  - `getQuote()` + `subscribePolicy()` + `getPaymentStatus()` -- via API REST
- Puppeteer scraping :
  - Login broker portal Wafa Assurance (credentials secrets vault)
  - Navigation pages : `/sinistres/list?filter=...` + parsing HTML
  - Cache HTML responses 5 min (eviter overhead)
  - User-Agent headers realistic + cookies session
  - Re-login automatique si session expire
- Service `wafa-scraper.service.ts.scrapeSinistreStatus(sinistreId)`
- Anti-detection : random delays + viewport rotation
- Audit ACAPS pour chaque scrape (legal scraping consenti via convention partenariat)
- Tests 10+ avec html mocks

**Criteres P0 cles** :
- V1 (P0) : API REST partielle Wafa
- V2 (P0) : Puppeteer scraping fonctionnel
- V3 (P0) : Anti-detection delays + user-agent
- V4 (P0) : Re-login session expired

**Commit** :
```bash
git commit -m "feat(sprint-32): NOUVEAU connecteur wafa tier 2 hybrid api + puppeteer scraping

Task: 7.2.8
Decisions: tier 2 hybrid degraded carrier"
```

---

### Tache 9 / 18 : NOUVEAU Connecteur RMA (Tier 3) -- Email + IMAP parsing

**Metadonnees** : P0 | 8h | Depend de : 7.2.8

**But** : **NOUVEAU v3.0** -- `RMAConnector` -- 100% email + IMAP parsing replies + manual queue broker_admin.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.2.9-prompt.md
```

**Actions principales** :
- Operations via email :
  - `submitFnol()` -> compose email template structure RMA + send via Sprint 9 Comm + ticket id reply
  - `getSinistreStatus()` -> IMAP fetch replies from `sinistres@rma.ma` + parse + update local DB
- IMAP client `imap-simple` library connect `imap.rma.ma`
- Email parser regex extract sinistre_id + status + amount_approved
- Service `rma-imap-parser.service.ts.parseRmaReplyEmail(rawEmail)` -> structured data
- Cron 15 min check IMAP replies
- Fallback manual queue si parsing echoue
- Tests 10+

**Criteres P0 cles** :
- V1 (P0) : Email submitFnol structure RMA
- V2 (P0) : IMAP parser replies
- V3 (P0) : Cron 15 min fetch
- V4 (P0) : Fallback manual queue si parsing FAIL

**Commit** :
```bash
git commit -m "feat(sprint-32): NOUVEAU connecteur rma tier 3 email + imap parsing

Task: 7.2.9
Decisions: tier 3 fallback email manual queue"
```

---

### Tache 10 / 18 : NOUVEAU Connecteur Atlanta (Tier 3) -- Email + fax automated

**Metadonnees** : P0 | 7h | Depend de : 7.2.9

**But** : **NOUVEAU v3.0** -- `AtlantaConnector` -- email + fax automated + manual queue.

**Actions** :
- Email submit operations
- Fax automated via service eFax API ou Twilio Fax (legacy Atlanta encore fax-driven)
- Manual queue pour replies non-parsables
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): NOUVEAU connecteur atlanta tier 3 email + fax automated

Task: 7.2.10"
```

---

### Tache 11 / 18 : NOUVEAU Connecteur MAMDA (Tier 3) -- Manual queue + email

**Metadonnees** : P0 | 6h | Depend de : 7.2.10

**But** : **NOUVEAU v3.0** -- `MAMDAConnector` -- cooperative ancienne, 100% manual queue + email notification simple.

**Actions** :
- Email notification simple (pas de parsing replies)
- 100% sinistres en manual queue broker_admin web interface (Tache 7.2.17)
- SLA traitement manuel : 48h moyenne
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-32): NOUVEAU connecteur mamda tier 3 manual queue + email simple

Task: 7.2.11"
```

---

### Tache 12 / 18 : Connector factory + selection logic

**Metadonnees** : P0 | 4h | Depend de : 7.2.11

**But** : `CarrierConnectorFactory.create(carrierId)` -- factory pattern + capability-aware routing.

**Actions** :
- Factory class avec switch case 8 carriers
- DI container registration (Nest.js)
- Service `carrier-routing.service.ts.selectCarrierForOperation(operation, fallbackChain)` -- check capability + Circuit Breaker status
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): connector factory + selection logic 8 carriers

Task: 7.2.12"
```

---

### Tache 13 / 18 : NOUVEAU Fallback automatique degraded carriers

**Metadonnees** : P0 | 6h | Depend de : 7.2.12

**But** : **NOUVEAU v3.0** -- Logic fallback : si carrier Tier 1 down (Circuit Breaker open), fallback Tier 2 ou Tier 3 selon capability + alerting Sentry.

**Actions** :
- Service `carrier-fallback.service.ts.executeFallback(operation, primaryCarrier)`
- Strategy : retry primary 3x -> Circuit Breaker open -> fallback Tier 2 si capability supported -> fallback Tier 3 manual
- Alerting Sentry severity critical si fallback trigger
- Dashboard Grafana panel "Fallback events per hour"
- Tests 8+

**Criteres P0 cles** :
- V1 (P0) : Fallback Tier 1 -> Tier 2 fonctionnel
- V2 (P0) : Fallback Tier 2 -> Tier 3 manual queue
- V3 (P0) : Alerting Sentry on fallback

**Commit** :
```bash
git commit -m "feat(sprint-32): NOUVEAU fallback automatique degraded carriers + alerting

Task: 7.2.13"
```

---

### Tache 14 / 18 : Reconciliation nightly cron + diff alerts

**Metadonnees** : P0 | 6h | Depend de : 7.2.13

**But** : Cron 02:00 Maroc -- reconciliation diff carrier official vs local DB + alert > 5% gap.

**Actions** :
- Cron NestJS `@Cron('0 2 * * *')` `carrier-reconciliation.service.ts.runNightlyReconciliation()`
- Per carrier : fetch official records derniere 24h + diff local DB + log discrepancies
- Threshold alert : > 5% gap -> email/Slack ops team
- Report quotidien dans table `insure_carrier_reconciliation_reports`
- Permission Sprint 7.5a `carrier.admin.audit`
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-32): reconciliation nightly cron + diff alerts > 5%

Task: 7.2.14
Decisions: data integrity ops critical"
```

---

### Tache 15 / 18 : Audit ACAPS toutes API calls + retention 10 ans

**Metadonnees** : P0 | 4h | Depend de : 7.2.14

**But** : Service `carrier-audit-logger.service.ts.logCarrierCall()` -- log every external API call to ACAPS audit table (heritage Sprint 4).

**Actions** :
- Extension `compliance_acaps_audits` colonnes : `carrier_id`, `endpoint`, `http_method`, `request_hash`, `response_hash`, `http_status`, `duration_ms`
- Tous connecteurs CarrierConnectorBase log automatique
- Retention 10 ans (loi ACAPS)
- Endpoint admin `GET /api/v1/connectors/audit/search` permission `carrier.admin.audit`
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-32): audit acaps carrier api calls + retention 10 ans

Task: 7.2.15
Decisions: loi acaps audit retention"
```

---

### Tache 16 / 18 : Monitoring per-carrier dashboard + Grafana

**Metadonnees** : P0 | 5h | Depend de : 7.2.15

**But** : Metrics Prometheus per-carrier expose + Grafana dashboard "Carrier Health".

**Actions** :
- Metrics Prometheus :
  - `carrier_api_calls_total{carrier_id, method, status}` -- counter
  - `carrier_api_duration_seconds{carrier_id, method}` -- histogram
  - `carrier_circuit_breaker_state{carrier_id}` -- gauge (0=closed, 1=open, 0.5=half-open)
  - `carrier_fallback_events_total{from_carrier, to_carrier}` -- counter
- Dashboard Grafana JSON `infrastructure/grafana/dashboards/carrier-health.json`
- 8 panels (1 per carrier) + global overview
- Tests 5+

**Commit** :
```bash
git commit -m "feat(sprint-32): monitoring per-carrier prometheus + grafana dashboard

Task: 7.2.16"
```

---

### Tache 17 / 18 : NOUVEAU Manual queue broker_admin (Tier 3 carriers)

**Metadonnees** : P0 | 8h | Depend de : 7.2.16

**But** : **NOUVEAU v3.0** -- Interface web broker_admin pour traiter sinistres manuels Tier 3 carriers (RMA + Atlanta + MAMDA).

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-32-insure-connecteurs/task-7.2.17-prompt.md
```

**Actions principales** :
- Page `web-broker-app/app/admin/manual-queue/page.tsx` :
  - Liste sinistres en attente traitement manuel (filter par carrier Tier 3)
  - Form structure : champ par champ (sinistre_id + carrier_response_status + amount_approved + notes)
  - Bouton "Traiter sinistre" -> update local DB + close queue item
  - SLA tracker : afficher temps depuis queue creation (alert si > 48h)
- Service `manual-queue.service.ts` :
  - `listPendingItems(brokerTenantId, carrierIdFilter?)`
  - `processItem(itemId, carrierResponse)` -- update + audit log
  - `getQueueStats(brokerTenantId)` -- KPIs avg time, count pending
- Permission Sprint 7.5a `carrier.manual_queue.process`
- Tests 10+

**Criteres P0 cles** :
- V1 (P0) : Liste queue items filterable
- V2 (P0) : Form traitement structure
- V3 (P0) : SLA tracker 48h alert
- V4 (P0) : Permission enforce

**Commit** :
```bash
git commit -m "feat(sprint-32): NOUVEAU manual queue broker admin tier 3 carriers

Task: 7.2.17
Decisions: tier 3 fallback humain"
```

---

### Tache 18 / 18 : Tests E2E + simulation 8 carriers + chaos engineering

**Metadonnees** : P0 | 12h | Depend de : 7.2.17

**But** : Tests E2E + simulation 8 carriers (mocks API REST + scraping HTML mocks + email mocks) + chaos engineering (kill carriers + verify fallback).

**Actions** :
- Tests E2E happy path 8 carriers : submitFnol -> getSinistreStatus -> approveDevis
- Mocks WireMock pour API REST carriers (AXA + Allianz + Saham + Sanad)
- HTML mocks Wafa scraping (fixtures fichiers)
- Email mocks IMAP RMA (raw emails fixtures)
- Chaos engineering tests :
  - Tier 1 carrier down -> verify fallback Tier 2/3
  - Circuit Breaker trip -> verify reset after 30s
  - Reconciliation > 5% gap -> verify alerting
- Benchmarks latency P95 < 3s per carrier
- Coverage Sprint 32 >= 85%

**Criteres P0 cles** :
- V1 (P0) : Tests E2E 8 carriers PASS
- V2 (P0) : Chaos tests fallback verified
- V3 (P0) : Coverage >= 85%
- V4 (P0) : Benchmarks P95 < 3s

**Commit** :
```bash
git commit -m "test(sprint-32): tests e2e + simulation 8 carriers + chaos engineering

Task: 7.2.18
Sprint: 32 (Phase 7 / Sprint 2)
Decisions: production readiness demo day 30 juin"
```

---

## SYNTHESE -- Cloture Sprint 32 v3.0

```bash
# 18 commits Sprint 32
git log --since="2.5 weeks ago" --pretty=format:"%s" -- repo/packages/insure-connector | grep "Task: 7.2" | wc -l
# Attendu : 18

# 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/insure-connector --include="*.ts" --include="*.md" | wc -l
# Attendu : 0

# Lancer V-32
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md

# Si V-32 GO (>= 95%)
git tag -a "sprint-32-complete-v3-connecteurs-8-carriers" -m "Sprint 32 v3.0 Connecteurs 8 carriers Maroc complete

- 8 carriers couverture ~85% marche
- Tier 1 (4 carriers): AXA + Allianz + Saham + Sanad
- Tier 2 (1 carrier): Wafa hybrid API + scraping
- Tier 3 (3 carriers): RMA + Atlanta + MAMDA email + manual queue
- Circuit Breaker + retry + DLQ + reconciliation + audit ACAPS 10 ans
- Manual queue broker_admin web + monitoring Grafana
- Foundation Demo Day 30 juin 2026"

git push origin sprint-32-complete-v3-connecteurs-8-carriers
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 32 v3.0]
   |
   v
[Tache 7.2.1 : Package + interface 15 methodes]
   |
   v
[Tache 7.2.2 : Base + Circuit Breaker + retry + DLQ]
   |
   v
[Tache 7.2.3 : Capability discovery + 120 entries]
   |
   v
[Taches 7.2.4-7 : Tier 1 connecteurs (AXA + Allianz + Saham + Sanad)]
   |
   v
[Tache 7.2.8 : NOUVEAU Tier 2 Wafa hybrid + Puppeteer]
   |
   v
[Taches 7.2.9-11 : NOUVEAUX Tier 3 (RMA + Atlanta + MAMDA)]
   |
   v
[Tache 7.2.12 : Factory + selection logic]
   |
   v
[Tache 7.2.13 : NOUVEAU Fallback automatique]
   |
   v
[Tache 7.2.14 : Reconciliation nightly cron]
   |
   v
[Tache 7.2.15 : Audit ACAPS 10 ans]
   |
   v
[Tache 7.2.16 : Monitoring Grafana]
   |
   v
[Tache 7.2.17 : NOUVEAU Manual queue broker_admin Tier 3]
   |
   v
[Tache 7.2.18 : Tests E2E + simulation 8 carriers + chaos]
   |
   v
[V-32 verification]
   |
   v
[Score >= 95%] -> GO -> tag -> Sprint 33 demarre (Experts)
```

**Duree totale** : 120 heures / 2.5 semaines.

**Modules affectes** : `@insurtech/insure-connector` (NOUVEAU package), `apps/api/src/modules/connectors/`, `apps/web-broker-app/app/admin/manual-queue/`, Kafka topics DLQ + reconciliation, Prometheus + Grafana.

**Apport metier principal** : Couverture ~85% marche carriers Maroc + resilience production-grade + audit complet ACAPS + Demo Day 30 juin foundation.

**Sprint suivant** : Sprint 33 Connecteurs Experts.

---

## COMMANDES DE LANCEMENT

### Prerequis (Sprint 14 + 31 GO)
```bash
ls skalean-insurtech/sprint14-verify-report.md skalean-insurtech/sprint31-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint14-verify-report.md skalean-insurtech/sprint31-verify-report.md
```

### Lancement Sprint 32
```bash
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-32-sprint-32-insure-connecteurs-v3.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-32-sprint-32-insure-connecteurs-v3.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-32-sprint-32-verification.md
```

### Suivi temps reel
```bash
# Logs connecteurs API
cd repo/apps/api && pnpm dev

# Grafana local
docker-compose up grafana

# Progress commits
git log --oneline --since="2.5 weeks ago" -- repo/packages/insure-connector | grep "Sprint: 32"
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire B-32 v3.0 complet** AVANT generation prompts (patterns 8 carriers + Puppeteer + IMAP + Circuit Breaker specifiques)
2. **Tier 1 ~50% marche** : prioriser AXA + Allianz + Saham + Sanad (Tier 1) avant Tier 2/3
3. **Tier 2 Wafa** : Puppeteer scraping necessite convention partenariat legal (verifier avec Saad avant scraping)
4. **Tier 3 carriers** : 100% manual queue Tache 7.2.17 critique pour business continuity
5. **Reconciliation > 5% gap** : alerte critical -- pas optionnel pour audit ACAPS
6. **Manual queue SLA 48h** : verifier alerting team broker_admin operationnel
7. **Demo Day 30 juin** : si delai Sprint 32, scope reduit possible (4 Tier 1 only sans Tier 2/3) = decision Saad/Abla
8. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/

---

**Fin orchestrateur C-32 v3.0 -- Sprint 32 (7.2) REFONTE Connecteurs Insure 8 carriers Maroc.**

**Total taches** : 18 (4 Tier 1 v2.2 adaptees + 14 v3.0 nouvelles) | **Effort** : ~120h | **Apport** : ~85% couverture marche carriers Maroc
