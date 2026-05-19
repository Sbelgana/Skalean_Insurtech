import type { DynamicModule, Provider } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import type { KafkaConfig, Producer, SASLOptions } from 'kafkajs';
import * as os from 'node:os';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
  KafkaPublisherOptionsSchema,
} from './kafka-publisher.config.js';
import type { KafkaPublisherOptions } from './kafka-publisher.config.js';
import { KafkaPublisherService } from './kafka-publisher.service.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';

export type KafkaPublisherForRootOptions = Partial<KafkaPublisherOptions> & {
  brokers: string[];
  clientId: string;
};

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
        transactionalIdPrefix: opts.producer?.transactionalIdPrefix ?? `${opts.clientId}-tx`,
        maxInFlightRequests: opts.producer?.maxInFlightRequests ?? 5,
        allowAutoTopicCreation: opts.producer?.allowAutoTopicCreation ?? false,
        acks: opts.producer?.acks ?? -1,
        compression: opts.producer?.compression ?? 'snappy',
        messageMaxBytes: opts.producer?.messageMaxBytes ?? 1_048_576,
        requestTimeoutMs: opts.producer?.requestTimeoutMs ?? 10_000,
        connectionTimeoutMs: opts.producer?.connectionTimeoutMs ?? 3_000,
      },
      retry: opts.retry ?? { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 2_000, jitter: true },
      circuitBreaker: opts.circuitBreaker ?? {
        enabled: true,
        threshold: 5,
        resetMs: 30_000,
        halfOpenAfterMs: 15_000,
        timeoutMs: 15_000,
      },
      outbox: opts.outbox ?? {
        enabled: true,
        table: 'outbox_events',
        fallbackOnCircuitOpen: true,
      },
      observability: opts.observability ?? {
        serviceName: opts.clientId,
        metricsPrefix: 'kafka_publish',
        sampleRate: 1,
      },
    });

    if (process.env['NODE_ENV'] === 'production' && validated.producer.allowAutoTopicCreation) {
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
        const kafkaConfig: KafkaConfig = {
          clientId: validated.clientId,
          brokers: validated.brokers,
          ssl: validated.ssl,
          connectionTimeout: validated.producer.connectionTimeoutMs,
          requestTimeout: validated.producer.requestTimeoutMs,
        };
        // Conditionally attach sasl to avoid exactOptionalPropertyTypes issues.
        // Runtime-validated by Zod so cast to SASLOptions is safe.
        if (validated.sasl !== undefined) {
          kafkaConfig.sasl = validated.sasl as SASLOptions;
        }
        const kafka = new Kafka(kafkaConfig);
        const podName = process.env['POD_NAME'] ?? os.hostname();
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
