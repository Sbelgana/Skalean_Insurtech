import { z } from 'zod';

export const UserSignedOutPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  signed_out_at: z.string().datetime(),
  reason: z.enum(['user_action', 'session_timeout', 'forced_by_admin', 'token_expired']),
});

export type UserSignedOutPayload = z.infer<typeof UserSignedOutPayloadSchema>;
