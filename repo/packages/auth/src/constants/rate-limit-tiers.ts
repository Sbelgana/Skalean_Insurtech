/**
 * @insurtech/auth/constants/rate-limit-tiers
 *
 * Rate limits enforced on auth-sensitive endpoints (Sprint 5 Tache 2.1.14).
 * All values are tuples [limit, window_seconds].
 */

export const RATE_LIMIT_TIERS = Object.freeze({
  login: Object.freeze({ limit: 5, window_seconds: 60, tracker: 'ip+email' as const }),
  signup: Object.freeze({ limit: 3, window_seconds: 3600, tracker: 'ip' as const }),
  recovery: Object.freeze({ limit: 3, window_seconds: 3600, tracker: 'email' as const }),
  resend_verification: Object.freeze({ limit: 3, window_seconds: 3600, tracker: 'email' as const }),
  refresh: Object.freeze({ limit: 30, window_seconds: 60, tracker: 'user' as const }),
  mfa_verify: Object.freeze({ limit: 10, window_seconds: 60, tracker: 'ip+email' as const }),
});

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;
export type RateLimitTracker = 'ip' | 'email' | 'ip+email' | 'user';
