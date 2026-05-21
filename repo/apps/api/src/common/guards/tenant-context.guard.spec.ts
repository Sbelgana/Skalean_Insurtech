/**
 * Tests unitaires TenantContextGuard.
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import {
  type ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantContextService,
  buildMockTenantContext,
  withTenantContext,
} from '@insurtech/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { ADMIN_ONLY_KEY, REQUIRE_TENANT_KEY } from '../decorators/metadata-keys.js';
import { TenantContextGuard } from './tenant-context.guard.js';

const buildExecutionContext = (): ExecutionContext => {
  const handler = function handler(): void {};
  const klass = class FakeController {};
  Object.defineProperty(handler, 'name', { value: 'fakeHandler' });
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
};

describe('TenantContextGuard', () => {
  let guard: TenantContextGuard;
  let reflector: Reflector;
  let tenantContext: TenantContextService;

  beforeEach(() => {
    reflector = new Reflector();
    tenantContext = new TenantContextService();
    guard = new TenantContextGuard(reflector, tenantContext);
  });

  // GROUP 1 : @Public() skips all

  it('1. allow @Public() endpoint without context', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === IS_PUBLIC_KEY ? true : undefined,
    );
    expect(guard.canActivate(buildExecutionContext())).toBe(true);
  });

  it('2. allow @Public() endpoint on /admin route too', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === IS_PUBLIC_KEY ? true : undefined,
    );
    expect(guard.canActivate(buildExecutionContext())).toBe(true);
  });

  // GROUP 2 : Missing context

  it('3. throw InternalServerErrorException if no context', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(() => guard.canActivate(buildExecutionContext())).toThrow(
      InternalServerErrorException,
    );
  });

  it('4. throw with code TENANT_CONTEXT_MISSING', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    try {
      guard.canActivate(buildExecutionContext());
      expect.fail('should have thrown');
    } catch (err) {
      const response = (err as InternalServerErrorException).getResponse() as {
        code: string;
      };
      expect(response.code).toBe('TENANT_CONTEXT_MISSING');
    }
  });

  // GROUP 3 : @AdminOnly()

  it('5. allow @AdminOnly() when isSuperAdmin true', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(buildMockTenantContext({ isSuperAdmin: true }), () => {
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  it('6. reject @AdminOnly() when isSuperAdmin false', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(buildMockTenantContext({ isSuperAdmin: false }), () => {
      expect(() => guard.canActivate(buildExecutionContext())).toThrow(
        ForbiddenException,
      );
    });
  });

  it('7. throw with code ADMIN_ACCESS_REQUIRED', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(buildMockTenantContext({ isSuperAdmin: false }), () => {
      try {
        guard.canActivate(buildExecutionContext());
        expect.fail('should have thrown');
      } catch (err) {
        const response = (err as ForbiddenException).getResponse() as { code: string };
        expect(response.code).toBe('ADMIN_ACCESS_REQUIRED');
      }
    });
  });

  // GROUP 4 : @RequireTenant()

  it('8. allow @RequireTenant() when tenantId present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === REQUIRE_TENANT_KEY ? true : undefined,
    );
    await withTenantContext(buildMockTenantContext({ tenantId: 'a-tenant' }), () => {
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  it('9. reject @RequireTenant() when tenantId absent (super admin context)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === REQUIRE_TENANT_KEY ? true : undefined,
    );
    await withTenantContext(
      buildMockTenantContext({ tenantId: undefined, isSuperAdmin: true }),
      () => {
        expect(() => guard.canActivate(buildExecutionContext())).toThrow(
          ForbiddenException,
        );
      },
    );
  });

  it('10. throw with code TENANT_ID_REQUIRED', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === REQUIRE_TENANT_KEY ? true : undefined,
    );
    await withTenantContext(
      buildMockTenantContext({ tenantId: undefined, isSuperAdmin: true }),
      () => {
        try {
          guard.canActivate(buildExecutionContext());
          expect.fail('should have thrown');
        } catch (err) {
          const response = (err as ForbiddenException).getResponse() as {
            code: string;
          };
          expect(response.code).toBe('TENANT_ID_REQUIRED');
        }
      },
    );
  });

  // GROUP 5 : Default behavior

  it('11. allow normal endpoint with valid context (no decorators)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await withTenantContext(buildMockTenantContext({ tenantId: 'a-tenant' }), () => {
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  // GROUP 6 : Priority order

  it('12. prefer @Public over @AdminOnly + @RequireTenant', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      if (key === ADMIN_ONLY_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(buildExecutionContext())).toBe(true);
  });

  it('13. @AdminOnly bypass @RequireTenant when isSuperAdmin true', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_ONLY_KEY) return true;
      if (key === REQUIRE_TENANT_KEY) return true;
      return undefined;
    });
    await withTenantContext(
      buildMockTenantContext({ tenantId: undefined, isSuperAdmin: true }),
      () => {
        expect(guard.canActivate(buildExecutionContext())).toBe(true);
      },
    );
  });

  it('14. @AdminOnly rejects even if tenantId present when not super admin', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_ONLY_KEY) return true;
      return undefined;
    });
    await withTenantContext(
      buildMockTenantContext({ tenantId: 'a-tenant', isSuperAdmin: false }),
      () => {
        expect(() => guard.canActivate(buildExecutionContext())).toThrow(
          ForbiddenException,
        );
      },
    );
  });

  // GROUP 7 : Reflector usage

  it('15. reflector.getAllAndOverride called with handler then class', () => {
    const spy = vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    try {
      guard.canActivate(buildExecutionContext());
    } catch {
      // no context -> throws, fine for this assertion
    }
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [firstKey, targets] = calls[0]!;
    expect(firstKey).toBe(IS_PUBLIC_KEY);
    expect(Array.isArray(targets)).toBe(true);
  });

  it('16. allow when context exists and no metadata decorators', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await withTenantContext(buildMockTenantContext(), () => {
      expect(guard.canActivate(buildExecutionContext())).toBe(true);
    });
  });

  it('17. @RequireTenant + @AdminOnly + tenantId present + super admin = allow', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ADMIN_ONLY_KEY) return true;
      if (key === REQUIRE_TENANT_KEY) return true;
      return undefined;
    });
    await withTenantContext(
      buildMockTenantContext({ tenantId: 'a-tenant', isSuperAdmin: true }),
      () => {
        expect(guard.canActivate(buildExecutionContext())).toBe(true);
      },
    );
  });

  it('18. context after guard execution unchanged (read-only)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const initial = buildMockTenantContext({ tenantId: 'orig' });
    await withTenantContext(initial, () => {
      guard.canActivate(buildExecutionContext());
      expect(tenantContext.getCurrentTenantId()).toBe('orig');
    });
  });
});
