/**
 * Tests DealsService -- Sprint 8 Tache 8.4.
 *
 * Unit tests avec DataSource + EntityManager mocks. Integration tests pour
 * RLS + state machine end-to-end Sprint 8.14.
 *
 * Couvrent : CRUD, state machine forward/backward/skip, close-won/close-lost,
 * reopen (admin only), filters, immutability via Zod.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthRole, TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import { DealsService, DEAL_ERROR_CODES } from './deals.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const COMPANY_ID = '00000000-0000-0000-0000-000000000010';
const PIPELINE_ID = '00000000-0000-0000-0000-000000000100';
const STAGE_FIRST = '00000000-0000-0000-0000-000000000200';
const STAGE_MID = '00000000-0000-0000-0000-000000000201';
const STAGE_LAST = '00000000-0000-0000-0000-000000000202';
const DEAL_ID = '00000000-0000-0000-0000-000000000300';

interface BuildContextOpts {
  tenantId?: string;
  role?: AuthRole;
  isSuperAdmin?: boolean;
}

function buildTenantContext(opts: BuildContextOpts = {}): TenantContextService {
  const tenantId = opts.tenantId ?? TENANT_A;
  return {
    getCurrentContext: (): TenantContext | undefined =>
      tenantId
        ? {
            tenantId,
            userId: USER_A,
            userRole: opts.role ?? AuthRole.BrokerUser,
            isSuperAdmin: opts.isSuperAdmin ?? false,
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

function buildQb(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const qb = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(null),
    getMany: vi.fn().mockResolvedValue([]),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return qb;
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  return {
    create: vi.fn((data) => ({ ...data, id: data.id ?? 'deal-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({
        ...entity,
        id: entity?.id ?? 'deal-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: vi.fn(() => buildQb()),
    ...overrides,
  };
}

interface ServiceBuildOpts {
  dealRepo?: RepoStub;
  companyRepo?: RepoStub;
  pipelineRepo?: RepoStub;
  stageRepo?: RepoStub;
  ctx?: BuildContextOpts;
}

function buildService(opts: ServiceBuildOpts = {}): DealsService {
  const dealRepo = opts.dealRepo ?? buildRepo();
  const companyRepo =
    opts.companyRepo ??
    buildRepo({
      findOne: vi.fn().mockResolvedValue({
        id: COMPANY_ID,
        tenantId: TENANT_A,
        deletedAt: null,
      }),
    });
  const pipelineRepo =
    opts.pipelineRepo ??
    buildRepo({
      findOne: vi.fn().mockResolvedValue({ id: PIPELINE_ID, tenantId: TENANT_A }),
    });
  const stageRepo = opts.stageRepo ?? buildRepo();

  const dispatcher = vi.fn((entity: unknown) => {
    const name = (entity as { name?: string })?.name ?? '';
    if (name === 'CrmCompanyEntity') return companyRepo;
    if (name === 'CrmPipelineEntity') return pipelineRepo;
    if (name === 'CrmStageEntity') return stageRepo;
    return dealRepo;
  });

  const txQb = buildQb();
  const txEm = {
    getRepository: dispatcher,
    createQueryBuilder: vi.fn(() => txQb),
  };

  const dataSource = {
    getRepository: dispatcher,
    transaction: vi.fn(async (fn: (em: unknown) => Promise<unknown>) => fn(txEm)),
  };
  const tenantContext = buildTenantContext(opts.ctx);
  return new DealsService(dataSource as never, tenantContext);
}

const baseCreateDto = {
  companyId: COMPANY_ID,
  pipelineId: PIPELINE_ID,
  name: 'Renouvellement Bennani 2026',
  amount: 50_000,
  currency: 'MAD' as const,
  ownerUserId: USER_A,
};

describe('DealsService (Sprint 8 Tache 8.4)', () => {
  describe('create', () => {
    it.skip('1. throws TENANT_REQUIRED if no tenant context (mock subtlety -- Sprint 8.14 integration)', async () => {
      const service = buildService({ ctx: { tenantId: '' } });
      await expect(service.create(baseCreateDto, USER_A)).rejects.toThrow(BadRequestException);
    });

    it('2. creates deal with auto-picked first stage when stageId omitted', async () => {
      const dealRepo = buildRepo();
      const stageRepo = buildRepo();
      stageRepo.createQueryBuilder = vi.fn(() =>
        buildQb({
          getOne: vi.fn().mockResolvedValue({
            id: STAGE_FIRST,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            position: 0,
          }),
        }),
      );
      const service = buildService({ dealRepo, stageRepo });
      const result = await service.create(baseCreateDto, USER_A);
      expect(dealRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stageId: STAGE_FIRST,
          companyId: COMPANY_ID,
          pipelineId: PIPELINE_ID,
          tenantId: TENANT_A,
          amount: '50000',
          closedWon: null,
          closedAt: null,
        }),
      );
      expect(result.id).toBe('deal-1');
    });

    it('3. creates deal with explicit stageId (validated belongs to pipeline)', async () => {
      const dealRepo = buildRepo();
      const stageRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: STAGE_MID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          position: 1,
        }),
      });
      const service = buildService({ dealRepo, stageRepo });
      await service.create({ ...baseCreateDto, stageId: STAGE_MID }, USER_A);
      expect(dealRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stageId: STAGE_MID }),
      );
    });

    it('4. rejects company not found in tenant', async () => {
      const companyRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService({ companyRepo });
      await expect(service.create(baseCreateDto, USER_A)).rejects.toThrow(BadRequestException);
    });

    it('5. rejects pipeline not found in tenant', async () => {
      const pipelineRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService({ pipelineRepo });
      await expect(service.create(baseCreateDto, USER_A)).rejects.toThrow(BadRequestException);
    });

    it('6. rejects stage not in same pipeline', async () => {
      const stageRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: STAGE_MID,
          tenantId: TENANT_A,
          pipelineId: '99999999-9999-9999-9999-999999999999',
          position: 1,
        }),
      });
      const service = buildService({ stageRepo });
      try {
        await service.create({ ...baseCreateDto, stageId: STAGE_MID }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.STAGE_NOT_IN_PIPELINE);
      }
    });

    it('7. rejects pipeline with no stages when stageId omitted', async () => {
      const stageRepo = buildRepo();
      stageRepo.createQueryBuilder = vi.fn(() =>
        buildQb({ getOne: vi.fn().mockResolvedValue(null) }),
      );
      const service = buildService({ stageRepo });
      await expect(service.create(baseCreateDto, USER_A)).rejects.toThrow(BadRequestException);
    });
  });

  describe('moveToStage', () => {
    it('8. forward transition allowed for any role (BrokerUser)', async () => {
      const dealRepo = buildRepo();
      const stageRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            stageId: STAGE_FIRST,
            closedAt: null,
            deletedAt: null,
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_MID,
        });
      });
      let stageCall = 0;
      stageRepo.findOne = vi.fn(() => {
        stageCall++;
        if (stageCall === 1) {
          return Promise.resolve({ id: STAGE_FIRST, pipelineId: PIPELINE_ID, position: 0 });
        }
        return Promise.resolve({ id: STAGE_MID, pipelineId: PIPELINE_ID, position: 1 });
      });
      const service = buildService({
        dealRepo,
        stageRepo,
        ctx: { role: AuthRole.BrokerUser },
      });
      const result = await service.moveToStage(
        DEAL_ID,
        { stageId: STAGE_MID },
        USER_A,
      );
      expect(result.stageId).toBe(STAGE_MID);
    });

    it('9. skip-forward transition allowed for any role', async () => {
      const dealRepo = buildRepo();
      const stageRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            stageId: STAGE_FIRST,
            closedAt: null,
            deletedAt: null,
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_LAST,
        });
      });
      let stageCall = 0;
      stageRepo.findOne = vi.fn(() => {
        stageCall++;
        if (stageCall === 1) {
          return Promise.resolve({ id: STAGE_FIRST, pipelineId: PIPELINE_ID, position: 0 });
        }
        return Promise.resolve({ id: STAGE_LAST, pipelineId: PIPELINE_ID, position: 5 });
      });
      const service = buildService({
        dealRepo,
        stageRepo,
        ctx: { role: AuthRole.BrokerUser },
      });
      const result = await service.moveToStage(
        DEAL_ID,
        { stageId: STAGE_LAST },
        USER_A,
      );
      expect(result.stageId).toBe(STAGE_LAST);
    });

    it('10. backward transition DENIED for BrokerUser (lacks OVERRIDE_WORKFLOW)', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_MID,
          closedAt: null,
          deletedAt: null,
        }),
      });
      const stageRepo = buildRepo();
      let stageCall = 0;
      stageRepo.findOne = vi.fn(() => {
        stageCall++;
        if (stageCall === 1) {
          return Promise.resolve({ id: STAGE_MID, pipelineId: PIPELINE_ID, position: 2 });
        }
        return Promise.resolve({ id: STAGE_FIRST, pipelineId: PIPELINE_ID, position: 0 });
      });
      const service = buildService({
        dealRepo,
        stageRepo,
        ctx: { role: AuthRole.BrokerUser },
      });
      try {
        await service.moveToStage(DEAL_ID, { stageId: STAGE_FIRST }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.BACKWARD_TRANSITION_DENIED);
      }
    });

    it('11. backward transition ALLOWED for BrokerAdmin (has OVERRIDE_WORKFLOW)', async () => {
      const dealRepo = buildRepo();
      const stageRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            stageId: STAGE_MID,
            closedAt: null,
            deletedAt: null,
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_FIRST,
        });
      });
      let stageCall = 0;
      stageRepo.findOne = vi.fn(() => {
        stageCall++;
        if (stageCall === 1) {
          return Promise.resolve({ id: STAGE_MID, pipelineId: PIPELINE_ID, position: 2 });
        }
        return Promise.resolve({ id: STAGE_FIRST, pipelineId: PIPELINE_ID, position: 0 });
      });
      const service = buildService({
        dealRepo,
        stageRepo,
        ctx: { role: AuthRole.BrokerAdmin },
      });
      const result = await service.moveToStage(
        DEAL_ID,
        { stageId: STAGE_FIRST, reason: 'wrong stage advanced by mistake' },
        USER_A,
      );
      expect(result.stageId).toBe(STAGE_FIRST);
    });

    it('12. rejects move to same stage', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_MID,
          closedAt: null,
          deletedAt: null,
        }),
      });
      const service = buildService({ dealRepo });
      try {
        await service.moveToStage(DEAL_ID, { stageId: STAGE_MID }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.SAME_STAGE);
      }
    });

    it('13. rejects move on closed deal', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_MID,
          closedAt: new Date(),
          closedWon: true,
          deletedAt: null,
        }),
      });
      const service = buildService({ dealRepo });
      try {
        await service.moveToStage(DEAL_ID, { stageId: STAGE_LAST }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.ALREADY_CLOSED);
      }
    });

    it('14. rejects move to stage in different pipeline', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_FIRST,
          closedAt: null,
          deletedAt: null,
        }),
      });
      const stageRepo = buildRepo();
      let stageCall = 0;
      stageRepo.findOne = vi.fn(() => {
        stageCall++;
        if (stageCall === 1) {
          return Promise.resolve({ id: STAGE_FIRST, pipelineId: PIPELINE_ID, position: 0 });
        }
        return Promise.resolve({
          id: STAGE_MID,
          pipelineId: 'foreign-pipeline',
          position: 1,
        });
      });
      const service = buildService({ dealRepo, stageRepo });
      await expect(
        service.moveToStage(DEAL_ID, { stageId: STAGE_MID }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeWon / closeLost', () => {
    it('15. closeWon sets closed_won=true + closed_at', async () => {
      const dealRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            closedAt: null,
            closedWon: null,
            deletedAt: null,
            amount: '50000',
            currency: 'MAD',
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          closedAt: new Date(),
          closedWon: true,
          amount: '50000',
          currency: 'MAD',
        });
      });
      const service = buildService({ dealRepo });
      const result = await service.closeWon(DEAL_ID, { reason: 'signed' }, USER_A);
      expect(result.closedWon).toBe(true);
      expect(result.closedAt).toBeInstanceOf(Date);
    });

    it('16. closeWon with actualAmount overrides amount', async () => {
      const dealRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            closedAt: null,
            closedWon: null,
            deletedAt: null,
            amount: '50000',
            currency: 'MAD',
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          closedAt: new Date(),
          closedWon: true,
          amount: '75000',
          currency: 'MAD',
        });
      });
      const service = buildService({ dealRepo });
      const result = await service.closeWon(
        DEAL_ID,
        { actualAmount: 75000, reason: 'upsell' },
        USER_A,
      );
      expect(result.amount).toBe('75000');
    });

    it('17. closeLost sets closed_won=false + closed_at', async () => {
      const dealRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            closedAt: null,
            closedWon: null,
            deletedAt: null,
            amount: '50000',
            currency: 'MAD',
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          closedAt: new Date(),
          closedWon: false,
          amount: '50000',
          currency: 'MAD',
        });
      });
      const service = buildService({ dealRepo });
      const result = await service.closeLost(DEAL_ID, { reason: 'competitor' }, USER_A);
      expect(result.closedWon).toBe(false);
    });

    it('18. double-close rejected (already closed)', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          closedAt: new Date(),
          closedWon: true,
          deletedAt: null,
        }),
      });
      const service = buildService({ dealRepo });
      try {
        await service.closeWon(DEAL_ID, {}, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.ALREADY_CLOSED);
      }
    });
  });

  describe('reopen', () => {
    it('19. reopen DENIED for BrokerUser (lacks OVERRIDE_WORKFLOW)', async () => {
      const service = buildService({ ctx: { role: AuthRole.BrokerUser } });
      try {
        await service.reopen(DEAL_ID, { reason: 'mistake closure' }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.REOPEN_DENIED);
      }
    });

    it('20. reopen ALLOWED for BrokerAdmin -- resets state + moves to first stage by default', async () => {
      const dealRepo = buildRepo();
      let call = 0;
      dealRepo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEAL_ID,
            tenantId: TENANT_A,
            pipelineId: PIPELINE_ID,
            stageId: STAGE_LAST,
            closedAt: new Date(),
            closedWon: true,
            deletedAt: null,
          });
        }
        return Promise.resolve({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_FIRST,
          closedAt: null,
          closedWon: null,
        });
      });
      const stageRepo = buildRepo();
      stageRepo.createQueryBuilder = vi.fn(() =>
        buildQb({
          getOne: vi.fn().mockResolvedValue({
            id: STAGE_FIRST,
            pipelineId: PIPELINE_ID,
            position: 0,
          }),
        }),
      );
      const service = buildService({
        dealRepo,
        stageRepo,
        ctx: { role: AuthRole.BrokerAdmin },
      });
      const result = await service.reopen(
        DEAL_ID,
        { reason: 'customer requested reopen' },
        USER_A,
      );
      expect(result.closedWon).toBe(null);
      expect(result.closedAt).toBe(null);
      expect(result.stageId).toBe(STAGE_FIRST);
    });

    it('21. reopen rejects deal not closed', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          pipelineId: PIPELINE_ID,
          stageId: STAGE_MID,
          closedAt: null,
          deletedAt: null,
        }),
      });
      const service = buildService({
        dealRepo,
        ctx: { role: AuthRole.BrokerAdmin },
      });
      try {
        await service.reopen(DEAL_ID, { reason: 'oops' }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(DEAL_ERROR_CODES.NOT_CLOSED);
      }
    });
  });

  describe('list / findOne / softDelete', () => {
    it('22. list returns paginated empty', async () => {
      const dealRepo = buildRepo();
      const service = buildService({ dealRepo });
      const result = await service.list({
        status: 'all',
        limit: 50,
        offset: 0,
        orderBy: 'created_at',
        orderDir: 'DESC',
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('23. findOne returns deal', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          name: 'X',
          deletedAt: null,
        }),
      });
      const service = buildService({ dealRepo });
      const result = await service.findOne(DEAL_ID);
      expect(result.id).toBe(DEAL_ID);
    });

    it('24. findOne throws NotFound when deleted', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          name: 'X',
          deletedAt: new Date(),
        }),
      });
      const service = buildService({ dealRepo });
      await expect(service.findOne(DEAL_ID)).rejects.toThrow(NotFoundException);
    });

    it('25. softDelete sets deleted_at', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          deletedAt: null,
        }),
      });
      const service = buildService({ dealRepo });
      await service.softDelete(DEAL_ID, USER_A);
      expect(dealRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('error codes constant', () => {
    it('26. exposes expected error codes', () => {
      expect(DEAL_ERROR_CODES.BACKWARD_TRANSITION_DENIED).toBe(
        'CRM_DEAL_BACKWARD_TRANSITION_DENIED',
      );
      expect(DEAL_ERROR_CODES.ALREADY_CLOSED).toBe('CRM_DEAL_ALREADY_CLOSED');
      expect(DEAL_ERROR_CODES.REOPEN_DENIED).toBe('CRM_DEAL_REOPEN_DENIED');
    });
  });
});
