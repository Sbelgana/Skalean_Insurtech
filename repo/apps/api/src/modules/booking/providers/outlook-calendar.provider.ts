/**
 * OutlookCalendarProvider -- Sprint 8 Tache 8.10b.
 *
 * Implements `CalendarProvider` against the Microsoft Graph API + Microsoft
 * identity platform v2.0 :
 *   - @azure/msal-node ConfidentialClientApplication for OAuth2
 *   - @microsoft/microsoft-graph-client for /me, /subscriptions, /me/events
 *
 * Webhooks (Microsoft Graph subscriptions) :
 *   - Max expiration : 4230 minutes (~70 hours) for calendar events
 *   - Renewal : POST /subscriptions/{id} with new expirationDateTime
 *   - Initial subscription handshake : Microsoft sends GET with
 *     `validationToken` query param ; we respond text/plain echo within 10s
 *   - Normal notification : POST with body { value: [{ subscriptionId, clientState, resourceData ... }] }
 *
 * Scopes :
 *   - Calendars.ReadWrite (events CRUD)
 *   - User.Read (resolve user identity)
 *   - offline_access (refresh tokens)
 *
 * Reference : https://learn.microsoft.com/en-us/graph/webhooks
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ConfidentialClientApplication,
  type Configuration,
} from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import type {
  CalendarProvider,
  TokenResponse,
  WebhookSubscription,
  WebhookValidation,
} from './calendar-provider.interface.js';

const MICROSOFT_SCOPES = ['Calendars.ReadWrite', 'User.Read', 'offline_access'];

/** MS Graph max 4230 min for /me/events ; we choose 4200 min (~70h) for safety margin. */
const SUBSCRIPTION_TTL_MINUTES = 4200;

@Injectable()
export class OutlookCalendarProvider implements CalendarProvider {
  readonly name = 'outlook' as const;
  private readonly logger = new Logger(OutlookCalendarProvider.name);

  constructor(private readonly config: OAuthCalendarConfig) {}

  private buildMsalClient(): ConfidentialClientApplication {
    if (!this.config.outlook.enabled) {
      throw new Error('Outlook OAuth disabled (placeholder credentials)');
    }
    const msalConfig: Configuration = {
      auth: {
        clientId: this.config.outlook.clientId,
        clientSecret: this.config.outlook.clientSecret,
        authority: `https://login.microsoftonline.com/${this.config.outlook.tenant ?? 'common'}`,
      },
    };
    return new ConfidentialClientApplication(msalConfig);
  }

  private buildGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }

  // ==========================================================================
  // OAuth flow
  // ==========================================================================

  getAuthorizationUrl(state: string, redirectUri: string): string {
    if (!this.config.outlook.enabled) {
      throw new Error('Outlook OAuth disabled (placeholder credentials)');
    }
    const tenant = this.config.outlook.tenant ?? 'common';
    const params = new URLSearchParams({
      client_id: this.config.outlook.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: MICROSOFT_SCOPES.join(' '),
      state,
      prompt: 'select_account',
    });
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    const client = this.buildMsalClient();
    const result = await client.acquireTokenByCode({
      code,
      scopes: MICROSOFT_SCOPES,
      redirectUri,
    });
    if (!result?.accessToken) {
      throw new Error('Microsoft token exchange returned no access_token');
    }
    return {
      accessToken: result.accessToken,
      // msal-node stores refresh tokens internally in its token cache. For our
      // own persistence we need to expose them ; serialize the cache and parse.
      refreshToken: this.extractRefreshTokenFromCache(client),
      expiresAt: result.expiresOn ?? new Date(Date.now() + 3600_000),
      scope: result.scopes?.join(' '),
      tokenType: result.tokenType ?? 'Bearer',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const client = this.buildMsalClient();
    const result = await client.acquireTokenByRefreshToken({
      refreshToken,
      scopes: MICROSOFT_SCOPES,
    });
    if (!result?.accessToken) {
      throw new Error('Microsoft refresh returned no access_token');
    }
    return {
      accessToken: result.accessToken,
      // MS may rotate refresh tokens ; capture if rotated
      refreshToken: this.extractRefreshTokenFromCache(client) ?? refreshToken,
      expiresAt: result.expiresOn ?? new Date(Date.now() + 3600_000),
      scope: result.scopes?.join(' '),
      tokenType: result.tokenType ?? 'Bearer',
    };
  }

  async getUserEmail(accessToken: string): Promise<string> {
    const graph = this.buildGraphClient(accessToken);
    const me = await graph.api('/me').select(['mail', 'userPrincipalName']).get();
    const email = me.mail ?? me.userPrincipalName;
    if (!email) {
      throw new Error('Microsoft /me response missing mail and userPrincipalName');
    }
    return email;
  }

  // ==========================================================================
  // Webhook subscription lifecycle
  // ==========================================================================

  async createWebhookSubscription(
    accessToken: string,
    webhookUrl: string,
    clientState: string,
  ): Promise<WebhookSubscription> {
    const graph = this.buildGraphClient(accessToken);
    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_TTL_MINUTES * 60_000,
    ).toISOString();
    const subscription = await graph.api('/subscriptions').post({
      changeType: 'created,updated,deleted',
      notificationUrl: webhookUrl,
      resource: '/me/events',
      expirationDateTime,
      clientState,
    });
    return {
      id: subscription.id,
      expiresAt: new Date(subscription.expirationDateTime),
      clientState,
    };
  }

  async renewWebhookSubscription(
    accessToken: string,
    subscriptionId: string,
  ): Promise<WebhookSubscription> {
    const graph = this.buildGraphClient(accessToken);
    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_TTL_MINUTES * 60_000,
    ).toISOString();
    const updated = await graph
      .api(`/subscriptions/${subscriptionId}`)
      .patch({ expirationDateTime });
    return {
      id: updated.id,
      expiresAt: new Date(updated.expirationDateTime),
      clientState: updated.clientState ?? undefined,
    };
  }

  async deleteWebhookSubscription(
    accessToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const graph = this.buildGraphClient(accessToken);
    try {
      await graph.api(`/subscriptions/${subscriptionId}`).delete();
    } catch (err) {
      // 404 means already deleted -- safe to swallow
      const status = (err as { statusCode?: number }).statusCode;
      if (status !== 404) throw err;
      this.logger.warn(
        `Microsoft subscription already deleted id=${subscriptionId}`,
      );
    }
  }

  // ==========================================================================
  // Webhook payload validation
  // ==========================================================================

  validateWebhookPayload(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: string | undefined,
    query: Record<string, string | undefined>,
    expectedClientState: string | undefined,
  ): WebhookValidation {
    // 1. Initial subscription handshake : MS sends GET /webhook?validationToken=xxx
    //    We must respond 200 text/plain echo within 10 seconds.
    const validationToken = query['validationToken'];
    if (validationToken) {
      return {
        valid: true,
        validationTokenEcho: validationToken,
      };
    }

    // 2. Normal notification : POST with JSON body { value: [{ ... }] }
    if (!rawBody) {
      return { valid: false, reason: 'missing body' };
    }
    let payload: { value?: Array<{ subscriptionId?: string; clientState?: string; resourceData?: { id?: string } }> };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: 'invalid JSON body' };
    }
    const notifications = payload.value;
    if (!notifications || notifications.length === 0) {
      return { valid: false, reason: 'empty notifications array' };
    }
    const first = notifications[0]!;
    if (!first.subscriptionId) {
      return { valid: false, reason: 'missing subscriptionId in notification' };
    }
    if (!expectedClientState) {
      return {
        valid: false,
        reason: 'no expected clientState (subscription not found by id)',
        subscriptionId: first.subscriptionId,
      };
    }
    if (first.clientState !== expectedClientState) {
      return {
        valid: false,
        reason: 'clientState mismatch',
        subscriptionId: first.subscriptionId,
      };
    }
    return {
      valid: true,
      subscriptionId: first.subscriptionId,
      resourceId: first.resourceData?.id,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Extracts the refresh token from msal-node's internal token cache.
   * msal-node does not expose refresh tokens through its public API ; we
   * must serialize the cache and parse.
   */
  private extractRefreshTokenFromCache(
    client: ConfidentialClientApplication,
  ): string | undefined {
    try {
      const cacheSerialized = client.getTokenCache().serialize();
      const parsed = JSON.parse(cacheSerialized);
      const refreshTokens = parsed?.RefreshToken ?? {};
      const firstKey = Object.keys(refreshTokens)[0];
      if (!firstKey) return undefined;
      return refreshTokens[firstKey]?.secret;
    } catch (err) {
      this.logger.warn(
        `Failed to extract refresh token from msal cache : ${(err as Error).message}`,
      );
      return undefined;
    }
  }
}
