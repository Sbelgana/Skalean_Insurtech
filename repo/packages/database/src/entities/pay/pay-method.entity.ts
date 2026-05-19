import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { EncryptedJsonbTransformer } from './encrypted-jsonb.transformer.js';

export type PayProvider =
  | 'cmi'
  | 'youcan'
  | 'payzone'
  | 'm_wallet_inwi'
  | 'm_wallet_orange'
  | 'm_wallet_iam'
  | 'cash'
  | 'cheque'
  | 'virement';

const ENCRYPTED_JSONB = new EncryptedJsonbTransformer();

@Entity({ name: 'pay_methods' })
@Index('idx_pay_methods_tenant_priority', ['tenantId', 'priority'])
export class PayMethodEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({
    type: 'enum',
    enum: ['cmi', 'youcan', 'payzone', 'm_wallet_inwi', 'm_wallet_orange', 'm_wallet_iam', 'cash', 'cheque', 'virement'],
    enumName: 'pay_provider_enum',
  })
  provider!: PayProvider;

  @Column({
    name: 'config_encrypted',
    type: 'jsonb',
    transformer: ENCRYPTED_JSONB,
  })
  configEncrypted!: Record<string, unknown>;

  @Column({ name: 'config_key_version', type: 'int', default: 1 })
  configKeyVersion!: number;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
