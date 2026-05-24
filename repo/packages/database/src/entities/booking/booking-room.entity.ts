/**
 * BookingRoomEntity -- Sprint 8 Tache 8.8 (refactored from Sprint 2/3 stub).
 *
 * Rooms / salles bookables (heritage Sprint 2 init -- enrichies Sprint 8.8 avec
 * business hours, room_type, city, equipment, buffer_minutes, timezone).
 *
 * Reference : migration 1735000000021 / B-08 Tache 3.2.1.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import type { BookingAppointmentEntity } from './booking-appointment.entity.js';

export type BookingRoomType =
  | 'meeting'
  | 'office'
  | 'workshop'
  | 'parking'
  | 'visit'
  | 'other';

export interface BookingBusinessHoursDay {
  readonly open: string; // HH:MM
  readonly close: string; // HH:MM
  readonly closed?: boolean;
}

export type BookingBusinessHours = Partial<
  Record<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    BookingBusinessHoursDay
  >
>;

@Entity('booking_rooms')
@Index('idx_booking_rooms_tenant_active', ['tenantId', 'active'], { where: '"active" = true' })
export class BookingRoomEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'capacity', type: 'integer', default: 1 })
  capacity!: number;

  @Column({ name: 'location', type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 50, default: 'Africa/Casablanca' })
  timezone!: string;

  @Column({ name: 'business_hours', type: 'jsonb', default: () => "'{}'::jsonb" })
  businessHours!: BookingBusinessHours;

  @Column({ name: 'buffer_minutes', type: 'integer', default: 15 })
  bufferMinutes!: number;

  @Column({ name: 'equipment', type: 'jsonb', default: () => "'[]'::jsonb" })
  equipment!: readonly string[];

  @Column({ name: 'room_type', type: 'varchar', length: 30, default: 'meeting' })
  roomType!: BookingRoomType;

  @Column({ name: 'color', type: 'char', length: 7, default: '#3B82F6' })
  color!: string;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('BookingAppointmentEntity', 'room')
  appointments?: BookingAppointmentEntity[];
}
