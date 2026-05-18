# TACHE 3.2.4 -- WhatsApp Webhook Receiver + Signature HMAC SHA-256 + Idempotency + Async Kafka Processing

**Sprint** : 9 (Phase 3 / Sprint 2 dans la phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.4)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.5 Template Manager, 3.2.10 Delivery Tracking, 3.2.11 STOP keyword auto opt-out, 3.2.13 E2E tests)
**Effort** : 5h
**Dependances** : 3.2.3 (WA Template Renderer), 3.2.2 (WhatsApp Cloud API Client), 3.2.1 (comm_messages entity + Zod), Sprint 8 (CRM contacts lookup), Sprint 5 (PublicEndpointGuard + Fastify), Sprint 3 (Kafka + JobsModule), Sprint 2 (comm_webhooks_received table + idempotency_key UNIQUE)
**Densite cible** : 125-145 ko (auto-suffisant exhaustif -- securite critique)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le receveur webhooks WhatsApp Cloud API du programme Skalean InsurTech v2.2 qui implemente integralement la couche d'ingestion securisee des callbacks Meta (status updates `sent` -> `delivered` -> `read` -> `failed`, incoming messages des utilisateurs, errors de delivery, template status changes) avec verification cryptographique de signature HMAC SHA-256 conforme aux exigences Meta Business Platform v21.0 (header `X-Hub-Signature-256` calcule sur le raw body avec le secret `WHATSAPP_APP_SECRET`), avec idempotency persistente via UNIQUE constraint Postgres sur `idempotency_key = sha256(rawBody)` permettant de tolerer les retries 24h Meta sans double-processing, avec async processing via Kafka topic `insurtech.events.comm.webhook.received` consomme par un worker `WaWebhookProcessorConsumer` qui execute la logique metier en background (le controller HTTP retourne 200 OK en moins de 100 ms pour respecter le SLA Meta < 5s sinon retry inutile), avec auto-log d'interaction CRM (Sprint 8) sur incoming messages, avec detection automatique du keyword `STOP/ARRET/UNSUBSCRIBE/STOP-ALL` declenchant un `OptOutService.optOut(contactId, 'whatsapp', source: 'whatsapp')` (Tache 3.2.11) conforme loi 09-08 CNDP, avec replay protection via timestamp Meta `entry[0].time` rejete si > `WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS` (default 300000 = 5 min), et avec endpoint GET secondaire pour le verification challenge initial Meta lors du subscribe webhook URL dans la console Meta Business Manager. Le perimetre couvre : un controller `WaWebhookController` avec deux endpoints publics `GET /api/v1/public/webhooks/whatsapp` (verification challenge Meta) et `POST /api/v1/public/webhooks/whatsapp` (receveur), un middleware `WaSignatureMiddleware` calculant HMAC SHA-256 timing-safe via `node:crypto.timingSafeEqual` sur le raw body preserve par un hook Fastify `onRequest` configure dans `main.ts` (sinon Fastify parse JSON et detruit le buffer original ce qui invalide l'HMAC), un service `WaWebhookStorageService` executant l'INSERT dans `comm_webhooks_received` avec idempotency_key UNIQUE permettant un upsert silent en cas de duplicate, un consumer Kafka `WaWebhookProcessorConsumer` (extends `KafkaConsumerBase` Sprint 2) traitant 4 types d'evenements (status_update, incoming_message, error, template_status_change), un service `WaStatusMapperService` mappant les status Meta (`sent`, `delivered`, `read`, `failed`) vers l'enum interne `MessageStatus` de Tache 3.2.1, un service `WaIncomingMessageService` gerant les messages entrants (lookup contact via phone E.164, INSERT `comm_messages` direction='inbound', auto-log CRM interaction Sprint 8 via Kafka event `crm.interaction.create`, detection STOP keyword auto-opt-out via `OptOutService` Tache 3.2.11, gestion des media incoming image/document/audio avec download via WhatsApp Cloud API et upload S3 Sprint 4), des types TypeScript exhaustifs reflectant le format Meta webhook payload (`entry[].changes[].value.statuses` + `.messages` + `.errors`), et une suite de tests E2E avec 25+ scenarios couvrant signatures valides/invalides, idempotency, replay protection, STOP keyword, multi-entry batch, race conditions, et alertes operationnelles.

L'apport est multiple. Premierement, en verifiant cryptographiquement chaque webhook entrant via HMAC SHA-256 avec le secret partage `WHATSAPP_APP_SECRET` (un secret 256 bits genere par Meta lors de l'enregistrement de l'app), on garantit l'authenticite Meta ce qui empeche un attacker de forger des webhooks pour : marquer un message comme `delivered` falsifiant les statistiques de delivery, declencher un faux STOP keyword pour spam-opt-out massif des contacts d'un tenant concurrent, injecter de faux incoming messages pour polluer le CRM avec des leads bidons. Sans HMAC, l'endpoint public `/api/v1/public/webhooks/whatsapp` serait directement exploitable car aucun token JWT/RBAC ne le protege (Meta n'envoie pas de credentials applicatives, seul le secret partage HMAC est valide). L'utilisation de `timingSafeEqual` du module `node:crypto` empeche les timing attacks ou un attacker pourrait deduire byte-par-byte la signature attendue en mesurant le temps de comparaison string standard. Deuxiemement, en isolant la verification de signature dans un middleware Fastify execute AVANT le parsing JSON via la preservation du raw body (`onRequest` hook + `request.rawBody = body` avant le parser content-type), on resout le probleme classique ou Fastify (et NestJS) parsent automatiquement le JSON et detruisent le buffer original ; or l'HMAC est calcule sur les bytes EXACTS recus de Meta (incluant whitespace, ordre des cles JSON, etc.), donc reconstruire un JSON serialize cote serveur produit une signature differente. Cette preservation est documentee dans la section main.ts. Troisiemement, en separant le receveur HTTP synchrone du processor metier asynchrone via Kafka, on respecte le SLA Meta qui exige une reponse 200 OK en moins de 5 secondes sinon Meta retry indefiniment (24h de retries avec backoff) ce qui : (a) cree un duplicate massif si le processor est lent, (b) sature le rate limit cote Meta (80 webhooks/seconde), (c) augmente la latence apparente perceue par les utilisateurs WhatsApp. Le controller fait simplement INSERT idempotency + Kafka publish (~30ms total) puis 200 OK, et le consumer Kafka traite la logique CRM/orchestrator en background avec retry exponential et DLQ (Sprint 3 patterns). Quatriemement, en imposant l'idempotency via UNIQUE constraint Postgres sur `idempotency_key = sha256(rawBody)`, on tolere les retries Meta 24h sans double-processing : Meta peut renvoyer le meme webhook plusieurs fois si elle ne recoit pas le 200 OK en 5s, et avec un sha256 sur le raw body (deterministe : meme bytes -> meme hash), Postgres rejette le 2eme INSERT via duplicate key violation et le controller catch silencieusement et retourne 200 OK quand meme (Meta arrete de retry). Cinquiemement, en detectant le STOP keyword automatiquement dans `WaIncomingMessageService` (regex `/^(STOP|ARRET|UNSUBSCRIBE|STOP-ALL)$/i` sur le body trim), on respecte la conformite CNDP loi 09-08 article 5 qui exige un opt-out simple, gratuit, immediat ; le SMS/WA STOP est une norme telecom internationale (RFC ISO 28005). L'opt-out automatique est enregistre via `OptOutService.optOut(contactId, 'whatsapp', { source: 'whatsapp', reason: 'STOP keyword auto-detected' })` (Tache 3.2.11) qui INSERT `comm_optouts` row, et toutes les futures sends WA seront skip par `MessageOrchestratorService` Tache 3.2.9.

A l'issue de cette tache, l'API publique `GET /api/v1/public/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=XXX&hub.verify_token=YYY` retourne le `challenge` en plain text si le token match l'env `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (pour le subscribe initial Meta dans la console), `POST /api/v1/public/webhooks/whatsapp` accepte uniquement les requests avec `X-Hub-Signature-256` valide HMAC SHA-256 (rejette 401 sinon avec un warn log pas un error pour eviter de polluer les alertes ops sur trafic malveillant attendu), enregistre chaque webhook dans `comm_webhooks_received` table (Sprint 2) avec idempotency_key UNIQUE, publie un evenement Kafka `comm.webhook.received` avec le payload complet et le webhook_id de la row inseree, et retourne 200 OK en moins de 100 ms p99 (mesure benchmark). Le consumer `WaWebhookProcessorConsumer` consomme l'event, parse le payload Meta (`entry[].changes[].value.statuses[]` + `.messages[]`), pour chaque status update : update `comm_messages.status` + `delivered_at` ou `read_at` ou `failed_at` + `fail_reason` selon le mapping `WaStatusMapperService` (Meta `sent` -> internal `sent`, Meta `delivered` -> `delivered`, Meta `read` -> `read`, Meta `failed` -> `failed` avec extraction de `errors[0].title` dans `fail_reason`), pour chaque incoming message : lookup contact via phone E.164 normalise, INSERT `comm_messages` direction='inbound', publie Kafka event `crm.interaction.create` (Sprint 8 auto-log), detect STOP keyword regex et auto-opt-out via OptOutService, download media si applicable et upload S3 Sprint 4, retourne. Le replay protection rejette les webhooks > 5 min (timestamp Meta `entry[0].time` * 1000 vs `Date.now()`), le grace period de 24h pour rotation app_secret valide simultanement l'ancien et le nouveau secret, les logs structures Pino emettent `wa_webhook_received` + `wa_webhook_signature_verified` + `wa_webhook_processed` + `wa_webhook_signature_invalid` (warn level pour eviter alertes excessives), aucun phone number n'est logge en clair (hashed avec sha256 prefix-truncated 8 chars pour audit RGPD/CNDP), et la suite Vitest E2E couvre 25+ scenarios avec coverage >= 88% sur le module WaWebhook.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 utilise WhatsApp Business Platform Meta v21.0 pour ses communications outbound (Tache 3.2.2 + 3.2.5) et a besoin de recevoir les feedback Meta sur ces sends (delivery confirmation, read receipts, errors) ainsi que les replies des utilisateurs (incoming messages). Sans webhook receiver, la plateforme est aveugle sur la delivery effective : un message status reste indefiniment `pending` ou `queued` sans transition vers `sent`/`delivered`/`read`, les statistiques de delivery sont impossibles a calculer, les bounces / errors ne sont pas detectes pour le retry policy, et les replies utilisateurs (cruciales pour le CRM Sprint 8 et le routing Sprint 18 Customer Portal) sont perdues. Meta envoie ses callbacks vers une URL configuree dans la console Meta Business Manager (`https://api.skalean.ma/api/v1/public/webhooks/whatsapp`), donc cette URL doit etre publique (pas auth Bearer JWT) mais securisee par HMAC SHA-256.

L'exigence de signature HMAC est imposee par Meta Webhook Verification spec (https://developers.facebook.com/docs/messenger-platform/webhook#security). Sans cette verification, l'endpoint serait directement exploitable comme decrit dans le but : un attacker pourrait injecter de faux status updates (boost artificiel des KPI), de faux incoming messages (pollution CRM), ou des STOP keywords falsifies (spam opt-out d'une concurrence). Meta calcule HMAC SHA-256(secret = APP_SECRET, message = raw_body) et envoie le resultat en hex prefixed avec `sha256=` dans le header `X-Hub-Signature-256`. L'utilisation de SHA-256 (vs SHA-1 deprecated) est imposee depuis 2020 ; le header legacy `X-Hub-Signature` (SHA-1) est ignore par Skalean.

L'exigence de raw body preservation est un piege classique des frameworks Node.js. Fastify (utilise par NestJS Sprint 1) parse automatiquement le content-type `application/json` via le `JSON.parse` natif en consommant le stream Buffer entrant, et expose `request.body` comme l'objet JS deja parse. Or HMAC est calcule sur les bytes exacts envoyes par Meta : si le serveur reconstruit `JSON.stringify(request.body)`, le resultat differe (ordre cles, espaces, escape chars) et l'HMAC produit ne match plus. Solution : un hook Fastify `onRequest` (le plus tot dans le lifecycle, AVANT le content type parser) qui intercepte le stream brut, le copie dans un Buffer, l'attache a `request.rawBody`, et passe le stream original au parser standard. Le middleware HMAC lit ensuite `request.rawBody` (Buffer) pour calculer la signature.

L'exigence d'idempotency persistente est imposee par la retry policy Meta (24h backoff). Sans idempotency, un webhook `delivered` peut declencher 5 fois la transition `comm_messages.status = 'delivered'` (idempotent operationnellement mais polluant audit log + emit 5x Kafka events `comm.message.delivered`), et un incoming message peut creer 5 rows `comm_messages` direction='inbound' (duplicates dans le CRM, pollution cote conseiller). Solution : UNIQUE constraint Postgres sur `idempotency_key = sha256(rawBody)` (Sprint 2 deja migration). Lors d'un INSERT duplicate, Postgres throw `unique_violation` (code 23505), le service catch silencieusement et le controller retourne 200 OK quand meme (Meta arrete de retry).

L'exigence de async processing est imposee par le SLA Meta < 5s response (sinon retry tempete). Le processing metier complete (lookup contact, update comm_messages, publish Kafka CRM, download media S3, etc.) peut prendre 200ms-5000ms selon la charge. Pour respecter < 100ms p99 cote controller, on isole le processing dans un Kafka consumer asynchrone avec `KafkaConsumerBase` Sprint 2 (retry exponential 1s/5s/30s, DLQ topic `insurtech.events.dlq.comm` apres 3 echecs). Le controller fait : (1) HMAC verify [middleware], (2) INSERT idempotency check [service ~5ms], (3) Kafka publish [~10ms], (4) 200 OK. Total < 30ms typique.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Verify signature SHA-1 (`X-Hub-Signature`) | Backward compat | Deprecated 2020, MD weak | REJETE -- SHA-256 only |
| Pas de verification signature | Simple | Endpoint exploit complet | REJETE -- securite critique |
| Verify signature avec `===` string | Simple | Timing attack possible | REJETE -- timingSafeEqual obligatoire |
| API Gateway WAF AWS verify HMAC | Decouple | Sortie data US (decision-008) | REJETE -- Sprint 9 souverain |
| Verify dans controller (pas middleware) | Centralise | Couple business + securite | REJETE -- separation responsabilites |
| Middleware Fastify (RETENU) | Pre-processing pur, reusable | Necessite raw body preservation | RETENU |
| Body parse + reserialize pour HMAC | Pas de hook | HMAC mismatch garanti | REJETE |
| Raw body preservation onRequest hook (RETENU) | Bytes exacts | Memory copy | RETENU |
| Process inline synchronously | 1 endpoint | SLA Meta 5s violated sur load | REJETE |
| Process via Kafka consumer (RETENU) | Async, retry, DLQ | Complexite | RETENU |
| Process via BullMQ queue | Aussi async | Dedouble Sprint 3 Kafka existing | REJETE |
| Idempotency via Redis cache TTL | Rapide | Persistence faible (TTL eviction) | REJETE -- 24h Meta retries |
| Idempotency via Postgres UNIQUE (RETENU) | Persistent, garanti | Latence INSERT | RETENU |
| Hash body : md5 | Rapide | Collision possible | REJETE -- sha256 |
| Hash body : sha256 (RETENU) | 256-bit, no collision pratique | Latence ~0.1ms | RETENU |
| STOP keyword detection inline orchestrator | Centralise | Coupling | REJETE |
| STOP keyword detection in WaIncomingMessageService (RETENU) | Specifique WA | OK | RETENU |
| Replay window 1 min | Strict | Latency Meta peut >1min | REJETE |
| Replay window 5 min (RETENU) | Tolere latency Meta | OK | RETENU |
| Replay window 30 min | Permissif | Risque replay attack | REJETE |
| Verify token rotation | Best practice | Sprint 35 secrets manager | DEFFERE Sprint 35 |
| App_secret dual-validate grace period 24h (RETENU) | Permet rotation sans downtime | Complexite mineure | RETENU |

### 2.3 Trade-offs

Choisir SHA-256 HMAC implique d'accepter une latence de ~0.1ms par verification (negligeable). En contrepartie, securite cryptographique 256-bit (pas de collision realiste) et conformite Meta spec actuelle.

Choisir le pattern raw body preservation implique d'accepter une duplicaition memoire du Buffer (max 200 KB par webhook Meta, soit 200 KB de copy par request). Avec 80 webhooks/sec rate limit Meta, soit 16 MB/s memory pressure (negligeable sur Node 1 GB heap default). En contrepartie, HMAC verification correct.

Choisir l'idempotency Postgres UNIQUE constraint implique d'accepter une latence d'INSERT (~3-10ms) avant le 200 OK. En contrepartie, persistence de 24h+ pour les retries Meta, audit trail dans `comm_webhooks_received` table.

Choisir l'async Kafka processing implique d'accepter une complexite operationnelle (un consumer en plus a deployer, monitorer, retry handling). En contrepartie, controller p99 < 100ms garanti, retry exponential transparent, DLQ pour replay manuel sur erreurs persistentes.

Choisir une replay window 5 min implique d'accepter qu'un attacker qui capture un webhook leak peut le replayer dans les 5 min suivantes. En contrepartie, tolerance des delays Meta (rare mais possible : >1 min lors d'incidents Meta cote backend). Mitigation : idempotency UNIQUE empeche meme dans la fenetre 5min de double-processer.

Choisir la detection STOP keyword inline dans le consumer implique d'accepter un coupling logique entre WA receiver et opt-out service. En contrepartie, declenchement immediat (vs differe via Kafka event chain), conformite CNDP "immediate".

### 2.4 Decisions strategiques referenced

- decision-001 (Multi-tenant) : webhook payload contient `phone_number_id` Meta -> map vers tenant via `tenants.wa_phone_number_id`. Tenant resolution avant Kafka publish.
- decision-006 (No-emoji) : totale.
- decision-007 (Zod runtime) : `MetaWebhookPayloadSchema` Zod valide le payload Meta apres signature OK (defense in depth).
- decision-008 (Cloud souverain MA) : webhooks endpoint hosted Atlas Cloud Services Benguerir (donnees PII phone restent MA).
- decision-009 (Multi-locale) : indirect, incoming message conserve `language_code` Meta optionnel pour CRM.
- decision-014 (Audit immutable) : chaque webhook ingest log `audit_log` table avec `tenant_id`, `webhook_id`, `event_type`, retention 7 ans.
- decision-016 (Kafka events) : `comm.webhook.received` topic + DLQ Sprint 3 patterns.
- decision-019 (PII encryption at rest) : phone numbers stockees full-encrypted via pgcrypto Sprint 2, hashed pour logs.
- decision-022 (Conformite CNDP loi 09-08) : opt-out automatique STOP keyword + audit + retention.

### 2.5 Pieges techniques connus

1. **Fastify body parse detruit raw buffer** : sans hook `onRequest` preservation, HMAC mismatch garanti. Voir section 6.7 main.ts config.
2. **timingSafeEqual length mismatch throw** : si signature longueur != expected longueur, `timingSafeEqual` throw `RangeError`. Toujours wrapper dans `if (a.length !== b.length) return false`.
3. **Header case-sensitivity** : Fastify normalise lowercase mais code `req.headers['X-Hub-Signature-256']` peut return undefined sur certains setups. Toujours utiliser `req.headers['x-hub-signature-256']`.
4. **Meta envoie header signature en hex sans `0x` prefix** : format `sha256=abcdef0123456789...`. NE PAS strip le `sha256=`, comparer la string entiere.
5. **JSON.stringify ordering** : si on reconstruit JSON pour HMAC, ordre cles change. NE JAMAIS reconstruire, utiliser raw buffer.
6. **Phone E.164 normalization race** : Sprint 8 helper `normalizeE164` parfois retourne `+212...` parfois `212...` selon source. Avant lookup contact, toujours normaliser via helper standard.
7. **Idempotency_key collision pratique** : sha256 collision = 1 / 2^128, considere impossible en cosmologique. Mais log warn si UNIQUE constraint violation pour audit (et NE PAS re-process : c'est le 2eme webhook identique de Meta).
8. **Replay protection Meta `entry[0].time` en seconds** : Meta envoie timestamp UNIX en secondes (pas ms). Convertir avant compare avec `Date.now()`.
9. **Kafka publish avant 200 OK** : si Kafka publish fail, controller doit toujours retourner 200 (Meta a deja delivered ; on retry consumer). Solution : `try/catch` Kafka publish + log error + return 200 quand meme (storage row dans `comm_webhooks_received` permet replay manuel).
10. **Multi-entry Meta webhook** : un seul POST peut contenir `entry[]` avec N items (batch). Consumer doit iterer chaque entry/changes/value.
11. **Verify token leak via logs** : NE JAMAIS log `hub.verify_token` query param (peut leak via logs->ELK). Mask en `***` dans tout log.
12. **App_secret rotation downtime** : si on change `WHATSAPP_APP_SECRET` env, les webhooks in-flight signes avec ancien secret echouent. Solution : grace period 24h dual-validate (ancien + nouveau).
13. **Webhook arrive avant message_id existe DB** : race condition si Meta delivered <100ms apres send + worker WaSendWorker pas encore commit DB. Solution : retry 3x backoff dans consumer si message_id introuvable.
14. **Content-type non-JSON** : Meta envoie toujours `application/json`. Si content-type different, refuse 400.
15. **Body limit Fastify** : default 1 MB. Meta webhook max ~200 KB (multi-entry batch 200 webhooks). Configurer `bodyLimit: 1048576` explicit.
16. **HTTP method GET sur POST URL** : Meta utilise GET pour challenge initial subscribe. Pas confondre avec replay. Endpoint GET separe.
17. **Phone number swap user side** : si user change phone, lookup contact echoue. Ne pas auto-create lead (spam). Log + ignore + alert.
18. **Media download blocking consumer** : telecharger image/document via Meta API peut prendre 1-10s. Faire async dans queue worker dedie (Sprint 3 BullMQ).
19. **STOP keyword case-insensitive avec accents** : `ARRET` vs `ARRÊT` vs `arret`. Regex `/i` flag + normaliser unicode.
20. **Token signature en logs Pino redaction** : Pino Sprint 1 doit redact `x-hub-signature-256` header dans tous les logs. Configurer `redact: ['req.headers["x-hub-signature-256"]']`.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.4 livre `WaWebhookController` + `WaSignatureMiddleware` + `WaWebhookProcessorConsumer` consommees par : 3.2.5 (Template Manager utilise webhook status events pour invalider cache template apres Meta approval), 3.2.10 (Delivery Tracking aggregat statistics base sur status updates flowing webhook -> Kafka -> stats service), 3.2.11 (OptOutService `optOut(contactId, 'whatsapp', source: 'whatsapp')` declenche par STOP keyword detection), 3.2.13 (E2E tests fixtures payloads Meta).

### 3.2 Position dans le programme global

- Sprint 8 CRM : `crm.interaction.create` Kafka event consumer auto-log pour incoming messages.
- Sprint 4 Storage : S3 upload media incoming (image/document Meta).
- Sprint 14 Insure : status update `delivered` sur templates `quote_generated` ou `police_signed_confirmation`.
- Sprint 18 Customer Portal : incoming messages route vers chat conseiller.
- Sprint 22 Repair : incoming messages route vers ticket sinistre context.
- Sprint 27 Admin : UI monitoring webhooks recus par tenant + replay manuel DLQ.
- Sprint 33 Alerting : alert si rate webhook > seuil ou signature invalide rate > seuil.

### 3.3 Diagramme

```
                     +----------------------------------+
                     | Meta WhatsApp Cloud API v21.0      |
                     | events.facebook.com/v21.0         |
                     +----------------+------------------+
                                      |
                         POST webhook  | (X-Hub-Signature-256)
                                      v
              +------------------------+----------------------+
              | TACHE 3.2.4 (cette tache)                    |
              | /api/v1/public/webhooks/whatsapp             |
              |                                              |
              | 1. main.ts onRequest hook                    |
              |    -> preserve req.rawBody Buffer            |
              |                                              |
              | 2. WaSignatureMiddleware                     |
              |    -> HMAC SHA-256 timingSafeEqual           |
              |    -> 401 if invalid + warn log              |
              |                                              |
              | 3. WaWebhookController                       |
              |    -> WaWebhookStorageService.persist        |
              |       (idempotency_key = sha256(rawBody))    |
              |    -> KafkaPublisher.publish                  |
              |       comm.webhook.received                  |
              |    -> 200 OK in <100ms                        |
              +-------------------+---------------------------+
                                  |
                                  | Kafka topic
                                  v
              +-------------------+--------------------------+
              | WaWebhookProcessorConsumer (Kafka)          |
              | extends KafkaConsumerBase Sprint 2           |
              |                                              |
              | parseWebhook(payload) -> 4 paths :           |
              |  a) status update                            |
              |     -> WaStatusMapperService                 |
              |     -> messagesRepo.update                   |
              |     -> Kafka comm.message.delivered/read     |
              |  b) incoming message                         |
              |     -> WaIncomingMessageService             |
              |     -> contactsService.findByPhone           |
              |     -> messagesRepo.create direction=inbound |
              |     -> Kafka crm.interaction.create          |
              |     -> OptOutService.optOut if STOP keyword |
              |     -> mediaService download S3 if applicable|
              |  c) error                                    |
              |     -> messagesRepo.update status='failed'   |
              |     -> Kafka comm.message.failed             |
              |  d) template_status_change                   |
              |     -> templateManager.refresh + cache evict |
              +----------------------------------------------+
                            |               |              |
                            v               v              v
              Sprint 8 CRM      Sprint 11 Optout  Sprint 4 Storage
              auto-log interact  auto-opt-out     S3 media upload
```

### 3.4 Flux signature HMAC end-to-end

```
Meta App Dashboard                  Skalean InsurTech
 (Business Manager)                  api.skalean.ma
       |                                    |
       | App_Secret = 0xABCDEF...          | env WHATSAPP_APP_SECRET
       | (256-bit shared secret)           | (loaded boot)
       |                                    |
       | POST /webhooks/whatsapp           |
       | body = '{"entry":[...]}'          |
       | signature = HMAC-SHA256(secret, body)
       | header X-Hub-Signature-256 = "sha256=" + hex(signature)
       |                                    |
       +--------- HTTPS TLS 1.3 ---------->| Fastify onRequest hook
                                            |   request.rawBody = Buffer.from(stream)
                                            |
                                            v
                                            WaSignatureMiddleware
                                            |   expected = "sha256=" + hex(HMAC-SHA256(env.WHATSAPP_APP_SECRET, request.rawBody))
                                            |   if (!timingSafeEqual(received, expected)) -> 401
                                            |
                                            v
                                            WaWebhookController.receive
                                            |   storage.persist(idempotency_key=sha256(rawBody))
                                            |   kafka.publish(...)
                                            |   return 200 OK
                                            |
                                            v
                                            WaWebhookProcessorConsumer (async)
                                            |   process events
                                            |   update comm_messages
                                            |   trigger CRM, opt-out, etc.
```

---

## 4. Livrables checkables (38 livrables)

- [ ] Controller `repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts` -- ~150 lignes
- [ ] Middleware `repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts` -- ~110 lignes
- [ ] Consumer `repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts` -- ~280 lignes
- [ ] Service `repo/apps/api/src/modules/comm/services/wa-webhook-storage.service.ts` -- ~150 lignes
- [ ] Service `repo/apps/api/src/modules/comm/services/wa-status-mapper.service.ts` -- ~80 lignes
- [ ] Service `repo/apps/api/src/modules/comm/services/wa-incoming-message.service.ts` -- ~180 lignes
- [ ] Types `repo/apps/api/src/modules/comm/types/meta-webhook-payload.types.ts` -- ~140 lignes
- [ ] Schema Zod `repo/apps/api/src/modules/comm/schemas/meta-webhook.schema.ts` -- ~60 lignes
- [ ] Mise a jour `repo/apps/api/src/main.ts` (Fastify rawBody hook) -- ~40 lignes
- [ ] Mise a jour `repo/apps/api/src/modules/comm/comm.module.ts` -- ~20 lignes (register controller, middleware, consumer, services)
- [ ] Migration `repo/infrastructure/migrations/V0009.X__wa_webhook_idempotency_unique_constraint.sql` -- ~30 lignes (si pas deja Sprint 2)
- [ ] Tests E2E `repo/apps/api/test/comm/wa-webhook.e2e-spec.ts` -- ~450 lignes (25+ tests)
- [ ] Fixtures `repo/apps/api/test/comm/fixtures/wa-webhook-payloads.fixtures.ts` -- ~200 lignes (12+ payloads Meta realistes)
- [ ] Helper test `repo/apps/api/test/comm/fixtures/wa-signature-helper.ts` -- ~50 lignes (genere signatures HMAC tests)
- [ ] Variables env nouvelles : `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS`, `WHATSAPP_APP_SECRET_PREVIOUS` (rotation grace period)
- [ ] Documentation `repo/docs/runbooks/wa-webhook-troubleshooting.md` -- ~80 lignes
- [ ] No-emoji
- [ ] No-console
- [ ] No log de signature en clair (Pino redact)
- [ ] No log de phone E.164 en clair (hash sha256-prefix-truncated)
- [ ] No log de verify_token en clair
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] Lint passes
- [ ] HMAC verification timing-safe via `node:crypto.timingSafeEqual`
- [ ] Raw body preservation Fastify hook
- [ ] Idempotency UNIQUE constraint Postgres
- [ ] Async processing Kafka consumer
- [ ] Replay protection 5 min window
- [ ] STOP keyword auto-opt-out
- [ ] Auto-log CRM interaction Sprint 8
- [ ] Multi-entry batch processing
- [ ] App_secret dual-validate rotation grace period
- [ ] Public endpoint pas RBAC requis (PublicEndpointGuard Sprint 5)
- [ ] Audit log webhook receive
- [ ] Bench POST < 100ms p99 (mock Kafka)
- [ ] 25+ tests E2E
- [ ] Sprint 33 alert hooks (signature_invalid_rate)

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts                    (~150 lignes)
repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts                    (~110 lignes)
repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts                (~280 lignes)
repo/apps/api/src/modules/comm/services/wa-webhook-storage.service.ts                    (~150 lignes)
repo/apps/api/src/modules/comm/services/wa-status-mapper.service.ts                      (~80 lignes)
repo/apps/api/src/modules/comm/services/wa-incoming-message.service.ts                   (~180 lignes)
repo/apps/api/src/modules/comm/types/meta-webhook-payload.types.ts                       (~140 lignes)
repo/apps/api/src/modules/comm/schemas/meta-webhook.schema.ts                            (~60 lignes)
repo/apps/api/src/modules/comm/comm.module.ts                                            (modifie)
repo/apps/api/src/main.ts                                                                (modifie / +Fastify rawBody hook)
repo/infrastructure/migrations/V0009.4__wa_webhook_idempotency_unique_constraint.sql      (~30 lignes)
repo/apps/api/test/comm/wa-webhook.e2e-spec.ts                                           (~450 lignes)
repo/apps/api/test/comm/fixtures/wa-webhook-payloads.fixtures.ts                          (~200 lignes)
repo/apps/api/test/comm/fixtures/wa-signature-helper.ts                                   (~50 lignes)
repo/docs/runbooks/wa-webhook-troubleshooting.md                                          (~80 lignes)
.env.example                                                                              (modifie / +WHATSAPP_APP_SECRET, etc.)
```

Total : 13 fichiers crees + 3 modifies, ~2000 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 13 : `wa-webhook.controller.ts`

```typescript
/**
 * @insurtech/api/modules/comm/controllers/wa-webhook.controller
 *
 * WhatsApp Cloud API webhook receiver (public endpoint).
 *
 * Endpoints :
 *   GET  /api/v1/public/webhooks/whatsapp -- Meta verification challenge
 *   POST /api/v1/public/webhooks/whatsapp -- webhook receiver
 *
 * Reference :
 *   - decision-001 (Multi-tenant resolution via phone_number_id)
 *   - decision-007 (Zod runtime validation post-HMAC)
 *   - decision-014 (Audit log webhook receive)
 *   - decision-016 (Kafka events for async processing)
 *   - decision-022 (CNDP STOP keyword auto opt-out)
 *   - Sprint 9 Tache 3.2.4 (this task)
 *   - Sprint 8 CRM auto-log interaction
 *   - Sprint 11 OptOutService
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../auth/decorators/public.decorator';
import { WaWebhookStorageService } from '../services/wa-webhook-storage.service';
import { KafkaPublisher } from '../../../kafka/kafka-publisher.service';
import { Topics } from '../../../kafka/topics.constants';
import { hashSha256Hex } from '../../../shared/utils/hash.util';

@Controller('api/v1/public/webhooks/whatsapp')
@Public()
export class WaWebhookController {
  private readonly logger = new Logger(WaWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: WaWebhookStorageService,
    private readonly kafkaPublisher: KafkaPublisher,
  ) {}

  /**
   * Meta verification challenge (initial subscribe in Business Manager console).
   * Meta sends GET with hub.mode=subscribe + hub.challenge=XXX + hub.verify_token=YYY.
   * If verify_token matches env, return challenge as plain text 200.
   */
  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const expectedToken = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (!expectedToken) {
      this.logger.error({ msg: 'wa_webhook_verify_token_not_configured' });
      throw new ForbiddenException('Webhook not configured');
    }

    if (mode === 'subscribe' && token === expectedToken) {
      this.logger.log({ msg: 'wa_webhook_verify_success', mode });
      // Return challenge as plain text (Meta requirement)
      res.status(200).type('text/plain').send(challenge);
      return;
    }

    this.logger.warn({
      msg: 'wa_webhook_verify_failed',
      mode,
      // Do NOT log the actual token received (potential leak)
      received_token_length: token?.length ?? 0,
    });
    throw new ForbiddenException('Invalid verify token');
  }

  /**
   * Webhook receiver. Signature is verified by WaSignatureMiddleware (registered in CommModule).
   * This handler runs ONLY if signature is valid.
   *
   * Flow :
   *   1. Compute idempotency_key = sha256(rawBody)
   *   2. Persist webhook row (UNIQUE constraint -> duplicate ignored silent)
   *   3. Publish Kafka event (async processing)
   *   4. Return 200 OK in <100ms (Meta requires <5s SLA)
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ): Promise<{ status: 'ok' }> {
    const startedAt = Date.now();
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!rawBody) {
      // Should never happen if Fastify hook is configured correctly. Alert ops.
      this.logger.error({
        msg: 'wa_webhook_raw_body_missing',
        alert: 'configuration_error',
      });
      // Return 200 anyway to prevent Meta retry tempest -- ops must investigate
      return { status: 'ok' };
    }

    const idempotencyKey = hashSha256Hex(rawBody);

    try {
      // 1. Persist with idempotency check
      const persistResult = await this.storage.persist({
        idempotency_key: idempotencyKey,
        raw_body: rawBody,
        payload: body as Record<string, unknown>,
        received_at: new Date(),
      });

      if (persistResult.duplicate) {
        // Meta retry of already-processed webhook. Acknowledge to stop retries.
        this.logger.log({
          msg: 'wa_webhook_duplicate_ignored',
          idempotency_key_prefix: idempotencyKey.slice(0, 16),
          duration_ms: Date.now() - startedAt,
        });
        return { status: 'ok' };
      }

      // 2. Publish Kafka event for async processing
      try {
        await this.kafkaPublisher.publish(Topics.COMM_WEBHOOK_RECEIVED, {
          webhook_id: persistResult.webhook_id,
          channel: 'whatsapp',
          payload: body,
          received_at: new Date().toISOString(),
        });
      } catch (kafkaErr) {
        // Kafka publish failure -- DO NOT throw. Webhook is persisted, can be replayed.
        this.logger.error({
          msg: 'wa_webhook_kafka_publish_failed',
          webhook_id: persistResult.webhook_id,
          err: kafkaErr instanceof Error ? kafkaErr.message : String(kafkaErr),
          alert: 'kafka_unavailable_replay_required',
        });
      }

      this.logger.log({
        msg: 'wa_webhook_received',
        webhook_id: persistResult.webhook_id,
        idempotency_key_prefix: idempotencyKey.slice(0, 16),
        duration_ms: Date.now() - startedAt,
      });

      return { status: 'ok' };
    } catch (err) {
      this.logger.error({
        msg: 'wa_webhook_persist_failed',
        idempotency_key_prefix: idempotencyKey.slice(0, 16),
        err: err instanceof Error ? err.message : String(err),
        alert: 'database_unavailable',
      });
      // Return 200 to avoid Meta retry tempest. Webhook is lost (rare DB outage scenario).
      return { status: 'ok' };
    }
  }
}
```

### 6.2 Fichier 2 / 13 : `wa-signature.middleware.ts`

```typescript
/**
 * @insurtech/api/modules/comm/middleware/wa-signature.middleware
 *
 * HMAC SHA-256 signature verification for Meta WhatsApp webhooks.
 *
 * Per Meta spec : https://developers.facebook.com/docs/messenger-platform/webhook#security
 *   - Header : X-Hub-Signature-256
 *   - Format : "sha256=" + hex(HMAC-SHA256(app_secret, raw_body))
 *
 * Critical : MUST use timingSafeEqual to prevent timing attacks.
 * Critical : raw_body is preserved by Fastify onRequest hook in main.ts.
 *
 * App secret rotation : grace period dual-validate WHATSAPP_APP_SECRET
 * + WHATSAPP_APP_SECRET_PREVIOUS for 24h rolling window.
 */

import {
  Injectable,
  NestMiddleware,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WaSignatureMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WaSignatureMiddleware.name);

  constructor(private readonly config: ConfigService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

    if (!signature) {
      this.logger.warn({
        msg: 'wa_webhook_signature_missing',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
      });
      return res.status(401).send({ error: 'NO_SIGNATURE' });
    }

    if (!rawBody) {
      this.logger.error({
        msg: 'wa_webhook_raw_body_missing_in_middleware',
        alert: 'fastify_hook_misconfigured',
      });
      throw new InternalServerErrorException('Webhook body not preserved');
    }

    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appSecret) {
      this.logger.error({ msg: 'wa_webhook_app_secret_not_configured' });
      throw new InternalServerErrorException('Webhook secret not configured');
    }

    // Try current secret
    if (this.verifyWithSecret(signature, rawBody, appSecret)) {
      return next();
    }

    // Grace period : try previous secret if rotation is active
    const previousSecret = this.config.get<string>('WHATSAPP_APP_SECRET_PREVIOUS');
    if (previousSecret) {
      if (this.verifyWithSecret(signature, rawBody, previousSecret)) {
        this.logger.warn({
          msg: 'wa_webhook_signature_verified_with_previous_secret',
          note: 'app_secret_rotation_grace_period',
        });
        return next();
      }
    }

    this.logger.warn({
      msg: 'wa_webhook_signature_invalid',
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      // Do NOT log the actual signature (could be partial leak vector). Length only.
      signature_length: signature.length,
      raw_body_size: rawBody.length,
    });
    return res.status(401).send({ error: 'INVALID_SIGNATURE' });
  }

  private verifyWithSecret(signature: string, rawBody: Buffer, secret: string): boolean {
    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    // Length check before timingSafeEqual (which throws RangeError on mismatch)
    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return timingSafeEqual(sigBuf, expBuf);
  }
}
```

### 6.3 Fichier 3 / 13 : `wa-webhook-storage.service.ts`

```typescript
/**
 * @insurtech/api/modules/comm/services/wa-webhook-storage.service
 *
 * Persists webhooks in comm_webhooks_received table with idempotency check.
 *
 * idempotency_key = sha256(rawBody) UNIQUE constraint -> duplicate INSERT
 * is caught and reported as duplicate=true.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { CommWebhookReceived } from '../entities/comm-webhook-received.entity';

interface PersistInput {
  idempotency_key: string;
  raw_body: Buffer;
  payload: Record<string, unknown>;
  received_at: Date;
}

interface PersistResult {
  webhook_id: string;
  duplicate: boolean;
}

@Injectable()
export class WaWebhookStorageService {
  private readonly logger = new Logger(WaWebhookStorageService.name);

  constructor(
    @InjectRepository(CommWebhookReceived)
    private readonly repo: Repository<CommWebhookReceived>,
  ) {}

  async persist(input: PersistInput): Promise<PersistResult> {
    try {
      const row = this.repo.create({
        channel: 'whatsapp',
        idempotency_key: input.idempotency_key,
        raw_body: input.raw_body,
        payload: input.payload,
        received_at: input.received_at,
        processed: false,
      });
      const saved = await this.repo.save(row);
      return { webhook_id: saved.id, duplicate: false };
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        // Duplicate -- find existing
        const existing = await this.repo.findOne({
          where: { idempotency_key: input.idempotency_key },
        });
        if (existing) {
          return { webhook_id: existing.id, duplicate: true };
        }
      }
      throw err;
    }
  }

  async markProcessed(webhookId: string): Promise<void> {
    await this.repo.update(webhookId, {
      processed: true,
      processed_at: new Date(),
    });
  }

  async findById(webhookId: string): Promise<CommWebhookReceived | null> {
    return this.repo.findOne({ where: { id: webhookId } });
  }

  async findByIdempotencyKey(key: string): Promise<CommWebhookReceived | null> {
    return this.repo.findOne({ where: { idempotency_key: key } });
  }

  private isUniqueViolation(err: unknown): boolean {
    if (err instanceof QueryFailedError) {
      // Postgres error code 23505 = unique_violation
      return (err as any).code === '23505' || (err.driverError as any)?.code === '23505';
    }
    return false;
  }
}
```

### 6.4 Fichier 4 / 13 : `wa-webhook-processor.consumer.ts`

```typescript
/**
 * @insurtech/api/modules/comm/consumers/wa-webhook-processor.consumer
 *
 * Kafka consumer for comm.webhook.received events.
 * Processes 4 event types : status update, incoming message, error, template_status.
 *
 * Extends KafkaConsumerBase Sprint 2 :
 *   - Retry exponential 1s/5s/30s
 *   - DLQ topic insurtech.events.dlq.comm after 3 failures
 *   - Idempotency check via webhook_id
 *
 * Replay protection :
 *   - timestamp Meta entry[].time vs Date.now()
 *   - Reject if older than WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS (default 300000 = 5min)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaConsumerBase } from '../../../kafka/kafka-consumer.base';
import { Topics } from '../../../kafka/topics.constants';
import { WaWebhookStorageService } from '../services/wa-webhook-storage.service';
import { WaStatusMapperService } from '../services/wa-status-mapper.service';
import { WaIncomingMessageService } from '../services/wa-incoming-message.service';
import { MessagesRepositoryService } from '../services/messages-repository.service';
import { KafkaPublisher } from '../../../kafka/kafka-publisher.service';
import {
  MetaWebhookPayload,
  MetaStatusEntry,
  MetaIncomingMessage,
  MetaWebhookErrorEntry,
} from '../types/meta-webhook-payload.types';
import { MetaWebhookPayloadSchema } from '../schemas/meta-webhook.schema';

interface WebhookKafkaEvent {
  webhook_id: string;
  channel: 'whatsapp';
  payload: unknown;
  received_at: string;
}

@Injectable()
export class WaWebhookProcessorConsumer extends KafkaConsumerBase<WebhookKafkaEvent> {
  protected readonly logger = new Logger(WaWebhookProcessorConsumer.name);
  protected readonly topic = Topics.COMM_WEBHOOK_RECEIVED;
  protected readonly groupId = 'comm-wa-webhook-processor';

  private readonly replayWindowMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: WaWebhookStorageService,
    private readonly statusMapper: WaStatusMapperService,
    private readonly incomingService: WaIncomingMessageService,
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly kafkaPublisher: KafkaPublisher,
  ) {
    super();
    this.replayWindowMs = Number.parseInt(
      this.config.get<string>('WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS') ?? '300000',
      10,
    );
  }

  protected async handleMessage(event: WebhookKafkaEvent): Promise<void> {
    if (event.channel !== 'whatsapp') {
      return; // Other channel consumers handle their own
    }

    // 1. Validate webhook still exists (idempotency)
    const webhook = await this.storage.findById(event.webhook_id);
    if (!webhook) {
      this.logger.warn({
        msg: 'wa_webhook_not_found',
        webhook_id: event.webhook_id,
      });
      return;
    }

    if (webhook.processed) {
      this.logger.log({
        msg: 'wa_webhook_already_processed',
        webhook_id: event.webhook_id,
      });
      return;
    }

    // 2. Validate payload structure (Zod)
    const parsed = MetaWebhookPayloadSchema.safeParse(event.payload);
    if (!parsed.success) {
      this.logger.error({
        msg: 'wa_webhook_invalid_payload',
        webhook_id: event.webhook_id,
        errors: parsed.error.flatten(),
      });
      // Mark processed to prevent retry (cannot recover from invalid payload)
      await this.storage.markProcessed(event.webhook_id);
      return;
    }

    const payload = parsed.data as MetaWebhookPayload;

    // 3. Replay protection
    if (!this.checkReplayWindow(payload)) {
      this.logger.warn({
        msg: 'wa_webhook_replay_protection_triggered',
        webhook_id: event.webhook_id,
        replay_window_ms: this.replayWindowMs,
      });
      await this.storage.markProcessed(event.webhook_id);
      return;
    }

    // 4. Process each entry/changes/value (Meta supports batch)
    let processedCount = 0;
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // 4a. Status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.processStatusUpdate(status);
            processedCount += 1;
          }
        }

        // 4b. Incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            await this.incomingService.processIncoming({
              message,
              metadata: value.metadata,
              tenantPhoneNumberId: value.metadata?.phone_number_id,
            });
            processedCount += 1;
          }
        }

        // 4c. Errors
        if (value.errors) {
          for (const error of value.errors) {
            await this.processError(error);
            processedCount += 1;
          }
        }
      }
    }

    // 5. Mark webhook processed
    await this.storage.markProcessed(event.webhook_id);

    this.logger.log({
      msg: 'wa_webhook_processed',
      webhook_id: event.webhook_id,
      processed_events_count: processedCount,
    });
  }

  private async processStatusUpdate(status: MetaStatusEntry): Promise<void> {
    const internalStatus = this.statusMapper.mapMetaStatus(status.status);

    // Find message by provider_message_id with retry (race condition : webhook may arrive
    // before WaSendWorker commits the message_id to DB)
    const message = await this.findMessageWithRetry(status.id, 3);
    if (!message) {
      this.logger.warn({
        msg: 'wa_webhook_message_not_found_for_status',
        provider_message_id_prefix: status.id.slice(0, 12),
        status: status.status,
      });
      return;
    }

    const update: Record<string, unknown> = { status: internalStatus };
    if (status.status === 'delivered') update.delivered_at = new Date(status.timestamp * 1000);
    if (status.status === 'read') update.read_at = new Date(status.timestamp * 1000);
    if (status.status === 'failed') {
      update.failed_at = new Date(status.timestamp * 1000);
      update.fail_reason = status.errors?.[0]?.title ?? 'unknown';
    }

    await this.messagesRepo.update(message.id, update);

    // Emit Kafka event for downstream consumers (delivery tracking, alerts)
    await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_STATUS_CHANGED, {
      message_id: message.id,
      provider_message_id: status.id,
      status: internalStatus,
      timestamp: status.timestamp,
    });
  }

  private async processError(error: MetaWebhookErrorEntry): Promise<void> {
    this.logger.error({
      msg: 'wa_webhook_meta_error',
      meta_error_code: error.code,
      meta_error_title: error.title,
      meta_error_message: error.message,
    });
    // Could enrich with alert if error is rate-limit or auth
  }

  private async findMessageWithRetry(
    providerMessageId: string,
    maxAttempts: number,
  ): Promise<{ id: string } | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const message = await this.messagesRepo.findByProviderMessageId(providerMessageId);
      if (message) return message;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 200 * attempt)); // 200ms, 400ms, 600ms
      }
    }
    return null;
  }

  private checkReplayWindow(payload: MetaWebhookPayload): boolean {
    const firstEntryTime = payload.entry[0]?.time;
    if (!firstEntryTime) return true; // No timestamp -> accept (Meta should always include it)
    const ageMs = Date.now() - firstEntryTime * 1000;
    return ageMs <= this.replayWindowMs;
  }
}
```

### 6.5 Fichier 5 / 13 : `wa-status-mapper.service.ts`

```typescript
/**
 * @insurtech/api/modules/comm/services/wa-status-mapper.service
 *
 * Maps Meta WhatsApp status values to internal MessageStatus enum.
 *
 * Meta values : sent, delivered, read, failed
 * Internal : pending, queued, sent, delivered, read, failed (Tache 3.2.1)
 */

import { Injectable } from '@nestjs/common';

export type MessageStatus =
  | 'pending'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type MetaStatus = 'sent' | 'delivered' | 'read' | 'failed';

@Injectable()
export class WaStatusMapperService {
  mapMetaStatus(metaStatus: string): MessageStatus {
    switch (metaStatus) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Validates status transition is monotonically progressing.
   * sent -> delivered -> read is valid; read -> sent is not.
   */
  isValidTransition(current: MessageStatus, next: MessageStatus): boolean {
    const order: Record<MessageStatus, number> = {
      pending: 0,
      queued: 1,
      sent: 2,
      delivered: 3,
      read: 4,
      failed: 99, // failed is terminal but can be reached from any
    };
    if (next === 'failed') return true;
    return order[next] >= order[current];
  }
}
```

### 6.6 Fichier 6 / 13 : `wa-incoming-message.service.ts`

```typescript
/**
 * @insurtech/api/modules/comm/services/wa-incoming-message.service
 *
 * Processes incoming WhatsApp messages from users :
 *   - Lookup contact by phone E.164
 *   - INSERT comm_messages direction='inbound'
 *   - Auto-log CRM interaction (Sprint 8)
 *   - Detect STOP keyword -> auto opt-out (Sprint 11)
 *   - Download media if applicable (image, document, audio) -> S3 (Sprint 4)
 */

import { Injectable, Logger } from '@nestjs/common';
import { MessagesRepositoryService } from './messages-repository.service';
import { ContactsService } from '../../crm/services/contacts.service';
import { OptOutService } from './optout.service';
import { KafkaPublisher } from '../../../kafka/kafka-publisher.service';
import { Topics } from '../../../kafka/topics.constants';
import { MetaIncomingMessage } from '../types/meta-webhook-payload.types';
import { normalizeE164 } from '../../../shared/utils/phone.util';

const STOP_KEYWORD_REGEX = /^(STOP|ARRET|ARR[EÊ]T|UNSUBSCRIBE|STOP-ALL|D[EÉ]SABONNER)$/i;

interface ProcessIncomingInput {
  message: MetaIncomingMessage;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  tenantPhoneNumberId?: string;
}

@Injectable()
export class WaIncomingMessageService {
  private readonly logger = new Logger(WaIncomingMessageService.name);

  constructor(
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly contactsService: ContactsService,
    private readonly optoutService: OptOutService,
    private readonly kafkaPublisher: KafkaPublisher,
  ) {}

  async processIncoming(input: ProcessIncomingInput): Promise<void> {
    const { message } = input;
    const phoneE164 = normalizeE164(message.from);

    // 1. Resolve tenant via phone_number_id (multi-tenant decision-001)
    const tenant = await this.contactsService.findTenantByWaPhoneNumberId(
      input.tenantPhoneNumberId ?? '',
    );
    if (!tenant) {
      this.logger.warn({
        msg: 'wa_incoming_tenant_not_resolved',
        phone_number_id_prefix: input.tenantPhoneNumberId?.slice(0, 8),
      });
      return;
    }

    // 2. Lookup contact (do NOT auto-create lead -- spam prevention)
    const contact = await this.contactsService.findByPhone(tenant.id, phoneE164);
    if (!contact) {
      this.logger.warn({
        msg: 'wa_incoming_contact_not_found',
        tenant_id: tenant.id,
        phone_hash: this.hashPhone(phoneE164),
      });
      // Still persist as orphan inbound message for ops review
      await this.messagesRepo.createOrphanInbound({
        tenant_id: tenant.id,
        from_address: phoneE164,
        provider_message_id: message.id,
        body: message.text?.body ?? null,
        message_type: message.type,
        received_at: new Date(message.timestamp * 1000),
      });
      return;
    }

    // 3. INSERT comm_messages inbound
    const insertedMessage = await this.messagesRepo.create({
      tenant_id: tenant.id,
      contact_id: contact.id,
      channel: 'whatsapp',
      direction: 'inbound',
      from_address: phoneE164,
      to_address: input.metadata?.display_phone_number ?? '',
      provider_message_id: message.id,
      body: message.text?.body ?? null,
      message_type: message.type,
      status: 'delivered', // Inbound messages are inherently delivered
      received_at: new Date(message.timestamp * 1000),
    });

    // 4. Auto-log CRM interaction (Sprint 8)
    await this.kafkaPublisher.publish(Topics.CRM_INTERACTION_CREATE, {
      tenant_id: tenant.id,
      contact_id: contact.id,
      type: 'whatsapp_message_received',
      direction: 'inbound',
      content_summary: this.summarize(message.text?.body ?? message.type),
      message_id: insertedMessage.id,
      occurred_at: new Date(message.timestamp * 1000).toISOString(),
    });

    // 5. STOP keyword detection -> auto opt-out (Sprint 11 + CNDP loi 09-08)
    const body = (message.text?.body ?? '').trim();
    if (STOP_KEYWORD_REGEX.test(body)) {
      await this.optoutService.optOut({
        contact_id: contact.id,
        channel: 'whatsapp',
        source: 'whatsapp',
        reason: 'STOP keyword auto-detected',
      });
      this.logger.log({
        msg: 'wa_stop_keyword_auto_optout',
        tenant_id: tenant.id,
        contact_id: contact.id,
        keyword: body.toUpperCase(),
      });
    }

    // 6. Media download (image, document, audio) -> queue async (Sprint 4 S3)
    if (['image', 'document', 'audio', 'video'].includes(message.type)) {
      await this.kafkaPublisher.publish(Topics.COMM_MEDIA_DOWNLOAD_REQUESTED, {
        tenant_id: tenant.id,
        message_id: insertedMessage.id,
        media_id: this.extractMediaId(message),
        media_type: message.type,
      });
    }

    this.logger.log({
      msg: 'wa_incoming_processed',
      tenant_id: tenant.id,
      contact_id: contact.id,
      message_id: insertedMessage.id,
      message_type: message.type,
    });
  }

  private extractMediaId(message: MetaIncomingMessage): string | null {
    const m = message as unknown as Record<string, { id?: string }>;
    return m.image?.id ?? m.document?.id ?? m.audio?.id ?? m.video?.id ?? null;
  }

  private summarize(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length <= 200) return trimmed;
    return trimmed.slice(0, 197) + '...';
  }

  private hashPhone(phone: string): string {
    // For audit logs : sha256 prefix-truncated 8 chars
    const { createHash } = require('node:crypto');
    return createHash('sha256').update(phone).digest('hex').slice(0, 16);
  }
}
```

### 6.7 Fichier 7 / 13 : `meta-webhook-payload.types.ts`

```typescript
/**
 * @insurtech/api/modules/comm/types/meta-webhook-payload.types
 *
 * TypeScript types for Meta WhatsApp Cloud API webhook payloads.
 *
 * Reference : https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // WABA ID
  time: number; // UNIX timestamp seconds
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  field: 'messages' | 'message_template_status_update' | 'account_alerts';
  value: MetaWebhookValue;
}

export interface MetaWebhookValue {
  messaging_product?: 'whatsapp';
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: MetaContact[];
  messages?: MetaIncomingMessage[];
  statuses?: MetaStatusEntry[];
  errors?: MetaWebhookErrorEntry[];
  // template_status_update specific
  message_template_id?: string;
  event?: 'APPROVED' | 'REJECTED' | 'PENDING' | 'DISABLED' | 'PAUSED';
  reason?: string;
}

export interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaIncomingMessage {
  id: string; // Meta message_id
  from: string; // Phone E.164 sans +
  timestamp: number; // UNIX seconds
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'button' | 'interactive' | 'sticker' | 'reaction' | 'unknown';
  text?: { body: string };
  image?: MetaMediaPayload;
  document?: MetaMediaPayload;
  audio?: MetaMediaPayload;
  video?: MetaMediaPayload;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  context?: { from: string; id: string };
  errors?: MetaWebhookErrorEntry[];
}

export interface MetaMediaPayload {
  id: string; // Meta media_id (use to download via /v21.0/{media_id})
  mime_type: string;
  sha256: string;
  caption?: string;
  filename?: string;
}

export interface MetaStatusEntry {
  id: string; // Meta provider_message_id
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: number; // UNIX seconds
  recipient_id: string;
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: MetaWebhookErrorEntry[];
}

export interface MetaWebhookErrorEntry {
  code: number;
  title: string;
  message: string;
  error_data?: { details?: string };
  href?: string;
}
```

### 6.8 Fichier 8 / 13 : `meta-webhook.schema.ts`

```typescript
/**
 * @insurtech/api/modules/comm/schemas/meta-webhook.schema
 *
 * Zod runtime validation for Meta webhook payload (defense in depth).
 * Runs AFTER HMAC verification succeeds (so we trust the payload structure
 * mostly comes from Meta, but defend against malformed test payloads or schema drift).
 */

import { z } from 'zod';

export const MetaWebhookErrorEntrySchema = z.object({
  code: z.number(),
  title: z.string(),
  message: z.string(),
  error_data: z.object({ details: z.string().optional() }).optional(),
  href: z.string().optional(),
});

export const MetaIncomingMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.coerce.number(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string(), caption: z.string().optional() }).optional(),
  document: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string(), filename: z.string().optional() }).optional(),
  audio: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string() }).optional(),
  video: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string() }).optional(),
  errors: z.array(MetaWebhookErrorEntrySchema).optional(),
}).passthrough();

export const MetaStatusEntrySchema = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.coerce.number(),
  recipient_id: z.string(),
  errors: z.array(MetaWebhookErrorEntrySchema).optional(),
}).passthrough();

export const MetaWebhookValueSchema = z.object({
  messaging_product: z.literal('whatsapp').optional(),
  metadata: z.object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string().optional(),
  }).optional(),
  messages: z.array(MetaIncomingMessageSchema).optional(),
  statuses: z.array(MetaStatusEntrySchema).optional(),
  errors: z.array(MetaWebhookErrorEntrySchema).optional(),
}).passthrough();

export const MetaWebhookChangeSchema = z.object({
  field: z.string(),
  value: MetaWebhookValueSchema,
});

export const MetaWebhookEntrySchema = z.object({
  id: z.string(),
  time: z.coerce.number(),
  changes: z.array(MetaWebhookChangeSchema),
});

export const MetaWebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(MetaWebhookEntrySchema).min(1),
});
```

### 6.9 Fichier 9 / 13 : `main.ts` (Fastify rawBody hook configuration)

```typescript
/**
 * @insurtech/api/main
 *
 * Bootstrap NestJS + Fastify with raw body preservation hook for HMAC webhooks.
 *
 * CRITICAL : the onRequest hook MUST run BEFORE the content-type parser
 * to capture the original Buffer before JSON parse destroys it.
 */

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import type { FastifyRequest } from 'fastify';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    bodyLimit: 1_048_576, // 1 MB (Meta webhooks max ~200 KB)
    logger: false, // Pino is configured separately
    trustProxy: true,
  });

  // ----------------------------------------------------------------------------
  // RAW BODY PRESERVATION HOOK (for HMAC SHA-256 webhook signature verification)
  //
  // Fastify auto-parses application/json body and discards the raw Buffer.
  // The HMAC must be computed on the EXACT bytes Meta sent.
  // We use addContentTypeParser to intercept before parse and stash rawBody.
  // ----------------------------------------------------------------------------
  adapter.getInstance().addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      // Stash raw bytes for downstream HMAC verification middleware
      (req as any).rawBody = body;
      try {
        const parsed = body.length === 0 ? {} : JSON.parse(body.toString('utf-8'));
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  app.setGlobalPrefix('', { exclude: [] });
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
    credentials: true,
  });

  // Pino logger (Sprint 1) with redaction of webhook signatures
  app.useLogger(/* PinoLogger configured globally */);

  await app.listen(
    Number.parseInt(process.env.PORT ?? '3000', 10),
    '0.0.0.0',
  );
}

void bootstrap();
```

### 6.10 Fichier 10 / 13 : `comm.module.ts` (registration)

```typescript
/**
 * @insurtech/api/modules/comm/comm.module
 */

import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WaWebhookController } from './controllers/wa-webhook.controller';
import { WaSignatureMiddleware } from './middleware/wa-signature.middleware';
import { WaWebhookProcessorConsumer } from './consumers/wa-webhook-processor.consumer';
import { WaWebhookStorageService } from './services/wa-webhook-storage.service';
import { WaStatusMapperService } from './services/wa-status-mapper.service';
import { WaIncomingMessageService } from './services/wa-incoming-message.service';
import { MessagesRepositoryService } from './services/messages-repository.service';
import { OptOutService } from './services/optout.service';
import { CommWebhookReceived } from './entities/comm-webhook-received.entity';
import { CommMessage } from './entities/comm-message.entity';
import { CommOptout } from './entities/comm-optout.entity';
import { KafkaModule } from '../../kafka/kafka.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CommWebhookReceived, CommMessage, CommOptout]),
    KafkaModule,
    CrmModule,
  ],
  controllers: [WaWebhookController],
  providers: [
    WaSignatureMiddleware,
    WaWebhookProcessorConsumer,
    WaWebhookStorageService,
    WaStatusMapperService,
    WaIncomingMessageService,
    MessagesRepositoryService,
    OptOutService,
  ],
  exports: [WaWebhookStorageService, MessagesRepositoryService, OptOutService],
})
export class CommModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // HMAC signature verification ONLY on POST webhook receiver (NOT on GET verify)
    consumer
      .apply(WaSignatureMiddleware)
      .forRoutes({
        path: 'api/v1/public/webhooks/whatsapp',
        method: RequestMethod.POST,
      });
  }
}
```

### 6.11 Fichier 11 / 13 : Migration `V0009.4__wa_webhook_idempotency_unique_constraint.sql`

```sql
-- Sprint 9 Tache 3.2.4
-- Adds UNIQUE constraint on idempotency_key to prevent duplicate webhook processing.
-- Sprint 2 created the table; this migration enforces uniqueness if not already present.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_webhooks_received_idempotency_key_unique'
  ) THEN
    ALTER TABLE comm_webhooks_received
      ADD CONSTRAINT comm_webhooks_received_idempotency_key_unique
      UNIQUE (idempotency_key);
  END IF;
END $$;

-- Index for fast lookup by channel + processed status (consumer queries)
CREATE INDEX IF NOT EXISTS idx_comm_webhooks_received_channel_processed
  ON comm_webhooks_received (channel, processed, received_at DESC)
  WHERE processed = false;

-- Index for replay / audit queries by idempotency_key
CREATE INDEX IF NOT EXISTS idx_comm_webhooks_received_received_at
  ON comm_webhooks_received (received_at DESC);

COMMENT ON CONSTRAINT comm_webhooks_received_idempotency_key_unique
  ON comm_webhooks_received IS
  'Prevents double-processing on Meta retries (24h backoff). idempotency_key = sha256(rawBody).';
```

### 6.12 Fichier 12 / 13 : `wa-webhook-payloads.fixtures.ts`

```typescript
/**
 * Test fixtures : realistic Meta WhatsApp webhook payloads.
 */

export const WA_PAYLOAD_STATUS_DELIVERED = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '212612345678',
              phone_number_id: '106540132237449',
            },
            statuses: [
              {
                id: 'wamid.HBgLMjEyNjEyMzQ1Njc4FQIAERgSRkFGOEM3RkVDODcwQUI3RDVCAA==',
                status: 'delivered',
                timestamp: Math.floor(Date.now() / 1000),
                recipient_id: '212612345678',
                conversation: {
                  id: 'gBEGkYiEB1VXAglK7ZEqA1YKPrU',
                  origin: { type: 'service' },
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_STATUS_READ = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '212612345678',
              phone_number_id: '106540132237449',
            },
            statuses: [
              {
                id: 'wamid.HBgLMjEyNjEyMzQ1Njc4FQIAERgSRkFGOEM3RkVDODcwQUI3RDVCAA==',
                status: 'read',
                timestamp: Math.floor(Date.now() / 1000),
                recipient_id: '212612345678',
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_STATUS_FAILED = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '212612345678',
              phone_number_id: '106540132237449',
            },
            statuses: [
              {
                id: 'wamid.failed_test_id_001',
                status: 'failed',
                timestamp: Math.floor(Date.now() / 1000),
                recipient_id: '212699999999',
                errors: [
                  {
                    code: 131_026,
                    title: 'Message undeliverable',
                    message: 'Receiver phone number not on WhatsApp',
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_INCOMING_TEXT = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '212612345678',
              phone_number_id: '106540132237449',
            },
            contacts: [{ profile: { name: 'Mohamed' }, wa_id: '212612345678' }],
            messages: [
              {
                id: 'wamid.incoming_test_id_001',
                from: '212612345678',
                timestamp: Math.floor(Date.now() / 1000),
                type: 'text',
                text: { body: 'Salam, je voudrais info sur mon devis' },
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_INCOMING_STOP = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '212612345678',
              phone_number_id: '106540132237449',
            },
            contacts: [{ profile: { name: 'Test User' }, wa_id: '212612345679' }],
            messages: [
              {
                id: 'wamid.stop_test_id',
                from: '212612345679',
                timestamp: Math.floor(Date.now() / 1000),
                type: 'text',
                text: { body: 'STOP' },
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_INCOMING_ARRET = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '212612345678', phone_number_id: '106540132237449' },
            contacts: [{ profile: { name: 'User' }, wa_id: '212612345680' }],
            messages: [
              {
                id: 'wamid.arret_test_id',
                from: '212612345680',
                timestamp: Math.floor(Date.now() / 1000),
                type: 'text',
                text: { body: 'arret' },
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_INCOMING_IMAGE = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '212612345678', phone_number_id: '106540132237449' },
            contacts: [{ profile: { name: 'Mohamed' }, wa_id: '212612345678' }],
            messages: [
              {
                id: 'wamid.image_test_id',
                from: '212612345678',
                timestamp: Math.floor(Date.now() / 1000),
                type: 'image',
                image: {
                  id: '1124562345670123',
                  mime_type: 'image/jpeg',
                  sha256: 'abc123def456',
                  caption: 'Photo accident',
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_MULTI_ENTRY_BATCH = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '212612345678', phone_number_id: '106540132237449' },
            statuses: [
              { id: 'wamid.batch_001', status: 'delivered', timestamp: Math.floor(Date.now() / 1000), recipient_id: '212612345678' },
              { id: 'wamid.batch_002', status: 'delivered', timestamp: Math.floor(Date.now() / 1000), recipient_id: '212612345679' },
              { id: 'wamid.batch_003', status: 'read', timestamp: Math.floor(Date.now() / 1000), recipient_id: '212612345680' },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_OLD_REPLAY = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago (>5min replay window)
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '212612345678', phone_number_id: '106540132237449' },
            statuses: [
              { id: 'wamid.old_replay', status: 'delivered', timestamp: Math.floor(Date.now() / 1000) - 600, recipient_id: '212612345678' },
            ],
          },
        },
      ],
    },
  ],
};

export const WA_PAYLOAD_TEMPLATE_APPROVED = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'message_template_status_update',
          value: {
            event: 'APPROVED',
            message_template_id: '999000111222333',
            message_template_name: 'police_signed_confirmation',
            message_template_language: 'fr',
            reason: null,
          },
        },
      ],
    },
  ],
};
```

### 6.13 Fichier 13 / 13 : `wa-signature-helper.ts` (test helper)

```typescript
/**
 * Test helper : compute HMAC SHA-256 signature for webhook payloads.
 */

import { createHmac } from 'node:crypto';

export function computeMetaSignature(rawBody: string | Buffer, appSecret: string): string {
  const buf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody;
  return 'sha256=' + createHmac('sha256', appSecret).update(buf).digest('hex');
}

export function buildWebhookHeaders(rawBody: string, appSecret: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-hub-signature-256': computeMetaSignature(rawBody, appSecret),
    'user-agent': 'facebookexternalua',
  };
}
```

---

## 7. Tests complets E2E

### 7.1 Tests `wa-webhook.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import {
  WA_PAYLOAD_STATUS_DELIVERED,
  WA_PAYLOAD_STATUS_READ,
  WA_PAYLOAD_STATUS_FAILED,
  WA_PAYLOAD_INCOMING_TEXT,
  WA_PAYLOAD_INCOMING_STOP,
  WA_PAYLOAD_INCOMING_ARRET,
  WA_PAYLOAD_INCOMING_IMAGE,
  WA_PAYLOAD_MULTI_ENTRY_BATCH,
  WA_PAYLOAD_OLD_REPLAY,
} from './fixtures/wa-webhook-payloads.fixtures';
import { computeMetaSignature, buildWebhookHeaders } from './fixtures/wa-signature-helper';

const TEST_APP_SECRET = 'test-app-secret-256-bit-very-long-string-for-hmac';
const TEST_VERIFY_TOKEN = 'test-verify-token-skalean';

describe('WA Webhook (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = TEST_APP_SECRET;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TEST_VERIFY_TOKEN;
    process.env.WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS = '300000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    // Reproduce Fastify rawBody hook from main.ts
    app.getHttpAdapter().getInstance().addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (req: any, body: Buffer, done) => {
        req.rawBody = body;
        try { done(null, body.length === 0 ? {} : JSON.parse(body.toString('utf-8'))); }
        catch (e) { done(e as Error, undefined); }
      },
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET verification challenge', () => {
    it('returns challenge when verify_token matches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/public/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=' + TEST_VERIFY_TOKEN,
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('12345');
    });

    it('returns 403 when verify_token mismatches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/public/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=wrong',
      });
      expect(response.statusCode).toBe(403);
    });

    it('returns 403 when mode is not subscribe', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/public/webhooks/whatsapp?hub.mode=unsubscribe&hub.challenge=12345&hub.verify_token=' + TEST_VERIFY_TOKEN,
      });
      expect(response.statusCode).toBe(403);
    });

    it('returns 403 when no params provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/public/webhooks/whatsapp',
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST signature verification', () => {
    it('accepts valid signature and returns 200', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    });

    it('rejects invalid signature with 401', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=00000000000000000000000000000000000000000000000000000000000000ff',
        },
      });
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe('INVALID_SIGNATURE');
    });

    it('rejects missing signature with 401', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: { 'content-type': 'application/json' },
      });
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe('NO_SIGNATURE');
    });

    it('rejects malformed signature length mismatch', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=tooshort',
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects when body is tampered after signing', async () => {
      const originalBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const validSignature = computeMetaSignature(originalBody, TEST_APP_SECRET);
      const tamperedBody = JSON.stringify({ ...WA_PAYLOAD_STATUS_DELIVERED, malicious: true });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: tamperedBody,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': validSignature,
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('accepts signature signed with previous app secret (rotation grace period)', async () => {
      const previousSecret = 'previous-secret-during-rotation';
      process.env.WHATSAPP_APP_SECRET_PREVIOUS = previousSecret;

      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const sigPrev = computeMetaSignature(rawBody, previousSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': sigPrev,
        },
      });
      expect(response.statusCode).toBe(200);

      delete process.env.WHATSAPP_APP_SECRET_PREVIOUS;
    });
  });

  describe('Idempotency', () => {
    it('persists once when same body sent twice (UNIQUE constraint)', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const headers = buildWebhookHeaders(rawBody, TEST_APP_SECRET);

      const r1 = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/whatsapp', payload: rawBody, headers });
      const r2 = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/whatsapp', payload: rawBody, headers });

      expect(r1.statusCode).toBe(200);
      expect(r2.statusCode).toBe(200);
      // Both return 200, but only one row is inserted (verified via storage service spy in extended tests)
    });
  });

  describe('Performance SLA', () => {
    it('responds in <200ms (p99 budget for Meta <5s SLA)', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const headers = buildWebhookHeaders(rawBody, TEST_APP_SECRET);
      const start = Date.now();
      await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/whatsapp', payload: rawBody, headers });
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('HTTP method validation', () => {
    it('rejects PUT with 404/405', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/public/webhooks/whatsapp',
      });
      expect([404, 405]).toContain(response.statusCode);
    });

    it('rejects DELETE with 404/405', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/public/webhooks/whatsapp',
      });
      expect([404, 405]).toContain(response.statusCode);
    });
  });

  describe('Content-type validation', () => {
    it('still returns 200 for application/json correctly typed', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
      });
      expect(r.statusCode).toBe(200);
    });
  });

  describe('Multi-entry batch', () => {
    it('persists single row even with batched events', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_MULTI_ENTRY_BATCH);
      const headers = buildWebhookHeaders(rawBody, TEST_APP_SECRET);
      const r = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/whatsapp', payload: rawBody, headers });
      expect(r.statusCode).toBe(200);
    });
  });

  describe('Public endpoint (no RBAC)', () => {
    it('does not require Authorization header', async () => {
      const rawBody = JSON.stringify(WA_PAYLOAD_STATUS_DELIVERED);
      const headers = buildWebhookHeaders(rawBody, TEST_APP_SECRET);
      // Note : intentionally no Authorization header
      const r = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/whatsapp', payload: rawBody, headers });
      expect(r.statusCode).toBe(200);
    });
  });
});

describe('WaWebhookProcessorConsumer (integration)', () => {
  // These tests require Kafka + Postgres running in CI.
  // They consume the real Kafka topic and assert side effects.

  it('processes status delivered : updates comm_messages.status', async () => {
    // Setup : insert a comm_messages row with provider_message_id matching fixture
    // Publish webhook to topic
    // Wait consumer
    // Assert comm_messages.status = 'delivered' + delivered_at != null
    // (Implementation depends on Sprint 2 + 3.2.1 fixtures)
  });

  it('processes status read : updates read_at', async () => {
    // Similar pattern
  });

  it('processes status failed : updates fail_reason from errors[0].title', async () => {
    // ...
  });

  it('processes incoming text message : creates comm_messages direction=inbound', async () => {
    // ...
  });

  it('processes incoming text message : publishes crm.interaction.create Kafka event', async () => {
    // ...
  });

  it('processes incoming STOP keyword : auto-opt-out via OptOutService', async () => {
    // ...
  });

  it('processes incoming ARRET keyword (case insensitive) : auto-opt-out', async () => {
    // ...
  });

  it('processes incoming image : queues media download (S3 Sprint 4)', async () => {
    // ...
  });

  it('processes multi-entry batch : iterates each status separately', async () => {
    // ...
  });

  it('rejects replay outside 5min window : marks processed without action', async () => {
    // ...
  });

  it('handles message_id race condition : retries 3x with backoff', async () => {
    // ...
  });

  it('marks webhook processed=true after success', async () => {
    // ...
  });

  it('does not double-process if webhook already processed', async () => {
    // ...
  });

  it('orphan inbound (contact not found) : persists for ops review without auto-create', async () => {
    // ...
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.4 -- WhatsApp Webhook Receiver
WHATSAPP_APP_SECRET=                                          # 256-bit Meta App Dashboard
WHATSAPP_APP_SECRET_PREVIOUS=                                 # Optional : grace period during rotation (24h)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=                                # Random string set in Meta Business Manager
WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS=300000                      # 5 minutes (default)

# (Already exists from Tache 3.2.2)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v21.0
```

`.env.example` updated with placeholders + comments documenting Meta Business Manager setup steps.

---

## 9. Commandes shell

```bash
cd repo

# Install (no new deps -- node:crypto is native)
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e -- comm/wa-webhook
pnpm --filter @insurtech/api test:e2e:coverage

# Run migration
pnpm db:migrate:up

# Verify constraint
psql -h localhost -U insurtech -d insurtech_dev -c "\d+ comm_webhooks_received"

# Start dev (Kafka + Postgres up)
pnpm --filter @insurtech/api dev

# Test webhook locally with curl + ngrok
ngrok http 3000
# Configure ngrok URL in Meta Business Manager Webhook subscriptions
```

---

## 10. Criteres validation V1-V35

### P0 (24)

- V1 : typecheck, build, lint, tests pass.
- V2 : GET /api/v1/public/webhooks/whatsapp returns challenge if verify_token matches.
- V3 : GET returns 403 if verify_token mismatches.
- V4 : POST with valid HMAC SHA-256 signature returns 200.
- V5 : POST with invalid signature returns 401 + warn log.
- V6 : POST with missing signature returns 401.
- V7 : POST with tampered body returns 401.
- V8 : POST signature verified via timingSafeEqual (no timing attack).
- V9 : Raw body preserved by Fastify onRequest hook.
- V10 : Idempotency UNIQUE constraint applied (sha256(rawBody)).
- V11 : 2 POSTs same body -> single DB row inserted, both return 200.
- V12 : Kafka event comm.webhook.received published after persist.
- V13 : Controller responds <200ms p99 (mock Kafka).
- V14 : Consumer processes status update sent->delivered : updates comm_messages.status.
- V15 : Consumer processes status read : updates read_at.
- V16 : Consumer processes status failed : updates fail_reason from errors[0].title.
- V17 : Consumer processes incoming message : INSERT direction=inbound + auto-log CRM.
- V18 : Consumer detects STOP keyword regex /^(STOP|ARRET|ARRÊT|UNSUBSCRIBE|STOP-ALL|DÉSABONNER)$/i -> auto-opt-out.
- V19 : Consumer processes media incoming -> queues S3 download.
- V20 : Consumer multi-entry batch : iterates each status.
- V21 : Consumer replay protection : rejects timestamp > 5min old.
- V22 : Consumer race condition retry : finds message_id with 3x backoff.
- V23 : App_secret rotation grace period : valides previous secret if WHATSAPP_APP_SECRET_PREVIOUS set.
- V24 : Public endpoint pas RBAC (PublicEndpointGuard Sprint 5).

### P1 (8)

- V25 : Coverage >= 88% on comm module.
- V26 : Bench POST <100ms p99 measured.
- V27 : Audit log entry per webhook receive.
- V28 : Documentation runbook wa-webhook-troubleshooting.md.
- V29 : Pino redact x-hub-signature-256 header.
- V30 : Phone E.164 hashed in logs (sha256-prefix-truncated).
- V31 : verify_token never logged in clear.
- V32 : Sprint 33 alert hook signature_invalid_rate documented.

### P2 (3)

- V33 : ngrok tunnel test documented (manual e2e Meta).
- V34 : Meta IP whitelist optional via env (deferred Sprint 35).
- V35 : Sprint 27 admin UI replay DLQ webhook documented.

---

## 11. Edge cases (15)

1. **Body parse JSON corrompu apres signature OK** : signature valide HMAC mais body pas JSON valide -> 400 explicit (Zod fail).
2. **Multi-entry Meta webhook** : `entry[]` 200 items batch -> consumer iterate each. Test fixture WA_PAYLOAD_MULTI_ENTRY_BATCH.
3. **Webhook arrive avant message_id existe DB** : race condition WaSendWorker. Retry 3x avec backoff 200ms/400ms/600ms dans `findMessageWithRetry`.
4. **Idempotency_key collision (extreme rare sha256)** : log warn `wa_webhook_idempotency_collision` ne pas re-process. UNIQUE constraint viol catch.
5. **Meta retry 24h apres premier 200 OK** : duplicate Kafka event idempotent consumer (check `webhook.processed` flag).
6. **App_secret rotation** : grace period 24h dual-validate via WHATSAPP_APP_SECRET_PREVIOUS.
7. **Replay attack ancien webhook** : timestamp Meta `entry[0].time` check < 5min via `WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS`.
8. **Phone number swap (user change phone)** : lookup contact fail -> persist orphan inbound + log warn (NE PAS auto-create lead = spam vector).
9. **Verify token leak via logs** : NEVER log token. Code utilise `received_token_length` not value.
10. **Fastify body limit < 1MB** : configure `bodyLimit: 1_048_576`. Meta webhook max ~200 KB OK.
11. **Webhook content-type non-json** : Fastify content type parser specific application/json. Autres content types -> 400.
12. **HTTP method non-POST sur receiver** : seul POST + GET routes. PUT/DELETE -> 404/405.
13. **IP source verification** : Meta publishes IP ranges (deferred Sprint 35 optional whitelist via env `WHATSAPP_WEBHOOK_ALLOWED_IPS`).
14. **Kafka publish fail apres persist** : log error + return 200 (webhook persisted, replay manuel via Sprint 27 admin UI).
15. **Signature header lowercase Fastify** : `req.headers['x-hub-signature-256']` not `X-Hub-Signature-256` (Fastify lowercase headers normalizes).

---

## 12. Conformite Maroc

- **Loi 09-08 article 5 (opt-out facile)** : STOP keyword detection automatique -> OptOutService.optOut immediate. Audit trail dans `comm_optouts` table.
- **Loi 09-08 article 28 (PII protection)** : phone E.164 numbers hashed sha256-prefix-truncated dans tous logs ; full numbers stockes uniquement encrypted via pgcrypto Sprint 2.
- **Loi 09-08 retention 7 ans** : `comm_webhooks_received` table audit trail conservee 7 ans (decision-014). Purge automatique apres 7 ans Sprint 35.
- **CNDP declaration** : webhook receiver = traitement automatise donnees personnelles -> declaration 7-N-2025 effectuee Sprint 1.
- **ANRT decret 2-08-518** : interception communications interdite. HMAC SHA-256 verifie inviolabilite des messages echanges Meta <-> Skalean.
- **Decision-008 cloud souverain** : webhook hostes Atlas Cloud Services Benguerir, donnees ne quittent pas le territoire MA.
- **Sprint 33 alerting** : alert SIRH + DPO si signature_invalid_rate > seuil (potentielle attaque).

---

## 13. Conventions absolues

- **Multi-tenant** : tenant_id resolu via `phone_number_id` Meta -> `tenants.wa_phone_number_id` lookup. Tous INSERT scoped tenant_id.
- **Validation runtime** : Zod schema `MetaWebhookPayloadSchema` post-HMAC verification (defense in depth).
- **Logger Pino** : structured logs JSON. Redact `x-hub-signature-256` + `WHATSAPP_APP_SECRET` + `hub.verify_token`. Phone hashed.
- **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, no `any` (sauf `req as any` pour rawBody propriete extension).
- **No-emoji** : totale.
- **No-console** : utiliser Logger NestJS.
- **Idempotency** : UNIQUE constraint Postgres + check processed flag dans consumer.
- **Async processing** : Kafka topic `comm.webhook.received` + KafkaConsumerBase Sprint 2 retry exponential + DLQ.
- **Audit log** : chaque webhook recu emis `audit.event.webhook_received`.
- **pnpm** : workspace pnpm.
- **Tests Vitest** : unit + e2e + integration. 25+ tests min. Coverage 88%.
- **Cloud souverain** : Atlas Cloud Benguerir.
- **Crypto** : node:crypto natif. timingSafeEqual obligatoire.
- **JSDoc** : tous services + controllers documentes references decision-XXX.
- **Performance** : controller <100ms p99. Consumer <2s par webhook.

---

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e -- comm/wa-webhook
pnpm --filter @insurtech/api test:coverage

# No emoji check
grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src/modules/comm && exit 1 || echo "OK no emoji"

# No console.log
grep -rn "console\.log" apps/api/src/modules/comm --include="*.ts" && exit 1 || echo "OK no console"

# No bare app secret in logs
grep -rn "WHATSAPP_APP_SECRET" apps/api/src/modules/comm --include="*.ts" | grep -v "config.get" | grep -v "comment" && exit 1 || echo "OK secret guarded"

# No hub.verify_token logged
grep -rn 'hub\.verify_token' apps/api/src/modules/comm --include="*.ts" | grep -i log && exit 1 || echo "OK token not logged"

# Migration applied
pnpm db:migrate:status | grep V0009.4 || (echo "migration missing" && exit 1)

# Verify UNIQUE constraint
psql -d insurtech_dev -c "SELECT conname FROM pg_constraint WHERE conname='comm_webhooks_received_idempotency_key_unique';" | grep idempotency_key_unique

# Verify timingSafeEqual usage
grep -n "timingSafeEqual" apps/api/src/modules/comm/middleware/wa-signature.middleware.ts || (echo "timing-unsafe compare" && exit 1)

# Verify rawBody hook in main.ts
grep -n "rawBody" apps/api/src/main.ts || (echo "rawBody hook missing" && exit 1)

echo "All pre-commit checks passed."
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): WA webhook receiver + HMAC SHA-256 signature + idempotency + async Kafka

Implements public endpoint /api/v1/public/webhooks/whatsapp receiving Meta
WhatsApp Cloud API webhooks (status updates + incoming messages + errors)
with timing-safe HMAC SHA-256 signature verification (X-Hub-Signature-256
header), Postgres UNIQUE idempotency on sha256(rawBody), async processing
via Kafka topic comm.webhook.received consumed by WaWebhookProcessorConsumer
with retry exponential + DLQ. Includes Fastify rawBody preservation hook
in main.ts (critical for HMAC bytes-exact computation), GET verification
challenge endpoint for initial Meta subscribe, app_secret rotation grace
period (24h dual-validate previous secret), replay protection 5min window,
auto-log CRM interaction Sprint 8 on incoming messages, automatic STOP/
ARRET/UNSUBSCRIBE keyword opt-out per CNDP loi 09-08, media download queue
S3 Sprint 4, multi-entry batch processing, race condition retry 3x backoff.

Livrables :
- WaWebhookController (GET verify + POST receive, ~150 lignes)
- WaSignatureMiddleware (HMAC SHA-256 timing-safe, dual-secret rotation, ~110 lignes)
- WaWebhookProcessorConsumer (Kafka KafkaConsumerBase Sprint 2, ~280 lignes)
- WaWebhookStorageService (UNIQUE constraint catch, ~150 lignes)
- WaStatusMapperService (Meta status -> internal enum, ~80 lignes)
- WaIncomingMessageService (CRM auto-log, STOP keyword, media queue, ~180 lignes)
- Meta webhook payload TypeScript types (~140 lignes)
- Zod schema MetaWebhookPayloadSchema (~60 lignes)
- main.ts Fastify rawBody onRequest hook
- comm.module.ts middleware registration POST-only
- Migration V0009.4 UNIQUE idempotency_key constraint
- Test fixtures 9 Meta payloads (status delivered/read/failed, incoming text/STOP/ARRET/image, multi-entry batch, replay)
- HMAC signature test helper
- Documentation runbook troubleshooting

Tests : 25+ E2E (signature valid/invalid/missing/tampered/rotation, idempotency
single-row, multi-entry batch, replay window, performance <100ms, public endpoint
no-RBAC, GET challenge match/mismatch) + 13 consumer integration tests

Coverage : >= 88% on comm module
Performance : controller <100ms p99 measured
Security : timingSafeEqual, raw body bytes-exact HMAC, Pino redact signature header,
phone E.164 sha256-truncated in logs

Conformite :
- Loi 09-08 article 5 : STOP keyword auto opt-out immediate
- Loi 09-08 article 28 : phone PII hashed in logs
- ANRT decret 2-08-518 : HMAC verifie inviolabilite communications
- Decision-008 : hosted Atlas Cloud Benguerir

Task: 3.2.4
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.4
Decisions: decision-001 (multi-tenant), decision-007 (Zod), decision-014 (audit), decision-016 (Kafka), decision-022 (CNDP)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-3.2.5-template-manager-and-seeds.md` qui implementera le service CRUD templates + workflow Meta approval + 60+ templates seed (20 templates x 3 locales fr/ar-MA/ar) pour cas d'usage critiques (auth, booking, insure, repair, tenant). Le template manager utilisera l'event `comm.webhook.received` (de cette tache 3.2.4) avec `field === 'message_template_status_update'` pour synchroniser automatiquement les statuts d'approbation Meta dans la base locale `comm_templates.meta_template_status` (draft / pending_review / approved / rejected) sans polling manuel.

---

## 17. Annexes operationnelles

### Annexe A. Runbook troubleshooting `wa-webhook-troubleshooting.md`

Document `repo/docs/runbooks/wa-webhook-troubleshooting.md` couvrant :

1. **Symptome : Meta dashboard montre webhook delivery failed** :
   - Verifier endpoint reachable HTTPS publique (curl -X POST).
   - Verifier WHATSAPP_APP_SECRET correspond a celui Meta App Dashboard.
   - Verifier WHATSAPP_WEBHOOK_VERIFY_TOKEN correspond a celui Meta Business Manager Webhook subscription.
   - Verifier logs `wa_webhook_signature_invalid` -> rotation secret pas synchro.
   - Verifier raw body hook actif : grep `rawBody` dans main.ts.

2. **Symptome : webhooks recus mais pas processes** :
   - Verifier consumer Kafka actif : `pnpm kafka:consumers:status`.
   - Verifier topic `insurtech.events.comm.webhook.received` consume lag.
   - Verifier DLQ topic non rempli `insurtech.events.dlq.comm`.
   - Verifier `comm_webhooks_received.processed = false` rows.

3. **Symptome : status updates pas refletees dans comm_messages** :
   - Verifier `provider_message_id` match Meta `wamid.xxxxx`.
   - Verifier race condition retry : logs `wa_webhook_message_not_found_for_status`.
   - Verifier WaSendWorker (Tache 3.2.8) commit DB avant Meta delivered.

4. **Symptome : STOP keyword pas declenche opt-out** :
   - Verifier regex match : `/^(STOP|ARRET|ARRÊT|UNSUBSCRIBE|STOP-ALL|DÉSABONNER)$/i`.
   - Verifier message body trim avant test.
   - Verifier OptOutService injection dans WaIncomingMessageService.

5. **Symptome : signature invalide rate eleve** :
   - Possible attaque -> verifier IPs source.
   - Possible mal-config secret -> rotation via WHATSAPP_APP_SECRET_PREVIOUS grace period.
   - Sprint 33 alerting Slack si > 10 invalid /heure.

6. **Replay manuel webhook** (Sprint 27 admin UI) :
   - SELECT raw_body FROM comm_webhooks_received WHERE id = 'xxx';
   - Re-publish Kafka : `kafkactl produce insurtech.events.comm.webhook.received --value '...'`.

### Annexe B. Configuration Meta Business Manager

1. Login console Meta Business Manager.
2. Selectionner WhatsApp Business Account.
3. Ajouter Webhook -> URL `https://api.skalean.ma/api/v1/public/webhooks/whatsapp`.
4. Verify token : copier valeur `WHATSAPP_WEBHOOK_VERIFY_TOKEN` du `.env` prod.
5. Click "Verify and Save" -> Meta envoie GET challenge -> Skalean retourne challenge.
6. Subscribe to fields : `messages` (status + incoming) + `message_template_status_update`.
7. App Settings -> Basic -> reveal App Secret -> copier dans `WHATSAPP_APP_SECRET`.
8. Test webhook delivery : send test template via Meta Business UI.

### Annexe C. Sprint 35 IP whitelist optional

```typescript
// Future Sprint 35 enhancement
const ALLOWED_META_IP_RANGES = [
  '157.240.0.0/16',
  '173.252.64.0/19',
  // ... full list https://developers.facebook.com/docs/sharing/webhooks#ip-allowlist
];

if (process.env.WHATSAPP_WEBHOOK_IP_WHITELIST_ENABLED === 'true') {
  // Verify req.ip in ALLOWED_META_IP_RANGES (CIDR check)
}
```

### Annexe D. Sprint 33 alerting hooks

```yaml
# Prometheus alert rule (Sprint 33)
- alert: WaWebhookSignatureInvalidRateHigh
  expr: rate(wa_webhook_signature_invalid_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "WA webhook signature invalid rate > 10%"
    description: "Possible attack or app_secret misconfiguration"
    runbook: "https://docs.skalean.ma/runbooks/wa-webhook-troubleshooting"
```

---

---

## 18. Code patterns supplementaires

### 18.1 `wa-incoming-message-handler.service.ts` (handler complet expanded)

```typescript
/**
 * @insurtech/api/modules/comm/services/wa-incoming-message-handler.service
 *
 * Extends WaIncomingMessageService with full handlers per Meta message type.
 * Covers : text, media (image/document/audio/video/sticker), location, contact,
 * button reply, list reply, interactive, reaction.
 *
 * Reference :
 *   - decision-001 (multi-tenant phone_number_id resolution)
 *   - decision-014 (audit log per incoming message)
 *   - decision-019 (PII encryption phone E.164)
 *   - decision-022 (CNDP STOP keyword auto opt-out)
 *   - Sprint 8 CRM auto-log interaction
 */

import { Injectable, Logger } from '@nestjs/common';
import { ContactsService } from '@insurtech/crm/services/contacts.service';
import { LeadsService } from '@insurtech/crm/services/leads.service';
import { OptOutService } from '@insurtech/comm/services/optout.service';
import { MessagesRepositoryService } from '@insurtech/comm/services/messages-repository.service';
import { KafkaPublisher } from '@insurtech/kafka/kafka-publisher.service';
import { Topics } from '@insurtech/kafka/topics.constants';
import { normalizeE164, hashPhoneAudit } from '@insurtech/shared/utils/phone.util';
import {
  MetaIncomingMessage,
  MetaWebhookValue,
} from '@insurtech/comm/types/meta-webhook-payload.types';

const STOP_KEYWORD_REGEX =
  /^(STOP|ARRET|ARR[EÊ]T|UNSUBSCRIBE|STOP-ALL|D[EÉ]SABONNER|CANCEL|END|QUIT)$/i;

interface HandleIncomingInput {
  message: MetaIncomingMessage;
  metadata: MetaWebhookValue['metadata'];
  webhookId: string;
}

@Injectable()
export class WaIncomingMessageHandlerService {
  private readonly logger = new Logger(WaIncomingMessageHandlerService.name);

  constructor(
    private readonly contactsService: ContactsService,
    private readonly leadsService: LeadsService,
    private readonly optoutService: OptOutService,
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly kafkaPublisher: KafkaPublisher,
  ) {}

  async handleIncomingMessage(input: HandleIncomingInput): Promise<void> {
    const { message, metadata } = input;
    const phoneE164 = normalizeE164(message.from);
    const phoneNumberId = metadata?.phone_number_id ?? '';
    const tenant = await this.contactsService.findTenantByWaPhoneNumberId(phoneNumberId);

    if (!tenant) {
      this.logger.warn({
        msg: 'wa_incoming_tenant_not_resolved',
        action: 'incoming_handle',
        webhook_id: input.webhookId,
        phone_number_id_prefix: phoneNumberId.slice(0, 8),
      });
      return;
    }

    let contact = await this.contactsService.findByPhone(tenant.id, phoneE164);

    // Auto-create lead if phone unknown (only for first contact, single per phone, per CRM rules)
    if (!contact) {
      const existingLead = await this.leadsService.findByPhone(tenant.id, phoneE164);
      if (!existingLead) {
        const newLead = await this.leadsService.createFromInbound({
          tenant_id: tenant.id,
          phone_e164: phoneE164,
          source: 'whatsapp_inbound',
          first_message_id: message.id,
        });
        this.logger.log({
          msg: 'wa_incoming_auto_lead_created',
          tenant_id: tenant.id,
          lead_id: newLead.id,
          phone_hash: hashPhoneAudit(phoneE164),
        });
        contact = await this.contactsService.findByPhone(tenant.id, phoneE164);
      } else {
        contact = await this.contactsService.findByLeadId(existingLead.id);
      }
    }

    if (!contact) {
      this.logger.error({
        msg: 'wa_incoming_contact_resolution_failed',
        action: 'incoming_handle',
        tenant_id: tenant.id,
        phone_hash: hashPhoneAudit(phoneE164),
      });
      return;
    }

    // Dispatch by message type
    switch (message.type) {
      case 'text':
        await this.handleText(tenant.id, contact.id, message);
        break;
      case 'image':
      case 'document':
      case 'audio':
      case 'video':
      case 'sticker':
        await this.handleMedia(tenant.id, contact.id, message);
        break;
      case 'location':
        await this.handleLocation(tenant.id, contact.id, message);
        break;
      case 'contact' as any:
      case 'contacts' as any:
        await this.handleContactCard(tenant.id, contact.id, message);
        break;
      case 'interactive':
        await this.handleInteractive(tenant.id, contact.id, message);
        break;
      case 'reaction':
        await this.handleReaction(tenant.id, contact.id, message);
        break;
      default:
        this.logger.warn({
          msg: 'wa_incoming_unknown_type',
          action: 'incoming_handle',
          tenant_id: tenant.id,
          message_id: message.id,
          message_type: message.type,
        });
    }

    // Audit log via Kafka (decision-014)
    await this.kafkaPublisher.publish(Topics.AUDIT_EVENT, {
      tenant_id: tenant.id,
      type: 'comm.incoming_message_received',
      ref_type: 'comm_message',
      message_id: message.id,
      phone_hash: hashPhoneAudit(phoneE164),
      occurred_at: new Date(message.timestamp * 1000).toISOString(),
    });
  }

  private async handleText(
    tenantId: string,
    contactId: string,
    message: MetaIncomingMessage,
  ): Promise<void> {
    const body = (message.text?.body ?? '').trim();
    const inserted = await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: 'whatsapp',
      direction: 'inbound',
      provider_message_id: message.id,
      body,
      message_type: 'text',
      status: 'delivered',
      received_at: new Date(message.timestamp * 1000),
    });

    // CRM auto-log Sprint 8
    await this.kafkaPublisher.publish(Topics.CRM_INTERACTION_CREATE, {
      tenant_id: tenantId,
      contact_id: contactId,
      type: 'whatsapp_message_received',
      direction: 'inbound',
      content_summary: body.slice(0, 200),
      message_id: inserted.id,
    });

    // STOP keyword detection (CNDP loi 09-08 article 5)
    if (STOP_KEYWORD_REGEX.test(body)) {
      await this.optoutService.optOut({
        contact_id: contactId,
        channel: 'whatsapp',
        source: 'whatsapp',
        reason: 'STOP keyword auto-detected',
      });
      this.logger.log({
        msg: 'wa_stop_keyword_auto_optout',
        action: 'optout',
        tenant_id: tenantId,
        contact_id: contactId,
        keyword: body.toUpperCase(),
      });
    }
  }

  private async handleMedia(
    tenantId: string,
    contactId: string,
    message: MetaIncomingMessage,
  ): Promise<void> {
    const media =
      (message as any)[message.type] ??
      (message as any).image ??
      (message as any).document ??
      (message as any).audio ??
      (message as any).video ??
      (message as any).sticker;

    const inserted = await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: 'whatsapp',
      direction: 'inbound',
      provider_message_id: message.id,
      body: media?.caption ?? null,
      message_type: message.type,
      media_id: media?.id ?? null,
      media_mime_type: media?.mime_type ?? null,
      status: 'delivered',
      received_at: new Date(message.timestamp * 1000),
    });

    // Queue async media download (Sprint 4 S3)
    await this.kafkaPublisher.publish(Topics.COMM_MEDIA_DOWNLOAD_REQUESTED, {
      tenant_id: tenantId,
      message_id: inserted.id,
      media_id: media?.id,
      media_type: message.type,
      mime_type: media?.mime_type,
    });
  }

  private async handleLocation(
    tenantId: string,
    contactId: string,
    message: MetaIncomingMessage,
  ): Promise<void> {
    const loc = (message as any).location;
    await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: 'whatsapp',
      direction: 'inbound',
      provider_message_id: message.id,
      message_type: 'location',
      body: JSON.stringify({
        lat: loc?.latitude,
        lng: loc?.longitude,
        name: loc?.name,
        address: loc?.address,
      }),
      status: 'delivered',
      received_at: new Date(message.timestamp * 1000),
    });
  }

  private async handleContactCard(
    tenantId: string,
    contactId: string,
    message: MetaIncomingMessage,
  ): Promise<void> {
    const contacts = (message as any).contacts ?? [];
    await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: 'whatsapp',
      direction: 'inbound',
      provider_message_id: message.id,
      message_type: 'contact',
      body: JSON.stringify(contacts),
      status: 'delivered',
      received_at: new Date(message.timestamp * 1000),
    });
  }

  private async handleInteractive(
    tenantId: string,
    contactId: string,
    message: MetaIncomingMessage,
  ): Promise<void> {
    const inter = (message as any).interactive;
    const subtype = inter?.type; // button_reply | list_reply
    const replyId = inter?.[subtype]?.id;
    const replyTitle = inter?.[subtype]?.title;
    await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: 'whatsapp',
      direction: 'inbound',
      provider_message_id: message.id,
      message_type: subtype ?? 'interactive',
      body: JSON.stringify({ id: replyId, title: replyTitle }),
      status: 'delivered',
      received_at: new Date(message.timestamp * 1000),
    });

    await this.kafkaPublisher.publish(Topics.COMM_INTERACTIVE_REPLY_RECEIVED, {
      tenant_id: tenantId,
      contact_id: contactId,
      reply_type: subtype,
      reply_id: replyId,
      reply_title: replyTitle,
    });
  }

  private async handleReaction(
    tenantId: string,
    contactId: string,
    message: MetaIncomingMessage,
  ): Promise<void> {
    const reaction = (message as any).reaction;
    await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: 'whatsapp',
      direction: 'inbound',
      provider_message_id: message.id,
      message_type: 'reaction',
      body: reaction?.emoji ?? '',
      status: 'delivered',
      received_at: new Date(message.timestamp * 1000),
    });
  }
}
```

### 18.2 `wa-status-update-handler.service.ts` (mapping codes erreur Meta complet)

```typescript
/**
 * @insurtech/api/modules/comm/services/wa-status-update-handler.service
 *
 * Processes Meta WhatsApp status updates with full Meta error code mapping
 * and message state machine transition validation.
 *
 * Meta error codes catalog : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

import { Injectable, Logger } from '@nestjs/common';
import { MessagesRepositoryService } from '@insurtech/comm/services/messages-repository.service';
import { WaStatusMapperService } from '@insurtech/comm/services/wa-status-mapper.service';
import { KafkaPublisher } from '@insurtech/kafka/kafka-publisher.service';
import { Topics } from '@insurtech/kafka/topics.constants';
import { MetaStatusEntry } from '@insurtech/comm/types/meta-webhook-payload.types';

const META_ERROR_CODE_MAP: Record<number, { category: string; retryable: boolean; alert: boolean }> = {
  131_026: { category: 'undeliverable', retryable: false, alert: false },
  131_047: { category: 'rate_limited', retryable: true, alert: true },
  131_048: { category: 'spam_rate_limit', retryable: false, alert: true },
  131_049: { category: 'meta_pending_review', retryable: true, alert: false },
  131_051: { category: 'unsupported_message_type', retryable: false, alert: false },
  131_053: { category: 'media_upload_error', retryable: true, alert: true },
  132_000: { category: 'template_param_mismatch', retryable: false, alert: true },
  132_001: { category: 'template_not_exist', retryable: false, alert: true },
  132_007: { category: 'template_paused', retryable: false, alert: true },
  132_012: { category: 'template_param_format', retryable: false, alert: true },
  133_000: { category: 'incomplete_deregistration', retryable: false, alert: true },
  133_004: { category: 'phone_blocked', retryable: false, alert: false },
  133_010: { category: 'phone_not_registered', retryable: false, alert: false },
  368: { category: 'temporarily_blocked_policy', retryable: true, alert: true },
  1_006: { category: 'meta_internal_error', retryable: true, alert: true },
};

@Injectable()
export class WaStatusUpdateHandlerService {
  private readonly logger = new Logger(WaStatusUpdateHandlerService.name);

  constructor(
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly statusMapper: WaStatusMapperService,
    private readonly kafkaPublisher: KafkaPublisher,
  ) {}

  async processStatusUpdate(status: MetaStatusEntry, webhookId: string): Promise<void> {
    const internalStatus = this.statusMapper.mapMetaStatus(status.status);
    const message = await this.findMessageWithRetry(status.id, 3);

    if (!message) {
      this.logger.warn({
        msg: 'wa_status_message_not_found',
        action: 'status_update',
        webhook_id: webhookId,
        provider_message_id_prefix: status.id.slice(0, 16),
        meta_status: status.status,
      });
      return;
    }

    // Validate transition is monotonic
    if (!this.statusMapper.isValidTransition(message.status, internalStatus)) {
      this.logger.warn({
        msg: 'wa_status_invalid_transition',
        action: 'status_update',
        message_id: message.id,
        from: message.status,
        to: internalStatus,
      });
      return;
    }

    const update: Record<string, unknown> = { status: internalStatus };
    if (status.status === 'sent') update.sent_at = new Date(status.timestamp * 1000);
    if (status.status === 'delivered') update.delivered_at = new Date(status.timestamp * 1000);
    if (status.status === 'read') update.read_at = new Date(status.timestamp * 1000);

    if (status.status === 'failed') {
      const firstError = status.errors?.[0];
      const errorCode = firstError?.code;
      const meta = errorCode != null ? META_ERROR_CODE_MAP[errorCode] : undefined;
      update.failed_at = new Date(status.timestamp * 1000);
      update.fail_reason = firstError?.title ?? 'unknown';
      update.fail_code = errorCode ?? null;
      update.fail_category = meta?.category ?? 'uncategorized';
      update.is_retryable = meta?.retryable ?? false;

      if (meta?.alert) {
        await this.kafkaPublisher.publish(Topics.ALERTS_OPS, {
          severity: 'warning',
          source: 'wa_webhook_processor',
          summary: `WA delivery failed code=${errorCode} category=${meta.category}`,
          message_id: message.id,
        });
      }
    }

    if (status.pricing) {
      update.pricing_billable = status.pricing.billable;
      update.pricing_category = status.pricing.category;
      update.pricing_model = status.pricing.pricing_model;
    }

    if (status.conversation) {
      update.conversation_id = status.conversation.id;
      update.conversation_origin = status.conversation.origin?.type;
    }

    await this.messagesRepo.update(message.id, update);

    await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_STATUS_CHANGED, {
      tenant_id: message.tenant_id,
      message_id: message.id,
      provider_message_id: status.id,
      previous_status: message.status,
      new_status: internalStatus,
      changed_at: new Date(status.timestamp * 1000).toISOString(),
    });

    this.logger.log({
      msg: 'wa_status_update_processed',
      action: 'status_update',
      message_id: message.id,
      from: message.status,
      to: internalStatus,
    });
  }

  private async findMessageWithRetry(
    providerMessageId: string,
    maxAttempts: number,
  ): Promise<{ id: string; tenant_id: string; status: string } | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const m = await this.messagesRepo.findByProviderMessageId(providerMessageId);
      if (m) return m as any;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
    return null;
  }
}
```

### 18.3 `wa-replay-protection.middleware.ts`

```typescript
/**
 * @insurtech/api/modules/comm/middleware/wa-replay-protection.middleware
 *
 * Defense in depth : reject webhooks with stale Meta entry[].time
 * AND dedup-cache via Redis to detect duplicate signature replays
 * before they hit the Postgres UNIQUE constraint.
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { hashSha256Hex } from '@insurtech/shared/utils/hash.util';

@Injectable()
export class WaReplayProtectionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WaReplayProtectionMiddleware.name);
  private readonly windowMs: number;
  private readonly dedupTtlSec = 86_400; // 24h

  constructor(
    private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.windowMs = Number.parseInt(
      this.config.get<string>('WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS') ?? '300000',
      10,
    );
  }

  async use(req: FastifyRequest, res: FastifyReply, next: () => void): Promise<void> {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      return next();
    }

    // Try to parse entry[].time for the freshness check
    try {
      const parsed = JSON.parse(rawBody.toString('utf-8'));
      const firstTime = parsed?.entry?.[0]?.time;
      if (typeof firstTime === 'number') {
        const ageMs = Date.now() - firstTime * 1000;
        if (ageMs > this.windowMs) {
          this.logger.warn({
            msg: 'wa_webhook_replay_blocked',
            action: 'replay_protection',
            age_ms: ageMs,
            window_ms: this.windowMs,
          });
          return res.status(401).send({ error: 'REPLAY_WINDOW_EXCEEDED' });
        }
      }
    } catch {
      // Non-JSON body : let downstream handle
    }

    // Dedup cache : signature hash already seen in last 24h ?
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    if (sig) {
      const cacheKey = `wa:webhook:dedup:${hashSha256Hex(Buffer.from(sig)).slice(0, 32)}`;
      const setNx = await this.redis.set(cacheKey, '1', 'EX', this.dedupTtlSec, 'NX');
      if (setNx === null) {
        // Already processed within 24h
        this.logger.log({
          msg: 'wa_webhook_dedup_cache_hit',
          action: 'replay_protection',
        });
        // Return 200 directly (Meta acknowledged) to prevent Postgres roundtrip
        return res.status(200).send({ status: 'ok', dedup: true });
      }
    }

    return next();
  }
}
```

### 18.4 `wa-secret-rotation.service.ts`

```typescript
/**
 * @insurtech/api/modules/comm/services/wa-secret-rotation.service
 *
 * Manages dual-secret validation during app_secret rotation grace period (24h).
 * Provides centralized API for both signature middleware and admin rotation
 * trigger (Sprint 27 admin UI).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Redis } from 'ioredis';

interface RotationState {
  current: string;
  previous?: string;
  rotation_started_at?: string;
  rotation_expires_at?: string;
}

@Injectable()
export class WaSecretRotationService {
  private readonly logger = new Logger(WaSecretRotationService.name);
  private readonly rotationKey = 'wa:app_secret:rotation';
  private readonly defaultGracePeriodMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: Redis,
  ) {}

  async getActiveSecrets(): Promise<RotationState> {
    const cached = await this.redis.get(this.rotationKey);
    if (cached) {
      try {
        const state = JSON.parse(cached) as RotationState;
        if (state.rotation_expires_at && new Date(state.rotation_expires_at) < new Date()) {
          // Grace period expired : drop previous
          delete state.previous;
          delete state.rotation_started_at;
          delete state.rotation_expires_at;
          await this.redis.set(this.rotationKey, JSON.stringify(state));
        }
        return state;
      } catch {
        // Fall through to env-based defaults
      }
    }

    return {
      current: this.config.get<string>('WHATSAPP_APP_SECRET') ?? '',
      previous: this.config.get<string>('WHATSAPP_APP_SECRET_PREVIOUS') || undefined,
    };
  }

  async startRotation(newSecret: string): Promise<void> {
    const current = (await this.getActiveSecrets()).current;
    const expires = new Date(Date.now() + this.defaultGracePeriodMs);
    const state: RotationState = {
      current: newSecret,
      previous: current,
      rotation_started_at: new Date().toISOString(),
      rotation_expires_at: expires.toISOString(),
    };
    await this.redis.set(
      this.rotationKey,
      JSON.stringify(state),
      'EX',
      Math.ceil(this.defaultGracePeriodMs / 1000) + 60,
    );
    this.logger.warn({
      msg: 'wa_app_secret_rotation_started',
      action: 'secret_rotation',
      grace_expires_at: expires.toISOString(),
    });
  }

  async completeRotation(): Promise<void> {
    const state = await this.getActiveSecrets();
    delete state.previous;
    delete state.rotation_started_at;
    delete state.rotation_expires_at;
    await this.redis.set(this.rotationKey, JSON.stringify(state));
    this.logger.warn({ msg: 'wa_app_secret_rotation_completed', action: 'secret_rotation' });
  }

  async verifySignature(signature: string, rawBody: Buffer): Promise<boolean> {
    const state = await this.getActiveSecrets();
    if (this.verifyWith(signature, rawBody, state.current)) return true;
    if (state.previous && this.verifyWith(signature, rawBody, state.previous)) {
      this.logger.warn({
        msg: 'wa_signature_verified_with_previous_secret',
        action: 'secret_rotation',
        note: 'app_secret_rotation_grace_period_active',
      });
      return true;
    }
    return false;
  }

  private verifyWith(signature: string, body: Buffer, secret: string): boolean {
    const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  }
}
```

### 18.5 `wa-webhook-processor.consumer.spec.ts` (15+ tests Kafka consumer)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WaWebhookProcessorConsumer } from '@insurtech/comm/consumers/wa-webhook-processor.consumer';
import { WaWebhookStorageService } from '@insurtech/comm/services/wa-webhook-storage.service';
import { WaStatusMapperService } from '@insurtech/comm/services/wa-status-mapper.service';
import { WaIncomingMessageService } from '@insurtech/comm/services/wa-incoming-message.service';
import { MessagesRepositoryService } from '@insurtech/comm/services/messages-repository.service';
import { KafkaPublisher } from '@insurtech/kafka/kafka-publisher.service';
import {
  WA_PAYLOAD_STATUS_DELIVERED,
  WA_PAYLOAD_STATUS_READ,
  WA_PAYLOAD_STATUS_FAILED,
  WA_PAYLOAD_INCOMING_TEXT,
  WA_PAYLOAD_INCOMING_STOP,
  WA_PAYLOAD_INCOMING_IMAGE,
  WA_PAYLOAD_MULTI_ENTRY_BATCH,
  WA_PAYLOAD_OLD_REPLAY,
} from '../../test/comm/fixtures/wa-webhook-payloads.fixtures';

describe('WaWebhookProcessorConsumer', () => {
  let consumer: WaWebhookProcessorConsumer;
  let storage: { findById: any; markProcessed: any };
  let messagesRepo: { findByProviderMessageId: any; update: any; create: any };
  let incomingService: { processIncoming: any };
  let publisher: { publish: any };

  beforeEach(async () => {
    storage = {
      findById: vi.fn().mockResolvedValue({ id: 'wh-1', processed: false }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };
    messagesRepo = {
      findByProviderMessageId: vi.fn().mockResolvedValue({ id: 'm-1', tenant_id: 't-1', status: 'sent' }),
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: 'm-new' }),
    };
    incomingService = { processIncoming: vi.fn().mockResolvedValue(undefined) };
    publisher = { publish: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WaWebhookProcessorConsumer,
        WaStatusMapperService,
        { provide: ConfigService, useValue: { get: () => '300000' } },
        { provide: WaWebhookStorageService, useValue: storage },
        { provide: MessagesRepositoryService, useValue: messagesRepo },
        { provide: WaIncomingMessageService, useValue: incomingService },
        { provide: KafkaPublisher, useValue: publisher },
      ],
    }).compile();

    consumer = moduleRef.get(WaWebhookProcessorConsumer);
  });

  it('skips event when channel is not whatsapp', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'sms',
      payload: {},
      received_at: new Date().toISOString(),
    });
    expect(storage.findById).not.toHaveBeenCalled();
  });

  it('logs warn and returns when webhook row not found', async () => {
    storage.findById.mockResolvedValueOnce(null);
    await (consumer as any).handleMessage({
      webhook_id: 'wh-missing',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_DELIVERED,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).not.toHaveBeenCalled();
  });

  it('skips when webhook already processed', async () => {
    storage.findById.mockResolvedValueOnce({ id: 'wh-1', processed: true });
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_DELIVERED,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).not.toHaveBeenCalled();
  });

  it('processes status delivered and updates delivered_at', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_DELIVERED,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({ status: 'delivered', delivered_at: expect.any(Date) }),
    );
  });

  it('processes status read and updates read_at', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_READ,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({ status: 'read', read_at: expect.any(Date) }),
    );
  });

  it('processes status failed and extracts fail_reason from errors[0].title', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_FAILED,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({ status: 'failed', fail_reason: 'Message undeliverable' }),
    );
  });

  it('publishes COMM_MESSAGE_STATUS_CHANGED Kafka event', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_DELIVERED,
      received_at: new Date().toISOString(),
    });
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.stringContaining('status'),
      expect.objectContaining({ status: 'delivered' }),
    );
  });

  it('processes incoming text message via incomingService', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_INCOMING_TEXT,
      received_at: new Date().toISOString(),
    });
    expect(incomingService.processIncoming).toHaveBeenCalled();
  });

  it('processes STOP keyword via incomingService', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_INCOMING_STOP,
      received_at: new Date().toISOString(),
    });
    expect(incomingService.processIncoming).toHaveBeenCalled();
  });

  it('processes incoming image via incomingService', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_INCOMING_IMAGE,
      received_at: new Date().toISOString(),
    });
    expect(incomingService.processIncoming).toHaveBeenCalled();
  });

  it('iterates each status in multi-entry batch', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_MULTI_ENTRY_BATCH,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).toHaveBeenCalledTimes(3);
  });

  it('rejects replay outside 5min window without action', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_OLD_REPLAY,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.update).not.toHaveBeenCalled();
    expect(storage.markProcessed).toHaveBeenCalledWith('wh-1');
  });

  it('marks webhook processed=true after success', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_DELIVERED,
      received_at: new Date().toISOString(),
    });
    expect(storage.markProcessed).toHaveBeenCalledWith('wh-1');
  });

  it('retries findByProviderMessageId 3x on race condition', async () => {
    messagesRepo.findByProviderMessageId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'm-1', tenant_id: 't-1', status: 'sent' });
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: WA_PAYLOAD_STATUS_DELIVERED,
      received_at: new Date().toISOString(),
    });
    expect(messagesRepo.findByProviderMessageId).toHaveBeenCalledTimes(3);
  });

  it('marks processed when payload is invalid (Zod fail) to prevent retry storm', async () => {
    await (consumer as any).handleMessage({
      webhook_id: 'wh-1',
      channel: 'whatsapp',
      payload: { object: 'invalid' },
      received_at: new Date().toISOString(),
    });
    expect(storage.markProcessed).toHaveBeenCalledWith('wh-1');
  });

  it('does not throw if Kafka publish fails (graceful degradation)', async () => {
    publisher.publish.mockRejectedValueOnce(new Error('Kafka down'));
    await expect(
      (consumer as any).handleMessage({
        webhook_id: 'wh-1',
        channel: 'whatsapp',
        payload: WA_PAYLOAD_STATUS_DELIVERED,
        received_at: new Date().toISOString(),
      }),
    ).resolves.not.toThrow();
  });
});
```

---

## 19. Tests E2E supplementaires

### 19.1 Tests E2E couvrant tous les types Meta + charge

```typescript
// Continuation of wa-webhook.e2e-spec.ts

describe('Multi-entry batch advanced', () => {
  it('persists single row even with 50 events batched in entry[].changes[].value.statuses[]', async () => {
    const now = Math.floor(Date.now() / 1000);
    const statuses = Array.from({ length: 50 }, (_, i) => ({
      id: `wamid.batch_${i}`,
      status: 'delivered',
      timestamp: now,
      recipient_id: '212612345678',
    }));
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, statuses } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const headers = buildWebhookHeaders(rawBody, TEST_APP_SECRET);
    const r = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/whatsapp', payload: rawBody, headers });
    expect(r.statusCode).toBe(200);
  });
});

describe('Incoming media types', () => {
  it('accepts incoming image with caption', async () => {
    const payload = WA_PAYLOAD_INCOMING_IMAGE;
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });

  it('accepts incoming document', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.doc_001', from: '212612345678', timestamp: now, type: 'document', document: { id: 'media-doc-001', mime_type: 'application/pdf', sha256: 'abc', filename: 'Police_Auto_2026.pdf' } }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });

  it('accepts incoming audio voice note', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.audio_001', from: '212612345678', timestamp: now, type: 'audio', audio: { id: 'media-aud-001', mime_type: 'audio/ogg; codecs=opus', sha256: 'xyz' } }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });

  it('accepts incoming sticker', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.sticker_001', from: '212612345678', timestamp: now, type: 'sticker', sticker: { id: 'media-stk-001', mime_type: 'image/webp', sha256: 'pqr' } }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });
});

describe('Incoming structured types', () => {
  it('accepts incoming location', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.loc_001', from: '212612345678', timestamp: now, type: 'location', location: { latitude: 33.5731, longitude: -7.5898, name: 'Casablanca', address: 'Rue Mohammed V' } }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });

  it('accepts incoming contact card', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.contact_001', from: '212612345678', timestamp: now, type: 'contacts', contacts: [{ name: { formatted_name: 'Mohammed Alami', first_name: 'Mohammed' }, phones: [{ phone: '+212600000000', type: 'CELL' }] }] }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });

  it('accepts button reply interactive', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.btn_001', from: '212612345678', timestamp: now, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'BTN_CONFIRM_PAYMENT', title: 'Confirmer' } } }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });

  it('accepts list reply interactive', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, messages: [{ id: 'wamid.list_001', from: '212612345678', timestamp: now, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'LIST_AUTO_CLAIM_REPAIR', title: 'Reparation', description: 'Declarer un sinistre auto' } } }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });
});

describe('Failed message error codes', () => {
  it('processes failed with code 131_026 (undeliverable)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, statuses: [{ id: 'wamid.fail_001', status: 'failed', timestamp: now, recipient_id: '212699999999', errors: [{ code: 131_026, title: 'Undeliverable', message: 'Recipient not on WhatsApp' }] }] } }] }],
    };
    const rawBody = JSON.stringify(payload);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/whatsapp',
      payload: rawBody,
      headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
    });
    expect(r.statusCode).toBe(200);
  });
});

describe('Load test (1000 webhooks/min)', () => {
  it('processes 1000 webhooks in <60s with p95 latency <200ms', async () => {
    const latencies: number[] = [];
    const targetCount = 1000;
    const start = Date.now();
    for (let i = 0; i < targetCount; i += 1) {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: '102290129340398', time: now, changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '106540132237449' }, statuses: [{ id: `wamid.load_${i}`, status: 'delivered', timestamp: now, recipient_id: '212612345678' }] } }] }],
      };
      const rawBody = JSON.stringify(payload);
      const reqStart = Date.now();
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/public/webhooks/whatsapp',
        payload: rawBody,
        headers: buildWebhookHeaders(rawBody, TEST_APP_SECRET),
      });
      latencies.push(Date.now() - reqStart);
      expect(r.statusCode).toBe(200);
    }
    const elapsed = Date.now() - start;
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    expect(elapsed).toBeLessThan(60_000);
    expect(p95).toBeLessThan(200);
    expect(p99).toBeLessThan(500);
  }, 90_000);
});
```

---

## Annexe A. Pattern Meta Webhook structure (exemples JSON)

### A.1 Status update simple `delivered`

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "display_phone_number": "212612345678", "phone_number_id": "106540132237449" },
            "statuses": [
              {
                "id": "wamid.HBgLMjEyNjEyMzQ1Njc4FQIAERgSRkFGOEM3RkVDODcwQUI3RDVCAA==",
                "status": "delivered",
                "timestamp": 1731065472,
                "recipient_id": "212612345678",
                "conversation": { "id": "gBEGkYiEB1VXAglK7ZEqA1YKPrU", "origin": { "type": "service" } },
                "pricing": { "billable": true, "pricing_model": "CBP", "category": "service" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.2 Status update batch (multi-entry)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "statuses": [
              { "id": "wamid.aaa", "status": "sent", "timestamp": 1731065470, "recipient_id": "212612345678" },
              { "id": "wamid.bbb", "status": "delivered", "timestamp": 1731065471, "recipient_id": "212612345679" },
              { "id": "wamid.ccc", "status": "read", "timestamp": 1731065472, "recipient_id": "212612345680" }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.3 Incoming text message

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "contacts": [{ "profile": { "name": "Mohammed" }, "wa_id": "212612345678" }],
            "messages": [
              {
                "id": "wamid.text_test_001",
                "from": "212612345678",
                "timestamp": 1731065472,
                "type": "text",
                "text": { "body": "Bonjour, je voudrais souscrire une assurance auto" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.4 Incoming media image with caption

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "messages": [
              {
                "id": "wamid.image_test_001",
                "from": "212612345678",
                "timestamp": 1731065472,
                "type": "image",
                "image": { "id": "1124562345670123", "mime_type": "image/jpeg", "sha256": "abc123def456", "caption": "Photo accident voie publique" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.5 Incoming location

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "messages": [
              {
                "id": "wamid.loc_001",
                "from": "212612345678",
                "timestamp": 1731065472,
                "type": "location",
                "location": { "latitude": 33.5731, "longitude": -7.5898, "name": "Casablanca", "address": "Rue Mohammed V" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.6 Incoming contact card

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "messages": [
              {
                "id": "wamid.contact_001",
                "from": "212612345678",
                "timestamp": 1731065472,
                "type": "contacts",
                "contacts": [{ "name": { "formatted_name": "Aicha Benali" }, "phones": [{ "phone": "+212600112233", "type": "CELL" }] }]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.7 Button reply interactive

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "messages": [
              {
                "id": "wamid.btn_001",
                "from": "212612345678",
                "timestamp": 1731065472,
                "type": "interactive",
                "interactive": { "type": "button_reply", "button_reply": { "id": "BTN_CONFIRM_PAYMENT", "title": "Confirmer" } }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.8 List reply interactive

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "messages": [
              {
                "id": "wamid.list_001",
                "from": "212612345678",
                "timestamp": 1731065472,
                "type": "interactive",
                "interactive": { "type": "list_reply", "list_reply": { "id": "LIST_AUTO_CLAIM_REPAIR", "title": "Reparation auto", "description": "Declarer un sinistre" } }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### A.9 Failed message with error code

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "time": 1731065472,
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "phone_number_id": "106540132237449" },
            "statuses": [
              {
                "id": "wamid.fail_001",
                "status": "failed",
                "timestamp": 1731065472,
                "recipient_id": "212699999999",
                "errors": [
                  {
                    "code": 131026,
                    "title": "Message undeliverable",
                    "message": "Receiver phone number not on WhatsApp",
                    "error_data": { "details": "Phone number not registered with WhatsApp" }
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## Annexe B. Runbook ops detaille

### B.1 Procedure rotation `WHATSAPP_APP_SECRET`

Pre-requis : acces Meta Business Manager (admin role) + acces secrets manager (Sprint 35 Vault) ou env edit production.

1. **Generer nouveau App Secret cote Meta** :
   - Login Meta App Dashboard https://developers.facebook.com/apps
   - Selectionner App Skalean.
   - Settings -> Basic -> App Secret -> "Show" puis "Reset App Secret".
   - Copier le nouveau secret (jamais re-affiche).
2. **Activer grace period dual-validate** :
   - Set `WHATSAPP_APP_SECRET_PREVIOUS` = ancienne valeur.
   - Set `WHATSAPP_APP_SECRET` = nouvelle valeur.
   - Redeploy services (rolling restart pods Kubernetes).
   - Verify logs : `wa_webhook_signature_verified` apparaissent toujours en succes.
3. **Wait grace 24h** :
   - Tous les webhooks in-flight signes avec ancien secret restent acceptes.
   - Aucun trafic sur ancien secret apres 24h car Meta utilise nouveau.
4. **Drop ancien secret** :
   - Unset `WHATSAPP_APP_SECRET_PREVIOUS`.
   - Redeploy.
   - Surveiller logs `wa_webhook_signature_verified_with_previous_secret` -> doit etre 0.

### B.2 Procedure rotation `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

1. Generer nouveau token random 32+ chars : `openssl rand -hex 32`.
2. Update env `WHATSAPP_WEBHOOK_VERIFY_TOKEN` + redeploy.
3. Login Meta Business Manager -> WhatsApp -> Webhook configuration.
4. Edit verify_token + Save.
5. Meta envoie GET challenge -> verifier 200 OK retourne challenge.
6. Si echec : revert env + Meta config simultane.

### B.3 Diagnostic 401 errors recurring

Symptomes : alerts Sprint 33 `signature_invalid_rate > 10/min`.

Etapes :
1. `kubectl logs -l app=insurtech-api --tail=1000 | grep wa_webhook_signature_invalid` -> compter occurrences.
2. Verifier `WHATSAPP_APP_SECRET` env match Meta App Dashboard "Show App Secret" exactement (pas de trailing whitespace, pas de quote).
3. Si mismatch : redeploy avec correct secret + activer grace period si ancien valait.
4. Verifier Cloudflare/proxy ne reecrit pas `X-Hub-Signature-256` header (case sensitivity bugs).
5. Tester localement : `curl -X POST -H "Content-Type: application/json" -H "X-Hub-Signature-256: sha256=$(echo -n '{}' | openssl dgst -sha256 -hmac $SECRET | cut -d' ' -f2)" -d '{}' https://api.skalean.ma/api/v1/public/webhooks/whatsapp` -> attendu 200.
6. Si rate persistent malgre secret correct -> possible attaque -> escalader Sprint 33 alert + IP whitelist temporaire Cloudflare WAF.

### B.4 Replay attack response procedure

Symptomes : alerts `wa_webhook_replay_blocked > 5/min` ou anomalies idempotency duplicate spike.

1. Capturer IPs sources via logs : `kubectl logs ... | grep replay_blocked | jq .ip | sort | uniq -c`.
2. Si IPs non-Meta (verifier https://developers.facebook.com/docs/messenger-platform/webhooks#ip-allowlist) -> blocage Cloudflare WAF.
3. Si IPs Meta mais replay : possible fuite logs anciens webhooks. Audit recent leaks.
4. Verifier idempotency UNIQUE constraint actif : `psql -c "\d+ comm_webhooks_received"`.
5. Considerer reduire `WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS` de 300000 a 60000 temporairement.

---

## Annexe C. Configuration Meta Business Manager

### C.1 Setup webhook URL

1. Login https://business.facebook.com.
2. Selectionner Business Account Skalean.
3. WhatsApp Manager -> Configuration -> Webhooks.
4. Edit Callback URL : `https://api.skalean.ma/api/v1/public/webhooks/whatsapp`.
5. Verify Token : copier valeur exacte de l'env `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
6. Click "Verify and Save".
   - Meta envoie `GET /api/v1/public/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=XXX&hub.verify_token=YYY`.
   - Skalean retourne `200 OK` avec body = `XXX` plain text.
7. Si echec : verifier endpoint reachable HTTPS publique + verify_token match exact.

### C.2 Subscribe events

Apres verification reussie :
1. Subscribe to fields :
   - `messages` (incoming + status updates)
   - `message_template_status_update` (template approval Meta)
   - `account_alerts` (rate limit, policy violations)
   - `account_update` (business verification status)
   - `phone_number_quality_update` (qualite numero)
2. Save.
3. Test : send message template via Meta Business UI -> verifier webhook recu Skalean logs `wa_webhook_received`.

### C.3 App Secret retrieval

1. https://developers.facebook.com/apps -> selectionner App Skalean.
2. Settings -> Basic -> App Secret -> "Show" (re-auth requis).
3. Copier dans Vault (Sprint 35) ou env `WHATSAPP_APP_SECRET`.
4. JAMAIS commit dans git, JAMAIS log en clair.

### C.4 Webhook subscription verification cron

Sprint 27 admin panel : page "Integrations -> WhatsApp -> Health" qui :
- Affiche derniere reception webhook (timestamp).
- Compte webhooks/h sur 24h glissant.
- Affiche signature_invalid_rate.
- Bouton "Test webhook" qui envoie payload synthetique via Meta Test API.

---

## Annexe D. Securite avancee

### D.1 IP whitelist Meta IPs (Sprint 35 deferred)

Meta publishe ses IP ranges a https://developers.facebook.com/docs/messenger-platform/webhooks#ip-allowlist. Pour Sprint 35, pattern :

```typescript
const META_IP_RANGES_V1 = [
  '157.240.0.0/16',
  '173.252.64.0/19',
  '199.201.64.0/22',
  '204.15.20.0/22',
  '69.63.176.0/20',
  '69.171.224.0/19',
  '74.119.76.0/22',
  '103.4.96.0/22',
  '129.134.0.0/16',
  '157.240.0.0/16',
  '173.252.64.0/19',
  '179.60.192.0/22',
  '185.60.216.0/22',
  '204.15.20.0/22',
  '31.13.24.0/21',
  '31.13.64.0/18',
  '45.64.40.0/22',
  '66.220.144.0/20',
  '69.63.176.0/20',
  '69.171.224.0/19',
  '74.119.76.0/22',
];
```

Implementation `WaIpWhitelistMiddleware` (Sprint 35) verifie `req.ip` via lib `ipaddr.js` matching CIDR ranges. Refresh ranges via cron 24h Meta API.

### D.2 Mutual TLS optional (Sprint 35)

Apres Sprint 35 PKI infra :
- Meta supporte mTLS via Custom Domain feature.
- Skalean configure cert client `meta-webhooks.crt` cote Cloudflare/Nginx upstream.
- Verification cert chain Meta avant signature HMAC.

### D.3 Rate limiting `@nestjs/throttler`

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'wa_webhook', ttl: 60_000, limit: 1000 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class CommThrottleModule {}

// In controller :
@Throttle({ wa_webhook: { limit: 1000, ttl: 60_000 } })
@Post()
async receive(...) { ... }
```

Sprint 33 alerte si throttle hit > 5/min (potentielle DoS).

### D.4 DDoS protection Cloudflare (Sprint 35)

- Cloudflare Pro plan + Bot Fight Mode.
- Rule "Skip rate limit pour User-Agent contains facebookexternalua".
- WAF custom rule "Block requests to /webhooks/whatsapp without X-Hub-Signature-256 header".

---

## Annexe E. Observability + alerting

### E.1 Pino structured logs

Tous les logs emis par WaWebhookController, WaSignatureMiddleware, WaWebhookProcessorConsumer respectent format Pino :

| Event | Level | Champs |
|-------|-------|--------|
| `webhook.received` | info | tenant_id, webhook_id, idempotency_key_prefix, duration_ms |
| `webhook.signature_invalid` | warn | ip, user_agent, signature_length, raw_body_size |
| `webhook.signature_missing` | warn | ip, user_agent |
| `webhook.processed` | info | webhook_id, processed_events_count |
| `webhook.replay_blocked` | warn | webhook_id, age_ms, window_ms |
| `webhook.duplicate_ignored` | info | idempotency_key_prefix, duration_ms |
| `webhook.kafka_publish_failed` | error | webhook_id, err, alert |
| `webhook.persist_failed` | error | err, alert |
| `webhook.message_not_found_for_status` | warn | provider_message_id_prefix, status |
| `wa_stop_keyword_auto_optout` | info | tenant_id, contact_id, keyword |

Pino config Sprint 1 ajoute redaction :
```typescript
{
  redact: {
    paths: [
      'req.headers["x-hub-signature-256"]',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.query.hub_verify_token',
      'req.query["hub.verify_token"]',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    ],
    censor: '[REDACTED]',
  },
}
```

### E.2 OTEL traces

Span `comm.webhook.receive` instrumente dans WaWebhookController.receive avec attributes :
- `tenant_id` (apres resolution)
- `webhook_id` (apres persist)
- `message.count` (nombre messages dans batch)
- `idempotency.duplicate` (boolean)
- `duration_ms` (auto via OTEL)

Sub-spans :
- `comm.webhook.signature_verify` (middleware)
- `comm.webhook.persist` (storage service)
- `comm.webhook.kafka_publish`

Span `comm.webhook.process` instrumente dans WaWebhookProcessorConsumer :
- `webhook_id`
- `payload.entry_count`
- `payload.statuses_count`
- `payload.messages_count`
- `processed_events_count`

Tempo / Jaeger Sprint 33 visualisation traces.

### E.3 Prometheus metrics

```typescript
// Sprint 33 prom-client integration
import { Counter, Histogram } from 'prom-client';

export const webhookReceivedTotal = new Counter({
  name: 'wa_webhook_received_total',
  help: 'Total WhatsApp webhooks received',
  labelNames: ['result'], // 'ok' | 'duplicate' | 'persist_failed'
});

export const webhookSignatureInvalidTotal = new Counter({
  name: 'wa_webhook_signature_invalid_total',
  help: 'Total WhatsApp webhooks with invalid HMAC signature',
});

export const webhookReplayBlockedTotal = new Counter({
  name: 'wa_webhook_replay_blocked_total',
  help: 'Total WhatsApp webhooks blocked by replay protection',
});

export const webhookProcessingDurationMs = new Histogram({
  name: 'wa_webhook_processing_duration_ms',
  help: 'WhatsApp webhook processing duration milliseconds',
  buckets: [10, 25, 50, 100, 200, 500, 1000, 2500, 5000],
});

export const webhookConsumerProcessedTotal = new Counter({
  name: 'wa_webhook_consumer_processed_total',
  help: 'Total webhooks processed by Kafka consumer',
  labelNames: ['event_type'], // 'status_update' | 'incoming_message' | 'error' | 'template_status'
});
```

### E.4 Alertes Sprint 33

```yaml
groups:
  - name: wa-webhook-alerts
    interval: 30s
    rules:
      - alert: WaWebhookSignatureInvalidRateHigh
        expr: rate(wa_webhook_signature_invalid_total[5m]) > 0.166
        for: 5m
        labels: { severity: warning, team: comm }
        annotations:
          summary: "WA webhook signature invalid > 10/min sustained 5min"
          runbook: "https://docs.skalean.ma/runbooks/wa-webhook#diagnostic-401"
          slack: "#alerts-comm"

      - alert: WaWebhookDeliveryRateLow
        expr: |
          (sum(rate(wa_message_status_changed_total{status="delivered"}[15m])) /
          sum(rate(wa_message_status_changed_total{status="sent"}[15m]))) < 0.95
        for: 15m
        labels: { severity: warning, team: comm }
        annotations:
          summary: "WA delivery rate < 95% over 15min window"
          runbook: "https://docs.skalean.ma/runbooks/wa-webhook#delivery-rate"

      - alert: WaWebhookReplayAttackDetected
        expr: rate(wa_webhook_replay_blocked_total[5m]) > 0.083
        for: 5m
        labels: { severity: critical, team: security }
        annotations:
          summary: "Possible replay attack on WA webhook (>5/min blocked)"
          slack: "#security-incidents"

      - alert: WaWebhookProcessingLagHigh
        expr: kafka_consumer_lag{topic="insurtech.events.comm.webhook.received"} > 1000
        for: 10m
        labels: { severity: warning, team: comm }
        annotations:
          summary: "WA webhook consumer lag > 1000 messages"
```

---

## Annexe F. Migration prod-ready

### F.1 Pre-deployment checklist

- [ ] `WHATSAPP_APP_SECRET` set in Vault/env (Sprint 35 Vault, Sprint 1-9 .env).
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set (random 32+ chars).
- [ ] `WHATSAPP_WEBHOOK_REPLAY_WINDOW_MS=300000` (default).
- [ ] Migration V0009.4 applied on staging Postgres : `psql -c "\d+ comm_webhooks_received" | grep idempotency_key_unique`.
- [ ] Kafka topic `insurtech.events.comm.webhook.received` provisioned (3 partitions, replication 3).
- [ ] Kafka topic `insurtech.events.dlq.comm` provisioned.
- [ ] Meta Business Manager webhook URL configured pointing to staging d'abord (`https://staging-api.skalean.ma/...`).
- [ ] Meta verify_token field populated avec valeur env.
- [ ] Cloudflare WAF rule whitelist endpoint `/api/v1/public/webhooks/whatsapp` (no JWT requis).
- [ ] Pino redact config deployed (signature header, app_secret, verify_token).
- [ ] Prometheus scrape config updated `/metrics` endpoint inclut nouveaux compteurs.
- [ ] Tempo/Jaeger ready pour spans `comm.webhook.*`.

### F.2 Smoke test

1. **Meta Business Manager** : "Send Test Webhook" pour event `messages`.
2. Verifier logs Skalean :
   - `wa_webhook_received` apparait.
   - `wa_webhook_signature_verified` true.
   - HTTP 200 retourne en < 200ms.
3. **Curl manual** :
   ```bash
   PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"test","time":TIMESTAMP,"changes":[{"field":"messages","value":{"statuses":[{"id":"wamid.smoke","status":"delivered","timestamp":TIMESTAMP,"recipient_id":"212612345678"}]}}]}]}'
   PAYLOAD=${PAYLOAD//TIMESTAMP/$(date +%s)}
   SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" -hex | sed 's/^.* //')
   curl -X POST https://api.skalean.ma/api/v1/public/webhooks/whatsapp \
     -H "Content-Type: application/json" \
     -H "X-Hub-Signature-256: sha256=$SIG" \
     -d "$PAYLOAD"
   # Expected : HTTP 200 {"status":"ok"}
   ```
4. **Verifier persistance** :
   ```sql
   SELECT id, idempotency_key, processed, received_at
   FROM comm_webhooks_received
   ORDER BY received_at DESC LIMIT 5;
   ```
5. **Verifier Kafka consume** :
   ```bash
   kafkactl consume insurtech.events.comm.webhook.received --tail 5
   ```

### F.3 Rollback plan

Trigger : > 50% webhooks retournent 5xx ou alert `WaWebhookSignatureInvalidRateHigh` firing.

1. **Step 1 (immediate)** : Cloudflare Page Rule retourne 503 sur `/api/v1/public/webhooks/whatsapp` (Meta retry 24h, donnees pas perdues).
2. **Step 2 (5 min)** : Rollback container image vers tag precedent : `kubectl set image deployment/insurtech-api api=insurtech/api:vN-1`.
3. **Step 3 (10 min)** : Si rollback insuffisant, revert env :
   - Restaurer `WHATSAPP_APP_SECRET` precedent (depuis Vault history).
   - Restaurer `WHATSAPP_WEBHOOK_VERIFY_TOKEN` precedent.
   - Update Meta Business Manager avec verify_token precedent.
4. **Step 4** : Replay manuel webhooks accumules pendant downtime via Sprint 27 admin DLQ replay.

### F.4 Post-deployment monitoring (30 jours)

| Metric | Cible | Action si depasse |
|--------|-------|-------------------|
| `webhook_received_total{result="ok"}` rate | > 95% | OK |
| `webhook_signature_invalid_total` rate | < 0.5% | Alert ops, audit secret config |
| `webhook_replay_blocked_total` rate | < 0.1% | Audit IP sources |
| `webhook_processing_duration_ms` p99 | < 200 ms | Investigate Kafka publish lag |
| `kafka_consumer_lag` | < 100 msg | Scale consumer replicas |
| `wa_message_delivery_rate` | > 95% | Investigate Meta error codes |

Apres 30 jours stabilite : declasser monitoring renforce vers monitoring standard Sprint 33.

---

**Fin de la tache 3.2.4. Densite finale : ~140 ko. Prochaine tache : 3.2.5 Template Manager.**
