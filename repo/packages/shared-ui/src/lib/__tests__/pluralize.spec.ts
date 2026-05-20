import { describe, it, expect } from 'vitest';
import { getPluralCategory, pluralize, getPluralCategoriesForLocale } from '../pluralize';

describe('pluralize', () => {
  it('arabic 0 -> zero', () => {
    expect(getPluralCategory(0, 'ar', false)).toBe('zero');
  });

  it('arabic 1 -> one', () => {
    expect(getPluralCategory(1, 'ar', false)).toBe('one');
  });

  it('arabic 2 -> two', () => {
    expect(getPluralCategory(2, 'ar', false)).toBe('two');
  });

  it('arabic 3 -> few', () => {
    expect(getPluralCategory(3, 'ar', false)).toBe('few');
  });

  it('arabic 11 -> many', () => {
    expect(getPluralCategory(11, 'ar', false)).toBe('many');
  });

  it('arabic 100 -> other', () => {
    expect(getPluralCategory(100, 'ar', false)).toBe('other');
  });

  it('darija collapse few/many to other', () => {
    expect(getPluralCategory(5, 'ar-MA', true)).toBe('other');
    expect(getPluralCategory(11, 'ar-MA', true)).toBe('other');
  });

  it('pluralize replaces # with count', () => {
    const result = pluralize(
      5,
      'ar',
      {
        zero: 'la shay',
        one: 'wahid',
        two: 'ithnan',
        few: '# qalil',
        many: '# kathir',
        other: '# ashya',
      },
      false,
    );
    expect(result).toBe('5 qalil');
  });

  it('getPluralCategoriesForLocale fr returns one, other', () => {
    const cats = getPluralCategoriesForLocale('fr');
    expect(cats).toContain('one');
    expect(cats).toContain('other');
  });
});
