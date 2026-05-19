import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const TransactionInitiatedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  amount_dirham: MoneyDirhamSchema,
  provider: z.enum(['cmi', 'naps', 'stripe', 'paypal', 'cash', 'bank_transfer']),
  initiated_at: z.string().datetime(),
  initiated_by_user_id: z.string().uuid().nullable(),
  payment_method_token: z.string().max(256).nullable(),
});

export type TransactionInitiatedPayload = z.infer<typeof TransactionInitiatedPayloadSchema>;
