/**
 * Tests for @insurtech/auth/services/lockout.helpers
 */

import { describe, expect, it } from 'vitest';
import {
  buildIpLockoutKey,
  buildUserLockoutKey,
  computeNextTier,
  lockedUntilForTier,
} from '../../src/services/lockout.helpers.js';

describe('computeNextTier', () => {
  it('returns 0 when below threshold', () => {
    expect(computeNextTier(3, 0)).toBe(0);
    expect(computeNextTier(4, 1)).toBe(1);
  });

  it('escalates 0->1 at 5 attempts', () => {
    expect(computeNextTier(5, 0)).toBe(1);
  });

  it('escalates 1->2, 2->3, 3->4 at threshold', () => {
    expect(computeNextTier(5, 1)).toBe(2);
    expect(computeNextTier(5, 2)).toBe(3);
    expect(computeNextTier(5, 3)).toBe(4);
  });

  it('caps at tier 4', () => {
    expect(computeNextTier(5, 4)).toBe(4);
  });
});

describe('lockedUntilForTier', () => {
  it('tier 1 = +5 minutes', () => {
    expect(lockedUntilForTier(1, 1000)).toBe(1000 + 5 * 60);
  });
  it('tier 2 = +15 minutes', () => {
    expect(lockedUntilForTier(2, 1000)).toBe(1000 + 15 * 60);
  });
  it('tier 3 = +60 minutes', () => {
    expect(lockedUntilForTier(3, 1000)).toBe(1000 + 60 * 60);
  });
  it('tier 4 returns MAX_SAFE_INTEGER', () => {
    expect(lockedUntilForTier(4, 1000)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('key builders', () => {
  it('builds correct lockout keys', () => {
    expect(buildUserLockoutKey('u1')).toBe('lockout:user:u1');
    expect(buildIpLockoutKey('1.2.3.4')).toBe('lockout:ip:1.2.3.4');
  });
});
