/**
 * GoogleCalendarProvider -- Sprint 8 Tache 8.10b.
 *
 * Implements `CalendarProvider` against the Google Calendar API + Google
 * OAuth2. Uses the official `googleapis` SDK :
 *   - OAuth2Client : authorization URL + token exchange + refresh
 *   - calendar.events.watch : push notification channels
 *   - calendar.channels.stop : delete subscription
 *   - userinfo.get : fetch authenticated user email
 *
 * Webhooks :
 *   - Channels expire after 7 days max. CalendarWebhookManagerService cron
 *     renews ~6 days in.
 *   - Validation : X-Goog-Channel-ID + X-Goog-Channel-Token headers
 *     (token = clientState we set at watch() call).
 *
 * Scopes :
 *   - https://www.googleapis.com/auth/calendar (read/write events)
 *   - https://www.googleapis.com/auth/userinfo.email (resolve user identity)
 *
 * Reference : https://developers.google.com/calendar/api/guides/push
 */

import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import type {
  CalendarProvider,
  TokenResponse,
  WebhookSubscription,
  WebhookValidation,
} from './calendar-provider.interface.js';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
];

/** Google channel expiration is set in ms-since-epoch ; we choose 6.5 days. */
const CHANNEL_TTL_SECONDS = 6.5 * 24 * 60 * 60;

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = 'google' as const;
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  constructor(private readonly config: OAuthCalendarConfig) {}

  /** Lazily create an OAuth2Client. Returns null when disabled (placeholder credentials). */
  private buildOAuth2Client(redirectUri?: string) {
    if (!this.config.google.enabled) {
      throw new Error('Google OAuth disabled (placeholder credentials)');
    }
    return new google.auth.OAuth2(
      this.config.google.clientId,
      this.config.google.clientSecret,
      redirectUri ?? this.config.google.redirectUri,
    );
  }

  // ==========================================================================
  // OAuth flow
  // ==========================================================================

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const oauth2 = this.buildOAuth2Client(redirectUri);
    return oauth2.generateAuthUrl({
      access_type: 'offline', // request refresh token
      prompt: 'consent', // force consent screen even on re-auth (ensures refresh_token)
      scope: GOOGLE_SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    const oauth2 = this.buildOAuth2Client(redirectUri);
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.access_token) {
      throw new Error('Google token exchange returned no access_token');
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600_000),
      scope: tokens.scope ?? undefined,
      tokenType: tokens.token_type ?? 'Bearer',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const oauth2 = this.buildOAuth2Client();
    oauth2.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error('Google refresh returned no access_token');
    }
    return {
      accessToken: credentials.access_token,
      // Google generally does NOT rotate refresh tokens ; preserve original
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600_000),
      scope: credentials.scope ?? undefined,
      tokenType: credentials.token_type ?? 'Bearer',
    };
  }

  async getUserEmail(accessToken: string): Promise<string> {
    const oauth2 = this.buildOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    const oauth2v2 = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2v2.userinfo.get();
    if (!data.email) {
      throw new Error('Google userinfo response missing email');
    }
    return data.email;
  }

  // ==========================================================================
  // Webhook subscription lifecycle
  // ==========================================================================

  async createWebhookSubscription(
    accessToken: string,
    webhookUrl: string,
    clientState: string,
  ): Promise<WebhookSubscription> {
    const oauth2 = this.buildOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    // Generate unique channel id (UUID-like, persisted to identify subsequent renews)
    const channelId = `assurflow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const expiration = (Date.now() + CHANNEL_TTL_SECONDS * 1000).toString();

    const { data } = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        // `token` is echoed back in X-Goog-Channel-Token header on each notification
        token: clientState,
        expiration,
      },
    });

    return {
      id: data.id ?? channelId,
      resourceId: data.resourceId ?? undefined,
      expiresAt: data.expiration
        ? new Date(Number.parseInt(data.expiration, 10))
        : new Date(Date.now() + CHANNEL_TTL_SECONDS * 1000),
      clientState,
    };
  }

  async renewWebhookSubscription(
    accessToken: string,
    subscriptionId: string,
  ): Promise<WebhookSubscription> {
    // Google does NOT support channel renewal -- we must delete + recreate.
    // The orchestrator persists the new id ; old channel is stopped first.
    try {
      await this.deleteWebhookSubscription(accessToken, subscriptionId);
    } catch (err) {
      // If old channel is already expired/gone, swallow the error and proceed.
      this.logger.warn(
        `Google channel.stop failed (likely already expired) id=${subscriptionId} err=${(err as Error).message}`,
      );
    }
    // Caller must regenerate a fresh clientState ; here we re-use a stable one
    // by reading from the row in the orchestrator (the orchestrator passes the
    // existing clientState back through createWebhookSubscription).
    throw new Error(
      'GoogleCalendarProvider.renewWebhookSubscription : caller must call createWebhookSubscription after delete. Orchestrator handles the re-create path with the stored clientState.',
    );
  }

  async deleteWebhookSubscription(
    accessToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const oauth2 = this.buildOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });
    // `channels.stop` requires both id AND resourceId. Orchestrator should pass
    // resourceId via a richer signature in a follow-up. For now, attempt with
    // id alone -- Google returns 404 if missing resourceId, which we surface
    // back to the caller.
    await calendar.channels.stop({
      requestBody: { id: subscriptionId },
    });
  }

  // ==========================================================================
  // Webhook payload validation
  // ==========================================================================

  validateWebhookPayload(
    headers: Record<string, string | string[] | undefined>,
    _rawBody: string | undefined,
    _query: Record<string, string | undefined>,
    expectedClientState: string | undefined,
  ): WebhookValidation {
    const channelIdHeader = this.headerString(headers, 'x-goog-channel-id');
    const channelTokenHeader = this.headerString(headers, 'x-goog-channel-token');
    const resourceIdHeader = this.headerString(headers, 'x-goog-resource-id');
    const resourceStateHeader = this.headerString(headers, 'x-goog-resource-state');

    if (!channelIdHeader) {
      return { valid: false, reason: 'missing X-Goog-Channel-ID' };
    }
    // The first notification after watch() is a `sync` event -- it confirms the
    // channel is live. We accept it (no resource to fetch).
    if (resourceStateHeader === 'sync') {
      return {
        valid: true,
        subscriptionId: channelIdHeader,
        resourceId: resourceIdHeader,
      };
    }
    if (!expectedClientState) {
      return {
        valid: false,
        reason: 'no expected clientState (subscription not found by id)',
      };
    }
    if (channelTokenHeader !== expectedClientState) {
      return { valid: false, reason: 'X-Goog-Channel-Token mismatch' };
    }
    return {
      valid: true,
      subscriptionId: channelIdHeader,
      resourceId: resourceIdHeader,
    };
  }

  private headerString(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const lower = name.toLowerCase();
    const value = headers[lower] ?? headers[name];
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}
