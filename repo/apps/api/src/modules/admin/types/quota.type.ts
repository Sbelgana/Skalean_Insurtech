/**
 * Types pour ResourceQuotaService.
 *
 * Sprint 6 storage strategy :
 *   - Quota config (limits) : auth_tenants.settings.quotas (jsonb existant TenantSettings)
 *     + auth_tenants.settings.tier (free/pro/enterprise, default 'free')
 *   - Override : auth_tenants.settings.quotas.overrides (jsonb per resource)
 *   - Usage counters : Redis INCRBY/DECRBY atomic (quota:usage:<tenantId>:<resourceType>)
 *   - Pas de table DB dediee Sprint 6 (defere Sprint 11 PayMA si billing persistant).
 *
 * Sprint 11 (PayMA) raffinera : subscription tier change + downgrade warning.
 *
 * Reference : Sprint 6 / Tache 2.2.11.
 */

/** Tiers subscription. */
export type QuotaTier = 'free' | 'pro' | 'enterprise';

/** Types de ressources trackables. */
export type ResourceType =
  | 'users'
  | 'policies'
  | 'documents'
  | 'storage_bytes_total'
  | 'sessions_concurrent'
  | 'cross_tenant_authz';

/** Quota limits par tier (null = unlimited, sentinel pour enterprise). */
export interface QuotaLimits {
  users: number | null;
  policies: number | null;
  documents: number | null;
  storage_bytes_total: number | null;
  sessions_concurrent: number | null;
  cross_tenant_authz: number | null;
}

export interface QuotaUsage {
  users: number;
  policies: number;
  documents: number;
  storage_bytes_total: number;
  sessions_concurrent: number;
  cross_tenant_authz: number;
}

export interface TenantQuotaDto {
  tenantId: string;
  tier: QuotaTier;
  limits: QuotaLimits;
  usage: QuotaUsage;
  /** percentage utilise par resource (-1 si unlimited). */
  utilizationPct: Record<ResourceType, number>;
  /** overrides actifs (vs tier defaults). */
  overrides: Partial<QuotaLimits>;
}

export interface QuotaCheckResult {
  allowed: boolean;
  resourceType: ResourceType;
  currentUsage: number;
  newUsage: number;
  limit: number | null;
  reason?: 'QUOTA_EXCEEDED' | 'TENANT_NOT_FOUND' | 'TENANT_SUSPENDED';
  warningAt80Percent?: boolean;
}

export const QUOTA_ERROR_CODES = {
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  RESOURCE_TYPE_INVALID: 'QUOTA_RESOURCE_TYPE_INVALID',
  OVERRIDE_INVALID: 'QUOTA_OVERRIDE_INVALID',
} as const;

/**
 * Quota defaults par tier subscription.
 *
 * Sprint 11 PayMA pourra modifier ces valeurs via env vars
 * QUOTA_TIER_{FREE|PRO|ENTERPRISE}_{RESOURCE}.
 */
export const TIER_QUOTAS: Record<QuotaTier, QuotaLimits> = {
  free: {
    users: 5,
    policies: 50,
    documents: 100,
    storage_bytes_total: 100 * 1024 * 1024, // 100 MB
    sessions_concurrent: 10,
    cross_tenant_authz: 5,
  },
  pro: {
    users: 50,
    policies: 5_000,
    documents: 10_000,
    storage_bytes_total: 10 * 1024 * 1024 * 1024, // 10 GB
    sessions_concurrent: 100,
    cross_tenant_authz: 50,
  },
  enterprise: {
    users: null,
    policies: null,
    documents: null,
    storage_bytes_total: 1024 * 1024 * 1024 * 1024, // 1 TB
    sessions_concurrent: 1_000,
    cross_tenant_authz: 500,
  },
};

/** Threshold soft warning. */
export const QUOTA_WARNING_THRESHOLD_PCT = 80;
