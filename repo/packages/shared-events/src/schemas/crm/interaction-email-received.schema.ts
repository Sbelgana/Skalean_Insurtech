import { z } from 'zod';

export const InteractionEmailReceivedPayloadSchema = z.object({
  interaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  from_email: z.string().email(),
  to_email: z.string().email(),
  subject: z.string().max(998),
  message_id_header: z.string().max(998),
  in_reply_to: z.string().nullable(),
  received_at: z.string().datetime(),
  body_excerpt: z.string().max(2048),
  has_attachments: z.boolean(),
});

export type InteractionEmailReceivedPayload = z.infer<typeof InteractionEmailReceivedPayloadSchema>;
