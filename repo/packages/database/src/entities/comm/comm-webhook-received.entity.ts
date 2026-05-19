import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import type { CommProvider } from './comm-message.entity.js';

export type CommWebhookProcessedStatus =
  | 'pending'
  | 'success'
  | 'duplicate'
  | 'invalid_signature'
  | 'error';

@Entity({ name: 'comm_webhooks_received' })
@Index('idx_comm_webhooks_provider_event', ['provider', 'eventType', 'createdAt'])
export class CommWebhookReceivedEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => AuthTenant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: AuthTenant | null;

  @Column({
    type: 'enum',
    enum: ['meta', 'twilio', 'sendgrid', 'mailgun'],
    enumName: 'comm_provider_enum',
  })
  provider!: CommProvider;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'signature_valid', type: 'boolean' })
  signatureValid!: boolean;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({
    name: 'processed_status',
    type: 'enum',
    enum: ['pending', 'success', 'duplicate', 'invalid_signature', 'error'],
    enumName: 'comm_webhook_processed_status_enum',
    default: 'pending',
  })
  processedStatus!: CommWebhookProcessedStatus;

  @Column({ name: 'idempotency_key', type: 'text', unique: true })
  idempotencyKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
