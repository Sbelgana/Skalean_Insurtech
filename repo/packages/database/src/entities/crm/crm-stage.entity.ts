/**
 * CrmStageEntity -- Sprint 8 Tache 8.3.
 *
 * Stage de pipeline configurable. Rattachee a un pipeline (CASCADE delete).
 *
 * Contraintes :
 *   - UNIQUE (pipeline_id, position)
 *   - UNIQUE (pipeline_id, name)
 *   - CHECK position >= 0
 *   - CHECK win_probability 0-100
 *   - CHECK color matches #RRGGBB
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
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { CrmPipelineEntity } from './crm-pipeline.entity.js';

@Entity({ name: 'crm_stages' })
@Index('idx_crm_stages_tenant', ['tenantId'])
@Index('idx_crm_stages_pipeline', ['pipelineId'])
export class CrmStageEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'pipeline_id', type: 'uuid' })
  pipelineId!: string;

  @ManyToOne(() => CrmPipelineEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'pipeline_id' })
  pipeline!: CrmPipelineEntity;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'color', type: 'varchar', length: 7, default: '#808080' })
  color!: string;

  @Column({
    name: 'win_probability',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  winProbability!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
