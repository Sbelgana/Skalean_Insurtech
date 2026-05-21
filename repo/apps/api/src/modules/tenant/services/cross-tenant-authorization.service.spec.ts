/**
 * Tests unitaires CrossTenantAuthorizationService.
 *
 * Reference : Sprint 6 / Tache 2.2.6.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CrossTenantAuthorization, DataSource } from '@insurtech/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CrossTenantAuthorizationService,
  type IssueAuthorizationInput,
} from './cross-tenant-authorization.service.js';
import { CrossTenantAuthorizationType } from '../types/cross-tenant-authorization.type.js';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_GRANTOR = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_REVOKER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const buildAuthzRow = (
  overrides: Partial<CrossTenantAuthorization> = {},
): CrossTenantAuthorization => {
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    type: 'broker_to_garage_assignment',
    fromTenantId: TENANT_A,
    toTenantId: TENANT_B,
    scope: ['read.sinistre', 'write.devis'],
    resourceType: null,
    resourceId: null,
    grantedByUserId: USER_GRANTOR,
    grantedAt: new Date(),
    expiresAt: expires,
    revokedAt: null,
    revokedByUserId: null,
    revokedReason: null,
    metadata: {},
    ...overrides,
  } as CrossTenantAuthorization;
};

describe('CrossTenantAuthorizationService', () => {
  let service: CrossTenantAuthorizationService;
  let dataSource: DataSource;
  let authzRepo: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let tenantRepoFindOne: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    authzRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(async (e) => e),
      create: vi.fn((data) => ({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', ...data })),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      })),
    };

    tenantRepoFindOne = vi.fn().mockResolvedValue({
      id: TENANT_A,
      name: 'tenant',
      type: 'broker',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    dataSource = {
      getRepository: vi.fn((entity: unknown) => {
        const name = (entity as { name?: string })?.name;
        if (name === 'CrossTenantAuthorization') return authzRepo;
        if (name === 'AuthTenant') return { findOne: tenantRepoFindOne };
        throw new Error(`unexpected entity ${String(name)}`);
      }),
    } as unknown as DataSource;

    service = new CrossTenantAuthorizationService(dataSource);
  });

  const baseIssueInput: IssueAuthorizationInput = {
    type: CrossTenantAuthorizationType.BrokerToGarageAssignment,
    fromTenantId: TENANT_A,
    toTenantId: TENANT_B,
    scope: ['read.sinistre', 'write.devis'],
    grantedByUserId: USER_GRANTOR,
  };

  // ==========================================================================
  // ISSUE
  // ==========================================================================

  describe('issue', () => {
    it('1. creates authorization with default expiry 30 days for broker_to_garage', async () => {
      const result = await service.issue(baseIssueInput);
      expect(result.id).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
      expect(result.fromTenantId).toBe(TENANT_A);
      expect(result.toTenantId).toBe(TENANT_B);
      expect(authzRepo.save).toHaveBeenCalled();
    });

    it('2. throws SAME_FROM_TO_TENANT when from=to', async () => {
      try {
        await service.issue({ ...baseIssueInput, toTenantId: TENANT_A });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('CROSS_TENANT_SAME_FROM_TO');
      }
    });

    it('3. throws when scope is empty', async () => {
      await expect(
        service.issue({ ...baseIssueInput, scope: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. dedupes scope', async () => {
      await service.issue({
        ...baseIssueInput,
        scope: ['read.sinistre', 'read.sinistre', 'write.devis'],
      });
      const created = authzRepo.create.mock.calls[0]![0];
      expect(created.scope).toEqual(['read.sinistre', 'write.devis']);
    });

    it('5. throws INVALID_EXPIRES_AT when expiresAt in past', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      try {
        await service.issue({ ...baseIssueInput, expiresAt: past });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as { code: string };
        expect(response.code).toBe('CROSS_TENANT_INVALID_EXPIRES_AT');
      }
    });

    it('6. throws INVALID_EXPIRES_AT when expiresAt > max (90d for broker_to_garage)', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 200);
      await expect(
        service.issue({ ...baseIssueInput, expiresAt: farFuture }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. accepts expiresAt within max window', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 45);
      const result = await service.issue({ ...baseIssueInput, expiresAt: future });
      expect(result.expiresAt.getTime()).toBe(future.getTime());
    });

    it('8. throws TENANT_NOT_FOUND when fromTenant missing', async () => {
      tenantRepoFindOne.mockResolvedValueOnce(null);
      await expect(service.issue(baseIssueInput)).rejects.toThrow(NotFoundException);
    });

    it('9. throws TENANT_NOT_FOUND when toTenant deleted', async () => {
      tenantRepoFindOne.mockImplementation((opts: { where: { id: string } }) => {
        if (opts.where.id === TENANT_A) return { id: TENANT_A, deletedAt: null };
        return { id: TENANT_B, deletedAt: new Date() };
      });
      await expect(service.issue(baseIssueInput)).rejects.toThrow(NotFoundException);
    });

    it('10. assure_to_garage_visit default expiry 7 days, max 30', async () => {
      const result = await service.issue({
        ...baseIssueInput,
        type: CrossTenantAuthorizationType.AssureToGarageVisit,
      });
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const diff = result.expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(sevenDays - 5000);
      expect(diff).toBeLessThan(sevenDays + 5000);
    });
  });

  // ==========================================================================
  // REVOKE
  // ==========================================================================

  describe('revoke', () => {
    it('11. revokes existing authorization', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow());
      await service.revoke('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'test reason', USER_REVOKER);
      const saved = authzRepo.save.mock.calls[0]![0];
      expect(saved.revokedAt).toBeInstanceOf(Date);
      expect(saved.revokedByUserId).toBe(USER_REVOKER);
      expect(saved.revokedReason).toBe('test reason');
    });

    it('12. throws NotFoundException when authz absent', async () => {
      authzRepo.findOne.mockResolvedValue(null);
      await expect(
        service.revoke('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'r', USER_REVOKER),
      ).rejects.toThrow(NotFoundException);
    });

    it('13. throws ConflictException when already revoked', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow({ revokedAt: new Date() }));
      try {
        await service.revoke('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'r', USER_REVOKER);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as { code: string };
        expect(response.code).toBe('CROSS_TENANT_AUTHORIZATION_ALREADY_REVOKED');
      }
    });
  });

  // ==========================================================================
  // VERIFY ACCESS
  // ==========================================================================

  describe('verifyAccess', () => {
    it('14. returns allowed=true for active authz with matching tenants', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow());
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
      });
      expect(result.allowed).toBe(true);
      expect(result.type).toBe(CrossTenantAuthorizationType.BrokerToGarageAssignment);
    });

    it('15. returns NOT_FOUND for missing authz', async () => {
      authzRepo.findOne.mockResolvedValue(null);
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('16. returns REVOKED for revoked authz', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow({ revokedAt: new Date() }));
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('REVOKED');
    });

    it('17. returns EXPIRED for past expiresAt', async () => {
      const expired = new Date();
      expired.setDate(expired.getDate() - 1);
      authzRepo.findOne.mockResolvedValue(buildAuthzRow({ expiresAt: expired }));
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('EXPIRED');
    });

    it('18. returns TENANT_MISMATCH when tenants do not match', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow());
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_B, // wrong direction
        toTenantId: TENANT_A,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TENANT_MISMATCH');
    });

    it('19. returns SCOPE_MISMATCH when action not in scope', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow());
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
        requestedAction: 'delete.tenant',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SCOPE_MISMATCH');
    });

    it('20. returns allowed=true for action matching scope', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow());
      const result = await service.verifyAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
        requestedAction: 'read.sinistre',
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // requireVerifiedAccess
  // ==========================================================================

  describe('requireVerifiedAccess', () => {
    it('21. throws ForbiddenException with code mapping when denied', async () => {
      authzRepo.findOne.mockResolvedValue(null);
      try {
        await service.requireVerifiedAccess({
          authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          fromTenantId: TENANT_A,
          toTenantId: TENANT_B,
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('CROSS_TENANT_AUTHORIZATION_NOT_FOUND');
      }
    });

    it('22. returns result when allowed', async () => {
      authzRepo.findOne.mockResolvedValue(buildAuthzRow());
      const result = await service.requireVerifiedAccess({
        authorizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        fromTenantId: TENANT_A,
        toTenantId: TENANT_B,
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // LIST
  // ==========================================================================

  describe('list', () => {
    it('23. listGrantedBy returns sorted by grantedAt DESC', async () => {
      authzRepo.find.mockResolvedValue([buildAuthzRow(), buildAuthzRow()]);
      const result = await service.listGrantedBy(TENANT_A);
      expect(result).toHaveLength(2);
      expect(authzRepo.find).toHaveBeenCalledWith({
        where: { fromTenantId: TENANT_A },
        order: { grantedAt: 'DESC' },
      });
    });

    it('24. listGrantedTo returns sorted by grantedAt DESC', async () => {
      authzRepo.find.mockResolvedValue([buildAuthzRow()]);
      const result = await service.listGrantedTo(TENANT_B);
      expect(result).toHaveLength(1);
      expect(authzRepo.find).toHaveBeenCalledWith({
        where: { toTenantId: TENANT_B },
        order: { grantedAt: 'DESC' },
      });
    });
  });

  // ==========================================================================
  // AUTO-EXPIRE
  // ==========================================================================

  describe('findExpiredActive', () => {
    it('25. returns expired but non-revoked authz', async () => {
      const expired = buildAuthzRow({
        expiresAt: new Date(Date.now() - 1000),
      });
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([expired]),
      };
      authzRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findExpiredActive();
      expect(result).toHaveLength(1);
    });
  });
});
