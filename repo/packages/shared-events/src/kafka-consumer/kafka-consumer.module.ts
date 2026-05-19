import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { KAFKA_CONSUMER_CLIENT, KAFKA_CONSUMER_OPTIONS } from './kafka-consumer.config.js';
import type { ConsumerOptions } from './kafka-consumer.types.js';
import { DlqPublisherService } from './dlq-publisher.service.js';

export type KafkaConsumerForRootOptions = ConsumerOptions & {
  brokers: string[];
  clientId: string;
  ssl?: boolean;
};

@Global()
@Module({})
export class KafkaConsumerModule {
  static forRoot(opts: KafkaConsumerForRootOptions): DynamicModule {
    const kafkaProvider: Provider = {
      provide: KAFKA_CONSUMER_CLIENT,
      useFactory: (): Kafka => {
        return new Kafka({
          clientId: opts.clientId,
          brokers: opts.brokers,
          ssl: opts.ssl ?? false,
          retry: { initialRetryTime: 300, retries: 8 },
        });
      },
    };

    const consumerOptions: ConsumerOptions = {};
    if (opts.retry !== undefined) consumerOptions.retry = opts.retry;
    if (opts.dlq !== undefined) consumerOptions.dlq = opts.dlq;
    if (opts.session !== undefined) consumerOptions.session = opts.session;
    if (opts.observability !== undefined) consumerOptions.observability = opts.observability;
    if (opts.validationStrict !== undefined) consumerOptions.validationStrict = opts.validationStrict;

    const optionsProvider: Provider = {
      provide: KAFKA_CONSUMER_OPTIONS,
      useValue: consumerOptions,
    };

    return {
      module: KafkaConsumerModule,
      providers: [kafkaProvider, optionsProvider, DlqPublisherService],
      exports: [KAFKA_CONSUMER_CLIENT, KAFKA_CONSUMER_OPTIONS, DlqPublisherService],
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
