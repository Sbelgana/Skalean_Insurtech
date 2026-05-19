import { z } from 'zod';

export const MoneyDirhamSchema = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Money must be decimal string max 9 digits + 2 decimals')
  .refine((s) => parseFloat(s) >= 0, 'Money must be non-negative')
  .refine((s) => parseFloat(s) <= 999_999_999.99, 'Money exceeds maximum 999_999_999.99');

export type MoneyDirham = z.infer<typeof MoneyDirhamSchema>;
