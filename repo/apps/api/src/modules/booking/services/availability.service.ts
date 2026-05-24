/**
 * AvailabilityService -- Sprint 8 Tache 8.11 (Phase 3 Sprint 1 -- Booking).
 *
 * Service computationnel calculant les slots libres pour reservation. Pas de
 * nouvelle table : recompose les helpers existants Tasks 8.8 + 8.9.
 *
 * Algorithme :
 *   1. Charger la room (business_hours + buffer + timezone)
 *   2. Charger les appointments overlapping [from-buffer, to+buffer]
 *      via AppointmentsService.findOverlappingWithBuffer (Task 8.9)
 *      -- exclusion auto status cancelled/no_show
 *   3. Generer candidate slots [start, start+duration) chaque step minutes
 *   4. Filtrer :
 *      a. start >= NOW (future uniquement)
 *      b. Fits dans business_hours du jour en timezone room
 *      c. Pas d'overlap avec appointments expanded par buffer
 *
 * Timezone : Africa/Casablanca UTC+1 permanent (pas de DST depuis 2018) ;
 * Intl.DateTimeFormat suffit. Multi-tz (Asia/Tokyo, Europe/Paris, ...) supporte
 * via room.timezone IANA.
 *
 * Performance :
 *   - 31 jours range x step 15min = ~2976 candidates max
 *   - 1 seul query DB (appointments overlapping range)
 *   - Filtres in-memory ; target < 100ms 7 jours typique
 *
 * Multi-tenant : tenant_id auto via TenantContext + RLS Sprint 6.
 *
 * Reference : B-08 Tache 3.2.4.
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import type { FindFreeSlotsQueryDto } from '@insurtech/booking';
import type {
  BookingAppointmentEntity,
  BookingRoomEntity,
  DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { AppointmentsService } from './appointments.service.js';
import { RoomsService } from './rooms.service.js';

/** Output slot shape. */
export interface FreeSlot {
  readonly start: Date;
  readonly end: Date;
}

export const AVAILABILITY_ERROR_CODES = {
  TENANT_REQUIRED: 'BOOKING_AVAILABILITY_TENANT_REQUIRED',
  ROOM_NOT_FOUND: 'BOOKING_AVAILABILITY_ROOM_NOT_FOUND',
  ROOM_INACTIVE: 'BOOKING_AVAILABILITY_ROOM_INACTIVE',
} as const;

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly _dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly roomsService: RoomsService,
    private readonly appointmentsService: AppointmentsService,
  ) {
    // dataSource present pour parity DI -- pas utilise directement ici.
    void this._dataSource;
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: AVAILABILITY_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  // ==========================================================================
  // Main : find free slots
  // ==========================================================================

  async findFreeSlots(dto: FindFreeSlotsQueryDto): Promise<FreeSlot[]> {
    const tenantId = this.requireTenantId();
    const start = Date.now();

    // 1. Resolve room (business_hours + buffer + timezone)
    const room = await this.roomsService.findOne(dto.roomId);
    if (!room) {
      throw new NotFoundException({
        code: AVAILABILITY_ERROR_CODES.ROOM_NOT_FOUND,
        message: `Room ${dto.roomId} not found`,
      });
    }
    if (!room.active) {
      throw new BadRequestException({
        code: AVAILABILITY_ERROR_CODES.ROOM_INACTIVE,
        message: `Room ${dto.roomId} is inactive`,
      });
    }

    const buffer = dto.bufferMinutesOverride ?? room.bufferMinutes;

    // 2. Single DB query : appointments overlapping [from-buffer, to+buffer].
    //    findOverlappingWithBuffer (Task 8.9) excludes cancelled/no_show.
    const blocking = await this.appointmentsService.findOverlappingWithBuffer(
      undefined,
      tenantId,
      dto.roomId,
      dto.from,
      dto.to,
      buffer,
    );

    // 3. Generate candidate slots in step increments
    const candidates = this.generateCandidateSlots(
      dto.from,
      dto.to,
      dto.slotDurationMinutes,
      dto.stepMinutes,
    );

    // 4. Filter
    const now = Date.now();
    const free: FreeSlot[] = [];
    for (const slot of candidates) {
      if (free.length >= dto.limit) break;
      if (slot.start.getTime() < now) continue;
      if (!this.fitsBusinessHours(room, slot)) continue;
      if (this.overlapsAnyAppointmentWithBuffer(slot, blocking, buffer)) continue;
      free.push(slot);
    }

    const elapsedMs = Date.now() - start;
    this.logger.log(
      `booking_availability_computed tenant=${tenantId} room=${dto.roomId} from=${dto.from.toISOString()} to=${dto.to.toISOString()} duration=${dto.slotDurationMinutes}min step=${dto.stepMinutes}min buffer=${buffer}min candidates=${candidates.length} free=${free.length} elapsed_ms=${elapsedMs}`,
    );
    return free;
  }

  // ==========================================================================
  // Slot generation
  // ==========================================================================

  /**
   * Generates candidate slots in step increments from `from`. Each slot is
   * [current, current + duration). Stops when current + duration > to.
   */
  private generateCandidateSlots(
    from: Date,
    to: Date,
    durationMinutes: number,
    stepMinutes: number,
  ): FreeSlot[] {
    const slots: FreeSlot[] = [];
    const durationMs = durationMinutes * 60_000;
    const stepMs = stepMinutes * 60_000;
    let current = from.getTime();
    const limit = to.getTime();
    while (current + durationMs <= limit) {
      slots.push({
        start: new Date(current),
        end: new Date(current + durationMs),
      });
      current += stepMs;
    }
    return slots;
  }

  // ==========================================================================
  // Business hours filter
  // ==========================================================================

  /**
   * Returns true if the slot fits entirely within the room's business hours
   * for its day-of-week. Edge case : slotEnd <= dayClose is INCLUSIVE
   * (slot ending at exactly 18:00 when room closes at 18:00 is valid).
   *
   * Slot must NOT span multiple days (controller / step + duration combos
   * normally guarantee this ; we still defend against the case by checking
   * that start and end land on the same local day).
   */
  private fitsBusinessHours(
    room: BookingRoomEntity,
    slot: FreeSlot,
  ): boolean {
    const tz = room.timezone || 'Africa/Casablanca';
    const startDay = this.getDayOfWeekInTimezone(slot.start, tz);
    const endDay = this.getDayOfWeekInTimezone(slot.end, tz);
    // Reject slots crossing midnight
    if (startDay !== endDay) return false;

    const schedule = room.businessHours?.[startDay];
    if (!schedule || schedule.closed) return false;

    const startLocal = this.toLocalTime(slot.start, tz);
    const endLocal = this.toLocalTime(slot.end, tz);
    return startLocal >= schedule.open && endLocal <= schedule.close;
  }

  // ==========================================================================
  // Overlap with buffer
  // ==========================================================================

  /**
   * Returns true if any blocking appointment overlaps `slot` when both ranges
   * are expanded by `bufferMinutes` on each side.
   *
   * Buffer logic : an appointment [a, b] reserves [a - buffer, b + buffer]
   * for cleanup / transitions. A candidate slot [s, e] is blocked when
   * [s, e] overlaps [a - buffer, b + buffer].
   *
   * Standard overlap formula : a < bufferedB && b > bufferedA.
   */
  private overlapsAnyAppointmentWithBuffer(
    slot: FreeSlot,
    appointments: readonly BookingAppointmentEntity[],
    bufferMinutes: number,
  ): boolean {
    const bufferMs = bufferMinutes * 60_000;
    const slotStartMs = slot.start.getTime();
    const slotEndMs = slot.end.getTime();
    for (const appt of appointments) {
      const apptStartMs = appt.timeRange.start.getTime() - bufferMs;
      const apptEndMs = appt.timeRange.end.getTime() + bufferMs;
      if (slotStartMs < apptEndMs && slotEndMs > apptStartMs) {
        return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // Timezone helpers (Intl.DateTimeFormat -- Node 18+ ICU bundled)
  // ==========================================================================

  /**
   * Returns the day-of-week (`monday` ... `sunday`) for the given Date when
   * rendered in the target IANA timezone.
   */
  private getDayOfWeekInTimezone(date: Date, timezone: string): DayOfWeek {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    }).format(date);
    return weekday.toLowerCase() as DayOfWeek;
  }

  /**
   * Returns the 'HH:MM' time string for the given Date when rendered in the
   * target IANA timezone (24-hour clock).
   */
  private toLocalTime(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
}
