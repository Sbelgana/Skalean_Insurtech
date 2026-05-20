/**
 * Tests for @insurtech/auth/types/jwt-payload helpers.
 * Sprint 5 Tache 2.1.1
 */

import { describe, it, expect } from 'vitest';
import {
  nowInSeconds,
  expirySeconds,
  isExpired,
  isServiceJwtPayload,
  isUserJwtPayload,
  type JwtPayload,
  type ServiceJwtPayload,
} from '../../src/types/jwt-payload.js';
import { AuthRole } from '../../src/types/auth-roles.js';

describe('nowInSeconds', () => {
  it('returns integer seconds (not milliseconds)', () => {
    const n = nowInSeconds();
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(1_700_000_000);
    expect(n).toBeLessThan(10_000_000_000);
  });
});

describe('expirySeconds', () => {
  it('returns now + ttl', () => {
    const now = nowInSeconds();
    const exp = expirySeconds(900);
    expect(exp - now).toBeGreaterThanOrEqual(900);
    expect(exp - now).toBeLessThanOrEqual(901);
  });

  it('throws on non-positive ttl', () => {
    expect(() => expirySeconds(0)).toThrow();
    expect(() => expirySeconds(-1)).toThrow();
  });

  it('throws on non-finite ttl', () => {
    expect(() => expirySeconds(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => expirySeconds(Number.NaN)).toThrow();
  });
});

describe('isExpired', () => {
  it('returns true when exp is in the past', () => {
    expect(isExpired({ exp: nowInSeconds() - 100 })).toBe(true);
  });

  it('returns false within leeway', () => {
    expect(isExpired({ exp: nowInSeconds() - 3 }, 5)).toBe(false);
  });

  it('returns false when exp is in the future', () => {
    expect(isExpired({ exp: nowInSeconds() + 900 })).toBe(false);
  });
});

describe('isServiceJwtPayload / isUserJwtPayload guards', () => {
  const user: JwtPayload = {
    sub: 'u1',
    tenant_id: null,
    email: 'a@b.co',
    role: AuthRole.SuperAdminPlatform,
    mfa_verified: true,
    jti: 'j1',
    sid: 's1',
    iss: 'skalean-insurtech-api',
    aud: 'skalean-insurtech-app',
    iat: nowInSeconds(),
    exp: nowInSeconds() + 900,
    nbf: nowInSeconds(),
  };
  const svc: ServiceJwtPayload = {
    sub: 'svc1',
    service: 'sky',
    tenant_id: null,
    scopes: ['read:all'],
    jti: 'j2',
    iat: nowInSeconds(),
    exp: nowInSeconds() + 300,
    iss: 'skalean-insurtech-api',
    aud: 'skalean-insurtech-app',
  };

  it('discriminates user from service payload', () => {
    expect(isUserJwtPayload(user)).toBe(true);
    expect(isServiceJwtPayload(user)).toBe(false);
    expect(isServiceJwtPayload(svc)).toBe(true);
    expect(isUserJwtPayload(svc)).toBe(false);
  });
});
