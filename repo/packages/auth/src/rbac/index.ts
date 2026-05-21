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
