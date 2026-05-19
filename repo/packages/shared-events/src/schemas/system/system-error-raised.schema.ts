import { z } from 'zod';

export const SystemErrorRaisedPayloadSchema = z.object({
  error_id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  service_name: z.string().min(1).max(100),
  error_class: z.string().min(1).max(200),
  error_message: z.string().max(2048),
  stack_trace: z.string().max(16384).nullable(),
  occurred_at: z.string().datetime(),
  severity: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
});

export type SystemErrorRaisedPayload = z.infer<typeof SystemErrorRaisedPayloadSchema>;
