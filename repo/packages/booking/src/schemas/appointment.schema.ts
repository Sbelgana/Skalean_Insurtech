/**
 * Zod schemas Appointment -- Sprint 8 Tache 8.9.
 *
 * Booking Appointments avec :
 *   - State machine 6 valeurs (scheduled/confirmed/in_progress/completed/cancelled/no_show)
 *   - Polymorphic related max 1 (deal_id XOR sinistre_id XOR expert_assignment_id, ou
 *     standalone si tous null)
 *   - Buffer logic Option B : service layer enforcement (RoomsService.bufferMinutes)
 *   - DB EXCLUDE GIST btree_gist (Sprint 2 + 8.9) garantit zero raw overlap
 *   - Duration >= 15 minutes CHECK (DB) + refine Zod
 *
 * Reference : B-08 Tache 3.2.2.
 */

import { z } from 'zod';

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const AppointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const EXTERNAL_CALENDAR_PROVIDERS = ['google', 'outlook'] as const;
export type ExternalCalendarProvider = (typeof EXTERNAL_CALENDAR_PROVIDERS)[number];
export const ExternalCalendarProviderSchema = z.enum(EXTERNAL_CALENDAR_PROVIDERS);

export const AttendeeSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().optional(),
  phone: z.string().max(25).optional(),
});
export type AttendeeDto = z.infer<typeof AttendeeSchema>;

const MIN_DURATION_MINUTES = 15;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const CreateAppointmentSchema = z
  .object({
    roomId: z.string().uuid(),
    /**
     * The user organizing the appointment. Stored in `assigned_user_id` per
     * Sprint 2 column naming (no rename to avoid touching 8.x tests).
     */
    organizerUserId: z.string().uuid().optional(),
    title: z.string().min(1).max(255),
    description: z.string().max(5000).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    timezone: z.string().default('Africa/Casablanca'),
    attendees: z.array(AttendeeSchema).max(200).default([]),
    maxAttendees: z.number().int().min(1).max(10_000).optional(),
    contactId: z.string().uuid().nullable().optional(),
    // Polymorphic related (max 1)
    dealId: z.string().uuid().optional(),
    sinistreId: z.string().uuid().optional(),
    expertAssignmentId: z.string().uuid().optional(),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  })
  .refine(
    (d) => {
      const minutes = (d.endAt.getTime() - d.startAt.getTime()) / 60_000;
      return minutes >= MIN_DURATION_MINUTES;
    },
    {
      message: `Duration minimum ${MIN_DURATION_MINUTES} minutes`,
      path: ['endAt'],
    },
  )
  .refine(
    (d) =>
      [d.dealId, d.sinistreId, d.expertAssignmentId].filter(
        (v) => v !== undefined && v !== null,
      ).length <= 1,
    {
      message:
        'Maximum 1 attached entity (deal / sinistre / expertAssignment). Standalone (zero) is also OK.',
      path: ['dealId'],
    },
  );

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;

// ---------------------------------------------------------------------------
// Update (roomId + organizer immutable -- cancel+recreate to change)
// ---------------------------------------------------------------------------

export const UpdateAppointmentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  attendees: z.array(AttendeeSchema).max(200).optional(),
  maxAttendees: z.number().int().min(1).max(10_000).nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;

// ---------------------------------------------------------------------------
// Reschedule (atomic update of time_range)
// ---------------------------------------------------------------------------

export const RescheduleAppointmentSchema = z
  .object({
    newStartAt: z.coerce.date(),
    newEndAt: z.coerce.date(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.newEndAt > d.newStartAt, {
    message: 'newEndAt must be after newStartAt',
    path: ['newEndAt'],
  })
  .refine(
    (d) => (d.newEndAt.getTime() - d.newStartAt.getTime()) / 60_000 >= MIN_DURATION_MINUTES,
    {
      message: `Duration minimum ${MIN_DURATION_MINUTES} minutes`,
      path: ['newEndAt'],
    },
  );
export type RescheduleAppointmentDto = z.infer<typeof RescheduleAppointmentSchema>;

// ---------------------------------------------------------------------------
// Cancel / Reopen
// ---------------------------------------------------------------------------

export const CancelAppointmentSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type CancelAppointmentDto = z.infer<typeof CancelAppointmentSchema>;

export const ReopenAppointmentSchema = z.object({
  reason: z.string().min(5).max(500),
});
export type ReopenAppointmentDto = z.infer<typeof ReopenAppointmentSchema>;

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const FilterAppointmentsSchema = z.object({
  roomId: z.string().uuid().optional(),
  organizerUserId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  status: AppointmentStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(['start_at', 'created_at']).default('start_at'),
  orderDir: z.enum(['ASC', 'DESC']).default('ASC'),
});
export type FilterAppointmentsDto = z.infer<typeof FilterAppointmentsSchema>;
