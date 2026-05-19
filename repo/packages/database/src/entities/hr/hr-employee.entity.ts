import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import type { AuthUser } from '../system/auth-user.entity.js';

export type HrRole =
  | 'mecanicien'
  | 'tolier'
  | 'peintre'
  | 'chef_atelier'
  | 'expert'
  | 'comptable'
  | 'commercial'
  | 'admin';

@Entity({ name: 'hr_employees' })
@Unique('uq_hr_employees_tenant_number', ['tenantId', 'employeeNumber'])
@Index('idx_hr_employees_tenant_active', ['tenantId', 'active'])
export class HrEmployeeEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne('AuthUser', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser | null;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: ['mecanicien', 'tolier', 'peintre', 'chef_atelier', 'expert', 'comptable', 'commercial', 'admin'],
    enumName: 'hr_role_enum',
  })
  role!: HrRole;

  @Column({ name: 'employee_number', type: 'text' })
  employeeNumber!: string;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate!: string;

  @Column({ name: 'hourly_rate_dirham', type: 'numeric', precision: 15, scale: 2, nullable: true })
  hourlyRateDirham!: string | null;

  @Column({ name: 'monthly_salary_dirham', type: 'numeric', precision: 15, scale: 2, nullable: true })
  monthlySalaryDirham!: string | null;

  @Column({ name: 'social_security_number', type: 'text', nullable: true })
  socialSecurityNumber!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
