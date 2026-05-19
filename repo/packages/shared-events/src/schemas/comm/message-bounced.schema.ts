import { z } from 'zod';

export const MessageBouncedPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  bounced_at: z.string().datetime(),
  bounce_type: z.enum(['hard', 'soft', 'spam', 'block']),
  diagnostic_code: z.string().max(2048).nullable(),
});

export type MessageBouncedPayload = z.infer<typeof MessageBouncedPayloadSchema>;
