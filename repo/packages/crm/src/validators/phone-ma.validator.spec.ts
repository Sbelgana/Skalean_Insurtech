/**
 * Tests Phone MA validator -- Sprint 8 Tache 8.2.
 */

import { describe, expect, it } from 'vitest';
import {
  PHONE_MA_VALIDATION_MESSAGE,
  normalizePhoneMa,
  phoneMaRefinement,
  validatePhoneMa,
} from './phone-ma.validator.js';

describe('Phone MA validator (Sprint 8 Tache 8.2)', () => {
  describe('canonical format', () => {
    it('1. accepts +212 5 prefix Inwi/Orange (+212512345678)', () => {
      const r = validatePhoneMa('+212512345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212512345678');
    });

    it('2. accepts +212 6 prefix Maroc Telecom (+212612345678)', () => {
      const r = validatePhoneMa('+212612345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212612345678');
    });

    it('3. accepts +212 7 prefix Orange/Wana (+212712345678)', () => {
      const r = validatePhoneMa('+212712345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212712345678');
    });
  });

  describe('normalization', () => {
    it('4. normalizes national format 0612345678 -> +212612345678', () => {
      const r = validatePhoneMa('0612345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212612345678');
    });

    it('5. normalizes 212612345678 (no plus) -> +212612345678', () => {
      const r = validatePhoneMa('212612345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212612345678');
    });

    it('6. normalizes 00212612345678 -> +212612345678', () => {
      const r = validatePhoneMa('00212612345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212612345678');
    });

    it('7. strips spaces/dashes/dots/parens (+212 6 12-34.56(78))', () => {
      const r = validatePhoneMa('+212 6 12-34.56(78)');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('+212612345678');
    });

    it('8. normalizePhoneMa helper returns canonical form even for invalid', () => {
      expect(normalizePhoneMa('0712345678')).toBe('+212712345678');
    });
  });

  describe('format invalid', () => {
    it('9. rejects empty string', () => {
      const r = validatePhoneMa('');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('10. rejects null', () => {
      const r = validatePhoneMa(null);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('11. rejects too short (+21261234)', () => {
      const r = validatePhoneMa('+21261234');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_LENGTH');
    });

    it('12. rejects too long (+2126123456789)', () => {
      const r = validatePhoneMa('+2126123456789');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_LENGTH');
    });

    it('13. rejects non-MA country code (+33612345678)', () => {
      const r = validatePhoneMa('+33612345678');
      expect(r.valid).toBe(false);
    });

    it('14. rejects invalid operator digit (+212812345678)', () => {
      const r = validatePhoneMa('+212812345678');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_OPERATOR');
    });

    it('15. rejects letters (+212a12345678)', () => {
      const r = validatePhoneMa('+212a12345678');
      expect(r.valid).toBe(false);
    });
  });

  describe('zod refinement helper', () => {
    it('16. phoneMaRefinement returns true for valid phone', () => {
      expect(phoneMaRefinement('+212612345678')).toBe(true);
    });

    it('17. phoneMaRefinement returns true for national format (normalized inside)', () => {
      expect(phoneMaRefinement('0612345678')).toBe(true);
    });

    it('18. phoneMaRefinement returns false for invalid', () => {
      expect(phoneMaRefinement('not a phone')).toBe(false);
    });
  });

  describe('message constant', () => {
    it('19. validation message is non-empty', () => {
      expect(PHONE_MA_VALIDATION_MESSAGE.length).toBeGreaterThan(10);
    });
  });
});
