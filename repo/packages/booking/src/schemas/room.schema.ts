/**
 * Zod schemas Room -- Sprint 8 Tache 8.8.
 *
 * Booking Rooms (salles bookables transverses : broker bureau, garage workshop,
 * carrier reunion, expert visite, tow parking, generique).
 *
 * Conformite v3.0 :
 *   - tenant_id automatique via TenantContext (pas dans schema input)
 *   - timezone default 'Africa/Casablanca' (UTC+1 permanent, pas de DST)
 *   - business_hours per-day JSONB structure
 *   - color hex #RRGGBB
 *   - room_type CHECK 6 valeurs (alignee migration 021)
 *
 * Reference : B-08 Tache 3.2.1.
 */

import { z } from 'zod';

export const ROOM_TYPES = [
  'meeting',
  'office',
  'workshop',
  'parking',
  'visit',
  'other',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** Default Maroc timezone -- UTC+1 permanent, no DST since 2018. */
export const SUPPORTED_TIMEZONES = ['Africa/Casablanca'] as const;
export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];

export const RoomTypeSchema = z.enum(ROOM_TYPES);
export const DayOfWeekSchema = z.enum(DAYS_OF_WEEK);
export const TimezoneSchema = z.enum(SUPPORTED_TIMEZONES);

/** HH:MM 24-hour format. */
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const BusinessHoursDaySchema = z
  .object({
    open: z.string().regex(TIME_REGEX, 'open must be HH:MM (24h)'),
    close: z.string().regex(TIME_REGEX, 'close must be HH:MM (24h)'),
    closed: z.boolean().optional().default(false),
  })
  .refine(
    (d) => d.closed === true || d.open < d.close,
    {
      message: 'open must be before close (or set closed: true)',
      path: ['close'],
    },
  );

export type BusinessHoursDayDto = z.infer<typeof BusinessHoursDaySchema>;

/**
 * Per-day schedule. Days not provided default to "open all day" semantics at
 * the service level (or "closed" if the calling code requires it). The schema
 * accepts a partial record.
 */
export const BusinessHoursSchema = z
  .record(DayOfWeekSchema, BusinessHoursDaySchema)
  .default({});
export type BusinessHoursDto = z.infer<typeof BusinessHoursSchema>;

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ---------------------------------------------------------------------------
// Create / Update
// ---------------------------------------------------------------------------

export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  capacity: z.number().int().min(1).max(999).default(1),
  location: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  timezone: TimezoneSchema.default('Africa/Casablanca'),
  businessHours: BusinessHoursSchema,
  bufferMinutes: z.number().int().min(0).max(480).default(15),
  equipment: z.array(z.string().min(1).max(50)).max(50).default([]),
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Color must be hex format #RRGGBB')
    .default('#3B82F6'),
  roomType: RoomTypeSchema.default('meeting'),
});
export type CreateRoomDto = z.infer<typeof CreateRoomSchema>;

const updateRoomShape = {
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  capacity: z.number().int().min(1).max(999).optional(),
  location: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  timezone: TimezoneSchema.optional(),
  businessHours: z
    .record(DayOfWeekSchema, BusinessHoursDaySchema)
    .optional(),
  bufferMinutes: z.number().int().min(0).max(480).optional(),
  equipment: z.array(z.string().min(1).max(50)).max(50).optional(),
  color: z.string().regex(HEX_COLOR_REGEX).optional(),
  roomType: RoomTypeSchema.optional(),
};
export const UpdateRoomSchema = z.object(updateRoomShape);
export type UpdateRoomDto = z.infer<typeof UpdateRoomSchema>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const FilterRoomsSchema = z.object({
  city: z.string().max(100).optional(),
  roomType: RoomTypeSchema.optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
  activeOnly: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(['name', 'created_at', 'capacity']).default('name'),
  orderDir: z.enum(['ASC', 'DESC']).default('ASC'),
});
export type FilterRoomsDto = z.infer<typeof FilterRoomsSchema>;
