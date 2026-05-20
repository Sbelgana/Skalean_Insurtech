/**
 * Tests for @insurtech/auth/services/argon2.service
 * Sprint 5 Tache 2.1.2
 * Uses real argon2 with OWASP params. Slower than unit but still under 30s for full suite.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { Argon2Service } from '../../src/services/argon2.service.js';
import { PepperService } from '../../src/services/pepper.service.js';

describe('Argon2Service', () => {
  let service: Argon2Service;

  beforeAll(async () => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    const pepper = new PepperService();
    service = new Argon2Service(pepper);
    await service.onModuleInit();
  }, 30000);

  describe('hash + verify', () => {
    it('hashes a password and verifies the hash', async () => {
      const password = 'StrongP@ssw0rd!';
      const hash = await service.hash(password);
      expect(hash).toMatch(/^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$/);
      const ok = await service.verify(hash, password);
      expect(ok).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await service.hash('correct-password-12!');
      const ok = await service.verify(hash, 'wrong-password-12!');
      expect(ok).toBe(false);
    });

    it('returns false for malformed hash (does not throw)', async () => {
      const ok = await service.verify('not-a-hash', 'whatever');
      expect(ok).toBe(false);
    });

    it('returns false for empty hash', async () => {
      const ok = await service.verify('', 'password');
      expect(ok).toBe(false);
    });

    it('returns false for empty password', async () => {
      const hash = await service.hash('valid-password-12!');
      const ok = await service.verify(hash, '');
      expect(ok).toBe(false);
    });

    it('throws on hash if plaintext is empty', async () => {
      await expect(service.hash('')).rejects.toThrow();
    });

    it('throws on hash if plaintext exceeds maxLength', async () => {
      await expect(service.hash('a'.repeat(200))).rejects.toThrow(/maxLength/);
    });

    it('produces different hashes for the same password (different salts)', async () => {
      const h1 = await service.hash('SamePassword12!');
      const h2 = await service.hash('SamePassword12!');
      expect(h1).not.toBe(h2);
      expect(await service.verify(h1, 'SamePassword12!')).toBe(true);
      expect(await service.verify(h2, 'SamePassword12!')).toBe(true);
    });
  });

  describe('verifyEmptyForTiming', () => {
    it('always returns false', async () => {
      expect(await service.verifyEmptyForTiming('anything')).toBe(false);
      expect(await service.verifyEmptyForTiming()).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('returns false for a freshly generated hash', async () => {
      const hash = await service.hash('FreshPassword12!');
      expect(service.needsRehash(hash)).toBe(false);
    });

    it('returns true for a malformed hash', () => {
      expect(service.needsRehash('not-a-hash')).toBe(true);
    });

    it('returns true for a hash with weaker memoryCost', () => {
      const weakHash = '$argon2id$v=19$m=4096,t=2,p=1$dGVzdHNhbHQ$dGVzdGhhc2g';
      expect(service.needsRehash(weakHash)).toBe(true);
    });
  });

  describe('validatePolicy', () => {
    it('accepts a strong password', () => {
      const r = service.validatePolicy('StrongP@ssw0rd!');
      expect(r.valid).toBe(true);
    });

    it('rejects too short', () => {
      const r = service.validatePolicy('Sh0rt!');
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('too_short');
    });

    it('rejects missing uppercase', () => {
      const r = service.validatePolicy('lowercase123!');
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('missing_uppercase');
    });

    it('rejects missing lowercase', () => {
      const r = service.validatePolicy('UPPERCASE123!');
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('missing_lowercase');
    });

    it('rejects missing digit', () => {
      const r = service.validatePolicy('NoDigitsHere!@');
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('missing_digit');
    });

    it('rejects missing special', () => {
      const r = service.validatePolicy('NoSpecial1234ab');
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('missing_special');
    });

    it('rejects banned password (lowercased lookup)', () => {
      const r = service.validatePolicy('password');
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('banned');
    });

    it('rejects password containing email local-part', () => {
      const r = service.validatePolicy('aliceTheGreat12!', {
        email: 'alice@example.com',
      });
      expect(r.valid).toBe(false);
      if (!r.valid) {
        expect(
          r.reasons.some((x) => x === 'contains_email_local' || x === 'similar_to_email'),
        ).toBe(true);
      }
    });

    it('rejects password containing display_name', () => {
      const r = service.validatePolicy('JohnSmithStrong1!', { display_name: 'John Smith' });
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('contains_display_name');
    });

    it('accumulates multiple reasons', () => {
      const r = service.validatePolicy('short');
      expect(r.valid).toBe(false);
      if (!r.valid) {
        expect(r.reasons.length).toBeGreaterThan(1);
        expect(r.reasons).toContain('too_short');
      }
    });

    it('rejects too long (>128 chars)', () => {
      const r = service.validatePolicy('A1!a'.repeat(40));
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reasons).toContain('too_long');
    });
  });

  describe('generateRecoveryCode', () => {
    it('produces 10-character uppercase alphanumeric code', () => {
      const c = service.generateRecoveryCode();
      expect(c).toHaveLength(10);
      expect(c).toMatch(/^[A-Z0-9]+$/);
    });

    it('produces different codes on consecutive calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i += 1) codes.add(service.generateRecoveryCode());
      expect(codes.size).toBe(100);
    });

    it('avoids easily-confused chars (no 0, O, 1, I, L)', () => {
      for (let i = 0; i < 50; i += 1) {
        const c = service.generateRecoveryCode();
        expect(c).not.toMatch(/[0OIL1]/);
      }
    });
  });

  describe('generateRecoveryCodeBatch', () => {
    it('produces 6 unique codes by default', () => {
      const batch = service.generateRecoveryCodeBatch();
      expect(batch).toHaveLength(6);
      expect(new Set(batch).size).toBe(6);
    });

    it('respects custom count', () => {
      const batch = service.generateRecoveryCodeBatch(10);
      expect(batch).toHaveLength(10);
    });

    it('rejects count out of range', () => {
      expect(() => service.generateRecoveryCodeBatch(0)).toThrow();
      expect(() => service.generateRecoveryCodeBatch(50)).toThrow();
    });
  });

  describe('timingSafeStringEqual', () => {
    it('returns true for identical strings', () => {
      expect(service.timingSafeStringEqual('abc', 'abc')).toBe(true);
    });

    it('returns false for different strings of same length', () => {
      expect(service.timingSafeStringEqual('abc', 'abd')).toBe(false);
    });

    it('returns false for different lengths (fast path)', () => {
      expect(service.timingSafeStringEqual('abc', 'abcd')).toBe(false);
    });
  });
});
