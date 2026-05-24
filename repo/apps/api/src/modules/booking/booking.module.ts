/**
 * BookingModule -- Sprint 8 Tache 8.8+ (Phase 3 Sprint 1).
 *
 * Tasks Booking module :
 *   - 8.8 Rooms (livre)
 *   - 8.9 Appointments + EXCLUDE GIST + state machine + buffer (livre)
 *   - 8.10a Calendar Sync foundation (livre)
 *   - 8.10b OAuth providers + webhook subscriptions + state CSRF (livre -- Phase 1)
 *   - 8.11 Availability service (livre)
 *   - 8.12 Bi-directional sync (Phase 2 -- deferred next session)
 *   - 8.13 iCal feed (RFC 5545 publication URL)
 *
 * OAuth providers boot with placeholder detection (OAuthCalendarConfig).
 * When credentials are placeholders, endpoints return HTTP 503 cleanly.
 * Activation : swap 6 lines of .env.development + restart.
 *
 * Reference : B-08 Sprint 8 Tache 3.2.x.
 */
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AppointmentsController } from './controllers/appointments.controller.js';
import { AvailabilityController } from './controllers/availability.controller.js';
import { CalendarSyncController } from './controllers/calendar-sync.controller.js';
import { RoomsController } from './controllers/rooms.controller.js';
import { OAuthCalendarConfig } from './config/oauth-calendar.config.js';
import { GoogleCalendarProvider } from './providers/google-calendar.provider.js';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider.js';
import { AppointmentSyncListener } from './services/appointment-sync.listener.js';
import { AppointmentsService } from './services/appointments.service.js';
import { AvailabilityService } from './services/availability.service.js';
import { CalendarOAuth2Service } from './services/calendar-oauth2.service.js';
import { CalendarSyncTokenService } from './services/calendar-sync-token.service.js';
import { CalendarSyncWorkerService } from './services/calendar-sync-worker.service.js';
import { CalendarWebhookManagerService } from './services/calendar-webhook-manager.service.js';
import { OAuthStateService } from './services/oauth-state.service.js';
import { RoomsService } from './services/rooms.service.js';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: false,
      // Async handlers run on a separate microtask so create() responses
      // are not blocked by external HTTP calls (Phase 2 fire-and-forget).
    }),
  ],
  controllers: [
    RoomsController,
    AppointmentsController,
    AvailabilityController,
    CalendarSyncController,
  ],
  providers: [
    // Core booking
    RoomsService,
    AppointmentsService,
    AvailabilityService,
    // Calendar sync foundation
    CalendarSyncTokenService,
    // Calendar sync OAuth (Task 8.10b)
    OAuthCalendarConfig,
    GoogleCalendarProvider,
    OutlookCalendarProvider,
    OAuthStateService,
    CalendarOAuth2Service,
    CalendarWebhookManagerService,
    // Phase 2 (Task 8.12) -- bi-directional sync worker + listener
    CalendarSyncWorkerService,
    AppointmentSyncListener,
  ],
  exports: [
    RoomsService,
    AppointmentsService,
    AvailabilityService,
    CalendarSyncTokenService,
    CalendarOAuth2Service,
    CalendarSyncWorkerService,
  ],
})
export class BookingModule {}
