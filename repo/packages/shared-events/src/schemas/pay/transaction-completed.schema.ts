import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const TransactionCompletedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  amount_dirham: MoneyDirhamSchema,
  provider: z.enum(['cmi', 'naps', 'stripe', 'paypal', 'cash', 'bank_transfer']),
  provider_transaction_id: z.string().max(256),
  related_resource_type: z.enum(['invoice', 'policy', 'booking', 'subscription', 'manual']),
  related_resource_id: z.string().uuid(),
  completed_at: z.string().datetime(),
  fees_dirham: MoneyDirhamSchema.nullable(),
});

export type TransactionCompletedPayload = z.infer<typeof TransactionCompletedPayloadSchema>;
