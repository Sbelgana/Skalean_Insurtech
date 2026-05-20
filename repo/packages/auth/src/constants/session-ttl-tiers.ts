/**
 * @insurtech/auth/constants/session-ttl-tiers
 *
 * Session TTLs consumed by Sprint 5 Tache 2.1.5 SessionService.
 */

export const SESSION_TTL_TIERS = Object.freeze({
  default_seconds: 8 * 60 * 60,
  remember_me_seconds: 30 * 24 * 60 * 60,
  mfa_pending_seconds: 5 * 60,
  service_token_seconds: 5 * 60,
});

export type SessionTtlTiers = typeof SESSION_TTL_TIERS;
