import { z } from 'zod';

export const UserPasswordResetRequestedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  reset_token_hash: z.string().min(64).max(128),
  requested_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  ip_address: z.string().ip({ version: 'v4' }).or(z.string().ip({ version: 'v6' })),
});

export type UserPasswordResetRequestedPayload = z.infer<typeof UserPasswordResetRequestedPayloadSchema>;
