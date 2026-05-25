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
import type { CrmContactEntity } from '../crm/crm-contact.entity.js';
import { CommTemplateEntity } from './comm-template.entity.js';

export type CommDirection = 'inbound' | 'outbound';
export type CommStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
export type CommProvider = 'meta' | 'twilio' | 'sendgrid' | 'mailgun';

@Entity({ name: 'comm_messages' })
@Index('idx_comm_messages_tenant_channel_status_sent', ['tenantId', 'channel', 'status', 'sentAt'])
@Index('idx_comm_messages_tenant_contact_created', ['tenantId', 'contactId', 'createdAt'])
export class CommMessageEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @ManyToOne('CrmContactEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact?: CrmContactEntity | null;

  @Column({
    type: 'enum',
    enum: ['whatsapp', 'email', 'sms', 'voice'],
    enumName: 'comm_channel_enum',
  })
  channel!: CommTemplateEntity['channel'];

  @Column({
    type: 'enum',
    enum: ['inbound', 'outbound'],
    enumName: 'comm_direction_enum',
  })
  direction!: CommDirection;

  @Column({ name: 'to_address', type: 'varchar', length: 320 })
  toAddress!: string;

  @Column({ name: 'from_address', type: 'varchar', length: 320 })
  fromAddress!: string;

  @Column({ type: 'varchar', length: 998, nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null;

  @ManyToOne(() => CommTemplateEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: CommTemplateEntity | null;

  @Column({ name: 'template_variables', type: 'jsonb', default: () => `'{}'::jsonb` })
  templateVariables!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'bounced'],
    enumName: 'comm_status_enum',
    default: 'pending',
  })
  status!: CommStatus;

  @Column({
    type: 'enum',
    enum: ['meta', 'twilio', 'sendgrid', 'mailgun'],
    enumName: 'comm_provider_enum',
  })
  provider!: CommProvider;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
