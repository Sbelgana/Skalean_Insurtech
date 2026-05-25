import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';

export type CommChannel = 'whatsapp' | 'email' | 'sms' | 'voice';
export type CommTemplateCategory = 'marketing' | 'transactional' | 'reminder';
export type CommLanguage = 'fr' | 'ar-MA' | 'ar' | 'en';
export type CommMetaTemplateStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface VariablesSchema {
  type: 'object';
  properties: Record<string, { type: string; format?: string; description?: string }>;
  required: string[];
}

@Entity({ name: 'comm_templates' })
@Index('idx_comm_templates_tenant_channel', ['tenantId', 'channel', 'active'])
export class CommTemplateEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({
    type: 'enum',
    enum: ['whatsapp', 'email', 'sms', 'voice'],
    enumName: 'comm_channel_enum',
  })
  channel!: CommChannel;

  @Column({
    type: 'enum',
    enum: ['marketing', 'transactional', 'reminder'],
    enumName: 'comm_template_category_enum',
  })
  category!: CommTemplateCategory;

  @Column({
    type: 'enum',
    enum: ['fr', 'ar-MA', 'ar', 'en'],
    enumName: 'comm_language_enum',
  })
  language!: CommLanguage;

  @Column({ name: 'subject_template', type: 'varchar', length: 998, nullable: true })
  subjectTemplate!: string | null;

  @Column({ name: 'body_template', type: 'text' })
  bodyTemplate!: string;

  @Column({ name: 'variables_schema', type: 'jsonb' })
  variablesSchema!: VariablesSchema;

  @Column({ name: 'meta_template_name', type: 'varchar', length: 512, nullable: true })
  metaTemplateName!: string | null;

  @Column({
    name: 'meta_template_status',
    type: 'enum',
    enum: ['draft', 'pending_review', 'approved', 'rejected'],
    enumName: 'comm_meta_template_status_enum',
    default: 'draft',
  })
  metaTemplateStatus!: CommMetaTemplateStatus;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
