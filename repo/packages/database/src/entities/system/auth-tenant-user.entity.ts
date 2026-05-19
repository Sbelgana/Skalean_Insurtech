import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from './auth-tenant.entity.js';
import { AuthUser } from './auth-user.entity.js';

export type TenantUserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'agent' | 'viewer';

@Entity('auth_tenant_users')
@Index('idx_auth_tenant_users_tenant_id', ['tenantId'])
@Index('idx_auth_tenant_users_user_id', ['userId'])
@Index('idx_auth_tenant_users_role', ['role'])
export class AuthTenantUser {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @ManyToOne(() => AuthUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser;

  @Column({ name: 'role', type: 'text' })
  role!: TenantUserRole;

  @Column({ name: 'permissions', type: 'jsonb', default: () => `'{}'::jsonb` })
  permissions!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
