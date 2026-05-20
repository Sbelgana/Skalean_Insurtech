/**
 * @insurtech/auth/constants/jwt-params
 *
 * Frozen JWT parameters consumed by Sprint 5 Tache 2.1.4 JwtService.
 * Sprint 5 uses HS256 (symmetric). Sprint 14 migrates to RS256 with key rotation (decision-014).
 */

export const JWT_PARAMS = Object.freeze({
  algorithm: 'HS256' as const,
  issuer: 'skalean-insurtech-api' as const,
  audience: 'skalean-insurtech-app' as const,
  ttl_access_seconds: 900 as const,
  ttl_refresh_seconds: 2592000 as const,
  ttl_service_seconds: 300 as const,
  ttl_mfa_challenge_seconds: 300 as const,
  leeway_seconds: 5 as const,
});

export type JwtParams = typeof JWT_PARAMS;

export const JWT_DESCRIPTION =
  'HS256 Sprint 5 (migrating to RS256 Sprint 14). Access TTL 15min, Refresh TTL 30d, MFA challenge TTL 5min.';

/** Symbolic key kinds for JwtService (Sprint 5 Tache 2.1.4 distinguishes access vs refresh secrets). */
export type JwtKeyKind = 'access' | 'refresh' | 'mfa_challenge' | 'service';
