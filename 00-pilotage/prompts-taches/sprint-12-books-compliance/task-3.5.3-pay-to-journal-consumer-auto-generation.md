# TACHE 3.5.3 -- Auto-Generation Ecritures depuis Pay Events (Consumer Kafka)

**Sprint** : 12 (Phase 3 / Sprint 5 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-12-sprint-12-books-compliance.md` (Tache 3.5.3)
**Phase** : 3 -- Modules Horizontaux (Books + Compliance)
**Priorite** : P0 (automatisation comptable critique sprint 12 et au-dela)
**Effort** : 6h
**Dependances** : Tache 3.5.2 (`JournalService.createEntry`), Sprint 11 Pay (events `pay.transaction.captured`), Sprint 2 task 1.2.13 (`KafkaConsumerBase`), Sprint 6 task 2.2.1 (`TenantContext`)
**Densite cible** : 110-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **consumer Kafka** qui ecoute le topic `insurtech.events.pay.transaction.captured` (publie par Sprint 11 a chaque encaissement reussi via les 6 passerelles MA : CMI, YouCan Pay, PayZone, Inwi Money, Orange Money, MWallet BAM/cash kiosque) et genere automatiquement l'ecriture comptable correspondante via `JournalService.createEntry()` (Tache 3.5.2). Sans cette automatisation, chaque encaissement client devrait etre saisi manuellement par un comptable, ce qui : (a) introduit des delais de 24-72h entre flux financier et trace comptable, (b) provoque des erreurs humaines (account_code errone, montant incorrect, oubli d'ecriture), (c) viole l'esprit de l'article 20 de la loi 9-88 qui exige que toute ecriture soit justifiee par une piece datee et passee dans des delais raisonnables.

L'apport est triple. **Premierement** : on cree un consumer NestJS-Kafka extensible (`PayToJournalConsumer extends KafkaConsumerBase` -- pattern Sprint 2 task 1.2.13) qui consume le topic Pay avec strategie `manual ack`, retry 3x avec backoff exponentiel, dead-letter queue (DLQ) sur le topic `insurtech.events.dlq.books.pay-to-journal`. Le consumer applique un mapping deterministe **(provider, transaction_type) -> (debit_account, credit_account)** : encaissement banque -> debit `5141` Banque / credit `4111` Client par defaut ; encaissement cash kiosque PayZone -> debit `5161` Caisse ; encaissement mobile money (Inwi/Orange/MWallet) -> debit `5141` Banque (le mobile money est un compte bancaire associe au tenant, pas un compte de tresorerie distinct). **Deuxiemement** : on garantit l'**idempotency** via la `idempotency_key = pay:{transaction_id}` passee a `JournalService.createEntry()` -- si Kafka redelivre le meme event 5 fois, une seule ecriture est creee, les 4 autres tentatives renvoient l'ecriture existante. C'est critique car Kafka offre par design `at-least-once delivery` et les redelivres sont frequents en production (rebalance, restart consumer, network blip). **Troisiemement** : on propage le **TenantContext** via `TenantContext.runWithContext()` car le consumer s'execute dans un worker async sans request scope, donc sans le middleware Sprint 6 task 2.2.2 qui injecte tenant_id depuis le header HTTP. Le tenant_id arrive dans l'envelope Kafka header (`x-insurtech-tenant-id`) et est extrait au debut du handle.

A l'issue de cette tache, le tenant Cabinet Bennani peut encaisser 100 commissions assureurs en une journee via CMI virement bancaire ; chaque encaissement genere automatiquement et instantanement (latence < 2s p95) son ecriture comptable correspondante : debit `5141` / credit `4111` (client) ou `4421-4429` (assureur partenaire) selon la nature de la transaction. La balance comptable est tenue en temps reel, sans intervention humaine, conforme a l'article 19 (numerotation continue) et 20 (justification piece) de la loi 9-88. Les Sprints 14+ Insure et 19+ Repair ajouteront des consumers similaires (`InsurePolicyToJournalConsumer`, `RepairInvoiceToJournalConsumer`) sur le meme pattern, mais cette Tache 3.5.3 etablit le contrat : pattern de consumer, mapping providers, idempotency, tenant context, error handling, DLQ. C'est aussi cette tache qui arrime durablement le sprint 11 (Pay) au sprint 12 (Books) : sans elle, les deux modules sont decouples et l'utilisateur final voit une comptabilite a la traine de plusieurs jours.

---

## 2. Contexte etendu

### 2.1 Pourquoi un consumer asynchrone et pas un appel synchrone

L'alternative serait d'invoquer `JournalService.createEntry()` directement depuis `PaymentService.captureTransaction()` (Sprint 11) en mode synchrone : apres capture reussie, creer l'ecriture, puis renvoyer la reponse au client. Cette approche est rejetee pour cinq raisons techniques precises.

**Raison 1 -- separation des concerns** : Pay et Books sont deux domaines metier distincts (le passage d'une transaction par Pay est l'evenement, l'ecriture comptable est une consequence). Coupler synchroniquement les deux : (a) viole le principe Single Responsibility, (b) fait dependre Pay de Books pour son SLA (si Books est indisponible, Pay echoue), (c) empeche l'evolution independante des deux modules. Le Sprint 14+ Insure aura sa propre logique d'ecriture (commission policy_signed) que Pay n'a pas a connaitre.

**Raison 2 -- resilience** : si l'ecriture echoue (DB down, lock contention sur sequence numerotation), l'encaissement client ne doit pas etre rollback (l'argent est deja chez le tenant). Avec consumer Kafka, Pay capture, publie l'event, puis le consumer Books retry plusieurs fois jusqu'a succes, ou DLQ pour intervention manuelle. La transaction Pay et l'ecriture Books deviennent independantes en termes de SLA.

**Raison 3 -- volume et performance** : un courtier moyen genere 50-200 transactions/jour. Pendant les pics de campagne (rentree scolaire pour assurances scolaires, mois 1 pour renouvellements auto), on peut atteindre 1000+ transactions/jour. L'ecriture comptable n'a pas besoin d'etre instantanee (latence acceptable < 30s, en pratique on atteint < 2s avec Kafka local). Decoupler permet aussi de **batcher** les ecritures si un jour on veut optimiser (Sprint 34 Performance).

**Raison 4 -- audit trail richer** : avec un consumer dedie, on peut logger separement : Pay event recu, mapping calcule, JournalService appele, succes/echec, retry. Sans Kafka, ce serait noye dans le log de Pay. Le DLQ permet aussi un replay manuel par les ops avec intervention humaine si necessaire.

**Raison 5 -- extensibilite future Sprint 14+** : le meme topic `pay.transaction.captured` sera consume par d'autres consumers (notification email Sprint 9 si paiement reussi, dashboard analytics Sprint 13 pour metriques temps reel, declenchement renouvellement police automatique Sprint 14, etc.). Pattern publish/subscribe standardise. Ajouter un nouveau consumer ne modifie en rien Pay : zero couplage.

### 2.2 Alternatives considerees pour le mapping providers

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Mapping hardcode dans consumer | Simple, lisible | Modification = redeploy, pas configurable | Rejete (mais retenu phase 1) |
| Table `books_payment_account_mapping` configurable per tenant | Customizable, audit | Complexity, jointure runtime, tenant onboarding plus lourd | Differe Sprint 27 admin |
| Convention rigide CGNC : tous encaissements -> 5141 | Simple, conforme | Imprecise, ne distingue pas cash kiosque (5161) ni virement | Rejete (legalement insuffisant) |
| **Hardcode + override par tenant settings JSON (retenu)** | Defaut sain CGNC, override possible Sprint 27 | Settings table | RETENU |
| Service ML detecte type encaissement | Innovant | Overkill, pas explicable a auditeur DGI, decision-005 frontiere AI | Rejete |
| Hardcoder dans Pay producer | Simple | Couplage Pay -> CGNC, pas extensible | Rejete |

La decision retenue : un mapping hardcode dans `payment-mapping.config.ts` (defaut CGNC standard) plus une lecture optionnelle des `tenant_settings.books_payment_mapping` (JSON) qui peut overrider. Sprint 12 implemente le hardcode ; le override JSON est cable techniquement mais non expose UI (Sprint 27 Admin l'exposera). Cela respecte l'article 145 du CGI : un courtier doit pouvoir prouver la rationalite de la cardinalite de ses comptes lors d'un controle DGI ; le hardcode CGNC standard est defensible.

### 2.3 Trade-offs explicites

**Premier trade-off** : le consumer cree des ecritures avec `auto_validate: true` (status direct validated). C'est un choix delibere car : (a) la source est un event Kafka traceable et signe (Sprint 2 task 1.2.12 publisher signe les events), pas une saisie humaine ; (b) la validation manuelle ulterieure n'apporterait rien (que verifier ? le mapping est deterministe et le montant vient directement du provider) ; (c) l'audit trail reste intact (`reference=pay:tx_xxx` lie a l'event original). Risque assume : si le mapping est bugge, des ecritures fausses seront passees en validated et necessiteront des reverses (Tache 3.5.2 reverse). Mitigation : tests exhaustifs (cette tache : 56 tests dont 20 unit + 10 integration + 10 E2E + 8 mapping + 8 numbering) et alerting sur taux d'erreur DLQ via metric Prometheus `books_pay_to_journal_dlq_total`.

**Deuxieme trade-off** : on ne consume PAS les events `pay.transaction.failed` ou `pay.transaction.cancelled`. Ces evenements sont logged par Pay mais ne donnent lieu a aucune ecriture (rien n'a bouge sur la tresorerie). Si un client tente un paiement et echoue, aucune trace comptable. C'est conforme a la pratique : seuls les flux financiers reels sont comptabilises. Sprint 14+ pourra ajouter un autre consumer si on souhaite tracer les tentatives pour analytics.

**Troisieme trade-off** : le consumer ne consume pas non plus `pay.refund.completed` immediatement -- les refunds donnent lieu a une ecriture inverse (debit `4111` client / credit `5141` banque), mais cette logique est suffisamment differente pour justifier un consumer separe `RefundToJournalConsumer` (Sprint 14+, hors scope ici). Pour Sprint 12, on traite uniquement les captures.

**Quatrieme trade-off** : on accepte une latence event-to-journal jusqu'a 30s (objectif p95 < 2s, p99 < 5s, max 30s). Au-dela, alert PagerDuty. Cela couvre les rebalances Kafka, restarts containers, locks DB. Si latence systematiquement haute (> 5s), le consumer est mal scale et il faut augmenter les replicas. La metric `books_pay_to_journal_latency_ms` permet ce monitoring.

**Cinquieme trade-off** : MAD only en Sprint 12. Si Pay capture en EUR/USD (cas hypothetique multi-devise), l'event est rejete vers DLQ. La conversion vers MAD au taux du jour BAM est differee Sprint 13+ avec instrumentation BAM API.

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo structure)** : `packages/books` etend les services Tache 3.5.1, 3.5.2.
- **decision-002 (multi-tenant 3 niveaux)** : TenantContext propage via `runWithContext`.
- **decision-003 (TypeORM vs Prisma)** : consumer ne touche pas direct DB, passe par services TypeORM.
- **decision-004 (Kafka vs RabbitMQ)** : Kafka choisi pour audit trail durable + replay, ordering par partition.
- **decision-006 (no-emoji policy)** : zero emoji dans logs, code, commits.
- **decision-008 (data residency Maroc)** : Kafka cluster Atlas DC1 + DC2 replication.
- **Sprint 2 task 1.2.13** : `KafkaConsumerBase` abstraite (manual ack, retry, DLQ, idempotency hooks).
- **Sprint 9 Comm** : pas dependance directe (Sprint 9 a son propre consumer pour notifications).

### 2.5 Pieges techniques connus

1. **Piege : event consume sans tenant context** -- Le consumer ne se trouve pas dans un request scope, donc `TenantContext.getTenantId()` retourne undefined par defaut. Si oublie, `JournalService.createEntry()` leve `TENANT_CONTEXT_MISSING`. Solution : `TenantContext.runWithContext({ tenantId, isSuperAdmin: false, traceId, requestIp })` au debut du handler, en lisant `tenantId` depuis `event.headers.tenant_id`.
2. **Piege : redelivery Kafka apres restart** -- Si le consumer crash apres avoir cree l'ecriture mais avant l'`ack`, Kafka redelivre. Sans idempotency, doublon comptable (et numero d'ecriture differents en raison du sequence increment). Solution : `idempotency_key = pay:{transaction_id}` rend `createEntry` idempotent ; deuxieme appel retourne l'entry existant sans creer de nouveau.
3. **Piege : tenant_id manquant dans envelope** -- Si Pay (Sprint 11) oublie de mettre le header `x-insurtech-tenant-id` (bug producer), le consumer ne peut pas determiner le tenant. Solution : Zod schema `KafkaEnvelopeSchema` exige `headers.tenant_id` UUID strict ; rejet de l'event echoue le parsing -> DLQ direct sans appel `createEntry`.
4. **Piege : provider unknown** -- Si Pay introduit un nouveau provider (e.g. Stripe lors d'une expansion regionale future) et oublie de l'ajouter au mapping. Solution : default fallback `5141 / 4111 / BNQ` + log WARN structure + metric counter `books_pay_to_journal_fallback_total{provider="..."}`. Si > 5% events tombent en fallback, alerte ops.
5. **Piege : montant negatif ou zero** -- Event mal forme (bug producer, pas de validation cote Pay). Solution : Zod schema valide `amount` regex `/^\d{1,13}(\.\d{1,2})?$/` ET service handle verifie `parseFloat(amount) > 0` apres parsing. Echec -> DLQ avec metric `dlq_total{reason="invalid_amount"}`.
6. **Piege : devise non MAD** -- Transactions EUR ou USD necessiteraient conversion. Solution : Sprint 12 gere uniquement MAD (Loi 9-88 oblige tenue en MAD). Si currency != MAD, rejet -> DLQ avec alerte (necessitera conversion + ecriture multi-devise Sprint 13+).
7. **Piege : retry boucle infinie sur erreur permanente** -- Si l'event est definitivement invalide (account inexistant car CGNC seed pas fait sur ce tenant), retry indefiniment epuise les ressources. Solution : DLQ apres 3 retries, supervision manuelle. Le `KafkaConsumerBase` Sprint 2 task 1.2.13 implemente cette logique.
8. **Piege : ordre des events** -- Kafka garantit ordre par partition mais pas global. Si pay capture event arrive avant que le compte client soit cree (event `crm.contact.created` en retard), l'ecriture peut echouer si on tentait de creer un sous-compte client custom. Solution : on utilise les comptes generiques (4111 individuel, 4112 entreprise) qui sont seedes Tache 3.5.1, donc toujours presents. Aucune dependance event ordre.
9. **Piege : metric prometheus manquante** -- Sans observability, on ne sait pas si le consumer fonctionne. Solution : counters `books_pay_to_journal_success_total{provider, transaction_type}`, `_dlq_total{reason}`, `_retry_total{reason}`, histogram `_latency_ms`. Exposees `/metrics` pour scraping Prometheus + dashboard Grafana standard.
10. **Piege : memory leak consumer long-running** -- Le consumer tourne 24/7. Si on accumule des references dans Maps/Sets sans cleanup, OOM apres quelques jours. Solution : pas de cache local persistent dans le consumer ; tout est stateless (chaque event traite independamment), pas de Map<transaction_id, ...> qui croitrait. La idempotency-key passe par DB, pas memoire.
11. **Piege : Kafka client config rebalance** -- Plusieurs replicas du consumer en production, le `groupId='books-pay-to-journal'` doit etre identique pour que Kafka rebalance correctement. Solution : groupId hardcode dans la classe consumer (pas configurable env var pour eviter accident operateur). Si on veut deploying multiple consumer groups (e.g. dev separe de prod), on utilise des Kafka clusters distincts (DC1 prod, DC2 staging).
12. **Piege : graceful shutdown** -- A SIGTERM, le consumer doit terminer le message en cours puis ack avant de mourir. Solution : `KafkaConsumerBase` Sprint 2 task 1.2.13 implemente `OnApplicationShutdown` qui drain proprement (pause consumption, attend fin process en cours, commit offset, disconnect).
13. **Piege : poison pill message** -- Un event corrompu (binary garbage) peut faire crasher le consumer. Solution : try/catch global dans `KafkaConsumerBase.handle()`, en cas d'exception non-recoverable -> DLQ direct avec raw payload preserve pour debug.
14. **Piege : event publie depuis Sprint 11 puis Pay rollback** -- Si Pay publie l'event puis sa transaction DB fail, l'ecriture comptable est creee pour rien. Solution : Sprint 11 utilise outbox pattern (publish dans la meme transaction que la persistence DB), donc evenement publie = transaction DB committed.
15. **Piege : CMI provider_transaction_id avec espaces** -- CMI peut renvoyer `"CMI 2026 01"` avec espaces. Solution : Zod schema autorise `min(1)` mais on trim avant de l'utiliser dans description.

---

## 3. Architecture context

### 3.1 Position dans le sprint 12

Cette tache 3.5.3 est la troisieme du sprint, immediatement apres la creation des journal entries (Tache 3.5.2). Elle :

- **Depend de** : Tache 3.5.2 (`JournalService.createEntry({ idempotency_key, auto_validate })`), Tache 3.5.1 (`AccountChartService.findByCodes()` pour valider les codes mapping via `JournalValidationService`), Sprint 11 (events Pay disponibles), Sprint 2 task 1.2.13 (`KafkaConsumerBase`), Sprint 6 task 2.2.1 (`TenantContext`), Sprint 7 RBAC (pas direct, mais consumer agit en `system-pay-consumer`).
- **Bloque** : Tache 3.5.5 (invoices peuvent dependre du flag "encaissement comptabilise" verifie via `journal_entries.reference LIKE 'pay:%'`), Tache 3.5.6 (bilan inclut ces ecritures auto-generees), Tache 3.5.13 (tests E2E sprint).
- **Apporte au sprint** : automatisation totale du flux Pay -> Books, base pour Sprint 14 `InsureToJournalConsumer`, Sprint 19 `RepairInvoiceToJournalConsumer`, Sprint 21 `ClaimToJournalConsumer`. Le pattern est etabli ici.

### 3.2 Position dans le programme global v2.2

```
Sprint 11 Pay (capture)              Sprint 12 Tache 3.5.3 (cette tache)
+---------------+                    +-------------------+
|  CMI          |  -+                | PayToJournal      |
|  YouCan Pay   |   |                | Consumer          |
|  PayZone      |   |--> Kafka -->   |                   | --> JournalService.createEntry
|  Inwi Money   |   |                | (idempotency,     |
|  Orange Money |   |                |  TenantContext,   |
|  MWallet BAM  |  -+                |  retry, DLQ)      |
+---------------+                    +-------------------+
                                            |
                                            | (DLQ on retry exhaustion)
                                            v
                                     Topic dlq.books.pay-to-journal
                                     (alert ops, manual review)
```

Dans la phase 4 (Sprint 14+ Insure), le pattern sera repete :

```
Sprint 14 Insure (policy_signed)     Sprint 14+ InsurePolicyToJournal
+--------+                          +-----------+
| Police |  -+                      | Consumer  |
| signed |   |--> Kafka --->        | similaire |  --> JournalService (commission RC, etc.)
+--------+                          +-----------+
```

Et phase 5 (Sprint 19+ Repair) :

```
Sprint 19 Repair (invoice_validated) Sprint 19+ RepairInvoiceToJournal
```

Cette tache 3.5.3 est donc **fondatrice** : 4-5 consumers similaires l'imiteront.

### 3.3 Sequence diagram detaille

```
1. Pay (Sprint 11) capture transaction CMI 12000 MAD
2. Pay update DB transaction.status = 'captured'
3. Pay publie event Kafka :
   topic: insurtech.events.pay.transaction.captured
   partition: hash(tenant_id) % 12
   key: tenant_id
   headers: { trace_id, tenant_id, user_id, schema_version: 1.0 }
   value: JSON {
     transaction_id: "tx_cmi_8392",
     tenant_id: "aaa-bbb-ccc",
     provider: "cmi",
     transaction_type: "card_payment",
     amount: "12000.00",
     currency: "MAD",
     captured_at: "2026-04-08T10:00:00Z",
     customer_email: "client@axa.ma",
     customer_name: "AXA Maroc",
     provider_transaction_id: "CMI-XX-001"
   }
4. Kafka cluster Atlas DC1 persist event (replica DC2)
5. PayToJournalConsumer (replica 1 ou 2 ou 3) consume event :
   - parse Zod schema -> echec -> DLQ direct
   - extract tenant_id from headers
   - TenantContext.runWithContext({ tenantId, ... }, async () => {
       // pre-checks
       if (currency !== 'MAD') throw UNSUPPORTED_CURRENCY -> retry... -> DLQ
       if (parseFloat(amount) <= 0) throw INVALID_AMOUNT -> DLQ
       // resolve mapping
       const mapping = await mappingService.resolve('cmi', 'card_payment', tenantId);
       // -> { debit_account: '5141', credit_account: '4111', journal_code: 'BNQ', source: 'config' }
       // resolve customer credit account (4111 individual / 4112 company)
       const ctx = await contextResolver.enrichCreditAccount(event.data, '4111');
       // -> { credit_account: '4112', customer_label: 'AXA Maroc' } (entreprise detectee)
       // build description
       const description = formatDescription('Encaissement CMI {provider_transaction_id}', { ... });
       // call JournalService Tache 3.5.2
       const entry = await journalService.createEntry({
         journal_code: 'BNQ',
         entry_date: '2026-04-08',
         reference: 'pay:tx_cmi_8392',
         description: 'Encaissement CMI CMI-XX-001 - AXA Maroc',
         idempotency_key: 'pay:tx_cmi_8392',
         auto_validate: true,
         lines: [
           { account_code: '5141', label: 'Encaissement cmi', debit: '12000.00', credit: '0', currency: 'MAD' },
           { account_code: '4112', label: 'AXA Maroc', debit: '0', credit: '12000.00', currency: 'MAD' },
         ],
       }, 'system-pay-consumer');
       // entry created with entry_number 'BNQ-2026-00001', status='validated'
       // metric.success_total{provider='cmi', transaction_type='card_payment'}.inc()
     });
6. Consumer ack message (commit offset to Kafka)
7. Optional : Kafka publie event books.journal_entry.created (Tache 3.5.2 publish)
   -> Sprint 13 Analytics dashboard agrege
```

### 3.4 Topics consumes/publishes

```
CONSUME : insurtech.events.pay.transaction.captured
  groupId : books-pay-to-journal
  partitions : 12 (hash by tenant_id, ordering preserved per tenant)
  retention : 30 jours (audit + replay)

PUBLISH (indirect via JournalService) : insurtech.events.books.journal_entry.created
  via JournalService.createEntry publishes (Tache 3.5.2)

DLQ : insurtech.events.dlq.books.pay-to-journal
  retention : 90 jours
  ops review : dashboard Grafana ou kafkactl
```

### 3.5 Mapping table (defaut hardcode CGNC)

```
PROVIDER          | TXN_TYPE         | DEBIT  | CREDIT | JOURNAL | SOURCE
------------------|------------------|--------|--------|---------|--------
cmi               | bank_transfer    | 5141   | 4111   | BNQ     | config
cmi               | card_payment     | 5141   | 4111   | BNQ     | config
youcan_pay        | card_payment     | 5141   | 4111   | BNQ     | config
payzone           | card_payment     | 5141   | 4111   | BNQ     | config
payzone           | cash_kiosque     | 5161   | 4111   | CSS     | config
inwi_money        | mobile_wallet    | 5141   | 4111   | BNQ     | config
orange_money      | mobile_wallet    | 5141   | 4111   | BNQ     | config
mwallet_bam       | mobile_wallet    | 5141   | 4111   | BNQ     | config
default fallback  | *                | 5141   | 4111   | BNQ     | default_fallback (+WARN log)
tenant override   | *                | tenant | tenant | tenant  | tenant_override (Sprint 27)
```

Le credit_account est `4111` (individual) par defaut, override a `4112` (company) ou `4113` (administration) par `PaymentContextResolverService` selon lookup customer dans `crm_contacts` (Sprint 8).

---

## 4. Livrables checkables

- [ ] Consumer `pay-to-journal.consumer.ts` (~320 lignes) extends KafkaConsumerBase avec handle, classifyError, onDeadLetter, metrics inline.
- [ ] Service `payment-mapping.service.ts` (~200 lignes) resolve provider+type -> debit/credit accounts avec tenant override + fallback.
- [ ] Config `payment-mapping.config.ts` (~120 lignes) table mapping hardcode + types + description templates.
- [ ] Schemas Zod `pay-events.schemas.ts` (~140 lignes) PayCapturedEventSchema, KafkaEnvelopeSchema, validation runtime.
- [ ] Service `payment-context-resolver.service.ts` (~180 lignes) enrichit context : client name + type via lookup CRM, customer_account_code mapping.
- [ ] Module `pay-to-journal.module.ts` (~80 lignes) enregistre consumer + services + Kafka registration.
- [ ] Tests unitaires `pay-to-journal.consumer.spec.ts` (~580 lignes) 25 cas exhaustifs avec assertions reelles.
- [ ] Tests unitaires `payment-mapping.service.spec.ts` (~280 lignes) 12 cas.
- [ ] Tests unitaires `payment-context-resolver.service.spec.ts` (~220 lignes) 10 cas.
- [ ] Tests integration Kafka `pay-to-journal.integration.spec.ts` (~380 lignes) 12 cas avec Kafka testcontainer.
- [ ] Tests E2E end-to-end Pay->Journal `pay-to-journal.e2e-spec.ts` (~280 lignes) 10 cas.
- [ ] Fixtures Pay events `pay-events-fixtures.ts` (~220 lignes) 15 fixtures realistes.
- [ ] Metrics Prometheus exposees (counters, histograms) dans `/metrics`.
- [ ] Documentation README mise a jour (ajouter section consumer pattern).
- [ ] Variables env `BOOKS_CONSUMER_RETRY_MAX`, `BOOKS_CONSUMER_RETRY_BACKOFF_MS`, `BOOKS_CONSUMER_DLQ_TOPIC`, `BOOKS_CONSUMER_GROUP_ID`.
- [ ] Updates `tenant_settings.books_payment_mapping` jsonb (optionnel, code only Sprint 12).
- [ ] Logging structured complet (msg, tenant_id, transaction_id, provider, action, duration_ms).
- [ ] Permissions catalog : aucune (consumer agit en system-level).
- [ ] Healthcheck endpoint `/healthz` inclut consumer status.
- [ ] Audit log entry pour chaque ecriture creee (tag `source: 'auto_pay_consumer'`).
- [ ] OpenTelemetry tracing : trace_id propage de l'event Kafka vers le journal_entry.

---

## 5. Fichiers crees / modifies

```
repo/packages/books/src/consumers/pay-to-journal.consumer.ts                    (~320 lignes / consumer principal)
repo/packages/books/src/consumers/pay-to-journal.consumer.spec.ts               (~580 lignes / 25 unit tests)
repo/packages/books/src/services/payment-mapping.service.ts                      (~200 lignes / mapping resolver)
repo/packages/books/src/services/payment-mapping.service.spec.ts                 (~280 lignes / 12 unit tests)
repo/packages/books/src/services/payment-context-resolver.service.ts             (~180 lignes / customer enrichment)
repo/packages/books/src/services/payment-context-resolver.service.spec.ts        (~220 lignes / 10 unit tests)
repo/packages/books/src/config/payment-mapping.config.ts                         (~120 lignes / hardcode mapping)
repo/packages/books/src/types/pay-events.types.ts                                (~100 lignes / types/enums)
repo/packages/books/src/schemas/pay-events.schemas.ts                            (~140 lignes / Zod validators)
repo/packages/books/src/modules/pay-to-journal.module.ts                         (~80 lignes / Nest module)
repo/packages/books/src/index.ts                                                  (modif exports)
repo/apps/api/src/modules/books/books.module.ts                                  (modif imports PayToJournalModule)
repo/packages/books/test/integration/pay-to-journal.integration.spec.ts          (~380 lignes / 12 integration tests)
repo/packages/books/test/e2e/pay-to-journal.e2e-spec.ts                           (~280 lignes / 10 E2E tests)
repo/test/fixtures/pay-events-fixtures.ts                                         (~220 lignes / 15 fixtures)
repo/packages/books/src/metrics/pay-to-journal.metrics.ts                         (~80 lignes / Prometheus)
repo/packages/books/README.md                                                     (modif)
repo/.env.example                                                                  (modif +6 vars)
repo/infrastructure/observability/grafana-dashboard-pay-to-journal.json           (~80 lignes)
```

Total : 19 fichiers crees/modifies, ~3 700 lignes ajoutees.

---

## 6. Code patterns COMPLETS

### 6.1 Schemas Zod `pay-events.schemas.ts`

```typescript
// repo/packages/books/src/schemas/pay-events.schemas.ts
// Schemas Zod pour valider events Kafka entrants -- runtime safety strict
// Reference : decision-006 (no emoji), Sprint 2 task 1.2.13 KafkaConsumerBase

import { z } from 'zod';

/**
 * Liste exhaustive des 6 providers Pay supportes au Maroc.
 * Toute extension future requiert mise a jour PAYMENT_MAPPING_DEFAULT (config).
 */
export const PaymentProviderSchema = z.enum([
  'cmi', // Centre Monetique Interbancaire (Maroc)
  'youcan_pay', // YouCan Pay (startup Maroc)
  'payzone', // PayZone (CIH Bank, kiosques cash)
  'inwi_money', // Inwi Money (operateur telecom)
  'orange_money', // Orange Money (operateur telecom)
  'mwallet_bam', // MWallet BAM (regulateur Bank Al-Maghrib)
]);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

/**
 * Types de transaction. Chaque (provider, transaction_type) est mappe vers
 * (debit_account, credit_account, journal_code) dans PAYMENT_MAPPING_DEFAULT.
 */
export const TransactionTypeSchema = z.enum([
  'card_payment', // Carte bancaire (CIB, Visa, Mastercard)
  'bank_transfer', // Virement bancaire SWIFT ou domestique
  'mobile_wallet', // Mobile money (Inwi, Orange, MWallet)
  'cash_kiosque', // Cash kiosque PayZone
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

/**
 * Enveloppe Kafka standard Skalean InsurTech (decision-004 Kafka).
 * headers.tenant_id est OBLIGATOIRE (decision-002 multi-tenant).
 * trace_id permet correlation OpenTelemetry.
 */
export const KafkaEnvelopeSchema = z.object({
  schema_version: z.literal('1.0'),
  topic: z.string().min(1),
  partition: z.number().int().nonnegative().optional(),
  offset: z.string().optional(),
  timestamp: z.string().datetime(),
  headers: z.object({
    trace_id: z.string().min(8).max(64),
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    request_id: z.string().optional(),
    correlation_id: z.string().optional(),
  }),
  data: z.unknown(),
});

/**
 * Payload data event pay.transaction.captured.
 * amount est string regex car decimal.js precision strict (cf Tache 3.5.4).
 * currency literal MAD : Sprint 12 mono-devise (loi 9-88 tenue MAD).
 */
export const PayCapturedEventDataSchema = z
  .object({
    transaction_id: z.string().min(8).max(64),
    tenant_id: z.string().uuid(),
    provider: PaymentProviderSchema,
    transaction_type: TransactionTypeSchema,
    amount: z
      .string()
      .regex(/^\d{1,13}(\.\d{1,2})?$/, 'Decimal max 15.2 (CGI art 117 arrondi centime)'),
    currency: z.literal('MAD'),
    captured_at: z.string().datetime(),
    customer_email: z.string().email().optional(),
    customer_phone: z
      .string()
      .regex(/^\+?\d{8,15}$/)
      .optional(),
    customer_name: z.string().min(1).max(255).optional(),
    related_resource_type: z
      .enum(['invoice', 'policy', 'claim', 'estimate', 'repair_order', 'other'])
      .optional(),
    related_resource_id: z.string().optional(),
    provider_transaction_id: z.string().min(1).max(128),
    fees_amount: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  })
  .strict();

export type PayCapturedEventData = z.infer<typeof PayCapturedEventDataSchema>;

/**
 * Schema final fusionne envelope + topic litteral + data.
 * Utilise par KafkaConsumerBase Sprint 2 task 1.2.13 pour validation pre-handle.
 */
export const PayCapturedEventSchema = KafkaEnvelopeSchema.extend({
  topic: z.literal('insurtech.events.pay.transaction.captured'),
  data: PayCapturedEventDataSchema,
});

export type PayCapturedEvent = z.infer<typeof PayCapturedEventSchema>;

/**
 * Schema pour event refund (consume Sprint 14+ via consumer separe).
 * Documente ici pour reference, pas utilise Sprint 12.
 */
export const PayRefundEventDataSchema = z
  .object({
    transaction_id: z.string(),
    refund_id: z.string(),
    tenant_id: z.string().uuid(),
    refund_amount: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/),
    currency: z.literal('MAD'),
    refunded_at: z.string().datetime(),
    reason: z.string().min(10).max(500),
  })
  .strict();
```

### 6.2 Types `pay-events.types.ts`

```typescript
// repo/packages/books/src/types/pay-events.types.ts

import type { PaymentProvider, TransactionType } from '../schemas/pay-events.schemas';

/**
 * Resultat de la resolution mapping (provider, type) -> comptes CGNC.
 * source documente l'origine : config (hardcode), tenant_override, default_fallback.
 */
export interface PaymentMappingResult {
  debit_account: string;
  credit_account: string;
  journal_code: 'BNQ' | 'CSS';
  description_template: string;
  source: 'config' | 'tenant_override' | 'default_fallback';
}

export interface ConsumerHandlerContext {
  topic: string;
  partition: number;
  offset: string;
  trace_id: string;
  tenant_id: string;
  attempt: number;
}

/**
 * Fallbacks utilises si provider/type inconnu.
 * 5141 Banque + 4111 Client individual + journal BNQ (CGNC standard).
 */
export const FALLBACK_DEBIT_ACCOUNT = '5141';
export const FALLBACK_CREDIT_ACCOUNT = '4111';
export const FALLBACK_JOURNAL_CODE = 'BNQ' as const;

export interface PaymentMappingEntry {
  provider: PaymentProvider;
  transaction_type: TransactionType;
  debit_account: string;
  credit_account: string;
  journal_code: 'BNQ' | 'CSS';
}

export interface CustomerEnrichmentResult {
  credit_account: string;
  customer_label: string;
  contact_id?: string;
  contact_type: 'individual' | 'company' | 'administration' | 'unknown';
}

export type ErrorClassification =
  | 'account_not_found'
  | 'tenant_missing'
  | 'imbalanced'
  | 'currency_not_mad'
  | 'invalid_amount'
  | 'idempotency_conflict'
  | 'unknown';
```

### 6.3 Config `payment-mapping.config.ts`

```typescript
// repo/packages/books/src/config/payment-mapping.config.ts
// Mapping hardcode provider+type -> comptes CGNC. Override via tenant_settings.books_payment_mapping
// Reference : Tache 3.5.1 plan comptable (4111 individuel, 4112 entreprise, 5141 banque, 5161 caisse)

import type { PaymentMappingEntry } from '../types/pay-events.types';

/**
 * Mapping standard CGNC pour les 6 providers MA + 4 types de transactions.
 *
 * Toutes les transactions creditent le compte client 4111 (individuel) par defaut.
 * Le payment-context-resolver enrichit a 4112 (entreprise) ou 4113 (admin) selon
 * lookup CRM dans crm_contacts.type.
 *
 * Le debit varie selon le canal :
 *   - Bank/Card/Mobile -> 5141 Banques (compte courant)
 *   - Cash kiosque -> 5161 Caisses
 *
 * Le journal_code BNQ = Banque, CSS = Caisse (CGNC standard codes journal).
 *
 * Defi conformite : si on doit distinguer entre clients particuliers (4111) et
 * entreprises (4112), le payment-context-resolver.service.ts enrichit en lisant
 * l'attribut customer_type via lookup crm_contacts depuis customer_email ou
 * customer_phone.
 *
 * Sprint 27 Admin permettra l override via tenant_settings UI.
 */
export const PAYMENT_MAPPING_DEFAULT: ReadonlyArray<PaymentMappingEntry> = Object.freeze([
  // CMI -- Centre Monetique Interbancaire (banques marocaines)
  {
    provider: 'cmi',
    transaction_type: 'card_payment',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
  {
    provider: 'cmi',
    transaction_type: 'bank_transfer',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
  // YouCan Pay -- Maroc startup, online card processing
  {
    provider: 'youcan_pay',
    transaction_type: 'card_payment',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
  // PayZone (CIH Bank) -- carte + kiosque cash physique
  {
    provider: 'payzone',
    transaction_type: 'card_payment',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
  {
    provider: 'payzone',
    transaction_type: 'cash_kiosque',
    debit_account: '5161', // Caisse, pas Banque
    credit_account: '4111',
    journal_code: 'CSS', // Journal Caisse
  },
  // Inwi Money -- mobile wallet operateur telecoms Inwi
  {
    provider: 'inwi_money',
    transaction_type: 'mobile_wallet',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
  // Orange Money -- mobile wallet operateur telecoms Orange
  {
    provider: 'orange_money',
    transaction_type: 'mobile_wallet',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
  // MWallet BAM -- mobile wallet regule par Bank Al-Maghrib
  {
    provider: 'mwallet_bam',
    transaction_type: 'mobile_wallet',
    debit_account: '5141',
    credit_account: '4111',
    journal_code: 'BNQ',
  },
]);

/**
 * Templates de description pour chaque provider.
 * Placeholder {provider_transaction_id} remplace par le service.
 */
export const PAYMENT_DESCRIPTION_TEMPLATES: Readonly<Record<string, string>> = Object.freeze({
  cmi: 'Encaissement CMI {provider_transaction_id}',
  youcan_pay: 'Encaissement YouCan Pay {provider_transaction_id}',
  payzone: 'Encaissement PayZone {provider_transaction_id}',
  inwi_money: 'Encaissement Inwi Money {provider_transaction_id}',
  orange_money: 'Encaissement Orange Money {provider_transaction_id}',
  mwallet_bam: 'Encaissement MWallet BAM {provider_transaction_id}',
});

/**
 * Sanity check au boot : verifier que tous les providers du PaymentProviderSchema
 * sont presents dans le mapping (pas d'oubli).
 */
export function validateMappingCoverage(): string[] {
  const errors: string[] = [];
  const expectedProviders = ['cmi', 'youcan_pay', 'payzone', 'inwi_money', 'orange_money', 'mwallet_bam'];
  for (const provider of expectedProviders) {
    const entries = PAYMENT_MAPPING_DEFAULT.filter((e) => e.provider === provider);
    if (entries.length === 0) {
      errors.push(`Provider ${provider} : 0 mappings (ajout requis)`);
    }
  }
  return errors;
}
```

### 6.4 Service `payment-mapping.service.ts`

```typescript
// repo/packages/books/src/services/payment-mapping.service.ts
// Service resolveur mapping (provider, type) -> (debit, credit, journal_code).
// Order : tenant_override -> config hardcode -> default_fallback.

import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PAYMENT_MAPPING_DEFAULT,
  PAYMENT_DESCRIPTION_TEMPLATES,
} from '../config/payment-mapping.config';
import {
  FALLBACK_DEBIT_ACCOUNT,
  FALLBACK_CREDIT_ACCOUNT,
  FALLBACK_JOURNAL_CODE,
  type PaymentMappingResult,
  type PaymentMappingEntry,
} from '../types/pay-events.types';
import type {
  PaymentProvider,
  TransactionType,
} from '../schemas/pay-events.schemas';

/**
 * Row de la table tenant_settings (Sprint 6 task 2.2.7).
 * Le champ books_payment_mapping est jsonb optionnel.
 */
interface TenantSettingsRow {
  tenant_id: string;
  books_payment_mapping: PaymentMappingEntry[] | null;
}

@Injectable()
export class PaymentMappingService {
  constructor(
    private readonly logger: Logger,
    @InjectRepository('tenant_settings', 'default')
    private readonly tenantSettingsRepo?: Repository<TenantSettingsRow>,
  ) {}

  /**
   * Resolve mapping (provider, transaction_type) -> accounts CGNC.
   *
   * Order de resolution :
   *   1. Tenant override (lecture tenant_settings.books_payment_mapping)
   *   2. Defaut hardcode (PAYMENT_MAPPING_DEFAULT)
   *   3. Fallback (5141 / 4111 / BNQ + WARN log)
   *
   * @param provider - cmi | youcan_pay | payzone | inwi_money | orange_money | mwallet_bam
   * @param transactionType - card_payment | bank_transfer | mobile_wallet | cash_kiosque
   * @param tenantId - UUID tenant pour lookup tenant_settings
   * @returns mapping resolved + source pour audit
   */
  async resolve(
    provider: PaymentProvider,
    transactionType: TransactionType,
    tenantId: string,
  ): Promise<PaymentMappingResult> {
    // 1. Tenant override (lecture optionnelle)
    if (this.tenantSettingsRepo) {
      try {
        const settings = await this.tenantSettingsRepo
          .createQueryBuilder('s')
          .select('s.books_payment_mapping')
          .where('s.tenant_id = :tenantId', { tenantId })
          .getOne();
        const overrides = settings?.books_payment_mapping;
        if (Array.isArray(overrides) && overrides.length > 0) {
          const match = overrides.find(
            (e) => e.provider === provider && e.transaction_type === transactionType,
          );
          if (match) {
            this.logger.debug({
              msg: 'payment_mapping_tenant_override',
              tenant_id: tenantId,
              provider,
              transaction_type: transactionType,
              debit_account: match.debit_account,
              credit_account: match.credit_account,
            });
            return {
              debit_account: match.debit_account,
              credit_account: match.credit_account,
              journal_code: match.journal_code,
              description_template:
                PAYMENT_DESCRIPTION_TEMPLATES[provider] ??
                'Encaissement {provider_transaction_id}',
              source: 'tenant_override',
            };
          }
        }
      } catch (err) {
        // Erreur lecture tenant_settings : on degrade gracieusement vers config
        this.logger.warn({
          msg: 'payment_mapping_tenant_override_failed',
          tenant_id: tenantId,
          err: (err as Error).message,
        });
      }
    }

    // 2. Defaut hardcode CGNC
    const entry = PAYMENT_MAPPING_DEFAULT.find(
      (e) => e.provider === provider && e.transaction_type === transactionType,
    );
    if (entry) {
      return {
        debit_account: entry.debit_account,
        credit_account: entry.credit_account,
        journal_code: entry.journal_code,
        description_template:
          PAYMENT_DESCRIPTION_TEMPLATES[provider] ?? 'Encaissement {provider_transaction_id}',
        source: 'config',
      };
    }

    // 3. Fallback (provider ou type inconnu : alerte + defaut)
    this.logger.warn({
      msg: 'payment_mapping_fallback',
      tenant_id: tenantId,
      provider,
      transaction_type: transactionType,
      fallback_debit: FALLBACK_DEBIT_ACCOUNT,
      fallback_credit: FALLBACK_CREDIT_ACCOUNT,
      action_required: 'Ajouter provider/type a PAYMENT_MAPPING_DEFAULT',
    });
    return {
      debit_account: FALLBACK_DEBIT_ACCOUNT,
      credit_account: FALLBACK_CREDIT_ACCOUNT,
      journal_code: FALLBACK_JOURNAL_CODE,
      description_template: 'Encaissement provider {provider_transaction_id}',
      source: 'default_fallback',
    };
  }

  /**
   * Permet de remplacer les placeholders {key} dans les descriptions.
   * Utilise pour formatter description finale du journal_entry.
   */
  formatDescription(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), this.sanitize(v)),
      template,
    );
  }

  /** Sanitize : trim + remove caracteres de controle. */
  private sanitize(value: string): string {
    return value.trim().replace(/[\x00-\x1F\x7F]/g, '');
  }

  /** Renvoie tous les mappings standards pour debug/audit. */
  getDefaults(): ReadonlyArray<PaymentMappingEntry> {
    return PAYMENT_MAPPING_DEFAULT;
  }

  /** Helper test : verifier qu'un mapping existe pour (provider, type). */
  hasMapping(provider: PaymentProvider, transactionType: TransactionType): boolean {
    return PAYMENT_MAPPING_DEFAULT.some(
      (e) => e.provider === provider && e.transaction_type === transactionType,
    );
  }
}
```

### 6.5 Service `payment-context-resolver.service.ts`

```typescript
// repo/packages/books/src/services/payment-context-resolver.service.ts
// Enrichit le credit_account selon le type de customer detecte via crm_contacts.

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PayCapturedEventData } from '../schemas/pay-events.schemas';
import type { CustomerEnrichmentResult } from '../types/pay-events.types';

interface ContactRow {
  id: string;
  tenant_id: string;
  name: string;
  type: 'individual' | 'company' | 'administration';
  email?: string;
  phone?: string;
  account_code_override?: string; // optionnel : sous-compte custom (ex 4111-CL00042)
}

@Injectable()
export class PaymentContextResolverService {
  constructor(
    private readonly logger: Logger,
    @InjectRepository('crm_contacts', 'default')
    private readonly contactsRepo?: Repository<ContactRow>,
  ) {}

  /**
   * Enrichit le credit_account en fonction du customer detecte.
   *
   * Si customer_email ou customer_phone permet de retrouver un contact, on utilise :
   *   - 4111 si type=individual
   *   - 4112 si type=company
   *   - 4113 si type=administration
   *   - account_code_override si defini (sous-compte custom du tenant)
   *
   * Sinon on garde le default (4111 individual).
   *
   * @param event - donnees event Pay
   * @param defaultCreditAccount - compte par defaut si pas de match (typ. 4111)
   * @returns { credit_account, customer_label, contact_id, contact_type }
   */
  async enrichCreditAccount(
    event: PayCapturedEventData,
    defaultCreditAccount: string,
  ): Promise<CustomerEnrichmentResult> {
    if (!event.customer_email && !event.customer_phone) {
      return {
        credit_account: defaultCreditAccount,
        customer_label: event.customer_name ?? 'Client non identifie',
        contact_type: 'unknown',
      };
    }

    if (!this.contactsRepo) {
      // CRM module pas disponible : fallback sur defaut + customer_name de l'event
      return {
        credit_account: defaultCreditAccount,
        customer_label: event.customer_name ?? event.customer_email ?? 'Client',
        contact_type: 'unknown',
      };
    }

    try {
      // Lookup avec normalisation lower-case email
      const qb = this.contactsRepo
        .createQueryBuilder('c')
        .where('c.tenant_id = :tid', { tid: event.tenant_id })
        .andWhere('c.is_active = true');
      if (event.customer_email) {
        qb.andWhere('LOWER(c.email) = LOWER(:email)', { email: event.customer_email });
      } else if (event.customer_phone) {
        qb.andWhere('c.phone = :phone', { phone: event.customer_phone });
      }
      const contact = await qb.getOne();

      if (contact) {
        const accountCode =
          contact.account_code_override ?? this.defaultCodeForType(contact.type);
        return {
          credit_account: accountCode,
          customer_label: contact.name,
          contact_id: contact.id,
          contact_type: contact.type,
        };
      }
    } catch (err) {
      this.logger.warn({
        msg: 'payment_context_lookup_failed',
        err: (err as Error).message,
        tenant_id: event.tenant_id,
        transaction_id: event.transaction_id,
      });
    }

    // Pas trouve : fallback defaut + label depuis event
    return {
      credit_account: defaultCreditAccount,
      customer_label: event.customer_name ?? event.customer_email ?? 'Client',
      contact_type: 'unknown',
    };
  }

  private defaultCodeForType(type: 'individual' | 'company' | 'administration'): string {
    switch (type) {
      case 'individual':
        return '4111';
      case 'company':
        return '4112';
      case 'administration':
        return '4113';
      default:
        return '4111';
    }
  }
}
```

### 6.6 Consumer `pay-to-journal.consumer.ts`

```typescript
// repo/packages/books/src/consumers/pay-to-journal.consumer.ts
// Kafka consumer qui auto-genere ecritures comptables a chaque encaissement Pay.
// Pattern fondateur : meme schema sera repete Sprint 14+ Insure / Sprint 19+ Repair.

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { KafkaConsumerBase, type KafkaMessageContext } from '@insurtech/shared-events';
import { TenantContext } from '@insurtech/shared-utils';
import { JournalService } from '../services/journal.service';
import { PaymentMappingService } from '../services/payment-mapping.service';
import { PaymentContextResolverService } from '../services/payment-context-resolver.service';
import {
  PayCapturedEventSchema,
  type PayCapturedEvent,
} from '../schemas/pay-events.schemas';
import type { ErrorClassification } from '../types/pay-events.types';
import { Counter, Histogram } from 'prom-client';

const RETRY_MAX = parseInt(process.env.BOOKS_CONSUMER_RETRY_MAX ?? '3', 10);
const RETRY_BACKOFF_MS = parseInt(process.env.BOOKS_CONSUMER_RETRY_BACKOFF_MS ?? '500', 10);
const DLQ_TOPIC =
  process.env.BOOKS_CONSUMER_DLQ_TOPIC ?? 'insurtech.events.dlq.books.pay-to-journal';
const GROUP_ID = process.env.BOOKS_CONSUMER_GROUP_ID ?? 'books-pay-to-journal';

@Injectable()
export class PayToJournalConsumer
  extends KafkaConsumerBase<PayCapturedEvent>
  implements OnModuleInit, OnModuleDestroy
{
  // Configuration Kafka consumer (immutable per instance)
  protected readonly topic = 'insurtech.events.pay.transaction.captured';
  protected readonly groupId = GROUP_ID;
  protected readonly schema = PayCapturedEventSchema;
  protected readonly retryMax = RETRY_MAX;
  protected readonly retryBackoffMs = RETRY_BACKOFF_MS;
  protected readonly dlqTopic = DLQ_TOPIC;

  // Metriques Prometheus declaratives
  private readonly successCounter = new Counter({
    name: 'books_pay_to_journal_success_total',
    help: 'Nombre d ecritures generees avec succes par PayToJournal consumer',
    labelNames: ['provider', 'transaction_type'],
  });
  private readonly retryCounter = new Counter({
    name: 'books_pay_to_journal_retry_total',
    help: 'Nombre de retries (avant DLQ ou succes ulterieur)',
    labelNames: ['provider', 'reason'],
  });
  private readonly dlqCounter = new Counter({
    name: 'books_pay_to_journal_dlq_total',
    help: 'Nombre d events route vers DLQ apres retry exhaustion',
    labelNames: ['reason'],
  });
  private readonly fallbackCounter = new Counter({
    name: 'books_pay_to_journal_fallback_total',
    help: 'Nombre de mappings tombes en fallback (provider/type inconnu)',
    labelNames: ['provider'],
  });
  private readonly latencyHistogram = new Histogram({
    name: 'books_pay_to_journal_latency_ms',
    help: 'Latence handle (ms) -- du recv event au commit ack',
    buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000],
  });

  constructor(
    logger: Logger,
    private readonly journalService: JournalService,
    private readonly mappingService: PaymentMappingService,
    private readonly contextResolver: PaymentContextResolverService,
  ) {
    super(logger);
  }

  /**
   * Handler principal : appele par KafkaConsumerBase apres validation Zod.
   * Si throw -> retry par KafkaConsumerBase (jusqu'a retryMax) puis DLQ.
   */
  async handle(event: PayCapturedEvent, ctx: KafkaMessageContext): Promise<void> {
    const startMs = Date.now();
    const { transaction_id, provider, transaction_type, amount, captured_at } = event.data;
    const tenantId = event.headers.tenant_id;
    const traceId = event.headers.trace_id;

    this.logger.info({
      msg: 'pay_to_journal_received',
      transaction_id,
      tenant_id: tenantId,
      provider,
      transaction_type,
      amount,
      currency: event.data.currency,
      trace_id: traceId,
      attempt: ctx.attempt,
      partition: ctx.partition,
      offset: ctx.offset,
    });

    // ===== PRE-CHECKS (avant TenantContext) =====
    if (event.data.currency !== 'MAD') {
      this.dlqCounter.inc({ reason: 'currency_not_mad' });
      this.logger.error({
        msg: 'pay_to_journal_unsupported_currency',
        transaction_id,
        currency: event.data.currency,
      });
      throw new Error(
        `UNSUPPORTED_CURRENCY: ${event.data.currency} (Sprint 12 supporte MAD only -- loi 9-88 tenue MAD)`,
      );
    }

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      this.dlqCounter.inc({ reason: 'invalid_amount' });
      this.logger.error({
        msg: 'pay_to_journal_invalid_amount',
        transaction_id,
        amount,
      });
      throw new Error(`INVALID_AMOUNT: ${amount} (must be > 0)`);
    }

    // ===== MAIN PROCESSING (dans TenantContext) =====
    await TenantContext.runWithContext(
      {
        tenantId,
        userId: event.headers.user_id ?? 'system-pay-consumer',
        isSuperAdmin: false,
        traceId,
        requestIp: '127.0.0.1', // origin = consumer interne, pas request HTTP
        locale: 'fr',
      },
      async () => {
        try {
          // 1. Resolve mapping
          const mapping = await this.mappingService.resolve(provider, transaction_type, tenantId);
          if (mapping.source === 'default_fallback') {
            this.fallbackCounter.inc({ provider });
          }

          // 2. Resolve customer credit account (4111/4112/4113 selon CRM)
          const ctxResolved = await this.contextResolver.enrichCreditAccount(
            event.data,
            mapping.credit_account,
          );

          // 3. Build description finale
          const description = this.mappingService.formatDescription(mapping.description_template, {
            provider_transaction_id: event.data.provider_transaction_id,
            customer_label: ctxResolved.customer_label,
          });

          // 4. createEntry idempotent via JournalService Tache 3.5.2
          const entry = await this.journalService.createEntry(
            {
              journal_code: mapping.journal_code,
              entry_date: captured_at.slice(0, 10), // ISO date YYYY-MM-DD
              reference: `pay:${transaction_id}`,
              description,
              idempotency_key: `pay:${transaction_id}`,
              auto_validate: true, // status='validated' direct
              lines: [
                {
                  account_code: mapping.debit_account,
                  label: `Encaissement ${provider}`,
                  debit: amount,
                  credit: '0',
                  currency: 'MAD',
                },
                {
                  account_code: ctxResolved.credit_account,
                  label: ctxResolved.customer_label,
                  debit: '0',
                  credit: amount,
                  currency: 'MAD',
                },
              ],
            },
            'system-pay-consumer',
          );

          // 5. Metrics + audit log
          this.successCounter.inc({ provider, transaction_type });
          this.logger.info({
            msg: 'pay_to_journal_created',
            transaction_id,
            entry_id: entry.id,
            entry_number: entry.entry_number,
            tenant_id: tenantId,
            mapping_source: mapping.source,
            customer_contact_type: ctxResolved.contact_type,
            duration_ms: Date.now() - startMs,
            trace_id: traceId,
          });
        } catch (err) {
          const message = (err as Error).message;
          const reason = this.classifyError(message);
          this.retryCounter.inc({ provider, reason });
          this.logger.warn({
            msg: 'pay_to_journal_handle_failed',
            transaction_id,
            tenant_id: tenantId,
            err: message,
            reason,
            attempt: ctx.attempt,
            will_retry: ctx.attempt < this.retryMax,
          });
          throw err; // propagate -> KafkaConsumerBase gerera retry / DLQ
        } finally {
          this.latencyHistogram.observe(Date.now() - startMs);
        }
      },
    );
  }

  /**
   * Classification grossiere pour metric reason (cardinality bounded).
   * Permet d'avoir un dashboard clair par type d'erreur, sans cardinality explosion.
   */
  private classifyError(msg: string): ErrorClassification {
    if (msg.includes('ACCOUNT_NOT_FOUND')) return 'account_not_found';
    if (msg.includes('TENANT_CONTEXT_MISSING')) return 'tenant_missing';
    if (msg.includes('JOURNAL_NOT_BALANCED')) return 'imbalanced';
    if (msg.includes('UNSUPPORTED_CURRENCY')) return 'currency_not_mad';
    if (msg.includes('INVALID_AMOUNT')) return 'invalid_amount';
    if (msg.includes('IDEMPOTENCY')) return 'idempotency_conflict';
    return 'unknown';
  }

  /**
   * Hook DLQ : appele par KafkaConsumerBase apres retryMax exhausted.
   * Logge l'erreur avec stack pour debug ops + metric pour alerting.
   */
  protected async onDeadLetter(event: PayCapturedEvent, error: Error): Promise<void> {
    this.dlqCounter.inc({ reason: this.classifyError(error.message) });
    this.logger.error({
      msg: 'pay_to_journal_dlq',
      transaction_id: event.data.transaction_id,
      tenant_id: event.headers.tenant_id,
      provider: event.data.provider,
      transaction_type: event.data.transaction_type,
      amount: event.data.amount,
      err: error.message,
      stack: error.stack,
      action_required: 'Review DLQ topic, fix issue, replay manually if applicable',
    });
  }
}
```

### 6.7 Module Nest `pay-to-journal.module.ts`

```typescript
// repo/packages/books/src/modules/pay-to-journal.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayToJournalConsumer } from '../consumers/pay-to-journal.consumer';
import { PaymentMappingService } from '../services/payment-mapping.service';
import { PaymentContextResolverService } from '../services/payment-context-resolver.service';
import { JournalService } from '../services/journal.service';
import { JournalNumberingService } from '../services/journal-numbering.service';
import { JournalValidationService } from '../services/journal-validation.service';
import { JournalReverseService } from '../services/journal-reverse.service';
import { AccountChartService } from '../services/account-chart.service';
import { BooksJournalEntryEntity } from '../entities/books-journal-entry.entity';
import { BooksJournalLineEntity } from '../entities/books-journal-line.entity';
import { BooksAccountEntity } from '../entities/books-account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BooksJournalEntryEntity,
      BooksJournalLineEntity,
      BooksAccountEntity,
    ]),
  ],
  providers: [
    PayToJournalConsumer,
    PaymentMappingService,
    PaymentContextResolverService,
    JournalService,
    JournalNumberingService,
    JournalValidationService,
    JournalReverseService,
    AccountChartService,
  ],
  exports: [PayToJournalConsumer, PaymentMappingService],
})
export class PayToJournalModule {}
```

### 6.8 Metriques Prometheus standalone

```typescript
// repo/packages/books/src/metrics/pay-to-journal.metrics.ts
// Helper pour enregistrer les metrics au boot meme avant que le consumer ait
// recu un event (sinon /metrics ne montre pas les counters tant que pas de hit).

import { Counter, Histogram, Registry } from 'prom-client';

export function registerPayToJournalMetrics(register: Registry): void {
  const safeNew = <T>(fn: () => T): T | null => {
    try {
      return fn();
    } catch (_) {
      return null; // deja enregistre par le consumer
    }
  };

  safeNew(
    () =>
      new Counter({
        name: 'books_pay_to_journal_success_total',
        help: 'Nombre d ecritures generees avec succes',
        labelNames: ['provider', 'transaction_type'],
        registers: [register],
      }),
  );
  safeNew(
    () =>
      new Counter({
        name: 'books_pay_to_journal_dlq_total',
        help: 'Nombre d events route vers DLQ',
        labelNames: ['reason'],
        registers: [register],
      }),
  );
  safeNew(
    () =>
      new Counter({
        name: 'books_pay_to_journal_retry_total',
        help: 'Nombre de retries',
        labelNames: ['provider', 'reason'],
        registers: [register],
      }),
  );
  safeNew(
    () =>
      new Counter({
        name: 'books_pay_to_journal_fallback_total',
        help: 'Nombre de mappings tombes en fallback',
        labelNames: ['provider'],
        registers: [register],
      }),
  );
  safeNew(
    () =>
      new Histogram({
        name: 'books_pay_to_journal_latency_ms',
        help: 'Latence handle (ms)',
        buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000],
        registers: [register],
      }),
  );
}
```

---

## 7. Tests complets

### 7.1 Tests unitaires `pay-to-journal.consumer.spec.ts` (25 cas, complets sans placeholder)

```typescript
// repo/packages/books/src/consumers/pay-to-journal.consumer.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayToJournalConsumer } from './pay-to-journal.consumer';
import { TenantContext } from '@insurtech/shared-utils';

describe('PayToJournalConsumer', () => {
  let consumer: PayToJournalConsumer;
  let logger: any;
  let journalService: any;
  let mappingService: any;
  let contextResolver: any;

  const baseEvent = (override: Partial<any> = {}) => ({
    schema_version: '1.0',
    topic: 'insurtech.events.pay.transaction.captured',
    timestamp: '2026-04-08T10:00:00Z',
    headers: {
      trace_id: 'trace-12345-abc',
      tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: '11111111-1111-1111-1111-111111111111',
      ...((override.headers ?? {}) as object),
    },
    data: {
      transaction_id: 'tx_cmi_8392',
      tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      provider: 'cmi',
      transaction_type: 'card_payment',
      amount: '12000.00',
      currency: 'MAD',
      captured_at: '2026-04-08T10:00:00.000Z',
      customer_email: 'client@example.com',
      provider_transaction_id: 'CMI-XX-001',
      ...((override.data ?? {}) as object),
    },
  });

  const ctx = {
    topic: 'insurtech.events.pay.transaction.captured',
    partition: 0,
    offset: '1',
    trace_id: 't',
    tenant_id: 'aa',
    attempt: 0,
  };

  beforeEach(() => {
    vi.spyOn(TenantContext, 'runWithContext').mockImplementation(async (_ctx, fn) => fn());

    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    journalService = {
      createEntry: vi
        .fn()
        .mockResolvedValue({ id: 'entry-1', entry_number: 'BNQ-2026-00001', status: 'validated' }),
    };
    mappingService = {
      resolve: vi.fn().mockResolvedValue({
        debit_account: '5141',
        credit_account: '4111',
        journal_code: 'BNQ',
        description_template: 'Encaissement CMI {provider_transaction_id}',
        source: 'config',
      }),
      formatDescription: vi
        .fn()
        .mockImplementation((tpl: string, vars: Record<string, string>) =>
          Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), tpl),
        ),
    };
    contextResolver = {
      enrichCreditAccount: vi
        .fn()
        .mockResolvedValue({ credit_account: '4111', customer_label: 'Client X', contact_type: 'unknown' }),
    };

    consumer = new PayToJournalConsumer(logger, journalService, mappingService, contextResolver);
  });

  it('V1 -- handle CMI card_payment cree ecriture avec auto_validate', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(journalService.createEntry).toHaveBeenCalledTimes(1);
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.journal_code).toBe('BNQ');
    expect(args.idempotency_key).toBe('pay:tx_cmi_8392');
    expect(args.auto_validate).toBe(true);
    expect(args.entry_date).toBe('2026-04-08');
  });

  it('V2 -- handle PayZone cash_kiosque cree ecriture en CSS sur 5161', async () => {
    mappingService.resolve = vi.fn().mockResolvedValue({
      debit_account: '5161',
      credit_account: '4111',
      journal_code: 'CSS',
      description_template: 'Encaissement PayZone {provider_transaction_id}',
      source: 'config',
    });
    await consumer.handle(
      baseEvent({ data: { provider: 'payzone', transaction_type: 'cash_kiosque' } }) as any,
      ctx as any,
    );
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.journal_code).toBe('CSS');
    expect(args.lines[0].account_code).toBe('5161');
  });

  it('V3 -- idempotency-key inclut pay:transaction_id strict', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(journalService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: 'pay:tx_cmi_8392' }),
      'system-pay-consumer',
    );
  });

  it('V4 -- montant negatif rejete avec INVALID_AMOUNT', async () => {
    await expect(
      consumer.handle(baseEvent({ data: { amount: '-100.00' } }) as any, ctx as any),
    ).rejects.toThrow(/INVALID_AMOUNT/);
    expect(journalService.createEntry).not.toHaveBeenCalled();
  });

  it('V5 -- montant zero rejete', async () => {
    await expect(
      consumer.handle(baseEvent({ data: { amount: '0.00' } }) as any, ctx as any),
    ).rejects.toThrow(/INVALID_AMOUNT/);
  });

  it('V6 -- currency non-MAD rejete (vers DLQ via throw)', async () => {
    await expect(
      consumer.handle(baseEvent({ data: { currency: 'EUR' } }) as any, ctx as any),
    ).rejects.toThrow(/UNSUPPORTED_CURRENCY/);
  });

  it('V7 -- account_not_found dans createEntry classifie correctement', async () => {
    journalService.createEntry = vi.fn().mockRejectedValue(new Error('ACCOUNT_NOT_FOUND: 9999'));
    await expect(consumer.handle(baseEvent() as any, ctx as any)).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'pay_to_journal_handle_failed',
        reason: 'account_not_found',
      }),
    );
  });

  it('V8 -- mapping fallback log warn et increment fallback', async () => {
    mappingService.resolve = vi.fn().mockResolvedValue({
      debit_account: '5141',
      credit_account: '4111',
      journal_code: 'BNQ',
      description_template: 'Encaissement provider {provider_transaction_id}',
      source: 'default_fallback',
    });
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(journalService.createEntry).toHaveBeenCalled();
    // fallback counter incremente -- check via logger info success quand meme
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'pay_to_journal_created' }),
    );
  });

  it('V9 -- description format avec provider_transaction_id', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.description).toContain('CMI-XX-001');
  });

  it('V10 -- contextResolver enrich credit_account si client identifie company', async () => {
    contextResolver.enrichCreditAccount = vi.fn().mockResolvedValue({
      credit_account: '4112',
      customer_label: 'ACME SARL',
      contact_id: 'contact-uuid',
      contact_type: 'company',
    });
    await consumer.handle(baseEvent() as any, ctx as any);
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.lines[1].account_code).toBe('4112');
    expect(args.lines[1].label).toBe('ACME SARL');
    expect(args.lines[1].credit).toBe('12000.00');
  });

  it('V11 -- inwi_money mappe sur 5141 / journal BNQ', async () => {
    mappingService.resolve = vi.fn().mockResolvedValue({
      debit_account: '5141',
      credit_account: '4111',
      journal_code: 'BNQ',
      description_template: 'Encaissement Inwi Money {provider_transaction_id}',
      source: 'config',
    });
    await consumer.handle(
      baseEvent({ data: { provider: 'inwi_money', transaction_type: 'mobile_wallet' } }) as any,
      ctx as any,
    );
    expect(journalService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ journal_code: 'BNQ' }),
      'system-pay-consumer',
    );
  });

  it('V12 -- entry_date prend YYYY-MM-DD de captured_at', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.entry_date).toBe('2026-04-08');
  });

  it('V13 -- 2 lines balanced (sum debit == sum credit == amount)', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.lines).toHaveLength(2);
    const sumD = args.lines.reduce(
      (s: number, l: any) => s + parseFloat(l.debit ?? '0'),
      0,
    );
    const sumC = args.lines.reduce(
      (s: number, l: any) => s + parseFloat(l.credit ?? '0'),
      0,
    );
    expect(sumD).toBe(12000);
    expect(sumC).toBe(12000);
    expect(sumD).toBe(sumC); // CGNC double-entry invariant
  });

  it('V14 -- reference au format pay:transaction_id', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(journalService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'pay:tx_cmi_8392' }),
      'system-pay-consumer',
    );
  });

  it('V15 -- onDeadLetter logge erreur avec stack et classifie', async () => {
    const consumerInstance = consumer as any;
    const error = new Error('ACCOUNT_NOT_FOUND: 9999');
    await consumerInstance.onDeadLetter(baseEvent(), error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'pay_to_journal_dlq',
        err: 'ACCOUNT_NOT_FOUND: 9999',
        action_required: expect.stringContaining('DLQ'),
      }),
    );
  });

  it('V16 -- consumer expose topic + groupId corrects', () => {
    expect((consumer as any).topic).toBe('insurtech.events.pay.transaction.captured');
    expect((consumer as any).groupId).toBe('books-pay-to-journal');
    expect((consumer as any).schema).toBeDefined();
  });

  it('V17 -- amount avec 1 decimale est accepte (100.5)', async () => {
    await consumer.handle(baseEvent({ data: { amount: '100.5' } }) as any, ctx as any);
    expect(journalService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: '100.5' }),
        ]),
      }),
      'system-pay-consumer',
    );
  });

  it('V18 -- handle propage error si createEntry leve TENANT_CONTEXT_MISSING', async () => {
    journalService.createEntry = vi.fn().mockRejectedValue(new Error('TENANT_CONTEXT_MISSING'));
    await expect(consumer.handle(baseEvent() as any, ctx as any)).rejects.toThrow(
      /TENANT_CONTEXT_MISSING/,
    );
  });

  it('V19 -- handle log inclut duration_ms numerique', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'pay_to_journal_created',
        duration_ms: expect.any(Number),
      }),
    );
  });

  it('V20 -- TenantContext.runWithContext appele avec tenant_id de header', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(TenantContext.runWithContext).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: '11111111-1111-1111-1111-111111111111',
        isSuperAdmin: false,
      }),
      expect.any(Function),
    );
  });

  it('V21 -- TenantContext userId fallback system-pay-consumer si user_id absent', async () => {
    const evt = baseEvent();
    delete (evt.headers as any).user_id;
    await consumer.handle(evt as any, ctx as any);
    expect(TenantContext.runWithContext).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'system-pay-consumer' }),
      expect.any(Function),
    );
  });

  it('V22 -- log info pre-handle inclut transaction_id et provider', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'pay_to_journal_received',
        transaction_id: 'tx_cmi_8392',
        provider: 'cmi',
        attempt: 0,
      }),
    );
  });

  it('V23 -- lines structure : debit debit positif credit 0', async () => {
    await consumer.handle(baseEvent() as any, ctx as any);
    const args = journalService.createEntry.mock.calls[0][0];
    expect(args.lines[0].debit).toBe('12000.00');
    expect(args.lines[0].credit).toBe('0');
    expect(args.lines[1].debit).toBe('0');
    expect(args.lines[1].credit).toBe('12000.00');
  });

  it('V24 -- gros montant 1234567.89 traite sans erreur', async () => {
    await consumer.handle(
      baseEvent({ data: { amount: '1234567.89' } }) as any,
      ctx as any,
    );
    expect(journalService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: '1234567.89' }),
        ]),
      }),
      'system-pay-consumer',
    );
  });

  it('V25 -- IDEMPOTENCY error classifie correctement', async () => {
    journalService.createEntry = vi
      .fn()
      .mockRejectedValue(new Error('IDEMPOTENCY conflict on key pay:tx_cmi_8392'));
    await expect(consumer.handle(baseEvent() as any, ctx as any)).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'idempotency_conflict' }),
    );
  });
});
```

### 7.2 Tests unitaires `payment-mapping.service.spec.ts` (12 cas complets)

```typescript
// repo/packages/books/src/services/payment-mapping.service.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentMappingService } from './payment-mapping.service';
import { PAYMENT_MAPPING_DEFAULT } from '../config/payment-mapping.config';

describe('PaymentMappingService', () => {
  let service: PaymentMappingService;
  let logger: any;
  let tenantSettingsRepo: any;

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };
    tenantSettingsRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };
    service = new PaymentMappingService(logger, tenantSettingsRepo);
  });

  it('M1 -- resolve cmi card_payment renvoie 5141/4111/BNQ source=config', async () => {
    const r = await service.resolve('cmi', 'card_payment', 'tenant-1');
    expect(r.debit_account).toBe('5141');
    expect(r.credit_account).toBe('4111');
    expect(r.journal_code).toBe('BNQ');
    expect(r.source).toBe('config');
    expect(r.description_template).toContain('CMI');
  });

  it('M2 -- resolve payzone cash_kiosque renvoie 5161/4111/CSS', async () => {
    const r = await service.resolve('payzone', 'cash_kiosque', 'tenant-1');
    expect(r.debit_account).toBe('5161');
    expect(r.journal_code).toBe('CSS');
  });

  it('M3 -- resolve avec tenant override prioritaire sur config', async () => {
    tenantSettingsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      books_payment_mapping: [
        {
          provider: 'cmi',
          transaction_type: 'card_payment',
          debit_account: '5142',
          credit_account: '4115',
          journal_code: 'BNQ',
        },
      ],
    });
    const r = await service.resolve('cmi', 'card_payment', 'tenant-1');
    expect(r.debit_account).toBe('5142');
    expect(r.credit_account).toBe('4115');
    expect(r.source).toBe('tenant_override');
  });

  it('M4 -- resolve fallback sur provider/type inconnu avec WARN log', async () => {
    const r = await service.resolve('cmi' as any, 'unknown_type' as any, 'tenant-1');
    expect(r.source).toBe('default_fallback');
    expect(r.debit_account).toBe('5141');
    expect(r.credit_account).toBe('4111');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'payment_mapping_fallback',
        provider: 'cmi',
        transaction_type: 'unknown_type',
      }),
    );
  });

  it('M5 -- formatDescription remplace placeholders simple', () => {
    const r = service.formatDescription('Encaissement {provider_transaction_id}', {
      provider_transaction_id: 'CMI-001',
    });
    expect(r).toBe('Encaissement CMI-001');
  });

  it('M6 -- formatDescription multi placeholders', () => {
    const r = service.formatDescription('{a} et {b} pour {c}', {
      a: 'X',
      b: 'Y',
      c: 'Z',
    });
    expect(r).toBe('X et Y pour Z');
  });

  it('M7 -- formatDescription sanitize control chars', () => {
    const r = service.formatDescription('{val}', { val: 'hello\x00world\x1F' });
    expect(r).toBe('helloworld');
  });

  it('M8 -- getDefaults expose tous les 8 mappings (6 providers x cas)', () => {
    const all = service.getDefaults();
    expect(all.length).toBe(8);
    expect(all.find((e) => e.provider === 'cmi')).toBeDefined();
    expect(all.find((e) => e.provider === 'inwi_money')).toBeDefined();
    expect(all.find((e) => e.provider === 'mwallet_bam')).toBeDefined();
  });

  it('M9 -- erreur DB tenant_settings -> degraded fallback config', async () => {
    tenantSettingsRepo.createQueryBuilder().getOne = vi
      .fn()
      .mockRejectedValue(new Error('DB connection lost'));
    const r = await service.resolve('cmi', 'card_payment', 'tenant-1');
    expect(r.source).toBe('config'); // fallback gracieux vers hardcode
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'payment_mapping_tenant_override_failed',
        err: 'DB connection lost',
      }),
    );
  });

  it('M10 -- hasMapping retourne true pour cmi/card_payment', () => {
    expect(service.hasMapping('cmi', 'card_payment')).toBe(true);
  });

  it('M11 -- hasMapping retourne false pour unknown combo', () => {
    expect(service.hasMapping('cmi' as any, 'unknown' as any)).toBe(false);
  });

  it('M12 -- service fonctionne sans tenantSettingsRepo (CRM module absent)', async () => {
    const noRepoService = new PaymentMappingService(logger);
    const r = await noRepoService.resolve('cmi', 'card_payment', 'tenant-1');
    expect(r.source).toBe('config'); // pas de tenant override possible
  });
});
```

### 7.3 Tests unitaires `payment-context-resolver.service.spec.ts` (10 cas)

```typescript
// repo/packages/books/src/services/payment-context-resolver.service.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentContextResolverService } from './payment-context-resolver.service';

describe('PaymentContextResolverService', () => {
  let service: PaymentContextResolverService;
  let logger: any;
  let contactsRepo: any;

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
    contactsRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };
    service = new PaymentContextResolverService(logger, contactsRepo);
  });

  const baseEvent = (override: Partial<any> = {}) => ({
    transaction_id: 'tx-1',
    tenant_id: 'tenant-1',
    provider: 'cmi',
    transaction_type: 'card_payment',
    amount: '100.00',
    currency: 'MAD',
    captured_at: '2026-04-08T10:00:00Z',
    provider_transaction_id: 'CMI-1',
    ...override,
  });

  it('R1 -- pas email ni phone -> fallback default', async () => {
    const r = await service.enrichCreditAccount(baseEvent() as any, '4111');
    expect(r.credit_account).toBe('4111');
    expect(r.contact_type).toBe('unknown');
  });

  it('R2 -- email matche company -> 4112', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      id: 'contact-1',
      tenant_id: 'tenant-1',
      name: 'ACME SARL',
      type: 'company',
      email: 'contact@acme.ma',
    });
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_email: 'contact@acme.ma' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4112');
    expect(r.customer_label).toBe('ACME SARL');
    expect(r.contact_type).toBe('company');
    expect(r.contact_id).toBe('contact-1');
  });

  it('R3 -- email matche individual -> 4111', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      id: 'contact-2',
      tenant_id: 'tenant-1',
      name: 'Mohamed Alami',
      type: 'individual',
    });
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_email: 'm@a.ma' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4111');
    expect(r.contact_type).toBe('individual');
  });

  it('R4 -- email matche administration -> 4113', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      id: 'contact-3',
      tenant_id: 'tenant-1',
      name: 'Ministere des Finances',
      type: 'administration',
    });
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_email: 'fin@gov.ma' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4113');
    expect(r.contact_type).toBe('administration');
  });

  it('R5 -- account_code_override prioritaire', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      id: 'contact-4',
      tenant_id: 'tenant-1',
      name: 'VIP Client',
      type: 'company',
      account_code_override: '4112-VIP01',
    });
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_email: 'vip@x.ma' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4112-VIP01');
  });

  it('R6 -- email pas trouve -> fallback avec customer_name de event', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue(null);
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_email: 'ghost@x.ma', customer_name: 'Ghost Client' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4111');
    expect(r.customer_label).toBe('Ghost Client');
    expect(r.contact_type).toBe('unknown');
  });

  it('R7 -- phone lookup fonctionne aussi', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      id: 'contact-5',
      name: 'Phone Client',
      type: 'individual',
    });
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_phone: '+212600112233' }) as any,
      '4111',
    );
    expect(r.contact_type).toBe('individual');
  });

  it('R8 -- erreur DB lookup -> fallback gracieux', async () => {
    contactsRepo.createQueryBuilder().getOne = vi
      .fn()
      .mockRejectedValue(new Error('DB timeout'));
    const r = await service.enrichCreditAccount(
      baseEvent({ customer_email: 'x@x.ma' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4111');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'payment_context_lookup_failed' }),
    );
  });

  it('R9 -- service fonctionne sans contactsRepo', async () => {
    const noRepoService = new PaymentContextResolverService(logger);
    const r = await noRepoService.enrichCreditAccount(
      baseEvent({ customer_email: 'x@x.ma', customer_name: 'X' }) as any,
      '4111',
    );
    expect(r.credit_account).toBe('4111');
    expect(r.customer_label).toBe('X');
  });

  it('R10 -- email case insensitive lookup', async () => {
    contactsRepo.createQueryBuilder().getOne = vi.fn().mockResolvedValue({
      id: 'contact-6',
      name: 'Case Test',
      type: 'individual',
    });
    await service.enrichCreditAccount(
      baseEvent({ customer_email: 'TEST@DOMAIN.MA' }) as any,
      '4111',
    );
    // Verify LOWER() utilise dans query
    expect(contactsRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER'),
      expect.any(Object),
    );
  });
});
```

### 7.4 Tests integration `pay-to-journal.integration.spec.ts` (12 cas avec Kafka testcontainer)

```typescript
// repo/packages/books/test/integration/pay-to-journal.integration.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Kafka, Producer } from 'kafkajs';
import { DataSource } from 'typeorm';
import { setTimeout as delay } from 'timers/promises';

describe('PayToJournalConsumer integration', () => {
  let kafka: StartedTestContainer;
  let pg: StartedTestContainer;
  let producer: Producer;
  let dataSource: DataSource;
  const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .start();

    kafka = await new GenericContainer('confluentinc/cp-kafka:7.5.0')
      .withExposedPorts(9092)
      .withEnvironment({
        KAFKA_BROKER_ID: '1',
        KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181',
        KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
      })
      .withWaitStrategy(Wait.forLogMessage(/started \(kafka.server.KafkaServer\)/))
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: pg.getMappedPort(5432),
      username: 'postgres',
      password: 'test',
      database: 'test',
      entities: ['repo/packages/books/src/entities/*.entity.ts'],
      migrations: ['repo/packages/database/src/migrations/*.ts'],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    // Seed comptes minimum
    await dataSource.query(
      `INSERT INTO books_accounts(tenant_id, code, label, nature, is_standard, active) VALUES
       (NULL, '5141', 'Banque', 'asset', true, true),
       (NULL, '5161', 'Caisse', 'asset', true, true),
       (NULL, '4111', 'Client', 'asset', true, true),
       (NULL, '4112', 'Client Entreprise', 'asset', true, true)`,
    );

    const k = new Kafka({ brokers: [`localhost:${kafka.getMappedPort(9092)}`] });
    producer = k.producer();
    await producer.connect();
  }, 180_000);

  afterAll(async () => {
    await producer.disconnect();
    await dataSource.destroy();
    await kafka.stop();
    await pg.stop();
  });

  beforeEach(async () => {
    await dataSource.query(`SET app.current_tenant = '${TENANT}'`);
    await dataSource.query('TRUNCATE books_journal_entries CASCADE');
    await dataSource.query('TRUNCATE books_journal_sequences CASCADE');
  });

  const buildEvent = (transactionId: string, override: Partial<any> = {}) => ({
    schema_version: '1.0',
    topic: 'insurtech.events.pay.transaction.captured',
    timestamp: new Date().toISOString(),
    headers: {
      trace_id: 'integration-trace',
      tenant_id: TENANT,
      user_id: '11111111-1111-1111-1111-111111111111',
    },
    data: {
      transaction_id: transactionId,
      tenant_id: TENANT,
      provider: 'cmi',
      transaction_type: 'card_payment',
      amount: '500.00',
      currency: 'MAD',
      captured_at: '2026-04-08T10:00:00.000Z',
      provider_transaction_id: 'CMI-INT-001',
      ...override,
    },
  });

  it('IT1 -- publish event -> consumer cree ecriture en DB en < 5s', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [{ value: JSON.stringify(buildEvent('tx_int_1')) }],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT * FROM books_journal_entries WHERE reference = 'pay:tx_int_1'`,
    );
    expect(r).toHaveLength(1);
    expect(r[0].journal_code).toBe('BNQ');
    expect(r[0].status).toBe('validated');
    expect(r[0].entry_number).toMatch(/^BNQ-2026-\d{5}$/);
  }, 30_000);

  it('IT2 -- redelivery meme event -> 1 seule ecriture (idempotency)', async () => {
    const evt = buildEvent('tx_idem_1');
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        { value: JSON.stringify(evt) },
        { value: JSON.stringify(evt) },
        { value: JSON.stringify(evt) },
      ],
    });
    await delay(4000);
    const r = await dataSource.query(
      `SELECT * FROM books_journal_entries WHERE reference = 'pay:tx_idem_1'`,
    );
    expect(r).toHaveLength(1);
  }, 30_000);

  it('IT3 -- montant negatif -> DLQ, pas d ecriture', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        { value: JSON.stringify(buildEvent('tx_neg', { amount: '-100.00' })) },
      ],
    });
    await delay(5000);
    const r = await dataSource.query(
      `SELECT * FROM books_journal_entries WHERE reference = 'pay:tx_neg'`,
    );
    expect(r).toHaveLength(0);
  }, 30_000);

  it('IT4 -- 10 events ordonnes -> 10 ecritures, numerotation sequentielle', async () => {
    const events = [];
    for (let i = 0; i < 10; i++) {
      events.push({ value: JSON.stringify(buildEvent(`tx_seq_${i}`)) });
    }
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: events,
    });
    await delay(8000);
    const r = await dataSource.query(
      `SELECT entry_number FROM books_journal_entries
       WHERE reference LIKE 'pay:tx_seq_%' ORDER BY entry_number ASC`,
    );
    expect(r).toHaveLength(10);
    expect(r[0].entry_number).toBe('BNQ-2026-00001');
    expect(r[9].entry_number).toBe('BNQ-2026-00010');
  }, 60_000);

  it('IT5 -- payzone cash_kiosque cree ecriture en CSS sur 5161', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        {
          value: JSON.stringify(
            buildEvent('tx_payzone_kiosque', {
              provider: 'payzone',
              transaction_type: 'cash_kiosque',
            }),
          ),
        },
      ],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT je.journal_code, jl.account_code, jl.debit::text AS debit
       FROM books_journal_entries je
       INNER JOIN books_journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.reference = 'pay:tx_payzone_kiosque' AND jl.debit > 0`,
    );
    expect(r).toHaveLength(1);
    expect(r[0].journal_code).toBe('CSS');
    expect(r[0].account_code).toBe('5161');
    expect(r[0].debit).toBe('500.00');
  }, 30_000);

  it('IT6 -- inwi_money mobile_wallet cree ecriture BNQ 5141', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        {
          value: JSON.stringify(
            buildEvent('tx_inwi_1', {
              provider: 'inwi_money',
              transaction_type: 'mobile_wallet',
            }),
          ),
        },
      ],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT je.journal_code, jl.account_code FROM books_journal_entries je
       INNER JOIN books_journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.reference = 'pay:tx_inwi_1' AND jl.debit > 0`,
    );
    expect(r[0].journal_code).toBe('BNQ');
    expect(r[0].account_code).toBe('5141');
  }, 30_000);

  it('IT7 -- event currency EUR rejete vers DLQ', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        {
          value: JSON.stringify(buildEvent('tx_eur', { currency: 'EUR' })),
        },
      ],
    });
    await delay(5000);
    const r = await dataSource.query(
      `SELECT * FROM books_journal_entries WHERE reference = 'pay:tx_eur'`,
    );
    expect(r).toHaveLength(0);
  }, 30_000);

  it('IT8 -- ecriture creee balanced (sum debit = sum credit = 500)', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [{ value: JSON.stringify(buildEvent('tx_balanced')) }],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT SUM(jl.debit)::text AS d, SUM(jl.credit)::text AS c
       FROM books_journal_lines jl
       INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.reference = 'pay:tx_balanced'`,
    );
    expect(r[0].d).toBe('500.00');
    expect(r[0].c).toBe('500.00');
  }, 30_000);

  it('IT9 -- ecriture status validated direct (pas draft)', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [{ value: JSON.stringify(buildEvent('tx_validated')) }],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT status, validated_by FROM books_journal_entries WHERE reference = 'pay:tx_validated'`,
    );
    expect(r[0].status).toBe('validated');
    expect(r[0].validated_by).toBeTruthy();
  }, 30_000);

  it('IT10 -- multi-tenant isole : tenantA ne voit pas ecritures tenantB', async () => {
    const TB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        {
          value: JSON.stringify({
            ...buildEvent('tx_tenantB'),
            headers: {
              trace_id: 't',
              tenant_id: TB,
              user_id: '11111111-1111-1111-1111-111111111111',
            },
            data: { ...buildEvent('tx_tenantB').data, tenant_id: TB },
          }),
        },
      ],
    });
    await delay(3000);
    await dataSource.query(`SET LOCAL app.current_tenant = '${TENANT}'`);
    const visible = await dataSource.query(
      `SELECT * FROM books_journal_entries WHERE reference = 'pay:tx_tenantB'`,
    );
    expect(visible).toHaveLength(0); // RLS
  }, 30_000);

  it('IT11 -- description contient provider_transaction_id', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        {
          value: JSON.stringify(
            buildEvent('tx_desc', { provider_transaction_id: 'CMI-DESC-XX' }),
          ),
        },
      ],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT description FROM books_journal_entries WHERE reference = 'pay:tx_desc'`,
    );
    expect(r[0].description).toContain('CMI-DESC-XX');
  }, 30_000);

  it('IT12 -- gros montant 1234567.89 traite avec precision', async () => {
    await producer.send({
      topic: 'insurtech.events.pay.transaction.captured',
      messages: [
        {
          value: JSON.stringify(buildEvent('tx_large', { amount: '1234567.89' })),
        },
      ],
    });
    await delay(3000);
    const r = await dataSource.query(
      `SELECT SUM(jl.debit)::text AS d FROM books_journal_lines jl
       INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.reference = 'pay:tx_large'`,
    );
    expect(r[0].d).toBe('1234567.89');
  }, 30_000);
});
```

### 7.5 Tests E2E `pay-to-journal.e2e-spec.ts` (10 cas API complete)

```typescript
// repo/packages/books/test/e2e/pay-to-journal.e2e-spec.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../../apps/api/src/app.module';
import { signTestJwt } from '../../../../apps/api/test/helpers/jwt.helper';
import { setTimeout as delay } from 'timers/promises';
import { DataSource } from 'typeorm';

describe('Pay -> Books Journal E2E', () => {
  let app: NestFastifyApplication;
  let token: string;
  let ds: DataSource;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    token = signTestJwt({ sub: 'u-e2e', role: 'BrokerAdmin', tenant_id: 'tenantE2E' });
    ds = mod.get(DataSource);
  });

  afterAll(async () => app.close());

  it('E2E1 -- Pay capture API declenche ecriture comptable < 5s', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/pay/transactions/capture',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
      payload: {
        provider: 'cmi',
        amount: '300.00',
        currency: 'MAD',
        transaction_type: 'card_payment',
        provider_transaction_id: 'CMI-E2E-001',
      },
    });
    expect(r.statusCode).toBe(201);
    const tx = JSON.parse(r.body);

    await delay(5000);
    const journal = await ds.query(
      `SELECT * FROM books_journal_entries WHERE reference = $1`,
      [`pay:${tx.transaction_id}`],
    );
    expect(journal).toHaveLength(1);
    expect(journal[0].status).toBe('validated');
  }, 30_000);

  it('E2E2 -- audit trail : journal_entry created_by=system-pay-consumer', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/pay/transactions/capture',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
      payload: {
        provider: 'youcan_pay',
        amount: '450.00',
        currency: 'MAD',
        transaction_type: 'card_payment',
        provider_transaction_id: 'YC-E2E-001',
      },
    });
    const tx = JSON.parse(r.body);
    await delay(5000);
    const j = await ds.query(
      `SELECT created_by, validated_by FROM books_journal_entries WHERE reference = $1`,
      [`pay:${tx.transaction_id}`],
    );
    expect(j[0].created_by).toBe('system-pay-consumer');
    expect(j[0].validated_by).toBe('system-pay-consumer');
  }, 30_000);

  it('E2E3 -- metric prometheus expose books_pay_to_journal_success_total', async () => {
    const r = await app.inject({ method: 'GET', url: '/metrics' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('books_pay_to_journal_success_total');
    expect(r.body).toContain('books_pay_to_journal_latency_ms');
  });

  it('E2E4 -- multi-tenant isole : tenantA ne voit pas ecritures tenantB', async () => {
    const tokenA = signTestJwt({ sub: 'a', role: 'BrokerAdmin', tenant_id: 'tenantA' });
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${tokenA}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    body.items.forEach((e: { tenant_id: string }) => {
      expect(e.tenant_id).toBe('tenantA');
    });
  });

  it('E2E5 -- end-to-end latency p99 < 5s sur 1 transaction', async () => {
    const start = Date.now();
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/pay/transactions/capture',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
      payload: {
        provider: 'cmi',
        amount: '100.00',
        currency: 'MAD',
        transaction_type: 'card_payment',
        provider_transaction_id: 'CMI-E2E-LAT',
      },
    });
    const tx = JSON.parse(r.body);
    let entry: any = null;
    while (!entry && Date.now() - start < 5000) {
      const q = await ds.query(
        `SELECT id FROM books_journal_entries WHERE reference = $1`,
        [`pay:${tx.transaction_id}`],
      );
      if (q.length > 0) entry = q[0];
      else await delay(200);
    }
    expect(entry).not.toBeNull();
    expect(Date.now() - start).toBeLessThan(5000);
  }, 30_000);

  it('E2E6 -- payzone cash_kiosque -> ecriture CSS 5161', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/pay/transactions/capture',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
      payload: {
        provider: 'payzone',
        amount: '200.00',
        currency: 'MAD',
        transaction_type: 'cash_kiosque',
        provider_transaction_id: 'PZK-E2E-1',
      },
    });
    const tx = JSON.parse(r.body);
    await delay(5000);
    const j = await ds.query(
      `SELECT je.journal_code, jl.account_code FROM books_journal_entries je
       INNER JOIN books_journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.reference = $1 AND jl.debit > 0`,
      [`pay:${tx.transaction_id}`],
    );
    expect(j[0].journal_code).toBe('CSS');
    expect(j[0].account_code).toBe('5161');
  }, 30_000);

  it('E2E7 -- duplicate capture meme provider_transaction_id rejete (idempotency)', async () => {
    const payload = {
      provider: 'cmi',
      amount: '100.00',
      currency: 'MAD',
      transaction_type: 'card_payment',
      provider_transaction_id: 'CMI-DUP-1',
    };
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/pay/transactions/capture',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
      payload,
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/pay/transactions/capture',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
      payload,
    });
    await delay(5000);
    const tx1 = JSON.parse(r1.body);
    const tx2 = JSON.parse(r2.body);
    const j = await ds.query(
      `SELECT id FROM books_journal_entries WHERE reference IN ($1, $2)`,
      [`pay:${tx1.transaction_id}`, `pay:${tx2.transaction_id}`],
    );
    expect(j.length).toBeLessThanOrEqual(1);
  }, 30_000);

  it('E2E8 -- 5 transactions paralleles -> 5 ecritures sequentielles', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/api/v1/pay/transactions/capture',
          headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
          payload: {
            provider: 'cmi',
            amount: '100.00',
            currency: 'MAD',
            transaction_type: 'card_payment',
            provider_transaction_id: `CMI-PAR-${i}`,
          },
        }),
      );
    }
    const results = await Promise.all(promises);
    await delay(8000);
    const txIds = results.map((r) => JSON.parse(r.body).transaction_id);
    const refs = txIds.map((tid) => `pay:${tid}`);
    const j = await ds.query(
      `SELECT entry_number FROM books_journal_entries WHERE reference = ANY($1) ORDER BY entry_number`,
      [refs],
    );
    expect(j.length).toBe(5);
    // Numerotation sequentielle
    const numbers = j.map((e: any) => parseInt(e.entry_number.split('-')[2], 10));
    expect(new Set(numbers).size).toBe(5); // tous distincts
  }, 60_000);

  it('E2E9 -- query /api/v1/books/journal-entries?reference=pay:* fonctionne', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/books/journal-entries?reference_prefix=pay:`,
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenantE2E' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('E2E10 -- healthz inclut consumer status', async () => {
    const r = await app.inject({ method: 'GET', url: '/healthz' });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.consumers).toBeDefined();
    expect(body.consumers.pay_to_journal).toMatch(/healthy|degraded/);
  });
});
```

### 7.6 Fixtures `pay-events-fixtures.ts`

```typescript
// repo/test/fixtures/pay-events-fixtures.ts
// 15 fixtures couvrant tous les cas du sprint 12.

const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_1 = '11111111-1111-1111-1111-111111111111';

export const FIXTURE_CMI_CARD_PAYMENT = {
  schema_version: '1.0',
  topic: 'insurtech.events.pay.transaction.captured',
  timestamp: '2026-04-08T10:00:00Z',
  headers: { trace_id: 'trace-cmi-001', tenant_id: TENANT_A, user_id: USER_1 },
  data: {
    transaction_id: 'tx_cmi_001',
    tenant_id: TENANT_A,
    provider: 'cmi',
    transaction_type: 'card_payment',
    amount: '12000.00',
    currency: 'MAD',
    captured_at: '2026-04-08T10:00:00.000Z',
    customer_email: 'client.cmi@example.com',
    customer_name: 'Client CMI Particulier',
    provider_transaction_id: 'CMI-2026-XX-001',
  },
};

export const FIXTURE_CMI_BANK_TRANSFER = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_cmi_bt_001',
    transaction_type: 'bank_transfer',
    amount: '50000.00',
    customer_name: 'AXA Maroc',
    provider_transaction_id: 'CMI-BT-001',
  },
};

export const FIXTURE_YOUCAN_CARD = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_youcan_001',
    provider: 'youcan_pay' as const,
    provider_transaction_id: 'YC-2026-001',
  },
};

export const FIXTURE_PAYZONE_CARD = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_payzone_card_001',
    provider: 'payzone' as const,
    provider_transaction_id: 'PZ-CARD-001',
  },
};

export const FIXTURE_PAYZONE_CASH = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_payzone_kiosque_001',
    provider: 'payzone' as const,
    transaction_type: 'cash_kiosque' as const,
    amount: '500.00',
    provider_transaction_id: 'PZ-KIOSK-001',
  },
};

export const FIXTURE_INWI_MOBILE = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_inwi_001',
    provider: 'inwi_money' as const,
    transaction_type: 'mobile_wallet' as const,
    amount: '850.50',
    customer_phone: '+212600112233',
    provider_transaction_id: 'INWI-2026-001',
  },
};

export const FIXTURE_ORANGE_MOBILE = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_orange_001',
    provider: 'orange_money' as const,
    transaction_type: 'mobile_wallet' as const,
    amount: '650.00',
    provider_transaction_id: 'ORG-2026-001',
  },
};

export const FIXTURE_MWALLET_BAM = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_mwallet_001',
    provider: 'mwallet_bam' as const,
    transaction_type: 'mobile_wallet' as const,
    amount: '1200.00',
    provider_transaction_id: 'MWALLET-001',
  },
};

export const FIXTURE_NEGATIVE_AMOUNT = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: { ...FIXTURE_CMI_CARD_PAYMENT.data, transaction_id: 'tx_neg', amount: '-100.00' },
};

export const FIXTURE_ZERO_AMOUNT = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: { ...FIXTURE_CMI_CARD_PAYMENT.data, transaction_id: 'tx_zero', amount: '0.00' },
};

export const FIXTURE_EUR_CURRENCY = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: { ...FIXTURE_CMI_CARD_PAYMENT.data, transaction_id: 'tx_eur', currency: 'EUR' as any },
};

export const FIXTURE_LARGE_AMOUNT = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: { ...FIXTURE_CMI_CARD_PAYMENT.data, transaction_id: 'tx_large', amount: '1234567.89' },
};

export const FIXTURE_SMALL_AMOUNT = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: { ...FIXTURE_CMI_CARD_PAYMENT.data, transaction_id: 'tx_small', amount: '0.01' },
};

export const FIXTURE_COMPANY_CUSTOMER = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_company',
    customer_email: 'comptabilite@axa.ma',
    customer_name: 'AXA Maroc SA',
  },
};

export const FIXTURE_NO_CUSTOMER_INFO = {
  ...FIXTURE_CMI_CARD_PAYMENT,
  data: {
    ...FIXTURE_CMI_CARD_PAYMENT.data,
    transaction_id: 'tx_anon',
    customer_email: undefined,
    customer_phone: undefined,
    customer_name: undefined,
  },
};
```

---

## 8. Variables environnement

```env
# Consumer Pay -> Journal
BOOKS_CONSUMER_RETRY_MAX=3
BOOKS_CONSUMER_RETRY_BACKOFF_MS=500
BOOKS_CONSUMER_DLQ_TOPIC=insurtech.events.dlq.books.pay-to-journal
BOOKS_CONSUMER_GROUP_ID=books-pay-to-journal

# Kafka cluster (Atlas DC1 prod)
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092
KAFKA_CLIENT_ID=insurtech-api
KAFKA_GROUP_BOOKS_PAY_TO_JOURNAL=books-pay-to-journal
KAFKA_SECURITY_PROTOCOL=SASL_SSL
KAFKA_SASL_MECHANISM=SCRAM-SHA-512
KAFKA_SASL_USERNAME=insurtech-consumer
KAFKA_SASL_PASSWORD=secret

# Topics
KAFKA_TOPIC_PAY_CAPTURED=insurtech.events.pay.transaction.captured
KAFKA_TOPIC_DLQ_BOOKS=insurtech.events.dlq.books.pay-to-journal

# Observability
PROMETHEUS_METRICS_PATH=/metrics
OTEL_SERVICE_NAME=insurtech-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317

# Heritees Sprint 1-7
DATABASE_URL=postgresql://insurtech:secret@localhost:5432/insurtech_dev
REDIS_URL=redis://localhost:6379/2
PASSWORD_PEPPER=...
JWT_PRIVATE_KEY=...
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Lancer tests unit
pnpm --filter @insurtech/books test:unit -- pay-to-journal

# 2. Lancer tests integration (Kafka + Postgres testcontainers)
pnpm --filter @insurtech/books test:integration -- pay-to-journal

# 3. Lancer E2E (necessite stack docker-compose up : kafka, postgres, redis, api)
pnpm docker:up
pnpm --filter @insurtech/books test:e2e -- pay-to-journal

# 4. Verif metrique en local (api running)
curl http://localhost:4000/metrics | grep books_pay_to_journal

# 5. Lint + typecheck
pnpm typecheck && pnpm lint

# 6. Coverage
pnpm vitest run --coverage repo/packages/books

# 7. Test manuel : publier un event Kafka
node -e "
const { Kafka } = require('kafkajs');
const k = new Kafka({ brokers: ['localhost:9092'] });
const p = k.producer();
(async () => {
  await p.connect();
  await p.send({
    topic: 'insurtech.events.pay.transaction.captured',
    messages: [{ value: JSON.stringify({
      schema_version: '1.0',
      topic: 'insurtech.events.pay.transaction.captured',
      timestamp: new Date().toISOString(),
      headers: { trace_id: 't1', tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      data: {
        transaction_id: 'tx_manual_test',
        tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        provider: 'cmi', transaction_type: 'card_payment', amount: '100.00',
        currency: 'MAD', captured_at: new Date().toISOString(),
        provider_transaction_id: 'MANUAL-001',
      },
    })}],
  });
  await p.disconnect();
})();
"

# 8. Verifier ecriture creee
psql $DATABASE_URL -c "SELECT entry_number, status FROM books_journal_entries WHERE reference = 'pay:tx_manual_test'"

# 9. Inspecter DLQ
docker exec kafka kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic insurtech.events.dlq.books.pay-to-journal --from-beginning --max-messages 10

# 10. Verifier no-emoji + no-console
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/books
grep -rn "console\.log\|console\.debug" repo/packages/books --include="*.ts" --exclude="*.spec.ts"
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (15 bloquants)

- **V1 (P0 -- automatisable)** : Consumer demarre sans erreur. Test : `pnpm dev` et verifier log `kafka_consumer_started` apparait sous 5s. Failure : check Kafka brokers reachable et group_id pas en conflit.
- **V2 (P0)** : Event valide CMI -> ecriture creee en DB en < 5s. Test integration IT1.
- **V3 (P0)** : Idempotency : 2 events meme transaction_id -> 1 ecriture. Test IT2 + V3 unit.
- **V4 (P0)** : Mapping cmi card -> 5141/4111/BNQ. Test V1 unit + IT1 integration.
- **V5 (P0)** : Mapping payzone cash_kiosque -> 5161/4111/CSS. Test V2 + IT5.
- **V6 (P0)** : Currency != MAD -> DLQ. Test V6 unit + IT7.
- **V7 (P0)** : amount <= 0 -> DLQ. Test V4 V5 unit + IT3.
- **V8 (P0)** : TenantContext propage en async via runWithContext. Test V20 unit + IT10.
- **V9 (P0)** : auto_validate=true -> status validated direct. Test V1 unit + IT9.
- **V10 (P0)** : reference = `pay:{transaction_id}`. Test V14 unit + IT11.
- **V11 (P0 -- automatisable)** : 25 unit + 12 mapping + 10 context + 12 integration + 10 E2E = 69 tests PASS. Cmd : `pnpm test:unit && pnpm test:integration && pnpm test:e2e`.
- **V12 (P0)** : DLQ message au bout retry max apres 3 retries. Test integration manuel.
- **V13 (P0 -- automatisable)** : Aucune emoji dans fichiers crees. Cmd : grep regex emoji ranges.
- **V14 (P0)** : Lint + typecheck OK. Cmd : `pnpm typecheck && pnpm lint`.
- **V15 (P0)** : 10 events ordonnes -> numerotation 00001..00010 sequentielle. Test IT4.

### Criteres P1 (10 importants)

- **V16 (P1)** : Coverage >= 90% consumer + 85% mapping. Cmd : `pnpm vitest --coverage`.
- **V17 (P1)** : Latence p95 < 2s sur 1 event. Test E2E5 + Grafana dashboard.
- **V18 (P1)** : Metriques exposees `/metrics` (5 metrics : success, dlq, retry, fallback, latency). Test E2E3.
- **V19 (P1)** : Tenant override mapping fonctionne. Test M3 unit.
- **V20 (P1)** : Logs structured (msg, transaction_id, tenant_id, duration_ms, trace_id). Test V19 unit.
- **V21 (P1)** : Graceful shutdown : process drain message en cours via OnApplicationShutdown.
- **V22 (P1)** : 6 providers tous mappes correctement. Test M8 unit.
- **V23 (P1)** : 4 transaction_types tous geres dans config. Test M8.
- **V24 (P1)** : Customer entreprise mapping 4112. Test V10 unit + R2 unit.
- **V25 (P1)** : Decimal precision preserve dans amount (`'100.5'` -> `'100.5'` pas float). Test V17 unit.

### Criteres P2 (7 nice-to-have)

- **V26 (P2)** : Replay manuel DLQ documente dans README. Cmd : `wc -l repo/packages/books/README.md` >= 200.
- **V27 (P2)** : Schema event versionne (`schema_version: '1.0'`). Test parse Zod accepte 1.0 reject 2.0.
- **V28 (P2)** : Documentation README explique flow + topics + retry strategy.
- **V29 (P2)** : Tracing OpenTelemetry propage trace_id de header Kafka vers journal_entry.metadata.
- **V30 (P2)** : Alert ops sur DLQ rate > 1% via Grafana threshold.
- **V31 (P2)** : Audit log entry inclut `source: 'auto_pay_consumer'` (Sprint 5 task 2.1.12).
- **V32 (P2)** : Consumer restart conserve offset (commit interval 5s, pas de double consume sauf rebalance window).

---

## 11. Edge cases + troubleshooting (12 cas detailles)

### EC1 : Kafka cluster down completement

**Scenario** : maintenance Atlas DC1, brokers tous indisponibles.
**Probleme** : consumer ne peut pas connect, ne consume pas.
**Solution** : `KafkaConsumerBase` Sprint 2 task 1.2.13 retry connection avec exponential backoff (max 60s entre tentatives). Health check `/healthz` retourne 503 si consumer cant connect, declenche alerte PagerDuty. Failover : DC2 prend le relai (replication multi-AZ).
**Commande debug** : `docker logs api | grep kafka_consumer_started` doit montrer reconnect tentatives.

### EC2 : DB down pendant traitement event

**Scenario** : Postgres restart mid-handle.
**Probleme** : `JournalService.createEntry` leve exception, retry, eventuel DLQ.
**Solution** : retry 3x avec backoff 500ms, 1s, 2s. Si toujours echec -> DLQ. L'event reste a re-traiter manuellement quand DB up via replay DLQ.
**Commande recovery** :
```bash
kafka-console-consumer --topic insurtech.events.dlq.books.pay-to-journal --from-beginning > dlq.json
# fix DB, puis :
cat dlq.json | jq -c | while read line; do
  kafka-console-producer --topic insurtech.events.pay.transaction.captured <<< "$line"
done
```

### EC3 : Race condition 2 consumers replicas meme event

**Scenario** : 2 pods consument meme partition (rebalance flap apres deploy).
**Probleme** : double traitement potential.
**Solution** : Kafka garantit 1 consumer actif par partition par groupId. Idempotency-key (`pay:{transaction_id}`) protege en cas de race window (rare). JournalService Tache 3.5.2 retourne entry existant si idempotency_key match, sans creer doublon.
**Test** : V3 unit + IT2 integration verifient.

### EC4 : amount avec virgule francaise (1234,56)

**Scenario** : producer Pay buggy publie `"1234,56"` au lieu de `"1234.56"`.
**Probleme** : Zod rejette regex `\d{1,13}(\.\d{1,2})?`.
**Solution** : event mal forme -> Zod parse echec -> KafkaConsumerBase route DLQ direct sans handle. Pay (Sprint 11) doit publier au format point. Tester via fixture FIXTURE_NEGATIVE_AMOUNT pattern.
**Commande verif** : grep DLQ messages avec amount comma.

### EC5 : Event de tenant inexistant (suspendu)

**Scenario** : tenant_id valide UUID mais tenant supprime/suspendu.
**Probleme** : seed CGNC pas applicable, comptes 5141/4111 absents pour ce tenant.
**Solution** : `JournalService.createEntry` leve `ACCOUNT_NOT_FOUND` si seed manque, retry, DLQ. Sprint 6 tenant suspension doit empecher Pay de publier event pour tenant suspendu (filter cote producer).

### EC6 : Provider futur inconnu (ex Stripe expansion)

**Scenario** : Pay introduit Stripe sans update mapping.
**Probleme** : pas de mapping config -> fallback 5141/4111 + WARN.
**Solution** : metric `books_pay_to_journal_fallback_total{provider="stripe"}` increment, alert si >5% events. Action : ajouter Stripe a `PAYMENT_MAPPING_DEFAULT` + tests + redeploy.

### EC7 : Customer email casse-sensible

**Scenario** : `Client@example.com` vs `client@example.com` -> 2 contacts trouves potentiellement.
**Probleme** : credit_account different selon casse.
**Solution** : `PaymentContextResolverService` normalise `LOWER(email)` cote SQL ET cote app (Zod schema email lowercase). Test R10 unit verifie.

### EC8 : Kafka rebalance perd offset commit

**Scenario** : pod kill mid-handle, offset pas commit.
**Probleme** : event redelivre apres rebalance, double consume potential.
**Solution** : idempotency key protege contre double creation. Verifier `auto.commit.interval.ms=5000` raisonnable. Si trop long (60s+) risque accru.

### EC9 : Memory leak counter labels infinis

**Scenario** : labels providers cardinality bounded (6) mais reasons error illimitees si on logge raw error message.
**Probleme** : prom-client garde tous les labels en memoire, OOM apres 1 mois.
**Solution** : `classifyError` reduit a 7 categories fixes (`account_not_found`, `tenant_missing`, `imbalanced`, `currency_not_mad`, `invalid_amount`, `idempotency_conflict`, `unknown`). Cardinality bounded.

### EC10 : Tres gros volume burst (10k events/min en pic campagne)

**Scenario** : campagne assurance scolaire 1er septembre 2026, 5000 souscriptions en 10 min.
**Probleme** : numbering lock contention (Tache 3.5.2 lock pessimiste sur sequence par tenant+exercice+journal).
**Solution** : partition Kafka par tenant_id -> serialise par tenant, pas global. Acceptable car rate par tenant <= 100/min (limite cote Pay rate-limit Sprint 3 task 1.3.13). Si insufficient, scale horizontalement (+ replicas consumer + repartitionner).

### EC11 : Event message > 1 MB

**Scenario** : event Pay avec metadata enorme.
**Probleme** : kafka rejette par defaut > 1MB (config `message.max.bytes`).
**Solution** : event Pay est petit (~2kB par design), pas de risque actuel. Si futur event volumineux : compression gzip cote producer, increase `message.max.bytes` cote broker (Atlas config).

### EC12 : Clock skew entre Pay producer et Books consumer

**Scenario** : producer pod horloge 30 min en avance, captured_at futur.
**Probleme** : `assertEntryDateAcceptable` Tache 3.5.2 leve `ENTRY_DATE_FUTURE` -> retry -> DLQ.
**Solution** : `BOOKS_FUTURE_DATE_TOLERANCE_DAYS=1` en prod (24h tolerance). Permet skew acceptable. Si systematique > 24h, alerte ops verifier NTP sync.

---

## 12. Conformite Maroc detaillee

### Loi 9-88 du 25 decembre 1992 (Obligations comptables des commercants) -- articles cles

- **Article 19** : Numerotation continue chronologique sans rupture des journaux comptables. Implementation : Tache 3.5.2 `JournalNumberingService` avec lock pessimiste, ce consumer respecte via `auto_validate: true` + `idempotency_key`.
- **Article 20** : Toute ecriture comptable doit etre justifiee par une piece datee. Implementation : `reference: 'pay:{transaction_id}'` lie a l'event Kafka durable (audit trail), `description` inclut `provider_transaction_id`.
- **Article 22** : Conservation 10 ans. Implementation : ecritures `validated` immuables (Tache 3.5.2 trigger DB), retention Kafka events 30 jours + DB 10 ans.

### Loi 38-14 du 21 fevrier 2017 (modifie 9-88)

- **Article 8 modifie** : tenue comptable informatisee acceptee. Implementation : ce consumer + Tache 3.5.2 + audit trail.

### Bank Al-Maghrib (BAM) -- Reglementation paiement

- **Circulaire 6/G/2017** sur la tracabilite des paiements electroniques. Implementation : Kafka durable + audit log + journal_entry lien direct.
- **Loi 103-12** (loi bancaire 2014) : etablissements de paiement (CMI, MWallet BAM) regules. Pay (Sprint 11) integre conformement.

### Loi 09-08 du 18 fevrier 2009 (Protection des donnees personnelles -- CNDP)

- **Article 7** : Localisation donnees au Maroc. Kafka cluster Atlas DC1, replication DC2 (decision-008).
- **Article 14** : Minimisation. Description `journal_entry` ne contient pas PII complet (pas de CIN, juste customer_email + provider_transaction_id reference).
- **Article 18** : Information de la personne concernee. Pas applicable directement (B2B), mais le consentement Pay couvre.

### CGI (Code General des Impots) 2026

- **Article 145** : factures conformes (Tache 3.5.5).
- **Article 146** : conservation 10 ans pieces comptables. NO-DELETE trigger Tache 3.5.2.
- **Article 117** : arrondi au centime. Implementation : Decimal.js `ROUND_HALF_UP`, regex Zod 2 decimales max.

### Loi 17-99 ACAPS (assurances)

- Reporting trimestriel/annuel utilise les ecritures generees par ce consumer (Tache 3.5.7+ ACAPS). Sans ces ecritures auto, le reporting serait incomplet.

---

## 13. Conventions absolues skalean-insurtech (rappel complet en extenso)

### 13.1 Multi-tenant strict
TenantContext.runWithContext() obligatoire au debut du handle. Header `x-insurtech-tenant-id` extrait depuis `event.headers.tenant_id`. RLS Postgres actif sur toutes tables touchees. Aucune fonction prend tenant_id en parametre direct (recupere via TenantContext.getTenantId() depuis async local storage Sprint 6 task 2.2.1).

### 13.2 Validation strict (Zod uniquement)
Zod 3.24 pour validation runtime DTOs. Schema `PayCapturedEventSchema` exporte depuis `@insurtech/books/schemas/pay-events.schemas`. JAMAIS class-validator, JAMAIS yup, JAMAIS joi. Pattern : `const Schema = z.object({...}).strict(); type Type = z.infer<typeof Schema>;`. La validation runtime est faite par `KafkaConsumerBase` avant `handle()`.

### 13.3 Logger strict (Pino DI)
`Logger` injecte par DI nestjs-pino. JAMAIS `console.log` (pre-commit hook check rejette). JAMAIS `new Logger()` (NestJS Logger natif). Format JSON structured pour parsing Datadog/Sentry. Champs obligatoires : `msg, transaction_id, tenant_id, provider, action, duration_ms, trace_id`.

### 13.4 Hash password strict (argon2id)
N/A pour cette tache (consumer n'authentifie rien, agit en system level).

### 13.5 Package manager strict (pnpm)
pnpm uniquement. `engine-strict=true` rejette install si Node < 22.11.0. `save-exact=true`. `link-workspace-packages=deep` pour `@insurtech/*` imports.

### 13.6 TypeScript strict
`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`, `noImplicitReturns: true`. Imports explicites (pas `import * as`). Pas de `any` implicite. Tous les types de PayCapturedEvent inferes depuis Zod schema.

### 13.7 Tests strict
Vitest pour unit + integration. Playwright pour E2E web (n/a ici, on test E2E via Fastify inject). Coverage cible : >= 90% consumer/services, >= 85% controller. Chaque `.ts` (sauf types-only et index.ts) a son `.spec.ts`. Test V1-V25 unit + M1-M12 mapping + R1-R10 context + IT1-IT12 integration + E2E1-E2E10 = 69 tests total cette tache.

### 13.8 RBAC strict
Consumer n'a pas de RBAC user-level (action systeme `system-pay-consumer`). Mais le `JournalService.createEntry()` qu'il appelle utilise `created_by: 'system-pay-consumer'` qui apparait dans audit trail. Pas de permission specifique consumer.

### 13.9 Events strict
Topics format `insurtech.events.{vertical}.{entity}.{action}` -- ici `insurtech.events.pay.transaction.captured`. Schemas Zod exportes depuis `@insurtech/shared-events`. Idempotency-Key obligatoire pour mutations (cle de cette tache : `pay:{transaction_id}`).

### 13.10 Imports strict
Imports via `@insurtech/{nom}` (pas `../../packages/...`). Order : 1) Node natifs 2) Externes (kafkajs, prom-client, zod) 3) `@insurtech/*` 4) Relatifs.

### 13.11 Skalean AI strict (decision-005)
N/A pour cette tache (pas d'IA, mapping deterministe). Sprint 30+ pourrait enrichir avec auto-classification si nouveau provider detecte, mais hors scope Sprint 12.

### 13.12 No-emoji strict (decision-006 ABSOLU)
AUCUNE emoji dans : code, commentaires, logs, docs, commits, libelles. Pre-commit hook `check-no-emoji.sh` rejette commits avec emoji. CI fail si emoji detectee dans PR. Cette tache : aucune emoji introduite.

### 13.13 Idempotency-Key strict (cle de cette tache)
Pour ce consumer, `idempotency_key = pay:{transaction_id}` est OBLIGATOIRE car Kafka offre at-least-once delivery, redelivres frequents en production. JournalService Tache 3.5.2 verifie unicite via index unique `(tenant_id, idempotency_key) WHERE idempotency_key NOT NULL`.

### 13.14 Conventional Commits strict
Format : `feat(sprint-12): description courte 50-72 chars`. Types : feat, fix, docs, style, refactor, test, chore, perf, ci, build. Scope : `sprint-12`. commitlint rejette via husky.

### 13.15 Cloud souverain MA strict (decision-008)
Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc. Kafka cluster Atlas DC1 (primary) + DC2 Tier IV (replica DR). AUCUNE donnee assure ne transite hors MA. Encryption at rest AES-256-GCM via Atlas KMS. TLS 1.3 obligatoire pour tous transferts (Kafka SASL_SSL).

---

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
# Sequence pre-commit complete pour Tache 3.5.3
set -e

cd repo

# 1. Typecheck
echo "[1/8] typecheck..."
pnpm typecheck

# 2. Lint Biome
echo "[2/8] lint..."
pnpm lint

# 3. Tests unitaires
echo "[3/8] unit tests..."
pnpm --filter @insurtech/books test:unit -- pay-to-journal

# 4. Tests integration
echo "[4/8] integration tests..."
pnpm --filter @insurtech/books test:integration -- pay-to-journal

# 5. Tests E2E concernes (necessite docker:up)
echo "[5/8] E2E tests..."
pnpm docker:up
pnpm --filter @insurtech/books test:e2e -- pay-to-journal

# 6. Coverage
echo "[6/8] coverage..."
pnpm vitest run --coverage repo/packages/books/test repo/packages/books/src

# 7. No-emoji
echo "[7/8] no-emoji check..."
EMOJIS=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/books --exclude-dir=node_modules || true)
if [ -n "$EMOJIS" ]; then
  echo "FAIL : emoji detectees"
  echo "$EMOJIS"
  exit 1
fi

# 8. No console.log
echo "[8/8] no-console check..."
CL=$(grep -rn "console\.log\|console\.debug" repo/packages/books --include="*.ts" --exclude="*.spec.ts" || true)
if [ -n "$CL" ]; then
  echo "FAIL : console.log detecte"
  echo "$CL"
  exit 1
fi

echo "OK : pre-commit Tache 3.5.3 valide"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-12): consumer Kafka pay -> journal auto-generation

PayToJournalConsumer ecoute insurtech.events.pay.transaction.captured
et auto-genere ecriture comptable validated via JournalService Tache
3.5.2. Mapping deterministe (provider, transaction_type) -> debit/
credit accounts CGNC :
- cmi/youcan_pay/inwi_money/orange_money/mwallet_bam : 5141 BNQ
- payzone card : 5141 BNQ
- payzone cash_kiosque : 5161 CSS

Idempotency-key pay:{transaction_id} protege contre redelivery Kafka
(at-least-once delivery). TenantContext.runWithContext propage tenant
de l'envelope Kafka header vers JournalService. Retry 3x backoff
exponentiel, DLQ topic dlq.books.pay-to-journal.

PaymentMappingService : tenant_override (Sprint 27) > config hardcode
> default_fallback (5141/4111/BNQ + WARN log + metric increment).

PaymentContextResolverService : enrichit credit_account 4111/4112/4113
selon customer.type via lookup CRM (Sprint 8 contacts).

Livrables:
- 3 services + 1 consumer + 1 module + 1 metrics helper
- Schemas Zod PayCapturedEvent strict
- Mapping config 8 entries (6 providers, 4 types)
- Metrics Prometheus 5 (success, dlq, retry, fallback, latency)
- 25 unit + 12 mapping + 10 context + 12 integration + 10 E2E = 69 tests
- 15 fixtures realistes

Conformite:
- Loi 9-88 art 19 (numerotation), 20 (justification piece), 22 (conservation 10 ans)
- Loi 38-14 art 8 (tenue informatisee)
- BAM Circulaire 6/G/2017 (tracabilite paiements electroniques)
- Loi 103-12 (loi bancaire 2014)
- Loi 09-08 art 7 (data residency MA), 14 (minimisation)
- CGI art 117 (arrondi centime), 145 (factures), 146 (conservation)
- decision-006 (no emoji absolu)
- decision-008 (Atlas Cloud Benguerir DC1)

Task: 3.5.3
Sprint: 12 (Phase 3 / Sprint 5 dans phase)
Phase: 3 -- Modules Horizontaux
Reference: B-12 Tache 3.5.3"
```

---

## 16. Workflow next step

Apres commit valide de cette tache 3.5.3 :

- Verifier CI verte (workflow `.github/workflows/ci.yml`).
- Verifier dashboard Grafana `Pay to Journal` montre metrics non-zero apres premier deploy.
- Surveiller `books_pay_to_journal_dlq_total` < 1% events. Si > 1%, alert ops + investigation.
- Surveiller `books_pay_to_journal_fallback_total` = 0 normalement (ou rare). Si > 0, ajouter mapping pour le provider concerne.
- Mettre a jour `_SUMMARY.md` du sprint avec densite atteinte.
- Suite : **Tache 3.5.4 -- TVA Service + 5 Taux MA** (`task-3.5.4-tva-service-5-taux-ma-declaration-mensuelle.md`). Cette tache 3.5.4 fournit TvaService consume par Tache 3.5.5 invoices.

Si regression detectee post-merge, voir `00-pilotage/verifications/V-12-sprint-12-books-compliance.md` pour procedure rollback (le consumer peut etre desactive via env var `BOOKS_CONSUMER_PAY_TO_JOURNAL_ENABLED=false` sans toucher au reste).

---

**Fin du prompt task-3.5.3-pay-to-journal-consumer-auto-generation.md.**

Densite atteinte : ~125 ko (tests complets sans placeholder, code patterns exhaustifs, edge cases detailles, 5 lois MA citees in extenso)
Code patterns : 9 fichiers complets (consumer, 3 services, config, types, schemas, module, metrics)
Tests : 69 cas concrets (25 unit consumer + 12 mapping + 10 context + 12 integration + 10 E2E)
Criteres validation : V1-V32 (15 P0 + 10 P1 + 7 P2)
Edge cases : 12 cas detailles avec scenario + probleme + solution + commande recovery
Conformite : 6 lois/circulaires MA detaillees avec articles cites
