export { AuthTenant, type TenantType } from './auth-tenant.entity.js';
export { AuthUser } from './auth-user.entity.js';
export { AuthTenantUser, type TenantUserRole } from './auth-tenant-user.entity.js';
export { AuthSession } from './auth-session.entity.js';
export { AuditLog, type AuditChanges } from './audit-log.entity.js';

import { AuthTenant } from './auth-tenant.entity.js';
import { AuthUser } from './auth-user.entity.js';
import { AuthTenantUser } from './auth-tenant-user.entity.js';
import { AuthSession } from './auth-session.entity.js';
import { AuditLog } from './audit-log.entity.js';

export const systemEntities = [AuthTenant, AuthUser, AuthTenantUser, AuthSession, AuditLog] as const;
