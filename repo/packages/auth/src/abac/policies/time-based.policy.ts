/**
 * TimeBasedPolicy -- Sprint 7 Tache 2.3.7.
 *
 * Applique aux permissions soumises a delais legaux MA (loi 17-99 article 9
 * droit retract 30j B2C, loi 9-88 cloture exercice CGNC, etc.).
 *
 * Catalog initial Sprint 7 :
 *   - pay.refunds.create : permis si transaction.created_at > NOW() - 30 jours
 *   - parts.orders.cancel_within_window : permis si order.created_at > NOW() - 24h (decision-014)
 *   - tow.missions.complete : permis si mission.created_at > NOW() - 7 jours
 *
 * Extensible Sprint 15+ (cancellation_legal_basis loi 17-99).
 *
 * Reference : B-07 Tache 2.3.7.
 */

import {
  Permission,
  type PermissionValue,
} from '../../rbac/permissions.enum.js';
import { type AbacContext, type AbacPolicy, type AbacResult } from '../types.js';

/** Fenetre maximale autorisee par permission (en millisecondes). */
const TIME_WINDOWS_MS: Partial<Record<PermissionValue, number>> = {
  [Permission.PAY_REFUNDS_CREATE]: 30 * 24 * 60 * 60 * 1000, // 30j loi 17-99
  [Permission.PARTS_ORDERS_CANCEL]: 24 * 60 * 60 * 1000, // 24h decision-014
  [Permission.TOW_MISSIONS_COMPLETE]: 7 * 24 * 60 * 60 * 1000, // 7j tow workflow
};

export class TimeBasedPolicy implements AbacPolicy {
  readonly name = 'TimeBasedPolicy';

  applies(permission: PermissionValue): boolean {
    return permission in TIME_WINDOWS_MS;
  }

  evaluate(context: AbacContext): AbacResult {
    return this.evaluateForPermission(context, undefined);
  }

  evaluateForPermission(context: AbacContext, permission?: PermissionValue): AbacResult {
    if (!permission || !(permission in TIME_WINDOWS_MS)) {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const window = TIME_WINDOWS_MS[permission];
    if (window === undefined) {
      return {
        allowed: false,
        reason: 'POLICY_NOT_APPLICABLE',
        policy: this.name,
        permission,
      };
    }

    const createdAt = context.resourceCreatedAt;
    if (!createdAt) {
      return {
        allowed: false,
        reason: 'RESOURCE_NOT_FOUND',
        policy: this.name,
        permission,
      };
    }

    const now = context.now ?? new Date();
    const elapsed = now.getTime() - createdAt.getTime();

    if (elapsed < 0) {
      // Resource cree dans le futur : invalide
      return {
        allowed: false,
        reason: 'TIME_WINDOW_EXPIRED',
        policy: this.name,
        permission,
      };
    }

    if (elapsed > window) {
      return {
        allowed: false,
        reason: 'TIME_WINDOW_EXPIRED',
        policy: this.name,
        permission,
      };
    }

    return { allowed: true, policy: this.name, permission };
  }

  /** Expose le window pour tests / dashboards admin. */
  getWindowMs(permission: PermissionValue): number | undefined {
    return TIME_WINDOWS_MS[permission];
  }
}
