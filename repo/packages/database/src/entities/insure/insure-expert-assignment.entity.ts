/**
 * InsureExpertAssignment entity -- Sprint 7.5b.6 foundation skeleton.
 *
 * Reference table : insure_expert_assignments (migration 1735000000014).
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';
import { InsureExpert } from './insure-expert.entity.js';

export type ExpertAssignmentStatus =
  | 'designated'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

@Entity('insure_expert_assignments')
@Index('idx_iea_tenant', ['tenantId'])
@Index('idx_iea_expert', ['expertId'])
@Index('idx_iea_sinistre', ['sinistreId'])
@Index('idx_iea_status', ['status'])
export class InsureExpertAssignment {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'expert_id', type: 'uuid' })
  expertId!: string;

  @ManyToOne(() => InsureExpert, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expert_id' })
  expert!: InsureExpert;

  @Column({ name: 'sinistre_id', type: 'uuid' })
  sinistreId!: string;

  @Column({ name: 'designated_by_user_id', type: 'uuid' })
  designatedByUserId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'designated_by_user_id' })
  designatedByUser!: AuthUser;

  @Column({ name: 'status', type: 'text', default: 'designated' })
  status!: ExpertAssignmentStatus;

  @Column({ name: 'designated_at', type: 'timestamptz', default: () => 'NOW()' })
  designatedAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
