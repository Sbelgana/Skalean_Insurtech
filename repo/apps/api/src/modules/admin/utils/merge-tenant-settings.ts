/**
 * Helper : deep merge partial settings into existing.
 *
 * Pattern : preserve fields non-modifies, overwrite uniquement fields presents
 * dans partial. Recursif sur sub-objects (branding, features, quotas).
 *
 * Reference : Sprint 6 / Tache 2.2.7.
 */

import type { TenantSettings } from '@insurtech/auth';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export function mergeTenantSettings(
  existing: TenantSettings,
  partial: DeepPartial<TenantSettings>,
): TenantSettings {
  const merged: TenantSettings = {
    ...existing,
    ...(partial.locale !== undefined ? { locale: partial.locale } : {}),
    ...(partial.timezone !== undefined ? { timezone: partial.timezone } : {}),
    ...(partial.currency !== undefined ? { currency: partial.currency } : {}),
    ...(partial.ice !== undefined ? { ice: partial.ice } : {}),
    ...(partial.tenantType !== undefined ? { tenantType: partial.tenantType } : {}),
    branding: { ...existing.branding, ...(partial.branding ?? {}) },
    features: { ...existing.features, ...(partial.features ?? {}) },
    quotas: { ...existing.quotas, ...(partial.quotas ?? {}) },
  };
  return merged;
}
