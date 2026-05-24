/**
 * Tests GoogleCalendarProvider -- Sprint 8 Tache 8.10b.
 *
 * Unit tests with HTTP mocked via nock. Covers OAuth authorization URL
 * building, token exchange, refresh, getUserEmail, webhook validation.
 *
 * createWebhookSubscription / deleteWebhookSubscription happy-path HTTP
 * tests are deferred Task 8.14 (depend on googleapis SDK's outbound request
 * format which is more cleanly tested end-to-end with real credentials).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import nock from 'nock';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import { GoogleCalendarProvider } from './google-calendar.provider.js';

const ENV_BACKUP: Record<string, string | undefined> = {};
const ENV_KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
];

function setupEnv(): void {
  for (const k of ENV_KEYS) ENV_BACKUP[k] = process.env[k];
  process.env['GOOGLE_OAUTH_CLIENT_ID'] = '123-test.apps.googleusercontent.com';
  process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'GOCSPX-test-secret';
  process.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'https://test.example.com/api/v1/booking/calendar/callback/google';
}

function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (ENV_BACKUP[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_BACKUP[k];
  }
}

function buildProvider(): GoogleCalendarProvider {
  const config = new OAuthCalendarConfig();
  return new GoogleCalendarProvider(config);
}

describe('GoogleCalendarProvider (Sprint 8 Tache 8.10b)', () => {
  beforeEach(() => {
    setupEnv();
    nock.cleanAll();
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    restoreEnv();
  });

  describe('getAuthorizationUrl (no HTTP)', () => {
    it('1. builds URL with required scopes + state + access_type=offline', () => {
      const provider = buildProvider();
      const url = provider.getAuthorizationUrl(
        'csrf-state-123',
        'https://test.example.com/cb',
      );
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('state=csrf-state-123');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('userinfo.email');
      expect(url).toContain('auth%2Fcalendar');
    });

    it('2. throws when provider disabled (placeholder credentials)', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      const provider = buildProvider();
      expect(() =>
        provider.getAuthorizationUrl('state', 'https://test.example.com/cb'),
      ).toThrow(/disabled/i);
    });
  });

  describe('exchangeCodeForTokens (HTTP mocked)', () => {
    it('3. POSTs code to /token and returns parsed TokenResponse', async () => {
      const provider = buildProvider();
      const scope = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {
          access_token: 'ya29.test-access',
          refresh_token: '1//test-refresh',
          expires_in: 3599,
          scope: 'https://www.googleapis.com/auth/calendar',
          token_type: 'Bearer',
        });
      const result = await provider.exchangeCodeForTokens(
        'auth-code-from-google',
        'https://test.example.com/cb',
      );
      expect(scope.isDone()).toBe(true);
      expect(result.accessToken).toBe('ya29.test-access');
      expect(result.refreshToken).toBe('1//test-refresh');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('refreshAccessToken (HTTP mocked)', () => {
    it('4. POSTs refresh_token and returns new access_token', async () => {
      const provider = buildProvider();
      const scope = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {
          access_token: 'ya29.refreshed',
          expires_in: 3599,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/calendar',
        });
      const result = await provider.refreshAccessToken('1//original-refresh');
      expect(scope.isDone()).toBe(true);
      expect(result.accessToken).toBe('ya29.refreshed');
      // Google does not rotate refresh tokens -- original preserved
      expect(result.refreshToken).toBe('1//original-refresh');
    });
  });

  describe('validateWebhookPayload (no HTTP)', () => {
    it('5. accepts sync notification (initial channel handshake)', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {
          'x-goog-channel-id': 'channel-abc',
          'x-goog-resource-id': 'resource-xyz',
          'x-goog-resource-state': 'sync',
        },
        undefined,
        {},
        'expected-client-state',
      );
      expect(result.valid).toBe(true);
      expect(result.subscriptionId).toBe('channel-abc');
    });

    it('6. accepts normal notification with matching channel token', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {
          'x-goog-channel-id': 'channel-abc',
          'x-goog-channel-token': 'expected-client-state',
          'x-goog-resource-id': 'event-id-456',
          'x-goog-resource-state': 'exists',
        },
        undefined,
        {},
        'expected-client-state',
      );
      expect(result.valid).toBe(true);
      expect(result.subscriptionId).toBe('channel-abc');
      expect(result.resourceId).toBe('event-id-456');
    });

    it('7. rejects when X-Goog-Channel-ID missing', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        { 'x-goog-channel-token': 'whatever' },
        undefined,
        {},
        'expected',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Channel-ID/i);
    });

    it('8. rejects when channel token mismatch', () => {
      const provider = buildProvider();
      const result = provider.validateWebhookPayload(
        {
          'x-goog-channel-id': 'channel-abc',
          'x-goog-channel-token': 'attacker-token',
          'x-goog-resource-state': 'exists',
        },
        undefined,
        {},
        'expected-client-state',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/mismatch/i);
    });
  });
});
