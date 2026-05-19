import { z } from 'zod';
import { ChannelSchema } from '../../types/shared/locale.js';

export const InteractionRecordedPayloadSchema = z.object({
  interaction_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  channel: ChannelSchema,
  direction: z.enum(['inbound', 'outbound']),
  subject: z.string().max(500).nullable(),
  body_excerpt: z.string().max(1024),
  recorded_at: z.string().datetime(),
  by_user_id: z.string().uuid().nullable(),
});

export type InteractionRecordedPayload = z.infer<typeof InteractionRecordedPayloadSchema>;
