/**
 * Tests for @insurtech/auth/constants/jwt-params
 */

import { describe, it, expect } from 'vitest';
import { JWT_PARAMS } from '../../src/constants/jwt-params.js';

describe('JWT_PARAMS', () => {
  it('uses RS256 asymmetric in Sprint 5', () => {
    expect(JWT_PARAMS.algorithm).toBe('RS256');
  });

  it('uses 2048-bit RSA modulus', () => {
    expect(JWT_PARAMS.rsa_modulus_bits).toBe(2048);
  });

  it('access TTL is 15 minutes (900 seconds)', () => {
    expect(JWT_PARAMS.ttl_access_seconds).toBe(900);
  });

  it('refresh TTL is 30 days', () => {
    expect(JWT_PARAMS.ttl_refresh_seconds).toBe(30 * 24 * 60 * 60);
  });

  it('mfa challenge TTL is 5 minutes', () => {
    expect(JWT_PARAMS.ttl_mfa_challenge_seconds).toBe(300);
  });

  it('issuer and audience are stable strings', () => {
    expect(JWT_PARAMS.issuer).toBe('skalean-insurtech-api');
    expect(JWT_PARAMS.audience).toBe('skalean-insurtech-app');
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(JWT_PARAMS)).toBe(true);
  });
});
