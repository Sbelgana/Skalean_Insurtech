import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kafka } from 'kafkajs';

const KAFKA_BROKERS = (process.env['KAFKA_BROKERS'] ?? 'localhost:9094').split(',');
const SKIP_INTEGRATION = process.env['SKIP_INTEGRATION'] === 'true';

const EXPECTED_TOPICS = [
  // Auth (7)
  'insurtech.events.auth.user_signed_up',
  'insurtech.events.auth.user_signed_in',
  'insurtech.events.auth.user_signed_out',
  'insurtech.events.auth.password_changed',
  'insurtech.events.auth.mfa_setup',
  'insurtech.events.auth.account_locked',
  'insurtech.events.auth.role_changed',
  // CRM (5)
  'insurtech.events.crm.contact_created',
  'insurtech.events.crm.contact_updated',
  'insurtech.events.crm.contact_deleted',
  'insurtech.events.crm.deal_stage_changed',
  'insurtech.events.crm.interaction_logged',
  // Booking (3)
  'insurtech.events.booking.appointment_scheduled',
  'insurtech.events.booking.appointment_cancelled',
  'insurtech.events.booking.appointment_completed',
  // Comm (3)
  'insurtech.events.comm.message_sent',
  'insurtech.events.comm.message_delivered',
  'insurtech.events.comm.message_failed',
  // Pay (4)
  'insurtech.events.pay.transaction_initiated',
  'insurtech.events.pay.transaction_completed',
  'insurtech.events.pay.transaction_failed',
  'insurtech.events.pay.refund_processed',
  // Insure (4)
  'insurtech.events.insure.quote_generated',
  'insurtech.events.insure.police_created',
  'insurtech.events.insure.police_signed',
  'insurtech.events.insure.avenant_created',
  // Repair (3)
  'insurtech.events.repair.sinistre_declared',
  'insurtech.events.repair.devis_approved',
  'insurtech.events.repair.reparation_completed',
  // Audit (1)
  'insurtech.events.audit.access_denied',
  // DLQ (2)
  'insurtech.events.dlq.comm',
  'insurtech.events.dlq.pay',
];

const HIGH_THROUGHPUT_TOPICS = [
  'insurtech.events.auth.user_signed_in',
  'insurtech.events.crm.interaction_logged',
  'insurtech.events.comm.message_sent',
  'insurtech.events.comm.message_delivered',
  'insurtech.events.repair.sinistre_declared',
];

const DLQ_TOPICS = ['insurtech.events.dlq.comm', 'insurtech.events.dlq.pay'];

describe.skipIf(SKIP_INTEGRATION)('Kafka topics catalog -- Tache 1.1.6', () => {
  let kafka: Kafka;
  let admin: ReturnType<Kafka['admin']>;

  beforeAll(async () => {
    kafka = new Kafka({
      clientId: 'kafka-topics-test',
      brokers: KAFKA_BROKERS,
      retry: { retries: 5 },
    });
    admin = kafka.admin();
    await admin.connect();
  });

  afterAll(async () => {
    await admin.disconnect();
  });

  describe('Topic existence', () => {
    it('should have at least 30 topics under insurtech.events.*', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.events.'));
      expect(insurtechTopics.length).toBeGreaterThanOrEqual(30);
    });

    it.each(EXPECTED_TOPICS)('should have topic %s', async (topicName) => {
      const topics = await admin.listTopics();
      expect(topics).toContain(topicName);
    });

    it('should have exactly 32 topics in insurtech.events.* namespace', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.events.'));
      expect(insurtechTopics.length).toBe(EXPECTED_TOPICS.length);
    });
  });

  describe('Naming convention insurtech.events.{vertical}.{entity}.{action}', () => {
    it('all topics should match convention pattern', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.events.'));
      const pattern =
        /^insurtech\.events\.(auth|crm|booking|comm|pay|insure|repair|audit|dlq)\.[a-z_]+(\.[a-z_]+)?$/;
      for (const topic of insurtechTopics) {
        expect(topic).toMatch(pattern);
      }
    });

    it('no topic should contain emoji', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.events.'));
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      for (const topic of insurtechTopics) {
        expect(topic).not.toMatch(emojiRegex);
      }
    });
  });

  describe('Partition counts', () => {
    it.each(HIGH_THROUGHPUT_TOPICS)(
      'high throughput topic %s should have 6 partitions',
      async (topic) => {
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        const topicMetadata = metadata.topics.find((t) => t.name === topic);
        expect(topicMetadata?.partitions.length).toBe(6);
      },
    );

    it.each(DLQ_TOPICS)('DLQ topic %s should have 1 partition', async (topic) => {
      const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
      const topicMetadata = metadata.topics.find((t) => t.name === topic);
      expect(topicMetadata?.partitions.length).toBe(1);
    });

    it('standard topics should have 3 partitions', async () => {
      const standardTopic = 'insurtech.events.auth.user_signed_up';
      const metadata = await admin.fetchTopicMetadata({ topics: [standardTopic] });
      const topicMetadata = metadata.topics.find((t) => t.name === standardTopic);
      expect(topicMetadata?.partitions.length).toBe(3);
    });
  });

  describe('Topic configuration', () => {
    it('compression should be lz4', async () => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: 'insurtech.events.auth.user_signed_up' }],
        includeSynonyms: false,
      });
      const compressionConfig = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'compression.type',
      );
      expect(compressionConfig?.configValue).toBe('lz4');
    });

    it('standard topics retention 7 days', async () => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: 'insurtech.events.auth.user_signed_up' }],
        includeSynonyms: false,
      });
      const retentionConfig = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'retention.ms',
      );
      expect(retentionConfig?.configValue).toBe('604800000');
    });

    it.each(DLQ_TOPICS)('DLQ topic %s retention 30 days', async (topic) => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: topic }],
        includeSynonyms: false,
      });
      const retentionConfig = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'retention.ms',
      );
      expect(retentionConfig?.configValue).toBe('2592000000');
    });
  });

  describe('Producer / Consumer roundtrip', () => {
    it(
      'should produce + consume message in less than 5s',
      async () => {
        const producer = kafka.producer();
        const consumer = kafka.consumer({ groupId: 'test-roundtrip-group' });
        const topic = 'insurtech.events.auth.user_signed_up';

        await producer.connect();
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });

        const testMessage = `test-${Date.now()}`;
        const startTime = Date.now();

        const messageReceived = new Promise<string>((resolve) => {
          consumer.run({
            eachMessage: async ({ message }) => {
              const value = message.value?.toString();
              if (value === testMessage) {
                resolve(value);
              }
            },
          });
        });

        // Wait briefly for consumer ready
        await new Promise((r) => setTimeout(r, 500));

        await producer.send({
          topic,
          messages: [{ key: 'test-key', value: testMessage }],
        });

        const received = await Promise.race([
          messageReceived,
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000),
          ),
        ]);

        const duration = Date.now() - startTime;
        expect(received).toBe(testMessage);
        expect(duration).toBeLessThan(5000);

        await producer.disconnect();
        await consumer.disconnect();
      },
      10000,
    );
  });
});
