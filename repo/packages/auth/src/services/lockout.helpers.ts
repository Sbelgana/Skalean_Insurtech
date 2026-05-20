/**
 * @insurtech/auth/services/lockout.helpers
 *
 * Pure helpers for the lockout service.
 */

import type { LockoutTier } from '../types/lockout.js';

export interface LockoutHashFields {
  failed_attempts: number;
  current_tier: LockoutTier | 0;
  locked_until: number | null;
}

export function computeNextTier(
  currentAttempts: number,
  currentTier: LockoutTier | 0,
  maxFailedPerTier = 5,
): LockoutTier | 0 {
  if (currentAttempts < maxFailedPerTier) return currentTier;
  if (currentTier === 0) return 1;
  if (currentTier === 1) return 2;
  if (currentTier === 2) return 3;
  if (currentTier === 3) return 4;
  return 4;
}

export function lockedUntilForTier(tier: LockoutTier, nowSeconds: number): number {
  const minutes = tier === 1 ? 5 : tier === 2 ? 15 : tier === 3 ? 60 : 0;
  if (tier === 4) return Number.MAX_SAFE_INTEGER;
  return nowSeconds + minutes * 60;
}

export function buildUserLockoutKey(userId: string): string {
  return `lockout:user:${userId}`;
}

export function buildIpLockoutKey(ip: string): string {
  return `lockout:ip:${ip}`;
}
