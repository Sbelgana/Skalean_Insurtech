/**
 * Tests for @insurtech/auth/services/jwt.helpers
 * Sprint 5 Tache 2.1.4
 */

import { describe, expect, it } from 'vitest';
import {
  assertRequiredClaims,
  decodeSegmentJson,
  parseAuthHeader,
  REQUIRED_ACCESS_CLAIMS,
  REQUIRED_REFRESH_CLAIMS,
  splitJwtSegments,
} from '../../src/services/jwt.helpers.js';
import { TokenInvalidError, TokenMissingClaimError } from '../../src/errors/token-errors.js';

describe('parseAuthHeader', () => {
  it('parses a valid Bearer header', () => {
    expect(parseAuthHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive', () => {
    expect(parseAuthHeader('bearer xyz')).toBe('xyz');
    expect(parseAuthHeader('BEARER xyz')).toBe('xyz');
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseAuthHeader(null)).toBeNull();
    expect(parseAuthHeader(undefined)).toBeNull();
    expect(parseAuthHeader('')).toBeNull();
  });

  it('returns null for non-Bearer schemes', () => {
    expect(parseAuthHeader('Basic dXNlcjpwYXNz')).toBeNull();
    expect(parseAuthHeader('Digest abc')).toBeNull();
  });

  it('trims and tolerates multiple spaces', () => {
    expect(parseAuthHeader('  Bearer  abc  ')).toBe('abc');
  });
});

describe('splitJwtSegments', () => {
  it('splits into 3 parts', () => {
    const { header, payload, signature } = splitJwtSegments('a.b.c');
    expect(header).toBe('a');
    expect(payload).toBe('b');
    expect(signature).toBe('c');
  });

  it('throws on empty token', () => {
    expect(() => splitJwtSegments('')).toThrow(TokenInvalidError);
  });

  it('throws on wrong segment count', () => {
    expect(() => splitJwtSegments('a.b')).toThrow(TokenInvalidError);
    expect(() => splitJwtSegments('a.b.c.d')).toThrow(TokenInvalidError);
  });

  it('throws on empty segment', () => {
    expect(() => splitJwtSegments('a..c')).toThrow(TokenInvalidError);
  });
});

describe('decodeSegmentJson', () => {
  it('decodes a base64url JSON segment', () => {
    const obj = { foo: 'bar', n: 42 };
    const seg = Buffer.from(JSON.stringify(obj)).toString('base64url');
    expect(decodeSegmentJson(seg)).toEqual(obj);
  });

  it('returns null on invalid base64url', () => {
    expect(decodeSegmentJson('!!!')).toBeNull();
  });

  it('returns null on non-JSON content', () => {
    const seg = Buffer.from('not json').toString('base64url');
    expect(decodeSegmentJson(seg)).toBeNull();
  });
});

describe('assertRequiredClaims', () => {
  it('passes when all claims present', () => {
    expect(() =>
      assertRequiredClaims({ a: 1, b: 2 }, ['a', 'b']),
    ).not.toThrow();
  });

  it('throws TokenMissingClaimError on absent claim', () => {
    expect(() =>
      assertRequiredClaims({ a: 1 }, ['a', 'b']),
    ).toThrow(TokenMissingClaimError);
  });
});

describe('REQUIRED_ACCESS_CLAIMS and REQUIRED_REFRESH_CLAIMS', () => {
  it('access includes core JWT + Skalean claims', () => {
    expect(REQUIRED_ACCESS_CLAIMS).toContain('sub');
    expect(REQUIRED_ACCESS_CLAIMS).toContain('tenant_id');
    expect(REQUIRED_ACCESS_CLAIMS).toContain('mfa_verified');
    expect(REQUIRED_ACCESS_CLAIMS).toContain('iss');
    expect(REQUIRED_ACCESS_CLAIMS).toContain('aud');
  });

  it('refresh includes family + generation for rotation', () => {
    expect(REQUIRED_REFRESH_CLAIMS).toContain('token_family');
    expect(REQUIRED_REFRESH_CLAIMS).toContain('generation');
  });
});
