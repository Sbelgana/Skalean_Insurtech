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

/**
 * Cross-tenant authorization types (Sprint 6 framework, extended Sprint 7.5a v3.0).
 *
 * v2.2 (3 types) : broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access.
 * v3.0 (+4 types, decision-012) :
 *   - client_to_tower_dispatch    : assure/courtier declenche mission remorquage
 *   - tower_to_garage_delivery    : remorqueur livre vehicule au garage cible
 *   - garage_to_expert_request    : garage notifie expert designe pour validation devis
 *   - garage_to_carrier_quote     : garage envoie devis a la compagnie en copie
 */
export type CrossTenantAuthorizationType =
  | 'broker_to_garage_assignment'
  | 'assure_to_garage_visit'
  | 'multi_tenant_user_access'
  | 'client_to_tower_dispatch'
  | 'tower_to_garage_delivery'
  | 'garage_to_expert_request'
  | 'garage_to_carrier_quote';

/**
 * Cross-tenant resource types (Sprint 6 framework, extended Sprint 7.5a v3.0).
 *
 * v2.2 (5 types) : sinistre, police, devis, facture, tenant.
 * v3.0 (+3 types, decision-012/013/014) :
 *   - mission     : tow mission (decision-012 cross-tenant types 4/5)
 *   - expertise   : expert report / contre-expertise (decision-013)
 *   - parts_order : PartsHub order (decision-014)
 */
export type CrossTenantResourceType =
  | 'sinistre'
  | 'police'
  | 'devis'
  | 'facture'
  | 'tenant'
  | 'mission'
  | 'expertise'
  | 'parts_order';

/** All cross-tenant authorization types (frozen array for iteration/validation). */
export const ALL_CROSS_TENANT_AUTHORIZATION_TYPES: readonly CrossTenantAuthorizationType[] =
  Object.freeze([
    'broker_to_garage_assignment',
    'assure_to_garage_visit',
    'multi_tenant_user_access',
    'client_to_tower_dispatch',
    'tower_to_garage_delivery',
    'garage_to_expert_request',
    'garage_to_carrier_quote',
  ]);

/** All cross-tenant resource types (frozen array for iteration/validation). */
export const ALL_CROSS_TENANT_RESOURCE_TYPES: readonly CrossTenantResourceType[] = Object.freeze([
  'sinistre',
  'police',
  'devis',
  'facture',
  'tenant',
  'mission',
  'expertise',
  'parts_order',
]);

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
