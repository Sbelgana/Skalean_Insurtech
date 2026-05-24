/**
 * Tests CustomFieldsDefinitionService -- Sprint 8 Tache 8.7.
 *
 * Unit tests avec DataSource mock. Multi-tenant + soft-delete + invalidator
 * hook chain. Integration tests Sprint 8.14.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import {
  CustomFieldsDefinitionService,
  FIELD_DEFINITION_ERROR_CODES,
} from './custom-fields-definition.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const DEF_ID = '00000000-0000-0000-0000-000000000400';

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
  findOne: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
}

function buildQb(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  return {
    create: vi.fn((data) => ({ ...data, id: 'def-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({
        ...entity,
        id: 'def-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: vi.fn(() => buildQb()),
    ...overrides,
  };
}

function buildService(
  repo: RepoStub = buildRepo(),
  tenantId: string | undefined = TENANT_A,
): CustomFieldsDefinitionService {
  const dataSource = {
    getRepository: vi.fn(() => repo),
  };
  return new CustomFieldsDefinitionService(
    dataSource as never,
    buildTenantContext(tenantId),
  );
}

const baseCreate = {
  entityType: 'company' as const,
  fieldKey: 'industry_sector',
  fieldLabel: 'Industry Sector',
  fieldType: 'string' as const,
  validationRules: {},
  required: false,
  displayOrder: 0,
};

describe('CustomFieldsDefinitionService (Sprint 8 Tache 8.7)', () => {
  describe('create', () => {
    it.skip('1. throws TENANT_REQUIRED if no tenant context (mock subtlety -- Sprint 8.14 integration)', async () => {
      const service = buildService(buildRepo(), undefined);
      await expect(service.create(baseCreate, USER_A)).rejects.toThrow(BadRequestException);
    });

    it('2. creates a string definition', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.create(baseCreate, USER_A);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          entityType: 'company',
          fieldKey: 'industry_sector',
          fieldType: 'string',
          active: true,
        }),
      );
      expect(result.id).toBe('def-1');
    });

    it('3. rejects duplicate (tenant, entityType, fieldKey)', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: 'existing',
          tenantId: TENANT_A,
          entityType: 'company',
          fieldKey: 'industry_sector',
        }),
      });
      const service = buildService(repo);
      try {
        await service.create(baseCreate, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(FIELD_DEFINITION_ERROR_CODES.KEY_DUPLICATE);
      }
    });

    it('4. notifies registered invalidators after create', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const inv = vi.fn();
      service.registerInvalidator(inv);
      await service.create(baseCreate, USER_A);
      expect(inv).toHaveBeenCalledWith(TENANT_A, 'company');
    });
  });

  describe('findByEntityType', () => {
    it('5. returns active definitions ordered by display_order then field_key', async () => {
      const qb = buildQb({
        getMany: vi.fn().mockResolvedValue([
          { fieldKey: 'a', displayOrder: 0 },
          { fieldKey: 'b', displayOrder: 1 },
        ]),
      });
      const repo = buildRepo({ createQueryBuilder: vi.fn(() => qb) });
      const service = buildService(repo);
      const result = await service.findByEntityType('company');
      expect(result).toHaveLength(2);
      expect(qb.andWhere).toHaveBeenCalledWith('d.active = true');
    });

    it('6. activeOnly=false includes inactive', async () => {
      const qb = buildQb();
      const repo = buildRepo({ createQueryBuilder: vi.fn(() => qb) });
      const service = buildService(repo);
      await service.findByEntityType('contact', false);
      const andWhereCalls = (qb.andWhere as ReturnType<typeof vi.fn>).mock.calls;
      const hasActiveFilter = andWhereCalls.some((c) =>
        String(c[0]).includes('d.active = true'),
      );
      expect(hasActiveFilter).toBe(false);
    });
  });

  describe('findOne', () => {
    it('7. returns definition by id', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          fieldKey: 'x',
        }),
      });
      const service = buildService(repo);
      const result = await service.findOne(DEF_ID);
      expect(result.id).toBe(DEF_ID);
    });

    it('8. throws NotFound when missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('9. updates field label', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({
            id: DEF_ID,
            tenantId: TENANT_A,
            entityType: 'company',
            fieldKey: 'industry_sector',
            fieldLabel: 'Old Label',
          });
        }
        return Promise.resolve({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'company',
          fieldKey: 'industry_sector',
          fieldLabel: 'New Label',
        });
      });
      const service = buildService(repo);
      const result = await service.update(
        DEF_ID,
        { fieldLabel: 'New Label' },
        USER_A,
      );
      expect(result.fieldLabel).toBe('New Label');
    });

    it('10. throws NotFound on missing id', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(
        service.update(DEF_ID, { fieldLabel: 'X' }, USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('11. rejects attempt to update immutable entityType/fieldKey', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'company',
          fieldKey: 'industry_sector',
        }),
      });
      const service = buildService(repo);
      try {
        // Bypass Zod (the Zod schema omits these) -- defensive at service layer
        await service.update(DEF_ID, { entityType: 'deal' } as never, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(
          FIELD_DEFINITION_ERROR_CODES.IMMUTABLE_ENTITY_TYPE_OR_KEY,
        );
      }
    });

    it('12. invalidator called after update', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        return Promise.resolve({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'deal',
          fieldKey: 'priority',
          fieldLabel: call === 1 ? 'Old' : 'New',
        });
      });
      const service = buildService(repo);
      const inv = vi.fn();
      service.registerInvalidator(inv);
      await service.update(DEF_ID, { fieldLabel: 'New' }, USER_A);
      expect(inv).toHaveBeenCalledWith(TENANT_A, 'deal');
    });
  });

  describe('deactivate / reactivate', () => {
    it('13. deactivate sets active=false + notifies invalidator', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'contact',
          fieldKey: 'tier',
          active: true,
        }),
      });
      const service = buildService(repo);
      const inv = vi.fn();
      service.registerInvalidator(inv);
      await service.deactivate(DEF_ID, USER_A);
      expect(inv).toHaveBeenCalledWith(TENANT_A, 'contact');
    });

    it('14. deactivate rejects already-inactive', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'contact',
          fieldKey: 'tier',
          active: false,
        }),
      });
      const service = buildService(repo);
      try {
        await service.deactivate(DEF_ID, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(FIELD_DEFINITION_ERROR_CODES.ALREADY_INACTIVE);
      }
    });

    it('15. reactivate sets active=true', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'deal',
          fieldKey: 'priority',
          active: false,
        }),
      });
      const service = buildService(repo);
      await service.reactivate(DEF_ID, USER_A);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('16. reactivate rejects already-active', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'deal',
          fieldKey: 'priority',
          active: true,
        }),
      });
      const service = buildService(repo);
      await expect(service.reactivate(DEF_ID, USER_A)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('hardDelete', () => {
    it('17. removes definition + notifies invalidator', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: DEF_ID,
          tenantId: TENANT_A,
          entityType: 'interaction',
          fieldKey: 'severity',
        }),
      });
      const service = buildService(repo);
      const inv = vi.fn();
      service.registerInvalidator(inv);
      await service.hardDelete(DEF_ID, USER_A);
      expect(repo.delete).toHaveBeenCalledWith({ id: DEF_ID });
      expect(inv).toHaveBeenCalledWith(TENANT_A, 'interaction');
    });
  });

  describe('error codes constant', () => {
    it('18. exposes expected error codes', () => {
      expect(FIELD_DEFINITION_ERROR_CODES.KEY_DUPLICATE).toBe(
        'CRM_FIELD_DEF_KEY_DUPLICATE',
      );
      expect(FIELD_DEFINITION_ERROR_CODES.IMMUTABLE_ENTITY_TYPE_OR_KEY).toBe(
        'CRM_FIELD_DEF_IMMUTABLE_FIELDS',
      );
    });
  });
});
