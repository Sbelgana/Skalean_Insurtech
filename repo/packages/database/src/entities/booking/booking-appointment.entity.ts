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
import { BookingRoomEntity } from './booking-room.entity.js';
import { TimeRangeTransformer, type TimeRange } from './transformers/time-range.transformer.js';

export type BookingAppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'completed';

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
    enum: ['scheduled', 'confirmed', 'cancelled', 'no_show', 'completed'],
    enumName: 'booking_appointment_status',
    default: 'scheduled',
  })
  status!: BookingAppointmentStatus;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancelReason!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
