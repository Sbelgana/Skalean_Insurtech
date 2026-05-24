/**
 * AppointmentsService -- Sprint 8 Tache 8.9 (Phase 3 Sprint 1 -- Booking module).
 *
 * Booking appointments avec state machine 6 statuts + buffer logic Option B
 * (service layer) + polymorphic max 1 + EXCLUDE GIST DB defense in depth.
 *
 * Multi-tenant strict :
 *   - tenant_id auto via TenantContext + RLS
 *   - Tous reads/writes scope tenant courant
 *
 * State machine transitions valides :
 *   - scheduled -> confirmed | in_progress | cancelled | no_show
 *   - confirmed -> in_progress | cancelled | no_show
 *   - in_progress -> completed | cancelled
 *   - completed : IMMUTABLE (rejected backward)
 *   - cancelled -> scheduled (only via reopen + OVERRIDE_WORKFLOW perm)
 *   - no_show : IMMUTABLE (rejected backward)
 *
 * Buffer logic Option B :
 *   - Service `findOverlappingWithBuffer` query etend la fenetre par
 *     room.bufferMinutes avant verification overlap
 *   - DB EXCLUDE GIST garantit zero RAW overlap (defense in depth)
 *   - Erreur UX claire vs cryptique EXCLUDE error
 *
 * Audit Pino structured (loi 09-08 CNDP -- attendees PII).
 *
 * Reference : B-08 Tache 3.2.2.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  HierarchyResolver,
  Permission,
  TenantContextService,
  type AuthRole,
} from '@insurtech/auth';
import type {
  CancelAppointmentDto,
  CreateAppointmentDto,
  FilterAppointmentsDto,
  RescheduleAppointmentDto,
  ReopenAppointmentDto,
  UpdateAppointmentDto,
} from '@insurtech/booking';
import {
  BookingAppointmentEntity,
  BookingRoomEntity,
  type DataSource,
  type EntityManager,
} from '@insurtech/database';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { RoomsService } from './rooms.service.js';

export interface PaginatedAppointments {
  readonly items: readonly BookingAppointmentEntity[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const APPOINTMENT_ERROR_CODES = {
  TENANT_REQUIRED: 'BOOKING_APPOINTMENT_TENANT_REQUIRED',
  ROOM_NOT_FOUND: 'BOOKING_APPOINTMENT_ROOM_NOT_FOUND',
  ROOM_INACTIVE: 'BOOKING_APPOINTMENT_ROOM_INACTIVE',
  ROOM_CLOSED: 'BOOKING_APPOINTMENT_ROOM_CLOSED',
  BUFFER_OVERLAP: 'BOOKING_APPOINTMENT_BUFFER_OVERLAP',
  NOT_FOUND: 'BOOKING_APPOINTMENT_NOT_FOUND',
  INVALID_TRANSITION: 'BOOKING_APPOINTMENT_INVALID_TRANSITION',
  ALREADY_CANCELLED: 'BOOKING_APPOINTMENT_ALREADY_CANCELLED',
  ALREADY_COMPLETED: 'BOOKING_APPOINTMENT_ALREADY_COMPLETED',
  REOPEN_DENIED: 'BOOKING_APPOINTMENT_REOPEN_DENIED',
  REOPEN_INVALID_STATUS: 'BOOKING_APPOINTMENT_REOPEN_INVALID_STATUS',
} as const;

/**
 * Internal flag attached to mutation calls coming from CalendarSyncWorker
 * (external -> local sync). When set, lifecycle events are NOT emitted, which
 * prevents the loop : webhook -> updateAs(..., skipExternalSync) -> NO event
 * -> NO re-push to external -> NO new webhook.
 */
export interface SyncContext {
  /** Skip event emission for this mutation (prevents external sync loop). */
  readonly skipExternalSync?: boolean;
}

/** Booking lifecycle events emitted on the @nestjs/event-emitter bus. */
export const APPOINTMENT_EVENTS = {
  CREATED: 'booking.appointment.created',
  UPDATED: 'booking.appointment.updated',
  CANCELLED: 'booking.appointment.cancelled',
} as const;

/** Payload of every appointment lifecycle event. */
export interface AppointmentLifecyclePayload {
  readonly appointmentId: string;
  readonly tenantId: string;
}

/** Allowed state machine transitions for forward direction. */
const FORWARD_TRANSITIONS: Record<string, readonly string[]> = {
  scheduled: ['confirmed', 'in_progress', 'cancelled', 'no_show'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  private readonly hierarchy = new HierarchyResolver();

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly roomsService: RoomsService,
    /**
     * Optional : when @nestjs/event-emitter is wired, lifecycle events are
     * emitted on the bus and consumed by AppointmentSyncListener. Optional so
     * unit tests can construct AppointmentsService without the emitter module.
     */
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Emit a lifecycle event UNLESS the caller explicitly opted out via
   * `skipExternalSync`. Centralized so the sync-loop prevention rule lives in
   * a single place.
   */
  private emitLifecycle(
    type: typeof APPOINTMENT_EVENTS[keyof typeof APPOINTMENT_EVENTS],
    payload: AppointmentLifecyclePayload,
    sync?: SyncContext,
  ): void {
    if (sync?.skipExternalSync) return;
    if (!this.eventEmitter) return;
    // Fire-and-forget : the listener decides whether to do async work.
    this.eventEmitter.emit(type, payload);
  }

  private getRepo() {
    return this.dataSource.getRepository(BookingAppointmentEntity);
  }

  private getRoomRepo() {
    return this.dataSource.getRepository(BookingRoomEntity);
  }

  private requireTenantId(): string {
    const ctx = this.tenantContext.getCurrentContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: APPOINTMENT_ERROR_CODES.TENANT_REQUIRED,
        message: 'Tenant context required',
      });
    }
    return tenantId;
  }

  private currentUserRole(): AuthRole | undefined {
    return this.tenantContext.getCurrentContext()?.userRole;
  }

  private hasPermission(
    permission: (typeof Permission)[keyof typeof Permission],
  ): boolean {
    const role = this.currentUserRole();
    if (!role) return false;
    if (this.tenantContext.getCurrentContext()?.isSuperAdmin) return true;
    return this.hierarchy.getEffectivePermissions(role).has(permission);
  }

  // ==========================================================================
  // Create
  // ==========================================================================

  async create(
    dto: CreateAppointmentDto,
    createdByUserId: string,
    sync?: SyncContext,
  ): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();

    const saved = await this.dataSource.transaction(async (em: EntityManager) => {
      // 1. Verify room exists, belongs to tenant, is active
      const room = await em
        .getRepository(BookingRoomEntity)
        .findOne({ where: { id: dto.roomId, tenantId } });
      if (!room) {
        throw new BadRequestException({
          code: APPOINTMENT_ERROR_CODES.ROOM_NOT_FOUND,
          message: `Room ${dto.roomId} not found`,
        });
      }
      if (!room.active) {
        throw new BadRequestException({
          code: APPOINTMENT_ERROR_CODES.ROOM_INACTIVE,
          message: `Room ${dto.roomId} is inactive`,
        });
      }

      // 2. Verify business hours coverage
      if (!this.roomsService.isOpen(room, dto.startAt)) {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.ROOM_CLOSED,
          message: `Room is closed at ${dto.startAt.toISOString()}`,
        });
      }

      // 3. Buffer overlap check (Option B service layer)
      const conflicts = await this.findOverlappingWithBuffer(
        em,
        tenantId,
        dto.roomId,
        dto.startAt,
        dto.endAt,
        room.bufferMinutes,
      );
      if (conflicts.length > 0) {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.BUFFER_OVERLAP,
          message: `Time slot conflicts with ${conflicts.length} existing appointment(s) within room buffer of ${room.bufferMinutes} minutes`,
          conflictIds: conflicts.map((c) => c.id),
        });
      }

      // 4. Insert (DB EXCLUDE GIST is defense in depth for raw overlap)
      const entity = em.getRepository(BookingAppointmentEntity).create({
        tenantId,
        roomId: dto.roomId,
        assignedUserId: dto.organizerUserId ?? createdByUserId,
        contactId: dto.contactId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        timeRange: { start: dto.startAt, end: dto.endAt },
        timezone: dto.timezone,
        attendees: dto.attendees,
        maxAttendees: dto.maxAttendees ?? null,
        status: 'scheduled',
        dealId: dto.dealId ?? null,
        sinistreId: dto.sinistreId ?? null,
        expertAssignmentId: dto.expertAssignmentId ?? null,
        createdBy: createdByUserId,
      });
      const saved = await em.getRepository(BookingAppointmentEntity).save(entity);
      this.logger.log(
        `booking_appointment_created id=${saved.id} room=${dto.roomId} range=[${dto.startAt.toISOString()},${dto.endAt.toISOString()}) tenant=${tenantId} by=${createdByUserId}`,
      );
      return saved;
    });
    this.emitLifecycle(
      APPOINTMENT_EVENTS.CREATED,
      { appointmentId: saved.id, tenantId },
      sync,
    );
    return saved;
  }

  // ==========================================================================
  // Read
  // ==========================================================================

  async findOne(id: string): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();
    const appt = await this.getRepo().findOne({ where: { id, tenantId } });
    if (!appt) {
      throw new NotFoundException({
        code: APPOINTMENT_ERROR_CODES.NOT_FOUND,
        message: `Appointment ${id} not found`,
      });
    }
    return appt;
  }

  async list(filters: FilterAppointmentsDto): Promise<PaginatedAppointments> {
    const tenantId = this.requireTenantId();
    const qb = this.getRepo()
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId });
    if (filters.roomId) {
      qb.andWhere('a.room_id = :roomId', { roomId: filters.roomId });
    }
    if (filters.organizerUserId) {
      qb.andWhere('a.assigned_user_id = :userId', { userId: filters.organizerUserId });
    }
    if (filters.contactId) {
      qb.andWhere('a.contact_id = :contactId', { contactId: filters.contactId });
    }
    if (filters.dealId) {
      qb.andWhere('a.deal_id = :dealId', { dealId: filters.dealId });
    }
    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.from) {
      qb.andWhere('lower(a.time_range) >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('upper(a.time_range) <= :to', { to: filters.to });
    }

    qb.orderBy(
      filters.orderBy === 'created_at' ? 'a.created_at' : 'lower(a.time_range)',
      filters.orderDir,
    );
    qb.skip(filters.offset).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  // ==========================================================================
  // Buffer overlap helper (Option B)
  // ==========================================================================

  /**
   * Returns appointments in the same room that overlap with [start, end)
   * EXPANDED by `bufferMinutes` on both sides. Cancelled / no_show are
   * excluded (they free the slot).
   */
  async findOverlappingWithBuffer(
    em: EntityManager | undefined,
    tenantId: string,
    roomId: string,
    start: Date,
    end: Date,
    bufferMinutes: number,
  ): Promise<BookingAppointmentEntity[]> {
    const repo = em
      ? em.getRepository(BookingAppointmentEntity)
      : this.getRepo();
    const bufferMs = bufferMinutes * 60_000;
    const bufferedStart = new Date(start.getTime() - bufferMs);
    const bufferedEnd = new Date(end.getTime() + bufferMs);
    return repo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.room_id = :roomId', { roomId })
      .andWhere(
        `a.status NOT IN ('cancelled', 'no_show')`,
      )
      .andWhere(
        `a.time_range && tstzrange(:bs::timestamptz, :be::timestamptz, '[)')`,
        { bs: bufferedStart.toISOString(), be: bufferedEnd.toISOString() },
      )
      .getMany();
  }

  // ==========================================================================
  // Update (non-time fields)
  // ==========================================================================

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    updatedByUserId: string,
    sync?: SyncContext,
  ): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();
    const repo = this.getRepo();
    const existing = await repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException({
        code: APPOINTMENT_ERROR_CODES.NOT_FOUND,
        message: `Appointment ${id} not found`,
      });
    }
    if (existing.status === 'completed' || existing.status === 'cancelled' || existing.status === 'no_show') {
      throw new ConflictException({
        code: APPOINTMENT_ERROR_CODES.INVALID_TRANSITION,
        message: `Cannot update appointment in status ${existing.status}`,
      });
    }

    const updates: Record<string, unknown> = {};
    if (dto.title !== undefined) updates['title'] = dto.title;
    if (dto.description !== undefined) updates['description'] = dto.description ?? null;
    if (dto.attendees !== undefined) updates['attendees'] = dto.attendees;
    if (dto.maxAttendees !== undefined) updates['max_attendees'] = dto.maxAttendees ?? null;
    if (dto.contactId !== undefined) updates['contact_id'] = dto.contactId ?? null;
    if (dto.metadata !== undefined) updates['metadata'] = dto.metadata;

    await repo
      .createQueryBuilder()
      .update(BookingAppointmentEntity)
      .set(updates)
      .where('id = :id', { id })
      .execute();
    const updated = await repo.findOne({ where: { id, tenantId } });
    this.logger.log(
      `booking_appointment_updated id=${id} fields=[${Object.keys(updates).join(',')}] by=${updatedByUserId}`,
    );
    this.emitLifecycle(
      APPOINTMENT_EVENTS.UPDATED,
      { appointmentId: id, tenantId },
      sync,
    );
    return updated!;
  }

  // ==========================================================================
  // State machine transitions
  // ==========================================================================

  private validateForwardTransition(
    current: BookingAppointmentEntity['status'],
    target: BookingAppointmentEntity['status'],
  ): void {
    const allowed = FORWARD_TRANSITIONS[current] ?? [];
    if (!allowed.includes(target)) {
      throw new ConflictException({
        code: APPOINTMENT_ERROR_CODES.INVALID_TRANSITION,
        message: `Cannot transition appointment from "${current}" to "${target}"`,
      });
    }
  }

  async confirm(
    id: string,
    userId: string,
  ): Promise<BookingAppointmentEntity> {
    return this.transitionStatus(id, 'confirmed', userId, {});
  }

  async markInProgress(
    id: string,
    userId: string,
  ): Promise<BookingAppointmentEntity> {
    return this.transitionStatus(id, 'in_progress', userId, {});
  }

  async complete(id: string, userId: string): Promise<BookingAppointmentEntity> {
    return this.transitionStatus(id, 'completed', userId, {
      completed_at: new Date(),
    });
  }

  async markNoShow(id: string, userId: string): Promise<BookingAppointmentEntity> {
    return this.transitionStatus(id, 'no_show', userId, { no_show_at: new Date() });
  }

  async cancel(
    id: string,
    dto: CancelAppointmentDto,
    userId: string,
    sync?: SyncContext,
  ): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();
    const result = await this.transitionStatus(id, 'cancelled', userId, {
      cancelled_at: new Date(),
      cancelled_by_user_id: userId,
      cancel_reason: dto.reason,
    });
    this.emitLifecycle(
      APPOINTMENT_EVENTS.CANCELLED,
      { appointmentId: id, tenantId },
      sync,
    );
    return result;
  }

  private async transitionStatus(
    id: string,
    target: BookingAppointmentEntity['status'],
    userId: string,
    extraUpdates: Record<string, unknown>,
  ): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();
    return this.dataSource.transaction(async (em: EntityManager) => {
      const repo = em.getRepository(BookingAppointmentEntity);
      const appt = await repo.findOne({ where: { id, tenantId } });
      if (!appt) {
        throw new NotFoundException({
          code: APPOINTMENT_ERROR_CODES.NOT_FOUND,
          message: `Appointment ${id} not found`,
        });
      }
      this.validateForwardTransition(appt.status, target);

      await em
        .createQueryBuilder()
        .update(BookingAppointmentEntity)
        .set({ status: target, ...extraUpdates })
        .where('id = :id', { id })
        .execute();
      const updated = await repo.findOne({ where: { id, tenantId } });
      this.logger.log(
        `booking_appointment_transitioned id=${id} from=${appt.status} to=${target} by=${userId}`,
      );
      return updated!;
    });
  }

  // ==========================================================================
  // Reopen cancelled (admin only)
  // ==========================================================================

  async reopen(
    id: string,
    dto: ReopenAppointmentDto,
    userId: string,
  ): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();
    if (!this.hasPermission(Permission.BOOKING_APPOINTMENTS_OVERRIDE_WORKFLOW)) {
      throw new ForbiddenException({
        code: APPOINTMENT_ERROR_CODES.REOPEN_DENIED,
        message: `Reopen requires ${Permission.BOOKING_APPOINTMENTS_OVERRIDE_WORKFLOW}`,
      });
    }

    return this.dataSource.transaction(async (em: EntityManager) => {
      const repo = em.getRepository(BookingAppointmentEntity);
      const appt = await repo.findOne({ where: { id, tenantId } });
      if (!appt) {
        throw new NotFoundException({
          code: APPOINTMENT_ERROR_CODES.NOT_FOUND,
          message: `Appointment ${id} not found`,
        });
      }
      if (appt.status !== 'cancelled') {
        throw new BadRequestException({
          code: APPOINTMENT_ERROR_CODES.REOPEN_INVALID_STATUS,
          message: `Only cancelled appointments can be reopened (current status: ${appt.status})`,
        });
      }

      // Re-check buffer overlap : a slot might have been claimed in the meantime
      const room = await em
        .getRepository(BookingRoomEntity)
        .findOne({ where: { id: appt.roomId, tenantId } });
      if (!room) {
        throw new BadRequestException({
          code: APPOINTMENT_ERROR_CODES.ROOM_NOT_FOUND,
          message: `Original room ${appt.roomId} no longer exists`,
        });
      }
      const conflicts = await this.findOverlappingWithBuffer(
        em,
        tenantId,
        appt.roomId,
        appt.timeRange.start,
        appt.timeRange.end,
        room.bufferMinutes,
      );
      if (conflicts.some((c) => c.id !== appt.id)) {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.BUFFER_OVERLAP,
          message: `Cannot reopen -- slot already taken by another appointment`,
        });
      }

      await em
        .createQueryBuilder()
        .update(BookingAppointmentEntity)
        .set({
          status: 'scheduled',
          cancelled_at: null,
          cancel_reason: null,
          cancelled_by_user_id: null,
        })
        .where('id = :id', { id })
        .execute();
      const updated = await repo.findOne({ where: { id, tenantId } });
      this.logger.log(
        `booking_appointment_reopened id=${id} reason="${dto.reason}" by=${userId}`,
      );
      return updated!;
    });
  }

  // ==========================================================================
  // Reschedule (atomic time_range change)
  // ==========================================================================

  async reschedule(
    id: string,
    dto: RescheduleAppointmentDto,
    userId: string,
    sync?: SyncContext,
  ): Promise<BookingAppointmentEntity> {
    const tenantId = this.requireTenantId();

    const result = await this.dataSource.transaction(async (em: EntityManager) => {
      const repo = em.getRepository(BookingAppointmentEntity);
      const appt = await repo.findOne({ where: { id, tenantId } });
      if (!appt) {
        throw new NotFoundException({
          code: APPOINTMENT_ERROR_CODES.NOT_FOUND,
          message: `Appointment ${id} not found`,
        });
      }
      if (appt.status === 'completed' || appt.status === 'no_show') {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.INVALID_TRANSITION,
          message: `Cannot reschedule appointment in status ${appt.status}`,
        });
      }
      if (appt.status === 'cancelled') {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.ALREADY_CANCELLED,
          message: `Cannot reschedule cancelled appointment -- reopen first`,
        });
      }

      const room = await em
        .getRepository(BookingRoomEntity)
        .findOne({ where: { id: appt.roomId, tenantId } });
      if (!room) {
        throw new BadRequestException({
          code: APPOINTMENT_ERROR_CODES.ROOM_NOT_FOUND,
          message: `Room ${appt.roomId} not found`,
        });
      }
      if (!this.roomsService.isOpen(room, dto.newStartAt)) {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.ROOM_CLOSED,
          message: `Room is closed at ${dto.newStartAt.toISOString()}`,
        });
      }
      // Exclude self from overlap check
      const conflicts = (
        await this.findOverlappingWithBuffer(
          em,
          tenantId,
          appt.roomId,
          dto.newStartAt,
          dto.newEndAt,
          room.bufferMinutes,
        )
      ).filter((c) => c.id !== id);
      if (conflicts.length > 0) {
        throw new ConflictException({
          code: APPOINTMENT_ERROR_CODES.BUFFER_OVERLAP,
          message: `New time slot conflicts with ${conflicts.length} existing appointment(s)`,
        });
      }

      await em
        .createQueryBuilder()
        .update(BookingAppointmentEntity)
        .set({ time_range: `[${dto.newStartAt.toISOString()},${dto.newEndAt.toISOString()})` })
        .where('id = :id', { id })
        .execute();
      const updated = await repo.findOne({ where: { id, tenantId } });
      this.logger.log(
        `booking_appointment_rescheduled id=${id} new_range=[${dto.newStartAt.toISOString()},${dto.newEndAt.toISOString()}) reason="${dto.reason ?? ''}" by=${userId}`,
      );
      return updated!;
    });
    // Reschedule = time-window mutation -> external calendar must learn.
    this.emitLifecycle(
      APPOINTMENT_EVENTS.UPDATED,
      { appointmentId: id, tenantId },
      sync,
    );
    return result;
  }

  // ==========================================================================
  // Phase 2 (Task 8.12) -- Sync worker helpers
  // ==========================================================================

  /**
   * Looks up an appointment by its external-calendar event id. Used by the
   * sync worker when receiving a webhook notification : the webhook payload
   * carries only the provider's eventId, we map back to our local row.
   *
   * Returns null when not found (the row may legitimately not exist if the
   * event was created externally and we haven't imported it yet).
   */
  async findByExternalIdAs(
    tenantId: string,
    externalEventId: string,
  ): Promise<BookingAppointmentEntity | null> {
    return this.getRepo().findOne({
      where: { tenantId, externalCalendarEventId: externalEventId },
    });
  }

  /**
   * Persists the external-calendar reference on a local appointment row
   * AFTER a successful create-on-external call. Pure system update : does NOT
   * emit a lifecycle event (so the immediate-after-create push does not
   * trigger another push).
   */
  async updateExternalReference(
    tenantId: string,
    appointmentId: string,
    refs: {
      externalCalendarEventId: string;
      externalCalendarProvider: 'google' | 'outlook' | 'caldav';
    },
  ): Promise<void> {
    await this.getRepo()
      .createQueryBuilder()
      .update(BookingAppointmentEntity)
      .set({
        external_calendar_event_id: refs.externalCalendarEventId,
        external_calendar_provider: refs.externalCalendarProvider,
      } as unknown as Record<string, unknown>)
      .where('id = :id AND tenant_id = :tenantId', {
        id: appointmentId,
        tenantId,
      })
      .execute();
    this.logger.log(
      `booking_appointment_external_ref_saved id=${appointmentId} provider=${refs.externalCalendarProvider} ext_id=${refs.externalCalendarEventId} tenant=${tenantId}`,
    );
  }

  /**
   * Tenant-explicit lookup for the sync worker (unauthenticated cron / webhook
   * paths). Mirrors `findOne` but accepts an explicit tenant.
   */
  async findByIdAs(
    tenantId: string,
    id: string,
  ): Promise<BookingAppointmentEntity | null> {
    return this.getRepo().findOne({ where: { id, tenantId } });
  }
}
