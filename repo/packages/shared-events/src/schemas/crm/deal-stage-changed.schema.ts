import { z } from 'zod';
import { MoneyDirhamSchema } from '../../types/shared/money.js';

export const DealStageChangedPayloadSchema = z.object({
  deal_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  from_stage: z.string().min(1).max(100),
  to_stage: z.string().min(1).max(100),
  amount_dirham: MoneyDirhamSchema,
  by_user_id: z.string().uuid(),
  changed_at: z.string().datetime(),
  reason: z.string().max(2048).nullable(),
});

export type DealStageChangedPayload = z.infer<typeof DealStageChangedPayloadSchema>;
