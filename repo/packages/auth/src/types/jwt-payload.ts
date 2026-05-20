/**
 * @insurtech/auth/types/jwt-payload
 *
 * Strict JWT payload contracts for access tokens, refresh tokens, and service tokens.
 *
 * Reference :
 *   - RFC 7519 (JSON Web Token)
 *   - decision-014 (JWT HS256 Sprint 5, RS256 Sprint 14+)
 *   - Sprint 5 Tache 2.1.4 (JwtService)
 *   - Sprint 6 Tache (TenantContextService consumes tenant_id)
 *   - Sprint 31 (ServiceJwtPayload for Sky agent)
 */

import type { AuthRole } from './auth-roles.js';

/**
 * Standard JWT claims (RFC 7519) plus Skalean InsurTech extensions.
 * All times are seconds since Unix epoch (NEVER milliseconds).
 */
export interface JwtPayload {
  /** Subject : user_id (UUID v4) of the authenticated user. */
  sub: string;

  /** Tenant_id (UUID v4) for tenant-scoped roles. NULL for platform-level roles. */
  tenant_id: string | null;

  /** Email of the user (denormalized for log readability). */
  email: string;

  /** Authenticated role (one of 12 AuthRole values). */
  role: AuthRole;

  /** Whether MFA challenge has been completed within this session. */
  mfa_verified: boolean;

  /** JWT ID -- unique per token (UUID v4). Used for revocation tracking. */
  jti: string;

  /** Session ID (UUID v4) -- groups multiple JWT ids of the same login session. */
  sid: string;

  /** Issuer -- always "skalean-insurtech-api" for the api app. */
  iss: string;

  /** Audience -- "skalean-insurtech-app" for end-user tokens. */
  aud: string;

  /** Issued at (Unix seconds). */
  iat: number;

  /** Expires at (Unix seconds). For access tokens: iat + 900 (15 min). */
  exp: number;

  /** Not before (Unix seconds). Always equal to iat for Skalean InsurTech. */
  nbf: number;
}

/**
 * Refresh token payload. Stored hashed (SHA-256) in Redis.
 * Carries fewer fields than access JWT to minimize blast radius if leaked.
 */
export interface RefreshTokenPayload {
  /** Subject : user_id. */
  sub: string;

  /** Session ID (groups access + refresh of the same login). */
  sid: string;

  /**
   * Token family ID (UUID v4) shared by all refresh tokens of the same login.
   * Rotation pattern : new refresh issued with same family + invalidate previous.
   * If a rotated-out refresh is presented again (theft replay), the whole family is revoked.
   * RFC 6749 best practice "Refresh Token Rotation with Theft Detection".
   */
  token_family: string;

  /** Generation counter within the family (1, 2, 3, ...). Latest valid generation is stored in Redis. */
  generation: number;

  /** JWT ID for this specific refresh token. */
  jti: string;

  /** Issued at (Unix seconds). */
  iat: number;

  /** Expires at (Unix seconds). For refresh tokens: iat + 2592000 (30 days). */
  exp: number;

  /** Issuer. */
  iss: string;
}

/**
 * Service-to-service JWT payload (Sprint 31, Sky agent).
 * Distinct from user JWT to avoid privilege confusion.
 */
export interface ServiceJwtPayload {
  /** Service identifier (e.g., "sky-agent", "mcp-server"). */
  sub: string;

  /** Service kind discriminator. */
  service: 'sky' | 'mcp' | 'comm-worker' | 'sched-worker';

  /** Tenant scope (null for cross-tenant services like sky-agent). */
  tenant_id: string | null;

  /** Allowed scopes (Sprint 31 capability tokens). */
  scopes: readonly string[];

  /** JWT ID. */
  jti: string;

  /** Issued at (Unix seconds). */
  iat: number;

  /** Expires at (Unix seconds). Service tokens have shorter TTL (5 min default). */
  exp: number;

  /** Issuer. */
  iss: string;

  /** Audience. */
  aud: string;
}

/** Discriminated union for any JWT type seen by the api. */
export type AnyJwtPayload = JwtPayload | ServiceJwtPayload;

/** Type guard distinguishing user JWT from service JWT at runtime. */
export function isServiceJwtPayload(payload: AnyJwtPayload): payload is ServiceJwtPayload {
  return 'service' in payload;
}

/** Type guard for user JWT. */
export function isUserJwtPayload(payload: AnyJwtPayload): payload is JwtPayload {
  return !('service' in payload);
}

/**
 * Returns current time as Unix seconds (NEVER milliseconds).
 * JWT spec (RFC 7519 section 2) defines NumericDate as seconds since 1970-01-01T00:00:00Z UTC.
 */
export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Computes expiry as Unix seconds = now + ttl.
 * @param ttlSeconds Time-to-live in seconds (NEVER milliseconds).
 */
export function expirySeconds(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(`expirySeconds: ttlSeconds must be a positive finite number, got ${ttlSeconds}`);
  }
  return nowInSeconds() + Math.floor(ttlSeconds);
}

/**
 * Returns true if the payload's exp claim is in the past (token is expired).
 * Adds optional leeway (default 5 seconds) for clock skew between issuer and verifier.
 */
export function isExpired(payload: { exp: number }, leewaySeconds = 5): boolean {
  return payload.exp + leewaySeconds < nowInSeconds();
}
