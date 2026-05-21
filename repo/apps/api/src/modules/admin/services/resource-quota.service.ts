// ResourceQuotaService -- Sprint 6 Tache 2.2.11.
//
// Quotas par tenant + tier subscription (free/pro/enterprise).
//
// Storage strategy :
//   - Config (limits + tier) : auth_tenants.settings (jsonb)
//   - Override : auth_tenants.settings.quotaOverrides (jsonb)
//   - Usage counters : Redis INCRBY/DECRBY atomic
//
// Pattern usage (par services metier Sprint 8+) :
//   await quotaService.checkQuotaBeforeAction(tenantId, 'policies', 1);
//   // ... create logic ...
//   await quotaService.incrementUsage(tenantId, 'policies', 1);
//
// Reference : Sprint 6 / Tache 2.2.11 + Sprint 11 PayMA subscription tiers.

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuthTenant, type DataSource } from '@insurtech/database';
import type Redis from 'ioredis';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider.js';
import {
  QUOTA_ERROR_CODES,
  QUOTA_WARNING_THRESHOLD_PCT,
  type QuotaCheckResult,
  type QuotaLimits,
  type QuotaTier,
  type QuotaUsage,
  type ResourceType,
  type TenantQuotaDto,
  TIER_QUOTAS,
} from '../types/quota.type.js';

const RESOURCE_TYPES: ResourceType[] = [
  'users',
  'policies',
  'documents',
  'storage_bytes_total',
  'sessions_concurrent',
  'cross_tenant_authz',
];

const usageKey = (tenantId: string, resource: ResourceType): string =>
  `quota:usage:${tenantId}:${resource}`;

@Injectable()
export class ResourceQuotaService {
  private readonly logger = new Logger(ResourceQuotaService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
  ) {}

  // ===========================================================================
  // GET QUOTA
  // ===========================================================================

  async getQuotaForTenant(tenantId: string): Promise<TenantQuotaDto> {
    const tenant = await this.fetchTenant(tenantId);
    const tier = this.extractTier(tenant);
    const overrides = this.extractOverrides(tenant);
    const tierLimits = TIER_QUOTAS[tier];
    const limits = this.mergeLimits(tierLimits, overrides);
    const usage = await this.getUsage(tenantId);

    const utilizationPct: Record<ResourceType, number> = {} as Record<ResourceType, number>;
    for (const r of RESOURCE_TYPES) {
      const limit = limits[r];
      const used = usage[r];
      utilizationPct[r] = limit === null ? -1 : limit === 0 ? 100 : Math.round((used / limit) * 100);
    }

    return {
      tenantId,
      tier,
      limits,
      usage,
      utilizationPct,
      overrides,
    };
  }

  // ===========================================================================
  // CHECK BEFORE ACTION
  // ===========================================================================

  /**
   * Verifie si une action consommant `increment` de `resourceType` est autorisee.
   * Reject avec HttpException si quota depasse.
   * Emet warning au-dela de 80% threshold (audit).
   */
  async checkQuotaBeforeAction(
    tenantId: string,
    resourceType: ResourceType,
    increment: number,
    options: { bypassForSuperAdmin?: boolean } = {},
  ): Promise<QuotaCheckResult> {
    if (options.bypassForSuperAdmin) {
      const usage = await this.getUsageForResource(tenantId, resourceType);
      return {
        allowed: true,
        resourceType,
        currentUsage: usage,
        newUsage: usage + increment,
        limit: null,
      };
    }

    const tenant = await this.fetchTenantOrNull(tenantId);
    if (!tenant) {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
    if (tenant.deletedAt || tenant.status === 'archived') {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' is archived`,
      });
    }
    if (tenant.status === 'suspended') {
      throw new ForbiddenException({
        code: QUOTA_ERROR_CODES.TENANT_SUSPENDED,
        message: 'Tenant is suspended. Quota check rejected.',
      });
    }

    const tier = this.extractTier(tenant);
    const overrides = this.extractOverrides(tenant);
    const limits = this.mergeLimits(TIER_QUOTAS[tier], overrides);
    const limit = limits[resourceType];
    const current = await this.getUsageForResource(tenantId, resourceType);
    const projected = current + increment;

    // Unlimited (enterprise tier).
    if (limit === null) {
      return {
        allowed: true,
        resourceType,
        currentUsage: current,
        newUsage: projected,
        limit: null,
      };
    }

    if (projected > limit) {
      this.logger.warn(
        `quota_exceeded tenant=${tenantId} resource=${resourceType} current=${current} requested=${increment} limit=${limit}`,
      );
      throw new HttpException(
        {
          code: QUOTA_ERROR_CODES.QUOTA_EXCEEDED,
          message: `Quota exceeded for ${resourceType}: ${projected}/${limit}`,
          resourceType,
          currentUsage: current,
          limit,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const projectedPct = limit === 0 ? 100 : (projected / limit) * 100;
    const warningAt80Percent = projectedPct >= QUOTA_WARNING_THRESHOLD_PCT;
    if (warningAt80Percent && current < limit * 0.8) {
      this.logger.warn(
        `quota_warning_threshold tenant=${tenantId} resource=${resourceType} projected_pct=${projectedPct.toFixed(1)} limit=${limit}`,
      );
    }

    return {
      allowed: true,
      resourceType,
      currentUsage: current,
      newUsage: projected,
      limit,
      warningAt80Percent,
    };
  }

  // ===========================================================================
  // INCREMENT / DECREMENT (atomic Redis INCRBY)
  // ===========================================================================

  async incrementUsage(
    tenantId: string,
    resourceType: ResourceType,
    amount: number,
  ): Promise<number> {
    if (amount < 0) {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.RESOURCE_TYPE_INVALID,
        message: 'increment amount must be >= 0',
      });
    }
    const newValue = await this.redis.incrby(usageKey(tenantId, resourceType), amount);
    this.logger.debug(
      `quota_increment tenant=${tenantId} resource=${resourceType} amount=${amount} new_value=${newValue}`,
    );
    return newValue;
  }

  /**
   * Decremente l'usage. Clamp a 0 (jamais negatif).
   */
  async decrementUsage(
    tenantId: string,
    resourceType: ResourceType,
    amount: number,
  ): Promise<number> {
    if (amount < 0) {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.RESOURCE_TYPE_INVALID,
        message: 'decrement amount must be >= 0',
      });
    }
    const newValue = await this.redis.decrby(usageKey(tenantId, resourceType), amount);
    if (newValue < 0) {
      // Clamp to 0 -- Redis SET ne race pas avec d'autres workers car on a deja decremente.
      await this.redis.set(usageKey(tenantId, resourceType), '0');
      this.logger.debug(
        `quota_decrement_clamped tenant=${tenantId} resource=${resourceType} attempted=${newValue} clamped=0`,
      );
      return 0;
    }
    this.logger.debug(
      `quota_decrement tenant=${tenantId} resource=${resourceType} amount=${amount} new_value=${newValue}`,
    );
    return newValue;
  }

  // ===========================================================================
  // OVERRIDE (super admin)
  // ===========================================================================

  async setQuotaOverride(
    tenantId: string,
    resourceType: ResourceType,
    customLimit: number | null,
    reason: string,
    adminUserId: string,
  ): Promise<TenantQuotaDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    if (!tenant) {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const overrides = ((settings['quotaOverrides'] as Partial<QuotaLimits> | undefined) ?? {}) as Partial<QuotaLimits>;
    overrides[resourceType] = customLimit;

    tenant.settings = {
      ...settings,
      quotaOverrides: overrides,
    };
    await repo.save(tenant);

    this.logger.warn(
      `quota_override_set tenant=${tenantId} resource=${resourceType} limit=${customLimit ?? 'unlimited'} by_admin=${adminUserId} reason=${reason}`,
    );

    return this.getQuotaForTenant(tenantId);
  }

  async clearQuotaOverride(
    tenantId: string,
    resourceType: ResourceType,
    adminUserId: string,
  ): Promise<TenantQuotaDto> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenant = await repo.findOne({ where: { id: tenantId }, withDeleted: true });
    if (!tenant) {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const overrides = ((settings['quotaOverrides'] as Partial<QuotaLimits> | undefined) ?? {}) as Partial<QuotaLimits>;
    delete overrides[resourceType];
    tenant.settings = { ...settings, quotaOverrides: overrides };
    await repo.save(tenant);

    this.logger.log(
      `quota_override_cleared tenant=${tenantId} resource=${resourceType} by_admin=${adminUserId}`,
    );

    return this.getQuotaForTenant(tenantId);
  }

  // ===========================================================================
  // NEAR LIMIT (alertes back-office)
  // ===========================================================================

  async listQuotasNearLimit(thresholdPct: number = QUOTA_WARNING_THRESHOLD_PCT): Promise<TenantQuotaDto[]> {
    const repo = this.dataSource.getRepository(AuthTenant);
    const tenants = await repo.find({
      where: { status: 'active' },
    });

    const results: TenantQuotaDto[] = [];
    for (const tenant of tenants) {
      const dto = await this.getQuotaForTenant(tenant.id);
      const hasWarning = Object.values(dto.utilizationPct).some(
        (pct) => pct >= thresholdPct && pct !== -1,
      );
      if (hasWarning) results.push(dto);
    }
    return results;
  }

  // ===========================================================================
  // USAGE REPORT
  // ===========================================================================

  /**
   * Sprint 6 : snapshot usage actuel + limits + tier. Sprint 11 PayMA enrichira
   * avec usage historique (table dediee tenant_usage_snapshots).
   */
  async reportUsage(tenantId: string): Promise<TenantQuotaDto> {
    return this.getQuotaForTenant(tenantId);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async fetchTenant(tenantId: string): Promise<AuthTenant> {
    const tenant = await this.fetchTenantOrNull(tenantId);
    if (!tenant) {
      throw new BadRequestException({
        code: QUOTA_ERROR_CODES.TENANT_NOT_FOUND,
        message: `Tenant '${tenantId}' not found`,
      });
    }
    return tenant;
  }

  private async fetchTenantOrNull(tenantId: string): Promise<AuthTenant | null> {
    const repo = this.dataSource.getRepository(AuthTenant);
    return repo.findOne({ where: { id: tenantId }, withDeleted: true });
  }

  private extractTier(tenant: AuthTenant): QuotaTier {
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const tier = settings['tier'];
    if (tier === 'pro' || tier === 'enterprise') return tier;
    return 'free';
  }

  private extractOverrides(tenant: AuthTenant): Partial<QuotaLimits> {
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const overrides = settings['quotaOverrides'];
    if (!overrides || typeof overrides !== 'object') return {};
    return overrides as Partial<QuotaLimits>;
  }

  private mergeLimits(
    tierLimits: QuotaLimits,
    overrides: Partial<QuotaLimits>,
  ): QuotaLimits {
    return {
      users: overrides.users !== undefined ? overrides.users : tierLimits.users,
      policies: overrides.policies !== undefined ? overrides.policies : tierLimits.policies,
      documents:
        overrides.documents !== undefined ? overrides.documents : tierLimits.documents,
      storage_bytes_total:
        overrides.storage_bytes_total !== undefined
          ? overrides.storage_bytes_total
          : tierLimits.storage_bytes_total,
      sessions_concurrent:
        overrides.sessions_concurrent !== undefined
          ? overrides.sessions_concurrent
          : tierLimits.sessions_concurrent,
      cross_tenant_authz:
        overrides.cross_tenant_authz !== undefined
          ? overrides.cross_tenant_authz
          : tierLimits.cross_tenant_authz,
    };
  }

  private async getUsage(tenantId: string): Promise<QuotaUsage> {
    const keys = RESOURCE_TYPES.map((r) => usageKey(tenantId, r));
    const values = await this.redis.mget(...keys);
    return {
      users: this.toInt(values[0]),
      policies: this.toInt(values[1]),
      documents: this.toInt(values[2]),
      storage_bytes_total: this.toInt(values[3]),
      sessions_concurrent: this.toInt(values[4]),
      cross_tenant_authz: this.toInt(values[5]),
    };
  }

  private async getUsageForResource(
    tenantId: string,
    resourceType: ResourceType,
  ): Promise<number> {
    const raw = await this.redis.get(usageKey(tenantId, resourceType));
    return this.toInt(raw);
  }

  private toInt(val: string | null | undefined): number {
    if (!val) return 0;
    const n = Number.parseInt(val, 10);
    return Number.isFinite(n) ? n : 0;
  }
}
