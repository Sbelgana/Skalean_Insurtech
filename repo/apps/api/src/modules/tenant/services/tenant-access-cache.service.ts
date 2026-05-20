/**
 * Service Redis cache pour acces user au tenant + settings tenant.
 *
 * Pattern cache-aside :
 *   1. Lire cache Redis
 *   2. Si miss : fetch DB via TypeORM, write cache (TTL 5min)
 *
 * Namespace Redis :
 *   tenant:user-access:{userId}:{tenantId} -> JSON { allowed: bool }
 *   tenant:settings:{tenantId} -> JSON serialized TenantSettings
 *   tenant:exists:{tenantId} -> '1' (existence flag) ou '0' (archived/deleted)
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TenantSettings } from '@insurtech/auth';
import { AuthTenant, AuthTenantUser } from '@insurtech/database';
import type { DataSource } from '@insurtech/database';
import type Redis from 'ioredis';
import { z } from 'zod';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider.js';

const CACHE_TTL_SECONDS = 300;
const cacheKeyUserAccess = (userId: string, tenantId: string): string =>
  `tenant:user-access:${userId}:${tenantId}`;
const cacheKeySettings = (tenantId: string): string => `tenant:settings:${tenantId}`;
const cacheKeyExists = (tenantId: string): string => `tenant:exists:${tenantId}`;

export interface UserAccessResult {
  allowed: boolean;
  reason?: string;
}

const TenantSettingsSchema = z.object({
  locale: z.enum(['fr', 'ar-MA', 'ar', 'en']).default('fr'),
  timezone: z.string().default('Africa/Casablanca'),
  currency: z.enum(['MAD', 'EUR', 'USD']).default('MAD'),
  branding: z
    .object({
      primaryColor: z.string().default('#E95D2C'),
      secondaryColor: z.string().optional(),
      logoUrl: z.string().nullable().default(null),
      faviconUrl: z.string().nullable().optional(),
    })
    .default({ primaryColor: '#E95D2C', logoUrl: null }),
  features: z
    .object({
      mfaRequiredForAdmin: z.boolean().default(true),
      sinistreAutoAssign: z.boolean().default(false),
      skySandboxEnabled: z.boolean().optional(),
      aiEstimationEnabled: z.boolean().optional(),
    })
    .default({ mfaRequiredForAdmin: true, sinistreAutoAssign: false }),
  quotas: z
    .object({
      maxUsers: z.number().int().min(1).default(10),
      maxPolices: z.number().int().min(1).default(1000),
      maxStorageGb: z.number().int().min(1).default(50),
    })
    .default({ maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 }),
  ice: z.string().optional(),
  tenantType: z.enum(['broker', 'garage', 'mixed']).default('broker'),
});

@Injectable()
export class TenantAccessCacheService {
  private readonly logger = new Logger(TenantAccessCacheService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
  ) {}

  /**
   * Verifie si user a acces au tenant. Cache Redis 5min.
   */
  async getUserAccess(userId: string, tenantId: string): Promise<UserAccessResult> {
    const cacheKey = cacheKeyUserAccess(userId, tenantId);

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as UserAccessResult;
      } catch {
        this.logger.warn(`cache parse failed, refetching key=${cacheKey}`);
      }
    }

    const repo = this.dataSource.getRepository(AuthTenantUser);
    const tenantUser = await repo.findOne({
      where: { tenantId, userId },
    });

    const result: UserAccessResult = tenantUser
      ? { allowed: true }
      : { allowed: false, reason: 'USER_NOT_LINKED_TO_TENANT' };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
    return result;
  }

  /**
   * Charge tenant settings. Cache 5min.
   */
  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    const cacheKey = cacheKeySettings(tenantId);

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as TenantSettings;
      } catch {
        this.logger.warn(`cache parse settings failed, refetching key=${cacheKey}`);
      }
    }

    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId } });
    if (!tenant) return null;

    const parsed = TenantSettingsSchema.safeParse(tenant.settings ?? {});
    const settings: TenantSettings = parsed.success
      ? (parsed.data as TenantSettings)
      : (TenantSettingsSchema.parse({}) as TenantSettings);

    await this.redis.set(cacheKey, JSON.stringify(settings), 'EX', CACHE_TTL_SECONDS);
    return settings;
  }

  /**
   * Verifie existence + tenant non-archive. Cache 5min.
   *
   * Sprint 6 : `auth_tenants` n'a pas de colonne `status`. On utilise
   * `deletedAt IS NULL` comme proxy d'existence active.
   * Tache 2.2.9 introduira la colonne status proper.
   */
  async getTenantExists(tenantId: string): Promise<boolean> {
    const cacheKey = cacheKeyExists(tenantId);

    const cached = await this.redis.get(cacheKey);
    if (cached === '1') return true;
    if (cached === '0') return false;

    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({
      where: { id: tenantId },
      withDeleted: false,
    });

    const exists = tenant !== null;
    await this.redis.set(cacheKey, exists ? '1' : '0', 'EX', CACHE_TTL_SECONDS);
    return exists;
  }

  async invalidateUserAccess(userId: string, tenantId: string): Promise<void> {
    await this.redis.del(cacheKeyUserAccess(userId, tenantId));
  }

  async invalidateTenantSettings(tenantId: string): Promise<void> {
    await this.redis.del(cacheKeySettings(tenantId));
  }

  async invalidateTenantExists(tenantId: string): Promise<void> {
    await this.redis.del(cacheKeyExists(tenantId));
  }

  async invalidateAllForTenant(tenantId: string): Promise<void> {
    const keys: string[] = [];
    const stream = this.redis.scanStream({ match: `tenant:*:*${tenantId}*` });
    for await (const batch of stream) {
      keys.push(...(batch as string[]));
    }
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
