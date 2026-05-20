/**
 * @insurtech/auth/services/session.helpers
 *
 * Pure helpers for session keys and serialization. Exported for unit testing.
 */

import type { SessionMetadata } from '../types/session-metadata.js';

const SESSION_KEY_PREFIX = 'session:';
const REVOKED_KEY_PREFIX = 'revoked:';
const USER_SESSIONS_INDEX = 'user_sessions:';
const FAMILY_INDEX = 'family:';

export function buildSessionKey(jti: string): string {
  return `${SESSION_KEY_PREFIX}${jti}`;
}

export function buildRevokedKey(jti: string): string {
  return `${REVOKED_KEY_PREFIX}${jti}`;
}

export function buildUserSessionsKey(userId: string): string {
  return `${USER_SESSIONS_INDEX}${userId}`;
}

export function buildFamilyKey(family: string): string {
  return `${FAMILY_INDEX}${family}`;
}

export function serializeSession(s: SessionMetadata): string {
  return JSON.stringify(s);
}

export function parseSessionRecord(raw: string | null): SessionMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionMetadata;
  } catch {
    return null;
  }
}

export function isExpiredSession(s: SessionMetadata, nowSeconds: number): boolean {
  return s.expires_at < nowSeconds;
}
