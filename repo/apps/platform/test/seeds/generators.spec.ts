/**
 * Tests unitaires purs pour seed-helpers generators.
 * Aucune connexion DB requise -- toujours executable.
 * Aucune emoji (decision-006).
 */
import { describe, it, expect } from 'vitest';
import {
  generateIce,
  generateCin,
  generatePhoneMa,
  generatePoliceNumber,
  generateInvoiceNumber,
  generateUlid,
  isMoroccoHoliday2026,
  isInRamadan2026,
} from '../../scripts/seed-helpers.js';

describe('Seed helpers generators', () => {
  it('generateIce returns 15-digit string', () => {
    for (let i = 0; i < 100; i++) {
      const ice = generateIce();
      expect(ice).toMatch(/^\d{15}$/);
    }
  });

  it('generateIce produces unique values across 50 calls', () => {
    const ices = new Set(Array.from({ length: 50 }, () => generateIce()));
    // With 15 digits, collision probability is ~50/10^15, effectively 0
    expect(ices.size).toBeGreaterThan(40);
  });

  it('generateCin returns prefecture-prefix + 6 digits', () => {
    for (let i = 0; i < 100; i++) {
      const cin = generateCin();
      expect(cin).toMatch(/^[A-Z]{1,2}\d{6}$/);
    }
  });

  it('generatePhoneMa returns E.164 +212 mobile or fixe', () => {
    for (let i = 0; i < 100; i++) {
      const phone = generatePhoneMa();
      expect(phone).toMatch(/^\+212(5|6|7)\d{8,9}$/);
    }
  });

  it('generatePoliceNumber follows POL-YYYY-NNNN', () => {
    expect(generatePoliceNumber(2026, 1)).toBe('POL-2026-0001');
    expect(generatePoliceNumber(2026, 1234)).toBe('POL-2026-1234');
    expect(generatePoliceNumber(2026, 9999)).toBe('POL-2026-9999');
  });

  it('generateInvoiceNumber follows INV-YYYY-NNNN', () => {
    expect(generateInvoiceNumber(2026, 42)).toBe('INV-2026-0042');
    expect(generateInvoiceNumber(2026, 1)).toBe('INV-2026-0001');
  });

  it('generateUlid returns 26-character ULID', () => {
    const a = generateUlid();
    const b = generateUlid();
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(b).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a).not.toBe(b);
  });

  it('isMoroccoHoliday2026 detects key dates', () => {
    expect(isMoroccoHoliday2026(new Date('2026-01-01'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-07-30'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-11-18'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-05-01'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-04-15'))).toBe(false);
    expect(isMoroccoHoliday2026(new Date('2026-06-10'))).toBe(false);
  });

  it('isInRamadan2026 detects Ramadan window', () => {
    expect(isInRamadan2026(new Date('2026-02-18'))).toBe(true);
    expect(isInRamadan2026(new Date('2026-03-10'))).toBe(true);
    expect(isInRamadan2026(new Date('2026-03-19'))).toBe(true);
    expect(isInRamadan2026(new Date('2026-02-17'))).toBe(false);
    expect(isInRamadan2026(new Date('2026-03-20'))).toBe(false);
    expect(isInRamadan2026(new Date('2026-04-01'))).toBe(false);
  });
});
