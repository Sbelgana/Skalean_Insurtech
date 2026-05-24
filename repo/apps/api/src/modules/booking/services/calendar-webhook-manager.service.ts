/**
 * CalendarWebhookManagerService -- Sprint 8 Tache 8.10b.
 *
 * Cron-based webhook subscription lifecycle :
 *   - Every 6 hours : find webhooks expiring within 24 hours, renew them.
 *
 * Provider-specific renewal :
 *   - Google : Calendar API does NOT support channel renewal -- DELETE + CREATE
 *     with a fresh subscription id. We persist the new id, replacing the old.
 *     The clientState is reused (read from metadata.webhookClientState).
 *   - Microsoft Graph : PATCH /subscriptions/{id} updates expirationDateTime
 *     in place ; same subscription id is preserved.
 *
 * Failure handling : recordSyncOutcome('failed', ...). After
 * `autoDisableThreshold` consecutive failures, sync_enabled is flipped to
 * false (heritage 8.10a).
 *
 * Reference : B-08 Tache 3.2.5.
 */

import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { BookingCalendarSyncEntity } from '@insurtech/database';
import type { CalendarProviderName } from '../config/oauth-calendar.config.js';
import { CalendarOAuth2Service } from './calendar-oauth2.service.js';
import { CalendarSyncTokenService } from './calendar-sync-token.service.js';

/** Renew when remaining lifetime < this many hours. */
const RENEWAL_THRESHOLD_HOURS = 24;

@Injectable()
export class CalendarWebhookManagerService {
  private readonly logger = new Logger(CalendarWebhookManagerService.name);

  constructor(
    private readonly oauth: CalendarOAuth2Service,
    private readonly tokens: CalendarSyncTokenService,
  ) {}

  /**
   * Cron : every 6 hours, renew webhook subscriptions expiring soon.
   *
   * Google channels max 7d, MS Graph subscriptions ~70h -- renewing every 6h
   * with a 24h threshold ensures we never miss a window. Cron pauses if no
   * connections exist (cheap call : findWebhooksExpiringWithin returns []).
   */
  @Cron(CronExpression.EVERY_6_HOURS, { name: 'renew-calendar-webhooks' })
  async renewAllExpiring(): Promise<{ attempted: number; succeeded: number; failed: number }> {
    const expiring = await this.tokens.findWebhooksExpiringWithin(RENEWAL_THRESHOLD_HOURS);
    if (expiring.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0 };
    }
    this.logger.log(`calendar_webhook_renewal_started count=${expiring.length}`);
    let succeeded = 0;
    let failed = 0;
    for (const row of expiring) {
      try {
        await this.renewOne(row);
        succeeded++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `calendar_webhook_renewal_failed sync_id=${row.id} provider=${row.provider} err=${(err as Error).message}`,
        );
        await this.tokens.recordSyncOutcomeAs(row.tenantId, row.id, {
          status: 'failed',
          error: `Webhook renewal failed : ${(err as Error).message.slice(0, 400)}`,
        });
      }
    }
    this.logger.log(
      `calendar_webhook_renewal_completed attempted=${expiring.length} succeeded=${succeeded} failed=${failed}`,
    );
    return { attempted: expiring.length, succeeded, failed };
  }

  /**
   * Renews a single subscription. Public method for explicit / on-demand
   * renewal (e.g. controller endpoint, tests).
   */
  async renewOne(row: BookingCalendarSyncEntity): Promise<void> {
    if (!row.webhookSubscriptionId) {
      throw new Error(
        `Calendar sync ${row.id} has no webhook subscription to renew`,
      );
    }
    const accessToken = await this.oauth.getValidAccessToken(row.id);
    if (!accessToken) {
      throw new Error(
        `Calendar sync ${row.id} access token unavailable (disabled or refresh failed)`,
      );
    }
    const provider = this.oauth.getProviderByName(row.provider as CalendarProviderName);

    if (row.provider === 'google') {
      // Google : delete old + create new. We need the original clientState
      // (stored in metadata.webhookClientState) to keep validation consistent
      // across the renewal. If missing, generate a fresh one.
      const clientState =
        (row.metadata?.['webhookClientState'] as string | undefined) ??
        randomBytes(16).toString('hex');
      try {
        await provider.deleteWebhookSubscription(accessToken, row.webhookSubscriptionId);
      } catch (err) {
        // Best-effort -- old channel may already be expired.
        this.logger.warn(
          `calendar_webhook_delete_during_renewal_failed sync_id=${row.id} err=${(err as Error).message}`,
        );
      }
      // Webhook URL is constructed by the orchestrator config helper.
      const webhookUrl = this.oauth.getWebhookUrlFor('google');
      const newSubscription = await provider.createWebhookSubscription(
        accessToken,
        webhookUrl,
        clientState,
      );
      await this.tokens.saveWebhookSubscriptionAs(
        row.tenantId,
        row.id,
        {
          webhookSubscriptionId: newSubscription.id,
          ...(newSubscription.resourceId !== undefined
            ? { webhookResourceId: newSubscription.resourceId }
            : {}),
          webhookExpiresAt: newSubscription.expiresAt,
        },
        clientState,
      );
    } else {
      // Microsoft : in-place PATCH renewal, subscription id preserved.
      const renewed = await provider.renewWebhookSubscription(
        accessToken,
        row.webhookSubscriptionId,
      );
      await this.tokens.saveWebhookSubscriptionAs(
        row.tenantId,
        row.id,
        {
          webhookSubscriptionId: renewed.id,
          webhookExpiresAt: renewed.expiresAt,
        },
        renewed.clientState ??
          (row.metadata?.['webhookClientState'] as string | undefined) ??
          '',
      );
    }
    this.logger.log(
      `calendar_webhook_renewed sync_id=${row.id} provider=${row.provider}`,
    );
  }
}
