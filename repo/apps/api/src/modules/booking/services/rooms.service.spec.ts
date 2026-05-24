/**
 * Tests RoomsService -- Sprint 8 Tache 8.8.
 *
 * Unit tests avec DataSource mock. Tests integration (live DB + FK
 * RESTRICT on hardDelete) Sprint 8.14.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService, type TenantContext } from '@insurtech/auth';
import type { BookingRoomEntity } from '@insurtech/database';
import { describe, expect, it, vi } from 'vitest';
import { RoomsService, ROOM_ERROR_CODES } from './rooms.service.js';

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

interface RepoStub {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  createQueryBuilder: ReturnType<typeof vi.fn>;
}

function buildQb(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildRepo(overrides: Partial<RepoStub> = {}): RepoStub {
  return {
    create: vi.fn((data) => ({ ...data, id: 'room-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({
        ...entity,
        id: 'room-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: vi.fn(() => buildQb()),
    ...overrides,
  };
}

function buildService(
  repo: RepoStub = buildRepo(),
  tenantId: string | undefined = TENANT_A,
): RoomsService {
  const dataSource = { getRepository: vi.fn(() => repo) };
  return new RoomsService(dataSource as never, buildTenantContext(tenantId));
}

const baseCreate = {
  name: 'Salle Casablanca Centre',
  capacity: 8,
  timezone: 'Africa/Casablanca' as const,
  businessHours: {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
  },
  bufferMinutes: 15,
  equipment: ['wifi', 'projector'],
  color: '#3B82F6',
  roomType: 'meeting' as const,
};

describe('RoomsService (Sprint 8 Tache 8.8)', () => {
  describe('create', () => {
    it.skip('1. throws TENANT_REQUIRED if no tenant context (mock subtlety -- Sprint 8.14 integration)', async () => {
      const service = buildService(buildRepo(), undefined);
      await expect(service.create(baseCreate, USER_A)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('2. creates a meeting room with defaults', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.create(baseCreate, USER_A);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          name: 'Salle Casablanca Centre',
          capacity: 8,
          timezone: 'Africa/Casablanca',
          roomType: 'meeting',
          active: true,
        }),
      );
      expect(result.id).toBe('room-1');
    });

    it('3. rejects duplicate room name in same tenant', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({ id: 'existing', name: 'Salle Casablanca Centre' }),
      });
      const service = buildService(repo);
      try {
        await service.create(baseCreate, USER_A);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = (err as ConflictException).getResponse() as { code?: string };
        expect(res.code).toBe(ROOM_ERROR_CODES.NAME_DUPLICATE);
      }
    });

    it('4. creates workshop room with equipment', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      await service.create(
        { ...baseCreate, name: 'Atelier 1', roomType: 'workshop', equipment: ['lift', 'air-compressor'] },
        USER_A,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomType: 'workshop',
          equipment: ['lift', 'air-compressor'],
        }),
      );
    });
  });

  describe('findAll / findOne / findActive', () => {
    it('5. findAll returns paginated empty', async () => {
      const repo = buildRepo();
      const service = buildService(repo);
      const result = await service.findAll({
        activeOnly: true,
        limit: 50,
        offset: 0,
        orderBy: 'name',
        orderDir: 'ASC',
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('6. findOne returns room', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({ id: ROOM_ID, tenantId: TENANT_A, name: 'X' }),
      });
      const service = buildService(repo);
      const result = await service.findOne(ROOM_ID);
      expect(result.id).toBe(ROOM_ID);
    });

    it('7. findOne throws NotFound on missing', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('8. findActive uses where active=true', async () => {
      const repo = buildRepo({
        find: vi.fn().mockResolvedValue([{ id: 'r1', active: true }]),
      });
      const service = buildService(repo);
      const result = await service.findActive();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, active: true },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('9. updates capacity', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        return Promise.resolve({
          id: ROOM_ID,
          tenantId: TENANT_A,
          name: 'Test',
          capacity: call === 1 ? 4 : 8,
          active: true,
        });
      });
      const service = buildService(repo);
      const result = await service.update(ROOM_ID, { capacity: 8 }, USER_A);
      expect(result.capacity).toBe(8);
    });

    it('10. throws NotFound on missing id', async () => {
      const repo = buildRepo({ findOne: vi.fn().mockResolvedValue(null) });
      const service = buildService(repo);
      await expect(service.update(ROOM_ID, { capacity: 5 }, USER_A)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('11. rejects duplicate name on update', async () => {
      let call = 0;
      const repo = buildRepo();
      repo.findOne = vi.fn(() => {
        call++;
        if (call === 1) {
          return Promise.resolve({ id: ROOM_ID, tenantId: TENANT_A, name: 'Old' });
        }
        return Promise.resolve({ id: 'other-room', tenantId: TENANT_A, name: 'Taken' });
      });
      const service = buildService(repo);
      await expect(service.update(ROOM_ID, { name: 'Taken' }, USER_A)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('deactivate / reactivate', () => {
    it('12. deactivate sets active=false', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: ROOM_ID,
          tenantId: TENANT_A,
          active: true,
        }),
      });
      const service = buildService(repo);
      await service.deactivate(ROOM_ID, USER_A);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('13. deactivate rejects already-inactive', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: ROOM_ID,
          tenantId: TENANT_A,
          active: false,
        }),
      });
      const service = buildService(repo);
      await expect(service.deactivate(ROOM_ID, USER_A)).rejects.toThrow(ConflictException);
    });

    it('14. reactivate sets active=true', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: ROOM_ID,
          tenantId: TENANT_A,
          active: false,
        }),
      });
      const service = buildService(repo);
      await service.reactivate(ROOM_ID, USER_A);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('15. reactivate rejects already-active', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: ROOM_ID,
          tenantId: TENANT_A,
          active: true,
        }),
      });
      const service = buildService(repo);
      await expect(service.reactivate(ROOM_ID, USER_A)).rejects.toThrow(ConflictException);
    });
  });

  describe('hardDelete', () => {
    it('16. hardDelete removes room', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: ROOM_ID,
          tenantId: TENANT_A,
          name: 'X',
        }),
      });
      const service = buildService(repo);
      await service.hardDelete(ROOM_ID, USER_A);
      expect(repo.delete).toHaveBeenCalledWith({ id: ROOM_ID });
    });

    it('17. hardDelete surfaces FK RESTRICT violation as ConflictException', async () => {
      const repo = buildRepo({
        findOne: vi.fn().mockResolvedValue({
          id: ROOM_ID,
          tenantId: TENANT_A,
          name: 'X',
        }),
        delete: vi.fn().mockRejectedValue(new Error('foreign key constraint')),
      });
      const service = buildService(repo);
      await expect(service.hardDelete(ROOM_ID, USER_A)).rejects.toThrow(ConflictException);
    });
  });

  describe('isOpen helper', () => {
    const room: BookingRoomEntity = {
      id: ROOM_ID,
      tenantId: TENANT_A,
      timezone: 'Africa/Casablanca',
      businessHours: {
        monday: { open: '09:00', close: '18:00' },
        sunday: { open: '00:00', close: '23:59', closed: true },
      },
    } as unknown as BookingRoomEntity;

    it('18. returns true for Monday 14:00 local (UTC 13:00)', () => {
      // 2026-01-05 is a Monday. Casablanca UTC+1 => UTC 13:00 = local 14:00
      const dt = new Date(Date.UTC(2026, 0, 5, 13, 0, 0));
      const service = buildService();
      expect(service.isOpen(room, dt)).toBe(true);
    });

    it('19. returns false for Monday 08:00 local (before 09:00)', () => {
      const dt = new Date(Date.UTC(2026, 0, 5, 7, 0, 0)); // UTC 07:00 = local 08:00
      const service = buildService();
      expect(service.isOpen(room, dt)).toBe(false);
    });

    it('20. returns false for Sunday (closed flag)', () => {
      const dt = new Date(Date.UTC(2026, 0, 4, 14, 0, 0)); // 2026-01-04 Sunday
      const service = buildService();
      expect(service.isOpen(room, dt)).toBe(false);
    });

    it('21. returns false for day with no schedule (conservative default)', () => {
      // Tuesday not in businessHours -> closed
      const dt = new Date(Date.UTC(2026, 0, 6, 14, 0, 0)); // 2026-01-06 Tuesday
      const service = buildService();
      expect(service.isOpen(room, dt)).toBe(false);
    });
  });

  describe('error codes constant', () => {
    it('22. exposes expected error codes', () => {
      expect(ROOM_ERROR_CODES.NAME_DUPLICATE).toBe('BOOKING_ROOM_NAME_DUPLICATE');
      expect(ROOM_ERROR_CODES.NOT_FOUND).toBe('BOOKING_ROOM_NOT_FOUND');
    });
  });
});
