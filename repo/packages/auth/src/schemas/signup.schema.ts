/**
 * @insurtech/auth/schemas/signup
 *
 * Zod schema for /api/v1/auth/signup endpoint payload (Sprint 5 Tache 2.1.9).
 *
 * Conventions :
 *   - .strict() rejects unknown fields (mass assignment defense).
 *   - email regex restricted to ASCII RFC 5321 simplified (anti homograph).
 *   - password : min 12, 1 upper / 1 lower / 1 digit / 1 special.
 *   - locale enum : fr-MA / ar-MA / en / fr-FR.
 *   - accepted_tos must be literal true.
 */

import { z } from 'zod';
import { EMAIL_REGEX } from '../constants/email-regex.js';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,128}$/;

export const signupSchema = z
  .object({
    email: z
      .string({ required_error: 'email is required', invalid_type_error: 'email must be a string' })
      .trim()
      .toLowerCase()
      .min(5, 'email is too short')
      .max(254, 'email is too long')
      .regex(EMAIL_REGEX, 'email format is invalid (ASCII only)'),
    password: z
      .string({ required_error: 'password is required' })
      .min(12, 'password must be at least 12 characters long')
      .max(128, 'password is too long (max 128)')
      .regex(
        PASSWORD_REGEX,
        'password must contain 1 uppercase, 1 lowercase, 1 digit, 1 special character',
      ),
    display_name: z
      .string({ required_error: 'display_name is required' })
      .trim()
      .min(2, 'display_name is too short')
      .max(64, 'display_name is too long')
      .regex(/^[\p{L}\p{N} '.\-]+$/u, 'display_name contains invalid characters'),
    locale: z.enum(['fr-MA', 'ar-MA', 'en', 'fr-FR'], {
      required_error: 'locale is required',
      invalid_type_error: 'locale must be one of fr-MA, ar-MA, en, fr-FR',
    }),
    accepted_tos: z.literal(true, {
      errorMap: () => ({
        message: 'accepted_tos must be true (terms of service must be accepted)',
      }),
    }),
    invitation_token: z.string().min(20).max(200).optional(),
    requested_role: z.enum(['broker_admin', 'garage_admin', 'assure', 'prospect']).optional(),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

export function parseSignup(input: unknown): SignupInput {
  return signupSchema.parse(input);
}

export function safeParseSignup(
  input: unknown,
): { success: true; data: SignupInput } | { success: false; errors: z.ZodIssue[] } {
  const result = signupSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues };
}
