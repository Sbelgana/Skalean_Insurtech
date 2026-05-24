/**
 * AvailabilityController -- Sprint 8 Tache 8.11.
 *
 * Endpoint REST GET /api/v1/booking/availability pour lister les slots libres
 * dans une room donnee + dateRange. Reuse BOOKING_APPOINTMENTS_READ perm
 * (decision : pas de nouvelle perm catalog -- availability = read-only view of
 * appointment slots).
 *
 * Reference : B-08 Tache 3.2.4.
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@insurtech/auth';
import {
  FindFreeSlotsQuerySchema,
  type FindFreeSlotsQueryDto,
} from '@insurtech/booking';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { AvailabilityService } from '../services/availability.service.js';

@Controller('api/v1/booking/availability')
@RequireTenant()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * GET /api/v1/booking/availability
   *
   * Query params :
   *   - roomId (UUID, required)
   *   - from (ISO 8601 datetime, required)
   *   - to (ISO 8601 datetime, required, > from, <= 31 days)
   *   - slotDurationMinutes (15-480, default 30)
   *   - stepMinutes (15-60, default 30)
   *   - bufferMinutesOverride (0-240, optional)
   *   - limit (1-500, default 200)
   *
   * Response : `{ slots: FreeSlot[] }` -- ISO 8601 datetime in UTC. The room's
   * timezone is used internally for business hours matching; clients render
   * to local timezone for display.
   */
  @Get()
  @RequirePermission(Permission.BOOKING_APPOINTMENTS_READ)
  async findFreeSlots(@Query() query: unknown): Promise<{ slots: FindFreeSlotsResponseSlot[] }> {
    const dto = FindFreeSlotsQuerySchema.parse(query) satisfies FindFreeSlotsQueryDto;
    const slots = await this.availability.findFreeSlots(dto);
    return {
      slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
    };
  }
}

interface FindFreeSlotsResponseSlot {
  readonly start: string;
  readonly end: string;
}
