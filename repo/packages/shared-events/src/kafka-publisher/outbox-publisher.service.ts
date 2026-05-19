import { Inject, Injectable } from '@nestjs/common';
import type { Logger as PinoLogger } from 'pino';
import { KAFKA_PUBLISHER_OPTIONS } from './kafka-publisher.config.js';
import type { KafkaPublisherOptions } from './kafka-publisher.config.js';
import { OutboxUnavailableError } from './errors.js';
import type { EventEnvelope } from '../types/event-envelope.js';

@Injectable()
export class OutboxPublisherService {
  private readonly logger: PinoLogger;
  private outboxAvailable = false;
  // DataSource type is not available here - use a generic interface
  private readonly dataSource: { query: (sql: string, params?: unknown[]) => Promise<unknown> } | undefined;

  constructor(
    @Inject(KAFKA_PUBLISHER_OPTIONS) private readonly options: KafkaPublisherOptions,
    @Inject('PINO_LOGGER') logger: PinoLogger,
    @Inject('TYPEORM_DATASOURCE') dataSource?: unknown,
  ) {
    this.logger = logger.child({ component: 'OutboxPublisherService' });
    if (
      dataSource !== null &&
      dataSource !== undefined &&
      typeof dataSource === 'object' &&
      'query' in dataSource &&
      typeof (dataSource as { query: unknown }).query === 'function'
    ) {
      this.dataSource = dataSource as { query: (sql: string, params?: unknown[]) => Promise<unknown> };
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.options.outbox.enabled) {
      this.logger.info('Outbox publisher disabled by config');
      return;
    }
    if (this.dataSource === undefined) {
      this.logger.warn(
        'Outbox enabled but no DataSource injected; outbox fallback unavailable until Sprint 35',
      );
      return;
    }
    try {
      await this.dataSource.query(`SELECT 1 FROM ${this.options.outbox.table} LIMIT 0`);
      this.outboxAvailable = true;
      this.logger.info(
        { table: this.options.outbox.table },
        'Outbox table reachable, fallback enabled',
      );
    } catch (err) {
      this.outboxAvailable = false;
      this.logger.warn(
        { err, table: this.options.outbox.table },
        'Outbox table unavailable; Sprint 35 not yet activated',
      );
    }
  }

  async enqueue<T>(
    topic: string,
    envelope: EventEnvelope<T>,
    partitionKey: string,
    headers: Record<string, string>,
  ): Promise<void> {
    if (!this.outboxAvailable || this.dataSource === undefined) {
      this.logger.warn(
        { topic, event_id: envelope.event_id },
        'Outbox unavailable; message dropped (Sprint 35 will fix)',
      );
      throw new OutboxUnavailableError(this.options.outbox.table, undefined);
    }
    await this.dataSource.query(
      `INSERT INTO ${this.options.outbox.table}
        (event_id, topic, partition_key, headers, payload, tenant_id, correlation_id, occurred_at, status)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, 'pending')`,
      [
        envelope.event_id,
        topic,
        partitionKey,
        JSON.stringify(headers),
        JSON.stringify(envelope),
        envelope.tenant_id,
        envelope.correlation_id,
        envelope.occurred_at,
      ],
    );
    this.logger.info(
      { event_id: envelope.event_id, topic, status: 'pending_outbox' },
      'Event enqueued to outbox for replay',
    );
  }
}
