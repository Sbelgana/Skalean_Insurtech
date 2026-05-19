import { z } from 'zod';

export const BookingCreatedPayloadSchema = z.object({
  booking_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  resource_id: z.string().uuid(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
});

export type BookingCreatedPayload = z.infer<typeof BookingCreatedPayloadSchema>;
