export { KafkaConsumerBase } from './kafka-consumer.base.js';
export { KafkaConsumerModule } from './kafka-consumer.module.js';
export type { KafkaConsumerForRootOptions } from './kafka-consumer.module.js';
export { DlqPublisherService } from './dlq-publisher.service.js';
export { ConsumerValidationError, ConsumerTransientError, DlqFailureError } from './errors.js';
export type { IIdempotencyRepository } from './idempotency-repository.js';
export { IDEMPOTENCY_REPOSITORY } from './idempotency-repository.js';
export { KAFKA_CONSUMER_CLIENT, KAFKA_CONSUMER_OPTIONS } from './kafka-consumer.config.js';
export type {
  ConsumerOptions,
  RetryConfig,
  DlqMetadata,
  ResolvedConsumerOptions,
} from './kafka-consumer.types.js';
