import { z } from 'zod';

export const SystemHealthChangedPayloadSchema = z.object({
  service_name: z.string().min(1).max(100),
  previous_status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  current_status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  changed_at: z.string().datetime(),
  metrics: z.record(z.string(), z.number()),
});

export type SystemHealthChangedPayload = z.infer<typeof SystemHealthChangedPayloadSchema>;
