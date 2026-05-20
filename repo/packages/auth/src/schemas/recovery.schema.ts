/**
 * @insurtech/auth/schemas/recovery
 *
 * Zod schemas for /api/v1/auth/forgot-password and /reset-password (Sprint 5 Tache 2.1.11).
 *
 * Convention :
 *   - Recovery tokens TTL = 1h (vs 24h email-verify) -- more sensitive.
 *   - Anti-enumeration : recoveryRequestSchema returns same response whether email exists or not.
 *   - new_password must match same policy as signup.
 */

import { z } from 'zod';
import { EMAIL_REGEX } from '../constants/email-regex.js';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,128}$/;

export const recoveryRequestSchema = z
  .object({
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .toLowerCase()
      .min(5)
      .max(254)
      .regex(EMAIL_REGEX, 'email format is invalid'),
  })
  .strict();
export type RecoveryRequestInput = z.infer<typeof recoveryRequestSchema>;

export const recoveryConfirmSchema = z
  .object({
    recovery_token: z
      .string({ required_error: 'recovery_token is required' })
      .min(40, 'recovery_token is too short')
      .max(500, 'recovery_token is too long'),
    new_password: z
      .string({ required_error: 'new_password is required' })
      .min(12, 'new_password must be at least 12 characters long')
      .max(128, 'new_password is too long')
      .regex(PASSWORD_REGEX, 'new_password must contain 1 upper, 1 lower, 1 digit, 1 special'),
  })
  .strict();
export type RecoveryConfirmInput = z.infer<typeof recoveryConfirmSchema>;
