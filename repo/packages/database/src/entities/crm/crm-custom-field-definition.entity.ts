/**
 * CrmCustomFieldDefinitionEntity -- Sprint 8 Tache 8.7.
 *
 * Definition metadata per tenant pour custom fields sur entites CRM.
 * Validation runtime construite par CustomFieldsValidatorService.
 *
 * Reference : migration 1735000000020 / B-08 Tache 3.1.7.
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

export type CustomFieldEntityType = 'company' | 'contact' | 'deal' | 'interaction';

export type CustomFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'url'
  | 'email';

export interface CustomFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface CustomFieldValidationRules {
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

@Entity({ name: 'crm_custom_field_definitions' })
@Index('idx_cfd_tenant_entity_active', ['tenantId', 'entityType', 'active', 'displayOrder'])
export class CrmCustomFieldDefinitionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType!: CustomFieldEntityType;

  @Column({ name: 'field_key', type: 'varchar', length: 50 })
  fieldKey!: string;

  @Column({ name: 'field_label', type: 'varchar', length: 150 })
  fieldLabel!: string;

  @Column({ name: 'field_type', type: 'varchar', length: 20 })
  fieldType!: CustomFieldType;

  @Column({ name: 'options', type: 'jsonb', nullable: true })
  options!: readonly CustomFieldOption[] | null;

  @Column({ name: 'validation_rules', type: 'jsonb', default: () => "'{}'::jsonb" })
  validationRules!: CustomFieldValidationRules;

  @Column({ name: 'required', type: 'boolean', default: false })
  required!: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
