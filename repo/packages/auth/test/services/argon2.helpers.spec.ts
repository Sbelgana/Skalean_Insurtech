/**
 * Tests for @insurtech/auth/services/argon2.helpers
 * Sprint 5 Tache 2.1.2
 */

import { describe, it, expect } from 'vitest';
import {
  parseArgon2Hash,
  compareArgon2Params,
  levenshteinDistance,
  normalizePasswordForBanlist,
} from '../../src/services/argon2.helpers.js';
import { ARGON2_PARAMS } from '../../src/constants/argon2-params.js';

describe('parseArgon2Hash', () => {
  it('parses a valid Argon2id hash string', () => {
    const r = parseArgon2Hash(
      '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA',
    );
    expect(r).not.toBeNull();
    expect(r?.algorithm).toBe('argon2id');
    expect(r?.memoryCost).toBe(65536);
    expect(r?.timeCost).toBe(3);
    expect(r?.parallelism).toBe(4);
    expect(r?.version).toBe(19);
  });

  it('returns null for invalid format', () => {
    expect(parseArgon2Hash('not-a-hash')).toBeNull();
    expect(parseArgon2Hash('$bcrypt$abc')).toBeNull();
    expect(parseArgon2Hash('')).toBeNull();
  });

  it('parses argon2i and argon2d variants', () => {
    expect(parseArgon2Hash('$argon2i$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA')?.algorithm).toBe(
      'argon2i',
    );
    expect(parseArgon2Hash('$argon2d$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA')?.algorithm).toBe(
      'argon2d',
    );
  });
});

describe('compareArgon2Params', () => {
  it('returns true when params match exactly', () => {
    const parsed = {
      algorithm: 'argon2id',
      version: 19,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      saltB64: 'x',
      hashB64: 'y',
    };
    expect(compareArgon2Params(parsed, ARGON2_PARAMS)).toBe(true);
  });

  it('returns false when memoryCost is weaker', () => {
    const parsed = {
      algorithm: 'argon2id',
      version: 19,
      memoryCost: 4096,
      timeCost: 3,
      parallelism: 4,
      saltB64: 'x',
      hashB64: 'y',
    };
    expect(compareArgon2Params(parsed, ARGON2_PARAMS)).toBe(false);
  });

  it('returns false when timeCost is weaker', () => {
    const parsed = {
      algorithm: 'argon2id',
      version: 19,
      memoryCost: 65536,
      timeCost: 1,
      parallelism: 4,
      saltB64: 'x',
      hashB64: 'y',
    };
    expect(compareArgon2Params(parsed, ARGON2_PARAMS)).toBe(false);
  });

  it('returns false when algorithm differs', () => {
    const parsed = {
      algorithm: 'argon2i',
      version: 19,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      saltB64: 'x',
      hashB64: 'y',
    };
    expect(compareArgon2Params(parsed, ARGON2_PARAMS)).toBe(false);
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('returns 1 for single substitution', () => {
    expect(levenshteinDistance('hello', 'hallo')).toBe(1);
  });

  it('returns 3 for kitten/sitting', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('normalizePasswordForBanlist', () => {
  it('lowercases and trims', () => {
    expect(normalizePasswordForBanlist('  PASSWORD  ')).toBe('password');
  });

  it('is idempotent', () => {
    expect(normalizePasswordForBanlist(normalizePasswordForBanlist('Test'))).toBe('test');
  });
});
