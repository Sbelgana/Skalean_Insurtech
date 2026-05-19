import { z } from 'zod';

export const UserLockedReasonSchema = z.enum([
  'too_many_failed_attempts', 'admin_action', 'suspicious_activity', 'policy_violation', 'account_compromised',
]);

export const UserLockedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  reason: UserLockedReasonSchema,
  failed_attempts_count: z.number().int().min(0).max(1000),
  locked_at: z.string().datetime(),
  locked_until: z.string().datetime().nullable(),
  locked_by_user_id: z.string().uuid().nullable(),
  notes: z.string().max(2048).nullable(),
});

export type UserLockedPayload = z.infer<typeof UserLockedPayloadSchema>;
