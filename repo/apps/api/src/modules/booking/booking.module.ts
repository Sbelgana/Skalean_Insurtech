/**
 * BookingModule -- Sprint 8 Tache 8.8+ (Phase 3 Sprint 1).
 *
 * Tasks Booking module :
 *   - 8.8 Rooms (livre)
 *   - 8.9 Appointments + EXCLUDE GIST + state machine + buffer (livre)
 *   - 8.10 OAuth Calendar Sync (Google + Outlook)
 *   - 8.11 Availability calculation (slot picker)
 *   - 8.12 Bi-directional sync (push + pull events)
 *   - 8.13 iCal feed (RFC 5545 publication URL)
 *
 * Reference : B-08 Sprint 8 Tache 3.2.x.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AppointmentsController } from './controllers/appointments.controller.js';
import { RoomsController } from './controllers/rooms.controller.js';
import { AppointmentsService } from './services/appointments.service.js';
import { RoomsService } from './services/rooms.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [RoomsController, AppointmentsController],
  providers: [RoomsService, AppointmentsService],
  exports: [RoomsService, AppointmentsService],
})
export class BookingModule {}
