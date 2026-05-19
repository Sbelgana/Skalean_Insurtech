import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { CrmContactEntity } from './crm-contact.entity.js';
import { CrmDealEntity } from './crm-deal.entity.js';

export type CrmInteractionType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note';
export type CrmInteractionDirection = 'inbound' | 'outbound';

@Entity({ name: 'crm_interactions' })
@Index('idx_crm_interactions_tenant_contact', ['tenantId', 'contactId', 'occurredAt'])
export class CrmInteractionEntity {
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

  @Column({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId!: string | null;

  @ManyToOne(() => CrmDealEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'deal_id' })
  deal!: CrmDealEntity | null;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['call', 'email', 'whatsapp', 'meeting', 'note'],
    enumName: 'crm_interaction_type',
  })
  type!: CrmInteractionType;

  @Column({
    name: 'direction',
    type: 'enum',
    enum: ['inbound', 'outbound'],
    enumName: 'crm_interaction_direction',
  })
  direction!: CrmInteractionDirection;

  @Column({ name: 'subject', type: 'text' })
  subject!: string;

  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
