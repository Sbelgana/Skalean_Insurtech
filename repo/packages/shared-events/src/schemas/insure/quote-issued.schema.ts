import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const QuoteIssuedPayloadSchema = z.object({
  quote_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  premium_dirham: MoneyDirhamSchema,
  valid_until: z.string().datetime(),
  issued_at: z.string().datetime(),
  assureur_id: z.string().uuid(),
});

export type QuoteIssuedPayload = z.infer<typeof QuoteIssuedPayloadSchema>;
