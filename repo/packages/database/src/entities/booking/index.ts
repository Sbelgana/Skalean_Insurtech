export {
  BookingRoomEntity,
  type BookingRoomType,
  type BookingBusinessHoursDay,
  type BookingBusinessHours,
} from './booking-room.entity.js';
export {
  BookingAppointmentEntity,
  type BookingAppointmentStatus,
  type BookingExternalCalendarProvider,
  type BookingAttendee,
} from './booking-appointment.entity.js';
export {
  BookingCalendarSyncEntity,
  type BookingCalendarProvider,
  type BookingCalendarLastSyncStatus,
} from './booking-calendar-sync.entity.js';
export { TimeRangeTransformer, type TimeRange } from './transformers/time-range.transformer.js';
export { createEncryptedColumnTransformer } from './transformers/encrypted-column.transformer.js';

import { BookingRoomEntity } from './booking-room.entity.js';
import { BookingAppointmentEntity } from './booking-appointment.entity.js';
import { BookingCalendarSyncEntity } from './booking-calendar-sync.entity.js';

export const bookingEntities = [
  BookingRoomEntity,
  BookingAppointmentEntity,
  BookingCalendarSyncEntity,
] as const;
