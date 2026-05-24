/**
 * AbacService -- Sprint 7 Tache 2.3.7.
 *
 * Service NestJS evaluant les ABAC policies. 4 policies de base livrees
 * Sprint 7 : OwnResources / TimeBased / StatusBased / WorkflowState.
 *
 * API :
 *   - evaluate(permission, context) : route vers policy compatible
 *   - registerPolicy(policy) : enregistrement dynamique (Sprint 32+ custom rules)
 *   - getRegisteredPolicies() : introspection
 *
 * Logic evaluate :
 *   1. Trouve les policies dont `applies(permission)` retourne true
 *   2. Si aucune : NO_POLICY_FOR_PERMISSION (fallback RBAC seul suffit)
 *   3. Sinon : evalue chaque policy ; allowed=true des qu'une retourne true.
 *   4. Sinon : retourne le dernier deny (preserve raison la plus specifique).
 *
 * Reference : B-07 Tache 2.3.7.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PermissionValue } from '../rbac/permissions.enum.js';
import { OwnResourcesPolicy } from './policies/own-resources.policy.js';
import { StatusBasedPolicy } from './policies/status-based.policy.js';
import { TimeBasedPolicy } from './policies/time-based.policy.js';
import { WorkflowStatePolicy } from './policies/workflow-state.policy.js';
import type { AbacContext, AbacPolicy, AbacResult } from './types.js';

/**
 * Extended policy interface : accepte un parametre permission optionnel
 * sur `evaluate`. Les 4 policies standard implementent
 * `evaluateForPermission` pour bridge.
 */
type PolicyWithPermission = AbacPolicy & {
  evaluateForPermission?: (
    context: AbacContext,
    permission: PermissionValue,
  ) => AbacResult | Promise<AbacResult>;
};

@Injectable()
export class AbacService {
  private readonly logger = new Logger(AbacService.name);
  private readonly policies: PolicyWithPermission[] = [];

  constructor() {
    // Registration des 4 policies de base (peuvent etre remplacees via DI).
    this.policies.push(new OwnResourcesPolicy());
    this.policies.push(new TimeBasedPolicy());
    this.policies.push(new StatusBasedPolicy());
    this.policies.push(new WorkflowStatePolicy());
  }

  /**
   * Evalue toutes les policies applicables a la permission.
   * Retourne allowed=true si AU MOINS UNE policy autorise.
   * Sinon retourne le dernier deny (raison specifique).
   *
   * Si aucune policy n'applique : NO_POLICY_FOR_PERMISSION (RBAC seul suffit).
   */
  async evaluate(permission: PermissionValue, context: AbacContext): Promise<AbacResult> {
    const applicable = this.policies.filter((p) => p.applies(permission));

    if (applicable.length === 0) {
      return {
        allowed: false,
        reason: 'NO_POLICY_FOR_PERMISSION',
        permission,
      };
    }

    let lastDeny: AbacResult | undefined;
    for (const policy of applicable) {
      const result = await this.invokePolicy(policy, context, permission);
      if (result.allowed) {
        return result;
      }
      lastDeny = result;
    }

    return (
      lastDeny ?? {
        allowed: false,
        reason: 'NO_POLICY_FOR_PERMISSION',
        permission,
      }
    );
  }

  /**
   * Evalue une policy ciblee explicitement (utile pour WorkflowState que
   * `applies` ne route pas par permission).
   */
  async evaluatePolicy(
    policyName: string,
    permission: PermissionValue,
    context: AbacContext,
  ): Promise<AbacResult> {
    const policy = this.policies.find((p) => p.name === policyName);
    if (!policy) {
      return {
        allowed: false,
        reason: 'NO_POLICY_FOR_PERMISSION',
        permission,
      };
    }
    return this.invokePolicy(policy, context, permission);
  }

  /** Enregistrement dynamique d'une policy custom (Sprint 32+). */
  registerPolicy(policy: AbacPolicy): void {
    this.policies.push(policy);
    this.logger.log(`AbacService registered policy : ${policy.name}`);
  }

  /** Introspection. */
  getRegisteredPolicies(): readonly string[] {
    return this.policies.map((p) => p.name);
  }

  private async invokePolicy(
    policy: PolicyWithPermission,
    context: AbacContext,
    permission: PermissionValue,
  ): Promise<AbacResult> {
    // Si la policy expose evaluateForPermission, on transmet la permission.
    if (typeof policy.evaluateForPermission === 'function') {
      return policy.evaluateForPermission(context, permission);
    }
    return policy.evaluate(context);
  }
}
