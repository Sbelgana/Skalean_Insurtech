/**
 * @insurtech/booking -- Booking module Sprint 8 (Phase 3 Sprint 1).
 *
 * Exporte Zod schemas reutilisables (rooms, appointments, calendar-sync).
 * Services NestJS implementes dans apps/api/src/modules/booking/.
 *
 * Reuse potentiel : Sprint 22.5 Tow App + Sprint 22.7 Expert App pour leurs
 * propres ressources bookables (parking remorquage, bureaux expert).
 */

export const BOOKING_PACKAGE_VERSION = '0.5.0';

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

// Schemas Zod Appointment (Sprint 8 Tache 8.9)
export {
  APPOINTMENT_STATUSES,
  EXTERNAL_CALENDAR_PROVIDERS,
  AppointmentStatusSchema,
  ExternalCalendarProviderSchema,
  AttendeeSchema,
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  RescheduleAppointmentSchema,
  CancelAppointmentSchema,
  ReopenAppointmentSchema,
  FilterAppointmentsSchema,
  type AppointmentStatus,
  type ExternalCalendarProvider,
  type AttendeeDto,
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type RescheduleAppointmentDto,
  type CancelAppointmentDto,
  type ReopenAppointmentDto,
  type FilterAppointmentsDto,
} from './schemas/appointment.schema.js';

// Schemas Zod Calendar Sync (Sprint 8 Tache 8.10 -- foundation only)
export {
  CALENDAR_PROVIDERS,
  CALENDAR_SYNC_STATUSES,
  CalendarProviderSchema,
  CalendarSyncStatusSchema,
  SaveCalendarTokensSchema,
  SaveWebhookSubscriptionSchema,
  RecordSyncOutcomeSchema,
  FilterCalendarSyncsSchema,
  ConnectionInfoSchema,
  type CalendarProvider,
  type CalendarSyncStatus,
  type SaveCalendarTokensDto,
  type SaveWebhookSubscriptionDto,
  type RecordSyncOutcomeDto,
  type FilterCalendarSyncsDto,
  type ConnectionInfoDto,
} from './schemas/calendar-sync.schema.js';

// Schemas Zod Availability (Sprint 8 Tache 8.11)
export {
  FreeSlotSchema,
  FindFreeSlotsQuerySchema,
  type FreeSlotDto,
  type FindFreeSlotsQueryDto,
} from './schemas/availability.schema.js';
