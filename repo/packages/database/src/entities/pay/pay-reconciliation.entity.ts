import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';
import { PayTransactionEntity } from './pay-transaction.entity.js';

export type ReconciliationStatus = 'matched' | 'unmatched' | 'discrepancy';

@Entity({ name: 'pay_reconciliation' })
@Index('idx_pay_reconciliation_tenant_status', ['tenantId', 'status'])
@Index('idx_pay_reconciliation_tx', ['transactionId'])
export class PayReconciliationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => PayTransactionEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: PayTransactionEntity;

  @Column({ name: 'bank_statement_ref', type: 'varchar', length: 128, nullable: true })
  bankStatementRef!: string | null;

  @Column({ name: 'reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt!: Date | null;

  @Column({ name: 'reconciled_by', type: 'uuid', nullable: true })
  reconciledBy!: string | null;

  @ManyToOne(() => AuthUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reconciled_by' })
  reconciler!: AuthUser | null;

  @Column({
    type: 'enum',
    enum: ['matched', 'unmatched', 'discrepancy'],
    enumName: 'reconciliation_status_enum',
    default: 'unmatched',
  })
  status!: ReconciliationStatus;

  @Column({ name: 'discrepancy_amount', type: 'numeric', precision: 15, scale: 2, default: 0 })
  discrepancyAmount!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
