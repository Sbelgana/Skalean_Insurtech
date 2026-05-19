import { z } from 'zod';

export const NotificationPushedPayloadSchema = z.object({
  notification_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().max(200),
  body: z.string().max(2048),
  pushed_at: z.string().datetime(),
  device_token_count: z.number().int().min(0).max(100),
  platform: z.enum(['ios', 'android', 'web']),
});

export type NotificationPushedPayload = z.infer<typeof NotificationPushedPayloadSchema>;
