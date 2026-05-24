/**
 * BookingModule -- Sprint 8 Tache 8.8+ (Phase 3 Sprint 1).
 *
 * Tasks Booking module :
 *   - 8.8 Rooms (livre)
 *   - 8.9 Appointments + EXCLUDE GIST
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
import { RoomsController } from './controllers/rooms.controller.js';
import { RoomsService } from './services/rooms.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class BookingModule {}
