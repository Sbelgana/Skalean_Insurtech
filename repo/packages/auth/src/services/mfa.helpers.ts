/**
 * @insurtech/auth/services/mfa.helpers
 *
 * Pure helpers for MFA. Exported for unit testing.
 */

const RECOVERY_CODE_RAW_LENGTH = 12;

/**
 * Formats a 12-char raw recovery code into XXXX-XXXX-XXXX for readability.
 */
export function formatRecoveryCode(raw: string): string {
  if (raw.length !== RECOVERY_CODE_RAW_LENGTH) {
    throw new Error(
      `formatRecoveryCode: expected ${RECOVERY_CODE_RAW_LENGTH} chars, got ${raw.length}`,
    );
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Parses XXXX-XXXX-XXXX back to raw 12-char code. Returns null if invalid.
 * Tolerates user typing without dashes.
 */
export function parseRecoveryCode(formatted: string): string | null {
  if (typeof formatted !== 'string') return null;
  const trimmed = formatted.trim().toUpperCase();
  const m = /^([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/.exec(trimmed);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  if (/^[A-Z0-9]{12}$/.test(trimmed)) return trimmed;
  return null;
}

/** Validates TOTP code format (6 digits). */
export function validateTotpFormat(code: string): boolean {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

/** Returns the TOTP step count for a given timestamp (default 30s steps). */
export function totpStepFor(timestampMs: number, periodSeconds = 30): number {
  return Math.floor(timestampMs / 1000 / periodSeconds);
}

/** Builds the otpauth:// URI per RFC 6238. */
export function buildOtpauthUrl(input: {
  email: string;
  issuer: string;
  secretB32: string;
  digits?: number;
  period?: number;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
}): string {
  const { email, issuer, secretB32 } = input;
  const digits = input.digits ?? 6;
  const period = input.period ?? 30;
  const algorithm = input.algorithm ?? 'SHA1';
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
