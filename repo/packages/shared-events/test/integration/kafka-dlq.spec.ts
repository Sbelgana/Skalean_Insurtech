/**
 * TC-KAF-DLQ-01 to TC-KAF-DLQ-06 -- Kafka DLQ integration tests.
 * Validates that messages failing consistently are routed to DLQ
 * with correct headers, preserved payload, and Redis marker.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kafka, type Consumer, type Producer } from 'kafkajs';
import Redis from 'ioredis';
import { ensureKafkaTopics, deleteKafkaTopics, flushRedis, waitFor } from '../setup.js';

const BROKERS = (process.env['KAFKA_TEST_BROKERS'] ?? 'localhost:9093').split(',');
const REDIS_URL = process.env['REDIS_TEST_URL'] ?? 'redis://localhost:6380';
const TOPIC = 'test.int.dlq.source.v1';
const DLQ = `${TOPIC}.dlq`;
const KAFKA_AVAILABLE = Boolean(process.env['KAFKA_TEST_BROKERS'] ?? process.env['KAFKA_BROKERS']);

const MAX_RETRIES = 3;
const DLQ_PREFIX = 'dlq:seen:';

// TODO Sprint 21 : rewrite using real KafkaConsumerBase + dlq-publisher.service.ts
// (not inline simulation). Current spec simulates DLQ routing manually in the
// eachMessage handler, but the simulation is broken : test sends 1 message and
// expects 3 retries to trigger DLQ, but Kafka does not re-deliver in same run
// without rebalance, so message count stays at 1 and DLQ never triggers ->
// waitFor 45s timeout on every test. See KNOWN-ISSUES.md.
describe.skip('kafka DLQ integration', () => {
  let producer: Producer;
  let mainConsumer: Consumer;
  let dlqConsumer: Consumer;
  let redis: Redis;
  const dlqMessages: Array<{ value: string; headers: Record<string, string> }> = [];

  beforeAll(async () => {
    await ensureKafkaTopics(BROKERS, [TOPIC, DLQ]);
    redis = new Redis(REDIS_URL);

    const kafkaProd = new Kafka({ clientId: 'test-dlq-prod', brokers: BROKERS });
    producer = kafkaProd.producer({ allowAutoTopicCreation: false });
    await producer.connect();

    const kafkaCons = new Kafka({ clientId: 'test-dlq-main', brokers: BROKERS });
    mainConsumer = kafkaCons.consumer({ groupId: `test-dlq-main-${Date.now()}` });
    await mainConsumer.connect();
    await mainConsumer.subscribe({ topic: TOPIC, fromBeginning: true });
    await mainConsumer.run({
      autoCommit: false,
      eachMessage: async ({ topic: t, partition, message }) => {
        const eventId = message.headers?.['x-event-id']?.toString();
        if (!eventId) return;

        const retryKey = `retry:dlq:${eventId}`;
        const count = await redis.incr(retryKey);
        await redis.expire(retryKey, 3600);

        if (count >= MAX_RETRIES) {
          const hdrs: Record<string, string> = {};
          for (const [k, v] of Object.entries(message.headers ?? {})) {
            hdrs[k] = Buffer.isBuffer(v) ? v.toString() : (v?.toString() ?? '');
          }
          await producer.send({
            topic: DLQ,
            messages: [
              {
                key: message.key?.toString(),
                value: message.value?.toString() ?? '',
                headers: {
                  ...hdrs,
                  'x-error-message': 'always fail',
                  'x-original-topic': t,
                  'x-retry-count': String(MAX_RETRIES),
                },
              },
            ],
          });
          await redis.set(`${DLQ_PREFIX}${eventId}`, '1', 'EX', 86400);
          await mainConsumer.commitOffsets([
            { topic: t, partition, offset: (Number(message.offset) + 1).toString() },
          ]);
        }
      },
    });

    const kafkaDlq = new Kafka({ clientId: 'test-dlq-watcher', brokers: BROKERS });
    dlqConsumer = kafkaDlq.consumer({ groupId: `test-dlq-watch-${Date.now()}` });
    await dlqConsumer.connect();
    await dlqConsumer.subscribe({ topic: DLQ, fromBeginning: true });
    await dlqConsumer.run({
      eachMessage: async ({ message }) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(message.headers ?? {})) {
          headers[k] = Buffer.isBuffer(v) ? v.toString() : (v?.toString() ?? '');
        }
        dlqMessages.push({ value: message.value?.toString() ?? '', headers });
      },
    });
  });

  afterAll(async () => {
    await producer.disconnect();
    await mainConsumer.disconnect();
    await dlqConsumer.disconnect();
    await redis.quit();
    await deleteKafkaTopics(BROKERS, [TOPIC, DLQ]);
  });

  beforeEach(async () => {
    dlqMessages.length = 0;
    await flushRedis(REDIS_URL);
  });

  it('TC-KAF-DLQ-01 -- after three failures the message lands in DLQ', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'dlq-k1',
          value: JSON.stringify({ id: 'dlq-1' }),
          headers: { 'x-event-id': 'evt-dlq-1' },
        },
      ],
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-1'),
      45_000,
    );
    expect(msg).toBeDefined();
  });

  it('TC-KAF-DLQ-02 -- DLQ message contains x-error-message header', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'dlq-k2',
          value: JSON.stringify({ id: 'dlq-2' }),
          headers: { 'x-event-id': 'evt-dlq-2' },
        },
      ],
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-2'),
      45_000,
    );
    expect(msg.headers['x-error-message']).toContain('always fail');
  });

  it('TC-KAF-DLQ-03 -- DLQ message contains x-original-topic header', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'dlq-k3',
          value: JSON.stringify({ id: 'dlq-3' }),
          headers: { 'x-event-id': 'evt-dlq-3' },
        },
      ],
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-3'),
      45_000,
    );
    expect(msg.headers['x-original-topic']).toBe(TOPIC);
  });

  it('TC-KAF-DLQ-04 -- DLQ message contains x-retry-count header equal to max retries', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'dlq-k4',
          value: JSON.stringify({ id: 'dlq-4' }),
          headers: { 'x-event-id': 'evt-dlq-4' },
        },
      ],
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-4'),
      45_000,
    );
    expect(parseInt(msg.headers['x-retry-count'], 10)).toBe(MAX_RETRIES);
  });

  it('TC-KAF-DLQ-05 -- DLQ message preserves original payload', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'dlq-k5',
          value: JSON.stringify({ id: 'dlq-5', extra: 'data' }),
          headers: { 'x-event-id': 'evt-dlq-5' },
        },
      ],
    });
    const msg = await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-5'),
      45_000,
    );
    expect(JSON.parse(msg.value)).toEqual({ id: 'dlq-5', extra: 'data' });
  });

  it('TC-KAF-DLQ-06 -- DLQ marker key is set in Redis after routing', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'dlq-k6',
          value: JSON.stringify({ id: 'dlq-6' }),
          headers: { 'x-event-id': 'evt-dlq-6' },
        },
      ],
    });
    await waitFor(
      async () => dlqMessages.find((m) => m.headers['x-event-id'] === 'evt-dlq-6'),
      45_000,
    );
    const exists = await redis.exists(`${DLQ_PREFIX}evt-dlq-6`);
    expect(exists).toBe(1);
  });
});
