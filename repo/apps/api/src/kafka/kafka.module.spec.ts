/**
 * Tests KafkaModule -- valide l'exposition de kafkaProducer via DI NestJS.
 *
 * Utilise un mock kafkajs pour eviter la dependance a un vrai broker Kafka
 * en tests unitaires.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.2 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { KafkaModule } from './kafka.module';
import { KAFKA_PRODUCER_TOKEN } from './kafka.provider';

// Mock kafkajs Producer
const mockProducer = {
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  send: vi.fn(async () => []),
  sendBatch: vi.fn(async () => []),
};

// Mock kafkajs Kafka class
vi.mock('kafkajs', () => ({
  Kafka: vi.fn(() => ({
    producer: vi.fn(() => mockProducer),
  })),
}));

describe('KafkaModule', () => {
  let module: TestingModule;

  beforeEach(() => {
    mockProducer.connect.mockClear();
    mockProducer.disconnect.mockClear();
  });

  afterEach(async () => {
    if (module) await module.close();
  });

  it('expose kafkaProducer via DI (KAFKA_PRODUCER_TOKEN)', async () => {
    module = await Test.createTestingModule({
      imports: [KafkaModule],
    }).compile();

    const producer = module.get(KAFKA_PRODUCER_TOKEN);
    expect(producer).toBeDefined();
  });

  it('kafkaProducer a une methode send', async () => {
    module = await Test.createTestingModule({
      imports: [KafkaModule],
    }).compile();

    const producer: typeof mockProducer = module.get(KAFKA_PRODUCER_TOKEN);
    expect(typeof producer.send).toBe('function');
  });

  it('useFactory appelle connect() au boot', async () => {
    module = await Test.createTestingModule({
      imports: [KafkaModule],
    }).compile();

    expect(mockProducer.connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy appelle disconnect()', async () => {
    module = await Test.createTestingModule({
      imports: [KafkaModule],
    }).compile();

    await module.close();
    expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('KafkaModule annote @Global expose le provider', async () => {
    module = await Test.createTestingModule({
      imports: [KafkaModule],
    }).compile();

    const producer = module.get(KAFKA_PRODUCER_TOKEN);
    expect(producer).toBeDefined();
  });
});
