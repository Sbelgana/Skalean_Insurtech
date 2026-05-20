/**
 * @insurtech/auth/schemas/mfa
 *
 * Schemas for /api/v1/auth/setup-mfa, /verify-mfa, /disable-mfa (Sprint 5 Tache 2.1.7-2.1.8).
 */

import { z } from 'zod';

export const mfaSetupRequestSchema = z
  .object({
    method: z.literal('totp'),
  })
  .strict();
export type MfaSetupRequestInput = z.infer<typeof mfaSetupRequestSchema>;

export const mfaSetupConfirmSchema = z
  .object({
    setup_token: z.string().min(20).max(500),
    totp_code: z.string().regex(/^\d{6}$/, 'totp_code must be 6 digits'),
  })
  .strict();
export type MfaSetupConfirmInput = z.infer<typeof mfaSetupConfirmSchema>;

export const mfaVerifySchema = z
  .object({
    challenge_token: z.string().min(20).max(500),
    totp_code: z.string().regex(/^\d{6}$/).optional(),
    recovery_code: z.string().regex(/^[A-Z0-9]{10}$/).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.totp_code) !== Boolean(data.recovery_code), {
    message: 'Exactly one of totp_code or recovery_code must be provided',
    path: ['totp_code'],
  });
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaDisableSchema = z
  .object({
    current_password: z
      .string()
      .min(12, 'password too short')
      .max(128, 'password too long'),
    totp_code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;

export const mfaRecoveryCodeRegenerateSchema = z
  .object({
    current_password: z.string().min(12).max(128),
    totp_code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type MfaRecoveryCodeRegenerateInput = z.infer<typeof mfaRecoveryCodeRegenerateSchema>;
