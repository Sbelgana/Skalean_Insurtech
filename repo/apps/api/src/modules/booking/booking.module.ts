/**
 * BookingModule -- Sprint 8 Tache 8.8+ (Phase 3 Sprint 1).
 *
 * Tasks Booking module :
 *   - 8.8 Rooms (livre)
 *   - 8.9 Appointments + EXCLUDE GIST + state machine + buffer (livre)
 *   - 8.10 Calendar Sync foundation (livre -- OAuth providers deferred 8.10b)
 *   - 8.11 Availability service (livre)
 *   - 8.12 Bi-directional sync (push + pull events, depends on 8.10b)
 *   - 8.13 iCal feed (RFC 5545 publication URL)
 *
 * Reference : B-08 Sprint 8 Tache 3.2.x.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AppointmentsController } from './controllers/appointments.controller.js';
import { AvailabilityController } from './controllers/availability.controller.js';
import { RoomsController } from './controllers/rooms.controller.js';
import { AppointmentsService } from './services/appointments.service.js';
import { AvailabilityService } from './services/availability.service.js';
import { CalendarSyncTokenService } from './services/calendar-sync-token.service.js';
import { RoomsService } from './services/rooms.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    RoomsController,
    AppointmentsController,
    AvailabilityController,
  ],
  providers: [
    RoomsService,
    AppointmentsService,
    AvailabilityService,
    CalendarSyncTokenService,
  ],
  exports: [
    RoomsService,
    AppointmentsService,
    AvailabilityService,
    CalendarSyncTokenService,
  ],
})
export class BookingModule {}
