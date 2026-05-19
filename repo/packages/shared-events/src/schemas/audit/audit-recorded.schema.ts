import { z } from 'zod';

export const AuditRecordedPayloadSchema = z.object({
  audit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  action: z.string().min(1).max(100),
  resource_type: z.string().min(1).max(50),
  resource_id: z.string().uuid().nullable(),
  occurred_at: z.string().datetime(),
  ip_address: z.string().nullable(),
  user_agent: z.string().max(1024).nullable(),
  before_state: z.unknown().nullable(),
  after_state: z.unknown().nullable(),
});

export type AuditRecordedPayload = z.infer<typeof AuditRecordedPayloadSchema>;
