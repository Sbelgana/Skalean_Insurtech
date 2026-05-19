import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { StockItemEntity } from './stock-item.entity.js';
import type { AuthUser } from '../system/auth-user.entity.js';

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'inventory';

@Entity({ name: 'stock_movements' })
@Index('idx_stock_movements_tenant_item_created', ['tenantId', 'itemId', 'createdAt'])
@Index('idx_stock_movements_tenant_type', ['tenantId', 'movementType', 'createdAt'])
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => StockItemEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'item_id' })
  item!: StockItemEntity;

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: ['in', 'out', 'adjustment', 'inventory'],
    enumName: 'stock_movement_type_enum',
  })
  movementType!: StockMovementType;

  @Column({ name: 'quantity', type: 'numeric', precision: 15, scale: 3 })
  quantity!: string;

  @Column({ name: 'unit_price_ht_at_time', type: 'numeric', precision: 15, scale: 2 })
  unitPriceHtAtTime!: string;

  @Column({ name: 'related_resource_type', type: 'text', nullable: true })
  relatedResourceType!: string | null;

  @Column({ name: 'related_resource_id', type: 'uuid', nullable: true })
  relatedResourceId!: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne('AuthUser', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator!: AuthUser | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
