/**
 * CalendarOAuth2Service -- Sprint 8 Tache 8.10b.
 *
 * Orchestrator for OAuth2 calendar connection lifecycle. Composes :
 *   - OAuthCalendarConfig (placeholder detection + per-provider config)
 *   - OAuthStateService (CSRF state)
 *   - GoogleCalendarProvider + OutlookCalendarProvider (provider abstraction)
 *   - CalendarSyncTokenService (Task 8.10a -- DB persistence + AES-256-GCM)
 *
 * Public surface :
 *   - `initiateConnection(provider)` -> { authUrl } the user is redirected to
 *   - `handleCallback(state, code, provider)` -> persists tokens + creates webhook
 *   - `getValidAccessToken(tokenId)` -> auto-refresh proactively if < 5 min
 *   - `disconnect(tokenId)` -> delete webhook + disable sync
 *
 * Provider-disabled handling : checks `config.{provider}.enabled` ; throws
 * ServiceUnavailableException for the controller to surface as 503.
 *
 * Reference : B-08 Tache 3.2.5.
 */

import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import type { BookingCalendarSyncEntity } from '@insurtech/database';
import { OAuthCalendarConfig, type CalendarProviderName } from '../config/oauth-calendar.config.js';
import { GoogleCalendarProvider } from '../providers/google-calendar.provider.js';
import { OutlookCalendarProvider } from '../providers/outlook-calendar.provider.js';
import type { CalendarProvider } from '../providers/calendar-provider.interface.js';
import { CalendarSyncTokenService } from './calendar-sync-token.service.js';
import { OAuthStateService } from './oauth-state.service.js';

/** Refresh access token proactively when within this window of expiry. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const CALENDAR_OAUTH2_ERROR_CODES = {
  TENANT_REQUIRED: 'CALENDAR_OAUTH2_TENANT_REQUIRED',
  PROVIDER_DISABLED: 'CALENDAR_OAUTH2_PROVIDER_DISABLED',
  WEBHOOK_DISABLED: 'CALENDAR_OAUTH2_WEBHOOK_DISABLED',
  CALLBACK_ERROR: 'CALENDAR_OAUTH2_CALLBACK_ERROR',
  TOKEN_NOT_FOUND: 'CALENDAR_OAUTH2_TOKEN_NOT_FOUND',
  REFRESH_FAILED: 'CALENDAR_OAUTH2_REFRESH_FAILED',
} as const;

@Injectable()
export class CalendarOAuth2Service {
  private readonly logger = new Logger(CalendarOAuth2Service.name);

  constructor(
    private readonly config: OAuthCalendarConfig,
    private readonly state: OAuthStateService,
    private readonly googleProvider: GoogleCalendarProvider,
    private readonly outlookProvider: OutlookCalendarProvider,
    private readonly tokenService: CalendarSyncTokenService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private requireTenantUser(): { tenantId: string; userId: string } {
    const ctx = this.tenantContext.getCurrentContext();
    if (!ctx?.tenantId || !ctx.userId) {
      throw new BadRequestException({
        code: CALENDAR_OAUTH2_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant + user context required',
      });
    }
    return { tenantId: ctx.tenantId, userId: ctx.userId };
  }

  private getProvider(name: CalendarProviderName): CalendarProvider {
    return name === 'google' ? this.googleProvider : this.outlookProvider;
  }

  private ensureEnabled(name: CalendarProviderName): void {
    if (!this.config.getProvider(name).enabled) {
      throw new ServiceUnavailableException({
        code: CALENDAR_OAUTH2_ERROR_CODES.PROVIDER_DISABLED,
        message: `OAuth provider "${name}" is disabled. Configure ${name === 'google' ? 'GOOGLE_OAUTH_*' : 'MICROSOFT_OAUTH_*'} env vars + restart.`,
      });
    }
  }

  // ==========================================================================
  // Initiate connection
  // ==========================================================================

  /**
   * Step 1 of OAuth2 : build authorization URL the user is redirected to.
   * Generates a CSRF state token persisted in Redis (10-minute TTL).
   */
  async initiateConnection(
    provider: CalendarProviderName,
  ): Promise<{ authUrl: string; state: string }> {
    this.ensureEnabled(provider);
    const { tenantId, userId } = this.requireTenantUser();
    const state = await this.state.generate(tenantId, userId, provider);
    const providerImpl = this.getProvider(provider);
    const authUrl = providerImpl.getAuthorizationUrl(
      state,
      this.config.getProvider(provider).redirectUri,
    );
    this.logger.log(
      `calendar_oauth_initiated provider=${provider} tenant=${tenantId} user=${userId}`,
    );
    return { authUrl, state };
  }

  // ==========================================================================
  // Handle OAuth callback
  // ==========================================================================

  /**
   * Step 2 of OAuth2 : exchange `code` for tokens, persist via CalendarSyncTokenService
   * (encryption transparent), create webhook subscription, return the row id.
   *
   * The CSRF state is validated + consumed before any external API calls. The
   * resulting row's `userId` and `tenantId` come from the state payload, NOT
   * from the current tenant context -- the callback route is unauthenticated
   * (the state IS the authentication).
   */
  async handleCallback(
    state: string,
    code: string,
    provider: CalendarProviderName,
  ): Promise<BookingCalendarSyncEntity> {
    this.ensureEnabled(provider);
    const statePayload = await this.state.validateAndConsume(state);
    if (statePayload.provider !== provider) {
      throw new BadRequestException({
        code: CALENDAR_OAUTH2_ERROR_CODES.CALLBACK_ERROR,
        message: `State provider mismatch : expected ${statePayload.provider}, got ${provider}`,
      });
    }

    const providerImpl = this.getProvider(provider);
    const tokens = await providerImpl.exchangeCodeForTokens(
      code,
      this.config.getProvider(provider).redirectUri,
    );
    const email = await providerImpl.getUserEmail(tokens.accessToken);

    // Inject the state payload's tenant + user into TenantContext for the
    // saveTokens call (which calls requireTenantId internally). The callback
    // path is otherwise unauthenticated. We pass via a transient context.
    const saved = await this.saveTokensAsState(statePayload, {
      provider,
      providerAccountId: email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });

    // Best-effort : create webhook subscription. If webhook URL is a placeholder
    // we skip the subscription (saved row still useful for pull-only sync).
    if (this.config.webhookEnabled) {
      try {
        const clientState = randomBytes(16).toString('hex');
        const webhook = await providerImpl.createWebhookSubscription(
          tokens.accessToken,
          this.config.webhookUrlFor(provider),
          clientState,
        );
        await this.tokenService.saveWebhookSubscriptionAs(
          statePayload.tenantId,
          saved.id,
          {
            webhookSubscriptionId: webhook.id,
            webhookResourceId: webhook.resourceId,
            webhookExpiresAt: webhook.expiresAt,
          },
          clientState,
        );
        this.logger.log(
          `calendar_oauth_webhook_created provider=${provider} sync_id=${saved.id} subscription_id=${webhook.id} expires=${webhook.expiresAt.toISOString()}`,
        );
      } catch (err) {
        // Webhook failure does NOT roll back token persistence -- user can
        // still use sync via cron-based pull. Log + record outcome.
        this.logger.warn(
          `calendar_oauth_webhook_failed sync_id=${saved.id} err=${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `calendar_oauth_callback_success provider=${provider} sync_id=${saved.id} tenant=${statePayload.tenantId} user=${statePayload.userId} email=${email}`,
    );
    return saved;
  }

  /**
   * Persists tokens using the state payload's tenant + user. Encryption is
   * handled transparently by TypeORM ValueTransformer (Task 8.10a).
   *
   * Implementation detail : CalendarSyncTokenService.saveTokens uses
   * requireTenantId from TenantContext. The callback path is unauthenticated.
   * We call the lower-level saveTokensAsTenant helper to bypass context.
   */
  private async saveTokensAsState(
    statePayload: { tenantId: string; userId: string },
    dto: {
      provider: CalendarProviderName;
      providerAccountId: string;
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt: Date;
      scope?: string;
    },
  ): Promise<BookingCalendarSyncEntity> {
    return this.tokenService.saveTokensAs(statePayload.tenantId, statePayload.userId, {
      provider: dto.provider,
      providerAccountId: dto.providerAccountId,
      accessToken: dto.accessToken,
      ...(dto.refreshToken !== undefined ? { refreshToken: dto.refreshToken } : {}),
      tokenExpiresAt: dto.tokenExpiresAt,
      ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
    });
  }

  // ==========================================================================
  // Valid access token with auto-refresh
  // ==========================================================================

  /**
   * Returns a valid access token for the given sync row. Refreshes proactively
   * if the current token expires within `REFRESH_BUFFER_MS`.
   *
   * Returns null if sync is disabled (consecutive_failures reached threshold,
   * or user manually disconnected).
   */
  async getValidAccessToken(syncId: string): Promise<string | null> {
    const row = await this.tokenService.findById(syncId);
    if (!row.syncEnabled) {
      return null;
    }

    const expiresAt = row.tokenExpiresAt;
    if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
      // Still valid -- return decrypted token directly
      return row.accessToken;
    }

    // Token expired or about to expire -- refresh
    if (!row.refreshToken) {
      this.logger.warn(
        `calendar_oauth_no_refresh_token sync_id=${syncId} provider=${row.provider} -- mark failed`,
      );
      await this.tokenService.recordSyncOutcomeAs(row.tenantId, syncId, {
        status: 'failed',
        error: 'Access token expired, no refresh token available. User must re-auth.',
      });
      return null;
    }

    try {
      const provider = this.getProvider(row.provider as CalendarProviderName);
      const refreshed = await provider.refreshAccessToken(row.refreshToken);
      await this.tokenService.saveTokensAs(row.tenantId, row.userId, {
        provider: row.provider as CalendarProviderName,
        providerAccountId: row.providerAccountId,
        accessToken: refreshed.accessToken,
        ...(refreshed.refreshToken !== undefined
          ? { refreshToken: refreshed.refreshToken }
          : {}),
        tokenExpiresAt: refreshed.expiresAt,
        ...(refreshed.scope !== undefined ? { scope: refreshed.scope } : {}),
      });
      this.logger.log(
        `calendar_oauth_refreshed sync_id=${syncId} provider=${row.provider} new_expiry=${refreshed.expiresAt.toISOString()}`,
      );
      return refreshed.accessToken;
    } catch (err) {
      await this.tokenService.recordSyncOutcomeAs(row.tenantId, syncId, {
        status: 'failed',
        error: `Refresh failed: ${(err as Error).message.slice(0, 400)}`,
      });
      throw new BadRequestException({
        code: CALENDAR_OAUTH2_ERROR_CODES.REFRESH_FAILED,
        message: `Failed to refresh OAuth token for sync ${syncId}`,
      });
    }
  }

  // ==========================================================================
  // Disconnect
  // ==========================================================================

  /**
   * Disconnect : deletes the provider webhook subscription (best-effort) and
   * disables the local sync row. Tokens are preserved (encrypted at rest) in
   * case the user wants to re-enable without full re-auth.
   */
  async disconnect(syncId: string): Promise<void> {
    const row = await this.tokenService.findById(syncId);

    // Best-effort webhook delete
    if (row.webhookSubscriptionId && row.syncEnabled) {
      try {
        const provider = this.getProvider(row.provider as CalendarProviderName);
        await provider.deleteWebhookSubscription(
          row.accessToken,
          row.webhookSubscriptionId,
        );
        this.logger.log(
          `calendar_oauth_webhook_deleted sync_id=${syncId} subscription=${row.webhookSubscriptionId}`,
        );
      } catch (err) {
        this.logger.warn(
          `calendar_oauth_webhook_delete_failed sync_id=${syncId} err=${(err as Error).message}`,
        );
      }
    }

    await this.tokenService.disable(syncId);
    this.logger.log(
      `calendar_oauth_disconnected sync_id=${syncId} provider=${row.provider} tenant=${row.tenantId} user=${row.userId}`,
    );
  }

  // ==========================================================================
  // Misc
  // ==========================================================================

  /** Returns the provider instance for external callers (e.g. WebhookManager cron). */
  getProviderByName(name: CalendarProviderName): CalendarProvider {
    return this.getProvider(name);
  }

  /** Returns the webhook URL for the given provider (helper for WebhookManager). */
  getWebhookUrlFor(name: CalendarProviderName): string {
    return this.config.webhookUrlFor(name);
  }
}
