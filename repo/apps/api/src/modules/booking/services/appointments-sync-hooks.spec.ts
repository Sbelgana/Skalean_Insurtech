/**
 * Tests AppointmentsService Phase 2 hooks -- Sprint 8 Tache 8.12.
 *
 * Focus on the loop-prevention contract :
 *   - When skipExternalSync is NOT set, lifecycle events are emitted on the
 *     @nestjs/event-emitter bus -> AppointmentSyncListener -> push to external.
 *   - When skipExternalSync IS set, NO event is emitted -> NO push -> no loop.
 *
 * Plus : helper methods (findByExternalIdAs, updateExternalReference,
 * findByIdAs) used by CalendarSyncWorkerService.
 *
 * Existing AppointmentsService spec (appointments.service.spec.ts) is left
 * untouched -- this file only exercises the Phase 2 additions.
 */

import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { TenantContextService } from '@insurtech/auth';
import type {
  BookingAppointmentEntity,
  DataSource,
} from '@insurtech/database';
import { describe, expect, it, vi } from 'vitest';
import type { RoomsService } from './rooms.service.js';
import {
  APPOINTMENT_EVENTS,
  AppointmentsService,
} from './appointments.service.js';

const TENANT_A = '00000000-0000-0000-0000-000000000001';
const USER_A = '00000000-0000-0000-0000-000000000002';
const APPT_A = '00000000-0000-0000-0000-000000000600';
const ROOM_OPEN = {
  id: '00000000-0000-0000-0000-000000000500',
  tenantId: TENANT_A,
  name: 'Bay 2',
  active: true,
  bufferMinutes: 0,
  businessHours: { monday: [{ start: '00:00', end: '23:59' }] },
};

function buildQb() {
  return {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({}),
    getMany: vi.fn().mockResolvedValue([]),
  };
}

function buildRepo(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((data) => ({ ...data, id: APPT_A })),
    save: vi.fn(async (data) => ({ ...data, id: APPT_A })),
    createQueryBuilder: vi.fn(() => buildQb()),
    ...overrides,
  };
}

function buildService(opts: {
  emitter?: EventEmitter2 | undefined;
  apptFindOneResult?: BookingAppointmentEntity | null;
} = {}) {
  const apptRepo = buildRepo({
    findOne: vi.fn().mockResolvedValue(opts.apptFindOneResult ?? null),
  });
  const roomRepo = buildRepo({
    findOne: vi.fn().mockResolvedValue(ROOM_OPEN),
  });
  const txQb = buildQb();
  const txEm = {
    getRepository: vi.fn((entity: unknown) => {
      const name = (entity as { name?: string })?.name ?? '';
      return name === 'BookingRoomEntity' ? roomRepo : apptRepo;
    }),
    createQueryBuilder: vi.fn(() => txQb),
  };
  const dataSource = {
    getRepository: vi.fn((entity: unknown) => {
      const name = (entity as { name?: string })?.name ?? '';
      return name === 'BookingRoomEntity' ? roomRepo : apptRepo;
    }),
    transaction: vi.fn(async (fn: (em: unknown) => Promise<unknown>) => fn(txEm)),
  } as unknown as DataSource;
  const tenantContext = {
    getCurrentContext: vi.fn().mockReturnValue({
      tenantId: TENANT_A,
      userId: USER_A,
    }),
  } as unknown as TenantContextService;
  const roomsService = {
    isOpen: vi.fn().mockReturnValue(true),
    findOne: vi.fn().mockResolvedValue(ROOM_OPEN),
  } as unknown as RoomsService;
  const service = new AppointmentsService(
    dataSource,
    tenantContext,
    roomsService,
    opts.emitter,
  );
  return { service, apptRepo, dataSource };
}

describe('AppointmentsService Phase 2 hooks (Sprint 8 Tache 8.12)', () => {
  describe('event emission', () => {
    it('1. create without skipExternalSync : emits CREATED event', async () => {
      const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
      const { service } = buildService({ emitter });
      await service.create(
        {
          roomId: ROOM_OPEN.id,
          title: 'X',
          startAt: new Date('2026-06-01T10:00:00Z'),
          endAt: new Date('2026-06-01T11:00:00Z'),
          timezone: 'Africa/Casablanca',
          attendees: [],
        },
        USER_A,
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        APPOINTMENT_EVENTS.CREATED,
        expect.objectContaining({
          appointmentId: APPT_A,
          tenantId: TENANT_A,
        }),
      );
    });

    it('2. create WITH skipExternalSync=true : does NOT emit (loop prevention)', async () => {
      const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
      const { service } = buildService({ emitter });
      await service.create(
        {
          roomId: ROOM_OPEN.id,
          title: 'X',
          startAt: new Date('2026-06-01T10:00:00Z'),
          endAt: new Date('2026-06-01T11:00:00Z'),
          timezone: 'Africa/Casablanca',
          attendees: [],
        },
        USER_A,
        { skipExternalSync: true },
      );
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('3. create when emitter undefined : no-op (does not throw)', async () => {
      const { service } = buildService({ emitter: undefined });
      await expect(
        service.create(
          {
            roomId: ROOM_OPEN.id,
            title: 'X',
            startAt: new Date('2026-06-01T10:00:00Z'),
            endAt: new Date('2026-06-01T11:00:00Z'),
            timezone: 'Africa/Casablanca',
            attendees: [],
          },
          USER_A,
        ),
      ).resolves.toBeDefined();
    });

    it('4. cancel without skipExternalSync : emits CANCELLED event', async () => {
      const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
      const existing = {
        id: APPT_A,
        tenantId: TENANT_A,
        status: 'scheduled',
      } as BookingAppointmentEntity;
      const { service } = buildService({
        emitter,
        apptFindOneResult: existing,
      });
      await service.cancel(APPT_A, { reason: 'user-driven' }, USER_A);
      expect(emitter.emit).toHaveBeenCalledWith(
        APPOINTMENT_EVENTS.CANCELLED,
        expect.objectContaining({ appointmentId: APPT_A }),
      );
    });

    it('5. cancel WITH skipExternalSync : does NOT emit', async () => {
      const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
      const existing = {
        id: APPT_A,
        tenantId: TENANT_A,
        status: 'scheduled',
      } as BookingAppointmentEntity;
      const { service } = buildService({
        emitter,
        apptFindOneResult: existing,
      });
      await service.cancel(
        APPT_A,
        { reason: 'webhook-driven' },
        USER_A,
        { skipExternalSync: true },
      );
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('6. update without skipExternalSync : emits UPDATED event', async () => {
      const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
      const existing = {
        id: APPT_A,
        tenantId: TENANT_A,
        status: 'scheduled',
      } as BookingAppointmentEntity;
      const { service } = buildService({
        emitter,
        apptFindOneResult: existing,
      });
      await service.update(APPT_A, { title: 'New title' }, USER_A);
      expect(emitter.emit).toHaveBeenCalledWith(
        APPOINTMENT_EVENTS.UPDATED,
        expect.objectContaining({ appointmentId: APPT_A }),
      );
    });
  });

  describe('sync helper methods', () => {
    it('7. findByExternalIdAs : queries by tenant + external event id', async () => {
      const expected = { id: APPT_A, tenantId: TENANT_A } as BookingAppointmentEntity;
      const { service, apptRepo } = buildService();
      (apptRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(expected);
      const result = await service.findByExternalIdAs(TENANT_A, 'ext-evt-123');
      expect(apptRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, externalCalendarEventId: 'ext-evt-123' },
      });
      expect(result).toEqual(expected);
    });

    it('8. findByIdAs : queries by tenant + id', async () => {
      const expected = { id: APPT_A, tenantId: TENANT_A } as BookingAppointmentEntity;
      const { service, apptRepo } = buildService();
      (apptRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(expected);
      const result = await service.findByIdAs(TENANT_A, APPT_A);
      expect(apptRepo.findOne).toHaveBeenCalledWith({
        where: { id: APPT_A, tenantId: TENANT_A },
      });
      expect(result).toEqual(expected);
    });

    it('9. updateExternalReference : updates row + does NOT emit', async () => {
      const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
      const { service, apptRepo } = buildService({ emitter });
      await service.updateExternalReference(TENANT_A, APPT_A, {
        externalCalendarEventId: 'ext-evt-new',
        externalCalendarProvider: 'google',
      });
      expect(apptRepo.createQueryBuilder).toHaveBeenCalled();
      // System-level update : no lifecycle event emitted
      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });
});
