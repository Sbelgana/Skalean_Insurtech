import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const PolicySignedPayloadSchema = z.object({
  policy_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  assureur_id: z.string().uuid(),
  product_code: z.string().min(1).max(50),
  premium_dirham: MoneyDirhamSchema,
  coverage_start_date: z.string().date(),
  coverage_end_date: z.string().date(),
  signed_at: z.string().datetime(),
  signed_by_user_id: z.string().uuid(),
  policy_number: z.string().min(1).max(50),
});

export type PolicySignedPayload = z.infer<typeof PolicySignedPayloadSchema>;
