/**
 * KafkaModule -- module global qui re-expose kafkaProducer via DI NestJS.
 *
 * Cree un producer KafkaJS depuis KAFKA_BROKERS et l'expose via DI.
 * onModuleDestroy appelle producer.disconnect() pour fermeture propre.
 *
 * Reference : decision-003 (NestJS) + decision-004 (Kafka over RabbitMQ) +
 *             decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { Module, Global, type OnModuleDestroy, Inject } from '@nestjs/common';
import { kafkaProducerProvider, KAFKA_PRODUCER_TOKEN } from './kafka.provider';
import type { Producer } from 'kafkajs';

@Global()
@Module({
  providers: [kafkaProducerProvider],
  exports: [KAFKA_PRODUCER_TOKEN],
})
export class KafkaModule implements OnModuleDestroy {
  constructor(@Inject(KAFKA_PRODUCER_TOKEN) private readonly producer: Producer) {}

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }
}
