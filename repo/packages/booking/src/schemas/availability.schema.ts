/**
 * Zod schemas Availability -- Sprint 8 Tache 8.11.
 *
 * Computational service (no migration) :
 *   - Input : roomId + dateRange + slot duration / step / optional buffer override
 *   - Output : free slots respecting room business_hours + buffer + no overlap
 *     with active appointments (status NOT IN cancelled/no_show)
 *
 * Bornes :
 *   - Range max 31 days (eviter scans massifs)
 *   - Slot duration 15-480 min (8h max)
 *   - Step 15-60 min (resolution slot generation)
 *
 * Reference : B-08 Tache 3.2.4.
 */

import { z } from 'zod';

const MIN_SLOT_DURATION_MINUTES = 15;
const MAX_SLOT_DURATION_MINUTES = 480; // 8h
const MIN_STEP_MINUTES = 15;
const MAX_STEP_MINUTES = 60;
const MAX_BUFFER_OVERRIDE_MINUTES = 240; // 4h
const MAX_RANGE_DAYS = 31;
const MAX_RANGE_MS = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

export const FreeSlotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});
export type FreeSlotDto = z.infer<typeof FreeSlotSchema>;

export const FindFreeSlotsQuerySchema = z
  .object({
    roomId: z.string().uuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
    slotDurationMinutes: z.coerce
      .number()
      .int()
      .min(MIN_SLOT_DURATION_MINUTES)
      .max(MAX_SLOT_DURATION_MINUTES)
      .default(30),
    bufferMinutesOverride: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_BUFFER_OVERRIDE_MINUTES)
      .optional(),
    stepMinutes: z.coerce
      .number()
      .int()
      .min(MIN_STEP_MINUTES)
      .max(MAX_STEP_MINUTES)
      .default(30),
    /** Cap on returned slots (defense against unbounded scans). */
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .refine((d) => d.to > d.from, {
    message: 'to must be strictly after from',
    path: ['to'],
  })
  .refine((d) => d.to.getTime() - d.from.getTime() <= MAX_RANGE_MS, {
    message: `Range must be <= ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });
export type FindFreeSlotsQueryDto = z.infer<typeof FindFreeSlotsQuerySchema>;
