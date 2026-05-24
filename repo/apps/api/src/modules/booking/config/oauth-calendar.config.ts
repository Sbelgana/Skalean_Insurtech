/**
 * OAuthCalendarConfig -- Sprint 8 Tache 8.10b.
 *
 * Boot-time config reader for OAuth Calendar providers (Google + Microsoft).
 *
 * Placeholders strategy (user-validated Task 8.10b prompt) :
 *   - Env vars MAY contain `PLACEHOLDER_` prefix values for "not yet configured"
 *     state. This is the default in .env.example / .env.test / .env.development.
 *   - This service detects the prefix and exposes `googleEnabled` /
 *     `outlookEnabled` flags. Controller / Service layers return HTTP 503
 *     Service Unavailable on OAuth endpoints when the relevant provider is
 *     disabled -- clean UX vs cryptic failure deep in the call stack.
 *   - Activation : swap 6 lines in .env.development to real credentials + restart.
 *     Zero code change.
 *
 * Reference : B-08 Tache 3.2.5 + docs/setup-oauth-calendar.md.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export type CalendarProviderName = 'google' | 'outlook';

export interface ProviderConfig {
  readonly enabled: boolean;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  /** Microsoft-specific : tenant id ('common' for multi-tenant, GUID otherwise). */
  readonly tenant?: string;
}

const PLACEHOLDER_PREFIX = 'PLACEHOLDER_';

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return value.startsWith(PLACEHOLDER_PREFIX) || value.includes(PLACEHOLDER_PREFIX);
}

@Injectable()
export class OAuthCalendarConfig implements OnModuleInit {
  private readonly logger = new Logger(OAuthCalendarConfig.name);

  readonly google: ProviderConfig;
  readonly outlook: ProviderConfig;
  readonly webhookBaseUrl: string;
  readonly webhookEnabled: boolean;

  constructor() {
    const googleClientId = process.env['GOOGLE_OAUTH_CLIENT_ID'];
    const googleClientSecret = process.env['GOOGLE_OAUTH_CLIENT_SECRET'];
    const googleRedirectUri = process.env['GOOGLE_OAUTH_REDIRECT_URI'];
    const googleEnabled =
      !isPlaceholder(googleClientId) &&
      !isPlaceholder(googleClientSecret) &&
      !isPlaceholder(googleRedirectUri);

    this.google = {
      enabled: googleEnabled,
      clientId: googleClientId ?? '',
      clientSecret: googleClientSecret ?? '',
      redirectUri: googleRedirectUri ?? '',
    };

    const msClientId = process.env['MICROSOFT_OAUTH_CLIENT_ID'];
    const msClientSecret = process.env['MICROSOFT_OAUTH_CLIENT_SECRET'];
    const msRedirectUri = process.env['MICROSOFT_OAUTH_REDIRECT_URI'];
    const msTenant = process.env['MICROSOFT_OAUTH_TENANT'] ?? 'common';
    const outlookEnabled =
      !isPlaceholder(msClientId) &&
      !isPlaceholder(msClientSecret) &&
      !isPlaceholder(msRedirectUri);

    this.outlook = {
      enabled: outlookEnabled,
      clientId: msClientId ?? '',
      clientSecret: msClientSecret ?? '',
      redirectUri: msRedirectUri ?? '',
      tenant: msTenant,
    };

    const webhookUrl = process.env['CALENDAR_WEBHOOK_BASE_URL'];
    this.webhookBaseUrl = webhookUrl ?? '';
    this.webhookEnabled = !isPlaceholder(webhookUrl);
  }

  onModuleInit(): void {
    if (this.google.enabled && this.outlook.enabled) {
      this.logger.log('OAuth Calendar : google + outlook enabled');
    } else if (this.google.enabled) {
      this.logger.log('OAuth Calendar : google enabled, outlook DISABLED (placeholder)');
    } else if (this.outlook.enabled) {
      this.logger.log('OAuth Calendar : outlook enabled, google DISABLED (placeholder)');
    } else {
      this.logger.warn(
        'OAuth Calendar : ALL providers DISABLED (placeholder credentials detected). Endpoints return 503. ' +
          'Activate via .env.development real credentials + restart. See docs/setup-oauth-calendar.md.',
      );
    }
    if (!this.webhookEnabled) {
      this.logger.warn(
        'OAuth Calendar webhook base URL is a placeholder. Subscriptions will be created with bogus URL and never receive notifications. Set CALENDAR_WEBHOOK_BASE_URL to your ngrok / real domain.',
      );
    }
  }

  /** Returns config for the given provider name. */
  getProvider(provider: CalendarProviderName): ProviderConfig {
    return provider === 'google' ? this.google : this.outlook;
  }

  /**
   * Phase 2 (Task 8.12) -- returns true when at least one provider is enabled.
   * Used by sync worker to no-op cleanly under placeholder credentials.
   */
  isAnyEnabled(): boolean {
    return this.google.enabled || this.outlook.enabled;
  }

  /** Convenience : full webhook URL for a given provider (e.g. /google or /outlook suffix). */
  webhookUrlFor(provider: CalendarProviderName): string {
    return `${this.webhookBaseUrl}/${provider}`;
  }

  /** Throws Logger-friendly error if a provider is disabled. Callers map to 503. */
  ensureEnabled(provider: CalendarProviderName): void {
    if (!this.getProvider(provider).enabled) {
      throw new Error(
        `Provider "${provider}" is disabled (placeholder credentials). ` +
          'Configure real credentials in .env.development and restart.',
      );
    }
  }
}
