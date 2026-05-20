/**
 * Tests JobProducerService -- add, getJobCounts, onModuleDestroy.
 *
 * Utilise un mock bullmq Queue pour eviter la dependance Redis en tests.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.11 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobProducerService } from './job-producer.service';

// ----- Mock bullmq -----
const mockJob = { id: 'job-abc-123', name: 'test-job', data: { foo: 'bar' } };
const mockQueueInstance = {
  add: vi.fn().mockResolvedValue(mockJob),
  close: vi.fn().mockResolvedValue(undefined),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 1,
    active: 0,
    completed: 5,
    failed: 0,
    delayed: 0,
    paused: 0,
  }),
};

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => mockQueueInstance),
}));

describe('JobProducerService', () => {
  let service: JobProducerService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reassign return values cleared by clearAllMocks
    mockQueueInstance.add.mockResolvedValue(mockJob);
    mockQueueInstance.close.mockResolvedValue(undefined);
    mockQueueInstance.getJobCounts.mockResolvedValue({
      waiting: 1,
      active: 0,
      completed: 5,
      failed: 0,
      delayed: 0,
      paused: 0,
    });

    service = new JobProducerService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // add()
  // ---------------------------------------------------------------

  it('add() retourne le job cree par la Queue', async () => {
    const job = await service.add('test-queue', 'my-job', { payload: 'data' });
    expect(job).toBe(mockJob);
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
    expect(mockQueueInstance.add).toHaveBeenCalledWith(
      'my-job',
      { payload: 'data' },
      undefined,
    );
  });

  it('add() cree la Queue la premiere fois (lazy)', async () => {
    const { Queue } = await import('bullmq');
    await service.add('new-queue', 'job1', {});
    type MockFn = { mock: { calls: Array<[string, unknown]> }; (...args: unknown[]): unknown };
    expect(Queue as unknown as MockFn).toHaveBeenCalledWith(
      'new-queue',
      expect.objectContaining({ defaultJobOptions: expect.any(Object) }),
    );
  });

  it('add() reutilise la meme Queue sur second appel (cache)', async () => {
    const { Queue } = await import('bullmq');
    await service.add('cached-queue', 'job1', {});
    await service.add('cached-queue', 'job2', {});
    // Queue instanciee une seule fois pour 'cached-queue'
    type MockFn = { mock: { calls: Array<[string, unknown]> } };
    const callCount = (Queue as unknown as MockFn).mock.calls.filter(
      (c) => c[0] === 'cached-queue',
    ).length;
    expect(callCount).toBe(1);
  });

  it('add() transmet les options additionnelles a queue.add()', async () => {
    const opts = { priority: 10, delay: 5000 };
    await service.add('opt-queue', 'job', { x: 1 }, opts);
    expect(mockQueueInstance.add).toHaveBeenCalledWith('job', { x: 1 }, opts);
  });

  it('add() propage les erreurs de queue.add()', async () => {
    mockQueueInstance.add.mockRejectedValueOnce(new Error('Redis down'));
    await expect(service.add('fail-queue', 'job', {})).rejects.toThrow('Redis down');
  });

  // ---------------------------------------------------------------
  // getJobCounts()
  // ---------------------------------------------------------------

  it('getJobCounts() retourne les compteurs de la Queue', async () => {
    await service.add('count-queue', 'job', {});
    const counts = await service.getJobCounts('count-queue');
    expect(counts).toMatchObject({ waiting: 1, completed: 5, failed: 0 });
  });

  // ---------------------------------------------------------------
  // onModuleDestroy()
  // ---------------------------------------------------------------

  it('onModuleDestroy() ferme toutes les queues actives', async () => {
    await service.add('q1', 'job1', {});
    await service.add('q2', 'job2', {});
    await service.onModuleDestroy();
    expect(mockQueueInstance.close).toHaveBeenCalledTimes(2);
  });

  it('onModuleDestroy() sur service sans queues ne throws pas', async () => {
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });

  // ---------------------------------------------------------------
  // DEFAULT_JOB_OPTIONS
  // ---------------------------------------------------------------

  it('Queue creee avec DEFAULT_JOB_OPTIONS (attempts: 3)', async () => {
    const { Queue } = await import('bullmq');
    await service.add('opts-check', 'job', {});
    type MockFn = { mock: { calls: Array<[string, { defaultJobOptions: { attempts: number } }]> } };
    const callArgs = (Queue as unknown as MockFn).mock.calls.find(
      (c) => c[0] === 'opts-check',
    );
    expect(callArgs?.[1]?.defaultJobOptions?.attempts).toBe(3);
  });

  // ---------------------------------------------------------------
  // Connexion Redis DB 2
  // ---------------------------------------------------------------

  it('Queue creee avec db: 2 (isolation Redis)', async () => {
    const { Queue } = await import('bullmq');
    await service.add('db-check-queue', 'job', {});
    type MockFn = { mock: { calls: Array<[string, { connection: { db: number } }]> } };
    const callArgs = (Queue as unknown as MockFn).mock.calls.find(
      (c) => c[0] === 'db-check-queue',
    );
    expect(callArgs?.[1]?.connection?.db).toBe(2);
  });
});
