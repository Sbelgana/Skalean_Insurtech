/**
 * Tests PermissionGuard -- Sprint 7 Tache 2.3.5.
 *
 * Couvre :
 *   - @RequirePermission single
 *   - @RequireAnyPermission OR logic
 *   - @RequireAllPermissions AND logic
 *   - super_admin_platform wildcard short-circuit
 *   - Public route bypass
 *   - No decorator bypass
 *   - Missing user context (NO_USER_CONTEXT)
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthRole,
  HierarchyResolver,
  Permission,
  RBAC_ERROR_CODES,
  RbacService,
  TenantContextService,
  type TenantContext,
} from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/metadata-keys.js';
import type { PermissionRequirement } from '../decorators/require-permission.decorator.js';
import { PermissionGuard } from './permission.guard.js';

function buildExecutionContext(): ExecutionContext {
  const handler = function h() {};
  const cls = class TestController {};
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', url: '/test' }),
    }),
  } as unknown as ExecutionContext;
}

function buildTenantContextService(role: AuthRole | undefined): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      role
        ? {
            tenantId: 'tnt',
            userId: 'usr',
            userRole: role,
            isSuperAdmin: role === AuthRole.SuperAdminPlatform,
            traceId: 'trc',
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

function buildGuard(metadata: Record<string, unknown>, role: AuthRole | undefined): PermissionGuard {
  const rbac = new RbacService(new HierarchyResolver());
  return new PermissionGuard(buildReflector(metadata), buildTenantContextService(role), rbac);
}

describe('PermissionGuard (Sprint 7 Tache 2.3.5)', () => {
  describe('bypass scenarios', () => {
    it('1. Public route : bypass', () => {
      const guard = buildGuard({ [IS_PUBLIC_KEY]: true }, AuthRole.BrokerUser);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('2. No @RequirePermission* : bypass', () => {
      const guard = buildGuard({}, AuthRole.BrokerUser);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('3. Empty permissions list : bypass', () => {
      const req: PermissionRequirement = { permissions: [], mode: 'all' };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerUser);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  describe('@RequirePermission single', () => {
    it('4. broker_admin accept CRM_CONTACTS_CREATE', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_CREATE],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerAdmin);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('5. broker_user reject CRM_CONTACTS_DELETE (403 PERMISSION_NOT_GRANTED)', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_DELETE],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerUser);
      try {
        guard.canActivate(buildExecutionContext());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED);
      }
    });

    it('6. super_admin_platform accept ANY permission (wildcard)', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.COMPLIANCE_CNDP_PURGE_EXECUTE],
        mode: 'all',
      };
      const guard = buildGuard(
        { [REQUIRE_PERMISSIONS_KEY]: req },
        AuthRole.SuperAdminPlatform,
      );
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  describe('@RequireAnyPermission OR logic', () => {
    it('7. accept si AU MOINS une accordee', () => {
      const req: PermissionRequirement = {
        permissions: [
          Permission.CRM_CONTACTS_DELETE, // not granted
          Permission.CRM_DEALS_CREATE, // granted
          Permission.INSURE_POLICIES_RESILIATE, // not granted
        ],
        mode: 'any',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerUser);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('8. reject si AUCUNE accordee', () => {
      const req: PermissionRequirement = {
        permissions: [
          Permission.INSURE_POLICIES_RESILIATE,
          Permission.BOOKS_SAFTMA_EXPORT,
        ],
        mode: 'any',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerAssistant);
      expect(() => guard.canActivate(buildExecutionContext())).toThrow(ForbiddenException);
    });
  });

  describe('@RequireAllPermissions AND logic', () => {
    it('9. accept si TOUTES accordees', () => {
      const req: PermissionRequirement = {
        permissions: [
          Permission.CRM_CONTACTS_CREATE,
          Permission.CRM_CONTACTS_UPDATE,
          Permission.CRM_CONTACTS_DELETE,
        ],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerAdmin);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('10. reject si UNE SEULE manque', () => {
      const req: PermissionRequirement = {
        permissions: [
          Permission.CRM_CONTACTS_CREATE, // granted
          Permission.CRM_CONTACTS_DELETE, // not granted -> blocker
        ],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.BrokerUser);
      expect(() => guard.canActivate(buildExecutionContext())).toThrow(ForbiddenException);
    });
  });

  describe('v3.0 ecosystem permissions', () => {
    it('11. carrier_finance accept PAYMENT_APPROVE_L4 (direct perm)', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.CARRIER_PAYMENT_APPROVE_L4],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.CarrierFinance);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('12. expert_associate reject EXPERTISE_HONORAIRES_INVOICE (firm_admin handles)', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.EXPERTISE_HONORAIRES_INVOICE],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.ExpertAssociate);
      expect(() => guard.canActivate(buildExecutionContext())).toThrow(ForbiddenException);
    });

    it('13. garage_admin inherit PARTS_ORDERS_CREATE (via DAG v3.0)', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.PARTS_ORDERS_CREATE],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.GarageAdmin);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('14. tow_admin inherit TOW_VEHICLE_PHOTOS_UPLOAD (chain via dispatcher/driver)', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.TOW_VEHICLE_PHOTOS_UPLOAD],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, AuthRole.TowAdmin);
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  describe('missing context', () => {
    it('15. ctx absent + decorator : 403 NO_USER_CONTEXT', () => {
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ],
        mode: 'all',
      };
      const guard = buildGuard({ [REQUIRE_PERMISSIONS_KEY]: req }, undefined);
      try {
        guard.canActivate(buildExecutionContext());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(RBAC_ERROR_CODES.NO_USER_CONTEXT);
      }
    });
  });
});
