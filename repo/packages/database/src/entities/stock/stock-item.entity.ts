import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';

export type StockUnit = 'unit' | 'liter' | 'kg' | 'meter';

@Entity({ name: 'stock_items' })
@Unique('uq_stock_items_tenant_sku', ['tenantId', 'sku'])
@Index('idx_stock_items_tenant_category', ['tenantId', 'category'])
export class StockItemEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'sku', type: 'text' })
  sku!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'category', type: 'text', nullable: true })
  category!: string | null;

  @Column({
    name: 'unit',
    type: 'enum',
    enum: ['unit', 'liter', 'kg', 'meter'],
    enumName: 'stock_unit_enum',
    default: 'unit',
  })
  unit!: StockUnit;

  @Column({ name: 'unit_price_ht', type: 'numeric', precision: 15, scale: 2, default: 0 })
  unitPriceHt!: string;

  @Column({ name: 'tva_rate', type: 'numeric', precision: 5, scale: 2, default: 20.0 })
  tvaRate!: string;

  @Column({ name: 'current_quantity', type: 'numeric', precision: 15, scale: 3, default: 0 })
  currentQuantity!: string;

  @Column({ name: 'min_threshold', type: 'numeric', precision: 15, scale: 3, default: 0 })
  minThreshold!: string;

  @Column({ name: 'supplier_name', type: 'text', nullable: true })
  supplierName!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
