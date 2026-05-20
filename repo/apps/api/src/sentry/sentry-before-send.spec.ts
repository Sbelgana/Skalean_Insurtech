/**
 * Tests sentryBeforeSend -- PII scrubber hook.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.12 (Sprint 3 / Phase 1).
 */
import { describe, it, expect } from 'vitest';
import type { ErrorEvent, EventHint } from '@sentry/nestjs';
import { sentryBeforeSend } from './sentry-before-send';

/** Helper : cree un ErrorEvent minimal avec champs optionnels. */
function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { ...overrides } as ErrorEvent;
}

const EMPTY_HINT = {} as EventHint;

describe('sentryBeforeSend', () => {
  it('retourne l\'event si aucun champ sensible', () => {
    const event = makeEvent({ extra: { userId: '123', action: 'login' } });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect(result).not.toBeNull();
    expect(result?.extra?.['userId']).toBe('123');
  });

  it('masque le champ password dans extra', () => {
    const event = makeEvent({ extra: { username: 'admin', password: 's3cr3t' } });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect(result?.extra?.['password']).toBe('[REDACTED]');
    expect(result?.extra?.['username']).toBe('admin');
  });

  it('masque le champ authorization dans request.headers', () => {
    const event = makeEvent({
      request: {
        headers: { authorization: 'Bearer JWT_TOKEN', 'content-type': 'application/json' },
      },
    });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    const headers = result?.request?.headers as Record<string, string>;
    expect(headers?.['authorization']).toBe('[REDACTED]');
    expect(headers?.['content-type']).toBe('application/json');
  });

  it('masque le champ email dans extra', () => {
    const event = makeEvent({ extra: { email: 'user@skalean.ma', role: 'broker' } });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect(result?.extra?.['email']).toBe('[REDACTED]');
    expect(result?.extra?.['role']).toBe('broker');
  });

  it('masque le champ cin (insensible a la casse)', () => {
    const event = makeEvent({ extra: { CIN: 'AB123456' } });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect(result?.extra?.['CIN']).toBe('[REDACTED]');
  });

  it('masque les champs sensibles dans request.data', () => {
    const event = makeEvent({
      request: {
        data: { username: 'bob', password: 'pass123', phone: '+212600000000' },
      },
    });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    const data = result?.request?.data as Record<string, string>;
    expect(data?.['password']).toBe('[REDACTED]');
    expect(data?.['phone']).toBe('[REDACTED]');
    expect(data?.['username']).toBe('bob');
  });

  it('masque les champs token et access_token', () => {
    const event = makeEvent({
      extra: { token: 'abc123', access_token: 'xyz789', userId: 'u1' },
    });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect(result?.extra?.['token']).toBe('[REDACTED]');
    expect(result?.extra?.['access_token']).toBe('[REDACTED]');
    expect(result?.extra?.['userId']).toBe('u1');
  });

  it('masque les tags sensibles', () => {
    const event = makeEvent({ tags: { tenant_id: 't1', secret: 'mysecret' } });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect((result?.tags as Record<string, string>)?.['secret']).toBe('[REDACTED]');
    expect((result?.tags as Record<string, string>)?.['tenant_id']).toBe('t1');
  });

  it('preserv les champs non-sensibles intacts', () => {
    const event = makeEvent({
      extra: { requestId: 'abc-123', statusCode: 500, action: 'create_policy' },
    });
    const result = sentryBeforeSend(event, EMPTY_HINT);
    expect(result?.extra?.['requestId']).toBe('abc-123');
    expect(result?.extra?.['statusCode']).toBe(500);
    expect(result?.extra?.['action']).toBe('create_policy');
  });
});
