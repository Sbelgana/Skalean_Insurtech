import { ulid, monotonicFactory } from 'ulid';

const monotonic = monotonicFactory();

export function buildEventId(seedTime?: number): string {
  if (seedTime !== undefined) {
    // Use a fresh factory so the exact seedTime is encoded in the ULID timestamp.
    // The module-level singleton may have advanced past seedTime (it never goes backwards).
    return monotonicFactory()(seedTime);
  }
  return monotonic();
}

export function buildEventIdNonMonotonic(): string {
  return ulid();
}

export function extractTimestampFromUlid(eventId: string): number {
  if (eventId.length !== 26) {
    throw new Error(`Invalid ULID length: expected 26, got ${eventId.length}`);
  }
  const timePart = eventId.substring(0, 10);
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timestamp = 0;
  for (let i = 0; i < timePart.length; i++) {
    const char = timePart[i];
    if (char === undefined) continue;
    const value = ENCODING.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid ULID character: ${char}`);
    }
    timestamp = timestamp * 32 + value;
  }
  return timestamp;
}
