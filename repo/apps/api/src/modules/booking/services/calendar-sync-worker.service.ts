/**
 * CalendarSyncWorkerService -- Sprint 8 Tache 8.12 (Phase 2).
 *
 * Bi-directional bridge between local appointments and external calendars
 * (Google + Outlook). Composes Phase 1 building blocks :
 *   - CalendarOAuth2Service.getValidAccessToken : token + auto-refresh
 *   - GoogleCalendarProvider / OutlookCalendarProvider : event CRUD
 *   - CalendarSyncTokenService : tenant-scoped DB persistence + outcome
 *   - AppointmentsService : findByExternalIdAs / updateExternalReference
 *
 * Two flows :
 *   1) PUSH (local -> external) : triggered by AppointmentSyncListener on
 *      'booking.appointment.{created,updated,cancelled}' events. For each
 *      active sync token of the organizing user, create/update/delete the
 *      external event. If a new external event is created, persist the
 *      reference (externalCalendarEventId + externalCalendarProvider) on the
 *      local appointment row.
 *
 *   2) PULL (external -> local) : triggered by Phase 1 webhook receivers
 *      (handleExternalChange). Look up sync row by webhook subscription id,
 *      fetch the changed event via provider.getEvent, and create / update /
 *      cancel the matching local appointment WITH skipExternalSync flag --
 *      preventing the loop.
 *
 * Conflict resolution :
 *   Last-write-wins via lastModifiedAt timestamp. Tie-break = external wins
 *   for deterministic cross-provider behavior. When local wins, no immediate
 *   action -- the next user-driven push will overwrite external.
 *
 * Failure handling :
 *   Each per-token failure is captured + recorded via recordSyncOutcomeAs.
 *   After autoDisableThreshold (5) consecutive failures, sync_enabled is
 *   flipped off in CalendarSyncTokenService (Phase 1 heritage).
 *   Tokens with consecutiveFailures >= threshold are skipped pre-emptively.
 *
 * Reconciliation :
 *   @Cron every 30 minutes -- placeholder for full reconciliation. Phase 2
 *   ships the no-op log (Sprint 13 will implement aggressive drift checks
 *   if scaling demands).
 *
 * Reference : B-08 Tache 3.2.5 (Phase 2).
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type {
  BookingAppointmentEntity,
  BookingCalendarSyncEntity,
  BookingRoomEntity,
  DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { OAuthCalendarConfig } from '../config/oauth-calendar.config.js';
import { GoogleCalendarProvider } from '../providers/google-calendar.provider.js';
import { OutlookCalendarProvider } from '../providers/outlook-calendar.provider.js';
import type {
  CalendarProvider,
  ExternalCalendarEvent,
  ExternalCalendarEventInput,
  WebhookNotificationParsed,
} from '../providers/calendar-provider.interface.js';
import { AppointmentsService } from './appointments.service.js';
import { CalendarOAuth2Service } from './calendar-oauth2.service.js';
import { CalendarSyncTokenService } from './calendar-sync-token.service.js';

/** Tokens past this many consecutive failures are skipped pre-emptively. */
const SKIP_THRESHOLD = 5;

/** Local action that triggers an external push. */
export type SyncAction = 'created' | 'updated' | 'deleted';

@Injectable()
export class CalendarSyncWorkerService {
  private readonly logger = new Logger(CalendarSyncWorkerService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly appointments: AppointmentsService,
    private readonly tokens: CalendarSyncTokenService,
    private readonly oauth: CalendarOAuth2Service,
    private readonly config: OAuthCalendarConfig,
    private readonly googleProvider: GoogleCalendarProvider,
    private readonly outlookProvider: OutlookCalendarProvider,
    /**
     * Optional : reconciliation cron only fires when DI provided it. Some
     * unit tests construct the worker without registering ScheduleModule.
     */
    @Optional() private readonly _scheduleHook?: never,
  ) {}

  // ==========================================================================
  // PUSH path : local -> external
  // ==========================================================================

  /**
   * Push a local appointment to ALL active external calendars of its
   * assigned user. Idempotent per-token : if the appointment already has an
   * external reference for that provider, update ; otherwise create.
   */
  async syncAppointmentToExternal(
    appointmentId: string,
    action: SyncAction,
  ): Promise<void> {
    // The listener carries no tenant context -- we look up the row by id
    // without tenant filter. The row carries its own tenantId.
    const repo = this.dataSource.getRepository<BookingAppointmentEntity>(
      'BookingAppointmentEntity',
    );
    const appointment = await repo.findOne({ where: { id: appointmentId } });
    if (!appointment) {
      this.logger.warn(
        `sync_push_appointment_not_found id=${appointmentId} action=${action}`,
      );
      return;
    }
    if (!appointment.assignedUserId) {
      this.logger.debug(
        `sync_push_skip_no_user id=${appointmentId} (no assignedUserId)`,
      );
      return;
    }

    const tokens = await this.tokens.findActiveTokensByUserAs(
      appointment.tenantId,
      appointment.assignedUserId,
    );
    if (tokens.length === 0) return;

    for (const token of tokens) {
      if (token.consecutiveFailures >= SKIP_THRESHOLD) {
        this.logger.debug(
          `sync_push_skip_high_failures token_id=${token.id} consecutive_failures=${token.consecutiveFailures}`,
        );
        continue;
      }
      // Skip outright when the provider is disabled (placeholder credentials)
      const providerName = token.provider as 'google' | 'outlook' | 'caldav';
      if (providerName !== 'google' && providerName !== 'outlook') continue;
      if (!this.config.getProvider(providerName).enabled) continue;

      try {
        await this.pushOne(appointment, token, action);
      } catch (err) {
        this.logger.warn(
          `sync_push_failed appt_id=${appointment.id} provider=${token.provider} err=${(err as Error).message}`,
        );
        await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
          status: 'failed',
          error: `Push ${action} failed : ${(err as Error).message.slice(0, 400)}`,
        });
      }
    }
  }

  private async pushOne(
    appointment: BookingAppointmentEntity,
    token: BookingCalendarSyncEntity,
    action: SyncAction,
  ): Promise<void> {
    const accessToken = await this.oauth.getValidAccessToken(token.id);
    if (!accessToken) {
      // getValidAccessToken already recorded failure when refresh failed.
      return;
    }
    const provider = this.providerFor(token.provider);

    if (action === 'deleted') {
      if (
        appointment.externalCalendarEventId &&
        appointment.externalCalendarProvider === token.provider
      ) {
        await provider.deleteEvent(accessToken, appointment.externalCalendarEventId);
        this.logger.log(
          `sync_push_deleted appt_id=${appointment.id} provider=${token.provider} ext_id=${appointment.externalCalendarEventId}`,
        );
      }
      await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
        status: 'success',
      });
      return;
    }

    const room = await this.dataSource
      .getRepository<BookingRoomEntity>('BookingRoomEntity')
      .findOne({ where: { id: appointment.roomId, tenantId: appointment.tenantId } });
    const externalInput = this.toExternalFormat(appointment, room);

    const matchesProvider =
      appointment.externalCalendarEventId &&
      appointment.externalCalendarProvider === token.provider;

    if (matchesProvider) {
      await provider.updateEvent(
        accessToken,
        appointment.externalCalendarEventId!,
        externalInput,
      );
      this.logger.log(
        `sync_push_updated appt_id=${appointment.id} provider=${token.provider} ext_id=${appointment.externalCalendarEventId}`,
      );
    } else {
      const created = await provider.createEvent(accessToken, externalInput);
      await this.appointments.updateExternalReference(
        appointment.tenantId,
        appointment.id,
        {
          externalCalendarEventId: created.id,
          externalCalendarProvider: token.provider as
            | 'google'
            | 'outlook'
            | 'caldav',
        },
      );
      this.logger.log(
        `sync_push_created appt_id=${appointment.id} provider=${token.provider} ext_id=${created.id}`,
      );
    }
    await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
      status: 'success',
    });
  }

  // ==========================================================================
  // PULL path : external -> local (called by webhook receivers)
  // ==========================================================================

  /**
   * Process an inbound webhook notification : reconcile our local row with
   * the external event referenced by `notification.resourceId`. Caller
   * (controller) MUST have validated the webhook signature first.
   */
  async handleExternalChange(
    providerName: 'google' | 'outlook',
    notification: WebhookNotificationParsed,
  ): Promise<void> {
    const token = await this.tokens.findByWebhookSubscriptionId(
      notification.subscriptionId,
    );
    if (!token) {
      this.logger.warn(
        `sync_pull_unknown_subscription id=${notification.subscriptionId} provider=${providerName}`,
      );
      return;
    }
    if (!token.syncEnabled) {
      this.logger.debug(
        `sync_pull_skip_disabled token_id=${token.id} provider=${providerName}`,
      );
      return;
    }

    // Lifecycle notifications (MS Graph only) : delegate to webhook manager.
    if (notification.lifecycleEvent === 'subscriptionRenew') {
      this.logger.debug(
        `sync_pull_lifecycle_renew token_id=${token.id} (handled by CalendarWebhookManagerService cron)`,
      );
      return;
    }
    if (notification.lifecycleEvent === 'reauthorizationRequired') {
      await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
        status: 'failed',
        error: 'Reauthorization required by provider',
      });
      return;
    }
    if (notification.lifecycleEvent === 'subscriptionRemove') {
      this.logger.warn(
        `sync_pull_lifecycle_subscription_removed token_id=${token.id} -- user must re-connect`,
      );
      await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
        status: 'failed',
        error: 'Subscription removed by provider',
      });
      return;
    }

    try {
      const accessToken = await this.oauth.getValidAccessToken(token.id);
      if (!accessToken) return;
      const provider = this.providerFor(providerName);

      if (notification.changeType === 'deleted') {
        const local = await this.appointments.findByExternalIdAs(
          token.tenantId,
          notification.resourceId,
        );
        if (local && local.status !== 'cancelled') {
          // Switch to tenant context : cancelAs would be cleaner, but we
          // already have findByExternalIdAs ; the cancel path requires
          // tenant context internally. Use the raw repo to flip status
          // without firing the lifecycle event (skipExternalSync semantics).
          await this.cancelAsSystem(token.tenantId, local.id);
          this.logger.log(
            `sync_pull_cancelled_local appt_id=${local.id} ext_id=${notification.resourceId} provider=${providerName}`,
          );
        }
        await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
          status: 'success',
        });
        return;
      }

      const externalEvent = await provider.getEvent(
        accessToken,
        notification.resourceId,
      );
      if (!externalEvent) {
        this.logger.debug(
          `sync_pull_external_not_found resource=${notification.resourceId} provider=${providerName}`,
        );
        await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
          status: 'success',
        });
        return;
      }

      const local = await this.appointments.findByExternalIdAs(
        token.tenantId,
        notification.resourceId,
      );

      if (!local) {
        // Phase 2 simple : we DO NOT import external-only events into local.
        // The local appointment must exist (created via Assurflow UI) for
        // bi-directional sync to take hold. Importing arbitrary calendar
        // events would create rooms/contacts allocation problems beyond the
        // scope of Sprint 8. Defer to a follow-up sprint (default-room
        // mapping per provider) if user demand surfaces.
        this.logger.debug(
          `sync_pull_external_no_local ext_id=${externalEvent.id} provider=${providerName} -- skipping import`,
        );
        await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
          status: 'success',
        });
        return;
      }

      await this.resolveConflict(local, externalEvent, token);
      await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
        status: 'success',
      });
    } catch (err) {
      this.logger.warn(
        `sync_pull_failed resource=${notification.resourceId} provider=${providerName} err=${(err as Error).message}`,
      );
      await this.tokens.recordSyncOutcomeAs(token.tenantId, token.id, {
        status: 'failed',
        error: `Pull failed : ${(err as Error).message.slice(0, 400)}`,
      });
    }
  }

  /**
   * Last-write-wins reconciliation. External wins on strict newer or tie.
   * Local wins -> no-op (next user push will reconcile in the other direction).
   */
  async resolveConflict(
    local: BookingAppointmentEntity,
    external: ExternalCalendarEvent,
    token: BookingCalendarSyncEntity,
  ): Promise<void> {
    const localTs = (local.updatedAt ?? local.createdAt ?? new Date(0)).getTime();
    const externalTs = external.lastModifiedAt.getTime();

    if (externalTs >= localTs) {
      // External wins -- mutate local with skipExternalSync flag.
      await this.applyExternalToLocal(local, external, token);
      this.logger.log(
        `sync_pull_external_wins appt_id=${local.id} provider=${token.provider} local_ts=${localTs} ext_ts=${externalTs}`,
      );
    } else {
      this.logger.debug(
        `sync_pull_local_wins appt_id=${local.id} provider=${token.provider} -- next push will overwrite external`,
      );
    }
  }

  /**
   * Apply external event to local row WITHOUT emitting an event (avoids the
   * webhook -> push -> webhook loop). Mutations bypass tenant context via
   * a direct repo update.
   */
  private async applyExternalToLocal(
    local: BookingAppointmentEntity,
    external: ExternalCalendarEvent,
    _token: BookingCalendarSyncEntity,
  ): Promise<void> {
    const repo = this.dataSource.getRepository<BookingAppointmentEntity>(
      'BookingAppointmentEntity',
    );
    await repo
      .createQueryBuilder()
      .update('booking_appointments')
      .set({
        title: external.title,
        description: external.description ?? null,
        time_range: `[${external.startAt.toISOString()},${external.endAt.toISOString()})`,
        timezone: external.timezone,
        attendees: external.attendees,
      } as unknown as Record<string, unknown>)
      .where('id = :id AND tenant_id = :tenantId', {
        id: local.id,
        tenantId: local.tenantId,
      })
      .execute();
  }

  private async cancelAsSystem(tenantId: string, appointmentId: string): Promise<void> {
    const repo = this.dataSource.getRepository<BookingAppointmentEntity>(
      'BookingAppointmentEntity',
    );
    await repo
      .createQueryBuilder()
      .update('booking_appointments')
      .set({
        status: 'cancelled',
        cancelled_at: new Date(),
        cancel_reason: 'Deleted from external calendar',
      } as unknown as Record<string, unknown>)
      .where('id = :id AND tenant_id = :tenantId AND status != :cancelled', {
        id: appointmentId,
        tenantId,
        cancelled: 'cancelled',
      })
      .execute();
  }

  // ==========================================================================
  // Reconciliation cron (fallback for missed webhooks)
  // ==========================================================================

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'calendar-sync-reconcile' })
  async reconcileAll(): Promise<void> {
    if (!this.config.isAnyEnabled()) return;
    const activeTokens = await this.tokens.findAllActiveTokens();
    if (activeTokens.length === 0) return;
    this.logger.debug(
      `calendar_sync_reconcile_started active_tokens=${activeTokens.length}`,
    );
    let scanned = 0;
    let skipped = 0;
    for (const token of activeTokens) {
      if (token.consecutiveFailures >= SKIP_THRESHOLD) {
        skipped++;
        continue;
      }
      try {
        await this.reconcileToken(token);
        scanned++;
      } catch (err) {
        this.logger.warn(
          `calendar_sync_reconcile_token_failed token_id=${token.id} err=${(err as Error).message}`,
        );
      }
    }
    this.logger.debug(
      `calendar_sync_reconcile_completed scanned=${scanned} skipped=${skipped}`,
    );
  }

  /**
   * Per-token reconciliation. Phase 2 scope : log only. Full sync (compare
   * last_sync_at against external events updatedSince ; reconcile drift) is
   * deferred to a follow-up sprint when scale + bug data justifies the
   * complexity (Bull / Kafka job queue, partial fetches, etag tracking).
   */
  private async reconcileToken(token: BookingCalendarSyncEntity): Promise<void> {
    this.logger.debug(
      `calendar_sync_reconcile_noop token_id=${token.id} provider=${token.provider} last_sync_at=${token.lastSyncAt?.toISOString() ?? 'never'}`,
    );
  }

  // ==========================================================================
  // Format mappers
  // ==========================================================================

  /** Convert local appointment + room into provider-neutral external input. */
  toExternalFormat(
    appointment: BookingAppointmentEntity,
    room: BookingRoomEntity | null,
  ): ExternalCalendarEventInput {
    const startAt = appointment.timeRange.start;
    const endAt = appointment.timeRange.end;
    const attendees = (appointment.attendees ?? []).map((a) => {
      const obj = a as { name?: string; email?: string };
      return {
        name: obj.name ?? 'Attendee',
        ...(obj.email ? { email: obj.email } : {}),
      };
    });
    const location = room
      ? `${room.name}${room.city ? ` (${room.city})` : ''}`
      : undefined;
    return {
      title: appointment.title,
      ...(appointment.description ? { description: appointment.description } : {}),
      startAt,
      endAt,
      timezone: appointment.timezone,
      attendees,
      ...(location ? { location } : {}),
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private providerFor(name: string): CalendarProvider {
    if (name === 'google') return this.googleProvider;
    if (name === 'outlook') return this.outlookProvider;
    throw new Error(`Provider "${name}" not supported by Phase 2 sync worker`);
  }
}
