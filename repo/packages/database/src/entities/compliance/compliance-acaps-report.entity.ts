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
import { AuthUser } from '../system/auth-user.entity.js';
import type { DocDocumentEntity } from '../docs/doc-document.entity.js';

export type AcapsReportType = 'monthly_production' | 'quarterly_sinistralite' | 'annual_solvency';
export type AcapsReportStatus = 'draft' | 'submitted' | 'accepted' | 'rejected';

@Entity({ name: 'compliance_acaps_reports' })
@Index('idx_compliance_acaps_tenant_status', ['tenantId', 'status'])
@Index('idx_compliance_acaps_period', ['tenantId', 'periodStart', 'periodEnd'])
export class ComplianceAcapsReportEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ['monthly_production', 'quarterly_sinistralite', 'annual_solvency'],
    enumName: 'compliance_acaps_report_type',
  })
  reportType!: AcapsReportType;

  @Column({
    type: 'enum',
    enum: ['draft', 'submitted', 'accepted', 'rejected'],
    enumName: 'compliance_acaps_report_status',
    default: 'draft',
  })
  status!: AcapsReportStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'acaps_reference', type: 'text', nullable: true })
  acapsReference!: string | null;

  @Column({ name: 'file_document_id', type: 'uuid', nullable: true })
  fileDocumentId!: string | null;

  @ManyToOne('DocDocumentEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'file_document_id' })
  fileDocument!: DocDocumentEntity | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator!: AuthUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
