import { z } from 'zod';
import { LocaleSchema } from '../../types/shared/locale.js';

export const UserCreatedPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email().max(320),
  full_name: z.string().min(1).max(200),
  role: z.enum(['super_admin', 'admin', 'manager', 'agent', 'viewer']),
  locale: LocaleSchema,
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid().nullable(),
  invitation_token_hash: z.string().nullable(),
});

export type UserCreatedPayload = z.infer<typeof UserCreatedPayloadSchema>;
