# ADR-004 : Kafka KRaft retenu (vs RabbitMQ)

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad Belgana (CTO)
**Mirror** : `00-pilotage/decisions/004-kafka-vs-rabbitmq.md`

## Contexte

Event bus pour 4 cas d'usage :
- Event sourcing (history immutable)
- Async processing (workers async)
- Audit trail durable (compliance)
- Inter-modules communication (decouplage)

Options : Apache Kafka 3.7 KRaft, RabbitMQ, NATS JetStream, Redis Streams.

## Decision

**Apache Kafka 3.7.1 KRaft mode retenu**.

Avantages cle :
1. **Event sourcing natif** : retention configurable + replay
2. **KRaft (no Zookeeper)** : 1 conteneur self-suffisant (vs 2 historique)
3. **Throughput** : 100k+ msgs/s par broker
4. **Ecosystem** : Kafka Connect, Streams, Schema Registry future

Configuration :
- 30+ topics initiaux Sprint 1 (catalog `insurtech.events.{vertical}.{entity}.{action}`)
- 3 partitions defaut, 6 high-throughput, 1 DLQ
- Retention 7 jours standard, 30 jours DLQ
- Compression lz4
- Replication 1 dev / 3 prod

## Consequences

### Positives (+)
- Event sourcing capability
- Audit trail durable (compliance ACAPS)
- Scale future
- Standard industrie

### Negatives (-)
- Complexite operationnelle vs RabbitMQ (mitige par KRaft sans Zookeeper)
- Resource usage > RabbitMQ
- Apprentissage Kafka requis par devs

## References

- decision-004 (mirror)
- Sprint 1 (B-01) Tache 1.1.6 : 30 topics catalog
- Sprint 2 (B-02) : shared-events Zod schemas + publishers
