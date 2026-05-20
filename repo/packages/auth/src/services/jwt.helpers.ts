/**
 * @insurtech/auth/services/jwt.helpers
 *
 * Pure helpers for JWT parsing and validation. Exported for unit testing.
 */

import { TokenInvalidError, TokenMissingClaimError } from '../errors/token-errors.js';

const BEARER_REGEX = /^Bearer\s+(\S+)\s*$/i;

/**
 * Parses the Authorization header strictly.
 * Returns null for any non-Bearer scheme or malformed.
 */
export function parseAuthHeader(header: string | undefined | null): string | null {
  if (typeof header !== 'string' || header.length === 0) return null;
  const m = BEARER_REGEX.exec(header.trim());
  return m && m[1] ? m[1] : null;
}

/**
 * Splits a JWT into its 3 base64url segments.
 * Throws TokenInvalidError if not exactly 3 parts.
 */
export function splitJwtSegments(token: string): {
  header: string;
  payload: string;
  signature: string;
} {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TokenInvalidError('empty token');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TokenInvalidError(`expected 3 segments, got ${parts.length}`);
  }
  const header = parts[0];
  const payload = parts[1];
  const signature = parts[2];
  if (!header || !payload || !signature) {
    throw new TokenInvalidError('empty segment');
  }
  return { header, payload, signature };
}

/**
 * Decodes a base64url JWT segment (header or payload) into JSON.
 * Returns null on parse error.
 */
export function decodeSegmentJson<T = Record<string, unknown>>(segment: string): T | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Asserts that all required claims are present.
 * Throws TokenMissingClaimError on absence.
 */
export function assertRequiredClaims(
  payload: Record<string, unknown>,
  required: readonly string[],
): void {
  for (const claim of required) {
    if (!(claim in payload)) {
      throw new TokenMissingClaimError(claim);
    }
  }
}

export const REQUIRED_ACCESS_CLAIMS = Object.freeze([
  'sub',
  'tenant_id',
  'email',
  'role',
  'mfa_verified',
  'jti',
  'sid',
  'iss',
  'aud',
  'iat',
  'exp',
  'nbf',
] as const);

export const REQUIRED_REFRESH_CLAIMS = Object.freeze([
  'sub',
  'sid',
  'token_family',
  'generation',
  'jti',
  'iat',
  'exp',
  'iss',
] as const);
