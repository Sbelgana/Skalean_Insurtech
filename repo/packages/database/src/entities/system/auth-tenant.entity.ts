import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AuthTenantUser } from './auth-tenant-user.entity.js';
import type { AuthSession } from './auth-session.entity.js';

export type TenantType = 'broker' | 'garage' | 'mixed';

/** Sprint 6 Tache 2.2.9 -- state machine status. */
export type TenantStatus = 'active' | 'suspended' | 'pending_setup' | 'archived';

/** Sprint 6 Tache 2.2.9 -- categorie de suspension (audit + workflow). */
export type TenantSuspensionType = 'payment_failure' | 'compliance_violation' | 'manual_admin';

@Entity('auth_tenants')
@Index('idx_auth_tenants_type', ['type'], { where: '"deleted_at" IS NULL' })
@Index('idx_auth_tenants_status', ['status'], { where: '"deleted_at" IS NULL' })
export class AuthTenant {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'type', type: 'enum', enum: ['broker', 'garage', 'mixed'], enumName: 'tenant_type' })
  type!: TenantType;

  @Column({ name: 'settings', type: 'jsonb', default: () => `'{}'::jsonb` })
  settings!: Record<string, unknown>;

  /** Sprint 6 Tache 2.2.9 -- state machine status. Defaults 'active'. */
  @Column({ name: 'status', type: 'text', default: 'active' })
  status!: TenantStatus;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt!: Date | null;

  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason!: string | null;

  @Column({ name: 'suspension_type', type: 'text', nullable: true })
  suspensionType!: TenantSuspensionType | null;

  @Column({ name: 'reactivated_at', type: 'timestamptz', nullable: true })
  reactivatedAt!: Date | null;

  @Column({ name: 'reactivation_reason', type: 'text', nullable: true })
  reactivationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany('AuthTenantUser', 'tenant')
  tenantUsers!: AuthTenantUser[];

  @OneToMany('AuthSession', 'tenant')
  sessions!: AuthSession[];
}
