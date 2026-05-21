/**
 * Tests unitaires ResourceQuotaService.
 *
 * Reference : Sprint 6 / Tache 2.2.11.
 */

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type {
  AuthTenant,
  DataSource,
  TenantStatus,
} from '@insurtech/database';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceQuotaService } from './resource-quota.service.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const buildTenant = (overrides: Partial<AuthTenant> = {}): AuthTenant => ({
  id: TENANT_ID,
  name: 'T',
  type: 'broker',
  settings: {},
  status: 'active' as TenantStatus,
  suspendedAt: null,
  suspensionReason: null,
  suspensionType: null,
  reactivatedAt: null,
  reactivationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  tenantUsers: [],
  sessions: [],
  ...overrides,
}) as AuthTenant;

describe('ResourceQuotaService', () => {
  let service: ResourceQuotaService;
  let dataSource: DataSource;
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    mget: ReturnType<typeof vi.fn>;
    incrby: ReturnType<typeof vi.fn>;
    decrby: ReturnType<typeof vi.fn>;
  };
  let tenantRepoFindOne: ReturnType<typeof vi.fn>;
  let tenantRepoFind: ReturnType<typeof vi.fn>;
  let tenantRepoSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenantRepoFindOne = vi.fn();
    tenantRepoFind = vi.fn().mockResolvedValue([]);
    tenantRepoSave = vi.fn(async (t) => t);

    dataSource = {
      getRepository: vi.fn(() => ({
        findOne: tenantRepoFindOne,
        find: tenantRepoFind,
        save: tenantRepoSave,
      })),
    } as unknown as DataSource;

    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      mget: vi.fn().mockResolvedValue([null, null, null, null, null, null]),
      incrby: vi.fn().mockImplementation(async (_key: string, amount: number) => amount),
      decrby: vi.fn().mockImplementation(async (_key: string, _amount: number) => 0),
    };

    service = new ResourceQuotaService(dataSource, redis as unknown as Redis);
  });

  // ==========================================================================
  // GET QUOTA
  // ==========================================================================

  describe('getQuotaForTenant', () => {
    it('1. returns FREE tier defaults for tenant without tier setting', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const result = await service.getQuotaForTenant(TENANT_ID);
      expect(result.tier).toBe('free');
      expect(result.limits.users).toBe(5);
      expect(result.limits.policies).toBe(50);
    });

    it('2. returns PRO tier when settings.tier=pro', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ settings: { tier: 'pro' } }));
      const result = await service.getQuotaForTenant(TENANT_ID);
      expect(result.tier).toBe('pro');
      expect(result.limits.users).toBe(50);
      expect(result.limits.policies).toBe(5_000);
    });

    it('3. returns ENTERPRISE tier with null = unlimited', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ settings: { tier: 'enterprise' } }));
      const result = await service.getQuotaForTenant(TENANT_ID);
      expect(result.tier).toBe('enterprise');
      expect(result.limits.users).toBeNull();
      expect(result.limits.policies).toBeNull();
    });

    it('4. applies overrides over tier defaults', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({
          settings: { tier: 'free', quotaOverrides: { users: 100 } },
        }),
      );
      const result = await service.getQuotaForTenant(TENANT_ID);
      expect(result.limits.users).toBe(100);
      expect(result.limits.policies).toBe(50); // tier default preserved
      expect(result.overrides.users).toBe(100);
    });

    it('5. computes utilizationPct correctly', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ settings: { tier: 'free' } }));
      redis.mget.mockResolvedValue(['3', '40', '0', '0', '0', '0']);
      const result = await service.getQuotaForTenant(TENANT_ID);
      expect(result.utilizationPct.users).toBe(60); // 3/5 = 60
      expect(result.utilizationPct.policies).toBe(80); // 40/50 = 80
    });

    it('6. unlimited resource gets utilizationPct = -1 sentinel', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ settings: { tier: 'enterprise' } }));
      redis.mget.mockResolvedValue(['1000', '5000', '0', '0', '0', '0']);
      const result = await service.getQuotaForTenant(TENANT_ID);
      expect(result.utilizationPct.users).toBe(-1);
      expect(result.utilizationPct.policies).toBe(-1);
    });

    it('7. throws when tenant absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(service.getQuotaForTenant(TENANT_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // CHECK BEFORE ACTION
  // ==========================================================================

  describe('checkQuotaBeforeAction', () => {
    it('8. allows action below limit (FREE tier 5 users, current 2, +1)', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      redis.get.mockResolvedValue('2');
      const result = await service.checkQuotaBeforeAction(TENANT_ID, 'users', 1);
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(2);
      expect(result.newUsage).toBe(3);
      expect(result.limit).toBe(5);
    });

    it('9. emits warningAt80Percent when projected >= 80%', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      redis.get.mockResolvedValue('3'); // 60% before, 80% after +1
      const result = await service.checkQuotaBeforeAction(TENANT_ID, 'users', 1);
      expect(result.allowed).toBe(true);
      expect(result.warningAt80Percent).toBe(true);
    });

    it('10. rejects when projected exceeds limit (QUOTA_EXCEEDED 429)', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      redis.get.mockResolvedValue('5'); // already at 5 max
      try {
        await service.checkQuotaBeforeAction(TENANT_ID, 'users', 1);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const e = err as HttpException;
        expect(e.getStatus()).toBe(429);
        const response = e.getResponse() as { code: string };
        expect(response.code).toBe('QUOTA_EXCEEDED');
      }
    });

    it('11. allows unlimited (enterprise tier) resource without limit', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant({ settings: { tier: 'enterprise' } }));
      redis.get.mockResolvedValue('1000000');
      const result = await service.checkQuotaBeforeAction(TENANT_ID, 'users', 1);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });

    it('12. rejects with TENANT_NOT_FOUND when tenant absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(
        service.checkQuotaBeforeAction(TENANT_ID, 'users', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('13. rejects with TENANT_SUSPENDED when tenant suspended', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ status: 'suspended' as TenantStatus }),
      );
      try {
        await service.checkQuotaBeforeAction(TENANT_ID, 'users', 1);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('TENANT_SUSPENDED');
      }
    });

    it('14. rejects archived tenant', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ status: 'archived' as TenantStatus, deletedAt: new Date() }),
      );
      await expect(
        service.checkQuotaBeforeAction(TENANT_ID, 'users', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('15. bypass for super admin (no tenant check, no limit check)', async () => {
      redis.get.mockResolvedValue('500');
      const result = await service.checkQuotaBeforeAction(TENANT_ID, 'users', 1, {
        bypassForSuperAdmin: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
      expect(tenantRepoFindOne).not.toHaveBeenCalled();
    });

    it('16. applies override to allow above tier default', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({
          settings: { tier: 'free', quotaOverrides: { users: 100 } },
        }),
      );
      redis.get.mockResolvedValue('50');
      const result = await service.checkQuotaBeforeAction(TENANT_ID, 'users', 10);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
    });
  });

  // ==========================================================================
  // INCREMENT / DECREMENT
  // ==========================================================================

  describe('incrementUsage', () => {
    it('17. uses Redis INCRBY atomic', async () => {
      redis.incrby.mockResolvedValue(5);
      const result = await service.incrementUsage(TENANT_ID, 'users', 3);
      expect(result).toBe(5);
      expect(redis.incrby).toHaveBeenCalledWith(`quota:usage:${TENANT_ID}:users`, 3);
    });

    it('18. rejects negative amount', async () => {
      await expect(service.incrementUsage(TENANT_ID, 'users', -1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('decrementUsage', () => {
    it('19. uses Redis DECRBY atomic', async () => {
      redis.decrby.mockResolvedValue(2);
      const result = await service.decrementUsage(TENANT_ID, 'users', 1);
      expect(result).toBe(2);
      expect(redis.decrby).toHaveBeenCalledWith(`quota:usage:${TENANT_ID}:users`, 1);
    });

    it('20. clamps to 0 if decrement makes it negative', async () => {
      redis.decrby.mockResolvedValue(-5);
      const result = await service.decrementUsage(TENANT_ID, 'users', 10);
      expect(result).toBe(0);
      expect(redis.set).toHaveBeenCalledWith(`quota:usage:${TENANT_ID}:users`, '0');
    });
  });

  // ==========================================================================
  // OVERRIDE
  // ==========================================================================

  describe('setQuotaOverride', () => {
    it('21. persists override in tenant.settings.quotaOverrides', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const result = await service.setQuotaOverride(
        TENANT_ID,
        'users',
        25,
        'enterprise pilot',
        ADMIN_ID,
      );
      expect(result.overrides.users).toBe(25);
      const saved = tenantRepoSave.mock.calls[0]![0];
      expect((saved.settings as { quotaOverrides: { users: number } }).quotaOverrides.users).toBe(25);
    });

    it('22. accepts null = unlimited override', async () => {
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const result = await service.setQuotaOverride(
        TENANT_ID,
        'users',
        null,
        'enterprise unlimited',
        ADMIN_ID,
      );
      expect(result.limits.users).toBeNull();
    });

    it('23. throws when tenant absent', async () => {
      tenantRepoFindOne.mockResolvedValue(null);
      await expect(
        service.setQuotaOverride(TENANT_ID, 'users', 25, 'r', ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clearQuotaOverride', () => {
    it('24. removes override, falling back to tier default', async () => {
      tenantRepoFindOne.mockResolvedValue(
        buildTenant({ settings: { tier: 'free', quotaOverrides: { users: 100 } } }),
      );
      const result = await service.clearQuotaOverride(TENANT_ID, 'users', ADMIN_ID);
      expect(result.overrides.users).toBeUndefined();
      expect(result.limits.users).toBe(5);
    });
  });

  // ==========================================================================
  // LIST NEAR LIMIT
  // ==========================================================================

  describe('listQuotasNearLimit', () => {
    it('25. returns tenants with at least one resource >= threshold', async () => {
      tenantRepoFind.mockResolvedValue([buildTenant(), buildTenant({ id: 'tenant-2' })]);
      redis.mget
        .mockResolvedValueOnce(['4', '0', '0', '0', '0', '0']) // 80% users
        .mockResolvedValueOnce(['1', '0', '0', '0', '0', '0']); // 20%
      tenantRepoFindOne
        .mockResolvedValueOnce(buildTenant())
        .mockResolvedValueOnce(buildTenant({ id: 'tenant-2' }));

      const result = await service.listQuotasNearLimit(80);
      expect(result).toHaveLength(1);
      expect(result[0]?.utilizationPct.users).toBeGreaterThanOrEqual(80);
    });

    it('26. empty list when no tenant near limit', async () => {
      tenantRepoFind.mockResolvedValue([buildTenant()]);
      redis.mget.mockResolvedValue(['1', '0', '0', '0', '0', '0']);
      tenantRepoFindOne.mockResolvedValue(buildTenant());
      const result = await service.listQuotasNearLimit(80);
      expect(result).toEqual([]);
    });
  });
});
