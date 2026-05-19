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

export type CrmDealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

@Entity({ name: 'crm_deals' })
@Index('idx_crm_deals_tenant_stage', ['tenantId', 'stage'], { where: '"deleted_at" IS NULL' })
export class CrmDealEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId!: string;

  @ManyToOne(() => CrmContactEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CrmCompanyEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company!: CrmCompanyEntity | null;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  @Column({
    name: 'stage',
    type: 'enum',
    enum: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    enumName: 'crm_deal_stage',
    default: 'lead',
  })
  stage!: CrmDealStage;

  @Column({ name: 'amount_dirham', type: 'numeric', precision: 15, scale: 2, default: 0 })
  amountDirham!: string;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'MAD' })
  currency!: string;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate!: Date | null;

  @Column({ name: 'won_at', type: 'timestamptz', nullable: true })
  wonAt!: Date | null;

  @Column({ name: 'lost_at', type: 'timestamptz', nullable: true })
  lostAt!: Date | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason!: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

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
