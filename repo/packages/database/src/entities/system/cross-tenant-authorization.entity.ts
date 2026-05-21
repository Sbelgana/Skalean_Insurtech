import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTenant } from './auth-tenant.entity.js';
import { AuthUser } from './auth-user.entity.js';

export type CrossTenantAuthorizationType =
  | 'broker_to_garage_assignment'
  | 'assure_to_garage_visit'
  | 'multi_tenant_user_access';

export type CrossTenantResourceType =
  | 'sinistre'
  | 'police'
  | 'devis'
  | 'facture'
  | 'tenant';

/**
 * Cross-tenant authorization (Sprint 6 framework / Sprint 26 runtime).
 *
 * Helper Postgres `app_can_access_tenant(target)` Cond 3 :
 *   IF app_cross_tenant_authorization_id() points to active row
 *      WHERE from_tenant_id = current OR to_tenant_id = target
 *      AND revoked_at IS NULL AND expires_at > NOW()
 *   THEN allow.
 *
 * Index partiel actif : `WHERE revoked_at IS NULL AND expires_at > NOW()`
 * pour minimiser le scan a chaque verification.
 */
@Entity('cross_tenant_authorizations')
@Index('idx_cta_from_tenant', ['fromTenantId'])
@Index('idx_cta_to_tenant', ['toTenantId'])
@Index('idx_cta_type', ['type'])
export class CrossTenantAuthorization {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'type', type: 'text' })
  type!: CrossTenantAuthorizationType;

  @Column({ name: 'from_tenant_id', type: 'uuid' })
  fromTenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_tenant_id' })
  fromTenant!: AuthTenant;

  @Column({ name: 'to_tenant_id', type: 'uuid' })
  toTenantId!: string;

  @ManyToOne(() => AuthTenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_tenant_id' })
  toTenant!: AuthTenant;

  @Column({ name: 'scope', type: 'text', array: true, default: () => `'{}'::text[]` })
  scope!: string[];

  @Column({ name: 'resource_type', type: 'text', nullable: true })
  resourceType!: CrossTenantResourceType | null;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ name: 'granted_by_user_id', type: 'uuid' })
  grantedByUserId!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'granted_by_user_id' })
  grantedByUser!: AuthUser;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_by_user_id', type: 'uuid', nullable: true })
  revokedByUserId!: string | null;

  @Column({ name: 'revoked_reason', type: 'text', nullable: true })
  revokedReason!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;
}
