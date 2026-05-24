/**
 * Constantes partagees RBAC Skalean InsurTech v2.2.
 *
 * Sprint 7 / Tache 2.3.1.
 */

/** Wildcard reserve super_admin_platform dans PermissionsMatrix (Tache 2.3.2). */
export const RBAC_WILDCARD = '*' as const;

/**
 * Regex stricte naming permissions : {module}.{resource}.{action}
 * Lettres minuscules + underscore, debute par lettre. Chiffres autorises apres
 * la 1ere lettre (ex : carrier.payment.approve_level1, v3.0 Sprint 7.5a).
 */
export const PERMISSION_NAMING_REGEX = /^[a-z][a-z_0-9]*\.[a-z][a-z_0-9]*\.[a-z][a-z_0-9]*$/;

/** Regex stricte naming roles : lettres minuscules + underscore. */
export const ROLE_NAMING_REGEX = /^[a-z][a-z_]*$/;

/** Limit max permissions par role pour eviter explosion combinatoire. */
export const MAX_PERMISSIONS_PER_ROLE = 100;

/** TTL cache permissions par role (secondes). Tache 2.3.10. */
export const DEFAULT_PERMISSION_TTL_SECONDS = 300; // 5 minutes

/** TTL cache resultats ABAC (secondes). Plus court car attributes resource changent. */
export const DEFAULT_ABAC_TTL_SECONDS = 60;

/** Prefix Redis namespace : rbac:effective:<role> -> Set<PermissionValue>. */
export const REDIS_RBAC_PREFIX = 'rbac:';

/** Codes erreur stables RBAC. Utilises par guards (Tache 2.3.4, 2.3.5, 2.3.8). */
export const RBAC_ERROR_CODES = {
  NO_USER_CONTEXT: 'NO_USER_CONTEXT',
  PERMISSION_NOT_GRANTED: 'PERMISSION_NOT_GRANTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ABAC_DENIED: 'ABAC_DENIED',
  ROLE_REQUIRED: 'ROLE_REQUIRED',
  MIN_ROLE_REQUIRED: 'MIN_ROLE_REQUIRED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  WORKFLOW_TRANSITION_INVALID: 'WORKFLOW_TRANSITION_INVALID',
  TIME_WINDOW_EXPIRED: 'TIME_WINDOW_EXPIRED',
  STATUS_DENIES_ACTION: 'STATUS_DENIES_ACTION',
} as const;

export type RbacErrorCode = (typeof RBAC_ERROR_CODES)[keyof typeof RBAC_ERROR_CODES];
