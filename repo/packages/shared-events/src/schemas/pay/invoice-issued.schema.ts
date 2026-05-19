import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const InvoiceIssuedPayloadSchema = z.object({
  invoice_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  invoice_number: z.string().min(1).max(50),
  total_amount_dirham: MoneyDirhamSchema,
  vat_amount_dirham: MoneyDirhamSchema,
  due_date: z.string().date(),
  issued_at: z.string().datetime(),
  issued_by_user_id: z.string().uuid(),
});

export type InvoiceIssuedPayload = z.infer<typeof InvoiceIssuedPayloadSchema>;
