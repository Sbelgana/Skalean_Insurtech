import { z } from 'zod';

export const EmployeeOffboardedPayloadSchema = z.object({
  employee_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  termination_date: z.string().date(),
  reason: z.enum(['resignation', 'termination_with_cause', 'termination_without_cause', 'retirement', 'mutual_agreement']),
  offboarded_at: z.string().datetime(),
  by_user_id: z.string().uuid(),
});

export type EmployeeOffboardedPayload = z.infer<typeof EmployeeOffboardedPayloadSchema>;
