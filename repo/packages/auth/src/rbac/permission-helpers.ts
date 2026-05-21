/**
 * Helpers parsing + format permissions RBAC.
 *
 * Sprint 7 / Tache 2.3.1.
 */

import { ALL_PERMISSIONS, type PermissionValue } from './permissions.enum.js';
import { PERMISSION_NAMING_REGEX, RBAC_WILDCARD } from './rbac-constants.js';

/** 20 modules supportes. */
export const Module = {
  AUTH: 'auth',
  TENANT: 'tenant',
  CRM: 'crm',
  BOOKING: 'booking',
  COMM: 'comm',
  DOCS: 'docs',
  SIGNATURE: 'signature',
  PAY: 'pay',
  BOOKS: 'books',
  COMPLIANCE: 'compliance',
  ANALYTICS: 'analytics',
  INSURE: 'insure',
  REPAIR: 'repair',
  STOCK: 'stock',
  HR: 'hr',
  ADMIN: 'admin',
  CROSS_TENANT: 'cross_tenant',
  SKY: 'sky',
  MCP: 'mcp',
  PUBLIC: 'public',
} as const;

export type ModuleValue = (typeof Module)[keyof typeof Module];
export const ALL_MODULES: readonly ModuleValue[] = Object.freeze(Object.values(Module));

/** Actions standards. */
export const Action = {
  READ: 'read',
  READ_OWN: 'read_own',
  READ_ALL: 'read_all',
  READ_ASSIGNED: 'read_assigned',
  CREATE: 'create',
  CREATE_OWN: 'create_own',
  UPDATE: 'update',
  UPDATE_OWN: 'update_own',
  DELETE: 'delete',
  ASSIGN: 'assign',
  APPROVE: 'approve',
  REJECT: 'reject',
  EXPORT: 'export',
  GENERATE: 'generate',
  CANCEL: 'cancel',
  RESILIATE: 'resiliate',
  SUSPEND: 'suspend',
  REFUND: 'refund',
  RECONCILE: 'reconcile',
  MANAGE: 'manage',
  USE: 'use',
  SEND: 'send',
  SYNC: 'sync',
  UPLOAD: 'upload',
  CONFIG: 'config',
  EXECUTE: 'execute',
  REVIEW: 'review',
  IMPERSONATE: 'impersonate',
  HEALTH: 'health',
  PURGE: 'purge',
  LIST: 'list',
  LIST_ALL: 'list_all',
  INVITE: 'invite',
  INVOKE: 'invoke',
  DISCOVER: 'discover',
  AUTHENTICATE: 'authenticate',
  RECEIVE: 'receive',
  VISIT: 'visit',
  START: 'start',
  COMPLETE: 'complete',
  CLOSE: 'close',
  SUBMIT: 'submit',
  PROCESS: 'process',
  USER: 'user',
} as const;

export type ActionValue = (typeof Action)[keyof typeof Action];
export const ALL_ACTIONS: readonly ActionValue[] = Object.freeze(Object.values(Action));

export interface ParsedPermission {
  readonly module: string;
  readonly resource: string;
  readonly action: string;
  readonly raw: string;
}

/**
 * Parse permission string en 3 composants.
 * @throws Error si format invalide.
 */
export function parsePermission(permission: string): ParsedPermission {
  if (!PERMISSION_NAMING_REGEX.test(permission)) {
    throw new Error(`Invalid permission naming format: '${permission}'`);
  }
  const parts = permission.split('.');
  return {
    module: parts[0]!,
    resource: parts[1]!,
    action: parts[2]!,
    raw: permission,
  };
}

/**
 * Type guard runtime : verifie que value est une PermissionValue du catalog.
 * Refuse explicitement le wildcard.
 */
export function isValidPermission(value: unknown): value is PermissionValue {
  if (typeof value !== 'string') return false;
  if (value === RBAC_WILDCARD) return false;
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Construit permission string a partir des 3 composants. Echoue si pas dans catalog.
 */
export function formatPermission(
  module: ModuleValue,
  resource: string,
  action: ActionValue,
): PermissionValue {
  const candidate = `${module}.${resource}.${action}`;
  if (!isValidPermission(candidate)) {
    throw new Error(`Permission '${candidate}' does not exist in catalog`);
  }
  return candidate;
}

export function getModuleFromPermission(permission: PermissionValue): string {
  return parsePermission(permission).module;
}

export function getActionFromPermission(permission: PermissionValue): string {
  return parsePermission(permission).action;
}

/**
 * Detecte si permission cible 'own' (ABAC owner filter).
 * Utilise par RbacService Tache 2.3.3.
 */
export function isOwnPermission(permission: PermissionValue): boolean {
  const action = getActionFromPermission(permission);
  return action.endsWith('_own') || action === 'read_assigned';
}
