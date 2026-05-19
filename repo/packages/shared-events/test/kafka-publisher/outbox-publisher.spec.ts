import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { OutboxPublisherService } from '../../src/kafka-publisher/outbox-publisher.service.js';
import { KAFKA_PUBLISHER_OPTIONS } from '../../src/kafka-publisher/kafka-publisher.config.js';
import { OutboxUnavailableError } from '../../src/kafka-publisher/errors.js';
import pino from 'pino';

const BASE_OUTBOX_OPTIONS = {
  brokers: ['x:1'],
  clientId: 'svc',
  ssl: false,
  producer: { idempotent: true, transactionalIdPrefix: 'tx', maxInFlightRequests: 5, allowAutoTopicCreation: false, acks: -1 as const, compression: 'snappy' as const, messageMaxBytes: 1_048_576, requestTimeoutMs: 10_000, connectionTimeoutMs: 3_000 },
  retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 2_000, jitter: true },
  circuitBreaker: { enabled: true, threshold: 5, resetMs: 30_000, halfOpenAfterMs: 15_000, timeoutMs: 15_000 },
  outbox: { enabled: true, table: 'outbox_events', fallbackOnCircuitOpen: true },
  observability: { serviceName: 'svc', metricsPrefix: 'kafka_publish', sampleRate: 1 },
};

describe('OutboxPublisherService', () => {
  it('marks outbox unavailable when table absent at boot', async () => {
    const ds = { query: vi.fn().mockRejectedValue(new Error('relation does not exist')) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: BASE_OUTBOX_OPTIONS },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: 'TYPEORM_DATASOURCE', useValue: ds },
      ],
    }).compile();
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    await expect(svc.enqueue('topic', { event_id: 'x', event_name: 't', event_version: '1.0', occurred_at: new Date().toISOString(), tenant_id: null, user_id: null, correlation_id: null, payload: {} }, 'k', {})).rejects.toBeInstanceOf(OutboxUnavailableError);
  });

  it('marks outbox unavailable when no DataSource injected', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: BASE_OUTBOX_OPTIONS },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: 'TYPEORM_DATASOURCE', useValue: null },
      ],
    }).compile();
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    await expect(svc.enqueue('topic', { event_id: 'x', event_name: 't', event_version: '1.0', occurred_at: new Date().toISOString(), tenant_id: null, user_id: null, correlation_id: null, payload: {} }, 'k', {})).rejects.toBeInstanceOf(OutboxUnavailableError);
  });

  it('does not attempt to enqueue when outbox disabled', async () => {
    const opts = { ...BASE_OUTBOX_OPTIONS, outbox: { ...BASE_OUTBOX_OPTIONS.outbox, enabled: false } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: opts },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: 'TYPEORM_DATASOURCE', useValue: null },
      ],
    }).compile();
    const svc = moduleRef.get(OutboxPublisherService);
    await svc.onModuleInit();
    // When outbox disabled, outboxAvailable=false, so enqueue throws OutboxUnavailableError
    await expect(svc.enqueue('t', { event_id: 'x', event_name: 't', event_version: '1.0', occurred_at: new Date().toISOString(), tenant_id: null, user_id: null, correlation_id: null, payload: {} }, 'k', {})).rejects.toBeInstanceOf(OutboxUnavailableError);
  });

  it('OutboxUnavailableError has correct tableName', () => {
    const err = new OutboxUnavailableError('my_outbox', new Error('cause'));
    expect(err.tableName).toBe('my_outbox');
    expect(err.name).toBe('OutboxUnavailableError');
  });
});
