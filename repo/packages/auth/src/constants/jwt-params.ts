/**
 * @insurtech/auth/constants/jwt-params
 *
 * Frozen JWT parameters consumed by Sprint 5 Tache 2.1.4 JwtService.
 * Sprint 5 uses RS256 asymmetric (private/public RSA key pair).
 * Sprint 14 introduces JWT key rotation 90 days with kid header.
 *
 * RS256 over HS256 :
 *   - Asymmetric : private key signs, public key verifies (no shared secret)
 *   - Verifiers (microservices, gateways) only need the public key
 *   - Compromise of a verifier never compromises signing capability
 *   - Aligned with OWASP JWT Cheat Sheet 2024 recommendation for prod systems
 */

export const JWT_PARAMS = Object.freeze({
  algorithm: 'RS256' as const,
  issuer: 'skalean-insurtech-api' as const,
  audience: 'skalean-insurtech-app' as const,
  ttl_access_seconds: 900 as const,
  ttl_refresh_seconds: 2592000 as const,
  ttl_service_seconds: 300 as const,
  ttl_mfa_challenge_seconds: 300 as const,
  leeway_seconds: 5 as const,
  rsa_modulus_bits: 2048 as const,
});

export type JwtParams = typeof JWT_PARAMS;

export const JWT_DESCRIPTION =
  'RS256 asymmetric (2048-bit RSA). Access TTL 15min, Refresh TTL 30d, MFA challenge TTL 5min.';

/** Symbolic key kinds for JwtService (Sprint 5 Tache 2.1.4 distinguishes access vs refresh issuance). */
export type JwtKeyKind = 'access' | 'refresh' | 'mfa_challenge' | 'service';
