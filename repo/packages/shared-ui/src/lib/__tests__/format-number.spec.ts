import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatCompact,
  parseLocalizedNumber,
} from '../format-number';

describe('format-number', () => {
  it('formats number with fr locale', () => {
    const result = formatNumber(1234.56, 'fr', { minimumFractionDigits: 2 });
    expect(result).toBeTruthy();
    expect(result).toContain('234');
  });

  it('formats currency MAD in fr replaces MAD with DH', () => {
    const result = formatCurrency(1234.56, 'fr', 'MAD');
    expect(result).toContain('DH');
    expect(result).not.toContain('MAD');
  });

  it('formats currency MAD in ar', () => {
    const result = formatCurrency(1234.56, 'ar', 'MAD');
    expect(result).toBeTruthy();
  });

  it('formats currency with arabic-indic numerals', () => {
    const result = formatCurrency(1234.56, 'ar', 'MAD', { useArabicIndicNumerals: true });
    expect(result).toMatch(/[٠-٩]/);
  });

  it('formats percent fr', () => {
    const result = formatPercent(0.15, 'fr');
    expect(result).toBeTruthy();
    expect(result).toMatch(/15/);
  });

  it('formats percent with fractionDigits', () => {
    const result = formatPercent(0.156, 'fr', 2);
    expect(result).toMatch(/15/);
  });

  it('formats compact', () => {
    const result = formatCompact(1500000, 'fr');
    expect(result).toMatch(/[Mm]/);
  });

  it('returns empty for non-finite values', () => {
    expect(formatNumber(Number.NaN, 'fr')).toBe('');
    expect(formatCurrency(Number.POSITIVE_INFINITY, 'fr')).toBe('');
  });

  it('parses localized number string', () => {
    const result = parseLocalizedNumber('1234.56', 'fr');
    expect(result).toBe(1234.56);
  });

  it('parses arabic-indic numerals', () => {
    const result = parseLocalizedNumber('١٠٠٠', 'ar');
    expect(result).toBe(1000);
  });
});
