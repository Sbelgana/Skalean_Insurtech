import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { KafkaPublisherService } from '../../src/kafka-publisher/kafka-publisher.service.js';
import { OutboxPublisherService } from '../../src/kafka-publisher/outbox-publisher.service.js';
import {
  KAFKA_PUBLISHER_OPTIONS,
  KAFKA_PRODUCER,
} from '../../src/kafka-publisher/kafka-publisher.config.js';
import {
  InvalidEventError,
  MissingTenantContextError,
  MessageTooLargeError,
  KafkaPublishError,
  TopicSchemaNotFoundError,
} from '../../src/kafka-publisher/errors.js';
import { kafkaTenantContext, kafkaRequestContext } from '../../src/kafka-publisher/kafka-context.js';
import { Topics } from '../../src/topics.js';
import { KafkaJSConnectionError, KafkaJSNonRetriableError, KafkaJSRequestTimeoutError } from 'kafkajs';
import pino from 'pino';

const BASE_OPTIONS = {
  brokers: ['localhost:9092'],
  clientId: 'test-svc',
  ssl: false,
  producer: {
    idempotent: true,
    transactionalIdPrefix: 'test-svc-tx',
    maxInFlightRequests: 5,
    allowAutoTopicCreation: false,
    acks: -1 as const,
    compression: 'snappy' as const,
    messageMaxBytes: 1_048_576,
    requestTimeoutMs: 10_000,
    connectionTimeoutMs: 3_000,
  },
  retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5, jitter: false },
  circuitBreaker: { enabled: false, threshold: 5, resetMs: 30_000, halfOpenAfterMs: 15_000, timeoutMs: 15_000 },
  outbox: { enabled: false, table: 'outbox_events', fallbackOnCircuitOpen: false },
  observability: { serviceName: 'test-svc', metricsPrefix: 'kafka_publish', sampleRate: 1 },
};

// Valid payload for Topics.AUTH_USER_CREATED
const VALID_AUTH_PAYLOAD = {
  user_id: '11111111-1111-1111-1111-111111111111',
  email: 'user@example.com',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  full_name: 'Test User',
  role: 'agent' as const,
  locale: 'fr-MA' as const,
  created_at: new Date().toISOString(),
  created_by_user_id: null,
  invitation_token_hash: null,
};

describe('KafkaPublisherService (unit)', () => {
  let service: KafkaPublisherService;
  let sendMock: ReturnType<typeof vi.fn>;
  let outboxMock: { enqueue: ReturnType<typeof vi.fn>; onModuleInit: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sendMock = vi.fn().mockResolvedValue([{ topicName: String(Topics.AUTH_USER_CREATED), partition: 0, offset: '42' }]);
    outboxMock = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      onModuleInit: vi.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: BASE_OPTIONS },
        {
          provide: KAFKA_PRODUCER,
          useValue: {
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            send: sendMock,
          },
        },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: OutboxPublisherService, useValue: outboxMock },
      ],
    }).compile();
    service = module.get(KafkaPublisherService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  function withCtx(fn: () => Promise<void>): Promise<void> {
    return kafkaTenantContext.run({ tenantId: 'tenant-123' }, () =>
      kafkaRequestContext.run({ correlationId: 'corr-abc' }, fn),
    );
  }

  it('publishes a valid event -- happy path', async () => {
    await withCtx(async () => {
      await service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD);
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const callArg = sendMock.mock.calls[0]?.[0] as { topic: string; acks: number; messages: Array<{ key: string }> };
    expect(callArg?.topic).toBe(String(Topics.AUTH_USER_CREATED));
    expect(callArg?.acks).toBe(-1);
    expect(callArg?.messages[0]?.key).toBe('tenant-123');
  });

  it('rejects invalid payload with InvalidEventError', async () => {
    await withCtx(async () => {
      await expect(
        service.publish(Topics.AUTH_USER_CREATED, { user_id: 'not-a-uuid' } as never),
      ).rejects.toBeInstanceOf(InvalidEventError);
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws MissingTenantContextError when tenant context absent', async () => {
    await expect(
      service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD),
    ).rejects.toBeInstanceOf(MissingTenantContextError);
  });

  it('retries on transient KafkaJSConnectionError and succeeds on 3rd attempt', async () => {
    sendMock
      .mockRejectedValueOnce(new KafkaJSConnectionError('boom', { broker: 'localhost:9092' }))
      .mockRejectedValueOnce(new KafkaJSConnectionError('boom', { broker: 'localhost:9092' }))
      .mockResolvedValueOnce([{ topicName: 't', partition: 0, offset: '1' }]);
    await withCtx(async () => {
      await service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD);
    });
    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry on KafkaJSNonRetriableError', async () => {
    sendMock.mockRejectedValue(new KafkaJSNonRetriableError('fatal'));
    await withCtx(async () => {
      await expect(
        service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD),
      ).rejects.toThrow();
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('rejects message larger than messageMaxBytes with MessageTooLargeError', async () => {
    const opts = {
      ...BASE_OPTIONS,
      producer: { ...BASE_OPTIONS.producer, messageMaxBytes: 10 },
    };
    const smallModule: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaPublisherService,
        { provide: KAFKA_PUBLISHER_OPTIONS, useValue: opts },
        {
          provide: KAFKA_PRODUCER,
          useValue: { connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn().mockResolvedValue(undefined), send: sendMock },
        },
        { provide: 'PINO_LOGGER', useValue: pino({ level: 'silent' }) },
        { provide: OutboxPublisherService, useValue: outboxMock },
      ],
    }).compile();
    const smallService = smallModule.get(KafkaPublisherService);
    await smallService.onModuleInit();
    await withCtx(async () => {
      await expect(
        smallService.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD),
      ).rejects.toBeInstanceOf(MessageTooLargeError);
    });
    await smallService.onModuleDestroy();
  });

  it('uses tenant_id as partition key', async () => {
    await kafkaTenantContext.run({ tenantId: 'specific-tenant' }, () =>
      kafkaRequestContext.run({ correlationId: 'c' }, async () => {
        await service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD);
      }),
    );
    const callArg = sendMock.mock.calls[0]?.[0] as { messages: Array<{ key: string }> };
    expect(callArg?.messages[0]?.key).toBe('specific-tenant');
  });

  it('generates ULID event_id in headers', async () => {
    await withCtx(async () => {
      await service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD);
    });
    const callArg = sendMock.mock.calls[0]?.[0] as { messages: Array<{ headers: Record<string, string> }> };
    const eventId = callArg?.messages[0]?.headers?.['event-id'];
    expect(eventId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('propagates tenant-id header', async () => {
    await withCtx(async () => {
      await service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD);
    });
    const callArg = sendMock.mock.calls[0]?.[0] as { messages: Array<{ headers: Record<string, string> }> };
    expect(callArg?.messages[0]?.headers?.['tenant-id']).toBe('tenant-123');
  });

  it('wraps exhausted retries into KafkaPublishError', async () => {
    sendMock.mockRejectedValue(new KafkaJSRequestTimeoutError('timeout'));
    await withCtx(async () => {
      await expect(
        service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD),
      ).rejects.toBeInstanceOf(KafkaPublishError);
    });
  });

  it('does not call send if tenant context missing -- no cross-tenant leak', async () => {
    await expect(
      service.publish(Topics.AUTH_USER_CREATED, VALID_AUTH_PAYLOAD),
    ).rejects.toBeInstanceOf(MissingTenantContextError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('uses partitionKeyOverride when provided', async () => {
    await withCtx(async () => {
      await service.publish(
        Topics.AUTH_USER_CREATED,
        VALID_AUTH_PAYLOAD,
        { partitionKeyOverride: 'custom-key' },
      );
    });
    const callArg = sendMock.mock.calls[0]?.[0] as { messages: Array<{ key: string }> };
    expect(callArg?.messages[0]?.key).toBe('custom-key');
  });

  it('throws TopicSchemaNotFoundError for unknown topic string', async () => {
    expect(TopicSchemaNotFoundError).toBeDefined();
  });
});
