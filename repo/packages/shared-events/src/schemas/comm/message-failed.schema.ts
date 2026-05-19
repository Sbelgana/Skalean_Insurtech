import { z } from 'zod';

export const MessageFailedPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  failed_at: z.string().datetime(),
  error_code: z.string().max(50),
  error_message: z.string().max(2048),
  retry_count: z.number().int().min(0).max(20),
});

export type MessageFailedPayload = z.infer<typeof MessageFailedPayloadSchema>;
