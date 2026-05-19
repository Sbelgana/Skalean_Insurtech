import { z } from 'zod';

export const SystemConfigUpdatedPayloadSchema = z.object({
  config_key: z.string().min(1).max(200),
  previous_value: z.unknown().nullable(),
  new_value: z.unknown(),
  updated_at: z.string().datetime(),
  updated_by_user_id: z.string().uuid().nullable(),
});

export type SystemConfigUpdatedPayload = z.infer<typeof SystemConfigUpdatedPayloadSchema>;
