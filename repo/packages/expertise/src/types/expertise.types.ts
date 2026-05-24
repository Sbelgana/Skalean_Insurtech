/**
 * Expertise types -- Sprint 7.5b foundation skeleton (decision-013).
 *
 * Workflow expert designation (table insure_expert_assignments -- Sprint 7.5b.6) :
 *   designated -> accepted -> completed
 *   designated -> rejected
 *   designated -> cancelled
 *
 * Sprint 14 implementera designation par carrier_claims_manager + workflow.
 */

/** Statut d'une mission d'expertise (cycle de vie). */
export type ExpertAssignmentStatus =
  | 'designated'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

/**
 * Decision de l'expert sur le devis garage (Sprint 14 implementera).
 */
export type ExpertQuoteDecision = 'validate' | 'modify' | 'reject';

/**
 * Mission d'expertise (correspond a la table insure_expert_assignments).
 *
 * `designated_by_user_id` = utilisateur carrier_claims_manager / carrier_expert_manager
 * (cross-tenant authorization type `carrier_to_expert_request` Sprint 7.5a).
 */
export interface ExpertAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly expertId: string;
  readonly sinistreId: string;
  readonly designatedByUserId: string;
  readonly status: ExpertAssignmentStatus;
  readonly designatedAt: Date;
  readonly acceptedAt?: Date | null;
  readonly completedAt?: Date | null;
  readonly rejectionReason?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input designation expert (Sprint 14 service signature). */
export interface DesignateExpertInput {
  readonly tenantId: string;
  readonly expertId: string;
  readonly sinistreId: string;
  readonly designatedByUserId: string;
}
