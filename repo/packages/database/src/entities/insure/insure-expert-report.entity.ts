/**
 * InsureExpertReport entity -- Sprint 7.5b.7 foundation skeleton.
 *
 * Reference table : insure_expert_reports (migration 1735000000015).
 * Decisions : decision-009 signature loi 43-20 + decision-008 residence MA.
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
import { InsureExpertAssignment } from './insure-expert-assignment.entity.js';

export type ExpertReportStatus = 'draft' | 'submitted' | 'signed' | 'archived' | 'rejected';

@Entity('insure_expert_reports')
@Index('idx_ier_tenant', ['tenantId'])
@Index('idx_ier_assignment', ['assignmentId'])
@Index('idx_ier_status', ['status'])
export class InsureExpertReport {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @ManyToOne(() => InsureExpertAssignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: InsureExpertAssignment;

  @Column({ name: 'report_url', type: 'text' })
  reportUrl!: string;

  @Column({ name: 'signature_hash', type: 'text', nullable: true })
  signatureHash!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;

  @Column({ name: 'status', type: 'text', default: 'draft' })
  status!: ExpertReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
