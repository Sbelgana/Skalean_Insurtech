/**
 * Tests unitaires SuperAdminGuard.
 *
 * Reference : Sprint 6 / Tache 2.2.10.
 */

import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthRole,
  TenantContextService,
  buildMockTenantContext,
  withTenantContext,
} from '@insurtech/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import {
  ADMIN_ONLY_KEY,
  SUPER_ADMIN_ONLY_KEY,
  SUPER_ADMIN_WRITE_KEY,
} from '../decorators/metadata-keys.js';
import { SuperAdminGuard } from './super-admin.guard.js';

const buildCtx = (overrides: { method?: string; url?: string; ip?: string; ua?: string } = {}): ExecutionContext => {
  const handler = function fakeHandler(): void {};
  const klass = class FakeController {};
  Object.defineProperty(handler, 'name', { value: 'fakeHandler' });
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({
        method: overrides.method ?? 'GET',
        url: overrides.url ?? '/api/v1/admin/tenants',
        ip: overrides.ip ?? '127.0.0.1',
        headers: { 'user-agent': overrides.ua ?? 'vitest' },
      }),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
};

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;
  let reflector: Reflector;
  let tenantContext: TenantContextService;

  beforeEach(() => {
    reflector = new Reflector();
    tenantContext = new TenantContextService();
    guard = new SuperAdminGuard(reflector, tenantContext);
  });

  // ==========================================================================
  // SKIP cases
  // ==========================================================================

  describe('skip cases', () => {
    it('1. @Public skips all checks', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === IS_PUBLIC_KEY ? true : undefined,
      );
      expect(guard.canActivate(buildCtx())).toBe(true);
    });

    it('2. skip when neither @AdminOnly nor @SuperAdminOnly present', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      expect(guard.canActivate(buildCtx())).toBe(true);
    });
  });

  // ==========================================================================
  // BASIC : isSuperAdmin + tenantId platform
  // ==========================================================================

  describe('platform-level checks', () => {
    it('3. rejects when no context (ctx undefined)', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      try {
        guard.canActivate(buildCtx());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('SUPER_ADMIN_ACCESS_DENIED');
      }
    });

    it('4. rejects when isSuperAdmin false', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({ isSuperAdmin: false, userRole: AuthRole.BrokerAdmin }),
        () => {
          expect(() => guard.canActivate(buildCtx())).toThrow(ForbiddenException);
        },
      );
    });

    it('5. rejects with PLATFORM_LEVEL_REQUIRED when tenantId present (anti-escalade)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          isSuperAdmin: true,
          userRole: AuthRole.SuperAdminPlatform,
        }),
        () => {
          try {
            guard.canActivate(buildCtx());
            expect.fail('should have thrown');
          } catch (err) {
            const response = (err as ForbiddenException).getResponse() as { code: string };
            expect(response.code).toBe('SUPER_ADMIN_PLATFORM_LEVEL_REQUIRED');
          }
        },
      );
    });

    it('6. rejects with PLATFORM_ROLE_REQUIRED when role is not platform', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.BrokerAdmin,
        }),
        () => {
          try {
            guard.canActivate(buildCtx());
            expect.fail('should have thrown');
          } catch (err) {
            const response = (err as ForbiddenException).getResponse() as { code: string };
            expect(response.code).toBe('SUPER_ADMIN_PLATFORM_ROLE_REQUIRED');
          }
        },
      );
    });
  });

  // ==========================================================================
  // SUPER ADMIN PLATFORM (full access)
  // ==========================================================================

  describe('super_admin_platform full access', () => {
    it('7. allow GET', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.SuperAdminPlatform,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'GET' }))).toBe(true);
        },
      );
    });

    it('8. allow POST', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.SuperAdminPlatform,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'POST' }))).toBe(true);
        },
      );
    });

    it('9. allow DELETE', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.SuperAdminPlatform,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'DELETE' }))).toBe(true);
        },
      );
    });
  });

  // ==========================================================================
  // ANALYST SUPPORT (read-only)
  // ==========================================================================

  describe('analyst_support read-only', () => {
    it('10. allow GET for analyst_support', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'GET' }))).toBe(true);
        },
      );
    });

    it('11. allow HEAD for analyst_support', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'HEAD' }))).toBe(true);
        },
      );
    });

    it('12. reject POST for analyst_support with ANALYST_READ_ONLY', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          try {
            guard.canActivate(buildCtx({ method: 'POST' }));
            expect.fail('should have thrown');
          } catch (err) {
            const response = (err as ForbiddenException).getResponse() as { code: string };
            expect(response.code).toBe('ANALYST_READ_ONLY');
          }
        },
      );
    });

    it('13. reject DELETE for analyst_support', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          expect(() => guard.canActivate(buildCtx({ method: 'DELETE' }))).toThrow(
            ForbiddenException,
          );
        },
      );
    });

    it('14. reject PATCH for analyst_support', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          expect(() => guard.canActivate(buildCtx({ method: 'PATCH' }))).toThrow(
            ForbiddenException,
          );
        },
      );
    });
  });

  // ==========================================================================
  // @SuperAdminWrite enforcement
  // ==========================================================================

  describe('@SuperAdminWrite', () => {
    it('15. allow super_admin_platform on GET with @SuperAdminWrite', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SUPER_ADMIN_ONLY_KEY) return true;
        if (key === SUPER_ADMIN_WRITE_KEY) return true;
        return undefined;
      });
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.SuperAdminPlatform,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'GET' }))).toBe(true);
        },
      );
    });

    it('16. reject analyst_support on GET with @SuperAdminWrite', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SUPER_ADMIN_ONLY_KEY) return true;
        if (key === SUPER_ADMIN_WRITE_KEY) return true;
        return undefined;
      });
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          try {
            guard.canActivate(buildCtx({ method: 'GET' }));
            expect.fail('should have thrown');
          } catch (err) {
            const response = (err as ForbiddenException).getResponse() as { code: string };
            expect(response.code).toBe('WRITE_REQUIRES_SUPER_ADMIN_PLATFORM');
          }
        },
      );
    });
  });

  // ==========================================================================
  // @AdminOnly compat (Tache 2.2.3 legacy)
  // ==========================================================================

  describe('@AdminOnly backward compatibility', () => {
    it('17. @AdminOnly triggers same checks as @SuperAdminOnly', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.SuperAdminPlatform,
        }),
        () => {
          expect(guard.canActivate(buildCtx({ method: 'POST' }))).toBe(true);
        },
      );
    });

    it('18. @AdminOnly rejects analyst mutation', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === ADMIN_ONLY_KEY ? true : undefined,
      );
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userRole: AuthRole.AnalystSupport,
        }),
        () => {
          expect(() => guard.canActivate(buildCtx({ method: 'POST' }))).toThrow(
            ForbiddenException,
          );
        },
      );
    });
  });
});
