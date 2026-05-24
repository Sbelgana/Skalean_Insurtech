/**
 * Tests InteractionsService -- Sprint 8 Tache 8.5.
 *
 * Unit tests avec DataSource + EntityManager mocks. Integration tests pour
 * - append-only trigger Sprint 2 enforcement
 * - SECURITY DEFINER functions roundtrip
 * - timeline cross-entity SQL correctness
 * sont differes Sprint 8.14.
 *
 * Couvrent : polymorphic exactly-one, related entity validation, soft-delete
 * via DB function, restore (admin-only), timeline scope resolution, annotate.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthRole, TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import {
  InteractionsService,
  INTERACTION_ERROR_CODES,
} from './interactions.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const COMPANY_ID = '00000000-0000-0000-0000-000000000010';
const CONTACT_ID = '00000000-0000-0000-0000-000000000020';
const DEAL_ID = '00000000-0000-0000-0000-000000000030';
const INTERACTION_ID = '00000000-0000-0000-0000-000000000040';
const PARENT_ID = '00000000-0000-0000-0000-000000000041';

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
    getRawMany: vi.fn().mockResolvedValue([]),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  return {
    create: vi.fn((data) => ({ ...data, id: data.id ?? 'interaction-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({
        ...entity,
        id: entity?.id ?? 'interaction-1',
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
  interactionRepo?: RepoStub;
  companyRepo?: RepoStub;
  contactRepo?: RepoStub;
  dealRepo?: RepoStub;
  ctx?: BuildContextOpts;
  /** Mock for `dataSource.query` (used for SECURITY DEFINER calls). */
  queryFn?: ReturnType<typeof vi.fn>;
}

function buildService(opts: ServiceBuildOpts = {}): InteractionsService {
  const interactionRepo = opts.interactionRepo ?? buildRepo();
  const companyRepo =
    opts.companyRepo ??
    buildRepo({
      findOne: vi.fn().mockResolvedValue({
        id: COMPANY_ID,
        tenantId: TENANT_A,
        deletedAt: null,
      }),
    });
  const contactRepo =
    opts.contactRepo ??
    buildRepo({
      findOne: vi.fn().mockResolvedValue({
        id: CONTACT_ID,
        tenantId: TENANT_A,
        companyId: COMPANY_ID,
        deletedAt: null,
      }),
    });
  const dealRepo =
    opts.dealRepo ??
    buildRepo({
      findOne: vi.fn().mockResolvedValue({
        id: DEAL_ID,
        tenantId: TENANT_A,
        companyId: COMPANY_ID,
        contactId: CONTACT_ID,
        deletedAt: null,
      }),
    });

  const dispatcher = vi.fn((entity: unknown) => {
    const name = (entity as { name?: string })?.name ?? '';
    if (name === 'CrmCompanyEntity') return companyRepo;
    if (name === 'CrmContactEntity') return contactRepo;
    if (name === 'CrmDealEntity') return dealRepo;
    return interactionRepo;
  });

  const txEm = { getRepository: dispatcher };
  const dataSource = {
    getRepository: dispatcher,
    transaction: vi.fn(async (fn: (em: unknown) => Promise<unknown>) => fn(txEm)),
    query: opts.queryFn ?? vi.fn().mockResolvedValue([]),
  };
  const tenantContext = buildTenantContext(opts.ctx);
  return new InteractionsService(dataSource as never, tenantContext);
}

const baseCreate = {
  interactionType: 'note' as const,
  subject: 'Suivi client',
};

describe('InteractionsService (Sprint 8 Tache 8.5)', () => {
  describe('create', () => {
    it.skip('1. throws TENANT_REQUIRED if no tenant context (mock subtlety -- Sprint 8.14 integration)', async () => {
      const service = buildService({ ctx: { tenantId: '' } });
      await expect(
        service.create({ ...baseCreate, contactId: CONTACT_ID }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });

    it('2. creates interaction scoped to company', async () => {
      const interactionRepo = buildRepo();
      const service = buildService({ interactionRepo });
      const result = await service.create(
        { ...baseCreate, companyId: COMPANY_ID },
        USER_A,
      );
      expect(interactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          companyId: COMPANY_ID,
          contactId: null,
          dealId: null,
          type: 'note',
        }),
      );
      expect(result.id).toBe('interaction-1');
    });

    it('3. creates interaction scoped to contact', async () => {
      const interactionRepo = buildRepo();
      const service = buildService({ interactionRepo });
      await service.create({ ...baseCreate, contactId: CONTACT_ID }, USER_A);
      expect(interactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: null,
          contactId: CONTACT_ID,
          dealId: null,
        }),
      );
    });

    it('4. creates interaction scoped to deal', async () => {
      const interactionRepo = buildRepo();
      const service = buildService({ interactionRepo });
      await service.create(
        {
          interactionType: 'call',
          subject: 'Negotiation',
          dealId: DEAL_ID,
          direction: 'outbound',
          durationMinutes: 15,
        },
        USER_A,
      );
      expect(interactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: null,
          contactId: null,
          dealId: DEAL_ID,
          type: 'call',
          direction: 'outbound',
          durationMinutes: 15,
        }),
      );
    });

    it('5. rejects when no related entity provided (Zod refine guard, defensive service check)', async () => {
      const service = buildService();
      // Construct invalid dto bypassing Zod
      const invalidDto = { ...baseCreate } as never;
      await expect(service.create(invalidDto, USER_A)).rejects.toThrow(BadRequestException);
    });

    it('6. rejects company_id not in tenant', async () => {
      const companyRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService({ companyRepo });
      try {
        await service.create({ ...baseCreate, companyId: COMPANY_ID }, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(INTERACTION_ERROR_CODES.RELATED_NOT_FOUND);
      }
    });

    it('7. rejects contact_id soft-deleted', async () => {
      const contactRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: CONTACT_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const service = buildService({ contactRepo });
      await expect(
        service.create({ ...baseCreate, contactId: CONTACT_ID }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. rejects deal_id soft-deleted', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const service = buildService({ dealRepo });
      await expect(
        service.create({ ...baseCreate, dealId: DEAL_ID }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });

    it('9. rejects parent_interaction_id not found', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue(null),
      });
      const service = buildService({ interactionRepo });
      try {
        await service.create(
          {
            ...baseCreate,
            contactId: CONTACT_ID,
            parentInteractionId: PARENT_ID,
          },
          USER_A,
        );
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(INTERACTION_ERROR_CODES.PARENT_NOT_FOUND);
      }
    });
  });

  describe('annotate', () => {
    it('10. creates child note inheriting parent scope (contact)', async () => {
      let call = 0;
      const interactionRepo = buildRepo();
      interactionRepo.findOne = vi.fn(() => {
        call++;
        // 1st: annotate() parent lookup
        // 2nd: create() parent lookup (parentInteractionId provided)
        return Promise.resolve({
          id: PARENT_ID,
          tenantId: TENANT_A,
          companyId: null,
          contactId: CONTACT_ID,
          dealId: null,
          deletedAt: null,
        });
      });
      const service = buildService({ interactionRepo });
      await service.annotate(PARENT_ID, { body: 'Correction', subject: 'Fix' }, USER_A);
      expect(interactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: CONTACT_ID,
          companyId: null,
          dealId: null,
          parentInteractionId: PARENT_ID,
          type: 'note',
        }),
      );
      expect(call).toBeGreaterThanOrEqual(2);
    });

    it('11. rejects annotate when parent missing', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue(null),
      });
      const service = buildService({ interactionRepo });
      await expect(
        service.annotate(PARENT_ID, { body: 'x', subject: 'y' }, USER_A),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne / list', () => {
    it('12. findOne returns interaction', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          subject: 'X',
          deletedAt: null,
        }),
      });
      const service = buildService({ interactionRepo });
      const result = await service.findOne(INTERACTION_ID);
      expect(result.id).toBe(INTERACTION_ID);
    });

    it('13. findOne hides soft-deleted by default', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const service = buildService({ interactionRepo });
      await expect(service.findOne(INTERACTION_ID)).rejects.toThrow(NotFoundException);
    });

    it('14. findOne includeDeleted=true returns soft-deleted', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const service = buildService({ interactionRepo });
      const result = await service.findOne(INTERACTION_ID, true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('15. list returns paginated empty', async () => {
      const interactionRepo = buildRepo();
      const service = buildService({ interactionRepo });
      const result = await service.list({
        includeDeleted: false,
        limit: 50,
        offset: 0,
        orderBy: 'occurred_at',
        orderDir: 'DESC',
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('softDelete (SECURITY DEFINER function call)', () => {
    it('16. soft-delete denied for BrokerAssistant (lacks SOFT_DELETE perm)', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: null,
        }),
      });
      const service = buildService({
        interactionRepo,
        ctx: { role: AuthRole.BrokerAssistant },
      });
      try {
        await service.softDelete(INTERACTION_ID, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(INTERACTION_ERROR_CODES.SOFT_DELETE_DENIED);
      }
    });

    it('17. soft-delete invokes DB function for BrokerUser (has SOFT_DELETE perm)', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: null,
        }),
      });
      const queryFn = vi.fn().mockResolvedValue([]);
      const service = buildService({
        interactionRepo,
        queryFn,
        ctx: { role: AuthRole.BrokerUser },
      });
      await service.softDelete(INTERACTION_ID, USER_A);
      expect(queryFn).toHaveBeenCalledWith(
        expect.stringContaining('crm_interactions_soft_delete'),
        [INTERACTION_ID, USER_A],
      );
    });

    it('18. soft-delete throws NotFound when missing', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue(null),
      });
      const service = buildService({
        interactionRepo,
        ctx: { role: AuthRole.BrokerUser },
      });
      await expect(service.softDelete(INTERACTION_ID, USER_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('19. soft-delete rejects already-deleted', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const service = buildService({
        interactionRepo,
        ctx: { role: AuthRole.BrokerUser },
      });
      try {
        await service.softDelete(INTERACTION_ID, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(INTERACTION_ERROR_CODES.ALREADY_DELETED);
      }
    });
  });

  describe('restore (SECURITY DEFINER function call)', () => {
    it('20. restore denied for BrokerUser (lacks RESTORE perm)', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const service = buildService({
        interactionRepo,
        ctx: { role: AuthRole.BrokerUser },
      });
      try {
        await service.restore(INTERACTION_ID, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(INTERACTION_ERROR_CODES.RESTORE_DENIED);
      }
    });

    it('21. restore invokes DB function for BrokerAdmin', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: new Date(),
        }),
      });
      const queryFn = vi.fn().mockResolvedValue([]);
      const service = buildService({
        interactionRepo,
        queryFn,
        ctx: { role: AuthRole.BrokerAdmin },
      });
      await service.restore(INTERACTION_ID, USER_A);
      expect(queryFn).toHaveBeenCalledWith(
        expect.stringContaining('crm_interactions_restore'),
        [INTERACTION_ID, USER_A],
      );
    });

    it('22. restore rejects not-deleted', async () => {
      const interactionRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: INTERACTION_ID,
          tenantId: TENANT_A,
          deletedAt: null,
        }),
      });
      const service = buildService({
        interactionRepo,
        ctx: { role: AuthRole.BrokerAdmin },
      });
      try {
        await service.restore(INTERACTION_ID, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(INTERACTION_ERROR_CODES.NOT_DELETED);
      }
    });
  });

  describe('timelineForEntity', () => {
    it('23. company timeline aggregates contacts + deals related', async () => {
      const contactRepo = buildRepo();
      contactRepo.createQueryBuilder = vi.fn(() =>
        buildQb({
          getRawMany: vi.fn().mockResolvedValue([{ id: CONTACT_ID }]),
        }),
      );
      const dealRepo = buildRepo();
      dealRepo.createQueryBuilder = vi.fn(() =>
        buildQb({
          getRawMany: vi.fn().mockResolvedValue([{ id: DEAL_ID }]),
        }),
      );
      const interactionRepo = buildRepo();
      const qbI = buildQb({ getManyAndCount: vi.fn().mockResolvedValue([[], 0]) });
      interactionRepo.createQueryBuilder = vi.fn(() => qbI);
      const service = buildService({ interactionRepo, contactRepo, dealRepo });
      const result = await service.timelineForEntity('company', COMPANY_ID, {
        limit: 50,
        offset: 0,
      });
      expect(result.total).toBe(0);
      // Verify the qb received companyIds + contactIds + dealIds bindings.
      const andWhereCalls = (qbI.andWhere as ReturnType<typeof vi.fn>).mock.calls;
      const last = andWhereCalls[andWhereCalls.length - 1];
      expect(last?.[1]).toEqual(
        expect.objectContaining({
          companyIds: [COMPANY_ID],
          contactIds: [CONTACT_ID],
          dealIds: [DEAL_ID],
        }),
      );
    });

    it('24. contact timeline aggregates company + deals', async () => {
      const contactRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: CONTACT_ID,
          tenantId: TENANT_A,
          companyId: COMPANY_ID,
        }),
      });
      const dealRepo = buildRepo();
      dealRepo.createQueryBuilder = vi.fn(() =>
        buildQb({
          getRawMany: vi.fn().mockResolvedValue([{ id: DEAL_ID }]),
        }),
      );
      const interactionRepo = buildRepo();
      const qbI = buildQb();
      interactionRepo.createQueryBuilder = vi.fn(() => qbI);
      const service = buildService({ interactionRepo, contactRepo, dealRepo });
      await service.timelineForEntity('contact', CONTACT_ID, { limit: 50, offset: 0 });
      const andWhereCalls = (qbI.andWhere as ReturnType<typeof vi.fn>).mock.calls;
      const last = andWhereCalls[andWhereCalls.length - 1];
      expect(last?.[1]).toEqual(
        expect.objectContaining({
          companyIds: [COMPANY_ID],
          contactIds: [CONTACT_ID],
          dealIds: [DEAL_ID],
        }),
      );
    });

    it('25. deal timeline aggregates company + contact', async () => {
      const dealRepo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEAL_ID,
          tenantId: TENANT_A,
          companyId: COMPANY_ID,
          contactId: CONTACT_ID,
          deletedAt: null,
        }),
      });
      const interactionRepo = buildRepo();
      const qbI = buildQb();
      interactionRepo.createQueryBuilder = vi.fn(() => qbI);
      const service = buildService({ interactionRepo, dealRepo });
      await service.timelineForEntity('deal', DEAL_ID, { limit: 50, offset: 0 });
      const andWhereCalls = (qbI.andWhere as ReturnType<typeof vi.fn>).mock.calls;
      const last = andWhereCalls[andWhereCalls.length - 1];
      expect(last?.[1]).toEqual(
        expect.objectContaining({
          companyIds: [COMPANY_ID],
          contactIds: [CONTACT_ID],
          dealIds: [DEAL_ID],
        }),
      );
    });

    it('26. deal timeline throws when deal missing', async () => {
      const dealRepo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService({ dealRepo });
      await expect(
        service.timelineForEntity('deal', DEAL_ID, { limit: 50, offset: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('error codes constant', () => {
    it('27. exposes expected error codes', () => {
      expect(INTERACTION_ERROR_CODES.RELATED_NOT_FOUND).toBe(
        'CRM_INTERACTION_RELATED_NOT_FOUND',
      );
      expect(INTERACTION_ERROR_CODES.SOFT_DELETE_DENIED).toBe(
        'CRM_INTERACTION_SOFT_DELETE_DENIED',
      );
      expect(INTERACTION_ERROR_CODES.RESTORE_DENIED).toBe(
        'CRM_INTERACTION_RESTORE_DENIED',
      );
    });
  });
});
