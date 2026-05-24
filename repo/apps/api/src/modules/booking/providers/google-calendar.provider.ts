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
  ExternalCalendarEvent,
  ExternalCalendarEventInput,
  TokenResponse,
  WebhookNotificationParsed,
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

  // ==========================================================================
  // Phase 2 (Task 8.12) -- Event CRUD + parsed webhook
  // ==========================================================================

  async createEvent(
    accessToken: string,
    event: ExternalCalendarEventInput,
  ): Promise<ExternalCalendarEvent> {
    const calendar = this.calendarClient(accessToken);
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: this.toGoogleEventBody(event),
    });
    return this.fromGoogleEvent(data as unknown as Record<string, unknown>, event);
  }

  async updateEvent(
    accessToken: string,
    eventId: string,
    event: ExternalCalendarEventInput,
  ): Promise<ExternalCalendarEvent> {
    const calendar = this.calendarClient(accessToken);
    const { data } = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: this.toGoogleEventBody(event),
    });
    return this.fromGoogleEvent(data as unknown as Record<string, unknown>, event);
  }

  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const calendar = this.calendarClient(accessToken);
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId });
    } catch (err) {
      // Idempotent : 410 Gone / 404 Not Found are fine -- event already gone.
      const status = (err as { code?: number; status?: number }).code
        ?? (err as { code?: number; status?: number }).status;
      if (status === 404 || status === 410) {
        this.logger.debug(`google_event_delete_already_gone id=${eventId} status=${status}`);
        return;
      }
      throw err;
    }
  }

  async getEvent(
    accessToken: string,
    eventId: string,
  ): Promise<ExternalCalendarEvent | null> {
    const calendar = this.calendarClient(accessToken);
    try {
      const { data } = await calendar.events.get({ calendarId: 'primary', eventId });
      return this.fromGoogleEvent(data as unknown as Record<string, unknown>);
    } catch (err) {
      const status = (err as { code?: number; status?: number }).code
        ?? (err as { code?: number; status?: number }).status;
      if (status === 404 || status === 410) return null;
      throw err;
    }
  }

  /**
   * Google push notifications carry NO body -- everything is in headers. We
   * map X-Goog-Resource-State to a normalized changeType :
   *   - `sync`        : initial channel-live confirmation -> null (skip)
   *   - `exists`      : event added or modified -> 'updated' (caller refetches via getEvent)
   *   - `not_exists`  : event deleted -> 'deleted'
   *
   * Note : Google does not distinguish create vs update in headers -- both
   * arrive as `exists`. SyncWorker derives the actual mutation by checking
   * if the local appointment has externalCalendarEventId set.
   */
  parseWebhookNotification(
    headers: Record<string, string | string[] | undefined>,
    _body: unknown,
  ): WebhookNotificationParsed | null {
    const channelId = this.headerString(headers, 'x-goog-channel-id');
    const resourceId = this.headerString(headers, 'x-goog-resource-id');
    const resourceState = this.headerString(headers, 'x-goog-resource-state');
    if (!channelId || !resourceId) return null;
    if (resourceState === 'sync') return null;
    const changeType: 'updated' | 'deleted' =
      resourceState === 'not_exists' ? 'deleted' : 'updated';
    return {
      subscriptionId: channelId,
      resourceId,
      changeType,
    };
  }

  // ==========================================================================
  // Google event mappers
  // ==========================================================================

  private calendarClient(accessToken: string) {
    const oauth2 = this.buildOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth: oauth2 });
  }

  private toGoogleEventBody(event: ExternalCalendarEventInput): Record<string, unknown> {
    return {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startAt.toISOString(),
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.endAt.toISOString(),
        timeZone: event.timezone,
      },
      attendees: event.attendees.map((a) => ({
        displayName: a.name,
        ...(a.email ? { email: a.email } : {}),
      })),
    };
  }

  private fromGoogleEvent(
    data: Record<string, unknown> | undefined | null,
    fallbackInput?: ExternalCalendarEventInput,
  ): ExternalCalendarEvent {
    const d = data ?? {};
    const start = d['start'] as { dateTime?: string; timeZone?: string } | undefined;
    const end = d['end'] as { dateTime?: string; timeZone?: string } | undefined;
    const attendeesRaw = (d['attendees'] as Array<{ displayName?: string; email?: string }>) ?? [];
    const id = (d['id'] as string | undefined) ?? '';
    const updated = (d['updated'] as string | undefined)
      ?? (d['created'] as string | undefined);
    const created = (d['created'] as string | undefined) ?? updated;
    const startAt = start?.dateTime
      ? new Date(start.dateTime)
      : fallbackInput?.startAt ?? new Date();
    const endAt = end?.dateTime
      ? new Date(end.dateTime)
      : fallbackInput?.endAt ?? new Date();
    const timezone = start?.timeZone ?? fallbackInput?.timezone ?? 'UTC';
    return {
      id,
      title: (d['summary'] as string | undefined) ?? fallbackInput?.title ?? '',
      description:
        (d['description'] as string | undefined) ?? fallbackInput?.description,
      startAt,
      endAt,
      timezone,
      attendees: attendeesRaw.map((a) => ({
        name: a.displayName ?? a.email ?? 'Unknown',
        ...(a.email ? { email: a.email } : {}),
      })),
      location: (d['location'] as string | undefined) ?? fallbackInput?.location,
      lastModifiedAt: updated ? new Date(updated) : new Date(),
      createdAt: created ? new Date(created) : new Date(),
    };
  }
}
