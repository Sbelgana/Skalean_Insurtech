/**
 * Tests unitaires TenantValidationService.
 *
 * Reference : Sprint 6 / Tache 2.2.5.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthTenant, AuthTenantUser, DataSource } from '@insurtech/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAccessCacheService } from './tenant-access-cache.service.js';
import { TenantValidationService } from './tenant-validation.service.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const USER_A = '22222222-2222-4222-8222-222222222222';

const settingsStub = {
  locale: 'fr' as const,
  timezone: 'Africa/Casablanca',
  currency: 'MAD' as const,
  branding: { primaryColor: '#E95D2C', logoUrl: null },
  features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
  quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
  tenantType: 'broker' as const,
};

describe('TenantValidationService', () => {
  let service: TenantValidationService;
  let cache: TenantAccessCacheService;
  let dataSource: DataSource;
  let tenantRepoFindOne: ReturnType<typeof vi.fn>;
  let tenantUserRepoFindOne: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cache = {
      getTenantExists: vi.fn().mockResolvedValue(true),
      getTenantSettings: vi.fn().mockResolvedValue(settingsStub),
      getUserAccess: vi.fn().mockResolvedValue({ allowed: true }),
    } as unknown as TenantAccessCacheService;

    tenantRepoFindOne = vi.fn().mockResolvedValue({
      id: TENANT_A,
      name: 'Test Tenant',
      type: 'broker',
      settings: {},
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      deletedAt: null,
    } as Partial<AuthTenant>);

    tenantUserRepoFindOne = vi.fn().mockResolvedValue({
      tenantId: TENANT_A,
      userId: USER_A,
      role: 'tenant_admin',
    } as unknown as Partial<AuthTenantUser>);

    dataSource = {
      getRepository: vi.fn((entity: { name?: string } | unknown) => {
        const name = (entity as { name?: string })?.name;
        if (name === 'AuthTenant') return { findOne: tenantRepoFindOne };
        if (name === 'AuthTenantUser') {
          return {
            findOne: tenantUserRepoFindOne,
            createQueryBuilder: vi.fn(() => ({
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              offset: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              getRawMany: vi
                .fn()
                .mockResolvedValue([
                  { id: TENANT_A, name: 'T1', type: 'broker', role: 'tenant_admin' },
                ]),
              getCount: vi.fn().mockResolvedValue(1),
            })),
          };
        }
        throw new Error(`unexpected entity ${String(name)}`);
      }),
    } as unknown as DataSource;

    service = new TenantValidationService(dataSource, cache);
  });

  // ==========================================================================
  // tenantExists / getTenantById
  // ==========================================================================

  describe('tenantExists', () => {
    it('1. returns true when cache says exists', async () => {
      expect(await service.tenantExists(TENANT_A)).toBe(true);
      expect(cache.getTenantExists).toHaveBeenCalledWith(TENANT_A);
    });

    it('2. returns false when cache says not exists', async () => {
      vi.mocked(cache.getTenantExists).mockResolvedValue(false);
      expect(await service.tenantExists(TENANT_A)).toBe(false);
    });

    it('3. fail-closed (returns false) on cache exception', async () => {
      vi.mocked(cache.getTenantExists).mockRejectedValue(new Error('redis down'));
      expect(await service.tenantExists(TENANT_A)).toBe(false);
    });
  });

  describe('getTenantById', () => {
    it('4. returns TenantDto when tenant + settings present', async () => {
      const result = await service.getTenantById(TENANT_A);
      expect(result?.id).toBe(TENANT_A);
      expect(result?.name).toBe('Test Tenant');
      expect(result?.status).toBe('active');
      expect(result?.settings.locale).toBe('fr');
    });

    it('5. returns null when DB has no tenant', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      expect(await service.getTenantById(TENANT_A)).toBeNull();
    });

    it('6. returns null when settings cache returns null', async () => {
      vi.mocked(cache.getTenantSettings).mockResolvedValue(null);
      expect(await service.getTenantById(TENANT_A)).toBeNull();
    });

    it('7. fail-closed (returns null) on DB exception', async () => {
      tenantRepoFindOne.mockRejectedValue(new Error('db error'));
      expect(await service.getTenantById(TENANT_A)).toBeNull();
    });

    it('8. status derived from deletedAt (Sprint 6, no status col yet)', async () => {
      tenantRepoFindOne.mockResolvedValue({
        id: TENANT_A,
        name: 'T',
        type: 'broker',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date('2026-01-01'),
      } as Partial<AuthTenant>);
      const result = await service.getTenantById(TENANT_A);
      expect(result?.status).toBe('archived');
    });
  });

  describe('requireExistingTenant', () => {
    it('9. returns tenant when exists', async () => {
      const tenant = await service.requireExistingTenant(TENANT_A);
      expect(tenant.id).toBe(TENANT_A);
    });

    it('10. throws NotFoundException with code TENANT_NOT_FOUND when missing', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      try {
        await service.requireExistingTenant(TENANT_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundException);
        const response = (err as NotFoundException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // requireActiveTenant
  // ==========================================================================

  describe('requireActiveTenant', () => {
    it('11. returns active tenant', async () => {
      const tenant = await service.requireActiveTenant(TENANT_A);
      expect(tenant.status).toBe('active');
    });

    it('12. throws NotFound when missing', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(service.requireActiveTenant(TENANT_A)).rejects.toThrow(NotFoundException);
    });

    it('13. throws ForbiddenException TENANT_ARCHIVED when deletedAt set', async () => {
      tenantRepoFindOne.mockResolvedValue({
        id: TENANT_A,
        name: 'T',
        type: 'broker',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      } as Partial<AuthTenant>);
      try {
        await service.requireActiveTenant(TENANT_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_ARCHIVED');
      }
    });
  });

  // ==========================================================================
  // userCanAccessTenant / requireUserAccess
  // ==========================================================================

  describe('userCanAccessTenant', () => {
    it('14. returns allowed=true + role when access granted', async () => {
      const result = await service.userCanAccessTenant(USER_A, TENANT_A);
      expect(result.allowed).toBe(true);
      expect(result.role).toBe('tenant_admin');
    });

    it('15. returns allowed=false TENANT_NOT_FOUND if cache says not exists', async () => {
      vi.mocked(cache.getTenantExists).mockResolvedValue(false);
      const result = await service.userCanAccessTenant(USER_A, TENANT_A);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TENANT_NOT_FOUND');
    });

    it('16. returns allowed=false USER_NOT_LINKED_TO_TENANT when no row', async () => {
      vi.mocked(cache.getUserAccess).mockResolvedValue({
        allowed: false,
        reason: 'USER_NOT_LINKED_TO_TENANT',
      });
      const result = await service.userCanAccessTenant(USER_A, TENANT_A);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('USER_NOT_LINKED_TO_TENANT');
    });

    it('17. fail-closed on cache exception', async () => {
      vi.mocked(cache.getUserAccess).mockRejectedValue(new Error('redis down'));
      const result = await service.userCanAccessTenant(USER_A, TENANT_A);
      expect(result.allowed).toBe(false);
    });

    it('18. graceful when fetchUserRole fails (still allowed=true)', async () => {
      tenantUserRepoFindOne.mockRejectedValue(new Error('db hiccup'));
      const result = await service.userCanAccessTenant(USER_A, TENANT_A);
      expect(result.allowed).toBe(true);
      expect(result.role).toBeUndefined();
    });
  });

  describe('requireUserAccess', () => {
    it('19. returns result when allowed', async () => {
      const result = await service.requireUserAccess(USER_A, TENANT_A);
      expect(result.allowed).toBe(true);
    });

    it('20. throws NotFoundException when tenant missing', async () => {
      vi.mocked(cache.getTenantExists).mockResolvedValue(false);
      await expect(service.requireUserAccess(USER_A, TENANT_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('21. throws ForbiddenException USER_NOT_LINKED_TO_TENANT when denied', async () => {
      vi.mocked(cache.getUserAccess).mockResolvedValue({
        allowed: false,
        reason: 'USER_NOT_LINKED_TO_TENANT',
      });
      try {
        await service.requireUserAccess(USER_A, TENANT_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('USER_NOT_LINKED_TO_TENANT');
      }
    });
  });

  // ==========================================================================
  // getTenantSettings
  // ==========================================================================

  describe('getTenantSettings', () => {
    it('22. returns settings from cache', async () => {
      const result = await service.getTenantSettings(TENANT_A);
      expect(result?.locale).toBe('fr');
    });

    it('23. fail-closed (returns null) on cache exception', async () => {
      vi.mocked(cache.getTenantSettings).mockRejectedValue(new Error('redis'));
      expect(await service.getTenantSettings(TENANT_A)).toBeNull();
    });
  });

  // ==========================================================================
  // getMultiTenantsForUser
  // ==========================================================================

  describe('getMultiTenantsForUser', () => {
    it('24. returns paginated tenants for user', async () => {
      const result = await service.getMultiTenantsForUser(USER_A);
      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0]?.id).toBe(TENANT_A);
      expect(result.tenants[0]?.role).toBe('tenant_admin');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('25. respects custom pageSize', async () => {
      const result = await service.getMultiTenantsForUser(USER_A, 1, 10);
      expect(result.pageSize).toBe(10);
    });
  });
});
