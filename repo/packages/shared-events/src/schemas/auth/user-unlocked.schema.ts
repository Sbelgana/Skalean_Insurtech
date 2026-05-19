import { z } from 'zod';

export const UserUnlockedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  unlocked_at: z.string().datetime(),
  unlocked_by_user_id: z.string().uuid().nullable(),
  unlock_method: z.enum(['admin_action', 'auto_timeout_expired', 'self_service_email_link']),
});

export type UserUnlockedPayload = z.infer<typeof UserUnlockedPayloadSchema>;
