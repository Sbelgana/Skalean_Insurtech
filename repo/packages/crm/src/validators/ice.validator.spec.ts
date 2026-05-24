/**
 * Tests ICE validator -- Sprint 8 Tache 8.1.
 *
 * Couvre : format / length / checksum / nettoyage espaces / format affichage.
 */

import { describe, expect, it } from 'vitest';
import { formatIce, iceRefinement, validateIce } from './ice.validator.js';

describe('validateIce (Sprint 8 Tache 8.1)', () => {
  // Helper : construire ICE valide en calculant la cle de controle
  function buildValidIce(first13: string): string {
    if (first13.length !== 13 || !/^\d{13}$/.test(first13)) {
      throw new Error('buildValidIce expects 13 digits');
    }
    const remainder = Number(BigInt(first13) % 97n);
    const checksum = String(remainder).padStart(2, '0');
    return first13 + checksum;
  }

  describe('valid cases', () => {
    it('1. accepts valid ICE with correct checksum', () => {
      // Generate valid ICE for "1234567890123"
      const valid = buildValidIce('1234567890123');
      const result = validateIce(valid);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(valid);
    });

    it('2. cleans whitespace before validation', () => {
      const valid = buildValidIce('9876543210987');
      const withSpaces = `${valid.slice(0, 5)} ${valid.slice(5, 10)} ${valid.slice(10)}`;
      const result = validateIce(withSpaces);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(valid);
    });

    it('3. cleans dashes before validation', () => {
      const valid = buildValidIce('5555555555555');
      const withDashes = `${valid.slice(0, 5)}-${valid.slice(5, 10)}-${valid.slice(10)}`;
      const result = validateIce(withDashes);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid cases -- INVALID_LENGTH', () => {
    it('4. rejects 14 digits', () => {
      const result = validateIce('12345678901234');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_LENGTH');
    });

    it('5. rejects 16 digits', () => {
      const result = validateIce('1234567890123456');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_LENGTH');
    });

    it('6. rejects empty string', () => {
      const result = validateIce('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_LENGTH');
    });
  });

  describe('invalid cases -- INVALID_FORMAT', () => {
    it('7. rejects letters mixed with digits', () => {
      const result = validateIce('1234567890ABCDE');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_FORMAT');
    });

    it('8. rejects null', () => {
      const result = validateIce(null);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_FORMAT');
    });

    it('9. rejects undefined', () => {
      const result = validateIce(undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_FORMAT');
    });
  });

  describe('invalid cases -- INVALID_CHECKSUM', () => {
    it('10. rejects 15 digits with wrong checksum', () => {
      // Build valid then break checksum
      const valid = buildValidIce('1111111111111');
      const broken = valid.slice(0, 13) + '99'; // wrong checksum
      // Only test if 99 != real remainder
      const realRem = Number(BigInt('1111111111111') % 97n);
      if (realRem !== 99) {
        const result = validateIce(broken);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INVALID_CHECKSUM');
      }
    });

    it('11. rejects all zeros except checksum (mod 97 = 00)', () => {
      // 0000000000000 mod 97 = 0 -> only valid if checksum=00
      const result = validateIce('000000000000099');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CHECKSUM');
    });
  });

  describe('formatIce', () => {
    it('12. formats valid ICE as "XXXXXXXXXX YYYYY"', () => {
      const valid = buildValidIce('1234567890123');
      const formatted = formatIce(valid);
      expect(formatted).toContain(' ');
      expect(formatted.replace(' ', '')).toBe(valid);
    });

    it('13. returns input unchanged for invalid ICE', () => {
      const formatted = formatIce('abc');
      expect(formatted).toBe('abc');
    });

    it('14. returns empty for null/undefined', () => {
      expect(formatIce(null)).toBe('');
      expect(formatIce(undefined)).toBe('');
    });
  });

  describe('iceRefinement (Zod helper)', () => {
    it('15. iceRefinement returns true for valid ICE', () => {
      const valid = buildValidIce('3333333333333');
      expect(iceRefinement(valid)).toBe(true);
    });

    it('16. iceRefinement returns false for invalid ICE', () => {
      expect(iceRefinement('not-an-ice')).toBe(false);
    });
  });
});
