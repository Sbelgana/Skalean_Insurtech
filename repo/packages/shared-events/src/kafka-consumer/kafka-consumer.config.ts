/**
 * DI tokens for the KafkaConsumer infrastructure.
 * KAFKA_CONSUMER_CLIENT: the KafkaJS Kafka instance used for consumer groups and DLQ producer.
 * KAFKA_CONSUMER_OPTIONS: resolved ConsumerOptions with defaults applied.
 */
export const KAFKA_CONSUMER_CLIENT = 'KAFKA_CONSUMER_CLIENT';
export const KAFKA_CONSUMER_OPTIONS = 'KAFKA_CONSUMER_OPTIONS';
