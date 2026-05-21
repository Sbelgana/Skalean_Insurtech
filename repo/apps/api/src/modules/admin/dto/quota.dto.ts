/**
 * DTOs Zod pour ResourceQuotaService endpoints.
 *
 * Reference : Sprint 6 / Tache 2.2.11.
 */

import { z } from 'zod';

const ResourceTypeEnum = z.enum([
  'users',
  'policies',
  'documents',
  'storage_bytes_total',
  'sessions_concurrent',
  'cross_tenant_authz',
]);

export const SetQuotaOverrideSchema = z.object({
  resourceType: ResourceTypeEnum,
  /** null = unlimited (admin override). Sinon entier positif. */
  customLimit: z.union([z.number().int().min(0), z.null()]),
  reason: z.string().min(3).max(500),
});

export type SetQuotaOverrideDto = z.infer<typeof SetQuotaOverrideSchema>;

export const NearLimitFiltersSchema = z.object({
  threshold: z.coerce.number().int().min(50).max(100).default(80),
});

export type NearLimitFiltersDto = z.infer<typeof NearLimitFiltersSchema>;

export const UsageReportFiltersSchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('month'),
});

export type UsageReportFiltersDto = z.infer<typeof UsageReportFiltersSchema>;
