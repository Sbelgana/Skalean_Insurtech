/**
 * BookingAppointmentEntity -- Sprint 8 Tache 8.9 (extended from Sprint 2/3 stub).
 *
 * Modele apres migration 022+023 :
 *   - Sprint 2 base : id, tenant_id, room_id, contact_id, assigned_user_id,
 *     title, description, time_range tstzrange, status enum, reminder_sent_at,
 *     cancelled_at, cancel_reason, metadata, created_by, created_at, updated_at
 *   - Sprint 2 EXCLUDE GIST btree_gist : zero overlap (tenant_id, room_id, time_range)
 *     except cancelled/no_show
 *   - Sprint 8.9 ajoute : 'in_progress' status + timezone + attendees jsonb +
 *     max_attendees + completed_at + no_show_at + cancelled_by_user_id +
 *     polymorphic deal_id/sinistre_id/expert_assignment_id +
 *     external_calendar_event_id + external_calendar_provider
 *   - Buffer logic Option B : service layer enforcement (RoomsService.bufferMinutes)
 *
 * Reference : B-08 Tache 3.2.2 / migrations 1735000000022 + 1735000000023.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';
import { CrmContactEntity } from '../crm/crm-contact.entity.js';
import { CrmDealEntity } from '../crm/crm-deal.entity.js';
import { InsureExpertAssignment } from '../insure/insure-expert-assignment.entity.js';
import { BookingRoomEntity } from './booking-room.entity.js';
import { TimeRangeTransformer, type TimeRange } from './transformers/time-range.transformer.js';

export type BookingAppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type BookingExternalCalendarProvider = 'google' | 'outlook';

export interface BookingAttendee {
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
}

@Entity('booking_appointments')
export class BookingAppointmentEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => BookingRoomEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'room_id' })
  room!: BookingRoomEntity;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @ManyToOne(() => CrmContactEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity | null;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId!: string | null;

  @ManyToOne(() => AuthUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser!: AuthUser | null;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'time_range',
    type: 'tstzrange',
    transformer: new TimeRangeTransformer(),
  })
  timeRange!: TimeRange;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    enumName: 'booking_appointment_status',
    default: 'scheduled',
  })
  status!: BookingAppointmentStatus;

  @Column({ name: 'timezone', type: 'varchar', length: 50, default: 'Africa/Casablanca' })
  timezone!: string;

  @Column({ name: 'attendees', type: 'jsonb', default: () => "'[]'::jsonb" })
  attendees!: readonly BookingAttendee[];

  @Column({ name: 'max_attendees', type: 'int', nullable: true })
  maxAttendees!: number | null;

  // ===== State machine timestamps =====
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'no_show_at', type: 'timestamptz', nullable: true })
  noShowAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancelReason!: string | null;

  @Column({ name: 'cancelled_by_user_id', type: 'uuid', nullable: true })
  cancelledByUserId!: string | null;

  @ManyToOne(() => AuthUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cancelled_by_user_id' })
  cancelledByUser!: AuthUser | null;

  // ===== Polymorphic related (max 1 enforced by DB CHECK) =====
  @Column({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId!: string | null;

  @ManyToOne(() => CrmDealEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'deal_id' })
  deal!: CrmDealEntity | null;

  /** Sprint 21 reservation (no FK yet -- table will be created Sprint 21). */
  @Column({ name: 'sinistre_id', type: 'uuid', nullable: true })
  sinistreId!: string | null;

  @Column({ name: 'expert_assignment_id', type: 'uuid', nullable: true })
  expertAssignmentId!: string | null;

  @ManyToOne(() => InsureExpertAssignment, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'expert_assignment_id' })
  expertAssignment!: InsureExpertAssignment | null;

  // ===== Calendar sync prep (Task 8.10) =====
  @Column({
    name: 'external_calendar_event_id',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  externalCalendarEventId!: string | null;

  @Column({
    name: 'external_calendar_provider',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  externalCalendarProvider!: BookingExternalCalendarProvider | null;

  // ===== Reminder / metadata =====
  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt!: Date | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
