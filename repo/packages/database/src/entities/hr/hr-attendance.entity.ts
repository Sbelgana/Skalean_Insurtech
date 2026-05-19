import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { HrEmployeeEntity } from './hr-employee.entity.js';

@Entity({ name: 'hr_attendance' })
@Index('idx_hr_attendance_tenant_employee_checkin', ['tenantId', 'employeeId', 'checkInAt'])
export class HrAttendanceEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => HrEmployeeEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: HrEmployeeEntity;

  @Column({ name: 'check_in_at', type: 'timestamptz' })
  checkInAt!: Date;

  @Column({ name: 'check_out_at', type: 'timestamptz', nullable: true })
  checkOutAt!: Date | null;

  @Column({ name: 'break_minutes', type: 'integer', default: 0 })
  breakMinutes!: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
