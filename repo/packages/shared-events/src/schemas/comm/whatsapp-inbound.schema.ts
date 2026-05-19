import { z } from 'zod';

export const WhatsappInboundPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  to_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  body: z.string().max(4096),
  media_url: z.string().url().nullable(),
  media_type: z.enum(['image', 'video', 'audio', 'document']).nullable(),
  received_at: z.string().datetime(),
  whatsapp_message_id: z.string().max(256),
});

export type WhatsappInboundPayload = z.infer<typeof WhatsappInboundPayloadSchema>;
