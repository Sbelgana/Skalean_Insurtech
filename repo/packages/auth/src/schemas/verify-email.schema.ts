/**
 * @insurtech/auth/schemas/verify-email
 *
 * Zod schema for /api/v1/auth/verify-email endpoint (Sprint 5 Tache 2.1.9).
 * Token TTL 24h. One-time use.
 */

import { z } from 'zod';

export const verifyEmailSchema = z
  .object({
    verification_token: z
      .string({ required_error: 'verification_token is required' })
      .min(40, 'verification_token is too short')
      .max(500, 'verification_token is too long'),
  })
  .strict();
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z
  .object({
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .toLowerCase()
      .min(5)
      .max(254),
  })
  .strict();
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
