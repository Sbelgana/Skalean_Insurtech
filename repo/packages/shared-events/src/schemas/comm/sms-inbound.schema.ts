import { z } from 'zod';

export const SmsInboundPayloadSchema = z.object({
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  to_phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  body: z.string().max(1600),
  received_at: z.string().datetime(),
  provider_sms_id: z.string().max(256),
});

export type SmsInboundPayload = z.infer<typeof SmsInboundPayloadSchema>;
