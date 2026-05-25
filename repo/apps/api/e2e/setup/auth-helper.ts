/**
 * Auth helper -- Sprint 8 Task 8.14b Session B.
 *
 * Generates signed JWT access tokens for E2E tests. Bypasses the
 * production sign-in flow (Sprint 5 AuthService) since E2E tests assume
 * authenticated state and focus on downstream module logic (CRM /
 * Booking / etc.).
 *
 * Two-stage usage :
 *
 *   1. From the TestApp factory : `JwtService` is resolved via
 *      `ctx.app.get(JwtService)`.
 *   2. Build a token via one of the role-specific helpers below, pass it
 *      as `Authorization: Bearer <token>` AND set the `x-tenant-id`
 *      header to match the JWT's `tenant_id` claim (the
 *      TenantContextMiddleware enforces coherence).
 *
 * Example :
 *
 *   const jwt = ctx.app.get(JwtService);
 *   const token = createBrokerAdminToken(jwt, 'broker-casa-001');
 *
 *   await ctx.app.inject({
 *     method: 'POST',
 *     url: '/api/v1/crm/companies',
 *     headers: {
 *       Authorization: `Bearer ${token}`,
 *       'x-tenant-id': 'broker-casa-001',
 *     },
 *     payload: { ... },
 *   });
 */

import { randomUUID } from 'node:crypto';
import { AuthRole, type JwtService } from '@insurtech/auth';

export interface TestUserOpts {
  /** UUID. Defaults to a stable per-tenant pattern (`{tenantId}-admin`). */
  readonly userId?: string;
  /** Email. Defaults to `admin@{tenantId}.test`. */
  readonly email?: string;
  /** Override MFA flag. Default true (skip MFA challenges). */
  readonly mfaVerified?: boolean;
}

/**
 * Builds a signed access token with the given role + tenant. The token
 * passes the production guards (JwtAuthGuard reads sub/role/tenant_id,
 * PermissionGuard reads role via HierarchyResolver).
 */
export function signTestToken(
  jwt: JwtService,
  opts: {
    role: AuthRole;
    tenantId: string | null;
    userId?: string;
    email?: string;
    mfaVerified?: boolean;
  },
): string {
  const userId = opts.userId ?? randomUUID();
  const email = opts.email ?? `${opts.role}-${userId}@assurflow.test`;
  // signAccessToken returns a branded `SignedJwt` -- runtime it IS the JWT
  // string (jose's `jwt.sign(...)` output). Coerce explicitly.
  const signed = jwt.signAccessToken({
    sub: userId,
    tenant_id: opts.tenantId,
    email,
    role: opts.role,
    mfa_verified: opts.mfaVerified ?? true,
    sid: randomUUID(),
  });
  return signed as unknown as string;
}

// ===========================================================================
// Role-specific shortcuts (pre-wired to seeded tenants Maroc when applicable)
// ===========================================================================

/**
 * Token for a broker_admin in the given tenant. By default targets
 * `broker-casa-001` (Atlas Broker Casablanca seed).
 */
export function createBrokerAdminToken(
  jwt: JwtService,
  tenantId: string = 'broker-casa-001',
  opts: TestUserOpts = {},
): string {
  return signTestToken(jwt, {
    role: AuthRole.BrokerAdmin,
    tenantId,
    userId: opts.userId ?? `${tenantId}-admin`,
    email: opts.email ?? `admin@${tenantId}.test`,
    mfaVerified: opts.mfaVerified,
  });
}

/** Token for a broker_user (limited perms, no OVERRIDE_WORKFLOW). */
export function createBrokerUserToken(
  jwt: JwtService,
  tenantId: string = 'broker-casa-001',
  opts: TestUserOpts = {},
): string {
  return signTestToken(jwt, {
    role: AuthRole.BrokerUser,
    tenantId,
    userId: opts.userId ?? `${tenantId}-user`,
    email: opts.email ?? `user@${tenantId}.test`,
    mfaVerified: opts.mfaVerified,
  });
}

/** Token for a broker_assistant. */
export function createBrokerAssistantToken(
  jwt: JwtService,
  tenantId: string = 'broker-casa-001',
  opts: TestUserOpts = {},
): string {
  return signTestToken(jwt, {
    role: AuthRole.BrokerAssistant,
    tenantId,
    userId: opts.userId ?? `${tenantId}-assistant`,
    email: opts.email ?? `assistant@${tenantId}.test`,
    mfaVerified: opts.mfaVerified,
  });
}

/**
 * Token for super_admin_platform. No tenant_id (platform-level).
 * Bypasses all permission checks via HierarchyResolver wildcard.
 */
export function createSuperAdminToken(
  jwt: JwtService,
  opts: TestUserOpts = {},
): string {
  return signTestToken(jwt, {
    role: AuthRole.SuperAdminPlatform,
    tenantId: null,
    userId: opts.userId ?? 'platform-super-admin',
    email: opts.email ?? 'superadmin@assurflow.test',
    mfaVerified: opts.mfaVerified,
  });
}
