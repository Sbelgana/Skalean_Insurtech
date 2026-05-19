import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsumerProcessedEvents1735000000008 implements MigrationInterface {
  name = 'ConsumerProcessedEvents1735000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consumer_processed_events (
        event_id  TEXT        NOT NULL,
        group_id  TEXT        NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (event_id, group_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_consumer_processed_events_processed_at
        ON consumer_processed_events (processed_at);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_consumer_processed_events_group_id
        ON consumer_processed_events (group_id, processed_at DESC);
    `);

    await queryRunner.query(`
      COMMENT ON TABLE consumer_processed_events IS
        'Idempotency registry for Kafka consumers. ' ||
        'PK (event_id, group_id) allows the same event to be processed by multiple consumer groups. ' ||
        'Retention: 30 days via scheduled cleanup (Sprint 33).';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN consumer_processed_events.event_id IS
        'ULID of the original event from EventEnvelope.event_id';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN consumer_processed_events.group_id IS
        'Kafka consumer group_id (e.g. whatsapp-notifications-handler)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_consumer_processed_events_group_id;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_consumer_processed_events_processed_at;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS consumer_processed_events;`);
  }
}
