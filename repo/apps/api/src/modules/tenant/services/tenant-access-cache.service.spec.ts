/**
 * Tests unitaires TenantAccessCacheService -- pattern cache-aside.
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

import type { AuthTenant, AuthTenantUser, DataSource } from '@insurtech/database';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FindOne<T> = (opts: unknown) => Promise<T | null>;
import { TenantAccessCacheService } from './tenant-access-cache.service.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const USER_A = '22222222-2222-4222-8222-222222222222';

interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  scanStream: ReturnType<typeof vi.fn>;
}

describe('TenantAccessCacheService', () => {
  let service: TenantAccessCacheService;
  let redis: MockRedis;
  let dataSource: DataSource;
  let tenantUserRepo: { findOne: ReturnType<typeof vi.fn> & FindOne<AuthTenantUser> };
  let tenantRepo: { findOne: ReturnType<typeof vi.fn> & FindOne<AuthTenant> };

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      scanStream: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* (): AsyncGenerator<string[]> {
          yield [];
        },
      }),
    };

    tenantUserRepo = { findOne: vi.fn() } as unknown as typeof tenantUserRepo;
    tenantRepo = { findOne: vi.fn() } as unknown as typeof tenantRepo;

    dataSource = {
      getRepository: vi.fn((entity: unknown) => {
        const name = (entity as { name?: string })?.name;
        if (name === 'AuthTenantUser') return tenantUserRepo;
        if (name === 'AuthTenant') return tenantRepo;
        throw new Error(`unexpected entity ${String(name)}`);
      }),
    } as unknown as DataSource;

    service = new TenantAccessCacheService(dataSource, redis as unknown as Redis);
  });

  describe('getUserAccess', () => {
    it('returns from cache when hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ allowed: true }));
      const result = await service.getUserAccess(USER_A, TENANT_A);
      expect(result.allowed).toBe(true);
      expect(tenantUserRepo.findOne).not.toHaveBeenCalled();
    });

    it('fetches from DB on cache miss and writes cache', async () => {
      redis.get.mockResolvedValue(null);
      vi.mocked(tenantUserRepo.findOne).mockResolvedValue({
        tenantId: TENANT_A,
        userId: USER_A,
      } as AuthTenantUser);

      const result = await service.getUserAccess(USER_A, TENANT_A);
      expect(result.allowed).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        `tenant:user-access:${USER_A}:${TENANT_A}`,
        JSON.stringify({ allowed: true }),
        'EX',
        300,
      );
    });

    it('returns allowed=false when tenant user row not found', async () => {
      redis.get.mockResolvedValue(null);
      vi.mocked(tenantUserRepo.findOne).mockResolvedValue(null);

      const result = await service.getUserAccess(USER_A, TENANT_A);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('USER_NOT_LINKED_TO_TENANT');
    });

    it('refetches from DB when cache value is corrupted', async () => {
      redis.get.mockResolvedValue('not-json');
      vi.mocked(tenantUserRepo.findOne).mockResolvedValue({
        tenantId: TENANT_A,
        userId: USER_A,
      } as AuthTenantUser);

      const result = await service.getUserAccess(USER_A, TENANT_A);
      expect(result.allowed).toBe(true);
      expect(tenantUserRepo.findOne).toHaveBeenCalled();
    });
  });

  describe('getTenantSettings', () => {
    it('returns from cache when hit', async () => {
      const cached = {
        locale: 'ar-MA',
        timezone: 'Africa/Casablanca',
        currency: 'MAD',
        branding: { primaryColor: '#FFF', logoUrl: null },
        features: { mfaRequiredForAdmin: false, sinistreAutoAssign: false },
        quotas: { maxUsers: 5, maxPolices: 100, maxStorageGb: 5 },
        tenantType: 'garage',
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));
      const result = await service.getTenantSettings(TENANT_A);
      expect(result?.locale).toBe('ar-MA');
    });

    it('fetches from DB on cache miss and applies defaults via Zod', async () => {
      redis.get.mockResolvedValue(null);
      vi.mocked(tenantRepo.findOne).mockResolvedValue({
        id: TENANT_A,
        settings: {},
      } as AuthTenant);

      const result = await service.getTenantSettings(TENANT_A);
      expect(result?.locale).toBe('fr');
      expect(result?.currency).toBe('MAD');
      expect(result?.quotas.maxUsers).toBe(10);
    });

    it('returns null when tenant not found', async () => {
      redis.get.mockResolvedValue(null);
      vi.mocked(tenantRepo.findOne).mockResolvedValue(null);

      const result = await service.getTenantSettings(TENANT_A);
      expect(result).toBeNull();
    });
  });

  describe('getTenantExists', () => {
    it('returns true from cache when value=1', async () => {
      redis.get.mockResolvedValue('1');
      const result = await service.getTenantExists(TENANT_A);
      expect(result).toBe(true);
      expect(tenantRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns false from cache when value=0', async () => {
      redis.get.mockResolvedValue('0');
      const result = await service.getTenantExists(TENANT_A);
      expect(result).toBe(false);
      expect(tenantRepo.findOne).not.toHaveBeenCalled();
    });

    it('fetches and caches existence on miss', async () => {
      redis.get.mockResolvedValue(null);
      vi.mocked(tenantRepo.findOne).mockResolvedValue({ id: TENANT_A } as AuthTenant);

      const result = await service.getTenantExists(TENANT_A);
      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        `tenant:exists:${TENANT_A}`,
        '1',
        'EX',
        300,
      );
    });

    it('returns false when tenant not found', async () => {
      redis.get.mockResolvedValue(null);
      vi.mocked(tenantRepo.findOne).mockResolvedValue(null);

      const result = await service.getTenantExists(TENANT_A);
      expect(result).toBe(false);
    });
  });

  describe('invalidation', () => {
    it('invalidateUserAccess deletes Redis key', async () => {
      await service.invalidateUserAccess(USER_A, TENANT_A);
      expect(redis.del).toHaveBeenCalledWith(`tenant:user-access:${USER_A}:${TENANT_A}`);
    });

    it('invalidateTenantSettings deletes Redis key', async () => {
      await service.invalidateTenantSettings(TENANT_A);
      expect(redis.del).toHaveBeenCalledWith(`tenant:settings:${TENANT_A}`);
    });

    it('invalidateTenantExists deletes Redis key', async () => {
      await service.invalidateTenantExists(TENANT_A);
      expect(redis.del).toHaveBeenCalledWith(`tenant:exists:${TENANT_A}`);
    });

    it('invalidateAllForTenant scans and deletes matching keys', async () => {
      const stream = {
        [Symbol.asyncIterator]: async function* (): AsyncGenerator<string[]> {
          yield [`tenant:settings:${TENANT_A}`, `tenant:exists:${TENANT_A}`];
        },
      };
      redis.scanStream.mockReturnValue(stream);

      await service.invalidateAllForTenant(TENANT_A);
      expect(redis.del).toHaveBeenCalledWith(
        `tenant:settings:${TENANT_A}`,
        `tenant:exists:${TENANT_A}`,
      );
    });

    it('invalidateAllForTenant is no-op when no matching keys', async () => {
      await service.invalidateAllForTenant(TENANT_A);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
