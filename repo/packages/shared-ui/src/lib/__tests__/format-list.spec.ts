import { describe, it, expect } from 'vitest';
import { formatList, formatListAnd, formatListOr } from '../format-list';

describe('format-list', () => {
  it('formats conjunction list in fr', () => {
    const result = formatListAnd(['Pierre', 'Paul', 'Jacques'], 'fr');
    expect(result).toContain('et');
    expect(result).toContain('Pierre');
    expect(result).toContain('Jacques');
  });

  it('returns empty string for empty array', () => {
    expect(formatList([], 'fr')).toBe('');
  });

  it('returns single item for single-element array', () => {
    expect(formatList(['seul'], 'fr')).toBe('seul');
  });

  it('formats disjunction list in fr', () => {
    const result = formatListOr(['A', 'B', 'C'], 'fr');
    expect(result).toContain('ou');
  });
});
