export {
  AuthTenant,
  type TenantType,
  type TenantStatus,
  type TenantSuspensionType,
} from './auth-tenant.entity.js';
export { AuthUser } from './auth-user.entity.js';
export { AuthTenantUser, type TenantUserRole } from './auth-tenant-user.entity.js';
export { AuthSession } from './auth-session.entity.js';
export { AuditLog, type AuditChanges } from './audit-log.entity.js';
export { ConsumerProcessedEvent } from './consumer-processed-event.entity.js';
export {
  ALL_CROSS_TENANT_AUTHORIZATION_TYPES,
  ALL_CROSS_TENANT_RESOURCE_TYPES,
  CrossTenantAuthorization,
  type CrossTenantAuthorizationType,
  type CrossTenantResourceType,
} from './cross-tenant-authorization.entity.js';

import { AuthTenant } from './auth-tenant.entity.js';
import { AuthUser } from './auth-user.entity.js';
import { AuthTenantUser } from './auth-tenant-user.entity.js';
import { AuthSession } from './auth-session.entity.js';
import { AuditLog } from './audit-log.entity.js';
import { ConsumerProcessedEvent } from './consumer-processed-event.entity.js';
import { CrossTenantAuthorization } from './cross-tenant-authorization.entity.js';

export const systemEntities = [
  AuthTenant,
  AuthUser,
  AuthTenantUser,
  AuthSession,
  AuditLog,
  ConsumerProcessedEvent,
  CrossTenantAuthorization,
] as const;
