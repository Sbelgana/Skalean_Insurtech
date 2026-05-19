import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const SinistreClosedPayloadSchema = z.object({
  sinistre_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  closed_at: z.string().datetime(),
  closed_by_user_id: z.string().uuid(),
  outcome: z.enum(['indemnise', 'rejete', 'desiste', 'classe_sans_suite']),
  indemnity_amount_dirham: MoneyDirhamSchema.nullable(),
});

export type SinistreClosedPayload = z.infer<typeof SinistreClosedPayloadSchema>;
