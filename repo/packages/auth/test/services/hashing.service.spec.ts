/**
 * Tests for @insurtech/auth/services/hashing.service
 * Sprint 5 Tache 2.1.3
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { HashingService } from '../../src/services/hashing.service.js';

describe('HashingService', () => {
  let svc: HashingService;

  beforeAll(() => {
    svc = new HashingService();
    svc.onModuleInit();
  });

  describe('sha256', () => {
    it('returns 64-char hex digest', () => {
      const h = svc.sha256('hello');
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      expect(svc.sha256('hello')).toBe(svc.sha256('hello'));
    });

    it('differs for different inputs', () => {
      expect(svc.sha256('a')).not.toBe(svc.sha256('b'));
    });

    it('matches known vector for "abc"', () => {
      // NIST SHA-256 example vector
      expect(svc.sha256('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  describe('sha256Buffer + sha256Raw', () => {
    it('sha256Buffer returns hex', () => {
      const h = svc.sha256Buffer(Buffer.from('abc', 'utf-8'));
      expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('sha256Raw returns 32-byte Buffer', () => {
      const b = svc.sha256Raw('abc');
      expect(b.length).toBe(32);
      expect(b.toString('hex')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('sha256Raw accepts Buffer', () => {
      expect(svc.sha256Raw(Buffer.from('abc')).toString('hex')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  describe('hmacSha256', () => {
    it('returns 64-char hex digest', () => {
      const h = svc.hmacSha256('msg', 'k'.repeat(48));
      expect(h).toHaveLength(64);
    });

    it('is deterministic', () => {
      const k = 'k'.repeat(48);
      expect(svc.hmacSha256('m', k)).toBe(svc.hmacSha256('m', k));
    });

    it('differs for different keys', () => {
      expect(svc.hmacSha256('m', 'a'.repeat(48))).not.toBe(svc.hmacSha256('m', 'b'.repeat(48)));
    });

    it('accepts Buffer key', () => {
      const k = Buffer.alloc(48, 0x55);
      expect(svc.hmacSha256('m', k)).toHaveLength(64);
    });
  });

  describe('hmacSha256Raw', () => {
    it('returns 32-byte Buffer', () => {
      const b = svc.hmacSha256Raw('m', 'k'.repeat(48));
      expect(b.length).toBe(32);
    });
  });

  describe('randomToken', () => {
    it('returns base64url chars (URL-safe, no padding)', () => {
      const t = svc.randomToken(32);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('default byte length 32 produces ~43 chars', () => {
      expect(svc.randomToken().length).toBeGreaterThanOrEqual(42);
      expect(svc.randomToken().length).toBeLessThanOrEqual(44);
    });

    it('is non-deterministic', () => {
      const a = svc.randomToken();
      const b = svc.randomToken();
      expect(a).not.toBe(b);
    });

    it('throws on out-of-range byteLength', () => {
      expect(() => svc.randomToken(2)).toThrow();
      expect(() => svc.randomToken(1000)).toThrow();
    });
  });

  describe('randomHex', () => {
    it('returns lowercase hex', () => {
      const t = svc.randomHex(16);
      expect(t).toMatch(/^[0-9a-f]+$/);
      expect(t).toHaveLength(32);
    });

    it('throws on out-of-range byteLength', () => {
      expect(() => svc.randomHex(0)).toThrow();
    });
  });

  describe('timingSafeEqualString', () => {
    it('returns true for equal strings', () => {
      expect(svc.timingSafeEqualString('abc', 'abc')).toBe(true);
    });

    it('returns false for different content same length', () => {
      expect(svc.timingSafeEqualString('abc', 'abd')).toBe(false);
    });

    it('returns false for different lengths', () => {
      expect(svc.timingSafeEqualString('abc', 'abcd')).toBe(false);
    });
  });

  describe('timingSafeEqualBuffer', () => {
    it('returns true for equal buffers', () => {
      expect(
        svc.timingSafeEqualBuffer(Buffer.from('xyz'), Buffer.from('xyz')),
      ).toBe(true);
    });

    it('returns false for different lengths', () => {
      expect(svc.timingSafeEqualBuffer(Buffer.from('a'), Buffer.from('ab'))).toBe(false);
    });
  });
});
