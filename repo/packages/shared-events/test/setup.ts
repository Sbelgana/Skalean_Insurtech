/**
 * Shared test setup for shared-events integration tests.
 * Re-exports Kafka/Redis helpers from database/test/setup.
 * Aucune emoji (decision-006).
 */
export {
  ensureKafkaTopics,
  deleteKafkaTopics,
  flushRedis,
  waitFor,
} from '../../database/test/setup.js';
