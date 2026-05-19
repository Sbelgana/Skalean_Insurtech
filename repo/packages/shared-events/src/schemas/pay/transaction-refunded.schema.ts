import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const TransactionRefundedPayloadSchema = z.object({
  transaction_id: z.string().uuid(),
  refund_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  refund_amount_dirham: MoneyDirhamSchema,
  refunded_at: z.string().datetime(),
  reason: z.string().max(2048),
  by_user_id: z.string().uuid(),
});

export type TransactionRefundedPayload = z.infer<typeof TransactionRefundedPayloadSchema>;
