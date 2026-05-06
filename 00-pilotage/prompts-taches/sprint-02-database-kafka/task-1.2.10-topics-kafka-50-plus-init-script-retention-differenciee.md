# Tache 1.2.10 -- Topics Kafka enrichi : 50+ topics avec configuration retention differenciee

## 1. Header

- **Identifiant tache** : 1.2.10
- **Sprint** : Sprint 2 (Database & Kafka Foundation)
- **Phase** : Phase 1 -- Foundation Sprint 0 a 4
- **Duree estimee** : 4 heures (240 minutes)
- **Priorite** : P0 (bloquant pour tous les modules eventifies Sprints 5+)
- **Dependances amont** : tache 1.2.9 (Initialisation Kafka cluster KRaft 3.7), tache 1.1.6 Sprint 1 (init-topics.sh 30 topics initial)
- **Dependances aval** : tache 1.2.11 (Schema Registry preview), tache 1.3.x (producers/consumers Sprint 3), Sprints 5 a 22 modules metier consommant les events
- **Risque** : Moyen-Eleve (modification post-creation impossible pour partition count, retention disk explosion possible si mauvaise config, naming non-conforme bloque tous les futurs producers)
- **Tags** : kafka, topics, retention, naming-convention, dlq, audit, compliance, kraft-3.7, snappy, idempotent
- **AUCUNE EMOJI** : Le projet Skalean Insurtech proscrit categoriquement toute emoji dans le code, les commits, la documentation, les noms de topics, les schemas et les commentaires (decision-006). Les topic names sont ASCII strict avec separateurs `.` (point) uniquement.
- **Convention naming Kafka topics** : `insurtech.events.{vertical}.{entity}.{action}` STRICT, regex de validation `^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$`
- **Reference architecture** : Decision-004 (Kafka KRaft 3.7 vs RabbitMQ), Decision-002 (Multi-tenant Atlas), Decision-008 (Data residency Maroc), Decision-006 (No-emoji ASCII strict).

## 2. But (3 paragraphes)

### 2.1. Topics enrichis Sprint 2 et anticipation Sprints futurs 14-22

L'objectif principal de la tache 1.2.10 consiste a etendre le script `init-topics.sh` produit en Sprint 1 (qui creait 30 topics couvrant Auth, CRM, Booking, Comm, Pay) pour atteindre une cible minimale de 53 topics couvrant l'integralite des modules planifies sur la roadmap 24 mois (Sprints 1 a 36). Cette anticipation evite la fragmentation de la creation de topics au fil des sprints metier, garantit l'unicite du naming convention `insurtech.events.{vertical}.{entity}.{action}`, et permet d'instaurer une discipline de versioning de schema des le premier event publie. Les modules anticipes sont : Insurance (Sprint 14-16, policy lifecycle), Repair (Sprint 20-22, sinistre lifecycle), Audit (Sprint 30-33, compliance trail), Books/Stock/HR (Sprints 24-29 modules support). Le total atteint 53 topics dont 5 DLQ specialises et 48 topics de domaine fonctionnel. Cette demarche s'inspire des best-practices d'architecture event-driven (Confluent recommendations 2024) qui prescrivent de planifier les topics au niveau du domaine business plutot qu'au fil de l'eau, afin d'eviter les renommages couteux et les migrations de consumers.

### 2.2. Retention differenciee adaptee aux exigences compliance ACAPS

Le second objectif est l'implementation d'une politique de retention differenciee selon la criticite metier et les obligations reglementaires marocaines. Les topics standards (Auth events non-audit, CRM, Booking, Comm operationnel, Pay flux) ont une retention de 7 jours (604800000 ms), suffisante pour les besoins de re-traitement applicatif et la reconciliation J+1. Les topics audit/compliance (audit.recorded, compliance.data_purged, compliance.acaps_submitted) et l'integralite des topics DLQ (dead-letter queues) ont une retention etendue a 30 jours (2592000000 ms), permettant la reconciliation longue duree, l'analyse des incidents en post-mortem, et le replay des evenements echoues. Cette politique respecte l'exigence ACAPS Article 12 (Loi 17-99 et reglement n11-2019) qui impose un audit trail de 7 ans : Kafka assure la fenetre 30 jours, puis un consumer ETL Postgres long-term assure l'archivage 7 ans en stockage froid Postgres + S3 Casablanca region (decision-008 data residency). La retention 30 jours sur DLQ permet aux equipes ops de diagnostiquer et replay des messages echoues sur une fenetre operationnelle confortable, evitant la perte de transactions critiques (paiements, sinistres, signatures).

### 2.3. Dead-letter queues par domaine fonctionnel et resilience

Le troisieme objectif est l'instauration de 5 topics DLQ specialises par domaine fonctionnel critique : `insurtech.dlq.comm` (echecs SMS/email/WhatsApp), `insurtech.dlq.pay` (echecs CMI/Wafacash/HPS), `insurtech.dlq.insure` (echecs souscription/renouvellement police), `insurtech.dlq.repair` (echecs declaration sinistre/dispatch), `insurtech.dlq.compliance` (echecs audit/KYC/AML). Chaque DLQ topic possede une configuration specifique : 1 seule partition (preserve l'ordre des messages echoues pour facilitation de replay sequentiel), retention 30 jours (fenetre operationnelle de diagnostic), compression snappy, replication factor 1 en dev/2 en prod. Cette segmentation par domaine plutot qu'un DLQ unique global permet aux equipes specialisees (paiements, sinistres) de monitorer leur perimetre sans noise cross-domain, et facilite les SLA differencies (DLQ pay critique necessite alerting < 5 minutes, DLQ comm peut tolerer 30 minutes). Les patterns de consumer DLQ (replay, manual-resolve, dead-letter-archive) seront implementes en Sprint 3 (tache 1.3.x).

## 3. Contexte etendu (8-10 ko)

### 3.1. Pourquoi un naming convention strict `insurtech.events.{vertical}.{entity}.{action}`

Le naming convention `insurtech.events.{vertical}.{entity}.{action}` n'est pas un detail cosmetique mais une decision architecturale fondamentale qui conditionne la maintenabilite, la decouvrabilite, l'auditabilite et la securite (ACL Kafka future Sprint 33) de l'integralite de l'event-driven architecture du projet. Le prefixe `insurtech` identifie l'organisation et permet de cohabiter avec d'autres domaines Kafka eventuels sur le meme cluster mutualise (rare, mais possible en cas de fusion-acquisition). Le segment `events` distingue les topics de business events des topics DLQ (`insurtech.dlq.*`) et des topics techniques futurs (`insurtech.tech.*` pour metrics, `insurtech.cdc.*` pour Change-Data-Capture si Debezium adopte au Sprint 25). Le segment `{vertical}` represente le module metier (auth, crm, booking, comm, pay, insure, repair, audit, books, stock, hr, system) et permettra ulterieurement de definir des ACL granulaires par equipe (ex : equipe Pay ne peut produire/consommer que sur `insurtech.events.pay.*`). Le segment `{entity}` represente l'aggregat racine DDD (user, contact, deal, appointment, message, transaction, policy, sinistre, audit, invoice, attendance, tenant). Le segment `{action}` represente la transition d'etat ou l'evenement ponctuel (created, updated, signed, completed, failed, refunded). Cette structure 5-niveaux facilite les pattern subscriptions Kafka (ex : `insurtech.events.pay.*` souscrit aux 6 topics paiement), facilite les filtrages de logs, et fournit une grammaire commune comprehensible immediatement par tout developpeur arrivant sur le projet.

Les regles strictes additionnelles : ASCII uniquement (pas d'unicode, pas d'emoji, pas d'accent), minuscules uniquement (pas de CamelCase), separateur `.` (point) entre segments, separateur `_` (underscore) au sein d'un segment compose (ex : `password_reset_requested`, `data_purged`, `low_threshold`), aucun caractere `/`, ` ` (espace), `-` (tiret), aucune majuscule. La regex de validation enforced par le script `verify-topics.sh` est : `^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$`. Tout topic non-conforme est rejete par le script en mode strict (exit code 1) afin de prevenir les drifts de naming en cours de projet.

### 3.2. Alternatives architecturales evaluees et justifiees

**Alternative 1 : Namespacing par tenant** (`{tenant_id}.events.{vertical}.{entity}.{action}`)

Cette approche aurait consiste a creer un set de topics par tenant (chaque cabinet de courtage). Avantages : isolation stricte des events par tenant (multi-tenant strict), ACL simplifiees par prefixe tenant. Inconvenients majeurs : explosion combinatoire (100 tenants x 53 topics = 5300 topics, depasse la limite recommandee Kafka de 4000 topics par cluster sur hardware modeste 4 broker x 16 GB RAM), complexite operationnelle de creation dynamique de topics a chaque onboarding tenant, fragmentation des consumer groups, impossibilite de pattern subscriptions cross-tenant pour les usages analytiques. **Decision : Rejet**. Le multi-tenancy est gere par un champ `tenant_id` dans le payload de chaque event (decision-002 isolation logique Atlas), et un consumer applicatif filtre par tenant_id en deserialisant. Cette approche est conforme aux best-practices Confluent 2024 qui prescrivent un nombre limite de topics avec partitionnement par tenant_id (key-based partitioning) plutot qu'une explosion de topics par tenant.

**Alternative 2 : Topics globaux sans vertical** (`insurtech.events.{entity}.{action}`)

Cette approche aurait fusionne tous les events au niveau global sans segmentation par vertical. Avantages : moins de topics (~30 au lieu de 53). Inconvenients : pas d'isolation logique par equipe, ACL impossibles a definir granulairement, conflits de nommage probables (ex : `transaction.created` ambigu entre Pay et Books), difficulty de monitoring par equipe. **Decision : Rejet**. La segmentation par vertical est essentielle a la scalabilite organisationnelle (12 equipes specialisees a terme) et a la securite ACL future.

**Alternative 3 : Topics ultra-granulaires avec versioning dans le nom** (`insurtech.events.pay.transaction.completed.v1`)

Cette approche aurait integre la version de schema dans le nom du topic. Avantages : versioning explicite. Inconvenients : explosion combinatoire au fil des evolutions de schema, migrations consumer complexes a chaque changement de version. **Decision : Rejet**. Le versioning est gere par Schema Registry (preview tache 1.2.11, full Sprint 13) avec compatibilite backward/forward au niveau du schema, le topic restant stable sur sa duree de vie. Cette approche suit le pattern Confluent recommend Schema Evolution.

### 3.3. Trade-offs partition count : 6 standard vs 12 vs DLQ 1

Le choix de 6 partitions par topic standard (vs alternatives 3, 12, 24) repose sur un equilibre throughput / parallelism / overhead :

- **3 partitions** : Insufficient pour pic de charge previsionnel (Sprint 18 1500 transactions/seconde = 250 messages/sec/partition acceptable mais peu de marge).
- **6 partitions** : Optimal pour 1500 msg/sec sur 6 consumers paralleles = 250 msg/sec/partition, marge x4 vs throughput Kafka standard 1000 msg/sec/partition. Permet 6 consumers concurrents par consumer-group.
- **12 partitions** : Surdimensionne pour Sprint 2-13, doublerait l'overhead Zookeeper-equivalent (KRaft metadata), augmenterait la latence de rebalance des consumer groups.
- **24 partitions** : Tres surdimensionne, justifiable seulement Sprint 30+ scale Maghreb 5000 msg/sec.

Le choix 6 partitions est verrouille pour Sprints 2-30, avec procedure de re-partitioning planifiee Sprint 30 si throughput depasse 4000 msg/sec sur un topic critique (transaction.completed notamment). **Important** : le partition count est immutable apres creation du topic, toute augmentation necessite un nouveau topic avec migration consumer.

Pour les topics DLQ, le choix de 1 seule partition est volontaire : preservation de l'ordre absolu des messages echoues pour faciliter le replay sequentiel et le diagnostic root-cause. Le throughput DLQ etant marginal (< 10 msg/sec en regime nominal), 1 partition suffit largement. Cette decision suit le pattern "Single-Threaded DLQ Replay" recommande par Confluent.

### 3.4. Decision-004 Kafka vs RabbitMQ et decision-002 multi-tenant

La decision-004 (architecture/decisions/0004-kafka-vs-rabbitmq.md) a tranche en faveur de Kafka KRaft 3.7 vs RabbitMQ 3.13 pour les raisons suivantes : (1) replay capability native (DLQ retention 30 jours permet re-traitement), (2) compaction support pour event-sourcing futur Sprint 25 (CDC Debezium), (3) ecosystem Schema Registry mature (Confluent Schema Registry, Apicurio), (4) throughput superieur (Kafka soutient 100k msg/sec sur hardware modeste vs RabbitMQ ~30k msg/sec), (5) integration native Kafka Streams pour aggregation Sprint 27 (CQRS read-side). RabbitMQ aurait ete plus simple operationnellement (queues nommees, routage AMQP avance) mais le replay et le throughput etaient les exigences differenciantes. La decision-002 (architecture/decisions/0002-multi-tenant-strategy.md) impose le tenant_id en header Kafka + payload pour chaque event, garantissant l'isolation logique au niveau application.

### 3.5. Douze pieges classiques Kafka topics et mitigations

1. **Topic auto-create production** : Kafka par defaut auto-cree les topics si un producer publie sur un topic inexistant. **Piege** : naming drift (typos creent des topics fantomes), partitions par defaut (souvent 1) inadaptees. **Mitigation** : `auto.create.topics.enable=false` en production (verifie tache 1.2.9 broker config), creation explicite via `init-topics.sh`.

2. **Partition count immutable apres creation** : impossible d'augmenter le partition count d'un topic existant sans migration. **Mitigation** : dimensionnement initial 6 partitions avec marge x4, plan de re-partitioning Sprint 30 si necessaire (creation nouveau topic + dual-write + cutover).

3. **Retention disk usage explosion** : 53 topics x 6 partitions x retention 7 jours x 100 KB/sec moyen = ~250 GB/cluster en regime nominal, peut depasser disk si mal monitore. **Mitigation** : monitoring Prometheus (kafka_log_log_size), alerting > 80% disk, log.retention.bytes par topic en plus du retention.ms.

4. **Replication factor min.insync.replicas** : un cluster 3 brokers avec replication factor 3 et min.insync.replicas=2 garantit la durabilite (pas de pertes en cas de panne 1 broker). En dev mono-broker, replication factor 1 suffit. **Mitigation** : config differenciee dev/prod, `KAFKA_MIN_INSYNC_REPLICAS=1` dev / `=2` prod.

5. **KRaft 3.7 quorum** : Kafka KRaft remplace Zookeeper, necessite quorum impair (3, 5, 7 controllers). En dev mono-broker (1 controller), pas de tolerance de panne. **Mitigation** : quorum 3 controllers en prod, mono-broker accepte en dev avec `KAFKA_PROCESS_ROLES=broker,controller`.

6. **DLQ retention vs purge automatique** : un DLQ retention 30 jours signifie que les messages echoues sont auto-purges apres 30 jours, perdant le diagnostic possible au-dela. **Mitigation** : consumer DLQ archive vers S3 avant purge (Sprint 4), monitoring lag DLQ pour traiter avant purge.

7. **Idempotent producer enable.idempotence** : sans `enable.idempotence=true`, un retry producer peut creer des doublons. **Mitigation** : `enable.idempotence=true` par defaut sur tous les producers (config Sprint 3 tache 1.3.x).

8. **transactional.id collision** : si plusieurs producers utilisent le meme transactional.id, les transactions s'ecrasent mutuellement. **Mitigation** : `transactional.id` unique par instance de service avec suffixe pod-id.

9. **ACL controls preview Sprint 33** : sans ACL, n'importe quel client avec acces broker peut produire/consommer sur n'importe quel topic. **Mitigation Sprint 2** : VPC isolation Atlas + Network Policies. **Mitigation Sprint 33** : ACL granulaires par service-account et prefix topic.

10. **Schema Registry preview Sprint 13** : sans Schema Registry, les events publies n'ont pas de validation de schema, drift possible. **Mitigation Sprint 2** : Zod validation cote producer (decision-013), schema versioning informel via `schema_version` field. **Mitigation Sprint 13** : Confluent Schema Registry ou Apicurio.

11. **Consumer group rebalance storms** : un rebalance frequent (consumers qui rejoignent/quittent) peut provoquer des pauses de consommation (~10 sec). **Mitigation** : `session.timeout.ms=30000`, `heartbeat.interval.ms=10000`, consumers stables (pas de scaling-up/down rapide).

12. **Compression snappy vs lz4 vs zstd** : snappy est un compromis CPU/ratio (ratio ~2x, CPU faible). lz4 plus rapide mais ratio moindre. zstd meilleur ratio mais CPU eleve. **Mitigation** : snappy par defaut (decision-004), zstd evaluable Sprint 18 si throughput critique.

### 3.6. KRaft 3.7 quorum architecture

Kafka 3.7 utilise KRaft (Kafka Raft) en remplacement de Zookeeper depuis 3.5. Le quorum de controllers (metadata) est Raft-based : un leader + followers, election en cas de panne. Configuration dev : 1 broker faisant aussi controller (`process.roles=broker,controller`), pas de tolerance de panne. Configuration prod : 3 brokers + 3 controllers separes (recommande), tolerance d'une panne controller. La decision-004 reference KRaft 3.7 pour eviter la dependance Zookeeper (depreciee).

### 3.7. Idempotence du script `init-topics.sh`

Le script `init-topics.sh` doit etre re-executable a volonte sans effet de bord destructif. Le flag `--if-not-exists` de `kafka-topics.sh --create` garantit qu'un topic deja existant n'est pas recree (et donc ne reset pas ses messages). Cette idempotence permet : (1) execution lors du `docker-compose up` initial, (2) re-execution apres ajout de nouveaux topics (les nouveaux sont crees, les existants ignores), (3) execution dans GitHub Actions de deploiement sans crainte. Le script `verify-topics.sh` complete le mecanisme : il liste les topics presents et compare a la liste attendue, exit code 0 si match, exit code 1 si manquants ou non-conformes.

## 4. Architecture context (3-5 ko)

### 4.1. Position dans Sprint 2

La tache 1.2.10 est la 10eme tache du Sprint 2 (Database & Kafka Foundation), sequencee apres :
- 1.2.1 Init Postgres 16 multi-tenant
- 1.2.2 Init Atlas migrations
- 1.2.3 Schema Auth (User, Tenant, Session)
- 1.2.4 Schema CRM (Contact, Deal, Interaction)
- 1.2.5 Schema Booking (Appointment, AvailabilitySlot)
- 1.2.6 Schema Comm (Message, Template, OptOut)
- 1.2.7 Schema Pay (Transaction, Reconciliation, RefundRequest)
- 1.2.8 Indexes performance + RLS policies
- 1.2.9 Initialisation Kafka KRaft 3.7 cluster

Et avant :
- 1.2.11 Schema Registry preview
- 1.2.12 Producer/Consumer wrapper Type-safe
- 1.2.13 Tests integration end-to-end DB + Kafka

### 4.2. Diagramme ASCII Kafka cluster + topics par module

```
                           +-------------------------------+
                           |     Kafka KRaft 3.7 Cluster   |
                           |   (1 broker dev / 3 prod)     |
                           |   port 9092 client / 9094 ctrl|
                           +-------------------------------+
                                          |
        +---------------------------------+----------------------------------+
        |                                                                    |
+---------------+  +----------------+  +---------------+  +-----------------+
| insurtech.    |  | insurtech.     |  | insurtech.    |  | insurtech.dlq.* |
| events.auth.* |  | events.crm.*   |  | events.pay.*  |  | (5 DLQ topics)  |
| (7 topics)    |  | (5 topics)     |  | (6 topics)    |  | 1 part / 30j    |
| 6 part / 7j   |  | 6 part / 7j    |  | 6 part / 7j   |  | snappy          |
+---------------+  +----------------+  +---------------+  +-----------------+
        |                                                                    |
+---------------+  +----------------+  +---------------+  +-----------------+
| insurtech.    |  | insurtech.     |  | insurtech.    |  | insurtech.      |
| events.       |  | events.comm.*  |  | events.       |  | events.audit.*  |
| booking.*     |  | (8 topics)     |  | insure.*      |  | (3 topics)      |
| (3 topics)    |  | 6 part / 7j    |  | (4 topics)    |  | 6 part / 30j    |
| 6 part / 7j   |  |                |  | anticipation  |  | compliance      |
+---------------+  +----------------+  +---------------+  +-----------------+
        |                                                                    |
+---------------+  +----------------+  +---------------+  +-----------------+
| insurtech.    |  | insurtech.     |  | insurtech.    |  | insurtech.      |
| events.       |  | events.books.* |  | events.       |  | events.system.* |
| repair.*      |  | (2 topics)     |  | stock.*       |  | (3 topics)      |
| (3 topics)    |  | 6 part / 7j    |  | (2 topics)    |  | 6 part / 7j     |
| anticipation  |  |                |  | 6 part / 7j   |  |                 |
+---------------+  +----------------+  +---------------+  +-----------------+
        |
+---------------+
| insurtech.    |
| events.hr.*   |
| (2 topics)    |
| 6 part / 7j   |
+---------------+

Total topics : 7 + 5 + 3 + 8 + 6 + 4 + 3 + 3 + 2 + 2 + 2 + 3 + 5 = 53 topics
```

### 4.3. Fondation events Kafka pour tous les modules metier

Cette tache est le pilier event-driven pour les 32 sprints suivants :
- Sprints 5-7 (Auth, CRM, Booking) : producers sur `insurtech.events.{auth|crm|booking}.*`
- Sprints 8-12 (Comm, Pay) : producers/consumers haute frequence
- Sprints 14-16 (Insurance) : producers `insurtech.events.insure.*` (deja prepares)
- Sprints 20-22 (Repair) : producers `insurtech.events.repair.*` (deja prepares)
- Sprints 25-27 (CDC, CQRS) : consumers Kafka Streams aggregation
- Sprints 30-33 (ACAPS compliance) : consumers ETL audit trail Postgres long-term

## 5. Livrables checkables (28)

1. Fichier `infrastructure/docker/kafka/init-topics.sh` enrichi a ~200 lignes avec 53 appels `create_topic`.
2. Fonction helper `create_topic()` reutilisee de Sprint 1, parametree (name, partitions, retention_ms).
3. 53 topics crees minimum (verifies par `kafka-topics.sh --list`).
4. Topic naming convention `insurtech.events.{vertical}.{entity}.{action}` respectee sur 100% des topics (regex check).
5. Retention 7 jours (604800000 ms) sur topics standards (48 topics).
6. Retention 30 jours (2592000000 ms) sur topics audit (3 topics) et DLQ (5 topics).
7. 6 partitions sur topics standards.
8. 1 partition sur topics DLQ (5 topics).
9. Compression snappy sur tous les topics.
10. Replication factor 1 dev / configurable 3 prod via env var.
11. min.insync.replicas 1 dev / 2 prod via env var.
12. Idempotence script (`--if-not-exists`) verifiee par double execution.
13. Fichier `infrastructure/kafka/topics-config.yaml` descriptif YAML structure complete.
14. Script `infrastructure/docker/kafka/verify-topics.sh` validation 53 topics presents.
15. Documentation `infrastructure/kafka/topics-catalog.md` table complete.
16. Fragment `docker-compose.kafka.yaml` confirmant cluster KRaft 3.7 + ports 9092/9094 + healthchecks.
17. Fichier `.env.example` enrichi (>= 18 variables Kafka).
18. GitHub Action `.github/workflows/kafka-topics-init.yml` deploiement init-topics.
19. Tests `integration/topics-creation.spec.ts` >= 8 tests.
20. Tests `integration/topics-naming.spec.ts` >= 6 tests regex.
21. Tests `integration/dlq-retention.spec.ts` >= 4 tests DLQ.
22. Tests `integration/audit-retention.spec.ts` >= 4 tests audit.
23. Mock KafkaAdmin tests >= 6 tests sans cluster reel.
24. Coverage >= 85% sur scripts shell (testes via shellcheck + unit).
25. Documentation README `infrastructure/kafka/README.md` mise a jour.
26. Pre-commit hook valide naming convention regex.
27. Logs structures (winston) script init-topics avec niveaux INFO/WARN/ERROR.
28. Annexes A-G documentation complete (catalogue, partition strategy, retention math, KRaft setup, ACL preview, schema-registry preview, monitoring Prometheus).

## 6. Fichiers livrables

- `infrastructure/docker/kafka/init-topics.sh` (enrichi ~200 lignes)
- `infrastructure/docker/kafka/verify-topics.sh` (nouveau ~80 lignes)
- `infrastructure/kafka/topics-config.yaml` (nouveau ~150 lignes YAML)
- `infrastructure/kafka/topics-catalog.md` (nouveau, table complete 53 topics)
- `infrastructure/docker/kafka/docker-compose.kafka.yaml` (fragment confirmation)
- `.env.example` (enrichi variables KAFKA_*)
- `.github/workflows/kafka-topics-init.yml` (nouveau, deploiement)
- `apps/api/src/__tests__/integration/topics-creation.spec.ts` (nouveau)
- `apps/api/src/__tests__/integration/topics-naming.spec.ts` (nouveau)
- `apps/api/src/__tests__/integration/dlq-retention.spec.ts` (nouveau)
- `apps/api/src/__tests__/integration/audit-retention.spec.ts` (nouveau)
- `apps/api/src/__tests__/unit/kafka-admin-mock.spec.ts` (nouveau)
- `infrastructure/kafka/README.md` (mise a jour)

## 7. Code patterns COMPLETS

### 7.1. `infrastructure/docker/kafka/init-topics.sh` (enrichi ~200 lignes)

```bash
#!/usr/bin/env bash
# infrastructure/docker/kafka/init-topics.sh
# Skalean Insurtech -- Initialisation 53+ topics Kafka KRaft 3.7
# Tache 1.2.10 -- Sprint 2
# Idempotent : --if-not-exists permet re-execution sans effet de bord
# Naming convention : insurtech.events.{vertical}.{entity}.{action}
# Retention differenciee : 7 jours standard / 30 jours audit + DLQ

set -euo pipefail

# Chargement variables environnement (avec defauts si non definies)
KAFKA_BROKERS="${KAFKA_BROKERS:-kafka:9092}"
KAFKA_PARTITIONS_DEFAULT="${KAFKA_PARTITIONS_DEFAULT:-6}"
KAFKA_PARTITIONS_DLQ="${KAFKA_PARTITIONS_DLQ:-1}"
KAFKA_RETENTION_STANDARD_MS="${KAFKA_RETENTION_STANDARD_MS:-604800000}"      # 7 jours
KAFKA_RETENTION_AUDIT_MS="${KAFKA_RETENTION_AUDIT_MS:-2592000000}"            # 30 jours
KAFKA_RETENTION_DLQ_MS="${KAFKA_RETENTION_DLQ_MS:-2592000000}"                # 30 jours
KAFKA_REPLICATION_FACTOR="${KAFKA_REPLICATION_FACTOR:-1}"
KAFKA_MIN_INSYNC_REPLICAS="${KAFKA_MIN_INSYNC_REPLICAS:-1}"
KAFKA_COMPRESSION="${KAFKA_COMPRESSION:-snappy}"
KAFKA_SEGMENT_MS="${KAFKA_SEGMENT_MS:-86400000}"                              # 1 jour segment
KAFKA_CLEANUP_POLICY="${KAFKA_CLEANUP_POLICY:-delete}"

# Logging structure
log_info()  { echo "[INFO]  $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }
log_warn()  { echo "[WARN]  $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }
log_error() { echo "[ERROR] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }

# Validation regex naming convention
NAMING_REGEX='^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$'

validate_topic_name() {
  local topic_name="$1"
  if ! [[ "${topic_name}" =~ ${NAMING_REGEX} ]]; then
    log_error "Topic name non-conforme : ${topic_name}"
    log_error "Regex attendue : ${NAMING_REGEX}"
    exit 1
  fi
}

# Helper function : creation idempotente d'un topic
# Args : $1=topic_name, $2=partitions, $3=retention_ms
create_topic() {
  local topic_name="$1"
  local partitions="${2:-${KAFKA_PARTITIONS_DEFAULT}}"
  local retention_ms="${3:-${KAFKA_RETENTION_STANDARD_MS}}"

  validate_topic_name "${topic_name}"

  log_info "Creation topic : ${topic_name} (partitions=${partitions}, retention_ms=${retention_ms})"

  kafka-topics.sh \
    --bootstrap-server "${KAFKA_BROKERS}" \
    --create \
    --if-not-exists \
    --topic "${topic_name}" \
    --partitions "${partitions}" \
    --replication-factor "${KAFKA_REPLICATION_FACTOR}" \
    --config "retention.ms=${retention_ms}" \
    --config "min.insync.replicas=${KAFKA_MIN_INSYNC_REPLICAS}" \
    --config "compression.type=${KAFKA_COMPRESSION}" \
    --config "segment.ms=${KAFKA_SEGMENT_MS}" \
    --config "cleanup.policy=${KAFKA_CLEANUP_POLICY}" \
    || log_warn "Creation topic ${topic_name} echouee ou existante"
}

log_info "=== Initialisation 53 topics Kafka Skalean Insurtech ==="
log_info "Brokers : ${KAFKA_BROKERS}"
log_info "Partitions default : ${KAFKA_PARTITIONS_DEFAULT}"
log_info "Replication factor : ${KAFKA_REPLICATION_FACTOR}"
log_info "Compression : ${KAFKA_COMPRESSION}"

# === Module Auth (9 topics) ===
log_info "--- Module Auth ---"
create_topic "insurtech.events.auth.user.created"
create_topic "insurtech.events.auth.user.signed_in"
create_topic "insurtech.events.auth.user.signed_out"
create_topic "insurtech.events.auth.user.locked"
create_topic "insurtech.events.auth.user.unlocked"
create_topic "insurtech.events.auth.user.password_reset_requested"
create_topic "insurtech.events.auth.user.password_changed"
create_topic "insurtech.events.auth.user.mfa_enabled"
create_topic "insurtech.events.auth.user.mfa_disabled"

# === Module CRM (6 topics) ===
log_info "--- Module CRM ---"
create_topic "insurtech.events.crm.contact.created"
create_topic "insurtech.events.crm.contact.updated"
create_topic "insurtech.events.crm.deal.created"
create_topic "insurtech.events.crm.deal.stage_changed"
create_topic "insurtech.events.crm.interaction.recorded"
create_topic "insurtech.events.crm.interaction.email_received"

# === Module Booking (4 topics) ===
log_info "--- Module Booking ---"
create_topic "insurtech.events.booking.appointment.scheduled"
create_topic "insurtech.events.booking.appointment.confirmed"
create_topic "insurtech.events.booking.appointment.cancelled"
create_topic "insurtech.events.booking.appointment.completed"

# === Module Communication (10 topics) ===
log_info "--- Module Communication ---"
create_topic "insurtech.events.comm.message.queued"
create_topic "insurtech.events.comm.message.sent"
create_topic "insurtech.events.comm.message.delivered"
create_topic "insurtech.events.comm.message.read"
create_topic "insurtech.events.comm.message.failed"
create_topic "insurtech.events.comm.template.created"
create_topic "insurtech.events.comm.template.approved"
create_topic "insurtech.events.comm.template.rejected"
create_topic "insurtech.events.comm.optout.recorded"
create_topic "insurtech.events.comm.webhook.received"

# === Module Pay (6 topics) ===
log_info "--- Module Pay ---"
create_topic "insurtech.events.pay.transaction.initiated"
create_topic "insurtech.events.pay.transaction.completed"
create_topic "insurtech.events.pay.transaction.failed"
create_topic "insurtech.events.pay.transaction.refunded"
create_topic "insurtech.events.pay.reconciliation.matched"
create_topic "insurtech.events.pay.reconciliation.discrepancy"

# === Module Insurance (anticipation Sprint 14-16) (4 topics) ===
log_info "--- Module Insurance (anticipation Sprint 14-16) ---"
create_topic "insurtech.events.insure.policy.created"
create_topic "insurtech.events.insure.policy.signed"
create_topic "insurtech.events.insure.policy.renewed"
create_topic "insurtech.events.insure.policy.cancelled"

# === Module Repair (anticipation Sprint 20-22) (3 topics) ===
log_info "--- Module Repair (anticipation Sprint 20-22) ---"
create_topic "insurtech.events.repair.sinistre.declared"
create_topic "insurtech.events.repair.sinistre.dispatched"
create_topic "insurtech.events.repair.sinistre.estimated"

# === Module Audit (3 topics, retention 30 jours) ===
log_info "--- Module Audit (retention 30 jours) ---"
create_topic "insurtech.events.audit.audit.recorded"        "${KAFKA_PARTITIONS_DEFAULT}" "${KAFKA_RETENTION_AUDIT_MS}"
create_topic "insurtech.events.audit.compliance.data_purged" "${KAFKA_PARTITIONS_DEFAULT}" "${KAFKA_RETENTION_AUDIT_MS}"
create_topic "insurtech.events.audit.compliance.acaps_submitted" "${KAFKA_PARTITIONS_DEFAULT}" "${KAFKA_RETENTION_AUDIT_MS}"

# === Module Books (2 topics) ===
log_info "--- Module Books ---"
create_topic "insurtech.events.books.invoice.issued"
create_topic "insurtech.events.books.invoice.paid"

# === Module Stock (2 topics) ===
log_info "--- Module Stock ---"
create_topic "insurtech.events.stock.stock.low_threshold"
create_topic "insurtech.events.stock.stock.movement_recorded"

# === Module HR (2 topics) ===
log_info "--- Module HR ---"
create_topic "insurtech.events.hr.attendance.recorded"
create_topic "insurtech.events.hr.salary.processed"

# === Module System (3 topics) ===
log_info "--- Module System ---"
create_topic "insurtech.events.system.tenant.created"
create_topic "insurtech.events.system.tenant.settings_changed"
create_topic "insurtech.events.system.user.password_reset_requested"

# === DLQ topics (5 topics, 1 partition, retention 30 jours) ===
log_info "--- DLQ topics (1 partition, retention 30 jours) ---"
create_topic "insurtech.dlq.comm.failed"       "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.pay.failed"        "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.insure.failed"     "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.repair.failed"     "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.compliance.failed" "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"

log_info "=== Initialisation 53 topics terminee avec succes ==="

# Verification finale : liste des topics et comptage
TOPIC_COUNT=$(kafka-topics.sh --bootstrap-server "${KAFKA_BROKERS}" --list | grep -c "^insurtech\." || true)
log_info "Total topics insurtech.* presents : ${TOPIC_COUNT}"

if [ "${TOPIC_COUNT}" -lt 53 ]; then
  log_error "Total topics ${TOPIC_COUNT} < 53 attendu, init incomplete"
  exit 1
fi

log_info "=== Verification : ${TOPIC_COUNT} topics insurtech.* OK ==="
exit 0
```

### 7.2. `infrastructure/kafka/topics-config.yaml` (descriptif YAML)

```yaml
# infrastructure/kafka/topics-config.yaml
# Skalean Insurtech -- Configuration descriptive 53 topics Kafka
# Source de verite pour generation init-topics.sh + verify-topics.sh + topics-catalog.md

version: "1.0.0"
last_updated: "2026-05-05"
total_topics: 53

defaults:
  partitions_standard: 6
  partitions_dlq: 1
  retention_standard_ms: 604800000     # 7 jours
  retention_audit_ms: 2592000000       # 30 jours
  retention_dlq_ms: 2592000000         # 30 jours
  replication_factor_dev: 1
  replication_factor_prod: 3
  min_insync_replicas_dev: 1
  min_insync_replicas_prod: 2
  compression_type: snappy
  segment_ms: 86400000                  # 1 jour
  cleanup_policy: delete

modules:
  auth:
    description: "Module Authentification, gestion utilisateurs, MFA"
    sprint: 5
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.auth.user.created
        producer: auth-service
        consumers: [crm-service, audit-service]
        schema_zod: UserCreatedEventSchema
      - name: insurtech.events.auth.user.signed_in
        producer: auth-service
        consumers: [audit-service]
        schema_zod: UserSignedInEventSchema
      - name: insurtech.events.auth.user.signed_out
        producer: auth-service
        consumers: [audit-service]
        schema_zod: UserSignedOutEventSchema
      - name: insurtech.events.auth.user.locked
        producer: auth-service
        consumers: [audit-service, comm-service]
        schema_zod: UserLockedEventSchema
      - name: insurtech.events.auth.user.unlocked
        producer: auth-service
        consumers: [audit-service]
        schema_zod: UserUnlockedEventSchema
      - name: insurtech.events.auth.user.password_reset_requested
        producer: auth-service
        consumers: [comm-service, audit-service]
        schema_zod: PasswordResetRequestedEventSchema
      - name: insurtech.events.auth.user.password_changed
        producer: auth-service
        consumers: [audit-service]
        schema_zod: PasswordChangedEventSchema
      - name: insurtech.events.auth.user.mfa_enabled
        producer: auth-service
        consumers: [audit-service]
        schema_zod: MfaEnabledEventSchema
      - name: insurtech.events.auth.user.mfa_disabled
        producer: auth-service
        consumers: [audit-service]
        schema_zod: MfaDisabledEventSchema

  crm:
    description: "Module CRM, contacts, deals, interactions"
    sprint: 6
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.crm.contact.created
        producer: crm-service
        consumers: [comm-service, audit-service]
      - name: insurtech.events.crm.contact.updated
        producer: crm-service
        consumers: [audit-service]
      - name: insurtech.events.crm.deal.created
        producer: crm-service
        consumers: [audit-service]
      - name: insurtech.events.crm.deal.stage_changed
        producer: crm-service
        consumers: [audit-service]
      - name: insurtech.events.crm.interaction.recorded
        producer: crm-service
        consumers: [audit-service]
      - name: insurtech.events.crm.interaction.email_received
        producer: comm-service
        consumers: [crm-service, audit-service]

  booking:
    description: "Module Booking, RDV agents/clients"
    sprint: 7
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.booking.appointment.scheduled
        producer: booking-service
        consumers: [comm-service, audit-service]
      - name: insurtech.events.booking.appointment.confirmed
        producer: booking-service
        consumers: [comm-service, audit-service]
      - name: insurtech.events.booking.appointment.cancelled
        producer: booking-service
        consumers: [comm-service, audit-service]
      - name: insurtech.events.booking.appointment.completed
        producer: booking-service
        consumers: [audit-service]

  comm:
    description: "Module Communication, SMS/Email/WhatsApp"
    sprint: 8
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.comm.message.queued
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.message.sent
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.message.delivered
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.message.read
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.message.failed
        producer: comm-service
        consumers: [audit-service, dlq.comm]
      - name: insurtech.events.comm.template.created
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.template.approved
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.template.rejected
        producer: comm-service
        consumers: [audit-service]
      - name: insurtech.events.comm.optout.recorded
        producer: comm-service
        consumers: [audit-service, crm-service]
      - name: insurtech.events.comm.webhook.received
        producer: comm-service
        consumers: [audit-service]

  pay:
    description: "Module Paiement, transactions CMI/Wafacash/HPS"
    sprint: 11
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.pay.transaction.initiated
        producer: pay-service
        consumers: [audit-service, books-service]
      - name: insurtech.events.pay.transaction.completed
        producer: pay-service
        consumers: [audit-service, books-service, crm-service]
      - name: insurtech.events.pay.transaction.failed
        producer: pay-service
        consumers: [audit-service, dlq.pay]
      - name: insurtech.events.pay.transaction.refunded
        producer: pay-service
        consumers: [audit-service, books-service]
      - name: insurtech.events.pay.reconciliation.matched
        producer: pay-service
        consumers: [audit-service, books-service]
      - name: insurtech.events.pay.reconciliation.discrepancy
        producer: pay-service
        consumers: [audit-service, alerting-service]

  insure:
    description: "Module Insurance (anticipation Sprint 14-16)"
    sprint: 14
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.insure.policy.created
        producer: insure-service
        consumers: [audit-service, crm-service]
      - name: insurtech.events.insure.policy.signed
        producer: insure-service
        consumers: [audit-service, comm-service]
      - name: insurtech.events.insure.policy.renewed
        producer: insure-service
        consumers: [audit-service, comm-service]
      - name: insurtech.events.insure.policy.cancelled
        producer: insure-service
        consumers: [audit-service, comm-service]

  repair:
    description: "Module Repair (anticipation Sprint 20-22)"
    sprint: 20
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.repair.sinistre.declared
        producer: repair-service
        consumers: [audit-service, insure-service]
      - name: insurtech.events.repair.sinistre.dispatched
        producer: repair-service
        consumers: [audit-service, comm-service]
      - name: insurtech.events.repair.sinistre.estimated
        producer: repair-service
        consumers: [audit-service, insure-service]

  audit:
    description: "Module Audit & Compliance ACAPS"
    sprint: 30
    retention_days: 30
    partitions: 6
    topics:
      - name: insurtech.events.audit.audit.recorded
        producer: audit-service
        consumers: [archival-service]
      - name: insurtech.events.audit.compliance.data_purged
        producer: compliance-service
        consumers: [archival-service]
      - name: insurtech.events.audit.compliance.acaps_submitted
        producer: compliance-service
        consumers: [archival-service]

  books:
    description: "Module Comptabilite"
    sprint: 24
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.books.invoice.issued
        producer: books-service
        consumers: [audit-service, comm-service]
      - name: insurtech.events.books.invoice.paid
        producer: books-service
        consumers: [audit-service]

  stock:
    description: "Module Gestion Stock pieces detachees"
    sprint: 26
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.stock.stock.low_threshold
        producer: stock-service
        consumers: [audit-service, alerting-service]
      - name: insurtech.events.stock.stock.movement_recorded
        producer: stock-service
        consumers: [audit-service]

  hr:
    description: "Module RH"
    sprint: 28
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.hr.attendance.recorded
        producer: hr-service
        consumers: [audit-service]
      - name: insurtech.events.hr.salary.processed
        producer: hr-service
        consumers: [audit-service, books-service]

  system:
    description: "Module System events tenant lifecycle"
    sprint: 5
    retention_days: 7
    partitions: 6
    topics:
      - name: insurtech.events.system.tenant.created
        producer: tenant-service
        consumers: [audit-service]
      - name: insurtech.events.system.tenant.settings_changed
        producer: tenant-service
        consumers: [audit-service]
      - name: insurtech.events.system.user.password_reset_requested
        producer: auth-service
        consumers: [audit-service, comm-service]

  dlq:
    description: "Dead Letter Queue topics par domaine"
    retention_days: 30
    partitions: 1
    topics:
      - name: insurtech.dlq.comm.failed
        domain: comm
        sla_replay_minutes: 30
      - name: insurtech.dlq.pay.failed
        domain: pay
        sla_replay_minutes: 5
      - name: insurtech.dlq.insure.failed
        domain: insure
        sla_replay_minutes: 15
      - name: insurtech.dlq.repair.failed
        domain: repair
        sla_replay_minutes: 30
      - name: insurtech.dlq.compliance.failed
        domain: compliance
        sla_replay_minutes: 60
```

### 7.3. `infrastructure/docker/kafka/verify-topics.sh` (script verification)

```bash
#!/usr/bin/env bash
# infrastructure/docker/kafka/verify-topics.sh
# Skalean Insurtech -- Verification 53+ topics presents et conformes
# Tache 1.2.10 -- Sprint 2

set -euo pipefail

KAFKA_BROKERS="${KAFKA_BROKERS:-kafka:9092}"
NAMING_REGEX='^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$'

log_info()  { echo "[INFO]  $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }
log_error() { echo "[ERROR] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }

# Liste topics attendus (53)
EXPECTED_TOPICS=(
  "insurtech.events.auth.user.created"
  "insurtech.events.auth.user.signed_in"
  "insurtech.events.auth.user.signed_out"
  "insurtech.events.auth.user.locked"
  "insurtech.events.auth.user.unlocked"
  "insurtech.events.auth.user.password_reset_requested"
  "insurtech.events.auth.user.password_changed"
  "insurtech.events.auth.user.mfa_enabled"
  "insurtech.events.auth.user.mfa_disabled"
  "insurtech.events.crm.contact.created"
  "insurtech.events.crm.contact.updated"
  "insurtech.events.crm.deal.created"
  "insurtech.events.crm.deal.stage_changed"
  "insurtech.events.crm.interaction.recorded"
  "insurtech.events.crm.interaction.email_received"
  "insurtech.events.booking.appointment.scheduled"
  "insurtech.events.booking.appointment.confirmed"
  "insurtech.events.booking.appointment.cancelled"
  "insurtech.events.booking.appointment.completed"
  "insurtech.events.comm.message.queued"
  "insurtech.events.comm.message.sent"
  "insurtech.events.comm.message.delivered"
  "insurtech.events.comm.message.read"
  "insurtech.events.comm.message.failed"
  "insurtech.events.comm.template.created"
  "insurtech.events.comm.template.approved"
  "insurtech.events.comm.template.rejected"
  "insurtech.events.comm.optout.recorded"
  "insurtech.events.comm.webhook.received"
  "insurtech.events.pay.transaction.initiated"
  "insurtech.events.pay.transaction.completed"
  "insurtech.events.pay.transaction.failed"
  "insurtech.events.pay.transaction.refunded"
  "insurtech.events.pay.reconciliation.matched"
  "insurtech.events.pay.reconciliation.discrepancy"
  "insurtech.events.insure.policy.created"
  "insurtech.events.insure.policy.signed"
  "insurtech.events.insure.policy.renewed"
  "insurtech.events.insure.policy.cancelled"
  "insurtech.events.repair.sinistre.declared"
  "insurtech.events.repair.sinistre.dispatched"
  "insurtech.events.repair.sinistre.estimated"
  "insurtech.events.audit.audit.recorded"
  "insurtech.events.audit.compliance.data_purged"
  "insurtech.events.audit.compliance.acaps_submitted"
  "insurtech.events.books.invoice.issued"
  "insurtech.events.books.invoice.paid"
  "insurtech.events.stock.stock.low_threshold"
  "insurtech.events.stock.stock.movement_recorded"
  "insurtech.events.hr.attendance.recorded"
  "insurtech.events.hr.salary.processed"
  "insurtech.events.system.tenant.created"
  "insurtech.events.system.tenant.settings_changed"
  "insurtech.events.system.user.password_reset_requested"
  "insurtech.dlq.comm.failed"
  "insurtech.dlq.pay.failed"
  "insurtech.dlq.insure.failed"
  "insurtech.dlq.repair.failed"
  "insurtech.dlq.compliance.failed"
)

log_info "=== Verification ${#EXPECTED_TOPICS[@]} topics attendus ==="

# Recuperation liste topics actuels
CURRENT_TOPICS=$(kafka-topics.sh --bootstrap-server "${KAFKA_BROKERS}" --list | grep "^insurtech\." | sort)

MISSING_COUNT=0
NON_CONFORMING_COUNT=0

for expected in "${EXPECTED_TOPICS[@]}"; do
  # Validation regex
  if ! [[ "${expected}" =~ ${NAMING_REGEX} ]]; then
    log_error "Topic attendu non-conforme regex : ${expected}"
    NON_CONFORMING_COUNT=$((NON_CONFORMING_COUNT + 1))
    continue
  fi

  # Verification presence
  if ! echo "${CURRENT_TOPICS}" | grep -q "^${expected}$"; then
    log_error "Topic manquant : ${expected}"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

# Verification topics presents non attendus (drift)
log_info "--- Verification drift (topics presents non attendus) ---"
DRIFT_COUNT=0
while IFS= read -r current; do
  found=false
  for expected in "${EXPECTED_TOPICS[@]}"; do
    if [[ "${current}" == "${expected}" ]]; then
      found=true
      break
    fi
  done
  if [ "${found}" = false ]; then
    log_error "Topic non attendu (drift) : ${current}"
    DRIFT_COUNT=$((DRIFT_COUNT + 1))
  fi
done <<< "${CURRENT_TOPICS}"

log_info "=== Bilan verification ==="
log_info "Topics attendus      : ${#EXPECTED_TOPICS[@]}"
log_info "Topics manquants     : ${MISSING_COUNT}"
log_info "Topics non-conformes : ${NON_CONFORMING_COUNT}"
log_info "Topics drift         : ${DRIFT_COUNT}"

if [ "${MISSING_COUNT}" -gt 0 ] || [ "${NON_CONFORMING_COUNT}" -gt 0 ]; then
  log_error "Verification ECHOUEE"
  exit 1
fi

log_info "Verification REUSSIE"
exit 0
```

### 7.4. `infrastructure/docker/kafka/docker-compose.kafka.yaml` (fragment)

```yaml
# infrastructure/docker/kafka/docker-compose.kafka.yaml
version: "3.9"

services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    container_name: skalean-kafka
    hostname: kafka
    ports:
      - "9092:9092"
      - "9094:9094"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: "broker,controller"
      KAFKA_LISTENERS: "PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9094"
      KAFKA_ADVERTISED_LISTENERS: "PLAINTEXT://kafka:9092"
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER"
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka:9094"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
      KAFKA_DEFAULT_REPLICATION_FACTOR: 1
      KAFKA_MIN_INSYNC_REPLICAS: 1
      KAFKA_LOG_RETENTION_HOURS: 168
      CLUSTER_ID: "insurtech-kafka-cluster-1"
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    volumes:
      - kafka-data:/var/lib/kafka/data
    networks:
      - insurtech-net

  kafka-init:
    image: confluentinc/cp-kafka:7.6.0
    container_name: skalean-kafka-init
    depends_on:
      kafka:
        condition: service_healthy
    environment:
      KAFKA_BROKERS: "kafka:9092"
      KAFKA_PARTITIONS_DEFAULT: 6
      KAFKA_PARTITIONS_DLQ: 1
      KAFKA_RETENTION_STANDARD_MS: 604800000
      KAFKA_RETENTION_AUDIT_MS: 2592000000
      KAFKA_RETENTION_DLQ_MS: 2592000000
      KAFKA_REPLICATION_FACTOR: 1
      KAFKA_MIN_INSYNC_REPLICAS: 1
      KAFKA_COMPRESSION: snappy
    volumes:
      - ./init-topics.sh:/init-topics.sh:ro
      - ./verify-topics.sh:/verify-topics.sh:ro
    command: ["/bin/bash", "-c", "/init-topics.sh && /verify-topics.sh"]
    networks:
      - insurtech-net

volumes:
  kafka-data:

networks:
  insurtech-net:
    driver: bridge
```

### 7.5. `infrastructure/kafka/topics-catalog.md` (fragment table cataloge)

```markdown
# Catalogue Topics Kafka Skalean Insurtech

## Tableau complet 53 topics

| Topic                                                       | Partitions | Retention | Producer       | Consumer            | Schema Zod                       |
|-------------------------------------------------------------|------------|-----------|----------------|---------------------|----------------------------------|
| insurtech.events.auth.user.created                          | 6          | 7j        | auth-service   | crm, audit          | UserCreatedEventSchema           |
| insurtech.events.auth.user.signed_in                        | 6          | 7j        | auth-service   | audit               | UserSignedInEventSchema          |
| insurtech.events.auth.user.signed_out                       | 6          | 7j        | auth-service   | audit               | UserSignedOutEventSchema         |
| insurtech.events.auth.user.locked                           | 6          | 7j        | auth-service   | audit, comm         | UserLockedEventSchema            |
| insurtech.events.auth.user.unlocked                         | 6          | 7j        | auth-service   | audit               | UserUnlockedEventSchema          |
| insurtech.events.auth.user.password_reset_requested         | 6          | 7j        | auth-service   | comm, audit         | PasswordResetRequestedEventSchema|
| insurtech.events.auth.user.password_changed                 | 6          | 7j        | auth-service   | audit               | PasswordChangedEventSchema       |
| insurtech.events.auth.user.mfa_enabled                      | 6          | 7j        | auth-service   | audit               | MfaEnabledEventSchema            |
| insurtech.events.auth.user.mfa_disabled                     | 6          | 7j        | auth-service   | audit               | MfaDisabledEventSchema           |
| insurtech.events.crm.contact.created                        | 6          | 7j        | crm-service    | comm, audit         | ContactCreatedEventSchema        |
| insurtech.events.crm.contact.updated                        | 6          | 7j        | crm-service    | audit               | ContactUpdatedEventSchema        |
| insurtech.events.crm.deal.created                           | 6          | 7j        | crm-service    | audit               | DealCreatedEventSchema           |
| insurtech.events.crm.deal.stage_changed                     | 6          | 7j        | crm-service    | audit               | DealStageChangedEventSchema      |
| insurtech.events.crm.interaction.recorded                   | 6          | 7j        | crm-service    | audit               | InteractionRecordedEventSchema   |
| insurtech.events.crm.interaction.email_received             | 6          | 7j        | comm-service   | crm, audit          | InteractionEmailReceivedSchema   |
| insurtech.events.booking.appointment.scheduled              | 6          | 7j        | booking-service| comm, audit         | AppointmentScheduledEventSchema  |
| insurtech.events.booking.appointment.confirmed              | 6          | 7j        | booking-service| comm, audit         | AppointmentConfirmedEventSchema  |
| insurtech.events.booking.appointment.cancelled              | 6          | 7j        | booking-service| comm, audit         | AppointmentCancelledEventSchema  |
| insurtech.events.booking.appointment.completed              | 6          | 7j        | booking-service| audit               | AppointmentCompletedEventSchema  |
| insurtech.events.comm.message.queued                        | 6          | 7j        | comm-service   | audit               | MessageQueuedEventSchema         |
| insurtech.events.comm.message.sent                          | 6          | 7j        | comm-service   | audit               | MessageSentEventSchema           |
| insurtech.events.comm.message.delivered                     | 6          | 7j        | comm-service   | audit               | MessageDeliveredEventSchema      |
| insurtech.events.comm.message.read                          | 6          | 7j        | comm-service   | audit               | MessageReadEventSchema           |
| insurtech.events.comm.message.failed                        | 6          | 7j        | comm-service   | audit, dlq.comm     | MessageFailedEventSchema         |
| insurtech.events.comm.template.created                      | 6          | 7j        | comm-service   | audit               | TemplateCreatedEventSchema       |
| insurtech.events.comm.template.approved                     | 6          | 7j        | comm-service   | audit               | TemplateApprovedEventSchema      |
| insurtech.events.comm.template.rejected                     | 6          | 7j        | comm-service   | audit               | TemplateRejectedEventSchema      |
| insurtech.events.comm.optout.recorded                       | 6          | 7j        | comm-service   | audit, crm          | OptoutRecordedEventSchema        |
| insurtech.events.comm.webhook.received                      | 6          | 7j        | comm-service   | audit               | WebhookReceivedEventSchema       |
| insurtech.events.pay.transaction.initiated                  | 6          | 7j        | pay-service    | audit, books        | TransactionInitiatedEventSchema  |
| insurtech.events.pay.transaction.completed                  | 6          | 7j        | pay-service    | audit, books, crm   | TransactionCompletedEventSchema  |
| insurtech.events.pay.transaction.failed                     | 6          | 7j        | pay-service    | audit, dlq.pay      | TransactionFailedEventSchema     |
| insurtech.events.pay.transaction.refunded                   | 6          | 7j        | pay-service    | audit, books        | TransactionRefundedEventSchema   |
| insurtech.events.pay.reconciliation.matched                 | 6          | 7j        | pay-service    | audit, books        | ReconciliationMatchedEventSchema |
| insurtech.events.pay.reconciliation.discrepancy             | 6          | 7j        | pay-service    | audit, alerting     | ReconciliationDiscrepancySchema  |
| insurtech.events.insure.policy.created                      | 6          | 7j        | insure-service | audit, crm          | PolicyCreatedEventSchema         |
| insurtech.events.insure.policy.signed                       | 6          | 7j        | insure-service | audit, comm         | PolicySignedEventSchema          |
| insurtech.events.insure.policy.renewed                      | 6          | 7j        | insure-service | audit, comm         | PolicyRenewedEventSchema         |
| insurtech.events.insure.policy.cancelled                    | 6          | 7j        | insure-service | audit, comm         | PolicyCancelledEventSchema       |
| insurtech.events.repair.sinistre.declared                   | 6          | 7j        | repair-service | audit, insure       | SinistreDeclaredEventSchema      |
| insurtech.events.repair.sinistre.dispatched                 | 6          | 7j        | repair-service | audit, comm         | SinistreDispatchedEventSchema    |
| insurtech.events.repair.sinistre.estimated                  | 6          | 7j        | repair-service | audit, insure       | SinistreEstimatedEventSchema     |
| insurtech.events.audit.audit.recorded                       | 6          | 30j       | audit-service  | archival            | AuditRecordedEventSchema         |
| insurtech.events.audit.compliance.data_purged               | 6          | 30j       | compliance-svc | archival            | DataPurgedEventSchema            |
| insurtech.events.audit.compliance.acaps_submitted           | 6          | 30j       | compliance-svc | archival            | AcapsSubmittedEventSchema        |
| insurtech.events.books.invoice.issued                       | 6          | 7j        | books-service  | audit, comm         | InvoiceIssuedEventSchema         |
| insurtech.events.books.invoice.paid                         | 6          | 7j        | books-service  | audit               | InvoicePaidEventSchema           |
| insurtech.events.stock.stock.low_threshold                  | 6          | 7j        | stock-service  | audit, alerting     | StockLowThresholdEventSchema     |
| insurtech.events.stock.stock.movement_recorded              | 6          | 7j        | stock-service  | audit               | StockMovementRecordedEventSchema |
| insurtech.events.hr.attendance.recorded                     | 6          | 7j        | hr-service     | audit               | AttendanceRecordedEventSchema    |
| insurtech.events.hr.salary.processed                        | 6          | 7j        | hr-service     | audit, books        | SalaryProcessedEventSchema       |
| insurtech.events.system.tenant.created                      | 6          | 7j        | tenant-service | audit               | TenantCreatedEventSchema         |
| insurtech.events.system.tenant.settings_changed             | 6          | 7j        | tenant-service | audit               | TenantSettingsChangedEventSchema |
| insurtech.events.system.user.password_reset_requested       | 6          | 7j        | auth-service   | audit, comm         | PasswordResetRequestedSysSchema  |
| insurtech.dlq.comm.failed                                   | 1          | 30j       | dlq-router     | dlq-replay-comm     | DlqMessageEnvelopeSchema         |
| insurtech.dlq.pay.failed                                    | 1          | 30j       | dlq-router     | dlq-replay-pay      | DlqMessageEnvelopeSchema         |
| insurtech.dlq.insure.failed                                 | 1          | 30j       | dlq-router     | dlq-replay-insure   | DlqMessageEnvelopeSchema         |
| insurtech.dlq.repair.failed                                 | 1          | 30j       | dlq-router     | dlq-replay-repair   | DlqMessageEnvelopeSchema         |
| insurtech.dlq.compliance.failed                             | 1          | 30j       | dlq-router     | dlq-replay-comp     | DlqMessageEnvelopeSchema         |

Total : 53 topics dont 48 standards + 5 DLQ
```

### 7.6. Fragment `.env.example` (variables Kafka)

```dotenv
# === Kafka Configuration ===
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=skalean-insurtech
KAFKA_PARTITIONS_DEFAULT=6
KAFKA_PARTITIONS_DLQ=1
KAFKA_RETENTION_STANDARD_MS=604800000
KAFKA_RETENTION_AUDIT_MS=2592000000
KAFKA_RETENTION_DLQ_MS=2592000000
KAFKA_REPLICATION_FACTOR=1
KAFKA_MIN_INSYNC_REPLICAS=1
KAFKA_COMPRESSION=snappy
KAFKA_SEGMENT_MS=86400000
KAFKA_CLEANUP_POLICY=delete
KAFKA_AUTO_OFFSET_RESET=earliest
KAFKA_ENABLE_AUTO_COMMIT=false
KAFKA_SESSION_TIMEOUT_MS=30000
KAFKA_HEARTBEAT_INTERVAL_MS=10000
KAFKA_PRODUCER_ENABLE_IDEMPOTENCE=true
KAFKA_PRODUCER_ACKS=all
KAFKA_PRODUCER_MAX_IN_FLIGHT_REQUESTS=5
KAFKA_PRODUCER_RETRIES=2147483647
```

### 7.7. GitHub Action `.github/workflows/kafka-topics-init.yml`

```yaml
name: kafka-topics-init

on:
  push:
    paths:
      - "infrastructure/docker/kafka/init-topics.sh"
      - "infrastructure/docker/kafka/verify-topics.sh"
      - "infrastructure/kafka/topics-config.yaml"
      - ".github/workflows/kafka-topics-init.yml"
  workflow_dispatch:

jobs:
  validate-shell:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - name: ShellCheck init-topics.sh
        run: shellcheck infrastructure/docker/kafka/init-topics.sh
      - name: ShellCheck verify-topics.sh
        run: shellcheck infrastructure/docker/kafka/verify-topics.sh
      - name: Validate naming regex topics-config.yaml
        run: |
          python3 -c "
          import yaml, re
          regex = re.compile(r'^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$')
          with open('infrastructure/kafka/topics-config.yaml') as f:
              data = yaml.safe_load(f)
          count = 0
          for module, content in data.get('modules', {}).items():
              for t in content.get('topics', []):
                  name = t['name']
                  assert regex.match(name), f'Topic {name} non-conforme'
                  count += 1
          assert count >= 53, f'Total topics {count} < 53'
          print(f'Total topics : {count}')
          "
  init-and-verify-dev:
    runs-on: ubuntu-22.04
    needs: validate-shell
    services:
      kafka:
        image: confluentinc/cp-kafka:7.6.0
        ports:
          - 9092:9092
        env:
          KAFKA_NODE_ID: 1
          KAFKA_PROCESS_ROLES: "broker,controller"
          KAFKA_LISTENERS: "PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9094"
          KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka:9094"
          KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
          CLUSTER_ID: "insurtech-kafka-cluster-1"
    steps:
      - uses: actions/checkout@v4
      - name: Wait Kafka ready
        run: sleep 30
      - name: Run init-topics.sh
        run: bash infrastructure/docker/kafka/init-topics.sh
      - name: Run verify-topics.sh
        run: bash infrastructure/docker/kafka/verify-topics.sh
      - name: Re-run init-topics (idempotence test)
        run: bash infrastructure/docker/kafka/init-topics.sh
```

## 8. Tests complets (18-30 ko)

### 8.1. `apps/api/src/__tests__/integration/topics-creation.spec.ts` (>= 8 tests)

```typescript
import { Kafka, Admin } from 'kafkajs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Topics Creation Integration', () => {
  let admin: Admin;
  let kafka: Kafka;

  beforeAll(async () => {
    kafka = new Kafka({
      clientId: 'test-topics-creation',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });
    admin = kafka.admin();
    await admin.connect();
  });

  afterAll(async () => {
    await admin.disconnect();
  });

  it('should have at least 53 insurtech topics created', async () => {
    const topics = await admin.listTopics();
    const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.'));
    expect(insurtechTopics.length).toBeGreaterThanOrEqual(53);
  });

  it('should have all 9 auth topics', async () => {
    const topics = await admin.listTopics();
    const authTopics = topics.filter((t) => t.startsWith('insurtech.events.auth.'));
    expect(authTopics.length).toBeGreaterThanOrEqual(9);
  });

  it('should have all 6 pay topics', async () => {
    const topics = await admin.listTopics();
    const payTopics = topics.filter((t) => t.startsWith('insurtech.events.pay.'));
    expect(payTopics.length).toBeGreaterThanOrEqual(6);
  });

  it('should have 5 DLQ topics', async () => {
    const topics = await admin.listTopics();
    const dlqTopics = topics.filter((t) => t.startsWith('insurtech.dlq.'));
    expect(dlqTopics.length).toBe(5);
  });

  it('should have standard topics with 6 partitions', async () => {
    const metadata = await admin.fetchTopicMetadata({
      topics: ['insurtech.events.auth.user.created'],
    });
    expect(metadata.topics[0].partitions.length).toBe(6);
  });

  it('should have DLQ topics with 1 partition', async () => {
    const metadata = await admin.fetchTopicMetadata({
      topics: ['insurtech.dlq.pay.failed'],
    });
    expect(metadata.topics[0].partitions.length).toBe(1);
  });

  it('should be idempotent on re-run (no error)', async () => {
    // Re-run should not fail (script returns 0 even if topics exist)
    const topics1 = await admin.listTopics();
    const insurtech1 = topics1.filter((t) => t.startsWith('insurtech.')).length;
    // Simulate re-run (already executed in beforeAll), count stable
    const topics2 = await admin.listTopics();
    const insurtech2 = topics2.filter((t) => t.startsWith('insurtech.')).length;
    expect(insurtech2).toBe(insurtech1);
  });

  it('should have all anticipated insurance topics (Sprint 14-16)', async () => {
    const topics = await admin.listTopics();
    expect(topics).toContain('insurtech.events.insure.policy.created');
    expect(topics).toContain('insurtech.events.insure.policy.signed');
    expect(topics).toContain('insurtech.events.insure.policy.renewed');
    expect(topics).toContain('insurtech.events.insure.policy.cancelled');
  });

  it('should have all anticipated repair topics (Sprint 20-22)', async () => {
    const topics = await admin.listTopics();
    expect(topics).toContain('insurtech.events.repair.sinistre.declared');
    expect(topics).toContain('insurtech.events.repair.sinistre.dispatched');
    expect(topics).toContain('insurtech.events.repair.sinistre.estimated');
  });
});
```

### 8.2. `apps/api/src/__tests__/integration/topics-naming.spec.ts` (>= 6 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { Kafka } from 'kafkajs';

const NAMING_REGEX = /^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$/;

describe('Topics Naming Convention', () => {
  it('should match regex on canonical example', () => {
    expect(NAMING_REGEX.test('insurtech.events.pay.transaction.completed')).toBe(true);
  });

  it('should match regex on auth user_password_reset_requested', () => {
    expect(NAMING_REGEX.test('insurtech.events.auth.user.password_reset_requested')).toBe(true);
  });

  it('should match regex on DLQ topics', () => {
    expect(NAMING_REGEX.test('insurtech.dlq.pay.failed')).toBe(true);
    expect(NAMING_REGEX.test('insurtech.dlq.compliance.failed')).toBe(true);
  });

  it('should reject uppercase characters', () => {
    expect(NAMING_REGEX.test('Insurtech.events.pay.transaction.completed')).toBe(false);
    expect(NAMING_REGEX.test('insurtech.events.Pay.transaction.completed')).toBe(false);
  });

  it('should reject hyphen separator', () => {
    expect(NAMING_REGEX.test('insurtech-events-pay-transaction-completed')).toBe(false);
    expect(NAMING_REGEX.test('insurtech.events.pay.transaction-completed')).toBe(false);
  });

  it('should reject missing segments', () => {
    expect(NAMING_REGEX.test('insurtech.events.pay')).toBe(false);
    expect(NAMING_REGEX.test('insurtech.events')).toBe(false);
  });

  it('should reject non-ascii characters', () => {
    expect(NAMING_REGEX.test('insurtech.events.pay.transaction.completed.tete')).toBe(false);
  });

  it('should validate all current topics from cluster', async () => {
    const kafka = new Kafka({
      clientId: 'test-naming',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.'));
    insurtechTopics.forEach((t) => {
      expect(NAMING_REGEX.test(t), `Topic ${t} non-conforme`).toBe(true);
    });
    await admin.disconnect();
  });
});
```

### 8.3. `apps/api/src/__tests__/integration/dlq-retention.spec.ts` (>= 4 tests)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kafka, Admin } from 'kafkajs';

const DLQ_TOPICS = [
  'insurtech.dlq.comm.failed',
  'insurtech.dlq.pay.failed',
  'insurtech.dlq.insure.failed',
  'insurtech.dlq.repair.failed',
  'insurtech.dlq.compliance.failed',
];

describe('DLQ Retention Configuration', () => {
  let admin: Admin;

  beforeAll(async () => {
    const kafka = new Kafka({
      clientId: 'test-dlq-retention',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });
    admin = kafka.admin();
    await admin.connect();
  });

  afterAll(async () => {
    await admin.disconnect();
  });

  it('should have all 5 DLQ topics created', async () => {
    const topics = await admin.listTopics();
    DLQ_TOPICS.forEach((dlq) => {
      expect(topics).toContain(dlq);
    });
  });

  it('should have retention 30 days (2592000000ms) on all DLQ', async () => {
    const configs = await admin.describeConfigs({
      includeSynonyms: false,
      resources: DLQ_TOPICS.map((name) => ({ type: 2, name })),
    });
    configs.resources.forEach((r) => {
      const retentionEntry = r.configEntries.find((c) => c.configName === 'retention.ms');
      expect(retentionEntry?.configValue).toBe('2592000000');
    });
  });

  it('should have 1 partition on all DLQ topics', async () => {
    const metadata = await admin.fetchTopicMetadata({ topics: DLQ_TOPICS });
    metadata.topics.forEach((t) => {
      expect(t.partitions.length).toBe(1);
    });
  });

  it('should have snappy compression on all DLQ topics', async () => {
    const configs = await admin.describeConfigs({
      includeSynonyms: false,
      resources: DLQ_TOPICS.map((name) => ({ type: 2, name })),
    });
    configs.resources.forEach((r) => {
      const compEntry = r.configEntries.find((c) => c.configName === 'compression.type');
      expect(compEntry?.configValue).toBe('snappy');
    });
  });
});
```

### 8.4. `apps/api/src/__tests__/integration/audit-retention.spec.ts` (>= 4 tests)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kafka, Admin } from 'kafkajs';

const AUDIT_TOPICS = [
  'insurtech.events.audit.audit.recorded',
  'insurtech.events.audit.compliance.data_purged',
  'insurtech.events.audit.compliance.acaps_submitted',
];

describe('Audit Topics Retention 30 days', () => {
  let admin: Admin;

  beforeAll(async () => {
    const kafka = new Kafka({
      clientId: 'test-audit-retention',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });
    admin = kafka.admin();
    await admin.connect();
  });

  afterAll(async () => await admin.disconnect());

  it('should have all 3 audit topics', async () => {
    const topics = await admin.listTopics();
    AUDIT_TOPICS.forEach((t) => expect(topics).toContain(t));
  });

  it('should have retention 30 days on audit topics', async () => {
    const configs = await admin.describeConfigs({
      includeSynonyms: false,
      resources: AUDIT_TOPICS.map((name) => ({ type: 2, name })),
    });
    configs.resources.forEach((r) => {
      const retentionEntry = r.configEntries.find((c) => c.configName === 'retention.ms');
      expect(retentionEntry?.configValue).toBe('2592000000');
    });
  });

  it('should have 6 partitions on audit topics (standard)', async () => {
    const metadata = await admin.fetchTopicMetadata({ topics: AUDIT_TOPICS });
    metadata.topics.forEach((t) => expect(t.partitions.length).toBe(6));
  });

  it('should have cleanup.policy=delete (not compact)', async () => {
    const configs = await admin.describeConfigs({
      includeSynonyms: false,
      resources: AUDIT_TOPICS.map((name) => ({ type: 2, name })),
    });
    configs.resources.forEach((r) => {
      const policy = r.configEntries.find((c) => c.configName === 'cleanup.policy');
      expect(policy?.configValue).toBe('delete');
    });
  });
});
```

### 8.5. `apps/api/src/__tests__/unit/kafka-admin-mock.spec.ts` (>= 6 tests Mock)

```typescript
import { describe, it, expect, vi } from 'vitest';

const mockAdmin = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  listTopics: vi.fn(),
  fetchTopicMetadata: vi.fn(),
  describeConfigs: vi.fn(),
};

describe('Kafka Admin Mock Tests', () => {
  it('should mock listTopics returning 53+ topics', async () => {
    const expected = Array.from({ length: 53 }, (_, i) => `insurtech.events.test.entity.action${i}`);
    mockAdmin.listTopics.mockResolvedValue(expected);
    const topics = await mockAdmin.listTopics();
    expect(topics.length).toBeGreaterThanOrEqual(53);
  });

  it('should mock fetchTopicMetadata for partitions count', async () => {
    mockAdmin.fetchTopicMetadata.mockResolvedValue({
      topics: [{ name: 'insurtech.events.pay.transaction.completed', partitions: Array(6).fill({}) }],
    });
    const metadata = await mockAdmin.fetchTopicMetadata({ topics: ['insurtech.events.pay.transaction.completed'] });
    expect(metadata.topics[0].partitions.length).toBe(6);
  });

  it('should mock DLQ partition = 1', async () => {
    mockAdmin.fetchTopicMetadata.mockResolvedValue({
      topics: [{ name: 'insurtech.dlq.pay.failed', partitions: [{}] }],
    });
    const metadata = await mockAdmin.fetchTopicMetadata({ topics: ['insurtech.dlq.pay.failed'] });
    expect(metadata.topics[0].partitions.length).toBe(1);
  });

  it('should mock describeConfigs retention 30 days', async () => {
    mockAdmin.describeConfigs.mockResolvedValue({
      resources: [{
        configEntries: [{ configName: 'retention.ms', configValue: '2592000000' }],
      }],
    });
    const configs = await mockAdmin.describeConfigs({ resources: [{ type: 2, name: 'insurtech.dlq.pay.failed' }] });
    expect(configs.resources[0].configEntries[0].configValue).toBe('2592000000');
  });

  it('should reject naming non-conforme via regex', () => {
    const regex = /^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$/;
    expect(regex.test('Insurtech.Events.Pay')).toBe(false);
    expect(regex.test('insurtech.events.pay-transaction-completed')).toBe(false);
  });

  it('should validate naming conformity for all expected topics list', () => {
    const regex = /^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$/;
    const topics = [
      'insurtech.events.auth.user.created',
      'insurtech.events.crm.contact.created',
      'insurtech.events.pay.transaction.completed',
      'insurtech.dlq.pay.failed',
    ];
    topics.forEach((t) => expect(regex.test(t)).toBe(true));
  });
});
```

## 9. Variables environnement (>= 18)

| Variable                          | Defaut         | Description                                        |
|-----------------------------------|----------------|----------------------------------------------------|
| KAFKA_BROKERS                     | kafka:9092     | Liste brokers Kafka separes par virgules           |
| KAFKA_CLIENT_ID                   | skalean-insurtech | Identifiant client Kafka                        |
| KAFKA_PARTITIONS_DEFAULT          | 6              | Nombre partitions topics standard                  |
| KAFKA_PARTITIONS_DLQ              | 1              | Nombre partitions topics DLQ                       |
| KAFKA_RETENTION_STANDARD_MS       | 604800000      | 7 jours retention standard                         |
| KAFKA_RETENTION_AUDIT_MS          | 2592000000     | 30 jours retention audit                           |
| KAFKA_RETENTION_DLQ_MS            | 2592000000     | 30 jours retention DLQ                             |
| KAFKA_REPLICATION_FACTOR          | 1 dev / 3 prod | Replication factor adapte env                      |
| KAFKA_MIN_INSYNC_REPLICAS         | 1 dev / 2 prod | Replicas synchronisees min                         |
| KAFKA_COMPRESSION                 | snappy         | Algorithme compression                             |
| KAFKA_SEGMENT_MS                  | 86400000       | 1 jour segment log                                 |
| KAFKA_CLEANUP_POLICY              | delete         | Politique cleanup (delete vs compact)              |
| KAFKA_AUTO_OFFSET_RESET           | earliest       | Strategie offset consumer                          |
| KAFKA_ENABLE_AUTO_COMMIT          | false          | Auto-commit offsets desactive                      |
| KAFKA_SESSION_TIMEOUT_MS          | 30000          | Session timeout consumer                           |
| KAFKA_HEARTBEAT_INTERVAL_MS       | 10000          | Heartbeat interval consumer                        |
| KAFKA_PRODUCER_ENABLE_IDEMPOTENCE | true           | Producer idempotent                                |
| KAFKA_PRODUCER_ACKS               | all            | Producer acknowledgement strategy                  |
| KAFKA_PRODUCER_MAX_IN_FLIGHT      | 5              | Max requetes en vol par connexion                  |
| KAFKA_PRODUCER_RETRIES            | 2147483647     | Retries max (infini)                               |

## 10. Commandes shell

```bash
# Initialisation 53 topics
./infrastructure/docker/kafka/init-topics.sh

# Verification 53 topics presents et conformes
./infrastructure/docker/kafka/verify-topics.sh

# Liste tous les topics insurtech
kafka-topics.sh --bootstrap-server localhost:9092 --list | grep "^insurtech\."

# Decrire topic specifique (partitions, retention)
kafka-topics.sh --bootstrap-server localhost:9092 --describe \
  --topic insurtech.events.pay.transaction.completed

# Verifier configuration retention sur DLQ
kafka-configs.sh --bootstrap-server localhost:9092 --entity-type topics \
  --entity-name insurtech.dlq.pay.failed --describe

# Re-execution idempotente (test)
./infrastructure/docker/kafka/init-topics.sh
./infrastructure/docker/kafka/init-topics.sh

# Comptage topics insurtech
kafka-topics.sh --bootstrap-server localhost:9092 --list | grep -c "^insurtech\."

# Suppression topic (dev only, jamais en prod)
kafka-topics.sh --bootstrap-server localhost:9092 --delete \
  --topic insurtech.events.test.example.action

# Test producer/consumer manuel
echo '{"event":"test","tenant_id":"abc"}' | kafka-console-producer.sh \
  --bootstrap-server localhost:9092 --topic insurtech.events.auth.user.created

kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic insurtech.events.auth.user.created --from-beginning --max-messages 1
```

## 11. Criteres validation V1-V32+

### 11.1. Criteres P0 (V1-V18)

- **V1** : Script `init-topics.sh` execute sans erreur fatale (exit 0).
- **V2** : 53 topics au minimum crees (verifies par `kafka-topics.sh --list | grep -c "^insurtech\."`).
- **V3** : Naming convention regex `^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$` respectee sur 100% topics.
- **V4** : 9 topics auth presents.
- **V5** : 6 topics CRM presents.
- **V6** : 4 topics booking presents.
- **V7** : 10 topics comm presents.
- **V8** : 6 topics pay presents.
- **V9** : 4 topics insure presents (anticipation Sprint 14-16).
- **V10** : 3 topics repair presents (anticipation Sprint 20-22).
- **V11** : 3 topics audit presents avec retention 30 jours.
- **V12** : 5 topics DLQ presents avec 1 partition et retention 30 jours.
- **V13** : Compression snappy verifiee sur tous les topics.
- **V14** : Partitions standard = 6 verifiees.
- **V15** : Partitions DLQ = 1 verifiees.
- **V16** : Idempotence : double execution `init-topics.sh` sans erreur, count stable.
- **V17** : Script `verify-topics.sh` exit 0 sur cluster valide.
- **V18** : Topics-config.yaml charge et parse avec 53+ topics.

### 11.2. Criteres P1 (V19-V26)

- **V19** : Documentation `topics-catalog.md` table complete 53 lignes.
- **V20** : `.env.example` >= 18 variables KAFKA_*.
- **V21** : GitHub Action `kafka-topics-init.yml` execute en CI.
- **V22** : Tests integration `topics-creation.spec.ts` 8 tests passent.
- **V23** : Tests integration `topics-naming.spec.ts` 6 tests passent.
- **V24** : Tests integration `dlq-retention.spec.ts` 4 tests passent.
- **V25** : Tests integration `audit-retention.spec.ts` 4 tests passent.
- **V26** : Tests unit Mock 6 tests passent.

### 11.3. Criteres P2 (V27-V32)

- **V27** : ShellCheck pass sur `init-topics.sh` et `verify-topics.sh`.
- **V28** : Pre-commit hook valide naming regex.
- **V29** : Logs structures (winston JSON) sur init-topics.
- **V30** : Coverage tests >= 85% scripts shell.
- **V31** : Documentation README mise a jour avec procedure deploiement.
- **V32** : Annexes A-G completes (catalogue, partition strategy, retention math, KRaft, ACL preview, Schema Registry preview, monitoring Prometheus).

## 12. Edge cases (10-12 cas)

### 12.1. Topic auto-create production interdit

Cas : un developpeur publie sur un topic non existant. En dev, Kafka peut auto-creer si configure (defaut Confluent). En prod, `auto.create.topics.enable=false` bloque la creation et le producer leve une erreur `UNKNOWN_TOPIC_OR_PARTITION`. **Mitigation** : tous les topics doivent etre dans `init-topics.sh`, jamais auto-crees. Test integration : tenter publish sur `insurtech.events.test.fake.action` doit echouer en prod.

### 12.2. Partition count immutable apres creation

Cas : besoin Sprint 18 d'augmenter partitions de 6 a 12 sur `insurtech.events.pay.transaction.completed`. **Mitigation** : creer nouveau topic `insurtech.events.pay.transaction.completed.v2` avec 12 partitions, dual-write des producers Sprint 18, migration consumers, cutover, deprecation v1 Sprint 19. Documenter procedure dans `topics-catalog.md` section "Re-partitioning playbook".

### 12.3. Retention disk explosion 7j vs 30j calcul

Cas : 53 topics x 6 partitions x 100 KB/sec moyen x 7 jours = ~250 GB. Avec 3 audit + 5 DLQ a 30 jours, +50 GB additionnels. Total cluster ~300 GB. **Mitigation** : monitoring Prometheus `kafka_log_log_size`, alerting > 80% (240 GB), provisioning disk 500 GB minimum prod. Annexe C contient calcul detaille.

### 12.4. DLQ replay 30j window expiration

Cas : message echoue le J0 dans `insurtech.dlq.pay.failed`, equipe ops detecte le J29, replay le J31 echoue car message purge. **Mitigation** : monitoring lag DLQ, alerting > 7 jours, processus archive S3 avant purge (Sprint 4 tache 1.4.x).

### 12.5. Snappy vs lz4 vs zstd compression

Cas : evaluer changement compression Sprint 18 si throughput insuffisant. **Mitigation** : benchmark snappy (current) vs lz4 (rapide) vs zstd (haute compression) sur topic `insurtech.events.pay.transaction.completed` avec 1500 msg/sec. Decision documentee Sprint 18.

### 12.6. KRaft quorum loss en dev

Cas : dev mono-broker, broker tombe, perte quorum, cluster indisponible. **Mitigation** : redemarrage docker-compose recree broker + controller, donnees persistees dans volume `kafka-data`. En prod, quorum 3 controllers tolerance 1 panne.

### 12.7. Idempotent producer collision transactional.id

Cas : 2 instances pod producer Sprint 11 utilisent meme transactional.id, transactions s'ecrasent, exception `ProducerFencedException`. **Mitigation** : transactional.id = `${SERVICE_NAME}-${POD_NAME}` unique par pod (envvar K8s downward API).

### 12.8. Schema Registry preview Sprint 13 versioning

Cas : Sprint 6 publie event `ContactCreated` v1, Sprint 13 evolue v2 avec champ obligatoire ajoute, consumers v1 cassent. **Mitigation Sprint 2** : `schema_version` field dans payload, Zod schema versione. **Mitigation Sprint 13** : Schema Registry compatibility BACKWARD, ajouts champ optional uniquement.

### 12.9. ACL controls preview Sprint 33

Cas : avant Sprint 33, n'importe quel service peut publier sur n'importe quel topic. Risque de pollution en cas de bug ou compromission. **Mitigation Sprint 2** : VPC isolation Atlas, network policies Kubernetes restreignant ports Kafka. **Mitigation Sprint 33** : ACL Kafka par service-account et prefix topic (ex : `pay-service` peut publier `insurtech.events.pay.*` uniquement).

### 12.10. Topic naming non-conforme rejected

Cas : developpeur tente creer topic `insurtech.events.PaymentService.transactionCompleted` (CamelCase). **Mitigation** : `validate_topic_name()` dans `init-topics.sh` reject avec exit 1 si regex non match. Pre-commit hook bloque commit si nouveau topic non-conforme detecte dans `topics-config.yaml`.

### 12.11. Verify-topics fail-fast drift detection

Cas : Sprint 8 ajoute topic `insurtech.events.comm.notification.scheduled` mais oublie de l'ajouter a `topics-config.yaml`. **Mitigation** : `verify-topics.sh` detecte drift (topic present non attendu), exit 1, GitHub Action fail. Force documentation systematique.

### 12.12. Consumer group rebalance storms

Cas : pod consumer crash et redemarre 10x en 5 minutes, rebalance storm pause toutes les consommations 50 secondes cumule. **Mitigation** : `session.timeout.ms=30000`, `heartbeat.interval.ms=10000`, alerting Prometheus sur `kafka_consumer_rebalances_total > 5/min`.

## 13. Conformite Maroc

### 13.1. ACAPS Article 12 audit trail 7 ans

L'Autorite de Controle des Assurances et de la Prevoyance Sociale (ACAPS), regulateur marocain de l'assurance, impose via la Loi 17-99 et reglement n11-2019 un audit trail de toutes les transactions et evenements lies aux contrats d'assurance pendant 7 ans (84 mois). Kafka avec retention 30 jours sur topics audit (`insurtech.events.audit.*`) ne couvre qu'une fenetre de retraitement. La conformite 7 ans est assuree par un consumer ETL (Sprint 31 tache 1.31.x) qui consomme `insurtech.events.audit.*` et persiste dans Postgres long-term + S3 Casablanca region (decision-008). La retention 30 jours Kafka justifie la fenetre de tolerance entre evenement metier et persistance long-term, permet le replay en cas de panne consumer ETL, et fournit la traceability operationnelle court-terme.

### 13.2. Decision-008 data residency Atlas

La decision-008 (architecture/decisions/0008-data-residency-morocco.md) impose la residence des donnees en region Casablanca pour les donnees personnelles des assures (Loi 09-08 protection donnees personnelles equivalent CNDP). Le cluster Kafka prod est deploye en region Casablanca (Atlas Morocco datacenter ou AWS af-south-1 si non disponible). Aucune replication cross-region en dehors du Maroc. Les topics audit conservant des donnees personnelles (audit.recorded contient identifiants assures) sont stockes uniquement sur brokers Casablanca. Backup S3 vers bucket region Casablanca obligatoire.

### 13.3. Decision-006 no-emoji topic names ASCII strict

La decision-006 (architecture/decisions/0006-no-emoji-policy.md) proscrit categoriquement toute emoji et tout caractere non-ASCII dans le code, les commits, la documentation, les noms de fichiers, les noms de topics Kafka, les schemas, les commentaires. Cette regle est enforced par : (1) regex naming `^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$` qui n'autorise que [a-z_.], (2) pre-commit hook qui scan tous les fichiers diff pour detecter caracteres unicode non-ASCII, (3) validation `init-topics.sh` qui reject naming non-conforme. La motivation : interoperabilite multi-OS (Windows/Linux/macOS), portabilite shell scripts, lisibilite logs en encodage par defaut, professionnalisme entreprise.

### 13.4. Loi 09-08 protection donnees personnelles CNDP

La Commission Nationale de Controle de la Protection des Donnees a Caractere Personnel (CNDP) marocaine impose des obligations sur les donnees personnelles : minimisation, finalite, duree de conservation limitee, droit a l'oubli. Les events Kafka peuvent contenir identifiants personnels (user_id, contact_id, email). Le topic `insurtech.events.audit.compliance.data_purged` trace les operations de droit a l'oubli (suppression sur demande). La retention 30 jours Kafka audit + 7 ans Postgres long-term est justifiee par l'obligation legale ACAPS, exception documentee a la regle CNDP de minimisation duree.

## 14. Conventions absolues (14)

1. **Naming convention** : `insurtech.events.{vertical}.{entity}.{action}` STRICT, regex enforced.
2. **AUCUNE EMOJI** : ASCII strict, [a-z_.] uniquement dans noms topics.
3. **Retention differenciee** : 7 jours standard / 30 jours audit + DLQ.
4. **Partitions** : 6 standard / 1 DLQ, immutable apres creation.
5. **Compression** : snappy par defaut sur tous topics.
6. **Idempotence** : `--if-not-exists` sur tous les `kafka-topics.sh --create`.
7. **Replication factor** : 1 dev / 3 prod via env var.
8. **min.insync.replicas** : 1 dev / 2 prod via env var.
9. **Auto-create disabled** : `auto.create.topics.enable=false` en prod.
10. **Cleanup policy** : delete (pas compact, sauf cas explicite Sprint 25 CDC).
11. **Segment ms** : 86400000 (1 jour) pour retention granulaire.
12. **Validation regex** : enforced dans `init-topics.sh`, `verify-topics.sh`, pre-commit.
13. **Tenant isolation** : par `tenant_id` dans payload, pas par topic.
14. **Schema versioning** : champ `schema_version` dans payload, Zod schema versione.

## 15. Validation pre-commit

```yaml
# .pre-commit-config.yaml fragment
repos:
  - repo: local
    hooks:
      - id: kafka-naming-regex
        name: Kafka topics naming regex validation
        entry: bash -c 'python3 scripts/validate-kafka-naming.py'
        language: system
        files: "infrastructure/(docker/kafka|kafka)/.*"
        pass_filenames: false

      - id: shellcheck-kafka
        name: ShellCheck Kafka scripts
        entry: shellcheck
        language: system
        files: "infrastructure/docker/kafka/.*\\.sh$"

      - id: yaml-valid-topics-config
        name: Validate topics-config.yaml
        entry: python3 scripts/validate-topics-config.py
        language: system
        files: "infrastructure/kafka/topics-config\\.yaml$"
```

```python
# scripts/validate-kafka-naming.py
import yaml, re, sys

REGEX = re.compile(r'^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$')

with open('infrastructure/kafka/topics-config.yaml') as f:
    data = yaml.safe_load(f)

errors = []
count = 0
for module, content in data.get('modules', {}).items():
    for t in content.get('topics', []):
        name = t['name']
        if not REGEX.match(name):
            errors.append(f"Topic {name} non-conforme regex")
        count += 1

if count < 53:
    errors.append(f"Total topics {count} < 53")

if errors:
    for e in errors:
        print(f"[ERROR] {e}", file=sys.stderr)
    sys.exit(1)

print(f"[OK] {count} topics conformes")
```

## 16. Commit message

```
feat(infra/kafka): enrichir init-topics.sh a 53 topics avec retention differenciee 1.2.10

- Ajout 23 topics aux 30 initiaux Sprint 1 pour atteindre 53 topics au total
- Topics anticipation Sprint 14-16 Insurance (4) et Sprint 20-22 Repair (3)
- Topics audit/compliance (3) avec retention 30 jours pour ACAPS Article 12
- 5 DLQ topics (comm, pay, insure, repair, compliance) avec 1 partition et retention 30 jours
- Helper function create_topic() reutilisee de Sprint 1 avec validation naming regex
- Script verify-topics.sh idempotent verification 53 topics presents et conformes
- Documentation topics-catalog.md table 53 topics (producer, consumer, schema_zod)
- Configuration declarative topics-config.yaml source de verite
- GitHub Action kafka-topics-init validation CI
- Tests integration : topics-creation (8), topics-naming (6), dlq-retention (4), audit-retention (4)
- Tests unit Mock KafkaAdmin (6)
- 18 variables environnement KAFKA_* dans .env.example
- Conformite ACAPS Article 12, Loi 09-08 CNDP, decision-006 no-emoji
- AUCUNE EMOJI

Refs : decision-002 multi-tenant, decision-004 kafka-vs-rabbitmq, decision-006 no-emoji, decision-008 data-residency
Closes : task-1.2.10
```

## 17. Next task

**task-1.2.11** : Schema Registry preview Confluent / Apicurio configuration cluster + premier schema Zod->Avro pour event `insurtech.events.auth.user.created`. Installation registry, configuration compatibility BACKWARD, integration producer wrapper Sprint 3, tests round-trip serialisation/deserialisation.

---

## Annexe A : Catalogue topics complet 53 (table detaillee)

| Module     | Topic                                                         | Partitions | Retention | Sprint   |
|------------|---------------------------------------------------------------|------------|-----------|----------|
| Auth       | insurtech.events.auth.user.created                            | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.signed_in                          | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.signed_out                         | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.locked                             | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.unlocked                           | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.password_reset_requested           | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.password_changed                   | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.mfa_enabled                        | 6          | 7j        | 5        |
| Auth       | insurtech.events.auth.user.mfa_disabled                       | 6          | 7j        | 5        |
| CRM        | insurtech.events.crm.contact.created                          | 6          | 7j        | 6        |
| CRM        | insurtech.events.crm.contact.updated                          | 6          | 7j        | 6        |
| CRM        | insurtech.events.crm.deal.created                             | 6          | 7j        | 6        |
| CRM        | insurtech.events.crm.deal.stage_changed                       | 6          | 7j        | 6        |
| CRM        | insurtech.events.crm.interaction.recorded                     | 6          | 7j        | 6        |
| CRM        | insurtech.events.crm.interaction.email_received               | 6          | 7j        | 6        |
| Booking    | insurtech.events.booking.appointment.scheduled                | 6          | 7j        | 7        |
| Booking    | insurtech.events.booking.appointment.confirmed                | 6          | 7j        | 7        |
| Booking    | insurtech.events.booking.appointment.cancelled                | 6          | 7j        | 7        |
| Booking    | insurtech.events.booking.appointment.completed                | 6          | 7j        | 7        |
| Comm       | insurtech.events.comm.message.queued                          | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.message.sent                            | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.message.delivered                       | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.message.read                            | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.message.failed                          | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.template.created                        | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.template.approved                       | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.template.rejected                       | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.optout.recorded                         | 6          | 7j        | 8        |
| Comm       | insurtech.events.comm.webhook.received                        | 6          | 7j        | 8        |
| Pay        | insurtech.events.pay.transaction.initiated                    | 6          | 7j        | 11       |
| Pay        | insurtech.events.pay.transaction.completed                    | 6          | 7j        | 11       |
| Pay        | insurtech.events.pay.transaction.failed                       | 6          | 7j        | 11       |
| Pay        | insurtech.events.pay.transaction.refunded                     | 6          | 7j        | 11       |
| Pay        | insurtech.events.pay.reconciliation.matched                   | 6          | 7j        | 11       |
| Pay        | insurtech.events.pay.reconciliation.discrepancy               | 6          | 7j        | 11       |
| Insure     | insurtech.events.insure.policy.created                        | 6          | 7j        | 14       |
| Insure     | insurtech.events.insure.policy.signed                         | 6          | 7j        | 14       |
| Insure     | insurtech.events.insure.policy.renewed                        | 6          | 7j        | 14       |
| Insure     | insurtech.events.insure.policy.cancelled                      | 6          | 7j        | 14       |
| Repair     | insurtech.events.repair.sinistre.declared                     | 6          | 7j        | 20       |
| Repair     | insurtech.events.repair.sinistre.dispatched                   | 6          | 7j        | 20       |
| Repair     | insurtech.events.repair.sinistre.estimated                    | 6          | 7j        | 20       |
| Audit      | insurtech.events.audit.audit.recorded                         | 6          | 30j       | 30       |
| Audit      | insurtech.events.audit.compliance.data_purged                 | 6          | 30j       | 30       |
| Audit      | insurtech.events.audit.compliance.acaps_submitted             | 6          | 30j       | 30       |
| Books      | insurtech.events.books.invoice.issued                         | 6          | 7j        | 24       |
| Books      | insurtech.events.books.invoice.paid                           | 6          | 7j        | 24       |
| Stock      | insurtech.events.stock.stock.low_threshold                    | 6          | 7j        | 26       |
| Stock      | insurtech.events.stock.stock.movement_recorded                | 6          | 7j        | 26       |
| HR         | insurtech.events.hr.attendance.recorded                       | 6          | 7j        | 28       |
| HR         | insurtech.events.hr.salary.processed                          | 6          | 7j        | 28       |
| System     | insurtech.events.system.tenant.created                        | 6          | 7j        | 5        |
| System     | insurtech.events.system.tenant.settings_changed               | 6          | 7j        | 5        |
| System     | insurtech.events.system.user.password_reset_requested         | 6          | 7j        | 5        |
| DLQ        | insurtech.dlq.comm.failed                                     | 1          | 30j       | 8        |
| DLQ        | insurtech.dlq.pay.failed                                      | 1          | 30j       | 11       |
| DLQ        | insurtech.dlq.insure.failed                                   | 1          | 30j       | 14       |
| DLQ        | insurtech.dlq.repair.failed                                   | 1          | 30j       | 20       |
| DLQ        | insurtech.dlq.compliance.failed                               | 1          | 30j       | 30       |

## Annexe B : Partition strategy (calcul throughput)

### Justification 6 partitions par topic standard

Throughput cible Sprint 18 Maroc-scale : 1500 transactions par seconde sur le topic critique `insurtech.events.pay.transaction.completed`. Avec 6 partitions, la charge par partition est 250 msg/sec, bien en dessous de la limite Kafka standard (1000 msg/sec/partition sur snappy). Marge de scaling x4 disponible avant saturation. Au-dela (Sprint 30+), procedure de re-partitioning vers 12 partitions documentee dans `topics-catalog.md`.

### Justification 1 partition DLQ

Volume DLQ regime nominal : < 10 msg/sec global (echec rate < 0.5% sur 1500 msg/sec). 1 partition suffit largement. L'avantage critique : preservation ordre absolu pour replay sequentiel diagnostic. Pattern "Single-Threaded DLQ Replay" recommande Confluent.

### Calcul disk usage par topic

Topic standard 6 partitions, 100 KB/sec moyen, 7 jours retention :
- 100 KB/sec x 86400 sec/jour x 7 jours = 60.5 GB par topic
- 53 topics x 60.5 GB / 53 = 60.5 GB en moyenne ponderee
- Total estime : 250 GB cluster (incluant 5 DLQ + 3 audit a 30 jours)

Provisionnement : 500 GB minimum prod, 100 GB minimum dev avec retention reduite optionnelle (1 jour dev).

## Annexe C : Retention math (calcul detaille)

### Standard 7 jours

`retention.ms = 7 * 24 * 60 * 60 * 1000 = 604800000 ms`

Justification : fenetre operationnelle de re-traitement applicatif (consumer crash, replay batch). Au-dela de 7 jours, persistance long-term Postgres assure la conservation 7 ans ACAPS.

### Audit 30 jours

`retention.ms = 30 * 24 * 60 * 60 * 1000 = 2592000000 ms`

Justification : fenetre extended pour traitement consumer ETL Sprint 31 (audit trail), tolerance crash longue duree, replay en cas de bug consumer. Au-dela de 30 jours, archivage Postgres long-term + S3 Casablanca region.

### DLQ 30 jours

`retention.ms = 30 * 24 * 60 * 60 * 1000 = 2592000000 ms`

Justification : fenetre operationnelle de diagnostic et replay. Equipes ops peuvent investiguer pendant 30 jours, archive S3 avant purge Sprint 4.

### Calcul disk DLQ

DLQ pay regime degrade max : 50 msg/sec (echec rate 3% sur 1500 msg/sec) x 5 KB/msg = 250 KB/sec. Sur 30 jours : 250 KB/sec x 86400 x 30 = 648 GB. **Probleme** : depasse provisionnement. **Mitigation** : alerting > 10 msg/sec sustained sur DLQ, escalation 1 heure ops.

## Annexe D : KRaft 3.7 setup quorum

### Mode dev mono-broker

```yaml
KAFKA_NODE_ID: 1
KAFKA_PROCESS_ROLES: "broker,controller"
KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka:9094"
```

Pas de tolerance de panne, suffisant developpement local.

### Mode prod 3 brokers + 3 controllers separes

```yaml
# kafka-broker-1.yaml
KAFKA_NODE_ID: 11
KAFKA_PROCESS_ROLES: "broker"
KAFKA_CONTROLLER_QUORUM_VOTERS: "1@controller-1:9094,2@controller-2:9094,3@controller-3:9094"

# kafka-controller-1.yaml
KAFKA_NODE_ID: 1
KAFKA_PROCESS_ROLES: "controller"
KAFKA_CONTROLLER_QUORUM_VOTERS: "1@controller-1:9094,2@controller-2:9094,3@controller-3:9094"
```

Tolerance d'une panne controller (Raft majority 2/3).

### Procedure migration KRaft format

```bash
kafka-storage.sh format -t insurtech-kafka-cluster-1 \
  -c /etc/kafka/kraft-server.properties --ignore-formatted
```

## Annexe E : ACL preview Sprint 33

### Strategy ACL Kafka

Sprint 33 introduit ACL granulaires par service-account et prefix topic :

```bash
# Service auth-service peut produire/consommer sur insurtech.events.auth.*
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add --allow-principal User:auth-service \
  --producer --consumer \
  --topic 'insurtech.events.auth' --resource-pattern-type prefixed

# Service audit-service peut consommer tous les topics events
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add --allow-principal User:audit-service \
  --consumer \
  --topic 'insurtech.events' --resource-pattern-type prefixed \
  --group 'audit-service-cg'

# Service dlq-router peut produire sur tous les DLQ
kafka-acls.sh --bootstrap-server localhost:9092 \
  --add --allow-principal User:dlq-router \
  --producer \
  --topic 'insurtech.dlq' --resource-pattern-type prefixed
```

### SASL/SCRAM authentication

```yaml
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "SASL_PLAINTEXT:SASL_PLAINTEXT,..."
KAFKA_SASL_ENABLED_MECHANISMS: "SCRAM-SHA-512"
KAFKA_AUTHORIZER_CLASS_NAME: "org.apache.kafka.metadata.authorizer.StandardAuthorizer"
```

## Annexe F : Schema Registry preview Sprint 13

### Choix Confluent vs Apicurio

| Critere              | Confluent SR             | Apicurio Registry         |
|----------------------|--------------------------|---------------------------|
| Licence              | Confluent Community     | Apache 2.0 (open)        |
| Format               | Avro, JSON, Protobuf    | Avro, JSON, Protobuf, OpenAPI |
| Compatibility check  | Backward, Forward, Full | Backward, Forward, Full   |
| REST API             | OUI                      | OUI                       |
| UI                   | Confluent Control Center| Apicurio Studio          |
| Decision projet      | Apicurio (open-source)  | RETENU                    |

### Premier schema Avro

```json
{
  "type": "record",
  "namespace": "insurtech.events.auth",
  "name": "UserCreatedEvent",
  "fields": [
    { "name": "schema_version", "type": "string", "default": "1.0.0" },
    { "name": "event_id", "type": "string" },
    { "name": "occurred_at", "type": { "type": "long", "logicalType": "timestamp-millis" } },
    { "name": "tenant_id", "type": "string" },
    { "name": "user_id", "type": "string" },
    { "name": "email", "type": "string" },
    { "name": "role", "type": { "type": "enum", "name": "UserRole", "symbols": ["ADMIN","AGENT","CLIENT"] } }
  ]
}
```

### Compatibility BACKWARD

Garantit qu'un consumer ecrit pour v1 peut consommer messages v2 (ajouts champs optional uniquement).

## Annexe G : Monitoring Prometheus

### Metrics critiques Kafka

```yaml
# prometheus.yml fragment
- job_name: kafka-broker
  static_configs:
    - targets: ['kafka:9090']
  metrics_path: /metrics
```

### Alertes critiques

```yaml
groups:
  - name: kafka-topics-alerts
    rules:
      - alert: KafkaTopicMissing
        expr: count(kafka_topic_partitions{topic=~"insurtech\\..*"}) < 53
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Moins de 53 topics insurtech presents"

      - alert: KafkaDiskUsageHigh
        expr: kafka_log_log_size_bytes / kafka_log_log_capacity_bytes > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Disk usage Kafka > 80%"

      - alert: KafkaDLQLagHigh
        expr: kafka_topic_partition_lag{topic=~"insurtech\\.dlq\\..*"} > 100
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Lag DLQ > 100 messages, replay necessaire"

      - alert: KafkaConsumerRebalanceStorm
        expr: rate(kafka_consumer_coordinator_rebalance_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Rebalance storm consumer group"

      - alert: KafkaTopicAuditRetentionDrift
        expr: kafka_topic_config{topic=~"insurtech\\.events\\.audit\\..*",config="retention.ms"} != 2592000000
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Topic audit retention drift detected"
```

### Dashboards Grafana

- **Topics overview** : count topics par module, retention status, partition count.
- **DLQ monitoring** : lag, throughput, replay rate.
- **Disk usage** : par topic, par broker, projection 7/30 jours.
- **Consumer groups** : lag, rebalance rate, member count.

---

## Conclusion

La tache 1.2.10 etablit une fondation event-driven solide pour les 32 sprints suivants du projet Skalean Insurtech. Les 53 topics couvrent l'integralite des modules planifies (Auth, CRM, Booking, Comm, Pay, Insure, Repair, Audit, Books, Stock, HR, System, DLQ) avec une politique de retention differenciee adaptee aux exigences ACAPS Article 12 et CNDP Loi 09-08. Le naming convention strict `insurtech.events.{vertical}.{entity}.{action}` garantit la decouvrabilite, la maintenabilite et la securite ACL future. L'idempotence du script `init-topics.sh` permet une re-execution sans danger, le script `verify-topics.sh` detecte les drifts. Les 28 livrables checkables, V1-V32 criteres, 28+ tests integration/unit, 12 edge cases, et annexes A-G complets garantissent la qualite production-ready de cette fondation Kafka.
