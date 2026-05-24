/**
 * CrmInteractionEntity -- Sprint 8 Tache 8.5 (refactored Sprint 2 -> polymorphisme).
 *
 * Modele apres migration 018 :
 *   - Polymorphisme Option B : 3 colonnes nullable (company_id / contact_id /
 *     deal_id) avec CHECK exactly-one-not-null. FK natifs Postgres CASCADE.
 *   - Append-only triggers Sprint 2 PRESERVES (loi 09-08 CNDP immutability).
 *     Soft-delete via SECURITY DEFINER functions seules voies pour deleted_at.
 *   - parent_interaction_id : annotation pattern (correction via nouvelle
 *     interaction referencant l'originale).
 *   - duration_minutes / status / direction : CHECK consistency par type.
 *
 * Reference : migration 1735000000018 / B-08 Tache 3.1.5.
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
import { CrmCompanyEntity } from './crm-company.entity.js';
import { CrmContactEntity } from './crm-contact.entity.js';
import { CrmDealEntity } from './crm-deal.entity.js';

/** Types reconnus par l'enum DB `crm_interaction_type`. */
export type CrmInteractionType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note';

export type CrmInteractionDirection = 'inbound' | 'outbound';

/** Status workflow pour task/meeting/call (CHECK Sprint 8.5). */
export type CrmInteractionStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no_answer';

@Entity({ name: 'crm_interactions' })
@Index('idx_crm_interactions_tenant_occurred', ['tenantId', 'occurredAt'], {
  where: '"deleted_at" IS NULL',
})
export class CrmInteractionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  // ===== Polymorphic FKs (exactly-one CHECK enforced at DB) =====

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CrmCompanyEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company!: CrmCompanyEntity | null;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @ManyToOne(() => CrmContactEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity | null;

  @Column({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId!: string | null;

  @ManyToOne(() => CrmDealEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'deal_id' })
  deal!: CrmDealEntity | null;

  // ===== Type + content =====

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['call', 'email', 'whatsapp', 'meeting', 'note'],
    enumName: 'crm_interaction_type',
  })
  type!: CrmInteractionType;

  @Column({
    name: 'direction',
    type: 'enum',
    enum: ['inbound', 'outbound'],
    enumName: 'crm_interaction_direction',
    nullable: true,
  })
  direction!: CrmInteractionDirection | null;

  @Column({ name: 'subject', type: 'text' })
  subject!: string;

  @Column({ name: 'body', type: 'text', nullable: true })
  body!: string | null;

  // ===== Timing / metrics =====

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null;

  @Column({ name: 'status', type: 'varchar', length: 15, nullable: true })
  status!: CrmInteractionStatus | null;

  // ===== Annotation (correction via reference) =====

  @Column({ name: 'parent_interaction_id', type: 'uuid', nullable: true })
  parentInteractionId!: string | null;

  // ===== Audit + soft-delete =====

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;

  /** Custom fields per tenant -- validated by CustomFieldsValidatorService (Sprint 8.7). */
  @Column({ name: 'custom_fields', type: 'jsonb', default: () => "'{}'::jsonb" })
  customFields!: Record<string, unknown>;
}
