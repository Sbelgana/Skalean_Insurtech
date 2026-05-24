/**
 * InsureExpert entity -- Sprint 7.5b.5 foundation skeleton.
 *
 * Reference table : insure_experts (migration 1735000000013).
 * Decisions : decision-013 Expert acteur central + ACAPS independance.
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

export type ExpertSpeciality = 'automobile' | 'dommage_corporel' | 'responsabilite_civile';
export type ExpertStatus = 'pending' | 'active' | 'suspended' | 'archived';

@Entity('insure_experts')
@Index('idx_insure_experts_tenant', ['tenantId'])
@Index('idx_insure_experts_status', ['status'])
@Index('idx_insure_experts_speciality', ['speciality'])
export class InsureExpert {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser;

  @Column({ name: 'cin', type: 'text' })
  cin!: string;

  @Column({ name: 'acaps_registration_number', type: 'text' })
  acapsRegistrationNumber!: string;

  @Column({ name: 'speciality', type: 'text' })
  speciality!: ExpertSpeciality;

  @Column({ name: 'acaps_registration_date', type: 'date' })
  acapsRegistrationDate!: Date;

  @Column({ name: 'status', type: 'text', default: 'pending' })
  status!: ExpertStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
