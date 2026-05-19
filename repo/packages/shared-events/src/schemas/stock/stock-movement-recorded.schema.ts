import { z } from 'zod';

export const StockMovementRecordedPayloadSchema = z.object({
  movement_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  product_id: z.string().uuid(),
  from_warehouse_id: z.string().uuid().nullable(),
  to_warehouse_id: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
  movement_type: z.enum(['receipt', 'shipment', 'transfer', 'return']),
  recorded_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type StockMovementRecordedPayload = z.infer<typeof StockMovementRecordedPayloadSchema>;
