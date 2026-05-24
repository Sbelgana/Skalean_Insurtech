/**
 * @insurtech/auth/types
 *
 * Barrel selectif des types publics. Aucun export *.
 */

export type {
  AuthenticatedUser,
  AuthenticatedService,
  AnonymousSubject,
  AuthSubject,
  AuthSubjectKind,
  AuthContext,
} from './auth-context.js';
export { isUserSubject, isServiceSubject, isAnonymousSubject } from './auth-context.js';

export type { JwtPayload, RefreshTokenPayload, ServiceJwtPayload, AnyJwtPayload } from './jwt-payload.js';
export { isServiceJwtPayload, isUserJwtPayload, nowInSeconds, expirySeconds, isExpired } from './jwt-payload.js';

export {
  AuthRole,
  isPlatformRole,
  isTenantRole,
  isBrokerRole,
  isGarageRole,
  isCarrierRole,
  isExpertRole,
  isTowRole,
  isAssureRole,
  isProspectRole,
  getRoleHierarchy,
  isMfaMandatory,
  prefersWebAuthn,
  ALL_AUTH_ROLES,
} from './auth-roles.js';

export { AuthEventKind } from './auth-events.js';
export type { AuthEventEnvelope, AuthEventPayloadMap, TypedAuthEvent } from './auth-events.js';

export type { SessionContext, SessionLookupResult } from './session-context.js';

export type { LockoutSnapshot, LockoutDecision, LockoutTier } from './lockout.js';
export { getLockoutDurationMs } from './lockout.js';

export type {
  TenantContext,
  TenantContextInit,
  TenantContextUpdate,
  TenantSettings,
} from './tenant-context.type.js';
