/**
 * CrmPipelineEntity -- Sprint 8 Tache 8.3.
 *
 * Pipeline configurable per tenant pour deals workflow (e.g. "Pipeline Auto",
 * "Pipeline Sante"). Stages relies via OneToMany.
 *
 * Contraintes :
 *   - UNIQUE (tenant_id, name)
 *   - UNIQUE partial (tenant_id) WHERE is_default = true  (max 1 default per tenant)
 *   - RLS FORCE active
 *
 * Reference : migration 1735000000016 / B-08 Tache 3.1.3.
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
import type { CrmStageEntity } from './crm-stage.entity.js';

@Entity({ name: 'crm_pipelines' })
@Index('idx_crm_pipelines_tenant', ['tenantId'])
export class CrmPipelineEntity {
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

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @OneToMany('CrmStageEntity', 'pipeline')
  stages?: CrmStageEntity[];
}
