/**
 * AppointmentSyncListener -- Sprint 8 Tache 8.12 (Phase 2).
 *
 * Bridges AppointmentsService lifecycle events to CalendarSyncWorkerService.
 * Decouples the two via @nestjs/event-emitter so :
 *   - AppointmentsService.create/update/cancel can return immediately without
 *     waiting for the external sync API call (latency).
 *   - Sync failures do NOT break the user-facing CRUD response (the worker
 *     records failure outcomes itself ; AppointmentsService is unaware).
 *   - Tests can construct AppointmentsService without wiring the worker.
 *
 * Loop prevention :
 *   AppointmentsService.emitLifecycle short-circuits when `sync.skipExternalSync`
 *   is set, so external-driven mutations (CalendarSyncWorker.applyExternalToLocal)
 *   never trigger this listener -> never re-push to external -> no loop.
 *
 * Failure handling :
 *   Async fire-and-forget : we catch and log here ; the worker also records
 *   its own outcome via recordSyncOutcomeAs. Double-logging is acceptable
 *   (one for the listener level, one for the per-token detail).
 *
 * Reference : B-08 Tache 3.2.5 Phase 2.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPOINTMENT_EVENTS,
  type AppointmentLifecyclePayload,
} from './appointments.service.js';
import { CalendarSyncWorkerService } from './calendar-sync-worker.service.js';

@Injectable()
export class AppointmentSyncListener {
  private readonly logger = new Logger(AppointmentSyncListener.name);

  constructor(private readonly syncWorker: CalendarSyncWorkerService) {}

  @OnEvent(APPOINTMENT_EVENTS.CREATED, { async: true })
  async handleCreated(payload: AppointmentLifecyclePayload): Promise<void> {
    try {
      await this.syncWorker.syncAppointmentToExternal(payload.appointmentId, 'created');
    } catch (err) {
      this.logger.warn(
        `appointment_sync_listener_created_failed id=${payload.appointmentId} err=${(err as Error).message}`,
      );
    }
  }

  @OnEvent(APPOINTMENT_EVENTS.UPDATED, { async: true })
  async handleUpdated(payload: AppointmentLifecyclePayload): Promise<void> {
    try {
      await this.syncWorker.syncAppointmentToExternal(payload.appointmentId, 'updated');
    } catch (err) {
      this.logger.warn(
        `appointment_sync_listener_updated_failed id=${payload.appointmentId} err=${(err as Error).message}`,
      );
    }
  }

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED, { async: true })
  async handleCancelled(payload: AppointmentLifecyclePayload): Promise<void> {
    try {
      await this.syncWorker.syncAppointmentToExternal(payload.appointmentId, 'deleted');
    } catch (err) {
      this.logger.warn(
        `appointment_sync_listener_cancelled_failed id=${payload.appointmentId} err=${(err as Error).message}`,
      );
    }
  }
}
