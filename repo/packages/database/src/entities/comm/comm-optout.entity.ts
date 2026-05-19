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
import type { CommTemplateEntity } from './comm-template.entity.js';

@Entity({ name: 'comm_optouts' })
@Index('idx_comm_optouts_tenant_contact', ['tenantId', 'contactId'])
export class CommOptoutEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId!: string;

  @ManyToOne('CrmContactEntity', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity;

  @Column({
    type: 'enum',
    enum: ['whatsapp', 'email', 'sms', 'voice'],
    enumName: 'comm_channel_enum',
  })
  channel!: CommTemplateEntity['channel'];

  @Column({ name: 'optout_at', type: 'timestamptz', default: () => 'NOW()' })
  optoutAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by_contact', type: 'boolean' })
  createdByContact!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
