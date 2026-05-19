import { z } from 'zod';

export const PeriodClosedPayloadSchema = z.object({
  period_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  period_start: z.string().date(),
  period_end: z.string().date(),
  closed_at: z.string().datetime(),
  closed_by_user_id: z.string().uuid(),
  total_entries: z.number().int().min(0),
});

export type PeriodClosedPayload = z.infer<typeof PeriodClosedPayloadSchema>;
