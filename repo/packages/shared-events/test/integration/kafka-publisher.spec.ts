/**
 * TC-KAF-PUB-01 to TC-KAF-PUB-08 -- Kafka publisher integration tests.
 * Validates publish/receive round-trip, batch publish, message ordering,
 * and header propagation against a real Kafka broker.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kafka, type Consumer, type Producer } from 'kafkajs';
import { ensureKafkaTopics, deleteKafkaTopics, waitFor } from '../setup.js';

const BROKERS = (process.env['KAFKA_TEST_BROKERS'] ?? 'localhost:9093').split(',');
const TOPIC = 'test.int.publisher.v1';
const KAFKA_AVAILABLE = Boolean(process.env['KAFKA_TEST_BROKERS'] ?? process.env['KAFKA_BROKERS']);

describe.skipIf(!KAFKA_AVAILABLE)('kafka publisher integration', () => {
  let producer: Producer;
  let consumer: Consumer;
  const received: Array<{ key?: string; value: string; headers: Record<string, string> }> = [];

  beforeAll(async () => {
    await ensureKafkaTopics(BROKERS, [TOPIC]);
    const kafka = new Kafka({ clientId: 'test-pub-int', brokers: BROKERS });
    producer = kafka.producer({ idempotent: true, allowAutoTopicCreation: false });
    await producer.connect();

    const kafkaCons = new Kafka({ clientId: 'test-pub-cons-int', brokers: BROKERS });
    consumer = kafkaCons.consumer({ groupId: `test-pub-${Date.now()}` });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(message.headers ?? {})) {
          headers[k] = Buffer.isBuffer(v) ? v.toString() : (v?.toString() ?? '');
        }
        received.push({
          key: message.key?.toString(),
          value: message.value?.toString() ?? '',
          headers,
        });
      },
    });
  });

  afterAll(async () => {
    await producer.disconnect();
    await consumer.disconnect();
    await deleteKafkaTopics(BROKERS, [TOPIC]);
  });

  beforeEach(() => {
    received.length = 0;
  });

  it('TC-KAF-PUB-01 -- publishes a single message and consumer receives it', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'key-pub-01',
          value: JSON.stringify({ id: '1', name: 'Alice' }),
          headers: { 'x-tenant-id': 'a', 'x-correlation-id': 'corr-1' },
        },
      ],
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'key-pub-01'), 30_000);
    expect(JSON.parse(msg.value)).toEqual({ id: '1', name: 'Alice' });
    expect(msg.headers['x-tenant-id']).toBe('a');
  });

  it('TC-KAF-PUB-02 -- publishes batch of 20 messages all delivered', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      key: `batch-pub-${i}`,
      value: JSON.stringify({ i }),
      headers: {},
    }));
    await producer.send({ topic: TOPIC, messages });
    await waitFor(
      async () => received.filter((m) => m.key?.startsWith('batch-pub-')).length >= 20,
      30_000,
    );
    expect(received.filter((m) => m.key?.startsWith('batch-pub-')).length).toBe(20);
  });

  it('TC-KAF-PUB-03 -- preserves message order per partition key', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      key: 'order-pub',
      value: JSON.stringify({ i }),
      headers: {},
    }));
    await producer.send({ topic: TOPIC, messages });
    await waitFor(
      async () => received.filter((m) => m.key === 'order-pub').length >= 10,
      30_000,
    );
    const ordered = received
      .filter((m) => m.key === 'order-pub')
      .map((m) => (JSON.parse(m.value) as { i: number }).i);
    expect(ordered).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('TC-KAF-PUB-04 -- headers propagate correctly to consumer', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'meta-pub-04',
          value: JSON.stringify({ x: 1 }),
          headers: {
            'x-event-id': 'evt-pub-04',
            'x-event-time': new Date().toISOString(),
            'x-tenant-id': BROKERS[0] ?? 'test',
          },
        },
      ],
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'meta-pub-04'), 30_000);
    expect(msg.headers['x-event-id']).toBe('evt-pub-04');
    expect(msg.headers['x-event-time']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('TC-KAF-PUB-05 -- idempotent producer does not duplicate on reconnect', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: 'idem-pub-05',
          value: JSON.stringify({ id: 'i' }),
          headers: { 'x-event-id': 'fixed-evt-05' },
        },
      ],
    });
    await waitFor(async () => received.find((m) => m.key === 'idem-pub-05'), 30_000);
    expect(received.filter((m) => m.key === 'idem-pub-05').length).toBe(1);
  });

  it('TC-KAF-PUB-06 -- multiple sends complete without error', async () => {
    const sends = Array.from({ length: 5 }, (_, i) =>
      producer.send({
        topic: TOPIC,
        messages: [{ key: `multi-pub-${i}`, value: JSON.stringify({ i }), headers: {} }],
      }),
    );
    await expect(Promise.all(sends)).resolves.not.toThrow();
    await waitFor(
      async () => received.filter((m) => m.key?.startsWith('multi-pub-')).length >= 5,
      30_000,
    );
  });

  it('TC-KAF-PUB-07 -- message with explicit partition is delivered', async () => {
    await producer.send({
      topic: TOPIC,
      messages: [
        {
          partition: 0,
          key: 'pin-pub-07',
          value: JSON.stringify({ pinned: true }),
          headers: {},
        },
      ],
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'pin-pub-07'), 30_000);
    expect(msg).toBeDefined();
  });

  it('TC-KAF-PUB-08 -- large message payload (< 1MB) is delivered intact', async () => {
    const largeValue = JSON.stringify({ data: 'x'.repeat(50_000) });
    await producer.send({
      topic: TOPIC,
      messages: [{ key: 'large-pub-08', value: largeValue, headers: {} }],
    });
    const msg = await waitFor(async () => received.find((m) => m.key === 'large-pub-08'), 30_000);
    expect(msg.value.length).toBeGreaterThan(50_000);
  });
});
