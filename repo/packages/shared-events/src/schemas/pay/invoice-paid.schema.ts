import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const InvoicePaidPayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  paid_amount_dirham: MoneyDirhamSchema,
  paid_at: z.string().datetime(),
  transaction_id: z.string().uuid(),
});

export type InvoicePaidPayload = z.infer<typeof InvoicePaidPayloadSchema>;
