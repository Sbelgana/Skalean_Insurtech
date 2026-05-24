/**
 * WorkflowStatePolicy -- Sprint 7 Tache 2.3.7.
 *
 * Verifie transition de state machine valide. Distinct de StatusBasedPolicy :
 *   - StatusBased : "permission X autorisee SI status courant IN allowedStates"
 *   - WorkflowState : "transition from X to Y autorisee SI X -> Y dans graph"
 *
 * Workflow sinistre Assurflow v3.0 (decision-013 expert acteur central) :
 *   declared -> acknowledged -> appointment_scheduled -> expert_designated
 *     -> expert_quote_review -> repair_in_progress -> closed
 *
 * Workflow devis :
 *   draft -> submitted -> approved | rejected -> expired
 *
 * Workflow police :
 *   quoted -> active -> renewed | cancelled | expired
 *
 * Workflow tow mission (decision-012) :
 *   requested -> accepted -> in_progress -> completed | cancelled
 *
 * Workflow parts order (decision-014) :
 *   pending -> placed -> shipped -> delivered | cancelled
 *
 * Workflow expert designation (decision-013) :
 *   designated -> accepted -> completed
 *   designated -> rejected
 *   designated -> cancelled
 *
 * Implementation :
 *   - context.resourceMetadata.targetStatus = status cible de la transition
 *   - context.resourceStatus = status courant
 *   - allowed si edge (current, target) ∈ workflow graph
 *
 * Reference : B-07 Tache 2.3.7.
 */

import type { PermissionValue } from '../../rbac/permissions.enum.js';
import { type AbacContext, type AbacPolicy, type AbacResult, type AbacResourceType } from '../types.js';

/** Graphe transitions par resource_type : Map<current, Set<target>>. */
type Workflow = ReadonlyMap<string, ReadonlySet<string>>;

const buildWorkflow = (edges: ReadonlyArray<readonly [string, readonly string[]]>): Workflow => {
  const m = new Map<string, ReadonlySet<string>>();
  for (const [from, tos] of edges) {
    m.set(from, new Set(tos));
  }
  return m;
};

const WORKFLOWS: Partial<Record<AbacResourceType, Workflow>> = {
  repair_sinistre: buildWorkflow([
    ['declared', ['acknowledged']],
    ['acknowledged', ['appointment_scheduled']],
    ['appointment_scheduled', ['expert_designated']],
    ['expert_designated', ['expert_quote_review']],
    ['expert_quote_review', ['repair_in_progress', 'rejected']],
    ['repair_in_progress', ['closed']],
  ]),
  repair_devis: buildWorkflow([
    ['draft', ['submitted']],
    ['submitted', ['approved', 'rejected']],
    ['approved', ['expired']],
  ]),
  insure_police: buildWorkflow([
    ['quoted', ['active']],
    ['active', ['renewed', 'cancelled', 'expired']],
  ]),
  tow_mission: buildWorkflow([
    ['requested', ['accepted', 'cancelled']],
    ['accepted', ['in_progress', 'cancelled']],
    ['in_progress', ['completed', 'cancelled']],
  ]),
  parts_order: buildWorkflow([
    ['pending', ['placed', 'cancelled']],
    ['placed', ['shipped', 'cancelled']],
    ['shipped', ['delivered']],
  ]),
  expert_designation: buildWorkflow([
    ['designated', ['accepted', 'rejected', 'cancelled']],
    ['accepted', ['completed', 'cancelled']],
  ]),
};

export class WorkflowStatePolicy implements AbacPolicy {
  readonly name = 'WorkflowStatePolicy';

  /**
   * Cette policy n'est pas declenchee par permission specifique mais par
   * presence de context.resourceMetadata.targetStatus. AbacGuard appellera
   * `evaluateForPermission` explicitement quand transition demande.
   *
   * Pour le contrat AbacPolicy, `applies` retourne false par defaut : la
   * policy n'intervient que sur appel direct via AbacService route.
   */
  applies(_permission: PermissionValue): boolean {
    return false;
  }

  evaluate(context: AbacContext): AbacResult {
    return this.evaluateForPermission(context, undefined);
  }

  evaluateForPermission(context: AbacContext, permission?: PermissionValue): AbacResult {
    const targetStatus = context.resourceMetadata?.['targetStatus'];
    if (typeof targetStatus !== 'string') {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const resourceType = context.resourceType;
    if (!resourceType) {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const workflow = WORKFLOWS[resourceType];
    if (!workflow) {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const currentStatus = context.resourceStatus;
    if (!currentStatus) {
      return {
        allowed: false,
        reason: 'RESOURCE_NOT_FOUND',
        policy: this.name,
        permission,
      };
    }

    const validTargets = workflow.get(currentStatus);
    if (!validTargets || !validTargets.has(targetStatus)) {
      return {
        allowed: false,
        reason: 'WORKFLOW_TRANSITION_INVALID',
        policy: this.name,
        resourceType,
        ...(permission ? { permission } : {}),
        ...(context.resourceId ? { resourceId: context.resourceId } : {}),
      };
    }

    return {
      allowed: true,
      policy: this.name,
      resourceType,
      ...(permission ? { permission } : {}),
      ...(context.resourceId ? { resourceId: context.resourceId } : {}),
    };
  }

  /** Expose workflow pour tests / dashboards. */
  getValidTransitions(resourceType: AbacResourceType, currentStatus: string): readonly string[] {
    const workflow = WORKFLOWS[resourceType];
    return workflow?.get(currentStatus) ? Array.from(workflow.get(currentStatus)!) : [];
  }
}
