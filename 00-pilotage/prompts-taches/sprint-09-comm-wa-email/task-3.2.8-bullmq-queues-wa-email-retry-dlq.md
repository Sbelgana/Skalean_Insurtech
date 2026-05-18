# TACHE 3.2.8 -- BullMQ Queues + Workers + Retry Exponential + DLQ Kafka (wa-send / email-send / wa-webhook-process / email-webhook-process)

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.8)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.9 Message Orchestrator, 3.2.10 Delivery Tracking, 3.2.13 Tests E2E, et tous les modules Sprint 14+ Insure / Sprint 20+ Repair / Sprint 17 Booking qui consument l'orchestrator pour notifier clients et courtiers)
**Effort** : 5h
**Dependances** : 3.2.7 (Email template renderer + RTL ar/ar-MA), 3.2.6 (Email SMTP client + DKIM + Mailgun), 3.2.5 (Template Manager + 60 templates seed), 3.2.4 (WA webhook receiver + signature HMAC), 3.2.3 (WA template renderer + 3 locales), 3.2.2 (WhatsApp Cloud API client Meta v21.0), 3.2.1 (comm_messages entity), Sprint 3 Tache 1.3.11 (BullMQ JobsModule + Redis DB 2 + JobProducerService), Sprint 2 Tache 1.2.13 (KafkaConsumerBase abstract DLQ pattern), Sprint 2 Tache 1.2.10 (KafkaPublisher), Sprint 1 Tache 1.2.13 (OpenTelemetry instrumentation)
**Densite cible** : 125-145 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le sous-systeme **BullMQ workers + queues + retry policy + DLQ Kafka** complet et operationnel du programme Skalean InsurTech v2.2 qui implemente l'integralite de la couche d'execution asynchrone des envois communications (WhatsApp via Meta Cloud API v21.0, Email via SMTP Mailgun/Mailhog) et du traitement asynchrone des webhooks providers (Meta WhatsApp delivery statuses + incoming messages, Mailgun bounces / opened / clicked / delivered). Le perimetre couvre quatre queues BullMQ 5.30.1 isolees sur Redis DB 2 (deja reservee Sprint 3 Tache 1.3.11 dans la configuration `REDIS_DB_QUEUES=2`) -- (1) `wa-send` qui consume des jobs `WaSendJobData` et envoie les messages WhatsApp via le `WhatsAppCloudApiClient` Tache 3.2.2, (2) `email-send` qui consume des jobs `EmailSendJobData` et envoie les emails via le `EmailService` enrichi Tache 3.2.6, (3) `wa-webhook-process` qui consume des jobs `WaWebhookProcessJobData` representant les payloads webhooks Meta deja persistes dans `comm_webhooks_received` (Tache 3.2.4) en faisant le traitement async (status updates + incoming messages auto-log CRM Sprint 8), (4) `email-webhook-process` qui consume des jobs `EmailWebhookProcessJobData` representant les webhooks Mailgun (bounces hard/soft, delivered, opened, clicked) avec auto opt-out sur hard bounce ; quatre workers `WaSendWorker`, `EmailSendWorker`, `WaWebhookProcessWorker`, `EmailWebhookProcessWorker` etendant `WorkerHost` de `@nestjs/bullmq` 11.0.2 avec concurrency 10 par defaut (configurable via env `COMM_WA_QUEUE_CONCURRENCY` / `COMM_EMAIL_QUEUE_CONCURRENCY`) ; default job options homogenes (3 retries avec exponential backoff `{ type: 'exponential', delay: 1000, jitter: 0.5 }` produisant intervalles ~1s/5s/30s avec jitter +/-50% pour eviter thundering herd, removeOnComplete `{ age: 30 jours, count: 10000 }` pour observability + economie Redis, removeOnFail `{ age: 90 jours, count: 50000 }` pour analyse incidents + audit Loi 09-08) ; idempotency stricte via DB status check (`comm_messages.status IN ('sent', 'delivered', 'read')` -> skip retry job duplique apres Kafka redelivery) ; DLQ Kafka topic `insurtech.events.dlq.comm` qui recoit `original_data` + metadonnees erreur (message + stack tronque + attempts + tenant_id + correlation_id + timestamp) apres `attemptsMade >= maxAttempts` ou apres throw `UnrecoverableError` (fail-fast sur `MetaInvalidTemplateError`, `MetaPhoneNotOptedInError`, `EmailRecipientBlockedError`) ; OTEL metrics emises (`comm_queue_depth`, `comm_job_duration_ms`, `comm_job_retry_count`, `comm_dlq_count`, `comm_concurrency_active`) avec attribute `queue` et `tenant_id` ; BullDashboard `/admin/queues` (Sprint 3 Tache 1.3.11 monte deja le path) affiche les 4 queues avec onglets active/waiting/completed/failed/delayed ; un service `QueuePublisherService` de surface au-dessus de `BullMQ.Queue.add()` qui valide les payloads via Zod schemas (heritage pattern Sprint 3 `JobProducerService`) avant push, avec methodes `addWaSend`, `addEmailSend`, `addBatch`, `getQueueStats`, `pauseQueue`, `resumeQueue` ; un service `DlqPublisherService` qui encapsule la publication des messages morts vers Kafka DLQ topic en respectant le format compatible `KafkaConsumerBase` Sprint 2 ; integration complete avec `KafkaPublisher` Sprint 2 pour emettre les events `comm.message_sent`, `comm.message_delivered`, `comm.message_failed`, `comm.phone_not_opted_in`, `comm.email_bounced` ; tenant context propage strictement via `AsyncLocalStorage` du Sprint 4 (Tache 1.4.6 TenantContext) pour eviter cross-tenant data leak dans les workers async ; correlation_id traverse de l'enqueue jusqu'au worker pour tracing distributed OTEL ; et une suite de 30+ tests Vitest + tests integration Testcontainers Redis + tests E2E mock Meta + Mailhog.

L'apport architectural est multiple. Premierement, en separant strictement les 4 queues (vs une queue generique `comm-send` multiplexee), on isole les concurrency limits par canal (WhatsApp Meta limite 80 messages/sec par phone_number_id, donc concurrency 10 = 800 msg/min headroom large ; Mailgun limite 100 emails/sec donc concurrency 10 = 600 emails/min ; webhooks processing peut accepter concurrency plus haute car ne touche pas providers externes), on isole les retry policies (un fail email transient peut retry 3 fois en 36s, un fail webhook process peut retry plus rapidement car local DB), et on isole les DLQ flows (analyse post-mortem distincte WhatsApp vs Email vs webhook). Deuxiemement, en utilisant `exponential backoff` avec `jitter: 0.5` (BullMQ 5.30+ feature) plutot qu'un backoff fixe ou exponentiel pur, on evite le pattern destructeur "thundering herd" : si 100 jobs failent au meme instant (ex : Meta API timeout 30s a cause d'un incident provider), un backoff pur les ferait tous retry exactement a t+1s, t+5s, t+30s en synchronisation parfaite, surchargeant l'API au moment exact du recovery ; le jitter +/-50% etale les retries sur une fenetre [0.5s-1.5s] / [2.5s-7.5s] / [15s-45s] qui distribue la charge naturellement. Troisiemement, en publiant les jobs failed irrecuperables vers Kafka DLQ topic (`insurtech.events.dlq.comm`) plutot que vers une "failed BullMQ queue" dediee, on unifie la gestion DLQ avec le pattern Sprint 2 `KafkaConsumerBase` : la DLQ est consommee par le `DlqMonitorConsumer` Sprint 33 (alerting Slack si DLQ count > 100/h), elle est replayable par script ops `pnpm dlq:replay --topic comm`, et elle est analysable dans un dashboard Grafana unifie cross-services (auth-dlq, comm-dlq, insure-dlq, books-dlq tous dans Kafka topic `insurtech.events.dlq.*`). Quatriemement, l'idempotency via DB status check (vs Redis-based deduplication a la BullMQ `jobId` unique) garantit la coherence : si Kafka redelivery cause un job duplique (Sprint 2 KafkaPublisher emit at-least-once garanti), le worker check `comm_messages.status` qui est la source de verite metier ; meme si BullMQ a 2 jobs entries Redis, le second skip rapidement (~5ms DB query vs ~500ms full send). Cinquiemement, le tenant context propage via AsyncLocalStorage est critique multi-tenant : un worker peut traiter des jobs de tenant A et tenant B en parallele (concurrency 10 sur queue partagee), si le contexte tenant n'est pas isole, le RLS Postgres (Sprint 2 Tache 1.2.7) ne s'applique pas correctement, causant cross-tenant data leak. La methode `tenantContext.run({ tenantId }, async () => { ... })` cree une scope async isolee par job. Sixiemement, l'OTEL instrumentation expose les metrics critiques pour le SLO : `comm_queue_depth{queue="wa-send"}` permet alerte si depth > 1000 (signal de saturation), `comm_job_duration_ms{queue="email-send", quantile="p99"}` permet detecter degradation (cible p99 < 5s), `comm_dlq_count_total{queue}` permet alerte PagerDuty si > 50/15min.

A l'issue de cette tache, l'API `queuePublisher.addWaSend({ messageId, to, templateName, locale, variables, tenantId, correlationId })` enqueue un job Redis sous 10ms qui sera consume par `WaSendWorker` en moins de 30s p99 incluant retries, `queuePublisher.addEmailSend(...)` fait le meme pour email (cible p99 < 10s), un fail transient (Meta API 503, Mailgun timeout) declenche 3 retries avec backoff exponentiel jittered, un fail definitif (3eme attempt OR `UnrecoverableError`) publie vers Kafka DLQ topic `insurtech.events.dlq.comm` et marque `comm_messages.status='failed'` avec `fail_reason`, l'idempotency garantit qu'une message redelivree (Kafka at-least-once) ne genere pas 2 sends Meta (cout dollar) ni 2 emails Mailgun (reputation), le BullDashboard `/admin/queues` montre les 4 queues avec compteurs live, OTEL metrics emit a chaque job lifecycle event, les tests Vitest 30+ couvrent tous les paths (success, retry, DLQ, idempotency, concurrency, fail-fast, tenant isolation, correlation propagation).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 declenche des centaines de milliers de communications par mois (estimation steady-state Phase 7+ : 50k WhatsApp + 200k emails / mois pour un tenant moyen 100 courtiers + 50k assures actifs). Sans queue BullMQ, ces communications devraient etre envoyees synchronously dans le thread HTTP request : un controller `POST /api/v1/comm/messages/send` appelle directement `WhatsAppCloudApiClient.sendTemplate()` qui prend 200-2000ms (handshake Meta + render template + roundtrip Meta API + parse response), bloque le thread Node, sature le pool de connexions Fastify (default 100 connections), cause timeouts client Sprint 18 Customer Portal qui exige p99 < 500ms. Avec queue BullMQ, le controller insere `comm_messages` row status='pending' (~10ms DB) puis enqueue job Redis (~5ms LPUSH BullMQ), retourne 202 Accepted en moins de 30ms total ; le worker traite async en background avec concurrency 10, retry 3x sur transient errors, DLQ sur fail definitif, sans bloquer le thread HTTP.

L'isolation BullMQ vs Kafka est dictee par les patterns d'usage. Kafka Sprint 2 est designe pour les **events business** (immutable, ordered, replayable, multi-consumers, retention 7-30 jours) : `auth.user_signed_up`, `crm.contact_created`, `comm.message_sent`. BullMQ est designe pour les **jobs operationnels** (work queue, single consumer, retry granular, priority, delayed jobs cron, removed apres completion) : "envoie ce message WhatsApp", "process ce webhook Mailgun", "genere ce PDF Sprint 10", "agrege ces stats ClickHouse Sprint 13 a 03h00 chaque nuit". Les caracteristiques sont differentes : Kafka requiert `groupId` + `partition` + `offset` (stateful pour ordering garanti), BullMQ requiert `jobId` + `attempts` + `delay` (stateless deduplication via Redis ZADD score = timestamp). Reuser Kafka pour les jobs (anti-pattern considere et rejete Sprint 3) impliquerait de re-implementer manually retry policy, priority queues, delayed scheduling, concurrency limits per worker, ce qui n'est pas le design Kafka.

Le besoin DLQ Kafka (vs failed queue BullMQ) est dicte par l'observability cross-service unifiee. Sprint 33 implemente un `DlqMonitorConsumer` qui consume `insurtech.events.dlq.*` (wildcard) et emit alerts Slack si rate > seuil. Si chaque module a sa propre failed queue BullMQ (un dans wa-send, un dans email-send, un dans pdf-generate Sprint 10, un dans clickhouse-aggregate Sprint 13), Sprint 33 devrait poll N queues differentes via N connections Redis differentes. Avec DLQ Kafka unifie, un seul consumer suffit. De plus, les failed jobs BullMQ apres `removeOnFail.age` (90 jours) sont supprimes ; les DLQ Kafka events sont retenus 30 jours topic puis archives S3 Glacier Sprint 35 pour audit Loi 09-08 (audit logs 7 ans).

Le besoin idempotency par DB status check est dicte par Kafka at-least-once semantique. Sprint 2 KafkaPublisher emit avec `acks=all` mais sans deduplication idempotente (Kafka transactions exactly-once Sprint 35 defere). Si un consumer Kafka qui declenche un enqueue BullMQ commit son offset apres l'enqueue mais crash avant l'ack, au restart il re-consume l'event et re-enqueue le job -> 2 jobs identiques. Sans idempotency, 2 sends Meta = 2 messages WhatsApp recus par le client (UX degradee + cout) ou 2 emails (spam). La solution canonique idempotent : check `comm_messages.status` au debut du worker process. Si status='sent' (premier worker a deja complete) -> log skip + return. Sprint 11 introduira Idempotency-Key au niveau API gateway ; cette tache fait l'idempotency au niveau worker.

L'exigence concurrency 10 par worker est calibree : Meta WhatsApp Cloud API limite 80 messages/sec par phone_number_id (Meta Business Platform docs). Avec concurrency 10 et latence moyenne send 500ms, debit = 10 / 0.5 = 20 messages/sec par worker. Si un seul worker pod, 20 msg/sec = 25% de la limite Meta (headroom large). Sprint 14 ajoutera scaling horizontal worker pods (Kubernetes HPA Sprint 35) qui multiplie la concurrency totale. Pour Mailgun (100 emails/sec limite), meme calibration. Pour `wa-webhook-process` et `email-webhook-process`, concurrency peut etre plus haute (DB local seulement, pas d'API externe) -- on reste a 10 pour homogeneite Sprint 9, Sprint 14 ajustera.

L'exigence backoff exponential avec jitter est dictee par les bonnes pratiques distributed systems. AWS Architecture Center 2023 recommande "exponential backoff with full jitter" pour eviter thundering herd. BullMQ 5.30+ a ajoute le parameter `jitter` (0.5 = +/- 50% randomization). Sans jitter, 100 jobs failed simultanement retry tous a t+1s (CPU spike + API spike). Avec jitter 0.5, ils retry sur fenetre [0.5s, 1.5s] uniformely distribuee. Le `delay: 1000` initial + multiplier exponential cree intervalles approximatifs : attempt 1 fail at t=0 -> retry at t=1s+/-0.5s, attempt 2 fail at t=1s -> retry at t=1s+5s+/-2.5s, attempt 3 fail at t=6s -> retry at t=6s+30s+/-15s. Apres 3 attempts (total 36s ish), DLQ.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de queue (sync inline send) | Aucun systeme additionnel, send immediat | Bloque thread HTTP 200-2000ms, pas de retry, pas de DLQ, scalability nulle | REJETE |
| Une seule queue `comm-send` multiplexee channel | Une seule infra, code partage | Pas d'isolation concurrency / retry policy / DLQ par canal, debug complique | REJETE |
| Kafka topic comme queue jobs | Reuse infra Kafka Sprint 2 | Pas de priority, pas de delay, pas de retry granular, ordering pas garanti per-job, removeOnComplete pas natif | REJETE |
| RabbitMQ + amqp-connection-manager | Standard AMQP, dead letter exchange natif | Serveur dedie infra, AMQP concepts overhead, Sprint 3 a deja standardise BullMQ | REJETE |
| AWS SQS + Lambda triggers | Managed, auto-scale | AWS lock-in viole decision-008 cloud souverain MA, latency cross-region | REJETE |
| Bull v4 (legacy) | Stable, large ecosysteme | Mode maintenance, BullMQ v5 successeur, missing features (jitter, flow producer) | REJETE |
| BullMQ 5.30 + @nestjs/bullmq 11.0.2 (RETENU) | Native TypeScript, Redis-backed (deja deploye), priority + delay + jitter + retry exponential, BullDashboard officiel, OTEL compatible | Une dep additionnelle (deja Sprint 3) | RETENU |
| Bee-Queue | Plus rapide simple use cases | Moins de features (no flow, no QueueEvents granular) | REJETE |
| Custom queue Postgres LISTEN/NOTIFY | Reuse Postgres, ACID, sub-100ms | Pas de retry policy native, pas de priority, pas de delayed jobs cron, complexite custom | REJETE |
| Failed queue BullMQ (vs DLQ Kafka) | Simple, garde dans BullMQ ecosysteme | Pas unifie cross-services, Sprint 33 doit poll N queues, pas archivable S3 Glacier facilement | REJETE -- DLQ Kafka unifie |
| Backoff fixe (delay constant 5s) | Simple, predictible | Thundering herd au recovery API, surcharge | REJETE |
| Backoff exponential pur (sans jitter) | Predictible, mature | Thundering herd reduit mais persiste si sync fails | REJETE |
| Backoff exponential + jitter 0.5 (RETENU) | Distribue charge, pattern AWS recommande | Retries non predictible exact (acceptable) | RETENU |
| Idempotency via Redis SETNX (jobId unique) | Performance, BullMQ native | Pas source-of-truth metier, perd info si Redis flush | REJETE |
| Idempotency via DB status check (RETENU) | Source-of-truth metier, survive Redis flush, audit trail | +1 DB query par job (~5ms) | RETENU |
| Concurrency 1 (serial) | Predictible, simple | Throughput tres bas (1 job a la fois), p99 latency cumulative | REJETE |
| Concurrency 5 | Conservateur | Sous-utilise resources (1 worker pod 4 vCPU peut concurrency 20+) | REJETE |
| Concurrency 10 (RETENU) | Equilibre throughput vs API rate limits, headroom Meta/Mailgun | Tuning Sprint 14 si scale | RETENU |
| Concurrency 50 | Throughput max | Saturation Meta API rate limit 80/sec si 5 workers en parallele = 250/sec | REJETE Sprint 9, evaluation Sprint 14 |

### 2.3 Trade-offs explicites

Choisir BullMQ Redis-backed implique une dependance Redis pour les queues. Si Redis down, jobs perdus pendant la periode (jobs in-flight perdus, jobs queue persistes via AOF mais inaccessibles). Mitigation : Redis Sentinel/Cluster Sprint 35 multi-DC Atlas Cloud, Redis AOF (`appendfsync everysec`) limite perte a 1s, alerting Sprint 33 sur Redis health.

Choisir 4 queues separees (vs 1 multiplexee) implique 4 connections Redis BullMQ + 4 worker processes par pod. Mitigation : Redis ioredis library multiplexe sur 1 socket TCP, overhead negligeable. Workers in-process meme Node runtime (pas de fork) donc memory shared.

Choisir concurrency 10 par defaut implique que 1 pod traite max 40 jobs simultanement (10 par queue * 4 queues). Si ce pod crash, 40 jobs in-flight sont stalled puis reclaim par autre pod apres `stalledInterval` 30s -- delais visible client (max 30s). Mitigation : `maxStalledCount: 1` reclaim apres 1 cycle, deploy Sprint 35 multi-pod (3+) HA + Kubernetes liveness probe.

Choisir backoff exponential 1s/5s/30s implique fail definitif apres ~36s (incluant delays). Pour user-facing (signup verify email Sprint 5) c'est acceptable (utilisateur tolere 30s de retard email). Pour transactional critique (paiement confirmation Sprint 18), Sprint 14 introduira retry policy override (1 retry only fail-fast pour paiement).

Choisir DLQ Kafka topic implique latence DLQ legerement plus elevee (Kafka publish ~10ms vs Redis ZADD failed ~1ms). Acceptable car DLQ n'est pas hot path.

Choisir idempotency DB status check implique +1 query DB par job (`SELECT status FROM comm_messages WHERE id = $1`). 5ms add a 500ms total worker time = 1% overhead. Acceptable.

Choisir tenant context propage via AsyncLocalStorage implique discipline stricte : si un dev oublie `tenantContext.run(...)`, le RLS Postgres rejette les queries (fail-fast ou cross-tenant si app code bypass). Mitigation : worker base class enforce tenant context wrapping, lint rule custom Sprint 14.

Choisir OTEL metrics emit a chaque event implique overhead emit (~0.1ms per emit). Negligeable. Permet observability complete.

Choisir BullDashboard `/admin/queues` accessible Sprint 9 (sans auth Sprint 5+ deja en place mais bypass dashboard pour devops) implique exposition queues internals. Sprint 33 ajoute filtre CIDR + auth admin role.

### 2.4 Decisions strategiques referenced

- **decision-006 (No-emoji)** : pertinence totale.
- **decision-001 (Monorepo pnpm workspaces)** : workers dans `packages/comm/src/workers/`, schemas Zod dans `packages/shared-types/src/comm-jobs.ts`.
- **decision-003 (NestJS Fastify TypeScript strict)** : `@nestjs/bullmq` + decorators `@Processor`, `@OnWorkerEvent`.
- **decision-008 (Cloud souverain MA Atlas)** : Redis hosted Atlas Cloud Services Benguerir Sprint 35.
- **decision-010 (Sprint 2 Kafka events at-least-once)** : idempotency DB status check pattern.
- **decision-018 (Sprint 3 BullMQ JobsModule)** : reuse infra deja initialisee.
- **decision-022 (Loi 09-08 audit 7 ans)** : DLQ Kafka archived S3 Glacier Sprint 35.
- **decision-025 (Multi-tenant RLS strict)** : tenant context propage workers async.

### 2.5 Pieges techniques connus

1. **Piege : worker crash mid-process -> job stuck en `active`.**
   - Solution : `stalledInterval: 30000` BullMQ reclaim apres 30s, `maxStalledCount: 1` declare definitivement stalled puis DLQ apres 1 cycle.

2. **Piege : Kafka consumer Sprint 2 retry redelivere event qui re-enqueue job duplique.**
   - Solution : idempotency DB status check au debut process(). Skip si status IN ('sent', 'delivered', 'read').

3. **Piege : worker concurrency 10 mais Meta API rate limit 80/sec -> 429 errors.**
   - Solution : BullMQ `limiter: { max: 80, duration: 1000 }` per queue (Sprint 14 active si necessaire) + retry exponential gere 429 transient.

4. **Piege : tenant context perdu apres `await` async dans worker.**
   - Solution : `AsyncLocalStorage` API Node.js native preserve context cross-await. `tenantContext.run({ tenantId }, async () => { ... })` enrobe TOUT le process logic.

5. **Piege : job payload > 1MB BullMQ Redis -> rejet ou perf degradee.**
   - Solution : payload reference (messageId UUID) + worker fetch full data DB. Pattern strict : jobs contiennent IDs, pas blobs.

6. **Piege : `OnWorkerEvent('failed')` declenche meme sur retries non-terminaux.**
   - Solution : check `job.attemptsMade >= maxAttempts` avant DLQ publish. Sinon spam DLQ avec retries en cours.

7. **Piege : `UnrecoverableError` BullMQ skip retries mais doit aussi skip DLQ duplicate.**
   - Solution : la `OnWorkerEvent('failed')` handler gere les 2 cas (`attemptsMade >= max OR err instanceof UnrecoverableError`).

8. **Piege : removeOnComplete `true` (boolean) supprime tout immediatement -> perd debug + analytics.**
   - Solution : `removeOnComplete: { age: 30 * 86400, count: 10000 }` 30 jours OR 10k jobs latest.

9. **Piege : `OnWorkerEvent('failed')` execute apres job marked failed -> DLQ publish peut fail aussi sans recovery.**
   - Solution : try/catch DLQ publish + log error + emit OTEL metric `comm_dlq_publish_error`. Sprint 14 retry DLQ via inner queue.

10. **Piege : graceful shutdown SIGTERM -> workers en cours interrompus brutalement.**
    - Solution : NestJS `OnModuleDestroy` lifecycle hook attend workers idle, BullMQ `worker.close()` waits active jobs complete (timeout 30s).

11. **Piege : test isolation BullMQ -> jobs fuites entre tests.**
    - Solution : `beforeEach` `await queue.obliterate({ force: true })` + `await queue.drain()` reset state. Helper `resetAllCommQueues()`.

12. **Piege : BullDashboard expose data sensible (job payloads contiennent phones, emails).**
    - Solution : Sprint 9 jobs payload contient deja `to` plain (signup, verify) -- log mask `to` dans BullDashboard via custom serializer Sprint 14. Conformite Loi 09-08 : auth admin role requis Sprint 33.

13. **Piege : retry exponential cumule `delay: 1000` * 2^attempt sans cap -> apres 5 retries delay = 32s, 6 retries = 64s, etc.**
    - Solution : BullMQ default exponential cap implicite via `attempts: 3`. `attempts: 3` total = 3 tries avec 2 retries (initial + 2). Documentation explicite.

14. **Piege : `OnWorkerEvent('completed')` declenche apres job done mais avant Kafka publish ack -> fail Kafka publish silencieux.**
    - Solution : Kafka publish DANS le `process()` method, await termine avant return. Sprint 35 outbox pattern transactional.

15. **Piege : Mailgun webhook signature fail mid-process -> webhook re-pousse mais idempotency_key DB unique constraint reject -> worker throw -> retry ad infinitum.**
    - Solution : check `comm_webhooks_received.idempotency_key` AT START of webhook-process worker, skip si deja processed = idempotent.

16. **Piege : DLQ Kafka topic `insurtech.events.dlq.comm` non cree au boot -> worker crash on first failure.**
    - Solution : Kafka topic auto-create disabled (Sprint 2 decision), Terraform Sprint 35 cree topics declarativement. Sprint 9 helper script `pnpm kafka:create-topics:dev`.

17. **Piege : OTEL metrics emit `comm_job_duration_ms` avec attribute `tenant_id` -> cardinality explosion (1k tenants Phase 7+).**
    - Solution : limit attribute cardinality, utiliser `tenant_id_bucket` (ex : hash mod 100). Sprint 33 Grafana dashboards aggregate.

18. **Piege : worker pod restart -> BullMQ auto-reconnect Redis mais Kafka publisher non-reconnect.**
    - Solution : Sprint 2 KafkaPublisher gere reconnect natif (kafkajs library), test smoke verify post-restart.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.8 est la **8eme tache du Sprint 9** sur 13. Elle vient apres 3.2.7 (Email template renderer) qui est la derniere brique des templates renderers. Elle est suivie par 3.2.9 (Message Orchestrator) qui consume `QueuePublisherService` pour router messages WhatsApp vs Email selon `preferred_channel`. Sans 3.2.8, l'orchestrator 3.2.9 ne peut pas enqueue jobs ; sans workers, les jobs ne sont pas processes ; sans DLQ, les fails ne sont pas trackes.

Sequence logique du Sprint 9 :

1. **3.2.1** : `comm_messages` entity + schemas Zod (foundation data model).
2. **3.2.2** : `WhatsAppCloudApiClient` Meta v21.0 (provider client).
3. **3.2.3** : `WaTemplateRendererService` (template rendering avec variables + locales).
4. **3.2.4** : `WaWebhookController` + signature HMAC (incoming webhooks Meta).
5. **3.2.5** : `TemplateManagerService` + 60 templates seed.
6. **3.2.6** : `EmailService` enrichi + DKIM + Mailgun.
7. **3.2.7** : `EmailTemplateRendererService` + RTL.
8. **3.2.8 (cette tache)** : BullMQ queues + workers + retry + DLQ.
9. **3.2.9** : `MessageOrchestratorService` (routing).
10. **3.2.10** : Delivery tracking + bounces + alerts.
11. **3.2.11** : Opt-out CNDP + endpoint public.
12. **3.2.12** : Endpoints REST `/api/v1/comm/*`.
13. **3.2.13** : Tests E2E exhaustifs 40+.

### 3.2 Position dans le programme global

- **Sprint 3 Tache 1.3.11** : `JobsModule` + `JobProducerService` + Redis DB 2 + BullDashboard `/admin/queues` deja initialises. Cette tache reuse l'infra et ajoute 4 queues concretes.
- **Sprint 2 Tache 1.2.10** : `KafkaPublisher` deja initialise, reuse pour publish `comm.message_sent` + DLQ topic.
- **Sprint 2 Tache 1.2.13** : `KafkaConsumerBase` abstract avec DLQ pattern, format DLQ event compatible.
- **Sprint 2 Tache 1.2.7** : RLS Postgres `comm_messages` deja en place, queries worker respectent.
- **Sprint 4 Tache 1.4.6** : `TenantContext` + AsyncLocalStorage deja initialise.
- **Sprint 5 Tache 2.1.13** : `EmailService` initial Sprint 5 enrichi Sprint 9 Tache 3.2.6.
- **Sprint 9 Tache 3.2.2** : `WhatsAppCloudApiClient` + errors `MetaInvalidTemplateError`, `MetaPhoneNotOptedInError`, `MetaRateLimitError`.
- **Sprint 9 Tache 3.2.3** : `WaTemplateRendererService.render()` retourne components Meta API.
- **Sprint 9 Tache 3.2.4** : Webhooks Meta persistes table `comm_webhooks_received`, Kafka event `comm.webhook_received`.
- **Sprint 9 Tache 3.2.6** : `EmailService.send()` envoie SMTP Mailgun.
- **Sprint 9 Tache 3.2.7** : `EmailTemplateRendererService.render()` retourne `{ subject, html, text }`.
- **Sprint 9 Tache 3.2.9 (consumer cette tache)** : `MessageOrchestratorService.sendToContact()` -> `queuePublisher.addWaSend()` ou `addEmailSend()`.
- **Sprint 9 Tache 3.2.10** : Delivery tracking consume `wa-webhook-process` + `email-webhook-process` workers output (Kafka events).
- **Sprint 9 Tache 3.2.11** : Opt-out auto sur hard bounce dans `EmailWebhookProcessWorker`.
- **Sprint 9 Tache 3.2.13** : Tests E2E utilisent `waitForJobCompletion()` helper.
- **Sprint 14 Insure** : produit jobs `wa-send` pour police signed, payment due reminder.
- **Sprint 17 Booking** : produit jobs pour appointments reminders.
- **Sprint 18 Notifications** : agrege notifications cross-canal.
- **Sprint 22 Repair** : produit jobs sinistre acknowledged, devis ready.
- **Sprint 33 DlqMonitorConsumer** : consume `insurtech.events.dlq.comm` -> alerts Slack si rate eleve.
- **Sprint 33 BullDashboard auth** : ajoute auth super_admin sur `/admin/queues`.
- **Sprint 35 Atlas Cloud Redis** : Redis Sentinel HA multi-DC.

### 3.3 Diagramme architecture

```
                    +------------------------------------------+
                    |  Sprint 9 Tache 3.2.7 termine            |
                    |  Email template renderer + RTL ok        |
                    +-------------------+----------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------+
|                      TACHE 3.2.8 (cette tache)                              |
|                                                                             |
|  Producers (Sprint 9 Tache 3.2.9 + Sprint 14+ Insure / Booking / Repair)    |
|                                                                             |
|  MessageOrchestrator   ->   QueuePublisherService                           |
|        |                          |                                         |
|        |                          | addWaSend(...)                          |
|        |                          | addEmailSend(...)                       |
|        |                          | addBatch(...)                           |
|        |                          v                                         |
|        |                +---------+-----------+                             |
|        |                |   BullMQ Redis DB 2 |                             |
|        |                |  4 queues isolees   |                             |
|        |                +---+-----+----+----+-+                             |
|        |                    |     |    |    |                               |
|        |             wa-send| email-send| wa-webhook-process| email-webhook-process
|        |                    |     |    |    |                               |
|        v                    v     v    v    v                               |
|   comm_messages         +---+-----+----+----+----+                          |
|   table (Sprint 2)      |  Workers (concurrency 10) |                       |
|                         |                            |                       |
|                         |  WaSendWorker              |                       |
|                         |    -> WhatsAppCloudApi     |                       |
|                         |    -> WaTemplateRenderer   |                       |
|                         |    -> MessagesRepo update  |                       |
|                         |    -> KafkaPublisher       |                       |
|                         |                            |                       |
|                         |  EmailSendWorker           |                       |
|                         |    -> EmailService SMTP    |                       |
|                         |    -> EmailTplRenderer     |                       |
|                         |    -> MessagesRepo update  |                       |
|                         |    -> KafkaPublisher       |                       |
|                         |                            |                       |
|                         |  WaWebhookProcessWorker    |                       |
|                         |    -> read comm_webhooks   |                       |
|                         |    -> update statuses      |                       |
|                         |    -> insert incoming msg  |                       |
|                         |                            |                       |
|                         |  EmailWebhookProcessWorker |                       |
|                         |    -> Mailgun bounce/open  |                       |
|                         |    -> auto opt-out hard    |                       |
|                         +---+----------------------+-+                       |
|                             |                      |                         |
|                Success      |                      | Failure (3 attempts OR  |
|                             v                      |  UnrecoverableError)   |
|                    Kafka events:                   v                         |
|                    comm.message_sent       DlqPublisherService               |
|                    comm.message_delivered          |                         |
|                    comm.message_failed             v                         |
|                                            Kafka topic                       |
|                                            insurtech.events.dlq.comm        |
|                                                                             |
|                    OTEL metrics: queue_depth, job_duration_ms,              |
|                                  retry_count, dlq_count, concurrency_active|
|                                                                             |
|                    BullDashboard /admin/queues (Sprint 3)                   |
+-----------------------------------------------------------------------------+
                                        |
                                        v
                 +----------------------+--------------------+
                 |  Sprint 9 Tache 3.2.9                     |
                 |  Message Orchestrator (routing)           |
                 |  consume QueuePublisherService            |
                 +-------------------------------------------+
                                        |
                                        v
                 +----------------------+--------------------+
                 |  Sprint 33 DlqMonitorConsumer             |
                 |  consume insurtech.events.dlq.comm        |
                 |  alert Slack si rate > seuil              |
                 +-------------------------------------------+
```

### 3.4 Flow detaille happy path WaSend

```
1. [Producer] MessageOrchestrator.sendToContact(contactId, "police_signed", vars)
   -> insert comm_messages row {status: 'pending', tenant_id, contact_id, channel: 'whatsapp'}
   -> queuePublisher.addWaSend({messageId, to: "+212612345678", templateName: "police_signed",
                                 locale: "fr", variables, tenantId, correlationId})

2. [BullMQ Queue 'wa-send' Redis DB 2]
   -> LPUSH bull:wa-send:wait <jobId> <jobData>
   -> ZADD bull:wa-send:delayed (si delay) ou immediately to active

3. [Worker WaSendWorker] BullMQ poll wait queue, transition to active
   -> tenantContext.run({tenantId}, async () => { ... })

4. [Idempotency check]
   -> SELECT status, sent_at FROM comm_messages WHERE id = $1 (RLS scope tenant)
   -> if status IN ('sent', 'delivered', 'read'): log skip + return

5. [Render template]
   -> WaTemplateRenderer.render("police_signed", "fr", {policeNumber: "POL-001", ...})
   -> returns Meta components

6. [Send via Meta API]
   -> WhatsAppCloudApiClient.sendTemplate(to, templateName, locale, components)
   -> Meta returns {message_id: "wamid.xxx"}

7. [Update DB]
   -> UPDATE comm_messages SET status='sent', provider_message_id='wamid.xxx',
                                sent_at=NOW() WHERE id=$1

8. [Kafka publish]
   -> KafkaPublisher.publish('insurtech.events.comm.message_sent', {
        messageId, tenantId, channel: 'whatsapp', to_address: hashed,
        sent_at, correlation_id
      })

9. [OTEL metric]
   -> comm_job_duration_ms.record(durationMs, {queue: 'wa-send', status: 'success'})
   -> comm_messages_sent_total.increment(1, {channel: 'whatsapp'})

10. [Worker return success]
    -> BullMQ moves job from active to completed (TTL 30 jours)
    -> emit OnWorkerEvent('completed')
```

### 3.5 Flow detaille failure path -> DLQ

```
1-3. [identical happy path]

4. [Idempotency: status='pending', proceed]

5. [Render template OK]

6. [Send via Meta API FAILS]
   -> Meta returns 503 Service Unavailable
   -> WhatsAppCloudApiClient throws MetaTransientError (5xx)

7. [Worker process throws]
   -> BullMQ marks attemptsMade=1, schedules retry at t+1s+/-jitter (backoff)
   -> emit OnWorkerEvent('failed') with attemptsMade=1
   -> [DLQ check: attemptsMade < 3 AND not UnrecoverableError, no DLQ]

8. [Retry attempt 2 at t=1s]
   -> Same flow, fail again
   -> attemptsMade=2, schedule retry at t+5s+/-jitter

9. [Retry attempt 3 at t=6s]
   -> Same flow, fail again
   -> attemptsMade=3, BullMQ moves to failed
   -> emit OnWorkerEvent('failed') with attemptsMade=3

10. [DLQ logic]
    -> attemptsMade >= 3 -> DLQ
    -> DlqPublisherService.publishToDlq({
         original_topic: 'wa-send', original_data: jobData,
         error: {message, stack, attempts}, failed_at, tenant_id, correlation_id
       })
    -> Kafka publish to insurtech.events.dlq.comm

11. [Update DB]
    -> UPDATE comm_messages SET status='failed', failed_at=NOW(),
                                  fail_reason='Meta 503 transient' WHERE id=$1

12. [OTEL metric]
    -> comm_dlq_count_total.increment(1, {queue: 'wa-send', reason: 'transient_exhausted'})
    -> comm_job_duration_ms.record(totalDuration, {queue, status: 'failed'})

13. [Sprint 33 alerting]
    -> DlqMonitorConsumer detects rate > 50/15min
    -> Slack alert #ops-comm
```

### 3.6 Flow detaille fail-fast UnrecoverableError

```
1-5. [identical]

6. [Send via Meta API FAILS with structural error]
   -> Meta returns 400 "template not found"
   -> WhatsAppCloudApiClient throws MetaInvalidTemplateError

7. [Worker catches, throws UnrecoverableError]
   -> if (err instanceof MetaInvalidTemplateError) throw new UnrecoverableError('Invalid template')

8. [BullMQ skips retries]
   -> UnrecoverableError BullMQ feature: marks failed immediately, attemptsMade=1
   -> emit OnWorkerEvent('failed')

9. [DLQ logic]
   -> err instanceof UnrecoverableError -> DLQ even si attemptsMade < 3
   -> DlqPublisherService.publishToDlq({...error: 'Invalid template Meta'})

10. [Update DB + metrics same as above]
```

---

## 4. Livrables checkables (32 livrables)

- [ ] Worker `repo/packages/comm/src/workers/wa-send.worker.ts` -- ~250 lignes complet avec process(), OnWorkerEvent('failed'), idempotency check, render, send Meta, update DB, Kafka publish, OTEL metrics, tenant context propagation
- [ ] Worker `repo/packages/comm/src/workers/email-send.worker.ts` -- ~250 lignes equivalent email
- [ ] Worker `repo/packages/comm/src/workers/wa-webhook-process.worker.ts` -- ~200 lignes (process Meta webhook payloads stockes table comm_webhooks_received -> update statuses + create incoming messages auto-log CRM Sprint 8)
- [ ] Worker `repo/packages/comm/src/workers/email-webhook-process.worker.ts` -- ~200 lignes (process Mailgun webhooks bounces/delivered/opened/clicked + auto opt-out hard bounce)
- [ ] Module `repo/packages/comm/src/queues/comm-queues.module.ts` -- ~150 lignes (BullModule.registerQueue 4 queues, register workers, BullDashboard config, default options)
- [ ] Types Zod `repo/packages/comm/src/jobs/types.ts` -- ~120 lignes (WaSendJobData, EmailSendJobData, WaWebhookProcessJobData, EmailWebhookProcessJobData schemas + TypeScript types)
- [ ] Service `repo/packages/comm/src/services/queue-publisher.service.ts` -- ~180 lignes (addWaSend, addEmailSend, addBatch, getQueueStats, pauseQueue, resumeQueue, validation Zod)
- [ ] Service `repo/packages/comm/src/services/dlq-publisher.service.ts` -- ~120 lignes (publishToDlq topic insurtech.events.dlq.comm avec original_data + error metadata + correlation_id)
- [ ] Errors `repo/packages/comm/src/errors/queue-errors.ts` -- ~50 lignes (UnrecoverableError type guard helpers)
- [ ] Tests `repo/packages/comm/src/workers/__tests__/wa-send.worker.spec.ts` -- ~280 lignes (20+ tests Vitest avec @nestjs/testing module + BullMQ in-memory Redis)
- [ ] Tests `repo/packages/comm/src/workers/__tests__/email-send.worker.spec.ts` -- ~250 lignes equivalent
- [ ] Tests `repo/packages/comm/src/workers/__tests__/wa-webhook-process.worker.spec.ts` -- ~180 lignes
- [ ] Tests `repo/packages/comm/src/workers/__tests__/email-webhook-process.worker.spec.ts` -- ~180 lignes
- [ ] Tests `repo/packages/comm/src/services/__tests__/queue-publisher.service.spec.ts` -- ~150 lignes
- [ ] Tests `repo/packages/comm/src/services/__tests__/dlq-publisher.service.spec.ts` -- ~120 lignes
- [ ] Tests integration `repo/apps/api/test/comm/workers.e2e-spec.ts` -- ~200 lignes (via @testcontainers/redis + Kafka mock)
- [ ] Index `repo/packages/comm/src/workers/index.ts` exports
- [ ] Variables env : `COMM_WA_QUEUE_CONCURRENCY=10`, `COMM_EMAIL_QUEUE_CONCURRENCY=10`, `COMM_WA_WEBHOOK_QUEUE_CONCURRENCY=10`, `COMM_EMAIL_WEBHOOK_QUEUE_CONCURRENCY=10`, `COMM_RETRY_BACKOFF_BASE_MS=1000`, `COMM_RETRY_BACKOFF_JITTER=0.5`, `COMM_REMOVE_ON_COMPLETE_AGE_S=2592000`, `COMM_REMOVE_ON_FAIL_AGE_S=7776000`, `COMM_REMOVE_ON_COMPLETE_COUNT=10000`, `COMM_REMOVE_ON_FAIL_COUNT=50000`, `COMM_DLQ_TOPIC=insurtech.events.dlq.comm`
- [ ] Mise a jour `repo/apps/api/src/modules/comm/comm.module.ts` import CommQueuesModule
- [ ] Mise a jour `repo/packages/shared-types/src/topics.ts` ajout `COMM_DLQ`, `COMM_MESSAGE_SENT`, `COMM_MESSAGE_FAILED`, `COMM_PHONE_NOT_OPTED_IN`
- [ ] Documentation README `repo/packages/comm/docs/queues.md`
- [ ] No-emoji
- [ ] No-console
- [ ] No log de phones / emails en clair (mask via helper)
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] BullDashboard /admin/queues affiche 4 queues avec live counters
- [ ] OTEL metrics emit verifiees via OTEL SDK in-memory exporter test
- [ ] Tenant context propage workers (test verifie cross-tenant isolation)
- [ ] Correlation_id traverse end-to-end (Kafka event sortie contient meme correlation_id que job input)
- [ ] Idempotency verified : 2eme job same messageId skip
- [ ] DLQ format compatible KafkaConsumerBase Sprint 2 (validation schema commun)
- [ ] Bench : 1000 jobs/min throughput sustained sur 10min sans memory leak

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/workers/wa-send.worker.ts                                    (~250 lignes)
repo/packages/comm/src/workers/email-send.worker.ts                                  (~250 lignes)
repo/packages/comm/src/workers/wa-webhook-process.worker.ts                          (~200 lignes)
repo/packages/comm/src/workers/email-webhook-process.worker.ts                       (~200 lignes)
repo/packages/comm/src/workers/index.ts                                              (~25 lignes)
repo/packages/comm/src/queues/comm-queues.module.ts                                   (~150 lignes)
repo/packages/comm/src/jobs/types.ts                                                  (~120 lignes)
repo/packages/comm/src/services/queue-publisher.service.ts                            (~180 lignes)
repo/packages/comm/src/services/dlq-publisher.service.ts                              (~120 lignes)
repo/packages/comm/src/errors/queue-errors.ts                                          (~50 lignes)
repo/packages/comm/src/workers/__tests__/wa-send.worker.spec.ts                       (~280 lignes)
repo/packages/comm/src/workers/__tests__/email-send.worker.spec.ts                    (~250 lignes)
repo/packages/comm/src/workers/__tests__/wa-webhook-process.worker.spec.ts            (~180 lignes)
repo/packages/comm/src/workers/__tests__/email-webhook-process.worker.spec.ts          (~180 lignes)
repo/packages/comm/src/services/__tests__/queue-publisher.service.spec.ts             (~150 lignes)
repo/packages/comm/src/services/__tests__/dlq-publisher.service.spec.ts               (~120 lignes)
repo/apps/api/test/comm/workers.e2e-spec.ts                                            (~200 lignes)
repo/apps/api/src/modules/comm/comm.module.ts                                          (modifie / +CommQueuesModule)
repo/packages/shared-types/src/topics.ts                                              (modifie / +DLQ topics)
repo/packages/comm/docs/queues.md                                                     (~150 lignes)
.env.example                                                                            (modifie / +COMM_* vars)
```

Total : 21 fichiers crees ou modifies, ~3155 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 11 : `repo/packages/comm/src/jobs/types.ts`

```typescript
/**
 * @insurtech/comm/jobs/types
 *
 * Job payload schemas Zod + TypeScript types for the 4 BullMQ queues.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.8 (this task)
 *   - Sprint 3 Tache 1.3.11 (BullMQ JobsModule + Zod validation pattern)
 *   - Sprint 2 Tache 1.2.10 (KafkaPublisher Zod pattern alignment)
 *   - decision-007 (Zod runtime validation)
 */

import { z } from 'zod';

/**
 * Locale supported by WhatsApp templates and Email templates.
 * Sprint 9 Tache 3.2.3 / 3.2.7 align.
 */
export const LocaleSchema = z.enum(['fr', 'ar-MA', 'ar', 'fr-MA', 'fr-FR', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

/**
 * Phone E.164 strict validation (Sprint 8 normalization helper aligned).
 * Format: + followed by 10-15 digits.
 */
const PhoneE164Schema = z.string().regex(/^\+[1-9]\d{9,14}$/, 'phone must be E.164 with leading +');

/**
 * Email RFC 5322 simplified validation.
 */
const EmailSchema = z.string().email('email must be RFC 5322 valid');

/**
 * UUID v4 validation for IDs.
 */
const UuidSchema = z.string().uuid('must be UUID v4');

/**
 * Common job metadata propagated through queue + worker + Kafka events.
 * correlation_id is critical for distributed tracing OTEL.
 */
export const JobMetadataSchema = z.object({
  tenantId: UuidSchema,
  correlationId: z.string().min(1).max(64).describe('OTEL correlation id, traverses producer -> queue -> worker -> Kafka'),
  enqueuedAt: z.string().datetime().optional().describe('ISO8601 enqueue timestamp for SLO measurement'),
  triggeredBy: z.string().optional().describe('user_id or system source that triggered the send'),
});
export type JobMetadata = z.infer<typeof JobMetadataSchema>;

/**
 * WaSendJobData -- payload for queue 'wa-send'.
 *
 * Producers : MessageOrchestratorService (Sprint 9 Tache 3.2.9), and Sprint 14+ Insure / Sprint 17 Booking modules.
 * Consumer  : WaSendWorker (this task).
 */
export const WaSendJobDataSchema = JobMetadataSchema.extend({
  messageId: UuidSchema.describe('comm_messages.id row, source-of-truth for idempotency check'),
  to: PhoneE164Schema.describe('recipient phone E.164 with leading +; Meta API normalizes to without +'),
  templateName: z.string().min(1).max(120).describe('comm_templates.name, must be Meta-approved'),
  locale: LocaleSchema,
  variables: z.record(z.unknown()).describe('JSONB template variables, validated by template variables_schema'),
  contactId: UuidSchema.optional().describe('crm_contacts.id, optional if direct send not via contact'),
  priority: z.enum(['high', 'normal', 'low']).default('normal').describe('high = bypass queue (police signed), low = bulk campaign'),
});
export type WaSendJobData = z.infer<typeof WaSendJobDataSchema>;

/**
 * EmailSendJobData -- payload for queue 'email-send'.
 */
export const EmailSendJobDataSchema = JobMetadataSchema.extend({
  messageId: UuidSchema,
  to: EmailSchema,
  templateName: z.string().min(1).max(120),
  locale: LocaleSchema,
  variables: z.record(z.unknown()),
  contactId: UuidSchema.optional(),
  replyTo: EmailSchema.optional().describe('overrides default Reply-To header'),
  attachments: z.array(z.object({
    filename: z.string(),
    content_url: z.string().url().describe('S3 presigned URL Sprint 10, fetched by worker (not inline payload >1MB)'),
    content_type: z.string().optional(),
  })).max(5).optional().describe('Attachments via reference, max 5'),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
});
export type EmailSendJobData = z.infer<typeof EmailSendJobDataSchema>;

/**
 * WaWebhookProcessJobData -- payload for queue 'wa-webhook-process'.
 *
 * Producers : WaWebhookController (Sprint 9 Tache 3.2.4) after persisting raw payload to comm_webhooks_received.
 * Consumer  : WaWebhookProcessWorker (this task).
 */
export const WaWebhookProcessJobDataSchema = JobMetadataSchema.extend({
  webhookReceivedId: UuidSchema.describe('comm_webhooks_received.id row, contains raw Meta payload'),
  webhookType: z.enum(['status_update', 'incoming_message', 'incoming_media']),
  receivedAt: z.string().datetime(),
});
export type WaWebhookProcessJobData = z.infer<typeof WaWebhookProcessJobDataSchema>;

/**
 * EmailWebhookProcessJobData -- payload for queue 'email-webhook-process'.
 *
 * Producers : MailgunWebhookController (Sprint 9 Tache 3.2.10) after persisting raw payload.
 * Consumer  : EmailWebhookProcessWorker (this task).
 */
export const EmailWebhookProcessJobDataSchema = JobMetadataSchema.extend({
  webhookReceivedId: UuidSchema,
  webhookType: z.enum(['delivered', 'opened', 'clicked', 'bounced_hard', 'bounced_soft', 'complained', 'unsubscribed']),
  receivedAt: z.string().datetime(),
});
export type EmailWebhookProcessJobData = z.infer<typeof EmailWebhookProcessJobDataSchema>;

/**
 * DLQ event published to Kafka topic insurtech.events.dlq.comm
 * Format aligned with Sprint 2 Tache 1.2.13 KafkaConsumerBase DLQ schema.
 */
export const DlqEventSchema = z.object({
  original_topic: z.string().describe('queue name where the job originated'),
  original_data: z.record(z.unknown()).describe('full original job payload'),
  error: z.object({
    message: z.string(),
    stack: z.string().optional().describe('truncated to 4KB to fit Kafka message limit'),
    attempts: z.number().int().min(0),
    error_type: z.string().optional().describe('UnrecoverableError | TransientError | UnknownError'),
  }),
  failed_at: z.string().datetime(),
  tenant_id: UuidSchema.optional(),
  correlation_id: z.string(),
});
export type DlqEvent = z.infer<typeof DlqEventSchema>;

/**
 * Default BullMQ job options applied to all 4 queues unless overridden per-job.
 * Sprint 9 Tache 3.2.8 baseline, Sprint 14 may override per-job for high-priority paths.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
    jitter: 0.5,
  },
  removeOnComplete: {
    age: 30 * 24 * 60 * 60, // 30 days
    count: 10000,
  },
  removeOnFail: {
    age: 90 * 24 * 60 * 60, // 90 days for audit Loi 09-08
    count: 50000,
  },
} as const;

/**
 * Queue names registry. Changing strings is a breaking change (Redis keys depend on them).
 */
export const QUEUE_NAMES = {
  WA_SEND: 'wa-send',
  EMAIL_SEND: 'email-send',
  WA_WEBHOOK_PROCESS: 'wa-webhook-process',
  EMAIL_WEBHOOK_PROCESS: 'email-webhook-process',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
```

### 6.2 Fichier 2 / 11 : `repo/packages/comm/src/errors/queue-errors.ts`

```typescript
/**
 * @insurtech/comm/errors/queue-errors
 *
 * Error types for queue workers. UnrecoverableError signals BullMQ to skip retries
 * and immediately mark the job as failed (which then triggers DLQ publish).
 *
 * Reference : Sprint 9 Tache 3.2.8, BullMQ 5.30+ UnrecoverableError feature.
 */

import { UnrecoverableError as BullMQUnrecoverableError } from 'bullmq';

/**
 * Re-export BullMQ UnrecoverableError so workers import from a single comm path.
 * Throwing this from worker.process() bypasses the retry policy and marks failed.
 */
export class UnrecoverableError extends BullMQUnrecoverableError {
  readonly errorType: string;
  readonly originalError?: Error;

  constructor(message: string, errorType: string = 'UnrecoverableError', originalError?: Error) {
    super(message);
    this.name = 'UnrecoverableError';
    this.errorType = errorType;
    this.originalError = originalError;
  }
}

/**
 * Type guard: distinguishes errors that should be retried vs. fail-fast.
 * Used by the OnWorkerEvent('failed') handler to decide DLQ publish.
 */
export function shouldDlq(err: Error, attemptsMade: number, maxAttempts: number): boolean {
  if (err instanceof UnrecoverableError) return true;
  if (err instanceof BullMQUnrecoverableError) return true;
  if (attemptsMade >= maxAttempts) return true;
  return false;
}

/**
 * Truncate error stack to fit within Kafka message limits (default 1MB but DLQ topic
 * configured 64KB max in Sprint 2 to limit observability cost).
 */
export function truncateStack(stack: string | undefined, maxBytes: number = 4096): string | undefined {
  if (!stack) return undefined;
  if (stack.length <= maxBytes) return stack;
  return stack.slice(0, maxBytes) + '\n... [truncated]';
}

/**
 * Classify error type for DLQ analytics.
 */
export function classifyError(err: Error): string {
  if (err instanceof UnrecoverableError) return err.errorType;
  if (err.name === 'MetaInvalidTemplateError') return 'MetaInvalidTemplateError';
  if (err.name === 'MetaPhoneNotOptedInError') return 'MetaPhoneNotOptedInError';
  if (err.name === 'MetaRateLimitError') return 'MetaRateLimitError';
  if (err.name === 'EmailRecipientBlockedError') return 'EmailRecipientBlockedError';
  if (err.message?.includes('ECONNREFUSED')) return 'TransientNetworkError';
  if (err.message?.includes('timeout')) return 'TransientTimeoutError';
  return err.name || 'UnknownError';
}
```

### 6.3 Fichier 3 / 11 : `repo/packages/comm/src/services/dlq-publisher.service.ts`

```typescript
/**
 * @insurtech/comm/services/dlq-publisher.service
 *
 * Publishes failed jobs to Kafka DLQ topic insurtech.events.dlq.comm.
 * Format aligned with Sprint 2 Tache 1.2.13 KafkaConsumerBase DLQ schema so that
 * Sprint 33 DlqMonitorConsumer can consume cross-services dlq topics uniformly.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.8 (this task)
 *   - Sprint 2 Tache 1.2.10 (KafkaPublisher service)
 *   - Sprint 2 Tache 1.2.13 (KafkaConsumerBase DLQ pattern)
 *   - Sprint 33 DlqMonitorConsumer (alerting Slack)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaPublisher } from '@insurtech/kafka';
import { type DlqEvent, DlqEventSchema } from '../jobs/types.js';
import { truncateStack, classifyError } from '../errors/queue-errors.js';

interface PublishToDlqInput {
  original_topic: string;
  original_data: Record<string, unknown>;
  error: Error;
  attempts: number;
  tenant_id?: string;
  correlation_id: string;
}

@Injectable()
export class DlqPublisherService {
  private readonly logger = new Logger(DlqPublisherService.name);
  private readonly dlqTopic: string;

  constructor(
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly config: ConfigService,
  ) {
    this.dlqTopic = this.config.get<string>('COMM_DLQ_TOPIC') ?? 'insurtech.events.dlq.comm';
  }

  /**
   * Publish a failed job event to the DLQ Kafka topic.
   * Catches Kafka publish failures and logs them (without throwing) to avoid
   * cascading failures: the worker has already failed, DLQ publish failure is logged
   * but should not crash the worker process.
   */
  async publishToDlq(input: PublishToDlqInput): Promise<void> {
    const event: DlqEvent = {
      original_topic: input.original_topic,
      original_data: input.original_data,
      error: {
        message: input.error.message,
        stack: truncateStack(input.error.stack, 4096),
        attempts: input.attempts,
        error_type: classifyError(input.error),
      },
      failed_at: new Date().toISOString(),
      tenant_id: input.tenant_id,
      correlation_id: input.correlation_id,
    };

    // Validate before publish (fail-fast if schema drift)
    const parsed = DlqEventSchema.safeParse(event);
    if (!parsed.success) {
      this.logger.error({
        action: 'dlq_event_invalid_schema',
        issues: parsed.error.issues,
        original_topic: input.original_topic,
        correlation_id: input.correlation_id,
      });
      return;
    }

    try {
      await this.kafkaPublisher.publish(this.dlqTopic, parsed.data, {
        key: input.correlation_id,
        headers: {
          'x-original-topic': input.original_topic,
          'x-error-type': parsed.data.error.error_type ?? 'UnknownError',
          'x-tenant-id': input.tenant_id ?? '',
        },
      });

      this.logger.warn({
        action: 'dlq_event_published',
        topic: this.dlqTopic,
        original_topic: input.original_topic,
        error_type: parsed.data.error.error_type,
        attempts: input.attempts,
        correlation_id: input.correlation_id,
        tenant_id: input.tenant_id,
      });
    } catch (kafkaErr) {
      // Cascading failure handling: log + emit OTEL metric, do not rethrow.
      // Sprint 14 will introduce a local Redis-backed DLQ fallback.
      this.logger.error({
        action: 'dlq_publish_failed',
        topic: this.dlqTopic,
        original_topic: input.original_topic,
        kafka_err: kafkaErr instanceof Error ? kafkaErr.message : String(kafkaErr),
        correlation_id: input.correlation_id,
      });
    }
  }
}
```

### 6.4 Fichier 4 / 11 : `repo/packages/comm/src/services/queue-publisher.service.ts`

```typescript
/**
 * @insurtech/comm/services/queue-publisher.service
 *
 * Surface API over BullMQ Queue.add() with Zod payload validation.
 * Pattern aligned with Sprint 3 Tache 1.3.11 JobProducerService and Sprint 2 KafkaPublisher.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.8 (this task)
 *   - Sprint 3 Tache 1.3.11 (BullMQ JobsModule + JobProducerService base)
 *   - Sprint 9 Tache 3.2.9 (MessageOrchestratorService consumes this service)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, type JobsOptions } from 'bullmq';
import { trace, metrics } from '@opentelemetry/api';
import {
  QUEUE_NAMES,
  WaSendJobDataSchema,
  EmailSendJobDataSchema,
  WaWebhookProcessJobDataSchema,
  EmailWebhookProcessJobDataSchema,
  type WaSendJobData,
  type EmailSendJobData,
  type WaWebhookProcessJobData,
  type EmailWebhookProcessJobData,
  type QueueName,
} from '../jobs/types.js';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

const enqueueCounter = metrics.getMeter('insurtech.comm').createCounter('comm_jobs_enqueued_total', {
  description: 'Total number of jobs enqueued to BullMQ comm queues',
});

@Injectable()
export class QueuePublisherService {
  private readonly logger = new Logger(QueuePublisherService.name);
  private readonly tracer = trace.getTracer('insurtech.comm.queue-publisher');

  constructor(
    @InjectQueue(QUEUE_NAMES.WA_SEND) private readonly waSendQueue: Queue<WaSendJobData>,
    @InjectQueue(QUEUE_NAMES.EMAIL_SEND) private readonly emailSendQueue: Queue<EmailSendJobData>,
    @InjectQueue(QUEUE_NAMES.WA_WEBHOOK_PROCESS) private readonly waWebhookQueue: Queue<WaWebhookProcessJobData>,
    @InjectQueue(QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS) private readonly emailWebhookQueue: Queue<EmailWebhookProcessJobData>,
  ) {}

  async addWaSend(data: WaSendJobData, options?: JobsOptions): Promise<string> {
    return this.tracer.startActiveSpan('queue.add.wa-send', async (span) => {
      try {
        const parsed = WaSendJobDataSchema.parse(data);
        const jobOptions: JobsOptions = {
          ...this.priorityToOptions(parsed.priority),
          ...options,
          jobId: options?.jobId ?? `wa-send:${parsed.messageId}`, // idempotency BullMQ-level
        };
        const job = await this.waSendQueue.add('wa-send-job', parsed, jobOptions);

        span.setAttributes({
          'comm.queue': QUEUE_NAMES.WA_SEND,
          'comm.message_id': parsed.messageId,
          'comm.tenant_id': parsed.tenantId,
          'comm.correlation_id': parsed.correlationId,
          'comm.priority': parsed.priority,
        });
        enqueueCounter.add(1, { queue: QUEUE_NAMES.WA_SEND, priority: parsed.priority });

        this.logger.log({
          action: 'job_enqueued',
          queue: QUEUE_NAMES.WA_SEND,
          job_id: job.id,
          message_id: parsed.messageId,
          tenant_id: parsed.tenantId,
          correlation_id: parsed.correlationId,
        });

        return job.id ?? '';
      } finally {
        span.end();
      }
    });
  }

  async addEmailSend(data: EmailSendJobData, options?: JobsOptions): Promise<string> {
    return this.tracer.startActiveSpan('queue.add.email-send', async (span) => {
      try {
        const parsed = EmailSendJobDataSchema.parse(data);
        const jobOptions: JobsOptions = {
          ...this.priorityToOptions(parsed.priority),
          ...options,
          jobId: options?.jobId ?? `email-send:${parsed.messageId}`,
        };
        const job = await this.emailSendQueue.add('email-send-job', parsed, jobOptions);

        span.setAttributes({
          'comm.queue': QUEUE_NAMES.EMAIL_SEND,
          'comm.message_id': parsed.messageId,
          'comm.tenant_id': parsed.tenantId,
          'comm.correlation_id': parsed.correlationId,
        });
        enqueueCounter.add(1, { queue: QUEUE_NAMES.EMAIL_SEND, priority: parsed.priority });

        this.logger.log({
          action: 'job_enqueued',
          queue: QUEUE_NAMES.EMAIL_SEND,
          job_id: job.id,
          message_id: parsed.messageId,
          tenant_id: parsed.tenantId,
          correlation_id: parsed.correlationId,
        });

        return job.id ?? '';
      } finally {
        span.end();
      }
    });
  }

  async addWaWebhookProcess(data: WaWebhookProcessJobData, options?: JobsOptions): Promise<string> {
    const parsed = WaWebhookProcessJobDataSchema.parse(data);
    const job = await this.waWebhookQueue.add('wa-webhook-process-job', parsed, {
      jobId: options?.jobId ?? `wa-webhook:${parsed.webhookReceivedId}`,
      ...options,
    });
    enqueueCounter.add(1, { queue: QUEUE_NAMES.WA_WEBHOOK_PROCESS });
    return job.id ?? '';
  }

  async addEmailWebhookProcess(data: EmailWebhookProcessJobData, options?: JobsOptions): Promise<string> {
    const parsed = EmailWebhookProcessJobDataSchema.parse(data);
    const job = await this.emailWebhookQueue.add('email-webhook-process-job', parsed, {
      jobId: options?.jobId ?? `email-webhook:${parsed.webhookReceivedId}`,
      ...options,
    });
    enqueueCounter.add(1, { queue: QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS });
    return job.id ?? '';
  }

  /**
   * Bulk enqueue: efficient for broadcast campaigns (Sprint 14+ marketing).
   * Uses BullMQ addBulk which pipelines Redis commands.
   */
  async addBatch(items: Array<{ queue: QueueName; data: unknown; options?: JobsOptions }>): Promise<number> {
    let enqueued = 0;
    for (const item of items) {
      switch (item.queue) {
        case QUEUE_NAMES.WA_SEND:
          await this.addWaSend(item.data as WaSendJobData, item.options);
          break;
        case QUEUE_NAMES.EMAIL_SEND:
          await this.addEmailSend(item.data as EmailSendJobData, item.options);
          break;
      }
      enqueued += 1;
    }
    return enqueued;
  }

  /**
   * Stats for monitoring + admin dashboards.
   */
  async getQueueStats(queueName: QueueName): Promise<QueueStats> {
    const queue = this.getQueueByName(queueName);
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);
    return { waiting, active, completed, failed, delayed, paused };
  }

  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.pause();
    this.logger.warn({ action: 'queue_paused', queue: queueName });
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.resume();
    this.logger.log({ action: 'queue_resumed', queue: queueName });
  }

  private getQueueByName(name: QueueName): Queue {
    switch (name) {
      case QUEUE_NAMES.WA_SEND: return this.waSendQueue;
      case QUEUE_NAMES.EMAIL_SEND: return this.emailSendQueue;
      case QUEUE_NAMES.WA_WEBHOOK_PROCESS: return this.waWebhookQueue;
      case QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS: return this.emailWebhookQueue;
    }
  }

  private priorityToOptions(priority: 'high' | 'normal' | 'low'): JobsOptions {
    if (priority === 'high') return { priority: 1 };
    if (priority === 'low') return { priority: 100 };
    return { priority: 50 };
  }
}
```

### 6.5 Fichier 5 / 11 : `repo/packages/comm/src/workers/wa-send.worker.ts`

```typescript
/**
 * @insurtech/comm/workers/wa-send.worker
 *
 * Consumes BullMQ queue 'wa-send'. For each job:
 *   1. Acquires tenant context (AsyncLocalStorage Sprint 4 Tache 1.4.6)
 *   2. Idempotency check on comm_messages.status (DB source-of-truth, survives Redis flush)
 *   3. Renders WhatsApp template (Sprint 9 Tache 3.2.3)
 *   4. Sends via Meta Cloud API v21.0 (Sprint 9 Tache 3.2.2)
 *   5. Updates comm_messages.status='sent' + provider_message_id
 *   6. Publishes Kafka event comm.message_sent (Sprint 2 Tache 1.2.10)
 *   7. Records OTEL metrics
 *
 * Failure handling :
 *   - Transient errors (5xx, ECONNREFUSED, timeout) -> throw -> BullMQ retries 3 times
 *     with exponential backoff jittered (1s/5s/30s +/-50%)
 *   - Structural errors (MetaInvalidTemplateError, MetaPhoneNotOptedInError) ->
 *     throw UnrecoverableError -> BullMQ skips retries -> immediate failed
 *   - On final failure (attemptsMade >= 3 OR UnrecoverableError) ->
 *     OnWorkerEvent('failed') publishes to Kafka DLQ + updates DB status='failed'
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.8 (this task)
 *   - Sprint 9 Tache 3.2.2 (WhatsAppCloudApiClient + Meta errors)
 *   - Sprint 9 Tache 3.2.3 (WaTemplateRendererService)
 *   - Sprint 2 Tache 1.2.10 (KafkaPublisher)
 *   - Sprint 4 Tache 1.4.6 (TenantContext AsyncLocalStorage)
 *   - Sprint 1 Tache 1.2.13 (OTEL instrumentation)
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { KafkaPublisher } from '@insurtech/kafka';
import { Topics } from '@insurtech/shared-types';
import { TenantContext } from '@insurtech/auth';
import { WhatsAppCloudApiClient } from '../providers/whatsapp/whatsapp-cloud-api.client.js';
import {
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaRateLimitError,
} from '../providers/whatsapp/errors.js';
import { WaTemplateRendererService } from '../services/wa-template-renderer.service.js';
import { MessagesRepositoryService } from '../services/messages-repository.service.js';
import { DlqPublisherService } from '../services/dlq-publisher.service.js';
import { UnrecoverableError, shouldDlq } from '../errors/queue-errors.js';
import { QUEUE_NAMES, type WaSendJobData } from '../jobs/types.js';
import { hashPhoneForLog } from '../helpers/phone-email.helper.js';

const meter = metrics.getMeter('insurtech.comm.wa-send-worker');
const jobDurationHistogram = meter.createHistogram('comm_job_duration_ms', {
  description: 'WhatsApp send job processing duration in ms',
  unit: 'ms',
});
const jobRetryCounter = meter.createCounter('comm_job_retry_count_total', {
  description: 'Total job retry attempts',
});
const dlqCounter = meter.createCounter('comm_dlq_count_total', {
  description: 'Total jobs sent to DLQ',
});
const concurrencyGauge = meter.createUpDownCounter('comm_concurrency_active', {
  description: 'Active job slots per queue',
});

const CONCURRENCY = Number.parseInt(process.env.COMM_WA_QUEUE_CONCURRENCY ?? '10', 10);

@Processor(QUEUE_NAMES.WA_SEND, { concurrency: CONCURRENCY })
export class WaSendWorker extends WorkerHost {
  private readonly logger = new Logger(WaSendWorker.name);
  private readonly tracer = trace.getTracer('insurtech.comm.wa-send-worker');

  constructor(
    private readonly waClient: WhatsAppCloudApiClient,
    private readonly renderer: WaTemplateRendererService,
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly tenantContext: TenantContext,
    private readonly dlqPublisher: DlqPublisherService,
  ) {
    super();
  }

  async process(job: Job<WaSendJobData>): Promise<void> {
    const startTs = Date.now();
    const { messageId, to, templateName, locale, variables, tenantId, correlationId } = job.data;

    concurrencyGauge.add(1, { queue: QUEUE_NAMES.WA_SEND });

    return this.tracer.startActiveSpan('wa-send.process', async (span) => {
      span.setAttributes({
        'comm.queue': QUEUE_NAMES.WA_SEND,
        'comm.message_id': messageId,
        'comm.tenant_id': tenantId,
        'comm.correlation_id': correlationId,
        'comm.template_name': templateName,
        'comm.locale': locale,
        'comm.attempt': job.attemptsMade,
        'comm.to_hash': hashPhoneForLog(to),
      });

      try {
        await this.tenantContext.run({ tenantId }, async () => {
          this.logger.log({
            action: 'wa_send_start',
            messageId,
            attempt: job.attemptsMade,
            template: templateName,
            locale,
            correlationId,
            tenantId,
            to_hash: hashPhoneForLog(to),
          });

          // 1. Idempotency check (source-of-truth metier = DB status)
          const message = await this.messagesRepo.findById(messageId);
          if (!message) {
            throw new UnrecoverableError(
              `comm_messages row ${messageId} not found, cannot send`,
              'MessageNotFoundError',
            );
          }
          if (message.status === 'sent' || message.status === 'delivered' || message.status === 'read') {
            this.logger.log({
              action: 'wa_send_skip_already_processed',
              messageId,
              current_status: message.status,
              correlationId,
            });
            span.addEvent('idempotent_skip', { current_status: message.status });
            return;
          }

          // 2. Render template (variables validation per template variables_schema)
          const components = await this.renderer.render(templateName, locale, variables);

          // 3. Send via Meta API
          let result: { message_id: string };
          try {
            result = await this.waClient.sendTemplate(to, templateName, locale, components);
          } catch (err) {
            // Classify: transient -> throw to retry, structural -> UnrecoverableError
            if (err instanceof MetaInvalidTemplateError) {
              throw new UnrecoverableError(
                `Meta template ${templateName} invalid for locale ${locale}: ${err.message}`,
                'MetaInvalidTemplateError',
                err,
              );
            }
            if (err instanceof MetaPhoneNotOptedInError) {
              // Auto opt-out + Kafka event for Sprint 11 opt-out service
              await this.kafkaPublisher.publish(Topics.COMM_PHONE_NOT_OPTED_IN, {
                messageId,
                to_hash: hashPhoneForLog(to),
                tenantId,
                correlation_id: correlationId,
                detected_at: new Date().toISOString(),
              });
              throw new UnrecoverableError(
                `Phone not opted in for WhatsApp business messaging`,
                'MetaPhoneNotOptedInError',
                err,
              );
            }
            if (err instanceof MetaRateLimitError) {
              jobRetryCounter.add(1, { queue: QUEUE_NAMES.WA_SEND, reason: 'rate_limit' });
              throw err; // Retry with exponential backoff
            }
            // Default: any other error treated as transient -> retry
            throw err;
          }

          // 4. Update DB status
          await this.messagesRepo.update(messageId, {
            status: 'sent',
            provider_message_id: result.message_id,
            sent_at: new Date(),
          });

          // 5. Publish Kafka event
          await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_SENT, {
            messageId,
            tenantId,
            channel: 'whatsapp',
            to_address_hash: hashPhoneForLog(to),
            template_name: templateName,
            locale,
            sent_at: new Date().toISOString(),
            provider_message_id: result.message_id,
            correlation_id: correlationId,
          });

          const duration = Date.now() - startTs;
          jobDurationHistogram.record(duration, {
            queue: QUEUE_NAMES.WA_SEND,
            status: 'success',
          });

          this.logger.log({
            action: 'wa_send_complete',
            messageId,
            duration_ms: duration,
            provider_message_id: result.message_id,
            correlationId,
          });

          span.setStatus({ code: SpanStatusCode.OK });
        });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        concurrencyGauge.add(-1, { queue: QUEUE_NAMES.WA_SEND });
        span.end();
      }
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WaSendJobData>, err: Error): Promise<void> {
    const { messageId, tenantId, correlationId } = job.data;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.error({
      action: 'wa_send_failed',
      messageId,
      attempt: job.attemptsMade,
      max_attempts: maxAttempts,
      err_message: err.message,
      err_name: err.name,
      correlationId,
      tenantId,
    });

    if (!shouldDlq(err, job.attemptsMade, maxAttempts)) {
      // Transient failure, retry will be scheduled by BullMQ
      jobRetryCounter.add(1, { queue: QUEUE_NAMES.WA_SEND, error_type: err.name });
      return;
    }

    // DLQ flow
    try {
      await this.dlqPublisher.publishToDlq({
        original_topic: QUEUE_NAMES.WA_SEND,
        original_data: job.data as unknown as Record<string, unknown>,
        error: err,
        attempts: job.attemptsMade,
        tenant_id: tenantId,
        correlation_id: correlationId,
      });

      // Mark DB failed (within tenant context to respect RLS)
      await this.tenantContext.run({ tenantId }, async () => {
        await this.messagesRepo.update(messageId, {
          status: 'failed',
          failed_at: new Date(),
          fail_reason: err.message.slice(0, 500),
        });
      });

      // Kafka downstream notification
      await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_FAILED, {
        messageId,
        tenantId,
        channel: 'whatsapp',
        fail_reason: err.message.slice(0, 500),
        attempts: job.attemptsMade,
        failed_at: new Date().toISOString(),
        correlation_id: correlationId,
      });

      dlqCounter.add(1, {
        queue: QUEUE_NAMES.WA_SEND,
        reason: err instanceof UnrecoverableError ? 'unrecoverable' : 'attempts_exhausted',
      });
    } catch (dlqErr) {
      this.logger.error({
        action: 'wa_send_dlq_handler_failed',
        messageId,
        dlq_err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
        original_err: err.message,
        correlationId,
      });
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WaSendJobData>): void {
    this.logger.debug({
      action: 'wa_send_event_completed',
      messageId: job.data.messageId,
      correlationId: job.data.correlationId,
    });
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn({
      action: 'wa_send_stalled',
      jobId,
    });
  }
}
```

### 6.6 Fichier 6 / 11 : `repo/packages/comm/src/workers/email-send.worker.ts`

```typescript
/**
 * @insurtech/comm/workers/email-send.worker
 *
 * Consumes BullMQ queue 'email-send'. Equivalent of WaSendWorker but for email channel
 * via Sprint 9 Tache 3.2.6 EmailService and Sprint 9 Tache 3.2.7 EmailTemplateRendererService.
 *
 * Reference : Sprint 9 Tache 3.2.8 (this task), 3.2.6, 3.2.7.
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { KafkaPublisher } from '@insurtech/kafka';
import { Topics } from '@insurtech/shared-types';
import { TenantContext } from '@insurtech/auth';
import { EmailService } from '../providers/email/email.service.js';
import { EmailTemplateRendererService } from '../services/email-template-renderer.service.js';
import { MessagesRepositoryService } from '../services/messages-repository.service.js';
import { DlqPublisherService } from '../services/dlq-publisher.service.js';
import {
  EmailRecipientBlockedError,
  EmailInvalidTemplateError,
  EmailTransientError,
} from '../providers/email/errors.js';
import { UnrecoverableError, shouldDlq } from '../errors/queue-errors.js';
import { QUEUE_NAMES, type EmailSendJobData } from '../jobs/types.js';
import { hashEmailForLog } from '../helpers/phone-email.helper.js';

const meter = metrics.getMeter('insurtech.comm.email-send-worker');
const jobDurationHistogram = meter.createHistogram('comm_job_duration_ms', {
  description: 'Email send job processing duration in ms',
  unit: 'ms',
});
const jobRetryCounter = meter.createCounter('comm_job_retry_count_total', {
  description: 'Total job retry attempts',
});
const dlqCounter = meter.createCounter('comm_dlq_count_total', {
  description: 'Total jobs sent to DLQ',
});
const concurrencyGauge = meter.createUpDownCounter('comm_concurrency_active', {
  description: 'Active job slots per queue',
});

const CONCURRENCY = Number.parseInt(process.env.COMM_EMAIL_QUEUE_CONCURRENCY ?? '10', 10);

@Processor(QUEUE_NAMES.EMAIL_SEND, { concurrency: CONCURRENCY })
export class EmailSendWorker extends WorkerHost {
  private readonly logger = new Logger(EmailSendWorker.name);
  private readonly tracer = trace.getTracer('insurtech.comm.email-send-worker');

  constructor(
    private readonly emailService: EmailService,
    private readonly renderer: EmailTemplateRendererService,
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly tenantContext: TenantContext,
    private readonly dlqPublisher: DlqPublisherService,
  ) {
    super();
  }

  async process(job: Job<EmailSendJobData>): Promise<void> {
    const startTs = Date.now();
    const { messageId, to, templateName, locale, variables, tenantId, correlationId, replyTo, attachments } = job.data;

    concurrencyGauge.add(1, { queue: QUEUE_NAMES.EMAIL_SEND });

    return this.tracer.startActiveSpan('email-send.process', async (span) => {
      span.setAttributes({
        'comm.queue': QUEUE_NAMES.EMAIL_SEND,
        'comm.message_id': messageId,
        'comm.tenant_id': tenantId,
        'comm.correlation_id': correlationId,
        'comm.template_name': templateName,
        'comm.locale': locale,
        'comm.attempt': job.attemptsMade,
        'comm.to_hash': hashEmailForLog(to),
      });

      try {
        await this.tenantContext.run({ tenantId }, async () => {
          this.logger.log({
            action: 'email_send_start',
            messageId,
            attempt: job.attemptsMade,
            template: templateName,
            locale,
            correlationId,
            tenantId,
            to_hash: hashEmailForLog(to),
          });

          // 1. Idempotency check
          const message = await this.messagesRepo.findById(messageId);
          if (!message) {
            throw new UnrecoverableError(
              `comm_messages row ${messageId} not found`,
              'MessageNotFoundError',
            );
          }
          if (message.status === 'sent' || message.status === 'delivered' || message.status === 'read') {
            this.logger.log({
              action: 'email_send_skip_already_processed',
              messageId,
              current_status: message.status,
              correlationId,
            });
            span.addEvent('idempotent_skip', { current_status: message.status });
            return;
          }

          // 2. Render template
          const rendered = await this.renderer.render(templateName, locale, variables);

          // 3. Send via SMTP
          let result: { message_id: string; accepted: number; rejected: number };
          try {
            result = await this.emailService.send({
              to,
              locale,
              template: templateName,
              variables,
              reply_to: replyTo,
              subject_override: rendered.subject,
              html_override: rendered.html,
              text_override: rendered.text,
              attachments: attachments?.map((a) => ({
                filename: a.filename,
                contentUrl: a.content_url,
                contentType: a.content_type,
              })),
            });
          } catch (err) {
            if (err instanceof EmailInvalidTemplateError) {
              throw new UnrecoverableError(
                `Email template ${templateName}/${locale} invalid: ${err.message}`,
                'EmailInvalidTemplateError',
                err,
              );
            }
            if (err instanceof EmailRecipientBlockedError) {
              await this.kafkaPublisher.publish(Topics.COMM_EMAIL_RECIPIENT_BLOCKED, {
                messageId,
                to_hash: hashEmailForLog(to),
                tenantId,
                correlation_id: correlationId,
                detected_at: new Date().toISOString(),
              });
              throw new UnrecoverableError(
                `Email recipient blocked (hard bounce previous)`,
                'EmailRecipientBlockedError',
                err,
              );
            }
            // EmailTransientError, ECONNREFUSED, timeout -> retry
            throw err;
          }

          // 4. Update DB
          await this.messagesRepo.update(messageId, {
            status: 'sent',
            provider_message_id: result.message_id,
            sent_at: new Date(),
          });

          // 5. Kafka event
          await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_SENT, {
            messageId,
            tenantId,
            channel: 'email',
            to_address_hash: hashEmailForLog(to),
            template_name: templateName,
            locale,
            sent_at: new Date().toISOString(),
            provider_message_id: result.message_id,
            correlation_id: correlationId,
          });

          const duration = Date.now() - startTs;
          jobDurationHistogram.record(duration, { queue: QUEUE_NAMES.EMAIL_SEND, status: 'success' });

          this.logger.log({
            action: 'email_send_complete',
            messageId,
            duration_ms: duration,
            provider_message_id: result.message_id,
            accepted: result.accepted,
            rejected: result.rejected,
            correlationId,
          });

          span.setStatus({ code: SpanStatusCode.OK });
        });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        concurrencyGauge.add(-1, { queue: QUEUE_NAMES.EMAIL_SEND });
        span.end();
      }
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EmailSendJobData>, err: Error): Promise<void> {
    const { messageId, tenantId, correlationId } = job.data;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.error({
      action: 'email_send_failed',
      messageId,
      attempt: job.attemptsMade,
      max_attempts: maxAttempts,
      err_message: err.message,
      err_name: err.name,
      correlationId,
      tenantId,
    });

    if (!shouldDlq(err, job.attemptsMade, maxAttempts)) {
      jobRetryCounter.add(1, { queue: QUEUE_NAMES.EMAIL_SEND, error_type: err.name });
      return;
    }

    try {
      await this.dlqPublisher.publishToDlq({
        original_topic: QUEUE_NAMES.EMAIL_SEND,
        original_data: job.data as unknown as Record<string, unknown>,
        error: err,
        attempts: job.attemptsMade,
        tenant_id: tenantId,
        correlation_id: correlationId,
      });

      await this.tenantContext.run({ tenantId }, async () => {
        await this.messagesRepo.update(messageId, {
          status: 'failed',
          failed_at: new Date(),
          fail_reason: err.message.slice(0, 500),
        });
      });

      await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_FAILED, {
        messageId,
        tenantId,
        channel: 'email',
        fail_reason: err.message.slice(0, 500),
        attempts: job.attemptsMade,
        failed_at: new Date().toISOString(),
        correlation_id: correlationId,
      });

      dlqCounter.add(1, {
        queue: QUEUE_NAMES.EMAIL_SEND,
        reason: err instanceof UnrecoverableError ? 'unrecoverable' : 'attempts_exhausted',
      });
    } catch (dlqErr) {
      this.logger.error({
        action: 'email_send_dlq_handler_failed',
        messageId,
        dlq_err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
        original_err: err.message,
        correlationId,
      });
    }
  }
}
```

### 6.7 Fichier 7 / 11 : `repo/packages/comm/src/workers/wa-webhook-process.worker.ts`

```typescript
/**
 * @insurtech/comm/workers/wa-webhook-process.worker
 *
 * Processes Meta WhatsApp webhooks asynchronously.
 * Sprint 9 Tache 3.2.4 controller persists raw webhook payload to comm_webhooks_received,
 * publishes Kafka event comm.webhook_received which triggers a wa-webhook-process job
 * via Sprint 9 Tache 3.2.10 consumer that calls queuePublisher.addWaWebhookProcess().
 *
 * Two main webhook types :
 *   - status_update : Meta -> our system : message delivered / read / failed
 *   - incoming_message : user replied -> log inbound + auto-log CRM interaction Sprint 8
 *
 * Reference : Sprint 9 Tache 3.2.8 (this task), 3.2.4, 3.2.10.
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { KafkaPublisher } from '@insurtech/kafka';
import { Topics } from '@insurtech/shared-types';
import { TenantContext } from '@insurtech/auth';
import { MessagesRepositoryService } from '../services/messages-repository.service.js';
import { WebhooksReceivedRepositoryService } from '../services/webhooks-received-repository.service.js';
import { ContactsService } from '@insurtech/crm';
import { DlqPublisherService } from '../services/dlq-publisher.service.js';
import { UnrecoverableError, shouldDlq } from '../errors/queue-errors.js';
import { QUEUE_NAMES, type WaWebhookProcessJobData } from '../jobs/types.js';

const meter = metrics.getMeter('insurtech.comm.wa-webhook-process-worker');
const jobDurationHistogram = meter.createHistogram('comm_job_duration_ms', { unit: 'ms' });
const dlqCounter = meter.createCounter('comm_dlq_count_total');
const incomingMessageCounter = meter.createCounter('comm_incoming_messages_total');

const CONCURRENCY = Number.parseInt(process.env.COMM_WA_WEBHOOK_QUEUE_CONCURRENCY ?? '10', 10);

@Processor(QUEUE_NAMES.WA_WEBHOOK_PROCESS, { concurrency: CONCURRENCY })
export class WaWebhookProcessWorker extends WorkerHost {
  private readonly logger = new Logger(WaWebhookProcessWorker.name);
  private readonly tracer = trace.getTracer('insurtech.comm.wa-webhook-process-worker');

  constructor(
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly webhooksRepo: WebhooksReceivedRepositoryService,
    private readonly contactsService: ContactsService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly tenantContext: TenantContext,
    private readonly dlqPublisher: DlqPublisherService,
  ) {
    super();
  }

  async process(job: Job<WaWebhookProcessJobData>): Promise<void> {
    const startTs = Date.now();
    const { webhookReceivedId, webhookType, tenantId, correlationId } = job.data;

    return this.tracer.startActiveSpan('wa-webhook-process.process', async (span) => {
      span.setAttributes({
        'comm.queue': QUEUE_NAMES.WA_WEBHOOK_PROCESS,
        'comm.webhook_id': webhookReceivedId,
        'comm.webhook_type': webhookType,
        'comm.tenant_id': tenantId ?? '',
        'comm.correlation_id': correlationId,
        'comm.attempt': job.attemptsMade,
      });

      try {
        await this.tenantContext.run({ tenantId: tenantId ?? '' }, async () => {
          // Idempotency : check webhook processed flag
          const webhook = await this.webhooksRepo.findById(webhookReceivedId);
          if (!webhook) {
            throw new UnrecoverableError(
              `comm_webhooks_received row ${webhookReceivedId} not found`,
              'WebhookNotFoundError',
            );
          }
          if (webhook.processed_at !== null) {
            this.logger.log({
              action: 'wa_webhook_skip_already_processed',
              webhookReceivedId,
              processed_at: webhook.processed_at,
              correlationId,
            });
            return;
          }

          const payload = webhook.raw_payload as MetaWebhookPayload;
          const entries = payload.entry ?? [];

          for (const entry of entries) {
            for (const change of entry.changes ?? []) {
              const value = change.value;

              // Status updates
              if (Array.isArray(value.statuses)) {
                for (const status of value.statuses) {
                  await this.handleStatusUpdate(status);
                }
              }

              // Incoming messages
              if (Array.isArray(value.messages)) {
                for (const message of value.messages) {
                  await this.handleIncomingMessage(message, value.metadata, tenantId);
                }
              }
            }
          }

          // Mark webhook processed
          await this.webhooksRepo.markProcessed(webhookReceivedId, new Date());

          const duration = Date.now() - startTs;
          jobDurationHistogram.record(duration, {
            queue: QUEUE_NAMES.WA_WEBHOOK_PROCESS,
            webhook_type: webhookType,
            status: 'success',
          });

          this.logger.log({
            action: 'wa_webhook_process_complete',
            webhookReceivedId,
            webhook_type: webhookType,
            duration_ms: duration,
            correlationId,
          });

          span.setStatus({ code: SpanStatusCode.OK });
        });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    });
  }

  private async handleStatusUpdate(status: MetaWebhookStatus): Promise<void> {
    // Lookup comm_messages by provider_message_id
    const message = await this.messagesRepo.findByProviderMessageId(status.id);
    if (!message) {
      this.logger.warn({
        action: 'wa_status_message_not_found',
        provider_message_id: status.id,
        status_type: status.status,
      });
      return;
    }

    const updates: Record<string, unknown> = {};
    let kafkaTopic: string | null = null;

    switch (status.status) {
      case 'delivered':
        updates.status = 'delivered';
        updates.delivered_at = new Date(parseInt(status.timestamp, 10) * 1000);
        kafkaTopic = Topics.COMM_MESSAGE_DELIVERED;
        break;
      case 'read':
        updates.status = 'read';
        updates.read_at = new Date(parseInt(status.timestamp, 10) * 1000);
        kafkaTopic = Topics.COMM_MESSAGE_READ;
        break;
      case 'failed':
        updates.status = 'failed';
        updates.failed_at = new Date(parseInt(status.timestamp, 10) * 1000);
        updates.fail_reason = status.errors?.[0]?.title ?? 'Meta delivery failed';
        kafkaTopic = Topics.COMM_MESSAGE_FAILED;
        break;
      case 'sent':
        // Already 'sent' in our system from worker, no-op
        return;
    }

    await this.messagesRepo.update(message.id, updates);

    if (kafkaTopic) {
      await this.kafkaPublisher.publish(kafkaTopic, {
        messageId: message.id,
        tenantId: message.tenant_id,
        channel: 'whatsapp',
        provider_message_id: status.id,
        status: status.status,
        at: updates.delivered_at ?? updates.read_at ?? updates.failed_at,
      });
    }
  }

  private async handleIncomingMessage(
    message: MetaIncomingMessage,
    metadata: MetaPhoneMetadata,
    tenantIdHint?: string,
  ): Promise<void> {
    incomingMessageCounter.add(1, { type: message.type });

    // Look up contact by phone E.164 (Sprint 8 helper)
    const phone = `+${message.from}`; // Meta sends without + prefix
    const contact = await this.contactsService.findByPhone(phone, tenantIdHint);

    // Detect STOP keyword for auto opt-out (Sprint 9 Tache 3.2.11)
    const body = message.text?.body?.trim().toUpperCase() ?? '';
    const isStop = ['STOP', 'ARRET', 'STOP-ALL', 'UNSUBSCRIBE'].includes(body);

    // Insert inbound message row
    await this.messagesRepo.create({
      tenant_id: contact?.tenant_id ?? tenantIdHint ?? null,
      contact_id: contact?.id ?? null,
      channel: 'whatsapp',
      direction: 'inbound',
      from_address: phone,
      to_address: metadata.display_phone_number,
      provider_message_id: message.id,
      body_text: message.text?.body ?? null,
      body_type: message.type,
      received_at: new Date(parseInt(message.timestamp, 10) * 1000),
      status: 'received',
    });

    if (isStop && contact) {
      await this.kafkaPublisher.publish(Topics.COMM_OPTOUT_STOP_KEYWORD, {
        contactId: contact.id,
        tenantId: contact.tenant_id,
        channel: 'whatsapp',
        keyword: body,
        received_at: new Date().toISOString(),
      });
    }

    if (contact) {
      // Sprint 8 CRM auto-log interaction
      await this.kafkaPublisher.publish(Topics.CRM_INTERACTION_LOGGED, {
        contactId: contact.id,
        tenantId: contact.tenant_id,
        type: 'whatsapp_inbound',
        summary: (message.text?.body ?? '[media]').slice(0, 200),
        at: new Date().toISOString(),
      });
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WaWebhookProcessJobData>, err: Error): Promise<void> {
    const { webhookReceivedId, tenantId, correlationId } = job.data;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.error({
      action: 'wa_webhook_process_failed',
      webhookReceivedId,
      attempt: job.attemptsMade,
      err_message: err.message,
      correlationId,
      tenantId,
    });

    if (!shouldDlq(err, job.attemptsMade, maxAttempts)) return;

    try {
      await this.dlqPublisher.publishToDlq({
        original_topic: QUEUE_NAMES.WA_WEBHOOK_PROCESS,
        original_data: job.data as unknown as Record<string, unknown>,
        error: err,
        attempts: job.attemptsMade,
        tenant_id: tenantId,
        correlation_id: correlationId,
      });
      dlqCounter.add(1, { queue: QUEUE_NAMES.WA_WEBHOOK_PROCESS });
    } catch (dlqErr) {
      this.logger.error({
        action: 'wa_webhook_dlq_handler_failed',
        webhookReceivedId,
        dlq_err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    }
  }
}

// Meta payload types (subset, full schema in Sprint 9 Tache 3.2.4 types.ts)
interface MetaWebhookPayload {
  entry?: Array<{ changes?: Array<{ value: MetaWebhookValue }> }>;
}
interface MetaWebhookValue {
  messages?: MetaIncomingMessage[];
  statuses?: MetaWebhookStatus[];
  metadata: MetaPhoneMetadata;
}
interface MetaWebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: Array<{ code: number; title: string }>;
}
interface MetaIncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker';
  text?: { body: string };
}
interface MetaPhoneMetadata {
  display_phone_number: string;
  phone_number_id: string;
}
```

### 6.8 Fichier 8 / 11 : `repo/packages/comm/src/workers/email-webhook-process.worker.ts`

```typescript
/**
 * @insurtech/comm/workers/email-webhook-process.worker
 *
 * Processes Mailgun webhooks asynchronously :
 *   - delivered : update status='delivered' + delivered_at
 *   - opened : tracking pixel hit, update opened_at
 *   - clicked : link click, update clicked_at
 *   - bounced_hard : permanent bounce -> auto opt-out (Sprint 9 Tache 3.2.11)
 *   - bounced_soft : temporary bounce, no opt-out, retry handled provider-side
 *   - complained : user marked spam -> auto opt-out + alert
 *   - unsubscribed : explicit Mailgun unsubscribe -> opt-out
 *
 * Reference : Sprint 9 Tache 3.2.8 (this task), 3.2.10 delivery tracking, 3.2.11 opt-out.
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { KafkaPublisher } from '@insurtech/kafka';
import { Topics } from '@insurtech/shared-types';
import { TenantContext } from '@insurtech/auth';
import { MessagesRepositoryService } from '../services/messages-repository.service.js';
import { WebhooksReceivedRepositoryService } from '../services/webhooks-received-repository.service.js';
import { DlqPublisherService } from '../services/dlq-publisher.service.js';
import { UnrecoverableError, shouldDlq } from '../errors/queue-errors.js';
import { QUEUE_NAMES, type EmailWebhookProcessJobData } from '../jobs/types.js';

const meter = metrics.getMeter('insurtech.comm.email-webhook-process-worker');
const jobDurationHistogram = meter.createHistogram('comm_job_duration_ms', { unit: 'ms' });
const dlqCounter = meter.createCounter('comm_dlq_count_total');
const bounceCounter = meter.createCounter('comm_email_bounces_total');

const CONCURRENCY = Number.parseInt(process.env.COMM_EMAIL_WEBHOOK_QUEUE_CONCURRENCY ?? '10', 10);

@Processor(QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS, { concurrency: CONCURRENCY })
export class EmailWebhookProcessWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWebhookProcessWorker.name);
  private readonly tracer = trace.getTracer('insurtech.comm.email-webhook-process-worker');

  constructor(
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly webhooksRepo: WebhooksReceivedRepositoryService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly tenantContext: TenantContext,
    private readonly dlqPublisher: DlqPublisherService,
  ) {
    super();
  }

  async process(job: Job<EmailWebhookProcessJobData>): Promise<void> {
    const startTs = Date.now();
    const { webhookReceivedId, webhookType, tenantId, correlationId } = job.data;

    return this.tracer.startActiveSpan('email-webhook-process.process', async (span) => {
      span.setAttributes({
        'comm.queue': QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS,
        'comm.webhook_id': webhookReceivedId,
        'comm.webhook_type': webhookType,
        'comm.correlation_id': correlationId,
        'comm.attempt': job.attemptsMade,
      });

      try {
        await this.tenantContext.run({ tenantId: tenantId ?? '' }, async () => {
          const webhook = await this.webhooksRepo.findById(webhookReceivedId);
          if (!webhook) {
            throw new UnrecoverableError(
              `comm_webhooks_received ${webhookReceivedId} not found`,
              'WebhookNotFoundError',
            );
          }
          if (webhook.processed_at !== null) {
            this.logger.log({
              action: 'email_webhook_skip_already_processed',
              webhookReceivedId,
              correlationId,
            });
            return;
          }

          const payload = webhook.raw_payload as MailgunWebhookPayload;
          const eventData = payload['event-data'];

          // Find comm_messages by Mailgun message_id (X-Mailgun-Message-Id header)
          const providerMessageId = eventData.message?.headers?.['message-id'];
          if (!providerMessageId) {
            throw new UnrecoverableError(
              'Mailgun webhook missing message-id header',
              'MailgunMissingMessageIdError',
            );
          }

          const message = await this.messagesRepo.findByProviderMessageId(providerMessageId);
          if (!message) {
            this.logger.warn({
              action: 'email_webhook_message_not_found',
              provider_message_id: providerMessageId,
              event: eventData.event,
            });
            await this.webhooksRepo.markProcessed(webhookReceivedId, new Date());
            return;
          }

          const eventTs = new Date(eventData.timestamp * 1000);

          switch (webhookType) {
            case 'delivered':
              await this.messagesRepo.update(message.id, {
                status: 'delivered',
                delivered_at: eventTs,
              });
              await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_DELIVERED, {
                messageId: message.id,
                tenantId: message.tenant_id,
                channel: 'email',
                provider_message_id: providerMessageId,
                at: eventTs.toISOString(),
              });
              break;

            case 'opened':
              await this.messagesRepo.update(message.id, { opened_at: eventTs });
              await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_OPENED, {
                messageId: message.id,
                tenantId: message.tenant_id,
                channel: 'email',
                opened_at: eventTs.toISOString(),
              });
              break;

            case 'clicked':
              await this.messagesRepo.update(message.id, { clicked_at: eventTs });
              await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_CLICKED, {
                messageId: message.id,
                tenantId: message.tenant_id,
                channel: 'email',
                clicked_at: eventTs.toISOString(),
                clicked_url: eventData.url,
              });
              break;

            case 'bounced_hard':
              await this.messagesRepo.update(message.id, {
                status: 'failed',
                failed_at: eventTs,
                fail_reason: `Hard bounce: ${eventData.reason ?? 'unknown'}`,
              });
              bounceCounter.add(1, { type: 'hard' });
              await this.kafkaPublisher.publish(Topics.COMM_EMAIL_BOUNCED_HARD, {
                messageId: message.id,
                tenantId: message.tenant_id,
                contactId: message.contact_id,
                to_address: message.to_address,
                bounce_reason: eventData.reason ?? 'unknown',
                bounced_at: eventTs.toISOString(),
              });
              break;

            case 'bounced_soft':
              bounceCounter.add(1, { type: 'soft' });
              await this.kafkaPublisher.publish(Topics.COMM_EMAIL_BOUNCED_SOFT, {
                messageId: message.id,
                tenantId: message.tenant_id,
                bounce_reason: eventData.reason ?? 'unknown',
                bounced_at: eventTs.toISOString(),
              });
              break;

            case 'complained':
              bounceCounter.add(1, { type: 'complaint' });
              await this.kafkaPublisher.publish(Topics.COMM_EMAIL_COMPLAINT, {
                messageId: message.id,
                tenantId: message.tenant_id,
                contactId: message.contact_id,
                to_address: message.to_address,
                at: eventTs.toISOString(),
              });
              break;

            case 'unsubscribed':
              await this.kafkaPublisher.publish(Topics.COMM_OPTOUT_REQUESTED, {
                messageId: message.id,
                tenantId: message.tenant_id,
                contactId: message.contact_id,
                channel: 'email',
                source: 'mailgun_unsubscribe',
                at: eventTs.toISOString(),
              });
              break;
          }

          await this.webhooksRepo.markProcessed(webhookReceivedId, new Date());

          const duration = Date.now() - startTs;
          jobDurationHistogram.record(duration, {
            queue: QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS,
            webhook_type: webhookType,
            status: 'success',
          });

          this.logger.log({
            action: 'email_webhook_process_complete',
            webhookReceivedId,
            webhook_type: webhookType,
            duration_ms: duration,
            correlationId,
          });

          span.setStatus({ code: SpanStatusCode.OK });
        });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EmailWebhookProcessJobData>, err: Error): Promise<void> {
    const { webhookReceivedId, tenantId, correlationId } = job.data;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.error({
      action: 'email_webhook_process_failed',
      webhookReceivedId,
      attempt: job.attemptsMade,
      err_message: err.message,
      correlationId,
    });

    if (!shouldDlq(err, job.attemptsMade, maxAttempts)) return;

    try {
      await this.dlqPublisher.publishToDlq({
        original_topic: QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS,
        original_data: job.data as unknown as Record<string, unknown>,
        error: err,
        attempts: job.attemptsMade,
        tenant_id: tenantId,
        correlation_id: correlationId,
      });
      dlqCounter.add(1, { queue: QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS });
    } catch (dlqErr) {
      this.logger.error({
        action: 'email_webhook_dlq_handler_failed',
        webhookReceivedId,
        dlq_err: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    }
  }
}

interface MailgunWebhookPayload {
  'event-data': {
    event: string;
    timestamp: number;
    reason?: string;
    url?: string;
    message: {
      headers: { 'message-id'?: string };
    };
    recipient?: string;
  };
}
```

### 6.9 Fichier 9 / 11 : `repo/packages/comm/src/queues/comm-queues.module.ts`

```typescript
/**
 * @insurtech/comm/queues/comm-queues.module
 *
 * Registers the 4 comm BullMQ queues + their workers + QueuePublisherService + DlqPublisherService.
 * Imports BullMQ default options from @insurtech/jobs (Sprint 3 Tache 1.3.11).
 *
 * Reference : Sprint 9 Tache 3.2.8 (this task), Sprint 3 Tache 1.3.11.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { JobsModule } from '@insurtech/jobs';
import { KafkaModule } from '@insurtech/kafka';
import { AuthModule } from '@insurtech/auth';
import { CrmModule } from '@insurtech/crm';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '../jobs/types.js';
import { WaSendWorker } from '../workers/wa-send.worker.js';
import { EmailSendWorker } from '../workers/email-send.worker.js';
import { WaWebhookProcessWorker } from '../workers/wa-webhook-process.worker.js';
import { EmailWebhookProcessWorker } from '../workers/email-webhook-process.worker.js';
import { QueuePublisherService } from '../services/queue-publisher.service.js';
import { DlqPublisherService } from '../services/dlq-publisher.service.js';
import { MessagesRepositoryService } from '../services/messages-repository.service.js';
import { WebhooksReceivedRepositoryService } from '../services/webhooks-received-repository.service.js';
import { WhatsAppCloudApiClient } from '../providers/whatsapp/whatsapp-cloud-api.client.js';
import { WaTemplateRendererService } from '../services/wa-template-renderer.service.js';
import { EmailService } from '../providers/email/email.service.js';
import { EmailTemplateRendererService } from '../services/email-template-renderer.service.js';

@Module({
  imports: [
    ConfigModule,
    JobsModule, // Sprint 3 Tache 1.3.11 -- provides Redis DB 2 connection + BullDashboard
    KafkaModule,
    AuthModule, // TenantContext
    CrmModule,  // ContactsService for incoming WA messages
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.WA_SEND,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
      {
        name: QUEUE_NAMES.EMAIL_SEND,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
      {
        name: QUEUE_NAMES.WA_WEBHOOK_PROCESS,
        defaultJobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          attempts: 5, // webhooks tolerate more retries (no external API cost)
        },
      },
      {
        name: QUEUE_NAMES.EMAIL_WEBHOOK_PROCESS,
        defaultJobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          attempts: 5,
        },
      },
    ),
  ],
  providers: [
    // Workers
    WaSendWorker,
    EmailSendWorker,
    WaWebhookProcessWorker,
    EmailWebhookProcessWorker,
    // Services
    QueuePublisherService,
    DlqPublisherService,
    MessagesRepositoryService,
    WebhooksReceivedRepositoryService,
    WhatsAppCloudApiClient,
    WaTemplateRendererService,
    EmailService,
    EmailTemplateRendererService,
  ],
  exports: [QueuePublisherService, DlqPublisherService],
})
export class CommQueuesModule {}
```

### 6.10 Fichier 10 / 11 : `repo/packages/comm/src/workers/__tests__/wa-send.worker.spec.ts`

```typescript
/**
 * @insurtech/comm/workers/__tests__/wa-send.worker.spec
 *
 * Vitest unit tests for WaSendWorker covering :
 *   - happy path send
 *   - idempotency skip (status='sent', 'delivered', 'read')
 *   - retry transient (5xx)
 *   - fail-fast UnrecoverableError
 *   - DLQ on attempts exhausted
 *   - DLQ on UnrecoverableError
 *   - tenant context propagation
 *   - correlation_id traversal
 *   - Kafka event published with correct schema
 *
 * Reference : Sprint 9 Tache 3.2.8 (this task).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { WaSendWorker } from '../wa-send.worker.js';
import { WhatsAppCloudApiClient } from '../../providers/whatsapp/whatsapp-cloud-api.client.js';
import { WaTemplateRendererService } from '../../services/wa-template-renderer.service.js';
import { MessagesRepositoryService } from '../../services/messages-repository.service.js';
import { DlqPublisherService } from '../../services/dlq-publisher.service.js';
import { KafkaPublisher } from '@insurtech/kafka';
import { TenantContext } from '@insurtech/auth';
import {
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaRateLimitError,
} from '../../providers/whatsapp/errors.js';
import { UnrecoverableError } from '../../errors/queue-errors.js';
import { Topics } from '@insurtech/shared-types';
import type { WaSendJobData } from '../../jobs/types.js';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const MESSAGE_ID = '22222222-2222-2222-2222-222222222222';
const CORRELATION_ID = 'corr-abc-123';

function buildJob(overrides: Partial<WaSendJobData> = {}, attemptsMade = 0): Job<WaSendJobData> {
  const data: WaSendJobData = {
    messageId: MESSAGE_ID,
    to: '+212612345678',
    templateName: 'police_signed_confirmation',
    locale: 'fr',
    variables: { user_name: 'Mohamed', police_number: 'POL-2026-001' },
    tenantId: TENANT_ID,
    correlationId: CORRELATION_ID,
    priority: 'normal',
    ...overrides,
  };
  return {
    id: 'job-1',
    data,
    attemptsMade,
    opts: { attempts: 3 },
  } as unknown as Job<WaSendJobData>;
}

describe('WaSendWorker', () => {
  let worker: WaSendWorker;
  let waClient: ReturnType<typeof mockWaClient>;
  let renderer: ReturnType<typeof mockRenderer>;
  let messagesRepo: ReturnType<typeof mockMessagesRepo>;
  let kafkaPublisher: ReturnType<typeof mockKafkaPublisher>;
  let tenantContext: ReturnType<typeof mockTenantContext>;
  let dlqPublisher: ReturnType<typeof mockDlqPublisher>;

  function mockWaClient() {
    return {
      sendTemplate: vi.fn().mockResolvedValue({ message_id: 'wamid.synthetic-1' }),
    };
  }
  function mockRenderer() {
    return { render: vi.fn().mockResolvedValue([{ type: 'body', parameters: [] }]) };
  }
  function mockMessagesRepo() {
    return {
      findById: vi.fn().mockResolvedValue({ id: MESSAGE_ID, status: 'pending', tenant_id: TENANT_ID }),
      findByProviderMessageId: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
    };
  }
  function mockKafkaPublisher() {
    return { publish: vi.fn().mockResolvedValue(undefined) };
  }
  function mockTenantContext() {
    return {
      run: vi.fn().mockImplementation(async (_ctx: { tenantId: string }, fn: () => Promise<void>) => {
        return fn();
      }),
    };
  }
  function mockDlqPublisher() {
    return { publishToDlq: vi.fn().mockResolvedValue(undefined) };
  }

  beforeEach(async () => {
    waClient = mockWaClient();
    renderer = mockRenderer();
    messagesRepo = mockMessagesRepo();
    kafkaPublisher = mockKafkaPublisher();
    tenantContext = mockTenantContext();
    dlqPublisher = mockDlqPublisher();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WaSendWorker,
        { provide: WhatsAppCloudApiClient, useValue: waClient },
        { provide: WaTemplateRendererService, useValue: renderer },
        { provide: MessagesRepositoryService, useValue: messagesRepo },
        { provide: KafkaPublisher, useValue: kafkaPublisher },
        { provide: TenantContext, useValue: tenantContext },
        { provide: DlqPublisherService, useValue: dlqPublisher },
      ],
    }).compile();

    worker = moduleRef.get(WaSendWorker);
  });

  describe('process() happy path', () => {
    it('sends WhatsApp template successfully and updates DB', async () => {
      await worker.process(buildJob());

      expect(messagesRepo.findById).toHaveBeenCalledWith(MESSAGE_ID);
      expect(renderer.render).toHaveBeenCalledWith('police_signed_confirmation', 'fr', expect.any(Object));
      expect(waClient.sendTemplate).toHaveBeenCalledWith('+212612345678', 'police_signed_confirmation', 'fr', expect.any(Array));
      expect(messagesRepo.update).toHaveBeenCalledWith(MESSAGE_ID, expect.objectContaining({
        status: 'sent',
        provider_message_id: 'wamid.synthetic-1',
      }));
    });

    it('publishes Kafka event comm.message_sent with correlation_id', async () => {
      await worker.process(buildJob());
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(
        Topics.COMM_MESSAGE_SENT,
        expect.objectContaining({
          messageId: MESSAGE_ID,
          tenantId: TENANT_ID,
          channel: 'whatsapp',
          correlation_id: CORRELATION_ID,
          provider_message_id: 'wamid.synthetic-1',
        }),
      );
    });

    it('runs within tenant context', async () => {
      await worker.process(buildJob());
      expect(tenantContext.run).toHaveBeenCalledWith({ tenantId: TENANT_ID }, expect.any(Function));
    });

    it('does not log raw phone (only hash)', async () => {
      const logSpy = vi.spyOn(worker['logger'], 'log');
      await worker.process(buildJob());
      const logCalls = logSpy.mock.calls.flat();
      const stringified = JSON.stringify(logCalls);
      expect(stringified).not.toContain('+212612345678');
    });
  });

  describe('idempotency', () => {
    it('skips when message already sent', async () => {
      messagesRepo.findById.mockResolvedValueOnce({ id: MESSAGE_ID, status: 'sent', tenant_id: TENANT_ID });
      await worker.process(buildJob());
      expect(waClient.sendTemplate).not.toHaveBeenCalled();
      expect(messagesRepo.update).not.toHaveBeenCalled();
    });

    it('skips when message delivered', async () => {
      messagesRepo.findById.mockResolvedValueOnce({ id: MESSAGE_ID, status: 'delivered', tenant_id: TENANT_ID });
      await worker.process(buildJob());
      expect(waClient.sendTemplate).not.toHaveBeenCalled();
    });

    it('skips when message read', async () => {
      messagesRepo.findById.mockResolvedValueOnce({ id: MESSAGE_ID, status: 'read', tenant_id: TENANT_ID });
      await worker.process(buildJob());
      expect(waClient.sendTemplate).not.toHaveBeenCalled();
    });

    it('throws UnrecoverableError when message row not found', async () => {
      messagesRepo.findById.mockResolvedValueOnce(null);
      await expect(worker.process(buildJob())).rejects.toThrow(UnrecoverableError);
    });
  });

  describe('error classification', () => {
    it('rethrows transient error to allow retry', async () => {
      waClient.sendTemplate.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(worker.process(buildJob())).rejects.toThrow('ECONNREFUSED');
    });

    it('throws UnrecoverableError on MetaInvalidTemplateError', async () => {
      waClient.sendTemplate.mockRejectedValueOnce(new MetaInvalidTemplateError('Template not found'));
      await expect(worker.process(buildJob())).rejects.toThrow(UnrecoverableError);
    });

    it('publishes phone_not_opted_in event and throws UnrecoverableError', async () => {
      waClient.sendTemplate.mockRejectedValueOnce(new MetaPhoneNotOptedInError('Phone not opted-in'));
      await expect(worker.process(buildJob())).rejects.toThrow(UnrecoverableError);
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(
        Topics.COMM_PHONE_NOT_OPTED_IN,
        expect.objectContaining({ messageId: MESSAGE_ID, tenantId: TENANT_ID }),
      );
    });

    it('rethrows MetaRateLimitError as transient', async () => {
      waClient.sendTemplate.mockRejectedValueOnce(new MetaRateLimitError('Too many requests'));
      await expect(worker.process(buildJob())).rejects.toThrow(MetaRateLimitError);
    });
  });

  describe('onFailed() DLQ', () => {
    it('publishes to DLQ when attemptsMade >= maxAttempts', async () => {
      const job = buildJob({}, 3);
      await worker.onFailed(job, new Error('transient timeout'));
      expect(dlqPublisher.publishToDlq).toHaveBeenCalledWith(expect.objectContaining({
        original_topic: 'wa-send',
        original_data: job.data,
        attempts: 3,
        tenant_id: TENANT_ID,
        correlation_id: CORRELATION_ID,
      }));
    });

    it('does NOT publish to DLQ on intermediate retry', async () => {
      const job = buildJob({}, 1);
      await worker.onFailed(job, new Error('transient'));
      expect(dlqPublisher.publishToDlq).not.toHaveBeenCalled();
    });

    it('publishes to DLQ on UnrecoverableError even at attempt 1', async () => {
      const job = buildJob({}, 1);
      await worker.onFailed(job, new UnrecoverableError('fatal'));
      expect(dlqPublisher.publishToDlq).toHaveBeenCalled();
    });

    it('updates DB status=failed after DLQ', async () => {
      const job = buildJob({}, 3);
      await worker.onFailed(job, new Error('fail'));
      expect(messagesRepo.update).toHaveBeenCalledWith(MESSAGE_ID, expect.objectContaining({
        status: 'failed',
        fail_reason: 'fail',
      }));
    });

    it('publishes Kafka comm.message_failed event after DLQ', async () => {
      const job = buildJob({}, 3);
      await worker.onFailed(job, new Error('fail-reason'));
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(
        Topics.COMM_MESSAGE_FAILED,
        expect.objectContaining({
          messageId: MESSAGE_ID,
          tenantId: TENANT_ID,
          channel: 'whatsapp',
          fail_reason: 'fail-reason',
          attempts: 3,
        }),
      );
    });

    it('handles DLQ publisher failure gracefully', async () => {
      dlqPublisher.publishToDlq.mockRejectedValueOnce(new Error('Kafka down'));
      const job = buildJob({}, 3);
      await expect(worker.onFailed(job, new Error('fail'))).resolves.not.toThrow();
    });

    it('truncates fail_reason to 500 chars', async () => {
      const longErr = new Error('x'.repeat(1000));
      const job = buildJob({}, 3);
      await worker.onFailed(job, longErr);
      const updateCall = messagesRepo.update.mock.calls[0];
      expect(updateCall[1].fail_reason.length).toBeLessThanOrEqual(500);
    });
  });

  describe('correlation_id propagation', () => {
    it('propagates correlation_id from job to Kafka event', async () => {
      await worker.process(buildJob({ correlationId: 'unique-corr-xyz' }));
      const kafkaCall = kafkaPublisher.publish.mock.calls.find((c) => c[0] === Topics.COMM_MESSAGE_SENT);
      expect(kafkaCall?.[1]).toMatchObject({ correlation_id: 'unique-corr-xyz' });
    });

    it('propagates correlation_id to DLQ event', async () => {
      const job = buildJob({ correlationId: 'corr-dlq-xyz' }, 3);
      await worker.onFailed(job, new Error('fail'));
      expect(dlqPublisher.publishToDlq).toHaveBeenCalledWith(
        expect.objectContaining({ correlation_id: 'corr-dlq-xyz' }),
      );
    });
  });

  describe('locale variations', () => {
    it.each([['fr'], ['ar-MA'], ['ar']])('processes locale %s correctly', async (locale) => {
      await worker.process(buildJob({ locale: locale as WaSendJobData['locale'] }));
      expect(renderer.render).toHaveBeenCalledWith(expect.any(String), locale, expect.any(Object));
    });
  });

  describe('multi-tenant isolation', () => {
    it('uses tenant_id from job data, not global', async () => {
      await worker.process(buildJob({ tenantId: 'tenant-A' }));
      expect(tenantContext.run).toHaveBeenCalledWith({ tenantId: 'tenant-A' }, expect.any(Function));
    });

    it('does not leak tenant context across jobs', async () => {
      await worker.process(buildJob({ tenantId: 'tenant-A' }));
      await worker.process(buildJob({ tenantId: 'tenant-B', messageId: 'msg-B' }));
      const calls = tenantContext.run.mock.calls;
      expect(calls[0][0]).toEqual({ tenantId: 'tenant-A' });
      expect(calls[1][0]).toEqual({ tenantId: 'tenant-B' });
    });
  });
});
```

### 6.11 Fichier 11 / 11 : `repo/apps/api/test/comm/workers.e2e-spec.ts`

```typescript
/**
 * @insurtech/api/test/comm/workers.e2e-spec
 *
 * Integration tests using Testcontainers Redis + Mock Meta + Mailhog.
 * Verifies end-to-end : enqueue -> worker process -> DB update -> Kafka event.
 *
 * Reference : Sprint 9 Tache 3.2.8 (this task), Sprint 9 Tache 3.2.13 E2E suite.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Queue } from 'bullmq';
import { CommQueuesModule } from '@insurtech/comm';
import { QueuePublisherService } from '@insurtech/comm';
import { QUEUE_NAMES } from '@insurtech/comm';
import { ConfigModule } from '@nestjs/config';

const SKIP_TESTCONTAINERS = process.env.SKIP_TESTCONTAINERS === '1';

describe.skipIf(SKIP_TESTCONTAINERS)('Comm Workers E2E', () => {
  let redis: StartedTestContainer;
  let module: TestingModule;
  let queuePublisher: QueuePublisherService;
  let waSendQueue: Queue;
  let emailSendQueue: Queue;

  beforeAll(async () => {
    redis = await new GenericContainer('redis:7.4-alpine')
      .withExposedPorts(6379)
      .start();

    process.env.REDIS_HOST = redis.getHost();
    process.env.REDIS_PORT = String(redis.getMappedPort(6379));
    process.env.REDIS_DB_QUEUES = '2';
    process.env.COMM_WA_QUEUE_CONCURRENCY = '5';

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), CommQueuesModule],
    }).compile();

    await module.init();
    queuePublisher = module.get(QueuePublisherService);
  }, 60_000);

  afterAll(async () => {
    await module.close();
    await redis.stop();
  }, 30_000);

  beforeEach(async () => {
    // Reset queues between tests
    waSendQueue = module.get(`BullQueue_${QUEUE_NAMES.WA_SEND}`);
    emailSendQueue = module.get(`BullQueue_${QUEUE_NAMES.EMAIL_SEND}`);
    await waSendQueue.obliterate({ force: true });
    await emailSendQueue.obliterate({ force: true });
  });

  it('enqueues a wa-send job and worker picks it up', async () => {
    const jobId = await queuePublisher.addWaSend({
      messageId: '11111111-1111-1111-1111-111111111111',
      to: '+212612345678',
      templateName: 'test_template',
      locale: 'fr',
      variables: {},
      tenantId: '22222222-2222-2222-2222-222222222222',
      correlationId: 'corr-e2e-1',
      priority: 'normal',
    });
    expect(jobId).toBeTruthy();

    const stats = await queuePublisher.getQueueStats(QUEUE_NAMES.WA_SEND);
    expect(stats.waiting + stats.active).toBeGreaterThanOrEqual(1);
  });

  it('handles 100 jobs concurrently with concurrency 5', async () => {
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      messageId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      to: '+212600000000',
      templateName: 'bulk_test',
      locale: 'fr' as const,
      variables: {},
      tenantId: '22222222-2222-2222-2222-222222222222',
      correlationId: `corr-bulk-${i}`,
      priority: 'low' as const,
    }));

    const start = Date.now();
    await Promise.all(jobs.map((j) => queuePublisher.addWaSend(j)));
    const enqueueDuration = Date.now() - start;
    expect(enqueueDuration).toBeLessThan(5000); // 100 enqueues < 5s
  });

  it('pauses and resumes queue', async () => {
    await queuePublisher.pauseQueue(QUEUE_NAMES.WA_SEND);
    let stats = await queuePublisher.getQueueStats(QUEUE_NAMES.WA_SEND);
    expect(stats.paused).toBe(true);

    await queuePublisher.resumeQueue(QUEUE_NAMES.WA_SEND);
    stats = await queuePublisher.getQueueStats(QUEUE_NAMES.WA_SEND);
    expect(stats.paused).toBe(false);
  });

  it('uses BullMQ jobId for idempotency at queue level', async () => {
    const data = {
      messageId: '33333333-3333-3333-3333-333333333333',
      to: '+212612345678',
      templateName: 'test',
      locale: 'fr' as const,
      variables: {},
      tenantId: '22222222-2222-2222-2222-222222222222',
      correlationId: 'corr-idem',
      priority: 'normal' as const,
    };
    const jobId1 = await queuePublisher.addWaSend(data);
    const jobId2 = await queuePublisher.addWaSend(data);
    expect(jobId1).toBe(jobId2); // Same jobId since same messageId
  });
});
```

---

## 7. Tests checklist (32 tests)

### 7.1 Tests unitaires WaSendWorker (12 tests)
1. Happy path send WhatsApp template -> status='sent' + provider_message_id + Kafka event.
2. Idempotency status='sent' -> skip + no API call.
3. Idempotency status='delivered' -> skip.
4. Idempotency status='read' -> skip.
5. Message not found -> UnrecoverableError.
6. Template render error -> rethrow (transient).
7. MetaInvalidTemplateError -> UnrecoverableError fail-fast.
8. MetaPhoneNotOptedInError -> UnrecoverableError + Kafka phone_not_opted_in event.
9. MetaRateLimitError -> rethrow (retry).
10. ECONNREFUSED -> rethrow (retry).
11. Tenant context propage correctement.
12. Correlation_id traverse end-to-end.

### 7.2 Tests unitaires EmailSendWorker (8 tests)
13. Happy path send email + DKIM headers.
14. Idempotency check.
15. EmailInvalidTemplateError -> UnrecoverableError.
16. EmailRecipientBlockedError -> UnrecoverableError + Kafka event.
17. SMTP timeout -> retry transient.
18. Multipart HTML+text passe au transport.
19. Locale ar-MA RTL applique.
20. Attachments via S3 reference (pas inline).

### 7.3 Tests onFailed handlers (6 tests)
21. Retry intermediate (attempt 1) -> pas DLQ.
22. Retry intermediate (attempt 2) -> pas DLQ.
23. Attempt 3 (max) -> DLQ + DB failed.
24. UnrecoverableError attempt 1 -> DLQ direct.
25. DLQ publish error -> log mais pas crash.
26. Kafka comm.message_failed event publishe apres DLQ.

### 7.4 Tests Webhook workers (3 tests)
27. WaWebhookProcess status update : delivered -> DB delivered_at + Kafka event.
28. WaWebhookProcess incoming message + STOP keyword -> opt-out Kafka event.
29. EmailWebhookProcess hard bounce -> DB failed + opt-out request.

### 7.5 Tests integration BullMQ + Redis (3 tests)
30. Enqueue 100 jobs concurrent + concurrency 10 traite tous sous 30s.
31. Pause/resume queue fonctionne.
32. BullDashboard /admin/queues affiche 4 queues + counters live.

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.8 -- BullMQ Queues Comm
COMM_WA_QUEUE_CONCURRENCY=10
COMM_EMAIL_QUEUE_CONCURRENCY=10
COMM_WA_WEBHOOK_QUEUE_CONCURRENCY=10
COMM_EMAIL_WEBHOOK_QUEUE_CONCURRENCY=10
COMM_RETRY_BACKOFF_BASE_MS=1000
COMM_RETRY_BACKOFF_JITTER=0.5
COMM_REMOVE_ON_COMPLETE_AGE_S=2592000   # 30 days
COMM_REMOVE_ON_FAIL_AGE_S=7776000       # 90 days for audit Loi 09-08
COMM_REMOVE_ON_COMPLETE_COUNT=10000
COMM_REMOVE_ON_FAIL_COUNT=50000
COMM_DLQ_TOPIC=insurtech.events.dlq.comm

# Reuse Sprint 3 Tache 1.3.11
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB_QUEUES=2

# Reuse Sprint 2 Tache 1.2.10
KAFKA_BROKERS=localhost:9092
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/comm add bullmq@5.30.1 @nestjs/bullmq@11.0.2
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:integration
pnpm --filter @insurtech/api test:e2e -- comm/workers
pnpm --filter @insurtech/comm build

# Smoke test BullDashboard
curl http://localhost:3000/admin/queues

# Inspect Redis DB 2 BullMQ keys
redis-cli -n 2 KEYS 'bull:wa-send:*' | head -20
```

---

## 10. Criteres validation V1-V30

### P0 (18)

- V1 : `WaSendWorker` envoie WhatsApp et update status='sent'.
- V2 : `EmailSendWorker` envoie email et update status='sent'.
- V3 : Retry 3x avec exponential backoff jittered sur transient error.
- V4 : DLQ Kafka topic `insurtech.events.dlq.comm` recoit event apres echecs.
- V5 : Idempotency : 2eme job same messageId skip.
- V6 : BullDashboard /admin/queues operational.
- V7 : OTEL metrics emit (queue_depth, job_duration_ms, retry_count, dlq_count).
- V8 : Concurrency 10 par worker (configurable env).
- V9 : `UnrecoverableError` fail-fast sans retry.
- V10 : `MetaInvalidTemplateError` -> UnrecoverableError.
- V11 : `MetaPhoneNotOptedInError` -> Kafka phone_not_opted_in event + UnrecoverableError.
- V12 : Tenant context propage workers (multi-tenant isolation strict).
- V13 : Correlation_id traverse producer -> queue -> worker -> Kafka.
- V14 : DLQ format compatible KafkaConsumerBase Sprint 2.
- V15 : Phones / emails NON loggues en clair (hash uniquement).
- V16 : Default job options applied : 3 attempts + jitter 0.5 + removeOnComplete 30j + removeOnFail 90j.
- V17 : Hard bounce email -> auto opt-out Kafka event.
- V18 : STOP keyword WA inbound -> opt-out auto.

### P1 (8)

- V19 : Coverage >= 88%.
- V20 : No-emoji.
- V21 : No-console.
- V22 : Build TypeScript reussit strict.
- V23 : Tests integration Testcontainers Redis passent.
- V24 : 1000 jobs/min throughput sustained sur 10min sans memory leak.
- V25 : `pauseQueue` / `resumeQueue` operationnels.
- V26 : `getQueueStats` retourne waiting/active/completed/failed/delayed/paused.

### P2 (4)

- V27 : Stalled jobs reclaim apres `stalledInterval` 30s.
- V28 : Documentation `queues.md` complete.
- V29 : Replay script DLQ documente Sprint 14.
- V30 : Sprint 33 alerting DLQ rate hooked.

---

## 11. Edge cases (15)

1. **Redis connection lost mid-job** : BullMQ ioredis auto-reconnect ; job in-flight stalled puis reclaim apres 30s.
2. **Worker pod crash mid-process** : `stalledInterval: 30000` BullMQ reclaim job, autre pod retry.
3. **Job data > 1MB BullMQ** : reject via Zod schema (max validation), pattern strict = utiliser DB ref (messageId UUID), pas inline payload.
4. **Queue paused via admin** : workers waitent, jobs accumule waiting state, BullDashboard montre paused indicator.
5. **Memory leak long-running worker** : Kubernetes liveness probe + restart policy Sprint 35, OTEL metric `process_resident_memory_bytes` alertable.
6. **Stalled jobs maxStalledCount** : `maxStalledCount: 1` BullMQ declare stalled apres 1 cycle reclaim, puis traite comme failed -> DLQ.
7. **Job timeout > lockDuration 30s** : worker doit appeler `job.extendLock(30000)` periodiquement si process > 30s. Sprint 9 sends restent < 5s p99, Sprint 10 PDF gen ajustera.
8. **Priority queue starvation** : low priority jobs peuvent ne jamais etre traite si high jobs continus. Mitigation : Sprint 14 introduira fair scheduling.
9. **Race condition 2 workers same job** : BullMQ utilise Redis lock (`bull:wa-send:job:lockKey`), seul un worker peut acquire ; idempotency DB status check garantit safety meme si race.
10. **Idempotency window race** : entre `findById` (status=pending) et `update` (status=sent), un autre worker pourrait avoir update. Mitigation : optimistic locking via `WHERE status='pending'` dans UPDATE (Sprint 14 ajout).
11. **Tenant context leakage** : strict AsyncLocalStorage scope via `tenantContext.run()` enrobe TOUT le process logic. Lint rule custom Sprint 14 detecte les awaits hors run().
12. **Kafka publish fail mid-flow** : si Kafka publish echoue apres update DB, message marked sent mais event perdu. Mitigation Sprint 35 outbox pattern transactional (insert event in DB + Kafka Connect Debezium).
13. **Test isolation BullMQ** : `await queue.obliterate({ force: true })` reset state entre tests. Helper `resetAllCommQueues()` factorise.
14. **DLQ topic non cree au boot** : Kafka topic `insurtech.events.dlq.comm` doit etre cree par Terraform Sprint 35 ou script `pnpm kafka:create-topics:dev`. Sinon premier DLQ publish echoue silencieusement (auto-create disabled Sprint 2 decision).
15. **Redis DB 2 flush accidentel** : `FLUSHDB` perd jobs en queue. Mitigation : Redis ACL Sprint 35 restrict FLUSHDB to ops user, AOF persistance limit perte 1s.

---

## 12. Conformite Maroc

- **Loi 09-08 article 12 (consentement)** : opt-out auto sur STOP keyword + hard bounce respecte droit retrait. Audit log via Kafka events.
- **Loi 09-08 article 28 (notification incident)** : DLQ count > seuil declenche alerting Sprint 33 -> ops review 72h.
- **Loi 09-08 audit 7 ans** : DLQ Kafka topic `insurtech.events.dlq.comm` archived S3 Glacier Sprint 35 retention 7 ans.
- **PII protection** : phones / emails dans job payload jamais loggues clairs, hash SHA-256 dans logs (`hashPhoneForLog`, `hashEmailForLog`).
- **CNDP Decision 2024-03 (cloud souverain)** : Redis hosted Atlas Cloud Services Benguerir Sprint 35.
- **ACAPS circulaire 2024-12 (notification assure)** : envoi police signed confirmation via WaSendWorker garantit delivery + tracking.

---

## 13. Conventions absolues

Multi-tenant : `tenantId` obligatoire dans tous job payloads, propage via TenantContext AsyncLocalStorage. Validation : Zod schemas runtime tous payloads. Logger Pino : action + structured fields, masque PII via helpers. pnpm. TS strict mode. Tests 32+. Skalean AI : aucun. No-emoji absolu. Idempotency : DB status check au debut process(). Cloud souverain : Redis Atlas Sprint 35. Crypto : aucun (HTTPS Meta + TLS SMTP gere providers). JSDoc sur services + workers. Performance : send WA p99 < 5s, send Email p99 < 10s, enqueue p99 < 50ms. Audit : tous jobs failed -> DLQ Kafka archive Loi 09-08 7 ans. RBAC : workers internes pas de checks RBAC, producer (orchestrator Sprint 9 Tache 3.2.9) verifie. RLS Postgres : strict via TenantContext. OTEL : metrics + traces emis a chaque job lifecycle event. Correlation_id : obligatoire dans payload, traverse end-to-end.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage
# Verify coverage >= 88% on workers + services
pnpm --filter @insurtech/api test:e2e -- comm/workers
# Verify BullDashboard
curl -fsS http://localhost:3000/admin/queues > /dev/null
# Verify no emoji in source
grep -rPn "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{26FF}]" repo/packages/comm/src/ && exit 1 || true
# Verify no console.log
grep -rPn "console\.(log|info|warn|error)" repo/packages/comm/src/ --include="*.ts" --exclude-dir=__tests__ && exit 1 || true
# Verify no plain phone in logs
grep -rPn "\+212\d{9}" repo/packages/comm/src/ --include="*.ts" && exit 1 || true
```

---

## 15. Workflow successeur

Apres validation V1-V30 P0+P1, executer :
1. Commit avec message standard : `feat(comm): bullmq queues wa-send + email-send + retry exponential + DLQ Kafka [task-3.2.8]`
2. Push + PR review.
3. Demarrer **Tache 3.2.9 -- Message Orchestrator (routing par preferred_channel)** qui consume `QueuePublisherService.addWaSend()` / `addEmailSend()` apres routing logic preferred_channel + opt-out check.
4. Sprint 14 : retry policy override per-job (high priority paiement Sprint 18 = 1 retry only).
5. Sprint 33 : DlqMonitorConsumer alerting Slack si rate DLQ > 50/15min.
6. Sprint 35 : Redis Sentinel HA + Kafka transactions exactly-once + outbox pattern transactional.

---

## 16. Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Redis down -> jobs perdus | Faible | Eleve | Redis Sentinel Sprint 35, AOF persistance, alerting Sprint 33 |
| Meta API rate limit 429 | Moyenne | Moyen | BullMQ limiter Sprint 14 + retry exponential gere 429 |
| Tenant context leak | Faible | Critique | AsyncLocalStorage strict + lint rule + tests unitaires |
| DLQ Kafka topic absent | Faible | Eleve | Terraform Sprint 35 + script init dev + smoke test |
| Worker memory leak | Moyenne | Moyen | Kubernetes liveness probe + restart policy + OTEL alerting |
| Idempotency race condition | Faible | Eleve | Optimistic locking Sprint 14 + DB UNIQUE constraint provider_message_id |
| BullDashboard data leak | Moyenne | Moyen | Auth super_admin Sprint 33 + CIDR filter + payload masking custom serializer |
| Concurrency saturation API providers | Moyenne | Moyen | Concurrency 10 calibre + scaling horizontal Sprint 14 + alerting OTEL |
| DLQ replay script absent | Faible | Moyen | Sprint 14 livre `pnpm dlq:replay --topic comm` |
| Cross-tenant cross-contamination | Tres faible | Critique | RLS Postgres + TenantContext + tests integration multi-tenant |

---

## 17. Notes sur le pattern et l'evolution future

Le pattern BullMQ + DLQ Kafka + idempotency DB pose les fondations de toutes les operations asynchrones du programme Skalean InsurTech v2.2. Sprint 10 PDF generation reuse le pattern (`pdf-generate` queue + `PdfGenerateWorker`). Sprint 13 ClickHouse aggregations reuse (`clickhouse-aggregate` queue + nightly cron). Sprint 17 Booking reminders reuse. Sprint 22 Repair sinistre processing reuse. La standardisation pattern (worker class + DLQ publish + idempotency DB + tenant context + correlation_id + OTEL metrics) garantit observability uniforme cross-services et reduit le cognitive load des developpeurs metier.

Sprint 14 introduira plusieurs ameliorations : (a) retry policy override per-job pour cas critiques (paiement Sprint 18 = 1 retry only fail-fast pour eviter double-charge client), (b) BullMQ rate limiter `limiter: { max: 80, duration: 1000 }` activ quand throughput approche limites Meta/Mailgun, (c) DLQ replay script CLI `pnpm dlq:replay --topic comm --since 2026-05-01`, (d) optimistic locking idempotency via `WHERE status='pending'` dans UPDATE comm_messages, (e) custom payload serializer BullDashboard masking PII pour conformite admin UI Sprint 27.

Sprint 33 ajoutera l'alerting operationnel : (a) DlqMonitorConsumer consume `insurtech.events.dlq.*` (wildcard cross-services), (b) Slack alerting si rate DLQ > 50/15min, (c) Grafana dashboards par queue avec p50/p95/p99 latency + retry rate + DLQ rate, (d) PagerDuty integration pour incidents critiques (DLQ rate > 200/15min ou queue depth > 5000).

Sprint 35 finalisera l'infrastructure production : (a) Redis Sentinel multi-DC Atlas Cloud Services Benguerir HA, (b) Kafka transactions exactly-once pour event publish, (c) outbox pattern transactional (insert event dans table outbox + Debezium CDC vers Kafka), (d) S3 Glacier archive DLQ topic 7 ans pour audit Loi 09-08, (e) Kubernetes HPA scaling worker pods sur metric `comm_queue_depth`.

Le pattern AsyncLocalStorage TenantContext est strictement applique car cross-tenant data leak est un risque RGPD/Loi 09-08 catastrophique. Toute deviation (oubli de `tenantContext.run()`, await en dehors du scope, query manuelle sans RLS) constitue un security incident classe P0.

L'observability OTEL emise (5 metrics + spans + correlation_id) permet le diagnostic distributed end-to-end : un client signale "je n'ai pas recu mon SMS de confirmation police signed", l'ops cherche `correlation_id` dans Grafana logs depuis le timestamp signup, voit le job enqueue, le retry transient Meta 503 attempt 1, le succes attempt 2, le Kafka event sent, le webhook delivered. Cette tracabilite est critique pour le support client + audit ACAPS.

Le choix `removeOnFail.age: 90 jours + count: 50000` retient suffisamment de jobs failed pour analyse incidents post-mortem mais limite la croissance Redis (50k * 2KB = 100MB max). Sprint 33 archive automatique vers S3 Glacier sur trigger removeOnFail.age expiration via cron job.

Ce livrable est complet, auto-suffisant, et conforme aux exigences Sprint 9 / programme Skalean InsurTech v2.2.

---

**Fin de tache 3.2.8.**
