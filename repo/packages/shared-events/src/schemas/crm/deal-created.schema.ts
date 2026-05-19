import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const DealCreatedPayloadSchema = z.object({
  deal_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  stage: z.string().min(1).max(100),
  amount_dirham: MoneyDirhamSchema,
  expected_close_date: z.string().date(),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
});

export type DealCreatedPayload = z.infer<typeof DealCreatedPayloadSchema>;
