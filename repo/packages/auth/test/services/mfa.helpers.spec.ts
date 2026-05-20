/**
 * Tests for @insurtech/auth/services/mfa.helpers
 * Sprint 5 Tache 2.1.7
 */

import { describe, expect, it } from 'vitest';
import {
  buildOtpauthUrl,
  formatRecoveryCode,
  parseRecoveryCode,
  totpStepFor,
  validateTotpFormat,
} from '../../src/services/mfa.helpers.js';

describe('validateTotpFormat', () => {
  it('accepts 6 digits', () => {
    expect(validateTotpFormat('123456')).toBe(true);
  });
  it('rejects 5 or 7 digits', () => {
    expect(validateTotpFormat('12345')).toBe(false);
    expect(validateTotpFormat('1234567')).toBe(false);
  });
  it('rejects non-digits', () => {
    expect(validateTotpFormat('12345A')).toBe(false);
    expect(validateTotpFormat('')).toBe(false);
  });
});

describe('formatRecoveryCode / parseRecoveryCode', () => {
  it('formats 12 chars into XXXX-XXXX-XXXX', () => {
    expect(formatRecoveryCode('ABCD1234EFGH')).toBe('ABCD-1234-EFGH');
  });
  it('throws on wrong length', () => {
    expect(() => formatRecoveryCode('ABC')).toThrow();
  });
  it('parses XXXX-XXXX-XXXX', () => {
    expect(parseRecoveryCode('ABCD-1234-EFGH')).toBe('ABCD1234EFGH');
  });
  it('parses dashless form', () => {
    expect(parseRecoveryCode('ABCD1234EFGH')).toBe('ABCD1234EFGH');
  });
  it('lowercase parsed to uppercase', () => {
    expect(parseRecoveryCode('abcd-1234-efgh')).toBe('ABCD1234EFGH');
  });
  it('rejects invalid forms', () => {
    expect(parseRecoveryCode('garbage')).toBeNull();
    expect(parseRecoveryCode('AB-CD-EFGH')).toBeNull();
  });
});

describe('totpStepFor', () => {
  it('30s step at time 0', () => {
    expect(totpStepFor(0)).toBe(0);
  });
  it('30s step at 60s', () => {
    expect(totpStepFor(60_000)).toBe(2);
  });
});

describe('buildOtpauthUrl', () => {
  it('builds RFC 6238 compliant URL', () => {
    const url = buildOtpauthUrl({
      email: 'user@example.com',
      issuer: 'Skalean InsurTech',
      secretB32: 'JBSWY3DPEHPK3PXP',
    });
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(url).toContain('issuer=Skalean+InsurTech');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });

  it('respects custom params', () => {
    const url = buildOtpauthUrl({
      email: 'a@b.co',
      issuer: 'X',
      secretB32: 'JBSWY3DPEHPK3PXP',
      digits: 8,
      period: 60,
      algorithm: 'SHA256',
    });
    expect(url).toContain('digits=8');
    expect(url).toContain('period=60');
    expect(url).toContain('algorithm=SHA256');
  });
});
