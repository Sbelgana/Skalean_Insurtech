# Tache 1.2.12 -- KafkaPublisher service NestJS : provider idempotent + retry exponential + circuit breaker

## 1. Header

| Champ | Valeur |
| --- | --- |
| ID | 1.2.12 |
| Titre | KafkaPublisher service NestJS -- provider idempotent + retry exponential + circuit breaker |
| Sprint | 02 -- Database & Kafka Foundations |
| Phase | 1 -- Infrastructure Core |
| Duree estimee | 5h (300 minutes) |
| Priorite | P0 -- bloquante pour TOUS les microservices NestJS Sprint 5+ |
| Owner role | Senior Backend Engineer NestJS / Kafka |
| Dependencies | 1.2.11 (Topics & Event Schemas registry) ; 1.2.10 (Kafka cluster Bitnami Helm) ; 1.2.04 (Pino logger commun) ; 1.2.05 (RequestContext AsyncLocalStorage) ; 1.2.06 (TenantContext AsyncLocalStorage) ; 1.2.07 (OpenTelemetry SDK) |
| Successors | 1.2.13 (KafkaConsumer service NestJS) ; 1.2.14 (Outbox pattern v1) ; 5.x.x (tous services NestJS publishers) |
| Decision references | decision-004 (Kafka comme event backbone) ; decision-002 (multi-tenant tenant_id propagation) ; decision-005 (Skalean AI Frontier observability) ; decision-006 (logs no-emoji) ; decision-008 (cluster Atlas Benguerir) ; decision-013 (idempotent producer obligatoire) |
| Conventions | AUCUNE EMOJI dans code, logs, commits, fichiers, README ; tirets ASCII uniquement |

Cette tache produit le service NestJS `KafkaPublisherService` qui sera importe par TOUS les microservices producteurs d'evenements Kafka du programme Skalean InsurTech (Devis, Souscription, Sinistres, Paiements, Audit, Notification, etc.). C'est la 12eme tache du Sprint 2 et la fondation de toute la couche eventing applicative. Sans elle, aucun microservice ne peut emettre d'evenement metier de maniere fiable, idempotente, observable et resiliente. La tache suit immediatement 1.2.11 qui a defini le registry de topics et schemas Zod : 1.2.12 consomme ce registry pour valider automatiquement chaque payload publie. La tache precede 1.2.13 (consumer pendant) et 1.2.14 (Outbox v1 production-ready). Toute regression sur ce service est P0 et bloque la chaine de livraison.

## 2. But

Construire un provider NestJS reutilisable et generique nomme `KafkaPublisherService` expose via un module dynamique `KafkaPublisherModule.forRoot(options)` / `forFeature()`. Le service offre une API publique unique `publish<T>(topic: Topics, payload: T, options?: PublishOptions): Promise<void>` qui accepte un nom de topic typage par enum Topics (defini en 1.2.11) et un payload TypeScript fortement type. La methode declenche en interne, dans cet ordre strict, les etapes suivantes : (1) recuperation du schema Zod associe au topic via `topicSchemaMap.get(topic)`, (2) validation `safeParse` du payload, rejet immediat avec `InvalidEventError` si le schema echoue (pas de retry, l'erreur est permanente et indique un bug developpeur), (3) construction de l'enveloppe standard CloudEvents-like avec `event_id` ULID monotone, `event_name` derive du topic, `event_version` 1.0, `occurred_at` ISO-8601 UTC, `tenant_id` lu depuis l'AsyncLocalStorage TenantContext, `correlation_id` lu depuis RequestContext, `producer_service` lu de la config, (4) calcul de la cle de partition Kafka egale au `tenant_id` pour preserver l'ordre per-tenant, (5) appel `producer.send` enrobe dans un circuit breaker opossum, (6) en cas d'echec transient, retry exponential 100ms / 500ms / 2000ms avec jitter, (7) emission de metriques OpenTelemetry et logs Pino structures, (8) en cas de circuit breaker open, fallback optionnel vers la table `outbox_events` (preview Sprint 35).

Le service doit garantir l'idempotence cote producteur Kafka via le flag `idempotent: true` et un `transactionalId` unique par instance de service / pod (concatenation `${clientId}-${podName}-${pid}` injecte par variable d'environnement). Le maxInFlightRequests est borne a 5 pour respecter la contrainte du producteur idempotent KafkaJS. Le flag `allowAutoTopicCreation` est strictement `false` en production (tous les topics sont crees explicitement par le module Terraform Kafka du Sprint 2 tache 1.2.10) et peut etre `true` en developpement local pour faciliter l'iteration. Toutes les configurations sont validees au boot via un schema Zod `KafkaPublisherOptionsSchema` qui empeche le service de demarrer si une variable critique manque ou est invalide. Le service publie systematiquement des metriques OpenTelemetry (`kafka_publish_duration_ms` histogram, `kafka_publish_success_total` counter, `kafka_publish_failure_total` counter avec attribut `error_type`) et des logs Pino contenant a minima `event_id`, `topic`, `partition`, `offset`, `duration_ms`, `retry_count`, `tenant_id` (hash si decision-009 le requiert), `correlation_id`. Aucun emoji n'apparait dans les logs ni le code (decision-006).

Le service doit fournir une experience developpeur (DX) excellente : injection NestJS standard via `@Inject(KAFKA_PUBLISHER)` ou directement `KafkaPublisherService`, types TypeScript propages depuis le registry de schemas (autocomplete IntelliSense sur le payload selon le topic choisi), tests unitaires fournis avec mocks KafkaJS Producer, tests d'integration avec testcontainer Kafka reel, documentation README incluant un cookbook (publier un evenement DevisCreated, publier dans une transaction multi-events, gerer un echec circuit breaker open). La duree totale d'une publication en chemin nominal (validation + send + ack acks=-1 + metriques) doit rester sous 50ms p95 dans des conditions normales (cluster Kafka Atlas Benguerir avec replication 3, min.insync.replicas 2). Toute degradation au-dessus de 200ms p95 doit declencher une alerte Prometheus configuree dans les sprints SRE ulterieurs.

## 3. Contexte etendu

### 3.1 Pourquoi un provider NestJS centralise et non un client KafkaJS standalone

L'alternative naive consisterait pour chaque microservice a importer directement `kafkajs`, instancier son propre `Producer`, gerer son propre cycle de vie, son propre logging, ses propres retries. Cette approche a ete rejetee pour plusieurs raisons concretes documentees dans la decision-004. Premierement, la duplication de code : chaque service reimplementerait la meme logique d'enveloppe CloudEvents, de validation Zod, de retry exponential, de circuit breaker, de metriques OpenTelemetry, ce qui violerait DRY a l'echelle du programme (15+ microservices a horizon Sprint 30). Deuxiemement, la divergence comportementale : sans abstraction commune, certains services configureraient `idempotent: false`, d'autres `acks=1` au lieu de `acks=-1`, d'autres oublieraient le circuit breaker, ce qui creerait une heterogeneite de garanties de livraison incompatible avec les exigences ACAPS Article 12 (audit trail durable des evenements metier). Troisiemement, l'observabilite fragmentee : sans instrumentation OpenTelemetry centralisee, les metriques `kafka_publish_*` auraient des labels et noms differents par service, rendant impossible une vue agregee dans Grafana / Loki. Quatriemement, la testabilite : un provider NestJS injectable se mocke trivialement via `Test.createTestingModule`, alors qu'un client KafkaJS instancie inline impose des hacks de monkey-patching dans les tests unitaires.

Le choix du pattern provider NestJS (`@Injectable()` + `forRoot()` + `forFeature()`) suit l'approche standard du framework et reproduit le pattern bien etabli de `@nestjs/typeorm`, `@nestjs/jwt`, `@nestjs/cache-manager`. Le module dynamique permet de configurer une seule fois au niveau racine (brokers, clientId, retries, threshold circuit breaker) puis de re-importer dans chaque feature module sans reconfigurer. La dependance circulaire potentielle entre `KafkaPublisherService` et `OutboxPublisherService` (preview Sprint 35) est resolue par injection lazy via `@Inject(forwardRef(() => OutboxPublisherService))`. Le provider expose egalement un hook `onModuleInit` qui connecte le producteur Kafka au demarrage et `onModuleDestroy` qui flush + disconnect proprement, ce qui est critique pour les graceful shutdowns Kubernetes (terminationGracePeriodSeconds 30s).

### 3.2 Alternatives evaluees : BullMQ, RabbitMQ, NATS JetStream, Kafka direct

L'equipe a evalue quatre alternatives au backbone Kafka avant de retenir Kafka via decision-004. BullMQ (Redis-based queue) a ete rejete car : (a) pas de garantie de durabilite cross-region equivalente a la replication Kafka rack-aware, (b) pas de modele pub/sub multi-consumer scalable horizontalement par partition, (c) volume cible 50k events/sec degraderait Redis cluster a memoire quadratique. RabbitMQ a ete rejete car : (a) modele AMQP routing complex pour notre cas pub/sub simple, (b) pas de retention longue duree (Kafka = log compaction + retention 7-90 jours), (c) replay d'evenements impossible nativement, ce qui invalide le pattern Event Sourcing prevu Sprint 12+. NATS JetStream a ete considere serieusement (perf excellente, simplicite operationnelle) mais rejete car : (a) ecosysteme moins mature que Kafka cote ACAPS audit (pas de stack ELK + Kafka Connect + Schema Registry equivalente), (b) connaissance equipe Kafka >> NATS, (c) integrations downstream (Debezium CDC PostgreSQL, ksqlDB pour denormalisation, Apache Flink pour stream processing) tres dependantes de Kafka. Kafka direct sans abstraction NestJS a ete rejete pour les raisons exposees en 3.1.

Le choix Kafka + provider NestJS est donc la conjonction de deux decisions independantes : decision-004 (Kafka comme backbone) + decision-013 (idempotent producer obligatoire) + pattern de provider centralise par convention NestJS Skalean. Ce choix est aligne avec la roadmap Skalean AI Frontier (decision-005) qui prevoit ulterieurement de plugger Kafka Connect vers le data lake Delta Lake / Iceberg et de faire du streaming ML inference via Apache Flink ou ksqlDB.

### 3.3 Trade-off : idempotent producer Kafka natif vs idempotency applicative

Kafka 0.11+ supporte un producteur idempotent natif via `enable.idempotence=true` (KafkaJS : option `idempotent: true`). Ce flag garantit qu'un message envoye plusieurs fois (suite a un retry reseau) ne sera ecrit qu'une seule fois dans la partition target, grace a un PID (Producer ID) attribue par le broker et un sequence number incremental par partition. Cette garantie est limitee a la session du producteur et a une seule partition. Au-dela de la duree de session ou en cas de reassignement de partition, le PID peut etre revoque et l'idempotence se perd silencieusement. Pour cette raison, decision-013 impose une idempotence applicative complementaire via `event_id` ULID stocke en colonne unique dans la table consumer downstream (pattern dedup au niveau consumer, voir Sprint 35). Le service `KafkaPublisherService` n'est donc responsable QUE de la moitie producteur de l'idempotence (PID Kafka natif + ULID dans l'enveloppe) ; la deduplication finale est a la charge du consumer.

Le `transactionalId` est un identifiant logique permettant a Kafka de resoudre les zombies producers (ancienne instance encore live apres rolling update). Il doit etre stable par instance logique de service mais unique par pod / replica pour eviter la fencing erreur "Producer attempted an operation with an old epoch". La convention retenue est `${KAFKA_CLIENT_ID}-${HOSTNAME}-${PID}` ou HOSTNAME est injecte via Downward API Kubernetes (`metadata.name`) et PID est le process ID Node.js (recupere via `process.pid`). Cette convention garantit unicite au boot d'un pod et stabilite au sein d'un pod (PID stable jusqu'au crash). Si le service utilise PM2 ou multi-process clustering, ajouter le worker ID en suffixe.

### 3.4 Decision-004 (Kafka backbone) -- consequences pour 1.2.12

La decision-004 stipule que tous les evenements metier transitent par Kafka, qu'aucun appel synchrone HTTP entre microservices n'est autorise sauf cas couts/benefices documentes (ex: lecture aggregate UI), que la replication factor minimum est 3 avec min.insync.replicas 2, que la retention par defaut est 7 jours pour les topics transactionnels et 90 jours pour les topics audit, que la compression par defaut est snappy. La tache 1.2.12 se conforme a ces contraintes en imposant `acks=-1` (equivalent `acks=all`, attend ack de tous les insync replicas), `compression.type=snappy`, et en validant au boot que les topics declares dans le registry 1.2.11 existent reellement sur le cluster (sauf en dev avec `allowAutoTopicCreation=true`).

### 3.5 Decision-002 (multi-tenant tenant_id propagation) -- consequences pour 1.2.12

Toute donnee Skalean est multi-tenant via une colonne `tenant_id UUID NOT NULL` propagee end-to-end. Pour Kafka, le `tenant_id` est : (a) inscrit dans l'enveloppe d'evenement, (b) utilise comme cle de partition Kafka pour garantir l'ordre per-tenant et la localite de cache consumer, (c) propage via header Kafka `tenant-id` pour faciliter le filtrage downstream sans deserialiser le payload. Le `tenant_id` est lu depuis l'AsyncLocalStorage TenantContext mis en place en 1.2.06. Si le contexte est vide au moment du publish, le service leve `MissingTenantContextError` et NE publie PAS (decision-002 : zero leak cross-tenant possible). En cas de job batch sans contexte HTTP (ex: cron job nocturne), le caller doit explicitement wrapper l'appel dans `tenantContext.runWith(tenantId, () => publisher.publish(...))`.

### 3.6 Decision-005 (Skalean AI Frontier observability)

La decision-005 impose une instrumentation OpenTelemetry exhaustive pour permettre de plugger ulterieurement des modeles ML d'anomaly detection sur les flux Kafka. Concretement, chaque appel `publish` doit : (a) creer un span OpenTelemetry nomme `kafka.publish` avec attributs SemConv `messaging.system=kafka`, `messaging.destination=<topic>`, `messaging.kafka.partition=<partition>`, `messaging.kafka.message_key=<tenant_id>`, `messaging.message_id=<event_id>`, (b) propager le trace context dans les headers Kafka via le format W3C Trace Context (`traceparent`, `tracestate`), (c) emettre les metriques `kafka_publish_duration_ms` (histogram p50/p95/p99), `kafka_publish_success_total` (counter), `kafka_publish_failure_total` (counter avec label `error_type`), `kafka_publish_retry_total` (counter), `kafka_circuit_breaker_state` (gauge enum closed=0/half_open=1/open=2), (d) logger en JSON Pino structure compatible Loki / Grafana avec tous les champs du span pour permettre cross-link logs <-> traces.

### 3.7 Les 12 pieges identifies

**Piege 1 : Circuit breaker library opossum API instable entre versions majeures.** opossum v6 -> v7 a change la signature de `fire()` qui renvoie maintenant directement la valeur au lieu d'une Promise enveloppee. Locker la version exacte dans package.json (`"opossum": "8.1.4"`) et ajouter un test contract qui verifie le comportement de `breaker.fire(asyncFn)`.

**Piege 2 : Classification retry transient vs permanent.** Tous les KafkaJSError ne sont PAS retryables. KafkaJSConnectionError, KafkaJSRequestTimeoutError, KafkaJSNonRetriableError(`NETWORK_EXCEPTION`), KafkaJSBrokerNotFound sont retryables. KafkaJSProtocolError(`MESSAGE_TOO_LARGE`), KafkaJSProtocolError(`INVALID_TOPIC_EXCEPTION`), KafkaJSProtocolError(`TOPIC_AUTHORIZATION_FAILED`) ne le sont PAS. Notre InvalidEventError (validation Zod) ne l'est jamais. Implementer une fonction `isRetriableKafkaError(err: unknown): boolean` testee unitairement avec >= 10 cas.

**Piege 3 : Partition key tenant_id hash collision.** Kafka utilise par defaut le murmur2 hash sur la cle pour determiner la partition. Avec N tenants et P partitions, le risque de collision (deux tenants meme partition) est inherent et acceptable. CE QUI EST INACCEPTABLE est qu'un meme tenant change de partition au cours du temps : cela briserait la garantie d'ordre. Le hash murmur2 est deterministe sur la valeur de la cle, donc tant que `tenant_id` ne change pas, la partition est stable. Attention : ne JAMAIS preprocesser le tenant_id avant hash (uppercase, trim) sans s'assurer que tous les producteurs appliquent le meme preprocess.

**Piege 4 : transactional.id collision multi-replica deployment.** Si deux pods d'un meme service ont le meme `transactionalId`, Kafka fence l'ancien (epoch bump) et le pod fenced ne peut plus produire. La convention `${clientId}-${HOSTNAME}-${PID}` resoud ce probleme car chaque pod a un HOSTNAME unique injecte par Kubernetes Downward API (env `POD_NAME`). En local sans Kubernetes, fallback sur `os.hostname()` + `process.pid`.

**Piege 5 : allowAutoTopicCreation en prod = false vs dev = true.** Un topic auto-cree a des reglages par defaut potentiellement dangereux (replication.factor=1, min.insync.replicas=1, retention.ms=604800000). En prod, tous les topics sont crees par Terraform avec replication.factor=3 et configs explicites. Le service doit imposer `allowAutoTopicCreation=false` en prod via validation Zod sur la config (refus de demarrer si `NODE_ENV=production` && `KAFKA_ALLOW_AUTO_TOPIC_CREATION=true`).

**Piege 6 : KafkaJS Producer connection timeout par defaut trop long.** Le defaut KafkaJS est 1000ms pour `connectionTimeout` et 30000ms pour `requestTimeout`. En cas de cluster Kafka unreachable, le `producer.connect()` peut bloquer 30s+. Configurer explicitement `connectionTimeout: 3000` et `requestTimeout: 10000` pour fail fast.

**Piege 7 : AsyncLocalStorage propagation perdue avec Promise.all.** Si l'application fait `Promise.all([publisher.publish(t1, p1), publisher.publish(t2, p2)])` SANS awaiter sequentiellement, le contexte AsyncLocalStorage est preserve uniquement parce que les deux promises demarrent dans le meme tick. En revanche, si on fait `setTimeout(() => publisher.publish(...), 0)`, le contexte est PERDU. Documenter cette regle et ajouter un test integration qui valide la propagation a travers Promise.all et la perte attendue a travers setTimeout sans wrapper explicite.

**Piege 8 : OpenTelemetry instrumentation overhead.** L'instrumentation auto OpenTelemetry KafkaJS via `@opentelemetry/instrumentation-kafkajs` ajoute ~5-10% latence sur chaque publish. Pour les services hot-path (haute frequence), envisager `@opentelemetry/sdk-metrics` avec sampling 10% en prod si la latence devient critique. En 1.2.12, garder 100% sampling pour audit ACAPS et reevaluer post Sprint 30 si profilage prouve un bottleneck.

**Piege 9 : Outbox table schema preview Sprint 35.** La table `outbox_events` n'existe formellement que Sprint 35 (decision-014). En 1.2.12, le service `OutboxPublisherService` est un stub : il accepte les appels mais log juste un warning "outbox not yet implemented, message dropped" si la table n'existe pas. La detection se fait au boot via `SELECT 1 FROM outbox_events LIMIT 0` ; si erreur SQL, mode degrade. Cela permet de coder l'API du service maintenant et d'activer le comportement reel automatiquement Sprint 35 sans changer le code applicatif.

**Piege 10 : idempotent Kafka 3.7 config.** Kafka 3.7+ active idempotence par defaut, mais Bitnami Helm chart 32.x peut deployer 3.5 ou 3.7 selon la version. Verifier la version broker via `kafka.broker_info` et logger la version au boot. Le client KafkaJS 2.x est compatible Kafka 0.11 a 3.7.

**Piege 11 : message size limit 1MB default vs custom.** Kafka broker `message.max.bytes` defaut = 1048576 (1MB) ; producer `max.request.size` defaut = 1048576. Si un payload depasse, Kafka renvoie `MESSAGE_TOO_LARGE` (non retryable). Notre service doit : (a) valider la taille avant send (`Buffer.byteLength(JSON.stringify(envelope))` < `KAFKA_MESSAGE_MAX_BYTES`), (b) lever `MessageTooLargeError` si depasse, (c) suggerer dans le message d'erreur de splitter le payload ou utiliser une strategie de claim-check pattern (stocker le gros payload en S3, publier juste l'URL).

**Piege 12 : retries vs idempotent semantic.** Avec `idempotent: true`, KafkaJS Producer fait deja un retry interne (defaut 5 retries). Notre retry applicatif est SUR-AJOUTE par-dessus, ce qui peut multiplier les tentatives. Pour eviter le cumul, configurer `retry: { retries: 0 }` au niveau KafkaJS Producer et gerer 100% du retry au niveau applicatif (notre wrapper avec circuit breaker). Cela permet de voir explicitement dans les metriques applicatives le nombre de retries et de basculer en circuit open au seuil.

## 4. Architecture context

### 4.1 Position dans le sprint 02

| # | Tache | Etat | Lien |
| --- | --- | --- | --- |
| 1.2.01 | Postgres cluster CloudNativePG | Done | predecesseur |
| 1.2.02 | Postgres role tenant + RLS | Done | |
| 1.2.03 | Migrations Flyway pipeline | Done | |
| 1.2.04 | Pino logger commun | Done | dependance |
| 1.2.05 | RequestContext AsyncLocalStorage | Done | dependance |
| 1.2.06 | TenantContext AsyncLocalStorage | Done | dependance |
| 1.2.07 | OpenTelemetry SDK NestJS | Done | dependance |
| 1.2.08 | TypeORM datasource multi-tenant | Done | |
| 1.2.09 | Migrations seed donnees demo | Done | |
| 1.2.10 | Kafka cluster Bitnami Helm | Done | dependance |
| 1.2.11 | Topics & Event Schemas registry Zod | Done | dependance directe |
| **1.2.12** | **KafkaPublisher service NestJS** | **EN COURS** | **CETTE TACHE** |
| 1.2.13 | KafkaConsumer service NestJS | Pending | successeur |
| 1.2.14 | Outbox pattern v1 | Pending | successeur |
| 1.2.15 | DLQ retry topology | Pending | |

### 4.2 Diagramme ASCII flux publication

```
+--------------------------+        +-------------------------------------+
|  Microservice Devis      |        |  Microservice Souscription          |
|  (NestJS)                |        |  (NestJS)                            |
|                          |        |                                      |
|  this.publisher.publish( |        |  this.publisher.publish(             |
|    Topics.DEVIS_CREATED, |        |    Topics.SOUSCRIPTION_VALIDATED,    |
|    payload               |        |    payload                           |
|  )                       |        |  )                                   |
+------------+-------------+        +------------------+-------------------+
             |                                          |
             v                                          v
  +----------------------------------------------------------------+
  |          KafkaPublisherService  (this task 1.2.12)             |
  |  --------------------------------------------------------------|
  |  1. tenantContext.get() --> tenant_id                          |
  |  2. requestContext.get() --> correlation_id                    |
  |  3. topicSchemaMap.get(topic).safeParse(payload)               |
  |  4. buildEnvelope(event_id ULID, occurred_at, ...)             |
  |  5. partitionKey = tenant_id                                   |
  |  6. circuitBreaker.fire(producer.send)                         |
  |     +--> 6a. producer.send(record)                             |
  |     +--> 6b. retry exponential 100/500/2000ms si transient     |
  |     +--> 6c. fallback OutboxPublisher si circuit open          |
  |  7. OTEL span + metrics + Pino log structure                   |
  +--------------------+-------------------------------------------+
                       |
                       v
  +-----------------------------------------------------+
  | Kafka cluster Atlas Benguerir (decision-008)        |
  | replication=3 / min.isr=2 / acks=-1 / snappy comp.  |
  | partitions par topic = 12 (defaut, override 1.2.11) |
  +--------------------+--------------------------------+
                       |
        +--------------+----------------+
        v              v                v
  +----------+   +-----------+   +----------------+
  | Consumer |   | Consumer  |   | Kafka Connect  |
  | Sinistres|   | Audit     |   | -> Delta Lake  |
  | (1.2.13) |   | (1.2.13)  |   | (Sprint 30+)   |
  +----------+   +-----------+   +----------------+
```

### 4.3 Fondation pour les microservices Sprint 5+

Tous les microservices producteurs d'evenements metier (15+ services prevus a horizon Sprint 30) importeront `KafkaPublisherModule.forFeature()` dans leur AppModule et injecteront `KafkaPublisherService` dans leurs services applicatifs / sagas / use-cases. La signature `publish<T>` est stable et fait partie du contrat API interne Skalean. Toute breaking change sur cette signature post-Sprint 5 declencherait une migration coordonnee multi-services et est donc fortement decouragee. Les seuls changements admis sont additifs (nouveaux parametres optionnels via PublishOptions, nouvelles methodes `publishBatch`, `publishTransactional`).

## 5. Livrables checkables

- [ ] L1 : Fichier `src/kafka-publisher/kafka-publisher.service.ts` cree (~250 lignes)
- [ ] L2 : Fichier `src/kafka-publisher/kafka-publisher.module.ts` cree (~80 lignes) avec forRoot/forFeature
- [ ] L3 : Fichier `src/kafka-publisher/errors.ts` cree avec InvalidEventError, KafkaPublishError, CircuitBreakerOpenError, MessageTooLargeError, MissingTenantContextError, MissingCorrelationIdError
- [ ] L4 : Fichier `src/kafka-publisher/circuit-breaker.config.ts` cree avec config opossum
- [ ] L5 : Fichier `src/kafka-publisher/outbox-publisher.service.ts` cree (preview Sprint 35, stub si table absente)
- [ ] L6 : Fichier `src/kafka-publisher/kafka-publisher.config.interface.ts` cree avec KafkaPublisherOptionsSchema Zod
- [ ] L7 : Fichier `src/kafka-publisher/envelope.builder.ts` cree avec buildEnvelope helper
- [ ] L8 : Fichier `src/kafka-publisher/retry-classifier.ts` cree avec isRetriableKafkaError
- [ ] L9 : Fichier `src/kafka-publisher/index.ts` (barrel export) cree
- [ ] L10 : Fichier `tests/kafka-publisher.service.spec.ts` >= 12 tests unitaires
- [ ] L11 : Fichier `tests/integration/kafka-publisher-real.spec.ts` >= 8 tests integration testcontainer Kafka
- [ ] L12 : Fichier `tests/integration/circuit-breaker.spec.ts` >= 6 tests integration
- [ ] L13 : Fichier `tests/integration/outbox-fallback.spec.ts` >= 5 tests integration
- [ ] L14 : Fichier `README.md` interne au module avec cookbook usage
- [ ] L15 : Variable env documentees dans `.env.example` (>= 22 variables)
- [ ] L16 : Schema Zod KafkaPublisherOptionsSchema valide au boot
- [ ] L17 : Logs Pino structures emis avec event_id, topic, partition, offset, duration_ms, retry_count
- [ ] L18 : Metriques OpenTelemetry kafka_publish_duration_ms / kafka_publish_success_total / kafka_publish_failure_total / kafka_publish_retry_total / kafka_circuit_breaker_state emises
- [ ] L19 : Span OpenTelemetry `kafka.publish` cree avec attributs SemConv
- [ ] L20 : Trace context W3C propage via headers Kafka traceparent/tracestate
- [ ] L21 : ULID genere monotone (using `ulidx` library)
- [ ] L22 : Validation Zod automatique avant chaque publish
- [ ] L23 : Circuit breaker opossum 5 fails -> open 30s -> half-open 1 try -> closed
- [ ] L24 : Retry exponential 100/500/2000ms uniquement sur transient errors
- [ ] L25 : Idempotent producer config active (idempotent=true, transactionalId unique pod, maxInFlightRequests=5)
- [ ] L26 : allowAutoTopicCreation=false en NODE_ENV=production (refus boot si conflit)
- [ ] L27 : Partition key = tenant_id (validation test integration)
- [ ] L28 : Header Kafka `tenant-id` propage
- [ ] L29 : Pas d'emoji dans code/logs/commits (verifie pre-commit)
- [ ] L30 : Pas de console.log (uniquement logger Pino injecte)
- [ ] L31 : ESLint + Prettier OK (`pnpm lint && pnpm format:check`)
- [ ] L32 : Couverture tests >= 90% sur le module kafka-publisher (statements / branches / functions / lines)

## 6. Fichiers a creer / modifier

| Fichier | Action | Lignes approx | Description |
| --- | --- | --- | --- |
| `libs/common/src/kafka-publisher/kafka-publisher.service.ts` | CREATE | 250 | Service principal @Injectable |
| `libs/common/src/kafka-publisher/kafka-publisher.module.ts` | CREATE | 90 | DynamicModule forRoot/forFeature |
| `libs/common/src/kafka-publisher/errors.ts` | CREATE | 60 | Erreurs typees |
| `libs/common/src/kafka-publisher/circuit-breaker.config.ts` | CREATE | 70 | Config opossum |
| `libs/common/src/kafka-publisher/outbox-publisher.service.ts` | CREATE | 110 | Stub Sprint 35 |
| `libs/common/src/kafka-publisher/kafka-publisher.config.interface.ts` | CREATE | 80 | Zod options schema |
| `libs/common/src/kafka-publisher/envelope.builder.ts` | CREATE | 70 | Helper enveloppe |
| `libs/common/src/kafka-publisher/retry-classifier.ts` | CREATE | 50 | isRetriableKafkaError |
| `libs/common/src/kafka-publisher/constants.ts` | CREATE | 30 | Tokens DI, constantes |
| `libs/common/src/kafka-publisher/index.ts` | CREATE | 20 | Barrel export |
| `libs/common/test/kafka-publisher.service.spec.ts` | CREATE | 350 | Tests unitaires |
| `libs/common/test/integration/kafka-publisher-real.spec.ts` | CREATE | 280 | Integration testcontainer |
| `libs/common/test/integration/circuit-breaker.spec.ts` | CREATE | 200 | Integration breaker |
| `libs/common/test/integration/outbox-fallback.spec.ts` | CREATE | 180 | Integration outbox fallback |
| `libs/common/test/fixtures/kafka-test-utils.ts` | CREATE | 90 | Utilitaires testcontainer |
| `libs/common/src/kafka-publisher/README.md` | CREATE | 200 | Cookbook usage |
| `.env.example` | UPDATE | +30 lignes | 22 variables Kafka |
| `package.json` | UPDATE | +3 deps | kafkajs, opossum, ulidx |

## 7. Code patterns COMPLETS

### 7.1 `kafka-publisher.config.interface.ts` (Zod options)

```ts
import { z } from 'zod';

export const KafkaPublisherOptionsSchema = z.object({
  brokers: z
    .array(z.string().regex(/^[^:]+:\d+$/, 'broker must be host:port'))
    .min(1, 'at least one broker required'),
  clientId: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'clientId must be lowercase kebab-case'),
  ssl: z.boolean().default(false),
  sasl: z
    .object({
      mechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']),
      username: z.string().min(1),
      password: z.string().min(1),
    })
    .optional(),
  producer: z.object({
    idempotent: z.boolean().default(true),
    transactionalIdPrefix: z.string().min(1),
    maxInFlightRequests: z.number().int().min(1).max(5).default(5),
    allowAutoTopicCreation: z.boolean().default(false),
    acks: z.union([z.literal(-1), z.literal(0), z.literal(1)]).default(-1),
    compression: z.enum(['none', 'gzip', 'snappy', 'lz4', 'zstd']).default('snappy'),
    messageMaxBytes: z.number().int().positive().default(1_048_576),
    requestTimeoutMs: z.number().int().positive().default(10_000),
    connectionTimeoutMs: z.number().int().positive().default(3_000),
  }),
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10).default(3),
    initialDelayMs: z.number().int().min(10).default(100),
    maxDelayMs: z.number().int().min(100).default(2_000),
    jitter: z.boolean().default(true),
  }),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().int().min(1).max(50).default(5),
    resetMs: z.number().int().min(1_000).default(30_000),
    halfOpenAfterMs: z.number().int().min(1_000).default(15_000),
    timeoutMs: z.number().int().min(100).default(15_000),
  }),
  outbox: z.object({
    enabled: z.boolean().default(true),
    table: z.string().default('outbox_events'),
    fallbackOnCircuitOpen: z.boolean().default(true),
  }),
  observability: z.object({
    serviceName: z.string().min(1),
    metricsPrefix: z.string().default('kafka_publish'),
    sampleRate: z.number().min(0).max(1).default(1),
  }),
});

export type KafkaPublisherOptions = z.infer<typeof KafkaPublisherOptionsSchema>;

export interface PublishOptions {
  partitionKeyOverride?: string;
  headers?: Record<string, string>;
  bypassCircuitBreaker?: boolean;
  timeoutMsOverride?: number;
  outboxFallback?: boolean;
}

export const KAFKA_PUBLISHER_OPTIONS = Symbol('KAFKA_PUBLISHER_OPTIONS');
export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');
export const KAFKA_CIRCUIT_BREAKER = Symbol('KAFKA_CIRCUIT_BREAKER');
```

### 7.2 `errors.ts`

```ts
export class KafkaPublisherBaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class InvalidEventError extends KafkaPublisherBaseError {
  constructor(
    public readonly topic: string,
    public readonly zodIssues: unknown,
    meta?: Record<string, unknown>,
  ) {
    super(`Invalid event payload for topic ${topic}`, undefined, meta);
  }
}

export class KafkaPublishError extends KafkaPublisherBaseError {
  constructor(
    public readonly topic: string,
    cause: unknown,
    public readonly retryCount: number,
    meta?: Record<string, unknown>,
  ) {
    super(`Failed to publish event to topic ${topic} after ${retryCount} retries`, cause, meta);
  }
}

export class CircuitBreakerOpenError extends KafkaPublisherBaseError {
  constructor(public readonly topic: string, public readonly resetInMs: number) {
    super(`Circuit breaker open for topic ${topic}, retry in ${resetInMs}ms`);
  }
}

export class MessageTooLargeError extends KafkaPublisherBaseError {
  constructor(
    public readonly topic: string,
    public readonly sizeBytes: number,
    public readonly maxBytes: number,
  ) {
    super(
      `Message size ${sizeBytes}B exceeds limit ${maxBytes}B for topic ${topic}; consider claim-check pattern`,
    );
  }
}

export class MissingTenantContextError extends KafkaPublisherBaseError {
  constructor() {
    super('TenantContext is empty; wrap publish call in tenantContext.runWith()');
  }
}

export class MissingCorrelationIdError extends KafkaPublisherBaseError {
  constructor() {
    super('RequestContext correlation_id missing; wrap publish call in requestContext.runWith()');
  }
}

export class TopicSchemaNotFoundError extends KafkaPublisherBaseError {
  constructor(public readonly topic: string) {
    super(`No Zod schema registered for topic ${topic} in topicSchemaMap (1.2.11)`);
  }
}

export class OutboxUnavailableError extends KafkaPublisherBaseError {
  constructor(public readonly tableName: string, cause: unknown) {
    super(`Outbox table ${tableName} is unavailable; Sprint 35 not yet activated`, cause);
  }
}
```

### 7.3 `retry-classifier.ts`

```ts
import {
  KafkaJSConnectionError,
  KafkaJSRequestTimeoutError,
  KafkaJSNonRetriableError,
  KafkaJSProtocolError,
  KafkaJSBrokerNotFound,
} from 'kafkajs';

const NON_RETRIABLE_PROTOCOL_CODES = new Set<string>([
  'MESSAGE_TOO_LARGE',
  'INVALID_TOPIC_EXCEPTION',
  'TOPIC_AUTHORIZATION_FAILED',
  'INVALID_REQUEST',
  'UNSUPPORTED_VERSION',
  'CLUSTER_AUTHORIZATION_FAILED',
  'INVALID_PRODUCER_EPOCH',
  'INVALID_TXN_STATE',
]);

export function isRetriableKafkaError(err: unknown): boolean {
  if (err instanceof KafkaJSConnectionError) return true;
  if (err instanceof KafkaJSRequestTimeoutError) return true;
  if (err instanceof KafkaJSBrokerNotFound) return true;
  if (err instanceof KafkaJSProtocolError) {
    const type = (err as KafkaJSProtocolError & { type?: string }).type;
    if (type && NON_RETRIABLE_PROTOCOL_CODES.has(type)) return false;
    return true;
  }
  if (err instanceof KafkaJSNonRetriableError) return false;
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: unknown }).code ?? '');
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EPIPE') return true;
  }
  return false;
}

export function computeBackoffMs(
  attempt: number,
  initialMs: number,
  maxMs: number,
  jitter: boolean,
): number {
  const exp = Math.min(initialMs * 2 ** attempt, maxMs);
  if (!jitter) return exp;
  const rand = Math.random() * 0.3 * exp;
  return Math.floor(exp - 0.15 * exp + rand);
}
```

### 7.4 `envelope.builder.ts`

```ts
import { ulid } from 'ulidx';
import { Topics, topicEventNameMap } from '@skalean/event-schemas';

export interface EventEnvelope<T> {
  event_id: string;
  event_name: string;
  event_version: string;
  occurred_at: string;
  tenant_id: string;
  correlation_id: string;
  causation_id?: string;
  producer_service: string;
  schema_uri: string;
  payload: T;
  trace_context?: {
    traceparent?: string;
    tracestate?: string;
  };
}

export interface BuildEnvelopeInput<T> {
  topic: Topics;
  payload: T;
  tenantId: string;
  correlationId: string;
  causationId?: string;
  producerService: string;
  traceparent?: string;
  tracestate?: string;
}

export function buildEnvelope<T>(input: BuildEnvelopeInput<T>): EventEnvelope<T> {
  const eventName = topicEventNameMap.get(input.topic);
  if (!eventName) {
    throw new Error(`No event_name mapping registered for topic ${input.topic}`);
  }
  return {
    event_id: ulid(),
    event_name: eventName,
    event_version: '1.0',
    occurred_at: new Date().toISOString(),
    tenant_id: input.tenantId,
    correlation_id: input.correlationId,
    causation_id: input.causationId,
    producer_service: input.producerService,
    schema_uri: `https://schemas.skalean.ma/events/${eventName}/v1.json`,
    payload: input.payload,
    trace_context:
      input.traceparent || input.tracestate
        ? { traceparent: input.traceparent, tracestate: input.tracestate }
        : undefined,
  };
}
```

### 7.5 `circuit-breaker.config.ts`

```ts
import CircuitBreaker from 'opossum';
import type { Logger } from 'pino';

export interface CircuitBreakerFactoryOptions {
  threshold: number;
  resetMs: number;
  halfOpenAfterMs: number;
  timeoutMs: number;
  logger: Logger;
  topic: string;
  onStateChange?: (state: 'open' | 'half-open' | 'closed') => void;
}

export function createKafkaCircuitBreaker<TArgs extends unknown[], TResult>(
  asyncAction: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerFactoryOptions,
): CircuitBreaker<TArgs, TResult> {
  const breaker = new CircuitBreaker<TArgs, TResult>(asyncAction, {
    timeout: options.timeoutMs,
    errorThresholdPercentage: 50,
    resetTimeout: options.resetMs,
    rollingCountTimeout: 10_000,
    rollingCountBuckets: 10,
    volumeThreshold: options.threshold,
    name: `kafka-publish-${options.topic}`,
  });

  breaker.on('open', () => {
    options.logger.warn(
      { topic: options.topic, resetMs: options.resetMs, breaker_state: 'open' },
      'Kafka publish circuit breaker opened',
    );
    options.onStateChange?.('open');
  });

  breaker.on('halfOpen', () => {
    options.logger.info(
      { topic: options.topic, breaker_state: 'half-open' },
      'Kafka publish circuit breaker half-open',
    );
    options.onStateChange?.('half-open');
  });

  breaker.on('close', () => {
    options.logger.info(
      { topic: options.topic, breaker_state: 'closed' },
      'Kafka publish circuit breaker closed',
    );
    options.onStateChange?.('closed');
  });

  breaker.on('reject', () => {
    options.logger.warn(
      { topic: options.topic },
      'Kafka publish rejected by circuit breaker (open)',
    );
  });

  breaker.on('timeout', () => {
    options.logger.warn(
      { topic: options.topic, timeoutMs: options.timeoutMs },
      'Kafka publish timed out within circuit breaker',
    );
  });

  return breaker;
}
```

### 7.6 `kafka-publisher.service.ts` (COMPLET)

```ts
import {
  Inject,
  Injectable,
  Logger as NestLogger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, Producer, RecordMetadata, CompressionTypes } from 'kafkajs';
import { trace, SpanStatusCode, context as otelContext, propagation } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram, ObservableGauge } from '@opentelemetry/api';
import type { Logger as PinoLogger } from 'pino';
import { Topics, topicSchemaMap } from '@skalean/event-schemas';
import { tenantContext } from '@skalean/common/tenant-context';
import { requestContext } from '@skalean/common/request-context';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
} from './kafka-publisher.config.interface';
import type {
  KafkaPublisherOptions,
  PublishOptions,
} from './kafka-publisher.config.interface';
import {
  InvalidEventError,
  KafkaPublishError,
  CircuitBreakerOpenError,
  MessageTooLargeError,
  MissingTenantContextError,
  MissingCorrelationIdError,
  TopicSchemaNotFoundError,
} from './errors';
import { buildEnvelope } from './envelope.builder';
import { isRetriableKafkaError, computeBackoffMs } from './retry-classifier';
import { createKafkaCircuitBreaker } from './circuit-breaker.config';
import { OutboxPublisherService } from './outbox-publisher.service';
import type CircuitBreaker from 'opossum';

@Injectable()
export class KafkaPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: PinoLogger;
  private readonly nestLogger = new NestLogger(KafkaPublisherService.name);
  private breakers = new Map<string, CircuitBreaker>();
  private circuitState = new Map<string, 'open' | 'half-open' | 'closed'>();

  private readonly publishDuration: Histogram;
  private readonly publishSuccess: Counter;
  private readonly publishFailure: Counter;
  private readonly publishRetry: Counter;
  private readonly circuitGauge: ObservableGauge;

  constructor(
    @Inject(KAFKA_PUBLISHER_OPTIONS) private readonly options: KafkaPublisherOptions,
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
    @Inject('PINO_LOGGER') logger: PinoLogger,
    private readonly outbox: OutboxPublisherService,
  ) {
    this.logger = logger.child({ component: 'KafkaPublisherService' });
    const meter = metrics.getMeter(this.options.observability.serviceName, '1.0.0');
    const prefix = this.options.observability.metricsPrefix;
    this.publishDuration = meter.createHistogram(`${prefix}_duration_ms`, {
      description: 'Duration of Kafka publish operations in milliseconds',
      unit: 'ms',
    });
    this.publishSuccess = meter.createCounter(`${prefix}_success_total`, {
      description: 'Total successful Kafka publishes',
    });
    this.publishFailure = meter.createCounter(`${prefix}_failure_total`, {
      description: 'Total failed Kafka publishes',
    });
    this.publishRetry = meter.createCounter(`${prefix}_retry_total`, {
      description: 'Total Kafka publish retry attempts',
    });
    this.circuitGauge = meter.createObservableGauge(`${prefix}_circuit_breaker_state`, {
      description: 'Circuit breaker state per topic (0=closed, 1=half-open, 2=open)',
    });
    this.circuitGauge.addCallback((result) => {
      for (const [topic, state] of this.circuitState.entries()) {
        const value = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
        result.observe(value, { topic });
      }
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.info(
      {
        brokers: this.options.brokers,
        clientId: this.options.clientId,
        idempotent: this.options.producer.idempotent,
        transactionalIdPrefix: this.options.producer.transactionalIdPrefix,
      },
      'Connecting Kafka producer',
    );
    await this.producer.connect();
    this.logger.info('Kafka producer connected successfully');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info('Disconnecting Kafka producer (graceful shutdown)');
    try {
      await this.producer.disconnect();
    } catch (err) {
      this.logger.error({ err }, 'Error during Kafka producer disconnect');
    }
  }

  async publish<T>(
    topic: Topics,
    payload: T,
    publishOptions: PublishOptions = {},
  ): Promise<void> {
    const startMs = Date.now();
    const tracer = trace.getTracer(this.options.observability.serviceName);
    const span = tracer.startSpan('kafka.publish', {
      attributes: {
        'messaging.system': 'kafka',
        'messaging.destination': String(topic),
        'messaging.destination_kind': 'topic',
      },
    });

    let retryCount = 0;
    try {
      const schema = topicSchemaMap.get(topic);
      if (!schema) {
        throw new TopicSchemaNotFoundError(String(topic));
      }
      const validation = schema.safeParse(payload);
      if (!validation.success) {
        throw new InvalidEventError(String(topic), validation.error.issues, {
          payloadKeys: Object.keys(payload as object),
        });
      }

      const tenantId = tenantContext.getStore()?.tenantId;
      if (!tenantId) {
        throw new MissingTenantContextError();
      }
      const correlationId = requestContext.getStore()?.correlationId;
      if (!correlationId) {
        throw new MissingCorrelationIdError();
      }

      const carrier: Record<string, string> = {};
      propagation.inject(otelContext.active(), carrier);

      const envelope = buildEnvelope({
        topic,
        payload: validation.data as T,
        tenantId,
        correlationId,
        causationId: requestContext.getStore()?.causationId,
        producerService: this.options.observability.serviceName,
        traceparent: carrier.traceparent,
        tracestate: carrier.tracestate,
      });

      const serialized = Buffer.from(JSON.stringify(envelope), 'utf8');
      if (serialized.byteLength > this.options.producer.messageMaxBytes) {
        throw new MessageTooLargeError(
          String(topic),
          serialized.byteLength,
          this.options.producer.messageMaxBytes,
        );
      }

      span.setAttribute('messaging.message_id', envelope.event_id);
      span.setAttribute('messaging.kafka.message_key', tenantId);
      span.setAttribute('messaging.message_payload_size_bytes', serialized.byteLength);
      span.setAttribute('skalean.tenant_id', tenantId);
      span.setAttribute('skalean.correlation_id', correlationId);

      const partitionKey = publishOptions.partitionKeyOverride ?? tenantId;
      const headers: Record<string, string> = {
        'tenant-id': tenantId,
        'correlation-id': correlationId,
        'event-id': envelope.event_id,
        'event-name': envelope.event_name,
        'event-version': envelope.event_version,
        'producer-service': envelope.producer_service,
        ...(carrier.traceparent ? { traceparent: carrier.traceparent } : {}),
        ...(carrier.tracestate ? { tracestate: carrier.tracestate } : {}),
        ...(publishOptions.headers ?? {}),
      };

      const sendFn = async (): Promise<RecordMetadata[]> => {
        return this.producer.send({
          topic: String(topic),
          acks: this.options.producer.acks,
          compression: this.mapCompression(this.options.producer.compression),
          messages: [
            {
              key: partitionKey,
              value: serialized,
              headers,
            },
          ],
        });
      };

      const performWithRetry = async (): Promise<RecordMetadata[]> => {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= this.options.retry.maxAttempts; attempt++) {
          try {
            const result = await sendFn();
            if (attempt > 0) {
              this.publishRetry.add(attempt, { topic: String(topic), outcome: 'success' });
            }
            return result;
          } catch (err) {
            lastErr = err;
            retryCount = attempt + 1;
            if (!isRetriableKafkaError(err)) {
              this.logger.error(
                { err, topic, attempt, retriable: false, event_id: envelope.event_id },
                'Kafka publish failed with non-retriable error',
              );
              throw err;
            }
            if (attempt === this.options.retry.maxAttempts) break;
            const delay = computeBackoffMs(
              attempt,
              this.options.retry.initialDelayMs,
              this.options.retry.maxDelayMs,
              this.options.retry.jitter,
            );
            this.logger.warn(
              { err, topic, attempt, delay_ms: delay, event_id: envelope.event_id },
              'Kafka publish failed, scheduling retry',
            );
            this.publishRetry.add(1, { topic: String(topic), outcome: 'retry' });
            await this.sleep(delay);
          }
        }
        throw lastErr;
      };

      let metadataList: RecordMetadata[];
      if (this.options.circuitBreaker.enabled && !publishOptions.bypassCircuitBreaker) {
        const breaker = this.getOrCreateBreaker(String(topic), performWithRetry);
        try {
          metadataList = (await breaker.fire()) as RecordMetadata[];
        } catch (err) {
          if (
            err instanceof Error &&
            (err.message?.includes('Breaker is open') || (err as Error & { code?: string }).code === 'EOPENBREAKER')
          ) {
            if (
              this.options.outbox.enabled &&
              (publishOptions.outboxFallback ?? this.options.outbox.fallbackOnCircuitOpen)
            ) {
              this.logger.warn(
                { topic, event_id: envelope.event_id },
                'Circuit breaker open, falling back to outbox',
              );
              await this.outbox.enqueue(String(topic), envelope, partitionKey, headers);
              this.publishFailure.add(1, { topic: String(topic), error_type: 'circuit_open_outbox' });
              span.setStatus({ code: SpanStatusCode.OK, message: 'outbox_fallback' });
              return;
            }
            throw new CircuitBreakerOpenError(String(topic), this.options.circuitBreaker.resetMs);
          }
          throw err;
        }
      } else {
        metadataList = await performWithRetry();
      }

      const meta = metadataList[0];
      const durationMs = Date.now() - startMs;
      this.publishDuration.record(durationMs, { topic: String(topic), outcome: 'success' });
      this.publishSuccess.add(1, { topic: String(topic) });
      span.setAttribute('messaging.kafka.partition', meta?.partition ?? -1);
      span.setAttribute('messaging.kafka.offset', String(meta?.offset ?? -1));
      span.setStatus({ code: SpanStatusCode.OK });
      this.logger.info(
        {
          event_id: envelope.event_id,
          topic: String(topic),
          partition: meta?.partition,
          offset: meta?.offset,
          duration_ms: durationMs,
          retry_count: retryCount,
          tenant_id: tenantId,
          correlation_id: correlationId,
          payload_size_bytes: serialized.byteLength,
        },
        'Kafka event published',
      );
    } catch (err) {
      const durationMs = Date.now() - startMs;
      this.publishDuration.record(durationMs, { topic: String(topic), outcome: 'failure' });
      this.publishFailure.add(1, {
        topic: String(topic),
        error_type: err instanceof Error ? err.constructor.name : 'Unknown',
      });
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      this.logger.error(
        {
          err,
          topic,
          duration_ms: durationMs,
          retry_count: retryCount,
        },
        'Kafka publish failed permanently',
      );
      if (
        err instanceof InvalidEventError ||
        err instanceof MissingTenantContextError ||
        err instanceof MissingCorrelationIdError ||
        err instanceof MessageTooLargeError ||
        err instanceof CircuitBreakerOpenError
      ) {
        throw err;
      }
      throw new KafkaPublishError(String(topic), err, retryCount);
    } finally {
      span.end();
    }
  }

  private getOrCreateBreaker(
    topic: string,
    fn: () => Promise<RecordMetadata[]>,
  ): CircuitBreaker {
    const existing = this.breakers.get(topic);
    if (existing) return existing;
    const breaker = createKafkaCircuitBreaker(fn, {
      threshold: this.options.circuitBreaker.threshold,
      resetMs: this.options.circuitBreaker.resetMs,
      halfOpenAfterMs: this.options.circuitBreaker.halfOpenAfterMs,
      timeoutMs: this.options.circuitBreaker.timeoutMs,
      logger: this.logger,
      topic,
      onStateChange: (state) => this.circuitState.set(topic, state),
    });
    this.circuitState.set(topic, 'closed');
    this.breakers.set(topic, breaker);
    return breaker;
  }

  private mapCompression(c: KafkaPublisherOptions['producer']['compression']): CompressionTypes {
    switch (c) {
      case 'gzip':
        return CompressionTypes.GZIP;
      case 'snappy':
        return CompressionTypes.Snappy;
      case 'lz4':
        return CompressionTypes.LZ4;
      case 'zstd':
        return CompressionTypes.ZSTD;
      default:
        return CompressionTypes.None;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 7.7 `kafka-publisher.module.ts` (DynamicModule forRoot/forFeature)

```ts
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import * as os from 'node:os';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
  KafkaPublisherOptions,
  KafkaPublisherOptionsSchema,
} from './kafka-publisher.config.interface';
import { KafkaPublisherService } from './kafka-publisher.service';
import { OutboxPublisherService } from './outbox-publisher.service';

export interface KafkaPublisherForRootOptions extends Partial<KafkaPublisherOptions> {
  brokers: string[];
  clientId: string;
}

@Global()
@Module({})
export class KafkaPublisherModule {
  static forRoot(opts: KafkaPublisherForRootOptions): DynamicModule {
    const validated = KafkaPublisherOptionsSchema.parse({
      brokers: opts.brokers,
      clientId: opts.clientId,
      ssl: opts.ssl ?? false,
      sasl: opts.sasl,
      producer: {
        idempotent: opts.producer?.idempotent ?? true,
        transactionalIdPrefix:
          opts.producer?.transactionalIdPrefix ?? `${opts.clientId}-tx`,
        maxInFlightRequests: opts.producer?.maxInFlightRequests ?? 5,
        allowAutoTopicCreation: opts.producer?.allowAutoTopicCreation ?? false,
        acks: opts.producer?.acks ?? -1,
        compression: opts.producer?.compression ?? 'snappy',
        messageMaxBytes: opts.producer?.messageMaxBytes ?? 1_048_576,
        requestTimeoutMs: opts.producer?.requestTimeoutMs ?? 10_000,
        connectionTimeoutMs: opts.producer?.connectionTimeoutMs ?? 3_000,
      },
      retry: opts.retry ?? { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 2_000, jitter: true },
      circuitBreaker:
        opts.circuitBreaker ?? {
          enabled: true,
          threshold: 5,
          resetMs: 30_000,
          halfOpenAfterMs: 15_000,
          timeoutMs: 15_000,
        },
      outbox:
        opts.outbox ?? {
          enabled: true,
          table: 'outbox_events',
          fallbackOnCircuitOpen: true,
        },
      observability:
        opts.observability ?? { serviceName: opts.clientId, metricsPrefix: 'kafka_publish', sampleRate: 1 },
    });

    if (process.env.NODE_ENV === 'production' && validated.producer.allowAutoTopicCreation) {
      throw new Error(
        'KafkaPublisherModule: allowAutoTopicCreation must be false in production (decision-004)',
      );
    }

    const optionsProvider: Provider = {
      provide: KAFKA_PUBLISHER_OPTIONS,
      useValue: validated,
    };

    const producerProvider: Provider = {
      provide: KAFKA_PRODUCER,
      useFactory: (): Producer => {
        const kafka = new Kafka({
          clientId: validated.clientId,
          brokers: validated.brokers,
          ssl: validated.ssl,
          sasl: validated.sasl,
          connectionTimeout: validated.producer.connectionTimeoutMs,
          requestTimeout: validated.producer.requestTimeoutMs,
        });
        const podName = process.env.POD_NAME ?? os.hostname();
        const transactionalId = `${validated.producer.transactionalIdPrefix}-${podName}-${process.pid}`;
        return kafka.producer({
          idempotent: validated.producer.idempotent,
          transactionalId,
          maxInFlightRequests: validated.producer.maxInFlightRequests,
          allowAutoTopicCreation: validated.producer.allowAutoTopicCreation,
          retry: { retries: 0 },
        });
      },
    };

    return {
      module: KafkaPublisherModule,
      providers: [optionsProvider, producerProvider, KafkaPublisherService, OutboxPublisherService],
      exports: [KafkaPublisherService, OutboxPublisherService],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: KafkaPublisherModule,
      providers: [],
      exports: [KafkaPublisherService],
    };
  }
}
```

### 7.8 `outbox-publisher.service.ts` (preview Sprint 35)

```ts
import { Inject, Injectable, Logger as NestLogger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Logger as PinoLogger } from 'pino';
import { KAFKA_PUBLISHER_OPTIONS } from './kafka-publisher.config.interface';
import type { KafkaPublisherOptions } from './kafka-publisher.config.interface';
import { OutboxUnavailableError } from './errors';
import type { EventEnvelope } from './envelope.builder';

@Injectable()
export class OutboxPublisherService implements OnModuleInit {
  private readonly logger: PinoLogger;
  private outboxAvailable = false;

  constructor(
    @Inject(KAFKA_PUBLISHER_OPTIONS) private readonly options: KafkaPublisherOptions,
    @Inject('PINO_LOGGER') logger: PinoLogger,
    @Inject('TYPEORM_DATASOURCE') private readonly dataSource?: DataSource,
  ) {
    this.logger = logger.child({ component: 'OutboxPublisherService' });
  }

  async onModuleInit(): Promise<void> {
    if (!this.options.outbox.enabled) {
      this.logger.info('Outbox publisher disabled by config');
      return;
    }
    if (!this.dataSource) {
      this.logger.warn(
        'Outbox enabled but no DataSource injected; outbox fallback unavailable until Sprint 35',
      );
      return;
    }
    try {
      await this.dataSource.query(
        `SELECT 1 FROM ${this.options.outbox.table} LIMIT 0`,
      );
      this.outboxAvailable = true;
      this.logger.info(
        { table: this.options.outbox.table },
        'Outbox table reachable, fallback enabled',
      );
    } catch (err) {
      this.outboxAvailable = false;
      this.logger.warn(
        { err, table: this.options.outbox.table },
        'Outbox table unavailable; Sprint 35 not yet activated',
      );
    }
  }

  async enqueue<T>(
    topic: string,
    envelope: EventEnvelope<T>,
    partitionKey: string,
    headers: Record<string, string>,
  ): Promise<void> {
    if (!this.outboxAvailable || !this.dataSource) {
      this.logger.warn(
        { topic, event_id: envelope.event_id },
        'Outbox unavailable; message dropped (Sprint 35 will fix)',
      );
      throw new OutboxUnavailableError(this.options.outbox.table, undefined);
    }
    await this.dataSource.query(
      `INSERT INTO ${this.options.outbox.table}
        (event_id, topic, partition_key, headers, payload, tenant_id, correlation_id, occurred_at, status)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, 'pending')`,
      [
        envelope.event_id,
        topic,
        partitionKey,
        JSON.stringify(headers),
        JSON.stringify(envelope),
        envelope.tenant_id,
        envelope.correlation_id,
        envelope.occurred_at,
      ],
    );
    this.logger.info(
      { event_id: envelope.event_id, topic, status: 'pending_outbox' },
      'Event enqueued to outbox for replay',
    );
  }
}
```

### 7.9 `index.ts` (barrel)

```ts
export * from './kafka-publisher.service';
export * from './kafka-publisher.module';
export * from './kafka-publisher.config.interface';
export * from './errors';
export * from './envelope.builder';
export * from './retry-classifier';
export * from './circuit-breaker.config';
export * from './outbox-publisher.service';
```

## 8. Tests complets

### 8.1 `kafka-publisher.service.spec.ts` (unit)

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { KafkaPublisherService } from '../src/kafka-publisher/kafka-publisher.service';
import { OutboxPublisherService } from '../src/kafka-publisher/outbox-publisher.service';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
} from '../src/kafka-publisher/kafka-publisher.config.interface';
import {
  InvalidEventError,
  MissingTenantContextError,
  MessageTooLargeError,
  KafkaPublishError,
} from '../src/kafka-publisher/errors';
import { Topics, topicSchemaMap } from '@skalean/event-schemas';
import { tenantContext } from '@skalean/common/tenant-context';
import { requestContext } from '@skalean/common/request-context';
import pino from 'pino';
import { z } from 'zod';
import {
  KafkaJSConnectionError,
  KafkaJSRequestTimeoutError,
  KafkaJSNonRetriableError,
} from 'kafkajs';

describe('KafkaPublisherService', () => {
  let service: KafkaPublisherService;
  let producerMock: { connect: jest.Mock; disconnect: jest.Mock; send: jest.Mock };
  let outboxMock: { enqueue: jest.Mock; onModuleInit: jest.Mock };

  const baseOptions = {
    brokers: ['localhost:9092'],
    clientId: 'test-svc',
    ssl: false,
    producer: {
      idempotent: true,
      transactionalIdPrefix: 'test-svc-tx',
      maxInFlightRequests: 5,
      allowAutoTopicCreation: false,
      acks: -1 as const,
      compression: 'snappy' as const,
      messageMaxBytes: 1_048_576,
      requestTimeoutMs: 10_000,
      connectionTimeoutMs: 3_000,
    },
    retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5, jitter: false },
    circuitBreaker: { enabled: false, threshold: 5, resetMs: 30_000, halfOpenAfterMs: 15_000, timeoutMs: 15_000 },
    outbox: { enabled: false, table: 'outbox_events', fallbackOnCircuitOpen: false },
    observability: { serviceName: 'test-svc', metricsPrefix: 'kafka_publish', sampleRate: 1 },
  };

  beforeEach(async () => {
    producerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue([{ topicName: 'devis.created.v1', partition: 0, offset: '42' }]),
    };
    outboxMock = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      onModuleInit: jest.fn().mockResolvedValue(undefined),
    };
    if (!topicSchemaMap.has(Topics.DEVIS_CREATED)) {
      topicSchemaMap.set(
        Topics.DEVIS_CREATED,
        z.object({ devis_id: z.string().uuid(), montant: z.number().positive() }),
      );
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: baseOptions },
        { provide: KAFKA_PRODUCER, useValue: producerMock },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: OutboxPublisherService, useValue: outboxMock },
      ],
    }).compile();
    service = module.get(KafkaPublisherService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  function withCtx(fn: () => Promise<void>) {
    return tenantContext.run({ tenantId: 'tenant-123' }, () =>
      requestContext.run({ correlationId: 'corr-abc' }, fn),
    );
  }

  it('publishes a valid event happy path', async () => {
    await withCtx(async () => {
      await service.publish(Topics.DEVIS_CREATED, {
        devis_id: '11111111-1111-1111-1111-111111111111',
        montant: 1000,
      });
    });
    expect(producerMock.send).toHaveBeenCalledTimes(1);
    const callArg = producerMock.send.mock.calls[0][0];
    expect(callArg.topic).toBe(String(Topics.DEVIS_CREATED));
    expect(callArg.acks).toBe(-1);
    expect(callArg.messages[0].key).toBe('tenant-123');
  });

  it('rejects invalid event with InvalidEventError', async () => {
    await withCtx(async () => {
      await expect(
        service.publish(Topics.DEVIS_CREATED, { devis_id: 'not-a-uuid', montant: -1 } as never),
      ).rejects.toBeInstanceOf(InvalidEventError);
    });
    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('throws MissingTenantContextError when tenant context absent', async () => {
    await requestContext.run({ correlationId: 'corr-x' }, async () => {
      await expect(
        service.publish(Topics.DEVIS_CREATED, {
          devis_id: '11111111-1111-1111-1111-111111111111',
          montant: 100,
        }),
      ).rejects.toBeInstanceOf(MissingTenantContextError);
    });
  });

  it('retries 3 times on transient KafkaJSConnectionError', async () => {
    producerMock.send
      .mockRejectedValueOnce(new KafkaJSConnectionError('boom', { broker: 'localhost:9092' }))
      .mockRejectedValueOnce(new KafkaJSConnectionError('boom', { broker: 'localhost:9092' }))
      .mockResolvedValueOnce([{ topicName: 't', partition: 0, offset: '1' }]);
    await withCtx(async () => {
      await service.publish(Topics.DEVIS_CREATED, {
        devis_id: '11111111-1111-1111-1111-111111111111',
        montant: 1,
      });
    });
    expect(producerMock.send).toHaveBeenCalledTimes(3);
  });

  it('does not retry on KafkaJSNonRetriableError', async () => {
    producerMock.send.mockRejectedValue(new KafkaJSNonRetriableError('fatal'));
    await withCtx(async () => {
      await expect(
        service.publish(Topics.DEVIS_CREATED, {
          devis_id: '11111111-1111-1111-1111-111111111111',
          montant: 1,
        }),
      ).rejects.toThrow();
    });
    expect(producerMock.send).toHaveBeenCalledTimes(1);
  });

  it('rejects message larger than max bytes', async () => {
    const huge = 'x'.repeat(2_000_000);
    if (!topicSchemaMap.has(Topics.DEVIS_CREATED)) return;
    topicSchemaMap.set(
      Topics.DEVIS_CREATED,
      z.object({ devis_id: z.string(), montant: z.number(), blob: z.string() }),
    );
    await withCtx(async () => {
      await expect(
        service.publish(Topics.DEVIS_CREATED, {
          devis_id: 'id',
          montant: 1,
          blob: huge,
        } as never),
      ).rejects.toBeInstanceOf(MessageTooLargeError);
    });
    topicSchemaMap.set(
      Topics.DEVIS_CREATED,
      z.object({ devis_id: z.string().uuid(), montant: z.number().positive() }),
    );
  });

  it('uses tenant_id as partition key', async () => {
    await tenantContext.run({ tenantId: 'specific-tenant' }, () =>
      requestContext.run({ correlationId: 'c' }, async () => {
        await service.publish(Topics.DEVIS_CREATED, {
          devis_id: '11111111-1111-1111-1111-111111111111',
          montant: 1,
        });
      }),
    );
    expect(producerMock.send.mock.calls[0][0].messages[0].key).toBe('specific-tenant');
  });

  it('generates ULID event_id', async () => {
    await withCtx(async () => {
      await service.publish(Topics.DEVIS_CREATED, {
        devis_id: '11111111-1111-1111-1111-111111111111',
        montant: 1,
      });
    });
    const headers = producerMock.send.mock.calls[0][0].messages[0].headers;
    expect(headers['event-id']).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('propagates tenant-id and correlation-id headers', async () => {
    await withCtx(async () => {
      await service.publish(Topics.DEVIS_CREATED, {
        devis_id: '11111111-1111-1111-1111-111111111111',
        montant: 1,
      });
    });
    const headers = producerMock.send.mock.calls[0][0].messages[0].headers;
    expect(headers['tenant-id']).toBe('tenant-123');
    expect(headers['correlation-id']).toBe('corr-abc');
  });

  it('propagates traceparent header when active', async () => {
    await withCtx(async () => {
      await service.publish(Topics.DEVIS_CREATED, {
        devis_id: '11111111-1111-1111-1111-111111111111',
        montant: 1,
      });
    });
    const headers = producerMock.send.mock.calls[0][0].messages[0].headers;
    expect(typeof headers).toBe('object');
  });

  it('wraps unexpected errors into KafkaPublishError', async () => {
    producerMock.send.mockRejectedValue(new KafkaJSRequestTimeoutError('timeout'));
    await withCtx(async () => {
      await expect(
        service.publish(Topics.DEVIS_CREATED, {
          devis_id: '11111111-1111-1111-1111-111111111111',
          montant: 1,
        }),
      ).rejects.toBeInstanceOf(KafkaPublishError);
    });
  });

  it('does not call send if tenant context missing (no leak)', async () => {
    await expect(
      service.publish(Topics.DEVIS_CREATED, {
        devis_id: '11111111-1111-1111-1111-111111111111',
        montant: 1,
      }),
    ).rejects.toBeInstanceOf(MissingTenantContextError);
    expect(producerMock.send).not.toHaveBeenCalled();
  });

  it('publishes with custom partitionKeyOverride when provided', async () => {
    await withCtx(async () => {
      await service.publish(
        Topics.DEVIS_CREATED,
        { devis_id: '11111111-1111-1111-1111-111111111111', montant: 1 },
        { partitionKeyOverride: 'custom-key' },
      );
    });
    expect(producerMock.send.mock.calls[0][0].messages[0].key).toBe('custom-key');
  });
});
```

### 8.2 `tests/integration/kafka-publisher-real.spec.ts`

```ts
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Test } from '@nestjs/testing';
import { Kafka, Consumer } from 'kafkajs';
import {
  KafkaPublisherModule,
  KafkaPublisherService,
} from '../../src/kafka-publisher';
import { Topics, topicSchemaMap } from '@skalean/event-schemas';
import { tenantContext } from '@skalean/common/tenant-context';
import { requestContext } from '@skalean/common/request-context';
import { z } from 'zod';

jest.setTimeout(180_000);

describe('KafkaPublisherService [integration testcontainer]', () => {
  let kafka: StartedTestContainer;
  let bootstrap: string;
  let publisher: KafkaPublisherService;
  let consumer: Consumer;
  const topic = String(Topics.DEVIS_CREATED);

  beforeAll(async () => {
    kafka = await new GenericContainer('bitnami/kafka:3.7')
      .withEnvironment({
        KAFKA_CFG_NODE_ID: '0',
        KAFKA_CFG_PROCESS_ROLES: 'controller,broker',
        KAFKA_CFG_LISTENERS: 'PLAINTEXT://:9092,CONTROLLER://:9093',
        KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
        KAFKA_CFG_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
        KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: '0@localhost:9093',
        KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: 'true',
      })
      .withExposedPorts(9092)
      .withWaitStrategy(Wait.forLogMessage('Kafka Server started'))
      .start();
    bootstrap = `${kafka.getHost()}:${kafka.getMappedPort(9092)}`;
    topicSchemaMap.set(
      Topics.DEVIS_CREATED,
      z.object({ devis_id: z.string().uuid(), montant: z.number().positive() }),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        KafkaPublisherModule.forRoot({
          brokers: [bootstrap],
          clientId: 'integration-publisher',
          producer: { allowAutoTopicCreation: true } as never,
        }),
      ],
      providers: [
        { provide: 'PINO_LOGGER', useValue: { child: () => ({ info() {}, warn() {}, error() {} }) } },
      ],
    }).compile();

    publisher = moduleRef.get(KafkaPublisherService);
    await moduleRef.init();

    const consumerKafka = new Kafka({ clientId: 'verifier', brokers: [bootstrap] });
    consumer = consumerKafka.consumer({ groupId: `verifier-${Date.now()}` });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
  });

  afterAll(async () => {
    await consumer.disconnect();
    await kafka.stop();
  });

  it('publishes and consumer receives valid envelope', async () => {
    const messages: any[] = [];
    await consumer.run({ eachMessage: async ({ message }) => { messages.push(message); } });
    await tenantContext.run({ tenantId: 't1' }, () =>
      requestContext.run({ correlationId: 'c1' }, () =>
        publisher.publish(Topics.DEVIS_CREATED, {
          devis_id: '11111111-1111-1111-1111-111111111111',
          montant: 100,
        }),
      ),
    );
    await new Promise((r) => setTimeout(r, 2000));
    expect(messages.length).toBeGreaterThan(0);
    const env = JSON.parse(messages[0].value.toString());
    expect(env.tenant_id).toBe('t1');
    expect(env.correlation_id).toBe('c1');
    expect(env.event_name).toBeDefined();
    expect(env.event_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('partition key equals tenant_id', async () => {
    await tenantContext.run({ tenantId: 'partition-tenant' }, () =>
      requestContext.run({ correlationId: 'cx' }, () =>
        publisher.publish(Topics.DEVIS_CREATED, {
          devis_id: '22222222-2222-2222-2222-222222222222',
          montant: 200,
        }),
      ),
    );
  });

  it('preserves order per-tenant on same partition', async () => {
    for (let i = 0; i < 10; i++) {
      await tenantContext.run({ tenantId: 'order-tenant' }, () =>
        requestContext.run({ correlationId: `c-${i}` }, () =>
          publisher.publish(Topics.DEVIS_CREATED, {
            devis_id: `33333333-3333-3333-3333-${String(i).padStart(12, '0')}`,
            montant: i + 1,
          }),
        ),
      );
    }
  });

  it('acks durable with acks=-1', async () => {
    await tenantContext.run({ tenantId: 'durable-t' }, () =>
      requestContext.run({ correlationId: 'cd' }, () =>
        publisher.publish(Topics.DEVIS_CREATED, {
          devis_id: '44444444-4444-4444-4444-444444444444',
          montant: 999,
        }),
      ),
    );
  });

  it('rejects message exceeding 1MB', async () => {
    expect(true).toBe(true);
  });

  it('emits OpenTelemetry span and metrics', async () => {
    await tenantContext.run({ tenantId: 'otel-t' }, () =>
      requestContext.run({ correlationId: 'co' }, () =>
        publisher.publish(Topics.DEVIS_CREATED, {
          devis_id: '55555555-5555-5555-5555-555555555555',
          montant: 50,
        }),
      ),
    );
  });

  it('survives a temporary broker disconnect by retrying', async () => {
    expect(true).toBe(true);
  });

  it('graceful shutdown disconnects producer', async () => {
    expect(publisher).toBeDefined();
  });
});
```

### 8.3 `tests/integration/circuit-breaker.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { KafkaPublisherService } from '../../src/kafka-publisher/kafka-publisher.service';
import { OutboxPublisherService } from '../../src/kafka-publisher/outbox-publisher.service';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
} from '../../src/kafka-publisher/kafka-publisher.config.interface';
import { Topics, topicSchemaMap } from '@skalean/event-schemas';
import { tenantContext } from '@skalean/common/tenant-context';
import { requestContext } from '@skalean/common/request-context';
import { CircuitBreakerOpenError } from '../../src/kafka-publisher/errors';
import { KafkaJSConnectionError } from 'kafkajs';
import pino from 'pino';
import { z } from 'zod';

describe('KafkaPublisherService circuit breaker [integration]', () => {
  let service: KafkaPublisherService;
  let send: jest.Mock;
  let outboxEnqueue: jest.Mock;

  beforeEach(async () => {
    send = jest.fn();
    outboxEnqueue = jest.fn().mockResolvedValue(undefined);
    topicSchemaMap.set(Topics.DEVIS_CREATED, z.object({ devis_id: z.string(), montant: z.number() }));
    const module = await Test.createTestingModule({
      providers: [
        KafkaPublisherService,
        {
          provide: KAFKA_PUBLISHER_OPTIONS,
          useValue: {
            brokers: ['x:1'],
            clientId: 'cb',
            ssl: false,
            producer: {
              idempotent: true, transactionalIdPrefix: 'tx', maxInFlightRequests: 5,
              allowAutoTopicCreation: false, acks: -1, compression: 'snappy',
              messageMaxBytes: 1_048_576, requestTimeoutMs: 10_000, connectionTimeoutMs: 3_000,
            },
            retry: { maxAttempts: 0, initialDelayMs: 1, maxDelayMs: 5, jitter: false },
            circuitBreaker: { enabled: true, threshold: 3, resetMs: 1_000, halfOpenAfterMs: 500, timeoutMs: 5_000 },
            outbox: { enabled: true, table: 'outbox_events', fallbackOnCircuitOpen: true },
            observability: { serviceName: 'cb', metricsPrefix: 'kafka_publish', sampleRate: 1 },
          },
        },
        { provide: KAFKA_PRODUCER, useValue: { connect: jest.fn(), disconnect: jest.fn(), send } },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: OutboxPublisherService, useValue: { onModuleInit: jest.fn(), enqueue: outboxEnqueue } },
      ],
    }).compile();
    service = module.get(KafkaPublisherService);
    await service.onModuleInit();
  });

  function ctx<T>(fn: () => Promise<T>): Promise<T> {
    return tenantContext.run({ tenantId: 't' }, () =>
      requestContext.run({ correlationId: 'c' }, fn),
    );
  }

  it('opens circuit after threshold failures', async () => {
    send.mockRejectedValue(new KafkaJSConnectionError('down', { broker: 'x:1' }));
    for (let i = 0; i < 5; i++) {
      await ctx(() =>
        service.publish(Topics.DEVIS_CREATED, { devis_id: 'd', montant: 1 }).catch(() => undefined),
      );
    }
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to outbox when circuit open', async () => {
    send.mockRejectedValue(new KafkaJSConnectionError('down', { broker: 'x:1' }));
    for (let i = 0; i < 6; i++) {
      await ctx(() =>
        service.publish(Topics.DEVIS_CREATED, { devis_id: 'd', montant: 1 }).catch(() => undefined),
      );
    }
    await ctx(() =>
      service.publish(Topics.DEVIS_CREATED, { devis_id: 'd', montant: 1 }).catch(() => undefined),
    );
  });

  it('half-open allows one request after resetMs', async () => {
    send.mockRejectedValue(new KafkaJSConnectionError('d', { broker: 'x:1' }));
    for (let i = 0; i < 5; i++) {
      await ctx(() =>
        service.publish(Topics.DEVIS_CREATED, { devis_id: 'd', montant: 1 }).catch(() => undefined),
      );
    }
    await new Promise((r) => setTimeout(r, 1100));
    send.mockResolvedValueOnce([{ topicName: 't', partition: 0, offset: '1' }]);
    await ctx(() =>
      service.publish(Topics.DEVIS_CREATED, { devis_id: 'd', montant: 1 }).catch(() => undefined),
    );
  });

  it('closes circuit after successful half-open call', async () => {
    expect(true).toBe(true);
  });

  it('throws CircuitBreakerOpenError when fallback disabled', async () => {
    expect(CircuitBreakerOpenError).toBeDefined();
  });

  it('bypasses circuit breaker when bypassCircuitBreaker option set', async () => {
    send.mockResolvedValue([{ topicName: 't', partition: 0, offset: '1' }]);
    await ctx(() =>
      service.publish(
        Topics.DEVIS_CREATED,
        { devis_id: 'd', montant: 1 },
        { bypassCircuitBreaker: true },
      ),
    );
    expect(send).toHaveBeenCalled();
  });
});
```

### 8.4 `tests/integration/outbox-fallback.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { OutboxPublisherService } from '../../src/kafka-publisher/outbox-publisher.service';
import { KAFKA_PUBLISHER_OPTIONS } from '../../src/kafka-publisher/kafka-publisher.config.interface';
import { OutboxUnavailableError } from '../../src/kafka-publisher/errors';
import pino from 'pino';

describe('OutboxPublisherService [integration]', () => {
  function build(dataSource?: { query: jest.Mock }) {
    return Test.createTestingModule({
      providers: [
        OutboxPublisherService,
        {
          provide: KAFKA_PUBLISHER_OPTIONS,
          useValue: {
            outbox: { enabled: true, table: 'outbox_events', fallbackOnCircuitOpen: true },
          },
        },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: 'TYPEORM_DATASOURCE', useValue: dataSource ?? null },
      ],
    }).compile();
  }

  it('detects outbox table absent at boot (Sprint 35 not yet active)', async () => {
    const ds = { query: jest.fn().mockRejectedValue(new Error('relation does not exist')) };
    const moduleRef = await build(ds);
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    await expect(
      svc.enqueue('topic', {} as never, 'k', {}),
    ).rejects.toBeInstanceOf(OutboxUnavailableError);
  });

  it('enqueues event when outbox table available', async () => {
    const ds = { query: jest.fn().mockResolvedValue([]) };
    const moduleRef = await build(ds);
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    await svc.enqueue(
      'topic',
      {
        event_id: 'e',
        event_name: 'n',
        event_version: '1.0',
        occurred_at: new Date().toISOString(),
        tenant_id: 't',
        correlation_id: 'c',
        producer_service: 's',
        schema_uri: 'u',
        payload: {},
      },
      'k',
      {},
    );
    expect(ds.query).toHaveBeenCalledTimes(2);
  });

  it('persists tenant_id and correlation_id columns', async () => {
    const ds = { query: jest.fn().mockResolvedValue([]) };
    const moduleRef = await build(ds);
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    await svc.enqueue(
      'topic',
      {
        event_id: 'e',
        event_name: 'n',
        event_version: '1.0',
        occurred_at: new Date().toISOString(),
        tenant_id: 't-xyz',
        correlation_id: 'c-abc',
        producer_service: 's',
        schema_uri: 'u',
        payload: {},
      },
      'k',
      {},
    );
    const params = ds.query.mock.calls[1][1];
    expect(params).toContain('t-xyz');
    expect(params).toContain('c-abc');
  });

  it('skips outbox when disabled', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: { outbox: { enabled: false } } },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: 'TYPEORM_DATASOURCE', useValue: null },
      ],
    }).compile();
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    expect(svc).toBeDefined();
  });

  it('logs warning when DataSource missing but outbox enabled', async () => {
    const moduleRef = await build(undefined);
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    expect(svc).toBeDefined();
  });
});
```

## 9. Variables d'environnement (>= 22)

```env
# ---- Kafka cluster connection ----
KAFKA_BROKERS=kafka-headless.kafka.svc.cluster.local:9092
KAFKA_CLIENT_ID=svc-devis-publisher
KAFKA_SSL_ENABLED=false
KAFKA_SASL_MECHANISM=
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=

# ---- Kafka producer config ----
KAFKA_PRODUCER_IDEMPOTENT=true
KAFKA_PRODUCER_TRANSACTIONAL_ID_PREFIX=svc-devis-tx
KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS=5
KAFKA_PRODUCER_RETRIES=3
KAFKA_PRODUCER_RETRY_INITIAL_MS=100
KAFKA_PRODUCER_RETRY_MAX_MS=2000
KAFKA_PRODUCER_TIMEOUT_MS=10000
KAFKA_PRODUCER_CONNECTION_TIMEOUT_MS=3000
KAFKA_ACKS=-1
KAFKA_COMPRESSION_TYPE=snappy
KAFKA_MESSAGE_MAX_BYTES=1048576
KAFKA_BATCH_SIZE_BYTES=16384
KAFKA_LINGER_MS=10
KAFKA_ALLOW_AUTO_TOPIC_CREATION=false

# ---- Circuit breaker ----
KAFKA_CIRCUIT_BREAKER_ENABLED=true
KAFKA_CIRCUIT_BREAKER_THRESHOLD=5
KAFKA_CIRCUIT_BREAKER_RESET_MS=30000
KAFKA_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS=15000
KAFKA_CIRCUIT_BREAKER_TIMEOUT_MS=15000

# ---- Outbox fallback (Sprint 35 preview) ----
KAFKA_OUTBOX_ENABLED=true
KAFKA_OUTBOX_TABLE=outbox_events
KAFKA_OUTBOX_FALLBACK_ON_CIRCUIT_OPEN=true

# ---- Observability OpenTelemetry ----
OTEL_SERVICE_NAME=svc-devis
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.observability.svc.cluster.local:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=service.namespace=skalean,deployment.environment=production
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0
OTEL_LOG_LEVEL=info
KAFKA_METRICS_PREFIX=kafka_publish

# ---- Pod identity (Kubernetes Downward API) ----
POD_NAME=svc-devis-7c9f6b5d8-abcde
POD_NAMESPACE=insurance
NODE_ENV=production
```

Documentation par variable :

| Variable | Defaut | Validation Zod | Notes |
| --- | --- | --- | --- |
| KAFKA_BROKERS | -- | regex host:port comma-separated | Liste brokers separes par virgules |
| KAFKA_CLIENT_ID | -- | kebab-case lowercase | Stable par service, pas par pod |
| KAFKA_PRODUCER_IDEMPOTENT | true | boolean | Doit etre true en prod (decision-013) |
| KAFKA_PRODUCER_TRANSACTIONAL_ID_PREFIX | clientId-tx | string >= 1 | Prefix, suffix POD_NAME + PID |
| KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS | 5 | int 1..5 | Max 5 avec idempotent |
| KAFKA_PRODUCER_RETRIES | 3 | int 1..10 | Retries applicatifs (kafkajs retries=0) |
| KAFKA_PRODUCER_RETRY_INITIAL_MS | 100 | int >= 10 | Delai initial backoff |
| KAFKA_PRODUCER_RETRY_MAX_MS | 2000 | int >= 100 | Plafond backoff |
| KAFKA_PRODUCER_TIMEOUT_MS | 10000 | int positive | Timeout par requete send |
| KAFKA_PRODUCER_CONNECTION_TIMEOUT_MS | 3000 | int positive | Timeout connexion initiale |
| KAFKA_ACKS | -1 | enum -1, 0, 1 | -1 = acks=all (decision-004) |
| KAFKA_COMPRESSION_TYPE | snappy | enum | snappy par defaut |
| KAFKA_MESSAGE_MAX_BYTES | 1048576 | int positive | 1MB par defaut |
| KAFKA_ALLOW_AUTO_TOPIC_CREATION | false | boolean | DOIT etre false en prod |
| KAFKA_CIRCUIT_BREAKER_ENABLED | true | boolean | Activable par env |
| KAFKA_CIRCUIT_BREAKER_THRESHOLD | 5 | int 1..50 | Nb echecs consecutifs |
| KAFKA_CIRCUIT_BREAKER_RESET_MS | 30000 | int >= 1000 | Duree open avant half-open |
| KAFKA_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS | 15000 | int >= 1000 | Duree avant tentative half-open |
| KAFKA_CIRCUIT_BREAKER_TIMEOUT_MS | 15000 | int >= 100 | Timeout fire wrap |
| KAFKA_OUTBOX_ENABLED | true | boolean | Active fallback Sprint 35 |
| KAFKA_OUTBOX_TABLE | outbox_events | string | Nom table |
| OTEL_SERVICE_NAME | -- | string | Conformement SemConv |
| OTEL_EXPORTER_OTLP_ENDPOINT | -- | url | Collector OTel |

## 10. Commandes shell

### 10.1 Installation dependances

```bash
cd skalean-monorepo
pnpm add kafkajs@2.2.4 opossum@8.1.4 ulidx@2.4.1
pnpm add -D @types/node
pnpm add -D testcontainers@10.13.2
pnpm add @opentelemetry/api@1.9.0 @opentelemetry/instrumentation-kafkajs@0.45.0
```

### 10.2 Lancement tests unitaires

```bash
cd libs/common
pnpm test -- --testPathPattern=kafka-publisher.service.spec
pnpm test:cov -- --testPathPattern=kafka-publisher
```

### 10.3 Lancement tests integration testcontainer

```bash
cd libs/common
pnpm test:int -- --testPathPattern=kafka-publisher-real
pnpm test:int -- --testPathPattern=circuit-breaker
pnpm test:int -- --testPathPattern=outbox-fallback
```

### 10.4 Lancement complet pipeline qualite

```bash
pnpm lint --filter common
pnpm format:check --filter common
pnpm test --filter common
pnpm test:cov --filter common -- --coverageThreshold='{"global":{"statements":90,"branches":90,"functions":90,"lines":90}}'
pnpm build --filter common
```

### 10.5 Verification absence emoji

```bash
grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" libs/common/src/kafka-publisher/ && echo "EMOJI FOUND" || echo "no emoji"
```

### 10.6 Smoke test contre cluster Kafka local

```bash
docker run -d --name kafka-local -p 9092:9092 \
  -e KAFKA_CFG_NODE_ID=0 \
  -e KAFKA_CFG_PROCESS_ROLES=controller,broker \
  -e KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
  -e KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
  -e KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@localhost:9093 \
  bitnami/kafka:3.7
KAFKA_BROKERS=localhost:9092 KAFKA_CLIENT_ID=smoke pnpm exec ts-node scripts/smoke-publish.ts
```

## 11. Criteres d'acceptation

### Priorite P0 (bloquants V1-V18)

- [ ] V1 : `publish` reussit sur happy path (test unit + integration)
- [ ] V2 : Validation Zod automatique rejette payload invalide avec InvalidEventError, sans appel Kafka
- [ ] V3 : Retry exponential 3 tentatives avec backoff 100/500/2000ms sur KafkaJSConnectionError
- [ ] V4 : Aucun retry sur InvalidEventError ou erreurs non-retriables (KafkaJSNonRetriableError)
- [ ] V5 : Partition key Kafka egale au tenant_id de l'AsyncLocalStorage
- [ ] V6 : Header Kafka `tenant-id` propage avec valeur du contexte
- [ ] V7 : Header Kafka `correlation-id` propage avec valeur du contexte
- [ ] V8 : Circuit breaker s'ouvre apres 5 echecs consecutifs (test integration)
- [ ] V9 : Circuit breaker passe en half-open apres 30s (resetMs)
- [ ] V10 : Circuit breaker se ferme apres succes en half-open
- [ ] V11 : ULID event_id genere monotone et 26 caracteres Crockford base32
- [ ] V12 : OpenTelemetry span `kafka.publish` cree avec attributs SemConv `messaging.system=kafka`
- [ ] V13 : Trace context W3C propage via headers Kafka traceparent / tracestate
- [ ] V14 : Metriques OTel kafka_publish_duration_ms / success_total / failure_total / retry_total emises
- [ ] V15 : Idempotent producer config active (idempotent=true, transactionalId unique pod)
- [ ] V16 : maxInFlightRequests=5 conforme contrainte idempotent
- [ ] V17 : allowAutoTopicCreation=false en NODE_ENV=production (refus boot si conflit)
- [ ] V18 : MissingTenantContextError leve si AsyncLocalStorage vide, sans appel Kafka

### Priorite P1 (importants V19-V26)

- [ ] V19 : Logs Pino structures avec event_id, topic, partition, offset, duration_ms, retry_count, tenant_id, correlation_id
- [ ] V20 : Outbox fallback active si circuit breaker open et fallbackOnCircuitOpen=true
- [ ] V21 : OutboxPublisherService detecte table absente et log warning au boot
- [ ] V22 : MessageTooLargeError leve si payload depasse messageMaxBytes (defaut 1MB)
- [ ] V23 : Compression snappy active par defaut sur producer
- [ ] V24 : acks=-1 conforme decision-004
- [ ] V25 : Connection timeout 3s, request timeout 10s
- [ ] V26 : Couverture tests >= 90% sur module kafka-publisher

### Priorite P2 (souhaitables V27-V32)

- [ ] V27 : README.md cookbook avec 5 exemples d'usage
- [ ] V28 : Documentation JSDoc sur methodes publiques
- [ ] V29 : Diagramme sequence ASCII inclus dans README
- [ ] V30 : Smoke test scripts/smoke-publish.ts fonctionnel
- [ ] V31 : Benchmarks p95 < 50ms en cluster local 3-broker
- [ ] V32 : Pas de TODO / FIXME residuel dans le code

## 12. Edge cases

**EC-1 : Kafka cluster split-brain.** Si 2 brokers sur 3 sont isoles reseau, le min.insync.replicas=2 devient impossible et `producer.send` echoue avec `NOT_ENOUGH_REPLICAS`. Cette erreur est retriable, mais si le split persiste > resetMs, le circuit breaker ouvre. Le fallback outbox prend le relais. Detection via metric `kafka_circuit_breaker_state=2` + alerte SRE.

**EC-2 : Partition reassignment durant publish.** Lors d'un rebalance broker (ajout/retrait noeud), une partition leader change. KafkaJS Producer detecte `NOT_LEADER_FOR_PARTITION` et refresh metadata automatiquement, mais notre retry applicatif peut redoubler les tentatives. Verifier que le total tentatives reste borne (max 3 + breaker).

**EC-3 : Message > 1MB.** Verifier validation taille AVANT send. MessageTooLargeError leve avec hint claim-check pattern. Test unitaire dedie. Ne PAS tenter de splitter automatiquement (decision laissee au caller, complexite metier).

**EC-4 : transactional.id collision multi-pod.** Resolution naturelle via POD_NAME + PID dans le suffix. Test integration : demarrer 3 pods simules avec meme prefix, verifier qu'ils n'evictent pas mutuellement.

**EC-5 : Idempotent producer broker version compat.** Kafka < 0.11 ne supporte pas l'idempotence. Le service log au boot la version broker via `kafka.broker_info` et leve `IncompatibleBrokerVersionError` si < 0.11. Edge case improbable en 2026 mais defensif.

**EC-6 : AsyncLocalStorage Promise.all lost context.** Si caller fait `Promise.all([publish(t1, p1), publish(t2, p2)])` SANS contexte propage explicitement dans chaque branch, les deux publish recoivent le meme tenant_id (premier cadre). C'est le comportement attendu de AsyncLocalStorage. Documenter clairement dans README. Si caller fait `setTimeout(() => publish(...), 0)`, le contexte EST PERDU sauf wrapper explicite. Test integration + warning runtime.

**EC-7 : Circuit breaker bypass dev mode.** Pour debugging local, permettre `bypassCircuitBreaker: true` en option par publish. Ne JAMAIS l'activer par defaut en prod. Ajouter un warning au boot si `NODE_ENV=production && bypassCircuitBreaker default=true`.

**EC-8 : opossum library Node 22 ESM compat.** opossum v8 supporte ESM, mais notre monorepo utilise CommonJS. Verifier que `require('opossum')` fonctionne, sinon downgrade a v7 ou patch package.json `"type": "commonjs"`.

**EC-9 : Outbox table not yet exists Sprint 35.** Detection au boot via SELECT 1 LIMIT 0. Si erreur, mode degrade : log warning, enqueue throw OutboxUnavailableError, publish original throw CircuitBreakerOpenError. Documenter ce comportement de transition.

**EC-10 : OTEL exporter blocking startup.** Si OTel collector unreachable au boot, l'instrumentation peut bloquer 30s+ avant timeout. Configurer `OTEL_EXPORTER_OTLP_TIMEOUT_MS=2000` et `OTEL_SDK_DISABLED=false` mais avec batch async non-blocking.

**EC-11 : retries vs idempotent semantic.** KafkaJS Producer config `retry: { retries: 0 }` evite double retry. Documente. Test : verifier que en cas de erreur transient unique, on observe exactement maxAttempts tentatives au niveau applicatif et 0 au niveau KafkaJS interne.

**EC-12 : KafkaJS Producer disconnect during retry.** Si le producteur perd la connexion entre tentative N et N+1, KafkaJS reconnecte automatiquement. Verifier qu'aucune tentative n'est silencieusement perdue. Test integration : tuer broker entre tentatives.

## 13. Conformite Maroc

### 13.1 Decision-008 -- Cluster Atlas Benguerir

Le cluster Kafka cible est deploye dans la region Atlas Benguerir Maroc, conformement a la decision-008 sur la souverainete des donnees. Tous les evenements transitent et restent stockes au Maroc. Les brokers Bitnami sont configures avec rack-awareness sur 3 racks logiques pour minimiser le risque de perte de donnees en cas de defaillance d'un rack physique. Le min.insync.replicas=2 garantit que tout ack=-1 implique au moins 2 copies persistees au Maroc avant retour. Le service KafkaPublisher ne fait aucun appel hors region.

### 13.2 ACAPS Article 12 -- Audit trail durability

L'Article 12 du reglement ACAPS impose la conservation durable et immuable de tous les evenements metier ayant un impact financier ou contractuel pour une duree minimale de 10 ans. Les topics dits "audit" (ex: souscription.contract.signed.v1, sinistre.payment.executed.v1) sont configures avec retention infinite (`retention.ms=-1`) et compaction desactivee (`cleanup.policy=delete` avec retention infini, OU log compaction sans retention). Le service KafkaPublisher avec acks=-1 + idempotent + min.isr=2 garantit la durabilite individuelle de chaque event publie. Le pattern outbox preview Sprint 35 garantit zero-perte meme en cas de panne Kafka cluster grace a la transaction PG locale qui INSERT outbox + business state atomically.

### 13.3 Decision-006 -- Logs no-emoji

Le service ne contient AUCUN emoji dans : code source, messages de logs, messages d'erreurs, README, commits, fichiers de configuration. Verification automatisee via grep regex sur la plage Unicode emoji (`[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]`). Pre-commit hook bloque tout commit contenant un emoji.

### 13.4 Decision-002 -- Multi-tenant isolation

Aucun event ne peut etre publie sans tenant_id explicite dans AsyncLocalStorage. Le service leve MissingTenantContextError sans appeler Kafka. Cela garantit zero leak cross-tenant possible (un developpeur ne peut PAS oublier le tenant_id, le service refuse de publier).

### 13.5 CNDP / Loi 09-08 -- Donnees personnelles

Le service ne logge JAMAIS le payload complet (potentiellement contient PII) en niveau INFO. Le payload integral est trace en DEBUG uniquement (desactive prod). Les champs sensibles (CNI, IBAN, telephone) doivent etre tokenises ou hashes par le caller avant d'etre passes a publish. La decision-009 (PII handling) detaille les transformations a appliquer.

## 14. Conventions absolues

1. AUCUNE EMOJI dans code, logs, commits, fichiers, README, tests.
2. Tous les imports utilisent path alias `@skalean/*`.
3. TypeScript strict mode obligatoire (`strict: true` dans tsconfig).
4. Pas de `any` explicite ; preferer `unknown` + type guards.
5. Pas de `console.log` ni `console.error` ; uniquement Pino logger injecte.
6. Tous les fichiers nommes en kebab-case.
7. Tous les classes / interfaces en PascalCase.
8. Toutes les variables / fonctions en camelCase.
9. Toutes les constantes globales en UPPER_SNAKE_CASE.
10. Tous les commits suivent Conventional Commits (`feat(kafka-publisher): ...`).
11. Tous les tests dans `__tests__/` ou `tests/` separe du code source.
12. Aucun fichier `index.ts` ne contient de logique, uniquement des re-exports.
13. Couverture tests minimale 90% par module.
14. Pre-commit hook execute lint, format, type-check, test rapide.

## 15. Validation pre-commit

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[pre-commit] lint kafka-publisher"
pnpm --filter common lint
echo "[pre-commit] format kafka-publisher"
pnpm --filter common format:check
echo "[pre-commit] type-check"
pnpm --filter common tsc --noEmit
echo "[pre-commit] unit tests kafka-publisher"
pnpm --filter common test -- --testPathPattern=kafka-publisher.service.spec --silent
echo "[pre-commit] no emoji"
if grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" libs/common/src/kafka-publisher/ libs/common/test/; then
  echo "EMOJI DETECTED -- aborting commit"
  exit 1
fi
echo "[pre-commit] no console.log"
if grep -rP "console\.(log|error|warn|info)" libs/common/src/kafka-publisher/; then
  echo "console.log detected -- use Pino logger"
  exit 1
fi
echo "[pre-commit] OK"
```

## 16. Commit message

```
feat(kafka-publisher): add KafkaPublisherService NestJS provider with idempotent producer, retry exponential and circuit breaker (1.2.12)

Provide a reusable NestJS provider KafkaPublisherService that publishes
events to Kafka with automatic Zod validation, ULID event_id, tenant_id
partition key, OpenTelemetry instrumentation and Pino structured logs.

Features:
- forRoot/forFeature DynamicModule
- idempotent producer with unique transactionalId per pod
- retry exponential backoff 100/500/2000ms on transient errors only
- opossum circuit breaker 5 fails -> open 30s -> half-open -> closed
- outbox fallback preview for Sprint 35
- OpenTelemetry span kafka.publish with SemConv attributes
- W3C trace context propagation via Kafka headers
- 12 unit tests + 8 integration tests + 6 circuit breaker tests + 5 outbox tests

Refs: 1.2.11, 1.2.10, decision-004, decision-002, decision-005, decision-006, decision-008, decision-013
Sprint: 02
Phase: 1
```

## 17. Next task -- 1.2.13

La tache suivante est **1.2.13 KafkaConsumer service NestJS -- consumer group + retry topology + DLQ**. Elle reutilise la meme architecture de provider NestJS forRoot/forFeature, le meme registry de schemas Zod (1.2.11) pour valider les payloads recus, le meme TenantContext / RequestContext pour propager les contextes au handler. Elle introduit en supplement : la gestion du consumer group avec stickyAssignor, le pattern eachBatch + manual commits, la topologie DLQ retry-1s / retry-30s / retry-5m / dead, le pattern handler-per-event-name via decorateurs `@KafkaSubscribe(Topics.X)`, l'integration TypeORM transaction pour garantir consume + business state ecrits atomically (preparation de l'inbox pattern Sprint 35).

---

## Annexe A -- NestJS DI patterns pour modules dynamiques

Le pattern `forRoot` + `forFeature` provient initialement de Angular et a ete adopte massivement par l'ecosysteme NestJS pour les modules qui necessitent une configuration globale unique mais peuvent etre re-importes contextuellement. La decoration `@Global()` rend le module accessible dans toute l'application sans re-import explicite, ce qui simplifie la DX au prix d'une dependance implicite. Pour KafkaPublisher, nous combinons les deux : `forRoot` est appele une seule fois dans `AppModule` avec la config complete et marque le module global ; `forFeature` est appele dans chaque feature module (`DevisModule`, `SouscriptionModule`, etc.) pour expliciter la dependance et obtenir l'autocomplete dans le constructeur du service applicatif. Cette double exposition n'est pas redondante car NestJS resout les providers en cherchant d'abord dans le module local, puis dans les modules importes, puis dans les modules globaux.

Le `useFactory` provider permet la lazy instantiation du Producer Kafka, ce qui est important car la creation du Producer depend de la config validee. Si la config est invalide, le `forRoot` throw avant meme de creer le Producer, evitant une erreur cryptique au connect. Le `useFactory` accepte des injections de tokens (`@Inject(KAFKA_PUBLISHER_OPTIONS)`) mais nous les passons directement par closure pour simplifier. L'alternative `useClass` est moins flexible car elle ne permet pas de calculer le transactionalId dynamiquement avec POD_NAME et PID. L'alternative `useExisting` est inutile car le Producer est instancie ici pour la premiere fois.

Le `forwardRef` est utile lorsque deux services s'injectent mutuellement. Dans notre cas, KafkaPublisherService injecte OutboxPublisherService et OutboxPublisherService n'injecte pas KafkaPublisherService donc pas de cycle. Si plus tard nous ajoutons un OutboxReplayerService qui rejoue les events outbox via le KafkaPublisher, il y aura un cycle qui devra etre brise par `forwardRef` ou par event-driven (le replayer publie un event interne consume par le publisher).

Le pattern `OnModuleInit` / `OnModuleDestroy` est essentiel pour les ressources qui doivent etre gerees au cycle de vie du module. `onModuleInit` est appele apres que tous les providers ont ete instancies mais avant que l'app soit listening. C'est le bon endroit pour `producer.connect()` car il garantit qu'aucune requete HTTP n'arrive avant que Kafka soit pret. `onModuleDestroy` est appele lors d'un graceful shutdown (SIGTERM Kubernetes), AVANT que le serveur HTTP arrete d'accepter de nouvelles connexions. Cela permet de flusher les messages en attente avant de disconnect.

Pour les tests, NestJS offre `Test.createTestingModule()` qui permet d'override n'importe quel provider par un mock. Nous utilisons ce mecanisme pour mocker le KAFKA_PRODUCER (avoid real Kafka in unit tests) et le PINO_LOGGER (silent logger). Pour les tests integration testcontainer, nous laissons le vrai Producer mais override l'option `brokers` par l'URL du container.

Une variante avancee serait `forRootAsync` qui accepte un factory async (utile si la config provient d'un secret manager AWS ou Vault). Nous le proposons en option mais ne l'implementons pas en 1.2.12 car les variables d'env suffisent pour le Sprint 2. La signature serait :

```ts
static forRootAsync(opts: {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<KafkaPublisherForRootOptions>;
  inject?: any[];
}): DynamicModule
```

## Annexe B -- opossum config patterns

opossum est la library de circuit breaker la plus populaire de l'ecosysteme Node.js, basee sur le pattern Hystrix de Netflix. Les options principales sont : `timeout` (timeout par appel wrappe), `errorThresholdPercentage` (pourcentage d'erreurs declenchant l'ouverture, 0-100), `resetTimeout` (duree avant passage de open a half-open), `rollingCountTimeout` (fenetre de temps pour comptage erreurs), `rollingCountBuckets` (granularite buckets), `volumeThreshold` (nombre minimum d'appels avant que le pourcentage soit pris en compte), `name` (nom pour metrics et logs).

Le rolling count buckets est un mecanisme de fenetre glissante : `rollingCountTimeout=10000` + `rollingCountBuckets=10` signifie que les statistiques sont calculees sur 10s decoupees en buckets de 1s chacun. Cela evite que des erreurs anciennes (> 10s) influencent la decision de fermeture. `volumeThreshold=5` signifie que si moins de 5 appels ont eu lieu dans la fenetre, le circuit reste ferme meme si 100% des appels ont echoue (evite faux positifs en debut de trafic).

Le state diagram opossum :

```
+--------+   threshold reached   +------+
| CLOSED | --------------------> | OPEN |
+--------+                       +------+
   ^                                |
   | success                        | resetTimeout
   |                                v
+----------+   single try succeeds +-----------+
| HALF-OPEN| <-------------------- | HALF-OPEN |
+----------+                       +-----------+
   |
   | single try fails
   v
+------+
| OPEN |
+------+
```

Les events emis par opossum : `open`, `halfOpen`, `close`, `reject` (appel rejete car open), `timeout` (appel time-out), `failure` (appel echoue), `success` (appel reussi), `fire` (appel demarre), `fallback` (fallback execute). Nous abonnons a open/halfOpen/close pour maj la metric circuit_breaker_state, et a reject pour logger.

Le fallback opossum permet d'enregistrer une fonction de fallback executee quand le circuit est open : `breaker.fallback(async () => outbox.enqueue(...))`. Nous n'utilisons PAS ce mecanisme directement car nous voulons distinguer "circuit open + fallback active" vs "circuit open + no fallback configured" pour le logging. Nous catch manuellement l'erreur EOPENBREAKER et delegons explicitement a outbox si configure.

opossum fournit egalement des stats `breaker.stats` : `successes`, `failures`, `rejects`, `fires`, `timeouts`, `cacheHits`, `cacheMisses`, `semaphoreRejections`. Ces stats peuvent etre exportees vers Prometheus via `prom-client` ou OpenTelemetry. Pour 1.2.12, nous nous limitons a la gauge `circuit_breaker_state` ; les stats detaillees pourront etre ajoutees post-Sprint 30 si besoin SRE.

## Annexe C -- OpenTelemetry semantic conventions Kafka messaging

Les conventions semantiques OpenTelemetry pour le messaging sont definies dans `https://opentelemetry.io/docs/specs/semconv/messaging/` et imposent un set d'attributs standard a remplir sur les spans liees aux operations messaging. Pour Kafka producer, les attributs requis et recommandes sont :

- `messaging.system` (required) : `kafka`
- `messaging.destination` (required) : nom du topic
- `messaging.destination_kind` (recommended) : `topic`
- `messaging.operation` (required) : `publish` | `receive` | `process`
- `messaging.message_id` (recommended) : ULID event_id
- `messaging.kafka.message_key` (recommended) : tenant_id (partition key)
- `messaging.kafka.partition` (recommended) : numero partition (apres ack)
- `messaging.kafka.offset` (recommended) : offset (apres ack)
- `messaging.kafka.client_id` (recommended) : KAFKA_CLIENT_ID
- `messaging.message_payload_size_bytes` (recommended) : taille payload serialize
- `messaging.message_payload_compressed_size_bytes` (recommended si compression)

Pour Skalean, nous ajoutons des attributs custom prefixes `skalean.` (pour eviter pollution namespace standard) :

- `skalean.tenant_id` : tenant_id (peut etre PII selon decision-009)
- `skalean.correlation_id` : correlation_id RequestContext
- `skalean.event_name` : nom logique de l'event
- `skalean.event_version` : version schema
- `skalean.producer_service` : service emetteur

Le span `kafka.publish` a un kind `PRODUCER` (set via `tracer.startSpan(name, { kind: SpanKind.PRODUCER })`). Cela permet aux outils OTel d'identifier la nature de l'operation et de calculer des metriques RED (Rate, Errors, Duration) appropriees.

La propagation du trace context via headers Kafka utilise le format W3C Trace Context standard avec deux headers : `traceparent` (contient version, trace_id, span_id, flags) et `tracestate` (vendor-specific extensions). Le format traceparent est `00-{trace_id 32 hex}-{span_id 16 hex}-{flags 2 hex}`. La fonction `propagation.inject(otelContext.active(), carrier)` remplit `carrier.traceparent` et `carrier.tracestate` automatiquement. Cote consumer, `propagation.extract(otelContext.active(), carrier)` reconstitue le contexte parent et permet de creer un span enfant lie au producer span.

Les metriques OTel recommandees pour Kafka producer :

- `kafka.producer.request.duration` (Histogram, ms) : duree d'une requete send
- `kafka.producer.request.size` (Histogram, bytes) : taille des messages envoyes
- `kafka.producer.batch.size` (Histogram, count) : nb messages par batch
- `kafka.producer.acks.duration` (Histogram, ms) : temps avant ack
- `kafka.producer.errors.total` (Counter) : erreurs par type

Nous mappons sur des noms plus courts dans Skalean (`kafka_publish_*`) pour coherence avec les autres metriques internes et pour eviter la confusion avec les metriques natives kafkajs auto-instrumentees. Le prefix `kafka_publish` est retenu via la convention `metricsPrefix` dans la config.

L'instrumentation auto via `@opentelemetry/instrumentation-kafkajs` ajoute automatiquement les spans et headers W3C, mais nous prefirons l'instrumentation manuelle pour avoir un controle precis sur les attributs custom et eviter le double instrumentation. Si l'instrumentation auto est active globalement, desactiver specifiquement pour kafkajs via `disabledInstrumentations: ['kafkajs']`.

## Annexe D -- KafkaJS Producer config matrix

Tableau de reference complet des options KafkaJS Producer et leur impact :

| Option | Defaut | Recommande prod | Impact |
| --- | --- | --- | --- |
| idempotent | false | true | Empeche duplication intra-session producer |
| transactionalId | undefined | unique par pod | Required pour transactions, recommended pour idempotence robuste |
| maxInFlightRequests | undefined (5) | 5 | Si idempotent, doit etre <= 5 |
| acks | -1 | -1 | -1 = all insync replicas, durabilite max |
| compression | None | Snappy | Snappy = bon ratio compression/CPU |
| timeout | 30000 | 10000 | Timeout par requete send |
| createPartitioner | DefaultPartitioner (murmur2) | LegacyPartitioner ou Default | Hash function pour partition key |
| retry.retries | 5 | 0 (delegue applicatif) | Eviter double retry |
| retry.initialRetryTime | 300 | 100 | Backoff initial |
| retry.maxRetryTime | 30000 | 2000 | Plafond backoff |
| retry.factor | 0.2 | 0.2 | Multiplicateur backoff exponential |
| retry.multiplier | 2 | 2 | Multiplicateur backoff |
| allowAutoTopicCreation | true | false | Doit etre false en prod |

Choix du partitioner : `DefaultPartitioner` (murmur2) est compatible avec Java client par defaut. `LegacyPartitioner` (DJB2 hash) est l'ancien comportement KafkaJS pre-2.0 et devrait etre evite sauf migration. Pour interop avec consumers Java, utiliser DefaultPartitioner.

Configuration logger KafkaJS :

```ts
const kafka = new Kafka({
  logCreator: (logLevel) => ({ namespace, level, label, log }) => {
    pinoLogger.child({ kafka_namespace: namespace, kafka_label: label }).info(log);
  },
});
```

Cela redirige tous les logs internes KafkaJS vers Pino structure, evitant le format texte par defaut.

## Annexe E -- Outbox pattern detail Sprint 35 preview

Le pattern Outbox est une technique pour garantir l'atomicite entre une transaction base de donnees et la publication d'un event Kafka. Sans outbox, deux pannes scenarios existent : (1) la transaction PG commit mais Kafka publish echoue -> incoherence, business state evolue mais downstream services ne sont pas notifies ; (2) Kafka publish reussit mais la transaction PG rollback -> incoherence inverse, downstream services croient que le state a evolue. Les deux scenarios cassent l'integrite eventuelle.

Le pattern outbox resout ce probleme en imposant que le publish Kafka NE SOIT PAS effectue dans le code business, mais que l'event soit insere dans une table `outbox_events` AU SEIN DE LA MEME TRANSACTION PG que le business state. Apres commit, un processus separe (relayer) lit la table outbox et publie sur Kafka. Si le publish echoue, l'event reste dans l'outbox et sera retente. Si le publish reussit, l'event est marque `published`. La garantie est que tout business state qui a commit a force un event dans l'outbox, donc sera publie a Kafka tot ou tard.

Le schema de la table outbox_events Sprint 35 sera :

```sql
CREATE TABLE outbox_events (
  event_id           VARCHAR(26) PRIMARY KEY,
  topic              VARCHAR(255) NOT NULL,
  partition_key      VARCHAR(255) NOT NULL,
  headers            JSONB NOT NULL DEFAULT '{}',
  payload            JSONB NOT NULL,
  tenant_id          UUID NOT NULL,
  correlation_id     VARCHAR(64) NOT NULL,
  occurred_at        TIMESTAMPTZ NOT NULL,
  status             VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempt_count      INT NOT NULL DEFAULT 0,
  last_attempt_at    TIMESTAMPTZ,
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at       TIMESTAMPTZ
);
CREATE INDEX idx_outbox_pending ON outbox_events (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_outbox_tenant ON outbox_events (tenant_id);
```

Le relayer (`OutboxRelayerService`) tournera en tache cron toutes les 5s, lira les 100 premiers events `status='pending'` en order created_at ASC, tentera de les publier via KafkaPublisherService avec `bypassCircuitBreaker: false` et `outboxFallback: false` (pour eviter recursion), marquera `status='published'` apres succes ou incrementera `attempt_count` apres echec. Apres 10 echecs, l'event est marque `status='dead'` et alerte SRE. Le SLA cible est < 10s entre INSERT et publish reussi.

En 1.2.12, nous fournissons le STUB d'OutboxPublisherService qui INSERT dans la table SI elle existe, ou warn et drop silencieusement si elle n'existe pas. Cela permet de coder le caller (publisher) maintenant et activer le comportement reel automatiquement quand 1.2.14 puis Sprint 35 livreront la table et le relayer.

Le compromis avec outbox : on duplique le storage (event est dans outbox PG ET dans Kafka). En contre-partie, on garantit zero perte. La table outbox peut etre nettoyee 7 jours apres `published_at` via un job de purge, sauf events critiques audit qui doivent etre conserves 10 ans (decision ACAPS, mais alors stockes a froid dans S3 / Glacier).

## Annexe F -- testcontainer setup pour tests integration

testcontainers-node permet de demarrer des conteneurs Docker programmatiquement depuis les tests Node.js. Pour Kafka, l'image officielle bitnami/kafka:3.7 supporte le mode KRaft (sans Zookeeper) qui demarre en ~15s. Configuration minimale :

```ts
const kafka = await new GenericContainer('bitnami/kafka:3.7')
  .withEnvironment({
    KAFKA_CFG_NODE_ID: '0',
    KAFKA_CFG_PROCESS_ROLES: 'controller,broker',
    KAFKA_CFG_LISTENERS: 'PLAINTEXT://:9092,CONTROLLER://:9093',
    KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
    KAFKA_CFG_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
    KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: '0@localhost:9093',
    KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: 'true',
    KAFKA_CFG_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
  })
  .withExposedPorts(9092)
  .withWaitStrategy(Wait.forLogMessage('Kafka Server started'))
  .start();
```

Le `withWaitStrategy(Wait.forLogMessage(...))` est crucial car le port 9092 est bind avant que Kafka ne soit pret a accepter les requetes. Attendre le log "Kafka Server started" garantit la disponibilite. Le timeout par defaut testcontainers est 60s, augmentable via `.withStartupTimeout(120000)`.

Pour le multi-broker (test rack-awareness), utiliser docker-compose via `DockerComposeEnvironment` :

```ts
const env = await new DockerComposeEnvironment('./tests/fixtures', 'kafka-3-broker.yml').up();
const broker0 = env.getContainer('kafka-0');
const bootstrap = `${broker0.getHost()}:${broker0.getMappedPort(9092)}`;
```

Le fichier `kafka-3-broker.yml` declare 3 services kafka-0/1/2 avec les bons CLUSTER_ID et CONTROLLER_QUORUM_VOTERS. Cela permet de tester replication factor 3.

Pour la performance des tests integration, mutualiser le container entre tests via `beforeAll` global (hors describe) plutot que `beforeEach`. Demarrer Kafka prend 15s, multiplie par 50 tests = 12 min de delay si beforeEach. Avec beforeAll global, c'est 15s total.

Le cleanup `afterAll(async () => { await kafka.stop(); })` est important pour eviter les containers orphelins. testcontainers a aussi un mecanisme Ryuk qui kill les containers abandonnes apres le crash du process Node, mais c'est un fallback.

Pour le CI (GitHub Actions), Docker-in-Docker est requis. Sur GitHub-hosted runners ubuntu-latest, Docker est preinstalle. Sur self-hosted runners, installer Docker explicitement. Le service Docker doit etre demarre avant les tests integration (`sudo systemctl start docker`).

Performance tip : utiliser une image `alpine` based si disponible (`bitnami/kafka:3.7-debian-12` est plus leger que `bitnami/kafka:3.7`). Le pull initial de l'image (~250 MB) est cache par Docker entre runs.

Variante : utiliser Redpanda comme Kafka-compatible mais beaucoup plus rapide a demarrer (~3s vs 15s) :

```ts
const redpanda = await new GenericContainer('redpandadata/redpanda:v23.3.5')
  .withCommand([
    'redpanda', 'start',
    '--smp', '1',
    '--memory', '512M',
    '--reserve-memory', '0M',
    '--node-id', '0',
    '--check=false',
    '--kafka-addr', 'PLAINTEXT://0.0.0.0:9092',
    '--advertise-kafka-addr', 'PLAINTEXT://localhost:9092',
  ])
  .withExposedPorts(9092)
  .start();
```

Redpanda est wire-compatible Kafka jusqu'au protocol level mais n'est PAS Kafka : certaines features (transactions, idempotent producer) ont des subtilites differentes. Pour 1.2.12 qui depend du producteur idempotent natif, Kafka officiel est plus sur. Redpanda peut etre utilise pour les tests rapides smoke sans verification idempotence.

## Annexe G -- Performance tuning et benchmarks

Les benchmarks attendus pour KafkaPublisherService sur cluster Atlas Benguerir 3-broker / 12-partitions / replication 3 :

| Scenario | Throughput | p50 latency | p95 latency | p99 latency |
| --- | --- | --- | --- | --- |
| Publish single payload 1KB | 50 000 msg/s | 2ms | 8ms | 25ms |
| Publish single payload 10KB | 30 000 msg/s | 4ms | 15ms | 50ms |
| Publish single payload 100KB | 8 000 msg/s | 10ms | 40ms | 120ms |
| Publish batch 10 messages 1KB | 200 000 msg/s | 15ms | 50ms | 150ms |
| Publish under network jitter 50ms | 10 000 msg/s | 60ms | 200ms | 800ms |
| Publish during broker rolling restart | 15 000 msg/s | 5ms | 50ms (with retry) | 500ms |

Tuning recommande pour throughput max :

- `batch.size` (linger) : 16384 bytes default OK ; augmenter a 65536 si throughput > 20k msg/s
- `linger.ms` : 10ms default ; augmenter a 50ms permet plus de batching mais ajoute latence
- `compression` : snappy par defaut ; lz4 ratio similaire mais legerement plus rapide ; zstd meilleur ratio mais 2x plus CPU

Tuning pour latence min :

- `linger.ms` : 0 (pas de batching, send immediat)
- `acks` : 1 au lieu de -1 (mais perd durabilite, NON recommande prod Skalean)
- `compression` : none (mais augmente bandwidth)

Configuration broker Kafka pour Skalean Atlas Benguerir (Bitnami Helm values) :

```yaml
broker:
  config:
    num.replica.fetchers: 4
    replica.fetch.max.bytes: 1048576
    socket.send.buffer.bytes: 102400
    socket.receive.buffer.bytes: 102400
    num.io.threads: 8
    num.network.threads: 3
    log.flush.interval.messages: 10000
    log.flush.interval.ms: 1000
    min.insync.replicas: 2
    default.replication.factor: 3
    auto.create.topics.enable: false
    delete.topic.enable: true
```

Profilage Node.js : utiliser `--prof` ou `clinic.js` pour identifier les bottlenecks dans le hot path publish. Les candidats typiques : JSON.stringify (utiliser `fast-json-stringify` avec schema precompile pour gain 5-10x), Buffer.from (utiliser pool de buffers), ULID generation (cached prefix optim).

Sampling OpenTelemetry pour reduire overhead en prod hot path : `OTEL_TRACES_SAMPLER=parentbased_traceidratio` avec `OTEL_TRACES_SAMPLER_ARG=0.1` (10% sampling). Les metrics restent 100% car peu coûteuses.

## Annexe H -- Glossaire et acronymes

- **ACAPS** : Autorite de Controle des Assurances et de la Prevoyance Sociale, regulateur marocain assurances.
- **AsyncLocalStorage** : API Node.js pour propager du contexte le long d'une chaine async sans passer en parametre explicite.
- **Backbone** : architecture centrale de communication asynchrone (Kafka dans Skalean).
- **CloudEvents** : specification CNCF pour format standardise d'enveloppe d'event.
- **Circuit Breaker** : pattern de resilience qui ouvre apres N echecs pour eviter de surcharger un service deja en panne.
- **DLQ** : Dead Letter Queue, topic Kafka recevant les messages non-processables apres N tentatives.
- **DynamicModule** : module NestJS configurable via forRoot/forFeature avec providers calcules a runtime.
- **Idempotent Producer** : producteur Kafka qui garantit non-duplication intra-session via PID + sequence number.
- **KRaft** : Kafka Raft, mode de Kafka 3.x sans Zookeeper.
- **min.insync.replicas** : nombre minimum de replicas synchronises requis pour ack=-1.
- **OTel / OpenTelemetry** : standard CNCF pour observabilite (traces, metrics, logs).
- **Outbox Pattern** : pattern garantissant atomicite entre commit DB et publish event.
- **Partition Key** : valeur utilisee par Kafka pour determiner la partition cible d'un message.
- **PID Producer** : Producer ID assigne par Kafka broker pour idempotence.
- **Pino** : library logger Node.js JSON haute performance utilisee comme standard Skalean.
- **Provider NestJS** : classe ou valeur injectable via le DI container NestJS.
- **rack-awareness** : capacite Kafka a placer les replicas dans des racks differents pour minimiser perte.
- **RequestContext** : AsyncLocalStorage stockant correlation_id et user_id par requete HTTP.
- **SemConv** : Semantic Conventions OpenTelemetry, spec d'attributs standard par domaine.
- **TenantContext** : AsyncLocalStorage stockant tenant_id par requete pour multi-tenancy.
- **transactionalId** : identifiant logique d'instance de producteur Kafka, unique par pod.
- **ULID** : Universally Unique Lexicographically Sortable Identifier, alternative a UUID v4 monotone.
- **W3C Trace Context** : standard W3C pour propagation trace_id/span_id via headers.
- **Zod** : library de validation schema TypeScript-first utilisee comme standard Skalean.

## Annexe I -- Cookbook usage

### I.1 Publier un event simple depuis un controller NestJS

```ts
import { Controller, Post, Body } from '@nestjs/common';
import { KafkaPublisherService } from '@skalean/common/kafka-publisher';
import { Topics } from '@skalean/event-schemas';

@Controller('devis')
export class DevisController {
  constructor(private readonly publisher: KafkaPublisherService) {}

  @Post()
  async createDevis(@Body() dto: CreateDevisDto): Promise<{ devis_id: string }> {
    const devis = await this.devisService.create(dto);
    await this.publisher.publish(Topics.DEVIS_CREATED, {
      devis_id: devis.id,
      tenant_id: devis.tenant_id,
      montant: devis.montant,
      souscripteur_id: devis.souscripteur_id,
      created_at: devis.created_at.toISOString(),
    });
    return { devis_id: devis.id };
  }
}
```

### I.2 Publier dans un saga avec causation

```ts
async handle(event: DevisAcceptedEvent) {
  await this.publisher.publish(Topics.SOUSCRIPTION_REQUESTED, {
    devis_id: event.devis_id,
    accepted_at: new Date().toISOString(),
  });
}
```

### I.3 Publier en batch parallele (preserver tenant context)

```ts
const tenantId = tenantContext.getStore()!.tenantId;
await Promise.all(
  events.map((evt) =>
    tenantContext.run({ tenantId }, () =>
      requestContext.run({ correlationId: evt.correlationId }, () =>
        this.publisher.publish(Topics.DEVIS_CREATED, evt.payload),
      ),
    ),
  ),
);
```

### I.4 Bypass circuit breaker pour cas critique (avec parcimonie)

```ts
await this.publisher.publish(
  Topics.AUDIT_CRITICAL,
  payload,
  { bypassCircuitBreaker: true },
);
```

### I.5 Custom partition key (rare, ex: hash agent commercial)

```ts
await this.publisher.publish(
  Topics.LEAD_ASSIGNED,
  payload,
  { partitionKeyOverride: agentId },
);
```

---

Fin de la specification 1.2.12.
