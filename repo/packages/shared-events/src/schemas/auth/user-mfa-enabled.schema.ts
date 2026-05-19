import { z } from 'zod';

export const UserMfaEnabledPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  mfa_method: z.enum(['totp', 'sms', 'email', 'hardware_key']),
  enabled_at: z.string().datetime(),
  backup_codes_generated: z.boolean(),
});

export type UserMfaEnabledPayload = z.infer<typeof UserMfaEnabledPayloadSchema>;
