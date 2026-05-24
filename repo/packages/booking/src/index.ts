/**
 * @insurtech/booking -- Booking module Sprint 8 (Phase 3 Sprint 1).
 *
 * Exporte Zod schemas reutilisables (rooms, appointments, calendar-sync).
 * Services NestJS implementes dans apps/api/src/modules/booking/.
 *
 * Reuse potentiel : Sprint 22.5 Tow App + Sprint 22.7 Expert App pour leurs
 * propres ressources bookables (parking remorquage, bureaux expert).
 */

export const BOOKING_PACKAGE_VERSION = '0.2.0';

// Schemas Zod Room (Sprint 8 Tache 8.8)
export {
  ROOM_TYPES,
  DAYS_OF_WEEK,
  SUPPORTED_TIMEZONES,
  TIME_REGEX,
  HEX_COLOR_REGEX,
  RoomTypeSchema,
  DayOfWeekSchema,
  TimezoneSchema,
  BusinessHoursDaySchema,
  BusinessHoursSchema,
  CreateRoomSchema,
  UpdateRoomSchema,
  FilterRoomsSchema,
  type RoomType,
  type DayOfWeek,
  type SupportedTimezone,
  type BusinessHoursDayDto,
  type BusinessHoursDto,
  type CreateRoomDto,
  type UpdateRoomDto,
  type FilterRoomsDto,
} from './schemas/room.schema.js';
