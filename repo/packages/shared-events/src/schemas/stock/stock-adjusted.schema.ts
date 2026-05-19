import { z } from 'zod';

export const StockAdjustedPayloadSchema = z.object({
  adjustment_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity_delta: z.number().int(),
  reason: z.enum(['inventory_count', 'damaged', 'lost', 'returned', 'manual_correction']),
  adjusted_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type StockAdjustedPayload = z.infer<typeof StockAdjustedPayloadSchema>;
