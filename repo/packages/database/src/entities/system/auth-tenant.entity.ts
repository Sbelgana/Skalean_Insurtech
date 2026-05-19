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

@Entity('auth_tenants')
@Index('idx_auth_tenants_type', ['type'], { where: '"deleted_at" IS NULL' })
export class AuthTenant {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'type', type: 'enum', enum: ['broker', 'garage', 'mixed'], enumName: 'tenant_type' })
  type!: TenantType;

  @Column({ name: 'settings', type: 'jsonb', default: () => `'{}'::jsonb` })
  settings!: Record<string, unknown>;

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
