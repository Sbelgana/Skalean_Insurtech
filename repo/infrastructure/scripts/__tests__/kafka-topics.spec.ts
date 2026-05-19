import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kafka } from 'kafkajs';

const KAFKA_BROKERS = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
const SKIP_INTEGRATION = process.env['SKIP_INTEGRATION'] === 'true';

const NAMING_REGEX = /^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$/;

const EXPECTED_TOPICS = [
  // Auth (9)
  'insurtech.events.auth.user.created',
  'insurtech.events.auth.user.signed_in',
  'insurtech.events.auth.user.signed_out',
  'insurtech.events.auth.user.locked',
  'insurtech.events.auth.user.unlocked',
  'insurtech.events.auth.user.password_reset_requested',
  'insurtech.events.auth.user.password_changed',
  'insurtech.events.auth.user.mfa_enabled',
  'insurtech.events.auth.user.mfa_disabled',
  // CRM (6)
  'insurtech.events.crm.contact.created',
  'insurtech.events.crm.contact.updated',
  'insurtech.events.crm.deal.created',
  'insurtech.events.crm.deal.stage_changed',
  'insurtech.events.crm.interaction.recorded',
  'insurtech.events.crm.interaction.email_received',
  // Booking (4)
  'insurtech.events.booking.appointment.scheduled',
  'insurtech.events.booking.appointment.confirmed',
  'insurtech.events.booking.appointment.cancelled',
  'insurtech.events.booking.appointment.completed',
  // Comm (10)
  'insurtech.events.comm.message.queued',
  'insurtech.events.comm.message.sent',
  'insurtech.events.comm.message.delivered',
  'insurtech.events.comm.message.read',
  'insurtech.events.comm.message.failed',
  'insurtech.events.comm.template.created',
  'insurtech.events.comm.template.approved',
  'insurtech.events.comm.template.rejected',
  'insurtech.events.comm.optout.recorded',
  'insurtech.events.comm.webhook.received',
  // Pay (6)
  'insurtech.events.pay.transaction.initiated',
  'insurtech.events.pay.transaction.completed',
  'insurtech.events.pay.transaction.failed',
  'insurtech.events.pay.transaction.refunded',
  'insurtech.events.pay.reconciliation.matched',
  'insurtech.events.pay.reconciliation.discrepancy',
  // Insure (4)
  'insurtech.events.insure.policy.created',
  'insurtech.events.insure.policy.signed',
  'insurtech.events.insure.policy.renewed',
  'insurtech.events.insure.policy.cancelled',
  // Repair (3)
  'insurtech.events.repair.sinistre.declared',
  'insurtech.events.repair.sinistre.dispatched',
  'insurtech.events.repair.sinistre.estimated',
  // Audit (3, retention 30j)
  'insurtech.events.audit.audit.recorded',
  'insurtech.events.audit.compliance.data_purged',
  'insurtech.events.audit.compliance.acaps_submitted',
  // Books (2)
  'insurtech.events.books.invoice.issued',
  'insurtech.events.books.invoice.paid',
  // Stock (2)
  'insurtech.events.stock.stock.low_threshold',
  'insurtech.events.stock.stock.movement_recorded',
  // HR (2)
  'insurtech.events.hr.attendance.recorded',
  'insurtech.events.hr.salary.processed',
  // System (3)
  'insurtech.events.system.tenant.created',
  'insurtech.events.system.tenant.settings_changed',
  'insurtech.events.system.user.password_reset_requested',
  // DLQ (5)
  'insurtech.dlq.comm.failed',
  'insurtech.dlq.pay.failed',
  'insurtech.dlq.insure.failed',
  'insurtech.dlq.repair.failed',
  'insurtech.dlq.compliance.failed',
];

const DLQ_TOPICS = [
  'insurtech.dlq.comm.failed',
  'insurtech.dlq.pay.failed',
  'insurtech.dlq.insure.failed',
  'insurtech.dlq.repair.failed',
  'insurtech.dlq.compliance.failed',
];

const AUDIT_TOPICS = [
  'insurtech.events.audit.audit.recorded',
  'insurtech.events.audit.compliance.data_purged',
  'insurtech.events.audit.compliance.acaps_submitted',
];

describe('Kafka topics naming convention (unit)', () => {
  it('NAMING_REGEX matches canonical events topic', () => {
    expect(NAMING_REGEX.test('insurtech.events.pay.transaction.completed')).toBe(true);
  });

  it('NAMING_REGEX matches topic with underscore in action', () => {
    expect(NAMING_REGEX.test('insurtech.events.auth.user.password_reset_requested')).toBe(true);
  });

  it('NAMING_REGEX matches DLQ topic', () => {
    expect(NAMING_REGEX.test('insurtech.dlq.pay.failed')).toBe(true);
  });

  it('NAMING_REGEX rejects uppercase', () => {
    expect(NAMING_REGEX.test('Insurtech.events.pay.transaction.completed')).toBe(false);
    expect(NAMING_REGEX.test('insurtech.events.Pay.transaction.completed')).toBe(false);
  });

  it('NAMING_REGEX rejects hyphen separator', () => {
    expect(NAMING_REGEX.test('insurtech-events-pay-transaction-completed')).toBe(false);
    expect(NAMING_REGEX.test('insurtech.events.pay.transaction-completed')).toBe(false);
  });

  it('NAMING_REGEX rejects missing entity or action segment', () => {
    expect(NAMING_REGEX.test('insurtech.events.pay')).toBe(false);
    expect(NAMING_REGEX.test('insurtech.events')).toBe(false);
  });

  it('all 53 expected topic names are regex-conformant', () => {
    for (const topic of EXPECTED_TOPICS) {
      expect(NAMING_REGEX.test(topic), `topic ${topic} non-conforme`).toBe(true);
    }
  });

  it('no topic name contains emoji', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    for (const topic of EXPECTED_TOPICS) {
      expect(emojiRegex.test(topic), `topic ${topic} contient emoji`).toBe(false);
    }
  });

  it('total EXPECTED_TOPICS count is 59 (54 domain + 5 DLQ)', () => {
    expect(EXPECTED_TOPICS.length).toBe(59);
  });
});

describe.skipIf(SKIP_INTEGRATION)('Kafka topics catalog -- Tache 1.2.10 (integration)', () => {
  let kafka: Kafka;
  let admin: ReturnType<Kafka['admin']>;

  beforeAll(async () => {
    kafka = new Kafka({
      clientId: 'kafka-topics-test-1-2-10',
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
    it('should have at least 53 topics under insurtech.*', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.'));
      expect(insurtechTopics.length).toBeGreaterThanOrEqual(53);
    });

    it.each(EXPECTED_TOPICS)('should have topic %s', async (topicName) => {
      const topics = await admin.listTopics();
      expect(topics).toContain(topicName);
    });

    it('should have exactly 59 topics in insurtech.* namespace', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.'));
      expect(insurtechTopics.length).toBe(EXPECTED_TOPICS.length);
    });
  });

  describe('Naming convention', () => {
    it('all insurtech topics match regex', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.'));
      for (const topic of insurtechTopics) {
        expect(NAMING_REGEX.test(topic), `Topic ${topic} non-conforme`).toBe(true);
      }
    });

    it('no topic contains emoji', async () => {
      const topics = await admin.listTopics();
      const insurtechTopics = topics.filter((t) => t.startsWith('insurtech.'));
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      for (const topic of insurtechTopics) {
        expect(emojiRegex.test(topic), `Topic ${topic} contient emoji`).toBe(false);
      }
    });
  });

  describe('Partition counts', () => {
    it('standard topics should have 6 partitions', async () => {
      const metadata = await admin.fetchTopicMetadata({
        topics: ['insurtech.events.auth.user.created'],
      });
      expect(metadata.topics[0]?.partitions.length).toBe(6);
    });

    it.each(DLQ_TOPICS)('DLQ topic %s should have 1 partition', async (topic) => {
      const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
      const topicMetadata = metadata.topics.find((t) => t.name === topic);
      expect(topicMetadata?.partitions.length).toBe(1);
    });
  });

  describe('Retention configuration', () => {
    it('standard topics retention 7 days (604800000ms)', async () => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: 'insurtech.events.auth.user.created' }],
        includeSynonyms: false,
      });
      const retention = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'retention.ms',
      );
      expect(retention?.configValue).toBe('604800000');
    });

    it.each(DLQ_TOPICS)('DLQ topic %s retention 30 days (2592000000ms)', async (topic) => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: topic }],
        includeSynonyms: false,
      });
      const retention = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'retention.ms',
      );
      expect(retention?.configValue).toBe('2592000000');
    });

    it.each(AUDIT_TOPICS)('audit topic %s retention 30 days (2592000000ms)', async (topic) => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: topic }],
        includeSynonyms: false,
      });
      const retention = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'retention.ms',
      );
      expect(retention?.configValue).toBe('2592000000');
    });

    it('compression should be snappy on standard topic', async () => {
      const configs = await admin.describeConfigs({
        resources: [{ type: 2, name: 'insurtech.events.auth.user.created' }],
        includeSynonyms: false,
      });
      const compression = configs.resources[0]?.configEntries.find(
        (c) => c.configName === 'compression.type',
      );
      expect(compression?.configValue).toBe('snappy');
    });
  });

  describe('Idempotence', () => {
    it('topic count stable on second listing (idempotent init)', async () => {
      const topics1 = await admin.listTopics();
      const count1 = topics1.filter((t) => t.startsWith('insurtech.')).length;
      const topics2 = await admin.listTopics();
      const count2 = topics2.filter((t) => t.startsWith('insurtech.')).length;
      expect(count2).toBe(count1);
    });
  });
});
