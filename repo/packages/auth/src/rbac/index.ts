/**
 * Barrel export RBAC -- Sprint 7 Tache 2.3.1.
 */

export {
  Permission,
  type PermissionValue,
  ALL_PERMISSIONS,
  PermissionKeys,
} from './permissions.enum.js';

export {
  Module,
  type ModuleValue,
  ALL_MODULES,
  Action,
  type ActionValue,
  ALL_ACTIONS,
  type ParsedPermission,
  parsePermission,
  isValidPermission,
  formatPermission,
  getModuleFromPermission,
  getActionFromPermission,
  isOwnPermission,
} from './permission-helpers.js';

export {
  PermissionsByModule,
  getPermissionsByModule,
  getPermissionCountByModule,
  getActiveModules,
  getAllOwnPermissions,
  getAllReadPermissions,
} from './permissions-by-module.js';

export {
  RoleMetadata,
  ROLES_BY_LEVEL,
  type RoleLevel,
  type RoleMeta,
} from './role-metadata.js';

export {
  RBAC_WILDCARD,
  PERMISSION_NAMING_REGEX,
  ROLE_NAMING_REGEX,
  MAX_PERMISSIONS_PER_ROLE,
  DEFAULT_PERMISSION_TTL_SECONDS,
  DEFAULT_ABAC_TTL_SECONDS,
  REDIS_RBAC_PREFIX,
  RBAC_ERROR_CODES,
  type RbacErrorCode,
} from './rbac-constants.js';

export { validatePermissionsCatalog, type ValidationResult } from './permissions-validator.js';

// Sprint 7 Tache 2.3.2 -- PermissionsMatrix + RoleHierarchy
export {
  PermissionsMatrix,
  ALL_ROLES_IN_MATRIX,
  countDirectPermissions,
  getDirectPermissions,
  hasWildcardPermission,
  type PermissionsMatrixEntry,
  type PermissionsMatrixKeys,
} from './permissions-matrix.js';

export {
  RoleHierarchy,
  ALL_ROLES_IN_HIERARCHY,
  getDirectChildren,
  isTerminalRole,
} from './role-hierarchy.js';
// Note : isBrokerRole / isGarageRole / isPlatformRole deja exportes par
// @insurtech/auth/types/auth-roles (Sprint 5). Pas de re-export ici pour
// eviter duplicate barrel.

export {
  HierarchyResolver,
  RbacHierarchyCycleError,
  RbacHierarchyDepthError,
  DEFAULT_DEPTH_LIMIT,
  defaultHierarchyResolver,
  type EffectivePermissionsSet,
  type HierarchyResolverOptions,
} from './hierarchy-resolver.js';

export {
  validatePermissionsMatrix,
  type MatrixValidationResult,
} from './matrix-validator.js';

// Sprint 7 Tache 2.3.3 -- RbacService
export {
  RbacService,
  type RbacAccessResult,
  type RbacAbacContext,
} from './rbac.service.js';
