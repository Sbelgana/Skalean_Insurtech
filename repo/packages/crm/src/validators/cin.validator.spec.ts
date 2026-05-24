/**
 * Tests CIN validator -- Sprint 8 Tache 8.2.
 */

import { describe, expect, it } from 'vitest';
import { CIN_VALIDATION_MESSAGE, validateCin, cinRefinement } from './cin.validator.js';

describe('CIN MA validator (Sprint 8 Tache 8.2)', () => {
  describe('format valid', () => {
    it('1. accepts single letter + 6 digits (A123456)', () => {
      const r = validateCin('A123456');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('A123456');
    });

    it('2. accepts double letter + 7 digits (BE7890123)', () => {
      const r = validateCin('BE7890123');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('BE7890123');
    });

    it('3. accepts double letter + 8 digits (AB12345678)', () => {
      const r = validateCin('AB12345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('AB12345678');
    });

    it('4. accepts single letter + 8 digits (X12345678)', () => {
      const r = validateCin('X12345678');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('X12345678');
    });
  });

  describe('normalization', () => {
    it('5. uppercases lowercase input (a123456 -> A123456)', () => {
      const r = validateCin('a123456');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('A123456');
    });

    it('6. strips whitespace (A 123 456)', () => {
      const r = validateCin('A 123 456');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('A123456');
    });
  });

  describe('format invalid', () => {
    it('7. rejects empty string', () => {
      const r = validateCin('');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_LENGTH');
    });

    it('8. rejects null', () => {
      const r = validateCin(null);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('9. rejects undefined', () => {
      const r = validateCin(undefined);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('10. rejects pure digits (1234567)', () => {
      const r = validateCin('1234567');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('11. rejects too few digits (A12345)', () => {
      const r = validateCin('A12345');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_LENGTH');
    });

    it('12. rejects too many digits (A123456789)', () => {
      const r = validateCin('A123456789');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('13. rejects 3+ letters prefix (ABC123456)', () => {
      const r = validateCin('ABC123456');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });

    it('14. rejects special characters (A12-3456)', () => {
      const r = validateCin('A12-3456');
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('INVALID_FORMAT');
    });
  });

  describe('zod refinement helper', () => {
    it('15. cinRefinement returns true for valid CIN', () => {
      expect(cinRefinement('A123456')).toBe(true);
    });

    it('16. cinRefinement returns false for invalid CIN', () => {
      expect(cinRefinement('bad')).toBe(false);
    });
  });

  describe('message constant', () => {
    it('17. message constant is non-empty', () => {
      expect(CIN_VALIDATION_MESSAGE.length).toBeGreaterThan(10);
    });
  });
});
