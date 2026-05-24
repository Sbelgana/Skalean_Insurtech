/**
 * StatusBasedPolicy -- Sprint 7 Tache 2.3.7.
 *
 * Restreint actions selon le statut courant de la ressource.
 *
 * Regles initiales :
 *   - insure.policies.cancel : permis si status === 'active'
 *   - insure.policies.resiliate : permis si status === 'active'
 *   - insure.quotes.read (update implicite) : non sur 'signed' (read OK,
 *     mais update bloque) -- prep Sprint 15
 *   - books.invoices.update : permis si status === 'draft'
 *   - parts.orders.cancel_within_window : status IN ['pending', 'placed']
 *   - tow.missions.complete : status IN ['accepted', 'in_progress']
 *
 * Reference : B-07 Tache 2.3.7.
 */

import {
  Permission,
  type PermissionValue,
} from '../../rbac/permissions.enum.js';
import { type AbacContext, type AbacPolicy, type AbacResult } from '../types.js';

const ALLOWED_STATUSES: Partial<Record<PermissionValue, ReadonlySet<string>>> = {
  [Permission.INSURE_POLICIES_CANCEL]: new Set(['active']),
  [Permission.INSURE_POLICIES_RESILIATE]: new Set(['active']),
  [Permission.BOOKS_INVOICES_UPDATE]: new Set(['draft']),
  [Permission.PARTS_ORDERS_CANCEL]: new Set(['pending', 'placed']),
  [Permission.TOW_MISSIONS_COMPLETE]: new Set(['accepted', 'in_progress']),
  [Permission.EXPERTISE_VALIDATE_QUOTE]: new Set(['submitted', 'in_review']),
  [Permission.EXPERTISE_MODIFY_QUOTE]: new Set(['submitted', 'in_review']),
  [Permission.EXPERTISE_REJECT_QUOTE]: new Set(['submitted', 'in_review']),
};

export class StatusBasedPolicy implements AbacPolicy {
  readonly name = 'StatusBasedPolicy';

  applies(permission: PermissionValue): boolean {
    return permission in ALLOWED_STATUSES;
  }

  evaluate(context: AbacContext): AbacResult {
    return this.evaluateForPermission(context, undefined);
  }

  evaluateForPermission(context: AbacContext, permission?: PermissionValue): AbacResult {
    if (!permission || !(permission in ALLOWED_STATUSES)) {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const allowedSet = ALLOWED_STATUSES[permission];
    if (!allowedSet) {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const status = context.resourceStatus;
    if (!status) {
      return {
        allowed: false,
        reason: 'RESOURCE_NOT_FOUND',
        policy: this.name,
        permission,
      };
    }

    if (!allowedSet.has(status)) {
      return {
        allowed: false,
        reason: 'STATUS_DENIES_ACTION',
        policy: this.name,
        permission,
      };
    }

    return { allowed: true, policy: this.name, permission };
  }
}
