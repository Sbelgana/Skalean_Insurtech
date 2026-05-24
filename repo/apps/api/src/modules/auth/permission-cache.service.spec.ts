/**
 * Tests PermissionCacheService -- Sprint 7 Tache 2.3.10.
 */

import {
  AuthRole,
  HierarchyResolver,
  Permission,
  RBAC_WILDCARD,
  RbacService,
} from '@insurtech/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionCacheService } from './permission-cache.service.js';

class FakeRedis {
  private readonly store = new Map<string, string>();
  readonly opLog: string[] = [];

  async get(key: string): Promise<string | null> {
    this.opLog.push(`get:${key}`);
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _mode: string, _ttl: number): Promise<'OK'> {
    this.opLog.push(`set:${key}`);
    this.store.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    this.opLog.push(`del:${keys.join(',')}`);
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    this.opLog.push(`keys:${pattern}`);
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }
}

function buildService(): {
  service: PermissionCacheService;
  redis: FakeRedis;
  rbac: RbacService;
} {
  const redis = new FakeRedis();
  const rbac = new RbacService(new HierarchyResolver());
  const service = new PermissionCacheService(redis as never, rbac);
  return { service, redis, rbac };
}

describe('PermissionCacheService (Sprint 7 Tache 2.3.10)', () => {
  describe('getEffectivePermissions', () => {
    it('1. cache miss : fetch from RbacService + populate Redis', async () => {
      const { service, redis } = buildService();
      const perms = await service.getEffectivePermissions(AuthRole.BrokerUser);
      expect(perms.has(Permission.CRM_DEALS_CREATE)).toBe(true);
      expect(redis.opLog).toContain('get:rbac:effective:broker_user');
      expect(redis.opLog).toContain('set:rbac:effective:broker_user');
    });

    it('2. cache hit : evite RbacService recompute', async () => {
      const { service, redis, rbac } = buildService();
      // Premier appel : populate
      await service.getEffectivePermissions(AuthRole.BrokerUser);
      // Spy sur RbacService pour confirmer fallback non-invoke
      const spy = vi.spyOn(rbac, 'getEffectivePermissions');
      redis.opLog.length = 0;
      await service.getEffectivePermissions(AuthRole.BrokerUser);
      expect(redis.opLog).toContain('get:rbac:effective:broker_user');
      expect(spy).not.toHaveBeenCalled();
    });

    it('3. super_admin returns wildcard in cache', async () => {
      const { service } = buildService();
      const perms = await service.getEffectivePermissions(AuthRole.SuperAdminPlatform);
      expect(perms.has(RBAC_WILDCARD)).toBe(true);
    });
  });

  describe('getEffectivePermissionsForUser (v3.0 multi-tenant scoping)', () => {
    it('4. compose union des permissions multi-role', async () => {
      const { service } = buildService();
      const perms = await service.getEffectivePermissionsForUser(
        'user-1',
        'tenant-1',
        [AuthRole.BrokerUser, AuthRole.GarageCommercial],
      );
      // From broker_user
      expect(perms.has(Permission.CRM_DEALS_CREATE)).toBe(true);
      // From garage_commercial
      expect(perms.has(Permission.REPAIR_DEVIS_CREATE)).toBe(true);
    });

    it('5. wildcard role : retour set { wildcard } uniquement', async () => {
      const { service } = buildService();
      const perms = await service.getEffectivePermissionsForUser(
        'user-1',
        'tenant-1',
        [AuthRole.BrokerUser, AuthRole.SuperAdminPlatform],
      );
      expect(perms.size).toBe(1);
      expect(perms.has(RBAC_WILDCARD)).toBe(true);
    });

    it('6. cache key inclut tenantId + userId + roleHash', async () => {
      const { service, redis } = buildService();
      await service.getEffectivePermissionsForUser('user-1', 'tenant-1', [AuthRole.BrokerUser]);
      const setOp = redis.opLog.find((o) => o.startsWith('set:rbac:perm:'));
      expect(setOp).toBeDefined();
      expect(setOp).toMatch(/^set:rbac:perm:tenant-1:user-1:[a-f0-9]{12}$/);
    });

    it('7. role order ne change pas le hash (sorted)', async () => {
      const { service, redis } = buildService();
      await service.getEffectivePermissionsForUser('user-1', 'tenant-1', [
        AuthRole.GarageCommercial,
        AuthRole.BrokerUser,
      ]);
      redis.opLog.length = 0;
      await service.getEffectivePermissionsForUser('user-1', 'tenant-1', [
        AuthRole.BrokerUser,
        AuthRole.GarageCommercial,
      ]);
      // Doit etre un cache hit (set NON appele)
      expect(redis.opLog.some((o) => o.startsWith('set:'))).toBe(false);
    });
  });

  describe('invalidateRole', () => {
    it('8. invalide cache pour role specifique', async () => {
      const { service, redis } = buildService();
      await service.getEffectivePermissions(AuthRole.BrokerAdmin);
      redis.opLog.length = 0;
      await service.invalidateRole(AuthRole.BrokerAdmin);
      expect(redis.opLog).toContain('del:rbac:effective:broker_admin');
    });
  });

  describe('invalidateUser', () => {
    it('9. invalide tous les caches user via keys+del pattern', async () => {
      const { service, redis } = buildService();
      await service.getEffectivePermissionsForUser('user-42', 'tnt-A', [AuthRole.BrokerUser]);
      await service.getEffectivePermissionsForUser('user-42', 'tnt-B', [AuthRole.BrokerAdmin]);
      redis.opLog.length = 0;
      await service.invalidateUser('user-42');
      const keysCall = redis.opLog.find((o) => o.startsWith('keys:'));
      expect(keysCall).toBe('keys:rbac:perm:*:user-42:*');
      const delCall = redis.opLog.find((o) => o.startsWith('del:'));
      expect(delCall).toBeDefined();
    });
  });

  describe('invalidateAll', () => {
    it('10. flush tous les caches role + user + in-process RbacService', async () => {
      const { service, redis, rbac } = buildService();
      await service.getEffectivePermissions(AuthRole.BrokerUser);
      await service.getEffectivePermissionsForUser('u1', 'tnt', [AuthRole.GarageAdmin]);
      const clearSpy = vi.spyOn(rbac, 'clearCache');
      redis.opLog.length = 0;
      await service.invalidateAll();
      expect(clearSpy).toHaveBeenCalledOnce();
      expect(redis.opLog).toContain('keys:rbac:effective:*');
      expect(redis.opLog).toContain('keys:rbac:perm:*');
    });
  });

  describe('graceful degradation', () => {
    it('11. Redis get failure : fallback to RbacService, no throw', async () => {
      const broken = {
        get: vi.fn().mockRejectedValue(new Error('redis down')),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn(),
        keys: vi.fn(),
      };
      const rbac = new RbacService(new HierarchyResolver());
      const service = new PermissionCacheService(broken as never, rbac);
      const perms = await service.getEffectivePermissions(AuthRole.BrokerUser);
      expect(perms.has(Permission.CRM_DEALS_CREATE)).toBe(true);
    });

    it('12. Redis set failure : returns RbacService result, no throw', async () => {
      const broken = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockRejectedValue(new Error('redis full')),
        del: vi.fn(),
        keys: vi.fn(),
      };
      const rbac = new RbacService(new HierarchyResolver());
      const service = new PermissionCacheService(broken as never, rbac);
      const perms = await service.getEffectivePermissions(AuthRole.BrokerUser);
      expect(perms.has(Permission.CRM_DEALS_CREATE)).toBe(true);
    });
  });

  describe('TTL', () => {
    const original = process.env['RBAC_CACHE_TTL_SECONDS'];

    afterEach(() => {
      if (original === undefined) {
        delete process.env['RBAC_CACHE_TTL_SECONDS'];
      } else {
        process.env['RBAC_CACHE_TTL_SECONDS'] = original;
      }
    });

    it('13. default TTL = 300s', () => {
      delete process.env['RBAC_CACHE_TTL_SECONDS'];
      const { service } = buildService();
      expect(service.getTtlSeconds()).toBe(300);
    });

    it('14. TTL configurable via env', () => {
      process.env['RBAC_CACHE_TTL_SECONDS'] = '600';
      const { service } = buildService();
      expect(service.getTtlSeconds()).toBe(600);
    });
  });
});
