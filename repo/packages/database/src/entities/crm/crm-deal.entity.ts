/**
 * CrmDealEntity -- Sprint 8 Tache 8.4 (refactored Sprint 2 -> workflow Sprint 8.3).
 *
 * Modele apres migration 017 :
 *   - company_id NOT NULL (preserver lien client commercial)
 *   - contact_id NULLABLE + ON DELETE SET NULL (contact peut etre supprime)
 *   - pipeline_id + stage_id : FK -> crm_pipelines / crm_stages (Sprint 8.3 workflow)
 *   - name (200), amount (numeric 15,2), currency (3), description
 *   - closed_won boolean NULL + closed_at timestamptz NULL (CHECK consistency)
 *   - owner_user_id : FK auth_users (NOT NULL, ON DELETE RESTRICT)
 *   - Soft delete via deleted_at (heritage Sprint 2)
 *
 * Reference : migration 1735000000017 / B-08 Tache 3.1.4.
 */
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { CrmCompanyEntity } from './crm-company.entity.js';
import { CrmContactEntity } from './crm-contact.entity.js';
import type { CrmInteractionEntity } from './crm-interaction.entity.js';
import { CrmPipelineEntity } from './crm-pipeline.entity.js';
import { CrmStageEntity } from './crm-stage.entity.js';

/**
 * @deprecated Sprint 8.4 -- l'enum est supprime par migration 017 au profit de
 * stage_id FK -> crm_stages. Le type literal reste exporte temporairement pour
 * compat avec d'eventuels imports externes ; sera retire dans une etape de
 * cleanup ulterieure.
 */
export type CrmDealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

@Entity({ name: 'crm_deals' })
@Index('idx_crm_deals_tenant_pipeline_stage', ['tenantId', 'pipelineId', 'stageId'], {
  where: '"deleted_at" IS NULL',
})
@Index('idx_crm_deals_tenant_company', ['tenantId', 'companyId'], {
  where: '"deleted_at" IS NULL',
})
@Index('idx_crm_deals_tenant_owner', ['tenantId', 'ownerUserId'], {
  where: '"deleted_at" IS NULL',
})
export class CrmDealEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CrmCompanyEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: CrmCompanyEntity;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @ManyToOne(() => CrmContactEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity | null;

  @Column({ name: 'pipeline_id', type: 'uuid' })
  pipelineId!: string;

  @ManyToOne(() => CrmPipelineEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'pipeline_id' })
  pipeline!: CrmPipelineEntity;

  @Column({ name: 'stage_id', type: 'uuid' })
  stageId!: string;

  @ManyToOne(() => CrmStageEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'stage_id' })
  stage!: CrmStageEntity;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'amount', type: 'numeric', precision: 15, scale: 2, default: 0 })
  amount!: string;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'MAD' })
  currency!: string;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate!: Date | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** Custom fields per tenant -- validated by CustomFieldsValidatorService (Sprint 8.7). */
  @Column({ name: 'custom_fields', type: 'jsonb', default: () => "'{}'::jsonb" })
  customFields!: Record<string, unknown>;

  @Column({ name: 'closed_won', type: 'boolean', nullable: true })
  closedWon!: boolean | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany('CrmInteractionEntity', 'deal')
  interactions?: CrmInteractionEntity[];
}
