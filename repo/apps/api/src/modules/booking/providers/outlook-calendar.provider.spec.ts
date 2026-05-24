/**
 * Tests OutlookCalendarProvider -- Sprint 8 Tache 8.10b.
 *
 * Unit tests focus on : authorization URL building, webhook validation.
 * HTTP roundtrip tests against msal-node + Microsoft Graph mock endpoints
 * are deferred Task 8.14 (msal-node internals are complex and brittle to
 * mock at the HTTP layer ; integration tests with real Microsoft sandbox
 * tenant are more reliable).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import { OutlookCalendarProvider } from './outlook-calendar.provider.js';

const ENV_BACKUP: Record<string, string | undefined> = {};
const ENV_KEYS = [
  'MICROSOFT_OAUTH_CLIENT_ID',
  'MICROSOFT_OAUTH_CLIENT_SECRET',
  'MICROSOFT_OAUTH_REDIRECT_URI',
  'MICROSOFT_OAUTH_TENANT',
];

function setupEnv(): void {
  for (const k of ENV_KEYS) ENV_BACKUP[k] = process.env[k];
  process.env['MICROSOFT_OAUTH_CLIENT_ID'] = '00000000-aaaa-bbbb-cccc-000000000001';
  process.env['MICROSOFT_OAUTH_CLIENT_SECRET'] = 'test-ms-secret';
  process.env['MICROSOFT_OAUTH_REDIRECT_URI'] =
    'https://test.example.com/api/v1/booking/calendar/callback/outlook';
  process.env['MICROSOFT_OAUTH_TENANT'] = 'common';
}

function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (ENV_BACKUP[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_BACKUP[k];
  }
}

function buildProvider(): OutlookCalendarProvider {
  const config = new OAuthCalendarConfig();
  return new OutlookCalendarProvider(config);
}

describe('OutlookCalendarProvider (Sprint 8 Tache 8.10b)', () => {
  beforeEach(() => {
    setupEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  describe('getAuthorizationUrl', () => {
    it('1. builds URL pointing to login.microsoftonline.com/common', () => {
      const provider = buildProvider();
      const url = provider.getAuthorizationUrl(
        'csrf-state-456',
        'https://test.example.com/cb/outlook',
      );
      expect(url).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain('state=csrf-state-456');
      expect(url).toContain('response_type=code');
      expect(url).toContain('Calendars.ReadWrite');
      expect(url).toContain('offline_access');
      expect(url).toContain('User.Read');
    });

    it('2. honors custom tenant id (vs default common)', () => {
      process.env['MICROSOFT_OAUTH_TENANT'] = 'my-tenant-guid-12345';
      const provider = buildProvider();
      const url = provider.getAuthorizationUrl('s', 'https://test.example.com/cb');
      expect(url).toContain('login.microsoftonline.com/my-tenant-guid-12345');
    });

    it('3. throws when provider disabled (placeholder credentials)', () => {
      process.env['MICROSOFT_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      const provider = buildProvider();
      expect(() => provider.getAuthorizationUrl('s', 'https://test.example.com/cb')).toThrow(
        /disabled/i,
      );
    });
  });

  describe('validateWebhookPayload (no HTTP)', () => {
    it('4. accepts validation handshake (GET with validationToken query param)', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {},
        undefined,
        { validationToken: 'echo-this-back-12345' },
        undefined,
      );
      expect(result.valid).toBe(true);
      expect(result.validationTokenEcho).toBe('echo-this-back-12345');
    });

    it('5. accepts normal notification with matching clientState', () => {
      const provider = buildProvider();
      const body = JSON.stringify({
        value: [
          {
            subscriptionId: 'sub-abc-123',
            clientState: 'expected-secret',
            resourceData: { id: 'event-id-789' },
          },
        ],
      });
      const result = provider.validateWebhookPayload({}, body, {}, 'expected-secret');
      expect(result.valid).toBe(true);
      expect(result.subscriptionId).toBe('sub-abc-123');
      expect(result.resourceId).toBe('event-id-789');
    });

    it('6. rejects when clientState mismatch', () => {
      const provider = buildProvider();
      const body = JSON.stringify({
        value: [{ subscriptionId: 'sub-abc', clientState: 'attacker-secret' }],
      });
      const result = provider.validateWebhookPayload({}, body, {}, 'expected-secret');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/clientState mismatch/i);
      // subscriptionId still surfaced for logging
      expect(result.subscriptionId).toBe('sub-abc');
    });

    it('7. rejects when body missing', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload({}, undefined, {}, 'expected');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/missing body/i);
    });

    it('8. rejects invalid JSON', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {},
        '{not valid json',
        {},
        'expected',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/invalid JSON/i);
    });

    it('9. rejects empty notifications array', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {},
        JSON.stringify({ value: [] }),
        {},
        'expected',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/empty/i);
    });

    it('10. rejects missing subscriptionId', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {},
        JSON.stringify({ value: [{ clientState: 'x' }] }),
        {},
        'expected',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/missing subscriptionId/i);
    });
  });
});
