import { z } from 'zod';

export const AuditAccessDeniedPayloadSchema = z.object({
  audit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable(),
  attempted_action: z.string().min(1).max(100),
  resource_type: z.string().min(1).max(50),
  resource_id: z.string().uuid().nullable(),
  reason: z.enum(['rbac_denied', 'tenant_mismatch', 'rate_limited', 'session_expired', 'mfa_required']),
  occurred_at: z.string().datetime(),
  ip_address: z.string().nullable(),
});

export type AuditAccessDeniedPayload = z.infer<typeof AuditAccessDeniedPayloadSchema>;
