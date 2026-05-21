/**
 * DTOs et Zod schemas pour AdminTenantsController.
 *
 * Reference : Sprint 6 / Tache 2.2.7.
 */

import { z } from 'zod';

const TenantSettingsPartialSchema = z.object({
  locale: z.enum(['fr', 'ar-MA', 'ar', 'en']).optional(),
  timezone: z.string().min(1).max(64).optional(),
  currency: z.enum(['MAD', 'EUR', 'USD']).optional(),
  branding: z
    .object({
      primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      secondaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      logoUrl: z.string().url().nullable().optional(),
      faviconUrl: z.string().url().nullable().optional(),
    })
    .partial()
    .optional(),
  features: z
    .object({
      mfaRequiredForAdmin: z.boolean().optional(),
      sinistreAutoAssign: z.boolean().optional(),
      skySandboxEnabled: z.boolean().optional(),
      aiEstimationEnabled: z.boolean().optional(),
    })
    .partial()
    .optional(),
  quotas: z
    .object({
      maxUsers: z.number().int().min(1).max(10000).optional(),
      maxPolices: z.number().int().min(1).max(1000000).optional(),
      maxStorageGb: z.number().int().min(1).max(10000).optional(),
    })
    .partial()
    .optional(),
  ice: z.string().regex(/^\d{15}$/).optional(),
  tenantType: z.enum(['broker', 'garage', 'mixed']).optional(),
});

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  type: z.enum(['broker', 'garage', 'mixed']),
  settings: TenantSettingsPartialSchema.optional(),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(150).trim().optional(),
  settings: TenantSettingsPartialSchema.optional(),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;

export const TenantFiltersSchema = z.object({
  type: z.enum(['broker', 'garage', 'mixed']).optional(),
  status: z.enum(['active', 'archived']).optional(),
  search: z.string().min(1).max(100).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type TenantFiltersDto = z.infer<typeof TenantFiltersSchema>;

export const ArchiveTenantSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type ArchiveTenantDto = z.infer<typeof ArchiveTenantSchema>;
