import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';
import type { DocDocumentEntity } from '../docs/doc-document.entity.js';
import type { BooksInvoiceLineEntity } from './books-invoice-line.entity.js';

export type BooksInvoiceType = 'invoice' | 'credit_note' | 'proforma';
export type BooksInvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

@Entity({ name: 'books_invoices' })
@Unique('books_invoices_tenant_number_unique', ['tenantId', 'invoiceNumber'])
@Index('idx_books_invoices_tenant_status', ['tenantId', 'status'])
@Index('idx_books_invoices_tenant_issue_date', ['tenantId', 'issueDate'])
export class BooksInvoiceEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'invoice_number', type: 'text' })
  invoiceNumber!: string;

  @Column({
    type: 'enum',
    enum: ['invoice', 'credit_note', 'proforma'],
    enumName: 'books_invoice_type',
    default: 'invoice',
  })
  type!: BooksInvoiceType;

  @Column({ name: 'customer_name', type: 'text' })
  customerName!: string;

  @Column({ name: 'customer_ice', type: 'varchar', length: 15 })
  customerIce!: string;

  @Column({ name: 'customer_address', type: 'text' })
  customerAddress!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'char', length: 3, default: 'MAD' })
  currency!: string;

  @Column({ name: 'subtotal_ht', type: 'numeric', precision: 15, scale: 2 })
  subtotalHt!: string;

  @Column({ name: 'tva_amount', type: 'numeric', precision: 15, scale: 2 })
  tvaAmount!: string;

  @Column({ name: 'total_ttc', type: 'numeric', precision: 15, scale: 2 })
  totalTtc!: string;

  @Column({ name: 'tva_rate', type: 'numeric', precision: 5, scale: 2, default: 20.0 })
  tvaRate!: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'issued', 'paid', 'overdue', 'cancelled'],
    enumName: 'books_invoice_status',
    default: 'draft',
  })
  status!: BooksInvoiceStatus;

  @Column({ name: 'pdf_document_id', type: 'uuid', nullable: true })
  pdfDocumentId!: string | null;

  @ManyToOne('DocDocumentEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pdf_document_id' })
  pdfDocument!: DocDocumentEntity | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator!: AuthUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('BooksInvoiceLineEntity', 'invoice', { cascade: true })
  lines!: BooksInvoiceLineEntity[];
}
