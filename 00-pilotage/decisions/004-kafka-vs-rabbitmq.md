# Decision 004 -- Kafka KRaft vs RabbitMQ

**Date** : 2025-12
**Statut** : Acceptee
**Decideurs** : Saad (CTO)
**ADR mirror** : `repo/docs/architecture/ADR-004-kafka-vs-rabbitmq.md`

---

## Contexte

Plateforme distribuee 9 apps + 21 packages necessite **event-driven architecture** :
- Pay event "transaction.completed" -> Books generate ecritures auto
- Insure event "policy.signed" -> Comm send confirmation + Compliance audit ACAPS
- Repair event "sinistre.dispatched" -> Cross-tenant routing + notification

30+ topics Kafka prevus (Sprint 2 catalog).

## Probleme adresse

- Event streaming high-throughput (1000+ events/sec en pilote, 10000+ en scale)
- Guaranteed delivery (at-least-once) pour audit ACAPS + compliance
- Replay events possible pour ETL ClickHouse (Sprint 13)
- Multi-consumer per topic (CRM + Compliance + Analytics consume meme event)
- Operations simplifiees (vs ZooKeeper legacy)

## Decision

**Kafka 3.7 mode KRaft (sans ZooKeeper)** retenu.

Rationale :
- Throughput superieur RabbitMQ (10x sur cas streaming)
- Replay events natif (vs RabbitMQ requiert plugin)
- Multi-consumer groups : CRM/Books/Analytics consume meme event independamment
- KRaft 3.x : ops simplifiees (1 cluster vs Kafka+ZooKeeper)
- Topics catalog versionned (vs RabbitMQ exchanges/queues fragiles)

RabbitMQ rejete car :
- Throughput inferieur sur volumes Skalean prevus
- Replay events pas natif (plugin tiers requis)
- Configuration exchanges/queues plus complexe
- Pas optimise OLAP downstream (ClickHouse Sprint 13)

## Avantages

1. Throughput haut + low latency
2. Replay events natif pour ETL + debugging
3. Multi-consumer groups independants
4. KRaft simplification ops (vs ZooKeeper)
5. Industry standard event streaming

## Inconvenients

1. Complexite operationnelle initiale (vs RabbitMQ simpler)
2. Resource consumption RAM/disk superieur
3. Curve learning equipe

## Impact technique

- **Sprint 1** : Kafka KRaft Docker Compose dev
- **Sprint 2** : 30+ topics catalog `insurtech.events.{vertical}.{entity}.{action}` + producer/consumer base
- Tous sprints metier : publishers Kafka events + consumers async
- **Sprint 13** : ETL Postgres -> ClickHouse via Kafka events

## Communication

Equipe : pattern publisher Kafka via Pattern 8 (`4-templates-generation.md`).

## References

- Sprint 1, 2 : implementation Kafka KRaft
- Topics catalog : `documentation/3-schemas-database-PARTIE1.sql` (events tables)
- ADR-004 : benchmarks Kafka vs RabbitMQ
