import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { AuthTenant } from '../system/auth-tenant.entity.js';
import { AuthUser } from '../system/auth-user.entity.js';

export type DocType = 'police' | 'devis' | 'facture' | 'sinistre' | 'kyc' | 'contrat' | 'autre';
export type DocStatus = 'draft' | 'final' | 'signed' | 'archived';

@Entity({ name: 'doc_documents' })
@Index('idx_doc_documents_tenant_type_created', ['tenantId', 'type', 'createdAt'])
@Index('idx_doc_documents_polymorphic', ['tenantId', 'relatedResourceType', 'relatedResourceId'])
@Index('idx_doc_documents_sha256', ['sha256'])
export class DocDocumentEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({
    type: 'enum',
    enum: ['police', 'devis', 'facture', 'sinistre', 'kyc', 'contrat', 'autre'],
    enumName: 'doc_type_enum',
  })
  type!: DocType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'related_resource_type', type: 'varchar', length: 64, nullable: true })
  relatedResourceType!: string | null;

  @Column({ name: 'related_resource_id', type: 'uuid', nullable: true })
  relatedResourceId!: string | null;

  @Column({ name: 's3_bucket', type: 'varchar', length: 128 })
  s3Bucket!: string;

  @Column({ name: 's3_key', type: 'varchar', length: 512 })
  s3Key!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'final', 'signed', 'archived'],
    enumName: 'doc_status_enum',
    default: 'draft',
  })
  status!: DocStatus;

  @Column({ name: 'retention_until', type: 'date', nullable: true })
  retentionUntil!: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator!: AuthUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
