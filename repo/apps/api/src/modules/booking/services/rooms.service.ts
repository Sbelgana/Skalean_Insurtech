/**
 * RoomsService -- Sprint 8 Tache 8.8 (Phase 3 Sprint 1 -- Booking module).
 *
 * CRUD pour booking_rooms (salles bookables transverses) +
 * isOpen(room, dateTime) helper utile pour Task 8.11 Availability calculation.
 *
 * Multi-tenant strict :
 *   - tenant_id automatique via TenantContext + RLS
 *   - Tous les inserts/updates filtres par tenant_id courant
 *
 * Soft delete pattern (heritage 8.4/8.5/8.7) : `active boolean` flag toggle.
 * Hard delete reserve aux super-admin pour erreur creation.
 *
 * Permissions reutilisees catalog Sprint 7.5a :
 *   - BOOKING_ROOMS_READ (GET endpoints)
 *   - BOOKING_ROOMS_MANAGE (CREATE/UPDATE/DELETE/REACTIVATE -- umbrella pattern Task 8.3)
 *
 * Reference : B-08 Tache 3.2.1.
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '@insurtech/auth';
import type {
  CreateRoomDto,
  FilterRoomsDto,
  UpdateRoomDto,
} from '@insurtech/booking';
import {
  BookingRoomEntity,
  type BookingBusinessHours,
  type DataSource,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';

export interface PaginatedRooms {
  readonly items: readonly BookingRoomEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const ROOM_ERROR_CODES = {
  TENANT_REQUIRED: 'BOOKING_ROOM_TENANT_REQUIRED',
  NAME_DUPLICATE: 'BOOKING_ROOM_NAME_DUPLICATE',
  NOT_FOUND: 'BOOKING_ROOM_NOT_FOUND',
  ALREADY_INACTIVE: 'BOOKING_ROOM_ALREADY_INACTIVE',
  ALREADY_ACTIVE: 'BOOKING_ROOM_ALREADY_ACTIVE',
} as const;

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getRepo() {
    return this.dataSource.getRepository(BookingRoomEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: ROOM_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  // ==========================================================================
  // Read
  // ==========================================================================

  async findAll(filters: FilterRoomsDto): Promise<PaginatedRooms> {
    const tenantId = this.requireTenantId();
    const qb = this.getRepo()
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId });
    if (filters.activeOnly) {
      qb.andWhere('r.active = true');
    }
    if (filters.city) {
      qb.andWhere('r.city = :city', { city: filters.city });
    }
    if (filters.roomType) {
      qb.andWhere('r.room_type = :roomType', { roomType: filters.roomType });
    }
    if (filters.minCapacity !== undefined) {
      qb.andWhere('r.capacity >= :minCapacity', { minCapacity: filters.minCapacity });
    }

    const orderColumnMap: Record<string, string> = {
      name: 'r.name',
      created_at: 'r.created_at',
      capacity: 'r.capacity',
    };
    const orderColumn = orderColumnMap[filters.orderBy] ?? 'r.name';
    qb.orderBy(orderColumn, filters.orderDir);
    qb.skip(filters.offset).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  /** Shortcut for active rooms (activeOnly=true). */
  async findActive(): Promise<BookingRoomEntity[]> {
    const tenantId = this.requireTenantId();
    return this.getRepo().find({
      where: { tenantId, active: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<BookingRoomEntity> {
    const tenantId = this.requireTenantId();
    const room = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!room) {
      throw new NotFoundException({
        code: ROOM_ERROR_CODES.NOT_FOUND,
        message: `Room ${id} not found`,
      });
    }
    return room;
  }

  // ==========================================================================
  // Create / Update
  // ==========================================================================

  async create(
    dto: CreateRoomDto,
    createdByUserId: string,
  ): Promise<BookingRoomEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();

    const dup = await repo.findOne({ where: { tenantId, name: dto.name } });
    if (dup) {
      throw new ConflictException({
        code: ROOM_ERROR_CODES.NAME_DUPLICATE,
        message: `Room with name "${dto.name}" already exists in this tenant`,
      });
    }

    const entity = repo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      capacity: dto.capacity,
      location: dto.location ?? null,
      city: dto.city ?? null,
      timezone: dto.timezone,
      businessHours: dto.businessHours as BookingBusinessHours,
      bufferMinutes: dto.bufferMinutes,
      equipment: dto.equipment,
      color: dto.color,
      roomType: dto.roomType,
      active: true,
    });
    const saved = await repo.save(entity);
    this.logger.log(
      `booking_room_created id=${saved.id} name="${saved.name}" tenant=${tenantId} type=${saved.roomType} by=${createdByUserId}`,
    );
    return saved;
  }

  async update(
    id: string,
    dto: UpdateRoomDto,
    updatedByUserId: string,
  ): Promise<BookingRoomEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const existing = await repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: ROOM_ERROR_CODES.NOT_FOUND,
        message: `Room ${id} not found`,
      });
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      const dup = await repo.findOne({ where: { tenantId, name: dto.name } });
      if (dup && dup.id !== id) {
        throw new ConflictException({
          code: ROOM_ERROR_CODES.NAME_DUPLICATE,
          message: `Room with name "${dto.name}" already exists`,
        });
      }
    }

    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates['name'] = dto.name;
    if (dto.description !== undefined) updates['description'] = dto.description ?? null;
    if (dto.capacity !== undefined) updates['capacity'] = dto.capacity;
    if (dto.location !== undefined) updates['location'] = dto.location ?? null;
    if (dto.city !== undefined) updates['city'] = dto.city ?? null;
    if (dto.timezone !== undefined) updates['timezone'] = dto.timezone;
    if (dto.businessHours !== undefined) {
      updates['business_hours'] = dto.businessHours;
    }
    if (dto.bufferMinutes !== undefined) updates['buffer_minutes'] = dto.bufferMinutes;
    if (dto.equipment !== undefined) updates['equipment'] = dto.equipment;
    if (dto.color !== undefined) updates['color'] = dto.color;
    if (dto.roomType !== undefined) updates['room_type'] = dto.roomType;

    await repo
      .createQueryBuilder()
      .update(BookingRoomEntity)
      .set(updates)
      .where('id = :id', { id })
      .execute();
    const updated = await repo.findOne({ where: { id, tenantId } });
    this.logger.log(
      `booking_room_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
    );
    return updated!;
  }

  // ==========================================================================
  // Soft delete (active flag)
  // ==========================================================================

  async deactivate(id: string, deactivatedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const existing = await this.findOne(id);
    if (!existing.active) {
      throw new ConflictException({
        code: ROOM_ERROR_CODES.ALREADY_INACTIVE,
        message: `Room ${id} is already inactive`,
      });
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingRoomEntity)
      .set({ active: false })
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `booking_room_deactivated id=${id} tenant=${tenantId} by=${deactivatedByUserId}`,
    );
  }

  async reactivate(id: string, reactivatedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const existing = await this.findOne(id);
    if (existing.active) {
      throw new ConflictException({
        code: ROOM_ERROR_CODES.ALREADY_ACTIVE,
        message: `Room ${id} is already active`,
      });
    }
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingRoomEntity)
      .set({ active: true })
      .where('id = :id', { id })
      .execute();
    this.logger.log(
      `booking_room_reactivated id=${id} tenant=${tenantId} by=${reactivatedByUserId}`,
    );
  }

  // ==========================================================================
  // Hard delete (admin only -- gated at controller via BOOKING_ROOMS_MANAGE
  // and additional service-level guards if booking_appointments referencent)
  // ==========================================================================

  async hardDelete(id: string, deletedByUserId: string): Promise<void> {
    const tenantId = this.requireTenantId();
    const existing = await this.findOne(id);
    // booking_appointments FK has ON DELETE RESTRICT -- DB will refuse if any
    // appointment references this room. Surface that as a clean error.
    try {
      await this.getRepo().delete({ id });
    } catch (err) {
      throw new ConflictException({
        code: ROOM_ERROR_CODES.NOT_FOUND,
        message: `Room ${id} cannot be hard-deleted -- appointments reference it (FK RESTRICT). Deactivate instead.`,
        cause: (err as Error).message,
      });
    }
    this.logger.log(
      `booking_room_hard_deleted id=${id} name="${existing.name}" tenant=${tenantId} by=${deletedByUserId}`,
    );
  }

  // ==========================================================================
  // Business hours helper (used by Task 8.11 Availability)
  // ==========================================================================

  /**
   * Returns true if `dateTime` falls within the room's business_hours for the
   * day-of-week it represents. If no schedule is configured for that day, the
   * room is considered CLOSED (conservative default).
   *
   * Note : dateTime is interpreted in the room's timezone. For Sprint 8.8 we
   * support only 'Africa/Casablanca' (UTC+1 permanent, no DST) so a naive
   * UTC -> +01:00 shift is sufficient. Sprint 22.5+ (multi-tz) will need a
   * proper Intl.DateTimeFormat with timeZone option.
   */
  isOpen(room: BookingRoomEntity, dateTime: Date): boolean {
    // For Africa/Casablanca (UTC+1 no DST), shift UTC by +1h to derive local time.
    const localMs =
      room.timezone === 'Africa/Casablanca'
        ? dateTime.getTime() + 60 * 60 * 1000
        : dateTime.getTime();
    const local = new Date(localMs);

    // Day-of-week in UTC of the shifted date corresponds to local day.
    const dayIdx = local.getUTCDay();
    const dayName = DAYS_OF_WEEK[dayIdx];
    if (!dayName) return false;
    const schedule = room.businessHours?.[dayName];
    if (!schedule || schedule.closed) return false;

    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mm = String(local.getUTCMinutes()).padStart(2, '0');
    const localTime = `${hh}:${mm}`;
    return localTime >= schedule.open && localTime < schedule.close;
  }
}
