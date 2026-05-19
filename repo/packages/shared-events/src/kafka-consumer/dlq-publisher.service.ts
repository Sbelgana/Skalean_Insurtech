import { Injectable, Inject } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { Kafka, Producer } from 'kafkajs';
import type { Logger as PinoLogger } from 'pino';
import { monotonicFactory } from 'ulid';
import { KAFKA_CONSUMER_CLIENT } from './kafka-consumer.config.js';
import type { DlqMetadata } from './kafka-consumer.types.js';

const monotonicUlid = monotonicFactory();

@Injectable()
export class DlqPublisherService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer | null = null;
  private readonly logger: PinoLogger;

  constructor(
    @Inject(KAFKA_CONSUMER_CLIENT) private readonly kafka: Kafka,
    @Inject('PINO_LOGGER') logger: PinoLogger,
  ) {
    this.logger = logger.child({ component: 'DlqPublisherService' });
  }

  async onModuleInit(): Promise<void> {
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      retry: { retries: 3 },
    });
    await this.producer.connect();
    this.logger.info({}, 'DLQ producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer !== null) {
      try {
        await this.producer.disconnect();
      } catch (err) {
        this.logger.error({ err }, 'Error disconnecting DLQ producer');
      }
      this.producer = null;
    }
  }

  async publish(dlqTopic: string, metadata: DlqMetadata): Promise<void> {
    if (this.producer === null) {
      throw new Error('DlqPublisherService: producer not initialized; onModuleInit not called');
    }
    const dlqId = monotonicUlid();
    const dlqMessage = {
      dlq_id: dlqId,
      published_at: new Date().toISOString(),
      ...metadata,
    };
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
    this.logger.warn(
      {
        dlq_topic: dlqTopic,
        event_id: metadata.original_envelope.event_id,
        error_class: metadata.error_class,
        attempt_count: metadata.attempt_count,
      },
      'Message published to DLQ',
    );
  }
}
