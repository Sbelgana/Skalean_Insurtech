import { z } from 'zod';

export const SinistreDeclaredPayloadSchema = z.object({
  sinistre_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  declared_at: z.string().datetime(),
  occurred_at: z.string().datetime(),
  description: z.string().min(1).max(4096),
  damage_type: z.enum(['vehicule', 'habitation', 'sante', 'professionnel', 'autre']),
  initial_estimate_dirham: z.string().nullable(),
  declared_by_user_id: z.string().uuid(),
});

export type SinistreDeclaredPayload = z.infer<typeof SinistreDeclaredPayloadSchema>;
