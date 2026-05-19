import { z } from 'zod';

export const BookingCancelledPayloadSchema = z.object({
  booking_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  cancelled_at: z.string().datetime(),
  cancelled_by_user_id: z.string().uuid(),
  reason: z.enum(['user_request', 'no_show', 'admin_action', 'system_timeout']),
  refund_issued: z.boolean(),
});

export type BookingCancelledPayload = z.infer<typeof BookingCancelledPayloadSchema>;
