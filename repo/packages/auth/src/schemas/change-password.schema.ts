/**
 * @insurtech/auth/schemas/change-password
 *
 * Zod schema for /api/v1/auth/change-password (Sprint 5 Tache 2.1.6).
 * Authenticated endpoint -- requires current_password verification.
 */

import { z } from 'zod';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,128}$/;

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ required_error: 'current_password is required' })
      .min(1, 'current_password is required')
      .max(128, 'current_password is too long'),
    new_password: z
      .string({ required_error: 'new_password is required' })
      .min(12, 'new_password must be at least 12 characters long')
      .max(128, 'new_password is too long')
      .regex(PASSWORD_REGEX, 'new_password must contain 1 upper, 1 lower, 1 digit, 1 special'),
  })
  .strict()
  .refine((data) => data.current_password !== data.new_password, {
    message: 'new_password must differ from current_password',
    path: ['new_password'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
