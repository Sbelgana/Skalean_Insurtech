import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { AuthUser } from '../system/auth-user.entity.js';
import { DocDocumentEntity } from './doc-document.entity.js';

@Entity({ name: 'doc_versions' })
@Unique('uq_doc_versions_doc_ver', ['documentId', 'versionNumber'])
@Index('idx_doc_versions_document', ['documentId', 'versionNumber'])
export class DocVersionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => DocDocumentEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'document_id' })
  document!: DocDocumentEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 's3_key', type: 'varchar', length: 512 })
  s3Key!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator!: AuthUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
