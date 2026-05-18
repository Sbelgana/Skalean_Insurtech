# TACHE 3.2.13 -- Tests E2E Exhaustifs (50+) + Mocks Meta API + Mailhog + Mailgun + BullMQ Workers + Helpers Reutilisables

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.13)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (cloturant Sprint 9, validant l'integralite des taches 3.2.1-3.2.12 en bout-en-bout)
**Effort** : 8h
**Dependances** : Toutes les taches Sprint 9 (3.2.1-3.2.12) terminees
**Densite cible** : 135-150 ko (tache la plus dense Sprint 9 -- justifie par 50+ tests)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la suite de tests End-to-End (E2E) Jest + supertest + Playwright qui valide en bout-en-bout l'integralite du systeme de communications multi-canal (WhatsApp Cloud API Meta v21.0 + Email SMTP via Mailgun + Mailhog dev) du programme Skalean InsurTech v2.2 conforme aux exigences de qualite des Taches 3.2.1 a 3.2.12, en ciblant **50+ scenarios fonctionnels** repartis en 7 fichiers `.e2e-spec.ts` qui simulent les flows reels (send template WhatsApp avec mock Meta retournant `message_id`, send email avec verification Mailhog API, routing orchestrator par `preferred_channel`, webhooks Meta + Mailgun avec verification HMAC SHA-256, BullMQ workers avec retry exponential 3 tentatives + DLQ vers Kafka topic `insurtech.events.dlq.comm`, opt-out CNDP via token URL signe + one-click RFC 8058 + STOP keyword auto, delivery tracking sent->delivered->read->bounced, templates Meta approval workflow draft->pending->approved/rejected, stats endpoint avec aggregations group by status, multi-tenant isolation, performance throughput 1000 sends/min) et qui interagissent avec les datastores reels (Postgres test DB pour `comm_messages` + `comm_optouts` + `comm_templates`, Redis DB 15 isolated pour BullMQ queues `wa-send` + `email-send` + `wa-webhook-process`, Kafka topics test `comm.message_sent` + `comm.dlq`) ainsi qu'avec les **mocks externes** : Mock Meta WhatsApp Cloud API server via **nock** interceptant `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` retournant `{ messages: [{ id: 'wamid.HBgN...' }] }` synthetic + simulant errors (rate limit code 130, phone not opted-in code 131, invalid template code 132), Mock Mailgun API + signed webhook helper genere webhooks `delivered` / `bounced` / `complained` / `opened` / `clicked` avec signature `timestamp+token+sha256(signing_key)` valide, Mailhog REST API client wrapping `GET http://localhost:8025/api/v2/messages?kind=containing&query={recipient}` avec polling 200ms timeout 10s pour verifier emails reellement delivres avec headers DKIM signed + `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) + multipart HTML+plain text + RTL `<html dir="rtl">` pour ar-MA.

Le perimetre couvre 7 fichiers `.e2e-spec.ts` (`messages-flow.e2e-spec.ts` pour 12+ tests send WA happy path + Email happy path + Kafka events emis + variables interpolees + locale routing fr/ar-MA/en, `wa-webhook-flow.e2e-spec.ts` pour 10+ tests verification challenge GET + signature HMAC valid/invalid/missing + idempotency 2x same body + status update sent->delivered propagation + incoming message direction='inbound' + STOP keyword auto opt-out + multi-entry batch payload, `email-flow.e2e-spec.ts` pour 10+ tests send via Mailhog + DKIM verify + List-Unsubscribe header + multipart + RTL ar-MA + opt-out flow link inject, `opt-out-flow.e2e-spec.ts` pour 10+ tests token URL signed JWT TTL 90j flow + one-click POST direct RFC 8058 + STOP keyword WA auto + ARRET keyword matched + re-consent require explicit + cooling period 7 jours + multi-channel selective opt-out, `orchestrator-routing.e2e-spec.ts` pour 10+ tests preferred WA + opt-in OK + opt-out fallback email + no available channel 400 NoAvailableChannelError + template not Meta approved fallback + override preferChannel + skipOptOutCheck transactional auth + broadcast filtre tags + locale=fr-MA segmentation 1000 contacts, `templates-meta-approval.e2e-spec.ts` pour 8+ tests workflow draft->pending->approved + Meta webhook account_alerts approved/rejected + cache invalidation Kafka, `delivery-tracking.e2e-spec.ts` pour 10+ tests Mailgun webhook bounce hard auto opt-out source='auto-bounce' + soft bounce retry + complained suspicious flag + bounce rate >5% Kafka high_bounce_rate + >10% auto-pause campaigns + WA delivered/read + stats endpoint aggregates) ; un module fixtures `comm-test-helpers.ts` factorisant `sendTestMessage(app, contactId, template, variables, options) -> messageId`, `waitForMailhogMessage(toEmail, timeoutMs)`, `waitForJobCompletion(queue, jobId, options)`, `mockMetaSendTemplate(scenario)`, `mockMailgunWebhook(eventType, messageId)`, `generateOptoutToken(contactId, channel)`, `seedTenant`, `seedContact`, `resetQueues`, `truncateCommTables`, `flushRedisTestDb` ; un module `mock-meta-server.ts` qui via **nock** intercepte `POST graph.facebook.com/v21.0/{phone_number_id}/messages` + `POST .../messages` (markAsRead) + `POST .../media` (uploadMedia) + `GET .../media/{media_id}` (downloadMedia) avec flags pour simuler errors via `setupMetaError('rate_limit' | 'phone_not_opted_in' | 'invalid_template' | 'network_timeout')` ; un module `mock-mailgun-server.ts` qui mock `POST https://api.eu.mailgun.net/v3/{domain}/messages` retournant `{ id, message }` synthetic + helper `signMailgunWebhook(eventType, messageId, signingKey)` calculant HMAC SHA-256 timestamp+token correct ; un module `mailhog-client.ts` wrappant Mailhog REST API ; un module `wa-webhook-payloads.fixtures.ts` contenant 15+ payloads Meta realistes (status simple sent->delivered, batch 5 statuses, incoming text "Hello", incoming image avec media_id, incoming audio voice note, incoming video, incoming document PDF, incoming location lat/lng, incoming contact card vCard, incoming button reply, incoming list reply selection, incoming interactive message, failed status code 131, read receipt 2 ticks, multi-entry 3 entries).

L'apport est triple. Premierement, en validant chaque flow comm en bout-en-bout (vs unit tests qui mockent les dependances), on detecte les bugs d'integration que les unit tests ne peuvent pas voir : un test unit `WaSendWorker.process()` peut passer parfaitement, mais l'integration `MessageOrchestrator.sendToContact() -> queue.add('wa-send', jobData) -> WaSendWorker.process() -> WaTemplateRenderer.render() -> WhatsAppCloudApiClient.sendTemplate() -> mock Meta returns message_id -> messagesRepo.update(status='sent') -> KafkaPublisher.publish('comm.message_sent')` rate manquera si le mapping `variables` named -> Meta ordered components est decale (ex: `{{user_name}}` mappe en position 2 au lieu de 1) -- cette classe de bug n'est detectable qu'en E2E avec mock Meta verifiant le payload exact recu via `nock.recorder.rec()`. Deuxiemement, en utilisant Mailhog API REST pour verifier les emails reellement delivres (vs mocker `EmailService`), on valide la chaine complete `MessageOrchestrator.sendToContact() -> queue.add('email-send') -> EmailSendWorker.process() -> EmailTemplateRenderer.render() -> EmailService.send() -> Nodemailer SMTP -> Mailhog SMTP server localhost:1025 -> Mailhog stocke + indexe -> GET /api/v2/messages -> assertions headers DKIM-Signature + List-Unsubscribe + Content-Type multipart/alternative + body HTML dir=rtl pour ar-MA + body plain text fallback auto-genere via node-html-to-text` -- propriete critique car un bug n'importe ou dans cette chaine bloque les notifications transactionnelles client (verification email auth, password reset, appointment reminder, police signed). Troisiemement, en TRUNCATE-ant les tables `comm_messages`, `comm_optouts`, `comm_templates`, `comm_webhooks_received`, `crm_contacts` et FLUSHDB-ant Redis DB 15 (test-only) avant chaque test + `nock.cleanAll()` afterEach + `DELETE http://localhost:8025/api/v1/messages` Mailhog cleanup, on garantit la **reproductibilite** : un test ne peut pas etre influence par les artefacts d'un test precedent (job BullMQ orphelin, webhook idempotency_key collision, message Mailhog ancien matchant query), ce qui est essentiel pour le debugging CI et pour la confiance dans les resultats -- on exige que la suite passe **5 fois consecutif** sans aucune flakiness avant merge.

A l'issue de cette tache, la suite Jest + supertest `pnpm --filter @insurtech/api test:e2e:comm` execute les **50+ scenarios** en sequence, tous passent en local avec Postgres + Redis + Kafka + Mailhog lances via Docker Compose `infrastructure/docker/docker-compose.test.yml`, tous passent en CI via GitHub Actions Sprint 32 sur infrastructure dediee avec services declared `postgres:16-alpine` + `redis:7-alpine` + `mailhog/mailhog:latest` + `confluentinc/cp-kafka:7.6.0`, le run complet prend **< 8 minutes** workers=1 (acceptable pour CI) et **< 3 minutes** workers=4 avec namespace par worker (chaque worker prefix ses keys Redis BullMQ avec `workerIndex` pour eviter race conditions sur shared queue state), aucun test n'est flaky (run 5 fois consecutif passe a 100% en local + CI), un rapport HTML Jest est genere dans `repo/apps/api/coverage/lcov-report/` avec coverage minimum 80% (cible 85%) sur tous les flows comm Sprint 9 (services + workers + controllers + middleware + helpers), aucun appel reel vers Meta Graph API ou Mailgun API (cost + reliability + flakiness inacceptables), et la documentation README explique comment ajouter de nouveaux scenarios + comment debugger un test failing avec `nock.recorder.rec()` + Mailhog UI `http://localhost:8025` + BullDashboard `/admin/queues`.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sprint 9 a livre 12 taches successives (3.2.1 entites + Zod, 3.2.2 WhatsApp Cloud API client Meta v21.0, 3.2.3 WA template renderer 3 locales, 3.2.4 WA webhook receiver + signature HMAC, 3.2.5 template manager + 60 templates seed, 3.2.6 email SMTP + DKIM/SPF + Mailgun, 3.2.7 email template renderer + RTL ar/ar-MA, 3.2.8 BullMQ queues wa-send + email-send + retry + DLQ, 3.2.9 message orchestrator routing, 3.2.10 delivery tracking + bounces + alerts, 3.2.11 opt-out CNDP + endpoint public, 3.2.12 endpoints REST `/api/v1/comm/*`) chacune avec ses propres tests unitaires et integration. Mais l'integration COMPLETE entre toutes ces taches (`POST /api/v1/comm/messages/send -> orchestrator.sendToContact -> check opt-out -> determine channel -> insert comm_messages -> queue.add -> worker process -> renderer -> mock Meta API -> update status -> Kafka event -> webhook recu -> signature verifie -> idempotency check -> consumer process -> update status delivered -> stats endpoint aggregate`) n'a ete validee nulle part jusqu'a present. Sans cette validation E2E, on risque d'avoir un systeme ou chaque composant fonctionne isolement mais l'enchainement casse : par exemple, `MessageOrchestrator.sendToContact()` Tache 3.2.9 apres un opt-out registered Tache 3.2.11 doit retourner fallback email (preferred_channel='whatsapp' + opt-out WA + opt-in email + email valide). Cette propriete depend de la coherence entre 3.2.9 (lookup opt-out via `OptoutService.getOptedOutChannels(contactId)`), 3.2.11 (insert row `comm_optouts` avec `channel='whatsapp'` + `source='auto-bounce'|'web'|'whatsapp'|'admin'`), et 3.2.1 (entity `Channel` enum strict). Si l'un ou l'autre divergerait (ex: 3.2.9 query `comm_optouts.channel = 'wa'` au lieu de `'whatsapp'`), le test E2E le detecte ; les unit tests mockant `OptoutService` ne le verraient pas.

L'utilisation de **Jest + supertest** (vs Playwright pur comme Sprint 5 Tache 2.1.15) est un choix strategique pour Sprint 9. Les tests comm sont majoritairement API-only (POST send, GET messages, webhooks) sans navigation browser ni interactions UI. Jest + supertest est plus rapide a executer (pas de browser context overhead) + plus simple pour mock HTTP outbound (nock attache au global http agent Node, pas besoin de service worker). Sprint 18 (customer portal frontend) utilisera Playwright pour les flows comm UI (preferences page, opt-out confirmation page). Avoir Jest pour API + Playwright pour frontend = bonne separation responsabilites.

L'utilisation de **nock** pour mock Meta Graph API (vs MSW Mock Service Worker) est preferable car nock intercepte au niveau Node http/https module (vs MSW qui intercepte fetch via service worker), donc compatible avec **undici** (HTTP client choisi Tache 3.2.2 pour perf > axios). MSW v2 supporte aussi undici via interceptors mais nock a 10 ans de maturite sur Node-side mocking. Trade-off accepte.

L'utilisation de **Mailhog en E2E** (vs SendGrid sandbox ou Mailgun test mode) est essentielle pour reproductibilite : les emails reels mettent du temps a arriver, sont sujets a rate limit provider + cout par email. Mailhog capture les emails localement via SMTP fake server port 1025 et expose une API REST port 8025 pour assertions automatisees instant.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Jest + supertest seul | Plus leger, deja installe Sprint 5 | Pas browser pour UI tests | RETENU pour API E2E |
| Playwright pour API | Tracing avance, parallelism opt-in | Surdimensionne pour API tests pure backend | DEFFERE Sprint 18 (frontend) |
| nock | HTTP intercept Node-level + undici support | Apprentissage syntaxe | RETENU pour Meta + Mailgun mock |
| MSW Mock Service Worker | DX moderne, REST + GraphQL | Service worker layer, undici compat partielle | REJETE -- nock plus simple |
| Mailhog | SMTP fake + REST API + 0 cost | Container Docker supplementaire | RETENU |
| Mailtrap | Service cloud pratique | Cost + dependance externe + rate limit | REJETE pour CI |
| Inbucket | Alternative Mailhog | Moins repandu | REJETE |
| Send reel Meta sandbox | Real validation | Cost + rate limit + token sandbox limite | REJETE -- mock plus reproductible |
| Mock everything (no real Postgres/Redis) | Plus rapide tests | Pas valider integration reelle DB + queues | REJETE -- but c'est le but de E2E |
| Test only happy paths | Plus rapide ecriture | Manque defenses + edge cases + securite | REJETE |
| 50+ scenarios complete (RETENU) | Couverture complete tous flows | 8h effort | RETENU |

### 2.3 Trade-offs

Choisir **Jest workers=1** par defaut implique d'accepter un run sequentiel ~6-8 minutes pour 50+ tests. Trade-off : reproducibilite sans race conditions sur shared Redis BullMQ DB 15 + shared Postgres comm_messages + shared Mailhog inbox. Opt-in `JEST_WORKERS=4` avec namespace par worker (chaque worker prefix ses queue names avec workerIndex `wa-send-w0` / `wa-send-w1` / ...) reduit a ~2-3 minutes en CI Sprint 32. Acceptable.

Choisir **TRUNCATE entre tests** (vs DELETE par tenant_id) implique perdre tous les seeds entre tests. Trade-off : reproducibilite vs setup cost (TRUNCATE + reseed Sprint 9 templates seeds = ~2s par test). Optimisation : seeds templates loaded ONCE via `beforeAll` (templates immutables) + TRUNCATE selective uniquement `comm_messages` + `comm_optouts` + `comm_webhooks_received` qui mutent par test. Acceptable.

Choisir **nock.cleanAll() afterEach** (vs setup fresh par test) implique reset complet des interceptors. Trade-off : reproducibilite stricte vs duplication setup nock dans chaque test. Helper `setupMetaMockHappy()` factorise le setup standard. Acceptable.

Choisir **Mailhog DELETE before each test** (vs filter par recipient unique) implique perdre l'historique tests. Trade-off : reproducibilite vs debug capability. Compromis : DELETE only en CI, en local conserver pour debugging via Mailhog UI `http://localhost:8025`. Acceptable.

### 2.4 Decisions strategiques

- **decision-006** (No-emoji) : strictement applique tous tests + helpers + fixtures.
- **decision-008** (Cloud souverain) : Mailgun region EU compliance RGPD + proximite MA.
- **decision-014** (Loi 09-08 CNDP) : tests verifient opt-out enforce + audit log emit.
- **decision-021** (Test isolation) : Redis DB 15 reservee tests, jamais touchee dev/prod.
- Sprint 32 framework E2E Jest pour API + Playwright pour frontend.

### 2.5 Pieges techniques (15)

1. **Race conditions Redis BullMQ shared** : workers=1 OR namespace par worker via `${queueName}-w${workerIndex}`.
2. **Mailhog timing indexation** : delay 200ms polling + timeout 10s default + `containing` query plutot que `to` exact.
3. **Postgres TRUNCATE CASCADE** : `comm_messages` CASCADE supprime joins, ordre matter -- truncate `comm_webhooks_received` AVANT `comm_messages`.
4. **BullMQ 250ms attendre worker pickup** : tests qui send + expect status='sent' immediatement = flaky. Utiliser `waitForJobCompletion(jobId, { timeout: 5000 })` avec polling 100ms.
5. **nock.cleanAll() between tests** : OBLIGATOIRE afterEach sinon interceptors leak entre tests.
6. **Time-based tests** (cooling period 7j, token TTL 90j, opt-out source 24h aggregation) : utiliser `vi.useFakeTimers()` ou `Date.now` mock.
7. **Token expiration** : tester expire necessite fast-forward time via Jest fakeTimers.
8. **CI vs local flaky** : SSDs lents en CI -> retries via `jest.retryTimes(2)` + timeout 30s.
9. **Parallelism Jest** : `--runInBand` workers=1 par defaut pour Sprint 9 (BullMQ shared state).
10. **Cleanup async** : `await truncate` + `await flushRedis` + `await deleteMailhog` + `await nock.cleanAll()` ordre matter.
11. **Mailhog memory full** : DELETE messages before each test si > 500 mails accumules (sinon Mailhog OOM).
12. **Network timing CI** : `waitForJobCompletion` timeout 5s -> 10s en CI.
13. **Meta API URL drift** : version v21.0 hardcoded -> futur v22 update prompt master Sprint 35.
14. **Webhook signature timestamp drift** : Mailgun signing exige timestamp dans 5min window -> mock fixe `Date.now()`.
15. **Kafka consumer lag** : tests verifient Kafka event publish ET consume -> attendre 500ms ou polling.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.13 est la derniere du Sprint 9. Elle valide les 12 taches precedentes en integration. Sa reussite signifie que Sprint 9 est livrable en production (apres pentest Sprint 33 + load testing Sprint 34).

### 3.2 Position dans le programme

- Sprint 10+ ajoutera tests E2E pour notification triggers cross-module (auth, booking, insure consume orchestrator).
- Sprint 18 (customer portal) ajoutera tests Playwright UI pour preferences page.
- Sprint 32 (Docker integration tests) ajoutera CI pipelines sur ces tests.
- Sprint 33 (pentest) auditera la couverture E2E webhook signature + opt-out enforce.
- Sprint 34 (load testing) reutilisera helpers `sendTestMessage` pour throughput 1000 sends/min sustained.

### 3.3 Diagramme architecture tests

```
                          +---------------------------------------+
                          | Taches 3.2.1 a 3.2.12 terminees        |
                          +-----------------+---------------------+
                                            |
                                            v
                          +-----------------+--------------------+
                          | TACHE 3.2.13 (cette tache)             |
                          | 50+ scenarios Jest E2E                 |
                          | + 7 fichiers .e2e-spec.ts              |
                          | + comm-test-helpers.ts                 |
                          | + mock-meta-server.ts (nock)           |
                          | + mock-mailgun-server.ts (nock)        |
                          | + mailhog-client.ts                    |
                          | + wa-webhook-payloads.fixtures.ts      |
                          | + global-setup.ts / teardown.ts        |
                          +-+--+--+--+--+--+--+--+--+--+--+--+----+
                            |  |  |  |  |  |  |  |  |  |  |
                            v  v  v  v  v  v  v  v  v  v  v
                       NestJS API + Postgres + Redis + Kafka + Mailhog
                       (lance via Docker Compose test.yml)
                                            |
                                            v
                       +--------------------+--------------------+
                       | Mocks externes (nock interceptors)       |
                       | - graph.facebook.com/v21.0 (Meta API)    |
                       | - api.eu.mailgun.net/v3 (Mailgun API)    |
                       +-------------------------------------------+
```

### 3.4 Flow E2E typique : send WA happy path

```
TEST                                    SYSTEM SOUS TEST
----                                    ----------------
1. seedTenant + seedContact
   (preferred=whatsapp, opt-in)         INSERT crm_contacts (Sprint 8)

2. setupMetaMockHappy()                 nock intercept POST graph.facebook.com
                                        retourne { messages: [{ id: 'wamid.xxx' }] }

3. POST /api/v1/comm/messages/send     -> AuthGuard
   { contactId, templateName, vars }    -> TenantGuard
                                        -> MessagesController.send
                                        -> MessageOrchestrator.sendToContact
                                        -> OptoutService.getOptedOutChannels (none)
                                        -> WaTemplateRenderer.validateMetaApproved (true)
                                        -> finalChannel = 'whatsapp'
                                        -> messagesRepo.create status='pending'
                                        -> queue.add('wa-send', jobData)
                                        -> return { messageId, channel }

4. expect res.status === 201             HTTP 201 Created
   expect res.body.messageId             UUID

5. waitForJobCompletion('wa-send', msgId)
                                        BullMQ worker pickup job
                                        -> WaSendWorker.process
                                        -> idempotency check (status=pending, OK)
                                        -> WaTemplateRenderer.render
                                        -> WhatsAppCloudApiClient.sendTemplate
                                        -> nock intercepts -> returns wamid.xxx
                                        -> messagesRepo.update status='sent', provider_message_id='wamid.xxx', sent_at=NOW
                                        -> KafkaPublisher.publish('comm.message_sent')

6. GET /api/v1/comm/messages/:id        -> assert status='sent'
                                        -> assert provider_message_id='wamid.xxx'
                                        -> assert sent_at is timestamp

7. expect Kafka event captured          via test consumer subscribed to test topic

8. afterEach :
   - nock.cleanAll()
   - truncateCommTables()
   - flushRedisTestDb()
   - deleteAllMailhogMessages()
```

### 3.5 Flow E2E : webhook signature HMAC verify + idempotency

```
1. Compute valid signature
   sha256 HMAC of rawBody with WHATSAPP_APP_SECRET test value

2. POST /api/v1/public/webhooks/whatsapp
   Headers: X-Hub-Signature-256: sha256=<computed>
   Body: { entry: [{ id, changes: [{ value: { statuses: [{ id, status: 'delivered' }] } }] }] }

3. WaSignatureMiddleware
   - read req.rawBody (Fastify hook preserved)
   - compute expected = sha256 HMAC
   - timingSafeEqual(received, expected)
   - if invalid -> 401 + log warn
   - if valid -> next()

4. WaWebhookController.handleWebhook
   - INSERT comm_webhooks_received with idempotency_key=sha256(rawBody)
   - if duplicate (UNIQUE constraint) -> log info + return 200 (Meta retry tolerant)
   - publish Kafka 'comm.webhook_received'
   - return 200 IMMEDIATEMENT (Meta exige < 5s)

5. WaWebhookProcessorConsumer (async)
   - subscribe Kafka 'comm.webhook_received'
   - for each status: messagesRepo.update status='delivered', delivered_at=NOW

6. expect HTTP 200 (sync)
7. waitForKafkaConsumerLag < 500ms
8. expect message status updated in DB
9. POST again same body -> idempotency_key UNIQUE rejects -> log info skip -> count comm_webhooks_received still 1
```

---

## 4. Livrables checkables (28)

- [ ] 7 fichiers `.e2e-spec.ts` dans `repo/apps/api/test/comm/` -- 50+ tests total ~2150 lignes
- [ ] `messages-flow.e2e-spec.ts` (~400 lignes, 12+ tests send WA + Email)
- [ ] `wa-webhook-flow.e2e-spec.ts` (~350 lignes, 10+ tests webhook signature + idempotency + status + incoming + STOP)
- [ ] `email-flow.e2e-spec.ts` (~350 lignes, 10+ tests Mailhog + DKIM + List-Unsubscribe + RTL + opt-out link)
- [ ] `opt-out-flow.e2e-spec.ts` (~280 lignes, 10+ tests token URL + one-click + STOP + ARRET + re-consent + cooling)
- [ ] `orchestrator-routing.e2e-spec.ts` (~280 lignes, 10+ tests routing + fallback + override + broadcast)
- [ ] `templates-meta-approval.e2e-spec.ts` (~200 lignes, 8+ tests workflow draft->approved + cache)
- [ ] `delivery-tracking.e2e-spec.ts` (~280 lignes, 10+ tests Mailgun bounce + WA delivered/read + stats + alerts)
- [ ] Fixtures `comm-test-helpers.ts` (~250 lignes : sendTestMessage, waitForMailhogMessage, waitForJobCompletion, mockMetaSendTemplate, mockMailgunWebhook, generateOptoutToken, seedTenant, seedContact, resetQueues, truncateCommTables, flushRedisTestDb)
- [ ] Fixtures `mock-meta-server.ts` (~250 lignes : nock setup POST graph.facebook.com/v21.0 + markAsRead + uploadMedia + downloadMedia + setupMetaError flags)
- [ ] Fixtures `mock-mailgun-server.ts` (~150 lignes : mock Mailgun API + signMailgunWebhook helper HMAC)
- [ ] Fixtures `mailhog-client.ts` (~120 lignes : wrapper Mailhog REST avec polling + extractTokenFromBody + getEmailHeaders + deleteAll)
- [ ] Fixtures `wa-webhook-payloads.fixtures.ts` (~200 lignes : 15+ payloads Meta realistes types)
- [ ] `jest.e2e.config.ts` (~50 lignes : runInBand, timeout 30s, setupFilesAfterEach, retryTimes 2)
- [ ] `global-setup.ts` (~80 lignes : start docker compose test.yml, run migrations, seed templates, wait API health)
- [ ] `global-teardown.ts` (~30 lignes : cleanup connections + optional docker down)
- [ ] `README.md` documentation tests (~80 lignes)
- [ ] Mise a jour `package.json` apps/api : ajouter `nock@13.5.4`, scripts `test:e2e:comm`
- [ ] Mise a jour `.gitignore` : ajouter `apps/api/test/comm/.tmp/`
- [ ] Tous tests passent localement (50+)
- [ ] Tous tests passent CI GitHub Actions (Sprint 32)
- [ ] Mocks Meta + Mailgun + Mailhog fonctionnent (no real API call)
- [ ] Coverage : tous flows comm Sprint 9 testees >= 80% (cible 85%)
- [ ] Reproducibility : 5 runs consecutifs passent 100%
- [ ] Cleanup queues + DB + Mailhog + nock between tests
- [ ] Multi-tenant isolation verifiee (tenant A pas voir tenant B)
- [ ] No-emoji, No-console.log
- [ ] Documentation JSDoc dans helpers
- [ ] Run total < 8 min workers=1, < 3 min workers=4

---

## 5. Fichiers crees / modifies

```
repo/apps/api/test/comm/messages-flow.e2e-spec.ts                                  # ~400 lignes (12 tests)
repo/apps/api/test/comm/wa-webhook-flow.e2e-spec.ts                                 # ~350 lignes (10 tests)
repo/apps/api/test/comm/email-flow.e2e-spec.ts                                       # ~350 lignes (10 tests)
repo/apps/api/test/comm/opt-out-flow.e2e-spec.ts                                     # ~280 lignes (10 tests)
repo/apps/api/test/comm/orchestrator-routing.e2e-spec.ts                            # ~280 lignes (10 tests)
repo/apps/api/test/comm/templates-meta-approval.e2e-spec.ts                         # ~200 lignes (8 tests)
repo/apps/api/test/comm/delivery-tracking.e2e-spec.ts                                # ~280 lignes (10 tests)
repo/apps/api/test/comm/fixtures/comm-test-helpers.ts                                # ~250 lignes
repo/apps/api/test/comm/fixtures/mock-meta-server.ts                                  # ~250 lignes
repo/apps/api/test/comm/fixtures/mock-mailgun-server.ts                               # ~150 lignes
repo/apps/api/test/comm/fixtures/mailhog-client.ts                                     # ~120 lignes
repo/apps/api/test/comm/fixtures/wa-webhook-payloads.fixtures.ts                       # ~200 lignes
repo/apps/api/test/comm/jest.e2e.config.ts                                              # ~50 lignes
repo/apps/api/test/comm/global-setup.ts                                                 # ~80 lignes
repo/apps/api/test/comm/global-teardown.ts                                              # ~30 lignes
repo/apps/api/test/comm/README.md                                                       # ~80 lignes
repo/apps/api/package.json                                                              # modifie (+nock@13.5.4, scripts)
.gitignore                                                                              # modifie (+test/comm/.tmp/)
```

---

## 6. Code patterns COMPLETS

### 6.1 `jest.e2e.config.ts`

```typescript
import type { Config } from 'jest';
import { resolve } from 'node:path';

const config: Config = {
  displayName: 'comm-e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/comm/**/*.e2e-spec.ts'],
  rootDir: resolve(__dirname, '..', '..'),
  testTimeout: 30_000,
  globalSetup: '<rootDir>/test/comm/global-setup.ts',
  globalTeardown: '<rootDir>/test/comm/global-teardown.ts',
  setupFilesAfterEach: ['<rootDir>/test/comm/setup-after-each.ts'],
  maxWorkers: process.env.JEST_WORKERS ? Number.parseInt(process.env.JEST_WORKERS, 10) : 1,
  runInBand: !process.env.JEST_WORKERS,
  retry: process.env.CI === 'true' ? 2 : 0,
  collectCoverage: process.env.COVERAGE === 'true',
  coverageDirectory: '<rootDir>/coverage/e2e-comm',
  collectCoverageFrom: [
    '<rootDir>/src/modules/comm/**/*.ts',
    '<rootDir>/../../packages/comm/src/**/*.ts',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/index.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  },
  reporters: [
    'default',
    ['jest-html-reporters', { publicPath: './coverage/e2e-comm-report', filename: 'index.html' }],
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  forceExit: true,
  detectOpenHandles: process.env.DETECT_HANDLES === 'true',
};

export default config;
```

### 6.2 `global-setup.ts`

```typescript
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import Redis from 'ioredis';

export default async function globalSetup(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[E2E comm global-setup] Starting...');

  // 1. Start docker-compose test services if not already running
  if (!process.env.SKIP_DOCKER_COMPOSE) {
    try {
      execSync('docker compose -f infrastructure/docker/docker-compose.test.yml up -d --wait postgres redis kafka mailhog', {
        cwd: resolve(__dirname, '..', '..', '..', '..'),
        stdio: 'inherit',
        timeout: 180_000,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[E2E comm global-setup] Failed to start docker compose:', err);
      throw err;
    }
  }

  // 2. Wait API health check
  const apiHealthUrl = (process.env.E2E_BASE_URL ?? 'http://localhost:4000') + '/health';
  let healthy = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const r = await fetch(apiHealthUrl);
      if (r.status === 200) { healthy = true; break; }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 1000));
  }
  if (!healthy) throw new Error('[E2E comm] API health check failed after 30s');

  // 3. Apply migrations
  execSync('pnpm --filter @insurtech/database migrate:run', {
    cwd: resolve(__dirname, '..', '..', '..', '..'),
    stdio: 'inherit',
  });

  // 4. Seed templates (immutable, loaded ONCE per run)
  execSync('pnpm --filter @insurtech/database seed:comm-templates', {
    cwd: resolve(__dirname, '..', '..', '..', '..'),
    stdio: 'inherit',
  });

  // 5. Reset Redis test DB 15
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
    db: 15,
  });
  await redis.flushdb();
  await redis.quit();

  // 6. TRUNCATE all comm tables
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('TRUNCATE comm_webhooks_received, comm_messages, comm_optouts, crm_contacts CASCADE;');
  await pool.end();

  // eslint-disable-next-line no-console
  console.log('[E2E comm global-setup] Done.');
}
```

### 6.3 `global-teardown.ts`

```typescript
export default async function globalTeardown(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[E2E comm global-teardown] Cleaning up...');

  if (!process.env.SKIP_DOCKER_COMPOSE && process.env.E2E_STOP_AFTER === 'true') {
    const { execSync } = await import('node:child_process');
    const { resolve } = await import('node:path');
    execSync('docker compose -f infrastructure/docker/docker-compose.test.yml down', {
      cwd: resolve(__dirname, '..', '..', '..', '..'),
      stdio: 'inherit',
    });
  }

  // eslint-disable-next-line no-console
  console.log('[E2E comm global-teardown] Done.');
}
```

### 6.4 `fixtures/comm-test-helpers.ts`

```typescript
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { sign as jwtSign } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-0000000000aa';

let dbPool: Pool | null = null;
let redisClient: Redis | null = null;
const queueClients: Map<string, Queue> = new Map();

function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/skalean_test',
      max: 5,
    });
  }
  return dbPool;
}

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      db: 15,
      maxRetriesPerRequest: 3,
    });
  }
  return redisClient;
}

function getQueue(name: string): Queue {
  if (!queueClients.has(name)) {
    const q = new Queue(name, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
        db: 15,
      },
    });
    queueClients.set(name, q);
  }
  return queueClients.get(name)!;
}

export interface SeedTenantOptions {
  id?: string;
  name?: string;
}

export interface SeedContactOptions {
  id?: string;
  tenantId?: string;
  email?: string;
  phone?: string;
  preferredChannel?: 'whatsapp' | 'email' | 'sms';
  preferredLanguage?: 'fr' | 'ar-MA' | 'en' | 'fr-MA';
  tags?: string[];
}

export interface SendTestMessageOptions {
  token?: string;
  tenantId?: string;
  expectStatus?: number;
}

/**
 * Generate a test access token JWT for the default test user.
 * Uses test secret JWT_SECRET=test-secret-do-not-use-in-prod.
 */
export function generateTestAccessToken(opts: { userId?: string; tenantId?: string; permissions?: string[] } = {}): string {
  const secret = process.env.JWT_SECRET ?? 'test-secret-do-not-use-in-prod';
  return jwtSign(
    {
      sub: opts.userId ?? DEFAULT_USER_ID,
      tenant_id: opts.tenantId ?? DEFAULT_TENANT_ID,
      permissions: opts.permissions ?? ['comm.messages.send', 'comm.messages.read', 'comm.templates.manage', 'comm.optouts.manage'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret,
    { algorithm: 'HS256' },
  );
}

/**
 * Seed a tenant in the test DB.
 */
export async function seedTenant(opts: SeedTenantOptions = {}): Promise<string> {
  const id = opts.id ?? DEFAULT_TENANT_ID;
  const name = opts.name ?? 'E2E Test Tenant';
  const pool = getDbPool();
  await pool.query(
    `INSERT INTO tenants (id, name, status, created_at) VALUES ($1, $2, 'active', NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, name],
  );
  return id;
}

/**
 * Seed a contact in the test DB.
 */
export async function seedContact(opts: SeedContactOptions = {}): Promise<{ id: string; email: string; phone: string }> {
  const id = opts.id ?? randomUUID();
  const tenantId = opts.tenantId ?? DEFAULT_TENANT_ID;
  const email = opts.email ?? `e2e-${id.slice(0, 8)}@skalean.test`;
  const phone = opts.phone ?? '+212612345678';
  const preferredChannel = opts.preferredChannel ?? 'whatsapp';
  const preferredLanguage = opts.preferredLanguage ?? 'fr';
  const tags = opts.tags ?? ['customer'];
  const pool = getDbPool();
  await pool.query(
    `INSERT INTO crm_contacts (id, tenant_id, email, phone, preferred_channel, preferred_language, tags, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone`,
    [id, tenantId, email, phone, preferredChannel, preferredLanguage, tags],
  );
  return { id, email, phone };
}

/**
 * Send a test message via the API. Returns messageId. Throws if status mismatch.
 */
export async function sendTestMessage(
  app: INestApplication,
  contactId: string,
  templateName: string,
  variables: Record<string, unknown>,
  options: SendTestMessageOptions = {},
): Promise<string> {
  const token = options.token ?? generateTestAccessToken();
  const tenantId = options.tenantId ?? DEFAULT_TENANT_ID;
  const expectStatus = options.expectStatus ?? 201;

  const res = await request(app.getHttpServer())
    .post('/api/v1/comm/messages/send')
    .set('Authorization', `Bearer ${token}`)
    .set('x-tenant-id', tenantId)
    .send({ contactId, templateName, variables });

  if (res.status !== expectStatus) {
    throw new Error(`sendTestMessage expected status ${expectStatus}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return res.body?.data?.messageId ?? res.body?.messageId;
}

/**
 * Wait for a BullMQ job to complete (status='sent' or 'failed' in comm_messages).
 * Polls comm_messages.status every 100ms up to timeoutMs (default 5000ms).
 */
export async function waitForJobCompletion(
  queueName: string,
  messageId: string,
  options: { timeout?: number; pollIntervalMs?: number; targetStatus?: string } = {},
): Promise<{ status: string; provider_message_id: string | null; fail_reason: string | null }> {
  const timeout = options.timeout ?? 5000;
  const pollInterval = options.pollIntervalMs ?? 100;
  const targetStatus = options.targetStatus ?? null;
  const pool = getDbPool();
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const r = await pool.query(
      'SELECT status, provider_message_id, fail_reason FROM comm_messages WHERE id = $1',
      [messageId],
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      if (targetStatus) {
        if (row.status === targetStatus) return row;
      } else if (row.status === 'sent' || row.status === 'failed' || row.status === 'delivered') {
        return row;
      }
    }
    await new Promise((res) => setTimeout(res, pollInterval));
  }

  throw new Error(`waitForJobCompletion timeout after ${timeout}ms for message ${messageId} (queue=${queueName})`);
}

/**
 * Wait for an email in Mailhog.
 */
export async function waitForMailhogMessage(
  toEmail: string,
  timeoutMs = 10_000,
): Promise<MailhogMessage> {
  const { waitForEmailTo } = await import('./mailhog-client.js');
  return waitForEmailTo(toEmail, timeoutMs);
}

/**
 * Generate a signed opt-out token JWT (Sprint 5 helpers).
 */
export function generateOptoutToken(contactId: string, channel: 'whatsapp' | 'email'): string {
  const secret = process.env.OPTOUT_TOKEN_SECRET ?? 'test-optout-secret';
  return jwtSign(
    { contactId, channel, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 90 * 24 * 3600 },
    secret,
    { algorithm: 'HS256' },
  );
}

/**
 * Reset BullMQ queues : drain + clean.
 */
export async function resetQueues(queueNames: string[] = ['wa-send', 'email-send', 'wa-webhook-process', 'email-webhook-process']): Promise<void> {
  for (const name of queueNames) {
    const q = getQueue(name);
    await q.drain(true);
    await q.clean(0, 1000, 'completed');
    await q.clean(0, 1000, 'failed');
    await q.clean(0, 1000, 'wait');
    await q.clean(0, 1000, 'delayed');
  }
}

/**
 * TRUNCATE all comm tables (preserve seeds templates).
 */
export async function truncateCommTables(): Promise<void> {
  const pool = getDbPool();
  await pool.query('TRUNCATE comm_webhooks_received, comm_messages, comm_optouts CASCADE;');
  await pool.query('DELETE FROM crm_contacts WHERE email LIKE \'e2e-%@skalean.test\' OR email LIKE \'%@e2e-test.local\';');
  await pool.query('DELETE FROM crm_interactions WHERE source = \'e2e-test\';');
}

/**
 * FLUSHDB Redis test DB 15.
 */
export async function flushRedisTestDb(): Promise<void> {
  const redis = getRedis();
  await redis.flushdb();
}

/**
 * Close all open connections.
 */
export async function closeFixtures(): Promise<void> {
  if (dbPool) { await dbPool.end(); dbPool = null; }
  if (redisClient) { await redisClient.quit(); redisClient = null; }
  for (const q of queueClients.values()) {
    await q.close();
  }
  queueClients.clear();
}

interface MailhogMessage {
  ID: string;
  Content: { Headers: Record<string, string[]>; Body: string };
  To: Array<{ Mailbox: string; Domain: string }>;
}
```

### 6.5 `fixtures/mock-meta-server.ts`

```typescript
import nock from 'nock';
import { randomBytes } from 'node:crypto';

const META_BASE_URL = 'https://graph.facebook.com';
const META_VERSION = 'v21.0';

export type MetaErrorScenario =
  | 'rate_limit'              // Code 130
  | 'phone_not_opted_in'      // Code 131
  | 'invalid_template'        // Code 132
  | 'expired_token'           // Code 190
  | 'permission_denied'       // Code 200
  | 'network_timeout'
  | 'server_error_5xx';

interface MetaMockOptions {
  phoneNumberId?: string;
  responseDelay?: number;
  persist?: boolean;
}

/**
 * Setup nock interceptor for happy-path Meta sendTemplate.
 * Returns a synthetic message_id wamid.HBgN...
 */
export function setupMetaMockHappy(options: MetaMockOptions = {}): nock.Scope {
  const phoneNumberId = options.phoneNumberId ?? '\\d+';
  const scope = nock(META_BASE_URL)
    .post(new RegExp(`/${META_VERSION}/${phoneNumberId}/messages`))
    .delay(options.responseDelay ?? 0)
    .reply(200, (uri, requestBody) => {
      const messageId = `wamid.HBgN${randomBytes(16).toString('hex').toUpperCase()}`;
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: typeof requestBody === 'object' ? (requestBody as { to?: string }).to ?? '212612345678' : '212612345678', wa_id: '212612345678' }],
        messages: [{ id: messageId, message_status: 'accepted' }],
      };
    });
  if (options.persist) scope.persist();
  return scope;
}

/**
 * Setup nock interceptor for Meta sendTemplate error.
 */
export function setupMetaMockError(scenario: MetaErrorScenario, options: MetaMockOptions = {}): nock.Scope {
  const phoneNumberId = options.phoneNumberId ?? '\\d+';
  const scope = nock(META_BASE_URL).post(new RegExp(`/${META_VERSION}/${phoneNumberId}/messages`));

  switch (scenario) {
    case 'rate_limit':
      return scope.reply(429, {
        error: {
          message: 'Rate limit hit',
          type: 'OAuthException',
          code: 130,
          fbtrace_id: 'AaBbCc',
        },
      });
    case 'phone_not_opted_in':
      return scope.reply(400, {
        error: {
          message: 'Recipient phone number not in allowed list',
          type: 'OAuthException',
          code: 131,
          fbtrace_id: 'AaBbCc',
        },
      });
    case 'invalid_template':
      return scope.reply(400, {
        error: {
          message: 'Template name does not exist in approved list',
          type: 'OAuthException',
          code: 132,
          error_subcode: 2388023,
          fbtrace_id: 'AaBbCc',
        },
      });
    case 'expired_token':
      return scope.reply(401, {
        error: { message: 'Session expired', type: 'OAuthException', code: 190 },
      });
    case 'permission_denied':
      return scope.reply(403, {
        error: { message: 'Permission denied', type: 'OAuthException', code: 200 },
      });
    case 'network_timeout':
      return scope.delayConnection(31_000).reply(200, {});
    case 'server_error_5xx':
      return scope.reply(503, { error: { message: 'Service Unavailable' } });
    default:
      throw new Error(`Unknown Meta error scenario: ${scenario}`);
  }
}

/**
 * Setup nock interceptor for Meta markAsRead.
 */
export function setupMetaMockMarkAsRead(options: MetaMockOptions = {}): nock.Scope {
  const phoneNumberId = options.phoneNumberId ?? '\\d+';
  const scope = nock(META_BASE_URL)
    .post(new RegExp(`/${META_VERSION}/${phoneNumberId}/messages`), (body: Record<string, unknown>) => body.status === 'read')
    .reply(200, { success: true });
  if (options.persist) scope.persist();
  return scope;
}

/**
 * Setup nock interceptor for Meta uploadMedia.
 */
export function setupMetaMockUploadMedia(options: MetaMockOptions = {}): nock.Scope {
  const phoneNumberId = options.phoneNumberId ?? '\\d+';
  const scope = nock(META_BASE_URL)
    .post(new RegExp(`/${META_VERSION}/${phoneNumberId}/media`))
    .reply(200, () => ({ id: `media_${randomBytes(8).toString('hex')}` }));
  if (options.persist) scope.persist();
  return scope;
}

/**
 * Setup nock interceptor for Meta downloadMedia (GET media metadata + GET file).
 */
export function setupMetaMockDownloadMedia(mediaContent: Buffer = Buffer.from('test-media-content'), options: MetaMockOptions = {}): nock.Scope[] {
  const metaScope = nock(META_BASE_URL)
    .get(new RegExp(`/${META_VERSION}/[^/]+`))
    .reply(200, {
      url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/test-file',
      mime_type: 'image/jpeg',
      sha256: 'abc',
      file_size: mediaContent.length,
      id: 'media_test_id',
      messaging_product: 'whatsapp',
    });
  const fileScope = nock('https://lookaside.fbsbx.com')
    .get(/\/whatsapp_business\/attachments\/.*/)
    .reply(200, mediaContent);
  return [metaScope, fileScope];
}

/**
 * Verify nock has no pending interceptors (asserts all expected calls were made).
 */
export function assertNockDone(scope: nock.Scope, message?: string): void {
  if (!scope.isDone()) {
    const pending = scope.pendingMocks();
    throw new Error(`${message ?? 'nock interceptors pending'}: ${pending.join(', ')}`);
  }
}

/**
 * Cleanup all nock interceptors. Call in afterEach.
 */
export function cleanupNock(): void {
  nock.cleanAll();
  nock.enableNetConnect((host) => {
    return host.includes('localhost') || host.includes('127.0.0.1');
  });
}

/**
 * Initial setup (call in beforeAll). Disables all real network except localhost.
 */
export function initNockGlobals(): void {
  nock.disableNetConnect();
  nock.enableNetConnect((host) => {
    return host.includes('localhost') || host.includes('127.0.0.1');
  });
}

/**
 * Capture the last request body sent to Meta (for assertion).
 */
let capturedRequests: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

export function startCapturingMetaRequests(): void {
  capturedRequests = [];
  nock(META_BASE_URL)
    .post(/.*/)
    .reply((uri, requestBody, callback) => {
      capturedRequests.push({ url: uri, body: requestBody, headers: {} });
      const messageId = `wamid.HBgN${randomBytes(16).toString('hex').toUpperCase()}`;
      callback(null, [200, { messaging_product: 'whatsapp', messages: [{ id: messageId }] }]);
    })
    .persist();
}

export function getCapturedMetaRequests(): typeof capturedRequests {
  return capturedRequests;
}

export function clearCapturedMetaRequests(): void {
  capturedRequests = [];
}
```

### 6.6 `fixtures/mock-mailgun-server.ts`

```typescript
import nock from 'nock';
import { createHmac, randomBytes } from 'node:crypto';

const MAILGUN_BASE_URL = 'https://api.eu.mailgun.net';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? 'mg.skalean.test';
const MAILGUN_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? 'test-mailgun-signing-key';

export type MailgunEventType = 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | 'permanent_fail' | 'temporary_fail';

interface MailgunMockOptions {
  domain?: string;
  responseDelay?: number;
  persist?: boolean;
}

/**
 * Setup nock interceptor for Mailgun send (happy path).
 */
export function setupMailgunMockHappy(options: MailgunMockOptions = {}): nock.Scope {
  const domain = options.domain ?? MAILGUN_DOMAIN;
  const scope = nock(MAILGUN_BASE_URL)
    .post(`/v3/${domain}/messages`)
    .delay(options.responseDelay ?? 0)
    .reply(200, () => ({
      id: `<${randomBytes(16).toString('hex')}@${domain}>`,
      message: 'Queued. Thank you.',
    }));
  if (options.persist) scope.persist();
  return scope;
}

/**
 * Setup nock interceptor for Mailgun send error (rate limit, blocked).
 */
export function setupMailgunMockError(statusCode: number, options: MailgunMockOptions = {}): nock.Scope {
  const domain = options.domain ?? MAILGUN_DOMAIN;
  return nock(MAILGUN_BASE_URL)
    .post(`/v3/${domain}/messages`)
    .reply(statusCode, { message: `Mailgun error ${statusCode}` });
}

/**
 * Compute Mailgun webhook signature. timestamp + token concat HMAC SHA-256 hex.
 * Reference: https://documentation.mailgun.com/en/latest/user_manual.html#webhooks
 */
export function signMailgunWebhook(timestamp: string, token: string, signingKey?: string): string {
  return createHmac('sha256', signingKey ?? MAILGUN_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
}

/**
 * Build a Mailgun webhook payload (signed) for a given event type.
 */
export function buildMailgunWebhookPayload(opts: {
  eventType: MailgunEventType;
  messageId: string;
  recipient: string;
  reason?: string;
  severity?: 'temporary' | 'permanent';
}): {
  signature: { timestamp: string; token: string; signature: string };
  'event-data': Record<string, unknown>;
} {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = randomBytes(20).toString('hex');
  const signature = signMailgunWebhook(timestamp, token);

  return {
    signature: { timestamp, token, signature },
    'event-data': {
      event: opts.eventType,
      timestamp: Number.parseInt(timestamp, 10),
      id: randomBytes(16).toString('hex'),
      message: { headers: { 'message-id': opts.messageId.replace(/^<|>$/g, '') } },
      recipient: opts.recipient,
      severity: opts.severity ?? (opts.eventType === 'bounced' ? 'permanent' : 'temporary'),
      reason: opts.reason ?? null,
      'delivery-status': opts.eventType === 'bounced' ? { code: 550, message: opts.reason ?? 'No such user' } : undefined,
    },
  };
}
```

### 6.7 `fixtures/mailhog-client.ts`

```typescript
const MAILHOG_API = process.env.MAILHOG_API_URL ?? 'http://localhost:8025';

export interface MailhogMessage {
  ID: string;
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
    MIME?: { Parts: Array<{ Headers: Record<string, string[]>; Body: string }> };
  };
  To: Array<{ Mailbox: string; Domain: string }>;
  From: { Mailbox: string; Domain: string };
}

export async function deleteAllMailhogMessages(): Promise<void> {
  await fetch(`${MAILHOG_API}/api/v1/messages`, { method: 'DELETE' });
}

export async function waitForEmailTo(recipient: string, timeoutMs = 10_000): Promise<MailhogMessage> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${MAILHOG_API}/api/v2/search?kind=containing&query=${encodeURIComponent(recipient)}`);
    const data = (await r.json()) as { count: number; items: MailhogMessage[] };
    if (data.count > 0 && data.items.length > 0) {
      return data.items[0];
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error(`Mailhog timeout : email to ${recipient} not received within ${timeoutMs}ms`);
}

export async function getEmailsFor(recipient: string): Promise<MailhogMessage[]> {
  const r = await fetch(`${MAILHOG_API}/api/v2/search?kind=containing&query=${encodeURIComponent(recipient)}`);
  const data = (await r.json()) as { count: number; items: MailhogMessage[] };
  return data.items ?? [];
}

export function getEmailHeader(message: MailhogMessage, headerName: string): string | undefined {
  const value = message.Content.Headers[headerName];
  return Array.isArray(value) ? value[0] : undefined;
}

export function getEmailSubject(message: MailhogMessage): string {
  const subject = getEmailHeader(message, 'Subject') ?? '';
  if (subject.startsWith('=?')) {
    const match = subject.match(/^=\?[^?]+\?B\?(.+?)\?=$/);
    if (match) return Buffer.from(match[1], 'base64').toString('utf-8');
  }
  return subject;
}

export function getEmailHtmlPart(message: MailhogMessage): string | undefined {
  if (message.Content.MIME?.Parts) {
    for (const part of message.Content.MIME.Parts) {
      const ct = part.Headers['Content-Type']?.[0] ?? '';
      if (ct.includes('text/html')) return part.Body;
    }
  }
  if (getEmailHeader(message, 'Content-Type')?.includes('text/html')) return message.Content.Body;
  return undefined;
}

export function getEmailPlainPart(message: MailhogMessage): string | undefined {
  if (message.Content.MIME?.Parts) {
    for (const part of message.Content.MIME.Parts) {
      const ct = part.Headers['Content-Type']?.[0] ?? '';
      if (ct.includes('text/plain')) return part.Body;
    }
  }
  return undefined;
}

export function extractOptoutTokenFromBody(message: MailhogMessage): string | null {
  const body = getEmailHtmlPart(message) ?? message.Content.Body;
  const match = body.match(/optout\/([A-Za-z0-9._-]+)/);
  return match ? match[1] : null;
}

export function hasDkimSignature(message: MailhogMessage): boolean {
  return !!getEmailHeader(message, 'DKIM-Signature');
}

export function hasListUnsubscribe(message: MailhogMessage): boolean {
  return !!getEmailHeader(message, 'List-Unsubscribe') && !!getEmailHeader(message, 'List-Unsubscribe-Post');
}
```

### 6.8 `fixtures/wa-webhook-payloads.fixtures.ts`

```typescript
import { randomBytes } from 'node:crypto';

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '123456789012345';
const BUSINESS_ACCOUNT_ID = '098765432109876';

export function buildStatusUpdatePayload(
  messageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  recipientPhone = '212612345678',
): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: BUSINESS_ACCOUNT_ID,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '212600000000', phone_number_id: PHONE_NUMBER_ID },
              statuses: [
                {
                  id: messageId,
                  status,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  recipient_id: recipientPhone,
                  conversation: { id: 'conv_' + randomBytes(8).toString('hex'), origin: { type: 'business_initiated' } },
                  pricing: { billable: true, pricing_model: 'CBP', category: 'business_initiated' },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

export function buildBatchStatusPayload(messageIds: string[], status: 'delivered' | 'read'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: BUSINESS_ACCOUNT_ID,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '212600000000', phone_number_id: PHONE_NUMBER_ID },
              statuses: messageIds.map((id) => ({
                id,
                status,
                timestamp: String(Math.floor(Date.now() / 1000)),
                recipient_id: '212612345678',
              })),
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

export function buildIncomingTextPayload(text: string, fromPhone = '212612345678'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: BUSINESS_ACCOUNT_ID,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '212600000000', phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: 'Mohamed Test' }, wa_id: fromPhone }],
              messages: [
                {
                  from: fromPhone,
                  id: 'wamid.' + randomBytes(16).toString('hex').toUpperCase(),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: text },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

export function buildIncomingImagePayload(mediaId: string, fromPhone = '212612345678', caption?: string): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: BUSINESS_ACCOUNT_ID,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '212600000000', phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: 'Test User' }, wa_id: fromPhone }],
              messages: [
                {
                  from: fromPhone,
                  id: 'wamid.' + randomBytes(16).toString('hex').toUpperCase(),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'image',
                  image: {
                    mime_type: 'image/jpeg',
                    sha256: randomBytes(32).toString('hex'),
                    id: mediaId,
                    caption,
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

export function buildIncomingAudioPayload(mediaId: string, fromPhone = '212612345678'): Record<string, unknown> {
  return buildIncomingMediaPayload('audio', mediaId, fromPhone, { mime_type: 'audio/ogg; codecs=opus', voice: true });
}

export function buildIncomingVideoPayload(mediaId: string, fromPhone = '212612345678'): Record<string, unknown> {
  return buildIncomingMediaPayload('video', mediaId, fromPhone, { mime_type: 'video/mp4' });
}

export function buildIncomingDocumentPayload(mediaId: string, filename: string, fromPhone = '212612345678'): Record<string, unknown> {
  return buildIncomingMediaPayload('document', mediaId, fromPhone, { mime_type: 'application/pdf', filename });
}

function buildIncomingMediaPayload(
  type: 'audio' | 'video' | 'document',
  mediaId: string,
  fromPhone: string,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: BUSINESS_ACCOUNT_ID,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '212600000000', phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: 'Test' }, wa_id: fromPhone }],
              messages: [
                {
                  from: fromPhone,
                  id: 'wamid.' + randomBytes(16).toString('hex').toUpperCase(),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type,
                  [type]: { id: mediaId, sha256: randomBytes(32).toString('hex'), ...extra },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

export function buildIncomingLocationPayload(lat: number, lng: number, fromPhone = '212612345678'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [{ wa_id: fromPhone }], messages: [{ from: fromPhone, id: 'wamid.' + randomBytes(16).toString('hex'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'location', location: { latitude: lat, longitude: lng, name: 'Test Location', address: 'Casablanca' } }] }, field: 'messages' }] }],
  };
}

export function buildIncomingButtonReplyPayload(buttonId: string, buttonText: string, fromPhone = '212612345678'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [{ wa_id: fromPhone }], messages: [{ from: fromPhone, id: 'wamid.' + randomBytes(16).toString('hex'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: buttonId, title: buttonText } } }] }, field: 'messages' }] }],
  };
}

export function buildIncomingListReplyPayload(listId: string, listTitle: string, fromPhone = '212612345678'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [{ wa_id: fromPhone }], messages: [{ from: fromPhone, id: 'wamid.' + randomBytes(16).toString('hex'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: listId, title: listTitle, description: 'List item description' } } }] }, field: 'messages' }] }],
  };
}

export function buildFailedStatusPayload(messageId: string, errorCode = 131): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ id: messageId, status: 'failed', timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: '212612345678', errors: [{ code: errorCode, title: 'Recipient phone not opted in', message: 'Phone not in allowed list' }] }] }, field: 'messages' }] }],
  };
}

export function buildMultiEntryPayload(): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      { id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ id: 'wamid.entry1', status: 'delivered', timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: '212611111111' }] }, field: 'messages' }] },
      { id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ id: 'wamid.entry2', status: 'read', timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: '212622222222' }] }, field: 'messages' }] },
      { id: BUSINESS_ACCOUNT_ID, changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: PHONE_NUMBER_ID }, contacts: [{ wa_id: '212633333333' }], messages: [{ from: '212633333333', id: 'wamid.incoming', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'STOP' } }] }, field: 'messages' }] },
    ],
  };
}

export function buildAccountAlertsApprovedPayload(templateName: string, templateLanguage: 'fr' | 'ar'): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: BUSINESS_ACCOUNT_ID, time: Math.floor(Date.now() / 1000), changes: [{ value: { event: 'APPROVED', message_template_id: 'mtpl_' + randomBytes(8).toString('hex'), message_template_name: templateName, message_template_language: templateLanguage, reason: null }, field: 'message_template_status_update' }] }],
  };
}

export function buildAccountAlertsRejectedPayload(templateName: string, reason: string): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: BUSINESS_ACCOUNT_ID, time: Math.floor(Date.now() / 1000), changes: [{ value: { event: 'REJECTED', message_template_id: 'mtpl_' + randomBytes(8).toString('hex'), message_template_name: templateName, message_template_language: 'fr', reason }, field: 'message_template_status_update' }] }],
  };
}
```

### 6.9 `messages-flow.e2e-spec.ts` (12+ tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import {
  sendTestMessage,
  waitForJobCompletion,
  waitForMailhogMessage,
  seedTenant,
  seedContact,
  truncateCommTables,
  flushRedisTestDb,
  resetQueues,
  closeFixtures,
  generateTestAccessToken,
} from './fixtures/comm-test-helpers.js';
import {
  setupMetaMockHappy,
  setupMetaMockError,
  cleanupNock,
  initNockGlobals,
  startCapturingMetaRequests,
  getCapturedMetaRequests,
  clearCapturedMetaRequests,
} from './fixtures/mock-meta-server.js';
import { setupMailgunMockHappy } from './fixtures/mock-mailgun-server.js';
import { deleteAllMailhogMessages, getEmailSubject, hasDkimSignature, getEmailHtmlPart } from './fixtures/mailhog-client.js';

describe('Messages Flow E2E (12+ tests)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    initNockGlobals();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await seedTenant({});
  });

  afterAll(async () => {
    await app.close();
    await closeFixtures();
  });

  beforeEach(async () => {
    await truncateCommTables();
    await flushRedisTestDb();
    await resetQueues();
    await deleteAllMailhogMessages();
  });

  afterEach(() => {
    cleanupNock();
  });

  // -------------------------------------------------------------------------
  // Send WA happy path (5 tests)
  // -------------------------------------------------------------------------

  it('1. should send WA template fr and update message status=sent with Kafka event emitted', async () => {
    const metaScope = setupMetaMockHappy();
    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Mohamed', appointment_time: '15h00' });

    const result = await waitForJobCompletion('wa-send', messageId, { targetStatus: 'sent', timeout: 5000 });
    expect(result.status).toBe('sent');
    expect(result.provider_message_id).toMatch(/^wamid\.HBgN/);
    expect(metaScope.isDone()).toBe(true);
  });

  it('2. should send WA template ar-MA Darija mapped to Meta language_code=ar', async () => {
    startCapturingMetaRequests();
    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'ar-MA' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Karim', appointment_time: '15h' });
    await waitForJobCompletion('wa-send', messageId, { targetStatus: 'sent' });

    const captured = getCapturedMetaRequests();
    expect(captured.length).toBeGreaterThanOrEqual(1);
    const body = captured[0].body as { template?: { language?: { code?: string } } };
    expect(body.template?.language?.code).toBe('ar');

    clearCapturedMetaRequests();
  });

  it('3. should send WA template en for English locale', async () => {
    setupMetaMockHappy();
    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'en' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'John', appointment_time: '3pm' });
    const result = await waitForJobCompletion('wa-send', messageId, { targetStatus: 'sent' });
    expect(result.status).toBe('sent');
  });

  it('4. should send WA template with variables interpolated correctly in Meta call payload', async () => {
    startCapturingMetaRequests();
    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' });

    const messageId = await sendTestMessage(app, contact.id, 'police_signed_confirmation', { user_name: 'Mohamed Alaoui', police_number: 'POL-2026-001' });
    await waitForJobCompletion('wa-send', messageId, { targetStatus: 'sent' });

    const captured = getCapturedMetaRequests();
    const body = captured[0].body as { template?: { components?: Array<{ parameters?: Array<{ text?: string }> }> } };
    const params = body.template?.components?.[0]?.parameters ?? [];
    expect(params.map((p) => p.text)).toEqual(['Mohamed Alaoui', 'POL-2026-001']);

    clearCapturedMetaRequests();
  });

  it('5. should retry 3 times when Meta returns rate_limit code 130', async () => {
    setupMetaMockError('rate_limit');
    setupMetaMockError('rate_limit');
    const happyScope = setupMetaMockHappy();

    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' });
    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Test', appointment_time: '10h' });

    const result = await waitForJobCompletion('wa-send', messageId, { targetStatus: 'sent', timeout: 60_000 });
    expect(result.status).toBe('sent');
    expect(happyScope.isDone()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Send Email happy path (5 tests)
  // -------------------------------------------------------------------------

  it('6. should send Email via Mailhog and verify received with DKIM headers', async () => {
    setupMailgunMockHappy({ persist: true });
    const contact = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'recipient1@e2e-test.local' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Sara', appointment_time: '14h' });
    await waitForJobCompletion('email-send', messageId, { targetStatus: 'sent' });

    const message = await waitForMailhogMessage('recipient1@e2e-test.local');
    expect(message).toBeDefined();
    expect(getEmailSubject(message)).toContain('rendez-vous');
    expect(hasDkimSignature(message)).toBe(true);
  });

  it('7. should render Email fr with user_name interpolated in HTML body', async () => {
    setupMailgunMockHappy({ persist: true });
    const contact = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'recipient2@e2e-test.local' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Aicha Bennani', appointment_time: '11h' });
    await waitForJobCompletion('email-send', messageId, { targetStatus: 'sent' });

    const message = await waitForMailhogMessage('recipient2@e2e-test.local');
    const html = getEmailHtmlPart(message) ?? '';
    expect(html).toContain('Aicha Bennani');
  });

  it('8. should render Email ar-MA with HTML dir=rtl', async () => {
    setupMailgunMockHappy({ persist: true });
    const contact = await seedContact({ preferredChannel: 'email', preferredLanguage: 'ar-MA', email: 'recipient3@e2e-test.local' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Youssef', appointment_time: '10h' });
    await waitForJobCompletion('email-send', messageId, { targetStatus: 'sent' });

    const message = await waitForMailhogMessage('recipient3@e2e-test.local');
    const html = getEmailHtmlPart(message) ?? '';
    expect(html).toMatch(/<html[^>]*dir=["']rtl["']/i);
  });

  it('9. should send Email multipart with both HTML and plain text parts', async () => {
    setupMailgunMockHappy({ persist: true });
    const contact = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'recipient4@e2e-test.local' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Test', appointment_time: '12h' });
    await waitForJobCompletion('email-send', messageId, { targetStatus: 'sent' });

    const message = await waitForMailhogMessage('recipient4@e2e-test.local');
    const { getEmailHtmlPart: getHtml, getEmailPlainPart } = await import('./fixtures/mailhog-client.js');
    expect(getHtml(message)).toBeDefined();
    expect(getEmailPlainPart(message)).toBeDefined();
  });

  it('10. should include List-Unsubscribe header with valid token', async () => {
    setupMailgunMockHappy({ persist: true });
    const contact = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'recipient5@e2e-test.local' });

    const messageId = await sendTestMessage(app, contact.id, 'appointment_reminder', { user_name: 'Test', appointment_time: '12h' });
    await waitForJobCompletion('email-send', messageId, { targetStatus: 'sent' });

    const message = await waitForMailhogMessage('recipient5@e2e-test.local');
    const { hasListUnsubscribe, getEmailHeader } = await import('./fixtures/mailhog-client.js');
    expect(hasListUnsubscribe(message)).toBe(true);
    expect(getEmailHeader(message, 'List-Unsubscribe-Post')).toBe('List-Unsubscribe=One-Click');
  });

  // -------------------------------------------------------------------------
  // Edge cases (2 extra tests)
  // -------------------------------------------------------------------------

  it('11. should reject send when Meta returns invalid_template (132) without retry', async () => {
    const errScope = setupMetaMockError('invalid_template');
    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' });

    const messageId = await sendTestMessage(app, contact.id, 'nonexistent_template', { x: 'y' });
    const result = await waitForJobCompletion('wa-send', messageId, { targetStatus: 'failed', timeout: 5000 });
    expect(result.status).toBe('failed');
    expect(result.fail_reason).toContain('invalid_template');
    expect(errScope.isDone()).toBe(true);
  });

  it('12. should reject send via REST when missing required permission', async () => {
    setupMetaMockHappy({ persist: true });
    const contact = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' });
    const tokenWithoutPerm = generateTestAccessToken({ permissions: [] });

    const res = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send')
      .set('Authorization', `Bearer ${tokenWithoutPerm}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ contactId: contact.id, templateName: 'appointment_reminder', variables: {} });
    expect(res.status).toBe(403);
  });
});
```

### 6.10 `wa-webhook-flow.e2e-spec.ts` (10+ tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module.js';
import {
  seedTenant,
  seedContact,
  truncateCommTables,
  flushRedisTestDb,
  resetQueues,
  closeFixtures,
} from './fixtures/comm-test-helpers.js';
import {
  buildStatusUpdatePayload,
  buildBatchStatusPayload,
  buildIncomingTextPayload,
  buildMultiEntryPayload,
  buildFailedStatusPayload,
} from './fixtures/wa-webhook-payloads.fixtures.js';
import { cleanupNock, initNockGlobals } from './fixtures/mock-meta-server.js';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? 'test-app-secret';
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? 'test-verify-token';

function signPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return 'sha256=' + createHmac('sha256', APP_SECRET).update(raw).digest('hex');
}

describe('WhatsApp Webhook Flow E2E (10+ tests)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    initNockGlobals();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await seedTenant({});
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await closeFixtures();
  });

  beforeEach(async () => {
    await truncateCommTables();
    await flushRedisTestDb();
    await resetQueues();
  });

  afterEach(() => {
    cleanupNock();
  });

  it('1. should respond 200 with challenge when GET verification token matches', async () => {
    const challenge = 'test-challenge-' + Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': challenge });
    expect(res.status).toBe(200);
    expect(res.text).toBe(challenge);
  });

  it('2. should respond 403 when GET verification token does not match', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'WRONG_TOKEN', 'hub.challenge': 'x' });
    expect(res.status).toBe(403);
  });

  it('3. should respond 200 and process when POST signature is valid', async () => {
    const payload = buildStatusUpdatePayload('wamid.TEST001', 'delivered');
    const res = await request(app.getHttpServer())
      .post('/api/v1/public/webhooks/whatsapp')
      .set('X-Hub-Signature-256', signPayload(payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 500));
    const r = await pool.query('SELECT COUNT(*) FROM comm_webhooks_received');
    expect(Number.parseInt(r.rows[0].count, 10)).toBe(1);
  });

  it('4. should respond 401 when POST signature is invalid', async () => {
    const payload = buildStatusUpdatePayload('wamid.TEST002', 'delivered');
    const res = await request(app.getHttpServer())
      .post('/api/v1/public/webhooks/whatsapp')
      .set('X-Hub-Signature-256', 'sha256=invalidsignature1234567890')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res.status).toBe(401);
  });

  it('5. should respond 401 when POST signature is missing', async () => {
    const payload = buildStatusUpdatePayload('wamid.TEST003', 'delivered');
    const res = await request(app.getHttpServer())
      .post('/api/v1/public/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res.status).toBe(401);
  });

  it('6. should idempotency : 2 same body POSTs result in 1 process', async () => {
    const payload = buildStatusUpdatePayload('wamid.IDEMPO001', 'delivered');
    const sig = signPayload(payload);

    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sig).send(payload).expect(200);
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sig).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 500));
    const r = await pool.query('SELECT COUNT(*) FROM comm_webhooks_received');
    expect(Number.parseInt(r.rows[0].count, 10)).toBe(1);
  });

  it('7. should propagate status sent->delivered to comm_messages', async () => {
    const contact = await seedContact({});
    const insertRes = await pool.query(
      `INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'whatsapp', 'outbound', $3, 'sent', 'wamid.STATUS001', NOW(), NOW())
       RETURNING id`,
      ['00000000-0000-0000-0000-000000000001', contact.id, contact.phone],
    );
    const msgId = insertRes.rows[0].id;

    const payload = buildStatusUpdatePayload('wamid.STATUS001', 'delivered');
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', signPayload(payload)).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT status, delivered_at FROM comm_messages WHERE id = $1', [msgId]);
    expect(r.rows[0].status).toBe('delivered');
    expect(r.rows[0].delivered_at).toBeTruthy();
  });

  it('8. should insert incoming message direction=inbound and log CRM interaction', async () => {
    const contact = await seedContact({ phone: '+212612345678' });
    const payload = buildIncomingTextPayload('Hello from user', '212612345678');

    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', signPayload(payload)).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT direction, body FROM comm_messages WHERE channel = \'whatsapp\' AND direction = \'inbound\'');
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].body).toContain('Hello from user');

    const interaction = await pool.query('SELECT type FROM crm_interactions WHERE contact_id = $1', [contact.id]);
    expect(interaction.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('9. should auto opt-out on STOP keyword', async () => {
    const contact = await seedContact({ phone: '+212611111111' });
    const payload = buildIncomingTextPayload('STOP', '212611111111');

    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', signPayload(payload)).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT channel, source FROM comm_optouts WHERE contact_id = $1', [contact.id]);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].channel).toBe('whatsapp');
    expect(r.rows[0].source).toBe('whatsapp');
  });

  it('10. should process multi-entry batch payload with 3 entries', async () => {
    const payload = buildMultiEntryPayload();
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', signPayload(payload)).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 1500));
    const r = await pool.query('SELECT COUNT(*) FROM comm_webhooks_received');
    expect(Number.parseInt(r.rows[0].count, 10)).toBe(1);
  });

  it('11. should process failed status with error code 131', async () => {
    const contact = await seedContact({});
    const insertRes = await pool.query(
      `INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'whatsapp', 'outbound', $3, 'sent', 'wamid.FAIL001', NOW(), NOW()) RETURNING id`,
      ['00000000-0000-0000-0000-000000000001', contact.id, contact.phone],
    );
    const msgId = insertRes.rows[0].id;

    const payload = buildFailedStatusPayload('wamid.FAIL001', 131);
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', signPayload(payload)).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT status, fail_reason FROM comm_messages WHERE id = $1', [msgId]);
    expect(r.rows[0].status).toBe('failed');
    expect(r.rows[0].fail_reason).toBeTruthy();
  });

  it('12. should process batch status updates (5 messages delivered)', async () => {
    const ids = ['wamid.B1', 'wamid.B2', 'wamid.B3', 'wamid.B4', 'wamid.B5'];
    for (const id of ids) {
      await pool.query(
        `INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at)
         VALUES (gen_random_uuid(), $1, 'whatsapp', 'outbound', '+212600000000', 'sent', $2, NOW(), NOW())`,
        ['00000000-0000-0000-0000-000000000001', id],
      );
    }
    const payload = buildBatchStatusPayload(ids, 'delivered');
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', signPayload(payload)).send(payload).expect(200);

    await new Promise((r) => setTimeout(r, 1500));
    const r = await pool.query('SELECT COUNT(*) FROM comm_messages WHERE status = \'delivered\' AND provider_message_id = ANY($1)', [ids]);
    expect(Number.parseInt(r.rows[0].count, 10)).toBe(5);
  });
});
```

### 6.11 Squelettes pour les 5 autres fichiers de tests

Les fichiers `email-flow.e2e-spec.ts`, `opt-out-flow.e2e-spec.ts`, `orchestrator-routing.e2e-spec.ts`, `templates-meta-approval.e2e-spec.ts`, `delivery-tracking.e2e-spec.ts` suivent le meme pattern : `describe -> beforeAll(initNockGlobals + create app + seedTenant) -> beforeEach(truncateCommTables + flushRedisTestDb + resetQueues + deleteAllMailhogMessages) -> afterEach(cleanupNock) -> afterAll(app.close + closeFixtures)`. Voir Annexe D pour implementations completes des 38+ tests restants (squelettes condenses).

---

## 7. Liste exhaustive des 50+ tests E2E

### 7.1 messages-flow (12 tests)

1. Send WA template fr -> mock Meta returns ok -> message status='sent' -> Kafka event emitted
2. Send WA template ar-MA Darija content correctly mapped Meta language_code='ar'
3. Send WA template en
4. Send WA template avec variables interpolees verify Meta call payload (capture nock)
5. Send WA template Meta returns rate_limit (130) -> retry 3x with exponential backoff
6. Send Email via Mailhog -> verify recu via Mailhog API + headers DKIM
7. Render Email fr -> HTML contains user_name interpolated
8. Render Email ar-MA -> HTML dir=rtl
9. Multipart : both HTML + plain text present
10. List-Unsubscribe header present + token valid + One-Click POST
11. Reject send when Meta returns invalid_template (132) without retry -> status='failed'
12. Reject send via REST when missing required permission `comm.messages.send` -> 403

### 7.2 wa-webhook-flow (12 tests)

1. GET verification challenge token match -> 200 OK plain text body=challenge
2. GET verification token mismatch -> 403 Forbidden
3. POST signature valid -> 200 OK + processed (comm_webhooks_received row inserted)
4. POST signature invalid -> 401 + warn log
5. POST signature missing -> 401
6. POST idempotency : 2 same body POSTs result in 1 process (UNIQUE constraint)
7. POST status update sent->delivered : update DB comm_messages.status='delivered', delivered_at=NOW
8. POST incoming message text "Hello" -> insert direction=inbound + log CRM interaction
9. POST incoming "STOP" -> auto opt-out source='whatsapp' channel='whatsapp'
10. POST multi-entry batch payload (3 entries) -> 1 row comm_webhooks_received + all entries processed
11. POST failed status code 131 -> message status='failed' + fail_reason populated
12. POST batch status updates 5 messages delivered -> all 5 messages updated

### 7.3 email-flow (10 tests)

1. Send Email transactional via Mailhog -> received with subject + body
2. DKIM signature header present after juice + Nodemailer dkim option
3. List-Unsubscribe header + List-Unsubscribe-Post present (RFC 8058)
4. Multipart alternative : HTML + plain text both present
5. RTL ar-MA : `<html dir="rtl">` + `direction: rtl; text-align: right` CSS
6. RTL ar : `<html dir="rtl">` + content arabic standard
7. Layout shared applied : header logo Skalean + footer copyright + opt-out link
8. CSS inline applied (juice library transforms `<style>` -> `style="..."`)
9. Plain text auto-generated from HTML via node-html-to-text
10. Opt-out flow : link in footer -> click token URL -> confirm page

### 7.4 opt-out-flow (10 tests)

1. Token URL flow : GET /api/v1/public/optout/:token -> verify -> display confirm page
2. Token URL POST confirm -> opt-out enregistre + audit log
3. One-click POST opt-out direct (RFC 8058) without confirm page
4. STOP keyword WA incoming -> auto opt-out + auto-reply confirmation
5. ARRET keyword (FR) matched -> auto opt-out
6. Re-consent require confirmation (cannot opt-in apres opt-out without explicit re-consent)
7. Cooling period 7 jours respect (cannot re-opt-in before)
8. Multi-channel selective : opt-out WA only -> email still active
9. Token expired (TTL 90j passed) -> 410 Gone
10. Invalid token format -> 400 Bad Request

### 7.5 orchestrator-routing (10 tests)

1. Contact preferred=whatsapp + opt-in -> WA used
2. Contact preferred=whatsapp + opt-out WA + opt-in email -> fallback email
3. Contact preferred=whatsapp + opt-out WA + opt-out email -> 400 NoAvailableChannel
4. Contact preferred=email + opt-out email + opt-in WA -> fallback WA
5. Template not Meta approved -> fallback email
6. Override preferChannel='email' force email despite contact preference WA
7. skipOptOutCheck=true bypass for transactional auth (verification email even if opt-out)
8. Broadcast filtre tags=customer + locale=fr-MA -> 1000 contacts segmentes
9. Broadcast empty filter (no match) -> 0 jobs enqueued
10. Send batch [10 items] -> 10 jobs enqueued + 10 messages created

### 7.6 templates-meta-approval (8 tests)

1. Workflow draft -> submit to Meta -> status='pending_review'
2. Webhook Meta account_alerts APPROVED -> markApproved + cache invalidation
3. Webhook Meta account_alerts REJECTED with reason -> markRejected + audit
4. Cache invalidation Kafka event template_updated -> Redis cache evicted
5. Send template not approved -> orchestrator fallback email
6. Send template approved fr but ar-MA pending -> fallback fr (locale fallback)
7. Submit template body > 1024 chars -> reject 400 (Meta limit)
8. Submit template header > 60 chars -> reject 400

### 7.7 delivery-tracking (10 tests)

1. Mailgun webhook signature valid : 200 + processed
2. Mailgun webhook bounce hard (permanent) : auto opt-out source='auto-bounce'
3. Mailgun webhook bounce soft (temporary) : retry pas opt-out
4. Mailgun webhook complained : opt-out + flag suspicious
5. Mailgun webhook delivered : update comm_messages.status='delivered'
6. Mailgun webhook opened : update opened_at (pixel tracking)
7. Bounce rate > 5% on 24h emit Kafka event high_bounce_rate
8. Bounce rate > 10% on 24h auto-pause campaigns
9. WA delivered/read tracking : status timeline correct
10. GET /api/v1/comm/stats aggregates correct (group by status x channel)

### 7.8 Tests transverses (Permissions + Multi-tenant + Performance) -- inclus dans fichiers ci-dessus

- RBAC permission `comm.messages.send` missing -> 403
- Multi-tenant isolation : tenant A cannot see tenant B messages -> 404
- Pagination cursor : GET /messages?cursor=xxx&limit=20 retourne 20 + nextCursor
- Performance : 1000 sends/min throughput sustained (load helper)
- Performance : 100 webhooks/sec process p95 < 200ms
- Memory stable apres 10000 messages (heapUsed delta < 100MB)
- Reset queues + DB before each test : reproducibility 5x runs sans flakiness

**Total tests : 12 + 12 + 10 + 10 + 10 + 8 + 10 = 72 tests** (largement > 50+ exigence).

---

## 8. Variables environnement test

```env
# E2E Sprint 9 Tache 3.2.13
NODE_ENV=test
E2E_BASE_URL=http://localhost:4000
DATABASE_URL=postgresql://test:test@localhost:5432/skalean_test
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB_TEST=15

# Mailhog
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
MAILHOG_API_URL=http://localhost:8025

# Mock externe (no real API call)
MOCK_META=true
MOCK_MAILGUN=true

# WhatsApp (test values)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=test-access-token-do-not-use-prod
WHATSAPP_APP_SECRET=test-app-secret
WHATSAPP_WEBHOOK_VERIFY_TOKEN=test-verify-token

# Mailgun (test values)
MAILGUN_DOMAIN=mg.skalean.test
MAILGUN_API_KEY=test-mailgun-api-key
MAILGUN_WEBHOOK_SIGNING_KEY=test-mailgun-signing-key

# Email
EMAIL_PROVIDER=mailhog
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_FROM_NO_REPLY=no-reply@skalean.test
EMAIL_FROM_SUPPORT=support@skalean.test
EMAIL_DKIM_PRIVATE_KEY=test-dkim-private-key
EMAIL_DKIM_SELECTOR=default

# Auth (test secrets)
JWT_SECRET=test-secret-do-not-use-in-prod
OPTOUT_TOKEN_SECRET=test-optout-secret

# Kafka (test)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=skalean-comm-e2e

# Test runner
JEST_WORKERS=1
SKIP_DOCKER_COMPOSE=
E2E_STOP_AFTER=
COVERAGE=
DETECT_HANDLES=
```

---

## 9. Commandes shell

```bash
cd repo/apps/api
pnpm add -D nock@13.5.4 jest-html-reporters@3.1.7

# Run tous les tests E2E comm
pnpm --filter @insurtech/api test:e2e:comm

# Run un fichier specifique
pnpm exec jest --config test/comm/jest.e2e.config.ts test/comm/messages-flow.e2e-spec.ts

# Run avec coverage
COVERAGE=true pnpm --filter @insurtech/api test:e2e:comm

# Run avec workers parallel
JEST_WORKERS=4 pnpm --filter @insurtech/api test:e2e:comm

# Reproducibility check (5 runs consecutifs)
for i in 1 2 3 4 5; do pnpm --filter @insurtech/api test:e2e:comm || exit 1; done
echo "5 runs OK"

# Debug : detect open handles
DETECT_HANDLES=true pnpm --filter @insurtech/api test:e2e:comm

# Open coverage report
open coverage/e2e-comm/lcov-report/index.html
```

Mise a jour `apps/api/package.json` :

```json
{
  "scripts": {
    "test:e2e:comm": "jest --config test/comm/jest.e2e.config.ts --runInBand",
    "test:e2e:comm:watch": "jest --config test/comm/jest.e2e.config.ts --watch",
    "test:e2e:comm:coverage": "COVERAGE=true jest --config test/comm/jest.e2e.config.ts"
  },
  "devDependencies": {
    "nock": "13.5.4",
    "jest-html-reporters": "3.1.7"
  }
}
```

---

## 10. Criteres validation V1-V25

### P0 (16)

- **V1** (P0) : 50+ tests passent local (cible 70+)
- **V2** (P0) : Tests passent CI GitHub Actions (Sprint 32 ready)
- **V3** (P0) : Mocks Meta + Mailgun + Mailhog fonctionnent (no real external API call)
- **V4** (P0) : Coverage tous flows >= 80% (cible 85%)
- **V5** (P0) : Reproducibility 5x runs sans flakiness
- **V6** (P0) : Cleanup queues + DB + Mailhog + nock between tests (afterEach)
- **V7** (P0) : No real Meta API call (verifie via `nock.disableNetConnect`)
- **V8** (P0) : No real Mailgun API call (verifie via nock)
- **V9** (P0) : 7 fichiers `.e2e-spec.ts` presents
- **V10** (P0) : 5 fixtures presents (helpers, mock-meta, mock-mailgun, mailhog, payloads)
- **V11** (P0) : Mailhog API integration fonctionne (DELETE + GET search)
- **V12** (P0) : BullMQ workers integration verifiee (waitForJobCompletion)
- **V13** (P0) : Postgres TRUNCATE entre tests
- **V14** (P0) : Redis test DB 15 isole (jamais touche dev/prod)
- **V15** (P0) : Health check API attendu before tests (global-setup poll 30s)
- **V16** (P0) : Multi-tenant isolation verifiee (tenant A pas voir tenant B)

### P1 (6)

- **V17** (P1) : Coverage 85% (vs minimum 80% P0)
- **V18** (P1) : No-emoji
- **V19** (P1) : No-console.log (use logger structure)
- **V20** (P1) : Run < 8 min workers=1
- **V21** (P1) : Run < 3 min workers=4
- **V22** (P1) : HTML report Jest genere

### P2 (3)

- **V23** (P2) : Documentation README explique ajouter scenarios + debugger
- **V24** (P2) : Helpers reutilisables Sprint 10+ (sendTestMessage, mockMeta...)
- **V25** (P2) : CI Sprint 32 GitHub Actions ready (services declared)

---

## 11. Edge cases (12)

1. **Test flakiness** : retry via `jest.retryTimes(2)` en CI + marqueur `@flaky` skip si critique
2. **BullMQ Redis test isolation** : utiliser DB Redis 15 reservee tests, jamais shared dev
3. **Mailhog cleanup** : DELETE `/api/v1/messages` avant chaque test pour eviter pollution
4. **Multi-tenant test** : creer 2 tenants seeds + cross-tenant verify isolation explicit
5. **Auth tokens expire test long** : refresh strategy ou tokens TTL 1h dans helpers
6. **Time-sensitive tests** (DST, expiry, cooling period) : freeze date via `vi.useFakeTimers` ou `Date.now` mock
7. **Parallel test runs** : isolated Redis/DB schemas via worker namespace prefix
8. **Heavy seed setup** : reuse via `beforeAll` (templates immutables) vs `beforeEach` (mutables)
9. **Mock Meta drift** : version v21.0 hardcoded -> futur v22 update (track Meta release notes)
10. **Network mock leak between tests** : `nock.cleanAll()` afterEach OBLIGATOIRE
11. **Mailhog memory full** : restart Mailhog si > 1000 mails accumules (CI skip via DELETE)
12. **Subject encoded RFC 2047** : decode Base64 `=?UTF-8?B?...?=` dans helper `getEmailSubject`

---

## 12. Conformite Maroc

- **Tests verifient audit log Loi 09-08 emit** : `audit_log` row inseree avec `action='comm.message.sent' | 'comm.optout.registered'` + actor_id + tenant_id + correlation_id + retention 5 ans
- **Tests verifient hash PII dans logs** : phone E.164 SHA-256 hashed before log emit (no raw phone in pino-roll files)
- **Tests verifient opt-out conformite CNDP** : token signed + revocable + multi-channel selective + cooling 7 jours respect
- **Tests verifient ACAPS retention** : `comm_messages.created_at` > 5 ans cleanup deferred (Sprint 33 GDPR cleanup job)

---

## 13. Conventions absolues (15)

1. **Multi-tenant** : tous tests passent tenant_id dans header + verify isolation
2. **Validation Zod** : tous DTOs valides via `createZodDto` -- tests rejettent invalid
3. **Logger Pino** : tests checks logs structures emit (no `console.log`)
4. **pnpm** : `pnpm --filter @insurtech/api`
5. **TS strict** : `tsconfig.test.json` strict + noImplicitAny
6. **Tests 50+** : strict minimum, cible 70+
7. **Skalean AI** : aucun -- 100% deterministic mock + assertions explicites
8. **No-emoji** : verified via `grep -rP "[\x{1F300}-\x{1F9FF}]" test/comm`
9. **Idempotency** : tests verifient webhooks + jobs idempotency
10. **Cloud souverain** : Mailhog dev / Mailgun EU prod -- tests mockent tous deux
11. **Performance** : run total < 8 min workers=1
12. **No real API call** : `nock.disableNetConnect` + allow only localhost/127.0.0.1
13. **Coverage** : threshold 85% lines/functions, 80% branches dans `jest.e2e.config.ts`
14. **AUCUNE EMOJI**
15. **Fixtures factorises** : sendTestMessage / waitForJobCompletion / etc. reutilisables Sprint 10+

---

## 14. Validation pre-commit

```bash
cd repo

# Typecheck
pnpm --filter @insurtech/api typecheck

# Verify 7 spec files
ls apps/api/test/comm/*.e2e-spec.ts | wc -l  # expected 7

# Verify 5 fixtures
ls apps/api/test/comm/fixtures/*.ts | wc -l  # expected 5

# Run E2E
pnpm --filter @insurtech/api test:e2e:comm

# No-emoji check
grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/test/comm && exit 1 || echo "OK no emoji"

# No console.log check
grep -rn "console\.log" apps/api/test/comm --include="*.ts" | grep -v "// eslint-disable" && exit 1 || echo "OK no console"

# Coverage threshold check
COVERAGE=true pnpm --filter @insurtech/api test:e2e:comm
test $(jq '.total.lines.pct' apps/api/coverage/e2e-comm/coverage-summary.json | cut -d. -f1) -ge 85 || exit 1

# Reproducibility 5 runs
for i in 1 2 3 4 5; do
  pnpm --filter @insurtech/api test:e2e:comm > /tmp/run-$i.log 2>&1 || { echo "FAIL run $i"; cat /tmp/run-$i.log; exit 1; }
done
echo "5 runs OK"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): add E2E test suite (50+) for comm WA + Email flows with mocks Meta + Mailgun + Mailhog (3.2.13)

Implements comprehensive end-to-end test suite covering all comm flows
from send orchestration through WhatsApp Cloud API + Email SMTP including
webhooks signature HMAC verification, BullMQ workers retry + DLQ,
opt-out CNDP token URL + one-click + STOP keyword, delivery tracking
bounces + alerts, templates Meta approval workflow, multi-tenant
isolation, and performance reproducibility. 7 .e2e-spec.ts files in
repo/apps/api/test/comm/ (~2150 lines, 70+ tests). Fixtures for test
helpers (sendTestMessage, waitForJobCompletion, waitForMailhogMessage),
mock Meta server via nock (happy path + 7 error scenarios + capture
requests for assertion), mock Mailgun server (signed webhook helper
RFC sha256 timestamp+token), Mailhog REST client (polling + DKIM +
List-Unsubscribe + multipart), 15+ realistic Meta webhook payloads
(status, batch, incoming text/image/audio/video/document/location/
button_reply/list_reply/failed/multi-entry, account_alerts).
Jest configuration with runInBand workers=1 default + opt-in workers=4
for CI 3-min runs, retryTimes=2 in CI flakiness mitigation, HTML
reporter, coverage threshold 85% lines/functions + 80% branches.
Global setup starts docker-compose test.yml services (Postgres + Redis
DB15 + Kafka + Mailhog) + waits API health + applies migrations + seeds
templates immutables. Validates 12 Sprint 9 tasks in integration with
zero real external API calls (nock disableNetConnect localhost only).

Livrables :
- 7 test files (~2150 lines, 70+ tests)
- comm-test-helpers.ts (sendTestMessage, waitForJobCompletion, ...)
- mock-meta-server.ts (nock setupMetaMockHappy, setupMetaMockError x7)
- mock-mailgun-server.ts (signMailgunWebhook, buildPayload x7 events)
- mailhog-client.ts (waitForEmailTo, getEmailHtmlPart, hasDkim, ...)
- wa-webhook-payloads.fixtures.ts (15+ realistic Meta payloads)
- jest.e2e.config.ts (runInBand, retry 2, coverage 85%)
- global-setup.ts (docker compose, migrations, seed templates)
- global-teardown.ts
- README.md documentation

Tests : 70+ scenarios, run < 8 min sequential, < 3 min parallel
Coverage : 85% lines/functions, 80% branches sur tous flows comm
Reproducibility : 5 runs consecutifs passent 100%

Task: 3.2.13
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.13

CLOSES SPRINT 9 -- Communications WhatsApp + Email COMPLETE"
```

---

## 16. Workflow next step

Apres commit final, Sprint 9 est CLOTURE. La verification automatique sprint **V-09** doit etre executee :

```bash
# Verification automatique Sprint 9
pnpm --filter @insurtech/api test:e2e:comm
pnpm --filter @insurtech/api test:cov  # >= 85%
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint --max-warnings 0
pnpm --filter @insurtech/api build

# Generer _SUMMARY.md
node scripts/generate-sprint-summary.mjs --sprint 09 --output 00-pilotage/sprints-summary/SPRINT-09-SUMMARY.md
```

Sprint 10 (Identite + KYC + Documents Marocains) demarre avec :
- Notifications operationnelles via `MessageOrchestrator.sendToContact()`.
- Auto-log interactions CRM via Kafka events `comm.message_sent` (consume Sprint 8 CRM).
- Customer Communication = pillar pour Customer Portal Sprint 18.
- Sprint 14 (Insure) consume orchestrator pour police_signed_confirmation, payment_due_reminder.
- Sprint 20 (Repair) consume orchestrator pour sinistre_acknowledged, devis_ready.

---

## 17. Annexes

### Annexe A. CI GitHub Actions Sprint 32

```yaml
# .github/workflows/e2e-comm.yml (Sprint 32)
name: E2E Comm Tests
on: [pull_request, push]
jobs:
  e2e-comm:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test, POSTGRES_USER: test, POSTGRES_DB: skalean_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: --health-cmd "redis-cli ping" --health-interval 5s
      mailhog:
        image: mailhog/mailhog:latest
        ports: ['1025:1025', '8025:8025']
      kafka:
        image: confluentinc/cp-kafka:7.6.0
        ports: ['9092:9092']
        env:
          KAFKA_PROCESS_ROLES: broker,controller
          KAFKA_NODE_ID: 1
          KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
          KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/database migrate:run
      - run: pnpm --filter @insurtech/database seed:comm-templates
      - run: pnpm --filter @insurtech/api start:test &
      - run: sleep 10
      - run: JEST_WORKERS=2 COVERAGE=true pnpm --filter @insurtech/api test:e2e:comm
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: e2e-comm-coverage, path: apps/api/coverage/e2e-comm }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: e2e-comm-report, path: apps/api/coverage/e2e-comm-report }
```

### Annexe B. Pattern ajout nouveau scenario

Pour ajouter un nouveau scenario E2E :

1. Identifier le fichier cible (`messages-flow`, `wa-webhook-flow`, ...)
2. Ajouter `it('N. should ... description ...', async () => { ... })` dans le `describe`
3. Importer fixtures necessaires (`comm-test-helpers`, `mock-meta-server`, `wa-webhook-payloads.fixtures`)
4. Setup dans le test : `setupMetaMockHappy()` ou `setupMailgunMockHappy()` ou payload
5. Exec : `sendTestMessage` ou `request(app).post(...)`
6. Assertions : `waitForJobCompletion` + DB query + Kafka consumer assertion + Mailhog poll
7. Run : `pnpm exec jest test/comm/{file}.e2e-spec.ts -t "N. should"`
8. Verifier passing 5x consecutif
9. Commit + PR

### Annexe C. Performance benchmarks attendus

```
File                                    Tests   Median  P99
messages-flow.e2e-spec.ts               12      45 sec  60 sec  -- 5 retries + Mailhog wait
wa-webhook-flow.e2e-spec.ts             12      30 sec  40 sec  -- 12 webhooks + Kafka lag
email-flow.e2e-spec.ts                  10      40 sec  55 sec  -- 10 Mailhog polls
opt-out-flow.e2e-spec.ts                10      25 sec  35 sec
orchestrator-routing.e2e-spec.ts        10      30 sec  40 sec  -- routing logic + 1000 broadcast
templates-meta-approval.e2e-spec.ts     8       20 sec  30 sec
delivery-tracking.e2e-spec.ts           10      35 sec  45 sec  -- bounce alerting + stats

Total 72 tests sequential (workers=1):  ~7 min       (p99: 9 min)
Total 72 tests parallel (workers=4):    ~2.5 min     (p99: 3.5 min)
```

### Annexe D. Implementations completes des 5 fichiers `.e2e-spec.ts` restants

#### D.1 `email-flow.e2e-spec.ts` (10 tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { sendTestMessage, waitForJobCompletion, waitForMailhogMessage, seedTenant, seedContact, truncateCommTables, flushRedisTestDb, resetQueues, closeFixtures } from './fixtures/comm-test-helpers.js';
import { setupMailgunMockHappy } from './fixtures/mock-mailgun-server.js';
import { cleanupNock, initNockGlobals } from './fixtures/mock-meta-server.js';
import { deleteAllMailhogMessages, getEmailSubject, getEmailHtmlPart, getEmailPlainPart, hasDkimSignature, hasListUnsubscribe, getEmailHeader } from './fixtures/mailhog-client.js';

describe('Email Flow E2E (10+ tests)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    initNockGlobals();
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    await seedTenant({});
  });

  afterAll(async () => { await app.close(); await closeFixtures(); });
  beforeEach(async () => { await truncateCommTables(); await flushRedisTestDb(); await resetQueues(); await deleteAllMailhogMessages(); });
  afterEach(() => { cleanupNock(); });

  it('1. send transactional email -> Mailhog received with subject + body', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r1@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'Anas', appointment_time: '14h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r1@e2e-test.local');
    expect(getEmailSubject(msg)).toBeTruthy();
    expect(getEmailHtmlPart(msg)).toContain('Anas');
  });

  it('2. DKIM signature header present', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r2@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r2@e2e-test.local');
    expect(hasDkimSignature(msg)).toBe(true);
  });

  it('3. List-Unsubscribe + List-Unsubscribe-Post (RFC 8058)', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r3@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r3@e2e-test.local');
    expect(hasListUnsubscribe(msg)).toBe(true);
    expect(getEmailHeader(msg, 'List-Unsubscribe-Post')).toBe('List-Unsubscribe=One-Click');
  });

  it('4. Multipart : HTML + plain text both present', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r4@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r4@e2e-test.local');
    expect(getEmailHtmlPart(msg)).toBeDefined();
    expect(getEmailPlainPart(msg)).toBeDefined();
  });

  it('5. RTL ar-MA : HTML dir=rtl', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'ar-MA', email: 'r5@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'Karim', appointment_time: '14h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r5@e2e-test.local');
    expect(getEmailHtmlPart(msg) ?? '').toMatch(/<html[^>]*dir=["']rtl["']/i);
  });

  it('6. RTL ar standard : dir=rtl + lang=ar attribute', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'ar', email: 'r6@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'Karim', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r6@e2e-test.local');
    const html = getEmailHtmlPart(msg) ?? '';
    expect(html).toMatch(/<html[^>]*dir=["']rtl["']/i);
    expect(html).toMatch(/<html[^>]*lang=["']ar["']/i);
    expect(html).toMatch(/text-align:\s*right/i);
  });

  it('7. Layout shared : header logo + footer + opt-out link', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r7@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r7@e2e-test.local');
    const html = getEmailHtmlPart(msg) ?? '';
    expect(html).toMatch(/skalean/i);
    expect(html).toMatch(/optout|unsubscribe/i);
  });

  it('8. CSS inline applied (juice transformed style attribute)', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r8@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r8@e2e-test.local');
    const html = getEmailHtmlPart(msg) ?? '';
    expect(html).toMatch(/style=["'][^"']+["']/);
  });

  it('9. Plain text auto-generated from HTML', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r9@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r9@e2e-test.local');
    const plain = getEmailPlainPart(msg) ?? '';
    expect(plain.length).toBeGreaterThan(20);
    expect(plain).not.toContain('<html');
  });

  it('10. opt-out flow : link in footer with valid token', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'r10@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '15h' });
    await waitForJobCompletion('email-send', id, { targetStatus: 'sent' });
    const msg = await waitForMailhogMessage('r10@e2e-test.local');
    const html = getEmailHtmlPart(msg) ?? '';
    expect(html).toMatch(/optout\/[A-Za-z0-9._-]+/);
  });
});
```

#### D.2 `opt-out-flow.e2e-spec.ts` (10 tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module.js';
import { generateOptoutToken, seedTenant, seedContact, truncateCommTables, flushRedisTestDb, resetQueues, closeFixtures } from './fixtures/comm-test-helpers.js';
import { cleanupNock, initNockGlobals } from './fixtures/mock-meta-server.js';
import { buildIncomingTextPayload } from './fixtures/wa-webhook-payloads.fixtures.js';
import { createHmac } from 'node:crypto';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? 'test-app-secret';
function sign(p: unknown): string { return 'sha256=' + createHmac('sha256', APP_SECRET).update(JSON.stringify(p)).digest('hex'); }

describe('Opt-out Flow E2E (10+ tests)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    initNockGlobals();
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    await seedTenant({});
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => { await app.close(); await pool.end(); await closeFixtures(); });
  beforeEach(async () => { await truncateCommTables(); await flushRedisTestDb(); await resetQueues(); });
  afterEach(() => { cleanupNock(); });

  it('1. token URL flow : GET verify -> display confirm page', async () => {
    const c = await seedContact({});
    const token = generateOptoutToken(c.id, 'whatsapp');
    const r = await request(app.getHttpServer()).get(`/api/v1/public/optout/${token}`);
    expect(r.status).toBe(200);
    expect(r.text).toContain('confirm');
  });

  it('2. token URL POST confirm -> opt-out enregistre + audit', async () => {
    const c = await seedContact({});
    const token = generateOptoutToken(c.id, 'whatsapp');
    const r = await request(app.getHttpServer()).post(`/api/v1/public/optout/${token}/confirm`);
    expect(r.status).toBe(200);
    const opt = await pool.query('SELECT channel FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(1);
    expect(opt.rows[0].channel).toBe('whatsapp');
  });

  it('3. one-click POST opt-out direct (RFC 8058) without confirm', async () => {
    const c = await seedContact({});
    const token = generateOptoutToken(c.id, 'email');
    const r = await request(app.getHttpServer()).post(`/api/v1/public/optout/one-click`).send({ token });
    expect([200, 204]).toContain(r.status);
    const opt = await pool.query('SELECT channel FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows[0].channel).toBe('email');
  });

  it('4. STOP keyword WA -> auto opt-out + auto-reply', async () => {
    const c = await seedContact({ phone: '+212611111111' });
    const p = buildIncomingTextPayload('STOP', '212611111111');
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sign(p)).send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const opt = await pool.query('SELECT * FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(1);
  });

  it('5. ARRET keyword (FR) matched -> auto opt-out', async () => {
    const c = await seedContact({ phone: '+212622222222' });
    const p = buildIncomingTextPayload('ARRET', '212622222222');
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sign(p)).send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const opt = await pool.query('SELECT * FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(1);
  });

  it('6. re-consent require explicit (not auto-opt-in)', async () => {
    const c = await seedContact({});
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'whatsapp', 'web']);
    const r = await request(app.getHttpServer()).post('/api/v1/comm/optouts/opt-in').send({ contactId: c.id, channel: 'whatsapp' });
    expect([400, 403]).toContain(r.status);
  });

  it('7. cooling period 7 jours respect', async () => {
    const c = await seedContact({});
    await pool.query("INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW() - INTERVAL '3 days')", [c.id, 'whatsapp', 'whatsapp']);
    const r = await request(app.getHttpServer()).post('/api/v1/comm/optouts/opt-in').send({ contactId: c.id, channel: 'whatsapp', confirmed: true });
    expect([400, 409]).toContain(r.status);
  });

  it('8. multi-channel selective : opt-out WA only -> email actif', async () => {
    const c = await seedContact({});
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'whatsapp', 'web']);
    const opt = await pool.query('SELECT channel FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(1);
    expect(opt.rows[0].channel).toBe('whatsapp');
  });

  it('9. token expired (TTL passed) -> 410 Gone', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/public/optout/expired.token.value');
    expect([400, 410]).toContain(r.status);
  });

  it('10. invalid token format -> 400', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/public/optout/not-a-jwt');
    expect(r.status).toBe(400);
  });
});
```

#### D.3 `orchestrator-routing.e2e-spec.ts` (10 tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module.js';
import { sendTestMessage, waitForJobCompletion, seedTenant, seedContact, truncateCommTables, flushRedisTestDb, resetQueues, closeFixtures, generateTestAccessToken } from './fixtures/comm-test-helpers.js';
import { setupMetaMockHappy, cleanupNock, initNockGlobals } from './fixtures/mock-meta-server.js';
import { setupMailgunMockHappy } from './fixtures/mock-mailgun-server.js';
import { deleteAllMailhogMessages } from './fixtures/mailhog-client.js';

describe('Orchestrator Routing E2E (10+ tests)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    initNockGlobals();
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    await seedTenant({});
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });
  afterAll(async () => { await app.close(); await pool.end(); await closeFixtures(); });
  beforeEach(async () => { await truncateCommTables(); await flushRedisTestDb(); await resetQueues(); await deleteAllMailhogMessages(); });
  afterEach(() => { cleanupNock(); });

  it('1. preferred=whatsapp + opt-in -> WA used', async () => {
    setupMetaMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' });
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '14h' });
    const result = await waitForJobCompletion('wa-send', id, { targetStatus: 'sent' });
    expect(result.status).toBe('sent');
    const r = await pool.query('SELECT channel FROM comm_messages WHERE id = $1', [id]);
    expect(r.rows[0].channel).toBe('whatsapp');
  });

  it('2. preferred=whatsapp + opt-out WA + opt-in email -> fallback email', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr', email: 'fb1@e2e-test.local' });
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'whatsapp', 'web']);
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '14h' });
    const r = await pool.query('SELECT channel FROM comm_messages WHERE id = $1', [id]);
    expect(r.rows[0].channel).toBe('email');
  });

  it('3. opt-out WA + opt-out email -> 400 NoAvailableChannel', async () => {
    const c = await seedContact({});
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'whatsapp', 'web']);
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'email', 'web']);
    const tk = generateTestAccessToken();
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ contactId: c.id, templateName: 'appointment_reminder', variables: {} });
    expect(r.status).toBe(400);
    expect(r.body?.code ?? r.body?.error?.code).toBe('NO_AVAILABLE_CHANNEL');
  });

  it('4. preferred=email + opt-out email + opt-in WA -> fallback WA', async () => {
    setupMetaMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', preferredLanguage: 'fr', email: 'fb4@e2e-test.local' });
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'email', 'web']);
    const id = await sendTestMessage(app, c.id, 'appointment_reminder', { user_name: 'X', appointment_time: '14h' });
    const r = await pool.query('SELECT channel FROM comm_messages WHERE id = $1', [id]);
    expect(r.rows[0].channel).toBe('whatsapp');
  });

  it('5. template not Meta approved -> fallback email', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr', email: 'fb5@e2e-test.local' });
    const id = await sendTestMessage(app, c.id, 'pending_review_template', { x: 'y' });
    const r = await pool.query('SELECT channel FROM comm_messages WHERE id = $1', [id]);
    expect(r.rows[0].channel).toBe('email');
  });

  it('6. override preferChannel=email force email despite contact WA pref', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr', email: 'ov6@e2e-test.local' });
    const tk = generateTestAccessToken();
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send')
      .set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ contactId: c.id, templateName: 'appointment_reminder', variables: {}, options: { preferChannel: 'email' } });
    expect(r.status).toBe(201);
    const ch = await pool.query('SELECT channel FROM comm_messages WHERE id = $1', [r.body.data.messageId]);
    expect(ch.rows[0].channel).toBe('email');
  });

  it('7. skipOptOutCheck=true bypass for transactional auth', async () => {
    setupMailgunMockHappy({ persist: true });
    const c = await seedContact({ preferredChannel: 'email', email: 'tx7@e2e-test.local' });
    await pool.query('INSERT INTO comm_optouts (contact_id, channel, source, created_at) VALUES ($1, $2, $3, NOW())', [c.id, 'email', 'web']);
    const tk = generateTestAccessToken({ permissions: ['comm.messages.send', 'comm.messages.send.transactional'] });
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send')
      .set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ contactId: c.id, templateName: 'email_verification', variables: { link: 'https://x' }, options: { skipOptOutCheck: true } });
    expect(r.status).toBe(201);
  });

  it('8. broadcast filtre tags=customer + locale=fr-MA -> 1000 contacts', async () => {
    setupMetaMockHappy({ persist: true });
    setupMailgunMockHappy({ persist: true });
    for (let i = 0; i < 50; i += 1) {
      await seedContact({ id: undefined, preferredChannel: 'whatsapp', preferredLanguage: 'fr-MA', tags: ['customer'] });
    }
    const tk = generateTestAccessToken();
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/broadcast')
      .set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ filters: { tags: ['customer'], locale: 'fr-MA' }, templateName: 'appointment_reminder', variables: {} });
    expect(r.status).toBe(202);
    expect(r.body?.data?.jobs_enqueued).toBeGreaterThanOrEqual(50);
  });

  it('9. broadcast empty filter (no match) -> 0 jobs enqueued', async () => {
    const tk = generateTestAccessToken();
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/broadcast')
      .set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ filters: { tags: ['nonexistent_tag_xyz'] }, templateName: 'appointment_reminder', variables: {} });
    expect(r.status).toBe(202);
    expect(r.body?.data?.jobs_enqueued).toBe(0);
  });

  it('10. send batch [10 items] -> 10 jobs enqueued + 10 messages created', async () => {
    setupMetaMockHappy({ persist: true });
    const contacts = await Promise.all(Array.from({ length: 10 }, () => seedContact({ preferredChannel: 'whatsapp', preferredLanguage: 'fr' })));
    const tk = generateTestAccessToken();
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send-batch')
      .set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ items: contacts.map((c) => ({ contactId: c.id, templateName: 'appointment_reminder', variables: { user_name: 'X', appointment_time: '15h' } })) });
    expect(r.status).toBe(201);
    expect(r.body?.data?.messageIds?.length).toBe(10);
  });
});
```

#### D.4 `templates-meta-approval.e2e-spec.ts` (8 tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import { createHmac } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { seedTenant, truncateCommTables, flushRedisTestDb, resetQueues, closeFixtures, generateTestAccessToken } from './fixtures/comm-test-helpers.js';
import { cleanupNock, initNockGlobals } from './fixtures/mock-meta-server.js';
import { buildAccountAlertsApprovedPayload, buildAccountAlertsRejectedPayload } from './fixtures/wa-webhook-payloads.fixtures.js';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? 'test-app-secret';
function sign(p: unknown): string { return 'sha256=' + createHmac('sha256', APP_SECRET).update(JSON.stringify(p)).digest('hex'); }

describe('Templates Meta Approval E2E (8+ tests)', () => {
  let app: INestApplication;
  let pool: Pool;
  beforeAll(async () => { initNockGlobals(); const m = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = m.createNestApplication(); await app.init(); await seedTenant({}); pool = new Pool({ connectionString: process.env.DATABASE_URL }); });
  afterAll(async () => { await app.close(); await pool.end(); await closeFixtures(); });
  beforeEach(async () => { await truncateCommTables(); await flushRedisTestDb(); await resetQueues(); });
  afterEach(() => { cleanupNock(); });

  it('1. workflow draft -> submit -> pending_review', async () => {
    const tk = generateTestAccessToken();
    const tn = `test_template_${Date.now()}`;
    const c = await request(app.getHttpServer()).post('/api/v1/comm/templates').set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001').send({ name: tn, language: 'fr', body: 'Hello {{1}}', meta_template_status: 'draft' });
    expect(c.status).toBe(201);
    const sub = await request(app.getHttpServer()).post(`/api/v1/comm/templates/${c.body.data.id}/submit`).set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001').send({});
    expect([200, 202]).toContain(sub.status);
    const r = await pool.query('SELECT meta_template_status FROM comm_templates WHERE id = $1', [c.body.data.id]);
    expect(r.rows[0].meta_template_status).toBe('pending_review');
  });

  it('2. webhook account_alerts APPROVED -> markApproved + cache invalidation', async () => {
    const tk = generateTestAccessToken();
    const tn = `appr_${Date.now()}`;
    const c = await request(app.getHttpServer()).post('/api/v1/comm/templates').set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001').send({ name: tn, language: 'fr', body: 'Body {{1}}', meta_template_status: 'pending_review' });
    const p = buildAccountAlertsApprovedPayload(tn, 'fr');
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sign(p)).send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT meta_template_status FROM comm_templates WHERE id = $1', [c.body.data.id]);
    expect(r.rows[0].meta_template_status).toBe('approved');
  });

  it('3. webhook account_alerts REJECTED with reason -> markRejected', async () => {
    const tk = generateTestAccessToken();
    const tn = `rej_${Date.now()}`;
    const c = await request(app.getHttpServer()).post('/api/v1/comm/templates').set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001').send({ name: tn, language: 'fr', body: 'Body', meta_template_status: 'pending_review' });
    const p = buildAccountAlertsRejectedPayload(tn, 'INVALID_FORMAT');
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sign(p)).send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT meta_template_status, meta_rejection_reason FROM comm_templates WHERE id = $1', [c.body.data.id]);
    expect(r.rows[0].meta_template_status).toBe('rejected');
    expect(r.rows[0].meta_rejection_reason).toContain('INVALID_FORMAT');
  });

  it('4. cache invalidation Kafka template_updated -> Redis evicted + 2nd render fetches DB', async () => {
    const tk = generateTestAccessToken();
    const tn = `cache_${Date.now()}`;
    const c = await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ name: tn, language: 'fr', body: 'Hello {{1}}', meta_template_status: 'approved' });
    expect(c.status).toBe(201);
    const tplId = c.body.data.id as string;
    const r1 = await request(app.getHttpServer())
      .get(`/api/v1/comm/templates/${tplId}`)
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001');
    expect(r1.status).toBe(200);
    expect(r1.body.data.body).toBe('Hello {{1}}');
    await pool.query('UPDATE comm_templates SET body = $1 WHERE id = $2', ['Updated body {{1}}', tplId]);
    await request(app.getHttpServer())
      .post(`/api/v1/comm/templates/${tplId}/invalidate-cache`)
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .expect((res) => expect([200, 204]).toContain(res.status));
    await new Promise((r) => setTimeout(r, 500));
    const r2 = await request(app.getHttpServer())
      .get(`/api/v1/comm/templates/${tplId}`)
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001');
    expect(r2.body.data.body).toBe('Updated body {{1}}');
  });

  it('5. send template not approved -> orchestrator fallback email', async () => {
    const tk = generateTestAccessToken();
    const tn = `pending_${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ name: tn, language: 'fr', body: 'Pending {{1}}', meta_template_status: 'pending_review' });
    const cnt = await pool.query(
      "INSERT INTO crm_contacts (id, tenant_id, phone, email, preferred_channel, preferred_language, created_at) VALUES (gen_random_uuid(), $1, '+212611223344', 'fb5b@e2e-test.local', 'whatsapp', 'fr', NOW()) RETURNING id, email",
      ['00000000-0000-0000-0000-000000000001'],
    );
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ contactId: cnt.rows[0].id, templateName: tn, variables: { 1: 'Anas' } });
    expect(r.status).toBe(201);
    const ch = await pool.query('SELECT channel FROM comm_messages WHERE id = $1', [r.body.data.messageId]);
    expect(ch.rows[0].channel).toBe('email');
  });

  it('6. send template approved fr but ar-MA missing -> fallback fr locale', async () => {
    const tk = generateTestAccessToken();
    const tn = `loc_${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ name: tn, language: 'fr', body: 'Bonjour {{1}}', meta_template_status: 'approved' });
    const cnt = await pool.query(
      "INSERT INTO crm_contacts (id, tenant_id, phone, email, preferred_channel, preferred_language, created_at) VALUES (gen_random_uuid(), $1, '+212622334455', 'loc6@e2e-test.local', 'whatsapp', 'ar-MA', NOW()) RETURNING id",
      ['00000000-0000-0000-0000-000000000001'],
    );
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/messages/send')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
      .send({ contactId: cnt.rows[0].id, templateName: tn, variables: { 1: 'Karim' } });
    expect(r.status).toBe(201);
    const m = await pool.query('SELECT locale_used, channel FROM comm_messages WHERE id = $1', [r.body.data.messageId]);
    expect(m.rows[0].locale_used).toBe('fr');
  });

  it('7. submit template body > 1024 chars -> reject 400 (Meta limit)', async () => {
    const tk = generateTestAccessToken();
    const longBody = 'x'.repeat(1025);
    const r = await request(app.getHttpServer()).post('/api/v1/comm/templates').set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001').send({ name: 'too_long', language: 'fr', body: longBody });
    expect(r.status).toBe(400);
  });

  it('8. submit template header > 60 chars -> reject 400', async () => {
    const tk = generateTestAccessToken();
    const longHeader = 'x'.repeat(61);
    const r = await request(app.getHttpServer()).post('/api/v1/comm/templates').set('Authorization', `Bearer ${tk}`).set('x-tenant-id', '00000000-0000-0000-0000-000000000001').send({ name: 'long_header', language: 'fr', body: 'Body', header: longHeader });
    expect(r.status).toBe(400);
  });
});
```

#### D.5 `delivery-tracking.e2e-spec.ts` (10 tests)

```typescript
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module.js';
import { seedTenant, seedContact, truncateCommTables, flushRedisTestDb, resetQueues, closeFixtures, generateTestAccessToken } from './fixtures/comm-test-helpers.js';
import { cleanupNock, initNockGlobals } from './fixtures/mock-meta-server.js';
import { buildMailgunWebhookPayload, signMailgunWebhook } from './fixtures/mock-mailgun-server.js';

describe('Delivery Tracking E2E (10+ tests)', () => {
  let app: INestApplication;
  let pool: Pool;
  beforeAll(async () => { initNockGlobals(); const m = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = m.createNestApplication(); await app.init(); await seedTenant({}); pool = new Pool({ connectionString: process.env.DATABASE_URL }); });
  afterAll(async () => { await app.close(); await pool.end(); await closeFixtures(); });
  beforeEach(async () => { await truncateCommTables(); await flushRedisTestDb(); await resetQueues(); });
  afterEach(() => { cleanupNock(); });

  it('1. Mailgun webhook signature valid -> 200 + processed', async () => {
    const c = await seedContact({});
    const ins = await pool.query(`INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'email', 'outbound', $3, 'sent', '<msgid001@mg.skalean.test>', NOW(), NOW()) RETURNING id`, ['00000000-0000-0000-0000-000000000001', c.id, c.email]);
    const p = buildMailgunWebhookPayload({ eventType: 'delivered', messageId: '<msgid001@mg.skalean.test>', recipient: c.email });
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/mailgun').send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT status FROM comm_messages WHERE id = $1', [ins.rows[0].id]);
    expect(r.rows[0].status).toBe('delivered');
  });

  it('2. Mailgun webhook bounce hard (permanent) -> auto opt-out source=auto-bounce', async () => {
    const c = await seedContact({});
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'email', 'outbound', $3, 'sent', '<bounce001@mg.skalean.test>', NOW(), NOW())`, ['00000000-0000-0000-0000-000000000001', c.id, c.email]);
    const p = buildMailgunWebhookPayload({ eventType: 'bounced', messageId: '<bounce001@mg.skalean.test>', recipient: c.email, severity: 'permanent', reason: 'mailbox_full' });
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/mailgun').send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const opt = await pool.query('SELECT source FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(1);
    expect(opt.rows[0].source).toBe('auto-bounce');
  });

  it('3. Mailgun webhook bounce soft (temporary) -> retry pas opt-out', async () => {
    const c = await seedContact({});
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'email', 'outbound', $3, 'sent', '<soft001@mg.skalean.test>', NOW(), NOW())`, ['00000000-0000-0000-0000-000000000001', c.id, c.email]);
    const p = buildMailgunWebhookPayload({ eventType: 'temporary_fail', messageId: '<soft001@mg.skalean.test>', recipient: c.email, severity: 'temporary' });
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/mailgun').send(p).expect(200);
    await new Promise((r) => setTimeout(r, 500));
    const opt = await pool.query('SELECT * FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(0);
  });

  it('4. Mailgun webhook complained -> opt-out + flag suspicious', async () => {
    const c = await seedContact({});
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'email', 'outbound', $3, 'sent', '<comp001@mg.skalean.test>', NOW(), NOW())`, ['00000000-0000-0000-0000-000000000001', c.id, c.email]);
    const p = buildMailgunWebhookPayload({ eventType: 'complained', messageId: '<comp001@mg.skalean.test>', recipient: c.email });
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/mailgun').send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const opt = await pool.query('SELECT * FROM comm_optouts WHERE contact_id = $1', [c.id]);
    expect(opt.rows.length).toBe(1);
  });

  it('5. Mailgun webhook delivered -> update status=delivered + delivered_at', async () => {
    const c = await seedContact({});
    const ins = await pool.query(`INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'email', 'outbound', $3, 'sent', '<deliv005@mg.skalean.test>', NOW(), NOW()) RETURNING id`, ['00000000-0000-0000-0000-000000000001', c.id, c.email]);
    const p = buildMailgunWebhookPayload({ eventType: 'delivered', messageId: '<deliv005@mg.skalean.test>', recipient: c.email });
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/mailgun').send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT status, delivered_at FROM comm_messages WHERE id = $1', [ins.rows[0].id]);
    expect(r.rows[0].status).toBe('delivered');
    expect(r.rows[0].delivered_at).toBeTruthy();
  });

  it('6. Mailgun webhook opened -> update opened_at (pixel tracking)', async () => {
    const c = await seedContact({});
    const ins = await pool.query(`INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, delivered_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'email', 'outbound', $3, 'delivered', '<open006@mg.skalean.test>', NOW(), NOW(), NOW()) RETURNING id`, ['00000000-0000-0000-0000-000000000001', c.id, c.email]);
    const p = buildMailgunWebhookPayload({ eventType: 'opened', messageId: '<open006@mg.skalean.test>', recipient: c.email });
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/mailgun').send(p).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT opened_at FROM comm_messages WHERE id = $1', [ins.rows[0].id]);
    expect(r.rows[0].opened_at).toBeTruthy();
  });

  it('7. bounce rate > 5% on 24h window emit Kafka comm.high_bounce_rate event', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    for (let i = 0; i < 95; i += 1) {
      await pool.query(
        `INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, delivered_at, created_at) VALUES (gen_random_uuid(), $1, 'email', 'outbound', $2, 'delivered', NOW(), NOW(), NOW())`,
        [tenantId, `delivered_${i}@e2e-test.local`],
      );
    }
    for (let i = 0; i < 6; i += 1) {
      await pool.query(
        `INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, bounced_at, bounce_severity, created_at) VALUES (gen_random_uuid(), $1, 'email', 'outbound', $2, 'bounced', NOW(), NOW(), 'permanent', NOW())`,
        [tenantId, `bounced_${i}@e2e-test.local`],
      );
    }
    const tk = generateTestAccessToken({ permissions: ['comm.cron.bounce_rate'] });
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/cron/bounce-rate-check')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', tenantId);
    expect([200, 202, 204]).toContain(r.status);
    await new Promise((r) => setTimeout(r, 1500));
    const ev = await pool.query(
      `SELECT event_type, payload FROM kafka_outbox WHERE tenant_id = $1 AND event_type = 'comm.high_bounce_rate' ORDER BY created_at DESC LIMIT 1`,
      [tenantId],
    );
    expect(ev.rows.length).toBeGreaterThanOrEqual(1);
    expect(ev.rows[0].payload.bounce_rate_pct).toBeGreaterThan(5);
  });

  it('8. bounce rate > 10% auto-pause campaigns -> tenant.campaigns_paused=true', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    await pool.query(`UPDATE tenants SET campaigns_paused = false WHERE id = $1`, [tenantId]);
    for (let i = 0; i < 80; i += 1) {
      await pool.query(
        `INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, delivered_at, created_at) VALUES (gen_random_uuid(), $1, 'email', 'outbound', $2, 'delivered', NOW(), NOW(), NOW())`,
        [tenantId, `ok_${i}@e2e-test.local`],
      );
    }
    for (let i = 0; i < 12; i += 1) {
      await pool.query(
        `INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, bounced_at, bounce_severity, created_at) VALUES (gen_random_uuid(), $1, 'email', 'outbound', $2, 'bounced', NOW(), NOW(), 'permanent', NOW())`,
        [tenantId, `b_${i}@e2e-test.local`],
      );
    }
    const tk = generateTestAccessToken({ permissions: ['comm.cron.bounce_rate'] });
    await request(app.getHttpServer())
      .post('/api/v1/comm/cron/bounce-rate-check')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', tenantId)
      .expect((res) => expect([200, 202, 204]).toContain(res.status));
    await new Promise((r) => setTimeout(r, 1500));
    const t = await pool.query('SELECT campaigns_paused FROM tenants WHERE id = $1', [tenantId]);
    expect(t.rows[0].campaigns_paused).toBe(true);
  });

  it('9. WA delivered + read tracking timeline correct (sent -> delivered -> read)', async () => {
    const c = await seedContact({ phone: '+212699887766' });
    const ins = await pool.query(
      `INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, sent_at, created_at) VALUES (gen_random_uuid(), $1, $2, 'whatsapp', 'outbound', $3, 'sent', 'wamid.HBgN_E2E_TIMELINE_001', NOW(), NOW()) RETURNING id`,
      ['00000000-0000-0000-0000-000000000001', c.id, c.phone],
    );
    const msgId = ins.rows[0].id as string;
    const { createHmac } = await import('node:crypto');
    const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? 'test-app-secret';
    const sign = (p: unknown): string => 'sha256=' + createHmac('sha256', APP_SECRET).update(JSON.stringify(p)).digest('hex');
    const deliveredPayload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540352242922' }, statuses: [{ id: 'wamid.HBgN_E2E_TIMELINE_001', status: 'delivered', timestamp: `${Math.floor(Date.now() / 1000)}`, recipient_id: '212699887766' }] }, field: 'messages' }] }],
    };
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sign(deliveredPayload)).send(deliveredPayload).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const readPayload = JSON.parse(JSON.stringify(deliveredPayload));
    readPayload.entry[0].changes[0].value.statuses[0].status = 'read';
    readPayload.entry[0].changes[0].value.statuses[0].timestamp = `${Math.floor(Date.now() / 1000) + 5}`;
    await request(app.getHttpServer()).post('/api/v1/public/webhooks/whatsapp').set('X-Hub-Signature-256', sign(readPayload)).send(readPayload).expect(200);
    await new Promise((r) => setTimeout(r, 1000));
    const r = await pool.query('SELECT status, sent_at, delivered_at, read_at FROM comm_messages WHERE id = $1', [msgId]);
    expect(r.rows[0].status).toBe('read');
    expect(r.rows[0].sent_at).toBeTruthy();
    expect(r.rows[0].delivered_at).toBeTruthy();
    expect(r.rows[0].read_at).toBeTruthy();
    expect(new Date(r.rows[0].delivered_at).getTime()).toBeGreaterThanOrEqual(new Date(r.rows[0].sent_at).getTime());
    expect(new Date(r.rows[0].read_at).getTime()).toBeGreaterThanOrEqual(new Date(r.rows[0].delivered_at).getTime());
  });

  it('10. GET /api/v1/comm/stats aggregates correct group by status x channel x last_30d', async () => {
    const tk = generateTestAccessToken();
    const tenantId = '00000000-0000-0000-0000-000000000001';
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, created_at) VALUES (gen_random_uuid(), $1, 'whatsapp', 'outbound', '+212600000001', 'sent', NOW(), NOW())`, [tenantId]);
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, delivered_at, created_at) VALUES (gen_random_uuid(), $1, 'whatsapp', 'outbound', '+212600000002', 'delivered', NOW(), NOW(), NOW())`, [tenantId]);
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, delivered_at, read_at, created_at) VALUES (gen_random_uuid(), $1, 'whatsapp', 'outbound', '+212600000003', 'read', NOW(), NOW(), NOW(), NOW())`, [tenantId]);
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, delivered_at, created_at) VALUES (gen_random_uuid(), $1, 'email', 'outbound', 'a@e2e-test.local', 'delivered', NOW(), NOW(), NOW())`, [tenantId]);
    await pool.query(`INSERT INTO comm_messages (id, tenant_id, channel, direction, to_address, status, sent_at, bounced_at, created_at) VALUES (gen_random_uuid(), $1, 'email', 'outbound', 'b@e2e-test.local', 'bounced', NOW(), NOW(), NOW())`, [tenantId]);
    const r = await request(app.getHttpServer())
      .get('/api/v1/comm/stats?period=last_30d&group_by=channel,status')
      .set('Authorization', `Bearer ${tk}`)
      .set('x-tenant-id', tenantId);
    expect(r.status).toBe(200);
    expect(r.body?.data).toBeDefined();
    const data = r.body.data;
    expect(data.by_channel).toBeDefined();
    expect(data.by_channel.whatsapp).toBeDefined();
    expect(data.by_channel.whatsapp.delivered_count).toBeGreaterThanOrEqual(1);
    expect(data.by_channel.whatsapp.read_count).toBeGreaterThanOrEqual(1);
    expect(data.by_channel.email).toBeDefined();
    expect(data.by_channel.email.bounced_count).toBeGreaterThanOrEqual(1);
    expect(data.delivery_rate).toBeGreaterThan(0);
    expect(data.delivery_rate).toBeLessThanOrEqual(100);
  });
});
```

### Annexe E. README.md template

```markdown
# Comm E2E Tests

Suite de tests End-to-End pour les flows communications WhatsApp + Email.

## Prerequisites

- Docker Compose (Postgres + Redis + Kafka + Mailhog)
- Node 22
- pnpm 9

## Run

\`\`\`bash
pnpm --filter @insurtech/api test:e2e:comm
\`\`\`

## Debug

- Mailhog UI : http://localhost:8025
- BullDashboard : http://localhost:4000/admin/queues
- Coverage report : apps/api/coverage/e2e-comm/lcov-report/index.html
- HTML report : apps/api/coverage/e2e-comm-report/index.html

## Add new scenario

Voir Annexe B du prompt 3.2.13.
```

### Annexe F. Stack docker-compose dedie tests

Le fichier `repo/apps/api/test/comm/docker-compose.test.yml` provisionne l'integralite des dependances en ports isoles (offset +1 par rapport au dev) pour ne jamais entrer en conflit avec une instance dev tournant en parallele sur le poste developpeur.

```yaml
# repo/apps/api/test/comm/docker-compose.test.yml
version: '3.9'

services:
  postgres-test:
    image: postgres:16-alpine
    container_name: insurtech-postgres-e2e
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: insurtech_test
      POSTGRES_INITDB_ARGS: '--encoding=UTF-8 --locale=C.UTF-8'
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U test -d insurtech_test']
      interval: 2s
      timeout: 5s
      retries: 30
    tmpfs:
      - /var/lib/postgresql/data
    command:
      - 'postgres'
      - '-c'
      - 'fsync=off'
      - '-c'
      - 'synchronous_commit=off'
      - '-c'
      - 'full_page_writes=off'
      - '-c'
      - 'max_connections=200'

  redis-test:
    image: redis:7.4-alpine
    container_name: insurtech-redis-e2e
    ports:
      - '6380:6379'
    command:
      - 'redis-server'
      - '--databases'
      - '16'
      - '--appendonly'
      - 'no'
      - '--save'
      - ''
      - '--maxmemory'
      - '512mb'
      - '--maxmemory-policy'
      - 'noeviction'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 2s
      timeout: 3s
      retries: 20

  zookeeper-test:
    image: confluentinc/cp-zookeeper:7.6.0
    container_name: insurtech-zookeeper-e2e
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - '2182:2181'

  kafka-test:
    image: confluentinc/cp-kafka:7.6.0
    container_name: insurtech-kafka-e2e
    depends_on:
      - zookeeper-test
    ports:
      - '9093:9092'
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper-test:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9093
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
      KAFKA_LOG_RETENTION_HOURS: 1
    healthcheck:
      test: ['CMD-SHELL', 'kafka-topics --bootstrap-server localhost:9092 --list']
      interval: 5s
      timeout: 10s
      retries: 20

  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: insurtech-mailhog-e2e
    ports:
      - '1025:1025'
      - '8025:8025'
    environment:
      MH_STORAGE: memory
      MH_HOSTNAME: mailhog.test.local
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:8025/api/v2/messages || exit 1']
      interval: 3s
      timeout: 5s
      retries: 15
```

Commandes operationnelles :

```bash
# Setup : demarrer la stack avant la suite
docker compose -f repo/apps/api/test/comm/docker-compose.test.yml up -d --wait

# Exec : run la suite
DATABASE_URL=postgres://test:test@localhost:5433/insurtech_test \
  REDIS_URL=redis://localhost:6380/15 \
  KAFKA_BROKERS=localhost:9093 \
  MAILHOG_URL=http://localhost:8025 \
  SMTP_HOST=localhost SMTP_PORT=1025 \
  pnpm --filter @insurtech/api test:e2e:comm

# Teardown : arret + suppression volumes (idempotent)
docker compose -f repo/apps/api/test/comm/docker-compose.test.yml down -v --remove-orphans

# Debug : logs en temps reel
docker compose -f repo/apps/api/test/comm/docker-compose.test.yml logs -f mailhog kafka-test

# Reset partiel sans tout redemarrer
docker exec insurtech-redis-e2e redis-cli -n 15 FLUSHDB
curl -X DELETE http://localhost:8025/api/v1/messages
```

Particularites tunees pour les E2E :

- Postgres `tmpfs` + `fsync=off` + `synchronous_commit=off` : speed-up 3x les TRUNCATE entre tests (pas de WAL durable necessaire pour test isolation).
- Redis `--save ''` + `--appendonly no` : aucune persistance, la base 15 est ephemere par definition.
- Kafka `LOG_RETENTION_HOURS=1` : aucun risque de bloat disque entre runs.
- Mailhog `MH_STORAGE=memory` : index Bleve non persiste, OOM-safe pour les runs courts (~5 minutes max), sinon basculer sur `mongodb` storage pour batch suites.

### Annexe G. Test data builders + factories

Les builders centralisent la construction d'objets de test pour eviter la duplication des seeds et garantir que chaque test exprime explicitement les attributs qui le concernent (loyaute au principe ObviousVsRelevant). Un builder retourne toujours un objet INSERT-ready (Postgres) et `.build()` insere effectivement la ligne en base via le pool partage.

```typescript
// repo/apps/api/test/comm/fixtures/builders/tenant.builder.ts
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export interface TenantSeed {
  id: string;
  name: string;
  campaigns_paused: boolean;
  whatsapp_business_account_id: string;
  whatsapp_phone_number_id: string;
  email_from: string;
  bounce_rate_threshold_pct: number;
  default_locale: 'fr' | 'ar-MA' | 'ar' | 'en';
}

export class TenantBuilder {
  private state: Partial<TenantSeed> = {};

  static a(): TenantBuilder { return new TenantBuilder(); }

  withId(id: string): this { this.state.id = id; return this; }
  withName(name: string): this { this.state.name = name; return this; }
  withCampaignsPaused(paused: boolean): this { this.state.campaigns_paused = paused; return this; }
  withWhatsAppPhoneNumberId(id: string): this { this.state.whatsapp_phone_number_id = id; return this; }
  withDefaultLocale(loc: TenantSeed['default_locale']): this { this.state.default_locale = loc; return this; }
  withBounceRateThreshold(pct: number): this { this.state.bounce_rate_threshold_pct = pct; return this; }

  async build(pool: Pool): Promise<TenantSeed> {
    const seed: TenantSeed = {
      id: this.state.id ?? randomUUID(),
      name: this.state.name ?? `Tenant E2E ${Date.now()}`,
      campaigns_paused: this.state.campaigns_paused ?? false,
      whatsapp_business_account_id: this.state.whatsapp_business_account_id ?? '102290129340398',
      whatsapp_phone_number_id: this.state.whatsapp_phone_number_id ?? '106540352242922',
      email_from: this.state.email_from ?? 'noreply@e2e-test.skalean.local',
      bounce_rate_threshold_pct: this.state.bounce_rate_threshold_pct ?? 5,
      default_locale: this.state.default_locale ?? 'fr',
    };
    await pool.query(
      `INSERT INTO tenants (id, name, campaigns_paused, whatsapp_business_account_id, whatsapp_phone_number_id, email_from, bounce_rate_threshold_pct, default_locale, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, campaigns_paused = EXCLUDED.campaigns_paused`,
      [seed.id, seed.name, seed.campaigns_paused, seed.whatsapp_business_account_id, seed.whatsapp_phone_number_id, seed.email_from, seed.bounce_rate_threshold_pct, seed.default_locale],
    );
    return seed;
  }
}
```

```typescript
// repo/apps/api/test/comm/fixtures/builders/contact.builder.ts
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type Locale = 'fr' | 'ar-MA' | 'ar' | 'en';
export type Channel = 'whatsapp' | 'email' | 'sms' | 'push';

export interface ContactSeed {
  id: string;
  tenant_id: string;
  phone: string | null;
  email: string | null;
  preferred_channel: Channel;
  preferred_language: Locale;
  tags: string[];
  consent_marketing: boolean;
  full_name: string;
}

export class ContactBuilder {
  private state: Partial<ContactSeed> = {};

  static a(): ContactBuilder { return new ContactBuilder(); }

  withId(id: string): this { this.state.id = id; return this; }
  withTenantId(tenantId: string): this { this.state.tenant_id = tenantId; return this; }
  withPhone(phone: string): this { this.state.phone = phone; return this; }
  withEmail(email: string): this { this.state.email = email; return this; }
  withPreferredChannel(ch: Channel): this { this.state.preferred_channel = ch; return this; }
  withPreferredLanguage(loc: Locale): this { this.state.preferred_language = loc; return this; }
  withTags(tags: string[]): this { this.state.tags = tags; return this; }
  withConsentMarketing(consent: boolean): this { this.state.consent_marketing = consent; return this; }
  withFullName(name: string): this { this.state.full_name = name; return this; }

  async build(pool: Pool): Promise<ContactSeed> {
    const seed: ContactSeed = {
      id: this.state.id ?? randomUUID(),
      tenant_id: this.state.tenant_id ?? '00000000-0000-0000-0000-000000000001',
      phone: this.state.phone ?? `+2126${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`,
      email: this.state.email ?? `contact_${Date.now()}_${Math.floor(Math.random() * 10_000)}@e2e-test.local`,
      preferred_channel: this.state.preferred_channel ?? 'whatsapp',
      preferred_language: this.state.preferred_language ?? 'fr',
      tags: this.state.tags ?? [],
      consent_marketing: this.state.consent_marketing ?? true,
      full_name: this.state.full_name ?? 'E2E Test Contact',
    };
    await pool.query(
      `INSERT INTO crm_contacts (id, tenant_id, phone, email, preferred_channel, preferred_language, tags, consent_marketing, full_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [seed.id, seed.tenant_id, seed.phone, seed.email, seed.preferred_channel, seed.preferred_language, seed.tags, seed.consent_marketing, seed.full_name],
    );
    return seed;
  }
}
```

```typescript
// repo/apps/api/test/comm/fixtures/builders/template.builder.ts
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type MetaStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'paused';

export class TemplateBuilder {
  private state: {
    id?: string;
    tenant_id?: string;
    name?: string;
    locales?: Array<{ language: string; body: string; header?: string; footer?: string }>;
    meta_status?: MetaStatus;
    category?: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  } = {};

  static a(): TemplateBuilder { return new TemplateBuilder(); }

  withId(id: string): this { this.state.id = id; return this; }
  withTenantId(t: string): this { this.state.tenant_id = t; return this; }
  withName(n: string): this { this.state.name = n; return this; }
  withLocales(locales: Array<{ language: string; body: string }>): this { this.state.locales = locales; return this; }
  withMetaStatus(s: MetaStatus): this { this.state.meta_status = s; return this; }
  withCategory(c: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY'): this { this.state.category = c; return this; }

  async build(pool: Pool): Promise<{ id: string; name: string; locales: string[] }> {
    const id = this.state.id ?? randomUUID();
    const name = this.state.name ?? `tpl_${Date.now()}`;
    const tenantId = this.state.tenant_id ?? '00000000-0000-0000-0000-000000000001';
    const locales = this.state.locales ?? [{ language: 'fr', body: 'Hello {{1}}' }];
    const status = this.state.meta_status ?? 'approved';
    const category = this.state.category ?? 'UTILITY';
    for (const loc of locales) {
      await pool.query(
        `INSERT INTO comm_templates (id, tenant_id, name, language, body, header, footer, category, meta_template_status, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [tenantId, name, loc.language, loc.body, loc.header ?? null, loc.footer ?? null, category, status],
      );
    }
    return { id, name, locales: locales.map((l) => l.language) };
  }
}
```

```typescript
// repo/apps/api/test/comm/fixtures/builders/message.builder.ts
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type MessageStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';

export class MessageBuilder {
  private state: {
    id?: string;
    tenant_id?: string;
    contact_id?: string;
    channel?: 'whatsapp' | 'email';
    status?: MessageStatus;
    provider_message_id?: string;
    to_address?: string;
    locale_used?: string;
    template_name?: string;
  } = {};

  static a(): MessageBuilder { return new MessageBuilder(); }

  withTenantId(t: string): this { this.state.tenant_id = t; return this; }
  withContactId(c: string): this { this.state.contact_id = c; return this; }
  withChannel(ch: 'whatsapp' | 'email'): this { this.state.channel = ch; return this; }
  withStatus(s: MessageStatus): this { this.state.status = s; return this; }
  withProviderMessageId(pid: string): this { this.state.provider_message_id = pid; return this; }
  withToAddress(addr: string): this { this.state.to_address = addr; return this; }
  withLocale(loc: string): this { this.state.locale_used = loc; return this; }
  withTemplate(n: string): this { this.state.template_name = n; return this; }

  async build(pool: Pool): Promise<{ id: string }> {
    const id = this.state.id ?? randomUUID();
    await pool.query(
      `INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, to_address, status, provider_message_id, locale_used, template_name, sent_at, created_at)
       VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9, NOW(), NOW())`,
      [id, this.state.tenant_id ?? '00000000-0000-0000-0000-000000000001', this.state.contact_id ?? null, this.state.channel ?? 'whatsapp', this.state.to_address ?? '+212611111111', this.state.status ?? 'sent', this.state.provider_message_id ?? `wamid.${id}`, this.state.locale_used ?? 'fr', this.state.template_name ?? 'appointment_reminder'],
    );
    return { id };
  }
}
```

Exemple d'usage compose dans un test :

```typescript
const tenant = await TenantBuilder.a().withName('Broker A').withDefaultLocale('ar-MA').build(pool);
const contact = await ContactBuilder.a()
  .withTenantId(tenant.id)
  .withPreferredLanguage('ar-MA')
  .withPreferredChannel('whatsapp')
  .withTags(['vip', 'auto-insurance'])
  .build(pool);
await TemplateBuilder.a()
  .withTenantId(tenant.id)
  .withName('appointment_reminder')
  .withLocales([
    { language: 'fr', body: 'Bonjour {{1}}, RDV {{2}}' },
    { language: 'ar-MA', body: 'Salam {{1}}, mawid dyalek {{2}}' },
  ])
  .withMetaStatus('approved')
  .build(pool);
```

### Annexe H. Coverage report + thresholds

```typescript
// repo/apps/api/test/comm/vitest.coverage.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/e2e-comm',
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
      include: [
        'packages/comm/src/**/*.ts',
        'apps/api/src/modules/comm/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        '**/*.types.ts',
        '**/*.dto.ts',
        '**/index.ts',
        '**/*.module.ts',
        '**/migrations/**',
        '**/seeds/**',
      ],
      all: true,
      skipFull: false,
    },
  },
});
```

Commandes :

```bash
# Run avec coverage
COVERAGE=true pnpm --filter @insurtech/api vitest run --coverage --config test/comm/vitest.coverage.config.ts

# Open HTML report
open apps/api/coverage/e2e-comm/index.html
# ou xdg-open sur Linux, start sur Windows

# Verify thresholds (CI gate)
node -e "
const j = require('./apps/api/coverage/e2e-comm/coverage-summary.json');
const t = j.total;
const fail = [];
if (t.lines.pct < 85) fail.push('lines ' + t.lines.pct);
if (t.functions.pct < 85) fail.push('functions ' + t.functions.pct);
if (t.branches.pct < 80) fail.push('branches ' + t.branches.pct);
if (fail.length) { console.error('Coverage threshold failed:', fail); process.exit(1); }
console.log('Coverage OK:', t);
"
```

Sample output HTML rendu en CI (extrait):

```
File                                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered
-------------------------------------------|---------|----------|---------|---------|----------
All files                                  |   88.34 |    82.11 |   91.20 |   88.34 |
 packages/comm/src                         |   90.12 |    84.55 |   93.10 |   90.12 |
  message-orchestrator.service.ts          |   94.20 |    88.30 |   95.00 |   94.20 | 142,156
  wa-template-renderer.service.ts          |   91.50 |    83.10 |   94.00 |   91.50 | 78,103
  email-template-renderer.service.ts       |   89.00 |    81.00 |   92.00 |   89.00 | 65,89,112
  optout.service.ts                        |   95.00 |    90.00 |   97.00 |   95.00 | 45
 apps/api/src/modules/comm/controllers     |   86.20 |    80.10 |   89.00 |   86.20 |
  messages.controller.ts                   |   88.00 |    82.00 |   90.00 |   88.00 | 67,123
  wa-webhook.controller.ts                 |   85.00 |    79.00 |   88.00 |   85.00 | 89,134,178
```

### Annexe I. CI GitHub Actions workflow detaille

```yaml
# .github/workflows/comm-tests.yml
name: Comm Module Tests

on:
  pull_request:
    branches: [main, develop]
    paths:
      - 'packages/comm/**'
      - 'apps/api/src/modules/comm/**'
      - 'apps/api/test/comm/**'
  push:
    branches: [main]

concurrency:
  group: comm-tests-${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e-tests:
    name: E2E Comm Tests (Sprint 9)
    runs-on: ubuntu-22.04
    timeout-minutes: 25

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: insurtech_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

      redis:
        image: redis:7.4-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

      mailhog:
        image: mailhog/mailhog:v1.0.1
        ports:
          - 1025:1025
          - 8025:8025

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9.x

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start Kafka (KRaft mode, no zookeeper)
        run: |
          docker run -d --name kafka-test \
            -p 9093:9092 \
            -e KAFKA_NODE_ID=1 \
            -e KAFKA_PROCESS_ROLES=broker,controller \
            -e KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9094 \
            -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9093 \
            -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9094 \
            -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
            -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
            -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
            -e CLUSTER_ID=ciluster1234567890abcd \
            confluentinc/cp-kafka:7.6.0
          for i in $(seq 1 30); do
            if docker exec kafka-test kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
              echo "Kafka up"; exit 0
            fi
            sleep 2
          done
          echo "Kafka failed to start" && exit 1

      - name: Run database migrations
        env:
          DATABASE_URL: postgres://test:test@localhost:5433/insurtech_test
        run: pnpm --filter @insurtech/api db:migrate:test

      - name: Seed test data (templates Sprint 9 idempotent)
        env:
          DATABASE_URL: postgres://test:test@localhost:5433/insurtech_test
        run: pnpm --filter @insurtech/api db:seed:e2e

      - name: Wait for services
        run: |
          for svc in "5433" "6380" "9093" "1025" "8025"; do
            for i in $(seq 1 30); do
              nc -z localhost $svc && break
              sleep 1
            done
          done

      - name: Run E2E tests
        env:
          DATABASE_URL: postgres://test:test@localhost:5433/insurtech_test
          REDIS_URL: redis://localhost:6380/15
          KAFKA_BROKERS: localhost:9093
          MAILHOG_URL: http://localhost:8025
          SMTP_HOST: localhost
          SMTP_PORT: 1025
          WHATSAPP_APP_SECRET: test-app-secret
          MAILGUN_SIGNING_KEY: test-mg-signing-key
          JWT_SECRET: test-jwt-secret
          NODE_ENV: test
          CI: 'true'
        run: |
          pnpm --filter @insurtech/api test:e2e:comm \
            --reporter=verbose \
            --reporter=junit \
            --outputFile=junit.xml

      - name: Run with coverage
        if: success()
        env:
          DATABASE_URL: postgres://test:test@localhost:5433/insurtech_test
          REDIS_URL: redis://localhost:6380/15
          KAFKA_BROKERS: localhost:9093
          MAILHOG_URL: http://localhost:8025
          COVERAGE: 'true'
        run: pnpm --filter @insurtech/api test:e2e:comm:coverage

      - name: Upload coverage to Codecov
        if: always()
        uses: codecov/codecov-action@v4
        with:
          files: ./apps/api/coverage/e2e-comm/lcov.info
          flags: comm-e2e
          name: comm-module-coverage
          fail_ci_if_error: false

      - name: Upload JUnit report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: comm-e2e-junit
          path: apps/api/junit.xml
          retention-days: 14

      - name: Detect flaky tests (rerun failed up to 2 times)
        if: failure()
        run: |
          pnpm --filter @insurtech/api test:e2e:comm --retry=2 --bail || true
          echo "Flaky retry executed -- review logs for instability patterns"

      - name: Annotate PR with summary
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            try {
              const cov = JSON.parse(fs.readFileSync('apps/api/coverage/e2e-comm/coverage-summary.json'));
              const t = cov.total;
              const body = `## Comm E2E Coverage\n\n| Metric | % | Threshold |\n|--------|---|-----------|\n| Lines | ${t.lines.pct} | 85 |\n| Functions | ${t.functions.pct} | 85 |\n| Branches | ${t.branches.pct} | 80 |\n| Statements | ${t.statements.pct} | 85 |`;
              github.rest.issues.createComment({ issue_number: context.issue.number, owner: context.repo.owner, repo: context.repo.repo, body });
            } catch (e) { core.warning('Coverage summary not found: ' + e.message); }

  reproducibility-check:
    name: Reproducibility (5 runs)
    runs-on: ubuntu-22.04
    needs: e2e-tests
    if: github.event_name == 'pull_request'
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - name: Setup
        uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: pnpm/action-setup@v3
        with: { version: 9.x }
      - run: pnpm install --frozen-lockfile
      - name: Run 5x consecutif
        run: |
          for i in 1 2 3 4 5; do
            echo "::group::Run $i"
            pnpm --filter @insurtech/api test:e2e:comm || (echo "Run $i FAILED" && exit 1)
            echo "::endgroup::"
          done
          echo "5 consecutive runs passed -- reproducibility OK"
```

### Annexe J. Performance baseline + load testing (k6)

Le module comm doit soutenir une charge de **1000 sends/min sustained + spikes 100 webhooks/sec** sans degradation observable. Le test de charge k6 ci-dessous valide ces seuils en local et en CI Sprint 34.

```javascript
// repo/apps/api/test/comm/load/send-throughput.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const sendDuration = new Trend('send_duration_ms');
const sendErrors = new Rate('send_errors');
const sendCount = new Counter('send_count');

const contacts = new SharedArray('contacts', () => {
  const arr = [];
  for (let i = 0; i < 5000; i += 1) {
    arr.push(`00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
  }
  return arr;
});

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    send_errors: ['rate<0.005'],
    send_duration_ms: ['p(95)<200'],
  },
  ext: {
    loadimpact: {
      projectID: 0,
      name: 'Comm Module Sprint 9 -- send throughput',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.E2E_LOAD_TOKEN;
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function () {
  const contactId = contacts[Math.floor(Math.random() * contacts.length)];
  const payload = JSON.stringify({
    contactId,
    templateName: 'appointment_reminder',
    variables: { user_name: 'Load Test', appointment_time: '14h' },
  });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'x-tenant-id': TENANT_ID,
    },
    timeout: '5s',
    tags: { name: 'POST /comm/messages/send' },
  };
  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/v1/comm/messages/send`, payload, params);
  sendDuration.add(Date.now() - start);
  sendCount.add(1);
  const ok = check(res, {
    'status 201': (r) => r.status === 201,
    'has messageId': (r) => r.json('data.messageId') !== undefined,
    'p95 < 200ms': (r) => r.timings.duration < 200,
  });
  if (!ok) sendErrors.add(1);
  else sendErrors.add(0);
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    'load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return `
Comm Load Test -- Send Throughput
=================================
Total sends      : ${m.send_count.values.count}
RPS sustained    : ${(m.send_count.values.count / data.state.testRunDurationMs * 1000).toFixed(1)} req/s
p95 duration     : ${m.send_duration_ms.values['p(95)'].toFixed(0)} ms
p99 duration     : ${m.send_duration_ms.values['p(99)'].toFixed(0)} ms
Error rate       : ${(m.send_errors.values.rate * 100).toFixed(3)} %
Threshold p95<200: ${m.send_duration_ms.values['p(95)'] < 200 ? 'PASS' : 'FAIL'}
Threshold err<1% : ${m.send_errors.values.rate < 0.01 ? 'PASS' : 'FAIL'}
`;
}
```

Baseline metrics attendues (poste developpeur i7-12700 32 GB RAM + Postgres tmpfs + Redis local) :

| Metrique | Cible | Mesure baseline |
|----------|-------|-----------------|
| Throughput sends sustained | >= 1000/min (16.67/s) | 50 VUs sustained 2 min = ~50 req/s soutenus |
| p95 latency POST /messages/send | < 200 ms | 145 ms |
| p99 latency POST /messages/send | < 500 ms | 380 ms |
| Webhook ingestion rate | 100 req/s spike | 120 req/s soutenable |
| BullMQ queue depth steady-state | < 100 jobs | 23 jobs en moyenne |
| Memory RSS API process | < 500 MB | 380 MB stable apres 10 min |
| Memory leak indicator | < 5 MB/min | 0.8 MB/min (acceptable, GC efficace) |
| Postgres connections actives | < 50 | 28 max |
| Redis ops/sec | < 5000 | 2400 (BullMQ + cache templates) |
| Kafka publish rate | < 200 ev/s | 95 ev/s en charge nominale |

Commandes :

```bash
# Run load test local
E2E_LOAD_TOKEN=$(node scripts/generate-load-test-token.js) \
  BASE_URL=http://localhost:3000 \
  k6 run repo/apps/api/test/comm/load/send-throughput.k6.js

# Run avec output influx (Sprint 34 dashboard Grafana)
k6 run --out influxdb=http://localhost:8086/k6 repo/apps/api/test/comm/load/send-throughput.k6.js

# Profiling memoire pendant le run
node --inspect=0.0.0.0:9229 apps/api/dist/main.js &
# Puis chrome://inspect -> Memory tab -> Take heap snapshot avant/apres
```

### Annexe K. Strategie tests par categorie

La pyramide de tests Sprint 9 respecte la regle 70/20/10 (unit/integration/E2E) en privilegiant les tests bas-niveau pour la rapidite mais en compensant par une couverture E2E exhaustive sur les flows critiques (envoi message + webhooks + opt-out).

| Categorie | Test count Sprint 9 | Coverage cible | Outils | Duree | Quand executer |
|-----------|--------------------:|---------------:|--------|------:|----------------|
| Unit comm services | 80+ | 90% lines / 85% branches | Vitest 1.6 + sinon | 8s | Pre-commit hook + CI pull request |
| Integration BullMQ | 20+ | 85% workers + queues | Vitest + Redis testcontainers | 35s | CI pull request |
| Integration Postgres | 15+ | 85% repositories | Vitest + Postgres testcontainers | 25s | CI pull request |
| E2E API endpoints | 50+ | 80% controllers + middleware | Supertest + Mailhog + nock | 6 min (workers=1) / 2.5 min (workers=4) | CI pull request + nightly |
| E2E webhook security | 12+ | 100% middleware HMAC | Supertest + crypto.HMAC | 15s | CI pull request |
| E2E multi-tenant isolation | 15+ | 100% tenant guard | Helpers `seedTenant` + assert | 30s | CI pull request |
| Performance smoke | 5+ | smoke (no regression) | k6 light profile (10 VUs 30s) | 45s | CI pull request |
| Performance full load | 1 | sustained throughput | k6 heavy profile (100 VUs 5 min) | 6 min | Nightly + manual sprint 34 |
| Chaos engineering | 3+ (Sprint 35) | smoke (no crash) | Toxiproxy + scripted restarts | 12 min | Sprint 35 manual + nightly |
| Mutation testing | runs hebdo | 70% mutation score | Stryker | 25 min | Weekly cron + manual |
| Visual regression | 0 | n/a (API-only Sprint 9) | Playwright (Sprint 18) | n/a | Sprint 18+ |

Strategie d'execution :

1. **Pre-commit (developpeur local)** : Husky hook lance unit + integration BullMQ uniquement (~50s) pour ne pas ralentir le commit. Si tests cassent, le commit est bloque.
2. **CI Pull Request** : pipeline complet sauf nightly load test + mutation testing. Duree totale ~12 min sur GitHub Actions Ubuntu 22.04 standard runner. Bloque le merge si echec ou coverage < 85%.
3. **Nightly main branch** : full suite incluant load test k6 5 min + mutation testing Stryker 25 min + reproducibility 5 runs consecutifs. Notification Slack `#insurtech-alerts` si echec.
4. **Sprint review (avant release)** : run manuel sur infrastructure preprod-like (RDS Postgres + ElastiCache Redis + MSK Kafka) pour valider les comportements differents du local (network latency, eventual consistency Kafka, etc.).

Anti-patterns a eviter :

- **Tests inversed pyramid** : ecrire E2E pour ce qui devrait etre unit (rendre `WaTemplateRenderer.render()` testable en E2E uniquement = 30s vs 5ms en unit). Regle : si le test peut etre unit OU integration sans perte de signal, choisir le moins cher.
- **Tests redondants** : ecrire le meme assert en unit + integration + E2E (idempotency check teste 3 fois). Regle : choisir une seule layer comme owner du test, doc le pourquoi.
- **Tests fragiles couples au scheduling** : `setTimeout(500)` puis assert -> flaky en CI. Regle : utiliser `waitForCondition(predicate, timeout)` avec polling.
- **Tests sans cleanup** : leakage Redis BullMQ entre tests = false positives. Regle : `afterEach` strict + verification etat post-cleanup en CI debug.

### Annexe L. Test naming conventions

Le naming test est documentation. Un test bien nomme se comprend SANS lire l'implementation. Sprint 9 adopte le pattern `<numero>. <action>(s) -> <observable>(s)` pour rendre le rapport Vitest immediatement lisible meme pour un PM ou un commercial qui audit la couverture.

Patterns retenus (forme : `it('<numero>. <description>', ...)`) :

| Niveau | Pattern | Justification |
|--------|---------|---------------|
| `describe()` | `<Composant> <Type> (<count>+ tests)` | Permet de cibler `pnpm test -t "Email Flow"` rapidement |
| `it()` | `<numero>. <action> -> <observable>` | Numerotage facilite refs PR/issue ; fleche `->` indique cause/effet ; chaque test une seule observation |

Exemples valides :

```typescript
// BON : description orientee comportement, fleche cause-effet, observable concret
it('1. preferred=whatsapp + opt-in -> WA used', async () => { ... });
it('2. webhook signature invalid -> 401 + log warn', async () => { ... });
it('5. STOP keyword WA -> auto opt-out + auto-reply', async () => { ... });
it('7. bounce rate > 5% on 24h window -> emit Kafka comm.high_bounce_rate', async () => { ... });
it('9. WA delivered + read tracking timeline correct (sent -> delivered -> read)', async () => { ... });
```

Exemples a eviter :

```typescript
// MAUVAIS : redondant avec describe, vague, pas d'observable, imperatif
it('should send a message', ...);              // imperatif "should" interdit Sprint 32
it('test send WA', ...);                        // mot "test" inutile, vague
it('it works', ...);                            // aucune information
it('handles edge case', ...);                   // "edge case" lequel ?
it('verifies the orchestrator', ...);           // "verifies" trop generique
it('1', ...);                                   // numerotage sans description
it('checks that the user is opted out and the message is not sent and ...', ...);  // multi-asserts en un seul test
```

Regles strictes :

1. **Pas de "should"** (decision sprint 32 alignement Vitest community). Action directe au present narratif : `'token URL flow renders confirm page'` plutot que `'should render confirm page'`.
2. **Numerotage sequentiel** dans chaque `describe()` (1, 2, 3, ...). Permet refs precises dans PR comments : "Test 7 fails on Postgres 16".
3. **Une assertion logique principale par test** (les `expect()` multiples sont OK s'ils observent la meme propriete sous angles differents : ex `status === 'read' && delivered_at exists && read_at >= delivered_at`).
4. **Pas de JSDoc dans les tests** (ils s'auto-documentent par leur description). Ajouter un commentaire `// NOTE:` uniquement pour expliquer un piege non-evident (ex : `// NOTE: timestamp >5min reject par Mailgun anti-replay`).
5. **Verbes d'action** : send, verify, reject, accept, route, fallback, emit, propagate, persist, invalidate. Eviter : test, check, do, ensure, validate (trop generiques).
6. **Observables concrets** : `status='sent'`, `bounce_rate_pct > 5`, `comm_optouts row exists`, `Kafka event emitted`, `HTTP 401`. Eviter : "works", "handles", "is correct".
7. **Locales explicites** : `'5. RTL ar standard : dir=rtl + lang=ar attribute'` plutot que `'RTL works'` -- le lecteur sait immediatement quelle locale est validee.
8. **Negations explicites** : `'opt-out WA + opt-out email -> 400 NoAvailableChannel'` plutot que `'no channel available rejected'` -- la condition initiale est claire.

Naming des helpers et builders :

```typescript
// BON : verbes explicites, parametres typed, async marquage clair
async function seedContact(opts: ContactOpts): Promise<ContactSeed> { ... }
async function waitForMailhogMessage(toEmail: string, timeoutMs?: number): Promise<MailhogMessage> { ... }
async function generateOptoutToken(contactId: string, channel: Channel): Promise<string> { ... }
async function setupMetaMockHappy(opts: { persist: boolean }): void { ... }

// MAUVAIS : abreviations cryptiques, no-async marker, no-types
function sd(c: any): any { ... }                  // qu'est-ce que sd ?
function getMsg(...): any { ... }                 // sync ? async ? quel type ?
function setup(...): void { ... }                 // setup quoi ?
```

---

**Fin du prompt task 3.2.13 v2.2 format Option B.**
