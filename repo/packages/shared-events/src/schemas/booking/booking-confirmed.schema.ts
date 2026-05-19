import { z } from 'zod';

export const BookingConfirmedPayloadSchema = z.object({
  booking_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  confirmed_at: z.string().datetime(),
  confirmed_by_user_id: z.string().uuid(),
  notification_sent: z.boolean(),
});

export type BookingConfirmedPayload = z.infer<typeof BookingConfirmedPayloadSchema>;
