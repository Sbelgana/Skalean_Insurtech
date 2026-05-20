/**
 * Tests for @insurtech/auth/constants/lockout-tiers + helper getLockoutDurationMs.
 */

import { describe, it, expect } from 'vitest';
import {
  LOCKOUT_TIERS,
  MAX_FAILED_ATTEMPTS_BEFORE_TIER_UP,
} from '../../src/constants/lockout-tiers.js';
import { getLockoutDurationMs } from '../../src/types/lockout.js';

describe('LOCKOUT_TIERS', () => {
  it('tier 1 is 5 minutes', () => {
    expect(LOCKOUT_TIERS[1].duration_ms).toBe(5 * 60 * 1000);
  });

  it('tier 2 is 15 minutes', () => {
    expect(LOCKOUT_TIERS[2].duration_ms).toBe(15 * 60 * 1000);
  });

  it('tier 3 is 60 minutes', () => {
    expect(LOCKOUT_TIERS[3].duration_ms).toBe(60 * 60 * 1000);
  });

  it('tier 4 is permanent', () => {
    expect(LOCKOUT_TIERS[4].duration_ms).toBe(Number.POSITIVE_INFINITY);
  });

  it('max attempts before tier-up is 5', () => {
    expect(MAX_FAILED_ATTEMPTS_BEFORE_TIER_UP).toBe(5);
  });
});

describe('getLockoutDurationMs helper', () => {
  it('returns same values as LOCKOUT_TIERS', () => {
    expect(getLockoutDurationMs(1)).toBe(LOCKOUT_TIERS[1].duration_ms);
    expect(getLockoutDurationMs(2)).toBe(LOCKOUT_TIERS[2].duration_ms);
    expect(getLockoutDurationMs(3)).toBe(LOCKOUT_TIERS[3].duration_ms);
    expect(getLockoutDurationMs(4)).toBe(LOCKOUT_TIERS[4].duration_ms);
  });
});
