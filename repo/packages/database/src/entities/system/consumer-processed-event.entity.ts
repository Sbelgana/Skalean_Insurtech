import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Idempotency table for Kafka consumers.
 * Prevents double-processing when a consumer restarts mid-flight.
 * Composite PK (event_id, group_id) allows the same event to be consumed
 * by multiple independent consumer groups without conflict.
 *
 * Retention: 30 days via scheduled cleanup (Sprint 33).
 */
@Entity({ name: 'consumer_processed_events' })
@Index('idx_consumer_processed_events_processed_at', ['processedAt'])
@Index('idx_consumer_processed_events_group_id', ['groupId', 'processedAt'])
export class ConsumerProcessedEvent {
  @PrimaryColumn({ name: 'event_id', type: 'text' })
  eventId!: string;

  @PrimaryColumn({ name: 'group_id', type: 'text' })
  groupId!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
