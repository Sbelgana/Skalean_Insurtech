import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
  it('deduplicates tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('handles conditional classes', () => {
    expect(cn('base', false && 'skip', 'include')).toBe('base include');
  });
  it('handles array inputs', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });
  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
});
