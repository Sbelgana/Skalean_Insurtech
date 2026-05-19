import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuthUser } from '../system/auth-user.entity.js';
import { DocDocumentEntity } from './doc-document.entity.js';

export type DocAccessAction = 'view' | 'download' | 'share';

@Entity({ name: 'doc_access_logs' })
@Index('idx_doc_access_logs_document_created', ['documentId', 'createdAt'])
export class DocAccessLogEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => DocDocumentEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'document_id' })
  document!: DocDocumentEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => AuthUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser | null;

  @Column({
    type: 'enum',
    enum: ['view', 'download', 'share'],
    enumName: 'doc_access_action_enum',
  })
  action!: DocAccessAction;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
