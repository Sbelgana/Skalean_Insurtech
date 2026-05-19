import { z } from 'zod';

export const TransactionFailedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  failed_at: z.string().datetime(),
  error_code: z.string().max(50),
  error_message: z.string().max(2048),
  is_retryable: z.boolean(),
});

export type TransactionFailedPayload = z.infer<typeof TransactionFailedPayloadSchema>;
