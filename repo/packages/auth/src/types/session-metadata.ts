/**
 * @insurtech/auth/types/session-metadata
 *
 * Persisted shape of a session in Redis DB 1 (Sprint 5 Tache 2.1.5).
 */

import type { AuthRole } from './auth-roles.js';

export interface SessionMetadata {
  user_id: string;
  tenant_id: string | null;
  role: AuthRole;
  jti: string;
  refresh_token_family: string;
  refresh_generation: number;
  ip: string;
  user_agent: string;
  mfa_verified: boolean;
  remember_me: boolean;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  locale?: string;
  device_fingerprint?: string;
  geo_country?: string;
}

export interface CreateSessionInput {
  user_id: string;
  tenant_id: string | null;
  role: AuthRole;
  jti: string;
  refresh_token_family: string;
  refresh_generation: number;
  ip: string;
  user_agent: string;
  mfa_verified: boolean;
  remember_me?: boolean;
  locale?: string;
  device_fingerprint?: string;
}

export interface RotateSessionInput {
  old_jti: string;
  new_jti: string;
  expected_generation: number;
  new_generation: number;
  ip: string;
  user_agent: string;
  locale?: string;
}
