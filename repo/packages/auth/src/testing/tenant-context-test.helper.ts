/**
 * Helper pour tests : wrapper de service calls dans un contexte tenant.
 *
 * Discipline : TOUS les tests qui appellent un service utilisant TenantContextService
 * (CRM, Insure, Repair, etc.) DOIVENT wrapper le call dans `withTenantContext()`.
 *
 * Reference : Sprint 6 / Tache 2.2.1.
 */

import { AuthRole } from '../types/auth-roles.js';
import type { TenantContext, TenantSettings } from '../types/tenant-context.type.js';
import { tenantContextStorage } from '../services/tenant-context.service.js';

/**
 * Build un TenantContext mock complet avec defaults sains.
 * Override les champs souhaites pour le test specifique.
 */
export const buildMockTenantContext = (
  overrides: Partial<TenantContext> = {},
): TenantContext => ({
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userRole: AuthRole.BrokerAdmin,
  isSuperAdmin: false,
  traceId: '01HZX1234567890123456789AB',
  correlationId: '99999999-9999-9999-9999-999999999999',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest-test-agent/1.0',
  ...overrides,
});

/**
 * Build TenantSettings mock avec defaults Maroc.
 */
export const buildMockTenantSettings = (
  overrides: Partial<TenantSettings> = {},
): TenantSettings => ({
  locale: 'fr',
  timezone: 'Africa/Casablanca',
  currency: 'MAD',
  branding: {
    primaryColor: '#E95D2C',
    secondaryColor: '#3D3D3D',
    logoUrl: null,
    faviconUrl: null,
  },
  features: {
    mfaRequiredForAdmin: true,
    sinistreAutoAssign: false,
    skySandboxEnabled: false,
    aiEstimationEnabled: false,
  },
  quotas: {
    maxUsers: 10,
    maxPolices: 1000,
    maxStorageGb: 50,
  },
  tenantType: 'broker',
  ...overrides,
});

/**
 * Wrapper test : execute `fn` dans un contexte tenant.
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return tenantContextStorage.run(ctx, async () => {
    return await fn();
  });
}

/**
 * Wrapper test : execute fn comme super admin platform.
 *
 * `tenantId` est OMIS pour un super admin (routes /api/v1/admin/* sans tenant).
 */
export async function withSuperAdminContext<T>(
  fn: () => T | Promise<T>,
  overrides: Partial<TenantContext> = {},
): Promise<T> {
  const baseCtx = buildMockTenantContext({
    isSuperAdmin: true,
    userRole: AuthRole.SuperAdminPlatform,
    ...overrides,
  });
  const { tenantId: _tenantId, ...withoutTenant } = baseCtx;
  return withTenantContext(withoutTenant as TenantContext, fn);
}

/**
 * Wrapper test : execute fn comme assure L3 dans un tenant courtier.
 */
export async function withAssureContext<T>(
  brokerTenantId: string,
  assureUserId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const ctx = buildMockTenantContext({
    tenantId: brokerTenantId,
    userId: assureUserId,
    assureUserId,
    userRole: AuthRole.Assure,
  });
  return withTenantContext(ctx, fn);
}
