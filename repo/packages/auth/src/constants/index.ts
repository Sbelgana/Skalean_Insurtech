/**
 * @insurtech/auth/constants
 *
 * Barrel selectif des constants publiques. Aucun export *.
 */

export { ARGON2_PARAMS, PASSWORD_POLICY, PASSWORD_REGEX_DESCRIPTION } from './argon2-params.js';
export type { Argon2Params, PasswordPolicy } from './argon2-params.js';

export { JWT_PARAMS, JWT_DESCRIPTION } from './jwt-params.js';
export type { JwtParams, JwtKeyKind } from './jwt-params.js';

export { MFA_PARAMS, MFA_DESCRIPTION } from './mfa-params.js';
export type { MfaParams } from './mfa-params.js';

export {
  LOCKOUT_TIERS,
  MAX_FAILED_ATTEMPTS_BEFORE_TIER_UP,
  RESET_FAILED_COUNT_AFTER_MS,
  LOCKOUT_DESCRIPTION,
} from './lockout-tiers.js';

export { RATE_LIMIT_TIERS } from './rate-limit-tiers.js';
export type { RateLimitTier, RateLimitTracker } from './rate-limit-tiers.js';

export { SESSION_TTL_TIERS } from './session-ttl-tiers.js';
export type { SessionTtlTiers } from './session-ttl-tiers.js';

export { EMAIL_REGEX, EMAIL_REGEX_DESCRIPTION } from './email-regex.js';
