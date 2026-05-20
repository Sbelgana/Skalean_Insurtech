/**
 * Tests for @insurtech/auth/constants/rate-limit-tiers
 */

import { describe, it, expect } from 'vitest';
import { RATE_LIMIT_TIERS } from '../../src/constants/rate-limit-tiers.js';

describe('RATE_LIMIT_TIERS', () => {
  it('login : 5 per 60s tracked by ip+email', () => {
    expect(RATE_LIMIT_TIERS.login.limit).toBe(5);
    expect(RATE_LIMIT_TIERS.login.window_seconds).toBe(60);
    expect(RATE_LIMIT_TIERS.login.tracker).toBe('ip+email');
  });

  it('signup : 3 per hour tracked by ip', () => {
    expect(RATE_LIMIT_TIERS.signup.limit).toBe(3);
    expect(RATE_LIMIT_TIERS.signup.window_seconds).toBe(3600);
    expect(RATE_LIMIT_TIERS.signup.tracker).toBe('ip');
  });

  it('recovery : 3 per hour tracked by email', () => {
    expect(RATE_LIMIT_TIERS.recovery.limit).toBe(3);
    expect(RATE_LIMIT_TIERS.recovery.tracker).toBe('email');
  });

  it('all tiers are frozen', () => {
    expect(Object.isFrozen(RATE_LIMIT_TIERS)).toBe(true);
    expect(Object.isFrozen(RATE_LIMIT_TIERS.login)).toBe(true);
  });
});
