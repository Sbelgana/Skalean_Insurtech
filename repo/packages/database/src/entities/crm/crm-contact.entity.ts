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
import type { CrmDealEntity } from './crm-deal.entity.js';
import type { CrmInteractionEntity } from './crm-interaction.entity.js';

export type CrmPreferredLanguage = 'fr' | 'ar-MA' | 'ar';
export type CrmPreferredChannel = 'whatsapp' | 'email' | 'sms' | 'voice';

@Entity({ name: 'crm_contacts' })
@Index('idx_crm_contacts_tenant', ['tenantId'], { where: '"deleted_at" IS NULL' })
export class CrmContactEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CrmCompanyEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company!: CrmCompanyEntity | null;

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName!: string;

  @Column({
    name: 'full_name',
    type: 'text',
    insert: false,
    update: false,
    select: true,
    asExpression: `first_name || ' ' || last_name`,
    generatedType: 'STORED',
  })
  fullName!: string;

  @Column({ name: 'email', type: 'citext', nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone!: string | null;

  @Column({ name: 'cin', type: 'text', nullable: true })
  cin!: string | null;

  @Column({
    name: 'preferred_language',
    type: 'enum',
    enum: ['fr', 'ar-MA', 'ar'],
    enumName: 'crm_preferred_language',
    default: 'fr',
  })
  preferredLanguage!: CrmPreferredLanguage;

  @Column({
    name: 'preferred_channel',
    type: 'enum',
    enum: ['whatsapp', 'email', 'sms', 'voice'],
    enumName: 'crm_preferred_channel',
    default: 'email',
  })
  preferredChannel!: CrmPreferredChannel;

  @Column({ name: 'tags', type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  /** Custom fields per tenant -- validated by CustomFieldsValidatorService (Sprint 8.7). */
  @Column({ name: 'custom_fields', type: 'jsonb', default: () => "'{}'::jsonb" })
  customFields!: Record<string, unknown>;

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

  @OneToMany('CrmDealEntity', 'contact')
  deals?: CrmDealEntity[];

  @OneToMany('CrmInteractionEntity', 'contact')
  interactions?: CrmInteractionEntity[];
}
