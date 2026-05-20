/**
 * @insurtech/auth/types/lockout
 *
 * Shape of a lockout snapshot persisted in Redis DB 2 (LOCKOUTS) by Sprint 5 Tache 2.1.10.
 * Implements progressive lockout : 5 -> 15 -> 60 minutes -> permanent (manual unlock).
 */

export type LockoutTier = 1 | 2 | 3 | 4;

export interface LockoutSnapshot {
  email: string;
  tenant_id: string | null;
  failed_attempts: number;
  current_tier: LockoutTier;
  locked: boolean;
  locked_at: number | null;
  locked_until: number | null;
  last_failure_at: number;
  last_failure_ip: string;
  last_failure_user_agent: string;
}

export interface LockoutDecision {
  allow: boolean;
  reason?: 'locked' | 'tier_up' | 'reset';
  retry_after_seconds?: number;
  next_tier_after_attempts?: number;
}

/**
 * Returns lockout duration in milliseconds for a given tier.
 * Tier 4 returns Number.POSITIVE_INFINITY meaning permanent until manual unlock.
 */
export function getLockoutDurationMs(tier: LockoutTier): number {
  switch (tier) {
    case 1:
      return 5 * 60 * 1000;
    case 2:
      return 15 * 60 * 1000;
    case 3:
      return 60 * 60 * 1000;
    case 4:
      return Number.POSITIVE_INFINITY;
    default: {
      const exhaustive: never = tier;
      throw new Error(`Unhandled LockoutTier: ${String(exhaustive)}`);
    }
  }
}
