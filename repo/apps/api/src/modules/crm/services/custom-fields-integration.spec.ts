/**
 * Integration tests for CustomFieldsValidator hooks -- Sprint 8 Task 8.14 (D3).
 *
 * Exercises the validator wiring across the four CRM services :
 * Companies / Contacts / Deals / Interactions. Each service injects
 * CustomFieldsValidatorService as @Optional() ; when supplied, every
 * create/update with `customFields` runs through validate() before the
 * repository save.
 *
 * Coverage strategy : for each service we test
 *   - validator is CALLED with the right entity type when customFields present
 *   - validator throw propagates (BadRequestException with INVALID_CUSTOM_FIELDS)
 *
 * We don't re-test the validator's internals -- those live in
 * custom-fields-validator.service.spec.ts. Here we test the integration glue.
 */

import { BadRequestException } from '@nestjs/common';
import type { TenantContextService } from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import { CompaniesService } from './companies.service.js';
import { ContactsService } from './contacts.service.js';
import { DealsService } from './deals.service.js';
import { InteractionsService } from './interactions.service.js';
import type { CustomFieldsValidatorService } from './custom-fields-validator.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';

function ctx(): TenantContextService {
  return {
    getCurrentContext: () => ({
      tenantId: TENANT_A,
      userId: USER_A,
      userRole: undefined,
      isSuperAdmin: false,
      traceId: 'trc',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    }),
  } as unknown as TenantContextService;
}

function buildQb() {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({}),
    getMany: vi.fn().mockResolvedValue([]),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    getCount: vi.fn().mockResolvedValue(0),
  };
}

function buildRepo() {
  return {
    create: vi.fn((data) => ({ ...data, id: 'row-1' })),
    save: vi.fn(async (data) => ({
      ...data,
      id: 'row-1',
      createdAt: new Date('2026-05-25T10:00:00Z'),
      updatedAt: new Date('2026-05-25T10:00:00Z'),
    })),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    createQueryBuilder: vi.fn(() => buildQb()),
  };
}

function passthroughValidator(): CustomFieldsValidatorService {
  return {
    validate: vi.fn(async (_t, v) => v as Record<string, unknown>),
  } as unknown as CustomFieldsValidatorService;
}

function throwingValidator(): CustomFieldsValidatorService {
  return {
    validate: vi.fn().mockRejectedValue(
      new BadRequestException({
        code: 'CRM_VALIDATOR_INVALID_CUSTOM_FIELDS',
        message: 'fail',
      }),
    ),
  } as unknown as CustomFieldsValidatorService;
}

describe('CustomFieldsValidator hooks integration (Sprint 8 Task 8.14 D3)', () => {
  // ==========================================================================
  // CompaniesService
  // ==========================================================================

  describe('CompaniesService', () => {
    function build(validator?: CustomFieldsValidatorService) {
      const repo = buildRepo();
      const ds = { getRepository: vi.fn(() => repo) } as never;
      return {
        repo,
        service: new CompaniesService(ds, ctx(), validator),
      };
    }

    it('1. valid customFields : validator called with entityType="company", passthrough', async () => {
      const validator = passthroughValidator();
      const { service, repo } = build(validator);
      await service.create(
        {
          name: 'Atlas Maroc',
          tags: [],
          country: 'MA',
          customFields: { vat_number: 'MA-001' },
        } as never,
        USER_A,
      );
      expect(validator.validate).toHaveBeenCalledWith('company', {
        vat_number: 'MA-001',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ customFields: { vat_number: 'MA-001' } }),
      );
    });

    it('2. invalid customFields : BadRequestException propagated; repo.save NOT called', async () => {
      const validator = throwingValidator();
      const { service, repo } = build(validator);
      await expect(
        service.create(
          {
            name: 'Atlas Maroc',
            tags: [],
            country: 'MA',
            customFields: { vat_number: 123 } as never,
          } as never,
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // ContactsService
  // ==========================================================================

  describe('ContactsService', () => {
    function build(validator?: CustomFieldsValidatorService) {
      const contactRepo = buildRepo();
      const companyRepo = buildRepo();
      const ds = {
        getRepository: vi.fn((entity: unknown) => {
          const name = (entity as { name?: string })?.name ?? '';
          if (name === 'CrmCompanyEntity') return companyRepo;
          return contactRepo;
        }),
      } as never;
      return {
        contactRepo,
        service: new ContactsService(ds, ctx(), validator),
      };
    }

    it('3. valid customFields : validator called with entityType="contact"', async () => {
      const validator = passthroughValidator();
      const { service, contactRepo } = build(validator);
      await service.create(
        {
          firstName: 'Karim',
          lastName: 'Bennani',
          preferredLanguage: 'fr',
          preferredChannel: 'email',
          tags: [],
          customFields: { driver_license: 'BX1234' },
        } as never,
        USER_A,
      );
      expect(validator.validate).toHaveBeenCalledWith('contact', {
        driver_license: 'BX1234',
      });
      expect(contactRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customFields: { driver_license: 'BX1234' },
        }),
      );
    });

    it('4. invalid customFields : BadRequestException propagated', async () => {
      const validator = throwingValidator();
      const { service, contactRepo } = build(validator);
      await expect(
        service.create(
          {
            firstName: 'X',
            lastName: 'Y',
            preferredLanguage: 'fr',
            preferredChannel: 'email',
            tags: [],
            customFields: { broken: true },
          } as never,
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(contactRepo.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // DealsService -- uses transaction(em => ...) wrapper, so we mock differently
  // ==========================================================================

  describe('DealsService', () => {
    function build(validator?: CustomFieldsValidatorService) {
      const dealSave = vi.fn(async (data) => ({
        ...data,
        id: 'deal-1',
        createdAt: new Date('2026-05-25T10:00:00Z'),
        updatedAt: new Date('2026-05-25T10:00:00Z'),
      }));
      const dealCreate = vi.fn((data) => ({ ...data, id: 'deal-1' }));
      const stageRow = {
        id: 'stage-1',
        tenantId: TENANT_A,
        pipelineId: 'pipe-1',
        position: 0,
      };
      const pipelineRow = { id: 'pipe-1', tenantId: TENANT_A };
      const companyRow = { id: 'co-1', tenantId: TENANT_A, deletedAt: null };
      const txDispatcher = vi.fn((entity: unknown) => {
        const name = (entity as { name?: string })?.name ?? '';
        if (name === 'CrmCompanyEntity') {
          return {
            findOne: vi.fn().mockResolvedValue(companyRow),
          };
        }
        if (name === 'CrmPipelineEntity') {
          return {
            findOne: vi.fn().mockResolvedValue(pipelineRow),
          };
        }
        if (name === 'CrmStageEntity') {
          return {
            findOne: vi.fn().mockResolvedValue(stageRow),
            createQueryBuilder: vi.fn(() => ({
              ...buildQb(),
              getOne: vi.fn().mockResolvedValue(stageRow),
            })),
          };
        }
        // CrmDealEntity
        return {
          create: dealCreate,
          save: dealSave,
          findOne: vi.fn().mockResolvedValue(null),
        };
      });
      const txEm = {
        getRepository: txDispatcher,
        createQueryBuilder: vi.fn(() => buildQb()),
      };
      const ds = {
        getRepository: txDispatcher,
        transaction: vi.fn(
          async (fn: (em: unknown) => Promise<unknown>) => fn(txEm),
        ),
      } as never;
      return {
        dealCreate,
        dealSave,
        service: new DealsService(ds, ctx(), validator),
      };
    }

    it('5. valid customFields : validator called with entityType="deal"', async () => {
      const validator = passthroughValidator();
      const { service, dealCreate } = build(validator);
      await service.create(
        {
          companyId: 'co-1',
          pipelineId: 'pipe-1',
          name: 'Big Deal',
          amount: 1000,
          currency: 'MAD',
          ownerUserId: USER_A,
          customFields: { policy_type: 'auto' },
        } as never,
        USER_A,
      );
      expect(validator.validate).toHaveBeenCalledWith('deal', {
        policy_type: 'auto',
      });
      expect(dealCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customFields: { policy_type: 'auto' } }),
      );
    });

    it('6. invalid customFields : BadRequestException propagated', async () => {
      const validator = throwingValidator();
      const { service, dealSave } = build(validator);
      await expect(
        service.create(
          {
            companyId: 'co-1',
            pipelineId: 'pipe-1',
            name: 'X',
            amount: 1,
            currency: 'MAD',
            ownerUserId: USER_A,
            customFields: { broken: true },
          } as never,
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(dealSave).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // InteractionsService -- uses transaction wrapper too
  // ==========================================================================

  describe('InteractionsService', () => {
    function build(validator?: CustomFieldsValidatorService) {
      const interactionCreate = vi.fn((data) => ({ ...data, id: 'int-1' }));
      const interactionSave = vi.fn(async (data) => ({
        ...data,
        id: 'int-1',
        createdAt: new Date('2026-05-25T10:00:00Z'),
        updatedAt: new Date('2026-05-25T10:00:00Z'),
      }));
      const txDispatcher = vi.fn((entity: unknown) => {
        const name = (entity as { name?: string })?.name ?? '';
        if (name === 'CrmCompanyEntity') {
          return {
            findOne: vi
              .fn()
              .mockResolvedValue({ id: 'co-1', tenantId: TENANT_A, deletedAt: null }),
          };
        }
        if (name === 'CrmContactEntity') {
          return {
            findOne: vi.fn().mockResolvedValue(null),
          };
        }
        if (name === 'CrmDealEntity') {
          return {
            findOne: vi.fn().mockResolvedValue(null),
          };
        }
        // CrmInteractionEntity
        return {
          create: interactionCreate,
          save: interactionSave,
          findOne: vi.fn().mockResolvedValue(null),
        };
      });
      const txEm = {
        getRepository: txDispatcher,
        createQueryBuilder: vi.fn(() => buildQb()),
      };
      const ds = {
        getRepository: txDispatcher,
        transaction: vi.fn(
          async (fn: (em: unknown) => Promise<unknown>) => fn(txEm),
        ),
      } as never;
      return {
        interactionCreate,
        interactionSave,
        service: new InteractionsService(ds, ctx(), validator),
      };
    }

    it('7. valid customFields : validator called with entityType="interaction"', async () => {
      const validator = passthroughValidator();
      const { service, interactionCreate } = build(validator);
      await service.create(
        {
          interactionType: 'call',
          subject: 'Follow-up',
          direction: 'outbound',
          companyId: 'co-1',
          customFields: { sentiment: 'positive' },
        } as never,
        USER_A,
      );
      expect(validator.validate).toHaveBeenCalledWith('interaction', {
        sentiment: 'positive',
      });
      expect(interactionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customFields: { sentiment: 'positive' } }),
      );
    });

    it('8. invalid customFields : BadRequestException propagated', async () => {
      const validator = throwingValidator();
      const { service, interactionSave } = build(validator);
      await expect(
        service.create(
          {
            interactionType: 'note',
            subject: 'X',
            companyId: 'co-1',
            customFields: { broken: 'nope' },
          } as never,
          USER_A,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(interactionSave).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Validator absent : services still work (graceful no-op)
  // ==========================================================================

  describe('validator-absent passthrough', () => {
    it('9. CompaniesService without validator : customFields stored as-is', async () => {
      const repo = buildRepo();
      const ds = { getRepository: vi.fn(() => repo) } as never;
      const service = new CompaniesService(ds, ctx());
      await service.create(
        {
          name: 'X',
          tags: [],
          country: 'MA',
          customFields: { anything: 42 },
        } as never,
        USER_A,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ customFields: { anything: 42 } }),
      );
    });
  });
});
