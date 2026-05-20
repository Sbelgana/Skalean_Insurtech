/**
 * @insurtech/auth/types/auth-context
 *
 * Runtime authentication context exposed to controllers and services.
 * Built by Sprint 5 Tache 2.1.6 JwtStrategy.validate() from a verified JwtPayload.
 * Consumed by Sprint 6 TenantContextService and Sprint 7 RbacService.
 */

import type { AuthRole } from './auth-roles.js';

/** Discriminator for the authenticated subject kind. */
export type AuthSubjectKind = 'user' | 'service' | 'anonymous';

/**
 * Minimal user shape derived from the JWT and DB lookup at request boundary.
 * Does NOT contain password_hash, mfa_secret, recovery_codes, or any sensitive field.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AuthRole;
  display_name: string;
  tenant_id: string | null;
  mfa_enabled: boolean;
  mfa_verified: boolean;
  email_verified: boolean;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: string;
}

/** Context for service-to-service calls (Sprint 31). */
export interface AuthenticatedService {
  id: string;
  service: 'sky' | 'mcp' | 'comm-worker' | 'sched-worker';
  tenant_id: string | null;
  scopes: readonly string[];
}

/** Context for anonymous (public endpoints). */
export interface AnonymousSubject {
  kind: 'anonymous';
}

/** Polymorphic subject embedded in the request context. */
export type AuthSubject =
  | { kind: 'user'; user: AuthenticatedUser; session_id: string; jwt_id: string }
  | { kind: 'service'; service: AuthenticatedService; jwt_id: string }
  | AnonymousSubject;

/**
 * Top-level auth context attached to NestJS Request via JwtStrategy.
 * Accessible from controllers via @CurrentAuth() decorator (Sprint 5 Tache 2.1.6).
 */
export interface AuthContext {
  subject: AuthSubject;
  ip: string;
  user_agent: string;
  request_id: string;
  authenticated_at: number;
}

/** Type guard: is the subject an authenticated user? */
export function isUserSubject(
  s: AuthSubject,
): s is { kind: 'user'; user: AuthenticatedUser; session_id: string; jwt_id: string } {
  return s.kind === 'user';
}

/** Type guard: is the subject a service? */
export function isServiceSubject(
  s: AuthSubject,
): s is { kind: 'service'; service: AuthenticatedService; jwt_id: string } {
  return s.kind === 'service';
}

/** Type guard: anonymous? */
export function isAnonymousSubject(s: AuthSubject): s is AnonymousSubject {
  return s.kind === 'anonymous';
}
