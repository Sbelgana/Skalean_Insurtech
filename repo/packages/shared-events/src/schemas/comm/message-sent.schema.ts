import { z } from 'zod';
import { ChannelSchema } from '../../types/shared/locale.js';

export const MessageSentPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  channel: ChannelSchema,
  to_address: z.string().min(1).max(320),
  from_address: z.string().min(1).max(320).nullable(),
  template_id: z.string().uuid().nullable(),
  provider: z.enum(['twilio', 'meta_whatsapp', 'sendgrid', 'mailjet', 'firebase_fcm', 'apns']),
  provider_message_id: z.string().max(256),
  sent_at: z.string().datetime(),
  related_resource_type: z.string().max(50).nullable(),
  related_resource_id: z.string().uuid().nullable(),
});

export type MessageSentPayload = z.infer<typeof MessageSentPayloadSchema>;
