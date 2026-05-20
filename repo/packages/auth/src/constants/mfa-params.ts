/**
 * @insurtech/auth/constants/mfa-params
 *
 * Frozen MFA TOTP RFC 6238 parameters + recovery codes config.
 * Consumed by Sprint 5 Tache 2.1.7 MfaService.
 */

export const MFA_PARAMS = Object.freeze({
  digits: 6 as const,
  period_seconds: 30 as const,
  algorithm: 'SHA-1' as const,
  issuer: 'Skalean InsurTech' as const,
  window: 1 as const,
  recovery_codes_count: 6 as const,
  recovery_code_length: 10 as const,
  recovery_code_alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' as const,
  secret_length_bytes: 20 as const,
});

export type MfaParams = typeof MFA_PARAMS;

export const MFA_DESCRIPTION =
  'TOTP RFC 6238 SHA-1 6 digits 30s period. 6 recovery codes 10 chars uppercase alnum.';
