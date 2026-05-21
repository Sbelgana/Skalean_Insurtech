/**
 * DTOs et Zod schemas pour TenantOnboardingService.
 *
 * Reference : Sprint 6 / Tache 2.2.8.
 */

import { z } from 'zod';

const RESERVED_TENANT_NAMES = new Set([
  'admin',
  'api',
  'www',
  'support',
  'skalean',
  'system',
  'platform',
  'public',
]);

const tenantSettingsPartial = z
  .object({
    locale: z.enum(['fr', 'ar-MA', 'ar', 'en']).optional(),
    timezone: z.string().min(1).max(64).optional(),
    currency: z.enum(['MAD', 'EUR', 'USD']).optional(),
  })
  .partial()
  .optional();

export const InitiateOnboardingSchema = z.object({
  tenant: z.object({
    name: z
      .string()
      .min(2)
      .max(150)
      .trim()
      .refine((v) => !RESERVED_TENANT_NAMES.has(v.toLowerCase()), {
        message: 'tenant name is reserved',
      }),
    type: z.enum(['broker', 'garage', 'mixed']),
    settings: tenantSettingsPartial,
  }),
  admin: z.object({
    email: z.string().email().max(254).toLowerCase(),
    displayName: z.string().min(2).max(120).trim(),
    locale: z.enum(['fr-MA', 'ar-MA', 'en', 'fr-FR']).default('fr-MA'),
  }),
});

export type InitiateOnboardingDto = z.infer<typeof InitiateOnboardingSchema>;

export const CompleteOnboardingSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(128),
});

export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingSchema>;

export const VerifyOnboardingTokenSchema = z.object({
  token: z.string().min(20).max(200),
});

export type VerifyOnboardingTokenDto = z.infer<typeof VerifyOnboardingTokenSchema>;

export const CancelOnboardingSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type CancelOnboardingDto = z.infer<typeof CancelOnboardingSchema>;
