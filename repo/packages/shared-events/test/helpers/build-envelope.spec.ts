import { describe, it, expect } from 'vitest';
import { buildEnvelope } from '../../src/helpers/build-envelope.js';
import { Topics } from '../../src/topics.js';
import { ULID_REGEX } from '../../src/types/event-envelope.js';

const tenantId = '22222222-2222-4222-9222-222222222222';

describe('buildEnvelope', () => {
  it('generates ULID event_id', () => {
    const e = buildEnvelope({ topic: Topics.SYSTEM_CONFIG_UPDATED, payload: { config_key: 'k', previous_value: null, new_value: 1, updated_at: '2026-05-05T12:00:00.000Z', updated_by_user_id: null }, tenantId, userId: null, correlationId: null });
    expect(ULID_REGEX.test(e.event_id)).toBe(true);
  });
  it('defaults event_version to 1.0', () => {
    const e = buildEnvelope({ topic: Topics.SYSTEM_CONFIG_UPDATED, payload: {} as never, tenantId, userId: null, correlationId: null });
    expect(e.event_version).toBe('1.0');
  });
  it('passes through custom event_version', () => {
    const e = buildEnvelope({ topic: Topics.SYSTEM_CONFIG_UPDATED, payload: {} as never, tenantId, userId: null, correlationId: null, eventVersion: '2.1' });
    expect(e.event_version).toBe('2.1');
  });
  it('emits ISO datetime for occurred_at', () => {
    const e = buildEnvelope({ topic: Topics.SYSTEM_CONFIG_UPDATED, payload: {} as never, tenantId, userId: null, correlationId: null });
    expect(() => new Date(e.occurred_at).toISOString()).not.toThrow();
  });
  it('event_name equals topic', () => {
    const e = buildEnvelope({ topic: Topics.AUTH_USER_SIGNED_IN, payload: {} as never, tenantId, userId: null, correlationId: null });
    expect(e.event_name).toBe(Topics.AUTH_USER_SIGNED_IN);
  });
});
