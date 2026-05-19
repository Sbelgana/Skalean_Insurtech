import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';

export type BooksAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

@Entity({ name: 'books_accounts' })
@Unique('books_accounts_tenant_number_unique', ['tenantId', 'accountNumber'])
@Index('idx_books_accounts_tenant_number', ['tenantId', 'accountNumber'])
export class BooksAccountEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'account_number', type: 'text' })
  accountNumber!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({
    type: 'enum',
    enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    enumName: 'books_account_type',
  })
  type!: BooksAccountType;

  @Column({ name: 'parent_account_id', type: 'uuid', nullable: true })
  parentAccountId!: string | null;

  @ManyToOne(() => BooksAccountEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parentAccount!: BooksAccountEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
