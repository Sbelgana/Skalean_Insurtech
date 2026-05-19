import { z } from 'zod';

export const EmailInboundPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_email: z.string().email(),
  to_email: z.string().email(),
  subject: z.string().max(998),
  body_text: z.string().max(65536),
  body_html: z.string().max(262144).nullable(),
  received_at: z.string().datetime(),
  has_attachments: z.boolean(),
  attachment_count: z.number().int().min(0).max(100),
});

export type EmailInboundPayload = z.infer<typeof EmailInboundPayloadSchema>;
