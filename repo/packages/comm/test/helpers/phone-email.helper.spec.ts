import { describe, expect, it } from 'vitest';
import {
  extractPhoneE164,
  normalizePhone,
  isMaroccanPhone,
  formatPhoneForMeta,
  validateEmail,
  normalizeEmail,
} from '../../src/helpers/phone-email.helper.js';

describe('phone-email.helper', () => {
  describe('extractPhoneE164', () => {
    it('parses MA national format 0612...', () => {
      expect(extractPhoneE164('0612345678')).toBe('+212612345678');
    });

    it('strips whitespace and dashes', () => {
      expect(extractPhoneE164('+212-612-345-678')).toBe('+212612345678');
      expect(extractPhoneE164('06 12 34 56 78')).toBe('+212612345678');
    });

    it('handles 00 prefix as international', () => {
      expect(extractPhoneE164('00212612345678')).toBe('+212612345678');
    });

    it('is idempotent on already-canonical E.164', () => {
      const once = extractPhoneE164('+212612345678');
      const twice = extractPhoneE164(once ?? '');
      expect(once).toBe('+212612345678');
      expect(twice).toBe('+212612345678');
    });

    it('returns null for empty input', () => {
      expect(extractPhoneE164('')).toBeNull();
      expect(extractPhoneE164('   ')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(extractPhoneE164('abc')).toBeNull();
      expect(extractPhoneE164('06123')).toBeNull();
    });
  });

  describe('normalizePhone', () => {
    it('returns canonical E.164', () => {
      expect(normalizePhone('0612345678')).toBe('+212612345678');
    });

    it('throws on invalid input', () => {
      expect(() => normalizePhone('not-a-phone')).toThrow(/PHONE_INVALID/);
    });
  });

  describe('isMaroccanPhone', () => {
    it('accepts MA mobile 06xx', () => {
      expect(isMaroccanPhone('+212612345678')).toBe(true);
    });

    it('accepts MA mobile 07xx', () => {
      expect(isMaroccanPhone('+212712345678')).toBe(true);
    });

    it('accepts MA fixed 05xx', () => {
      expect(isMaroccanPhone('+212512345678')).toBe(true);
    });

    it('rejects non-MA prefix', () => {
      expect(isMaroccanPhone('+33612345678')).toBe(false);
    });
  });

  describe('formatPhoneForMeta', () => {
    it('strips leading + for Meta API', () => {
      expect(formatPhoneForMeta('+212612345678')).toBe('212612345678');
    });

    it('throws if not canonical E.164', () => {
      expect(() => formatPhoneForMeta('0612345678')).toThrow(/PHONE_NOT_E164_CANONICAL/);
    });
  });

  describe('validateEmail', () => {
    it('accepts basic emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('first.last+alias@sub.example.co')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(validateEmail('not-an-email')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('rejects emails over 320 chars', () => {
      const long = 'a'.repeat(310) + '@example.com';
      expect(validateEmail(long)).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
      expect(normalizeEmail('USER@Example.com ')).toBe('user@example.com');
    });

    it('preserves +alias', () => {
      expect(normalizeEmail('User+Marketing@example.com')).toBe('user+marketing@example.com');
    });

    it('is idempotent', () => {
      const once = normalizeEmail('USER@Example.com');
      const twice = normalizeEmail(once);
      expect(once).toBe(twice);
    });

    it('throws on invalid input', () => {
      expect(() => normalizeEmail('not-an-email')).toThrow(/EMAIL_INVALID/);
    });
  });
});
