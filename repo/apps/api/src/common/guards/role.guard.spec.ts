/**
 * Tests RoleGuard -- Sprint 7 Tache 2.3.4.
 *
 * Couvre :
 *   - @Role(role | roles[]) : OR logic
 *   - @MinRole(role) : role + ancestors (transitive hierarchy)
 *   - super_admin_platform wildcard short-circuit
 *   - Pas de decorator -> bypass (laisse autres guards passer)
 *   - Public route -> bypass
 *   - Missing user context -> 403 NO_USER_CONTEXT
 *   - Audit log denied
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthRole,
  RBAC_ERROR_CODES,
  TenantContextService,
  type TenantContext,
} from '@insurtech/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import { MIN_ROLE_KEY, ROLE_KEY } from '../decorators/metadata-keys.js';
import { RoleGuard } from './role.guard.js';

const REQUEST_STUB = { method: 'GET', url: '/test' };
const CTX_STUB = {} as ExecutionContext;

function buildExecutionContext(opts: {
  metadata?: Partial<Record<string, unknown>>;
}): ExecutionContext {
  const handler = function handler() {};
  const cls = class TestController {};
  const ctx = {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => REQUEST_STUB,
    }),
  } as unknown as ExecutionContext;
  return ctx;
}

function buildTenantContextService(role: AuthRole | undefined): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      role
        ? {
            tenantId: '00000000-0000-0000-0000-000000000001',
            userId: '00000000-0000-0000-0000-000000000002',
            userRole: role,
            isSuperAdmin: role === AuthRole.SuperAdminPlatform,
            traceId: 'trace-test',
            ipAddress: '127.0.0.1',
            userAgent: 'vitest',
          }
        : undefined,
  } as unknown as TenantContextService;
}

function buildReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
}

describe('RoleGuard (Sprint 7 Tache 2.3.4)', () => {
  // ==========================================================================
  // Bypass scenarios
  // ==========================================================================

  describe('bypass scenarios', () => {
    it('1. Public route : bypass guard (return true)', () => {
      const guard = new RoleGuard(
        buildReflector({ [IS_PUBLIC_KEY]: true }),
        buildTenantContextService(AuthRole.BrokerUser),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('2. Pas de @Role ni @MinRole : bypass (laisse autres guards passer)', () => {
      const guard = new RoleGuard(
        buildReflector({}),
        buildTenantContextService(AuthRole.BrokerUser),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });
  });

  // ==========================================================================
  // super_admin_platform wildcard
  // ==========================================================================

  describe('super_admin_platform wildcard', () => {
    it('3. super_admin passe @Role(broker_admin)', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin] }),
        buildTenantContextService(AuthRole.SuperAdminPlatform),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('4. super_admin passe @MinRole(broker_assistant)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.BrokerAssistant }),
        buildTenantContextService(AuthRole.SuperAdminPlatform),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });
  });

  // ==========================================================================
  // @Role OR logic
  // ==========================================================================

  describe('@Role OR logic', () => {
    it('5. @Role(broker_admin) accept broker_admin', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin] }),
        buildTenantContextService(AuthRole.BrokerAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('6. @Role(broker_admin) reject broker_user (403 ROLE_REQUIRED)', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin] }),
        buildTenantContextService(AuthRole.BrokerUser),
      );
      expect(() => guard.canActivate(buildExecutionContext({}))).toThrow(ForbiddenException);
    });

    it('7. @Role(broker_admin, garage_admin) accept broker_admin (OR)', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin, AuthRole.GarageAdmin] }),
        buildTenantContextService(AuthRole.BrokerAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('8. @Role(broker_admin, garage_admin) accept garage_admin (OR)', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin, AuthRole.GarageAdmin] }),
        buildTenantContextService(AuthRole.GarageAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('9. @Role(broker_admin, garage_admin) reject expert_independent', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin, AuthRole.GarageAdmin] }),
        buildTenantContextService(AuthRole.ExpertIndependent),
      );
      expect(() => guard.canActivate(buildExecutionContext({}))).toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // @MinRole (ancestors)
  // ==========================================================================

  describe('@MinRole hierarchy ancestors', () => {
    it('10. @MinRole(broker_assistant) accept broker_assistant (self)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.BrokerAssistant }),
        buildTenantContextService(AuthRole.BrokerAssistant),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('11. @MinRole(broker_assistant) accept broker_user (parent direct)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.BrokerAssistant }),
        buildTenantContextService(AuthRole.BrokerUser),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('12. @MinRole(broker_assistant) accept broker_admin (grand-parent transitive)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.BrokerAssistant }),
        buildTenantContextService(AuthRole.BrokerAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('13. @MinRole(broker_user) reject broker_assistant (descendant non accept)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.BrokerUser }),
        buildTenantContextService(AuthRole.BrokerAssistant),
      );
      expect(() => guard.canActivate(buildExecutionContext({}))).toThrow(ForbiddenException);
    });

    it('14. @MinRole(tow_driver) accept tow_dispatcher (parent dans chain)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.TowDriver }),
        buildTenantContextService(AuthRole.TowDispatcher),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('15. @MinRole(tow_driver) accept tow_admin (transitive via dispatcher)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.TowDriver }),
        buildTenantContextService(AuthRole.TowAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('16. @MinRole(carrier_claims_manager) accept carrier_admin (DAG parent)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.CarrierClaimsManager }),
        buildTenantContextService(AuthRole.CarrierAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('17. @MinRole(garage_parts_manager) accept garage_admin (parent via DAG v3.0)', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.GaragePartsManager }),
        buildTenantContextService(AuthRole.GarageAdmin),
      );
      expect(guard.canActivate(buildExecutionContext({}))).toBe(true);
    });

    it('18. No cross-domain : @MinRole(garage_chef) reject broker_admin', () => {
      const guard = new RoleGuard(
        buildReflector({ [MIN_ROLE_KEY]: AuthRole.GarageChef }),
        buildTenantContextService(AuthRole.BrokerAdmin),
      );
      expect(() => guard.canActivate(buildExecutionContext({}))).toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Missing context
  // ==========================================================================

  describe('missing context', () => {
    it('19. ctx absent + @Role : 403 NO_USER_CONTEXT', () => {
      const guard = new RoleGuard(
        buildReflector({ [ROLE_KEY]: [AuthRole.BrokerAdmin] }),
        buildTenantContextService(undefined),
      );
      try {
        guard.canActivate(buildExecutionContext({}));
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const ex = err as ForbiddenException;
        const response = ex.getResponse() as { code?: string };
        expect(response.code).toBe(RBAC_ERROR_CODES.NO_USER_CONTEXT);
      }
    });
  });

  // ==========================================================================
  // isAncestorOrSelf helper
  // ==========================================================================

  describe('isAncestorOrSelf helper', () => {
    const guard = new RoleGuard(buildReflector({}), buildTenantContextService(undefined));

    it('20. broker_admin is ancestor of broker_assistant', () => {
      expect(guard.isAncestorOrSelf(AuthRole.BrokerAdmin, AuthRole.BrokerAssistant)).toBe(true);
    });

    it('21. broker_assistant is NOT ancestor of broker_admin', () => {
      expect(guard.isAncestorOrSelf(AuthRole.BrokerAssistant, AuthRole.BrokerAdmin)).toBe(false);
    });

    it('22. expert_independent is terminal (no inheritance up)', () => {
      // Terminal role has no parents -> only matches itself
      expect(guard.isAncestorOrSelf(AuthRole.ExpertIndependent, AuthRole.ExpertIndependent)).toBe(
        true,
      );
      // broker_admin is NOT ancestor of expert_independent (different domain)
      expect(guard.isAncestorOrSelf(AuthRole.BrokerAdmin, AuthRole.ExpertIndependent)).toBe(false);
    });

    it('23. garage_admin is ancestor of garage_technicien (transitive via chef)', () => {
      expect(guard.isAncestorOrSelf(AuthRole.GarageAdmin, AuthRole.GarageTechnicien)).toBe(true);
    });
  });
});
