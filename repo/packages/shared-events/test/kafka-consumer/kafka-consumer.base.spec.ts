import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import type { Logger as PinoLogger } from 'pino';
import { KafkaConsumerBase } from '../../src/kafka-consumer/kafka-consumer.base.js';
import { Topics } from '../../src/topics.js';
import type { EventEnvelope } from '../../src/types/event-envelope.js';
import type { DlqPublisherService } from '../../src/kafka-consumer/dlq-publisher.service.js';
import type { IIdempotencyRepository } from '../../src/kafka-consumer/idempotency-repository.js';
import type { ConsumerOptions } from '../../src/kafka-consumer/kafka-consumer.types.js';
import { kafkaTenantContext } from '../../src/kafka-publisher/kafka-context.js';
import type { UserSignedInPayload } from '../../src/schemas/index.js';

// ---------------------------------------------------------------------------
// Concrete test consumer
// ---------------------------------------------------------------------------
type FakePayload = UserSignedInPayload;

class FakeConsumer extends KafkaConsumerBase<FakePayload> {
  handleCallCount = 0;
  lastPayload: FakePayload | null = null;
  throwError: Error | null = null;

  getTopic(): Topics {
    return Topics.AUTH_USER_SIGNED_IN;
  }

  getGroupId(): string {
    return 'auth-user-signin-handler';
  }

  async handle(payload: FakePayload): Promise<void> {
    this.handleCallCount++;
    this.lastPayload = payload;
    if (this.throwError !== null) throw this.throwError;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TENANT_ID = '550e8400-e29b-41d4-a716-000000000003';

const VALID_PAYLOAD: UserSignedInPayload = {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: '550e8400-e29b-41d4-a716-446655440001',
  signin_method: 'password',
  ip_address: '127.0.0.1',
  user_agent: 'Mozilla/5.0 (compatible)',
  signed_in_at: '2026-05-19T10:00:00.000Z',
  session_id: '550e8400-e29b-41d4-a716-446655440002',
  device_fingerprint: null,
  geo_country: null,
  geo_city: null,
};

function makeEnvelope(
  payload: unknown,
  eventId = 'evt-001',
  tenantId = TENANT_ID,
): Record<string, unknown> {
  return {
    event_id: eventId,
    event_name: 'auth.user.signed_in',
    event_version: '1.0',
    occurred_at: '2026-05-19T10:00:00.000Z',
    tenant_id: tenantId,
    user_id: null,
    correlation_id: null,
    payload,
  };
}

function makeMessage(
  envelope: Record<string, unknown>,
  offset = '10',
): { value: Buffer; offset: string } {
  return { value: Buffer.from(JSON.stringify(envelope), 'utf8'), offset };
}

// Use maxMs: 0 to cap all retry delays at 0ms so tests run instantly.
const TEST_OPTIONS: ConsumerOptions = {
  retry: { maxAttempts: 3, initialMs: 1000, multiplier: 5, maxMs: 0 },
  dlq: { enabled: true, topicPrefix: 'insurtech.events.dlq' },
  session: { timeoutMs: 30_000, heartbeatMs: 3_000 },
  observability: { serviceName: 'test-service', metricsPrefix: 'kafka_consumer' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('KafkaConsumerBase', () => {
  let consumer: FakeConsumer;
  let kafkaConsumerMock: Consumer;
  let eachMessageHandler: (p: EachMessagePayload) => Promise<void>;
  let mockKafka: Kafka;
  let mockDlq: { publish: ReturnType<typeof vi.fn> };
  let mockRepo: { tryInsert: ReturnType<typeof vi.fn> };
  let mockLogger: PinoLogger;

  beforeEach(async () => {
    kafkaConsumerMock = {
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockImplementation(
        async (config: {
          autoCommit: boolean;
          eachMessage: (p: EachMessagePayload) => Promise<void>;
        }) => {
          eachMessageHandler = config.eachMessage;
        },
      ),
      disconnect: vi.fn().mockResolvedValue(undefined),
      commitOffsets: vi.fn().mockResolvedValue(undefined),
    } as unknown as Consumer;

    mockKafka = {
      consumer: vi.fn().mockReturnValue(kafkaConsumerMock),
    } as unknown as Kafka;

    mockDlq = { publish: vi.fn().mockResolvedValue(undefined) };
    mockRepo = { tryInsert: vi.fn().mockResolvedValue(true) };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as PinoLogger;

    consumer = new FakeConsumer(
      mockKafka,
      TEST_OPTIONS,
      mockDlq as unknown as DlqPublisherService,
      mockRepo as unknown as IIdempotencyRepository,
      mockLogger,
    );
    await consumer.onModuleInit();
  });

  afterEach(async () => {
    await consumer.onModuleDestroy();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // test-1: connect and subscribe
  // -------------------------------------------------------------------------
  it('test-1: should connect and subscribe to the correct topic', () => {
    expect(kafkaConsumerMock.connect).toHaveBeenCalled();
    expect(kafkaConsumerMock.subscribe).toHaveBeenCalledWith({
      topic: Topics.AUTH_USER_SIGNED_IN,
      fromBeginning: false,
    });
  });

  // -------------------------------------------------------------------------
  // test-2: autoCommit false
  // -------------------------------------------------------------------------
  it('test-2: should run consumer with autoCommit false', () => {
    const runCall = (kafkaConsumerMock.run as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      autoCommit: boolean;
    };
    expect(runCall.autoCommit).toBe(false);
  });

  // -------------------------------------------------------------------------
  // test-3: invalid group_id throws at onModuleInit
  // -------------------------------------------------------------------------
  it('test-3: invalid group_id should throw at onModuleInit', async () => {
    class BadGroupId extends FakeConsumer {
      getGroupId(): string {
        return 'bad';
      }
    }
    const bad = new BadGroupId(
      mockKafka,
      TEST_OPTIONS,
      mockDlq as unknown as DlqPublisherService,
      mockRepo as unknown as IIdempotencyRepository,
      mockLogger,
    );
    await expect(bad.onModuleInit()).rejects.toThrow(/Invalid group_id/);
  });

  // -------------------------------------------------------------------------
  // test-4: valid payload invokes handle
  // -------------------------------------------------------------------------
  it('test-4: handle invoked with valid payload', async () => {
    const msg = makeMessage(makeEnvelope(VALID_PAYLOAD));
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(consumer.handleCallCount).toBe(1);
    expect(consumer.lastPayload?.user_id).toBe(VALID_PAYLOAD.user_id);
  });

  // -------------------------------------------------------------------------
  // test-5: invalid payload -> ValidationError -> DLQ direct (no retry)
  // -------------------------------------------------------------------------
  it('test-5: Zod validation failure sends to DLQ without retrying', async () => {
    const invalidPayload = { user_id: 'not-a-uuid' };
    const msg = makeMessage(makeEnvelope(invalidPayload), 'evt-002');
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(consumer.handleCallCount).toBe(0);
    expect(mockDlq.publish).toHaveBeenCalledOnce();
    const [, dlqMeta] = mockDlq.publish.mock.calls[0] as [string, { error_type: string }];
    expect(dlqMeta.error_type).toBe('validation_error');
  });

  // -------------------------------------------------------------------------
  // test-6: idempotency — 2nd processing skips handle
  // -------------------------------------------------------------------------
  it('test-6: idempotent skip when event already processed', async () => {
    mockRepo.tryInsert.mockResolvedValueOnce(false);
    const msg = makeMessage(makeEnvelope(VALID_PAYLOAD), 'evt-003');
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(consumer.handleCallCount).toBe(0);
    expect(kafkaConsumerMock.commitOffsets).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // test-7: 3 retries on transient error then DLQ
  // -------------------------------------------------------------------------
  it('test-7: retry maxAttempts times on transient error then routes to DLQ', async () => {
    consumer.throwError = new Error('Transient db error');
    const msg = makeMessage(makeEnvelope(VALID_PAYLOAD), '13');
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(consumer.handleCallCount).toBe(3);
    expect(mockDlq.publish).toHaveBeenCalledOnce();
  }, 30_000);

  // -------------------------------------------------------------------------
  // test-8: success after 2 failures on 3rd attempt
  // -------------------------------------------------------------------------
  it('test-8: succeeds on 3rd attempt after two transient failures', async () => {
    let callCount = 0;
    consumer.handle = vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('flake');
    }) as unknown as typeof consumer.handle;

    const msg = makeMessage(makeEnvelope(VALID_PAYLOAD), 'evt-005');
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(callCount).toBe(3);
    expect(mockDlq.publish).not.toHaveBeenCalled();
  }, 30_000);

  // -------------------------------------------------------------------------
  // test-9: DLQ topic computed from group_id prefix
  // -------------------------------------------------------------------------
  it('test-9: DLQ topic uses module prefix extracted from group_id', async () => {
    consumer.throwError = new Error('boom');
    const msg = makeMessage(makeEnvelope(VALID_PAYLOAD), 'evt-006');
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(mockDlq.publish).toHaveBeenCalledWith(
      expect.stringMatching(/^insurtech\.events\.dlq\.auth$/),
      expect.any(Object),
    );
  }, 30_000);

  // -------------------------------------------------------------------------
  // test-10: manual ack — offset commit after success (offset+1)
  // -------------------------------------------------------------------------
  it('test-10: commits offset+1 after successful processing', async () => {
    const msg = { value: Buffer.from(JSON.stringify(makeEnvelope(VALID_PAYLOAD))), offset: '16' };
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(kafkaConsumerMock.commitOffsets).toHaveBeenCalledWith([
      {
        topic: Topics.AUTH_USER_SIGNED_IN,
        partition: 0,
        offset: '17',
      },
    ]);
  });

  // -------------------------------------------------------------------------
  // test-11: heartbeat called on every message
  // -------------------------------------------------------------------------
  it('test-11: heartbeat is called after processing each message', async () => {
    const heartbeatMock = vi.fn().mockResolvedValue(undefined);
    const msg = makeMessage(makeEnvelope(VALID_PAYLOAD), 'evt-008');
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: heartbeatMock,
      pause: vi.fn(),
    });
    expect(heartbeatMock).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // test-12: empty message value triggers DLQ
  // -------------------------------------------------------------------------
  it('test-12: null/empty message value routes to DLQ', async () => {
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: { value: null, offset: '19' } as unknown as EachMessagePayload['message'],
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(mockDlq.publish).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // test-13: malformed JSON routes to DLQ
  // -------------------------------------------------------------------------
  it('test-13: malformed JSON in message value routes to DLQ', async () => {
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: { value: Buffer.from('not-json-{{'), offset: '20' },
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(mockDlq.publish).toHaveBeenCalled();
    const [, meta] = mockDlq.publish.mock.calls[0] as [string, { error_type: string }];
    expect(meta.error_type).toBe('validation_error');
  });

  // -------------------------------------------------------------------------
  // test-14: large payload (>100KB) logs a warning
  // -------------------------------------------------------------------------
  it('test-14: large payload over 100KB triggers a warn log', async () => {
    const warnSpy = mockLogger.warn as ReturnType<typeof vi.fn>;
    // Build an envelope whose total JSON > 100KB via a padding field
    const envelope = makeEnvelope({ ...VALID_PAYLOAD, _padding: 'x'.repeat(110 * 1024) }, 'evt-009');
    const msg = { value: Buffer.from(JSON.stringify(envelope), 'utf8'), offset: '21' };
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    const warnCalls = warnSpy.mock.calls as Array<[unknown, string]>;
    const found = warnCalls.some(
      ([, msgStr]) => typeof msgStr === 'string' && msgStr.includes('Large payload detected'),
    );
    expect(found).toBe(true);
  });

  // -------------------------------------------------------------------------
  // test-15: graceful shutdown disconnects consumer
  // -------------------------------------------------------------------------
  it('test-15: onModuleDestroy disconnects the Kafka consumer', async () => {
    // onModuleDestroy is also called in afterEach; call it here manually first.
    await consumer.onModuleDestroy();
    expect(kafkaConsumerMock.disconnect).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // test-16: tenant_id propagated via AsyncLocalStorage
  // -------------------------------------------------------------------------
  it('test-16: tenant_id from envelope is propagated to kafkaTenantContext', async () => {
    let observedTenantId: string | undefined;
    consumer.handle = vi.fn(async () => {
      observedTenantId = kafkaTenantContext.getStore()?.tenantId;
    }) as unknown as typeof consumer.handle;

    const envelope = makeEnvelope(VALID_PAYLOAD, 'evt-010', TENANT_ID);
    const msg = makeMessage(envelope);
    await eachMessageHandler({
      topic: Topics.AUTH_USER_SIGNED_IN,
      partition: 0,
      message: msg,
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    });
    expect(observedTenantId).toBe(TENANT_ID);
  });
});
