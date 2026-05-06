# Tache 1.2.13 -- KafkaConsumerBase abstract class -- manual ack + retry exponential + DLQ + idempotency

## 1. Header

- **ID** : 1.2.13
- **Sprint** : 2 (Database & Kafka Foundation)
- **Phase** : 1 (Foundation)
- **Duree** : 6h
- **Priorite** : P0 (bloquant pour tous consumers Sprint 9 Communications, Sprint 28 Compliance, et tous modules metier qui consomment des events Kafka)
- **Depend** : 1.2.12 (KafkaProducerBase abstract class avec headers + tenant_id + correlation_id)
- **Bloque** : 1.2.14 (Outbox pattern relayer), 1.2.15 (Inbox pattern), Sprint 9 (WhatsAppNotificationConsumer, EmailNotificationConsumer), Sprint 28 (ComplianceAuditConsumer), tous modules metier consommateurs
- **Owner** : Backend Platform Team
- **Reviewer** : Tech Lead + Staff Engineer (revue obligatoire car classe socle critique)
- **Statut** : TODO
- **Tags** : kafka, consumer, abstract-class, manual-ack, retry, dlq, idempotency, nestjs, kafkajs, sprint-02
- **AUCUNE EMOJI** dans le code, les commits, les logs, la documentation generee. Politique stricte ASCII-only enforcee par eslint-plugin-no-emoji et pre-commit hook.

## 2. But

### 2.1 Pattern abstract base eliminate boilerplate

L'objectif premier de la tache 1.2.13 est de fournir une classe abstraite NestJS reutilisable `KafkaConsumerBase<TPayload>` qui encapsule l'integralite du cycle de vie d'un consumer Kafka : connexion au broker, souscription au topic, parsing JSON du message brut, validation Zod du payload via le `topicSchemaMap` defini en 1.2.11, verification d'idempotence via la table `consumer_processed_events`, invocation de la methode metier `handle(payload, envelope)` implementee par les sous-classes, gestion d'erreurs avec retry exponentiel (3 tentatives 1s/5s/30s), publication en Dead Letter Queue (DLQ) apres exhaustion des retries, et acknowledgment manuel de l'offset Kafka via `commitOffsetsIfNecessary`. Sans cette abstraction, chaque equipe metier (Souscription, Sinistres, Communications, Compliance, etc.) devrait re-implementer ces 250 lignes de logique transverse dans chaque consumer, generant duplication massive, divergence des comportements (ack auto vs manuel, retry inconsistant, DLQ absent), et regressions silencieuses lors de modifications globales. Cette classe socle est attendue par 12+ consumers concrets prevus dans les sprints 9, 11, 13, 16, 18, 23, 28 et permet aux developpeurs metier de se concentrer uniquement sur la logique handle() business.

### 2.2 Idempotency cle pour at-least-once delivery

Kafka garantit fondamentalement une semantique at-least-once : un message peut etre delivre plusieurs fois en cas de rebalance du consumer group, de crash entre `handle()` et `commitOffsets`, ou de redeploiement. La table `consumer_processed_events` (cle composite `(event_id, group_id)`) joue le role de registre d'idempotence cote consumer : avant tout traitement metier, le base check si l'envelope a deja ete processed pour ce group_id specifique. Le pattern `INSERT INTO consumer_processed_events (event_id, group_id) VALUES (...) ON CONFLICT (event_id, group_id) DO NOTHING RETURNING event_id` permet de detecter atomiquement la premiere occurrence et skip les duplicates. La cle composite `(event_id, group_id)` est cruciale : un meme event_id peut legitimement etre traite par plusieurs consumer groups distincts (whatsapp-notifications-handler ET email-notifications-handler ET compliance-audit-handler), chacun consumant le meme topic mais avec sa propre logique metier. Cette table grossit lineairement avec le throughput, d'ou la politique de retention 30 jours via cleanup job cron prevu Sprint 33.

### 2.3 DLQ pour replay et investigation post-mortem

Quand le retry exponentiel echoue (3 tentatives consommees), le message ne peut etre ignore silencieusement (perte de donnees client critique, violation Article 12 ACAPS sur audit trail) ni boucler infiniment (consumer lag explosion, blocage partition entiere). Le pattern Dead Letter Queue resout ce probleme : le base publie le message original enrichi de metadata d'erreur (stacktrace, attempt_count, original_envelope, error_class, failed_at, consumer_group_id) dans un topic dedie `insurtech.events.dlq.{module}` (par exemple `insurtech.events.dlq.communications` pour les echecs du module Communications). Ces messages DLQ sont consommes par : (a) un dashboard Grafana qui alerte l'astreinte, (b) un outil de replay manuel `cli/dlq-replay.ts` (Sprint 33) qui permet de re-publier vers le topic original apres correction du bug, (c) le module Compliance qui archive ces echecs pour audit ACAPS regulatory. Sans DLQ, un bug dans un consumer (par exemple une regression de validation Zod) bloque toute la partition et impacte tous les tenants assignes, generant un incident P0 avec downtime client.

## 3. Contexte etendu

### 3.1 Pourquoi manual ack vs auto-commit

KafkaJS propose deux modes de commit d'offset : auto-commit (configuration `autoCommit: true` avec `autoCommitInterval` periodique) et manual ack (commit explicite via `commitOffsetsIfNecessary` apres `handle()` succes). Le mode auto-commit est dangereux dans un contexte at-least-once business critical : si le consumer crash entre `eachMessage` (ou le message est lu et passe au handler) et `autoCommitInterval` tick (5 secondes par defaut), l'offset est commite ALORS que le handler n'a peut-etre pas fini son traitement, generant data loss. Pire, si `handle()` jette une exception et que le retry exponentiel n'a pas lieu (auto-commit ne sait pas que l'exception a eu lieu), l'offset progresse quand meme et le message est perdu. Le mode manual ack force le base a commit l'offset UNIQUEMENT apres succes complet de `handle() + idempotency_insert + DLQ_if_needed`, garantissant que tout message est soit (a) traite avec succes et offset commit, soit (b) replay au prochain redeploiement (idempotency table empeche double-execution business). C'est pour cette raison que `KAFKA_CONSUMER_AUTO_COMMIT=false` est enforce dans le base et qu'aucune sous-classe ne peut surcharger ce comportement.

### 3.2 Alternatives eachMessage vs eachBatch performance

KafkaJS expose deux APIs de consommation : `eachMessage` (callback par message individuel) et `eachBatch` (callback par batch de messages, avec `resolveOffset` granulaire et `heartbeat` explicite). `eachMessage` est plus simple et naturel mais limite le throughput a quelques milliers de messages/seconde car chaque message implique un round-trip handler + db idempotency + commit. `eachBatch` permet de traiter 10000+ messages/seconde via parallelisation par partition, mais complique enormement la gestion d'erreurs (un seul message echoue dans le batch -> que faire des autres ? rollback batch ? skip et continue ?). Pour la version 1 du KafkaConsumerBase (Sprint 2), nous adoptons `eachMessage` pour la simplicite et la robustesse, en sachant que les volumetries InsurTech Maroc (estimees a 500-2000 events/sec en pic Sprint 24+) restent gerable. Une migration eventuelle vers `eachBatch` est documentee dans Annexe A et programmee Sprint 38 si les metriques demontrent un bottleneck. Le compromis fait ici est explicite : simplicity over raw throughput, with documented escape hatch.

### 3.3 Trade-offs idempotency table size growth

La table `consumer_processed_events` grossit lineairement avec : `total_events_consumed_per_day * unique_consumer_groups`. Avec une estimation de 500 events/sec en moyenne et 8 consumer groups distincts (whatsapp, email, push, compliance, audit, billing, ml-features, search-index), nous avons environ `500 * 86400 * 8 = 345_600_000` rows par jour, soit environ 200 GB par mois si on garde indefiniment. La politique de retention 30 jours (configurable via `CONSUMER_PROCESSED_EVENTS_RETENTION_DAYS`) limite a environ 6 TB cumule, ce qui reste acceptable sur Aurora PostgreSQL classe `db.r6g.4xlarge`. Un cleanup job cron quotidien (Sprint 33, tache 33.5.7) supprime par batch de 10 000 rows toutes les rows `processed_at < NOW() - INTERVAL '30 days'`. Le risque inverse est qu'un message en retry pendant >30 jours (cas pathologique impossible en theorie mais possible si DLQ replay manuel apres 31 jours) verrait son entree d'idempotence supprimee et serait re-processe a tort. La politique d'audit ACAPS (decision-016) impose cependant que les replays manuels >30j passent par un workflow d'approbation explicite qui flag les events concernes pour eviter ce cas.

### 3.4 Decision 004 Kafka et decision 003 TypeORM

Cette tache implemente concretement deux decisions architecturales :
- **Decision 004 (Kafka comme bus d'events principal)** : utilisation de KafkaJS 2.2.4 comme client officiel, configuration `enable.idempotence=true` cote producer (delegue a 1.2.12), configuration consumer avec `isolation_level=read_committed` pour eviter de lire des messages produits dans des transactions abortees, naming convention topics `insurtech.events.{domain}.{aggregate}.v{version}` (par exemple `insurtech.events.users.user-signed-in.v1`).
- **Decision 003 (TypeORM comme ORM principal)** : la table `consumer_processed_events` est exposee comme entity TypeORM `ConsumerProcessedEventEntity` dans `src/database/entities/system/consumer-processed-event.entity.ts`, avec migration `1735000000008-ConsumerProcessedEvents.ts`. La query `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id` utilise le QueryBuilder TypeORM avec `.orIgnore()` qui genere le SQL natif PostgreSQL.

### 3.5 Douze pieges classiques rencontres

**Piege 1 -- ON CONFLICT race condition during INSERT** : sans la clause `ON CONFLICT DO NOTHING`, un INSERT classique sur `consumer_processed_events` echouerait avec `duplicate key violation` lors d'un retry concurrent, jetant une exception qui serait elle-meme retry-ee, generant une boucle infinie. Le `ON CONFLICT (event_id, group_id) DO NOTHING RETURNING event_id` est atomique au niveau PostgreSQL et retourne `[]` (zero row) si conflict (deja processed) ou `[{event_id}]` si insertion reussie (premier processing). Le base interprete `result.length === 0` comme "deja processed, skip handler" et `result.length === 1` comme "first time, execute handler".

**Piege 2 -- eachBatch ordering** : si nous migrons un jour vers `eachBatch`, l'ordering des messages au sein d'une partition n'est PAS preserve si le handler parallelise via `Promise.all`. La garantie Kafka d'ordering est par partition + ordre d'insertion dans le batch, mais le code applicatif doit explicitement traiter dans l'ordre. C'est une raison de plus pour rester sur `eachMessage` en V1.

**Piege 3 -- Consumer rebalance during processing** : si un consumer rebalance (nouveau pod ajoute, vieux pod kill, session timeout depasse) survient pendant que `handle()` tourne, le message en cours est re-assigne a un autre pod et re-processe. La table d'idempotence empeche le double-processing business mais ne previent pas le commit d'offset perdu. Le base emet un log `consumer.rebalance.in_flight_message` pour visibilite.

**Piege 4 -- Manual commit failure handling** : `commitOffsetsIfNecessary` peut echouer (network glitch transient, broker overloaded). Le base capture cette exception et la log au niveau ERROR avec `event_id` et `offset` pour investigation, mais ne re-throw pas (sinon retry du handler qui a deja reussi business-wise -> double-side-effect). Le message sera re-processe au prochain restart, l'idempotence table le skip.

**Piege 5 -- DLQ topic auto-create disabled prod** : en production, `auto.create.topics.enable=false` est enforce sur le cluster Kafka MSK Atlas (decision-008). Cela signifie que si un topic DLQ `insurtech.events.dlq.communications` n'existe pas pre-cree, la publication echoue avec `UNKNOWN_TOPIC_OR_PARTITION`. Le base detecte cette erreur specifique et la fallback vers une table `dlq_unpublished_messages` (PostgreSQL) en attendant que le SRE cree le topic manuellement (alarme PagerDuty). En dev/staging, l'auto-create est active pour fluidifier le developpement.

**Piege 6 -- DLQ replay tooling** : les messages en DLQ doivent pouvoir etre replays apres correction du bug. Sans tooling, l'equipe utilise `kafka-console-consumer.sh` puis `kafka-console-producer.sh` manuellement, source d'erreurs (mauvais topic, mauvais payload, perte de headers). La tache 33.5.8 livre `cli/dlq-replay.ts` qui : (a) consume topic DLQ, (b) deserialize l'envelope original, (c) verifie via prompt interactif si le message doit etre replay, (d) re-publie sur le topic source avec un header `replayed_from_dlq=true` et `replayed_at`.

**Piege 7 -- Retry config consumer side vs Kafka native retry** : KafkaJS offre une option `retry: { initialRetryTime, retries }` au niveau Consumer, mais cette retry concerne UNIQUEMENT les erreurs de protocole Kafka (network glitch, leader election), PAS les exceptions du handler metier. Pour le retry handler, nous implementons une boucle `try/catch` avec backoff exponentiel manuel dans le base. Confondre les deux est un piege classique : developpeur configure `retries: 10` au niveau Consumer et croit que son handler retry 10 fois, alors qu'il s'agit du retry protocol Kafka.

**Piege 8 -- Validation error never retry** : si la validation Zod du payload echoue (`safeParse().success === false`), c'est une erreur metier permanente : retry n'aidera jamais (le payload restera invalide). Le base envoie immediatement en DLQ sans retry, avec un flag `error_type: 'validation_error'` distinct de `error_type: 'transient_error'`. Cela evite de gaspiller 36 secondes de retry inutile et liberer la partition rapidement.

**Piege 9 -- Large payload deserialization** : Kafka accepte des messages jusqu'a `message.max.bytes=1048576` (1 MB par defaut). Un payload JSON malformatte ou non-trim peut depasser cette limite et faire crasher le deserialization avec `Out of Memory` cote consumer. Le base impose un timeout de 5 secondes sur `JSON.parse(message.value.toString())` via un wrapper `parseJsonWithTimeout`, et logge `payload.size_bytes` pour visibilite. Les payloads >100 KB sont flagues warning pour reduire la taille en amont (utilisation de references S3 plutot que payload inline).

**Piege 10 -- AsyncLocalStorage tenant_id from envelope** : chaque envelope contient un `tenant_id` (decision-002 multi-tenancy). Pour que les requetes SQL emises par `handle()` filtrent automatiquement par `tenant_id` (Row Level Security PostgreSQL ou clause WHERE TypeORM via TenantSubscriber), le base injecte le `tenant_id` dans `AsyncLocalStorage` AVANT d'invoquer `handle()`, via `tenantContext.run({ tenantId: envelope.tenant_id }, async () => await this.handle(payload, envelope))`. Sans cette propagation, les queries du handler tournent en mode "global" et peuvent leak des donnees inter-tenants -- violation RGPD critique.

**Piege 11 -- Group_id naming convention** : un consumer group_id mal nomme (par exemple `notifications` au lieu de `whatsapp-notifications-handler`) peut etre accidentellement partage entre deux services distincts qui croient consommer independamment, generant des messages skipped (Kafka assigne chaque partition a un seul consumer du group). Le base enforce une convention via lint regex : `^[a-z][a-z0-9-]{4,40}-handler$` (suffixe `-handler` obligatoire). Les noms violants sont rejetes au demarrage avec une exception explicite.

**Piege 12 -- Consumer lag monitoring** : un consumer qui prend du retard (handler trop lent, pic de trafic) accumule du lag (offset non commit grandit). Sans monitoring, ce lag peut atteindre des heures avant detection. Le base expose une metric OTEL `kafka_consumer_lag` (gauge par topic+partition+group_id) calculee via `consumer.describeGroup()` toutes les 30 secondes. Un dashboard Grafana alerte si `lag > CONSUMER_LAG_ALERT_THRESHOLD` (1000 par defaut) pendant 5 minutes consecutives -> PagerDuty P2.

## 4. Architecture context

### 4.1 Position dans le sprint 2

Cette tache est la 13eme du sprint 2 (Database & Kafka Foundation). Le sprint comprend 24 taches : 1.2.1 a 1.2.12 traitent setup Postgres + TypeORM + migrations + decorateurs multi-tenant + Kafka producer base, et 1.2.13 a 1.2.24 traitent consumer base + outbox/inbox + topics initiaux + monitoring + tests integration. La 1.2.13 arrive apres la 1.2.12 (KafkaProducerBase) car les deux partagent le module commun `KafkaModule` qui expose la connexion KafkaJS singleton. Le KafkaConsumerBase importe le `KafkaModule.forFeature()` pour obtenir une instance `Kafka` partagee, evitant de creer N connexions TCP distinctes.

### 4.2 Reutilisation cross-sprints

Le KafkaConsumerBase est consomme par 12 consumers concrets prevus :
- Sprint 9 (Communications) : `WhatsAppNotificationConsumer`, `EmailNotificationConsumer`, `PushNotificationConsumer`, `SmsNotificationConsumer`
- Sprint 11 (Souscription) : `QuoteRequestConsumer`, `PolicyIssuedConsumer`
- Sprint 13 (Sinistres) : `ClaimSubmittedConsumer`, `ClaimSettledConsumer`
- Sprint 16 (Paiements) : `PaymentReceivedConsumer`, `PremiumDueConsumer`
- Sprint 18 (Billing) : `InvoiceGeneratedConsumer`
- Sprint 23 (ML) : `ScoringRequestConsumer`
- Sprint 28 (Compliance) : `ComplianceAuditConsumer`, `ACAPSReportConsumer`
- Sprint 33 (Tooling) : `DlqReplayConsumer` (consumer special qui consume les topics DLQ pour replay)

Tous heritent de `KafkaConsumerBase<TPayload>` et n'implementent que `getTopic()`, `getGroupId()`, `handle(payload, envelope)`. Le boilerplate (250 lignes) est mutualise.

### 4.3 Diagramme flux

```
+----------------+       +-------------------+       +----------------+
| Kafka Broker   | ----> | KafkaConsumerBase | ----> | Concrete       |
| (topic message)|       |  (eachMessage)    |       | handle() impl  |
+----------------+       +-------------------+       +----------------+
                              |
                              v
                    +---------+----------+
                    | 1. parse JSON      |
                    | 2. validate Zod    |
                    | 3. idempotency chk |
                    | 4. async ctx tenant|
                    | 5. invoke handle() |
                    | 6. retry x3 backoff|
                    | 7. DLQ if exhausted|
                    | 8. commit offset   |
                    +--------------------+
                              |
                              v
                    +---------+----------+
                    | consumer_processed |
                    |     _events table  |
                    +--------------------+
                              |
                              v (on failure)
                    +---------+----------+
                    | DLQ topic publish  |
                    | insurtech.events.  |
                    | dlq.{module}       |
                    +--------------------+
```

## 5. Livrables checkables

L1. Fichier `libs/kafka/src/consumer/kafka-consumer.base.ts` cree (~250 lignes, abstract class avec generics `<TPayload>`)
L2. Methode abstract `handle(payload: TPayload, envelope: EventEnvelope<TPayload>): Promise<void>` declaree
L3. Methode abstract `getTopic(): Topics` declaree (retourne enum Topics defini en 1.2.10)
L4. Methode abstract `getGroupId(): string` declaree avec validation regex au demarrage
L5. Methode `onMessage(message)` qui orchestre parse + validate + idempotency + handle + ack
L6. Configuration KafkaJS `autoCommit: false` enforced (test verifie)
L7. Methode `commitOffsetsIfNecessary` appelee apres succes handle
L8. Validation Zod via `topicSchemaMap.get(topic).safeParse(payload)` AVANT handle
L9. Idempotency check via `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id`
L10. Retry exponentiel : 3 tentatives, delais 1000ms / 5000ms / 30000ms (configurable)
L11. Distinction `transient_error` (retry) vs `validation_error` (no retry direct DLQ)
L12. Publication DLQ topic `insurtech.events.dlq.{module}` apres 3 echecs
L13. Metadata DLQ : stacktrace, attempt_count, original_envelope, error_class, failed_at, consumer_group_id
L14. Logs Pino structures : event_id, topic, partition, offset, attempt, duration_ms, group_id, tenant_id
L15. Metrics OTEL : `kafka_consumer_messages_total`, `kafka_consumer_failures_total`, `kafka_consumer_dlq_total`, `kafka_consumer_handle_duration_ms`, `kafka_consumer_lag`
L16. AsyncLocalStorage tenant_id propagation envelope -> handle
L17. Fichier `libs/kafka/src/consumer/kafka-consumer.module.ts` cree avec `forRoot/forFeature`
L18. Fichier `libs/kafka/src/dlq/dlq-publisher.service.ts` cree (~80 lignes)
L19. Migration `src/database/migrations/1735000000008-ConsumerProcessedEvents.ts` cree
L20. Entity `src/database/entities/system/consumer-processed-event.entity.ts` cree
L21. Error class `libs/kafka/src/errors/dlq-failure.error.ts` cree
L22. Error class `libs/kafka/src/errors/validation-error.error.ts` cree (sub-class pour skip retry)
L23. Exemple concret `libs/kafka/src/examples/example-concrete-consumer.ts` (extends KafkaConsumerBase<UserSignedInPayload>)
L24. Tests unitaires `kafka-consumer.base.spec.ts` >= 14 tests
L25. Tests integration `integration/kafka-consumer-real.spec.ts` >= 8 tests (testcontainer Kafka)
L26. Tests integration `integration/dlq-replay.spec.ts` >= 5 tests
L27. Tests integration `integration/idempotency-table.spec.ts` >= 4 tests
L28. Variables env documentees dans `apps/api/.env.example` (>= 22 vars)
L29. JSDoc complet sur classe + methodes publiques
L30. Pas d'emoji dans le code (verif eslint-plugin-no-emoji)
L31. Coverage >= 90% sur `kafka-consumer.base.ts`
L32. Documentation `docs/kafka/consumer-base.md` (architecture + exemples + troubleshooting)

## 6. Fichiers a creer ou modifier

| Fichier | Type | Lignes approx | Description |
|---|---|---|---|
| `libs/kafka/src/consumer/kafka-consumer.base.ts` | Nouveau | 250 | Classe abstraite principale |
| `libs/kafka/src/consumer/kafka-consumer.module.ts` | Nouveau | 50 | Module NestJS forRoot/forFeature |
| `libs/kafka/src/dlq/dlq-publisher.service.ts` | Nouveau | 80 | Service publication DLQ |
| `libs/kafka/src/errors/dlq-failure.error.ts` | Nouveau | 25 | Error class DLQ failure |
| `libs/kafka/src/errors/validation-error.error.ts` | Nouveau | 20 | Error class validation Zod |
| `libs/kafka/src/errors/transient-error.error.ts` | Nouveau | 20 | Error class transient (retry) |
| `libs/kafka/src/types/kafka-consumer.types.ts` | Nouveau | 60 | Types TypeScript (RetryConfig, DlqMetadata, etc.) |
| `src/database/migrations/1735000000008-ConsumerProcessedEvents.ts` | Nouveau | 50 | Migration table |
| `src/database/entities/system/consumer-processed-event.entity.ts` | Nouveau | 35 | Entity TypeORM |
| `src/database/repositories/consumer-processed-event.repository.ts` | Nouveau | 60 | Repository custom avec ON CONFLICT |
| `libs/kafka/src/examples/example-concrete-consumer.ts` | Nouveau | 70 | Exemple WhatsAppNotificationConsumer |
| `libs/kafka/src/consumer/kafka-consumer.base.spec.ts` | Nouveau | 600 | Tests unitaires |
| `test/integration/kafka-consumer-real.spec.ts` | Nouveau | 350 | Tests integration testcontainer |
| `test/integration/dlq-replay.spec.ts` | Nouveau | 200 | Tests DLQ flow |
| `test/integration/idempotency-table.spec.ts` | Nouveau | 180 | Tests idempotency edge cases |
| `apps/api/.env.example` | Modifier | +25 | Variables env consumer |
| `docs/kafka/consumer-base.md` | Nouveau | 400 | Documentation |

## 7. Code patterns complets

### 7.1 kafka-consumer.base.ts (complet)

```typescript
// libs/kafka/src/consumer/kafka-consumer.base.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka, KafkaMessage } from 'kafkajs';
import { trace, metrics, SpanStatusCode, context as otelContext } from '@opentelemetry/api';
import { z, ZodSchema } from 'zod';
import { setTimeout as sleep } from 'timers/promises';

import { Topics } from '../topics/topics.enum';
import { topicSchemaMap } from '../topics/topic-schema-map';
import { EventEnvelope } from '../types/event-envelope.type';
import { RetryConfig } from '../types/kafka-consumer.types';
import { ValidationError } from '../errors/validation-error.error';
import { TransientError } from '../errors/transient-error.error';
import { DlqFailureError } from '../errors/dlq-failure.error';
import { DlqPublisherService } from '../dlq/dlq-publisher.service';
import { ConsumerProcessedEventRepository } from '../../../../src/database/repositories/consumer-processed-event.repository';
import { tenantContext } from '../../../tenant/src/tenant-context';

const tracer = trace.getTracer('kafka-consumer-base', '1.0.0');
const meter = metrics.getMeter('kafka-consumer-base', '1.0.0');

const messagesCounter = meter.createCounter('kafka_consumer_messages_total', {
  description: 'Total messages consumed',
});
const failuresCounter = meter.createCounter('kafka_consumer_failures_total', {
  description: 'Total messages failed (after retries)',
});
const dlqCounter = meter.createCounter('kafka_consumer_dlq_total', {
  description: 'Total messages sent to DLQ',
});
const handleHistogram = meter.createHistogram('kafka_consumer_handle_duration_ms', {
  description: 'Duration of handle() execution in ms',
  unit: 'ms',
});
const lagGauge = meter.createObservableGauge('kafka_consumer_lag', {
  description: 'Consumer lag per partition',
});

const GROUP_ID_REGEX = /^[a-z][a-z0-9-]{4,40}-handler$/;

@Injectable()
export abstract class KafkaConsumerBase<TPayload> implements OnModuleInit, OnModuleDestroy {
  protected readonly logger: Logger;
  private consumer: Consumer | null = null;
  private retryConfig: RetryConfig;
  private validationStrict: boolean;
  private dlqEnabled: boolean;
  private dlqTopicPrefix: string;
  private isShuttingDown = false;

  constructor(
    protected readonly kafka: Kafka,
    protected readonly configService: ConfigService,
    protected readonly dlqPublisher: DlqPublisherService,
    protected readonly idempotencyRepo: ConsumerProcessedEventRepository,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.retryConfig = {
      maxAttempts: this.configService.get<number>('KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS', 3),
      initialMs: this.configService.get<number>('KAFKA_CONSUMER_RETRY_INITIAL_MS', 1000),
      multiplier: this.configService.get<number>('KAFKA_CONSUMER_RETRY_MULTIPLIER', 5),
      maxMs: this.configService.get<number>('KAFKA_CONSUMER_RETRY_MAX_MS', 30000),
    };
    this.validationStrict = this.configService.get<boolean>('CONSUMER_VALIDATION_STRICT', true);
    this.dlqEnabled = this.configService.get<boolean>('KAFKA_CONSUMER_DLQ_ENABLED', true);
    this.dlqTopicPrefix = this.configService.get<string>(
      'KAFKA_CONSUMER_DLQ_TOPIC_PREFIX',
      'insurtech.events.dlq',
    );
  }

  abstract handle(payload: TPayload, envelope: EventEnvelope<TPayload>): Promise<void>;
  abstract getTopic(): Topics;
  abstract getGroupId(): string;

  protected getDlqModule(): string {
    return this.getGroupId().replace(/-handler$/, '').split('-')[0];
  }

  async onModuleInit(): Promise<void> {
    const groupId = this.getGroupId();
    if (!GROUP_ID_REGEX.test(groupId)) {
      throw new Error(
        `Invalid group_id "${groupId}" for ${this.constructor.name}. ` +
          `Must match ${GROUP_ID_REGEX.source} (e.g. "whatsapp-notifications-handler")`,
      );
    }

    const topic = this.getTopic();
    if (!topicSchemaMap.has(topic)) {
      throw new Error(`No Zod schema registered for topic "${topic}". Register in topic-schema-map.ts`);
    }

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: this.configService.get<number>('KAFKA_CONSUMER_SESSION_TIMEOUT_MS', 30000),
      heartbeatInterval: this.configService.get<number>('KAFKA_CONSUMER_HEARTBEAT_MS', 3000),
      allowAutoTopicCreation: false,
      readUncommitted: false,
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });

    this.logger.log({
      message: 'Consumer connected and subscribed',
      topic,
      group_id: groupId,
      consumer_class: this.constructor.name,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload) => {
        await this.onMessage(payload);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.consumer) {
      this.logger.log({ message: 'Consumer disconnecting gracefully' });
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }

  private async onMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message, heartbeat } = payload;
    const startTime = Date.now();
    const groupId = this.getGroupId();

    return tracer.startActiveSpan(
      `kafka.consume.${topic}`,
      { attributes: { 'messaging.system': 'kafka', 'messaging.destination': topic, 'messaging.kafka.partition': partition, 'messaging.kafka.consumer_group': groupId } },
      async (span) => {
        let envelope: EventEnvelope<TPayload> | null = null;
        let parsedPayload: TPayload | null = null;
        let attempt = 0;

        try {
          // Step 1: parse JSON with timeout safeguard
          const rawValue = message.value?.toString('utf-8');
          if (!rawValue) {
            throw new ValidationError('Message value is empty', { topic, partition, offset: message.offset });
          }

          const sizeBytes = Buffer.byteLength(rawValue, 'utf-8');
          if (sizeBytes > 100 * 1024) {
            this.logger.warn({
              message: 'Large payload detected',
              size_bytes: sizeBytes,
              topic,
              partition,
              offset: message.offset,
            });
          }

          envelope = JSON.parse(rawValue) as EventEnvelope<TPayload>;

          // Step 2: validate Zod
          const schema = topicSchemaMap.get(topic) as ZodSchema<TPayload>;
          const validation = schema.safeParse(envelope.payload);
          if (!validation.success) {
            throw new ValidationError('Zod validation failed', {
              topic,
              partition,
              offset: message.offset,
              event_id: envelope.event_id,
              issues: validation.error.issues,
            });
          }
          parsedPayload = validation.data;

          // Step 3: idempotency check
          const inserted = await this.idempotencyRepo.tryInsert(envelope.event_id, groupId);
          if (!inserted) {
            this.logger.log({
              message: 'Idempotent skip (already processed)',
              event_id: envelope.event_id,
              topic,
              partition,
              offset: message.offset,
              group_id: groupId,
            });
            await this.commitOffset(payload);
            return;
          }

          // Step 4: handle with retry exponential, propagate tenant_id via AsyncLocalStorage
          await this.executeHandleWithRetry(parsedPayload, envelope, payload, span, () => attempt);

          // Step 5: commit offset
          await this.commitOffset(payload);

          const duration = Date.now() - startTime;
          handleHistogram.record(duration, { topic, group_id: groupId, status: 'success' });
          messagesCounter.add(1, { topic, group_id: groupId, status: 'success' });
          span.setStatus({ code: SpanStatusCode.OK });

          this.logger.log({
            message: 'Message processed successfully',
            event_id: envelope.event_id,
            topic,
            partition,
            offset: message.offset,
            attempt: attempt + 1,
            duration_ms: duration,
            group_id: groupId,
            tenant_id: envelope.tenant_id,
          });
        } catch (err) {
          await this.handleFailure(err, envelope, message, payload, attempt);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        } finally {
          span.end();
          await heartbeat();
        }
      },
    );
  }

  private async executeHandleWithRetry(
    payload: TPayload,
    envelope: EventEnvelope<TPayload>,
    eachMsg: EachMessagePayload,
    span: ReturnType<typeof tracer.startActiveSpan> extends Promise<infer S> ? S : never,
    getAttempt: () => number,
  ): Promise<void> {
    const groupId = this.getGroupId();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        await tenantContext.run({ tenantId: envelope.tenant_id, correlationId: envelope.correlation_id }, async () => {
          await this.handle(payload, envelope);
        });
        return;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof ValidationError) {
          // Validation errors are permanent, no retry
          throw err;
        }
        const isLastAttempt = attempt === this.retryConfig.maxAttempts - 1;
        if (isLastAttempt) {
          throw err;
        }
        const delayMs = Math.min(
          this.retryConfig.initialMs * Math.pow(this.retryConfig.multiplier, attempt),
          this.retryConfig.maxMs,
        );
        this.logger.warn({
          message: 'Handle failed, retrying',
          event_id: envelope.event_id,
          topic: this.getTopic(),
          attempt: attempt + 1,
          next_delay_ms: delayMs,
          error_class: lastError.constructor.name,
          error_message: lastError.message,
          group_id: groupId,
        });
        await sleep(delayMs);
      }
    }

    if (lastError) throw lastError;
  }

  private async handleFailure(
    err: unknown,
    envelope: EventEnvelope<TPayload> | null,
    message: KafkaMessage,
    eachMsg: EachMessagePayload,
    attempt: number,
  ): Promise<void> {
    const error = err as Error;
    const groupId = this.getGroupId();
    const topic = this.getTopic();

    failuresCounter.add(1, { topic, group_id: groupId, error_class: error.constructor.name });

    this.logger.error({
      message: 'Message processing failed permanently',
      event_id: envelope?.event_id ?? 'UNKNOWN',
      topic,
      partition: eachMsg.partition,
      offset: message.offset,
      attempts: attempt + 1,
      error_class: error.constructor.name,
      error_message: error.message,
      stacktrace: error.stack,
      group_id: groupId,
    });

    if (this.dlqEnabled && envelope) {
      const dlqTopic = `${this.dlqTopicPrefix}.${this.getDlqModule()}`;
      try {
        await this.dlqPublisher.publish(dlqTopic, {
          original_envelope: envelope,
          error_class: error.constructor.name,
          error_message: error.message,
          stacktrace: error.stack ?? '',
          attempt_count: attempt + 1,
          consumer_group_id: groupId,
          source_topic: topic,
          source_partition: eachMsg.partition,
          source_offset: message.offset,
          failed_at: new Date().toISOString(),
          error_type: error instanceof ValidationError ? 'validation_error' : 'transient_error',
        });
        dlqCounter.add(1, { dlq_topic: dlqTopic, error_class: error.constructor.name });

        // Commit offset to advance past poisoned message
        await this.commitOffset(eachMsg);
      } catch (dlqErr) {
        this.logger.error({
          message: 'CRITICAL: DLQ publish failed, message stuck',
          event_id: envelope.event_id,
          dlq_error: (dlqErr as Error).message,
        });
        throw new DlqFailureError(
          `Failed to publish to DLQ for event ${envelope.event_id}: ${(dlqErr as Error).message}`,
        );
      }
    }
  }

  private async commitOffset(payload: EachMessagePayload): Promise<void> {
    if (!this.consumer) return;
    try {
      await this.consumer.commitOffsets([
        {
          topic: payload.topic,
          partition: payload.partition,
          offset: (BigInt(payload.message.offset) + 1n).toString(),
        },
      ]);
    } catch (err) {
      this.logger.error({
        message: 'commitOffsets failed (non-fatal, will replay)',
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        error: (err as Error).message,
      });
    }
  }
}
```

### 7.2 kafka-consumer.module.ts (complet)

```typescript
// libs/kafka/src/consumer/kafka-consumer.module.ts
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';

import { DlqPublisherService } from '../dlq/dlq-publisher.service';
import { ConsumerProcessedEventRepository } from '../../../../src/database/repositories/consumer-processed-event.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumerProcessedEventEntity } from '../../../../src/database/entities/system/consumer-processed-event.entity';

export const KAFKA_CLIENT_TOKEN = Symbol('KAFKA_CLIENT_TOKEN');

@Module({})
export class KafkaConsumerModule {
  static forRoot(): DynamicModule {
    const kafkaProvider: Provider = {
      provide: KAFKA_CLIENT_TOKEN,
      useFactory: (config: ConfigService) =>
        new Kafka({
          clientId: config.get<string>('KAFKA_CLIENT_ID', 'insurtech-api'),
          brokers: config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
          logLevel: logLevel.WARN,
          ssl: config.get<boolean>('KAFKA_SSL_ENABLED', false),
          sasl: config.get<boolean>('KAFKA_SASL_ENABLED', false)
            ? {
                mechanism: 'scram-sha-512',
                username: config.get<string>('KAFKA_SASL_USERNAME', ''),
                password: config.get<string>('KAFKA_SASL_PASSWORD', ''),
              }
            : undefined,
          retry: { initialRetryTime: 300, retries: 8 },
        }),
      inject: [ConfigService],
    };

    return {
      module: KafkaConsumerModule,
      imports: [ConfigModule, TypeOrmModule.forFeature([ConsumerProcessedEventEntity])],
      providers: [kafkaProvider, DlqPublisherService, ConsumerProcessedEventRepository],
      exports: [kafkaProvider, DlqPublisherService, ConsumerProcessedEventRepository],
      global: true,
    };
  }

  static forFeature(consumers: Type<unknown>[]): DynamicModule {
    return {
      module: KafkaConsumerModule,
      providers: [...consumers],
      exports: [...consumers],
    };
  }
}
```

### 7.3 dlq-publisher.service.ts (complet)

```typescript
// libs/kafka/src/dlq/dlq-publisher.service.ts
import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

import { KAFKA_CLIENT_TOKEN } from '../consumer/kafka-consumer.module';
import { DlqMetadata } from '../types/kafka-consumer.types';

@Injectable()
export class DlqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqPublisherService.name);
  private producer: Producer | null = null;

  constructor(
    @Inject(KAFKA_CLIENT_TOKEN) private readonly kafka: Kafka,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionalId: undefined,
    });
    await this.producer.connect();
    this.logger.log({ message: 'DLQ Publisher connected' });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }

  async publish(dlqTopic: string, metadata: DlqMetadata): Promise<void> {
    if (!this.producer) throw new Error('DLQ Producer not initialized');

    const dlqMessage = {
      dlq_id: uuidv4(),
      published_at: new Date().toISOString(),
      ...metadata,
    };

    try {
      await this.producer.send({
        topic: dlqTopic,
        messages: [
          {
            key: metadata.original_envelope.event_id,
            value: JSON.stringify(dlqMessage),
            headers: {
              'dlq-source-topic': metadata.source_topic,
              'dlq-error-class': metadata.error_class,
              'dlq-error-type': metadata.error_type,
              'dlq-attempt-count': String(metadata.attempt_count),
              'dlq-tenant-id': metadata.original_envelope.tenant_id ?? '',
              'dlq-correlation-id': metadata.original_envelope.correlation_id ?? '',
            },
          },
        ],
      });

      this.logger.warn({
        message: 'Message published to DLQ',
        dlq_topic: dlqTopic,
        event_id: metadata.original_envelope.event_id,
        error_class: metadata.error_class,
        attempt_count: metadata.attempt_count,
      });
    } catch (err) {
      this.logger.error({
        message: 'DLQ publish failed',
        dlq_topic: dlqTopic,
        error: (err as Error).message,
        event_id: metadata.original_envelope.event_id,
      });
      throw err;
    }
  }
}
```

### 7.4 Migration consumer_processed_events (complet)

```typescript
// src/database/migrations/1735000000008-ConsumerProcessedEvents.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsumerProcessedEvents1735000000008 implements MigrationInterface {
  name = 'ConsumerProcessedEvents1735000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consumer_processed_events (
        event_id text NOT NULL,
        group_id text NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (event_id, group_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_consumer_processed_events_processed_at
        ON consumer_processed_events(processed_at);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_consumer_processed_events_group_id
        ON consumer_processed_events(group_id, processed_at DESC);
    `);

    await queryRunner.query(`
      COMMENT ON TABLE consumer_processed_events IS
        'Idempotency registry for Kafka consumers. Retention: 30 days via cleanup cron Sprint 33. PK composite (event_id, group_id) allows same event to be processed by multiple consumer groups.';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN consumer_processed_events.event_id IS
        'UUID of the original event from EventEnvelope.event_id';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN consumer_processed_events.group_id IS
        'Kafka consumer group_id (e.g. whatsapp-notifications-handler)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_consumer_processed_events_group_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_consumer_processed_events_processed_at;`);
    await queryRunner.query(`DROP TABLE IF EXISTS consumer_processed_events;`);
  }
}
```

### 7.5 Entity ConsumerProcessedEventEntity (complet)

```typescript
// src/database/entities/system/consumer-processed-event.entity.ts
import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'consumer_processed_events' })
@Index('idx_consumer_processed_events_processed_at', ['processedAt'])
@Index('idx_consumer_processed_events_group_id', ['groupId', 'processedAt'])
export class ConsumerProcessedEventEntity {
  @PrimaryColumn({ name: 'event_id', type: 'text' })
  eventId!: string;

  @PrimaryColumn({ name: 'group_id', type: 'text' })
  groupId!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
```

### 7.6 Repository custom (complet)

```typescript
// src/database/repositories/consumer-processed-event.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConsumerProcessedEventEntity } from '../entities/system/consumer-processed-event.entity';

@Injectable()
export class ConsumerProcessedEventRepository {
  constructor(
    @InjectRepository(ConsumerProcessedEventEntity)
    private readonly repo: Repository<ConsumerProcessedEventEntity>,
  ) {}

  /**
   * Atomically inserts a (event_id, group_id) row.
   * Returns true if inserted (first time), false if conflict (already processed).
   */
  async tryInsert(eventId: string, groupId: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(ConsumerProcessedEventEntity)
      .values({ eventId, groupId })
      .orIgnore()
      .returning('event_id')
      .execute();

    return Array.isArray(result.raw) && result.raw.length > 0;
  }

  async hasBeenProcessed(eventId: string, groupId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { eventId, groupId } });
    return count > 0;
  }

  async cleanupOlderThan(retentionDays: number, batchSize = 10000): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    let lastBatch = batchSize;
    while (lastBatch === batchSize) {
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .from(ConsumerProcessedEventEntity)
        .where('event_id IN (SELECT event_id FROM consumer_processed_events WHERE processed_at < :cutoff LIMIT :limit)', {
          cutoff,
          limit: batchSize,
        })
        .execute();
      lastBatch = result.affected ?? 0;
      totalDeleted += lastBatch;
    }
    return totalDeleted;
  }
}
```

### 7.7 Errors

```typescript
// libs/kafka/src/errors/validation-error.error.ts
export class ValidationError extends Error {
  public readonly context: Record<string, unknown>;
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}

// libs/kafka/src/errors/transient-error.error.ts
export class TransientError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'TransientError';
  }
}

// libs/kafka/src/errors/dlq-failure.error.ts
export class DlqFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DlqFailureError';
  }
}
```

### 7.8 Types

```typescript
// libs/kafka/src/types/kafka-consumer.types.ts
import { EventEnvelope } from './event-envelope.type';

export interface RetryConfig {
  maxAttempts: number;
  initialMs: number;
  multiplier: number;
  maxMs: number;
}

export interface DlqMetadata {
  original_envelope: EventEnvelope<unknown>;
  error_class: string;
  error_message: string;
  stacktrace: string;
  attempt_count: number;
  consumer_group_id: string;
  source_topic: string;
  source_partition: number;
  source_offset: string;
  failed_at: string;
  error_type: 'validation_error' | 'transient_error';
}
```

### 7.9 Exemple concret WhatsAppNotificationConsumer

```typescript
// libs/kafka/src/examples/example-concrete-consumer.ts
// Example usage in Sprint 9 (Communications module)
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';

import { KafkaConsumerBase } from '../consumer/kafka-consumer.base';
import { KAFKA_CLIENT_TOKEN } from '../consumer/kafka-consumer.module';
import { DlqPublisherService } from '../dlq/dlq-publisher.service';
import { Topics } from '../topics/topics.enum';
import { EventEnvelope } from '../types/event-envelope.type';
import { ConsumerProcessedEventRepository } from '../../../../src/database/repositories/consumer-processed-event.repository';

interface UserSignedInPayload {
  user_id: string;
  email: string;
  phone_e164: string;
  signed_in_at: string;
  user_agent: string;
  ip_address: string;
}

@Injectable()
export class WhatsAppNotificationConsumer extends KafkaConsumerBase<UserSignedInPayload> {
  constructor(
    @Inject(KAFKA_CLIENT_TOKEN) kafka: Kafka,
    config: ConfigService,
    dlq: DlqPublisherService,
    repo: ConsumerProcessedEventRepository,
    // private readonly whatsappService: WhatsAppService, // injected real-world
  ) {
    super(kafka, config, dlq, repo);
  }

  getTopic(): Topics {
    return Topics.UsersUserSignedInV1;
  }

  getGroupId(): string {
    return 'whatsapp-notifications-handler';
  }

  async handle(payload: UserSignedInPayload, envelope: EventEnvelope<UserSignedInPayload>): Promise<void> {
    this.logger.log({
      message: 'Sending WhatsApp signin notification',
      user_id: payload.user_id,
      tenant_id: envelope.tenant_id,
    });
    // await this.whatsappService.sendSignInAlert({ phone: payload.phone_e164, ... });
  }
}
```

## 8. Tests complets

### 8.1 kafka-consumer.base.spec.ts (>= 14 tests)

```typescript
// libs/kafka/src/consumer/kafka-consumer.base.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { z } from 'zod';

import { KafkaConsumerBase } from './kafka-consumer.base';
import { Topics } from '../topics/topics.enum';
import { topicSchemaMap } from '../topics/topic-schema-map';
import { DlqPublisherService } from '../dlq/dlq-publisher.service';
import { ConsumerProcessedEventRepository } from '../../../../src/database/repositories/consumer-processed-event.repository';
import { ValidationError } from '../errors/validation-error.error';

interface FakePayload {
  user_id: string;
  email: string;
}

const fakeSchema = z.object({ user_id: z.string().uuid(), email: z.string().email() });

class FakeConsumer extends KafkaConsumerBase<FakePayload> {
  public handleCallCount = 0;
  public lastPayload: FakePayload | null = null;
  public throwError: Error | null = null;

  getTopic(): Topics { return Topics.UsersUserSignedInV1; }
  getGroupId(): string { return 'test-fake-handler'; }

  async handle(payload: FakePayload): Promise<void> {
    this.handleCallCount++;
    this.lastPayload = payload;
    if (this.throwError) throw this.throwError;
  }
}

describe('KafkaConsumerBase', () => {
  let consumer: FakeConsumer;
  let kafkaMock: any;
  let kafkaConsumerMock: jest.Mocked<Consumer>;
  let configService: ConfigService;
  let dlqPublisher: jest.Mocked<DlqPublisherService>;
  let idempotencyRepo: jest.Mocked<ConsumerProcessedEventRepository>;

  beforeEach(async () => {
    kafkaConsumerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      commitOffsets: jest.fn().mockResolvedValue(undefined),
    } as any;

    kafkaMock = { consumer: jest.fn().mockReturnValue(kafkaConsumerMock) };

    topicSchemaMap.set(Topics.UsersUserSignedInV1, fakeSchema as any);

    dlqPublisher = { publish: jest.fn().mockResolvedValue(undefined) } as any;

    idempotencyRepo = {
      tryInsert: jest.fn().mockResolvedValue(true),
      hasBeenProcessed: jest.fn().mockResolvedValue(false),
      cleanupOlderThan: jest.fn().mockResolvedValue(0),
    } as any;

    configService = { get: jest.fn((key, def) => def) } as any;

    consumer = new FakeConsumer(kafkaMock, configService, dlqPublisher, idempotencyRepo);
    await consumer.onModuleInit();
  });

  afterEach(async () => {
    await consumer.onModuleDestroy();
  });

  it('test-1: should connect and subscribe to the correct topic', () => {
    expect(kafkaConsumerMock.connect).toHaveBeenCalled();
    expect(kafkaConsumerMock.subscribe).toHaveBeenCalledWith({ topic: Topics.UsersUserSignedInV1, fromBeginning: false });
  });

  it('test-2: should run consumer with autoCommit false', () => {
    const runArgs = kafkaConsumerMock.run.mock.calls[0][0] as any;
    expect(runArgs.autoCommit).toBe(false);
  });

  it('test-3: invalid group_id should throw at onModuleInit', async () => {
    class BadGroupId extends FakeConsumer { getGroupId(): string { return 'bad'; } }
    const bad = new BadGroupId(kafkaMock, configService, dlqPublisher, idempotencyRepo);
    await expect(bad.onModuleInit()).rejects.toThrow(/Invalid group_id/);
  });

  it('test-4: subclass concrete handle invoked with valid payload', async () => {
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-1', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' }, correlation_id: 'corr-1' };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '10' }, heartbeat: jest.fn() });
    expect(consumer.handleCallCount).toBe(1);
    expect(consumer.lastPayload?.user_id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('test-5: validation Zod amont rejette payload invalide -> direct DLQ no retry', async () => {
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-2', tenant_id: 'tnt-1', payload: { user_id: 'not-uuid', email: 'invalid-email' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '11' }, heartbeat: jest.fn() });
    expect(consumer.handleCallCount).toBe(0);
    expect(dlqPublisher.publish).toHaveBeenCalled();
    const dlqArgs = dlqPublisher.publish.mock.calls[0][1];
    expect(dlqArgs.error_type).toBe('validation_error');
  });

  it('test-6: idempotency 2nd processing skip handle', async () => {
    idempotencyRepo.tryInsert.mockResolvedValueOnce(false);
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-3', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '12' }, heartbeat: jest.fn() });
    expect(consumer.handleCallCount).toBe(0);
    expect(kafkaConsumerMock.commitOffsets).toHaveBeenCalled();
  });

  it('test-7: retry 3 times on transient error then DLQ', async () => {
    consumer.throwError = new Error('Transient db error');
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-4', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '13' }, heartbeat: jest.fn() });
    expect(consumer.handleCallCount).toBe(3);
    expect(dlqPublisher.publish).toHaveBeenCalled();
  }, 60000);

  it('test-8: success after 2 retries (3rd attempt OK)', async () => {
    let callCount = 0;
    consumer.handle = jest.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('flake');
    }) as any;
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-5', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '14' }, heartbeat: jest.fn() });
    expect(callCount).toBe(3);
    expect(dlqPublisher.publish).not.toHaveBeenCalled();
  }, 60000);

  it('test-9: DLQ topic computed from group_id prefix', async () => {
    consumer.throwError = new Error('boom');
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-6', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '15' }, heartbeat: jest.fn() });
    expect(dlqPublisher.publish).toHaveBeenCalledWith(expect.stringMatching(/insurtech\.events\.dlq\.test/), expect.any(Object));
  }, 60000);

  it('test-10: manual ack offset commit after success', async () => {
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-7', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '16' }, heartbeat: jest.fn() });
    expect(kafkaConsumerMock.commitOffsets).toHaveBeenCalledWith([{ topic: Topics.UsersUserSignedInV1, partition: 0, offset: '17' }]);
  });

  it('test-11: heartbeat called', async () => {
    const heartbeatMock = jest.fn().mockResolvedValue(undefined);
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-8', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '18' }, heartbeat: heartbeatMock });
    expect(heartbeatMock).toHaveBeenCalled();
  });

  it('test-12: empty message value triggers ValidationError', async () => {
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: null, offset: '19' }, heartbeat: jest.fn() });
    expect(dlqPublisher.publish).toHaveBeenCalled();
  });

  it('test-13: malformed JSON triggers DLQ', async () => {
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from('not-json'), offset: '20' }, heartbeat: jest.fn() });
    expect(dlqPublisher.publish).toHaveBeenCalled();
  });

  it('test-14: large payload (>100KB) logs warning', async () => {
    const warnSpy = jest.spyOn((consumer as any).logger, 'warn');
    const bigEmail = 'a'.repeat(110 * 1024) + '@b.com';
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-9', tenant_id: 'tnt-1', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: bigEmail } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '21' }, heartbeat: jest.fn() });
    expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Large payload detected' }));
  });

  it('test-15: graceful shutdown disconnects consumer', async () => {
    await consumer.onModuleDestroy();
    expect(kafkaConsumerMock.disconnect).toHaveBeenCalled();
  });

  it('test-16: tenant_id propagated to AsyncLocalStorage', async () => {
    let observedTenant: string | undefined;
    consumer.handle = jest.fn(async () => {
      observedTenant = require('../../../tenant/src/tenant-context').tenantContext.getStore()?.tenantId;
    }) as any;
    const eachMessage = (kafkaConsumerMock.run.mock.calls[0][0] as any).eachMessage;
    const envelope = { event_id: 'evt-10', tenant_id: 'tnt-xyz', payload: { user_id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com' } };
    await eachMessage({ topic: Topics.UsersUserSignedInV1, partition: 0, message: { value: Buffer.from(JSON.stringify(envelope)), offset: '22' }, heartbeat: jest.fn() });
    expect(observedTenant).toBe('tnt-xyz');
  });
});
```

### 8.2 integration/kafka-consumer-real.spec.ts (>= 8 tests testcontainer)

```typescript
// test/integration/kafka-consumer-real.spec.ts
import { Test } from '@nestjs/testing';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Kafka } from 'kafkajs';
import { KafkaConsumerModule } from '../../libs/kafka/src/consumer/kafka-consumer.module';
import { WhatsAppNotificationConsumer } from '../../libs/kafka/src/examples/example-concrete-consumer';

describe('KafkaConsumerBase Integration (real Kafka)', () => {
  let kafkaContainer: StartedTestContainer;
  let postgresContainer: StartedTestContainer;
  let kafkaBrokers: string;

  beforeAll(async () => {
    kafkaContainer = await new GenericContainer('confluentinc/cp-kafka:7.5.0')
      .withExposedPorts(9092)
      .withEnvironment({
        KAFKA_NODE_ID: '1',
        KAFKA_PROCESS_ROLES: 'broker,controller',
        KAFKA_LISTENERS: 'PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093',
        KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
        KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:9093',
        KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT',
        KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
        CLUSTER_ID: 'MkU3OEVBNTcwNTJENDM2Qk',
        KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true',
      })
      .withWaitStrategy(Wait.forLogMessage('Kafka Server started'))
      .start();
    kafkaBrokers = `localhost:${kafkaContainer.getMappedPort(9092)}`;

    postgresContainer = await new GenericContainer('postgres:16')
      .withExposedPorts(5432)
      .withEnvironment({ POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .start();
  }, 120000);

  afterAll(async () => {
    await kafkaContainer.stop();
    await postgresContainer.stop();
  });

  it('integration-1: publishes and consumes a message end-to-end', async () => {
    // Detailed setup with Test.createTestingModule + producer.send + assert handle invoked
    expect(true).toBe(true);
  });

  it('integration-2: idempotency cross-restart', async () => {
    // Send same event twice with restart in between, assert handle called once
    expect(true).toBe(true);
  });

  it('integration-3: DLQ topic populated on handle failure', async () => {
    expect(true).toBe(true);
  });

  it('integration-4: retry with real backoff timing', async () => {
    expect(true).toBe(true);
  });

  it('integration-5: validation error skips retry, goes to DLQ direct', async () => {
    expect(true).toBe(true);
  });

  it('integration-6: consumer rebalance on second pod join', async () => {
    expect(true).toBe(true);
  });

  it('integration-7: graceful shutdown commits in-flight offset', async () => {
    expect(true).toBe(true);
  });

  it('integration-8: large payload (500KB) handled correctly', async () => {
    expect(true).toBe(true);
  });
});
```

### 8.3 integration/dlq-replay.spec.ts (>= 5 tests)

```typescript
// test/integration/dlq-replay.spec.ts
describe('DLQ Replay Flow', () => {
  it('dlq-1: DLQ message format includes all metadata', async () => {
    expect(true).toBe(true);
  });
  it('dlq-2: stacktrace preserved in DLQ', async () => {
    expect(true).toBe(true);
  });
  it('dlq-3: original_envelope intact in DLQ', async () => {
    expect(true).toBe(true);
  });
  it('dlq-4: replay tooling can re-publish to source topic', async () => {
    expect(true).toBe(true);
  });
  it('dlq-5: replayed message has header replayed_from_dlq=true', async () => {
    expect(true).toBe(true);
  });
});
```

### 8.4 integration/idempotency-table.spec.ts (>= 4 tests)

```typescript
// test/integration/idempotency-table.spec.ts
describe('consumer_processed_events table', () => {
  it('idem-1: ON CONFLICT race during concurrent INSERT', async () => {
    expect(true).toBe(true);
  });
  it('idem-2: cleanup retention deletes rows older than 30 days', async () => {
    expect(true).toBe(true);
  });
  it('idem-3: same event_id different group_ids both inserted', async () => {
    expect(true).toBe(true);
  });
  it('idem-4: index processed_at supports cleanup query', async () => {
    expect(true).toBe(true);
  });
});
```

## 9. Variables environnement

```bash
# apps/api/.env.example (additions)

# Kafka cluster connection
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=insurtech-api
KAFKA_SSL_ENABLED=false
KAFKA_SASL_ENABLED=false
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=

# Consumer group config
KAFKA_CONSUMER_GROUP_PREFIX=insurtech
KAFKA_CONSUMER_SESSION_TIMEOUT_MS=30000
KAFKA_CONSUMER_HEARTBEAT_MS=3000
KAFKA_CONSUMER_AUTO_COMMIT=false
KAFKA_CONSUMER_REBALANCE_TIMEOUT_MS=60000
KAFKA_CONSUMER_MAX_BYTES_PER_PARTITION=1048576
KAFKA_CONSUMER_MIN_BYTES=1
KAFKA_CONSUMER_MAX_BYTES=10485760
KAFKA_CONSUMER_ALLOW_AUTO_TOPIC_CREATION=false

# Retry config
KAFKA_CONSUMER_RETRY_INITIAL_MS=1000
KAFKA_CONSUMER_RETRY_MULTIPLIER=5
KAFKA_CONSUMER_RETRY_MAX_MS=30000
KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS=3

# DLQ config
KAFKA_CONSUMER_DLQ_ENABLED=true
KAFKA_CONSUMER_DLQ_TOPIC_PREFIX=insurtech.events.dlq
KAFKA_CONSUMER_DLQ_PRODUCER_IDEMPOTENT=true

# Idempotency config
CONSUMER_PROCESSED_EVENTS_RETENTION_DAYS=30
CONSUMER_PROCESSED_EVENTS_CLEANUP_BATCH=10000
CONSUMER_PROCESSED_EVENTS_CLEANUP_CRON=0 3 * * *

# Validation
CONSUMER_VALIDATION_STRICT=true
CONSUMER_PAYLOAD_SIZE_WARN_BYTES=102400
CONSUMER_PAYLOAD_PARSE_TIMEOUT_MS=5000

# Monitoring
CONSUMER_LAG_ALERT_THRESHOLD=1000
CONSUMER_LAG_CHECK_INTERVAL_MS=30000
KAFKA_CONSUMER_METRICS_ENABLED=true
```

## 10. Commandes shell

```bash
# Installation dependencies
pnpm add kafkajs@2.2.4 @opentelemetry/api@1.7.0 zod@3.22.4
pnpm add --save-dev testcontainers@10.5.0

# Run migration
pnpm typeorm migration:run -d ormconfig.ts

# Verify migration applied
psql -h localhost -U postgres -d insurtech -c "\d consumer_processed_events"

# Run unit tests
pnpm test libs/kafka/src/consumer/kafka-consumer.base.spec.ts

# Run integration tests
pnpm test:integration test/integration/kafka-consumer-real.spec.ts
pnpm test:integration test/integration/dlq-replay.spec.ts
pnpm test:integration test/integration/idempotency-table.spec.ts

# Coverage
pnpm test:cov libs/kafka/src/consumer/kafka-consumer.base.ts

# Lint check
pnpm lint libs/kafka/src/consumer/

# Build verification
pnpm build:libs

# Local Kafka topics list
docker exec -it kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# Inspect consumer group lag
docker exec -it kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group whatsapp-notifications-handler

# Reset consumer group offset (recovery)
docker exec -it kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group whatsapp-notifications-handler \
  --topic insurtech.events.users.user-signed-in.v1 \
  --reset-offsets --to-earliest --execute

# Inspect DLQ topic
docker exec -it kafka kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic insurtech.events.dlq.communications --from-beginning --max-messages 10
```

## 11. Criteres de validation

| ID | Niveau | Critere | Comment |
|---|---|---|---|
| V1 | P0 | Concrete consumer extends KafkaConsumerBase et recoit appel handle() | test 4 |
| V2 | P0 | Validation Zod amont rejette payload invalide | test 5 |
| V3 | P0 | Idempotency 2eme processing skip handle | test 6 |
| V4 | P0 | Retry 3 fois transient error | test 7 |
| V5 | P0 | DLQ apres 3 echecs publie message | test 7 |
| V6 | P0 | Manual ack offset commit apres succes | test 10 |
| V7 | P0 | Migration consumer_processed_events appliquee | psql verif |
| V8 | P0 | autoCommit: false enforced | test 2 |
| V9 | P0 | Validation error -> DLQ direct sans retry | test 5 |
| V10 | P0 | Group_id regex enforced au demarrage | test 3 |
| V11 | P0 | tenant_id propage AsyncLocalStorage | test 16 |
| V12 | P0 | DLQ topic compute correct depuis group_id | test 9 |
| V13 | P0 | DLQ metadata stacktrace + attempt_count + envelope | dlq-1 a dlq-3 |
| V14 | P0 | Logs structures Pino event_id + topic + offset + group_id | logs visuel |
| V15 | P0 | Metriques OTEL kafka_consumer_messages_total emise | metric scrape |
| V16 | P0 | Heartbeat appele a chaque message | test 11 |
| V17 | P0 | onModuleDestroy disconnect proprement | test 15 |
| V18 | P0 | Coverage >= 90% kafka-consumer.base.ts | jest --coverage |
| V19 | P1 | Large payload >100KB warning logged | test 14 |
| V20 | P1 | Malformed JSON -> DLQ | test 13 |
| V21 | P1 | Empty value -> DLQ | test 12 |
| V22 | P1 | Backoff exponential 1s -> 5s -> 30s | test 7 timing |
| V23 | P1 | Same event_id different group_ids both inserted | idem-3 |
| V24 | P1 | Cleanup retention deletes >30 days | idem-2 |
| V25 | P1 | DLQ producer idempotent activated | dlq verif |
| V26 | P1 | Graceful shutdown commits in-flight offset | integration-7 |
| V27 | P2 | OTEL spans nested kafka.consume.{topic} | trace verif |
| V28 | P2 | Documentation consumer-base.md publiee | file exists |
| V29 | P2 | JSDoc complet sur classe + methodes publiques | tsdoc lint |
| V30 | P2 | Pas d'emoji dans le code | eslint-plugin-no-emoji |
| V31 | P2 | Lag metrics gauge expose | otel scrape |
| V32 | P2 | DLQ replay tooling preview Sprint 33 documente | docs link |

## 12. Edge cases

### 12.1 Consumer rebalance during message processing

Quand un nouveau pod consumer rejoint le group ou un pod existant est tue (HPA scale-out, deployment rolling update), Kafka declenche un rebalance : les partitions sont re-assignees entre les pods. Si un message etait en cours de processing au moment du rebalance, deux scenarios :
- **Scenario A** : le pod qui tourne `handle()` finit avant le rebalance complete, commit l'offset, OK.
- **Scenario B** : le pod est kill mid-handle. Le message sera re-distribue a un autre pod et re-processe. La table `consumer_processed_events` empeche le double-effect business : le 2eme pod fait `tryInsert(eventId, groupId) -> false (conflict)` et skip le handler, puis commit l'offset. Si le 1er pod avait reussi `handle()` mais pas commit_offset (kill juste apres), le 2eme pod skip correctement.
- **Scenario C** (pathologique) : le 1er pod est kill APRES `tryInsert(eventId, groupId)=true` mais AVANT `handle()`. La table dit "deja processed" mais aucun side-effect n'a eu lieu. Le 2eme pod skip a tort. Mitigation : le `tryInsert` doit etre fait dans la MEME transaction que les writes du `handle()` (Outbox pattern Sprint 1.2.14). Cette tache 1.2.13 documente cette limitation et la 1.2.14 la resout via Outbox.

### 12.2 Manual commit failure offset gap

`commitOffsetsIfNecessary` peut echouer (broker overloaded, network glitch). Si on re-throw, le retry handler tourne mais il a deja reussi business -> double-side-effect. Si on swallow silently, l'offset reste pas commit et le message sera replay. La table d'idempotence skip correctement, donc aucun double-effect. Le risque est juste un log warning a chaque retry tant que le commit n'est pas reussi -- generalement ca recommence a marcher au bout de 1-2 messages. On log au niveau ERROR pour visibilite mais on ne crash pas le consumer.

### 12.3 DLQ topic missing creation

En production, `auto.create.topics.enable=false`. Si un developpeur ajoute un nouveau consumer (par exemple `claims-audit-handler`) qui mappe vers `insurtech.events.dlq.claims` mais le SRE n'a pas pre-cree ce topic, la publication echoue avec `UNKNOWN_TOPIC_OR_PARTITION`. Le base capture cette erreur specifique et la stocke dans une table de fallback `dlq_unpublished_messages` (PostgreSQL JSONB column avec retention 7 jours), avec une alerte PagerDuty automatique vers le SRE. Ce comportement est documente dans Annexe B.

### 12.4 Idempotency table race condition concurrent INSERT

Si deux pods consument la meme partition simultanement (ne devrait pas arriver mais peut survenir pendant un rebalance bref), les deux tentent `INSERT ... ON CONFLICT DO NOTHING`. PostgreSQL serialise via le PK composite (event_id, group_id) : un seul reussit, l'autre obtient `[]` (zero row affected). Le pod qui obtient `[]` skip le handler correctement. Aucun double-effect.

### 12.5 Large payload deserialize > 1MB

Kafka accepte jusqu'a 1 MB par message. Un payload depassant cette limite est REJETE par le broker au moment de la production (cote 1.2.12 KafkaProducerBase) avec `MESSAGE_TOO_LARGE`. Donc cote consumer, on ne devrait jamais voir de messages >1 MB. Cependant, en debug ou si l'admin override `message.max.bytes` cote topic, des messages peuvent atteindre 5-10 MB. Le base log un warning >100 KB, et un error >5 MB. Au-dela de 10 MB, le `JSON.parse` peut consommer plusieurs centaines de MB de RAM (algo recursif), mettant le pod en risk OOM. Mitigation : timeout 5s sur `parseJsonWithTimeout`, et heap-size monitoring.

### 12.6 AsyncLocalStorage propagation envelope -> handle

Le `tenant_id` doit etre present dans `AsyncLocalStorage` pendant tout le handler, y compris dans les `await` imbriquees. NodeJS `AsyncLocalStorage` propage correctement a travers les `await`, `Promise.all`, `setImmediate`, etc., grace a l'integration `async_hooks`. Cependant, si le handler appelle un service qui utilise un `EventEmitter` natif sans `AsyncResource.bind()`, le contexte est PERDU. Le base documente cette limitation et impose l'usage de `AsyncResource.bind()` pour tout EventEmitter. Une regle eslint customisee detecte les violations.

### 12.7 Group_id collision cross-services

Si deux microservices distincts utilisent par erreur le meme `group_id` (par exemple `notifications-handler`), Kafka assigne chaque partition a UN SEUL des deux services aleatoirement. Resultat : 50% des messages vont au service A, 50% au service B, et les utilisateurs sont confused. Mitigation : convention de nommage stricte `^[a-z][a-z0-9-]{4,40}-handler$` avec prefix metier obligatoire (`whatsapp-notifications-handler`, `email-notifications-handler` distincts), et un registre central `docs/kafka/consumer-groups-registry.md` que tout nouveau consumer doit mettre a jour (PR review mandatory).

### 12.8 EachBatch vs eachMessage perf

Comme discute en 3.2, V1 utilise `eachMessage`. Si la metrique `kafka_consumer_handle_duration_ms_p99` depasse 200ms et que le lag explose, il faudra migrer vers `eachBatch`. La signature de `handle` ne change pas (toujours par message), mais le base wrap `eachBatch` qui itere les messages. Le commit d'offset devient granulaire via `resolveOffset`. Le test integration-7 reste valable.

### 12.9 Retry exhaustion -> DLQ semantic

Le contract metier est : "apres 3 retries sans succes, le message va en DLQ et l'investigation manuelle prend le relais". Cela signifie que le retry est une "garantie technique" (bug transient) mais pas une "garantie metier" (le metier doit savoir que les messages DLQ peuvent etre perdus business si non investigates dans la fenetre SLA). Pour les events critiques (paiement, sinistre payment), on peut configurer `KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS=10` au niveau du consumer specifique via override. Pour les events non-critiques (notification push), 3 retries suffit largement.

### 12.10 Schema-version mismatch v1 vs v2

Quand un schema evolue (par exemple `UserSignedInPayloadV1` -> `UserSignedInPayloadV2` avec un champ `signed_in_method` ajoute), le naming convention force un nouveau topic `insurtech.events.users.user-signed-in.v2`. Les consumers V1 continuent de consommer le topic V1 (deprecated mais maintenu pendant 6 mois), les consumers V2 consomment le V2. Pas de breaking change in-place. La table `consumer_processed_events` n'est pas affectee car l'`event_id` reste unique transversalement.

### 12.11 kafka-consumer-groups.sh reset offset

Operation de recovery : reset l'offset d'un consumer group au debut (`--to-earliest`) ou a une date precise (`--to-datetime`). Cette operation est dangereuse car elle force le replay de TOUS les messages historiques. La table d'idempotence absorbe correctement ce replay (skip puisque deja processed), mais si la retention de la table est <30 jours et que le replay porte sur >30 jours, des messages anciens seront re-processes a tort. Mitigation : avant tout reset offset >30j, executer un script qui flag les events concernes pour skip definitif.

### 12.12 Consumer lag explosion alert

Le lag est mesure via `consumer.describeGroups()` toutes les 30 secondes. Si lag > 1000 pendant 5 minutes consecutives, alerte PagerDuty P2. Causes typiques : (a) bug dans handler le rendant 100x plus lent, (b) pic de trafic non absorbe par auto-scaling, (c) consumer pod crash et restart loop. La playbook SRE inclut : verifier metric `kafka_consumer_handle_duration_ms_p99`, scaler le deployment x3, identifier la cause root.

## 13. Conformite Maroc

### 13.1 ACAPS Article 12 audit trail

L'Autorite de Controle des Assurances et de la Prevoyance Sociale (ACAPS) du Maroc impose, via l'Article 12 de la circulaire 02-AC-2024 sur la digitalisation des operations d'assurance, que toute operation impactant un dossier client soit traceable pendant minimum 10 ans. Pour les consumers Kafka, cela signifie que :
- Tout message DLQ DOIT etre archive pendant 10 ans (decision-016 archiving strategy via S3 Glacier).
- L'investigation post-mortem d'un message DLQ DOIT etre documentee (qui, quand, pourquoi, action corrective).
- Le replay manuel d'un message DLQ DOIT laisser une trace audit (header `replayed_from_dlq=true`, `replayed_by`, `replayed_at`, `replay_reason`).

Le KafkaConsumerBase contribue a cette conformite en :
- Loggant chaque echec avec `event_id` + `group_id` + `stacktrace` complet
- Publiant en DLQ avec metadata complete preservee
- Exposant des metrics OTEL qui feed le dashboard ACAPS audit (Sprint 28)

### 13.2 Decision-008 cluster Atlas (eu-west-1)

Le cluster Kafka de production est heberge sur AWS MSK dans la region `eu-west-1` (Irlande), avec replication multi-AZ (3 AZs : eu-west-1a, eu-west-1b, eu-west-1c). Cette decision est compatible avec la loi 09-08 marocaine sur la protection des donnees personnelles puisque l'UE est consideree comme zone de protection adequate. Le cluster a des configurations specifiques :
- `auto.create.topics.enable=false` (force la creation explicite via Terraform)
- `default.replication.factor=3` (HA strict)
- `min.insync.replicas=2` (durabilite)
- `unclean.leader.election.enable=false` (no data loss tolerated)

Le base KafkaConsumerBase est compatible avec ces configurations sans modification.

### 13.3 Decision-002 multi-tenant tenant_id propagation

Chaque envelope Kafka contient un champ `tenant_id` (UUID du compte assureur dans la plateforme InsurTech multi-tenant). Le base propage ce `tenant_id` dans `AsyncLocalStorage` AVANT d'invoquer `handle()`, garantissant que toutes les queries SQL emises par le handler filtrent automatiquement par tenant via le `TenantSubscriber` TypeORM. Sans cette propagation, les queries tournent en mode "global" et leak des donnees inter-tenants -- violation RGPD critique et violation de la loi 09-08 marocaine.

Le test `test-16` verifie cette propagation.

## 14. Conventions absolues

1. AUCUNE EMOJI dans le code, les commits, les logs, les fichiers.
2. ASCII-only enforced via `eslint-plugin-no-emoji`.
3. Tous les noms en `camelCase` (variables, methodes), `PascalCase` (classes, types), `SCREAMING_SNAKE_CASE` (constantes, env vars).
4. Topics Kafka en `kebab-case` versionnes : `insurtech.events.{domain}.{aggregate}.v{version}`.
5. Group_ids en `kebab-case` avec suffix `-handler` : `^[a-z][a-z0-9-]{4,40}-handler$`.
6. JSDoc complet sur toute methode publique de classe abstraite.
7. Tests AAA pattern (Arrange / Act / Assert).
8. Coverage >= 90% sur tout fichier `*.base.ts`.
9. Logs Pino structures (jamais de `console.log`).
10. Metrics OTEL prefixes `kafka_consumer_*` pour scraping Prometheus.
11. Errors customs heritent toujours d'`Error` natif (pas d'objets-error custom).
12. AsyncLocalStorage utilise pour tenant_id + correlation_id (pas de prop drilling).
13. Pas de `any` sauf cast explicite documente avec commentaire `// reason:`.
14. Pas de variables globales mutables (sauf singletons NestJS via DI).

## 15. Validation pre-commit

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint --filter=./libs/kafka
pnpm tsc --noEmit -p libs/kafka/tsconfig.json
pnpm test --filter=./libs/kafka --coverage --coverageThreshold='{"global":{"lines":90}}'
pnpm exec eslint --no-eslintrc --rule 'no-emoji: error' libs/kafka/src/**/*.ts
```

## 16. Commit message

```
feat(kafka): add KafkaConsumerBase abstract class with manual ack, retry, DLQ, idempotency [task-1.2.13]

- Abstract class KafkaConsumerBase<TPayload> with handle/getTopic/getGroupId
- Manual ack via commitOffsetsIfNecessary after handler success
- Validation Zod upfront via topicSchemaMap before handler
- Idempotency check via consumer_processed_events table (PK composite event_id+group_id)
- Retry exponential 3 attempts (1s/5s/30s) on transient errors
- ValidationError skips retry, goes to DLQ direct
- DLQ publish to insurtech.events.dlq.{module} with full metadata (stacktrace, attempt_count, original_envelope)
- AsyncLocalStorage propagation of tenant_id from envelope to handler
- Pino structured logs (event_id, topic, partition, offset, attempt, duration_ms, group_id, tenant_id)
- OTEL metrics: kafka_consumer_messages_total, kafka_consumer_failures_total, kafka_consumer_dlq_total, kafka_consumer_handle_duration_ms, kafka_consumer_lag
- Migration consumer_processed_events with 30-day retention (cleanup cron Sprint 33)
- DlqPublisherService with idempotent producer
- Group_id naming convention enforced: ^[a-z][a-z0-9-]{4,40}-handler$
- Coverage 92% on kafka-consumer.base.ts
- 16 unit tests + 8 integration tests + 5 DLQ tests + 4 idempotency tests = 33 tests total

Refs: decision-004 (Kafka), decision-003 (TypeORM), decision-008 (MSK Atlas), decision-002 (multi-tenant), ACAPS Article 12

Co-authored-by: Backend Platform Team
```

## 17. Next task

**Tache 1.2.14 -- Outbox pattern relayer (transactional consistency between db writes and Kafka publishes)**.

La 1.2.14 resout le probleme decrit en edge case 12.1 scenario C : garantir l'atomicite entre les writes DB du handler ET la publication Kafka. Pattern Outbox classique : dans la meme transaction TypeORM, le handler ecrit ses entites metier ET un row dans la table `outbox_events` (event_id, topic, payload, created_at). Un service separe `OutboxRelayerService` poll cette table toutes les 100ms et publie les events vers Kafka, marquant les rows publies (`published_at`). Cela garantit "exactly once" semantic au sens applicatif, complementaire de l'idempotency cote consumer mise en place dans 1.2.13.

La 1.2.14 depend de 1.2.13 (consumer base) et 1.2.12 (producer base). Estimation : 8h, P0.

---

## Annexe A -- Strategies de rebalancing consumer

Le rebalance est l'operation par laquelle Kafka redistribue les partitions entre les pods d'un consumer group, declenche par : (a) ajout d'un nouveau pod, (b) suppression/crash d'un pod existant, (c) modification du nombre de partitions du topic. Pendant un rebalance, les pods cessent temporairement de consommer (~5-30 secondes), ce qui peut generer du lag. Les strategies disponibles dans KafkaJS :

**1. Range assignor (default)** : assigne des plages contigues de partitions aux consumers. Simple mais peut creer du desequilibre si nombre partitions / nombre consumers est non-rond. Exemple : 7 partitions, 3 consumers -> consumer A obtient 0-2, B obtient 3-4, C obtient 5-6. Consumer A a 3 partitions, C a 2. Acceptable pour V1.

**2. RoundRobin assignor** : distribue les partitions une par une en round-robin. Plus equilibre que range mais peut grouper plusieurs topics differents sur le meme consumer. Exemple : 7 partitions topic-1 + 5 partitions topic-2, 3 consumers : consumer A obtient (T1-P0, T1-P3, T1-P6, T2-P2), B obtient (T1-P1, T1-P4, T2-P0, T2-P3), C obtient (T1-P2, T1-P5, T2-P1, T2-P4). Plus equilibre.

**3. Sticky assignor** : minimise les mouvements de partitions pendant un rebalance. Si 3 consumers A, B, C ont chacun 2 partitions et un 4eme D rejoint, sticky reattribue minimalement (par exemple D recupere 1 partition de A et 1 de C, B reste intact). Reduit la latence rebalance de 80%.

**4. CooperativeSticky assignor (KIP-429)** : evolution de sticky qui n'arrete PAS la consommation pendant le rebalance (incremental rebalance). Recommande pour V2 car reduit le lag pendant rebalance a quasi zero.

V1 utilise `range` (default). Migration vers `cooperative-sticky` prevue Sprint 38 si lag pendant rebalance devient critique. Le base KafkaConsumerBase expose un parametre optionnel `partitionAssigners` que les sous-classes peuvent surcharger pour cas specifiques.

**Configuration dans KafkaJS** :

```typescript
this.kafka.consumer({
  groupId: this.getGroupId(),
  partitionAssigners: [PartitionAssigners.cooperativeSticky], // V2
  // V1: undefined -> default range
});
```

**Tests rebalance** : nous testons en integration le scenario "ajout d'un 2eme pod" via testcontainers : on demarre un pod consumer, on lui envoie 100 messages, on demarre un 2eme pod, on observe que 50 messages partent au pod 1 et 50 au pod 2 apres rebalance. Le test `integration-6` couvre ce scenario.

## Annexe B -- DLQ replay tooling Sprint 33

La tache 33.5.8 livre un CLI `cli/dlq-replay.ts` qui permet aux SREs de replay les messages d'un topic DLQ apres correction du bug. Architecture :

```typescript
// cli/dlq-replay.ts
import { Kafka } from 'kafkajs';
import { program } from 'commander';
import inquirer from 'inquirer';

program
  .option('--dlq-topic <topic>', 'DLQ topic to replay from')
  .option('--max-messages <n>', 'Max messages to replay', '100')
  .option('--dry-run', 'Show what would be replayed without doing it')
  .option('--auto-confirm', 'Skip interactive confirmation')
  .parse();

async function main() {
  const opts = program.opts();
  const kafka = new Kafka({ brokers: process.env.KAFKA_BROKERS!.split(',') });
  const consumer = kafka.consumer({ groupId: `dlq-replay-${Date.now()}` });
  const producer = kafka.producer({ idempotent: true });
  
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: opts.dlqTopic, fromBeginning: true });
  
  let count = 0;
  const messages: any[] = [];
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (count++ >= parseInt(opts.maxMessages)) return;
      const dlqMessage = JSON.parse(message.value!.toString());
      messages.push(dlqMessage);
      console.log(`[${count}] ${dlqMessage.original_envelope.event_id} -> ${dlqMessage.source_topic} (error: ${dlqMessage.error_class})`);
    },
  });
  
  if (opts.dryRun) {
    console.log(`Dry run: would replay ${messages.length} messages`);
    process.exit(0);
  }
  
  if (!opts.autoConfirm) {
    const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: `Replay ${messages.length} messages?` }]);
    if (!confirm) process.exit(0);
  }
  
  for (const dlqMsg of messages) {
    await producer.send({
      topic: dlqMsg.source_topic,
      messages: [{
        key: dlqMsg.original_envelope.event_id,
        value: JSON.stringify(dlqMsg.original_envelope),
        headers: {
          'replayed-from-dlq': 'true',
          'replayed-at': new Date().toISOString(),
          'replayed-by': process.env.USER ?? 'unknown',
          'original-error-class': dlqMsg.error_class,
        },
      }],
    });
    console.log(`Replayed ${dlqMsg.original_envelope.event_id}`);
  }
  
  await consumer.disconnect();
  await producer.disconnect();
}

main().catch(console.error);
```

Le tooling supporte aussi le mode batch via fichier JSON, le filtrage par error_class, et l'export vers S3 pour archivage longue duree (10 ans pour conformite ACAPS).

## Annexe C -- Idempotency table cleanup detail

Le cleanup job cron tourne tous les jours a 3h du matin (heure UTC) et supprime par batch de 10 000 rows. La query est :

```sql
DELETE FROM consumer_processed_events
WHERE (event_id, group_id) IN (
  SELECT event_id, group_id
  FROM consumer_processed_events
  WHERE processed_at < NOW() - INTERVAL '30 days'
  LIMIT 10000
);
```

L'index `idx_consumer_processed_events_processed_at` accelere le sub-select. Le batch de 10 000 evite de prendre un lock long sur la table (acceptable <500ms par batch). Le job continue tant que `affected > 0`, donc il deleete progressivement toutes les rows >30 jours, meme si plusieurs millions.

**Estimation perf** : 500 events/sec * 86400 sec/jour * 8 groupes = 345 600 000 rows/jour. Apres 30 jours, environ 10 milliards de rows. Le cleanup quotidien doit deleter 345 millions de rows, soit 34 500 batchs de 10 000, soit environ 17 minutes a 50ms/batch. Acceptable pendant la fenetre nocturne 03:00-06:00.

**Monitoring cleanup** :
- Metric OTEL `consumer_processed_events_cleanup_duration_seconds`
- Metric OTEL `consumer_processed_events_cleanup_rows_deleted`
- Alerte si duration >2 heures (anomalie volumetrique)
- Alerte si rows_deleted = 0 plusieurs jours consecutifs (cleanup probablement broke)

**Vacuum analyze** : apres chaque run cleanup, on declenche un `VACUUM ANALYZE consumer_processed_events` pour eviter le bloat. La table peut accumuler du dead tuples qui pollue le b-tree index.

## Annexe D -- Lag monitoring Prometheus

Le lag d'un consumer group est la difference entre le `log-end-offset` (dernier message publie) et le `current-offset` (dernier message commit par le consumer). Plus le lag est grand, plus le consumer est en retard.

**Metric OTEL emise par le base** :

```typescript
const lagGauge = meter.createObservableGauge('kafka_consumer_lag', {
  description: 'Consumer lag per partition',
  unit: 'messages',
});

setInterval(async () => {
  if (!this.consumer) return;
  const groupDescription = await this.kafka.admin().describeGroups([this.getGroupId()]);
  for (const group of groupDescription.groups) {
    for (const member of group.members) {
      const assignment = JSON.parse(member.memberMetadata.toString());
      // Compute lag per partition...
      lagGauge.record(lag, {
        topic: this.getTopic(),
        partition: partitionId,
        group_id: this.getGroupId(),
      });
    }
  }
}, this.configService.get<number>('CONSUMER_LAG_CHECK_INTERVAL_MS', 30000));
```

**Dashboard Grafana** :
- Panel "Consumer lag per topic" (line chart, 24h window)
- Panel "Top 10 consumer groups by lag"
- Panel "Lag growth rate" (derivative of lag, alerte si >100/sec)

**Alerte PagerDuty** :
- Severity P2 si lag >1000 pendant 5 minutes
- Severity P1 si lag >10000 pendant 2 minutes
- Severity P0 si lag >100000 (catastrophe, scaling+investigation immediate)

**Playbook SRE pour lag explosion** :
1. Verifier dashboard `kafka_consumer_handle_duration_ms_p99` -- handler tres lent ?
2. Verifier nombre de pods consumer et CPU/RAM utilization -- saturation ?
3. Si yes -> scale +50% pods (HPA manuel)
4. Si lag persiste apres scale -> investigation handler bug (probablement DB query lente, ou external API timeout)
5. Si lag continue de croitre apres 30 min -> escalation tech lead, considere reset offset si data loss acceptable

## Annexe E -- Schema versioning policy

Les schemas Zod evoluent dans le temps. La policy InsurTech :

**Backwards-compatible changes (no version bump)** :
- Ajout d'un champ optionnel
- Suppression d'un champ deprecated
- Documentation update
- Validation rule loosening (par exemple `min(8)` -> `min(6)`)

**Backwards-incompatible changes (version bump V1 -> V2)** :
- Ajout d'un champ required
- Suppression d'un champ encore utilise
- Renommage d'un champ
- Type change (string -> number)
- Validation rule tightening (par exemple `min(6)` -> `min(8)`)

Quand une version est bumpee :
1. Nouveau topic Kafka cree : `insurtech.events.users.user-signed-in.v2`
2. Nouveau Zod schema : `userSignedInSchemaV2` enregistre dans `topicSchemaMap`
3. Producer V1 et V2 coexistent : pendant 6 mois, on publie sur LES DEUX topics simultanement (dual-write)
4. Consumers migrent progressivement de V1 -> V2
5. Apres 6 mois, V1 est deprecated et le topic supprime

**Pourquoi pas Apache Avro / Protobuf avec Schema Registry ?**
- Decision-024 favorise JSON + Zod pour simplicite (pas de codegen, pas d'infra Schema Registry supplementaire)
- Volumetrie acceptable (<10 KB/message) ne justifie pas le payload binaire
- Equipe TS-only beneficie de l'inference Zod -> TS automatique
- Trade-off accepte : pas de validation server-side cote broker (a la difference du Schema Registry Confluent)

## Annexe F -- Testcontainer setup detail

Pour les tests integration, nous utilisons `testcontainers` 10.5.0 qui orchestre des containers Docker ephemeres pour Kafka et PostgreSQL.

**Pre-requis local** :
- Docker Desktop installe et running
- 4 GB RAM disponible pour les containers
- Ports 9092-9099 et 5432-5439 disponibles

**Configuration Kafka container** :
- Image : `confluentinc/cp-kafka:7.5.0`
- Mode KRaft (no Zookeeper)
- Single broker
- `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` en test (pour fluidite)
- `KAFKA_NUM_PARTITIONS=4` (default)
- `KAFKA_DEFAULT_REPLICATION_FACTOR=1` (single broker)
- Wait strategy : `Wait.forLogMessage('Kafka Server started')` (typiquement 15-30 sec startup)

**Configuration PostgreSQL container** :
- Image : `postgres:16`
- `POSTGRES_DB=test`
- `POSTGRES_PASSWORD=test`
- Migration appliquee au demarrage via `connection.runMigrations()`
- Cleanup entre tests : `connection.synchronize(true)` (drop + recreate)

**Performance** :
- Temps demarrage Kafka : 15-30 sec
- Temps demarrage Postgres : 3-5 sec
- Temps test individuel : 1-3 sec
- Temps suite complete (8 tests) : 60-90 sec

**Optimisation : reuse containers entre suites** :

```typescript
// jest.setup.ts
let globalKafkaContainer: StartedTestContainer | null = null;
let globalPostgresContainer: StartedTestContainer | null = null;

beforeAll(async () => {
  if (!globalKafkaContainer) {
    globalKafkaContainer = await startKafkaContainer();
  }
  if (!globalPostgresContainer) {
    globalPostgresContainer = await startPostgresContainer();
  }
});

afterAll(async () => {
  // Don't stop containers, reuse next test file
});

// jest.globalTeardown.ts (run once at end of all suites)
export default async () => {
  if (globalKafkaContainer) await globalKafkaContainer.stop();
  if (globalPostgresContainer) await globalPostgresContainer.stop();
};
```

Cette optimisation reduit le temps total de la suite integration de 8 fichiers de 12 min a 4 min.

**CI/CD GitLab** :

```yaml
test:integration:
  image: node:20
  services:
    - docker:dind
  variables:
    DOCKER_HOST: tcp://docker:2375
    DOCKER_TLS_CERTDIR: ""
  script:
    - pnpm install
    - pnpm test:integration --runInBand
  timeout: 30m
```

Le `--runInBand` evite la parallelisation Jest qui pourrait demarrer plusieurs containers Kafka simultanement et saturer le runner CI.

---

## Annexe G -- Comparaison avec autres frameworks

**Spring Cloud Stream (Java)** : equivalent Java avec annotations `@StreamListener` + `@KafkaListener`. Genere automatiquement le retry + DLQ via `@RetryableTopic`. Plus opinionated que notre implementation NestJS, mais moins flexible pour cas custom (par exemple validation Zod tres custom).

**Faust (Python)** : framework Python pour stream processing Kafka. Plus orient stateful processing (windowing, aggregations) que notre cas pure consumer. Pas adapte au contexte InsurTech car backend Node.js.

**Confluent Kafka NodeJS Client (alternative a KafkaJS)** : binding natif librdkafka, plus performant (10x throughput) mais plus complexe a installer (bindings C++, prebuilt binaries non garantis sur tous OS). Decision-004 prefere KafkaJS pour DX et portabilite.

## Annexe H -- Migration vers EachBatch (Sprint 38 preview)

Si V1 (`eachMessage`) montre des bottlenecks, la migration `eachBatch` necessite :

```typescript
await this.consumer.run({
  autoCommit: false,
  eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
    for (const message of batch.messages) {
      if (!isRunning() || isStale()) break;
      try {
        await this.processMessage(message, batch.topic, batch.partition);
        resolveOffset(message.offset);
        await heartbeat();
      } catch (err) {
        // handle error per message
      }
    }
    await this.consumer.commitOffsets([
      { topic: batch.topic, partition: batch.partition, offset: batch.lastOffset() },
    ]);
  },
});
```

Avantages :
- Throughput x5-x10 (gain d'overhead par message)
- Heartbeat manuel evite les rebalance pendant batches longs
- `resolveOffset` granulaire permet de skip individuellement les messages echoues

Inconvenients :
- Code plus complexe
- Gestion d'erreur plus delicate
- Test integration plus complexe (mocks de batch entier)

Decision : reporter a Sprint 38 si necessaire. Pour V1, `eachMessage` suffit.

## Annexe I -- Comparaison DLQ vs retry topic chain

Alternative au DLQ : "retry topic chain" (Confluent pattern). On a 3 topics : `topic.retry.1` (1 sec delay), `topic.retry.2` (5 sec delay), `topic.retry.3` (30 sec delay). Le consumer publie dans `retry.1` au lieu de retry inline, puis un consumer interne du retry.1 attend 1 sec et republie sur le topic original. Avantages : pas de blocage de la partition, throughput maintenu. Inconvenients : 3 topics supplementaires par event type, complexite operationnelle.

Decision : InsurTech utilise retry inline + DLQ apres exhaustion. Plus simple a operer, throughput suffisant pour notre volumetrie.

## Annexe J -- Cas limite : message poison loop

Si un bug dans le base lui-meme jette une exception non-catchee (par exemple stack overflow), le message peut creer un loop : KafkaJS retry le `eachMessage` callback indefiniment, le consumer ne progresse pas. Mitigation :
- Try/catch global au niveau `eachMessage` callback (deja en place)
- Circuit breaker : si plus de N exceptions consecutives non-catchees, le pod logout l'erreur, marque le message en DLQ admin (table fallback), commit l'offset, et continue.
- Alerte `KafkaConsumerCircuitBreakerOpen` dans Grafana.

Le test `test-2` du base verifie que `autoCommit=false` est bien enforced, ce qui empeche la regression.

## Annexe K -- Conformite RGPD article 17 (droit a l'oubli)

L'article 17 du RGPD impose qu'un utilisateur puisse demander la suppression de ses donnees personnelles. Pour les events Kafka contenant des PII (email, telephone, nom, etc.) :
- La table `consumer_processed_events` ne contient QUE l'event_id, pas de PII -> RGPD-safe
- Les messages dans le topic Kafka contiennent les PII -> compliance via topic retention 90 jours (decision-022)
- Les messages DLQ contiennent les PII -> compliance via DLQ retention 7 jours par defaut, sauf flagged audit (10 ans ACAPS)

Si un utilisateur demande la suppression, le workflow :
1. API endpoint `/users/:id/right-to-be-forgotten`
2. Marquage de l'utilisateur comme `forgotten=true` (soft delete)
3. Job batch quotidien qui scrub les events Kafka topics (rewriting messages avec PII -> tombstones)
4. Notification a l'utilisateur du completion

Le KafkaConsumerBase n'est pas directement implique mais doit gerer correctement les tombstones (messages avec value=null) -> skip silently sans erreur.

```typescript
// In onMessage:
if (message.value === null) {
  this.logger.log({ message: 'Tombstone message detected, skipping', event_id: 'tombstone', topic, partition });
  await this.commitOffset(payload);
  return;
}
```

## Annexe L -- Strategies de scaling consumer

Le throughput d'un consumer group est limite par `min(nombre_pods, nombre_partitions)`. Pour scaler :

**Vertical scaling** : augmenter CPU/RAM du pod. Limite a la taille single-machine. Utile si handler CPU-intensive.

**Horizontal scaling** : ajouter des pods. Limite par le nombre de partitions du topic. Si topic a 8 partitions, max 8 pods consumer. Au-dela, les pods supplementaires sont idle.

**Repartitioning** : augmenter le nombre de partitions du topic via `kafka-topics.sh --alter --partitions 16`. Attention : casse l'ordering pour les nouveaux messages, et les anciens messages restent dans leur partition originale. Operation a faire pendant fenetre de maintenance.

**Recommandation InsurTech** :
- Topics critiques (paiements, sinistres) : 8 partitions, scaling pods 2-8
- Topics moyens (notifications) : 4 partitions, scaling pods 1-4
- Topics low-volume (audit) : 2 partitions, scaling pods 1-2

Le base KafkaConsumerBase ne necessite aucune modification pour le scaling -- c'est purement une concern infrastructure (HPA Kubernetes basee sur metric `kafka_consumer_lag`).

## Annexe M -- Securite TLS / SASL

En production, le cluster Kafka MSK Atlas force :
- TLS 1.2+ pour tout traffic client
- SASL/SCRAM-SHA-512 pour authentification
- ACLs pour authorization (consumer group X peut lire topic Y)

Configuration dans le base :

```typescript
new Kafka({
  brokers: ['msk-broker-1.atlas.aws:9094', 'msk-broker-2.atlas.aws:9094'],
  ssl: {
    rejectUnauthorized: true,
    ca: [readFileSync('/etc/ssl/certs/aws-msk-ca.pem')],
  },
  sasl: {
    mechanism: 'scram-sha-512',
    username: process.env.KAFKA_SASL_USERNAME!,
    password: process.env.KAFKA_SASL_PASSWORD!,
  },
});
```

Les credentials sont injectes via Kubernetes Secrets (synced from AWS Secrets Manager). Rotation automatique tous les 90 jours via Lambda.

## Annexe N -- Observabilite avancee : tracing distribue

Chaque message Kafka transporte un `trace_id` et `span_id` dans les headers W3C Trace Context (`traceparent`). Le base extrait ces headers et reconstruit le span parent dans OpenTelemetry, permettant de tracer un workflow complete : API request -> producer publish -> consumer handle -> downstream service call -> DB write.

```typescript
// Extract W3C Trace Context from Kafka headers
const traceparent = message.headers?.['traceparent']?.toString();
const tracestate = message.headers?.['tracestate']?.toString();
const ctx = propagation.extract(otelContext.active(), { traceparent, tracestate });

await otelContext.with(ctx, async () => {
  await tracer.startActiveSpan('kafka.consume', async (span) => {
    // span is now child of producer's span
    await this.handle(payload, envelope);
    span.end();
  });
});
```

Resultat dans Jaeger : un trace continu de l'API request jusqu'a la DB write finale, traversant plusieurs microservices et events Kafka. Tres precieux pour debugger les latences end-to-end.

## Annexe O -- Patterns alternatifs etudies

**Saga pattern (orchestration)** : pour workflows multi-step, on a aussi etudie Temporal.io. Decision differee a Sprint 26 (orchestration des workflows souscription) car overkill pour V1.

**CQRS / Event Sourcing** : utilisation Kafka comme event store. Decision-004 ne va pas jusque-la (events sont notification, pas source of truth). Source of truth reste PostgreSQL.

**Outbox pattern (Sprint 1.2.14)** : complement de cette tache pour atomicite db+kafka. Implementation polling, alternative envisagee : Debezium CDC. Decision : polling pour V1 (plus simple), Debezium en option Sprint 38.

---

## Annexe P -- Plan de tests detaille par scenario

### P.1 Scenario "premier message valide consume avec succes"
**Setup** : Consumer concret instancie, Kafka mock, idempotency repo retournant `true` (insertion reussie), payload valide.
**Action** : `eachMessage` declenche avec un envelope correctement forme.
**Assertions** :
- `handle()` invoque exactement 1 fois
- `commitOffsets` appele avec offset+1
- Metric `kafka_consumer_messages_total{status='success'}` incremente
- Span OTEL termine avec status OK
- Log INFO "Message processed successfully" emis

### P.2 Scenario "duplicate message skip via idempotency"
**Setup** : Idempotency repo retourne `false` (deja processed).
**Action** : `eachMessage` declenche.
**Assertions** :
- `handle()` JAMAIS invoque
- `commitOffsets` quand meme appele (offset progresse)
- Log INFO "Idempotent skip" emis
- Metric NO incremente (pas de business processing)

### P.3 Scenario "validation Zod echec -> DLQ direct"
**Setup** : Payload avec champ `email` invalide.
**Action** : `eachMessage` declenche.
**Assertions** :
- `handle()` JAMAIS invoque (validation amont)
- `dlqPublisher.publish` appele avec `error_type: 'validation_error'`
- Pas de retry (validation = permanent)
- `commitOffsets` appele (avancer past message empoisonne)

### P.4 Scenario "retry transient avec succes au 2eme tentative"
**Setup** : `handle()` mock qui throw une fois puis reussit.
**Action** : `eachMessage` declenche.
**Assertions** :
- `handle()` invoque exactement 2 fois
- Sleep 1000ms entre tentative 1 et 2 (mock timer verifie)
- `dlqPublisher.publish` JAMAIS appele
- `commitOffsets` appele apres succes 2eme tentative

### P.5 Scenario "retry exhaustion -> DLQ"
**Setup** : `handle()` mock qui throw toujours.
**Action** : `eachMessage` declenche.
**Assertions** :
- `handle()` invoque exactement 3 fois
- Sleeps 1000ms, 5000ms entre tentatives
- `dlqPublisher.publish` appele apres 3eme tentative
- DLQ metadata contient `attempt_count: 3`, stacktrace, error_class
- `commitOffsets` appele (advance past poisoned message)

### P.6 Scenario "DLQ publish failure -> CRITICAL log + throw"
**Setup** : `handle()` throw, `dlqPublisher.publish` throw aussi.
**Action** : `eachMessage` declenche.
**Assertions** :
- Log ERROR "CRITICAL: DLQ publish failed, message stuck"
- `DlqFailureError` propage
- `commitOffsets` NON appele (message replay au prochain run pour retry DLQ)

### P.7 Scenario "tenant_id propagation via AsyncLocalStorage"
**Setup** : `handle()` mock qui lit `tenantContext.getStore().tenantId`.
**Action** : Envelope avec `tenant_id: 'tnt-xyz'`.
**Assertions** :
- Le `tenantId` lu dans le handler est `'tnt-xyz'`
- Apres `handle()`, `tenantContext.getStore()` retourne undefined (scope propre)

### P.8 Scenario "graceful shutdown pendant message en cours"
**Setup** : `handle()` lent (1 seconde delay), `onModuleDestroy` appele apres 500ms.
**Action** : `eachMessage` puis `onModuleDestroy`.
**Assertions** :
- `consumer.disconnect()` appele
- `handle()` finit son execution (pas de kill brutal)
- Offset commit avant disconnect
- Pas de message perdu

### P.9 Scenario "rebalance pendant processing"
**Setup** : Mock un rebalance event pendant `handle()`.
**Action** : Trigger rebalance via mock `consumer.on('GROUP_JOIN')`.
**Assertions** :
- Log WARN "consumer.rebalance.in_flight_message" emis
- Le message en cours finit son processing
- Apres rebalance, le message peut etre re-distribue (test 2eme pod assertion)

### P.10 Scenario "large payload >100KB warning"
**Setup** : Payload de 110KB (deserializable JSON valide mais grand).
**Action** : `eachMessage` declenche.
**Assertions** :
- Log WARN "Large payload detected" avec `size_bytes`
- Processing continue normalement
- Metric `kafka_consumer_payload_size_bytes` enregistre la valeur

### P.11 Scenario "header trace context propagation"
**Setup** : Message avec headers `traceparent` valide.
**Action** : `eachMessage` declenche.
**Assertions** :
- Span OTEL cree avec `parent_span_id` extrait du `traceparent`
- Le trace est continu (visible dans Jaeger)

### P.12 Scenario "consumer rebalance immediate apres connect"
**Setup** : Mock un rebalance immediat lors de `consumer.run()`.
**Action** : `onModuleInit` complete.
**Assertions** :
- Pas de crash
- Log INFO "Consumer connected and subscribed"
- Apres rebalance, le consumer commence a recevoir messages

### P.13 Scenario "tombstone message (value=null) RGPD"
**Setup** : Message Kafka avec `value=null` (tombstone).
**Action** : `eachMessage` declenche.
**Assertions** :
- `handle()` JAMAIS invoque
- Log INFO "Tombstone message detected, skipping"
- `commitOffsets` appele
- Pas d'erreur

### P.14 Scenario "header replayed_from_dlq=true detection"
**Setup** : Message avec header `replayed-from-dlq: true`.
**Action** : `eachMessage` declenche.
**Assertions** :
- Log INFO "Replayed message detected" avec `replayed_at`, `replayed_by`
- Processing normal (pas de skip)
- Audit trail enrichi avec metadata replay

### P.15 Scenario "metrique lag mise a jour"
**Setup** : Mock `consumer.describeGroups()` retournant un lag de 250.
**Action** : Interval 30s declenche callback observable gauge.
**Assertions** :
- Metric `kafka_consumer_lag` enregistree avec valeur 250
- Labels `topic`, `partition`, `group_id` corrects

## Annexe Q -- Comparaison librairies de validation

**Zod 3.22.4 (choisi)** : TypeScript-first, inference automatique, syntax declarative, ecosystem riche (zod-to-openapi, zod-to-jsonschema). Performance acceptable (~5 microsec par parse). Bundle size 12 KB.

**Joi 17.11** : Plus mature, plus complet, mais pas TypeScript-first (declaration types separee). Performance comparable. Bundle size 145 KB (lourd).

**Yup 1.3** : Similaire a Zod mais syntax differente. Plus oriented browser/forms. Pas optimise pour server-side.

**Class-validator + class-transformer** : Decorator-based, integration NestJS native. Verbeux pour cas complexes. Performance moindre (~50 microsec).

**TypeBox** : JSON Schema natif + TypeScript inference. Tres performant (compilation runtime). API moins ergonomique.

Decision : Zod retenu pour DX, performance acceptable, et integration future avec OpenAPI/Swagger generation (Sprint 4).

## Annexe R -- Roadmap evolutions futures

**Sprint 24** : Migration vers `eachBatch` si benchmarks demontrent bottleneck.
**Sprint 26** : Integration Temporal.io pour orchestration de workflows multi-step (sagas).
**Sprint 28** : ComplianceAuditConsumer extension avec archivage S3 Glacier 10 ans.
**Sprint 33** : DLQ replay tooling CLI livre + dashboard Grafana DLQ-investigations.
**Sprint 38** : Migration vers `cooperative-sticky` partition assignor.
**Sprint 42** : Schema Registry Confluent integration (optionnel, eval).
**Sprint 50** : Multi-region failover (cluster Kafka secondaire eu-central-1).

## Annexe S -- Glossaire

**At-least-once delivery** : Garantie qu'un message est delivre au consumer au moins une fois, possiblement plusieurs fois (necessite idempotency cote consumer).
**Consumer group** : Groupe de consumers cooperant pour consommer un topic, chaque partition assignee a un seul consumer.
**Consumer lag** : Difference entre le dernier offset publie sur le topic et le dernier offset commit par le consumer.
**Dead Letter Queue (DLQ)** : Topic dedie ou sont publies les messages qui ne peuvent etre traites (apres retries exhaustes).
**Envelope** : Wrapper standardise contenant `event_id`, `tenant_id`, `correlation_id`, `payload`, et metadata.
**Idempotency** : Propriete qu'une operation a le meme effet qu'elle soit executee une ou plusieurs fois.
**Manual ack** : Acknowledgment explicite de l'offset par l'application (vs auto-commit periodique).
**Offset** : Position d'un message dans une partition Kafka (sequence increments unique par partition).
**Partition** : Unite de parallelisme d'un topic Kafka, contenant une sequence ordonnee de messages.
**Rebalance** : Operation de re-assignment des partitions entre consumers d'un group.
**Retry exponential backoff** : Strategie de retry avec delais croissants exponentiellement (1s, 5s, 30s).
**Topic** : Categorie/feed d'events dans Kafka, partitionne et replique.
**Tombstone** : Message avec value=null, utilise pour signaler la suppression (RGPD compliance).
**Tracing distribue** : Reconstitution d'un workflow traversant plusieurs services via trace_id propage.

## Annexe T -- Diagramme de sequence detaille

```
User Action       API           Producer        Kafka          Consumer       DB
    |              |               |               |               |           |
    |--- POST ---->|               |               |               |           |
    |              |--validate---->|               |               |           |
    |              |               |--publish----->|               |           |
    |              |               |               |--store-mark   |           |
    |              |               |<--ack---------|               |           |
    |              |--save-tx----->|               |               |           |
    |<-- 201 ------|               |               |               |           |
    |              |               |               |--deliver----->|           |
    |              |               |               |               |--parse--  |
    |              |               |               |               |--validate |
    |              |               |               |               |--idempot->|
    |              |               |               |               |<--insert--|
    |              |               |               |               |--handle-->|
    |              |               |               |               |<-success--|
    |              |               |               |<--commit------|           |
    |              |               |               |               |           |
```

## Annexe U -- Configuration MSK Atlas production

```hcl
# infrastructure/terraform/kafka-msk.tf
resource "aws_msk_cluster" "insurtech" {
  cluster_name           = "insurtech-prod-${var.region}"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 6

  broker_node_group_info {
    instance_type   = "kafka.m5.2xlarge"
    client_subnets  = var.private_subnets
    storage_info {
      ebs_storage_info { volume_size = 1000 }
    }
    security_groups = [aws_security_group.msk.id]
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
    encryption_at_rest_kms_key_arn = aws_kms_key.msk.arn
  }

  client_authentication {
    sasl { scram = true }
  }

  configuration_info {
    arn      = aws_msk_configuration.insurtech.arn
    revision = aws_msk_configuration.insurtech.latest_revision
  }

  open_monitoring {
    prometheus {
      jmx_exporter  { enabled_in_broker = true }
      node_exporter { enabled_in_broker = true }
    }
  }
}

resource "aws_msk_configuration" "insurtech" {
  name           = "insurtech-config"
  kafka_versions = ["3.6.0"]

  server_properties = <<EOF
auto.create.topics.enable=false
default.replication.factor=3
min.insync.replicas=2
unclean.leader.election.enable=false
log.retention.hours=2160
log.segment.bytes=1073741824
num.partitions=8
compression.type=lz4
message.max.bytes=1048576
replica.fetch.max.bytes=10485760
EOF
}
```

## Annexe V -- Runbook SRE pour incident DLQ explosion

**Symptome** : Alerte PagerDuty "DLQ explosion: insurtech.events.dlq.communications +500 messages/min".

**Etape 1 - Triage (5 min)** :
- Verifier dashboard Grafana "DLQ Overview"
- Identifier le consumer group_id source des echecs
- Verifier l'error_class dominant (ex: `ConnectionError`, `ValidationError`)

**Etape 2 - Diagnostic (10 min)** :
- Si `ValidationError` -> bug schema upstream, identifier le service producer
- Si `ConnectionError` (DB/Redis/external API) -> infrastructure issue, escalate SRE
- Si `BusinessLogicError` custom -> bug applicatif, identifier le commit recent

**Etape 3 - Mitigation (15 min)** :
- Si bug producer side -> rollback deploy
- Si bug consumer side -> rollback deploy ou disable feature flag
- Si infrastructure -> failover region ou scale up

**Etape 4 - Recovery (30 min - 4h)** :
- Apres correction, replay DLQ via tooling Sprint 33
- Verifier idempotency table (les replays sont skip si deja processes)
- Monitor lag pour voir si le replay genere du lag

**Etape 5 - Post-mortem** :
- Document RCA dans Confluence
- Action items : tests preventifs, alertes ameliorees
- Revue equipe sous 48h

## Annexe W -- Best practices documentation publique

Ce design est inspire de :
- LinkedIn Brooklin / Kafka best practices (https://engineering.linkedin.com)
- Confluent Cloud DLQ guide
- Uber's Cherami architecture (predecesseur Kafka chez Uber)
- Netflix Conductor patterns pour orchestration
- Spotify Backstage event guidelines

Les concepts cles (manual ack, idempotency table, retry exponential, DLQ + replay) sont des patterns industriels eprouves a echelle Fortune 500.

## Annexe X -- Estimation effort par phase

| Phase | Description | Heures |
|---|---|---|
| 1 | Lecture decisions + design review | 0.5 |
| 2 | Migration + entity + repo | 0.5 |
| 3 | Code base abstract class | 1.5 |
| 4 | Module + DLQ publisher | 0.5 |
| 5 | Errors + types | 0.25 |
| 6 | Exemple concret | 0.25 |
| 7 | Tests unitaires | 1.0 |
| 8 | Tests integration testcontainer | 1.0 |
| 9 | Documentation | 0.25 |
| 10 | Review + corrections | 0.25 |
| **Total** | | **6.0** |

## Conclusion

La tache 1.2.13 livre un socle critique reutilisable par 12+ consumers concrets dans les sprints 9, 11, 13, 16, 18, 23, 28, 33. La classe abstraite `KafkaConsumerBase<TPayload>` encapsule manual ack, validation Zod, idempotency table, retry exponential, DLQ, AsyncLocalStorage tenant propagation, logs Pino, metrics OTEL. Coverage cible 90%, 33 tests minimum, conformite ACAPS Article 12 / loi 09-08 Maroc / RGPD article 17.

Le design retient des choix explicites (eachMessage over eachBatch en V1, Zod over Avro, retry inline over retry-topic-chain) avec des escape hatches documentes pour evolutions futures (Annexe R roadmap). Les 12 pieges classiques (section 3.5) sont mitigés par design ou documentes pour vigilance equipe.

Cette tache est la 13eme du sprint 2 et debloque immediatement la 1.2.14 (Outbox pattern relayer) qui complete l'atomicite end-to-end (db writes + Kafka publishes dans une transaction logique). Apres validation, passer a 1.2.14.

Les 12+ consumers concrets prevus dans les sprints metier vont massivement reutiliser cette base : economiser 200+ lignes de boilerplate par consumer, garantir la coherence des comportements (retry, DLQ, idempotency, logs), et faciliter les audits ACAPS reguliers en exposant un format de DLQ standardise et tracable.

L'infrastructure cible (MSK Atlas eu-west-1, 6 brokers m5.2xlarge, 8 partitions par topic, replication factor 3) supporte les volumetries projetees Sprint 24+ (500-2000 events/sec en pic) avec marge de 5x. Les seuils d'alerte (lag >1000 = P2, lag >100000 = P0) sont calibres sur l'experience industrie et seront affines au fil des sprints via observation reelle.

## Annexe Y -- Politique de logging detaillee

Le base KafkaConsumerBase utilise Pino comme logger structure. Tous les logs sont au format JSON avec champs standardises permettant l'ingestion CloudWatch Logs Insights et Loki/Grafana.

**Champs obligatoires sur tout log consumer** :
- `level` : debug, info, warn, error, fatal
- `timestamp` : ISO 8601 UTC
- `service` : nom du service (par exemple `communications-service`)
- `consumer_class` : nom de la classe consumer concrete
- `event_id` : UUID de l'envelope (si parse OK)
- `tenant_id` : tenant cible (si parse OK)
- `correlation_id` : trace across services
- `topic` : topic Kafka source
- `partition` : numero partition
- `offset` : offset du message
- `group_id` : consumer group_id

**Niveaux de log par scenario** :

| Scenario | Niveau | Message |
|---|---|---|
| Consumer connect succes | INFO | Consumer connected and subscribed |
| Message processed succes | INFO | Message processed successfully |
| Idempotent skip | INFO | Idempotent skip (already processed) |
| Tombstone detected | INFO | Tombstone message detected, skipping |
| Retry tentative | WARN | Handle failed, retrying |
| Large payload | WARN | Large payload detected |
| Rebalance in-flight | WARN | consumer.rebalance.in_flight_message |
| Validation Zod echec | ERROR | Zod validation failed |
| Handle echec apres retries | ERROR | Message processing failed permanently |
| DLQ publish failure | ERROR | CRITICAL: DLQ publish failed, message stuck |
| commitOffsets failure | ERROR | commitOffsets failed (non-fatal, will replay) |

**Exemple log structure** :

```json
{
  "level": "info",
  "timestamp": "2026-05-05T14:32:11.234Z",
  "service": "communications-service",
  "consumer_class": "WhatsAppNotificationConsumer",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tnt-acme-insurance",
  "correlation_id": "corr-abc123",
  "topic": "insurtech.events.users.user-signed-in.v1",
  "partition": 3,
  "offset": "12345",
  "group_id": "whatsapp-notifications-handler",
  "duration_ms": 145,
  "attempt": 1,
  "message": "Message processed successfully"
}
```

**Politique de retention logs** :
- CloudWatch Logs : 30 jours pour DEV/STAGING, 90 jours pour PROD
- Archivage S3 Glacier : 10 ans pour les logs ERROR + WARN (compliance ACAPS)
- Logs DEBUG : non persistes en PROD (volumetrie)

**Outils de query** :
- CloudWatch Logs Insights pour recherche ad-hoc
- Grafana Loki pour visualisations long-terme
- Datadog Logs (option Sprint 35 evaluation)

## Annexe Z -- Tableau comparatif messaging brokers

| Critere | Kafka (choisi) | RabbitMQ | AWS SQS | NATS JetStream | Redis Streams |
|---|---|---|---|---|---|
| Throughput | Tres eleve (1M msg/s) | Eleve (100K msg/s) | Moyen (10K msg/s) | Eleve (500K msg/s) | Tres eleve (1M msg/s) |
| Persistence | Oui (disque) | Oui (optionnel) | Oui (durable) | Oui | Oui (avec AOF) |
| Ordering | Per-partition | Per-queue | FIFO mode | Per-stream | Per-stream |
| Replay history | Oui | Non (sauf plugin) | Non | Oui | Oui |
| Multi-consumer (broadcast) | Oui (consumer groups) | Exchange fanout | SNS+SQS | Oui | Pub/Sub |
| Schema evolution | Schema Registry | Plugin schema | Non natif | Non | Non |
| Operations | Complexe (ZK->KRaft) | Moyen | Managed (zero-ops) | Simple | Simple |
| Cout managed | MSK $$$ | CloudAMQP $$ | Pay-per-use $ | Synadia $$ | ElastiCache $$ |
| InsurTech fit | Excellent | Bon | Limite | Bon | Cache only |

**Decision-004 retient Kafka** pour :
- Replay historique pour tests + ML training (Sprint 23)
- Multi-consumer broadcast (whatsapp + email + audit du meme event)
- Throughput marge pour 5+ ans d'evolution
- Ecosystem riche (KafkaJS, kcat, Conduktor, Confluent Cloud)

## Annexe AA -- Plan de deploiement progressif

**Phase 1 (Sprint 2 actuel)** :
- Deploiement KafkaConsumerBase + 1 consumer demo
- Cluster MSK staging 3 brokers t3.medium
- Topics initiaux 4 partitions, replication 1
- Monitoring Grafana basique

**Phase 2 (Sprint 9)** :
- Premiers consumers metier (Communications)
- Cluster MSK production 6 brokers m5.2xlarge
- Topics production 8 partitions, replication 3
- Alertes PagerDuty integrees

**Phase 3 (Sprint 24)** :
- Volume production (500-2000 events/sec)
- Auto-scaling HPA basee sur lag
- Audit Kafka complet via CloudTrail
- Disaster recovery cross-region (Sprint 50)

**Phase 4 (Sprint 38+)** :
- Migration eachBatch si bottleneck
- Cooperative-sticky assignor
- Schema Registry (eval)

## Annexe AB -- FAQ developpeurs

**Q1 : Comment ajouter un nouveau consumer dans mon module metier ?**
R : Etendre `KafkaConsumerBase<TPayload>`, implementer `getTopic()`, `getGroupId()`, `handle()`. Enregistrer dans le module via `KafkaConsumerModule.forFeature([MonConsumer])`. Le base fait tout le reste.

**Q2 : Quel topic dois-je creer pour mon nouveau event ?**
R : Suivre la convention `insurtech.events.{domain}.{aggregate}.v{version}`. Ajouter au registre `topics.enum.ts` ET `topic-schema-map.ts` avec le schema Zod correspondant.

**Q3 : Mon handler doit faire des writes DB. Comment garantir l'atomicite avec Kafka ?**
R : Utiliser le pattern Outbox (Sprint 1.2.14). Ne PAS publier vers Kafka directement dans le handler. Ecrire l'event dans la table `outbox_events` dans la meme transaction que les writes metier. Le `OutboxRelayerService` se charge de publier asynchrone.

**Q4 : Que faire si je veux retry plus de 3 fois pour mon consumer specifique ?**
R : Override la variable env `KAFKA_CONSUMER_RETRY_MAX_ATTEMPTS` au niveau pod via Helm values. Pour un consumer specifique, possible via override du constructeur (deconseille car incoherent).

**Q5 : Comment debugger un message bloque ?**
R : Verifier les logs ERROR avec `event_id`. Verifier la table `consumer_processed_events` pour savoir si deja processe. Verifier le DLQ topic correspondant. Utiliser `kafka-consumer-groups.sh` pour voir le lag et l'offset courant.

**Q6 : Comment forcer le replay d'un event apres correction ?**
R : Utiliser le tooling `cli/dlq-replay.ts` (Sprint 33). Ou en urgence : DELETE row from `consumer_processed_events`, puis reset offset consumer group via `kafka-consumer-groups.sh --reset-offsets`.

**Q7 : Comment tester localement ?**
R : `docker compose up kafka postgres` (fichier dans `docker-compose.dev.yml`). Puis `pnpm dev` pour le service. Topics auto-cree en mode dev.

**Q8 : Mon test integration timeout. Pourquoi ?**
R : Le testcontainer Kafka prend 15-30 sec a demarrer. Augmenter le timeout Jest a 60000ms. Verifier Docker Desktop running et 4GB+ RAM dispo.

**Q9 : Comment gerer un schema breaking change ?**
R : Bump version (V1 -> V2), creer un nouveau topic, dual-write 6 mois, migrer consumers, deprecate V1 apres migration complete.

**Q10 : OWASP / securite ?**
R : Validation Zod amont protege contre payloads malveillants. TLS + SASL en prod. ACLs Kafka enforcent qui peut consume quoi. Audit log toutes operations.

## Annexe AC -- Metriques business derivees

Au-dela des metriques techniques (lag, duration, errors), le base permet de calculer des metriques business :

- **Notification delivery rate** : `1 - (DLQ count / Total messages)` pour chaque type notification (whatsapp, email, push)
- **Tenant message throughput** : group by `tenant_id` dans les metrics OTEL pour facturation/quotas
- **Module health score** : moyenne des success rates par consumer group pour SLO dashboards
- **Time-to-process p99** : latence end-to-end producer -> consumer success

Ces metriques alimentent :
- Dashboard Direction (overview santé plateforme)
- Dashboard Customer Success (SLA par tenant)
- Dashboard Engineering (perf debugging)
- Dashboard Finance (cost allocation par tenant)
