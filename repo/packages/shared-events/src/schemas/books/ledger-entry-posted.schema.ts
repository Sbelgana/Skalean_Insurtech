import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const LedgerEntryPostedPayloadSchema = z.object({
  entry_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  account_code: z.string().min(1).max(20),
  debit_dirham: MoneyDirhamSchema,
  credit_dirham: MoneyDirhamSchema,
  description: z.string().max(500),
  posted_at: z.string().datetime(),
  posted_by_user_id: z.string().uuid(),
  period_id: z.string().uuid(),
});

export type LedgerEntryPostedPayload = z.infer<typeof LedgerEntryPostedPayloadSchema>;
