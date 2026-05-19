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

  @Column({ name: 'capacity', type: 'integer', default: 1 })
  capacity!: number;

  @Column({ name: 'location', type: 'varchar', length: 255, nullable: true })
  location!: string | null;

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
