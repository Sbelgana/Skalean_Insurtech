/**
 * Tests AvailabilityService -- Sprint 8 Tache 8.11.
 *
 * Service computationnel : pas de DataSource direct, mais mocks pour
 * RoomsService.findOne et AppointmentsService.findOverlappingWithBuffer.
 *
 * Couvre : happy path / business_hours / buffer overlap / state filtering /
 * range validation / multi-tenant via tenantContext / timezone helpers.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import type { BookingAppointmentEntity, BookingRoomEntity } from '@insurtech/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentsService } from './appointments.service.js';
import {
  AVAILABILITY_ERROR_CODES,
  AvailabilityService,
} from './availability.service.js';
import { RoomsService } from './rooms.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const ROOM_ID = '00000000-0000-0000-0000-000000000500';

function buildTenantContext(tenantId: string | undefined): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      tenantId
        ? {
            tenantId,
            userId: USER_A,
            userRole: undefined,
            isSuperAdmin: false,
            traceId: 'trc',
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
          }
        : undefined,
  } as unknown as TenantContextService;
}

/** Room open Mon-Fri 09:00-18:00 Casablanca, weekend closed, buffer 15min. */
function buildOpenRoom(overrides: Partial<BookingRoomEntity> = {}): BookingRoomEntity {
  return {
    id: ROOM_ID,
    tenantId: TENANT_A,
    active: true,
    timezone: 'Africa/Casablanca',
    bufferMinutes: 15,
    businessHours: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
    },
    ...overrides,
  } as unknown as BookingRoomEntity;
}

interface ServiceOpts {
  tenantId?: string;
  room?: BookingRoomEntity | null;
  appointments?: BookingAppointmentEntity[];
  appointmentsThrows?: Error;
}

function buildService(opts: ServiceOpts = {}): {
  service: AvailabilityService;
  appointmentsService: AppointmentsService;
} {
  const roomsService = {
    findOne: vi.fn().mockResolvedValue(opts.room ?? buildOpenRoom()),
  } as unknown as RoomsService;
  const appointmentsService = {
    findOverlappingWithBuffer: opts.appointmentsThrows
      ? vi.fn().mockRejectedValue(opts.appointmentsThrows)
      : vi.fn().mockResolvedValue(opts.appointments ?? []),
  } as unknown as AppointmentsService;
  const dataSource = {} as unknown;
  const service = new AvailabilityService(
    dataSource as never,
    buildTenantContext(opts.tenantId ?? TENANT_A),
    roomsService,
    appointmentsService,
  );
  return { service, appointmentsService };
}

/** Build an appointment with a fixed time_range. */
function buildAppointment(start: Date, end: Date): BookingAppointmentEntity {
  return {
    id: `appt-${start.toISOString()}`,
    tenantId: TENANT_A,
    roomId: ROOM_ID,
    timeRange: { start, end },
    status: 'scheduled',
  } as unknown as BookingAppointmentEntity;
}

/** Monday 2026-01-05 09:00 UTC = 10:00 Casablanca. We work in UTC at the boundary. */
const MONDAY_UTC = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 5, h, m, 0));
/** Sunday 2026-01-04. */
const SUNDAY_UTC = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 4, h, m, 0));

describe('AvailabilityService (Sprint 8 Tache 8.11)', () => {
  // Force the "now" reference well before our test dates so future-only filter
  // does not eliminate slots.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findFreeSlots -- happy paths', () => {
    it('1. throws TENANT_REQUIRED if no tenant context', async () => {
      const { service } = buildService({ tenantId: '' });
      await expect(
        service.findFreeSlots({
          roomId: ROOM_ID,
          from: MONDAY_UTC(8),
          to: MONDAY_UTC(17),
          slotDurationMinutes: 30,
          stepMinutes: 30,
          limit: 200,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('2. room open + no appointments -> slots cover business hours', async () => {
      const { service } = buildService();
      // Monday 09:00-17:00 Casablanca (Africa/Casablanca = UTC+1) -> UTC 08:00-16:00
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(16),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      // 8 hourly slots between 09:00 and 17:00 local (UTC 08-16) but the last
      // slot must end at <= 18:00 local = 17:00 UTC. With duration 60 + step 60
      // and range UTC 08-16, candidates end at 09,10,11,12,13,14,15,16 UTC.
      // All fit (09:00..17:00 local) -> 8 slots.
      expect(result).toHaveLength(8);
      expect(result[0]?.start.toISOString()).toBe('2026-01-05T08:00:00.000Z');
      expect(result[7]?.end.toISOString()).toBe('2026-01-05T16:00:00.000Z');
    });

    it('3. single appointment 10:00-11:00 local + buffer 15min blocks adjacent slots', async () => {
      // Appointment Monday 10:00-11:00 Casablanca = UTC 09:00-10:00
      const appt = buildAppointment(MONDAY_UTC(9), MONDAY_UTC(10));
      const { service } = buildService({ appointments: [appt] });
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(13),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        limit: 200,
      });
      // Candidate slots in UTC 08-13 (= 09-14 local), 30min duration, 30min step:
      //   08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30 UTC
      // Appointment 09:00-10:00 with buffer 15 blocks 08:45 -> 10:15
      //   -> blocks candidates 08:30 (08:30-09:00 overlaps 08:45+), 09:00, 09:30, 10:00
      //   -> remaining candidates : 08:00, 10:30, 11:00, 11:30, 12:00, 12:30 = 6
      expect(result).toHaveLength(6);
      // First free slot is 08:00 UTC (09:00 local), last blocked candidate was 10:00 UTC
      expect(result[0]?.start.toISOString()).toBe('2026-01-05T08:00:00.000Z');
      // Next slot after the appointment+buffer is 10:30 UTC (11:30 local)
      expect(result[1]?.start.toISOString()).toBe('2026-01-05T10:30:00.000Z');
    });

    it('4. multiple appointments correctly partition free time', async () => {
      // Monday 10:00-10:30 local (UTC 09:00-09:30) + 14:00-15:00 local (UTC 13:00-14:00)
      const a1 = buildAppointment(MONDAY_UTC(9), MONDAY_UTC(9, 30));
      const a2 = buildAppointment(MONDAY_UTC(13), MONDAY_UTC(14));
      const { service } = buildService({ appointments: [a1, a2] });
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(16),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        limit: 200,
      });
      // Plenty of free slots ; verify a1+buffer + a2+buffer windows excluded
      const isos = result.map((s) => s.start.toISOString());
      // 08:30 candidate (08:30-09:00) overlaps a1+buffer (08:45-09:45) -> blocked
      expect(isos).not.toContain('2026-01-05T08:30:00.000Z');
      // 09:30 candidate (09:30-10:00) overlaps a1+buffer -> blocked
      expect(isos).not.toContain('2026-01-05T09:30:00.000Z');
      // 12:30 candidate (12:30-13:00) overlaps a2+buffer (12:45-14:15) -> blocked
      expect(isos).not.toContain('2026-01-05T12:30:00.000Z');
      // 14:00 candidate (14:00-14:30) overlaps a2+buffer -> blocked
      expect(isos).not.toContain('2026-01-05T14:00:00.000Z');
      // 14:30 candidate (14:30-15:00) overlaps a2+buffer (extends to 14:15) -> NOT blocked at start, but end 15:00 > apptEnd+buffer 14:15, overlap check 14:30 < 14:15 = false -> FREE
      expect(isos).toContain('2026-01-05T14:30:00.000Z');
    });
  });

  describe('findFreeSlots -- business hours filtering', () => {
    it('5. slot 07:00 local (UTC 06:00, before 09:00 open) is rejected', async () => {
      const { service } = buildService();
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(6),
        to: MONDAY_UTC(11),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      // Local time 07:00-08:00 + 08:00-09:00 candidates blocked (before 09:00 open).
      // 09:00, 10:00, 11:00 local UTC 08, 09, 10 slots OK.
      const isos = result.map((s) => s.start.toISOString());
      expect(isos).not.toContain('2026-01-05T06:00:00.000Z');
      expect(isos).not.toContain('2026-01-05T07:00:00.000Z');
      expect(isos).toContain('2026-01-05T08:00:00.000Z'); // 09:00 local
    });

    it('6. slot ending after 18:00 close is rejected', async () => {
      const { service } = buildService();
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(15),
        to: MONDAY_UTC(20),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      const isos = result.map((s) => s.start.toISOString());
      // 16:00-17:00 local (UTC 15-16) OK ; 17:00-18:00 local (UTC 16-17) OK (end == close inclusive) ;
      // 18:00-19:00 local (UTC 17-18) rejected (end > close)
      expect(isos).toContain('2026-01-05T15:00:00.000Z');
      expect(isos).toContain('2026-01-05T16:00:00.000Z');
      expect(isos).not.toContain('2026-01-05T17:00:00.000Z');
    });

    it('7. closed day (no schedule for sunday) -> no slots', async () => {
      const { service } = buildService();
      // Sunday 2026-01-04 -- room has no schedule for sunday
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: SUNDAY_UTC(8),
        to: SUNDAY_UTC(17),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      expect(result).toEqual([]);
    });

    it('8. explicitly closed day rejects all slots', async () => {
      const room = buildOpenRoom({
        businessHours: {
          monday: { open: '00:00', close: '00:00', closed: true },
        } as unknown as BookingRoomEntity['businessHours'],
      });
      const { service } = buildService({ room });
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(17),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      expect(result).toEqual([]);
    });

    it('9. slot end exactly at close time is INCLUSIVE (boundary OK)', async () => {
      const { service } = buildService();
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(16, 30),
        to: MONDAY_UTC(17),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        limit: 200,
      });
      // 17:30-18:00 local (UTC 16:30-17:00) : end == close 18:00 local -> INCLUSIVE
      expect(result).toHaveLength(1);
      expect(result[0]?.start.toISOString()).toBe('2026-01-05T16:30:00.000Z');
    });
  });

  describe('findFreeSlots -- room validation', () => {
    it('10. throws NotFound when room missing', async () => {
      const roomsService = {
        findOne: vi.fn().mockRejectedValue(
          new NotFoundException({ code: 'X', message: 'room missing' }),
        ),
      } as unknown as RoomsService;
      const appointmentsService = {
        findOverlappingWithBuffer: vi.fn().mockResolvedValue([]),
      } as unknown as AppointmentsService;
      const service = new AvailabilityService(
        {} as never,
        buildTenantContext(TENANT_A),
        roomsService,
        appointmentsService,
      );
      await expect(
        service.findFreeSlots({
          roomId: ROOM_ID,
          from: MONDAY_UTC(8),
          to: MONDAY_UTC(17),
          slotDurationMinutes: 60,
          stepMinutes: 60,
          limit: 200,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('11. rejects inactive room', async () => {
      const room = buildOpenRoom({ active: false });
      const { service } = buildService({ room });
      try {
        await service.findFreeSlots({
          roomId: ROOM_ID,
          from: MONDAY_UTC(8),
          to: MONDAY_UTC(17),
          slotDurationMinutes: 60,
          stepMinutes: 60,
          limit: 200,
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as { code?: string };
        expect(res.code).toBe(AVAILABILITY_ERROR_CODES.ROOM_INACTIVE);
      }
    });
  });

  describe('findFreeSlots -- future-only filter', () => {
    it('12. past slots are filtered out', async () => {
      // Move "now" to Monday 14:00 UTC (= 15:00 local). Slots before 15:00 local should be filtered.
      vi.setSystemTime(MONDAY_UTC(14));
      const { service } = buildService();
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(17),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      // All slots starting before NOW=14:00 UTC filtered.
      // 14:00-15:00 UTC slot is the first to pass.
      const isos = result.map((s) => s.start.toISOString());
      expect(isos).not.toContain('2026-01-05T08:00:00.000Z');
      expect(isos).not.toContain('2026-01-05T13:00:00.000Z');
      expect(isos).toContain('2026-01-05T14:00:00.000Z');
    });
  });

  describe('findFreeSlots -- buffer override', () => {
    it('13. bufferMinutesOverride uses passed value instead of room.bufferMinutes', async () => {
      const appt = buildAppointment(MONDAY_UTC(9), MONDAY_UTC(10));
      const { service, appointmentsService } = buildService({ appointments: [appt] });
      await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(13),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        bufferMinutesOverride: 60,
        limit: 200,
      });
      // findOverlappingWithBuffer called with override buffer
      const findFn = appointmentsService.findOverlappingWithBuffer as ReturnType<
        typeof vi.fn
      >;
      const lastCall = findFn.mock.calls[findFn.mock.calls.length - 1];
      expect(lastCall?.[5]).toBe(60); // 6th arg is bufferMinutes
    });

    it('14. bufferMinutesOverride = 0 = no buffer (back-to-back slots OK)', async () => {
      const appt = buildAppointment(MONDAY_UTC(9), MONDAY_UTC(10));
      const { service } = buildService({ appointments: [appt] });
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(13),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        bufferMinutesOverride: 0,
        limit: 200,
      });
      const isos = result.map((s) => s.start.toISOString());
      // Without buffer, 09:00-09:30 candidate (UTC 09:00-09:30) DOES overlap appt 09:00-10:00 UTC -> blocked
      expect(isos).not.toContain('2026-01-05T09:00:00.000Z');
      // 08:30-09:00 candidate ends at appt start = no overlap -> FREE
      expect(isos).toContain('2026-01-05T08:30:00.000Z');
      // 10:00-10:30 candidate starts at appt end = no overlap -> FREE
      expect(isos).toContain('2026-01-05T10:00:00.000Z');
    });
  });

  describe('findFreeSlots -- cancelled / no_show excluded', () => {
    it('15. delegates filtering to AppointmentsService.findOverlappingWithBuffer (excludes cancelled/no_show)', async () => {
      // The service contract of findOverlappingWithBuffer is to exclude
      // cancelled/no_show (Task 8.9). Here we confirm Availability does NOT
      // re-filter -- it trusts the upstream service.
      const { service, appointmentsService } = buildService({
        appointments: [],
      });
      await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(17),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      expect(appointmentsService.findOverlappingWithBuffer).toHaveBeenCalled();
    });
  });

  describe('limit cap', () => {
    it('16. respects limit param (defense against unbounded scans)', async () => {
      const { service } = buildService();
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(17),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        limit: 3,
      });
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe('timezone helpers', () => {
    it('17. day-of-week is computed in room timezone (Casablanca UTC+1)', async () => {
      // Sunday 2026-01-04 23:30 UTC = Monday 2026-01-05 00:30 Casablanca
      // The slot should be considered as falling on Monday (closed day for our
      // test room would NOT apply since monday is open). Use a slot in the
      // overlap zone to verify day boundary.
      const room = buildOpenRoom({
        businessHours: {
          // Only Monday open, Sunday explicitly closed
          monday: { open: '00:00', close: '23:59', closed: false },
          sunday: { open: '00:00', close: '23:59', closed: true },
        } as unknown as BookingRoomEntity['businessHours'],
      });
      const { service } = buildService({ room });
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        // 2026-01-04 23:00 UTC = 2026-01-05 00:00 Casablanca (Monday)
        from: SUNDAY_UTC(23),
        to: MONDAY_UTC(1),
        slotDurationMinutes: 30,
        stepMinutes: 30,
        limit: 200,
      });
      // 23:00 UTC (00:00 local Monday) + 23:30 UTC (00:30 local Monday) candidates
      // Monday open all day in this test -> all should pass
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.start.toISOString()).toBe('2026-01-04T23:00:00.000Z');
    });

    it('18. slot crossing day boundary in local time is rejected', async () => {
      const room = buildOpenRoom({
        businessHours: {
          monday: { open: '00:00', close: '23:59', closed: false },
          tuesday: { open: '00:00', close: '23:59', closed: false },
        } as unknown as BookingRoomEntity['businessHours'],
      });
      const { service } = buildService({ room });
      // Slot starting 23:30 local Monday (UTC 22:30) with duration 60 min
      // ends at 00:30 local Tuesday -- crosses day boundary -> rejected.
      const result = await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(22, 30),
        to: MONDAY_UTC(23, 30),
        slotDurationMinutes: 60,
        stepMinutes: 30,
        limit: 200,
      });
      expect(result).toEqual([]);
    });
  });

  describe('error codes constant', () => {
    it('19. exposes expected error codes', () => {
      expect(AVAILABILITY_ERROR_CODES.ROOM_INACTIVE).toBe('BOOKING_AVAILABILITY_ROOM_INACTIVE');
      expect(AVAILABILITY_ERROR_CODES.ROOM_NOT_FOUND).toBe('BOOKING_AVAILABILITY_ROOM_NOT_FOUND');
    });
  });

  describe('multi-tenant', () => {
    it('20. passes tenantId to findOverlappingWithBuffer (defense in depth)', async () => {
      const { service, appointmentsService } = buildService();
      await service.findFreeSlots({
        roomId: ROOM_ID,
        from: MONDAY_UTC(8),
        to: MONDAY_UTC(17),
        slotDurationMinutes: 60,
        stepMinutes: 60,
        limit: 200,
      });
      const findFn = appointmentsService.findOverlappingWithBuffer as ReturnType<
        typeof vi.fn
      >;
      const lastCall = findFn.mock.calls[findFn.mock.calls.length - 1];
      expect(lastCall?.[1]).toBe(TENANT_A);
    });
  });
});
