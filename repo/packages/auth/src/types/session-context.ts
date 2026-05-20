/**
 * @insurtech/auth/types/session-context
 *
 * Shape of a session record stored in Redis DB 1 by Sprint 5 Tache 2.1.5 SessionService.
 */

import type { AuthRole } from './auth-roles.js';

export interface SessionContext {
  session_id: string;
  user_id: string;
  tenant_id: string | null;
  role: AuthRole;
  ip: string;
  user_agent: string;
  refresh_token_family: string;
  refresh_generation: number;
  mfa_verified: boolean;
  remember_me: boolean;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  metadata: {
    locale: string;
    device_fingerprint?: string;
    geo_country?: string;
  };
}

export interface SessionLookupResult {
  found: boolean;
  session?: SessionContext;
  reason?: 'not_found' | 'expired' | 'revoked';
}
