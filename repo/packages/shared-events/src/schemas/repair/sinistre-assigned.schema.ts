import { z } from 'zod';

export const SinistreAssignedPayloadSchema = z.object({
  sinistre_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  expert_id: z.string().uuid(),
  assigned_at: z.string().datetime(),
  assigned_by_user_id: z.string().uuid(),
  expected_visit_date: z.string().date().nullable(),
});

export type SinistreAssignedPayload = z.infer<typeof SinistreAssignedPayloadSchema>;
