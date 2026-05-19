import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { BooksInvoiceEntity } from './books-invoice.entity.js';

@Entity({ name: 'books_invoice_lines' })
@Index('idx_books_invoice_lines_invoice', ['invoiceId', 'sortOrder'])
export class BooksInvoiceLineEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId!: string;

  @ManyToOne('BooksInvoiceEntity', 'lines', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: BooksInvoiceEntity;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 15, scale: 4 })
  quantity!: string;

  @Column({ name: 'unit_price_ht', type: 'numeric', precision: 15, scale: 2 })
  unitPriceHt!: string;

  @Column({ name: 'total_ht', type: 'numeric', precision: 15, scale: 2 })
  totalHt!: string;

  @Column({ name: 'tva_rate', type: 'numeric', precision: 5, scale: 2, default: 20.0 })
  tvaRate!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
