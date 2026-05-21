/**
 * Tests unitaires des param decorators tenant context.
 *
 * @TenantId() / @CurrentTenant() / @AssureUserId() / @CrossTenantAuthId() / @TenantSettingsParam()
 *
 * Approche : on appelle directement la factory du createParamDecorator pour eviter
 * la complexite NestJS pipeline. Les decorators sont des fonctions pures qui lisent
 * tenantContextStorage.
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import {
  buildMockTenantContext,
  buildMockTenantSettings,
  tenantContextStorage,
  withTenantContext,
} from '@insurtech/auth';
import { describe, expect, it } from 'vitest';
import { ADMIN_ONLY_KEY, REQUIRE_TENANT_KEY } from './metadata-keys.js';
import { AdminOnly } from './admin-only.decorator.js';
import { RequireTenant } from './require-tenant.decorator.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const USER_A = '22222222-2222-4222-8222-222222222222';

const readTenantId = (): string | undefined =>
  tenantContextStorage.getStore()?.tenantId;
const readCtx = () => tenantContextStorage.getStore();
const readSettings = () => tenantContextStorage.getStore()?.tenantSettings;
const readAssureUserId = (): string | undefined =>
  tenantContextStorage.getStore()?.assureUserId;
const readCrossTenantAuthId = (): string | undefined =>
  tenantContextStorage.getStore()?.crossTenantAuthorizationId;

describe('Param decorators -- tenant context', () => {
  it('TenantId returns tenantId when context active', async () => {
    await withTenantContext(buildMockTenantContext({ tenantId: TENANT_A }), () => {
      expect(readTenantId()).toBe(TENANT_A);
    });
  });

  it('TenantId returns undefined when no context', () => {
    expect(readTenantId()).toBeUndefined();
  });

  it('CurrentTenant returns full TenantContext', async () => {
    const expectedCtx = buildMockTenantContext({
      tenantId: TENANT_A,
      userId: USER_A,
    });
    await withTenantContext(expectedCtx, () => {
      const ctx = readCtx();
      expect(ctx?.tenantId).toBe(TENANT_A);
      expect(ctx?.userId).toBe(USER_A);
    });
  });

  it('TenantSettingsParam returns settings cached', async () => {
    const settings = buildMockTenantSettings({ locale: 'ar-MA', currency: 'EUR' });
    await withTenantContext(
      buildMockTenantContext({ tenantId: TENANT_A, tenantSettings: settings }),
      () => {
        const s = readSettings();
        expect(s?.locale).toBe('ar-MA');
        expect(s?.currency).toBe('EUR');
      },
    );
  });

  it('AssureUserId returns assureUserId for L3 context', async () => {
    await withTenantContext(
      buildMockTenantContext({
        tenantId: TENANT_A,
        assureUserId: USER_A,
        userId: USER_A,
      }),
      () => {
        expect(readAssureUserId()).toBe(USER_A);
      },
    );
  });

  it('AssureUserId returns undefined for non-assure context', async () => {
    await withTenantContext(buildMockTenantContext({ tenantId: TENANT_A }), () => {
      expect(readAssureUserId()).toBeUndefined();
    });
  });

  it('CrossTenantAuthId returns id when present (Sprint 26 prep)', async () => {
    await withTenantContext(
      buildMockTenantContext({
        tenantId: TENANT_A,
        crossTenantAuthorizationId: 'auth-abc',
      }),
      () => {
        expect(readCrossTenantAuthId()).toBe('auth-abc');
      },
    );
  });

  it('CrossTenantAuthId returns undefined when absent', async () => {
    await withTenantContext(buildMockTenantContext({ tenantId: TENANT_A }), () => {
      expect(readCrossTenantAuthId()).toBeUndefined();
    });
  });

  it('multiple decorators read same context atomically', async () => {
    const ctx = buildMockTenantContext({
      tenantId: TENANT_A,
      userId: USER_A,
      assureUserId: USER_A,
      crossTenantAuthorizationId: 'authz',
    });
    await withTenantContext(ctx, () => {
      expect(readTenantId()).toBe(TENANT_A);
      expect(readAssureUserId()).toBe(USER_A);
      expect(readCrossTenantAuthId()).toBe('authz');
    });
  });
});

describe('Class-level metadata decorators', () => {
  it('@RequireTenant sets REQUIRE_TENANT_KEY metadata on class', () => {
    @RequireTenant()
    class Sample {}

    const value = Reflect.getMetadata(REQUIRE_TENANT_KEY, Sample);
    expect(value).toBe(true);
  });

  it('@RequireTenant on method sets metadata on method', () => {
    class Sample {
      @RequireTenant()
      method(): void {}
    }
    const value = Reflect.getMetadata(REQUIRE_TENANT_KEY, Sample.prototype.method);
    expect(value).toBe(true);
  });

  it('@AdminOnly sets ADMIN_ONLY_KEY metadata on class', () => {
    @AdminOnly()
    class Sample {}

    const value = Reflect.getMetadata(ADMIN_ONLY_KEY, Sample);
    expect(value).toBe(true);
  });

  it('@AdminOnly on method sets metadata on method', () => {
    class Sample {
      @AdminOnly()
      method(): void {}
    }
    const value = Reflect.getMetadata(ADMIN_ONLY_KEY, Sample.prototype.method);
    expect(value).toBe(true);
  });

  it('@RequireTenant + @AdminOnly stack on same class', () => {
    @RequireTenant()
    @AdminOnly()
    class Sample {}

    expect(Reflect.getMetadata(REQUIRE_TENANT_KEY, Sample)).toBe(true);
    expect(Reflect.getMetadata(ADMIN_ONLY_KEY, Sample)).toBe(true);
  });
});
