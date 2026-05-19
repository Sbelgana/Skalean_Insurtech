import { z } from 'zod';
import { LocaleSchema, ChannelSchema } from '../../types/shared/locale.js';

export const ContactCreatedPayloadSchema = z.object({
  contact_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  email: z.string().email().nullable(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'E.164 phone format').nullable(),
  preferred_language: LocaleSchema,
  preferred_channel: ChannelSchema,
  source: z.enum(['manual', 'web_form', 'import_csv', 'api', 'whatsapp_inbound', 'referral']),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
});

export type ContactCreatedPayload = z.infer<typeof ContactCreatedPayloadSchema>;
