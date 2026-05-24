/**
 * Tests OAuthCalendarConfig -- Sprint 8 Tache 8.10b.
 *
 * Covers placeholder detection : when env vars start with PLACEHOLDER_ or
 * are missing, the corresponding provider must report `enabled = false`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthCalendarConfig } from './oauth-calendar.config.js';

const ENV_KEYS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'MICROSOFT_OAUTH_CLIENT_ID',
  'MICROSOFT_OAUTH_CLIENT_SECRET',
  'MICROSOFT_OAUTH_REDIRECT_URI',
  'MICROSOFT_OAUTH_TENANT',
  'CALENDAR_WEBHOOK_BASE_URL',
];

function snapshotEnv(): Map<string, string | undefined> {
  const m = new Map<string, string | undefined>();
  for (const k of ENV_KEYS) m.set(k, process.env[k]);
  return m;
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const [k, v] of snapshot) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('OAuthCalendarConfig (Sprint 8 Tache 8.10b)', () => {
  let envSnapshot: Map<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  describe('placeholder detection', () => {
    it('1. detects PLACEHOLDER_ prefix on Google client id -> google disabled', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_GOOGLE_CLIENT_ID';
      process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'real-secret-value';
      process.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb';
      const config = new OAuthCalendarConfig();
      expect(config.google.enabled).toBe(false);
    });

    it('2. detects PLACEHOLDER_ in redirect URI (NGROK_URL placeholder) -> google disabled', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = '123.apps.googleusercontent.com';
      process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'GOCSPX-real';
      process.env['GOOGLE_OAUTH_REDIRECT_URI'] =
        'https://PLACEHOLDER_NGROK_URL.ngrok-free.app/api/v1/booking/calendar/callback/google';
      const config = new OAuthCalendarConfig();
      expect(config.google.enabled).toBe(false);
    });

    it('3. all real values -> google enabled', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = '123.apps.googleusercontent.com';
      process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'GOCSPX-real';
      process.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb/google';
      const config = new OAuthCalendarConfig();
      expect(config.google.enabled).toBe(true);
      expect(config.google.clientId).toBe('123.apps.googleusercontent.com');
    });

    it('4. missing env var -> provider disabled', () => {
      delete process.env['GOOGLE_OAUTH_CLIENT_ID'];
      delete process.env['GOOGLE_OAUTH_CLIENT_SECRET'];
      delete process.env['GOOGLE_OAUTH_REDIRECT_URI'];
      const config = new OAuthCalendarConfig();
      expect(config.google.enabled).toBe(false);
    });

    it('5. outlook detection independent of google', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'PLACEHOLDER_y';
      process.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'PLACEHOLDER_z';
      process.env['MICROSOFT_OAUTH_CLIENT_ID'] = 'aaaa-bbbb-cccc';
      process.env['MICROSOFT_OAUTH_CLIENT_SECRET'] = 'real-ms-secret';
      process.env['MICROSOFT_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb/outlook';
      const config = new OAuthCalendarConfig();
      expect(config.google.enabled).toBe(false);
      expect(config.outlook.enabled).toBe(true);
    });

    it('6. outlook tenant defaults to "common" if unset', () => {
      process.env['MICROSOFT_OAUTH_CLIENT_ID'] = 'aaaa';
      process.env['MICROSOFT_OAUTH_CLIENT_SECRET'] = 'real';
      process.env['MICROSOFT_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb';
      delete process.env['MICROSOFT_OAUTH_TENANT'];
      const config = new OAuthCalendarConfig();
      expect(config.outlook.tenant).toBe('common');
    });
  });

  describe('webhook url', () => {
    it('7. webhookEnabled false when CALENDAR_WEBHOOK_BASE_URL is placeholder', () => {
      process.env['CALENDAR_WEBHOOK_BASE_URL'] =
        'https://PLACEHOLDER_NGROK_URL.ngrok-free.app/api/v1/booking/calendar/webhook';
      const config = new OAuthCalendarConfig();
      expect(config.webhookEnabled).toBe(false);
    });

    it('8. webhookUrlFor appends provider name', () => {
      process.env['CALENDAR_WEBHOOK_BASE_URL'] = 'https://real.example.com/api/wh';
      const config = new OAuthCalendarConfig();
      expect(config.webhookUrlFor('google')).toBe('https://real.example.com/api/wh/google');
      expect(config.webhookUrlFor('outlook')).toBe('https://real.example.com/api/wh/outlook');
    });
  });

  describe('helpers', () => {
    it('9. getProvider("google") returns google config', () => {
      const config = new OAuthCalendarConfig();
      const provider = config.getProvider('google');
      expect(provider).toBe(config.google);
    });

    it('10. ensureEnabled throws when disabled', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      const config = new OAuthCalendarConfig();
      expect(() => config.ensureEnabled('google')).toThrow(/disabled/i);
    });

    it('11. ensureEnabled does NOT throw when enabled', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'real-id';
      process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'real-secret';
      process.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'https://real.example.com/cb';
      const config = new OAuthCalendarConfig();
      expect(() => config.ensureEnabled('google')).not.toThrow();
    });
  });

  describe('onModuleInit logging', () => {
    it('12. logs warning when both providers disabled', () => {
      process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      process.env['MICROSOFT_OAUTH_CLIENT_ID'] = 'PLACEHOLDER_x';
      const config = new OAuthCalendarConfig();
      const warnSpy = vi.spyOn(config['logger'], 'warn').mockImplementation(() => undefined);
      config.onModuleInit();
      expect(warnSpy).toHaveBeenCalled();
      const calls = warnSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((c) => c.toLowerCase().includes('all providers disabled'))).toBe(true);
    });
  });
});
