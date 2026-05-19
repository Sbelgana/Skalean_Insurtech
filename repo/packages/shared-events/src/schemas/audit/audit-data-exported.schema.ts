import { z } from 'zod';

export const AuditDataExportedPayloadSchema = z.object({
  audit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  actor_user_id: z.string().uuid(),
  resource_type: z.string().min(1).max(50),
  export_format: z.enum(['csv', 'xlsx', 'json', 'pdf']),
  row_count: z.number().int().min(0),
  exported_at: z.string().datetime(),
  filters_applied: z.record(z.string(), z.unknown()),
});

export type AuditDataExportedPayload = z.infer<typeof AuditDataExportedPayloadSchema>;
