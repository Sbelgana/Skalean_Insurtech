/**
 * PermissionCacheService -- Sprint 7 Tache 2.3.10.
 *
 * Cache Redis distribue pour permissions effectives par role. Synchronise les
 * replicas API (multi-instance) sans recalcul DAG repete a chaque request.
 *
 * Strategy :
 *   - Layer 1 : HierarchyResolver in-process memoization (Sprint 7.5a).
 *   - Layer 2 : Redis cache key=rbac:effective:{role} -> JSON array, TTL 5min.
 *   - Layer 3 : RbacService delegate fallback si cache miss.
 *
 * v3.0 multi-tenant scoping (per task brief v3.0 prompt) :
 *   - Keys per user : perm:{tenantId}:{userId}:{roleHash}
 *     roleHash = MD5(JSON.stringify(sortedRoles + crossTenantAuth))
 *   - Invalidation per user : DEL perm:*:{userId}:*
 *   - Invalidation per role : DEL rbac:effective:{role}
 *
 * API :
 *   - getEffectivePermissions(role) -> Set<PermissionValue>
 *   - getEffectivePermissionsForUser(userId, tenantId, roles, hash) -> Set
 *   - invalidateRole(role)
 *   - invalidateUser(userId)
 *   - invalidateAll() -- nuclear option (matrix updated globally)
 *
 * Reference : B-07 Tache 2.3.10.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  type AuthRole,
  DEFAULT_PERMISSION_TTL_SECONDS,
  type PermissionValue,
  RbacService,
  RBAC_WILDCARD,
  REDIS_RBAC_PREFIX,
} from '@insurtech/auth';
import type Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../../redis/redis.provider.js';

const ROLE_CACHE_PREFIX = `${REDIS_RBAC_PREFIX}effective:`;
const USER_CACHE_PREFIX = `${REDIS_RBAC_PREFIX}perm:`;

@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
    private readonly rbac: RbacService,
  ) {
    this.ttlSeconds = Number(
      process.env['RBAC_CACHE_TTL_SECONDS'] ?? DEFAULT_PERMISSION_TTL_SECONDS,
    );
  }

  /**
   * Permissions effectives d'un role. Cache Redis 5min default.
   * Fallback : RbacService.getEffectivePermissions (resolveur in-process).
   */
  async getEffectivePermissions(role: AuthRole): Promise<ReadonlySet<string>> {
    const key = this.roleKey(role);
    const cached = await this.safeGet(key);
    if (cached) {
      try {
        const arr = JSON.parse(cached) as string[];
        return new Set(arr);
      } catch (err) {
        this.logger.warn(`stale cache for role=${role} : ${(err as Error).message}`);
      }
    }

    const perms = this.rbac.getEffectivePermissions(role);
    const serialized = JSON.stringify(Array.from(perms));
    await this.safeSet(key, serialized);
    return perms as ReadonlySet<string>;
  }

  /**
   * Permissions effectives multi-role par user. Cache key scope-tenant.
   * `roles` doit etre une liste stable (sorted) pour produire un hash deterministe.
   */
  async getEffectivePermissionsForUser(
    userId: string,
    tenantId: string | undefined,
    roles: readonly AuthRole[],
  ): Promise<ReadonlySet<string>> {
    const sortedRoles = [...roles].sort();
    const hash = this.hashRoles(sortedRoles);
    const key = this.userKey(tenantId, userId, hash);
    const cached = await this.safeGet(key);
    if (cached) {
      try {
        const arr = JSON.parse(cached) as string[];
        return new Set(arr);
      } catch (err) {
        this.logger.warn(`stale cache user=${userId} : ${(err as Error).message}`);
      }
    }

    // Union des effective perms par role (utilise HierarchyResolver memoize)
    const union = new Set<string>();
    let wildcard = false;
    for (const role of sortedRoles) {
      const effective = this.rbac.getEffectivePermissions(role);
      if (effective.has(RBAC_WILDCARD)) {
        wildcard = true;
        break;
      }
      for (const perm of effective) {
        union.add(perm as PermissionValue);
      }
    }
    if (wildcard) {
      union.clear();
      union.add(RBAC_WILDCARD);
    }
    await this.safeSet(key, JSON.stringify(Array.from(union)));
    return union;
  }

  /** Invalide cache pour un role (toutes instances API via Redis). */
  async invalidateRole(role: AuthRole): Promise<void> {
    await this.safeDel(this.roleKey(role));
    this.logger.log(`invalidated cache for role=${role}`);
  }

  /**
   * Invalide tous les caches d'un user (e.g. apres role change).
   * Scan via pattern perm:*:{userId}:* (peut etre couteux sur cluster gros volume).
   */
  async invalidateUser(userId: string): Promise<void> {
    const pattern = `${USER_CACHE_PREFIX}*:${userId}:*`;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.logger.log(`invalidated ${keys.length} cache entries for user=${userId}`);
    } catch (err) {
      this.logger.warn(`invalidateUser failed for ${userId} : ${(err as Error).message}`);
    }
  }

  /** Nuclear : tout flush (matrix updated). */
  async invalidateAll(): Promise<void> {
    try {
      const rolePattern = `${ROLE_CACHE_PREFIX}*`;
      const userPattern = `${USER_CACHE_PREFIX}*`;
      const [roleKeys, userKeys] = await Promise.all([
        this.redis.keys(rolePattern),
        this.redis.keys(userPattern),
      ]);
      const all = [...roleKeys, ...userKeys];
      if (all.length > 0) {
        await this.redis.del(...all);
      }
      // Reset aussi le memoize in-process du RbacService
      this.rbac.clearCache();
      this.logger.log(`invalidateAll : flushed ${all.length} entries + in-process cache`);
    } catch (err) {
      this.logger.error(`invalidateAll failed : ${(err as Error).message}`);
    }
  }

  /** Introspection. */
  getTtlSeconds(): number {
    return this.ttlSeconds;
  }

  private roleKey(role: AuthRole): string {
    return `${ROLE_CACHE_PREFIX}${role}`;
  }

  private userKey(tenantId: string | undefined, userId: string, hash: string): string {
    return `${USER_CACHE_PREFIX}${tenantId ?? '_'}:${userId}:${hash}`;
  }

  private hashRoles(roles: readonly AuthRole[]): string {
    return createHash('md5').update(roles.join(',')).digest('hex').slice(0, 12);
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`redis get failed for ${key} : ${(err as Error).message}`);
      return null;
    }
  }

  private async safeSet(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', this.ttlSeconds);
    } catch (err) {
      this.logger.warn(`redis set failed for ${key} : ${(err as Error).message}`);
    }
  }

  private async safeDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`redis del failed for ${key} : ${(err as Error).message}`);
    }
  }
}
