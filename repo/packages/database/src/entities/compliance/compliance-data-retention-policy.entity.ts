import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';

@Entity({ name: 'compliance_data_retention_policies' })
@Unique('compliance_retention_tenant_resource_unique', ['tenantId', 'resourceType'])
@Index('idx_compliance_retention_tenant', ['tenantId'])
export class ComplianceDataRetentionPolicyEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'resource_type', type: 'text' })
  resourceType!: string;

  @Column({ name: 'retention_days', type: 'int' })
  retentionDays!: number;

  @Column({ name: 'legal_basis', type: 'text' })
  legalBasis!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
