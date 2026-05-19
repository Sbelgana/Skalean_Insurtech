import { z } from 'zod';

export const QuoteRequestedPayloadSchema = z.object({
  quote_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  product_code: z.string().min(1).max(50),
  requested_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
  parameters: z.record(z.string(), z.unknown()),
});

export type QuoteRequestedPayload = z.infer<typeof QuoteRequestedPayloadSchema>;
