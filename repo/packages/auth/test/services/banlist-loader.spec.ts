/**
 * Tests for @insurtech/auth/data/banlist-loader
 * Sprint 5 Tache 2.1.2
 */

import { describe, expect, it } from 'vitest';
import { loadBanlist, resetBanlistCache } from '../../src/data/banlist-loader.js';

describe('loadBanlist', () => {
  it('returns a frozen Set of >= 100 normalized passwords', () => {
    resetBanlistCache();
    const banlist = loadBanlist();
    expect(banlist.size).toBeGreaterThanOrEqual(100);
    expect(Object.isFrozen(banlist)).toBe(true);
  });

  it('contains common weak passwords', () => {
    const banlist = loadBanlist();
    expect(banlist.has('password')).toBe(true);
    expect(banlist.has('123456')).toBe(true);
    expect(banlist.has('qwerty')).toBe(true);
  });

  it('entries are lowercased', () => {
    const banlist = loadBanlist();
    for (const entry of banlist) {
      expect(entry).toBe(entry.toLowerCase());
    }
  });

  it('cached singleton -- second call returns same reference', () => {
    const b1 = loadBanlist();
    const b2 = loadBanlist();
    expect(b1).toBe(b2);
  });
});
