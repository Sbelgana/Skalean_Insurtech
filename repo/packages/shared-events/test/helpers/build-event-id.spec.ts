import { describe, it, expect } from 'vitest';
import { buildEventId, buildEventIdNonMonotonic, extractTimestampFromUlid } from '../../src/helpers/build-event-id.js';
import { ULID_REGEX } from '../../src/types/event-envelope.js';

describe('buildEventId', () => {
  it('returns 26-char string', () => { expect(buildEventId().length).toBe(26); });
  it('matches ULID regex Crockford base32', () => { expect(ULID_REGEX.test(buildEventId())).toBe(true); });
  it('does not contain excluded chars I, L, O, U', () => { expect(buildEventId()).not.toMatch(/[ILOU]/); });
  it('produces monotonic ordering for rapid calls', () => {
    const ids = Array.from({ length: 100 }, () => buildEventId());
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! > ids[i - 1]!).toBe(true);
    }
  });
  it('non-monotonic also matches regex', () => { expect(ULID_REGEX.test(buildEventIdNonMonotonic())).toBe(true); });
  it('extracts timestamp matching seedTime', () => {
    const seed = Date.UTC(2026, 4, 5, 12, 0, 0);
    const id = buildEventId(seed);
    expect(extractTimestampFromUlid(id)).toBe(seed);
  });
});
