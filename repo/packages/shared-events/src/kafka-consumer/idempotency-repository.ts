/**
 * Idempotency repository interface for KafkaConsumerBase.
 * Concrete implementations (TypeORM, in-memory for tests) satisfy this contract.
 * The TypeORM entity and migration live in @insurtech/database.
 */

export interface IIdempotencyRepository {
  /**
   * Atomically attempt to insert a (event_id, group_id) pair.
   * Returns true if the row was inserted (first processing).
   * Returns false if the row already exists (duplicate, skip).
   */
  tryInsert(eventId: string, groupId: string): Promise<boolean>;
}

export const IDEMPOTENCY_REPOSITORY = 'IDEMPOTENCY_REPOSITORY';
