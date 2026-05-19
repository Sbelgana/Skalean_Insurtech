import { describe, it, expect } from 'vitest';
import { validateEventPayload, validateEventEnvelope } from '../../src/helpers/validate-event.js';
import { Topics } from '../../src/topics.js';
import { buildEnvelope } from '../../src/helpers/build-envelope.js';

describe('validateEventPayload', () => {
  it('validates a known topic with correct payload', () => {
    const result = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, {
      user_id: '11111111-1111-4111-9111-111111111111',
      tenant_id: '22222222-2222-4222-9222-222222222222',
      signin_method: 'password',
      ip_address: '10.0.0.1',
      user_agent: 'Test',
      signed_in_at: '2026-05-05T12:00:00.000Z',
      session_id: '33333333-3333-4333-9333-333333333333',
      device_fingerprint: null,
      geo_country: null,
      geo_city: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects payload missing required field', () => {
    const result = validateEventPayload(Topics.AUTH_USER_SIGNED_IN, { user_id: '11111111-1111-4111-9111-111111111111' });
    expect(result.success).toBe(false);
  });

  it('rejects payload with wrong type', () => {
    expect(validateEventPayload(Topics.AUTH_USER_SIGNED_IN, { user_id: 12345 }).success).toBe(false);
  });

  it('rejects undefined payload', () => {
    expect(validateEventPayload(Topics.AUTH_USER_SIGNED_IN, undefined).success).toBe(false);
  });

  it('returns explicit message in failure', () => {
    const result = validateEventPayload(Topics.CRM_CONTACT_CREATED, {});
    if (result.success) throw new Error('expected failure');
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('validateEventEnvelope', () => {
  it('validates complete envelope', () => {
    const envelope = buildEnvelope({
      topic: Topics.SYSTEM_HEALTH_CHANGED,
      payload: {
        service_name: 'auth',
        previous_status: 'healthy',
        current_status: 'degraded',
        changed_at: '2026-05-05T12:00:00.000Z',
        metrics: { latency_ms: 250 },
      },
      tenantId: null,
      userId: null,
      correlationId: null,
    });
    expect(validateEventEnvelope(envelope).success).toBe(true);
  });

  it('rejects envelope with unknown topic', () => {
    const result = validateEventEnvelope({
      event_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      event_name: 'insurtech.events.unknown.thing.happened',
      event_version: '1.0',
      occurred_at: '2026-05-05T12:00:00.000Z',
      tenant_id: null,
      user_id: null,
      correlation_id: null,
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects envelope with invalid event_id', () => {
    const result = validateEventEnvelope({
      event_id: 'not-a-ulid',
      event_name: Topics.SYSTEM_HEALTH_CHANGED,
      event_version: '1.0',
      occurred_at: '2026-05-05T12:00:00.000Z',
      tenant_id: null,
      user_id: null,
      correlation_id: null,
      payload: {},
    });
    expect(result.success).toBe(false);
  });
});
