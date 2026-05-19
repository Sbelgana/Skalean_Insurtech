import { z } from 'zod';

export const ContactUpdatedPayloadSchema = z.object({
  contact_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  updated_fields: z.array(z.string()).min(1),
  previous_values: z.record(z.string(), z.unknown()),
  new_values: z.record(z.string(), z.unknown()),
  updated_at: z.string().datetime(),
  updated_by_user_id: z.string().uuid(),
});

export type ContactUpdatedPayload = z.infer<typeof ContactUpdatedPayloadSchema>;
