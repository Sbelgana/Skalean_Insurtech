/**
 * DTOs Zod pour CndpPurgeService endpoints.
 *
 * Reference : Sprint 6 / Tache 2.2.12.
 */

import { z } from 'zod';

export const InitiatePurgeRequestSchema = z.object({
  tenantId: z.string().uuid(),
  requestType: z.enum(['user_data', 'full_tenant']),
  targetUserId: z.string().uuid().optional(),
  requestedByEmail: z.string().email().toLowerCase(),
  reason: z.string().min(10).max(2000),
}).refine(
  (d) => d.requestType === 'full_tenant' || d.targetUserId !== undefined,
  { message: 'targetUserId required when requestType=user_data', path: ['targetUserId'] },
);

export type InitiatePurgeRequestDto = z.infer<typeof InitiatePurgeRequestSchema>;

export const ValidatePurgeRequestSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export type ValidatePurgeRequestDto = z.infer<typeof ValidatePurgeRequestSchema>;

export const CancelPurgeRequestSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type CancelPurgeRequestDto = z.infer<typeof CancelPurgeRequestSchema>;
