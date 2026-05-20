/**
 * Tests for @insurtech/auth/services/session.helpers
 * Sprint 5 Tache 2.1.5
 */

import { describe, expect, it } from 'vitest';
import {
  buildFamilyKey,
  buildRevokedKey,
  buildSessionKey,
  buildUserSessionsKey,
  isExpiredSession,
  parseSessionRecord,
  serializeSession,
} from '../../src/services/session.helpers.js';
import { AuthRole } from '../../src/types/auth-roles.js';
import type { SessionMetadata } from '../../src/types/session-metadata.js';

describe('key builders', () => {
  it('buildSessionKey prefixes correctly', () => {
    expect(buildSessionKey('abc')).toBe('session:abc');
  });

  it('buildRevokedKey prefixes correctly', () => {
    expect(buildRevokedKey('abc')).toBe('revoked:abc');
  });

  it('buildUserSessionsKey prefixes correctly', () => {
    expect(buildUserSessionsKey('user-1')).toBe('user_sessions:user-1');
  });

  it('buildFamilyKey prefixes correctly', () => {
    expect(buildFamilyKey('fam-1')).toBe('family:fam-1');
  });
});

describe('serializeSession / parseSessionRecord', () => {
  const sample: SessionMetadata = {
    user_id: 'u',
    tenant_id: null,
    role: AuthRole.BrokerUser,
    jti: 'jti',
    refresh_token_family: 'fam',
    refresh_generation: 1,
    ip: '127.0.0.1',
    user_agent: 'vitest',
    mfa_verified: false,
    remember_me: false,
    created_at: 1000,
    last_seen_at: 1000,
    expires_at: 2000,
  };

  it('round-trips a SessionMetadata', () => {
    const s = serializeSession(sample);
    const p = parseSessionRecord(s);
    expect(p).toEqual(sample);
  });

  it('parseSessionRecord returns null for null input', () => {
    expect(parseSessionRecord(null)).toBeNull();
  });

  it('parseSessionRecord returns null for malformed JSON', () => {
    expect(parseSessionRecord('{not json')).toBeNull();
  });
});

describe('isExpiredSession', () => {
  const base: SessionMetadata = {
    user_id: 'u',
    tenant_id: null,
    role: AuthRole.Assure,
    jti: 'j',
    refresh_token_family: 'f',
    refresh_generation: 1,
    ip: '1.2.3.4',
    user_agent: 'x',
    mfa_verified: false,
    remember_me: false,
    created_at: 1000,
    last_seen_at: 1000,
    expires_at: 2000,
  };

  it('returns true when now > expires_at', () => {
    expect(isExpiredSession(base, 2001)).toBe(true);
  });

  it('returns false when now <= expires_at', () => {
    expect(isExpiredSession(base, 2000)).toBe(false);
    expect(isExpiredSession(base, 1500)).toBe(false);
  });
});
