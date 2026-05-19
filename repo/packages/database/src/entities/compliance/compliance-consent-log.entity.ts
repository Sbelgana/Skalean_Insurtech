import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import type { CrmContactEntity } from '../crm/crm-contact.entity.js';
import type { DocDocumentEntity } from '../docs/doc-document.entity.js';

export type ConsentType = 'cnic_processing' | 'data_marketing' | 'data_third_party';
export type ConsentMethod = 'web_form' | 'whatsapp_optin' | 'paper_signed';

@Entity({ name: 'compliance_consent_logs' })
@Index('idx_compliance_consent_contact_type', ['contactId', 'consentType', 'consentGiven'])
@Index('idx_compliance_consent_tenant_created', ['tenantId', 'createdAt'])
export class ComplianceConsentLogEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId!: string;

  @ManyToOne('CrmContactEntity', { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity;

  @Column({
    name: 'consent_type',
    type: 'enum',
    enum: ['cnic_processing', 'data_marketing', 'data_third_party'],
    enumName: 'compliance_consent_type',
  })
  consentType!: ConsentType;

  @Column({ name: 'consent_given', type: 'boolean' })
  consentGiven!: boolean;

  @Column({
    name: 'consent_method',
    type: 'enum',
    enum: ['web_form', 'whatsapp_optin', 'paper_signed'],
    enumName: 'compliance_consent_method',
  })
  consentMethod!: ConsentMethod;

  @Column({ name: 'evidence_document_id', type: 'uuid', nullable: true })
  evidenceDocumentId!: string | null;

  @ManyToOne('DocDocumentEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'evidence_document_id' })
  evidenceDocument!: DocDocumentEntity | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'withdrawn_at', type: 'timestamptz', nullable: true })
  withdrawnAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
