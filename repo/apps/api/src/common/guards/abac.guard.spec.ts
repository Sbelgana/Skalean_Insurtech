/**
 * Tests AbacGuard -- Sprint 7 Tache 2.3.8.
 *
 * Couvre :
 *   - @AbacResource + @RequirePermission : load + evaluate
 *   - owner match / mismatch (OwnResourcesPolicy)
 *   - resource not found -> 404
 *   - super_admin_platform bypass
 *   - public route bypass
 *   - sans @AbacResource : bypass
 *   - id extractor manquant : ABAC_DENIED
 */

import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AbacService,
  AuthRole,
  Permission,
  RBAC_ERROR_CODES,
  TenantContextService,
  type TenantContext,
} from '@insurtech/auth';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import { ABAC_RESOURCE_KEY, REQUIRE_PERMISSIONS_KEY } from '../decorators/metadata-keys.js';
import type { AbacResourceMetadata } from '../decorators/abac-resource.decorator.js';
import type { PermissionRequirement } from '../decorators/require-permission.decorator.js';
import {
  ResourceLoaderService,
  type LoadedResource,
} from '../services/resource-loader.service.js';
import { AbacGuard } from './abac.guard.js';

function buildExecutionContext(params: Record<string, unknown> = { id: 'res-123' }): ExecutionContext {
  const handler = function h() {};
  const cls = class TestCtrl {};
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/test', params }),
    }),
  } as unknown as ExecutionContext;
}

function buildTenantContextService(
  role: AuthRole | undefined,
  userId: string = '00000000-0000-0000-0000-000000000001',
): TenantContextService {
  return {
    getCurrentContext: (): TenantContext | undefined =>
      role
        ? {
            tenantId: 'tnt-1',
            userId,
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

function buildLoaderService(resource?: LoadedResource): ResourceLoaderService {
  const svc = new ResourceLoaderService();
  svc.registerLoader('crm_contact', async () => resource);
  return svc;
}

describe('AbacGuard (Sprint 7 Tache 2.3.8)', () => {
  describe('bypass scenarios', () => {
    it('1. Public route : bypass', async () => {
      const guard = new AbacGuard(
        buildReflector({ [IS_PUBLIC_KEY]: true }),
        buildTenantContextService(AuthRole.BrokerUser),
        new AbacService(),
        buildLoaderService(),
      );
      expect(await guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('2. No @AbacResource : bypass', async () => {
      const guard = new AbacGuard(
        buildReflector({}),
        buildTenantContextService(AuthRole.BrokerUser),
        new AbacService(),
        buildLoaderService(),
      );
      expect(await guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('3. No @RequirePermission : bypass meme avec @AbacResource', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta }),
        buildTenantContextService(AuthRole.BrokerUser),
        new AbacService(),
        buildLoaderService(),
      );
      expect(await guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('4. super_admin_platform : bypass meme avec @AbacResource', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ_OWN],
        mode: 'all',
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(AuthRole.SuperAdminPlatform),
        new AbacService(),
        buildLoaderService(),
      );
      expect(await guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  describe('owner-based ABAC', () => {
    it('5. owner match : allowed=true', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ_OWN],
        mode: 'all',
      };
      const userId = '00000000-0000-0000-0000-000000000042';
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(AuthRole.BrokerUser, userId),
        new AbacService(),
        buildLoaderService({ id: 'res-123', ownerId: userId }),
      );
      expect(await guard.canActivate(buildExecutionContext())).toBe(true);
    });

    it('6. owner mismatch : 403 ABAC_DENIED', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ_OWN],
        mode: 'all',
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(
          AuthRole.BrokerUser,
          '00000000-0000-0000-0000-000000000042',
        ),
        new AbacService(),
        buildLoaderService({
          id: 'res-123',
          ownerId: '00000000-0000-0000-0000-000000000099',
        }),
      );
      await expect(guard.canActivate(buildExecutionContext())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('resource loading', () => {
    it('7. resource not found : 404', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ_OWN],
        mode: 'all',
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(AuthRole.BrokerUser),
        new AbacService(),
        buildLoaderService(undefined), // loader retourne undefined
      );
      await expect(guard.canActivate(buildExecutionContext())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('8. id extractor returns undefined : 403 ABAC_DENIED', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: () => undefined,
      };
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ_OWN],
        mode: 'all',
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(AuthRole.BrokerUser),
        new AbacService(),
        buildLoaderService({ id: 'r', ownerId: 'u' }),
      );
      try {
        await guard.canActivate(buildExecutionContext({}));
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(RBAC_ERROR_CODES.ABAC_DENIED);
      }
    });
  });

  describe('NO_POLICY_FOR_PERMISSION acceptance', () => {
    it('9. permission sans policy ABAC : laisse passer (RBAC seul)', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      // CRM_CONTACTS_CREATE n'a pas de policy ABAC -> NO_POLICY -> bypass.
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_CREATE],
        mode: 'all',
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(AuthRole.BrokerUser),
        new AbacService(),
        buildLoaderService({ id: 'r', ownerId: 'someone' }),
      );
      expect(await guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  describe('missing context', () => {
    it('10. ctx absent : 403 NO_USER_CONTEXT', async () => {
      const meta: AbacResourceMetadata = {
        resourceType: 'crm_contact',
        idExtractor: (req) => req.params?.['id'] as string,
      };
      const req: PermissionRequirement = {
        permissions: [Permission.CRM_CONTACTS_READ_OWN],
        mode: 'all',
      };
      const guard = new AbacGuard(
        buildReflector({ [ABAC_RESOURCE_KEY]: meta, [REQUIRE_PERMISSIONS_KEY]: req }),
        buildTenantContextService(undefined),
        new AbacService(),
        buildLoaderService(),
      );
      try {
        await guard.canActivate(buildExecutionContext());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = (err as ForbiddenException).getResponse() as { code?: string };
        expect(res.code).toBe(RBAC_ERROR_CODES.NO_USER_CONTEXT);
      }
    });
  });
});

describe('ResourceLoaderService (Sprint 7 Tache 2.3.8)', () => {
  it('11. registerLoader + load returns resource', async () => {
    const svc = new ResourceLoaderService();
    svc.registerLoader('crm_contact', async () => ({ id: 'x', ownerId: 'u' }));
    const r = await svc.load('crm_contact', 'x', 'tnt');
    expect(r?.id).toBe('x');
  });

  it('12. load returns undefined if no loader registered', async () => {
    const svc = new ResourceLoaderService();
    const r = await svc.load('crm_contact', 'x', 'tnt');
    expect(r).toBeUndefined();
  });

  it('13. cache hits avoid second loader call', async () => {
    const svc = new ResourceLoaderService();
    let callCount = 0;
    svc.registerLoader('crm_contact', async () => {
      callCount++;
      return { id: 'x', ownerId: 'u' };
    });
    await svc.load('crm_contact', 'x', 'tnt');
    await svc.load('crm_contact', 'x', 'tnt');
    expect(callCount).toBe(1);
  });

  it('14. invalidate forces re-fetch', async () => {
    const svc = new ResourceLoaderService();
    let callCount = 0;
    svc.registerLoader('crm_contact', async () => {
      callCount++;
      return { id: 'x' };
    });
    await svc.load('crm_contact', 'x', 'tnt');
    svc.invalidate('crm_contact', 'x', 'tnt');
    await svc.load('crm_contact', 'x', 'tnt');
    expect(callCount).toBe(2);
  });

  it('15. getRegisteredResourceTypes', () => {
    const svc = new ResourceLoaderService();
    svc.registerLoader('crm_contact', async () => undefined);
    svc.registerLoader('parts_order', async () => undefined);
    const types = svc.getRegisteredResourceTypes();
    expect(types).toContain('crm_contact');
    expect(types).toContain('parts_order');
  });
});
