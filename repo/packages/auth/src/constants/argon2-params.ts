/**
 * @insurtech/auth/constants/argon2-params
 *
 * Frozen Argon2id parameters (OWASP Password Storage Cheat Sheet 2024).
 * NEVER weaken without a security review and a corresponding decision-XXX file.
 *
 * Reference :
 *   - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 *   - decision-013 (Argon2id over bcrypt)
 *   - Sprint 5 Tache 2.1.2 (Argon2Service implementation using @node-rs/argon2)
 *   - Sprint 33 (pentest review of all crypto params)
 */

export const ARGON2_PARAMS = Object.freeze({
  algorithm: 'argon2id' as const,
  memoryCost: 65536 as const,
  timeCost: 3 as const,
  parallelism: 4 as const,
  hashLength: 32 as const,
  saltLength: 16 as const,
  version: 0x13 as const,
});

export type Argon2Params = typeof ARGON2_PARAMS;

export const PASSWORD_POLICY = Object.freeze({
  minLength: 12 as const,
  maxLength: 128 as const,
  requireUppercase: true as const,
  requireLowercase: true as const,
  requireDigit: true as const,
  requireSpecial: true as const,
  banlistEnabled: true as const,
  banlistFile: 'data/banned-passwords.json' as const,
  similarityThreshold: 5 as const,
  rejectIfContainsEmailLocal: true as const,
  rejectIfContainsDisplayName: true as const,
});

export type PasswordPolicy = typeof PASSWORD_POLICY;

export const PASSWORD_REGEX_DESCRIPTION =
  'Min 12 chars, at least 1 uppercase letter, 1 lowercase letter, 1 digit, 1 special character. Max 128 chars.';
