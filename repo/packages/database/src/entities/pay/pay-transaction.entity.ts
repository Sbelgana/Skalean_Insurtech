import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';
import { PayMethodEntity } from './pay-method.entity.js';

export type PayStatus =
  | 'initiated'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PayCurrency = 'MAD' | 'EUR' | 'USD' | 'GBP';

@Entity({ name: 'pay_transactions' })
@Unique('uq_pay_tx_tenant_provider_tx', ['tenantId', 'providerTransactionId'])
@Index('idx_pay_transactions_tenant_status_initiated', ['tenantId', 'status', 'initiatedAt'])
@Index('idx_pay_transactions_polymorphic', ['tenantId', 'relatedResourceType', 'relatedResourceId'])
export class PayTransactionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'pay_method_id', type: 'uuid' })
  payMethodId!: string;

  @ManyToOne(() => PayMethodEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'pay_method_id' })
  payMethod!: PayMethodEntity;

  @Column({ name: 'related_resource_type', type: 'varchar', length: 64, nullable: true })
  relatedResourceType!: string | null;

  @Column({ name: 'related_resource_id', type: 'uuid', nullable: true })
  relatedResourceId!: string | null;

  @Column({ name: 'amount_dirham', type: 'numeric', precision: 15, scale: 2 })
  amountDirham!: string;

  @Column({
    type: 'enum',
    enum: ['MAD', 'EUR', 'USD', 'GBP'],
    enumName: 'pay_currency_enum',
    default: 'MAD',
  })
  currency!: PayCurrency;

  @Column({
    type: 'enum',
    enum: ['initiated', 'pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
    enumName: 'pay_status_enum',
    default: 'initiated',
  })
  status!: PayStatus;

  @Column({ name: 'provider_transaction_id', type: 'varchar', length: 255, nullable: true })
  providerTransactionId!: string | null;

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse!: Record<string, unknown> | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName!: string | null;

  @Column({ name: 'customer_email', type: 'varchar', length: 255, nullable: true })
  customerEmail!: string | null;

  @Column({ name: 'customer_phone', type: 'varchar', length: 32, nullable: true })
  customerPhone!: string | null;

  @Column({ name: 'callback_url', type: 'varchar', length: 2048, nullable: true })
  callbackUrl!: string | null;

  @Column({ name: 'success_url', type: 'varchar', length: 2048, nullable: true })
  successUrl!: string | null;

  @Column({ name: 'cancel_url', type: 'varchar', length: 2048, nullable: true })
  cancelUrl!: string | null;

  @Column({ name: 'initiated_at', type: 'timestamptz', default: () => 'NOW()' })
  initiatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator!: AuthUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
