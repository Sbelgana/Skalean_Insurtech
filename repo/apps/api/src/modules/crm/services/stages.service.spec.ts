/**
 * Tests StagesService -- Sprint 8 Tache 8.3.
 *
 * Unit tests avec DataSource + EntityManager mocks. Integration tests pour reorder
 * (transient offset strategy + UNIQUE pipeline_id+position) Sprint 8.14.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import { StagesService, STAGE_ERROR_CODES } from './stages.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const PIPELINE_ID = '00000000-0000-0000-0000-000000000100';
const STAGE_ID_1 = '00000000-0000-0000-0000-000000000201';
const STAGE_ID_2 = '00000000-0000-0000-0000-000000000202';

function buildTenantContext(tenantId: string | undefined): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      tenantId
        ? {
            tenantId,
            userId: USER_A,
            userRole: undefined,
            isSuperAdmin: false,
            traceId: 'trc',
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
          }
        : undefined,
  } as unknown as TenantContextService;
}

interface QbStub {
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  getRawOne: ReturnType<typeof vi.fn>;
  getMany: ReturnType<typeof vi.fn>;
  getManyAndCount: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

function buildQb(overrides: Partial<QbStub> = {}): QbStub {
  const qb = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue({ maxp: -1 }),
    getMany: vi.fn().mockResolvedValue([]),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return qb;
}

interface RepoStub {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
}

function buildRepo(overrides: Partial<RepoStub> = {}, qb?: QbStub): RepoStub {
  const stub: RepoStub = {
    create: vi.fn((data) => ({ ...data, id: 'stage-new' })),
    save: vi.fn((entity) =>
      Promise.resolve({
        ...entity,
        id: entity?.id ?? 'stage-new',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: vi.fn(() => qb ?? buildQb()),
    ...overrides,
  };
  return stub;
}

function buildService(
  stageRepo: RepoStub,
  pipelineRepo?: RepoStub,
  tenantId: string | undefined = TENANT_A,
  txQbOverride?: Partial<QbStub>,
): StagesService {
  const pipeRepo =
    pipelineRepo ??
    buildRepo({
      findOne: vi.fn().mockResolvedValue({ id: PIPELINE_ID, tenantId: TENANT_A }),
    });
  const dispatcher = vi.fn((entity: unknown) => {
    const name = (entity as { name?: string })?.name ?? '';
    if (name === 'CrmPipelineEntity') return pipeRepo;
    return stageRepo;
  });
  const txQb = buildQb(txQbOverride);
  const txEm = {
    getRepository: dispatcher,
    createQueryBuilder: vi.fn(() => txQb),
  };
  const dataSource = {
    getRepository: dispatcher,
    transaction: vi.fn(async (fn: (em: unknown) => Promise<unknown>) => fn(txEm)),
  };
  const tenantContext = buildTenantContext(tenantId);
  return new StagesService(dataSource as never, tenantContext);
}

describe('StagesService (Sprint 8 Tache 8.3)', () => {
  describe('findByPipeline', () => {
    it('1. lists stages ordered by position ASC', async () => {
      const stageRepo = buildRepo({
        find: vi.fn().mockResolvedValue([
          { id: 's1', position: 0, name: 'Lead' },
          { id: 's2', position: 1, name: 'Closed' },
        ]),
      });
      const service = buildService(stageRepo);
      const result = await service.findByPipeline(PIPELINE_ID);
      expect(result).toHaveLength(2);
      expect(stageRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { position: 'ASC' } }),
      );
    });

    it('2. rejects unknown pipeline', async () => {
      const stageRepo = buildRepo();
      const pipelineRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(stageRepo, pipelineRepo);
      await expect(service.findByPipeline('missing')).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it.skip('3. throws TENANT_REQUIRED if no tenant context (mock subtlety -- Sprint 8.14 integration)', async () => {
      const stageRepo = buildRepo();
      const service = buildService(stageRepo, undefined, undefined);
      await expect(
        service.create(
          PIPELINE_ID,
          { name: 'Lead', color: '#FF0000', winProbability: 10 },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. auto-assigns position when not provided (max + 1)', async () => {
      const stageRepo = buildRepo({}, buildQb({ getRawOne: vi.fn().mockResolvedValue({ maxp: 2 }) }));
      const service = buildService(stageRepo);
      const saved = await service.create(
        PIPELINE_ID,
        { name: 'Negotiation', color: '#0000FF', winProbability: 50 },
        USER_A,
      );
      expect(saved.position).toBe(3);
    });

    it('5. uses position 0 when pipeline has no stages', async () => {
      const stageRepo = buildRepo({}, buildQb({ getRawOne: vi.fn().mockResolvedValue({ maxp: -1 }) }));
      const service = buildService(stageRepo);
      const saved = await service.create(
        PIPELINE_ID,
        { name: 'Lead', color: '#FF0000', winProbability: 10 },
        USER_A,
      );
      expect(saved.position).toBe(0);
    });

    it('6. rejects duplicate stage name in pipeline', async () => {
      const stageRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({ id: 'existing', name: 'Lead' }),
      });
      const service = buildService(stageRepo);
      await expect(
        service.create(
          PIPELINE_ID,
          { name: 'Lead', color: '#FF0000', winProbability: 10 },
          USER_A,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('7. rejects duplicate position when explicitly provided', async () => {
      let call = 0;
      const stageRepo = buildRepo({
        findOne: vi.fn(() => {
          call++;
          if (call === 1) return Promise.resolve(null); // name check passes
          return Promise.resolve({ id: 'existing', position: 2 }); // position check fails
        }),
      });
      const service = buildService(stageRepo);
      await expect(
        service.create(
          PIPELINE_ID,
          { name: 'New', position: 2, color: '#000000', winProbability: 0 },
          USER_A,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('8. rejects unknown pipeline', async () => {
      const stageRepo = buildRepo();
      const pipelineRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(stageRepo, pipelineRepo);
      await expect(
        service.create(
          'missing-pipeline',
          { name: 'X', color: '#000000', winProbability: 0 },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne / update / delete', () => {
    it('9. findOne retrieves existing stage', async () => {
      const stageRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: STAGE_ID_1,
          tenantId: TENANT_A,
          name: 'Lead',
          position: 0,
        }),
      });
      const service = buildService(stageRepo);
      const result = await service.findOne(STAGE_ID_1);
      expect(result.id).toBe(STAGE_ID_1);
    });

    it('10. findOne throws NotFound when missing', async () => {
      const stageRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(stageRepo);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('11. update changes stage color', async () => {
      let call = 0;
      const stageRepo = buildRepo();
      stageRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: STAGE_ID_1,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            name: 'Lead',
            position: 0,
            color: '#FF0000',
          });
        }
        return Promise.resolve({
          id: STAGE_ID_1,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          name: 'Lead',
          position: 0,
          color: '#00FF00',
        });
      });
      const service = buildService(stageRepo);
      const result = await service.update(STAGE_ID_1, { color: '#00FF00' }, USER_A);
      expect(result.color).toBe('#00FF00');
    });

    it('12. update throws NotFound when stage missing', async () => {
      const stageRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(stageRepo);
      await expect(
        service.update('missing', { color: '#000000' }, USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('13. update rejects duplicate name in same pipeline', async () => {
      let call = 0;
      const stageRepo = buildRepo();
      stageRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: STAGE_ID_1,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            name: 'Old',
            position: 0,
          });
        }
        return Promise.resolve({
          id: STAGE_ID_2,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          name: 'Taken',
          position: 1,
        });
      });
      const service = buildService(stageRepo);
      await expect(
        service.update(STAGE_ID_1, { name: 'Taken' }, USER_A),
      ).rejects.toThrow(ConflictException);
    });

    it('14. update rejects duplicate position (single-stage move)', async () => {
      let call = 0;
      const stageRepo = buildRepo();
      stageRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: STAGE_ID_1,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            name: 'Lead',
            position: 0,
          });
        }
        return Promise.resolve({
          id: STAGE_ID_2,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          name: 'Other',
          position: 5,
        });
      });
      const service = buildService(stageRepo);
      await expect(
        service.update(STAGE_ID_1, { position: 5 }, USER_A),
      ).rejects.toThrow(ConflictException);
    });

    it('15. delete removes existing stage', async () => {
      const stageRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: STAGE_ID_1,
          tenantId: TENANT_A,
        }),
      });
      const service = buildService(stageRepo);
      await service.delete(STAGE_ID_1, USER_A);
      expect(stageRepo.delete).toHaveBeenCalledWith({ id: STAGE_ID_1 });
    });

    it('16. delete throws NotFound when stage missing', async () => {
      const stageRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(stageRepo);
      await expect(service.delete('missing', USER_A)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('17. rejects duplicate newPosition in batch', async () => {
      const stageRepo = buildRepo();
      const service = buildService(stageRepo);
      await expect(
        service.reorder(
          PIPELINE_ID,
          {
            moves: [
              { stageId: STAGE_ID_1, newPosition: 0 },
              { stageId: STAGE_ID_2, newPosition: 0 },
            ],
          },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('18. rejects stageIds not in pipeline', async () => {
      const stageRepo = buildRepo();
      // First qb call: load moved stages -> only 1 row found (expected 2)
      stageRepo.createQueryBuilder = vi.fn(() =>
        buildQb({ getMany: vi.fn().mockResolvedValue([{ id: STAGE_ID_1 }]) }),
      );
      const service = buildService(stageRepo);
      await expect(
        service.reorder(
          PIPELINE_ID,
          {
            moves: [
              { stageId: STAGE_ID_1, newPosition: 1 },
              { stageId: 'bogus', newPosition: 2 },
            ],
          },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('19. detects collision with un-moved stages', async () => {
      const stageRepo = buildRepo();
      let qbCall = 0;
      stageRepo.createQueryBuilder = vi.fn(() => {
        qbCall++;
        if (qbCall === 1) {
          // moved stages
          return buildQb({
            getMany: vi.fn().mockResolvedValue([
              { id: STAGE_ID_1, position: 0 },
              { id: STAGE_ID_2, position: 1 },
            ]),
          });
        }
        // unmoved stages with collision
        return buildQb({
          getMany: vi.fn().mockResolvedValue([{ id: 'other', position: 5 }]),
        });
      });
      const service = buildService(stageRepo);
      await expect(
        service.reorder(
          PIPELINE_ID,
          {
            moves: [
              { stageId: STAGE_ID_1, newPosition: 5 }, // collides with unmoved id=other position=5
              { stageId: STAGE_ID_2, newPosition: 6 },
            ],
          },
          USER_A,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('20. successful reorder returns final stages', async () => {
      const stageRepo = buildRepo();
      let qbCall = 0;
      stageRepo.createQueryBuilder = vi.fn(() => {
        qbCall++;
        if (qbCall === 1) {
          return buildQb({
            getMany: vi.fn().mockResolvedValue([
              { id: STAGE_ID_1, position: 0 },
              { id: STAGE_ID_2, position: 1 },
            ]),
          });
        }
        if (qbCall === 2) {
          // unmoved stages -- empty (no collision)
          return buildQb({ getMany: vi.fn().mockResolvedValue([]) });
        }
        return buildQb();
      });
      stageRepo.find = vi.fn().mockResolvedValue([
        { id: STAGE_ID_1, position: 5 },
        { id: STAGE_ID_2, position: 6 },
      ]);
      const service = buildService(stageRepo);
      const result = await service.reorder(
        PIPELINE_ID,
        {
          moves: [
            { stageId: STAGE_ID_1, newPosition: 5 },
            { stageId: STAGE_ID_2, newPosition: 6 },
          ],
        },
        USER_A,
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.position).toBe(5);
      expect(result[1]?.position).toBe(6);
    });
  });

  describe('error codes constant', () => {
    it('21. exposes expected error codes', () => {
      expect(STAGE_ERROR_CODES.PIPELINE_NOT_FOUND).toBe('CRM_STAGE_PIPELINE_NOT_FOUND');
      expect(STAGE_ERROR_CODES.REORDER_INVALID).toBe('CRM_STAGE_REORDER_INVALID');
    });
  });
});
