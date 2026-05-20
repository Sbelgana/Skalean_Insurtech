/**
 * Tests JobsModule -- valide l'exposition de JobProducerService via DI NestJS.
 *
 * Mock @nestjs/bullmq pour eviter la connexion Redis en tests unitaires.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.11 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { JobProducerService } from './job-producer.service';

// ----- Mock bullmq -----
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: '1' }),
    close: vi.fn().mockResolvedValue(undefined),
    getJobCounts: vi.fn().mockResolvedValue({}),
  })),
}));

// ----- Mock @nestjs/bullmq -----
// BullModule.forRoot() ne doit pas etablir de connexion Redis en tests.
vi.mock('@nestjs/bullmq', () => ({
  BullModule: {
    forRoot: vi.fn(() => ({
      module: class MockBullCoreModule {},
      global: true,
      imports: [],
      providers: [],
      exports: [],
    })),
    registerQueue: vi.fn(() => ({
      module: class MockBullModule {},
      imports: [],
      providers: [],
      exports: [],
    })),
  },
}));

// ----- Mock @bull-board/* -----
vi.mock('@bull-board/api', () => ({
  createBullBoard: vi.fn(() => ({ addQueue: vi.fn(), removeQueue: vi.fn() })),
}));
vi.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: vi.fn(),
}));
vi.mock('@bull-board/fastify', () => ({
  FastifyAdapter: vi.fn(() => ({
    setBasePath: vi.fn(),
    registerPlugin: vi.fn(),
    getRouter: vi.fn(),
  })),
}));

// Importer APRES les mocks
import { JobsModule } from './jobs.module';

describe('JobsModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) await module.close();
  });

  it('expose JobProducerService via DI', async () => {
    module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const service = module.get(JobProducerService);
    expect(service).toBeDefined();
    expect(typeof service.add).toBe('function');
  });

  it('JobProducerService a une methode add()', async () => {
    module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const service = module.get(JobProducerService);
    expect(typeof service.add).toBe('function');
  });

  it('JobProducerService a une methode getJobCounts()', async () => {
    module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const service = module.get(JobProducerService);
    expect(typeof service.getJobCounts).toBe('function');
  });

  it('JobProducerService a une methode onModuleDestroy()', async () => {
    module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const service = module.get(JobProducerService);
    expect(typeof service.onModuleDestroy).toBe('function');
  });

  it('onModuleDestroy ne throws pas si aucune queue active', async () => {
    module = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const service = module.get(JobProducerService);
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });
});
