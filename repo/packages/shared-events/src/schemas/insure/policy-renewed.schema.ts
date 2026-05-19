import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const PolicyRenewedPayloadSchema = z.object({
  policy_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  previous_policy_id: z.string().uuid(),
  premium_dirham: MoneyDirhamSchema,
  new_coverage_start_date: z.string().date(),
  new_coverage_end_date: z.string().date(),
  renewed_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type PolicyRenewedPayload = z.infer<typeof PolicyRenewedPayloadSchema>;
