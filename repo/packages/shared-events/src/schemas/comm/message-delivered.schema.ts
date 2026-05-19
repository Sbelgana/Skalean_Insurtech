import { z } from 'zod';

export const MessageDeliveredPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  delivered_at: z.string().datetime(),
  provider_callback_id: z.string().max(256).nullable(),
});

export type MessageDeliveredPayload = z.infer<typeof MessageDeliveredPayloadSchema>;
