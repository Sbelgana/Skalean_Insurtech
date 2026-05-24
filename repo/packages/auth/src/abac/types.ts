/**
 * ABAC types -- Sprint 7 Tache 2.3.6.
 *
 * Attribute-Based Access Control : couche au-dessus du RBAC pour evaluer
 * des contraintes contextuelles sur les ressources (owner / time / status /
 * workflow state).
 *
 * Resource types Assurflow v3.0 (decision-012/013/014) :
 *   - crm_contact, crm_company, crm_deal
 *   - insure_police, insure_quote
 *   - repair_sinistre, repair_devis
 *   - pay_transaction, pay_refund
 *   - doc_document, signature_request
 *   - expert_designation (v3.0 decision-013)
 *   - tow_mission (v3.0 decision-012)
 *   - parts_order (v3.0 decision-014)
 *
 * Reference : B-07 Tache 2.3.6.
 */

import { z } from 'zod';
import type { AuthRole } from '../types/auth-roles.js';
import type { PermissionValue } from '../rbac/permissions.enum.js';

// ============================================================================
// Resource types (v3.0 extended)
// ============================================================================

export const ALL_ABAC_RESOURCE_TYPES = [
  'crm_contact',
  'crm_company',
  'crm_deal',
  'insure_police',
  'insure_quote',
  'repair_sinistre',
  'repair_devis',
  'pay_transaction',
  'pay_refund',
  'doc_document',
  'signature_request',
  // v3.0 -- Sprint 7.5a foundation
  'expert_designation',
  'tow_mission',
  'parts_order',
] as const;

export type AbacResourceType = (typeof ALL_ABAC_RESOURCE_TYPES)[number];

export const AbacResourceTypeSchema = z.enum(ALL_ABAC_RESOURCE_TYPES);

// ============================================================================
// AbacContext (passed to policies)
// ============================================================================

/**
 * Context complet evalue par les ABAC policies.
 *
 * Champs obligatoires :
 *   - userId / userRole : identite (peuple par TenantContext / JwtAuthGuard).
 *   - tenantId : tenant courant (peuple par TenantContextGuard, sauf admin routes).
 *
 * Champs optionnels (specifiques au policy active) :
 *   - resourceType + resourceId : la ressource ciblee (loadee par AbacGuard).
 *   - resourceOwnerId : pour OwnResourcesPolicy.
 *   - resourceAssigneeId : pour repair sinistres assignes au technicien.
 *   - resourceStatus : pour StatusBasedPolicy + WorkflowStatePolicy.
 *   - resourceCreatedAt : pour TimeBasedPolicy (delais legaux MA).
 *   - now : injection horloge testable (default `new Date()`).
 */
export interface AbacContext {
  readonly userId: string;
  readonly userRole: AuthRole;
  readonly tenantId?: string;
  readonly resourceType?: AbacResourceType;
  readonly resourceId?: string;
  readonly resourceOwnerId?: string;
  readonly resourceAssigneeId?: string;
  readonly resourceStatus?: string;
  readonly resourceCreatedAt?: Date;
  readonly resourceMetadata?: Record<string, unknown>;
  readonly now?: Date;
}

export const AbacContextSchema = z.object({
  userId: z.string().uuid(),
  userRole: z.string(),
  tenantId: z.string().uuid().optional(),
  resourceType: AbacResourceTypeSchema.optional(),
  resourceId: z.string().optional(),
  resourceOwnerId: z.string().optional(),
  resourceAssigneeId: z.string().optional(),
  resourceStatus: z.string().optional(),
  resourceCreatedAt: z.date().optional(),
  resourceMetadata: z.record(z.unknown()).optional(),
  now: z.date().optional(),
});

// ============================================================================
// AbacResult (returned by evaluate)
// ============================================================================

export type AbacDecisionReason =
  | 'OWNER_MISMATCH'
  | 'NOT_ASSIGNED'
  | 'TIME_WINDOW_EXPIRED'
  | 'STATUS_DENIES_ACTION'
  | 'WORKFLOW_TRANSITION_INVALID'
  | 'RESOURCE_NOT_FOUND'
  | 'NO_POLICY_FOR_PERMISSION'
  | 'POLICY_NOT_APPLICABLE';

export interface AbacResult {
  readonly allowed: boolean;
  readonly reason?: AbacDecisionReason | undefined;
  /** Nom du policy qui a refuse (pour debug + audit). */
  readonly policy?: string | undefined;
  /** Permission evaluee (echo). */
  readonly permission?: PermissionValue | undefined;
  /** Resource evaluee (echo). */
  readonly resourceType?: AbacResourceType | undefined;
  readonly resourceId?: string | undefined;
}

// ============================================================================
// AbacPolicy interface (consumed by AbacService Sprint 7 Tache 2.3.7)
// ============================================================================

/**
 * Interface qu'une policy doit implementer pour etre enregistree dans
 * AbacService. Les policies sont stateless et purement fonctionnelles
 * (sauf injection d'horloge / dependances explicites).
 *
 * `applies(permission)` : true si la policy doit etre evaluee pour cette perm.
 * Permet routing efficace : OwnResourcesPolicy applique a *_own, TimeBased a
 * pay.refunds.create, etc.
 *
 * `evaluate(context)` : retourne allowed=true/false + reason.
 */
export interface AbacPolicy {
  readonly name: string;
  applies(permission: PermissionValue): boolean;
  evaluate(context: AbacContext): AbacResult | Promise<AbacResult>;
}

// ============================================================================
// Helpers
// ============================================================================

/** Type guard runtime via Zod. */
export function isAbacResourceType(value: unknown): value is AbacResourceType {
  return AbacResourceTypeSchema.safeParse(value).success;
}

/** Builder utile pour tests + AbacGuard. */
export function buildAbacContext(partial: AbacContext): AbacContext {
  return { now: new Date(), ...partial };
}
