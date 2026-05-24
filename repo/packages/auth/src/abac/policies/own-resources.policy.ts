/**
 * OwnResourcesPolicy -- Sprint 7 Tache 2.3.7.
 *
 * Applique aux permissions suffix `_own` ou `_assigned` :
 *   - `crm.contacts.read_own` : owner_id === userId
 *   - `repair.sinistres.read_assigned` : assignee_id === userId
 *   - `pay.transactions.read_own` : owner_id === userId
 *   - tous les *_own / *_assigned du catalog (cf isOwnPermission helper)
 *
 * Logic :
 *   - Si action endsWith '_own' : verify ctx.resourceOwnerId === ctx.userId
 *   - Si action endsWith '_assigned' : verify ctx.resourceAssigneeId === ctx.userId
 *   - Sinon : POLICY_NOT_APPLICABLE (autre policy doit gerer)
 *
 * Reference : B-07 Tache 2.3.7.
 */

import {
  getActionFromPermission,
  isOwnPermission,
} from '../../rbac/permission-helpers.js';
import type { PermissionValue } from '../../rbac/permissions.enum.js';
import { type AbacContext, type AbacPolicy, type AbacResult } from '../types.js';

export class OwnResourcesPolicy implements AbacPolicy {
  readonly name = 'OwnResourcesPolicy';

  applies(permission: PermissionValue): boolean {
    return isOwnPermission(permission);
  }

  evaluate(context: AbacContext): AbacResult {
    return this.evaluateForPermission(context, undefined);
  }

  evaluateForPermission(context: AbacContext, permission?: PermissionValue): AbacResult {
    if (!permission) {
      // Heuristique : sans permission, on regarde owner_id / assignee_id presence.
      if (context.resourceOwnerId !== undefined) {
        return this.checkOwner(context, permission);
      }
      if (context.resourceAssigneeId !== undefined) {
        return this.checkAssignee(context, permission);
      }
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const action = getActionFromPermission(permission);
    if (action.endsWith('_own')) {
      return this.checkOwner(context, permission);
    }
    if (action === 'read_assigned') {
      return this.checkAssignee(context, permission);
    }

    return {
      allowed: false,
      reason: 'POLICY_NOT_APPLICABLE',
      policy: this.name,
      permission,
    };
  }

  private checkOwner(context: AbacContext, permission?: PermissionValue): AbacResult {
    if (!context.resourceOwnerId) {
      return {
        allowed: false,
        reason: 'RESOURCE_NOT_FOUND',
        policy: this.name,
        permission,
        ...(context.resourceType ? { resourceType: context.resourceType } : {}),
        ...(context.resourceId ? { resourceId: context.resourceId } : {}),
      };
    }
    if (context.resourceOwnerId === context.userId) {
      return {
        allowed: true,
        policy: this.name,
        permission,
        ...(context.resourceType ? { resourceType: context.resourceType } : {}),
        ...(context.resourceId ? { resourceId: context.resourceId } : {}),
      };
    }
    return {
      allowed: false,
      reason: 'OWNER_MISMATCH',
      policy: this.name,
      permission,
      ...(context.resourceType ? { resourceType: context.resourceType } : {}),
      ...(context.resourceId ? { resourceId: context.resourceId } : {}),
    };
  }

  private checkAssignee(context: AbacContext, permission?: PermissionValue): AbacResult {
    if (!context.resourceAssigneeId) {
      return {
        allowed: false,
        reason: 'NOT_ASSIGNED',
        policy: this.name,
        permission,
      };
    }
    if (context.resourceAssigneeId === context.userId) {
      return { allowed: true, policy: this.name, permission };
    }
    return {
      allowed: false,
      reason: 'NOT_ASSIGNED',
      policy: this.name,
      permission,
    };
  }
}
