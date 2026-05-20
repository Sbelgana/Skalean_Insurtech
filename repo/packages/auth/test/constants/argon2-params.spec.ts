/**
 * Tests for @insurtech/auth/constants/argon2-params
 */

import { describe, it, expect } from 'vitest';
import { ARGON2_PARAMS, PASSWORD_POLICY } from '../../src/constants/argon2-params.js';

describe('ARGON2_PARAMS', () => {
  it('uses argon2id algorithm', () => {
    expect(ARGON2_PARAMS.algorithm).toBe('argon2id');
  });

  it('meets OWASP 2024 minimums', () => {
    expect(ARGON2_PARAMS.memoryCost).toBeGreaterThanOrEqual(65536);
    expect(ARGON2_PARAMS.timeCost).toBeGreaterThanOrEqual(3);
    expect(ARGON2_PARAMS.parallelism).toBeGreaterThanOrEqual(1);
    expect(ARGON2_PARAMS.hashLength).toBeGreaterThanOrEqual(32);
    expect(ARGON2_PARAMS.saltLength).toBeGreaterThanOrEqual(16);
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(ARGON2_PARAMS)).toBe(true);
    expect(() => {
      (ARGON2_PARAMS as unknown as { memoryCost: number }).memoryCost = 1024;
    }).toThrow();
  });
});

describe('PASSWORD_POLICY', () => {
  it('mandates strict criteria', () => {
    expect(PASSWORD_POLICY.minLength).toBeGreaterThanOrEqual(12);
    expect(PASSWORD_POLICY.requireUppercase).toBe(true);
    expect(PASSWORD_POLICY.requireLowercase).toBe(true);
    expect(PASSWORD_POLICY.requireDigit).toBe(true);
    expect(PASSWORD_POLICY.requireSpecial).toBe(true);
    expect(PASSWORD_POLICY.banlistEnabled).toBe(true);
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(PASSWORD_POLICY)).toBe(true);
  });
});
