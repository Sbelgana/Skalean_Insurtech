/**
 * @insurtech/auth/schemas/signin
 *
 * Zod schema for /api/v1/auth/signin endpoint (Sprint 5 Tache 2.1.6).
 *
 * mfa_code/recovery_code are optional at signin :
 *   1. POST /signin (email+password) -> if MFA enabled, returns 200 with { mfa_required: true, mfa_challenge_token }.
 *   2. POST /signin again with mfa_code/recovery_code -> issues tokens.
 * Alternative dedicated flow via POST /verify-mfa (Sprint 5 Tache 2.1.8).
 */

import { z } from 'zod';
import { EMAIL_REGEX } from '../constants/email-regex.js';

export const signinSchema = z
  .object({
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .toLowerCase()
      .min(5)
      .max(254)
      .regex(EMAIL_REGEX, 'email format is invalid'),
    password: z
      .string({ required_error: 'password is required' })
      .min(1, 'password is required')
      .max(128, 'password too long'),
    remember_me: z.boolean().optional().default(false),
    mfa_code: z.string().regex(/^\d{6}$/, 'mfa_code must be exactly 6 digits').optional(),
    recovery_code: z
      .string()
      .regex(/^[A-Z0-9]{10}$/, 'recovery_code must be 10 uppercase alphanumeric characters')
      .optional(),
  })
  .strict()
  .refine((data) => !(data.mfa_code && data.recovery_code), {
    message: 'mfa_code and recovery_code cannot both be provided',
    path: ['mfa_code'],
  });

export type SigninInput = z.infer<typeof signinSchema>;

export function parseSignin(input: unknown): SigninInput {
  return signinSchema.parse(input);
}
