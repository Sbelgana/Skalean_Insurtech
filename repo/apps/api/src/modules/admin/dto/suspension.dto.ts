/**
 * DTOs Zod pour TenantSuspensionService endpoints.
 *
 * Reference : Sprint 6 / Tache 2.2.9.
 */

import { z } from 'zod';

export const SuspendTenantSchema = z.object({
  reason: z.string().min(3).max(500),
  suspensionType: z.enum(['payment_failure', 'compliance_violation', 'manual_admin']),
});

export type SuspendTenantDto = z.infer<typeof SuspendTenantSchema>;

export const ReactivateTenantSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type ReactivateTenantDto = z.infer<typeof ReactivateTenantSchema>;
