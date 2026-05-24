/**
 * CalendarSyncController -- Sprint 8 Tache 8.10b.
 *
 * OAuth2 + webhook endpoints for Google Calendar + Microsoft Outlook
 * calendar synchronization. Phase 1 only (foundation + OAuth flow + webhook
 * VALIDATION + LOGGING). The actual bi-directional sync worker (Phase 2 /
 * Task 8.12) consumes CalendarOAuth2Service.getValidAccessToken for outbound
 * API calls and is triggered by webhook POST receivers below for inbound
 * notifications.
 *
 * Permissions :
 *   - Authenticated endpoints : BOOKING_CALENDAR_SYNC (umbrella, Sprint 7.5a)
 *   - Webhook receivers : UNAUTHENTICATED (validated by clientState /
 *     X-Goog-Channel-Token). Public routes -- no @RequireTenant, no
 *     @RequirePermission. CRITICAL : validation MUST happen before any
 *     state-modifying action.
 *
 * Routes :
 *   GET    /api/v1/booking/calendar/connect/:provider       BOOKING_CALENDAR_SYNC
 *   GET    /api/v1/booking/calendar/callback/:provider      public (state CSRF)
 *   GET    /api/v1/booking/calendar/connections             BOOKING_CALENDAR_SYNC
 *   DELETE /api/v1/booking/calendar/connections/:id         BOOKING_CALENDAR_SYNC
 *   GET    /api/v1/booking/calendar/webhook/outlook         public (validationToken echo)
 *   POST   /api/v1/booking/calendar/webhook/outlook         public (clientState)
 *   POST   /api/v1/booking/calendar/webhook/google          public (X-Goog-Channel-Token)
 *   GET    /api/v1/booking/calendar/webhook/health          public (liveness)
 *
 * Reference : B-08 Tache 3.2.5.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Permission, TenantContextService } from '@insurtech/auth';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import type { CalendarProviderName } from '../config/oauth-calendar.config.js';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import { CalendarOAuth2Service } from '../services/calendar-oauth2.service.js';
import { CalendarSyncTokenService } from '../services/calendar-sync-token.service.js';

const VALID_PROVIDERS = ['google', 'outlook'] as const;

function parseProvider(raw: string): CalendarProviderName {
  if (raw !== 'google' && raw !== 'outlook') {
    throw new BadRequestException({
      code: 'CALENDAR_INVALID_PROVIDER',
      message: `Unknown provider "${raw}". Allowed: ${VALID_PROVIDERS.join(', ')}`,
    });
  }
  return raw;
}

@Controller('api/v1/booking/calendar')
export class CalendarSyncController {
  private readonly logger = new Logger(CalendarSyncController.name);

  constructor(
    private readonly oauth: CalendarOAuth2Service,
    private readonly tokens: CalendarSyncTokenService,
    private readonly config: OAuthCalendarConfig,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ==========================================================================
  // 1. Initiate OAuth flow
  // ==========================================================================

  @Get('connect/:provider')
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_CALENDAR_SYNC)
  async connect(@Param('provider') providerRaw: string): Promise<{ authUrl: string }> {
    const provider = parseProvider(providerRaw);
    if (!this.config.getProvider(provider).enabled) {
      throw new ServiceUnavailableException({
        code: 'CALENDAR_PROVIDER_DISABLED',
        message: `OAuth provider "${provider}" is disabled (placeholder credentials). See docs/setup-oauth-calendar.md for activation steps.`,
      });
    }
    const { authUrl } = await this.oauth.initiateConnection(provider);
    return { authUrl };
  }

  // ==========================================================================
  // 2. OAuth callback (UNAUTHENTICATED, validated by state CSRF)
  // ==========================================================================

  @Get('callback/:provider')
  async callback(
    @Param('provider') providerRaw: string,
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
  ): Promise<{
    syncId: string;
    provider: CalendarProviderName;
    providerAccountId: string;
  }> {
    const provider = parseProvider(providerRaw);
    if (error) {
      this.logger.warn(
        `calendar_oauth_callback_provider_error provider=${provider} error=${error} desc=${errorDescription ?? ''}`,
      );
      throw new BadRequestException({
        code: 'CALENDAR_PROVIDER_ERROR',
        message: `OAuth provider returned error : ${error} (${errorDescription ?? 'no description'})`,
      });
    }
    if (!state || !code) {
      throw new BadRequestException({
        code: 'CALENDAR_CALLBACK_MISSING_PARAMS',
        message: 'Missing state or code in callback',
      });
    }
    const saved = await this.oauth.handleCallback(state, code, provider);
    return {
      syncId: saved.id,
      provider: saved.provider as CalendarProviderName,
      providerAccountId: saved.providerAccountId,
    };
  }

  // ==========================================================================
  // 3. List connections (current user)
  // ==========================================================================

  @Get('connections')
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_CALENDAR_SYNC)
  async listConnections() {
    const ctx = this.tenantContext.getCurrentContext();
    if (!ctx?.userId) {
      throw new BadRequestException({
        code: 'CALENDAR_USER_REQUIRED',
        message: 'User context required',
      });
    }
    const rows = await this.tokens.findByUser(ctx.userId);
    return {
      connections: rows.map((r) => this.tokens.toConnectionInfo(r)),
    };
  }

  // ==========================================================================
  // 4. Disconnect
  // ==========================================================================

  @Delete('connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_CALENDAR_SYNC)
  async disconnect(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.oauth.disconnect(id);
  }

  // ==========================================================================
  // 5. Webhook health probe (public)
  // ==========================================================================

  @Get('webhook/health')
  async webhookHealth(): Promise<{
    enabled: boolean;
    webhookBaseUrl: string;
    google: boolean;
    outlook: boolean;
  }> {
    return {
      enabled: this.config.webhookEnabled,
      webhookBaseUrl: this.config.webhookBaseUrl,
      google: this.config.google.enabled,
      outlook: this.config.outlook.enabled,
    };
  }

  // ==========================================================================
  // 6. Microsoft Graph webhook validation handshake (GET)
  //
  //    On initial subscription creation, MS Graph sends a GET with
  //    validationToken in query string. We must echo it back as text/plain
  //    within 10 seconds. Subsequent POSTs are actual notifications.
  // ==========================================================================

  @Get('webhook/outlook')
  async outlookWebhookValidation(
    @Query('validationToken') validationToken: string | undefined,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    if (!validationToken) {
      res.status(400).send('Missing validationToken');
      return;
    }
    res.header('content-type', 'text/plain');
    res.status(200).send(validationToken);
  }

  // ==========================================================================
  // 7. Webhook POST receivers (UNAUTHENTICATED -- provider-validated)
  //
  //    Phase 1 (Task 8.10b) : receive + VALIDATE + log. Sync worker (Phase 2)
  //    will subscribe to processed notifications via Kafka or in-process events.
  // ==========================================================================

  @Post('webhook/outlook')
  @HttpCode(HttpStatus.ACCEPTED)
  async outlookWebhookReceive(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ accepted: boolean; reason?: string }> {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    const provider = this.oauth.getProviderByName('outlook');

    // Extract subscriptionId WITHOUT clientState lookup first -- we need the
    // row to find the expected clientState.
    const tentative = provider.validateWebhookPayload(headers, rawBody, {}, undefined);
    if (!tentative.subscriptionId) {
      this.logger.warn(
        `outlook_webhook_no_subscription_id headers=${JSON.stringify(Object.keys(headers))}`,
      );
      return { accepted: false, reason: tentative.reason ?? 'missing subscriptionId' };
    }

    // Look up the row to obtain the expected clientState
    const row = await this.tokens.findByWebhookSubscriptionId(tentative.subscriptionId);
    if (!row) {
      this.logger.warn(
        `outlook_webhook_unknown_subscription id=${tentative.subscriptionId}`,
      );
      return { accepted: false, reason: 'unknown subscription' };
    }
    const expectedClientState =
      (row.metadata?.['webhookClientState'] as string | undefined) ?? '';

    const validation = provider.validateWebhookPayload(
      headers,
      rawBody,
      {},
      expectedClientState,
    );
    if (!validation.valid) {
      this.logger.warn(
        `outlook_webhook_invalid sync_id=${row.id} reason=${validation.reason}`,
      );
      return { accepted: false, reason: validation.reason };
    }

    this.logger.log(
      `outlook_webhook_received sync_id=${row.id} resource=${validation.resourceId ?? ''} tenant=${row.tenantId}`,
    );
    // Phase 2 (Task 8.12) : trigger CalendarSyncWorkerService.handleExternalChange here
    return { accepted: true };
  }

  @Post('webhook/google')
  @HttpCode(HttpStatus.OK)
  async googleWebhookReceive(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ accepted: boolean; reason?: string }> {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    const provider = this.oauth.getProviderByName('google');

    // Google identifies the channel via X-Goog-Channel-ID header
    const channelIdHeader = headers['x-goog-channel-id'];
    const channelId = Array.isArray(channelIdHeader) ? channelIdHeader[0] : channelIdHeader;
    if (!channelId) {
      return { accepted: false, reason: 'missing X-Goog-Channel-ID' };
    }

    const row = await this.tokens.findByWebhookSubscriptionId(channelId);
    if (!row) {
      this.logger.warn(`google_webhook_unknown_channel id=${channelId}`);
      return { accepted: false, reason: 'unknown channel' };
    }
    const expectedClientState =
      (row.metadata?.['webhookClientState'] as string | undefined) ?? '';
    const validation = provider.validateWebhookPayload(
      headers,
      rawBody,
      {},
      expectedClientState,
    );
    if (!validation.valid) {
      this.logger.warn(
        `google_webhook_invalid sync_id=${row.id} reason=${validation.reason}`,
      );
      return { accepted: false, reason: validation.reason };
    }
    this.logger.log(
      `google_webhook_received sync_id=${row.id} resource=${validation.resourceId ?? ''} tenant=${row.tenantId}`,
    );
    return { accepted: true };
  }
}
