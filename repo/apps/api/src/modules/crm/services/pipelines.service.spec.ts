/**
 * Tests PipelinesService -- Sprint 8 Tache 8.3.
 *
 * Unit tests avec DataSource + EntityManager mocks. Tests integration (RLS live +
 * UNIQUE partial is_default + cascade stages) seront ajoutes Sprint 8.14.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import {
  PipelinesService,
  PIPELINE_ERROR_CODES,
} from './pipelines.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const PIPELINE_ID = '00000000-0000-0000-0000-000000000100';

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

interface RepoStub {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  const qb = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    getMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    create: vi.fn((data) => ({ ...data, id: 'pipeline-1' })),
    save: vi.fn((entity) =>
      Array.isArray(entity)
        ? Promise.resolve(entity.map((e, i) => ({ ...e, id: `stage-${i}` })))
        : Promise.resolve({
            ...entity,
            id: entity?.id ?? 'pipeline-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
    ),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: vi.fn(() => qb),
    ...overrides,
  };
}

/**
 * Builds a service with dataSource that supports both direct getRepository and
 * transaction-scoped EntityManager.getRepository. Pipeline + Stage repos
 * dispatched by entity name.
 */
function buildService(
  pipelineRepo: RepoStub,
  stageRepo?: RepoStub,
  tenantId: string | undefined = TENANT_A,
): PipelinesService {
  const stRepo = stageRepo ?? buildRepo();
  const dispatcher = vi.fn((entity: unknown) => {
    const name = (entity as { name?: string })?.name ?? '';
    if (name === 'CrmStageEntity') return stRepo;
    return pipelineRepo;
  });
  const txQb = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const txEm = {
    getRepository: dispatcher,
    createQueryBuilder: vi.fn(() => txQb),
  };
  const dataSource = {
    getRepository: dispatcher,
    transaction: vi.fn(async (fn: (em: unknown) => Promise<unknown>) => fn(txEm)),
  };
  const tenantContext = buildTenantContext(tenantId);
  return new PipelinesService(dataSource as never, tenantContext);
}

describe('PipelinesService (Sprint 8 Tache 8.3)', () => {
  describe('create', () => {
    it('1. throws TENANT_REQUIRED if no tenant context', async () => {
      const repo = buildRepo();
      // Empty string bypasses TS default-parameter substitution + trips
      // buildTenantContext's falsy ternary. (Task 8.14 mock-subtlety fix.)
      const service = buildService(repo, undefined, '');
      await expect(
        service.create({ name: 'X', isDefault: false }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });

    it('2. creates pipeline without stages', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.create(
        { name: 'Pipeline Auto', isDefault: false },
        USER_A,
      );
      expect(result.id).toBe('pipeline-1');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pipeline Auto', tenantId: TENANT_A }),
      );
    });

    it('3. rejects duplicate pipeline name in same tenant', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({ id: 'existing', name: 'Auto' }),
      });
      const service = buildService(repo);
      await expect(
        service.create({ name: 'Auto', isDefault: false }, USER_A),
      ).rejects.toThrow(ConflictException);
    });

    it('4. creates pipeline with cascade stages', async () => {
      const pipelineRepo = buildRepo();
      const stageRepo = buildRepo();
      const service = buildService(pipelineRepo, stageRepo);
      await service.create(
        {
          name: 'Pipeline Sante',
          isDefault: false,
          stages: [
            { name: 'Lead', position: 0, color: '#FF0000', winProbability: 10 },
            { name: 'Closed', position: 1, color: '#00FF00', winProbability: 100 },
          ],
        },
        USER_A,
      );
      expect(stageRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Lead', position: 0 }),
          expect.objectContaining({ name: 'Closed', position: 1 }),
        ]),
      );
    });

    it('5. rejects cascade stages with duplicate name', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      await expect(
        service.create(
          {
            name: 'P',
            isDefault: false,
            stages: [
              { name: 'A', position: 0, color: '#000000', winProbability: 0 },
              { name: 'A', position: 1, color: '#000000', winProbability: 0 },
            ],
          },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. rejects cascade stages with duplicate position', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      await expect(
        service.create(
          {
            name: 'P',
            isDefault: false,
            stages: [
              { name: 'A', position: 0, color: '#000000', winProbability: 0 },
              { name: 'B', position: 0, color: '#000000', winProbability: 0 },
            ],
          },
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('7. retrieves existing pipeline with stages ordered', async () => {
      const pipelineRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: 'pipeline-1',
          tenantId: TENANT_A,
          name: 'Auto',
          isDefault: true,
        }),
      });
      const stageRepo = buildRepo({
        find: vi.fn().mockResolvedValue([
          { id: 's1', position: 0, name: 'Lead' },
          { id: 's2', position: 1, name: 'Closed' },
        ]),
      });
      const service = buildService(pipelineRepo, stageRepo);
      const result = await service.findOne('pipeline-1');
      expect(result.id).toBe('pipeline-1');
      expect(result.stages).toHaveLength(2);
      expect(stageRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { position: 'ASC' } }),
      );
    });

    it('8. throws NotFound if missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('9. returns paginated empty result', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.list({
        limit: 50,
        offset: 0,
        orderBy: 'created_at',
        orderDir: 'DESC',
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('update', () => {
    it('10. updates pipeline name', async () => {
      // update calls findOne: 1) load existing, 2) dup-name check (return null), 3) reload final
      let callCount = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: PIPELINE_ID,
            tenantId: TENANT_A,
            name: 'Old',
            isDefault: false,
          });
        }
        if (callCount === 2) {
          return Promise.resolve(null); // no duplicate name
        }
        return Promise.resolve({
          id: PIPELINE_ID,
          tenantId: TENANT_A,
          name: 'New',
          isDefault: false,
        });
      });
      const service = buildService(repo);
      const result = await service.update(PIPELINE_ID, { name: 'New' }, USER_A);
      expect(result.name).toBe('New');
    });

    it('11. throws NotFound if pipeline missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(
        service.update(PIPELINE_ID, { name: 'X' }, USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('12. rejects duplicate name update', async () => {
      let callCount = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: PIPELINE_ID,
            tenantId: TENANT_A,
            name: 'Old',
            isDefault: false,
          });
        }
        // duplicate name check returns another pipeline that already has the target name
        return Promise.resolve({
          id: 'other-pipeline',
          tenantId: TENANT_A,
          name: 'Taken',
        });
      });
      const service = buildService(repo);
      await expect(
        service.update(PIPELINE_ID, { name: 'Taken' }, USER_A),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setDefault', () => {
    it('13. delegates to update with isDefault=true', async () => {
      let callCount = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        callCount++;
        return Promise.resolve({
          id: 'pipeline-1',
          tenantId: TENANT_A,
          name: 'Auto',
          isDefault: callCount > 1,
        });
      });
      const service = buildService(repo);
      const result = await service.setDefault(PIPELINE_ID, USER_A);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('delete', () => {
    it('14. deletes existing pipeline', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: 'pipeline-1',
          tenantId: TENANT_A,
        }),
      });
      const service = buildService(repo);
      await service.delete(PIPELINE_ID, USER_A);
      expect(repo.delete).toHaveBeenCalledWith({ id: PIPELINE_ID });
    });

    it('15. throws NotFound if pipeline missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.delete('missing', USER_A)).rejects.toThrow(NotFoundException);
    });
  });

  describe('error codes constant', () => {
    it('16. exposes expected error codes', () => {
      expect(PIPELINE_ERROR_CODES.NAME_DUPLICATE).toBe('CRM_PIPELINE_NAME_DUPLICATE');
      expect(PIPELINE_ERROR_CODES.NOT_FOUND).toBe('CRM_PIPELINE_NOT_FOUND');
    });
  });
});
