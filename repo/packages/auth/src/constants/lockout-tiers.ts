/**
 * @insurtech/auth/constants/lockout-tiers
 *
 * Progressive lockout tiers consumed by Sprint 5 Tache 2.1.10 LockoutService.
 * Tier escalates with each consecutive failed-login burst.
 */

import type { LockoutTier } from '../types/lockout.js';

export const LOCKOUT_TIERS = Object.freeze({
  1: Object.freeze({ duration_ms: 5 * 60 * 1000, label: '5min' }),
  2: Object.freeze({ duration_ms: 15 * 60 * 1000, label: '15min' }),
  3: Object.freeze({ duration_ms: 60 * 60 * 1000, label: '60min' }),
  4: Object.freeze({ duration_ms: Number.POSITIVE_INFINITY, label: 'permanent' }),
}) as Readonly<Record<LockoutTier, Readonly<{ duration_ms: number; label: string }>>>;

export const MAX_FAILED_ATTEMPTS_BEFORE_TIER_UP = 5 as const;

/** Resets failed-attempt counter to 0 if no failure within this window (24h). */
export const RESET_FAILED_COUNT_AFTER_MS = 24 * 60 * 60 * 1000;

export const LOCKOUT_DESCRIPTION =
  '5 fails -> tier 1 (5min), 5 more -> tier 2 (15min), 5 more -> tier 3 (60min), 5 more -> tier 4 (permanent).';
