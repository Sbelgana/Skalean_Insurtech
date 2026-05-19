import { z } from 'zod';

export const EmployeeOnboardedPayloadSchema = z.object({
  employee_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  job_title: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  hire_date: z.string().date(),
  onboarded_at: z.string().datetime(),
  manager_user_id: z.string().uuid().nullable(),
});

export type EmployeeOnboardedPayload = z.infer<typeof EmployeeOnboardedPayloadSchema>;
